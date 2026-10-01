# H.E.L.I.O.S. Simulation and Scenario Logic Audit Report

**Repository:** `zihaduzzamaan/H.E.L.I.O.S`  
**Audit date:** 2026-10-01  
**Scope:** Scenario simulation, telemetry transformation, biomarker calculations, alert-priority logic, and NASA/spaceflight context.

> **Safety note:** H.E.L.I.O.S. is a demonstration and research prototype. It is not a certified medical device, flight-qualified software system, or validated clinical decision-support tool. The calculations below must not be used for real medical or mission decisions.

## 1. Executive summary

The simulation architecture is coherent for a demonstration: the backend replays a NASA OSDR-derived telemetry stream, modifies selected values when a scenario is activated, evaluates the modified packet, logs it to SQLite, and broadcasts it to the React HUD through WebSockets.

The project has a useful separation between:

- scenario generation in `backend/app/streaming/telemetry_feeder.py`;
- risk evaluation in `backend/app/core/sentry_matrix.py`;
- index calculations in `backend/app/core/computational_biomarkers.py`;
- activity context in `backend/app/core/activity_gating.py`; and
- NASA-derived baselines in `data/nasa_astronaut_baselines.json`.

### Overall finding

**Suitable for an educational/demo simulation, but not yet clinically or operationally validated.**

The most important implementation findings are:

1. `SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION` changes no physiological or laboratory value; it only changes the scenario label.
2. CRP is loaded and changed by several scenarios but is not used by `SentryMatrixEngine` or the biomarker calculations.
3. `sleep_score` is loaded and baseline data exists, but it does not participate in alerting.
4. Several scenarios use only one or two surrogate signals and therefore do not model the underlying condition completely.
5. Radiation dose is calculated from a fixed four-hour exposure assumption, while the scenario also supplies a hard-coded dose; these values can disagree substantially.
6. The code uses project-specific heuristic scores. They should not be described as NASA-validated clinical algorithms.

## 2. Runtime simulation flow

### 2.1 Data flow

```text
astronaut_telemetry_stream.csv
        |
        v
TelemetryFeeder.load_dataset()
        |
        v
jump_to_scenario() selects a playback index
        |
        v
_apply_scenario_telemetry() modifies a packet
        |
        v
SentryMatrixEngine.evaluate_state()
        |
        +--> EPI: inflammatory/sepsis heuristic
        +--> ARF: potassium/QTc heuristic
        +--> TRM: thrombosis heuristic
        +--> RSI: radiation heuristic
        +--> z-score and CO2 checks
        |
        v
SQLite logging + WebSocket telemetry + optional voice alert
```

### 2.2 Scenario activation

`SCENARIO_OFFSETS` maps scenario keys to playback offsets. Most scenarios use offsets inside the first 1,200 baseline ticks, then overwrite selected values dynamically. This is a reasonable way to create instant demonstrations without maintaining a separate scenario dataset.

However, the design has important limitations:

- The offset is not a physiological onset model; it is mainly a convenient starting point.
- Most changes are step functions rather than time-dependent progressions.
- Scenario values can be overwritten by live recalculation in `SentryMatrixEngine`.
- The scenario label may say one thing while the actual calculated diagnosis is another.
- There is no formal scenario schema defining expected inputs, onset time, duration, severity, or recovery.

## 3. Alert evaluation order

`SentryMatrixEngine.evaluate_state()` evaluates signals in this order:

1. Critical SpO₂ and cabin CO₂ overrides
2. Activity/workout gating
3. Arrhythmia calculation
4. Early sepsis calculation
5. Thrombosis calculation
6. Radiation calculation
7. Workout nominal return
8. Warning thresholds
9. HR/HRV z-score deviations
10. Informational laboratory deviations
11. Nominal state

This ordering is sensible for a demo because immediate oxygen and environmental hazards receive priority. It also creates a major design constraint: **the first matching return ends evaluation**. A packet can contain multiple serious findings, but the alert may mention only the first one.

