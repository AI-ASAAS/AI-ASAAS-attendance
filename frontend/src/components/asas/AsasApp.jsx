'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getDeviceId, getDeviceName } from '../../utils/device';
import { promptBiometricVerification } from '../../utils/biometric';
import {
  Ambient,
  AssistantWidget,
  Avatar,
  Button,
  Card,
  EmptyState,
  Glass,
  Icon,
  Modal,
  ProgressBar,
  Segmented,
  SiteHeader,
  Stretch,
  Swash,
  TabBar,
  useTheme,
  firstName,
  formatNumber
} from '../../asaas-ui';

function AsasGreeting({ name }) {
  const isMorning = new Date().getHours() < 12;
  const first = firstName(name || '');
  return (
    <>
      {isMorning ? <Stretch before="صب" after="اح" length={2} /> : <Stretch before="مس" after="اء" length={2} />} الخير
      {first ? `، ${first}` : ''}
    </>
  );
}

function AsasAssistant({ user, isAdmin }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) return undefined;
    api('/assistant/status', 'GET', undefined, 0)
      .then((res) => { if (active) setStatus(res); })
      .catch(() => { if (active) setStatus({ enabled: true }); });
    return () => { active = false; };
  }, [user?.id]);

  if (!user?.id) return null;
  if (status && status.enabled === false) return null;

  const r = status?.restrictions || {};
  const quota = status?.quota;
  const baseSubtitle = isAdmin ? 'ملخصات الحضور الفورية' : 'مساعد الدوام والإجازات';
  const quotaLabel = quota ? ` · متبقي ${quota.remaining}/${quota.limit} اليوم` : '';
  const suggestions = isAdmin
    ? [
        'ملخص الحضور اليوم',
        ...(r.allow_hours_info !== false ? ['من المتأخرون اليوم؟'] : []),
        'من الغائبون اليوم؟',
        ...(r.allow_leave_info !== false ? ['الطلبات والإجازات المعلقة'] : [])
      ]
    : [
        'ما حالتي اليوم؟',
        'ما هي ورديتي والفرع؟',
        ...(r.allow_hours_info !== false ? ['كم مجموع ساعاتي هذا الشهر؟'] : []),
        ...(r.allow_leave_info !== false ? ['ما حالة طلبات إجازتي؟'] : []),
        ...(r.allow_general_help !== false ? ['كيف أسجل الحضور بالبصمة؟'] : [])
      ];

  return (
    <AssistantWidget
      user={{ id: String(user.id), displayName: user.name || '' }}
      ask={async (messages) => {
        const res = await api('/assistant', 'POST', { messages }, 0);
        if (res?.quota) {
          setStatus((prev) => ({ ...(prev || { enabled: true }), quota: res.quota }));
        }
        return res;
      }}
      title="مساعد أساس"
      subtitle={`${baseSubtitle}${quotaLabel}`}
      suggestions={suggestions}
      intro={
        isAdmin
          ? 'اسألني عن الحاضرين والمتأخرين والغائبين والطلبات المعلقة الآن.'
          : 'اسألني عن حضورك اليوم أو ورديتك أو ساعاتك وإجازاتك ضمن ضوابط حسابك.'
      }
      disclaimer={
        status?.provider?.name
          ? `مدعوم عبر ${status.provider.name} وبيانات أساس الموثقة فقط.`
          : 'إجابات فورية مستندة مباشرة إلى سجلات أساس الحقيقية.'
      }
    />
  );
}

// Avatar Presets using official ASAAS tokens and stroke icons
const AVATAR_PRESETS = [
  { id: 'man', name: 'موظف (رجل)', bg: 'var(--accent-fill)', fg: 'var(--on-accent)', icon: 'user' },
  { id: 'woman', name: 'موظفة (امرأة)', bg: 'var(--partial-bg)', fg: 'var(--partial)', icon: 'award' },
  { id: 'admin', name: 'مسؤول نظام', bg: 'var(--paid-bg)', fg: 'var(--paid)', icon: 'shieldCheck' }
];

function UserAvatar({ user, size = 'md', onClick }) {
  const avatarKey = user?.avatar === 'neutral' ? 'man' : (user?.avatar || 'man');
  const preset = AVATAR_PRESETS.find(p => p.id === avatarKey);
  const isImage = avatarKey && (avatarKey.startsWith('http') || avatarKey.startsWith('/') || avatarKey.startsWith('data:image/'));
  const letter = (user?.name || user?.identifier || 'م')[0] || 'م';
  const iconSize = size === 'lg' ? 30 : size === 'sm' ? 16 : 20;

  return (
    <div
      className={`asas-avatar ${size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : ''}`}
      style={{
        background: isImage ? 'var(--brand-ink)' : (preset ? preset.bg : 'var(--accent-fill)'),
        color: isImage ? undefined : (preset ? preset.fg : 'var(--on-accent)'),
        cursor: onClick ? 'pointer' : 'default',
        padding: 0
      }}
      onClick={onClick}
      title={user?.name || ''}
    >
      {isImage ? (
        <img src={avatarKey} alt={user?.name || 'صورة الموظف'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : preset ? (
        <Icon name={preset.icon} style={{ width: iconSize, height: iconSize }} />
      ) : (
        <span>{letter}</span>
      )}
    </div>
  );
}

// ─── Live Isolated Clock Component (Prevents whole-page re-renders) ──
const LiveClock = React.memo(function LiveClock({ iconColor = 'var(--accent)', iconSize = 14, label = 'صنعاء: ' }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      try {
        setTime(new Intl.DateTimeFormat('ar-YE-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Aden' }).format(new Date()));
      } catch (_) {
        setTime(new Date().toLocaleTimeString('ar-YE-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="asas-clock-pill" aria-label={`الوقت: ${time || '—'}`}>
      <Icon name="clock" style={{ width: iconSize, height: iconSize, color: iconColor, flexShrink: 0 }} />
      <span className="asas-clock-content">
        <span className="asas-clock-label">{label}</span>
        <strong className="num asas-clock-digits">{time || '—'}</strong>
      </span>
    </div>
  );
});

async function api(path, method = 'GET', body, retries = 2) {
  let attempt = 0;
  while (true) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('asas_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const r = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers,
        body: body !== undefined && body !== null ? JSON.stringify(body) : (method === 'POST' || method === 'PUT' || method === 'PATCH' ? '{}' : undefined),
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let value = null;
      const contentType = r.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try { value = await r.json(); } catch {}
      } else {
        try {
          const text = await r.text();
          try { value = JSON.parse(text); } catch {}
        } catch {}
      }

      if (!r.ok) {
        if ([500, 502, 503, 504].includes(r.status) && attempt < retries) {
          attempt++;
          await new Promise(res => setTimeout(res, 500 * attempt));
          continue;
        }
        const msg = value?.message || value?.error || (r.status === 401 ? 'يرجى تسجيل الدخول' : 'تعذر الاتصال بالخادم');
        throw Object.assign(new Error(msg), { status: r.status });
      }

      return value ? value.data : null;
    } catch (netErr) {
      if (attempt < retries && (!netErr.status || [500, 502, 503, 504].includes(netErr.status))) {
        attempt++;
        await new Promise(res => setTimeout(res, 500 * attempt));
        continue;
      }
      if (!netErr.status) {
        throw Object.assign(new Error('تعذر الاتصال بخادم أساس وقاعدة البيانات'), { status: 0 });
      }
      throw netErr;
    }
  }
}

const today = () => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date()); }
  catch (_) { return new Date().toISOString().slice(0, 10); }
};

const time = v => {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' });
  } catch (_) { return '—'; }
};

const date = v => {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-YE', { timeZone: 'Asia/Aden' });
  } catch (_) { return '—'; }
};

const states = { inside: 'حضور مفتوح', outside: 'تم الخروج', closed: 'مغلق', pending: 'قيد المراجعة', approved: 'مقبولة', rejected: 'مرفوضة' };
const roles = { super_admin: 'مدير النظام التنفيذي', hr_admin: 'الموارد البشرية', branch_manager: 'مدير الفرع', viewer: 'للعرض فقط', employee: 'موظف' };

// UNIQUE ICON FOR EVERY TAB: dashboard, calendar, users, bell, mapPin, qrCode, clock, receipt, shieldCheck, settings
const tabs = [
  ['dashboard', 'نظرة عامة', 'dashboard'],
  ['records', 'الحضور والانصراف', 'calendar'],
  ['accounts', 'الموظفون والأجهزة', 'users'],
  ['announcements', 'التعميمات الرسمية', 'bell'],
  ['branches', 'المواقع والفروع', 'mapPin'],
  ['qr', 'رموز QR المعتمدة', 'qrCode'],
  ['shifts', 'الدوام والاحتساب', 'clock'],
  ['leave', 'طلبات الإجازات', 'receipt'],
  ['audit', 'الرقابة وسجل العمليات', 'shieldCheck'],
  ['settings', 'إعدادات النظام', 'settings']
];

const permissions = {
  'employees.read': 'عرض الموظفين',
  'employees.write': 'إدارة الموظفين',
  'locations.write': 'تعديل المواقع',
  'qr.manage': 'إدارة QR',
  'shifts.write': 'الدوام والاحتساب',
  'reports.export': 'تصدير التقارير',
  'attendance.edit': 'تصحيح الحضور',
  'leave.review': 'مراجعة الإجازات',
  'audit.read': 'سجل العمليات'
};

const defaults = {
  branches: { name: '', latitude: '', longitude: '', entry_radius: 80, exit_radius: 120, max_accuracy: 30, exit_samples: 3, exit_delay_seconds: 120, active: true, reason: '' },
  shifts: { name: '', start_time: '08:00', end_time: '16:00', work_days: [0, 1, 2, 3, 4, 6], grace_minutes: 15, close_policy: 'actual_exit', deduct_away: false, reason: '' },
  accounts: { name: '', identifier: '', email: '', phone: '', password: '', role: 'employee', branch_id: '', shift_id: '', permissions: [] },
  records: { first_in: '', last_out: '', state: 'closed', exit_reason: 'انتهاء ساعات الدوام الرسمي في الموعد', deduct_away: false, reason: '' },
  announcements: { title: '', content: '', priority: 'normal', send_email: false }
};

function Brand({ compact = false }) {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true" />
      <div>
        <div className="brand__name"><Swash>أساس</Swash></div>
        {!compact && <div className="brand__tag">نظام الحضور والدوام</div>}
      </div>
    </div>
  );
}

function Empty({ children = 'لا توجد سجلات بعد' }) {
  return <EmptyState icon="file" title={children} />;
}

function Field({ label, children, ...props }) {
  return (
    <label className="asas-label">
      <span>{label}</span>
      {children || <input className="asas-input" {...props} />}
    </label>
  );
}

