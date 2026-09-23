"""
backend/tests/test_alert_coalescing.py
Comprehensive unit tests for the Multi-Crew Alert Coalescing Engine.
Verifies temporal aggregation, name formatting, pluralized clinical fallbacks,
and single-broadcast coalescing for correlated crew events.
"""

import unittest
import asyncio
from unittest.mock import AsyncMock, MagicMock

from backend.app.ai.fallback_templates import format_crew_names_list, get_fallback_script
from backend.app.ai.voice_engine import VoiceEngine
from backend.app.streaming.telemetry_feeder import TelemetryFeeder
from backend.app.core.baselines import BaselineManager


class TestAlertCoalescing(unittest.TestCase):

    def test_crew_names_formatting(self):
        """Verifies grammatical consolidation of crew names."""
        # 1 person
        self.assertEqual(format_crew_names_list(["Commander Haley"]), "Commander Haley")
        # 2 people
        self.assertEqual(format_crew_names_list(["Commander Haley", "Doctor Sian"]), "Commander Haley and Doctor Sian")
        # 3 people
        self.assertEqual(
            format_crew_names_list(["Commander Haley", "Doctor Sian", "Pilot Chris"]),
            "Commander Haley, Doctor Sian, and Pilot Chris"
        )
        # Deduplication
        self.assertEqual(
            format_crew_names_list(["Commander Haley", "Commander Haley", "Pilot Chris"]),
            "Commander Haley and Pilot Chris"
        )

    def test_multi_crew_fallback_script(self):
        """Verifies pluralized clinical phrasing for multi-crew fatigue drift."""
        names = format_crew_names_list(["Commander Haley", "Doctor Sian", "Pilot Chris"])
        script = get_fallback_script("SCENARIO_1_BASELINE_DRIFT", "WARNING", astronaut_name=names)
        self.assertIn("Commander Haley, Doctor Sian, and Pilot Chris", script)
        self.assertIn("bodies are showing elevated fatigue", script)
        self.assertIn("synchronized ten-minute rest", script)

    def test_multi_crew_voice_warning(self):
        """Verifies voice engine packages 3-crew warning and sets cooldown for all members."""
        engine = VoiceEngine()
        telemetries = [
            {"heart_rate": 88.0, "spo2": 97.0},
            {"heart_rate": 86.0, "spo2": 96.5},
            {"heart_rate": 85.0, "spo2": 97.2}
        ]
        res = asyncio.run(engine.create_multi_crew_voice_warning(
            crew_names="Commander Haley, Doctor Sian, and Pilot Chris",
            astronaut_ids=["AST-01_COMMANDER", "AST-03_MEDICAL", "AST-02_PILOT"],
            telemetries=telemetries,
            severity="WARNING",
            reason="Fatigue drift",
            scenario_phase="SCENARIO_1_BASELINE_DRIFT"
        ))

        self.assertEqual(res["astronaut_name"], "Commander Haley, Doctor Sian, and Pilot Chris")
        self.assertEqual(res["astronaut_id"], "AST-01_COMMANDER+AST-03_MEDICAL+AST-02_PILOT")
        self.assertIn("Commander Haley, Doctor Sian, and Pilot Chris", res["speech_text"])

        # Cooldown must be recorded for all 3 astronauts
        self.assertTrue(engine.should_suppress_alert("AST-01_COMMANDER", "WARNING"))
        self.assertTrue(engine.should_suppress_alert("AST-03_MEDICAL", "WARNING"))
        self.assertTrue(engine.should_suppress_alert("AST-02_PILOT", "WARNING"))

    def test_telemetry_feeder_coalescing_window(self):
        """Verifies TelemetryFeeder coalesces 3 staggered candidates into a single multi-crew alert."""
        ws_mock = MagicMock()
        ws_mock.broadcast_alert = AsyncMock()
        ws_mock.broadcast_telemetry = AsyncMock()

        repo_mock = MagicMock()
        repo_mock.log_telemetry = MagicMock()
        repo_mock.log_proactive_alert = MagicMock()

        baseline_mgr = BaselineManager()
        voice_engine = VoiceEngine()

        feeder = TelemetryFeeder(
            ws_manager=ws_mock,
            repo=repo_mock,
            baseline_mgr=baseline_mgr,
            voice_engine=voice_engine
        )

        candidates = [
            {
                "ast_id": "AST-01_COMMANDER",
                "packet": {"astronaut_name": "Commander Haley", "heart_rate": 88.0, "scenario_phase": "SCENARIO_1_BASELINE_DRIFT"},
                "severity": "WARNING",
                "confidence": 0.95,
                "reason": "Resting tachycardia drift above baseline",
                "baseline": {},
                "env": {}
            },
            {
                "ast_id": "AST-03_MEDICAL",
                "packet": {"astronaut_name": "Doctor Sian", "heart_rate": 86.0, "scenario_phase": "SCENARIO_1_BASELINE_DRIFT"},
                "severity": "WARNING",
                "confidence": 0.95,
                "reason": "Resting tachycardia drift above baseline",
                "baseline": {},
                "env": {}
            },
            {
                "ast_id": "AST-02_PILOT",
                "packet": {"astronaut_name": "Pilot Chris", "heart_rate": 85.0, "scenario_phase": "SCENARIO_1_BASELINE_DRIFT"},
                "severity": "WARNING",
                "confidence": 0.95,
                "reason": "Resting tachycardia drift above baseline",
                "baseline": {},
                "env": {}
            }
        ]

        async def run_coalesce():
            # Stage 3 candidates
            feeder._stage_and_coalesce_alerts(candidates)
            # Run the window processor with 0 delay for instant unit test execution
            await feeder._process_coalesced_alerts_window(wait_seconds=0.01)

        asyncio.run(run_coalesce())

        # Verify broadcast_alert was called EXACTLY ONCE
        self.assertEqual(ws_mock.broadcast_alert.call_count, 1)
        alert_arg = ws_mock.broadcast_alert.call_args[0][0]

        # Verify the alert combines all 3 names
        self.assertIn("Commander Haley", alert_arg["astronaut_name"])
        self.assertIn("Doctor Sian", alert_arg["astronaut_name"])
        self.assertIn("Pilot Chris", alert_arg["astronaut_name"])
        self.assertEqual(alert_arg["severity"], "WARNING")


if __name__ == "__main__":
    unittest.main()
