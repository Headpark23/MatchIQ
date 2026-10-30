with open('build_public_dist.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '"vercel.json"'
replacement = '"vercel.json",\n    "CNAME"'
text = text.replace(target, replacement)

with open('build_public_dist.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated build_public_dist.py with CNAME in allowlist')
