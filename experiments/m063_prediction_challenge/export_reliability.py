"""Export backtest reliability of the *frozen production* models for the website.

Reads results.json from challenge.py and writes data/model_reliability.json. It never
changes a prediction: it only describes how the frozen models performed out of sample,
so the interface can say "Limited evidence" instead of implying confidence.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MIN_BAND_N = 30


def band_bounds(label):
    lo, hi = label.rstrip("%").split("-")
    return int(lo) / 100, (int(hi) / 100 if int(hi) < 100 else 1.0001)


def summarise(market, model):
    entry = market["models"][model]
    base = market["models"].get("base_rate", {})
    beats_base = "brier" in base and entry["brier"] < base["brier"]
    return {
        "model": model,
        "n": entry["n"],
        "brier": entry["brier"],
        "logloss": entry["logloss"],
        **({"rps": entry["rps"]} if "rps" in entry else {}),
        "league_average_brier": base.get("brier"),
        "beats_league_average": beats_base,
        "bands": [{**band, "lo": band_bounds(band["band"])[0], "hi": band_bounds(band["band"])[1],
                   "established": band["n"] >= MIN_BAND_N}
                  for band in entry["reliability_top_pick"]],
    }


def main():
    results = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    markets = results["markets"]
    window = markets["1x2"]["date_range"]
    out = {
        "source": "experiments/m063_prediction_challenge (walk-forward, prior-day data only)",
        "generated_at": results["generated_at"],
        "window": window,
        "min_band_n": MIN_BAND_N,
        "markets": {
            "wins": summarise(markets["1x2"], "dc_frozen"),
            "corners": summarise(markets["corners"], "rolling10"),
            "goals": summarise(markets["over25"], "rolling10"),
            "btts": summarise(markets["btts"], "rolling10"),
            "cards": summarise(markets["cards"], "rolling10"),
            "shots": summarise(markets["shots"], "rolling10"),
        },
    }
    out["markets"]["wins"]["market_close_brier"] = markets["1x2"]["models"]["market_close"]["brier"]
    target = ROOT / "data" / "model_reliability.json"
    target.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print("wrote", target)


if __name__ == "__main__":
    main()
