'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getDeviceId, getDeviceName } from '../../utils/device';
import {
  Ambient,
  Glass,
  Card,
  Icon,
  Swash,
  Stretch,
  useTheme,
  AssistantWidget,
  formatNumber
} from '../../asaas-ui';

// Luxury Brand Avatar Presets
const AVATAR_PRESETS = [
  { id: 'gold', name: 'أساس الذهبي', bg: 'linear-gradient(135deg, #ba9555, #8c6928)', icon: '👑' },
  { id: 'emerald', name: 'الزمرد الملكي', bg: 'linear-gradient(135deg, #2d6a4f, #1b4332)', icon: '🌿' },
  { id: 'sapphire', name: 'الياقوت الأزرق', bg: 'linear-gradient(135deg, #1d3557, #457b9d)', icon: '💎' },
  { id: 'amber', name: 'العنبر الدافئ', bg: 'linear-gradient(135deg, #d9480f, #f76707)', icon: '⚡' },
  { id: 'ruby', name: 'الياقوت القرمزي', bg: 'linear-gradient(135deg, #9b2226, #ae2012)', icon: '🔥' },
  { id: 'slate', name: 'الرمادي الوقور', bg: 'linear-gradient(135deg, #495057, #212529)', icon: '🏛️' }
];

function UserAvatar({ user, size = 'md', onClick }) {
  const avatarKey = user?.avatar || 'gold';
  const preset = AVATAR_PRESETS.find(p => p.id === avatarKey);
  const isUrl = avatarKey && (avatarKey.startsWith('http') || avatarKey.startsWith('/'));
  const letter = (user?.name || user?.identifier || 'أ')[0] || 'أ';

  return (
    <div
      className={`asas-avatar ${size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : ''}`}
      style={{
        background: preset ? preset.bg : (!isUrl ? 'linear-gradient(135deg, #ba9555, #8c6928)' : undefined),
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
      title={user?.name || ''}
    >
      {isUrl ? (
        <img src={avatarKey} alt={user?.name || 'صورة'} />
      ) : preset ? (
        <span>{preset.icon}</span>
      ) : (
        <span>{letter}</span>
      )}
    </div>
  );
}

async function api(path, method = 'GET', body, retries = 1) {
  let attempt = 0;
  while (true) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('asas_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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
        if ([502, 503, 504].includes(r.status) && attempt < retries) {
          attempt++;
          await new Promise(res => setTimeout(res, 500 * attempt));
          continue;
        }
        const msg = value?.message || value?.error || (r.status === 401 ? 'يرجى تسجيل الدخول' : 'تعذر الاتصال بالخادم');
        throw Object.assign(new Error(msg), { status: r.status });
      }

      return value ? value.data : null;
    } catch (netErr) {
      if (attempt < retries && (!netErr.status || [502, 503, 504].includes(netErr.status))) {
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
  shifts: { name: '', start_time: '08:00', end_time: '16:00', work_days: [0, 1, 2, 3, 4], grace_minutes: 15, close_policy: 'actual_exit', deduct_away: false, reason: '' },
  accounts: { name: '', identifier: '', email: '', phone: '', password: '', role: 'employee', branch_id: '', shift_id: '', permissions: [] },
  records: { first_in: '', last_out: '', state: 'closed', exit_reason: 'انتهاء ساعات الدوام الرسمي في الموعد', deduct_away: false, reason: '' },
  announcements: { title: '', content: '', priority: 'normal', send_email: false }
};

function Brand() {
  return (
    <div className="asas-logo">
      <div className="asas-mark" />
      <div>
        <strong>أساس</strong>
        <small>نظام الحضور الذكي</small>
      </div>
    </div>
  );
}

function Empty({ children = 'لا توجد سجلات بعد' }) {
  return (
    <div className="asas-empty">
      <Icon name="file" />
      <p>{children}</p>
    </div>
  );
}

function Field({ label, children, ...props }) {
  return (
    <label className="asas-label">
      <span>{label}</span>
      {children || <input className="asas-input" {...props} />}
    </label>
  );
}

function Records({ rows = [], onEdit, canEdit }) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return <Empty />;
  return (
    <div className="asas-table-wrap">
      <table className="asas-table">
        <thead>
          <tr>
            {['الموظف', 'الفرع', 'الدوام', 'أول دخول', 'آخر خروج', 'الحالة التلقائية', 'سبب الخروج التلقائي', 'الاحتساب', ...(canEdit ? ['إجراء'] : [])].map(x => <th key={x}>{x}</th>)}
          </tr>
        </thead>
        <tbody>
          {list.map((r, idx) => {
            const isInside = r.state === 'inside';
            const isEarly = r.status_key === 'early_exit';
            const isLate = r.status_key && typeof r.status_key === 'string' && r.status_key.startsWith('late');
            const statusLabel = r.status_label || (isInside ? 'حاضر في الموعد' : 'تم الانصراف');
            const rawExitReason = r.exit_reason_label || (isInside ? 'قيد الدوام (على رأس العمل)' : ({
              geofence: 'مغادرة نطاق الموقع تلقائياً (GPS)',
              manual: 'انتهاء ساعات الدوام الرسمي في الموعد',
              scheduled: 'انتهاء فترة المناوبة المجدولة تلقائياً',
              admin_correction: 'تصحيح إداري'
            }[r.exit_reason] || r.exit_reason || 'انتهاء الدوام الرسمي'));
            const exitReasonLabel = String(rawExitReason || '—');

            return (
              <tr key={r.id || ('rec-' + idx)}>
                <td>
                  <strong>{r.name}</strong>
                  <small style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{r.identifier}</small>
                </td>
                <td>{r.branch_name}</td>
                <td>{date(r.shift_start)}</td>
                <td><span style={{ color: 'var(--paid)', fontWeight: 600 }}>{time(r.first_in)}</span></td>
                <td><span style={{ color: isInside ? 'var(--partial)' : 'var(--text)' }}>{time(r.last_out)}</span></td>
                <td>
                  <span className={`asas-badge ${isInside ? 'inside' : 'outside'}`}>
                    <Icon name={isInside ? (isLate ? 'alert' : 'checkCircle') : 'pause'} style={{ width: 13, height: 13 }} />
                    {statusLabel}
                  </span>
                </td>
                <td>
                  <span style={{
                    fontSize: 12,
                    color: isInside ? 'var(--text-3)' : (exitReasonLabel.includes('مبكر') ? 'var(--unpaid)' : 'var(--paid)'),
                    fontWeight: 600
                  }}>
                    {exitReasonLabel}
                  </span>
                </td>
                <td>
                  {r.counted_minutes == null ? 'مفتوح' : `${formatNumber(r.counted_minutes)} دقيقة`}
                  <small>{r.deduct_away ? 'مع خصم المغادرة' : 'دون خصم المغادرة'}</small>
                </td>
                {canEdit && (
                  <td>
                    <button className="asas-btn sm" onClick={() => onEdit(r)}>
                      <Icon name="edit" />
                      تصحيح
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Announcements Dialog
function AnnouncementsModal({ announcements, onClose }) {
  return (
    <div className="asas-modal-backdrop" onClick={onClose}>
      <section className="asas-modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="asas-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="bell" style={{ width: 22, height: 22, color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>التعميمات والإشعارات الرسمية</h2>
          </div>
          <button className="asas-btn sm" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" />
          </button>
        </div>
        <div className="asas-modal-body">
          {announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-3)' }}>
              <Icon name="bell" style={{ width: 40, height: 40, margin: '0 auto 10px', opacity: 0.3 }} />
              <p>لا توجد تعميمات جديدة حالياً.</p>
            </div>
          ) : (
            announcements.map(a => (
              <article key={a.id} className={`asas-announcement-card ${a.priority || 'normal'}`} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>{a.title}</h3>
                  <span className={`asas-badge ${a.priority || 'normal'}`}>
                    {a.priority === 'urgent' ? 'عاجل جداً' : a.priority === 'important' ? 'هام' : 'إشعار رسمي'}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-line', margin: '8px 0' }}>
                  {a.content}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 11.5, color: 'var(--text-3)', borderTop: '1px solid var(--hairline)', paddingTop: 8 }}>
                  <span>المرسل: <strong>{a.sender_name || 'الإدارة'}</strong></span>
                  <time>{date(a.created_at)} · {time(a.created_at)}</time>
                </div>
              </article>
            ))
          )}
        </div>
        <div className="asas-modal-footer">
          <button className="asas-btn primary" onClick={onClose}>
            <Icon name="check" />
            حسناً
          </button>
        </div>
      </section>
    </div>
  );
}

// Profile & Security Modal
function ProfileModal({ user, onClose, onUpdated }) {
  const [avatar, setAvatar] = useState(user?.avatar || 'gold');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [customAvatarUrl, setCustomAvatarUrl] = useState(user?.avatar && user.avatar.startsWith('http') ? user.avatar : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');

    if (newPassword) {
      if (newPassword.length < 12) {
        setBusy(false);
        return setErr('كلمة المرور الجديدة يجب أن تكون 12 حرفاً على الأقل');
      }
      if (newPassword !== confirmPassword) {
        setBusy(false);
        return setErr('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      }
      if (!currentPassword) {
        setBusy(false);
        return setErr('يرجى إدخال كلمة المرور الحالية لتأكيد التغيير');
      }
    }

    try {
      const finalAvatar = customAvatarUrl.trim() || avatar;
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

          <div>
            <label className="asas-label">اختر مظهر الأفاتار الخاص بك:</label>
            <div className="asas-avatar-grid">
              {AVATAR_PRESETS.map(p => (
                <button
                  type="button"
                  key={p.id}
                  className={`asas-avatar-choice ${avatar === p.id && !customAvatarUrl ? 'selected' : ''}`}
                  style={{ background: p.bg }}
                  onClick={() => { setAvatar(p.id); setCustomAvatarUrl(''); }}
                  title={p.name}
                >
                  {p.icon}
                </button>
              ))}
            </div>
            <Field
              label="أو رابط صورة شخصية خارجي (URL)"
              placeholder="https://..."
              value={customAvatarUrl}
              onChange={e => setCustomAvatarUrl(e.target.value)}
            />
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
              تغيير كلمة المرور
            </div>
            <p className="asas-muted" style={{ fontSize: 11.5, marginBottom: 10 }}>اترك الحقول فارغة إذا كنت لا ترغب بتغيير كلمة المرور.</p>
            <Field
              label="كلمة المرور الحالية"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
            <div className="asas-form-grid" style={{ marginTop: 10 }}>
              <Field
                label="كلمة المرور الجديدة (12 حرفاً على الأقل)"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <Field
                label="تأكيد كلمة المرور الجديدة"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
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

function AsasAppInner() {
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
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [branches, setBranches] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [qr, setQr] = useState(null);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    company_name: 'شركة أساس الذكاء الاصطناعي (AI-ASAAS)',
    timezone: 'Asia/Aden',
    max_gps_accuracy: 250,
    email_notifications: false,
    support_contact: '+967 770000000'
  });

  useEffect(() => {
    const update = () => setLiveTime(new Intl.DateTimeFormat('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Aden' }).format(new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

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

  const load = useCallback(async (showBusy = false) => {
    if (!user || user.role === 'employee') return;
    if (showBusy) setBusy(true);
    setError('');
    try {
      const path = tab === 'qr' ? '/admin/branches'
        : tab === 'leave' ? '/leave'
        : tab === 'records' ? `/admin/records?from=${from}&to=${to}`
        : tab === 'settings' ? '/admin/settings'
        : tab === 'announcements' ? '/announcements'
        : `/admin/${tab}`;
      const result = await api(path);
      setData(result);
      if (tab === 'branches' || tab === 'qr') setBranches(result);
      if (tab === 'settings' && result) setSystemSettings(result);
      if (tab === 'announcements' && Array.isArray(result)) setAnnouncements(result);
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
    try { await api('/auth/logout', 'POST', {}); } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('asas_token');
      localStorage.removeItem('asas_account');
    }
    setUser(null);
  }

  async function edit(kind, item) {
    setError('');
    setNotice('');
    if (kind === 'records') {
      const isoLocal = d => d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
      setForm({
        id: item.id,
        name: item.name,
        first_in: isoLocal(item.first_in),
        last_out: isoLocal(item.last_out),
        state: item.state,
        exit_reason: item.exit_reason || 'admin_correction',
        deduct_away: Boolean(item.deduct_away),
        reason: ''
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
      try {
        const [b, s] = await Promise.all([api('/admin/branches'), api('/admin/shifts')]);
        setBranches(b);
        setShifts(s);
      } catch (e) { setError(e.message); }
    }
  }

  async function deleteAccount(acc) {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف حساب الموظف (${acc.name} - ${acc.identifier}) نهائياً؟ سيتم مسح بيانات الحساب وحفظ الإجراء في سجل العمليات.`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await api(`/admin/accounts/${acc.id}`, 'DELETE');
      setNotice(r?.message || `تم حذف حساب الموظف (${acc.name}) بنجاح`);
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
        await api(`/admin/records/${form.id}`, 'PATCH', body);
        setModal(null);
        setNotice('تم حفظ تصحيح الحضور وتوثيقه في سجل العمليات');
        await load();
        return;
      }

      if (modal === 'announcements') {
        await api('/admin/announcements', 'POST', {
          title: form.title,
          content: form.content,
          priority: form.priority || 'normal',
          send_email: Boolean(form.send_email)
        });
        setModal(null);
        setNotice('تم نشر التعميم الرسمي وإرسال الإشعارات بنجاح');
        await load();
        await loadAnnouncements();
        return;
      }

      const body = { ...form };
      if (modal === 'branches') {
        for (const k of ['latitude', 'longitude', 'entry_radius', 'exit_radius', 'max_accuracy', 'exit_samples', 'exit_delay_seconds']) body[k] = Number(body[k]);
      }
      if (modal === 'shifts') body.grace_minutes = Number(body.grace_minutes);
      if (modal === 'accounts') {
        body.branch_id = body.branch_id ? Number(body.branch_id) : null;
        body.shift_id = body.shift_id ? Number(body.shift_id) : null;
        if (body.id) {
          delete body.role;
          if (!body.password) delete body.password;
          delete body.bound_device_id;
          delete body.bound_device_name;
          delete body.device_bound_at;
        }
      }
      await api(`/admin/${modal}${body.id ? `/${body.id}` : ''}`, body.id ? (modal === 'accounts' ? 'PATCH' : 'PUT') : 'POST', body);
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

  async function showQr() {
    setBusy(true);
    try {
      setQr(await api(`/admin/branches/${branchId}/qr`));
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
      const r = await fetch(`/api/admin/reports.csv?from=${from}&to=${to}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('تعذر تصدير التقرير');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `asas-${from}-${to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function exportWord() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/reports.doc?from=${from}&to=${to}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('تعذر تصدير تقرير Word');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير-حضور-أساس-${from}-${to}.doc`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function exportTxt() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/reports.txt?from=${from}&to=${to}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('تعذر تصدير التقرير النصي');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير-حضور-أساس-${from}-${to}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <Login onLogin={setUser} initialError={error} onRetry={() => checkAuth(true)} />
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
          onOpenAnnouncements={() => setShowAnnouncementsModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
        />
        {showAnnouncementsModal && (
          <AnnouncementsModal
            announcements={announcements}
            onClose={() => setShowAnnouncementsModal(false)}
          />
        )}
        {showProfileModal && (
          <ProfileModal
            user={user}
            onClose={() => setShowProfileModal(false)}
            onUpdated={(u) => setUser(u)}
          />
        )}
      </>
    );
  }

  const currentTabInfo = tabs.find(t => t[0] === tab);
  const title = currentTabInfo?.[1] || '';
  const rows = Array.isArray(data) ? data : [];
  const set = (k, value) => setForm(f => ({ ...f, [k]: value }));

  return (
    <div className="asas-app">
      <Ambient />

      {open && <div className="asas-modal-backdrop" style={{ zIndex: 25 }} onClick={() => setOpen(false)} />}

      {/* Sidebar with Liquid Glass and Unique Icons */}
      <aside className={`asas-sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <p className="asas-nav-label">مساحة الإدارة والقيادة</p>
        <nav className="asas-nav">
          {tabs.filter(([key]) => key !== 'accounts' || can('employees.read')).filter(([key]) => key !== 'audit' || can('audit.read')).map(([key, label, iconName]) => (
            <button className={tab === key ? 'active' : ''} key={key} onClick={() => { setTab(key); setOpen(false); setData(null); setNotice(''); setSearch(''); }}>
              <Icon name={iconName} />
              <span>{label}</span>
              {key === 'announcements' && announcements.length > 0 && (
                <span className="asas-badge urgent" style={{ marginRight: 'auto', fontSize: 10, padding: '1px 6px' }}>{announcements.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="asas-sidebar-foot">
          <div className="asas-profile" onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer' }} title="انقر لتعديل ملفك الشخصي">
            <UserAvatar user={user} size="md" />
            <div>
              <strong>{user.name}</strong>
              <p>{roles[user.role]}</p>
            </div>
          </div>
          <button className="asas-btn sm" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}>
            <Icon name="logout" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="asas-main">
        <header className="asas-topbar">
          <div className="asas-topbar-title">
            <button className="asas-btn sm" style={{ padding: '0 8px' }} onClick={() => setOpen(!open)} aria-label="القائمة">
              <Icon name="grid" />
            </button>
            <span>لوحة القيادة / <strong><Swash>{title}</Swash></strong></span>
          </div>

          <div className="asas-topbar-controls">
            <div className="asas-clock-pill">
              <Icon name="clock" style={{ width: 15, height: 15, color: 'var(--accent)' }} />
              <span>صنعاء: <strong>{liveTime || '—'}</strong></span>
            </div>

            <button className="asas-bell-btn" onClick={() => setShowAnnouncementsModal(true)} aria-label="التعميمات">
              <Icon name="bell" />
              {announcements.length > 0 && <span className="asas-bell-badge">{announcements.length}</span>}
            </button>

            <button className="asas-theme-btn" onClick={toggleTheme} aria-label="تبديل مظهر النظام">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>

            <div style={{ cursor: 'pointer' }} onClick={() => setShowProfileModal(true)} title="الملف الشخصي">
              <UserAvatar user={user} size="sm" />
            </div>
          </div>
        </header>

        <main className="asas-content">
          <div className="asas-heading">
            <div>
              <p className="asas-eyebrow">منظومة أساس السيادية</p>
              <h1><Swash>{title}</Swash></h1>
              <p className="asas-muted">إدارة فورية دقيقة، حوكمة مؤكدة، وقاعدة بيانات سحابية متزامنة لحظياً.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
              <button className="asas-btn sm" onClick={load} disabled={busy}>
                <Icon name="refresh" />
                إعادة المحاولة
              </button>
            </div>
          )}
          {notice && <div role="status" className="asas-notice">{notice}</div>}
          {busy && !data && <Empty>جارٍ جلب وتحديث البيانات لحظياً…</Empty>}

          {/* DASHBOARD TAB */}
          {tab === 'dashboard' && data && (
            <>
              <Glass className="asas-hero-banner">
                <div>
                  <p className="asas-eyebrow">منظومة العمل الذكية</p>
                  <h2><Stretch before="أهْـ" after="ـلاً" length={3} /> بك في لوحة تحكم أساس</h2>
                  <p>حضور مؤكد جغرافياً ومقيد بأجهزة الموظفين مع تحديث لحظي على السحابة وقواعد البيانات.</p>
                  <button className="asas-btn primary" onClick={() => setTab('qr')}>
                    <Icon name="qrCode" />
                    عرض الرموز المعتمدة
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="asas-mark" style={{ width: 80, height: 90 }} />
                </div>
              </Glass>

              <div className="asas-stats-grid">
                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>إجمالي الموظفين</span>
                    <div className="asas-stat-icon-wrap"><Icon name="users" /></div>
                  </div>
                  <div className="asas-stat-value">{formatNumber(data.total)}</div>
                  <div className="asas-stat-caption">حسابات نشطة في قاعدة البيانات</div>
                </Glass>

                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>حاضرون اليوم</span>
                    <div className="asas-stat-icon-wrap"><Icon name="checkCircle" /></div>
                  </div>
                  <div className="asas-stat-value" style={{ color: 'var(--paid)' }}>{formatNumber(data.present)}</div>
                  <div className="asas-stat-caption">سجلوا دخولهم خلال الساعات الحالية</div>
                </Glass>

                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>داخل نطاق العمل</span>
                    <div className="asas-stat-icon-wrap"><Icon name="mapPin" /></div>
                  </div>
                  <div className="asas-stat-value">{formatNumber(data.inside)}</div>
                  <div className="asas-stat-caption">حسب قراءات GPS المؤكدة</div>
                </Glass>

                <Glass className="asas-stat-card">
                  <div className="asas-stat-card-top">
                    <span>تأخيرات مرصودة</span>
                    <div className="asas-stat-icon-wrap"><Icon name="alert" /></div>
                  </div>
                  <div className="asas-stat-value" style={{ color: data.late > 0 ? 'var(--partial)' : 'var(--text)' }}>{formatNumber(data.late)}</div>
                  <div className="asas-stat-caption">حالات تأخير بحاجة لمتابعة</div>
                </Glass>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
                <Card title="مؤشر نسبة الحضور" icon="trend">
                  <div style={{ padding: '12px 6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className="asas-muted">نسبة حضور اليوم</span>
                      <strong style={{ fontSize: 18, color: 'var(--accent)' }}>
                        {data.total ? Math.round(data.present / data.total * 100) : 0}%
                      </strong>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--glass-inset)', overflow: 'hidden' }}>
                      <div style={{ width: `${data.total ? Math.min(100, data.present / data.total * 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--brand-gold), #8f6a2e)', borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
                      <span>لم يسجلوا بعد: <strong>{Math.max(0, data.total - data.present)}</strong></span>
                      <span>سجلوا حضوراً: <strong>{data.present}</strong></span>
                    </div>
                  </div>
                </Card>

                <Card title="حوكمة المنشأة والموقع" icon="building">
                  <div style={{ padding: '12px 6px' }}>
                    <p className="asas-muted">إدارة المواقع الجغرافية وضبط دقة قراءات GPS وفترة تأكيد الخروج.</p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
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

              <Card title="آخر سجلات الحضور والانصراف" icon="calendar" actions={<button className="asas-btn sm" onClick={() => setTab('records')}>جميع السجلات</button>}>
                <Records rows={data.records.slice(0, 10)} onEdit={r => edit('records', r)} canEdit={can('attendance.edit')} />
              </Card>
            </>
          )}

          {/* RECORDS TAB */}
          {tab === 'records' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <Field label="من تاريخ" type="date" value={from} onChange={e => setFrom(e.target.value)} />
                <Field label="إلى تاريخ" type="date" value={to} onChange={e => setTo(e.target.value)} />
                {can('reports.export') && (
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <button className="asas-btn sm" disabled={busy} onClick={exportCsv}>
                      <Icon name="fileSpreadsheet" />
                      Excel / CSV
                    </button>
                    <button className="asas-btn sm" disabled={busy} onClick={exportWord}>
                      <Icon name="fileText" />
                      Word (DOC)
                    </button>
                    <button className="asas-btn sm" disabled={busy} onClick={exportTxt}>
                      <Icon name="file" />
                      تقرير TXT
                    </button>
                  </div>
                )}
              </div>
              <Card title="سجل الحركات التفصيلي" icon="calendar">
                <Records rows={rows} onEdit={r => edit('records', r)} canEdit={can('attendance.edit')} />
              </Card>
            </>
          )}

          {/* ACCOUNTS / EMPLOYEES TAB */}
          {tab === 'accounts' && (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
                  <input
                    className="asas-input"
                    placeholder="ابحث بالاسم، الرقم الوظيفي، البريد أو الهاتف…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingRight: 40 }}
                  />
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }}>
                    <Icon name="search" />
                  </div>
                </div>
              </div>

              <div className="asas-table-wrap">
                <table className="asas-table">
                  <thead>
                    <tr>
                      <th>الموظف</th>
                      <th>حالة اليوم</th>
                      <th>البريد والهاتف</th>
                      <th>الجهاز المقيد</th>
                      <th>الصلاحية</th>
                      <th>الحساب</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter(a => `${a.name} ${a.identifier} ${a.email || ''} ${a.phone || ''}`.includes(search)).map(a => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <UserAvatar user={a} size="sm" />
                            <div>
                              <strong>{a.name}</strong>
                              <small style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>{a.identifier}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {a.attendance_status === 'inside' ? (
                            <span className="asas-badge inside">
                              <Icon name="checkCircle" style={{ width: 12, height: 12 }} />
                              حاضر الآن
                            </span>
                          ) : a.attendance_status === 'outside' ? (
                            <span className="asas-badge outside">
                              <Icon name="pause" style={{ width: 12, height: 12 }} />
                              تم الانصراف
                            </span>
                          ) : a.attendance_status === 'leave' ? (
                            <span className="asas-badge pending">
                              <Icon name="receipt" style={{ width: 12, height: 12 }} />
                              في إجازة
                            </span>
                          ) : (
                            <span className="asas-badge" style={{ background: 'var(--glass-inset)', color: 'var(--text-3)' }}>
                              <Icon name="alert" style={{ width: 12, height: 12 }} />
                              لم يسجل اليوم
                            </span>
                          )}
                        </td>
                        <td>
                          <div>
                            <strong>{a.email || '—'}</strong>
                            <small>{a.phone || '—'}</small>
                          </div>
                        </td>
                        <td>
                          {a.bound_device_id ? (
                            <div>
                              <span className="asas-badge inside">
                                <Icon name="smartphone" style={{ width: 12, height: 12 }} />
                                {a.bound_device_name || 'جوال مقيد'}
                              </span>
                              <small dir="ltr">{a.bound_device_id.slice(0, 12)}…</small>
                            </div>
                          ) : (
                            <span className="asas-badge outside">غير مقيد</span>
                          )}
                        </td>
                        <td>{roles[a.role]}</td>
                        <td><span className={`asas-badge ${a.active ? 'inside' : 'outside'}`}>{a.active ? 'نشط' : 'معطّل'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {can('employees.write') && (
                              <button className="asas-btn sm" onClick={() => edit('accounts', a)}>
                                <Icon name="edit" />
                                إدارة
                              </button>
                            )}
                            {can('employees.write') && a.bound_device_id && (
                              <button
                                className="asas-btn sm danger"
                                title="فك قيد ارتباط هذا الجوال"
                                onClick={async () => {
                                  if (window.confirm(`هل أنت متأكد من فك ارتباط الجهاز للموظف (${a.name})؟ سيتمكن من ربط جوال جديد عند أول تسجيل دخول.`)) {
                                    try {
                                      await api(`/admin/accounts/${a.id}/reset-device`, 'POST', { reason: 'فك قيد الجهاز بطلب من الإدارة' });
                                      setNotice(`تم فك قيد الجهاز للموظف ${a.name} بنجاح`);
                                      await load();
                                    } catch (e) { setError(e.message); }
                                  }
                                }}
                              >
                                <Icon name="unlock" />
                                فك
                              </button>
                            )}
                            {can('employees.write') && a.id !== user.id && (
                              <button
                                className="asas-btn sm danger"
                                title="حذف حساب الموظف نهائياً"
                                onClick={() => deleteAccount(a)}
                              >
                                <Icon name="trash" />
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && !busy && <Empty />}
              </div>
            </>
          )}

          {/* ANNOUNCEMENTS TAB */}
          {tab === 'announcements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <p className="asas-muted" style={{ margin: 0 }}>
                  نشر بيانات رسمية تظهر فوراً لجميع الموظفين في التطبيق والموقع مع إرسال بريد إلكتروني اختياري.
                </p>
                <button className="asas-btn primary" onClick={() => { setForm({ ...defaults.announcements }); setModal('announcements'); }}>
                  <Icon name="send" />
                  نشر تعميم رسمي جديد
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {announcements.map(a => (
                  <article key={a.id} className={`asas-announcement-card ${a.priority || 'normal'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>{a.title}</h3>
                      <span className={`asas-badge ${a.priority || 'normal'}`}>
                        {a.priority === 'urgent' ? 'عاجل جداً' : a.priority === 'important' ? 'هام' : 'إشعار رسمي'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-line', margin: '8px 0' }}>
                      {a.content}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 11.5, color: 'var(--text-3)', borderTop: '1px solid var(--hairline)', paddingTop: 8 }}>
                      <div>المرسل: <strong>{a.sender_name || 'الإدارة'}</strong> · <time>{date(a.created_at)}</time></div>
                      {can('employees.write') && (
                        <button className="asas-btn sm danger" onClick={() => deleteAnnouncement(a.id)}>
                          <Icon name="trash" />
                          حذف
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!announcements.length && !busy && <Empty>لا توجد تعميمات نشطة حالياً.</Empty>}
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

          {/* SHIFTS TAB */}
          {tab === 'shifts' && (
            <div className="asas-form-grid">
              {rows.map(s => (
                <Glass key={s.id} style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>{s.name}</h2>
                    <Icon name="clock" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
                    <div>وقت الدوام: <strong dir="ltr">{s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}</strong></div>
                    <div>نهاية الدوام: <strong>{s.close_policy === 'scheduled' ? 'إغلاق تلقائي' : 'انتظار الخروج الفعلي'}</strong></div>
                    <div>خصم مدد المغادرة: <strong>{s.deduct_away ? 'مفعّل' : 'غير مفعّل'}</strong></div>
                  </div>
                  {can('shifts.write') && (
                    <button className="asas-btn sm" style={{ marginTop: 14 }} onClick={() => edit('shifts', s)}>
                      <Icon name="edit" />
                      تعديل السياسة
                    </button>
                  )}
                </Glass>
              ))}
              {!rows.length && !busy && <Empty>أضف جدول دوام لتحديده للموظفين.</Empty>}
            </div>
          )}

          {/* QR CODES TAB */}
          {tab === 'qr' && (
            <Card title="رموز الحضور والانصراف المعتمدة" icon="qrCode">
              <div style={{ padding: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                  <select className="asas-input" style={{ maxWidth: 280 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                    <option value="">اختر الفرع لعرض الرموز</option>
                    {branches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button className="asas-btn primary" onClick={showQr} disabled={!branchId || busy}>
                    <Icon name="qrCode" />
                    عرض الرموز المعتمدة
                  </button>
                </div>

                {qr ? (
                  <div>
                    {(() => {
                      const fixUrl = (u) => {
                        if (!u) return '';
                        if (typeof window === 'undefined') return u;
                        try {
                          const p = new URL(u, window.location.origin);
                          if (p.hostname === 'localhost' || p.hostname === '127.0.0.1') {
                            return `${window.location.origin}${p.pathname}${p.search}${p.hash}`;
                          }
                          return p.toString();
                        } catch (e) { return u; }
                      };
                      const enterUrl = fixUrl(qr.enter?.url || qr.url);
                      const exitUrl = fixUrl(qr.exit?.url || qr.url);

                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <Brand />
                              <h2 style={{ fontSize: 22, marginTop: 8 }}>{qr.branch}</h2>
                              <p className="asas-muted">رموز QR الدائمة المشفرة بـ HMAC-SHA256 · صالحة ومستمرة حتى الإبطال الإداري</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="asas-btn" onClick={() => window.print()}>
                                <Icon name="printer" />
                                طباعة الملصق (A4)
                              </button>
                              <button className="asas-btn danger" onClick={async () => {
                                const reason = window.prompt('سبب إبطال الرموز وتجديدها:');
                                if (!reason) return;
                                try {
                                  await api(`/admin/branches/${branchId}/qr/revoke`, 'POST', { reason });
                                  setQr(null);
                                  setNotice('تم إبطال الرموز وإصدار مراجعة جديدة بنجاح.');
                                } catch (e) { setError(e.message); }
                              }}>
                                <Icon name="trash" />
                                إبطال وتجديد
                              </button>
                            </div>
                          </div>

                          <div className="asas-qr-grid">
                            <div className="asas-qr-card">
                              <span className="asas-badge inside" style={{ marginBottom: 8 }}>كود الحضور (دخول)</span>
                              <div className="asas-qr-box">
                                <QRCodeSVG value={enterUrl} size={210} level="M" includeMargin />
                              </div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>يُعلق عند المدخل · يمسحه الموظف للدخول</p>
                              <a className="asas-btn primary sm" href={enterUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
                                <Icon name="logIn" />
                                فتح صفحة الدخول
                              </a>
                            </div>

                            <div className="asas-qr-card">
                              <span className="asas-badge outside" style={{ marginBottom: 8 }}>كود الانصراف (خروج)</span>
                              <div className="asas-qr-box">
                                <QRCodeSVG value={exitUrl} size={210} level="M" includeMargin />
                              </div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>يُعلق عند المخرج · يمسحه الموظف للانصراف</p>
                              <a className="asas-btn sm" href={exitUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
                                <Icon name="pause" />
                                فتح صفحة الخروج
                              </a>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <Empty>اختر الموقع واضغط على "عرض الرموز المعتمدة".</Empty>
                )}
              </div>
            </Card>
          )}

          {/* LEAVE REQUESTS TAB */}
          {tab === 'leave' && (
            <Card title="طلبات الإجازات والمراجعة" icon="receipt">
              <div className="asas-table-wrap">
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
            </Card>
          )}

          {/* AUDIT LOG TAB */}
          {tab === 'audit' && (
            <Card title="سجل العمليات والرقابة السيادية" icon="shieldCheck">
              <div className="asas-table-wrap">
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
            </Card>
          )}

          {/* SYSTEM SETTINGS TAB */}
          {tab === 'settings' && (
            <form onSubmit={saveSystemSettings} className="asas-form-grid">
              <Glass style={{ gridColumn: '1 / -1', padding: 26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 20 }}>إعدادات النظام وسياسات التشغيل الحقيقية</h2>
                  <Icon name="settings" style={{ color: 'var(--accent)' }} />
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
                  <Icon name="vault" style={{ color: 'var(--accent)' }} />
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
                  <Icon name="sparkle" style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>الفحمي الأساسي (Ink): <code dir="ltr">#221F1F</code></div>
                  <div>الذهبي الملكي (Gold): <code dir="ltr">#BA9555</code></div>
                  <div>الخطوط المعتمدة: <strong>Thmanyah Sans / Serif</strong></div>
                </div>
              </Glass>
            </form>
          )}
        </main>
      </div>

      {/* Floating Asas AI Assistant Robot */}
      <AssistantWidget
        user={{ id: String(user.id), displayName: user.name }}
        title="مساعد أساس الذكي"
        subtitle="استفسر عن مواعيد الحضور، النطاق الجغرافي، أو سياسات النظام"
        suggestions={[
          'كيف أسجل حضوري وانصرافي؟',
          'ما هي ساعات الدوام الرسمية؟',
          'كيف أغير صورة حسابي أو كلمة المرور؟',
          'ما هو نطاق الموقع الجغرافي؟'
        ]}
        ask={async (messages) => {
          const last = messages[messages.length - 1]?.content || '';
          if (last.includes('حضور') || last.includes('انصراف')) {
            return { reply: 'لتسجيل الحضور أو الانصراف: يمكنك الضغط على الزر الذكي المباشر في صفحتك، أو مسح رمز QR المعلق عند مدخل الفرع بكاميرا الجوال، مع تفعيل خدمة الموقع الجغرافي (GPS).' };
          }
          if (last.includes('دوام') || last.includes('ساعات')) {
            return { reply: 'ساعات العمل الرسمية المعتمدة تبدأ من الساعة 08:00 صباحاً وحتى 04:00 عصراً، مع فترة سماح 15 دقيقة للتأخير الصباحي.' };
          }
          if (last.includes('كلمة') || last.includes('مرور') || last.includes('صورة') || last.includes('أفاتار')) {
            return { reply: 'يمكنك تغيير صورة حسابك أو كلمة المرور بالضغط على صورتك الرمزية أو زر «الملف الشخصي والأمان» في أعلى الصفحة واختيار الأفاتار أو إدخال كلمة المرور الجديدة.' };
          }
          if (last.includes('موقع') || last.includes('نطاق') || last.includes('GPS')) {
            return { reply: 'نطاق الموقع الجغرافي المعتمد هو 80 متراً لدخول النطاق و120 متراً لتأكيد الخروج، مع هامش خطأ أقصاه 30 متراً.' };
          }
          return { reply: 'أهلاً بك في نظام أساس! أنا هنا لمساعدتك في استفسارات الحضور والانصراف، وربط الأجهزة، ومواعيد المناوبات.' };
        }}
      />

      {/* MODALS */}
      {showAnnouncementsModal && (
        <AnnouncementsModal
          announcements={announcements}
          onClose={() => setShowAnnouncementsModal(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onUpdated={(u) => setUser(u)}
        />
      )}

      {modal && (
        <div className="asas-modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setModal(null); }}>
          <section className="asas-modal" role="dialog" aria-modal="true" aria-label="تحرير البيانات">
            <div className="asas-modal-head">
              <h2>
                {modal === 'announcements' ? 'نشر تعميم رسمي جديد' : (form.id ? 'تعديل' : 'إضافة')} {
                  modal === 'branches' ? 'موقع الشركة'
                    : modal === 'shifts' ? 'الدوام وسياسة الاحتساب'
                    : modal === 'records' ? 'سجل الحضور'
                    : modal === 'accounts' ? 'حساب موظف' : ''
                }
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
                  <Field label="اسم جدول الدوام" required value={form.name} onChange={e => set('name', e.target.value)} />
                  <div className="asas-form-grid">
                    <Field label="بداية الدوام" type="time" value={form.start_time.slice(0, 5)} required onChange={e => set('start_time', e.target.value)} />
                    <Field label="نهاية الدوام" type="time" value={form.end_time.slice(0, 5)} required onChange={e => set('end_time', e.target.value)} />
                  </div>
                  <Field label="فترة السماح بالدقائق" type="number" min="0" max="120" value={form.grace_minutes} onChange={e => set('grace_minutes', e.target.value)} />
                  <Field label="عند نهاية الدوام">
                    <select className="asas-input" value={form.close_policy} onChange={e => set('close_policy', e.target.value)}>
                      <option value="actual_exit">انتظار الخروج الفعلي</option>
                      <option value="scheduled">إغلاق تلقائي بنهاية الدوام</option>
                    </select>
                  </Field>
                </>
              )}

              {modal === 'accounts' && (
                <>
                  <div className="asas-form-grid">
                    <Field label="الاسم الكامل للموظف" required value={form.name} onChange={e => set('name', e.target.value)} />
                    <Field
                      label="الرقم الوظيفي (تلقائي ودائم)"
                      disabled
                      className="asas-readonly-id"
                      value={form.identifier || ''}
                      onChange={e => set('identifier', e.target.value)}
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

                  {user.role === 'super_admin' && !form.id && (
                    <Field label="الدور والصلاحية">
                      <select className="asas-input" value={form.role} onChange={e => set('role', e.target.value)}>
                        {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </Field>
                  )}

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

                  {form.id && <label className="asas-check"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />حساب نشط</label>}
                </>
              )}

              {(form.id || modal === 'branches' || modal === 'records') && (
                <Field label="سبب التغيير (يوثق في سجل العمليات)" required value={form.reason || ''} onChange={e => set('reason', e.target.value)} />
              )}

              <div className="asas-modal-footer" style={{ margin: '10px -24px -20px' }}>
                <button className="asas-btn" type="button" onClick={() => setModal(null)}>إلغاء</button>
                <button className="asas-btn primary" type="submit" disabled={busy}>
                  <Icon name="check" />
                  {modal === 'announcements' ? 'نشر التعميم' : 'حفظ التغييرات'}
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
function Login({ onLogin, initialError, onRetry }) {
  const [identifier, setIdentifier] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('asas_saved_identifier') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('asas_remember_me') !== 'false');
    }
    return true;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function initGsi() {
      if (!window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const el = document.getElementById('google-btn-container');
        if (el) {
          el.innerHTML = '';
          window.google.accounts.id.renderButton(el, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 320,
            locale: 'ar'
          });
        }
      } catch (err) {
        console.warn('GSI render error:', err);
      }
    }

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          initGsi();
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [handleGoogleCredentialResponse]);

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

  return (
    <div className="asas-login">
      <section className="asas-login-hero">
        <Brand />
        <div>
          <p className="asas-eyebrow">منظومة الحضور الذكية</p>
          <h1><Swash>حضور مؤكد</Swash><br /><span>وفريق متصل دائماً.</span></h1>
          <p>مساحة عمل تنفيذية لإدارة الحضور والانصراف بدقة وموثوقية عالية، متصلة بسجلات الأجهزة وقواعد البيانات السيادية.</p>
        </div>
        <footer>
          <span>شركة أساس الذكاء الاصطناعي</span>
          <p>نظام حضور ذكي ومحمي</p>
        </footer>
      </section>

      <section className="asas-login-form-wrap">
        <div className="asas-login-box">
          <p className="asas-eyebrow">بوابة الدخول الموحدة</p>
          <h2>تسجيل الدخول إلى أساس</h2>
          <p className="asas-muted">أدخل بياناتك المعتمدة للوصول إلى لوحة التحكم أو مساحة الموظف.</p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
            {error && (
              <div className="asas-notice error" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>{error}</div>
                {onRetry && (
                  <button type="button" onClick={async () => { setBusy(true); await onRetry(); setBusy(false); }} disabled={busy} className="asas-btn sm" style={{ alignSelf: 'flex-start' }}>
                    <Icon name="refresh" />
                    {busy ? 'جارٍ الفحص…' : 'إعادة فحص الاتصال'}
                  </button>
                )}
              </div>
            )}

            <Field
              label="البريد الإلكتروني أو الرقم الوظيفي"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              autoComplete="username"
              required
              placeholder="مثال: 001 أو name@company.com"
            />

            <Field
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
            />

            <label className="asas-remember-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span>تذكر بيانات الدخول على هذا الجهاز</span>
            </label>

            <button className="asas-btn primary" type="submit" disabled={busy} style={{ width: '100%', height: 46 }}>
              <Icon name="logIn" />
              {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>أو الدخول السريع عبر Google</span>
              <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: 44 }}>
              <div id="google-btn-container" style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />
            </div>
          </form>

          <div style={{ marginTop: 18, padding: 12, background: 'var(--glass-inset)', borderRadius: 10, fontSize: 11.5, color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'flex-start', border: '1px solid var(--hairline)' }}>
            <Icon name="smartphone" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
            <div>
              <strong>نظام تقييد الجوال المعتمد:</strong> يتم ربط الحساب بجوال الموظف الشخصي تلقائياً عند أول تسجيل دخول لضمان صحة التسجيل ومنع التحضير بالنيابة.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// EMPLOYEE PORTAL
function Employee({ user, logout, announcements, onOpenAnnouncements, onOpenProfile }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [leave, setLeave] = useState({ from_date: today(), to_date: today(), reason: '' });
  const [liveTime, setLiveTime] = useState('');
  const [cameraModal, setCameraModal] = useState(false);
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
              try {
                const u = new URL(raw);
                const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
                t = hash.get('qr') || u.searchParams.get('token') || raw;
              } catch (_) {}
              setToken(t);
              act('auto', t);
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

  useEffect(() => {
    const update = () => setLiveTime(new Intl.DateTimeFormat('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Aden' }).format(new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(() => {
    api('/attendance/me')
      .then(setData)
      .catch(e => {
        if (e.status === 401) logout();
        else setError(e.message);
      });
  }, [logout]);

  useEffect(() => {
    load();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setToken(hash.get('qr') || '');
    window.history.replaceState(null, '', window.location.pathname);

    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load();
      }
    }, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  async function act(action, customToken = null) {
    setBusy(true);
    setError('');
    try {
      let currentToken = customToken || token;
      if (!currentToken) {
        try {
          const qrData = await api(`/attendance/active-qr?action=${action === 'auto' ? '' : action}`);
          if (qrData?.token) currentToken = qrData.token;
        } catch (err) {}
      }
      if (!currentToken) throw new Error('يرجى مسح رمز QR الخاص بالفرع لتأكيد التواجد');
      const p = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('الموقع غير متاح'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      });
      const fix = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, captured_at: new Date(p.timestamp).toISOString() };
      const device_id = getDeviceId();
      const reqId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('req-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      const r = await api('/attendance/action', 'POST', { action, token: currentToken, request_id: reqId, device_id, fix });
      setMessage(r.message || 'تم توثيق الحضور بنجاح');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const todayRecord = data?.records?.[0];
  const isInside = todayRecord?.state === 'inside';

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <Glass style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="asas-bell-btn" onClick={onOpenAnnouncements} aria-label="الإشعارات">
            <Icon name="bell" />
            {announcements.length > 0 && <span className="asas-bell-badge">{announcements.length}</span>}
          </button>
          <button className="asas-btn sm" onClick={logout}>
            <Icon name="logout" />
            خروج
          </button>
        </div>
      </Glass>

      {/* Profile Card */}
      <Glass style={{ padding: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <UserAvatar user={user} size="lg" onClick={onOpenProfile} />
          <div>
            <h1 style={{ fontSize: 22, margin: '0 0 4px', color: 'var(--text)' }}>
              <Stretch before="أهْـ" after="ـلاً" length={2} />، {user.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="asas-readonly-id" style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12.5 }}>
                الرقم الوظيفي: {user.identifier}
              </span>
              <span className="asas-badge inside" style={{ fontSize: 11 }}>موظف معتمد</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{user.email || '—'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="asas-btn" onClick={onOpenProfile}>
            <Icon name="key" />
            الملف الشخصي والأمان
          </button>
          <div className="asas-clock-pill">
            <Icon name="clock" style={{ width: 14, height: 14, color: 'var(--accent)' }} />
            <span>صنعاء: <strong>{liveTime || '—'}</strong></span>
          </div>
        </div>
      </Glass>

      {error && (
        <div className="asas-notice error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>{error}</span>
          <button className="asas-btn sm" onClick={load} disabled={busy}>
            <Icon name="refresh" />
            إعادة المحاولة
          </button>
        </div>
      )}
      {message && <div className="asas-notice">{message}</div>}

      {/* Attendance Big Card */}
      <Card title="حالة وسجل حضور اليوم" icon="calendar">
        <div style={{ padding: 10 }}>
          <div style={{ background: isInside ? 'var(--paid-bg)' : 'var(--glass-inset)', border: `1px solid ${isInside ? 'rgba(35, 116, 74, 0.3)' : 'var(--hairline)'}`, padding: '14px 18px', borderRadius: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block' }}>الحالة اللحظية:</span>
              <strong style={{ fontSize: 16, color: isInside ? 'var(--paid)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Icon name={isInside ? 'checkCircle' : 'pause'} style={{ width: 18, height: 18 }} />
                {isInside ? 'داخل مقر العمل (حضور مفتوح)' : (todayRecord?.last_out ? 'تم تسجيل الانصراف وإنهاء الدوام' : 'جاهز لتسجيل الحضور')}
              </strong>
            </div>
            <span className={`asas-badge ${isInside ? 'inside' : 'outside'}`}>
              الإجراء التلقائي: {isInside ? 'تسجيل الانصراف' : 'تسجيل الحضور'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'var(--glass-inset)', padding: 12, borderRadius: 12, textAlign: 'center', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>أول دخول (حضور)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{todayRecord?.first_in ? time(todayRecord.first_in) : '—'}</div>
            </div>
            <div style={{ background: 'var(--glass-inset)', padding: 12, borderRadius: 12, textAlign: 'center', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>آخر خروج (انصراف)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{todayRecord?.last_out ? time(todayRecord.last_out) : '—'}</div>
            </div>
            <div style={{ background: 'var(--glass-inset)', padding: 12, borderRadius: 12, textAlign: 'center', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>سبب الخروج</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>{todayRecord?.exit_reason_label || (isInside ? 'قيد الدوام' : '—')}</div>
            </div>
          </div>

          {/* Smart Button */}
          <button
            className={`asas-btn ${isInside ? 'danger' : 'primary'}`}
            disabled={busy}
            onClick={() => act('auto')}
            style={{ width: '100%', height: 52, fontSize: 16, marginBottom: 10 }}
          >
            <Icon name={isInside ? 'pause' : 'logIn'} />
            {isInside ? 'تسجيل الانصراف التلقائي الآن' : 'تسجيل الحضور التلقائي الآن'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="asas-btn" onClick={startCamera} style={{ flex: 1, justifyContent: 'center' }}>
              <Icon name="camera" />
              مسح QR بكاميرا الجوال
            </button>
            <button className="asas-btn" onClick={() => act('enter')} disabled={busy}>
              <Icon name="logIn" />
              دخول يدوي
            </button>
            <button className="asas-btn" onClick={() => act('exit')} disabled={busy}>
              <Icon name="pause" />
              خروج يدوي
            </button>
          </div>
        </div>
      </Card>

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

      {/* Leave Request Card */}
      <Card title="طلب إجازة" icon="receipt">
        <form onSubmit={async e => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/leave', 'POST', leave);
            setMessage('تم إرسال طلب الإجازة للمراجعة بنجاح');
            setLeave({ ...leave, reason: '' });
          } catch (e) { setError(e.message); } finally { setBusy(false); }
        }} style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="asas-form-grid">
            <Field label="من تاريخ" type="date" required value={leave.from_date} onChange={e => setLeave({ ...leave, from_date: e.target.value })} />
            <Field label="إلى تاريخ" type="date" required value={leave.to_date} onChange={e => setLeave({ ...leave, to_date: e.target.value })} />
          </div>
          <Field label="السبب" required value={leave.reason} onChange={e => setLeave({ ...leave, reason: e.target.value })} />
          <button className="asas-btn primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>
            <Icon name="send" />
            إرسال الطلب
          </button>
        </form>
      </Card>

      {/* Recent Records Card */}
      <Card title="سجل حضوري الأخير" icon="calendar">
        <Records rows={(data?.records || []).map(r => ({ ...r, name: user.name, identifier: user.identifier }))} />
      </Card>
    </div>
  );
}

export default function AsasApp() {
  return (
    <ErrorBoundary>
      <AsasAppInner />
    </ErrorBoundary>
  );
}
