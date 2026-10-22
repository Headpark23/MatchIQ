"""MatchIQ Mission AG-030: Goals & BTTS Probability Calibration Challenge.
Isolated offline research experiment. Zero production changes.
Evaluates Beta calibration, Logistic/Platt calibration, and Historical Shrinkage.
"""

from __future__ import annotations

import json
import math
import random
import sys
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path
from typing import Protocol

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from experiments.dixon_coles_research import DixonColesGoalModel

DATA_PATH = ROOT_DIR / "data" / "matches.json"


# =====================================================================
# Statistical Scoring and Integrity Metrics
# =====================================================================

def brier_score(preds: Sequence[float], actuals: Sequence[int | float]) -> float:
    """Mean squared error between predicted probabilities and binary outcomes."""
    if not preds or len(preds) != len(actuals):
        raise ValueError("preds and actuals must be non-empty and of identical length.")
    return sum((p - y) ** 2 for p, y in zip(preds, actuals)) / len(actuals)


def brier_skill_score(model_brier: float, base_brier: float) -> float:
    """Brier Skill Score (BSS) relative to a reference baseline.
    Positive indicates skill over reference; negative indicates worse performance.
    """
    if base_brier <= 0:
        return 0.0
    return 1.0 - (model_brier / base_brier)


def log_loss(preds: Sequence[float], actuals: Sequence[int | float], eps: float = 1e-6) -> float:
    """Binary cross-entropy loss between predicted probabilities and binary outcomes."""
    if not preds or len(preds) != len(actuals):
        raise ValueError("preds and actuals must be non-empty and of identical length.")
    total = 0.0
    for p, y in zip(preds, actuals):
        p_c = max(eps, min(1.0 - eps, float(p)))
        total += y * math.log(p_c) + (1.0 - y) * math.log(1.0 - p_c)
    return -total / len(actuals)


def expected_calibration_error(preds: Sequence[float], actuals: Sequence[int | float], n_bins: int = 10) -> float:
    """Expected Calibration Error (ECE) across uniform probability bins."""
    if not preds or len(preds) != len(actuals):
        raise ValueError("preds and actuals must be non-empty and of identical length.")
    
    bins = [[] for _ in range(n_bins)]
    for p, y in zip(preds, actuals):
        bin_idx = min(n_bins - 1, max(0, int(p * n_bins)))
        bins[bin_idx].append((p, y))
        
    ece = 0.0
    n = len(actuals)
    for b in bins:
        if b:
            avg_p = sum(x[0] for x in b) / len(b)
            avg_y = sum(x[1] for x in b) / len(b)
            ece += (len(b) / n) * abs(avg_p - avg_y)
    return ece


def verify_chronological_integrity(training_dates: Sequence[datetime], evaluation_date: datetime) -> bool:
    """Strict anti-leakage verification:
    All training dates must be strictly prior to evaluation date (< eval_date).
    Same-day fixtures (== eval_date) or future fixtures (> eval_date) are forbidden in training.
    """
    if not training_dates:
        return True
    return all(d < evaluation_date for d in training_dates)


# =====================================================================
# Calibrator Implementations
# =====================================================================

class Calibrator(Protocol):
    def predict(self, p: float) -> float: ...


