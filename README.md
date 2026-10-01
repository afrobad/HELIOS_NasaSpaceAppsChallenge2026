<div align="center">

# H.E.L.I.O.S
### Health Evaluation Logistic Intelligent Onboard System

**NASA Space Apps Challenge 2026**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

*An offline-first astronaut health-monitoring and decision-support prototype for deep-space missions.*

</div>

## Overview

H.E.L.I.O.S. is a real-time health-monitoring HUD for a simulated four-person deep-space crew. It replays NASA OSDR-derived physiological telemetry at 10 Hz, evaluates each packet against personal baselines, and presents vitals, ECG/PPG waveforms, alerts, triage information, and voice advisories in a browser interface.

The project is designed for communication-blackout scenarios such as a Mars transit. Its core telemetry processing and fallback alert logic run locally. Optional voice features may use Ollama locally; Microsoft Edge Neural TTS and Gemini integrations require network access unless a local fallback is used.

> **Important:** This is a demonstration and research prototype, not a certified medical device or flight-qualified clinical system. Its alerts and calculated risk indices must not be used for real medical or mission decisions.

## Main capabilities

- Live crew dashboard with heart rate, HRV, SpO₂, core temperature, and mission state
- 10 Hz telemetry replay over a FastAPI WebSocket
- Personal-baseline and multi-signal anomaly evaluation
- Computed risk indicators for early sepsis (EPI), arrhythmia (ARF), thrombosis (TRM), and radiation sickness (RSI)
- NOMINAL, INFO, WARNING, and CRITICAL alert states
- Triage and laboratory-assay views based on included NASA OSDR data
- Scenario controls for hypoxia, CO₂ events, radiation, cardiovascular, immune, metabolic, and fatigue conditions
- Mars communication-delay simulation
- Optional JARVIS-style local LLM and text-to-speech advisories

## Architecture

```text
React 19 + TypeScript + Vite frontend
        |
        | REST /api/* and WebSocket /ws/telemetry
        v
FastAPI backend
  ├── TelemetryFeeder       Replays the CSV at 10 Hz
  ├── SentryMatrixEngine    Evaluates biomarkers and severity
  ├── BaselineManager       Loads crew and environmental baselines
  ├── Decision/Voice Engine Generates advisories and TTS
  └── SQLite WAL             Stores telemetry and proactive alerts
        |
        ├── NASA OSDR-derived CSV/JSON data
        └── Optional Ollama local model / external TTS services
```

## Repository structure

```text
backend/
  app/
    main.py                 FastAPI application, REST routes, WebSocket endpoint
    ai/                     Ollama, decision, fallback, and voice services
    core/                   Biomarkers, baselines, z-scores, and anomaly logic
    db/                     SQLite database and telemetry repositories
    streaming/              10 Hz feeder and WebSocket broadcasting
  tests/                    Backend unit and API tests

frontend/
  src/
    App.tsx                 Main HUD state and telemetry subscriptions
    components/             Crew grid, ECG, triage, JARVIS, and scenario UI
    services/               WebSocket, audio, and routing services
    types/                  TypeScript telemetry definitions
    utils/                  Clinical prioritization and display helpers

data/                       Telemetry stream, baselines, and NASA OSDR data
scripts/                    Data-generation, download, reporting, and test tools
documentation/              Engineering, architecture, and dataset documentation
Demo/                       Demonstration material
render.yaml                 Render deployment configuration
requirements.txt            Python backend dependencies
```

## Setup

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- Git
- Ollama, only if local AI voice features are required

### 1. Clone the repository

```bash
git clone https://github.com/zihaduzzamaan/H.E.L.I.O.S.git
cd H.E.L.I.O.S
```

### 2. Install backend dependencies

```bash
python -m venv .venv

# macOS/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

If the backend reports that `dotenv` is missing, install the package used by the application:

```bash
pip install python-dotenv
```

### 3. Start the backend

Run this command from the repository root:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available at `http://localhost:8000` and interactive documentation is available at `http://localhost:8000/docs`.

### 4. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api/*` and `/ws/*` to the backend at port 8000.

### 5. Optional: enable local JARVIS AI

```bash
ollama pull llama3.2:1b
ollama create helios-jarvis -f backend/app/ai/Modelfile
ollama serve
```

