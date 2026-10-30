# scripts/add_butler_to_builder_card.py
with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

target = "'<div class=\"slip-bookie-bar\">' +"
replacement = """'<div style="margin: 12px 0 8px;">' +
      '<button type="button" class="btn" onclick="launchButlerAcca(' + idx + ')" style="width:100%;padding:12px;font-size:14px;font-weight:700;background:linear-gradient(135deg, #0284c7, #0369a1);color:#fff;border:none;border-radius:10px;box-shadow:0 3px 12px rgba(2,132,199,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">' +
        '<span>⚡</span> 1-Tap Place with <span class="current-butler-name">' + esc(getButlerBookmaker().name) + '</span> ↗' +
      '</button>' +
    '</div>' +
    '<div class="slip-bookie-bar">' +"""

if target in app:
    app = app.replace(target, replacement, 1)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(app)
    print("Added Butler 1-tap button to builderSlipCard.")
else:
    print("Target not found.")
