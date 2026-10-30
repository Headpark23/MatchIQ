with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

h = h.replace("var APP_VER = '2026.10.30.49';", "var APP_VER = '2026.10.30.50';")
h = h.replace("?v=49", "?v=50")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

with open('sw.js', 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace("const CACHE_NAME = 'betbuddy-pwa-v49-verified-data-only';", "const CACHE_NAME = 'betbuddy-pwa-v50-strict-future-kickoff';")
s = s.replace("?v=49", "?v=50")

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(s)

print("Bumped version to v50 in index.html and sw.js")

