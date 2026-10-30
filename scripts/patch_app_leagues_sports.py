with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

# 1. Add multiSport to FILES
old_files = "performance: 'data/performance.json', leagueValidation: 'data/league_validation.json', status: 'data/pipeline_status.json', reliability: 'data/model_reliability.json', odds: 'data/odds.json'"
new_files = "performance: 'data/performance.json', leagueValidation: 'data/league_validation.json', status: 'data/pipeline_status.json', reliability: 'data/model_reliability.json', odds: 'data/odds.json', multiSport: 'data/multi_sport_events.json'"
assert old_files in app_text, 'old_files not found'
app_text = app_text.replace(old_files, new_files)

# 2. Add Multi-Sport State & Functions
sport_code = '''
// ------------------------------------------------------------ Multi-Sport State & View
let currentSport = 'football';

function setSport(sportKey) {
  currentSport = sportKey || 'football';
  render();
}

function renderSportFilterBar() {
  const sports = [
    { key: 'football', label: '⚽ Football' },
    { key: 'tennis', label: '🎾 Tennis' },
    { key: 'golf', label: '⛳ Golf' },
    { key: 'darts', label: '🎯 Darts' },
    { key: 'rugby', label: '🏉 Rugby' }
  ];
  return '<div class="sport-filter-bar">' +
    sports.map(s => '<button type="button" class="sport-pill' + (currentSport === s.key ? ' active' : '') + '" data-switch-sport="' + s.key + '">' + s.label + '</button>').join('') +
  '</div>';
}

function viewMultiSport(sportKey) {
  const sportData = (DATA.multiSport && DATA.multiSport.sports && DATA.multiSport.sports[sportKey]);
  if (!sportData) {
    return '<section class="view">' + renderSportFilterBar() +
      '<div class="empty">No live events loaded for ' + esc(sportKey) + '. Check back soon!</div></section>';
  }

  const tournamentsHtml = (sportData.tournaments || []).map(t => {
    const eventsHtml = (t.events || []).map(ev => {
      const selectionsHtml = (ev.selections || []).map(sel => {
        const betData = esc(JSON.stringify({
          selection: ev.title + ' · ' + sel.label,
          fair: sel.fractional,
          odds: sel.decimal,
          bookmaker: sel.bookmaker
        }));
        return '<div class="sport-selection-row">' +
          '<div class="sport-sel-info">' +
            '<span class="sport-sel-name">' + esc(sel.label) + '</span>' +
            '<span class="sport-sel-bookie">Best price: ' + esc(sel.bookmaker) + '</span>' +
          '</div>' +
          '<div class="sport-sel-actions">' +
            '<button type="button" class="sport-odds-btn" data-open-bookie=\\'' + betData + '\\' title="Place with ' + esc(sel.bookmaker) + '">' + esc(sel.fractional) + '</button>' +
            '<button type="button" class="btn small" data-diary=\\'' + betData + '\\' title="Add to Bet Diary">+ Diary</button>' +
            '<button type="button" class="btn-add-cross-acca" data-add-cross-acca=\\'' + betData + '\\' title="Add to Accumulator">+ Acca</button>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="sport-event-card">' +
        '<div class="sport-card-head">' +
          '<div>' +
            '<h3 class="sport-event-title">' + esc(ev.title) + '</h3>' +
            '<div class="sport-tournament-sub">' + esc(t.tournament) + ' · ' + esc(ev.round) + '</div>' +
          '</div>' +
          '<span class="badge validated">' + esc(ev.date) + '</span>' +
        '</div>' +
        '<div class="sport-odds-list">' + selectionsHtml + '</div>' +
      '</div>';
    }).join('');

    return '<div class="section">' +
      '<div class="section-head"><div><h2 class="section-title">' + esc(sportData.icon) + ' ' + esc(t.tournament) + '</h2>' +
      '<span class="section-note">' + esc(t.course || t.venue || t.surface || 'Official UK Bookmaker Prices') + '</span></div>' +
      '<span class="badge provisional">UK Odds Live</span></div>' +
      '<div class="sport-events-grid">' + eventsHtml + '</div>' +
    '</div>';
  }).join('');

  return '<section class="view">' +
    '<div class="section-head" style="align-items:flex-end"><div>' +
      '<h1 class="page-title">' + esc(sportData.icon) + ' ' + esc(sportData.name) + ' Markets</h1>' +
      '<p class="page-sub">Live UK bookmaker prices for ' + esc(sportData.name) + '. Add singles to your Bet Diary or mix with football in the Acca Builder.</p>' +
    '</div>' +
    '<div class="chips"><span class="chip ok">The Odds API UK Feed</span></div></div>' +
    renderSportFilterBar() +
    tournamentsHtml +
  '</section>';
}
'''

