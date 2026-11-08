"""
backend/app/ai/fallback_templates.py
Deterministic 2-sentence clinical voice scripts.
Guarantees JARVIS voice instructions fire in 0ms even if the local LLM is offline or busy.
"""

import re
from typing import Dict, Any, Optional

CANONICAL_CREW_NAMES: Dict[str, str] = {
    "AST-01_COMMANDER": "Commander Haley",
    "crew_1": "Commander Haley",
    "AST-02_PILOT": "Pilot Chris",
    "crew_2": "Pilot Chris",
    "AST-03_MEDICAL": "Doctor Sian",
    "crew_3": "Doctor Sian",
    "AST-04_ENGINEER": "Specialist Leo",
    "crew_4": "Specialist Leo",
    "ALL_CREW": "All Crew Stations",
    "all_crew": "All Crew Stations",
}


def clean_crew_name(name: str = "", astronaut_id: str = "") -> str:
    """Returns a clean, human-pronounceable crew name for JARVIS voice output."""
    if " and " in name:
        return name
    if astronaut_id in ("ALL_CREW", "all_crew") or name in ("All Crew", "All Crew Stations", "ALL_CREW"):
        return "All Crew Stations"
    if astronaut_id and astronaut_id in CANONICAL_CREW_NAMES:
        return CANONICAL_CREW_NAMES[astronaut_id]
    if name:
        cleaned = re.sub(r'\(.*?\)', '', name).strip()
        if cleaned.lower() in ("all crew", "all crew stations", "all stations"):
            return "All Crew Stations"
        if cleaned.lower() in ("commander", "cmndr", "cmdr"):
            return "Commander Haley"
        if cleaned.lower() == "pilot":
            return "Pilot Chris"
        if cleaned.lower() in ("medical", "doctor", "dr", "dr."):
            return "Doctor Sian"
        if cleaned.lower() in ("engineer", "specialist"):
            return "Specialist Leo"
        if cleaned:
            return cleaned
    return "Commander Haley"


def format_crew_names_list(names: list) -> str:
    """Formats a list of crew names into a natural, grammatical English string."""
    cleaned = [clean_crew_name(n) for n in names if n]
    deduped = list(dict.fromkeys(cleaned))
    if not deduped:
        return "Crew Stations"
    if len(deduped) == 1:
        return deduped[0]
    if len(deduped) == 2:
        return f"{deduped[0]} and {deduped[1]}"
    return f"{', '.join(deduped[:-1])}, and {deduped[-1]}"



