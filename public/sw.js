/* E-SCON service worker
 * - Pre-caches the app shell for offline launchability.
 * - Network-first navigation so users always get fresh data when online.
 * - Runtime caches same-origin GET responses (API-free SPA; everything else
 *   is served from node_modules-bundled assets or localStorage data).
 *
 * Bumping VERSION is the "clear the cache for everyone" switch: on `activate`
 * every cache whose name is not the current shell/runtime pair is deleted, so
 * each client drops its stale asset + tile copies and re-fetches the new build.
 * This only touches the Cache Storage buckets - accounts, companies, products,
 * orders, carts, wallets, reviews and notifications live in localStorage and
 * are never removed here, so no user data is lost.
 */
const VERSION = 'e-scon-v1.6.0';
const SHELL_CACHE = VERSION + '-shell';
const RUNTIME_CACHE = VERSION + '-runtime';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './logo192.png',
  './logo512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin file uploads (Leaflet tiles, map queries, Nominatim).
  if (url.origin !== self.location.origin) {
    if (request.destination === 'image' && /openstreetmap|tile/i.test(url.hostname)) {
      event.respondWith(
        caches.match(request).then(
          (cached) =>
            cached ||
            fetch(request)
              .then((response) => {
                const copy = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
                return response;
              })
              .catch(() => cached)
        )
      );
    }
    return;
  }

  // Navigations: network-first with offline fallback to the cached shell so
  // the SPA (including hash routes like #escon=...) always renders offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Static assets: cache-first with background refresh.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
