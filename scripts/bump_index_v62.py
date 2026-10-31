from pathlib import Path
import re
p = Path('index.html')
txt = p.read_text(encoding='utf-8')
txt = txt.replace('id="footer-app-version" style="color:var(--cyan)">v61<', 'id="footer-app-version" style="color:var(--cyan)">v62<')
p.write_text(txt, encoding='utf-8')
print('Bumped index.html to v62')