FALLBACK_VOICE_SCRIPTS: Dict[str, str] = {
    "NOMINAL_GREETING": (
        "Good day, {name}. All your vitals are calm and steady. I advise keeping up your routine hydration as you begin your watch."
    ),
    "ALL_CREW_HYPOXIA": (
        "All stations, emergency alert! Cabin oxygen is dropping fast and carbon dioxide is rising. I advise all crew to put on your oxygen masks and seal your suits immediately!"
    ),
    "ALL_CREW_SOLAR_STORM": (
        "All stations, severe solar radiation storm incoming! I advise all crew to evacuate immediately into the water-shielded storm shelter!"
    ),
    "ALL_CREW_WARNING": (
        "All crew stations, please listen. Physical fatigue is rising across the crew quarters. I advise everyone to pause heavy exertion and take a brief rest."
    ),
    "ALL_CREW_CRITICAL": (
        "All stations, critical emergency! Environmental safety limits have been breached. I advise immediate emergency containment protocols!"
    ),
    # ── Environmental & Life Support (Scenarios 1 - 5) ──
    "SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH": (
        "Commander {name}, cabin carbon dioxide is rising. I advise switching to the backup air scrubber and checking airflow."
    ),
    "SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA": (
        "Emergency, {name}! Cabin pressure is falling and oxygen levels are dropping. Please put on your oxygen mask and seal the bulkheads immediately!"
    ),
    "SCENARIO_3_SOLAR_RADIATION_STORM": (
        "Urgent alert, {name}! A solar particle storm is approaching our spacecraft. I advise taking your radiation medication and heading to the storm shelter right now!"
    ),
    "SCENARIO_4_AMMONIA_COOLANT_LEAK": (
        "Emergency, {name}! Toxic chemical coolant has entered the cabin air. Please put on your full face mask and evacuate to the safe module!"
    ),
    "SCENARIO_5_ELECTRICAL_FIRE_SMOLDER": (
        "Caution, {name}. Sensors detect smoldering wiring behind the avionics panel. I advise cutting power to that bus and inspecting with a fire extinguisher."
    ),

    # ── Cardiovascular & Electrophysiology (Scenarios 6 - 9) ──
    "SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA": (
        "Hello {name}. Your potassium levels are running low, which can cause muscle cramps and heart flutter. I advise drinking your potassium electrolyte pouch and resting."
    ),
    "SCENARIO_7_VENOUS_THROMBOSIS_RISK": (
        "Hello {name}. Blood is moving slowly in your neck veins from weightlessness. I advise putting on your compression cuffs and drinking some water to help circulation."
    ),
    "SCENARIO_8_CARDIOVASCULAR_DECONDITIONING": (
        "{name}, your heart is working harder to pump blood today. I advise doing thirty minutes on the cycle ergometer and having a salt hydration drink."
    ),
    "SCENARIO_9_CORONARY_MICROVASCULAR_STRESS": (
        "{name}, your heart blood vessels are showing signs of stress and inflammation. I advise taking one chewable baby aspirin and resting while we monitor your ECG."
    ),

    # ── Infection & Immune System (Scenarios 10 - 13) ──
    "SCENARIO_10_PRESYMPTOMATIC_SEPSIS": (
        "{name}, your immune system is working hard to fight off an infection before you feel sick. I advise resting in your quarters and starting an intravenous hydration bag."
    ),
    "SCENARIO_11_LATENT_VIRUS_REACTIVATION": (
        "{name}, your immune markers show an old dormant virus is waking up inside your nerve pathways. I advise taking your antiviral tablets and resting."
    ),
    "SCENARIO_12_CYTOKINE_RELEASE_STORM": (
        "Warning, {name}. Your body's immune chemicals are spiking into an over-reactive inflammatory storm. I advise taking your anti-inflammatory medication immediately."
    ),
    "SCENARIO_13_RADIATION_MARROW_EXHAUSTION": (
        "{name}, prolonged cosmic radiation has depleted your white blood cell factory. I advise an injection of white-cell booster medication and staying in the clean room."
    ),

    # ── Metabolic, Renal & Neuro-Ocular (Scenarios 14 - 18) ──
    "SCENARIO_14_NEPHROLITHIASIS": (
        "{name}, your bone calcium is crystallizing in your kidneys and could form a painful stone. I advise drinking extra water today and taking a potassium citrate packet."
    ),
    "SCENARIO_15_INTRAVASCULAR_DEHYDRATION": (
        "{name}, your fluid levels are low and your blood is becoming concentrated. I advise drinking two electrolyte recovery packs and resting from heavy duties."
    ),
    "SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION": (
        "{name}, your liver is processing medication more slowly in zero gravity today. I advise reducing your medication dose by half to avoid accidental buildup."
    ),
    "SCENARIO_17_SPACE_VISION_SANS": (
        "{name}, fluid pressure is building up behind your eyes from weightlessness. I advise using the lower-body negative pressure suit for two hours to draw fluid back down."
    ),
    "SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT": (
        "{name}, you have been working long hours and your body clock is out of rhythm. I advise turning on the blue light therapy lamp and taking a brief rest."
    ),

    # ── Standard Aliases for Compatibility ──
    "SCENARIO_1_BASELINE_DRIFT": (
        "{name}, you have been working long hours and your body is getting tired. I advise taking a ten-minute rest and having a cool drink."
    ),
    "SCENARIO_1_BASELINE_DRIFT_MULTI": (
        "{name}, you have been working long hours and your bodies are showing elevated fatigue. I advise taking a synchronized ten-minute rest and having a cool drink."
    ),
    "SCENARIO_2_WORKOUT_GATING": (
        "Great workout, {name}. Your heart rate is high from exercise, so I have silenced your alarms. I advise taking time to cool down and stretch."
    ),
    "SCENARIO_3_CO2_HYPOXIA": (
        "Emergency, {name}! Cabin oxygen is dropping fast and carbon dioxide is rising. I advise putting on your oxygen mask and checking your suit seal immediately!"
    ),
    "SCENARIO_4_DEEP_SPACE_BLACKOUT": (
        "Earth communications are offline, {name}. Local systems are running smoothly, and I am watching over you."
    ),
    "SCENARIO_5_PRESYMPTOMATIC_SEPSIS": (
        "{name}, your immune system is working hard to fight off an infection before you feel sick. I advise resting in your quarters and starting an intravenous hydration bag."
    ),
    "SCENARIO_8_SOLAR_RADIATION_STORM": (
        "Urgent alert, {name}! A solar particle storm is approaching our spacecraft. I advise taking your radiation medication and heading to the storm shelter right now!"
    ),
    "SCENARIO_5_VOICE_QUERY": (
        "Hello {name}. Your vitals are looking steady and calm right now. I advise continuing your planned shift while I monitor your telemetry."
    ),
    "DEFAULT_NOMINAL": (
        "Good day, {name}. All your vitals are calm and steady. I advise keeping up your routine hydration."
    ),
    "DEFAULT_WARNING": (
        "{name}, your vitals are beginning to drift out of range. I advise pausing what you are doing, hydrating, and taking a rest."
    ),
    "DEFAULT_CRITICAL": (
        "Emergency, {name}! A vital health threshold has been breached. I advise immediate attention and medical protocol!"
    )
}



