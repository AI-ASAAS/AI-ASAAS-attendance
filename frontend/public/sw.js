// public/sw.js — AI-ASAAS Sovereign Attendance Service Worker
const CACHE_NAME = 'asas-attendance-v5.6';
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
    title: 'نظام أساس · تنبيه الدوام',
    body: 'تذكير: يرجى تفقد حالة دوامك وتسجيل الحضور.',
    fullBody: '',
    type: 'general',
    priority: 'normal',
    announcementId: null,
    senderName: 'إدارة نظام أساس',
    createdAt: new Date().toISOString(),
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
    if (event.data) {
      const txt = event.data.text();
      payload.body = txt;
      payload.fullBody = txt;
    }
  }

  if (!payload.fullBody) payload.fullBody = payload.body;

  const isUrgent = Boolean(
    payload.priority === 'urgent' ||
    (payload.tag && (payload.tag.includes('duty') || payload.tag.includes('urgent')))
  );

  const notifOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/favicon.png',
    tag: payload.tag || 'asas-duty-reminder',
    dir: 'rtl',
    lang: 'ar',
    renotify: true,
    requireInteraction: isUrgent,
    timestamp: payload.timestamp || Date.now(),
    vibrate: isUrgent ? [260, 100, 260, 100, 260] : [180, 90, 180],
    actions: [
      { action: 'open', title: 'عرض الرسالة كاملة' }
    ],
    data: {
      url: payload.url || '/asas',
      title: payload.title,
      body: payload.body,
      fullBody: payload.fullBody,
      type: payload.type || 'general',
      priority: payload.priority || 'normal',
      announcementId: payload.announcementId || null,
      senderName: payload.senderName || 'إدارة نظام أساس',
      createdAt: payload.createdAt || new Date().toISOString()
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notifOptions)
  );
});

// ─── Notification Click: Focus / Open Window & Show Full Message ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  let urlToOpen = notifData.url || '/asas';

  if (notifData.announcementId && !urlToOpen.includes('open_announcement=')) {
    urlToOpen = `/asas?open_announcement=${encodeURIComponent(String(notifData.announcementId))}`;
  } else if (notifData.type === 'duty_reminder' && !urlToOpen.includes('open_reminder=')) {
    urlToOpen = '/asas?open_reminder=1';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && (client.url.includes('/asas') || client.url.endsWith('/')) && 'focus' in client) {
          client.postMessage({
            type: 'ASAS_OPEN_NOTIFICATION',
            payload: notifData
          });
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
