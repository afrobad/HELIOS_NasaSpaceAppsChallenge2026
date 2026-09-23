"""
backend/app/core/zscore_evaluator.py
Mathematical Z-Score calculation with zero-division protection and signal validation.
Z = (x - mu) / sigma
"""

import math
from typing import Optional, Dict, Any


class ZScoreEvaluator:
    """Computes real-time Z-score deviations against personal physiological baselines."""

    @staticmethod
    def compute_z_score(value: Optional[float], mean: float, std: float, epsilon: float = 1e-4) -> float:
        """
        Computes the Z-Score of a given measurement.
        Safe against zero variance, negative std, None values, and NaNs.
        """
        if value is None or not isinstance(value, (int, float)) or math.isnan(value):
            return 0.0

        if math.isnan(mean) or math.isnan(std):
            return 0.0

        # Protect against division by zero
        effective_std = max(abs(std), epsilon)
        z = (value - mean) / effective_std

        # Bound to reasonable aerospace ranges [-15.0, 15.0] to prevent overflow
        return max(-15.0, min(15.0, round(z, 2)))

    @classmethod
    def evaluate_telemetry_point(
        cls,
        telemetry: Dict[str, Any],
        baseline: Dict[str, Dict[str, float]]
    ) -> Dict[str, float]:
        """
        Computes Z-scores for all standard bio-vectors present in both the telemetry and baseline.
        Returns a dictionary of z-scores, e.g. {'z_heart_rate': 1.45, 'z_hrv': -2.10, ...}
        """
        z_scores = {}
        for metric, stats in baseline.items():
            if metric in telemetry and "mean" in stats and "std" in stats:
                val = telemetry.get(metric)
                mean = stats["mean"]
                std = stats["std"]
                z_scores[f"z_{metric}"] = cls.compute_z_score(val, mean, std)
        return z_scores
