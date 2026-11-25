const db = require('../config/database');
const policy = require('./attendance-policy');
const { logger } = require('../utils/logger');

async function closeScheduled() {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayAden = policy.localDay(now);
  const fourHoursAgoIso = new Date(now.getTime() - 4 * 3600000).toISOString();

  return db.transaction(async client => {
    // 1. Close scheduled shifts where shift_end has arrived
    const scheduled = await client.query(`
      SELECT * FROM duty_records
      WHERE state <> 'closed'
        AND close_policy = 'scheduled'
        AND shift_end <= $1
    `, [nowIso]);
    for (const record of scheduled.rows) {
      await client.query(`
        UPDATE duty_records
        SET state = 'closed',
            last_out = CASE WHEN state = 'inside' THEN shift_end ELSE last_out END,
            exit_reason = CASE WHEN state = 'inside' THEN 'scheduled' ELSE exit_reason END,
            exit_candidate = NULL
        WHERE id = $1
      `, [record.id]);
      await client.query(`
        INSERT INTO attendance_events(record_id, employee_id, kind, details)
        VALUES($1, $2, 'scheduled_close', $3)
      `, [record.id, record.employee_id, JSON.stringify({ effective_at: record.shift_end })]);
    }

    // 2. Auto-close any unclosed shifts from previous days or ended > 4 hours ago
    const expired = await client.query(`
      SELECT * FROM duty_records
      WHERE state = 'inside'
        AND (
          date(shift_start, '+3 hours') < $1
          OR (shift_end IS NOT NULL AND shift_end <= $2)
        )
    `, [todayAden, fourHoursAgoIso]);
    for (const record of expired.rows) {
      const fallbackOut = record.last_seen || record.shift_end || record.first_in;
      await client.query(`
        UPDATE duty_records
        SET state = 'closed',
            last_out = COALESCE(last_out, $1),
            exit_reason = COALESCE(exit_reason, 'نهاية وقت الدوام (إغلاق تلقائي)'),
            exit_candidate = NULL
        WHERE id = $2
      `, [fallbackOut, record.id]);
      await client.query(`
        INSERT INTO attendance_events(record_id, employee_id, kind, details)
        VALUES($1, $2, 'overdue_day_close', $3)
      `, [record.id, record.employee_id, JSON.stringify({ closed_at: nowIso })]);
    }
  });
}

