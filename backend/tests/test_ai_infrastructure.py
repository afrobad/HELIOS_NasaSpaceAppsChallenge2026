"""
backend/tests/test_ai_infrastructure.py
Comprehensive unit and edge-case test suite for Tier 2 AI Decision Engine,
Ollama client guardrails, 2-sentence enforcement, and JARVIS voice warning synthesizer.
"""

import unittest
import asyncio
import time
from typing import Dict, Any

from backend.app.ai.decision_engine import DecisionEngine
from backend.app.ai.ollama_client import OllamaClient
from backend.app.ai.voice_engine import VoiceEngine
from backend.app.ai.fallback_templates import FALLBACK_VOICE_SCRIPTS, get_fallback_script


class TestDecisionEngine(unittest.TestCase):
    """Verifies evidence scoring, confidence bounding, and diagnostic triage structuring."""

    def setUp(self):
        self.baseline = {
            "heart_rate": {"mean": 60.0, "std": 4.0},
            "hrv_rmssd": {"mean": 70.0, "std": 8.0}
        }
        self.env = {
            "cabin_co2_mmhg": {"nominal": 1.8, "warning_threshold": 3.0, "critical_threshold": 4.0}
        }

    def test_nominal_evidence_and_confidence(self):
        telemetry = {
            "heart_rate": 61.0,
            "hrv_rmssd": 69.0,
            "spo2": 98.5,
            "cabin_co2": 1.8,
            "sleep_score": 88.0
        }
        res = DecisionEngine.calculate_evidence_and_confidence(telemetry, self.baseline, self.env)
        self.assertEqual(res["evidence_weight"], 0.0)
        self.assertEqual(res["signal_count"], 0)
        self.assertEqual(res["confidence_percent"], 95.0)

    def test_multi_signal_deviation_evidence(self):
        # Severe multi-signal anomaly: HR elevated, HRV depressed, SpO2 low, CO2 elevated
        telemetry = {
            "heart_rate": 92.0,     # +8.0 sigma
            "hrv_rmssd": 30.0,     # -5.0 sigma
            "spo2": 88.0,          # Severe hypoxia
            "cabin_co2": 4.5,      # Critical CO2
            "sleep_score": 55.0    # Sleep debt
        }
        res = DecisionEngine.calculate_evidence_and_confidence(telemetry, self.baseline, self.env)
        self.assertGreater(res["evidence_weight"], 8.0)
        self.assertEqual(res["signal_count"], 5)
        # Confidence must be bounded to 99%
        self.assertLessEqual(res["confidence_percent"], 99.0)
        self.assertGreaterEqual(res["confidence_percent"], 90.0)

    def test_structure_triage_record_critical(self):
        telemetry = {
            "heart_rate": 110.0,
            "hrv_rmssd": 25.0,
            "spo2": 85.0,
            "cabin_co2": 4.8,
            "sleep_score": 50.0
        }
        triage = DecisionEngine.structure_triage_record(
            astronaut_id="crew_1",
            astronaut_name="Commander Haley",
            telemetry=telemetry,
            baseline=self.baseline,
            env_thresholds=self.env,
            severity="CRITICAL",
            reason="Acute hypoxia and elevated cabin CO2"
        )
        self.assertEqual(triage["severity"], "CRITICAL")
        self.assertIn("Acute Hypoxia", triage["primary_diagnosis"])
        self.assertIn("supplemental oxygen", triage["actionable_instruction"].lower())
        self.assertGreater(len(triage["evidence_breakdown"]), 0)


