import { evaluateCrewClinicalSummary, computeBiomarkerDelta } from '../src/utils/clinicalPrioritization';
import { computeClinicalViewKey } from '../src/hooks/useStabilizedClinicalSummary';
import { NASA_OSDR_PROFILES } from '../src/components/HealthTelemetryView';

console.log('--- TESTING CLINICAL PRIORITIZATION & ACCURATE CALCULATIONS ---');

let allPassed = true;
function assert(desc: string, condition: boolean, extra?: any) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`, extra);
    allPassed = false;
  }
}

// ── Test 1: Zero Baseline Delta (Radiation Dose) ──────────────────────────
{
  const res = computeBiomarkerDelta(0.45, 0.0, 'Gy', true);
  assert('Zero baseline returns +0.45 Gy without division by zero', res.deltaStr === '+0.45 Gy' && !Number.isNaN(res.pct));
}

// ── Test 2: Deadband Micro-Fluctuations (Clean Silence) ────────────────────
{
  const res = computeBiomarkerDelta(62.3, 62.0, 'bpm');
  assert('Micro-fluctuation within deadband returns empty string (Clean Silence)', res.deltaStr === '' && res.pct === 0);
}

// ── Test 3: Hypoxemia (Decompression) ─────────────────────────────────────
{
  const summary = evaluateCrewClinicalSummary('AST-01_COMMANDER', {
    astronaut_id: 'AST-01_COMMANDER',
    astronaut_name: 'Cmndr Haley',
    mission_state: 'REST',
    heart_rate: 132,
    hrv_rmssd: 32,
    spo2: 88.5,
    core_temp: 36.8,
    sleep_score: 82,
    cabin_co2: 1.2,
    scenario_phase: 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA',
    z_score_hr: 3.2,
    z_score_hrv: -2.1,
    tick: 100,
    timestamp: '2026-09-29T12:00:00Z',
  });

  assert('Hypoxemia severity is CRITICAL', summary.severity === 'CRITICAL');
  assert('Primary concern is RESPIRATORY', summary.primaryConcern.category === 'RESPIRATORY');
  assert('Top biomarker is SpO2', summary.prioritizedBiomarkers[0]?.id === 'spo2');
  assert('SpO2 delta is negative', summary.prioritizedBiomarkers[0]?.deltaStr.includes('↓'));
  assert('PRI drops appropriately (below 70%)', summary.physReserveIndex < 70 && summary.physReserveIndex >= 40, summary.physReserveIndex);
  assert('Explainable decision support mentions oxygen mask', summary.decisionSupport.recommendedAction.includes('O₂'));
}

// ── Test 4: Workout Gating (155 bpm HR during exercise) ───────────────────
{
  const summary = evaluateCrewClinicalSummary('AST-02_PILOT', {
    astronaut_id: 'AST-02_PILOT',
    astronaut_name: 'Pilot Chris',
    mission_state: 'WORKOUT',
    heart_rate: 154,
    hrv_rmssd: 28,
    spo2: 98.2,
    core_temp: 37.4,
    sleep_score: 88,
    cabin_co2: 1.0,
    scenario_phase: 'BASELINE_REST',
    z_score_hr: 4.8,
    z_score_hrv: -3.0,
    tick: 101,
    timestamp: '2026-09-29T12:01:00Z',
  });

  assert('Workout high HR with normal SpO2 is NOMINAL (gating works)', summary.severity === 'NOMINAL');
  assert('Primary concern category is WORKOUT', summary.primaryConcern.category === 'WORKOUT');
  assert('PRI remains resilient (> 85%)', summary.physReserveIndex >= 85, summary.physReserveIndex);
}

// ── Test 5: Hypokalemia (Arrhythmia Risk) ──────────────────────────────────
{
  const summary = evaluateCrewClinicalSummary('AST-03_MEDICAL', {
    astronaut_id: 'AST-03_MEDICAL',
    astronaut_name: 'Dr. Sian',
    mission_state: 'REST',
    heart_rate: 78,
    hrv_rmssd: 52,
    spo2: 98.0,
    core_temp: 36.9,
    sleep_score: 80,
    cabin_co2: 1.0,
    potassium: 3.10,
    computed_arf: 0.88,
    scenario_phase: 'HYPOKALEMIA',
    z_score_hr: 1.1,
    z_score_hrv: -0.8,
    tick: 102,
    timestamp: '2026-09-29T12:02:00Z',
  });

  assert('Severe Hypokalemia is CRITICAL', summary.severity === 'CRITICAL');
  assert('Primary concern is ELECTROLYTE or CARDIAC', summary.primaryConcern.category === 'ELECTROLYTE' || summary.primaryConcern.category === 'CARDIAC');
  assert('KCl repletion is recommended', summary.decisionSupport.recommendedAction.includes('KCl'));
}

// ── Test 6: Solar Storm Radiation Flux ────────────────────────────────────
{
  const summary = evaluateCrewClinicalSummary('AST-04_ENGINEER', {
    astronaut_id: 'AST-04_ENGINEER',
    astronaut_name: 'Specialist Leo',
    mission_state: 'REST',
    heart_rate: 68,
    hrv_rmssd: 58,
    spo2: 98.1,
    core_temp: 36.8,
    sleep_score: 84,
    cabin_co2: 1.0,
    radiation_flux: 84.0,
    radiation_dose_gy: 0.42,
    computed_rsi: 0.92,
    scenario_phase: 'SCENARIO_3_SOLAR_RADIATION_STORM',
    z_score_hr: 0.5,
    z_score_hrv: -0.3,
    tick: 103,
    timestamp: '2026-09-29T12:03:00Z',
  });

  assert('Solar storm is CRITICAL', summary.severity === 'CRITICAL');
  assert('Primary concern is RADIATION', summary.primaryConcern.category === 'RADIATION');
  assert('Top biomarker is FLUX', summary.prioritizedBiomarkers[0]?.id === 'flux');
  assert('Storm shelter is recommended', summary.decisionSupport.recommendedAction.includes('Storm Haven'));
}

// ── Test 7: Completely Nominal Crew Member (Commander Haley at rest) ──────
{
  const summary = evaluateCrewClinicalSummary('AST-01_COMMANDER', undefined);
  assert('Undefined telemetry safely falls back to nominal baseline', summary.severity === 'NOMINAL');
  assert('Is not abnormal', summary.isAbnormal === false);
  assert('Primary concern is NOMINAL', summary.primaryConcern.category === 'NOMINAL');
  assert('PRI is high (>= 95%)', summary.physReserveIndex >= 95, summary.physReserveIndex);
  assert('Vitals are nominal', summary.nominalVitals.hr.isNominal && summary.nominalVitals.spo2.isNominal);
}

// ── Test 8: 1-Second Dwell Filter & View Key Invariance ──────────────────
{
  const nominalSummary1 = evaluateCrewClinicalSummary('AST-01_COMMANDER', undefined);
  const nominalSummary2 = evaluateCrewClinicalSummary('AST-01_COMMANDER', {
    astronaut_id: 'AST-01_COMMANDER',
    astronaut_name: 'Cmndr Haley',
    mission_state: 'REST',
    heart_rate: 61, // minor 1 bpm variation within nominal
    hrv_rmssd: 65,
    spo2: 98.2,
    core_temp: 36.8,
    sleep_score: 86,
    cabin_co2: 1.8,
    tick: 1,
    timestamp: '2026-09-29T12:00:00Z',
  });

  const key1 = computeClinicalViewKey(nominalSummary1);
  const key2 = computeClinicalViewKey(nominalSummary2);

  assert('Nominal baseline view key is NOMINAL', key1 === 'NOMINAL');
  assert('Minor nominal telemetry variation preserves view key', key2 === 'NOMINAL');

  const alertSummary = evaluateCrewClinicalSummary('AST-01_COMMANDER', {
    astronaut_id: 'AST-01_COMMANDER',
    astronaut_name: 'Cmndr Haley',
    mission_state: 'REST',
    heart_rate: 130,
    hrv_rmssd: 30,
    spo2: 87.0,
    core_temp: 36.8,
    sleep_score: 80,
    cabin_co2: 1.8,
    scenario_phase: 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA',
    tick: 2,
    timestamp: '2026-09-29T12:00:01Z',
  });

  const alertKey = computeClinicalViewKey(alertSummary);
  assert('Alert view key differentiates from NOMINAL', alertKey.startsWith('CRITICAL::'));

  // Temporal Dwell Simulation (10 Hz = 100ms packets):
  // Simulation A: Transient spike lasting 300ms (3 ticks), then reverts to nominal.
  // Must NOT trigger view switch!
  let simulatedCommittedKey = key1;
  let candidateKey = key1;
  let candidateStartTime = 0;
  const dwellMs = 1000;

  function simulatePacket(timeMs: number, incomingKey: string) {
    if (incomingKey === simulatedCommittedKey) {
      candidateKey = incomingKey;
      candidateStartTime = 0;
      return simulatedCommittedKey;
    }
    if (candidateKey !== incomingKey) {
      candidateKey = incomingKey;
      candidateStartTime = timeMs;
    } else if (timeMs - candidateStartTime >= dwellMs) {
      simulatedCommittedKey = candidateKey;
    }
    return simulatedCommittedKey;
  }

  // 0ms: Nominal
  simulatePacket(0, key1);
  // 100ms, 200ms, 300ms: Transient spike
  simulatePacket(100, alertKey);
  simulatePacket(200, alertKey);
  simulatePacket(300, alertKey);
  // 400ms: Reverts back to nominal
  const resultAfterSpike = simulatePacket(400, key1);
  assert('Transient 300ms spike does not switch view (remains NOMINAL)', resultAfterSpike === 'NOMINAL');

  // Simulation B: Sustained emergency lasting > 1000ms
  // 500ms to 1600ms (1100ms duration):
  for (let t = 500; t <= 1600; t += 100) {
    simulatePacket(t, alertKey);
  }
  assert('Sustained emergency for >= 1000ms switches view to CRITICAL', simulatedCommittedKey.startsWith('CRITICAL::'));
}

console.log('--- ALL CLINICAL TESTS RESULT: ', allPassed ? 'SUCCESS (ALL PASSED)' : 'FAILURE');
if (!allPassed) process.exit(1);