class ShrinkageCalibrator:
    """Shrinks raw probabilities toward the historical base rate:
    p_cal = (1 - alpha) * p_raw + alpha * base_rate
    """
    def __init__(self, alpha: float = 0.5, base_rate: float = 0.5) -> None:
        self.alpha = max(0.0, min(1.0, alpha))
        self.base_rate = max(0.0, min(1.0, base_rate))

    def fit(self, raw_probs: Sequence[float], actuals: Sequence[int], base_rate: float | None = None) -> None:
        """Find the optimal shrinkage alpha that minimizes Brier score on calibration history."""
        if base_rate is not None:
            self.base_rate = base_rate
        elif actuals:
            self.base_rate = sum(actuals) / len(actuals)

        if not raw_probs or len(raw_probs) < 5:
            self.alpha = 0.5
            return

        # Grid search over alpha in [0.0, 1.0] with step 0.05
        best_alpha = 0.0
        best_score = float("inf")
        for step in range(21):
            a = step * 0.05
            score = sum(
                (((1.0 - a) * p + a * self.base_rate) - y) ** 2
                for p, y in zip(raw_probs, actuals)
            ) / len(actuals)
            if score < best_score:
                best_score = score
                best_alpha = a
        self.alpha = best_alpha

    def predict(self, p: float) -> float:
        p_clipped = max(1e-6, min(1.0 - 1e-6, p))
        res = (1.0 - self.alpha) * p_clipped + self.alpha * self.base_rate
        return max(0.0, min(1.0, res))


class LogisticCalibrator:
    """Platt Scaling: logistic regression on raw logits.
    p_cal = 1 / (1 + exp(-(A * logit(p_raw) + B)))
    Monotonicity constraint: A >= 0.
    """
    def __init__(self, a: float = 1.0, b: float = 0.0) -> None:
        self.a = a
        self.b = b

    def _logit(self, p: float) -> float:
        p = max(1e-5, min(1.0 - 1e-5, p))
        return math.log(p / (1.0 - p))

    def fit(self, raw_probs: Sequence[float], actuals: Sequence[int], max_iter: int = 150) -> None:
        """Fit parameters A and B via gradient descent with negative log-likelihood loss."""
        if len(raw_probs) < 10 or sum(actuals) == 0 or sum(actuals) == len(actuals):
            self.a = 1.0
            self.b = 0.0
            return

        logits = [self._logit(p) for p in raw_probs]
        n = len(raw_probs)

        mean_y = sum(actuals) / n
        mean_y = max(1e-4, min(1.0 - 1e-4, mean_y))
        a = 1.0
        b = math.log(mean_y / (1.0 - mean_y))

        lr = 0.05
        for _ in range(max_iter):
            grad_a = 0.0
            grad_b = 0.0
            for z, y in zip(logits, actuals):
                val = a * z + b
                val = max(-15.0, min(15.0, val))
                p_hat = 1.0 / (1.0 + math.exp(-val))
                err = p_hat - y
                grad_a += err * z
                grad_b += err

            grad_a /= n
            grad_b /= n

            # Mild L2 regularization
            grad_a += 0.01 * (a - 1.0)
            grad_b += 0.01 * b

            a -= lr * grad_a
            b -= lr * grad_b
            if a < 0.0:  # Monotonicity
                a = 0.0

        self.a = a
        self.b = b

    def predict(self, p: float) -> float:
        z = self._logit(p)
        val = self.a * z + self.b
        val = max(-15.0, min(15.0, val))
        return 1.0 / (1.0 + math.exp(-val))


