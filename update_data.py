"""Private MatchIQ research: scheduled CSV refresh, maximum twice weekly."""
import csv
import datetime as dt
import io
import json
import math
import pathlib
import urllib.request
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / "data" / "matches.json"
SEASONS = ("2425", "2526", "2627")
CURRENT_SEASON = SEASONS[-1]
PUBLICATION_GRACE = dt.timedelta(hours=48)
UTC = dt.timezone.utc
FIELDS = (
    "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR", "HC", "AC",
    "HY", "AY", "HST", "AST", "HS", "AS",
)

try:
    from zoneinfo import ZoneInfo
    UK_ZONE = ZoneInfo("Europe/London")
except Exception:
    class _LondonZone(dt.tzinfo):
        """Fallback UK timezone (GMT / BST) when standard tzdata package is absent on Windows."""
        def utcoffset(self, d):
            return dt.timedelta(hours=1) if self._is_dst(d) else dt.timedelta(0)

        def dst(self, d):
            return dt.timedelta(hours=1) if self._is_dst(d) else dt.timedelta(0)

        def tzname(self, d):
            return "BST" if self._is_dst(d) else "GMT"

        def _is_dst(self, d):
            if d is None:
                return False
            year = d.year
            march_last = dt.datetime(year, 3, 31, 1, 0, tzinfo=dt.timezone.utc)
            march_sunday = march_last - dt.timedelta(days=(march_last.weekday() + 1) % 7)
            oct_last = dt.datetime(year, 10, 31, 1, 0, tzinfo=dt.timezone.utc)
            oct_sunday = oct_last - dt.timedelta(days=(oct_last.weekday() + 1) % 7)
            if d.tzinfo is not None:
                utc_d = dt.datetime(d.year, d.month, d.day, d.hour, d.minute, d.second, d.microsecond, tzinfo=dt.timezone.utc) - (dt.timedelta(hours=1) if (march_sunday.date() <= d.date() <= oct_sunday.date()) else dt.timedelta(0))
                return march_sunday <= utc_d < oct_sunday
            return False

    UK_ZONE = _LondonZone()

# Exactly 20 Premier League member clubs for the current 2627 season:
CURRENT_SEASON_TEAMS = frozenset({
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
    "Chelsea", "Coventry", "Crystal Palace", "Everton", "Fulham",
    "Hull", "Ipswich", "Leeds", "Liverpool", "Man City",
    "Man United", "Newcastle", "Nott'm Forest", "Sunderland", "Tottenham",
})
DEFAULT_PREDICTION_HORIZON_DAYS = 14


def parse_date(value):
    """Parse the date formats used in the result and fixture CSVs."""
    if not isinstance(value, str):
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def parse_kickoff(day, time_val):
    """Parse local UK kickoff time string and return timezone-aware UTC datetime.

    Rejects:
    1. Malformed, non-string, or out-of-range hours (0-23) or minutes (0-59).
    2. Nonexistent local times due to the spring clock change (e.g. 01:30 on 29 March 2026).
    3. Ambiguous local times due to the autumn clock change (e.g. 01:30 on 25 October 2026).
    """
    if not isinstance(day, dt.date) or not isinstance(time_val, str):
        return None
    time_str = time_val.strip()
    parts = time_str.split(":")
    if len(parts) != 2:
        return None
    try:
        hour, minute = int(parts[0]), int(parts[1])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return None
    except (ValueError, TypeError):
        return None

    local_naive = dt.datetime.combine(day, dt.time(hour, minute))
    year = day.year

    # 1. Try standard zoneinfo if tzdata is available on host
    try:
        from zoneinfo import ZoneInfo
        zone = ZoneInfo("Europe/London")
        t0 = local_naive.replace(tzinfo=zone, fold=0)
        t1 = local_naive.replace(tzinfo=zone, fold=1)
        # Ambiguous time check: fold=0 and fold=1 produce different UTC moments
        if t0.astimezone(UTC) != t1.astimezone(UTC):
            return None
        # Nonexistent time check: round-trip fails to recover the input local time
        roundtrip = t0.astimezone(UTC).astimezone(zone).replace(tzinfo=None)
        if roundtrip != local_naive:
            return None
        return t0.astimezone(UTC)
    except Exception:
        # 2. Standalone mathematical UK transition check (Summer Time Act 2002 / IANA rules)
        # Transitions occur at 01:00 UTC on the last Sunday in March (GMT -> BST)
        # and last Sunday in October (BST -> GMT).
        march_last = dt.datetime(year, 3, 31, 1, 0, tzinfo=UTC)
        march_sun_utc = march_last - dt.timedelta(days=(march_last.weekday() + 1) % 7)
        oct_last = dt.datetime(year, 10, 31, 1, 0, tzinfo=UTC)
        oct_sun_utc = oct_last - dt.timedelta(days=(oct_last.weekday() + 1) % 7)

        def to_uk_local(u):
            if march_sun_utc <= u < oct_sun_utc:
                return u + dt.timedelta(hours=1)
            return u

        # Candidate 1: assuming GMT (UTC offset +0)
        utc1 = local_naive.replace(tzinfo=UTC)
        match1 = (to_uk_local(utc1).replace(tzinfo=None) == local_naive)

        # Candidate 2: assuming BST (UTC offset +1)
        utc2 = (local_naive - dt.timedelta(hours=1)).replace(tzinfo=UTC)
        match2 = (to_uk_local(utc2).replace(tzinfo=None) == local_naive)

        valid_utcs = []
        if match1:
            valid_utcs.append(utc1)
        if match2 and utc2 not in valid_utcs:
            valid_utcs.append(utc2)

        # Exactly 1 valid UTC instant must map to this local time.
        # If 0 matches: nonexistent local time (spring gap) -> None
        # If >1 matches: ambiguous local time (autumn overlap) -> None
        if len(valid_utcs) != 1:
            return None
        return valid_utcs[0]


