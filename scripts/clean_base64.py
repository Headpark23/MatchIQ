import re

with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace any onerror with base64 data:image
c = re.sub(r'onerror="this\.onerror=null;this\.src=\\\'data:image/png;base64,[^\']*\\\'"', '', c)
c = re.sub(r'onerror="this\.onerror=null;this\.src=\'data:image/png;base64,[^\']*\'"', '', c)
c = c.replace('Bet Buddy - Panda Mobile App', 'Bet Buddy Mobile App')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("Base64 panda strings purged from app.js")

