# Task Plan: MatchIQ Mission AG-037B — Mobile Installation & Partner Sharing

## Mission Objective
Prepare the verified MatchIQ weekend pilot for installation and sharing on two mobile phones (Android and iPhone).
Enable Progressive Web App (PWA) installation with standalone home screen support, icons, splash styling, and offline shell caching.
Investigate Vercel hosting at £0 additional cost and generate an ephemeral public HTTPS preview link without modifying production DNS or merging to main.
Preserve private client-side Bet Diary separation (localStorage), all authenticated fixtures (Matchweek 8, 23–25 October 2026), and verified predictions.
Strictly ensure no sensitive research files, credentials, or development data are exposed.
External spending: £0.00.

---

## Phases & Milestones

### Phase 1: PWA Manifest & App Icons
- [x] Create `assets/icon-192.png`, `assets/icon-512.png`, `assets/apple-touch-icon.png`, and `assets/favicon-32.png` with modern dark stadium aesthetics and emerald/cyan branding.
- [x] Create `manifest.json` conforming to W3C Web App Manifest specification with standalone display, dark theme, and maskable icons.
- [x] Add mobile PWA `<meta>` and `<link>` tags to `<head>` of `index.html` (Apple Web App Capable, Status Bar, Title, Theme Color).

### Phase 2: Offline Service Worker (`sw.js`)
- [x] Implement robust Service Worker with cache versioning.
- [x] Cache app shell assets (`index.html`, `manifest.json`, `market_calculations.js`, icons, hero image).
- [x] Network-first with cache fallback strategy for `data/*.json` to ensure freshness with offline resilience.
- [x] Register Service Worker in `index.html`.

### Phase 3: Partner Privacy & Data Isolation Audit
- [x] Verify that Bet Diary and Feedback remain client-side in `localStorage` (`matchiq_bet_diary_v1` and `matchiq_ux_feedback_v1`).
- [x] Confirm each phone maintains its own independent diary and stakes with zero cross-contamination.
- [x] Verify both users receive identical authenticated fixtures and pre-kickoff predictions from static `data/*.json`.

### Phase 4: Public Security & Sensitivity Audit (`.vercelignore`)
- [x] Create `.vercelignore` to strictly prevent public exposure of:
  - `experiments/` (research notebooks, candidate models, raw market datasets, audit evidence).
  - `tests/` (unit test suites and mock data).
  - `.venv/` and Python bytecode (`*.py`, `*.pyc`).
  - `.git/` repository internals.
  - Temporary and diagnostic logs.
- [x] Run dry-run deployment inspection (`vercel deploy --dry`) to verify that ONLY public frontend assets are bundled.

### Phase 5: Hosting & HTTPS Preview Link Generation
- [x] Investigate Vercel deployment options at £0 additional cost.
- [x] Deploy preview candidate using Vercel ephemeral temporary deployment (`vercel deploy --temporary`) or local tunnel.
- [x] Verify public HTTPS accessibility and SSL certificate validity.
- [x] Retain strict release boundary: No production DNS modification or merging without explicit approval.

### Phase 6: Multi-Device Browser QA & Installation Testing
- [x] Test PWA manifest validation and service worker registration in browser.
- [x] Test mobile viewport (iPhone 15: 390x844, Android: 412x915).
- [x] Verify Bet Diary creation, settlement, and persistence on mobile viewport.
- [x] Document exact step-by-step installation instructions for iPhone (Safari) and Android (Chrome).

### Phase 7: Delivery & Sign-Off Report
- [x] Compile final delivery report with preview URL, installation guides, security confirmation, and GO/NO-GO verdict.