### Important ordering issue

During `WORKOUT`, the code can return `NOMINAL` after the arrhythmia check but before EPI, TRM, RSI, and z-score checks are completed. This may hide non-cardiac abnormalities during exercise. Workout gating should suppress only exercise-related tachycardia, not all other health signals.

## 4. Scenario-by-scenario audit

### Scenario 1 — CO₂ scrubber breakthrough

**Implementation:**

- `cabin_co2 = 4.25 mmHg`
- heart rate is raised to at least `82 bpm`
- SpO₂ is capped at `96.2%`

**Expected result:** Critical environmental CO₂ alert because the configured critical threshold is `4.0 mmHg`.

**Assessment:** **Partially correct for a demonstration.** Elevated CO₂ and compensatory cardiovascular stress are plausible. However, this is not a complete ECLSS failure model.

**Missing or improvable signals:**

- respiratory rate;
- inspired oxygen fraction;
- cabin pressure;
- acid-base or bicarbonate response;
- duration and rate of CO₂ accumulation;
- crew-wide exposure timing.

**NASA context:** Spacecraft atmosphere monitoring is part of NASA environmental control and life-support operations. The exact alarm limits depend on vehicle, operational mode, sensor location, and applicable flight rules; the project thresholds must therefore be labeled as simulation thresholds rather than universal NASA limits.

### Scenario 2 — Slow decompression hypoxia

**Implementation:**

- `SpO₂ = 88.5%`
- `heart_rate = 118 bpm`
- `HRV = 24 ms`

**Expected result:** Critical hypoxia alert because SpO₂ is below the project threshold of 90%.

**Assessment:** **Good demonstration logic.** The direction of change is plausible: reduced oxygenation, compensatory tachycardia, and autonomic stress.

**Missing or improvable signals:**

- cabin pressure and O₂ partial pressure;
- respiratory rate and end-tidal CO₂;
- a gradual pressure/SpO₂ curve;
- duration-dependent loss-of-consciousness risk;
- explicit decompression rate.

**NASA context:** NASA human-systems standards address cabin atmosphere, pressure, oxygen, and crew survivability. SpO₂ alone cannot distinguish decompression, ventilation failure, sensor error, or pulmonary disease.

### Scenario 3 — Solar radiation storm

**Implementation:**

- radiation flux `85 mGy/h`;
- hard-coded dose `0.75 Gy`;
- lymphocytes `0.85 k/uL`;
- hard-coded RSI `1.25`;
- heart rate at least `84 bpm`.

**Assessment:** **Conceptually useful but mathematically inconsistent.** The system recalculates RSI and dose from lymphocyte count and a fixed `elapsed_exposure_hours = 4.0`. The recalculated dose may not match the hard-coded `0.75 Gy`.

The dose formula is a project heuristic:

```text
dose = -ln(lymphocyte_ratio) / (k * exposure_hours)
```

It must not be presented as a validated operational radiation-dose estimator without calibration against an appropriate radiation-biology dataset.

**Improvements:**

- store exposure duration and dose-rate history in the packet;
- integrate the dose over time rather than replacing it with a fixed value;
- use separate physical dosimetry and biological-effect channels;
- distinguish SPE, galactic cosmic radiation, and accumulated mission dose;
- validate thresholds against NASA radiation-protection guidance and radiobiology experts.

**NASA context:** NASA radiation protection distinguishes acute solar particle events from chronic galactic cosmic radiation. Flux, energy spectrum, shielding, tissue dose, dose rate, and exposure duration all matter; a single flux number is insufficient.

### Scenario 4 — Ammonia coolant leak

**Implementation:**

- `SpO₂ = 89.5%`
- heart rate `132 bpm`
- HRV `18 ms`
- IL-6 `28 pg/mL`
- core temperature `37.4°C`

**Expected result:** Critical hypoxia alert.

