"""Free, legally reusable fixture and result sources.

Priority (highest first) when sources disagree:
  1. football-data.org v4 — free tier, needs FOOTBALL_DATA_ORG_TOKEN (free registration,
     10 requests/minute). Only source that reports postponed/cancelled status.
  2. OpenLigaDB — no key; data under ODbL 1.0, attribution "© OpenLigaDB contributors".
  3. openfootball/football.json — no key; CC0 public domain. Full schedules, results lag.

Every fetcher returns a list of normalised match dicts and never raises on network
failure: it returns (matches, error) so a single outage cannot stop the refresh.
"""
import datetime as dt
import json
import os
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

from .teams import canonical

UK = ZoneInfo("Europe/London")
UTC = dt.timezone.utc
USER_AGENT = "MatchIQ-pipeline/1.0 (+https://github.com/Headpark23/MatchIQ)"
SOURCE_LABELS = {
    "football-data.org": "football-data.org (free tier)",
    "openligadb": "OpenLigaDB (ODbL 1.0, © OpenLigaDB contributors)",
    "openfootball": "openfootball/football.json (CC0 public domain)",
    "football-data.co.uk": "football-data.co.uk (personal/research use; match statistics)",
}


def http_json(url, headers=None, retries=3, timeout=20, opener=None):
    """GET JSON with retries. Honours HTTP 429 Retry-After (capped at 65 s) so the
    football-data.org 10 requests/minute limit is respected."""
    opener = opener or urllib.request.urlopen
    last = None
    for attempt in range(retries):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
        try:
            with opener(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            last = error
            if error.code == 429:
                wait = min(65, int(error.headers.get("Retry-After") or 60))
                time.sleep(wait)
                continue
            if error.code in (401, 403, 404):
                break  # not retryable: missing token, forbidden or unknown resource
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last = error
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{url}: {last}")


def _match(competition, season, home, away, kickoff, status, score, source, updated=None):
    return {"competition": competition, "season": season, "home": canonical(home), "away": canonical(away),
            "kickoff_utc": kickoff.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            "status": status, "score": score, "source": source, "source_updated": updated}


FDO_STATUS = {"SCHEDULED": "SCHEDULED", "TIMED": "SCHEDULED", "IN_PLAY": "IN_PLAY", "PAUSED": "IN_PLAY",
              "FINISHED": "FINISHED", "AWARDED": "FINISHED", "POSTPONED": "POSTPONED",
              "SUSPENDED": "POSTPONED", "CANCELLED": "CANCELLED"}


def fetch_football_data_org(competition, season_start, season, token=None, opener=None):
    token = token or os.environ.get("FOOTBALL_DATA_ORG_TOKEN")
    if not token:
        return [], "skipped: FOOTBALL_DATA_ORG_TOKEN not configured"
    code = {"PL": "PL", "ELC": "ELC"}[competition]
    try:
        payload = http_json(f"https://api.football-data.org/v4/competitions/{code}/matches?season={season_start}",
                            headers={"X-Auth-Token": token}, opener=opener)
    except RuntimeError as error:
        return [], str(error)
    out = []
    for m in payload.get("matches", []):
        status = FDO_STATUS.get(m.get("status"), "SCHEDULED")
        full = (m.get("score") or {}).get("fullTime") or {}
        score = [full["home"], full["away"]] if status == "FINISHED" and full.get("home") is not None else None
        kickoff = dt.datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00"))
        out.append(_match(competition, season, m["homeTeam"]["name"], m["awayTeam"]["name"], kickoff,
                          status, score, "football-data.org", m.get("lastUpdated")))
    return out, None


def fetch_openligadb(competition, season_start, season, opener=None):
    shortcut = {"PL": "pl"}.get(competition)
    if not shortcut:
        return [], "skipped: competition not covered by OpenLigaDB"
    try:
        payload = http_json(f"https://api.openligadb.de/getmatchdata/{shortcut}/{season_start}", opener=opener)
    except RuntimeError as error:
        return [], str(error)
    out = []
    for m in payload:
        kickoff = dt.datetime.fromisoformat(m["matchDateTimeUTC"].replace("Z", "+00:00"))
        final = [r for r in m.get("matchResults") or [] if r.get("resultTypeID") == 2]
        score = [final[0]["pointsTeam1"], final[0]["pointsTeam2"]] if m.get("matchIsFinished") and final else None
        out.append(_match(competition, season, m["team1"]["teamName"], m["team2"]["teamName"], kickoff,
                          "FINISHED" if score else "SCHEDULED", score, "openligadb", m.get("lastUpdateDateTime")))
    return out, None


def parse_openfootball(payload, competition, season):
    out = []
    for m in payload.get("matches", []):
        day = dt.date.fromisoformat(m["date"])
        hour, minute = map(int, (m.get("time") or "15:00").split(":")[:2])
        kickoff = dt.datetime.combine(day, dt.time(hour, minute), UK)
        ft = (m.get("score") or {}).get("ft") if isinstance(m.get("score"), dict) else None
        score = [int(ft[0]), int(ft[1])] if ft else None
        out.append(_match(competition, season, m["team1"], m["team2"], kickoff,
                          "FINISHED" if score else "SCHEDULED", score, "openfootball"))
    return out


def fetch_openfootball(competition, season_label, season, opener=None):
    league = {"PL": "en.1", "ELC": "en.2"}[competition]
    try:
        payload = http_json(f"https://raw.githubusercontent.com/openfootball/football.json/master/{season_label}/{league}.json", opener=opener)
    except RuntimeError as error:
        return [], str(error)
    return parse_openfootball(payload, competition, season), None
