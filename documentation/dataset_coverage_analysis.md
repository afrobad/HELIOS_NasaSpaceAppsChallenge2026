# Dataset Coverage Analysis Report
**Project:** H.E.L.I.O.S — Deep-Space Astronaut Health Intelligence HUD  
**Analyzed:** 2026-09-23

---

## Summary

> **Short answer: No. Only ~15% of the available dataset is actively used.**
> The system ingests 6 fields out of 281 total dataset fields across 5 data files.
> A large volume of clinically critical data — including 66 cytokines, 12 metabolic markers, 7 cardiovascular acute-phase proteins, and 14 CBC morphology markers — is loaded into the project directory but **never read by any backend module.**

---

## Files in `/data` — What exists vs. what is used

| File | Size | Total Fields | Fields Actually Used | % Used |
|---|---|---|---|---|
| `astronaut_telemetry_stream.csv` | 11.3 MB | 30 columns | **26 / 30** | **87%** ✅ |
| `nasa_astronaut_baselines.json` | 7.9 KB | 5 vitals × 4 crew × 3 states | **4 vitals used** (HR, HRV, SpO₂, Temp) | **80%** ✅ |
| `nasa_osdr/OSD-569_Complete_Blood_Count.csv` | 9.3 KB | 61 columns (20 key markers) | **3 fields** (HCT, PLT, WBC, ALC) | **15%** ⚠️ |
| `nasa_osdr/OSD-575_Comprehensive_Metabolic_Panel.csv` | 8.5 KB | 58 columns (19 key markers) | **1 field** (potassium K⁺) | **5%** 🔴 |
| `nasa_osdr/OSD-575_Immune_Panel.csv` | 41 KB | 143 columns (71 cytokines) | **1 field** (IL-6) | **1.4%** 🔴 |
| `nasa_osdr/OSD-575_Cardiovascular_Panel.csv` | 6.2 KB | 19 columns (9 acute-phase proteins) | **0 fields** | **0%** 🚨 |

**Total dataset columns across all files: ~281**  
**Total columns actually consumed: ~35 (including derived/computed)**  
**Overall utilization: ~12-15%**

---

## Telemetry Stream CSV — 4 Unused Columns

The main streaming CSV (`astronaut_telemetry_stream.csv`) has 30 columns. The feeder reads all of them but **4 are never sent to the frontend or used in any calculation:**

| Unused Column | Loaded? | Used in backend? | Sent to frontend? |
|---|---|---|---|
| `sleep_score` | ✅ Yes (line 87) | ❌ Never evaluated | ❌ Never sent |
| `crp` | ✅ Yes (line 94) | ❌ Never evaluated | ❌ Never sent |
| `data_source` | ✅ Yes (line 107) | ❌ Metadata only | ❌ Never sent |
| `astronaut_name` | ✅ Yes | ❌ Discarded | ❌ Never sent |

### CRP is particularly notable
`crp` (C-Reactive Protein) is loaded from the CSV (`crp: float(row["crp"])`) but **zero code evaluates it**. CRP is a primary sepsis/inflammation marker from OSD-575 Cardiovascular Panel.

---

## OSD-569 Complete Blood Count — 17/20 markers UNUSED

Only 3 of 20 CBC measurement columns are reflected in the telemetry stream:

| Marker | Status |
|---|---|
| `hematocrit` | ✅ Used (TRM calculation) |
| `white_blood_cell_count` (WBC) | ✅ Used (EPI calculation) |
| `platelet_count` | ✅ Used (TRM calculation) |
| `absolute_lymphocytes` | ✅ Used (RSI / radiation model) |
| `hemoglobin` | 🔴 **NOT USED** |
| `red_blood_cell_count` (RBC) | 🔴 **NOT USED** |
| `absolute_neutrophils` | 🔴 **NOT USED** |
| `absolute_monocytes` | 🔴 **NOT USED** |
| `absolute_eosinophils` | 🔴 **NOT USED** |
| `absolute_basophils` | 🔴 **NOT USED** |
| `MCH / MCHC / MCV` (RBC indices) | 🔴 **NOT USED** |
| `MPV` (Mean Platelet Volume) | 🔴 **NOT USED** |
| `RDW` (Red Cell Distribution Width) | 🔴 **NOT USED** |
| `neutrophils_percent` | 🔴 **NOT USED** |

