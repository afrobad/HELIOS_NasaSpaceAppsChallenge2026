/**
 * frontend/src/utils/scenarioSimulator.ts
 * High-Fidelity Autonomous Offline/Online Scenario Simulation Engine.
 *
 * Implements full 18 spaceflight scenarios + NOMINAL_CRUISE matching:
 * - NASA STD-3001 Human Spaceflight Medical Operations standards
 * - Python backend streaming/telemetry_feeder.py biometrics and clinical formulas
 * - Autonomous offline fallback with real-time 10 Hz continuous micro-variations
 */

import type { TelemetryPacket, AlertPayload } from '../types/telemetry';

export const CREW_IDS = [
  'AST-01_COMMANDER',
  'AST-02_PILOT',
  'AST-03_MEDICAL',
  'AST-04_ENGINEER',
] as const;

export type CrewId = typeof CREW_IDS[number];

export const CREW_NAMES: Record<CrewId, string> = {
  'AST-01_COMMANDER': 'Commander Haley',
  'AST-02_PILOT': 'Pilot Chris',
  'AST-03_MEDICAL': 'Dr. Sian',
  'AST-04_ENGINEER': 'Specialist Leo',
};

export const CREW_BASELINES: Record<CrewId, {
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
  k: number;
  qtc: number;
  hct: number;
  wbc: number;
  plt: number;
  sleep: number;
}> = {
  'AST-01_COMMANDER': { hr: 62.0, hrv: 65.0, spo2: 98.4, temp: 36.6, k: 4.4, qtc: 405, hct: 42.0, wbc: 6.8, plt: 240, sleep: 92 },
  'AST-02_PILOT':     { hr: 58.0, hrv: 72.0, spo2: 98.6, temp: 36.7, k: 4.3, qtc: 400, hct: 44.0, wbc: 6.5, plt: 235, sleep: 94 },
  'AST-03_MEDICAL':   { hr: 66.0, hrv: 58.0, spo2: 98.0, temp: 36.9, k: 4.2, qtc: 410, hct: 40.8, wbc: 6.9, plt: 245, sleep: 89 },
  'AST-04_ENGINEER':  { hr: 64.0, hrv: 62.0, spo2: 98.3, temp: 36.8, k: 4.5, qtc: 408, hct: 43.0, wbc: 6.6, plt: 238, sleep: 91 },
};

