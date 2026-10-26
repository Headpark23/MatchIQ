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


# --------------------------------------------------------------------------- other leagues
# Canonical form for every non-Premier-League club is the football-data.co.uk short name
# (it is also the settlement and statistics source). Other sources (openfootball,
# OpenLigaDB, football-data.org, The Odds API) spell clubs differently, so each league has
# an alias table keyed by the normalised source spelling. Anything unknown falls back to
# a unique token-containment match against the league's known co.uk names, then to the
# cleaned name. tests/test_leagues.py checks that every club in the 2026-27 schedules resolves.
LEAGUE_ALIASES = {
    "ELC": {"Birmingham": ["birmingham city"], "Blackburn": ["blackburn rovers"], "Bolton": ["bolton wanderers"],
            "Cardiff": ["cardiff city"], "Charlton": ["charlton athletic"], "Derby": ["derby county"],
            "Lincoln": ["lincoln city"], "Norwich": ["norwich city"], "Preston": ["preston north end"],
            "QPR": ["queens park rangers", "qpr"], "Stoke": ["stoke city"], "Swansea": ["swansea city"],
            "West Brom": ["west bromwich albion", "west brom"], "Sheffield Weds": ["sheffield wednesday", "sheffield weds"],
            "Oxford": ["oxford united", "oxford"], "Plymouth": ["plymouth argyle"], "Portsmouth": ["portsmouth"],
            "Middlesbrough": ["middlesbrough", "boro"], "Millwall": ["millwall"], "Watford": ["watford"],
            "Bristol City": ["bristol city"], "Huddersfield": ["huddersfield town"], "Rotherham": ["rotherham united"],
            "Wrexham": ["wrexham"]},
    "BL1": {"Bayern Munich": ["bayern munchen", "bayern munich", "fc bayern munchen"], "Dortmund": ["borussia dortmund", "dortmund"],
            "Ein Frankfurt": ["eintracht frankfurt", "ein frankfurt"], "FC Koln": ["1 koln", "koln", "fc koln", "1 fc koln", "cologne"],
            "Freiburg": ["sc freiburg", "freiburg"], "Hamburg": ["hamburger sv", "hamburg"],
            "Heidenheim": ["1 fc heidenheim 1846", "heidenheim", "1 heidenheim 1846"], "Hoffenheim": ["tsg 1899 hoffenheim", "hoffenheim", "tsg hoffenheim"],
            "Leverkusen": ["bayer 04 leverkusen", "bayer leverkusen", "leverkusen"], "M'gladbach": ["borussia monchengladbach", "mgladbach", "monchengladbach", "borussia mgladbach"],
            "Mainz": ["1 fsv mainz 05", "mainz 05", "mainz"], "Paderborn": ["sc paderborn 07", "paderborn"],
            "St Pauli": ["st pauli", "fc st pauli"], "Stuttgart": ["vfb stuttgart", "stuttgart"],
            "Union Berlin": ["1 union berlin", "union berlin"], "Werder Bremen": ["sv werder bremen", "werder bremen"],
            "Wolfsburg": ["vfl wolfsburg", "wolfsburg"], "Elversberg": ["sv 07 elversberg", "elversberg"],
            "Augsburg": ["fc augsburg", "augsburg"], "Bochum": ["vfl bochum 1848", "vfl bochum", "bochum"],
            "RB Leipzig": ["rb leipzig", "leipzig"], "Holstein Kiel": ["holstein kiel"], "Darmstadt": ["sv darmstadt 98", "darmstadt"],
            "Schalke 04": ["schalke 04", "fc schalke 04"]},
    "PD": {"Ath Bilbao": ["athletic club", "athletic bilbao", "ath bilbao"], "Ath Madrid": ["club atletico de madrid", "atletico madrid", "ath madrid"],
           "Alaves": ["deportivo alaves", "alaves"], "Betis": ["real betis balompie", "real betis", "betis"],
           "Celta": ["rc celta de vigo", "celta vigo", "celta"], "Elche": ["elche"], "Espanol": ["rcd espanyol de barcelona", "espanyol", "espanol"],
           "Getafe": ["getafe"], "Girona": ["girona"], "La Coruna": ["rc deportivo la coruna", "deportivo la coruna", "la coruna"],
           "Levante": ["levante ud", "levante"], "Malaga": ["malaga"], "Mallorca": ["rcd mallorca", "mallorca"],
           "Osasuna": ["ca osasuna", "osasuna"], "Oviedo": ["real oviedo", "oviedo"], "Santander": ["real racing club de santander", "racing santander", "santander"],
           "Sociedad": ["real sociedad de futbol", "real sociedad", "sociedad"], "Valencia": ["valencia"], "Vallecano": ["rayo vallecano de madrid", "rayo vallecano", "vallecano"],
           "Villarreal": ["villarreal"], "Barcelona": ["barcelona"], "Real Madrid": ["real madrid"], "Sevilla": ["sevilla"],
           "Las Palmas": ["ud las palmas", "las palmas"], "Leganes": ["cd leganes", "leganes"], "Valladolid": ["real valladolid", "valladolid"],
           "Almeria": ["ud almeria", "almeria"], "Cadiz": ["cadiz"], "Granada": ["granada"]},
    "SA": {"Inter": ["internazionale milano", "inter milan", "inter"], "Milan": ["ac milan", "milan"], "Roma": ["as roma", "roma"],
           "Lazio": ["ss lazio", "lazio"], "Napoli": ["ssc napoli", "napoli"], "Atalanta": ["atalanta bc", "atalanta"],
           "Bologna": ["bologna 1909", "bologna"], "Cagliari": ["cagliari calcio", "cagliari"], "Como": ["como 1907", "como"],
           "Fiorentina": ["acf fiorentina", "fiorentina"], "Frosinone": ["frosinone calcio", "frosinone"], "Genoa": ["genoa cfc", "genoa"],
           "Lecce": ["us lecce", "lecce"], "Monza": ["ac monza", "monza"], "Parma": ["parma calcio 1913", "parma"],
           "Sassuolo": ["us sassuolo calcio", "sassuolo"], "Udinese": ["udinese calcio", "udinese"], "Verona": ["hellas verona", "verona"],
           "Cremonese": ["us cremonese", "cremonese"], "Pisa": ["pisa sc", "pisa"], "Juventus": ["juventus"], "Torino": ["torino"],
           "Empoli": ["empoli"], "Salernitana": ["us salernitana 1919", "salernitana"], "Venezia": ["venezia"]},
    "FL1": {"Paris SG": ["paris saint germain", "paris sg", "psg"], "Lyon": ["olympique lyonnais", "lyon"], "Marseille": ["olympique de marseille", "marseille"],
            "Monaco": ["as monaco", "monaco"], "Lille": ["lille osc", "lille"], "Nice": ["ogc nice", "nice"], "Lens": ["racing club de lens", "rc lens", "lens"],
            "Rennes": ["stade rennais 1901", "stade rennais", "rennes"], "Strasbourg": ["rc strasbourg alsace", "strasbourg"],
            "Brest": ["stade brestois 29", "brest"], "Auxerre": ["aj auxerre", "auxerre"], "Angers": ["angers sco", "angers"],
            "Le Havre": ["le havre ac", "le havre"], "Troyes": ["es troyes ac", "troyes"], "Nantes": ["nantes"], "Metz": ["metz"],
            "Toulouse": ["toulouse"], "Reims": ["stade de reims", "reims"], "Montpellier": ["montpellier"], "Lorient": ["lorient"],
            "Paris FC": ["paris"], "Le Mans": ["le mans"], "Clermont": ["clermont foot 63", "clermont"], "St Etienne": ["as saint etienne", "saint etienne", "st etienne"]},
}
_LEAGUE_LOOKUP = {code: {_normalise(a): name for name, aliases in table.items() for a in aliases + [name]}
                  for code, table in LEAGUE_ALIASES.items()}


_LEAGUE_NOISE = {"cf", "ud", "cd", "rcd", "ca", "sd", "ac", "as", "us", "ss", "sc", "ssc", "fk", "sv", "vfl", "vfb", "tsg", "rc", "ogc", "aj", "es", "fsv", "1", "calcio", "de", "la", "del"}


def _league_match(table, key):
    if key in table:
        return table[key]
    words = [w for w in key.split() if w not in _LEAGUE_NOISE]
    if " ".join(words) in table:
        return table[" ".join(words)]
    # Unique containment: every word of exactly one known alias appears in the source name.
    found = {table[a] for a in table if a and set(a.split()) <= set(key.split()) and len(a) > 3}
    return found.pop() if len(found) == 1 else None


def canonical_for(competition, raw):
    """Canonical club name for any competition. PL keeps the established `canonical()`."""
    if competition == "PL" or competition not in _LEAGUE_LOOKUP:
        return canonical(raw)
    key = _normalise(raw)
    hit = _league_match(_LEAGUE_LOOKUP[competition], key)
    if hit:
        return canonical(hit)
    if competition == "ELC" and key in _LOOKUP:  # relegated/promoted clubs shared with the PL table
        return _LOOKUP[key]
    return canonical(raw)
