// Fished Game - Service Worker
// Naikkan versi ini setiap kali index.html/manifest diubah, supaya cache lama dibuang.
const CACHE_VERSION = 'fished-v4.4-1';
const APP_SHELL_CACHE = `fished-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `fished-assets-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/ficon-192.png',
  './icons/ficon-512.png'
];

// --- INSTALL: precache app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// --- ACTIVATE: buang cache versi lama ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// --- FETCH ---
// Strategi:
// - Navigasi (buka app) & file app shell: cache-first, fallback ke network, fallback ke index.html saat offline total.
// - Gambar dari Imgur (atau domain lain): cache-first, kalau belum ada baru fetch (no-cors -> opaque) lalu simpan.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (req.mode === 'navigate' || (isSameOrigin && APP_SHELL_FILES.some((f) => req.url.endsWith(f.replace('./', ''))))) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  if (req.destination === 'image' || url.hostname.includes('imgur.com')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req, { mode: 'no-cors' })
            .then((res) => {
              cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
        })
      )
    );
    return;
  }

  // Lainnya: coba network dulu, kalau gagal pakai cache kalau ada.
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