class TestOllamaClient(unittest.TestCase):
    """Verifies Ollama client timeout guardrails, offline fallback, and 2-sentence enforcement."""

    def setUp(self):
        # Points to a non-existent port to guarantee instant offline failover testing
        self.client = OllamaClient(base_url="http://127.0.0.1:54321", timeout_seconds=0.2)

    def test_enforce_two_sentences_normal(self):
        raw = "Commander, your resting heart rate is elevated. Please hydrate and take an extra rest cycle."
        result = OllamaClient.enforce_two_sentences(raw)
        self.assertEqual(result, raw)

    def test_enforce_two_sentences_strips_tags_and_truncates_long(self):
        raw = "**JARVIS:** Commander, resting heart rate has exceeded baseline. Please drink electrolytes. " \
              "Third sentence that should be pruned. Fourth sentence that is also excess."
        result = OllamaClient.enforce_two_sentences(raw)
        sentences = [s for s in result.split(". ") if s]
        self.assertEqual(len(sentences), 2)
        self.assertNotIn("JARVIS", result)
        self.assertNotIn("**", result)

    def test_enforce_two_sentences_single_sentence_pads(self):
        raw = "Acute localized carbon dioxide pooling detected in module."
        result = OllamaClient.enforce_two_sentences(raw)
        self.assertIn("Maintain telemetry monitoring and follow mission protocol.", result)

    def test_enforce_two_sentences_empty_falls_back(self):
        fallback = "Fallback flight warning."
        result = OllamaClient.enforce_two_sentences("", fallback_text=fallback)
        self.assertEqual(result, fallback)

    def test_offline_check_health_graceful(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            health = loop.run_until_complete(self.client.check_health())
            self.assertEqual(health["status"], "OFFLINE")
            self.assertEqual(health["mode"], "DETERMINISTIC_FALLBACK_ACTIVE")
        finally:
            loop.close()

    def test_offline_triage_falls_back_instantly(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            telemetry = {"heart_rate": 88.0, "hrv_rmssd": 35.0, "spo2": 97.0}
            t0 = time.time()
            res = loop.run_until_complete(
                self.client.generate_clinical_triage(
                    astronaut_name="Commander Haley",
                    telemetry=telemetry,
                    severity="WARNING",
                    reason="Tachycardia drift",
                    scenario_phase="SCENARIO_1_BASELINE_DRIFT"
                )
            )
            elapsed = time.time() - t0
            self.assertTrue(res["is_fallback"])
            self.assertEqual(res["source"], "DETERMINISTIC_FLIGHT_SCRIPT")
            self.assertIn("Commander Haley", res["spoken_text"])
            self.assertNotIn("pardon", res["spoken_text"].lower())
            self.assertLess(elapsed, 3.0)
        finally:
            loop.close()


class TestVoiceEngine(unittest.TestCase):
    """Verifies audio profile assignment, visualizer tokens, and alarm anti-chatter filtering."""

    def setUp(self):
        self.engine = VoiceEngine(cooldown_seconds=10.0)

    def test_tone_mappings(self):
        self.assertEqual(VoiceEngine.TONE_MAPPINGS["CRITICAL"], "klaxon")
        self.assertEqual(VoiceEngine.TONE_MAPPINGS["WARNING"], "chime")
        self.assertEqual(VoiceEngine.TONE_MAPPINGS["INFO"], "beep")
        self.assertEqual(VoiceEngine.TONE_MAPPINGS["NOMINAL"], "none")

    def test_visualizer_tokens_spectral_energy(self):
        text = "Emergency alert: cabin hypoxia detected."
        tokens = VoiceEngine.generate_visualizer_tokens(text)
        self.assertEqual(len(tokens), len(text.split()))
        for tok in tokens:
            self.assertIn("word", tok)
            self.assertIn("bands", tok)
            self.assertEqual(len(tok["bands"]), 5)
            for b in tok["bands"]:
                self.assertGreaterEqual(b, 0.0)
                self.assertLessEqual(b, 1.0)

    def test_alarm_anti_chatter_cooldown_and_escalation(self):
        ast_id = "crew_1"
        self.assertFalse(self.engine.should_suppress_alert(ast_id, "WARNING"))

        # Dispatch first warning
        self.engine.record_alert_dispatched(ast_id, "WARNING")

        # Immediate repeated WARNING must be suppressed (prevent chatter)
        self.assertTrue(self.engine.should_suppress_alert(ast_id, "WARNING"))

        # Escalation to CRITICAL must immediately bypass cooldown (NASA life-safety invariant)
        self.assertFalse(self.engine.should_suppress_alert(ast_id, "CRITICAL"))

    def test_create_voice_warning_packet(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            telemetry = {"heart_rate": 115.0, "spo2": 86.0}
            packet = loop.run_until_complete(
                self.engine.create_voice_warning(
                    astronaut_id="crew_2",
                    astronaut_name="Pilot Chris",
                    telemetry=telemetry,
                    severity="CRITICAL",
                    reason="Acute Hypoxia Breach",
                    scenario_phase="SCENARIO_3_CO2_HYPOXIA"
                )
            )
            self.assertEqual(packet["severity"], "CRITICAL")
            self.assertEqual(packet["tone"], "klaxon")
            self.assertEqual(packet["audio_config"]["rate"], 1.15)
            self.assertTrue(len(packet["visualizer_tokens"]) > 0)
            self.assertIn("Pilot Chris", packet["speech_text"])
            self.assertTrue(len(packet["speech_text"]) > 10)
        finally:
            loop.close()

    def test_handle_voice_query(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            telemetry = {"heart_rate": 84.0, "hrv_rmssd": 40.0, "spo2": 97.5}
            res = loop.run_until_complete(
                self.engine.handle_voice_query(
                    query="JARVIS, why did you flag this alert?",
                    astronaut_id="crew_1",
                    astronaut_name="Commander Haley",
                    current_telemetry=telemetry,
                    severity="WARNING",
                    reason="Cardiovascular baseline drift"
                )
            )
            self.assertEqual(res["query"], "JARVIS, why did you flag this alert?")
            self.assertEqual(res["tone"], "chime")
            self.assertIn("Commander Haley", res["speech_text"])
            self.assertTrue(len(res["visualizer_tokens"]) > 0)
        finally:
            loop.close()


if __name__ == "__main__":
    unittest.main()