class BetaCalibrator:
    """Beta Calibration (Kull, Silva Filho, Flach 2017).
    Maps p via:
    logit(p_cal) = a * ln(p) - b * ln(1 - p) + c
    with constraints a >= 0, b >= 0 to ensure monotonicity.
    """
    def __init__(self, a: float = 1.0, b: float = 1.0, c: float = 0.0) -> None:
        self.a = a
        self.b = b
        self.c = c

    def fit(self, raw_probs: Sequence[float], actuals: Sequence[int], max_iter: int = 150) -> None:
        """Fit parameters a, b, c using regularized logistic regression."""
        if len(raw_probs) < 15 or sum(actuals) == 0 or sum(actuals) == len(actuals):
            self.a = 1.0
            self.b = 1.0
            self.c = 0.0
            return

        eps = 1e-5
        x1_list = [math.log(max(eps, min(1.0 - eps, p))) for p in raw_probs]
        x2_list = [-math.log(max(eps, min(1.0 - eps, 1.0 - p))) for p in raw_probs]
        n = len(raw_probs)

        a, b, c = 1.0, 1.0, 0.0
        lr = 0.03
        for _ in range(max_iter):
            ga, gb, gc = 0.0, 0.0, 0.0
            for x1, x2, y in zip(x1_list, x2_list, actuals):
                val = a * x1 + b * x2 + c
                val = max(-15.0, min(15.0, val))
                p_hat = 1.0 / (1.0 + math.exp(-val))
                err = p_hat - y
                ga += err * x1
                gb += err * x2
                gc += err

            ga /= n
            gb /= n
            gc /= n

            # Regularize towards identity (a=1, b=1, c=0)
            ga += 0.02 * (a - 1.0)
            gb += 0.02 * (b - 1.0)
            gc += 0.02 * c

            a -= lr * ga
            b -= lr * gb
            c -= lr * gc

            if a < 0.0:
                a = 0.0
            if b < 0.0:
                b = 0.0

        self.a = a
        self.b = b
        self.c = c

    def predict(self, p: float) -> float:
        eps = 1e-5
        x1 = math.log(max(eps, min(1.0 - eps, p)))
        x2 = -math.log(max(eps, min(1.0 - eps, 1.0 - p)))
        val = self.a * x1 + self.b * x2 + self.c
        val = max(-15.0, min(15.0, val))
        return 1.0 / (1.0 + math.exp(-val))


class IsotonicCalibrator:
    """Non-parametric Isotonic Regression using Pool-Adjacent-Violators Algorithm (PAVA).
    Fits a monotonic non-decreasing mapping p -> p_cal that minimizes squared error.
    Interpolates linearly between step thresholds for out-of-sample prediction.
    """
    def __init__(self) -> None:
        self.points: list[tuple[float, float]] = [(0.0, 0.0), (1.0, 1.0)]

    def fit(self, raw_probs: Sequence[float], actuals: Sequence[int | float]) -> None:
        if len(raw_probs) < 5:
            self.points = [(0.0, 0.0), (1.0, 1.0)]
            return

        # Sort pairs by raw probability
        pairs = sorted(zip(raw_probs, actuals), key=lambda x: x[0])
        
        # PAVA block representation: each block has [p_sum, y_sum, weight]
        blocks: list[list[float]] = [[p, float(y), 1.0] for p, y in pairs]
        
        # Merge violators: while any block has mean_y > next_block mean_y
        i = 0
        while i < len(blocks) - 1:
            mean_curr = blocks[i][1] / blocks[i][2]
            mean_next = blocks[i + 1][1] / blocks[i + 1][2]
            if mean_curr > mean_next:
                # Violator! Pool blocks[i] and blocks[i+1]
                b1 = blocks.pop(i)
                b2 = blocks.pop(i)
                merged = [b1[0] + b2[0], b1[1] + b2[1], b1[2] + b2[2]]
                blocks.insert(i, merged)
                # Check backwards
                if i > 0:
                    i -= 1
            else:
                i += 1
                
        # Extract monotonic points (mean_p, mean_y)
        raw_points = [(b[0] / b[2], max(0.0, min(1.0, b[1] / b[2]))) for b in blocks]
        
        # Ensure boundaries at 0.0 and 1.0
        points = []
        if raw_points[0][0] > 0.0:
            points.append((0.0, raw_points[0][1]))
        points.extend(raw_points)
        if points[-1][0] < 1.0:
            points.append((1.0, raw_points[-1][1]))
            
        self.points = points

    def predict(self, p: float) -> float:
        p_c = max(0.0, min(1.0, float(p)))
        if p_c <= self.points[0][0]:
            return self.points[0][1]
        if p_c >= self.points[-1][0]:
            return self.points[-1][1]
            
        # Linear interpolation between adjacent isotonic points
        for k in range(len(self.points) - 1):
            p0, y0 = self.points[k]
            p1, y1 = self.points[k + 1]
            if p0 <= p_c <= p1:
                if p1 == p0:
                    return y0
                t = (p_c - p0) / (p1 - p0)
                return max(0.0, min(1.0, y0 + t * (y1 - y0)))
                
        return self.points[-1][1]


