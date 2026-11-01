# Bet Buddy (MatchIQ): consolidated improvement plan

Review date: 2026-11-01. Branch `main` at `1931689`. **No code was changed**; this file is the only deliverable.

**How this was done.** `/arena` is not an available skill in this session, so there were no independent reviewers. This is one reviewer applying all eight lenses, and the "dedupe across reviewers" step reduced to merging findings that overlapped between lenses. I read the README, handover doc, workflows, rules, Cloud Functions, `pipeline/`, `sw.js`, `index.html`, and targeted parts of `app.js`. I ran the test suites. I did **not** read all 7,143 lines of `app.js`, run the app in a browser, or touch any cloud console (see "What I could not verify").

## Status update (implemented, uncommitted)

Done: 0.1 age gate, 0.2 Play safe page (helpline, GAMSTOP), 0.3 copy rewrite (no "value bet / % edge / target return" claims), 0.4 privacy rewrite plus Terms, 0.7 BTTS fix with test, 1.1 cron comment, 1.3 PR test workflow (`tests.yml`), 1.8 affiliate wording, version bump to v104 and `public-dist/` rebuilt.
Not done: 0.5 in-app account deletion (interim: erasure by email, stated in the privacy notice), 0.6 profile-read rules change, and everything in Phase 1 to 3 not listed above.

---

## 1. App summary (10 lines)

1. Bet Buddy / MatchIQ is a UK football (mainly Premier League, plus Championship, Bundesliga, La Liga and others) prediction and bet-tracking PWA.
2. Audience is UK adult casual bettors. The app shows model probabilities, fair odds, a "Strongest signals" ranking, an accumulator builder, a private Bet Diary and friend "Buddy Leagues" with regional ladders.
3. Frontend is a static, framework-free SPA: `index.html`, `styles.css`, `app.js` (414 KB, 7,143 lines), plus `market_calculations.js`, `bet_builder.js`, `settlement.js`, `league_sync.js` and a service worker (`sw.js`, cache `betbuddy-pwa-v103`).
4. Predictions come from a Python pipeline (`pipeline/`, penaltyblog Dixon-Coles, pooled-shrunk model for promoted clubs, 30% model / 70% league blend for goals, corners, cards and shots). Predictions are sealed with SHA-256 in an append-only `data/prediction_history.json` and settled automatically.
5. Data sources: football-data.org (token), OpenLigaDB (ODbL), openfootball (CC0), football-data.co.uk (stats, manual refresh), The Odds API (UK bookmaker prices, self-capped at 400 credits per month).
6. Backend: Firebase project `betbuddyuk` (Google sign-in, Firestore for profiles, diary, leagues and league bets) plus Cloud Functions v2 (`functions/index.js`, europe-west1) that check and settle league bets and build the ladders.
7. Deploy: `matchiq-refresh.yml` runs every 2 hours, runs the tests, refreshes data, rebuilds the allowlisted `public-dist/`, commits it, and optionally deploys to Vercel. `pages.yml` publishes `public-dist/` to GitHub Pages (`headpark23.github.io/MatchIQ`).
8. Monetisation intent is bookmaker affiliate links and commercial and sponsor enquiries. An owner-only `#/admin` telemetry page exists.
9. Tests: 131 Python tests and 19 JS suites, **all passing locally today**. Rules tests and settlement tests have their own workflows.
10. Data was fresh on review day (`pipeline_status.json` attempted 2026-11-01 11:41 UTC, all sources ok).

---

## 2. Findings

Impact: H/M/L. Effort: S (under 1 day), M (1 to 3 days), L (more). "Verified" means I observed it directly; "Likely" means inferred from code and needs a repro.

### 2a. Compliance and responsible gambling

