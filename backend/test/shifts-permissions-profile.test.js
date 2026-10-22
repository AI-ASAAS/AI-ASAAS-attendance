const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Shifts, Permissions and Profile: secure-app code contains DELETE shifts endpoint', () => {
  const content = fs.readFileSync(require.resolve('../src/secure-app'), 'utf8');
  assert.match(content, /app\.delete\('\/api\/admin\/shifts\/:id'/);
  assert.match(content, /لا يمكن حذف هذا الدوام لأنه مرتبط بـ/);
});

test('Shifts, Permissions and Profile: allows custom permissions regex', () => {
  const content = fs.readFileSync(require.resolve('../src/secure-app'), 'utf8');
  assert.ok(content.includes('^[a-zA-Z0-9_.-]'));
});

test('Shifts, Permissions and Profile: profile endpoint supports min 6 char passwords and up to 1MB avatars', () => {
  const content = fs.readFileSync(require.resolve('../src/secure-app'), 'utf8');
  assert.match(content, /app\.put\('\/api\/auth\/profile'/);
  assert.match(content, /new_password\.length<6/);
  assert.match(content, /slice\(0, 1000000\)/);
});
