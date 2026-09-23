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
        "Commander {name}, cabin carbon dioxide is rising. I advise switching to the backup air scrubber and checking airflow.",
        "Air update, {name}: scrubber bypass is engaged and cabin air quality is stabilizing. Please continue monitoring the atmospheric gauges.",
        "Atmospheric report, {name}: carbon dioxide has returned to safe levels. You may return the life-support loop to standard cruise mode."
    ],
    "SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA": [
        "Emergency, {name}! Cabin pressure is falling and oxygen levels are dropping. Please put on your oxygen mask and seal the bulkheads immediately!",
        "Pressure update, {name}: emergency oxygen flow is confirmed at ninety-five percent. I advise verifying compartment hatch seals.",
        "Life-support report, {name}: cabin pressure has stabilized. Please remain on supplemental oxygen until the hull patch is inspected."
    ],
    "SCENARIO_3_SOLAR_RADIATION_STORM": [
        "Urgent alert, {name}! A solar particle storm is approaching our spacecraft. I advise taking your radiation medication and heading to the storm shelter right now!",
        "Radiation update, {name}: particle flux has reached peak storm intensity. Please remain securely inside the water-shielded storm shelter.",
        "Dosimetry check, {name}: radiation counters indicate the solar storm is subsiding. Stand by for the all-clear before exiting the shelter."
    ],
    "SCENARIO_4_AMMONIA_COOLANT_LEAK": [
        "Emergency, {name}! Toxic chemical coolant has entered the cabin air. Please put on your full face mask and evacuate to the safe module!",
        "Chemical warning, {name}: ventilation scrubber purge cycle is running at maximum power. Please keep your respirator sealed.",
        "Module report, {name}: chemical levels have dropped below toxic detection limits. Air scrubbers are operating normally."
    ],
    "SCENARIO_5_ELECTRICAL_FIRE_SMOLDER": [
        "Caution, {name}. Sensors detect smoldering wiring behind the avionics panel. I advise cutting power to that bus and inspecting with a fire extinguisher.",
        "Thermal update, {name}: electrical circuit breaker has tripped and panel temperatures are cooling. Please verify with the thermal camera.",
        "Avionics check, {name}: smoke particulate has cleared from the avionics bay. Power can be routed through the auxiliary inverter."
    ],
    "SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA": [
        "Hello {name}. Your potassium levels are running low, which can cause muscle cramps and heart flutter. I advise drinking your potassium electrolyte pouch and resting.",
        "Heart check, {name}: your heart rhythm is responding well to the electrolyte drink. I advise resting comfortably for another fifteen minutes.",
        "Rhythm update, {name}: potassium levels and heart timing have normalized. You are clear to resume routine light duties."
    ],
    "SCENARIO_7_VENOUS_THROMBOSIS_RISK": [
        "Hello {name}. Blood is moving slowly in your neck veins from weightlessness. I advise putting on your compression cuffs and drinking some water to help circulation.",
        "Circulation update, {name}: venous outflow velocity is improving. I advise doing gentle neck and shoulder stretches.",
        "Vascular check, {name}: blood flow has smoothed out nicely. Please remember to drink water regularly throughout your shift."
    ],
    "SCENARIO_8_CARDIOVASCULAR_DECONDITIONING": [
        "{name}, your heart is working harder to pump blood today. I advise doing thirty minutes on the cycle ergometer and having a salt hydration drink.",
        "Conditioning check, {name}: your vascular tone is improving with exercise. Keep a steady pedaling pace for the remainder of the session.",
        "Recovery report, {name}: post-workout recovery is smooth and heart rate is returning to baseline. Excellent job."
    ],
    "SCENARIO_9_CORONARY_MICROVASCULAR_STRESS": [
        "{name}, your heart blood vessels are showing signs of stress and inflammation. I advise taking one chewable baby aspirin and resting while we monitor your ECG.",
        "Cardiovascular update, {name}: heart muscle stress markers are calming and your ECG rhythm is steady. Continue resting in your bunk.",
        "Medical status, {name}: vascular stress indicators have subsided to nominal range. Please avoid high-intensity workouts today."
    ],
    "SCENARIO_10_PRESYMPTOMATIC_SEPSIS": [
        "{name}, your immune system is working hard to fight off an infection before you feel sick. I advise resting in your quarters and starting an intravenous hydration bag.",
        "Immune update, {name}: your white blood cells are mobilizing well. I advise taking your prescribed antibiotic dose as scheduled.",
        "Recovery check, {name}: inflammatory markers are trending downward. Your body is successfully clearing the infection."
    ],
    "SCENARIO_11_LATENT_VIRUS_REACTIVATION": [
        "{name}, your immune markers show an old dormant virus is waking up inside your nerve pathways. I advise taking your antiviral tablets and resting.",
        "Immune check, {name}: antiviral medication has halted viral replication. Please ensure you get a full eight hours of undisturbed sleep.",
        "Nerve status, {name}: cellular immune scores have stabilized and viral activity is suppressed. Looking much better."
    ],
    "SCENARIO_12_CYTOKINE_RELEASE_STORM": [
        "Warning, {name}. Your body's immune chemicals are spiking into an over-reactive inflammatory storm. I advise taking your anti-inflammatory medication immediately.",
        "Inflammation update, {name}: cytokine levels are beginning to decline. Please remain reclined with cool ventilation active.",
        "Immune report, {name}: hyper-inflammatory markers have successfully normalized. Your immune system is back under control."
    ],
    "SCENARIO_13_RADIATION_MARROW_EXHAUSTION": [
        "{name}, prolonged cosmic radiation has depleted your white blood cell factory. I advise an injection of white-cell booster medication and staying in the clean room.",
        "Marrow update, {name}: bone marrow stimulation is underway and blood cell counts are beginning to recover. Continue sterile precautions.",
        "Hematology check, {name}: white blood cell production has rebounded to safe levels. Immune defense is restored."
    ],
    "SCENARIO_14_NEPHROLITHIASIS": [
        "{name}, your bone calcium is crystallizing in your kidneys and could form a painful stone. I advise drinking extra water today and taking a potassium citrate packet.",
        "Renal update, {name}: increased hydration is actively flushing your renal tract. Please drink another half liter of water.",
        "Kidney check, {name}: calcium crystallization has cleared from your kidneys. Great job staying on top of your hydration."
    ],
    "SCENARIO_15_INTRAVASCULAR_DEHYDRATION": [
        "{name}, your fluid levels are low and your blood is becoming concentrated. I advise drinking two electrolyte recovery packs and resting from heavy duties.",
        "Hydration update, {name}: blood volume is replenishing and your pulse is relaxing. Finish your second electrolyte flask.",
        "Vascular check, {name}: hydration levels and blood thickness have fully returned to green status."
    ],
    "SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION": [
        "{name}, your liver is processing medication more slowly in zero gravity today. I advise reducing your medication dose by half to avoid accidental buildup.",
        "Liver update, {name}: metabolic clearance rate has stabilized. Continue with the adjusted medication schedule.",
        "Metabolism report, {name}: liver enzymes have settled into steady range. Medication clearance is functioning normally."
    ],
    "SCENARIO_17_SPACE_VISION_SANS": [
        "{name}, fluid pressure is building up behind your eyes from weightlessness. I advise using the lower-body negative pressure suit for two hours to draw fluid back down.",
        "Vision check, {name}: negative pressure treatment is successfully redistributing fluids toward your lower body. Visual acuity is protected.",
        "Ocular report, {name}: optic nerve sheath pressure has normalized. Treatment session is complete."
    ],
    "SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT": [
        "{name}, you have been working long hours and your body clock is out of rhythm. I advise turning on the blue light therapy lamp and taking a brief rest.",
        "Circadian check, {name}: light therapy is helping synchronize your alertness rhythm. Take a ten-minute break from the console.",
        "Fatigue update, {name}: resting autonomic scores have stabilized. Your alertness and focus are restored."
    ],

    # Aliases
    "SCENARIO_3_CO2_HYPOXIA": [
        "All stations, emergency alert! Cabin oxygen is dropping fast and carbon dioxide is rising. I advise all crew to put on your oxygen masks and seal your suits immediately!",
        "Telemetry update for {name}: cabin oxygen is stabilizing at ninety-two percent. I advise verifying regulator pressure seals and checking your secondary oxygen supply.",
        "Medical sentry advisory for {name}: oxygen flow is confirmed active across all stations. Please maintain measured respirations while environmental scrubbers complete the purge cycle."
    ],
    "ALL_CREW_HYPOXIA": [
        "All stations, emergency alert! Cabin oxygen is dropping fast and carbon dioxide is rising. I advise all crew to put on your oxygen masks and seal your suits immediately!",
        "Telemetry update across crew stations: cabin oxygen is stabilizing at ninety-two percent. I advise verifying regulator pressure seals and checking your secondary oxygen supply.",
        "Medical sentry advisory across all stations: oxygen flow is confirmed active. Please maintain measured respirations while environmental scrubbers complete the purge cycle."
    ],
    "SCENARIO_1_BASELINE_DRIFT": [
        "{name}, you have been working long hours and your body is getting tired. I advise taking a ten-minute rest and having a cool drink.",
        "Follow-up observation, {name}: your heart rate variability indicates continued autonomic strain. I advise reclining in your sleep quarters and completing a brief neuro-fatigue reset.",
        "Station status update, {name}: rest cycle telemetry is beginning to stabilize. I advise remaining off-duty until baseline autonomic scores fully normalize."
    ],
    "SCENARIO_5_PRESYMPTOMATIC_SEPSIS": [
        "{name}, your immune system is working hard to fight off an infection before you feel sick. I advise resting in your quarters and starting an intravenous hydration bag.",
        "Telemetry update, {name}: inflammatory biomarkers are elevated with core temperature shifting upward. I advise administering the broad-spectrum antimicrobial pouch now.",
        "Medical sentry protocol, {name}: intravenous hydration infusion is ongoing. Please remain horizontal in your bunk while the automated diagnostics track your cellular response."
    ],
    "SCENARIO_8_SOLAR_RADIATION_STORM": [
        "Urgent alert, {name}! A solar particle storm is approaching our spacecraft. I advise taking your radiation medication and heading to the storm shelter right now!",
        "Radiation dosimetry update, {name}: external proton flux has reached peak storm intensity. I advise remaining firmly inside the storm shelter core behind the water shielding.",
        "Storm telemetry check, {name}: active radiation counters indicate secondary shielding is holding securely. I advise remaining sheltered until ground sensors confirm the particle wave has passed."
    ]
}