| ID | Title | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|
| CMP-1 | No account or cloud-data deletion path (UK GDPR erasure) | `firestore.rules`: `users/{uid}` has `allow delete: if false`; `index.html` privacy section 4 offers erasure only via "Clear Diary" (device only). Cloud diary, handle, email-linked profile and town/region/country are stored server-side. | H | M | Add a "Delete my account" action backed by a callable Cloud Function (delete `users/{uid}` tree, `handles`, memberships, `leagueStats`, then the Auth user). Update the privacy notice. |
| CMP-2 | Privacy notice is inaccurate/incomplete | `index.html` ~836: "no third-party analytics", Google sign-in "only" name and email. App also stores location (town/region/country, `isValidUser` in rules), uses Firebase/Google servers, and loads Google Fonts (`index.html:27`) and gstatic scripts (`:235-237`). | H | S | Rewrite notice: list Firebase/Google as processors, location data, retention, lawful basis, Google Fonts. Self-host fonts to remove one disclosure. |
| CMP-3 | No Terms of Use | `grep` for "terms" in `index.html`/`app.js` finds nothing. Only a privacy modal exists. | M | S | Add Terms (information only, not advice, no guarantees, league rules, age 18+, liability) linked from the footer and sign-in modal. |
| CMP-4 | No age confirmation at first run | "18+" appears only as static text (`index.html:100,130,374`). No gate, no confirmation on sign-in or league join. | H | S | Add a one-time 18+ confirmation (stored locally, and as a field on the user doc on sign-in). Block league features and bookmaker links until confirmed. |
| CMP-5 | Responsible-gambling support is thin | Only BeGambleAware and GamCare footer links (`index.html:131`) and a few inline notes. `grep` finds no GAMSTOP, no helpline number, no self-exclusion mention. Diary and acca builder have no spend or time reminders. | H | S | Add a dedicated "Play safe" page: helpline, GAMSTOP, BeGambleAware, GamCare, deposit/time-limit advice; link it from the footer, builder and diary. Optional "I want a break" toggle that hides bookmaker links. |
| CMP-6 | "Target return" acca builder encourages chasing a win figure | `app.js:1153` ("Select your target return"), `:1375` ("Enter stake & how much you aim to win"), `:4792` "Target Return: £…". | H | M | Reframe as a calculator ("what do these selections return?"). Remove target-winnings framing and the "closest available" combination search from the default flow. Show stake-risk first. Get UKGC/ASA wording reviewed before launch to the public. |
| CMP-7 | Value/edge language contradicts the model's own evidence labels | `app.js:1555-1560` and `:1755` produce "Today's Best Value Bet (N% edge vs bookmaker)" even when evidence is provisional. Yet `models.py` says goals/corners/cards/shots are "statistically indistinguishable from the league average". | H | M | Never use "value bet" or "edge" copy unless the market is validated. For provisional markets show "model estimate, no proven edge". Rename "Best Value" and "Strongest signals" to neutral labels such as "Highest model probability". |
| CMP-8 | Affiliate claims don't match implementation | `app.js:5043` says "tracked affiliate attribution", but every URL in `BOOKMAKERS_CONFIG` (`app.js:6804-6811`) is a plain homepage with no affiliate ID. `index.html:728` says "verified bookmaker gateways". | M | S | Either add real affiliate links (with network-required disclosure beside each link) or remove the claims. Keep "ad/affiliate" disclosure adjacent to every outbound link. |
| CMP-9 | Store/ad-policy exposure | Gambling affiliate verification file in root (`gag0p29escioankmdh.html`), deep links that launch bookmaker apps (`app.js:4808`), "Place Bet" copy (`index.html:852`). | M | M | Before any app-store packaging or paid ads, confirm per-platform gambling-affiliate rules (UK only, licensed operators only, geo-restriction). Add a UK-only notice and a non-UK visitor message. |

### 2b. Security and privacy

