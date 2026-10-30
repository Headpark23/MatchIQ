with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

h = h.replace("var APP_VER = '2026.10.30.48';", "var APP_VER = '2026.10.30.49';")
h = h.replace("?v=48", "?v=49")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

with open('sw.js', 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace("const CACHE_NAME = 'betbuddy-pwa-v48-all-leagues-fixtures';", "const CACHE_NAME = 'betbuddy-pwa-v49-verified-data-only';")
s = s.replace("?v=48", "?v=49")

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(s)

print("Bumped version to v49 in index.html and sw.js")

