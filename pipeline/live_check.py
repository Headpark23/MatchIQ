"""One-off live API check (football-data.org and The Odds API). Writes data/live_check/report.json.

Never writes or prints credentials (read from the environment only, and scrubbed from any
error text). Spend is small and fixed: 6 football-data.org requests (free, 10/minute) and at
most one Odds API call per league (<= 3 credits each, free /sports call for discovery).
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

from . import odds as odds_mod
from .data import load_co_uk
from .leagues import LEAGUES, load_results
from .teams import canonical_for

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "live_check" / "report.json"
SEASON_START, SEASON = 2026, "2627"
SECRETS = [os.environ.get("FOOTBALL_DATA_ORG_TOKEN") or "\0", os.environ.get("ODDS_API_KEY") or "\0"]


def scrub(text):
    text = str(text)
    for s in SECRETS:
        text = text.replace(s, "[redacted]")
    return text


def get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": "MatchIQ-livecheck/1.0", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, dict(r.headers), json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        return e.code, dict(e.headers), {"error": scrub(body)}
    except Exception as e:
        return 0, {}, {"error": scrub(f"{type(e).__name__}: {e}")}


def pick(headers, *names):
    low = {k.lower(): v for k, v in headers.items()}
    return {n: low[n] for n in names if n in low}


def known_names():
    known = {c: set() for c in LEAGUES}
    for r in load_co_uk(ROOT / "data" / "matches.json"):
        known["PL"].update((r["home"], r["away"]))
    for r in load_results():
        known[r["competition"]].update((r["home"], r["away"]))
    return known


def check_fdo(fixtures, known):
    token = os.environ.get("FOOTBALL_DATA_ORG_TOKEN")
    if not token:
        return {"skipped": "token not set"}
    out = {}
    for code in LEAGUES:
        status, headers, body = get(f"https://api.football-data.org/v4/competitions/{code}/matches?season={SEASON_START}", {"X-Auth-Token": token})
        rec = {"http": status, **pick(headers, "x-requests-available-minute", "x-ratelimit-remaining")}
        if status == 200:
            ms = body.get("matches", [])
            rec["matches"] = len(ms)
            rec["by_status"] = dict(Counter(m["status"] for m in ms))
            fin = sorted(m["utcDate"] for m in ms if m["status"] == "FINISHED")
            rec["latest_finished_utc"] = fin[-1] if fin else None
            fut = sorted(m["utcDate"] for m in ms if m["status"] in ("SCHEDULED", "TIMED"))
            rec["next_kickoff_utc"] = fut[0] if fut else None
            names = {m[s]["name"] for m in ms for s in ("homeTeam", "awayTeam")}
            canon = {canonical_for(code, n) for n in names}
            rec["clubs"] = len(names)
            rec["unresolved_clubs"] = sorted(n for n in names if canonical_for(code, n) not in known[code])
            ours = {f["id"] for f in fixtures if f["competition"] == code}
            from .teams import match_id
            theirs = {match_id(code, SEASON, canonical_for(code, m["homeTeam"]["name"]), canonical_for(code, m["awayTeam"]["name"])) for m in ms}
            rec["fixture_id_overlap_with_current_schedule"] = f"{len(ours & theirs)} of {len(ours)}"
            rec["competition_listed"] = (body.get("competition") or {}).get("name")
        else:
            rec["error"] = (body or {}).get("error")
        out[code] = rec
        time.sleep(7)  # 10 requests/minute limit
    return out


def check_odds(fixtures, now):
    key = os.environ.get("ODDS_API_KEY")
    if not key:
        return {"skipped": "key not set"}
    out = {"endpoint_host": "api.the-odds-api.com"}
    status, headers, body = get(f"https://api.the-odds-api.com/v4/sports/?apiKey={key}")
    out["sports_http"] = status
    out["sports_credit_headers"] = pick(headers, "x-requests-used", "x-requests-remaining", "x-requests-last")
    soccer = [s for s in body if isinstance(body, list) and s.get("group") == "Soccer"] if isinstance(body, list) else []
    active = {s["key"]: s for s in soccer}
    out["soccer_keys_listed"] = sorted(active)
    out["leagues"] = {}
    for code, meta in LEAGUES.items():
        k = meta["odds_sport"]
        rec = {"sport_key": k, "listed": k in active, "active": bool(active.get(k, {}).get("active"))}
        if not rec["active"]:
            out["leagues"][code] = rec
            continue
        for markets in ("h2h,totals,btts", "h2h,totals"):
            status, headers, events = get(f"https://api.the-odds-api.com/v4/sports/{k}/odds/?regions=uk&markets={markets}&oddsFormat=decimal&apiKey={key}")
            rec.update({"markets_requested": markets, "http": status, **pick(headers, "x-requests-used", "x-requests-remaining", "x-requests-last")})
            if status != 422:
                break
        if status == 200 and isinstance(events, list):
            matched, unmatched = odds_mod.parse_events(events, now, code, fixtures)
            keys = Counter(m["key"] for e in events for b in e.get("bookmakers", []) for m in b.get("markets", []))
            lines = sorted({o.get("point") for e in events for b in e.get("bookmakers", []) for m in b.get("markets", []) if m["key"] == "totals" for o in m["outcomes"] if o.get("point") is not None})
            rec.update({"events": len(events), "bookmakers": sorted({b["title"] for e in events for b in e.get("bookmakers", [])}),
                        "market_counts": dict(keys), "totals_lines_seen": lines, "matched_to_our_schedule": len(matched),
                        "unmatched": unmatched[:8], "selections_priced": sum(len(m["selections"]) for m in matched.values())})
        else:
            rec["error"] = (events or {}).get("error") if isinstance(events, dict) else None
        out["leagues"][code] = rec
    return out


def main():
    now = dt.datetime.now(dt.timezone.utc)
    fixtures = json.loads((ROOT / "data" / "fixtures.json").read_text(encoding="utf-8"))["fixtures"]
    report = {"generated_at": now.isoformat(), "football_data_org": check_fdo(fixtures, known_names()), "the_odds_api": check_odds(fixtures, now)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(scrub(json.dumps(report, indent=1, default=str)) + "\n", encoding="utf-8")
    print(OUT.read_text(encoding="utf-8"))


if __name__ == "__main__":
    sys.exit(main())
