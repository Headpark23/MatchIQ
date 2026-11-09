"""Champions League, Europa League and Conference League: OpenLigaDB fixtures, CC0
openfootball/champions-league history, the shared (pooled) public model. No network, no
repository writes."""
import datetime as dt
import io
import json
import tempfile
import unittest
from pathlib import Path

from pipeline import european, public
from pipeline.league_validation import validate_league
from pipeline.leagues import PREDICTED, PUBLIC_ONLY
from pipeline.models import Context
from pipeline.run import default_extra_fetchers
from pipeline.sources import fetch_openfootball, fetch_openligadb
from pipeline.teams import LEAGUE_ALIASES, PREMIER_LEAGUE_ALIASES, UEFA_CLUBS, _display, canonical_for, known_club, match_id

HERE = Path(__file__).resolve().parent
OLG_TEAMS = json.loads((HERE / "openligadb_2026_27_uefa_teams.json").read_text(encoding="utf-8"))
CODES = ("CL", "EL", "ECL")

TXT = """= UEFA Champions League 2024/25

▪ League, Matchday 1
  Tue Sep 17 2024
    18:45  Juventus FC (ITA)       v PSV Eindhoven (NED)      3-1 (1-0)
           BSC Young Boys (SUI)    v Aston Villa FC (ENG)     0-3 (0-2)
    21:00  AS Monaco FC (MCO)      v FC Barcelona (ESP)       2-1
  Wed Sep 18
    21:00  PAE Olympiakos SFP (GRE) v FC Bayern München (GER)  [cancelled]

▪ Round of 16
  Tue Mar 11
    21:00  Liverpool FC (ENG)      v Paris Saint-Germain FC (FRA)  1-4 pen. 0-1 a.e.t. (0-1, 0-1)
           Club Brugge KV (BEL)    v Aston Villa FC (ENG)     1-2 a.e.t. (1-1, 0-0)
           Lazio Roma (ITA)        v Inter Club d'Escaldes (AND)  1-0 a.e.t. (0-0)
           Celtic FC (SCO)         v Galatasaray SK (TUR)     0-3    [awarded]
  Sat May 31
    21:00  Paris Saint-Germain FC (FRA) v FC Internazionale Milano (ITA)  v
"""


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def olg_match(home, away, when, ninety=None, extra=None):
    results = []
    if ninety:
        results.append({"resultTypeID": 2, "pointsTeam1": ninety[0], "pointsTeam2": ninety[1]})
    if extra:
        results.append({"resultTypeID": 4, "pointsTeam1": extra[0], "pointsTeam2": extra[1]})
    return {"matchDateTimeUTC": when, "team1": {"teamName": home}, "team2": {"teamName": away}, "matchIsFinished": ninety is not None,
            "matchResults": results, "lastUpdateDateTime": None}


def fixture(code, home, away, kickoff, score):
    return {"id": match_id(code, "2627", home, away), "competition": code, "season": "2627", "home": home, "away": away, "kickoff_utc": kickoff,
            "status": "FINISHED", "score": score, "result_source": "openligadb", "sources": ["openligadb"]}


class Registry(unittest.TestCase):
    def test_three_public_only_competitions_share_one_pool(self):
        for code in CODES:
            self.assertIn(code, PREDICTED)
            self.assertTrue(PUBLIC_ONLY[code]["european"])
            self.assertEqual(PUBLIC_ONLY[code]["pool"], CODES)
            self.assertEqual(PUBLIC_ONLY[code]["min_matches"], 3)
        self.assertEqual(european.EUROPEAN, list(CODES))

    def test_fetchers_are_openligadb_plus_football_data_org_for_the_champions_league(self):
        fetchers = default_extra_fetchers()
        self.assertEqual(set(fetchers["CL"]), {"openligadb", "football-data.org"})
        self.assertEqual(set(fetchers["EL"]), {"openligadb"})
        self.assertEqual(set(fetchers["ECL"]), {"openligadb"})
        ms, note = fetch_openfootball("CL", "2026-27", "2627", opener=lambda *a, **k: self.fail("network call"))
        self.assertEqual(ms, [])
        self.assertIn("not published", note)


