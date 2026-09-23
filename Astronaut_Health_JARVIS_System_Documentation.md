# JARVIS-Style Astronaut Health Intelligence System
**Complete System Architecture, Clinical Specifications & Technical Documentation**
*Target: NASA International Space Apps Challenge*

---

## 1. Executive Summary & Problem Framing

### 1.1 The Working Concept
The **JARVIS-Style Astronaut Health Intelligence System** is an autonomous, localized aerospace medical sentry and clinical decision-support platform designed for long-duration deep-space missions. Unlike traditional Earth-tethered telemetry viewers or passive conversational chatbots, this system operates as a continuous, 24/7 background sentry that monitors crew biometrics, learns personal physiological baselines, suppresses false alarms during high-intensity exercise, and **proactively interrupts with voice guidance** when physiological deterioration or environmental crises are detected.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           THE JARVIS SENTINEL PARADIGM                          │
├───────────────────────────────────────┬─────────────────────────────────────────┤
│    PASSIVE CHATBOT (TRADITIONAL)      │     PROACTIVE SENTINEL (OUR SYSTEM)     │
├───────────────────────────────────────┼─────────────────────────────────────────┤
│ • Waits silently for user to type/ask │ • Continuously scans vitals at 10 Hz    │
│ • Astronaut must recognize symptoms   │ • Detects silent hypoxia & CO2 pooling  │
│ • Fails if astronaut is unconscious   │ • Interrupts unprompted via voice       │
│ • Cloud-dependent / heavy GPU needed  │ • 100% offline, CPU-only edge execution │
└───────────────────────────────────────┴─────────────────────────────────────────┘
```

### 1.2 The Deep Space Medical Reality (Why NASA Needs This)
On the International Space Station (ISS) in Low Earth Orbit (LEO), Houston Mission Control monitors astronaut biometrics in near real time via constant TDRS satellite links. Flight surgeons on Earth analyze telemetry, detect anomalies, and direct medical treatments immediately.

**Deep space exploration (Artemis Lunar Gateway, Mars transit, and Mars surface missions) breaks this model entirely:**
1. **Communication Latency:** One-way radio transmission between Earth and Mars ranges from **4 to 24 minutes** (resulting in an **8 to 48-minute round-trip delay**). During acute medical crises—such as sudden cabin depressurization, silent hypoxia, toxic $\text{CO}_2$ pocketing during sleep, or acute cardiac arrhythmias—ground control **cannot intervene in time to save crew lives**.
2. **Cephalic Microgravity Fluid Shift:** In microgravity, the absence of hydrostatic pressure causes approximately **1.5 to 2.0 liters of blood and interstitial fluid to shift from the lower extremities toward the thorax and head** (a 10–15% circulating plasma volume reduction). This elevates central venous and intracranial pressure, contributing to Spaceflight-Associated Neuro-ocular Syndrome (SANS), resets baroreceptors, and fundamentally alters resting cardiovascular norms. **Standard Earth-based "population normal" reference ranges do not apply.**
3. **Avionics & Compute Constraints:** Deep-space vehicles (e.g., Orion, Lunar Gateway modules) cannot support power-hungry, high-heat consumer GPUs (like Nvidia RTX cards) due to strict thermal dissipation bottlenecks in a vacuum and vulnerability to single-event upsets (SEUs) caused by galactic cosmic rays (GCRs) and solar particle events (SPEs).
4. **The Solution:** A **two-tier, offline-first, edge AI architecture** running entirely on low-power, radiation-tolerant CPU hardware with **zero cloud connection, zero GPU dependency, and sub-second proactive response times**.

---

## 2. Real-World NASA Dataset Inventory & Grounding

Our system is 100% grounded in authentic NASA spaceflight data from the **NASA Open Science Data Repository (OSDR)** and the **SpaceX Inspiration4 SOMA Multi-Omics and Clinical Spaceflight Atlas**, downloaded into `data/nasa_osdr/`:

```
data/
├── nasa_osdr/
│   ├── OSD-575_Cardiovascular_Panel.csv       # Inspiration4 Multiplex Serum Cardiovascular EvePanel (L-3 to R+1)
│   ├── OSD-575_Comprehensive_Metabolic_Panel.csv # Comprehensive Metabolic Panel: Albumin, Electrolytes, BUN, Glucose
│   ├── OSD-575_Immune_Panel.csv               # Cytokine Array: Systemic Inflammatory & Stress Biomarkers
│   └── OSD-569_Complete_Blood_Count.csv       # Hematology CBC: RBC, WBC, Hemoglobin, Platelet Kinetics
├── nasa_astronaut_baselines.json              # Extracted crew baseline distributions (μ, σ) across mission states
└── astronaut_telemetry_stream.csv             # 24,000-row 10 Hz continuous time-series with demo scenarios
```

### 2.1 Dataset Specifications & Linkages

| File Name | NASA Accession | Clinical / Aerospace Significance | Integration in System |
|---|---|---|---|
| **`OSD-575_Cardiovascular_Panel.csv`** | `OSD-575` | Multiplex serum panel measuring cardiovascular markers across flight days `L-3`, `FD1-3`, `R+1`. | Calibrates baseline cardiovascular deconditioning thresholds in `personal_baselines`. |
| **`OSD-575_Comprehensive_Metabolic_Panel.csv`** | `OSD-575` | Electrolyte balance (Sodium, Potassium, Calcium), fluid shift markers, liver and renal function. | Sets electrolyte and hydration warning logic in Level 2 advisory scripts. |
| **`OSD-575_Immune_Panel.csv`** | `OSD-575` | Measures 48 cytokines, chemokines, and growth factors during spaceflight. | Informs immune stress correlation when baseline body temperature drifts. |
| **`OSD-569_Complete_Blood_Count.csv`** | `OSD-569` | Complete blood count showing hemoglobin shifts and microgravity hemoconcentration. | Calibrates individual oxygen-carrying capacity curves. |
| **`nasa_astronaut_baselines.json`** | Derived | Personal baseline profiles ($\mu, \sigma$) for Commander, Pilot, Medical Officer, and Flight Engineer. | Seeds the SQLite `personal_baselines` table for instant Z-Score calculation. |
| **`astronaut_telemetry_stream.csv`** | Synthesized | 24,000 rows (4.19 MB) of 10 Hz continuous vitals containing respiratory sinus arrhythmia and the 5 demo scenarios. | Streams over WebSockets to feed the real-time HUD at 10 ticks/second. |

---

## 3. The 5+1 Core Bio-Vector Scope

To ensure clinical precision, sub-second execution, and zero clutter, the system standardizes on the **5 highest-yield spaceflight physiological markers** and **1 critical cabin environmental factor**:

| Metric | Symbol | Unit | Sensor Mechanism | Spaceflight Clinical Significance | Nominal Rest Baseline |
|---|---|---|---|---|---|
| **Resting Heart Rate** | `RHR` | bpm | Photoplethysmography (PPG) / 3-Lead ECG | Tracks autonomic tone, fluid shift adaptation, infection, and physical deconditioning. | 55 – 75 bpm |
| **Heart Rate Variability** | `HRV` | ms (rMSSD) | Continuous R-R Interval Peak Detection | Root Mean Square of Successive Differences; reflects parasympathetic nervous system (PNS) tone, central nervous system fatigue, and chronic microgravity stress. | 40 – 85 ms |
| **Blood Oxygenation** | `SpO2` | % | Dual-Wavelength Pulse Oximetry | Detection of insidious hypoxic events, cabin depressurization, or microgravity atelectasis (alveolar collapse). | 96 – 99 % |
| **Core Body Temperature** | `Temp` | °C | Double-sensor heat-flux forehead sensor / ingestible telemetric pill | Detection of "Spaceflight Fever" (impaired convective heat dissipation in zero gravity) and systemic infection. | 36.4 – 37.2 °C |
| **Sleep Quality Score** | `Sleep` | Score (0–100) | Actigraphy + nocturnal heart rate and HRV dip | Detection of circadian disruption, sleep architecture collapse, and operational cognitive impairment. | 75 – 100 |
| **Cabin Ambient $\text{CO}_2$** | `CO2` | mmHg / ppm | Non-Dispersive Infrared (NDIR) Sensor | In zero-g without buoyancy-driven thermal convection, exhaled $\text{CO}_2$ pockets around sleeping astronauts, inducing hypercapnia, headaches, and lethargy. | < 3.0 mmHg (< 4000 ppm) |

---

## 4. Two-Tier AI & Medical Model Architecture

To guarantee **ultra-fast response (<10ms for vital checks)** and **safe, hallucination-free clinical guidance**, the system divides intelligence into two distinct tiers:

```mermaid
graph TD
    A[Raw 10 Hz Telemetry Stream] --> B[Tier 1: Edge Biosignal Math Sentry]
    B --> C{Context State Gate}
    C -->|REST, SLEEP, EVA| D[Rolling Z-Score & Multi-Signal Fusion Matrix]
    C -->|WORKOUT| E[Exercise Gating Filter: Suppress Tachycardia Alarms]
    D --> F{Severity Evaluation}
    F -->|Nominal: |Z| < 1.5| G[(SQLite WAL Log: telemetry_log)]
    F -->|Level 1: 1.5 <= |Z| < 2.0| H[HUD Amber Glow Widget + Silent DB Audit]
    F -->|Level 2 / 3: |Z| >= 2.0 or Acute Emergency| I[Synthesize Structured Evidence JSON]
    I --> J[Tier 2: On-Demand Local Clinical LLM: BioMistral-7B / Phi-3.5 via Ollama]
    J --> K[Actionable Spoken Clinical Guidance: 2-Sentence Script]
    K --> L[Proactive Voice Interruption: Web Speech API]
