#!/usr/bin/env python3
# Bump to v58

# 1. sw.js
with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = sw.replace("'betbuddy-pwa-v57-direct-app-intent'", "'betbuddy-pwa-v58-audit-fixes'")
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)
print("Updated sw.js to v58")

# 2. app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()
app = app.replace("const APP_VERSION = 'v57';", "const APP_VERSION = 'v58';")
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)
print("Updated app.js to v58")

# 3. index.html
with open('index.html', 'r', encoding='utf-8') as f:
    idx = f.read()
idx = idx.replace('styles.css?v=57', 'styles.css?v=58')
idx = idx.replace('market_calculations.js?v=57', 'market_calculations.js?v=58')
idx = idx.replace('bet_builder.js?v=57', 'bet_builder.js?v=58')
idx = idx.replace('app.js?v=57', 'app.js?v=58')
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(idx)
print("Updated index.html to v58")
