"""
backend/app/core/lab_assay_manager.py
Authentic NASA OSDR Laboratory Assay Ingestion & Retrieval Engine.
Parses, indexes, and serves all point-of-care laboratory panels from Inspiration4:
- OSD-569: Complete Blood Count (CBC, 20 distinct biomarkers + reference ranges)
- OSD-575: Comprehensive Metabolic Panel (CMP, 19 distinct biomarkers + reference ranges)
- OSD-575: Cardiovascular Panel (9 acute-phase proteins + percentages)
- OSD-575: Immune Panel (71 distinct cytokines / chemokines + percentages)
"""

import os
import csv
from typing import Dict, Any, List, Optional

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data",
    "nasa_osdr"
)

ASTRONAUT_TO_SUBJECT_MAP = {
    "AST-01_COMMANDER": "C001",
    "AST-01": "C001",
    "COMMANDER": "C001",
    "HALEY": "C001",
    "AST-02_PILOT": "C002",
    "AST-02": "C002",
    "PILOT": "C002",
    "CHRIS": "C002",
    "AST-03_MEDICAL": "C003",
    "AST-03": "C003",
    "MEDICAL": "C003",
    "SIAN": "C003",
    "AST-04_ENGINEER": "C004",
    "AST-04": "C004",
    "ENGINEER": "C004",
    "LEO": "C004"
}


