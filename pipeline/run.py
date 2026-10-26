"""MatchIQ refresh: fixtures -> results -> predictions -> history -> performance.

    python -m pipeline.run                 # live sources
    python -m pipeline.run --offline       # snapshots and existing files only
    python -m pipeline.run --now 2026-10-28T09:00:00Z --out /tmp/x   # isolated test run

Writes (in --out, default data/): fixtures.json, predictions.json,
prediction_history.json, performance.json, pipeline_status.json. Frozen ledgers
(match_winner_forward.json, forward_test.json) are read, never written.
"""
import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

from . import history as hist
from . import odds as odds_feed
from .data import (ROOT, championship_history, co_uk_as_matches, load_co_uk, merge_fixtures,
                   promoted_by_season, uk_date)
from .fairodds import fair_odds
from .models import SHADOW_VERSION, VERSIONS, Context, predict, shadow_result
from .recommend import RULE_VERSION, recommend
from .sources import SOURCE_LABELS, fetch_football_data_org, fetch_openfootball, fetch_openligadb
from .teams import canonical, match_id

SEASON_START, SEASON, SEASON_LABEL = 2026, "2627", "2026-27"
HORIZON_DAYS = 21
STATS_STALE_DAYS = 10


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path, value):
    path = Path(path)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def evidence_from(reliability, hierarchy):
    wins = (reliability or {}).get("markets", {}).get("wins", {})
    t2 = (hierarchy or {}).get("models", {}).get("hierarchy", {})
    league = (hierarchy or {}).get("models", {}).get("league", {})
    return {
        "T1": {"strength": "moderate", "summary": (f"Backtest of {wins['n']} matches: Brier {wins['brier']:.3f} vs {wins['league_average_brier']:.3f} for league averages; well calibrated between 50% and 70%."
                                                     if wins else "Frozen production model with a forward ledger.")},
        "T2": {"strength": "weak", "summary": (f"Used when a club lacks Premier League history. Tested on {t2['n']} promoted-club fixtures: Brier {t2['brier']:.3f} vs {league['brier']:.3f} for league averages, so no proven edge."
                                                 if t2 else "Provisional estimate for clubs without Premier League history.")},
        "T3": {"strength": "none", "summary": "Not enough data on either club, so this is the Premier League average. Limited evidence."},
    }


def import_frozen_ledgers(ledger, data_dir, now):
    """Bring earlier frozen-model publications into the history, once, unchanged."""
    winners = read_json(Path(data_dir) / "match_winner_forward.json", {"records": []})["records"]
    corners = {(r["date"], r["home"], r["away"]): r for r in read_json(Path(data_dir) / "forward_test.json", {"records": []})["records"]}
    present = {r["match_id"] for r in ledger["records"]}
    added = 0
    for w in winners:
        mid = match_id("PL", SEASON, w["home"], w["away"])
        if mid in present or not w.get("probabilities"):
            continue
        labels = [f"{w['home']} win", "Draw", f"{w['away']} win"]
        sels = [{"key": k, "label": l, "p": round(float(w["probabilities"][k]), 4), "fair_odds": fair_odds(float(w["probabilities"][k]))} for k, l in zip("HDA", labels)]
        markets = {"result": {"model_version": w["model"], "tier": "T1", "evidence": {"status": "validated", "strength": "moderate"},
                              "pick": max(sels, key=lambda s: s["p"]), "selections": sels}}
        c = corners.get((w["date"], w["home"], w["away"]))
        if c:
            lines = [{"line": float(k), "over": round(float(v), 4), "over_fair_odds": fair_odds(float(v)), "under_fair_odds": fair_odds(1 - float(v))} for k, v in sorted(c["probabilities"].items(), key=lambda kv: float(kv[0]))]
            over = float(c["probabilities"]["9.5"])
            pick = {"key": "over", "label": "Over 9.5", "p": round(over, 4), "fair_odds": fair_odds(over), "line": 9.5} if over >= 0.5 else \
                   {"key": "under", "label": "Under 9.5", "p": round(1 - over, 4), "fair_odds": fair_odds(1 - over), "line": 9.5}
            markets["corners"] = {"model_version": c["model"], "evidence": {"status": "frozen", "strength": "none"}, "pick": pick, "lines": lines}
        record = {"record_id": f"{mid}#r1", "match_id": mid, "revision": 1,
                  "fixture": {"competition": "PL", "season": SEASON, "home": canonical(w["home"]), "away": canonical(w["away"]), "kickoff_utc": w["kickoff_utc"].replace("+00:00", "Z")},
                  "published_at": w["created_at"], "inputs_fingerprint": "frozen-ledger", "markets": markets,
                  "sources": ["football-data.co.uk"], "origin": "frozen-ledger-import"}
        record["sha256"] = hist.seal(record)
        ledger["records"].append(record)
        added += 1
    if added:  # only on first import; afterwards the ledger is strictly append-only
        ledger["records"].sort(key=lambda r: (r["fixture"]["kickoff_utc"], r["match_id"], r["revision"]))
    return added


