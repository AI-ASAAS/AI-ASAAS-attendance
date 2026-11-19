'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Network Attendance: secure-app.js defines my-ip and network verification helpers', () => {
  const content = fs.readFileSync(require.resolve('../src/secure-app'), 'utf8');
  assert.match(content, /app\.get\('\/api\/admin\/my-ip'/);
  assert.match(content, /function isIpInSubnet/);
  assert.match(content, /function verifyBranchNetwork/);
  assert.match(content, /network_attendance_enabled/);
  assert.match(content, /wifi_ssid/);
  assert.match(content, /allowed_ips/);
  assert.match(content, /network_mode/);
});

test('Network Attendance: IP subnet and CIDR matching logic', () => {
  function parseIpV4(ipStr) {
    if (!ipStr || typeof ipStr !== 'string') return null;
    const clean = ipStr.trim().replace(/^::ffff:/, '');
    const parts = clean.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255)) {
      return ((Number(parts[0]) << 24) | (Number(parts[1]) << 16) | (Number(parts[2]) << 8) | Number(parts[3])) >>> 0;
    }
    return null;
  }

  function isIpInSubnet(ipStr, subnetStr) {
    const cleanIp = (ipStr || '').trim().replace(/^::ffff:/, '');
    const cleanSubnet = (subnetStr || '').trim().replace(/^::ffff:/, '');
    if (!cleanIp || !cleanSubnet) return false;
    if (cleanSubnet === '*' || cleanSubnet === cleanIp) return true;
    if (cleanSubnet.endsWith('.*')) {
      const prefix = cleanSubnet.slice(0, -1);
      return cleanIp.startsWith(prefix);
    }
    if (cleanSubnet.includes('/')) {
      const [range, bitsStr] = cleanSubnet.split('/');
      const bits = parseInt(bitsStr, 10);
      const ipNum = parseIpV4(cleanIp);
      const rangeNum = parseIpV4(range);
      if (ipNum !== null && rangeNum !== null && !isNaN(bits) && bits >= 0 && bits <= 32) {
        if (bits === 0) return true;
        const mask = ((0xFFFFFFFF << (32 - bits)) >>> 0);
        return ((ipNum & mask) >>> 0) === ((rangeNum & mask) >>> 0);
      }
    }
    return cleanIp.toLowerCase() === cleanSubnet.toLowerCase();
  }

  // Exact IP
  assert.equal(isIpInSubnet('192.168.1.50', '192.168.1.50'), true);
  assert.equal(isIpInSubnet('192.168.1.50', '192.168.1.51'), false);

  // Subnet CIDR /24
  assert.equal(isIpInSubnet('192.168.1.120', '192.168.1.0/24'), true);
  assert.equal(isIpInSubnet('192.168.2.120', '192.168.1.0/24'), false);

  // Subnet CIDR /16
  assert.equal(isIpInSubnet('10.50.12.3', '10.50.0.0/16'), true);
  assert.equal(isIpInSubnet('10.51.12.3', '10.50.0.0/16'), false);

  // Wildcard
  assert.equal(isIpInSubnet('172.16.5.9', '172.16.5.*'), true);
  assert.equal(isIpInSubnet('172.16.6.9', '172.16.5.*'), false);

  // IPv6 mapped IPv4
  assert.equal(isIpInSubnet('::ffff:192.168.1.50', '192.168.1.0/24'), true);
});

test('Network Attendance: verifyBranchNetwork handles SSID, IP, and modes', () => {
  function verifyBranchNetwork(branch, clientIp, clientSsid, clientBssid) {
    if (!branch || !branch.network_attendance_enabled) {
      return { enabled: false, matched: false, reason: 'network_disabled' };
    }
    const cleanIp = (clientIp || '').trim().replace(/^::ffff:/, '');
    let ipMatched = false, matchedRule = '';
    if (branch.allowed_ips && branch.allowed_ips.trim()) {
      const rules = branch.allowed_ips.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
      for (const rule of rules) {
        if (rule === cleanIp || (rule.endsWith('.*') && cleanIp.startsWith(rule.slice(0, -1)))) {
          ipMatched = true;
          matchedRule = rule;
          break;
        }
      }
    }
    let ssidMatched = false;
    if (branch.wifi_ssid && branch.wifi_ssid.trim() && clientSsid) {
      const allowedSsids = branch.wifi_ssid.split(/[,\n;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const cSsid = String(clientSsid).trim().toLowerCase();
      if (allowedSsids.includes(cSsid) || allowedSsids.some(s => cSsid.includes(s))) {
        ssidMatched = true;
      }
    }
    const hasIpRules = Boolean(branch.allowed_ips && branch.allowed_ips.trim());
    const hasSsidRules = Boolean(branch.wifi_ssid && branch.wifi_ssid.trim());
    let matched = false;
    if (hasIpRules && hasSsidRules) {
      matched = ipMatched || ssidMatched;
    } else if (hasIpRules) {
      matched = ipMatched;
    } else if (hasSsidRules) {
      matched = ssidMatched;
    } else {
      matched = true;
    }
    return {
      enabled: true,
      matched,
      clientIp: cleanIp,
      matchedRule,
      ipMatched,
      ssidMatched,
      mode: branch.network_mode || 'network_or_gps'
    };
  }

  const branchDisabled = { network_attendance_enabled: false };
  assert.equal(verifyBranchNetwork(branchDisabled, '192.168.1.5', 'Office-WiFi').matched, false);

  const branchWithSsid = {
    network_attendance_enabled: true,
    wifi_ssid: 'AI-ASAAS-HQ, Office-Guest',
    allowed_ips: '192.168.1.*'
  };
  assert.equal(verifyBranchNetwork(branchWithSsid, '192.168.1.25', 'Wrong-WiFi').matched, true); // IP matched
  assert.equal(verifyBranchNetwork(branchWithSsid, '10.0.0.5', 'AI-ASAAS-HQ').matched, true); // SSID matched
  assert.equal(verifyBranchNetwork(branchWithSsid, '10.0.0.5', 'Wrong-WiFi').matched, false); // Neither matched
});
