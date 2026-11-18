'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/database');

async function ensureLocalDatabase() {
  const dbPath = db.getDbPath();
  await db.query("SELECT 1 FROM accounts LIMIT 1").catch(async () => {
    await db.query("SELECT 1");
  });

  // Auto-bootstrap fresh deployment if accounts table is empty (0 users)
  try {
    const countRes = await db.query('SELECT COUNT(*) AS count FROM accounts');
    const totalAccounts = Number(countRes.rows[0]?.count || 0);
    if (totalAccounts === 0) {
      const security = require('../services/session-security');
      console.log('🌱 Fresh deployment detected. Seeding initial branch, shift, and administrator...');

      let branchId = 1;
      const bCheck = await db.query('SELECT id FROM branches LIMIT 1');
      if (bCheck.rows.length === 0) {
        const b = await db.query(
          `INSERT INTO branches (name, latitude, longitude, entry_radius, exit_radius, max_accuracy, exit_samples, exit_delay_seconds, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          ['AI-ASAAS', 15.3060835, 44.1982291, 80, 120, 30, 3, 120, 1]
        );
        branchId = b.rows[0].id;
      } else {
        branchId = bCheck.rows[0].id;
      }

      let shiftId = 1;
      const sCheck = await db.query('SELECT id FROM shifts LIMIT 1');
      if (sCheck.rows.length === 0) {
        const s = await db.query(
          `INSERT INTO shifts (name, start_time, end_time, work_days, grace_minutes, close_policy, deduct_away)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          ['الفتره الاولى', '08:00:00', '20:00:00', [0, 1, 2, 3, 4, 6], 15, 'scheduled', 0]
        );
        shiftId = s.rows[0].id;
      } else {
        shiftId = sCheck.rows[0].id;
      }

      const defaultId = process.env.SETUP_ADMIN_IDENTIFIER || 'admin';
      const defaultPass = process.env.SETUP_ADMIN_PASSWORD || 'Admin@123456';
      const passHash = await security.hashPassword(defaultPass);

      await db.query(
        `INSERT INTO accounts (identifier, name, password_hash, role, branch_id, shift_id, permissions, active)
         VALUES ($1, $2, $3, 'super_admin', $4, $5, '[]', 1)`,
        [defaultId, 'الموارد البشرية', passHash, branchId, shiftId]
      );
      console.log(`✅ Default admin created: identifier=${defaultId}`);
    }
  } catch (seedErr) {
    console.warn('[Bootstrap Seed Notice]:', seedErr.message);
  }

  if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    console.log(`✅ SQLite database ready: ${dbPath}`);
    try {
      const backupDir = path.resolve(__dirname, '../../../backups/sqlite');
      const todayStamp = new Date().toISOString().slice(0, 10);
      const dailyBackup = path.join(backupDir, `asas_${todayStamp}.db`);
      if (!fs.existsSync(dailyBackup)) {
        await db.backupTo(dailyBackup);
        console.log(`💾 Daily SQLite backup saved: ${dailyBackup}`);
        // Retain last 14 daily backups
        const files = fs.readdirSync(backupDir)
          .filter(f => /^asas_\d{4}-\d{2}-\d{2}\.db$/.test(f))
          .sort();
        while (files.length > 14) {
          const oldest = files.shift();
          try { fs.unlinkSync(path.join(backupDir, oldest)); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('[SQLite Daily Backup Warning]:', e.message);
    }
  }
}

module.exports = { ensureLocalDatabase };
