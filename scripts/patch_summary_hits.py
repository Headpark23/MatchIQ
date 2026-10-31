from pathlib import Path

path = Path('pipeline/history.py')
text = path.read_text(encoding='utf-8')
old = 'return {"n": len(rows), "brier":'
new = 'hits = sum(1 for x in rows if x.get("won"))\n        return {"n": len(rows), "hits": hits, "brier":'
assert old in text, 'old text not found'
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print("Successfully patched pipeline/history.py")

