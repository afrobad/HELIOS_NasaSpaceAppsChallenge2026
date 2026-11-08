# HELIOS Medical Safety Boundaries & Clinical Authority Specification

## 1. Safety Invariant: Deterministic Alarming vs Generative AI
In human spaceflight clinical decision support, the distinction between **deterministic rules** and **generative AI** is a strict safety boundary:

> **CORE SAFETY MANDATE:**  
> Generative AI / Large Language Models (LLMs) **MUST NEVER** have authority over clinical alarming, physiological threshold gating, or triage classification. All alarms, triage categories, and critical alert dispatches are 100% deterministic, governed strictly by NASA-STD-3001, Flight Rules, and mathematical closed-loop boundary equations.

---

## 2. The Clinical Authority Hierarchy

| Level | Subsystem | Implementation Type | Autonomy Tier | Operational Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Level 0 (Life Critical)** | **Sentry Matrix Engine** | Deterministic Math / Fixed Thresholds | Autonomous / Authoritative | Instant threshold breach detection, master acoustic alarms, emergency ECLSS command triggers. |
| **Level 1 (Clinical Triage)** | **Clinical Prioritizer** | Deterministic Z-Score & Trend Rules | Autonomous / Authoritative | Stratifies crew into Critical, Warning, or Nominal. Computes biological organ risk tags. |
| **Level 2 (Diagnostic Context)** | **Diagnostic Knowledge Base** | Curated Medical Protocols (NASA-STD-3001) | Advisory / Deterministic | Pulls step-by-step checklists, countermeasure dosages, and differential diagnoses. |
| **Level 3 (AI Synthesis)** | **Local Medical LLM** | Local Generative Model (BioMistral-7B) | Advisory Only / Subordinate | Synthesizes complex clinical notes, cross-references multi-organ timeline logs, assists CMO phrasing. |

---

## 3. NASA-STD-3001 Hard Boundary Thresholds

The following hard physiological thresholds are embedded in the deterministic kernel:

| Biomarker | Nominal Range | Warning Boundary | Critical Hard Floor / Ceiling |
| :--- | :--- | :--- | :--- |
| **Heart Rate (HR)** | 55 – 90 bpm | < 50 bpm or > 105 bpm | < 40 bpm or > 140 bpm |
| **Oxygen Saturation ($SpO_2$)** | 96.0 – 99.5% | < 94.0% | < 88.0% |
| **End-Tidal $CO_2$ ($EtCO_2$)** | 35 – 45 mmHg | > 48 mmHg (or < 30 mmHg) | > 55 mmHg (Hypercapnia) |
| **Core Body Temperature** | 36.5 – 37.5 °C | > 38.0 °C or < 35.5 °C | > 39.5 °C or < 34.5 °C (Hypothermia) |
| **Serum Potassium ($K^+$)** | 3.5 – 5.0 mmol/L | < 3.4 or > 5.2 mmol/L | < 3.0 or > 6.0 mmol/L (Arrhythmia Risk) |
| **Hematocrit (Hct)** | 36.0 – 48.0% | > 50.0% (Hemoconcentration) | > 54.0% (Hyperviscosity / Thrombosis) |
| **Cabin Total Pressure** | 98.0 – 103.0 kPa | < 94.0 kPa | < 70.0 kPa (Acute Decompression) |
| **Radiation Flux** | < 0.15 mSv/h | > 1.50 mSv/h | > 10.0 mSv/h (Solar Particle Event) |

---

## 4. Human-In-The-Loop (HITL) Guardrails
1. **Crew Medical Officer (CMO) Primacy:** HELIOS offers suggestions and checklists; final execution of medical procedures (e.g. pharmaceutical administration, defibrillation, surgical intervention) requires human crew confirmation.
2. **Explainability & Grounding:** Every alert surfaced to the crew links to the exact biomarker telemetry reading and the corresponding NASA-STD-3001 reference standard.
3. **No Phantom Hallucinations:** Generative models are barred from synthesizing simulated biomarker values. All data displays reflect true physical sensor input or calibrated baseline OSDR profiles.