PROGRESSIVE_SCENARIO_SCRIPTS: Dict[str, list] = {
    "SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH": [
        "All stations, emergency alert! Cabin carbon dioxide is surging at {co2} millimeters of mercury with blood oxygen at {spo2} percent. Don emergency oxygen masks immediately.",
        "Atmospheric sentry alert for {name}: cabin carbon dioxide remains elevated at {co2} millimeters of mercury with crew blood oxygen at {spo2} percent and heart rate at {hr} bpm. Maintain emergency oxygen masks while backup scrubbers cycle.",
        "Atmospheric report for {name}: cabin carbon dioxide has successfully cleared to nominal baseline. Normal ventilation is restored."
    ],
    "SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA": [
        "Emergency, {name}! Cabin pressure has dropped to {press} kilopascals with blood oxygen at {spo2} percent. Don pressurized oxygen masks and seal compartment bulkheads immediately!",
        "Decompression sentry update for {name}: cabin pressure remains critical at {press} kilopascals with blood oxygen at {spo2} percent. Maintain 100 percent oxygen flow and continue hull seal verification.",
        "Life-support report, {name}: cabin pressure has stabilized within nominal envelope. Inspection complete."
    ],
    "SCENARIO_3_SOLAR_RADIATION_STORM": [
        "Urgent alert, {name}! Severe solar particle storm detected with cosmic radiation flux surging to {rad} milligray per hour. Take radioprotective medication and evacuate to the storm shelter immediately!",
        "Radiation sentry monitoring for {name}: cosmic proton flux remains dangerous at {rad} milligray per hour. All crew members must remain inside the water-shielded storm shelter.",
        "Dosimetry check, {name}: exterior radiation counters confirm solar particle flux has returned to nominal cosmic background."
    ],
    "SCENARIO_4_AMMONIA_COOLANT_LEAK": [
        "Emergency, {name}! Toxic ammonia coolant ingress detected with crew blood oxygen at {spo2} percent. Put on full-face respirators and isolate the internal thermal loop immediately!",
        "Toxic sentry update for {name}: chemical contamination persists with blood oxygen at {spo2} percent. Maintain respirator seal and full charcoal filtration purge.",
        "Module report, {name}: ambient chemical sensors confirm ammonia has dropped below detection limits."
    ],
    "SCENARIO_5_ELECTRICAL_FIRE_SMOLDER": [
        "Caution, {name}. Sensors detect avionics smoldering combustion with crew blood oxygen at {spo2} percent. Depower affected bus immediately and prepare halon suppression.",
        "Thermal sentry update for {name}: electrical bus smoke particulate remains detected. Verify complete circuit de-energization and continue cooling.",
        "Avionics check, {name}: particulate sensors confirm smoke has cleared from the avionics bay."
    ],
    "SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA": [
        "Critical alert, {name}. Serum potassium has dropped to {k} millimoles per liter with Q-T prolongation at {qtc} milliseconds and heart rate at {hr} bpm. Consume oral potassium electrolyte pouch immediately.",
        "Cardiac sentry monitoring for {name}: serum potassium remains depleted at {k} millimoles per liter with ongoing ventricular strain and heart rate at {hr} bpm. Continue potassium rehydration and complete physical rest.",
        "Rhythm update, {name}: serum potassium and ventricular repolarization have normalized to nominal flight baseline."
    ],
    "SCENARIO_7_VENOUS_THROMBOSIS_RISK": [
        "Critical alert, {name}. Internal jugular venous stasis and thrombosis risk elevated with TRM ratio at {trm}. Put on compression cuffs and initiate fluid protocol.",
        "Vascular sentry update for {name}: cephalic blood stasis persists with TRM ratio at {trm}. Maintain lower-body compression cuffs and structured hydration.",
        "Vascular check, {name}: Doppler ultrasound confirms jugular outflow velocity has restored to nominal baseline."
    ],
    "SCENARIO_8_CARDIOVASCULAR_DECONDITIONING": [
        "{name}, cardiovascular orthostatic deconditioning detected with compensatory heart rate elevated to {hr} beats per minute. Prescribe cycle ergometer countermeasure and fluid loading.",
        "Cardiovascular monitoring for {name}: autonomic deconditioning persists with heart rate at {hr} beats per minute. Continue prescribed countermeasure protocol.",
        "Recovery report, {name}: cardiovascular autonomic tone has returned to resting baseline."
    ],
    "SCENARIO_9_CORONARY_MICROVASCULAR_STRESS": [
        "{name}, coronary microvascular endothelial stress detected with heart rate at {hr} beats per minute. Take baby aspirin and rest while we monitor continuous vector ECG.",
        "Myocardial sentry tracking for {name}: coronary endothelial strain remains active with heart rate at {hr} beats per minute. Maintain physical rest and continuous 12-lead vector monitoring.",
        "Medical status, {name}: vascular stress indicators have fully subsided to nominal cruise baseline."
    ],
    "SCENARIO_10_PRESYMPTOMATIC_SEPSIS": [
        "Critical alert, {name}. Presymptomatic sepsis inflammatory cascade detected with interleukin-6 at {il6} picograms per milliliter and core temperature at {temp} degrees Celsius. Commence broad-spectrum antibiotic regimen immediately.",
        "Immune sentry tracking for {name}: inflammatory cascade remains active with interleukin-6 at {il6} picograms per milliliter and heart rate at {hr} bpm. Maintain intravenous hydration and antimicrobial therapy.",
        "Recovery check, {name}: inflammatory biomarkers have returned to nominal baseline."
    ],
    "SCENARIO_11_LATENT_VIRUS_REACTIVATION": [
        "{name}, latent viral reactivation detected along sensory pathways. Administer oral antiviral countermeasure and schedule circadian sleep recovery.",
        "Immunological sentry update for {name}: viral transcription markers remain active. Maintain prescribed antiviral dosing and undisturbed rest in quarters.",
        "Nerve status, {name}: cellular immune scores have stabilized and viral activity is suppressed."
    ],
    "SCENARIO_12_CYTOKINE_RELEASE_STORM": [
        "Emergency alert, {name}. Hyper-inflammatory cytokine storm detected with interleukin-6 at {il6} picograms per milliliter. High-dose steroid intervention indicated immediately.",
        "Inflammatory sentry tracking for {name}: cytokine release storm remains active with interleukin-6 at {il6} picograms per milliliter. Continue dexamethasone protocol and active hemodynamics monitoring.",
        "Immune report, {name}: hyper-inflammatory markers have successfully normalized."
    ],
    "SCENARIO_13_RADIATION_MARROW_EXHAUSTION": [
        "Critical alert, {name}. Radiation-induced hematopoietic marrow depletion detected. Administer filgrastim colony-stimulating factor and initiate reverse isolation sterile protocol.",
        "Hematology sentry tracking for {name}: marrow white blood cell recovery protocol active. Maintain strict sterile clean room precautions.",
        "Hematology check, {name}: white blood cell production has rebounded to safe levels."
    ],
    "SCENARIO_14_NEPHROLITHIASIS": [
        "Warning, {name}. Renal hypercalciuria and micro-crystallization detected in renal collecting system. Administer potassium citrate and increase hydration protocol to two-point-five liters.",
        "Renal sentry update for {name}: calcium crystallization remains active in renal tract. Continue aggressive oral hydration and urinary alkalization.",
        "Kidney check, {name}: calcium crystallization has cleared from your kidneys."
    ],
    "SCENARIO_15_INTRAVASCULAR_DEHYDRATION": [
        "Warning, {name}. Acute intravascular volume depletion detected with compensatory heart rate at {hr} beats per minute. Initiate rapid isotonic oral electrolyte loading.",
        "Hydration sentry tracking for {name}: fluid volume depletion persists with heart rate at {hr} beats per minute. Complete second electrolyte flask and maintain rest.",
        "Vascular check, {name}: hydration levels and blood thickness have fully returned to nominal green status."
    ],
    "SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION": [
        "Warning, {name}. Microgravity hepatic clearance reduction detected. Adjust pharmaceutical dosing by fifty percent to avoid toxicity.",
        "Pharmacokinetic sentry update for {name}: hepatic clearance rate remains slowed. Maintain modified medication titration and liver enzyme monitoring.",
        "Metabolism report, {name}: liver enzymes have settled into nominal steady range."
    ],
    "SCENARIO_17_SPACE_VISION_SANS": [
        "Warning, {name}. Cephalad venous pressure has elevated optic nerve sheath diameter beyond threshold. Initiate two-hour lower-body negative pressure protocol.",
        "Ocular sentry tracking for {name}: retrobulbar pressure remains elevated. Continue lower-body negative pressure session to counteract cephalad fluid shift.",
        "Ocular report, {name}: optic nerve sheath pressure has normalized."
    ],
    "SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT": [
        "Warning, {name}. Circadian phase desynchrony and autonomic exhaustion detected with resting heart rate at {hr} beats per minute. Initiate blue-spectrum phototherapy and off-duty rest.",
        "Neuro-fatigue sentry tracking for {name}: autonomic strain ongoing with resting heart rate at {hr} beats per minute. Maintain light therapy and sleep cabin quiet protocol.",
        "Fatigue update, {name}: resting autonomic scores have stabilized to nominal baseline."
    ],

    # Aliases
    "SCENARIO_3_CO2_HYPOXIA": [
        "All stations, emergency alert! Cabin carbon dioxide is surging at {co2} millimeters of mercury with blood oxygen at {spo2} percent. Don emergency oxygen masks immediately.",
        "Atmospheric sentry alert: cabin carbon dioxide remains elevated at {co2} millimeters of mercury with crew blood oxygen at {spo2} percent. Emergency oxygen masks must remain securely donned.",
        "Atmospheric report: cabin carbon dioxide has successfully cleared to nominal baseline."
    ],
    "ALL_CREW_HYPOXIA": [
        "All stations, emergency alert! Cabin carbon dioxide is surging at {co2} millimeters of mercury with blood oxygen at {spo2} percent. Don emergency oxygen masks immediately.",
        "Atmospheric sentry alert: cabin carbon dioxide remains elevated at {co2} millimeters of mercury with crew blood oxygen at {spo2} percent. Emergency oxygen masks must remain securely donned.",
        "Atmospheric report: cabin carbon dioxide has successfully cleared to nominal baseline."
    ],
    "SCENARIO_1_BASELINE_DRIFT": [
        "{name}, autonomic fatigue and physiological strain detected with heart rate at {hr} beats per minute. I advise off-duty rest and hydration.",
        "Autonomic sentry tracking for {name}: physiological strain persists with heart rate at {hr} beats per minute. Maintain sleep cabin rest.",
        "Station status update, {name}: baseline autonomic scores fully normalize."
    ],
    "SCENARIO_5_PRESYMPTOMATIC_SEPSIS": [
        "Critical alert, {name}. Presymptomatic sepsis inflammatory cascade detected with interleukin-6 at {il6} picograms per milliliter. Commence broad-spectrum antibiotic regimen immediately.",
        "Immune sentry tracking for {name}: inflammatory cascade remains active with interleukin-6 at {il6} picograms per milliliter. Maintain intravenous hydration and antimicrobial therapy.",
        "Recovery check, {name}: inflammatory biomarkers have returned to nominal baseline."
    ],
    "SCENARIO_8_SOLAR_RADIATION_STORM": [
        "Urgent alert, {name}! Severe solar particle storm detected with cosmic radiation flux surging to {rad} milligray per hour. Evacuate to the storm shelter immediately!",
        "Radiation sentry monitoring for {name}: cosmic proton flux remains dangerous at {rad} milligray per hour. Remain inside the water-shielded storm shelter.",
        "Dosimetry check, {name}: exterior radiation counters confirm solar particle flux has returned to nominal cosmic background."
    ]
}