def parse_season_csv(body, season):
    """Parse a season CSV without assuming that its rows are current or complete."""
    reader = csv.DictReader(io.StringIO(body))
    required = {"Date", "HomeTeam", "AwayTeam"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise ValueError("Missing required match columns")
    records = []
    for row in reader:
        if not all((row.get(key) or "").strip() for key in required):
            continue
        clean = {key: (row.get(key) or "").strip() for key in FIELDS}
        clean["season"] = season
        records.append(clean)
    if not records:
        raise ValueError("No usable match rows")
    return records


def fixture_key(row):
    """Return a normalized date/home/away key, or None for incomplete identity."""
    day = parse_date(row.get("Date", row.get("date", "")))
    home = (row.get("HomeTeam", row.get("home", "")) or "").strip()
    away = (row.get("AwayTeam", row.get("away", "")) or "").strip()
    if not day or not home or not away:
        return None
    return day.isoformat(), home, away


def _past_publication_grace(row, now, grace_period):
    """Use fixture date only; start grace at the next UTC midnight, after the full local match date."""
    day = parse_date(row.get("Date", row.get("date", "")))
    if not day:
        return None
    next_day = day + dt.timedelta(days=1)
    deadline = dt.datetime.combine(next_day, dt.time.min, UTC) + grace_period
    return now >= deadline


def _valid_integer(value, minimum, maximum):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number) and number.is_integer() and minimum <= number <= maximum


def _valid_result(row):
    if not (_valid_integer(row.get("FTHG"), 0, 30)
            and _valid_integer(row.get("FTAG"), 0, 30)):
        return False
    home_goals, away_goals = int(float(row["FTHG"])), int(float(row["FTAG"]))
    expected = "H" if home_goals > away_goals else "A" if away_goals > home_goals else "D"
    return (row.get("FTR") or "").strip().upper() == expected


def _valid_corners(row):
    return _valid_integer(row.get("HC"), 0, 40) and _valid_integer(row.get("AC"), 0, 40)


def _expected_record(row):
    key = fixture_key(row)
    if key is None:
        raise ValueError("Expected fixture must have a date and both team names")
    return {
        "Date": key[0],
        "Time": (row.get("Time", row.get("time", "")) or "").strip(),
        "HomeTeam": key[1],
        "AwayTeam": key[2],
    }


