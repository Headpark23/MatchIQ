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
  // Test 1: Logged out initial state
  console.log('--- Test 1: Logged Out Initial State ---');
  const env1 = createEnv();
  env1.context.updateHeaderAuthUI();
  const container1 = env1.elements['header-auth-container'].innerHTML;
  console.log('Header displays Sign In / Join:', container1.includes('Sign In / Join'));
  console.log('Header has header-auth-btn:', container1.includes('header-auth-btn'));
  if (!container1.includes('Sign In / Join')) throw new Error('Expected Sign In / Join in logged-out state');

  const leagueHtmlLoggedOut = env1.context.viewLeagues();
  console.log('Logged-out league view contains "Continue with Google":', leagueHtmlLoggedOut.includes('Continue with Google'));
  if (!leagueHtmlLoggedOut.includes('Continue with Google')) throw new Error('Expected Continue with Google when logged out');

  // Test 2: User logs in with Google
  console.log('\n--- Test 2: User Logs In with Google ---');
  const mockUser = {
    uid: 'user_12345',
    displayName: 'Martin White',
    email: 'martin@example.com',
    photoURL: ''
  };
  env1.context.saveAuthUser(mockUser);
  const userObj = env1.context.getAuthUser();
  console.log('getAuthUser returns user:', !!userObj);
  console.log('Username is Martin White or derived handle:', userObj.handle);
  env1.context.updateHeaderAuthUI();
  const container2 = env1.elements['header-auth-container'].innerHTML;
  console.log('Header displays user handle:', container2.includes(userObj.handle));
  console.log('Header has header-user-btn:', container2.includes('header-user-btn'));
  console.log('Header has Sign Out button:', container2.includes('Sign Out'));
  console.log('LocalStorage persisted user record:', !!env1.store['betbuddy_auth_user_v1']);
  if (!container2.includes('header-user-btn')) throw new Error('Expected header-user-btn when signed in');

  const leagueHtmlSignedIn = env1.context.viewLeagues();
  console.log('Signed-in league view contains "Continue with Google":', leagueHtmlSignedIn.includes('Continue with Google'));
  if (leagueHtmlSignedIn.includes('Continue with Google')) throw new Error('Failed to remove Continue with Google banner when user is signed in!');
  console.log('✓ Successfully removed "Continue with Google" in league tab for signed-in user');

  // Test 3: Page Reload / Session persistence (simulate fresh tab / browser restart)
  console.log('\n--- Test 3: Session Persistence Across Page Reload ---');
  const savedStore = JSON.parse(JSON.stringify(env1.store));
  const env2 = createEnv(savedStore);
  // Before any Firebase onAuthStateChanged callback runs, check immediate synchronous state:
  const reloadedUser = env2.context.getAuthUser();
  console.log('Reloaded getAuthUser immediately returns user:', !!reloadedUser);
  console.log('Reloaded handle matches:', reloadedUser.handle === userObj.handle);
  env2.context.updateHeaderAuthUI();
  const container3 = env2.elements['header-auth-container'].innerHTML;
  console.log('Immediate header on reload has username:', container3.includes('header-user-btn') && container3.includes(userObj.handle));
  console.log('Zero flash of Sign In / Join on reload:', !container3.includes('Sign In / Join'));
  if (container3.includes('Sign In / Join')) throw new Error('Flashed Sign In / Join on reload!');

  const reloadedLeagueHtml = env2.context.viewLeagues();
  console.log('Reloaded league view contains "Continue with Google":', reloadedLeagueHtml.includes('Continue with Google'));
  if (reloadedLeagueHtml.includes('Continue with Google')) throw new Error('Failed to remove Continue with Google on reload!');

  // Test 4: Explicit Sign Out
  console.log('\n--- Test 4: Explicit Sign Out ---');
  await env2.context.handleSignOut();
  console.log('After signout, getAuthUser is null:', env2.context.getAuthUser() === null);
  console.log('LocalStorage cleaned up:', !env2.store['betbuddy_auth_user_v1']);
  const container4 = env2.elements['header-auth-container'].innerHTML;
  console.log('Header returns to Sign In / Join:', container4.includes('Sign In / Join'));
  if (!container4.includes('Sign In / Join')) throw new Error('Header failed to return to Sign In / Join after signout');

  const signedOutLeagueHtml = env2.context.viewLeagues();
  console.log('After sign out, league view contains "Continue with Google":', signedOutLeagueHtml.includes('Continue with Google'));
  if (!signedOutLeagueHtml.includes('Continue with Google')) throw new Error('Expected Continue with Google when signed out');

  console.log('\n✓ ALL AUTH PERSISTENCE AND LEAGUE TAB TESTS PASSED CLEANLY!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
