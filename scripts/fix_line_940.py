with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

bad = "'<a href=\"' + esc(getButlerLaunchUrl('custom')) + '\" class=\"btn primary butler-acca-launch-btn\" onclick=\"prepareButlerLaunch('custom')\""
good = "'<a href=\"' + esc(getButlerLaunchUrl('custom')) + '\" class=\"btn primary butler-acca-launch-btn\" onclick=\"prepareButlerLaunch(this.dataset.slipIdx)\" data-slip-idx=\"custom\""

if bad in text:
    text = text.replace(bad, good)
    print("Fixed line 940 with data-slip-idx.")
else:
    import re
    text = re.sub(r"'<a href=\"'\s*\+\s*esc\(getButlerLaunchUrl\('custom'\)\)\s*\+\s*'\" class=\"btn primary butler-acca-launch-btn\" onclick=\"prepareButlerLaunch\([^)]+\)\"", good, text)
    print("Regex fixed line 940.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)