| ID | Title | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|
| SEC-1 | Any signed-in user can read every profile, including location | `firestore.rules`: `match /users/{uid} { allow read: if isAuthenticated(); }`. Profile fields include `town`, `region`, `country`. | M | S | Move location to a private subdocument (`users/{uid}/private/location`) or restrict profile read to the owner plus members of a shared league. Ladders already carry what other users need. |
| SEC-2 | Unlimited league and handle creation by any Google account | `firestore.rules` leagues/handles `create` have no per-user cap. | L | M | Add App Check, and move league creation behind a callable function with a per-user limit. |
| SEC-3 | Firebase web key and owner email are public in the client | `app.js:2416` (`apiKey`), `app.js:5082` (`OWNER_EMAILS`). The key is public by design, but safe only if restricted. | L | S | In Google Cloud console, restrict the key to the Pages/Vercel/custom domains and enable App Check. Optionally replace the owner email check with a custom claim. |
| SEC-4 | No Content-Security-Policy or modern header set | `vercel.json` has only nosniff, X-Frame-Options and Referrer-Policy; GitHub Pages (the real host per `pages.yml`) ignores `vercel.json` headers entirely. 346 inline `style=` and 26 inline `onclick=` in `app.js` block a strict CSP. | M | L | Short term: add a `<meta http-equiv="Content-Security-Policy">` that allows only gstatic, googleapis, firebase. Long term: remove inline handlers and styles. |
| SEC-5 | Unpinned third-party scripts, old Firebase SDK | `index.html:235-237` loads Firebase compat 10.8.0 from gstatic with no SRI. | L | M | Upgrade Firebase, move to the modular SDK via a bundler, or vendor the files. |
| SEC-6 | Destructive admin scripts live in the repo | `scripts/wipe_all_users.js`, `scripts/clean_and_repair_firestore.py` (names only; contents not reviewed). | M | S | Review for confirmation prompts and project-ID guards, or move them out of the repo. |
| SEC-7 | HTML built by string concatenation | `app.js` builds its UI as concatenated HTML strings; `esc()` is used on spot-checked paths (`:574`, `:585`) but I did not audit every one. | M | M | Add a lint rule or test that flags unescaped interpolation of user-controlled fields (handle, league name, place, diary notes). |

### 2c. Correctness and data/model quality

| ID | Title | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|
| COR-1 | BTTS credible probability uses the wrong market's sample size | `pipeline/recommend.py`, `candidates()`: the BTTS loop calls `blend_n(market)`, where `market` is left over from the earlier `for market in ("goals","corners","cards","shots")` loop (so `"shots"`). It should be `blend_n("btts")`. Harmless for the Premier League (always 409) but wrong for other leagues with per-market validation `n`. | M | S | Replace with `blend_n("btts")` and add a unit test with a `validation` dict whose BTTS `n` differs from shots `n`. |
| COR-2 | Refresh schedule comment disagrees with the cron | `matchiq-refresh.yml`: comment says "every 6 hours: 4 football-data.org requests a day", cron is `40 */2 * * *` (every 2 hours, 12 runs a day). | M | S | Pick the intended cadence and fix either the cron or the comment. Confirm the Odds API 400-credit monthly cap still lasts the month at 12 runs a day. |
| COR-3 | Odds file shows a fresh `fetched_at` while prices are old | `data/odds.json`: `fetched_at` 2026-11-01T11:41 but sampled selections have `retrieved_at`/`last_update` of 2026-10-31T13:00 (about 22 h older). | M | S | Show price age per selection in the UI. Hide or grey out prices older than a threshold. (`app.js:1706` has a stale-price path; confirm it uses per-selection age, not `fetched_at`.) |
| COR-4 | Calibration gap in the busiest probability band | `data/model_reliability.json`: band 40-50%: n=170, mean predicted 0.446 vs observed 0.377 (about 7 points over-confident). | M | M | Fold a band-level correction into the displayed probability or widen the displayed range. Re-check with the next 100 settled matches. |
| COR-5 | Settlement logic duplicated in the browser | `app.js:~460` `historyRecords()` re-derives `pickWon` from fixture scores for records the pipeline has not evaluated. Two implementations can diverge (voids, conflicts, postponements). | M | M | Render only what the pipeline settled. Show "awaiting result" otherwise. |
| COR-6 | LeoVegas click can land on Sky Bet | `app.js:4784` lists `leovegas` in `bookieNames`, but `BOOKMAKERS_CONFIG` (`:6804`) has no `leovegas`, and `buildBookmakerLaunchUrl` (`:4758`) falls back to `skybet`. Likely; needs a repro through the builder's bookmaker picker. | L | S | Add the missing config entry or remove LeoVegas from the picker. |
| COR-7 | Silent failure of the background results sync | `app.js:~6540` `checkAutoUpdateResults` has an empty `catch` ("quiet background update"). A persistent failure leaves the Results page stale with no signal. | L | S | Log once and show a small "last updated" timestamp with a stale warning. |

