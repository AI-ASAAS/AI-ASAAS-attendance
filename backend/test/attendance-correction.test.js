const { test } = require('node:test');
const assert = require('node:assert/strict');

function countedMinutes(r) {
  if (r.state === 'inside' || !r.last_out) return null;
  return Math.max(0, Math.floor((new Date(r.last_out) - new Date(r.first_in)) / 60000) - (r.deduct_away ? Math.floor(r.away_seconds / 60) : 0));
}

function validateRecordCorrection(b, old) {
  const reason = b.reason?.trim();
  if (!reason || reason.length > 500) throw new Error('سبب التعديل مطلوب');
  const firstIn = b.first_in === undefined ? old.first_in : (b.first_in ? new Date(b.first_in) : null);
  const lastOut = b.last_out === undefined ? old.last_out : (b.last_out ? new Date(b.last_out) : null);
  if (!firstIn || isNaN(firstIn.getTime())) throw new Error('وقت الدخول غير صالح');
  if (lastOut && isNaN(lastOut.getTime())) throw new Error('وقت الخروج غير صالح');
  if (lastOut && lastOut < firstIn) throw new Error('وقت الخروج يجب أن يكون بعد وقت الدخول');
  const state = b.state === undefined ? old.state : b.state;
  if (!['inside', 'outside', 'closed'].includes(state)) throw new Error('حالة الحضور غير صالحة');
  return { firstIn, lastOut, state, reason };
}

test('countedMinutes accurately calculates working minutes with and without away deduction', () => {
  const recordOpen = { state: 'inside', first_in: '2026-10-18T08:00:00Z', last_out: null, deduct_away: false, away_seconds: 0 };
  assert.equal(countedMinutes(recordOpen), null);

  const recordClosedNoDeduct = {
    state: 'closed',
    first_in: '2026-10-18T08:00:00Z',
    last_out: '2026-10-18T16:00:00Z',
    deduct_away: false,
    away_seconds: 3600
  };
  assert.equal(countedMinutes(recordClosedNoDeduct), 480); // 8 hours = 480 min

  const recordClosedWithDeduct = {
    state: 'closed',
    first_in: '2026-10-18T08:00:00Z',
    last_out: '2026-10-18T16:00:00Z',
    deduct_away: true,
    away_seconds: 3600 // 1 hour away
  };
  assert.equal(countedMinutes(recordClosedWithDeduct), 420); // 480 - 60 = 420 min
});

test('administrative attendance correction validates constraints and requires reason', () => {
  const old = {
    id: 1,
    employee_id: 10,
    branch_id: 1,
    first_in: new Date('2026-10-18T08:00:00Z'),
    last_out: new Date('2026-10-18T16:00:00Z'),
    state: 'closed'
  };

  // Valid correction
  const valid = validateRecordCorrection({
    first_in: '2026-10-18T08:15:00Z',
    last_out: '2026-10-18T16:15:00Z',
    reason: 'تصحيح بسبب عطل في شبكة الفرع'
  }, old);
  assert.equal(valid.state, 'closed');
  assert.equal(valid.reason, 'تصحيح بسبب عطل في شبكة الفرع');

  // Missing reason rejected
  assert.throws(() => validateRecordCorrection({ reason: '' }, old), /سبب التعديل مطلوب/);

  // Exit before enter rejected
  assert.throws(() => validateRecordCorrection({
    first_in: '2026-10-18T10:00:00Z',
    last_out: '2026-10-18T09:00:00Z',
    reason: 'خطأ زمني'
  }, old), /وقت الخروج يجب أن يكون بعد وقت الدخول/);

  // Invalid state rejected
  assert.throws(() => validateRecordCorrection({
    state: 'unknown_state',
    reason: 'تعديل حالة'
  }, old), /حالة الحضور غير صالحة/);
});
