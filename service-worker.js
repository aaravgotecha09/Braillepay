/*
 * BraillePay service worker — offline support for the STATIC APP SHELL only.
 *
 * Rules (see docs/SECURITY.md):
 *  - API requests (cross-origin to the Render backend, and anything under /api/ or /health) are NEVER
 *    intercepted or cached. Authentication and payment responses always come from the network.
 *  - Offline mode never implies that a payment succeeded; the offline page says so.
 *  - Bump CACHE_VERSION on every release so old shells are removed.
 */
const CACHE_VERSION = 'braillepay-shell-v2';
const SHELL = [
  '/',
  '/index.html',
  '/config.js',
  '/manifest.json',
  '/offline.html',
  '/vendor/jsQR.js',
  '/js/braille-map.js',
  '/js/braille-timing.js',
  '/js/upi-parser.js',
  '/js/app.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never touch non-GET requests, other origins (the API), or API paths.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return;

  if (request.mode === 'navigate') {
    // Network first so a deploy is picked up; fall back to the cached shell, then the offline page.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // Static assets: cache first, then network.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