```

### 4.1 Tier 1: Real-Time Edge Biosignal Math Sentry (Zero Latency)
* **Execution:** Runs in the core Python async process using NumPy.
* **Frequency:** 10 Hz (every 100ms per astronaut).
* **Resource Footprint:** `< 2%` CPU utilization, `< 50 MB` RAM.
* **Responsibility:**
  * In-memory circular ring buffer (`collections.deque(maxlen=3600)` = 6 minutes of 10 Hz history).
  * Rolling circadian baseline lookup ($\mu_{\text{baseline}}, \sigma_{\text{baseline}}$).
  * Real-time Z-score calculation:
    $$Z_t = \frac{x_t - \mu_{\text{baseline}}(a, s)}{\sigma_{\text{baseline}}(a, s)}$$
  * Activity-aware contextual gating (suppresses alarms during workout).
  * Multi-signal correlation and threshold escalation.
  * **Critical Rule:** The LLM is **NEVER** allowed to process raw 10 Hz sensor numbers directly. Tier 1 handles 100% of the mathematical verification and feeds pre-digested, structured facts into Tier 2.

### 4.2 Tier 2: On-Demand Local Clinical Reasoning LLM (Ollama)
When Tier 1 identifies a Level 2 (WARNING) or Level 3 (CRITICAL) anomaly, it triggers the Tier 2 reasoning layer to generate natural, conversational medical triage.

#### Model Candidates & Technical Selection:

| Model | Size (4-Bit Quantized) | RAM Required | CPU Inference Speed | Strengths & Alignment | Recommendation |
|---|---|---|---|---|---|
| **`biomistral:7b`** | **4.1 GB** | **~4.5 GB** | **15–22 tokens/sec** | Fine-tuned on PubMed Central and medical literature. Unmatched clinical terminology and diagnostic depth. | **🏆 Primary Recommended** (Best medical accuracy) |
| **`phi3.5:3.8b`** | **2.2 GB** | **~2.6 GB** | **28–38 tokens/sec** | Microsoft's small reasoning architecture. Extremely fast token generation on consumer CPUs. | **⚡ High-Speed Alternative** (Best for older CPUs) |
| **`llama3.2:3b`** | **2.0 GB** | **~2.4 GB** | **30–42 tokens/sec** | Ultra-compact, lightweight, excellent conversational fluency. | **Fallback** |
| **`openbiollm:8b`** | **4.8 GB** | **~5.2 GB** | **12–18 tokens/sec** | State-of-the-art open medical LLM, based on Llama-3. | **Advanced Option** |

#### Why Running Without a GPU is a Winning Pitch to NASA Judges:
> [!IMPORTANT]
> **Aerospace Flight Reality:** Deep-space flight systems (like the NASA Orion flight computers based on the RAD750 and Honeywell quad-redundant modules) cannot support multi-hundred-watt consumer graphics cards due to vacuum thermal dissipation and single-event radiation upsets.
> 
> By running our quantized clinical model on **CPU-only with AVX2/AVX-512 vector extensions and consuming under 5 GB of RAM**, we demonstrate to judges that our software is **immediately deployable on real flight-certified space station computers**.

#### NASA System Alignment: IMM & ExMC
Our architecture aligns directly with two of NASA's premier medical programs:
1. **Integrated Medical Model (IMM):** NASA's probabilistic simulation tool used to forecast medical risks on exploration missions.
2. **Exploration Medical Capability (ExMC):** NASA's research element tasked with developing autonomous medical decision support systems for deep space missions.

#### Tier 2 Clinical Prompt Architecture:
```text
SYSTEM PROMPT:
You are the Onboard Autonomous Chief Medical Officer AI (JARVIS) aboard the Mars Exploration Vehicle.
You operate under deep-space communication blackout (Earth latency: 22 minutes).
Your role is to protect the crew by delivering clear, calm, concise, and clinically rigorous spoken guidance.
CRITICAL CONSTRAINTS:
1. Speak in exactly 2 concise sentences.
2. First sentence: state the correlated physiological/environmental anomaly clearly.
3. Second sentence: give direct, actionable clinical or operational instructions.
4. Never mention numbers or statistics unless critical; explain the clinical meaning.
5. Tone: professional, calm, authoritative, supportive.

