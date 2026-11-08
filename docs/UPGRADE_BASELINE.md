# H.E.L.I.O.S — Upgrade Baseline Report (Phase 0 Audit)

**Date**: 2026-11-06  
**Auditor**: Antigravity Aerospace AI Pair-Programmer  
**Target Specification**: `HELIOS_ANTIGRAVITY_MASTER_PROMPT.md`  
**Execution Phase**: Phase 0 — Audit and Checkpoint

---

## 1. Current Architecture & Actual Entry Points

### 1.1 Backend (FastAPI / Python)
- **Primary Entry Point**: `backend/app/main.py`
  - Lifecycle: `lifespan` manager initializes `init_database()`, `BaselineManager()`, `LabAssayManager()`, `DecisionEngine()`, `VoiceEngine()`, and starts `TelemetryFeeder.start()`.
  - Protocols: HTTP REST endpoints (`/api/*`) and WebSocket broadcast endpoint (`/ws/telemetry` streaming at 10 Hz).
  - Runtime Environment: Python 3.14 on Linux/WSL (`wsl uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`).

### 1.2 Frontend (React 19 + TypeScript + Vite)
- **Primary Entry Point**: `frontend/src/main.tsx` $\rightarrow$ `frontend/src/App.tsx`
  - Bundler: Vite 8.3.5 with `@vitejs/plugin-react` and proxy config forwarding `/api` and `/ws` to `127.0.0.1:8000`.
  - State Sync: `useTelemetryStream` / `websocketService.ts` with fallback to `scenarioSimulator.ts` (offline nominal/drift simulation).
  - Cross-tab / Multi-monitor Sync: `BroadcastChannel('helios-telemetry')` and `localStorage` synchronization.

---

## 2. Existing Routes & Major Subsystems

| Route / View Identifier | Component File | Description & Subsystem Status |
| :--- | :--- | :--- |
| `/` (`HUD`) | `frontend/src/components/MainIndexDeck.tsx` | Spacecraft Cockpit HUD with dual-trace 90 FPS ECG Lead-II / SpO2 Plethysmograph waveforms, crew vital cards, ECLSS status bar, and active alerts. |
| `/telemetry/:slug` (`HEALTH_TELEMETRY`) | `frontend/src/components/HealthTelemetryView.tsx` | Deep clinical crew dossier with 119 authentic NASA OSDR lab assays (OSD-569 CBC, OSD-575 CMP/Immune/Cardiovascular), clinical reserve indices, device network status, and biomarker radar. |
| `/mcc` (`MCC`) | `frontend/src/components/MissionControlView.tsx` | Earth Mission Control Center (JSC Flight Surgeon workstation), speed-of-light radio delay calculator ($\tau = d/c$), DSN ground station tracking, shift handover logs, and crew trend correlation. |
| `/mcc/telemetry/:slug` (`MCC_TELEMETRY`) | `frontend/src/components/MissionControlView.tsx` | Ground station clinical drill-down for individual astronauts with latency mitigation and store-and-forward telemetry logs. |
| `/scanner` (`SCANNER`) | `frontend/src/components/HolographicBodyScanner.tsx` | Interactive 3D WebGL anatomical wireframe mannequin with multi-organ focus slices (Brain, Cardiac, Pulmonary, Renal, Vascular, Skeletal) and Cyan / Thermal / Tactical HUD shading. |
| `/suit-hud` (`SUIT_HUD`) | `frontend/src/components/suit-hud/SuitHudView.tsx` | First-person astronaut helmet visor EVA HUD with optical vignette, helmet parallax, planetary environments (ISS Exterior, Moon, Mars Surface), laser-etched xEMU serials, and tactical waypoints. |
| `ISS Deck` (`CABIN_3D`) | `frontend/src/components/cabin3d/Cabin3DView.tsx` | 3D Spacecraft cabin corridor navigation, cupola observation, and interactive wall-mounted avionics MFDs. |
| `DRAGON_DOCKING` | `frontend/src/components/docking/DragonDockingIntro.tsx` | Cinematic SpaceX Crew Dragon orbital docking sequencer with manual override controls. |

---

## 3. Cloud / External Network Dependencies Audit

| Component | File Path | External Target | Classification | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **Gemini Client** | `backend/app/ai/gemini_client.py` | `https://generativelanguage.googleapis.com/v1beta/models` | Optional Cloud Fallback | **Remove runtime dependency**: Default to local Ollama / deterministic flight templates. Fail closed locally. |
| **Voice Engine (Edge TTS)** | `backend/app/ai/voice_engine.py` | Microsoft Edge Neural TTS cloud service via websocket (`edge_tts.Communicate`) | Remote TTS Dependency | **Remove runtime dependency**: Replace with local offline TTS (Piper / local Web Audio SpeechSynthesis) and pre-recorded tones. |
| **Ollama Client** | `backend/app/ai/ollama_client.py` | `http://localhost:11434` | Local AI Runtime | **Retain & Harden**: Keep strictly local. When Ollama is offline or uninstalled, seamlessly use deterministic flight scripts. |
| **Web Audio Synthesizer** | `frontend/src/services/audioService.ts` | Local browser Web Audio API + SpeechSynthesis | Local-Only | **Retain**: 100% offline aerospace klaxon, chime, and beep audio oscillators. |

---

## 4. Current Voice Processing Pipeline

$$\text{User Interaction} \longrightarrow \text{Web Audio Context} \longrightarrow \text{Backend WS / API} \longrightarrow \text{Triage Inference} \longrightarrow \text{TTS / Web Audio} \longrightarrow \text{Speaker}$$

