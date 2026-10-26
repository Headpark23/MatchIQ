// MatchIQ Progressive Web App Service Worker (v1)
// Caches application shell and enables offline home screen capability

const CACHE_NAME = 'matchiq-pwa-v5';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './market_calculations.js',
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
  './data/model_reliability.json'
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

// Fetch: Network-first for HTML and data, Cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For HTML navigation requests, use Network-first with cache fallback so updates are instant
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For data requests, use Network-first with cache: 'no-store' to ensure freshness
  // Data and app code are network-first so a deploy or data refresh shows at once.
  if (url.pathname.includes('/data/') || /\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // For static assets (images, icons): Cache-first with network fallback
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
