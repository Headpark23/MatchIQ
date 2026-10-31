/**
 * Bet Buddy (MatchIQ) - Firestore Security Rules Unit Test Suite
 *
 * Covers:
 *  1. Unauthenticated access denied across protected collections
 *  2. Unverified email denied for league mutations (password provider)
 *  3. Verified email / Google provider granted access to league operations
 *  4. User A cannot write User B's user profile, diary, memberships, or league member doc
 *  5. Non-creator cannot rename or delete league
 *  6. Whole-collection list on `leagues` denied (anti-scraping)
 *  7. Handle claims: doc ID must match lowercase handle, handle format validation, uniqueness
 *  8. Out-of-bounds stats rejected on member docs (points, winRate, roi, settled, form)
 *  9. Member can leave league; League creator can kick member; Non-creator cannot kick member
 * 10. Geo leagues public read allowed, client writes denied
 * 11. Root default deny on arbitrary collections
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

describe('Bet Buddy (MatchIQ) Firestore Security Rules', function () {
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

  function getVerifiedUser(uid = 'alice') {
    return testEnv.authenticatedContext(uid, {
      email: `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'password' }
    }).firestore();
  }

  function getGoogleUser(uid = 'google_user') {
    return testEnv.authenticatedContext(uid, {
      email: `${uid}@gmail.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    }).firestore();
  }

  function getUnverifiedUser(uid = 'bob') {
    return testEnv.authenticatedContext(uid, {
      email: `${uid}@example.com`,
      email_verified: false,
      firebase: { sign_in_provider: 'password' }
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
  // 1. Unauthenticated Access
  // -----------------------------------------------------------------
  describe('1. Unauthenticated Access Protection', function () {
    it('denies unauthenticated read/write to users collection', async function () {
      const db = getUnauth();
      await assertFails(db.collection('users').doc('alice').get());
      await assertFails(db.collection('users').doc('alice').set(validUserPayload));
    });

    it('denies unauthenticated read/write to leagues collection', async function () {
      const db = getUnauth();
      await assertFails(db.collection('leagues').doc(validLeagueCode).get());
      await assertFails(db.collection('leagues').doc(validLeagueCode).set(validLeaguePayload));
    });

    it('denies unauthenticated access to members subcollection', async function () {
      const db = getUnauth();
      await assertFails(db.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').get());
    });

    it('allows unauthenticated read to handles collection for availability check', async function () {
      const db = getUnauth();
      // Should succeed reading non-existent doc for availability check
      await assertSucceeds(db.collection('handles').doc('alice_99').get());
    });

    it('allows unauthenticated read to geo_leagues collection', async function () {
      const db = getUnauth();
      await assertSucceeds(db.collection('geo_leagues').doc('geo-uk').get());
    });

    it('denies unauthenticated writes to geo_leagues collection', async function () {
      const db = getUnauth();
      await assertFails(db.collection('geo_leagues').doc('geo-uk').set({ members: {} }));
    });
  });

  // -----------------------------------------------------------------
  // 2. Email Verification Requirements for Leagues
  // -----------------------------------------------------------------
  describe('2. Email Verification Gates', function () {
    it('denies unverified email user from creating a league', async function () {
      const db = getUnverifiedUser('bob');
      const payload = { ...validLeaguePayload, creatorUid: 'bob' };
      await assertFails(db.collection('leagues').doc(validLeagueCode).set(payload));
    });

    it('denies unverified email user from reading a league doc', async function () {
      // Seed league doc with admin rights
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('leagues').doc(validLeagueCode).set(validLeaguePayload);
      });

      const db = getUnverifiedUser('bob');
      await assertFails(db.collection('leagues').doc(validLeagueCode).get());
    });

    it('allows verified email user (password provider) to create league', async function () {
      const db = getVerifiedUser('alice');
      await assertSucceeds(db.collection('leagues').doc(validLeagueCode).set(validLeaguePayload));
    });

    it('allows Google signed-in user to create and read league', async function () {
      const db = getGoogleUser('google_user');
      const payload = { ...validLeaguePayload, creatorUid: 'google_user' };
      await assertSucceeds(db.collection('leagues').doc(validLeagueCode).set(payload));
      await assertSucceeds(db.collection('leagues').doc(validLeagueCode).get());
    });
  });

  // -----------------------------------------------------------------
  // 3. User Scoping & Cross-User Tampering
  // -----------------------------------------------------------------
  describe('3. User Profile & Subcollection Ownership', function () {
    it('allows user to create and update their own profile', async function () {
      const db = getVerifiedUser('alice');
      await assertSucceeds(db.collection('users').doc('alice').set(validUserPayload));

      const updatePayload = {
        ...validUserPayload,
        avatar: '🎯',
        updatedAt: new Date()
      };
      await assertSucceeds(db.collection('users').doc('alice').set(updatePayload));
    });

    it('denies User B from writing to User A profile', async function () {
      const dbBob = getVerifiedUser('bob');
      await assertFails(dbBob.collection('users').doc('alice').set(validUserPayload));
    });

    it('denies deleting user profiles', async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('users').doc('alice').set(validUserPayload);
      });
      const dbAlice = getVerifiedUser('alice');
      await assertFails(dbAlice.collection('users').doc('alice').delete());
    });

    it('denies User B from accessing User A diary', async function () {
      const dbBob = getVerifiedUser('bob');
      await assertFails(
        dbBob.collection('users').doc('alice').collection('diary').doc('bet_1').set({
          fixture: 'Arsenal vs Chelsea',
          stake: 10
        })
      );
    });

    it('allows User A to read and write their own diary and leagueMemberships', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(
        dbAlice.collection('users').doc('alice').collection('diary').doc('bet_1').set({
          fixture: 'Arsenal vs Chelsea',
          stake: 10
        })
      );
      await assertSucceeds(
        dbAlice.collection('users').doc('alice').collection('leagueMemberships').doc(validLeagueCode).set({
          joinedAt: new Date().toISOString()
        })
      );
    });
  });

  // -----------------------------------------------------------------
  // 4. Handle Registry & Canonical Lowercase ID Enforcement
  // -----------------------------------------------------------------
  describe('4. Handle Registry & Uniqueness', function () {
    it('allows user to claim handle when docId matches handle.lower()', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(
        dbAlice.collection('handles').doc('alice_99').set({
          uid: 'alice',
          handle: 'Alice_99',
          createdAt: new Date()
        })
      );
    });

    it('rejects handle claim when docId does NOT match handle.lower()', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(
        dbAlice.collection('handles').doc('ALICE_99').set({
          uid: 'alice',
          handle: 'Alice_99',
          createdAt: new Date()
        })
      );
    });

    it('rejects invalid handle formats (too short or special characters)', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(
        dbAlice.collection('handles').doc('al').set({
          uid: 'alice',
          handle: 'al',
          createdAt: new Date()
        })
      );
      await assertFails(
        dbAlice.collection('handles').doc('alice!').set({
          uid: 'alice',
          handle: 'alice!',
          createdAt: new Date()
        })
      );
    });

    it('denies modifying handle document (update is false)', async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('handles').doc('alice_99').set({
          uid: 'alice',
          handle: 'Alice_99',
          createdAt: new Date()
        });
      });
      const dbAlice = getVerifiedUser('alice');
      await assertFails(
        dbAlice.collection('handles').doc('alice_99').update({
          uid: 'bob'
        })
      );
    });

    it('allows handle owner to delete handle but denies other users', async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('handles').doc('alice_99').set({
          uid: 'alice',
          handle: 'Alice_99',
          createdAt: new Date()
        });
      });
      const dbBob = getVerifiedUser('bob');
      await assertFails(dbBob.collection('handles').doc('alice_99').delete());

      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(dbAlice.collection('handles').doc('alice_99').delete());
    });
  });

  // -----------------------------------------------------------------
  // 5. League Administration & Anti-Scraping List Deny
  // -----------------------------------------------------------------
  describe('5. League Administration & List Protection', function () {
    beforeEach(async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('leagues').doc(validLeagueCode).set(validLeaguePayload);
      });
    });

    it('denies whole-collection list on leagues to prevent database dumping', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(dbAlice.collection('leagues').get());
    });

    it('allows verified user to get single league by code', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(dbAlice.collection('leagues').doc(validLeagueCode).get());
    });

    it('allows creator to rename league', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(
        dbAlice.collection('leagues').doc(validLeagueCode).set({
          ...validLeaguePayload,
          name: 'Renamed Paisley Club'
        })
      );
    });

    it('denies non-creator from renaming or updating league', async function () {
      const dbBob = getVerifiedUser('bob');
      await assertFails(
        dbBob.collection('leagues').doc(validLeagueCode).set({
          ...validLeaguePayload,
          name: 'Hacked Club'
        })
      );
    });

    it('denies non-creator from deleting league', async function () {
      const dbBob = getVerifiedUser('bob');
      await assertFails(dbBob.collection('leagues').doc(validLeagueCode).delete());
    });

    it('allows creator to delete league', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(dbAlice.collection('leagues').doc(validLeagueCode).delete());
    });
  });

  // -----------------------------------------------------------------
  // 6. Member Stats Validation & Out-of-Bounds Rejection
  // -----------------------------------------------------------------
  describe('6. Member Stats Bounds & Validation', function () {
    beforeEach(async function () {
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await adminContext.firestore().collection('leagues').doc(validLeagueCode).set(validLeaguePayload);
      });
    });

    it('allows user to create their own member record with valid stats', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set(validMemberPayload)
      );
    });

    it('denies User B from creating or updating User A member record', async function () {
      const dbBob = getVerifiedUser('bob');
      await assertFails(
        dbBob.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set(validMemberPayload)
      );
    });

    it('rejects winRate > 100 or < 0', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set({
          ...validMemberPayload,
          winRate: 105
        })
      );
      await assertFails(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set({
          ...validMemberPayload,
          winRate: -5
        })
      );
    });

    it('rejects points out of range (-1000 to 50000)', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set({
          ...validMemberPayload,
          points: 999999
        })
      );
      await assertFails(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set({
          ...validMemberPayload,
          points: -1500
        })
      );
    });

    it('rejects form array larger than 10 items', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set({
          ...validMemberPayload,
          form: ['W', 'L', 'W', 'L', 'W', 'L', 'W', 'L', 'W', 'L', 'W'] // 11 items
        })
      );
    });

    it('rejects unexpected fields (strict schema enforcement)', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('alice').set({
          ...validMemberPayload,
          isAdmin: true
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
      const dbBob = getVerifiedUser('bob');
      await assertSucceeds(
        dbBob.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').delete()
      );
    });

    it('allows league creator (Alice) to kick member (Bob)', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertSucceeds(
        dbAlice.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').delete()
      );
    });

    it('denies third-party non-creator user (Charlie) from kicking member (Bob)', async function () {
      const dbCharlie = getVerifiedUser('charlie');
      await assertFails(
        dbCharlie.collection('leagues').doc(validLeagueCode).collection('members').doc('bob').delete()
      );
    });
  });

  // -----------------------------------------------------------------
  // 8. Default Deny on Unmatched Paths
  // -----------------------------------------------------------------
  describe('8. Default Deny on Unmatched Paths', function () {
    it('denies reads and writes on arbitrary top-level collections', async function () {
      const dbAlice = getVerifiedUser('alice');
      await assertFails(dbAlice.collection('secrets').doc('key1').get());
      await assertFails(dbAlice.collection('secrets').doc('key1').set({ secret: '123' }));
      await assertFails(dbAlice.collection('admin_logs').doc('log1').get());
    });
  });
});
