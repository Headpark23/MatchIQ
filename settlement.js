'use strict';

// Bet settlement shared by the app (Bet Diary auto-settlement) and the server (league scoring),
// so a bet is read and settled the same way everywhere. Create one settler per fixtures source:
//   const settler = BetBuddySettlement.create(() => fixturesArray);
(function attach(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BetBuddySettlement = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function build() {
  const kickoffMs = f => Date.parse((f && (f.kickoff_utc || (f.fixture && f.fixture.kickoff_utc))) || '');

  function create(getFixtures) {
    const fixtureFinished = f => !!(f && f.status === 'FINISHED' && Array.isArray(f.score) && f.score.length === 2 && f.score.every(n => Number.isFinite(Number(n))));

    // ---- Team-name resolution: "Manchester City", "Man City" and "Man. City FC" are all the same club.
    // Names are normalised (accents, punctuation, "FC"/"AC" noise) and looked up in an alias table, so free-text
    // bets match the fixture feed whatever spelling the user typed.
    const TEAM_ALIASES = {
      'AC Milan': ['milan', 'ac milan', 'a c milan'], 'AZ Alkmaar': ['az', 'az alkmaar'], 'Alaves': ['deportivo alaves'],
      'Athletic Club': ['athletic bilbao', 'athletic', 'bilbao'], 'Atletico Madrid': ['atletico', 'atletico de madrid', 'atl madrid', 'atletico madrid'],
      'Bayern Munich': ['bayern', 'bayern munchen', 'fc bayern', 'fc bayern munich', 'bayern munich'], 'Birmingham': ['birmingham city'],
      'Blackburn': ['blackburn rovers'], 'Bolton': ['bolton wanderers'], 'Bournemouth': ['afc bournemouth'],
      'Brighton': ['brighton and hove albion', 'brighton hove albion', 'brighton & hove albion'], 'Cardiff': ['cardiff city'],
      'Celta Vigo': ['celta', 'celta de vigo', 'rc celta'], 'Charlton': ['charlton athletic'], 'Cheltenham': ['cheltenham town'],
      'Coventry': ['coventry city'], 'Crewe': ['crewe alexandra'], 'Derby': ['derby county'], 'Doncaster': ['doncaster rovers'],
      'Dortmund': ['borussia dortmund', 'bvb', 'bor dortmund'], 'Eintracht Frankfurt': ['frankfurt', 'e frankfurt'],
      'Espanyol': ['rcd espanyol'], 'Exeter': ['exeter city'], 'FC Koln': ['koln', 'cologne', '1 fc koln', 'fc cologne'],
      'FC Porto': ['porto'], 'FC Twente': ['twente'], 'FC Utrecht': ['utrecht'], 'FC Groningen': ['groningen'],
      'Fleetwood': ['fleetwood town'], 'Freiburg': ['sc freiburg'], 'Grimsby': ['grimsby town'], 'Hamburg': ['hamburger sv', 'hsv', 'hamburg sv'],
      'Hearts': ['heart of midlothian'], 'Hibernian': ['hibs'], 'Hoffenheim': ['tsg hoffenheim', 'tsg 1899 hoffenheim'],
      'Huddersfield': ['huddersfield town'], 'Hull': ['hull city'], 'Inter': ['inter milan', 'internazionale', 'inter'],
      'Ipswich': ['ipswich town'], 'Juventus': ['juve'], 'Kilmarnock': ['killie'], 'Leeds': ['leeds united'], 'Leicester': ['leicester city'],
      'Leverkusen': ['bayer leverkusen', 'bayer 04 leverkusen', 'bayer 04'], 'Lincoln': ['lincoln city'],
      'Lyon': ['olympique lyonnais', 'olympique lyon', 'ol'], 'Marseille': ['olympique marseille', 'olympique de marseille'],
      'Mainz': ['mainz 05', 'fsv mainz 05', '1 fsv mainz 05'], "M'gladbach": ['monchengladbach', 'borussia monchengladbach', 'gladbach', 'mgladbach', 'b monchengladbach'],
      'Man City': ['manchester city', 'man city', 'man c'], 'Man United': ['manchester united', 'manchester utd', 'man utd', 'man united', 'man u'],
      'Newcastle': ['newcastle united', 'newcastle utd'], "Nott'm Forest": ['nottingham forest', 'nottm forest', 'nott m forest', 'notts forest', 'forest'],
      'Norwich': ['norwich city'], 'Paris SG': ['psg', 'paris saint germain', 'paris st germain', 'paris saint-germain', 'paris sg'],
      'PSV': ['psv eindhoven'], 'QPR': ['queens park rangers'], "Queen's Park": ['queens park'], 'RB Leipzig': ['leipzig', 'rasenballsport leipzig', 'rb leipzig'],
      'Real Betis': ['betis'], 'Real Sociedad': ['sociedad'], 'Rennes': ['stade rennais'], 'Rotherham': ['rotherham united'],
      'Roma': ['as roma'], 'Salford City': ['salford'], 'Schalke 04': ['schalke'], 'Sheffield United': ['sheffield utd', 'sheff utd', 'sheff united'],
      'SC Braga': ['braga', 'sporting braga'], 'Sporting CP': ['sporting lisbon', 'sporting'], 'St. Johnstone': ['st johnstone', 'saint johnstone'],
      'St. Mirren': ['st mirren', 'saint mirren'], 'Standard Liege': ['standard'], 'Stockport': ['stockport county'], 'Stoke': ['stoke city'],
      'Strasbourg': ['rc strasbourg'], 'Stuttgart': ['vfb stuttgart', 'stuttgart'], 'Swansea': ['swansea city'], 'Tottenham': ['tottenham hotspur', 'spurs', 'tottenham'],
      'Union Berlin': ['1 fc union berlin', 'fc union berlin'], 'Union SG': ['union saint gilloise', 'union st gilloise', 'royale union saint gilloise'],
      'Vitoria Guimaraes': ['vitoria sc', 'guimaraes', 'vitoria de guimaraes'], 'West Brom': ['west bromwich albion', 'west bromwich', 'wba'],
      'West Ham': ['west ham united', 'west ham utd'], 'Wigan': ['wigan athletic'], 'Wolves': ['wolverhampton wanderers', 'wolverhampton'],
      'Wrexham': ['wrexham afc'], 'Wycombe': ['wycombe wanderers'], 'sc Heerenveen': ['heerenveen'], 'Deportivo La Coruna': ['deportivo', 'depor', 'la coruna', 'deportivo de la coruna'],
      'Greenock Morton': ['morton'], 'Partick Thistle': ['partick'], 'Raith Rovers': ['raith'], 'Airdrieonians': ['airdrie'],
      'Dunfermline': ['dunfermline athletic'], 'Hamilton': ['hamilton academical'], 'Ayr United': ['ayr'], 'Dundee United': ['dundee utd'],
      'Go Ahead Eagles': ['ga eagles'], 'Sparta Rotterdam': ['sparta'], 'RKC Waalwijk': ['rkc'], 'Racing Santander': ['racing', 'r santander'],
      'Rayo Vallecano': ['rayo'], 'Royal Antwerp': ['antwerp'], 'KRC Genk': ['genk'], 'KAA Gent': ['gent'], 'KV Mechelen': ['mechelen'],
      'Sint-Truiden': ['sint truiden', 'st truiden'], 'Cercle Brugge': ['cercle'], 'Club Brugge': ['brugge'], 'Dinamo Zagreb': ['gnk dinamo zagreb'],
      'Fortuna Sittard': ['fortuna'], 'Santa Clara': ['cd santa clara'], 'Moreirense': ['moreirense fc'], 'Famalicao': ['fc famalicao'],
      'Gil Vicente': ['gil vicente fc'], 'Rio Ave': ['rio ave fc'], 'Le Havre': ['havre', 'le havre ac'], 'Paris FC': ['paris f c']
    };
    // Different names the feed uses for the same club.
    const TEAM_SAME_CLUB = { 'Inter Milan': 'Inter', 'VfB Stuttgart': 'Stuttgart' };
    const TEAM_NOISE_EDGE = new Set(['fc', 'afc', 'cf', 'ac', 'sc', 'kaa', 'krc', 'kv', 'rkc', 'as', 'rcd', '1']);

    function liteText(s) {
      return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/([a-z])\./g, '$1').replace(/([a-z])-(?=[a-z])/g, '$1 ')
        .replace(/[:;,()|"]/g, ' ').replace(/\//g, ' / ')
        .replace(/\s+/g, ' ').trim();
    }
    const teamGroup = name => liteText(TEAM_SAME_CLUB[name] || name);

    let teamIndexCache = null, teamIndexSize = -1;
    function teamIndex() {
      const fx = getFixtures();
      if (teamIndexCache && teamIndexSize === fx.length) return teamIndexCache;
      const phraseToGroup = new Map();
      const add = (phrase, group) => { const p = liteText(phrase); if (p.length >= 2 && !phraseToGroup.has(p)) phraseToGroup.set(p, group); };
      const names = new Set();
      fx.forEach(f => { names.add(f.home); names.add(f.away); });
      Object.keys(TEAM_ALIASES).forEach(n => names.add(n));
      names.forEach(n => {
        if (!n) return;
        const g = teamGroup(n);
        add(n, g);
        const toks = liteText(n).split(' ');
        while (toks.length > 1 && TEAM_NOISE_EDGE.has(toks[0])) toks.shift();
        while (toks.length > 1 && TEAM_NOISE_EDGE.has(toks[toks.length - 1])) toks.pop();
        if (toks.join(' ').length >= 4) add(toks.join(' '), g);
        (TEAM_ALIASES[n] || TEAM_ALIASES[TEAM_SAME_CLUB[n]] || []).forEach(a => add(a, g));
      });
      teamIndexCache = { phrases: Array.from(phraseToGroup.entries()).sort((x, y) => y[0].length - x[0].length) };
      teamIndexSize = fx.length;
      return teamIndexCache;
    }

    /* Finds every club named in a free-text bet, longest names first so "Dundee United" is never read as "Dundee".
       Returns the mentions in the order they were written, plus the text with club names blanked out. */
    function teamMentions(text) {
      let s = ' ' + liteText(text) + ' ';
      const orig = s;
      const found = [];
      for (const [phrase, group] of teamIndex().phrases) {
        const needle = ' ' + phrase + ' ';
        let idx = s.indexOf(needle);
        while (idx >= 0) {
          found.push({ group, start: idx + 1, end: idx + 1 + phrase.length });
          s = s.slice(0, idx + 1) + ' '.repeat(phrase.length) + s.slice(idx + 1 + phrase.length);
          idx = s.indexOf(needle);
        }
      }
      found.sort((a, b) => a.start - b.start);
      return { found, rest: s.replace(/\s+/g, ' ').trim(), orig };
    }

    function settleTextAgainstScore(rawText, home, away, score) {
      const h = Number(score[0]), a = Number(score[1]);
      const homeG = teamGroup(home), awayG = teamGroup(away);
      const m = teamMentions(rawText);
      let ms = m.found.filter(x => x.group === homeG || x.group === awayG);
      // "Home v Away: Pick" or "Pick (Home v Away)" - drop the fixture label (two clubs joined by v/vs/-) so only the picked club is left
      for (let i = 0; i < ms.length - 1; i++) {
        if (ms[i].group === ms[i + 1].group) continue;
        const sep = m.orig.slice(ms[i].end, ms[i + 1].start).trim();
        if (/^(v|vs|versus|x|-|against|@)$/.test(sep)) { ms = ms.slice(0, i).concat(ms.slice(i + 2)); break; }
        // "Home to beat Away" / "Home to win against Away": the club written first is the pick
        if (/^(to )?(beat|defeat|win (against|vs|v|over))$/.test(sep)) { ms = ms.slice(0, i).concat(ms[i], ms.slice(i + 2)); break; }
        // "Home to lose to Away": the club written second is the pick
        if (/^(to )?(lose to|lose against|lose vs)$/.test(sep)) { ms = ms.slice(0, i).concat(ms[i + 1], ms.slice(i + 2)); break; }
      }
      const pickHome = ms.some(x => x.group === homeG), pickAway = ms.some(x => x.group === awayG);
      const t = m.rest;

      if (/corner|card|booking|shot|offside|foul|throw|player|scorer|anytime|first goal|half|handicap|minute|penalt|clean sheet|exact|correct score/.test(t)) return null;
      if (/(^|[\s(])[+-]\s?\d/.test(t)) return null;

      if (/both teams to score|btts|\bgg\b|\bng\b/.test(t)) {
        const no = /\bno\b|\bng\b/.test(t) && !/\byes\b|\bgg\b/.test(t);
        const both = h > 0 && a > 0;
        return (no ? !both : both) ? 'won' : 'lost';
      }
      const ou = t.match(/\b(over|under)\s*(\d+(?:\.\d+)?)/);
      if (ou) {
        if (pickHome || pickAway) return null;  // team goals, not match goals
        const line = Number(ou[2]), total = h + a;
        if (total === line) return null;
        return ((ou[1] === 'over') === (total > line)) ? 'won' : 'lost';
      }
      if (/draw no bet|\bdnb\b|no draw/.test(t)) return null;
      const dc = t.match(/\b(1x|x2|12)\b/);
      if (dc) return ((dc[1] === '1x' && h >= a) || (dc[1] === 'x2' && a >= h) || (dc[1] === '12' && h !== a)) ? 'won' : 'lost';
      if (/draw/.test(t)) {
        if (pickHome && !pickAway) return h >= a ? 'won' : 'lost';
        if (pickAway && !pickHome) return a >= h ? 'won' : 'lost';
        if (/\bor\b|\/|&|double chance/.test(t)) return null;
        return h === a ? 'won' : 'lost';
      }
      let side = null;
      if (pickHome && !pickAway) side = 'home';
      else if (pickAway && !pickHome) side = 'away';
      else if (/\bhome\b/.test(t) && !/\baway\b/.test(t)) side = 'home';
      else if (/\baway\b/.test(t) && !/\bhome\b/.test(t)) side = 'away';
      if (!side) return null;
      return (side === 'home' ? h > a : a > h) ? 'won' : 'lost';
    }

    function findDiaryFixture(text, entry) {
      const groups = new Set(teamMentions(text).found.map(x => x.group));
      if (groups.size < 2) return null;
      const since = Date.parse((entry.date || (entry.timestamp || '').slice(0, 10) || '1970-01-01') + 'T00:00:00Z') - 86400000;
      const hits = getFixtures().filter(f => groups.has(teamGroup(f.home)) && groups.has(teamGroup(f.away)) && kickoffMs(f) >= since)
        .sort((x, y) => kickoffMs(x) - kickoffMs(y));
      return hits[0] || null;
    }

    // ---- Market classification for league scoring.
    // A bet's market is identified by how it would settle on every plausible score: "Arsenal win",
    // "Arsenal to beat Spurs" and "1" all settle exactly like the home-win market, so they are that
    // market. Only markets with a recorded bookmaker price can be scored, so those are the candidates.
    const SCORE_GRID = [];
    for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) SCORE_GRID.push([h, a]);

    function settleMarket(market, score) {
      const h = Number(score[0]), a = Number(score[1]);
      if (market === 'result:H') return h > a ? 'won' : 'lost';
      if (market === 'result:D') return h === a ? 'won' : 'lost';
      if (market === 'result:A') return a > h ? 'won' : 'lost';
      const m = /^goals:(over|under):(\d+(?:\.\d+)?)$/.exec(market || '');
      if (m) {
        const line = Number(m[2]), total = h + a;
        if (total === line) return 'void';
        return ((m[1] === 'over') === (total > line)) ? 'won' : 'lost';
      }
      return null;
    }

    function classifyMarket(text, home, away, candidates) {
      const outcomes = SCORE_GRID.map(sc => settleTextAgainstScore(text, home, away, sc));
      if (outcomes.some(o => o !== 'won' && o !== 'lost')) return null;
      return (candidates || []).find(market => SCORE_GRID.every((sc, i) => {
        const r = settleMarket(market, sc);
        return r === outcomes[i] || (r === 'void' && outcomes[i] === null);
      })) || null;
    }

    // The next match a bet refers to, kicking off after `sinceMs` (within two weeks): both clubs when
    // the text names two ("Arsenal v Spurs: Arsenal"), or the one club's next match ("Arsenal win").
    // Used for accumulator legs, which usually name just the club backed.
    function findUpcomingFixture(text, sinceMs) {
      const groups = Array.from(new Set(teamMentions(text).found.map(x => x.group)));
      if (!groups.length || groups.length > 2) return null;
      const plays = f => groups.includes(teamGroup(f.home)) || groups.includes(teamGroup(f.away));
      const both = f => groups.includes(teamGroup(f.home)) && groups.includes(teamGroup(f.away));
      const hits = getFixtures()
        .filter(f => kickoffMs(f) > sinceMs && kickoffMs(f) - sinceMs < 14 * 86400000 && (groups.length === 2 ? both(f) : plays(f)))
        .sort((x, y) => kickoffMs(x) - kickoffMs(y));
      return hits[0] || null;
    }

    return { fixtureFinished, liteText, teamGroup, teamMentions, settleTextAgainstScore, findDiaryFixture, findUpcomingFixture, settleMarket, classifyMarket };
  }

  return { create };
});
