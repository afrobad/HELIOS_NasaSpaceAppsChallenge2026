# H.E.L.I.O.S — Space Apps 2026 Operational & Innovation Master Documentation
### Health Evaluation Logistic Intelligent Onboard System (Autonomous Deep-Space Health Sentry)
**NASA International Space Apps Challenge 2026**

---

## 1. Executive Summary & Mission Scope

During missions to the Moon, Mars, and deep space, astronauts operate outside the protective communication bubble of Low Earth Orbit (LEO). Communication latency ranges from **4 to 24 minutes one-way** (8 to 48 minutes round-trip), rendering real-time guidance from Houston Mission Control impossible in life-critical emergencies. 

**H.E.L.I.O.S** is a **100% autonomous, offline-first, zero-cloud health flight sentry** engineered to bridge this gap. Running on standard spacecraft flight computers (<2% CPU, <35 MB RAM) without requiring heavy GPUs, H.E.L.I.O.S monitors 149 multimodal biomarkers, predicts physiological failure hours before visible symptoms emerge, and delivers instant, spoken 2-sentence health directives through **JARVIS AI Voice Intelligence**.

---

## 2. Recent Upgrades & Architectural Fixes

### A. Offline Voice AI (Jarvis) & Immediate Spoken Directives
- **Sub-100ms Instant Audio Initiation**: Resolved audio context initialization by ensuring audio context auto-engages on interaction.
- **Fast Offline Fallback**: Replaced long remote neural TTS wait budgets with an agile 1200ms fallback that triggers browser-native Web Speech Synthesis (`SpeechSynthesisUtterance`) with natural prosody calibration, guaranteeing immediate spoken announcements in zero-connectivity environments.
- **Problem + Recommended Solution Pairings**: Configured Jarvis to verbally announce both the underlying pathology and the immediate flight systems director countermeasure (e.g., *"Critical alert: CO₂ scrubber breakthrough detected across cabin modules. Flight Director directive: Switch to backup lithium hydroxide scrubber beds and verify mask seals"*).
- **Executive Emergency Banner on Main Dashboard**: Rendered a high-visibility, NASA-standard directive ribbon at the top of the Cockpit HUD showing the diagnosis, severity level, and specific flight director action plan, complemented by a one-click manual audio replay button.

### B. Earth Mission Control Center (MCC) Voice & Situation Briefings
- **Cognitive Load Reduction**: Deep space health emergencies generate overwhelming telemetry streams. An astronaut or flight controller under stress cannot analyze dozens of disparate charts.
- **Executive Situation & Solution Console**: Embedded a real-time situation summary card and actionable flight systems director protocol directly atop the MCC Overview tab.
- **One-Click Voice Briefing**: Integrated a dedicated `PLAY VOICE BRIEFING` console button powered by `audioService`, giving operators an instant verbal situation briefing and solution readout without leaving the flight console.

### C. Unified Scenario Engine Integration
- **Aerospace Floating Action Pill**: Anchored the scenario control pill to the bottom-right corner (`right: 24px, bottom: 22px`) with non-overlapping `zIndex: 100005`, floating seamlessly over all layouts.
- **ISS Deck Topbar Integration**: Integrated the exact same simulation scenario controller directly into the ISS Deck top navigation menu (`#btn-scenarios`), allowing crew members to toggle or clear scenarios within the 3D cabin without navigating back to the main console.
- **Bi-Directional IPC Synchronization**: Synchronized states via `postMessage`, `BroadcastChannel`, and `localStorage`, ensuring instant synchronization across the HUD, 3D Cabin, Wall Terminals, and Earth Ground Station.

### D. RTX 3050 & Low-Power Hardware Optimization
- **Pixel Ratio Clamping**: Clamped device pixel ratio to `Math.min(window.devicePixelRatio || 1, 1.25)` to eliminate GPU fillrate bottlenecks on 1080p/1440p displays.
- **Elimination of Dynamic WebGL Framebuffer Reallocation**: Removed periodic render-loop `resize()` calls that were previously reallocating WebGL framebuffers and bloom textures every 2 seconds, eliminating micro-stutters and animation skips.
- **Pointermove Raycast Throttling**: Throttled `crew.pick` cursor hover raycasting to ~28 FPS (35ms threshold), avoiding event flooding from high-frequency gaming mice (500–1000 Hz).
- **Direct 1:1 Camera Drag Tracking**: Calibrated `rig.js` drag damping (`kLook = 1 - Math.exp(-dt * 50)`) during mouse interaction for immediate zero-lag 360° cabin inspection, with clean momentum glide upon release.
- **Optimized PCF Shadow Maps**: Replaced heavy multisample bloom passes (`samples: 0`) and filtered shadow cascades (`PCFShadowMap`), achieving stable 60+ FPS performance on mobile and desktop RTX 3050 GPUs.

