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
