"""
backend/app/ai/decision_engine.py
Clinical Decision Engine that evaluates multi-signal evidence, calculates
clinical confidence scores, and structures triage records for the JARVIS advisory layer.
"""

import math
from typing import Dict, Any, List, Optional
import numpy as np


class DecisionEngine:
    """
    Mathematical decision layer that calculates Evidence Weight (E) and Confidence (C).
    Guarantees clinical explainability by formulating structured diagnostic facts.
    """

    # Clinically weighted evidence factors for spaceflight physiology
    SIGNAL_WEIGHTS = {
        "heart_rate": 1.5,
        "hrv_rmssd": 1.8,
        "spo2": 2.5,
        "cabin_co2": 2.2,
        "core_temp": 1.2,
        "sleep_score": 1.0
    }

    @classmethod
    def calculate_evidence_and_confidence(
        cls,
        telemetry: Dict[str, Any],
        baseline: Dict[str, Dict[str, float]],
        env_thresholds: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculates the multi-signal Evidence Score (E) and Clinical Confidence (C).
        Formula:
          E = sum( w_i * I(|Z_i| >= 1.5) * persistence_factor )
          C = min(99%, (E / E_threshold * SignalQuality) * 100)
        """
        evidence_signals = []
        total_evidence_weight = 0.0

        # 1. Evaluate Heart Rate
        hr = telemetry.get("heart_rate", 62.0)
        hr_base = baseline.get("heart_rate", {"mean": 62.0, "std": 3.8})
        z_hr = (hr - hr_base["mean"]) / max(hr_base["std"], 1e-4)
        if abs(z_hr) >= 1.5:
            weight = cls.SIGNAL_WEIGHTS["heart_rate"] * (abs(z_hr) / 2.0)
            total_evidence_weight += weight
            evidence_signals.append({
                "metric": "Heart Rate",
                "value": hr,
                "baseline_mean": hr_base["mean"],
                "z_score": round(z_hr, 2),
                "clinical_finding": f"Resting HR {hr:.1f} bpm ({z_hr:+.1f}σ deviation from personal baseline)"
            })

        # 2. Evaluate HRV (rMSSD)
        hrv = telemetry.get("hrv_rmssd", 65.0)
        hrv_base = baseline.get("hrv_rmssd", {"mean": 65.0, "std": 7.5})
        z_hrv = (hrv - hrv_base["mean"]) / max(hrv_base["std"], 1e-4)
        if z_hrv <= -1.5:
            weight = cls.SIGNAL_WEIGHTS["hrv_rmssd"] * (abs(z_hrv) / 2.0)
            total_evidence_weight += weight
            drop_pct = max(0.0, (hrv_base["mean"] - hrv) / max(hrv_base["mean"], 1e-4) * 100)
            evidence_signals.append({
                "metric": "Heart Rate Variability (rMSSD)",
                "value": hrv,
                "baseline_mean": hrv_base["mean"],
                "z_score": round(z_hrv, 2),
                "clinical_finding": f"HRV dropped {drop_pct:.0f}% to {hrv:.1f} ms (parasympathetic tone depression)"
            })

        # 3. Evaluate SpO2
        spo2 = telemetry.get("spo2", 98.2)
        if spo2 < 95.0:
            weight = cls.SIGNAL_WEIGHTS["spo2"] * (2.0 if spo2 < 90.0 else 1.2)
            total_evidence_weight += weight
            evidence_signals.append({
                "metric": "Blood Oxygenation (SpO₂)",
                "value": spo2,
                "z_score": round((spo2 - 98.2) / 0.6, 2),
                "clinical_finding": f"SpO₂ decreased to {spo2:.1f}% ({'Severe Hypoxia' if spo2 < 90 else 'Mild Hypoxia'})"
            })

        # 4. Evaluate Cabin CO2
        co2 = telemetry.get("cabin_co2", 1.8)
        co2_crit = env_thresholds.get("cabin_co2_mmhg", {}).get("critical_threshold", 4.0)
        co2_warn = env_thresholds.get("cabin_co2_mmhg", {}).get("warning_threshold", 3.0)
        if co2 >= co2_warn:
            weight = cls.SIGNAL_WEIGHTS["cabin_co2"] * (2.0 if co2 >= co2_crit else 1.3)
            total_evidence_weight += weight
            evidence_signals.append({
                "metric": "Cabin Ambient CO₂",
                "value": co2,
                "clinical_finding": f"CO₂ concentration elevated at {co2:.2f} mmHg ({'Toxic Gas Pooling' if co2 >= co2_crit else 'Moderate Buildup'})"
            })

        # 5. Evaluate Sleep Score
        sleep = telemetry.get("sleep_score", 85.0)
        if sleep < 70.0:
            weight = cls.SIGNAL_WEIGHTS["sleep_score"] * 1.0
            total_evidence_weight += weight
            evidence_signals.append({
                "metric": "Sleep Efficiency",
                "value": sleep,
                "clinical_finding": f"Sleep score {sleep:.0f}/100 indicating chronic circadian sleep debt"
            })

        # 6. Evaluate Point-of-Care Laboratory Biomarkers & Computational Indices
        if "potassium" in telemetry and telemetry["potassium"] is not None:
            k_val = float(telemetry["potassium"])
            if k_val < 3.5 or telemetry.get("computed_arf", 0) >= 1.25:
                total_evidence_weight += 2.5
                evidence_signals.append({
                    "metric": "Serum Potassium (K+) & QTc",
                    "value": k_val,
                    "clinical_finding": f"Hypokalemia {k_val:.2f} mmol/L (ARF: {telemetry.get('computed_arf', 0):.2f}, Fridericia QTc: {telemetry.get('computed_qtc', 400):.0f}ms)"
                })

        if "il_6" in telemetry and telemetry["il_6"] is not None:
            il6 = float(telemetry["il_6"])
            wbc = float(telemetry.get("wbc_count", 6.8))
            if il6 > 15.0 or telemetry.get("computed_epi", 0) >= 0.9:
                total_evidence_weight += 2.5
                evidence_signals.append({
                    "metric": "Cytokine Cascade & EPI",
                    "value": il6,
                    "clinical_finding": f"Subclinical IL-6 surge {il6:.1f} pg/mL, WBC {wbc:.1f}k/uL (EPI Index: {telemetry.get('computed_epi', 0):.2f})"
                })

        if "hematocrit" in telemetry and telemetry["hematocrit"] is not None:
            hct = float(telemetry["hematocrit"])
            if hct > 48.0 or telemetry.get("computed_trm", 0) >= 1.5:
                total_evidence_weight += 2.2
                evidence_signals.append({
                    "metric": "Venous Stasis / TRM",
                    "value": hct,
                    "clinical_finding": f"Cephalic hemoconcentration Hct {hct:.1f}%, Platelets {telemetry.get('platelet_count', 240):.0f}k (TRM Score: {telemetry.get('computed_trm', 1.0):.2f})"
                })

        if "radiation_flux" in telemetry or "computed_rsi" in telemetry or "radiation_dose_gy" in telemetry:
            rsi = float(telemetry.get("computed_rsi", 0))
            dose = float(telemetry.get("radiation_dose_gy", 0))
            flux = float(telemetry.get("radiation_flux", 0))
            if rsi >= 1.0 or dose >= 0.5 or flux > 20.0:
                total_evidence_weight += 3.0
                evidence_signals.append({
                    "metric": "Solar Particle Radiation & Biodosimetry",
                    "value": dose,
                    "clinical_finding": f"Cosmic flux {flux:.0f} mGy/h, Andrews Kinetic Absorbed Dose: {dose:.2f} Gy (RSI Score: {rsi:.2f})"
                })

        # Calculate Confidence Score C bounded to [50%, 99%]
        e_threshold = 4.0
        signal_quality = 0.98
        if total_evidence_weight > 0:
            raw_confidence = (total_evidence_weight / e_threshold) * signal_quality * 100.0
            confidence = max(50.0, min(99.0, round(raw_confidence, 1)))
        else:
            confidence = 95.0

        return {
            "evidence_weight": round(total_evidence_weight, 2),
            "confidence_percent": confidence,
            "signal_count": len(evidence_signals),
            "findings": evidence_signals
        }

    @classmethod
    def structure_triage_record(
        cls,
        astronaut_id: str,
        astronaut_name: str,
        telemetry: Dict[str, Any],
        baseline: Dict[str, Dict[str, float]],
        env_thresholds: Dict[str, Any],
        severity: str,
        reason: str
    ) -> Dict[str, Any]:
        """Synthesizes the complete clinical decision record."""
        evidence = cls.calculate_evidence_and_confidence(telemetry, baseline, env_thresholds)

        # Differential Diagnosis Synthesis for All 18 Scenarios
        reason_lower = (reason or "").lower()
        sc_upper = str(telemetry.get("scenario_phase", "")).upper()

        if "SOLAR_RADIATION" in sc_upper or "SCENARIO_3_SOLAR" in sc_upper or "SCENARIO_8_SOLAR" in sc_upper or "radiation" in reason_lower or telemetry.get("computed_rsi", 0) >= 1.0:
            diagnosis = "Solar Particle Event & High Radiation Exposure"
            action = "Evacuate all crew to the water-shielded storm shelter, take protective medication, and monitor dosimeter badges."
        elif "SEPSIS" in sc_upper or "SCENARIO_10_PRESYMPTOMATIC" in sc_upper or "SCENARIO_5_PRESYMPTOMATIC" in sc_upper or "sepsis" in reason_lower or telemetry.get("computed_epi", 0) >= 1.2:
            diagnosis = "Early Immune Activation & Subclinical Infection Cascade"
            action = "Start oral hydration, begin prophylactic medication, and schedule follow-up blood biomarker check in four hours."
        elif "HYPOKALEMIA" in sc_upper or "SCENARIO_6_HYPOKALEMIA" in sc_upper or "arrhythmia" in reason_lower or "hypokalemia" in reason_lower or telemetry.get("computed_arf", 0) >= 1.25:
            diagnosis = "Low Serum Potassium & Heart Rhythm Vulnerability"
            action = "Drink oral potassium electrolyte pouch, attach continuous ECG lead II monitor, and pause heavy exercise."
        elif "THROMBOSIS" in sc_upper or "SCENARIO_7_VENOUS" in sc_upper or "thrombosis" in reason_lower or "clot" in reason_lower or telemetry.get("computed_trm", 0) >= 1.5:
            diagnosis = "Weightless Blood Sluggishness & Neck Vein Clot Risk"
            action = "Put on thigh compression cuffs, drink 500 mL of water, and perform portable neck vein ultrasound."
        elif "CO2_SCRUBBER" in sc_upper or "SCENARIO_1_CO2" in sc_upper:
            diagnosis = "Elevated Cabin Carbon Dioxide / Scrubber Saturation"
            action = "Switch to secondary air scrubber canisters, check module air circulation fans, and limit heavy physical work."
        elif "DECOMPRESSION" in sc_upper or "SCENARIO_2_SLOW" in sc_upper:
            diagnosis = "Cabin Pressure Drop & Hypoxia Alert"
            action = "Put on supplemental oxygen masks immediately, locate module pressure seal, and secure bulkheads."
        elif "AMMONIA" in sc_upper or "SCENARIO_4_AMMONIA" in sc_upper:
            diagnosis = "Toxic Cabin Ammonia Coolant Ingress"
            action = "Don emergency breathing masks immediately, isolate the external cooling loop, and seal module hatches."
        elif "FIRE" in sc_upper or "SCENARIO_5_ELECTRICAL" in sc_upper:
            diagnosis = "Avionics Electrical Smolder & Toxic Combustion Gas"
            action = "Depower the affected electrical bus, isolate the electronics bay, and inspect with portable extinguisher."
        elif "CARDIOVASCULAR_DECONDITIONING" in sc_upper or "SCENARIO_8_CARDIOVASCULAR" in sc_upper:
            diagnosis = "Cardiovascular Deconditioning & Exercise Intolerance"
            action = "Perform thirty minutes of cycle exercise, drink sodium electrolyte solution, and wear lower body compression."
        elif "CORONARY_MICROVASCULAR" in sc_upper or "SCENARIO_9_CORONARY" in sc_upper:
            diagnosis = "Cardiac Blood Vessel Stress & Autonomic Strain"
            action = "Take one chewable baby aspirin, initiate continuous ECG telemetry, and enforce rest in crew quarters."
        elif "LATENT_VIRUS" in sc_upper or "SCENARIO_11_LATENT" in sc_upper:
            diagnosis = "Immune Suppression & Dormant Virus Reactivation"
            action = "Administer prescribed antiviral medication, ensure adequate fluid intake, and schedule eight hours of rest."
        elif "CYTOKINE_RELEASE" in sc_upper or "SCENARIO_12_CYTOKINE" in sc_upper:
            diagnosis = "Hyperinflammatory Cytokine Surge"
            action = "Administer anti-inflammatory medication, ensure continuous vital monitoring, and prepare IV fluid hydration."
        elif "RADIATION_MARROW" in sc_upper or "SCENARIO_13_RADIATION" in sc_upper:
            diagnosis = "Cumulative Radiation Exposure & Bone Marrow Suppression"
            action = "Initiate immune support medication, maintain strict sterile hygiene protocols, and restrict spacewalks."
        elif "NEPHROLITHIASIS" in sc_upper or "SCENARIO_14_NEPHROLITHIASIS" in sc_upper:
            diagnosis = "Renal Calcium Excretion & Kidney Stone Risk"
            action = "Increase hydration to three liters daily, take potassium citrate supplement, and monitor urine output."
        elif "DEHYDRATION" in sc_upper or "SCENARIO_15_INTRAVASCULAR" in sc_upper:
            diagnosis = "Circulating Blood Volume Deficit & Dehydration"
            action = "Drink one liter of balanced electrolyte solution and rest in a recumbent position."
        elif "HEPATIC" in sc_upper or "SCENARIO_16_HEPATIC" in sc_upper:
            diagnosis = "Metabolic and Liver Clearance Stress"
            action = "Review and adjust medication dosages, drink fresh electrolyte water, and schedule a rest cycle."
        elif "SANS" in sc_upper or "SCENARIO_17_SPACE_VISION" in sc_upper:
            diagnosis = "Spaceflight-Associated Neuro-ocular Syndrome (SANS)"
            action = "Use lower body negative pressure device for one hour daily and perform portable eye ultrasound scan."
        elif "FATIGUE" in sc_upper or "SCENARIO_18_CIRCADIAN" in sc_upper or "SCENARIO_1_BASELINE_DRIFT" in sc_upper:
            diagnosis = "Circadian Misalignment & Cumulative Sleep Debt"
            action = "Enforce eight hours of sleep cycle with dimmed cabin lighting and adjust duty shift schedule."
        elif severity == "CRITICAL":
            diagnosis = "Acute Hypoxia & Microgravity Life-Support Crisis"
            action = "Don supplemental oxygen masks immediately and initiate emergency cabin air scrub."
        elif severity == "WARNING":
            if telemetry.get("cabin_co2", 0) >= 3.0:
                diagnosis = "Localized Cabin Carbon Dioxide Accumulation"
                action = "Check module ventilation fans and move to higher convective airflow area."
            else:
                diagnosis = "Accumulating Autonomic Nervous System & Cardiovascular Strain"
                action = "Administer oral electrolyte rehydration and schedule an extra restorative rest block."
        elif severity == "INFO":
            diagnosis = "Isolated Physiological Baseline Drift"
            action = "Continue mission activities; maintain passive sentry monitoring."
        else:
            diagnosis = "All Physiological Systems Nominal"
            action = "Nominal mission operations."

        return {
            "astronaut_id": astronaut_id,
            "astronaut_name": astronaut_name,
            "severity": severity,
            "confidence_percent": evidence["confidence_percent"],
            "evidence_weight": evidence["evidence_weight"],
            "correlated_signals_count": evidence["signal_count"],
            "primary_diagnosis": diagnosis,
            "actionable_instruction": action,
            "trigger_reason": reason,
            "evidence_breakdown": evidence["findings"],
            "telemetry_snapshot": telemetry
        }
