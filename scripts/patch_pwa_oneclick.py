# Python patch script for PWA 1-Click Install and Panda Logo Icon on Mobile

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add mobile web app meta tags to head
old_meta = '<meta name="apple-mobile-web-app-title" content="Bet Buddy">'
new_meta = '<meta name="apple-mobile-web-app-title" content="Bet Buddy">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="msapplication-TileColor" content="#060d19">\n<meta name="msapplication-TileImage" content="assets/icon-192.png">'
assert old_meta in html, 'old_meta not found'
html = html.replace(old_meta, new_meta, 1)

# 2. Update brand logo to use Panda icon image
old_brand = '''    <a class="brand" href="#/" aria-label="Bet Buddy home">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="5.5" cy="6" r="3.2" fill="#04140d"/><circle cx="18.5" cy="6" r="3.2" fill="#04140d"/><circle cx="5.5" cy="6" r="1.3" fill="#a7f3d0"/><circle cx="18.5" cy="6" r="1.3" fill="#a7f3d0"/><circle cx="12" cy="13.2" r="7.8" fill="#ffffff"/><ellipse cx="8.8" cy="12.6" rx="2.2" ry="2.9" fill="#04140d" transform="rotate(-15 8.8 12.6)"/><ellipse cx="15.2" cy="12.6" rx="2.2" ry="2.9" fill="#04140d" transform="rotate(15 15.2 12.6)"/><circle cx="8.6" cy="12" r="0.8" fill="#a7f3d0"/><circle cx="15.4" cy="12" r="0.8" fill="#a7f3d0"/><ellipse cx="12" cy="15.2" rx="1.3" ry="0.9" fill="#04140d"/><path d="M10.7 16.5c.7.5 1.9.5 2.6 0" fill="none" stroke="#04140d" stroke-width="0.8" stroke-linecap="round"/></svg></span>
      <span class="brand-word">Bet<b>Buddy</b></span>
    </a>'''

new_brand = '''    <a class="brand" href="#/" aria-label="Bet Buddy home">
      <img src="assets/icon-192.png" width="34" height="34" alt="Bet Buddy Panda Mascot" class="brand-panda-img">
      <span class="brand-word">Bet<b>Buddy</b></span>
    </a>'''

assert old_brand in html, 'old_brand not found'
html = html.replace(old_brand, new_brand, 1)

# 3. Update header install button
old_install_btn = '''      <button type="button" class="pwa-install-btn" id="header-install-btn" title="Download Bet Buddy to home screen" aria-label="Install App">
        <svg class="install-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span class="install-label">Install</span>
      </button>'''

new_install_btn = '''      <button type="button" class="pwa-install-btn" id="header-install-btn" title="Download Bet Buddy to phone / tablet" aria-label="Download App">
        <span class="install-panda-emoji" style="font-size:15px">🐼</span>
        <span class="install-label">Download App</span>
      </button>'''

assert old_install_btn in html, 'old_install_btn not found'
html = html.replace(old_install_btn, new_install_btn, 1)

with open('index.html', 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)

print('Updated index.html with panda mascot logo and 1-click download button')
