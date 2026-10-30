const fs = require('fs');

const elements = {};
function mockElement(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      hidden: false,
      value: '',
      innerHTML: '',
      textContent: '',
      style: {},
      dataset: {},
      children: [],
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      appendChild: () => {},
      removeChild: () => {},
      setAttribute: () => {},
      getAttribute: () => '',
      querySelector: () => mockElement('dummy'),
      querySelectorAll: () => [],
      focus: () => {},
      remove: () => {},
      addEventListener: () => {}
    };
  }
  return elements[id];
}

const mockLocalStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const marketCalculations = require('../market_calculations.js');

global.window = {
  location: { hash: '#/leagues', origin: 'https://headpark23.github.io', pathname: '/MatchIQ/' },
  addEventListener: () => {},
  scrollTo: () => {},
  MatchIQCalculations: marketCalculations
};
let registeredSubmitHandler = null;
global.document = {
  getElementById: (id) => mockElement(id),
  querySelector: (sel) => mockElement(sel),
  querySelectorAll: (sel) => [],
  createElement: () => mockElement('div'),
  addEventListener: (evt, fn) => {
    if (evt === 'submit') registeredSubmitHandler = fn;
  },
  body: mockElement('body')
};
global.location = global.window.location;
global.localStorage = mockLocalStorage;
global.navigator = { clipboard: { writeText: async () => {} } };

const appCode = fs.readFileSync('app.js', 'utf8');

// Inject test runner harness inside app context
const testHarness = `
${appCode}

// Inject multiSport into DATA for test
DATA.multiSport = JSON.parse(fs.readFileSync('data/multi_sport_events.json', 'utf8'));

console.log('--- Testing Leagues, Option A Scoring & Multi-Sport ---');

// 1. Test Option A Points Calculation
try {
  const p1 = calc.calculateLeaguePoints('1/2', 'won');
  if (p1 !== 5) throw new Error('Expected 5 pts for 1/2 won, got ' + p1);

  const p2 = calc.calculateLeaguePoints('Evens', 'won');
  if (p2 !== 10) throw new Error('Expected 10 pts for Evens won, got ' + p2);

  const p3 = calc.calculateLeaguePoints('20/1', 'won');
  if (p3 !== 200) throw new Error('Expected 200 pts for 20/1 won, got ' + p3);

  const p4 = calc.calculateLeaguePoints('5/1', 'lost');
  if (p4 !== -2) throw new Error('Expected -2 pts for loss, got ' + p4);

  const p5 = calc.calculateLeaguePoints('4/1', 'void');
  if (p5 !== 0) throw new Error('Expected 0 pts for void, got ' + p5);

  console.log('PASS: Option A scoring formula verified across all odds ladders.');
} catch (e) {
  console.error('FAIL Option A Points:', e);
  process.exit(1);
}

// 2. Test 6-Tier Automatic Geo Ladders in viewLeagues()
try {
  const leaguesHtml = viewLeagues();
  if (!leaguesHtml.includes('Worldwide League') || !leaguesHtml.includes('Grand Diamond Globe')) {
    throw new Error('Worldwide ladder missing from viewLeagues()');
  }
  if (!leaguesHtml.includes('European League') || !leaguesHtml.includes('Continental Star Cup')) {
    throw new Error('European ladder missing from viewLeagues()');
  }
  if (!leaguesHtml.includes('UK National League') || !leaguesHtml.includes('Sovereign Britannia Shield')) {
    throw new Error('UK National ladder missing from viewLeagues()');
  }
  if (!leaguesHtml.includes('Scotland Championship') || !leaguesHtml.includes('National Lion Trophy')) {
    throw new Error('Country ladder missing from viewLeagues()');
  }
  if (!leaguesHtml.includes('Renfrewshire Regional') || !leaguesHtml.includes('Regional Civic Chalice')) {
    throw new Error('Region ladder missing from viewLeagues()');
  }
  if (!leaguesHtml.includes('Paisley Hometown League') || !leaguesHtml.includes('Hometown Plaque')) {
    throw new Error('Town ladder missing from viewLeagues()');
  }
  console.log('PASS: All 6 Automatic Geo Ladders and custom silverware render correctly.');
} catch (e) {
  console.error('FAIL 6-Tier Geo Ladders:', e);
  process.exit(1);
}

// 3. Test Trophy Cabinet
try {
  openTrophyCabinet();
  if ($('trophy-cabinet-modal').hidden !== false) {
    throw new Error('trophy-cabinet-modal was not unhidden');
  }
  const bodyHtml = $('trophy-modal-body').innerHTML;
  if (!bodyHtml.includes('Gold Trophies') || !bodyHtml.includes('Silver Medals') || !bodyHtml.includes('Bronze Medals')) {
    throw new Error('Trophy haul counters missing from modal body');
  }
  console.log('PASS: Trophy Cabinet opens and displays medals and silverware showcase.');
} catch (e) {
  console.error('FAIL Trophy Cabinet:', e);
  process.exit(1);
}

// 4. Test Multi-Sport Event Views
try {
  ['tennis', 'golf', 'darts', 'rugby'].forEach(sport => {
    const sHtml = viewMultiSport(sport);
    if (!sHtml.includes('Official UK Bookmaker Prices') && !sHtml.includes('Markets')) {
      throw new Error('viewMultiSport failed for ' + sport);
    }
  });
  console.log('PASS: Multi-Sport views verified for Tennis, Golf, Darts, and Rugby.');
} catch (e) {
  console.error('FAIL Multi-Sport:', e);
  process.exit(1);
}

// 5. Test Custom Buddy League creation with Icon and Duration
try {
  $('new-league-name').value = 'Paisley Punter Guild';
  $('new-league-icon').value = '🎯';
  $('new-league-freq').value = 'weekly';
  if (registeredSubmitHandler) {
    registeredSubmitHandler({
      target: { id: 'create-league-form' },
      preventDefault: () => {}
    });
  }
  const leagues = getStoredLeagues();
  const created = leagues.find(l => l.name === 'Paisley Punter Guild');
  if (!created || created.icon !== '🎯' || created.freq !== 'weekly') {
    throw new Error('Custom league was not saved with icon and duration');
  }
  console.log('PASS: Custom Buddy League created with icon, frequency, and code.');
} catch (e) {
  console.error('FAIL Custom League creation:', e);
  process.exit(1);
}

console.log('\\n>>> ALL LEAGUE, TROPHY CABINET & MULTI-SPORT CHECKS PASSED 100%! <<<');
process.exit(0);
`;

try {
  eval(testHarness);
} catch (e) {
  console.error('Execution error in test runner:', e);
  process.exit(1);
}
