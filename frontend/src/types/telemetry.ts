export interface TelemetryPacket {
  timestamp: string;
  tick: number;
  astronaut_id: string;
  astronaut_name: string;
  mission_state: 'REST' | 'WORKOUT' | 'SLEEP';
  heart_rate: number;
  hrv_rmssd: number;
  spo2: number;
  core_temp: number;
  sleep_score: number;
  cabin_co2: number;
  potassium?: number;
  hematocrit?: number;
  wbc_count?: number;
  il_6?: number;
  platelet_count?: number;
  crp?: number;
  computed_qtc?: number;
  computed_epi?: number;
  computed_arf?: number;
  computed_trm?: number;
  radiation_flux?: number;
  lymphocyte_count?: number;
  radiation_dose_gy?: number;
  computed_rsi?: number;
  scenario_phase: string;

  z_score_hr: number;
  z_score_hrv: number;
  evaluated_severity?: 'NOMINAL' | 'INFO' | 'WARNING' | 'CRITICAL';
  alert_severity?: string;
  confidence?: number;
  data_source?: string;
}

export interface EvidenceItem {
  metric: string;
  value: number;
  baseline_mean?: number;
  z_score?: number;
  clinical_finding: string;
}

export interface VisualizerToken {
  word: string;
  bands: number[];
}

export interface AlertPayload {
  id: string;
  timestamp: string;
  astronaut_id: string;
  astronaut_name: string;
  severity: 'NOMINAL' | 'INFO' | 'WARNING' | 'CRITICAL';
  tone: 'klaxon' | 'chime' | 'beep' | 'none';
  speech_text: string;
  source: string;
  is_fallback: boolean;
  duration_ms: number;
  reason: string;
  triage_diagnosis?: string;
  actionable_instruction?: string;
  confidence?: number;
  evidence_breakdown?: EvidenceItem[];
  visualizer_tokens?: VisualizerToken[];
  audio_config?: {
    rate: number;
    pitch: number;
    volume: number;
    voice: string;
  };
}

export interface CrewProfile {
  id: string;
  name: string;
  age: number;
  role: string;
  baselines: {
    [state in 'REST' | 'WORKOUT' | 'SLEEP']?: {
      heart_rate: { mean: number; std: number; unit: string };
      hrv_rmssd: { mean: number; std: number; unit: string };
      spo2: { mean: number; std: number; unit: string };
      core_temp: { mean: number; std: number; unit: string };
      sleep_score: { mean: number; std: number; unit: string };
    };
  };
}

export interface SystemHealth {
  status: string;
  system: string;
  streaming_hz: number;
  active_hud_clients: number;
  mars_latency_mode: boolean;
  loaded_crew_members: number;
}

export interface LabMarker {
  value: number | null;
  range_min?: number | null;
  range_max?: number | null;
  unit: string;
}

export interface CbcPanel {
  white_blood_cells?: LabMarker;
  red_blood_cells?: LabMarker;
  hemoglobin?: LabMarker;
  hematocrit?: LabMarker;
  platelets?: LabMarker;
  absolute_neutrophils?: LabMarker;
  neutrophils_percent?: LabMarker;
  absolute_lymphocytes?: LabMarker;
  lymphocytes_percent?: LabMarker;
  absolute_monocytes?: LabMarker;
  monocytes_percent?: LabMarker;
  absolute_eosinophils?: LabMarker;
  eosinophils_percent?: LabMarker;
  absolute_basophils?: LabMarker;
  basophils_percent?: LabMarker;
  mcv?: LabMarker;
  mch?: LabMarker;
  mchc?: LabMarker;
  rdw?: LabMarker;
  mpv?: LabMarker;
}