### 2d. UX and product

| ID | Title | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|
| UX-1 | Seven top-level tabs plus a large "More" | `index.html:85-91` (Home, Picks, Fixtures, Results, Diary, Leagues, More) and many sub-tabs inside More. | M | M | Merge Fixtures into Picks (filter), and make Results a section of Diary. Aim for 4 tabs. Needs a usability pass first. |
| UX-2 | Accessibility is thin | 51 `aria-`/`role=` attributes across an 864-line `index.html` that drives a 7,143-line rendered app; emoji used as icons throughout; many inline colours. A `:focus-visible` style and `prefers-reduced-motion` do exist (`styles.css:65,69`). | M | M | Run an axe/Lighthouse pass, label icon-only buttons, check contrast of dim text, ensure modals trap focus and close on Esc. |
| UX-3 | `index.html` disables HTTP caching for the shell | `index.html:6-8` (`no-cache, no-store`), plus `cache: 'no-store'` fetches. Slows every repeat visit and defeats the service worker's benefit. | M | S | Remove the meta tags. Use content-hashed filenames and normal caching. |
| UX-4 | Retention: no reason to come back | `sw.js` has no `push` or `notificationclick` handler (verified by reading it). | H | M | See "Top 3 retention changes" below. |

**Top 3 retention changes**
1. **Kick-off and result reminders** for followed teams and for logged diary bets (local notifications first, web push later). This is the single biggest gap.
2. **Follow a team**: a personalised Home ("Your team's next match, last result, your diary bets on it"). Seeds the notifications above.
3. **Shareable weekly recap card** (diary or league ladder position, accuracy so far), using the existing share modal. It doubles as growth.

### 2e. Performance

| ID | Title | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|
| PERF-1 | About 3.7 MB of JSON fetched uncached on every load and again every 30 s on Results | `public-dist/data`: `prediction_history.json` 1.86 MB, `fixtures.json` 0.88 MB, `predictions.json` ~0.94 MB (source `data/public` copy 2.8 MB). All fetched with `cache: 'no-store'` (`app.js:449`, `:6528-6531`). | H | M | Use ETag revalidation instead of `no-store`. Split history into "recent" and "archive". Make the 30 s sync a cheap HEAD/ETag check. |
| PERF-2 | One 414 KB unminified `app.js` | `app.js` 414,686 bytes, no build step. | M | M | Add a minify and content-hash step to `build_public_dist.py`. Later, split by route. |
| PERF-3 | 1 MB hero image, precached on install | `assets/stadium_hero.jpg` 1,009,956 bytes, in `sw.js` `PRECACHE_ASSETS`. | M | S | Resize and convert to WebP/AVIF (target under 150 KB). Drop from precache. |
| PERF-4 | Four Google font families on a render-blocking link | `index.html:27` (Inter, JetBrains Mono, Plus Jakarta Sans, Oswald). | L | S | Self-host two families, `font-display: swap`. |

### 2f. Code health and CI

