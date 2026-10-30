# scripts/fix_native_app_schemes.py
import re

print("Updating app.js with native app URI schemes and Coral AASA path...")

with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update version to v54
app = re.sub(r"const APP_VERSION = '[^']+';", "const APP_VERSION = 'v54';", app)

# Define BOOKIE_APP_SCHEMES
schemes_block = '''
const BOOKIE_APP_SCHEMES = {
  coral: 'coral://',
  skybet: 'skybet://',
  bet365: 'bet365://',
  betfair: 'betfair://',
  ladbrokes: 'ladbrokes://',
  paddypower: 'paddypower://',
  williamhill: 'williamhill://'
};
'''

if 'BOOKIE_APP_SCHEMES' not in app:
    app = app.replace('function getBookieDeepLinks(query) {', schemes_block + '\nfunction getBookieDeepLinks(query) {')
    print("Added BOOKIE_APP_SCHEMES definition.")

# Update getBookieDeepLinks to use www.coral.co.uk/en/sportsapp
app = app.replace("coral: 'https://sports.coral.co.uk/search?q=' + enc,", "coral: 'https://www.coral.co.uk/en/sportsapp/search?q=' + enc,")

# Update launchBookmakerSlip to trigger native app scheme on mobile
old_launch_nav = '''  toast('⚡ Slip copied! Launching ' + bName + ' app...');
  // Direct location navigation triggers iOS/Android Universal Links straight into native app
  window.location.href = targetUrl;'''

new_launch_nav = '''  toast('⚡ Slip copied! Launching ' + bName + ' app...');
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const appScheme = BOOKIE_APP_SCHEMES[bookieKey];
  
  if (isMobile && appScheme) {
    // 1. Try native installed app URI scheme directly (e.g. coral://) - opens logged-in native app
    window.location.href = appScheme;
    // 2. Fallback to web link if app is not installed
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = targetUrl;
      }
    }, 1200);
  } else {
    window.location.href = targetUrl;
  }'''

if old_launch_nav in app:
    app = app.replace(old_launch_nav, new_launch_nav)
    print("Updated launchBookmakerSlip with native scheme handoff.")

# Update launchButlerSingle as well
old_butler_single_nav = '''  const query = getBookieSearchQuery(betData);
  const links = getBookieDeepLinks(query);
  const targetUrl = links[butler.key] || butler.appUrl + encodeURIComponent(query);
  window.location.href = targetUrl;'''

new_butler_single_nav = '''  const query = getBookieSearchQuery(betData);
  const links = getBookieDeepLinks(query);
  const targetUrl = links[butler.key] || butler.appUrl + encodeURIComponent(query);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const appScheme = BOOKIE_APP_SCHEMES[butler.key];
  
  if (isMobile && appScheme) {
    window.location.href = appScheme;
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = targetUrl;
      }
    }, 1200);
  } else {
    window.location.href = targetUrl;
  }'''

if old_butler_single_nav in app:
    app = app.replace(old_butler_single_nav, new_butler_single_nav)
    print("Updated launchButlerSingle with native scheme handoff.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)

# Update index.html and sw.js
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = html.replace('app.js?v=53', 'app.js?v=54')
html = html.replace('market_calculations.js?v=53', 'market_calculations.js?v=54')
html = html.replace('bet_builder.js?v=53', 'bet_builder.js?v=54')
html = html.replace('styles.css?v=53', 'styles.css?v=54')
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v54-native-app-schemes';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)

print("Updated index.html, sw.js, and app.js for v54 successfully.")
