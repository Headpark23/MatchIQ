"""Private MatchIQ research: scheduled CSV refresh, maximum twice weekly."""
import csv
import datetime
import io
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / "data" / "matches.json"
SEASONS = ("2425", "2526", "2627")
CURRENT_SEASON = SEASONS[-1]
FIELDS = (
    "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR", "HC", "AC",
    "HY", "AY", "HST", "AST", "HS", "AS",
)


def build_refresh_metadata(previous, successful_rows, failures, refreshed_at):
    """Describe every season independently so old seasons cannot mask a current failure."""
    previous_status = {
        item.get("season"): item
        for item in previous.get("season_status", [])
        if isinstance(item, dict) and item.get("season")
    }
    statuses = []
    for season in SEASONS:
        old = previous_status.get(season, {})
        old_timestamp = old.get("last_successful_refresh")
        # Migrate the old single timestamp only for a previously successful current season.
        if not old_timestamp and season == CURRENT_SEASON and old:
            old_timestamp = previous.get("last_successful_refresh")
        if season in successful_rows:
            statuses.append({
                "season": season,
                "status": "updated",
                "rows": successful_rows[season],
                "last_successful_refresh": refreshed_at,
            })
        else:
            statuses.append({
                "season": season,
                "status": "unavailable",
                "rows": old.get("rows", 0),
                "last_successful_refresh": old_timestamp,
                "error": failures.get(season, "not updated"),
            })
    current = next(item for item in statuses if item["season"] == CURRENT_SEASON)
    return {
        "refresh_attempted_at": refreshed_at,
        "current_season": CURRENT_SEASON,
        "current_season_status": current,
        # Backward-compatible name, now explicitly tied to the current season.
        "last_successful_refresh": current.get("last_successful_refresh"),
        "historical_seasons_updated": [
            season for season in SEASONS[:-1] if season in successful_rows
        ],
        "season_status": statuses,
    }


def main():
    previous = json.loads(OUT.read_text()) if OUT.exists() else {}
    merged = {
        (row["season"], row["Date"], row["HomeTeam"], row["AwayTeam"]): row
        for row in previous.get("matches", [])
    }
    successful_rows = {}
    failures = {}
    errors = []
    refreshed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for season in SEASONS:
        try:
            url = "https://www.football-data.co.uk/mmz4281/" + season + "/E0.csv"
            request = urllib.request.Request(
                url, headers={"User-Agent": "MatchIQ-private-research/0.4"}
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                body = response.read().decode("utf-8-sig", errors="replace")
            records = list(csv.DictReader(io.StringIO(body)))
            if not records or not {"Date", "HomeTeam", "AwayTeam"}.issubset(records[0]):
                raise ValueError("Missing columns")
            count = 0
            for row in records:
                if not all(row.get(key) for key in ("Date", "HomeTeam", "AwayTeam")):
                    continue
                clean = {key: (row.get(key) or "").strip() for key in FIELDS}
                clean["season"] = season
                merged[(season, clean["Date"], clean["HomeTeam"], clean["AwayTeam"])] = clean
                count += 1
            successful_rows[season] = count
        except Exception as exc:
            message = str(exc)
            failures[season] = message
            errors.append({"season": season, "error": message})

    if not successful_rows:
        raise RuntimeError("No source succeeded; preserving existing data")

    fixtures = []
    fixture_updated = None
    try:
        request = urllib.request.Request(
            "https://www.football-data.co.uk/fixtures.csv",
            headers={"User-Agent": "MatchIQ-private-research/0.5"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            records = list(csv.DictReader(io.StringIO(
                response.read().decode("utf-8-sig", errors="replace")
            )))
        if not records or not {"Div", "Date", "HomeTeam", "AwayTeam"}.issubset(records[0]):
            raise ValueError("Fixture feed missing required columns")
        today = datetime.datetime.now(datetime.timezone.utc).date()
        for row in records:
            if (row.get("Div") or "").strip() != "E0":
                continue
            try:
                match_date = datetime.datetime.strptime(
                    (row.get("Date") or "").strip(), "%d/%m/%Y"
                ).date()
            except ValueError:
                try:
                    match_date = datetime.datetime.strptime(
                        (row.get("Date") or "").strip(), "%d/%m/%y"
                    ).date()
                except ValueError:
                    continue
            if not today <= match_date <= today + datetime.timedelta(days=35):
                continue
            if not row.get("HomeTeam") or not row.get("AwayTeam"):
                continue
            fixtures.append({
                "Date": match_date.isoformat(),
                "Time": (row.get("Time") or "").strip(),
                "HomeTeam": row["HomeTeam"].strip(),
                "AwayTeam": row["AwayTeam"].strip(),
            })
        fixture_updated = datetime.datetime.now(datetime.timezone.utc).isoformat()
    except Exception as exc:
        errors.append({"source": "fixtures", "error": str(exc)})
        # Preserve the last verified snapshot and its original timestamp.
        fixtures = previous.get("fixtures", [])
        fixture_updated = previous.get("fixtures_last_checked")

    metadata = build_refresh_metadata(
        previous, successful_rows, failures, refreshed_at
    )
    payload = {
        "fixtures": fixtures,
        "fixtures_last_checked": fixture_updated,
        "source": "football-data.co.uk",
        **metadata,
        "errors": errors,
        "matches": list(merged.values()),
    }
    OUT.parent.mkdir(exist_ok=True)
    temporary = OUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, separators=(",", ":")))
    temporary.replace(OUT)
    print(
        "Updated", len(merged), "records; current season",
        metadata["current_season_status"]["status"], "; failures", len(errors)
    )


if __name__ == "__main__":
    main()
