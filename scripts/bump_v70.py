with open('sw.js', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('betbuddy-pwa-v69', 'betbuddy-pwa-v70').replace('(v69)', '(v70)')
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(text)

with open('app.js', 'r', encoding='utf-8') as f:
    text2 = f.read()
text2 = text2.replace("const APP_VERSION = 'v69';", "const APP_VERSION = 'v70';")
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text2)

print("Bumped version to v70 in sw.js and app.js")

