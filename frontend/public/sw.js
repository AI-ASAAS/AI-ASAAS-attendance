// public/sw.js — AI-ASAAS Sovereign Attendance Service Worker
const CACHE_NAME = 'asas-attendance-v5.2';
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

// ─── Push Notifications: Handle Incoming Web Push ─────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: '⏰ نظام أساس للحضور والدوام',
    body: 'تذكير: يرجى تفقد حالة دوامك وتسجيل الحضور.',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    tag: 'asas-duty-reminder',
    url: '/asas'
  };

  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/favicon.png',
      tag: payload.tag || 'asas-duty-reminder',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: payload.url || '/asas' }
    })
  );
});

// ─── Notification Click: Focus / Open Window ──────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/asas';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && client.url.includes('/asas') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
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
