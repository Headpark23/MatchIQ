import re

with open('index.html', encoding='utf-8') as f:
    html = f.read()

for m in re.finditer(r'<div[^>]*id="([^"]*modal[^"]*)"', html, re.I):
    print(m.group(1))
