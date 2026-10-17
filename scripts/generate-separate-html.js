const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, '../backend/public/attend.html');
let content = fs.readFileSync(srcFile, 'utf8');

// 1. Generate enter.html
let enterContent = content
  .replace(
    '<title>AI-ASAAS-attendance · مساحة التحضير للهواتف الذكية والآيفون</title>',
    '<title>AI-ASAAS · بوابة كود تسجيل الدخول والعودة (Check-In)</title>'
  )
  .replace(
    "actionHint = search.get('action') || '';",
    "actionHint = search.get('action') || 'enter';"
  );

// 2. Generate exit.html
let exitContent = content
  .replace(
    '<title>AI-ASAAS-attendance · مساحة التحضير للهواتف الذكية والآيفون</title>',
    '<title>AI-ASAAS · بوابة كود تسجيل الخروج والانصراف (Check-Out)</title>'
  )
  .replace(
    "actionHint = search.get('action') || '';",
    "actionHint = search.get('action') || 'exit';"
  );

// Write to backend/public and frontend/public
const targets = [
  { name: 'enter.html', data: enterContent },
  { name: 'exit.html', data: exitContent }
];

for (const t of targets) {
  fs.writeFileSync(path.join(__dirname, '../backend/public', t.name), t.data, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../frontend/public', t.name), t.data, 'utf8');
  console.log(`Successfully generated ${t.name} in both backend and frontend public directories.`);
}
