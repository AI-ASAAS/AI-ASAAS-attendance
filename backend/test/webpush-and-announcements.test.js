'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpushService = require('../src/services/webpush.service');

test('WebPush & Announcements: VAPID public key is generated and valid', async () => {
  const pubKey = webpushService.getPublicKey();
  assert.ok(pubKey, 'Public key should not be null');
  assert.equal(typeof pubKey, 'string', 'Public key should be a string');
  assert.ok(pubKey.length >= 65, 'VAPID public key should be valid base64url format');
});

test('WebPush & Announcements: secure-app.js defines push and read tracking routes', async () => {
  const code = fs.readFileSync(path.resolve(__dirname, '../src/secure-app.js'), 'utf8');
  assert.ok(code.includes('/api/push/public-key'), 'Missing /api/push/public-key endpoint');
  assert.ok(code.includes('/api/push/subscribe'), 'Missing /api/push/subscribe endpoint');
  assert.ok(code.includes('/api/push/unsubscribe'), 'Missing /api/push/unsubscribe endpoint');
  assert.ok(code.includes('/api/announcements/mark-read'), 'Missing /api/announcements/mark-read endpoint');
  assert.ok(code.includes("target === 'employee'"), 'Missing target === employee handling in remind-duty');
  assert.ok(code.includes("sendPushToAccount"), 'Missing sendPushToAccount invocation');
  assert.ok(code.includes("sendPushToAll"), 'Missing sendPushToAll invocation');
});
