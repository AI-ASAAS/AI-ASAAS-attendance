'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');
const { AppError } = require('../utils/AppError');
const fail = (code, message) => { throw new AppError(code, message, 422); };

function localDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function key(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new Error('QR_SECRET must contain at least 32 bytes');
  return secret;
}

function issueQr(branch, secret, now = new Date(), action = null) {
  const data = { v: 1, branch: String(branch.id), permanent: true, revision: branch.qr_revision };
  if (action && (action === 'enter' || action === 'exit')) data.action = action;
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = createHmac('sha256', key(secret)).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeQr(token) {
  if (typeof token !== 'string') return null;
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return null;
  try {
    return JSON.parse(Buffer.from(token.slice(0, dotIndex), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function verifyQr(token, branch, secret, now = new Date(), expectedAction = null) {
  if (typeof token !== 'string' || token.length > 1024) fail('QR_INVALID', 'رمز الحضور غير صالح');
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) fail('QR_INVALID', 'رمز الحضور غير صالح');
  const payloadStr = token.slice(0, dotIndex);
  const sigStr = token.slice(dotIndex + 1);
  const expectedSig = createHmac('sha256', key(secret)).update(payloadStr).digest('base64url');
  const a = Buffer.from(sigStr), b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) fail('QR_INVALID', 'توقيع رمز الحضور غير صالح أو تم التلاعب به');
  let data;
  try {
    data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
  } catch {
    fail('QR_INVALID', 'رمز الحضور غير صالح');
  }
  if (!data || data.v !== 1 || data.branch !== String(branch.id) || data.revision !== branch.qr_revision) {
    fail('QR_INVALID', 'رمز الحضور ملغى أو لا ينتمي لهذا الفرع');
  }
  if (expectedAction && expectedAction !== 'auto' && data.action && data.action !== expectedAction) {
    fail('QR_ACTION_MISMATCH', data.action === 'enter' ? 'عفواً، رمز QR هذا مخصص لتسجيل الدخول فقط، ولا يمكن استخدامه لتسجيل الانصراف والخروج.' : 'عفواً، رمز QR هذا مخصص لتسجيل الانصراف والخروج فقط، ولا يمكن استخدامه لتسجيل الدخول.');
  }
  return true;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(lat2-lat1)/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lng2-lng1)/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0,1-a)));
}

function validateFix(fix, now = new Date()) {
  if (!fix || typeof fix !== 'object') fail('LOCATION_REQUIRED', 'يلزم الحصول على موقع حديث');
  for (const k of ['latitude','longitude','accuracy']) if (typeof fix[k] !== 'number' || !Number.isFinite(fix[k])) fail('LOCATION_INVALID', 'بيانات الموقع غير صالحة');
  if (Math.abs(fix.latitude)>90 || Math.abs(fix.longitude)>180 || fix.accuracy<=0 || fix.accuracy>100000) fail('LOCATION_INVALID', 'بيانات الموقع خارج الحدود');
  const captured = Date.parse(fix.captured_at);
  if (!Number.isFinite(captured) || now.getTime()-captured>60000 || captured-now.getTime()>10000) fail('LOCATION_STALE', 'قراءة الموقع قديمة؛ اطلب قراءة جديدة');
  return captured;
}

function classifyFix(fix, branch, now = new Date()) {
  validateFix(fix, now);
  const distance = distanceMeters(fix.latitude, fix.longitude, Number(branch.latitude), Number(branch.longitude));
  if (!branch.active) fail('BRANCH_DISABLED', 'الموقع غير مفعل');
  if (fix.accuracy > Number(branch.max_accuracy)) return { state:'uncertain', distance, reason:'low_accuracy' };
  if (distance + fix.accuracy <= Number(branch.entry_radius)) return { state:'inside', distance };
  if (distance - fix.accuracy > Number(branch.exit_radius)) return { state:'outside', distance };
  return { state:'uncertain', distance, reason:'boundary' };
}

// Confirmation is based on elapsed server time, not employee-supplied timestamps.
function advanceExit(previous, classification, fix, branch, now = new Date()) {
  const captured = validateFix(fix, now);
  const revision = branch.location_revision;
  if (previous?.last_fix && captured <= Date.parse(previous.last_fix)) return { ...previous, exit:false, ignored:true };
  if (classification.state !== 'outside') return { count:0, since:null, last_fix:fix.captured_at, last_received:now.toISOString(), revision, exit:false };
  const continuous = previous?.revision === revision && previous.since && now-Date.parse(previous.last_received) <= 90000;
  const count = continuous ? previous.count+1 : 1;
  const since = continuous ? previous.since : now.toISOString();
  const exit = count >= Number(branch.exit_samples) && now-Date.parse(since) >= Number(branch.exit_delay_seconds)*1000;
  return { count, since, last_fix:fix.captured_at, last_received:now.toISOString(), revision, exit };
}

function shiftWindow(shift, now = new Date()) {
  const startMinutes = parseTime(shift.start_time), endMinutes = parseTime(shift.end_time);
  const day = localDay(now);
  let start = new Date(`${day}T${shift.start_time.slice(0,5)}:00+03:00`);
  const duration = ((endMinutes-startMinutes+1440)%1440) || 1440;
  let end = new Date(start.getTime()+duration*60000);
  if (endMinutes<=startMinutes && now<start) { start=new Date(start-86400000); end=new Date(end-86400000); }
  const weekday = new Date(start.getTime()+3*3600000).getUTCDay();
  const workdays = shift.work_days || [0,1,2,3,4];
  if (!workdays.includes(weekday) || now<start || now>end) fail('OUTSIDE_SHIFT', 'الوقت الحالي خارج جدول دوامك');
  return { start, end, day:localDay(start) };
}

function parseTime(value) {
  if (typeof value!=='string' || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value)) fail('INVALID_SHIFT','وقت الدوام غير صالح');
  return Number(value.slice(0,2))*60+Number(value.slice(3,5));
}

module.exports = { localDay, issueQr, verifyQr, decodeQr, validateFix, classifyFix, advanceExit, shiftWindow, distanceMeters, parseTime };
