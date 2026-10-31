from pathlib import Path
import re
p = Path('sw.js')
txt = p.read_text(encoding='utf-8')
txt = re.sub(r"const CACHE_NAME = 'betbuddy-[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v61';", txt)
p.write_text(txt, encoding='utf-8')
print('Bumped sw.js to betbuddy-pwa-v61')

