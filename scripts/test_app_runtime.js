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

global.window = {
  location: { hash: '#/admin', origin: 'https://headpark23.github.io', pathname: '/MatchIQ/' },
  addEventListener: () => {},
  scrollTo: () => {},
  MatchIQCalculations: {
    formatFractionalOdds: (o) => (o > 1 ? (Math.round((o - 1) * 10) + '/10') : '1/1'),
    formatDecimalOdds: (o) => Number(o).toFixed(2),
    impliedProbability: (o) => (o > 0 ? (1 / o) : 0),
    evPercent: (p, o) => ((p * o - 1) * 100),
    parseFractionalOdds: () => 2.0,
    loadBetDiary: () => [],
    saveBetDiary: () => {}
  }
};
global.document = {
  getElementById: (id) => mockElement(id),
  querySelector: (sel) => mockElement(sel),
  querySelectorAll: (sel) => [],
  addEventListener: () => {},
  body: mockElement('body')
};
global.location = global.window.location;
global.localStorage = mockLocalStorage;
global.navigator = { clipboard: { writeText: async () => {} } };

const appCode = fs.readFileSync('app.js', 'utf8');

// Inject test runner harness inside app context
const testHarness = `
${appCode}

// Test Suite
console.log('--- Testing App Functions ---');

// 1. Test Telemetry / Admin View with empty localStorage
try {
  const adminHtmlEmpty = viewAdmin();
  if (typeof adminHtmlEmpty !== 'string' || !adminHtmlEmpty.includes('Commercial & Founder Telemetry')) {
    throw new Error('viewAdmin did not return expected HTML');
  }
  console.log('PASS: viewAdmin() with empty localStorage renders correctly');
} catch (e) {
  console.error('FAIL viewAdmin() empty:', e);
  process.exit(1);
}

// 2. Test Telemetry / Admin View with corrupted / legacy localStorage
try {
  localStorage.setItem('betbuddy_traffic_stats_v1', JSON.stringify({ visitsToday: 5 }));
  const adminHtmlCorrupted = viewAdmin();
  if (!adminHtmlCorrupted.includes('7-Day Punter Activity')) {
    throw new Error('viewAdmin failed with partial stats');
  }
  console.log('PASS: viewAdmin() with partial/legacy stats renders safely');
} catch (e) {
  console.error('FAIL viewAdmin() corrupted:', e);
  process.exit(1);
}

// 3. Test viewMore()
try {
  const moreHtml = viewMore();
  if (!moreHtml.includes('Commercial &amp; Founder Portal') || !moreHtml.includes('Privacy Notice &amp; UK GDPR')) {
    throw new Error('viewMore missing commercial or GDPR portal elements');
  }
  console.log('PASS: viewMore() renders commercial and GDPR links');
} catch (e) {
  console.error('FAIL viewMore():', e);
  process.exit(1);
}

// 4. Test openUniversalShare
try {
  openUniversalShare({ title: 'My Bet', text: 'Acca details', url: 'https://betbuddyuk.uk' });
  const shareModal = $('share-modal');
  if (shareModal.hidden !== false) {
    throw new Error('share-modal was not unhidden');
  }
  console.log('PASS: openUniversalShare opens share modal properly');
} catch (e) {
  console.error('FAIL openUniversalShare():', e);
  process.exit(1);
}

// 5. Test toggleAccumulatorFields
try {
  $('modal-bet-type').value = 'accumulator';
  toggleAccumulatorFields();
  if ($('single-fixture-row').hidden !== true) {
    throw new Error('single-fixture-row was not hidden for accumulator');
  }
  if ($('accumulator-legs-row').hidden !== false) {
    throw new Error('accumulator-legs-row was not unhidden for accumulator');
  }
  console.log('PASS: toggleAccumulatorFields correctly toggles single-fixture-row');
} catch (e) {
  console.error('FAIL toggleAccumulatorFields():', e);
  process.exit(1);
}

// 6. Test openDiary logged in vs logged out
try {
  // Test logged in
  localStorage.setItem('betbuddy_auth_user_v1', JSON.stringify({ signedIn: true, handle: 'PunterDave', name: 'Dave' }));
  openDiary();
  if ($('modal-profile-row').hidden !== true) {
    throw new Error('modal-profile-row should be hidden when logged in');
  }
  if ($('modal-profile').value !== '@PunterDave') {
    throw new Error('modal-profile value should be @PunterDave');
  }

  // Test logged out
  localStorage.removeItem('betbuddy_auth_user_v1');
  openDiary();
  if ($('modal-profile-row').hidden !== false) {
    throw new Error('modal-profile-row should be visible when logged out');
  }
  console.log('PASS: openDiary properly toggles profile row based on login status');
} catch (e) {
  console.error('FAIL openDiary profile:', e);
  process.exit(1);
}

// 7. Test openBookieModal and logAffiliateClick
try {
  openBookieModal({ selection: 'Man City Win', fair: '4/6' });
  if ($('bookie-modal').hidden !== false) {
    throw new Error('bookie-modal was not unhidden');
  }
  logAffiliateClick('Ladbrokes');
  const clicks = getAffiliateClicks();
  if (clicks[0].bookie !== 'Ladbrokes' || clicks[0].selection !== 'Man City Win') {
    throw new Error('logAffiliateClick did not record click properly');
  }
  console.log('PASS: openBookieModal and logAffiliateClick work seamlessly');
} catch (e) {
  console.error('FAIL bookie test:', e);
  process.exit(1);
}
`;

try {
  eval(testHarness);
  console.log('\\n>>> ALL 7 RUNTIME HEALTH SUITE VERIFICATIONS PASSED 100%! <<<');
} catch (e) {
  console.error('Execution error:', e);
  process.exit(1);
}
