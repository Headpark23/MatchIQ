with open('sw.js', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('betbuddy-pwa-v68', 'betbuddy-pwa-v69').replace('(v64)', '(v69)')
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(text)

with open('app.js', 'r', encoding='utf-8') as f:
    text2 = f.read()
text2 = text2.replace("const APP_VERSION = 'v68';", "const APP_VERSION = 'v69';")
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text2)

print("Bumped version to v69 in sw.js and app.js")
