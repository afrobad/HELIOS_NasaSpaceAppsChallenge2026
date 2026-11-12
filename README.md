<div align="center">

# H.E.L.I.O.S.
### Health Evaluation & Longevity Intelligence for Orbiting Specialists
**Autonomous Offline-First Clinical Sentry, Multi-Agent Biometric Intelligence & 3D Digital Bio-Twin Platform for Deep-Space Exploration**

**NASA International Space Apps Challenge 2026**  
*Challenge Track: Create Health Monitoring Software for Astronauts on Space Missions*

[![NASA Space Apps 2026](https://img.shields.io/badge/NASA_Space_Apps-2026_Global_Challenge-0B3D91.svg?style=for-the-badge&logo=nasa&logoColor=white)](https://www.spaceappschallenge.org/)
[![NASA-STD-3001](https://img.shields.io/badge/Standard-NASA--STD--3001_Vol_1_%26_2-red.svg?style=for-the-badge&logo=nasa)](https://standards.nasa.gov/)
[![NASA OSDR Grounded](https://img.shields.io/badge/Data-NASA_OSDR_Inspiration4_(SOMA)-orange.svg?style=for-the-badge&logo=nasa)](https://osdr.nasa.gov/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI 0.115+](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript 5.6](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Three.js WebGL](https://img.shields.io/badge/Three.js-WebGL_r160+-black.svg?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT_Open_Science-green.svg?style=for-the-badge)](LICENSE)

---

[Executive Overview](#executive-overview) • [The Deep-Space Medical Reality](#the-deep-space-medical-reality) • [NASA OSDR Grounding](#nasa-osdr-scientific-grounding) • [System Architecture](#system-architecture) • [Key Subsystems](#key-subsystems--innovations) • [Dual-Use Earth Impact](#dual-use-terrestrial-impact) • [Security & Safety](#security-safety--standards) • [Quick Start](#quick-start--deployment) • [Credits](#team--credits)

---

</div>

<a id="executive-overview"></a>

## 🌟 Executive Overview

During humanity’s journey toward the Moon and Mars under the Artemis program, astronauts will travel hundreds of thousands to hundreds of millions of kilometers from Earth. Beyond Low Earth Orbit (LEO), the traditional umbilical cord connecting astronauts to Houston Mission Control breaks down: **light-speed radio signals take between 4 and 24 minutes one-way**, creating an unavoidable round-trip communication blackout of up to 48 minutes.

In acute medical crises—such as cabin decompression, severe toxic gas breakthrough, cardiac arrhythmias, or solar particle radiation storms—**Earth-dependent telemedicine is physically impossible**.

**H.E.L.I.O.S.** (Health Evaluation & Longevity Intelligence for Orbiting Specialists) is a mission-grade, **100% autonomous, offline-first clinical decision-support and visual self-assessment platform**. Built for deep-space exploration crews and grounded in genuine **NASA Open Science Data Repository (OSDR)** spaceflight profiles, HELIOS transforms the spacecraft into an autonomous digital flight surgeon capable of presymptomatic anomaly detection, real-time 3D anatomical twin modeling, and hands-free spoken clinical intervention.

```
╔════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                        HELIOS AT A GLANCE                                              ║
╠════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║  • 100% Autonomous & Offline-First: Zero cloud or ground dependency; runs entirely at the edge.         ║
║  • 10 Hz Real-Time Biometric Ingestion: Low-latency WebSocket streaming for multi-astronaut vitals.     ║
║  • 149 Multimodal Physiological Parameters across 10 vital clinical and life-support categories.       ║
║  • 119 Point-of-Care Laboratory Assays grounded in NASA OSDR Inspiration4 (SOMA) baselines.            ║
║  • 60–90 FPS Decoupled Canvas Engines: Clinically accurate Lead II ECG and SpO₂ photoplethysmography.  ║
║  • 3D Holographic Bio-Twin: Interactive WebGL anatomical wireframe with organ-level stress heatmaps.   ║
║  • First-Person Spacesuit AR Visor (Suit HUD): Optical helmet HUD with tactical waypoint guidance.     ║
║  • 3D ISS Station Twin & Cupola: Photorealistic WebGL station with real-time Earth nadir tracking.     ║
║  • Speed-of-Light Radio Delay Simulator: Realistic Mars-to-Earth telemetry propagation pipeline.       ║
║  • Terrestrial Dual-Use: Direct deployment to tactical firefighting HUDs and remote rural ICUs.        ║
╚════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

<a id="the-deep-space-medical-reality"></a>

## 🚀 The Deep-Space Medical Reality

NASA’s Human Research Program (HRP) identifies five fundamental hazards that jeopardize human life during long-duration interplanetary exploration:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    THE 5 HAZARDS OF HUMAN SPACEFLIGHT                                   │
├───────────────────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ 1. Space Radiation        │ Galactic cosmic rays and Solar Particle Events (SPE) cause DNA damage,      │
│                           │ acute radiation syndrome (ARS), and central nervous system degradation.     │
├───────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ 2. Isolation & Confinement│ Prolonged confinement in closed modules triggers circadian desynchrony,     │
│                           │ cognitive fatigue, elevated cortisol, and immune dysregulation.             │
├───────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ 3. Distance from Earth    │ Speed-of-light delays (4 to 24 min one-way to Mars) eliminate real-time     │
│                           │ terrestrial medical rescue. Evacuation to Earth is physically impossible.   │
├───────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ 4. Altered Gravity Fields │ Microgravity causes cephalic fluid shifts (~1.5–2.0 L upward), SANS optic   │
│                           │ nerve edema, bone mineral depletion (-1.5%/month), and muscle atrophy.      │
├───────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
│ 5. Hostile Closed Envs    │ Elevated cabin CO₂ (>3.0 mmHg), hypergolic coolant loop leaks, and toxic    │
│                           │ trace contaminants require continuous ECLSS-physiological cross-triage.    │
└───────────────────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

### The Communication Blackout Paradigm

```
LOW EARTH ORBIT / ISS (400 km)                     MARS TRANSIT & DEEP SPACE (>55,000,000 km)
┌──────────────┐         Sub-second Radio         ┌──────────────┐         4 to 24 Minute Delay          ┌──────────────┐
│  Astronaut   │ <==============================> │   Houston    │ <···································> │  Astronaut   │
│  Spacecraft  │         Direct Ground Link       │ Mission Ctrl │     Light-Time Telemetry Lag      │ Deep Space   │
└──────────────┘                                  └──────────────┘                                       └──────┬───────┘
                                                                                                                │ Zero Latency
                                                                                                         ┌──────▼───────┐
                                                                                                         │  H.E.L.I.O.S │
                                                                                                         │ Edge Sentry  │
                                                                                                         └──────────────┘
```

On Mars, if an astronaut experiences acute cardiac ischemia or hypercapnic hypoxia, **waiting 40 minutes for a ground reply is fatal**. HELIOS solves this by deploying a fully local, deterministic clinical intelligence layer directly inside the spacecraft avionics.

---

<a id="nasa-osdr-scientific-grounding"></a>

## 🔬 NASA OSDR Scientific Grounding

HELIOS does not use synthetic, arbitrary medical thresholds. Every baseline distribution, z-score alert boundary, and laboratory assay reference is grounded in peer-reviewed scientific studies from the **NASA Open Science Data Repository (OSDR)** and official **NASA Standards**:

| NASA Dataset / Standard | Study Description | Operational Function in HELIOS |
|:---|:---|:---|
| **NASA OSDR OSD-575** | **Inspiration4 (I4) SOMA Longitudinal Multi-Omics Profiling** | Baseline distributions for point-of-care laboratory blood assays: hematocrit, serum potassium, troponin-I, ferritin, and cytokine inflammatory panels. |
| **NASA OSDR OSD-569** | **Spaceflight Induces Longitudinal Epigenomic Immune Remodeling** | Dynamic calibration of microgravity cephalic fluid redistribution, endothelial activation markers, and immune senescence vectors. |
| **NASA OSDR OSD-379 & 194** | **Murine and Human Microgravity Skeletal Demineralization** | Calibrated bone mineral density loss rate models ($-1.5\%\text{ per month}$) and ARED countermeasure resistance tracking curves. |
| **NASA-STD-3001 Vol 1** | **Crew Health Flight Standard** | Multi-lead cardiovascular thresholds, SpO₂ hypoxemia limits ($<90\%$), heart rate variability (HRV RMSSD) circadian ranges, and core body temperature limits. |
| **NASA-STD-3001 Vol 2** | **Habitability and Environmental Health** | ECLSS environmental safety envelopes: Cabin total pressure ($101.3\text{ kPa}$), partial pressure of carbon dioxide ($P\text{CO}_2 < 3.0\text{ mmHg}$), O₂ fraction ($20.9\% \pm 1.0\%$). |
| **NASA HRP SANS Protocol** | **Spaceflight-Associated Neuro-ocular Syndrome** | Intracranial pressure (ICP) estimation, optic nerve sheath diameter (ONSD $\ge 5.8\text{ mm}$ alert threshold), and retinal microaneurysm screening. |

---

<a id="system-architecture"></a>

## 🏗️ System Architecture

HELIOS is built on a decoupled, aerospace-grade architecture that enforces zero-latency local execution, resilient cross-frame synchronization, and mathematical safety boundaries:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       HELIOS UNIFIED COMMAND DECK                                       │
│                                                                                                         │
│   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────────────┐   │
│   │  Main Dashboard   │  │  Health Telemetry │  │  Daily Self-Check │  │  Mission Routine Adherence │   │
│   │  (10 Hz Telemetry)│  │  (Deep Biosensors)│  │  (Cognitive / PVT)│  │  (ARED Countermeasures)   │   │
│   └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘  └─────────────┬──────────────┘   │
│             │                      │                      │                           │                 │
│   ┌─────────┴─────────┐  ┌─────────┴─────────┐  ┌─────────┴─────────┐  ┌─────────────┴──────────────┐   │
│   │  Earth MCC Console│  │  3D Bio-Twin Holo │  │  Astronaut Helmet │  │  Photorealistic 3D Station │   │
│   │  (Mars Delay Lag) │  │  (/scanner)       │  │  Visor (Suit HUD) │  │  Deck & Cupola (/iss)      │   │
│   └───────────────────┘  └───────────────────┘  └───────────────────┘  └────────────────────────────┘   │
└───────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                    │
                                   Bidirectional 10 Hz WebSocket & REST
                                                    │
┌───────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
│                                      FASTAPI AEROSPACE EDGE ENGINE                                      │
│                                                                                                         │
│   ┌────────────────────────────────┐  ┌────────────────────────────────┐  ┌─────────────────────────┐   │
│   │ TelemetryFeeder Engine         │  │ SentryMatrix Engine            │  │ Helix-Ai Clinical Sentry│   │
│   │ High-rate 10 Hz WebSocket loop │  │ Rolling Z-score anomaly triage │  │ Multi-agent reasoning   │   │
│   │ Multi-crew data synthesis      │  │ Dynamic baseline gating        │  │ Quindar radio tones     │   │
│   └──────────────┬─────────────────┘  └──────────────┬─────────────────┘  └────────────┬────────────┘   │
│                  │                                   │                                 │                │
│   ┌──────────────▼─────────────────┐  ┌──────────────▼─────────────────┐  ┌────────────▼────────────┐   │
│   │ NASA OSDR Baseline Manager     │  │ Radio Propagation Pipeline     │  │ SQLite WAL High-Rate DB │   │
│   │ SOMA Inspirations4 profiles    │  │ Speed-of-light delay buffer    │  │ In-memory caching       │   │
│   │ NASA-STD-3001 threshold logic  │  │ Packet loss / jitter simulation│  │ >180,000 writes/sec     │   │
│   └────────────────────────────────┘  └────────────────────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

<a id="key-subsystems--innovations"></a>

## 🕹️ Key Subsystems & Innovations

### 1. Unified Spacecraft Flight Command Deck (`/`)
* **10 Hz Real-Time Biometric Feed**: Non-blocking WebSocket pipeline continuously streaming heart rate, pulse oximetry (SpO₂), core body temperature, heart rate variability (HRV RMSSD), blood pressure, and cabin life-support telemetry.
* **Hardware-Decoupled 60–90 FPS Canvas Engine**: Clinically calibrated, real-time Lead II electrocardiogram (ECG) and photoplethysmogram (PPG) waveforms rendered on high-framerate HTML5 canvases without DOM overhead.
* **ECLSS Life-Support Atmosphere Bar**: Real-time atmospheric containment monitors measuring cabin pressure ($101.3\text{ kPa}$), oxygen fraction ($20.9\%$), carbon dioxide partial pressure ($1.82\text{ mmHg}$), ambient temperature ($21.4^\circ\text{C}$), and ionizing radiation flux ($0.05\text{ mSv/h}$).
* **Crew Telemetry Manifest**: Live health state cards for all four crew members (**Commander Haley**, **Pilot Chris**, **Medical Officer Dr. Sian**, **Specialist Leo**) with color-coded triage badges.

### 2. Autonomous Helix-Ai Clinical Analyst & Situation Normalizer
* **Sub-Second Multi-Agent Triage**: Analyzes multi-sensor anomalies in $<400\text{ ms}$, categorizing clinical severity (`NOMINAL`, `WATCH`, `WARNING`, `CRITICAL`).
* **Hands-Free Audio Directives**: Synthesizes medical verbal directives with authentic NASA Quindar tones ($2525\text{ Hz}$ initiate / $2475\text{ Hz}$ terminate) and clinical prosody, minimizing astronaut cognitive workload.
* **One-Click Situation Normalization ("SOLVED // ALL NOMINAL")**: When an emergency is mitigated, the crew clicks **SOLVED**. The system validates physiological recovery, flushes stale anomaly state, silences klaxons, broadcasts speech confirmation, and resets crew baselines.

### 3. Interactive 3D Holographic Digital Bio-Twin (`/scanner`)
* **360° Anatomical WebGL Mannequin**: Rotatable wireframe Bio-Twin with three rendering modes:
  * **Cyan Bio-Holo**: Standard physiological monitoring mode.
  * **Thermal IR Heatmap**: Thermal regulation and surface inflammation visualization.
  * **Amber Tactical HUD**: High-contrast emergency damage and radiation absorption mapping.
* **Clickable Organ Telemetry Subsystems**: Real-time inspection for **Ocular & Brain** (SANS / ICP), **Heart & Cardiac** (arrhythmias, stroke volume), **Lungs & Pulmonary** (hypoxic vasoconstriction), **Renal System** (hydration, nephrolithiasis risk), and **Skeletal Architecture** (bone density loss).

### 4. First-Person Spacesuit Helmet Visor (`Suit HUD` · `/suit-hud`)
* **Zero-G Helmet Visor Simulation**: High-fidelity optical visor with curvature mapping, dynamic edge vignetting, visor glare reflections, and atmospheric condensation/smoke effects.
* **Tactical Waypoint Navigation**: Real-time azimuth and distance tracking targeting spacecraft modules, lunar habitat airlocks, and emergency recharge nodes.
* **Head-Tracking Zero-G Parallax**: Dynamic camera interpolation responding to mouse/pointer motion, replicating in-helmet astronaut situational awareness.

### 5. 3D ISS Orbital Flight Deck (`ISS Deck` · `/iss`)
* **Full-Scale Station Exterior & Interior Twin**: Engineered with authentic textures, deep-blue photovoltaic solar array wings, gold MLI thermal insulation blankets, and space-grade anodized aluminum modules.
* **Seven-Window Cupola Observation Dome**: Real-time orbital Earth nadir tracking, calculating sub-satellite latitude/longitude, orbital velocity ($27,600\text{ km/h}$), and day-night terminator transitions over an 8K procedural Earth globe.
* **Interactive Bulkhead Consoles**: Projecting real-time crew vitals and mission telemetry directly onto 3D in-world monitors using Three.js CSS2D/CSS3D technology.

### 6. Earth Mission Control Center Ground Console (`Earth MCC` · `/mcc`)
* **Physical Speed-of-Light Radio Delay Engine**: Simulates authentic distance-based radio latency:
  * Low Earth Orbit (LEO): $0.0\text{ seconds}$
  * Lunar Gateway / Artemis Base: $1.3\text{ seconds}$
  * Mars Closest Approach: $4.3\text{ minutes}$
  * Mars Solar Conjunction: $22.4\text{ minutes}$
* **Asymmetric Telemetry Buffer**: Proves why Earth-dependent telemedicine fails: ground surgeons view delayed, queued telemetry packets while the onboard HELIOS sentry acts immediately.

### 7. Cognitive Self-Assessment & Psychomotor Vigilance Drill (`/self-check`, `/mission-routine`)
* **Interactive NASA PVT Reaction Drill**: Validated Psychomotor Vigilance Task measuring millisecond reaction times to detect subtle cognitive fatigue, sleep loss, and neuro-vestibular degradation.
* **Countermeasure Adherence Engine**: Tracks daily compliance with the Advanced Resistive Exercise Device (ARED) and cycle ergometer, preventing muscle atrophy and cardiovascular deconditioning.

---

<a id="dual-use-terrestrial-impact"></a>

## 🌍 Dual-Use Terrestrial Impact

Space technology reaches its highest value when it protects human life on Earth. HELIOS is architected as a **dual-use technological bridge**:

```
                              ┌─────────────────────────────┐
                              │    H.E.L.I.O.S. CORE ENGINE │
                              │    Autonomous · Edge-Native │
                              │    Zero-Cloud Offline AI    │
                              └──────────────┬──────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
        ┌───────────────────────────┐                 ┌───────────────────────────┐
        │     DEEP-SPACE DOMAIN     │                 │     TERRESTRIAL DOMAIN    │
        ├───────────────────────────┤                 ├───────────────────────────┤
        │ • Artemis Lunar Base      │                 │ • Tactical Firefighter HUD│
        │ • Mars Transit Vehicles   │                 │ • Remote Rural ICU Clinics│
        │ • Commercial Spaceflight  │                 │ • Subsea & Extreme Mining │
        │ • Zero-G Spacewalks (EVA) │                 │ • Disaster Relief Zones   │
        └───────────────────────────┘                 └───────────────────────────┘
```

1. **Tactical Firefighter & First Responder HUDs**: The in-helmet AR Visor (`/suit-hud`) integrates into structural firefighting masks, monitoring pulse rate, carbon monoxide exposure, and core temperature inside active structure fires where radio signals are blocked.
2. **Rural & Austere Intensive Care Units**: In developing nations or remote regions lacking specialized physicians, HELIOS serves as an offline AI clinical monitor, triaging patient vitals and suggesting interventions without internet connectivity.
3. **Disaster Relief & Search-and-Rescue**: During earthquakes, hurricanes, or cellular infrastructure blackouts, HELIOS operates on battery power, triaging trauma victims and monitoring field medics.

---

<a id="security-safety--standards"></a>

## 🛡️ Security, Safety & Standards

HELIOS enforces strict **NASA-STD-8739.8** software safety and **OWASP Top 10** cybersecurity defenses:

* **Defense-in-Depth Content Security Policy (SEC-06)**: Restricts script execution to `'self'`, prevents unauthorized external CDN execution, and locks down WebSocket connections.
* **Canonical Path Traversal & LFI Prevention (SEC-02)**: Strict `os.path.commonpath` boundary checks prevent arbitrary file reads or local file inclusion.
* **Zero-Dependency Deterministic Fallback**: If local AI models encounter memory pressure, HELIOS instantly transitions to deterministic rule-based clinical trees (<35 MB RAM footprint).
* **Cross-Frame Synchronization Protection**: Embedded iframe wall monitors (in the 3D cabin) are sandboxed to prevent localStorage or BroadcastChannel cross-contamination.

---

<a id="quick-start--deployment"></a>

## ⚡ Quick Start & Deployment

### System Requirements
* **Python**: 3.11 or newer
* **Node.js**: 18.0 or newer (v20+ recommended)
* **Operating System**: Linux, macOS, or Windows 10/11 (with WSL support)

### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/haXorFalcon/nsa.git
cd nsa

# Create and activate Python virtual environment
python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Launching Development Environment

**Terminal 1 — Aerospace Backend Core:**
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Flight Command Interface:**
```bash
cd frontend
npm run dev
```

Open your browser at **`http://localhost:3000`** (or `http://localhost:5173`).

### 3. Production Single-Process Deployment
The FastAPI backend is capable of serving both the REST/WebSocket API and the compiled React static bundle from a single port (ideal for Render, Docker, or Kubernetes):

```bash
# Build frontend bundle
cd frontend
npm run build
cd ..

# Run production server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

---

<a id="project-directory-structure"></a>

## 📂 Project Directory Structure

```text
├── backend/
│   └── app/
│       ├── main.py                  # FastAPI server, REST routes & 10 Hz WebSocket
│       ├── ai/                      # Helix-Ai Analyst inference & medical reasoning
│       ├── core/                    # NASA OSDR biomarker baselines & sentry engine
│       ├── db/                      # SQLite WAL database & historical telemetry tables
│       └── streaming/               # Real-time telemetry feeder & scenario broadcasting
├── frontend/
│   ├── public/
│   │   ├── cabin/                   # 3D ISS Flight Deck, Three.js WebGL world & assets
│   │   └── videos/                  # Dual-use architecture & tactical graphics
│   └── src/
│       ├── App.tsx                  # Universal state, audio & cross-view synchronization
│       ├── components/              # Cockpit HUD, 3D Scanner, Suit HUD, ISS Deck, MCC
│       ├── services/                # Audio synthesis, WebSocket client, PDF generator
│       ├── types/                   # Aerospace telemetry TypeScript interfaces
│       └── utils/                   # Clinical triage algorithms & OSDR calculations
├── data/                            # NASA OSDR Inspiration4 (SOMA) baselines & CSV datasets
├── documentation/                   # Master architecture specs, video scripts & pitch guides
├── CREDITS.md                       # Full team, scientific, asset & open-source citations
├── LICENSE                          # MIT Open Science License
└── README.md                        # Master project documentation
```

---

<a id="team--credits"></a>

## 👥 Team Aero Vitals & NASA Space Apps Submission

**NASA International Space Apps Challenge 2026**  
*Project Name:* **H.E.L.I.O.S.**  
*Team Name:* **Team Aero Vitals**

* **Raisul Islam** — Team Leader & Product Strategist
* **Mohammad Zihaduzzaman** — Lead Full-Stack Developer
* **Mohammed Meraj** — Lead Systems Architect & Security Engineer
* **Ashfia Tasnim** — Biomedical & Clinical Researcher
* **Mohammad Sabbir** — Video Producer & Media Editor

For complete asset licenses, 3D model attributions, and scientific citations, please see [**`CREDITS.md`**](CREDITS.md).

---

<div align="center">

**H.E.L.I.O.S. — Protecting Every Heartbeat, from Earth’s Orbit to Humanity’s First Footprint on Mars.**

*Released under the MIT License. Developed with pride for the NASA Space Apps Challenge 2026.*

</div>
