<div align="center">

# H.E.L.I.O.S
### Health Evaluation Logistic Intelligent Onboard System

**NASA Space Apps Challenge 2024 · Deep-Space Crew Health Intelligence Platform**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.124-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Ollama](https://img.shields.io/badge/Ollama-Llama_3.2-FF6B35?style=flat)](https://ollama.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

*An offline-first, AI-powered astronaut health monitoring and decision-support system designed for deep-space missions with complete communication blackout autonomy.*

---

[Overview](#overview) · [Architecture](#architecture) · [Setup](#setup) · [How It Works](#how-it-works) · [Dataset](#dataset) · [API Reference](#api-reference)

</div>

---

## Overview

H.E.L.I.O.S is a real-time astronaut health monitoring HUD (Heads-Up Display) that streams physiological telemetry for a 4-person deep-space crew at **10 Hz**, evaluates it through a multi-signal clinical sentry engine, and delivers proactive spoken health advisories through **JARVIS** — an onboard AI voice assistant powered by a fully local language model.

The system is built for **total communication blackout** scenarios (e.g., Mars transit). No internet connection, no cloud API, no external dependency. Everything runs on the crew''s own hardware.

### Core Capabilities

| Capability | Description |
|---|---|
| 🫀 **Live ECG + Vitals** | Continuous Lead II ECG, SpO₂ pleth, HR, HRV, core temp per astronaut at 60–90 FPS |
| 🧠 **AI Sentry Engine** | Multi-biomarker fusion: EPI (sepsis), ARF (arrhythmia), TRM (thrombosis), RSI (radiation) |
| 🔊 **JARVIS Voice Console** | Spoken health advisories via local Ollama LLM + Microsoft Edge Neural TTS |
| 📡 **10 Hz WebSocket Stream** | Real NASA OSDR-derived telemetry replayed at physiological fidelity |
| 🚨 **3-Tier Alert System** | NOMINAL → WARNING → CRITICAL with progressive multi-stage directives |
| 🏥 **Triage Modal** | Full clinical biomarker panel for any crew member on demand |
| 🌌 **Mars Delay Mode** | Simulates 4–24 minute one-way communication delay to Earth |
| 🔌 **Offline-First** | Ollama LLM + Edge TTS — zero cloud dependency |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / HUD                            │
│   React 19 + TypeScript · Vite Dev Server · Port 3000           │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  CrewGrid   │  │ EcgRowCanvas │  │   JarvisConsole      │   │
│  │ (4-row HUD) │  │(4x RAF loop) │  │  (Voice + TTS sync)  │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
│                          │                       │              │
│              WebSocket /ws/telemetry    REST /api/*             │
└──────────────────────────┼───────────────────────┼─────────────┘
                           │                       │
┌──────────────────────────▼───────────────────────▼─────────────┐
│                    FastAPI BACKEND · Port 8000                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              TelemetryFeeder (10 Hz loop)                │   │
│  │  CSV replay → SentryMatrix → alert coalescing → WS push  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ SentryMatrix │  │ VoiceEngine  │  │   BaselineManager   │   │
│  │ EPI/ARF/TRM/ │  │Ollama + TTS  │  │ NASA OSDR Profiles  │   │
│  │ RSI/ZScore   │  │ anti-chatter │  │ per crew per state  │   │
│  └──────────────┘  └──────┬───────┘  └─────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │         SQLite WAL Database (astronaut_health.db)        │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   Ollama AI Server · Port 11434                  │
│                                                                  │
│   Model: llama3.2:1b  ·  Temp: 0.2  ·  System: JARVIS persona   │
│   Generates contextual health advisories in under 3 seconds      │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend**
- **FastAPI 0.124** — Async REST + WebSocket API framework
- **Uvicorn 0.38** — ASGI production server
- **SQLite WAL** — High-throughput concurrent telemetry logging
- **Python 3.11+** — Core runtime

**Frontend**
- **React 19** — UI component framework
- **TypeScript 6.0** — Type-safe component logic
- **Vite 8.3** — Dev server with HMR + API proxy
- **HTML5 Canvas** — 60–90 FPS ECG/PPG waveform rendering via `requestAnimationFrame`

**AI / Voice**
- **Ollama (llama3.2:1b)** — Fully local LLM for JARVIS clinical language generation
- **Microsoft Edge Neural TTS** — Natural voice synthesis (Ryan, en-US) via Edge TTS Python API
- **Web Speech API** — Fallback SAPI5 voice when neural TTS is unavailable

---

## Setup

> **Prerequisites:** Python 3.11+, Node.js 18+, Git, and [Ollama](https://ollama.com) installed.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/zihaduzzamaan/H.E.L.I.O.S---Health-Evaluation-Logistic-Intelligent-Onboard-System-for-NASA.git
cd "H.E.L.I.O.S---Health-Evaluation-Logistic-Intelligent-Onboard-System-for-NASA"
```

---

### Step 2 — Set Up the Python Backend

#### 2a. Create and activate a virtual environment

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

#### 2b. Install Python dependencies

```bash
pip install fastapi uvicorn[standard] edge-tts aiohttp aiofiles
```

| Package | Purpose |
|---|---|
| `fastapi` | REST + WebSocket API server |
| `uvicorn[standard]` | ASGI production server with WebSocket support |
| `edge-tts` | Microsoft Edge Neural TTS (offline after first use) |
| `aiohttp` | Async HTTP client for Ollama AI requests |
| `aiofiles` | Async file I/O for TTS audio caching |

#### 2c. Start the backend server

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will start at **`http://localhost:8000`**

Verify it is running:
```bash
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "NOMINAL",
  "system": "JARVIS_ASTRONAUT_HEALTH_SENTRY",
  "streaming_hz": 10,
  "active_hud_clients": 0,
  "loaded_crew_members": 4
}
```

---

### Step 3 — Set Up the Ollama AI Server

Ollama provides the local LLM that powers JARVIS. No internet is required after the model is downloaded.

#### 3a. Install Ollama

Download from [https://ollama.com/download](https://ollama.com/download) and install for your OS.

#### 3b. Pull the base model

```bash
ollama pull llama3.2:1b
```

> This downloads ~800 MB. Only required once.

#### 3c. Create the JARVIS persona

```bash
ollama create helios-jarvis -f backend/app/ai/Modelfile
```

This creates the `helios-jarvis` model with:
- Deep-space flight computer personality
- Communication blackout context (no "see a doctor" responses)
- Calm, direct clinical language for crew under stress

#### 3d. Verify Ollama is running

```bash
curl http://localhost:11434/api/tags
```

Ollama auto-starts on install. If it is not running, start it manually:

```bash
ollama serve
```

---

### Step 4 — Set Up the React Frontend

#### 4a. Install dependencies

```bash
cd frontend
npm install
```

#### 4b. Start the development server

```bash
npm run dev
```

The HUD will be available at **`http://localhost:3000`**

> Vite automatically proxies `/api/*` and `/ws/*` to the backend at `localhost:8000`. No manual CORS configuration needed.

---

### Step 5 — Verify Full System

Open **`http://localhost:3000`** in your browser. You should see:

- ✅ **Header** shows `ONLINE` status with a green indicator
- ✅ **4 crew rows** with live fluctuating vitals (HR, HRV, SpO₂, Core Temp)
- ✅ **4 ECG waveforms** running in real-time at 60+ FPS
- ✅ **JARVIS console** initializes and begins loading
- ✅ **POC Labs panel** showing biomarker values (K⁺, IL-6, WBC, Hct)

Check AI status:
```bash
curl http://localhost:8000/api/ai/status
```

---

### Quick Start Reference

```
# Terminal 1 — Python backend
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Ollama AI (auto-starts, or run manually)
ollama serve

# Terminal 3 — React frontend
cd frontend && npm run dev
```

| Service | URL | Purpose |
|---|---|---|
| HUD Frontend | `http://localhost:3000` | Main astronaut health display |
| Backend API | `http://localhost:8000` | REST + WebSocket telemetry server |
| API Docs | `http://localhost:8000/docs` | Interactive FastAPI Swagger UI |
| AI Status | `http://localhost:8000/api/ai/status` | Ollama model health check |
| Ollama | `http://localhost:11434` | Local LLM inference server |

---

## How It Works

### 1. Telemetry Streaming Pipeline

```
data/astronaut_telemetry_stream.csv
         │
         ▼  load_dataset() on startup
  TelemetryFeeder.records[]       ← 11 MB · 40,000+ rows · 4 astronauts · 10 Hz
         │
         ▼  10 Hz step_tick loop
  SentryMatrixEngine.evaluate_state()
    ├── Activity gating (workout HR suppression per NASA-STD-3001)
    ├── EPI  — Early Sepsis Index      (IL-6 + WBC + HRV autonomic decay)
    ├── ARF  — Arrhythmogenic Risk     (K+ + dynamic Fridericia QTc)
    ├── TRM  — Venous Thrombosis Risk  (Hct + Plt + IL-6 + SpO2)
    └── RSI  — Radiation Sickness      (flux + Andrews lymphocyte depletion model)
         │
         ▼  Alert coalescing (100ms temporal window)
  WebSocket broadcast → all connected HUD clients
```

### 2. Biomarker Engine — SentryMatrix

The `SentryMatrixEngine` runs a **3-tier alert escalation protocol** on every telemetry packet:

| Tier | Trigger Conditions | HUD + Audio Response |
|---|---|---|
| **CRITICAL** | SpO₂ < 90%, CO₂ ≥ 4 mmHg, QTc ≥ 485ms, TRM ≥ 2.2, RSI ≥ 1.8 | Klaxon + red pulsing border |
| **WARNING** | K⁺ < 3.8, EPI ≥ 0.9, HRV Z ≤ −2σ, CO₂ ≥ 3 mmHg, RSI ≥ 1.0 | Chime + amber border |
| **NOMINAL** | All parameters within personal baseline range | No alert |

Each astronaut has individual baselines derived from NASA OSDR spaceflight data, segmented by activity state (REST / WORKOUT / SLEEP).

### 3. JARVIS Voice Advisory System

```
Alert detected (severity >= WARNING)
         │
         ▼
VoiceEngine.should_suppress_alert()    ← 30s anti-chatter cooldown
         │                             ← Override if severity escalates
         ▼
DecisionEngine.generate_clinical_brief()
         │   Ollama (llama3.2:1b) generates personalized advisory
         │   using structured clinical context prompt
         ▼
VoiceEngine.synthesize_neural_speech()
         │   edge-tts: Microsoft Ryan (en-US-RyanNeural)
         │   Cached as MP3 for zero-latency replay
         ▼
AudioService (frontend)
         │   Plays audio blob
         │   Synchronizes word-by-word text to HUD display
         └── 3.5s mandatory quiet break → next advisory stage
```

**Progressive Alert Pacing:** For active emergencies, JARVIS delivers phased messages at staged intervals (speech + 3.5s quiet break), matching NASA-STD-3001 alarm fatigue prevention guidelines.

### 4. ECG Waveform Rendering

Each astronaut row contains an independent `EcgRowCanvas` component that:

- Maintains its own **WebSocket subscription** filtered to its astronaut ID
- Runs a **decoupled `requestAnimationFrame` loop** at native display refresh (60–90 FPS)
- Synthesizes **Lead II ECG** using Gaussian wave models for P, Q, R, S, T waves
- Renders **arterial PPG** (pulse plethysmogram) with systolic upstroke and dicrotic notch
- Adapts cardiac cycle speed in real-time to the **live heart rate** from telemetry

### 5. Scenario Simulation Controller

| Scenario | Key Biomarker Changes | JARVIS Response |
|---|---|---|
| **Hypoxia** | SpO₂ drops to 86–88% | Emergency oxygen protocol |
| **CO₂ Toxicity** | Cabin CO₂ rises to 4.5+ mmHg | Scrubber evacuation alert |
| **Radiation SPE** | Flux spikes to 120+ mGy/h, lymphocytes drop | Storm shelter directive |
| **Sepsis** | IL-6 > 40 pg/mL, WBC > 13k, HRV collapse | Sepsis cascade alert |
| **Arrhythmia** | K⁺ drops to 2.8, QTc > 490ms | Electrolyte emergency |

---

## Dataset

### Source

All telemetry is derived from real NASA Open Science Data Repository (OSDR) spaceflight studies:

| Study | Description |
|---|---|
| **OSD-569** | SpaceX Inspiration4 — Complete Blood Count panel (pre/during/post-flight) |
| **OSD-575** | SOMA Human Spaceflight Atlas — Cardiovascular, Metabolic, Immune cytokine panels |

### Data Files

```
data/
├── astronaut_telemetry_stream.csv              ← 11.3 MB · 10 Hz · 30 columns · 4 crew
├── nasa_astronaut_baselines.json               ← Per-crew baselines (mean ± SD per state)
└── nasa_osdr/
    ├── OSD-569_Complete_Blood_Count.csv        ← 61 columns, 20 key CBC markers
    ├── OSD-575_Cardiovascular_Panel.csv        ← 9 acute-phase proteins (fibrinogen, CRP...)
    ├── OSD-575_Comprehensive_Metabolic_Panel.csv ← 58 columns, 19 metabolic markers
    └── OSD-575_Immune_Panel.csv                ← 143 columns, 71 cytokines (IL-6, TNF-α...)
```

> See [`dataset_coverage_analysis.md`](dataset_coverage_analysis.md) for a complete field-by-field audit of dataset utilization.

### Key Telemetry Columns

| Column | Unit | Description |
|---|---|---|
| `heart_rate` | BPM | Instantaneous cardiac rate |
| `hrv_rmssd` | ms | Heart Rate Variability (RMSSD) |
| `spo2` | % | Arterial oxygen saturation |
| `core_temp` | °C | Core body temperature |
| `cabin_co2` | mmHg | Cabin partial pressure CO₂ |
| `potassium` | mmol/L | Serum electrolyte (K⁺) |
| `hematocrit` | % | Red blood cell volume fraction |
| `wbc_count` | k/μL | White blood cell count |
| `il_6` | pg/mL | Interleukin-6 (inflammation/sepsis marker) |
| `platelet_count` | k/μL | Thrombocyte count |
| `radiation_flux` | mGy/h | Physical dosimeter flux |
| `lymphocyte_count` | k/μL | Absolute lymphocyte count (radiation biodosimetry) |
| `computed_epi` | 0–3 | Early Sepsis / Immune Index |
| `computed_arf` | 0–5 | Arrhythmogenic Risk Factor |
| `computed_trm` | 0–5 | Venous Thrombosis Risk Metric |
| `computed_rsi` | 0–5 | Radiation Sickness Index |

---

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health + active client count |
| `GET` | `/api/ai/status` | Ollama AI engine + TTS status |
| `POST` | `/api/ai/initiate` | Manually warm up the Ollama model |
| `GET` | `/api/baselines` | Crew baseline distributions |
| `GET` | `/api/telemetry/latest-all` | Most recent packet for all crew members |
| `GET` | `/api/telemetry/{astronaut_id}` | Historical telemetry for one astronaut |
| `POST` | `/api/scenario` | Trigger a scenario (body: `{"scenario": "HYPOXIA"}`) |
| `POST` | `/api/mars-delay` | Toggle Mars latency simulation |
| `GET` | `/api/triage/{astronaut_id}` | Full clinical triage snapshot |

**Interactive docs:** `http://localhost:8000/docs`

### WebSocket

**Endpoint:** `ws://localhost:8000/ws/telemetry`

Telemetry packet (10 Hz, per astronaut):
```json
{
  "type": "telemetry",
  "payload": {
    "astronaut_id": "AST-01_COMMANDER",
    "heart_rate": 67.4,
    "spo2": 98.1,
    "hrv_rmssd": 63.2,
    "core_temp": 36.82,
    "evaluated_severity": "NOMINAL",
    "computed_epi": 0.02,
    "scenario_phase": "NOMINAL_CRUISE"
  }
}
```

Alert packet (on severity change):
```json
{
  "type": "alert",
  "payload": {
    "astronaut_id": "AST-01_COMMANDER",
    "severity": "CRITICAL",
    "message": "Severe hypoxia threshold breached: SpO2 dropped to 86.3%.",
    "voice_text": "Commander, your oxygen saturation has dropped critically...",
    "tone": "klaxon"
  }
}
```

---

## Project Structure

```
H.E.L.I.O.S/
├── backend/
│   └── app/
│       ├── main.py                          ← FastAPI entry point, routes, lifespan
│       ├── ai/
│       │   ├── Modelfile                    ← Ollama JARVIS persona definition
│       │   ├── decision_engine.py           ← Clinical prompt builder + Ollama bridge
│       │   ├── fallback_templates.py        ← Pre-written progressive scenario scripts
│       │   ├── ollama_client.py             ← Async Ollama HTTP client
│       │   └── voice_engine.py              ← TTS synthesis, anti-chatter, audio cache
│       ├── core/
│       │   ├── sentry_matrix.py             ← Multi-signal anomaly correlator
│       │   ├── computational_biomarkers.py  ← EPI, ARF, TRM, RSI, PSI calculators
│       │   ├── baselines.py                 ← NASA OSDR baseline JSON loader
│       │   ├── activity_gating.py           ← Workout-state cardiac alarm suppressor
│       │   ├── zscore_evaluator.py          ← Personal-baseline Z-score calculator
│       │   └── circular_buffer.py           ← Ring buffer for telemetry history
│       ├── db/
│       │   ├── database.py                  ← SQLite WAL initialization
│       │   ├── models.py                    ← Table schema definitions
│       │   └── repository.py                ← Telemetry read/write repository
│       └── streaming/
│           ├── telemetry_feeder.py          ← 10 Hz CSV replay + alert coalescing
│           └── websocket_manager.py         ← Multi-client WebSocket broadcast manager
│
├── frontend/
│   └── src/
│       ├── App.tsx                          ← Root layout, WebSocket state
│       ├── components/
│       │   ├── CrewGrid.tsx                 ← 4-row astronaut card + inline ECG layout
│       │   ├── EcgRowCanvas.tsx             ← Per-astronaut real-time ECG/PPG canvas
│       │   ├── JarvisConsole.tsx            ← AI voice console + word-sync display
│       │   ├── HeaderBar.tsx                ← Mission clock, connection, Mars delay
│       │   ├── ScenarioController.tsx       ← Emergency scenario trigger panel
│       │   ├── TelemetryCanvas.tsx          ← Full-screen ECG detail view
│       │   └── TriageModal.tsx              ← Clinical triage drawer
│       ├── services/
│       │   ├── audioService.ts              ← Neural TTS queue, quiet breaks
│       │   └── websocketService.ts          ← Typed WS client with auto-reconnect
│       └── types/
│           └── telemetry.ts                 ← TypeScript interfaces for all data types
│
├── data/
│   ├── astronaut_telemetry_stream.csv
│   ├── nasa_astronaut_baselines.json
│   └── nasa_osdr/
│
├── scripts/
│   ├── generate_telemetry_stream.py         ← Generates the 10 Hz CSV from OSDR data
│   ├── download_nasa_osdr.py                ← NASA OSDR API downloader
│   └── run_all_tests.py                     ← Full test suite runner
│
├── dataset_coverage_analysis.md             ← Detailed dataset utilization audit
├── .gitignore
└── README.md
```

---

## Troubleshooting

**Backend won't start**
- Ensure you are running from the **project root** directory, not inside `backend/`
- Verify virtual environment is active
- Check port 8000 is free: `netstat -an | findstr 8000`

**JARVIS voice is silent or using robotic voice**
- Confirm `edge-tts` is installed: `pip show edge-tts`
- Check Ollama is running: `curl http://localhost:11434/api/tags`
- Verify model exists: `ollama list` (should show `helios-jarvis`)
- System automatically falls back to Web Speech API (SAPI5) if Edge TTS is unavailable

**ECG waveforms not animating**
- Check browser DevTools → Console for WebSocket errors
- Ensure backend is running at `localhost:8000`
- Access the app via `localhost:3000` (Vite proxy), not directly on port 8000

**Ollama responds slowly**
- `llama3.2:1b` requires minimum 4 GB free RAM
- For GPU acceleration, verify Ollama detected your GPU via Task Manager while running `ollama run helios-jarvis "test"`

---

## Contributing

This project was built for the **NASA Space Apps Challenge 2024** under the challenge:
> *"Intelligent Onboard Health Monitoring for Deep-Space Missions"*

Contributions expanding dataset utilization are especially welcome. See [`dataset_coverage_analysis.md`](dataset_coverage_analysis.md) — 85% of NASA OSDR biomarkers are not yet integrated.

**Priority contribution areas:**
- `sleep_score` alerting — baseline data already in JSON
- `fibrinogen` + `haptoglobin` enhanced TRM model — CV panel already in `/data`
- `tnfα` + `ifnγ` viral reactivation index — Immune panel already in `/data`
- Space anemia detection via `hemoglobin` + `MCV` from CBC panel

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built for deep-space human health · NASA Space Apps Challenge 2024

**H.E.L.I.O.S** — *Because in deep space, JARVIS is the only doctor on board.*

</div>
