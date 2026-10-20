'use strict';

/**
 * Utility for persistent device identification & device fingerprinting.
 * Enforces single-device anti-fraud protection for Asas Attendance.
 */

export function getDeviceId() {
  if (typeof window === 'undefined') return 'server-rendered-device-id';

  try {
    // 1. Check localStorage
    let id = localStorage.getItem('asas_device_id');
    if (id && id.length >= 16) {
      return id;
    }

    // 2. Check Cookie
    const match = document.cookie.match(/(?:^|;\s*)asas_device_id=([^;]+)/);
    if (match && match[1] && match[1].length >= 16) {
      id = decodeURIComponent(match[1]);
      localStorage.setItem('asas_device_id', id);
      return id;
    }

    // 3. Generate new cryptographically secure UUID
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    } else {
      id = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
    }

    // Persist in localStorage and 10-year cookie
    localStorage.setItem('asas_device_id', id);
    document.cookie = `asas_device_id=${encodeURIComponent(id)}; max-age=315360000; path=/; SameSite=Lax`;
    return id;
  } catch (e) {
    return 'fallback-device-' + Date.now();
  }
}

export function getDeviceName() {
  if (typeof window === 'undefined' || !navigator) return 'جهاز غير معروف';

  const ua = navigator.userAgent || '';

  // Apple iPhone / iPad / iPod
  if (/iPhone/i.test(ua)) {
    const match = ua.match(/OS (\d+[_.]\d+)/);
    const osVer = match ? `(iOS ${match[1].replace('_', '.')})` : '';
    return `آيفون ${osVer}`.trim();
  }
  if (/iPad/i.test(ua)) return 'آيباد Apple iPad';
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'آيباد Apple iPad';

  // Android phone / tablet
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([0-9.]+)(?:;\s*([^;)]+))?/i);
    const model = match && match[2] ? match[2].trim() : 'أندرويد';
    return `هاتف ${model}`;
  }

  // Desktop OS
  if (/Windows/i.test(ua)) return 'كمبيوتر Windows';
  if (/Macintosh/i.test(ua)) return 'كمبيوتر Apple Mac';
  if (/Linux/i.test(ua)) return 'جهاز Linux';

  return 'هاتف ذكي';
}
