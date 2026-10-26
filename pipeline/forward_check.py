"""First live forward-settlement check for the public-derived PUB- ledger.

    python -m pipeline.forward_check --baseline   # record sealed hashes BEFORE the matches (run once, commit)
    python -m pipeline.forward_check              # after a refresh: verify and write data/forward_check/report.json

Seven checks (PASS/FAIL each): sealed before kick-off, result matched to the right fixture,
settlement recomputed independently, immutability against the baseline, scorecards recomputed,
completed fixtures left Upcoming but stayed in history, and idempotent re-settlement.
Retrospective replays are never counted: only records in the committed baseline qualify.
"""
import copy
import datetime as dt
import json
import sys
from pathlib import Path

from . import history as hist
from . import public

import os

ROOT = Path(os.environ.get("MATCHIQ_ROOT") or Path(__file__).resolve().parents[1])
PUB = ROOT / "data" / "public"
OUT_DIR = ROOT / "data" / "forward_check"
OUT_DIR.mkdir(parents=True, exist_ok=True)
MUTABLE = {"result", "settlement", "evaluated", "superseded_by", "result_disputed", "fixture_status"}


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def parse(ts):
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))


def baseline():
    ledger = read(PUB / "prediction_history.json")
    hist.verify(ledger)
    rec = {r["record_id"]: {"sha256": r["sha256"], "published_at": r["published_at"], "kickoff_utc": r["fixture"]["kickoff_utc"],
                            "match_id": r["match_id"], "sealed": {k: v for k, v in r.items() if k not in MUTABLE}}
           for r in ledger["records"]}
    out = {"recorded_at": dt.datetime.now(dt.timezone.utc).isoformat(), "records": rec}
    (OUT_DIR / "baseline.json").write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(rec)


def independent_settlement(record, score):
    """Re-derive win/loss for the picked selection of each public market without using history.settle_record."""
    hg, ag = score
    out = {}
    m = record["markets"]
    if "result" in m:
        outcome = "H" if hg > ag else "D" if hg == ag else "A"
        out["result"] = (outcome, m["result"]["pick"]["key"] == outcome)
    if "goals" in m:
        line = m["goals"]["pick"].get("line")
        if line is not None:
            over = hg + ag > line
            out["goals"] = (hg + ag, (m["goals"]["pick"]["key"] == "over") == over)
    if "btts" in m:
        both = hg > 0 and ag > 0
        out["btts"] = (both, (m["btts"]["pick"]["key"] == "yes") == both)
    return out