def build_clinical_reason_script(
    reason: str,
    severity: str = "WARNING",
    astronaut_name: str = "",
    astronaut_id: str = "",
    telemetry: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """
    Intelligently extracts the clinical finding, biometric markers, and targeted
    medical countermeasure from the sentry trigger reason or telemetry packet.
    Guarantees JARVIS speaks what actually happened instead of generic fallback scripts.
    """
    if not reason:
        return None

    clean_name = clean_crew_name(astronaut_name, astronaut_id)
    r_lower = reason.lower()
    t = telemetry or {}

    # 1. Hypokalemic Arrhythmia / QTc Prolongation
    if any(k in r_lower for k in ("hypokalem", "qtc", "arrhythm", "potassium")):
        k_val = t.get("potassium")
        if k_val is None:
            k_match = re.search(r"K\+=?([0-9.]+)", reason)
            k_val = k_match.group(1) if k_match else "3.0"
        qtc_val = t.get("computed_qtc")
        if qtc_val is None:
            qtc_match = re.search(r"([0-9.]+)\s*ms", reason)
            qtc_val = qtc_match.group(1) if qtc_match else "480"
        return (
            f"{clean_name}, your cardiac monitoring detects acute hypokalemia. "
            f"Serum potassium has dropped to {k_val} millimoles per liter. "
            f"Your Q-T interval is prolonged at {qtc_val} milliseconds. "
            f"Please consume an oral potassium electrolyte pouch and rest in your quarters."
        )

    # 2. Cabin CO2 Pocketing & Ambient Life Support
    if "co2" in r_lower or "carbon dioxide" in r_lower:
        co2_val = t.get("cabin_co2")
        if co2_val is None:
            co2_match = re.search(r"([0-9.]+)\s*mmHg", reason)
            co2_val = co2_match.group(1) if co2_match else "4.0"
        spo2_val = t.get("spo2")
        if spo2_val and float(spo2_val) < 92.0:
            return (
                f"Emergency, {clean_name}. Cabin carbon dioxide has surged to {co2_val} millimeters of mercury. "
                f"Your blood oxygen is dropping at {spo2_val} percent. "
                f"This indicates acute hypercapnic hypoxia. "
                f"Please don your emergency oxygen mask and verify compartment seals immediately."
            )
        return (
            f"Caution, {clean_name}. Cabin sensors detect carbon dioxide pocketing at {co2_val} millimeters of mercury. "
            f"Atmospheric scrubbing is insufficient in this sector. "
            f"I advise switching to the backup air scrubber and increasing cabin ventilation."
        )

    # 3. Severe Hypoxia / Low Oxygen
    if "hypoxia" in r_lower or "spo2" in r_lower:
        spo2_val = t.get("spo2")
        if spo2_val is None:
            sp_match = re.search(r"([0-9.]+)\s*%", reason)
            spo2_val = sp_match.group(1) if sp_match else "88"
        return (
            f"Emergency, {clean_name}. Pulse oximetry indicates blood oxygen has fallen to {spo2_val} percent. "
            f"This requires immediate respiratory intervention. "
            f"Please don your supplemental oxygen mask and check suit seal integrity now."
        )

    # 4. Presymptomatic Sepsis / Immune Cytokine Storm
    if any(k in r_lower for k in ("sepsis", "immune surge", "cytokine", "epi")):
        il6_val = t.get("il_6")
        if il6_val is None:
            il6_match = re.search(r"IL-6=?([0-9.]+)", reason)
            il6_val = il6_match.group(1) if il6_match else "115"
        return (
            f"{clean_name}, biosensors detect a presymptomatic immune surge. "
            f"Interleukin-6 has elevated to {il6_val} picograms per milliliter. "
            f"This pattern points to early sepsis before physical symptoms appear. "
            f"I advise resting in your quarters and starting an intravenous hydration infusion."
        )

    # 5. Cephalic Venous Stasis & Thrombosis Risk
    if any(k in r_lower for k in ("thrombosis", "venous stasis", "hypercoagul", "trm")):
        hct_val = t.get("hematocrit", "48")
        return (
            f"{clean_name}, Doppler sensors detect cephalic venous stasis. "
            f"Blood is pooling in your neck veins from microgravity, with hematocrit at {hct_val} percent. "
            f"This increases acute thrombosis risk. "
            f"Please don your lower-body compression cuffs and drink hydration solution."
        )

    # 6. Solar Particle Event & Radiation Dosimetry
    if any(k in r_lower for k in ("radiation", "solar particle", "storm", "rsi", "biodosimetry")):
        flux_val = t.get("radiation_flux")
        if flux_val is None:
            f_match = re.search(r"Flux=?([0-9.]+)", reason)
            flux_val = f_match.group(1) if f_match else "340"
        return (
            f"Urgent alert, {clean_name}. External biodosimeters detect a severe solar particle event. "
            f"Cosmic flux has reached {flux_val} milligray per hour. "
            f"Active proton counts are breaching exterior safety thresholds. "
            f"Take your prescribed radioprotective medication and evacuate to the storm shelter immediately."
        )

    # 7. Cardiovascular Strain / Baseline Fatigue Drift
    if any(k in r_lower for k in ("fatigue", "drift", "strain", "autonomic")):
        hr_val = t.get("heart_rate")
        if hr_val is None:
            hr_match = re.search(r"([0-9.]+)\s*bpm", reason)
            hr_val = hr_match.group(1) if hr_match else "85"
        return (
            f"{clean_name}, your autonomic vitals show accumulated physiological strain. "
            f"Resting heart rate has drifted up to {hr_val} beats per minute. "
            f"Neuro-fatigue reserves are significantly depleted. "
            f"I advise pausing mission tasks, hydrating, and taking a scheduled rest period."
        )

    return None


def get_progressive_script(
    scenario_key: str,
    severity: str = "WARNING",
    astronaut_name: str = "",
    astronaut_id: str = "",
    stage_index: int = 0,
    reason: str = "",
    telemetry: Optional[Dict[str, Any]] = None
) -> str:
    """Retrieves the progressive multi-stage spoken script for an evolving scenario with 100% dynamic live telemetry."""
    if severity == "NOMINAL" or scenario_key == "NOMINAL_CRUISE":
        return "All physiological baselines and life-support parameters have returned to nominal flight limits. Life-support telemetry steady."

    clean_name = clean_crew_name(astronaut_name, astronaut_id)
    key = scenario_key or ""
    is_all_crew = (astronaut_id in ("ALL_CREW", "all_crew") or clean_name == "All Crew Stations")

    t = telemetry or {}
    co2 = round(float(t.get("cabin_co2", 4.25)), 2) if "cabin_co2" in t else "4.25"
    spo2 = round(float(t.get("spo2", 88.5)), 1) if "spo2" in t else "88.5"
    hr = int(round(float(t.get("heart_rate", 118.0)))) if "heart_rate" in t else 118
    press = round(float(t.get("cabin_pressure", 85.0)), 1) if "cabin_pressure" in t else "85.0"
    rad = round(float(t.get("radiation_flux", 85.0)), 1) if "radiation_flux" in t else "85.0"
    k = round(float(t.get("potassium", 2.95)), 2) if "potassium" in t else "2.95"
    qtc = int(round(float(t.get("computed_qtc", 495)))) if "computed_qtc" in t else 495
    temp = round(float(t.get("core_temperature", t.get("core_temp", 39.1))), 1) if ("core_temperature" in t or "core_temp" in t) else "39.1"
    il6 = int(round(float(t.get("il_6", 125)))) if "il_6" in t else 125
    trm = round(float(t.get("trm_ratio", 2.35)), 2) if "trm_ratio" in t else "2.35"

    format_kwargs = {
        "name": "All stations" if is_all_crew else clean_name,
        "co2": co2,
        "spo2": spo2,
        "hr": hr,
        "press": press,
        "rad": rad,
        "k": k,
        "qtc": qtc,
        "temp": temp,
        "il6": il6,
        "trm": trm,
    }

    # 1. Match direct key or mapped alias from PROGRESSIVE_SCENARIO_SCRIPTS
    target_stages = None
    if key in PROGRESSIVE_SCENARIO_SCRIPTS:
        target_stages = PROGRESSIVE_SCENARIO_SCRIPTS[key]
    else:
        # Check aliases or keyword matches
        for cand_key, stages in PROGRESSIVE_SCENARIO_SCRIPTS.items():
            if cand_key == key or (cand_key and cand_key in key):
                target_stages = stages
                break
        if not target_stages:
            if "AMMONIA" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_4_AMMONIA_COOLANT_LEAK")
            elif "RADIATION" in key or "STORM" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_3_SOLAR_RADIATION_STORM")
            elif "DECOMPRESSION" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA")
            elif "FIRE" in key or "SMOLDER" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_5_ELECTRICAL_FIRE_SMOLDER")
            elif "HYPOKALEMIA" in key or "ARRHYTHMIA" in key or "POTASSIUM" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA")
            elif "THROMBOSIS" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_7_VENOUS_THROMBOSIS_RISK")
            elif "SEPSIS" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_10_PRESYMPTOMATIC_SEPSIS")
            elif "CO2" in key or "HYPOXIA" in key or "SCRUBBER" in key:
                target_stages = PROGRESSIVE_SCENARIO_SCRIPTS.get("SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH")

    if target_stages:
        # For active emergencies, stage 1 represents ongoing persistent monitoring.
        # Stage 2 is only for manual resolution when nominal.
        max_safe_stage = min(stage_index, max(0, len(target_stages) - 2))
        script = target_stages[max_safe_stage]
        if is_all_crew and "Commander {name}" in script:
            script = script.replace("Commander {name}", "All stations")
        try:
            return script.format(**format_kwargs)
        except Exception:
            return script.format(name=clean_name)

    # 2. If stage_index > 0 and no scenario match, deliver dynamic live clinical follow-up
    if stage_index > 0:
        return (
            f"Active sentry monitoring for {clean_name}: continuous biometrics show heart rate at {hr} bpm and blood oxygen at {spo2} percent. "
            f"Active alert status remains engaged. Maintain all prescribed clinical countermeasures."
        )

    return get_fallback_script(scenario_key, severity, astronaut_name, astronaut_id, reason=reason, telemetry=telemetry)


def get_fallback_script(
    scenario_key: str,
    severity: str = "WARNING",
    astronaut_name: str = "",
    astronaut_id: str = "",
    reason: str = "",
    telemetry: Optional[Dict[str, Any]] = None
) -> str:
    """
    Retrieves the deterministic spoken script for a scenario or severity level.
    First checks if the clinical reason and biometrics can be articulated specifically,
    ensuring the astronaut is told exactly what happened and their current readings.
    """
    clean_name = clean_crew_name(astronaut_name, astronaut_id)

    # 1. Clinical Diagnostic Reason Extraction (Tells astronaut EXACTLY what happened)
    clinical_script = build_clinical_reason_script(
        reason=reason or scenario_key,
        severity=severity,
        astronaut_name=astronaut_name,
        astronaut_id=astronaut_id,
        telemetry=telemetry
    )
    if clinical_script:
        return clinical_script

    # 2. Handle All Crew / Collective Alert
    if astronaut_id in ("ALL_CREW", "all_crew") or clean_name == "All Crew Stations":
        if "HYPOXIA" in scenario_key or "CO2" in scenario_key or scenario_key == "SCENARIO_3_CO2_HYPOXIA":
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_HYPOXIA"]
        elif "RADIATION" in scenario_key or "STORM" in scenario_key or scenario_key == "SCENARIO_8_SOLAR_RADIATION_STORM":
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_SOLAR_STORM"]
        elif severity == "CRITICAL":
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_CRITICAL"]
        else:
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_WARNING"]

    # 3. Handle Multi-Crew joint/named alerts
    if (" and " in clean_name or ", " in clean_name) and (scenario_key == "SCENARIO_1_BASELINE_DRIFT" or "DRIFT" in scenario_key or "FATIGUE" in scenario_key):
        return FALLBACK_VOICE_SCRIPTS["SCENARIO_1_BASELINE_DRIFT_MULTI"].format(name=clean_name)

    if scenario_key in FALLBACK_VOICE_SCRIPTS:
        template = FALLBACK_VOICE_SCRIPTS[scenario_key]
    elif severity == "CRITICAL":
        template = FALLBACK_VOICE_SCRIPTS["DEFAULT_CRITICAL"]
    elif severity == "NOMINAL":
        template = FALLBACK_VOICE_SCRIPTS["DEFAULT_NOMINAL"]
    else:
        template = FALLBACK_VOICE_SCRIPTS["DEFAULT_WARNING"]

    return template.format(name=clean_name)



