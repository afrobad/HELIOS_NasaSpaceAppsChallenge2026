"""
Unit and Edge-Case Tests for ZScoreEvaluator.
Verifies mathematical precision, zero-variance protection, and NaN handling.
"""

import unittest
import math
from backend.app.core.zscore_evaluator import ZScoreEvaluator


class TestZScoreEvaluator(unittest.TestCase):

    def test_nominal_zscore_calculation(self):
        """Standard Z-Score math: (76 - 62) / 3.8 = 3.68"""
        z = ZScoreEvaluator.compute_z_score(value=76.0, mean=62.0, std=3.8)
        self.assertAlmostEqual(z, 3.68, places=2)

    def test_negative_zscore_calculation(self):
        """Negative Z-Score math: (42.25 - 65) / 7.5 = -3.03"""
        z = ZScoreEvaluator.compute_z_score(value=42.25, mean=65.0, std=7.5)
        self.assertAlmostEqual(z, -3.03, places=2)

    def test_zero_variance_safeguard(self):
        """Edge Case: std == 0 should not raise ZeroDivisionError."""
        z = ZScoreEvaluator.compute_z_score(value=70.0, mean=60.0, std=0.0)
        # Should be bounded to maximum aerospace clamp (15.0) rather than crashing
        self.assertEqual(z, 15.0)

    def test_nan_and_none_values(self):
        """Edge Case: None or NaN values must return 0.0 without throwing exceptions."""
        self.assertEqual(ZScoreEvaluator.compute_z_score(None, 60.0, 5.0), 0.0)
        self.assertEqual(ZScoreEvaluator.compute_z_score(float("nan"), 60.0, 5.0), 0.0)
        self.assertEqual(ZScoreEvaluator.compute_z_score(70.0, float("nan"), 5.0), 0.0)
        self.assertEqual(ZScoreEvaluator.compute_z_score(70.0, 60.0, float("nan")), 0.0)

    def test_outlier_clamping(self):
        """Edge Case: Sensor malfunction generating extreme spikes is clamped to [-15.0, 15.0]."""
        extreme_high = ZScoreEvaluator.compute_z_score(value=999999.0, mean=60.0, std=5.0)
        self.assertEqual(extreme_high, 15.0)

        extreme_low = ZScoreEvaluator.compute_z_score(value=-999999.0, mean=60.0, std=5.0)
        self.assertEqual(extreme_low, -15.0)


if __name__ == "__main__":
    unittest.main()
