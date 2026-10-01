# Mission Control Main Screen: What Is Always Monitored

NASA Space Apps Challenge: Crew Health Monitoring Dashboard (Mission Control view)

**Labels**
- **Real**: supported by NASA or reliable scientific sources
- **Derived**: a dashboard metric built from real data
- **Proposed**: a new concept, not an existing NASA operational feature

---

## Must-Have Items

| # | Item | Short description | Type |
|---|------|-------------------|------|
| 1 | **Crew status tiles** | One tile per astronaut showing overall status: nominal, watch, attention or active medical event. | Derived |
| 2 | **Active medical events and alerts** | Ongoing symptom, injury or illness with severity and review status. The first thing a flight surgeon checks. | Real concept, derived display |
| 3 | **Deviation from personal baseline** | How far each crew member is from their own normal, not a population average. | Derived / Proposed |
| 4 | **Radiation** | Cumulative and mission dose per crew member against the 600 mSv career limit (NASA-STD-3001), current dose rate, and a solar particle event alert. | Real monitoring, derived alerting |
| 5 | **Cabin environment** | Pressure, O₂, CO₂, temperature, humidity, and fire/smoke alarms. | Real vehicle telemetry |
| 6 | **Sleep and fatigue status** | Recent sleep duration, sleep debt and workload per crew member as one indicator. | Real research area, derived indicator |
| 7 | **Vital sign summary** | Heart rate, respiratory rate, SpO₂ and temperature against baseline. Not continuous on real missions, so show the last-updated time. | Real measurements, availability varies |
| 8 | **Mission context strip** | Mission phase, elapsed time, EVA status and upcoming high-risk activities. | Real |
| 9 | **Communication delay and link status** | Current delay, signal status and blackout warnings. Shows how fast ground support can actually help. | Real constraint |
| 10 | **Medical resources summary** | Medication and supply levels, medical kit readiness and depletion warning. | Real concern |
| 11 | **"Action needed?" indicator** | One summary light: no action, watch, or intervention likely required. | Proposed |

---

## Innovative Extras (Proposed)

> **PROPOSED / CONCEPTUAL: NOT AN EXISTING NASA OPERATIONAL FEATURE**

- **Multi-signal early warning**: flags when several indicators drift together (for example sleep loss, workload and heart rate).
- **"Why this alert?" button**: explains which signals triggered an alert.
- **Communication-delay-aware medical mode**: shows what the crew may need to decide on their own when ground response is slow.

---

## Not on the Main Screen (Drill-Down Only)

- Vision / SANS data (OCT, optic disc edema, visual acuity)
- Bone and muscle trends
- Biomarkers and lab panels
- Raw ECG and imaging
- Per-organ radiation dose
- Detailed medical history

---

## Key Sources

- NASA Human Research Program / Human Research Roadmap
- NASA-STD-3001 (Office of the Chief Health and Medical Officer): career radiation limit of 600 mSv
- National Academies, *Space Radiation and Astronaut Health: Managing and Communicating Cancer Risks* (2021)
- NASA Evidence Report: Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)
- NASA Exploration Medical Capability (ExMC): Mars Medical System Concept of Operations

> Note: Exact alert thresholds and real console layouts are not fully public. Treat them as design assumptions, not NASA facts.
