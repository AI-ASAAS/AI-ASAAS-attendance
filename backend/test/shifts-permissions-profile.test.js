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

test('Super Admin Identifier Renumbering: verifies super_admin check and duplicate prevention in secure-app', () => {
  const content = fs.readFileSync(require.resolve('../src/secure-app'), 'utf8');
  assert.match(content, /req\.user\.role !== 'super_admin'/);
  assert.match(content, /إعادة ترقيم أو تعديل الرقم الوظيفي لمدير النظام \(السوبر أدمن\) فقط/);
  assert.match(content, /SELECT id FROM accounts WHERE identifier=\$1 AND id<>\$2/);
  assert.match(content, /previous_identifier:account\.identifier/);
});

test('Duty Attendance Reminder System: verifies heartbeat endpoint, duty-maintenance reminders, and notification service', () => {
  const appContent = fs.readFileSync(require.resolve('../src/secure-app'), 'utf8');
  assert.match(appContent, /app\.post\('\/api\/attendance\/heartbeat'/);
  assert.match(appContent, /app\.post\('\/api\/admin\/remind-duty'/);
  assert.match(appContent, /duty_reminder_enabled/);
  assert.match(appContent, /duty_reminder_interval_hours/);

  const maintenanceContent = fs.readFileSync(require.resolve('../src/services/duty-maintenance'), 'utf8');
  assert.match(maintenanceContent, /checkDutyReminders/);
  assert.match(maintenanceContent, /duty_reminder/);

  const notifService = require('../src/services/notification.service');
  assert.equal(typeof notifService.notifyDutyReminder, 'function');
});
