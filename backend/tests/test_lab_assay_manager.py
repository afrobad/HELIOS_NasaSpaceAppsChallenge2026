"""
backend/tests/test_lab_assay_manager.py
Validates authentic NASA OSDR spaceflight laboratory datasets ingestion.
Checks all 4 panels: OSD-569 CBC (20 markers), OSD-575 CMP (19 markers),
OSD-575 CV (9 proteins), OSD-575 Immune (71 cytokines).
Total: 119 laboratory biomarkers.
"""

import unittest
from backend.app.core.lab_assay_manager import lab_assay_manager


class TestLabAssayManager(unittest.TestCase):
    """Test suite for NASA OSDR laboratory assay ingestion and structure."""

    def test_lab_assay_manager_loading(self):
        """Verify all 4 CSV datasets were loaded and indexed."""
        self.assertGreater(len(lab_assay_manager.cbc_data), 0, "OSD-569 CBC dataset failed to load")
        self.assertGreater(len(lab_assay_manager.cmp_data), 0, "OSD-575 CMP dataset failed to load")
        self.assertGreater(len(lab_assay_manager.cv_data), 0, "OSD-575 CV dataset failed to load")
        self.assertGreater(len(lab_assay_manager.immune_data), 0, "OSD-575 Immune dataset failed to load")

    def test_crew_subject_resolution(self):
        """Verify all 4 astronaut IDs map to Inspiration4 subjects C001-C004."""
        self.assertEqual(lab_assay_manager.get_subject_id("AST-01_COMMANDER"), "C001")
        self.assertEqual(lab_assay_manager.get_subject_id("AST-02_PILOT"), "C002")
        self.assertEqual(lab_assay_manager.get_subject_id("AST-03_MEDICAL"), "C003")
        self.assertEqual(lab_assay_manager.get_subject_id("AST-04_ENGINEER"), "C004")

    def test_full_lab_profile_marker_counts(self):
        """Verify that full lab profile yields exactly 119 authentic laboratory biomarkers."""
        profile = lab_assay_manager.get_crew_full_lab_profile("AST-01_COMMANDER", timepoint="R+1")
        counts = profile["counts"]

        self.assertEqual(counts["cbc_markers"], 20, f"Expected 20 CBC markers, got {counts['cbc_markers']}")
        self.assertEqual(counts["cmp_markers"], 19, f"Expected 19 CMP markers, got {counts['cmp_markers']}")
        self.assertEqual(counts["cv_proteins"], 9, f"Expected 9 CV proteins, got {counts['cv_proteins']}")
        self.assertEqual(counts["cytokines"], 71, f"Expected 71 cytokines, got {counts['cytokines']}")
        self.assertEqual(counts["total_laboratory_markers"], 119, f"Expected 119 total lab markers, got {counts['total_laboratory_markers']}")

    def test_cbc_biomarkers_structure(self):
        """Verify specific CBC markers have valid values, units, and ranges."""
        cbc = lab_assay_manager.get_structured_cbc("C001", "R+1")
        wbc = cbc["white_blood_cells"]
        self.assertIsNotNone(wbc["value"])
        self.assertIn("k/", wbc["unit"])
        self.assertIsNotNone(wbc["range_min"])
        self.assertIsNotNone(wbc["range_max"])

        hct = cbc["hematocrit"]
        self.assertIsNotNone(hct["value"])
        self.assertEqual(hct["unit"], "%")

    def test_cmp_biomarkers_structure(self):
        """Verify specific CMP chemistry markers."""
        cmp = lab_assay_manager.get_structured_cmp("C001", "R+1")
        na = cmp["sodium"]
        self.assertIsNotNone(na["value"])
        self.assertEqual(na["unit"], "mmol/L")
        k = cmp["potassium"]
        self.assertIsNotNone(k["value"])
        self.assertEqual(k["unit"], "mmol/L")

    def test_cv_panel_structure(self):
        """Verify acute-phase CV markers."""
        cv = lab_assay_manager.get_structured_cv_panel("C001", "R+1")
        fib = cv["fibrinogen"]
        self.assertIsNotNone(fib["value"])
        self.assertEqual(fib["unit"], "ng/mL")
        crp = cv["crp"]
        self.assertIsNotNone(crp["value"])

    def test_immune_panel_functional_clusters(self):
        """Verify 71 cytokines categorized into 5 clusters."""
        immune = lab_assay_manager.get_structured_immune_panel("C001", "R+1")
        clusters = immune["clusters"]
        self.assertIn("pyrogens_and_inflammatory", clusters)
        self.assertIn("interferons_and_viral", clusters)
        self.assertIn("interleukins_and_tcell", clusters)
        self.assertIn("chemokines_and_trafficking", clusters)
        self.assertIn("growth_factors_and_remodeling", clusters)

        # Check IL-6 and IFN-gamma
        pyro = clusters["pyrogens_and_inflammatory"]
        self.assertIn("il_6", pyro)
        self.assertIsNotNone(pyro["il_6"]["concentration_pg_ml"])

        viral = clusters["interferons_and_viral"]
        self.assertIn("ifn_gamma", viral)
        self.assertIsNotNone(viral["ifn_gamma"]["concentration_pg_ml"])


if __name__ == "__main__":
    unittest.main()
