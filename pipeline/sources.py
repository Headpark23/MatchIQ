"""Free, legally reusable fixture and result sources.

Priority (highest first) when sources disagree:
  1. football-data.org v4 — free tier, needs FOOTBALL_DATA_ORG_TOKEN (free registration,
     10 requests/minute). Only source that reports postponed/cancelled status.
  2. OpenLigaDB — no key; data under ODbL 1.0, attribution "© OpenLigaDB contributors".
  3. openfootball/football.json — no key; CC0 public domain. Full schedules, results lag.
     Where football.json has not published a league for the season, the same project's
     plain-text file in openfootball/europe is read instead (leagues.PUBLIC_ONLY
     "openfootball_europe").

Every fetcher returns a list of normalised match dicts and never raises on network
failure: it returns (matches, error) so a single outage cannot stop the refresh.
"""
import datetime as dt
import json
import os
import re
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

from .leagues import LOCAL_TZ, PUBLIC_ONLY, SCHEDULE_ONLY
from .teams import canonical, canonical_for, known_club

UK = ZoneInfo("Europe/London")
UTC = dt.timezone.utc
CET = ZoneInfo("Europe/Paris")  # openfootball lists German, Spanish, Italian and French kick-offs in local time
USER_AGENT = "MatchIQ-pipeline/1.0 (+https://github.com/Headpark23/MatchIQ)"
SOURCE_LABELS = {
    "football-data.org": "football-data.org (free tier)",
    "openligadb": "OpenLigaDB (ODbL 1.0, © OpenLigaDB contributors)",
    "openfootball": "openfootball/football.json (CC0 public domain)",
    "football-data.co.uk": "football-data.co.uk (personal/research use; match statistics)",
    "international_results": "martj42/international_results (CC0 public domain; international results history)",
}


def http_json(url, headers=None, retries=3, timeout=20, opener=None, parse=None):
    """GET JSON with retries. Honours HTTP 429 Retry-After (capped at 65 s) so the
    football-data.org 10 requests/minute limit is respected. `parse` replaces the JSON
    decoder (http_text passes one that returns the body as text)."""
    opener = opener or urllib.request.urlopen
    parse = parse or json.loads
    last = None
    for attempt in range(retries):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
        try:
            with opener(request, timeout=timeout) as response:
                return parse(response.read().decode("utf-8"))
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


def http_text(url, retries=3, timeout=20, opener=None):
    return http_json(url, retries=retries, timeout=timeout, opener=opener, parse=lambda body: body)


def _match(competition, season, home, away, kickoff, status, score, source, updated=None, namer=None):
    name = namer or (lambda raw: canonical_for(competition, raw))
    return {"competition": competition, "season": season, "home": name(home), "away": name(away),
            "kickoff_utc": kickoff.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            "status": status, "score": score, "source": source, "source_updated": updated}


FDO_STATUS = {"SCHEDULED": "SCHEDULED", "TIMED": "SCHEDULED", "IN_PLAY": "IN_PLAY", "PAUSED": "IN_PLAY",
              "FINISHED": "FINISHED", "AWARDED": "FINISHED", "POSTPONED": "POSTPONED",
              "SUSPENDED": "POSTPONED", "CANCELLED": "CANCELLED"}


def fetch_football_data_org(competition, season_start, season, token=None, opener=None):
    token = token or os.environ.get("FOOTBALL_DATA_ORG_TOKEN")
    if not token:
        return [], "skipped: FOOTBALL_DATA_ORG_TOKEN not configured"
    code = {"PL": "PL", "ELC": "ELC", "BL1": "BL1", "PD": "PD", "SA": "SA", "FL1": "FL1",
            **{c: m["fdo"] for c, m in PUBLIC_ONLY.items()}}[competition]
    if not code:
        return [], "skipped: competition not covered by the football-data.org free tier"
    try:
        payload = http_json(f"https://api.football-data.org/v4/competitions/{code}/matches?season={season_start}",
                            headers={"X-Auth-Token": token}, opener=opener)
    except RuntimeError as error:
        return [], str(error)
    out, unknown = [], set()
    for m in payload.get("matches", []):
        if competition in PUBLIC_ONLY:
            # These leagues have hand-made alias tables only; an unrecognised spelling would
            # create a duplicate fixture under a second id, so such matches are left out.
            names = (m["homeTeam"]["name"], m["awayTeam"]["name"])
            missing = {n for n in names if not known_club(competition, n)}
            if missing:
                unknown |= missing
                continue
        status = FDO_STATUS.get(m.get("status"), "SCHEDULED")
        full = (m.get("score") or {}).get("fullTime") or {}
        score = [full["home"], full["away"]] if status == "FINISHED" and full.get("home") is not None else None
        kickoff = dt.datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00"))
        out.append(_match(competition, season, m["homeTeam"]["name"], m["awayTeam"]["name"], kickoff,
                          status, score, "football-data.org", m.get("lastUpdated")))
    return out, (f"skipped {len(unknown)} unrecognised club name(s): {', '.join(sorted(unknown))}" if unknown else None)


