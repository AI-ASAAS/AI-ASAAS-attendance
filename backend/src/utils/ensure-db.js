'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/database');

async function ensureLocalDatabase() {
  const dbPath = db.getDbPath();
  await db.query("SELECT 1 FROM accounts LIMIT 1").catch(async () => {
    await db.query("SELECT 1");
  });

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
