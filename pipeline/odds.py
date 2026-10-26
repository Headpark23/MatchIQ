"""Bookmaker prices from The Odds API (free Starter plan: 500 credits a month).

Inactive unless ODDS_API_KEY is set; the key is read from the environment only and is
never written to any output.

Coverage actually requested: Match Result (h2h) and Total Goals 1.5/2.5/3.5 (totals), UK
bookmakers, for the six competitions. Corners, cards, shots and BTTS are NOT requested, so
those selections stay manual-entry only. The provider documents that totals are mainly
supplied for US sports, so the first response for each league decides whether totals are
worth paying for: when a league returns none, only h2h is requested from then on (1 credit).

Prices are coherent: for each market group (the three match-result outcomes, or Over and
Under on one goals line) the feed publishes the prices of ONE bookmaker, the one with the
lowest margin that quotes every outcome, never a patchwork of best prices from different
firms. That keeps the app's margin removal honest. Every price carries its bookmaker and
the time it was retrieved, and the app refuses to treat a price older than 12 hours as
current.

Credit budget (all limits are ours, below the 500 provider allowance):
  * one call costs len(markets) credits (1 region);
  * a league is only polled when it has a fixture in the next 36 hours (matchday focus);
  * at least 8 h between polls of a league, 3 h when kick-off is within 6 h;
  * spend never runs ahead of a straight-line monthly pace (cap 400, plus a 3-day head
    start for a busy first weekend);
  * when the provider reports <= 100 credits left: Premier League only, h2h only, 10 h
    spacing; at <= 25 credits left nothing is requested at all.
Output: data/odds.json.
"""
import calendar
import datetime as dt
import json
import os
import urllib.request

from .fairodds import UK_PRICE_LADDER, decimal_price
from .leagues import LEAGUES
from .teams import canonical_for, match_id

PRIORITY = ["PL", "ELC", "BL1", "PD", "SA", "FL1"]
REGIONS = "uk"
MONTHLY_CAP = 400
WINDOW_HOURS = 36
MIN_INTERVAL_HOURS = 8
NEAR_KICKOFF_HOURS = 6
NEAR_KICKOFF_INTERVAL_HOURS = 3
LOW_REMAINING = 100
STOP_REMAINING = 25
LOW_INTERVAL_HOURS = 10
MAX_AGE_HOURS = 12  # the app applies the same limit
GOAL_LINES = {1.5, 2.5, 3.5}
URL = "https://api.the-odds-api.com/v4/sports/{sport}/odds/?regions={regions}&markets={markets}&oddsFormat=decimal&apiKey={key}"


def fractional(decimal):
    """Nearest price on the UK ladder, so it parses back through parseFractionalOdds."""
    return min(UK_PRICE_LADDER, key=lambda p: abs(decimal_price(p) - decimal))


def month_of(now):
    return now.strftime("%Y-%m")


