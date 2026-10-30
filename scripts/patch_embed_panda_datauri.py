"""Embed Panda mascot icon as fallback and inline data URI so it ALWAYS renders even if external image requests fail or are blocked by browser cache.
"""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Read icon-192.png
icon_path = ROOT / "assets" / "icon-192.png"
b64_data = base64.b64encode(icon_path.read_bytes()).decode("ascii")
data_uri = f"data:image/png;base64,{b64_data}"

# 1. Update index.html
index_path = ROOT / "index.html"
index_html = index_path.read_text(encoding="utf-8")

# Brand panda img fallback
old_brand = '<img src="assets/icon-192.png" width="34" height="34" alt="Bet Buddy Panda Mascot" class="brand-panda-img">'
new_brand = f'<img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\'{data_uri}\'" width="34" height="34" alt="Bet Buddy Panda Mascot" class="brand-panda-img">'

# Modal head badge img fallback
old_modal_img = '<img src="assets/icon-192.png" alt="Bet Buddy Panda Football Icon" width="38" height="38" class="install-logo-thumb">'
new_modal_img = f'<img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\'{data_uri}\'" alt="Bet Buddy Panda Football Icon" width="38" height="38" class="install-logo-thumb">'

assert old_brand in index_html, "old_brand not found in index.html"
index_html = index_html.replace(old_brand, new_brand, 1)

assert old_modal_img in index_html, "old_modal_img not found in index.html"
index_html = index_html.replace(old_modal_img, new_modal_img, 1)

index_path.write_text(index_html, encoding="utf-8")
print("Updated index.html with inline data_uri fallbacks!")

# 2. Update app.js
app_path = ROOT / "app.js"
app_js = app_path.read_text(encoding="utf-8")

# Welcome hero avatar
old_hero_img = '\'<img src="assets/icon-192.png" alt="Bet Buddy Mascot" width="76" height="76">\' +'
new_hero_img = f'\'<img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\\\'{data_uri}\\\'" alt="Bet Buddy Mascot" width="76" height="76">\' +'

# Install modal dynamic preview images in app.js
old_modal_dyn1 = '\'<div class="install-badge-preview" style="margin-bottom:16px"><img src="assets/icon-192.png" width="56" height="56" style="border-radius:12px;box-shadow:0 0 16px rgba(16,185,129,0.4)" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:16px">Bet Buddy</strong><span class="text-sm muted">Official Panda Mascot Mobile App</span></div></div>\' +'
new_modal_dyn1 = f'\'<div class="install-badge-preview" style="margin-bottom:16px"><img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\\\'{data_uri}\\\'" width="56" height="56" style="border-radius:12px;box-shadow:0 0 16px rgba(16,185,129,0.4)" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:16px">Bet Buddy</strong><span class="text-sm muted">Official Panda Mascot Mobile App</span></div></div>\' +'

old_modal_dyn2 = '\'<div class="install-badge-preview" style="margin-bottom:14px"><img src="assets/icon-192.png" width="52" height="52" style="border-radius:12px" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:15px">Bet Buddy — Panda Mobile App</strong><span class="text-sm muted">Instant launch from your home screen</span></div></div>\' +'
new_modal_dyn2 = f'\'<div class="install-badge-preview" style="margin-bottom:14px"><img src="assets/icon-192.png" onerror="this.onerror=null;this.src=\\\'{data_uri}\\\'" width="52" height="52" style="border-radius:12px" alt="Panda Mascot Icon"><div><strong style="color:#fff;display:block;font-size:15px">Bet Buddy — Panda Mobile App</strong><span class="text-sm muted">Instant launch from your home screen</span></div></div>\' +'

assert old_hero_img in app_js, "old_hero_img not found in app.js"
app_js = app_js.replace(old_hero_img, new_hero_img, 1)

assert old_modal_dyn1 in app_js, "old_modal_dyn1 not found in app.js"
app_js = app_js.replace(old_modal_dyn1, new_modal_dyn1, 1)

assert old_modal_dyn2 in app_js, "old_modal_dyn2 not found in app.js"
app_js = app_js.replace(old_modal_dyn2, new_modal_dyn2, 1)

app_path.write_text(app_js, encoding="utf-8")
print("Updated app.js with inline data_uri fallbacks!")