| ID | Title | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|
| CODE-1 | About 150 one-off patch scripts | `scripts/` (`apply_*`, `patch_*`, `bump_*`, `fix_*`); the app was evolved by regex patching. | M | S | Move to `archive/` or delete (git history keeps them). Keep only `sync_functions_shared.js` and anything CI calls. |
| CODE-2 | Duplicate blocks in `app.js` | The "Commercial & Sponsorship Inquiries (n)" heading markup appears 6 times (`:1799`, `:3584`, `:5017`, `:5200`, `:5340`, `:5407`); the `Target Return` slip text is built in 3 places (`:4792`, `:6891`, `:7129`). | M | M | De-duplicate, with tests around the surviving implementation. |
| CODE-3 | Cache-buster versions maintained by hand in 5 places | `sw.js` `CACHE_NAME v103`, `app.js:6561 APP_VERSION`, `index.html` `?v=84/86/97/103`, `manifest.json` `?v=44/50`. Recent commits `1931689`, `12d80da`, `738183b` each fix this drift. | M | S | Generate one build ID in `build_public_dist.py` and stamp it into all four. Add a test that fails if they disagree. |
| CODE-4 | Generated output committed three times | Prediction history exists at `data/`, `data/public/`, and `public-dist/data/`; `public-dist/` (27 files) is committed and rewritten by the bot every 2 h. | M | M | Stop committing `public-dist/`; build it inside `pages.yml`. Keep one source of truth for each data file. |
| CODE-5 | Three possible deploy targets with no declared canonical one | `pages.yml` (GitHub Pages), Vercel deploy step in `matchiq-refresh.yml`, `vercel.json`, Firebase config. The Cloud Function reads data from GitHub Pages (`functions/index.js` `DATA_BASE`). | M | S | Declare Pages as canonical (or move), delete the unused path, and document it in the README. |
| CODE-6 | Main test suites don't gate pull requests | Python and JS suites run only inside `matchiq-refresh.yml` (cron/manual). `rules-tests.yml` triggers on path changes. No lint or type check anywhere. | M | S | Add a `tests.yml` on `pull_request` and `push` that runs both suites. |
| CODE-7 | Root `requirements.txt` is a UTF-16 `pip freeze` of an unrelated environment | Contains Jupyter, plotly, ipython and others; `pipeline/requirements.txt` is the real, pinned file. | L | S | Delete the root file. |
| CODE-8 | Stale handover doc | `MISSION-065-HANDOVER.md` says "`main` does not contain any Mission 063-065 work" and "nothing pushed", yet `main` runs the pipeline and the bot commits to it daily. | L | S | Update or archive. Remove stale `dev/*` branches after confirming they are merged. |

### 2g. Growth and monetisation (brief)

| ID | Title | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|
| GRO-1 | "Telemetry" is single-device `localStorage`, not real analytics | `app.js:4679-4700, 4804`: traffic, bookie clicks and enquiries are written to `localStorage` only. The owner dashboard therefore shows only the owner's own browser. | M | S | Add privacy-friendly aggregate analytics (cookieless, no PII) and tell users in the privacy notice. Until then, label the page "this device only". |
| GRO-2 | No monetisation path is live | See CMP-8: links carry no affiliate ID. | M | S | Apply to operator affiliate programmes, add IDs, keep disclosure adjacent. |
| GRO-3 | Invite loop exists but is hidden | Leagues use 8-char invite codes and a share modal (`index.html:784-804`). | L | S | Put "Invite friends" on the post-sign-in screen and the weekly recap card. |

---

## 3. Merged plan

Ranked by impact over effort within each phase. "Verify" says how we will know it is done.

### Phase 0: must-fix (compliance and trust)

