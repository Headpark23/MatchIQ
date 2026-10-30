with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

h = h.replace("var APP_VER = '2026.10.30.45';", "var APP_VER = '2026.10.30.46';")
h = h.replace("?v=45", "?v=46")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

with open('sw.js', 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace("const CACHE_NAME = 'betbuddy-pwa-v45-today-filter';", "const CACHE_NAME = 'betbuddy-pwa-v46-13-leagues';")
s = s.replace("?v=45", "?v=46")

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(s)

print("Bumped to v46")
