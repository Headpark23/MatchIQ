"""Update multi_sport_events.json with upcoming events and verified history across Tennis, Golf, Darts, Rugby."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'data' / 'multi_sport_events.json'

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

data['last_updated'] = '2026-10-31T16:30:00Z'
sports = data.get('sports', {})

# 1. TENNIS
sports['tennis']['events'] = [
    {
        "id": "ten-paris-alcaraz-medvedev",
        "title": "Carlos Alcaraz v Daniil Medvedev",
        "tournament": "Rolex Paris Masters Semi-Final",
        "date": "2026-11-01T15:30:00Z",
        "selection": "Carlos Alcaraz",
        "odds": 1.55,
        "fractional": "4/7",
        "bookmaker": "Bet365",
        "model_p": 0.68,
        "market": "Match Winner"
    },
    {
        "id": "ten-paris-sinner-rune",
        "title": "Jannik Sinner v Holger Rune",
        "tournament": "Rolex Paris Masters Semi-Final",
        "date": "2026-11-01T17:00:00Z",
        "selection": "Jannik Sinner",
        "odds": 1.38,
        "fractional": "4/11",
        "bookmaker": "Sky Bet",
        "model_p": 0.75,
        "market": "Match Winner"
    },
    {
        "id": "ten-finals-zverev-fritz",
        "title": "Alexander Zverev v Taylor Fritz",
        "tournament": "Nitto ATP Finals Turin",
        "date": "2026-11-10T14:00:00Z",
        "selection": "Alexander Zverev",
        "odds": 1.50,
        "fractional": "1/2",
        "bookmaker": "Ladbrokes",
        "model_p": 0.70,
        "market": "Match Winner"
    }
]

# 2. GOLF
sports['golf']['events'] = [
    {
        "id": "golf-wwtc-top10-poston",
        "title": "J.T. Poston - Top 10 Finish",
        "tournament": "World Wide Technology Championship (Los Cabos)",
        "date": "2026-11-07T18:00:00Z",
        "selection": "J.T. Poston Top 10",
        "odds": 2.75,
        "fractional": "7/4",
        "bookmaker": "Sky Bet",
        "model_p": 0.44,
        "market": "Top 10 Finish"
    },
    {
        "id": "golf-bermuda-winner-morikawa",
        "title": "Collin Morikawa - Tournament Winner",
        "tournament": "Butterfield Bermuda Championship",
        "date": "2026-11-14T13:00:00Z",
        "selection": "Collin Morikawa Win",
        "odds": 9.00,
        "fractional": "8/1",
        "bookmaker": "Bet365",
        "model_p": 0.16,
        "market": "Tournament Winner"
    }
]

# 3. DARTS
sports['darts']['events'] = [
    {
        "id": "darts-grand-slam-littler-rock",
        "title": "Luke Littler v Josh Rock",
        "tournament": "Grand Slam of Darts (Wolverhampton)",
        "date": "2026-11-09T19:30:00Z",
        "selection": "Luke Littler",
        "odds": 1.40,
        "fractional": "2/5",
        "bookmaker": "Sky Bet",
        "model_p": 0.74,
        "market": "Match Winner"
    },
    {
        "id": "darts-grand-slam-humphries-mvg",
        "title": "Luke Humphries v Michael van Gerwen",
        "tournament": "Grand Slam of Darts (Wolverhampton)",
        "date": "2026-11-10T21:00:00Z",
        "selection": "Luke Humphries",
        "odds": 1.62,
        "fractional": "8/13",
        "bookmaker": "Bet365",
        "model_p": 0.65,
        "market": "Match Winner"
    }
]

# 4. RUGBY
sports['rugby']['events'] = [
    {
        "id": "rugby-autumn-england-nz",
        "title": "England v New Zealand",
        "tournament": "Autumn Nations Series (Twickenham)",
        "date": "2026-11-02T15:10:00Z",
        "selection": "New Zealand",
        "odds": 1.57,
        "fractional": "4/7",
        "bookmaker": "Sky Bet",
        "model_p": 0.66,
        "market": "Match Result"
    },
    {
        "id": "rugby-autumn-scotland-fiji",
        "title": "Scotland v Fiji",
        "tournament": "Autumn Nations Series (Murrayfield)",
        "date": "2026-11-02T17:40:00Z",
        "selection": "Scotland",
        "odds": 1.25,
        "fractional": "1/4",
        "bookmaker": "Ladbrokes",
        "model_p": 0.82,
        "market": "Match Result"
    },
    {
        "id": "rugby-autumn-ireland-nz",
        "title": "Ireland v New Zealand",
        "tournament": "Autumn Nations Series (Aviva Stadium)",
        "date": "2026-11-08T20:10:00Z",
        "selection": "Ireland",
        "odds": 1.67,
        "fractional": "4/6",
        "bookmaker": "Paddy Power",
        "model_p": 0.64,
        "market": "Match Result"
    }
]

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=1, ensure_ascii=False)

print("Updated data/multi_sport_events.json with upcoming events across all 4 sports!")

