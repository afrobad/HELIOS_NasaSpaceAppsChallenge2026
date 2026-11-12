# H.E.L.I.O.S. - Executive Project Summary & Feature Master

### Health Evaluation & Logistics Intelligence Onboard System
**NASA International Space Apps Challenge 2026** | **Team:** Team Aero Vitals  
**Track:** Create Health Monitoring Software for Astronauts on Space Missions

---

## 1. The Challenge: Deep-Space Isolation & The Speed-of-Light Barrier
During interplanetary missions to the Moon and Mars, humanity faces an inescapable physical barrier: radio signals take between 4 and 24 minutes one-way, creating an unavoidable round-trip communication delay of up to 48 minutes. In deep space:
* **Zero Real-Time Earth Support:** If cabin pressure drops, toxic gases leak, or an acute cardiac arrhythmia occurs, waiting 48 minutes for Earth ground control is fatal.
* **Severe Environmental Hazards:** Astronauts endure intense cosmic radiation and Solar Particle Events (SPE), continuous microgravity cephalic fluid shift (~2L upward) causing Spaceflight-Associated Neuro-ocular Syndrome (SANS), bone mineral loss (-1.5% per month), and closed-cabin ECLSS atmospheric shifts.

---

## 2. Our Solution: What We Built
**H.E.L.I.O.S.** (Health Evaluation & Logistics Intelligence Onboard System) is an autonomous, 100% offline-first health monitoring and decision-support platform built directly into the spacecraft flight computer. 

Instead of forcing astronauts to manually decipher dozens of disconnected sensor feeds, HELIOS transforms raw high-rate telemetry into an intuitive, spatial, and actionable picture of crew well-being. It operates with zero internet and zero cloud dependence, detecting physiological anomalies before overt symptoms appear and providing hands-free, spoken countermeasure steps in milliseconds.

---

## 3. NASA Scientific Datasets & Standards Grounding
HELIOS does not use arbitrary thresholds. Every baseline distribution, z-score boundary, and laboratory assay reference is grounded in peer-reviewed spaceflight data:
* **NASA OSDR OSD-575 (Inspiration4 / SOMA):** Longitudinal multi-omics profiling calibrating 119 point-of-care laboratory biomarkers, including hematocrit, serum potassium, troponin-I, ferritin, and immune cytokines.
* **NASA OSDR OSD-569:** Spaceflight longitudinal epigenomic and hematological data used for modeling cephalic fluid shifts and immune alterations.
* **NASA OSDR OSD-379 & 194:** Calibrated human and murine skeletal demineralization rates (-1.5% loss/month) and ARED resistance exercise countermeasure curves.
* **NASA-STD-3001 (Vol 1 & 2):** Crew Health and Habitability flight standards governing Lead-II cardiovascular limits, hypoxemia boundaries (<90% SpO2), and ECLSS atmospheric safety envelopes (101.3 kPa total pressure, PCO2 <3.0 mmHg, O2 fraction 20.9%).

---

## 4. Key Subsystems & Flight Features

### Feature 1: Unified Spacecraft Flight Command Deck (`/`)
Master cockpit health interface streaming live 10 Hz vitals for all four astronauts (heart rate, SpO2, respiration, core temperature, blood pressure). Includes a hardware-decoupled 60-90 FPS Lead-II ECG and PPG canvas engine with zero DOM paint overhead, live cabin ECLSS atmospheric bars, and color-coded crew state cards.

### Feature 2: Autonomous Helix-Ai Analyst & Situation Normalizer
Sub-second telemetry reasoning engine (<400 ms) categorizing anomaly severity into four tiers: `NOMINAL`, `WATCH`, `WARNING`, and `CRITICAL`. Helix-Ai Analyst synthesizes spoken voice directives with authentic NASA Quindar tones (2525 Hz / 2475 Hz) to guide crews without manual browsing. Includes a 1-click **SOLVED** normalizer that harmonically resets alarms once countermeasures take effect.

### Feature 3: Interactive 3D Holographic Digital Bio-Twin (`/scanner`)
Full 360-degree anatomical WebGL avatar with three tactical rendering modes (Cyan Bio-Holo, Thermal IR Heatmap, and Amber Tactical HUD). Allows interactive inspection of organ systems vulnerable to spaceflight: Ocular & Brain (SANS / ICP), Heart, Lungs, Renal hydration, and Skeletal demineralization.

### Feature 4: Deep Astronaut Health & Multi-Omics Telemetry (`/telemetry`)
Comprehensive diagnostic dashboard tracking 149 multimodal parameters and 119 laboratory assays organized across 10 physiological categories, fully cross-referenced against NASA OSDR baseline distributions.

### Feature 5: First-Person Spacesuit Helmet AR Visor (Suit HUD · `/suit-hud`)
Zero-G optical helmet simulation for spacewalks (EVA). Projects real-time vitals, suit oxygen reserves, suit pressure, radiation dosimeters, and tactical waypoint compass navigation directly onto the helmet glass with head-tracking parallax.

### Feature 6: Photorealistic 3D ISS Orbital Flight Deck (`/iss`)
Full-scale 3D twin of the International Space Station and 7-window Cupola observation dome. Tracks real-time orbital Earth nadir motion (27,600 km/h) with interactive bulkhead monitors projecting live telemetry.

### Feature 7: Earth Mission Control Center & Radio Delay Simulator (`/mcc`)
Physics-based speed-of-light radio delay engine (LEO 0.0s, Moon 1.3s, Mars 4.3m to 24.0m). Shows ground flight directors the lagged packet queue, proving why Earth-dependent consultation fails and why HELIOS onboard autonomy is vital.

### Feature 8: Cognitive Self-Assessment & Routine (`/self-check`, `/mission-routine`)
Daily crew symptom logging and an interactive NASA Psychomotor Vigilance Task (PVT) measuring millisecond reaction times to detect mental fatigue and sleep loss, paired with daily ARED exercise countermeasure tracking.

### Feature 9: Dynamic Emergency Spaceflight Mission Simulator
Interactive anomaly injector demonstrating the end-to-end telemetry pipeline across crisis scenarios: Solar Particle Radiation Storms (85 mGy/h), Toxic ECLSS Cabin Atmosphere, and Acute Arrhythmias.

### Feature 10: Dual-Use Terrestrial Architecture
Extends space technology to high-risk Earth applications: Tactical Firefighter in-helmet AR HUDs (monitoring vitals and CO in dense smoke where radios fail) and offline AI health support for remote, austere clinics.

---

## 5. Core Takeaway
HELIOS does not replace astronauts or flight directors - it equips them with **Helix-Ai Analyst**, an intelligent decision-support sentry that turns raw telemetry into actionable situational awareness, protecting every heartbeat from Earth's orbit to Mars.
