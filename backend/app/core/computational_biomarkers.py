"""
backend/app/core/computational_biomarkers.py
Aerospace Computational Medicine & Mathematical Biomarker Synthesis Engine.
Implements continuous multi-signal physiological fusion algorithms:
1. Early Sepsis / Viral Reactivation Prediction Index (EPI)
2. Hypokalemic Arrhythmogenic Risk Factor (ARF) & Dynamic Fridericia QTc
3. Microgravity Venous Stasis & Thrombosis Risk Metric (TRM)
4. Moran Physiological Strain Index (PSI)
"""

import math
from typing import Dict, Any, Tuple


class ComputationalBiomarkers:
    """
    High-performance mathematical sentry engine for presymptomatic
    deep-space clinical risk forecasting.
    """

    @staticmethod
    def calculate_fridericia_qtc(heart_rate: float, raw_qt_ms: float = 400.0) -> float:
        """
        Calculates Fridericia corrected QT interval (QTc = QT / cbrt(RR)).
        More accurate than Bazett at spaceflight heart rate extremes.
        """
        if heart_rate <= 0:
            return raw_qt_ms
        rr_sec = 60.0 / max(30.0, min(220.0, heart_rate))
        cbrt_rr = math.pow(rr_sec, 1.0 / 3.0)
        return round(raw_qt_ms / max(0.5, cbrt_rr), 1)

    @staticmethod
    def calculate_arrhythmogenic_risk(
        heart_rate: float,
        potassium_mmol_l: float,
        calcium_mg_dl: float = 9.5
    ) -> Tuple[float, float, str]:
        """
        Computes the Arrhythmogenic Risk Factor (ARF) fusing dynamic QTc
        with point-of-care serum potassium (K+) from NASA OSDR OSD-575 CMP.
        Returns: (ARF score, calculated QTc ms, clinical finding).
        """
        k_val = max(1.5, min(6.5, potassium_mmol_l))
        k_deficit = max(0.0, 4.0 - k_val)

        # In human cardiac physiology, raw QT physiologically adapts to heart rate (scaling with sqrt(RR)).
        # At resting baseline (60 bpm, RR = 1.0s), raw QT is ~390ms.
        # Under hypokalemia, delayed rectifier potassium currents are impaired, causing pathological QT prolongation.
        rr_sec = 60.0 / max(30.0, min(220.0, heart_rate))
        rate_adapted_base_qt = 390.0 * math.sqrt(rr_sec)
        simulated_qt = rate_adapted_base_qt + (k_deficit * 95.0)

        qtc = ComputationalBiomarkers.calculate_fridericia_qtc(heart_rate, raw_qt_ms=simulated_qt)

        # ARF: Normalized ratio against 450 ms threshold scaled by inverse square of K+
        arf = (qtc / 450.0) * math.pow(3.8 / k_val, 1.8)
        arf = round(max(0.2, min(5.0, arf)), 2)

        if arf >= 1.6 or qtc >= 485.0:
            status = "CRITICAL_QT_PROLONGATION_VENTRICULAR_VULNERABILITY"
        elif arf >= 1.25 or qtc >= 450.0:
            status = "WARNING_ELECTROLYTE_QT_MARGINAL"
        else:
            status = "NOMINAL_MYOCARDIAL_REPOLARIZATION"

        return arf, qtc, status

    @staticmethod
    def calculate_early_sepsis_index(
        il_6_pg_ml: float,
        wbc_k_ul: float,
        hrv_rmssd: float,
        baseline_hrv: float = 65.0
    ) -> Tuple[float, str]:
        """
        Computes the Presymptomatic Sepsis / Viral Reactivation Index (EPI).
        Fuses cytokine surge (NASA OSDR OSD-575 Immune) with autonomic uncoupling
        before fever (core temp elevation) or resting tachycardia occurs.
        """
        # Normal IL-6 is <10 pg/mL, severe surge is >100 pg/mL
        il6_score = min(3.0, max(0.0, (il_6_pg_ml - 8.0) / 30.0))
        # Normal WBC is 4.0 - 10.0 k/uL
        wbc_score = min(2.5, max(0.0, (wbc_k_ul - 7.0) / 2.5))
        # HRV decay ratio (autonomic fractal complexity loss)
        hrv_decay = max(0.0, (baseline_hrv - hrv_rmssd) / max(1.0, baseline_hrv))

        # Weighted multimodal index
        epi = (0.45 * il6_score) + (0.30 * wbc_score) + (0.25 * hrv_decay * 2.0)
        epi = round(min(3.0, max(0.0, epi)), 2)

        if epi >= 1.5:
            finding = "PRESYMPTOMATIC_IMMUNE_SURGE_ACUTE"
        elif epi >= 0.9:
            finding = "SUBCLINICAL_INFLAMMATORY_CASCADE"
        else:
            finding = "NOMINAL_IMMUNE_HOMEOSTASIS"

        return epi, finding

    @staticmethod
    def calculate_venous_thrombosis_risk(
        hematocrit_pct: float,
        platelet_k_ul: float,
        il_6_pg_ml: float,
        spo2: float
    ) -> Tuple[float, str]:
        """
        Models the NASA ISS 2020 Internal Jugular Vein (IJV) Thrombosis risk metric (TRM).
        Fuses microgravity hemoconcentration (elevated Hct), hypercoagulability (platelets),
        and vascular endothelial cytokine irritation.
        """
        hct_factor = max(1.0, hematocrit_pct / 44.0)
        plt_factor = max(1.0, platelet_k_ul / 380.0)
        il6_factor = max(1.0, il_6_pg_ml / 10.0)
        o2_attenuation = max(0.8, spo2 / 98.5)

        trm = (math.pow(hct_factor, 2.5) * plt_factor * math.sqrt(il6_factor)) / o2_attenuation
        trm = round(max(0.1, min(5.0, trm)), 2)

        if trm >= 2.2:
            status = "CRITICAL_CEPHALIC_VENOUS_STASIS_THROMBOSIS_RISK"
        elif trm >= 1.5:
            status = "WARNING_HYPERCOAGULABLE_MICROCIRCULATORY_STASIS"
        else:
            status = "NOMINAL_HEMODYNAMIC_FLUIDITY"

        return trm, status

    @staticmethod
    def calculate_radiation_biodosimetry(
        dosimeter_mgy_h: float,
        lymphocyte_count_k_ul: float,
        baseline_lymphocyte: float = 2.2,
        elapsed_exposure_hours: float = 4.0
    ) -> Tuple[float, float, str]:
        """
        Computes the Andrews Kinetic Lymphocyte Depletion Biodosimetry Model
        and Radiation Sickness Index (RSI) for deep-space Acute Radiation Syndrome (ARS).
        Estimates absorbed biological radiation dose (Gy) from lymphocyte depletion velocity.
        """
        alc = max(0.1, lymphocyte_count_k_ul)
        alc_ratio = min(1.0, alc / max(0.5, baseline_lymphocyte))

        # Andrews depletion rate constant k ~ 0.05 h^-1 Gy^-1
        # Estimated biological absorbed dose in Gray (Gy)
        k_const = 0.05
        t_hrs = max(1.0, elapsed_exposure_hours)
        dose_gy = -math.log(max(0.05, alc_ratio)) / (k_const * t_hrs)
        dose_gy = round(max(0.0, min(10.0, dose_gy)), 2)

        # Radiation Sickness Index (RSI): Fuses physical dosimeter flux (mGy/h) with biological depletion
        phys_flux_score = max(0.0, (dosimeter_mgy_h - 10.0) / 100.0)
        bio_depletion_score = max(0.0, (1.0 - alc_ratio) * 2.5)

        rsi = round(max(0.1, min(5.0, (0.5 * phys_flux_score) + (0.5 * bio_depletion_score))), 2)

        if rsi >= 1.8 or dose_gy >= 1.5:
            status = "CRITICAL_ACUTE_RADIATION_SYNDROME_HEMATOPOIETIC"
        elif rsi >= 1.0 or dose_gy >= 0.5:
            status = "WARNING_SOLAR_PARTICLE_EVENT_EXPOSURE"
        else:
            status = "NOMINAL_COSMIC_BACKGROUND"

        return rsi, dose_gy, status

    @staticmethod
    def calculate_physiological_strain_index(
        core_temp_c: float,
        baseline_temp_c: float,
        heart_rate_bpm: float,
        baseline_hr_bpm: float
    ) -> Tuple[float, str]:
        """
        Computes the universal Moran Physiological Strain Index (PSI) (0 - 10 scale).
        Quantifies thermal and cardiovascular strain during microgravity exercise.
        """
        delta_temp = max(0.0, core_temp_c - baseline_temp_c)
        temp_denominator = max(0.1, 39.5 - baseline_temp_c)
        temp_strain = 5.0 * (delta_temp / temp_denominator)

        delta_hr = max(0.0, heart_rate_bpm - baseline_hr_bpm)
        hr_denominator = max(1.0, 180.0 - baseline_hr_bpm)
        cardio_strain = 5.0 * (delta_hr / hr_denominator)

        psi = round(min(10.0, max(0.0, temp_strain + cardio_strain)), 1)

        if psi >= 7.5:
            status = "CRITICAL_EXERTIONAL_HEAT_STROKE"
        elif psi >= 5.0:
            status = "WARNING_HIGH_THERMAL_CARDIOVASCULAR_STRAIN"
        elif psi >= 3.0:
            status = "MODERATE_EXERCISE_STRAIN"
        else:
            status = "NOMINAL_RESTING_STRAIN"

        return psi, status

