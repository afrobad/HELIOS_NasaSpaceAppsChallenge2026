"""
backend/tests/test_computational_biomarkers.py
Unit and edge-case validation for aerospace computational medicine algorithms:
1. Dynamic Fridericia QTc interval formula
2. Arrhythmogenic Risk Factor (ARF) with potassium wasting
3. Early Sepsis Prediction Index (EPI) with cytokine surge and autonomic uncoupling
4. Venous Thrombosis Risk Metric (TRM) with hemoconcentration
5. Moran Physiological Strain Index (PSI)
"""

import unittest
from backend.app.core.computational_biomarkers import ComputationalBiomarkers


class TestComputationalBiomarkers(unittest.TestCase):

    def test_fridericia_qtc_calculation(self):
        """Validates Fridericia formula: QTc = QT / cbrt(RR)."""
        # At HR = 60 bpm, RR = 1.0s, cbrt(1.0) = 1.0, so QTc == QT
        qtc = ComputationalBiomarkers.calculate_fridericia_qtc(heart_rate=60.0, raw_qt_ms=400.0)
        self.assertAlmostEqual(qtc, 400.0, delta=1.0)

        # At HR = 125 bpm (tachycardia), RR = 0.48s, cbrt(0.48) = 0.783, QTc > QT
        qtc_tachy = ComputationalBiomarkers.calculate_fridericia_qtc(heart_rate=125.0, raw_qt_ms=360.0)
        self.assertGreater(qtc_tachy, 360.0)

    def test_arrhythmogenic_risk_nominal_vs_hypokalemic(self):
        """Validates ARF calculation under normokalemia vs severe microgravity hypokalemia."""
        # Normokalemia (K+ = 4.2 mmol/L)
        arf_norm, qtc_norm, status_norm = ComputationalBiomarkers.calculate_arrhythmogenic_risk(
            heart_rate=64.0,
            potassium_mmol_l=4.2
        )
        self.assertLess(arf_norm, 1.25)
        self.assertEqual(status_norm, "NOMINAL_MYOCARDIAL_REPOLARIZATION")

        # Hypokalemia (K+ = 2.6 mmol/L)
        arf_hypo, qtc_hypo, status_hypo = ComputationalBiomarkers.calculate_arrhythmogenic_risk(
            heart_rate=80.0,
            potassium_mmol_l=2.6
        )
        self.assertGreaterEqual(arf_hypo, 1.6)
        self.assertGreaterEqual(qtc_hypo, 470.0)
        self.assertIn("CRITICAL", status_hypo)

    def test_early_sepsis_index_presymptomatic_detection(self):
        """Validates that EPI flags acute immune cytokine surge prior to overt core temp spikes."""
        # Baseline / nominal state
        epi_nom, finding_nom = ComputationalBiomarkers.calculate_early_sepsis_index(
            il_6_pg_ml=6.2,
            wbc_k_ul=6.8,
            hrv_rmssd=65.0,
            baseline_hrv=65.0
        )
        self.assertLess(epi_nom, 0.5)
        self.assertEqual(finding_nom, "NOMINAL_IMMUNE_HOMEOSTASIS")

        # Presymptomatic cytokine surge (IL-6 = 85 pg/mL, WBC = 13.5 k/uL, HRV uncoupling to 28 ms)
        epi_surge, finding_surge = ComputationalBiomarkers.calculate_early_sepsis_index(
            il_6_pg_ml=85.0,
            wbc_k_ul=13.5,
            hrv_rmssd=28.0,
            baseline_hrv=65.0
        )
        self.assertGreaterEqual(epi_surge, 1.5)
        self.assertEqual(finding_surge, "PRESYMPTOMATIC_IMMUNE_SURGE_ACUTE")

    def test_venous_thrombosis_risk_metric(self):
        """Validates TRM under microgravity cephalic fluid shift and hemoconcentration."""
        # Nominal cruise
        trm_nom, status_nom = ComputationalBiomarkers.calculate_venous_thrombosis_risk(
            hematocrit_pct=44.0,
            platelet_k_ul=240.0,
            il_6_pg_ml=6.0,
            spo2=98.5
        )
        self.assertLess(trm_nom, 1.5)
        self.assertEqual(status_nom, "NOMINAL_HEMODYNAMIC_FLUIDITY")

        # Microgravity cephalic stasis (Hct 53%, Platelets 440k, mild endothelial IL-6 18 pg/mL)
        trm_stasis, status_stasis = ComputationalBiomarkers.calculate_venous_thrombosis_risk(
            hematocrit_pct=53.0,
            platelet_k_ul=440.0,
            il_6_pg_ml=18.0,
            spo2=96.5
        )
        self.assertGreaterEqual(trm_stasis, 2.0)
        self.assertIn("CRITICAL", status_stasis)

    def test_moran_physiological_strain_index(self):
        """Validates Moran PSI (0-10) during resting vs exertional thermal load."""
        # Rest state
        psi_rest, status_rest = ComputationalBiomarkers.calculate_physiological_strain_index(
            core_temp_c=36.8,
            baseline_temp_c=36.8,
            heart_rate_bpm=62.0,
            baseline_hr_bpm=62.0
        )
        self.assertEqual(psi_rest, 0.0)
        self.assertEqual(status_rest, "NOMINAL_RESTING_STRAIN")

        # Exertional heat strain (Temp 38.6C, HR 165 bpm)
        psi_exert, status_exert = ComputationalBiomarkers.calculate_physiological_strain_index(
            core_temp_c=38.6,
            baseline_temp_c=36.8,
            heart_rate_bpm=165.0,
            baseline_hr_bpm=62.0
        )
        self.assertGreaterEqual(psi_exert, 6.0)
        self.assertTrue("STRAIN" in status_exert or "HEAT_STROKE" in status_exert)

    def test_radiation_biodosimetry_calculation(self):
        """Validates Andrews Kinetic Biodosimetry model and RSI for Solar Particle Events."""
        # Nominal cosmic background
        rsi_nom, dose_nom, status_nom = ComputationalBiomarkers.calculate_radiation_biodosimetry(
            dosimeter_mgy_h=0.05,
            lymphocyte_count_k_ul=2.2,
            baseline_lymphocyte=2.2,
            elapsed_exposure_hours=4.0
        )
        self.assertAlmostEqual(dose_nom, 0.0, delta=0.1)
        self.assertEqual(status_nom, "NOMINAL_COSMIC_BACKGROUND")

        # Acute Solar Particle Event (320 mGy/h flux, ALC depleted to 0.7 k/uL)
        rsi_spe, dose_spe, status_spe = ComputationalBiomarkers.calculate_radiation_biodosimetry(
            dosimeter_mgy_h=320.0,
            lymphocyte_count_k_ul=0.7,
            baseline_lymphocyte=2.2,
            elapsed_exposure_hours=4.0
        )
        self.assertGreaterEqual(dose_spe, 1.5)  # Over 1.5 Gy absorbed dose
        self.assertGreaterEqual(rsi_spe, 1.8)   # Critical Radiation Sickness Index
        self.assertIn("CRITICAL", status_spe)


if __name__ == "__main__":
    unittest.main()

