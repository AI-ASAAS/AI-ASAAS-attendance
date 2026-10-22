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
  { id: 'woman', name: 'موظفة (امرأة)', bg: 'linear-gradient(135deg, #ba9555, #8c6928)', icon: '👩‍💼' },
  { id: 'admin', name: 'مسؤول نظام', bg: 'linear-gradient(135deg, #2b2d42, #4a4e69)', icon: '🛡️' },
  { id: 'neutral', name: 'رمز محايد', bg: 'linear-gradient(135deg, #102a43, #243b53)', icon: '👤' }
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
  shifts: { name: '', start_time: '08:00', end_time: '16:00', work_days: [0, 1, 2, 3, 4, 6], grace_minutes: 15, close_policy: 'actual_exit', deduct_away: false, reason: '' },
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
                    <Icon name={isInside ? (isLate ? 'alert' : 'checkCircle') : 'logOut'} style={{ width: 13, height: 13 }} />
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
function AnnouncementsModal({ announcements, onClose, canManage, onEdit, onDelete }) {
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 11.5, color: 'var(--text-3)', borderTop: '1px solid var(--hairline)', paddingTop: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span>المرسل: <strong>{a.sender_name || 'الإدارة'}</strong></span> · <time>{date(a.created_at)} · {time(a.created_at)}</time>
                  </div>
                  {canManage && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {onEdit && (
                        <button className="asas-btn sm" onClick={() => onEdit(a)}>
                          <Icon name="edit" />
                          تعديل
                        </button>
                      )}
                      {onDelete && (
                        <button className="asas-btn sm danger" onClick={() => onDelete(a.id)}>
                          <Icon name="trash" />
                          حذف
                        </button>
                      )}
                    </div>
                  )}
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
    if (!u) return 'https://ai-asaas-attendance.vercel.app/asas';
    try {
      const p = new URL(u, 'https://ai-asaas-attendance.vercel.app');
      return `https://ai-asaas-attendance.vercel.app/asas${p.search}${p.hash}`;
    } catch (e) {
      return 'https://ai-asaas-attendance.vercel.app/asas';
    }
  };

  const enterUrl = fixUrl(qr?.enter?.url || qr?.url);
  const exitUrl = fixUrl(qr?.exit?.url || qr?.url);
  const effectiveBranch = qr?.branch || branchName || 'المقر الرئيسي';
  const currentDate = new Intl.DateTimeFormat('ar-YE', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Aden' }).format(new Date());

  return (
    <div className="asas-modal-backdrop asas-print-mode" onClick={onClose}>
      <section className="asas-modal asas-a4-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="asas-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="printer" style={{ width: 22, height: 22, color: 'var(--accent)' }} />
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>معاينة وطباعة ملصق A4 المعتمد</h2>
              <p className="asas-muted" style={{ fontSize: 11.5, margin: 0 }}>مُسطر ومتوافق بدقة مع معايير طباعة الورق الرسمي (A4 Portrait)</p>
            </div>
          </div>
          <button className="asas-btn sm" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" />
          </button>
        </div>

        <div className="asas-print-controls" style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'var(--glass-inset)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>تنسيق الورقة:</span>
            <button
              type="button"
              className={`asas-btn sm ${printMode === 'both' ? 'primary' : ''}`}
              onClick={() => setPrintMode('both')}
            >
              ملصق مزدوج (دخول + خروج)
            </button>
            <button
              type="button"
              className={`asas-btn sm ${printMode === 'enter' ? 'primary' : ''}`}
              onClick={() => setPrintMode('enter')}
            >
              كود الدخول فقط (A4 كامل)
            </button>
            <button
              type="button"
              className={`asas-btn sm ${printMode === 'exit' ? 'primary' : ''}`}
              onClick={() => setPrintMode('exit')}
            >
              كود الخروج فقط (A4 كامل)
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="asas-btn primary" onClick={handlePrint}>
              <Icon name="printer" />
              طباعة الملصق الآن (A4)
            </button>
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
                    <div style={{ textAlign: 'right' }}>
                      <p className="asas-a4-brand-title">مَنظُومَة أَسَاس السِّيَادِيَّة</p>
                      <p className="asas-a4-subtitle">AI-ASAAS SOVEREIGN ATTENDANCE SYSTEM</p>
                    </div>
                    <div style={{ textAlign: 'left', fontSize: 11, color: '#55524e', fontWeight: 600 }}>
                      <div>وثيقة اعتماد المقر الرسمية</div>
                      <div dir="ltr" style={{ color: '#8c6928', fontWeight: 700 }}>VERIFIED-SOVEREIGN-QR</div>
                    </div>
                  </div>

                  <div className="asas-a4-branch-badge">
                    {effectiveBranch}
                  </div>
                  <div className="asas-a4-meta-line">
                    رمز الاستجابة السريعة المعتمد لإثبات الحضور والانصراف اللحظي المقيد جغرافياً · {currentDate}
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
                        <QRCodeSVG value={enterUrl} size={printMode === 'both' ? 220 : 330} level="M" includeMargin />
                      </div>
                      <div className="asas-a4-code-desc">
                        يُعلق عند المدخل الرئيسي للمقر · مخصص حصرياً لتسجيل الدخول والبدء
                      </div>
                      <div className="asas-a4-steps-list">
                        1. افتح كاميرا هاتفك وامسح الرمز أعلاه.<br />
                        2. تأكد من تفعيل خدمة الموقع الجغرافي (GPS).<br />
                        3. اضغط على زر "تسجيل الحضور الآن" لتأكيد حضورك فوراً.
                      </div>
                    </div>
                  )}

                  {(printMode === 'both' || printMode === 'exit') && (
                    <div className="asas-a4-code-card exit">
                      <div className="asas-a4-code-title exit">
                        تسجيل الانصراف (خروج)
                      </div>
                      <div className="asas-a4-qr-frame">
                        <QRCodeSVG value={exitUrl} size={printMode === 'both' ? 220 : 330} level="M" includeMargin />
                      </div>
                      <div className="asas-a4-code-desc">
                        يُعلق عند المخرج · مخصص حصرياً لتسجيل الانصراف وإنهاء الدوام
                      </div>
                      <div className="asas-a4-steps-list">
                        1. افتح كاميرا هاتفك وامسح الرمز أعلاه.<br />
                        2. تأكد من تفعيل خدمة الموقع الجغرافي (GPS).<br />
                        3. اضغط على زر "تسجيل الانصراف وإنهاء الدوام".
                      </div>
                    </div>
                  )}
                </div>

                {/* Official Footer */}
                <div className="asas-a4-footer">
                  <div className="asas-a4-security-notice">
                    ⚠️ تنبيه أمني: هذا الرمز محمي بتشفير HMAC-SHA256 السيادي ومقيد بالنطاق الجغرافي المصرح به وبأجهزة الموظفين المسجلة. أي محاولة لمشاركة الرمز أو تصويره من خارج المقر سيتم رصدها وإلغاؤها تلقائياً.
                  </div>
                  <div className="asas-a4-footer-bottom">
                    <span>منظومة أساس لإدارة وحوكمة الموارد البشرية</span>
                    <span dir="ltr">ai-asaas-attendance.vercel.app</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="asas-modal-footer">
          <button className="asas-btn" onClick={onClose}>إغلاق</button>
          <button className="asas-btn primary" onClick={handlePrint}>
            <Icon name="printer" />
            طباعة الملصق الآن (A4)
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
  const [accountFilter, setAccountFilter] = useState('all');
  const [liveTime, setLiveTime] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newCustomPerm, setNewCustomPerm] = useState('');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
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
        await api(`/admin/records/${form.id}`, 'PATCH', body);
        setModal(null);
        setNotice('تم حفظ تصحيح الحضور وتوثيقه في سجل العمليات');
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
          {tabs.filter(([key]) => key !== 'accounts' || can('employees.read')).filter(([key]) => key !== 'audit' || can('audit.read')).map(([key, label, iconName]) => {
            const pendingAccountsCount = (key === 'accounts' && Array.isArray(data) && tab === 'accounts')
              ? data.filter(a => !a.active).length
              : 0;
            return (
              <button className={tab === key ? 'active' : ''} key={key} onClick={() => { setTab(key); setOpen(false); setData(null); setNotice(''); setSearch(''); setAccountFilter('all'); }}>
                <Icon name={iconName} />
                <span>{label}</span>
                {key === 'announcements' && announcements.length > 0 && (
                  <span className="asas-badge urgent" style={{ marginRight: 'auto', fontSize: 10, padding: '1px 6px' }}>{announcements.length}</span>
                )}
                {key === 'accounts' && pendingAccountsCount > 0 && (
                  <span className="asas-badge pending" style={{ marginRight: 'auto', fontSize: 10, padding: '1px 6px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>{pendingAccountsCount}</span>
                )}
              </button>
            );
          })}
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
              {/* Sovereign Pending Approval Banner */}
              {rows.some(a => !a.active) && (
                <div style={{
                  padding: '14px 18px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(217, 119, 6, 0.08))',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      ⏳
                    </div>
                    <div>
                      <strong style={{ fontSize: 14, color: '#f59e0b', display: 'block' }}>
                        تنبيه الإدارة: يوجد {rows.filter(a => !a.active).length} طلب تسجيل حساب جديد بحاجة للمراجعة والموافقة
                      </strong>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        الموظفون المسجلون حديثاً لا يمكنهم تسجيل الدخول أو إثبات الحضور حتى يتم اعتمادهم وتفعيل حساباتهم من هنا.
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="asas-btn sm"
                      style={{ background: '#f59e0b', borderColor: '#d97706', color: '#111', fontWeight: 800 }}
                      onClick={() => setAccountFilter('pending')}
                    >
                      عرض الطلبات المعلقة ({rows.filter(a => !a.active).length})
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
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

                {/* Filter buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className={`asas-btn sm ${accountFilter === 'all' ? 'primary' : ''}`}
                    onClick={() => setAccountFilter('all')}
                  >
                    الكل ({rows.length})
                  </button>
                  <button
                    className={`asas-btn sm ${accountFilter === 'active' ? 'primary' : ''}`}
                    onClick={() => setAccountFilter('active')}
                  >
                    النشطون ({rows.filter(a => a.active).length})
                  </button>
                  <button
                    className={`asas-btn sm ${accountFilter === 'pending' ? 'primary' : ''}`}
                    style={rows.some(a => !a.active) ? { borderColor: '#f59e0b', color: accountFilter === 'pending' ? '#fff' : '#f59e0b' } : {}}
                    onClick={() => setAccountFilter('pending')}
                  >
                    ⏳ بانتظار الموافقة ({rows.filter(a => !a.active).length})
                  </button>
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
                    {rows
                      .filter(a => {
                        const matchesSearch = `${a.name} ${a.identifier} ${a.email || ''} ${a.phone || ''}`.toLowerCase().includes(search.toLowerCase());
                        if (!matchesSearch) return false;
                        if (accountFilter === 'active') return a.active;
                        if (accountFilter === 'pending') return !a.active;
                        return true;
                      })
                      .map(a => (
                        <tr key={a.id} style={!a.active ? { background: 'rgba(245, 158, 11, 0.04)' } : undefined}>
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
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span className="asas-badge inside" style={{ alignSelf: 'flex-start' }}>{roles[a.role] || a.role}</span>
                              {Array.isArray(a.permissions) && a.permissions.length > 0 && (
                                <small style={{ color: 'var(--text-3)', fontSize: 10.5 }} title={a.permissions.join(', ')}>
                                  {a.permissions.length} صلاحيات محددة
                                </small>
                              )}
                            </div>
                          </td>
                          <td>
                            {a.active ? (
                              <span className="asas-badge inside">نشط</span>
                            ) : (
                              <span className="asas-badge pending" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', fontWeight: 700 }}>
                                ⏳ بانتظار الموافقة
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {!a.active && can('employees.write') && (
                                <button
                                  className="asas-btn primary sm"
                                  style={{ background: '#10b981', borderColor: '#059669', color: '#fff', fontWeight: 700 }}
                                  title="قبول طلب التسجيل وتفعيل الحساب فوراً"
                                  onClick={() => approveAccount(a)}
                                >
                                  <Icon name="checkCircle" />
                                  قبول وتفعيل
                                </button>
                              )}
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
                                  title={!a.active ? 'رفض وحذف طلب التسجيل' : 'حذف حساب الموظف نهائياً'}
                                  onClick={() => deleteAccount(a)}
                                >
                                  <Icon name="trash" />
                                  {!a.active ? 'رفض' : 'حذف'}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 11.5, color: 'var(--text-3)', borderTop: '1px solid var(--hairline)', paddingTop: 8, flexWrap: 'wrap', gap: 8 }}>
                      <div>المرسل: <strong>{a.sender_name || 'الإدارة'}</strong> · <time>{date(a.created_at)}</time></div>
                      {can('employees.write') && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="asas-btn sm" onClick={() => edit('announcements', a)} title="تعديل التعميم">
                            <Icon name="edit" />
                            تعديل
                          </button>
                          <button className="asas-btn sm danger" onClick={() => deleteAnnouncement(a.id)} title="حذف التعميم">
                            <Icon name="trash" />
                            حذف
                          </button>
                        </div>
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
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="asas-btn primary" onClick={() => setShowPrintModal('both')}>
                                <Icon name="printer" />
                                معاينة وطباعة ملصق (A4)
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
                                <QRCodeSVG id="qr-enter-svg" value={enterUrl} size={210} level="M" includeMargin />
                              </div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>يُعلق عند المدخل · مخصص حصرياً لتسجيل الدخول والعودة (لا يقبل الخروج)</p>
                              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                                <a className="asas-btn primary sm" href={enterUrl} target="_blank" rel="noreferrer">
                                  <Icon name="logIn" />
                                  فتح صفحة الدخول
                                </a>
                                <button className="asas-btn sm" onClick={() => setShowPrintModal('enter')}>
                                  <Icon name="printer" />
                                  طباعة A4
                                </button>
                                <button className="asas-btn sm" onClick={() => downloadQrPng('qr-enter-svg', `كود-دخول-${qr.branch}`)}>
                                  <Icon name="download" />
                                  تنزيل صورة PNG
                                </button>
                              </div>
                            </div>

                            <div className="asas-qr-card">
                              <span className="asas-badge urgent" style={{ marginBottom: 8, fontSize: 12 }}>كود الانصراف (خروج فقط)</span>
                              <div className="asas-qr-box">
                                <QRCodeSVG id="qr-exit-svg" value={exitUrl} size={210} level="M" includeMargin />
                              </div>
                              <p className="asas-muted" style={{ fontSize: 12 }}>يُعلق عند المخرج · مخصص حصرياً لتسجيل الانصراف والخروج (لا يقبل الدخول)</p>
                              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                                <a className="asas-btn sm" href={exitUrl} target="_blank" rel="noreferrer" style={{ borderColor: 'var(--unpaid)', color: 'var(--unpaid)' }}>
                                  <Icon name="logOut" />
                                  فتح صفحة الخروج
                                </a>
                                <button className="asas-btn sm" onClick={() => setShowPrintModal('exit')}>
                                  <Icon name="printer" />
                                  طباعة A4
                                </button>
                                <button className="asas-btn sm" onClick={() => downloadQrPng('qr-exit-svg', `كود-انصراف-${qr.branch}`)}>
                                  <Icon name="download" />
                                  تنزيل صورة PNG
                                </button>
                              </div>
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
          canManage={can('employees.write')}
          onEdit={(a) => {
            setShowAnnouncementsModal(false);
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
                  : `${form.id ? 'تعديل' : 'إضافة'} ${
                      modal === 'branches' ? 'موقع الشركة'
                        : modal === 'shifts' ? 'الدوام وسياسة الاحتساب'
                        : modal === 'records' ? 'سجل الحضور'
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

                  {form.id && <label className="asas-check"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} />حساب نشط</label>}
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
function Login({ onLogin, initialError, onRetry, theme, onToggleTheme }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [pendingInfo, setPendingInfo] = useState(null);
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
        device_name
      });
      setPendingInfo({
        title: 'تم استلام طلب تسجيل حسابك بنجاح!',
        identifier: d.account?.identifier,
        name: d.account?.name,
        email: d.account?.email,
        message: d.message || 'طلبك قيد المراجعة وبانتظار موافقة واعتماد إدارة النظام في لوحة التحكم.'
      });
    } catch (err) {
      setError(err.message);
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
          <h2>{authMode === 'login' ? 'تسجيل الدخول إلى أساس' : 'طلب تسجيل حساب موظف'}</h2>
          <p className="asas-muted">
            {authMode === 'login'
              ? 'أدخل بياناتك المعتمدة للوصول إلى لوحة التحكم أو مساحة الموظف.'
              : 'سجل بياناتك المعتمدة لتقديم طلب إنشاء حساب جديد لاعتماده من قِبل الإدارة.'}
          </p>

          {/* Mode Switcher Tabs */}
          {!pendingInfo && (
            <div style={{ display: 'flex', background: 'var(--glass-inset)', borderRadius: 10, padding: 4, gap: 4, marginTop: 14 }}>
              <button
                type="button"
                className={`asas-btn sm ${authMode === 'login' ? 'primary' : ''}`}
                style={{ flex: 1, border: 'none', height: 36, fontWeight: 700 }}
                onClick={() => { setAuthMode('login'); setError(''); }}
              >
                <Icon name="logIn" />
                تسجيل الدخول
              </button>
              <button
                type="button"
                className={`asas-btn sm ${authMode === 'register' ? 'primary' : ''}`}
                style={{ flex: 1, border: 'none', height: 36, fontWeight: 700 }}
                onClick={() => { setAuthMode('register'); setError(''); }}
              >
                <Icon name="plus" />
                طلب حساب جديد
              </button>
            </div>
          )}

          {pendingInfo ? (
            <div style={{ textAlign: 'center', padding: '16px 8px', marginTop: 14 }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                border: '2px solid rgba(245, 158, 11, 0.4)'
              }}>
                <span style={{ fontSize: 28 }}>⏳</span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>
                {pendingInfo.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
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
                    <strong style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 14 }}>{pendingInfo.identifier}</strong>
                  </div>
                )}
                {pendingInfo.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="asas-muted" style={{ fontSize: 12 }}>البريد الإلكتروني:</span>
                    <span style={{ fontSize: 12.5 }} dir="ltr">{pendingInfo.email}</span>
                  </div>
                )}
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderRadius: 10, padding: 10, border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: 11.5, color: 'var(--text-2)', marginBottom: 18, lineHeight: 1.5, textAlign: 'right' }}>
                🔒 <strong>تنبيه الأمان والاعتماد:</strong> سيتم تفعيل حسابك فور موافقة إدارة النظام في لوحة التحكم. يمكنك بعدها تسجيل الدخول بالرقم الوظيفي أو البريد.
              </div>

              <button
                className="asas-btn primary"
                style={{ width: '100%', height: 44 }}
                onClick={() => {
                  setPendingInfo(null);
                  setAuthMode('login');
                  if (pendingInfo.identifier) setIdentifier(pendingInfo.identifier);
                }}
              >
                العودة لتسجيل الدخول
              </button>
            </div>
          ) : authMode === 'login' ? (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
              {error && (
                <div className={`asas-notice ${error.includes('بانتظار موافقة') || error.includes('قيد المراجعة') ? 'warning' : 'error'}`} role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {error.includes('بانتظار موافقة') || error.includes('قيد المراجعة') ? (
                      <span style={{ fontSize: 18 }}>⏳</span>
                    ) : null}
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
          ) : (
            <form onSubmit={submitRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
              {error && (
                <div className="asas-notice error" role="alert">
                  {error}
                </div>
              )}

              <Field
                label="الاسم الكامل الرباعي"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                required
                placeholder="مثال: محمد أحمد علي صالح"
              />

              <Field
                label="البريد الإلكتروني"
                type="email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                required
                placeholder="name@company.com"
              />

              <Field
                label="رقم الهاتف أو الجوال (اختياري)"
                type="tel"
                value={regPhone}
                onChange={e => setRegPhone(e.target.value)}
                placeholder="+967 77xxxxxxx"
              />

              {availableBranches.length > 0 && (
                <Field label="الفرع أو مقر العمل المفضل">
                  <select
                    className="asas-input"
                    value={regBranchId}
                    onChange={e => setRegBranchId(e.target.value)}
                  >
                    {availableBranches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field
                label="كلمة المرور (6 خانات على الأقل)"
                type="password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••••••"
              />

              <Field
                label="تأكيد كلمة المرور"
                type="password"
                value={regConfirmPassword}
                onChange={e => setRegConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••••••"
              />

              <button className="asas-btn primary" type="submit" disabled={busy} style={{ width: '100%', height: 46 }}>
                <Icon name="plus" />
                {busy ? 'جارٍ إرسال الطلب…' : 'إرسال طلب تسجيل الحساب للإدارة'}
              </button>
            </form>
          )}

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

function sendSystemNotification(title, body) {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'asas-geofence',
        renotify: true
      });
    }
  } catch (_) {}
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
          sendSystemNotification('🔔 تم تفعيل إشعارات أساس الذكية', 'ستصلك تنبيهات فورية عند تسجيل الحضور والانصراف ومراقبة النطاق.');
        }
      } catch (_) {}
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

  useEffect(() => {
    const update = () => setLiveTime(new Intl.DateTimeFormat('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Aden' }).format(new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(() => {
    return api('/attendance/me')
      .then(res => {
        setData(res);
        if (res?.branch) branchCoordsRef.current = res.branch;
      })
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

      // Fast coordinate retrieval: use recently cached fix if < 15 seconds old
      let p;
      if (lastCoordsRef.current && (Date.now() - lastCoordsTimeRef.current < 15000)) {
        p = lastCoordsRef.current;
      } else {
        p = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('الموقع غير متاح'));
          navigator.geolocation.getCurrentPosition(resolve, () => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 });
          }, { enableHighAccuracy: true, timeout: 4000, maximumAge: 6000 });
        });
        lastCoordsRef.current = p;
        lastCoordsTimeRef.current = Date.now();
      }

      const fix = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), captured_at: new Date(p.timestamp || Date.now()).toISOString() };
      const device_id = getDeviceId();
      const reqId = generateUUID();
      const r = await api('/attendance/action', 'POST', { action, token: currentToken, request_id: reqId, device_id, fix });

      const isEnterAction = r.action === 'enter' || action === 'enter';
      if (isEnterAction) {
        playChime('enter');
        if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
        sendSystemNotification('✅ تم تسجيل الحضور', r.message || 'تم تسجيل حضورك بنجاح');
      } else {
        playChime('exit');
        if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 400]);
        sendSystemNotification('👋 تم تسجيل الانصراف', r.message || 'تم تسجيل انصرافك بنجاح');
      }

      setMessage(r.message || 'تم توثيق الحضور بنجاح');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const todayRecord = data?.records?.[0];
  const isInside = todayRecord?.state === 'inside';

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
    if (branchCoordsRef.current?.latitude && branchCoordsRef.current?.longitude) {
      localDist = haversineDistance(
        coords.latitude,
        coords.longitude,
        Number(branchCoordsRef.current.latitude),
        Number(branchCoordsRef.current.longitude)
      );
      const effectiveRad = isInside
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
          sendSystemNotification('👋 تم تسجيل الانصراف التلقائي', res.message || 'تم رصد مغادرتك لنطاق مقر العمل وتوثيق الانصراف تلقائياً.');
          setMessage(res.message || '⚠️ تم رصد مغادرتك للنطاق بنجاح وتسجيل خروجك تلقائياً.');
          load();
          return;
        }

        const dist = res.distance != null ? Math.round(res.distance) : localDist;
        const entryRadius = Number(res.branch_radius?.entry || res.branch?.entry_radius || 120);
        const exitRadius = Number(res.branch_radius?.exit || res.branch?.exit_radius || 180);
        const effectiveRadius = isInside ? exitRadius : entryRadius;

        // Comprehensive inside check: server inside flag, inside_geofence flag, or distance within radius
        const isCurrentlyInside = Boolean(
          res.state === 'inside' ||
          res.inside_geofence === true ||
          (dist != null && dist <= effectiveRadius)
        );

        // Auto-exit acceleration: when employee is on duty and outside the exit perimeter
        if (isInside && !isCurrentlyInside && dist != null && dist > exitRadius) {
          if (!hasWarnedExitRef.current) {
            hasWarnedExitRef.current = true;
            playChime('warning');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            sendSystemNotification('⚠️ تنبيه مغادرة نطاق العمل', `تم رصد تواجدك خارج نطاق العمل (${dist} م). جاري التحقق من تأكيد الانصراف التلقائي.`);
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
        if (!isInside && isCurrentlyInside && autoCheckInRef.current && !hasAutoEnteredRef.current && (!todayRecord || todayRecord.state !== 'inside')) {
          hasAutoEnteredRef.current = true;
          setMessage('🎯 تم رصد تواجدك داخل مقر العمل! جاري تسجيل الحضور التلقائي...');
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
              sendSystemNotification('✅ تم تسجيل الحضور التلقائي', enterRes.message || 'مرحباً بك! تم تسجيل حضورك تلقائياً.');
              setMessage(enterRes.message || 'تم توثيق حضورك التلقائي بنجاح!');
              await load();
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
  }, [isInside, load, todayRecord]);

  const triggerLocationCheck = useCallback(() => {
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
          setError('تعذر تحديد الموقع: ' + (finalErr?.message || err?.message));
          setCheckingGps(false);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 }
      );
    };
    navigator.geolocation.getCurrentPosition(onPos, onFallback, { enableHighAccuracy: true, timeout: 5000, maximumAge: 2000 });
  }, [sendLocationFix]);

  useEffect(() => {
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

    // 3. Heartbeat (8s if visible, accelerated to 5s if pending exit)
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
    }, (geofenceStatus.pending > 0 || (isInside && geofenceStatus.distance > 180)) ? 3000 : 8000);

    return () => {
      isCancelled = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [sendLocationFix, geofenceStatus.pending, geofenceStatus.distance, isInside]);

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
                  <Icon name={isInside ? 'checkCircle' : 'logOut'} style={{ width: 18, height: 18 }} />
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

            {/* Live Geofence Monitoring Capsule (التصميم الكبسولي السيادي الأصلي) */}
            {(() => {
              const dist = geofenceStatus.distance;
              const isInsidePerimeter = Boolean(
                geofenceStatus.state === 'inside' ||
                (dist != null && dist <= (isInside ? 180 : 120))
              );
              const isPendingExit = Boolean(
                geofenceStatus.pending > 0 || geofenceStatus.state === 'pending'
              );
              const isIdle = geofenceStatus.state === 'idle' && dist == null;

              // Visual Status: 'inside' (green) | 'pending' / 'idle' (amber) | 'outside' (red)
              const visualStatus = isInsidePerimeter
                ? 'inside'
                : (isPendingExit ? 'pending' : (isIdle ? 'idle' : 'outside'));

              const dotColor = visualStatus === 'inside'
                ? 'var(--paid)'
                : (visualStatus === 'pending' || visualStatus === 'idle' ? 'var(--accent)' : 'var(--unpaid)');

              const dotGlow = visualStatus === 'inside'
                ? '0 0 10px var(--paid)'
                : (visualStatus === 'pending' || visualStatus === 'idle' ? '0 0 10px var(--accent)' : '0 0 10px var(--unpaid)');

              let labelText = '';
              if (visualStatus === 'idle') {
                labelText = 'جاري فحص الإحداثيات والتواجد...';
              } else if (visualStatus === 'pending') {
                labelText = `قيد فحص وتأكيد المغادرة (${geofenceStatus.remaining_seconds || 15} ث)`;
              } else if (visualStatus === 'inside') {
                labelText = isInside
                  ? 'متواجد داخل مقر العمل (على رأس العمل)'
                  : 'متواجد داخل مقر العمل (جاهز للدخول)';
              } else {
                labelText = isInside
                  ? 'خارج نطاق مقر العمل'
                  : 'خارج نطاق مقر العمل';
              }

              return (
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
                        background: dotColor,
                        boxShadow: dotGlow,
                        display: 'inline-block',
                        flexShrink: 0,
                        transition: 'background 0.3s ease, box-shadow 0.3s ease'
                      }}
                    />
                    <strong style={{ color: 'var(--text)' }}>مراقبة النطاق الجغرافي:</strong>
                    <span style={{ color: dotColor, fontWeight: 700, transition: 'color 0.3s ease' }}>
                      {labelText}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>
                      {dist != null ? `المسافة الحالية: ${dist} م` : 'جاري فحص المسافة...'}
                    </span>
                    <button
                      type="button"
                      className="asas-btn sm"
                      style={{ height: 22, padding: '0 6px', fontSize: 11, border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}
                      onClick={triggerLocationCheck}
                      disabled={checkingGps}
                      title="إعادة فحص الإحداثيات اللحظية"
                    >
                      <Icon name="refresh" className={checkingGps ? 'asas-spin' : ''} style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {token && (() => {
              const meta = decodeQrToken(token);
              const isEnter = meta?.action === 'enter';
              const isExit = meta?.action === 'exit';
              return (
                <div style={{ background: 'var(--glass-inset)', border: '1px solid var(--hairline)', padding: '8px 12px', borderRadius: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-3)' }}>الرمز المقترن:</span>
                    <span className={`asas-badge ${isEnter ? 'inside' : isExit ? 'urgent' : 'outside'}`} style={{ fontSize: 11 }}>
                      <Icon name={isEnter ? 'logIn' : isExit ? 'logOut' : 'qrCode'} style={{ width: 13, height: 13 }} />
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

            {/* Action Buttons: Prominent Check-in & Check-out */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <button
                className={`asas-btn ${!isInside ? 'primary' : ''}`}
                disabled={busy}
                onClick={() => act('enter')}
                style={{
                  height: 52,
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: !isInside ? '0 0 16px rgba(46, 125, 50, 0.35)' : 'none'
                }}
              >
                <Icon name="logIn" />
                <span>تسجيل الحضور</span>
              </button>

              <button
                className={`asas-btn ${isInside ? 'danger' : ''}`}
                disabled={busy}
                onClick={() => act('exit')}
                style={{
                  height: 52,
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderColor: !isInside ? 'var(--hairline)' : undefined,
                  boxShadow: isInside ? '0 0 16px rgba(211, 47, 47, 0.35)' : 'none'
                }}
              >
                <Icon name="logOut" />
                <span>تسجيل الانصراف</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="asas-btn" onClick={startCamera} style={{ flex: 1, minWidth: 160, height: 44, justifyContent: 'center' }}>
                <Icon name="camera" />
                مسح كود QR بكاميرا الجوال
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