def parse_fixture_schedule_csv(
    body, reference_time, horizon_days=DEFAULT_PREDICTION_HORIZON_DAYS, valid_teams=None
):
    """Parse candidate fixtures enforcing eligibility, team identity and horizon boundaries.

    Prediction Horizon Justification:
    Both production prediction models (forward_test.py line 77 and match_winner_forward.py line 60)
    explicitly enforce: now < kickoff <= now + dt.timedelta(days=14).
    This 14-day window aligns candidate fixtures in data["fixtures"] with model requirements:
    1. Statistical stability: Pre-match Poisson corners and Dixon-Coles goal expectation models rely on rolling
       10-match team form and sample statistics. Projecting beyond 14 days exposes predictions to intervening
       match outcomes that would invalidate pre-match assumptions.
    2. Schedule volatility: Premier League fixtures scheduled beyond 14 days are subject to broadcast selection
       shifts, cup rearrangements, and postponements without timely notice.
    3. Downstream compliance: Both frozen downstream prediction scripts reject any fixture where
       kickoff > now + 14 days. Admitting them to data["fixtures"] adds no predictive value while increasing
       exposure to schedule churn.
    """
    if isinstance(reference_time, dt.datetime):
        if reference_time.tzinfo is None:
            raise ValueError("reference_time must be timezone-aware if datetime")
        now = reference_time.astimezone(UTC)
        today = now.date()
        horizon_limit = now + dt.timedelta(days=horizon_days)
    elif isinstance(reference_time, dt.date):
        today = reference_time
        now = dt.datetime.combine(today, dt.time.min, UTC)
        horizon_limit = dt.datetime.combine(today + dt.timedelta(days=horizon_days), dt.time.max, UTC)
    else:
        raise ValueError("reference_time must be a date or datetime")

    teams_set = CURRENT_SEASON_TEAMS if valid_teams is None else frozenset(valid_teams)
    reader = csv.DictReader(io.StringIO(body))
    required = {"Div", "Date", "HomeTeam", "AwayTeam"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise ValueError("Fixture feed missing required columns")

    records = list(reader)
    candidate_fixtures = []
    raw_e0_fixture_count = 0
    invalid_window_fixture_count = 0
    past_kickoff_count = 0
    beyond_horizon_count = 0
    duplicate_fixture_count = 0
    conflicting_fixture_count = 0
    unknown_team_count = 0
    malformed_fixture_count = 0

    seen_matchups = set()
    team_scheduled_dates = defaultdict(list)

    for row in records:
        div = (row.get("Div") or "").strip()
        if div != "E0":
            continue
        raw_e0_fixture_count += 1

        day = parse_date((row.get("Date") or "").strip())
        if not day:
            invalid_window_fixture_count += 1
            malformed_fixture_count += 1
            continue

        home = (row.get("HomeTeam") or "").strip()
        away = (row.get("AwayTeam") or "").strip()
        if not home or not away:
            invalid_window_fixture_count += 1
            malformed_fixture_count += 1
            continue

        if home == away:
            invalid_window_fixture_count += 1
            conflicting_fixture_count += 1
            continue

        if home not in teams_set or away not in teams_set:
            invalid_window_fixture_count += 1
            unknown_team_count += 1
            continue

        raw_time = (row.get("Time") or "").strip()
        kickoff = parse_kickoff(day, raw_time)
        if kickoff is None:
            invalid_window_fixture_count += 1
            malformed_fixture_count += 1
            continue

        matchup_key = (day.isoformat(), home, away)
        if matchup_key in seen_matchups:
            invalid_window_fixture_count += 1
            duplicate_fixture_count += 1
            continue
        seen_matchups.add(matchup_key)

        if day in team_scheduled_dates[home] or day in team_scheduled_dates[away]:
            invalid_window_fixture_count += 1
            conflicting_fixture_count += 1
            continue
        team_scheduled_dates[home].append(day)
        team_scheduled_dates[away].append(day)

        if kickoff <= now:
            # Exclude past kickoffs (Requirement 4)
            past_kickoff_count += 1
            continue

        if kickoff > horizon_limit:
            # Outside approved prediction horizon (Requirement 3)
            beyond_horizon_count += 1
            continue

        candidate_fixtures.append({
            "Date": day.isoformat(),
            "Time": raw_time,
            "HomeTeam": home,
            "AwayTeam": away,
        })

    # FAIL CLOSED RULE (Requirement 7):
    # When the provider returns corrupted or conflicting evidence, fail closed
    # rather than silently accepting a partial clean subset.
    if invalid_window_fixture_count > 0:
        fixtures = []
        schedule_status = "incomplete"
    elif not candidate_fixtures:
        fixtures = []
        schedule_status = "no_fixtures_supplied"
    else:
        fixtures = candidate_fixtures
        # Fixtures were found, but football-data.co.uk provides no independent
        # attestation of round completeness; coverage remains unverifiable.
        schedule_status = "unverifiable"

    feed_status = "available"
    evidence = {
        "source": "football-data.co.uk/fixtures.csv",
        "feed_status": feed_status,
        "schedule_status": schedule_status,
        "source_record_count": len(records),
        "window_fixture_count": len(fixtures),
        "raw_e0_fixture_count": raw_e0_fixture_count,
        "invalid_window_fixture_count": invalid_window_fixture_count,
        "past_kickoff_count": past_kickoff_count,
        "beyond_horizon_count": beyond_horizon_count,
        "duplicate_fixture_count": duplicate_fixture_count,
        "conflicting_fixture_count": conflicting_fixture_count,
        "unknown_team_count": unknown_team_count,
        "malformed_fixture_count": malformed_fixture_count,
        "off_season_confirmed": False,
        "off_season_status": "not_indicated" if fixtures else "unconfirmed",
        "completeness_attested": False,
        "completeness_source": None,
        "horizon_days": horizon_days,
        "independently_confirmed": False,
    }
    return fixtures, evidence


def assess_current_season_freshness(
    match_rows, fixtures, pending_fixtures, now, previous_freshness_status=None,
    duplicate_keys=None, grace_period=PUBLICATION_GRACE, schedule_evidence=None,
):
    """Validate known completed fixtures independently of fixture schedule availability."""
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    now = now.astimezone(UTC)
    duplicate_keys = set(duplicate_keys or ())
    fixture_rows = list(fixtures or [])
    pending_rows = list(pending_fixtures or [])
    rows_by_key = defaultdict(list)
    for row in match_rows:
        key = fixture_key(row)
        if key:
            rows_by_key[key].append(row)

    schedule_keys = {key for row in fixture_rows if (key := fixture_key(row))}
    invalid_schedule_count = sum(1 for row in fixture_rows if fixture_key(row) is None)
    if schedule_evidence is None:
        # Direct callers can use the supplied known schedule/pending list as evidence.
        inferred_count = len(schedule_keys) or len({
            key for row in pending_rows if (key := fixture_key(row))
        })
        feed_status = "available" if inferred_count else "empty"
        current_window_count = inferred_count
        raw_e0_fixture_count = inferred_count
        source_record_count = inferred_count
        invalid_window_count = invalid_schedule_count
        off_season_status = "not_indicated" if inferred_count else "unconfirmed"
        off_season_confirmed = False
        completeness_attested = False
        completeness_source = None
    else:
        feed_status = schedule_evidence.get("feed_status", "unavailable")
        current_window_count = schedule_evidence.get("window_fixture_count", 0)
        raw_e0_fixture_count = schedule_evidence.get("raw_e0_fixture_count", current_window_count)
        source_record_count = schedule_evidence.get("source_record_count", raw_e0_fixture_count)
        invalid_window_count = schedule_evidence.get(
            "invalid_window_fixture_count", invalid_schedule_count
        )
        off_season_status = schedule_evidence.get("off_season_status", "unconfirmed")
        off_season_confirmed = schedule_evidence.get("off_season_confirmed", False) is True
        completeness_source = schedule_evidence.get("completeness_source")
        completeness_attested = (
            schedule_evidence.get("completeness_attested") is True
            and isinstance(completeness_source, str)
            and bool(completeness_source.strip())
        )

    # Determine explicit schedule verification status:
    if feed_status == "failed":
        schedule_status = "failed"
    elif invalid_window_count > 0:
        schedule_status = "incomplete"
    elif current_window_count == 0 or feed_status == "empty":
        schedule_status = "no_fixtures_supplied"
    elif completeness_attested:
        schedule_status = "verified"
    else:
        schedule_status = "unverifiable"

    schedule_credible = feed_status == "available" and current_window_count > 0 and invalid_window_count == 0

    expected = {}
    result_unverifiable = []
    schedule_unverifiable = []
    for row in pending_rows + fixture_rows:
        key = fixture_key(row)
        if not key:
            schedule_unverifiable.append("Fixture schedule contains an incomplete date/team identity.")
            continue
        day = parse_date(row.get("Date", row.get("date", "")))
        already_pending = row in pending_rows
        # A same-day fixture may still be upcoming; defer its first check until tomorrow.
        if already_pending or (day and day < now.date()):
            expected[key] = _expected_record(row)

    missing_scores = []
    missing_statistics = []
    duplicate_fixtures = []
    pending = []
    score_beyond_grace = score_within_grace = False
    statistics_beyond_grace = statistics_within_grace = False
    verified_score_count = verified_statistics_count = 0

    for key, fixture in expected.items():
        matches = rows_by_key.get(key, [])
        duplicate = key in duplicate_keys or len(matches) > 1
        if duplicate:
            duplicate_fixtures.append(fixture)
            pending.append(fixture)
            score_issue = statistics_issue = True
        else:
            row = matches[0] if matches else None
            score_ok = bool(row) and _valid_result(row)
            statistics_ok = bool(row) and _valid_corners(row)
            if score_ok:
                verified_score_count += 1
            else:
                missing_scores.append(fixture)
            if statistics_ok:
                verified_statistics_count += 1
            else:
                missing_statistics.append(fixture)
            score_issue = not score_ok
            statistics_issue = not statistics_ok
            if score_issue or statistics_issue:
                pending.append(fixture)

        past_grace = _past_publication_grace(fixture, now, grace_period)
        if past_grace is None:
            result_unverifiable.append(
                f"Cannot apply the publication grace period to {key[1]}–{key[2]} on {key[0]}."
            )
        elif score_issue:
            if past_grace:
                score_beyond_grace = True
            else:
                score_within_grace = True
        if past_grace is not None and statistics_issue:
            if past_grace:
                statistics_beyond_grace = True
            else:
                statistics_within_grace = True

    if not schedule_credible:
        if feed_status == "failed":
            schedule_unverifiable.append("Fixture schedule refresh failed; current schedule coverage is unavailable.")
        elif current_window_count == 0:
            schedule_unverifiable.append(
                "Fixture feed returned 0 in-window fixtures; genuine off-season status is unconfirmed."
            )
        else:
            schedule_unverifiable.append(
                "No credible in-window fixture schedule is available; genuine off-season status is unconfirmed."
            )
    if not expected:
        result_unverifiable.append("No completed fixture is available to verify current result coverage.")

    def result_category_status(beyond_grace, within_grace, verified_count):
        if result_unverifiable:
            return "unverifiable"
        if beyond_grace:
            return "stale"
        if within_grace:
            return "awaiting_publication"
        if expected and verified_count == len(expected):
            return "verified"
        return "unverifiable"

    result_status = result_category_status(
        score_beyond_grace, score_within_grace, verified_score_count
    )
    statistics_status = result_category_status(
        statistics_beyond_grace, statistics_within_grace, verified_statistics_count
    )

    if result_unverifiable:
        known_fixture_status = "unverifiable"
    elif score_beyond_grace or statistics_beyond_grace:
        known_fixture_status = "stale"
    elif score_within_grace or statistics_within_grace:
        known_fixture_status = "awaiting_publication"
    elif expected and verified_score_count == len(expected) and verified_statistics_count == len(expected):
        known_fixture_status = "verified"
    else:
        known_fixture_status = "unverifiable"
        result_unverifiable.append("The available fixture evidence does not establish complete result coverage.")

    completeness_basis_verified = (
        completeness_attested
        and schedule_credible
        and bool(expected)
        and invalid_window_count == 0
    )
    coverage_completeness_status = (
        "verified" if completeness_basis_verified else "unverifiable"
    )

    overall_status = "verified" if (known_fixture_status == "verified" and completeness_basis_verified) else "unverifiable"

    result_verified_new = bool(expected) and result_status == "verified"
    statistics_verified_new = bool(expected) and statistics_status == "verified"
    verified_new = overall_status == "verified" and bool(expected)

    # Explicit pipeline states:
    if result_status == "verified":
        if schedule_status == "verified" and completeness_basis_verified:
            pipeline_state = "verified_results_with_verified_fixtures"
        elif schedule_status == "no_fixtures_supplied":
            pipeline_state = "verified_results_with_no_fixtures"
        else:
            pipeline_state = "verified_results_with_unverifiable_schedule"
    elif result_status == "stale":
        pipeline_state = "results_stale"
    elif result_status == "awaiting_publication":
        pipeline_state = "results_awaiting_publication"
    else:
        pipeline_state = "results_unverifiable"

    warnings = []
    if missing_scores:
        warnings.append(f"{len(missing_scores)} expected completed fixture(s) lack a validated final score/result.")
    if missing_statistics:
        warnings.append(f"{len(missing_statistics)} expected completed fixture(s) lack complete corner totals.")
    if duplicate_fixtures:
        warnings.append(f"{len(duplicate_fixtures)} expected fixture(s) have duplicate or conflicting result rows.")
    if pending:
        warnings.append(
            "Pending fixtures use Date/HomeTeam/AwayTeam identity; reschedule reconciliation is unavailable without a stable provider fixture ID."
        )
    if known_fixture_status == "awaiting_publication":
        warnings.append("Results are within the conservative 48-hour publication grace period, measured from the next UTC midnight after the fixture date.")
    if known_fixture_status == "stale":
        warnings.append("Expected completed results/statistics remain missing beyond the 48-hour publication grace period, measured from the next UTC midnight after the fixture date.")
    if not completeness_basis_verified:
        warnings.append(
            "Comprehensive freshness is UNVERIFIABLE because no authoritative fixture-completeness basis is available; result/statistics statuses cover known expected fixtures only."
        )
    warnings.extend(result_unverifiable)
    warnings.extend(schedule_unverifiable)
    coverage_evidence = {
        "schedule_source": (schedule_evidence or {}).get("source", "fixture schedule input"),
        "schedule_feed_status": feed_status,
        "schedule_status": schedule_status,
        "pipeline_state": pipeline_state,
        "source_record_count": source_record_count,
        "current_window_fixture_count": current_window_count,
        "raw_e0_fixture_count": raw_e0_fixture_count,
        "valid_schedule_fixture_count": len(schedule_keys),
        "invalid_window_fixture_count": invalid_window_count,
        "expected_completed_fixture_count": len(expected),
        "verified_score_count": verified_score_count,
        "verified_statistics_count": verified_statistics_count,
        "off_season_confirmed": off_season_confirmed,
        "off_season_status": off_season_status,
        "schedule_completeness": (
            "independently_attested" if completeness_attested
            else "not_independently_attested"
        ),
        "completeness_source": completeness_source,
        "fixture_identity_fields": ["Date", "HomeTeam", "AwayTeam"],
        "reschedule_reconciliation": "unavailable_without_stable_provider_fixture_id",
    }
    return {
        "status": overall_status,
        "known_fixture_status": known_fixture_status,
        "coverage_completeness_status": coverage_completeness_status,
        "schedule_status": schedule_status,
        "pipeline_state": pipeline_state,
        "result_freshness_status": result_status,
        "statistics_freshness_status": statistics_status,
        "result_verified_new": result_verified_new,
        "statistics_verified_new": statistics_verified_new,
        "verified_new": verified_new,
        "coverage_evidence": coverage_evidence,
        "pending_fixtures": pending,
        "missing_scores": missing_scores,
        "missing_statistics": missing_statistics,
        "duplicate_fixtures": duplicate_fixtures,
        "warnings": warnings,
    }


def build_refresh_metadata(previous, successful_rows, failures, refreshed_at, freshness=None, attempted_at=None, last_download_at=None):
    """Keep download success separate from validated result coverage."""
    previous_status = {
        item.get("season"): item
        for item in previous.get("season_status", [])
        if isinstance(item, dict) and item.get("season")
    }
    old_current = previous.get("current_season_status", {})
    if not isinstance(old_current, dict):
        old_current = {}
    old_status_current = previous_status.get(CURRENT_SEASON, {})
    old_timestamp = (
        old_status_current.get("last_freshness_verified_at")
        or (old_status_current.get("last_successful_refresh")
            if old_status_current.get("freshness_status") == "verified" else None)
        or old_current.get("last_freshness_verified_at")
        or (old_current.get("last_successful_refresh")
            if old_current.get("freshness_status") == "verified" else None)
    )
    old_result_timestamp = (
        old_current.get("last_result_verified_at")
        or old_status_current.get("last_result_verified_at")
        or old_current.get("last_successful_refresh")
        or old_status_current.get("last_successful_refresh")
        or old_timestamp
    )
    old_statistics_timestamp = (
        old_current.get("last_statistics_verified_at")
        or old_status_current.get("last_statistics_verified_at")
        or old_current.get("last_successful_refresh")
        or old_status_current.get("last_successful_refresh")
        or old_timestamp
    )
    legacy_unverified_refresh_at = previous.get("legacy_unverified_refresh_at")
    if not legacy_unverified_refresh_at and not old_timestamp:
        legacy_unverified_refresh_at = (
            previous.get("last_successful_refresh")
            or old_current.get("last_successful_refresh")
            or old_status_current.get("last_successful_refresh")
        )
    statuses = []
    for season in SEASONS:
        old = previous_status.get(season, {})
        season_timestamp = old.get("last_successful_refresh")
        if season == CURRENT_SEASON:
            season_timestamp = old_result_timestamp
        if season in successful_rows:
            status = {
                "season": season,
                "status": "updated",
                "rows": successful_rows[season],
                "last_successful_refresh": refreshed_at,
            }
            if season == CURRENT_SEASON:
                freshness = freshness or {
                    "status": "unverifiable",
                    "known_fixture_status": "unverifiable",
                    "coverage_completeness_status": "unverifiable",
                    "schedule_status": "unverifiable",
                    "pipeline_state": "results_unverifiable",
                    "verified_new": False,
                    "result_verified_new": False,
                    "statistics_verified_new": False,
                    "result_freshness_status": "unverifiable",
                    "statistics_freshness_status": "unverifiable",
                    "coverage_evidence": {},
                    "warnings": ["Result freshness was not assessed; download success alone does not verify current results."],
                }
                freshness_status = freshness.get("status", "unverifiable")
                known_fixture_status = freshness.get("known_fixture_status", freshness_status)
                coverage_completeness_status = freshness.get(
                    "coverage_completeness_status", "unverifiable"
                )
                schedule_status = freshness.get("schedule_status", "unverifiable")
                pipeline_state = freshness.get("pipeline_state")
                verified_new = (
                    freshness.get("verified_new") is True
                    and freshness_status == "verified"
                    and coverage_completeness_status == "verified"
                )
                if freshness_status == "verified" and not verified_new:
                    freshness_status = "unverifiable"
                result_status = freshness.get("result_freshness_status", freshness_status)
                statistics_status = freshness.get("statistics_freshness_status", freshness_status)
                result_verified_new = freshness.get("result_verified_new") is True and result_status == "verified"
                statistics_verified_new = freshness.get("statistics_verified_new") is True and statistics_status == "verified"
                if result_status == "verified" and not result_verified_new:
                    result_status = "unverifiable"
                if statistics_status == "verified" and not statistics_verified_new:
                    statistics_status = "unverifiable"
                last_verified = refreshed_at if verified_new else old_timestamp
                last_result_verified = refreshed_at if result_verified_new else old_result_timestamp
                last_statistics_verified = refreshed_at if statistics_verified_new else old_statistics_timestamp

                # Decoupled freshness:
                # If completed-match results are verified and newly confirmed this run:
                # season data is updated!
                results_verified = (
                    result_status == "verified"
                    and result_verified_new
                    and known_fixture_status == "verified"
                )
                if results_verified:
                    current_status = "updated"
                    current_refresh_timestamp = refreshed_at
                else:
                    current_status = "unavailable"
                    current_refresh_timestamp = old_result_timestamp

                if not pipeline_state:
                    if result_status == "verified" and result_verified_new:
                        if coverage_completeness_status == "verified" and schedule_status == "verified":
                            pipeline_state = "verified_results_with_verified_fixtures"
                        elif schedule_status == "no_fixtures_supplied":
                            pipeline_state = "verified_results_with_no_fixtures"
                        else:
                            pipeline_state = "verified_results_with_unverifiable_schedule"
                    elif result_status == "stale":
                        pipeline_state = "results_stale"
                    elif result_status == "awaiting_publication":
                        pipeline_state = "results_awaiting_publication"
                    else:
                        pipeline_state = "results_unverifiable"

                status.update({
                    "status": current_status,
                    "download_status": "success",
                    "pipeline_state": pipeline_state,
                    "freshness_status": freshness_status,
                    "known_fixture_status": known_fixture_status,
                    "coverage_completeness_status": coverage_completeness_status,
                    "schedule_status": schedule_status,
                    "verified_new": verified_new,
                    "result_verified_new": result_verified_new,
                    "statistics_verified_new": statistics_verified_new,
                    "result_freshness_status": result_status,
                    "statistics_freshness_status": statistics_status,
                    "last_result_verified_at": last_result_verified,
                    "last_statistics_verified_at": last_statistics_verified,
                    "coverage_evidence": freshness.get("coverage_evidence", {}),
                    "last_download_at": last_download_at or refreshed_at,
                    "freshness_checked_at": refreshed_at,
                    "provider_published_at": None,
                    "last_successful_refresh": current_refresh_timestamp,
                    "last_freshness_verified_at": last_verified,
                    "freshness_warnings": freshness.get("warnings", []),
                })
            statuses.append(status)
        else:
            unavailable = {
                "season": season,
                "status": "unavailable",
                "rows": old.get("rows", old_current.get("rows", 0) if season == CURRENT_SEASON else 0),
                "last_successful_refresh": season_timestamp,
                "error": failures.get(season, "not updated"),
            }
            if season == CURRENT_SEASON:
                failed_freshness_status = freshness.get("status", "unverifiable") if freshness else "unverifiable"
                failed_known_fixture_status = freshness.get("known_fixture_status", failed_freshness_status) if freshness else "unverifiable"
                failed_completeness_status = freshness.get("coverage_completeness_status", "unverifiable") if freshness else "unverifiable"
                failed_result_status = freshness.get("result_freshness_status", "unverifiable") if freshness else "unverifiable"
                failed_statistics_status = freshness.get("statistics_freshness_status", "unverifiable") if freshness else "unverifiable"
                if failed_freshness_status == "verified":
                    failed_freshness_status = "unverifiable"
                if failed_result_status == "verified":
                    failed_result_status = "unverifiable"
                if failed_statistics_status == "verified":
                    failed_statistics_status = "unverifiable"
                unavailable.update({
                    "download_status": "failed",
                    "pipeline_state": "results_download_failed",
                    "freshness_status": failed_freshness_status,
                    "known_fixture_status": failed_known_fixture_status,
                    "coverage_completeness_status": failed_completeness_status,
                    "schedule_status": "unavailable",
                    "verified_new": False,
                    "result_verified_new": False,
                    "statistics_verified_new": False,
                    "result_freshness_status": failed_result_status,
                    "statistics_freshness_status": failed_statistics_status,
                    "last_result_verified_at": old_result_timestamp,
                    "last_statistics_verified_at": old_statistics_timestamp,
                    "coverage_evidence": freshness.get("coverage_evidence", {}) if freshness else {},
                    "freshness_warnings": freshness.get("warnings", []) if freshness else [],
                    "freshness_checked_at": refreshed_at,
                    "last_freshness_verified_at": old_timestamp,
                    "last_download_at": None,
                    "provider_published_at": None,
                })
            statuses.append(unavailable)
    current = next(item for item in statuses if item["season"] == CURRENT_SEASON)
    historical_updated = [season for season in SEASONS[:-1] if season in successful_rows]
    return {
        "refresh_attempted_at": attempted_at or refreshed_at,
        "current_season": CURRENT_SEASON,
        "current_season_status": current,
        "pipeline_state": current.get("pipeline_state", "results_unverifiable"),
        # Last known verified result time, never raw download time
        "last_successful_refresh": current.get("last_successful_refresh"),
        "legacy_unverified_refresh_at": legacy_unverified_refresh_at,
        "historical_seasons_updated": historical_updated,
        "season_status": statuses,
    }


def main():
    previous = json.loads(OUT.read_text()) if OUT.exists() else {}
    merged = {
        (row.get("season"), row.get("Date"), row.get("HomeTeam"), row.get("AwayTeam")): row
        for row in previous.get("matches", [])
        if all(row.get(key) for key in ("season", "Date", "HomeTeam", "AwayTeam"))
    }
    successful_rows = {}
    failures = {}
    errors = []
    refresh_attempted_at = dt.datetime.now(UTC).isoformat()
    current_downloaded_at = None
    current_csv_rows = []
    duplicate_keys = set()

    for season in SEASONS:
        try:
            url = "https://www.football-data.co.uk/mmz4281/" + season + "/E0.csv"
            request = urllib.request.Request(
                url, headers={"User-Agent": "MatchIQ-private-research/0.4"}
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                body_bytes = response.read()
                retrieved_at = dt.datetime.now(UTC).isoformat()
            body = body_bytes.decode("utf-8-sig", errors="replace")
            records = parse_season_csv(body, season)
            if season == CURRENT_SEASON:
                current_downloaded_at = retrieved_at
                current_csv_rows = records
            successful_rows[season] = len(records)
            if season == CURRENT_SEASON:
                key_counts = Counter(fixture_key(row) for row in records if fixture_key(row))
                duplicate_keys = {key for key, count in key_counts.items() if count > 1}
            for row in records:
                key = (season, row["Date"], row["HomeTeam"], row["AwayTeam"])
                normalized_key = fixture_key(row)
                if season == CURRENT_SEASON and normalized_key in duplicate_keys:
                    # Do not overwrite a previously stored row with ambiguous provider duplicates.
                    continue
                existing = merged.get(key)
                if season == CURRENT_SEASON and existing:
                    # Empty fields in a later snapshot must not erase a previously present result/stat.
                    merged[key] = {
                        field: row.get(field) or existing.get(field, "")
                        for field in set(existing) | set(row)
                    }
                else:
                    merged[key] = row
        except Exception as exc:
            message = str(exc)
            failures[season] = message
            errors.append({"season": season, "error": message})

    if not successful_rows:
        raise RuntimeError("No source succeeded; preserving existing data")

    fixtures = []
    fixture_updated = None
    fixture_error = None
    schedule_evidence = {
        "feed_status": "unavailable",
        "window_fixture_count": 0,
        "raw_e0_fixture_count": 0,
        "invalid_window_fixture_count": 0,
        "off_season_confirmed": False,
        "off_season_status": "unconfirmed",
    }
    try:
        request = urllib.request.Request(
            "https://www.football-data.co.uk/fixtures.csv",
            headers={"User-Agent": "MatchIQ-private-research/0.5"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8-sig", errors="replace")
        download_now = dt.datetime.now(UTC)
        fixtures, schedule_evidence = parse_fixture_schedule_csv(
            body, download_now
        )
        if fixtures and schedule_evidence.get("invalid_window_fixture_count", 0) == 0:
            fixture_updated = download_now.isoformat()
        else:
            # Empty feed or incomplete/corrupted feed:
            # Do NOT carry forward cached fixtures into active data["fixtures"].
            # Do NOT advance fixtures_last_checked timestamp.
            fixtures = []
            fixture_updated = previous.get("fixtures_last_checked")
    except Exception as exc:
        fixture_error = str(exc)
        errors.append({"source": "fixtures", "error": fixture_error})
        # Fixture retrieval failed: do NOT expose cached fixtures as newly verified prediction targets.
        # Do NOT advance fixtures_last_checked timestamp.
        fixtures = []
        fixture_updated = previous.get("fixtures_last_checked")
        schedule_evidence["feed_status"] = "failed"
        schedule_evidence["schedule_status"] = "failed"
        schedule_evidence["off_season_status"] = "unavailable"

    # Assess freshness only from this run's downloaded CSV; `merged` intentionally
    # retains cached values for settlement/history when the provider omits fields.
    current_rows = current_csv_rows
    previous_pending = previous.get("pending_expected_fixtures", [])
    if not isinstance(previous_pending, list):
        previous_pending = []
    fixture_rows_for_assessment = list(previous.get("fixtures", [])) + fixtures
    already_expected_keys = {
        key
        for row in previous_pending + fixture_rows_for_assessment
        if isinstance(row, dict) and (key := fixture_key(row))
    }
    previous_freshness = previous.get("current_season_status", {})
    if not isinstance(previous_freshness, dict):
        previous_freshness = {}
    previous_freshness_status = (
        previous_freshness.get("freshness_status")
    )
    freshness_checked_at = dt.datetime.now(UTC)
    retained_completed_fixtures = []
    for row in previous.get("matches", []):
        if not isinstance(row, dict) or row.get("season") != CURRENT_SEASON:
            continue
        key = fixture_key(row)
        day = parse_date(row.get("Date", ""))
        if not key or not day or day >= freshness_checked_at.date():
            continue
        # Cached values contribute identity only; newly verified values must
        # come from current_csv_rows above.
        if (_valid_result(row) or _valid_corners(row)) and key not in already_expected_keys:
            retained_completed_fixtures.append(_expected_record(row))
            already_expected_keys.add(key)
    pending_for_assessment = list(previous_pending or []) + retained_completed_fixtures
    freshness = assess_current_season_freshness(
        current_rows,
        fixture_rows_for_assessment,
        pending_for_assessment,
        freshness_checked_at,
        previous_freshness_status=previous_freshness_status,
        duplicate_keys=duplicate_keys,
        schedule_evidence=schedule_evidence,
    )
    if fixture_error:
        freshness["coverage_completeness_status"] = "unverifiable"
        freshness["verified_new"] = False
        freshness["schedule_status"] = "failed"
        if freshness["result_freshness_status"] == "verified":
            freshness["pipeline_state"] = "verified_results_with_unverifiable_schedule"
        freshness["warnings"].append(
            "Fixture schedule refresh failed; expected completed-fixture coverage cannot be confirmed."
        )
    elif schedule_evidence.get("invalid_window_fixture_count", 0) > 0:
        freshness["coverage_completeness_status"] = "unverifiable"
        freshness["verified_new"] = False
        freshness["schedule_status"] = "incomplete"
        if freshness["result_freshness_status"] == "verified":
            freshness["pipeline_state"] = "verified_results_with_unverifiable_schedule"
        freshness["warnings"].append(
            "Fixture schedule contains corrupted, invalid, unknown-team, or conflicting entries; failing closed to seal prediction list."
        )
    downloaded_at = dt.datetime.now(UTC).isoformat()
    metadata = build_refresh_metadata(
        previous, successful_rows, failures, downloaded_at, freshness=freshness,
        attempted_at=refresh_attempted_at, last_download_at=current_downloaded_at,
    )
    payload = {
        "fixtures": fixtures,
        "fixtures_last_checked": fixture_updated,
        "source": "football-data.co.uk",
        **metadata,
        "pending_expected_fixtures": freshness["pending_fixtures"],
        "freshness_warnings": freshness["warnings"],
        "errors": errors,
        "matches": list(merged.values()),
    }
    OUT.parent.mkdir(exist_ok=True)
    temporary = OUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, separators=(",", ":")))
    temporary.replace(OUT)
    current = metadata["current_season_status"]
    print(
        "Updated", len(merged), "records; current-season download",
        current.get("download_status", "unavailable"), "; freshness",
        current.get("freshness_status", "unverifiable"), "; failures", len(errors),
    )
    for warning in freshness["warnings"]:
        print("Freshness warning:", warning)


if __name__ == "__main__":
    main()