def get_progressive_script(
    scenario_key: str,
    severity: str = "WARNING",
    astronaut_name: str = "",
    astronaut_id: str = "",
    stage_index: int = 0
) -> str:
    """Retrieves the progressive multi-stage spoken script for an evolving scenario."""
    clean_name = clean_crew_name(astronaut_name, astronaut_id)
    key = scenario_key or ""
    if "HYPOXIA" in key or "CO2" in key:
        key = "ALL_CREW_HYPOXIA" if (astronaut_id in ("ALL_CREW", "all_crew") or clean_name == "All Crew Stations") else "SCENARIO_3_CO2_HYPOXIA"
    elif "RADIATION" in key or "STORM" in key:
        key = "SCENARIO_8_SOLAR_RADIATION_STORM"
    elif (astronaut_id in ("ALL_CREW", "all_crew") or clean_name == "All Crew Stations") and key not in ("ALL_CREW_HYPOXIA", "SCENARIO_3_CO2_HYPOXIA", "SCENARIO_8_SOLAR_RADIATION_STORM"):
        return get_fallback_script("ALL_CREW_WARNING", severity, astronaut_name, astronaut_id)

    stages = PROGRESSIVE_SCENARIO_SCRIPTS.get(key)
    if stages:
        script = stages[stage_index % len(stages)]
        return script.format(name=clean_name)

    return get_fallback_script(scenario_key, severity, astronaut_name, astronaut_id)


def get_fallback_script(
    scenario_key: str,
    severity: str = "WARNING",
    astronaut_name: str = "",
    astronaut_id: str = ""
) -> str:
    """Retrieves the deterministic spoken script for a scenario or severity level, formatted with the astronaut's name."""
    clean_name = clean_crew_name(astronaut_name, astronaut_id)

    # Handle All Crew / Collective Alert
    if astronaut_id in ("ALL_CREW", "all_crew") or clean_name == "All Crew Stations":
        if "HYPOXIA" in scenario_key or "CO2" in scenario_key or scenario_key == "SCENARIO_3_CO2_HYPOXIA":
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_HYPOXIA"]
        elif "RADIATION" in scenario_key or "STORM" in scenario_key or scenario_key == "SCENARIO_8_SOLAR_RADIATION_STORM":
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_SOLAR_STORM"]
        elif severity == "CRITICAL":
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_CRITICAL"]
        else:
            return FALLBACK_VOICE_SCRIPTS["ALL_CREW_WARNING"]

    # Handle Multi-Crew joint/named alerts
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


