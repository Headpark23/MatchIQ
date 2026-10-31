# scripts/fix_android_native_anchors.py
import re

print("Updating app.js with real native anchor tags and ACTION_MAIN launcher intent...")

with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

# Update version to v56
app = re.sub(r"const APP_VERSION = '[^']+';", "const APP_VERSION = 'v56';", app)

# Helper function to generate Android Intent or web URL
helpers = '''
function getButlerLaunchUrl(slipIdx) {
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
}

function prepareButlerLaunch(slipIdx) {
  const r = builderResult;
  let slip = null;
  if (slipIdx === 'custom') {
    if (customAccaLegs.length === 0) return;
    const stake = (builderState && builderState.stake) || 10;
    const odds = customAccaLegs.reduce((t, l) => t * (l.odds || 2.0), 1);
    slip = { legs: customAccaLegs, stake, odds, ret: stake * odds };
  } else {
    slip = r && r.slips && r.slips[+slipIdx];
  }
  if (!slip) return;
  const butler = getButlerBookmaker();
  trackBookieLaunch(butler.name, slip);

  const textLines = [
    '🎯 Bet Buddy ' + slip.legs.length + '-Leg Acca (' + fmtOdds(slip.odds) + ')',
    ...slip.legs.map((l, i) => (i + 1) + '. ' + l.fixture.home + ' v ' + l.fixture.away + ': ' + l.label + ' (' + (l.fractional || fmtOdds(l.odds)) + ')'),
    'Stake: £' + slip.stake + ' · Target Return: £' + (slip.ret ? slip.ret.toFixed(2) : (slip.stake * slip.odds).toFixed(2))
  ];
  const copyStr = textLines.join('\\n');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyStr).catch(() => {});
    }
  } catch (e) {}
  toast('⚡ Slip copied! Launching ' + butler.name + ' app...');
}

function prepareButlerSingleLaunch(dataStr) {
  try {
    const betData = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
    const butler = getButlerBookmaker();
    let copyStr = betData.selection || 'Football Bet';
    if (betData.fair) copyStr += ' @ ' + betData.fair;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyStr).catch(() => {});
      }
    } catch (e) {}
    trackBookieLaunch(butler.name, betData);
    toast('⚡ Copied to clipboard! Launching ' + butler.name + ' app...');
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.getButlerLaunchUrl = getButlerLaunchUrl;
  window.getButlerLaunchSingleUrl = getButlerLaunchSingleUrl;
  window.prepareButlerLaunch = prepareButlerLaunch;
  window.prepareButlerSingleLaunch = prepareButlerSingleLaunch;
}
'''

if 'getButlerLaunchUrl' not in app:
    app = app.replace('function launchButlerAcca(slipIdx) {', helpers + '\nfunction launchButlerAcca(slipIdx) {')
    print("Added getButlerLaunchUrl and prepareButlerLaunch helpers.")

# Replace button in customAccaCard with native <a> anchor tag
old_custom_btn = '\'<button type="button" class="btn primary butler-acca-launch-btn" onclick="launchButlerAcca(\\\'custom\\\')"'
new_custom_btn = '\'<a href="\' + esc(getButlerLaunchUrl(\\\'custom\\\')) + \'" class="btn primary butler-acca-launch-btn" onclick="prepareButlerLaunch(\\\'custom\\\')"'

if old_custom_btn in app:
    app = app.replace(old_custom_btn, new_custom_btn)
    # also replace closing tag </button> with </a> for this element
    # let's check the exact line in customAccaCard
    print("Replaced customAcca button with native anchor tag.")

# Replace button in builderSlipCard with native <a> anchor tag
old_builder_btn = '\'<button type="button" class="btn" onclick="launchButlerAcca(\' + idx + \')"'
new_builder_btn = '\'<a href="\' + esc(getButlerLaunchUrl(idx)) + \'" class="btn" onclick="prepareButlerLaunch(\' + idx + \')"'

if old_builder_btn in app:
    app = app.replace(old_builder_btn, new_builder_btn)
    print("Replaced builderSlipCard button with native anchor tag.")

# Fix any mismatched </button> where we changed to <a>
app = app.replace("(Your Butler) ↗' +\n      '</button>'", "(Your Butler) ↗' +\n      '</a>'")
app = app.replace("</span> ↗' +\n      '</button>' +\n    '</div>' +\n    '<div class=\"slip-bookie-bar\">'", "</span> ↗' +\n      '</a>' +\n    '</div>' +\n    '<div class=\"slip-bookie-bar\">'")

# Replace marketCard button with native <a> tag
old_single_btn = '\'<button type="button" class="btn-place-bet-inline butler-btn" data-launch-butler-single=\\\'\''
new_single_btn = '\'<a href="\' + esc(getButlerLaunchSingleUrl({ id: ctx.id, market: meta.diary, selection: selText, p: row.p, fair: row.fair })) + \'" class="btn-place-bet-inline butler-btn" onclick="prepareButlerSingleLaunch(\\\'\' + jsonStr + \'\\\')"\''

if old_single_btn in app:
    app = app.replace(old_single_btn, new_single_btn)
    app = app.replace("title=\"Launch with your Bet Butler\">Place at <span class=\"current-butler-name\">Coral</span> ↗</button>'", "title=\"Launch with your Bet Butler\">Place at <span class=\"current-butler-name\">Coral</span> ↗</a>'")
    print("Replaced marketCard button with native anchor tag.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app)

# Update index.html and sw.js
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = html.replace('app.js?v=55', 'app.js?v=56')
html = html.replace('market_calculations.js?v=55', 'market_calculations.js?v=56')
html = html.replace('bet_builder.js?v=55', 'bet_builder.js?v=56')
html = html.replace('styles.css?v=55', 'styles.css?v=56')
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('sw.js', 'r', encoding='utf-8') as f:
    sw = f.read()
sw = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'betbuddy-pwa-v56-android-native-anchors';", sw)
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)

print("Updated index.html, sw.js, and app.js for v56 successfully.")

