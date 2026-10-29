// MatchIQ Progressive Web App Service Worker (v1)
// Caches application shell and enables offline home screen capability

const CACHE_NAME = 'betbuddy-pwa-v12';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './market_calculations.js',
  './bet_builder.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/favicon-32.png',
  './assets/stadium_hero.jpg',
  './data/predictions.json',
  './data/fixtures.json',
  './data/prediction_history.json',
  './data/performance.json',
  './data/pipeline_status.json',
  './data/model_reliability.json',
  './data/odds.json',
  './data/league_validation.json',
  './data/rights.json'
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
        keys.map(k => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network first for dynamic JSON data, Cache first for core static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // If fetching local data JSON, try network first so user gets latest predictions, fall back to cache
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static shell assets: Cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
