# patch_html_cache_buster.py
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('styles.css?v=33', 'styles.css?v=38')
html = html.replace('market_calculations.js?v=33', 'market_calculations.js?v=38')
html = html.replace('bet_builder.js?v=33', 'bet_builder.js?v=38')
html = html.replace('app.js?v=33', 'app.js?v=38')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Updated index.html asset cache-busters to v38')

