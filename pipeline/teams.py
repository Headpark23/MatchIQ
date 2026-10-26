"""Canonical team names shared by every MatchIQ data source.

The canonical form is the football-data.co.uk short name already used by the frozen
models and ledgers ("Man City", "Nott'm Forest"). Every external source is resolved
through `canonical()`, so a promoted club gets one identity across Championship
history, Premier League history and upcoming fixtures.
"""
import re
import unicodedata

PREMIER_LEAGUE_ALIASES = {
    "Arsenal": ["arsenal", "fc arsenal", "arsenal fc"],
    "Aston Villa": ["aston villa"],
    "Bournemouth": ["bournemouth", "afc bournemouth"],
    "Brentford": ["brentford"],
    "Brighton": ["brighton", "brighton hove albion", "brighton and hove albion"],
    "Burnley": ["burnley"],
    "Chelsea": ["chelsea"],
    "Coventry": ["coventry", "coventry city"],
    "Crystal Palace": ["crystal palace"],
    "Everton": ["everton"],
    "Fulham": ["fulham"],
    "Hull": ["hull", "hull city"],
    "Ipswich": ["ipswich", "ipswich town"],
    "Leeds": ["leeds", "leeds united"],
    "Leicester": ["leicester", "leicester city"],
    "Liverpool": ["liverpool", "fc liverpool"],
    "Luton": ["luton", "luton town"],
    "Man City": ["man city", "manchester city"],
    "Man United": ["man united", "man utd", "manchester united", "manchester utd"],
    "Newcastle": ["newcastle", "newcastle united", "newcastle utd"],
    "Nott'm Forest": ["nottm forest", "nottingham forest", "nottingham", "nott m forest"],
    "Sheffield United": ["sheffield united", "sheffield utd", "sheffield united"],
    "Southampton": ["southampton"],
    "Sunderland": ["sunderland"],
    "Tottenham": ["tottenham", "tottenham hotspur", "spurs"],
    "West Ham": ["west ham", "west ham united"],
    "Wolves": ["wolves", "wolverhampton", "wolverhampton wanderers"],
}

_NOISE = {"fc", "afc", "f", "c", "the"}
_LOOKUP = {alias: name for name, aliases in PREMIER_LEAGUE_ALIASES.items() for alias in aliases}


def _normalise(raw):
    text = unicodedata.normalize("NFKD", str(raw or "")).encode("ascii", "ignore").decode()
    text = text.lower().replace("&", " and ").replace("'", "")
    words = [w for w in re.split(r"[^a-z0-9]+", text) if w and w not in _NOISE]
    return " ".join(words)


def canonical(raw):
    """Resolve any source spelling to the canonical name.

    Known clubs map to their football-data.co.uk short name. Unknown clubs (for
    example Championship sides never seen in the Premier League) keep a cleaned form
    of their source name, so the same club always resolves to the same string."""
    key = _normalise(raw)
    if key in _LOOKUP:
        return _LOOKUP[key]
    if not key:
        raise ValueError(f"Empty team name: {raw!r}")
    return " ".join(word.capitalize() for word in key.split())


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", _normalise(canonical(name))).strip("-")


def match_id(competition, season, home, away):
    """Stable fixture identifier. Each pairing occurs once per league season, so a
    rescheduled match keeps its identifier when its kickoff moves."""
    return f"{competition}-{season}-{slug(home)}-v-{slug(away)}"
