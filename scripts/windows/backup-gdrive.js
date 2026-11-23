'use strict';

const path = require('node:path');
try {
  require(path.resolve(__dirname, '../../backend/node_modules/dotenv')).config({
    path: path.resolve(__dirname, '../../backend/.env')
  });
} catch (_) {}

const { performGoogleDriveBackup } = require('../../backend/src/services/gdrive-sync');

console.log('=====================================================');
console.log('  AI-ASAAS ATTENDANCE - GOOGLE DRIVE AUTO SYNC');
console.log('  رفع النسخة الاحتياطية تلقائياً إلى Google Drive');
console.log('=====================================================');

performGoogleDriveBackup().then(res => {
  if (res.success) {
    console.log('\nتم رفع وتحديث قاعدة البيانات بنجاح في Google Drive:');
    console.log(' - التوقيت:', res.timestamp);
    console.log(' - رابط المجلد في الدرايف:', res.folderUrl);
    console.log(' - ملف قاعدة البيانات:', res.dbResult);
    console.log(' - ملف تصدير SQL:', res.sqlResult);
    process.exit(0);
  } else {
    console.error('\nحدث خطأ أثناء الرفع إلى Google Drive:', res.error || res.message);
    process.exit(1);
  }
}).catch(err => {
  console.error('\nخطأ غير متوقع:', err.message);
  process.exit(1);
});
