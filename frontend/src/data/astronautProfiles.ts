/**
 * NASA Spaceflight Baselines & OSDR Inspiration4 Laboratory Profiles
 * Pure data models decoupled from React components for zero-overhead bundle chunking.
 */

export interface CrewBaselineAndLabProfile {
  // Baseline Vitals from NASA Spaceflight Baselines
  restHr: number;
  restHrv: number;
  restSpo2: number;
  restTemp: number;
  restSleep: number;
  // Authentic NASA OSDR Inspiration4 Laboratory Values (OSD-569 CBC, OSD-575 CMP, CV, Immune)
  wbc: number; // k/μL
  hct: number; // %
  plt: number; // k/μL
  hgb: number; // g/dL
  rbc: number; // M/μL
  na: number; // mmol/L
  k: number; // mmol/L
  glu: number; // mg/dL
  bun: number; // mg/dL
  cr: number; // mg/dL
  alb: number; // g/dL
  alt: number; // U/L
  ast: number; // U/L
  crp: number; // mg/L
  fibrinogen: number; // mg/dL
  tnf: number; // pg/mL
  il6: number; // pg/mL
  ifn: number; // pg/mL
  il1b: number; // pg/mL
}

export const NASA_OSDR_PROFILES: Record<string, CrewBaselineAndLabProfile> = {
  'AST-01_COMMANDER': {
    restHr: 62.0,
    restHrv: 65.0,
    restSpo2: 98.2,
    restTemp: 36.80,
    restSleep: 86.0,
    wbc: 5.0,
    hct: 43.6,
    plt: 227.0,
    hgb: 14.7,
    rbc: 4.84,
    na: 138.0,
    k: 4.40,
    glu: 90.0,
    bun: 18.0,
    cr: 1.12,
    alb: 4.9,
    alt: 9.0,
    ast: 16.0,
    crp: 1.06,
    fibrinogen: 260.0,
    tnf: 75.8,
    il6: 6.86,
    ifn: 3.4,
    il1b: 58.0,
  },
  'AST-02_PILOT': {
    restHr: 58.0,
    restHrv: 72.0,
    restSpo2: 98.5,
    restTemp: 36.70,
    restSleep: 88.0,
    wbc: 5.5,
    hct: 36.4,
    plt: 252.0,
    hgb: 14.8,
    rbc: 4.85,
    na: 137.0,
    k: 3.52,
    glu: 85.0,
    bun: 16.0,
    cr: 0.95,
    alb: 4.4,
    alt: 16.0,
    ast: 23.0,
    crp: 0.70,
    fibrinogen: 220.0,
    tnf: 65.0,
    il6: 4.2,
    ifn: 2.8,
    il1b: 40.0,
  },
  'AST-03_MEDICAL': {
    restHr: 66.0,
    restHrv: 58.0,
    restSpo2: 98.0,
    restTemp: 36.90,
    restSleep: 82.0,
    wbc: 7.0,
    hct: 41.4,
    plt: 359.0,
    hgb: 13.5,
    rbc: 4.67,
    na: 137.0,
    k: 4.20,
    glu: 103.0,
    bun: 21.0,
    cr: 0.89,
    alb: 4.2,
    alt: 19.0,
    ast: 18.0,
    crp: 1.06,
    fibrinogen: 453.0,
    tnf: 724.2,
    il6: 7.60,
    ifn: 4.2,
    il1b: 65.1,
  },
  'AST-04_ENGINEER': {
    restHr: 64.0,
    restHrv: 61.0,
    restSpo2: 98.3,
    restTemp: 36.84,
    restSleep: 84.0,
    wbc: 8.1,
    hct: 48.3,
    plt: 240.0,
    hgb: 16.5,
    rbc: 5.55,
    na: 140.0,
    k: 4.00,
    glu: 97.0,
    bun: 26.0,
    cr: 1.15,
    alb: 4.5,
    alt: 40.0,
    ast: 48.0,
    crp: 1.77,
    fibrinogen: 419.0,
    tnf: 111.8,
    il6: 6.34,
    ifn: 3.6,
    il1b: 110.2,
  },
};

export const getAstronautOsdrProfile = (id: string): CrewBaselineAndLabProfile => {
  if (id === 'AST-03_MEDICAL_SPECIALIST') return NASA_OSDR_PROFILES['AST-03_MEDICAL'];
  if (id === 'AST-04_MISSION_SPECIALIST') return NASA_OSDR_PROFILES['AST-04_ENGINEER'];
  return NASA_OSDR_PROFILES[id] || NASA_OSDR_PROFILES['AST-01_COMMANDER'];
};

