"""Script to apply Today's Best Value Bet feature card and modal to app.js, index.html, and styles.css"""
import sys

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add getTodayBestValuePicks and viewBestValueModal logic
    best_value_code = r'''
// ------------------------------------------------------------ Today's Best Value Multi-Leg Acca Engine
function getTodayBestValuePicks() {
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
  if (!unique.length) return null;

  function formatType(type, legs) {
    const odds = legs.reduce((t, l) => t * (Number(l.odds) || 1), 1);
    const avgEv = legs.reduce((t, l) => t + l.ev, 0) / legs.length;
    const estProb = legs.reduce((t, l) => t * l.p, 1);
    return { type, legs, odds, avgEv, estProb };
  }

  return {
    single: formatType('Single', unique.slice(0, 1)),
    double: formatType('Double', unique.slice(0, 2)),
    treble: formatType('Treble', unique.slice(0, 3)),
    fourFold: formatType('4-Fold Acca', unique.slice(0, 4)),
    topLeg: unique[0]
  };
}

let activeBestValueTier = 'single';

function openBestValueModal(tier) {
  if (tier) activeBestValueTier = tier;
  const modal = $('best-value-modal');
  if (!modal) return;
  renderBestValueModalContent();
  modal.hidden = false;
}

function closeBestValueModal() {
  const modal = $('best-value-modal');
  if (modal) modal.hidden = true;
}

function setBestValueTier(tier) {
  activeBestValueTier = tier;
  renderBestValueModalContent();
}

function renderBestValueModalContent() {
  const data = getTodayBestValuePicks();
  const body = $('best-value-modal-body');
  if (!body) return;
  if (!data) {
    body.innerHTML = '<div class="empty" style="padding:24px;text-align:center;">No upcoming fixtures with live bookmaker prices currently available. Check back soon.</div>';
    return;
  }

  const tierData = data[activeBestValueTier] || data.single;
  const legs = tierData.legs;
  const totalOdds = tierData.odds;
  const avgEv = tierData.avgEv;
  const estProb = tierData.estProb;
  const stake = Number((builderState && builderState.stake) || 10) || 10;
  const potRet = (stake * totalOdds).toFixed(2);
  const profit = (stake * totalOdds - stake).toFixed(2);

  const tabsHtml = '<div class="bv-tabs">' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'single' ? ' active' : '') + '" onclick="setBestValueTier(\'single\')">Single (1)</button>' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'double' ? ' active' : '') + '" onclick="setBestValueTier(\'double\')">Double (2)</button>' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'treble' ? ' active' : '') + '" onclick="setBestValueTier(\'treble\')">Treble (3)</button>' +
    '<button type="button" class="bv-tab' + (activeBestValueTier === 'fourFold' ? ' active' : '') + '" onclick="setBestValueTier(\'fourFold\')">4-Fold (4)</button>' +
  '</div>';

  const legsHtml = '<div class="bv-legs-list">' +
    legs.map((l, i) => {
      const fix = l.fixture || {};
      const matchText = (fix.home && fix.away) ? (fix.home + ' v ' + fix.away) : (fix.home || 'Match');
      const oddsLabel = oddsFormat === 'decimal' ? calc.formatDecimalOdds(l.odds) : (l.fractional || fmtOdds(l.odds));
      const evPct = Math.round(l.ev * 100);
      return '<div class="bv-leg-item">' +
        '<div class="bv-leg-left">' +
          '<span class="bv-leg-num">' + (i + 1) + '</span>' +
          '<div class="bv-leg-info">' +
            '<div class="bv-leg-match">' + esc(matchText) + '</div>' +
            '<div class="bv-leg-sel">' + esc(l.label) + '</div>' +
            '<div class="bv-leg-ev-badge">+' + evPct + '% edge vs ' + esc(l.bookmaker || 'market') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bv-leg-right">' +
          '<div class="bv-leg-odds mono">' + esc(oddsLabel) + '</div>' +
          '<div class="bv-leg-prob">' + Math.round(l.p * 100) + '% model chance</div>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';

  const statsHtml = '<div class="bv-summary-card">' +
    '<div class="bv-sum-col"><span>Total Odds</span><b class="mono">' + fmtOdds(totalOdds) + '</b></div>' +
    '<div class="bv-sum-col"><span>Est. Edge</span><b class="pos">+' + Math.round(avgEv * 100) + '% EV</b></div>' +
    '<div class="bv-sum-col"><span>Win Chance</span><b class="mono">' + (estProb >= 0.1 ? Math.round(estProb * 100) : (estProb * 100).toFixed(1)) + '%</b></div>' +
    '<div class="bv-sum-col"><span>Returns (£' + stake.toFixed(2) + ')</span><b class="mono emerald">£' + potRet + '</b></div>' +
  '</div>';

  const actionsHtml = '<div class="bv-modal-actions">' +
    '<button type="button" class="btn primary" onclick="addBestValueToDiary(\'' + activeBestValueTier + '\')" style="flex:1;min-height:48px;font-size:15px;font-weight:700;">' +
      '📓 Add to Bet Diary / League 🏆' +
    '</button>' +
    '<button type="button" class="btn" onclick="openSlipCardFromBestValue(\'' + activeBestValueTier + '\')" style="min-height:48px;">' +
      '📋 Slip Card' +
    '</button>' +
  '</div>';

  body.innerHTML = tabsHtml + statsHtml + legsHtml + actionsHtml;
}

function openSlipCardFromBestValue(tier) {
  const data = getTodayBestValuePicks();
  if (!data) return;
  const tierData = data[tier] || data.single;
  closeBestValueModal();
  const stake = Number((builderState && builderState.stake) || 10) || 10;
  activeSlipCardData = {
    isSingle: tierData.legs.length === 1,
    legs: tierData.legs,
    odds: tierData.odds,
    stake: stake,
    ret: (stake * tierData.odds).toFixed(2),
    slipKey: 'bv_' + tier + '_' + tierData.legs.map(l => l.matchId).join('_')
  };
  renderSlipCardModal(activeSlipCardData);
}

function addBestValueToDiary(tier) {
  const data = getTodayBestValuePicks();
  if (!data) return;
  const tierData = data[tier] || data.single;
  closeBestValueModal();
  const legs = tierData.legs;
  const isSingle = legs.length === 1;

  if (isSingle) {
    const l = legs[0];
    const fix = l.fixture || {};
    openDiary({
      id: l.matchId,
      selection: l.label,
      market: MARKETS[l.market] ? MARKETS[l.market].diary : 'wins',
      odds: l.fractional || fmtOdds(l.odds),
      p: l.p,
      fair: calc.formatFractionalOdds(1 / l.p),
      rec: 'best_value',
      notes: "Today\'s Best Value Bet (" + Math.round(l.ev * 100) + "% edge vs " + (l.bookmaker || 'bookmaker') + ")"
    });
  } else {
    openDiary({});
    $('modal-bet-type').value = 'accumulator';
    toggleAccumulatorFields();
    if ($('modal-legs-input')) {
      $('modal-legs-input').value = legs.map(l => {
        const matchLabel = l.fixture && l.fixture.home ? (l.fixture.home + (l.fixture.away ? ' v ' + l.fixture.away : '') + ': ') : '';
        const frac = String(l.fractional || fmtOdds(l.odds)).replace(/[≈~]/g, '').trim();
        return (matchLabel + l.label).replace(/^([^:]+:\s*)\1/, '$1') + ' | ' + (frac || 'Evens');
      }).join('\n');
    }
    if ($('modal-stake-input')) $('modal-stake-input').value = Number((builderState && builderState.stake) || 10).toFixed(2);
    if ($('modal-odds-input')) $('modal-odds-input').value = fmtOdds(tierData.odds).replace(/[≈~]/g, '');
    if ($('modal-origin-select')) $('modal-origin-select').value = 'matchiq';
    if ($('modal-notes-input')) $('modal-notes-input').value = "Today\'s Best Value " + tierData.type + " (avg +" + Math.round(tierData.avgEv * 100) + "% expected value).";
    updateModalPnlPreview();
  }
}
'''

    # Insert best_value_code before viewHome
    idx_view_home = content.find('function viewHome() {')
    if idx_view_home == -1:
        raise Exception('viewHome not found in app.js')
    content = content[:idx_view_home] + best_value_code + '\n' + content[idx_view_home:]

    # 2. Add the Best Value Hero Card to renderWelcomeHero
    # We want it right inside portal-grid, before Bet Butler
    old_target = "'<!-- Bet Butler Feature Hero Card -->'"
    if old_target not in content:
        # Check without quotes
        old_target = "<!-- Bet Butler Feature Hero Card -->"
    idx_target = content.find(old_target)
    if idx_target == -1:
        raise Exception('Bet Butler Feature Hero Card not found in app.js')

    bv_hero_card = (
        "'<!-- Today\\'s Best Value Bet Feature Hero Card -->' +\n"
        "      '<div class=\"portal-card portal-card-best-value\" onclick=\"openBestValueModal(\\'single\\')\" style=\"text-decoration:none;cursor:pointer;\">' +\n"
        "        '<div class=\"portal-card-hero-glow bv-glow\"></div>' +\n"
        "        '<div class=\"portal-card-content\">' +\n"
        "          '<div class=\"portal-card-top\">' +\n"
        "            '<span class=\"portal-pill bv-highlight\">🔥 High Mathematical Edge</span>' +\n"
        "            '<span class=\"portal-odds-badge\">Single &middot; Double &middot; Treble &middot; 4-Fold</span>' +\n"
        "          '</div>' +\n"
        "          '<div class=\"portal-hero-body\">' +\n"
        "            '<div class=\"portal-icon-large\">💎📈</div>' +\n"
        "            '<div class=\"portal-hero-text\">' +\n"
        "              '<h2 class=\"portal-hero-heading\">Today\\'s Best Value Bet</h2>' +\n"
        "              '<p class=\"portal-hero-desc\">The strongest mathematical edge across today\\'s live bookmaker prices. View the top Value Single, Double, Treble, or 4-Fold Acca.</p>' +\n"
        "            '</div>' +\n"
        "            '<div class=\"portal-card-action\">' +\n"
        "              '<button type=\"button\" class=\"btn primary portal-cta-btn bv-cta-btn\" onclick=\"event.stopPropagation(); openBestValueModal(\\'single\\');\">' +\n"
        "                '<span>View Value Bets</span>' +\n"
        "                '<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><path d=\"M5 12h14M12 5l7 7-7 7\"/></svg>' +\n"
        "              '</button>' +\n"
        "            '</div>' +\n"
        "          '</div>' +\n"
        "        '</div>' +\n"
        "      '</div>' +\n\n      "
    )

    content = content[:idx_target] + bv_hero_card + content[idx_target:]

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('app.js patched successfully.')

if __name__ == '__main__':
    patch_app_js()