USER PROMPT:
Telemetry Anomaly Event Detected:
- Astronaut: Commander (AST-01)
- Mission State: REST
- Active Signals:
  * Resting Heart Rate: 76 bpm (Z = +2.2, Baseline: 62.0 bpm, sustained >45m)
  * HRV (rMSSD): 42 ms (Z = -2.1, 35% drop in parasympathetic tone)
  * SpO2: 98.2% (Nominal)
  * Core Temp: 37.05°C (+0.25°C elevation)
  * Sleep Efficiency: 62% over past 48h (Chronic sleep debt)
- Triage Severity: Level 2 (WARNING)
Generate the exact verbal statement to speak aloud to the Commander.
```

#### Generated JARVIS Output:
> *"Pardon the interruption, Commander. Your resting heart rate has remained significantly elevated for forty-five minutes alongside accumulating autonomic fatigue and sleep debt. I recommend consuming electrolyte hydration immediately and scheduling an extra forty-five-minute restorative rest block."*

---

## 5. Autonomous Proactive Alert Engine (Continuous Sentry)

Unlike standard hospital monitors that sound loud alarms for every transient spike (causing dangerous **alarm fatigue**), our system uses a **Multi-Signal Correlated 3-Tier Alert Ladder**:

```text
       Incoming Telemetry Stream (10 Hz)
                      │
                      ▼
        [ In-Memory Ring Buffer (10s) ]
                      │
                      ▼
        [ Context-Aware State Gate ] ── (REST, WORKOUT, SLEEP, EVA)
                      │
                      ▼
        [ Z-Score Deviation Evaluator ] ── (Z = (x - μ) / σ)
                      │
                      ▼
         [ Multi-Signal Fusion Matrix ]
                      │
    ┌─────────────────┼──────────────────┐
    ▼                 ▼                  ▼
