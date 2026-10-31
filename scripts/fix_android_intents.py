# scripts/fix_android_intents.py
import re

print("Updating app.js with Android package intents for Coral and bookmakers...")

with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update version to v55
app = re.sub(r"const APP_VERSION = '[^']+';", "const APP_VERSION = 'v55';", app)

android_packages_def = '''
const ANDROID_PACKAGES = {
  coral: 'com.galacoral.android',
  skybet: 'com.skybet.app.skybet',
  bet365: 'com.bet365Wrapper.sportsbook',
  betfair: 'com.betfair.sports',
  ladbrokes: 'com.ladbrokes.android',
  williamhill: 'com.williamhill.sportsbook',
  paddypower: 'com.paddypower.sports'
};
'''

if 'ANDROID_PACKAGES' not in app:
    app = app.replace('const BOOKIE_APP_SCHEMES = {', android_packages_def + '\nconst BOOKIE_APP_SCHEMES = {')
    print("Added ANDROID_PACKAGES definition.")

# Update launchBookmakerSlip to handle Android specifically
old_launch_mobile = '''  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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

new_launch_mobile = '''  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid && ANDROID_PACKAGES[bookieKey]) {
    // Android Package Intent: tells Android OS to launch installed app package directly
    const pkg = ANDROID_PACKAGES[bookieKey];
    const fallback = encodeURIComponent(targetUrl);
    const intentUrl = 'intent://#Intent;package=' + pkg + ';S.browser_fallback_url=' + fallback + ';end;';
    window.location.href = intentUrl;
    return;
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const appScheme = BOOKIE_APP_SCHEMES[bookieKey];
  if (isIOS && appScheme) {
    window.location.href = appScheme;
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = targetUrl;
      }
    }, 1500);
  } else {
    window.location.href = targetUrl;
  }'''

if old_launch_mobile in app:
    app = app.replace(old_launch_mobile, new_launch_mobile)
    print("Updated launchBookmakerSlip with Android package intent.")

# Update launchButlerSingle as well
old_single_mobile = '''  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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

new_single_mobile = '''  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid && ANDROID_PACKAGES[butler.key]) {
    const pkg = ANDROID_PACKAGES[butler.key];
    const fallback = encodeURIComponent(targetUrl);
    const intentUrl = 'intent://#Intent;package=' + pkg + ';S.browser_fallback_url=' + fallback + ';end;';
    window.location.href = intentUrl;
    return;
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const appScheme = BOOKIE_APP_SCHEMES[butler.key];
  if (isIOS && appScheme) {
    window.location.href = appScheme;
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = targetUrl;
      }
    }, 1500);
  } else {
    window.location.href = targetUrl;
  }'''

if old_single_mobile in app:
    app = app.replace(old_single_mobile, new_single_mobile)
    print("Updated launchButlerSingle with Android package intent.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)

# Update index.html and sw.js
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = html.replace('app.js?v=54', 'app.js?v=55')
html = html.replace('market_calculations.js?v=54', 'market_calculations.js?v=55')
html = html.replace('bet_builder.js?v=54', 'bet_builder.js?v=55')
html = html.replace('styles.css?v=54', 'styles.css?v=55')
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v55-android-package-intents';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)

print("Updated index.html, sw.js, and app.js for v55 successfully.")

