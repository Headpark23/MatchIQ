"""Training history for the UEFA club competitions (leagues.PUBLIC_ONLY entries with "european").

Source: openfootball/champions-league (CC0 public domain), one plain-text file per competition
and season, qualifying rounds in separate files ("clq.txt"). It holds results only, so the
fixtures and timely results of the current season come from OpenLigaDB (ODbL).

The three competitions share one model: clubs meet across them (and across qualifying rounds),
and a club's strength does not depend on which trophy it is playing for. Every European match
since July 2021 (HISTORY_SEASONS), qualifiers included, is in the training set for each of CL,
EL and ECL, plus the confirmed results of the current season.

Walk-forward evidence (result Brier on the 610 European matches of 2025-26): adding the
domestic results MatchIQ holds for nine leagues did not help (0.611 against 0.611 European-only,
monthly refit) and made each fit five times slower, so the model is European-only. Clubs play
few European matches, so the model is used once both clubs have 3 of them in the last 400 days
("min_matches" in leagues.py; the domestic leagues need 10): weekly refit 0.609 with 3, 0.612
with 10, 0.628 for the average. On 2024-25 main-draw matches with the same settings: CL 0.551
vs 0.605 for the average, EL 0.611 vs 0.628, ECL 0.593 vs 0.620. Qualifying rounds score worse
than the average (2024-25 ECL qualifiers 0.672 vs 0.623), but they are training data only:
OpenLigaDB lists the main draw, which is all MatchIQ predicts. The published backtest
(data/public/league_validation.json) uses the 2024-25 main draw, because openfootball has no
2025-26 Europa or Conference League main draw. The threshold was chosen on 2025-26 and
checked on 2024-25, so the 2024-25 figures are not a fully independent test.

Below 10 recent European matches ("full_weight_matches") the model's 1X2 probabilities are
blended toward the European average, weight n/10: a club in its first European season can
otherwise be rated on three or four results (one 9-1 win gave 98% for a home win). Over all
matches this improved the Brier score (2024-25 0.601 against 0.614 unblended; 2025-26 0.595
against 0.609) and left the main draw unchanged (0.585 against 0.584; 0.544 against 0.542).

Scores are the 90-minute result: extra time and penalties decide ties but are not part of the
1X2, goals or BTTS markets.

Club names: teams.UEFA_CLUBS first (every club in the current league phases, with their German
OpenLigaDB names and the openfootball spelling variants); otherwise the club's domestic name
when it comes from a league MatchIQ covers (so Arsenal is the same club in the Premier League
and the Champions League); otherwise the cleaned openfootball name.

    python -m pipeline.public --history     # refreshes data/public_results_european.json too
"""
import datetime as dt
import json
import re
from pathlib import Path

from .leagues import PUBLIC_ONLY
from .sources import MONTHS, http_text
from .teams import PREMIER_LEAGUE_ALIASES, _normalise, canonical, canonical_for, known_club

ROOT = Path(__file__).resolve().parents[1]
HISTORY_PATH = ROOT / "data" / "public_results_european.json"
SOURCE = "openfootball_uefa"
BASE_URL = "https://raw.githubusercontent.com/openfootball/champions-league/master/{season}/{file}.txt"
HISTORY_SEASONS = (2021, 2022, 2023, 2024, 2025)
EUROPEAN = [code for code, meta in PUBLIC_ONLY.items() if meta.get("european")]
# Main draw and qualifying-round files for each competition.
FILES = {"CL": ("cl", "clq"), "EL": ("el", "elq"), "ECL": ("conf", "confq")}
# Domestic leagues whose canonical club names European clubs from that country take, in the
# order tried (an English club in Europe is almost always a Premier League side).
COUNTRY_LEAGUES = {"ENG": ("PL", "ELC"), "GER": ("BL1",), "ESP": ("PD",), "ITA": ("SA",), "FRA": ("FL1",), "MCO": ("FL1",),
                   "NED": ("N1",), "POR": ("P1",), "SCO": ("SC0",)}
_PL_ALIASES = {_normalise(a) for aliases in PREMIER_LEAGUE_ALIASES.values() for a in aliases + [""]} - {""}

