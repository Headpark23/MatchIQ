"""Coverage audit of the public prediction record.

For every competition that is predicted (leagues.PREDICTED) it counts, from the files the
public site is built from:

  * upcoming matches inside the publishing horizon, and how many have a published prediction;
  * matches kicking off in the next 48 hours without a prediction (a gap);
  * matches played since the league's public ledger began, how many had a prediction sealed
    before kick-off, and how many of those are settled;
  * matches that kicked off more than RESULT_GRACE_HOURS ago and still have no confirmed result;
  * predicted leagues with no fixtures at all (every source failed or stopped publishing the
    league), so a league can never silently disappear from the app.

    python -m pipeline.coverage                    # print the table, write data/coverage.json
    python -m pipeline.coverage --summary FILE     # also append a Markdown table (GitHub step summary)
    python -m pipeline.coverage --strict           # exit 1 when any gap exists

Schedule-only competitions (leagues.SCHEDULE_ONLY) are listed with their fixture counts only:
no permitted source supplies the history a model needs, so they are not predicted.

Leagues flagged "results_lag" (their only permitted results source is known to run weeks late)
still have their overdue results counted, and their match-day fixtures with an unconfirmed
kick-off time and no sealed prediction (which public.py may not predict) are listed, but both
go under "known_lag" instead of "gaps", so they do not fail --strict.
"""
import argparse
import datetime as dt
import json
import sys
from collections import defaultdict
from pathlib import Path

from .leagues import PREDICTED, SCHEDULE_ONLY
from .public import TIMED_SOURCES, seal_cutoff

ROOT = Path(__file__).resolve().parents[1]
GAP_HOURS = 48
START_GRACE = dt.timedelta(days=1)   # matches this soon after a league's first publication may predate it
RECENT = dt.timedelta(days=7)        # a missed seal this recent fails --strict; older ones are history
RESULT_GRACE_HOURS = 72
INACTIVE = ("POSTPONED", "CANCELLED", "REMOVED_FROM_SCHEDULE")


