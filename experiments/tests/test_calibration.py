"""Unit tests for MatchIQ Mission AG-030 Probability Calibration.
Enforces Test-Driven Development (TDD) using standard library unittest.
"""

import math
import unittest
from datetime import datetime

# Import calibration functions from experiments/calibration_research.py
from experiments.calibration_research import (
    ShrinkageCalibrator,
    LogisticCalibrator,
    BetaCalibrator,
    IsotonicCalibrator,
    verify_chronological_integrity,
    brier_score,
    brier_skill_score,
    log_loss,
    expected_calibration_error
)


class TestCalibration(unittest.TestCase):
    def test_log_loss_calculation(self):
        """Verify binary cross-entropy log loss."""
        actuals = [1, 0]
        # Confident correct: -ln(0.9) ~ 0.10536
        ll_good = log_loss([0.9, 0.1], actuals)
        self.assertAlmostEqual(ll_good, -math.log(0.9), places=4)
        # 50/50 prediction: -ln(0.5) ~ 0.69315
        ll_neutral = log_loss([0.5, 0.5], actuals)
        self.assertAlmostEqual(ll_neutral, -math.log(0.5), places=4)

    def test_brier_score_and_bss(self):
        """Verify standard Brier Score and Brier Skill Score calculation."""
        actuals = [1, 0, 1, 1, 0]
        # Perfect predictions
        self.assertAlmostEqual(brier_score([1.0, 0.0, 1.0, 1.0, 0.0], actuals), 0.0)
        # Complete opposite predictions
        self.assertAlmostEqual(brier_score([0.0, 1.0, 0.0, 0.0, 1.0], actuals), 1.0)
        # Naive predictions of 0.5
        self.assertAlmostEqual(brier_score([0.5, 0.5, 0.5, 0.5, 0.5], actuals), 0.25)

        # BSS vs reference
        base_brier = 0.25
        model_brier = 0.20
        # BSS = 1 - (0.20 / 0.25) = 1 - 0.80 = 0.20 (20% improvement)
        self.assertAlmostEqual(brier_skill_score(model_brier, base_brier), 0.20)

    def test_shrinkage_calibrator_boundaries(self):
        """Verify shrinkage calibrator behaves correctly at extremes."""
        base_rate = 0.55
        cal_zero = ShrinkageCalibrator(alpha=0.0, base_rate=base_rate)
        self.assertAlmostEqual(cal_zero.predict(0.80), 0.80)
        self.assertAlmostEqual(cal_zero.predict(0.20), 0.20)

        cal_full = ShrinkageCalibrator(alpha=1.0, base_rate=base_rate)
        self.assertAlmostEqual(cal_full.predict(0.80), 0.55)
        self.assertAlmostEqual(cal_full.predict(0.20), 0.55)

        cal_half = ShrinkageCalibrator(alpha=0.5, base_rate=base_rate)
        # (0.80 * 0.5) + (0.55 * 0.5) = 0.40 + 0.275 = 0.675
        self.assertAlmostEqual(cal_half.predict(0.80), 0.675)

    def test_logistic_calibrator_fitting_and_monotonicity(self):
        """Verify Platt/Logistic scaling converges and maintains monotonicity."""
        raw_p = [0.9] * 7 + [0.9] * 3 + [0.1] * 7 + [0.1] * 3
        actuals = [1] * 7 + [0] * 3 + [0] * 7 + [1] * 3
        
        cal = LogisticCalibrator()
        cal.fit(raw_p, actuals)
        
        p_low = cal.predict(0.1)
        p_mid = cal.predict(0.5)
        p_high = cal.predict(0.9)
        
        # Monotonicity check
        self.assertLess(p_low, p_mid)
        self.assertLess(p_mid, p_high)
        # Bounded in (0, 1)
        self.assertGreater(p_low, 0.0)
        self.assertLess(p_high, 1.0)
        # Softening of overconfidence: 0.9 should soften downward towards ~0.70
        self.assertLess(p_high, 0.90)
        # 0.1 should soften upward towards ~0.30
        self.assertGreater(p_low, 0.10)

    def test_beta_calibrator_fitting(self):
        """Verify Beta calibration correctly handles probability ranges."""
        raw_p = [0.8] * 10 + [0.6] * 10 + [0.4] * 10 + [0.2] * 10
        actuals = [1] * 8 + [0] * 2 + [1] * 6 + [0] * 4 + [1] * 4 + [0] * 6 + [1] * 2 + [0] * 8
        
        cal = BetaCalibrator()
        cal.fit(raw_p, actuals)
        
        preds = [cal.predict(p) for p in [0.2, 0.4, 0.6, 0.8]]
        for p in preds:
            self.assertGreaterEqual(p, 0.0)
            self.assertLessEqual(p, 1.0)
        # Strictly non-decreasing
        self.assertLessEqual(preds[0], preds[1])
        self.assertLessEqual(preds[1], preds[2])
        self.assertLessEqual(preds[2], preds[3])

    def test_isotonic_calibrator_pava(self):
        """Verify Isotonic Regression (PAVA) enforces non-decreasing step functions."""
        # Non-monotonic raw data: low raw_p had high actuals, high raw_p had low actuals
        raw_p = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
        # Inverted actuals: violators of monotonicity
        actuals = [0, 1, 0, 1, 1, 0, 1, 0, 1]
        
        iso = IsotonicCalibrator()
        iso.fit(raw_p, actuals)
        
        preds = [iso.predict(p) for p in [0.05, 0.25, 0.55, 0.75, 0.95]]
        for p in preds:
            self.assertGreaterEqual(p, 0.0)
            self.assertLessEqual(p, 1.0)
        # Check monotonicity across entire range
        for k in range(len(preds) - 1):
            self.assertLessEqual(preds[k], preds[k + 1])

    def test_verify_chronological_integrity(self):
        """Verify strict anti-leakage test rejects future or same-day data in training."""
        dates_train = [
            datetime(2023, 1, 1),
            datetime(2023, 1, 2),
            datetime(2023, 1, 5)
        ]
        eval_date_valid = datetime(2023, 1, 6)
        eval_date_same_day = datetime(2023, 1, 5)
        eval_date_prior = datetime(2023, 1, 3)
        
        self.assertTrue(verify_chronological_integrity(dates_train, eval_date_valid))
        self.assertFalse(verify_chronological_integrity(dates_train, eval_date_same_day))
        self.assertFalse(verify_chronological_integrity(dates_train, eval_date_prior))


if __name__ == "__main__":
    unittest.main()
