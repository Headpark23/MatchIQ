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
import os
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

# Schedule-only competitions: fixtures and confirmed scores are shown, but there is no results
# history, backtest or odds feed yet, so no predictions are produced (run.py and public.py skip
# them). Promote an entry into LEAGUES once its history is loaded and validated.
# Fixtures come from openfootball/football.json only (file name under <season>/; entries appear
# when the repository publishes that league). A second source is deliberately not used yet:
# without per-league team alias tables, two spellings of one club would create duplicate fixtures.
SCHEDULE_ONLY = {
    "E2": {"name": "League One", "short": "E2", "openfootball": "en.3", "tz": "Europe/London"},
    "E3": {"name": "League Two", "short": "E3", "openfootball": "en.4", "tz": "Europe/London"},
    "SC1": {"name": "Scottish Championship", "short": "SC1", "openfootball": "sco.2", "tz": "Europe/London"},
    "B1": {"name": "Belgian Pro League", "short": "B1", "openfootball": "be.1", "tz": "Europe/Brussels"},
}

# Public-only leagues: predicted ONLY by the rights-compliant public path (pipeline/public.py),
# never by the private research models, because no football-data.co.uk history is held for
# them. Training history: final scores from openfootball (CC0) for past seasons, plus confirmed
# current-season results from permitted sources. Fixtures and timely results: football-data.org
# (free tier covers DED and PPL) and openfootball.
# "openfootball_europe" is the same CC0 project's plain-text file in openfootball/europe
# (path under the repository, {season} = "2026-27"), used when football.json has not published
# the league for a season. The Scottish Premiership is not on the football.json 2026-27 list and
# not on the football-data.org free tier, so it relies on that file.
# "results_lag": the league's only permitted results source is known to publish scores weeks
# late (openfootball/europe had no SPFL result after 20 Sep 2026 as of 8 Nov 2026). Its overdue
# results, and match-day fixtures that could not be sealed because their time is unconfirmed,
# are reported by the coverage audit but do not fail it. Remove the flag once a timely
# permitted source exists for the league.
PUBLIC_ONLY = {
    "N1": {"name": "Eredivisie", "short": "N1", "openfootball": "nl.1", "fdo": "DED", "tz": "Europe/Amsterdam"},
    "P1": {"name": "Primeira Liga", "short": "P1", "openfootball": "pt.1", "fdo": "PPL", "tz": "Europe/Lisbon"},
    "SC0": {"name": "Scottish Premiership", "short": "SC0", "openfootball": "sco.1", "fdo": None, "tz": "Europe/London",
            "openfootball_europe": "scotland/{season}_sco1.txt", "results_lag": True},
}
# Every competition that gets a public prediction for each scheduled match.
PREDICTED = {**LEAGUES, **PUBLIC_ONLY}
# Local-time zone of openfootball kick-off times for leagues outside the original six.
LOCAL_TZ = {code: meta["tz"] for code, meta in {**SCHEDULE_ONLY, **PUBLIC_ONLY}.items()}


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


def co_uk_download_allowed():
    """football-data.co.uk limits its data to private individuals and excludes automated
    bots/scrapers. Scheduled and public runs therefore never download it; a research run by
    the owner must opt in explicitly with MATCHIQ_ALLOW_COUK_DOWNLOAD=1."""
    return os.environ.get("MATCHIQ_ALLOW_COUK_DOWNLOAD") == "1"


def fetch_csv(competition, season, opener=None):
    if opener is None and not co_uk_download_allowed():
        raise PermissionError("automated football-data.co.uk download disabled (site terms); set MATCHIQ_ALLOW_COUK_DOWNLOAD=1 for a manual research run")
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
        except PermissionError as error:  # disabled on purpose (site terms): not a failure
            out += old
            status[code] = {"ok": False, "disabled": True, "results": len(old), "note": "automated download disabled by design (site terms); stored research copy kept",
                            "latest_result": max((r["date"] for r in old), default=None)}
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


def save_results(rows, path=RESULTS_PATH):
    rows = sorted(rows, key=lambda r: (r["competition"], r["date"], r["home"]))
    tmp = Path(str(path) + ".tmp")
    tmp.write_text(json.dumps({"source": "football-data.co.uk (personal/research use)", "results": _dump(rows)},
                              separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def build(seasons=BUILD_SEASONS):
    rows = []
    for code in EXTRA:
        for season in seasons:
            rows += parse_csv(fetch_csv(code, season), code, season)
            print(code, season, len(rows), file=sys.stderr)
    save_results(rows)


if __name__ == "__main__":
    if "--build" in sys.argv:
        build()
