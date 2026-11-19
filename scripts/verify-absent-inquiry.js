const security = require('../backend/src/services/session-security.js');
const db = require('../backend/src/config/database.js');
const http = require('http');

(async () => {
  console.log('=== STARTING ABSENT INQUIRY VERIFICATION ===');
  const token = security.newToken();
  const tokenHash = security.digest(token);
  await db.query(
    "INSERT INTO auth_sessions(token_hash, account_id, expires_at) VALUES($1, $2, strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 days'))",
    [tokenHash, 1]
  );

  function apiCall(method, path, data, authToken = token) {
    return new Promise((resolve, reject) => {
      const payload = data ? JSON.stringify(data) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port: 6500,
        path: path,
        method: method,
        headers: {
          'Origin': 'http://127.0.0.1:7442',
          'Authorization': 'Bearer ' + authToken,
          ...(payload ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          } : {})
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch(e) {
            resolve({ status: res.statusCode, body });
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    // 1. Dispatch reminder to absent employees
    const remindAbsent = await apiCall('POST', '/api/admin/remind-duty', {
      target: 'absent',
      custom_note: 'هل ستداوم اليوم؟ يرجى تأكيد الحضور أو تقديم عذر لتنظيم العمل.'
    });
    console.log('1. POST /api/admin/remind-duty (target: absent):', remindAbsent.status, '| Result:', remindAbsent.data?.data?.message);

    // 2. Select an absent employee (account 32: Abdulaziz Ahmed Hawaej) and check /api/attendance/me
    const empToken = security.newToken();
    const empTokenHash = security.digest(empToken);
    await db.query(
      "INSERT INTO auth_sessions(token_hash, account_id, expires_at) VALUES($1, 32, strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 days'))",
      [empTokenHash]
    );

    const empMe = await apiCall('GET', '/api/attendance/me', null, empToken);
    console.log('2. Absent employee /api/attendance/me alert:', {
      has_alert: Boolean(empMe.data?.data?.duty_reminder_alert),
      inquiry: empMe.data?.data?.duty_reminder_alert?.inquiry,
      question: empMe.data?.data?.duty_reminder_alert?.question,
      custom_note: empMe.data?.data?.duty_reminder_alert?.custom_note
    });

    const alertId = empMe.data?.data?.duty_reminder_alert?.id;

    // 3. Employee responds: "will_attend" with ETA "خلال 15 دقيقة"
    const replyRes = await apiCall('POST', '/api/attendance/heartbeat', {
      response: 'will_attend',
      note: 'خلال 15 دقيقة',
      alert_id: alertId
    }, empToken);
    console.log('3. Employee inquiry reply status:', replyRes.status, '| Message:', replyRes.data?.data?.message);

    // 4. Verify /api/attendance/me no longer shows alert once answered
    const empMeAfter = await apiCall('GET', '/api/attendance/me', null, empToken);
    console.log('4. Alert suppressed after answer:', empMeAfter.data?.data?.duty_reminder_alert === null);

    // 5. Admin retrieves inquiry responses
    const inqResponses = await apiCall('GET', '/api/admin/inquiry-responses', null, token);
    console.log('5. GET /api/admin/inquiry-responses count:', inqResponses.data?.data?.length);
    if (inqResponses.data?.data?.length > 0) {
      const latest = inqResponses.data.data[0];
      console.log('   Latest respondent:', {
        name: latest.name,
        response: latest.response,
        status_text: latest.status_text,
        note: latest.note,
        answered_at: latest.answered_at
      });
    }

    await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [empTokenHash]);
    console.log('Cleaned up employee session.');
  } finally {
    await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
    console.log('Cleaned up admin session.');
  }
  console.log('=== ABSENT INQUIRY VERIFICATION COMPLETE ===');
})();
