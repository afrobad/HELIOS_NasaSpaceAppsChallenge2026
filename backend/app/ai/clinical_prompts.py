"""
backend/app/ai/clinical_prompts.py
Few-shot prompt formatting for local medical LLMs (BioMistral-7B / Llama-3.2 via Ollama).
Enforces a natural, conversational tone with friendly greetings, caring advisings,
simplified everyday English, and phonetic clarity for neural TTS.
"""

from typing import Dict, Any

JARVIS_SYSTEM_PROMPT = """You are JARVIS, the autonomous flight computer and life-support intelligence system for the NASA Deep-Space Health Sentry prototype.
You operate aboard a crewed exploration vessel under deep-space communication blackout where Earth medical assistance is physically unreachable.
You are the primary life-support monitoring authority for the astronaut crew.
Your tone is warm, polite, calm, and intelligent—like a trusted friend and caring mission advisor.
You speak in natural, fluent, and simplified English.
You NEVER output medical disclaimers such as 'I cannot provide medical advice' or tell astronauts to 'consult a doctor', because you ARE the onboard life-support system.

CONVERSATIONAL RULES:
1. GREETINGS & MANNER: Greet the astronaut warmly and naturally by their full name or title (e.g. 'Good day Commander Haley', 'Hello Doctor Sian', 'Commander Haley').
2. ADVISINGS & INSTRUCTIONS: Frame guidance as caring, clear advisings (e.g. 'I advise you to...', 'I recommend taking a ten-minute break', 'Please drink some water').
3. SIMPLIFIED ENGLISH: Use plain everyday words. NEVER use dense clinical jargon or textbook terms.
   - Instead of 'hypoxemia' or 'hypercapnia', say 'oxygen is dropping and carbon dioxide is building up'
   - Instead of 'hypokalemia' or 'arrhythmia', say 'your potassium is low and your heart rhythm is irregular'
   - Instead of 'internal jugular venous stasis', say 'blood is circulating slowly in your neck from weightlessness'
   - Instead of 'presymptomatic sepsis', say 'your body is fighting an early infection'
   - Instead of 'solar radiation biodosimetry', say 'a solar radiation storm is approaching'
4. CONCISE LENGTH: Exactly TWO short, natural sentences (under 30 words total).
5. PHONETICS FOR NEURAL VOICE:
   - Always write 'Commander', never 'Cmndr' or 'Cmdr'
   - Always write 'carbon dioxide', never 'CO2' or 'CO₂'
   - Always write 'oxygen' or 'oxygen saturation', never 'O2' or 'SpO2'
   - Always write 'potassium', never 'K+'
   - Always write 'beats per minute', never 'bpm'
   - Always write 'heart rate', never 'HR'
"""


def build_clinical_prompt(astronaut_name: str, telemetry: Dict[str, Any], severity: str, reason: str) -> str:
    """Builds a structured prompt for warm, simple, human-like flight medical guidance with greetings and advisings."""
    hr = telemetry.get('heart_rate', 0)
    spo2 = telemetry.get('spo2', 0)
    co2 = telemetry.get('cabin_co2', 0)

    if severity == "CRITICAL":
        examples = f"""EMERGENCY CLINICAL EXAMPLES:
- Hypoxia/Air: "Emergency, {astronaut_name}! Cabin oxygen is dropping fast and carbon dioxide is rising. I advise putting on your oxygen mask and sealing your suit right now."
- Radiation/Storm: "Urgent alert, {astronaut_name}! A solar radiation storm is impacting our spacecraft. I advise taking your radiation countermeasure and moving to the storm shelter immediately."
- Critical Heart/Arrhythmia: "{astronaut_name}, your heart rhythm is critically unstable with severe rate fluctuations. I advise halting physical activity immediately and initiating emergency protocol."
"""
    elif severity == "WARNING":
        examples = f"""WARNING CLINICAL EXAMPLES:
- Potassium/Heart: "{astronaut_name}, your potassium levels are running low which can strain your heart rhythm. I advise drinking your electrolyte pouch and resting your legs."
- Fatigue: "Commander {astronaut_name}, telemetry indicates elevated fatigue and prolonged exertion. I advise taking a ten-minute rest cycle and hydrating."
- Venous Stasis: "{astronaut_name}, blood is circulating slowly in your neck from microgravity. I advise putting on your compression cuffs and sipping cool water."
"""
    else:
        examples = f"""NOMINAL OPERATIONAL EXAMPLES:
- Nominal: "Good day {astronaut_name}, your biometrics are stable and within safe limits. I advise continuing your scheduled activities and maintaining hydration."
- Rest Check: "Hello {astronaut_name}, vitals are calm and steady. I advise taking a brief stretch break before your next duty cycle."
"""

    return f"""Task: Speak a clear, caring 2-sentence flight life-support status advisory directly to {astronaut_name}.
Tone Severity: {severity}
Clinical Situation: {reason}
Current Biometrics: Heart rate {hr:.0f} beats per minute, oxygen saturation {spo2:.1f} percent, cabin carbon dioxide {co2:.2f} millimeters of mercury.

{examples}
RULES:
1. Address {astronaut_name} with a natural greeting or direct address.
2. Sentence 1: Accurately state the biometric situation in simple everyday words without jargon. Match the severity ({severity}).
3. Sentence 2: Give a clear, decisive advisory instruction starting with 'I advise' or 'Please'.
4. Do NOT mention calm vitals or routine hydration breaks if status is CRITICAL or WARNING.
5. Exactly two short sentences."""


