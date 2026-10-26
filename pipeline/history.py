"""Append-only prediction history, settlement and performance summaries.

Rules:
- A prediction is only ever published before kickoff.
- Published fields are sealed with a SHA-256 hash. Every run verifies every hash and
  refuses to write if any sealed record changed.
- A new revision is appended (never edited) when the model inputs change before
  kickoff; the old one gets `superseded_by`. The revision evaluated is the last one
  published before the actual kickoff.
- Results and settlement live in separate, unsealed fields added once the result is
  confirmed by a source.
"""
import datetime as dt
import hashlib
import json
import math
from collections import defaultdict

SEALED = ("record_id", "match_id", "revision", "fixture", "published_at", "inputs_fingerprint", "markets", "sources", "origin")
# Added in Mission 065. Sealed when present, so earlier records keep their original hash.
SEALED_OPTIONAL = ("recommendations",)
BAND_EDGES = (0.0, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0001)
MIN_REPORT_N = 20


class IntegrityError(RuntimeError):
    pass


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def seal(record):
    payload = {k: record.get(k) for k in SEALED}
    payload.update({k: record[k] for k in SEALED_OPTIONAL if k in record})
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def verify(ledger):
    for record in ledger["records"]:
        if seal(record) != record.get("sha256"):
            raise IntegrityError(f"Sealed prediction {record.get('record_id')} was modified; refusing to write history.")
    return True


def empty_ledger():
    return {"version": 1, "description": "MatchIQ append-only pre-match prediction history", "records": []}


def _parse(ts):
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))


def compact_markets(markets):
    """The evaluable part of each market: version, evidence, pick and every probability."""
    out = {}
    for key, m in markets.items():
        if m.get("unavailable"):
            out[key] = {"unavailable": True}
            continue
        entry = {"model_version": m["model_version"], "evidence": {"status": m["evidence"]["status"], "strength": m["evidence"]["strength"]},
                 "pick": {k: m["pick"][k] for k in ("key", "label", "p", "fair_odds", "line") if k in m["pick"]}}
        if "tier" in m:
            entry["tier"] = m["tier"]
        if "selections" in m:
            entry["selections"] = [{k: s[k] for k in ("key", "label", "p", "fair_odds")} for s in m["selections"]]
        if "lines" in m:
            entry["lines"] = [{"line": l["line"], "over": l["over"]["p"], "over_fair_odds": l["over"]["fair_odds"],
                               "under_fair_odds": l["under"]["fair_odds"]} for l in m["lines"]]
        out[key] = entry
    return out


def publish(ledger, fixture, markets, inputs_fingerprint, sources, now, origin="pipeline", recommendations=None):
    """Append a revision if the fixture has not kicked off and inputs changed."""
    if _parse(fixture["kickoff_utc"]) <= now:
        return None
    existing = [r for r in ledger["records"] if r["match_id"] == fixture["id"]]
    latest = existing[-1] if existing else None
    if latest and latest["inputs_fingerprint"] == inputs_fingerprint and latest["fixture"]["kickoff_utc"] == fixture["kickoff_utc"]:
        return None
    record = {"record_id": f"{fixture['id']}#r{len(existing) + 1}", "match_id": fixture["id"], "revision": len(existing) + 1,
              "fixture": {k: fixture[k] for k in ("competition", "season", "home", "away", "kickoff_utc")},
              "published_at": now.isoformat(), "inputs_fingerprint": inputs_fingerprint,
              "markets": compact_markets(markets), "sources": sources, "origin": origin}
    if recommendations is not None:
        record["recommendations"] = recommendations
    record["sha256"] = seal(record)
    if latest:
        latest["superseded_by"] = record["record_id"]
    ledger["records"].append(record)
    return record


def _scores_1x2(p, y):
    p = [min(max(x, 1e-12), 1) for x in p]
    total = sum(p)
    p = [x / total for x in p]
    o = [1.0 if i == y else 0.0 for i in range(3)]
    cum = lambda v: [v[0], v[0] + v[1]]
    return {"brier": sum((a - b) ** 2 for a, b in zip(p, o)), "logloss": -math.log(p[y]),
            "rps": sum((a - b) ** 2 for a, b in zip(cum(p), cum(o))) / 2}


def _binary(p, y):
    p = min(max(p, 1e-12), 1 - 1e-12)
    return {"brier": (p - y) ** 2, "logloss": -(y * math.log(p) + (1 - y) * math.log(1 - p))}


