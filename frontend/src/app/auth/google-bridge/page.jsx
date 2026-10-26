'use client';

import { useEffect, useState, useRef } from 'react';

const GOOGLE_CLIENT_ID = '331442639841-s48n1ir37vnn9nckg6ogn1hv8fl9fiq3.apps.googleusercontent.com';

export default function GoogleBridgePage() {
  const [status, setStatus] = useState('initializing'); // 'initializing' | 'ready' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [targetOrigin, setTargetOrigin] = useState('https://attendance.ai-asaas.com');
  const gsiRendered = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect target origin
    const params = new URLSearchParams(window.location.search);
    const parentParam = params.get('parent') || params.get('origin');
    let origin = 'https://attendance.ai-asaas.com';
    if (parentParam) {
      try {
        const u = new URL(parentParam);
        origin = u.origin;
      } catch (_) {}
    } else if (document.referrer) {
      try {
        const u = new URL(document.referrer);
        origin = u.origin;
      } catch (_) {}
    }
    setTargetOrigin(origin);

    function initGsi() {
      if (!window.google?.accounts?.id || gsiRendered.current) return;
      gsiRendered.current = true;

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => {
            if (!res?.credential) {
              setErrorMessage('تعذر استلام رمز التحقق من Google');
              setStatus('error');
              return;
            }

            setStatus('success');

            // Send to parent opener if opened in a popup
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage(
                  { type: 'GOOGLE_CREDENTIAL_RESPONSE', credential: res.credential },
                  '*'
                );
              } catch (e) {
                console.error('postMessage error:', e);
              }
              setTimeout(() => {
                window.close();
              }, 700);
            } else {
              // Redirect mode for mobile or blocked popups
              const redirectUrl = new URL(origin + '/asas');
              redirectUrl.searchParams.set('google_credential', res.credential);
              window.location.replace(redirectUrl.toString());
            }
          },
          auto_select: true,
          cancel_on_tap_outside: false
        });

        const btnEl = document.getElementById('bridge-google-btn-slot');
        if (btnEl) {
          btnEl.innerHTML = '';
          window.google.accounts.id.renderButton(btnEl, {
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 280,
            locale: 'ar'
          });
        }

        try {
          window.google.accounts.id.prompt();
        } catch (_) {}

        setStatus('ready');
      } catch (err) {
        setErrorMessage(err.message || 'خطأ أثناء تهيئة خدمة Google');
        setStatus('error');
      }
    }

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initGsi();
      script.onerror = () => {
        setErrorMessage('تعذر الاتصال بخوادم Google Identity');
        setStatus('error');
      };
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 20%, #1c1815 0%, #0d0c0b 100%)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#f5f5f5',
        padding: 24,
        direction: 'rtl'
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          background: 'rgba(28, 25, 23, 0.92)',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          borderRadius: 24,
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)'
        }}
      >
        {/* Shield Logo */}
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 18px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, #d4af37, #aa820a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(212, 175, 55, 0.35)'
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="#121212"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#f5f5f5' }}>
          بوابة التحقق السريع - أساس
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#a8a29e', lineHeight: 1.6 }}>
          {status === 'success'
            ? 'تم التحقق بنجاح من حسابك! جاري تحويلك إلى النظام...'
            : 'اختر حساب Google للمتابعة والدخول الفوري إلى لوحة التحكم والحضور'}
        </p>

        {status === 'success' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: 999,
              color: '#4ade80',
              fontSize: 14,
              fontWeight: 600,
              margin: '12px 0'
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            تم تأكيد الهوية بنجاح!
          </div>
        )}

        {status === 'error' && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 14,
              color: '#f87171',
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 16
            }}
          >
            {errorMessage}
          </div>
        )}

        {status !== 'success' && (
          <div
            id="bridge-google-btn-slot"
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 16,
              minHeight: 46
            }}
          />
        )}

        <div style={{ marginTop: 28, fontSize: 11, color: '#78716c', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          نظام الحضور والدوام السيادي الذكي © AI-ASAAS
        </div>
      </div>
    </div>
  );
}