**Assessment:** **Reasonable emergency demonstration, but the causal model is oversimplified.** Ammonia exposure is primarily a toxic inhalation and chemical-irritation problem. SpO₂ may remain deceptively normal in some inhalation injuries, so forcing hypoxemia is not always physiologically correct.

**Improvements:** Add an independent toxic-exposure state, respiratory rate, airway/irritation findings, exposure concentration, cabin location, and time since exposure. Do not use IL-6 or temperature as immediate primary indicators of an acute leak.

**NASA context:** Spacecraft ammonia is associated with external thermal-control systems and contamination hazards. The scenario should distinguish an external leak, cabin intrusion, suit contamination, and confirmed crew exposure.

### Scenario 5 — Electrical fire smolder

**Implementation:**

- SpO₂ `93.5%`
- heart rate `108 bpm`
- HRV `16 ms`
- CRP `8.5`

**Assessment:** **Incomplete and contains an integration gap.** Smoke/fire scenarios should prioritize carbon monoxide, carbon dioxide, particulate concentration, oxygen concentration, temperature, and cabin visibility. CRP is not an immediate fire-detection biomarker and is never evaluated by the alert engine.

**Improvements:** Add CO exposure, particulate load, temperature, smoke density, fire location, and time-to-containment. Treat CRP as a delayed inflammatory marker, not an immediate smoke alarm.

### Scenario 6 — Hypokalemia and arrhythmia

**Implementation:**

- potassium `2.95 mmol/L`;
- hard-coded QTc `492 ms`;
- hard-coded ARF `1.75`;
- heart rate `78 bpm`.

**Assessment:** **Strongest scenario conceptually, but hard-coded and recalculated values may disagree.** `SentryMatrixEngine` recalculates ARF and QTc from heart rate and potassium, then keeps the maximum of calculated and supplied values. This can produce a result that is not reproducible from the displayed input values.

**Improvements:**

- use measured QT and RR intervals if available;
- calculate QTc once and expose the formula inputs;
- remove or clearly label hard-coded derived values;
- include magnesium and calcium, which also affect repolarization;
- distinguish a risk score from a diagnosis of arrhythmia.

**NASA context:** Electrolyte balance and cardiovascular adaptation are recognized human-spaceflight concerns, but the project thresholds are heuristic and require clinical validation.

### Scenario 7 — Venous thrombosis risk

**Implementation:**

- hematocrit `52.5%`;
- platelets `385 k/uL`;
- IL-6 `18.5 pg/mL`;
- hard-coded TRM `2.35`.

**Assessment:** **Good direction, incomplete model.** Hct, platelets, inflammation, and oxygenation are reasonable surrogate inputs, but the project TRM is not a validated NASA thrombosis score. It also does not include venous-flow imaging, fibrinogen, D-dimer, clotting factors, or actual vessel findings.

**Improvements:** Add fibrinogen and other available coagulation markers, use longitudinal trends, and clearly label the result as a screening heuristic.

**NASA context:** NASA-supported research has documented internal-jugular-vein thrombosis and altered venous flow in some astronauts. The evidence supports monitoring and investigation, not a simple deterministic diagnosis from four variables.

### Scenario 8 — Cardiovascular deconditioning

**Implementation:**

- heart rate `98 bpm`;
- HRV `18 ms`;
- hematocrit `36%`.

**Assessment:** **Partially implemented.** These values represent cardiovascular strain and possible anemia/volume effects, but the scenario does not model the underlying longitudinal process.

**Improvements:** Add exercise capacity, orthostatic response, stroke-volume or cardiac-output proxy, fluid status, recovery time, and hemoglobin/RBC indices. Do not reduce SpO₂ automatically: deconditioning does not necessarily cause arterial oxygen desaturation.

**NASA context:** Cardiovascular deconditioning, fluid shifts, orthostatic intolerance, and exercise countermeasures are established spaceflight concerns. Reduced hematocrit should be described as a possible contributor, not proof of deconditioning.

