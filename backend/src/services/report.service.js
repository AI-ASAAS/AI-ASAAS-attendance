'use strict';

const db = require('../config/database');
const policy = require('./attendance-policy');
const { AppError } = require('../utils/AppError');

const error = (code, message, status = 400) => {
  throw new AppError(code, message, status);
};

// Format Date or ISO string to YYYY-MM-DD in Asia/Aden timezone
function formatAdenDate(dateInput) {
  if (!dateInput) return null;
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Aden',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

// Current date YYYY-MM-DD in Asia/Aden
function getTodayAden() {
  return formatAdenDate(new Date());
}

// Current time HH:MM:SS in Asia/Aden (24-hour)
function getNowAdenTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Aden',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
}

// Formats a timestamp into a readable 12-hour time in Aden timezone
function formatTimeAden(dateInput) {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-YE', {
    timeZone: 'Asia/Aden',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

// Formats date into readable Arabic date (e.g. 19 أكتوبر 2026)
function formatDateArabic(dateInput) {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-YE', {
    timeZone: 'Asia/Aden',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
}

// Generates continuous array of all date strings YYYY-MM-DD in [fromDateStr, toDateStr]
function enumerateDates(fromDateStr, toDateStr) {
  const dates = [];
  let cur = new Date(`${fromDateStr}T00:00:00Z`);
  const end = new Date(`${toDateStr}T00:00:00Z`);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// Work minutes calculation strictly between first_in and last_out
function calcWorkMinutes(r) {
  if (!r || !r.first_in || !r.last_out) return 0;
  const inTime = new Date(r.first_in).getTime();
  const outTime = new Date(r.last_out).getTime();
  if (outTime <= inTime) return 0;
  const totalRawMin = Math.floor((outTime - inTime) / 60000);
  const awayMin = (r.deduct_away && r.away_seconds) ? Math.floor(r.away_seconds / 60) : 0;
  return Math.max(0, totalRawMin - awayMin);
}

// Human readable exit reason label
function resolveExitReason(reasonKey) {
  const map = {
    geofence: 'مغادرة نطاق الموقع تلقائياً (GPS)',
    manual: 'انتهاء ساعات الدوام الرسمي في الموعد',
    scheduled: 'انتهاء فترة المناوبة المجدولة تلقائياً',
    admin_correction: 'تصحيح إداري',
    admin: 'تسجيل يدوي من الإدارة'
  };
  return map[reasonKey] || reasonKey || '—';
}

/**
 * Calculates a detailed day-by-day attendance timeline and summary
 * for an employee across any period [from, to].
 */
async function getEmployeeDossier(user, employeeId, from, to) {
  const broad = ['super_admin', 'hr_admin'].includes(user.role);

  const empRes = await db.query(`
    SELECT a.id, a.name, a.identifier, a.branch_id, a.shift_id, COALESCE(a.is_remote, false) AS is_remote,
           COALESCE(b.name, 'الفرع الرئيسي') AS branch_name,
           COALESCE(s.name, 'الدوام الافتراضي') AS shift_name,
           s.start_time, s.end_time, s.work_days, s.grace_minutes, s.deduct_away
    FROM accounts a
    LEFT JOIN branches b ON b.id = a.branch_id
    LEFT JOIN shifts s ON s.id = a.shift_id
    WHERE a.id = $1 AND a.active = TRUE AND ($2::boolean OR a.branch_id = $3)
  `, [employeeId, broad, user.branch_id]);

  if (!empRes.rows.length) {
    error('NOT_FOUND', 'الموظف غير موجود أو ليس لديك صلاحية الاطلاع عليه', 404);
  }

  const emp = empRes.rows[0];

  const recordsRes = await db.query(`
    SELECT r.*,
           (r.shift_start AT TIME ZONE 'Asia/Aden')::date as local_date
    FROM duty_records r
    WHERE r.employee_id = $1
      AND (r.shift_start AT TIME ZONE 'Asia/Aden')::date BETWEEN $2::date AND $3::date
    ORDER BY r.shift_start ASC, r.id ASC
  `, [employeeId, from, to]);

  const leavesRes = await db.query(`
    SELECT * FROM leave_requests
    WHERE employee_id = $1 AND status = 'approved'
      AND from_date <= $3::date AND to_date >= $2::date
  `, [employeeId, from, to]);

  const todayAden = getTodayAden();
  const nowAdenTime = getNowAdenTime();
  const dateList = enumerateDates(from, to);

  const recordsByDate = new Map();
  for (const r of recordsRes.rows) {
    const dStr = formatAdenDate(r.shift_start);
    if (!recordsByDate.has(dStr)) recordsByDate.set(dStr, []);
    recordsByDate.get(dStr).push(r);
  }

  const days = [];
  let presentDays = 0;
  let absentDays = 0;
  let lateDaysCount = 0;
  let totalLateMinutes = 0;
  let totalWorkMinutes = 0;
  let leaveDays = 0;
  let weekendDays = 0;
  let incompleteRecordsCount = 0;
  let pendingTodayCount = 0;

  const workDays = emp.work_days || [0, 1, 2, 3, 4, 6];

  for (const dateStr of dateList) {
    const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
    const isWorkday = workDays.includes(dow);
    const dayRecords = recordsByDate.get(dateStr) || [];
    const isApprovedLeave = leavesRes.rows.some(l => {
      const fromD = formatAdenDate(l.from_date);
      const toD = formatAdenDate(l.to_date);
      return dateStr >= fromD && dateStr <= toD;
    });

    const dayObj = {
      date: dateStr,
      date_formatted: formatDateArabic(dateStr),
      day_name: ARABIC_DAYS[dow],
      day_of_week: dow,
      is_workday: isWorkday,
      has_record: dayRecords.length > 0,
      records: dayRecords
    };

    if (dayRecords.length > 0) {
      // Pick the primary duty record of the day
      const rec = dayRecords[dayRecords.length - 1];
      const hasIn = Boolean(rec.first_in);
      const hasOut = Boolean(rec.last_out);
      const lateMin = Number(rec.late_minutes || 0);
      const workMin = calcWorkMinutes(rec);

      presentDays++;
      totalWorkMinutes += workMin;

      if (lateMin > 0) {
        lateDaysCount++;
        totalLateMinutes += lateMin;
      }

      let state = 'present';
      let status_label = 'حاضر في الموعد';
      let needs_review = false;

      if (lateMin > 0) {
        state = 'late';
        status_label = `حاضر متأخر (${lateMin} دقيقة)`;
      }

      if (hasIn && !hasOut) {
        if (dateStr === todayAden && rec.state === 'inside') {
          state = 'inside';
          status_label = 'حاضر الآن (على رأس العمل)';
        } else {
          state = 'incomplete';
          status_label = 'سجل ناقص (بدون تسجيل انصراف)';
          needs_review = true;
          incompleteRecordsCount++;
        }
      } else if (!hasIn && hasOut) {
        state = 'incomplete';
        status_label = 'سجل ناقص (بدون تسجيل حضور)';
        needs_review = true;
        incompleteRecordsCount++;
      } else if (rec.state === 'closed' || rec.state === 'outside') {
        if (lateMin > 0) {
          state = 'late';
          status_label = `تم الانصراف (تأخر ${lateMin} د)`;
        } else {
          state = 'outside';
          status_label = 'تم الانصراف في الموعد';
        }
      }

      dayObj.state = state;
      dayObj.status_label = status_label;
      dayObj.first_in = rec.first_in;
      dayObj.first_in_time = formatTimeAden(rec.first_in);
      dayObj.last_out = rec.last_out;
      dayObj.last_out_time = formatTimeAden(rec.last_out);
      dayObj.late_minutes = lateMin;
      dayObj.work_minutes = workMin;
      dayObj.work_hours = (workMin / 60).toFixed(1);
      dayObj.exit_reason = rec.exit_reason;
      dayObj.exit_reason_label = resolveExitReason(rec.exit_reason);
      dayObj.record_id = rec.id;
      dayObj.needs_review = needs_review;

    } else if (isApprovedLeave) {
      leaveDays++;
      dayObj.state = 'leave';
      dayObj.status_label = 'إجازة معتمدة';
      dayObj.first_in = null;
      dayObj.first_in_time = '—';
      dayObj.last_out = null;
      dayObj.last_out_time = '—';
      dayObj.late_minutes = 0;
      dayObj.work_minutes = 0;
      dayObj.work_hours = '0.0';
      dayObj.exit_reason = 'leave';
      dayObj.exit_reason_label = 'إجازة رسمية معتمدة';
      dayObj.needs_review = false;

    } else if (!isWorkday) {
      weekendDays++;
      dayObj.state = 'weekend';
      dayObj.status_label = 'عطلة أسبوعية';
      dayObj.first_in = null;
      dayObj.first_in_time = '—';
      dayObj.last_out = null;
      dayObj.last_out_time = '—';
      dayObj.late_minutes = 0;
      dayObj.work_minutes = 0;
      dayObj.work_hours = '0.0';
      dayObj.exit_reason = 'weekend';
      dayObj.exit_reason_label = 'يوم راحة أسبوعية';
      dayObj.needs_review = false;

    } else {
      // Workday without duty record
      dayObj.first_in = null;
      dayObj.first_in_time = 'لم يحضر';
      dayObj.last_out = null;
      dayObj.last_out_time = '—';
      dayObj.late_minutes = 0;
      dayObj.work_minutes = 0;
      dayObj.work_hours = '0.0';
      dayObj.exit_reason = 'absent';
      dayObj.exit_reason_label = 'غياب غير مسجل';

      if (dateStr < todayAden) {
        absentDays++;
        dayObj.state = 'absent';
        dayObj.status_label = 'غائب (لم يحضر)';
        dayObj.needs_review = false;
      } else if (dateStr === todayAden) {
        const endTime = emp.end_time ? String(emp.end_time).slice(0, 8) : '22:00:00';
        if (nowAdenTime > endTime) {
          absentDays++;
          dayObj.state = 'absent';
          dayObj.status_label = 'غائب (انتهى وقت الدوام ولم يسجل)';
          dayObj.needs_review = false;
        } else {
          pendingTodayCount++;
          dayObj.state = 'pending';
          dayObj.status_label = 'دوام جارٍ (لم يسجل بعد)';
          dayObj.needs_review = false;
        }
      } else {
        dayObj.state = 'scheduled';
        dayObj.status_label = 'دوام قادم';
        dayObj.needs_review = false;
      }
    }

    days.push(dayObj);
  }

  const totalDays = dateList.length;
  const scheduledWorkDays = days.filter(d => d.is_workday).length;

  const totalCalculatedWorkdays = presentDays + absentDays + pendingTodayCount;
  const attendanceRate = totalCalculatedWorkdays > 0
    ? Math.round((presentDays / totalCalculatedWorkdays) * 100)
    : 0;

  return {
    employee: {
      id: emp.id,
      name: emp.name,
      identifier: emp.identifier,
      branch_id: emp.branch_id,
      branch_name: emp.branch_name,
      shift_id: emp.shift_id,
      shift_name: emp.shift_name,
      is_remote: Boolean(emp.is_remote),
      shift_start_time: emp.start_time,
      shift_end_time: emp.end_time,
      start_time: emp.start_time,
      end_time: emp.end_time,
      grace_minutes: emp.grace_minutes || 10,
      is_remote: Boolean(emp.is_remote)
    },
    period: {
      from,
      to,
      total_days: totalDays,
      total_calendar_days: totalDays,
      work_days: scheduledWorkDays
    },
    summary: {
      total_days: totalDays,
      work_days: scheduledWorkDays,
      present_days: presentDays,
      absent_days: absentDays,
      late_days_count: lateDaysCount,
      total_late_minutes: totalLateMinutes,
      total_work_minutes: totalWorkMinutes,
      total_work_hours: (totalWorkMinutes / 60).toFixed(1),
      leave_days: leaveDays,
      weekend_days: weekendDays,
      incomplete_records_count: incompleteRecordsCount,
      pending_today_count: pendingTodayCount,
      attendance_rate: attendanceRate
    },
    days,
    timeline: days
  };
}

/**
 * Calculates collective attendance statistics and summaries for all employees
 * across any period [from, to].
 */
async function getCollectiveReport(user, from, to, branchId = null, search = '') {
  const broad = ['super_admin', 'hr_admin'].includes(user.role);
  const effectiveBranch = broad ? (branchId ? Number(branchId) : null) : user.branch_id;

  let query = `
    SELECT a.id, a.name, a.identifier, a.branch_id, a.shift_id, COALESCE(a.is_remote, false) AS is_remote,
           COALESCE(b.name, 'الفرع الرئيسي') AS branch_name,
           COALESCE(s.name, 'الدوام الافتراضي') AS shift_name,
           s.start_time, s.end_time, s.work_days, s.grace_minutes, s.deduct_away
    FROM accounts a
    LEFT JOIN branches b ON b.id = a.branch_id
    LEFT JOIN shifts s ON s.id = a.shift_id
    WHERE a.active = TRUE AND a.role = 'employee'
  `;
  const params = [];
  if (effectiveBranch) {
    params.push(effectiveBranch);
    query += ` AND a.branch_id = $${params.length}`;
  }
  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    query += ` AND (LOWER(a.name) LIKE $${params.length} OR LOWER(a.identifier) LIKE $${params.length})`;
  }
  query += ` ORDER BY a.name ASC`;

  const accountsRes = await db.query(query, params);
  const employees = accountsRes.rows;

  if (!employees.length) {
    return {
      period: { from, to, total_days: enumerateDates(from, to).length },
      overall: {
        total_employees: 0,
        total_present_days: 0,
        total_absent_days: 0,
        total_late_days: 0,
        total_late_minutes: 0,
        total_work_minutes: 0,
        total_work_hours: '0.0',
        total_leave_days: 0,
        total_incomplete_records: 0,
        average_attendance_rate: 0
      },
      employees: []
    };
  }

  // Pre-fetch all duty records in date range
  let recordsQuery = `
    SELECT r.*
    FROM duty_records r
    JOIN accounts a ON a.id = r.employee_id
    WHERE a.active = TRUE
      AND (r.shift_start AT TIME ZONE 'Asia/Aden')::date BETWEEN $1::date AND $2::date
  `;
  const rParams = [from, to];
  if (effectiveBranch) {
    rParams.push(effectiveBranch);
    recordsQuery += ` AND r.branch_id = $${rParams.length}`;
  }
  const allRecords = (await db.query(recordsQuery, rParams)).rows;

  // Pre-fetch all approved leaves in date range
  let leavesQuery = `
    SELECT l.*
    FROM leave_requests l
    JOIN accounts a ON a.id = l.employee_id
    WHERE a.active = TRUE AND l.status = 'approved'
      AND l.from_date <= $2::date AND l.to_date >= $1::date
  `;
  const lParams = [from, to];
  if (effectiveBranch) {
    lParams.push(effectiveBranch);
    leavesQuery += ` AND a.branch_id = $${lParams.length}`;
  }
  const allLeaves = (await db.query(leavesQuery, lParams)).rows;

  // Group by employee_id and date
  const recordsMap = new Map();
  for (const r of allRecords) {
    if (!recordsMap.has(r.employee_id)) recordsMap.set(r.employee_id, new Map());
    const empMap = recordsMap.get(r.employee_id);
    const dStr = formatAdenDate(r.shift_start);
    if (!empMap.has(dStr)) empMap.set(dStr, []);
    empMap.get(dStr).push(r);
  }

  const leavesMap = new Map();
  for (const l of allLeaves) {
    if (!leavesMap.has(l.employee_id)) leavesMap.set(l.employee_id, []);
    leavesMap.get(l.employee_id).push(l);
  }

  const dateList = enumerateDates(from, to);
  const todayAden = getTodayAden();
  const nowAdenTime = getNowAdenTime();

  let overallPresent = 0;
  let overallAbsent = 0;
  let overallLateCount = 0;
  let overallLateMinutes = 0;
  let overallWorkMinutes = 0;
  let overallLeaveDays = 0;
  let overallIncomplete = 0;
  let overallPending = 0;

  const employeeSummaries = [];

  for (const emp of employees) {
    const empRecordsMap = recordsMap.get(emp.id) || new Map();
    const empLeaves = leavesMap.get(emp.id) || [];
    const workDays = emp.work_days || [0, 1, 2, 3, 4, 6];

    let presentDays = 0;
    let absentDays = 0;
    let lateDaysCount = 0;
    let totalLateMinutes = 0;
    let totalWorkMinutes = 0;
    let leaveDays = 0;
    let weekendDays = 0;
    let incompleteRecordsCount = 0;
    let pendingTodayCount = 0;

    for (const dateStr of dateList) {
      const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
      const isWorkday = workDays.includes(dow);
      const dayRecords = empRecordsMap.get(dateStr) || [];
      const isApprovedLeave = empLeaves.some(l => {
        const fromD = formatAdenDate(l.from_date);
        const toD = formatAdenDate(l.to_date);
        return dateStr >= fromD && dateStr <= toD;
      });

      if (dayRecords.length > 0) {
        const rec = dayRecords[dayRecords.length - 1];
        const hasIn = Boolean(rec.first_in);
        const hasOut = Boolean(rec.last_out);
        const lateMin = Number(rec.late_minutes || 0);
        const workMin = calcWorkMinutes(rec);

        presentDays++;
        totalWorkMinutes += workMin;

        if (lateMin > 0) {
          lateDaysCount++;
          totalLateMinutes += lateMin;
        }

        if (hasIn && !hasOut) {
          if (dateStr !== todayAden || rec.state !== 'inside') {
            incompleteRecordsCount++;
          }
        } else if (!hasIn && hasOut) {
          incompleteRecordsCount++;
        }
      } else if (isApprovedLeave) {
        leaveDays++;
      } else if (!isWorkday) {
        weekendDays++;
      } else {
        if (dateStr < todayAden) {
          absentDays++;
        } else if (dateStr === todayAden) {
          const endTime = emp.end_time ? String(emp.end_time).slice(0, 8) : '22:00:00';
          if (nowAdenTime > endTime) {
            absentDays++;
          } else {
            pendingTodayCount++;
          }
        }
      }
    }

    const calculatedWorkdays = presentDays + absentDays + pendingTodayCount;
    const rate = calculatedWorkdays > 0 
      ? Math.round((presentDays / calculatedWorkdays) * 100) 
      : 0;

    overallPresent += presentDays;
    overallAbsent += absentDays;
    overallPending += pendingTodayCount;
    overallLateCount += lateDaysCount;
    overallLateMinutes += totalLateMinutes;
    overallWorkMinutes += totalWorkMinutes;
    overallLeaveDays += leaveDays;
    overallIncomplete += incompleteRecordsCount;

    employeeSummaries.push({
      id: emp.id,
      name: emp.name,
      identifier: emp.identifier,
      branch_id: emp.branch_id,
      branch_name: emp.branch_name,
      shift_id: emp.shift_id,
      shift_name: emp.shift_name,
      is_remote: Boolean(emp.is_remote),
      present_days: presentDays,
      absent_days: absentDays,
      late_days_count: lateDaysCount,
      total_late_minutes: totalLateMinutes,
      total_work_minutes: totalWorkMinutes,
      total_work_hours: (totalWorkMinutes / 60).toFixed(1),
      leave_days: leaveDays,
      weekend_days: weekendDays,
      incomplete_records_count: incompleteRecordsCount,
      pending_today_count: pendingTodayCount,
      attendance_rate: rate
    });
  }

  const totalPossible = overallPresent + overallAbsent + overallPending;
  const avgAttendanceRate = totalPossible > 0
    ? Math.round((overallPresent / totalPossible) * 100)
    : 0;

  return {
    period: {
      from,
      to,
      total_days: dateList.length
    },
    overall: {
      total_employees: employees.length,
      total_present_days: overallPresent,
      total_absent_days: overallAbsent + overallPending,
      total_pending_today: overallPending,
      total_late_days: overallLateCount,
      total_late_minutes: overallLateMinutes,
      total_work_minutes: overallWorkMinutes,
      total_work_hours: (overallWorkMinutes / 60).toFixed(1),
      total_leave_days: overallLeaveDays,
      total_incomplete_records: overallIncomplete,
      average_attendance_rate: avgAttendanceRate
    },
    employees: employeeSummaries
  };
}

module.exports = {
  formatAdenDate,
  getTodayAden,
  getNowAdenTime,
  formatTimeAden,
  formatDateArabic,
  enumerateDates,
  getEmployeeDossier,
  getCollectiveReport
};
