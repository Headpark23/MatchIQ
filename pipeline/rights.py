"""Public-display rights gate.

football-data.co.uk limits its data to private use and excludes automated scraping, and
states no licence. Match statistics (corners, yellow cards, shots on target) exist only
there, so every prediction for those markets is RESEARCH-ONLY: it stays in the private
ledgers and research files, and is never written to the public bundle. Match Result, Goals
and BTTS are trained on final scores only; scores are facts that the permitted
football-data.org API also supplies (see data/provenance_audit.json for the parity check),
so those markets stay public while the audit result is recorded.

Nothing here deletes or edits the private ledgers, frozen models or the Bet Diary: it
builds a filtered copy for the public bundle.
"""
import copy
import json

from .history import performance
from .recommend import recommend

RESTRICTED_MARKETS = ("corners", "cards", "shots")
PUBLIC_MARKETS = ("result", "goals", "btts")
PUBLIC_ATTRIBUTION = ("Fixtures and results: football-data.org, OpenLigaDB contributors (ODbL 1.0) and openfootball (CC0). "
                      "Bookmaker prices: The Odds API.")


def _strip(markets):
    return {k: v for k, v in markets.items() if k not in RESTRICTED_MARKETS}


def _drop_source_label(node):
    """Remove the restricted source's name from provenance lists (scores are facts the
    permitted API also supplies; the label would only advertise the research dataset)."""
    if isinstance(node, dict):
        return {k: _drop_source_label(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_drop_source_label(v) for v in node
                if v != "football-data.co.uk" and not (isinstance(v, dict) and v.get("source") == "football-data.co.uk")]
    if isinstance(node, str):
        return node.replace("football-data.co.uk", "a research-only source")
    return node


def public_fixtures(payload):
    return _drop_source_label(payload)


def public_prediction(pred, reliability, validation=None):
    out = copy.deepcopy(pred)
    out["markets"] = _strip(out["markets"])
    out["recommendations"] = recommend(out["markets"], reliability, validation)
    return out


def public_predictions(payload, reliability, league_validation):
    out = copy.deepcopy(payload)
    lv = (league_validation or {}).get("leagues", {})
    out["predictions"] = {k: public_prediction(p, reliability, lv.get(p["fixture"]["competition"]))
                          for k, p in payload["predictions"].items()}
    return out


def public_ledger(ledger, reliability, league_validation):
    lv = (league_validation or {}).get("leagues", {})
    out = copy.deepcopy(ledger)
    out["description"] = (ledger.get("description", "") + " PUBLIC VIEW: research-only markets removed; record hashes belong to the private, unfiltered ledger.").strip()
    for r in out["records"]:
        r["markets"] = _strip(r["markets"])
        s = r.get("settlement")
        if s:
            for k in RESTRICTED_MARKETS:
                s.pop(k, None)
            if s.get("most_likely", {}).get("market") in RESTRICTED_MARKETS:
                s.pop("most_likely")
        rec = r.get("recommendations")
        if rec and (rec.get("most_likely") or {}).get("market") in RESTRICTED_MARKETS:
            try:  # the sealed pick was a research-only market: show the best public one instead
                r["recommendations"] = recommend(r["markets"], reliability, lv.get(r["fixture"]["competition"]))
            except (TypeError, KeyError, StopIteration):  # older record shapes
                r["recommendations"] = {**rec, "most_likely": {"decision": "no_bet", "reason": "Research-only market withheld."}}
    return _drop_source_label(out)


def public_performance(public_ledger_, original):
    out = {"generated_at": original.get("generated_at"), **performance(public_ledger_)}
    if "challenger" in original:
        out["challenger"] = original["challenger"]
    return json.loads(json.dumps(out))


def public_reliability(rel):
    out = copy.deepcopy(rel)
    out["markets"] = {k: v for k, v in out.get("markets", {}).items() if k not in RESTRICTED_MARKETS}
    return out


def public_league_validation(lv):
    out = copy.deepcopy(lv)
    for league in out.get("leagues", {}).values():
        league["markets"] = _strip(league.get("markets", {}))
    return out


def public_status(status):
    out = copy.deepcopy(status)
    out["sources"] = {k: v for k, v in out.get("sources", {}).items() if "co.uk" not in k}
    out["warnings"] = [w for w in out.get("warnings", []) if "co.uk" not in w and "statistics" not in w.lower()]
    out["model_versions"] = {k: v for k, v in (out.get("model_versions") or {}).items() if not any(m in k for m in RESTRICTED_MARKETS)}
    out["attribution"] = PUBLIC_ATTRIBUTION
    return out


def rights_manifest():
    return {"withheld_markets": list(RESTRICTED_MARKETS), "public_markets": list(PUBLIC_MARKETS),
            "reason": "Corners, cards and shots depend on football-data.co.uk statistics, whose terms exclude public and automated use. They remain research-only.",
            "attribution": PUBLIC_ATTRIBUTION}