# =====================================================================
# Walk-Forward Simulation and Evaluation Engine
# =====================================================================

def compute_poisson_probs(history: list[dict], home_team: str, away_team: str) -> tuple[float, float] | None:
    """Venue-based Poisson model from MatchIQ experimental engine."""
    h_venue = [r for r in history if r["home"] == home_team][-10:]
    a_venue = [r for r in history if r["away"] == away_team][-10:]
    if len(h_venue) < 5 or len(a_venue) < 5:
        return None
    
    mean = lambda xs: sum(xs) / len(xs)
    home_exp = (mean([r["hg"] for r in h_venue]) + mean([r["hg"] for r in a_venue])) / 2.0
    away_exp = (mean([r["ag"] for r in a_venue]) + mean([r["ag"] for r in h_venue])) / 2.0
    tot_exp = home_exp + away_exp
    
    # Over 2.5: 1 - sum_{k=0}^2 (lambda^k e^-lambda / k!)
    term = math.exp(-tot_exp)
    cdf = term
    for k in range(1, 3):
        term *= tot_exp / k
        cdf += term
    p_over25 = max(0.0, min(1.0, 1.0 - cdf))
    
    # BTTS: (1 - e^-home_exp) * (1 - e^-away_exp)
    p_btts = (1.0 - math.exp(-home_exp)) * (1.0 - math.exp(-away_exp))
    return p_over25, p_btts