def fetch_openligadb(competition, season_start, season, opener=None):
    shortcut = {"PL": "pl", "BL1": "bl1", **{c: m["openligadb"] for c, m in PUBLIC_ONLY.items() if m.get("openligadb")}}.get(competition)
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


def number_meetings(matches):
    """Number repeat meetings of the same home and away side within one season, in kick-off
    order, so each gets its own match id (teams.match_id). The first meeting keeps no number."""
    seen = {}
    for m in sorted(matches, key=lambda m: m["kickoff_utc"]):
        key = (m["competition"], m["season"], m["home"], m["away"])
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:
            m["meeting"] = seen[key]
    return matches


def parse_openfootball(payload, competition, season, namer=None):
    out = []
    for m in payload.get("matches", []):
        day = dt.date.fromisoformat(m["date"])
        hour, minute = map(int, (m.get("time") or "15:00").split(":")[:2])
        zone = ZoneInfo(LOCAL_TZ[competition]) if competition in LOCAL_TZ else UK if competition == "PL" or competition == "ELC" else CET
        kickoff = dt.datetime.combine(day, dt.time(hour, minute), zone)
        ft = (m.get("score") or {}).get("ft") if isinstance(m.get("score"), dict) else None
        score = [int(ft[0]), int(ft[1])] if ft else None
        out.append(_match(competition, season, m["team1"], m["team2"], kickoff,
                          "FINISHED" if score else "SCHEDULED", score, "openfootball", namer=namer))
    return number_meetings(out)


MONTHS = {m: i for i, m in enumerate(("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}
_TXT_DATE = re.compile(r"^\s*\[?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s/]+(\d{1,2})(?:\s+(\d{4}))?\]?\s*$")
_TXT_TIME = re.compile(r"^\s+(\d{1,2})[:.](\d{2})\s+(.*)$")
_SCORE = r"(\d+)-(\d+)(?:\s*\(\d+-\d+\))?"
# Two layouts are in use: "Home  v  Away  [2-1 (1-0)]" (older seasons and unplayed matches)
# and "Home  2-1 (1-0)  Away" (played matches from 2026-27).
_TXT_VS = re.compile(r"^(.+?)\s+v\s+(.+?)(?:\s+" + _SCORE + r")?\s*$")
_TXT_PLAYED = re.compile(r"^(.+?)\s+" + _SCORE + r"\s+(.+?)\s*$")


def parse_openfootball_txt(text, competition, season, season_start, namer=None):
    """Matches from an openfootball Football.TXT league file (openfootball/europe).
    A match line without a time takes the previous time on the same date; a date without a
    year belongs to the season half its month falls in."""
    out, day, clock = [], None, (15, 0)
    zone = ZoneInfo(LOCAL_TZ.get(competition, "Europe/London"))
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.lstrip()[0] in "=#▪(" or re.search(r"\d'", line):
            continue  # blank, title, comment, round header, or goal-scorer detail (minute marks)
        date = _TXT_DATE.match(line)
        if date:
            month, dom = MONTHS[date.group(1)], int(date.group(2))
            year = int(date.group(3)) if date.group(3) else season_start + (0 if month >= 7 else 1)
            day, clock = dt.date(year, month, dom), (15, 0)
            continue
        if day is None or not line[:1].isspace():
            continue
        body = line.strip()
        timed = _TXT_TIME.match(line)
        if timed:
            clock, body = (int(timed.group(1)), int(timed.group(2))), timed.group(3).strip()
        vs, played = _TXT_VS.match(body), _TXT_PLAYED.match(body)
        if vs:
            home, away = vs.group(1), vs.group(2)
            score = [int(vs.group(3)), int(vs.group(4))] if vs.group(3) is not None else None
        elif played:
            home, away, score = played.group(1), played.group(4), [int(played.group(2)), int(played.group(3))]
        else:
            continue
        kickoff = dt.datetime.combine(day, dt.time(*clock), zone)
        out.append(_match(competition, season, home.strip(), away.strip(), kickoff,
                          "FINISHED" if score else "SCHEDULED", score, "openfootball", namer=namer))
    return number_meetings(out)


def fetch_openfootball(competition, season_label, season, opener=None):
    league = {"PL": "en.1", "ELC": "en.2", "BL1": "de.1", "PD": "es.1", "SA": "it.1", "FL1": "fr.1",
              **{c: m["openfootball"] for c, m in {**SCHEDULE_ONLY, **PUBLIC_ONLY}.items()}}[competition]
    if not league:
        return [], "skipped: competition not published by openfootball"
    try:
        payload = http_json(f"https://raw.githubusercontent.com/openfootball/football.json/master/{season_label}/{league}.json", opener=opener)
    except RuntimeError as error:
        europe = {**SCHEDULE_ONLY, **PUBLIC_ONLY}.get(competition, {}).get("openfootball_europe")
        if not europe:
            return [], str(error)
        try:
            text = http_text("https://raw.githubusercontent.com/openfootball/europe/master/" + europe.format(season=season_label), opener=opener)
        except RuntimeError as fallback_error:
            return [], f"{error}; {fallback_error}"
        return parse_openfootball_txt(text, competition, season, int(season_label[:4])), None
    return parse_openfootball(payload, competition, season), None
