# AG-037 Quarantine Audit Evidence
Date: 2026-10-22
Reviewer: Rocky / MatchIQ Governance

## Quarantined Assets
1. matches_incorrect_ag037.json: Contained 10 incorrect fixture pairings:
   - Everton v Fulham (Incorrect: Everton plays Arsenal away)
   - Arsenal v Chelsea (Incorrect: Arsenal plays Everton at home; Chelsea plays Tottenham at home)
   - Liverpool v Leeds (Incorrect: Liverpool plays Brighton at home; Leeds plays Sunderland away)
   - Man City v Brighton (Incorrect: Man City plays Aston Villa away; Brighton plays Liverpool away)
   - Aston Villa v Brentford (Incorrect: Aston Villa plays Man City at home; Brentford plays Hull away)
   - Crystal Palace v Coventry (Incorrect: Crystal Palace plays Newcastle at home; Coventry plays Fulham at home)
   - Newcastle v Ipswich (Incorrect: Newcastle plays Crystal Palace away; Ipswich plays Nott Forest at home)
   - Nott'm Forest v Bournemouth (Incorrect: Nott Forest plays Ipswich away; Bournemouth plays Man United away)
   - Man United v Hull (Incorrect: Man United plays Bournemouth at home; Hull plays Brentford at home)
   - Tottenham v Sunderland (Incorrect: Tottenham plays Chelsea away; Sunderland plays Leeds at home)

2. match_winner_forward_incorrect_ag037.json:
   - 8 predictions generated against the incorrect fixture pairings above.

3. orward_test_incorrect_ag037.json:
   - 8 corner predictions generated against the incorrect fixture pairings above.

All quarantined files are preserved here for historical audit and model research records.
