const security = require('../backend/src/services/session-security.js');
const db = require('../backend/src/config/database.js');
const http = require('http');

(async () => {
  const token = security.newToken();
  const tokenHash = security.digest(token);
  await db.query(
    "INSERT INTO auth_sessions(token_hash, account_id, expires_at) VALUES($1, $2, strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 days'))",
    [tokenHash, 1]
  );
  console.log('Inserted session for account 1 (admin).');

  function apiCall(method, path, data) {
    return new Promise((resolve, reject) => {
      const payload = data ? JSON.stringify(data) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port: 6500,
        path: path,
        method: method,
        headers: {
          'Origin': 'http://127.0.0.1:7442',
          'Authorization': 'Bearer ' + token,
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
    // 1. Check me
    const me = await apiCall('GET', '/api/auth/me');
    console.log('1. /api/auth/me status:', me.status, '| Account:', me.data?.data?.name, '| Role:', me.data?.data?.role);

    // 2. Check shifts
    const shifts = await apiCall('GET', '/api/admin/shifts');
    console.log('2. /api/admin/shifts status:', shifts.status, '| Shifts count:', shifts.data?.data?.shifts?.length);

    // 3. Check settings
    const settings = await apiCall('GET', '/api/admin/settings');
    console.log('3. /api/admin/settings status:', settings.status, '| Settings:', {
      duty_reminder_enabled: settings.data?.data?.duty_reminder_enabled,
      duty_reminder_interval_hours: settings.data?.data?.duty_reminder_interval_hours,
      email_notifications: settings.data?.data?.email_notifications
    });

    // 4. Update settings (save reminder policy)
    const updateRes = await apiCall('PUT', '/api/admin/settings', {
      duty_reminder_enabled: 'true',
      duty_reminder_interval_hours: 2,
      email_notifications: 'false'
    });
    console.log('4. PUT /api/admin/settings status:', updateRes.status, '| Success:', updateRes.data?.success);

    // 5. Test remind-duty with target: 'all'
    const remindAll = await apiCall('POST', '/api/admin/remind-duty', {
      target: 'all',
      custom_note: 'يرجى تسجيل الحضور وتأكيد الاستمرار في الدوام'
    });
    console.log('5. POST /api/admin/remind-duty (target: all) status:', remindAll.status, '| Result:', remindAll.data);

    // 6. Test remind-duty with target: 'inside'
    const remindInside = await apiCall('POST', '/api/admin/remind-duty', {
      target: 'inside',
      custom_note: 'تذكير للحاضرين فقط'
    });
    console.log('6. POST /api/admin/remind-duty (target: inside) status:', remindInside.status, '| Result:', remindInside.data);

    // 7. Test remind-duty with target: 'employee'
    const remindEmp = await apiCall('POST', '/api/admin/remind-duty', {
      target: 'employee',
      employee_id: 23,
      custom_note: 'تذكير موجه'
    });
    console.log('7. POST /api/admin/remind-duty (target: employee) status:', remindEmp.status, '| Result:', remindEmp.data);

    // 8. Check attendance_events
    const events = await db.query(
      "SELECT id, employee_id, kind, details, captured_at FROM attendance_events WHERE kind = 'duty_reminder' ORDER BY id DESC LIMIT 3"
    );
    console.log('8. Logged duty_reminder events count:', events.rows.length);
    if (events.rows.length > 0) {
      console.log('   Latest event:', {
        id: events.rows[0].id,
        employee_id: events.rows[0].employee_id,
        kind: events.rows[0].kind,
        details: events.rows[0].details,
        captured_at: events.rows[0].captured_at
      });
    }

    // 9. Check employee alert surfacing
    // Account 23 (Anas Alaghbari) was targeted. Let's create a session for 23 and check /api/attendance/me
    const empToken = security.newToken();
    const empTokenHash = security.digest(empToken);
    await db.query(
      "INSERT INTO auth_sessions(token_hash, account_id, expires_at) VALUES($1, $2, strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 days'))",
      [empTokenHash, 23]
    );
    
    const empReq = await new Promise((res, rej) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 6500,
        path: '/api/attendance/me',
        method: 'GET',
        headers: {
          'Origin': 'http://127.0.0.1:7442',
          'Authorization': 'Bearer ' + empToken
        }
      }, (r) => {
        let b = '';
        r.on('data', c => b += c);
        r.on('end', () => res({ status: r.statusCode, data: JSON.parse(b) }));
      });
      req.on('error', rej);
      req.end();
    });
    console.log('9. Employee /api/attendance/me alert received:', {
      status: empReq.status,
      duty_reminder_alert: empReq.data?.data?.duty_reminder_alert
    });

    await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [empTokenHash]);
    console.log('Cleaned up employee session.');

  } finally {
    await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
    console.log('Cleaned up admin session.');
  }
})();
