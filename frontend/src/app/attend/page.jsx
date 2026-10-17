'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, CheckCircle2, AlertCircle, LogIn, LogOut, RefreshCw,
  QrCode, Clock, ShieldCheck, ArrowRight, User, Building, FileText,
  Smartphone, Camera, ChevronDown, Check, Send, Navigation, Mail, Phone, ShieldAlert, Unlock
} from 'lucide-react';
import { getDeviceId, getDeviceName } from '../../utils/device';

async function api(path, method = 'GET', body = null) {
  const r = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(res.message || 'تعذر الاتصال بالخادم');
    err.status = r.status;
    err.code = res.code;
    throw err;
  }
  return res.data;
}

function Brand() {
  return (
    <div className="asas-logo">
      <span className="asas-mark">
        <img src="/brand/asas-logo.png" alt="شعار أساس" />
      </span>
      <div>
        <strong>أساس</strong>
        <small>ASAS · IPHONE & WEB</small>
      </div>
    </div>
  );
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function AttendPage({ forcedAction = null }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [token, setToken] = useState('');
  const [actionHint, setActionHint] = useState(forcedAction || ''); // 'enter' | 'exit'
  const [branchInfo, setBranchInfo] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(null); // { state, distance, accuracy, fix }
  const [actionSuccess, setActionSuccess] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ from_date: '', to_date: '', reason: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [loginForm, setLoginForm] = useState({ identifier: 'emp1', password: '', phone: '' });
  const [googleModal, setGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Parse QR token and action from URL hash, pathname, or query params
  const parseUrlParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const t = hash.get('qr') || url.searchParams.get('token') || url.searchParams.get('qr') || '';
    const pathAction = window.location.pathname.includes('/enter') ? 'enter' : (window.location.pathname.includes('/exit') ? 'exit' : '');
    const act = forcedAction || url.searchParams.get('action') || pathAction || '';
    if (t) setToken(t);
    if (act) setActionHint(act);
  }, [forcedAction]);

  const loadUserData = useCallback(async () => {
    try {
      const u = await api('/auth/me');
      setUser(u);
      try {
        const att = await api('/attendance/me');
        setAttendanceData(att);
      } catch {}
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch active QR token automatically if not present in URL
  const fetchActiveToken = useCallback(async (action = '') => {
    try {
      const act = action || forcedAction || actionHint;
      const data = await api(`/attendance/active-qr${act ? `?action=${act}` : ''}`);
      if (data) {
        setToken(data.token);
        setBranchInfo(data);
      }
    } catch (e) {
      // not logged in or cannot fetch active qr
    }
  }, [forcedAction, actionHint]);

  useEffect(() => {
    parseUrlParams();
    loadUserData();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date());
    setLeaveForm({ from_date: todayStr, to_date: todayStr, reason: '' });
  }, [parseUrlParams, loadUserData]);

  useEffect(() => {
    if (user && !token) {
      fetchActiveToken();
    }
  }, [user, token, fetchActiveToken]);

  // Request fresh GPS position
  const getGpsFix = useCallback(async () => {
    if (!navigator.geolocation) {
      throw new Error('خدمة تحديد الموقع (GPS) غير مدعومة على هذا المتصفح');
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fix = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            captured_at: new Date(pos.timestamp).toISOString()
          };
          resolve(fix);
        },
        (err) => {
          let msg = 'تعذر الحصول على إحداثيات الموقع';
          if (err.code === 1) msg = 'يرجى تفعيل إذن الموقع في إعدادات Safari للآيفون (الموقع: أثناء الاستخدام)';
          else if (err.code === 2) msg = 'إشارة الـ GPS غير متاحة حالياً';
          else if (err.code === 3) msg = 'انتهت مهلة قراءة الـ GPS، يرجى المحاولة ثانية';
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  // Quick verify GPS coordinates and distance
  const checkCurrentLocation = useCallback(async () => {
    setError('');
    try {
      const fix = await getGpsFix();
      let dist = null;
      if (branchInfo && branchInfo.latitude && branchInfo.longitude) {
        dist = Math.round(distanceMeters(fix.latitude, fix.longitude, branchInfo.latitude, branchInfo.longitude));
      }
      setGpsStatus({ state: 'ready', fix, accuracy: fix.accuracy, distance: dist });
    } catch (e) {
      setGpsStatus({ state: 'error', message: e.message });
    }
  }, [getGpsFix, branchInfo]);

  useEffect(() => {
    if (user) {
      checkCurrentLocation();
    }
  }, [user, branchInfo, checkCurrentLocation]);

  // Geofence Auto-Exit Background Watcher (Pings location every 25s when inside)
  useEffect(() => {
    if (!user || !attendanceData?.records?.[0] || attendanceData.records[0].state !== 'inside') return;
    const interval = setInterval(async () => {
      try {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const fix = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            captured_at: new Date(pos.timestamp).toISOString()
          };
          const res = await api('/attendance/action', 'POST', {
            action: 'location',
            request_id: generateUUID(),
            device_id: getDeviceId(),
            fix
          });
          if (res && res.record) {
            if (res.automatic || res.record.state === 'outside') {
              if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
              setNotice('⚠️ تم تسجيل خروجك التلقائي بنجاح لمغادرتك نطاق الفرع');
              setActionSuccess({
                action: 'exit',
                message: 'تم تسجيل خروجك التلقائي بنجاح لمغادرتك نطاق الفرع',
                record: res.record,
                fix,
                time: new Date()
              });
              await loadUserData();
            }
          }
        }, () => {}, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      } catch (e) {}
    }, 25000);
    return () => clearInterval(interval);
  }, [user, attendanceData, loadUserData]);

  // One-click button to align branch location with tester's device location
  const alignBranchToMyDevice = async () => {
    setBusy(true);
    setError('');
    try {
      const fix = await getGpsFix();
      const bId = branchInfo?.branch_id || user?.branch_id || 1;
      await api(`/admin/branches/${bId}`, 'PUT', {
        name: branchInfo?.branch_name || 'أساس',
        latitude: fix.latitude,
        longitude: fix.longitude,
        entry_radius: 1000,
        exit_radius: 1500,
        max_accuracy: 250,
        exit_samples: 3,
        exit_delay_seconds: 120,
        active: true,
        reason: 'تحديث موقع الفرع ليطابق موقع جهاز التجربة الحالي'
      });
      setNotice(`✅ تم تعيين إحداثيات الفرع بنجاح لموقع جهازك الحالي! المسافة الآن 0 متر.`);
      await fetchActiveToken();
      await checkCurrentLocation();
    } catch (e) {
      setError('تعذر تحديث إحداثيات الفرع: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Handle Attendance Action (Enter / Exit)
  const handleAction = async (actionType) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // Always ensure we have a fresh, valid token matching this exact action
      let currentToken = token;
      try {
        const activeData = await api(`/attendance/active-qr?action=${actionType}`);
        if (activeData && activeData.token) {
          currentToken = activeData.token;
          setToken(currentToken);
          setBranchInfo(activeData);
        }
      } catch (err) {
        // Fallback to existing token
      }
      if (!currentToken) {
        throw new Error('يرجى مسح رمز QR الخاص بموقع الشركة أولاً أو الضغط على جلب كود اليوم');
      }

      const fix = await getGpsFix();
      const requestId = generateUUID();

      const device_id = getDeviceId();
      const result = await api('/attendance/action', 'POST', {
        action: actionType,
        token: currentToken,
        request_id: requestId,
        device_id,
        fix
      });

      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setNotice(result.message || (actionType === 'enter' ? 'تم تسجيل الحضور بنجاح' : 'تم تسجيل الخروج بنجاح'));
      setActionSuccess({
        action: actionType,
        message: result.message || (actionType === 'enter' ? 'تم توثيق حضورك وبدء فترة العمل الرسمية' : 'تم إنهاء المناوبة وتوثيق انصرافك بنجاح'),
        record: result.record,
        fix,
        time: new Date()
      });
      await loadUserData();
      await checkCurrentLocation();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Login handler with anti-fraud device binding
  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const device_id = getDeviceId();
      const device_name = getDeviceName();
      const d = await api('/auth/login', 'POST', {
        identifier: loginForm.identifier,
        password: loginForm.password,
        phone: loginForm.phone || undefined,
        device_id,
        device_name
      });
      setUser(d.account);
      await loadUserData();
      await fetchActiveToken();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Google Login handler with device binding
  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const device_id = getDeviceId();
      const device_name = getDeviceName();
      const d = await api('/auth/google', 'POST', {
        email: googleEmail,
        phone: loginForm.phone || undefined,
        device_id,
        device_name
      });
      setUser(d.account);
      setGoogleModal(false);
      await loadUserData();
      await fetchActiveToken();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Leave submission
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/leave', 'POST', leaveForm);
      setNotice('تم إرسال طلب الإجازة للمراجعة بنجاح');
      setLeaveModal(false);
      setLeaveForm(f => ({ ...f, reason: '' }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Camera QR Scanner on Safari
  const startCameraScanner = async () => {
    setScanning(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
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
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const raw = barcodes[0].rawValue;
              stopCameraScanner();
              try {
                const u = new URL(raw);
                const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
                const t = hash.get('qr') || u.searchParams.get('token') || raw;
                const act = u.searchParams.get('action') || '';
                setToken(t);
                if (act) setActionHint(act);
              } catch {
                setToken(raw);
              }
              setNotice('تم التقاط رمز QR بنجاح!');
              clearInterval(interval);
            }
          } catch {}
        }, 400);
      }
    } catch (e) {
      setError('تعذر تشغيل الكاميرا؛ يمكنك الضغط على جلب الرمز تلقائياً');
      setScanning(false);
    }
  };

  const stopCameraScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Brand />
        <div style={styles.spinner} />
        <p style={{ color: '#736d65', fontSize: 14, marginTop: 16 }}>جارٍ تجهيز مساحة التحضير للآيفون…</p>
      </div>
    );
  }

  // Current duty record
  const currentRecord = attendanceData?.records?.[0];
  const isInside = currentRecord?.state === 'inside';
  const isAdmin = user && ['super_admin', 'hr_admin', 'branch_manager'].includes(user.role);

  return (
    <div style={styles.page}>
      {/* iOS App Top Bar */}
      <header style={styles.header}>
        <Brand />
        <div style={styles.badgeAden}>
          <Clock size={13} style={{ marginInlineEnd: 4 }} />
          <span>{new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' })}</span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Alerts */}
        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span>{error}</span>
              {error.includes('خارج نطاق الفرع') && isAdmin && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={alignBranchToMyDevice}
                    style={{ ...styles.primaryButton, padding: '6px 12px', fontSize: 12, background: '#b59045' }}
                  >
                    📍 تعيين موقع الفرع على موقعي الحالي فوراً
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {notice && (
          <div style={styles.noticeBox}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{notice}</span>
          </div>
        )}

        {/* Not Logged In -> Clean iPhone Login Card */}
        {!user ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.iconCircle}>
                <Smartphone size={22} color="#b59045" />
              </div>
              <div>
                <h2 style={styles.cardTitle}>تسجيل حضور موظف أساس</h2>
                <p style={styles.cardSubtitle}>مخصص لأجهزة الآيفون وهواتف الموظفين المعتمدة</p>
              </div>
            </div>
            <form onSubmit={handleLogin} style={styles.form}>
              <label style={styles.label}>
                البريد الإلكتروني أو الرقم الوظيفي
                <input
                  style={styles.input}
                  required
                  autoComplete="username"
                  placeholder="emp1@asas.ye أو emp1"
                  value={loginForm.identifier}
                  onChange={e => setLoginForm({ ...loginForm, identifier: e.target.value })}
                />
              </label>
              <label style={styles.label}>
                كلمة المرور
                <input
                  style={styles.input}
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </label>
              <label style={styles.label}>
                رقم الجوال (لحفظه وتأكيد ربط الجهاز)
                <input
                  style={styles.input}
                  type="tel"
                  placeholder="+967 77xxxxxxx"
                  value={loginForm.phone}
                  onChange={e => setLoginForm({ ...loginForm, phone: e.target.value })}
                />
              </label>
              <button type="submit" disabled={busy} style={styles.primaryButton}>
                {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول ومتابعة الحضور'}
                <LogIn size={16} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
                <div style={{ flex: 1, height: 1, background: '#d2c5ac' }} />
                <span style={{ fontSize: 12, color: '#736d65' }}>أو تسجيل سريع</span>
                <div style={{ flex: 1, height: 1, background: '#d2c5ac' }} />
              </div>

              <button
                type="button"
                onClick={() => setGoogleModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #d2c5ac',
                  background: '#fff',
                  color: '#231f20',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                تسجيل الدخول عبر Google / Gmail
              </button>
            </form>

            <div style={{ marginTop: 16, padding: 12, background: '#fbf7ee', borderRadius: 10, fontSize: 11.5, color: '#775b24', border: '1px solid #ebdcc0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                <ShieldAlert size={14} color="#b59045" />
                <span>نظام تقييد الجوال (حماية ضد التحضير بالنيابة):</span>
              </div>
              يتم ربط حساب الموظف تلقائياً بجواله الشخصي عند أول تسجيل دخول. لن يتمكن أي شخص آخر من استخدام هذا الجوال لحساب موظف آخر، ولا يمكن التحضير من هاتف آخر دون مراجعة الإدارة.
            </div>

            <div style={{ marginTop: 12, padding: 10, background: '#faf9f5', borderRadius: 10, fontSize: 11.5, color: '#736d65', border: '1px solid #e0dacb' }}>
              💡 <strong>حسابات التجربة الجاهزة:</strong><br/>
              • المدير: <code>admin@asas.ye</code> (أو <code>admin</code>) / <code>AsasAdmin@2026</code><br/>
              • الموظف: <code>emp1@asas.ye</code> (أو <code>emp1</code>) / <code>AsasEmployee@2026</code>
            </div>
          </div>
        ) : (
          /* Attendance Interface (Works for both Employees and Admins testing) */
          <>
            {/* Employee Profile & Shift Status Card */}
            <div style={styles.profileCard}>
              <div style={styles.profileAvatar}>
                {user.name ? user.name[0] : 'أ'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={styles.profileName}>{user.name}</h3>
                <p style={styles.profileDetails}>
                  {user.identifier} · {user.email || 'بدون بريد'} · {user.phone || 'بدون هاتف'}
                </p>
                <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fbf7ee', border: '1px solid #ebdcc0', padding: '3px 8px', borderRadius: 6, fontSize: 11, color: '#775b24' }}>
                  <Smartphone size={12} />
                  <span>الجوال المقيد: <strong>{user.bound_device_name || 'هذا الجهاز'}</strong></span>
                </div>
              </div>
              <div style={isInside ? styles.statusBadgeInside : styles.statusBadgeOutside}>
                <span style={isInside ? styles.dotInside : styles.dotOutside} />
                {isInside ? 'حضور مفتوح' : 'خارج الموقع'}
              </div>
            </div>

            {/* GPS Location Live Card */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={18} color="#b59045" />
                  <strong style={{ fontSize: 14 }}>التحقق الجغرافي (GPS)</strong>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={checkCurrentLocation}
                    disabled={busy}
                    style={styles.iconButton}
                    title="تحديث قراءة الموقع"
                  >
                    <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
                    <span>تحديث</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={alignBranchToMyDevice}
                      disabled={busy}
                      style={{ ...styles.iconButton, color: '#775b24', background: '#fbf7ee', borderColor: '#ebdcc0' }}
                      title="تعيين إحداثيات الفرع لموقعك الحالي"
                    >
                      <Navigation size={13} />
                      <span>موقعي = الفرع</span>
                    </button>
                  )}
                </div>
              </div>

              <div style={styles.gpsInfoBox}>
                {gpsStatus?.state === 'ready' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={16} color="#2d6a4f" />
                      <span style={{ fontSize: 13, color: '#2d6a4f', fontWeight: 600 }}>
                        تم تحديد إحداثيات الجهاز (دقة: {gpsStatus.accuracy} م)
                      </span>
                    </div>
                    {gpsStatus.distance !== null && (
                      <p style={{ fontSize: 12, color: gpsStatus.distance <= 1000 ? '#2d6a4f' : '#a83232', margin: '4px 0 0' }}>
                        المسافة من مقر الفرع: <strong>{gpsStatus.distance} متر</strong>
                        {gpsStatus.distance > (branchInfo?.entry_radius || 80) && ' (خارج النطاق المسموح)'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} color="#b59045" />
                    <span style={{ fontSize: 13, color: '#775b24' }}>
                      {gpsStatus?.message || 'جارٍ قراءة موقع هذا الجهاز…'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance QR Action Card / Success Hub */}
            {actionSuccess ? (
              <div style={{ ...styles.card, background: 'linear-gradient(180deg, #f4faf6 0%, #ffffff 100%)', border: '1px solid #b8dfcb', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, background: '#2d6a4f', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px', fontSize: 28, boxShadow: '0 8px 20px rgba(45,106,79,0.2)' }}>
                  {actionSuccess.action === 'enter' ? '🎉' : '👋'}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#231f20' }}>
                  {actionSuccess.action === 'enter' ? 'تم تفعيل الكود وتسجيل الدخول!' : 'تم تفعيل الكود وتسجيل الخروج!'}
                </h3>
                <p style={{ fontSize: 13, color: '#3b6e55', margin: '0 0 14px', fontWeight: 500 }}>
                  {actionSuccess.message}
                </p>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, background: actionSuccess.action === 'enter' ? '#2d6a4f' : '#474143', color: '#fff', margin: '0 auto 14px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }}></span>
                  {actionSuccess.action === 'enter' ? 'حضور مفتوح · داخل نطاق الفرع' : 'خارج الموقع · انتهت المناوبة'}
                </div>

                <div style={{ background: '#fff', border: '1px solid #e8e4db', borderRadius: 12, padding: '12px 16px', margin: '0 0 14px', fontSize: 12.5, textAlign: 'right', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#736d65' }}>⏰ وقت العملية:</span>
                    <strong>{actionSuccess.time.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Aden' })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#736d65' }}>🏢 مقر الفرع:</span>
                    <strong>{branchInfo?.branch_name || 'فرع أساس المعتمد'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#736d65' }}>📍 التحقق الجغرافي:</span>
                    <strong>تم التوثيق (GPS موثوق)</strong>
                  </div>
                </div>

                {actionSuccess.action === 'enter' && (
                  <div style={{ background: '#edf6f2', border: '1px solid #b8dfcb', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#1f543c', textAlign: 'right', display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 0 14px', lineHeight: 1.5 }}>
                    <span style={{ fontSize: 16 }}>🛡️</span>
                    <div>
                      <strong>الخروج التلقائي مُفعل:</strong> يتم فحص موقعك كل 25 ثانية، وعند مغادرتك لنطاق الفرع سيقوم النظام بتسجيل انصرافك تلقائياً دون الحاجة لمسح الرمز مجدداً.
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setLeaveModal(true)}
                    style={{ ...styles.primaryButton, background: '#b59045', justifyContent: 'center' }}
                  >
                    <FileText size={16} />
                    تقديم طلب إجازة
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    style={{ ...styles.secondaryButton, justifyContent: 'center' }}
                  >
                    <Clock size={16} />
                    عرض سجل وساعات دوام اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionSuccess(null)}
                    style={{ ...styles.secondaryButton, justifyContent: 'center', borderColor: '#dcd5c9' }}
                  >
                    <RefreshCw size={14} />
                    مسح كود جديد / العودة للتحضير
                  </button>
                </div>
              </div>
            ) : (
            <div style={styles.card}>
              {/* Separate Page Switcher Tabs if no forced action */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => { setActionHint('enter'); fetchActiveToken('enter'); }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: (actionHint === 'enter' || (!actionHint && !isInside)) ? '2px solid #2d6a4f' : '1px solid #d2c5ac',
                    background: (actionHint === 'enter' || (!actionHint && !isInside)) ? '#f4faf6' : '#fff',
                    color: (actionHint === 'enter' || (!actionHint && !isInside)) ? '#2d6a4f' : '#736d65',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s'
                  }}
                >
                  <LogIn size={16} />
                  <span>صفحة كود الدخول</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActionHint('exit'); fetchActiveToken('exit'); }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: (actionHint === 'exit' || (!actionHint && isInside)) ? '2px solid #231f20' : '1px solid #d2c5ac',
                    background: (actionHint === 'exit' || (!actionHint && isInside)) ? '#f5f3f0' : '#fff',
                    color: (actionHint === 'exit' || (!actionHint && isInside)) ? '#231f20' : '#736d65',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s'
                  }}
                >
                  <LogOut size={16} />
                  <span>صفحة كود الخروج</span>
                </button>
              </div>

              {/* DEDICATED VIEW: ENTER CODE */}
              {(actionHint === 'enter' || (!actionHint && !isInside)) ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #edf6f2' }}>
                    <span style={{ background: '#eaf4ee', color: '#2d6a4f', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <LogIn size={14} /> كود تسجيل الدخول والعودة المعتمد
                    </span>
                    <span style={{ fontSize: 11.5, color: '#736d65' }}>توقيت عدن</span>
                  </div>

                  <div style={styles.cardHeader}>
                    <div style={{ ...styles.iconCircle, background: '#eaf4ee', color: '#2d6a4f' }}>
                      <LogIn size={22} color="#2d6a4f" />
                    </div>
                    <div>
                      <h3 style={styles.cardTitle}>بوابة تسجيل الدخول والعودة</h3>
                      <p style={styles.cardSubtitle}>
                        {token ? '✅ تم تفعيل كود الدخول المعتمد وجاهز للاعتماد' : 'جارٍ جلب كود الدخول المعتمد…'}
                      </p>
                    </div>
                  </div>

                  {/* Prominent Single Enter Button */}
                  <button
                    onClick={() => handleAction('enter')}
                    disabled={busy}
                    style={{
                      ...styles.actionBtn,
                      ...styles.actionBtnActiveEnter,
                      width: '100%',
                      padding: '20px 16px',
                      margin: '12px 0 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 16px rgba(45,106,79,0.18)'
                    }}
                  >
                    <div style={{ ...styles.actionBtnIconEnter, width: 48, height: 48, borderRadius: 24, fontSize: 24, margin: '0 auto' }}>
                      <LogIn size={26} />
                    </div>
                    <strong style={{ fontSize: 18 }}>تسجيل الدخول / العودة الآن</strong>
                    <small style={{ fontSize: 12.5, opacity: 0.9 }}>انقر لتفعيل كود الدخول وبدء احتساب ساعات العمل الرسمية</small>
                  </button>

                  <div style={{ textAlign: 'center', paddingTop: 8, borderTop: '1px dashed #e8e4db' }}>
                    <button
                      type="button"
                      onClick={() => { setActionHint('exit'); fetchActiveToken('exit'); }}
                      style={{ background: 'none', border: 'none', color: '#775b24', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <LogOut size={14} /> الانتقال إلى صفحة كود الخروج والانصراف ←
                    </button>
                  </div>
                </div>
              ) : (
                /* DEDICATED VIEW: EXIT CODE */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f5f3f0' }}>
                    <span style={{ background: '#f5f3f0', color: '#474143', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <LogOut size={14} /> كود تسجيل الخروج والانصراف المعتمد
                    </span>
                    <span style={{ fontSize: 11.5, color: '#736d65' }}>توقيت عدن</span>
                  </div>

                  <div style={styles.cardHeader}>
                    <div style={{ ...styles.iconCircle, background: '#f5f3f0', color: '#474143' }}>
                      <LogOut size={22} color="#474143" />
                    </div>
                    <div>
                      <h3 style={styles.cardTitle}>بوابة تسجيل الخروج والانصراف</h3>
                      <p style={styles.cardSubtitle}>
                        {token ? '✅ تم تفعيل كود الخروج المعتمد وجاهز للاعتماد' : 'جارٍ جلب كود الخروج المعتمد…'}
                      </p>
                    </div>
                  </div>

                  {/* Prominent Single Exit Button */}
                  <button
                    onClick={() => handleAction('exit')}
                    disabled={busy}
                    style={{
                      ...styles.actionBtn,
                      ...styles.actionBtnActiveExit,
                      width: '100%',
                      padding: '20px 16px',
                      margin: '12px 0 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 16px rgba(35,31,32,0.18)'
                    }}
                  >
                    <div style={{ ...styles.actionBtnIconExit, width: 48, height: 48, borderRadius: 24, fontSize: 24, margin: '0 auto' }}>
                      <LogOut size={26} />
                    </div>
                    <strong style={{ fontSize: 18 }}>تسجيل الخروج والانصراف الآن</strong>
                    <small style={{ fontSize: 12.5, opacity: 0.9 }}>انقر لتفعيل كود الخروج وإنهاء مناوبة العمل أو الخروج المؤقت</small>
                  </button>

                  <div style={{ textAlign: 'center', paddingTop: 8, borderTop: '1px dashed #e8e4db' }}>
                    <button
                      type="button"
                      onClick={() => { setActionHint('enter'); fetchActiveToken('enter'); }}
                      style={{ background: 'none', border: 'none', color: '#2d6a4f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <LogIn size={14} /> الانتقال إلى صفحة كود الدخول والعودة ←
                    </button>
                  </div>
                </div>
              )}

              {/* Missing Token notice & in-page scanner */}
              {!token && (
                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fetchActiveToken()}
                    style={{ ...styles.secondaryButton, marginInlineEnd: 8 }}
                  >
                    <RefreshCw size={14} />
                    جلب كود اليوم تلقائياً
                  </button>
                  <button
                    type="button"
                    onClick={startCameraScanner}
                    style={styles.secondaryButton}
                  >
                    <Camera size={14} />
                    مسح QR بالكاميرا
                  </button>
                </div>
              )}

              {/* In-page Camera Scanner Modal */}
              {scanning && (
                <div style={styles.cameraOverlay}>
                  <div style={styles.cameraBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14 }}>
                      <strong style={{ color: '#fff' }}>وجّه الكاميرا نحو رمز QR</strong>
                      <button onClick={stopCameraScanner} style={{ color: '#fff', background: 'none', border: 0, fontSize: 16 }}>إغلاق</button>
                    </div>
                    <video ref={videoRef} playsInline style={styles.video} />
                    <div style={styles.scannerTarget} />
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Quick Actions & Leave Request */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setLeaveModal(true)}
                style={{ ...styles.secondaryButton, flex: 1 }}
              >
                <FileText size={16} />
                تقديم طلب إجازة
              </button>
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                style={{ ...styles.secondaryButton, flex: 1 }}
              >
                <Clock size={16} />
                سجل حضوري
              </button>
            </div>

            {/* Today's / Recent Attendance History */}
            {showHistory && (
              <div style={{ ...styles.card, marginTop: 14 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>سجل الحضور الأخير</h4>
                {(attendanceData?.records || []).length === 0 ? (
                  <p style={{ color: '#736d65', fontSize: 13 }}>لا توجد سجلات حضور مسجلة لهذا اليوم.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {(attendanceData?.records || []).slice(0, 5).map(r => (
                      <div key={r.id} style={styles.historyRow}>
                        <div>
                          <strong>{new Date(r.shift_start).toLocaleDateString('ar-YE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Asia/Aden' })}</strong>
                          <p style={{ fontSize: 11, color: '#736d65', margin: 0 }}>
                            دخول: {r.first_in ? new Date(r.first_in).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' }) : '—'} ·
                            خروج: {r.last_out ? new Date(r.last_out).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' }) : '—'}
                          </p>
                        </div>
                        <span style={r.state === 'inside' ? styles.statusBadgeInside : styles.statusBadgeOutside}>
                          {r.state === 'inside' ? 'حضور مفتوح' : 'مكتمل'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PWA / iPhone Home Screen Tip */}
            <div style={styles.pwaTipCard}>
              <Smartphone size={20} color="#b59045" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#736d65', lineHeight: 1.6 }}>
                <strong>تثبيت التطبيق على شاشة الآيفون:</strong>
                <p>اضغط زر المشاركة <span dir="ltr">(Share <span style={{fontSize:14}}>⎋</span>)</span> في Safari ثم اختر <strong>"إضافة إلى الصفحة الرئيسية (Add to Home Screen)"</strong> ليظهر كأيقونة تطبيق مستقل على الآيفون.</p>
              </div>
            </div>

            {/* Logout button */}
            <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 10 }}>
              <a href="/asas" style={{ ...styles.secondaryButton, fontSize: 12 }}>لوحة الإدارة</a>
              <button
                type="button"
                onClick={async () => { await api('/auth/logout', 'POST', {}); setUser(null); }}
                style={{ ...styles.secondaryButton, fontSize: 12 }}
              >
                <LogOut size={14} />
                تسجيل الخروج
              </button>
            </div>
          </>
        )}

        {/* Leave Request Modal */}
        {leaveModal && (
          <div style={styles.modalBackdrop} onClick={e => { if (e.target === e.currentTarget) setLeaveModal(false); }}>
            <div style={styles.modalCard}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>طلب إجازة جديدة</h3>
              <form onSubmit={handleLeaveSubmit} style={styles.form}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={styles.label}>
                    من تاريخ
                    <input
                      style={styles.input}
                      type="date"
                      required
                      value={leaveForm.from_date}
                      onChange={e => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                    />
                  </label>
                  <label style={styles.label}>
                    إلى تاريخ
                    <input
                      style={styles.input}
                      type="date"
                      required
                      value={leaveForm.to_date}
                      onChange={e => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                    />
                  </label>
                </div>
                <label style={styles.label}>
                  السبب أو المبرر
                  <textarea
                    style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
                    required
                    placeholder="اكتب مبرر الإجازة باختصار…"
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button type="submit" disabled={busy} style={{ ...styles.primaryButton, flex: 1 }}>
                    {busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
                  </button>
                  <button type="button" onClick={() => setLeaveModal(false)} style={styles.secondaryButton}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Google Sign-In Modal */}
        {googleModal && (
          <div style={styles.modalBackdrop} onClick={e => { if (e.target === e.currentTarget) setGoogleModal(false); }}>
            <div style={styles.modalCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>تسجيل الدخول عبر Google</h3>
                <button type="button" onClick={() => setGoogleModal(false)} style={styles.iconButton}>✕</button>
              </div>
              <p style={{ fontSize: 12.5, color: '#736d65', marginBottom: 14 }}>
                أدخل عنوان بريدك الإلكتروني (Gmail) المسجل لدى الشركة لربط هاتفك وتسجيل الحضور فورياً:
              </p>
              <form onSubmit={handleGoogleLogin} style={styles.form}>
                <label style={styles.label}>
                  بريد Gmail أو بريد الموظف
                  <input
                    style={styles.input}
                    type="email"
                    required
                    autoFocus
                    placeholder="emp1@asas.ye أو your.email@gmail.com"
                    value={googleEmail}
                    onChange={e => setGoogleEmail(e.target.value)}
                  />
                </label>
                <label style={styles.label}>
                  رقم الجوال (اختياري لتأكيد ربط الهاتف)
                  <input
                    style={styles.input}
                    type="tel"
                    placeholder="+967 77xxxxxxx"
                    value={loginForm.phone}
                    onChange={e => setLoginForm({ ...loginForm, phone: e.target.value })}
                  />
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button type="submit" disabled={busy} style={{ ...styles.primaryButton, flex: 1 }}>
                    {busy ? 'جارٍ التحقق…' : 'متابعة الدخول'}
                  </button>
                  <button type="button" onClick={() => setGoogleModal(false)} style={styles.secondaryButton}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    minHeight: '100dvh',
    background: '#faf9f5',
    color: '#231f20',
    fontFamily: "AsasLocal, -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif",
    direction: 'rtl',
    paddingBottom: 'env(safe-area-inset-bottom, 24px)'
  },
  header: {
    height: 64,
    background: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid #e8e4db',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    position: 'sticky',
    top: 0,
    zIndex: 20
  },
  badgeAden: {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#f4ede1',
    color: '#775b24',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600
  },
  main: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '20px 16px 40px'
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e8e4db',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 2px 10px rgba(35, 31, 32, 0.04)',
    marginBottom: 16
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#f9f5ed',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#736d65',
    margin: '3px 0 0'
  },
  form: {
    display: 'grid',
    gap: 14
  },
  label: {
    display: 'grid',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: '#554f49'
  },
  input: {
    padding: '11px 14px',
    border: '1px solid #dcd5c9',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'inherit',
    background: '#ffffff',
    color: '#231f20',
    outline: 'none'
  },
  primaryButton: {
    background: '#231f20',
    color: '#ffffff',
    border: 0,
    padding: '13px 20px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(35, 31, 32, 0.15)'
  },
  secondaryButton: {
    background: '#ffffff',
    color: '#231f20',
    border: '1px solid #e8e4db',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer'
  },
  profileCard: {
    background: 'linear-gradient(135deg, #231f20 0%, #2f2a2c 100%)',
    color: '#ffffff',
    borderRadius: 18,
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    boxShadow: '0 4px 18px rgba(35, 31, 32, 0.12)'
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: '#b59045',
    color: '#231f20',
    fontSize: 18,
    fontWeight: 700,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0
  },
  profileName: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0
  },
  profileDetails: {
    fontSize: 12,
    color: '#d2c5ac',
    margin: '3px 0 0'
  },
  statusBadgeInside: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#235d3d',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 11,
    fontWeight: 600
  },
  statusBadgeOutside: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#474143',
    color: '#d2c5ac',
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 11,
    fontWeight: 600
  },
  dotInside: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#6ee7b7'
  },
  dotOutside: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#9ca3af'
  },
  gpsInfoBox: {
    background: '#faf7f2',
    border: '1px solid #ebdcc0',
    borderRadius: 10,
    padding: '10px 14px',
    marginTop: 12
  },
  iconButton: {
    background: 'none',
    border: '1px solid #e8e4db',
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: 11,
    color: '#736d65',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer'
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginTop: 14
  },
  actionBtn: {
    background: '#faf9f5',
    border: '2px solid #e8e4db',
    borderRadius: 16,
    padding: '18px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease'
  },
  actionBtnActiveEnter: {
    background: '#f4faf6',
    borderColor: '#37614b',
    boxShadow: '0 4px 16px rgba(45, 106, 79, 0.15)'
  },
  actionBtnActiveExit: {
    background: '#fdf6f5',
    borderColor: '#992c20',
    boxShadow: '0 4px 16px rgba(153, 44, 32, 0.15)'
  },
  actionBtnIconEnter: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: '#e0f2e9',
    color: '#2d6a4f',
    display: 'grid',
    placeItems: 'center'
  },
  actionBtnIconExit: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: '#fde8e5',
    color: '#992c20',
    display: 'grid',
    placeItems: 'center'
  },
  pwaTipCard: {
    background: '#ffffff',
    border: '1px dashed #c0aa81',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    marginTop: 18
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #f1ece4'
  },
  errorBox: {
    background: '#fdf0ef',
    border: '1px solid #f4cbc6',
    color: '#a83232',
    padding: '12px 16px',
    borderRadius: 12,
    fontSize: 13,
    marginBottom: 14,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10
  },
  noticeBox: {
    background: '#eaf4ee',
    border: '1px solid #b8dcce',
    color: '#2d6a4f',
    padding: '12px 16px',
    borderRadius: 12,
    fontSize: 13,
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#faf9f5'
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #e8e4db',
    borderTopColor: '#b59045',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginTop: 20
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(35, 31, 32, 0.65)',
    backdropFilter: 'blur(6px)',
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    zIndex: 100
  },
  modalCard: {
    background: '#ffffff',
    borderRadius: 18,
    padding: 22,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.2)'
  },
  cameraOverlay: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column'
  },
  cameraBox: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  scannerTarget: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    height: '40%',
    border: '2px solid #b59045',
    borderRadius: 18,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
  }
};