async function checkDutyReminders() {
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    const settingsRows = (await db.query("SELECT key, value FROM system_settings WHERE key IN ('duty_reminder_enabled', 'duty_reminder_interval_hours', 'absent_reminder_enabled', 'absent_reminder_delay_minutes', 'email_notifications')")).rows;
    const settings = {};
    for (const s of settingsRows) settings[s.key] = s.value;

    if (settings.duty_reminder_enabled === 'false' && settings.absent_reminder_enabled === 'false') return;

    const intervalHours = Math.max(1, Math.min(12, Number(settings.duty_reminder_interval_hours || 2)));
    const intervalMs = intervalHours * 3600 * 1000;

    if (settings.duty_reminder_enabled !== 'false') {
      const activeRecords = (await db.query(`
        SELECT r.id, r.employee_id, r.shift_start, r.first_in, r.branch_id,
               a.name, a.email, a.identifier, b.name as branch_name
        FROM duty_records r
        JOIN accounts a ON a.id = r.employee_id
        LEFT JOIN branches b ON b.id = r.branch_id
        WHERE r.state = 'inside'
      `)).rows;

      for (const record of activeRecords) {
        if (!record.first_in) continue;
        const firstInTime = new Date(record.first_in).getTime();
        const elapsed = now.getTime() - firstInTime;
        if (elapsed < intervalMs) continue;

        const intervalsCount = Math.floor(elapsed / intervalMs);
        const hoursOnDuty = intervalsCount * intervalHours;

        // Check if reminder for this interval was already logged
        const existing = (await db.query(`
          SELECT id FROM attendance_events
          WHERE record_id = $1 AND kind = 'duty_reminder'
            AND details LIKE '%"interval_number":' || $2 || '%'
        `, [record.id, intervalsCount])).rows;

        if (!existing.length) {
          await db.query(`
            INSERT INTO attendance_events(record_id, employee_id, kind, details)
            VALUES($1, $2, 'duty_reminder', $3)
          `, [record.id, record.employee_id, JSON.stringify({
            interval_number: intervalsCount,
            hours_on_duty: hoursOnDuty,
            interval_hours: intervalHours,
            notified_at: nowIso
          })]);

          if (settings.email_notifications === 'true' && record.email) {
            const notifications = require('./notification.service');
            notifications.notifyDutyReminder(
              { name: record.name, email: record.email, identifier: record.identifier },
              record.branch_name,
              hoursOnDuty
            ).catch(err => console.error('[Notification Error] Duty reminder email failed:', err.message));
          }

          try {
            const webpushService = require('./webpush.service');
            const msg = `مرحباً ${record.name}، مضت ${hoursOnDuty} ساعات على تواجدك في الدوام اليوم في ${record.branch_name || 'مقر العمل'}. يرجى تأكيد استمرار حضورك لتوثيق ساعات عملك بنزاهة ودقة.`;
            webpushService.sendPushToAccount(db, record.employee_id, {
              title: 'تذكير الدوام الدوري · أساس',
              body: `مضت ${hoursOnDuty} ساعات على بدء دوامك اليوم. اضغط لتأكيد استمرار الحضور.`,
              fullBody: msg,
              type: 'duty_reminder',
              priority: 'normal',
              senderName: 'نظام أساس التلقائي',
              createdAt: nowIso,
              tag: `duty-reminder-auto-${record.id}-${intervalsCount}`,
              url: '/asas?open_reminder=1'
            }).catch(err => console.warn('[WebPush Auto Duty Error]:', err.message));
          } catch (_) {}
        }
      }
    }

    // 2. Automated Attendance Inquiry for Absent Employees (هل ستداوم اليوم؟)
    if (settings.absent_reminder_enabled !== 'false') {
      const delayMinutes = Math.max(10, Math.min(180, Number(settings.absent_reminder_delay_minutes || 30)));
      const todayAden = policy.localDay(now);

      const absentEmployees = (await db.query(`
        SELECT a.id as employee_id, a.name, a.email, a.identifier, b.name as branch_name,
               s.start_time, s.grace_minutes
        FROM accounts a
        LEFT JOIN branches b ON b.id = a.branch_id
        LEFT JOIN shifts s ON s.id = a.shift_id
        WHERE a.role = 'employee' AND a.active = TRUE
          AND a.id NOT IN (
            SELECT employee_id FROM duty_records WHERE state = 'inside' AND date(shift_start, '+3 hours') = $1
          )
          AND a.id NOT IN (
            SELECT employee_id FROM leave_requests WHERE status = 'approved' AND $1 BETWEEN from_date AND to_date
          )
      `, [todayAden])).rows;

      for (const emp of absentEmployees) {
        const startTimeStr = emp.start_time || '08:00';
        const [sh, sm] = startTimeStr.split(':').map(Number);
        const shiftStartToday = new Date(now);
        const utcHour = (sh - 3 + 24) % 24;
        shiftStartToday.setUTCHours(utcHour, sm, 0, 0);

        const diffMinutes = Math.floor((now.getTime() - shiftStartToday.getTime()) / 60000);
        if (diffMinutes >= delayMinutes && diffMinutes <= 360) {
          const alreadyReminded = (await db.query(`
            SELECT id FROM attendance_events
            WHERE employee_id = $1 AND kind = 'duty_reminder'
              AND date(captured_at, '+3 hours') = $2
              AND details LIKE '%"target":"absent"%'
          `, [emp.employee_id, todayAden])).rows;

          if (!alreadyReminded.length) {
            const questionNote = 'تذكير بمباشرة الدوام: هل ستباشر دوامك اليوم؟ يرجى تحديد حالتك لتنظيم سير العمل.';
            await db.query(`
              INSERT INTO attendance_events(employee_id, kind, captured_at, details)
              VALUES($1, 'duty_reminder', $2, $3)
            `, [emp.employee_id, nowIso, JSON.stringify({
              source: 'auto_absent_inquiry',
              target: 'absent',
              inquiry: true,
              question: 'هل ستداوم اليوم؟',
              custom_note: questionNote,
              triggered_at: nowIso
            })]);

            try {
              const webpushService = require('./webpush.service');
              webpushService.sendPushToAccount(db, emp.employee_id, {
                title: 'تأكيد الحضور — هل ستداوم اليوم؟ ⏰',
                body: questionNote,
                fullBody: questionNote,
                type: 'attendance_inquiry',
                priority: 'normal',
                senderName: 'الموارد البشرية',
                createdAt: nowIso,
                tag: 'absent-inquiry-' + todayAden,
                url: '/asas?open_reminder=1'
              }).catch(err => console.warn('[Push Error] Absent inquiry push failed:', err.message));
            } catch (_) {}

            if (settings.email_notifications === 'true' && emp.email) {
              const notifications = require('./notification.service');
              notifications.notifyDutyReminder(
                { name: emp.name, email: emp.email, identifier: emp.identifier },
                emp.branch_name || 'الفرع الرئيسي',
                0,
                questionNote
              ).catch(err => console.error('[Email Error] Absent inquiry email failed:', err.message));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Duty Reminders Check Failed]:', err.message);
  }
}

module.exports = { closeScheduled, checkDutyReminders };
