with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

affiliate_and_bookie_code = '''// ------------------------------------------------------------ Commercial & Affiliate Tracking
const AFFILIATE_TRACKING_KEY = 'betbuddy_affiliate_clicks_v1';
let currentBookieSelection = null;

function getAffiliateClicks() {
  try {
    const list = JSON.parse(localStorage.getItem(AFFILIATE_TRACKING_KEY) || '[]');
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (e) { /* ignore */ }
  return [
    { bookie: 'Bet365', selection: 'Arsenal Win', odds: '8/13', time: new Date(Date.now() - 3600000*2).toISOString() },
    { bookie: 'Sky Bet', selection: '4-Fold Weekend Acca', odds: '12/1', time: new Date(Date.now() - 3600000*8).toISOString() },
    { bookie: 'Paddy Power', selection: 'Over 2.5 Goals', odds: '4/5', time: new Date(Date.now() - 3600000*14).toISOString() }
  ];
}

function logAffiliateClick(bookie) {
  const list = getAffiliateClicks();
  const entry = {
    bookie,
    selection: currentBookieSelection ? currentBookieSelection.selection : 'Bet Slip',
    odds: currentBookieSelection ? currentBookieSelection.fair || 'Live' : 'Acca',
    time: new Date().toISOString()
  };
  list.unshift(entry);
  try { localStorage.setItem(AFFILIATE_TRACKING_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* ignore */ }
}

function openBookieModal(betData) {
  currentBookieSelection = betData || { selection: 'Bet Buddy Selection', fair: 'Best Price' };
  const modal = $('bookie-modal');
  if (!modal) return;
  const labelEl = $('bookie-bet-label');
  const oddsEl = $('bookie-bet-odds');
  if (labelEl) labelEl.textContent = currentBookieSelection.selection;
  if (oddsEl) oddsEl.textContent = currentBookieSelection.fair ? 'Odds: ' + currentBookieSelection.fair : '';
  
  const copyStr = currentBookieSelection.selection + (currentBookieSelection.fair ? ' @ ' + currentBookieSelection.fair : '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copyStr).catch(() => {});
  }
  modal.hidden = false;
}

function closeBookieModal() {
  const modal = $('bookie-modal');
  if (modal) modal.hidden = true;
}

'''

target = 'const DEFAULT_DAILY_HISTORY = ['
assert target in text, 'target not found'
text = text.replace(target, affiliate_and_bookie_code + target, 1)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Added affiliate and bookie functions to app.js')

