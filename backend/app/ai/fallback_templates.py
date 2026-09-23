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
        "{name}, your immune system is working hard to fight off an infection.Before you feel sick, I advise resting in your quarters and starting an intravenous hydration bag."
    ),
    "SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA": (
        "{name}, your potassium levels are running low, which can cause muscle cramps and heart flutter. I advise drinking your potassium electrolyte pouch and resting."
    ),
    "SCENARIO_7_VENOUS_THROMBOSIS_RISK": (
        "{name}, blood is moving slowly in your neck veins from weightlessness. I advise putting on your compression cuffs and drinking some water to help circulation."
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
    "SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA": [
        "{name}, your potassium levels are running low, which can cause muscle cramps and heart flutter. I advise drinking your potassium electrolyte pouch and resting.",
        "Cardiovascular update, {name}: cardiac repolarization interval remains slightly prolonged. I advise finishing your electrolyte solution and avoiding sudden physical maneuvers.",
        "Rhythm stabilization check, {name}: heart rate variability is recovering toward baseline limits. I advise resting for another fifteen minutes before resuming console watch."
    ],
    "SCENARIO_7_VENOUS_THROMBOSIS_RISK": [
        "{name}, blood is moving slowly in your neck veins from weightlessness. I advise putting on your compression cuffs and drinking some water to help circulation.",
        "Hemodynamic update, {name}: ultrasound telemetry detects sluggish jugular outflow. I advise tightening the lower-body compression garments and performing gentle neck flexions.",
        "Circulatory sentry check, {name}: venous flow velocity is improving across the cephalic vessels. I advise maintaining steady hydration as microgravity fluid distribution stabilizes."
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