export const DEFAULT_NOMINAL_TELEMETRY: Record<string, TelemetryPacket> = {
  'AST-01_COMMANDER': {
    timestamp: new Date().toISOString(),
    tick: 0,
    astronaut_id: 'AST-01_COMMANDER',
    astronaut_name: 'Commander Haley',
    mission_state: 'REST',
    heart_rate: 62.0,
    hrv_rmssd: 65.0,
    spo2: 98.4,
    core_temp: 36.6,
    sleep_score: 92,
    cabin_co2: 1.82,
    potassium: 4.4,
    hematocrit: 42.0,
    wbc_count: 6.8,
    platelet_count: 240,
    crp: 0.8,
    radiation_flux: 0.04,
    radiation_dose_gy: 0.0,
    lymphocyte_count: 2.2,
    computed_qtc: 405,
    computed_epi: 0.0,
    computed_arf: 0.74,
    computed_trm: 1.0,
    computed_rsi: 0.1,
    scenario_phase: 'NOMINAL_CRUISE',
    z_score_hr: 0.1,
    z_score_hrv: 0.1,
    evaluated_severity: 'NOMINAL',
  },
  'AST-02_PILOT': {
    timestamp: new Date().toISOString(),
    tick: 0,
    astronaut_id: 'AST-02_PILOT',
    astronaut_name: 'Pilot Chris',
    mission_state: 'REST',
    heart_rate: 58.0,
    hrv_rmssd: 72.0,
    spo2: 98.6,
    core_temp: 36.7,
    sleep_score: 94,
    cabin_co2: 1.82,
    potassium: 4.3,
    hematocrit: 44.0,
    wbc_count: 6.5,
    platelet_count: 235,
    crp: 0.7,
    radiation_flux: 0.04,
    radiation_dose_gy: 0.0,
    lymphocyte_count: 2.3,
    computed_qtc: 400,
    computed_epi: 0.0,
    computed_arf: 0.72,
    computed_trm: 1.0,
    computed_rsi: 0.1,
    scenario_phase: 'NOMINAL_CRUISE',
    z_score_hr: 0.0,
    z_score_hrv: 0.0,
    evaluated_severity: 'NOMINAL',
  },
  'AST-03_MEDICAL': {
    timestamp: new Date().toISOString(),
    tick: 0,
    astronaut_id: 'AST-03_MEDICAL',
    astronaut_name: 'Dr. Sian',
    mission_state: 'REST',
    heart_rate: 66.0,
    hrv_rmssd: 58.0,
    spo2: 98.0,
    core_temp: 36.9,
    sleep_score: 89,
    cabin_co2: 1.82,
    potassium: 4.2,
    hematocrit: 40.8,
    wbc_count: 6.9,
    platelet_count: 245,
    crp: 0.9,
    radiation_flux: 0.04,
    radiation_dose_gy: 0.0,
    lymphocyte_count: 2.1,
    computed_qtc: 410,
    computed_epi: 0.0,
    computed_arf: 0.76,
    computed_trm: 1.0,
    computed_rsi: 0.1,
    scenario_phase: 'NOMINAL_CRUISE',
    z_score_hr: 0.2,
    z_score_hrv: 0.1,
    evaluated_severity: 'NOMINAL',
  },
  'AST-04_ENGINEER': {
    timestamp: new Date().toISOString(),
    tick: 0,
    astronaut_id: 'AST-04_ENGINEER',
    astronaut_name: 'Specialist Leo',
    mission_state: 'REST',
    heart_rate: 64.0,
    hrv_rmssd: 62.0,
    spo2: 98.3,
    core_temp: 36.8,
    sleep_score: 91,
    cabin_co2: 1.82,
    potassium: 4.5,
    hematocrit: 43.0,
    wbc_count: 6.6,
    platelet_count: 238,
    crp: 0.8,
    radiation_flux: 0.04,
    radiation_dose_gy: 0.0,
    lymphocyte_count: 2.2,
    computed_qtc: 408,
    computed_epi: 0.0,
    computed_arf: 0.74,
    computed_trm: 1.0,
    computed_rsi: 0.1,
    scenario_phase: 'NOMINAL_CRUISE',
    z_score_hr: 0.1,
    z_score_hrv: 0.1,
    evaluated_severity: 'NOMINAL',
  },
};

export const UNIVERSAL_SCENARIOS = new Set([
  'NOMINAL_CRUISE',
  'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH',
  'SCENARIO_3_CO2_HYPOXIA',
  'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA',
  'SCENARIO_3_SOLAR_RADIATION_STORM',
  'SCENARIO_8_SOLAR_RADIATION_STORM',
  'SOLAR_STORM',
  'SOLAR_RADIATION_STORM',
  'SCENARIO_4_AMMONIA_COOLANT_LEAK',
  'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER',
]);

/**
 * Synthesizes a full multi-crew TelemetryMap matching the exact clinical state of the scenario.
 */
