# Task Plan: MatchIQ Mission AG-037C — Secure Mobile Deployment & Permanent Shareable Link

## Mission Objective
Publish the completed MatchIQ Weekend Pilot as a secure, installable mobile web app accessible to the owner and their partner.
Use Vercel at £0 additional cost, or provide the exact authentication step if authorization is required.
Build an isolated public distribution directory (`public-dist/`) using an explicit allowlist.
Exclude all internal research, development tools, Python scripts, Git data, tests, private ledgers, and local environment files.
Ensure service worker cannot serve stale fixture data or touch private diary data.
Verify mobile PWA installation, multi-device diary separation, and security isolation.
External spending: £0.00.

---

## Phases & Milestones

### Phase 1: Deployment Preflight
- [x] Inspect existing GitHub configuration and remote repository state.
- [x] Inspect local and global Vercel configuration; confirm £0 free tier allowance.
- [x] Audit repository for credentials, private API keys, or sensitive secrets (verify 0 secrets).
- [x] Verify that authentic Matchweek 8 fixtures (23–25 Oct 2026) and approved predictions are loaded.

### Phase 2: Secure Public Build (`public-dist/`)
- [x] Create automated build script `build_public_dist.py` that populates `public-dist/` using a strict allowlist.
- [x] Allowlist files:
  - `index.html`
  - `market_calculations.js`
  - `manifest.json`
  - `sw.js` (with network-first no-cache data strategy)
  - `vercel.json` (with security headers & MIME types)
  - `assets/` (`icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon-32.png`, `stadium_hero.jpg`)
  - `data/` (`matches.json`, `match_winner_forward.json`, `forward_test.json`)
- [x] Exclude all internal research (`experiments/`), tests (`tests/`), models (`*.py`), Git (`.git/`), and virtual environments (`.venv/`).
- [x] Verify security isolation: ensure sensitive paths return 404/denied.

### Phase 3: Vercel Deployment & Permanent Preview Link
- [x] Test Vercel CLI deployment against `public-dist/`.
- [x] If Vercel CLI requires user authentication (`vercel login`), document the exact single-step action for the owner.
- [x] Deploy isolated `public-dist/` to an active preview environment.
- [x] Provide active, tested HTTPS preview link for immediate sharing with partner.
- [x] Verify strict release boundary: No merge to `main`, no changes to production DNS.

### Phase 4: Multi-Device Mobile Verification
- [x] Test deployed URL in desktop and mobile viewports (iPhone 15: 390x844, Android: 412x915).
- [x] Verify Friday night opening match (`Ipswich v Nott'm Forest`) and all 10 weekend fixtures.
- [x] Verify Bet Diary creation, status settlement, and persistence on mobile.
- [x] Verify that Bet Diary data is stored strictly in client-side `localStorage` with complete device separation.
- [x] Test JSON and CSV export functionality on mobile.
- [x] Test PWA installation eligibility (valid manifest and active service worker).

### Phase 5: Final Delivery & Documentation
- [x] Provide verified HTTPS website link.
- [x] Provide step-by-step installation guides for iPhone (Safari) and Android (Chrome).
- [x] Provide security audit results and £0 budget confirmation.
- [x] Capture verified QA screenshots.
- [x] State clear instructions if any one-time Vercel login action is required.
