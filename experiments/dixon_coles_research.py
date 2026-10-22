"""MatchIQ Research Mission AG-029: Goals and BTTS Dixon-Coles Challenger.
Isolated offline experiment. Zero changes to production code or ledgers.
Pure Python implementation of Dixon-Coles joint distribution solver.
"""

import json
import math
import random
from collections import Counter
from datetime import datetime
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "matches.json"

class DixonColesGoalModel:
    """Exact Dixon-Coles (1997) goal model with low-score correlation tau."""
    def __init__(self, home_goals, away_goals, home_teams, away_teams):
        self.home_goals = home_goals
        self.away_goals = away_goals
        self.home_teams = home_teams
        self.away_teams = away_teams
        
        self.teams = sorted(list(set(home_teams) | set(away_teams)))
        self.team_idx = {t: i for i, t in enumerate(self.teams)}
        self.n_teams = len(self.teams)
        
        self.a = [0.0] * self.n_teams # Attack
        self.b = [0.0] * self.n_teams # Defense
        self.home_adv = 0.25 # Home advantage
        self.rho = -0.05 # Low score correlation
        self.fitted = False

    def _unpack(self, theta):
        a = [0.0] * self.n_teams
        for i in range(self.n_teams - 1):
            a[i + 1] = theta[i]
        a[0] = -sum(a[1:]) # Zero-sum constraint on log attack
        b = list(theta[self.n_teams - 1 : 2 * self.n_teams - 1])
        home = theta[2 * self.n_teams - 1]
        rho = theta[2 * self.n_teams]
        return a, b, home, rho

    def _loss_and_grad(self, theta):
        a, b, home, rho = self._unpack(theta)
        loss = 0.0
        grad_a = [0.0] * self.n_teams
        grad_b = [0.0] * self.n_teams
        grad_home = 0.0
        grad_rho = 0.0
        
        n_obs = len(self.home_goals)
        for k in range(n_obs):
            h, aw = self.home_teams[k], self.away_teams[k]
            x, y = self.home_goals[k], self.away_goals[k]
            hi, ai = self.team_idx[h], self.team_idx[aw]
            
            lam = math.exp(a[hi] + b[ai] + home)
            mu = math.exp(a[ai] + b[hi])
            
            tau = 1.0
            dtau_dlam = 0.0
            dtau_dmu = 0.0
            dtau_drho = 0.0
            
            if x == 0 and y == 0:
                tau = 1.0 - lam * mu * rho
                dtau_dlam = -mu * rho
                dtau_dmu = -lam * rho
                dtau_drho = -lam * mu
            elif x == 1 and y == 0:
                tau = 1.0 + mu * rho
                dtau_dmu = rho
                dtau_drho = mu
            elif x == 0 and y == 1:
                tau = 1.0 + lam * rho
                dtau_dlam = rho
                dtau_drho = lam
            elif x == 1 and y == 1:
                tau = 1.0 - rho
                dtau_drho = -1.0
                
            if tau < 1e-8:
                tau = 1e-8
                
            term_x = x * math.log(lam) - lam - math.lgamma(x + 1)
            term_y = y * math.log(mu) - mu - math.lgamma(y + 1)
            loss -= (math.log(tau) + term_x + term_y)
            
            d_lam = (dtau_dlam / tau) + (x / lam - 1.0)
            d_mu = (dtau_dmu / tau) + (y / mu - 1.0)
            d_rho = dtau_drho / tau
            
            grad_a[hi] -= d_lam * lam
            grad_b[ai] -= d_lam * lam
            grad_home -= d_lam * lam
            grad_a[ai] -= d_mu * mu
            grad_b[hi] -= d_mu * mu
            grad_rho -= d_rho

        # Small L2 regularization (lambda = 0.005)
        l2 = 0.005
        for i in range(self.n_teams):
            loss += 0.5 * l2 * (a[i]**2 + b[i]**2)
            grad_a[i] += l2 * a[i]
            grad_b[i] += l2 * b[i]
        loss += 0.5 * l2 * (rho**2)
        grad_rho += l2 * rho

        # Chain rule for zero-sum constraint on a
        grad_theta = [0.0] * len(theta)
        for i in range(self.n_teams - 1):
            grad_theta[i] = grad_a[i + 1] - grad_a[0]
        for i in range(self.n_teams):
            grad_theta[self.n_teams - 1 + i] = grad_b[i]
        grad_theta[2 * self.n_teams - 1] = grad_home
        grad_theta[2 * self.n_teams] = grad_rho
        
        return loss, grad_theta

    def fit(self, max_iter=80):
        # Initial parameter vector
        n_params = 2 * self.n_teams + 1
        theta = [0.0] * n_params
        theta[2 * self.n_teams - 1] = 0.25 # Initial home advantage
        theta[2 * self.n_teams] = -0.05    # Initial rho
        
        loss, g = self._loss_and_grad(theta)
        s_history = []
        y_history = []
        rho_history = []
        m_memory = 7
        
        for _ in range(max_iter):
            gnorm = math.sqrt(sum(v*v for v in g))
            if gnorm < 1e-4:
                break
                
            q = list(g)
            k = len(s_history)
            alphas = [0.0] * k
            for i in reversed(range(k)):
                alphas[i] = rho_history[i] * sum(s_history[i][j] * q[j] for j in range(len(theta)))
                for j in range(len(theta)):
                    q[j] -= alphas[i] * y_history[i][j]
                    
            if k > 0:
                gamma_k = sum(s_history[-1][j] * y_history[-1][j] for j in range(len(theta))) / \
                          max(1e-12, sum(y_history[-1][j] * y_history[-1][j] for j in range(len(theta))))
            else:
                gamma_k = 1.0 / (gnorm + 1e-6)
                
            r = [gamma_k * q[j] for j in range(len(theta))]
            for i in range(k):
                beta = rho_history[i] * sum(y_history[i][j] * r[j] for j in range(len(theta)))
                for j in range(len(theta)):
                    r[j] += s_history[i][j] * (alphas[i] - beta)
                    
            p = [-r[j] for j in range(len(theta))]
            g_dot_p = sum(g[j] * p[j] for j in range(len(theta)))
            if g_dot_p >= 0:
                p = [-g[j] for j in range(len(theta))]
                g_dot_p = -gnorm * gnorm
                
            step = 1.0
            c1 = 1e-4
            theta_new = None
            loss_new = None
            g_new = None
            
            for _ in range(25):
                t_test = [theta[j] + step * p[j] for j in range(len(theta))]
                # Bounded box constraints
                rho_idx = 2 * self.n_teams
                t_test[rho_idx] = max(-0.25, min(0.15, t_test[rho_idx]))
                
                l_test, g_test = self._loss_and_grad(t_test)
                if l_test <= loss + c1 * step * g_dot_p:
                    theta_new = t_test
                    loss_new = l_test
                    g_new = g_test
                    break
                step *= 0.5
                
            if theta_new is None:
                break
                
            s = [theta_new[j] - theta[j] for j in range(len(theta))]
            y_diff = [g_new[j] - g[j] for j in range(len(theta))]
            ys = sum(y_diff[j] * s[j] for j in range(len(theta)))
            
            if ys > 1e-10:
                if len(s_history) >= m_memory:
                    s_history.pop(0)
                    y_history.pop(0)
                    rho_history.pop(0)
                s_history.append(s)
                y_history.append(y_diff)
                rho_history.append(1.0 / ys)
                
            theta = theta_new
            loss = loss_new
            g = g_new

        self.a, self.b, self.home_adv, self.rho = self._unpack(theta)
        self.fitted = True

    def predict(self, home_team, away_team, max_goals=10):
        if not self.fitted:
            raise RuntimeError("Model must be fitted before predict")
        if home_team not in self.team_idx or away_team not in self.team_idx:
            return None
            
        hi, ai = self.team_idx[home_team], self.team_idx[away_team]
        lam = math.exp(self.a[hi] + self.b[ai] + self.home_adv)
        mu = math.exp(self.a[ai] + self.b[hi])
        
        matrix = {}
        p_home_win = 0.0
        p_draw = 0.0
        p_away_win = 0.0
        p_over_25 = 0.0
        p_btts_yes = 0.0
        
        for x in range(max_goals + 1):
            for y in range(max_goals + 1):
                tau = 1.0
                if x == 0 and y == 0:
                    tau = 1.0 - lam * mu * self.rho
                elif x == 1 and y == 0:
                    tau = 1.0 + mu * self.rho
                elif x == 0 and y == 1:
                    tau = 1.0 + lam * self.rho
                elif x == 1 and y == 1:
                    tau = 1.0 - self.rho
                    
                prob = max(0.0, tau) * (lam**x * math.exp(-lam) / math.factorial(x)) * \
                                       (mu**y * math.exp(-mu) / math.factorial(y))
                matrix[(x, y)] = prob
                
                # Match Winner
                if x > y:
                    p_home_win += prob
                elif x < y:
                    p_away_win += prob
                else:
                    p_draw += prob
                    
                # Total Goals Over 2.5
                if (x + y) > 2.5:
                    p_over_25 += prob
                    
                # BTTS Yes
                if x > 0 and y > 0:
                    p_btts_yes += prob
                    
        total_mass = p_home_win + p_draw + p_away_win
        return {
            "lambda": lam,
            "mu": mu,
            "1X2": {
                "H": p_home_win / total_mass,
                "D": p_draw / total_mass,
                "A": p_away_win / total_mass
            },
            "goals_over_25": p_over_25 / total_mass,
            "btts_yes": p_btts_yes / total_mass,
            "matrix": matrix
        }