class History(unittest.TestCase):
    def test_parse_keeps_ninety_minute_scores_and_skips_unclear_ones(self):
        rows = european.parse(TXT, "CL", 2024)
        got = [(r["d"], r["h"], r["a"], r["hg"], r["ag"]) for r in rows]
        self.assertEqual(got, [
            ("2024-09-17", "Juventus", "PSV", 3, 1),
            ("2024-09-17", "Bsc Young Boys", "Aston Villa", 0, 3),  # an unlisted club gets its cleaned name
            ("2024-09-17", "Monaco", "Barcelona", 2, 1),
            ("2025-03-11", "Liverpool", "Paris SG", 0, 1),  # 90 minutes, not the shoot-out
            ("2025-03-11", "Club Brugge", "Aston Villa", 1, 1),  # 90 minutes, not after extra time
        ])
        # cancelled, awarded, unplayed and an extra-time line without a clear 90-minute score are left out
        self.assertTrue(all(r["s"] == "2425" and r["c"] == "CL" and "q" not in r for r in rows))
        self.assertTrue(all(r["q"] == 1 for r in european.parse(TXT, "CL", 2024, qualifying=True)))

    def test_club_names(self):
        name = european.club_name
        self.assertEqual(name("Arsenal FC", "ENG"), "Arsenal")
        self.assertEqual(name("Lazio Roma", "ITA"), "Lazio")
        self.assertEqual(name("Sporting Braga", "POR"), "SC Braga")
        self.assertEqual(name("AS Monaco FC", "MCO"), "Monaco")
        self.assertEqual(name("PAE Olympiakos SFP", "GRE"), name("Olympiakos Piraeus", "GRE"))
        self.assertEqual(name("Qarabağ Ağdam FK", "AZE"), name("Qarabağ FK", "AZE"))
        # exact match only: different clubs that share words stay apart
        self.assertEqual(name("Inter Club d'Escaldes", "AND"), "Inter Escaldes")
        self.assertNotEqual(name("CSKA 1948 Sofia", "BUL"), "CSKA Sofia")
        self.assertNotEqual(name("Cercle Brugge", "BEL"), "Club Brugge")
        self.assertNotEqual(name("FK Žalgiris", "LTU"), "Kauno Zalgiris")

    def test_load_history_pools_every_match_into_all_three(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "h.json"
            items = european.parse(TXT, "EL", 2024) + european.parse(TXT, "ECL", 2024, qualifying=True)
            path.write_text(json.dumps({"results": items}), encoding="utf-8")
            rows = european.load_history(path)
        self.assertEqual(len(rows), 3 * len(items))
        for code in CODES:
            mine = [r for r in rows if r["competition"] == code]
            self.assertEqual(len(mine), len(items))
            self.assertEqual({r["origin"] for r in mine}, {"EL", "ECL"})
            self.assertEqual(sum(r["qualifying"] for r in mine), len(items) // 2)
        self.assertTrue(all(r["source"] in public.PERMITTED_RESULT_SOURCES for r in rows))


class Names(unittest.TestCase):
    def test_every_2026_27_league_phase_club_is_listed(self):
        for code, names in OLG_TEAMS.items():
            self.assertEqual(len(names), 36, code)
            missing = [n for n in names if not known_club(code, n)]
            self.assertEqual(missing, [], f"{code}: add these OpenLigaDB names to teams.UEFA_CLUBS")
            self.assertTrue(all(canonical_for(code, n) in UEFA_CLUBS for n in names))
        examples = {"FC Arsenal": "Arsenal", "Inter Mailand": "Inter", "FC Brügge": "Club Brugge", "Roter Stern Belgrad": "Red Star Belgrade",
                    "ZSKA Sofia": "CSKA Sofia", "SSC Napoli ": "Napoli", "Brighton & Hove Albion F.C.": "Brighton", "FK Bodö/Glimt": "Bodo/Glimt"}
        for raw, want in examples.items():
            self.assertEqual(canonical_for("CL", raw), want, raw)

    def test_clubs_from_covered_leagues_use_the_domestic_display_name(self):
        domestic = set(PREMIER_LEAGUE_ALIASES) | {_display(n) for code in ("ELC", "BL1", "PD", "SA", "FL1", "N1", "P1", "SC0") for n in LEAGUE_ALIASES[code]}
        covered = {"Arsenal", "Bayern Munich", "Atletico Madrid", "Inter", "Paris SG", "PSV", "Benfica", "Celtic", "Hearts", "SC Braga", "Lazio"}
        self.assertLessEqual(covered, set(UEFA_CLUBS))
        self.assertLessEqual(covered, domestic)
        for name in UEFA_CLUBS:
            self.assertEqual(canonical_for("CL", name), name)  # display names are stable

    def test_openligadb_uses_ninety_minutes_numbers_repeat_meetings_and_reports_unknown_names(self):
        payload = [olg_match("FC Arsenal", "Inter Mailand", "2026-09-16T19:00:00Z", (1, 1), (2, 1)),
                   olg_match("FC Arsenal", "Inter Mailand", "2027-02-17T20:00:00Z"),
                   olg_match("Atlético Nuevo", "FC Brügge", "2026-10-01T19:00:00Z")]
        opener = lambda request, timeout=20: Response(json.dumps(payload).encode())
        ms, note = fetch_openligadb("CL", 2026, "2627", opener=opener)
        self.assertEqual([(m["home"], m["away"], m["status"], m["score"], m.get("meeting")) for m in ms],
                         [("Arsenal", "Inter", "FINISHED", [1, 1], None), ("Arsenal", "Inter", "SCHEDULED", None, 2),
                          ("Atletico Nuevo", "Club Brugge", "SCHEDULED", None, None)])
        self.assertIn("Atlético Nuevo", note)


class PublicPath(unittest.TestCase):
    def test_a_current_season_result_trains_all_three_competitions(self):
        f = fixture("EL", "Lyon", "Celtic", "2026-10-01T19:00:00Z", [2, 0])
        rows = public.training_rows([], [f], "2627")
        self.assertEqual(sorted(r["competition"] for r in rows), sorted(CODES))
        self.assertTrue(all(r["origin"] == "EL" for r in rows))
        domestic = public.training_rows([], [fixture("N1", "Ajax", "PSV", "2026-10-01T19:00:00Z", [1, 0])], "2627")
        self.assertEqual([r["competition"] for r in domestic], ["N1"])

    def test_validation_scores_only_own_main_draw_matches_of_the_test_season(self):
        base = dict(stats={}, source=european.SOURCE, hg=1, ag=0)
        rows = []
        for i, (origin, qual, season, day) in enumerate([("CL", False, "2324", "2023-10-01"), ("CL", False, "2425", "2024-10-01"),
                                                         ("CL", True, "2425", "2024-07-20"), ("EL", False, "2425", "2024-10-02"),
                                                         ("CL", False, "2425", "2024-11-05")]):
            for code in CODES:
                rows.append({**base, "competition": code, "origin": origin, "qualifying": qual, "season": season,
                             "date": dt.date.fromisoformat(day), "home": f"H{i}", "away": f"A{i}"})
        v = validate_league("CL", rows, public=True)
        self.assertEqual((v["test_season"], v["test_season_label"], v["test_matches"]), ("2425", "2024-25", 2))
        self.assertEqual(validate_league("EL", rows, public=True)["test_matches"], 1)

    def test_lower_model_gate_and_wording(self):
        day = dt.date(2026, 1, 1)
        rows = [{"competition": "CL", "season": "2526", "date": day - dt.timedelta(days=200 - i), "home": f"T{i % 20}", "away": f"T{(i * 7 + 3) % 20}",
                 "hg": i % 3, "ag": (i // 3) % 2, "stats": {}, "source": "x"} for i in range(200) if i % 20 != (i * 7 + 3) % 20]
        rows += [{"competition": "CL", "season": "2526", "date": day - dt.timedelta(days=d), "home": "New", "away": "T1", "hg": 1, "ag": 1, "stats": {}, "source": "x"}
                 for d in (5, 6, 7)]
        meta = PREDICTED["CL"]
        gated = Context(rows, day, competition="CL", league_name=meta["context_name"], public=True, min_matches=meta["min_matches"],
                        model_note=meta["model_note"], full_weight_matches=meta["full_weight_matches"])
        res = gated.league_result({"home": "New", "away": "T2"})
        self.assertEqual(res["tier"], "L1")
        self.assertIn("since 2021-22", res["note"])
        # three matches: 30% model, 70% average
        self.assertEqual(res["model_weight"], 0.3)
        self.assertIn("30% model, 70% European average", res["note"])
        raw = [float(x) for x in gated.league_model.predict("New", "T2").home_draw_away]
        for got, m, b in zip(res["p"], raw, gated.base["result"]):
            self.assertAlmostEqual(got, 0.3 * m + 0.7 * b)
        self.assertAlmostEqual(sum(res["p"]), 1.0, places=6)
        self.assertNotIn("model_weight", gated.league_result({"home": "T1", "away": "T2"}))  # enough matches: the model alone
        self.assertEqual(Context(rows, day, competition="CL", public=True).league_result({"home": "New", "away": "T2"})["tier"], "T3")

    def test_evidence_wording(self):
        v = {"competition": "CL", "name": "Champions League", "test_season_label": "2024-25",
             "markets": {"result": {"n": 189, "model_brier": 0.551, "league_brier": 0.605, "strength": "moderate"}}}
        tiers = public.evidence_tiers(v)
        self.assertIn("189 Champions League main-draw matches (2024-25)", tiers["L1"]["summary"])
        self.assertIn("for the European average", tiers["L1"]["summary"])
        self.assertIn("a club new to European football", tiers["T3"]["summary"])
        self.assertIn("so this is the European average", tiers["T3"]["summary"])


if __name__ == "__main__":
    unittest.main()