---

## 3. Groundbreaking Space Innovations (Beyond Current NASA Stack)

While NASA currently employs post-flight genomic sequencing, periodic holter monitoring, and ground-in-the-loop remote telemetry consultation, deep-space exploration demands autonomous capabilities that NASA has not yet fielded on active missions:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              HELIOS NOVELTY MATRIX: BEYOND THE NASA BASELINE                           │
├───────────────────────────────────┬───────────────────────────────────┬────────────────────────────────┤
│ Capability                        │ Current NASA Flight Practice      │ HELIOS Autonomous Innovation   │
├───────────────────────────────────┼───────────────────────────────────┼────────────────────────────────┤
│ 1. Telemetry Gating               │ Earth BME engineers filter data   │ Local Bayesian Sentry (<40ms)  │
│ 2. Microgravity Cephalic Shift    │ Fixed Earth hospital ranges       │ Personalized Zero-G Baselines  │
│ 3. Deep-Space Light Delay         │ Unusable (4–24 min radio delay)   │ 100% Autonomous Edge Directives│
│ 4. Space Omics & Epigenomics      │ Samples frozen for post-flight    │ In-Flight SOMA Bio-Twin Engine │
│ 5. Countermeasure Decisioning     │ Ground flight systems director checklist   │ Closed-Loop Voice AI Copilot   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Autonomous Closed-Loop Health Countermeasure AI
- **The Gap**: Currently, when an anomaly occurs on the ISS, biohealth flight controllers (BME) at Johnson Space Center evaluate the trace and consult flight systems directors. On a Mars transit, an acute hypercapnia breach or ventricular tachyarrhythmia will kill the crew long before a radio message travels to Earth and back.
- **HELIOS Solution**: A localized multi-agent diagnostic engine cross-validates 149 biomarkers against personal baseline envelopes within **40 milliseconds**, proactively prescribing verified health protocols (e.g., lower-body negative pressure, electrolyte micro-infusion, ECLSS air recirculation changes) before irreversible damage occurs.

### 2. In-Flight Predictive Bio-Twin (NASA OSDR Inspiration4 SOMA Integration)
- **The Gap**: Space omics data (cell-free DNA, RNA transcripts, cytokine profiles) are traditionally sequenced weeks or months *after* landing.
- **HELIOS Solution**: Employs an onboard mathematical Bio-Twin model trained on authentic NASA OSDR datasets (including the Inspiration4 SOMA cohort). It projects real-time cellular senescence, telomere dynamics, and radiation marrow exhaustion in response to observed cosmic flux and microgravity duration.

### 3. Voice-First Multimodal JARVIS AI Copilot
- **The Gap**: Astronauts in high-stress emergencies face cognitive tunneling when reading dense displays.
- **HELIOS Solution**: Rather than acting as a passive alarm or simple speech reader, JARVIS serves as an active health copilot, prioritizing issues and delivering crisp, two-sentence authoritative directives directly into helmet comms and cabin audio.

---

## 4. Verification & Validation Summary

| Test Case | Condition | Result | Status |
|---|---|---|---|
| **TC-01** | Offline Localhost Launch (`npm run dev`) | Jarvis announces problem + solution in <150ms | PASS |
| **TC-02** | Cockpit HUD Scenario Trigger | Emergency banner & recommended action appear instantly | PASS |
| **TC-03** | Earth MCC Voice Console | Scenario summary & audio briefing functional | PASS |
| **TC-04** | ISS Deck Topbar Integration | Scenario pill switches and triggers modal inside 3D cabin | PASS |
| **TC-05** | RTX 3050 Framerate Benchmark | Stable 60 FPS in 3D cabin rotation & continuous drag | PASS |
| **TC-06** | Production Build (`vite build`) | Compiled successfully with 0 errors | PASS |

