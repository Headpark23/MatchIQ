'use strict';
// Runs the real app.js on several simulated devices against one in-memory Firestore that applies
// the same league rules as firestore.rules (members need an existing league and no ban; stat
// refreshes are update-only). Checks the league lifecycle end to end: create, invite link, kick,
// leave, delete, a second device catching up, and that league names can never inject HTML.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const sources = ['market_calculations.js', 'bet_builder.js', 'settlement.js', 'league_sync.js', 'app.js'].map(f => fs.readFileSync(f, 'utf8'));

// ------------------------------------------------------------ in-memory Firestore
function fsError(code) { const e = new Error(code); e.code = code; return e; }

function createCloud() {
  const docs = new Map();      // path -> data
  const listeners = new Set(); // { path, isCollection, cb }
  const stats = { memberCreates: 0 };
  const parentOf = path => path.split('/').slice(0, -1).join('/');

  function snapOf(db, path) {
    const data = docs.get(path);
    return { id: path.split('/').pop(), exists: data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))), ref: new DocRef(db, path), metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function querySnap(db, colPath) {
    const list = [...docs.keys()].filter(p => parentOf(p) === colPath).sort().map(p => snapOf(db, p));
    return { docs: list, empty: !list.length, size: list.length, forEach: fn => list.forEach(fn), metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function notify(db, paths) {
    for (const l of [...listeners]) {
      if (l.isCollection ? paths.some(p => parentOf(p) === l.path) : paths.includes(l.path)) {
        setTimeout(() => l.cb(l.isCollection ? querySnap(db, l.path) : snapOf(db, l.path)), 0);
      }
    }
  }

  // The parts of firestore.rules the app's league logic depends on.
  function checkRules(uid, ops, after) {
    for (const op of ops) {
      const m = op.path.match(/^leagues\/([^/]+)\/members\/([^/]+)$/);
      if (op.kind === 'update' && !docs.has(op.path)) throw fsError('not-found');
      if (m && op.kind !== 'delete') {
        if (m[2] !== uid) throw fsError('permission-denied');
        const owner = after.get('handles/' + String(after.get(op.path).handle).toLowerCase());
        if (!owner || owner.uid !== uid) throw fsError('permission-denied');
        if (!after.has('leagues/' + m[1])) throw fsError('permission-denied');
        if (!docs.has(op.path)) {
          if (docs.has('leagues/' + m[1] + '/banned/' + m[2])) throw fsError('permission-denied');
          if (!('joinedAt' in op.data)) throw fsError('permission-denied');
        } else if ('joinedAt' in op.data && op.data.joinedAt !== docs.get(op.path).joinedAt) {
          throw fsError('permission-denied');
        }
      }
      const STATS = ['points', 'winRate', 'roi', 'settled', 'form', 'periods', 'scoredAt'];
      if (m && op.kind !== 'delete') {
        const before = docs.get(op.path) || {};
        if (STATS.some(k => k in op.data && JSON.stringify(op.data[k]) !== JSON.stringify(before[k]))) throw fsError('permission-denied');
      }
      const bm = op.path.match(/^users\/([^/]+)\/leagueBets\/([^/]+)$/);
      if (bm) {
        if (bm[1] !== uid) throw fsError('permission-denied');
        if (op.kind !== 'delete' && docs.has(op.path)) throw fsError('permission-denied');  // create only
        if (op.kind !== 'delete' && Object.keys(op.data).some(k => !['betId', 'fixtureId', 'selection', 'odds', 'createdAt'].includes(k))) throw fsError('permission-denied');
      }
      if (/^(leagueStats|ladders)\//.test(op.path)) throw fsError('permission-denied');
      const lm = op.path.match(/^leagues\/([^/]+)$/);
      if (lm && op.kind !== 'delete') {
        const d = after.get(op.path);
        if (/[<>&"]/.test(d.name) || /[<>&"]/.test(d.icon)) throw fsError('permission-denied');
        if (docs.has(op.path) && docs.get(op.path).creatorUid !== uid) throw fsError('permission-denied');
      }
      if (/^users\/[^/]+$/.test(op.path) && op.kind !== 'delete' && 'email' in after.get(op.path)) throw fsError('permission-denied');
    }
  }

  function commit(db, ops) {
    const after = new Map(docs);
    for (const op of ops) {
      if (op.kind === 'delete') after.delete(op.path);
      else if (op.kind === 'set') after.set(op.path, op.merge ? Object.assign({}, after.get(op.path), op.data) : Object.assign({}, op.data));
      else after.set(op.path, Object.assign({}, after.get(op.path), op.data));
    }
    checkRules(db.uid, ops, after);
    for (const op of ops) {
      if (/\/members\/[^/]+$/.test(op.path) && op.kind === 'set' && !docs.has(op.path)) stats.memberCreates++;
    }
    docs.clear();
    after.forEach((v, k) => docs.set(k, v));
    notify(db, ops.map(o => o.path));
  }

  class DocRef {
    constructor(db, path) { this.db = db; this.path = path; this.id = path.split('/').pop(); }
    collection(name) { return new ColRef(this.db, this.path + '/' + name); }
    async get() { return snapOf(this.db, this.path); }
    async set(data, opts) { commit(this.db, [{ kind: 'set', path: this.path, data, merge: !!(opts && opts.merge) }]); }
    async update(data) { commit(this.db, [{ kind: 'update', path: this.path, data }]); }
    async delete() { commit(this.db, [{ kind: 'delete', path: this.path }]); }
    onSnapshot(cb) {
      const l = { path: this.path, isCollection: false, cb };
      listeners.add(l);
      setTimeout(() => cb(snapOf(this.db, this.path)), 0);
      return () => listeners.delete(l);
    }
  }
  class ColRef {
    constructor(db, path) { this.db = db; this.path = path; }
    doc(id) { return new DocRef(this.db, this.path + '/' + id); }
    async get() { return querySnap(this.db, this.path); }
    where() { return this; }  // the app only filters league bets by date; tests use recent ones
    onSnapshot(cb) {
      const l = { path: this.path, isCollection: true, cb };
      listeners.add(l);
      setTimeout(() => cb(querySnap(this.db, this.path)), 0);
      return () => listeners.delete(l);
    }
  }
  function clientFor(uid) {
    const db = {
      uid,
      collection: name => new ColRef(db, name),
      batch() {
        const ops = [];
        return {
          set: (ref, data, opts) => ops.push({ kind: 'set', path: ref.path, data, merge: !!(opts && opts.merge) }),
          update: (ref, data) => ops.push({ kind: 'update', path: ref.path, data }),
          delete: ref => ops.push({ kind: 'delete', path: ref.path }),
          commit: async () => commit(db, ops)
        };
      },
      async runTransaction(fn) {
        const ops = [];
        await fn({
          get: ref => ref.get(),
          set: (ref, data, opts) => ops.push({ kind: 'set', path: ref.path, data, merge: !!(opts && opts.merge) }),
          update: (ref, data) => ops.push({ kind: 'update', path: ref.path, data }),
          delete: ref => ops.push({ kind: 'delete', path: ref.path })
        });
        commit(db, ops);
      },
      useEmulator() {}
    };
    return db;
  }
  return { docs, stats, clientFor };
}

// ------------------------------------------------------------ one simulated device
function makeDevice(cloud, user) {
  const storage = {};
  const session = {};
  const toasts = [];
  const el = () => ({
    innerHTML: '', value: '', hidden: true, textContent: '', className: '', dataset: {}, style: {},
    appendChild() {}, remove() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {},
    querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {}, toggle() {}, contains: () => false }
  });
  const els = {};
  let authCallback = null;
  const location = { hash: '#/leagues', hostname: 'betbuddyuk.uk', pathname: '/', search: '' };
  const db = cloud.clientFor(user.uid);
  const firebase = {
    apps: [],
    initializeApp() { firebase.apps.push({}); },
    firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => new Date().toISOString() }, FieldPath: { documentId: () => '__name__' } }),
    auth: Object.assign(() => ({
      setPersistence: () => Promise.resolve(),
      getRedirectResult: () => Promise.resolve(null),
      onAuthStateChanged: cb => { authCallback = cb; }
    }), { Auth: { Persistence: { LOCAL: 'local' } } })
  };
  const ctx = vm.createContext({
    firebase,
    location,
    history: { replaceState(_s, _t, url) { location.hash = url.slice(url.indexOf('#')); } },
    addEventListener() {}, scrollTo() {},
    document: {
      getElementById: id => {
        if (id === 'toasts') return Object.assign(el(), { appendChild: t => toasts.push(t.textContent) });
        return (els[id] = els[id] || el());
      },
      querySelectorAll: () => [], querySelector: () => null, createElement: () => el(),
      body: el(), documentElement: el(), addEventListener() {}
    },
    localStorage: {
      getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); },
      removeItem: k => { delete storage[k]; }, get length() { return Object.keys(storage).length; }, key: i => Object.keys(storage)[i]
    },
    sessionStorage: { getItem: k => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: k => { delete session[k]; } },
    navigator: { userAgent: 'test', clipboard: { writeText: () => Promise.resolve() } },
    console: { log() {}, warn() {}, error() {}, info() {} },
    confirm: () => true, prompt: () => null,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    crypto: require('crypto').webcrypto,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  });
  ctx.globalThis = ctx;
  ctx.window = ctx;
  sources.forEach(src => vm.runInContext(src, ctx));
  const run = code => vm.runInContext(code, ctx);
  return {
    toasts, storage, run, location,
    async signIn() {
      await authCallback({ uid: user.uid, displayName: user.name, email: user.uid + '@gmail.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] });
      await settle();
    },
    leagues: () => run('getStoredLeagues()'),
    league: code => run('getStoredLeagues()').find(l => l.code === code)
  };
}

const settle = async (n = 15) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 2)); };