---

## OSD-575 Comprehensive Metabolic Panel — 18/19 markers UNUSED

Only potassium (K⁺) is in the telemetry stream. The CMP contains a full clinical chemistry panel:

| Marker | Status | Clinical Relevance |
|---|---|---|
| `potassium` (K⁺) | ✅ Used (ARF QTc) | |
| `sodium` (Na⁺) | 🔴 **NOT USED** | Hyponatremia in microgravity |
| `creatinine` | 🔴 **NOT USED** | Kidney function / muscle atrophy |
| `glucose` | 🔴 **NOT USED** | Metabolic stress / diabetes risk |
| `calcium` (Ca²⁺) | 🔴 **NOT USED** | Bone density loss in spaceflight |
| `albumin` | 🔴 **NOT USED** | Nutritional status |
| `alt` / `ast` | 🔴 **NOT USED** | Liver stress markers |
| `alkaline_phosphatase` | 🔴 **NOT USED** | Bone metabolism |
| `carbon_dioxide` (bicarbonate) | 🔴 **NOT USED** | Acid-base balance |
| `chloride` | 🔴 **NOT USED** | Electrolyte panel |
| `bun` (urea nitrogen) | 🔴 **NOT USED** | Dehydration / renal function |
| `eGFR` | 🔴 **NOT USED** | Glomerular filtration rate |
| `total_protein` | 🔴 **NOT USED** | Nutritional status |
| `total_bilirubin` | 🔴 **NOT USED** | Liver / hemolysis |
| `globulin` | 🔴 **NOT USED** | Immune/hepatic function |

---

## OSD-575 Immune Panel — 70/71 cytokines UNUSED

This is the largest gap. The immune panel has **71 cytokine/chemokine concentration markers** from real Inspiration4 spaceflight. Only IL-6 is carried forward.

**Currently used:**
- `il_6` ✅ (EPI sepsis index)

**Completely ignored (~70 markers including):**

| Marker | Clinical Significance |
|---|---|
| `tnfα` (TNF-alpha) | Systemic inflammation / septic shock |
| `ifnγ` (Interferon-gamma) | Viral reactivation (EBV, CMV, HSV) — NASA OSD-575 key finding |
| `il_1β` | Pro-inflammatory cascade activation |
| `il_10` | Anti-inflammatory regulatory response |
| `il_2` | T-cell proliferation / immune activation |
| `il_4`, `il_5`, `il_13` | Allergic / Th2 response shift |
| `vegf_a` | Vascular remodeling |
| `mcp_1` (CCL2) | Monocyte recruitment |
| `ip_10` (CXCL10) | Viral reactivation marker |
| `g_csf` | Granulopoiesis stress |
| `egf` | Tissue repair / epithelial stress |
| `pdgf` | Platelet & vascular biology |
| `il_8` (CXCL8) | Neutrophil chemotaxis |
| `rantes` (CCL5) | T-cell trafficking |

---

## OSD-575 Cardiovascular Panel — 100% UNUSED 🚨

This file is in the project directory and **never opened by any backend code.** It contains 9 acute-phase protein markers measured pre/post-flight:

| Marker | Clinical Significance |
|---|---|
| `crp` (C-Reactive Protein) | Primary systemic inflammation marker |
| `fibrinogen` | Coagulation / thrombosis risk |
| `haptoglobin` | Hemolysis / oxidative stress |
| `a2_macroglobulin` | Protease inhibitor, inflammation |
| `agp` (Alpha-1 acid glycoprotein) | Acute phase response |
| `fetuin_a36` | Calcification / metabolic syndrome |
| `l_selectin` | Leukocyte rolling / endothelial inflammation |
| `pf4` (Platelet Factor 4) | Thrombosis / heparin sensitivity |
| `sap` (Serum Amyloid P) | Innate immunity / amyloidosis |

