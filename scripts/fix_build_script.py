with open('build_public_dist.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix the accidental replacement in build_public_dist.py
bad = '''            if fname == "CNAME",
    "gag0p29escioankmdh.html":
                continue'''

good = '''            if fname in {"CNAME", "gag0p29escioankmdh.html"}:
                continue'''

c = c.replace(bad, good)

with open('build_public_dist.py', 'w', encoding='utf-8') as f:
    f.write(c)

print("Fixed build_public_dist.py")