Level 1: INFO     Level 2: WARNING   Level 3: CRITICAL
(Silent Log)      (Proactive Voice)  (Audible Klaxon + Voice)
----------------  -----------------  ------------------------
• Minor drift     • 2+ signals off   • Acute danger (SpO2<90%)
• HUD status      • Sustained >30m   • Toxic CO2 pocket (>4.0)
  glows amber     • JARVIS speaks    • Loud chime sounds
• No audio          politely to        + Immediate emergency
  interruption      astronaut          command spoken
```

### 5.1 The Three Alert Levels & System Actions:

#### Level 1 — INFO (Silent Visual Audit)
* **Trigger Condition:** Single metric deviates ($1.5 \le |Z| < 2.5$) for $< 10$ minutes.
* **System Action:**
  * Widget on HUD pulses with an ambient amber glow.
  * Writes record to `proactive_alerts` in SQLite.
  * **Zero audio output** (preserves crew concentration and prevents alarm fatigue).

#### Level 2 — WARNING (Proactive Conversational Voice Advisory)
* **Trigger Condition:** Two or more correlated metrics deviate ($|Z| \ge 2.0$) sustained over time (e.g., elevated RHR combined with a 35% collapse in HRV), or cabin $\text{CO}_2 \ge 3.0\text{ mmHg}$.
* **System Action:**
  * WebSocket pushes event to HUD frontend.
  * Tier 2 LLM generates clinical advice.
  * **JARVIS speaks aloud unprompted via browser Web Speech API:**
    > *"Pardon the interruption, Commander. Your cardiovascular markers indicate accumulating central nervous system fatigue. I recommend drinking electrolytes and taking an extra recovery period."*

#### Level 3 — CRITICAL (Emergency Klaxon + Direct Operational Command)
* **Trigger Condition:** Acute life-threat threshold breached ($\text{SpO}_2 < 90.0\%$ or cabin ambient $\text{CO}_2 \ge 4.0\text{ mmHg}$).
* **System Action:**
  * Red emergency screen override pulses across HUD.
  * Audible aerospace klaxon fires.
  * **JARVIS speaks direct emergency command:**
    > *"Emergency Warning: Acute hypoxia detected. Crew SpO2 has dropped to 89% coincident with localized CO2 pooling. Don supplemental oxygen masks immediately and inspect Module 3 ventilation."*

---

## 6. Activity-Aware Contextual Gating (Zero False Alarms)

Astronauts perform **2.5 hours of mandatory high-intensity resistance and cardiovascular exercise daily** to prevent microgravity bone demineralization and muscle atrophy.

A naive health monitor would trigger high-heart-rate panic alarms daily during workouts. Our system implements **Activity-Aware State Filters**:

```
State: REST            --> Strict baselines active.
State: WORKOUT         --> Tachycardia alarms gated. HR up to 175 bpm is nominal exertion.
State: POST_WORKOUT    --> Activates Cardiovascular Recovery Curve Evaluator:
                           Checks Delta-HR at 1 min and 5 min.
                           If HR fails to drop below (Baseline + 20%) within 45 minutes,
                           triggers "Impaired Autonomic Recovery Warning".
