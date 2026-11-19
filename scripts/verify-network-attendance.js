const security = require('../backend/src/services/session-security.js');
const db = require('../backend/src/config/database.js');
const http = require('http');

(async () => {
  console.log('=== STARTING NETWORK ATTENDANCE VERIFICATION ===');
  const token = security.newToken();
  const tokenHash = security.digest(token);
  await db.query(
    "INSERT INTO auth_sessions(token_hash, account_id, expires_at) VALUES($1, $2, strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 days'))",
    [tokenHash, 1]
  );

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
    // 1. Test /api/admin/my-ip
    const myIp = await apiCall('GET', '/api/admin/my-ip');
    console.log('1. GET /api/admin/my-ip status:', myIp.status, '| Detected IP:', myIp.data?.data?.ip);

    // 2. Test GET /api/admin/branches
    const branches = await apiCall('GET', '/api/admin/branches');
    console.log('2. GET /api/admin/branches status:', branches.status, '| Branch count:', branches.data?.data?.length);
    const branch1 = branches.data?.data?.[0];
    console.log('   Branch 1 initial network fields:', {
      name: branch1?.name,
      network_attendance_enabled: branch1?.network_attendance_enabled,
      wifi_ssid: branch1?.wifi_ssid,
      allowed_ips: branch1?.allowed_ips,
      network_mode: branch1?.network_mode
    });

    // 3. Test updating Branch 1 to enable network attendance
    const updateRes = await apiCall('PUT', `/api/admin/branches/${branch1.id}`, {
      ...branch1,
      network_attendance_enabled: true,
      wifi_ssid: 'AI-ASAAS-WiFi, Company-Office',
      allowed_ips: '127.0.0.1, 192.168.1.0/24, 157.90.133.20',
      network_mode: 'network_or_gps',
      reason: 'تفعيل التحضير عبر شبكة الواي فاي للفرع الرئيسي'
    });
    console.log('3. PUT /api/admin/branches/:id status:', updateRes.status);
    console.log('   Updated branch network settings:', {
      name: updateRes.data?.data?.name,
      network_attendance_enabled: updateRes.data?.data?.network_attendance_enabled,
      wifi_ssid: updateRes.data?.data?.wifi_ssid,
      allowed_ips: updateRes.data?.data?.allowed_ips,
      network_mode: updateRes.data?.data?.network_mode
    });

    // 4. Test Employee Check-in via Network Attendance
    // Let's create an employee session for account 33 (Abdulrahaman Al-Hamdani)
    const empToken = security.newToken();
    const empTokenHash = security.digest(empToken);
    await db.query(
      "INSERT INTO auth_sessions(token_hash, account_id, expires_at) VALUES($1, $2, strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 days'))",
      [empTokenHash, 33]
    );

    // Get an active QR token for branch 1
    const qrRes = await apiCall('GET', `/api/admin/branches/${branch1.id}/qr`);
    const enterToken = qrRes.data?.data?.enter?.token;

    // Check in with weak/distant GPS but matching IP (127.0.0.1)
    const checkinPayload = JSON.stringify({
      action: 'enter',
      token: enterToken,
      request_id: 'test-req-' + Date.now(),
      wifi_ssid: 'AI-ASAAS-WiFi',
      fix: {
        latitude: 15.3060,
        longitude: 44.1982,
        accuracy: 400, // normally rejected if > 250, but accepted via network!
        captured_at: new Date().toISOString()
      }
    });

    const checkinRes = await new Promise((res, rej) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 6500,
        path: '/api/attendance/action',
        method: 'POST',
        headers: {
          'Origin': 'http://127.0.0.1:7442',
          'Authorization': 'Bearer ' + empToken,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(checkinPayload)
        }
      }, (r) => {
        let b = '';
        r.on('data', c => b += c);
        r.on('end', () => res({ status: r.statusCode, data: JSON.parse(b) }));
      });
      req.on('error', rej);
      req.write(checkinPayload);
      req.end();
    });

    console.log('4. Employee check-in status:', checkinRes.status, '| Result:', checkinRes.data);

    // 5. Check attendance_events log for network details
    const events = await db.query(
      "SELECT id, kind, details, captured_at FROM attendance_events WHERE employee_id = 33 ORDER BY id DESC LIMIT 1"
    );
    console.log('5. Latest attendance event details for emp 33:', events.rows[0]?.details);

    await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [empTokenHash]);
    console.log('Cleaned up employee session.');
  } finally {
    await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
    console.log('Cleaned up admin session.');
  }
  console.log('=== NETWORK ATTENDANCE VERIFICATION COMPLETE ===');
})();
