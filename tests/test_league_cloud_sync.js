'use strict';
// Runs the real app.js on several simulated devices against one in-memory Firestore that applies
// the same league rules as firestore.rules (members need an existing league and no ban; stat
// refreshes are update-only). Checks the league lifecycle end to end: create, invite link, kick,
// leave, delete, a second device catching up, and that league names can never inject HTML.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const sources = ['market_calculations.js', 'bet_builder.js', 'league_sync.js', 'app.js'].map(f => fs.readFileSync(f, 'utf8'));

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
        if (!after.has('leagues/' + m[1])) throw fsError('permission-denied');
        if (!docs.has(op.path)) {
          if (docs.has('leagues/' + m[1] + '/banned/' + m[2])) throw fsError('permission-denied');
          if (!('joinedAt' in op.data)) throw fsError('permission-denied');
        } else if ('joinedAt' in op.data && op.data.joinedAt !== docs.get(op.path).joinedAt) {
          throw fsError('permission-denied');
        }
      }
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
    firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => new Date().toISOString() } }),
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

  console.log('ALL LEAGUE CLOUD SYNC TESTS PASSED!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
