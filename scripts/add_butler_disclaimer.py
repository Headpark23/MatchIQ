#!/usr/bin/env python3
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

target = '        <div class="butler-perk-item">🔒 <strong>100% Private</strong>: No passwords or bank details ever stored. You stay in full control.</div>\n      </div>'
replacement = target + '''\n      <div class="responsible-gambling-note" style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#94a3b8;text-align:center;">\n        18+ only. Bet responsibly. <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:underline;">BeGambleAware.org</a>.\n      </div>'''

if target in text:
    text = text.replace(target, replacement)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Added responsible gambling note to butler-modal")
else:
    print("Warning: target not found in index.html")

