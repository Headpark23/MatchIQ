#!/usr/bin/env python3
"""
Add Gambling Affiliation Verification:
1. Method 1: <meta name="ga-site-verification" content="efAD1_u0oz693jUZ51ek49c-" /> in index.html
2. Method 2: gag0p29escioankmdh.html at root
3. Add gag0p29escioankmdh.html to build_public_dist.py allowlist
"""

# 1. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

meta_tag = '<meta name="ga-site-verification" content="efAD1_u0oz693jUZ51ek49c-">'
if 'ga-site-verification' not in html:
    html = html.replace('<meta name="description"', f'{meta_tag}\n<meta name="description"')
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Added meta tag to index.html")

# 2. Create gag0p29escioankmdh.html
verification_file_content = """<!doctype html>
<html>
<head>
<meta name="ga-site-verification" content="efAD1_u0oz693jUZ51ek49c-">
<title>Gambling Affiliation Site Verification</title>
</head>
<body>
gag0p29escioankmdh
</body>
</html>
"""
with open('gag0p29escioankmdh.html', 'w', encoding='utf-8') as f:
    f.write(verification_file_content)
print("Created gag0p29escioankmdh.html")

# 3. Update build_public_dist.py
with open('build_public_dist.py', 'r', encoding='utf-8') as f:
    bld = f.read()

if 'gag0p29escioankmdh.html' not in bld:
    bld = bld.replace('"CNAME"', '"CNAME",\n    "gag0p29escioankmdh.html"')
    with open('build_public_dist.py', 'w', encoding='utf-8') as f:
        f.write(bld)
    print("Updated build_public_dist.py allowlist")