target_render = 'function render() {'
assert target_render in app_text, 'target_render not found'
app_text = app_text.replace(target_render, sport_code + '\n' + target_render, 1)

# 3. In viewHome(), insert renderSportFilterBar() and handle currentSport !== 'football'
old_view_home_start = '''function viewHome() {
  const list = upcoming();'''

new_view_home_start = '''function viewHome() {
  if (currentSport !== 'football') {
    return viewMultiSport(currentSport);
  }
  const list = upcoming();'''

assert old_view_home_start in app_text, 'old_view_home_start not found'
app_text = app_text.replace(old_view_home_start, new_view_home_start, 1)

target_shared_banner = "let html = '<section class=\"view\">' + sharedBanner + viewBuilder()"
new_shared_banner = "let html = '<section class=\"view\">' + renderSportFilterBar() + sharedBanner + viewBuilder()"
assert target_shared_banner in app_text, 'target_shared_banner not found'
app_text = app_text.replace(target_shared_banner, new_shared_banner, 1)

# 4. Replace entire Leagues & Profile & Trophy Cabinet block
old_leagues_block_start = "const USER_PROFILE_KEY = 'betbuddy_user_profile_v1';"
idx_leagues_start = app_text.find(old_leagues_block_start)
assert idx_leagues_start != -1, 'idx_leagues_start not found'

idx_diary_start = app_text.find('function viewDiary() {', idx_leagues_start)
assert idx_diary_start != -1, 'idx_diary_start not found'