### Scenario 9 — Coronary microvascular stress

**Implementation:**

- heart rate `96 bpm`;
- CRP `6.8`;
- potassium `3.6 mmol/L`;
- QTc `458 ms`.

**Assessment:** **Useful composite stress demo, but the name overstates what the telemetry proves.** These signals support cardiac-risk monitoring, not a diagnosis of coronary microvascular disease. CRP is again ignored by the calculation engine.

**Improvements:** Rename it to a broader “cardiovascular stress” scenario unless perfusion or endothelial measurements are added. Include exertion state, blood pressure, symptoms, ECG features, troponin, or a clearly defined surrogate model.

### Scenario 10 — Presymptomatic sepsis

**Implementation:**

- IL-6 `125 pg/mL`;
- WBC `14.5 k/uL`;
- CRP `16.5`;
- temperature `37.8°C`;
- hard-coded EPI `1.65`.

**Assessment:** **Good demonstration concept, but EPI can be recalculated to a different value.** The engine computes EPI using IL-6, WBC, and HRV; CRP and temperature are not part of the formula. Because the code keeps the maximum of calculated and supplied EPI, the displayed score can depend on hidden hard-coded values.

**Improvements:** Use a single reproducible calculation, add CRP only after defining a validated weighting, and distinguish “inflammation risk” from sepsis. Sepsis requires clinical context and cannot be diagnosed from these four values alone.

**NASA context:** NASA research has documented altered immunity and latent viral reactivation during spaceflight. That supports monitoring immune changes, but it does not validate this EPI as a sepsis predictor.

### Scenario 11 — Latent virus reactivation

**Implementation:**

- IL-6 `22 pg/mL`;
- lymphocytes `1.4 k/uL`;
- heart rate `78 bpm`;
- hard-coded EPI `0.95`.

**Assessment:** **Reasonable early-warning concept, but not a virus detector.** IL-6 and lymphocyte count are nonspecific. There is no viral load, PCR, antibody, or virus-specific signal.

**Improvements:** Add a separate viral-reactivation index using available cytokines such as IFN-γ and relevant clinical/laboratory evidence. Label the current result “immune dysregulation risk,” not confirmed viral reactivation.

**NASA context:** NASA immunology research has reported latent herpesvirus reactivation and immune changes in astronauts. The project should cite the underlying study and avoid claiming that a nonspecific cytokine pattern identifies a particular virus.

### Scenario 12 — Cytokine release storm

**Implementation:**

- IL-6 `195 pg/mL`;
- WBC `16.8 k/uL`;
- CRP `24`;
- temperature `38.9°C`;
- heart rate `126 bpm`;
- hard-coded EPI `1.95`.

**Assessment:** **Strong demonstration of severe systemic inflammation, but not a validated cytokine-release syndrome model.** The alert logic still ignores CRP and temperature in EPI, and there is no hypotension, oxygen-delivery, organ-function, lactate, or renal/hepatic signal.

**Improvements:** Add blood pressure, perfusion, lactate, renal function, liver function, oxygen requirement, and a defined severity rubric. Use “severe systemic inflammatory state” unless the clinical syndrome is formally defined.

### Scenario 13 — Radiation marrow exhaustion

**Implementation:**

- lymphocytes `0.52 k/uL`;
- WBC `2.4 k/uL`;
- dose `0.95 Gy`;
- RSI `1.45`.

**Assessment:** **Good direction, but the label and timing need clarification.** Marrow suppression is a time-dependent consequence. A single packet cannot represent the difference between immediate post-exposure changes and later marrow failure.

**Improvements:** Add neutrophils, platelets, hemoglobin, reticulocytes, exposure time, and a multi-day trajectory. Ensure that the biological dose estimate and hard-coded dose agree.

**NASA context:** NASA radiation protection addresses acute and career exposure risks. Acute radiation effects depend on dose, dose rate, radiation quality, shielding, and time; a lymphocyte value alone is insufficient for dose reconstruction.

