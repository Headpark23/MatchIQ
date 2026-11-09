"""Rights-compliant public modelling path.

The original frozen models, the pooled/promoted models and the sealed ledgers were trained
on football-data.co.uk data, whose terms exclude public and automated use, so they stay
PRIVATE research artefacts and are never replaced or edited. This module builds a separate,
public-derived pipeline from permitted sources only:

  * training data: final scores from the football-data.org API (data/public_results.json),
    plus confirmed results of the current season whose result source is a permitted source;
  * model: time-weighted Dixon-Coles per league, Premier League included (model version
    PUBLIC_MODEL_VERSION), for Match Result, Goals and BTTS only. No statistics exist from a
    permitted source, so corners, cards and shots are not modelled publicly;
  * validation: chronological weekly-refit walk-forward on 2025-26
    (data/public/league_validation.json);
  * records: a separate append-only ledger (data/public/prediction_history.json) whose record
    ids start with "PUB-" and whose origin is "public-derived". These are NOT the originally
    sealed predictions and are never presented as such.

    python -m pipeline.public --history      # football-data.org part needs FOOTBALL_DATA_ORG_TOKEN (18 free
                                             # requests); the openfootball (CC0) part for leagues.PUBLIC_ONLY needs none
    python -m pipeline.public --validate     # walk-forward backtest (slow)

pipeline.run then calls run_public() with the files above.
"""
import argparse
import copy
import datetime as dt
import hashlib
import json
import os
import sys
import time
from pathlib import Path

from . import history as hist
from . import internationals
from .data import uk_date
from .leagues import LEAGUES, PREDICTED, PUBLIC_ONLY
from .league_validation import validate_league
from .models import Context, predict
from .recommend import recommend
from .rights import RESTRICTED_MARKETS
from .sources import fetch_football_data_org, fetch_openfootball
from .teams import match_id

ROOT = Path(__file__).resolve().parents[1]
HISTORY_PATH = ROOT / "data" / "public_results.json"
# Past-season final scores for leagues.PUBLIC_ONLY, from openfootball (CC0 public domain).
OPENFOOTBALL_HISTORY_PATH = ROOT / "data" / "public_results_openfootball.json"
OPENFOOTBALL_SEASONS = (2023, 2024, 2025)
# A fixture whose kick-off time comes only from openfootball may carry a default time, so its
# prediction is sealed by the start of the UK match day: no revision is published on the day.
TIMED_SOURCES = {"football-data.org", "openligadb"}
PUBLIC_DIR = ROOT / "data" / "public"
PUBLIC_MODEL_VERSION = "dc-public-v1"
RECORD_PREFIX = "PUB-"
HISTORY_SEASONS = (2023, 2024, 2025)
PERMITTED_RESULT_SOURCES = {"football-data.org", "openligadb", "openfootball", internationals.SOURCE}
REFRESH_DAYS = 30


def season_label(start):
    return f"{start % 100:02d}{(start + 1) % 100:02d}"


def _row(code, label, m):
    kick = dt.datetime.fromisoformat(m["kickoff_utc"].replace("Z", "+00:00"))
    return {"c": code, "s": label, "d": uk_date(kick).isoformat(), "h": m["home"], "a": m["away"], "hg": m["score"][0], "ag": m["score"][1]}


