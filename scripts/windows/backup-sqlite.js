'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');

const projectRoot = path.resolve(__dirname, '../..');
const srcDbPath = process.env.SQLITE_PATH || path.join(projectRoot, 'database', 'asas.db');
const backupDir = path.join(projectRoot, 'backups', 'sqlite');

async function main() {
  if (!fs.existsSync(srcDbPath)) {
    throw new Error(`SQLite database not found at: ${srcDbPath}`);
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destPath = path.join(backupDir, `asas_manual_${stamp}.db`);

  const sourceDb = new DatabaseSync(srcDbPath, { readOnly: true });
  try {
    await backup(sourceDb, destPath);
    const size = fs.statSync(destPath).size;
    console.log(`✅ تم إنشاء النسخة الاحتياطية الآمنة بنجاح:\n   ${destPath} (${size} bytes)`);
  } finally {
    sourceDb.close();
  }
}

main().catch(err => {
  console.error('❌ فشل النسخ الاحتياطي:', err.message);
  process.exit(1);
});