> **Note:** `fibrinogen` and `l_selectin` together form a complete thrombosis risk panel — directly relevant to the existing TRM (Thrombosis Risk Metric) calculation, which currently only uses hematocrit and platelets.

---

## `nasa_astronaut_baselines.json` — Missing `sleep_score` Baseline Usage

The JSON defines `sleep_score` baselines per astronaut (e.g., Commander REST = 86.0 ± 6.0), and the telemetry CSV streams `sleep_score` values — but:
- No backend code evaluates `sleep_score` deviations
- No alert is triggered on poor sleep score
- The frontend never displays it

Sleep deprivation is a well-documented spaceflight risk (NASA HRP-47072) and is directly correlated with cognitive impairment, immune suppression, and cardiovascular strain.

---

## What IS Being Used — Summary

### ✅ Fully Utilized
- `heart_rate`, `hrv_rmssd`, `spo2`, `core_temp` — Live vitals streaming + Z-score evaluation
- `cabin_co2` — Environmental alert system
- `potassium` → ARF/QTc arrhythmia risk
- `il_6` + `wbc_count` → EPI sepsis index
- `hematocrit` + `platelet_count` → TRM thrombosis risk
- `lymphocyte_count` + `radiation_flux` → RSI radiation biodosimetry
- `scenario_phase`, `z_score_hr`, `z_score_hrv`, `alert_severity`
- `nasa_astronaut_baselines.json` (HR, HRV, SpO₂, Temp per crew, per state)

### ❌ Loaded but never evaluated
- `sleep_score` (CSV + JSON baseline both present)
- `crp` (loaded from CSV, never computed)

### 🚨 Dataset files present but never opened
- `OSD-575_Cardiovascular_Panel.csv` — 9 acute-phase proteins (fibrinogen, haptoglobin, CRP, L-selectin...)
- 70 cytokines from `OSD-575_Immune_Panel.csv` (TNF-α, IFN-γ, IL-1β, IL-10, IP-10...)
- 15 metabolic markers from `OSD-575_Comprehensive_Metabolic_Panel.csv` (Na⁺, Ca²⁺, creatinine, glucose, ALT, AST...)
- 16 CBC morphology markers from `OSD-569_CBC.csv` (hemoglobin, RBC, MCH, MCHC, neutrophils, RDW...)

---

## Priority Recommendations

| Priority | What to Add | Source File | Impact |
|---|---|---|---|
| 🔴 HIGH | `sleep_score` monitoring + alerting | CSV already loaded | Direct cognitive/immune risk |
| 🔴 HIGH | `crp` in sepsis/inflammation index (alongside IL-6) | CSV already loaded | More accurate EPI |
| 🔴 HIGH | `fibrinogen` in TRM thrombosis calculation | OSD-575 CV Panel | Stronger TRM model |
| 🟠 MEDIUM | `sodium` (Na⁺) hyponatremia detection | OSD-575 CMP | Common microgravity risk |
| 🟠 MEDIUM | `creatinine` / `eGFR` kidney function | OSD-575 CMP | Muscle atrophy monitoring |
| 🟠 MEDIUM | `tnfα` + `ifnγ` for viral reactivation index | OSD-575 Immune | Key NASA OSDR finding |
| 🟠 MEDIUM | `hemoglobin` + `MCV` anemia detection | OSD-569 CBC | Space anemia (ISS known issue) |
| 🟡 LOW | `calcium` bone loss tracking | OSD-575 CMP | Long-duration mission risk |
| 🟡 LOW | `glucose` metabolic stress index | OSD-575 CMP | Stress hyperglycemia |
| 🟡 LOW | Full cytokine panel for multi-cytokine storm index | OSD-575 Immune | Advanced immune monitoring |
