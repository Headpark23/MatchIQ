#!/usr/bin/env node
/**
 * migrate_leagues.js - Convert legacy member maps into UID subcollections
 *
 * Usage:
 *   node scripts/migrate_leagues.js --dry-run
 *   node scripts/migrate_leagues.js --execute
 *   node scripts/migrate_leagues.js --rollback
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'betbuddyuk'
  });
}

const db = admin.firestore();
const isDryRun = process.argv.includes('--dry-run') || (!process.argv.includes('--execute') && !process.argv.includes('--rollback'));
const isRollback = process.argv.includes('--rollback');

async function run() {
  console.log('----------------------------------------------------');
  console.log('Bet Buddy League Migration Tool');
  console.log('Project: betbuddyuk');
  console.log('Mode:    ' + (isRollback ? 'ROLLBACK' : isDryRun ? 'DRY RUN (No writes)' : 'EXECUTE (Live updates)'));
  console.log('----------------------------------------------------\n');

  const leaguesSnap = await db.collection('leagues').get();
  console.log(`Found ${leaguesSnap.size} total league documents.\n`);

  const handlesSnap = await db.collection('handles').get();
  const handleToUid = new Map();
  handlesSnap.forEach(doc => {
    const d = doc.data();
    if (d && d.handle && d.uid) {
      handleToUid.set(d.handle.toLowerCase(), d.uid);
    }
  });
  console.log(`Loaded ${handleToUid.size} registered gamertags from handles collection.\n`);

  let processedCount = 0;
  let migratedMembersCount = 0;

  for (const doc of leaguesSnap.docs) {
    const data = doc.data();
    const code = doc.id;
    console.log(`Checking League [${code}]: "${data.name || 'Untitled'}"`);

    if (isRollback) {
      if (data._legacyMembersBackup) {
        console.log(`  [ROLLBACK] Restoring legacy members map from _legacyMembersBackup...`);
        if (!isDryRun) {
          await doc.ref.update({
            members: data._legacyMembersBackup,
            _legacyMembersBackup: admin.firestore.FieldValue.delete()
          });
        }
      } else {
        console.log(`  [ROLLBACK] No backup found on doc; skipping.`);
      }
      continue;
    }

    const membersMap = data.members || {};
    const memberEntries = Object.entries(membersMap);

    if (memberEntries.length === 0) {
      console.log(`  No legacy map members found on root document. Already migrated or empty.`);
      continue;
    }

    console.log(`  Found ${memberEntries.length} member(s) in root map.`);
    processedCount++;

    for (const [key, mem] of memberEntries) {
      const handle = mem.handle || key;
      const uid = handleToUid.get(handle.toLowerCase()) || null;

      console.log(`    Member: @${handle} -> ${uid ? 'Claimed by UID ' + uid : 'Unclaimed (Will migrate upon user login)'}`);

      if (uid && !isDryRun) {
        const memRef = doc.ref.collection('members').doc(uid);
        await memRef.set({
          uid: uid,
          handle: handle,
          avatar: mem.avatar || '⚽',
          points: parseInt(mem.points, 10) || 0,
          winRate: Math.round(+mem.winRate || 0),
          roi: Math.round((+mem.roi || 0) * 10) / 10,
          settled: parseInt(mem.settled, 10) || 0,
          form: Array.isArray(mem.form) ? mem.form.slice(0, 10) : ['—'],
          updatedAt: new Date().toISOString()
        }, { merge: true });

        const membershipRef = db.collection('users').doc(uid).collection('leagueMemberships').doc(code);
        await membershipRef.set({
          code: code,
          name: (data.name || 'Buddy League').slice(0, 40),
          icon: data.icon || '⚽',
          role: (data.creator_handle === handle || data.creatorHandle === handle) ? 'creator' : 'member',
          joinedAt: new Date().toISOString()
        }, { merge: true });

        migratedMembersCount++;
      }
    }

    if (!isDryRun) {
      await doc.ref.update({
        _legacyMembersBackup: membersMap,
        updatedAt: new Date().toISOString()
      });
    }
  }

  console.log('\n----------------------------------------------------');
  console.log('Migration Summary:');
  console.log(`Leagues Processed:      ${processedCount}`);
  console.log(`Subcollection Members:  ${migratedMembersCount}`);
  console.log('----------------------------------------------------');
  if (isDryRun) {
    console.log('\nDRY RUN complete. No data was modified. Pass --execute to apply live changes.');
  } else {
    console.log('\nEXECUTION complete. Changes committed to Firestore.');
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { run };

