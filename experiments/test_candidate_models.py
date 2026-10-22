"""MatchIQ Mission AG-031: Candidate Model Feasibility Test.
Tests L2-regularized Logistic Regression using Shots on Target vs Historical Baseline.
Zero leakage: walk-forward expanding window across the 236 holdout fixtures.
"""

import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "matches.json"

def run_test():
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
                "over25": 1 if (int(r["FTHG"]) + int(r["FTAG"])) > 2.5 else 0,
                "btts": 1 if (int(r["FTHG"]) > 0 and int(r["FTAG"]) > 0) else 0
            })
        except (ValueError, TypeError, KeyError):
            continue
            
    matches.sort(key=lambda m: m["date"])
    cut = int(len(matches) * 0.7)
    train_pool = matches[:cut]
    test_pool = matches[cut:]
    
    # Simple L2-regularized logistic regression solver in pure Python
    def fit_l2_logistic(X, y, l2_reg=1.0, lr=0.05, max_iter=200):
        # Add intercept
        n = len(y)
        k = len(X[0]) + 1
        X_design = [[1.0] + row for row in X]
        w = [0.0] * k
        
        # Initialize intercept with logit of mean y
        mean_y = max(1e-4, min(1.0 - 1e-4, sum(y) / n))
        w[0] = math.log(mean_y / (1.0 - mean_y))
        
        for _ in range(max_iter):
            grads = [0.0] * k
            for row, target in zip(X_design, y):
                dot = sum(wi * xi for wi, xi in zip(w, row))
                dot = max(-15.0, min(15.0, dot))
                p = 1.0 / (1.0 + math.exp(-dot))
                err = p - target
                for j in range(k):
                    grads[j] += err * row[j]
                    
            for j in range(k):
                grads[j] /= n
                if j > 0:  # Regularize weights, not intercept
                    grads[j] += (l2_reg / n) * w[j]
                w[j] -= lr * grads[j]
        return w

    def predict_l2_logistic(w, row):
        dot = w[0] + sum(wi * xi for wi, xi in zip(w[1:], row))
        dot = max(-15.0, min(15.0, dot))
        return 1.0 / (1.0 + math.exp(-dot))

    # Pre-compute rolling statistics up to each match
    # Feature 1: Expected SoT (Home SoT Created + Away SoT Conceded)/2 + (Away SoT Created + Home SoT Conceded)/2
    # Feature 2: Expected Total Shots
    # Feature 3: Rolling goal averages
    records = []
    
    # Replicate exact walk-forward structure as AG-028/029/030
    history = list(train_pool)
    
    i = 0
    while i < len(test_pool):
        j = i + 1
        while j < len(test_pool) and test_pool[j]["date"] == test_pool[i]["date"]:
            j += 1
        day = test_pool[i:j]
        
        # Build training dataset strictly from history (< day)
        # Compute team stats on history
        team_games = defaultdict(list)
        for m in history:
            team_games[m["home"]].append({"role": "H", "gf": m["hg"], "ga": m["ag"], "sf": m["hs"], "sa": m["as_shots"], "stf": m["hst"], "sta": m["ast"]})
            team_games[m["away"]].append({"role": "A", "gf": m["ag"], "ga": m["hg"], "sf": m["as_shots"], "sa": m["hs"], "stf": m["ast"], "sta": m["hst"]})
            
        def extract_features(m, t_games):
            h_g = t_games[m["home"]]
            a_g = t_games[m["away"]]
            if len(h_g) < 5 or len(a_g) < 5:
                return None
            h_rec = h_g[-8:]
            a_rec = a_g[-8:]
            
            # Mean shots on target
            h_st_f = sum(x["stf"] for x in h_rec) / len(h_rec)
            h_st_a = sum(x["sta"] for x in h_rec) / len(h_rec)
            a_st_f = sum(x["stf"] for x in a_rec) / len(a_rec)
            a_st_a = sum(x["sta"] for x in a_rec) / len(a_rec)
            
            exp_sot_h = (h_st_f + a_st_a) / 2.0
            exp_sot_a = (a_st_f + h_st_a) / 2.0
            exp_sot_tot = exp_sot_h + exp_sot_a
            
            # Mean total shots
            h_s_f = sum(x["sf"] for x in h_rec) / len(h_rec)
            h_s_a = sum(x["sa"] for x in h_rec) / len(h_rec)
            a_s_f = sum(x["sf"] for x in a_rec) / len(a_rec)
            a_s_a = sum(x["sa"] for x in a_rec) / len(a_rec)
            exp_s_tot = (h_s_f + a_s_a + a_s_f + h_s_a) / 2.0
            
            # Mean goals
            h_gf = sum(x["gf"] for x in h_rec) / len(h_rec)
            h_ga = sum(x["ga"] for x in h_rec) / len(h_rec)
            a_gf = sum(x["gf"] for x in a_rec) / len(a_rec)
            a_ga = sum(x["ga"] for x in a_rec) / len(a_rec)
            exp_g_tot = (h_gf + a_ga + a_gf + h_ga) / 2.0
            
            return [exp_sot_tot, exp_s_tot, exp_g_tot, exp_sot_h * exp_sot_a]

        # Build training matrices from history (matches that had enough history)
        X_train = []
        y_train_over = []
        y_train_btts = []
        
        # Rolling features inside history
        rolling_team_games = defaultdict(list)
        for m in history:
            feats = extract_features(m, rolling_team_games)
            if feats is not None:
                X_train.append(feats)
                y_train_over.append(m["over25"])
                y_train_btts.append(m["btts"])
                
            rolling_team_games[m["home"]].append({"role": "H", "gf": m["hg"], "ga": m["ag"], "sf": m["hs"], "sa": m["as_shots"], "stf": m["hst"], "sta": m["ast"]})
            rolling_team_games[m["away"]].append({"role": "A", "gf": m["ag"], "ga": m["hg"], "sf": m["as_shots"], "sa": m["hs"], "stf": m["ast"], "sta": m["hst"]})
            
        # Fit models on history
        base_over = sum(m["over25"] for m in history) / len(history)
        base_btts = sum(m["btts"] for m in history) / len(history)
        
        # Standardize features (Z-score)
        means = [sum(row[k] for row in X_train) / len(X_train) for k in range(len(X_train[0]))]
        stds = [math.sqrt(sum((row[k] - means[k])**2 for row in X_train) / len(X_train)) or 1.0 for k in range(len(X_train[0]))]
        
        X_train_scaled = [[(val - m_k) / s_k for val, m_k, s_k in zip(row, means, stds)] for row in X_train]
        
        w_over = fit_l2_logistic(X_train_scaled, y_train_over, l2_reg=5.0)
        w_btts = fit_l2_logistic(X_train_scaled, y_train_btts, l2_reg=5.0)
        
        for m in day:
            # Check venue gate as in AG-028/029/030
            h_v = [r for r in history if r["home"] == m["home"]][-10:]
            a_v = [r for r in history if r["away"] == m["away"]][-10:]
            if len(h_v) < 5 or len(a_v) < 5:
                continue
                
            f = extract_features(m, team_games)
            if f is None:
                continue
                
            f_scaled = [(val - m_k) / s_k for val, m_k, s_k in zip(f, means, stds)]
            pred_over = predict_l2_logistic(w_over, f_scaled)
            pred_btts = predict_l2_logistic(w_btts, f_scaled)
            
            records.append({
                "actual_over25": m["over25"],
                "actual_btts": m["btts"],
                "base_over25": base_over,
                "base_btts": base_btts,
                "pred_over25": pred_over,
                "pred_btts": pred_btts
            })
            
        history.extend(day)
        i = j
        
    print(f"Evaluated matches: {len(records)}")
    
    # Goals Over 2.5
    y_over = [r["actual_over25"] for r in records]
    b_base_over = sum((r["base_over25"] - r["actual_over25"])**2 for r in records) / len(records)
    b_model_over = sum((r["pred_over25"] - r["actual_over25"])**2 for r in records) / len(records)
    bss_over = 1.0 - (b_model_over / b_base_over)
    
    # BTTS
    y_btts = [r["actual_btts"] for r in records]
    b_base_btts = sum((r["base_btts"] - r["actual_btts"])**2 for r in records) / len(records)
    b_model_btts = sum((r["pred_btts"] - r["actual_btts"])**2 for r in records) / len(records)
    bss_btts = 1.0 - (b_model_btts / b_base_btts)
    
    print("\n--- RESULTS: L2 LOGISTIC REGRESSION WITH SHOTS ON TARGET ---")
    print(f"Goals Over 2.5: Baseline Brier = {b_base_over:.4f} | Model Brier = {b_model_over:.4f} | BSS = {bss_over*100:+.2f}%")
    print(f"BTTS Yes      : Baseline Brier = {b_base_btts:.4f} | Model Brier = {b_model_btts:.4f} | BSS = {bss_btts*100:+.2f}%")

if __name__ == "__main__":
    run_test()
