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
            "public_model": "dc-public-v1: Dixon-Coles per league trained on football-data.org scores only, validated chronologically on 2025-26. The original sealed research predictions and frozen models are private and are not shown or re-derived.",
            "attribution": PUBLIC_ATTRIBUTION}