Ollama is optional for the core telemetry dashboard. The repository includes deterministic/fallback alert behavior for environments where the local model is unavailable. Edge TTS and Gemini features are network-dependent and should not be described as fully offline.

## Quick commands

```bash
# Backend
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend && npm run dev

# Frontend production build
cd frontend && npm run build

# Run the project test orchestrator from the repository root
python scripts/run_all_tests.py
```

For the backend API tests that verify serving the compiled frontend, build the frontend first with `npm run build`.

## API reference

### REST endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Basic service and crew status |
| `GET` | `/api/ai/status` | Local AI and voice subsystem status |
| `POST` | `/api/ai/initiate` | Warm up the local Ollama model |
| `GET` | `/api/baselines` | Crew and environmental baselines |
| `GET` | `/api/telemetry/latest-all` | Latest packet for every crew member |
| `GET` | `/api/telemetry/recent/{astronaut_id}` | Recent stored telemetry records |
| `GET` | `/api/telemetry/lab-assays/{astronaut_id}` | Laboratory profile for one astronaut |
| `GET` | `/api/telemetry/lab-assays` | Laboratory profiles for all crew |
| `GET` | `/api/alerts` | Recent proactive alerts |
| `POST` | `/api/scenario/{scenario_key}` | Trigger a named demonstration scenario |
| `POST` | `/api/mars-delay?enabled=true` | Enable or disable Mars-delay simulation |
| `POST` | `/api/voice/query` | Ask JARVIS a text voice query |
| `GET` | `/api/voice/synthesize` | Stream synthesized speech |
| `POST` | `/api/ai/triage/{astronaut_id}` | Generate an on-demand triage record |
| `POST` | `/api/ai/joint-triage` | Generate a joint two-crew advisory |

### WebSocket

```text
ws://localhost:8000/ws/telemetry
```

The backend broadcasts telemetry packets at approximately 10 Hz and sends alert packets when severity changes or a proactive advisory is generated.

## Telemetry and alert pipeline

```text
data/astronaut_telemetry_stream.csv
        |
        v
TelemetryFeeder.step_tick()
        |
        v
SentryMatrixEngine.evaluate_state()
  ├── personal-baseline z-scores
  ├── activity/workout gating
  ├── EPI: early sepsis index
  ├── ARF: arrhythmogenic risk
  ├── TRM: thrombosis risk
  └── RSI: radiation sickness index
        |
        v
SQLite logging + WebSocket broadcast + optional JARVIS advisory
```

The scenario controller can modify selected telemetry values to demonstrate conditions such as hypoxia, CO₂ scrubber failure, radiation storms, hypokalemia, thrombosis risk, sepsis, and circadian fatigue.

## Data sources

The included data is derived from NASA Open Science Data Repository studies, including:

- **OSD-569:** Inspiration4 complete blood-count data
- **OSD-575:** cardiovascular, metabolic, and immune panels from the SOMA Human Spaceflight Atlas

See [`documentation/dataset_coverage_analysis.md`](documentation/dataset_coverage_analysis.md) for the field-by-field coverage review.

## Deployment

`render.yaml` contains a Render blueprint that builds the React frontend, installs the Python dependencies, and starts the FastAPI service. Configure any optional API keys in the deployment environment rather than committing them to the repository.

## Known limitations

- This repository replays and simulates telemetry; it is not connected to live astronaut sensors.
- The risk indices are project algorithms and have not been validated for clinical or flight use.
- Telemetry is primarily stored in memory during replay, with SQLite used for logging and queries.
- Ollama requires local compute and model storage.
- Microsoft Edge TTS and Gemini integrations require network access.
- The system should display stale-data status and service degradation clearly before being considered operationally reliable.

## Documentation

- [`documentation/PROJECT_MASTER_DOCUMENTATION.md`](documentation/PROJECT_MASTER_DOCUMENTATION.md)
- [`documentation/Astronaut_Health_JARVIS_System_Documentation.md`](documentation/Astronaut_Health_JARVIS_System_Documentation.md)
- [`documentation/NASA_Flight_Software_Architecture_Standard.md`](documentation/NASA_Flight_Software_Architecture_Standard.md)
- [`documentation/dataset_coverage_analysis.md`](documentation/dataset_coverage_analysis.md)

## License

MIT License. See [`LICENSE`](LICENSE).
