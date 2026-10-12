// Money Schei — Service Worker
// Bump this version string whenever money_schei.html (or any shell file) changes,
// so devices pick up the new version instead of serving a stale cached copy.
const CACHE_VERSION = 'money-schei-v1';
const SHELL_FILES = [
  './money_schei.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // data.json: always prefer a fresh network copy (it's the live financial
  // snapshot). Fall back to the last cached copy only when offline, and
  // keep that fallback copy updated whenever a network fetch succeeds.
  if (url.pathname.endsWith('/data.json') || url.pathname.endsWith('data.json')) {
    event.respondWith(
      fetch(req).then((res) => {
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // App shell and everything else: cache-first so the app opens instantly
  // and works offline, refreshing the cache in the background from the network.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && res.status === 200) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