def run_calibration_experiment():
    print("=" * 75)
    print("MATCHIQ EXPERIMENT AG-030: GOALS & BTTS PROBABILITY CALIBRATION CHALLENGE")
    print("=" * 75)
    
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
    print(f"Initial history: {len(train_pool)} matches prior to {test_pool[0]['date'].strftime('%Y-%m-%d')}.")
    print(f"Holdout pool:    {len(test_pool)} matches.")
    
    # Step 1: Pre-populate calibration history from training pool
    # Run walk-forward through the latter half of the training pool (matches 300 to 580)
    # to obtain pre-holdout out-of-sample predictions.
    print("\nGenerating pre-holdout out-of-sample calibration pool...")
    cal_history_over25 = {"dates": [], "actuals": [], "pois": [], "dc": []}
    cal_history_btts = {"dates": [], "actuals": [], "pois": [], "dc": []}
    
    # To be fast and accurate, fit DC model every 20 games in training pool
    dc_train_model = None
    last_fit_idx = 0
    for idx in range(300, len(train_pool)):
        m = train_pool[idx]
        hist_so_far = train_pool[:idx]
        
        # Check venue gate
        pois_res = compute_poisson_probs(hist_so_far, m["home"], m["away"])
        if pois_res is None:
            continue
            
        p_pois_g, p_pois_b = pois_res
        
        if dc_train_model is None or (idx - last_fit_idx) >= 25:
            dc_train_model = DixonColesGoalModel(
                [x["hg"] for x in hist_so_far],
                [x["ag"] for x in hist_so_far],
                [x["home"] for x in hist_so_far],
                [x["away"] for x in hist_so_far]
            )
            dc_train_model.fit(max_iter=40)
            last_fit_idx = idx
            
        pred_dc = dc_train_model.predict(m["home"], m["away"])
        if pred_dc is None:
            continue
            
        cal_history_over25["dates"].append(m["date"])
        cal_history_over25["actuals"].append(m["over25"])
        cal_history_over25["pois"].append(p_pois_g)
        cal_history_over25["dc"].append(pred_dc["goals_over_25"])
        
        cal_history_btts["dates"].append(m["date"])
        cal_history_btts["actuals"].append(m["btts"])
        cal_history_btts["pois"].append(p_pois_b)
        cal_history_btts["dc"].append(pred_dc["btts_yes"])
        
    print(f"Pre-holdout calibration pairs available: {len(cal_history_over25['actuals'])} matches.")
    
    # Step 2: Strict walk-forward evaluation across the 249 holdout matches (236 eligible)
    records = []
    history = list(train_pool)
    
    i = 0
    while i < len(test_pool):
        j = i + 1
        while j < len(test_pool) and test_pool[j]["date"] == test_pool[i]["date"]:
            j += 1
        day = test_pool[i:j]
        eval_date = test_pool[i]["date"]
        
        # Anti-leakage assertion: verify all calibration training dates are strictly before today
        assert verify_chronological_integrity(cal_history_over25["dates"], eval_date), \
            f"LEAKAGE DETECTED on {eval_date.strftime('%Y-%m-%d')}!"
            
        # Fit Dixon-Coles on history up to day D-1
        dc_model = DixonColesGoalModel(
            [m["hg"] for m in history],
            [m["ag"] for m in history],
            [m["home"] for m in history],
            [m["away"] for m in history]
        )
        dc_model.fit(max_iter=60)
        
        # Base rates up to day D-1
        base_over25 = sum(m["over25"] for m in history) / len(history)
        base_btts = sum(m["btts"] for m in history) / len(history)
        
        # Fit calibrators on calibration history (strictly prior to today)
        # Goals Over 2.5 Calibrators
        shrink_g_pois = ShrinkageCalibrator(base_rate=base_over25)
        shrink_g_pois.fit(cal_history_over25["pois"], cal_history_over25["actuals"], base_rate=base_over25)
        
        shrink_g_dc = ShrinkageCalibrator(base_rate=base_over25)
        shrink_g_dc.fit(cal_history_over25["dc"], cal_history_over25["actuals"], base_rate=base_over25)
        
        platt_g_pois = LogisticCalibrator()
        platt_g_pois.fit(cal_history_over25["pois"], cal_history_over25["actuals"])
        
        platt_g_dc = LogisticCalibrator()
        platt_g_dc.fit(cal_history_over25["dc"], cal_history_over25["actuals"])
        
        beta_g_pois = BetaCalibrator()
        beta_g_pois.fit(cal_history_over25["pois"], cal_history_over25["actuals"])
        
        beta_g_dc = BetaCalibrator()
        beta_g_dc.fit(cal_history_over25["dc"], cal_history_over25["actuals"])

        iso_g_pois = IsotonicCalibrator()
        iso_g_pois.fit(cal_history_over25["pois"], cal_history_over25["actuals"])

        iso_g_dc = IsotonicCalibrator()
        iso_g_dc.fit(cal_history_over25["dc"], cal_history_over25["actuals"])
        
        # BTTS Calibrators
        shrink_b_pois = ShrinkageCalibrator(base_rate=base_btts)
        shrink_b_pois.fit(cal_history_btts["pois"], cal_history_btts["actuals"], base_rate=base_btts)
        
        shrink_b_dc = ShrinkageCalibrator(base_rate=base_btts)
        shrink_b_dc.fit(cal_history_btts["dc"], cal_history_btts["actuals"], base_rate=base_btts)
        
        platt_b_pois = LogisticCalibrator()
        platt_b_pois.fit(cal_history_btts["pois"], cal_history_btts["actuals"])
        
        platt_b_dc = LogisticCalibrator()
        platt_b_dc.fit(cal_history_btts["dc"], cal_history_btts["actuals"])
        
        beta_b_pois = BetaCalibrator()
        beta_b_pois.fit(cal_history_btts["pois"], cal_history_btts["actuals"])
        
        beta_b_dc = BetaCalibrator()
        beta_b_dc.fit(cal_history_btts["dc"], cal_history_btts["actuals"])

        iso_b_pois = IsotonicCalibrator()
        iso_b_pois.fit(cal_history_btts["pois"], cal_history_btts["actuals"])

        iso_b_dc = IsotonicCalibrator()
        iso_b_dc.fit(cal_history_btts["dc"], cal_history_btts["actuals"])
        
        day_records = []
        for m in day:
            pois_res = compute_poisson_probs(history, m["home"], m["away"])
            if pois_res is None:
                continue
            pois_g, pois_b = pois_res
            
            pred_dc = dc_model.predict(m["home"], m["away"])
            if pred_dc is None:
                continue
            dc_g = pred_dc["goals_over_25"]
            dc_b = pred_dc["btts_yes"]
            
            rec = {
                "date": m["date"],
                "home": m["home"],
                "away": m["away"],
                "actual_over25": m["over25"],
                "actual_btts": m["btts"],
                # Goals Over 2.5 variants
                "over25_base": base_over25,
                "over25_pois_raw": pois_g,
                "over25_dc_raw": dc_g,
                "over25_pois_shrink": shrink_g_pois.predict(pois_g),
                "over25_dc_shrink": shrink_g_dc.predict(dc_g),
                "over25_pois_platt": platt_g_pois.predict(pois_g),
                "over25_dc_platt": platt_g_dc.predict(dc_g),
                "over25_pois_beta": beta_g_pois.predict(pois_g),
                "over25_dc_beta": beta_g_dc.predict(dc_g),
                "over25_pois_iso": iso_g_pois.predict(pois_g),
                "over25_dc_iso": iso_g_dc.predict(dc_g),
                # BTTS variants
                "btts_base": base_btts,
                "btts_pois_raw": pois_b,
                "btts_dc_raw": dc_b,
                "btts_pois_shrink": shrink_b_pois.predict(pois_b),
                "btts_dc_shrink": shrink_b_dc.predict(dc_b),
                "btts_pois_platt": platt_b_pois.predict(pois_b),
                "btts_dc_platt": platt_b_dc.predict(dc_b),
                "btts_pois_beta": beta_b_pois.predict(pois_b),
                "btts_dc_beta": beta_b_dc.predict(dc_b),
                "btts_pois_iso": iso_b_pois.predict(pois_b),
                "btts_dc_iso": iso_b_dc.predict(dc_b),
            }
            records.append(rec)
            day_records.append(rec)
            
        # Post-day update: add evaluated day's raw predictions to calibration pool for FUTURE days only
        for r in day_records:
            cal_history_over25["dates"].append(r["date"])
            cal_history_over25["actuals"].append(r["actual_over25"])
            cal_history_over25["pois"].append(r["over25_pois_raw"])
            cal_history_over25["dc"].append(r["over25_dc_raw"])
            
            cal_history_btts["dates"].append(r["date"])
            cal_history_btts["actuals"].append(r["actual_btts"])
            cal_history_btts["pois"].append(r["btts_pois_raw"])
            cal_history_btts["dc"].append(r["btts_dc_raw"])
            
        history.extend(day)
        i = j
        
    n_eval = len(records)
    print(f"\nCompleted Walk-Forward Evaluation on {n_eval} eligible fixtures.")
    
    # Step 3: Compute Comprehensive Metrics
    def analyze_model(name: str, preds: list[float], actuals: list[float], base_preds: list[float]):
        b = brier_score(preds, actuals)
        b_base = brier_score(base_preds, actuals)
        bss = brier_skill_score(b, b_base)
        ll = log_loss(preds, actuals)
        ece = expected_calibration_error(preds, actuals)
        
        # 2,000 bootstrap resamples for 95% CI on Brier
        random.seed(42)
        boot = []
        n = len(actuals)
        for _ in range(2000):
            idxs = [random.randint(0, n - 1) for _ in range(n)]
            boot.append(sum((preds[k] - actuals[k]) ** 2 for k in idxs) / n)
        boot.sort()
        ci_l = boot[50]
        ci_u = boot[1950]
        
        # Paired permutation test vs base_preds
        diffs = [(p - y) ** 2 - (bp - y) ** 2 for p, bp, y in zip(preds, base_preds, actuals)]
        obs_d = sum(diffs) / n
        perm = []
        for _ in range(5000):
            signs = [1 if random.random() < 0.5 else -1 for _ in range(n)]
            perm.append(sum(d * s for d, s in zip(diffs, signs)) / n)
        p_val = sum(1 for x in perm if x <= obs_d) / 5000.0
        return {
            "name": name,
            "brier": b,
            "logloss": ll,
            "bss": bss,
            "ece": ece,
            "ci_l": ci_l,
            "ci_u": ci_u,
            "obs_diff": obs_d,
            "p_val": p_val
        }

    def probability_band_breakdown(name: str, preds: list[float], actuals: list[float]):
        bands = [(0.0, 0.40), (0.40, 0.50), (0.50, 0.60), (0.60, 0.70), (0.70, 1.01)]
        print(f"\n--- Probability Band Breakdown: {name} ---")
        print(f"{'Band Range':<15} | {'Count (N)':<10} | {'Mean Pred (p)':<14} | {'Actual Rate (y)':<16} | {'Calib Gap |p-y|':<16} | {'Brier in Band':<14}")
        print("-" * 95)
        for low, high in bands:
            in_band = [(p, y) for p, y in zip(preds, actuals) if low <= p < high]
            n_b = len(in_band)
            if n_b > 0:
                mean_p = sum(p for p, y in in_band) / n_b
                mean_y = sum(y for p, y in in_band) / n_b
                gap = abs(mean_p - mean_y)
                b_b = sum((p - y) ** 2 for p, y in in_band) / n_b
                print(f"[{low:.2f}, {high:.2f}){'':<5} | {n_b:<10} | {mean_p:<14.4f} | {mean_y:<16.4f} | {gap:<16.4f} | {b_b:<14.4f}")
            else:
                print(f"[{low:.2f}, {high:.2f}){'':<5} | {0:<10} | {'—':<14} | {'—':<16} | {'—':<16} | {'—':<14}")

    # Goals Over 2.5 Analysis
    y_g = [r["actual_over25"] for r in records]
    p_g_base = [r["over25_base"] for r in records]
    
    g_models = [
        ("Unconditional Baseline", p_g_base),
        ("Poisson (Raw)", [r["over25_pois_raw"] for r in records]),
        ("Poisson + Shrinkage", [r["over25_pois_shrink"] for r in records]),
        ("Poisson + Platt (Logistic)", [r["over25_pois_platt"] for r in records]),
        ("Poisson + Isotonic", [r["over25_pois_iso"] for r in records]),
        ("Poisson + Beta", [r["over25_pois_beta"] for r in records]),
        ("Dixon-Coles (Raw)", [r["over25_dc_raw"] for r in records]),
        ("Dixon-Coles + Shrinkage", [r["over25_dc_shrink"] for r in records]),
        ("Dixon-Coles + Platt (Logistic)", [r["over25_dc_platt"] for r in records]),
        ("Dixon-Coles + Isotonic", [r["over25_dc_iso"] for r in records]),
        ("Dixon-Coles + Beta", [r["over25_dc_beta"] for r in records]),
    ]
    
    print("\n" + "=" * 85)
    print("RESULTS: TOTAL GOALS (OVER 2.5) — 236 EVALUATED MATCHES")
    print("=" * 85)
    print(f"{'Model / Calibrator':<30} | {'Brier':<7} | {'LogLoss':<7} | {'BSS':<8} | {'ECE':<7} | {'95% CI Brier':<18} | {'p vs Base':<10}")
    print("-" * 105)
    for name, preds in g_models:
        res = analyze_model(name, preds, y_g, p_g_base)
        bss_str = f"{res['bss']*100:+.2f}%" if name != "Unconditional Baseline" else "Ref"
        pval_str = f"{res['p_val']:.4f}" if name != "Unconditional Baseline" else "—"
        ci_str = f"[{res['ci_l']:.4f}, {res['ci_u']:.4f}]"
        print(f"{name:<30} | {res['brier']:.4f}  | {res['logloss']:.4f}  | {bss_str:<8} | {res['ece']:.4f}  | {ci_str:<18} | {pval_str:<10}")

    # BTTS Analysis
    y_b = [r["actual_btts"] for r in records]
    p_b_base = [r["btts_base"] for r in records]
    
    b_models = [
        ("Unconditional Baseline", p_b_base),
        ("Poisson (Raw)", [r["btts_pois_raw"] for r in records]),
        ("Poisson + Shrinkage", [r["btts_pois_shrink"] for r in records]),
        ("Poisson + Platt (Logistic)", [r["btts_pois_platt"] for r in records]),
        ("Poisson + Isotonic", [r["btts_pois_iso"] for r in records]),
        ("Poisson + Beta", [r["btts_pois_beta"] for r in records]),
        ("Dixon-Coles (Raw)", [r["btts_dc_raw"] for r in records]),
        ("Dixon-Coles + Shrinkage", [r["btts_dc_shrink"] for r in records]),
        ("Dixon-Coles + Platt (Logistic)", [r["btts_dc_platt"] for r in records]),
        ("Dixon-Coles + Isotonic", [r["btts_dc_iso"] for r in records]),
        ("Dixon-Coles + Beta", [r["btts_dc_beta"] for r in records]),
    ]
    
    print("\n" + "=" * 85)
    print("RESULTS: BOTH TEAMS TO SCORE (BTTS YES) — 236 EVALUATED MATCHES")
    print("=" * 85)
    print(f"{'Model / Calibrator':<30} | {'Brier':<7} | {'LogLoss':<7} | {'BSS':<8} | {'ECE':<7} | {'95% CI Brier':<18} | {'p vs Base':<10}")
    print("-" * 105)
    for name, preds in b_models:
        res = analyze_model(name, preds, y_b, p_b_base)
        bss_str = f"{res['bss']*100:+.2f}%" if name != "Unconditional Baseline" else "Ref"
        pval_str = f"{res['p_val']:.4f}" if name != "Unconditional Baseline" else "—"
        ci_str = f"[{res['ci_l']:.4f}, {res['ci_u']:.4f}]"
        print(f"{name:<30} | {res['brier']:.4f}  | {res['logloss']:.4f}  | {bss_str:<8} | {res['ece']:.4f}  | {ci_str:<18} | {pval_str:<10}")

    # Probability Band Breakdowns for Key Representing Models
    print("\n" + "=" * 85)
    print("DETAILED PROBABILITY BAND CALIBRATION ANALYSIS")
    print("=" * 85)
    probability_band_breakdown("Unconditional Baseline (Goals)", p_g_base, y_g)
    probability_band_breakdown("Poisson Raw (Goals)", [r["over25_pois_raw"] for r in records], y_g)
    probability_band_breakdown("Poisson + Platt Logistic (Goals)", [r["over25_pois_platt"] for r in records], y_g)
    probability_band_breakdown("Dixon-Coles Raw (Goals)", [r["over25_dc_raw"] for r in records], y_g)
    probability_band_breakdown("Dixon-Coles + Platt Logistic (Goals)", [r["over25_dc_platt"] for r in records], y_g)
    probability_band_breakdown("Dixon-Coles + Isotonic (Goals)", [r["over25_dc_iso"] for r in records], y_g)

    probability_band_breakdown("Unconditional Baseline (BTTS)", p_b_base, y_b)
    probability_band_breakdown("Poisson Raw (BTTS)", [r["btts_pois_raw"] for r in records], y_b)
    probability_band_breakdown("Poisson + Platt Logistic (BTTS)", [r["btts_pois_platt"] for r in records], y_b)
    probability_band_breakdown("Dixon-Coles Raw (BTTS)", [r["btts_dc_raw"] for r in records], y_b)
    probability_band_breakdown("Dixon-Coles + Platt Logistic (BTTS)", [r["btts_dc_platt"] for r in records], y_b)
    probability_band_breakdown("Dixon-Coles + Isotonic (BTTS)", [r["btts_dc_iso"] for r in records], y_b)


if __name__ == "__main__":
    run_calibration_experiment()