### Scenario 14 — Nephrolithiasis

**Implementation:**

- heart rate `88 bpm`;
- HRV `28 ms`.

**Assessment:** **Under-modeled.** These are nonspecific pain/stress signals and do not identify a kidney stone.

**Improvements:** Add fluid balance, urine volume, urinary calcium/oxalate proxies, creatinine, BUN, sodium, flank-pain symptom input, and infection indicators. If those data are unavailable, rename it “renal colic/pain stress simulation.”

**NASA context:** Spaceflight-associated fluid shifts, dehydration, and bone-mineral changes can influence renal-stone risk. A stone-risk model needs renal and metabolic variables rather than heart rate alone.

### Scenario 15 — Intravascular dehydration

**Implementation:**

- hematocrit `52%`;
- heart rate `92 bpm`;
- HRV `22 ms`.

**Assessment:** **Reasonable first approximation.** Hemoconcentration and compensatory tachycardia are plausible, but hematocrit alone cannot estimate circulating volume reliably.

**Improvements:** Add sodium, BUN/creatinine ratio, urine output, body mass trend, blood pressure, orthostatic response, and fluid intake. Add a time-dependent recovery model after hydration.

**NASA context:** Spaceflight causes major fluid redistribution and adaptation. The simulation should distinguish initial headward fluid shift from later hypovolemia and dehydration.

### Scenario 16 — Hepatic metabolic dysfunction

**Implementation:**

```python
packet["scenario_phase"] = "SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION"
```

**Assessment:** **Not implemented.** No liver or metabolic value changes. The scenario will usually be evaluated as nominal unless the underlying baseline already contains an unrelated abnormality.

**Required improvement:** Add explicit dataset fields and calculations for ALT, AST, bilirubin, albumin, glucose, alkaline phosphatase, and possibly ammonia or INR. Until those fields exist, use a limited and honest name such as “metabolic stress placeholder.”

### Scenario 17 — Spaceflight-associated neuro-ocular syndrome (SANS)

**Implementation:**

- cabin CO₂ `3.6 mmHg`;
- platelets `290 k/uL`.

**Assessment:** **Weak proxy model.** Elevated CO₂ may be relevant to intracranial-pressure and neuro-ocular risk, but platelet count is not a direct SANS marker. No visual, ocular, neurological, or fluid-shift signal is present.

**Improvements:** Add visual acuity, refractive shift, optic-disc/retinal findings, intraocular-pressure proxy, headache, body-fluid-shift indicators, and longitudinal exposure. Remove platelets unless a documented hypothesis links them to the model.

**NASA context:** SANS is a NASA Human Research Program risk involving vision changes and ocular findings during spaceflight. Its mechanism is multifactorial and remains an active research area; it should not be reduced to CO₂ plus platelets.

### Scenario 18 — Circadian fatigue drift

**Implementation:**

- `sleep_score = 42`;
- heart rate increases by `14 bpm`;
- HRV becomes `22 ms`.

**Assessment:** **Good initial concept, incomplete alert integration.** The repository contains sleep baselines, but `sleep_score` is not evaluated by `SentryMatrixEngine`. Consequently, the scenario's principal signal does not directly trigger an alert.

**Improvements:**

- calculate sleep-score z-scores against the astronaut's state baseline;
- add sleep duration, circadian phase, reaction time, and workload if available;
- use fatigue as a risk modifier rather than an automatic disease diagnosis;
- add trend and recovery logic;
- optionally model modest inflammatory changes, but document them as assumptions.

**NASA context:** NASA identifies sleep, circadian rhythm, fatigue, and performance as important human-spaceflight risks. A sleep score is useful for operational risk management but is not itself a medical diagnosis.

## 5. Biomarker calculation audit

### 5.1 EPI — Early Sepsis/Inflammation Index

**Code:** `calculate_early_sepsis_index()`

