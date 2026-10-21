// public/sw.js — AI-ASAAS Sovereign Attendance Service Worker
const CACHE_NAME = 'asas-attendance-v4.0';
const ASSETS_TO_CACHE = [
  '/',
  '/asas',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/apple-touch-icon.png'
];

// ─── Install: cache shell assets & force immediate activation ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// ─── Activate: purge ALL old caches (including previous versions) ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting legacy cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: network-first, with instant cache fallback ─────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API calls: Network only (never cache auth/attendance data)
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ success: false, error: 'OFFLINE', message: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.' }),
          { headers: { 'Content-Type': 'application/json; charset=utf-8' }, status: 503 }
        )
      )
    );
    return;
  }

  // Static Assets / Navigation: Network first, update cache, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/asas')))
  );
});
