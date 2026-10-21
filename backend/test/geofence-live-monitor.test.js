'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../src/services/attendance-policy');

// Replicate geofence monitoring handler from secure-app.js
function evaluateGeofenceMonitor({ record, fix, branch, now = new Date() }) {
  const location = policy.classifyFix(fix, branch, now);
  const dist = Math.round(location.distance);
  const maxAcc = Math.max(Number(branch.max_accuracy || 200), 250);
  const insideEntry = dist <= Number(branch.entry_radius) && fix.accuracy <= maxAcc;
  const currentGpsState = insideEntry ? 'inside' : (dist > Number(branch.exit_radius) ? 'outside' : 'uncertain');

  // Case 1: Employee is NOT currently inside (device scanner / auto-entry pre-check)
  if (!record || record.state !== 'inside') {
    return {
      action: 'location',
      duty_state: record?.state || 'outside',
      state: insideEntry ? 'inside' : 'outside',
      inside_geofence: insideEntry,
      distance: dist,
      accuracy: Math.round(fix.accuracy),
      branch: { id: branch.id, name: branch.name, entry_radius: Number(branch.entry_radius), exit_radius: Number(branch.exit_radius) },
      message: insideEntry ? 'أنت داخل نطاق مقر العمل (جاهز لتسجيل الحضور التلقائي)' : `أنت خارج نطاق الفرع (المسافة: ${dist} م)`
    };
  }

  // Case 2: Employee is ON DUTY (automatic exit monitor)
  location.state = currentGpsState === 'inside' ? 'inside' : (dist > Number(branch.exit_radius) ? 'outside' : (location.state || 'inside'));
  const candidate = policy.advanceExit(record.exit_candidate, location, fix, branch, now);

  let automatic = false;
  if (dist >= Number(branch.exit_radius) * 1.5 && fix.accuracy <= maxAcc && candidate?.count >= 1) {
    automatic = true;
  } else {
    automatic = candidate.exit;
  }

  if (automatic) {
    return {
      action: 'exit',
      automatic: true,
      message: 'تم تسجيل خروجك التلقائي بنجاح لمغادرتك نطاق الفرع',
      distance: dist,
      state: 'outside'
    };
  }

  const remainingSec = candidate?.since ? Math.max(0, Math.ceil((Number(branch.exit_delay_seconds) * 1000 - (now - Date.parse(candidate.since))) / 1000)) : 0;
  return {
    action: 'location',
    state: location.state,
    distance: dist,
    pending_exit: candidate?.count || 0,
    required_samples: Number(branch.exit_samples || 2),
    remaining_seconds: remainingSec
  };
}

const sampleBranch = {
  id: 1,
  name: 'AI-ASAAS',
  latitude: 15.277341,
  longitude: 44.226912,
  entry_radius: 80,
  exit_radius: 120,
  max_accuracy: 100,
  exit_samples: 2,
  exit_delay_seconds: 30,
  location_revision: 1,
  active: true
};

test('Geofence Scanner: Off-duty employee inside entry radius gets inside_geofence=true', () => {
  const fixInside = {
    latitude: 15.277341 + 0.0001, // ~11m
    longitude: 44.226912,
    accuracy: 20,
    captured_at: new Date().toISOString()
  };

  const res = evaluateGeofenceMonitor({ record: null, fix: fixInside, branch: sampleBranch });
  assert.equal(res.action, 'location');
  assert.equal(res.inside_geofence, true);
  assert.equal(res.state, 'inside');
  assert.ok(res.distance <= 80);
});

test('Geofence Scanner: Off-duty employee outside gets inside_geofence=false without 409 error', () => {
  const fixOutside = {
    latitude: 15.277341 + 0.003, // ~330m
    longitude: 44.226912,
    accuracy: 35,
    captured_at: new Date().toISOString()
  };

  const res = evaluateGeofenceMonitor({ record: null, fix: fixOutside, branch: sampleBranch });
  assert.equal(res.action, 'location');
  assert.equal(res.inside_geofence, false);
  assert.equal(res.state, 'outside');
  assert.ok(res.distance > 80);
});

test('Geofence Monitor: On-duty employee stepping outside starts pending_exit countdown', () => {
  const now = new Date();
  const fixOutside = {
    latitude: 15.277341 + 0.0013, // ~144m > exit_radius(120m)
    longitude: 44.226912,
    accuracy: 25,
    captured_at: now.toISOString()
  };

  const dutyRecord = {
    id: 99,
    state: 'inside',
    exit_candidate: null
  };

  const res = evaluateGeofenceMonitor({ record: dutyRecord, fix: fixOutside, branch: sampleBranch, now });
  assert.equal(res.action, 'location');
  assert.equal(res.pending_exit, 1);
  assert.equal(res.required_samples, 2);
  assert.ok(res.remaining_seconds > 0);
});

test('Geofence Monitor: On-duty employee clearly far (>1.5x exit radius) triggers accelerated auto-exit', () => {
  const now = new Date();
  const fixFar = {
    latitude: 15.277341 + 0.003, // ~330m >> 1.5 * 120m (180m)
    longitude: 44.226912,
    accuracy: 30,
    captured_at: now.toISOString()
  };

  const dutyRecord = {
    id: 99,
    state: 'inside',
    exit_candidate: null
  };

  const res = evaluateGeofenceMonitor({ record: dutyRecord, fix: fixFar, branch: sampleBranch, now });
  assert.equal(res.action, 'exit');
  assert.equal(res.automatic, true);
  assert.equal(res.state, 'outside');
});