_DATE = re.compile(r"^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})(?:\s+(\d{4}))?\s*$")
_MATCH = re.compile(r"^\s+(?:\d{1,2}[:.]\d{2}\s+)?(.+?)\s+\(([A-Z]{3})\)\s+v\s+(.+?)\s+\(([A-Z]{3})\)\s*(.*)$")
_FT = re.compile(r"^(\d+)-(\d+)(?:\s+\(\d+-\d+\))?$")              # "2-1" or "2-1 (1-0)"
_AFTER_90 = re.compile(r"(?:a\.e\.t\.|pen\.).*\((\d+)-(\d+),\s*\d+-\d+\)$")  # "... a.e.t. (1-1, 0-0)": first pair is 90 minutes


def club_name(raw, country):
    """Canonical club name: the domestic league's name for a club from a covered league,
    otherwise the openfootball spelling."""
    raw = raw.strip()
    if known_club("CL", raw):  # teams.UEFA_CLUBS: spelling variants and every current club
        return canonical_for("CL", raw)
    for league in COUNTRY_LEAGUES.get(country, ()):
        if league == "PL":
            if _normalise(raw) in _PL_ALIASES:
                return canonical_for("PL", raw)
        elif known_club(league, raw):
            return canonical_for(league, raw)
    return canonical(raw)  # a club only seen in earlier seasons: its cleaned name


def score_90(text):
    """The 90-minute score from an openfootball score field, or None when unplayed or unclear."""
    text = text.strip()
    plain = _FT.match(text)
    if plain:
        return [int(plain.group(1)), int(plain.group(2))]
    extra = _AFTER_90.search(text)
    if extra:
        return [int(extra.group(1)), int(extra.group(2))]
    return None


def parse(text, competition, season_start, qualifying=False):
    """Played matches from one openfootball champions-league file, as history rows. Qualifying
    rows carry "q": the backtest scores main-draw matches only, the ones MatchIQ predicts."""
    rows, day = [], None
    season = f"{season_start % 100:02d}{(season_start + 1) % 100:02d}"
    for line in text.splitlines():
        date = _DATE.match(line)
        if date:
            month, dom = MONTHS[date.group(1)], int(date.group(2))
            year = int(date.group(3)) if date.group(3) else season_start + (0 if month >= 7 else 1)
            day = dt.date(year, month, dom)
            continue
        m = _MATCH.match(line)
        if not m or day is None:
            continue
        score = score_90(m.group(5))
        if score is None:
            continue
        rows.append({"c": competition, "s": season, "d": day.isoformat(), "h": club_name(m.group(1), m.group(2)),
                     "a": club_name(m.group(3), m.group(4)), "hg": score[0], "ag": score[1], **({"q": 1} if qualifying else {})})
    return rows


def fetch_season(competition, season_start, opener=None):
    label = f"{season_start}-{(season_start + 1) % 100:02d}"
    rows, missing = [], []
    for name in FILES[competition]:
        try:
            rows += parse(http_text(BASE_URL.format(season=label, file=name), opener=opener, retries=2), competition, season_start,
                          qualifying=name.endswith("q"))
        except RuntimeError:
            missing.append(name)  # not every season has every file (2025-26 has no el.txt yet)
    return rows, missing


def build_history(path=HISTORY_PATH, opener=None, seasons=HISTORY_SEASONS):
    rows, notes = [], {}
    for code in FILES:
        for start in seasons:
            got, missing = fetch_season(code, start, opener)
            notes[f"{code}:{start}"] = {"rows": len(got), "missing_files": missing}
            rows += got
    if len(rows) < 1000:
        raise RuntimeError(f"European history looks truncated ({len(rows)} rows)")
    Path(path).write_text(json.dumps({"source": "openfootball/champions-league (CC0 public domain; 90-minute scores only)",
                                      "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "notes": notes, "results": rows},
                                     separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    return notes


def load_history(path=HISTORY_PATH):
    """History rows for the public path. Each European match appears once under each of CL, EL
    and ECL (the shared model; see the module docstring), with "origin" naming the competition
    it was played in and "qualifying" marking qualifying rounds."""
    try:
        items = json.loads(Path(path).read_text(encoding="utf-8"))["results"]
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return []
    return [{"competition": code, "origin": i["c"], "qualifying": bool(i.get("q")), "season": i["s"], "date": dt.date.fromisoformat(i["d"]),
             "home": i["h"], "away": i["a"], "hg": i["hg"], "ag": i["ag"], "stats": {}, "source": SOURCE}
            for code in EUROPEAN for i in items]
