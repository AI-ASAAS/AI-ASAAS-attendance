'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const db = require('../config/database');

const GDRIVE_FOLDER_ID = process.env.GDRIVE_BACKUP_FOLDER_ID || '1GBgXVA2SQ4DeZHUas0hb-fXrGKJ2J3s5';
const GDRIVE_DB_FILE_ID = process.env.GDRIVE_DB_FILE_ID || '1G1hOqsJ9HgWQeIRXiso2vktM-AHUZ4p-';
const GDRIVE_SQL_FILE_ID = process.env.GDRIVE_SQL_FILE_ID || '1ZSdNm43_oHja2o7s12SRD-YHFyicBHj3';

let isSyncing = false;
let lastSyncResult = null;

function execGdrive(args) {
  return new Promise((resolve, reject) => {
    // Invoke gdrive via cmd.exe without shell: true
    execFile('cmd.exe', ['/d', '/c', 'gdrive', ...args], { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || stdout || error.message));
      }
      resolve((stdout || '').trim());
    });
  });
}

async function performGoogleDriveBackup() {
  if (isSyncing) {
    return { success: false, message: 'جاري رفع النسخة الاحتياطية بالفعل...' };
  }
  isSyncing = true;

  try {
    const dbPath = db.getDbPath();
    if (!fs.existsSync(dbPath)) {
      throw new Error('ملف قاعدة البيانات غير موجود في ' + dbPath);
    }

    // 1. Checkpoint WAL
    try {
      await db.query('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (_) {}

    // 2. Safe online backup to temp backup file
    const backupDir = path.resolve(__dirname, '../../../database/backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const localBackupDb = path.join(backupDir, 'asas_latest_backup.db');
    await db.backupTo(localBackupDb);

    // 3. Update asas.db on Google Drive
    let dbUpdateRes = '';
    if (GDRIVE_DB_FILE_ID) {
      dbUpdateRes = await execGdrive(['mutate', 'update', GDRIVE_DB_FILE_ID, localBackupDb]);
    } else {
      dbUpdateRes = await execGdrive(['mutate', 'upload', localBackupDb, '--parent', GDRIVE_FOLDER_ID]);
    }

    // 4. Generate SQL dump and upload
    const localSqlDump = path.join(backupDir, 'asas_dump_latest.sql');
    await generateSqlDump(localBackupDb, localSqlDump);
    let sqlUpdateRes = '';
    if (GDRIVE_SQL_FILE_ID) {
      sqlUpdateRes = await execGdrive(['mutate', 'update', GDRIVE_SQL_FILE_ID, localSqlDump]);
    }

    const nowIso = new Date().toISOString();
    lastSyncResult = {
      success: true,
      timestamp: nowIso,
      folderId: GDRIVE_FOLDER_ID,
      folderUrl: `https://drive.google.com/drive/folders/${GDRIVE_FOLDER_ID}`,
      dbResult: dbUpdateRes,
      sqlResult: sqlUpdateRes
    };

    // Save status in system_settings
    try {
      await db.query(`
        INSERT INTO system_settings (key, value) VALUES ('last_gdrive_backup', $1)
        ON CONFLICT(key) DO UPDATE SET value = $1
      `, [JSON.stringify(lastSyncResult)]);
    } catch (_) {}

    console.log('[Google Drive Sync]: Database successfully synced to Drive at', nowIso);
    return lastSyncResult;
  } catch (err) {
    const nowIso = new Date().toISOString();
    lastSyncResult = {
      success: false,
      timestamp: nowIso,
      error: err.message
    };
    console.warn('[Google Drive Sync Warning]:', err.message);
    return lastSyncResult;
  } finally {
    isSyncing = false;
  }
}

async function generateSqlDump(srcDbPath, outSqlPath) {
  const { DatabaseSync } = require('node:sqlite');
  const srcDb = new DatabaseSync(srcDbPath, { readOnly: true });
  try {
    const sqlLines = [];
    sqlLines.push('-- ASAS ATTENDANCE SYSTEM SQL DUMP');
    sqlLines.push(`-- Generated: ${new Date().toISOString()}`);
    sqlLines.push('PRAGMA foreign_keys=OFF;');
    sqlLines.push('BEGIN TRANSACTION;');

    const tables = srcDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    for (const table of tables) {
      sqlLines.push(`\n-- Table: ${table.name}`);
      sqlLines.push(`DROP TABLE IF EXISTS "${table.name}";`);
      sqlLines.push(`${table.sql};`);

      const rows = srcDb.prepare(`SELECT * FROM "${table.name}"`).all();
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const colNames = cols.map(c => `"${c}"`).join(', ');
        const valHolders = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        }).join(', ');
        sqlLines.push(`INSERT INTO "${table.name}" (${colNames}) VALUES (${valHolders});`);
      }
    }

    const indexes = srcDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
    for (const idx of indexes) {
      sqlLines.push(`${idx.sql};`);
    }

    sqlLines.push('\nCOMMIT;');
    sqlLines.push('PRAGMA foreign_keys=ON;\n');
    fs.writeFileSync(outSqlPath, sqlLines.join('\n'), 'utf8');
  } finally {
    srcDb.close();
  }
}

function getSyncStatus() {
  return lastSyncResult || { success: true, timestamp: null, message: 'لم يتم الرفع خلال الجلسة الحالية' };
}

module.exports = {
  performGoogleDriveBackup,
  getSyncStatus,
  GDRIVE_FOLDER_ID
};
