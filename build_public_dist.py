"""Build isolated public-dist/ directory using an explicit allowlist.

Mission AG-037C Requirement:
Strictly include only public frontend files, assets, and verified data.
Exclude all internal research, candidate models, Python scripts, Git records,
tests, private ledgers, and virtual environments.
"""
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
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
    "match_winner_forward.json",
    "forward_test.json",
    "model_reliability.json",
    "fixtures.json",
    "predictions.json",
    "prediction_history.json",
    "performance.json",
    "pipeline_status.json"
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

    # 3. Data files
    for fname in ALLOWLIST_DATA:
        src = ROOT / "data" / fname
        if not src.exists():
            raise FileNotFoundError(f"Missing required data file: {fname}")
        shutil.copy2(src, DIST / "data" / fname)
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

    print("\nSecurity Audit: 100% PASS. Zero sensitive, Python, test, or experimental files present.")

if __name__ == "__main__":
    build()
