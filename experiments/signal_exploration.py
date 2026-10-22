"""MatchIQ Research Mission AG-031: Signal Exploration.
Investigates pre-match feature correlations with Over 2.5 and BTTS outcomes.
Strictly pre-match: zero lookahead leakage.
"""

import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "matches.json"

def analyze_signals():
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    raw_matches = payload.get("matches", [])
    
    matches = []
    for r in raw_matches:
        try:
            dt = datetime.strptime(r["Date"], "%d/%m/%Y")
            matches.append({
                "date": dt,
                "home": r["HomeTeam"],
                "away": r["AwayTeam"],
                "hg": int(r["FTHG"]),
                "ag": int(r["FTAG"]),
                "hs": int(r.get("HS", 0)),
                "as_shots": int(r.get("AS", 0)),
                "hst": int(r.get("HST", 0)),
                "ast": int(r.get("AST", 0)),
                "season": r.get("season", ""),
                "over25": 1 if (int(r["FTHG"]) + int(r["FTAG"])) > 2.5 else 0,
                "btts": 1 if (int(r["FTHG"]) > 0 and int(r["FTAG"]) > 0) else 0
            })
        except (ValueError, TypeError, KeyError):
            continue
            
    matches.sort(key=lambda m: m["date"])
    print(f"Loaded {len(matches)} matches from {matches[0]['date'].strftime('%Y-%m-%d')} to {matches[-1]['date'].strftime('%Y-%m-%d')}.")
    
    # Compute rolling pre-match features (strictly using prior games)
    # Lookback windows: 5 games, 10 games
    team_history = defaultdict(list)
    
    dataset = []
    for m in matches:
        h_games = team_history[m["home"]]
        a_games = team_history[m["away"]]
        
        # We need at least 5 games of history for each team
        if len(h_games) >= 5 and len(a_games) >= 5:
            # Last 6 overall games for each team
            h_recent = h_games[-6:]
            a_recent = a_games[-6:]
            
            # 1. Rolling Goal stats
            h_goals_for = sum(g["gf"] for g in h_recent) / len(h_recent)
            h_goals_against = sum(g["ga"] for g in h_recent) / len(h_recent)
            a_goals_for = sum(g["gf"] for g in a_recent) / len(a_recent)
            a_goals_against = sum(g["ga"] for g in a_recent) / len(a_recent)
            combined_exp_goals = (h_goals_for + a_goals_against + a_goals_for + h_goals_against) / 2.0
            
            # 2. Rolling Shot stats
            h_shots_for = sum(g["sf"] for g in h_recent) / len(h_recent)
            h_shots_against = sum(g["sa"] for g in h_recent) / len(h_recent)
            a_shots_for = sum(g["sf"] for g in a_recent) / len(a_recent)
            a_shots_against = sum(g["sa"] for g in a_recent) / len(a_recent)
            combined_exp_shots = (h_shots_for + a_shots_against + a_shots_for + h_shots_against) / 2.0
            
            # 3. Rolling Shots on Target (SoT) stats
            h_sot_for = sum(g["stf"] for g in h_recent) / len(h_recent)
            h_sot_against = sum(g["sta"] for g in h_recent) / len(h_recent)
            a_sot_for = sum(g["stf"] for g in a_recent) / len(a_recent)
            a_sot_against = sum(g["sta"] for g in a_recent) / len(a_recent)
            combined_exp_sot = (h_sot_for + a_sot_against + a_sot_for + h_sot_against) / 2.0
            
            # 4. Rolling BTTS rate
            h_btts_rate = sum(g["btts"] for g in h_recent) / len(h_recent)
            a_btts_rate = sum(g["btts"] for g in a_recent) / len(a_recent)
            combined_btts_tendency = (h_btts_rate + a_btts_rate) / 2.0
            
            # 5. Rolling Over 2.5 rate
            h_over_rate = sum(g["over25"] for g in h_recent) / len(h_recent)
            a_over_rate = sum(g["over25"] for g in a_recent) / len(a_recent)
            combined_over_tendency = (h_over_rate + a_over_rate) / 2.0
            
            dataset.append({
                "date": m["date"],
                "season": m["season"],
                "over25": m["over25"],
                "btts": m["btts"],
                "exp_goals": combined_exp_goals,
                "exp_shots": combined_exp_shots,
                "exp_sot": combined_exp_sot,
                "btts_tendency": combined_btts_tendency,
                "over_tendency": combined_over_tendency
            })
            
        # Update histories strictly after recording pre-match features
        team_history[m["home"]].append({
            "gf": m["hg"], "ga": m["ag"],
            "sf": m["hs"], "sa": m["as_shots"],
            "stf": m["hst"], "sta": m["ast"],
            "btts": m["btts"], "over25": m["over25"]
        })
        team_history[m["away"]].append({
            "gf": m["ag"], "ga": m["hg"],
            "sf": m["as_shots"], "sa": m["hs"],
            "stf": m["ast"], "sta": m["hst"],
            "btts": m["btts"], "over25": m["over25"]
        })
        
    print(f"Analyzable fixtures with >= 5 pre-match games: {len(dataset)} matches.")
    
    # Compute Pearson correlation with Over 2.5 and BTTS
    def pearson(xs, ys):
        n = len(xs)
        mx = sum(xs) / n
        my = sum(ys) / n
        cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        var_x = sum((x - mx) ** 2 for x in xs)
        var_y = sum((y - my) ** 2 for y in ys)
        if var_x == 0 or var_y == 0:
            return 0.0
        return cov / math.sqrt(var_x * var_y)
        
    print("\n--- FEATURE CORRELATIONS WITH OVER 2.5 ---")
    for feat in ["exp_goals", "exp_shots", "exp_sot", "over_tendency", "btts_tendency"]:
        r = pearson([d[feat] for d in dataset], [d["over25"] for d in dataset])
        print(f"  {feat:<22}: r = {r:+.4f}")
        
    print("\n--- FEATURE CORRELATIONS WITH BTTS (YES) ---")
    for feat in ["exp_goals", "exp_shots", "exp_sot", "over_tendency", "btts_tendency"]:
        r = pearson([d[feat] for d in dataset], [d["btts"] for d in dataset])
        print(f"  {feat:<22}: r = {r:+.4f}")

if __name__ == "__main__":
    analyze_signals()
