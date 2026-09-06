/* ═══════════════════════════════════════════════════════════
   21-Day Digital Detox — Service Worker
   Handles: app shell caching, scheduled notifications (via
   postMessage), periodic background sync, and notif clicks.
   Bump CACHE_VERSION to force a full cache refresh.
   ═══════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'detox-v7';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/splash/splash-640x1136.png',
  './icons/splash/splash-750x1334.png',
  './icons/splash/splash-1170x2532.png',
  './icons/splash/splash-1290x2796.png'
];

/* Third-party, best-effort: cached independently so a failure here
   (offline on first install, CDN hiccup) never blocks the core
   APP_SHELL above from being cached. See the fetch handler below for
   why these also need an explicit cross-origin allowance. */
const OPTIONAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
];

/* ── Install ────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {})
        .then(() => Promise.all(OPTIONAL_ASSETS.map(url => cache.add(url).catch(() => {})))))
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

/* ── Fetch: cache-first for app shell (+ the optional CDN assets
   above, which are same-list so they get the same offline treatment) */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;
  const isCachableThirdParty = OPTIONAL_ASSETS.includes(event.request.url);
  if (!isOwnOrigin && !isCachableThirdParty) return;

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

   HONEST LIMITATION: a service worker has no way to sleep for hours —
   the browser is free to terminate it the moment this event handler
   returns. We can only reliably fire a timer that completes while the
   SW is being kept alive by event.waitUntil(), which in practice means
   "the target time is a few minutes away". For anything further out
   (the normal case — e.g. an 8am reminder set at noon) we deliberately
   do NOT pretend to schedule it here, since a setTimeout that outlives
   the SW's lifetime never fires. Longer-range delivery instead relies on:
     1) periodicSync below (Chrome/Android, PWA installed, opportunistic —
        no exact-time guarantee), and
     2) _checkMissedNotif() in index.html, which fires a catch-up
        notification the next time the app is opened or foregrounded
        after the reminder time has passed.
   ─────────────────────────────────────────────────────────── */
const MAX_RELIABLE_DELAY = 10 * 60 * 1000; // 10 min — see note above

self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'SCHEDULE_NOTIF') return;

  const { delay, title, body } = data;
  if (typeof delay !== 'number' || delay < 0) return;
  if (delay > MAX_RELIABLE_DELAY) return; // don't fake a schedule we can't keep

  event.waitUntil(
    new Promise(resolve => {
      setTimeout(async () => {
        await self.registration.showNotification(title || '📵 21-Day Detox', {
          body:    body || 'Time to log your day!',
          icon:    './icons/icon-192.png',
          badge:   './icons/icon-192.png',
          tag:     'daily-reminder',
          renotify: false,
          data:    { url: './' }
        });
        resolve();
      }, delay);
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
