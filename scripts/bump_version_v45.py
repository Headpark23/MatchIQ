with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

h = h.replace("var APP_VER = '2026.10.30.44';", "var APP_VER = '2026.10.30.45';")
h = h.replace("?v=44", "?v=45")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

with open('sw.js', 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace("const CACHE_NAME = 'betbuddy-pwa-v44-radar';", "const CACHE_NAME = 'betbuddy-pwa-v45-today-filter';")
s = s.replace("?v=44", "?v=45")

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(s)

print('Bumped version to v45 in index.html and sw.js')