| # | Item | Touches | Depends on | Verify |
|---|---|---|---|---|
| 0.1 | CMP-4 age confirmation | `index.html`, `app.js`, `firestore.rules` (optional field), tests | none | Manual: fresh profile sees the gate; bookmaker links and league join blocked until confirmed. New JS test. |
| 0.2 | CMP-5 "Play safe" page plus GAMSTOP/helpline | `index.html`, `app.js`, `styles.css` | none | Manual: reachable from footer, builder and diary. |
| 0.3 | CMP-7 + CMP-6 copy and flow: drop "value/edge" for provisional markets, rename labels, reframe target-return builder | `app.js` (`:1153, :1375, :1555-1560, :1755, :4792`), `tests/test_regression_strings.js` | none | `test_regression_strings` asserts banned phrases are absent. Manual walk-through. Someone with UK gambling-advertising knowledge should read the final copy. |
| 0.4 | CMP-2 + CMP-3 privacy notice rewrite and Terms | `index.html` | decide analytics approach (GRO-1) | Manual review against what the app actually stores. |
| 0.5 | CMP-1 account deletion | `functions/index.js`, `firestore.rules`, `app.js`, rules tests | 0.4 for wording | Rules/function tests with the emulator; manual delete of a test account leaves no `users`, `handles` or membership docs. |
| 0.6 | SEC-1 restrict profile reads / move location | `firestore.rules`, `app.js`, `functions/` (ladder builder), `tests/rules` | none | Rules tests: another user cannot read `town/region/country`. Ladders still render. |
| 0.7 | COR-1 BTTS sample-size bug | `pipeline/recommend.py`, `tests/test_pipeline.py` | none | New unit test fails before the fix and passes after. |

### Phase 1: quick wins (under a day each)

| # | Item | Touches | Depends on | Verify |
|---|---|---|---|---|
| 1.1 | COR-2 fix cron or comment, check Odds API budget | `.github/workflows/matchiq-refresh.yml` | none | Odds credit counter in `data/odds.json` stays under 400 at month end. |
| 1.2 | CODE-3 single build ID stamped everywhere | `build_public_dist.py`, `sw.js`, `index.html`, `manifest.json`, `app.js`, new test | none | Test fails when any of the four disagree. |
| 1.3 | CODE-6 PR test workflow | new `.github/workflows/tests.yml` | none | Opening a PR runs both suites. |
| 1.4 | UX-3 remove no-store meta tags | `index.html` | 1.2 (so updates still reach users) | Repeat visit uses cache; new deploy still picked up. |
| 1.5 | PERF-3 and PERF-4 image and fonts | `assets/`, `sw.js`, `index.html`, `styles.css` | none | Lighthouse LCP before/after. |
| 1.6 | COR-3 per-selection price age in UI | `app.js` | none | Stale-price test in `tests/test_odds_feed.js`. |
| 1.7 | COR-6 LeoVegas fallback, COR-7 stale-sync indicator | `app.js` | none | Manual: LeoVegas opens LeoVegas; sync failure shows a notice. |
| 1.8 | CMP-8 affiliate wording (or real links) | `app.js:5043`, `index.html:728` | business decision | Copy matches reality. |
| 1.9 | SEC-3 key restrictions, App Check; SEC-6 review admin scripts | GCP console, `scripts/` | owner access | Console screenshot; script review notes. |
| 1.10 | CODE-1, CODE-7, CODE-8 cleanup | `scripts/`, root `requirements.txt`, handover doc, stale branches | none | `git ls-files` shrinks; CI still green. |

### Phase 2: bigger improvements

| # | Item | Touches | Depends on | Verify |
|---|---|---|---|---|
| 2.1 | PERF-1 ETag revalidation, split history, cheap sync | `app.js`, `pipeline/public.py`, `build_public_dist.py` | 1.2 | Network panel: repeat load transfers under 200 KB. |
| 2.2 | CODE-4 + CODE-5 stop committing `public-dist/`, one canonical host | `pages.yml`, `matchiq-refresh.yml`, README | decide host | Pages deploy builds from source; commit diffs shrink. |
| 2.3 | CODE-2 de-duplicate `app.js` | `app.js`, tests | 1.3 (tests gating) | All JS suites still pass; line count drops. |
| 2.4 | COR-4 band recalibration, COR-5 single settlement source | `pipeline/recommend.py`, `pipeline/history.py`, `app.js` | more settled data | Brier/reliability report improves on the next 100 matches; no client-side re-settling. |
| 2.5 | UX-4 retention: notifications, follow-a-team, weekly recap card | `sw.js`, `app.js`, `functions/` (if web push) | 0.1 to 0.5 (do not grow before compliance) | Opt-in rate; day-7 return rate. |
| 2.6 | UX-2 accessibility pass | `index.html`, `app.js`, `styles.css` | none | Lighthouse a11y score at least 90; axe has zero critical issues. |
| 2.7 | GRO-1 real aggregate analytics | `app.js`, privacy notice | 0.4 | Dashboard shows multi-device numbers. |
| 2.8 | SEC-4 CSP (meta) first pass | `index.html` | 2.3 | Console shows no CSP violations on core flows. |