1. **Microphone / Input**: Currently browser-based speech input / typed prompt via `/api/voice/query`.
2. **VAD / STT**: Browser SpeechRecognition / manual audio trigger.
3. **Reasoning**:
   - Primary in code: `gemini_client.py` (if API key present) $\rightarrow$ `ollama_client.py` (if Ollama running) $\rightarrow$ `fallback_templates.py` (`FALLBACK_VOICE_SCRIPTS` deterministic flight rules).
4. **Response Formatting**: `enforce_two_sentences()` enforces maximum 2-sentence concise tactical brevity.
5. **Speech Synthesis (TTS)**:
   - Server-side: `edge_tts` (currently contacts remote Microsoft cloud endpoint).
   - Client-side: `window.speechSynthesis` and Web Audio API tone synthesizer in `audioService.ts`.
6. **Playback**: HTML5 Audio Blob or Web Audio oscillators.

---

## 5. Database Tables & Migration Architecture

- **Engine**: SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, `PRAGMA mmap_size = 268435456`).
- **File**: `data/astronaut_health.db` (and `backend/helios.db`).
- **Existing Tables** (`backend/app/db/models.py`):
  1. `telemetry_log`: High-frequency 10 Hz time-series log with personal vitals, lab assays, computational risk scores (QTC, EPI, ARF, TRM, RSI), and alert severity.
  2. `personal_baselines`: Astronaut baseline distributions (mean, std dev) for resting and EVA states.
  3. `proactive_alerts`: Audit log of all autonomous sentry alerts, trigger reasons, confidence scores, evidence JSON, and spoken text.
- **Migration Policy**: Additive schema migrations only via `init_database()` in `backend/app/db/database.py`.

---

## 6. Baseline Verification & Test Results

- **Frontend Production Build**:
  - Command: `npm run build` (via `cmd /c "npm run build"`)
  - Result: **SUCCESS** (2,476 modules transformed, 0 errors, gzip bundle 557 kB).
- **Backend Test Suite**:
  - Command: `python -m unittest discover -s backend/tests -p "test_*.py"`
  - Results: **91 tests ran, 90 PASSED, 1 transient lock error** (`test_scenario_switching` failed due to concurrent SQLite write while live feeder was active).
  - Benchmarked WAL throughput: **237,417 writes/sec** (4.2 ms for 1,000 rows).

---

## 7. High-Risk Files & Potential Regression Areas

1. `backend/app/ai/voice_engine.py`: Contains both local and cloud TTS paths (`edge_tts`). Must safely isolate local synthesis without breaking voice playback in the HUD.
2. `backend/app/streaming/telemetry_feeder.py`: High-frequency 10 Hz loop feeding all active WebSockets. Must maintain deterministic non-blocking execution.
3. `frontend/src/components/HealthTelemetryView.tsx`: Complex clinical rendering with 119 biomarkers. Must avoid UI layout shifts or false-alarm badge regressions.
4. `frontend/src/services/audioService.ts`: Core aerospace tone and voice playback engine. Must maintain audio queue sequentiality without overlapping tones.

---

## 8. Feature Gap Analysis (Prompt Requirements vs. Current Implementation)

| Master Prompt Module | Current Implementation Status | Gap / Required Upgrade |
| :--- | :--- | :--- |
| **A. Astronaut Self-Assessment** | Missing / Placeholder | Build `/self-assessment` check-in for sleep, fatigue, mood, pain map, and manual vitals saved to SQLite. |
| **B. Personal Astronaut Health Memory** | Partially in SQLite (`telemetry_log`) | Build longitudinal health timeline view comparing personal baselines with export/correction controls. |
| **C. Clinical Explanation Engine** | Implemented in `clinicalPrioritization.ts` | Formalize 5-question structured explanation (`What happened?`, `Why flagged?`, `Evidence`, `Action`, `Reassessment`). |
| **D. Five-Hazards Intelligence** | Retired | Retired from UI to streamline mission workflow. |
| **E. Educational POCUS Learning Station** | Retired | Retired from UI to focus on core autonomous telemedicine. |
| **F. Mission Routine and Adherence** | Basic timers in Cockpit HUD | Build `/mission-routine` with hydration, ARED exercise logging, and cognitive PVT drill tracking. |
| **G. Multi-Mission Environment** | Partial in Suit HUD (ISS/Moon/Mars) | Provide unified mission context selector configuring gravity, radiation, and light delay assumptions. |
| **H. ISS Communication Resilience** | Speed-of-light delay only | Implement realistic decoupled link degradation based on `iss_contact.md` (TDRS, S-band, Ku-band independent fault injection + store-and-forward queue). |
| **I. Predictive Trend Analytics** | 2-hour trend canvas in MCC | Add statistical moving averages, baseline deviation trajectories, and data-quality warning labels. |
| **J. Zero-Cloud / Fully Local Stack** | Ollama present, but Edge TTS & Gemini referenced | Cut all remote cloud calls; ensure 100% offline local execution with zero internet access. |

---

## 9. Implementation Sequence

- **Phase 0 (Completed)**: Baseline audit and checkpoint.
- **Phase 1**: Cut external cloud dependencies (`gemini_client` and remote `edge_tts`), fallback strictly to deterministic local templates, verify offline startup.
- **Phase 2**: Voice latency instrumentation and local audio pipeline hardening.
- **Phase 3**: Safety invariants & structured explanation contract.
- **Phase 4**: Health intelligence modules (`/self-assessment`, Personal Health Memory, `/mission-routine`).
- **Phase 5**: Mission & Communications Resilience Simulator (`iss_contact.md` multi-link model & store-and-forward queue).
- **Phase 6**: Statistical trend analytics & long-range telemetry.
- **Phase 7**: Final UI polish, performance verification, and regression test gate.