export function generateScenarioTelemetry(
  scenarioKey: string,
  targetCrewId?: string | null,
  currentMap?: Record<string, TelemetryPacket>
): Record<string, TelemetryPacket> {
  const isUniversal = UNIVERSAL_SCENARIOS.has(scenarioKey);
  const effectiveTarget: CrewId = (targetCrewId && (targetCrewId in CREW_NAMES))
    ? (targetCrewId as CrewId)
    : 'AST-01_COMMANDER';

  const base: Record<string, TelemetryPacket> = currentMap && Object.keys(currentMap).length === 4
    ? JSON.parse(JSON.stringify(currentMap))
    : JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY));

  const nowIso = new Date().toISOString();

  // Reset to nominal baseline first if NOMINAL_CRUISE
  if (scenarioKey === 'NOMINAL_CRUISE') {
    return JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY));
  }

  for (const rawId of CREW_IDS) {
    const astId = rawId as CrewId;
    const isTarget = isUniversal || (astId === effectiveTarget);
    const pkt = base[astId];
    pkt.timestamp = nowIso;
    pkt.scenario_phase = scenarioKey;

    if (!isTarget) {
      // Non-targeted crew in individual scenario stays at nominal baseline
      const b = CREW_BASELINES[astId];
      pkt.heart_rate = b.hr;
      pkt.hrv_rmssd = b.hrv;
      pkt.spo2 = b.spo2;
      pkt.core_temp = b.temp;
      pkt.potassium = b.k;
      pkt.computed_qtc = b.qtc;
      pkt.computed_arf = 0.74;
      pkt.computed_trm = 1.0;
      pkt.computed_rsi = 0.1;
      pkt.computed_epi = 0.0;
      pkt.evaluated_severity = 'NOMINAL';
      continue;
    }

    // Apply specific scenario shift
    switch (scenarioKey) {
      case 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH':
      case 'SCENARIO_3_CO2_HYPOXIA':
        pkt.cabin_co2 = 4.25;
        pkt.heart_rate = Math.max(pkt.heart_rate, 84.0);
        pkt.spo2 = 96.2;
        pkt.hrv_rmssd = 38.0;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA':
        pkt.spo2 = 88.5; // Critical hypoxia
        pkt.heart_rate = 118.0;
        pkt.hrv_rmssd = 24.0;
        pkt.cabin_co2 = 2.1;
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_3_SOLAR_RADIATION_STORM':
      case 'SCENARIO_8_SOLAR_RADIATION_STORM':
      case 'SOLAR_STORM':
      case 'SOLAR_RADIATION_STORM':
        pkt.radiation_flux = 85.0; // Critical SPE event
        pkt.radiation_dose_gy = 0.75;
        pkt.lymphocyte_count = 0.85;
        pkt.computed_rsi = 1.25;
        pkt.heart_rate = Math.max(pkt.heart_rate, 86.0);
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_4_AMMONIA_COOLANT_LEAK':
        pkt.spo2 = 89.5;
        pkt.heart_rate = 132.0;
        pkt.hrv_rmssd = 18.0;
        pkt.il_6 = 28.0;
        pkt.core_temp = 37.4;
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER':
        pkt.spo2 = 93.5;
        pkt.heart_rate = 108.0;
        pkt.hrv_rmssd = 16.0;
        pkt.crp = 8.5;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA':
        pkt.potassium = 2.95; // Severe hypokalemia < 3.0
        pkt.computed_qtc = 492.0; // Dangerous QTc prolongation
        pkt.computed_arf = 1.75; // Arrhythmia risk factor
        pkt.heart_rate = 112.0;
        pkt.hrv_rmssd = 20.0;
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_7_VENOUS_THROMBOSIS_RISK':
        pkt.hematocrit = 52.5;
        pkt.platelet_count = 385.0;
        pkt.il_6 = 18.5;
        pkt.computed_trm = 2.35; // Thrombosis risk multiplier
        pkt.heart_rate = 88.0;
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_8_CARDIOVASCULAR_DECONDITIONING':
        pkt.heart_rate = 98.0;
        pkt.hrv_rmssd = 18.0;
        pkt.hematocrit = 36.0;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_9_CORONARY_MICROVASCULAR_STRESS':
        pkt.heart_rate = 96.0;
        pkt.crp = 6.8;
        pkt.potassium = 3.6;
        pkt.computed_qtc = 458.0;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_10_PRESYMPTOMATIC_SEPSIS':
      case 'SCENARIO_5_PRESYMPTOMATIC_SEPSIS':
        pkt.il_6 = 125.0;
        pkt.wbc_count = 14.5;
        pkt.crp = 16.5;
        pkt.core_temp = 37.8;
        pkt.computed_epi = 1.65;
        pkt.heart_rate = 104.0;
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_11_LATENT_VIRUS_REACTIVATION':
        pkt.il_6 = 22.0;
        pkt.lymphocyte_count = 1.4;
        pkt.heart_rate = 78.0;
        pkt.computed_epi = 0.95;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_12_CYTOKINE_RELEASE_STORM':
        pkt.il_6 = 195.0;
        pkt.wbc_count = 16.8;
        pkt.crp = 24.0;
        pkt.core_temp = 38.9;
        pkt.heart_rate = 126.0;
        pkt.computed_epi = 1.95;
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_13_RADIATION_MARROW_EXHAUSTION':
        pkt.lymphocyte_count = 0.52;
        pkt.wbc_count = 2.4;
        pkt.radiation_dose_gy = 0.95;
        pkt.computed_rsi = 1.45;
        pkt.heart_rate = 92.0;
        pkt.evaluated_severity = 'CRITICAL';
        break;

      case 'SCENARIO_14_NEPHROLITHIASIS':
        pkt.heart_rate = 88.0;
        pkt.hrv_rmssd = 28.0;
        pkt.potassium = 3.4;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_15_INTRAVASCULAR_DEHYDRATION':
        pkt.hematocrit = 52.0;
        pkt.heart_rate = 92.0;
        pkt.hrv_rmssd = 22.0;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION':
        pkt.core_temp = 37.5;
        pkt.heart_rate = 86.0;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_17_SPACE_VISION_SANS':
        pkt.cabin_co2 = 3.6;
        pkt.platelet_count = 290.0;
        pkt.heart_rate = 76.0;
        pkt.evaluated_severity = 'WARNING';
        break;

      case 'SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT':
      case 'SCENARIO_1_BASELINE_DRIFT':
        pkt.sleep_score = 42.0;
        pkt.heart_rate = 79.0;
        pkt.hrv_rmssd = 22.0;
        pkt.evaluated_severity = 'WARNING';
        break;

      default:
        pkt.evaluated_severity = 'NOMINAL';
        break;
    }
  }

  return base;
}