def build_history(fetch=fetch_football_data_org, sleep=7, path=HISTORY_PATH):
    rows, notes = [], {}
    for code in LEAGUES:
        for start in HISTORY_SEASONS:
            label = season_label(start)
            matches, error = fetch(code, start, label)
            time.sleep(sleep)  # football-data.org: 10 requests/minute
            got = [_row(code, label, m) for m in matches if m["score"] and m["status"] == "FINISHED"]
            notes[f"{code}:{label}"] = {"rows": len(got), "error": error}
            rows += got
    if not rows:
        raise RuntimeError("no permitted history could be fetched: " + json.dumps(notes))
    path.write_text(json.dumps({"source": "football-data.org API (final scores only)", "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                                "notes": notes, "results": rows}, separators=(",", ":")) + "\n", encoding="utf-8")
    return notes


def build_openfootball_history(fetch=fetch_openfootball, path=OPENFOOTBALL_HISTORY_PATH):
    """Final scores of past seasons for leagues.PUBLIC_ONLY from openfootball (CC0, no key)."""
    rows, notes = [], {}
    for code in (c for c, m in PUBLIC_ONLY.items() if m.get("openfootball")):
        for start in OPENFOOTBALL_SEASONS:
            label = season_label(start)
            matches, error = fetch(code, f"{start}-{(start + 1) % 100:02d}", label)
            got = [_row(code, label, m) for m in matches if m["score"] and m["status"] == "FINISHED"]
            notes[f"{code}:{label}"] = {"rows": len(got), "error": error}
            rows += got
    if not rows:
        raise RuntimeError("no openfootball history could be fetched: " + json.dumps(notes))
    path.write_text(json.dumps({"source": "openfootball/football.json (CC0 public domain; final scores only)", "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                                "notes": notes, "results": rows}, separators=(",", ":")) + "\n", encoding="utf-8")
    return notes


def load_history(path=HISTORY_PATH, source="football-data.org"):
    try:
        items = json.loads(Path(path).read_text(encoding="utf-8"))["results"]
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return []
    return [{"competition": i["c"], "season": i["s"], "date": dt.date.fromisoformat(i["d"]), "home": i["h"], "away": i["a"],
             "hg": i["hg"], "ag": i["ag"], "stats": {}, "source": source} for i in items]


def load_all_history():
    """football-data.org history for LEAGUES, openfootball history for PUBLIC_ONLY leagues and
    martj42/international_results history for international competitions."""
    return (load_history() + [r for r in load_history(OPENFOOTBALL_HISTORY_PATH, "openfootball") if r["competition"] in PUBLIC_ONLY]
            + [r for r in load_history(internationals.HISTORY_PATH, internationals.SOURCE) if r["competition"] in internationals.INTERNATIONAL])


def permitted_result(f):
    """A confirmed result usable by the public path: adopted from a permitted source and never
    decided by a vote that involved a conflicting (possibly restricted) source."""
    return bool(f["status"] == "FINISHED" and f.get("score") and f.get("result_source") in PERMITTED_RESULT_SOURCES
                and not f.get("conflicting_scores"))


def public_fixtures(fixtures):
    """Fixtures as the public path may see them: a finished match whose result is not
    permitted-source is treated as awaiting its result, never as settled."""
    return [f if f["status"] != "FINISHED" or permitted_result(f) else {**f, "status": "AWAITING_RESULT", "score": None} for f in fixtures]


def training_rows(history, fixtures, season):
    """History plus confirmed current-season results from permitted sources only."""
    known = {match_id(r["competition"], r["season"], r["home"], r["away"]) for r in history}
    rows = list(history)
    for f in fixtures:
        if permitted_result(f) and f["season"] == season and f["id"] not in known:
            kick = dt.datetime.fromisoformat(f["kickoff_utc"].replace("Z", "+00:00"))
            rows.append({"date": uk_date(kick), "competition": f["competition"], "season": f["season"], "home": f["home"], "away": f["away"],
                         "hg": f["score"][0], "ag": f["score"][1], "stats": {}, "source": f["result_source"]})
    return rows


def validate(rows, path=PUBLIC_DIR / "league_validation.json"):
    report = {"generated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "model_version": PUBLIC_MODEL_VERSION,
              "method": "weekly refit walk-forward on football-data.org scores, Brier vs league average", "leagues": {}}
    for code in PREDICTED:
        v = validate_league(code, rows, lambda c, w: print(c, w, file=sys.stderr), public=True)
        v["markets"] = {k: m for k, m in v["markets"].items() if k not in RESTRICTED_MARKETS}
        report["leagues"][code] = v
    PUBLIC_DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
    return report


def evidence_tiers(validation):
    r = (validation or {}).get("markets", {}).get("result")
    name = (validation or {}).get("name", "this league")
    meta = PREDICTED.get((validation or {}).get("competition"), {})
    sample = meta.get("sample") or f"{name} matches"  # what the model is trained and tested on
    side = "team" if meta.get("international") else "club"
    if not r:
        return {"L1": {"strength": "none", "summary": f"The public {name} model has not been backtested yet."},
                "T3": {"strength": "none", "summary": f"Not enough data on one {side}, so this is the {name} average."}}
    why = "" if meta.get("international") else " (for example a newly promoted side)"
    return {"L1": {"strength": r["strength"], "summary": f"Backtest on {r['n']} {sample} ({validation['test_season_label']}): Brier {r['model_brier']:.3f} against {r['league_brier']:.3f} for the {'' if meta.get('international') else 'league '}average. A single-season test with no forward record yet, so provisional."},
            "T3": {"strength": "none", "summary": f"Not enough recent matches for one {side}{why}, so this is the {name} average. Limited evidence."}}


def _public_markets(markets):
    out = {k: copy.deepcopy(v) for k, v in markets.items() if k not in RESTRICTED_MARKETS}
    for m in out.values():
        m["model_version"] = PUBLIC_MODEL_VERSION
        m["derivation"] = "public-derived"
    return out


def fingerprint(rows):
    digest = hashlib.sha256(PUBLIC_MODEL_VERSION.encode())
    for r in sorted(rows, key=lambda r: (r["date"], r["home"], r["away"])):
        digest.update(f"{r['date']}|{r['home']}|{r['away']}|{r['hg']}|{r['ag']}".encode())
    return digest.hexdigest()[:16]


def empty_ledger():
    ledger = hist.empty_ledger()
    ledger["description"] = ("PUBLIC-DERIVED ledger (model " + PUBLIC_MODEL_VERSION + ", football-data.org scores only). Record ids start with "
                             + RECORD_PREFIX + ". These are not the originally sealed research predictions, which are private.")
    return ledger


def run_public(now, fixtures, season, horizon_days, history=None, validation=None, ledger=None, previous=None):
    """Returns (predictions_payload, ledger, performance). Writes nothing: the caller does.
    `previous` is the last published predictions mapping (match id -> entry)."""
    history = load_all_history() if history is None else history
    if validation is None:
        try:
            validation = json.loads((PUBLIC_DIR / "league_validation.json").read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            validation = {"leagues": {}}
    lv = validation.get("leagues", {})
    ledger = ledger or empty_ledger()
    hist.verify(ledger)
    fixtures = public_fixtures(fixtures)
    rows = training_rows(history, fixtures, season)
    assert all(r["source"] in PERMITTED_RESULT_SOURCES for r in rows), "restricted data reached the public training set"
    fp = fingerprint(rows)
    contexts, predictions = {}, {}
    horizon = now + dt.timedelta(days=horizon_days)
    for f in fixtures:
        kickoff = dt.datetime.fromisoformat(f["kickoff_utc"].replace("Z", "+00:00"))
        if f["status"] != "SCHEDULED" or not now < kickoff <= horizon or f["competition"] not in PREDICTED:
            continue
        code = f["competition"]
        existing = [r for r in ledger["records"] if r["match_id"] == f["id"]]
        if not set(f["sources"]) & TIMED_SOURCES and now >= seal_cutoff(kickoff):
            # Kick-off time unconfirmed: keep showing the prediction sealed before the match day.
            shown = (previous or {}).get(f["id"])
            if existing and shown and shown.get("record_id") == existing[-1]["record_id"]:
                predictions[f["id"]] = {**shown, "fixture": {k: f[k] for k in ("competition", "season", "home", "away", "kickoff_utc", "status", "kickoff_history")}}
            continue
        if code not in contexts:
            contexts[code] = Context([r for r in rows if r["competition"] == code], uk_date(now), competition=code,
                                     league_name=PREDICTED[code]["name"], validation=lv.get(code), public=True)
        markets = _public_markets(predict({**f, "date": uk_date(kickoff)}, contexts[code], evidence_tiers(lv.get(code))))
        recs = recommend(markets, None, lv.get(code))
        hist.publish(ledger, f, markets, fp, list(f["sources"]), now, origin="public-derived", recommendations=recs, record_prefix=RECORD_PREFIX)
        latest = [r for r in ledger["records"] if r["match_id"] == f["id"]][-1]
        predictions[f["id"]] = {"match_id": f["id"], "record_id": latest["record_id"], "published_at": latest["published_at"], "derivation": "public-derived",
                                "fixture": {k: f[k] for k in ("competition", "season", "home", "away", "kickoff_utc", "status", "kickoff_history")},
                                "promoted": [], "markets": markets, "recommendations": latest.get("recommendations") or recs}
    settled = hist.settle(ledger, fixtures, {}, now)
    hist.verify(ledger)
    perf = {"generated_at": now.isoformat(), **hist.performance(ledger), "settlement_updates": settled}
    payload = {"generated_at": now.isoformat(), "horizon_days": horizon_days, "model_version": PUBLIC_MODEL_VERSION, "predictions": predictions}
    return payload, ledger, perf


def seal_cutoff(kickoff):
    """Start of the UK calendar day of the kick-off, as a UTC datetime."""
    from zoneinfo import ZoneInfo
    uk = ZoneInfo("Europe/London")
    day = kickoff.astimezone(uk).date()
    return dt.datetime.combine(day, dt.time(0, 0), uk).astimezone(dt.timezone.utc)


def missing_validation(path=PUBLIC_DIR / "league_validation.json"):
    """True when a predicted league has no entry in the public validation report."""
    try:
        have = json.loads(Path(path).read_text(encoding="utf-8")).get("leagues", {})
    except (FileNotFoundError, json.JSONDecodeError):
        return True
    return bool(set(PREDICTED) - set(have))


def stale(path):
    """True when the file is missing or its own generated_at is older than REFRESH_DAYS
    (file mtimes are meaningless on a fresh CI checkout)."""
    try:
        made = dt.datetime.fromisoformat(json.loads(Path(path).read_text(encoding="utf-8"))["generated_at"])
        return (dt.datetime.now(dt.timezone.utc) - made).days >= REFRESH_DAYS
    except (FileNotFoundError, json.JSONDecodeError, KeyError, ValueError):
        return True


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--history", action="store_true")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--if-stale", action="store_true", help="only when the file is missing or older than 30 days")
    args = parser.parse_args(argv)
    if args.history and (not args.if_stale or stale(HISTORY_PATH)):
        if not os.environ.get("FOOTBALL_DATA_ORG_TOKEN"):
            print("skipped: FOOTBALL_DATA_ORG_TOKEN not set")
        else:
            print(json.dumps(build_history()))
    if args.history and (not args.if_stale or stale(OPENFOOTBALL_HISTORY_PATH)):
        print(json.dumps(build_openfootball_history()))
    if args.history and (not args.if_stale or stale(internationals.HISTORY_PATH)):
        try:
            print(json.dumps(internationals.build_history()))
        except RuntimeError as error:  # keep the stored copy; the refresh must not fail on this
            print(f"international history not refreshed: {error}")
    if args.validate and (not args.if_stale or stale(PUBLIC_DIR / "league_validation.json") or missing_validation()):
        rows = load_all_history()
        if not rows:
            print("skipped: no public history yet")
        else:
            validate(rows)


if __name__ == "__main__":
    sys.exit(main())