def _iso(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def spent_this_month(cache, now):
    return (cache.get("credits") or {}).get("spent_by_month", {}).get(month_of(now), 0)


def plan_call(cache, now, code, fixtures):
    """(markets, reason). markets is None when no call should be made. Pure: no network."""
    upcoming = sorted(_iso(f["kickoff_utc"]) for f in fixtures
                      if f["competition"] == code and f["status"] == "SCHEDULED" and now < _iso(f["kickoff_utc"]) <= now + dt.timedelta(hours=WINDOW_HOURS))
    if not upcoming:
        return None, f"no {LEAGUES[code]['name']} match in the next {WINDOW_HOURS} h"
    remaining = (cache.get("credits") or {}).get("provider_remaining")
    low = remaining is not None and remaining <= LOW_REMAINING
    if remaining is not None and remaining <= STOP_REMAINING:
        return None, f"only {remaining} provider credits left: stopped to keep a reserve"
    if low and code != "PL":
        return None, f"allowance low ({remaining} left): Premier League only"
    state = (cache.get("leagues") or {}).get(code, {})
    markets = ["h2h"] if low or state.get("totals") is False else ["h2h", "totals"]
    dim = calendar.monthrange(now.year, now.month)[1]
    allowed = MONTHLY_CAP * min(1.0, (now.day + 3) / dim)
    if spent_this_month(cache, now) + len(markets) > min(MONTHLY_CAP, allowed):
        return None, f"ahead of the monthly credit pace ({spent_this_month(cache, now)} used, {allowed:.0f} allowed so far)"
    if state.get("fetched_at"):
        age = now - _iso(state["fetched_at"])
        near = upcoming[0] - now <= dt.timedelta(hours=NEAR_KICKOFF_HOURS)
        need = LOW_INTERVAL_HOURS if low else NEAR_KICKOFF_INTERVAL_HOURS if near else MIN_INTERVAL_HOURS
        if age < dt.timedelta(hours=need):
            return None, f"polled {age.total_seconds() / 3600:.1f} h ago (minimum {need} h)"
    return markets, None


def _groups(event, code):
    """Per bookmaker and market group, the outcome prices: {(group): {book: {sel_id: price}}}."""
    home, away = canonical_for(code, event["home_team"]), canonical_for(code, event["away_team"])
    groups = {}
    for book in event.get("bookmakers", []):
        for market in book.get("markets", []):
            if market["key"] == "h2h":
                prices = {}
                for o in market["outcomes"]:
                    name = "Draw" if o["name"] == "Draw" else canonical_for(code, o["name"])
                    key = "D" if name == "Draw" else "H" if name == home else "A" if name == away else None
                    if key:
                        prices["result:" + key] = o["price"]
                if set(prices) == {"result:H", "result:D", "result:A"}:
                    groups.setdefault("result", {})[book["title"]] = (prices, market.get("last_update") or book.get("last_update"))
            elif market["key"] == "totals":
                by_line = {}
                for o in market["outcomes"]:
                    if o.get("point") in GOAL_LINES and o["name"] in ("Over", "Under"):
                        by_line.setdefault(o["point"], {})[f"goals:{o['name'].lower()}:{o['point']}"] = o["price"]
                for line, prices in by_line.items():
                    if len(prices) == 2:
                        groups.setdefault(f"goals:{line}", {})[book["title"]] = (prices, market.get("last_update") or book.get("last_update"))
    return groups


def parse_events(events, now, code, fixtures, retrieved_at=None):
    """Prices for matches that exist in our schedule. Returns (matches, unmatched_events)."""
    by_id = {f["id"]: f for f in fixtures if f["competition"] == code}
    retrieved = (retrieved_at or now).isoformat()
    season = next(iter(by_id.values()))["season"] if by_id else ""
    out, unmatched = {}, []
    for ev in events:
        kickoff = _iso(ev["commence_time"])
        mid = match_id(code, season, canonical_for(code, ev["home_team"]), canonical_for(code, ev["away_team"]))
        fixture = by_id.get(mid)
        if fixture is None:
            unmatched.append(f"{ev['home_team']} v {ev['away_team']}")
            continue
        if kickoff <= now:
            continue  # in play or finished: never show a stale pre-match price
        if abs(kickoff - _iso(fixture["kickoff_utc"])) > dt.timedelta(hours=12):
            unmatched.append(f"{ev['home_team']} v {ev['away_team']} (kick-off differs from our schedule)")
            continue
        sels = {}
        for group, books in _groups(ev, code).items():
            # The book with the lowest margin that quotes every outcome in this group.
            title, (prices, updated) = min(books.items(), key=lambda kv: sum(1 / p for p in kv[1][0].values()))
            for sel_id, price in prices.items():
                if isinstance(price, (int, float)) and price > 1:
                    sels[sel_id] = {"decimal": round(float(price), 3), "fractional": fractional(price), "bookmaker": title,
                                    "group": group, "last_update": updated}
        if sels:
            out[mid] = {"competition": code, "kickoff_utc": fixture["kickoff_utc"], "retrieved_at": retrieved, "selections": sels}
    return out, unmatched


def refresh(cache, now, fixtures, key=None, opener=None):
    """Return (new_cache, notes{code: str}). Never raises; any failure keeps the old cache."""
    cache = cache or {}
    key = key or os.environ.get("ODDS_API_KEY")
    if not key:
        return cache, {"all": "skipped: ODDS_API_KEY not configured"}
    opener = opener or urllib.request.urlopen
    work = json.loads(json.dumps(cache))
    work.setdefault("leagues", {})
    work.setdefault("matches", {})
    notes = {}
    for code in PRIORITY:
        markets, reason = plan_call(work, now, code, fixtures)
        if markets is None:
            notes[code] = "skipped: " + reason
            continue
        try:
            req = urllib.request.Request(URL.format(sport=LEAGUES[code]["odds_sport"], regions=REGIONS, markets=",".join(markets), key=key),
                                         headers={"User-Agent": "MatchIQ/1.0"})
            with opener(req, timeout=20) as response:
                events = json.loads(response.read().decode("utf-8"))
                remaining = response.headers.get("x-requests-remaining")
        except Exception as error:  # network, 401, 422 quota: keep serving the cache
            notes[code] = "failed: " + type(error).__name__
            continue
        credits = work.setdefault("credits", {})
        by_month = credits.setdefault("spent_by_month", {})
        by_month[month_of(now)] = by_month.get(month_of(now), 0) + len(markets)
        credits.update({"monthly_cap": MONTHLY_CAP, "provider_remaining": int(remaining) if remaining and str(remaining).isdigit() else credits.get("provider_remaining")})
        matches, unmatched = parse_events(events, now, code, fixtures)
        work["matches"] = {k: v for k, v in work["matches"].items() if v.get("competition") != code}
        work["matches"].update(matches)
        state = work["leagues"].setdefault(code, {})
        state.update({"fetched_at": now.isoformat(), "markets_requested": markets, "events": len(events),
                      "matched": len(matches), "unmatched": unmatched[:10]})
        if "totals" in markets and events:
            state["totals"] = any(m["key"] == "totals" for e in events for b in e.get("bookmakers", []) for m in b.get("markets", []))
        notes[code] = f"ok: {len(matches)} of {len(events)} events matched, {len(markets)} credits"
    work["matches"] = {k: v for k, v in work["matches"].items() if _iso(v["kickoff_utc"]) > now}
    work.update({"fetched_at": max((s["fetched_at"] for s in work["leagues"].values()), default=None),
                 "source": "The Odds API (UK bookmakers; one bookmaker per market group, lowest margin)",
                 "markets_covered": ["Match Result", "Total Goals 1.5/2.5/3.5 where the provider supplies them"],
                 "max_age_hours": MAX_AGE_HOURS})
    return work, notes
