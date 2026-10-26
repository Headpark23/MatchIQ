"""Load historical results and merge fixture sources into one schedule."""
import datetime as dt
import json
from collections import Counter
from pathlib import Path

from .sources import parse_openfootball
from .teams import canonical, match_id

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOTS = Path(__file__).resolve().parent / "snapshots"
# football-data.co.uk is last: it has no kickoff times, only confirmed results.
SOURCE_PRIORITY = ["football-data.org", "openligadb", "openfootball", "football-data.co.uk"]
STAT_KEYS = ("HC", "AC", "HY", "AY", "HST", "AST", "HS", "AS")


def season_code(season_start):
    return f"{season_start % 100:02d}{(season_start + 1) % 100:02d}"


def load_co_uk(path=ROOT / "data" / "matches.json"):
    """Premier League results with match statistics (football-data.co.uk, research use)."""
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows, seen = [], {}
    for r in payload.get("matches", []):
        try:
            day = dt.datetime.strptime(r["Date"], "%d/%m/%Y").date()
            hg, ag = int(r["FTHG"]), int(r["FTAG"])
        except (KeyError, TypeError, ValueError):
            continue
        outcome = "H" if hg > ag else "A" if ag > hg else "D"
        if r.get("FTR") != outcome:
            continue
        stats = {}
        for key in STAT_KEYS:
            try:
                stats[key] = float(r[key]) if r.get(key) not in (None, "") else None
            except ValueError:
                stats[key] = None
        row = {"date": day, "competition": "PL", "season": r.get("season"), "home": canonical(r["HomeTeam"]),
               "away": canonical(r["AwayTeam"]), "hg": hg, "ag": ag, "stats": stats, "source": "football-data.co.uk"}
        key = (day, row["home"], row["away"])
        seen[key] = seen.get(key, 0) + 1
        rows.append(row)
    return [r for r in rows if seen[(r["date"], r["home"], r["away"])] == 1]


def load_snapshot(name, competition, season):
    payload = json.loads((SNAPSHOTS / name).read_text(encoding="utf-8"))
    # Legacy club naming: the Premier League models and their input fingerprint were built
    # with it. The Championship as a league of its own uses canonical_for("ELC", ...).
    return [m for m in parse_openfootball(payload, competition, season, namer=canonical)]


def championship_history():
    out = []
    for name, season in (("openfootball_2024-25_en.2.json", "2425"), ("openfootball_2025-26_en.2.json", "2526")):
        for m in load_snapshot(name, "ELC", season):
            if m["score"]:
                out.append(result_from_match(m))
    return out


def result_from_match(m):
    kickoff = dt.datetime.fromisoformat(m["kickoff_utc"].replace("Z", "+00:00"))
    return {"date": uk_date(kickoff),
            "competition": m["competition"], "season": m["season"], "home": m["home"], "away": m["away"],
            "hg": int(m["score"][0]), "ag": int(m["score"][1]), "stats": None, "source": m["source"]}


def uk_date(kickoff):
    from zoneinfo import ZoneInfo
    return kickoff.astimezone(ZoneInfo("Europe/London")).date()


def promoted_by_season(epl_results, fixtures=()):
    """Clubs in a Premier League season that were not in the previous one. 2023/24
    membership comes from the openfootball snapshot; later seasons from our data."""
    members = {"2324": {m["home"] for m in load_snapshot("openfootball_2023-24_en.1.json", "PL", "2324")}}
    for r in list(epl_results) + [f for f in fixtures if f["competition"] == "PL"]:
        members.setdefault(r["season"], set()).update((r["home"], r["away"]))
    out = {}
    for season in sorted(members):
        previous = f"{int(season[:2]) - 1:02d}{int(season[:2]):02d}"
        if previous in members:
            out[season] = members[season] - members[previous]
    return out