def settle_record(record, score, stats):
    hg, ag = score
    y = 0 if hg > ag else 1 if hg == ag else 2
    out = {}
    m = record["markets"].get("result")
    if m and not m.get("unavailable"):
        p = [s["p"] for s in m["selections"]]
        out["result"] = {"outcome": "HDA"[y], "pick_won": m["pick"]["key"] == "HDA"[y], **_scores_1x2(p, y)}
    totals = {"goals": hg + ag}
    for market, (hf, af) in {"corners": ("HC", "AC"), "cards": ("HY", "AY"), "shots": ("HST", "AST")}.items():
        if stats and stats.get(hf) is not None and stats.get(af) is not None:
            totals[market] = stats[hf] + stats[af]
    for market in ("goals", "corners", "cards", "shots"):
        m = record["markets"].get(market)
        if not m or m.get("unavailable"):
            continue
        if market not in totals:
            out[market] = {"pending": "match statistics not yet available"}
            continue
        line = m["pick"]["line"]
        main = next(l for l in m["lines"] if l["line"] == line)
        over = int(totals[market] > line)
        out[market] = {"total": totals[market], "line": line, "pick_won": (m["pick"]["key"] == "over") == bool(over),
                       **_binary(main["over"], over)}
    m = record["markets"].get("btts")
    if m and not m.get("unavailable"):
        yes = int(hg > 0 and ag > 0)
        p_yes = next(s["p"] for s in m["selections"] if s["key"] == "yes")
        out["btts"] = {"outcome": "yes" if yes else "no", "pick_won": (m["pick"]["key"] == "yes") == bool(yes), **_binary(p_yes, yes)}
    most = (record.get("recommendations") or {}).get("most_likely") or {}
    if most.get("decision") == "most_likely":
        won = selection_won(most["market"], most["key"], most.get("line"), score, totals)
        if won is None:
            out["most_likely"] = {"pending": "match statistics not yet available"}
        else:
            y = int(won)
            out["most_likely"] = {"market": most["market"], "label": most["label"], "p": most["p"], "won": won, **_binary(most["p"], y)}
    for v in out.values():
        for k in ("brier", "logloss", "rps"):
            if k in v:
                v[k] = round(v[k], 5)
    return out


def selection_won(market, key, line, score, totals):
    """Did one selection win? None when the statistic is not yet known."""
    hg, ag = score
    if market == "result":
        return key == ("H" if hg > ag else "A" if ag > hg else "D")
    if market == "btts":
        return (key == "yes") == (hg > 0 and ag > 0)
    total = totals.get(market)
    if total is None:
        return None
    return (key == "over") == (total > line)


def settle(ledger, fixtures, stats_by_match, now):
    """Attach confirmed results. Only the last revision published before the actual
    kickoff is evaluated; earlier revisions are marked as not evaluated."""
    by_match = defaultdict(list)
    for r in ledger["records"]:
        by_match[r["match_id"]].append(r)
    changed = 0
    for fixture in fixtures:
        records = by_match.get(fixture["id"])
        if not records:
            continue
        if fixture["status"] == "FINISHED" and fixture.get("score"):
            kickoff = _parse(fixture["kickoff_utc"])
            eligible = [r for r in records if _parse(r["published_at"]) < kickoff]
            final = eligible[-1] if eligible else None
            for r in records:
                result = {"score": fixture["score"], "source": fixture.get("result_source"), "kickoff_utc": fixture["kickoff_utc"]}
                if r.get("result", {}).get("score") not in (None, fixture["score"]):
                    r["result_disputed"] = {"previous": r["result"], "new": result, "seen_at": now.isoformat()}
                    continue
                stats = stats_by_match.get(fixture["id"])
                needs = r is final and (not r.get("settlement") or any("pending" in v for v in r["settlement"].values()))
                if "result" not in r:
                    r["result"] = {**result, "confirmed_at": now.isoformat()}
                    changed += 1
                if needs:
                    r["settlement"] = settle_record(r, fixture["score"], stats)
                    r["evaluated"] = True
                    changed += 1
                elif r is not final:
                    r["evaluated"] = False
        elif fixture["status"] in ("POSTPONED", "CANCELLED", "REMOVED_FROM_SCHEDULE"):
            for r in records:
                if r.get("fixture_status") != fixture["status"]:
                    r["fixture_status"] = fixture["status"]
                    changed += 1
    return changed


def _band(p):
    for lo, hi in zip(BAND_EDGES[:-1], BAND_EDGES[1:]):
        if lo <= p < hi:
            return f"{int(lo * 100)}-{min(100, int(hi * 100))}%"
    return "?"


def performance(ledger):
    """Premier League summaries in the established top-level keys, plus the same summary for
    every other competition under `by_competition` (leagues are never pooled)."""
    records = ledger["records"]
    main = _performance([r for r in records if r["fixture"]["competition"] == "PL"], records)
    others = sorted({r["fixture"]["competition"] for r in records} - {"PL"})
    main["by_competition"] = {c: _performance([r for r in records if r["fixture"]["competition"] == c], records) for c in others}
    return main


