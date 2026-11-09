"""Training history for international competitions (leagues.PUBLIC_ONLY entries with "international").

Source: martj42/international_results (CC0 public domain), every men's international since
1872, updated after each international window. It holds results only, so fixtures and timely
results come from OpenLigaDB (see leagues.PUBLIC_ONLY["NLA"]).

The model for an international competition is fitted on every match since HISTORY_FROM that
involves at least one European national team, neutral venues and matches against other
confederations included. On a 2025-26 walk-forward (213 European home-venue matches) that set
scored a result Brier of 0.455 against 0.535-0.544 for Europe-only or home-venue-only sets and
0.640 for the average. Rows are labelled with the competition code so the per-league model in
pipeline/models.py fits them unchanged.

    python -m pipeline.public --history     # refreshes data/public_results_internationals.json too
"""
import csv
import datetime as dt
import io
import json
from pathlib import Path

from .leagues import PUBLIC_ONLY
from .sources import http_text
from .teams import canonical_for

ROOT = Path(__file__).resolve().parents[1]
HISTORY_PATH = ROOT / "data" / "public_results_internationals.json"
SOURCE = "international_results"
URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
HISTORY_FROM = dt.date(2021, 7, 1)
INTERNATIONAL = [code for code, meta in PUBLIC_ONLY.items() if meta.get("international")]
# UEFA member associations, spelled as in the dataset (Russia is suspended but its older results
# still rate its opponents).
UEFA = frozenset((
    "Albania", "Andorra", "Armenia", "Austria", "Azerbaijan", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria",
    "Croatia", "Cyprus", "Czech Republic", "Denmark", "England", "Estonia", "Faroe Islands", "Finland", "France", "Georgia",
    "Germany", "Gibraltar", "Greece", "Hungary", "Iceland", "Israel", "Italy", "Kazakhstan", "Kosovo", "Latvia",
    "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Montenegro", "Netherlands", "North Macedonia",
    "Northern Ireland", "Norway", "Poland", "Portugal", "Republic of Ireland", "Romania", "Russia", "San Marino", "Scotland",
    "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine", "Wales"))


def season_of(day):
    """International seasons run July to June, like the club seasons ("2627")."""
    start = day.year if day.month >= 7 else day.year - 1
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def parse(text, competition, since=HISTORY_FROM):
    rows = []
    for r in csv.DictReader(io.StringIO(text.lstrip("﻿"))):
        try:
            day = dt.date.fromisoformat(r["date"])
            hg, ag = int(r["home_score"]), int(r["away_score"])
        except (KeyError, TypeError, ValueError):
            continue  # unplayed fixture ("NA") or malformed row
        if day < since or not (r["home_team"] in UEFA or r["away_team"] in UEFA):
            continue
        rows.append({"c": competition, "s": season_of(day), "d": day.isoformat(), "h": canonical_for(competition, r["home_team"]),
                     "a": canonical_for(competition, r["away_team"]), "hg": hg, "ag": ag})
    return rows


def build_history(path=HISTORY_PATH, opener=None):
    text = http_text(URL, opener=opener, timeout=60)
    rows = [row for code in INTERNATIONAL for row in parse(text, code)]
    if len(rows) < 500:
        raise RuntimeError(f"international history looks truncated ({len(rows)} rows)")
    notes = {code: {"rows": sum(r["c"] == code for r in rows), "latest": max(r["d"] for r in rows if r["c"] == code)} for code in INTERNATIONAL}
    Path(path).write_text(json.dumps({"source": "martj42/international_results (CC0 public domain; final scores only)",
                                      "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "notes": notes, "results": rows},
                                     separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    return notes
