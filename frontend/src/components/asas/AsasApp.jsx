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

// Avatar Presets: Man or Woman only
const AVATAR_PRESETS = [
  { id: 'man', name: 'موظف (رجل)', bg: 'linear-gradient(135deg, #1d3557, #457b9d)', icon: '👨‍💼' },
  { id: 'woman', name: 'موظفة (امرأة)', bg: 'linear-gradient(135deg, #ba9555, #8c6928)', icon: '👩‍💼' }
];

function UserAvatar({ user, size = 'md', onClick }) {
  const avatarKey = user?.avatar || 'man';
  const preset = AVATAR_PRESETS.find(p => p.id === avatarKey);
  const isImage = avatarKey && (avatarKey.startsWith('http') || avatarKey.startsWith('/') || avatarKey.startsWith('data:image/'));
  const letter = (user?.name || user?.identifier || 'م')[0] || 'م';

  return (
    <div
      className={`asas-avatar ${size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : ''}`}
      style={{
        background: isImage ? '#1a1818' : (preset ? preset.bg : 'linear-gradient(135deg, #1d3557, #457b9d)'),
        cursor: onClick ? 'pointer' : 'default',
        padding: 0
      }}
      onClick={onClick}
      title={user?.name || ''}
    >
      {isImage ? (
        <img src={avatarKey} alt={user?.name || 'صورة الموظف'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : preset ? (
        <span style={{ fontSize: size === 'lg' ? 36 : size === 'sm' ? 16 : 22, lineHeight: 1 }}>{preset.icon}</span>
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
        <small>نظام الحضور والدوام السيادي</small>
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

  const appUrl = 'https://ai-asaas-attendance.vercel.app/asas';

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

// Profile & Security Modal
function ProfileModal({ user, onClose, onUpdated }) {
  const isImageAvatar = user?.avatar && (user.avatar.startsWith('data:image/') || user.avatar.startsWith('http') || user.avatar.startsWith('/'));
  const [avatar, setAvatar] = useState(isImageAvatar ? '' : (user?.avatar || 'man'));
  const [customImage, setCustomImage] = useState(isImageAvatar ? user.avatar : '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        const maxDim = 384;
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
      if (!/^\d{8}$/.test(newPassword)) {
        setBusy(false);
        return setErr('كلمة المرور يجب أن تتكون من 8 أرقام تماماً (مثال: 12345678)');
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
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                display: 'grid',
                placeItems: 'center',
                background: customImage ? undefined : (AVATAR_PRESETS.find(p => p.id === avatar)?.bg || 'linear-gradient(135deg, #1d3557, #457b9d)'),
                flexShrink: 0
              }}>
                {customImage ? (
                  <img src={customImage} alt="معاينة الصورة" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 34 }}>{AVATAR_PRESETS.find(p => p.id === avatar)?.icon || '👨‍💼'}</span>
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
                    <span style={{ fontSize: 24 }}>{p.icon}</span>
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
              إعداد وتغيير كلمة المرور (8 أرقام)
            </div>
            <p className="asas-muted" style={{ fontSize: 11.5, marginBottom: 10 }}>
              يجب أن تتكون كلمة المرور من 8 أرقام تماماً (مثال: 12345678). اتركها فارغة إذا لم ترغب بالتغيير.
            </p>
            <Field
              label="كلمة المرور الحالية (اختياري عند الإعداد الأولي / مطلوب لتغيير كلمة قائمة)"
              type="password"
              autoComplete="current-password"
              placeholder="أدخل كلمة المرور الحالية إن وُجدت"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
            <div className="asas-form-grid" style={{ marginTop: 10 }}>
              <Field
                label="كلمة المرور الجديدة (8 أرقام)"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                placeholder="مثال: 12345678"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
              />
              <Field
                label="تأكيد كلمة المرور (8 أرقام)"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                placeholder="أعد إدخال الـ 8 أرقام"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
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

function AsasAppInner({ defaultAction = 'auto' }) {
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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
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
        <Login
          onLogin={setUser}
          initialError={error}
          onRetry={() => checkAuth(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
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
          onOpenInstall={() => setShowInstallModal(true)}
          installPrompt={installPrompt}
          defaultAction={defaultAction}
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
        {showInstallModal && (
          <InstallAppModal
            onClose={() => setShowInstallModal(false)}
            installPrompt={installPrompt}
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
            <button className="asas-btn sm asas-menu-btn" style={{ padding: '0 8px' }} onClick={() => setOpen(!open)} aria-label="القائمة">
              <Icon name="grid" />
            </button>
            <span><span className="asas-topbar-breadcrumb">لوحة القيادة / </span><strong><Swash>{title}</Swash></strong></span>
          </div>

          <div className="asas-topbar-controls">
            <div className="asas-clock-pill">
              <Icon name="clock" style={{ width: 15, height: 15, color: 'var(--accent)' }} />
              <span><span className="asas-clock-label">صنعاء: </span><strong>{liveTime || '—'}</strong></span>
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
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                    <button className="asas-btn primary" onClick={() => setTab('qr')}>
                      <Icon name="qrCode" />
                      عرض الرموز المعتمدة
                    </button>
                    <button
                      className="asas-btn"
                      onClick={() => {
                        if (installPrompt) installPrompt.prompt();
                        else setShowInstallModal(true);
                      }}
                      style={{ background: 'var(--glass-tint)', borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }}
                    >
                      <Icon name="download" />
                      تحميل التطبيق على الجوال
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="asas-mark" />
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

              <div className="asas-grid-halves">
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="asas-tile-icon">
                        <Icon name="clock" width={14} height={14} />
                      </div>
                      <div>
                        <p className="asas-eyebrow" style={{ fontSize: 11, marginBottom: 2 }}>سياسة واحتساب الدوام</p>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{s.name}</h2>
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
                  {can('shifts.write') && (
                    <button className="asas-btn sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={() => edit('shifts', s)}>
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
                        if (!u) return 'https://ai-asaas-attendance.vercel.app/asas';
                        try {
                          const p = new URL(u, 'https://ai-asaas-attendance.vercel.app');
                          return `https://ai-asaas-attendance.vercel.app/asas${p.search}${p.hash}`;
                        } catch (e) {
                          return 'https://ai-asaas-attendance.vercel.app/asas';
                        }
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
                              <span className="asas-badge inside" style={{ marginBottom: 8, fontSize: 12 }}>كود الحضور (دخول فقط)</span>
                              <div className="asas-qr-box">
                                <QRCodeSVG value={enterUrl} size={210} level="M" includeMargin />
                              </div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>يُعلق عند المدخل · مخصص حصرياً لتسجيل الدخول والعودة (لا يقبل الخروج)</p>
                              <a className="asas-btn primary sm" href={enterUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
                                <Icon name="logIn" />
                                فتح صفحة الدخول
                              </a>
                            </div>

                            <div className="asas-qr-card">
                              <span className="asas-badge urgent" style={{ marginBottom: 8, fontSize: 12 }}>كود الانصراف (خروج فقط)</span>
                              <div className="asas-qr-box">
                                <QRCodeSVG value={exitUrl} size={210} level="M" includeMargin />
                              </div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>يُعلق عند المخرج · مخصص حصرياً لتسجيل الانصراف والخروج (لا يقبل الدخول)</p>
                              <a className="asas-btn sm" href={exitUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8, borderColor: 'var(--unpaid)', color: 'var(--unpaid)' }}>
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

      {showInstallModal && (
        <InstallAppModal
          onClose={() => setShowInstallModal(false)}
          installPrompt={installPrompt}
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
function Login({ onLogin, initialError, onRetry, theme, onToggleTheme }) {
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
    function renderGsiButton() {
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
          const parentWidth = el.parentElement?.offsetWidth || el.offsetWidth || (window.innerWidth ? window.innerWidth - 64 : 280);
          const computedWidth = Math.min(320, Math.max(200, Math.floor(parentWidth)));
          window.google.accounts.id.renderButton(el, {
            theme: theme === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: computedWidth,
            locale: 'ar'
          });
        }
      } catch (err) {
        console.warn('GSI render error:', err);
      }
    }

    if (window.google?.accounts?.id) {
      renderGsiButton();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          renderGsiButton();
        }
      }, 300);
      return () => clearInterval(timer);
    }

    const onResize = () => renderGsiButton();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [handleGoogleCredentialResponse, theme]);

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
      {onToggleTheme && (
        <button
          className="asas-theme-btn asas-login-theme-btn"
          onClick={onToggleTheme}
          aria-label="تبديل مظهر النظام"
          style={{ position: 'fixed', top: 18, left: 18, zIndex: 30 }}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      )}
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
          <div className="asas-login-mobile-brand">
            <Brand />
          </div>
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

function Employee({ user, logout, announcements, onOpenAnnouncements, onOpenProfile, onOpenInstall, installPrompt, defaultAction = 'auto' }) {
  const [empPage, setEmpPage] = useState('duty');
  const [data, setData] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
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
        load();
      }
    }, 15000);
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
    try {
      let currentToken = customToken || token;
      if (!currentToken) {
        try {
          const qrData = await api(`/attendance/active-qr?action=${action === 'auto' ? '' : action}`);
          if (qrData?.token) currentToken = qrData.token;
        } catch (err) {}
      }
      if (!currentToken) throw new Error('يرجى مسح رمز QR الخاص بالفرع لتأكيد التواجد');

      // Pre-validation to reject crossed actions immediately on client
      const qrMeta = decodeQrToken(currentToken);
      if (qrMeta?.action) {
        if (action === 'enter' && qrMeta.action === 'exit') {
          throw new Error('عفواً، رمز QR هذا مخصص لتسجيل الانصراف والخروج فقط، ولا يمكن استخدامه لتسجيل الدخول.');
        }
        if (action === 'exit' && qrMeta.action === 'enter') {
          throw new Error('عفواً، رمز QR هذا مخصص لتسجيل الدخول فقط، ولا يمكن استخدامه لتسجيل الانصراف والخروج.');
        }
      }

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

  // Live Geofence Auto-Exit Monitor while on duty
  const [geofenceStatus, setGeofenceStatus] = useState({ state: 'idle', distance: null, accuracy: null });

  useEffect(() => {
    if (!isInside) {
      setGeofenceStatus({ state: 'idle', distance: null, accuracy: null });
      return;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) return;

    let isCancelled = false;

    async function sendLocationFix(coords, timestamp) {
      if (isCancelled) return;
      try {
        const fix = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Math.round(coords.accuracy),
          captured_at: new Date(timestamp || Date.now()).toISOString()
        };
        const reqId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : ('loc-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

        const res = await api('/attendance/action', 'POST', {
          action: 'location',
          fix,
          device_id: getDeviceId(),
          request_id: reqId
        });

        if (isCancelled) return;

        if (res) {
          if (res.action === 'exit' || res.automatic || res.record?.state === 'outside') {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
            setMessage(res.message || '⚠️ تم رصد مغادرتك للنطاق بنجاح وتسجيل خروجك تلقائياً.');
            load();
            return;
          }
          setGeofenceStatus({
            state: res.record?.gps_state || res.state || 'inside',
            distance: res.distance != null ? res.distance : null,
            accuracy: Math.round(coords.accuracy),
            pending: res.pending_exit || 0
          });
        }
      } catch (err) {}
    }

    // 1. Initial check immediately upon entry
    navigator.geolocation.getCurrentPosition(
      pos => sendLocationFix(pos.coords, pos.timestamp),
      () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    // 2. Real-time watchPosition for movement
    const watchId = navigator.geolocation.watchPosition(
      pos => sendLocationFix(pos.coords, pos.timestamp),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    // 3. Continuous 20-second heartbeat
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        navigator.geolocation.getCurrentPosition(
          pos => sendLocationFix(pos.coords, pos.timestamp),
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }, 20000);

    return () => {
      isCancelled = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [isInside, load]);

  return (
    <div className="asas-employee-page">
      {/* Top Header */}
      <Glass className="asas-employee-header" style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      <Glass className="asas-employee-profile" style={{ padding: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
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
            <span><span className="asas-clock-label">صنعاء: </span><strong>{liveTime || '—'}</strong></span>
          </div>
        </div>
      </Glass>

      {/* Employee Subpage Navigation Tabs (Responsive Segmented Control) */}
      <div className="asas-employee-nav-wrap">
        <nav className="asas-employee-tabs" role="tablist" aria-label="أقسام بوابة الموظف">
          <button
            type="button"
            role="tab"
            aria-selected={empPage === 'duty'}
            className={`asas-employee-tab ${empPage === 'duty' ? 'active' : ''}`}
            onClick={() => setEmpPage('duty')}
          >
            <Icon name="clock" />
            <span className="asas-tab-text-full">حالة وتسجيل الحضور</span>
            <span className="asas-tab-text-short">تسجيل الحضور</span>
            {isInside && (
              <>
                <span className="asas-tab-duty-dot" title="على رأس العمل" />
                <span className="asas-tab-badge inside desktop-only">على رأس العمل</span>
              </>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={empPage === 'leave'}
            className={`asas-employee-tab ${empPage === 'leave' ? 'active' : ''}`}
            onClick={() => { setEmpPage('leave'); loadLeaves(); }}
          >
            <Icon name="receipt" />
            <span className="asas-tab-text-full">تقديم طلب إجازة</span>
            <span className="asas-tab-text-short">طلب إجازة</span>
            {leaves.filter(l => l.status === 'pending').length > 0 && (
              <span className="asas-tab-badge urgent">
                {leaves.filter(l => l.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={empPage === 'history'}
            className={`asas-employee-tab ${empPage === 'history' ? 'active' : ''}`}
            onClick={() => setEmpPage('history')}
          >
            <Icon name="calendar" />
            <span className="asas-tab-text-full">السجل الحظوري</span>
            <span className="asas-tab-text-short">السجل</span>
            {(data?.records || []).length > 0 && (
              <span className="asas-tab-badge">
                {(data?.records || []).length}
              </span>
            )}
          </button>
        </nav>
      </div>

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

      {/* SUBPAGE 1: Attendance & Duty Status */}
      {empPage === 'duty' && (
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

            <div className="asas-employee-stats">
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

            {/* Live Geofence Monitoring Capsule */}
            {isInside && (
              <div
                style={{
                  background: 'var(--glass-inset)',
                  border: '1px solid var(--hairline)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  fontSize: 12.5,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: geofenceStatus.state === 'inside' ? 'var(--paid)' : 'var(--unpaid)',
                      boxShadow: geofenceStatus.state === 'inside' ? '0 0 10px var(--paid)' : '0 0 10px var(--unpaid)',
                      display: 'inline-block'
                    }}
                  />
                  <strong style={{ color: 'var(--text)' }}>مراقبة النطاق الجغرافي (الخروج التلقائي):</strong>
                  <span style={{ color: geofenceStatus.state === 'inside' ? 'var(--paid)' : 'var(--unpaid)', fontWeight: 700 }}>
                    {geofenceStatus.state === 'inside' ? 'متواجد داخل مقر العمل' : 'قيد فحص وتأكيد المغادرة'}
                  </span>
                </div>
                <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>
                  {geofenceStatus.distance != null ? `المسافة الحالية: ${geofenceStatus.distance} م` : 'جهاز الفحص الجغرافي نشط'}
                </span>
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
                      <Icon name={isEnter ? 'logIn' : isExit ? 'pause' : 'qrCode'} style={{ width: 13, height: 13 }} />
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

            {/* Smart Button */}
            {(() => {
              const meta = decodeQrToken(token);
              const isEnterQr = meta?.action === 'enter';
              const isExitQr = meta?.action === 'exit';
              const targetAction = isEnterQr ? 'enter' : (isExitQr ? 'exit' : (isInside ? 'exit' : 'enter'));
              const btnColor = targetAction === 'exit' ? 'danger' : 'primary';
              const btnIcon = targetAction === 'exit' ? 'pause' : 'logIn';
              const btnLabel = isEnterQr
                ? 'تسجيل الحضور الآن (بكود الدخول)'
                : (isExitQr
                  ? 'تسجيل الانصراف الآن (بكود الخروج)'
                  : (isInside ? 'تسجيل الانصراف التلقائي الآن' : 'تسجيل الحضور التلقائي الآن'));

              return (
                <button
                  className={`asas-btn ${btnColor}`}
                  disabled={busy}
                  onClick={() => act(targetAction)}
                  style={{ width: '100%', height: 52, fontSize: 16, marginBottom: 10 }}
                >
                  <Icon name={btnIcon} />
                  {btnLabel}
                </button>
              );
            })()}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="asas-btn" onClick={startCamera} style={{ flex: 1, minWidth: 160, justifyContent: 'center' }}>
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
          <Card title="تقديم طلب إجازة أو عذر جديد" icon="receipt">
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
                  setMessage('تم إرسال طلب الإجازة للمراجعة بنجاح');
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

          <Card title="سجل طلبات الإجازة السابقة" icon="calendar">
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
              <div className="asas-table-wrap">
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
            )}
          </Card>
        </>
      )}

      {/* SUBPAGE 3: Attendance History & Records */}
      {empPage === 'history' && (
        <Card title="السجل الحظوري الموثق" icon="calendar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              إجمالي الفترات المسجلة: <strong>{(data?.records || []).length}</strong>
            </span>
            <button className="asas-btn sm" onClick={load} disabled={busy}>
              <Icon name="refresh" />
              تحديث السجل
            </button>
          </div>
          <Records rows={(data?.records || []).map(r => ({ ...r, name: user.name, identifier: user.identifier }))} />
        </Card>
      )}

      {/* Floating Asas AI Assistant Robot for Employee */}
      <AssistantWidget
        user={{ id: String(user.id), displayName: user.name }}
        title="مساعد أساس الذكي"
        subtitle="مساعدك الذكي للاستفسار عن الحضور والدوام والإجازات"
        suggestions={[
          'كيف أسجل حضوري الآن؟',
          'كم باقي على نهاية الدوام؟',
          'كيف أطلب إجازة أو عذر؟',
          'ما هي سياسة التأخير المعتمدة؟'
        ]}
        ask={async (messages) => {
          const last = messages[messages.length - 1]?.content || '';
          if (last.includes('حضور') || last.includes('انصراف')) {
            return { reply: 'لتسجيل حضورك: تأكد من تفعيل خدمة الموقع (GPS) بجوالك، ثم اضغط على زر "تسجيل الحضور الآن" الذهبي، أو امسح رمز الـ QR عند مدخل المقر.' };
          }
          if (last.includes('دوام') || last.includes('وقت') || last.includes('ساعات')) {
            return { reply: 'ساعات العمل الرسمية تبدأ من 08:00 صباحاً وحتى 04:00 عصراً بتوقيت صنعاء، وفترة السماح المعتمدة 15 دقيقة.' };
          }
          if (last.includes('إجازة') || last.includes('عذر') || last.includes('طلب')) {
            return { reply: 'يمكنك تقديم طلب إجازة مباشرة من نموذج "طلب إجازة / عذر" في أسفل هذه الصفحة وسيرسل فوراً للمراجعة الإدارية.' };
          }
          return { reply: 'مرحباً بك يا ' + user.name + '! أنا مساعد أساس الذكي، جاهز للإجابة عن أي استفسار يخص الدوام وسجلات حضورك.' };
        }}
      />
    </div>
  );
}

export default function AsasApp({ defaultAction = 'auto' }) {
  return (
    <ErrorBoundary>
      <AsasAppInner defaultAction={defaultAction} />
    </ErrorBoundary>
  );
}