function Records({ rows = [], onEdit, canEdit, viewMode: externalViewMode, showViewToggle = true }) {
  const [internalViewMode, setInternalViewMode] = useState('auto');
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return <Empty />;
  return (
    <div className={`asas-records-container ${viewMode !== 'auto' ? `view-${viewMode}` : ''}`}>
      {showViewToggle && externalViewMode === undefined && list.length > 0 && (
        <div className="asas-records-view-toggle">
          <Segmented
            label="نمط عرض السجلات"
            value={viewMode}
            onChange={setInternalViewMode}
            options={[
              { value: 'auto', label: 'تلقائي' },
              { value: 'table', label: 'جدول' },
              { value: 'cards', label: 'بطاقات' }
            ]}
          />
        </div>
      )}
      {/* 1. TABLE VIEW (Desktop / Tablet) */}
      <div className="asas-records-table-view asas-table-wrap">
        <table className="asas-table">
          <thead>
            <tr>
              {['الموظف', 'الفرع', 'التاريخ', 'أول دخول', 'آخر خروج', 'الحالة', 'طريقة / سبب الخروج', 'الاحتساب', ...(canEdit ? ['إجراء'] : [])].map(x => <th key={x}>{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((r, idx) => {
              const isInside = r.state === 'inside';
              const isAbsent = r.state === 'absent';
              const isLeave = r.state === 'leave';
              const isEarly = r.status_key === 'early_exit';
              const isLate = r.status_key && typeof r.status_key === 'string' && r.status_key.startsWith('late');
              const statusLabel = isInside ? (isLate ? 'حاضر (متأخر)' : 'حاضر') :
                isAbsent ? 'غائب' :
                isLeave ? 'إجازة' :
                (isEarly ? 'منصرف مبكراً' : 'منصرف');
              const rawExitReason = r.exit_reason_label || (
                isInside ? 'على رأس العمل' :
                isAbsent ? 'لم يحضر اليوم' :
                isLeave ? 'إجازة معتمدة' :
                ({
                  geofence: 'مغادرة النطاق (GPS)',
                  manual: 'انصراف نظامي في الموعد',
                  scheduled: 'انتهاء فترة المناوبة',
                  admin_correction: 'تصحيح إداري'
                }[r.exit_reason] || r.exit_reason || 'انصراف نظامي')
              );
              const exitReasonLabel = String(rawExitReason || '—');

              return (
                <tr key={r.id || ('emp-' + (r.employee_id || idx))}>
                  <td>
                    <div className="asas-acc-cell-emp">
                      <UserAvatar user={{ name: r.name, avatar: r.avatar }} size="sm" />
                      <div className="asas-acc-cell-emp__meta">
                        <strong style={{ lineHeight: 1.4 }}>{r.name}</strong>
                        <span className="num asas-acc-id" style={{ alignSelf: 'flex-start' }}>#{r.identifier}</span>
                      </div>
                    </div>
                  </td>
                  <td>{r.branch_name || 'الفرع الرئيسي'}</td>
                  <td><span className="num" dir="ltr">{date(r.shift_start)}</span></td>
                  <td>
                    {r.first_in ? (
                      <span className="num" style={{ color: 'var(--paid)', fontWeight: 600 }}>{time(r.first_in)}</span>
                    ) : (
                      <span style={{ color: isAbsent ? 'var(--unpaid)' : 'var(--text-3)', fontWeight: 500 }}>
                        {isAbsent ? 'لم يحضر' : '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    {r.last_out ? (
                      <span className="num" style={{ color: 'var(--text)' }}>{time(r.last_out)}</span>
                    ) : (
                      <span style={{ color: isInside ? 'var(--partial)' : 'var(--text-3)', fontWeight: isInside ? 600 : 400 }}>
                        {isInside ? 'حاضر الآن' : '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span 
                      className={`asas-badge ${isInside ? 'inside' : (isAbsent ? 'outside' : (isLeave ? 'pending' : 'outside'))} sm-badge`}
                    >
                      <Icon name={isInside ? (isLate ? 'alert' : 'checkCircle') : (isAbsent ? 'alert' : (isLeave ? 'briefcase' : (isEarly ? 'alert' : 'logout')))} style={{ width: 11, height: 11 }} />
                      {statusLabel}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12,
                      color: isInside ? 'var(--text-3)' : (isAbsent ? 'var(--unpaid)' : (exitReasonLabel.includes('مبكر') ? 'var(--unpaid)' : 'var(--paid)')),
                      fontWeight: 600,
                      maxWidth: 160,
                      display: 'inline-block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={exitReasonLabel}>
                      {exitReasonLabel}
                    </span>
                  </td>
                  <td>
                    {isAbsent ? (
                      <span style={{ color: 'var(--unpaid)', fontSize: 12, fontWeight: 500 }}>0 دقيقة</span>
                    ) : isLeave ? (
                      <span style={{ color: 'var(--chart-out)', fontSize: 12, fontWeight: 500 }}>إجازة</span>
                    ) : r.counted_minutes == null ? (
                      <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>قيد العمل</span>
                    ) : (
                      <>
                        <strong className="num">{formatNumber(r.counted_minutes)} د</strong>
                        <small style={{ display: 'block' }}>{r.deduct_away ? 'مع خصم الخروج' : 'صافي'}</small>
                      </>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      {r.id ? (
                        <button className="asas-btn sm" onClick={() => onEdit(r)} title="تصحيح سجل الحضور">
                          <Icon name="edit" />
                          تصحيح
                        </button>
                      ) : (
                        <button className="asas-btn sm primary" onClick={() => onEdit(r)} title="تسجيل حضور يدوي للموظف الغائب">
                          <Icon name="checkCircle" />
                          تحضير
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. CARDS VIEW (Phone first, liquid-glass) */}
      <div className="asas-records-cards-view asas-records-grid">
        {list.map((r, idx) => {
          const isInside = r.state === 'inside';
          const isAbsent = r.state === 'absent';
          const isLeave = r.state === 'leave';
          const isEarly = r.status_key === 'early_exit';
          const isLate = r.status_key && typeof r.status_key === 'string' && r.status_key.startsWith('late');
          const statusBadge = isInside ? (
            <span className="asas-badge inside sm-badge">
              <Icon name={isLate ? 'alert' : 'checkCircle'} style={{ width: 11, height: 11 }} />
              {isLate ? 'حاضر (متأخر)' : 'حاضر'}
            </span>
          ) : isAbsent ? (
            <span className="asas-badge outside sm-badge">
              <Icon name="alert" style={{ width: 11, height: 11 }} />
              غائب
            </span>
          ) : isLeave ? (
            <span className="asas-badge pending sm-badge">
              <Icon name="briefcase" style={{ width: 11, height: 11 }} />
              إجازة
            </span>
          ) : (
            <span className="asas-badge outside sm-badge">
              <Icon name="logout" style={{ width: 11, height: 11 }} />
              {isEarly ? 'منصرف مبكراً' : 'منصرف'}
            </span>
          );

          const rawExitReason = r.exit_reason_label || (
            isInside ? 'على رأس العمل حالياً' :
            isAbsent ? 'لم يسجل حضور اليوم' :
            isLeave ? 'إجازة رسمية معتمدة' :
            ({
              geofence: 'مغادرة نطاق الموقع (GPS)',
              manual: 'انصراف نظامي في الموعد',
              scheduled: 'انتهاء فترة المناوبة تلقائياً',
              admin_correction: 'تصحيح إداري'
            }[r.exit_reason] || r.exit_reason || 'انصراف نظامي')
          );
          const exitReasonLabel = String(rawExitReason || '—');

          return (
            <Glass key={r.id || ('card-' + (r.employee_id || idx))} className="asas-record-card">
              <div className="asas-record-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <UserAvatar user={{ name: r.name, avatar: r.avatar }} size="md" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong className="asas-record-emp-name">{r.name}</strong>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      <span className="asas-readonly-id num">#{r.identifier}</span>
                      <span>•</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.branch_name || 'الفرع الرئيسي'}</span>
                    </div>
                  </div>
                </div>
                <div className="asas-record-card-status">
                  {statusBadge}
                </div>
              </div>

              <div className="asas-record-card-body">
                <div className="asas-record-time-row">
                  <div className="asas-record-time-box">
                    <span className="asas-record-time-label">أول دخول</span>
                    <strong className="num" style={{ color: r.first_in ? 'var(--paid)' : (isAbsent ? 'var(--unpaid)' : 'var(--text-3)'), fontSize: 12 }}>
                      {r.first_in ? time(r.first_in) : (isAbsent ? 'لم يحضر' : '—')}
                    </strong>
                  </div>
                  <div className="asas-record-time-box">
                    <span className="asas-record-time-label">آخر خروج</span>
                    <strong className="num" style={{ color: r.last_out ? 'var(--text)' : (isInside ? 'var(--partial)' : 'var(--text-3)'), fontSize: 12 }}>
                      {r.last_out ? time(r.last_out) : (isInside ? 'حاضر الآن' : '—')}
                    </strong>
                  </div>
                  <div className="asas-record-time-box">
                    <span className="asas-record-time-label">الاحتساب</span>
                    <strong className="num" style={{ color: 'var(--accent)', fontSize: 12 }}>
                      {isAbsent ? '0 د' : isLeave ? 'إجازة' : r.counted_minutes == null ? 'قيد العمل' : `${formatNumber(r.counted_minutes)} د`}
                    </strong>
                  </div>
                </div>

                <div className="asas-record-reason-box">
                  <Icon name="info" style={{ width: 12, height: 12, color: 'var(--text-3)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: isInside ? 'var(--paid)' : (isAbsent ? 'var(--unpaid)' : 'var(--text-2)'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exitReasonLabel}>
                    {exitReasonLabel}
                  </span>
                </div>
              </div>

              {canEdit && (
                <div className="asas-record-card-foot">
                  {r.id ? (
                    <button className="asas-btn sm" onClick={() => onEdit(r)} style={{ width: '100%', justifyContent: 'center' }}>
                      <Icon name="edit" />
                      تصحيح السجل
                    </button>
                  ) : (
                    <button className="asas-btn sm primary" onClick={() => onEdit(r)} style={{ width: '100%', justifyContent: 'center' }}>
                      <Icon name="checkCircle" />
                      تحضير يدوي
                    </button>
                  )}
                </div>
              )}
            </Glass>
          );
        })}
      </div>
    </div>
  );
}

// Web Push Helper Utilities for PWA & Closed-App Push Notifications
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerWebPushSubscription() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.pushManager) return false;

    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const keyRes = await api('/push/public-key');
      const vapidPublicKey = keyRes?.data?.publicKey || keyRes?.publicKey;
      if (!vapidPublicKey) return false;

      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    if (sub) {
      await api('/push/subscribe', 'POST', { subscription: sub.toJSON() });
      return true;
    }
  } catch (err) {
    console.warn('[WebPush] Register subscription note:', err?.message);
  }
  return false;
}

function normalizeNotificationPreview(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNotificationParagraphs(text) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .map(block =>
      block
        .split('\n')
        .map(line => line.replace(/[ \t]{2,}/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
    )
    .filter(Boolean);
}

function getNotificationPriorityMeta(priority) {
  if (priority === 'urgent') {
    return {
      label: 'عاجل جداً',
      pillClass: 'pill--unpaid',
      icon: 'alert',
      kindClass: 'kind-icon--out',
      cls: 'is-urgent'
    };
  }
  if (priority === 'important') {
    return {
      label: 'هام',
      pillClass: 'pill--partial',
      icon: 'bell',
      kindClass: 'kind-icon--gold',
      cls: 'is-important'
    };
  }
  return {
    label: 'إشعار رسمي',
    pillClass: 'pill--paid',
    icon: 'sparkle',
    kindClass: 'kind-icon--in',
    cls: 'is-normal'
  };
}

// Announcements & Notifications Center Dialog (Official AI-ASAAS/skills Master-Detail)
function AnnouncementsModal({
  announcements,
  initialSelectedId = null,
  directNotification = null,
  onClearDirectNotification,
  onClose,
  canManage,
  onEdit,
  onDelete,
  onMarkRead,
  onMarkAllRead
}) {
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialSelectedId != null) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  const unreadList = useMemo(() => announcements.filter(a => !a.is_read), [announcements]);
  const priorityList = useMemo(
    () => announcements.filter(a => a.priority === 'urgent' || a.priority === 'important'),
    [announcements]
  );

  const filteredAnnouncements = useMemo(() => {
    if (filter === 'unread') return unreadList;
    if (filter === 'priority') return priorityList;
    return announcements;
  }, [announcements, filter, unreadList, priorityList]);

  const selectedAnnouncement = useMemo(() => {
    if (selectedId == null) return null;
    return announcements.find(a => String(a.id) === String(selectedId)) || null;
  }, [announcements, selectedId]);

  // Mark individual announcement as read immediately when opened in full reader
  useEffect(() => {
    if (selectedAnnouncement && !selectedAnnouncement.is_read && typeof onMarkRead === 'function') {
      onMarkRead(selectedAnnouncement.id);
    }
  }, [selectedAnnouncement, onMarkRead]);

  const activeItem = useMemo(() => {
    if (directNotification) {
      return {
        id: directNotification.announcementId || 'direct',
        title: directNotification.title || 'إشعار من نظام أساس',
        content: directNotification.fullBody || directNotification.body || '',
        priority: directNotification.priority || 'normal',
        sender_name: directNotification.senderName || 'إدارة نظام أساس',
        created_at: directNotification.createdAt || new Date().toISOString(),
        isDirect: true
      };
    }
    return selectedAnnouncement;
  }, [directNotification, selectedAnnouncement]);

  const activeIndex = useMemo(() => {
    if (!selectedAnnouncement) return -1;
    return filteredAnnouncements.findIndex(a => String(a.id) === String(selectedAnnouncement.id));
  }, [filteredAnnouncements, selectedAnnouncement]);

  const handleOpenItem = (a) => {
    if (typeof onClearDirectNotification === 'function') onClearDirectNotification();
    setSelectedId(a.id);
    setCopied(false);
    if (!a.is_read && typeof onMarkRead === 'function') {
      onMarkRead(a.id);
    }
  };

  const handleBackToList = () => {
    if (typeof onClearDirectNotification === 'function') onClearDirectNotification();
    setSelectedId(null);
    setCopied(false);
  };

  const handleCopyFullMessage = async (item) => {
    if (!item) return;
    const textToCopy = `${item.title}\n\n${item.content}\n\n— ${item.sender_name || 'الإدارة'}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      }
    } catch (_) {}
  };

  const handleCloseModal = () => {
    if (typeof onMarkAllRead === 'function' && unreadList.length > 0) {
      onMarkAllRead();
    }
    onClose();
  };

  const activeMeta = activeItem ? getNotificationPriorityMeta(activeItem.priority) : null;
  const activeParagraphs = useMemo(
    () => (activeItem ? splitNotificationParagraphs(activeItem.content) : []),
    [activeItem]
  );

  return (
    <Modal
      wide
      title={
        <div className="asas-modal-title-row">
          <Icon name={activeItem ? activeMeta.icon : 'bell'} style={{ color: 'var(--accent)' }} />
          <Swash>{activeItem ? 'تفاصيل الإشعار' : 'الإشعارات والتعميمات'}</Swash>
        </div>
      }
      onClose={handleCloseModal}
      footer={
        activeItem ? (
          <div className="asas-modal-footer-bar">
            <Button variant="ghost" size="sm" icon="chevronRight" onClick={handleBackToList}>
              القائمة
            </Button>
            <div className="asas-modal-footer-bar__group">
              <Button
                variant="glass"
                size="sm"
                icon={copied ? 'checkCircle' : 'file'}
                onClick={() => handleCopyFullMessage(activeItem)}
              >
                {copied ? 'تم النسخ' : 'نسخ النص'}
              </Button>
              <Button variant="primary" size="sm" icon="check" onClick={handleCloseModal}>
                تم الاطلاع
              </Button>
            </div>
          </div>
        ) : (
          <div className="asas-modal-footer-bar">
            <span className="subtle asas-notif-footer-hint">
              {announcements.length > 0
                ? `${formatNumber(announcements.length)} إشعار رسمي · اضغط لعرض الرسالة كاملة`
                : 'مركز الإشعارات الرسمية'}
            </span>
            <div className="asas-modal-footer-bar__group">
              {unreadList.length > 0 && typeof onMarkAllRead === 'function' && (
                <Button variant="glass" size="sm" icon="checkCircle" onClick={onMarkAllRead}>
                  قراءة الكل
                </Button>
              )}
              <Button variant="primary" size="sm" icon="check" onClick={handleCloseModal}>
                إغلاق
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="asas-notif-center">
        {activeItem ? (
          /* ─── Full-Message Reader View ─── */
          <>
            <div className="asas-notif-reader-nav">
              <Button variant="ghost" size="sm" icon="chevronRight" onClick={handleBackToList}>
                العودة للإشعارات
              </Button>
              <span className={`pill ${activeMeta.pillClass}`}>
                <Icon name={activeMeta.icon} />
                {activeMeta.label}
              </span>
            </div>

            <Glass className={`asas-notif-reader ${activeMeta.cls}`}>
              <div className="asas-notif-reader__meta">
                <div className="asas-notif-reader__sender">
                  <Avatar name={activeItem.sender_name || 'الموارد البشرية'} size={40} />
                  <div className="asas-notif-reader__sender-info">
                    <span className="asas-notif-reader__sender-name">
                      {activeItem.sender_name || 'الموارد البشرية'}
                    </span>
                    <span className="asas-notif-reader__time">
                      <time className="num">{date(activeItem.created_at)}</time>
                      {' · '}
                      <time className="num">{time(activeItem.created_at)}</time>
                    </span>
                  </div>
                </div>
                {!activeItem.isDirect && (
                  <span className="pill pill--paid">
                    <Icon name="checkCircle" />
                    مقروء
                  </span>
                )}
              </div>

              <h2 className="asas-notif-reader__title">
                {normalizeNotificationPreview(activeItem.title)}
              </h2>

              <div className="prose asas-notif-full-body" dir="rtl">
                {activeParagraphs.length > 0 ? (
                  activeParagraphs.map((para, idx) => (
                    <p key={idx} className="asas-notif-p">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="asas-notif-p">{activeItem.content}</p>
                )}
              </div>

              <div className="asas-notif-reader__actions">
                {!activeItem.isDirect && filteredAnnouncements.length > 1 && activeIndex >= 0 ? (
                  <div className="asas-notif-pager">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="chevronRight"
                      disabled={activeIndex <= 0}
                      onClick={() => handleOpenItem(filteredAnnouncements[activeIndex - 1])}
                    >
                      السابق
                    </Button>
                    <span className="subtle num asas-notif-pager__count">
                      {formatNumber(activeIndex + 1)} / {formatNumber(filteredAnnouncements.length)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="chevronLeft"
                      disabled={activeIndex >= filteredAnnouncements.length - 1}
                      onClick={() => handleOpenItem(filteredAnnouncements[activeIndex + 1])}
                    >
                      التالي
                    </Button>
                  </div>
                ) : (
                  <span className="subtle">الرسالة الكاملة</span>
                )}

                {canManage && !activeItem.isDirect && (
                  <div className="cluster" style={{ gap: 6 }}>
                    {onEdit && (
                      <Button variant="ghost" size="sm" icon="edit" onClick={() => onEdit(activeItem)}>
                        تعديل
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon="trash"
                        onClick={async () => {
                          await onDelete(activeItem.id);
                          handleBackToList();
                        }}
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Glass>
          </>
        ) : (
          /* ─── Notification List View ─── */
          <>
            {announcements.length > 0 && (
              <div className="asas-notif-toolbar">
                <Segmented
                  label="تصفية الإشعارات"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: 'الكل', count: announcements.length },
                    { value: 'unread', label: 'غير مقروء', count: unreadList.length },
                    { value: 'priority', label: 'هام وعاجل', count: priorityList.length }
                  ]}
                />
              </div>
            )}

            {filteredAnnouncements.length === 0 ? (
              <EmptyState
                icon="bell"
                title={filter === 'unread' ? 'اطلعت على جميع الإشعارات' : 'لا توجد إشعارات حالياً'}
              >
                {filter === 'unread'
                  ? 'لا توجد تعميمات غير مقروءة. اختر «الكل» للاطلاع على الأرشيف.'
                  : 'ستظهر التعميمات الإدارية والإشعارات الرسمية هنا فور نشرها.'}
              </EmptyState>
            ) : (
              <div className="list" role="list">
                {filteredAnnouncements.map(a => {
                  const meta = getNotificationPriorityMeta(a.priority);
                  const isUnread = !a.is_read;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="listitem"
                      className={`row asas-notif-row ${meta.cls} ${isUnread ? 'asas-notif-row--unread' : ''}`}
                      onClick={() => handleOpenItem(a)}
                    >
                      <div className="asas-notif-row__top">
                        <span className={`kind-icon asas-notif-row__icon ${meta.kindClass}`} aria-hidden="true">
                          <Icon name={meta.icon} />
                        </span>
                        <div className="asas-notif-row__title-block">
                          <div className="asas-notif-row__title-wrap">
                            {isUnread && <span className="asas-notif-unread-dot" aria-label="غير مقروء" />}
                            <span className="asas-notif-row__title">
                              {normalizeNotificationPreview(a.title)}
                            </span>
                          </div>
                        </div>
                        <span className={`pill ${meta.pillClass}`}>
                          <Icon name={meta.icon} />
                          {meta.label}
                        </span>
                      </div>

                      <p className="asas-notif-excerpt">
                        {normalizeNotificationPreview(a.content)}
                      </p>

                      <div className="asas-notif-row__foot">
                        <span className="asas-notif-row__meta">
                          <strong style={{ color: 'var(--text-2)' }}>{a.sender_name || 'الموارد البشرية'}</strong>
                          {' · '}
                          <time className="num">{date(a.created_at)}</time>
                        </span>
                        <span className="asas-notif-cta">
                          <span>عرض كامل</span>
                          <Icon name="chevronLeft" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// Install App Modal (PWA Download for Mobile & Desktop)
function InstallAppModal({ onClose, installPrompt }) {
  const [platform, setPlatform] = useState(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
      if (/Android/i.test(ua)) return 'android';
    }
    return 'android';
  });

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://attendance.ai-asaas.com';

  return (
    <div className="asas-modal-backdrop" onClick={onClose}>
      <section className="asas-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="asas-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="download" style={{ width: 22, height: 22, color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>تحميل وتثبيت تطبيق أساس المعتمد</h2>
          </div>
          <button className="asas-btn sm" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" />
          </button>
        </div>

        <div className="asas-modal-body" style={{ textAlign: 'center' }}>
          {/* App Brand Icon with Glow */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src="/icon-512.png"
              alt="تطبيق أساس للحضور"
              style={{
                width: 80,
                height: 80,
                borderRadius: 22,
                boxShadow: '0 8px 24px rgba(186, 149, 85, 0.45)'
              }}
            />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>
                تطبيق أساس للحضور الذكي
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                تطبيق الويب التقدمي (PWA) الخفيف والمحمي · بدون إعلانات ولا يستهلك البطارية
              </p>
            </div>
          </div>

          {/* Quick 1-Click Install Button if supported by browser */}
          {installPrompt && (
            <div style={{ marginBottom: 18 }}>
              <button
                className="asas-btn primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: 15 }}
                onClick={() => {
                  installPrompt.prompt();
                  onClose();
                }}
              >
                <Icon name="download" />
                تثبيت التطبيق على هذا الجهاز الآن
              </button>
            </div>
          )}

          {/* QR Code for scanning from desktop */}
          <div style={{ background: 'var(--glass-tint)', border: '1px solid var(--hairline)', borderRadius: 16, padding: 16, marginBottom: 18 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', margin: '0 0 10px' }}>
              امسح الكود بكاميرا الجوال للفتح والتثبيت المباشر:
            </p>
            <div style={{ background: '#ffffff', padding: 10, borderRadius: 12, display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <QRCodeSVG value={appUrl} size={150} level="M" includeMargin />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '8px 0 0' }}>
              الرابط المعتمد: {appUrl}
            </p>
          </div>

          {/* Step-by-step instructions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
            <button
              className={`asas-btn sm ${platform === 'android' ? 'primary' : ''}`}
              onClick={() => setPlatform('android')}
            >
              <Icon name="smartphone" />
              أجهزة أندرويد (Android)
            </button>
            <button
              className={`asas-btn sm ${platform === 'ios' ? 'primary' : ''}`}
              onClick={() => setPlatform('ios')}
            >
              <Icon name="smartphone" />
              أجهزة آبل (iPhone / iPad)
            </button>
          </div>

          <div style={{ textAlign: 'right', background: 'var(--glass-tint-strong)', borderRadius: 12, padding: '12px 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)' }}>
            {platform === 'android' ? (
              <ol style={{ margin: 0, paddingRight: 20 }}>
                <li>افتح الموقع عبر متصفح <strong>Google Chrome</strong> على جوالك.</li>
                <li>اضغط على زر القائمة الثلاثي <strong>(⋮)</strong> في الزاوية العلوية.</li>
                <li>اختر <strong>«تثبيت التطبيق»</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</li>
                <li>ستظهر أيقونة التطبيق الذهبية المعتمدة فوراً على شاشة هاتفك.</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingRight: 20 }}>
                <li>افتح الموقع عبر متصفح <strong>Safari</strong> على جهاز الآيفون.</li>
                <li>اضغط على زر المشاركة في أسفل الشاشة <strong>(Share / ⎋)</strong>.</li>
                <li>مرر للأسفل واضغط على <strong>«إضافة إلى الشاشة الرئيسية (Add to Home Screen)»</strong>.</li>
                <li>اضغط <strong>«إضافة (Add)»</strong> في الأعلى لتثبيته كتطبيق مستقل.</li>
              </ol>
            )}
          </div>
        </div>

        <div className="asas-modal-footer">
          <button className="asas-btn primary" onClick={onClose}>
            <Icon name="check" />
            فهمت، إغلاق
          </button>
        </div>
      </section>
    </div>
  );
}

// Download High-Resolution QR PNG Image (1200x1200px)
function downloadQrPng(svgId, fileName) {
  if (typeof document === 'undefined') return;
  const svg = document.getElementById(svgId);
  if (!svg) return;
  try {
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 1200;
      canvas.height = 1200;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1200, 1200);
      ctx.drawImage(img, 60, 60, 1080, 1080);
      const a = document.createElement('a');
      a.download = `${fileName || 'QR-Code'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  } catch (err) {
    console.error('Error generating PNG from SVG:', err);
  }
}

// A4 Official QR Poster Modal (منظومة أساس السيادية)
function PrintPosterModal({ qr, branchName, initialMode = 'both', onClose }) {
  const [printMode, setPrintMode] = useState(initialMode || 'both');

  function handlePrint() {
    window.print();
  }

  const fixUrl = (u) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://attendance.ai-asaas.com';
    if (!u) return `${origin}`;
    try {
      const p = new URL(u, origin);
      return `${origin}${p.search}${p.hash}`;
    } catch (e) {
      return `${origin}`;
    }
  };

  const enterUrl = fixUrl(qr?.enter?.url || qr?.url);
  const exitUrl = fixUrl(qr?.exit?.url || qr?.url);
  const effectiveBranch = qr?.branch || branchName || 'المقر الرئيسي';
  const currentDate = new Intl.DateTimeFormat('ar-YE', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Aden' }).format(new Date());

  return (
    <div className="asas-modal-backdrop asas-print-mode" onClick={onClose}>
      <section
        className={`asas-modal asas-a4-preview-modal ${printMode !== 'both' ? 'is-single' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="معاينة وطباعة ملصق A4"
        onClick={e => e.stopPropagation()}
      >
        <div className="asas-modal-head">
          <div className="asas-modal-title-row">
            <Icon name="printer" style={{ color: 'var(--accent)' }} />
            <div style={{ minWidth: 0 }}>
              <h2 className="asas-a4-modal-title"><Swash>معاينة وطباعة ملصق A4</Swash></h2>
              <p className="subtle asas-a4-modal-sub">ملصق رسمي جاهز للطباعة (A4 Portrait)</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="close" label="إغلاق" onClick={onClose} />
        </div>

        <div className="asas-print-controls">
          <div className="asas-notif-toolbar">
            <Segmented
              label="تنسيق ورقة الطباعة"
              value={printMode}
              onChange={setPrintMode}
              options={[
                { value: 'both', label: 'مزدوج' },
                { value: 'enter', label: 'الدخول فقط' },
                { value: 'exit', label: 'الخروج فقط' }
              ]}
            />
          </div>
        </div>

        <div className="asas-a4-preview-scroll">
          {/* PRINTABLE AREA */}
          <div className="asas-printable-area" id="asas-a4-printable">
            <div className="asas-a4-sheet">
              <div className="asas-a4-border">
                {/* Official Ruled Header */}
                <div className="asas-a4-header">
                  <div className="asas-a4-logo-row">
                    <div className="asas-a4-logo-brand">
                      <p className="asas-a4-brand-title">مَنظُومَة أَسَاس السِّيَادِيَّة</p>
                      <p className="asas-a4-subtitle">AI-ASAAS SOVEREIGN ATTENDANCE SYSTEM</p>
                    </div>
                    <div className="asas-a4-logo-stamp">
                      <div>وثيقة اعتماد المقر الرسمية</div>
                      <div dir="ltr" style={{ color: '#8c6928', fontWeight: 700 }}>VERIFIED-SOVEREIGN-QR</div>
                    </div>
                  </div>

                  <div className="asas-a4-branch-badge">
                    {effectiveBranch}
                  </div>
                  <div className="asas-a4-meta-line">
                    رمز الاستجابة السريعة المعتمد لإثبات الحضور والانصراف اللحظي المقيد جغرافياً · <span className="num">{currentDate}</span>
                  </div>
                </div>

                {/* Body Codes Grid */}
                <div className={`asas-a4-codes-grid ${printMode !== 'both' ? 'single' : ''}`}>
                  {(printMode === 'both' || printMode === 'enter') && (
                    <div className="asas-a4-code-card enter">
                      <div className="asas-a4-code-title enter">
                        تسجيل الحضور (دخول)
                      </div>
                      <div className="asas-a4-qr-frame">
                        <QRCodeSVG value={enterUrl} size={240} level="M" includeMargin />
                      </div>
                      <div className="asas-a4-code-desc">
                        يُعلق عند المدخل الرئيسي للمقر · مخصص حصرياً لتسجيل الدخول والبدء
                      </div>
                      <ol className="asas-a4-steps-list">
                        <li>افتح كاميرا هاتفك وامسح الرمز أعلاه.</li>
                        <li>تأكد من تفعيل خدمة الموقع الجغرافي (GPS).</li>
                        <li>اضغط على زر «تسجيل الحضور الآن» لتأكيد حضورك فوراً.</li>
                      </ol>
                    </div>
                  )}

                  {(printMode === 'both' || printMode === 'exit') && (
                    <div className="asas-a4-code-card exit">
                      <div className="asas-a4-code-title exit">
                        تسجيل الانصراف (خروج)
                      </div>
                      <div className="asas-a4-qr-frame">
                        <QRCodeSVG value={exitUrl} size={240} level="M" includeMargin />
                      </div>
                      <div className="asas-a4-code-desc">
                        يُعلق عند المخرج · مخصص حصرياً لتسجيل الانصراف وإنهاء الدوام
                      </div>
                      <ol className="asas-a4-steps-list">
                        <li>افتح كاميرا هاتفك وامسح الرمز أعلاه.</li>
                        <li>تأكد من تفعيل خدمة الموقع الجغرافي (GPS).</li>
                        <li>اضغط على زر «تسجيل الانصراف وإنهاء الدوام».</li>
                      </ol>
                    </div>
                  )}
                </div>

                {/* Official Footer */}
                <div className="asas-a4-footer">
                  <div className="asas-a4-security-notice">
                    تنبيه أمني: هذا الرمز محمي بتشفير HMAC-SHA256 السيادي ومقيد بالنطاق الجغرافي المصرح به وبأجهزة الموظفين المسجلة. أي محاولة لمشاركة الرمز أو تصويره من خارج المقر سيتم رصدها وإلغاؤها تلقائياً.
                  </div>
                  <div className="asas-a4-footer-bottom">
                    <span>منظومة أساس لإدارة وحوكمة الموارد البشرية</span>
                    <span dir="ltr">attendance.ai-asaas.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="asas-modal-footer asas-a4-footer-actions">
          <Button variant="ghost" size="sm" onClick={onClose}>إغلاق</Button>
          <Button variant="primary" size="sm" icon="printer" onClick={handlePrint}>
            طباعة الملصق الآن (A4)
          </Button>
        </div>
      </section>
    </div>
  );
}

// Profile & Security Modal
function ProfileModal({ user, onClose, onUpdated }) {
  const isImageAvatar = user?.avatar && (user.avatar.startsWith('data:image/') || user.avatar.startsWith('http') || user.avatar.startsWith('/'));
  const [avatar, setAvatar] = useState(isImageAvatar ? '' : (user?.avatar === 'neutral' ? 'man' : (user?.avatar || 'man')));
  const [customImage, setCustomImage] = useState(isImageAvatar ? user.avatar : '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErr('يرجى اختيار ملف صورة صالح (PNG, JPG, WebP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErr('حجم الصورة كبير جداً؛ الحد الأقصى 5 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCustomImage(compressedUrl);
        setAvatar('');
        setErr('');
      };
      img.onerror = () => {
        setCustomImage(dataUrl);
        setAvatar('');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');

    if (newPassword) {
      if (newPassword.length < 6) {
        setBusy(false);
        return setErr('كلمة المرور يجب ألا تقل عن 6 خانات أو أحرف');
      }
      if (newPassword !== confirmPassword) {
        setBusy(false);
        return setErr('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      }
    }

    try {
      const finalAvatar = customImage || avatar || 'man';
      const res = await api('/auth/profile', 'PUT', {
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
        avatar: finalAvatar,
        phone: phone || undefined
      });

      const updatedUser = { ...user, avatar: finalAvatar, phone };
      if (typeof window !== 'undefined') {
        localStorage.setItem('asas_account', JSON.stringify(updatedUser));
      }
      onUpdated(updatedUser);
      setMsg(res?.message || 'تم تحديث الملف الشخصي بنجاح');
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="asas-modal-backdrop" onClick={onClose}>
      <section className="asas-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="asas-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="key" style={{ width: 20, height: 20, color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>الملف الشخصي والأمان</h2>
          </div>
          <button className="asas-btn sm" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={submit} className="asas-modal-body">
          {msg && <div className="asas-notice" style={{ marginBottom: 12 }}>{msg}</div>}
          {err && <div className="asas-notice error" style={{ marginBottom: 12 }}>{err}</div>}

          {/* Photo Upload & Avatar Choice */}
          <div style={{ marginBottom: 18 }}>
            <label className="asas-label" style={{ marginBottom: 10 }}>الصورة الشخصية والمظهر:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid var(--accent)',
                boxShadow: 'var(--glass-shadow)',
                display: 'grid',
                placeItems: 'center',
                background: customImage ? undefined : (AVATAR_PRESETS.find(p => p.id === avatar)?.bg || 'var(--accent-fill)'),
                color: customImage ? undefined : (AVATAR_PRESETS.find(p => p.id === avatar)?.fg || 'var(--on-accent)'),
                flexShrink: 0
              }}>
                {customImage ? (
                  <img src={customImage} alt="معاينة الصورة" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Icon name={AVATAR_PRESETS.find(p => p.id === avatar)?.icon || 'user'} style={{ width: 32, height: 32 }} />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="asas-btn primary sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                  <Icon name="camera" style={{ width: 14, height: 14 }} />
                  رفع صورتك من جهازك
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </label>
                {customImage && (
                  <button
                    type="button"
                    className="asas-btn sm"
                    style={{ fontSize: 11, padding: '2px 8px', height: 26, color: 'var(--unpaid)', alignSelf: 'flex-start' }}
                    onClick={() => { setCustomImage(''); setAvatar('man'); }}
                  >
                    حذف الصورة المرفوعة والعودة للافتار
                  </button>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  صيغ الصور المعتمدة: PNG, JPG, JPEG, WebP, SVG
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                أو اختر الأفاتار المعتمد (رجل / امرأة):
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                {AVATAR_PRESETS.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    className={`asas-avatar-choice ${avatar === p.id && !customImage ? 'selected' : ''}`}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: (avatar === p.id && !customImage) ? '2px solid var(--accent)' : '1px solid var(--hairline)',
                      background: (avatar === p.id && !customImage) ? 'var(--glass-tint-strong)' : 'var(--glass-inset)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer'
                    }}
                    onClick={() => { setAvatar(p.id); setCustomImage(''); }}
                  >
                    <Icon name={p.icon} style={{ width: 20, height: 20, color: 'var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field
              label="رقم الهاتف / الجوال"
              type="tel"
              placeholder="+967 77xxxxxxx"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="key" style={{ width: 16, height: 16, color: 'var(--accent)' }} />
              إعداد وتغيير كلمة المرور
            </div>
            <p className="asas-muted" style={{ fontSize: 11.5, marginBottom: 10 }}>
              يمكنك كتابة كلمة مرور قوية من 6 أحرف أو أرقام أو رموز على الأقل. اترك الحقول فارغة إذا لم ترغب بتغييرها.
            </p>
            <div style={{ position: 'relative' }}>
              <Field
                label="كلمة المرور الحالية (مطلوبة لتأكيد التغيير إذا كان حسابك يحمل كلمة مرور سابقة)"
                type={showCurrentPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="أدخل كلمة المرور الحالية"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
              {currentPassword && (
                <button
                  type="button"
                  style={{ position: 'absolute', left: 10, top: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  title={showCurrentPass ? 'إخفاء' : 'إظهار'}
                >
                  <Icon name={showCurrentPass ? 'eyeOff' : 'eye'} width={16} height={16} />
                </button>
              )}
            </div>
            <div className="asas-form-grid" style={{ marginTop: 10 }}>
              <div style={{ position: 'relative' }}>
                <Field
                  label="كلمة المرور الجديدة (6 خانات على الأقل)"
                  type={showNewPass ? 'text' : 'password'}
                  placeholder="أدخل كلمة المرور الجديدة"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                {newPassword && (
                  <button
                    type="button"
                    style={{ position: 'absolute', left: 10, top: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                    onClick={() => setShowNewPass(!showNewPass)}
                    title={showNewPass ? 'إخفاء' : 'إظهار'}
                  >
                    <Icon name={showNewPass ? 'eyeOff' : 'eye'} width={16} height={16} />
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Field
                  label="تأكيد كلمة المرور الجديدة"
                  type={showConfirmPass ? 'text' : 'password'}
                  placeholder="أعد إدخال كلمة المرور للتأكيد"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                {confirmPassword && (
                  <button
                    type="button"
                    style={{ position: 'absolute', left: 10, top: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    title={showConfirmPass ? 'إخفاء' : 'إظهار'}
                  >
                    <Icon name={showConfirmPass ? 'eyeOff' : 'eye'} width={16} height={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="asas-modal-footer">
          <button className="asas-btn" type="button" onClick={onClose}>إلغاء</button>
          <button className="asas-btn primary" type="button" onClick={submit} disabled={busy}>
            <Icon name="check" />
            {busy ? 'جارٍ الحفظ…' : 'حفظ التحديثات'}
          </button>
        </div>
      </section>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="asas-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
          <Glass style={{ maxWidth: 500, width: '100%', padding: 28, textAlign: 'center' }}>
            <Brand />
            <h2 style={{ color: 'var(--unpaid)', marginTop: 16 }}>حدث خطأ أثناء عرض الصفحة</h2>
            <p className="asas-muted" style={{ marginTop: 8 }}>
              {this.state.error?.message || 'تعذر استكمال العرض. تم تسجيل الخطأ لحمايتك.'}
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="asas-btn primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                <Icon name="refresh" />
                إعادة تحميل الصفحة
              </button>
            </div>
          </Glass>
        </div>
      );
    }
    return this.props.children;
  }
}

function AsasAppInner({ defaultAction = 'auto', isRemoteMode = false }) {
  const [theme, toggleTheme] = useTheme();
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('asas_account');
        return saved ? JSON.parse(saved) : null;
      } catch (_) {}
    }
    return null;
  });
  const [boot, setBoot] = useState(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('asas_token');
      if (!token) return false;
    }
    return true;
  });
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    const media = window.matchMedia('(max-width: 900px)');
    const onChange = () => {
      if (!media.matches) setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onChange);
    };
  }, [sidebarOpen]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [branches, setBranches] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [qr, setQr] = useState(null);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [accountPage, setAccountPage] = useState(1);
  const [accountPageSize, setAccountPageSize] = useState(10);
  const [accountViewMode, setAccountViewMode] = useState('auto');
  const [collectiveViewMode, setCollectiveViewMode] = useState('auto');
  const [dashboardViewMode, setDashboardViewMode] = useState('auto');
  const [liveRecordsViewMode, setLiveRecordsViewMode] = useState('auto');
  const [selectedAccountDetails, setSelectedAccountDetails] = useState(null);
  const [recordFilter, setRecordFilter] = useState('all');
  const [recordsTabMode, setRecordsTabMode] = useState('collective');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [collectiveData, setCollectiveData] = useState(null);
  const [individualData, setIndividualData] = useState(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [activePreset, setActivePreset] = useState('today');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    try {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date());
      return Number(d.split('-')[1]);
    } catch (_) { return new Date().getMonth() + 1; }
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    try {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date());
      return Number(d.split('-')[0]);
    } catch (_) { return new Date().getFullYear(); }
  });
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState(null);
  const [directPushNotification, setDirectPushNotification] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newCustomPerm, setNewCustomPerm] = useState('');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDutyReminderModal, setShowDutyReminderModal] = useState(false);
  const [triggeringReminder, setTriggeringReminder] = useState(false);
  const [reminderTarget, setReminderTarget] = useState('inside');
  const [selectedReminderEmployee, setSelectedReminderEmployee] = useState(null);
  const [reminderCustomNote, setReminderCustomNote] = useState('');
  const [dutyLiveStats, setDutyLiveStats] = useState({ inside: 0, total: 0, present: 0 });
  const [savingReminderPolicy, setSavingReminderPolicy] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [installPrompt, setInstallPrompt] = useState(null);

  const unreadAnnouncementsCount = useMemo(() => {
    return announcements.filter(a => !a.is_read).length;
  }, [announcements]);

  const markAnnouncementAsRead = useCallback(async (annId) => {
    if (!annId) return;
    setAnnouncements(prev => prev.map(a => (String(a.id) === String(annId) ? { ...a, is_read: true } : a)));
    try {
      await api('/announcements/mark-read', 'POST', { id: annId });
    } catch (_) {}
  }, []);

  const markAnnouncementsAsRead = useCallback(async () => {
    setAnnouncements(prev => prev.map(a => ({ ...a, is_read: true })));
    try {
      await api('/announcements/mark-read', 'POST', { all: true });
    } catch (_) {}
  }, []);

  const openAnnouncementsCenter = useCallback((annId = null) => {
    setDirectPushNotification(null);
    setSelectedAnnouncementId(annId);
    setShowAnnouncementsModal(true);
    if (annId != null) {
      markAnnouncementAsRead(annId);
    }
  }, [markAnnouncementAsRead]);

  const openNotificationPayload = useCallback((payload) => {
    if (!payload) return;
    if (payload.announcementId) {
      setDirectPushNotification(null);
      setSelectedAnnouncementId(payload.announcementId);
      setShowAnnouncementsModal(true);
      markAnnouncementAsRead(payload.announcementId);
      return;
    }
    if (payload.fullBody || payload.body) {
      setSelectedAnnouncementId(null);
      setDirectPushNotification({
        title: payload.title || 'إشعار من نظام أساس',
        fullBody: payload.fullBody || payload.body,
        body: payload.body || payload.fullBody,
        priority: payload.priority || (payload.type === 'duty_reminder' ? 'important' : 'normal'),
        senderName: payload.senderName || 'إدارة نظام أساس',
        createdAt: payload.createdAt || new Date().toISOString(),
        type: payload.type || 'general'
      });
      setShowAnnouncementsModal(true);
    }
  }, [markAnnouncementAsRead]);

  // Listen for OS / Phone Push Notification clicks (Service Worker & in-app browser notifications)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSwMessage = (event) => {
      if (event?.data?.type === 'ASAS_OPEN_NOTIFICATION' && event.data.payload) {
        openNotificationPayload(event.data.payload);
      }
    };
    const onCustomNotif = (event) => {
      if (event?.detail) {
        openNotificationPayload(event.detail);
      }
    };
    window.addEventListener('asas:open-notification', onCustomNotif);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }
    return () => {
      window.removeEventListener('asas:open-notification', onCustomNotif);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, [openNotificationPayload]);

  // Handle deep-link query params when opening app from a closed-app phone push notification
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const openAnnId = params.get('open_announcement');
      if (openAnnId && announcements.length > 0) {
        const match = announcements.find(a => String(a.id) === String(openAnnId));
        openAnnouncementsCenter(match ? match.id : null);
        params.delete('open_announcement');
        const nextUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash;
        window.history.replaceState({}, '', nextUrl);
      } else if (window.location.hash === '#announcements' && announcements.length > 0) {
        openAnnouncementsCenter(null);
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
    } catch (_) {}
  }, [user, announcements, openAnnouncementsCenter]);

  const handleTriggerManualReminder = async () => {
    setTriggeringReminder(true);
    try {
      const payload = {
        target: reminderTarget,
        employee_id: reminderTarget === 'employee' ? selectedReminderEmployee?.id : undefined,
        custom_note: reminderCustomNote.trim() || undefined
      };
      const res = await api('/admin/remind-duty', 'POST', payload);
      playChime('success');
      setNotice(res?.message || 'تم إرسال تذكير الدوام بنجاح');
      api('/admin/dashboard').then(dash => {
        if (dash) setDutyLiveStats({ inside: dash.inside || 0, total: dash.total || 0, present: dash.present || 0 });
      }).catch(() => {});
      load(false);
      setShowDutyReminderModal(false);
      setReminderCustomNote('');
    } catch (err) {
      setError(err?.message || 'تعذر إرسال تذكير الدوام');
    } finally {
      setTriggeringReminder(false);
    }
  };

  const handleSaveReminderPolicy = async (customConfig = null) => {
    setSavingReminderPolicy(true);
    try {
      const payload = {
        duty_reminder_enabled: customConfig?.duty_reminder_enabled !== undefined
          ? customConfig.duty_reminder_enabled
          : (systemSettings.duty_reminder_enabled !== false),
        duty_reminder_interval_hours: Number(
          customConfig?.duty_reminder_interval_hours || systemSettings.duty_reminder_interval_hours || 2
        ),
        email_notifications: customConfig?.email_notifications !== undefined
          ? customConfig.email_notifications
          : Boolean(systemSettings.email_notifications)
      };
      await api('/admin/settings', 'PUT', payload);
      playChime('success');
      setNotice('تم حفظ وتطبيق سياسة تذكير الدوام بنجاح');
      const fresh = await api('/admin/settings');
      if (fresh) setSystemSettings(fresh);
    } catch (err) {
      setError(err?.message || 'تعذر حفظ إعدادات تذكير الدوام');
    } finally {
      setSavingReminderPolicy(false);
    }
  };

  const handleOpenDirectReminder = useCallback((emp) => {
    if (!emp) return;
    const empId = emp.id || emp.employee_id;
    setSelectedReminderEmployee({ id: empId, name: emp.name, identifier: emp.identifier });
    setReminderTarget('employee');
    setReminderCustomNote('');
    setShowDutyReminderModal(true);
  }, []);

  useEffect(() => {
    if (showDutyReminderModal && allEmployees.length === 0) {
      api('/admin/accounts').then(res => {
        if (Array.isArray(res)) setAllEmployees(res.filter(a => a.role === 'employee' && a.active !== false));
      }).catch(() => {});
    }
  }, [showDutyReminderModal, allEmployees.length]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration note:', err?.message);
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        registerWebPushSubscription().catch(() => {});
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const [systemSettings, setSystemSettings] = useState({
    company_name: 'شركة أساس الذكاء الاصطناعي (AI-ASAAS)',
    timezone: 'Asia/Aden',
    max_gps_accuracy: 250,
    email_notifications: false,
    duty_reminder_enabled: true,
    duty_reminder_interval_hours: 2,
    support_contact: '+967 770000000',
    assistant_enabled: true,
    assistant_daily_quota_employee: 20,
    assistant_daily_quota_admin: 100,
    assistant_strict_topic: true,
    assistant_max_chars: 800,
    assistant_api_url: 'https://api.llm7.io/v1/chat/completions',
    assistant_model: 'mistral-Nemo-Instruct-2407',
    assistant_provider_name: 'LLM7 Free AI'
  });
  const [assistantPolicyForm, setAssistantPolicyForm] = useState({
    enabled: true,
    daily_limit: '',
    allow_hours_info: true,
    allow_leave_info: true,
    allow_team_data: false,
    allow_general_help: true,
    strict_topic_only: true,
    blocked_keywords: '',
    custom_note: ''
  });

  const can = p => user?.role === 'super_admin' || user?.permissions?.includes(p);

  const checkAuth = useCallback(async (isManual = false) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('asas_token');
      if (!token) {
        setUser(null);
        setBoot(false);
        if (isManual) setBusy(false);
        return;
      }
    }
    if (isManual) setBusy(true);
    try {
      const u = await api('/auth/me', 'GET', undefined, 1);
      setUser(u);
      if (typeof window !== 'undefined') localStorage.setItem('asas_account', JSON.stringify(u));
      setError('');
    } catch (e) {
      if (e.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('asas_token');
          localStorage.removeItem('asas_account');
        }
        setUser(null);
        setError('');
      } else {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('asas_account');
          if (cached) {
            try { setUser(JSON.parse(cached)); } catch (_) {}
          }
        }
        if (isManual) {
          setError('تعذر الاتصال بالخادم. تحقق من تشغيل خدمة أساس وقاعدة البيانات.');
        }
      }
    } finally {
      setBoot(false);
      if (isManual) setBusy(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load Announcements for everyone
  const loadAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api('/announcements');
      if (Array.isArray(list)) setAnnouncements(list);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const loadEmployeeDossier = useCallback(async (empId, f = from, t = to) => {
    if (!empId) return;
    try {
      const res = await api(`/admin/reports/employee/${empId}?from=${f}&to=${t}`);
      setIndividualData(res);
    } catch (err) {
      console.error('Failed to load employee dossier:', err);
    }
  }, [from, to]);

  const load = useCallback(async (showBusy = false) => {
    if (!user || user.role === 'employee') return;
    if (showBusy) setBusy(true);
    setError('');
    try {
      if (tab === 'records') {
        const [rawResult, summaryResult] = await Promise.all([
          api(`/admin/records?from=${from}&to=${to}`),
          api(`/admin/reports/summary?from=${from}&to=${to}`).catch(() => null)
        ]);
        setData(rawResult);
        if (summaryResult) {
          setCollectiveData(summaryResult);
          if (summaryResult.employees && summaryResult.employees.length > 0) {
            setSelectedEmployeeId(prev => {
              if (prev && summaryResult.employees.some(e => String(e.id) === String(prev))) {
                return prev;
              }
              return String(summaryResult.employees[0].id);
            });
          }
        }
      } else {
        const path = tab === 'qr' ? '/admin/branches'
          : tab === 'leave' ? '/leave'
          : tab === 'settings' ? '/admin/settings'
          : tab === 'announcements' ? '/announcements'
          : `/admin/${tab}`;
        const result = await api(path);
        setData(result);
        if (tab === 'branches' || tab === 'qr') {
          setBranches(result);
          if (tab === 'qr' && Array.isArray(result)) {
            const activeBranches = result.filter(b => b.active);
            if (activeBranches.length > 0) {
              const targetId = activeBranches.some(b => String(b.id) === String(branchId))
                ? String(branchId)
                : String(activeBranches[0].id);
              if (targetId !== String(branchId)) setBranchId(targetId);
              api(`/admin/branches/${targetId}/qr`).then(qrRes => setQr(qrRes)).catch(() => {});
            }
          }
        }
        if (tab === 'settings' && result) setSystemSettings(result);
        if (tab === 'shifts') {
          Promise.all([
            api('/admin/settings').catch(() => null),
            api('/admin/dashboard').catch(() => null),
            allEmployees.length === 0 ? api('/admin/accounts').catch(() => null) : Promise.resolve(null)
          ]).then(([s, dash, accs]) => {
            if (s) setSystemSettings(s);
            if (dash) setDutyLiveStats({ inside: dash.inside || 0, total: dash.total || 0, present: dash.present || 0 });
            if (Array.isArray(accs)) setAllEmployees(accs.filter(a => a.role === 'employee' && a.active !== false));
          }).catch(() => {});
        }
        if (tab === 'announcements' && Array.isArray(result)) setAnnouncements(result);
      }
    } catch (e) {
      if (showBusy) {
        setData(null);
        setError(e.message);
      }
      if (e.status === 401) setUser(null);
    } finally {
      if (showBusy) setBusy(false);
    }
  }, [user, tab, from, to]);

  useEffect(() => {
    if (tab === 'records' && selectedEmployeeId) {
      loadEmployeeDossier(selectedEmployeeId, from, to);
    }
  }, [tab, selectedEmployeeId, from, to, loadEmployeeDossier]);

  const applyPreset = useCallback((presetKey) => {
    const now = new Date();
    let adenDateStr = '';
    try {
      adenDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    } catch (_) {
      adenDateStr = now.toISOString().slice(0, 10);
    }
    const [year, month, day] = adenDateStr.split('-').map(Number);

    if (presetKey === 'today') {
      setFrom(adenDateStr);
      setTo(adenDateStr);
    } else if (presetKey === 'yesterday') {
      const yDate = new Date(Date.UTC(year, month - 1, day - 1));
      const yStr = yDate.toISOString().slice(0, 10);
      setFrom(yStr);
      setTo(yStr);
    } else if (presetKey === 'this_week') {
      const curDate = new Date(Date.UTC(year, month - 1, day));
      const dow = curDate.getUTCDay();
      const daysSinceSat = (dow + 1) % 7;
      const satDate = new Date(Date.UTC(year, month - 1, day - daysSinceSat));
      const satStr = satDate.toISOString().slice(0, 10);
      setFrom(satStr);
      setTo(adenDateStr);
    } else if (presetKey === 'this_month') {
      const mStr = String(month).padStart(2, '0');
      setFrom(`${year}-${mStr}-01`);
      setTo(adenDateStr);
    } else if (presetKey === 'last_month') {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      const pmStr = String(prevMonth).padStart(2, '0');
      const ldStr = String(lastDay).padStart(2, '0');
      setFrom(`${prevYear}-${pmStr}-01`);
      setTo(`${prevYear}-${pmStr}-${ldStr}`);
    }
    setActivePreset(presetKey);
    setShowMonthYearPicker(false);
  }, []);

  const applyMonthRange = useCallback((y, m) => {
    const yr = Number(y);
    const mo = Number(m);
    const mStr = String(mo).padStart(2, '0');
    const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    const ldStr = String(lastDay).padStart(2, '0');
    setFrom(`${yr}-${mStr}-01`);
    setTo(`${yr}-${mStr}-${ldStr}`);
    setActivePreset('custom_month');
    setShowMonthYearPicker(false);
  }, []);

  useEffect(() => {
    load(true);
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load(false);
      }
    }, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => { setQr(null); }, [branchId]);

  async function logout() {
    const uid = user?.id;
    try { await api('/auth/logout', 'POST', {}); } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('asas_token');
      localStorage.removeItem('asas_account');
      if (uid) {
        try { sessionStorage.removeItem(`asaas-ui:assistant:${uid}`); } catch {}
      }
    }
    setUser(null);
  }

  async function edit(kind, item) {
    setError('');
    setNotice('');
    if (kind === 'records') {
      const isoLocal = d => d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
      setForm({
        id: item.id || null,
        employee_id: item.employee_id || item.id,
        name: item.name,
        first_in: isoLocal(item.first_in) || isoLocal(new Date()),
        last_out: isoLocal(item.last_out),
        state: item.state === 'absent' || item.state === 'leave' ? 'inside' : (item.state || 'inside'),
        exit_reason: item.exit_reason || 'admin_correction',
        deduct_away: Boolean(item.deduct_away),
        reason: item.id ? '' : 'تسجيل حضور يدوي من الإدارة'
      });
      setModal('records');
      return;
    }

    if (kind === 'accounts' && !item) {
      const accountsList = Array.isArray(data) ? data : [];
      const nextNum = accountsList.reduce((max, a) => {
        const n = parseInt(a.identifier, 10);
        return !isNaN(n) && n > max ? n : max;
      }, 0) + 1;
      const nextId = String(nextNum).padStart(3, '0');
      setForm({ ...defaults.accounts, identifier: nextId, reason: '' });
      setAssistantPolicyForm({
        enabled: true,
        daily_limit: '',
        allow_hours_info: true,
        allow_leave_info: true,
        allow_team_data: false,
        allow_general_help: true,
        strict_topic_only: true,
        blocked_keywords: '',
        custom_note: ''
      });
      setModal('accounts');
      try {
        const [b, s] = await Promise.all([api('/admin/branches'), api('/admin/shifts')]);
        setBranches(b);
        setShifts(s);
      } catch (e) { setError(e.message); }
      return;
    }

    setForm({ ...defaults[kind], ...item, reason: '' });
    setModal(kind);
    if (kind === 'accounts') {
      setAssistantPolicyForm({
        enabled: true,
        daily_limit: '',
        allow_hours_info: true,
        allow_leave_info: true,
        allow_team_data: Boolean(item?.role && item.role !== 'employee'),
        allow_general_help: true,
        strict_topic_only: true,
        blocked_keywords: '',
        custom_note: ''
      });
      try {
        const [b, s, ap] = await Promise.all([
          api('/admin/branches'),
          api('/admin/shifts'),
          item?.id ? api(`/admin/assistant/policies/${item.id}`).catch(() => null) : Promise.resolve(null)
        ]);
        setBranches(b);
        setShifts(s);
        if (ap) {
          setAssistantPolicyForm({
            enabled: ap.enabled !== false,
            daily_limit: ap.daily_limit === null || ap.daily_limit === undefined ? '' : String(ap.daily_limit),
            allow_hours_info: ap.allow_hours_info !== false,
            allow_leave_info: ap.allow_leave_info !== false,
            allow_team_data: Boolean(ap.allow_team_data),
            allow_general_help: ap.allow_general_help !== false,
            strict_topic_only: ap.strict_topic_only !== false,
            blocked_keywords: ap.blocked_keywords || '',
            custom_note: ap.custom_note || ''
          });
        }
      } catch (e) { setError(e.message); }
    }
  }

  async function deleteShift(s) {
    if (!window.confirm(`هل أنت متأكد من حذف جدول الدوام (${s.name}) نهائياً من النظام؟`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await api(`/admin/shifts/${s.id}`, 'DELETE');
      setNotice(r?.message || `تم حذف جدول الدوام (${s.name}) بنجاح`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const handleAddCustomPerm = () => {
    const val = (newCustomPerm || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!val) return;
    const current = Array.isArray(form.permissions) ? [...form.permissions] : [];
    if (!current.includes(val)) {
      set('permissions', [...current, val]);
    }
    setNewCustomPerm('');
  };

  async function approveAccount(acc) {
    if (!window.confirm(`هل أنت متأكد من قبول واعتماد حساب الموظف (${acc.name} - ${acc.identifier})؟ سيتم تفعيل حسابه فوراً ليتمكن من تسجيل الدخول والتحضير.`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api(`/admin/accounts/${acc.id}/approve`, 'POST', {
        reason: 'اعتماد وقبول الحساب من لوحة التحكم'
      });
      setNotice(res?.message || `تم اعتماد وتفعيل حساب الموظف (${acc.name}) بنجاح`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(acc) {
    const isPending = !acc.active;
    const confirmMsg = isPending
      ? `هل أنت متأكد من رفض وحذف طلب تسجيل حساب الموظف (${acc.name} - ${acc.identifier})؟`
      : `هل أنت متأكد من رغبتك في حذف حساب الموظف (${acc.name} - ${acc.identifier}) نهائياً؟ سيتم مسح بيانات الحساب وحفظ الإجراء في سجل العمليات.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await api(`/admin/accounts/${acc.id}`, 'DELETE');
      setNotice(r?.message || (isPending ? `تم رفض وحذف طلب تسجيل (${acc.name}) بنجاح` : `تم حذف حساب الموظف (${acc.name}) بنجاح`));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm('هل أنت متأكد من حذف هذا التعميم؟')) return;
    setBusy(true);
    try {
      await api(`/admin/announcements/${id}`, 'DELETE');
      setNotice('تم حذف التعميم بنجاح');
      await load();
      await loadAnnouncements();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (modal === 'records') {
        const body = {
          first_in: form.first_in ? new Date(form.first_in).toISOString() : undefined,
          last_out: form.last_out ? new Date(form.last_out).toISOString() : null,
          state: form.state,
          exit_reason: form.exit_reason,
          deduct_away: form.deduct_away,
          reason: form.reason
        };
        if (form.id) {
          await api(`/admin/records/${form.id}`, 'PATCH', body);
          setNotice('تم حفظ تصحيح الحضور وتوثيقه في سجل العمليات');
        } else {
          await api('/admin/records', 'POST', {
            employee_id: form.employee_id,
            first_in: body.first_in,
            last_out: body.last_out,
            state: body.state,
            exit_reason: body.exit_reason,
            deduct_away: body.deduct_away,
            reason: form.reason || 'تسجيل حضور يدوي من لوحة التحكم'
          });
          setNotice('تم تسجيل حضور الموظف يدوياً بنجاح وتوثيقه في النظام');
        }
        setModal(null);
        await load();
        return;
      }

      if (modal === 'announcements') {
        if (form.id) {
          await api(`/admin/announcements/${form.id}`, 'PUT', {
            title: form.title,
            content: form.content,
            priority: form.priority || 'normal',
            send_email: Boolean(form.send_email)
          });
          setNotice('تم حفظ وتعديل التعميم الرسمي بنجاح');
        } else {
          await api('/admin/announcements', 'POST', {
            title: form.title,
            content: form.content,
            priority: form.priority || 'normal',
            send_email: Boolean(form.send_email)
          });
          setNotice('تم نشر التعميم الرسمي وإرسال الإشعارات بنجاح');
        }
        setModal(null);
        await load();
        await loadAnnouncements();
        return;
      }

      const body = { ...form };
      if (modal === 'branches') {
        for (const k of ['latitude', 'longitude', 'entry_radius', 'exit_radius', 'max_accuracy', 'exit_samples', 'exit_delay_seconds']) body[k] = Number(body[k]);
      }
      if (modal === 'shifts') {
        body.grace_minutes = Number(body.grace_minutes || 0);
        body.deduct_away = Boolean(body.deduct_away);
        if (!Array.isArray(body.work_days) || !body.work_days.length) body.work_days = [0, 1, 2, 3, 4, 6];
      }
      if (modal === 'accounts') {
        body.branch_id = body.branch_id ? Number(body.branch_id) : null;
        body.shift_id = body.shift_id ? Number(body.shift_id) : null;
        if (body.id) {
          if (!body.password) delete body.password;
          delete body.bound_device_id;
          delete body.bound_device_name;
          delete body.device_bound_at;
        }
      }
      const savedRes = await api(`/admin/${modal}${body.id ? `/${body.id}` : ''}`, body.id ? (modal === 'accounts' ? 'PATCH' : 'PUT') : 'POST', body);
      if (modal === 'accounts' && can('employees.write')) {
        const targetAccountId = body.id || savedRes?.id;
        if (targetAccountId) {
          await api(`/admin/assistant/policies/${targetAccountId}`, 'PUT', {
            enabled: Boolean(assistantPolicyForm.enabled),
            daily_limit: assistantPolicyForm.daily_limit === '' ? null : Number(assistantPolicyForm.daily_limit),
            allow_hours_info: Boolean(assistantPolicyForm.allow_hours_info),
            allow_leave_info: Boolean(assistantPolicyForm.allow_leave_info),
            allow_team_data: body.role === 'employee' ? false : Boolean(assistantPolicyForm.allow_team_data),
            allow_general_help: Boolean(assistantPolicyForm.allow_general_help),
            strict_topic_only: Boolean(assistantPolicyForm.strict_topic_only),
            blocked_keywords: assistantPolicyForm.blocked_keywords || '',
            custom_note: assistantPolicyForm.custom_note || ''
          });
        }
      }
      setModal(null);
      setNotice('تم حفظ التغييرات وتوثيقها في سجل العمليات');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSystemSettings(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/admin/settings', 'PUT', systemSettings);
      setNotice('تم حفظ إعدادات النظام الحقيقية في قاعدة البيانات بنجاح');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function showQr(targetBranchId) {
    const idToLoad = targetBranchId || branchId;
    if (!idToLoad) return;
    setBusy(true);
    try {
      setQr(await api(`/admin/branches/${idToLoad}/qr`));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('asas_token') : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let url = `/api/admin/reports.csv?from=${from}&to=${to}`;
      let filename = `asas-${from}-${to}.csv`;

      if (recordsTabMode === 'individual' && selectedEmployeeId) {
        url += `&employee_id=${selectedEmployeeId}`;
        const empIdent = individualData?.employee?.identifier || selectedEmployeeId;
        filename = `asas-employee-${empIdent}-${from}-${to}.csv`;
      } else if (recordsTabMode === 'collective') {
        url += `&type=summary`;
        filename = `asas-collective-${from}-${to}.csv`;
      }

      const r = await fetch(url, { headers, credentials: 'include' });
      if (!r.ok) throw new Error('تعذر تصدير التقرير');
      const urlBlob = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(urlBlob), 1000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function exportWord() {
    setBusy(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('asas_token') : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let url = `/api/admin/reports.docx?from=${from}&to=${to}`;
      let filename = `تقرير-حضور-أساس-${from}-${to}.docx`;

      if (recordsTabMode === 'individual' && selectedEmployeeId) {
        url += `&employee_id=${selectedEmployeeId}`;
        const empName = individualData?.employee?.name || selectedEmployeeId;
        filename = `تقرير-حضور-${empName}-${from}-${to}.docx`;
      } else if (recordsTabMode === 'collective') {
        url += `&type=summary`;
        filename = `التقرير-الجماعي-أساس-${from}-${to}.docx`;
      }

      const r = await fetch(url, { headers, credentials: 'include' });
      if (!r.ok) throw new Error('تعذر تصدير تقرير Word');
      const urlBlob = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(urlBlob), 1000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function exportTxt() {
    setBusy(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('asas_token') : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let url = `/api/admin/reports.txt?from=${from}&to=${to}`;
      let filename = `تقرير-حضور-أساس-${from}-${to}.txt`;

      if (recordsTabMode === 'individual' && selectedEmployeeId) {
        url += `&employee_id=${selectedEmployeeId}`;
        const empIdent = individualData?.employee?.identifier || selectedEmployeeId;
        filename = `تقرير-موظف-${empIdent}-${from}-${to}.txt`;
      } else if (recordsTabMode === 'collective') {
        url += `&type=summary`;
        filename = `التقرير-الجماعي-أساس-${from}-${to}.txt`;
      }

      const r = await fetch(url, { headers, credentials: 'include' });
      if (!r.ok) throw new Error('تعذر تصدير التقرير النصي');
      const urlBlob = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(urlBlob), 1000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (boot) {
    return (
      <div className="asas-app" style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Ambient />
        <Glass style={{ padding: '32px 48px', textAlign: 'center' }}>
          <Brand />
          <p style={{ marginTop: 14, color: 'var(--text-2)' }}>جارٍ التحقق من الجلسة وسيادة النظام…</p>
        </Glass>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Ambient />
        <Login
          onLogin={setUser}
          initialError={error}
          onRetry={() => checkAuth(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenInstall={() => setShowInstallModal(true)}
          installPrompt={installPrompt}
          isRemoteMode={isRemoteMode}
        />
        {showInstallModal && (
          <InstallAppModal
            onClose={() => setShowInstallModal(false)}
            installPrompt={installPrompt}
          />
        )}
      </>
    );
  }

  if (user.role === 'employee') {
    return (
      <>
        <Ambient />
        <Employee
          user={user}
          logout={logout}
          announcements={announcements}
          unreadAnnouncementsCount={unreadAnnouncementsCount}
          onOpenAnnouncements={() => openAnnouncementsCenter(null)}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenInstall={() => setShowInstallModal(true)}
          installPrompt={installPrompt}
          defaultAction={defaultAction}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <AsasAssistant user={user} isAdmin={false} />
        {showAnnouncementsModal && (
          <AnnouncementsModal
            announcements={announcements}
            initialSelectedId={selectedAnnouncementId}
            directNotification={directPushNotification}
            onClearDirectNotification={() => setDirectPushNotification(null)}
            onClose={() => {
              setShowAnnouncementsModal(false);
              setSelectedAnnouncementId(null);
              setDirectPushNotification(null);
            }}
            onMarkRead={markAnnouncementAsRead}
            onMarkAllRead={markAnnouncementsAsRead}
          />
        )}
        {showProfileModal && (
          <ProfileModal
            user={user}
            onClose={() => setShowProfileModal(false)}
            onUpdated={(u) => setUser(u)}
          />
        )}
        {showInstallModal && (
          <InstallAppModal
            onClose={() => setShowInstallModal(false)}
            installPrompt={installPrompt}
          />
        )}
      </>
    );
  }

  const visibleTabs = tabs
    .filter(([key]) => key !== 'accounts' || can('employees.read'))
    .filter(([key]) => key !== 'audit' || can('audit.read'));
  const currentTabInfo = tabs.find(t => t[0] === tab);
  const title = currentTabInfo?.[1] || '';
  const rows = Array.isArray(data) ? data : [];
  const set = (k, value) => setForm(f => ({ ...f, [k]: value }));
  const selectAdminTab = (key) => {
    setTab(key);
    setSidebarOpen(false);
    setData(null);
    setNotice('');
    setSearch('');
    setAccountFilter('all');
    setAccountPage(1);
    setSelectedAccountDetails(null);
    setRecordFilter('all');
  };

  return (
    <div className="asas-app">
      <Ambient />

      {sidebarOpen && (
        <div
          className="asas-sidebar-scrim"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Single Responsive Floating Glass Sidebar (docked > 900px, slide drawer <= 900px) */}
      <Glass as="aside" thick className={`asas-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="التنقل الرئيسي">
        <div className="asas-sidebar-head">
          <Brand />
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            label="إغلاق القائمة"
            className="asas-sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
          />
        </div>

        <div className="asas-sidebar-scroll">
          <p className="asas-nav-label">مساحة الإدارة والقيادة</p>
          <nav className="asas-nav" aria-label="أقسام لوحة التحكم">
            {visibleTabs.map(([key, label, iconName]) => {
              const pendingAccountsCount = (key === 'accounts' && Array.isArray(data) && tab === 'accounts')
                ? data.filter(a => !a.active).length
                : 0;
              return (
                <button
                  type="button"
                  className="asas-nav-item"
                  aria-current={tab === key ? 'page' : undefined}
                  key={key}
                  onClick={() => selectAdminTab(key)}
                >
                  <Icon name={iconName} />
                  <span className="asas-nav-text">{label}</span>
                  {key === 'announcements' && unreadAnnouncementsCount > 0 && (
                    <span className="asas-tab-badge urgent num">{unreadAnnouncementsCount}</span>
                  )}
                  {key === 'accounts' && pendingAccountsCount > 0 && (
                    <span className="asas-tab-badge pending num">{pendingAccountsCount}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="asas-sidebar-foot">
          <div className="asas-profile" onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer' }} title="انقر لتعديل ملفك الشخصي">
            <UserAvatar user={user} size="md" />
            <div className="asas-profile-info">
              <strong>{user.name}</strong>
              <p>{roles[user.role]}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon="logout"
            style={{ width: '100%' }}
            onClick={logout}
            title="تسجيل الخروج"
          >
            خروج
          </Button>
        </div>
      </Glass>

      {/* Main Workspace */}
      <div className="asas-main">
        <div className="asas-topbar-wrap">
          <Glass as="header" thick pill className="asas-topbar">
            <div className="asas-topbar-start">
              <Button
                variant="ghost"
                size="sm"
                icon="menu"
                label="الأقسام"
                title="الأقسام"
                className="asas-menu-btn"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
              />
              <a
                href="#dashboard"
                className="brand asas-header-mobile-brand"
                onClick={(e) => { e.preventDefault(); selectAdminTab('dashboard'); }}
              >
                <span className="brand__mark" aria-hidden="true" />
                <span className="brand__name"><Swash>أساس</Swash></span>
              </a>
              <span className="asas-header-section">{roles[user.role] || 'لوحة الإدارة'}</span>
            </div>

            <div className="asas-topbar-actions">
              <LiveClock iconSize={14} iconColor="var(--accent)" />
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--icon asas-bell-btn"
                onClick={() => openAnnouncementsCenter(null)}
                aria-label="مركز الإشعارات والتعميمات"
                title="مركز الإشعارات والتعميمات"
              >
                <Icon name="bell" />
                {unreadAnnouncementsCount > 0 && <span className="asas-bell-badge num">{unreadAnnouncementsCount}</span>}
              </button>
              <Button
                variant="ghost"
                size="sm"
                icon={theme === 'dark' ? 'sun' : 'moon'}
                label={theme === 'dark' ? 'التحويل للمظهر الفاتح' : 'التحويل للمظهر الداكن'}
                onClick={toggleTheme}
              />
              <button
                type="button"
                className="asas-topbar-user"
                onClick={() => setShowProfileModal(true)}
                title="الملف الشخصي"
                aria-label="الملف الشخصي"
              >
                <UserAvatar user={user} size="sm" />
              </button>
            </div>
          </Glass>
        </div>

        <main className="asas-content">
          <div className="asas-heading">
            <div>
              <h1><Swash>{title}</Swash></h1>
              <p className="asas-muted prose">متابعة الحضور الفوري، المواقع المعتمدة، وسجلات الدوام.</p>
            </div>
            <div className="asas-heading-actions">
              <button className="asas-btn" onClick={() => load(true)} disabled={busy}>
                <Icon name="refresh" />
                تحديث فوري
              </button>
              {['branches', 'shifts', 'accounts'].includes(tab) && can({ branches: 'locations.write', shifts: 'shifts.write', accounts: 'employees.write' }[tab]) && (
                <button className="asas-btn primary" onClick={() => edit(tab, null)}>
                  <Icon name="plus" />
                  إضافة {tab === 'branches' ? 'موقع' : tab === 'shifts' ? 'دوام' : 'موظف'}
                </button>
              )}
              {tab === 'announcements' && (
                <button className="asas-btn primary" onClick={() => { setForm({ ...defaults.announcements }); setModal('announcements'); }}>
                  <Icon name="send" />
                  نشر تعميم رسمي
                </button>
              )}
            </div>
          </div>

          {error && (
            <div role="alert" className="asas-notice error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{error}</span>
              <button className="asas-btn sm" onClick={() => load(false)} disabled={busy}>
                <Icon name="refresh" />
                إعادة المحاولة
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="asas-notice">
              <div className="asas-notice__content">
                <span className="asas-notice__icon" aria-hidden="true">
                  <Icon name="checkCircle" />
                </span>
                <span className="asas-notice__text">{notice}</span>
              </div>
              <Button variant="ghost" size="sm" icon="close" label="إغلاق الإشعار" onClick={() => setNotice('')} />
            </div>
          )}
          {busy && !data && <Empty>جارٍ جلب وتحديث البيانات لحظياً…</Empty>}

          {/* DASHBOARD TAB */}
          {tab === 'dashboard' && data && (
            <>
              <Glass className="asas-hero-banner">
                <div>
                  <h2><AsasGreeting name={user.name} /></h2>
                  <p className="prose">حضور مؤكد جغرافياً ومقيد بالأجهزة المعتمدة مع مزامنة لحظية.</p>
                  <div className="cluster" style={{ marginTop: 14 }}>
                    <Button variant="primary" icon="qrCode" onClick={() => selectAdminTab('qr')}>
                      عرض الرموز المعتمدة
                    </Button>
                    <Button
                      variant="glass"
                      icon="download"
                      onClick={() => {
                        if (installPrompt) installPrompt.prompt();
                        else setShowInstallModal(true);
                      }}
                    >
                      تحميل التطبيق على الجوال
                    </Button>
                  </div>
                </div>
              </Glass>

              <div className="asas-stats-grid">
                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>إجمالي الموظفين</span>
                    <div className="asas-stat-icon-wrap"><Icon name="users" /></div>
                  </div>
                  <div className="asas-stat-value num">{formatNumber(data.total)}</div>
                  <div className="asas-stat-caption">حسابات نشطة في قاعدة البيانات</div>
                </Glass>

                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>حاضرون اليوم</span>
                    <div className="asas-stat-icon-wrap"><Icon name="checkCircle" /></div>
                  </div>
                  <div className="asas-stat-value num" style={{ color: 'var(--paid)' }}>{formatNumber(data.present)}</div>
                  <div className="asas-stat-caption">سجلوا دخولهم خلال الساعات الحالية</div>
                </Glass>

                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>داخل نطاق العمل</span>
                    <div className="asas-stat-icon-wrap"><Icon name="mapPin" /></div>
                  </div>
                  <div className="asas-stat-value num">{formatNumber(data.inside)}</div>
                  <div className="asas-stat-caption">حسب قراءات GPS المؤكدة</div>
                </Glass>

                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>تأخيرات مرصودة</span>
                    <div className="asas-stat-icon-wrap"><Icon name="alert" /></div>
                  </div>
                  <div className="asas-stat-value num" style={{ color: data.late > 0 ? 'var(--partial)' : 'var(--text)' }}>{formatNumber(data.late)}</div>
                  <div className="asas-stat-caption">حالات تأخير بحاجة لمتابعة</div>
                </Glass>
              </div>

              <div className="asas-grid-halves">
                <Card title="مؤشر نسبة الحضور" icon="trend">
                  <div style={{ padding: '12px 6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span className="asas-muted">نسبة حضور اليوم</span>
                      <strong className="num" style={{ fontSize: 18, color: 'var(--accent)' }}>
                        {data.total ? Math.round(data.present / data.total * 100) : 0}%
                      </strong>
                    </div>
                    <ProgressBar value={data.present} max={Math.max(data.total, 1)} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
                      <span>لم يسجلوا بعد: <strong className="num">{formatNumber(Math.max(0, data.total - data.present))}</strong></span>
                      <span>سجلوا حضوراً: <strong className="num">{formatNumber(data.present)}</strong></span>
                    </div>
                  </div>
                </Card>

                <Card title="حوكمة المنشأة والموقع" icon="building">
                  <div style={{ padding: '12px 6px' }}>
                    <p className="asas-muted">إدارة المواقع الجغرافية وضبط دقة قراءات GPS وفترة تأكيد الخروج.</p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                      <button className="asas-btn primary sm" onClick={() => setTab('branches')}>
                        <Icon name="mapPin" />
                        المواقع الجغرافية
                      </button>
                      <button className="asas-btn sm" onClick={() => setTab('settings')}>
                        <Icon name="settings" />
                        الإعدادات
                      </button>
                    </div>
                  </div>
                </Card>
              </div>

              <Card 
                title={`سجل حضور وانصراف الموظفين اليوم (${(data.records || []).length} موظف)`} 
                icon="calendar" 
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Segmented
                      label="نمط عرض سجلات اليوم"
                      value={dashboardViewMode}
                      onChange={setDashboardViewMode}
                      options={[
                        { value: 'auto', label: 'تلقائي' },
                        { value: 'table', label: 'جدول' },
                        { value: 'cards', label: 'بطاقات' }
                      ]}
                    />
                    <button className="asas-btn sm" onClick={() => selectAdminTab('records')}>
                      <Icon name="list" />
                      جميع السجلات والتقارير
                    </button>
                  </div>
                }
              >
                <Records 
                  rows={data.records || []} 
                  onEdit={r => edit('records', r)} 
                  canEdit={can('attendance.edit')} 
                  viewMode={dashboardViewMode}
                  showViewToggle={false}
                />
              </Card>
            </>
          )}

          {/* RECORDS TAB */}
          {tab === 'records' && (() => {
            const allRecords = rows;
            const insideCount = allRecords.filter(r => r.state === 'inside').length;
            const outsideCount = allRecords.filter(r => r.state === 'outside' || r.state === 'closed').length;
            const absentCount = allRecords.filter(r => r.state === 'absent').length;
            const leaveCount = allRecords.filter(r => r.state === 'leave').length;

            const filteredRecords = allRecords.filter(r => {
              if (recordFilter === 'inside' && r.state !== 'inside') return false;
              if (recordFilter === 'outside' && r.state !== 'outside' && r.state !== 'closed') return false;
              if (recordFilter === 'absent' && r.state !== 'absent') return false;
              if (recordFilter === 'leave' && r.state !== 'leave') return false;
              if (search.trim()) {
                const q = search.trim().toLowerCase();
                const name = (r.name || '').toLowerCase();
                const ident = (r.identifier || '').toLowerCase();
                const branch = (r.branch_name || '').toLowerCase();
                if (!name.includes(q) && !ident.includes(q) && !branch.includes(q)) return false;
              }
              return true;
            });

            const filteredEmployees = (collectiveData?.employees || []).filter(e => {
              if (!search.trim()) return true;
              const q = search.trim().toLowerCase();
              return (e.name || '').toLowerCase().includes(q) ||
                     (e.identifier || '').toLowerCase().includes(q) ||
                     (e.branch_name || '').toLowerCase().includes(q);
            });

            return (
              <>
                {/* Mode Switcher Tabs (Kit Segmented Pill) */}
                <div className="asas-records-mode-tabs">
                  <Segmented
                    label="عرض سجلات الحضور"
                    value={recordsTabMode}
                    onChange={setRecordsTabMode}
                    options={[
                      { value: 'collective', label: 'التقرير الجماعي' },
                      { value: 'individual', label: 'السجل الفردي' },
                      { value: 'live', label: 'الحركات المباشرة' }
                    ]}
                  />
                </div>

                {/* Period Controls & Quick Presets (AI-ASAAS/skills Responsive Card) */}
                <Glass className="asas-records-period-box">
                  <div className="asas-presets-section">
                    <div className="asas-presets-head">
                      <span className="asas-presets-label">
                        <Icon name="clock" />
                        فترات سريعة
                      </span>
                      <button
                        type="button"
                        className="chip asas-month-toggle-chip"
                        aria-pressed={showMonthYearPicker || activePreset === 'custom_month'}
                        onClick={() => setShowMonthYearPicker(v => !v)}
                      >
                        <Icon name="calendar" />
                        <span>تحديد شهر وسنة</span>
                      </button>
                    </div>

                    <div className="chips asas-presets-chips" role="group" aria-label="فترات سريعة">
                      {[
                        ['today', 'اليوم'],
                        ['yesterday', 'أمس'],
                        ['this_week', 'هذا الأسبوع'],
                        ['this_month', 'هذا الشهر'],
                        ['last_month', 'الشهر السابق']
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className="chip"
                          aria-pressed={activePreset === key}
                          onClick={() => applyPreset(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Month & Year Picker Dropdown */}
                  {showMonthYearPicker && (
                    <div className="asas-month-picker-panel">
                      <div className="asas-month-picker-fields">
                        <Field label="السنة">
                          <select
                            className="asas-input"
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                          >
                            {[2024, 2025, 2026, 2027].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="الشهر">
                          <select
                            className="asas-input"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                          >
                            {[
                              [1, 'يناير (1)'], [2, 'فبراير (2)'], [3, 'مارس (3)'], [4, 'أبريل (4)'],
                              [5, 'مايو (5)'], [6, 'يونيو (6)'], [7, 'يوليو (7)'], [8, 'أغسطس (8)'],
                              [9, 'سبتمبر (9)'], [10, 'أكتوبر (10)'], [11, 'نوفمبر (11)'], [12, 'ديسمبر (12)']
                            ].map(([m, name]) => (
                              <option key={m} value={m}>{name}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="asas-month-picker-actions">
                        <Button
                          variant="primary"
                          size="sm"
                          icon="check"
                          onClick={() => applyMonthRange(selectedYear, selectedMonth)}
                        >
                          تطبيق الشهر
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowMonthYearPicker(false)}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Date Range Inputs, Search & Export Actions */}
                  <div className="asas-filter-container">
                    <div className="asas-filter-fields">
                      <div className="asas-filter-dates-row">
                        <Field
                          label="من تاريخ"
                          type="date"
                          value={from}
                          onChange={e => { setFrom(e.target.value); setActivePreset(''); }}
                        />
                        <Field
                          label="إلى تاريخ"
                          type="date"
                          value={to}
                          onChange={e => { setTo(e.target.value); setActivePreset(''); }}
                        />
                      </div>

                      {recordsTabMode === 'individual' && (
                        <div className="asas-filter-emp-select">
                          <Field label="اختر الموظف لعرض سجله الفردي">
                            <select
                              className="asas-input"
                              value={selectedEmployeeId}
                              onChange={e => setSelectedEmployeeId(e.target.value)}
                            >
                              {(collectiveData?.employees || []).map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.identifier}) - {emp.branch_name || 'الفرع الرئيسي'}
                                </option>
                              ))}
                              {(!collectiveData?.employees || !collectiveData.employees.length) && (
                                <option value="">لا يوجد موظفون</option>
                              )}
                            </select>
                          </Field>
                        </div>
                      )}

                      {recordsTabMode !== 'individual' && (
                        <div className="asas-filter-search-wrap">
                          <Field label="بحث بالاسم أو الرقم">
                            <div className="asas-search-box">
                              <input
                                className="asas-input asas-search-input"
                                type="search"
                                placeholder="بحث في الموظفين..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                              />
                              <Icon name="search" className="asas-search-icon" />
                              {search && (
                                <button
                                  type="button"
                                  className="asas-search-clear-btn"
                                  onClick={() => setSearch('')}
                                  aria-label="مسح البحث"
                                >
                                  <Icon name="close" style={{ width: 14, height: 14 }} />
                                </button>
                              )}
                            </div>
                          </Field>
                        </div>
                      )}
                    </div>

                    {can('reports.export') && (
                      <div className="asas-filter-export-wrap">
                        <span className="asas-export-label">تصدير التقرير:</span>
                        <div className="asas-filter-export-actions">
                          <Button variant="glass" size="sm" icon="fileSpreadsheet" disabled={busy} onClick={exportCsv} title="تصدير إلى جدول Excel">
                            Excel / CSV
                          </Button>
                          <Button variant="glass" size="sm" icon="file" disabled={busy} onClick={exportWord} title="تصدير كملف Word معتمد وفق القالب الرسمي">
                            Word (DOCX)
                          </Button>
                          <Button variant="glass" size="sm" icon="download" disabled={busy} onClick={exportTxt} title="تصدير كنص منسق">
                            تقرير TXT
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Glass>

                {/* VIEW 1: COLLECTIVE REPORT */}
                {recordsTabMode === 'collective' && (
                  <>
                    {/* Collective Summary Stats Grid */}
                    <div className="asas-stats-grid" style={{ marginBottom: 16 }}>
                      <Glass className="asas-stat-card">
                        <div className="asas-stat-card-top">
                          <span>إجمالي الموظفين</span>
                          <div className="asas-stat-icon-wrap"><Icon name="users" /></div>
                        </div>
                        <div className="asas-stat-value">{formatNumber(collectiveData?.overall?.total_employees || 0)}</div>
                        <div className="asas-stat-caption">الموظفون المشمولون بالتقرير</div>
                      </Glass>

                      <Glass className="asas-stat-card">
                        <div className="asas-stat-card-top">
                          <span>إجمالي أيام الحضور</span>
                          <div className="asas-stat-icon-wrap"><Icon name="checkCircle" /></div>
                        </div>
                        <div className="asas-stat-value" style={{ color: 'var(--paid)' }}>
                          {formatNumber(collectiveData?.overall?.total_present_days || 0)}
                        </div>
                        <div className="asas-stat-caption">مجموع أيام الحضور لكافة الموظفين</div>
                      </Glass>

                      <Glass className="asas-stat-card">
                        <div className="asas-stat-card-top">
                          <span>إجمالي أيام الغياب</span>
                          <div className="asas-stat-icon-wrap"><Icon name="alert" /></div>
                        </div>
                        <div className="asas-stat-value" style={{ color: (collectiveData?.overall?.total_absent_days || 0) > 0 ? 'var(--unpaid)' : 'var(--text)' }}>
                          {formatNumber(collectiveData?.overall?.total_absent_days || 0)}
                        </div>
                        <div className="asas-stat-caption">أيام الغياب غير المبررة بالدوام</div>
                      </Glass>

                      <Glass className="asas-stat-card">
                        <div className="asas-stat-card-top">
                          <span>حالات التأخير المرصودة</span>
                          <div className="asas-stat-icon-wrap"><Icon name="clock" /></div>
                        </div>
                        <div className="asas-stat-value" style={{ color: (collectiveData?.overall?.total_late_days || 0) > 0 ? 'var(--partial)' : 'var(--text)' }}>
                          {formatNumber(collectiveData?.overall?.total_late_days || 0)}
                        </div>
                        <div className="asas-stat-caption">
                          إجمالي {formatNumber(collectiveData?.overall?.total_late_minutes || 0)} دقيقة تأخير
                        </div>
                      </Glass>

                      <Glass className="asas-stat-card">
                        <div className="asas-stat-card-top">
                          <span>ساعات العمل الفعلية</span>
                          <div className="asas-stat-icon-wrap"><Icon name="trend" /></div>
                        </div>
                        <div className="asas-stat-value">{collectiveData?.overall?.total_work_hours || '0.0'} س</div>
                        <div className="asas-stat-caption">إجمالي ساعات العمل المنجزة</div>
                      </Glass>

                      <Glass className="asas-stat-card">
                        <div className="asas-stat-card-top">
                          <span>متوسط الالتزام بالدوام</span>
                          <div className="asas-stat-icon-wrap"><Icon name="award" /></div>
                        </div>
                        <div className="asas-stat-value" style={{ color: 'var(--accent)' }}>
                          {collectiveData?.overall?.average_attendance_rate || 0}%
                        </div>
                        <div className="asas-stat-caption">نسبة الالتزام الإجمالية للفترة</div>
                      </Glass>
                    </div>

                    {/* Collective Table & Mobile Cards */}
                    <Card
                      title={`التقرير الجماعي الشامل للحضور والانصراف (${filteredEmployees.length} موظف)`}
                      icon="users"
                      actions={
                        <div className="asas-view-toggle-wrap">
                          <Segmented
                            label="طريقة عرض التقرير"
                            value={collectiveViewMode}
                            onChange={setCollectiveViewMode}
                            options={[
                              { value: 'auto', label: 'تلقائي' },
                              { value: 'table', label: 'جدول' },
                              { value: 'cards', label: 'بطاقات' }
                            ]}
                          />
                        </div>
                      }
                    >
                      <div className={`asas-collective-container ${collectiveViewMode !== 'auto' ? `view-${collectiveViewMode}` : ''}`}>
                        {/* 1. TABLE VIEW (Desktop / Tablet) */}
                        <div className="asas-collective-table-view asas-table-wrap">
                          <table className="asas-table">
                            <thead>
                              <tr>
                                {['الرقم الوظيفي', 'اسم الموظف', 'الفرع', 'الوردية', 'أيام الحضور', 'أيام الغياب', 'التأخير', 'ساعات العمل', 'الإجازات', 'نسبة الالتزام', 'إجراء'].map(h => (
                                  <th key={h}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredEmployees.map(emp => (
                                <tr key={emp.id}>
                                  <td>
                                    <strong style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                                      {emp.identifier}
                                    </strong>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <strong>{emp.name}</strong>
                                      {emp.is_remote && (
                                        <span className="asas-badge remote sm-badge">
                                          <Icon name="globe" style={{ width: 10, height: 10 }} />
                                          <span>عن بعد</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td>{emp.branch_name || 'الفرع الرئيسي'}</td>
                                  <td>{emp.shift_name || 'دوام رسمي'}</td>
                                  <td>
                                    <span style={{ color: 'var(--paid)', fontWeight: 700 }}>
                                      {emp.present_days} يوم
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ color: emp.absent_days > 0 ? 'var(--unpaid)' : 'var(--text-3)', fontWeight: emp.absent_days > 0 ? 700 : 400 }}>
                                      {emp.absent_days} يوم
                                    </span>
                                  </td>
                                  <td>
                                    {emp.late_days_count > 0 ? (
                                      <span style={{ color: 'var(--partial)', fontWeight: 600 }}>
                                        {emp.late_days_count} مرات ({emp.total_late_minutes} د)
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--paid)', fontSize: 12 }}>في الموعد</span>
                                    )}
                                  </td>
                                  <td>
                                    <strong>{emp.total_work_hours} س</strong>
                                  </td>
                                  <td>
                                    {emp.leave_days > 0 ? (
                                      <span className="num" style={{ color: 'var(--chart-out)', fontWeight: 600 }}>{emp.leave_days} يوم</span>
                                    ) : (
                                      <span style={{ color: 'var(--text-3)' }}>0</span>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span
                                        className={`asas-rate-pill ${emp.attendance_rate >= 80 ? 'good' : (emp.attendance_rate >= 50 ? 'warn' : 'bad')}`}
                                      >
                                        {emp.attendance_rate}%
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <button
                                      className="asas-btn sm primary"
                                      onClick={() => {
                                        setSelectedEmployeeId(String(emp.id));
                                        setRecordsTabMode('individual');
                                      }}
                                      title="عرض السجل التاريخي والتحليلي الكامل للموظف"
                                    >
                                      <Icon name="user" />
                                      عرض السجل الفردي
                                    </button>
                                    <Button
                                      variant="glass"
                                      size="xs"
                                      icon="clock"
                                      title={`إرسال تنبيه دوام فوري لـ (${emp.name})`}
                                      onClick={() => handleOpenDirectReminder(emp)}
                                      style={{ marginInlineStart: 4 }}
                                    >
                                      تنبيه
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                              {!filteredEmployees.length && (
                                <tr>
                                  <td colSpan={11} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)' }}>
                                    لا توجد بيانات موظفين مطابقة للبحث أو الفترة المحددة.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* 2. CARDS VIEW (Phone first, liquid-glass) */}
                        <div className="asas-collective-cards-view">
                          {filteredEmployees.map(emp => (
                            <Glass key={emp.id} className="asas-collective-card">
                              <div className="asas-collective-card-head">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                  <UserAvatar user={emp} size="sm" />
                                  <div style={{ minWidth: 0 }}>
                                    <strong style={{ fontSize: 14.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {emp.name}
                                    </strong>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--text-3)' }}>
                                      <span className="num" style={{ color: 'var(--accent)', fontWeight: 600 }}>#{emp.identifier}</span>
                                      <span>•</span>
                                      <span>{emp.branch_name || 'الفرع الرئيسي'}</span>
                                      {emp.is_remote && (
                                        <span className="asas-badge remote sm-badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                                          عن بعد
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className={`asas-rate-pill ${emp.attendance_rate >= 80 ? 'good' : (emp.attendance_rate >= 50 ? 'warn' : 'bad')}`}>
                                  {emp.attendance_rate}%
                                </span>
                              </div>

                              <div className="asas-collective-card-metrics">
                                <div className="asas-metric-cell">
                                  <span className="asas-metric-label">أيام الحضور</span>
                                  <span className="num" style={{ color: 'var(--paid)', fontWeight: 700 }}>{emp.present_days} يوم</span>
                                </div>
                                <div className="asas-metric-cell">
                                  <span className="asas-metric-label">أيام الغياب</span>
                                  <span className="num" style={{ color: emp.absent_days > 0 ? 'var(--unpaid)' : 'var(--text-3)', fontWeight: 700 }}>{emp.absent_days} يوم</span>
                                </div>
                                <div className="asas-metric-cell">
                                  <span className="asas-metric-label">ساعات العمل</span>
                                  <span className="num" style={{ fontWeight: 700 }}>{emp.total_work_hours} س</span>
                                </div>
                                <div className="asas-metric-cell">
                                  <span className="asas-metric-label">التأخير</span>
                                  <span className="num" style={{ color: emp.late_days_count > 0 ? 'var(--partial)' : 'var(--paid)', fontWeight: 600 }}>
                                    {emp.late_days_count > 0 ? `${emp.late_days_count} مرات (${emp.total_late_minutes}د)` : 'في الموعد'}
                                  </span>
                                </div>
                              </div>

                              <div className="asas-collective-card-foot" style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="asas-btn sm primary"
                                  style={{ flex: 1, justifyContent: 'center' }}
                                  onClick={() => {
                                    setSelectedEmployeeId(String(emp.id));
                                    setRecordsTabMode('individual');
                                  }}
                                >
                                  <Icon name="user" />
                                  عرض السجل
                                </button>
                                <Button
                                  variant="glass"
                                  size="sm"
                                  icon="clock"
                                  title={`إرسال تنبيه دوام فوري لـ (${emp.name})`}
                                  onClick={() => handleOpenDirectReminder(emp)}
                                >
                                  تنبيه
                                </Button>
                              </div>
                            </Glass>
                          ))}
                          {!filteredEmployees.length && (
                            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)' }}>
                              لا توجد بيانات موظفين مطابقة للبحث أو الفترة المحددة.
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </>
                )}

                {/* VIEW 2: INDIVIDUAL EMPLOYEE DOSSIER */}
                {recordsTabMode === 'individual' && (
                  <>
                    {individualData?.employee ? (
                      <>
                        {/* Employee Identity Banner */}
                        <div className="asas-dossier-banner">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                            <UserAvatar user={individualData.employee} size="lg" />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                                  {individualData.employee.name}
                                </h3>
                                <span className="asas-dossier-id num">
                                  #{individualData.employee.identifier}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}>
                                <span>الفرع: <strong>{individualData.employee.branch_name || 'الفرع الرئيسي'}</strong></span>
                                <span>الوردية: <strong>{individualData.employee.shift_name || 'دوام رسمي'}</strong></span>
                                <span>طبيعة العمل: <strong style={{ color: individualData.employee.is_remote ? 'var(--chart-out)' : 'inherit' }}>{individualData.employee.is_remote ? 'دوام عن بعد (أونلاين)' : 'دوام حضوري بالمقر'}</strong></span>
                                {individualData.employee.shift_start_time && (
                                  <span>مواعيد الدوام: <strong>{String(individualData.employee.shift_start_time).slice(0, 5)} إلى {String(individualData.employee.shift_end_time).slice(0, 5)}</strong> (سماح {individualData.employee.grace_minutes || 10} د)</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="asas-dossier-rate-wrap">
                            <div className="asas-dossier-rate">
                              <span>نسبة الالتزام</span>
                              <strong className="num">
                                {individualData.summary.attendance_rate}%
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Incomplete Records Warning Banner */}
                        {individualData.summary.incomplete_records_count > 0 && (
                          <div className="asas-alert-banner danger">
                            <Icon name="alert" style={{ width: 22, height: 22, color: 'var(--unpaid)', flexShrink: 0 }} />
                            <div>
                              <strong style={{ color: 'var(--unpaid)', fontSize: 14, display: 'block' }}>
                                تنبيه إداري: يوجد {individualData.summary.incomplete_records_count} سجلات بحاجة لمراجعة وتصحيح
                              </strong>
                              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                تم رصد سجلات ينقصها تسجيل الانصراف أو تسجيل الحضور في أيام سابقة. لم يتم احتساب ساعات عمل افتراضية حرصاً على سلامة البيانات.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Individual Summary Cards */}
                        <div className="asas-stats-grid" style={{ marginBottom: 16 }}>
                          <Glass className="asas-stat-card">
                            <div className="asas-stat-card-top">
                              <span>أيام الدوام المستحقة</span>
                              <div className="asas-stat-icon-wrap"><Icon name="calendar" /></div>
                            </div>
                            <div className="asas-stat-value">{individualData.summary.work_days} يوم</div>
                            <div className="asas-stat-caption">من إجمالي {individualData.summary.total_days} يوم بالفترة</div>
                          </Glass>

                          <Glass className="asas-stat-card">
                            <div className="asas-stat-card-top">
                              <span>أيام الحضور الفعلي</span>
                              <div className="asas-stat-icon-wrap"><Icon name="checkCircle" /></div>
                            </div>
                            <div className="asas-stat-value" style={{ color: 'var(--paid)' }}>
                              {individualData.summary.present_days} يوم
                            </div>
                            <div className="asas-stat-caption">حضور موثق في جدول الدوام</div>
                          </Glass>

                          <Glass className="asas-stat-card">
                            <div className="asas-stat-card-top">
                              <span>أيام الغياب غير المسجل</span>
                              <div className="asas-stat-icon-wrap"><Icon name="alert" /></div>
                            </div>
                            <div className="asas-stat-value" style={{ color: individualData.summary.absent_days > 0 ? 'var(--unpaid)' : 'var(--text)' }}>
                              {individualData.summary.absent_days} يوم
                            </div>
                            <div className="asas-stat-caption">أيام عمل فعلية لم يُسجل فيها</div>
                          </Glass>

                          <Glass className="asas-stat-card">
                            <div className="asas-stat-card-top">
                              <span>مرات ودقائق التأخير</span>
                              <div className="asas-stat-icon-wrap"><Icon name="clock" /></div>
                            </div>
                            <div className="asas-stat-value" style={{ color: individualData.summary.late_days_count > 0 ? 'var(--partial)' : 'var(--text)' }}>
                              {individualData.summary.late_days_count} مرات
                            </div>
                            <div className="asas-stat-caption">إجمالي {individualData.summary.total_late_minutes} دقيقة تأخير</div>
                          </Glass>

                          <Glass className="asas-stat-card">
                            <div className="asas-stat-card-top">
                              <span>ساعات العمل الفعلية</span>
                              <div className="asas-stat-icon-wrap"><Icon name="trend" /></div>
                            </div>
                            <div className="asas-stat-value">{individualData.summary.total_work_hours} س</div>
                            <div className="asas-stat-caption">محسوبة من أوقات الحضور والانصراف</div>
                          </Glass>

                          <Glass className="asas-stat-card">
                            <div className="asas-stat-card-top">
                              <span>الإجازات والعطلات</span>
                              <div className="asas-stat-icon-wrap"><Icon name="briefcase" /></div>
                            </div>
                            <div className="asas-stat-value">
                              {individualData.summary.leave_days + individualData.summary.weekend_days} يوم
                            </div>
                            <div className="asas-stat-caption">
                              {individualData.summary.leave_days} إجازة معتمدة · {individualData.summary.weekend_days} عطلة
                            </div>
                          </Glass>
                        </div>

                        {/* Individual Day-by-Day Historical Timeline Table & Mobile Cards */}
                        <Card
                          title={`السجل التاريخي المفصل للموظف: ${individualData.employee.name} (الفترة: ${from} إلى ${to})`}
                          icon="list"
                        >
                          <div className="asas-timeline-container">
                            {/* 1. TABLE VIEW (Desktop / Tablet) */}
                            <div className="asas-timeline-table-view asas-table-wrap">
                              <table className="asas-table">
                                <thead>
                                  <tr>
                                    {['التاريخ', 'اليوم', 'الدوام', 'وقت الدخول', 'وقت الخروج', 'الحالة', 'التأخير', 'ساعات العمل', 'ملاحظات وتنبيهات', ...(can('attendance.edit') ? ['إجراء'] : [])].map(h => (
                                      <th key={h}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {individualData.timeline.map((day, dIdx) => {
                                    const isAbs = day.state === 'absent';
                                    const isLate = day.state === 'late' || (day.late_minutes > 0);
                                    const isLev = day.state === 'leave';
                                    const isWkd = day.state === 'weekend';
                                    const isIn = day.state === 'inside';
                                    const isInc = day.state === 'incomplete' || day.needs_review;
                                    const isPend = day.state === 'pending';

                                    let badgeStyle = { background: 'var(--paid-bg)', color: 'var(--paid)' };
                                    if (isAbs) badgeStyle = { background: 'var(--unpaid-bg)', color: 'var(--unpaid)', border: '1px solid var(--unpaid)' };
                                    else if (isInc) badgeStyle = { background: 'var(--unpaid-bg)', color: 'var(--unpaid)', border: '1px solid var(--unpaid)' };
                                    else if (isLate) badgeStyle = { background: 'var(--partial-bg)', color: 'var(--partial)' };
                                    else if (isLev) badgeStyle = { background: 'var(--glass-inset)', color: 'var(--chart-out)' };
                                    else if (isWkd) badgeStyle = { background: 'var(--glass-inset)', color: 'var(--text-3)' };
                                    else if (isPend) badgeStyle = { background: 'var(--glass-tint-strong)', color: 'var(--accent)' };

                                    return (
                                      <tr key={day.date + '-' + dIdx} style={isInc ? { background: 'var(--unpaid-bg)' } : undefined}>
                                        <td>
                                          <strong className="num">{day.date}</strong>
                                        </td>
                                        <td>
                                          <strong style={{ color: isWkd ? 'var(--text-3)' : 'var(--text)' }}>
                                            {day.day_name}
                                          </strong>
                                        </td>
                                        <td>
                                          <span style={{ fontSize: 12, color: day.is_workday ? 'var(--text)' : 'var(--text-3)' }}>
                                            {day.is_workday ? (individualData.employee.shift_name || 'دوام رسمي') : 'عطلة أسبوعية'}
                                          </span>
                                        </td>
                                        <td>
                                          {day.first_in ? (
                                            <span style={{ color: 'var(--paid)', fontWeight: 700 }}>
                                              {day.first_in_time}
                                            </span>
                                          ) : (
                                            <span style={{ color: isAbs ? 'var(--unpaid)' : 'var(--text-3)', fontWeight: isAbs ? 600 : 400 }}>
                                              {isAbs ? 'لم يحضر' : (isWkd ? '—' : (isLev ? 'إجازة' : '—'))}
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          {day.last_out ? (
                                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                                              {day.last_out_time}
                                            </span>
                                          ) : (
                                            <span style={{ color: isIn ? 'var(--partial)' : 'var(--text-3)', fontWeight: isIn ? 700 : 400 }}>
                                              {isIn ? 'حاضر الآن' : '—'}
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          <span className="asas-badge" style={badgeStyle}>
                                            <Icon name={isAbs || isInc ? 'alert' : (isLate ? 'clock' : (isLev ? 'calendar' : (isWkd ? 'clock' : 'checkCircle')))} style={{ width: 13, height: 13 }} />
                                            {day.status_label}
                                          </span>
                                        </td>
                                        <td>
                                          {day.late_minutes > 0 ? (
                                            <span style={{ color: 'var(--partial)', fontWeight: 700 }}>
                                              {day.late_minutes} دقيقة
                                            </span>
                                          ) : (
                                            <span style={{ color: 'var(--text-3)' }}>—</span>
                                          )}
                                        </td>
                                        <td>
                                          <strong style={{ color: Number(day.work_hours) > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                                            {day.work_hours || '0.0'} س
                                          </strong>
                                        </td>
                                        <td>
                                          {day.needs_review ? (
                                            <span style={{ color: 'var(--unpaid)', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                              <Icon name="alert" style={{ width: 14, height: 14 }} />
                                              سجل ناقص بحاجة لمراجعة
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                              {day.exit_reason_label || (isWkd ? 'يوم راحة أسبوعية' : (isLev ? 'إجازة رسمية' : '—'))}
                                            </span>
                                          )}
                                        </td>
                                        {can('attendance.edit') && (
                                          <td>
                                            {day.record_id ? (
                                              <button
                                                className="asas-btn sm"
                                                onClick={() => edit('records', {
                                                  id: day.record_id,
                                                  employee_id: individualData.employee.id,
                                                  first_in: day.first_in,
                                                  last_out: day.last_out,
                                                  state: isIn ? 'inside' : 'closed',
                                                  exit_reason: day.exit_reason || ''
                                                })}
                                                title="تصحيح سجل هذا اليوم"
                                              >
                                                <Icon name="edit" />
                                                تصحيح
                                              </button>
                                            ) : isAbs ? (
                                              <button
                                                className="asas-btn sm primary"
                                                onClick={() => edit('records', {
                                                  employee_id: individualData.employee.id,
                                                  first_in: `${day.date}T08:00:00`,
                                                  last_out: `${day.date}T16:00:00`,
                                                  state: 'closed',
                                                  reason: 'تسجيل حضور يدوي متأخر'
                                                })}
                                                title="تحضير يدوي لهذا اليوم"
                                              >
                                                <Icon name="checkCircle" />
                                                تحضير يدوي
                                              </button>
                                            ) : null}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* 2. CARDS VIEW (Phone first, liquid-glass) */}
                            <div className="asas-timeline-cards-view">
                              {individualData.timeline.map((day, dIdx) => {
                                const isAbs = day.state === 'absent';
                                const isLate = day.state === 'late' || (day.late_minutes > 0);
                                const isLev = day.state === 'leave';
                                const isWkd = day.state === 'weekend';
                                const isIn = day.state === 'inside';
                                const isInc = day.state === 'incomplete' || day.needs_review;
                                const isPend = day.state === 'pending';

                                let badgeStyle = { background: 'var(--paid-bg)', color: 'var(--paid)' };
                                if (isAbs) badgeStyle = { background: 'var(--unpaid-bg)', color: 'var(--unpaid)', border: '1px solid var(--unpaid)' };
                                else if (isInc) badgeStyle = { background: 'var(--unpaid-bg)', color: 'var(--unpaid)', border: '1px solid var(--unpaid)' };
                                else if (isLate) badgeStyle = { background: 'var(--partial-bg)', color: 'var(--partial)' };
                                else if (isLev) badgeStyle = { background: 'var(--glass-inset)', color: 'var(--chart-out)' };
                                else if (isWkd) badgeStyle = { background: 'var(--glass-inset)', color: 'var(--text-3)' };
                                else if (isPend) badgeStyle = { background: 'var(--glass-tint-strong)', color: 'var(--accent)' };

                                return (
                                  <Glass key={day.date + '-' + dIdx} className="asas-timeline-card" style={isInc ? { borderColor: 'var(--unpaid)' } : undefined}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <strong className="num" style={{ fontSize: 14 }}>{day.date}</strong>
                                        <span style={{ fontSize: 12, color: 'var(--text-3)', marginInlineStart: 6 }}>({day.day_name})</span>
                                      </div>
                                      <span className="asas-badge" style={badgeStyle}>
                                        <Icon name={isAbs || isInc ? 'alert' : (isLate ? 'clock' : (isLev ? 'calendar' : (isWkd ? 'clock' : 'checkCircle')))} style={{ width: 12, height: 12 }} />
                                        {day.status_label}
                                      </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '8px 10px', background: 'var(--glass-inset)', borderRadius: 8, fontSize: 11.5, textAlign: 'center' }}>
                                      <div>
                                        <span style={{ color: 'var(--text-3)', display: 'block', fontSize: 10 }}>الدخول</span>
                                        <strong className="num" style={{ color: day.first_in ? 'var(--paid)' : (isAbs ? 'var(--unpaid)' : 'inherit') }}>
                                          {day.first_in ? day.first_in_time : (isAbs ? 'لم يحضر' : '—')}
                                        </strong>
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-3)', display: 'block', fontSize: 10 }}>الخروج</span>
                                        <strong className="num" style={{ color: day.last_out ? 'var(--text)' : (isIn ? 'var(--partial)' : 'inherit') }}>
                                          {day.last_out ? day.last_out_time : (isIn ? 'حاضر الآن' : '—')}
                                        </strong>
                                      </div>
                                      <div>
                                        <span style={{ color: 'var(--text-3)', display: 'block', fontSize: 10 }}>ساعات العمل</span>
                                        <strong className="num" style={{ color: 'var(--accent)' }}>{day.work_hours || '0.0'} س</strong>
                                      </div>
                                    </div>

                                    {(day.needs_review || day.notes || day.exit_reason_label) && (
                                      <div style={{ fontSize: 11.5, color: isInc ? 'var(--unpaid)' : 'var(--text-2)' }}>
                                        {day.needs_review ? (
                                          <strong style={{ color: 'var(--unpaid)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Icon name="alert" style={{ width: 12, height: 12 }} />
                                            سجل ناقص بحاجة لمراجعة
                                          </strong>
                                        ) : (
                                          day.exit_reason_label || (isWkd ? 'يوم راحة أسبوعية' : (isLev ? 'إجازة رسمية' : '—'))
                                        )}
                                      </div>
                                    )}

                                    {can('attendance.edit') && (day.record_id || isAbs) && (
                                      <div style={{ display: 'flex', gap: 6, paddingTop: 6, borderTop: '1px solid var(--hairline)' }}>
                                        {day.record_id ? (
                                          <button
                                            className="asas-btn sm"
                                            style={{ width: '100%', justifyContent: 'center' }}
                                            onClick={() => edit('records', {
                                              id: day.record_id,
                                              employee_id: individualData.employee.id,
                                              first_in: day.first_in,
                                              last_out: day.last_out,
                                              state: isIn ? 'inside' : 'closed',
                                              exit_reason: day.exit_reason || ''
                                            })}
                                          >
                                            <Icon name="edit" />
                                            تصحيح
                                          </button>
                                        ) : isAbs ? (
                                          <button
                                            className="asas-btn sm primary"
                                            style={{ width: '100%', justifyContent: 'center' }}
                                            onClick={() => edit('records', {
                                              employee_id: individualData.employee.id,
                                              first_in: `${day.date}T08:00:00`,
                                              last_out: `${day.date}T16:00:00`,
                                              state: 'closed',
                                              reason: 'تسجيل حضور يدوي متأخر'
                                            })}
                                          >
                                            <Icon name="checkCircle" />
                                            تحضير يدوي
                                          </button>
                                        ) : null}
                                      </div>
                                    )}
                                  </Glass>
                                );
                              })}
                            </div>
                          </div>
                        </Card>
                      </>
                    ) : (
                      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
                        <Icon name="user" style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.4 }} />
                        <p style={{ fontSize: 16 }}>يرجى اختيار موظف من القائمة أعلاه لعرض سجله الفردي الكامل ومؤشراته التحليلية.</p>
                      </div>
                    )}
                  </>
                )}

                {/* VIEW 3: LIVE DUTY MOVEMENTS (LEGACY VIEW) */}
                {recordsTabMode === 'live' && (
                  <>
                    <div className="asas-segmented-wrap" style={{ marginBottom: 16 }}>
                      <Segmented
                        label="تصفية الحركات المباشرة"
                        value={recordFilter}
                        onChange={setRecordFilter}
                        options={[
                          { value: 'all', label: `الكل (${allRecords.length})` },
                          { value: 'inside', label: `حاضرون (${insideCount})` },
                          { value: 'outside', label: `انصرفوا (${outsideCount})` },
                          { value: 'absent', label: `غائبون (${absentCount})` },
                          { value: 'leave', label: `إجازات (${leaveCount})` }
                        ]}
                      />
                    </div>

                    <Card 
                      title={`سجل الحركات والتفاصيل المباشرة (${filteredRecords.length} من إجمالي ${allRecords.length} حركة)`} 
                      icon="calendar"
                      actions={
                        <Segmented
                          label="نمط عرض الحركات"
                          value={liveRecordsViewMode}
                          onChange={setLiveRecordsViewMode}
                          options={[
                            { value: 'auto', label: 'تلقائي' },
                            { value: 'table', label: 'جدول' },
                            { value: 'cards', label: 'بطاقات' }
                          ]}
                        />
                      }
                    >
                      <Records 
                        rows={filteredRecords} 
                        onEdit={r => edit('records', r)} 
                        canEdit={can('attendance.edit')} 
                        viewMode={liveRecordsViewMode}
                        showViewToggle={false}
                      />
                    </Card>
                  </>
                )}
              </>
            );
          })()}

          {/* ACCOUNTS / EMPLOYEES TAB */}
          {tab === 'accounts' && (() => {
            const activeCount = rows.filter(a => a.active).length;
            const pendingCount = rows.filter(a => !a.active).length;
            const insideCount = rows.filter(a => a.attendance_status === 'inside').length;
            const boundDevicesCount = rows.filter(a => Boolean(a.bound_device_id)).length;

            const filteredAccounts = rows.filter(a => {
              const matchesSearch = `${a.name || ''} ${a.identifier || ''} ${a.email || ''} ${a.phone || ''} ${a.bound_device_name || ''}`
                .toLowerCase()
                .includes(search.trim().toLowerCase());
              if (!matchesSearch) return false;
              if (accountFilter === 'active') return a.active;
              if (accountFilter === 'pending') return !a.active;
              if (accountFilter === 'inside') return a.attendance_status === 'inside';
              if (accountFilter === 'bound') return Boolean(a.bound_device_id);
              return true;
            });

            const totalCount = filteredAccounts.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / accountPageSize));
            const safePage = Math.min(accountPage, totalPages);
            const startIdx = (safePage - 1) * accountPageSize;
            const endIdx = Math.min(startIdx + accountPageSize, totalCount);
            const currentAccounts = filteredAccounts.slice(startIdx, endIdx);

            const renderAttendancePill = (status, compact = false) => {
              if (status === 'inside') {
                return (
                  <span className="pill pill--paid">
                    <Icon name="checkCircle" />
                    {compact ? 'حاضر' : 'حاضر الآن'}
                  </span>
                );
              }
              if (status === 'outside') {
                return (
                  <span className="pill pill--neutral">
                    <Icon name="pause" />
                    {compact ? 'منصرف' : 'تم الانصراف'}
                  </span>
                );
              }
              if (status === 'leave') {
                return (
                  <span className="pill pill--partial">
                    <Icon name="receipt" />
                    {compact ? 'إجازة' : 'في إجازة'}
                  </span>
                );
              }
              return (
                <span className="pill pill--neutral">
                  <Icon name="alert" />
                  {compact ? 'لم يسجل' : 'لم يسجل اليوم'}
                </span>
              );
            };

            const handleResetDevice = async (a) => {
              if (!window.confirm(`هل أنت متأكد من فك ارتباط الجهاز للموظف (${a.name})؟ سيتمكن من ربط جوال جديد عند أول تسجيل دخول.`)) return;
              try {
                await api(`/admin/accounts/${a.id}/reset-device`, 'POST', { reason: 'فك قيد الجهاز بطلب من الإدارة' });
                setNotice(`تم فك قيد الجهاز للموظف ${a.name} بنجاح`);
                await load();
              } catch (e) { setError(e.message); }
            };

            return (
              <div className="asas-accounts-page">
                {/* 1. Executive KPI Summary Strip (AI-ASAAS/skills 4-up / 2-up on phone) */}
                <div className="asas-stats-grid asas-accounts-kpis">
                  <Glass className="asas-stat-card">
                    <div className="asas-stat-card-top">
                      <span>إجمالي الحسابات</span>
                      <div className="asas-stat-icon-wrap"><Icon name="users" /></div>
                    </div>
                    <div className="asas-stat-value num">{formatNumber(rows.length)}</div>
                    <div className="asas-stat-caption">موظف وإداري مسجل</div>
                  </Glass>

                  <Glass className="asas-stat-card">
                    <div className="asas-stat-card-top">
                      <span>المتواجدون الآن</span>
                      <div className="asas-stat-icon-wrap" style={{ color: 'var(--paid)', background: 'var(--paid-bg)' }}><Icon name="checkCircle" /></div>
                    </div>
                    <div className="asas-stat-value num" style={{ color: 'var(--paid)' }}>{formatNumber(insideCount)}</div>
                    <div className="asas-stat-caption">على رأس العمل حالياً</div>
                  </Glass>

                  <Glass className="asas-stat-card">
                    <div className="asas-stat-card-top">
                      <span>الأجهزة المقيدة</span>
                      <div className="asas-stat-icon-wrap" style={{ color: 'var(--chart-out)', background: 'var(--glass-inset)' }}><Icon name="smartphone" /></div>
                    </div>
                    <div className="asas-stat-value num" style={{ color: 'var(--chart-out)' }}>{formatNumber(boundDevicesCount)}</div>
                    <div className="asas-stat-caption">جوال مرتبط بالبصمة والأمان</div>
                  </Glass>

                  <Glass
                    className="asas-stat-card"
                    style={pendingCount > 0 ? { cursor: 'pointer' } : undefined}
                    onClick={pendingCount > 0 ? () => { setAccountFilter('pending'); setAccountPage(1); } : undefined}
                  >
                    <div className="asas-stat-card-top">
                      <span>{pendingCount > 0 ? 'طلبات معلقة' : 'الحسابات النشطة'}</span>
                      <div
                        className="asas-stat-icon-wrap"
                        style={pendingCount > 0
                          ? { color: 'var(--partial)', background: 'var(--partial-bg)' }
                          : { color: 'var(--accent)', background: 'var(--accent-glow)' }}
                      >
                        <Icon name={pendingCount > 0 ? 'clock' : 'shieldCheck'} />
                      </div>
                    </div>
                    <div className="asas-stat-value num" style={{ color: pendingCount > 0 ? 'var(--partial)' : 'var(--accent)' }}>
                      {formatNumber(pendingCount > 0 ? pendingCount : activeCount)}
                    </div>
                    <div className="asas-stat-caption">
                      {pendingCount > 0 ? 'اضغط لمراجعة طلبات التفعيل' : 'حساب معتمد ومفعّل'}
                    </div>
                  </Glass>
                </div>

                {/* 2. Pending Approval Banner */}
                {pendingCount > 0 && (
                  <Glass className="asas-pending-banner">
                    <div className="asas-pending-banner__body">
                      <div className="asas-pending-banner-icon">
                        <Icon name="clock" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong className="asas-pending-banner-title">
                          يوجد <span className="num">{formatNumber(pendingCount)}</span> طلب تسجيل حساب جديد بانتظار المراجعة
                        </strong>
                        <p className="asas-pending-banner-sub prose">
                          لا يمكن للموظفين الجدد تسجيل الدخول أو إثبات الحضور حتى يتم اعتماد حساباتهم من هنا.
                        </p>
                      </div>
                    </div>
                    <div className="asas-pending-banner-cta">
                      <Button
                        variant="primary"
                        size="sm"
                        icon="checkCircle"
                        onClick={() => { setAccountFilter('pending'); setAccountPage(1); }}
                      >
                        عرض المعلقة ({formatNumber(pendingCount)})
                      </Button>
                    </div>
                  </Glass>
                )}

                {/* 3. Toolbar: Search + View Switcher + Official AI-ASAAS/skills Filter Chips */}
                <Glass className="asas-accounts-toolbar-card">
                  <div className="asas-accounts-toolbar-top">
                    <div className="asas-accounts-search asas-search-box">
                      <input
                        className="input asas-search-input-lg"
                        type="search"
                        placeholder="ابحث بالاسم، الرقم الوظيفي، البريد، الهاتف أو الجهاز…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setAccountPage(1); }}
                      />
                      <div className="asas-search-icon-lg">
                        <Icon name="search" />
                      </div>
                      {search && (
                        <button
                          type="button"
                          className="asas-search-clear-btn"
                          onClick={() => { setSearch(''); setAccountPage(1); }}
                          title="مسح البحث"
                          aria-label="مسح البحث"
                        >
                          <Icon name="close" style={{ width: 15, height: 15 }} />
                        </button>
                      )}
                    </div>

                    <div className="asas-accounts-view-switch">
                      <Segmented
                        label="نمط عرض الموظفين"
                        value={accountViewMode}
                        onChange={setAccountViewMode}
                        options={[
                          { value: 'auto', label: 'تلقائي' },
                          { value: 'table', label: 'جدول' },
                          { value: 'cards', label: 'بطاقات' }
                        ]}
                      />
                    </div>
                  </div>

                  <div className="chips asas-accounts-chips" role="group" aria-label="تصفية حسابات الموظفين">
                    {[
                      { value: 'all', label: 'الكل', count: rows.length },
                      { value: 'active', label: 'النشطون', count: activeCount },
                      { value: 'inside', label: 'حاضر الآن', count: insideCount },
                      { value: 'bound', label: 'أجهزة مقيدة', count: boundDevicesCount },
                      { value: 'pending', label: 'بانتظار الموافقة', count: pendingCount }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className="chip"
                        aria-pressed={accountFilter === opt.value}
                        onClick={() => { setAccountFilter(opt.value); setAccountPage(1); }}
                      >
                        <span>{opt.label}</span>
                        <span className="asas-chip-count num">{formatNumber(opt.count)}</span>
                      </button>
                    ))}
                  </div>
                </Glass>

                {/* 4. Empty State OR Data Views */}
                {!totalCount && !busy ? (
                  <Glass className="card">
                    <EmptyState icon="users" title="لا يوجد موظفون مطابقون">
                      <p style={{ margin: '0 0 12px' }}>
                        لم يتم العثور على حسابات تطابق معايير البحث أو التصفية الحالية.
                      </p>
                      {(search || accountFilter !== 'all') && (
                        <Button
                          variant="glass"
                          size="sm"
                          icon="refresh"
                          onClick={() => { setSearch(''); setAccountFilter('all'); setAccountPage(1); }}
                        >
                          عرض جميع الموظفين
                        </Button>
                      )}
                    </EmptyState>
                  </Glass>
                ) : (
                  <>
                    <div className={`asas-accounts-container ${accountViewMode !== 'auto' ? `view-${accountViewMode}` : ''}`}>
                      {/* 4A. TABLE VIEW (Desktop / Forced Table) */}
                      <Glass className="asas-accounts-table-view asas-accounts-table-shell">
                        <div className="table-wrap asas-table-wrap">
                          <table className="table asas-table asas-accounts-table">
                            <thead>
                              <tr>
                                <th>الموظف</th>
                                <th>حالة اليوم</th>
                                <th>التواصل</th>
                                <th>الجهاز المقيد</th>
                                <th>الدور والحساب</th>
                                <th>الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentAccounts.map(a => (
                                <tr key={a.id} className={!a.active ? 'asas-row-pending' : undefined}>
                                  <td>
                                    <div className="asas-acc-cell-emp">
                                      <UserAvatar user={a} size="sm" onClick={() => setSelectedAccountDetails(a)} />
                                      <div className="asas-acc-cell-emp__meta">
                                        <button
                                          type="button"
                                          className="asas-acc-name-link"
                                          onClick={() => setSelectedAccountDetails(a)}
                                          title="عرض ملف الموظف الكامل"
                                        >
                                          {a.name}
                                        </button>
                                        <div className="asas-acc-sub-row">
                                          <span className="num asas-acc-id">#{a.identifier}</span>
                                          <span className={`pill ${a.is_remote ? 'pill--partial' : 'pill--neutral'} asas-pill-compact`}>
                                            {a.is_remote ? 'عن بعد' : 'حضوري'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  <td>{renderAttendancePill(a.attendance_status, false)}</td>

                                  <td>
                                    <div className="asas-acc-contact-cell">
                                      <span className="asas-acc-contact-email" dir="ltr" title={a.email || ''}>
                                        {a.email || '—'}
                                      </span>
                                      <span className="subtle num" dir="ltr">
                                        {a.phone || '—'}
                                      </span>
                                    </div>
                                  </td>

                                  <td>
                                    {a.bound_device_id ? (
                                      <div className="asas-acc-device-cell">
                                        <span className="pill pill--paid asas-pill-compact">
                                          <Icon name="smartphone" />
                                          <span className="asas-acc-device-name">{a.bound_device_name || 'جوال مقيد'}</span>
                                        </span>
                                        <span className="subtle num" dir="ltr">{a.bound_device_id.slice(0, 12)}…</span>
                                      </div>
                                    ) : (
                                      <span className="pill pill--neutral asas-pill-compact">
                                        <Icon name="unlock" />
                                        غير مقيد
                                      </span>
                                    )}
                                  </td>

                                  <td>
                                    <div className="asas-acc-role-cell">
                                      <span className={`pill ${a.active ? 'pill--paid' : 'pill--partial'} asas-pill-compact`}>
                                        <Icon name={a.active ? 'shieldCheck' : 'clock'} />
                                        {a.active ? (roles[a.role] || a.role) : 'بانتظار الموافقة'}
                                      </span>
                                      {Array.isArray(a.permissions) && a.permissions.length > 0 && (
                                        <span className="subtle" title={a.permissions.join(', ')}>
                                          <span className="num">{formatNumber(a.permissions.length)}</span> صلاحيات مخصصة
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td>
                                    <div className="asas-acc-actions-cell">
                                      {!a.active && can('employees.write') && (
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          icon="checkCircle"
                                          title="قبول طلب التسجيل وتفعيل الحساب فوراً"
                                          onClick={() => approveAccount(a)}
                                        >
                                          تفعيل
                                        </Button>
                                      )}
                                      {can('employees.write') && (
                                        <Button
                                          variant="glass"
                                          size="sm"
                                          icon="edit"
                                          onClick={() => edit('accounts', a)}
                                        >
                                          إدارة
                                        </Button>
                                      )}
                                      <Button
                                        variant="glass"
                                        size="sm"
                                        icon="clock"
                                        title={`إرسال تنبيه دوام فوري لـ (${a.name})`}
                                        onClick={() => handleOpenDirectReminder(a)}
                                      >
                                        تنبيه
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        icon="eye"
                                        label="عرض ملف الموظف"
                                        onClick={() => setSelectedAccountDetails(a)}
                                      />
                                      {can('employees.write') && a.bound_device_id && (
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          icon="unlock"
                                          label="فك قيد الجهاز"
                                          onClick={() => handleResetDevice(a)}
                                        />
                                      )}
                                      {can('employees.write') && a.id !== user.id && (
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          icon="trash"
                                          label={!a.active ? 'رفض وحذف الطلب' : 'حذف الحساب'}
                                          onClick={() => deleteAccount(a)}
                                        />
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Glass>

                      {/* 4B. CARDS VIEW (Auto on Phone & Tablet, or Forced Cards) */}
                      <div className="asas-accounts-cards-view asas-accounts-grid">
                        {currentAccounts.map(a => (
                          <Glass key={a.id} className={`asas-account-card ${!a.active ? 'asas-card-pending' : ''}`}>
                            <div className="asas-account-card-head">
                              <UserAvatar user={a} size="md" onClick={() => setSelectedAccountDetails(a)} />
                              <div className="asas-account-card-meta">
                                <button
                                  type="button"
                                  className="asas-account-card-name"
                                  onClick={() => setSelectedAccountDetails(a)}
                                >
                                  {a.name}
                                </button>
                                <div className="asas-account-card-badges">
                                  <span className="num asas-acc-id">#{a.identifier}</span>
                                  <span className={`pill ${a.is_remote ? 'pill--partial' : 'pill--neutral'} asas-pill-compact`}>
                                    {a.is_remote ? 'عن بعد' : 'حضوري'}
                                  </span>
                                </div>
                              </div>
                              <div className="asas-account-card-status">
                                {renderAttendancePill(a.attendance_status, true)}
                              </div>
                            </div>

                            <div className="asas-account-card-body">
                              <div className="asas-account-card-info-row">
                                <span className="asas-account-card-info-icon"><Icon name="mail" /></span>
                                <div className="asas-account-card-info-text">
                                  <span className="asas-account-card-info-label">البريد</span>
                                  <strong dir="ltr" title={a.email || ''}>{a.email || 'غير مسجل'}</strong>
                                </div>
                              </div>

                              <div className="asas-account-card-info-row">
                                <span className="asas-account-card-info-icon"><Icon name="phone" /></span>
                                <div className="asas-account-card-info-text">
                                  <span className="asas-account-card-info-label">الهاتف</span>
                                  <strong className="num" dir="ltr">{a.phone || 'غير مسجل'}</strong>
                                </div>
                              </div>

                              <div className="asas-account-card-info-row">
                                <span
                                  className="asas-account-card-info-icon"
                                  style={{ color: a.bound_device_id ? 'var(--paid)' : 'var(--text-3)' }}
                                >
                                  <Icon name="smartphone" />
                                </span>
                                <div className="asas-account-card-info-text">
                                  <span className="asas-account-card-info-label">الجهاز المقيد</span>
                                  <strong style={{ color: a.bound_device_id ? 'var(--paid)' : 'var(--text-3)' }}>
                                    {a.bound_device_id ? (a.bound_device_name || 'جوال مقيد') : 'غير مقيد بعد'}
                                  </strong>
                                </div>
                              </div>

                              <div className="asas-account-card-info-row">
                                <span
                                  className="asas-account-card-info-icon"
                                  style={{ color: a.active ? 'var(--accent)' : 'var(--partial)' }}
                                >
                                  <Icon name={a.active ? 'shieldCheck' : 'clock'} />
                                </span>
                                <div className="asas-account-card-info-text">
                                  <span className="asas-account-card-info-label">الدور والحالة</span>
                                  <strong>
                                    {roles[a.role] || a.role}
                                    {!a.active ? ' · بانتظار التفعيل' : ''}
                                  </strong>
                                </div>
                              </div>
                            </div>

                            <div className="asas-account-card-foot">
                              {!a.active && can('employees.write') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon="checkCircle"
                                  className="asas-account-card-approve"
                                  onClick={() => approveAccount(a)}
                                >
                                  قبول وتفعيل الحساب
                                </Button>
                              )}

                              <div className="asas-account-card-foot-row">
                                <div className="asas-account-card-primary-btns">
                                  {can('employees.write') && (
                                    <Button variant="glass" size="sm" icon="edit" onClick={() => edit('accounts', a)}>
                                      إدارة
                                    </Button>
                                  )}
                                  <Button
                                    variant="glass"
                                    size="sm"
                                    icon="clock"
                                    onClick={() => handleOpenDirectReminder(a)}
                                  >
                                    تنبيه
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon="eye"
                                    onClick={() => setSelectedAccountDetails(a)}
                                  >
                                    الملف
                                  </Button>
                                </div>

                                <div className="asas-account-card-danger-btns">
                                  {can('employees.write') && a.bound_device_id && (
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      icon="unlock"
                                      label="فك قيد الجهاز"
                                      onClick={() => handleResetDevice(a)}
                                    />
                                  )}
                                  {can('employees.write') && a.id !== user.id && (
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      icon="trash"
                                      label={!a.active ? 'رفض الطلب' : 'حذف الحساب'}
                                      onClick={() => deleteAccount(a)}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          </Glass>
                        ))}
                      </div>
                    </div>

                    {/* 5. Responsive Pagination Bar */}
                    {totalCount > 0 && (
                      <Glass className="asas-pagination-bar">
                        <div className="asas-pagination-info">
                          عرض <strong className="num">{formatNumber(startIdx + 1)}–{formatNumber(endIdx)}</strong> من <strong className="num">{formatNumber(totalCount)}</strong>
                        </div>

                        {totalPages > 1 && (
                          <div className="asas-pagination-controls">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="chevronRight"
                              disabled={safePage <= 1}
                              onClick={() => setAccountPage(p => Math.max(1, p - 1))}
                              label="الصفحة السابقة"
                            />

                            <div className="asas-pagination-pages">
                              {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                                .map((p, idx, arr) => (
                                  <React.Fragment key={p}>
                                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="asas-pagination-ellipsis">…</span>}
                                    <button
                                      type="button"
                                      className={`asas-page-btn ${safePage === p ? 'active' : ''}`}
                                      onClick={() => setAccountPage(p)}
                                    >
                                      <span className="num">{formatNumber(p)}</span>
                                    </button>
                                  </React.Fragment>
                                ))}
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              icon="chevronLeft"
                              disabled={safePage >= totalPages}
                              onClick={() => setAccountPage(p => Math.min(totalPages, p + 1))}
                              label="الصفحة التالية"
                            />
                          </div>
                        )}

                        <div className="asas-pagination-size">
                          <select
                            className="input asas-pagination-select"
                            value={accountPageSize}
                            onChange={e => { setAccountPageSize(Number(e.target.value)); setAccountPage(1); }}
                            aria-label="عدد الموظفين في الصفحة"
                          >
                            <option value={8}>8 / صفحة</option>
                            <option value={10}>10 / صفحة</option>
                            <option value={15}>15 / صفحة</option>
                            <option value={25}>25 / صفحة</option>
                          </select>
                        </div>
                      </Glass>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* ANNOUNCEMENTS TAB */}
          {tab === 'announcements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <p className="asas-muted prose" style={{ margin: 0 }}>
                  نشر تعميمات وإشعارات رسمية تصل فوراً لهواتف الموظفين وتظهر في التطبيق. اضغط على أي إشعار لعرض الرسالة كاملة.
                </p>
              </div>

              <div className="asas-announcements-grid">
                {announcements.map(a => {
                  const meta = getNotificationPriorityMeta(a.priority);
                  return (
                    <article
                      key={a.id}
                      className={`asas-announcement-card asas-announcement-card--interactive ${a.priority || 'normal'}`}
                      onClick={() => openAnnouncementsCenter(a.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openAnnouncementsCenter(a.id);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.45 }}>
                          {normalizeNotificationPreview(a.title)}
                        </h3>
                        <span className={`pill ${meta.pillClass}`}>
                          <Icon name={meta.icon} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="asas-notif-excerpt" style={{ WebkitLineClamp: 3 }}>
                        {normalizeNotificationPreview(a.content)}
                      </p>
                      <div className="asas-announcement-card__foot">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <Avatar name={a.sender_name || 'الموارد البشرية'} size={26} />
                          <span className="asas-notif-row__meta">
                            <strong style={{ color: 'var(--text-2)' }}>{a.sender_name || 'الموارد البشرية'}</strong>
                            {' · '}
                            <time className="num">{date(a.created_at)}</time>
                          </span>
                        </div>
                        <div className="cluster" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" icon="eye" onClick={() => openAnnouncementsCenter(a.id)}>
                            عرض كامل
                          </Button>
                          {can('employees.write') && (
                            <>
                              <Button variant="ghost" size="sm" icon="edit" label="تعديل التعميم" onClick={() => edit('announcements', a)} />
                              <Button variant="danger" size="sm" icon="trash" label="حذف التعميم" onClick={() => deleteAnnouncement(a.id)} />
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!announcements.length && !busy && (
                <EmptyState icon="bell" title="لا توجد تعميمات رسمية بعد">
                  انشر أول تعميم رسمي ليصل فوراً كإشعار إلى هواتف وحسابات الموظفين.
                </EmptyState>
              )}
            </div>
          )}

          {/* BRANCHES TAB */}
          {tab === 'branches' && (
            <div className="asas-form-grid">
              {rows.map(b => (
                <Glass key={b.id} style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>{b.name}</h2>
                    <span className="asas-badge inside">{b.active ? 'مفعل' : 'متوقف'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
                    <div>نطاق الدخول / الخروج: <strong>{b.entry_radius} / {b.exit_radius} م</strong></div>
                    <div>أقصى هامش خطأ: <strong>{b.max_accuracy} م</strong></div>
                    <div>تأكيد المغادرة: <strong>{b.exit_samples} قراءات / {b.exit_delay_seconds} ثانية</strong></div>
                    <div dir="ltr" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{b.latitude}, {b.longitude}</div>
                  </div>
                  <iframe className="asas-map" src={`https://maps.google.com/maps?q=${b.latitude},${b.longitude}&hl=ar&z=17&output=embed`} loading="lazy" title={`خريطة Google - ${b.name}`} allowFullScreen style={{ width: '100%', height: 160, borderRadius: 12, border: '1px solid var(--hairline)', marginTop: 14 }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {can('locations.write') && (
                      <button
                        className="asas-btn primary sm"
                        onClick={async () => {
                          if (!navigator.geolocation) return setError('خدمة تحديد الموقع غير مدعومة');
                          setBusy(true);
                          setError('');
                          navigator.geolocation.getCurrentPosition(async (pos) => {
                            try {
                              await api(`/admin/branches/${b.id}`, 'PUT', { ...b, latitude: pos.coords.latitude, longitude: pos.coords.longitude, reason: 'تحديث إحداثيات الفرع إلى موقع الجهاز الحالي' });
                              setNotice(`تم تعيين موقع الفرع بنجاح على إحداثيات جهازك الحالية (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`);
                              await load();
                            } catch (e) { setError(e.message); } finally { setBusy(false); }
                          }, (err) => {
                            setError('تعذر قراءة الموقع: ' + err.message);
                            setBusy(false);
                          }, { enableHighAccuracy: true, timeout: 15000 });
                        }}
                      >
                        <Icon name="crosshair" />
                        تعيين بموقعي الحالي
                      </button>
                    )}
                    {can('locations.write') && (
                      <button className="asas-btn sm" onClick={() => edit('branches', b)}>
                        <Icon name="edit" />
                        تعديل
                      </button>
                    )}
                  </div>
                </Glass>
              ))}
              {!rows.length && !busy && <Empty>أضف موقع الشركة الفعلي للبدء.</Empty>}
            </div>
          )}

          {/* SHIFTS TAB — سياسات وجداول الدوام + نظام التذكير والتنبيه الفوري بالدوام */}
          {tab === 'shifts' && (
            <div className="asas-shifts-page">
              {/* 1. Sovereign Duty Reminders & Live Alert Dispatch Card */}
              <Card
                title="خاصية التذكير والتنبيه الدوري بالدوام"
                icon="clock"
                badge={
                  <span className={`pill ${systemSettings.duty_reminder_enabled !== false ? 'pill--paid' : 'pill--partial'}`}>
                    <Icon name={systemSettings.duty_reminder_enabled !== false ? 'checkCircle' : 'clock'} />
                    {systemSettings.duty_reminder_enabled !== false ? 'التذكير الدوري مفعّل' : 'التذكير التلقائي معطّل'}
                  </span>
                }
              >
                <div className="asas-shifts-reminder-card">
                  {/* KPI metric tiles */}
                  <div className="asas-shifts-kpi-grid">
                    <div className="asas-shifts-kpi-tile">
                      <span className="asas-shifts-kpi-title">
                        <Icon name="users" />
                        الحاضرون على رأس العمل
                      </span>
                      <strong className="asas-shifts-kpi-val num" style={{ color: 'var(--paid)' }}>
                        {formatNumber(dutyLiveStats.inside || data?.inside || 0)}
                      </strong>
                      <span className="asas-shifts-kpi-sub">الموظفون المتواجدون داخل النطاق حالياً</span>
                    </div>

                    <div className="asas-shifts-kpi-tile">
                      <span className="asas-shifts-kpi-title">
                        <Icon name="clock" />
                        دورية التذكير المعتمدة
                      </span>
                      <strong className="asas-shifts-kpi-val num" style={{ color: 'var(--accent)' }}>
                        كل {formatNumber(systemSettings.duty_reminder_interval_hours || 2)} ساعات
                      </strong>
                      <span className="asas-shifts-kpi-sub">تنبيه آلي يرسل أثناء ساعات العمل</span>
                    </div>

                    <div className="asas-shifts-kpi-tile">
                      <span className="asas-shifts-kpi-title">
                        <Icon name="shieldCheck" />
                        إجمالي حسابات الموظفين
                      </span>
                      <strong className="asas-shifts-kpi-val num">
                        {formatNumber(dutyLiveStats.total || data?.total || allEmployees.length || 0)}
                      </strong>
                      <span className="asas-shifts-kpi-sub">الحسابات النشطة المصرح لها بالدوام</span>
                    </div>
                  </div>

                  {/* Dual Power Panels: 1) Edit & Save Automation Policy, 2) Instant Broadcast & Send */}
                  <div className="asas-shifts-dual-grid">
                    {/* Panel 1: تعديل وضبط سياسة التذكير الآلي */}
                    <div className="asas-shifts-panel">
                      <div className="asas-shifts-panel-head">
                        <div>
                          <h3 className="asas-shifts-panel-title">
                            <Icon name="settings" style={{ color: 'var(--accent)' }} />
                            تعديل وضبط سياسة التذكير التلقائي
                          </h3>
                          <p className="asas-shifts-panel-desc">
                            التحكم في دورية التنبيهات التلقائية المرسلة لأجهزة الموظفين لإثبات الحضور والاستمرار.
                          </p>
                        </div>
                      </div>

                      <div className="asas-shifts-panel-body">
                        <label className="asas-check" style={{ fontSize: 13.5, fontWeight: 700, margin: '4px 0' }}>
                          <input
                            type="checkbox"
                            checked={systemSettings.duty_reminder_enabled !== false}
                            onChange={(e) => setSystemSettings(prev => ({ ...prev, duty_reminder_enabled: e.target.checked }))}
                          />
                          <span>تفعيل التذكير التلقائي أثناء ساعات الدوام</span>
                        </label>

                        <div className="asas-modern-field-group">
                          <label className="asas-modern-field-label">تكرار التذكير الدوري:</label>
                          <select
                            className="input"
                            style={{ height: 42 }}
                            value={systemSettings.duty_reminder_interval_hours || 2}
                            onChange={(e) => setSystemSettings(prev => ({ ...prev, duty_reminder_interval_hours: Number(e.target.value) }))}
                          >
                            <option value={1}>كل ساعة واحدة (تنبيه مكثف)</option>
                            <option value={2}>كل ساعتين (الافتراضي الموصى به لمنظومة أساس)</option>
                            <option value={3}>كل 3 ساعات</option>
                            <option value={4}>كل 4 ساعات (نصف يوم عمل)</option>
                          </select>
                        </div>

                        <label className="asas-check" style={{ fontSize: 13, color: 'var(--text-2)', margin: '2px 0' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(systemSettings.email_notifications)}
                            onChange={(e) => setSystemSettings(prev => ({ ...prev, email_notifications: e.target.checked }))}
                          />
                          <span>إرسال بريد إلكتروني تذكيري بالإضافة لإشعار الجوال اللحظي</span>
                        </label>

                        <p className="subtle prose" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.55 }}>
                          يتم إرسال إشعار Web Push للجوال مع تنبيه صوتي حتى لو كان التطبيق مغلقاً.
                        </p>
                      </div>

                      <div className="asas-shifts-panel-foot">
                        <Button
                          variant="primary"
                          size="sm"
                          icon="check"
                          loading={savingReminderPolicy}
                          disabled={savingReminderPolicy}
                          onClick={() => handleSaveReminderPolicy()}
                        >
                          حفظ وتطبيق سياسة التذكير
                        </Button>
                      </div>
                    </div>

                    {/* Panel 2: نشر وإرسال تنبيه فوري لحظي */}
                    <div className="asas-shifts-panel">
                      <div className="asas-shifts-panel-head">
                        <div>
                          <h3 className="asas-shifts-panel-title">
                            <Icon name="send" style={{ color: 'var(--accent)' }} />
                            نشر وإرسال تنبيه فوري مباشر
                          </h3>
                          <p className="asas-shifts-panel-desc">
                            بث إشعار فوري وتنبيه صوتي لحظي لأجهزة الموظفين لتأكيد الحضور أو إرسال تعليمات إدارية.
                          </p>
                        </div>
                      </div>

                      <div className="asas-shifts-panel-body">
                        <div>
                          <label className="asas-modern-field-label" style={{ display: 'block', marginBottom: 6 }}>
                            فئة المستهدفين بالنشر:
                          </label>
                          <div className="asas-notif-toolbar">
                            <Segmented
                              label="فئة المستهدفين"
                              value={reminderTarget}
                              onChange={(val) => {
                                setReminderTarget(val);
                                if (val !== 'employee') setSelectedReminderEmployee(null);
                              }}
                              options={[
                                { value: 'inside', label: 'المتواجدون حالياً', count: dutyLiveStats.inside || data?.inside || 0 },
                                { value: 'employee', label: 'موظف محدد' },
                                { value: 'all', label: 'كافة الموظفين', count: dutyLiveStats.total || data?.total || allEmployees.length || 0 }
                              ]}
                            />
                          </div>
                        </div>

                        {reminderTarget === 'employee' && (
                          <div className="asas-modern-field-group">
                            <label className="asas-modern-field-label">اختر الموظف المراد تنبيهه:</label>
                            <select
                              className="input"
                              style={{ height: 42 }}
                              value={selectedReminderEmployee?.id || ''}
                              onChange={(e) => {
                                const idNum = Number(e.target.value);
                                const pool = allEmployees.length ? allEmployees : (data?.records || []).map(r => ({ id: r.employee_id, name: r.name, identifier: r.identifier }));
                                const found = pool.find(x => (x.id === idNum || x.employee_id === idNum));
                                setSelectedReminderEmployee(found ? { id: found.id || found.employee_id, name: found.name, identifier: found.identifier } : null);
                              }}
                            >
                              <option value="">-- اضغط لاختيار الموظف --</option>
                              {(allEmployees.length ? allEmployees : (data?.records || []).map(r => ({ id: r.employee_id, name: r.name, identifier: r.identifier }))).map(emp => {
                                const isInside = (data?.records || []).some(r => (r.employee_id === emp.id || r.id === emp.id) && r.state === 'inside');
                                return (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name} (#{emp.identifier}) {isInside ? '🟢 متواجد بالدوام' : '⚪ خارج الدوام'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        <div className="asas-modern-field-group">
                          <label className="asas-modern-field-label">نص رسالة التنبيه (اختياري أو مخصص):</label>
                          <textarea
                            className="input"
                            rows={2}
                            placeholder="اكتب رسالة التنبيه التي ستصل لجوال الموظف فوراً..."
                            value={reminderCustomNote}
                            onChange={(e) => setReminderCustomNote(e.target.value)}
                            style={{ height: 'auto', minHeight: 64, resize: 'vertical', padding: '8px 12px' }}
                          />
                          <div className="asas-shifts-templates-bar">
                            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>قوالب سريعة:</span>
                            {[
                              { label: 'تأكيد الحضور', text: 'يرجى تأكيد استمرار تواجدك على رأس العمل لتوثيق ساعات الدوام بدقة.' },
                              { label: 'تقرير المهام', text: 'تذكير: يرجى استكمال وتسليم تقرير الإنجاز اليومي قبل انتهاء فترة الدوام.' },
                              { label: 'تنبيه إداري', text: 'تنبيه إداري رسمي: يرجى التواجد في مقر العمل والالتزام بنظام الحضور المعتمد.' }
                            ].map((tpl, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="chip asas-shifts-template-chip"
                                onClick={() => setReminderCustomNote(tpl.text)}
                              >
                                {tpl.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="asas-shifts-panel-foot">
                        <Button
                          variant="primary"
                          size="sm"
                          icon="send"
                          loading={triggeringReminder}
                          disabled={triggeringReminder || (reminderTarget === 'employee' && !selectedReminderEmployee)}
                          onClick={handleTriggerManualReminder}
                        >
                          {reminderTarget === 'employee'
                            ? (selectedReminderEmployee ? `نشر التنبيه لـ ${firstName(selectedReminderEmployee.name)}` : 'اختر موظفاً أولاً')
                            : `نشر التنبيه الفوري الآن (${formatNumber(reminderTarget === 'inside' ? (dutyLiveStats.inside || data?.inside || 0) : (dutyLiveStats.total || data?.total || allEmployees.length || 0))})`}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 2. Shift Schedules Section */}
              <div className="asas-shifts-section-head">
                <div>
                  <h2 className="asas-shifts-section-title">جداول وسياسات احتساب ساعات الدوام</h2>
                  <p className="asas-shifts-section-desc">مواعيد الدوام المعتمدة، فترات السماح، وسياسات إغلاق السجلات.</p>
                </div>
                {can('shifts.write') && (
                  <Button variant="primary" size="sm" icon="plus" onClick={() => edit('shifts', null)}>
                    إضافة جدول دوام جديد
                  </Button>
                )}
              </div>

              <div className="asas-form-grid">
                {rows.map(s => (
                  <Glass key={s.id} style={{ padding: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="asas-tile-icon">
                          <Icon name="clock" width={14} height={14} />
                        </div>
                        <div>
                          <p className="asas-eyebrow" style={{ fontSize: 11, marginBottom: 2 }}>سياسة واحتساب الدوام</p>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{s.name}</h3>
                        </div>
                      </div>
                      <span className="asas-badge inside" style={{ fontSize: 11, padding: '4px 9px', borderRadius: 6, flexShrink: 0 }}>
                        {s.close_policy === 'scheduled' ? 'إغلاق تلقائي' : 'انصراف فعلي'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--glass-inset)', borderRadius: 10, border: '1px solid var(--hairline)' }}>
                        <span>ساعات العمل المعتمدة:</span>
                        <strong dir="ltr" style={{ color: 'var(--accent)', fontFamily: 'var(--font)', fontSize: 14 }}>
                          {s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>فترة السماح بالدخول:</span>
                        <strong>{s.grace_minutes || 0} دقيقة</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>خصم مدد المغادرة:</span>
                        <span className={`asas-badge ${s.deduct_away ? 'urgent' : 'inside'}`} style={{ fontSize: 11, borderRadius: 6 }}>
                          {s.deduct_away ? 'مفعّل' : 'غير مفعّل'}
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>أيام العمل المعتمدة:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {[
                          { d: 6, n: 'السبت' },
                          { d: 0, n: 'الأحد' },
                          { d: 1, n: 'الإثنين' },
                          { d: 2, n: 'الثلاثاء' },
                          { d: 3, n: 'الأربعاء' },
                          { d: 4, n: 'الخميس' },
                          { d: 5, n: 'الجمعة' }
                        ].map(item => {
                          const isWork = (s.work_days || []).includes(item.d);
                          return (
                            <span
                              key={item.d}
                              style={{
                                fontSize: 10.5,
                                padding: '2px 6px',
                                borderRadius: 5,
                                background: isWork ? 'var(--glass-tint-strong)' : 'var(--glass-inset)',
                                color: isWork ? 'var(--accent)' : 'var(--text-3)',
                                border: isWork ? '1px solid var(--accent)' : '1px solid transparent',
                                fontWeight: isWork ? 700 : 400
                              }}
                            >
                              {item.n}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {can('shifts.write') && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button className="asas-btn sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => edit('shifts', s)}>
                          <Icon name="edit" />
                          تعديل السياسة
                        </button>
                        <button
                          className="asas-btn sm danger"
                          title="حذف هذا الدوام"
                          style={{ padding: '0 10px' }}
                          onClick={() => deleteShift(s)}
                        >
                          <Icon name="trash" />
                          حذف
                        </button>
                      </div>
                    )}
                  </Glass>
                ))}
                {!rows.length && !busy && <Empty>أضف جدول دوام لتحديده للموظفين.</Empty>}
              </div>
            </div>
          )}

          {/* QR CODES TAB */}
          {tab === 'qr' && (
            <Card title="رموز الحضور والانصراف المعتمدة" icon="qrCode">
              <div className="asas-qr-page">
                <div className="asas-qr-toolbar">
                  <select
                    className="input asas-qr-branch-select"
                    value={branchId}
                    onChange={e => {
                      const nextId = e.target.value;
                      setBranchId(nextId);
                      if (nextId) showQr(nextId);
                      else setQr(null);
                    }}
                  >
                    <option value="">اختر الفرع لعرض الرموز</option>
                    {branches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <Button variant="primary" icon="qrCode" onClick={() => showQr()} disabled={!branchId || busy} loading={busy}>
                    تحديث الرموز
                  </Button>
                </div>

                {qr ? (
                  <div className="asas-qr-content">
                    {(() => {
                      const fixUrl = (u) => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://attendance.ai-asaas.com';
                        if (!u) return `${origin}`;
                        try {
                          const p = new URL(u, origin);
                          return `${origin}${p.search}${p.hash}`;
                        } catch (e) {
                          return `${origin}`;
                        }
                      };
                      const enterUrl = fixUrl(qr.enter?.url || qr.url);
                      const exitUrl = fixUrl(qr.exit?.url || qr.url);

                      return (
                        <>
                          <div className="asas-qr-branch-head">
                            <div style={{ minWidth: 0 }}>
                              <h2 className="asas-qr-branch-title">{qr.branch}</h2>
                              <p className="subtle prose" style={{ margin: '4px 0 0' }}>
                                رموز QR الدائمة المشفرة بـ HMAC-SHA256 · صالحة ومستمرة حتى الإبطال الإداري
                              </p>
                            </div>
                            <div className="asas-qr-branch-actions">
                              <Button variant="primary" size="sm" icon="printer" onClick={() => setShowPrintModal('both')}>
                                معاينة وطباعة ملصق A4
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon="trash"
                                onClick={async () => {
                                  const reason = window.prompt('سبب إبطال الرموز وتجديدها:');
                                  if (!reason) return;
                                  try {
                                    await api(`/admin/branches/${branchId}/qr/revoke`, 'POST', { reason });
                                    setQr(null);
                                    setNotice('تم إبطال الرموز وإصدار مراجعة جديدة بنجاح.');
                                  } catch (e) { setError(e.message); }
                                }}
                              >
                                إبطال وتجديد
                              </Button>
                            </div>
                          </div>

                          <div className="asas-qr-grid">
                            <div className="asas-qr-card">
                              <span className="pill pill--paid">
                                <Icon name="checkCircle" />
                                كود الحضور (دخول فقط)
                              </span>
                              <div className="asas-qr-box">
                                <QRCodeSVG id="qr-enter-svg" value={enterUrl} size={200} level="M" includeMargin />
                              </div>
                              <p className="subtle prose asas-qr-card-desc">
                                يُعلق عند المدخل · مخصص حصرياً لتسجيل الدخول والعودة
                              </p>
                              <div className="asas-qr-card-actions">
                                <a className="btn btn--primary btn--sm asas-qr-card-primary-action" href={enterUrl} target="_blank" rel="noreferrer">
                                  <Icon name="logIn" />
                                  فتح الدخول
                                </a>
                                <Button variant="glass" size="sm" icon="printer" onClick={() => setShowPrintModal('enter')}>
                                  طباعة A4
                                </Button>
                                <Button variant="ghost" size="sm" icon="download" onClick={() => downloadQrPng('qr-enter-svg', `كود-دخول-${qr.branch}`)}>
                                  تنزيل PNG
                                </Button>
                              </div>
                            </div>

                            <div className="asas-qr-card">
                              <span className="pill pill--unpaid">
                                <Icon name="logout" />
                                كود الانصراف (خروج فقط)
                              </span>
                              <div className="asas-qr-box">
                                <QRCodeSVG id="qr-exit-svg" value={exitUrl} size={200} level="M" includeMargin />
                              </div>
                              <p className="subtle prose asas-qr-card-desc">
                                يُعلق عند المخرج · مخصص حصرياً لتسجيل الانصراف وإنهاء الدوام
                              </p>
                              <div className="asas-qr-card-actions">
                                <a className="btn btn--danger btn--sm asas-qr-card-primary-action" href={exitUrl} target="_blank" rel="noreferrer">
                                  <Icon name="logout" />
                                  فتح الخروج
                                </a>
                                <Button variant="glass" size="sm" icon="printer" onClick={() => setShowPrintModal('exit')}>
                                  طباعة A4
                                </Button>
                                <Button variant="ghost" size="sm" icon="download" onClick={() => downloadQrPng('qr-exit-svg', `كود-انصراف-${qr.branch}`)}>
                                  تنزيل PNG
                                </Button>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <EmptyState icon="qrCode" title="اختر الفرع لعرض رموز التحضير">
                    حدد الفرع من القائمة أعلاه ثم اضغط على «عرض الرموز المعتمدة» لمعاينتها وطباعتها.
                  </EmptyState>
                )}
              </div>
            </Card>
          )}

          {/* LEAVE REQUESTS TAB */}
          {tab === 'leave' && (
            <Card title="طلبات الإجازات والمراجعة" icon="receipt">
              <div className="asas-leave-container">
                {/* 1. TABLE VIEW (Desktop / Tablet) */}
                <div className="asas-leave-table-view asas-table-wrap">
                  <table className="asas-table">
                    <thead>
                      <tr>
                        <th>الموظف</th>
                        <th>الفترة</th>
                        <th>السبب</th>
                        <th>الحالة</th>
                        <th>المراجعة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(l => (
                        <tr key={l.id}>
                          <td><strong>{l.name}</strong></td>
                          <td>{date(l.from_date)} — {date(l.to_date)}</td>
                          <td style={{ whiteSpace: 'normal' }}>{l.reason}</td>
                          <td><span className={`asas-badge ${l.status}`}>{states[l.status] || l.status}</span></td>
                          <td>
                            {l.status === 'pending' && can('leave.review') && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="asas-btn primary sm" onClick={async () => {
                                  const comment = window.prompt('ملاحظة القبول:');
                                  if (!comment) return;
                                  try {
                                    await api(`/leave/${l.id}`, 'PATCH', { status: 'approved', comment });
                                    await load();
                                  } catch (e) { setError(e.message); }
                                }}>
                                  <Icon name="check" />
                                  قبول
                                </button>
                                <button className="asas-btn danger sm" onClick={async () => {
                                  const comment = window.prompt('سبب الرفض:');
                                  if (!comment) return;
                                  try {
                                    await api(`/leave/${l.id}`, 'PATCH', { status: 'rejected', comment });
                                    await load();
                                  } catch (e) { setError(e.message); }
                                }}>
                                  <Icon name="close" />
                                  رفض
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rows.length && !busy && <Empty>لا توجد طلبات إجازة جديدة.</Empty>}
                </div>

                {/* 2. CARDS VIEW (Phone first, liquid-glass) */}
                <div className="asas-leave-cards-view">
                  {rows.map(l => (
                    <Glass key={l.id} className="asas-leave-card">
                      <div className="asas-leave-card-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          <UserAvatar user={{ name: l.name }} size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ fontSize: 14.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.name}
                            </strong>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                              الفترة: <strong className="num" dir="ltr">{date(l.from_date)}</strong> إلى <strong className="num" dir="ltr">{date(l.to_date)}</strong>
                            </div>
                          </div>
                        </div>
                        <span className={`asas-badge ${l.status}`}>{states[l.status] || l.status}</span>
                      </div>

                      <div className="asas-leave-card-body">
                        <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>سبب الإجازة:</span>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{l.reason}</p>
                      </div>

                      {l.status === 'pending' && can('leave.review') && (
                        <div className="asas-leave-card-actions">
                          <button
                            className="asas-btn primary sm"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={async () => {
                              const comment = window.prompt('ملاحظة القبول:');
                              if (!comment) return;
                              try {
                                await api(`/leave/${l.id}`, 'PATCH', { status: 'approved', comment });
                                await load();
                              } catch (e) { setError(e.message); }
                            }}
                          >
                            <Icon name="check" />
                            قبول الطلب
                          </button>
                          <button
                            className="asas-btn danger sm"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={async () => {
                              const comment = window.prompt('سبب الرفض:');
                              if (!comment) return;
                              try {
                                await api(`/leave/${l.id}`, 'PATCH', { status: 'rejected', comment });
                                await load();
                              } catch (e) { setError(e.message); }
                            }}
                          >
                            <Icon name="close" />
                            رفض
                          </button>
                        </div>
                      )}
                    </Glass>
                  ))}
                  {!rows.length && !busy && <Empty>لا توجد طلبات إجازة جديدة.</Empty>}
                </div>
              </div>
            </Card>
          )}

          {/* AUDIT LOG TAB */}
          {tab === 'audit' && (
            <Card title="سجل العمليات والرقابة السيادية" icon="shieldCheck">
              <div className="asas-audit-container">
                {/* 1. TABLE VIEW (Desktop / Tablet) */}
                <div className="asas-audit-table-view asas-table-wrap">
                  <table className="asas-table">
                    <thead>
                      <tr>
                        <th>التوقيت</th>
                        <th>المستخدم</th>
                        <th>العملية</th>
                        <th>السبب والتفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(a => (
                        <tr key={a.id}>
                          <td>{date(a.created_at)} {time(a.created_at)}</td>
                          <td><strong>{a.actor || 'النظام'}</strong></td>
                          <td dir="ltr"><code>{a.action}</code></td>
                          <td>{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rows.length && !busy && <Empty />}
                </div>

                {/* 2. CARDS VIEW (Phone first, liquid-glass) */}
                <div className="asas-audit-cards-view">
                  {rows.map(a => (
                    <Glass key={a.id} className="asas-audit-card">
                      <div className="asas-audit-card-head">
                        <div>
                          <strong style={{ fontSize: 14 }}>{a.actor || 'النظام'}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {date(a.created_at)} {time(a.created_at)}
                          </div>
                        </div>
                        <code dir="ltr" style={{ fontSize: 11.5, padding: '3px 7px', background: 'var(--glass-inset)', borderRadius: 6, color: 'var(--accent)' }}>
                          {a.action}
                        </code>
                      </div>
                      <div className="asas-audit-card-body" style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>
                        {a.reason}
                      </div>
                    </Glass>
                  ))}
                  {!rows.length && !busy && <Empty />}
                </div>
              </div>
            </Card>
          )}

          {/* SYSTEM SETTINGS TAB */}
          {tab === 'settings' && (
            <form onSubmit={saveSystemSettings} className="asas-form-grid">
              <Glass style={{ gridColumn: '1 / -1', padding: 'clamp(16px, 2.5vw, 26px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 20 }}>إعدادات النظام وسياسات التشغيل الحقيقية</h2>
                  <div className="asas-tile-icon" style={{ width: 30, height: 30 }}>
                    <Icon name="settings" width={15} height={15} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="asas-form-grid">
                    <Field
                      label="اسم المنشأة / الشركة الرسمي"
                      value={systemSettings.company_name || ''}
                      onChange={e => setSystemSettings({ ...systemSettings, company_name: e.target.value })}
                      required
                    />
                    <Field
                      label="المنطقة الزمنية المعتمدة للنظام"
                      value={systemSettings.timezone || 'Asia/Aden'}
                      onChange={e => setSystemSettings({ ...systemSettings, timezone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="asas-form-grid">
                    <Field
                      label="أقصى هامش خطأ مسموح به لقراءة GPS (بالمتر)"
                      type="number"
                      min={10}
                      max={1000}
                      value={systemSettings.max_gps_accuracy || 250}
                      onChange={e => setSystemSettings({ ...systemSettings, max_gps_accuracy: Number(e.target.value) })}
                      required
                    />
                    <Field
                      label="هاتف الدعم الفني وخدمة العملاء"
                      value={systemSettings.support_contact || ''}
                      onChange={e => setSystemSettings({ ...systemSettings, support_contact: e.target.value })}
                    />
                  </div>

                  <label className="asas-check" style={{ marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(systemSettings.email_notifications)}
                      onChange={e => setSystemSettings({ ...systemSettings, email_notifications: e.target.checked })}
                    />
                    تفعيل إشعارات البريد الإلكتروني للمدراء عند تسجيل الحضور والغياب
                  </label>

                  <div style={{ marginTop: 12, padding: '14px', background: 'var(--surface-sunken)', borderRadius: 10, border: '1px solid var(--hairline)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <label className="asas-check" style={{ margin: 0, fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={systemSettings.duty_reminder_enabled !== false}
                          onChange={e => setSystemSettings({ ...systemSettings, duty_reminder_enabled: e.target.checked })}
                        />
                        🔔 تفعيل نظام الإشعارات وتذكير الدوام الدوري أثناء العمل
                      </label>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>التذكير كل:</span>
                        <select
                          className="asas-select"
                          style={{ width: 'auto', minWidth: 120, padding: '4px 10px', fontSize: 13 }}
                          value={systemSettings.duty_reminder_interval_hours || 2}
                          onChange={e => setSystemSettings({ ...systemSettings, duty_reminder_interval_hours: Number(e.target.value) })}
                        >
                          <option value={1}>ساعة واحدة</option>
                          <option value={2}>ساعتان (افتراضي وموصى به)</option>
                          <option value={3}>3 ساعات</option>
                          <option value={4}>4 ساعات</option>
                        </select>
                      </div>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                      يرسل تنبيهات متصفح وإشعارات فورية للموظف أثناء تواجده في الدوام لتأكيد استمرار حضوره وتفقد حالته.
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 18, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <strong style={{ fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="sparkle" style={{ width: 17, height: 17, color: 'var(--accent)' }} />
                        إعدادات المساعد الذكي (Free AI API والقيود العامة)
                      </strong>
                      <span className="asas-badge inside">{systemSettings.assistant_provider_name || 'Pollinations Free AI'}</span>
                    </div>

                    <div className="asas-form-grid">
                      <Field
                        label="رابط API المزود المجاني (OpenAI-Compatible)"
                        dir="ltr"
                        value={systemSettings.assistant_api_url || 'https://api.llm7.io/v1/chat/completions'}
                        onChange={e => setSystemSettings({ ...systemSettings, assistant_api_url: e.target.value })}
                      />
                      <Field
                        label="اسم النموذج المجاني (Model)"
                        dir="ltr"
                        value={systemSettings.assistant_model || 'mistral-Nemo-Instruct-2407'}
                        onChange={e => setSystemSettings({ ...systemSettings, assistant_model: e.target.value })}
                      />
                    </div>

                    <div className="asas-form-grid">
                      <Field
                        label="الحصة اليومية الافتراضية للموظف (سؤال/يوم)"
                        type="number"
                        min={1}
                        max={500}
                        value={systemSettings.assistant_daily_quota_employee ?? 20}
                        onChange={e => setSystemSettings({ ...systemSettings, assistant_daily_quota_employee: Number(e.target.value) })}
                      />
                      <Field
                        label="الحصة اليومية الافتراضية للمدير (سؤال/يوم)"
                        type="number"
                        min={1}
                        max={2000}
                        value={systemSettings.assistant_daily_quota_admin ?? 100}
                        onChange={e => setSystemSettings({ ...systemSettings, assistant_daily_quota_admin: Number(e.target.value) })}
                      />
                      <Field
                        label="الحد الأقصى لطول رسالة المستخدم (حرف)"
                        type="number"
                        min={50}
                        max={2000}
                        value={systemSettings.assistant_max_chars ?? 800}
                        onChange={e => setSystemSettings({ ...systemSettings, assistant_max_chars: Number(e.target.value) })}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={systemSettings.assistant_enabled !== false}
                          onChange={e => setSystemSettings({ ...systemSettings, assistant_enabled: e.target.checked })}
                        />
                        تفعيل المساعد الذكي على مستوى النظام بالكامل
                      </label>
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={systemSettings.assistant_strict_topic !== false}
                          onChange={e => setSystemSettings({ ...systemSettings, assistant_strict_topic: e.target.checked })}
                        />
                        فرض القيد الصارم (حظر الأسئلة خارج نطاق الدوام والعمل ومنع محاولات حقن الأوامر)
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <button className="asas-btn primary" type="submit" disabled={busy}>
                      <Icon name="check" />
                      {busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات في قاعدة البيانات'}
                    </button>
                  </div>
                </div>
              </Glass>

              <Glass style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>أمان البيانات والتشفير</h3>
                  <div className="asas-tile-icon">
                    <Icon name="vault" width={14} height={14} />
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>تشفير كلمات المرور: <strong>scrypt KDF مع Salt فريد</strong></div>
                  <div>توقيع رموز QR: <strong>HMAC-SHA256 مع مفتاح سري</strong></div>
                  <div>جلسات العمل: <strong>رموز Bearer مشفرة بـ SHA-256</strong></div>
                </div>
              </Glass>

              <Glass style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>الهوية والخطوط</h3>
                  <div className="asas-tile-icon">
                    <Icon name="sparkle" width={14} height={14} />
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>الفحمي الأساسي (Ink): <code dir="ltr">#221F1F</code></div>
                  <div>الذهبي الملكي (Gold): <code dir="ltr">#BA9555</code></div>
                  <div>الكريمي والرملي (Cream / Sand): <code dir="ltr">#EDE7DA / #D3C6B4</code></div>
                  <div>الشعار والمبدأ: <strong>لذكاء أكثر سيادة</strong></div>
                  <div>الخطوط المعتمدة: <strong>Thmanyah Sans / Serif Display &amp; Text</strong></div>
                </div>
              </Glass>
            </form>
          )}
        </main>

        <TabBar label="التنقل السريع">
          <a
            href="#dashboard"
            aria-current={tab === 'dashboard' ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); selectAdminTab('dashboard'); }}
          >
            <Icon name="dashboard" />
            نظرة عامة
          </a>
          <a
            href="#records"
            aria-current={tab === 'records' ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); selectAdminTab('records'); }}
          >
            <Icon name="calendar" />
            الحضور
          </a>
          {can('employees.read') && (
            <a
              href="#accounts"
              aria-current={tab === 'accounts' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); selectAdminTab('accounts'); }}
            >
              <Icon name="users" />
              الموظفون
            </a>
          )}
          <a
            href="#leave"
            aria-current={tab === 'leave' ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); selectAdminTab('leave'); }}
          >
            <Icon name="receipt" />
            الإجازات
          </a>
          <a
            href="#settings"
            aria-current={tab === 'settings' ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); selectAdminTab('settings'); }}
          >
            <Icon name="settings" />
            الإعدادات
          </a>
        </TabBar>
      </div>

      <AsasAssistant user={user} isAdmin />

      {/* MODALS */}
      {showAnnouncementsModal && (
        <AnnouncementsModal
          announcements={announcements}
          initialSelectedId={selectedAnnouncementId}
          directNotification={directPushNotification}
          onClearDirectNotification={() => setDirectPushNotification(null)}
          onClose={() => {
            setShowAnnouncementsModal(false);
            setSelectedAnnouncementId(null);
            setDirectPushNotification(null);
          }}
          onMarkRead={markAnnouncementAsRead}
          onMarkAllRead={markAnnouncementsAsRead}
          canManage={can('employees.write')}
          onEdit={(a) => {
            setShowAnnouncementsModal(false);
            setSelectedAnnouncementId(null);
            setDirectPushNotification(null);
            edit('announcements', a);
          }}
          onDelete={async (id) => {
            await deleteAnnouncement(id);
          }}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onUpdated={(u) => setUser(u)}
        />
      )}

      {showInstallModal && (
        <InstallAppModal
          onClose={() => setShowInstallModal(false)}
          installPrompt={installPrompt}
        />
      )}

      {showDutyReminderModal && (
        <Modal
          title={
            <div className="asas-modal-title-row">
              <Icon name="clock" style={{ color: 'var(--accent)' }} />
              <Swash>تذكير وتنبيه الدوام الفوري</Swash>
            </div>
          }
          onClose={() => setShowDutyReminderModal(false)}
          footer={
            <div className="asas-modal-footer-bar">
              <Button variant="ghost" size="sm" onClick={() => setShowDutyReminderModal(false)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="clock"
                loading={triggeringReminder}
                disabled={triggeringReminder || (reminderTarget === 'employee' && !selectedReminderEmployee)}
                onClick={handleTriggerManualReminder}
              >
                {reminderTarget === 'employee'
                  ? (selectedReminderEmployee ? `إرسال لـ ${firstName(selectedReminderEmployee.name)}` : 'اختر موظفاً أولاً')
                  : `إرسال الآن (${formatNumber(reminderTarget === 'inside' ? (data?.inside || 0) : (data?.total || 0))})`}
              </Button>
            </div>
          }
        >
          <div className="asas-notif-center">
            {/* Segmented Target Switcher */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                فئة المستهدفين بالإرسال:
              </label>
              <div className="asas-notif-toolbar">
                <Segmented
                  label="فئة المستهدفين"
                  value={reminderTarget}
                  onChange={(val) => {
                    setReminderTarget(val);
                    if (val !== 'employee') setSelectedReminderEmployee(null);
                  }}
                  options={[
                    { value: 'inside', label: 'المتواجدون', count: data?.inside || 0 },
                    { value: 'employee', label: 'موظف محدد' },
                    { value: 'all', label: 'الجميع', count: data?.total || 0 }
                  ]}
                />
              </div>
            </div>

            {/* Employee Selector & Custom Note when Single Employee is chosen */}
            {reminderTarget === 'employee' && (
              <Glass className="card" style={{ padding: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text)' }}>
                  حدد الموظف المراد تنبيهه مباشرة:
                </label>
                <select
                  className="asas-input"
                  style={{ marginBottom: 12, height: 42 }}
                  value={selectedReminderEmployee?.id || ''}
                  onChange={(e) => {
                    const idNum = Number(e.target.value);
                    const pool = allEmployees.length ? allEmployees : (data?.records || []).map(r => ({ id: r.employee_id, name: r.name, identifier: r.identifier }));
                    const found = pool.find(x => (x.id === idNum || x.employee_id === idNum));
                    setSelectedReminderEmployee(found ? { id: found.id || found.employee_id, name: found.name, identifier: found.identifier } : null);
                  }}
                >
                  <option value="">-- اضغط لاختيار الموظف من القائمة --</option>
                  {(allEmployees.length ? allEmployees : (data?.records || []).map(r => ({ id: r.employee_id, name: r.name, identifier: r.identifier }))).map(emp => {
                    const isInside = (data?.records || []).some(r => (r.employee_id === emp.id || r.id === emp.id) && r.state === 'inside');
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} (#{emp.identifier}) {isInside ? '🟢 متواجد بالدوام' : '⚪ خارج الدوام'}
                      </option>
                    );
                  })}
                </select>

                <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text)' }}>
                  رسالة أو ملاحظة تنبيه مخصصة (اختياري):
                </label>
                <textarea
                  className="asas-input"
                  rows={2}
                  placeholder="مثال: يرجى تأكيد استمرار الحضور فوراً واستكمال التقرير اليومي..."
                  value={reminderCustomNote}
                  onChange={(e) => setReminderCustomNote(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
                <span style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'block', marginTop: 4 }}>
                  ستصل هذه الرسالة للموظف كإشعار فوري بجواله وتظهر داخل نافذة تأكيد الدوام.
                </span>
              </Glass>
            )}

            {/* Asas Glass Card for Inside or All */}
            {reminderTarget !== 'employee' && (
              <Glass className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>الموظفون المستهدفون بالإرسال:</span>
                  <strong className="num" style={{ fontSize: 20, color: 'var(--paid)' }}>
                    {formatNumber(reminderTarget === 'inside' ? (data?.inside || 0) : (data?.total || 0))} موظف
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--hairline)', paddingTop: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>حالة التذكير التلقائي:</span>
                  <span className={`pill ${systemSettings.duty_reminder_enabled !== false ? 'pill--paid' : 'pill--partial'}`}>
                    <Icon name={systemSettings.duty_reminder_enabled !== false ? 'checkCircle' : 'clock'} />
                    {systemSettings.duty_reminder_enabled !== false ? 'مفعّل تلقائياً' : 'معطل مؤقتاً'}
                  </span>
                </div>
              </Glass>
            )}

            {/* Automation Frequency & Toggle */}
            <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <label className="asas-check" style={{ margin: 0, fontWeight: 600, fontSize: 13.5 }}>
                  <input
                    type="checkbox"
                    checked={systemSettings.duty_reminder_enabled !== false}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      setSystemSettings(prev => ({ ...prev, duty_reminder_enabled: val }));
                      try {
                        await api('/admin/settings', 'PUT', { duty_reminder_enabled: val });
                        load(true);
                      } catch (_) {}
                    }}
                  />
                  التذكير التلقائي أثناء الدوام
                </label>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>تكرار التذكير:</span>
                  <select
                    className="asas-select"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                    value={systemSettings.duty_reminder_interval_hours || 2}
                    onChange={async (e) => {
                      const val = Number(e.target.value);
                      setSystemSettings(prev => ({ ...prev, duty_reminder_interval_hours: val }));
                      try {
                        await api('/admin/settings', 'PUT', { duty_reminder_interval_hours: val });
                        load(true);
                      } catch (_) {}
                    }}
                  >
                    <option value={1}>كل ساعة</option>
                    <option value={2}>كل ساعتين (الافتراضي)</option>
                    <option value={3}>كل 3 ساعات</option>
                    <option value={4}>كل 4 ساعات</option>
                  </select>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                يرسل النظام إشعارات لحظية وتنبيهات صوتية للأجهزة المتصلة لتأكيد استمرار حضور الموظف بدقة.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {selectedAccountDetails && (
        <Modal
          title={
            <div className="asas-modal-title-row">
              <Icon name="user" style={{ color: 'var(--accent)' }} />
              <Swash>ملف الموظف</Swash>
            </div>
          }
          onClose={() => setSelectedAccountDetails(null)}
          footer={
            <div className="asas-modal-footer-bar">
              <Button variant="ghost" size="sm" onClick={() => setSelectedAccountDetails(null)}>
                إغلاق
              </Button>
              <div className="asas-modal-footer-bar__group">
                <Button
                  variant="glass"
                  size="sm"
                  icon="clock"
                  onClick={() => {
                    const a = selectedAccountDetails;
                    setSelectedAccountDetails(null);
                    handleOpenDirectReminder(a);
                  }}
                >
                  تنبيه فوري
                </Button>
                {can('employees.write') && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="edit"
                    onClick={() => {
                      const a = selectedAccountDetails;
                      setSelectedAccountDetails(null);
                      edit('accounts', a);
                    }}
                  >
                    تعديل البيانات
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="asas-employee-detail-modal">
            <Glass className="asas-emp-detail-hero">
              <UserAvatar user={selectedAccountDetails} size="lg" />
              <div className="asas-emp-detail-hero__meta">
                <h3 className="asas-emp-detail-hero__name">{selectedAccountDetails.name}</h3>
                <div className="asas-acc-sub-row" style={{ marginTop: 4 }}>
                  <span className="num asas-acc-id">#{selectedAccountDetails.identifier}</span>
                  <span className={`pill ${selectedAccountDetails.active ? 'pill--paid' : 'pill--partial'} asas-pill-compact`}>
                    <Icon name={selectedAccountDetails.active ? 'checkCircle' : 'clock'} />
                    {selectedAccountDetails.active ? 'حساب نشط' : 'بانتظار الموافقة'}
                  </span>
                  <span className={`pill ${selectedAccountDetails.is_remote ? 'pill--partial' : 'pill--neutral'} asas-pill-compact`}>
                    {selectedAccountDetails.is_remote ? 'عن بعد' : 'حضوري'}
                  </span>
                </div>
              </div>
            </Glass>

            <div className="asas-emp-detail-grid">
              <Glass className="asas-emp-detail-tile">
                <span className="asas-account-card-info-label">البريد الإلكتروني</span>
                <strong dir="ltr" className="asas-emp-detail-val">{selectedAccountDetails.email || 'غير مسجل'}</strong>
              </Glass>
              <Glass className="asas-emp-detail-tile">
                <span className="asas-account-card-info-label">رقم الهاتف</span>
                <strong dir="ltr" className="num asas-emp-detail-val">{selectedAccountDetails.phone || 'غير مسجل'}</strong>
              </Glass>
              <Glass className="asas-emp-detail-tile">
                <span className="asas-account-card-info-label">الدور والصلاحية</span>
                <strong className="asas-emp-detail-val">{roles[selectedAccountDetails.role] || selectedAccountDetails.role}</strong>
              </Glass>
              <Glass className="asas-emp-detail-tile">
                <span className="asas-account-card-info-label">حالة الحضور اليوم</span>
                <strong className="asas-emp-detail-val">
                  {selectedAccountDetails.attendance_status === 'inside' ? 'حاضر الآن' :
                   selectedAccountDetails.attendance_status === 'outside' ? 'تم الانصراف' :
                   selectedAccountDetails.attendance_status === 'leave' ? 'في إجازة' : 'لم يسجل اليوم'}
                </strong>
              </Glass>
              <Glass className="asas-emp-detail-tile asas-emp-detail-tile--full">
                <span className="asas-account-card-info-label">الجهاز المقيد بالأمان</span>
                <strong className="asas-emp-detail-val">
                  {selectedAccountDetails.bound_device_name || (selectedAccountDetails.bound_device_id ? 'جوال مقيد' : 'غير مقيد بعد')}
                </strong>
                {selectedAccountDetails.bound_device_id && (
                  <span className="subtle num" dir="ltr" style={{ marginTop: 2 }}>
                    {selectedAccountDetails.bound_device_id}
                  </span>
                )}
              </Glass>
            </div>
          </div>
        </Modal>
      )}

      {showPrintModal && qr && (
        <PrintPosterModal
          qr={qr}
          initialMode={typeof showPrintModal === 'string' ? showPrintModal : 'both'}
          branchName={branches.find(b => String(b.id) === String(branchId))?.name || qr.branch}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {modal && (
        <div className="asas-modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setModal(null); }}>
          <section className="asas-modal" role="dialog" aria-modal="true" aria-label="تحرير البيانات">
            <div className="asas-modal-head">
              <h2>
                {modal === 'announcements'
                  ? (form.id ? 'تعديل التعميم الرسمي' : 'نشر تعميم رسمي')
                  : modal === 'records'
                    ? (form.id ? 'تصحيح سجل الحضور' : `تسجيل حضور يدوي - ${form.name || ''}`)
                    : `${form.id ? 'تعديل' : 'إضافة'} ${
                        modal === 'branches' ? 'موقع الشركة'
                          : modal === 'shifts' ? 'الدوام وسياسة الاحتساب'
                          : modal === 'accounts' ? 'حساب موظف' : ''
                      }`}
              </h2>
              <button className="asas-btn sm" onClick={() => setModal(null)} aria-label="إغلاق">
                <Icon name="close" />
              </button>
            </div>

            <form className="asas-modal-body" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && <div className="asas-notice error" role="alert">{error}</div>}

              {modal === 'announcements' && (
                <>
                  <Field
                    label="عنوان التعميم"
                    required
                    placeholder="مثال: تعميم رسمي بمواعيد العمل"
                    value={form.title || ''}
                    onChange={e => set('title', e.target.value)}
                  />
                  <Field label="نص البيان والتعميم">
                    <textarea
                      className="asas-input"
                      rows={5}
                      required
                      placeholder="اكتب نص التعميم الرسمي هنا…"
                      value={form.content || ''}
                      onChange={e => set('content', e.target.value)}
                    />
                  </Field>
                  <Field label="درجة الأهمية">
                    <select className="asas-input" value={form.priority || 'normal'} onChange={e => set('priority', e.target.value)}>
                      <option value="normal">إشعار عادي</option>
                      <option value="important">هام</option>
                      <option value="urgent">عاجل جداً</option>
                    </select>
                  </Field>
                  <label className="asas-check" style={{ marginTop: 8 }}>
                    <input type="checkbox" checked={Boolean(form.send_email)} onChange={e => set('send_email', e.target.checked)} />
                    إرسال نسخة بالبريد الإلكتروني لجميع الموظفين المسجلين فوراً
                  </label>
                </>
              )}

              {modal === 'records' && (
                <>
                  <Field label="اسم الموظف"><input className="asas-input" disabled value={form.name || ''} /></Field>
                  <div className="asas-form-grid">
                    <Field label="وقت الدخول" type="datetime-local" required value={form.first_in} onChange={e => set('first_in', e.target.value)} />
                    <Field label="وقت الخروج" type="datetime-local" value={form.last_out} onChange={e => set('last_out', e.target.value)} />
                  </div>
                  <div className="asas-form-grid">
                    <Field label="الحالة التلقائية">
                      <select className="asas-input" value={form.state} onChange={e => set('state', e.target.value)}>
                        <option value="inside">حاضر الآن (قيد الدوام)</option>
                        <option value="outside">تم الانصراف</option>
                        <option value="closed">مغلق رسمياً</option>
                      </select>
                    </Field>
                    <Field label="سبب الخروج التلقائي">
                      <select className="asas-input" value={form.exit_reason} onChange={e => set('exit_reason', e.target.value)}>
                        <option value="انتهاء ساعات الدوام الرسمي في الموعد">انتهاء ساعات الدوام الرسمي في الموعد</option>
                        <option value="خروج مبكر بموافقة الإدارة">خروج مبكر بموافقة الإدارة</option>
                        <option value="خروج مؤقت / إذن رسمي">خروج مؤقت / إذن رسمي</option>
                        <option value="مغادرة نطاق الموقع تلقائياً (GPS)">مغادرة نطاق الموقع تلقائياً (GPS)</option>
                        <option value="تصحيح إداري">تصحيح إداري</option>
                      </select>
                    </Field>
                  </div>
                  <label className="asas-check"><input type="checkbox" checked={form.deduct_away} onChange={e => set('deduct_away', e.target.checked)} />خصم فترات المغادرة والعودة من الوقت المحتسب</label>
                </>
              )}

              {modal === 'branches' && (
                <>
                  <Field label="اسم الموقع / الفرع" required value={form.name} onChange={e => set('name', e.target.value)} />
                  <div className="asas-form-grid">
                    {[
                      ['latitude', 'خط العرض', -90, 90],
                      ['longitude', 'خط الطول', -180, 180],
                      ['entry_radius', 'نطاق الدخول بالمتر', 10, 1000],
                      ['exit_radius', 'نطاق الخروج بالمتر', 11, 2000],
                      ['max_accuracy', 'أقصى هامش خطأ بالمتر', 1, 500],
                      ['exit_samples', 'عدد قراءات التأكيد', 2, 10],
                      ['exit_delay_seconds', 'مدة التأكيد بالثواني', 30, 600]
                    ].map(([k, label, min, max]) => (
                      <Field key={k} label={label} type="number" required min={min} max={max} step={k === 'latitude' || k === 'longitude' ? 'any' : 1} value={form[k]} onChange={e => set(k, e.target.value)} />
                    ))}
                  </div>
                  <label className="asas-check" style={{ marginTop: 8 }}><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />الموقع مفعل</label>
                </>
              )}

              {modal === 'shifts' && (
                <>
                  <Field label="اسم جدول الدوام" required value={form.name || ''} onChange={e => set('name', e.target.value)} />
                  <div className="asas-form-grid">
                    <Field label="بداية الدوام" type="time" value={(form.start_time || '08:00').slice(0, 5)} required onChange={e => set('start_time', e.target.value)} />
                    <Field label="نهاية الدوام" type="time" value={(form.end_time || '16:00').slice(0, 5)} required onChange={e => set('end_time', e.target.value)} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label className="asas-label" style={{ marginBottom: 8 }}>أيام العمل المعتمدة أسبوعياً:</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { day: 6, label: 'السبت' },
                        { day: 0, label: 'الأحد' },
                        { day: 1, label: 'الإثنين' },
                        { day: 2, label: 'الثلاثاء' },
                        { day: 3, label: 'الأربعاء' },
                        { day: 4, label: 'الخميس' },
                        { day: 5, label: 'الجمعة' }
                      ].map(d => {
                        const activeDays = Array.isArray(form.work_days) ? form.work_days : [0, 1, 2, 3, 4, 6];
                        const isSelected = activeDays.includes(d.day);
                        return (
                          <button
                            type="button"
                            key={d.day}
                            className={`asas-btn sm ${isSelected ? 'primary' : ''}`}
                            style={{
                              borderRadius: 8,
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 500,
                              border: isSelected ? '1px solid var(--accent)' : '1px solid var(--hairline)',
                              background: isSelected ? 'var(--accent)' : 'var(--glass-inset)',
                              color: isSelected ? '#fff' : 'var(--text)'
                            }}
                            onClick={() => {
                              const nextDays = isSelected
                                ? activeDays.filter(x => x !== d.day)
                                : [...activeDays, d.day];
                              if (!nextDays.length) return;
                              set('work_days', nextDays);
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    <small style={{ color: 'var(--text-3)', fontSize: 11, display: 'block', marginTop: 4 }}>
                      اضغط على اليوم لتفعيله أو إلغائه من الدوام الرسمي
                    </small>
                  </div>

                  <div className="asas-form-grid">
                    <Field label="فترة السماح بالدقائق للتأخير" type="number" min="0" max="120" value={form.grace_minutes ?? 15} onChange={e => set('grace_minutes', e.target.value)} />
                    <Field label="عند نهاية الدوام">
                      <select className="asas-input" value={form.close_policy || 'actual_exit'} onChange={e => set('close_policy', e.target.value)}>
                        <option value="actual_exit">انتظار الخروج الفعلي للموظف</option>
                        <option value="scheduled">إغلاق تلقائي بنهاية وقت الدوام</option>
                      </select>
                    </Field>
                  </div>

                  <label className="asas-check" style={{ marginTop: 10, padding: 10, background: 'var(--glass-inset)', borderRadius: 10, border: '1px solid var(--hairline)' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.deduct_away)}
                      onChange={e => set('deduct_away', e.target.checked)}
                    />
                    <div>
                      <strong style={{ fontSize: 13 }}>خصم مدد المغادرة أثناء الدوام</strong>
                      <p className="asas-muted" style={{ margin: 0, fontSize: 11.5 }}>
                        خصم فترات الخروج المؤقت أثناء ساعات الدوام الرسمي من مجموع الحضور
                      </p>
                    </div>
                  </label>
                </>
              )}

              {modal === 'accounts' && (
                <>
                  <div className="asas-form-grid">
                    <Field label="الاسم الكامل للموظف" required value={form.name} onChange={e => set('name', e.target.value)} />
                    <Field
                      label={user.role === 'super_admin' ? 'الرقم الوظيفي (إعادة ترقيم - مدير النظام)' : 'الرقم الوظيفي (تلقائي ومقيد)'}
                      disabled={user.role !== 'super_admin'}
                      className={user.role === 'super_admin' ? '' : 'asas-readonly-id'}
                      value={form.identifier || ''}
                      onChange={e => set('identifier', e.target.value)}
                      placeholder={user.role === 'super_admin' ? 'مثال: 001 أو EMP-10' : ''}
                      hint={user.role === 'super_admin' ? 'صلاحية سوبر أدمن: يمكنك تعديل أو إعادة ترقيم الرقم الوظيفي بحرية' : undefined}
                    />
                  </div>
                  <div className="asas-form-grid">
                    <Field label="البريد الإلكتروني (Gmail أو الحساب الرسمي)" type="email" placeholder="name@company.com" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                    <Field label="رقم الجوال / الهاتف" type="tel" placeholder="+967 77xxxxxxx" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                  </div>
                  <Field
                    label={form.id ? 'كلمة مرور جديدة (اتركها فارغة للاحتفاظ بالحالية)' : 'كلمة المرور — 12 حرفاً على الأقل'}
                    type="password"
                    autoComplete="new-password"
                    required={!form.id}
                    minLength={12}
                    maxLength={128}
                    value={form.password || ''}
                    onChange={e => set('password', e.target.value)}
                  />

                  {user.role === 'super_admin' && (
                    <Field label="الدور الوظيفي في النظام">
                      <select className="asas-input" value={form.role || 'employee'} onChange={e => set('role', e.target.value)}>
                        {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </Field>
                  )}

                  {/* Permissions Management Section */}
                  <div style={{ marginTop: 14, marginBottom: 14, padding: 14, background: 'var(--glass-inset)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <strong style={{ fontSize: 13.5, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name="shieldCheck" style={{ width: 16, height: 16, color: 'var(--accent)' }} />
                          الصلاحيات الممنوحة للمستخدم
                        </strong>
                        <p className="asas-muted" style={{ fontSize: 11, margin: '2px 0 0' }}>
                          حدد العمليات الإدارية المتاحة لهذا الحساب في النظام
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="asas-btn sm"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => set('permissions', Object.keys(permissions))}
                        >
                          تحديد الكل
                        </button>
                        <button
                          type="button"
                          className="asas-btn sm"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => set('permissions', [])}
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, marginTop: 8 }}>
                      {Object.entries(permissions).map(([pKey, pLabel]) => {
                        const isChecked = Array.isArray(form.permissions) && form.permissions.includes(pKey);
                        return (
                          <label key={pKey} className="asas-check" style={{ fontSize: 12, margin: 0, padding: '6px 8px', borderRadius: 8, background: isChecked ? 'var(--glass-tint-strong)' : 'transparent', border: isChecked ? '1px solid var(--accent)' : '1px solid transparent' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const current = Array.isArray(form.permissions) ? [...form.permissions] : [];
                                if (e.target.checked) {
                                  set('permissions', [...new Set([...current, pKey])]);
                                } else {
                                  set('permissions', current.filter(x => x !== pKey));
                                }
                              }}
                            />
                            <span>{pLabel}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Custom / Dynamic permissions added by Admin */}
                    {Array.isArray(form.permissions) && form.permissions.filter(p => !permissions[p]).length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--hairline)' }}>
                        <small style={{ color: 'var(--text-2)', fontSize: 11, display: 'block', marginBottom: 6 }}>صلاحيات مخصصة إضافية:</small>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {form.permissions.filter(p => !permissions[p]).map(cp => (
                            <span key={cp} className="asas-badge inside" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                              <code>{cp}</code>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                                onClick={() => set('permissions', form.permissions.filter(x => x !== cp))}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Custom Permission Input */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hairline)', display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="asas-input"
                        style={{ fontSize: 12, height: 34, flex: 1 }}
                        placeholder="أدخل رمز صلاحية جديدة (مثال: settings.manage أو finance.view)"
                        value={newCustomPerm}
                        onChange={e => setNewCustomPerm(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomPerm();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="asas-btn primary sm"
                        style={{ height: 34, fontSize: 12, whiteSpace: 'nowrap' }}
                        onClick={handleAddCustomPerm}
                      >
                        <Icon name="plus" width={12} height={12} />
                        إضافة صلاحية
                      </button>
                    </div>
                  </div>

                  <div className="asas-form-grid">
                    <Field label="الفرع">
                      <select className="asas-input" value={form.branch_id || ''} required={form.role === 'employee'} onChange={e => set('branch_id', e.target.value)}>
                        <option value="">اختر الفرع</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </Field>
                    <Field label="جدول الدوام">
                      <select className="asas-input" value={form.shift_id || ''} required={form.role === 'employee'} onChange={e => set('shift_id', e.target.value)}>
                        <option value="">اختر الدوام</option>
                        {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div style={{ marginTop: 10, marginBottom: 12 }}>
                    <Field label="طبيعة ونمط العمل">
                      <select
                        className="asas-input"
                        value={form.is_remote ? 'remote' : 'onsite'}
                        onChange={e => set('is_remote', e.target.value === 'remote')}
                      >
                        <option value="onsite">دوام حضوري (مكتبي داخل مقر الشركة)</option>
                        <option value="remote">دوام عن بعد (أونلاين / من المنزل - بدون تقييد جغرافي)</option>
                      </select>
                    </Field>
                  </div>

                  {form.id && <label className="asas-check"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />حساب نشط</label>}

                  <div style={{ marginTop: 14, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--glass-inset)', border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <strong style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
                      <Icon name="shieldCheck" style={{ width: 16, height: 16 }} />
                      قيود المساعد الذكي المخصصة لهذا المستخدم
                    </strong>

                    <div className="asas-form-grid">
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={Boolean(assistantPolicyForm.enabled)}
                          onChange={e => setAssistantPolicyForm(p => ({ ...p, enabled: e.target.checked }))}
                        />
                        السماح باستخدام المساعد الذكي
                      </label>
                      <Field
                        label="حصة يومية مخصصة (اتركه فارغاً للافتراضي)"
                        type="number"
                        min={0}
                        max={2000}
                        placeholder="الافتراضي"
                        value={assistantPolicyForm.daily_limit}
                        onChange={e => setAssistantPolicyForm(p => ({ ...p, daily_limit: e.target.value }))}
                      />
                    </div>

                    <div className="asas-form-grid">
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={Boolean(assistantPolicyForm.allow_hours_info)}
                          onChange={e => setAssistantPolicyForm(p => ({ ...p, allow_hours_info: e.target.checked }))}
                        />
                        استعلام ساعات العمل والتأخير
                      </label>
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={Boolean(assistantPolicyForm.allow_leave_info)}
                          onChange={e => setAssistantPolicyForm(p => ({ ...p, allow_leave_info: e.target.checked }))}
                        />
                        استعلام طلبات الإجازات
                      </label>
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={Boolean(assistantPolicyForm.allow_general_help)}
                          onChange={e => setAssistantPolicyForm(p => ({ ...p, allow_general_help: e.target.checked }))}
                        />
                        الاستفسارات الإرشادية (GPS / QR)
                      </label>
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={Boolean(assistantPolicyForm.strict_topic_only)}
                          onChange={e => setAssistantPolicyForm(p => ({ ...p, strict_topic_only: e.target.checked }))}
                        />
                        منع المواضيع خارج العمل
                      </label>
                    </div>

                    {form.role && form.role !== 'employee' && (
                      <label className="asas-check">
                        <input
                          type="checkbox"
                          checked={Boolean(assistantPolicyForm.allow_team_data)}
                          onChange={e => setAssistantPolicyForm(p => ({ ...p, allow_team_data: e.target.checked }))}
                        />
                        السماح باستعلام ملخصات الفريق ضمن صلاحية الفرع
                      </label>
                    )}

                    <Field
                      label="كلمات ومواضيع محظورة لهذا المستخدم (مفصولة بفاصلة)"
                      placeholder="مثال: رواتب، خصم، ترقية"
                      value={assistantPolicyForm.blocked_keywords || ''}
                      onChange={e => setAssistantPolicyForm(p => ({ ...p, blocked_keywords: e.target.value }))}
                    />
                    <Field
                      label="توجيه أو قيد خاص يُمرّر للمساعد لهذا الحساب فقط"
                      placeholder="مثال: ذكّره بموعد بدء الوردية في المقر الرئيسي"
                      value={assistantPolicyForm.custom_note || ''}
                      onChange={e => setAssistantPolicyForm(p => ({ ...p, custom_note: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {modal !== 'announcements' && (form.id || modal === 'branches' || modal === 'records') && (
                <Field label="سبب التغيير (يوثق في سجل العمليات)" required value={form.reason || ''} onChange={e => set('reason', e.target.value)} />
              )}

              <div className="asas-modal-footer" style={{ margin: '10px -24px -20px' }}>
                <button className="asas-btn" type="button" onClick={() => setModal(null)}>إلغاء</button>
                <button className="asas-btn primary" type="submit" disabled={busy}>
                  <Icon name="check" />
                  {modal === 'announcements' ? (form.id ? 'حفظ التعديلات' : 'نشر التعميم') : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

// LOGIN COMPONENT
function Login({ onLogin, initialError, onRetry, theme, onToggleTheme, onOpenInstall, installPrompt, isRemoteMode = false }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [pendingInfo, setPendingInfo] = useState(null);
  const [regWorkType, setRegWorkType] = useState(() => isRemoteMode ? 'remote' : 'onsite');
  const [identifier, setIdentifier] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('asas_saved_identifier') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('asas_remember_me') !== 'false');
    }
    return true;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [gsiReady, setGsiReady] = useState(false);

  const handleDirectInstall = useCallback(async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice?.outcome === 'accepted') return;
      } catch (err) {
        console.warn('Direct install prompt error:', err);
      }
    }
    if (onOpenInstall) {
      onOpenInstall();
    }
  }, [installPrompt, onOpenInstall]);

  // Registration states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBranchId, setRegBranchId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [availableBranches, setAvailableBranches] = useState([]);

  useEffect(() => {
    api('/settings').then(s => {
      if (Array.isArray(s?.branches) && s.branches.length) {
        setAvailableBranches(s.branches);
        setRegBranchId(String(s.branches[0].id));
      }
    }).catch(() => {});
  }, []);

  const googleClientId = '331442639841-s48n1ir37vnn9nckg6ogn1hv8fl9fiq3.apps.googleusercontent.com';

  const handleGoogleCredentialResponse = useCallback(async (res) => {
    if (!res?.credential) return;
    setBusy(true);
    setError('');
    try {
      const device_id = getDeviceId();
      const device_name = getDeviceName();
      const d = await api('/auth/google', 'POST', {
        credential: res.credential,
        phone: phone || undefined,
        device_id,
        device_name
      });
      if (d?.pending_approval) {
        setPendingInfo({
          title: 'تم إرسال طلب تسجيل حسابك بنجاح!',
          identifier: d.account?.identifier,
          name: d.account?.name,
          email: d.account?.email,
          message: d.message || 'طلبك قيد المراجعة والموافقة من قِبل إدارة النظام في لوحة التحكم.'
        });
        return;
      }
      if (typeof window !== 'undefined') {
        if (d?.token) localStorage.setItem('asas_token', d.token);
        if (d?.account) localStorage.setItem('asas_account', JSON.stringify(d.account));
      }
      onLogin(d.account);
    } catch (err) {
      setError(err.message || 'تعذر التحقق عبر حساب Google');
    } finally {
      setBusy(false);
    }
  }, [phone, onLogin]);

  const triggerGoogleSignIn = useCallback(() => {
    if (typeof window === 'undefined') return;
    setError('');

    // Method 1: Google OAuth2 Token Client (Instant official popup for custom buttons)
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              console.warn('Google OAuth token error:', tokenResponse);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setError(tokenResponse.error_description || tokenResponse.error || 'تعذر استكمال تسجيل الدخول عبر Google');
              }
              return;
            }
            if (tokenResponse.access_token) {
              setBusy(true);
              setError('');
              try {
                let userEmail = null;
                let userName = null;
                try {
                  const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                  });
                  if (uRes.ok) {
                    const uData = await uRes.json();
                    userEmail = uData.email;
                    userName = uData.name || uData.given_name;
                  }
                } catch (_) {}

                const device_id = getDeviceId();
                const device_name = getDeviceName();
                const d = await api('/auth/google', 'POST', {
                  access_token: tokenResponse.access_token,
                  email: userEmail,
                  name: userName,
                  phone: phone || undefined,
                  device_id,
                  device_name
                });
                if (d?.pending_approval) {
                  setPendingInfo({
                    title: 'تم إرسال طلب تسجيل حسابك بنجاح!',
                    identifier: d.account?.identifier,
                    name: d.account?.name,
                    email: d.account?.email,
                    message: d.message || 'طلبك قيد المراجعة والموافقة من قِبل إدارة النظام في لوحة التحكم.'
                  });
                  return;
                }
                if (typeof window !== 'undefined') {
                  if (d?.token) localStorage.setItem('asas_token', d.token);
                  if (d?.account) localStorage.setItem('asas_account', JSON.stringify(d.account));
                }
                onLogin(d.account);
              } catch (err) {
                setError(err.message || 'تعذر استكمال تسجيل الدخول عبر Google');
              } finally {
                setBusy(false);
              }
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Google tokenClient init error:', err);
      }
    }

    // Method 2: Google Identity Services ID Prompt fallback
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.prompt();
        return;
      } catch (e) {
        console.warn('Google id.prompt error:', e);
      }
    }

    setError('جاري تحميل خدمة Google… يرجى إعادة المحاولة خلال ثوانٍ');
  }, [googleClientId, phone, onLogin, handleGoogleCredentialResponse]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer = null;

    function initGoogleOneTap() {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          const el = document.getElementById('google-btn-container');
          if (el) {
            window.google.accounts.id.renderButton(el, {
              theme: theme === 'dark' ? 'filled_black' : 'outline',
              size: 'large',
              width: 280,
              locale: 'ar'
            });
          }
          try {
            window.google.accounts.id.prompt();
          } catch (_) {}
        } catch (err) {
          console.warn('Google One Tap init error:', err);
        }
      }
    }

    const mountTimer = setTimeout(() => {
      if (window.google?.accounts?.id) {
        initGoogleOneTap();
      } else {
        timer = setInterval(() => {
          if (window.google?.accounts?.id) {
            clearInterval(timer);
            initGoogleOneTap();
          }
        }, 200);
      }
    }, 40);

    return () => {
      clearTimeout(mountTimer);
      if (timer) clearInterval(timer);
    };
  }, [handleGoogleCredentialResponse, theme, googleClientId]);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const device_id = getDeviceId();
      const device_name = getDeviceName();
      const d = await api('/auth/login', 'POST', { identifier, password, phone: phone || undefined, device_id, device_name });

      if (typeof window !== 'undefined') {
        if (d?.token) localStorage.setItem('asas_token', d.token);
        if (d?.account) localStorage.setItem('asas_account', JSON.stringify(d.account));
        if (rememberMe) {
          localStorage.setItem('asas_saved_identifier', identifier);
          localStorage.setItem('asas_remember_me', 'true');
        } else {
          localStorage.removeItem('asas_saved_identifier');
          localStorage.setItem('asas_remember_me', 'false');
        }
      }
      onLogin(d.account);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (regPassword.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 خانات');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const device_id = getDeviceId();
      const device_name = getDeviceName();
      const d = await api('/auth/register', 'POST', {
        name: regName,
        email: regEmail || undefined,
        phone: regPhone || undefined,
        branch_id: regBranchId ? Number(regBranchId) : undefined,
        password: regPassword,
        device_id,
        device_name,
        is_remote: regWorkType === 'remote'
      });
      setPendingInfo({
        title: 'تم استلام طلب تسجيل حسابك بنجاح!',
        identifier: d.account?.identifier,
        name: d.account?.name,
        email: d.account?.email,
        work_type: regWorkType === 'remote' ? 'دوام كامل عن بعد' : 'دوام حضوري بالفرع',
        message: d.message || 'طلبك قيد المراجعة وبانتظار موافقة واعتماد إدارة النظام في لوحة التحكم.'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="asas-login-top-bar">
        {onToggleTheme && (
          <Button
            variant="glass"
            size="sm"
            icon={theme === 'dark' ? 'sun' : 'moon'}
            label={theme === 'dark' ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'}
            onClick={onToggleTheme}
          />
        )}
      </div>

      <div className="asas-login">
        <div className="asas-luminous-halo" aria-hidden="true" />
        <section className="asas-login-hero">
          <Brand />
          <div>
            <p className="asas-eyebrow">منظومة الحضور والعمل الذكية</p>
            <h1><Swash>حضور موثوق</Swash><br /><span>وفريق متصل دائماً.</span></h1>
            <p className="prose">مساحة عمل تنفيذية لإدارة الحضور والانصراف بدقة وموثوقية عالية، متصلة بسجلات الأجهزة وقواعد البيانات السيادية.</p>

            <div className="asas-hero-features-list">
              <div className="asas-hero-feature-item">
                <span className="asas-hero-feature-icon"><Icon name="shieldCheck" /></span>
                <span>تقييد أمني ذكي بأجهزة الموظفين المعتمدة</span>
              </div>
              <div className="asas-hero-feature-item">
                <span className="asas-hero-feature-icon"><Icon name="mapPin" /></span>
                <span>تسجيل فوري دقيق عبر الـ GPS وبأعلى سرعة استجابة</span>
              </div>
              <div className="asas-hero-feature-item">
                <span className="asas-hero-feature-icon"><Icon name="vault" /></span>
                <span>حماية سيادية مشفرة متوافقة مع ضوابط الأمن السيبراني</span>
              </div>
            </div>
          </div>
          <footer>
            <span>أساس الذكاء الاصطناعي · ASAAS</span>
            <p>لذكاء أكثر سيادة</p>
          </footer>
        </section>

        <section className="asas-login-form-wrap">
          <div className="asas-login-box">
            <div className="asas-login-mobile-brand">
              <Brand />
            </div>
            <p className="asas-eyebrow">بوابة الدخول الموحدة</p>
            <h2>{authMode === 'login' ? 'تسجيل الدخول إلى أساس' : 'طلب تسجيل حساب موظف'}</h2>
            <p className="asas-muted">
              {authMode === 'login'
                ? 'أدخل بياناتك المعتمدة للوصول إلى لوحة التحكم أو مساحة الموظف.'
                : 'سجل بياناتك المعتمدة لتقديم طلب إنشاء حساب جديد لاعتماده من قِبل الإدارة.'}
            </p>

            {/* Mode Switcher Tabs (Kit Segmented Pill) */}
            {!pendingInfo && (
              <div className="asas-auth-tabs">
                <Segmented
                  label="وضع البوابة"
                  value={authMode}
                  onChange={(mode) => { setAuthMode(mode); setError(''); }}
                  options={[
                    { value: 'login', label: 'تسجيل الدخول' },
                    { value: 'register', label: 'طلب حساب جديد' }
                  ]}
                />
              </div>
            )}

            {/* Sovereign Google Login Section */}
            {!pendingInfo && (
              <div className="asas-google-login-section">
                <div className="asas-google-header">
                  <span className="asas-google-shield-icon">
                    <Icon name="shieldCheck" />
                  </span>
                  <span>{authMode === 'login' ? 'الدخول السريع عبر Google Workspace' : 'التسجيل الفوري بحساب Google'}</span>
                </div>

                <div className="asas-google-btn-wrapper">
                  <button
                    type="button"
                    className="asas-google-fallback-btn"
                    onClick={triggerGoogleSignIn}
                    disabled={busy}
                  >
                    <span className="asas-google-btn-content">
                      <span className="asas-google-icon-wrapper" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18">
                          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                        </svg>
                      </span>
                      <span>{authMode === 'login' ? 'المتابعة باستخدام Google' : 'التسجيل باستخدام Google'}</span>
                    </span>
                    <span className="asas-google-pill-badge">
                      <span className="asas-install-pulse-dot" />
                      بصمة سريعة
                    </span>
                  </button>
                </div>
              </div>
            )}

            {!pendingInfo && (
              <div className="asas-auth-divider">
                <div className="asas-divider-line" />
                <span className="asas-divider-text">
                  {authMode === 'login' ? 'أو الدخول اليدوي بالبيانات' : 'أو إدخال بيانات الحساب يدوياً'}
                </span>
                <div className="asas-divider-line" />
              </div>
            )}

            {pendingInfo ? (
              <div style={{ textAlign: 'center', padding: '16px 8px', marginTop: 14 }}>
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'var(--partial-bg)',
                  color: 'var(--partial)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  border: '2px solid var(--partial)'
                }}>
                  <Icon name="clock" style={{ width: 28, height: 28, color: 'var(--partial)' }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>
                  {pendingInfo.title}
                </h3>
                <p className="prose" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  {pendingInfo.message}
                </p>

                <div style={{
                  background: 'var(--glass-inset)',
                  borderRadius: 12,
                  padding: 14,
                  border: '1px solid var(--hairline)',
                  textAlign: 'right',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="asas-muted" style={{ fontSize: 12 }}>اسم الموظف:</span>
                    <strong style={{ fontSize: 13 }}>{pendingInfo.name}</strong>
                  </div>
                  {pendingInfo.identifier && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="asas-muted" style={{ fontSize: 12 }}>الرقم الوظيفي المبدئي:</span>
                      <strong className="num" style={{ color: 'var(--accent)', fontSize: 14 }}>{pendingInfo.identifier}</strong>
                    </div>
                  )}
                  {pendingInfo.email && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="asas-muted" style={{ fontSize: 12 }}>البريد الإلكتروني:</span>
                      <span style={{ fontSize: 12.5 }} dir="ltr">{pendingInfo.email}</span>
                    </div>
                  )}
                  {pendingInfo.work_type && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="asas-muted" style={{ fontSize: 12 }}>طبيعة العمل:</span>
                      <strong style={{ fontSize: 12.5, color: 'var(--chart-out)' }}>{pendingInfo.work_type}</strong>
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--paid-bg)', borderRadius: 10, padding: 10, border: '1px solid var(--paid)', fontSize: 11.5, color: 'var(--text-2)', marginBottom: 18, lineHeight: 1.5, textAlign: 'right', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Icon name="shieldCheck" style={{ width: 15, height: 15, color: 'var(--paid)', flexShrink: 0, marginTop: 2 }} />
                  <span><strong>تنبيه الأمان والاعتماد:</strong> سيتم تفعيل حسابك فور موافقة إدارة النظام في لوحة التحكم. يمكنك بعدها تسجيل الدخول بالرقم الوظيفي أو البريد.</span>
                </div>

                <button
                  className="asas-btn primary asas-login-submit-btn"
                  onClick={() => {
                    setPendingInfo(null);
                    setAuthMode('login');
                    if (pendingInfo.identifier) setIdentifier(pendingInfo.identifier);
                  }}
                >
                  <span className="asas-submit-icon-box">
                    <Icon name="logIn" />
                  </span>
                  <span>العودة لتسجيل الدخول</span>
                </button>
              </div>
            ) : authMode === 'login' ? (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
                {error && (
                  <div className={`asas-notice ${error.includes('بانتظار موافقة') || error.includes('قيد المراجعة') ? 'warning' : 'error'}`} role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {error.includes('بانتظار موافقة') || error.includes('قيد المراجعة') ? (
                        <Icon name="clock" style={{ width: 18, height: 18, color: 'var(--partial)', flexShrink: 0 }} />
                      ) : (
                        <Icon name="alert" style={{ width: 18, height: 18, flexShrink: 0 }} />
                      )}
                      <div>{error}</div>
                    </div>
                    {onRetry && (
                      <button type="button" onClick={async () => { setBusy(true); await onRetry(); setBusy(false); }} disabled={busy} className="asas-btn sm" style={{ alignSelf: 'flex-start' }}>
                        <Icon name="refresh" />
                        {busy ? 'جارٍ الفحص…' : 'إعادة فحص الاتصال'}
                      </button>
                    )}
                  </div>
                )}

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>البريد الإلكتروني أو الرقم الوظيفي</span>
                  </label>
                  <div className="asas-modern-input-wrapper">
                    <span className="asas-input-adornment-start">
                      <Icon name="user" />
                    </span>
                    <input
                      type="text"
                      className="asas-modern-input"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      autoComplete="username"
                      required
                      placeholder="مثال: 001 أو name@company.com"
                    />
                  </div>
                </div>

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>كلمة المرور</span>
                  </label>
                  <div className="asas-modern-input-wrapper">
                    <span className="asas-input-adornment-start">
                      <Icon name="key" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="asas-modern-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      className="asas-password-toggle-btn"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                    </button>
                  </div>
                </div>

                <label className="asas-remember-row">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span>تذكر بيانات الدخول على هذا الجهاز</span>
                </label>

                <button className="asas-btn primary asas-login-submit-btn" type="submit" disabled={busy}>
                  <span className="asas-submit-icon-box">
                    <Icon name="logIn" />
                  </span>
                  <span>{busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={submitRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
                {error && (
                  <div className="asas-notice error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="alert" style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <div>{error}</div>
                  </div>
                )}

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>الاسم الكامل الرباعي</span>
                  </label>
                  <div className="asas-modern-input-wrapper">
                    <span className="asas-input-adornment-start"><Icon name="user" /></span>
                    <input
                      type="text"
                      className="asas-modern-input"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      required
                      placeholder="مثال: محمد أحمد علي صالح"
                    />
                  </div>
                </div>

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>البريد الإلكتروني المعتمد</span>
                  </label>
                  <div className="asas-modern-input-wrapper">
                    <span className="asas-input-adornment-start"><Icon name="mail" /></span>
                    <input
                      type="email"
                      dir="ltr"
                      className="asas-modern-input"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      required
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>رقم الهاتف أو الجوال (اختياري)</span>
                  </label>
                  <div className="asas-modern-input-wrapper">
                    <span className="asas-input-adornment-start"><Icon name="phone" /></span>
                    <input
                      type="tel"
                      dir="ltr"
                      className="asas-modern-input"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="+967 77xxxxxxx"
                    />
                  </div>
                </div>

                {availableBranches.length > 0 && (
                  <div className="asas-modern-field-group">
                    <label className="asas-modern-field-label">
                      <span>الفرع أو مقر العمل المفضل</span>
                    </label>
                    <div className="asas-modern-input-wrapper">
                      <span className="asas-input-adornment-start"><Icon name="building" /></span>
                      <select
                        className="asas-modern-input"
                        value={regBranchId}
                        onChange={e => setRegBranchId(e.target.value)}
                      >
                        {availableBranches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>طبيعة ونظام الدوام المطلوب</span>
                  </label>
                  <div className="asas-work-type-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      className={`asas-btn ${regWorkType === 'onsite' ? 'primary' : ''}`}
                      style={{ justifyContent: 'center', height: 42, fontSize: 13, borderRadius: 10 }}
                      onClick={() => setRegWorkType('onsite')}
                    >
                      <Icon name="building" />
                      <span>دوام حضوري بالمقر</span>
                    </button>
                    <button
                      type="button"
                      className={`asas-btn ${regWorkType === 'remote' ? 'primary' : ''}`}
                      style={{ justifyContent: 'center', height: 42, fontSize: 13, borderRadius: 10 }}
                      onClick={() => setRegWorkType('remote')}
                    >
                      <Icon name="globe" />
                      <span>دوام كامل عن بعد</span>
                    </button>
                  </div>
                  <small style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'block', lineHeight: 1.5 }}>
                    {regWorkType === 'remote'
                      ? 'نظام العمل عن بعد يتيح لك تسجيل الحضور والانصراف بضغطة زر دون الحاجة لكود QR أو نطاق الفرع.'
                      : 'الدوام الحضوري يتطلب التواجد داخل نطاق الفرع ومسح كود QR عند الدخول والانصراف.'}
                  </small>
                </div>

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>كلمة المرور (6 خانات على الأقل)</span>
                  </label>
                  <div className="asas-modern-input-wrapper">
                    <span className="asas-input-adornment-start"><Icon name="key" /></span>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      className="asas-modern-input"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      className="asas-password-toggle-btn"
                      onClick={() => setShowRegPassword(v => !v)}
                      aria-label={showRegPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      <Icon name={showRegPassword ? 'eyeOff' : 'eye'} />
                    </button>
                  </div>
                </div>

                <div className="asas-modern-field-group">
                  <label className="asas-modern-field-label">
                    <span>تأكيد كلمة المرور</span>
                  </label>
                  <div className="asas-modern-input-wrapper">
                    <span className="asas-input-adornment-start"><Icon name="shieldCheck" /></span>
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      className="asas-modern-input"
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      className="asas-password-toggle-btn"
                      onClick={() => setShowRegConfirmPassword(v => !v)}
                      aria-label={showRegConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      <Icon name={showRegConfirmPassword ? 'eyeOff' : 'eye'} />
                    </button>
                  </div>
                </div>

                <button className="asas-btn primary asas-login-submit-btn" type="submit" disabled={busy}>
                  <span className="asas-submit-icon-box">
                    <Icon name="plus" />
                  </span>
                  <span>{busy ? 'جارٍ إرسال الطلب…' : 'إرسال طلب تسجيل الحساب للإدارة'}</span>
                </button>
              </form>
            )}

            <div className="asas-device-restriction-card">
              <div className="asas-device-badge-cube">
                <Icon name="smartphone" />
              </div>
              <div className="asas-device-badge-content">
                <div className="asas-device-badge-title">
                  <Icon name="shieldCheck" />
                  <span>نظام تقييد الجوال المعتمد</span>
                </div>
                <p>يتم ربط الحساب بجوال الموظف الشخصي تلقائياً عند أول تسجيل دخول لضمان صحة التسجيل ومنع التحضير بالنيابة.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// EMPLOYEE PORTAL
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch (_) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

function decodeQrToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  const dotIndex = tokenStr.indexOf('.');
  if (dotIndex === -1) return null;
  try {
    const payload = tokenStr.slice(0, dotIndex);
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(decodeURIComponent(escape(atob(base64))));
    return json;
  } catch (_) {
    return null;
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000;
  const rad = n => (n * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Math.round(R * c);
}

// Pure Web Audio API synthesizers for real-time haptic & audio feedback
function playChime(type) {
  try {
    if (typeof window === 'undefined') return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'enter') {
      // Ascending pleasant chord: C5 (523Hz) -> G5 (784Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'exit') {
      // Descending mellow tone: E5 (659Hz) -> A4 (440Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(440.0, now + 0.14);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.48);
    } else if (type === 'warning') {
      // Gentle attention pings
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  } catch (_) {}
}

function playDutyReminderChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.0, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch (_) {}
}

function sendSystemNotification(title, body, options = {}) {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const fullBody = options.fullBody || body;
      const previewBody = String(body || '').length > 160
        ? `${String(body).slice(0, 157).trim()}… — اضغط لعرض الرسالة كاملة`
        : body;
      const payloadData = {
        url: options.url || '/asas',
        title,
        body: previewBody,
        fullBody,
        type: options.type || 'general',
        priority: options.priority || 'normal',
        announcementId: options.announcementId || null,
        senderName: options.senderName || 'نظام أساس للحضور',
        createdAt: new Date().toISOString(),
        ...(options.data || {})
      };
      const opts = {
        body: previewBody,
        icon: '/icon-192.png',
        badge: '/favicon.png',
        dir: 'rtl',
        lang: 'ar',
        tag: options.tag || 'asas-geofence',
        renotify: true,
        vibrate: [200, 100, 200],
        ...options,
        data: payloadData
      };
      const showFallback = () => {
        const n = new Notification(title, opts);
        n.onclick = () => {
          try { window.focus(); } catch (_) {}
          window.dispatchEvent(new CustomEvent('asas:open-notification', { detail: payloadData }));
          n.close();
        };
      };
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          if (reg && reg.showNotification) {
            reg.showNotification(title, {
              ...opts,
              actions: [{ action: 'open', title: 'عرض الرسالة كاملة' }]
            });
          } else {
            showFallback();
          }
        }).catch(showFallback);
      } else {
        showFallback();
      }
    }
  } catch (_) {}
}

function Employee({ user, logout, announcements, unreadAnnouncementsCount = 0, onOpenAnnouncements, onOpenProfile, onOpenInstall, installPrompt, defaultAction = 'auto', theme, onToggleTheme }) {
  const [empPage, setEmpPage] = useState('duty');
  const [empHistoryViewMode, setEmpHistoryViewMode] = useState('auto');
  const [data, setData] = useState(null);
  const activeUser = data?.account || user;
  const isRemote = Boolean(activeUser?.is_remote);
  const [showLocationGuide, setShowLocationGuide] = useState(false);
  const isInAppBrowser = typeof navigator !== 'undefined' && /WhatsApp|Telegram|FBAV|Instagram|Line/i.test(navigator.userAgent || '');
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [leave, setLeave] = useState({ from_date: today(), to_date: today(), reason: '' });
  const [cameraModal, setCameraModal] = useState(false);
  const [autoCheckIn, setAutoCheckIn] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('asas_auto_checkin') !== 'false';
    }
    return true;
  });
  const [checkingGps, setCheckingGps] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });

  const lastCoordsRef = useRef(null);
  const lastCoordsTimeRef = useRef(0);
  const isSendingRef = useRef(false);
  const lastSentTimeRef = useRef(0);
  const autoCheckInRef = useRef(autoCheckIn);
  autoCheckInRef.current = autoCheckIn;
  const hasAutoEnteredRef = useRef(false);
  const hasWarnedExitRef = useRef(false);
  const exitTimerRef = useRef(null);
  const branchCoordsRef = useRef({
    latitude: 15.306023604211699,
    longitude: 44.19817994690613,
    entry_radius: 120,
    exit_radius: 180
  });

  const requestNotifPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === 'granted') {
          playDutyReminderChime();
          sendSystemNotification(
            'تم تفعيل إشعارات أساس الذكية 🔔',
            'ستصلك تنبيهات الحضور الفورية وتذكير التحضير كل ساعتين أثناء الدوام تلقائياً حتى والتطبيق مغلق.',
            { tag: 'asas-welcome-notif' }
          );
          await registerWebPushSubscription();
        }
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      registerWebPushSubscription().catch(() => {});
    }
  }, []);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  async function startCamera() {
    setCameraModal(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const interval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const raw = codes[0].rawValue;
              stopCamera();
              let t = raw;
              let urlAction = null;
              try {
                const u = new URL(raw);
                const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
                t = hash.get('qr') || u.searchParams.get('token') || raw;
                urlAction = u.searchParams.get('action') || hash.get('action');
              } catch (_) {}
              const qrMeta = decodeQrToken(t);
              const targetAction = qrMeta?.action || urlAction || 'auto';
              setToken(t);
              act(targetAction, t);
              clearInterval(interval);
            }
          } catch (_) {}
        }, 350);
      }
    } catch (err) {
      setError('تعذر فتح الكاميرا؛ يرجى منح الإذن في المتصفح أو استخدام زر التحضير التلقائي');
      setCameraModal(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraModal(false);
  }

  const load = useCallback((isSilent = false) => {
    return api('/attendance/me')
      .then(res => {
        setData(res);
        if (res?.account && typeof localStorage !== 'undefined') {
          try { localStorage.setItem('asas_account', JSON.stringify(res.account)); } catch (_) {}
        }
        if (res?.branch) branchCoordsRef.current = res.branch;
        setError('');
      })
      .catch(e => {
        if (e.status === 401) logout();
        else if (!isSilent) setError(e.message);
      });
  }, [logout]);

  const loadLeaves = useCallback(async () => {
    setLoadingLeaves(true);
    try {
      const res = await api('/leave');
      if (Array.isArray(res)) setLeaves(res);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoadingLeaves(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadLeaves();
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const search = new URLSearchParams(window.location.search);
    const foundToken = hash.get('qr') || search.get('qr') || search.get('token') || '';
    const urlAction = search.get('action') || hash.get('action') || '';
    if (foundToken) {
      setToken(foundToken);
      const qrMeta = decodeQrToken(foundToken);
      const targetAction = qrMeta?.action || urlAction || (defaultAction !== 'auto' ? defaultAction : 'auto');
      act(targetAction, foundToken);
    }
    window.history.replaceState(null, '', window.location.pathname);

    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load(true);
      }
    }, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, loadLeaves, defaultAction]);

  async function act(action, customToken = null) {
    setBusy(true);
    setError('');
    const curUser = data?.account || user;
    const curRemote = Boolean(curUser?.is_remote);
    try {
      // 1. Native Phone Biometric Verification (Touch ID / Face ID / Android Fingerprint)
      let bioResult = null;
      if (action === 'enter' || action === 'exit') {
        setMessage('يرجى لمس مستشعر بصمة الهاتف للمتابعة...');
        bioResult = await promptBiometricVerification(curUser, action);
        setMessage('جاري التحقق من الموقع وتوثيق العملية...');
      }

      let currentToken = customToken || token;
      if (!currentToken) {
        if (curRemote) {
          currentToken = 'remote_token';
        } else {
          try {
            const qrData = await api(`/attendance/active-qr?action=${action === 'auto' ? '' : action}`);
            if (qrData?.token) currentToken = qrData.token;
          } catch (err) {}
        }
      }
      if (!currentToken && !curRemote) throw new Error('يرجى مسح رمز QR الخاص بالفرع لتأكيد التواجد');

      // Pre-validation to reject crossed actions immediately on client
      const qrMeta = currentToken !== 'remote_token' ? decodeQrToken(currentToken) : null;
      if (qrMeta?.action) {
        if (action === 'enter' && qrMeta.action === 'exit') {
          throw new Error('عفواً، رمز QR هذا مخصص لتسجيل الانصراف والخروج فقط، ولا يمكن استخدامه لتسجيل الدخول.');
        }
        if (action === 'exit' && qrMeta.action === 'enter') {
          throw new Error('عفواً، رمز QR هذا مخصص لتسجيل الدخول فقط، ولا يمكن استخدامه لتسجيل الانصراف والخروج.');
        }
      }

      // Fast coordinate retrieval
      let p;
      if (curRemote) {
        // REMOTE: Never block on GPS. Safe fast attempt with fallback
        p = await new Promise((resolve) => {
          if (typeof window === 'undefined' || !navigator.geolocation) {
            return resolve({ coords: { latitude: 0, longitude: 0, accuracy: 999 }, timestamp: Date.now() });
          }
          let resolved = false;
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve({ coords: { latitude: 0, longitude: 0, accuracy: 999 }, timestamp: Date.now() });
            }
          }, 1200);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve(pos);
              }
            },
            () => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve({ coords: { latitude: 0, longitude: 0, accuracy: 999 }, timestamp: Date.now() });
              }
            },
            { enableHighAccuracy: false, timeout: 1200, maximumAge: 60000 }
          );
        });
      } else {
        // ON-SITE: Fast coordinate retrieval: use recently cached fix if < 15 seconds old
        if (lastCoordsRef.current && (Date.now() - lastCoordsTimeRef.current < 15000)) {
          p = lastCoordsRef.current;
        } else {
          p = await new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !navigator.geolocation) {
              return reject(new Error('خدمة تحديد الموقع (GPS) غير مدعومة في متصفحك.'));
            }
            navigator.geolocation.getCurrentPosition(
              resolve,
              (err) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  (fallbackErr) => {
                    const finalErr = fallbackErr || err;
                    if (finalErr?.code === 1 || /denied|permission/i.test(finalErr?.message || '')) {
                      const pe = new Error('LOCATION_DENIED');
                      pe.code = 1;
                      return reject(pe);
                    }
                    if (finalErr?.code === 2) {
                      const ue = new Error('POSITION_UNAVAILABLE');
                      ue.code = 2;
                      return reject(ue);
                    }
                    if (finalErr?.code === 3) {
                      const te = new Error('TIMEOUT');
                      te.code = 3;
                      return reject(te);
                    }
                    reject(finalErr);
                  },
                  { enableHighAccuracy: false, timeout: 6000, maximumAge: 10000 }
                );
              },
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
            );
          });
          lastCoordsRef.current = p;
          lastCoordsTimeRef.current = Date.now();
        }
      }

      const fix = {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: Math.round(p.coords.accuracy || 0),
        captured_at: new Date(p.timestamp || Date.now()).toISOString()
      };
      const device_id = getDeviceId();
      const reqId = generateUUID();
      const r = await api('/attendance/action', 'POST', {
        action,
        token: currentToken,
        request_id: reqId,
        device_id,
        fix,
        biometric: bioResult
      });

      const isEnterAction = r.action === 'enter' || action === 'enter';
      if (isEnterAction) {
        playChime('enter');
        if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
        sendSystemNotification('تم تسجيل الحضور', r.message || 'تم تسجيل حضورك بنجاح');
      } else {
        playChime('exit');
        if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 400]);
        sendSystemNotification('تم تسجيل الانصراف', r.message || 'تم تسجيل انصرافك بنجاح');
      }

      setMessage(r.message || 'تم توثيق الحضور بنجاح');
      await load();
    } catch (e) {
      if (e?.isBiometric || e?.message?.includes('البصمة')) {
        setError(e.message);
      } else if (e?.code === 1 || e?.message === 'LOCATION_DENIED' || /denied|Geolocation/i.test(e?.message || '')) {
        setError('LOCATION_DENIED');
        setShowLocationGuide(true);
      } else if (e?.code === 2 || e?.message === 'POSITION_UNAVAILABLE') {
        setError('تعذر تحديد موقعك الحالي. يرجى التأكد من تشغيل الـ GPS في جوالك وإعادة المحاولة.');
      } else if (e?.code === 3 || e?.message === 'TIMEOUT') {
        setError('استغرق التقاط الموقع وقتاً طويلاً. يرجى الخروج لمكان مفتوح أو الاقتراب من نافذة والمحاولة مجدداً.');
      } else {
        setError(e.message || 'حدث خطأ أثناء تسجيل الحضور');
      }
    } finally {
      setBusy(false);
    }
  }

  const todayRecord = data?.records?.[0];
  const isInside = todayRecord?.state === 'inside';

  // ─── 2-Hour Periodic Duty Attendance Reminder Engine ──────────────────────
  const [dutyReminder, setDutyReminder] = useState(null);
  const [confirmingPresence, setConfirmingPresence] = useState(false);
  const [reminderConfirmedToast, setReminderConfirmedToast] = useState(false);

  const checkDutyReminder = useCallback(() => {
    if (typeof window === 'undefined') return;
    const curUser = data?.account || user;
    if (!curUser || !curUser.id) return;

    // 1. Live reminder alert from admin blast or server event
    if (data?.duty_reminder_alert) {
      const alertId = data.duty_reminder_alert.id;
      const ackAlertKey = `asas_duty_reminder_alert_ack_${curUser.id}_${alertId}`;
      const snoozeAlertKey = `asas_duty_reminder_alert_snooze_${curUser.id}_${alertId}`;
      const lastAlertAck = localStorage.getItem(ackAlertKey);
      const snoozeUntil = Number(localStorage.getItem(snoozeAlertKey) || 0);
      const urlParams = new URLSearchParams(window.location.search);
      const forceOpenFromPush = urlParams.get('open_reminder') === '1';

      if (forceOpenFromPush || (!lastAlertAck && Date.now() > snoozeUntil)) {
        if (forceOpenFromPush) {
          urlParams.delete('open_reminder');
          const cleanUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '') + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        }
        setDutyReminder(prev => {
          if (prev?.open && prev?.alertId === alertId) return prev;
          playDutyReminderChime();
          const customMsg = data.duty_reminder_alert.custom_note;
          const fullText = customMsg
            ? `${customMsg}\n\nيرجى تأكيد استمرار تواجدك وتوثيق ساعات دوامك بدقة.`
            : `تنبيه تذكير رسمي من الإدارة (${curUser.name}): يرجى تأكيد استمرار تواجدك وتفقد حالة الدوام.`;
          if (!forceOpenFromPush) {
            sendSystemNotification(
              'تذكير إثبات واستمرار الحضور · أساس',
              customMsg || `تنبيه تذكير رسمي من الإدارة (${curUser.name}): يرجى تأكيد استمرار تواجدك وتفقد حالة الدوام.`,
              {
                tag: `asas-duty-alert-${alertId}`,
                type: 'duty_reminder',
                priority: customMsg ? 'important' : 'normal',
                fullBody: fullText,
                senderName: data.duty_reminder_alert.admin_name || 'إدارة الدوام',
                url: '/asas?open_reminder=1'
              }
            );
          }
          return {
            open: true,
            alertId,
            hoursOnDuty: data.duty_reminder_alert.hours_on_duty || 2,
            custom_note: customMsg || null,
            admin_name: data.duty_reminder_alert.admin_name || null,
            type: 'admin_blast'
          };
        });
        return;
      }
    }

    // 2. Check automated periodic duty timer (default 2 hours = 120 min)
    const intervalHours = Number(curUser.duty_reminder_interval_hours || 2);
    const intervalMs = intervalHours * 3600 * 1000;

    const currentRecord = data?.records?.find(r => {
      try {
        const recDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date(r.shift_start));
        const nowDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date());
        return recDate === nowDate;
      } catch { return false; }
    }) || data?.records?.[0];

    const isInsideNow = currentRecord && currentRecord.state === 'inside';

    if (isInsideNow && currentRecord.first_in) {
      const firstInMs = new Date(currentRecord.first_in).getTime();
      const nowMs = Date.now();
      const elapsedMs = nowMs - firstInMs;

      if (elapsedMs >= intervalMs) {
        const intervalsCount = Math.floor(elapsedMs / intervalMs);
        const hoursOnDuty = intervalsCount * intervalHours;
        const ackKey = `asas_duty_reminder_ack_${curUser.id}_${intervalsCount}_${currentRecord.id}`;
        const snoozeKey = `asas_duty_reminder_snooze_${curUser.id}_${intervalsCount}_${currentRecord.id}`;

        const lastAck = localStorage.getItem(ackKey);
        const snoozeUntil = Number(localStorage.getItem(snoozeKey) || 0);

        if (!lastAck && nowMs > snoozeUntil) {
          setDutyReminder(prev => {
            if (prev?.open && prev?.intervalsCount === intervalsCount) return prev;
            playDutyReminderChime();
            sendSystemNotification(
              '⏰ تذكير إثبات واستمرار الحضور',
              `مضت ${hoursOnDuty} ساعات على تواجدك في الدوام اليوم (${curUser.name}). يرجى تأكيد استمرار تواجدك وتفقد حالة دوامك.`,
              { tag: `asas-duty-reminder-${intervalsCount}` }
            );
            return {
              open: true,
              hoursOnDuty,
              intervalHours,
              recordId: currentRecord.id,
              intervalsCount,
              type: 'on_duty'
            };
          });
        }
      }
    }
  }, [data, user]);

  useEffect(() => {
    checkDutyReminder();
    const reminderInterval = setInterval(checkDutyReminder, 15000);
    return () => clearInterval(reminderInterval);
  }, [checkDutyReminder]);

  const handleConfirmPresence = async () => {
    setConfirmingPresence(true);
    try {
      const res = await api('/attendance/heartbeat', 'POST', { reminder_type: dutyReminder?.type || 'two_hour_interval' });
      if (dutyReminder && typeof localStorage !== 'undefined') {
        const curUser = data?.account || user;
        if (dutyReminder.alertId) {
          localStorage.setItem(`asas_duty_reminder_alert_ack_${curUser.id}_${dutyReminder.alertId}`, String(Date.now()));
        }
        if (dutyReminder.recordId && dutyReminder.intervalsCount) {
          const ackKey = `asas_duty_reminder_ack_${curUser.id}_${dutyReminder.intervalsCount}_${dutyReminder.recordId}`;
          localStorage.setItem(ackKey, String(Date.now()));
        }
      }
      playChime('success');
      setMessage(res?.message || 'تم تأكيد استمرار حضورك بنجاح');
      setDutyReminder(null);
      setReminderConfirmedToast(true);
      setTimeout(() => setReminderConfirmedToast(false), 6000);
      load(true);
    } catch (err) {
      setError(err?.message || 'تعذر تأكيد الحضور، يرجى إعادة المحاولة');
    } finally {
      setConfirmingPresence(false);
    }
  };

  const handleSnoozeReminder = () => {
    if (dutyReminder && typeof localStorage !== 'undefined') {
      const curUser = data?.account || user;
      if (dutyReminder.alertId) {
        localStorage.setItem(`asas_duty_reminder_alert_snooze_${curUser.id}_${dutyReminder.alertId}`, String(Date.now() + 15 * 60 * 1000));
      }
      if (dutyReminder.recordId && dutyReminder.intervalsCount) {
        const snoozeKey = `asas_duty_reminder_snooze_${curUser.id}_${dutyReminder.intervalsCount}_${dutyReminder.recordId}`;
        localStorage.setItem(snoozeKey, String(Date.now() + 15 * 60 * 1000));
      }
    }
    setDutyReminder(null);
  };

  // Live Geofence Monitor & Auto Check-in/out Scanner
  const [geofenceStatus, setGeofenceStatus] = useState({
    state: 'idle',
    distance: null,
    accuracy: null,
    pending: 0,
    required_samples: 2,
    remaining_seconds: 0,
    lastChecked: null
  });

  const isInsideRef = useRef(isInside);
  isInsideRef.current = isInside;
  const todayRecordRef = useRef(todayRecord);
  todayRecordRef.current = todayRecord;
  const loadRef = useRef(load);
  loadRef.current = load;
  const geofenceStatusRef = useRef(geofenceStatus);
  geofenceStatusRef.current = geofenceStatus;

  const sendLocationFix = useCallback(async (coords, timestamp, force = false) => {
    if (!coords || typeof window === 'undefined') return;
    if (isSendingRef.current) return;
    const nowMs = Date.now();
    if (!force && nowMs - lastSentTimeRef.current < 4500) return;

    isSendingRef.current = true;
    lastSentTimeRef.current = nowMs;
    lastCoordsRef.current = { coords, timestamp: timestamp || nowMs };
    lastCoordsTimeRef.current = nowMs;

    // Fast local client calculation if branch coords are known
    let localDist = null;
    if (user?.is_remote) {
      setGeofenceStatus(prev => ({
        ...prev,
        state: 'inside',
        distance: null,
        accuracy: Math.round(coords.accuracy)
      }));
    } else if (branchCoordsRef.current?.latitude && branchCoordsRef.current?.longitude) {
      localDist = haversineDistance(
        coords.latitude,
        coords.longitude,
        Number(branchCoordsRef.current.latitude),
        Number(branchCoordsRef.current.longitude)
      );
      const effectiveRad = isInsideRef.current
        ? Number(branchCoordsRef.current.exit_radius || 180)
        : Number(branchCoordsRef.current.entry_radius || 120);
      if (localDist != null) {
        const isInsideLocally = localDist <= effectiveRad;
        setGeofenceStatus(prev => ({
          ...prev,
          state: isInsideLocally ? 'inside' : (prev.pending > 0 ? 'pending' : 'outside'),
          distance: localDist,
          accuracy: Math.round(coords.accuracy)
        }));
      }
    }

    try {
      const fix = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: Math.round(coords.accuracy),
        captured_at: new Date(timestamp || nowMs).toISOString()
      };
      const reqId = generateUUID();

      const res = await api('/attendance/action', 'POST', {
        action: 'location',
        fix,
        device_id: getDeviceId(),
        request_id: reqId
      });

      if (res) {
        if (res.branch) branchCoordsRef.current = { ...branchCoordsRef.current, ...res.branch };

        // Auto-exit confirmed
        if (res.action === 'exit' || res.automatic || res.record?.state === 'outside') {
          playChime('exit');
          if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 400]);
          sendSystemNotification('تم تسجيل الانصراف التلقائي', res.message || 'تم رصد مغادرتك لنطاق مقر العمل وتوثيق الانصراف تلقائياً.');
          setMessage(res.message || 'تم رصد مغادرتك للنطاق بنجاح وتسجيل خروجك تلقائياً.');
          if (loadRef.current) loadRef.current(true);
          return;
        }

        const dist = res.distance != null ? Math.round(res.distance) : localDist;
        const entryRadius = Number(res.branch_radius?.entry || res.branch?.entry_radius || 120);
        const exitRadius = Number(res.branch_radius?.exit || res.branch?.exit_radius || 180);
        const effectiveRadius = isInsideRef.current ? exitRadius : entryRadius;

        // Comprehensive inside check: server inside flag, inside_geofence flag, or distance within radius
        const isCurrentlyInside = Boolean(
          res.state === 'inside' ||
          res.inside_geofence === true ||
          (dist != null && dist <= effectiveRadius)
        );

        // Auto-exit acceleration: when employee is on duty and outside the exit perimeter
        if (isInsideRef.current && !isCurrentlyInside && dist != null && dist > exitRadius) {
          if (!hasWarnedExitRef.current) {
            hasWarnedExitRef.current = true;
            playChime('warning');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            sendSystemNotification('تنبيه مغادرة نطاق العمل', `تم رصد تواجدك خارج نطاق العمل (${dist} م). جاري التحقق من تأكيد الانصراف التلقائي.`);
          }
          // Immediately schedule verification fix in 2.5s to confirm auto-exit
          if (!exitTimerRef.current) {
            exitTimerRef.current = setTimeout(() => {
              exitTimerRef.current = null;
              if (lastCoordsRef.current?.coords) {
                sendLocationFix(lastCoordsRef.current.coords, Date.now(), true);
              }
            }, 2500);
          }
        } else {
          hasWarnedExitRef.current = false;
          if (exitTimerRef.current) {
            clearTimeout(exitTimerRef.current);
            exitTimerRef.current = null;
          }
        }

        // Auto check-in if arrived at branch while off duty
        if (!isInsideRef.current && isCurrentlyInside && autoCheckInRef.current && !hasAutoEnteredRef.current && (!todayRecordRef.current || todayRecordRef.current.state !== 'inside')) {
          hasAutoEnteredRef.current = true;
          setMessage('تم رصد تواجدك داخل مقر العمل! جاري تسجيل الحضور التلقائي...');
          try {
            const qrData = await api('/attendance/active-qr?action=enter');
            if (qrData?.token) {
              const enterReqId = generateUUID();
              const enterRes = await api('/attendance/action', 'POST', {
                action: 'enter',
                token: qrData.token,
                request_id: enterReqId,
                device_id: getDeviceId(),
                fix
              });
              playChime('enter');
              if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
              sendSystemNotification('تم تسجيل الحضور التلقائي', enterRes.message || 'مرحباً بك! تم تسجيل حضورك تلقائياً.');
              setMessage(enterRes.message || 'تم توثيق حضورك التلقائي بنجاح!');
              if (loadRef.current) await loadRef.current();
              return;
            }
          } catch (autoErr) {
            console.error('Auto check-in error:', autoErr);
          }
        }

        setGeofenceStatus({
          state: isCurrentlyInside ? 'inside' : (res.pending_exit > 0 ? 'pending' : 'outside'),
          distance: dist,
          accuracy: Math.round(coords.accuracy),
          pending: res.pending_exit || 0,
          required_samples: res.required_samples || 2,
          remaining_seconds: res.remaining_seconds || 0,
          lastChecked: new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      }
    } catch (_) {
    } finally {
      isSendingRef.current = false;
    }
  }, [user?.is_remote]);

  const triggerLocationCheck = useCallback(() => {
    if (isRemote) return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    setCheckingGps(true);
    const onPos = (pos) => {
      sendLocationFix(pos.coords, pos.timestamp, true);
      setTimeout(() => setCheckingGps(false), 500);
    };
    const onFallback = (err) => {
      navigator.geolocation.getCurrentPosition(
        onPos,
        finalErr => {
          if (finalErr?.code === 1 || /denied/i.test(finalErr?.message || '')) {
            setError('LOCATION_DENIED');
          } else {
            setError('تعذر تحديد الموقع: ' + (finalErr?.message || err?.message));
          }
          setCheckingGps(false);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 }
      );
    };
    navigator.geolocation.getCurrentPosition(onPos, onFallback, { enableHighAccuracy: true, timeout: 5000, maximumAge: 2000 });
  }, [sendLocationFix, isRemote]);

  useEffect(() => {
    if (isRemote) return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    let isCancelled = false;
    const onPos = (pos) => {
      if (!isCancelled && pos?.coords) {
        sendLocationFix(pos.coords, pos.timestamp);
      }
    };

    // 1. Initial quick fix with immediate cached fallback
    navigator.geolocation.getCurrentPosition(
      onPos,
      () => {
        if (!isCancelled) {
          navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: false, timeout: 6000, maximumAge: 15000 });
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
    );

    // 2. Continuous watchPosition for live movement tracking
    let watchId = navigator.geolocation.watchPosition(
      onPos,
      (err) => {
        if (!isCancelled && err?.code === 3) {
          navigator.geolocation.clearWatch(watchId);
          watchId = navigator.geolocation.watchPosition(onPos, () => {}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 5000 });
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
    );

    // 3. Heartbeat (20s normal, accelerated to 6s if pending exit)
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        navigator.geolocation.getCurrentPosition(
          onPos,
          () => {
            navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 });
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 4000 }
        );
      }
    }, (geofenceStatusRef.current?.pending > 0 || (isInsideRef.current && (geofenceStatusRef.current?.distance || 0) > 180)) ? 6000 : 20000);

    return () => {
      isCancelled = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [isRemote, isInside]);

  return (
    <div className="asas-employee-shell">
      <SiteHeader
        brand={
          <a
            href="#duty"
            className="brand"
            onClick={(e) => { e.preventDefault(); setEmpPage('duty'); }}
          >
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__name"><Swash>أساس</Swash></span>
          </a>
        }
        nav={
          <>
            <a
              href="#duty"
              aria-current={empPage === 'duty' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); setEmpPage('duty'); }}
            >
              تسجيل الحضور
            </a>
            <a
              href="#leave"
              aria-current={empPage === 'leave' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); setEmpPage('leave'); loadLeaves(); }}
            >
              الإجازات
            </a>
            <a
              href="#history"
              aria-current={empPage === 'history' ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); setEmpPage('history'); }}
            >
              السجل
            </a>
          </>
        }
        actions={
          <>
            <LiveClock iconSize={14} iconColor="var(--accent)" />
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--icon asas-bell-btn"
              onClick={onOpenAnnouncements}
              aria-label="الإشعارات"
              title="الإشعارات والتعميمات"
            >
              <Icon name="bell" />
              {unreadAnnouncementsCount > 0 && <span className="asas-bell-badge num">{unreadAnnouncementsCount}</span>}
            </button>
            {onToggleTheme && (
              <Button
                variant="ghost"
                size="sm"
                icon={theme === 'dark' ? 'sun' : 'moon'}
                label={theme === 'dark' ? 'التحويل للمظهر الفاتح' : 'التحويل للمظهر الداكن'}
                onClick={onToggleTheme}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon="logout"
              label="تسجيل الخروج"
              onClick={logout}
              title="تسجيل الخروج"
              className="asas-header-logout-btn"
            />
          </>
        }
      />

      <div className="asas-employee-page container page">
        {/* Profile Card */}
        <Glass className="asas-employee-profile">
          <div className="asas-employee-profile-main">
            <div className="asas-employee-avatar-wrap">
              <UserAvatar user={user} size="lg" onClick={onOpenProfile} />
              {isInside && <span className="asas-avatar-status-beacon" title="على رأس العمل" />}
            </div>
            <div className="asas-employee-profile-info">
              <h1 className="asas-employee-greeting">
                <AsasGreeting name={user.name} />
              </h1>
              <div className="asas-employee-profile-badges">
                <span className="asas-readonly-id num">
                  الرقم الوظيفي: {user.identifier}
                </span>
                {user.is_remote ? (
                  <span className="asas-badge remote">
                    دوام عن بعد (أونلاين)
                  </span>
                ) : (
                  <span className="asas-badge onsite">
                    دوام حضوري بالمقر
                  </span>
                )}
                {user.email && <span className="asas-employee-email">{user.email}</span>}
                <span
                  className={`sm-badge ${notifPermission === 'granted' ? 'sm-badge--teal' : 'sm-badge--muted'}`}
                  style={{ cursor: notifPermission !== 'granted' ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  onClick={notifPermission !== 'granted' ? requestNotifPermission : undefined}
                  title={notifPermission === 'granted' ? 'إشعارات النظام مفعلة - سيتم تذكيرك بالتحضير كل ساعتين أثناء الدوام' : 'انقر لتفعيل إشعارات النظام وتذكير الدوام'}
                >
                  <Icon name="bell" style={{ width: 12, height: 12 }} />
                  {notifPermission === 'granted' ? 'التذكير الدوري مفعّل (كل ساعتين)' : 'تفعيل الإشعارات والتذكير'}
                </span>
              </div>
            </div>
          </div>

          <div className="asas-employee-profile-actions">
            <Button variant="glass" size="sm" icon="user" onClick={onOpenProfile}>
              الملف الشخصي والأمان
            </Button>
          </div>
        </Glass>

        {/* Notification Permission Activation Banner */}
        {notifPermission !== 'granted' && (
          <div className="asas-reminder-banner">
            <div className="asas-reminder-banner-content">
              <div className="asas-reminder-icon-circle" aria-hidden="true">
                🔔
              </div>
              <div>
                <div className="asas-reminder-banner-title">تفعيل إشعارات الحضور وتذكير الدوام الدوري</div>
                <div className="asas-reminder-banner-desc">
                  فعّل الإشعارات لتصلك تنبيهات الحضور الفورية وتذكير التحضير كل ساعتين أثناء الدوام تلقائياً على هذا الجهاز.
                </div>
              </div>
            </div>
            <Button
              variant="solid"
              size="sm"
              icon="bell"
              label="تفعيل الإشعارات الآن"
              onClick={requestNotifPermission}
              style={{ whiteSpace: 'nowrap' }}
            />
          </div>
        )}

        {/* Reminder Confirmed Toast Banner */}
        {reminderConfirmedToast && (
          <div className="asas-banner alert alert--success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="check" style={{ width: 18, height: 18, color: 'var(--success)' }} />
              <span>تم توثيق وتأكيد استمرار حضورك بنجاح، وسيتم تذكيرك تلقائياً بعد ساعتين.</span>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReminderConfirmedToast(false)}>✕</button>
          </div>
        )}

      {isInAppBrowser && (
        <div style={{
          background: 'var(--partial-bg)',
          border: '1px solid var(--partial)',
          color: 'var(--partial)',
          padding: '10px 14px',
          borderRadius: 12,
          marginBottom: 14,
          fontSize: 12.5,
          lineHeight: 1.6,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <Icon name="alert" style={{ width: 22, height: 22, flexShrink: 0, color: 'var(--partial)' }} />
          <div>
            <strong>تنبيه: أنت تتصفح من داخل تطبيق واتساب.</strong><br />
            متصفح واتساب يقيّد خدمات الموقع والكاميرا. يرجى الضغط على زر الخيارات (⋮) أعلى زاوية الشاشة واختيار <strong>"فتح في Chrome / المتصفح"</strong> لإتمام الحضور والموقع بنجاح.
          </div>
        </div>
      )}

      {error === 'LOCATION_DENIED' ? (
        <div className="asas-notice error" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="alert" style={{ width: 22, height: 22, color: 'var(--unpaid)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                تم حظر إذن الموقع الجغرافي من المتصفح (User denied Geolocation)
              </strong>
              <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                لتسجيل الحضور، يحتاج المتصفح لمعرفة أنك داخل مقر العمل. يرجى السماح للمتصفح بالوصول للموقع وإعادة المحاولة.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button
              type="button"
              className="asas-btn primary sm"
              onClick={() => setShowLocationGuide(true)}
              style={{ fontWeight: 700 }}
            >
              <Icon name="mapPin" />
              <span>عرض خطوات تفعيل الموقع</span>
            </button>
            <button
              type="button"
              className="asas-btn sm"
              onClick={() => { setError(''); act(isInside ? 'exit' : 'enter'); }}
              disabled={busy}
            >
              <Icon name="refresh" />
              <span>إعادة المحاولة الآن</span>
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="asas-notice error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{error}</span>
          <button className="asas-btn sm" onClick={() => load(false)} disabled={busy}>
            <Icon name="refresh" />
            إعادة المحاولة
          </button>
        </div>
      ) : null}
      {message && (
        <div role="status" className="asas-notice">
          <div className="asas-notice__content">
            <span className="asas-notice__icon" aria-hidden="true">
              <Icon name="checkCircle" />
            </span>
            <span className="asas-notice__text">{message}</span>
          </div>
          <Button variant="ghost" size="sm" icon="close" label="إغلاق الإشعار" onClick={() => setMessage('')} />
        </div>
      )}

      {/* SUBPAGE 1: Attendance & Duty Status */}
      {empPage === 'duty' && (
        <Card title="حالة وتسجيل دوام اليوم" icon="clock">
          <div className="asas-duty-inner-content">
            {/* 1. Status Banner: Clean, single status line without redundant badges or double icons */}
            <div className={`asas-hero-duty-banner ${isInside ? 'inside' : 'outside'}`}>
              <div className="asas-duty-banner-info">
                <span className="asas-duty-banner-eyebrow">حالة الدوام الحالية</span>
                <div className="asas-duty-banner-heading">
                  <span className="asas-pulse-status-dot" style={{ color: isInside ? 'var(--paid)' : (isRemote ? 'var(--chart-out)' : 'var(--accent)') }} />
                  <span>
                    {isInside 
                      ? (isRemote ? 'على رأس العمل (دوام عن بعد)' : 'داخل مقر العمل (على رأس العمل)') 
                      : (todayRecord?.last_out 
                          ? (isRemote ? 'تم إنهاء الدوام عن بعد' : 'تم تسجيل الانصراف وإنهاء الدوام') 
                          : (isRemote ? 'جاهز لتسجيل الحضور عن بعد' : 'جاهز لتسجيل الحضور بالمقر'))}
                  </span>
                </div>
              </div>
              <div className="asas-duty-banner-meta">
                <span className={`asas-badge ${isInside ? 'inside' : (todayRecord?.last_out ? 'closed' : (isRemote ? 'remote' : 'onsite'))}`}>
                  {todayRecord?.branch_name || (isRemote ? 'مزامنة مباشرة' : 'الفرع الرئيسي')}
                </span>
              </div>
            </div>

            {/* 2. Key Metrics: 3 Equal Minimalist Cards */}
            <div className="asas-employee-stats">
              <div className="asas-stat-card">
                <div className="asas-stat-caption">أول حضور (دخول)</div>
                <div className="asas-stat-value" style={{ color: todayRecord?.first_in ? 'var(--paid)' : 'var(--text)' }}>
                  {todayRecord?.first_in ? time(todayRecord.first_in) : '—'}
                </div>
              </div>

              <div className="asas-stat-card">
                <div className="asas-stat-caption">آخر انصراف (خروج)</div>
                <div className="asas-stat-value">
                  {todayRecord?.last_out ? time(todayRecord.last_out) : (isInside ? 'قيد العمل' : '—')}
                </div>
              </div>

              <div className="asas-stat-card">
                <div className="asas-stat-caption">ساعات اليوم</div>
                <div className="asas-stat-value" style={{ color: 'var(--accent)' }}>
                  {todayRecord?.counted_minutes != null 
                    ? `${Math.floor(todayRecord.counted_minutes / 60)}س ${todayRecord.counted_minutes % 60}د` 
                    : (isInside ? 'تحت الاحتساب' : '0 دقيقة')}
                </div>
              </div>
            </div>

            {/* 3. Verification Bar */}
            {isRemote ? (
              <div className="asas-duty-capsule remote">
                <div className="asas-duty-capsule-main">
                  <Icon name="shieldCheck" style={{ width: 16, height: 16, color: 'var(--chart-out)', flexShrink: 0 }} />
                  <span>نظام العمل عن بعد معتمد لجهازك • التحضير فوري بدون الحاجة لمسح كود QR</span>
                </div>
              </div>
            ) : (
              <div className={`asas-duty-capsule ${geofenceStatus.inside ? 'inside' : 'outside'}`}>
                <div className="asas-duty-capsule-main">
                  <Icon name={geofenceStatus.inside ? 'checkCircle' : 'mapPin'} style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span>
                    {geofenceStatus.inside 
                      ? `داخل نطاق المقر المعتمد (${todayRecord?.branch_name || 'المقر الرئيسي'})` 
                      : (geofenceStatus.distance != null ? `المسافة عن المقر: ${Math.round(geofenceStatus.distance)} م` : 'جاري فحص النطاق الجغرافي')}
                  </span>
                </div>
                {!geofenceStatus.inside && (
                  <button
                    type="button"
                    className="asas-btn-inline"
                    onClick={triggerLocationCheck}
                    disabled={checkingGps}
                    title="إعادة فحص الإحداثيات اللحظية"
                  >
                    <Icon name="refresh" className={checkingGps ? 'asas-spin' : ''} style={{ width: 12, height: 12 }} />
                    <span>تحديث</span>
                  </button>
                )}
              </div>
            )}

            {token && (() => {
              const meta = decodeQrToken(token);
              const isEnter = meta?.action === 'enter';
              const isExit = meta?.action === 'exit';
              return (
                <div style={{ background: 'var(--glass-inset)', border: '1px solid var(--hairline)', padding: '8px 12px', borderRadius: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-3)' }}>الرمز المقترن:</span>
                    <span className={`asas-badge ${isEnter ? 'inside' : isExit ? 'urgent' : 'outside'}`} style={{ fontSize: 11 }}>
                      <Icon name={isEnter ? 'logIn' : isExit ? 'logout' : 'qrCode'} style={{ width: 13, height: 13 }} />
                      {isEnter ? 'كود الحضور (دخول فقط)' : isExit ? 'كود الانصراف (خروج فقط)' : 'رمز الفرع'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="asas-btn sm"
                    style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => setToken('')}
                    title="إلغاء الرمز المؤقت"
                  >
                    إلغاء
                  </button>
                </div>
              );
            })()}

            {/* 4. Action Section */}
            {isRemote ? (
              <div className="asas-remote-grid">
                {/* Remote Check-in Card Button */}
                <button
                  type="button"
                  className={`asas-remote-card-btn checkin ${!isInside ? 'active-ready' : 'inactive'}`}
                  disabled={busy || isInside}
                  onClick={() => act('enter')}
                  title={isInside ? 'أنت مسجل حضور بالفعل ومناوبتك مفتوحة' : 'اضغط لتسجيل الحضور عن بعد'}
                >
                  <div className={`asas-remote-icon-box ${!isInside ? 'checkin-active' : 'inactive'}`}>
                    <Icon name="remoteIn" style={{ width: 24, height: 24 }} />
                  </div>
                  <div className="asas-remote-btn-info">
                    <div className="asas-remote-btn-title">تسجيل الحضور عن بعد</div>
                    <div className="asas-remote-btn-desc">بدء فترة وساعات العمل اليومية</div>
                    <div className={`asas-remote-btn-status ${!isInside ? 'ready-in' : 'done'}`}>
                      <span>{!isInside ? 'جاهز لتسجيل الحضور الآن' : 'تم تسجيل الحضور اليوم'}</span>
                    </div>
                  </div>
                </button>

                {/* Remote Check-out Card Button */}
                <button
                  type="button"
                  className={`asas-remote-card-btn checkout ${isInside ? 'active-ready' : 'inactive'}`}
                  disabled={busy || !isInside}
                  onClick={() => act('exit')}
                  title={!isInside ? 'يلزم تسجيل الحضور أولاً قبل الانصراف' : 'اضغط لتسجيل الانصراف عن بعد'}
                >
                  <div className={`asas-remote-icon-box ${isInside ? 'checkout-active' : 'inactive'}`}>
                    <Icon name="remoteOut" style={{ width: 24, height: 24 }} />
                  </div>
                  <div className="asas-remote-btn-info">
                    <div className="asas-remote-btn-title">تسجيل الانصراف عن بعد</div>
                    <div className="asas-remote-btn-desc">إنهاء فترة الدوام وحفظ السجل</div>
                    <div className={`asas-remote-btn-status ${isInside ? 'ready-out' : 'disabled'}`}>
                      <span>{isInside ? 'جاهز لتسجيل الانصراف الآن' : 'يتطلب تسجيل الحضور أولاً'}</span>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="asas-office-action-wrap">
                <div className="asas-office-buttons-row">
                  <button
                    type="button"
                    className={`asas-duty-action-btn checkin ${!isInside ? 'active' : 'disabled'}`}
                    disabled={busy || isInside}
                    onClick={() => act('enter')}
                    title="تسجيل الحضور عبر بصمة الهاتف"
                  >
                    <Icon name="fingerprint" style={{ width: 18, height: 18 }} />
                    <span>تسجيل الحضور بالبصمة</span>
                  </button>

                  <button
                    type="button"
                    className={`asas-duty-action-btn checkout ${isInside ? 'active' : 'disabled'}`}
                    disabled={busy || !isInside}
                    onClick={() => act('exit')}
                    title="تسجيل الانصراف عبر بصمة الهاتف"
                  >
                    <Icon name="logout" style={{ width: 18, height: 18 }} />
                    <span>تسجيل الانصراف بالبصمة</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="asas-btn asas-qr-camera-btn"
                  onClick={startCamera}
                >
                  <Icon name="camera" style={{ width: 18, height: 18, color: 'var(--accent)' }} />
                  <span>مسح كود QR بكاميرا الجوال</span>
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Camera Modal */}
      {cameraModal && (
        <div className="asas-modal-backdrop" onClick={stopCamera}>
          <section className="asas-modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="asas-modal-head">
              <h2>مسح كود الفرع</h2>
              <button className="asas-btn sm" onClick={stopCamera}><Icon name="close" /></button>
            </div>
            <div className="asas-modal-body">
              <p className="asas-muted" style={{ marginBottom: 12 }}>وجّه كاميرا الهاتف نحو كود QR المعلق في مقر الفرع:</p>
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', minHeight: 240 }}>
                <video ref={videoRef} playsInline autoPlay style={{ width: '100%', height: 240, objectFit: 'cover' }} />
              </div>
            </div>
            <div className="asas-modal-footer">
              <button className="asas-btn" onClick={stopCamera}>إلغاء</button>
            </div>
          </section>
        </div>
      )}

      {/* SUBPAGE 2: Leave Request Submission & History */}
      {empPage === 'leave' && (
        <>
          <Card title="تقديم طلب إجازة واستئذان" icon="receipt">
            <div style={{ padding: 14 }}>
              <p className="asas-muted" style={{ fontSize: 12.5, margin: '0 0 16px' }}>
                سيتم إرسال طلبك فورياً للموارد البشرية وإدارة المقر لمراجعته واعتماده، وستظهر النتيجة في جدول طلباتك أدناه.
              </p>
              <form onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api('/leave', 'POST', leave);
                  setMessage('تم إرسال الطلب للاعتماد للمراجعة بنجاح');
                  setLeave({ from_date: today(), to_date: today(), reason: '' });
                  await loadLeaves();
                } catch (e) { setError(e.message); } finally { setBusy(false); }
              }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="asas-form-grid">
                  <Field label="من تاريخ" type="date" required value={leave.from_date} onChange={e => setLeave({ ...leave, from_date: e.target.value })} />
                  <Field label="إلى تاريخ" type="date" required value={leave.to_date} onChange={e => setLeave({ ...leave, to_date: e.target.value })} />
                </div>
                <Field label="سبب الإجازة أو العذر بالتفصيل" required placeholder="يرجى توضيح سبب الإجازة أو العذر..." value={leave.reason} onChange={e => setLeave({ ...leave, reason: e.target.value })} />
                <button className="asas-btn primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                  <Icon name="send" />
                  إرسال طلب الإجازة
                </button>
              </form>
            </div>
          </Card>

          <Card title="سجل طلبات الإجازة والاستئذان" icon="calendar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                إجمالي الطلبات المقدمة: <strong>{leaves.length}</strong>
              </span>
              <button className="asas-btn sm" onClick={loadLeaves} disabled={loadingLeaves}>
                <Icon name="refresh" />
                تحديث
              </button>
            </div>
            {loadingLeaves && leaves.length === 0 ? (
              <Empty>جارٍ تحميل طلبات الإجازة…</Empty>
            ) : leaves.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center' }}>
                <p className="asas-muted" style={{ margin: 0 }}>لا توجد لديك طلبات إجازة سابقة.</p>
              </div>
            ) : (
              <div className="asas-leave-container">
                {/* 1. TABLE VIEW (Desktop / Tablet) */}
                <div className="asas-leave-table-view asas-table-wrap">
                  <table className="asas-table">
                    <thead>
                      <tr>
                        <th>الفترة</th>
                        <th>المدة</th>
                        <th>السبب</th>
                        <th>الحالة</th>
                        <th>ملاحظات الإدارة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map(l => {
                        const daysCount = Math.max(1, Math.round((new Date(l.to_date) - new Date(l.from_date)) / (1000 * 60 * 60 * 24)) + 1);
                        return (
                          <tr key={l.id}>
                            <td><strong>{date(l.from_date)}</strong> إلى <strong>{date(l.to_date)}</strong></td>
                            <td><span className="asas-badge">{daysCount} {daysCount === 1 ? 'يوم' : 'أيام'}</span></td>
                            <td style={{ whiteSpace: 'normal', minWidth: 140 }}>{l.reason}</td>
                            <td>
                              <span className={`asas-badge ${l.status === 'approved' ? 'inside' : l.status === 'rejected' ? 'outside' : 'urgent'}`}>
                                {states[l.status] || l.status}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'normal', fontSize: 12.5, color: l.comment ? 'var(--text)' : 'var(--text-3)' }}>
                              {l.comment || 'بانتظار المراجعة'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 2. CARDS VIEW (Phone first, liquid-glass) */}
                <div className="asas-leave-cards-view">
                  {leaves.map(l => {
                    const daysCount = Math.max(1, Math.round((new Date(l.to_date) - new Date(l.from_date)) / (1000 * 60 * 60 * 24)) + 1);
                    return (
                      <Glass key={l.id} className="asas-leave-card">
                        <div className="asas-leave-card-head">
                          <div>
                            <strong className="num" dir="ltr" style={{ fontSize: 13.5 }}>{date(l.from_date)}</strong>
                            <span style={{ fontSize: 12, color: 'var(--text-3)', marginInline: 4 }}>إلى</span>
                            <strong className="num" dir="ltr" style={{ fontSize: 13.5 }}>{date(l.to_date)}</strong>
                          </div>
                          <span className={`asas-badge ${l.status === 'approved' ? 'inside' : l.status === 'rejected' ? 'outside' : 'urgent'}`}>
                            {states[l.status] || l.status}
                          </span>
                        </div>
                        <div className="asas-leave-card-body">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
                            <span style={{ color: 'var(--text-3)' }}>المدة المطلوبة:</span>
                            <strong className="num" style={{ color: 'var(--accent)' }}>{daysCount} {daysCount === 1 ? 'يوم' : 'أيام'}</strong>
                          </div>
                          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{l.reason}</p>
                        </div>
                        {l.comment && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-2)', padding: '6px 10px', background: 'var(--glass-inset)', borderRadius: 8 }}>
                            <strong style={{ color: 'var(--accent)' }}>رد الإدارة: </strong>
                            <span>{l.comment}</span>
                          </div>
                        )}
                      </Glass>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* SUBPAGE 3: Attendance History & Records */}
      {empPage === 'history' && (
        <Card 
          title="السجل الحضوري الموثق" 
          icon="list"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Segmented
                label="نمط عرض السجل"
                value={empHistoryViewMode}
                onChange={setEmpHistoryViewMode}
                options={[
                  { value: 'auto', label: 'تلقائي' },
                  { value: 'table', label: 'جدول' },
                  { value: 'cards', label: 'بطاقات' }
                ]}
              />
              <button className="asas-btn sm" onClick={() => load(false)} disabled={busy}>
                <Icon name="refresh" />
                تحديث
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              إجمالي الفترات المسجلة: <strong>{(data?.records || []).length}</strong>
            </span>
          </div>
          <Records 
            rows={(data?.records || []).map(r => ({ ...r, name: user.name, identifier: user.identifier }))} 
            viewMode={empHistoryViewMode}
            showViewToggle={false}
          />
        </Card>
      )}

      {/* Location Permission Guide Modal */}
      {showLocationGuide && (
        <div className="asas-modal-overlay" onClick={() => setShowLocationGuide(false)}>
          <div className="asas-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="asas-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="mapPin" style={{ width: 24, height: 24, color: "var(--accent)" }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>كيفية تفعيل إذن الموقع الجغرافي</h3>
                  <small style={{ color: 'var(--text-3)' }}>خطوات سريعة لحل مشكلة (User denied Geolocation)</small>
                </div>
              </div>
              <button className="asas-modal-close" onClick={() => setShowLocationGuide(false)}>×</button>
            </div>
            <div className="asas-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--glass-inset)', border: '1px solid var(--hairline)', padding: 12, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6 }}>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="shieldCheck" style={{ width: 15, height: 15, color: 'var(--accent)' }} />
                  لماذا يطلب النظام إذن الموقع؟
                </strong><br />
                يتطلب نظام أساس التحقق من تواجدك داخل مقر العمل لتوثيق حضورك بدقة تامة ومنع الأخطاء في سجلات الدوام.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--glass-inset)', padding: 12, borderRadius: 10, border: '1px solid var(--hairline)' }}>
                  <strong style={{ color: 'var(--accent)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Icon name="smartphone" style={{ width: 16, height: 16 }} /> في متصفح Google Chrome (أندرويد / كمبيوتر):
                  </strong>
                  <ol style={{ margin: 0, paddingRight: 20, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
                    <li>اضغط على أيقونة <strong>القفل أو علامة الإعدادات</strong> في شريط الرابط أعلى الشاشة بجوار رابط الموقع.</li>
                    <li>اضغط على <strong>"الأذونات" (Permissions)</strong> أو <strong>"إعدادات الموقع" (Site Settings)</strong>.</li>
                    <li>ابحث عن <strong>"الموقع الجغرافي" (Location)</strong> وقم بتغييره إلى <strong>سماح (Allow)</strong>.</li>
                    <li>اسحب الشاشة للأسفل لتحديث الصفحة، ثم اضغط على زر التحضير مجدداً.</li>
                  </ol>
                </div>

                <div style={{ background: 'var(--glass-inset)', padding: 12, borderRadius: 10, border: '1px solid var(--hairline)' }}>
                  <strong style={{ color: 'var(--chart-out)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Icon name="globe" style={{ width: 16, height: 16 }} /> في متصفح Safari (آيفون iPhone / آيباد iPad):
                  </strong>
                  <ol style={{ margin: 0, paddingRight: 20, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
                    <li>اضغط على أيقونة <strong>(AA) أو (ع ع)</strong> في شريط العنوان أسفل أو أعلى الشاشة.</li>
                    <li>اختر <strong>"إعدادات موقع الويب" (Website Settings)</strong>.</li>
                    <li>اضغط على <strong>"الموقع" (Location)</strong> واختر <strong>سماح (Allow)</strong>.</li>
                    <li>أعد تحديث الصفحة وحاول مجدداً.</li>
                  </ol>
                </div>

                <div style={{ background: 'var(--partial-bg)', padding: 12, borderRadius: 10, border: '1px solid var(--partial)' }}>
                  <strong style={{ color: 'var(--partial)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Icon name="alert" style={{ width: 16, height: 16 }} /> إذا كنت تتصفح من داخل تطبيق واتساب (WhatsApp):
                  </strong>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-2)' }}>
                    متصفح واتساب الداخلي يحظر خدمات الموقع تلقائياً. اضغط على <strong>زر الخيارات الثلاث (⋮)</strong> في أعلى زاوية الشاشة، ثم اختر <strong>"فتح في Chrome / المتصفح"</strong> (Open in Browser).
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="asas-btn primary"
                  onClick={() => {
                    setShowLocationGuide(false);
                    setError('');
                    act(isInside ? 'exit' : 'enter');
                  }}
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontWeight: 700 }}
                >
                  <Icon name="refresh" />
                  <span>تم تفعيل الموقع — إعادة المحاولة الآن</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Duty Attendance Reminder Modal (Official Asas UI) ─── */}
      {dutyReminder && dutyReminder.open && (
        <Modal
          title={
            <div className="asas-modal-title-row">
              <Icon name="clock" style={{ color: 'var(--accent)' }} />
              <Swash>تذكير إثبات الحضور</Swash>
            </div>
          }
          onClose={handleSnoozeReminder}
          footer={
            <div className="asas-modal-footer-bar asas-modal-footer-bar--triple">
              <Button variant="primary" size="sm" icon="check" className="asas-footer-primary" loading={confirmingPresence} onClick={handleConfirmPresence}>
                تأكيد استمرار الحضور
              </Button>
              <div className="asas-modal-footer-bar__group">
                <Button variant="glass" size="sm" icon="logout" onClick={() => { setDutyReminder(null); act('exit'); }}>
                  تسجيل الانصراف
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSnoozeReminder}>
                  تأجيل مؤقت
                </Button>
              </div>
            </div>
          }
        >
          <div className="asas-notif-center">
            <p className="prose" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: 'var(--text)' }}>
              مرحباً <strong>{firstName(user?.name || '') || user?.name}</strong>، نود تذكيرك بتأكيد تواجدك على رأس العمل لتوثيق استمرار ساعات دوامك بدقة ونزاهة.
            </p>
            {dutyReminder.custom_note && (
              <Glass className="asas-notif-reader is-important" style={{ padding: 14, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={dutyReminder.admin_name || 'الموارد البشرية'} size={30} />
                    <strong style={{ fontSize: 13.5, color: 'var(--text)' }}>
                      {dutyReminder.admin_name ? `رسالة من ${dutyReminder.admin_name}` : 'رسالة من الموارد البشرية'}
                    </strong>
                  </div>
                  <span className="pill pill--partial">
                    <Icon name="bell" />
                    تنبيه مباشر
                  </span>
                </div>
                <div className="prose asas-notif-full-body" dir="rtl">
                  {splitNotificationParagraphs(dutyReminder.custom_note).map((para, idx) => (
                    <p key={idx} className="asas-notif-p">{para}</p>
                  ))}
                </div>
              </Glass>
            )}
            <Glass className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>المدة المسجلة بالدوام:</span>
                <strong className="num" style={{ color: 'var(--paid)', fontSize: 16 }}>{formatNumber(dutyReminder.hoursOnDuty || 2)} ساعات متواصلة</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--hairline)', paddingTop: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>حالة المناوبة:</span>
                <span className="pill pill--paid"><Icon name="checkCircle" /> على رأس العمل</span>
              </div>
            </Glass>
          </div>
        </Modal>
      )}
      </div>

      <TabBar label="بوابة الموظف">
        <a
          href="#duty"
          aria-current={empPage === 'duty' ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); setEmpPage('duty'); }}
        >
          <Icon name="shieldCheck" />
          الحضور
        </a>
        <a
          href="#leave"
          aria-current={empPage === 'leave' ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); setEmpPage('leave'); loadLeaves(); }}
        >
          <Icon name="briefcase" />
          الإجازات
        </a>
        <a
          href="#history"
          aria-current={empPage === 'history' ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); setEmpPage('history'); }}
        >
          <Icon name="calendar" />
          السجل
        </a>
      </TabBar>
    </div>
  );
}

export default function AsasApp({ defaultAction = 'auto', isRemoteMode = false }) {
  return (
    <ErrorBoundary>
      <AsasAppInner defaultAction={defaultAction} isRemoteMode={isRemoteMode} />
    </ErrorBoundary>
  );
}