(async () => {
  console.log('Testing league cloud sync across users and devices...');
  const cloud = createCloud();
  const alice = makeDevice(cloud, { uid: 'alice', name: 'Alice Park' });
  const alice2 = makeDevice(cloud, { uid: 'alice', name: 'Alice Park' });
  const bob = makeDevice(cloud, { uid: 'bob', name: 'Bob Smith' });
  const imposter = makeDevice(cloud, { uid: 'bob2', name: 'Bob Smith' });

  // Sign-in creates a public profile without email and reserves a unique gamertag.
  await alice.signIn();
  await bob.signIn();
  await imposter.signIn();
  assert(cloud.docs.has('users/alice') && !('email' in cloud.docs.get('users/alice')), 'profile is saved without the email address');
  assert.strictEqual(cloud.docs.get('handles/alicepark').uid, 'alice', 'gamertag is reserved for its owner');
  const bobHandle = cloud.docs.get('users/bob').handle;
  const imposterHandle = cloud.docs.get('users/bob2').handle;
  assert.notStrictEqual(bobHandle.toLowerCase(), imposterHandle.toLowerCase(), 'two players with the same Google name get different gamertags');
  console.log('  PASS: sign-in saves a profile without email and reserves unique gamertags (' + bobHandle + ', ' + imposterHandle + ').');

  // Alice creates a league: league, her member record and her membership all reach the cloud.
  const code = alice.run('generateSecureLeagueCode()');
  alice.run(`(() => { const l = { id: 'league-new', name: 'Paisley Punters', icon: '⚽', freq: 'weekly', code: '${code}', creatorUid: 'alice', is_joined: false, members: [] };
    const list = getStoredLeagues(); list.push(l); saveStoredLeagues(list); return publishLeague(l, getAuthUser()); })()`);
  await settle();
  assert(cloud.docs.has('leagues/' + code), 'league is saved to the cloud');
  assert(cloud.docs.has('leagues/' + code + '/members/alice'), 'creator is a member');
  assert(cloud.docs.has('users/alice/leagueMemberships/' + code), 'creator membership index saved');
  assert.strictEqual(alice.league(code).cloudCreated, true, 'league marked as saved in the cloud');
  console.log('  PASS: creating a league saves it to the cloud.');

  // Bob opens the invite link: he joins exactly once, and the link is consumed.
  bob.location.hash = '#join-league=' + code;
  bob.run('render()');
  for (let i = 0; i < 5; i++) { bob.run('render()'); await settle(3); }
  await settle();
  assert.strictEqual(bob.location.hash, '#/leagues', 'invite link is replaced after use');
  assert(cloud.docs.has('leagues/' + code + '/members/bob'), 'Bob joined');
  assert.strictEqual(cloud.stats.memberCreates, 2, 'Bob joined exactly once despite repeated renders');
  assert.strictEqual(bob.toasts.filter(t => t.startsWith('Joined')).length, 1, 'one "Joined" message');
  console.log('  PASS: opening an invite link joins once; re-renders do not loop.');

  // Bob's stats refresh is an update of his existing record.
  bob.run(`syncLeagueToCloud(getStoredLeagues().find(l => l.code === '${code}'))`);
  await settle();
  assert(cloud.docs.get('leagues/' + code + '/members/bob').joinedAt, 'joinedAt kept on refresh');

  // Only the creator sees Kick and Rename buttons.
  alice.run(`activeLeagueId = getStoredLeagues().find(l => l.code === '${code}').id`);
  bob.run(`activeLeagueId = getStoredLeagues().find(l => l.code === '${code}').id`);
  alice.run('viewLeagues()');  // first render attaches the live members listener
  await settle();
  assert(alice.run('viewLeagues()').includes('data-kick-uid="bob"'), 'creator can kick');
  assert(!bob.run('viewLeagues()').includes('data-kick-player'), 'members cannot see kick buttons');
  assert(!bob.run('viewLeagues()').includes('data-rename-league'), 'members cannot see rename');
  console.log('  PASS: kick and rename controls are shown to the creator only.');

  // Alice kicks Bob. Bob's next sync removes the league from his device instead of re-adding him.
  await alice.run(`kickPlayerFromLeague('${code}', 'bob', '${bobHandle}')`);
  await settle();
  assert(!cloud.docs.has('leagues/' + code + '/members/bob'), 'Bob removed');
  assert(cloud.docs.has('leagues/' + code + '/banned/bob'), 'Bob banned');
  bob.run(`syncLeagueToCloud({ code: '${code}', is_joined: true, cloudCreated: true, freq: 'weekly' })`);
  await settle();
  assert(!cloud.docs.has('leagues/' + code + '/members/bob'), 'a kicked player is not re-added by syncing');
  assert(!bob.league(code), 'the league disappears from the kicked player\'s device');
  assert(!cloud.docs.has('users/bob/leagueMemberships/' + code), 'kicked player\'s membership index cleaned up');
  bob.location.hash = '#join-league=' + code;
  bob.run('render()');
  await settle();
  assert(!cloud.docs.has('leagues/' + code + '/members/bob'), 'a kicked player cannot rejoin with the code');
  assert(bob.toasts.includes('The creator has removed you from this league.'), 'kicked player is told why');
  console.log('  PASS: a kicked player stays out: syncing and the invite code cannot bring them back.');

  // A malicious league name stored in the cloud is shown as text, never as HTML.
  const evilCode = 'EV1LC0DE'.replace(/[01]/g, '2');
  cloud.docs.set('leagues/' + evilCode, { code: evilCode, name: '<img src=x onerror=alert(1)>', icon: '<b>x', freq: 'weekly', creatorUid: 'mallory', createdAt: 'x' });
  imposter.run(`(() => { const l = { id: 'league-evil', code: '${evilCode}', name: '<img src=x onerror=alert(1)>', icon: '<b>x', is_joined: true, creatorUid: 'mallory', members: [] };
    const list = getStoredLeagues(); list.push(l); saveStoredLeagues(list); activeLeagueId = 'league-evil'; })()`);
  const evilHtml = imposter.run('viewLeagues()');
  assert(!/<img|<b>x/.test(evilHtml), 'league name and icon are escaped');
  assert(evilHtml.includes('&lt;img src=x onerror=alert(1)&gt;'), 'name is shown as text');
  console.log('  PASS: league names and icons can never inject HTML.');

  // Alice's second device picks the league up from the cloud.
  await alice2.signIn();
  assert(alice2.league(code) && alice2.league(code).cloudCreated, 'second device has the league');

  // Alice deletes the league on her first device: members, bans and the league are all removed,
  // and her second device does not bring it back.
  alice.run(`activeLeagueId = getStoredLeagues().find(l => l.code === '${code}').id`);
  await alice.run(`deleteLeague(getStoredLeagues().find(l => l.code === '${code}').id, '${code}')`);
  await settle();
  assert(![...cloud.docs.keys()].some(p => p.startsWith('leagues/' + code)), 'league, members and bans all deleted');
  alice2.run(`syncLeagueToCloud(getStoredLeagues().find(l => l.code === '${code}'))`);
  await settle();
  assert(!cloud.docs.has('leagues/' + code), 'a deleted league is not recreated by another device');
  assert(!alice2.league(code), 'the deleted league is removed from the second device');
  console.log('  PASS: deleting a league removes it everywhere and other devices do not resurrect it.');

  // Leaving on one device is not undone by another.
  const code2 = alice.run('generateSecureLeagueCode()');
  alice.run(`(() => { const l = { id: 'league-two', name: 'Second', icon: '⚽', freq: 'weekly', code: '${code2}', creatorUid: 'alice', is_joined: false, members: [] };
    const list = getStoredLeagues(); list.push(l); saveStoredLeagues(list); return publishLeague(l, getAuthUser()); })()`);
  await settle();
  const carol = makeDevice(cloud, { uid: 'carol', name: 'Carol' });
  const carol2 = makeDevice(cloud, { uid: 'carol', name: 'Carol' });
  await carol.signIn();
  await carol.run(`joinCloudLeague('${code2}')`);
  await settle();
  await carol2.signIn();
  assert(carol2.league(code2), 'second device sees the joined league');
  await carol.run(`leaveLeague(getStoredLeagues().find(l => l.code === '${code2}').id, '${code2}')`);
  await settle();
  carol2.run(`syncLeagueToCloud(getStoredLeagues().find(l => l.code === '${code2}'))`);
  await settle();
  assert(!cloud.docs.has('leagues/' + code2 + '/members/carol'), 'leaving is not undone by the other device');
  assert(!carol2.league(code2), 'league removed from the other device');
  console.log('  PASS: leaving a league on one device is not undone by another.');

  // League bets: the app sends only what was backed; the server owns odds, result and points.
  const today = carol.run('leagueDocs.londonDate(new Date())');
  const iso = ms => new Date(ms).toISOString();
  const nowMs = Date.now();
  const kickoff = iso(nowMs + 2 * 86400000);
  const day = kickoff.slice(0, 10);
  const later = iso(nowMs + 3 * 86400000);
  const past = iso(nowMs - 3600000);
  carol.run('DATA.fixtures = ' + JSON.stringify({ fixtures: [
    { id: 'PL-ars-tot', home: 'Arsenal', away: 'Tottenham', kickoff_utc: kickoff, status: 'SCHEDULED', score: null },
    { id: 'PL-che-liv', home: 'Chelsea', away: 'Liverpool', kickoff_utc: later, status: 'SCHEDULED', score: null },
    { id: 'PL-mun-new', home: 'Man United', away: 'Newcastle', kickoff_utc: past, status: 'IN_PLAY', score: null }
  ] }) + '; DATA.odds = ' + JSON.stringify({ max_age_hours: 12, matches: {
    'PL-ars-tot': { selections: { 'result:H': { decimal: 1.8 }, 'result:D': { decimal: 3.8 }, 'result:A': { decimal: 4.5 } } },
    'PL-che-liv': { selections: { 'result:H': { decimal: 2.6 }, 'goals:over:2.5': { decimal: 1.6 } } },
    'PL-mun-new': { selections: { 'result:H': { decimal: 2.0 } } }
  } }));
  const diaryBet = (id, matchId, selection, extra) => Object.assign({ id, type: 'single', match_id: matchId, fixture: '', marketName: 'Match result', selection, odds: 50, stake: 5, outcome: 'pending', timestamp: iso(nowMs), date: day, inLeague: false }, extra || {});
  const enter = async bet => {
    carol.toasts.length = 0;
    carol.run('(() => { const d = getStoredDiary(); d.unshift(' + JSON.stringify(bet) + '); saveStoredDiary(d); })()');
    await carol.run(`enterLeagueBet('${bet.id}')`);
    await settle();
    return carol.toasts.join(' | ');
  };
  let msg = await enter(diaryBet('lb1', 'PL-ars-tot', 'Arsenal'));
  const sentBet = cloud.docs.get('users/carol/leagueBets/' + day);
  assert(sentBet, 'league bet sent to the server');
  assert.deepStrictEqual(Object.keys(sentBet).sort(), ['betId', 'createdAt', 'fixtureId', 'odds', 'selection'], 'the app sends only what was backed');
  assert.strictEqual(sentBet.selection, 'Arsenal');
  assert(/11\/8|4\/5|4\/5/.test(msg) || /bookmaker price/.test(msg), 'player is told the price it scores at: ' + msg);
  assert.strictEqual(carol.run("getStoredDiary().find(e => e.id === 'lb1').inLeague"), true);
  msg = await enter(diaryBet('lb2', 'PL-ars-tot', 'Tottenham'));
  assert(/already have a league bet/.test(msg), 'one league bet per match day: ' + msg);
  assert.strictEqual(cloud.docs.get('users/carol/leagueBets/' + day).betId, 'lb1', 'first bet of the day stands');
  msg = await enter(diaryBet('lb3', 'PL-che-liv', 'Both teams to score', { marketName: 'Both teams to score', date: later.slice(0, 10) }));
  assert(/Only match result and over\/under goals/.test(msg), 'unpriced market stays diary-only: ' + msg);
  assert(!cloud.docs.has('users/carol/leagueBets/' + later.slice(0, 10)));
  msg = await enter(diaryBet('lb4', 'PL-mun-new', 'Man United', { date: past.slice(0, 10) }));
  assert(/already kicked off/.test(msg), 'after kick-off is refused: ' + msg);
  msg = await enter(diaryBet('lb5', null, 'Arsenal + Chelsea', { type: 'accumulator', date: later.slice(0, 10) }));
  assert(/Accumulators/.test(msg), 'accumulators are diary-only: ' + msg);
  console.log('  PASS: league bets send only the selection; one per day, priced markets, before kick-off.');

  // The diary shows what the server decided.
  cloud.docs.set('users/carol/leagueBets/' + day, Object.assign({}, sentBet, { status: 'settled', outcome: 'won', points: 8, refOdds: 1.8 }));
  carol.run('listenToMyLeagueData("carol")');
  await settle();
  assert(/League \+8 pts/.test(carol.run("betCard(getStoredDiary().find(e => e.id === 'lb1'))")), 'diary shows the points the server awarded');

  // Your own row uses the server's stats, never the device's.
  const thisWeekKey = carol.run("leagueDocs.currentPeriodKey('weekly')");
  cloud.docs.set('leagueStats/carol', { handle: 'Carol', updatedAt: 'x', periods: { weekly: { key: thisWeekKey, points: 8, winRate: 100, roi: 80, settled: 1, form: ['W'] } } });
  carol.run('listenToMyLeagueData("carol")');
  await settle();
  assert.strictEqual(carol.run("getUserLeagueStats('weekly').points"), 8, 'own points come from the server');
  carol.run("saveStoredDiary(getStoredDiary().map(e => Object.assign(e, { outcome: 'won', settledBy: 'auto', odds: 50 })))");
  assert.strictEqual(carol.run("getUserLeagueStats('weekly').points"), 8, 'editing the diary does not change league points');
  console.log('  PASS: the diary shows the server result, and league points come only from the server.');

  // Regional ladders: the app shows the server's top 50, adds your own row if you are further down,
  // and asks for a location before showing town/region/country ladders.
  const wk = carol.run("leagueDocs.currentPeriodKey('weekly')");
  cloud.docs.set('ladders/weekly__world', { id: 'weekly__world', period: 'weekly', key: wk, tier: 'world', total: 120,
    entries: [{ uid: 'zed', handle: 'Zed_1', points: 300, winRate: 90, roi: 50, settled: 5, form: ['W'] }, { uid: 'amy', handle: 'Amy_2', points: 120, winRate: 60, roi: 10, settled: 5, form: ['W'] }] });
  carol.run("activeLeagueId = 'geo-world'; activeLeagueFreq = 'weekly'");
  carol.run('viewLeagues()');
  await settle();
  const worldHtml = carol.run('viewLeagues()');
  assert(/Zed_1/.test(worldHtml) && /Amy_2/.test(worldHtml), 'ladder entries shown');
  assert(/Top 2 of 120 players/.test(worldHtml), 'ladder size shown');
  assert(/>50\+</.test(worldHtml), 'your own row is shown below the top 50 without a made-up rank');
  carol.run("activeLeagueId = 'geo-town'");
  assert(/Add your town to your profile/.test(carol.run('viewLeagues()')), 'no town set: asked to add it');
  console.log('  PASS: regional ladders show the server top 50, your own row, and ask for a location when needed.');

  // Periods: a member whose numbers are from last week shows zero this week; this week's show as-is.
  const code3 = alice.run('generateSecureLeagueCode()');
  alice.run(`(() => { const l = { id: 'league-three', name: 'Third', icon: '⚽', freq: 'weekly', code: '${code3}', creatorUid: 'alice', is_joined: false, members: [] };
    const list = getStoredLeagues(); list.push(l); saveStoredLeagues(list); return publishLeague(l, getAuthUser()); })()`);
  await settle();
  const thisWeek = alice.run("leagueDocs.currentPeriodKey('weekly')");
  const memberDoc = (handle, key, points) => ({ handle, avatar: '⚽', joinedAt: 'x', updatedAt: 'x', scoredAt: 'x', points, winRate: 50, roi: 1, settled: 2, form: ['W'],
    periods: { weekly: { key, points, winRate: 50, roi: 1, settled: 2, form: ['W'] } } });
  cloud.docs.set('handles/dan_1', { uid: 'dan', handle: 'Dan_1' });
  cloud.docs.set('handles/eve_1', { uid: 'eve', handle: 'Eve_1' });
  cloud.docs.set('leagues/' + code3 + '/members/dan', memberDoc('Dan_1', 'W2020-01-06', 55));
  cloud.docs.set('leagues/' + code3 + '/members/eve', memberDoc('Eve_1', thisWeek, 55));
  // Two different accounts showing the same gamertag each get their own row.
  cloud.docs.set('leagues/' + code3 + '/members/eve2', memberDoc('Eve_1', thisWeek, 7));
  alice.run("activeLeagueId = 'league-three'; activeLeagueFreq = 'weekly'");
  alice.run('viewLeagues()');
  await settle();
  const lb = alice.run('viewLeagues()');
  const pointsFor = handle => {
    const out = [];
    const re = /lb-handle">([^<]+)<\/b>[\s\S]*?lb-pts-val">(-?\d+)</g;
    let m;
    while ((m = re.exec(lb))) if (m[1] === handle) out.push(+m[2]);
    return out.sort((a, b) => a - b);
  };
  assert.deepStrictEqual(pointsFor('Dan_1'), [0], "last week's points show as 0 this week");
  assert.deepStrictEqual(pointsFor('Eve_1'), [7, 55], 'same gamertag on two accounts shows two rows');
  console.log("  PASS: tables use this period's numbers only, with one row per account.");

  // A player cannot join under a gamertag they do not hold.
  cloud.docs.set('handles/' + bobHandle.toLowerCase(), { uid: 'someone-else', handle: bobHandle });
  await bob.run(`joinCloudLeague('${code3}')`);
  await settle();
  assert(!cloud.docs.has('leagues/' + code3 + '/members/bob'), 'join with a gamertag held by someone else is refused');
  cloud.docs.set('handles/' + bobHandle.toLowerCase(), { uid: 'bob', handle: bobHandle });

  // Leagues are capped at 50 players.
  for (let i = 0; i < 47; i++) cloud.docs.set('leagues/' + code3 + '/members/filler' + i, memberDoc('Filler' + i, thisWeek, 0));
  bob.toasts.length = 0;
  await bob.run(`joinCloudLeague('${code3}')`);
  await settle();
  assert(!cloud.docs.has('leagues/' + code3 + '/members/bob'), 'a full league cannot be joined');
  assert(bob.toasts.some(t => t.startsWith('This league is full')), 'player is told the league is full');
  console.log('  PASS: gamertags must be held by their owner, and leagues stop at 50 players.');

  // Bet Diary: two devices for one account stay in step, including deletes and settlements,
  // and only changed entries are written.
  const d1 = makeDevice(cloud, { uid: 'fay', name: 'Fay' });
  const d2 = makeDevice(cloud, { uid: 'fay', name: 'Fay' });
  await d1.signIn();
  await d2.signIn();
  const entry = id => ({ id, date: today, timestamp: iso(nowMs), fixture: 'A v B', selection: 'A', odds: 2, stake: 5, outcome: 'pending' });
  d1.run('saveStoredDiary(' + JSON.stringify([entry('x1'), entry('x2')]) + ')');
  await d1.run('pushDiaryToCloud()');
  assert(cloud.docs.has('users/fay/diary/x1') && cloud.docs.has('users/fay/diary/x2'), 'diary uploaded');
  await d2.run('syncDiaryFromCloud()');
  await settle();
  assert.strictEqual(d2.run('JSON.stringify(getStoredDiary().map(e => e.id).sort())'), '["x1","x2"]', 'second device gets both bets');
  // Settle x1 on device 2, delete x2 on device 1.
  d2.run("(() => { const d = getStoredDiary(); d.find(e => e.id === 'x1').outcome = 'won'; saveStoredDiary(d); })()");
  await d2.run('pushDiaryToCloud()');
  d1.run("saveStoredDiary(getStoredDiary().filter(e => e.id !== 'x2'))");
  await d1.run('pushDiaryToCloud()');
  assert(!cloud.docs.has('users/fay/diary/x2'), 'deleted bet removed from the cloud');
  await d1.run('syncDiaryFromCloud()');
  await d2.run('syncDiaryFromCloud()');
  await settle();
  assert.strictEqual(d1.run("getStoredDiary().find(e => e.id === 'x1').outcome"), 'won', 'settlement reaches the other device');
  assert.strictEqual(d2.run('JSON.stringify(getStoredDiary().map(e => e.id))'), '["x1"]', 'delete reaches the other device');
  const diaryKeys = () => JSON.stringify([...cloud.docs.entries()].filter(([k]) => k.startsWith('users/fay/diary/')));
  const before = diaryKeys();
  let writes = 0;
  const origSet = cloud.docs.set;
  cloud.docs.set = function (k, v) { if (String(k).startsWith('users/fay/diary/')) writes++; return origSet.call(this, k, v); };
  await d1.run('pushDiaryToCloud()');
  cloud.docs.set = origSet;
  assert.strictEqual(writes, 0, 'an unchanged diary writes nothing');
  assert.strictEqual(diaryKeys(), before);
  console.log('  PASS: Bet Diary syncs between devices (adds, settlements, deletes) and only writes changes.');

  console.log('ALL LEAGUE CLOUD SYNC TESTS PASSED!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
