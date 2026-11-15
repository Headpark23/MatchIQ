// Bet Buddy Progressive Web App Service Worker (v70)
// Network-first for shell code & data, cache-first for images/fonts, instant offline fallback

const CACHE_NAME = 'betbuddy-pwa-v143';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './market_calculations.js',
  './bet_builder.js',
  './settlement.js',
  './league_sync.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/favicon-32.png',
  './assets/stadium_hero.jpg',
  './data/multi_sport_events.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async url => {
          try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (res.ok) await cache.put(url, res);
          } catch (e) { /* non-critical */ }
        })
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push notifications (settled league bets, Friday picks). The server sends data-only FCM messages
// ({ title, body, url, tag }), so this worker always shows them itself, on every browser.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = { data: { body: event.data && event.data.text() } }; }
  const d = payload.data || payload.notification || payload;
  const title = d.title || 'Bet Buddy';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || 'betbuddy',
    renotify: true,
    icon: './assets/icon-192.png',
    badge: './assets/favicon-32.png',
    data: { url: d.url || '#/' }
  }));
});

// A tap opens (or focuses) the app on the route the message points at, on this site only.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const route = String((event.notification.data && event.notification.data.url) || '#/');
  // ?from=push lets index.html keep the route instead of its usual "always open on Home".
  const target = new URL('./?from=push' + (route.startsWith('#') ? route : '#/'), self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) return open.focus().then(c => (c && c.navigate ? c.navigate(target) : null)).catch(() => self.clients.openWindow(target));
    return self.clients.openWindow(target);
  }));
});

// Fetch: Network First for all HTML, JS, JSON code; Cache First only for static media
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCodeOrData = url.pathname.endsWith('.html') ||
                       url.pathname.endsWith('.js') ||
                       url.pathname.endsWith('.css') ||
                       url.pathname.includes('/data/') ||
                       url.pathname === '/' ||
                       url.pathname.endsWith('/MatchIQ/') ||
                       url.pathname.includes('/assets/icon-') ||
                       url.pathname.includes('/assets/apple-touch') ||
                       url.pathname.includes('/assets/favicon') ||
                       url.search.includes('v=');

  if (isCodeOrData) {
    // Network first: always fetch freshest live deployment, update cache, fallback to cache if offline
    event.respondWith(
      // GitHub Pages sends max-age=600, so revalidate every time or phones keep serving the old build.
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : null)))
    );
    return;
  }

  // Media & static assets: Cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
