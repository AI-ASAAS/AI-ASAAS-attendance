'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Users, MapPin, QrCode, Clock3, CalendarDays, FileText, File,
  ShieldCheck, LogOut, Menu, X, Plus, RefreshCw, Download, ArrowUpLeft, Search,
  Building2, Signal, CheckCircle2, AlertCircle, Printer, Settings2, LogIn,
  Smartphone, Mail, Phone, KeyRound, ShieldAlert, Unlock, Camera, Trash2, Bell,
  UserCircle, Edit3, Save, Send, Volume2, Shield, Sparkles, Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getDeviceId, getDeviceName } from '../../utils/device';

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

async function api(path, method = 'GET', body, retries = 2) {
  let attempt = 0;
  while (true) {
    try {
      const headers = {};
      if (body) headers['Content-Type'] = 'application/json';
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('asas_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const r = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      });

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
          await new Promise(res => setTimeout(res, 800 * attempt));
          continue;
        }
        const msg = value?.message || value?.error || (r.status === 401 ? 'يرجى تسجيل الدخول' : 'تعذر الاتصال بالخادم');
        throw Object.assign(new Error(msg), { status: r.status });
      }

      return value ? value.data : null;
    } catch (netErr) {
      if (attempt < retries && (!netErr.status || [502, 503, 504].includes(netErr.status))) {
        attempt++;
        await new Promise(res => setTimeout(res, 800 * attempt));
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
const tabs = [
  ['dashboard', 'نظرة عامة', LayoutDashboard],
  ['records', 'الحضور والانصراف', CalendarDays],
  ['accounts', 'الموظفون والأجهزة', Users],
  ['announcements', 'التعميمات والإشعارات', Bell],
  ['branches', 'المواقع والفروع', MapPin],
  ['qr', 'رموز QR المعتمدة', QrCode],
  ['shifts', 'الدوام والاحتساب', Clock3],
  ['leave', 'الإجازات', FileText],
  ['audit', 'سجل العمليات', ShieldCheck],
  ['settings', 'إعدادات النظام', Settings2]
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
      <span className="asas-mark">
        <img src="/brand/asas-logo.png" alt="شعار أساس" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </span>
      <div>
        <strong>أساس</strong>
        <small>نظام إدارة الحضور الذكي</small>
      </div>
    </div>
  );
}

function Button({ children, icon: Icon, variant = '', ...props }) {
  return <button className={`asas-btn ${variant}`} {...props}>{Icon && <Icon size={16} />}{children}</button>;
}

function Badge({ state }) {
  return <span className={`asas-badge ${state}`}>{states[state] || state}</span>;
}

function Empty({ children = 'لا توجد سجلات بعد' }) {
  return <div className="asas-empty"><FileText size={32} />{children}</div>;
}

function Field({ label, children, ...props }) {
  return <label className="asas-label">{label}{children || <input className="asas-input" {...props} />}</label>;
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
                <td><strong>{r.name}</strong><small>{r.identifier}</small></td>
                <td>{r.branch_name}</td>
                <td>{date(r.shift_start)}</td>
                <td><span style={{ color: '#2d6a4f', fontWeight: 600 }}>{time(r.first_in)}</span></td>
                <td><span style={{ color: isInside ? '#856404' : '#231f20' }}>{time(r.last_out)}</span></td>
                <td>
                  <span className={`asas-badge ${isInside ? 'inside' : 'outside'}`} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: isInside ? (isLate ? '#fff3cd' : '#eaf4ee') : (isEarly ? '#ffe8cc' : '#f5f3f0'),
                    color: isInside ? (isLate ? '#856404' : '#2d6a4f') : (isEarly ? '#d9480f' : '#474143'),
                    fontWeight: 600
                  }}>
                    {isInside ? (isLate ? <Clock3 size={12} /> : <CheckCircle2 size={12} />) : <LogOut size={12} />}
                    {statusLabel}
                  </span>
                </td>
                <td>
                  <span style={{
                    fontSize: 12,
                    color: isInside ? '#736d65' : (exitReasonLabel.includes('مبكر') ? '#c92a2a' : (exitReasonLabel.includes('إضافي') ? '#1e7e34' : '#2b8a3e')),
                    fontWeight: exitReasonLabel.includes('مبكر') || exitReasonLabel.includes('إضافي') ? 600 : 500,
                    display: 'inline-block'
                  }}>
                    {exitReasonLabel}
                  </span>
                </td>
                <td>{r.counted_minutes == null ? 'مفتوح' : `${r.counted_minutes} دقيقة`}<small>{r.deduct_away ? 'مع خصم المغادرة' : 'دون خصم المغادرة'}</small></td>
                {canEdit && <td><Button onClick={() => onEdit(r)}>تصحيح</Button></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Announcements Dialog
function AnnouncementsModal({ announcements, onClose, onRefresh }) {
  return (
    <div className="asas-modal-backdrop" onClick={onClose}>
      <section className="asas-modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="asas-card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={20} style={{ color: 'var(--gold)' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>التعميمات والإشعارات الرسمية</h2>
          </div>
          <Button icon={X} onClick={onClose} aria-label="إغلاق" />
        </div>
        <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: 18 }}>
          {announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
              <Bell size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p>لا توجد تعميمات جديدة حالياً.</p>
            </div>
          ) : (
            announcements.map(a => (
              <article key={a.id} className={`asas-announcement-card ${a.priority || 'normal'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>{a.title}</h3>
                  <span className={`asas-badge ${a.priority || 'normal'}`}>
                    {a.priority === 'urgent' ? 'عاجل جداً' : a.priority === 'important' ? 'هام' : 'إشعار رسمي'}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3f3b37', whiteSpace: 'pre-line', margin: '8px 0' }}>
                  {a.content}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 11.5, color: 'var(--muted)', borderTop: '1px solid #f0ecdf', paddingTop: 8 }}>
                  <span>المرسل: <strong>{a.sender_name || 'الإدارة'}</strong></span>
                  <time>{date(a.created_at)} · {time(a.created_at)}</time>
                </div>
              </article>
            ))
          )}
        </div>
        <div className="asas-modal-footer">
          <Button variant="primary" onClick={onClose}>إغلاق</Button>
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
        <div className="asas-card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={20} style={{ color: 'var(--gold)' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>الملف الشخصي وإعدادات الأمان</h2>
          </div>
          <Button icon={X} onClick={onClose} aria-label="إغلاق" />
        </div>

        <form onSubmit={submit} className="asas-form" style={{ padding: 18 }}>
          {msg && <div className="asas-notice">{msg}</div>}
          {err && <div className="asas-notice error">{err}</div>}

          {/* Avatar Selector */}
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
              label="أو رابط صورة خارجية مخصص (URL)"
              placeholder="https://..."
              value={customAvatarUrl}
              onChange={e => setCustomAvatarUrl(e.target.value)}
            />
          </div>

          <Field
            label="رقم الهاتف / الجوال"
            type="tel"
            placeholder="+967 77xxxxxxx"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />

          <div style={{ borderTop: '1px solid #ebdcc0', paddingTop: 14, marginTop: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} style={{ color: 'var(--gold)' }} />
              تغيير كلمة المرور
            </div>
            <p className="asas-muted" style={{ fontSize: 11.5, marginBottom: 10 }}>اتركها فارغة إذا كنت لا ترغب بتغيير كلمة المرور.</p>
            <Field
              label="كلمة المرور الحالية"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
            <div className="asas-form-grid">
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

          <div className="asas-modal-footer">
            <Button type="button" onClick={onClose}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'جارٍ الحفظ…' : 'حفظ التحديثات'}
            </Button>
          </div>
        </form>
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
          <div className="asas-card" style={{ maxWidth: 500, width: '100%', padding: 24, textAlign: 'center' }}>
            <Brand />
            <h2 style={{ color: '#c92a2a', marginTop: 16 }}>حدث خطأ أثناء عرض الصفحة</h2>
            <p className="asas-muted" style={{ marginTop: 8 }}>
              {this.state.error?.message || 'تعذر استكمال العرض. تم تسجيل الخطأ لحمايتك.'}
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                🔄 إعادة تحميل الصفحة
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AsasAppInner() {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('asas_account');
        return saved ? JSON.parse(saved) : null;
      } catch (_) {}
    }
    return null;
  });
  const [boot, setBoot] = useState(true);
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
    if (isManual) setBusy(true);
    let attempts = 0;
    const maxAttempts = isManual ? 1 : 3;
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const u = await api('/auth/me');
        setUser(u);
        if (typeof window !== 'undefined') localStorage.setItem('asas_account', JSON.stringify(u));
        setError('');
        setBoot(false);
        if (isManual) setBusy(false);
        return;
      } catch (e) {
        if (e.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('asas_token');
            localStorage.removeItem('asas_account');
          }
          setUser(null);
          setError('');
          setBoot(false);
          if (isManual) setBusy(false);
          return;
        }
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000));
        } else {
          setError('تعذر الاتصال بالخادم. تحقق من تشغيل خدمة أساس وقاعدة البيانات.');
          setBoot(false);
          if (isManual) setBusy(false);
        }
      }
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

  const load = useCallback(async () => {
    if (!user || user.role === 'employee') return;
    setBusy(true);
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
      setData(null);
      setError(e.message);
      if (e.status === 401) setUser(null);
    } finally {
      setBusy(false);
    }
  }, [user, tab, from, to]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
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
      // Calculate next sequential permanent employee ID (e.g., 001, 002, 003...)
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

  if (boot) return <div className="asas-app"><Empty>جارٍ التحقق من الجلسة…</Empty></div>;
  if (!user) return <Login onLogin={setUser} initialError={error} onRetry={() => checkAuth(true)} />;
  if (user.role === 'employee') {
    return (
      <Employee
        user={user}
        logout={logout}
        announcements={announcements}
        onOpenAnnouncements={() => setShowAnnouncementsModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
      />
    );
  }

  const title = tabs.find(t => t[0] === tab)?.[1];
  const rows = Array.isArray(data) ? data : [];
  const set = (k, value) => setForm(f => ({ ...f, [k]: value }));

  return (
    <div className="asas-app">
      {open && <div className="asas-modal-backdrop" style={{ background: 'rgba(35,31,32,0.4)', zIndex: 25 }} onClick={() => setOpen(false)} />}
      <aside className={`asas-sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <p className="asas-nav-label">مساحة الإدارة التنفيذية</p>
        <nav className="asas-nav">
          {tabs.filter(([key]) => key !== 'accounts' || can('employees.read')).filter(([key]) => key !== 'audit' || can('audit.read')).map(([key, label, Icon]) => (
            <button className={tab === key ? 'active' : ''} key={key} onClick={() => { setTab(key); setOpen(false); setData(null); setNotice(''); setSearch(''); }}>
              <Icon size={17} />
              {label}
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
          <Button icon={LogOut} onClick={logout}>تسجيل الخروج</Button>
        </div>
      </aside>

      <div className="asas-main">
        <header className="asas-topbar">
          <div className="asas-actions" style={{ alignItems: 'center', gap: 12 }}>
            <button className="asas-btn asas-menu" aria-label="القائمة" onClick={() => setOpen(!open)}><Menu size={18} /></button>
            <span>مساحة العمل / <strong>{title}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="asas-bell-btn" onClick={() => setShowAnnouncementsModal(true)} aria-label="التعميمات">
              <Bell size={18} />
              {announcements.length > 0 && <span className="asas-bell-badge">{announcements.length}</span>}
            </button>
            <div style={{ cursor: 'pointer' }} onClick={() => setShowProfileModal(true)} title="الملف الشخصي">
              <UserAvatar user={user} size="sm" />
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {new Date().toLocaleDateString('ar-YE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Aden' })} · {liveTime || '—'} · توقيت صنعاء
            </span>
          </div>
        </header>

        <main className="asas-content">
          <div className="asas-heading">
            <div>
              <p className="asas-eyebrow">أساس · لوحة القيادة التنفيذية</p>
              <h1>{title}</h1>
              <p className="asas-muted">إدارة فورية، حوكمة مؤكدة، وقاعدة بيانات لحظية متصلة.</p>
            </div>
            <div className="asas-actions">
              <Button icon={RefreshCw} onClick={load} disabled={busy}>تحديث فوري</Button>
              {['branches', 'shifts', 'accounts'].includes(tab) && can({ branches: 'locations.write', shifts: 'shifts.write', accounts: 'employees.write' }[tab]) && (
                <Button variant="primary" icon={Plus} onClick={() => edit(tab, null)}>
                  إضافة {tab === 'branches' ? 'موقع' : tab === 'shifts' ? 'دوام' : 'موظف'}
                </Button>
              )}
              {tab === 'announcements' && (
                <Button variant="primary" icon={Plus} onClick={() => { setForm({ ...defaults.announcements }); setModal('announcements'); }}>
                  نشر تعميم جديد
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div role="alert" className="asas-notice error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{error}</span>
              <Button type="button" icon={RefreshCw} onClick={load} disabled={busy} style={{ padding: '4px 10px', fontSize: 12 }}>إعادة المحاولة</Button>
            </div>
          )}
          {notice && <div role="status" className="asas-notice">{notice}</div>}
          {busy && !data && <Empty>جارٍ جلب وتحديث البيانات لحظياً…</Empty>}

          {/* DASHBOARD TAB */}
          {tab === 'dashboard' && data && (
            <>
              <section className="asas-banner">
                <div className="asas-banner-copy">
                  <p className="asas-eyebrow">منظومة أساس السيادية</p>
                  <h2>صورة واضحة ومباشرة ليوم فريقك.</h2>
                  <p>حضور مؤكد جغرافياً ومقيد بأجهزة الموظفين مع تحديث لحظي على السحابة.</p>
                  <Button variant="gold" icon={QrCode} onClick={() => setTab('qr')}>رموز QR المعتمدة</Button>
                </div>
                <div className="asas-banner-emblem" aria-hidden="true">
                  <img src="/brand/asas-logo.png" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <span>AI-ASAAS Attendance</span>
                </div>
              </section>

              <section className="asas-stats">
                {[
                  [Users, 'إجمالي الموظفين', data.total, 'الحسابات المسجلة في النظام'],
                  [CheckCircle2, 'سجّلوا الحضور اليوم', data.present, 'خلال ساعات الدوام الحالية'],
                  [MapPin, 'داخل نطاق الموقع', data.inside, 'حسب تأكيد GPS الفعلي'],
                  [AlertCircle, 'الموقع غير مؤكد', data.uncertain, 'تتطلب مراجعة أو فحص اتصال']
                ].map(([Icon, label, value, caption]) => (
                  <article className="asas-stat" key={label}>
                    <div className="asas-stat-top">{label}<Icon size={18} /></div>
                    <strong>{value}</strong>
                    <small>{caption}</small>
                  </article>
                ))}
              </section>

              <section className="asas-grid">
                <article className="asas-card">
                  <div className="asas-card-head">
                    <h2>نسبة الحضور اليوم</h2>
                    <span className="asas-badge">{data.total ? Math.round(data.present / data.total * 100) : 0}%</span>
                  </div>
                  <div className="asas-card-body">
                    <p className="asas-muted">مؤشر التحضير الفعلي للموظفين المسجلين</p>
                    <div className="asas-progress"><span style={{ width: `${data.total ? Math.min(100, data.present / data.total * 100) : 0}%` }} /></div>
                    <div className="asas-mini-row"><span>لم يسجلوا حضوراً بعد</span><strong>{Math.max(0, data.total - data.present)}</strong></div>
                    <div className="asas-mini-row"><span>حالات التأخير المرصودة</span><strong>{data.late}</strong></div>
                  </div>
                </article>

                <article className="asas-card">
                  <div className="asas-card-head">
                    <h2>حالة النطاق والمواقع</h2>
                    <Building2 size={18} />
                  </div>
                  <div className="asas-card-body">
                    <p className="asas-muted">إدارة الفروع المعتمدة والحدود الجغرافية</p>
                    <div className="asas-mini-row"><span>حالة الرموز</span><strong>دائمة وثابتة</strong></div>
                    <div className="asas-mini-row"><span>الربط مع السحابة</span><strong>متصل ومحدث</strong></div>
                    <Button icon={ArrowUpLeft} onClick={() => setTab('branches')}>إدارة المواقع الجغرافية</Button>
                  </div>
                </article>
              </section>

              <section className="asas-card">
                <div className="asas-card-head">
                  <h2>آخر سجلات الحضور والانصراف</h2>
                  <Button onClick={() => setTab('records')}>جميع السجلات</Button>
                </div>
                <Records rows={data.records.slice(0, 10)} onEdit={r => edit('records', r)} canEdit={can('attendance.edit')} />
              </section>
            </>
          )}

          {/* RECORDS TAB */}
          {tab === 'records' && (
            <>
              <div className="asas-search" style={{ flexWrap: 'wrap', gap: 8 }}>
                <Field label="من تاريخ" type="date" value={from} onChange={e => setFrom(e.target.value)} />
                <Field label="إلى تاريخ" type="date" value={to} onChange={e => setTo(e.target.value)} />
                {can('reports.export') && (
                  <div className="asas-actions" style={{ display: 'inline-flex', gap: 6, alignItems: 'flex-end' }}>
                    <Button icon={Download} disabled={busy} onClick={exportCsv}>تصدير Excel/CSV</Button>
                    <Button icon={FileText} disabled={busy} onClick={exportWord}>تصدير Word</Button>
                    <Button icon={File} disabled={busy} onClick={exportTxt}>تصدير نصي (TXT)</Button>
                  </div>
                )}
              </div>
              <div className="asas-card">
                <Records rows={rows} onEdit={r => edit('records', r)} canEdit={can('attendance.edit')} />
              </div>
            </>
          )}

          {/* ACCOUNTS / EMPLOYEES TAB */}
          {tab === 'accounts' && (
            <>
              <div className="asas-search">
                <Search size={18} />
                <input className="asas-input" aria-label="البحث عن موظف" placeholder="ابحث بالاسم أو الرقم الوظيفي أو البريد أو الهاتف…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="asas-card asas-table-wrap">
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
                              <small style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold-dark)' }}>{a.identifier}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {a.attendance_status === 'inside' ? (
                            <div>
                              <span className="asas-badge inside" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} />حاضر الآن</span>
                              {a.today_first_in && <small style={{ display: 'block', color: '#2d6a4f', fontSize: 10 }}>دخول: {time(a.today_first_in)}</small>}
                            </div>
                          ) : a.attendance_status === 'outside' ? (
                            <div>
                              <span className="asas-badge outside" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LogOut size={12} />تم الانصراف</span>
                              {a.today_last_out && <small style={{ display: 'block', color: '#736d65', fontSize: 10 }}>خروج: {time(a.today_last_out)}</small>}
                            </div>
                          ) : a.attendance_status === 'leave' ? (
                            <span className="asas-badge pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={12} />في إجازة</span>
                          ) : (
                            <span className="asas-badge" style={{ background: '#f5f3f0', color: '#736d65', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} />لم يسجل اليوم</span>
                          )}
                        </td>
                        <td>
                          <div>
                            <strong>{a.email || '—'}</strong>
                            <small style={{ display: 'block' }}>{a.phone || '—'}</small>
                          </div>
                        </td>
                        <td>
                          {a.bound_device_id ? (
                            <div>
                              <span className="asas-badge inside" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Smartphone size={12} />{a.bound_device_name || 'جوال مقيد'}</span>
                              <small style={{ display: 'block', color: '#736d65', fontSize: 10 }} dir="ltr">{a.bound_device_id.slice(0, 12)}…</small>
                            </div>
                          ) : (
                            <span className="asas-badge outside">غير مقيد</span>
                          )}
                        </td>
                        <td>{roles[a.role]}</td>
                        <td><span className={`asas-badge ${a.active ? 'inside' : 'outside'}`}>{a.active ? 'نشط' : 'معطّل'}</span></td>
                        <td>
                          <div className="asas-actions">
                            {can('employees.write') && <Button onClick={() => edit('accounts', a)}>إدارة</Button>}
                            {can('employees.write') && a.bound_device_id && (
                              <Button
                                variant="danger"
                                title="فك ارتباط هذا الجوال"
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
                                <Unlock size={14} />فك
                              </Button>
                            )}
                            {can('employees.write') && a.id !== user.id && (
                              <Button
                                variant="danger"
                                title="حذف حساب الموظف نهائياً"
                                onClick={() => deleteAccount(a)}
                              >
                                <Trash2 size={14} />حذف
                              </Button>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <p className="asas-muted" style={{ margin: 0 }}>
                  تتيح لك هذه اللوحة نشر تعميمات وبيانات رسمية تظهر فوراً لجميع الموظفين في التطبيق والموقع مع إمكانية إرسال نسخة بالبريد الإلكتروني.
                </p>
                <Button variant="primary" icon={Plus} onClick={() => { setForm({ ...defaults.announcements }); setModal('announcements'); }}>
                  نشر تعميم رسمي جديد
                </Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {announcements.map(a => (
                  <article key={a.id} className={`asas-announcement-card ${a.priority || 'normal'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>{a.title}</h3>
                      <span className={`asas-badge ${a.priority || 'normal'}`}>
                        {a.priority === 'urgent' ? 'عاجل جداً' : a.priority === 'important' ? 'هام' : 'إشعار رسمي'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3f3b37', whiteSpace: 'pre-line', margin: '8px 0' }}>
                      {a.content}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 11.5, color: 'var(--muted)', borderTop: '1px solid #f0ecdf', paddingTop: 8 }}>
                      <div>المرسل: <strong>{a.sender_name || 'الإدارة'}</strong> · <time>{date(a.created_at)}</time></div>
                      {can('employees.write') && (
                        <Button variant="danger" icon={Trash2} onClick={() => deleteAnnouncement(a.id)} style={{ padding: '3px 8px', fontSize: 11.5 }}>
                          حذف
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!announcements.length && !busy && <Empty>لا توجد تعميمات نشطة حالياً. يمكنك نشر أول تعميم رسمي الآن.</Empty>}
            </div>
          )}

          {/* BRANCHES TAB */}
          {tab === 'branches' && (
            <div className="asas-form-grid">
              {rows.map(b => (
                <article className="asas-card" key={b.id}>
                  <div className="asas-card-head">
                    <h2>{b.name}</h2>
                    <span className="asas-badge">{b.active ? 'مفعل' : 'متوقف'}</span>
                  </div>
                  <div className="asas-card-body">
                    <div className="asas-mini-row"><span>نطاق الدخول / الخروج</span><strong>{b.entry_radius} / {b.exit_radius} م</strong></div>
                    <div className="asas-mini-row"><span>أقصى هامش خطأ</span><strong>{b.max_accuracy} م</strong></div>
                    <div className="asas-mini-row"><span>تأكيد المغادرة</span><strong>{b.exit_samples} قراءات / {b.exit_delay_seconds} ثانية</strong></div>
                    <p className="asas-help" dir="ltr">{b.latitude}, {b.longitude}</p>
                    <iframe className="asas-map" src={`https://maps.google.com/maps?q=${b.latitude},${b.longitude}&hl=ar&z=17&output=embed`} loading="lazy" title={`خريطة Google - ${b.name}`} allowFullScreen />
                    <div className="asas-actions" style={{ marginTop: 15 }}>
                      {can('locations.write') && (
                        <Button
                          icon={MapPin}
                          variant="gold"
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
                          تعيين الفرع على موقعي الحالي
                        </Button>
                      )}
                      {can('locations.write') && <Button icon={Settings2} onClick={() => edit('branches', b)}>تعديل الموقع</Button>}
                      <a className="asas-btn" href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`} target="_blank" rel="noreferrer">فتح في Google Maps</a>
                    </div>
                  </div>
                </article>
              ))}
              {!rows.length && !busy && <Empty>أضف موقع الشركة الفعلي للبدء.</Empty>}
            </div>
          )}

          {/* SHIFTS TAB */}
          {tab === 'shifts' && (
            <>
              <div className="asas-notice">تغيير سياسة الإغلاق أو الخصم يطبّق على المناوبات الجديدة، مع الاحتفاظ ببيانات المناوبات السابقة.</div>
              <div className="asas-form-grid">
                {rows.map(s => (
                  <article className="asas-card" key={s.id}>
                    <div className="asas-card-head">
                      <h2>{s.name}</h2>
                      <Clock3 size={18} />
                    </div>
                    <div className="asas-card-body">
                      <div className="asas-mini-row"><span>وقت الدوام</span><strong dir="ltr">{s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}</strong></div>
                      <div className="asas-mini-row"><span>نهاية الدوام</span><strong>{s.close_policy === 'scheduled' ? 'إغلاق تلقائي' : 'انتظار الخروج الفعلي'}</strong></div>
                      <div className="asas-mini-row"><span>خصم مدد المغادرة</span><strong>{s.deduct_away ? 'مفعّل' : 'غير مفعّل'}</strong></div>
                      {can('shifts.write') && <Button onClick={() => edit('shifts', s)}>تعديل السياسة</Button>}
                    </div>
                  </article>
                ))}
                {!rows.length && !busy && <Empty>أضف جدول الدوام وحدد سياسة الاحتساب.</Empty>}
              </div>
            </>
          )}

          {/* QR CODES TAB */}
          {tab === 'qr' && (
            <div className="asas-card">
              <div className="asas-card-head">
                <h2>رموز الحضور والانصراف المعتمدة</h2>
                <span className="asas-badge">رمز دائم ومستمر · توقيت صنعاء (اليمن)</span>
              </div>
              <div className="asas-card-body">
                <div className="asas-search">
                  <select className="asas-input" aria-label="الفرع" value={branchId} onChange={e => setBranchId(e.target.value)}>
                    <option value="">اختر الفرع لعرض الرموز</option>
                    {branches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <Button variant="primary" onClick={showQr} disabled={!branchId || busy}>عرض الرموز المعتمدة</Button>
                </div>
                {qr ? (
                  <div className="asas-qr-poster">
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
                      const enterHtml = fixUrl(qr.enter?.html_url || `/enter.html?branch=${branchId}`);
                      const exitHtml = fixUrl(qr.exit?.html_url || `/exit.html?branch=${branchId}`);
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <Brand />
                              <h2 style={{ fontSize: 22, marginTop: 8 }}>{qr.branch}</h2>
                              <p className="asas-muted">رموز QR الدائمة المشفرة بـ HMAC-SHA256 · صالحة ومستمرة حتى الإبطال الإداري</p>
                            </div>
                            <div className="asas-actions">
                              <Button icon={Printer} onClick={() => window.print()}>طباعة الملصق (A4)</Button>
                              <a className="asas-btn primary" href={enterUrl} target="_blank" rel="noreferrer"><LogIn size={15} />صفحة الحضور (دخول)</a>
                              <a className="asas-btn" href={exitUrl} target="_blank" rel="noreferrer"><LogOut size={15} />صفحة الانصراف (خروج)</a>
                              <Button variant="danger" onClick={async () => {
                                const reason = window.prompt('سبب إبطال الرموز وتجديدها:');
                                if (!reason) return;
                                try {
                                  await api(`/admin/branches/${branchId}/qr/revoke`, 'POST', { reason });
                                  setQr(null);
                                  setNotice('تم إبطال الرموز وإصدار مراجعة جديدة. اضغط عرض الرموز لإصدار البديل فوراً.');
                                } catch (e) { setError(e.message); }
                              }}>إبطال وتجديد الرموز</Button>
                            </div>
                          </div>

                          <div className="asas-qr-grid">
                            <div className="asas-qr-card enter">
                              <div className="asas-qr-badge">كود تسجيل الحضور (الدخول والعودة)</div>
                              <div className="asas-qr-card-title"><LogIn size={20} />تسجيل الدخول (الحضور)</div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>رمز معتمد دائم يُعلق عند المدخل · يُمسح بكاميرا الجوال عند الحضور صباحاً أو العودة</p>
                              <div className="asas-qr-box">
                                <QRCodeSVG value={enterUrl} size={210} level="M" includeMargin />
                              </div>
                              <span className="asas-badge inside" style={{ marginTop: 6 }}>رمز دخول دائم ومستمر</span>
                              <div className="asas-actions" style={{ justifyContent: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                                <a className="asas-btn primary" href={enterUrl} target="_blank" rel="noreferrer"><LogIn size={14} />فتح صفحة الدخول</a>
                                <Button type="button" onClick={() => { navigator.clipboard?.writeText(enterUrl); setNotice('تم نسخ رابط صفحة كود الدخول'); }}>نسخ الرابط</Button>
                              </div>
                            </div>

                            <div className="asas-qr-card exit">
                              <div className="asas-qr-badge">كود تسجيل الخروج (الانصراف النهائي)</div>
                              <div className="asas-qr-card-title"><LogOut size={20} />تسجيل الخروج (الانصراف)</div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>رمز معتمد دائم يُعلق عند المخرج · يُمسح بكاميرا الجوال عند إنهاء الدوام أو المغادرة</p>
                              <div className="asas-qr-box">
                                <QRCodeSVG value={exitUrl} size={210} level="M" includeMargin />
                              </div>
                              <span className="asas-badge outside" style={{ marginTop: 6 }}>رمز خروج دائم ومستمر</span>
                              <div className="asas-actions" style={{ justifyContent: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                                <a className="asas-btn" href={exitUrl} target="_blank" rel="noreferrer"><LogOut size={14} />فتح صفحة الخروج</a>
                                <Button type="button" onClick={() => { navigator.clipboard?.writeText(exitUrl); setNotice('تم نسخ رابط صفحة كود الخروج'); }}>نسخ الرابط</Button>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <Empty>اختر الموقع واضغط على "عرض الرموز المعتمدة" لعرض كود الحضور وكود الانصراف.</Empty>
                )}
              </div>
            </div>
          )}

          {/* LEAVE REQUESTS TAB */}
          {tab === 'leave' && (
            <div className="asas-card asas-table-wrap">
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
                      <td>{l.name}</td>
                      <td>{date(l.from_date)} — {date(l.to_date)}</td>
                      <td style={{ whiteSpace: 'normal' }}>{l.reason}</td>
                      <td><Badge state={l.status} /></td>
                      <td>
                        {l.status === 'pending' && can('leave.review') && (
                          <div className="asas-actions">
                            {[['approved', 'قبول'], ['rejected', 'رفض']].map(([status, label]) => (
                              <Button key={status} onClick={async () => {
                                const comment = window.prompt('ملاحظة المراجعة:');
                                if (!comment) return;
                                try {
                                  await api(`/leave/${l.id}`, 'PATCH', { status, comment });
                                  await load();
                                } catch (e) { setError(e.message); }
                              }}>{label}</Button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && !busy && <Empty>لا توجد طلبات إجازة جديدة.</Empty>}
            </div>
          )}

          {/* AUDIT LOG TAB */}
          {tab === 'audit' && (
            <div className="asas-card asas-table-wrap">
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
                      <td>{a.actor || 'النظام'}</td>
                      <td dir="ltr"><code>{a.action}</code></td>
                      <td>{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && !busy && <Empty />}
            </div>
          )}

          {/* SYSTEM SETTINGS TAB */}
          {tab === 'settings' && (
            <form onSubmit={saveSystemSettings} className="asas-form-grid">
              <article className="asas-card" style={{ gridColumn: '1 / -1' }}>
                <div className="asas-card-head">
                  <h2>إعدادات النظام وسياسات التشغيل الحقيقية</h2>
                  <Settings2 size={18} />
                </div>
                <div className="asas-card-body asas-form">
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

                  <label className="asas-check" style={{ marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(systemSettings.email_notifications)}
                      onChange={e => setSystemSettings({ ...systemSettings, email_notifications: e.target.checked })}
                    />
                    تفعيل إشعارات البريد الإلكتروني للمدراء عند تسجيل الحضور والغياب
                  </label>

                  <div className="asas-actions" style={{ marginTop: 18 }}>
                    <Button variant="primary" type="submit" disabled={busy}>
                      <Save size={16} />
                      {busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات في قاعدة البيانات'}
                    </Button>
                  </div>
                </div>
              </article>

              <article className="asas-card">
                <div className="asas-card-head"><h2>أمان البيانات والتشفير</h2><ShieldCheck size={18} /></div>
                <div className="asas-card-body">
                  <div className="asas-mini-row"><span>تشفير كلمات المرور</span><strong>scrypt KDF مع Salt فريد</strong></div>
                  <div className="asas-mini-row"><span>توقيع رموز QR</span><strong>HMAC-SHA256 مع مفتاح سري</strong></div>
                  <div className="asas-mini-row"><span>جلسات العمل</span><strong>رموز Bearer مشفرة بـ SHA-256</strong></div>
                </div>
              </article>

              <article className="asas-card">
                <div className="asas-card-head"><h2>الهوية البصرية لأساس</h2><Brand /></div>
                <div className="asas-card-body">
                  <div className="asas-mini-row"><span>الفحمي الأساسي (Ink)</span><code dir="ltr">#231F20</code></div>
                  <div className="asas-mini-row"><span>الذهبي (Gold)</span><code dir="ltr">#BA9555</code></div>
                  <div className="asas-mini-row"><span>الخطوط المعتمدة</span><strong>Thmanyah Sans / Serif</strong></div>
                </div>
              </article>
            </form>
          )}
        </main>
      </div>

      {/* MODALS */}
      {showAnnouncementsModal && (
        <AnnouncementsModal
          announcements={announcements}
          onClose={() => setShowAnnouncementsModal(false)}
          onRefresh={loadAnnouncements}
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
            <div className="asas-card-head">
              <h2>
                {modal === 'announcements' ? 'نشر تعميم رسمي جديد' : (form.id ? 'تعديل' : 'إضافة')} {
                  modal === 'branches' ? 'موقع الشركة'
                    : modal === 'shifts' ? 'الدوام وسياسة الاحتساب'
                    : modal === 'records' ? 'سجل الحضور'
                    : modal === 'accounts' ? 'حساب موظف' : ''
                }
              </h2>
              <Button icon={X} onClick={() => setModal(null)} aria-label="إغلاق" />
            </div>

            <form className="asas-form" onSubmit={save}>
              {error && <div className="asas-notice error" role="alert">{error}</div>}

              {/* ANNOUNCEMENT FORM */}
              {modal === 'announcements' && (
                <>
                  <Field
                    label="عنوان التعميم"
                    required
                    placeholder="مثال: تعميم بخصوص مواعيد العمل في شهر رمضان المبارك"
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

              {/* RECORDS FORM */}
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

              {/* BRANCHES FORM */}
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
                  <div className="asas-actions" style={{ marginTop: 10 }}>
                    <Button
                      type="button"
                      icon={MapPin}
                      onClick={() => navigator.geolocation?.getCurrentPosition(p => {
                        set('latitude', p.coords.latitude);
                        set('longitude', p.coords.longitude);
                      }, () => setError('تعذر الحصول على الموقع؛ أدخل الإحداثيات من الخريطة.'), { enableHighAccuracy: true, timeout: 15000 })}
                    >
                      استخدام موقع هذا الجهاز
                    </Button>
                  </div>
                  <label className="asas-check" style={{ marginTop: 8 }}><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />الموقع مفعل</label>
                </>
              )}

              {/* SHIFTS FORM */}
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
                  <div className="asas-days">
                    {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d, i) => (
                      <label className="asas-check" key={d}>
                        <input type="checkbox" checked={form.work_days.includes(i)} onChange={e => set('work_days', e.target.checked ? [...form.work_days, i] : form.work_days.filter(n => n !== i))} />
                        {d}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {/* ACCOUNTS FORM */}
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

                  {user.role === 'super_admin' && form.role !== 'employee' && (
                    <div className="asas-form-grid">
                      {Object.entries(permissions).map(([key, label]) => (
                        <label className="asas-check" key={key}>
                          <input type="checkbox" checked={form.permissions?.includes(key) || false} onChange={e => set('permissions', e.target.checked ? [...form.permissions, key] : form.permissions.filter(p => p !== key))} />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}

                  {form.id && <label className="asas-check"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />حساب نشط</label>}
                </>
              )}

              {(form.id || modal === 'branches' || modal === 'records') && (
                <Field label="سبب التغيير (يوثق في سجل العمليات)" required value={form.reason || ''} onChange={e => set('reason', e.target.value)} />
              )}

              <div className="asas-modal-footer">
                <Button type="button" onClick={() => setModal(null)}>إلغاء</Button>
                <Button variant="primary" type="submit" disabled={busy}>
                  {modal === 'announcements' ? 'نشر التعميم' : 'حفظ التغييرات'}
                </Button>
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
      return Boolean(localStorage.getItem('asas_remember_me') === 'true');
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
          <h1>حضور مؤكد.<br /><span>وفريق متصل دائماً.</span></h1>
          <p>مساحة عمل تنفيذية لإدارة الحضور والانصراف بدقة وموثوقية عالية، متصلة بسجلات الأجهزة وقواعد البيانات السيادية.</p>
        </div>
        <footer>
          <span>شركة أساس الذكاء الاصطناعي</span>
          <p>نظام حضور ذكي ومحمي</p>
        </footer>
      </section>

      <section className="asas-login-form">
        <div className="asas-login-box">
          <p className="asas-eyebrow">بوابة الدخول الموحدة</p>
          <h2>تسجيل الدخول إلى أساس</h2>
          <p className="asas-muted">أدخل بياناتك المعتمدة للوصول إلى لوحة التحكم أو مساحة الموظف.</p>

          <form onSubmit={submit} className="asas-form">
            {error && (
              <div className="asas-notice error" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>{error}</div>
                {onRetry && (
                  <button type="button" onClick={async () => { setBusy(true); await onRetry(); setBusy(false); }} disabled={busy} style={{ alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 6, border: '1px solid #d9480f', background: '#fff', color: '#d9480f', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    🔄 {busy ? 'جارٍ الفحص…' : 'إعادة فحص الاتصال'}
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

            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
              <ArrowUpLeft size={16} />
            </Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#d2c5ac' }} />
              <span style={{ fontSize: 12, color: '#736d65' }}>أو تسجيل الدخول السريع عبر Google</span>
              <div style={{ flex: 1, height: 1, background: '#d2c5ac' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: 44 }}>
              <div id="google-btn-container" style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />
            </div>
          </form>

          <div style={{ marginTop: 18, padding: 12, background: '#fbf7ee', borderRadius: 10, fontSize: 11.5, color: '#775b24', display: 'flex', gap: 8, alignItems: 'flex-start', border: '1px solid #ebdcc0' }}>
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
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

  const load = useCallback(() => api('/attendance/me').then(setData).catch(e => setError(e.message)), []);

  useEffect(() => {
    load();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setToken(hash.get('qr') || '');
    window.history.replaceState(null, '', window.location.pathname);

    const poll = setInterval(load, 8000);
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
    <div className="asas-app">
      <main className="asas-employee">
        <div className="asas-heading">
          <Brand />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="asas-bell-btn" onClick={onOpenAnnouncements} aria-label="الإشعارات">
              <Bell size={18} />
              {announcements.length > 0 && <span className="asas-bell-badge">{announcements.length}</span>}
            </button>
            <Button onClick={logout} icon={LogOut}>خروج</Button>
          </div>
        </div>

        {/* Profile Card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, background: '#fff', border: '1px solid var(--line)', padding: 18, borderRadius: 16, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <UserAvatar user={user} size="lg" onClick={onOpenProfile} />
            <div>
              <h1 style={{ fontSize: 20, margin: '0 0 4px', color: 'var(--ink)' }}>{user.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: '#231f20', color: '#b59045', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: 12.5, fontFamily: 'monospace' }}>
                  الرقم الوظيفي: {user.identifier}
                </span>
                <span className="asas-badge outside" style={{ fontSize: 11 }}>موظف</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user.email || '—'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button icon={UserCircle} onClick={onOpenProfile}>
              الملف الشخصي والأمان
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#231f20', color: '#efe9d8', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              <Clock3 size={14} style={{ color: '#b59045' }} />
              <span>صنعاء: <strong style={{ color: '#b59045' }}>{liveTime || '—'}</strong></span>
            </div>
          </div>
        </div>

        {error && (
          <div className="asas-notice error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
            <span>{error}</span>
            <Button type="button" icon={RefreshCw} onClick={load} disabled={busy} style={{ padding: '4px 10px', fontSize: 12 }}>إعادة المحاولة</Button>
          </div>
        )}
        {message && <div className="asas-notice" style={{ marginTop: 14 }}>{message}</div>}

        {/* Live Attendance & Exit Time Summary Card */}
        <section className="asas-card" style={{ marginTop: 20, borderColor: '#ba9555' }}>
          <div className="asas-card-head">
            <h2>حالة وسجل حضور اليوم</h2>
            {todayRecord && <Badge state={todayRecord.state} />}
          </div>
          <div className="asas-card-body">
            {/* Automatic Status Banner */}
            <div style={{ background: isInside ? '#edf7ed' : '#faf6ee', border: `1px solid ${isInside ? '#bfe5bf' : '#ebdcc0'}`, padding: '12px 16px', borderRadius: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontSize: 12, color: '#736d65', display: 'block' }}>حالتك الحالية حسب النظام:</span>
                <strong style={{ fontSize: 15, color: isInside ? '#1e7e34' : '#775b24', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isInside ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {data?.automatic_status?.status_label || (isInside ? 'داخل موقع العمل (حضور مفتوح)' : (todayRecord?.last_out ? 'تم تسجيل الانصراف وإنهاء الدوام' : 'خارج موقع العمل (جاهز لتسجيل الحضور)'))}
                </strong>
              </div>
              <span className="asas-badge" style={{ background: isInside ? '#c3e6cb' : '#ffeeba', color: isInside ? '#155724' : '#856404', fontWeight: 700 }}>
                الإجراء التلقائي: {isInside ? 'تسجيل الانصراف' : 'تسجيل الحضور'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 14 }}>
              <div style={{ background: '#fcfbf7', border: '1px solid #d2c5ac', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#736d65', marginBottom: 4 }}>وقت أول دخول (حضور)</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#231f20' }}>{todayRecord?.first_in ? time(todayRecord.first_in) : '—'}</div>
                <small style={{ color: '#736d65', fontSize: 11 }}>{todayRecord?.first_in ? (todayRecord.status_label || 'سُجل بنجاح') : 'لم يسجل بعد'}</small>
              </div>
              <div style={{ background: '#fcfbf7', border: '1px solid #d2c5ac', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#736d65', marginBottom: 4 }}>وقت آخر خروج (انصراف)</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#231f20' }}>{todayRecord?.last_out ? time(todayRecord.last_out) : '—'}</div>
                <small style={{ color: '#736d65', fontSize: 11 }}>{todayRecord?.last_out ? 'سُجل بنجاح' : (isInside ? 'قيد الدوام' : 'لم يسجل بعد')}</small>
              </div>
              <div style={{ background: '#fcfbf7', border: '1px solid #d2c5ac', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#736d65', marginBottom: 4 }}>سبب الخروج التلقائي</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: todayRecord?.exit_reason_label?.includes('مبكر') ? '#c92a2a' : '#775b24', marginTop: 3 }}>
                  {todayRecord?.exit_reason_label || data?.automatic_status?.exit_reason_label || (isInside ? 'قيد الدوام' : '—')}
                </div>
                <small style={{ color: '#736d65', fontSize: 11 }}>حسب توقيت الدوام</small>
              </div>
              <div style={{ background: '#fcfbf7', border: '1px solid #d2c5ac', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#736d65', marginBottom: 4 }}>التوقيت اللحظي الآن</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#ba9555' }}>{liveTime || '—'}</div>
                <small style={{ color: '#736d65', fontSize: 11 }}>توقيت صنعاء (اليمن)</small>
              </div>
            </div>

            {/* Camera QR Scanner Modal */}
            {cameraModal && (
              <div className="asas-modal-backdrop" onClick={stopCamera}>
                <section className="asas-modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <div className="asas-card-head">
                    <h2>📷 مسح كود الفرع</h2>
                    <Button icon={X} onClick={stopCamera} />
                  </div>
                  <div style={{ padding: 16 }}>
                    <p className="asas-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
                      وجّه كاميرا الهاتف نحو كود QR المعلق في مقر الفرع للتحضير الفوري:
                    </p>
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 240 }}>
                      <video ref={videoRef} playsInline autoPlay style={{ width: '100%', height: 240, objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 180, height: 180, border: '2px dashed #ba9555', borderRadius: 12, pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div className="asas-modal-footer">
                    <Button type="button" onClick={stopCamera}>إلغاء</Button>
                  </div>
                </section>
              </div>
            )}

            {/* Primary Smart Auto-Button */}
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => act('auto')}
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 12,
                background: isInside ? '#842029' : '#198754',
                borderColor: isInside ? '#701a22' : '#146c43',
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10
              }}
            >
              {isInside ? <LogOut size={18} /> : <LogIn size={18} />}
              {isInside
                ? `⚡ تسجيل الانصراف التلقائي الآن ${liveTime ? `(${liveTime})` : ''}`
                : `⚡ تسجيل الحضور التلقائي الآن ${liveTime ? `(${liveTime})` : ''}`}
            </Button>

            <div style={{ marginBottom: 12 }}>
              <Button
                type="button"
                icon={Camera}
                onClick={startCamera}
                disabled={busy}
                style={{ width: '100%', padding: '12px', fontSize: 13.5, fontWeight: 600, background: '#fff', border: '1px solid #d2c5ac', color: '#231f20', display: 'flex', justifyContent: 'center', gap: 8 }}
              >
                📷 مسح كود الفرع بكاميرا الجوال مباشرة
              </Button>
            </div>

            <div className="asas-actions" style={{ justifyContent: 'center', gap: 8 }}>
              <Button disabled={busy} onClick={() => act('enter')} style={{ fontSize: 12 }}>
                <LogIn size={13} />
                دخول يدوي
              </Button>
              <Button disabled={busy} onClick={() => act('exit')} style={{ fontSize: 12 }}>
                <LogOut size={13} />
                انصراف يدوي
              </Button>
            </div>
          </div>
        </section>

        <section className="asas-card" style={{ marginTop: 20 }}>
          <div className="asas-card-head"><h2>طلب إجازة</h2></div>
          <form className="asas-card-body asas-form" onSubmit={async e => {
            e.preventDefault();
            setBusy(true);
            try {
              await api('/leave', 'POST', leave);
              setMessage('تم إرسال طلب الإجازة للمراجعة بنجاح');
              setLeave({ ...leave, reason: '' });
            } catch (e) { setError(e.message); } finally { setBusy(false); }
          }}>
            <div className="asas-form-grid">
              <Field label="من تاريخ" type="date" required value={leave.from_date} onChange={e => setLeave({ ...leave, from_date: e.target.value })} />
              <Field label="إلى تاريخ" type="date" required value={leave.to_date} onChange={e => setLeave({ ...leave, to_date: e.target.value })} />
            </div>
            <Field label="السبب" required value={leave.reason} onChange={e => setLeave({ ...leave, reason: e.target.value })} />
            <Button type="submit" disabled={busy}>إرسال الطلب</Button>
          </form>
        </section>

        <section className="asas-card" style={{ marginTop: 20 }}>
          <div className="asas-card-head"><h2>سجل حضوري الأخير</h2></div>
          <Records rows={(data?.records || []).map(r => ({ ...r, name: user.name, identifier: user.identifier }))} />
        </section>
      </main>
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
