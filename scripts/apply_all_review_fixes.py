"""Apply all 6 ChatGPT and Claude review recommendations across app.js, index.html, styles.css, sw.js.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent

def patch_app_js():
    path = ROOT / 'app.js'
    code = path.read_text(encoding='utf-8')

    # 1. Update app version to v77
    code = code.replace("const APP_VERSION = 'v76';", "const APP_VERSION = 'v77';")

    # 2. Fix getTodayBestValuePicks: strict model evidence validation and honest no-value state
    old_get_bv = """function getTodayBestValuePicks() {
  const preds = predictionsList();
  if (!preds || !preds.length) return null;
  const pool = MatchIQBuilder.legPool(preds, {
    calc,
    reliability: DATA.reliability,
    feedFor,
    nowMs: Date.now(),
    timing: 'all'
  });
  if (!pool || !pool.length) return null;

  const withEv = pool.map(leg => {
    const ev = (leg.odds * leg.p) - 1;
    return { ...leg, ev };
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPool = withEv.filter(l => l.fixture && l.fixture.kickoff_utc && l.fixture.kickoff_utc.slice(0, 10) === todayStr);
  const candidatePool = todayPool.length >= 4 ? todayPool : withEv;
  candidatePool.sort((a, b) => b.ev - a.ev);

  const unique = [];
  const seenMatches = new Set();
  for (const leg of candidatePool) {
    if (!seenMatches.has(leg.matchId)) {
      seenMatches.add(leg.matchId);
      unique.push(leg);
      if (unique.length === 4) break;
    }
  }
  if (!unique.length) return null;"""

    new_get_bv = """function getTodayBestValuePicks() {
  const preds = predictionsList();
  if (!preds || !preds.length) return null;
  const pool = MatchIQBuilder.legPool(preds, {
    calc,
    reliability: DATA.reliability,
    feedFor,
    nowMs: Date.now(),
    timing: 'all'
  });
  if (!pool || !pool.length) return null;

  // STRICT EVIDENCE GATE: Pick MUST have validated model evidence and live bookmaker price
  const qualified = pool.filter(leg => {
    const isValidated = leg.support === 'validated' || (leg.evidence && leg.evidence.status === 'validated');
    const isLive = leg.priceSource === 'live';
    const ev = (Number(leg.odds) * Number(leg.p)) - 1;
    return isValidated && isLive && ev >= 0.05;
  }).map(leg => {
    const ev = (Number(leg.odds) * Number(leg.p)) - 1;
    return { ...leg, ev };
  });

  if (!qualified.length) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPool = qualified.filter(l => l.fixture && l.fixture.kickoff_utc && l.fixture.kickoff_utc.slice(0, 10) === todayStr);
  const candidatePool = todayPool.length >= 1 ? todayPool : qualified;
  candidatePool.sort((a, b) => b.ev - a.ev);

  const unique = [];
  const seenMatches = new Set();
  for (const leg of candidatePool) {
    if (!seenMatches.has(leg.matchId)) {
      seenMatches.add(leg.matchId);
      unique.push(leg);
      if (unique.length === 4) break;
    }
  }
  if (!unique.length) return null;"""

    if old_get_bv in code:
        code = code.replace(old_get_bv, new_get_bv, 1)

    # 3. Honest No-Value state in Best Value Modal
    old_bv_modal_empty = """  if (!data) {
    body.innerHTML = '<div class="empty" style="padding:24px;text-align:center;">No upcoming fixtures with live bookmaker prices currently available. Check back soon.</div>';
    return;
  }"""

    new_bv_modal_empty = """  if (!data) {
    body.innerHTML = '<div class="empty" style="padding:32px 20px;text-align:center;">' +
      '<div style="font-size:36px;margin-bottom:12px;">⚖️</div>' +
      '<h3 style="font-size:18px;font-weight:700;margin-bottom:8px;color:#fff;">No Value Bets Qualify Today</h3>' +
      '<p class="muted" style="font-size:14px;max-width:440px;margin:0 auto 16px;line-height:1.5;">Bet Buddy requires backtested model evidence and at least +5% expected value before recommending any bet. No live bookmaker price currently clears our evidence threshold.</p>' +
      '<a href="#/picks" class="btn primary" onclick="closeBestValueModal()" style="display:inline-block;padding:8px 18px;font-size:14px;">Build Acca with Most Likely Picks ↗</a>' +
    '</div>';
    return;
  }"""

    if old_bv_modal_empty in code:
        code = code.replace(old_bv_modal_empty, new_bv_modal_empty, 1)

    # 4. Match verdict: replace full matchVerdictCard
    idx_start = code.find('function matchVerdictCard(pred) {')
    idx_end = code.find('function viewMatch(id) {')
    assert idx_start != -1 and idx_end != -1, "matchVerdictCard function bounds not found"

    new_match_verdict_fn = """function matchVerdictCard(pred) {
  if (!pred) return '';
  const sels = allSelections(pred), prices = pricesFor(pred.match_id);
  const best = calc.bestValue(pred, prices, matchIQBands());
  const sel = sels.find(s => s.id === prices._selected) || (best && best.sel) || sels.find(s => s.id === 'result:' + pred.markets.result.pick.key) || sels[0];
  if (!sel) return '';
  const siblings = sels.filter(s => s.group === sel.group && s.id !== sel.id);
  const verdict = valueVerdict(sel, prices[sel.id], siblings, prices);
  const v = best ? best.v.verdict : verdict.verdict;

  // Line 1: our estimate
  const estLine = 'Our estimate: <b>' + esc(sel.label) + '</b> ' + pct(sel.p) + ' (fair odds <span class="mono">' + esc(fmtFairOdds(sel.fair, sel.p)) + '</span>)';

  // Line 2: smallest price worth taking or evidence status
  const minWorthTakingDec = (1 + (calc.VALUE_MIN_EV || 0.05)) / sel.p;
  const minOddsText = fmtOdds(minWorthTakingDec);
  let minLine = 'Smallest price worth taking: <b class="mono">' + esc(minOddsText) + '</b> (' + minWorthTakingDec.toFixed(2) + ')';
  if (v === 'no_bet') {
    minLine = 'Evidence status: <span class="badge provisional" style="font-size:11px;">Unvalidated market</span> <span class="dim" style="font-size:13px;">(no backtested edge)</span>';
  }

  // Line 3: verdict in words
  let verdictWords = 'Awaiting Odds – no live bookmaker price entered yet';
  let verdictBadge = 'awaiting';
  if (v === 'value') {
    verdictWords = 'Potential Value – bookmaker price exceeds minimum worth taking';
    verdictBadge = 'value';
  } else if (v === 'no_value') {
    verdictWords = 'No Bet – price too short for estimated win chance';
    verdictBadge = 'nobet';
  } else if (v === 'no_bet') {
    verdictWords = 'No Bet – The price looks high, but our model isn’t reliable enough on this market to trust it.';
    verdictBadge = 'nobet';
  }
  const verdictLine = 'Verdict: <b class="badge ' + verdictBadge + '" style="font-size:12px;vertical-align:middle;margin:0 4px;">' + (VALUE_HEAD[v] ? VALUE_HEAD[v][1] : 'No Bet') + '</b> ' + esc(verdictWords);

  // High EV warning flag (> 30%) - shown ONLY when verdict is value
  let flagHtml = '';
  if (v === 'value' && verdict.ev != null && verdict.ev > 0.30) {
    flagHtml = '<div class="ev-high-flag" style="margin-top:10px;padding:8px 12px;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.4);border-radius:8px;color:#fef08a;font-size:13px;display:flex;align-items:center;gap:8px;">' +
      '<span style="font-size:16px;">⚠️</span><span><b>Unusually high (+' + Math.round(verdict.ev * 100) + '% EV):</b> check the price with the bookmaker — market odds may have shifted or been misquoted.</span>' +
    '</div>';
  }

  return '<div class="match-top-verdict card section" style="background:linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85));border:1px solid rgba(56,189,248,0.3);box-shadow:0 8px 24px rgba(0,0,0,0.3);padding:16px 18px;border-radius:14px;margin-bottom:16px;">' +
    '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--cyan);margin-bottom:8px;">Match Verdict</div>' +
    '<div class="verdict-three-lines" style="display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.45;color:#e2e8f0;">' +
      '<div>' + estLine + '</div>' +
      '<div>' + minLine + '</div>' +
      '<div>' + verdictLine + '</div>' +
    '</div>' +
    flagHtml +
  '</div>';
}

"""
    code = code[:idx_start] + new_match_verdict_fn + code[idx_end:]

    # 5. Remove duplicate EV warning in bestValueBlock
    old_bv_block_warn = """  if (verdict.verdict !== 'awaiting_odds') {
    if (verdict.ev > 0.30) {
      detail += '<p class="warn" style="font-size:13px">Unusually high (+' + Math.round(100 * verdict.ev) + '% EV). Check the price with the bookmaker: the market may have moved since the odds feed last checked, or the line may be a typo on the site.</p>';
    }
    detail += '<p class="dim" style="font-size:13px">' + esc(verdict.why) + '</p>';
  }"""

    new_bv_block_warn = """  if (verdict.verdict !== 'awaiting_odds') {
    detail += '<p class="dim" style="font-size:13px">' + esc(verdict.why) + '</p>';
  }"""

    if old_bv_block_warn in code:
        code = code.replace(old_bv_block_warn, new_bv_block_warn, 1)

    # 6. Results page: fix undefined of 15 AND tuck Brier into Show the maths
    old_hitrate_summary = """  const hitRateSummary = res && res.n ? Math.round(res.pick_hit_rate * 100) + '% of match-result picks won (' + res.hits + ' of ' + res.n + ')' : 'No settled results in this competition yet';"""
    new_hitrate_summary = """  const hits = res ? (res.hits != null ? res.hits : Math.round((res.pick_hit_rate || 0) * (res.n || 0))) : 0;
  const hitRateSummary = res && res.n ? Math.round(res.pick_hit_rate * 100) + '% of match-result picks won (' + hits + ' of ' + res.n + ')' : 'No settled results in this competition yet';"""

    if old_hitrate_summary in code:
        code = code.replace(old_hitrate_summary, new_hitrate_summary, 1)

    # byCompetitionCards: replace Brier on surface card with Picks won & Win rate
    old_by_comp_cards = """function byCompetitionCards(allPerf) {
  const rows = [['PL', allPerf]].concat(Object.entries(allPerf.by_competition || {}));
  return '<div class="section"><div class="stat-cards">' + rows.map(([code, p]) => { const r = (p.markets || {}).result;
    return statCard(esc(leagueName(code)), r && r.sufficient_sample ? '' : '<span class="badge pending">' + (r ? 'small sample' : 'none settled yet') + '</span>',
      [['Settled', r ? r.n : 0], ['Picks right', r ? pct(r.pick_hit_rate) : '—'], ['Brier', r ? r.brier.toFixed(3) : '—']], r ? { claimed: r.mean_pick_p, actual: r.pick_hit_rate } : null); }).join('') + '</div></div>';
}"""

    new_by_comp_cards = """function byCompetitionCards(allPerf) {
  const rows = [['PL', allPerf]].concat(Object.entries(allPerf.by_competition || {}));
  return '<div class="section"><div class="stat-cards">' + rows.map(([code, p]) => {
    const r = (p.markets || {}).result;
    const hits = r ? (r.hits != null ? r.hits : Math.round((r.pick_hit_rate || 0) * (r.n || 0))) : 0;
    return statCard(esc(leagueName(code)), r && r.sufficient_sample ? '' : '<span class="badge pending">' + (r ? 'small sample' : 'none settled yet') + '</span>',
      [['Settled', r ? r.n : 0], ['Picks won', r ? hits + ' of ' + r.n : '0 of 0'], ['Win rate', r ? pct(r.pick_hit_rate) : '—']], r ? { claimed: r.mean_pick_p, actual: r.pick_hit_rate } : null);
  }).join('') + '</div></div>';
}"""

    if old_by_comp_cards in code:
        code = code.replace(old_by_comp_cards, new_by_comp_cards, 1)

    # 7. Regulatory wording sweep
    code = code.replace("Target £10–£1,000 return across 2–6 legs with verified statistical edge. 1-click accumulator builder.",
                        "Target £10–£1,000 return across 2–6 legs with verified statistical edge and honest model probabilities.")
    code = code.replace('<div class="butler-feat-item"><span class="feat-icon">📑</span> 1-Click Formatted Copy</div>',
                        '<div class="butler-feat-item"><span class="feat-icon">📑</span> Formatted Copy</div>')
    code = code.replace('title="Place with ', 'title="Open on ')
    code = code.replace("'Official UK Bookmaker Prices'", "'Live UK Bookmaker Prices'")
    code = code.replace(">Added to slip</label>", ">Tap when added</label>")

    # 8. Builder: default 2 legs (Double) for lower variance, and label custom legs input
    old_builder_state = "const builderState = { stake: 10, legs: 4, win: 50, timing: 'today' };"
    new_builder_state = "const builderState = { stake: 10, legs: 2, win: 25, timing: 'today' };"
    if old_builder_state in code:
        code = code.replace(old_builder_state, new_builder_state, 1)

    old_leg_input = """'<input id="b-legs" class="ctl mono legs-input" type="number" inputmode="numeric" min="1" max="' + MatchIQBuilder.MAX_LEGS + '" step="1" value="' + legs + '" data-b="legs" aria-label="Number of bets"></div></div>'"""
    new_leg_input = """'<div style="display:inline-flex;align-items:center;gap:6px;margin-left:4px;"><span style="font-size:12px;color:var(--soft);">Other:</span><input id="b-legs" class="ctl mono legs-input" type="number" inputmode="numeric" min="1" max="' + MatchIQBuilder.MAX_LEGS + '" step="1" value="' + legs + '" data-b="legs" aria-label="Custom number of bets" title="Enter custom number of bets"></div></div></div>'"""
    if old_leg_input in code:
        code = code.replace(old_leg_input, new_leg_input, 1)

    # 9. Clean signed-out Leagues state (no @Punter_381 pseudo-account shown while signed out)
    old_signed_out_leagues = """  const uStats = getUserLeagueStats(activeLeagueFreq);
  const geoTiers = getGeoTiers(prof);
  const customLeagues = getStoredLeagues();
  const trophies = getStoredTrophies();"""

    new_signed_out_leagues = """  if (!isUserSignedIn) {
    return '<section class="view">' +
      '<h1 class="page-title">Buddy &amp; Regional Leagues</h1>' +
      '<p class="page-sub">Compete on genuine model predictions with mates across hometown, county, national and private leaderboards.</p>' +
      signedOutBanner +
      '<div class="section card">' +
        '<div class="section-head">' +
          '<div>' +
            '<h2 class="section-title">How Buddy Leagues Work</h2>' +
            '<p class="section-note">Fair, audited competition with zero gambling.</p>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-2" style="margin-top:16px;gap:12px;">' +
          '<div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);">' +
            '<h3 style="font-size:14.5px;color:var(--cyan);margin:0 0 4px;">🏆 6-Tier Geographic Ladders</h3>' +
            '<p class="dim" style="font-size:13px;margin:0;">Automatic promotion from your Hometown to County, Region, Home Nation, UK and Global leaderboards.</p>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);">' +
            '<h3 style="font-size:14.5px;color:var(--cyan);margin:0 0 4px;">👥 Private Mate Leagues</h3>' +
            '<p class="dim" style="font-size:13px;margin:0;">Create private 6-character code leagues for your WhatsApp group or pub mates with live sync.</p>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);">' +
            '<h3 style="font-size:14.5px;color:var(--cyan);margin:0 0 4px;">🔒 Google Sign-In Only</h3>' +
            '<p class="dim" style="font-size:13px;margin:0;">No passwords or forms. One Google tap saves your rank permanently across desktop and mobile.</p>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);">' +
            '<h3 style="font-size:14.5px;color:var(--cyan);margin:0 0 4px;">🥇 Silverware &amp; Honours</h3>' +
            '<p class="dim" style="font-size:13px;margin:0;">Earn weekly badges, monthly cups, and season silverware verified on the public ledger.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  const uStats = getUserLeagueStats(activeLeagueFreq);
  const geoTiers = getGeoTiers(prof);
  const customLeagues = getStoredLeagues();
  const trophies = getStoredTrophies();"""

    if old_signed_out_leagues in code:
        code = code.replace(old_signed_out_leagues, new_signed_out_leagues, 1)

    # 10. Add App Utilities & Installation section to More tab
    old_more_account_end = """        '<button type="button" class="btn small" onclick="signOutUser()" style="margin-top:14px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;">Sign Out</button>' +
      '</div>';"""

    new_more_account_end = """        '<button type="button" class="btn small" onclick="signOutUser()" style="margin-top:14px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;">Sign Out</button>' +
      '</div>' +
      '<div class="section card">' +
        '<div class="section-head">' +
          '<div>' +
            '<h2 class="section-title">App Installation &amp; Utilities</h2>' +
            '<p class="section-note">Download to home screen, share with mates, or force sync latest upgrades.</p>' +
          '</div>' +
        '</div>' +
        '<div class="tiles" style="margin-top:16px;">' +
          '<div class="tile" style="cursor:pointer;" onclick="triggerDirectDownload()">' +
            '<div class="k">Install App ⚡</div>' +
            '<div class="v" style="font-size:16px;color:var(--cyan)">Download PWA</div>' +
            '<div class="s">Add Bet Buddy to your home screen or desktop</div>' +
          '</div>' +
          '<div class="tile" style="cursor:pointer;" data-share-app>' +
            '<div class="k">Share App 🔗</div>' +
            '<div class="v" style="font-size:16px;color:#38bdf8">Share with Friends</div>' +
            '<div class="s">Send Bet Buddy link to mates via WhatsApp or socials</div>' +
          '</div>' +
          '<div class="tile" style="cursor:pointer;" onclick="forceAppSync()">' +
            '<div class="k">App Sync 🔄</div>' +
            '<div class="v" style="font-size:16px;color:#10b981">Force Upgrade</div>' +
            '<div class="s">Clear cached bundles and sync latest models</div>' +
          '</div>' +
        '</div>' +
      '</div>';"""

    if old_more_account_end in code:
        code = code.replace(old_more_account_end, new_more_account_end, 1)

    path.write_text(code, encoding='utf-8')
    print("Successfully patched app.js!")

def patch_index_html():
    path = ROOT / 'index.html'
    code = path.read_text(encoding='utf-8')

    old_tools = """    <div class="header-tools">
      <button type="button" class="butler-pill-btn" id="header-butler-btn" onclick="openButlerModal()" title="Your Bet Butler: Choose your bookmaker slip note">
        <span class="butler-icon">🤵</span>
        <span class="butler-label">Bet Butler: <b id="header-butler-name">Sky Bet</b></span>
        <span class="butler-caret">▾</span>
      </button>
      <button type="button" class="odds-toggle" id="odds-toggle" aria-label="Toggle odds format" title="Switch between Fractional (6/4) and Decimal (2.50) odds" data-active-mode="fractional"><span class="odds-segment" data-seg="fractional">6/4</span><span class="odds-segment" data-seg="decimal">2.50</span><span class="sr-only" id="odds-mode-val">Fractional</span></button>
      <button type="button" class="pwa-install-btn" id="header-install-btn" title="Download Bet Buddy to phone / tablet" aria-label="Download App">
        <span class="install-badge-icon" style="font-size:14px">⚡</span>
        <span class="install-label">Download App</span>
      </button>
            <button type="button" class="header-share-btn" id="header-share-btn" data-share-app title="Share Bet Buddy with friends" aria-label="Share App">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span class="share-label">Share App</span>
      </button>
      <button type="button" class="sync-refresh-btn" id="header-sync-btn" title="Force sync latest app upgrades" aria-label="Sync App" onclick="forceAppSync()">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        <span class="sync-label">Sync</span>
      </button>
    </div>"""

    new_tools = """    <div class="header-tools">
      <button type="button" class="butler-pill-btn" id="header-butler-btn" onclick="openButlerModal()" title="Your Bet Butler: Choose your bookmaker slip note">
        <span class="butler-icon">🤵</span>
        <span class="butler-label">Bet Butler: <b id="header-butler-name">Sky Bet</b></span>
        <span class="butler-caret">▾</span>
      </button>
      <button type="button" class="odds-toggle" id="odds-toggle" aria-label="Toggle odds format" title="Switch between Fractional (6/4) and Decimal (2.50) odds" data-active-mode="fractional"><span class="odds-segment" data-seg="fractional">6/4</span><span class="odds-segment" data-seg="decimal">2.50</span><span class="sr-only" id="odds-mode-val">Fractional</span></button>
    </div>"""

    if old_tools in code:
        code = code.replace(old_tools, new_tools, 1)

    code = code.replace("<strong>1-Click Copy:</strong>", "<strong>Formatted Copy:</strong>")
    code = code.replace('<b id="footer-app-version" style="color:var(--cyan)">v76</b>',
                        '<b id="footer-app-version" style="color:var(--cyan)">v77</b>')

    path.write_text(code, encoding='utf-8')
    print("Successfully patched index.html!")

def patch_styles_css():
    path = ROOT / 'styles.css'
    code = path.read_text(encoding='utf-8')

    old_subgrid = """.portal-subgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.portal-subcard {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-decoration: none;
  background: #0a1322;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 16px;
  color: inherit;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  min-height: 190px;
}"""

    new_subgrid = """.portal-subgrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.portal-subcard {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-decoration: none;
  background: #0a1322;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 16px 18px;
  color: inherit;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  min-height: 130px;
}"""

    if old_subgrid in code:
        code = code.replace(old_subgrid, new_subgrid, 1)

    path.write_text(code, encoding='utf-8')
    print("Successfully patched styles.css!")

def patch_sw_js():
    path = ROOT / 'sw.js'
    code = path.read_text(encoding='utf-8')
    code = code.replace('betbuddy-pwa-v76', 'betbuddy-pwa-v77')
    path.write_text(code, encoding='utf-8')
    print("Successfully patched sw.js to v77!")

if __name__ == '__main__':
    patch_app_js()
    patch_index_html()
    patch_styles_css()
    patch_sw_js()
