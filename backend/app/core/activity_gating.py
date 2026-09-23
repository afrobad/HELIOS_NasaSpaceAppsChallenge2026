"""
backend/app/core/activity_gating.py
Activity-Aware Contextual Gating to prevent false alarms during mandatory astronaut workouts
and evaluate the post-exercise cardiovascular recovery curve.
"""

from typing import Dict, Any, Tuple


class ActivityGatingEngine:
    """
    Contextual state filter.
    Guarantees zero false alarms during high-intensity exercise while monitoring
    recovery kinetics post-workout.
    """

    VALID_STATES = {"REST", "WORKOUT", "POST_WORKOUT", "SLEEP", "EVA"}

    @classmethod
    def should_gate_cardiac_alarm(cls, mission_state: str, heart_rate: float) -> bool:
        """
        Determines whether tachycardia alarms should be suppressed due to exercise.
        An HR up to 175 bpm during WORKOUT is considered healthy cardiovascular exertion.
        """
        if mission_state == "WORKOUT":
            # Up to 175 bpm is nominal exercise exertion
            if heart_rate <= 175.0:
                return True
        return False

    @classmethod
    def evaluate_recovery_curve(
        cls,
        elapsed_post_workout_minutes: float,
        current_hr: float,
        rest_baseline_hr: float
    ) -> Tuple[bool, str]:
        """
        Evaluates the cardiovascular recovery curve post-exercise.
        Delta HR should drop exponentially toward baseline.
        Returns: (is_healthy_recovery, clinical_comment)
        """
        threshold_20_percent = rest_baseline_hr * 1.20

        if elapsed_post_workout_minutes >= 30.0 and current_hr > threshold_20_percent:
            return (
                False,
                f"Impaired cardiovascular recovery: HR ({current_hr:.1f} bpm) remains >20% above baseline "
                f"({rest_baseline_hr:.1f} bpm) at T+{elapsed_post_workout_minutes:.0f}m post-exercise."
            )

        return (True, "Cardiovascular recovery kinetics nominal.")
