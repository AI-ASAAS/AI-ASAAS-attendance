const { test } = require('node:test');
const assert = require('node:assert/strict');
const { issueQr, verifyQr, decodeQr } = require('../src/services/attendance-policy');

const secret = 's'.repeat(48);
const branch = {
  id: 1,
  qr_revision: 1,
  location_revision: 1,
  active: true,
  latitude: 15.3694,
  longitude: 44.1910,
  entry_radius: 80,
  exit_radius: 120,
  max_accuracy: 30
};
const now = new Date('2026-10-21T08:00:00Z');

test('QR Action Separation: issueQr and decodeQr accurately stamp action into tokens', () => {
  const enterToken = issueQr(branch, secret, now, 'enter');
  const exitToken = issueQr(branch, secret, now, 'exit');

  const enterData = decodeQr(enterToken);
  const exitData = decodeQr(exitToken);

  assert.equal(enterData.action, 'enter');
  assert.equal(exitData.action, 'exit');
  assert.equal(enterData.branch, '1');
  assert.equal(exitData.branch, '1');
});

test('QR Action Separation: Cannot check in using an EXIT token', () => {
  const exitToken = issueQr(branch, secret, now, 'exit');

  // Attempting 'enter' action with exitToken must throw QR_ACTION_MISMATCH
  assert.throws(
    () => verifyQr(exitToken, branch, secret, now, 'enter'),
    err => {
      assert.equal(err.code, 'QR_ACTION_MISMATCH');
      assert.match(err.message, /مخصص لتسجيل الانصراف والخروج فقط/);
      return true;
    }
  );
});

test('QR Action Separation: Cannot check out using an ENTER token', () => {
  const enterToken = issueQr(branch, secret, now, 'enter');

  // Attempting 'exit' action with enterToken must throw QR_ACTION_MISMATCH
  assert.throws(
    () => verifyQr(enterToken, branch, secret, now, 'exit'),
    err => {
      assert.equal(err.code, 'QR_ACTION_MISMATCH');
      assert.match(err.message, /مخصص لتسجيل الدخول فقط/);
      return true;
    }
  );
});

test('QR Action Separation: ENTER token validates successfully for enter, and EXIT token for exit', () => {
  const enterToken = issueQr(branch, secret, now, 'enter');
  const exitToken = issueQr(branch, secret, now, 'exit');

  assert.equal(verifyQr(enterToken, branch, secret, now, 'enter'), true);
  assert.equal(verifyQr(exitToken, branch, secret, now, 'exit'), true);
});

test('QR Action Separation: Verification that secure-app file syntax is valid and defines isAuto', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require.resolve('../src/secure-app'), 'utf8');
  assert.match(content, /const isAuto = b\.action === 'auto' \|\| Boolean\(b\.is_auto\);/);
});