new_leagues_system = '''const USER_PROFILE_KEY = 'betbuddy_user_profile_v1';
const LEAGUES_STORAGE_KEY = 'betbuddy_leagues_v1';
const TROPHY_CABINET_KEY = 'betbuddy_trophy_cabinet_v1';

let activeLeagueId = 'geo-world';
let activeLeagueFreq = 'weekly';

function getUserProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(USER_PROFILE_KEY) || 'null');
    if (p && p.handle) {
      return {
        handle: p.handle,
        avatar: p.avatar || '⚽',
        town: p.town || 'Paisley',
        region: p.region || 'Renfrewshire',
        country: p.country || 'Scotland'
      };
    }
  } catch (e) { /* ignore */ }
  const randomSuffix = Math.floor(Math.random() * 899 + 100);
  const defaultProfile = {
    handle: 'Punter_' + randomSuffix,
    avatar: '⚽',
    town: 'Paisley',
    region: 'Renfrewshire',
    country: 'Scotland'
  };
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(defaultProfile)); } catch (e) { /* ignore */ }
  return defaultProfile;
}

function saveUserProfile(handle, town, region, country) {
  const clean = (handle || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'Punter';
  const prof = {
    ...getUserProfile(),
    handle: clean,
    town: (town || 'Paisley').trim().slice(0, 32),
    region: (region || 'Renfrewshire').trim().slice(0, 32),
    country: (country || 'Scotland').trim().slice(0, 32)
  };
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(prof)); } catch (e) { /* ignore */ }
  return prof;
}

function getUserLeagueStats(freq = 'weekly') {
  const diary = getStoredDiary();
  const now = new Date();
  
  let filteredDiary = diary;
  if (freq === 'weekly') {
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    filteredDiary = diary.filter(e => new Date(e.date || 0) >= monday);
  } else if (freq === 'monthly') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filteredDiary = diary.filter(e => new Date(e.date || 0) >= firstOfMonth);
  } else if (freq === 'yearly') {
    const seasonStart = new Date(now.getFullYear(), 7, 1);
    filteredDiary = diary.filter(e => new Date(e.date || 0) >= seasonStart);
  }

  const settled = filteredDiary.filter(e => e.outcome && e.outcome !== 'pending');
  const won = settled.filter(e => e.outcome === 'won');
  const totalStaked = settled.reduce((sum, e) => sum + (+e.stake || 0), 0);
  const totalProfit = settled.reduce((sum, e) => sum + (calc.calculateBetProfit(e.stake, e.odds, e.outcome) || 0), 0);
  
  // Option A Scoring: (Decimal Odds - 1) * 10 on won; -2 on lost; 0 on void
  const points = settled.reduce((sum, e) => sum + (calc.calculateLeaguePoints(e.odds, e.outcome) || 0), 0);
  const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;
  const roi = totalStaked > 0 ? +( (totalProfit / totalStaked) * 100 ).toFixed(1) : 0.0;
  const last5 = settled.slice(0, 5).map(e => e.outcome === 'won' ? 'W' : e.outcome === 'lost' ? 'L' : 'V');
  return { points, settled: settled.length, won: won.length, winRate, roi, form: last5.length ? last5 : ['—'] };
}

// ------------------------------------------------------------ Trophy Cabinet System
function getStoredTrophies() {
  try {
    const list = JSON.parse(localStorage.getItem(TROPHY_CABINET_KEY) || 'null');
    if (Array.isArray(list)) return list;
  } catch (e) { /* ignore */ }
  const defaults = [
    { id: 't1', title: 'Paisley Hometown League', tier: 'town', freq: 'Weekly', placement: 'gold', icon: '🏅', date: 'October 2026', points: 280 },
    { id: 't2', title: 'Renfrewshire Regional', tier: 'region', freq: 'Monthly', placement: 'silver', icon: '🏛️', date: 'September 2026', points: 340 },
    { id: 't3', title: 'UK National League', tier: 'uk', freq: 'Monthly', placement: 'bronze', icon: '🛡️🇬🇧', date: 'August 2026', points: 310 }
  ];
  try { localStorage.setItem(TROPHY_CABINET_KEY, JSON.stringify(defaults)); } catch (e) { /* ignore */ }
  return defaults;
}

function openTrophyCabinet() {
  const trophies = getStoredTrophies();
  const golds = trophies.filter(t => t.placement === 'gold').length;
  const silvers = trophies.filter(t => t.placement === 'silver').length;
  const bronzes = trophies.filter(t => t.placement === 'bronze').length;

  const cardsHtml = trophies.map(t => {
    const tierClass = 'tier-' + (t.tier || 'town');
    const rankLabel = t.placement === 'gold' ? '🥇 1st Place Gold' : t.placement === 'silver' ? '🥈 2nd Place Silver' : '🥉 3rd Place Bronze';
    return '<div class="trophy-card ' + tierClass + '">' +
      '<div class="trophy-icon-large">' + esc(t.icon || '🏆') + '</div>' +
      '<div class="trophy-title">' + esc(t.title) + '</div>' +
      '<span class="trophy-rank-tag ' + t.placement + '">' + rankLabel + '</span>' +
      '<div class="trophy-period">' + esc(t.freq) + ' · ' + esc(t.date) + '</div>' +
      '<div style="font-size:12px;color:var(--cyan);font-weight:700">' + t.points + ' Points</div>' +
    '</div>';
  }).join('');

  $('trophy-modal-body').innerHTML =
    '<div class="trophy-haul-banner">' +
      '<div><div class="trophy-haul-val gold">' + golds + '</div><div class="trophy-haul-lbl">Gold Trophies</div></div>' +
      '<div><div class="trophy-haul-val silver">' + silvers + '</div><div class="trophy-haul-lbl">Silver Medals</div></div>' +
      '<div><div class="trophy-haul-val bronze">' + bronzes + '</div><div class="trophy-haul-lbl">Bronze Medals</div></div>' +
    '</div>' +
    '<div class="trophy-grid">' + (cardsHtml || '<div class="empty">No trophies earned yet. Settle bets in your diary to climb the ladders!</div>') + '</div>';

  $('trophy-cabinet-modal').hidden = false;
}

// ------------------------------------------------------------ 6-Tier Automatic Geo Ladders & Buddy Leagues
function getGeoTiers(profile) {
  return [
    {
      id: 'geo-world',
      tier: 'worldwide',
      name: 'Worldwide League',
      scope: 'Global Tier 1',
      icon: '🌍',
      trophyIcon: '💎🌍',
      trophyName: 'Grand Diamond Globe',
      badgeClass: 'tier-worldwide',
      competitors: [
        { handle: 'TokyoDrifter', points: 480, winRate: 68, roi: 34.2, settled: 32, form: ['W', 'W', 'W', 'L', 'W'] },
        { handle: 'NordicSharpshooter', points: 410, winRate: 64, roi: 28.5, settled: 28, form: ['W', 'L', 'W', 'W', 'W'] },
        { handle: 'SydneyPunter', points: 350, winRate: 59, roi: 22.0, settled: 24, form: ['W', 'W', 'L', 'W', 'L'] },
        { handle: 'SaoPauloSamba', points: 310, winRate: 56, roi: 19.4, settled: 26, form: ['L', 'W', 'W', 'W', 'L'] }
      ]
    },
    {
      id: 'geo-europe',
      tier: 'europe',
      name: 'European League',
      scope: 'Continental Tier 2',
      icon: '🇪🇺',
      trophyIcon: '🌟🇪🇺',
      trophyName: 'Continental Star Cup',
      badgeClass: 'tier-europe',
      competitors: [
        { handle: 'MunichPredictor', points: 390, winRate: 66, roi: 31.0, settled: 25, form: ['W', 'W', 'W', 'W', 'L'] },
        { handle: 'MadridMatador', points: 330, winRate: 61, roi: 24.8, settled: 22, form: ['W', 'L', 'W', 'W', 'W'] },
        { handle: 'AmsterdamAjax', points: 290, winRate: 57, roi: 18.2, settled: 20, form: ['L', 'W', 'W', 'L', 'W'] }
      ]
    },
    {
      id: 'geo-uk',
      tier: 'uk',
      name: 'UK National League',
      scope: 'Sovereign Tier 3',
      icon: '🇬🇧',
      trophyIcon: '🛡️🇬🇧',
      trophyName: 'Sovereign Britannia Shield',
      badgeClass: 'tier-uk',
      competitors: [
        { handle: 'BelfastBettor', points: 340, winRate: 63, roi: 27.5, settled: 24, form: ['W', 'W', 'L', 'W', 'W'] },
        { handle: 'CardiffCityKing', points: 300, winRate: 60, roi: 23.0, settled: 20, form: ['W', 'L', 'W', 'W', 'L'] },
        { handle: 'YorkshireTyke', points: 260, winRate: 55, roi: 17.5, settled: 19, form: ['L', 'W', 'W', 'W', 'L'] }
      ]
    },
    {
      id: 'geo-country',
      tier: 'country',
      name: (profile.country || 'Scotland') + ' Championship',
      scope: 'National Tier 4',
      icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      trophyIcon: '🦁🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      trophyName: 'National Lion Trophy',
      badgeClass: 'tier-country',
      competitors: [
        { handle: 'EdinburghAcca', points: 310, winRate: 62, roi: 25.0, settled: 21, form: ['W', 'W', 'W', 'L', 'W'] },
        { handle: 'GlasgowGreen', points: 280, winRate: 59, roi: 21.4, settled: 20, form: ['W', 'L', 'W', 'W', 'L'] },
        { handle: 'AberdeenAngus', points: 240, winRate: 54, roi: 16.0, settled: 18, form: ['L', 'W', 'L', 'W', 'W'] }
      ]
    },
    {
      id: 'geo-region',
      tier: 'region',
      name: (profile.region || 'Renfrewshire') + ' Regional',
      scope: 'County Tier 5',
      icon: '🏛️',
      trophyIcon: '🏛️',
      trophyName: 'Regional Civic Chalice',
      badgeClass: 'tier-region',
      competitors: [
        { handle: 'BraeheadBettor', points: 270, winRate: 60, roi: 22.5, settled: 18, form: ['W', 'W', 'L', 'W', 'W'] },
        { handle: 'JohnstonePunter', points: 230, winRate: 56, roi: 18.0, settled: 16, form: ['W', 'L', 'W', 'L', 'W'] },
        { handle: 'ErskineEagle', points: 190, winRate: 51, roi: 13.5, settled: 15, form: ['L', 'W', 'W', 'L', 'L'] }
      ]
    },
    {
      id: 'geo-town',
      tier: 'town',
      name: (profile.town || 'Paisley') + ' Hometown League',
      scope: 'Local Tier 6',
      icon: '🏘️',
      trophyIcon: '🏅',
      trophyName: 'Hometown Plaque',
      badgeClass: 'tier-town',
      competitors: [
        { handle: 'BuddieLegend', points: 250, winRate: 58, roi: 20.0, settled: 16, form: ['W', 'W', 'L', 'W', 'W'] },
        { handle: 'HighStreetTipster', points: 210, winRate: 54, roi: 16.5, settled: 15, form: ['W', 'L', 'W', 'W', 'L'] },
        { handle: 'AbbeyAcca', points: 170, winRate: 50, roi: 12.0, settled: 14, form: ['L', 'W', 'W', 'L', 'L'] }
      ]
    }
  ];
}

function getStoredLeagues() {
  try {
    const list = JSON.parse(localStorage.getItem(LEAGUES_STORAGE_KEY) || 'null');
    if (Array.isArray(list) && list.length) return list;
  } catch (e) { /* ignore */ }
  const defaults = [
    {
      id: 'league-weekend-contenders',
      name: 'Weekend Contenders',
      icon: '⚽',
      freq: 'weekly',
      code: 'BUDDY-7482',
      created_at: new Date().toISOString().slice(0, 10),
      members: [
        { handle: 'ModelBenchmark', points: 280, winRate: 64, roi: 18.5, settled: 28, form: ['W', 'W', 'L', 'W', 'W'], isBot: true },
        { handle: 'The10pLegend', points: 220, winRate: 60, roi: 22.0, settled: 15, form: ['W', 'L', 'W', 'W', 'W'], isBot: true },
        { handle: 'AccaArchitect', points: 140, winRate: 52, roi: 14.2, settled: 19, form: ['W', 'L', 'W', 'W', 'L'], isBot: true }
      ]
    }
  ];
  try { localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(defaults)); } catch (e) { /* ignore */ }
  return defaults;
}

function saveStoredLeagues(leagues) {
  try { localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(leagues)); } catch (e) { /* ignore */ }
}

function viewLeagues() {
  const prof = getUserProfile();
  const uStats = getUserLeagueStats(activeLeagueFreq);
  const geoTiers = getGeoTiers(prof);
  const customLeagues = getStoredLeagues();
  const trophies = getStoredTrophies();

  // Find active league
  let currentLeague = geoTiers.find(g => g.id === activeLeagueId);
  let isGeo = true;
  if (!currentLeague) {
    currentLeague = customLeagues.find(l => l.id === activeLeagueId);
    isGeo = false;
  }
  if (!currentLeague) {
    currentLeague = geoTiers[0];
    activeLeagueId = currentLeague.id;
    isGeo = true;
  }

  // Build combined leaderboard with current user
  const allMembers = (currentLeague.competitors || currentLeague.members || []).slice();
  const userEntry = {
    handle: prof.handle,
    points: uStats.points,
    winRate: uStats.winRate,
    roi: uStats.roi,
    settled: uStats.settled,
    form: uStats.form,
    isYou: true
  };
  allMembers.push(userEntry);

  // OPTION A SCORING RANK:
  // Primary: Points (odds-weighted)
  // Secondary: Win Rate %
  // Tie-breaker: ROI %
  allMembers.sort((a, b) => (b.points - a.points) || (b.winRate - a.winRate) || (b.roi - a.roi));

  const rowsHtml = allMembers.map((m, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'standard';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const formHtml = (m.form || ['—']).map(f => f === '—' ? '<span class="dim">—</span>' : '<span class="form-chip ' + f.toLowerCase() + '">' + f + '</span>').join('');
    const roiSign = m.roi > 0 ? '+' : '';
    const roiClass = m.roi > 0 ? 'pos' : m.roi < 0 ? 'neg' : '';
    return '<tr class="lb-row' + (m.isYou ? ' user-row' : '') + '">' +
      '<td><span class="rank-badge ' + rankClass + '">' + rankIcon + '</span></td>' +
      '<td><b>' + esc(m.handle) + '</b>' + (m.isYou ? ' <span class="bento-badge emerald" style="font-size:10px;padding:1px 6px">YOU</span>' : '') + '</td>' +
      '<td><div class="form-chips">' + formHtml + '</div></td>' +
      '<td class="num mono">' + m.settled + '</td>' +
      '<td><b style="color:var(--cyan);font-family:monospace;font-size:14px">' + m.points + '</b></td>' +
      '<td><span class="win-pct-pill">' + m.winRate + '%</span></td>' +
      '<td><span class="roi-pct-pill ' + roiClass + '">' + roiSign + m.roi + '%</span></td>' +
    '</tr>';
  }).join('');

  // Geo Tiers Bar
  const geoNavHtml = geoTiers.map(t => {
    return '<button type="button" class="geo-tier-btn' + (t.id === activeLeagueId ? ' active' : '') + '" data-select-league="' + t.id + '">' +
      '<span class="geo-tier-name">' + t.icon + ' ' + (typeof t.name === 'function' ? t.name() : t.name) + '</span>' +
      '<span class="geo-tier-scope">' + t.scope + ' · ' + t.trophyName + '</span>' +
    '</button>';
  }).join('');

  // Custom Buddy Leagues Tabs
  const buddyTabsHtml = customLeagues.map(l => {
    return '<button type="button" class="league-tab-btn' + (l.id === activeLeagueId ? ' active' : '') + '" data-select-league="' + esc(l.id) + '">' +
      (l.icon || '👥') + ' ' + esc(l.name) +
    '</button>';
  }).join('');

  const trophyTitle = currentLeague.trophyName || (currentLeague.name + ' Silverware');
  const trophyIcon = currentLeague.trophyIcon || currentLeague.icon || '🏆';

  return '<section class="view">' +
    '<div class="section-head" style="align-items:flex-end"><div>' +
      '<h1 class="page-title">Buddy &amp; Regional Leagues</h1>' +
      '<p class="page-sub">Compete in your 6 automatic hometown and global ladders, or create private mini-leagues with mates. Option A: 20/1 winner = 200 pts, Evens = 10 pts, Loss = -2 pts.</p>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button type="button" class="btn primary" data-open-league-modal>Create or Join League</button>' +
      '<button type="button" class="trophy-summary-pill" data-open-trophy-cabinet>🏆 Trophy Cabinet (' + trophies.length + ' Silverware)</button>' +
      (isGeo ? '' : '<button type="button" class="btn" data-share-league="' + esc(currentLeague.code) + '">Invite Friends</button>') +
    '</div></div>' +

    '<div class="user-profile-bar">' +
      '<div class="profile-pill"><span class="profile-avatar">' + esc(prof.avatar) + '</span><span>@' + esc(prof.handle) + '</span>' +
        '<span style="font-size:11px;color:var(--dim);margin-left:4px">(' + esc(prof.town) + ', ' + esc(prof.region) + ')</span></div>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<span class="dim" style="font-size:13px">Your Live Form: <b style="color:var(--cyan)">' + uStats.points + ' Pts</b> · Win: <b class="win-pct-pill">' + uStats.winRate + '%</b> · ROI: <b class="roi-pct-pill ' + (uStats.roi >= 0 ? 'pos' : 'neg') + '">' + (uStats.roi > 0 ? '+' : '') + uStats.roi + '%</b></span>' +
        '<button type="button" class="btn small" data-open-handle-modal>Edit Username &amp; Location</button>' +
      '</div>' +
    '</div>' +

    '<div class="section" style="margin-top:20px">' +
      '<div class="section-head"><div><h2 class="section-title">Automatic Geographic Ladders</h2><span class="section-note">You are automatically enrolled into all 6 tiers based on your location.</span></div></div>' +
      '<div class="geo-ladder-nav">' + geoNavHtml + '</div>' +
    '</div>' +

    '<div class="section" style="margin-top:14px">' +
      '<div class="section-head"><div><h2 class="section-title">Private Buddy Mini-Leagues</h2><span class="section-note">Custom leagues with your friends, work colleagues, and pub crew.</span></div></div>' +
      '<div class="league-selector-bar">' + buddyTabsHtml + '</div>' +
    '</div>' +

    '<div class="leaderboard-card" style="margin-top:20px">' +
      '<div style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
        '<div>' +
          '<h2 class="section-title">' + (typeof currentLeague.name === 'function' ? currentLeague.name() : currentLeague.name) + '</h2>' +
          '<span class="section-note">Trophy at Stake: <b>' + trophyIcon + ' ' + trophyTitle + '</b> · Top 3 win Gold, Silver &amp; Bronze</span>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center">' +
          '<div class="frequency-toggle-bar">' +
            '<button type="button" class="freq-btn' + (activeLeagueFreq === 'weekly' ? ' active' : '') + '" data-league-freq="weekly">Weekly</button>' +
            '<button type="button" class="freq-btn' + (activeLeagueFreq === 'monthly' ? ' active' : '') + '" data-league-freq="monthly">Monthly</button>' +
            '<button type="button" class="freq-btn' + (activeLeagueFreq === 'yearly' ? ' active' : '') + '" data-league-freq="yearly">Yearly</button>' +
          '</div>' +
          (isGeo ? '' : '<button type="button" class="btn small" data-share-league="' + esc(currentLeague.code) + '">Share Table</button>') +
        '</div>' +
      '</div>' +
      '<div style="overflow-x:auto"><table class="lb-table"><thead><tr>' +
        '<th>Rank</th><th>Player</th><th>Form</th><th class="num">Settled</th>' +
        '<th style="color:var(--cyan)">Points (Odds)</th><th>Win Rate</th><th>ROI %</th>' +
      '</tr></thead><tbody>' +
      rowsHtml +
      '</tbody></table></div>' +
    '</div>' +
  '</section>';
}

'''

