"""Bookmaker prices from The Odds API (free Starter plan: 500 credits a month).

Inactive unless ODDS_API_KEY is set; the key is read from the environment only and is
never written to any output. One request costs (markets x regions) credits, so we ask
for h2h + totals in the UK region (2 credits) for the Premier League only. Cached
prices are reused until they are `MIN_INTERVAL_HOURS` old, and a monthly self-imposed
cap (`MONTHLY_CAP`, below the 500 allowance) stops further calls. Only Match Result and
Total Goals are requested: corners, cards, shots and BTTS are not requested, so those
selections stay manual-entry only. Output: data/odds.json.
"""
import datetime as dt
import json
import os
import urllib.request

from .fairodds import UK_PRICE_LADDER, decimal_price
from .teams import canonical, match_id

SPORT = {"PL": "soccer_epl"}
MARKETS = "h2h,totals"
REGIONS = "uk"
CREDITS_PER_CALL = 2
MONTHLY_CAP = 400
MIN_INTERVAL_HOURS = 12
GOAL_LINES = {1.5, 2.5, 3.5}
URL = "https://api.the-odds-api.com/v4/sports/{sport}/odds/?regions={regions}&markets={markets}&oddsFormat=decimal&apiKey={key}"


def fractional(decimal):
    """Nearest price on the UK ladder, so it parses back through parseFractionalOdds."""
    return min(UK_PRICE_LADDER, key=lambda p: abs(decimal_price(p) - decimal))


def month_of(now):
    return now.strftime("%Y-%m")


def plan_call(cache, now):
    """(allowed, reason). Pure so the budget rules can be tested without a network."""
    spent = (cache.get("credits") or {}).get("spent_by_month", {}).get(month_of(now), 0)
    if spent + CREDITS_PER_CALL > MONTHLY_CAP:
        return False, f"monthly credit cap reached ({spent}/{MONTHLY_CAP} used by MatchIQ)"
    fetched = cache.get("fetched_at")
    if fetched:
        age = now - dt.datetime.fromisoformat(fetched)
        if age < dt.timedelta(hours=MIN_INTERVAL_HOURS):
            return False, f"cached prices are {age.total_seconds() / 3600:.1f}h old (minimum {MIN_INTERVAL_HOURS}h)"
    return True, None


def parse_events(events, now):
    """Best (highest) price per MatchIQ selection id across bookmakers, with its source."""
    out = {}
    for ev in events:
        home, away = canonical(ev["home_team"]), canonical(ev["away_team"])
        kickoff = dt.datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
        if kickoff <= now:
            continue  # in play or finished: never show a stale pre-match price
        sels = {}

        def offer(sel_id, price, book, updated):
            if not isinstance(price, (int, float)) or price <= 1:
                return
            if sel_id not in sels or price > sels[sel_id]["decimal"]:
                sels[sel_id] = {"decimal": round(float(price), 3), "fractional": fractional(price),
                                "bookmaker": book["title"], "last_update": updated or book.get("last_update")}
        for book in ev.get("bookmakers", []):
            for market in book.get("markets", []):
                if market["key"] == "h2h":
                    for o in market["outcomes"]:
                        name = "Draw" if o["name"] == "Draw" else canonical(o["name"])
                        key = "D" if name == "Draw" else "H" if name == home else "A" if name == away else None
                        if key:
                            offer("result:" + key, o["price"], book, market.get("last_update"))
                elif market["key"] == "totals":
                    for o in market["outcomes"]:
                        if o.get("point") in GOAL_LINES and o["name"] in ("Over", "Under"):
                            offer(f"goals:{o['name'].lower()}:{o['point']}", o["price"], book, market.get("last_update"))
        if sels:
            out[match_id("PL", "2627", home, away)] = {"kickoff_utc": kickoff.isoformat().replace("+00:00", "Z"), "selections": sels}
    return out


def refresh(cache, now, key=None, opener=None):
    """Return (new_cache, note). Never raises; on any failure the old cache is kept."""
    key = key or os.environ.get("ODDS_API_KEY")
    if not key:
        return cache, "skipped: ODDS_API_KEY not configured"
    ok, reason = plan_call(cache, now)
    if not ok:
        return cache, "skipped: " + reason
    opener = opener or urllib.request.urlopen
    try:
        req = urllib.request.Request(URL.format(sport=SPORT["PL"], regions=REGIONS, markets=MARKETS, key=key),
                                     headers={"User-Agent": "MatchIQ/1.0"})
        with opener(req, timeout=20) as response:
            events = json.loads(response.read().decode("utf-8"))
            remaining = response.headers.get("x-requests-remaining")
    except Exception as error:  # network, 401, 422 quota: keep serving the cache
        return cache, "failed: " + type(error).__name__
    credits = dict(cache.get("credits") or {})
    by_month = dict(credits.get("spent_by_month", {}))
    by_month[month_of(now)] = by_month.get(month_of(now), 0) + CREDITS_PER_CALL
    credits.update({"spent_by_month": by_month, "monthly_cap": MONTHLY_CAP,
                    "provider_remaining": int(remaining) if remaining and remaining.isdigit() else None})
    return {"fetched_at": now.isoformat(), "source": "The Odds API (UK region, best price across bookmakers)",
            "markets_covered": ["Match Result", "Total Goals 1.5/2.5/3.5"], "credits": credits,
            "matches": parse_events(events, now)}, None
