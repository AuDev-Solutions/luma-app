// Offline shell for the installed app. Only same-origin app files are cached: requests to the pole
// (another origin, or /json on the pole itself) always go to the network.
const CACHE = 'luma-v1';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/json') || url.pathname.startsWith('/ws')) return;
  // Network first so a new version is picked up; the cache answers only when offline.
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./'))));
});