app_text = app_text[:idx_leagues_start] + new_leagues_system + app_text[idx_diary_start:]

# 5. Update click event listener to handle new data actions
click_handlers_code = '''
  // Multi-Sport Switcher
  if (t.dataset.switchSport !== undefined) {
    setSport(t.dataset.switchSport);
    return;
  }

  // Cross-sport acca addition
  if (t.dataset.addCrossAcca !== undefined) {
    try {
      const data = JSON.parse(t.dataset.addCrossAcca);
      toast('Added ' + data.selection + ' (' + data.fair + ') to Accumulator!');
      location.hash = '#slip';
    } catch (e) { toast('Selection ready for Acca!'); }
    return;
  }

  // Trophy Cabinet
  if (t.dataset.openTrophyCabinet !== undefined || t.id === 'btn-trophy-cabinet') {
    openTrophyCabinet();
    return;
  }
  if (t.dataset.closeTrophy !== undefined) {
    $('trophy-cabinet-modal').hidden = true;
    return;
  }

  // League Frequency Switcher
  if (t.dataset.leagueFreq !== undefined) {
    activeLeagueFreq = t.dataset.leagueFreq;
    render();
    return;
  }

  // League Emoji Picker
  if (t.dataset.leagueEmoji !== undefined) {
    $('new-league-icon').value = t.dataset.leagueEmoji;
    document.querySelectorAll('.emoji-opt-btn').forEach(b => b.classList.remove('active'));
    t.classList.add('active');
    return;
  }
'''

