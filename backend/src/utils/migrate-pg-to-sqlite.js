'use strict';

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { DatabaseSync } = require('node:sqlite');

const PG_URL = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:6543/asas';
const TARGET_SQLITE = process.argv[2]
  ? path.resolve(process.argv[2])
  : (process.env.SQLITE_PATH || path.resolve(__dirname, '../../../database/asas.db'));
const SCHEMA_PATH = path.resolve(__dirname, '../../../database/asas-sqlite-schema.sql');

function toSqliteVal(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Uint8Array))) {
    return JSON.stringify(v);
  }
  return v;
}

async function migrate() {
  const pool = new Pool({ connectionString: PG_URL });
  const targetDir = path.dirname(TARGET_SQLITE);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  // Remove any stale target/wal/shm files before fresh import
  for (const suffix of ['', '-wal', '-shm']) {
    const f = TARGET_SQLITE + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const sqlite = new DatabaseSync(TARGET_SQLITE);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA synchronous = FULL;');
  sqlite.exec('PRAGMA foreign_keys = OFF;');
  sqlite.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  sqlite.exec('PRAGMA foreign_keys = OFF;');

  const specs = [
    {
      name: 'branches',
      query: 'SELECT id, name, latitude, longitude, entry_radius, exit_radius, max_accuracy, exit_samples, exit_delay_seconds, active, location_revision, qr_revision FROM branches ORDER BY id ASC'
    },
    {
      name: 'shifts',
      query: 'SELECT id, name, start_time::text AS start_time, end_time::text AS end_time, work_days, grace_minutes, close_policy, deduct_away FROM shifts ORDER BY id ASC'
    },
    {
      name: 'departments',
      query: 'SELECT id, name FROM departments ORDER BY id ASC'
    },
    {
      name: 'accounts',
      query: 'SELECT id, identifier, name, password_hash, role, branch_id, shift_id, department_id, email, phone, bound_device_id, bound_device_name, device_bound_at, permissions, active, created_at, avatar, is_remote FROM accounts ORDER BY id ASC'
    },
    {
      name: 'auth_sessions',
      query: 'SELECT token_hash, account_id, expires_at, created_at FROM auth_sessions'
    },
    {
      name: 'duty_records',
      query: 'SELECT id, employee_id, branch_id, shift_id, shift_start, shift_end, first_in, last_out, state, exit_reason, close_policy, deduct_away, away_started, away_seconds, late_minutes, gps_state, last_seen, exit_candidate, is_remote FROM duty_records ORDER BY id ASC'
    },
    {
      name: 'attendance_events',
      query: 'SELECT id, record_id, employee_id, kind, captured_at, received_at, details, request_id::text AS request_id FROM attendance_events ORDER BY id ASC'
    },
    {
      name: 'audit_log',
      query: 'SELECT id, actor_id, action, target, reason, details, created_at FROM audit_log ORDER BY id ASC'
    },
    {
      name: 'leave_requests',
      query: 'SELECT id, employee_id, from_date::text AS from_date, to_date::text AS to_date, reason, status, reviewed_by, comment, created_at FROM leave_requests ORDER BY id ASC'
    },
    {
      name: 'announcements',
      query: 'SELECT id, title, content, priority, sender_id, sender_name, send_email, created_at, active FROM announcements ORDER BY id ASC'
    },
    {
      name: 'system_settings',
      query: 'SELECT key, value, updated_at FROM system_settings'
    }
  ];

  const report = [];
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    for (const spec of specs) {
      const pgRes = await pool.query(spec.query);
      const rows = pgRes.rows;
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const placeholders = cols.map((_, i) => `?${i + 1}`).join(',');
        const stmt = sqlite.prepare(`INSERT INTO ${spec.name} (${cols.join(',')}) VALUES (${placeholders})`);
        for (const r of rows) {
          stmt.run(...cols.map(c => toSqliteVal(r[c])));
        }
      }
      const cnt = sqlite.prepare(`SELECT COUNT(*) AS cnt FROM ${spec.name}`).get().cnt;
      if (cnt !== rows.length) {
        throw new Error(`Row count mismatch in ${spec.name}: PG=${rows.length}, SQLite=${cnt}`);
      }
      report.push({ table: spec.name, pg_rows: rows.length, sqlite_rows: cnt });
    }
    sqlite.exec('COMMIT');
  } catch (err) {
    try { sqlite.exec('ROLLBACK'); } catch (_) {}
    sqlite.close();
    await pool.end();
    throw err;
  }

  sqlite.exec('PRAGMA foreign_keys = ON;');
  const fkErrors = sqlite.prepare('PRAGMA foreign_key_check;').all();
  if (fkErrors.length > 0) {
    throw new Error('Foreign key violations detected: ' + JSON.stringify(fkErrors));
  }
  const integrity = sqlite.prepare('PRAGMA integrity_check;').get();
  if (!integrity || integrity.integrity_check !== 'ok') {
    throw new Error('SQLite integrity check failed: ' + JSON.stringify(integrity));
  }

  // Ensure WAL checkpoint flushes cleanly into main db file
  sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  sqlite.close();
  await pool.end();

  console.table(report);
  console.log(`✅ Migrated 100% of data cleanly to ${TARGET_SQLITE} (integrity: ok, FK violations: 0)`);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