def merge_fixtures(source_lists, previous=None, now=None):
    """Combine sources into one record per stable match id.

    - Kickoff and status come from the highest-priority source that lists the match.
    - A result needs a FINISHED score; disagreeing scores become RESULT_CONFLICT.
    - Kickoff passed without a score is AWAITING_RESULT, never "finished".
    - Kickoff changes are kept in `kickoff_history` (rescheduled).
    - A previously listed, unfinished match that no source lists any more is kept as
      REMOVED_FROM_SCHEDULE so its history survives."""
    now = now or dt.datetime.now(dt.timezone.utc)
    previous = {f["id"]: f for f in (previous or [])}
    by_id = {}
    for matches in source_lists:
        for m in matches:
            mid = match_id(m["competition"], m["season"], m["home"], m["away"])
            by_id.setdefault(mid, []).append(m)
    merged = []
    for mid, entries in by_id.items():
        entries.sort(key=lambda m: SOURCE_PRIORITY.index(m["source"]))
        lead = entries[0]
        finished = [m for m in entries if m["status"] == "FINISHED" and m["score"]]
        old = previous.get(mid, {})
        record = {"id": mid, "competition": lead["competition"], "season": lead["season"], "home": lead["home"],
                  "away": lead["away"], "kickoff_utc": lead["kickoff_utc"], "status": lead["status"], "score": None,
                  "result_source": None, "sources": sorted({m["source"] for m in entries}, key=SOURCE_PRIORITY.index),
                  "first_seen": old.get("first_seen") or now.isoformat(), "kickoff_history": list(old.get("kickoff_history") or [])}
        if old.get("kickoff_utc") and old["kickoff_utc"] != record["kickoff_utc"]:
            record["kickoff_history"].append({"from": old["kickoff_utc"], "to": record["kickoff_utc"], "seen_at": now.isoformat()})
        if finished:
            scores = {tuple(m["score"]) for m in finished}
            if len(scores) > 1:
                record["conflicting_scores"] = [{"source": m["source"], "score": m["score"]} for m in finished]
                votes = Counter(tuple(m["score"]) for m in finished).most_common()
                if votes[0][1] >= 2 and votes[0][1] > votes[1][1]:
                    # Two or more independent sources agree and outnumber the rest.
                    agreed = [m for m in finished if tuple(m["score"]) == votes[0][0]]
                    record["status"], record["score"], record["result_source"] = "FINISHED", list(votes[0][0]), agreed[0]["source"]
                    record["result_note"] = "Sources disagreed; " + str(votes[0][1]) + " of " + str(len(finished)) + " agree on this score."
                else:
                    record["status"] = "RESULT_CONFLICT"
            else:
                record["status"], record["score"], record["result_source"] = "FINISHED", list(finished[0]["score"]), finished[0]["source"]
        elif record["status"] in ("SCHEDULED", "IN_PLAY"):
            kickoff = dt.datetime.fromisoformat(record["kickoff_utc"].replace("Z", "+00:00"))
            if kickoff <= now:
                record["status"] = "AWAITING_RESULT"
        merged.append(record)
    for mid, old in previous.items():
        if mid not in by_id and old.get("status") not in ("FINISHED",):
            merged.append({**old, "status": "REMOVED_FROM_SCHEDULE"})
    merged.sort(key=lambda f: (f["kickoff_utc"], f["home"]))
    return merged


def co_uk_as_matches(rows, season):
    """football-data.co.uk results as a (lower-priority) result source for settlement."""
    out = []
    for r in rows:
        if r["season"] != season:
            continue
        kickoff = dt.datetime.combine(r["date"], dt.time(12, 0), dt.timezone.utc)
        out.append({"competition": r["competition"], "season": season, "home": r["home"], "away": r["away"],
                    "kickoff_utc": kickoff.isoformat().replace("+00:00", "Z"), "status": "FINISHED",
                    "score": [r["hg"], r["ag"]], "source": "football-data.co.uk", "source_updated": None})
    return out
