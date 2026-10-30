with open('build_public_dist.py', 'r', encoding='utf-8') as f:
    text = f.read()

old = '''    # 1. Root files
    for fname in ALLOWLIST_FILES:
        src = ROOT / fname
        if not src.exists():
            raise FileNotFoundError(f"Missing required public file: {fname}")
        shutil.copy2(src, DIST / fname)
        copied.append(fname)'''

new = '''    # 1. Root files
    for fname in ALLOWLIST_FILES:
        src = ROOT / fname
        if not src.exists():
            if fname == "CNAME":
                continue
            raise FileNotFoundError(f"Missing required public file: {fname}")
        shutil.copy2(src, DIST / fname)
        copied.append(fname)'''

assert old in text, 'old not found'
text = text.replace(old, new)
with open('build_public_dist.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)
print('Patched build_public_dist.py successfully')

