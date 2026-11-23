const cacheName = 'sekelas-v14';
const shell = ['/', '/app.js', '/style.css', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable.png', '/fonts/Inter.woff2'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith('sekelas-') && key !== cacheName).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }
  if (shell.includes(url.pathname)) event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
});
