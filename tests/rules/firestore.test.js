/**
 * Bet Buddy (MatchIQ) - Firestore Security Rules Unit Test Suite (Google Auth Only)
 *
 * Covers:
 *  1. Unauthenticated access denied across protected collections (leagues, members, users)
 *  2. Anonymous provider access denied for leagues & members
 *  3. Email/Password provider (even with email_verified true) denied for leagues & members
 *  4. Verified Google provider (google.com) granted access to create & join leagues
 *  5. User A cannot write User B's user profile, diary, memberships, or league member doc
 *  6. Non-creator cannot rename, update or delete another creator's league
 *  7. Whole-collection list on `leagues` denied (anti-scraping)
 *  8. Handle claims: doc ID must match lowercase handle, handle format validation, uniqueness
 *  9. League stats are server-only; league bets are create-once with the server clock
 * 10. Member can leave league; League creator can kick member; Non-creator cannot kick member
 * 11. Geo leagues public read allowed, client writes denied
 * 12. Root default deny on arbitrary collections
 */

const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');

const leagueDocs = require('../../league_sync.js');
const firebase = require('firebase/compat/app').default;
require('firebase/compat/firestore');

const PROJECT_ID = 'betbuddyuk';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

describe('Bet Buddy (MatchIQ) Firestore Security Rules - Google-Only Access', function () {
  let testEnv;

  before(async function () {
    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: process.env.FIRESTORE_EMULATOR_HOST ? process.env.FIRESTORE_EMULATOR_HOST.split(':')[0] : '127.0.0.1',
        port: process.env.FIRESTORE_EMULATOR_HOST ? parseInt(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1], 10) : 8080
      }
    });
  });

  after(async function () {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  // Gamertags used below, reserved to their owners (members must hold their handle).
  const RESERVED_HANDLES = { alicepark: 'alice', bob_7: 'bob', charlie_1: 'charlie', bob_the_punter: 'bob' };

  beforeEach(async function () {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const [lower, uid] of Object.entries(RESERVED_HANDLES)) {
          const handle = { alicepark: 'AlicePark', bob_7: 'Bob_7', charlie_1: 'Charlie_1', bob_the_punter: 'Bob_The_Punter' }[lower];
          await db.collection('handles').doc(lower).set({ uid, handle, createdAt: new Date() });
        }
      });
    }
  });

  // Helper context generators
  function getUnauth() {
    return testEnv.unauthenticatedContext().firestore();
  }

  function getGoogleUser(uid = 'alice') {
    return testEnv.authenticatedContext(uid, {
      email: `${uid}@gmail.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    }).firestore();
  }

  function getEmailUser(uid = 'bob') {
    return testEnv.authenticatedContext(uid, {
      email: `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'password' }
    }).firestore();
  }

  function getAnonymousUser(uid = 'anon_user') {
    return testEnv.authenticatedContext(uid, {
      firebase: { sign_in_provider: 'anonymous' }
    }).firestore();
  }

  // Sample valid data fixtures. League and member payloads come from the app's own builders
  // (league_sync.js), so these tests exercise exactly what the app writes.
  const validUserPayload = {
    handle: 'Alice_99',
    avatar: '⚽',
    createdAt: new Date()
  };

  const validLeagueCode = 'PAWSLEY8'; // 8 chars from [23456789ABCDEFGHJKLMNPQRSTUVWXYZ]
  const NOW = new Date().toISOString();
  const validLeaguePayload = leagueDocs.leagueDoc({
    code: validLeagueCode, name: 'Paisley Punters Club', icon: '⚽', freq: 'weekly',
    creatorUid: 'alice', creatorHandle: 'Alice_99', now: NOW
  });

  const sampleStats = { points: 150, winRate: 65.5, roi: 18.2, settled: 12, form: ['W', 'W', 'L', 'W'] };
  const validMemberPayload = leagueDocs.newMemberDoc({ handle: 'AlicePark', avatar: '⚽', stats: sampleStats, now: NOW });

  // -----------------------------------------------------------------
  // 1. Unauthenticated Access Protection
  // -----------------------------------------------------------------
  describe('1. Unauthenticated Access Protection', function () {
    it('(a) denies unauthenticated read/write to leagues and members', async function () {
      const db = getUnauth();
      await assertFails(db.collection('leagues').doc(validLeagueCode).get());
      await assertFails(db.collection('leagues').doc(validLeagueCode).set(validLeaguePayload));
      await assertFails(db.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').get());
      await assertFails(db.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set(validMemberPayload));
    });

    it('denies unauthenticated read/write to users collection', async function () {
      const db = getUnauth();
      await assertFails(db.collection('users').doc('alice').get());
      await assertFails(db.collection('users').doc('alice').set(validUserPayload));
    });

    it('allows unauthenticated read to handles collection for availability check', async function () {
      const db = getUnauth();
      await assertSucceeds(db.collection('handles').doc('alice_99').get());
    });
  });

  // -----------------------------------------------------------------
  // 2. Anonymous Provider Access Denied
  // -----------------------------------------------------------------
  describe('2. Anonymous Provider Access Denied', function () {
    it('(b) denies authenticated user with sign_in_provider anonymous from reading or writing leagues or members', async function () {
      const dbAnon = getAnonymousUser('anon_123');
      await assertFails(dbAnon.collection('leagues').doc(validLeagueCode).get());
      await assertFails(dbAnon.collection('leagues').doc(validLeagueCode).set({
        ...validLeaguePayload,
        creatorUid: 'anon_123'
      }));
      await assertFails(dbAnon.collection('leagues').doc(validLeagueCode).collection('members').doc('anon_123').get());
      await assertFails(dbAnon.collection('leagues').doc(validLeagueCode).collection('members').doc('anon_123').set({
        ...validMemberPayload,
        handle: 'AnonPunter'
      }));
    });
  });

  // -----------------------------------------------------------------
  // 3. Email/Password Provider Access Denied (Even with email_verified: true)
  // -----------------------------------------------------------------
  describe('3. Email/Password Provider Access Denied for Leagues', function () {
    it('(c) denies email/password user from creating, reading, or joining leagues even with email_verified true', async function () {
      const dbEmail = getEmailUser('bob');
      await assertFails(dbEmail.collection('leagues').doc(validLeagueCode).get());
      await assertFails(dbEmail.collection('leagues').doc(validLeagueCode).set({
        ...validLeaguePayload,
        creatorUid: 'bob'
      }));
      await assertFails(dbEmail.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').get());
      await assertFails(dbEmail.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').set(validMemberPayload));
    });
  });

  // -----------------------------------------------------------------
  // 4. Google Sign-In Provider Full Access
  // -----------------------------------------------------------------
  describe('4. Google Sign-In Provider Access Granted', function () {
    it('(d) allows Google user to create league as creator and join as themselves', async function () {
      const dbAlice = getGoogleUser('alice');
      // Create league as creator
      await assertSucceeds(dbAlice.collection('leagues').doc(validLeagueCode).set(validLeaguePayload));
      // Read league doc
      await assertSucceeds(dbAlice.collection('leagues').doc(validLeagueCode).get());
      // Join as member
      await assertSucceeds(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set(validMemberPayload)
      );
      // Read members subcollection
      await assertSucceeds(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').get()
      );
    });

    it('denies whole-collection list queries on leagues (anti-scraping)', async function () {
      const dbAlice = getGoogleUser('alice');
      await assertFails(dbAlice.collection('leagues').get());
    });

    it('allows only the verified app owner to list all leagues and their members', async function () {
      const owner = (claims) => testEnv.authenticatedContext('owner_uid', {
        email: 'headpark@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
        ...claims
      }).firestore();
      await assertSucceeds(owner().collection('leagues').get());
      await assertSucceeds(owner().collection('leagues').doc(validLeagueCode).collection('members').get());
      await assertFails(owner({ email_verified: false }).collection('leagues').get());
      await assertFails(owner({ email: 'headpark@gmail.com.evil.com' }).collection('leagues').get());
    });
  });

  // -----------------------------------------------------------------
  // 5. Cross-User and Cross-Creator Isolation
  // -----------------------------------------------------------------
  describe('5. Cross-User and Cross-Creator Isolation', function () {
    beforeEach(async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const firestore = adminContext.firestore();
        await firestore.collection('leagues').doc(validLeagueCode).set(validLeaguePayload); // creator: alice
      });
    });

    it('(e) denies user from creating or updating another uid member record', async function () {
      const dbBob = getGoogleUser('bob');
      // Bob attempts to write Alice's member doc
      await assertFails(
        dbBob.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set(validMemberPayload)
      );
    });

    it('(e) denies non-creator from editing or deleting another creator league', async function () {
      const dbBob = getGoogleUser('bob');
      // Bob attempts to update Alice's league
      await assertFails(
        dbBob.collection('leagues').doc(validLeagueCode).update({ name: 'Hacked League' })
      );
      // Bob attempts to delete Alice's league
      await assertFails(
        dbBob.collection('leagues').doc(validLeagueCode).delete()
      );
    });

    it('denies User B from writing User A profile doc', async function () {
      const dbBob = getGoogleUser('bob');
      await assertFails(dbBob.collection('users').doc('alice').set(validUserPayload));
    });

    it('denies User B from writing User A diary or leagueMemberships', async function () {
      const dbBob = getGoogleUser('bob');
      await assertFails(dbBob.collection('users').doc('alice').collection('diary').doc('bet1').set({ stake: 10 }));
      await assertFails(dbBob.collection('users').doc('alice').collection('leagueMemberships').doc(validLeagueCode).set({ code: validLeagueCode }));
    });
  });

  // -----------------------------------------------------------------
  // 6. Handle Registry Uniqueness & Validation
  // -----------------------------------------------------------------
  describe('6. Handle Registry Management', function () {
    const handleDocPayload = {
      uid: 'alice',
      handle: 'Alice_99',
      createdAt: new Date()
    };

    it('allows authenticated user to claim unique handle matching doc ID lowercase', async function () {
      const dbAlice = getGoogleUser('alice');
      await assertSucceeds(dbAlice.collection('handles').doc('alice_99').set(handleDocPayload));
    });

    it('rejects claim if doc ID does not match lowercase handle', async function () {
      const dbAlice = getGoogleUser('alice');
      await assertFails(dbAlice.collection('handles').doc('wrong_handle').set(handleDocPayload));
    });

    it('denies User B from stealing or overwriting User A handle', async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const firestore = adminContext.firestore();
        await firestore.collection('handles').doc('alice_99').set(handleDocPayload);
      });
      const dbBob = getGoogleUser('bob');
      await assertFails(
        dbBob.collection('handles').doc('alice_99').set({
          uid: 'bob',
          handle: 'Alice_99',
          createdAt: new Date()
        })
      );
    });
  });

  // -----------------------------------------------------------------
  // 7. Member Leave & Creator Kick Controls
  // -----------------------------------------------------------------
  describe('7. Member Leave & Creator Kick Access', function () {
    const bobMemberPayload = {
      handle: 'Bob_The_Punter',
      avatar: '🎯',
      joinedAt: new Date().toISOString(),
      points: 50,
      winRate: 40,
      roi: 5,
      settled: 8,
      form: ['L', 'W'],
      updatedAt: new Date().toISOString()
    };

    beforeEach(async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const firestore = adminContext.firestore();
        await firestore.collection('leagues').doc(validLeagueCode).set(validLeaguePayload); // creator: alice
        await firestore.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').set(bobMemberPayload);
      });
    });

    it('allows member (Bob) to delete their own record (leave league)', async function () {
      const dbBob = getGoogleUser('bob');
      await assertSucceeds(
        dbBob.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').delete()
      );
    });

    it('allows league creator (Alice) to kick member (Bob)', async function () {
      const dbAlice = getGoogleUser('alice');
      await assertSucceeds(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').delete()
      );
    });

    it('denies third-party non-creator user (Charlie) from kicking member (Bob)', async function () {
      const dbCharlie = getGoogleUser('charlie');
      await assertFails(
        dbCharlie.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').delete()
      );
    });
  });

  // -----------------------------------------------------------------
  // App flows: the exact batches app.js sends (publishLeague, joinCloudLeague,
  // syncLeagueToCloud, kickPlayerFromLeague, deleteLeague, claimHandleTransaction)
  // -----------------------------------------------------------------
  describe('App flows with real payloads', function () {
    const code = validLeagueCode;
    const now = () => new Date().toISOString();
    const leagueRef = (db) => db.collection('leagues').doc(code);
    const memberRef = (db, uid) => leagueRef(db).collection('members').doc(uid);
    const membershipRef = (db, uid) => db.collection('users').doc(uid).collection('leagueMemberships').doc(code);
    const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();

    // publishLeague(): league + creator member + creator membership, in one batch.
    async function createLeagueAsAlice() {
      const db = getGoogleUser('alice');
      const batch = db.batch();
      batch.set(leagueRef(db), leagueDocs.leagueDoc({ code, name: 'Paisley Punters', icon: '⚽', freq: 'weekly', creatorUid: 'alice', creatorHandle: 'Alice_99', now: now() }));
      batch.set(memberRef(db, 'alice'), leagueDocs.newMemberDoc({ handle: 'AlicePark', avatar: '⚽', stats: sampleStats, now: now() }));
      batch.set(membershipRef(db, 'alice'), leagueDocs.membershipDoc({ code, name: 'Paisley Punters', icon: '⚽', role: 'creator', now: now() }));
      return batch.commit();
    }

    // joinCloudLeague(): new member record + own membership, in one batch.
    function joinAs(uid, handle) {
      const db = getGoogleUser(uid);
      const batch = db.batch();
      batch.set(memberRef(db, uid), leagueDocs.newMemberDoc({ handle, avatar: '🎯', stats: {}, now: now() }));
      batch.set(membershipRef(db, uid), leagueDocs.membershipDoc({ code, name: 'Paisley Punters', icon: '⚽', role: 'member', now: now() }));
      return batch.commit();
    }

    // syncLeagueToCloud(): a gamertag/avatar refresh is an update only (stats come from the server).
    function syncStatsAs(uid, handle) {
      const db = getGoogleUser(uid);
      return memberRef(db, uid).update(leagueDocs.memberProfileUpdate({ handle, avatar: '🎯', now: now() }));
    }

    it('creator can publish a new league in one batch', async function () {
      await assertSucceeds(createLeagueAsAlice());
    });

    it('a player can join, then refresh their stats', async function () {
      await createLeagueAsAlice();
      await assertSucceeds(joinAs('bob', 'Bob_7'));
      await assertSucceeds(syncStatsAs('bob', 'Bob_7'));
    });

    it('joining a league that does not exist is denied', async function () {
      await assertFails(joinAs('bob', 'Bob_7'));
    });

    it('a stats refresh cannot create a member record that does not exist', async function () {
      await createLeagueAsAlice();
      await assertFails(syncStatsAs('bob', 'Bob_7'));
    });

    it('joinedAt cannot be changed after joining', async function () {
      await createLeagueAsAlice();
      await joinAs('bob', 'Bob_7');
      const db = getGoogleUser('bob');
      await assertFails(memberRef(db, 'bob').update({ joinedAt: '2020-01-01T00:00:00.000Z' }));
    });

    it('a kicked player is banned: cannot refresh stats or rejoin', async function () {
      await createLeagueAsAlice();
      await joinAs('bob', 'Bob_7');
      const dbAlice = getGoogleUser('alice');
      const kick = dbAlice.batch();
      kick.delete(memberRef(dbAlice, 'bob'));
      kick.set(leagueRef(dbAlice).collection('banned').doc('bob'), leagueDocs.banDoc({ handle: 'Bob_7', now: now() }));
      await assertSucceeds(kick.commit());

      await assertFails(syncStatsAs('bob', 'Bob_7'));
      await assertFails(joinAs('bob', 'Bob_7'));
      // Bob can read his own ban (for a clear message) but cannot lift it.
      await assertSucceeds(leagueRef(getGoogleUser('bob')).collection('banned').doc('bob').get());
      await assertFails(leagueRef(getGoogleUser('bob')).collection('banned').doc('bob').delete());
      // Only the creator can ban.
      await joinAs('charlie', 'Charlie_1');
      await assertFails(leagueRef(getGoogleUser('charlie')).collection('banned').doc('dave').set(leagueDocs.banDoc({ handle: 'Dave', now: now() })));
    });

    it('a player who left cannot be re-added by a stats refresh from another device', async function () {
      await createLeagueAsAlice();
      await joinAs('bob', 'Bob_7');
      const db = getGoogleUser('bob');
      await assertSucceeds(memberRef(db, 'bob').delete());
      await assertSucceeds(membershipRef(db, 'bob').delete());
      await assertFails(syncStatsAs('bob', 'Bob_7'));
    });

    it('deleteLeague(): creator clears members and bans, then the league; nobody can write to it after', async function () {
      await createLeagueAsAlice();
      await joinAs('bob', 'Bob_7');
      const dbAlice = getGoogleUser('alice');
      await leagueRef(dbAlice).collection('banned').doc('eve').set(leagueDocs.banDoc({ handle: 'Eve', now: now() }));

      const [members, bans] = await Promise.all([leagueRef(dbAlice).collection('members').get(), leagueRef(dbAlice).collection('banned').get()]);
      const clear = dbAlice.batch();
      members.docs.concat(bans.docs).forEach(d => clear.delete(d.ref));
      await assertSucceeds(clear.commit());
      const final = dbAlice.batch();
      final.delete(leagueRef(dbAlice));
      final.delete(membershipRef(dbAlice, 'alice'));
      await assertSucceeds(final.commit());

      await assertFails(syncStatsAs('bob', 'Bob_7'));
      await assertFails(joinAs('bob', 'Bob_7'));
    });

    it('a member record left behind by a deleted league cannot be written', async function () {
      await createLeagueAsAlice();
      await joinAs('bob', 'Bob_7');
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('leagues').doc(code).delete();
      });
      await assertFails(syncStatsAs('bob', 'Bob_7'));
    });

    it('rename: creator can rename, others cannot, markup is refused', async function () {
      await createLeagueAsAlice();
      await joinAs('bob', 'Bob_7');
      await assertSucceeds(leagueRef(getGoogleUser('alice')).update(leagueDocs.leagueRename('Paisley Legends', now())));
      await assertFails(leagueRef(getGoogleUser('bob')).update(leagueDocs.leagueRename('Bob Rules', now())));
      await assertFails(leagueRef(getGoogleUser('alice')).update({ name: '<img src=x onerror=alert(1)>', updatedAt: now() }));
    });

    it('league names and icons with HTML markup are refused on create', async function () {
      const db = getGoogleUser('alice');
      await assertFails(leagueRef(db).set({ ...validLeaguePayload, name: '<img src=x onerror=alert(1)>' }));
      await assertFails(leagueRef(db).set({ ...validLeaguePayload, icon: '<b>' }));
    });

    it('the name builders strip markup so the app never sends it', function () {
      expect(leagueDocs.cleanLeagueName('<img src=x onerror=alert(1)>')).to.not.match(/[<>"&]/);
      expect(leagueDocs.cleanIcon('<svg onload=x>')).to.not.match(/[<>"&]/);
    });

    it('claimHandleTransaction(): new profile + gamertag, then a gamertag change', async function () {
      const db = getGoogleUser('alice');
      await assertSucceeds(db.runTransaction(async tx => {
        tx.set(db.collection('handles').doc('alice_99'), leagueDocs.handleDoc({ uid: 'alice', handle: 'Alice_99', now: serverTime() }));
        tx.set(db.collection('users').doc('alice'), leagueDocs.userProfileDoc({ handle: 'Alice_99', avatar: '⚽', now: serverTime(), isNew: true }));
      }));
      const existing = (await db.collection('users').doc('alice').get()).data();
      await assertSucceeds(db.runTransaction(async tx => {
        tx.set(db.collection('handles').doc('alice_new'), leagueDocs.handleDoc({ uid: 'alice', handle: 'Alice_New', now: serverTime() }));
        tx.delete(db.collection('handles').doc('alice_99'));
        tx.set(db.collection('users').doc('alice'), { ...leagueDocs.userProfileDoc({ handle: 'Alice_New', avatar: '⚽', now: serverTime(), isNew: true }), createdAt: existing.createdAt });
      }));
    });

    it('players can never write league stats; only the server can', async function () {
      await createLeagueAsAlice();
      const db = getGoogleUser('bob');
      // Joining with stats is refused ...
      await assertFails(memberRef(db, 'bob').set({ ...leagueDocs.newMemberDoc({ handle: 'Bob_7', avatar: '🎯', now: now() }), points: 500 }));
      await joinAs('bob', 'Bob_7');
      // ... and so is changing them afterwards, even after the server has written some.
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('leagues').doc(code).collection('members').doc('bob').update({ points: 8, scoredAt: new Date(), periods: { weekly: { key: 'W2026-11-09', points: 8 } } });
      });
      await assertFails(memberRef(db, 'bob').update({ points: 5000 }));
      await assertFails(memberRef(db, 'bob').update({ 'periods.weekly.points': 5000 }));
      await assertFails(memberRef(db, 'bob').update({ scoredAt: new Date() }));
      await assertSucceeds(syncStatsAs('bob', 'Bob_7'));
      await assertFails(db.collection('leagueStats').doc('bob').set({ periods: {} }));
      await assertFails(db.collection('ladders').doc('weekly__world').set({ entries: [] }));
      await assertSucceeds(db.collection('leagueStats').doc('alice').get());
      await assertSucceeds(db.collection('ladders').doc('weekly__world').get());
      await assertFails(getUnauth().collection('ladders').doc('weekly__world').get());
    });

    // submitLeagueBet(): one league bet per match day, stamped with the server clock.
    const betRef = (db, uid, day = '2026-11-08') => db.collection('users').doc(uid).collection('leagueBets').doc(day);
    const leagueBet = (extra = {}) => ({ ...leagueDocs.leagueBetDoc({ betId: 'bet-1', fixtureId: 'PL-2627-ars-v-tot', selection: 'Arsenal', odds: 2.5, now: serverTime() }), ...extra });

    it('league bets: create once per day with the server clock; no client-side odds or results', async function () {
      const db = getGoogleUser('bob');
      await assertSucceeds(betRef(db, 'bob').set(leagueBet()));
      await assertFails(betRef(db, 'bob').set(leagueBet({ selection: 'Tottenham' })), 'second bet for the same day');
      await assertFails(betRef(db, 'bob').update({ selection: 'Draw' }));
      await assertFails(betRef(db, 'bob', '2026-11-09').set(leagueBet({ createdAt: new Date('2026-11-01') })), 'backdated');
      await assertFails(betRef(db, 'bob', '2026-11-09').set(leagueBet({ refOdds: 15 })), 'client cannot set the scoring price');
      await assertFails(betRef(db, 'bob', '2026-11-09').set(leagueBet({ status: 'settled', points: 100 })), 'client cannot settle');
      await assertFails(betRef(db, 'bob', 'not-a-day').set(leagueBet()));
      await assertFails(betRef(getGoogleUser('charlie'), 'bob', '2026-11-09').set(leagueBet()), 'someone else\'s bets');
      await assertFails(betRef(getGoogleUser('charlie'), 'bob').get());
      await assertFails(betRef(getEmailUser('bob'), 'bob', '2026-11-10').set(leagueBet()), 'Google sign-in only');
    });

    it('league bets: withdraw before kick-off or after a refusal, never after kick-off', async function () {
      const db = getGoogleUser('bob');
      const serverSets = async (day, fields) => testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('users').doc('bob').collection('leagueBets').doc(day).set({ betId: 'b', fixtureId: 'f', selection: 's', createdAt: new Date(), ...fields });
      });
      await serverSets('2026-11-08', { status: 'pending', kickoffAt: new Date(Date.now() + 3600000) });
      await serverSets('2026-11-09', { status: 'pending', kickoffAt: new Date(Date.now() - 60000) });
      await serverSets('2026-11-10', { status: 'rejected', reason: 'No price' });
      await serverSets('2026-11-11', { status: 'settled', outcome: 'lost', points: -2 });
      await assertSucceeds(betRef(db, 'bob', '2026-11-08').delete());
      await assertFails(betRef(db, 'bob', '2026-11-09').delete(), 'kicked off: the bet stands');
      await assertSucceeds(betRef(db, 'bob', '2026-11-10').delete());
      await assertFails(betRef(db, 'bob', '2026-11-11').delete(), 'a settled loser cannot be deleted');
    });

    it('profiles can carry a location for the regional ladders, without markup', async function () {
      const db = getGoogleUser('alice');
      await assertSucceeds(db.collection('users').doc('alice').set(leagueDocs.userProfileDoc({ handle: 'Alice_99', avatar: '⚽', now: serverTime(), isNew: true, location: { town: 'Paisley', region: 'Renfrewshire', country: 'Scotland' } })));
      await assertFails(db.collection('users').doc('alice').set({ handle: 'Alice_99', avatar: '⚽', createdAt: new Date(), town: '<img src=x>' }));
    });

    it('a member cannot appear under a gamertag they do not hold', async function () {
      await createLeagueAsAlice();
      const db = getGoogleUser('bob');
      const batch = db.batch();
      batch.set(memberRef(db, 'bob'), leagueDocs.newMemberDoc({ handle: 'AlicePark', avatar: '🎯', stats: {}, now: now() }));
      await assertFails(batch.commit());
      await assertFails(memberRef(db, 'bob').set(leagueDocs.newMemberDoc({ handle: 'Unclaimed_1', avatar: '🎯', stats: {}, now: now() })));
    });

    it('profiles may not carry email or other private fields', async function () {
      const db = getGoogleUser('alice');
      await assertFails(db.collection('users').doc('alice').set({ ...leagueDocs.userProfileDoc({ handle: 'Alice_99', avatar: '⚽', now: serverTime(), isNew: true }), email: 'alice@gmail.com' }));
    });
  });

  // -----------------------------------------------------------------
  // 8. Geographic Tier Leagues (geo_leagues) & Default Deny
  // -----------------------------------------------------------------
  describe('8. Geo Leagues & Default Deny', function () {
    it('allows public read of geo_leagues but denies all client writes', async function () {
      const dbUnauth = getUnauth();
      const dbAlice = getGoogleUser('alice');
      await assertSucceeds(dbUnauth.collection('geo_leagues').doc('geo-world').get());
      await assertFails(dbAlice.collection('geo_leagues').doc('geo-world').set({ name: 'Hacked' }));
      await assertFails(dbAlice.collection('geo_leagues').doc('geo-world').delete());
    });

    it('denies reads and writes on arbitrary top-level collections', async function () {
      const dbAlice = getGoogleUser('alice');
      await assertFails(dbAlice.collection('secrets').doc('key1').get());
      await assertFails(dbAlice.collection('secrets').doc('key1').set({ secret: '123' }));
      await assertFails(dbAlice.collection('admin_logs').doc('log1').get());
    });
  });
});
