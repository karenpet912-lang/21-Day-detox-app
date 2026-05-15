/* ═══════════════════════════════════════════════════════════
   21-Day Digital Detox — Service Worker
   Handles: app shell caching, scheduled notifications (via
   postMessage), periodic background sync, and notif clicks.
   Bump CACHE_VERSION to force a full cache refresh.
   ═══════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'detox-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

/* ── Install ────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: purge old caches ─────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first for app shell ───────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(CACHE_VERSION)
            .then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ── Message: schedule a notification from the main thread ─
   Payload: { type:'SCHEDULE_NOTIF', delay:ms, title, body }
   ─────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'SCHEDULE_NOTIF') return;

  const { delay, title, body } = data;
  if (typeof delay !== 'number' || delay < 0) return;

  // Keep the SW alive long enough to fire the timer.
  // For very long delays (next day) the SW may be terminated — the
  // main thread will reschedule on next app open via _checkMissedNotif.
  event.waitUntil(
    new Promise(resolve => {
      // Cap at 10 min to avoid keeping SW alive unnecessarily for long delays.
      // The main thread reschedules on every app open anyway.
      const fireDelay = Math.min(delay, 10 * 60 * 1000);
      setTimeout(async () => {
        // Only fire if the delay matched (i.e. this is a same-session short schedule)
        if (delay <= 10 * 60 * 1000) {
          await self.registration.showNotification(title || '📵 21-Day Detox', {
            body:    body || 'Time to log your day!',
            icon:    './icons/icon-192.png',
            badge:   './icons/icon-192.png',
            tag:     'daily-reminder',
            renotify: false,
            data:    { url: './' }
          });
        }
        resolve();
      }, fireDelay);
    })
  );
});

/* ── Periodic Background Sync (Chrome/Android) ──────────── */
self.addEventListener('periodicsync', event => {
  if (event.tag !== 'daily-reminder') return;
  event.waitUntil(handlePeriodicSync());
});

async function handlePeriodicSync() {
  // If the app is already open, skip — the page will handle it.
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clients.length > 0) return;

  await self.registration.showNotification('📵 21-Day Digital Detox', {
    body:  'Time to log your day and keep your streak going!',
    icon:  './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag:   'daily-reminder',
    data:  { url: './' }
  });
}

/* ── Notification click: focus or open the app ───────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus an already-open window if available
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        // Otherwise open a new window
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