def run_experiment():
    print("=" * 70)
    print("MATCHIQ EXPERIMENT AG-029: GOALS & BTTS DIXON-COLES CHALLENGER")
    print("=" * 70)
    
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    raw_matches = payload.get("matches", [])
    
    matches = []
    for r in raw_matches:
        try:
            dt = datetime.strptime(r["Date"], "%d/%m/%Y")
            hg = int(r["FTHG"])
            ag = int(r["FTAG"])
            matches.append({
                "date": dt,
                "home": r["HomeTeam"],
                "away": r["AwayTeam"],
                "hg": hg,
                "ag": ag,
                "tot": hg + ag,
                "btts": 1 if hg > 0 and ag > 0 else 0,
                "over25": 1 if (hg + ag) > 2.5 else 0
            })
        except (ValueError, TypeError, KeyError):
            continue
            
    matches.sort(key=lambda m: m["date"])
    n_total = len(matches)
    cut = int(n_total * 0.7)
    train_pool = matches[:cut]
    test_pool = matches[cut:]
    
    print(f"Dataset: {n_total} total matches.")
    print(f"Training split: {len(train_pool)} matches (prior to {test_pool[0]['date'].strftime('%Y-%m-%d')}).")
    print(f"Holdout split:  {len(test_pool)} matches.")
    
    # Trackers for evaluated fixtures
    records = []
    
    # Walk-forward day by day
    history = list(train_pool)
    i = 0
    while i < len(test_pool):
        j = i + 1
        while j < len(test_pool) and test_pool[j]["date"] == test_pool[i]["date"]:
            j += 1
        day = test_pool[i:j]
        
        # Calculate training baseline on history (up to day D-1)
        base_over25 = sum(m["over25"] for m in history) / len(history)
        base_btts = sum(m["btts"] for m in history) / len(history)
        
        # Fit Dixon-Coles model on history
        dc_model = DixonColesGoalModel(
            [m["hg"] for m in history],
            [m["ag"] for m in history],
            [m["home"] for m in history],
            [m["away"] for m in history]
        )
        dc_model.fit(max_iter=60)
        
        for m in day:
            # Check venue eligibility gate (last 10 venue games, min 5)
            h_venue = [r for r in history if r["home"] == m["home"]][-10:]
            a_venue = [r for r in history if r["away"] == m["away"]][-10:]
            if len(h_venue) < 5 or len(a_venue) < 5:
                continue
                
            # Current experimental model: independent Poisson on venue means
            mean = lambda xs: sum(xs) / len(xs)
            home_exp = (mean([r["hg"] for r in h_venue]) + mean([r["hg"] for r in a_venue])) / 2.0
            away_exp = (mean([r["ag"] for r in a_venue]) + mean([r["ag"] for r in h_venue])) / 2.0
            tot_exp = home_exp + away_exp
            
            # Poisson Over 2.5: 1 - sum_{k=0}^2 (lambda^k e^-lambda / k!)
            term = math.exp(-tot_exp)
            cdf = term
            for k in range(1, 3):
                term *= tot_exp / k
                cdf += term
            pois_over25 = max(0.0, min(1.0, 1.0 - cdf))
            
            # Poisson BTTS: (1 - e^-home_exp) * (1 - e^-away_exp)
            pois_btts = (1.0 - math.exp(-home_exp)) * (1.0 - math.exp(-away_exp))
            
            # Challenger model: Dixon-Coles prediction
            pred_dc = dc_model.predict(m["home"], m["away"])
            if pred_dc is None:
                continue
            dc_over25 = pred_dc["goals_over_25"]
            dc_btts = pred_dc["btts_yes"]
            
            records.append({
                "date": m["date"],
                "home": m["home"],
                "away": m["away"],
                "actual_hg": m["hg"],
                "actual_ag": m["ag"],
                "actual_over25": m["over25"],
                "actual_btts": m["btts"],
                # Over 2.5 predictions
                "over25_base": base_over25,
                "over25_pois": pois_over25,
                "over25_dc": dc_over25,
                # BTTS predictions
                "btts_base": base_btts,
                "btts_pois": pois_btts,
                "btts_dc": dc_btts
            })
            
        history.extend(day)
        i = j

    n_eval = len(records)
    print(f"\nEvaluated matches meeting venue gate: {n_eval} matches.")
    
    # ----------------------------------------------------
    # Metric Calculations: Brier, BSS, Calibration, CI
    # ----------------------------------------------------
    def calc_metrics(actuals, preds, base_preds):
        brier = sum((p - y)**2 for p, y in zip(preds, actuals)) / len(actuals)
        base_brier = sum((p - y)**2 for p, y in zip(base_preds, actuals)) / len(actuals)
        bss = 1.0 - (brier / base_brier)
        
        # Expected Calibration Error (10 bins)
        bins = [[] for _ in range(10)]
        for p, y in zip(preds, actuals):
            b_idx = min(9, int(p * 10))
            bins[b_idx].append((p, y))
            
        ece = 0.0
        for b in bins:
            if b:
                avg_p = sum(x[0] for x in b) / len(b)
                avg_y = sum(x[1] for x in b) / len(b)
                ece += (len(b) / len(actuals)) * abs(avg_p - avg_y)
                
        # 1000 Bootstrap resamples for 95% CI on Brier
        random.seed(42)
        brier_boot = []
        diff_boot = [] # challenger - current model
        for _ in range(1000):
            sample_indices = [random.randint(0, len(actuals) - 1) for _ in range(len(actuals))]
            b_sample = sum((preds[k] - actuals[k])**2 for k in sample_indices) / len(actuals)
            brier_boot.append(b_sample)
            
        brier_boot.sort()
        ci_lower = brier_boot[25]
        ci_upper = brier_boot[975]
        return brier, bss, ece, ci_lower, ci_upper

    # Goals Over 2.5
    y_over25 = [r["actual_over25"] for r in records]
    p_over25_base = [r["over25_base"] for r in records]
    p_over25_pois = [r["over25_pois"] for r in records]
    p_over25_dc = [r["over25_dc"] for r in records]
    
    b_g_base, _, ece_g_base, ci_l_g_base, ci_u_g_base = calc_metrics(y_over25, p_over25_base, p_over25_base)
    b_g_pois, bss_g_pois, ece_g_pois, ci_l_g_pois, ci_u_g_pois = calc_metrics(y_over25, p_over25_pois, p_over25_base)
    b_g_dc, bss_g_dc, ece_g_dc, ci_l_g_dc, ci_u_g_dc = calc_metrics(y_over25, p_over25_dc, p_over25_base)
    
    # Statistical significance: Paired permutation test (10,000 permutations)
    # Testing H0: DC Brier == Poisson Brier
    diffs_g = [(p_dc - y)**2 - (p_pois - y)**2 for p_dc, p_pois, y in zip(p_over25_dc, p_over25_pois, y_over25)]
    obs_diff_g = sum(diffs_g) / n_eval
    perm_diffs_g = []
    for _ in range(10000):
        signs = [1 if random.random() < 0.5 else -1 for _ in range(n_eval)]
        perm_diffs_g.append(sum(d * s for d, s in zip(diffs_g, signs)) / n_eval)
    p_val_g = sum(1 for pd in perm_diffs_g if pd <= obs_diff_g) / 10000.0

    # BTTS
    y_btts = [r["actual_btts"] for r in records]
    p_btts_base = [r["btts_base"] for r in records]
    p_btts_pois = [r["btts_pois"] for r in records]
    p_btts_dc = [r["btts_dc"] for r in records]
    
    b_b_base, _, ece_b_base, ci_l_b_base, ci_u_b_base = calc_metrics(y_btts, p_btts_base, p_btts_base)
    b_b_pois, bss_b_pois, ece_b_pois, ci_l_b_pois, ci_u_b_pois = calc_metrics(y_btts, p_btts_pois, p_btts_base)
    b_b_dc, bss_b_dc, ece_b_dc, ci_l_b_dc, ci_u_b_dc = calc_metrics(y_btts, p_btts_dc, p_btts_base)
    
    diffs_b = [(p_dc - y)**2 - (p_pois - y)**2 for p_dc, p_pois, y in zip(p_btts_dc, p_btts_pois, y_btts)]
    obs_diff_b = sum(diffs_b) / n_eval
    perm_diffs_b = []
    for _ in range(10000):
        signs = [1 if random.random() < 0.5 else -1 for _ in range(n_eval)]
        perm_diffs_b.append(sum(d * s for d, s in zip(diffs_b, signs)) / n_eval)
    p_val_b = sum(1 for pd in perm_diffs_b if pd <= obs_diff_b) / 10000.0

    print("\n" + "=" * 70)
    print("RESULTS: TOTAL GOALS (OVER 2.5)")
    print("=" * 70)
    print(f"Sample size: N = {n_eval} | Empirical Hit Rate = {sum(y_over25)/n_eval*100:.1f}%")
    print(f"1. Unconditional Baseline : Brier = {b_g_base:.4f} | 95% CI [{ci_l_g_base:.4f}, {ci_u_g_base:.4f}] | ECE = {ece_g_base:.4f}")
    print(f"2. Current Ind. Poisson   : Brier = {b_g_pois:.4f} | 95% CI [{ci_l_g_pois:.4f}, {ci_u_g_pois:.4f}] | BSS = {bss_g_pois:+.4f} | ECE = {ece_g_pois:.4f}")
    print(f"3. Dixon-Coles Challenger : Brier = {b_g_dc:.4f} | 95% CI [{ci_l_g_dc:.4f}, {ci_u_g_dc:.4f}] | BSS = {bss_g_dc:+.4f} | ECE = {ece_g_dc:.4f}")
    print(f"Delta (DC vs Poisson)     : {obs_diff_g:+.4f} ({obs_diff_g/b_g_pois*100:+.2f}%) | Permutation p-value = {p_val_g:.4f}")

    print("\n" + "=" * 70)
    print("RESULTS: BOTH TEAMS TO SCORE (BTTS YES)")
    print("=" * 70)
    print(f"Sample size: N = {n_eval} | Empirical Hit Rate = {sum(y_btts)/n_eval*100:.1f}%")
    print(f"1. Unconditional Baseline : Brier = {b_b_base:.4f} | 95% CI [{ci_l_b_base:.4f}, {ci_u_b_base:.4f}] | ECE = {ece_b_base:.4f}")
    print(f"2. Current Ind. Poisson   : Brier = {b_b_pois:.4f} | 95% CI [{ci_l_b_pois:.4f}, {ci_u_b_pois:.4f}] | BSS = {bss_b_pois:+.4f} | ECE = {ece_b_pois:.4f}")
    print(f"3. Dixon-Coles Challenger : Brier = {b_b_dc:.4f} | 95% CI [{ci_l_b_dc:.4f}, {ci_u_b_dc:.4f}] | BSS = {bss_b_dc:+.4f} | ECE = {ece_b_dc:.4f}")
    print(f"Delta (DC vs Poisson)     : {obs_diff_b:+.4f} ({obs_diff_b/b_b_pois*100:+.2f}%) | Permutation p-value = {p_val_b:.4f}")

    # Return structured dict
    return {
        "n": n_eval,
        "goals": {
            "hit_rate": sum(y_over25)/n_eval,
            "base": {"brier": b_g_base, "ci": [ci_l_g_base, ci_u_g_base], "ece": ece_g_base},
            "poisson": {"brier": b_g_pois, "bss": bss_g_pois, "ci": [ci_l_g_pois, ci_u_g_pois], "ece": ece_g_pois},
            "dc": {"brier": b_g_dc, "bss": bss_g_dc, "ci": [ci_l_g_dc, ci_u_g_dc], "ece": ece_g_dc},
            "diff": obs_diff_g,
            "p_val": p_val_g
        },
        "btts": {
            "hit_rate": sum(y_btts)/n_eval,
            "base": {"brier": b_b_base, "ci": [ci_l_b_base, ci_u_b_base], "ece": ece_b_base},
            "poisson": {"brier": b_b_pois, "bss": bss_b_pois, "ci": [ci_l_b_pois, ci_u_b_pois], "ece": ece_b_pois},
            "dc": {"brier": b_b_dc, "bss": bss_b_dc, "ci": [ci_l_b_dc, ci_u_b_dc], "ece": ece_b_dc},
            "diff": obs_diff_b,
            "p_val": p_val_b
        }
    }

if __name__ == "__main__":
    run_experiment()
