"""
Unit and Edge-Case Tests for ActivityGatingEngine.
Verifies that workout tachycardia is gated and recovery kinetics are evaluated.
"""

import unittest
from backend.app.core.activity_gating import ActivityGatingEngine


class TestActivityGatingEngine(unittest.TestCase):

    def test_exercise_tachycardia_is_gated(self):
        """HR = 155 bpm during WORKOUT must be gated (True)."""
        is_gated = ActivityGatingEngine.should_gate_cardiac_alarm("WORKOUT", heart_rate=155.0)
        self.assertTrue(is_gated)

    def test_resting_tachycardia_is_not_gated(self):
        """HR = 155 bpm during REST must NOT be gated (False) - requires emergency evaluation."""
        is_gated = ActivityGatingEngine.should_gate_cardiac_alarm("REST", heart_rate=155.0)
        self.assertFalse(is_gated)

    def test_extreme_exercise_limit(self):
        """Extreme exertion beyond safe threshold (>175 bpm) is NOT gated."""
        is_gated = ActivityGatingEngine.should_gate_cardiac_alarm("WORKOUT", heart_rate=185.0)
        self.assertFalse(is_gated)

    def test_post_workout_healthy_recovery(self):
        """Post-exercise recovery where HR normalizes to baseline + 10% is healthy."""
        healthy, comment = ActivityGatingEngine.evaluate_recovery_curve(
            elapsed_post_workout_minutes=35.0,
            current_hr=68.0,
            rest_baseline_hr=62.0
        )
        self.assertTrue(healthy)
        self.assertIn("nominal", comment.lower())

    def test_post_workout_impaired_recovery(self):
        """Post-exercise recovery where HR remains >20% above baseline after 35m fails."""
        # 62 * 1.20 = 74.4. A current HR of 82 bpm at T+35m is impaired recovery
        healthy, comment = ActivityGatingEngine.evaluate_recovery_curve(
            elapsed_post_workout_minutes=35.0,
            current_hr=82.0,
            rest_baseline_hr=62.0
        )
        self.assertFalse(healthy)
        self.assertIn("impaired", comment.lower())


if __name__ == "__main__":
    unittest.main()
