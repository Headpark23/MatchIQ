# Bet Buddy Authentication & League Model Reconnaissance

**Date**: 2026-10-31  
**Target Environment**: `https://betbuddyuk.uk` / Firebase Project `betbuddyuk`  
**Branch**: `feat/real-auth-leagues`  

---

## 1. Executive Summary

A comprehensive code and architecture audit of the authentication and league synchronization subsystems was conducted across `app.js`, `index.html`, `sw.js`, `build_public_dist.py`, `vercel.json`, and `tests/`.

All 5 core findings in the initial prompt were **100% verified**:
1. **Fake Client Authentication**: No Firebase Auth SDK is loaded or invoked. `#google-quick-signin-form` accepts arbitrary typed nicknames/emails and saves them directly to `localStorage` key `betbuddy_auth_user_v1`.
2. **Handle-Based Unverified Identity**: Leagues and Geo-leagues store player stats under arbitrary handle strings in document-level maps (`members.{handle}`). All stats (`points`, `winRate`, `roi`, `settled`) are computed client-side and unvalidated.
3. **Client-Side Authorization Vulnerabilities**: Admin operations (`renameLeague`, `kickPlayerFromLeague`, `deleteLeague`) perform direct Firestore mutations without verifying creator credentials.
4. **Unscalable & Insecure Full-Table Reads**: `syncUserLeaguesFromCloud` calls `.collection('leagues').get()` and `fetchCloudDataRest` calls the Firestore REST endpoint (`/leagues?key=...`), dumping the entire global database to client memory to filter locally.
5. **Missing Rule Definitions**: The repository contained neither `firestore.rules`, `firebase.json`, nor `.firebaserc`.

---

## 2. Current Data Shapes & Schemas

### 2.1 Private Buddy Leagues: `leagues/{code}`
- **Storage Path**: `leagues/{code}` where `{code}` is a user-entered string (e.g., `PAISLEY26`).
- **Document Payload**:
  ```json
  {
    "name": "Paisley Punters",
    "icon": "⚽",
    "freq": "weekly",
    "code": "PAISLEY26",
    "creator_handle": "Liam",
    "created_at": "2026-10-30",
    "members": {
      "Liam": {
        "handle": "Liam",
        "avatar": "⚽",
        "points": 45,
        "winRate": 60,
        "roi": 12.5,
        "settled": 5,
        "form": ["W", "L", "W", "W", "L"],
        "updated_at": "2026-10-30T14:22:00.000Z"
      }
    }
  }
  ```
- **Flaws**:
  - `code` is predictable and short (often 4–10 characters, easily scanned).
  - `members` is a nested map inside the league document. If a league grows, the document risks exceeding the 1 MB Firestore document limit.
  - Concurrent writes to `members.{handle}` risk contention and race conditions.

### 2.2 Geographic Tier Leagues: `geo_leagues/{docId}`
- **Storage Path**: `geo_leagues/{docId}` where `{docId}` is one of `geo-world`, `geo-europe`, `geo-uk`, `country-{c}`, `region-{r}`, `town-{t}`.
- **Document Payload**:
  ```json
  {
    "members": {
      "Punter_99": {
        "handle": "Punter_99",
        "avatar": "⚽",
        "town": "Paisley",
        "region": "Renfrewshire",
        "country": "Scotland",
        "points": 24,
        "winRate": 50,
        "roi": 8.0,
        "settled": 6,
        "form": ["W", "L", "—"],
        "updated_at": "2026-10-30T14:22:00.000Z"
      }
    }
  }
  ```
- **Flaws**:
  - Global documents like `geo_leagues/geo-world` aggregate hundreds of punters into a single document map, which will inevitably crash at 1 MB.
  - Any client can overwrite any other player's map key by simply passing their handle name.

---

## 3. Inventory of Identity & Auth Call Sites

The following 21 touchpoints in `app.js` currently depend on `getAuthUser()`, `getUserProfile()`, or raw `handle`:

| Line(s) | Context / Function | Current Behavior | Required New Behavior |
|---|---|---|---|
| `50`, `4005` | Boot / Route Render | Calls `updateHeaderAuthUI()` | Driven by `firebase.auth().onAuthStateChanged` |
| `1242` | `viewHome()` | Reads `getAuthUser().name` for greeting | Reads `user.displayName || user.handle || 'Punter'` |
| `1830` | `fetchCloudDataRest()` | REST GET of all leagues with API key | **ELIMINATE REST READS**. Replace with indexed queries |
| `1968` | `syncUserToGeoCloud()` | Writes unverified stats to `geo_leagues` by handle | Restructure or gate with verified UID |
| `2001` | `renameLeague()` | Unverified client writes new name to Firestore | Enforce `creatorUid == request.auth.uid` |
| `2033` | `refreshLeagueFromCloud()` | Filters local members by `m.handle !== prof.handle` | Filter by `m.uid !== currentUid` |
| `2056` | `kickPlayerFromLeague()` | Deletes `members.{handle}` without check | Enforce creator UID check; delete `members/{uid}` |
| `2083` | `deleteLeague()` | Calls `.delete()` directly on Firestore doc | Enforce creator UID check; delete members subcollection |
| `2110` | `syncLeagueToCloud()` | Updates `members.{handle}` with local stats | Write to `leagues/{code}/members/{uid}` |
| `2151` | `syncUserLeaguesFromCloud()` | Full collection `.get()` of all leagues | Query `users/{uid}/leagueMemberships` |
| `2207` | `listenToActiveLeague()` | Real-time `onSnapshot` on league doc | Listen to `leagues/{code}` and `members/{uid}` subcollection |
| `2245` | `joinCloudLeague()` | Creates local copy and pushes handle to cloud | Read league doc by code, create member doc + membership index |
| `2312` | `getUserProfile()` | Reads `betbuddy_user_profile_v1` from localStorage | Keep for offline defaults; sync with `users/{uid}` |
| `2340` | `saveUserProfile()` | Saves handle, town, region, country | Claim handle in `handles/{handleLower}` |
| `2944` | Diary modal prefill | Sets profile input to `@handle` | Use verified handle |
| `3077` | `handleDiaryFormSubmit()` | Attaches `@handle` to diary record | Keep compatibility format `@handle` |
| `3303` | Punter list filtering | Filters stats by `auth.handle` | Filter by handle/UID |
| `3739` | `viewMore()` (Account) | Displays user details & sign-out button | Wire to real Auth profile & provider information |
| `4025` | `getAuthUser()` | Reads `betbuddy_auth_user_v1` localStorage | Return compatibility object from live Firebase Auth state |
| `4409` | Sign Out button | Calls `saveAuthUser(null)` in localStorage | Call `firebase.auth().signOut()` |
| `4648` | Auth Form Submit | Takes nickname & fake email | Replace with real Firebase Auth handlers |
| `4860` | `confirmRealBetPlaced()` | Attaches `@handle` to real bet log | Uses verified handle |

---

## 4. Assessment of Geo Leagues vs. Private Buddy Leagues

In `app.js`, `geo_leagues` was built as a proof-of-concept for 6 tiers (`geo-world`, `geo-europe`, `geo-uk`, `geo-country`, `geo-region`, `geo-town`).
- **Immediate Risk**: Each user's bet sync writes to all 6 documents concurrently. Storing player maps inside a single document will quickly exceed Firestore's 1 MiB per document limit.
- **Recommendation**:
  1. For Step 3 & 4, focus the UID-keyed subcollection model and rules on `leagues/{code}/members/{uid}`.
  2. For `geo_leagues`, maintain a safe, sandboxed read path or transition `geo_leagues/{tierId}/members/{uid}` if active, but do NOT allow unauthenticated broadcast writes.
  3. Long-term proposal: Migrate global leaderboards to a scheduled aggregation Cloud Function (or lightweight collectionGroup query).

---

## 5. Scope Verification: Cloud Diary Sync (Step 5)

Inspecting `matchiq_bet_diary_v1` in `app.js` (~lines 2680–3100):
- Diary entries are currently stored strictly in `localStorage` under `matchiq_bet_diary_v1`.
- Data format is clean, JSON-serializable, array of bet objects (`id`, `date`, `fixture`, `market`, `selection`, `odds`, `stake`, `outcome`, `potentialReturn`).
- Storing to `users/{uid}/diary/{betId}` is clean and low-risk when protected by `request.auth.uid == uid`.
- Migration approach: Provide a non-destructive "Sync Local Diary to Cloud" button in Account Settings that uploads local entries without wiping anything.

---

## 6. Implementation Action Plan

1. **Step 1 (Firebase Auth)**:
   - Add `https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js` to `index.html`.
   - Update `sw.js` cache list & bump version to `v59`.
   - Implement real Google popup + redirect fallback, Email/Password sign up with verification email, password reset, and password change.
   - Wire `onAuthStateChanged` to dynamically populate `getAuthUser()`.
2. **Step 2 (Handles & User Profiles)**:
   - Claim handles in `handles/{handleLower}` transactionally (`uid`, `handle`, `createdAt`).
   - Store public profile at `users/{uid}`: `{handle, avatar, createdAt}`.
3. **Step 3 (UID-Keyed League Architecture)**:
   - `leagues/{code}` for metadata (`name, icon, freq, code, creatorUid, createdAt`).
   - `leagues/{code}/members/{uid}` for player stats (`handle, avatar, points, winRate, roi, settled, form, updatedAt`).
   - `users/{uid}/leagueMemberships/{code}` for fast, authorized league discovery without full-collection scanning.
   - Eliminate `FIRESTORE_REST_BASE` and all public REST calls.
4. **Step 4 (Firestore Security Rules & Emulator Suite)**:
   - Delegate rule creation to `firestore-rules-author` subagent.
   - Configure `firebase.json` and `.firebaserc`.
   - Build unit test suite in `tests/rules/` with `@firebase/rules-unit-testing`.
5. **Step 5 (Diary Cloud Sync)**:
   - Provide scoped `users/{uid}/diary/{betId}` sync.
6. **Step 6 (Rollout & Migration Documentation)**:
   - Prepare `scripts/migrate_leagues_to_uid.md` and `docs/AUTH_ROLLOUT.md`.
