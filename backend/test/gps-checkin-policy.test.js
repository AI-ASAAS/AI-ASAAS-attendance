'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../src/services/attendance-policy');

// Replicate the GPS validation logic from secure-app.js
function evaluateAttendanceLocation(fix, branch, action = 'enter') {
  const now = new Date();
  const location = policy.classifyFix(fix, branch, now);
  if (action !== 'location') {
    const dist = Math.round(location.distance);
    const maxAccuracy = Math.max(Number(branch.max_accuracy || 200), 250);
    if (fix.accuracy > maxAccuracy) {
      const err = new Error(`إشارة تحديد الموقع ضعيفة (الدقة: ${Math.round(fix.accuracy)} متر، والحد الأقصى للدقة المقبولة هو ${maxAccuracy} متر). يرجى تفعيل "الموقع الدقيق Precise Location" في الهاتف والاقتراب من نافذة والمحاولة مجدداً.`);
      err.code = 'GPS_LOW_ACCURACY';
      err.status = 422;
      throw err;
    }
    if (dist > Number(branch.entry_radius)) {
      const err = new Error(`أنت خارج نطاق الفرع (${dist} متر). النطاق المسموح للدخول: ${branch.entry_radius} متر. يرجى التواجد في مقر الفرع أو تعديل إحداثيات الفرع في الإدارة لموقعك الحالي.`);
      err.code = 'GPS_REJECTED';
      err.status = 422;
      throw err;
    }
    location.state = 'inside';
  }
  return location;
}

test('GPS Check-in: User at 8 meters distance within 100m radius is accepted (not falsely rejected)', () => {
  const branch = {
    id: 1,
    active: true,
    latitude: 15.277341,
    longitude: 44.226912,
    entry_radius: 100,
    exit_radius: 150,
    max_accuracy: 250
  };

  const fix8m = {
    latitude: 15.277341 + 0.000072,
    longitude: 44.226912,
    accuracy: 65,
    captured_at: new Date().toISOString()
  };

  const res = evaluateAttendanceLocation(fix8m, branch, 'enter');
  assert.equal(res.state, 'inside');
  assert.ok(Math.round(res.distance) <= 10, `Expected distance around 8m, got ${res.distance}`);
});

test('GPS Check-in: User with accuracy 132m (indoor smartphone) is smoothly accepted', () => {
  const branch = {
    id: 1,
    active: true,
    latitude: 15.277341,
    longitude: 44.226912,
    entry_radius: 120,
    exit_radius: 250,
    max_accuracy: 250
  };

  const fix132m = {
    latitude: 15.277341 + 0.00005, // ~5 meters away
    longitude: 44.226912,
    accuracy: 132, // User's real test device accuracy
    captured_at: new Date().toISOString()
  };

  const res = evaluateAttendanceLocation(fix132m, branch, 'enter');
  assert.equal(res.state, 'inside');
});

test('GPS Check-in: Extreme low accuracy (> maxAccuracy e.g. 450m) gives helpful GPS_LOW_ACCURACY', () => {
  const branch = {
    id: 1,
    active: true,
    latitude: 15.277341,
    longitude: 44.226912,
    entry_radius: 100,
    exit_radius: 150,
    max_accuracy: 250
  };

  const fixBadAccuracy = {
    latitude: 15.277341,
    longitude: 44.226912,
    accuracy: 450, // Cellular triangulation / IP fallback
    captured_at: new Date().toISOString()
  };

  assert.throws(
    () => evaluateAttendanceLocation(fixBadAccuracy, branch, 'enter'),
    (err) => err.code === 'GPS_LOW_ACCURACY' && err.message.includes('ضعيفة')
  );
});

test('GPS Check-in: Genuinely outside user (> entry_radius) is rejected with GPS_REJECTED', () => {
  const branch = {
    id: 1,
    active: true,
    latitude: 15.277341,
    longitude: 44.226912,
    entry_radius: 100,
    exit_radius: 150,
    max_accuracy: 250
  };

  // Coordinates ~250 meters away
  const fix250m = {
    latitude: 15.277341 + 0.00225,
    longitude: 44.226912,
    accuracy: 25,
    captured_at: new Date().toISOString()
  };

  assert.throws(
    () => evaluateAttendanceLocation(fix250m, branch, 'enter'),
    (err) => err.code === 'GPS_REJECTED' && err.message.includes('أنت خارج نطاق الفرع')
  );
});