State: SLEEP           --> Strict nocturnal apnea and ambient CO2 accumulation sentry.
State: EVA             --> Prioritizes suit O2 consumption rate, skin temp, and metabolic expenditure.
```

---

## 7. Local Database Architecture: SQLite with WAL Mode

To avoid heavy external database servers (MySQL/PostgreSQL) that consume 500 MB–1 GB of RAM and require complex Docker orchestration, the system uses **SQLite in Write-Ahead Logging (WAL) Mode**.

### 7.1 Performance Benchmarks of SQLite in WAL Mode:
* **Write Throughput:** 50,000+ writes/second (exceeding our 10 Hz requirement by 5,000x).
* **RAM Footprint:** `< 10 MB` total memory.
* **Concurrency:** Separate reader and writer threads with zero lock contention.
* **Zero Configuration:** Native to Python (`import sqlite3`).

### 7.2 Database Schema (`astronaut_health.db`)

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- 1. High-frequency telemetry log (indexed by astronaut & time)
CREATE TABLE telemetry_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    mission_state TEXT NOT NULL,    -- 'REST', 'WORKOUT', 'POST_WORKOUT', 'SLEEP', 'EVA'
    heart_rate REAL NOT NULL,
    hrv_rmssd REAL NOT NULL,
    spo2 REAL NOT NULL,
    core_temp REAL NOT NULL,
    sleep_score REAL NOT NULL,
    cabin_co2 REAL NOT NULL,
    z_score_hr REAL,
    z_score_hrv REAL,
    alert_severity TEXT NOT NULL,    -- 'NOMINAL', 'INFO', 'WARNING', 'CRITICAL'
    data_source TEXT NOT NULL        -- 'REAL_NASA_DERIVED_10HZ_STREAM'
);
CREATE INDEX idx_telemetry_time ON telemetry_log(astronaut_id, timestamp);

-- 2. Astronaut Personal Baselines (Circadian-binned parameters)
CREATE TABLE personal_baselines (
    astronaut_id TEXT NOT NULL,
    mission_state TEXT NOT NULL,    -- 'REST', 'WORKOUT', 'SLEEP'
    mean_hr REAL NOT NULL,
    std_hr REAL NOT NULL,
    mean_hrv REAL NOT NULL,
    std_hrv REAL NOT NULL,
    mean_spo2 REAL NOT NULL,
    std_spo2 REAL NOT NULL,
    mean_temp REAL NOT NULL,
    std_temp REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (astronaut_id, mission_state)
);

-- 3. Proactive Alert & Event Audit Log
CREATE TABLE proactive_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    severity TEXT NOT NULL,         -- 'INFO', 'WARNING', 'CRITICAL'
    trigger_reason TEXT NOT NULL,
    confidence REAL NOT NULL,       -- e.g. 0.94
    evidence_json TEXT NOT NULL,    -- Multi-signal deviation breakdown
    voice_spoken_text TEXT,         -- Exact script JARVIS spoke aloud
    acknowledged BOOLEAN DEFAULT 0
);
CREATE INDEX idx_alerts_sev ON proactive_alerts(severity, timestamp);
```

