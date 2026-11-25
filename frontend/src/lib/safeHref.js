'use strict';

/**
 * Validates untrusted URLs before rendering in <a href>.
 * Only allows http, https, mailto, tel, and relative same-site paths.
 */
export function safeHref(raw, fallback = '#') {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const parsed = new URL(s);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }
  return fallback;
}
