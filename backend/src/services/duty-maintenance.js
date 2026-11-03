const db = require('../config/database');

async function closeScheduled() {
  return db.transaction(async client => {
    // 1. Close scheduled shifts where shift_end has arrived
    const scheduled = await client.query(`
      SELECT * FROM duty_records 
      WHERE state <> 'closed' 
        AND close_policy = 'scheduled' 
        AND shift_end <= NOW() 
      FOR UPDATE SKIP LOCKED
    `);
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
          (shift_start AT TIME ZONE 'Asia/Aden')::date < (NOW() AT TIME ZONE 'Asia/Aden')::date
          OR (shift_end IS NOT NULL AND shift_end + INTERVAL '4 hours' <= NOW())
        )
      FOR UPDATE SKIP LOCKED
    `);
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
      `, [record.id, record.employee_id, JSON.stringify({ closed_at: new Date().toISOString() })]);
    }
  });
}

module.exports = { closeScheduled };