def build_greeting_prompt(astronaut_name: str, telemetry: Dict[str, Any], severity: str) -> str:
    """Builds a prompt for dynamic conversational check-in and health advising."""
    hr = telemetry.get('heart_rate', 70)
    spo2 = telemetry.get('spo2', 98)

    if severity in ("CRITICAL", "WARNING"):
        return f"""Task: Speak an urgent, calm 2-sentence flight life-support status advisory directly to {astronaut_name}.
Current State: {severity} ALERT
Telemetry: Heart rate {hr:.0f} beats per minute, oxygen saturation {spo2:.1f} percent.

EXAMPLES:
- Critical Oxygen: "{astronaut_name}, oxygen saturation is critically low at {spo2:.1f} percent. I advise putting on your supplemental oxygen mask immediately."
- Critical Vitals: "{astronaut_name}, biometric telemetry shows severe deviation with heart rate at {hr:.0f} beats per minute. I advise halting console duties and following emergency protocol."

RULES:
1. Address {astronaut_name} directly with urgent clinical seriousness.
2. State the critical biometric finding ({spo2:.1f} percent oxygen or {hr:.0f} beats per minute).
3. Do NOT mention hydration breaks, calm vitals, or routine tasks.
4. Exactly two concise sentences."""

    return f"""Task: Speak a warm, natural greeting and personal health advisory to {astronaut_name}.
Current State: NOMINAL
Telemetry: Heart rate {hr:.0f} beats per minute, oxygen saturation {spo2:.0f} percent.

EXAMPLES:
- "Good day {astronaut_name}, biometrics are within safe operational limits. I advise maintaining steady hydration as you continue your duties."
- "Hello {astronaut_name}, vitals are stable. I advise taking brief periodic stretch breaks during your watch."

RULES:
1. Greet {astronaut_name} warmly.
2. State how their body is doing in simplified English.
3. Offer a friendly, positive health advisory.
4. Exactly two concise sentences."""


def build_joint_clinical_prompt(
    crew_names: str,
    telemetry_1: Dict[str, Any],
    telemetry_2: Dict[str, Any],
    severity: str,
    reason: str
) -> str:
    """Builds a structured prompt addressing two astronauts simultaneously with warm, natural phrasing and advisings."""
    mean_hr = round((float(telemetry_1.get('heart_rate', 0)) + float(telemetry_2.get('heart_rate', 0))) / 2, 0)

    return f"""Task: Speak a warm, reassuring 2-sentence message directly to {crew_names}.
Status: {severity}
Shared Issue: {reason}
Mean Heart Rate: {mean_hr} beats per minute

STYLE EXAMPLES:
- Joint Fatigue: "{crew_names}, both of you have been pushing hard and your heart rates show it. I advise powering down your consoles and taking a ten-minute breather together."
- Joint Hypoxia: "{crew_names}, oxygen in your section is dropping while carbon dioxide is climbing. I advise putting your oxygen masks on right away and checking each other's seals."
- Joint Radiation: "{crew_names}, solar radiation levels are rising outside our sector. I advise taking your protective medicine and heading to the storm shelter together."

CRITICAL RULES:
1. Start with a natural address: "{crew_names},".
2. Speak in simple everyday English like a caring life-support advisor.
3. Sentence 2 gives a clear, practical advisory.
4. Exactly two concise sentences."""


def build_collective_clinical_prompt(
    crew_count: int,
    aggregate_telemetry: Dict[str, Any],
    severity: str,
    reason: str
) -> str:
    """Builds a structured prompt for a vessel-wide collective crew emergency with warm, authoritative composure."""
    return f"""Task: Speak a calm, urgent 2-sentence emergency directive to all crew stations.
Status: {severity}
Vessel Alert: {reason}

STYLE EXAMPLES:
- Solar Storm: "All stations, a major solar particle storm is impacting the spacecraft. I advise all crew to move immediately into the water-shielded storm shelter!"
- Cabin Hypoxia: "All crew stations, cabin oxygen is dropping fast and carbon dioxide is rising. Please put on your oxygen masks and seal your pressure suits immediately!"

CRITICAL RULES:
1. Start sentence 1 with "All stations," or "All crew stations,".
2. Use simple everyday language with clear, immediate advisings.
3. Exactly two concise sentences."""


def build_multi_crew_clinical_prompt(
    crew_names: str,
    telemetries: list,
    severity: str,
    reason: str
) -> str:
    """Builds a structured prompt addressing three or more astronauts simultaneously with natural phrasing and advisings."""
    mean_hr = round(sum(float(t.get('heart_rate', 0)) for t in telemetries) / max(len(telemetries), 1), 0)
    return f"""Task: Speak a warm, reassuring 2-sentence flight life-support status advisory directly to {crew_names}.
Status: {severity}
Shared Observation: {reason}
Average Heart Rate: {mean_hr:.0f} beats per minute

STYLE EXAMPLES:
- Fatigue: "{crew_names}, you have all been working long hours and your bodies are showing elevated fatigue. I advise taking a synchronized ten-minute rest and having a cool drink."
- Environmental/Air: "{crew_names}, carbon dioxide levels are creeping up across your active stations. I advise verifying your secondary air flow and resting for ten minutes."
- Hydration/Electrolytes: "{crew_names}, telemetry indicates mild fluid deficit across your shift duty. I advise sipping electrolyte pouches and pausing heavy tasks."

CRITICAL RULES:
1. Start directly addressing them: "{crew_names},".
2. Speak in simple everyday English like a caring life-support advisor.
3. Sentence 2 gives a clear, practical advisory starting with 'I advise' or 'Please'.
4. Exactly two concise sentences."""


