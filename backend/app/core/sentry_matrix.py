"""
backend/app/core/sentry_matrix.py
Multi-Signal Anomaly Correlator & 3-Tier Alert Escalation Matrix.
Combines physiological signals with environmental sensors to classify severity.
"""

from typing import Dict, Any, Tuple
from .activity_gating import ActivityGatingEngine
from .zscore_evaluator import ZScoreEvaluator
from .computational_biomarkers import ComputationalBiomarkers


class SentryMatrixEngine:
    """Multi-Signal fusion engine that evaluates telemetry against personal baselines."""

    @classmethod
    def evaluate_state(
        cls,
        telemetry: Dict[str, Any],
        baseline: Dict[str, Dict[str, float]],
        env_thresholds: Dict[str, Any]
    ) -> Tuple[str, float, str]:
        """
        Evaluates the current multi-signal telemetry packet against physiological baselines
        and computational biomarker indices (EPI, ARF, TRM, PSI).
        Returns: (severity, confidence_score, clinical_trigger_reason)
        Severity levels: 'NOMINAL', 'INFO', 'WARNING', 'CRITICAL'
        """
        hr = float(telemetry.get("heart_rate", 70.0))
        hrv = float(telemetry.get("hrv_rmssd", 65.0))
        spo2 = float(telemetry.get("spo2", 98.0))
        cabin_co2 = float(telemetry.get("cabin_co2", 1.8))
        mission_state = telemetry.get("mission_state", "REST")

        # 1. ACUTE OVERRIDE: Check Critical Thresholds First (Life-Safety Rule)
        co2_crit = env_thresholds.get("cabin_co2_mmhg", {}).get("critical_threshold", 4.0)
        if spo2 < 90.0 and cabin_co2 >= co2_crit:
            return (
                "CRITICAL",
                0.96,
                f"Acute hypoxia (SpO₂: {spo2:.1f}%) coincident with toxic cabin CO₂ pocketing ({cabin_co2:.2f} mmHg)."
            )
        elif spo2 < 90.0:
            return ("CRITICAL", 0.94, f"Severe hypoxia threshold breached: SpO₂ dropped to {spo2:.1f}%.")
        elif cabin_co2 >= co2_crit:
            return ("CRITICAL", 0.95, f"Toxic cabin ambient CO₂ concentration: {cabin_co2:.2f} mmHg.")

        # 2. ACTIVITY GATING: Check if exercise exertion should be gated (NASA-STD-3001)
        is_workout_gated = ActivityGatingEngine.should_gate_cardiac_alarm(mission_state, hr)
        k_val = float(telemetry.get("potassium", 4.2))

        # 3. COMPUTATIONAL BIOMARKER CALCULATIONS & CRITICAL CHECKS
        # 3A. Hypokalemia & Arrhythmogenic Risk (ARF) & Dynamic Fridericia QTc
        if "potassium" in telemetry:
            arf, qtc, _ = ComputationalBiomarkers.calculate_arrhythmogenic_risk(hr, k_val)
            telemetry["computed_arf"] = max(arf, float(telemetry.get("computed_arf", 0.0)))
            telemetry["computed_qtc"] = max(qtc, float(telemetry.get("computed_qtc", 0.0)))
            # Only trigger hypokalemic arrhythmia emergency if potassium is depleted or workout is NOT active
            if (telemetry["computed_arf"] >= 1.6 or telemetry["computed_qtc"] >= 485.0) and (k_val < 3.5 or not is_workout_gated):
                return (
                    "CRITICAL",
                    0.95,
                    f"Ventricular Arrhythmia Risk: Severe hypokalemic QTc prolongation ({telemetry['computed_qtc']:.1f}ms, K+={k_val:.2f} mmol/L, ARF={telemetry['computed_arf']:.2f})."
                )

        if is_workout_gated and k_val >= 3.5:
            return ("NOMINAL", 0.90, "Active workout session; exercise-induced tachycardia gated.")

        # 2B. Early Sepsis Prediction Index (EPI) — evaluated BEFORE TRM because
        # elevated IL-6 in sepsis/cytokine storm also inflates TRM artificially.
        # Correct clinical reason must be EPI, not thrombosis, when immune surge drives both.
        if "il_6" in telemetry and "wbc_count" in telemetry:
            il6 = float(telemetry["il_6"])
            wbc = float(telemetry["wbc_count"])
            base_hrv = baseline.get("hrv_rmssd", {}).get("mean", 65.0)
            epi, _ = ComputationalBiomarkers.calculate_early_sepsis_index(il6, wbc, hrv, base_hrv)
            telemetry["computed_epi"] = max(epi, float(telemetry.get("computed_epi", 0.0)))
            if telemetry["computed_epi"] >= 1.5:
                return (
                    "CRITICAL",
                    0.93,
                    f"Early Sepsis Cascade: Acute presymptomatic immune surge & autonomic uncoupling (EPI={telemetry['computed_epi']:.2f}, IL-6={il6:.1f} pg/mL, WBC={wbc:.1f}k)."
                )

        # 2C. Microgravity Venous Stasis & Thrombosis Risk Metric (TRM)
        if "hematocrit" in telemetry and "platelet_count" in telemetry:
            hct = float(telemetry["hematocrit"])
            plt = float(telemetry["platelet_count"])
            il6 = float(telemetry.get("il_6", 6.2))
            trm, _ = ComputationalBiomarkers.calculate_venous_thrombosis_risk(hct, plt, il6, spo2)
            telemetry["computed_trm"] = max(trm, float(telemetry.get("computed_trm", 0.0)))
            if telemetry["computed_trm"] >= 2.2:
                return (
                    "CRITICAL",
                    0.94,
                    f"Thrombosis Alert: Acute cephalic venous stasis & hypercoagulability (TRM={telemetry['computed_trm']:.2f}, Hct={hct:.1f}%, Platelets={plt:.0f}k)."
                )

        # 2D. Acute Solar Particle Event & Radiation Biodosimetry (RSI & Andrews Model)
        if "radiation_flux" in telemetry or "lymphocyte_count" in telemetry or "computed_rsi" in telemetry:
            rad_flux = float(telemetry.get("radiation_flux", 0.05))
            lympho = float(telemetry.get("lymphocyte_count", 2.2))
            rsi, dose_gy, _ = ComputationalBiomarkers.calculate_radiation_biodosimetry(rad_flux, lympho)
            telemetry["computed_rsi"] = max(rsi, float(telemetry.get("computed_rsi", 0.0)))
            telemetry["radiation_dose_gy"] = max(dose_gy, float(telemetry.get("radiation_dose_gy", 0.0)))
            if telemetry["computed_rsi"] >= 1.8 or (telemetry["radiation_dose_gy"] >= 1.5 and rad_flux >= 10.0):
                return (
                    "CRITICAL",
                    0.96,
                    f"Radiation Emergency: Acute Solar Particle Event & Lymphocyte Depletion (Dose={telemetry['radiation_dose_gy']:.2f} Gy, RSI={telemetry['computed_rsi']:.2f}, Flux={rad_flux:.0f} mGy/h). Evacuate to Storm Shelter!"
                )

        # 3. ACTIVITY GATING: Check if cardiac exertion should be gated
        if ActivityGatingEngine.should_gate_cardiac_alarm(mission_state, hr):
            # If in workout and oxygen/CO2/electrolytes are safe, severity is NOMINAL
            return ("NOMINAL", 0.90, "Active workout session; exercise-induced tachycardia gated.")

        # 4. WARNING LEVEL CHECKS (Presymptomatic & Correlated Deviations)
        if telemetry.get("computed_rsi", 0.0) >= 1.0 or telemetry.get("radiation_dose_gy", 0.0) >= 0.5:
            rsi = telemetry["computed_rsi"]
            dose = telemetry["radiation_dose_gy"]
            flux = float(telemetry.get("radiation_flux", 45.0))
            return (
                "WARNING",
                0.91,
                f"Solar Particle Event Warning: Cosmic radiation surge detected (Flux={flux:.0f} mGy/h, Biodosimetry Dose={dose:.2f} Gy, RSI={rsi:.2f})."
            )

        if telemetry.get("computed_epi", 0.0) >= 0.9:
            epi = telemetry["computed_epi"]
            il6 = float(telemetry.get("il_6", 0.0))
            wbc = float(telemetry.get("wbc_count", 0.0))
            return (
                "WARNING",
                0.90,
                f"Presymptomatic Sepsis Risk: Immune cytokine surge (EPI={epi:.2f}, IL-6={il6:.1f} pg/mL, WBC={wbc:.1f}k prior to thermal fever)."
            )

        if telemetry.get("computed_arf", 0.0) >= 1.25 or telemetry.get("computed_qtc", 0.0) >= 450.0:
            arf = telemetry["computed_arf"]
            qtc = telemetry["computed_qtc"]
            k_val = float(telemetry.get("potassium", 3.8))
            return (
                "WARNING",
                0.89,
                f"Cardiac Arrhythmogenic Vulnerability: Dynamic QTc widening ({qtc:.1f}ms, K+={k_val:.2f} mmol/L, ARF={arf:.2f})."
            )

        if telemetry.get("computed_trm", 0.0) >= 1.5:
            trm = telemetry["computed_trm"]
            hct = float(telemetry.get("hematocrit", 44.0))
            return (
                "WARNING",
                0.88,
                f"Microgravity Venous Stasis: Hypercoagulable risk profile (TRM={trm:.2f}, Hct={hct:.1f}%)."
            )


        # Multi-signal Z-Score Deviations
        z_scores = ZScoreEvaluator.evaluate_telemetry_point(telemetry, baseline)
        z_hr = z_scores.get("z_heart_rate", 0.0)
        z_hrv = z_scores.get("z_hrv_rmssd", 0.0)
        co2_warn = env_thresholds.get("cabin_co2_mmhg", {}).get("warning_threshold", 3.0)

        # Level 2 WARNING Conditions: 2+ correlated deviations or CO2 warning
        if (z_hr >= 2.0 and z_hrv <= -2.0) or cabin_co2 >= co2_warn:
            reasons = []
            if z_hr >= 2.0 and z_hrv <= -2.0:
                reasons.append(f"Cardiovascular strain (HR Z={z_hr:+.1f}, HRV Z={z_hrv:+.1f})")
            if cabin_co2 >= co2_warn:
                reasons.append(f"Elevated cabin CO₂ ({cabin_co2:.2f} mmHg)")
            return ("WARNING", 0.88, " & ".join(reasons) + " - accumulating fatigue.")

        # Level 1 INFO Conditions: Single metric mild deviation or mild lab drift
        if abs(z_hr) >= 1.5 or abs(z_hrv) >= 1.5:
            return ("INFO", 0.75, f"Mild single-metric drift (HR Z={z_hr:+.1f}, HRV Z={z_hrv:+.1f}).")

        if (
            telemetry.get("potassium", 4.2) < 3.8 or
            telemetry.get("il_6", 6.0) > 15.0 or
            telemetry.get("hematocrit", 44.0) > 48.0
        ):
            return ("INFO", 0.78, "Mild point-of-care laboratory biomarker variation detected.")

        return ("NOMINAL", 0.95, "All telemetry parameters nominal within personal baseline range.")
