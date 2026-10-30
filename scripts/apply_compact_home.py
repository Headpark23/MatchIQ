import re

with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

with open('scripts/patch_compact_homepage.py', 'r', encoding='utf-8') as f:
    patch_text = f.read()

m = re.search(r'new_render_welcome = """(.*?)"""', patch_text, re.DOTALL)
if not m:
    raise SystemExit('Could not find new_render_welcome in patch script')

new_welcome_code = m.group(1).strip()

start_idx = app_text.find('function renderWelcomeHero() {')
scroll_idx = app_text.find('function scrollToBuilder() {')

if start_idx == -1 or scroll_idx == -1:
    raise SystemExit('Indices not found in app.js')

print(f"Replacing renderWelcomeHero: {start_idx} to {scroll_idx}")

updated_app = app_text[:start_idx] + new_welcome_code + '\n\n' + app_text[scroll_idx:]

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(updated_app)

print("Successfully replaced renderWelcomeHero in app.js!")