def _performance(records, all_records=None):
    """Summaries from evaluated records only. Groups below MIN_REPORT_N are flagged."""
    groups = defaultdict(list)
    timeline = []
    for r in records:
        if not r.get("evaluated"):
            continue
        for market, s in (r.get("settlement") or {}).items():
            if "brier" not in s or market not in r["markets"]:
                continue
            m = r["markets"][market]
            row = {"brier": s["brier"], "logloss": s["logloss"], "won": s["pick_won"], "p": m["pick"]["p"]}
            groups[("market", market)].append(row)
            groups[("band", market, _band(m["pick"]["p"]))].append(row)
            groups[("version", market, m["model_version"])].append(row)
            if market == "result":
                groups[("tier", m.get("tier", "T1"))].append(row)
                for team in (r["fixture"]["home"], r["fixture"]["away"]):
                    groups[("team", team)].append(row)
                timeline.append({"kickoff_utc": r["fixture"]["kickoff_utc"], "won": s["pick_won"], "brier": s["brier"]})

    def summary(rows):
        return {"n": len(rows), "brier": round(sum(x["brier"] for x in rows) / len(rows), 4),
                "logloss": round(sum(x["logloss"] for x in rows) / len(rows), 4),
                "pick_hit_rate": round(sum(x["won"] for x in rows) / len(rows), 4),
                "mean_pick_p": round(sum(x["p"] for x in rows) / len(rows), 4),
                "sufficient_sample": len(rows) >= MIN_REPORT_N}

    out = {"min_report_n": MIN_REPORT_N, "markets": {}, "bands": defaultdict(dict), "versions": defaultdict(dict), "tiers": {}, "teams": {}}
    for key, rows in groups.items():
        if key[0] == "market":
            out["markets"][key[1]] = summary(rows)
        elif key[0] == "band":
            out["bands"][key[1]][key[2]] = summary(rows)
        elif key[0] == "version":
            out["versions"][key[1]][key[2]] = summary(rows)
        elif key[0] == "tier":
            out["tiers"][key[1]] = summary(rows)
        elif key[0] == "team":
            out["teams"][key[1]] = summary(rows)
    timeline.sort(key=lambda x: x["kickoff_utc"])
    out["result_timeline"] = timeline
    most_rows, most_by_market, decisions = [], defaultdict(list), defaultdict(int)
    for r in records:
        if not r.get("evaluated"):
            continue
        rec = r.get("recommendations") or {}
        for kind in ("most_likely", "best_value"):
            if rec.get(kind):
                decisions[kind + ":" + rec[kind]["decision"]] += 1
        s = (r.get("settlement") or {}).get("most_likely")
        if s and "won" in s:
            row = {"brier": s["brier"], "logloss": s["logloss"], "won": s["won"], "p": s["p"]}
            most_rows.append(row)
            most_by_market[s["market"]].append(row)
    out["most_likely"] = summary(most_rows) if most_rows else {"n": 0, "sufficient_sample": False}
    out["most_likely_by_market"] = {k: summary(v) for k, v in most_by_market.items()}
    out["decisions"] = dict(decisions)
    out["evaluated_matches"] = len({r["match_id"] for r in records if r.get("evaluated")})
    out["published_records"] = len(records)
    return json.loads(json.dumps(out))


PROMOTION_MIN_N = 150


def compare_challenger(production, shadow, seed=64, resamples=2000):
    """Paired comparison on matches evaluated in both ledgers. Recommends promotion only
    when n >= PROMOTION_MIN_N and the 95% CI of the Brier difference is below zero.
    It never switches models itself: promotion is a reviewed code change, and the
    previous version stays pinned for rollback."""
    import random
    prod = {r["match_id"]: r["settlement"]["result"]["brier"] for r in production["records"]
            if r.get("evaluated") and "result" in (r.get("settlement") or {}) and r["markets"]["result"].get("tier") == "T1"}
    pairs = [(r["fixture"]["kickoff_utc"][:10], r["settlement"]["result"]["brier"] - prod[r["match_id"]]) for r in shadow["records"]
             if r.get("evaluated") and r["match_id"] in prod and "result" in (r.get("settlement") or {})]
    out = {"challenger": "dc-decay-epl-v1-shadow", "production": "dixon-coles-v1-forward-frozen", "n": len(pairs),
           "min_n_for_promotion": PROMOTION_MIN_N}
    if not pairs:
        return {**out, "recommendation": "Collecting evidence: no settled matches yet."}
    mean = sum(d for _, d in pairs) / len(pairs)
    blocks = defaultdict(list)
    for day, d in pairs:
        blocks[day].append(d)
    blocks = list(blocks.values())
    rng = random.Random(seed)
    means = []
    for _ in range(resamples):
        pick = [rng.choice(blocks) for _ in blocks]
        means.append(sum(sum(b) for b in pick) / sum(len(b) for b in pick))
    means.sort()
    ci = [round(means[int(0.025 * resamples)], 5), round(means[int(0.975 * resamples) - 1], 5)]
    out.update({"delta_brier": round(mean, 5), "delta_brier_ci95": ci})
    if len(pairs) < PROMOTION_MIN_N:
        out["recommendation"] = f"Collecting evidence: {len(pairs)} of {PROMOTION_MIN_N} settled matches needed before any recommendation."
    elif ci[1] < 0:
        out["recommendation"] = "Challenger is better with 95% confidence. Recommend owner review for promotion."
    else:
        out["recommendation"] = "Keep production: the challenger is not reliably better."
    return out
