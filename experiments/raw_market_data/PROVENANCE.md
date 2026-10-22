# Data Provenance: Premier League Market Odds Datasets

**Acquisition Date:** 2026-10-22  
**Purpose:** MatchIQ Research Mission AG-036 (Authentic Market Data Acquisition & Leakage-Free Benchmark)  
**Budget Cost:** £0.00 (Zero paid APIs, subscriptions, or trial cards)  
**Status:** Strictly isolated under `experiments/raw_market_data/`. Never modifies `data/matches.json`.

---

## 1. Season 2025/2026 Dataset
- **Repository:** `minmaxxxer/premier-league-closing-odds-2025-26`
- **Source URL:** `https://huggingface.co/datasets/minmaxxxer/premier-league-closing-odds-2025-26`
- **File:** `premier_league_2025_26_closing_odds.csv`
- **License:** Creative Commons Attribution 4.0 International (`CC-BY-4.0`)
- **Git Commit SHA:** `9ec66f57e893cbc307f7902670578ef21a078843`
- **File Size:** 94,782 bytes
- **SHA-256 Checksum:** `14383dd1da3983efeb4f279de5b60df14dae61611d7fa176e96cbf1568464cdd`
- **Coverage:** All 380 matches of the 2025–26 Premier League season.
- **Markets Captured:** 
  - 1X2 Match Winner (`open_home_prob`, `close_home_prob`, etc.)
  - Over/Under 2.5 Goals (`open_over25_prob`, `close_over25_prob`, etc.)
  - Both Teams to Score (`open_btts_prob`, `close_btts_prob`, etc.)
  - Asian Handicap (`open_ah_line_home`, `close_ah_line_home`, etc.)
- **Underlying Source:** Aggregated consensus from a median of 25 bookmaker brands via Flashscore.

---

## 2. Season 2026/2027 Dataset
- **Repository:** `minmaxxxer/premier-league-odds-2026-27`
- **Source URL:** `https://huggingface.co/datasets/minmaxxxer/premier-league-odds-2026-27`
- **File:** `premier_league_2026_27_odds.csv`
- **License:** Creative Commons Attribution 4.0 International (`CC-BY-4.0`)
- **Git Commit SHA:** `f2526e0eef7b5ee752bb04cbb6cbf3174ae53d10`
- **File Size:** 17,613 bytes
- **SHA-256 Checksum:** `7f8c75b8b470ef583059ec5422e5f331197e2d230a52e2b7314922c345df304d`
- **Coverage:** 69 matches played through 2026-10-19.
- **Markets Captured:** Identical 41-column schema to Season 2025/2026.

---

## 3. Network & Security Compliance
- Direct HTTPS request with default TLS verification (standard Python `urllib` / `requests`).
- No WebTitan proxy interception occurred (HuggingFace CDN endpoints are categorized as Education/Technology, not Gambling).
- No proxies, VPNs, or TLS circumvention tools were used.
