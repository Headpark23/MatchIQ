# Findings: Mission AG-037B — Mobile Installation & Partner Sharing

## 1. Hosting & Vercel Feasibility Investigation
- **Vercel CLI Status:** Vercel CLI version 65.1.0 is available locally via `npx vercel`.
- **Authentication Status:** Local CLI is logged out. However, Vercel CLI supports `vercel deploy --temporary`, which creates an ephemeral preview deployment without credentials at £0 additional cost.
- **Alternative/Local Preview Options:** Cloudflare tunnel (`cloudflared`) or ngrok/localtunnel could also provide HTTPS tunnels if needed, but Vercel preview deployment provides high performance global CDN caching and native SSL on `*.vercel.app`.
- **Security Prerequisite:** The repository contains internal Python models, experiment scripts (`calibration_research.py`, `dixon_coles_research.py`), raw market datasets in `experiments/raw_market_data/`, and test suites. A strict `.vercelignore` file must be used to exclude all directories except the public web app files.

## 2. PWA Specification & Mobile Installation Architecture
- **Web App Manifest (`manifest.json`):**
  - Name: `MatchIQ Pro — Football Intelligence`
  - Short Name: `MatchIQ`
  - Theme / Background Color: `#070b14` (Stadium Control Dark Mesh)
  - Display: `standalone` (removes browser URL bar and navigation buttons for native app feel)
  - Scope / Start URL: `./index.html`
- **Apple iOS PWA Support:**
  - Safari does not fully support Web App Manifest installation banners, but respects `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, and `<link rel="apple-touch-icon" href="...">`.
  - Manual action: Tap Share button -> "Add to Home Screen".
- **Android PWA Support:**
  - Chrome inspects `manifest.json` and active Service Worker.
  - Automatically offers "Add to Home Screen" or "Install App".
- **Service Worker (`sw.js`):**
  - Provides instant startup and offline fallback for app shell assets.

## 3. Privacy & Device Separation
- Bet Diary entries are saved in the browser's `localStorage` under `matchiq_bet_diary_v1`.
- UX Feedback is saved under `matchiq_ux_feedback_v1`.
- `localStorage` is completely sandboxed to the local device. When the owner and their partner both open the public URL on their respective phones, neither can see or overwrite the other's bets or notes.
- Both users receive identical, verified pre-match predictions and kickoff times from the static JSON data files.
