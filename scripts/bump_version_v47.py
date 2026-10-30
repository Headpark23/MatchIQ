with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

h = h.replace("var APP_VER = '2026.10.30.46';", "var APP_VER = '2026.10.30.47';")
h = h.replace("?v=46", "?v=47")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

with open('sw.js', 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace("const CACHE_NAME = 'betbuddy-pwa-v46-13-leagues';", "const CACHE_NAME = 'betbuddy-pwa-v47-bookie-launcher';")
s = s.replace("?v=46", "?v=47")

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(s)

print("Bumped to v47")