def check():
    base = read(OUT_DIR / "baseline.json")
    ledger = read(PUB / "prediction_history.json")
    fixtures = {f["id"]: f for f in read(ROOT / "data" / "fixtures.json")["fixtures"]}
    pred_doc = read(PUB / "predictions.json")
    preds, horizon = pred_doc["predictions"], pred_doc.get("horizon_days", 21)
    perf = read(PUB / "performance.json")
    by_id = {r["record_id"]: r for r in ledger["records"]}
    evaluated = [r for r in ledger["records"] if r.get("evaluated") and r["record_id"] in base["records"]]
    report = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "baseline_recorded_at": base["recorded_at"],
              "baseline_records": len(base["records"]), "forward_settled_records": len(evaluated), "checks": {}}
    rec_at = parse(base["recorded_at"])

    # 1. sealed before kick-off, and the baseline itself was recorded before kick-off
    bad = []
    for r in evaluated:
        k = parse(r["fixture"]["kickoff_utc"])
        b = base["records"][r["record_id"]]
        if not (parse(r["published_at"]) < k and parse(b["published_at"]) < k and rec_at < k and r["record_id"].startswith("PUB-") and r["origin"] == "public-derived"):
            bad.append(r["record_id"])
    report["checks"]["1_sealed_before_kickoff"] = {"pass": bool(evaluated) and not bad, "violations": bad, "n": len(evaluated)}

    # 2. result matched to the right fixture, from a permitted, unconflicted source
    bad = []
    for r in evaluated:
        f = fixtures.get(r["match_id"])
        ok = f and f["status"] == "FINISHED" and f["score"] == r["result"]["score"] and public.permitted_result(f) \
            and (f["home"], f["away"], f["competition"]) == (r["fixture"]["home"], r["fixture"]["away"], r["fixture"]["competition"])
        if not ok:
            bad.append(r["record_id"])
    report["checks"]["2_results_match_fixtures"] = {"pass": bool(evaluated) and not bad, "violations": bad}

    # 3. winners and losers settled correctly (independent recomputation + the library's own result)
    bad, wins, losses = [], 0, 0
    for r in evaluated:
        ind = independent_settlement(r, r["result"]["score"])
        for market, (value, won) in ind.items():
            s = r["settlement"].get(market)
            if not s or s["pick_won"] != won:
                bad.append(f"{r['record_id']}:{market}")
            wins += won
            losses += (not won)
        if r["settlement"] != hist.settle_record(copy.deepcopy(r), r["result"]["score"], None):
            bad.append(r["record_id"] + ":library")
    report["checks"]["3_settlement_correct"] = {"pass": bool(evaluated) and not bad, "violations": bad, "picks_won": wins, "picks_lost": losses}

    # 4. immutability: sealed content of every baseline record unchanged; nothing removed
    bad = []
    for rid, b in base["records"].items():
        r = by_id.get(rid)
        if r is None or r["sha256"] != b["sha256"] or hist.seal(r) != b["sha256"] \
                or {k: v for k, v in r.items() if k not in MUTABLE} != b["sealed"]:
            bad.append(rid)
    try:
        hist.verify(ledger)
        verified = True
    except hist.IntegrityError:
        verified = False
    report["checks"]["4_history_immutable"] = {"pass": not bad and verified, "violations": bad, "ledger_verified": verified,
                                               "records_now": len(ledger["records"]), "new_revisions_since_baseline": len(ledger["records"]) - len(base["records"])}

    # 5. scorecards equal an independent recomputation, per league
    fresh = hist.performance(ledger)
    keyf = lambda p: {"result": (p.get("markets") or {}).get("result"), "n": p.get("evaluated_matches")}
    diffs = [c for c in ["PL"] if keyf(fresh) != keyf(perf)]
    diffs += [c for c in fresh.get("by_competition", {}) if keyf(fresh["by_competition"][c]) != keyf((perf.get("by_competition") or {}).get(c, {}))]
    per_league = {"PL": keyf(perf)} | {c: keyf(v) for c, v in (perf.get("by_competition") or {}).items()}
    total = sum(1 for r in ledger["records"] if r.get("evaluated"))
    report["checks"]["5_scorecards_accurate"] = {"pass": not diffs and perf.get("evaluated_matches") is not None and sum(v["n"] or 0 for v in per_league.values()) == len({r["match_id"] for r in ledger["records"] if r.get("evaluated")}),
                                                 "mismatches": diffs, "evaluated_records": total, "per_league": per_league}

    # 6. finished fixtures left Upcoming but remain in history
    bad = [r["match_id"] for r in evaluated if r["match_id"] in preds]
    gone = [r["match_id"] for r in evaluated if r["record_id"] not in by_id]
    report["checks"]["6_left_upcoming_kept_in_history"] = {"pass": bool(evaluated) and not bad and not gone, "still_listed_upcoming": bad, "missing_from_history": gone}

    # 7. repeating settlement changes nothing
    now = parse(perf["generated_at"])
    fx_list = list(read(ROOT / "data" / "fixtures.json")["fixtures"])
    once = copy.deepcopy(ledger)
    public.run_public(now, fx_list, read(ROOT / "data" / "fixtures.json")["season"], horizon, ledger=once)
    twice = copy.deepcopy(once)
    public.run_public(now, fx_list, read(ROOT / "data" / "fixtures.json")["season"], horizon, ledger=twice)
    same = json.dumps(once, sort_keys=True) == json.dumps(twice, sort_keys=True)
    unchanged = len(once["records"]) == len(ledger["records"]) and all(by_id[r["record_id"]]["sha256"] == r["sha256"] for r in once["records"] if r["record_id"] in by_id)
    report["checks"]["7_idempotent"] = {"pass": same and unchanged, "second_run_identical": same, "no_new_or_altered_records": unchanged}

    report["verdict"] = "PASS" if all(c["pass"] for c in report["checks"].values()) else "FAIL"
    (OUT_DIR / "report.json").write_text(json.dumps(report, indent=1, default=str) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    if "--baseline" in sys.argv:
        print("baseline records:", baseline())
    else:
        r = check()
        print(r["verdict"], {k: v["pass"] for k, v in r["checks"].items()}, "settled:", r["forward_settled_records"])
