from pathlib import Path
import re

app_p = Path('app.js')
app_txt = app_p.read_text(encoding='utf-8')
app_txt = re.sub(r"const APP_VERSION = 'v\d+';", "const APP_VERSION = 'v60';", app_txt)
app_p.write_text(app_txt, encoding='utf-8')

sw_p = Path('sw.js')
sw_txt = sw_p.read_text(encoding='utf-8')
sw_txt = re.sub(r"const CACHE_NAME = 'betbuddy-[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v60';", sw_txt)
sw_p.write_text(sw_txt, encoding='utf-8')
print('Bumped to v60 in app.js and sw.js')