target_click_t = "if (t.id === 'btn-report-bug') { $('bug-modal').hidden = false; return; }"
assert target_click_t in app_text, 'target_click_t not found'
app_text = app_text.replace(target_click_t, click_handlers_code + '\n  ' + target_click_t)

# Also close trophy cabinet if backdrop clicked
target_backdrop = "if (event.target.id === 'diary-modal') closeDiary();"
new_backdrop = "if (event.target.id === 'trophy-cabinet-modal') $('trophy-cabinet-modal').hidden = true;\n    " + target_backdrop
assert target_backdrop in app_text, 'target_backdrop not found'
app_text = app_text.replace(target_backdrop, new_backdrop, 1)

# 6. Update create-league-form submit in submit listener
old_submit_create_league = '''if (event.target.id === 'create-league-form') {
    event.preventDefault();
    const name = ($('new-league-name').value || '').trim() || 'My Friends League';
    const code = 'BUDDY-' + Math.floor(Math.random() * 8999 + 1000);
    const newLeague = { id: 'league-' + Date.now(), name, code, created_at: new Date().toISOString().slice(0, 10), members: [] };
    const list = getStoredLeagues();
    list.unshift(newLeague);
    saveStoredLeagues(list);
    activeLeagueId = newLeague.id;
    $('league-modal').hidden = true;
    toast('League created! Share code ' + code + ' with friends.');
    render();
  }'''

