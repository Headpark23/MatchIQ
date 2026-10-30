import re

with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r'betbuddy-pwa-v\d+', 'betbuddy-pwa-v41', sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)

with open('index.html', 'r', encoding='utf-8') as f:
    idx = f.read()
idx = re.sub(r'\?v=\d+', '?v=41', idx)
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(idx)

with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()
app = re.sub(r"APP_VERSION = '2026\.10\.30\.\d+';", "APP_VERSION = '2026.10.30.41';", app)
app = re.sub(r"v\d+ \(Live\)", "v41 (Live)", app)
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)

print("Bumped sw.js, index.html, and app.js to v41.")

