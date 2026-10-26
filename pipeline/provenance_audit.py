"""Provenance audit: which public prediction inputs come from football-data.co.uk.

Static part: the dependency table below (reviewed against pipeline/run.py, models.py,
leagues.py). Live part (needs FOOTBALL_DATA_ORG_TOKEN, 18 free requests): fetch three past
seasons of final scores per league from the permitted football-data.org API and compare
them with the stored co.uk rows. Where scores agree, the score-based markets can be
retrained from the permitted source with identical inputs; this script reports the parity
and never retrains or replaces a model.
Output: data/provenance_audit.json (no credentials, no raw rows).
"""
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

from .data import load_co_uk
from .leagues import LEAGUES, load_results
from .sources import fetch_football_data_org

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "provenance_audit.json"
SEASONS = (2023, 2024, 2025)

DEPENDENCIES = {
    "result": {"inputs": "final scores and dates of past matches", "restricted_source_rows": True,
               "public": "yes, provisional: scores are facts also supplied by football-data.org; parity measured below"},
    "goals": {"inputs": "final scores (goals for and against) plus league goal rate", "restricted_source_rows": True,
              "public": "yes, provisional: same score-only inputs as result"},
    "btts": {"inputs": "final scores plus league both-teams-scored rate", "restricted_source_rows": True,
             "public": "yes, provisional: same score-only inputs as result"},
    "corners": {"inputs": "corner counts per match (football-data.co.uk statistics only)", "restricted_source_rows": True,
                "public": "NO: research-only, no permitted source of corner counts"},
    "cards": {"inputs": "yellow-card counts per match (football-data.co.uk statistics only)", "restricted_source_rows": True,
              "public": "NO: research-only, no permitted source of card counts"},
    "shots": {"inputs": "shots-on-target counts per match (football-data.co.uk statistics only)", "restricted_source_rows": True,
              "public": "NO: research-only, no permitted source of shot counts"},
}


def stored_scores():
    rows = {}
    for r in load_co_uk(ROOT / "data" / "matches.json"):
        rows[("PL", r["season"], r["home"], r["away"])] = (r["hg"], r["ag"])
    for r in load_results():
        rows[(r["competition"], r["season"], r["home"], r["away"])] = (r["hg"], r["ag"])
    return rows


def parity(stored, fetch=fetch_football_data_org, sleep=7):
    out = {}
    for code in LEAGUES:
        for start in SEASONS:
            label = f"{start % 100:02d}{(start + 1) % 100:02d}"
            matches, error = fetch(code, start, label)
            time.sleep(sleep)
            theirs = {(code, label, m["home"], m["away"]): tuple(m["score"]) for m in matches if m["score"]}
            ours = {k: v for k, v in stored.items() if k[0] == code and k[1] == label}
            both = set(ours) & set(theirs)
            out[f"{code}:{label}"] = {"permitted_source_finished": len(theirs), "stored_research_rows": len(ours), "compared": len(both),
                                      "scores_equal": sum(ours[k] == theirs[k] for k in both),
                                      "only_in_permitted": len(set(theirs) - set(ours)), "only_in_research": len(set(ours) - set(theirs)),
                                      "error": error}
    return out


def main():
    report = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "dependencies": DEPENDENCIES}
    if os.environ.get("FOOTBALL_DATA_ORG_TOKEN"):
        report["score_parity"] = parity(stored_scores())
        tot = report["score_parity"].values()
        c, e = sum(v["compared"] for v in tot), sum(v["scores_equal"] for v in tot)
        report["score_parity_summary"] = {"compared": c, "equal": e, "agreement": round(e / c, 5) if c else None}
    else:
        report["score_parity"] = "skipped: token not set"
    OUT.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(report.get("score_parity_summary", report["score_parity"])))


if __name__ == "__main__":
    sys.exit(main())
