"""
Unit and Edge-Case Tests for SentryMatrixEngine.
Verifies multi-signal fusion, 3-tier severity classification, and acute overrides.
"""

import unittest
from backend.app.core.sentry_matrix import SentryMatrixEngine


class TestSentryMatrixEngine(unittest.TestCase):

    def setUp(self):
        self.baseline = {
            "heart_rate": {"mean": 62.0, "std": 3.8},
            "hrv_rmssd": {"mean": 65.0, "std": 7.5},
            "spo2": {"mean": 98.2, "std": 0.6},
            "core_temp": {"mean": 36.8, "std": 0.15},
            "sleep_score": {"mean": 86.0, "std": 6.0}
        }
        self.env = {
            "cabin_co2_mmhg": {
                "nominal_mean": 1.8,
                "warning_threshold": 3.0,
                "critical_threshold": 4.0
            }
        }

    def test_nominal_state(self):
        """All vitals close to mean -> NOMINAL severity."""
        telemetry = {
            "heart_rate": 63.0,
            "hrv_rmssd": 64.0,
            "spo2": 98.0,
            "cabin_co2": 1.8,
            "mission_state": "REST"
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "NOMINAL")

    def test_level_1_info_state(self):
        """Single metric mild drift (Z = 1.6) -> INFO severity."""
        # 62 + (1.6 * 3.8) = 68.08
        telemetry = {
            "heart_rate": 68.2,
            "hrv_rmssd": 65.0,
            "spo2": 98.2,
            "cabin_co2": 1.8,
            "mission_state": "REST"
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "INFO")

    def test_level_2_warning_fatigue(self):
        """Correlated deviations: HR Z >= 2.0 AND HRV Z <= -2.0 -> WARNING severity."""
        # HR 72 (Z = 2.63), HRV 45 (Z = -2.67)
        telemetry = {
            "heart_rate": 72.0,
            "hrv_rmssd": 45.0,
            "spo2": 98.0,
            "cabin_co2": 1.8,
            "mission_state": "REST"
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "WARNING")
        self.assertIn("Cardiovascular strain", reason)

    def test_level_3_critical_hypoxia(self):
        """SpO2 < 90% triggers CRITICAL override immediately."""
        telemetry = {
            "heart_rate": 88.0,
            "hrv_rmssd": 35.0,
            "spo2": 89.2, # Below 90%
            "cabin_co2": 2.5,
            "mission_state": "REST"
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "CRITICAL")
        self.assertIn("hypoxia", reason.lower())

    def test_level_3_critical_co2_pocket(self):
        """Cabin CO2 >= 4.0 mmHg triggers CRITICAL override."""
        telemetry = {
            "heart_rate": 75.0,
            "hrv_rmssd": 50.0,
            "spo2": 96.0,
            "cabin_co2": 4.15, # Above 4.0
            "mission_state": "REST"
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "CRITICAL")
        self.assertTrue("co2" in reason.lower() or "co₂" in reason.lower())

    def test_workout_gating_suppresses_alarm(self):
        """HR = 155 bpm during WORKOUT produces NOMINAL severity when oxygen and CO2 are safe."""
        telemetry = {
            "heart_rate": 155.0,
            "hrv_rmssd": 20.0,
            "spo2": 97.0,
            "cabin_co2": 2.1,
            "mission_state": "WORKOUT"
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "NOMINAL")
        self.assertIn("gated", reason.lower())

    def test_workout_gating_with_normal_potassium(self):
        """HR = 150 bpm during WORKOUT with normal K+ = 4.5 produces NOMINAL severity (not false QTc CRITICAL)."""
        telemetry = {
            "heart_rate": 150.0,
            "hrv_rmssd": 22.0,
            "spo2": 97.3,
            "cabin_co2": 1.8,
            "mission_state": "WORKOUT",
            "potassium": 4.5
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "NOMINAL")
        self.assertIn("gated", reason.lower())

    def test_presymptomatic_sepsis_detection(self):
        """Subclinical IL-6 surge and WBC elevation before thermal fever triggers WARNING/CRITICAL."""
        telemetry = {
            "heart_rate": 65.0,
            "hrv_rmssd": 35.0,
            "spo2": 98.0,
            "core_temp": 36.85, # Normal core temp (no overt fever yet!)
            "cabin_co2": 1.8,
            "mission_state": "REST",
            "il_6": 68.0,       # Severe cytokine surge
            "wbc_count": 12.8,   # Leukocytosis
            "platelet_count": 250.0
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertIn(severity, ["WARNING", "CRITICAL"])
        self.assertIn("sepsis", reason.lower())

    def test_hypokalemic_arrhythmogenic_risk(self):
        """Microgravity potassium wasting (K+ = 2.7) triggers ventricular QTc warning."""
        telemetry = {
            "heart_rate": 78.0,
            "hrv_rmssd": 50.0,
            "spo2": 98.0,
            "cabin_co2": 1.8,
            "mission_state": "REST",
            "potassium": 2.7    # Severe hypokalemia
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertIn(severity, ["WARNING", "CRITICAL"])
        self.assertIn("arrhythmia", reason.lower())

    def test_venous_thrombosis_risk(self):
        """Cephalic hemoconcentration (Hct = 53%) with elevated platelets triggers thrombosis risk."""
        telemetry = {
            "heart_rate": 66.0,
            "hrv_rmssd": 60.0,
            "spo2": 98.0,
            "cabin_co2": 1.8,
            "mission_state": "REST",
            "hematocrit": 53.0,
            "platelet_count": 420.0,
            "il_6": 12.0
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertIn(severity, ["WARNING", "CRITICAL"])
        self.assertIn("thrombosis", reason.lower())

    def test_solar_particle_radiation_storm(self):
        """Solar Particle Event flux spike (320 mGy/h) and lymphocyte depletion triggers CRITICAL radiation alert."""
        telemetry = {
            "heart_rate": 78.0,
            "hrv_rmssd": 35.0,
            "spo2": 97.5,
            "cabin_co2": 1.8,
            "mission_state": "REST",
            "radiation_flux": 320.0,
            "lymphocyte_count": 0.65
        }
        severity, conf, reason = SentryMatrixEngine.evaluate_state(telemetry, self.baseline, self.env)
        self.assertEqual(severity, "CRITICAL")
        self.assertIn("radiation", reason.lower())


if __name__ == "__main__":
    unittest.main()

