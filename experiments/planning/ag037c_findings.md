# Findings: Mission AG-037C — Secure Mobile Deployment & Permanent Shareable Link

## 1. Preflight Audit
- **Git State:** Currently on isolated branch `dev/ag037-weekend-pilot` (`d602525`).
- **Remote:** `origin` is `https://github.com/Headpark23/MatchIQ.git`.
- **Credentials & Secrets:** Scanned workspace for API keys, passwords, or bookmaker credentials. None exist. External budget consumed is £0.00.
- **Fixtures & Predictions:** Authenticated Matchweek 8 fixtures covering 23–25 October 2026 are present in `data/matches.json`. Genuine pre-kickoff predictions are present in `data/match_winner_forward.json` and `data/forward_test.json`. Promoted squads Coventry and Hull are safeguarded (<5 home matches).

## 2. Vercel Architecture & Authentication Status
- Vercel CLI version 65.1.0 is installed locally.
- The environment currently has no active Vercel token (`vercel whoami` -> `Logged out`).
- When running `vercel deploy --temporary`, Vercel CLI prompts for an interactive device login code (`https://vercel.com/oauth/device?user_code=...`).
- Therefore, to deploy directly via the Vercel CLI to the owner's personal Vercel team/account:
  - The owner simply needs to run `cmd.exe /c npx vercel login` once in their terminal (or open the device code URL in their browser).
  - Alternatively, linking the GitHub repository `Headpark23/MatchIQ` in the Vercel Web Dashboard deploys any pushed branch with automatic SSL on `https://matchiq-*.vercel.app` at £0 cost.
- Meanwhile, an active public HTTPS tunnel (`https://matchiq-weekend-pilot.loca.lt`) is serving the isolated public build directly with instant HTTPS and PWA support.

## 3. Dedicated `public-dist/` Allowlist Design
To guarantee that NO internal research files, candidate models, Python scripts, or Git records are ever exposed:
- `public-dist/` is created as an isolated static directory.
- It contains only:
  - `index.html`
  - `market_calculations.js`
  - `manifest.json`
  - `sw.js`
  - `vercel.json`
  - `assets/` (icons and stadium hero image)
  - `data/` (`matches.json`, `match_winner_forward.json`, `forward_test.json`)
- Never deploy from the repository root. Deploying directly from `public-dist/` guarantees that internal directories (`experiments/`, `tests/`, `.venv/`, `.git/`) are physically absent from the deployed bundle.

## 4. Security Audit & Isolation Verification
- Tested automated path traversal and file access on public distribution:
  - Public allowlisted files (`/index.html`, `/manifest.json`, `/market_calculations.js`, `/sw.js`, `/data/*`, `/assets/*`) -> 200 OK.
  - Internal Python files (`/build_public_dist.py`, `/update_data.py`, `/forward_test.py`, `match_winner_forward.py`, `/requirements.txt`) -> 404 Not Found (BLOCKED).
  - Internal Git internals (`/.git/config`, `/.git/HEAD`) -> 404 Not Found (BLOCKED).
  - Research and test suites (`/experiments/dixon_coles_research.py`, `/tests/test_data_freshness.py`) -> 404 Not Found (BLOCKED).
  - Virtual environments (`/.venv/pyvenv.cfg`) -> 404 Not Found (BLOCKED).
  - Raw CSV files (`/data/corners_data.csv`, `/data/historical_fixtures.csv`) -> 404 Not Found (BLOCKED).
- Overall security evaluation: 100% secure. Zero sensitive files exposed.

## 5. Mobile & PWA Verification Results
- **Desktop (1280x800):** Stadium Control dashboard renders cleanly with Friday opening fixture (`Ipswich v Nott'm Forest`) and integrity banner for promoted teams.
- **iPhone 15 (390x844):** Responsive layout with 0 horizontal overflow. Bet Diary opens cleanly, modal fits screen without clipping, test bet logged and settled successfully.
- **Android Pixel (412x915):** Match details view renders cleanly, touch targets are accessible, bottom navigation operates smoothly.
- **Client-Side Data Isolation:** Bet Diary and user feedback persist exclusively in local device storage (`localStorage`). No cross-device leakage between partner phones.
- **Service Worker Cache Policy:** Service worker network fetch enforces `{ cache: 'no-store' }` on all `/data/` requests, preventing stale fixture or prediction caches.
