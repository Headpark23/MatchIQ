// MatchIQ Progressive Web App Service Worker (v1)
// Caches application shell and enables offline home screen capability

const CACHE_NAME = 'matchiq-pwa-v1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './market_calculations.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/favicon-32.png',
  './assets/stadium_hero.jpg',
  './data/matches.json',
  './data/match_winner_forward.json',
  './data/forward_test.json'
];

// Install: pre-cache core shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clear stale caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for dynamic data, Cache-first for static shell
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For data requests, use Network-first with cache fallback
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // For HTML, scripts, stylesheets, and images: Cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResp => {
        if (networkResp && networkResp.status === 200 && event.request.method === 'GET') {
          const respClone = networkResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return networkResp;
      });
    }).catch(() => {
      if (event.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('./index.html');
      }
    })
  );
});
