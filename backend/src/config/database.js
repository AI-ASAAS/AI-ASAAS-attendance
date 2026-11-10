'use strict';

if (!process.env.SQLITE_PATH && !process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
}

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');

const DEFAULT_DB_PATH = path.resolve(__dirname, '../../../database/asas.db');
const SCHEMA_PATH = path.resolve(__dirname, '../../../database/asas-sqlite-schema.sql');

const BOOLEAN_COLS = new Set(['active', 'deduct_away', 'is_remote', 'send_email']);
const JSON_ARRAY_COLS = new Set(['permissions', 'work_days']);
const JSON_OBJ_COLS = new Set(['exit_candidate', 'details']);

let dbInstance = null;
let currentDbPath = null;
const stmtCache = new Map();
let txChain = Promise.resolve();

function resolveDbPath() {
  return process.env.SQLITE_PATH ? String(process.env.SQLITE_PATH).trim() : DEFAULT_DB_PATH;
}

function getInstance() {
  const targetPath = resolveDbPath();
  if (dbInstance && currentDbPath === targetPath) {
    return dbInstance;
  }
  if (dbInstance) {
    close();
  }

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new DatabaseSync(targetPath, {
    allowUnknownNamedParameters: true,
    readBigInts: false
  });

  if (targetPath !== ':memory:') {
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA synchronous = FULL;');
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA busy_timeout = 10000;');
  sqlite.exec('PRAGMA temp_store = MEMORY;');

  // Auto-initialize schema if database is brand new (e.g. missing accounts table)
  const hasAccounts = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'")
    .get();
  if (!hasAccounts && fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    sqlite.exec(schemaSql);
  }

  dbInstance = sqlite;
  currentDbPath = targetPath;
  stmtCache.clear();
  return dbInstance;
}

function bindArg(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val.toISOString();
  if (Array.isArray(val) || (typeof val === 'object' && !(val instanceof Uint8Array))) {
    return JSON.stringify(val);
  }
  return val;
}

function normalizeRow(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const row = {};
  for (const [k, v] of Object.entries(raw)) {
    if (BOOLEAN_COLS.has(k)) {
      row[k] = v === null || v === undefined ? v : Boolean(v);
    } else if (JSON_ARRAY_COLS.has(k)) {
      if (v === null || v === undefined) {
        row[k] = v;
      } else if (Array.isArray(v)) {
        row[k] = v;
      } else if (typeof v === 'string') {
        try {
          row[k] = JSON.parse(v);
        } catch {
          row[k] = [];
        }
      } else {
        row[k] = [];
      }
    } else if (JSON_OBJ_COLS.has(k)) {
      if (v === null || v === undefined) {
        row[k] = null;
      } else if (typeof v === 'object') {
        row[k] = v;
      } else if (typeof v === 'string') {
        try {
          row[k] = JSON.parse(v);
        } catch {
          row[k] = {};
        }
      } else {
        row[k] = v;
      }
    } else {
      row[k] = v;
    }
  }
  return row;
}

function mapSqliteError(err) {
  if (!err || err.code !== 'ERR_SQLITE_ERROR') return err;
  // Map SQLite constraint errcodes to PostgreSQL-compatible SQLSTATE codes used by handlers
  if (err.errcode === 2067 || err.errcode === 1555) {
    err.code = '23505';
  } else if (err.errcode === 787) {
    err.code = '23503';
  } else if (err.errcode === 275 || err.errcode === 1299) {
    err.code = '23514';
  }
  return err;
}

function getStatement(sqlite, sql) {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = sqlite.prepare(sql);
    if (stmtCache.size > 500) {
      const firstKey = stmtCache.keys().next().value;
      stmtCache.delete(firstKey);
    }
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

function executeSync(sql, args = []) {
  const sqlite = getInstance();
  try {
    const trimmed = String(sql).trim();
    if (!trimmed) return { rows: [], rowCount: 0 };

    // Multi-statement DDL/script execution when no bound parameters are supplied
    if (args.length === 0 && trimmed.includes(';') && trimmed.replace(/;+$/, '').includes(';')) {
      sqlite.exec(trimmed);
      return { rows: [], rowCount: 0 };
    }

    const stmt = getStatement(sqlite, sql);
    const hasCols = stmt.columns().length > 0;
    const usesDollarParams = /\$\d+/.test(sql);

    if (hasCols) {
      let rawRows;
      if (!args || args.length === 0) {
        rawRows = stmt.all();
      } else if (usesDollarParams) {
        const paramMap = {};
        for (let i = 0; i < args.length; i++) {
          paramMap[`$${i + 1}`] = bindArg(args[i]);
        }
        rawRows = stmt.all(paramMap);
      } else {
        rawRows = stmt.all(...args.map(bindArg));
      }
      const rows = rawRows.map(normalizeRow);
      return { rows, rowCount: rows.length };
    } else {
      let info;
      if (!args || args.length === 0) {
        info = stmt.run();
      } else if (usesDollarParams) {
        const paramMap = {};
        for (let i = 0; i < args.length; i++) {
          paramMap[`$${i + 1}`] = bindArg(args[i]);
        }
        info = stmt.run(paramMap);
      } else {
        info = stmt.run(...args.map(bindArg));
      }
      return { rows: [], rowCount: Number(info.changes || 0), lastInsertRowid: info.lastInsertRowid };
    }
  } catch (err) {
    throw mapSqliteError(err);
  }
}

async function query(sql, args = []) {
  return executeSync(sql, args);
}

async function transaction(work) {
  const run = txChain.then(async () => {
    const sqlite = getInstance();
    const client = {
      query: async (sql, args = []) => executeSync(sql, args)
    };
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const value = await work(client);
      sqlite.exec('COMMIT');
      return value;
    } catch (error) {
      try {
        sqlite.exec('ROLLBACK');
      } catch (_) {}
      throw error;
    }
  });

  // Keep txChain alive even when an individual transaction rejects
  txChain = run.catch(() => {});
  return run;
}

async function backupTo(destPath) {
  const sqlite = getInstance();
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await backup(sqlite, destPath);
  return destPath;
}

function close() {
  stmtCache.clear();
  if (dbInstance) {
    try {
      if (dbInstance.isOpen) {
        dbInstance.close();
      }
    } catch (_) {}
    dbInstance = null;
    currentDbPath = null;
  }
}

module.exports = {
  query,
  transaction,
  backupTo,
  getDbPath: resolveDbPath,
  close,
  pool: {
    end: async () => close()
  }
};
