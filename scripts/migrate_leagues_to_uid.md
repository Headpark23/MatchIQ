# Bet Buddy League Migration Guide: Map to UID Subcollection

This guide details the migration procedure for converting legacy Buddy Leagues from the unauthenticated `members.{handle}` document-level map into the UID-keyed subcollection structure (`leagues/{code}/members/{uid}`) and user index (`users/{uid}/leagueMemberships/{code}`).

---

## 1. Migration Strategy Overview

### Legacy Structure
- **Doc**: `leagues/{code}`
- **Payload**:
  ```json
  {
    "code": "BUDDY-4921",
    "name": "Friday Punters",
    "icon": "⚽",
    "freq": "weekly",
    "creator_handle": "Liam",
    "created_at": "2026-10-30",
    "members": {
      "Liam": { "handle": "Liam", "points": 140, "winRate": 60, "roi": 12.5, "settled": 5, "form": ["W", "L"] },
      "Chris": { "handle": "Chris", "points": 95, "winRate": 40, "roi": 5.0, "settled": 5, "form": ["L", "W"] }
    }
  }
  ```

### New Target Structure
- **League Document**: `leagues/{code}`
  ```json
  {
    "code": "BUDDY-4921",
    "name": "Friday Punters",
    "icon": "⚽",
    "freq": "weekly",
    "creatorUid": "<uid_or_null>",
    "creatorHandle": "Liam",
    "createdAt": "2026-10-30T00:00:00.000Z",
    "updatedAt": "2026-10-31T12:00:00.000Z",
    "_legacyMembersBackup": { ... }
  }
  ```
- **Member Subcollection**: `leagues/{code}/members/{uid}`
  ```json
  {
    "uid": "<uid>",
    "handle": "Liam",
    "avatar": "⚽",
    "points": 140,
    "winRate": 60,
    "roi": 12.5,
    "settled": 5,
    "form": ["W", "L"],
    "updatedAt": "2026-10-31T12:00:00.000Z"
  }
  ```
- **User Membership Index**: `users/{uid}/leagueMemberships/{code}`
  ```json
  {
    "code": "BUDDY-4921",
    "name": "Friday Punters",
    "icon": "⚽",
    "role": "creator",
    "joinedAt": "2026-10-31T12:00:00.000Z"
  }
  ```

---

## 2. Claiming Legacy Member Entries

Because legacy entries were created without authentication UIDs:
1. When a legacy user creates an account or signs in with Google, `ensureUserProfile()` registers their handle in `users/{uid}` and reserves `handles/{handleLower}`.
2. If `leagues/{code}` has a legacy member whose `handle` matches the newly authenticated user's handle:
   - When the user views or joins the league, their stats are automatically migrated into `leagues/{code}/members/{uid}` and indexed under `users/{uid}/leagueMemberships/{code}`.
   - If the user was the creator (`creatorHandle === user.handle`), `creatorUid` is assigned to their `uid`.
3. The migration script preserves `_legacyMembersBackup` on the document root so no historical records or stats are destroyed.

---

## 3. Migration Script (`scripts/migrate_leagues.js`)

Below is the complete Node.js migration script with full `--dry-run` safety mode.

```javascript
#!/usr/bin/env node
/**
 * migrate_leagues.js - Convert legacy member maps into UID subcollections
 *
 * Usage:
 *   node scripts/migrate_leagues.js --dry-run
 *   node scripts/migrate_leagues.js --execute
 *   node scripts/migrate_leagues.js --rollback
 *
 * Pre-requisite:
 *   Set GOOGLE_APPLICATION_CREDENTIALS to your service account key, or run
 *   in an environment with Application Default Credentials (ADC).
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
  console.log('----------------------------------------------------\\n');

  const leaguesSnap = await db.collection('leagues').get();
  console.log(`Found ${leaguesSnap.size} total league documents.\\n`);

  // Build handle-to-UID map from existing claimed handles
  const handlesSnap = await db.collection('handles').get();
  const handleToUid = new Map();
  handlesSnap.forEach(doc => {
    const d = doc.data();
    if (d && d.handle && d.uid) {
      handleToUid.set(d.handle.toLowerCase(), d.uid);
    }
  });
  console.log(`Loaded ${handleToUid.size} registered gamertags from handles collection.\\n`);

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
      // Preserve backup before removing legacy root map
      await doc.ref.update({
        _legacyMembersBackup: membersMap,
        updatedAt: new Date().toISOString()
      });
    }
  }

  console.log('\\n----------------------------------------------------');
  console.log('Migration Summary:');
  console.log(`Leagues Processed:      ${processedCount}`);
  console.log(`Subcollection Members:  ${migratedMembersCount}`);
  console.log('----------------------------------------------------');
  if (isDryRun) {
    console.log('\\nDRY RUN complete. No data was modified. Pass --execute to apply live changes.');
  } else {
    console.log('\\nEXECUTION complete. Changes committed to Firestore.');
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

---

## 4. Rollback Procedure

If any issue arises:
1. Run `node scripts/migrate_leagues.js --rollback --execute`.
2. The script restores the `members` field from `_legacyMembersBackup` and leaves existing subcollections intact.
3. The client application retains fallback logic (`extractMembersFromDoc`) to read from the root `members` map if the subcollection is empty.

