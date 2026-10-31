#!/usr/bin/env node
/**
 * scripts/wipe_all_users.js
 *
 * Clean-slate wipe script for Firebase project "betbuddyuk".
 * Uses Application Default Credentials (ADC) with firebase-admin.
 *
 * Usage:
 *   node scripts/wipe_all_users.js            # default: --dry-run
 *   node scripts/wipe_all_users.js --dry-run  # explicit dry-run
 *   node scripts/wipe_all_users.js --execute  # interactive execution with mandatory confirmation & local backup
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const PROJECT_ID = 'betbuddyuk';
const REQUIRED_CONFIRM_PHRASE = 'WIPE betbuddyuk';

if (!admin.getApps().length) {
  admin.initializeApp({
    projectId: PROJECT_ID
  });
}

const db = getFirestore();
const auth = getAuth();

const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const isDryRun = !isExecute;

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(query, ans => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function collectAllAuthUsers() {
  const users = [];
  let nextPageToken;
  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    users.push(...listResult.users);
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);
  return users;
}

async function getCollectionDataWithSubcollections(collName, subcolls = []) {
  const snapshot = await db.collection(collName).get();
  const docsData = [];

  for (const doc of snapshot.docs) {
    const data = {
      _id: doc.id,
      _path: doc.ref.path,
      ...doc.data()
    };

    if (subcolls.length > 0) {
      data._subcollections = {};
      for (const sub of subcolls) {
        const subSnap = await doc.ref.collection(sub).get();
        data._subcollections[sub] = subSnap.docs.map(sDoc => ({
          _id: sDoc.id,
          _path: sDoc.ref.path,
          ...sDoc.data()
        }));
      }
    }
    docsData.push(data);
  }

  return { docs: snapshot.docs, data: docsData };
}

async function run() {
  console.log('====================================================');
  console.log(' Bet Buddy (MatchIQ) Clean-Slate Wipe Tool');
  console.log(` Project: ${PROJECT_ID}`);
  console.log(` Mode:    ${isExecute ? 'EXECUTE (DESTRUCTIVE)' : 'DRY-RUN (READ-ONLY)'}`);
  console.log('====================================================\n');

  try {
    // 1. Inspect Top-Level Collections
    console.log('[1/5] Inspecting Firestore top-level collections...');
    const allColls = await db.listCollections();
    const allCollIds = allColls.map(c => c.id);
    console.log(`Found collections: ${allCollIds.join(', ') || 'none'}\n`);

    const knownUserCollections = ['users', 'handles', 'leagues', 'geo_leagues'];
    const otherColls = allCollIds.filter(c => !knownUserCollections.includes(c));
    if (otherColls.length > 0) {
      console.log(`NOTE: Additional collections detected (will NOT be touched): ${otherColls.join(', ')}\n`);
    }

    // 2. Scan Firebase Auth Users
    console.log('[2/5] Scanning Firebase Auth users...');
    const authUsers = await collectAllAuthUsers();
    console.log(`  Auth Users Total: ${authUsers.length}`);
    // Privacy safeguard: do not print user emails or PII
    console.log(`  UIDs found: ${authUsers.map(u => u.uid.slice(0, 8) + '...').join(', ') || 'none'}\n`);

    // 3. Scan users (and subcollections: leagueMemberships, diary)
    console.log('[3/5] Scanning "users" collection (+ leagueMemberships, diary subcollections)...');
    const { docs: userDocs, data: userData } = await getCollectionDataWithSubcollections('users', ['leagueMemberships', 'diary']);
    let totalMemberships = 0;
    let totalDiaryEntries = 0;
    userData.forEach(u => {
      totalMemberships += (u._subcollections.leagueMemberships || []).length;
      totalDiaryEntries += (u._subcollections.diary || []).length;
    });
    console.log(`  Users Docs:            ${userDocs.length}`);
    console.log(`  League Memberships:    ${totalMemberships}`);
    console.log(`  Cloud Diary Entries:   ${totalDiaryEntries}\n`);

    // 4. Scan handles
    console.log('[4/5] Scanning "handles" collection...');
    const { docs: handleDocs, data: handleData } = await getCollectionDataWithSubcollections('handles');
    const handleNames = handleDocs.map(d => d.id);
    console.log(`  Handles Docs:          ${handleDocs.length}`);
    console.log(`  Handle Names:          ${handleNames.join(', ') || 'none'}\n`);

    // 5. Scan leagues (and subcollection: members)
    console.log('[5/5] Scanning "leagues" collection (+ members subcollection)...');
    const { docs: leagueDocs, data: leagueData } = await getCollectionDataWithSubcollections('leagues', ['members']);
    let totalLeagueMembers = 0;
    leagueData.forEach(l => {
      totalLeagueMembers += (l._subcollections.members || []).length;
    });
    const leagueCodes = leagueDocs.map(d => d.id);
    console.log(`  Leagues Docs:          ${leagueDocs.length}`);
    console.log(`  League Member Docs:    ${totalLeagueMembers}`);
    console.log(`  League Codes:          ${leagueCodes.join(', ') || 'none'}\n`);

    // Inspect geo_leagues
    console.log('Inspecting "geo_leagues" collection (structure preserved, per-user data checked)...');
    let geoDocs = [];
    try {
      const geoSnap = await db.collection('geo_leagues').get();
      geoDocs = geoSnap.docs;
      console.log(`  geo_leagues docs found: ${geoDocs.map(d => d.id).join(', ') || 'none'}`);
      geoDocs.forEach(d => {
        const dData = d.data() || {};
        const memberCount = dData.members ? Object.keys(dData.members).length : 0;
        console.log(`    - ${d.id}: member keys=${memberCount}`);
      });
    } catch (e) {
      console.log(`  Notice reading geo_leagues: ${e.message}`);
    }
    console.log('');

    // Summary Totals
    console.log('----------------------------------------------------');
    console.log(' SUMMARY OF DATA TARGETED FOR CLEAN-SLATE WIPE:');
    console.log('----------------------------------------------------');
    console.log(`  Firebase Auth Users:     ${authUsers.length}`);
    console.log(`  Users Documents:         ${userDocs.length} (plus ${totalMemberships} memberships, ${totalDiaryEntries} diary entries)`);
    console.log(`  Handles Documents:       ${handleDocs.length}`);
    console.log(`  Leagues Documents:       ${leagueDocs.length} (plus ${totalLeagueMembers} member records)`);
    console.log(`  Geo Leagues Documents:   ${geoDocs.length} (structure preserved, will clear user scores if present)`);
    console.log('----------------------------------------------------\n');

    if (isDryRun) {
      console.log('=== DRY-RUN COMPLETE ===');
      console.log('No data was modified or deleted.');
      console.log('To execute the clean-slate wipe, run:');
      console.log('  node scripts/wipe_all_users.js --execute\n');
      return;
    }

    // -----------------------------------------------------------------
    // EXECUTE MODE: Backup & Strict Confirmation
    // -----------------------------------------------------------------
    console.log('ATTENTION: You are in EXECUTE mode.');
    console.log('All targeted user profiles, handles, leagues, and auth credentials will be permanently deleted.\n');

    const confirmation = await askQuestion(`Type "${REQUIRED_CONFIRM_PHRASE}" to confirm destruction: `);
    if (confirmation !== REQUIRED_CONFIRM_PHRASE) {
      console.error(`\nAborted. Input "${confirmation}" did not match "${REQUIRED_CONFIRM_PHRASE}". Zero data was touched.`);
      process.exit(1);
    }

    // Step A: Local JSON Backup
    console.log('\n[Step 1/3] Generating mandatory local JSON backup before deletion...');
    const backupsDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupsDir, `betbuddyuk-backup-${timestamp}.json`);

    const backupPayload = {
      project: PROJECT_ID,
      timestamp: new Date().toISOString(),
      counts: {
        authUsers: authUsers.length,
        users: userDocs.length,
        handles: handleDocs.length,
        leagues: leagueDocs.length
      },
      data: {
        users: userData,
        handles: handleData,
        leagues: leagueData,
        geo_leagues: geoDocs.map(d => ({ _id: d.id, ...d.data() }))
      }
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');

    // Verify backup file exists and has content
    const stats = fs.statSync(backupFilePath);
    if (!stats || stats.size < 10) {
      throw new Error(`Backup failed: file ${backupFilePath} is missing or empty. Refusing to proceed with deletion.`);
    }
    console.log(`  ✓ Backup verified and written to: ${backupFilePath} (${stats.size} bytes)\n`);

    // Step B: Delete Firestore Data recursively
    console.log('[Step 2/3] Deleting Firestore documents recursively...');

    // Delete users recursively
    let deletedUsers = 0;
    for (const doc of userDocs) {
      await db.recursiveDelete(doc.ref);
      deletedUsers++;
    }
    console.log(`  ✓ Deleted ${deletedUsers} user profiles (and all subcollections)`);

    // Delete handles recursively
    let deletedHandles = 0;
    for (const doc of handleDocs) {
      await db.recursiveDelete(doc.ref);
      deletedHandles++;
    }
    console.log(`  ✓ Deleted ${deletedHandles} handles`);

    // Delete leagues recursively
    let deletedLeagues = 0;
    for (const doc of leagueDocs) {
      await db.recursiveDelete(doc.ref);
      deletedLeagues++;
    }
    console.log(`  ✓ Deleted ${deletedLeagues} leagues (and all member subcollections)`);

    // Clean geo_leagues per-user members if present (keep structure)
    for (const gDoc of geoDocs) {
      const gData = gDoc.data() || {};
      if (gData.members && Object.keys(gData.members).length > 0) {
        await gDoc.ref.update({ members: {} });
        console.log(`  ✓ Cleared members map on geo_league doc: ${gDoc.id}`);
      }
    }

    // Step C: Delete Firebase Auth Users
    console.log('\n[Step 3/3] Deleting Firebase Auth users in batches...');
    let deletedAuthUsers = 0;
    if (authUsers.length > 0) {
      const uids = authUsers.map(u => u.uid);
      const batchSize = 1000;
      for (let i = 0; i < uids.length; i += batchSize) {
        const batch = uids.slice(i, i + batchSize);
        const result = await auth.deleteUsers(batch);
        deletedAuthUsers += result.successCount;
        if (result.failureCount > 0) {
          console.warn(`  Warning: Failed to delete ${result.failureCount} auth users:`, result.errors);
        }
      }
    }
    console.log(`  ✓ Deleted ${deletedAuthUsers} Firebase Auth accounts\n`);

    console.log('====================================================');
    console.log(' CLEAN-SLATE WIPE COMPLETED SUCCESSFULLY');
    console.log(` Backup preserved at: ${backupFilePath}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n[FATAL ERROR] Clean-slate wipe failed:');
    console.error(err.message || err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

run();