/**
 * Generates an instantaneous clinical AlertPayload for the scenario.
 */
export function generateScenarioAlert(
  scenarioKey: string,
  targetCrewId?: string | null,
  liveTelemetry?: Record<string, any>
): AlertPayload | null {
  if (scenarioKey === 'NOMINAL_CRUISE') {
    return {
      id: `ALT-NOM-${Date.now()}`,
      timestamp: new Date().toISOString(),
      astronaut_id: 'ALL',
      astronaut_name: 'All Crew',
      severity: 'NOMINAL',
      tone: 'none',
      speech_text: 'Nominal flight cruise restored. All crew vital signs are stable and within safe limits.',
      source: 'HELIOS_SENTRY',
      is_fallback: false,
      duration_ms: 3000,
      reason: 'Nominal Spaceflight Cruise Baseline',
      triage_diagnosis: 'Nominal Spaceflight Cruise Baseline',
      actionable_instruction: 'Resume standard flight operations and logging cadence.',
      confidence: 0.99,
    };
  }

  const isUniversal = UNIVERSAL_SCENARIOS.has(scenarioKey);
  const targetId: CrewId = (targetCrewId && (targetCrewId in CREW_NAMES))
    ? (targetCrewId as CrewId)
    : 'AST-01_COMMANDER';

  const crewName = isUniversal ? 'All Crew Members' : CREW_NAMES[targetId];
  const targetTel = liveTelemetry ? (liveTelemetry[targetId] || Object.values(liveTelemetry)[0] || {}) : {};

  const co2Val = targetTel.cabin_co2 ? Number(targetTel.cabin_co2).toFixed(2) : '4.25';
  const spo2Val = targetTel.spo2 ? Number(targetTel.spo2).toFixed(1) : '88.5';
  const hrVal = targetTel.heart_rate ? Math.round(Number(targetTel.heart_rate)) : 118;
  const pressVal = targetTel.cabin_pressure ? Number(targetTel.cabin_pressure).toFixed(1) : '85.0';
  const radVal = targetTel.radiation_flux ? Number(targetTel.radiation_flux).toFixed(1) : '85.0';
  const kVal = targetTel.potassium ? Number(targetTel.potassium).toFixed(2) : '2.95';
  const qtcVal = targetTel.computed_qtc ? Math.round(Number(targetTel.computed_qtc)) : 495;
  const tempVal = (targetTel.core_temp || targetTel.core_temperature) ? Number(targetTel.core_temp || targetTel.core_temperature).toFixed(1) : '39.1';
  const il6Val = targetTel.il_6 ? Math.round(Number(targetTel.il_6)) : 125;
  const trmVal = targetTel.trm_ratio ? Number(targetTel.trm_ratio).toFixed(2) : '2.35';

  const map: Record<string, { severity: 'CRITICAL' | 'WARNING'; title: string; speech: string; action: string }> = {
    SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH: {
      severity: 'WARNING',
      title: `CO₂ Scrubber Breakthrough (${co2Val} mmHg)`,
      speech: `Critical alert. Carbon dioxide scrubber breakthrough detected. Cabin carbon dioxide surged to ${co2Val} millimeters of mercury with crew blood oxygen at ${spo2Val} percent. Don emergency oxygen masks immediately.`,
      action: 'Switch to backup lithium hydroxide scrubber beds, verify mask seals, and ventilate cabin module.',
    },
    SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA: {
      severity: 'CRITICAL',
      title: `Cabin Decompression & Acute Hypoxia (SpO₂ ${spo2Val}%)`,
      speech: `Critical alert. Cabin decompression detected at ${pressVal} kilopascals with blood oxygen critically low at ${spo2Val} percent. Don pressurized oxygen masks immediately.`,
      action: 'Don pressurized oxygen masks immediately, locate hull breach, and seal pressure bulkheads.',
    },
    SCENARIO_3_SOLAR_RADIATION_STORM: {
      severity: 'CRITICAL',
      title: `Solar Particle Radiation Storm (${radVal} mGy/h)`,
      speech: `Emergency alert. Severe solar particle storm detected with cosmic radiation flux surging to ${radVal} milligray per hour. Direct all crew to storm shelter immediately.`,
      action: 'Direct all crew to the water-shielded storm shelter; monitor active radiation dosimeters.',
    },
    SCENARIO_4_AMMONIA_COOLANT_LEAK: {
      severity: 'CRITICAL',
      title: `Toxic Ammonia Coolant Ingress (SpO₂ ${spo2Val}%)`,
      speech: `Critical alert. Toxic ammonia coolant ingress detected with crew blood oxygen at ${spo2Val} percent. Isolate loop and activate gas filtration immediately.`,
      action: 'Isolate internal thermal loop, put on emergency breathing apparatus, and run charcoal filtration.',
    },
    SCENARIO_5_ELECTRICAL_FIRE_SMOLDER: {
      severity: 'WARNING',
      title: `Avionics Smoldering Fire (SpO₂ ${spo2Val}%)`,
      speech: `Warning. Avionics smoldering combustion detected with crew blood oxygen at ${spo2Val} percent. Depower bus and discharge halon.`,
      action: 'Depower affected electrical bus and prepare portable fire suppression canisters.',
    },
    SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA: {
      severity: 'CRITICAL',
      title: `${crewName} · Severe Hypokalemia & QTc Prolongation (${kVal} mmol/L)`,
      speech: `Critical alert for ${crewName}. Serum potassium dropped to ${kVal} millimoles per liter with Q-T interval prolonged at ${qtcVal} milliseconds and heart rate at ${hrVal} beats per minute. Oral potassium required.`,
      action: 'Suspend EVA excursion; initiate emergency KCl oral rehydration protocol (40 mEq) immediately.',
    },
    SCENARIO_7_VENOUS_THROMBOSIS_RISK: {
      severity: 'CRITICAL',
      title: `${crewName} · Internal Jugular Venous Thrombosis Risk (TRM ${trmVal})`,
      speech: `Critical alert for ${crewName}. Internal jugular venous stasis detected with TRM ratio elevated at ${trmVal}. Initiate compression countermeasures.`,
      action: 'Conduct ultrasound imaging on bilateral jugular veins; initiate low-molecular-weight heparin countermeasure.',
    },
    SCENARIO_8_CARDIOVASCULAR_DECONDITIONING: {
      severity: 'WARNING',
      title: `${crewName} · Cardiovascular Orthostatic Deconditioning`,
      speech: `Warning for ${crewName}. Cardiovascular orthostatic deconditioning observed with compensatory heart rate at ${hrVal} beats per minute.`,
      action: 'Prescribe high-intensity interval ARED cycle countermeasure and isotonic fluid loading.',
    },
    SCENARIO_9_CORONARY_MICROVASCULAR_STRESS: {
      severity: 'WARNING',
      title: `${crewName} · Coronary Microvascular Endothelial Stress`,
      speech: `Warning for ${crewName}. Myocardial endothelial stress and heart rate elevated to ${hrVal} beats per minute.`,
      action: 'Reduce cardiovascular load; monitor continuous 12-lead vector ECG.',
    },
    SCENARIO_10_PRESYMPTOMATIC_SEPSIS: {
      severity: 'CRITICAL',
      title: `${crewName} · Presymptomatic Systemic Sepsis Cascade (IL-6 ${il6Val} pg/mL)`,
      speech: `Critical alert for ${crewName}. Presymptomatic sepsis inflammatory cascade detected. Interleukin-6 at ${il6Val} picograms per milliliter with core temperature at ${tempVal} degrees Celsius.`,
      action: 'Commence immediate broad-spectrum antibiotic countermeasure; draw peripheral blood culture.',
    },
    SCENARIO_11_LATENT_VIRUS_REACTIVATION: {
      severity: 'WARNING',
      title: `${crewName} · Latent Herpesvirus Reactivation (EBV/VZV)`,
      speech: `Warning for ${crewName}. Latent viral reactivation detected. Administer antiviral countermeasure.`,
      action: 'Administer oral valacyclovir 1000 mg; schedule circadian sleep recovery.',
    },
    SCENARIO_12_CYTOKINE_RELEASE_STORM: {
      severity: 'CRITICAL',
      title: `${crewName} · Hyper-Inflammatory Cytokine Release Storm (IL-6 ${il6Val} pg/mL)`,
      speech: `Emergency for ${crewName}. Hyper-inflammatory cytokine storm detected with Interleukin-6 at ${il6Val} picograms per milliliter. High-dose steroid intervention indicated.`,
      action: 'Administer IV dexamethasone or IL-6 receptor antagonist; monitor core temperature and hemodynamics.',
    },
    SCENARIO_13_RADIATION_MARROW_EXHAUSTION: {
      severity: 'CRITICAL',
      title: `${crewName} · Hematopoietic Radiation Marrow Exhaustion`,
      speech: `Critical alert for ${crewName}. Bone marrow leukocyte exhaustion following radiation exposure.`,
      action: 'Administer granulocyte colony-stimulating factor (filgrastim); enforce reverse isolation.',
    },
    SCENARIO_14_NEPHROLITHIASIS: {
      severity: 'WARNING',
      title: `${crewName} · Acute Renal Colic & Nephrolithiasis Risk`,
      speech: `Warning for ${crewName}. Renal calculi transit risk detected. Administer oral hydration and antispasmodic.`,
      action: 'Administer 1000 mL chilled electrolyte oral hydration and ketorolac analgesia.',
    },
    SCENARIO_15_INTRAVASCULAR_DEHYDRATION: {
      severity: 'WARNING',
      title: `${crewName} · Microgravity Intravascular Dehydration (Hct 52%)`,
      speech: `Warning for ${crewName}. Severe hemoconcentration and plasma loss detected with heart rate at ${hrVal} beats per minute.`,
      action: 'Administer 800 mL oral rehydration solution; pause strenuous EVA exertion.',
    },
    SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION: {
      severity: 'WARNING',
      title: `${crewName} · Hepatic Microvascular Metabolic Stress`,
      speech: `Warning for ${crewName}. Microgravity hepatic clearance reduction detected. Adjust medication dosage.`,
      action: 'Titrate pharmaceutical dosing by -50%; monitor liver transaminases.',
    },
    SCENARIO_17_SPACE_VISION_SANS: {
      severity: 'WARNING',
      title: `${crewName} · Spaceflight-Associated Neuro-Ocular Syndrome (SANS)`,
      speech: `Warning for ${crewName}. Cephalad venous pressure and optic disc sheath dilation observed. Initiate negative pressure protocol.`,
      action: 'Schedule 2 hours lower-body negative pressure (LBNP); perform funduscopic OCT.',
    },
    SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT: {
      severity: 'WARNING',
      title: `${crewName} · Deep Circadian Desynchronosis & Sleep Deficit`,
      speech: `Warning for ${crewName}. Circadian phase drift detected with resting heart rate at ${hrVal} beats per minute.`,
      action: 'Administer 30-minute blue-enriched light therapy (480 nm, 10,000 lux); reschedule sleep window.',
    },
  };

  const info = map[scenarioKey] || {
    severity: 'WARNING' as const,
    title: `${scenarioKey.replace(/^SCENARIO_\d+_/, '').replace(/_/g, ' ')}`,
    speech: `Alert. Physiological anomaly detected for ${crewName}.`,
    action: 'Review telemetry sentry and verify clinical countermeasure checklist.',
  };

  return {
    id: `ALT-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    astronaut_id: isUniversal ? 'ALL' : targetId,
    astronaut_name: crewName,
    severity: info.severity,
    tone: info.severity === 'CRITICAL' ? 'klaxon' : 'chime',
    speech_text: `${info.speech} Helix-Ai Analyst directive: ${info.action}`,
    source: 'HELIOS_SENTRY',
    is_fallback: false,
    duration_ms: info.severity === 'CRITICAL' ? 5500 : 4000,
    reason: info.title,
    triage_diagnosis: info.title,
    actionable_instruction: info.action,
    confidence: 0.96,
  };
}

/**
 * Ticks offline telemetry smoothly: adds realistic micro-fluctuations (subtle respiratory & pulse sinus variation)
 * so that live sparklines, charts, and 3D body scanners remain fluid and reactive when running offline.
 */
export function tickOfflineTelemetry(
  currentMap: Record<string, TelemetryPacket>,
  tickCount: number
): Record<string, TelemetryPacket> {
  const updated: Record<string, TelemetryPacket> = {};
  const nowIso = new Date().toISOString();

  for (const [id, pkt] of Object.entries(currentMap)) {
    // Subtle sine wave for natural physiological sinus cadence (respiratory sinus arrhythmia RSA)
    const phaseOffset = id.charCodeAt(id.length - 1) * 0.75;
    const wave = Math.sin((tickCount * 0.12) + phaseOffset);
    const cosWave = Math.cos((tickCount * 0.08) + phaseOffset);

    // Keep an anchor point so values oscillate naturally without accumulating infinite drift
    const pktWithAnchor = pkt as TelemetryPacket & { _anchor_hr?: number; _anchor_spo2?: number; _anchor_temp?: number; _anchor_hrv?: number };
    const anchorHr = (pktWithAnchor._anchor_hr !== undefined && Math.abs(pktWithAnchor.heart_rate - pktWithAnchor._anchor_hr) < 4.0)
      ? pktWithAnchor._anchor_hr
      : pkt.heart_rate;
    const anchorSpo2 = (pktWithAnchor._anchor_spo2 !== undefined && Math.abs(pktWithAnchor.spo2 - pktWithAnchor._anchor_spo2) < 2.0)
      ? pktWithAnchor._anchor_spo2
      : pkt.spo2;
    const anchorTemp = (pktWithAnchor._anchor_temp !== undefined && Math.abs(pkt.core_temp - pktWithAnchor._anchor_temp) < 0.2)
      ? pktWithAnchor._anchor_temp
      : pkt.core_temp;
    const anchorHrv = (pktWithAnchor._anchor_hrv !== undefined && Math.abs(pkt.hrv_rmssd - pktWithAnchor._anchor_hrv) < 3.0)
      ? pktWithAnchor._anchor_hrv
      : pkt.hrv_rmssd;

    const dynamicHr = Number((anchorHr + wave * 0.7).toFixed(1));
    const dynamicHrv = Number(Math.max(10, anchorHrv - wave * 0.9).toFixed(1));
    const dynamicSpo2 = Number(Math.min(100, Math.max(70, anchorSpo2 + cosWave * 0.15)).toFixed(1));
    const dynamicTemp = Number((anchorTemp + Math.sin(tickCount * 0.02 + phaseOffset) * 0.02).toFixed(2));

    updated[id] = {
      ...pkt,
      tick: pkt.tick + 1,
      timestamp: nowIso,
      heart_rate: dynamicHr,
      hrv_rmssd: dynamicHrv,
      spo2: dynamicSpo2,
      core_temp: dynamicTemp,
      _anchor_hr: anchorHr,
      _anchor_spo2: anchorSpo2,
      _anchor_temp: anchorTemp,
      _anchor_hrv: anchorHrv,
    } as any;
  }

  return updated;
}