```text
IL-6 score = clamp((IL-6 - 8) / 30, 0, 3)
WBC score  = clamp((WBC - 7) / 2.5, 0, 2.5)
HRV decay  = max(0, (baseline HRV - current HRV) / baseline HRV)
EPI        = 0.45*IL-6 + 0.30*WBC + 0.25*HRV-decay*2
```

**Good:** Combines immune and autonomic information and uses personal HRV baselines.

**Problems:**

- weights are project choices, not validated clinical coefficients;
- CRP, temperature, blood pressure, lactate, and organ function are absent;
- it is called a sepsis index even though it is not sepsis-validated;
- hard-coded scenario values can differ from recalculated values.

**Recommendation:** Rename it to an “inflammatory/autonomic risk score” until it is validated, then calibrate it on labeled data with confidence intervals and false-alarm analysis.

### 5.2 ARF and Fridericia QTc

The code uses a Fridericia-style correction and a potassium-sensitive heuristic. This is directionally appropriate for a demonstration, but it synthesizes QT from heart rate and potassium instead of measuring QT from an ECG.

**Problems:**

- QTc should be derived from a measured QT interval and RR interval;
- calcium and magnesium are absent;
- the score is not a validated probability of ventricular arrhythmia;
- supplied and recalculated values may disagree.

**Recommendation:** Store ECG-derived QT, RR, QRS, and rhythm-quality metadata. Mark synthetic QTc clearly as simulated.

### 5.3 TRM — thrombosis risk

The formula emphasizes hematocrit and includes platelets, IL-6, and SpO₂. This is a plausible educational heuristic, but it is not the NASA IJV thrombosis model or a validated clinical score.

**Problems:**

- no venous-flow or ultrasound evidence;
- no fibrinogen, D-dimer, coagulation, blood-flow, or endothelial variables;
- values are clamped and normalized to project-selected constants;
- `computed_trm` is sometimes hard-coded by scenarios.

**Recommendation:** Call it “simulation TRM,” cite the exact source for every coefficient, and validate it against labeled longitudinal data.

### 5.4 RSI — radiation index

The code combines physical flux and lymphocyte depletion. This is useful as a visualization, but it is not a complete radiation biodosimetry system.

**Problems:**

- fixed four-hour exposure assumption;
- no energy spectrum, shielding, radiation quality, or dose integration;
- biological and physical estimates can conflict;
- acute and chronic exposure are not separated.

**Recommendation:** Maintain cumulative dose-rate history and expose uncertainty rather than returning a single precise dose.

### 5.5 PSI — physiological strain index

`calculate_physiological_strain_index()` implements a Moran-style temperature/heart-rate strain calculation, but no current scenario calls it.

**Recommendation:** Either connect PSI to workout/EVA/post-workout scenarios or remove it from operational claims until it is used and tested.

## 6. NASA and evidence context

The repository references NASA OSDR studies OSD-569 and OSD-575. Those datasets are useful for demonstrating astronaut-related laboratory data, but they do not automatically validate the simulated algorithms or create individual crew baselines for a Mars mission.

Relevant NASA research areas include:

- NASA-STD-3001 and NASA human-system standards for crew health, environmental conditions, and medical operations;
- NASA Human Research Program evidence on spaceflight-associated neuro-ocular syndrome;
- NASA research on fluid shifts, cardiovascular deconditioning, exercise countermeasures, and orthostatic intolerance;
- NASA-supported research on immune dysregulation and latent herpesvirus reactivation;
- NASA radiation protection research concerning solar particle events and galactic cosmic radiation;
- NASA-supported research on internal-jugular-vein thrombosis during spaceflight;
- NASA research on sleep, circadian rhythm, fatigue, and performance risk.

### Citation policy recommendation

The current project should avoid statements such as “NASA-validated,” “NASA endorsed,” or “NASA standard threshold” unless the exact document, revision, section, and applicability are recorded. NASA OSDR is a data source; it is not an approval or validation authority for these algorithms.

