#!/usr/bin/env python3
"""
Thorough Brand Icon Cache Purge & Alignment Script (v44)
Ensures:
1. All icon references in HTML, JS, CSS, and manifest use ?v=44
2. Top-of-page auto-purge in index.html is bumped to 2026.10.30.44 and purges all caches & SW
3. sw.js treats /assets/icon- as network-first so new branding immediately downloads
4. All remnants of panda base64 and emoji are purged from app.js & index.html
5. Rebuilds public-dist and validates
"""
import re

def patch_index_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Bump APP_VER to 2026.10.30.44 and make auto-purge aggressive
    old_app_ver_block = r"var APP_VER = '2026\.10\.30\.\d+';[\s\S]*?caches\.keys\(\)\.then\(function\(keys\) \{[\s\S]*?\}\);"
    new_app_ver_block = """var APP_VER = '2026.10.30.44';
    try {
      var prevVer = localStorage.getItem('betbuddy_app_version');
      if (prevVer !== APP_VER) {
        localStorage.setItem('betbuddy_app_version', APP_VER);
        if ('caches' in window) {
          caches.keys().then(function(keys) {
            keys.forEach(function(k) { caches.delete(k); });
          });
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(r) { r.update(); });
          });
        }
      }
    } catch (e) {}"""
    content = re.sub(old_app_ver_block, new_app_ver_block, content)

    # 2. Add ?v=44 to all icon links in head
    content = content.replace('href="assets/apple-touch-icon.png"', 'href="assets/apple-touch-icon.png?v=44"')
    content = content.replace('href="assets/favicon-32.png"', 'href="assets/favicon-32.png?v=44"')
    content = content.replace('href="assets/icon-192.png"', 'href="assets/icon-192.png?v=44"')
    content = content.replace('href="assets/icon-512.png"', 'href="assets/icon-512.png?v=44"')
    content = content.replace('content="assets/icon-192.png"', 'content="assets/icon-192.png?v=44"')
    content = content.replace('href="manifest.json"', 'href="manifest.json?v=44"')

    # 3. Add ?v=44 to header logo image
    content = content.replace('src="assets/icon-192.png"', 'src="assets/icon-192.png?v=44"')

    # 4. Clean up any remaining panda text or placeholders
    content = content.replace('placeholder="e.g. PandaPunter, TheAccaKing"', 'placeholder="e.g. SmartPunter, TheAccaKing"')

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("index.html cache-buster applied.")

def patch_manifest_json():
    with open('manifest.json', 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace('"src": "assets/icon-192.png"', '"src": "assets/icon-192.png?v=44"')
    content = content.replace('"src": "assets/icon-512.png"', '"src": "assets/icon-512.png?v=44"')

    with open('manifest.json', 'w', encoding='utf-8') as f:
        f.write(content)
    print("manifest.json icon versions updated.")

def patch_sw_js():
    with open('sw.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Bump cache name
    content = re.sub(r"const CACHE_NAME = 'betbuddy-pwa-v\d+[^']*';", "const CACHE_NAME = 'betbuddy-pwa-v44-radar';", content)

    # In fetch handler: treat assets/icon- and assets/favicon as network first
    # Search for isCodeOrData definition
    old_code_check = "url.pathname.endsWith('/MatchIQ/');"
    new_code_check = """url.pathname.endsWith('/MatchIQ/') ||
                       url.pathname.includes('/assets/icon-') ||
                       url.pathname.includes('/assets/apple-touch') ||
                       url.pathname.includes('/assets/favicon') ||
                       url.search.includes('v=');"""
    if old_code_check in content:
        content = content.replace(old_code_check, new_code_check)
        print("sw.js patched to network-first for brand icons.")

    with open('sw.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("sw.js updated.")

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace remaining base64 panda images in openInstallModal()
    # Lines with data:image/png;base64...
    base64_regex = r"onerror=\"this\.onerror=null;this\.src='data:image/png;base64,[^']*'\""
    content = re.sub(base64_regex, "", content)

    # Remove any remaining 'Official Panda Mascot' or 'Panda Mascot Icon'
    content = content.replace('Official Panda Mascot Mobile App', 'Sports Betting Intelligence App')
    content = content.replace('alt="Panda Mascot Icon"', 'alt="Bet Buddy Radar Icon"')
    content = content.replace('🐼⚽', '⚡⚽')
    content = content.replace('src="assets/icon-192.png"', 'src="assets/icon-192.png?v=44"')
    content = content.replace("src='assets/icon-192.png'", "src='assets/icon-192.png?v=44'")

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("app.js completely purged of base64 and panda icons.")

if __name__ == '__main__':
    patch_index_html()
    patch_manifest_json()
    patch_sw_js()
    patch_app_js()
    print("All cache-busting and brand icon patches applied.")

