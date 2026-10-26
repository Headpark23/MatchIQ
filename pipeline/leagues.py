"""Competition registry and results for the five leagues added after the Premier League.

Results and match statistics (corners, yellow cards, shots on target) come from
football-data.co.uk (personal/research use, the same source already used for the Premier
League). `python -m pipeline.leagues --build` downloads the last seasons into
data/league_results.json; every pipeline run refreshes the current season on top of that
and keeps the stored copy when the download fails. Nothing here is used for the Premier
League, whose frozen models are untouched.
"""
import csv
import datetime as dt
import io
import json
import sys
import urllib.request
from pathlib import Path

from .teams import canonical_for

ROOT = Path(__file__).resolve().parents[1]
RESULTS_PATH = ROOT / "data" / "league_results.json"
STAT_KEYS = ("HC", "AC", "HY", "AY", "HST", "AST", "HS", "AS")
BUILD_SEASONS = ("2324", "2425", "2526", "2627")

LEAGUES = {
    "PL": {"name": "Premier League", "short": "PL", "co_uk": "E0", "openfootball": "en.1", "odds_sport": "soccer_epl"},
    "ELC": {"name": "Championship", "short": "ELC", "co_uk": "E1", "openfootball": "en.2", "odds_sport": "soccer_efl_champ"},
    "BL1": {"name": "Bundesliga", "short": "BL1", "co_uk": "D1", "openfootball": "de.1", "openligadb": "bl1", "odds_sport": "soccer_germany_bundesliga"},
    "PD": {"name": "La Liga", "short": "PD", "co_uk": "SP1", "openfootball": "es.1", "odds_sport": "soccer_spain_la_liga"},
    "SA": {"name": "Serie A", "short": "SA", "co_uk": "I1", "openfootball": "it.1", "odds_sport": "soccer_italy_serie_a"},
    "FL1": {"name": "Ligue 1", "short": "FL1", "co_uk": "F1", "openfootball": "fr.1", "odds_sport": "soccer_france_ligue_one"},
}
EXTRA = [c for c in LEAGUES if c != "PL"]


def parse_csv(text, competition, season):
    rows = []
    for r in csv.DictReader(io.StringIO(text.lstrip("﻿"))):
        try:
            day = dt.datetime.strptime(r["Date"], "%d/%m/%Y" if len(r["Date"]) == 10 else "%d/%m/%y").date()
            hg, ag = int(r["FTHG"]), int(r["FTAG"])
        except (KeyError, TypeError, ValueError):
            continue
        stats = {}
        for key in STAT_KEYS:
            try:
                stats[key] = float(r[key]) if r.get(key) not in (None, "") else None
            except ValueError:
                stats[key] = None
        rows.append({"competition": competition, "season": season, "date": day, "home": canonical_for(competition, r["HomeTeam"]),
                     "away": canonical_for(competition, r["AwayTeam"]), "hg": hg, "ag": ag, "stats": stats, "source": "football-data.co.uk"})
    seen = {}
    for r in rows:
        k = (r["date"], r["home"], r["away"])
        seen[k] = seen.get(k, 0) + 1
    return [r for r in rows if seen[(r["date"], r["home"], r["away"])] == 1]


def fetch_csv(competition, season, opener=None):
    url = f"https://www.football-data.co.uk/mmz4281/{season}/{LEAGUES[competition]['co_uk']}.csv"
    opener = opener or urllib.request.urlopen
    request = urllib.request.Request(url, headers={"User-Agent": "MatchIQ/1.0 (research)"})
    with opener(request, timeout=30) as response:
        return response.read().decode("utf-8-sig", errors="replace")


def _dump(rows):
    return [{"c": r["competition"], "s": r["season"], "d": r["date"].isoformat(), "h": r["home"], "a": r["away"], "hg": r["hg"], "ag": r["ag"],
             "st": {k: v for k, v in r["stats"].items() if v is not None}} for r in rows]


def _load(items):
    return [{"competition": i["c"], "season": i["s"], "date": dt.date.fromisoformat(i["d"]), "home": i["h"], "away": i["a"],
             "hg": i["hg"], "ag": i["ag"], "stats": {k: i["st"].get(k) for k in STAT_KEYS}, "source": "football-data.co.uk"} for i in items]


def load_results(path=RESULTS_PATH):
    try:
        return _load(json.loads(Path(path).read_text(encoding="utf-8"))["results"])
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return []


def refresh_current(stored, season, opener=None):
    """Replace the stored current-season rows with a fresh download. Returns (rows, status)."""
    status = {}
    out = [r for r in stored if r["season"] != season]
    for code in EXTRA:
        old = [r for r in stored if r["season"] == season and r["competition"] == code]
        try:
            fresh = parse_csv(fetch_csv(code, season, opener), code, season)
            if len(fresh) < len(old):
                raise ValueError("download has fewer matches than the stored copy")
            out += fresh
            status[code] = {"ok": True, "results": len(fresh), "latest_result": max((r["date"] for r in fresh), default=None)}
        except Exception as error:  # network or format problem: keep what we have
            out += old
            status[code] = {"ok": False, "results": len(old), "note": f"kept stored copy ({type(error).__name__}: {error})",
                            "latest_result": max((r["date"] for r in old), default=None)}
        if status[code]["latest_result"]:
            status[code]["latest_result"] = status[code]["latest_result"].isoformat()
    return out, status


def promoted_by_season(rows, competition, fixtures=()):
    """Clubs in a season of this league that were absent from the previous season's table."""
    members = {}
    for r in rows:
        if r["competition"] == competition:
            members.setdefault(r["season"], set()).update((r["home"], r["away"]))
    for f in fixtures:
        if f["competition"] == competition:
            members.setdefault(f["season"], set()).update((f["home"], f["away"]))
    out = {}
    for season in sorted(members):
        previous = f"{int(season[:2]) - 1:02d}{int(season[:2]):02d}"
        if previous in members:
            out[season] = members[season] - members[previous]
    return out


def build(seasons=BUILD_SEASONS):
    rows = []
    for code in EXTRA:
        for season in seasons:
            rows += parse_csv(fetch_csv(code, season), code, season)
            print(code, season, len(rows), file=sys.stderr)
    rows.sort(key=lambda r: (r["competition"], r["date"], r["home"]))
    RESULTS_PATH.write_text(json.dumps({"source": "football-data.co.uk (personal/research use)", "results": _dump(rows)},
                                       separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if "--build" in sys.argv:
        build()
