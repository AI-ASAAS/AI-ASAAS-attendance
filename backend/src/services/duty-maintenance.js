const db = require('../config/database');
const policy = require('./attendance-policy');

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
    const settingsRows = (await db.query("SELECT key, value FROM system_settings WHERE key IN ('duty_reminder_enabled', 'duty_reminder_interval_hours', 'email_notifications')")).rows;
    const settings = {};
    for (const s of settingsRows) settings[s.key] = s.value;

    if (settings.duty_reminder_enabled === 'false') return;

    const intervalHours = Math.max(1, Math.min(12, Number(settings.duty_reminder_interval_hours || 2)));
    const intervalMs = intervalHours * 3600 * 1000;

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
      }
    }
  } catch (err) {
    console.error('[Duty Reminders Check Failed]:', err.message);
  }
}

module.exports = { closeScheduled, checkDutyReminders };