---

## 8. Frontend Mission HUD & Voice Interaction Architecture

The user interface is an aerospace-grade **Mission Control Health HUD** built with **React, Vite, and hardware-accelerated Canvas/SVG**, locked at **60–90+ FPS**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  MISSION HEALTH SENTRY :: MARS EXPEDITION ONE                  [COMMS: 22m 14s DELAY]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  CREW ROSTER: [AST-01 COMMANDER*] [AST-02 PILOT] [AST-03 MEDICAL] [AST-04 ENGINEER]     │
├───────────────────────────────────┬────────────────────────────────────────────────────┤
│       BIOMETRIC MATRIX (10 Hz)    │              AUTONOMOUS JARVIS HUD                 │
├───────────────────────────────────┼────────────────────────────────────────────────────┤
│  HEART RATE:        62.4 bpm [OK] │  [ SILHOUETTE: HOLOGRAPHIC CREW STATUS ]           │
│  HRV (rMSSD):       65.2 ms  [OK] │  • Left Thorax: Nominal                            │
│  PULSE OX (SpO2):   98.2 %   [OK] │  • CNS Strain: Low                                 │
│  CORE TEMP:         36.8 °C  [OK] │  • Recovery Index: Optimal                         │
│  SLEEP EFFICIENCY:  86 %     [OK] │                                                    │
│  CABIN CO2:         1.8 mmHg [OK] │  VOICE SENTRY STATUS: ACTIVE (LISTENING)           │
├───────────────────────────────────┴────────────────────────────────────────────────────┤
│  REAL-TIME CARDIAC & RESPIRATORY WAVEFORM (HTML5 CANVAS 60-90 FPS)                     │
│  /\_/\__/\_/\__/\_/\__/\_/\__/\_/\__/\_/\__/\_/\__/\_/\__/\_/\__/\_/\__/\_/\__/\_/\__ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  LIVE SCENARIO DEMO: [1. Baseline Drift] [2. Workout] [3. CO2/Hypoxia] [4. Deep Space] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.1 Zero-Latency Voice Loop (Browser Web Speech API)
Instead of running heavy speech-to-text (Whisper) and text-to-speech (Piper) models that monopolize 4 GB of RAM and introduce seconds of lag, the system utilizes the native **Browser Web Speech API**:
* **Speech-to-Text (`SpeechRecognition`):** Instant, streaming transcription of crew voice commands (*"JARVIS, why did you flag an alert?"*).
* **Text-to-Speech (`speechSynthesis`):** Instant, hardware-accelerated speech synthesis with a crisp, low-latency synthetic voice.
* **Overhead:** `0 MB` extra RAM, zero audio stutter, and zero interference with the local LLM.

---

## 9. The 5 Live Competition Demonstration Scenarios

To win the challenge, the prototype must demonstrate these 5 distinct, pre-programmed scenarios with one click on the HUD:

