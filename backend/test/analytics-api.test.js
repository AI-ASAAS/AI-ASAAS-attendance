'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

function calculateDailyAnalytics({ totalEmployees, records, date }) {
  const attendedEmpIds = new Set(records.map(r => r.employee_id));
  const presentCount = attendedEmpIds.size;
  const totalCount = totalEmployees.length;
  const absentCount = Math.max(0, totalCount - presentCount);
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const onDutyCount = records.filter(r => r.state === 'inside').length;
  const lateRecords = records.filter(r => (r.late_minutes || 0) > 0);
  const lateCount = lateRecords.length;
  const totalLateMinutes = lateRecords.reduce((sum, r) => sum + (r.late_minutes || 0), 0);

  const countedRecords = records.filter(r => r.counted_minutes != null);
  const totalCountedMinutes = countedRecords.reduce((sum, r) => sum + r.counted_minutes, 0);
  const totalCountedHours = Number((totalCountedMinutes / 60).toFixed(1));
  const avgWorkingHours = presentCount > 0 ? Number((totalCountedMinutes / 60 / presentCount).toFixed(1)) : 0;

  const absentEmployees = totalEmployees.filter(e => !attendedEmpIds.has(e.id));

  return {
    mode: 'daily',
    date,
    total_employees: totalCount,
    present_count: presentCount,
    absent_count: absentCount,
    attendance_rate: attendanceRate,
    on_duty_count: onDutyCount,
    late_count: lateCount,
    total_late_minutes: totalLateMinutes,
    total_counted_hours: totalCountedHours,
    avg_working_hours: avgWorkingHours,
    absent_employees: absentEmployees
  };
}

function calculateMonthlyAnalytics({ totalEmployees, records, targetMonth, daysInMonth }) {
  const lateRecords = records.filter(r => (r.late_minutes || 0) > 0);
  const totalLateMinutes = lateRecords.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
  const countedRecords = records.filter(r => r.counted_minutes != null);
  const totalCountedMinutes = countedRecords.reduce((sum, r) => sum + r.counted_minutes, 0);
  const totalCountedHours = Number((totalCountedMinutes / 60).toFixed(1));

  const empMap = {};
  for (const e of totalEmployees) {
    empMap[e.id] = { id: e.id, name: e.name, attended_days: 0, total_minutes: 0, late_minutes: 0, distinct_dates: new Set() };
  }
  for (const r of records) {
    if (empMap[r.employee_id]) {
      empMap[r.employee_id].distinct_dates.add(r.work_date);
      if (r.counted_minutes) empMap[r.employee_id].total_minutes += r.counted_minutes;
      if (r.late_minutes > 0) empMap[r.employee_id].late_minutes += r.late_minutes;
    }
  }

  const workDaysCount = 22;
  const employeeBreakdown = Object.values(empMap).map(e => ({
    id: e.id,
    name: e.name,
    attended_days: e.distinct_dates.size,
    total_hours: Number((e.total_minutes / 60).toFixed(1)),
    late_minutes: e.late_minutes,
    commitment_rate: Math.min(100, Math.round((e.distinct_dates.size / workDaysCount) * 100))
  })).sort((a, b) => b.attended_days - a.attended_days);

  return {
    mode: 'monthly',
    month: targetMonth,
    days_in_month: daysInMonth,
    total_employees: totalEmployees.length,
    work_days_count: workDaysCount,
    total_records: records.length,
    total_counted_hours: totalCountedHours,
    total_late_minutes: totalLateMinutes,
    employee_breakdown: employeeBreakdown
  };
}

const mockEmployees = [
  { id: 1, name: 'أحمد علي', identifier: 'EMP-001', branch_id: 1 },
  { id: 2, name: 'سارة خالد', identifier: 'EMP-002', branch_id: 1 },
  { id: 3, name: 'محمد صالح', identifier: 'EMP-003', branch_id: 1 },
  { id: 4, name: 'فاطمة عمر', identifier: 'EMP-004', branch_id: 1 }
];

test('Analytics Engine: Daily mode accurately counts present, absent, late, and counted hours', () => {
  const records = [
    { id: 101, employee_id: 1, state: 'outside', first_in: '2026-10-21T08:00:00Z', last_out: '2026-10-21T16:00:00Z', late_minutes: 0, counted_minutes: 480 },
    { id: 102, employee_id: 2, state: 'inside', first_in: '2026-10-21T08:25:00Z', last_out: null, late_minutes: 10, counted_minutes: null },
    { id: 103, employee_id: 3, state: 'outside', first_in: '2026-10-21T08:00:00Z', last_out: '2026-10-21T12:00:00Z', late_minutes: 0, counted_minutes: 240 }
  ];

  const res = calculateDailyAnalytics({ totalEmployees: mockEmployees, records, date: '2026-10-21' });

  assert.equal(res.total_employees, 4);
  assert.equal(res.present_count, 3);
  assert.equal(res.absent_count, 1);
  assert.equal(res.attendance_rate, 75);
  assert.equal(res.on_duty_count, 1);
  assert.equal(res.late_count, 1);
  assert.equal(res.total_late_minutes, 10);
  assert.equal(res.total_counted_hours, 12.0); // (480 + 240) / 60 = 12h
  assert.equal(res.absent_employees.length, 1);
  assert.equal(res.absent_employees[0].id, 4);
});

test('Analytics Engine: Monthly mode computes total hours and employee commitment ranking', () => {
  const records = [
    { id: 201, employee_id: 1, work_date: '2026-10-01', counted_minutes: 480, late_minutes: 0 },
    { id: 202, employee_id: 1, work_date: '2026-10-02', counted_minutes: 480, late_minutes: 0 },
    { id: 203, employee_id: 2, work_date: '2026-10-01', counted_minutes: 450, late_minutes: 15 }
  ];

  const res = calculateMonthlyAnalytics({ totalEmployees: mockEmployees, records, targetMonth: '2026-10', daysInMonth: 31 });

  assert.equal(res.total_records, 3);
  assert.equal(res.total_counted_hours, 23.5); // (480+480+450)/60 = 23.5h
  assert.equal(res.total_late_minutes, 15);
  assert.equal(res.employee_breakdown.length, 4);

  // Employee 1 should be at the top with 2 attended days
  assert.equal(res.employee_breakdown[0].id, 1);
  assert.equal(res.employee_breakdown[0].attended_days, 2);
  assert.equal(res.employee_breakdown[0].total_hours, 16.0);
});
