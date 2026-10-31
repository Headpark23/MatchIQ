const fs = require('fs');
const js = fs.readFileSync('app.js', 'utf8');
const bb = fs.readFileSync('bet_builder.js', 'utf8');
const mc = fs.readFileSync('market_calculations.js', 'utf8');

const DATA = {
  predictions: JSON.parse(fs.readFileSync('data/predictions.json', 'utf8')),
  reliability: JSON.parse(fs.readFileSync('data/model_reliability.json', 'utf8')),
  fixtures: JSON.parse(fs.readFileSync('data/fixtures.json', 'utf8')),
  odds: JSON.parse(fs.readFileSync('data/odds.json', 'utf8')),
  multiSport: JSON.parse(fs.readFileSync('data/multi_sport_events.json', 'utf8'))
};

const vm = require('vm');

function createEnv(initialStorage = {}) {
  const store = Object.assign({}, initialStorage);
  const elements = {};
  function getEl(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        innerHTML: '',
        value: '',
        textContent: '',
        setAttribute: () => {},
        classList: { toggle: () => {}, add: () => {}, remove: () => {} },
        querySelector: () => null,
        appendChild: () => {},
        removeChild: () => {},
        remove: () => {}
      };
    }
    return elements[id];
  }

  const context = {
    window: { addEventListener: () => {}, location: { hash: '#/leagues', hostname: 'localhost', search: '' }, scrollTo: () => {} },
    addEventListener: () => {},
    scrollTo: () => {},
    location: { hash: '#/leagues', hostname: 'localhost', search: '' },
    document: {
      addEventListener: () => {},
      querySelectorAll: () => [],
      getElementById: (id) => getEl(id),
      querySelector: (sel) => getEl(sel.replace(/^[#.]/, '')),
      createElement: () => ({ appendChild: () => {}, setAttribute: () => {}, classList: { add: () => {}, remove: () => {} }, style: {}, remove: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
      title: ''
    },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    navigator: {},
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: console,
    toast: () => {},
    firebase: {
      apps: [],
      initializeApp: () => {},
      firestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }) }),
      auth: Object.assign(() => ({
        setPersistence: async () => {},
        getRedirectResult: async () => ({ user: null }),
        onAuthStateChanged: () => {},
        signOut: async () => {}
      }), {
        Auth: { Persistence: { LOCAL: 'LOCAL' } },
        GoogleAuthProvider: function() {}
      })
    }
  };
  context.globalThis = context;
  context.window = context;

  vm.createContext(context);
  vm.runInContext(mc, context);
  vm.runInContext(bb, context);
  vm.runInContext(js, context);
  vm.runInContext('Object.assign(DATA, ' + JSON.stringify(DATA) + ');', context);
  return { context, store, elements };
}

async function run() {
  const env = createEnv();
  // Sign in as Martin White
  const mockUser = {
    uid: 'user_martin',
    displayName: 'Martin White',
    email: 'martin@example.com',
    photoURL: ''
  };
  env.context.saveAuthUser(mockUser);

  // Check geo tiers
  const tiers = env.context.getGeoTiers(env.context.getUserProfile());
  console.log('Testing each geo tier for clean user list:');
  for (const tier of tiers) {
    env.context.activeLeagueId = tier.id;
    const html = env.context.viewLeagues();
    const hasHeadPark = html.includes('HeadPark73');
    const hasPunter747 = html.includes('Punter_747');
    const hasPunter737 = html.includes('Punter_737');
    console.log(`  Tier ${tier.name} (${tier.id}):`);
    console.log(`    Contains HeadPark73: ${hasHeadPark}`);
    console.log(`    Contains Punter_747: ${hasPunter747}`);
    console.log(`    Contains Punter_737: ${hasPunter737}`);
    console.log(`    Contains YOU / Martin White: ${html.includes('YOU') || html.includes('Martin')}`);

    if (hasHeadPark || hasPunter747 || hasPunter737) {
      throw new Error(`Fake users still present in ${tier.name}!`);
    }
  }

  // Verify getStoredGeoMembers returns empty array
  const geoMembers = env.context.getStoredGeoMembers('geo-town');
  console.log('\ngetStoredGeoMembers length:', geoMembers.length);
  if (geoMembers.length !== 0) throw new Error('getStoredGeoMembers returned non-empty fallback array');

  // Verify getStoredLeagues returns empty array
  const customLeagues = env.context.getStoredLeagues();
  console.log('getStoredLeagues length:', customLeagues.length);
  if (customLeagues.length !== 0) throw new Error('getStoredLeagues returned pre-seeded dummy leagues');

  console.log('\n✓ ALL CLEAN GEO LEAGUES TESTS PASSED PERFECTLY!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
