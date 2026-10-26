"""Build isolated public-dist/ directory using an explicit allowlist.

Mission AG-037C Requirement:
Strictly include only public frontend files, assets, and verified data.
Exclude all internal research, candidate models, Python scripts, Git records,
tests, private ledgers, and virtual environments.
"""
import json
import os
import sys
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from pipeline import rights  # noqa: E402
DIST = ROOT / "public-dist"

# Explicit Allowlist: ONLY these files are permitted in public distribution
ALLOWLIST_FILES = [
    "index.html",
    "app.js",
    "styles.css",
    "market_calculations.js",
    "manifest.json",
    "sw.js",
    "vercel.json"
]

ALLOWLIST_ASSETS = [
    "icon-512.png",
    "icon-192.png",
    "apple-touch-icon.png",
    "favicon-32.png",
    "stadium_hero.jpg"
]

ALLOWLIST_DATA = [
    "model_reliability.json",
    "fixtures.json",
    "predictions.json",
    "prediction_history.json",
    "performance.json",
    "pipeline_status.json",
    "odds.json",
    "league_validation.json",
    "rights.json"
]

def build():
    # Clean previous contents of public-dist if present without removing the directory itself
    DIST.mkdir(parents=True, exist_ok=True)
    for item in DIST.iterdir():
        if item.is_file():
            item.unlink()
        elif item.is_dir():
            shutil.rmtree(item)
    (DIST / "assets").mkdir(parents=True, exist_ok=True)
    (DIST / "data").mkdir(parents=True, exist_ok=True)

    copied = []

    # 1. Root files
    for fname in ALLOWLIST_FILES:
        src = ROOT / fname
        if not src.exists():
            raise FileNotFoundError(f"Missing required public file: {fname}")
        shutil.copy2(src, DIST / fname)
        copied.append(fname)

    # 2. Assets
    for fname in ALLOWLIST_ASSETS:
        src = ROOT / "assets" / fname
        if not src.exists():
            raise FileNotFoundError(f"Missing required asset: {fname}")
        shutil.copy2(src, DIST / "assets" / fname)
        copied.append(f"assets/{fname}")

    # 3. Data files. Research-only markets (rights.py) are filtered out of every file that
    # carries them; the private files in data/ are never modified.
    read = lambda n: json.loads((ROOT / "data" / n).read_text(encoding="utf-8"))

    def read_public(name, fallback):
        path = ROOT / "data" / "public" / name
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback

    # Public predictions come ONLY from the public-derived pipeline (pipeline/public.py), which is
    # trained on permitted data. The private frozen-model predictions, sealed ledger and
    # reliability files are research artefacts and are never shipped, filtered or re-derived.
    from pipeline import history as hist
    public_ledger = read_public("prediction_history.json", None) or hist.empty_ledger()
    filtered = {
        "predictions.json": read_public("predictions.json", {"generated_at": None, "predictions": {}}),
        "prediction_history.json": public_ledger,
        "performance.json": read_public("performance.json", {"generated_at": None, **hist.performance(public_ledger)}),
        "model_reliability.json": {"public": True, "markets": {}, "note": "Frozen-model reliability is a private research artefact."},
        "league_validation.json": read_public("league_validation.json", {"leagues": {}}),
        "fixtures.json": rights.public_fixtures(read("fixtures.json")),
        "pipeline_status.json": rights.public_status(read("pipeline_status.json")),
        "rights.json": rights.rights_manifest(),
    }
    for fname in ALLOWLIST_DATA:
        dest = DIST / "data" / fname
        if fname in filtered:
            dest.write_text(json.dumps(filtered[fname], separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
        else:
            src = ROOT / "data" / fname
            if not src.exists():
                raise FileNotFoundError(f"Missing required data file: {fname}")
            shutil.copy2(src, dest)
        copied.append(f"data/{fname}")

    print(f"Successfully built isolated public-dist/ with {len(copied)} verified files:")
    for item in sorted(copied):
        size = (DIST / item).stat().st_size
        print(f"  + {item:30} ({size:,} bytes)")

    # Verification: Ensure no disallowed extensions exist in public-dist
    disallowed_extensions = {".py", ".pyc", ".csv", ".md", ".yml", ".yaml", ".log", ".tmp"}
    for p in DIST.rglob("*"):
        if p.is_file():
            if p.suffix.lower() in disallowed_extensions:
                raise AssertionError(f"Security violation! Disallowed file in public-dist: {p}")
            if any(part in {"experiments", "tests", ".venv", ".git"} for part in p.parts):
                raise AssertionError(f"Security violation! Sensitive directory in public-dist: {p}")

    for p in (DIST / "data").glob("*.json"):
        text = p.read_text(encoding="utf-8")
        for word in rights.RESTRICTED_MARKETS + ("football-data.co.uk",):
            if word in text and p.name != "rights.json":
                raise AssertionError(f"Rights violation: '{word}' found in public data file {p.name}")

    print("\nSecurity Audit: 100% PASS. Zero sensitive, Python, test, or experimental files present.")

if __name__ == "__main__":
    build()
