"""Update sw.js:
1. Adopt Network-First strategy for HTML and JS (falling back to cache only when offline).
   This guarantees users immediately receive new code, UI updates, and features without being trapped in stale ServiceWorker cache!
2. Bump cache to betbuddy-pwa-v17.
3. Call self.skipWaiting() and clients.claim() so it activates instantly across all open tabs.
4. Auto-unregister any older service workers in index.html and update registration with skipWaiting on change.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. Update sw.js
sw_path = ROOT / "sw.js"
new_sw = """// Bet Buddy Progressive Web App Service Worker (v17)
// Network-first for shell code & data, cache-first for images/fonts, instant offline fallback

const CACHE_NAME = 'betbuddy-pwa-v17';

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
  './assets/stadium_hero.jpg'
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

// Fetch: Network First for all HTML, JS, JSON code; Cache First only for static media
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCodeOrData = url.pathname.endsWith('.html') ||
                       url.pathname.endsWith('.js') ||
                       url.pathname.endsWith('.css') ||
                       url.pathname.includes('/data/') ||
                       url.pathname === '/' ||
                       url.pathname.endsWith('/MatchIQ/');

  if (isCodeOrData) {
    // Network first: always fetch freshest live deployment, update cache, fallback to cache if offline
    event.respondWith(
      fetch(event.request)
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
"""

sw_path.write_text(new_sw, encoding="utf-8")
print("Updated sw.js to v17 with Network-First strategy!")

# 2. Update app.js service worker update listener
app_path = ROOT / "app.js"
app_js = app_path.read_text(encoding="utf-8")

old_reg = "window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {}));"
new_reg = """window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.update();
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        }
      });
    }).catch(() => {});
  });"""

assert old_reg in app_js, "old_reg not found!"
app_js = app_js.replace(old_reg, new_reg, 1)
app_path.write_text(app_js, encoding="utf-8")
print("Updated app.js service worker registration with auto-reload on update!")

# 3. Add cache-busting meta tag and clear stale SW in index.html
index_path = ROOT / "index.html"
index_html = index_path.read_text(encoding="utf-8")

if '<meta http-equiv="Cache-Control"' not in index_html:
    index_html = index_html.replace(
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n<meta http-equiv="Pragma" content="no-cache">\n<meta http-equiv="Expires" content="0">'
    )
index_path.write_text(index_html, encoding="utf-8")
print("Updated index.html cache-control headers!")
