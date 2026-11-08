<div align="center">

# H.E.L.I.O.S.
### Health Evaluation Logistic Intelligent Onboard System
**NASA International Space Apps Challenge 2026**

[![NASA Space Apps 2026](https://img.shields.io/badge/NASA_Space_Apps-2026-blue.svg?style=for-the-badge&logo=nasa)](https://www.spaceappschallenge.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

*An autonomous, offline-first astronaut biometric evaluation, clinical triage, and decision-support platform engineered for deep-space exploration and planetary transit.*

---

[Quick Start](#quick-start) • [The Challenge](#the-challenge) • [Helix-Ai Analyst](#helix-ai-analyst) • [Key Subsystems](#key-subsystems--features) • [NASA OSDR Grounding](#nasa-osdr-data-grounding) • [System Architecture](#system-architecture) • [License](#license--nasa-space-apps-notice)

---

</div>

<a id="the-challenge"></a>

## <img src="assets/icons/crosshair.svg" width="22" height="22" align="center"> &nbsp; The Deep-Space Challenge

During deep-space exploratory voyages — such as the Artemis Moon-to-Mars missions — astronauts travel millions of kilometers away from Earth. Under these conditions:

1. **Light-Speed Communication Delays**: Radio transmissions between Mars and Earth suffer from **4 to 24 minutes of one-way latency** (8 to 48 minutes round-trip), making real-time telemedicine from Earth flight surgeons physically impossible.
2. **Microgravity Physiological Hazards**: Prolonged zero-gravity exposure causes spaceflight-associated neuro-ocular syndrome (SANS), cardiovascular deconditioning, bone mineral loss, muscle atrophy, radiation damage, and hypercapnia/hypoxia from cabin life support fluctuations.
3. **Absence of Specialized Clinical Personnel**: Not every deep-space crew can include a specialized medical surgeon. The crew requires an **autonomous, on-board AI clinical partner** that runs locally, processes 10 Hz continuous biometric feeds, detects presymptomatic anomalies, and formulates prioritized clinical countermeasures with zero latency.

---

<a id="the-helios-solution"></a>

## <img src="assets/icons/brain.svg" width="22" height="22" align="center"> &nbsp; The HELIOS Solution

**H.E.L.I.O.S.** (Health Evaluation Logistic Intelligent Onboard System) acts as an autonomous digital medical officer. Powered by the on-board **Helix-Ai Analyst**, it processes real-time multimodal sensor streams, compares them against crew-specific NASA OSDR baseline distributions, renders real-time 3D anatomical twins, and speaks actionable clinical guidance directly into crew headsets and suit visors.

---

<a id="key-subsystems--features"></a>

## <img src="assets/icons/layers.svg" width="22" height="22" align="center"> &nbsp; Key Subsystems & Features

### 1. Unified Spacecraft Flight Command Deck (`Dashboard`)
- **10 Hz Real-Time Biometric Stream**: Continuously monitors heart rate, SpO₂, core body temperature, heart rate variability (HRV RMSSD), blood pressure, and cabin life-support telemetry.
- **Hardware-Decoupled 90 FPS Waveform Engine**: Smooth, clinically accurate Lead II ECG and SpO₂ plethysmograph waveforms rendered in real time.
- **ECLSS Life Support Bar**: Active monitors for cabin pressure (101.3 kPa), O₂ fraction (20.9%), cabin CO₂ (1.82 mmHg), cabin temperature, and radiation flux.
- **Crew Manifest & Triage Sentry**: Live status cards for all 4 crew members (Commander Haley, Pilot Chris, Dr. Sian, Specialist Leo) with instant clinical severity indicators.

### 2. Beautiful "SOLVED // ALL NOMINAL" Situation Normalization
- When an emergency scenario is active (e.g., CO₂ scrubber breakthrough, cabin depressurization, solar particle storm), a prominent **SOLVED** action button appears directly on the emergency directive banner.
- **One-Click Normalization**: Clicking **SOLVED** immediately resets all 4 crew members' vital signs to nominal flight baseline, sanitizes in-flight packets, silences klaxons, triggers a harmonic nominal chime, and broadcasts speech confirmation across all views and open windows.

### 3. Interactive 3D Holographic Bio-Twin (`3D Scanner`)
- **3D Anatomical Wireframe Scanner**: Rotatable 360° holographic mannequin with Cyan Bio-Holo, Thermal IR Heatmap, and Amber Tactical HUD modes.
- **Organ Telemetry Inspector**: Interactive clickable anatomical subsystems (Ocular, Brain, Cardiac, Lungs, Kidneys/Renal, Skeletal) with dynamic multi-frequency SVG waveforms and deep clinical readouts.

### 4. First-Person Astronaut Helmet Visor (`Suit HUD`)
- **Immersive Optical Helmet HUD**: Simulates astronaut helmet curvature, edge vignetting, visor glare, and dynamic environmental frost/smoke effects.
- **Planetary Surface Backdrops**: Real-time switchable perspectives across Mars Surface, Lunar Artemis Base, and ISS Exterior Spacewalk.
- **Tactical Waypoint Navigation**: Meter-accurate directional guidance targeting station modules and airlocks with live bearing angles.
- **Head-Tracking Parallax**: Dynamic camera shift responding to cursor motion for true zero-g immersion.

### 5. 3D ISS Orbital Flight Deck (`ISS Deck`)
- **Walkthrough Station Navigation**: Seamless transition between 10 station waypoints (Corridor, Biometrics Console, Cargo Bay, Mission Control Starboard, Navigation, Cupola, Aft, Airlock).
- **Interactive Bulkhead Monitors**: Bulkhead terminals rendering real-time crew vitals and orbital velocity coordinates ($27,600\text{ km/h}$ at $408\text{ km}$ altitude over Earth).
- **Snapshot Capture**: On-demand viewport screenshot tool with flash effect and downloadable high-res capture.

### 6. Earth Mission Control Center Ground Console (`Earth MCC`)
- **Physical Propagation Delay Engine**: Simulates authentic communication delays based on orbital distance (LEO 0.0s, Lunar Gateway 1.3s, Mars Closest 4.3m, Mars Conjunction 21.0m).
- **Flight Surgeon Telemetry Workstation**: Ground station console mirroring spacecraft downlink telemetry, historical trends, and remote advisories.

### 7. Mission Routine & Psychomotor Vigilance Drill (`Routine`)
- **Real-Time Dynamic Schedule**: Routine activities (countermeasure workouts, fluid balance logging, cognitive checks) update dynamically with live astronaut physiological data.
- **Interactive PVT Reaction Drill**: Validated Psychomotor Vigilance Task measuring microsecond reaction times to assess crew fatigue.
- **Exercise & Hydration Simulators**: Interactive treadmill/ARED resistive workout simulation and daily fluid intake logging.

### 8. Automated 3-Minute Interactive Tour (`3-Min Tour`)
- Top menubar features an eye-catching, luminous **3-Min Tour** button with a cosmic jewel gradient, golden sparkle icon, and animated aura pulse.
- Fully automated walkthrough choreographing cameras, views, and narration across the entire platform.

---

<a id="helix-ai-analyst"></a>

## <img src="assets/icons/activity.svg" width="22" height="22" align="center"> &nbsp; Helix-Ai Analyst

The **Helix-Ai Analyst** is the autonomous clinical engine embedded into HELIOS:

- **Local Offline Inference**: Runs via lightweight local models (Ollama / Llama-3.2) or deterministic zero-dependency fallback trees with sub-second response times.
- **Spoken Clinical Directives**: Synthesizes natural English directives with medical prosody and authentic Quindar radio tones.
- **Dynamic Consultation Console**: Crew can consult the AI analyst at any time using the natural language interface at the bottom of the flight deck.

---

<a id="nasa-osdr-data-grounding"></a>

## <img src="assets/icons/book-open.svg" width="22" height="22" align="center"> &nbsp; NASA OSDR Data Grounding

HELIOS grounds all baseline thresholds, biomarker ranges, and clinical indices in genuine NASA scientific datasets:

| Dataset / Standard | Description | Clinical Application in HELIOS |
|:---|:---|:---|
| **NASA OSDR OSD-575** | SpaceX Inspiration4 SOMA Crew Profile | Baseline reference for cytokine panels, serum potassium, and hematocrit |
| **NASA OSDR OSD-569** | Space Omics & Longitudinal Epigenomics | Microgravity fluid shift and endothelial inflammatory markers |
| **NASA-STD-3001** | Space Flight Human-System Standard | Vol 1 (Crew Health) & Vol 2 (Habitability, ECLSS thresholds) |
| **NASA HRP Protocols** | Human Research Program Risk Matrix | SANS ocular ICP metrics, radiation dose limits, circadian fatigue baselines |

---

<a id="system-architecture"></a>

## <img src="assets/icons/orbit.svg" width="22" height="22" align="center"> &nbsp; System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HELIOS FLIGHT SYSTEM INTERFACE                        │
│   Dashboard  ·  Telemetry  ·  Self-Check  ·  Routine  ·  MCC  ·  Suit HUD   │
│                   ISS Deck  ·  3D Scanner  ·  3-Min Tour                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                      WebSocket (10 Hz) & REST API
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            FASTAPI AEROSPACE CORE                           │
│  ├── TelemetryFeeder        10 Hz telemetry playback from NASA OSDR data    │
│  ├── SentryMatrixEngine     Evaluates baselines, z-scores & anomaly triggers│
│  ├── BaselineManager        Maintains crew circadian profiles & thresholds  │
│  ├── Helix-Ai Analyst       Generates speech directives & triage decisions  │
│  ├── RadioPropagationDelay  Simulates speed-of-light deep space latency     │
│  └── SQLite WAL Database    High-throughput local event & biomarker logging │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

<a id="quick-start"></a>

## <img src="assets/icons/terminal.svg" width="22" height="22" align="center"> &nbsp; Quick Start & Deployment

### Prerequisites
- **Python**: 3.11 or newer
- **Node.js**: 18.0 or newer
- **Git**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/zihaduzzamaan/H.E.L.I.O.S.git
cd H.E.L.I.O.S

# 2. Setup and activate Python virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Install frontend dependencies
cd frontend
npm install
cd ..
```

### Running the System

**Terminal 1 — Aerospace Backend Core:**
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Flight Command Interface:**
```bash
cd frontend
npm run dev
```

Open your browser at **`http://localhost:3000`** to experience the full flight command deck.

---

<a id="project-structure"></a>

## <img src="assets/icons/folder.svg" width="22" height="22" align="center"> &nbsp; Project Repository Structure

```text
├── backend/
│   └── app/
│       ├── main.py              # FastAPI REST endpoints & 10 Hz WebSocket server
│       ├── ai/                  # Helix-Ai Analyst inference, voice & fallback logic
│       ├── core/                # NASA OSDR biomarkers, baselines & anomaly triggers
│       ├── db/                  # SQLite WAL database & historical telemetry tables
│       └── streaming/           # Real-time telemetry feeder & broadcast loops
├── frontend/
│   └── src/
│       ├── App.tsx              # Universal state, audio & cross-view synchronization
│       ├── components/          # Dashboard, 3D Scanner, Suit HUD, ISS Deck, MCC
│       ├── services/            # Audio synthesis, WebSocket client, PDF generator
│       ├── types/               # TypeScript aerospace telemetry definitions
│       └── utils/               # Clinical prioritization algorithms & calculations
├── data/                        # NASA OSDR Inspiration4 (SOMA) baselines & CSV data
├── docs/                        # Engineering specifications & medical safety boundaries
├── documentation/               # Comprehensive system architecture & challenge guides
├── trash/                       # Safely archived temporary notes, test scripts & captures
├── LICENSE                      # MIT Open Science License with NASA Space Apps notice
├── SECURITY.md                  # Comprehensive security audit, OWASP matrix & standards
└── README.md                    # Project master documentation
```

---

<a id="license--nasa-space-apps-notice"></a>

## <img src="assets/icons/file-text.svg" width="22" height="22" align="center"> &nbsp; License & NASA Space Apps Notice

This software is released under the **MIT License** with open-science provisions for the **NASA International Space Apps Challenge 2026**. See the complete [`LICENSE`](LICENSE) file for attribution, NASA OSDR terms, and non-clinical research prototype notices.
