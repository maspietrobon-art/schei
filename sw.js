// Money Schei — Service Worker (v2)
// Strategy: pages and data.json are fetched from the network FIRST (always the latest
// published version, bypassing the browser's HTTP cache); the saved copy is used only
// when offline. Icons/manifest are cache-first. Bump CACHE_VERSION to force a clean start.
const CACHE_VERSION = 'money-schei-v2';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(SHELL_FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return fetch(new Request(req, { cache: 'no-cache' })).then((res) => {
    if (res && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || req.destination === 'document' ||
                 url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  const isData = url.pathname.endsWith('data.json');

  if (isPage || isData) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});
