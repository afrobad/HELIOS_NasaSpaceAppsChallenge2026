"""
Unit and Integration Tests for FastAPI REST & Telemetry Streaming Endpoints.
Verifies API responses, baseline loading, Mars delay toggle, and scenario transitions.
"""

import unittest
from starlette.testclient import TestClient
from backend.app.main import app


class TestAPIStreaming(unittest.TestCase):

    def setUp(self):
        # Create TestClient inside lifespan context
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def test_health_endpoint(self):
        """Verifies system health check returns NOMINAL and 10 Hz rate."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "NOMINAL")
        self.assertEqual(data["streaming_hz"], 10)
        self.assertGreaterEqual(data["loaded_crew_members"], 4)

    def test_static_frontend_served(self):
        """Verifies root endpoint serves compiled H.E.L.I.O.S React SPA."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("H.E.L.I.O.S", response.text)

    def test_baselines_endpoint(self):
        """Verifies NASA baseline profiles load accurately."""
        response = self.client.get("/api/baselines")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("crew_profiles", data)
        self.assertIn("AST-01_COMMANDER", data["crew_profiles"])

    def test_mars_latency_toggle(self):
        """Verifies Mars 22-minute delay toggle."""
        # Enable delay
        res_enable = self.client.post("/api/mars-delay?enabled=true")
        self.assertEqual(res_enable.status_code, 200)
        self.assertTrue(res_enable.json()["mars_delay_active"])

        # Disable delay
        res_disable = self.client.post("/api/mars-delay?enabled=false")
        self.assertEqual(res_disable.status_code, 200)
        self.assertFalse(res_disable.json()["mars_delay_active"])

    def test_scenario_switching(self):
        """Verifies that demo scenarios can be triggered on demand."""
        response = self.client.post("/api/scenario/SCENARIO_1_BASELINE_DRIFT")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "SCENARIO_TRIGGERED")

    def test_invalid_scenario_rejection(self):
        """Edge Case: Requesting non-existent scenario returns 404."""
        response = self.client.post("/api/scenario/NON_EXISTENT_SCENARIO")
        self.assertEqual(response.status_code, 404)

    def test_ai_status_endpoint(self):
        """Verifies AI status endpoint returns operational health and anti-chatter config."""
        response = self.client.get("/api/ai/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("ai_engine", data)
        self.assertTrue(data["anti_chatter_active"])

    def test_voice_query_endpoint(self):
        """Verifies JARVIS answers voice queries with speech text and visualizer tokens."""
        payload = {
            "query": "JARVIS, why did you flag this alert?",
            "astronaut_id": "crew_1"
        }
        response = self.client.post("/api/voice/query", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("speech_text", data)
        self.assertIn("visualizer_tokens", data)
        self.assertEqual(data["tone"], "chime")
        self.assertGreater(len(data["visualizer_tokens"]), 0)

    def test_ai_triage_endpoint(self):
        """Verifies on-demand clinical triage endpoint structures differential diagnosis."""
        response = self.client.post("/api/ai/triage/crew_1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("primary_diagnosis", data)
        self.assertIn("actionable_instruction", data)
        self.assertIn("voice_warning", data)
        self.assertEqual(data["astronaut_id"], "AST-01_COMMANDER")


if __name__ == "__main__":
    unittest.main()