export interface CmpPanel {
  sodium?: LabMarker;
  potassium?: LabMarker;
  chloride?: LabMarker;
  carbon_dioxide?: LabMarker;
  calcium?: LabMarker;
  glucose?: LabMarker;
  bun?: LabMarker;
  creatinine?: LabMarker;
  bun_to_creatinine_ratio?: LabMarker;
  egfr_non_african_american?: LabMarker;
  egfr_african_american?: LabMarker;
  total_protein?: LabMarker;
  albumin?: LabMarker;
  globulin?: LabMarker;
  albumin_to_globulin_ratio?: LabMarker;
  alkaline_phosphatase?: LabMarker;
  alt?: LabMarker;
  ast?: LabMarker;
  total_bilirubin?: LabMarker;
}

export interface CvMarker {
  value: number | null;
  percent?: number | null;
  unit: string;
}

export interface CardiovascularPanel {
  crp?: CvMarker;
  fibrinogen?: CvMarker;
  l_selectin?: CvMarker;
  pf4?: CvMarker;
  haptoglobin?: CvMarker;
  a2_macroglobulin?: CvMarker;
  agp?: CvMarker;
  fetuin_a36?: CvMarker;
  sap?: CvMarker;
}

export interface CytokineMarker {
  concentration_pg_ml: number | null;
  percent?: number | null;
  unit: string;
}

export interface ImmunePanel {
  clusters: {
    pyrogens_and_inflammatory: Record<string, CytokineMarker>;
    interferons_and_viral: Record<string, CytokineMarker>;
    interleukins_and_tcell: Record<string, CytokineMarker>;
    chemokines_and_trafficking: Record<string, CytokineMarker>;
    growth_factors_and_remodeling: Record<string, CytokineMarker>;
  };
  all_cytokines: Record<string, CytokineMarker>;
  total_cytokines_count: number;
}

export interface CrewFullLabProfile {
  astronaut_id: string;
  nasa_osdr_subject: string;
  mission: string;
  timepoint: string;
  counts: {
    cbc_markers: number;
    cmp_markers: number;
    cv_proteins: number;
    cytokines: number;
    total_laboratory_markers: number;
  };
  cbc: CbcPanel;
  cmp: CmpPanel;
  cardiovascular: CardiovascularPanel;
  immune: ImmunePanel;
}

export type MeasurementMode = 'CONTINUOUS' | 'PERIODIC' | 'ON_DEMAND' | 'LAB';

export interface BiomarkerCadenceInfo {
  mode: MeasurementMode;
  intervalHours?: number;
  badgeLabel: string;
  isContinuous: boolean;
}

export interface StructuredClinicalReasoning {
  measuredData: string;
  detectedChange: string;
  patternCorrelation: string;
  possibleInterpretation: string;
  recommendedAssessment: string;
  diagnosticConfidence: number; // e.g. 94.8%
}

export type DistancePreset = 'LEO' | 'GATEWAY' | 'MARS_MIN' | 'MARS_MAX';

export interface OrbitalPositionInfo {
  km: number;
  label: string;
  delaySec: number;
  locationName: string;
}

export const C_LIGHT_KMS = 299792; // km/s

export const DISTANCES: Record<DistancePreset, OrbitalPositionInfo> = {
  LEO: { km: 408, label: 'LEO · <1 ms', delaySec: 0, locationName: 'Low Earth Orbit (ISS)' },
  GATEWAY: { km: 384400, label: 'Lunar Gateway · 1.3s', delaySec: 1.282, locationName: 'Lunar Gateway (Artemis)' },
  MARS_MIN: { km: 54600000, label: 'Mars Opposition · 3.0m', delaySec: 182.126, locationName: 'Mars Opposition (Transit)' },
  MARS_MAX: { km: 400200000, label: 'Mars Conjunction · 22.3m', delaySec: 1334.925, locationName: 'Mars Conjunction (Deep Space)' },
};

export function fmtTime(sec: number): string {
  if (sec < 0.001) return '<1 ms';
  if (sec < 1) return `${(sec * 1000).toFixed(0)} ms`;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

