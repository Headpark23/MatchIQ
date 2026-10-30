# scripts/fix_direct_app_launch.py
import re

print("Updating app.js and index.html for direct native app hand-off...")

# 1. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update version to v52
app = re.sub(r"const APP_VERSION = '[^']+';", "const APP_VERSION = 'v52';", app)

# Replace setTimeout window.open with direct window.location.href
old_open = '''  toast('⚡ Slip copied! Opening ' + bName + ' betslip...');
  setTimeout(() => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, 350);'''

new_open = '''  toast('⚡ Slip copied! Launching ' + bName + ' app...');
  // Direct location navigation triggers iOS/Android Universal Links straight into native app
  window.location.href = targetUrl;'''

if old_open in app:
    app = app.replace(old_open, new_open)
    print("Replaced popup window.open with direct window.location.href in app.js.")
else:
    print("WARNING: old_open pattern not found directly, checking regex...")
    app = re.sub(r"setTimeout\(\(\)\s*=>\s*\{\s*window\.open\(targetUrl,\s*'_blank'[^)]*\);\s*\},?\s*\d+\);", "window.location.href = targetUrl;", app)
    print("Replaced via regex.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)

# 2. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Bump version to v=52
html = html.replace('app.js?v=51', 'app.js?v=52')
html = html.replace('market_calculations.js?v=51', 'market_calculations.js?v=52')
html = html.replace('bet_builder.js?v=51', 'bet_builder.js?v=52')

# Remove target="_blank" and rel="noopener noreferrer" from bookie-choice-btn in modal
html = html.replace('target="_blank" rel="noopener noreferrer" class="bookie-choice-btn"', 'class="bookie-choice-btn"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html for v52 and native app handoff.")

# 3. Update sw.js cache name
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v52-direct-app-launch';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)
print("Updated sw.js for v52.")

