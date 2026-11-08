"""Move hand-written and back-dated records out of the sealed prediction ledgers.

scripts/settle_chelsea_and_update_all_results.py (commit ef6b4ae, 31 Oct 2026) appended 42
"predictions" for competitions that had no model at the time (League One, League Two, the
Scottish leagues, Eredivisie, Primeira Liga and the Champions League). They were typed in by
hand: fixed probabilities, an "evidence: validated/strong" label, publish times back-dated to
10:00 on match day, and outcomes set by hand (five of them contradict the real scores). They
all carry inputs_fingerprint "league-model-import", which no pipeline code produces.

scripts/populate_all_leagues_full_history.py (commit 4ab0ed8, 31 Oct 2026 17:36) then added 111
more records (inputs_fingerprint "b35b9a3d37c2a170") after those matches had finished, with
published_at set to four hours before each kick-off. 105 were produced by the public model; the
six Belgian ones had hand-chosen picks and results. None was sealed before its kick-off.

The same script also typed 25 match scores by hand and stamped them onto genuine pipeline
predictions as confirmed results (result.confirmed_at "2026-10-31T17:25:00+00:00", labelled
football-data.org). Many differ from the real scores, and the ledger never overwrites a
result once set, so genuine predictions were being scored against invented results. Those
results are voided here (kept under "voided_result" on the record); the next pipeline run
settles the records again from the real sources.

Neither set of records is a genuine pre-kick-off prediction, so neither may count towards the public record.
This script removes them from the ledgers and keeps an exact copy, with the reason, in
data/quarantine/fabricated_records.json (private: not in the public bundle allowlist), so the
step is reversible and auditable. It also drops two Belgian fixtures injected the same way
(Belgium has no permitted source). Performance summaries are recomputed from what remains.

    python scripts/quarantine_fabricated_records.py
"""
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline import history as hist  # noqa: E402
from pipeline import public  # noqa: E402
from pipeline.data import load_co_uk  # noqa: E402
from pipeline.leagues import load_results  # noqa: E402
from pipeline.teams import match_id  # noqa: E402

DATA = ROOT / "data"
FINGERPRINTS = {
    "league-model-import": ("Hand-written by scripts/settle_chelsea_and_update_all_results.py (commit ef6b4ae): fixed probabilities, "
                            "back-dated publish time and hand-set outcomes for competitions with no model. Not a genuine sealed prediction."),
    "b35b9a3d37c2a170": ("Back-filled by scripts/populate_all_leagues_full_history.py (commit 4ab0ed8) after the match had finished, with "
                         "published_at set to kick-off minus 4 hours (Belgian records also had hand-chosen picks). Not sealed before kick-off."),
}
FABRICATED_CONFIRMATION = "2026-10-31T17:25:00+00:00"
INJECTED_FIXTURES = {"B1-2627-royal-antwerp-v-club-brugge", "B1-2627-anderlecht-v-krc-genk"}
REASON = "Records that were not sealed before kick-off by the pipeline; see quarantine_reason on each record."


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def main():
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    qpath = DATA / "quarantine" / "fabricated_records.json"
    quarantine = read(qpath) if qpath.exists() else {"description": REASON, "ledgers": {}, "fixtures": []}
    fixtures_now = read(DATA / "fixtures.json")["fixtures"]
    stats = {match_id("PL", r["season"], r["home"], r["away"]): r["stats"] for r in load_co_uk(DATA / "matches.json")}
    stats.update({match_id(r["competition"], r["season"], r["home"], r["away"]): r["stats"] for r in load_results()})
    settle_inputs = {"prediction_history.json": (fixtures_now, stats),
                     "public/prediction_history.json": (public.public_fixtures(fixtures_now), {})}
    for rel, perf_rel in (("prediction_history.json", "performance.json"),
                          ("public/prediction_history.json", "public/performance.json")):
        path = DATA / rel
        ledger = read(path)
        hist.verify(ledger)
        bad = [r for r in ledger["records"] if r.get("inputs_fingerprint") in FINGERPRINTS]
        voided = 0
        for r in ledger["records"]:
            if r.get("inputs_fingerprint") not in FINGERPRINTS and (r.get("result") or {}).get("confirmed_at") == FABRICATED_CONFIRMATION:
                r["voided_result"] = {k: r.pop(k) for k in ("result", "settlement", "evaluated", "result_disputed") if k in r}
                r["voided_result"].update({"voided_at": now, "reason": "Score typed by hand by scripts/populate_all_leagues_full_history.py (commit 4ab0ed8); re-settled from the real sources."})
                voided += 1
        if not bad and not voided:
            print(f"{rel}: nothing to quarantine")
            continue
        print(f"{rel}: voided {voided} hand-typed results")
        ledger["records"] = [r for r in ledger["records"] if r.get("inputs_fingerprint") not in FINGERPRINTS]
        # Re-settle from the confirmed results the pipeline already holds (same rules as pipeline.run).
        fx, st = settle_inputs[rel]
        print(f"{rel}: {hist.settle(ledger, fx, st, dt.datetime.now(dt.timezone.utc))} settlement updates from real results")
        hist.verify(ledger)
        quarantine["ledgers"].setdefault(rel, []).extend({**r, "quarantined_at": now, "quarantine_reason": FINGERPRINTS[r["inputs_fingerprint"]]} for r in bad)
        write(path, ledger)
        perf_path = DATA / perf_rel
        old = read(perf_path) if perf_path.exists() else {}
        keep = {k: old[k] for k in ("challenger", "settlement_updates") if k in old}
        write(perf_path, {"generated_at": old.get("generated_at", now), **hist.performance(ledger), **keep})
        print(f"{rel}: quarantined {len(bad)} records; {perf_rel} recomputed")
    fx_path = DATA / "fixtures.json"
    fixtures = read(fx_path)
    gone = [f for f in fixtures["fixtures"] if f["id"] in INJECTED_FIXTURES]
    if gone:
        fixtures["fixtures"] = [f for f in fixtures["fixtures"] if f["id"] not in INJECTED_FIXTURES]
        quarantine["fixtures"].extend({**f, "quarantined_at": now} for f in gone)
        write(fx_path, fixtures)
        print(f"fixtures.json: removed {len(gone)} injected fixtures")
    write(qpath, quarantine)


if __name__ == "__main__":
    main()