def fingerprint(results):
    digest = hashlib.sha256()
    for r in sorted(results, key=lambda r: (r["date"], r["home"])):
        digest.update(f"{r['date']}|{r['home']}|{r['away']}|{r['hg']}|{r['ag']}\n".encode())
    digest.update(json.dumps({**VERSIONS, "recommend": RULE_VERSION}, sort_keys=True).encode())
    return digest.hexdigest()[:16]


def run(out_dir, now, offline=False, fetchers=None):
    out_dir = Path(out_dir)
    data_dir = ROOT / "data"
    status = {"attempted_at": now.isoformat(), "season": SEASON, "sources": {}, "warnings": [], "errors": []}
    previous_status = read_json(out_dir / "pipeline_status.json", {})
    ledger = read_json(out_dir / "prediction_history.json", None) or hist.empty_ledger()
    shadow = read_json(out_dir / "shadow_history.json", None) or {**hist.empty_ledger(), "description": "Shadow challenger predictions; never displayed as predictions"}
    hist.verify(ledger)  # raises IntegrityError: nothing is written
    hist.verify(shadow)
    previous = read_json(out_dir / "fixtures.json", {}).get("fixtures", [])

    co_uk = load_co_uk(data_dir / "matches.json")
    fetchers = fetchers or {
        "football-data.org": lambda: fetch_football_data_org("PL", SEASON_START, SEASON),
        "openligadb": lambda: fetch_openligadb("PL", SEASON_START, SEASON),
        "openfootball": lambda: fetch_openfootball("PL", SEASON_LABEL, SEASON),
    }
    lists = []
    for name, fetch in fetchers.items():
        if offline:
            status["sources"][name] = {"ok": False, "label": SOURCE_LABELS[name], "note": "offline run"}
            continue
        matches, error = fetch()
        status["sources"][name] = {"ok": bool(matches), "label": SOURCE_LABELS[name], "matches": len(matches),
                                   "results": sum(1 for m in matches if m["score"]), "note": error}
        lists.append(matches)
    if not any(lists) and not previous:
        status["errors"].append("No fixture source responded and there is no previous schedule.")
    elif not any(lists):
        status["warnings"].append("No fixture source responded; keeping the previous schedule.")
        lists.append([{k: f[k] for k in ("competition", "season", "home", "away", "kickoff_utc", "status", "score")} | {"source": f["sources"][0] if f.get("sources") else "openfootball", "source_updated": None}
                      for f in previous if f.get("status") != "REMOVED_FROM_SCHEDULE"])
    lists.append(co_uk_as_matches(co_uk, SEASON))
    status["sources"]["football-data.co.uk"] = {"ok": True, "label": SOURCE_LABELS["football-data.co.uk"], "results": sum(r["season"] == SEASON for r in co_uk),
                                                 "latest_result": max(r["date"] for r in co_uk).isoformat()}
    fixtures = merge_fixtures(lists, previous, now) if any(lists) else previous

    # Training results: football-data.co.uk (with statistics) plus newer confirmed scores.
    known = {match_id("PL", r["season"], r["home"], r["away"]) for r in co_uk}
    epl = list(co_uk)
    for f in fixtures:
        if f["status"] == "FINISHED" and f["id"] not in known:
            kickoff = dt.datetime.fromisoformat(f["kickoff_utc"].replace("Z", "+00:00"))
            epl.append({"date": uk_date(kickoff), "competition": "PL", "season": f["season"], "home": f["home"], "away": f["away"],
                        "hg": f["score"][0], "ag": f["score"][1], "stats": None, "source": f["result_source"]})
    results = epl + championship_history()
    stats_latest = max(r["date"] for r in co_uk)
    if (now.date() - stats_latest).days > STATS_STALE_DAYS:
        status["warnings"].append(f"Match statistics (corners, cards, shots) end on {stats_latest.isoformat()}; those markets use older data.")

    promoted = promoted_by_season([r for r in epl], fixtures)
    frozen = {(r["date"], canonical(r["home"]), canonical(r["away"])): r for r in read_json(data_dir / "match_winner_forward.json", {"records": []})["records"]}
    as_of = uk_date(now)
    ctx = Context(results, as_of, promoted, frozen)
    reliability = read_json(data_dir / "model_reliability.json", {})
    evidence = evidence_from(reliability,
                             read_json(ROOT / "experiments" / "m064_promoted_hierarchy" / "results.json", {}))
    imported = import_frozen_ledgers(ledger, data_dir, now)
    fp = fingerprint(results)

    published, predictions = 0, {}
    horizon = now + dt.timedelta(days=HORIZON_DAYS)
    for f in fixtures:
        kickoff = dt.datetime.fromisoformat(f["kickoff_utc"].replace("Z", "+00:00"))
        if f["status"] != "SCHEDULED" or not now < kickoff <= horizon:
            continue
        fixture = {**f, "date": uk_date(kickoff)}
        markets = predict(fixture, ctx, evidence)
        recommendations = recommend(markets, reliability)
        if hist.publish(ledger, f, markets, fp, [s for s in f["sources"]], now, recommendations=recommendations):
            published += 1
        challenger = shadow_result(fixture, ctx)
        if challenger:
            hist.publish(shadow, f, challenger, fp, [s for s in f["sources"]], now, origin="shadow")
        latest = [r for r in ledger["records"] if r["match_id"] == f["id"]][-1]
        predictions[f["id"]] = {"match_id": f["id"], "record_id": latest["record_id"], "published_at": latest["published_at"],
                                "fixture": {k: f[k] for k in ("competition", "season", "home", "away", "kickoff_utc", "status", "kickoff_history")},
                                "promoted": [t for t in (f["home"], f["away"]) if t in promoted.get(f["season"], set())],
                                "markets": markets, "recommendations": latest.get("recommendations") or recommendations}

    stats_by_match = {match_id("PL", r["season"], r["home"], r["away"]): r["stats"] for r in co_uk}
    settled = hist.settle(ledger, fixtures, stats_by_match, now)
    hist.settle(shadow, fixtures, stats_by_match, now)
    hist.verify(ledger)
    hist.verify(shadow)

    odds_cache, odds_note = odds_feed.refresh(read_json(out_dir / "odds.json", {}), now) if not offline else (read_json(out_dir / "odds.json", {}), "offline run")
    status["sources"]["the-odds-api"] = {"ok": bool(odds_cache.get("matches")), "label": "The Odds API (free plan, UK bookmakers; Match Result and Total Goals only)",
                                         "matches": len(odds_cache.get("matches", {})), "note": odds_note,
                                         "credits_used_this_month": (odds_cache.get("credits") or {}).get("spent_by_month", {}).get(odds_feed.month_of(now), 0)}

    ok = not status["errors"]
    status.update({"ok": ok, "last_success": now.isoformat() if ok else previous_status.get("last_success"),
                   "fixtures": len(fixtures), "upcoming_predicted": len(predictions), "published_revisions": published,
                   "imported_frozen_records": imported, "settlement_updates": settled, "training_results": len(results),
                   "results_latest": max(r["date"] for r in epl).isoformat(), "model_versions": VERSIONS,
                   "attribution": "Fixtures and results: OpenLigaDB contributors (ODbL 1.0), openfootball (CC0), football-data.org where configured. Match statistics: football-data.co.uk."})
    if ok:
        write_json(out_dir / "fixtures.json", {"generated_at": now.isoformat(), "season": SEASON, "fixtures": fixtures})
        write_json(out_dir / "predictions.json", {"generated_at": now.isoformat(), "horizon_days": HORIZON_DAYS, "predictions": predictions})
        write_json(out_dir / "prediction_history.json", ledger)
        write_json(out_dir / "shadow_history.json", shadow)
        write_json(out_dir / "odds.json", odds_cache or {"fetched_at": None, "source": None, "matches": {}})
        write_json(out_dir / "performance.json", {"generated_at": now.isoformat(), **hist.performance(ledger),
                                                  "challenger": hist.compare_challenger(ledger, shadow)})
    write_json(out_dir / "pipeline_status.json", status)
    return status


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(ROOT / "data"))
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--now", help="ISO timestamp, for isolated test runs")
    args = parser.parse_args(argv)
    now = dt.datetime.fromisoformat(args.now.replace("Z", "+00:00")) if args.now else dt.datetime.now(dt.timezone.utc)
    try:
        status = run(args.out, now, offline=args.offline)
    except hist.IntegrityError as error:
        print("INTEGRITY FAILURE:", error, file=sys.stderr)
        return 2
    print(json.dumps({k: status[k] for k in ("ok", "fixtures", "upcoming_predicted", "published_revisions", "settlement_updates", "warnings", "errors")}, indent=1))
    return 0 if status["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