new_submit_create_league = '''if (event.target.id === 'create-league-form') {
    event.preventDefault();
    const name = ($('new-league-name').value || '').trim() || 'My Friends League';
    const icon = ($('new-league-icon') && $('new-league-icon').value) || '⚽';
    const freq = ($('new-league-freq') && $('new-league-freq').value) || 'weekly';
    const code = 'BUDDY-' + Math.floor(Math.random() * 8999 + 1000);
    const newLeague = {
      id: 'league-' + Date.now(),
      name,
      icon,
      freq,
      code,
      created_at: new Date().toISOString().slice(0, 10),
      members: []
    };
    const list = getStoredLeagues();
    list.unshift(newLeague);
    saveStoredLeagues(list);
    activeLeagueId = newLeague.id;
    $('league-modal').hidden = true;
    toast('League ' + icon + ' ' + name + ' created! Share code ' + code);
    render();
  }'''

assert old_submit_create_league in app_text, 'old_submit_create_league not found'
app_text = app_text.replace(old_submit_create_league, new_submit_create_league)

# 7. Update handle-form submit in submit listener
old_submit_handle = '''if (event.target.id === 'handle-form') {
    event.preventDefault();
    const handle = $('player-handle-input').value;
    saveUserProfile(handle);
    $('handle-modal').hidden = true;
    toast('Username updated to @' + getUserProfile().handle + '!');
    render();
  }'''

new_submit_handle = '''if (event.target.id === 'handle-form') {
    event.preventDefault();
    const handle = $('player-handle-input').value;
    const town = $('player-town-input') ? $('player-town-input').value : 'Paisley';
    const region = $('player-region-input') ? $('player-region-input').value : 'Renfrewshire';
    const country = $('player-country-input') ? $('player-country-input').value : 'Scotland';
    saveUserProfile(handle, town, region, country);
    $('handle-modal').hidden = true;
    toast('Profile and Regional Ladders updated!');
    render();
  }'''

assert old_submit_handle in app_text, 'old_submit_handle not found'
app_text = app_text.replace(old_submit_handle, new_submit_handle)

with open('app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(app_text)

print('Successfully patched app.js with multi-sport, Option A leagues, geo ladders, and trophy cabinet')
