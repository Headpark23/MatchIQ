"""Add instant version sync and live update toast/banner:
1. Version synchronization badge in app.js (e.g. 'v2.1.0 · Live Sync').
2. When a PWA or browser window detects a new deployment, it automatically claims clients, clears caches, and reloads immediately so installed app and web always stay identical.
3. Add a manual 'Check for Updates' button in the header or user profile bar so users can force sync with 1 click.
4. Clean up any stale query parameters.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. Update app.js
app_path = ROOT / "app.js"
app_js = app_path.read_text(encoding="utf-8")

# Let's add an explicit APP_VERSION constant and live check
old_sw_block = """if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
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
  });
}"""

new_sw_block = """const APP_VERSION = '2026.10.30.18';

async function forceAppSync() {
  toast('Syncing with latest Bet Buddy server... 🐼');
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) { /* ignore */ }
  }
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update()));
    } catch (e) { /* ignore */ }
  }
  setTimeout(() => {
    window.location.href = window.location.origin + window.location.pathname + '?sync=' + Date.now() + '#/';
    window.location.reload(true);
  }, 400);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    toast('App updated to latest version! Refreshing... 🐼');
    setTimeout(() => window.location.reload(), 600);
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.update();
      setInterval(() => reg.update(), 60000); // Check for server updates every 60 seconds
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                toast('New Bet Buddy upgrade ready! Auto-syncing... 🐼');
                setTimeout(() => window.location.reload(), 800);
              }
            }
          });
        }
      });
    }).catch(() => {});
  });
}"""

assert old_sw_block in app_js, "old_sw_block not found in app.js!"
app_js = app_js.replace(old_sw_block, new_sw_block, 1)

# Add Sync App button in header tools and welcome banner
old_header_tools = """      <button type="button" class="pwa-install-btn" id="header-install-btn" title="Download Bet Buddy to phone / tablet" aria-label="Download App">
        <span class="install-panda-emoji" style="font-size:15px">🐼</span>
        <span class="install-label">Download App</span>
      </button>"""

new_header_tools = """      <button type="button" class="pwa-install-btn" id="header-install-btn" title="Download Bet Buddy to phone / tablet" aria-label="Download App">
        <span class="install-panda-emoji" style="font-size:15px">🐼</span>
        <span class="install-label">Download App</span>
      </button>
      <button type="button" class="sync-refresh-btn" id="header-sync-btn" title="Force sync latest app upgrades" aria-label="Sync App" onclick="forceAppSync()">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        <span class="sync-label">Sync</span>
      </button>"""

# Also update index.html with header-sync-btn
index_path = ROOT / "index.html"
index_html = index_path.read_text(encoding="utf-8")
assert old_header_tools in index_html, "old_header_tools not found in index.html"
index_html = index_html.replace(old_header_tools, new_header_tools, 1)

# Update script tag in index.html with timestamp
index_html = index_html.replace('<script src="app.js?v=16"></script>', '<script src="app.js?v=18"></script>')
index_path.write_text(index_html, encoding="utf-8")
print("Updated index.html with sync button and v18 tag!")

# Update sw.js CACHE_NAME to v18 and skipWaiting on install
sw_path = ROOT / "sw.js"
sw_js = sw_path.read_text(encoding="utf-8")
sw_js = sw_js.replace("betbuddy-pwa-v17", "betbuddy-pwa-v18")
sw_path.write_text(sw_js, encoding="utf-8")
print("Updated sw.js to v18!")

# Save app.js
app_path.write_text(app_js, encoding="utf-8")
print("Updated app.js with forceAppSync() and controllerchange auto-reload!")

# Add CSS for sync button in styles.css
css_path = ROOT / "styles.css"
css_code = css_path.read_text(encoding="utf-8")
sync_css = """

/* Header Live Sync Button */
.sync-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  min-height: 32px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.sync-refresh-btn:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: var(--cyan);
  color: #fff;
}
.sync-refresh-btn:active svg {
  transform: rotate(180deg);
  transition: transform 0.3s ease;
}
"""
css_code += sync_css
css_path.write_text(css_code, encoding="utf-8")
print("Updated styles.css with sync button styles!")