def _ts(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def compute(fixtures, predictions, ledger_records, now, horizon_days=21):
    by_match = defaultdict(list)
    for r in ledger_records:
        by_match[r["match_id"]].append(r)
    started = {}
    for r in ledger_records:
        code, t = r["fixture"]["competition"], _ts(r["published_at"])
        started[code] = min(started.get(code, t), t)
    leagues, gaps = {}, {"league_without_fixtures": [], "unpredicted_next_48h": [], "unsealed_last_7d": [], "unsettled": [], "results_overdue": []}
    history = {"unsealed_before_last_7d": []}
    known_lag = {"results_overdue": [], "untimed_match_day_unsealed": []}
    for code in list(PREDICTED) + list(SCHEDULE_ONLY):
        lag = bool(PREDICTED.get(code, {}).get("results_lag"))
        mine = [f for f in fixtures if f["competition"] == code]
        row = {"name": (PREDICTED.get(code) or SCHEDULE_ONLY[code])["name"], "predicted": code in PREDICTED, "fixtures": len(mine)}
        if code not in PREDICTED:
            leagues[code] = row
            continue
        if not mine:
            gaps["league_without_fixtures"].append(code)
        start = started.get(code)
        row.update({"ledger_start": start.isoformat() if start else None, "upcoming": 0, "upcoming_predicted": 0,
                    "next_48h": 0, "next_48h_predicted": 0, "played_since_start": 0, "sealed": 0, "settled": 0, "results_overdue": 0})
        for f in mine:
            kickoff = _ts(f["kickoff_utc"])
            if f["status"] in INACTIVE:
                continue
            if now < kickoff <= now + dt.timedelta(days=horizon_days) and f["status"] == "SCHEDULED":
                row["upcoming"] += 1
                row["upcoming_predicted"] += f["id"] in predictions
                if kickoff <= now + dt.timedelta(hours=GAP_HOURS):
                    row["next_48h"] += 1
                    row["next_48h_predicted"] += f["id"] in predictions
                    if f["id"] not in predictions:
                        untimed_today = (lag and not set(f.get("sources") or []) & TIMED_SOURCES
                                         and now >= seal_cutoff(kickoff) and not by_match[f["id"]])
                        (known_lag["untimed_match_day_unsealed"] if untimed_today else gaps["unpredicted_next_48h"]).append(f["id"])
            if kickoff <= now and start and kickoff >= start + START_GRACE:
                # Every match after the ledger began was inside the horizon at some run before kick-off.
                row["played_since_start"] += 1
                sealed = [r for r in by_match[f["id"]] if _ts(r["published_at"]) < kickoff]
                if sealed:
                    row["sealed"] += 1
                else:
                    (gaps["unsealed_last_7d"] if kickoff > now - RECENT else history["unsealed_before_last_7d"]).append(f["id"])
                if f["status"] == "FINISHED" and f.get("score"):
                    if any(r.get("evaluated") for r in by_match[f["id"]]):
                        row["settled"] += 1
                    elif sealed:
                        gaps["unsettled"].append(f["id"])
            if f["status"] in ("AWAITING_RESULT", "SCHEDULED", "IN_PLAY", "RESULT_CONFLICT") and kickoff <= now - dt.timedelta(hours=RESULT_GRACE_HOURS):
                row["results_overdue"] += 1
                (known_lag if lag else gaps)["results_overdue"].append(f["id"])
        row["results_lag"] = lag
        leagues[code] = row
    totals = defaultdict(int)
    for row in leagues.values():
        for k, v in row.items():
            if isinstance(v, int) and not isinstance(v, bool):
                totals[k] += v
    return {"generated_at": now.isoformat(), "gap_hours": GAP_HOURS, "result_grace_hours": RESULT_GRACE_HOURS,
            "leagues": leagues, "totals": dict(totals), "gaps": gaps, "known_lag": known_lag, "history": history,
            "complete": not any(gaps.values())}


def markdown(report):
    lines = ["| League | Upcoming predicted | Next 48 h predicted | Played since ledger start: sealed / settled | Results overdue |",
             "|---|---|---|---|---|"]
    for code, r in report["leagues"].items():
        if not r["predicted"]:
            lines.append(f"| {r['name']} | not predicted ({r['fixtures']} fixtures; no permitted source) | | | |")
            continue
        lines.append(f"| {r['name']} | {r['upcoming_predicted']}/{r['upcoming']} | {r['next_48h_predicted']}/{r['next_48h']} | "
                     f"{r['sealed']}/{r['played_since_start']} sealed, {r['settled']} settled | {r['results_overdue']}"
                     f"{' (source lags, allowed)' if r.get('results_lag') and r['results_overdue'] else ''} |")
    gaps = {k: v for k, v in report["gaps"].items() if v}
    lines.append("")
    lag = {k: v for k, v in (report.get("known_lag") or {}).items() if v}
    if lag:
        lines.append("Known source lag (reported, not a failure): " + "; ".join(f"{k}: {len(v)} ({', '.join(v[:5])}{'…' if len(v) > 5 else ''})" for k, v in lag.items()))
    old = report.get("history", {}).get("unsealed_before_last_7d") or []
    if old:
        lines.append(f"Older matches with no sealed prediction (cannot be fixed retroactively): {len(old)} ({', '.join(old[:5])})")
    lines.append("**Coverage complete.**" if not gaps else "**Coverage gaps:** " + "; ".join(f"{k}: {len(v)} ({', '.join(v[:5])}{'…' if len(v) > 5 else ''})" for k, v in gaps.items()))
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data", default=str(ROOT / "data"))
    parser.add_argument("--now", help="ISO timestamp (tests and replays)")
    parser.add_argument("--summary", help="append a Markdown table to this file")
    parser.add_argument("--strict", action="store_true", help="exit 1 when any gap exists")
    args = parser.parse_args(argv)
    data = Path(args.data)
    read = lambda p, d: json.loads((data / p).read_text(encoding="utf-8")) if (data / p).exists() else d
    now = _ts(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
    report = compute(read("fixtures.json", {"fixtures": []})["fixtures"],
                     read("public/predictions.json", {"predictions": {}})["predictions"],
                     read("public/prediction_history.json", {"records": []})["records"], now)
    (data / "coverage.json").write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    text = markdown(report)
    sys.stdout.write(text)
    if args.summary:
        with open(args.summary, "a", encoding="utf-8") as handle:
            handle.write("### Prediction coverage\n\n" + text)
    return 1 if args.strict and not report["complete"] else 0


if __name__ == "__main__":
    sys.exit(main())