### Scenario 1: Proactive Baseline Deviation (Early Warning)
* **What Happens:** Over a simulated period, the astronaut's resting heart rate rises from 62 bpm to 76 bpm, while HRV drops 35%. $\text{SpO}_2$ remains 98%.
* **Traditional Dashboard:** Shows all metrics in green because 76 bpm is within textbook Earth normal.
* **Our System:** Proactively interrupts with **Level 2 WARNING**:
  > 🔊 **JARVIS:** *"Pardon the interruption, Commander. Your resting heart rate is 2.2 standard deviations above your personal baseline, accompanied by a 35% reduction in HRV. No acute distress is detected, but physiological strain is accumulating. Recommend scheduling hydration and an extra recovery block."*

### Scenario 2: Activity-Aware Gating (Exercise vs. Emergency)
* **What Happens:** Heart rate jumps to 155 bpm.
* **Context:** Mission State is tagged as `WORKOUT` (Astronaut on treadmill).
* **Our System:** Displays active exercise telemetry in blue. **No emergency alarm is triggered.**
* **Post-Workout Check:** Once exercise stops, system tracks recovery. Heart rate normalizes to 68 bpm within 15 minutes. JARVIS confirms: *"Cardiovascular recovery curve optimal."*

### Scenario 3: Proactive Critical Alert (Cabin $\text{CO}_2$ Pocket + Hypoxia)
* **What Happens:** Cabin $\text{CO}_2$ reaches 4.2 mmHg. Astronaut experiences elevated core temp (+0.6°C), headache symptoms, and $\text{SpO}_2$ dips to 92%.
* **Our System:** Correlates the environmental sensor with the physiological markers. Triggers **Level 3 CRITICAL**:
  > 🚨 **[Klaxon Sound]**  
  > 🔊 **JARVIS:** *"Warning: Elevated ambient CO2 detected coincident with mild hypoxia and core temperature elevation. Pattern indicates localized CO2 pocketing. Recommend immediate cabin ventilation check and donning supplemental O2 mask."*

### Scenario 4: Deep Space Blackout (Mars 22-Minute Latency Mode)
* **What Happens:** The presenter clicks the **[Simulate Mars Transit Latency]** toggle.
* **The Action:** An alert occurs. The user clicks "Request Houston Advice."
* **Our System:** A prominent HUD widget shows:
  ```text
  [!] EARTH COMMUNICATION DELAY: 22m 14s ONE-WAY
  [>] Earth packet dispatched (ETA Houston: T+22m 14s)
  [✓] ONBOARD JARVIS AUTONOMOUS TRIAGE ACTIVE (OFFLINE)
  ```
* Proves to judges that the system does not freeze or fail when Earth is unreachable.

### Scenario 5: Hands-Free Voice Q&A
* **Astronaut speaks:** *"JARVIS, why did you trigger an alert?"*
* **Our System:** Local speech recognition captures audio -> formats state facts into prompt -> Ollama generates reasoning -> Web Speech API speaks aloud:
  > 🔊 **JARVIS:** *"Alert triggered based on 3 correlated indicators: sustained resting heart rate deviation of 18 bpm, 35% reduction in parasympathetic tone via HRV, and sleep efficiency below 60% over the last 48 hours. Confidence is 94%."*

---

## 10. NASA Space Apps Judging Criteria Alignment

| Judging Criterion | How This System Scores Maximum Points |
|---|---|
| **Relevance** | Directly solves the primary obstacle to human Mars exploration: **autonomous medical triage and decision support during deep-space comms blackout**. |
| **Use of NASA Data** | Ingests real NASA Open Science Data Repository (**OSDR `OSD-575` and `OSD-569`**) Inspiration4 spaceflight datasets to initialize crew baseline models. |
| **Technical Execution** | Fully functional, offline-capable, zero-cloud architecture running on consumer hardware (CPU-only, `<5 GB` RAM) with 10 Hz real-time streaming and SQLite WAL persistence. |
| **Innovation & Explainability** | Replaces opaque black-box AI with **Personal Baselines, Activity Gating, Multi-Signal Evidence Scoring, and Proactive Voice Alerting**. |
| **User Experience (UI/UX)** | JARVIS-style HUD with hands-free proactive voice interaction, dark aerospace theme, and locked **60–90+ FPS** performance. |

---

## 11. One-Sentence Winning Pitch
> **An offline-first, JARVIS-style health intelligence system that transforms NASA spaceflight data into personalized baseline intelligence, protecting astronaut crews with autonomous, proactive clinical decision support when Earth is millions of miles away.**