A better citation record for each scenario should include:

```text
Source organization:
Document or study title:
Document/study identifier:
Revision or publication year:
Relevant section/table:
What the source supports:
What remains a project assumption:
```

## 7. Cross-cutting improvements

### Priority 1 — correctness and reproducibility

- Implement Scenario 16 with explicit liver/metabolic fields.
- Add `sleep_score` evaluation and alert/trend logic.
- Integrate CRP only after defining and testing its role.
- Remove hard-coded derived values, or label them as scenario overrides and record their source.
- Make all scenario outputs reproducible from the same input packet and configuration.
- Add a scenario manifest with expected severity, affected crew, and expected alert reason.

### Priority 2 — physiological realism

- Replace instant changes with ramps, delays, persistence, and recovery curves.
- Add missing variables: respiratory rate, blood pressure, oxygen fraction, CO₂ exposure history, sodium, calcium, magnesium, renal markers, liver markers, hemoglobin, and inflammatory/coagulation markers.
- Separate environmental hazards from clinical diagnoses.
- Use symptom, sensor-quality, and data-age metadata.
- Model crew-wide hazards separately from individual medical events.

### Priority 3 — validation and safety

- Add unit tests for every scenario.
- Test both the raw scenario packet and the final packet after `SentryMatrixEngine` recalculation.
- Assert expected severity, trigger reason, affected crew, and derived-index range.
- Add tests proving that workout gating does not hide CRITICAL non-cardiac events.
- Run sensitivity analysis for every threshold and coefficient.
- Measure false-positive and false-negative behavior on labeled data.
- Report uncertainty and avoid diagnostic language.

### Priority 4 — NASA traceability

- Create a `documentation/references.yaml` or equivalent citation registry.
- Link every threshold and coefficient to an exact source or mark it as a project assumption.
- Separate NASA-derived measurements from synthetic scenario values in each packet.
- Record provenance fields such as `source`, `synthetic_override`, `model_version`, and `calculation_version`.

## 8. Recommended test matrix

For each scenario, test at least:

| Test | Expected result |
|---|---|
| Scenario activation | Valid scenario state and target astronaut |
| First packet | Expected modified fields are present |
| Recalculation | Derived metrics are reproducible |
| Severity | Expected NOMINAL/INFO/WARNING/CRITICAL level |
| Reason | Alert explanation names the actual triggering variables |
| Persistence | Scenario remains active for the intended duration |
| Recovery | Returning to nominal clears the alert correctly |
| Targeting | Individual scenarios affect only the selected astronaut |
| Universal hazard | Cabin-wide scenarios affect all intended crew |
| Invalid key | No state mutation and a clean 404/error |
| Offline mode | Telemetry remains available without external AI/TTS |

## 9. Final verdict

| Area | Verdict |
|---|---|
| Scenario organization | Good for a demonstration |
| Telemetry replay | Functional design, limited physiological time modeling |
| Alert ordering | Sensible, but first-match behavior hides coexisting findings |
| EPI | Useful heuristic, not clinically validated |
| ARF/QTc | Directionally appropriate, but synthetic and inconsistent with hard-coded values |
| TRM | Plausible educational heuristic, incomplete thrombosis model |
| RSI | Useful visualization, not full radiation biodosimetry |
| Activity gating | Good concept, may mask non-cardiac problems during workout |
| Scenario 16 | Not implemented |
| Sleep/fatigue logic | Data exists, alert integration missing |
| NASA traceability | Needs exact citations and clearer separation of evidence from assumptions |
| Operational readiness | Not ready for medical or flight use |

**Bottom line:** The project has a strong demonstration architecture and covers many important human-spaceflight risks. The highest-value next steps are to implement Scenario 16, integrate and test sleep/CRP logic, remove conflicting hard-coded derived values, add time-dependent scenario trajectories, and replace broad NASA claims with exact, traceable references and explicit project assumptions.
