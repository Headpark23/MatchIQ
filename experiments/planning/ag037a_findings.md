# Findings: Mission AG-037A — Emergency Weekend Fixture & Prediction Integrity Repair

## 1. Discrepancy Analysis: What Went Wrong in AG-037

During AG-037, the fixture schedule loaded for Matchweek 8 consisted of:
- Everton v Fulham
- Arsenal v Chelsea
- Liverpool v Leeds
- Man City v Brighton
- Aston Villa v Brentford
- Crystal Palace v Coventry
- Newcastle v Ipswich
- Nott'm Forest v Bournemouth
- Man United v Hull
- Tottenham v Sunderland

### Root Cause
These fixtures were synthesized from earlier hypothetical test pairings rather than cross-referenced against the official Premier League calendar. Specifically:
- Arsenal was paired with Chelsea instead of Everton.
- Aston Villa was paired with Brentford instead of Man City.
- Chelsea was paired with Tottenham (on Saturday 17:30 BST, which is real, but Arsenal v Chelsea was also present in the incorrect list!).
- Crystal Palace was paired with Coventry instead of Newcastle.
- Coventry was playing Crystal Palace away instead of Fulham at home.
- Ipswich was away to Newcastle instead of hosting Nottingham Forest on Friday night.
- The Friday night kickoff (Ipswich v Nott'm Forest, 23 Oct 20:00 BST) was completely missing!

## 2. Authenticated Schedule for Matchweek 8 (23–25 October 2026)

Verified across official Premier League sources and independent sports feeds:
1. **Friday 23 October 2026**:
   - `Ipswich v Nott'm Forest` (Portman Road, 20:00 BST / 19:00 UTC)
2. **Saturday 24 October 2026**:
   - `Aston Villa v Man City` (Villa Park, 12:30 BST / 11:30 UTC)
   - `Arsenal v Everton` (Emirates Stadium, 15:00 BST / 14:00 UTC)
   - `Coventry v Fulham` (Coventry Building Society Arena, 15:00 BST / 14:00 UTC)
   - `Chelsea v Tottenham` (Stamford Bridge, 17:30 BST / 16:30 UTC)
3. **Sunday 25 October 2026** (Clocks fall back at 01:00 UTC from BST to GMT):
   - `Crystal Palace v Newcastle` (Selhurst Park, 14:00 GMT / 14:00 UTC)
   - `Hull v Brentford` (MKM Stadium, 14:00 GMT / 14:00 UTC)
   - `Liverpool v Brighton` (Anfield, 14:00 GMT / 14:00 UTC)
   - `Man United v Bournemouth` (Old Trafford, 14:00 GMT / 14:00 UTC)
   - `Sunderland v Leeds` (Stadium of Light, 16:30 GMT / 16:30 UTC)

## 3. Historical Ledgers & Preservation
- Baseline historical settled records: 7 matches in both `data/match_winner_forward.json` and `data/forward_test.json` (Matchweek 7, 17–18 October 2026).
- The 8 pending records appended during AG-037 must be quarantined into `experiments/audit_evidence/ag037_quarantine/` alongside the incorrect `matches.json`.
- The 7 historical settled records remain 100% intact, immutable, and untouched.

## 4. Market Consensus Odds Policy
- Since Matchweek 8 has not taken place yet, closing odds datasets do not contain this matchweek.
- Hardcoded estimate odds in `index.html` violated the strict directive: "No fabricated bookmaker odds. Verify that any market odds are authentic, correctly matched and available at the relevant time. Otherwise mark them unavailable."
- Action: Completely remove fabricated odds. Mark market consensus as unavailable in the display cards until authenticated pre-match feeds exist.
