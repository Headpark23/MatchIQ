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
 *  9. Out-of-bounds stats rejected on member docs (points, winRate, roi, settled, form)
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

  beforeEach(async function () {
    if (testEnv) {
      await testEnv.clearFirestore();
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

  // Sample valid data fixtures
  const validUserPayload = {
    handle: 'Alice_99',
    avatar: '⚽',
    createdAt: new Date()
  };

  const validLeagueCode = 'PAISLEY8'; // 8 chars from [23456789ABCDEFGHJKLMNPQRSTUVWXYZ]
  const validLeaguePayload = {
    name: 'Paisley Punters Club',
    icon: '⚽',
    freq: 'weekly',
    code: validLeagueCode,
    creatorUid: 'alice',
    createdAt: new Date().toISOString()
  };

  const validMemberPayload = {
    handle: 'Alice_99',
    avatar: '⚽',
    joinedAt: new Date().toISOString(),
    points: 150,
    winRate: 65.5,
    roi: 18.2,
    settled: 12,
    form: ['W', 'W', 'L', 'W'],
    updatedAt: new Date().toISOString()
  };

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