class LabAssayManager:
    """Manages authentic NASA OSDR spaceflight laboratory datasets."""

    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.cbc_data: Dict[str, Dict[str, Any]] = {}
        self.cmp_data: Dict[str, Dict[str, Any]] = {}
        self.cv_data: Dict[str, Dict[str, Any]] = {}
        self.immune_data: Dict[str, Dict[str, Any]] = {}
        self.load_all_assays()

    def _parse_csv_samples(self, filepath: str) -> Dict[str, Dict[str, Any]]:
        """Parses a NASA OSDR CSV into dictionary keyed by sample name."""
        samples: Dict[str, Dict[str, Any]] = {}
        if not os.path.exists(filepath):
            return samples
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                s_name = row.get("Sample Name", "").strip()
                if not s_name:
                    continue
                parsed_metrics: Dict[str, Any] = {}
                for k, v in row.items():
                    if k == "Sample Name":
                        continue
                    v_str = v.strip() if v else ""
                    if not v_str:
                        parsed_metrics[k] = None
                    else:
                        try:
                            parsed_metrics[k] = float(v_str) if "." in v_str else int(v_str)
                        except ValueError:
                            parsed_metrics[k] = v_str
                samples[s_name] = parsed_metrics
        return samples

    def load_all_assays(self) -> None:
        """Loads and structures all 4 NASA OSDR files."""
        self.cbc_data = self._parse_csv_samples(os.path.join(self.data_dir, "OSD-569_Complete_Blood_Count.csv"))
        self.cmp_data = self._parse_csv_samples(os.path.join(self.data_dir, "OSD-575_Comprehensive_Metabolic_Panel.csv"))
        self.cv_data = self._parse_csv_samples(os.path.join(self.data_dir, "OSD-575_Cardiovascular_Panel.csv"))
        self.immune_data = self._parse_csv_samples(os.path.join(self.data_dir, "OSD-575_Immune_Panel.csv"))

    def get_subject_id(self, astronaut_id: str) -> str:
        """Resolves astronaut identifier to Inspiration4 NASA OSDR subject ID (C001-C004)."""
        clean_id = astronaut_id.strip().upper()
        return ASTRONAUT_TO_SUBJECT_MAP.get(clean_id, "C001")

    def _find_sample(self, dataset: Dict[str, Dict[str, Any]], subject: str, preferred_timepoint: str = "R+1") -> Dict[str, Any]:
        """Finds matching sample row for subject and timepoint, with intelligent fallbacks."""
        # 1. Exact match e.g. 'C001_..._R+1'
        for s_name, data in dataset.items():
            if s_name.startswith(subject) and preferred_timepoint in s_name:
                return data
        # 2. Pre-flight baseline fallback 'L-3'
        for s_name, data in dataset.items():
            if s_name.startswith(subject) and "L-3" in s_name:
                return data
        # 3. Any sample for subject
        for s_name, data in dataset.items():
            if s_name.startswith(subject):
                return data
        return {}

    def get_structured_cbc(self, subject: str, timepoint: str = "R+1") -> Dict[str, Any]:
        """Returns structured 20-marker Complete Blood Count (OSD-569)."""
        raw = self._find_sample(self.cbc_data, subject, timepoint)
        if not raw:
            return {}

        markers = [
            ("white_blood_cells", "white_blood_cell_count_value_thousand_per_microliter", "white_blood_cell_count_range_min_thousand_per_microliter", "white_blood_cell_count_range_max_thousand_per_microliter", "k/μL"),
            ("red_blood_cells", "red_blood_cell_count_value_million_per_microliter", "red_blood_cell_count_range_min_million_per_microliter", "red_blood_cell_count_range_max_million_per_microliter", "M/μL"),
            ("hemoglobin", "hemoglobin_value_percent", "hemoglobin_range_min_percent", "hemoglobin_range_max_percent", "g/dL"),
            ("hematocrit", "hematocrit_value_percent", "hematocrit_range_min_percent", "hematocrit_range_max_percent", "%"),
            ("platelets", "platelet_count_value_thousand_per_microliter", "platelet_count_range_min_thousand_per_microliter", "platelet_count_range_max_thousand_per_microliter", "k/μL"),
            ("absolute_neutrophils", "absolute_neutrophils_value_cells_per_microliter", "absolute_neutrophils_range_min_cells_per_microliter", "absolute_neutrophils_range_max_cells_per_microliter", "cells/μL"),
            ("neutrophils_percent", "neutrophils_value_percent", "neutrophils_range_min_percent", "neutrophils_range_max_percent", "%"),
            ("absolute_lymphocytes", "absolute_lymphocytes_value_cells_per_microliter", "absolute_lymphocytes_range_min_cells_per_microliter", "absolute_lymphocytes_range_max_cells_per_microliter", "cells/μL"),
            ("lymphocytes_percent", "lymphocytes_value_percent", "lymphocytes_range_min_percent", "lymphocytes_range_max_percent", "%"),
            ("absolute_monocytes", "absolute_monocytes_value_cells_per_microliter", "absolute_monocytes_range_min_cells_per_microliter", "absolute_monocytes_range_max_cells_per_microliter", "cells/μL"),
            ("monocytes_percent", "monocytes_value_percent", "monocytes_range_min_percent", "monocytes_range_max_percent", "%"),
            ("absolute_eosinophils", "absolute_eosinophils_value_cells_per_microliter", "absolute_eosinophils_range_min_cells_per_microliter", "absolute_eosinophils_range_max_cells_per_microliter", "cells/μL"),
            ("eosinophils_percent", "eosinophils_value_percent", "eosinophils_range_min_percent", "eosinophils_range_max_percent", "%"),
            ("absolute_basophils", "absolute_basophils_value_cells_per_microliter", "absolute_basophils_range_min_cells_per_microliter", "absolute_basophils_range_max_cells_per_microliter", "cells/μL"),
            ("basophils_percent", "basophils_value_percent", "basophils_range_min_percent", "basophils_range_max_percent", "%"),
            ("mcv", "mcv_value_femtoliter", "mcv_range_min_femtoliter", "mcv_range_max_femtoliter", "fL"),
            ("mch", "mch_value_picogram", "mch_range_min_picogram", "mch_range_max_picogram", "pg"),
            ("mchc", "mchc_value_grams_per_deciliter", "mchc_range_min_grams_per_deciliter", "mchc_range_max_grams_per_deciliter", "g/dL"),
            ("rdw", "rdw_value_percent", "rdw_range_min_percent", "rdw_range_max_percent", "%"),
            ("mpv", "mpv_value_femtoliter", "mpv_range_min_femtoliter", "mpv_range_max_femtoliter", "fL"),
        ]

        result: Dict[str, Any] = {}
        for key, val_k, min_k, max_k, unit in markers:
            val = raw.get(val_k)
            result[key] = {
                "value": val,
                "range_min": raw.get(min_k),
                "range_max": raw.get(max_k),
                "unit": unit
            }
        return result

    def get_structured_cmp(self, subject: str, timepoint: str = "R+1") -> Dict[str, Any]:
        """Returns structured 19-marker Comprehensive Metabolic Panel (OSD-575)."""
        raw = self._find_sample(self.cmp_data, subject, timepoint)
        if not raw:
            return {}

        markers = [
            ("sodium", "sodium_value_millimol_per_liter", "sodium_range_min_millimol_per_liter", "sodium_range_max_millimol_per_liter", "mmol/L"),
            ("potassium", "potassium_value_millimol_per_liter", "potassium_range_min_millimol_per_liter", "potassium_range_max_millimol_per_liter", "mmol/L"),
            ("chloride", "chloride_value_millimol_per_liter", "chloride_range_min_millimol_per_liter", "chloride_range_max_millimol_per_liter", "mmol/L"),
            ("carbon_dioxide", "carbon_dioxide_value_millimol_per_liter", "carbon_dioxide_range_min_millimol_per_liter", "carbon_dioxide_range_max_millimol_per_liter", "mmol/L"),
            ("calcium", "calcium_value_milligram_per_deciliter", "calcium_range_min_milligram_per_deciliter", "calcium_range_max_milligram_per_deciliter", "mg/dL"),
            ("glucose", "glucose_value_milligram_per_deciliter", "glucose_range_min_milligram_per_deciliter", "glucose_range_max_milligram_per_deciliter", "mg/dL"),
            ("bun", "urea_nitrogen_bun_value_milligram_per_deciliter", "urea_nitrogen_bun_range_min_milligram_per_deciliter", "urea_nitrogen_bun_range_max_milligram_per_deciliter", "mg/dL"),
            ("creatinine", "creatinine_value_milligram_per_deciliter", "creatinine_range_min_milligram_per_deciliter", "creatinine_range_max_milligram_per_deciliter", "mg/dL"),
            ("bun_to_creatinine_ratio", "bun_to_creatinine_ratio_value", "bun_to_creatinine_ratio_range_min", "bun_to_creatinine_ratio_range_max", "ratio"),
            ("egfr_non_african_american", "egfr_non_african_american_value_milliliter_per_minute_per_1.73_meter_squared", "egfr_non_african_american_range_min_milliliter_per_minute_per_1.73_meter_squared", "egfr_non_african_american_range_max_milliliter_per_minute_per_1.73_meter_squared", "mL/min"),
            ("egfr_african_american", "egfr_african_american_value_milliliter_per_minute_per_1.73_meter_squared", "egfr_african_american_range_min_milliliter_per_minute_per_1.73_meter_squared", "egfr_african_american_range_max_milliliter_per_minute_per_1.73_meter_squared", "mL/min"),
            ("total_protein", "total_protein_value_gram_per_deciliter", "total_protein_range_min_gram_per_deciliter", "total_protein_range_max_gram_per_deciliter", "g/dL"),
            ("albumin", "albumin_value_gram_per_deciliter", "albumin_range_min_gram_per_deciliter", "albumin_range_max_gram_per_deciliter", "g/dL"),
            ("globulin", "globulin_value_gram_per_deciliter", "globulin_range_min_gram_per_deciliter", "globulin_range_max_gram_per_deciliter", "g/dL"),
            ("albumin_to_globulin_ratio", "albumin_to_globulin_ratio_value", "albumin_to_globulin_ratio_range_min", "albumin_to_globulin_ratio_range_max", "ratio"),
            ("alkaline_phosphatase", "alkaline_phosphatase_value_units_per_liter", "alkaline_phosphatase_range_min_units_per_liter", "alkaline_phosphatase_range_max_units_per_liter", "U/L"),
            ("alt", "alt_value_units_per_liter", "alt_range_min_units_per_liter", "alt_max_units_per_liter", "U/L"),
            ("ast", "ast_value_units_per_liter", "ast_range_min_units_per_liter", "ast_max_units_per_liter", "U/L"),
            ("total_bilirubin", "total_bilirubin_value_milligram_per_deciliter", "total_bilirubin_range_min_milligram_per_deciliter", "total_bilirubin_range_max_milligram_per_deciliter", "mg/dL"),
        ]

        result: Dict[str, Any] = {}
        for key, val_k, min_k, max_k, unit in markers:
            val = raw.get(val_k)
            result[key] = {
                "value": val,
                "range_min": raw.get(min_k),
                "range_max": raw.get(max_k),
                "unit": unit
            }
        return result

    def get_structured_cv_panel(self, subject: str, timepoint: str = "R+1") -> Dict[str, Any]:
        """Returns structured 9-protein Cardiovascular Acute-Phase Panel (OSD-575)."""
        raw = self._find_sample(self.cv_data, subject, timepoint)
        if not raw:
            return {}

        markers = [
            ("crp", "crp_concentration_picogram_per_milliliter", "crp_percent", "pg/mL"),
            ("fibrinogen", "fibrinogen_concentration_nanogram_per_milliliter", "fibrinogen_percent", "ng/mL"),
            ("l_selectin", "l_selectin_concentration_picogram_per_milliliter", "l_selectin_percent", "pg/mL"),
            ("pf4", "pf4_concentration_nanogram_per_milliliter", "pf4_percent", "ng/mL"),
            ("haptoglobin", "haptoglobin_concentration_nanogram_per_milliliter", "haptoglobin_percent", "ng/mL"),
            ("a2_macroglobulin", "a2_macroglobulin_concentration_nanogram_per_milliliter", "a2_macroglobulin_percent", "ng/mL"),
            ("agp", "agp_concentration_nanogram_per_milliliter", "agp_percent", "ng/mL"),
            ("fetuin_a36", "fetuin_a36_concentration_nanogram_per_milliliter", "fetuin_a36_percent", "ng/mL"),
            ("sap", "sap_concentration_picogram_per_milliliter", "sap_percent", "pg/mL"),
        ]

        result: Dict[str, Any] = {}
        for key, val_k, pct_k, unit in markers:
            result[key] = {
                "value": raw.get(val_k),
                "percent": raw.get(pct_k),
                "unit": unit
            }
        return result

    def get_structured_immune_panel(self, subject: str, timepoint: str = "R+1") -> Dict[str, Any]:
        """Returns structured 71-cytokine Immune Panel (OSD-575) categorized into functional clusters."""
        raw = self._find_sample(self.immune_data, subject, timepoint)
        if not raw:
            return {}

        # 71 cytokines categorized into 5 aerospace functional clusters
        clusters = {
            "pyrogens_and_inflammatory": [
                ("il_6", "il_6"), ("tnf_alpha", "tnfα"), ("il_1_alpha", "il_1α"),
                ("il_1_beta", "il_1β"), ("il_1ra", "il_1ra"), ("tnf_beta", "tnfβ")
            ],
            "interferons_and_viral": [
                ("ifn_gamma", "ifnγ"), ("ifn_alpha2", "ifn_α2"),
                ("ip_10", "ip_10"), ("mig_cxcl9", "mig_per_cxcl9")
            ],
            "interleukins_and_tcell": [
                ("il_2", "il_2"), ("il_3", "il_3"), ("il_4", "il_4"), ("il_5", "il_5"),
                ("il_7", "il_7"), ("il_8", "il_8"), ("il_9", "il_9"), ("il_10", "il_10"),
                ("il_12p40", "il_12p40"), ("il_12p70", "il_12p70"), ("il_13", "il_13"),
                ("il_15", "il_15"), ("il_16", "il_16"), ("il_17a", "il_17a"),
                ("il_17e_il_25", "il_17e_per_il_25"), ("il_17f", "il_17f"), ("il_18", "il_18"),
                ("il_20", "il_20"), ("il_21", "il_21"), ("il_22", "il_22"), ("il_23", "il_23"),
                ("il_27", "il_27"), ("il_28a", "il_28a"), ("il_33", "il_33")
            ],
            "chemokines_and_trafficking": [
                ("6ckine", "6ckine"), ("bca_1", "bca_1"), ("ctack", "ctack"),
                ("ena_78", "ena_78"), ("eotaxin", "eotaxin"), ("eotaxin_2", "eotaxin_2"),
                ("eotaxin_3", "eotaxin_3"), ("fractalkine", "fractalkine"), ("gro_alpha", "groα"),
                ("i_309", "i_309"), ("mcp_1", "mcp_1"), ("mcp_2", "mcp_2"), ("mcp_3", "mcp_3"),
                ("mcp_4", "mcp_4"), ("mdc", "mdc"), ("mip_1_alpha", "mip_1α"),
                ("mip_1_beta", "mip_1β"), ("mip_1_delta", "mip_1δ"), ("rantes", "rantes"),
                ("tarc", "tarc")
            ],
            "growth_factors_and_remodeling": [
                ("egf", "egf"), ("fgf_2", "fgf_2"), ("flt_3l", "flt_3l"),
                ("g_csf", "g_csf"), ("gm_csf", "gm_csf"), ("lif", "lif"),
                ("m_csf", "m_csf"), ("pdgf_aa", "pdgf_aa"), ("pdgf_ab_bb", "pdgf_ab_per_bb"),
                ("scd40l", "scd40l"), ("scf", "scf"), ("sdf_1_alpha_beta", "sdf_1α_plus_β"),
                ("tgf_alpha", "tgfα"), ("tpo", "tpo"), ("trail", "trail"),
                ("tslp", "tslp"), ("vegf_a", "vegf_a")
            ]
        }

        structured_clusters: Dict[str, Any] = {}
        all_cytokines: Dict[str, Any] = {}

        for cluster_name, items in clusters.items():
            cluster_dict: Dict[str, Any] = {}
            for label, col_prefix in items:
                conc_col = f"{col_prefix}_concentration_picogram_per_milliliter"
                pct_col = f"{col_prefix}_percent"
                val = raw.get(conc_col)
                pct = raw.get(pct_col)
                item_data = {
                    "concentration_pg_ml": val,
                    "percent": pct,
                    "unit": "pg/mL"
                }
                cluster_dict[label] = item_data
                all_cytokines[label] = item_data
            structured_clusters[cluster_name] = cluster_dict

        return {
            "clusters": structured_clusters,
            "all_cytokines": all_cytokines,
            "total_cytokines_count": len(all_cytokines)
        }

    def get_crew_full_lab_profile(self, astronaut_id: str, timepoint: str = "R+1") -> Dict[str, Any]:
        """
        Returns 100% of all laboratory assay biomarkers for the astronaut across all 4 panels:
        - 20 CBC markers
        - 19 CMP markers
        - 9 CV acute-phase proteins
        - 71 Cytokines
        Total: 119 authentic NASA OSDR spaceflight biomarkers!
        """
        subject = self.get_subject_id(astronaut_id)
        cbc = self.get_structured_cbc(subject, timepoint)
        cmp = self.get_structured_cmp(subject, timepoint)
        cv = self.get_structured_cv_panel(subject, timepoint)
        immune = self.get_structured_immune_panel(subject, timepoint)

        return {
            "astronaut_id": astronaut_id,
            "nasa_osdr_subject": subject,
            "mission": "Inspiration4",
            "timepoint": timepoint,
            "counts": {
                "cbc_markers": len(cbc),
                "cmp_markers": len(cmp),
                "cv_proteins": len(cv),
                "cytokines": immune.get("total_cytokines_count", 0),
                "total_laboratory_markers": len(cbc) + len(cmp) + len(cv) + immune.get("total_cytokines_count", 0)
            },
            "cbc": cbc,
            "cmp": cmp,
            "cardiovascular": cv,
            "immune": immune
        }


# Singleton instance
lab_assay_manager = LabAssayManager()