### Phase 3: nice-to-haves / later

| Item | Notes |
|---|---|
| UX-1 consolidate navigation to about 4 tabs | Needs usability testing first. |
| PERF-2 build step, minify, route-level splitting | Falls out of 2.3 and 2.8. |
| SEC-2 App Check plus callable league creation with caps | After the user base grows. |
| SEC-5 Firebase SDK upgrade or vendoring; SEC-7 escaping lint | Pair with the CSP work. |
| GRO-2 affiliate programmes; GRO-3 invite loop | After Phase 0 is done and legal wording is signed off. |
| CMP-9 app-store packaging review | Only if you pursue Play/App Store. |

---

## 4. Top 5 things to do first

1. **Age confirmation plus a real "Play safe" page** (0.1, 0.2): small effort, closes the biggest compliance gap.
2. **Rewrite value/edge/target-return copy** (0.3): the app's own evidence says there is no proven edge on most markets, but the UI sometimes says "value bet … % edge".
3. **Privacy notice, Terms and account deletion** (0.4, 0.5): the notice is currently inaccurate and there is no erasure path for cloud data.
4. **Restrict profile reads and move location** (0.6): cheap rules change that stops any signed-in user reading everyone's town/country.
5. **Fix the BTTS bug and the cron/comment mismatch** (0.7, 1.1), then **add PR-gating tests** (1.3) so the rest can proceed safely.

## 5. Risks and open questions for you

- **Are Bet Buddy's UK affiliate/advertising plans live or planned?** That decides how strict the copy review (0.3, CMP-8, CMP-9) must be before launch. I'd get a UK gambling-compliance reviewer to read the final wording; I'm not one.
- **Which host is canonical: GitHub Pages or Vercel?** The Cloud Function depends on `headpark23.github.io`, so moving hosts means changing `DATA_BASE`.
- **Is the "Buddy Leagues" feature meant to involve money or prizes?** The rules treat it as points-only; if prizes are planned, gambling-licensing questions change.
- **Do you want to keep the other sports and leagues?** `multi_sport_events.json` and the non-PL leagues widen the compliance and data-rights surface (see `pipeline/rights.py`).
- **Account deletion needs the Blaze/Functions deploy path**; confirm it is in use for `betbuddyuk`.
- **Rule changes can lock out existing users** (SEC-1): ship with emulator tests and a staged rollout.
- `DRAFT-DATA-EMAILS.md` is untracked in the repo root; I did not read or touch it.

## 6. What I could not verify

- **Runtime behaviour.** I did not run the app in a browser, so UX, mobile layout, onboarding flow and the LeoVegas fallback (COR-6) are inferred from code, not observed. Existing PNG screenshots in the repo root were not reviewed.
- **Most of `app.js`.** I read targeted regions (data loading, bookmaker launch, telemetry, owner gating, copy strings), not all 7,143 lines. Escaping (SEC-7) is spot-checked only.
- **Cloud console state.** Whether the Firebase API key is restricted, App Check is on, Firestore rules deployed match the repo, or the function is deployed and healthy.
- **Rules behaviour.** I read `firestore.rules` but did not run the emulator tests (they need Java and a Firebase emulator). The 131 Python tests and 19 JS suites did pass locally.
- **Model quality beyond the repo's own reports.** I did not re-run the backtests in `experiments/`; calibration comments (COR-4) come from `data/model_reliability.json`.
- **Workflows `forward*.yml`, `winner-forward.yml`, `settlement-tests.yml`, `live-integration-check.yml` and the `scripts/` contents** were only skimmed or listed.
- **Legal conclusions.** Compliance items are engineering/product risk flags based on common UK practice, not legal advice.
