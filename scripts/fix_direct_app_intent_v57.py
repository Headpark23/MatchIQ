# scripts/fix_direct_app_intent_v57.py
import re

print("Updating app.js with direct HTTPS Android Intent to skip Google Play...")

with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update version to v57
app = re.sub(r"const APP_VERSION = '[^']+';", "const APP_VERSION = 'v57';", app)

# Replace getButlerLaunchUrl and getButlerLaunchSingleUrl
old_helpers = '''function getButlerLaunchUrl(slipIdx) {
  const butler = getButlerBookmaker();
  const isAndroid = /Android/i.test(navigator.userAgent);
  const pkg = ANDROID_PACKAGES[butler.key];
  if (isAndroid && pkg) {
    return 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=' + pkg + ';end;';
  }
  const query = getBookieSearchQuery({ legs: slipIdx === 'custom' ? customAccaLegs : (builderResult && builderResult.slips && builderResult.slips[+slipIdx] ? builderResult.slips[+slipIdx].legs : []) });
  const links = getBookieDeepLinks(query);
  return links[butler.key] || butler.appUrl + encodeURIComponent(query);
}

function getButlerLaunchSingleUrl(betData) {
  const butler = getButlerBookmaker();
  const isAndroid = /Android/i.test(navigator.userAgent);
  const pkg = ANDROID_PACKAGES[butler.key];
  if (isAndroid && pkg) {
    return 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=' + pkg + ';end;';
  }
  const query = getBookieSearchQuery(betData);
  const links = getBookieDeepLinks(query);
  return links[butler.key] || butler.appUrl + encodeURIComponent(query);
}'''

new_helpers = '''function getButlerLaunchUrl(slipIdx) {
  const butler = getButlerBookmaker();
  const isAndroid = /Android/i.test(navigator.userAgent);
  const pkg = ANDROID_PACKAGES[butler.key];
  const query = getBookieSearchQuery({ legs: slipIdx === 'custom' ? customAccaLegs : (builderResult && builderResult.slips && builderResult.slips[+slipIdx] ? builderResult.slips[+slipIdx].legs : []) });
  const links = getBookieDeepLinks(query);
  const targetUrl = links[butler.key] || butler.appUrl + encodeURIComponent(query);

  if (isAndroid && pkg) {
    const hostAndPath = targetUrl.replace(/^https?:\\/\\//, '');
    return 'intent://' + hostAndPath + '#Intent;scheme=https;package=' + pkg + ';end;';
  }
  return targetUrl;
}

function getButlerLaunchSingleUrl(betData) {
  const butler = getButlerBookmaker();
  const isAndroid = /Android/i.test(navigator.userAgent);
  const pkg = ANDROID_PACKAGES[butler.key];
  const query = getBookieSearchQuery(betData);
  const links = getBookieDeepLinks(query);
  const targetUrl = links[butler.key] || butler.appUrl + encodeURIComponent(query);

  if (isAndroid && pkg) {
    const hostAndPath = targetUrl.replace(/^https?:\\/\\//, '');
    return 'intent://' + hostAndPath + '#Intent;scheme=https;package=' + pkg + ';end;';
  }
  return targetUrl;
}'''

if old_helpers in app:
    app = app.replace(old_helpers, new_helpers)
    print("Replaced getButlerLaunchUrl and getButlerLaunchSingleUrl with direct HTTPS intent.")
else:
    print("WARNING: old_helpers block not exact match, check app.js.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)

# Update index.html and sw.js
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = html.replace('app.js?v=56', 'app.js?v=57')
html = html.replace('market_calculations.js?v=56', 'market_calculations.js?v=57')
html = html.replace('bet_builder.js?v=56', 'bet_builder.js?v=57')
html = html.replace('styles.css?v=56', 'styles.css?v=57')
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v57-direct-app-intent';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)

print("Updated index.html, sw.js, and app.js for v57 successfully.")

