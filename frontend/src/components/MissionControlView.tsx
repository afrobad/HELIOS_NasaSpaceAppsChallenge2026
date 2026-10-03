import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { TelemetryPacket, AlertPayload, DistancePreset } from '../types/telemetry';
import { DISTANCES, C_LIGHT_KMS as C, fmtTime } from '../types/telemetry';
import { HolographicBodyScanner } from './HolographicBodyScanner';
import { CrewGrid } from './CrewGrid';
import { CabinEnvironmentalBar } from './CabinEnvironmentalBar';
import { NASA_OSDR_PROFILES } from './HealthTelemetryView';

// ─────────────────────────────────────────────────────────────
// MCC Design Tokens — Refined Olive-Charcoal Operational Palette
// ─────────────────────────────────────────────────────────────
const T = {
  bg: '#070a07', // Darker, rich aerospace olive-black
  surface: 'linear-gradient(180deg, #181d22 0%, #0f1316 100%)', // Signature aerospace container gradient
  surfaceHover: 'linear-gradient(180deg, #20262c 0%, #161a1e 100%)',
  surfaceFlat: '#14181c',
  surfaceElevated: '#1e242a',
  surfaceRecessed: '#0b0e11', // Dark inset & badge background
  border: '#283548', // Refined slate-gray border
  borderSubtle: '#1f2732',
  borderHighlight: '#445366',
  textPrimary: '#ffffff', // Brilliant pure white for vital numbers & headings
  textSecondary: '#b8cbde', // Crisp, high-contrast readable slate for labels & copy (was #8d99a6)
  textMuted: '#849db5', // Legible secondary metadata & units (was #58626e)
  nominal: '#5ebd4c',
  nominalBg: '#090e0a',
  nominalBorder: '#1c3d1e',
  warning: '#e6a83c',
  warningBg: '#141008',
  warningBorder: '#4a3410',
  critical: '#ff4d4d',
  criticalBg: '#140808',
  criticalBorder: '#4a1515',
  active: '#3c4c5c',
  activeBg: '#11161c',
  activeBorder: '#4a5b6d',
  tabBg: '#0c0f12',
  tabBorder: '#2c3642',
  tabActiveBg: 'rgba(56, 189, 248, 0.30)',
  tabActiveBorder: 'rgba(56, 189, 248, 0.55)',
  info: '#7ea4cb',
  mono: "'SF Mono', 'Cascadia Code', Consolas, 'Liberation Mono', monospace",
  sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
} as const;

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────
export interface MissionControlViewProps {
  telemetryMap: Record<string, TelemetryPacket>;
  latestAlert?: AlertPayload | null;
  connected: boolean;
  marsDelay?: boolean;
  onToggleMarsDelay?: (enabled: boolean) => void;
  orbitalPosition?: DistancePreset;
  onSelectOrbitalPosition?: (pos: DistancePreset) => void;
  speedMultiplier?: number;
  onSpeedMultiplierChange?: (speed: number) => void;
  onSelectView: (view: 'HUD' | 'HEALTH_TELEMETRY' | 'MCC') => void;
  currentScenario?: string;
  onOpenTriage?: (astronautId: string) => void;
}

type MCCTab = 'OVERVIEW' | 'CREW' | 'SYSTEMS' | 'COMMS' | 'INVESTIGATE';

interface TimelineStep {
  time: string;
  delta: string;
  signal: string;
  finding: string;
  severity: 'NOMINAL' | 'WARNING' | 'CRITICAL';
}

interface FlightProcedure {
  id: string;
  title: string;
  category: string;
  steps: { step: number; text: string; role: string; notes?: string }[];
}

const PROCEDURES: Record<string, FlightProcedure> = {
  'M-204': {
    id: 'M-204',
    title: 'M-204 Cardiovascular & Exertion Excursion Countermeasure',
    category: 'Flight Medicine / Cardiology',
    steps: [
      { step: 1, text: 'Confirm 10 Hz continuous biometric telemetry lock & baseline variance on Flight Console.', role: 'SURGEON' },
      { step: 2, text: 'Direct crew member (CREW-02 Pilot) to suspend high-intensity physical activity and rest in recumbent position.', role: 'CAPCOM' },
      { step: 3, text: 'Direct Medical Officer (CREW-03) to inspect 12-lead ECG telemetry and verify absence of dysrhythmia.', role: 'SURGEON' },
      { step: 4, text: 'Increase personal airflow cooling duct and evaluate Moran Physiological Strain Index (PSI).', role: 'ECLSS' },
      { step: 5, text: 'Administer oral electrolyte rehydration solution (500 mL) to counter hypovolemic cardiac drift.', role: 'SURGEON' },
      { step: 6, text: 'Maintain continuous 15-minute trending observation gate until HR stabilizes within +15% of baseline.', role: 'FLIGHT' },
    ],
  },
  'NASA-STD-3001-MED-CARD-04': {
    id: 'NASA-STD-3001-MED-CARD-04',
    title: 'Acute Tachyarrhythmia & Electrolyte Countermeasure',
    category: 'Flight Medicine / Cardiology',
    steps: [
      { step: 1, text: 'Confirm 10 Hz continuous biometric telemetry lock & baseline variance on Flight Computer.', role: 'SURGEON' },
      { step: 2, text: 'Direct Medical Officer (CMO) to apply 12-lead ECG telemetry patch to affected crew member.', role: 'CAPCOM' },
      { step: 3, text: 'Review point-of-care serum potassium (K⁺) assay and calculated QTc Fridericia interval.', role: 'SURGEON' },
      { step: 4, text: 'If K⁺ < 3.8 mmol/L or QTc > 450 ms, authorize oral potassium chloride supplement pack (20 mEq).', role: 'SURGEON' },
      { step: 5, text: 'Decrease habitat ambient temperature by 1.0°C and verify oral hydration intake minimum 500 mL.', role: 'ECLSS' },
      { step: 6, text: 'Maintain 10-minute automated telemetry trending gate before returning to nominal duty status.', role: 'FLIGHT' },
    ],
  },
  'NASA-STD-3001-ECLSS-CO2-01': {
    id: 'NASA-STD-3001-ECLSS-CO2-01',
    title: 'Elevated Cabin CO₂ Excursion & Scrubber Saturation Protocol',
    category: 'Life Support / Environmental',
    steps: [
      { step: 1, text: 'Verify primary Amine / LiOH regenerative scrubber valve status and differential pressure.', role: 'ECLSS' },
      { step: 2, text: 'Command automated valve transition to secondary regenerative CO₂ scrubber bed (Bed B).', role: 'ECLSS' },
      { step: 3, text: 'Increase habitat inter-module air circulation fan speed to High (0.8 m/s) to prevent pockets.', role: 'ECLSS' },
      { step: 4, text: 'Advise crew via DSN uplink to terminate strenuous exercise until cabin CO₂ falls below 2.4 mmHg.', role: 'CAPCOM' },
      { step: 5, text: 'Direct crew to check for mild cognitive fatigue or hypercapnic headache symptoms.', role: 'SURGEON' },
      { step: 6, text: 'Confirm backup LiOH canister mechanical seals intact for contingency manual installation.', role: 'ECLSS' },
    ],
  },
  'NASA-STD-3001-MED-CARD-02': {
    id: 'NASA-STD-3001-MED-CARD-02',
    title: 'High Physiological Strain & Thermal Exertion Protocol',
    category: 'Flight Medicine / Exercise Physiology',
    steps: [
      { step: 1, text: 'Verify Moran Physiological Strain Index (PSI) and evaluate core temperature vs baseline.', role: 'SURGEON' },
      { step: 2, text: 'Command astronaut to conclude current high-intensity resistive/aerobic workout block.', role: 'CAPCOM' },
      { step: 3, text: 'Initiate personal airflow cooling duct and verify crew liquid cooling garment function.', role: 'ECLSS' },
      { step: 4, text: 'Administer 500 mL chilled electrolyte solution and monitor HR deceleration slope.', role: 'SURGEON' },
    ],
  },
  'NASA-STD-3001-RAD-SPE-01': {
    id: 'NASA-STD-3001-RAD-SPE-01',
    title: 'Solar Particle Event Radiation Shelter Protocol',
    category: 'Space Environment / Radiation Health',
    steps: [
      { step: 1, text: 'Confirm solar proton flux > 10 MeV threshold on HERA and CAD silicon detectors.', role: 'SURGEON' },
      { step: 2, text: 'Direct all 4 crew members to terminate EVA and transfer into storm shelter.', role: 'CAPCOM' },
      { step: 3, text: 'Deploy supplemental water-wall radiation shielding around central habitat core.', role: 'ECLSS' },
      { step: 4, text: 'Perform serial leukocyte assay and calculate Radiation Susceptibility Index (RSI).', role: 'SURGEON' },
      { step: 5, text: 'Maintain dosimeter logging rate at 10 Hz until geomagnetic / solar flux recedes.', role: 'FLIGHT' },
    ],
  },
  'NASA-STD-3001-THROMB-01': {
    id: 'NASA-STD-3001-THROMB-01',
    title: 'Internal Jugular Venous Thrombosis Countermeasure',
    category: 'Vascular Medicine / Microgravity Hemodynamics',
    steps: [
      { step: 1, text: 'Verify TRM risk index > 1.50 and evaluate internal jugular venous flow stagnation.', role: 'SURGEON' },
      { step: 2, text: 'Command astronaut recumbency with lower body negative pressure (LBNP) therapy.', role: 'FLIGHT' },
      { step: 3, text: 'Initiate oral hydration fluid expansion (750 mL balanced electrolyte solution).', role: 'SURGEON' },
      { step: 4, text: 'Prepare subcutaneous low-molecular-weight heparin (Enoxaparin 40 mg).', role: 'SURGEON' },
      { step: 5, text: 'Perform serial point-of-care vascular compression ultrasound of jugular flow.', role: 'SURGEON' },
    ],
  },
  'NASA-STD-3001-ECLSS-AMMONIA-01': {
    id: 'NASA-STD-3001-ECLSS-AMMONIA-01',
    title: 'External/Internal Ammonia Coolant Breach Containment',
    category: 'Life Support / Hazardous Materials',
    steps: [
      { step: 1, text: 'Command all crew to don emergency quick-don positive pressure breathing masks.', role: 'ALL CREW' },
      { step: 2, text: 'Isolate suspected thermal loop heat exchanger isolation valves.', role: 'ECLSS' },
      { step: 3, text: 'Deploy catalytic ammonia trace contaminant filter scrubbers in hab module.', role: 'ECLSS' },
      { step: 4, text: 'Direct crew to report ocular burning or mucosal irritation symptoms to CMO.', role: 'SURGEON' },
      { step: 5, text: 'Verify cabin atmosphere below OSHA/NASA 10 ppm permissible limit.', role: 'FLIGHT' },
    ],
  },
};

interface MissionEvent {
  id: string;
  time: string;
  priority: 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NOMINAL';
  entity: string;
  astronautId?: string;
  subsystem: string;
  summary: string;
  age: string;
  trend: 'WORSENING' | 'STABLE' | 'IMPROVING' | 'UNCERTAIN';
  trajectory: 'WORSENING' | 'STABLE' | 'IMPROVING' | 'UNCERTAIN';
  timeToLimit: string;
  evidenceStrength: 'HIGH' | 'MODERATE' | 'LOW';
  signalsCount: number;
  acknowledged: boolean;
  observed: string[];
  derived: string[];
  correlated: string[];
  possibleFactors: string[];
  actionsToEvaluate: string[];
  procedure?: string;
  confidence: string;
  provenance: string;
  evidence: string;
  baselineRef: string;
  timelineSequence?: TimelineStep[];
}



// Crew metadata — matches NASA MCC reference & OSDR OSD-575/569 profiles
const CREW = [
  { id: 'AST-01_COMMANDER', crewNo: 'CREW-01', name: 'Haley', role: 'Commander', callsign: 'CDR', baseHr: 78, baseSpo2: 98.0, baseResp: 14, baseTemp: 36.6, baseHrv: 65, baseBp: '118/78', avatarInitial: 'CDR' },
  { id: 'AST-02_PILOT', crewNo: 'CREW-02', name: 'Chris', role: 'Pilot', callsign: 'PLT', baseHr: 82, baseSpo2: 98.0, baseResp: 14, baseTemp: 36.4, baseHrv: 72, baseBp: '120/80', avatarInitial: 'PLT' },
  { id: 'AST-03_MEDICAL', crewNo: 'CREW-03', name: 'Sian', role: 'Mission Specialist', callsign: 'MS1', baseHr: 76, baseSpo2: 97.0, baseResp: 15, baseTemp: 36.8, baseHrv: 60, baseBp: '122/82', avatarInitial: 'MS1' },
  { id: 'AST-04_ENGINEER', crewNo: 'CREW-04', name: 'Leo', role: 'Mission Specialist', callsign: 'MS2', baseHr: 72, baseSpo2: 99.0, baseResp: 13, baseTemp: 36.4, baseHrv: 62, baseBp: '116/76', avatarInitial: 'MS2' },
] as const;

// DSN stations
const DSN = [
  { name: 'DSS-14 Goldstone', loc: 'California', freq: 'X-Band 8.45 GHz', snr: 38.4 },
  { name: 'DSS-63 Madrid', loc: 'Spain', freq: 'Ka-Band 32 GHz', snr: 35.1 },
  { name: 'DSS-43 Canberra', loc: 'Australia', freq: 'X-Band 8.45 GHz', snr: 36.9 },
] as const;


function pctDelta(current: number, baseline: number): string {
  if (baseline === 0) return '—';
  const d = ((current - baseline) / baseline) * 100;
  const sign = d >= 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}%`;
}

function absDelta(current: number, baseline: number): string {
  const d = current - baseline;
  const sign = d >= 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}`;
}

function severityColor(s?: string): string {
  if (s === 'CRITICAL') return T.critical;
  if (s === 'WARNING') return T.warning;
  if (s === 'ADVISORY' || s === 'INFO') return T.info;
  return T.nominal;
}

function severityBorder(s?: string): string {
  if (s === 'CRITICAL') return T.criticalBorder;
  if (s === 'WARNING') return T.warningBorder;
  if (s === 'ADVISORY' || s === 'INFO') return '#2a3a4a';
  return T.nominalBorder;
}

function trendArrow(trend: string): string {
  if (trend === 'WORSENING') return '↗';
  if (trend === 'IMPROVING') return '↘';
  if (trend === 'STABLE') return '→';
  return '?';
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export const MissionControlView: React.FC<MissionControlViewProps> = ({
  telemetryMap,
  latestAlert,
  connected,
  marsDelay = false,
  onToggleMarsDelay,
  orbitalPosition: propOrbitalPosition,
  onSelectOrbitalPosition,
  speedMultiplier: propSpeedMultiplier,
  onSpeedMultiplierChange,
  onSelectView,
  onOpenTriage,
  currentScenario,
}) => {
  const [tab, setTab] = useState<MCCTab>('OVERVIEW');
  const [sysCategoryFilter, setSysCategoryFilter] = useState<'ALL' | 'ECLSS' | 'WEARABLE' | 'LAB' | 'RADIATION' | 'COUNTERMEASURE'>('ALL');
  const [selEventId, setSelEventId] = useState<string | null>(null);
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [distPreset, setDistPreset] = useState<DistancePreset>(propOrbitalPosition || (marsDelay ? 'MARS_MAX' : 'LEO'));

  // ─── TOP ORBITAL TELEMETRY & SIMULATION TIME ACCELERATION STATE ───
  const [orbitalPosition, setOrbitalPosition] = useState<DistancePreset>(propOrbitalPosition || (marsDelay ? 'MARS_MAX' : 'LEO'));
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(propSpeedMultiplier || 1);
  const [earthTime, setEarthTime] = useState<Date>(() => new Date());
  const [simMetSeconds, setSimMetSeconds] = useState<number>(14 * 86400 + 8 * 3600 + 42 * 60 + 15); // T+14d 08:42:15
  const [backendAlerts, setBackendAlerts] = useState<any[]>([]);

  // Two-way synchronization with parent props
  useEffect(() => {
    if (propOrbitalPosition && propOrbitalPosition !== orbitalPosition) {
      setOrbitalPosition(propOrbitalPosition);
      setDistPreset(propOrbitalPosition);
    }
  }, [propOrbitalPosition]);

  useEffect(() => {
    if (propSpeedMultiplier !== undefined && propSpeedMultiplier !== speedMultiplier) {
      setSpeedMultiplier(propSpeedMultiplier);
    }
  }, [propSpeedMultiplier]);

  const handleSpeedChange = (spd: number) => {
    setSpeedMultiplier(spd);
    if (onSpeedMultiplierChange) {
      onSpeedMultiplierChange(spd);
    }
  };

  // Simulation Clock Tick accelerated by speedMultiplier (1x, 2x, 5x, 10x)
  useEffect(() => {
    const timer = setInterval(() => {
      setEarthTime(new Date());
      setSimMetSeconds(prev => prev + speedMultiplier);
    }, 1000);
    return () => clearInterval(timer);
  }, [speedMultiplier]);

  // Format Mission Elapsed Time (MET)
  const formatSimMet = (totalSec: number) => {
    const days = Math.floor(totalSec / 86400);
    const rem = totalSec % 86400;
    const hrs = Math.floor(rem / 3600);
    const mins = Math.floor((rem % 3600) / 60);
    const secs = rem % 60;
    return `T+${days}d ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Live Spacecraft Onboard UTC derived from simulated epoch
  const simUtcTime = new Date(Date.now() + (simMetSeconds - (14 * 86400 + 8 * 3600 + 42 * 60 + 15)) * 1000)
    .toISOString()
    .substring(11, 19) + ' UTC';

  // Fetch real alerts from backend /api/alerts database
  useEffect(() => {
    const fetchBackendAlerts = async () => {
      try {
        const res = await fetch('/api/alerts');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.alerts)) {
            setBackendAlerts(data.alerts);
          }
        }
      } catch (err) {
        // silent fallback
      }
    };
    fetchBackendAlerts();
    const alertPoll = setInterval(fetchBackendAlerts, 3000);
    return () => clearInterval(alertPoll);
  }, []);

  // When latestAlert prop updates via WebSocket from backend, prepend immediately
  useEffect(() => {
    if (latestAlert) {
      setBackendAlerts(prev => {
        if (prev.some(a => String(a.id) === String(latestAlert.id))) return prev;
        return [
          {
            id: latestAlert.id,
            astronaut_id: latestAlert.astronaut_id,
            timestamp: latestAlert.timestamp || new Date().toISOString(),
            severity: latestAlert.severity,
            trigger_reason: latestAlert.speech_text || 'Autonomous Sentry Violation',
            confidence: latestAlert.confidence || 0.95,
          },
          ...prev,
        ];
      });
    }
  }, [latestAlert]);

  // Handler for Orbital Position change (updates delay and syncs with backend and HeaderBar)
  const handleOrbitalPositionSelect = (pos: DistancePreset) => {
    setOrbitalPosition(pos);
    setDistPreset(pos);
    if (onSelectOrbitalPosition) {
      onSelectOrbitalPosition(pos);
    }
    const isDelayed = pos === 'MARS_MIN' || pos === 'MARS_MAX';
    if (onToggleMarsDelay) {
      onToggleMarsDelay(isDelayed);
    }
    // Also post directly to backend API
    fetch('/api/mars-delay?enabled=' + (isDelayed ? 'true' : 'false'), { method: 'POST' }).catch(() => {});
  };
  const [dsnIdx, setDsnIdx] = useState(0);
  const [selCrewId, setSelCrewId] = useState<string>('AST-02_PILOT');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '12h' | '24h' | 'Custom'>('6h');
  const [crewSubTab, setCrewSubTab] = useState<'Overview' | '3D Bio-Scanner' | 'Trends' | 'Correlation' | 'Baseline & Deviation' | 'Medical History' | 'Procedures'>('Overview');
  const [diffMode, setDiffMode] = useState<boolean>(false);
  const [showHandover, setShowHandover] = useState(false);
  const [activeProcedureId, setActiveProcedureId] = useState<string | null>(null);
  const [procedureChecks, setProcedureChecks] = useState<Record<string, boolean>>({});
  const [copiedHandover, setCopiedHandover] = useState(false);

  // Rotate DSN
  useEffect(() => {
    const t = setInterval(() => setDsnIdx(p => (p + 1) % DSN.length), 45000);
    return () => clearInterval(t);
  }, []);

  // Propagation
  const prop = useMemo(() => {
    const d = DISTANCES[distPreset];
    const ow = d.km / C;
    return { ...d, owSec: ow, owFmt: fmtTime(ow), rtFmt: fmtTime(ow * 2) };
  }, [distPreset]);

  // ─── DERIVE MISSION EVENTS FROM LIVE TELEMETRY & BACKEND DB ALERTS ───
  const events: MissionEvent[] = useMemo(() => {
    const evts: MissionEvent[] = [];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 1. Incorporate real backend database alerts from SQLite /api/alerts
    backendAlerts.forEach((al: any) => {
      const crew = CREW.find(c => c.id === al.astronaut_id);
      const entity = al.astronaut_id === 'ALL_CREW' ? 'All Stations (Cabin Atmosphere)' : (crew ? `Crew ${crew.callsign} · ${crew.name}` : al.astronaut_id);
      const timeStr = al.timestamp ? (al.timestamp.includes('T') ? al.timestamp.substring(11, 19) : al.timestamp.substring(11, 19) || al.timestamp) : now;
      const sev = (al.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING') as 'CRITICAL' | 'WARNING';

      evts.push({
        id: `DB-ALERT-${al.id}`,
        time: timeStr,
        priority: sev,
        entity,
        astronautId: al.astronaut_id,
        subsystem: al.astronaut_id === 'ALL_CREW' ? 'ECLSS / Atmosphere' : 'Cardiovascular',
        summary: al.trigger_reason || 'Autonomous AI Sentry Threshold Excursion',
        age: '< 2m',
        trend: 'WORSENING',
        trajectory: 'WORSENING',
        timeToLimit: '10m evaluation gate',
        evidenceStrength: 'HIGH',
        signalsCount: 4,
        acknowledged: !!acked[`DB-ALERT-${al.id}`],
        observed: [
          al.trigger_reason || 'Active excursion logged in flight database',
          al.voice_spoken_text || 'Sentry automated acoustic alert active',
        ],
        derived: [
          `Bayesian multi-signal confidence: ${Math.round((al.confidence || 0.95) * 100)}%`,
          `Recorded in telemetry database (Alert ID: ${al.id})`,
        ],
        correlated: [
          'Live database synchronization verified via /api/alerts',
          'Biomarker pattern correlated across telemetry bus',
        ],
        possibleFactors: [
          'Atmospheric scrubber anomaly or elevated CO₂',
          'Intense physical exertion / metabolic spike',
        ],
        actionsToEvaluate: [
          'Review 10-minute cardiovascular and oxygenation trends',
          'Verify life support loop pressurization and flow rate',
        ],
        procedure: 'NASA-STD-3001-MED-CARD-04',
        confidence: `CONFIRMED · ${Math.round((al.confidence || 0.95) * 100)}% Bayesian certainty`,
        provenance: 'SQLite Database /api/alerts · sentry_matrix.py',
        evidence: al.trigger_reason || 'Recorded Flight Event',
        baselineRef: 'NASA-STD-3001 Vol 1/2 Clinical Corridor',
        timelineSequence: [
          { time: timeStr, delta: 'T-00m 00s', signal: 'AI Sentry Engine', finding: al.trigger_reason || 'Alert confirmed', severity: sev },
        ],
      });
    });

    // 2. Derive scenario-aware physiological & environmental excursions from live telemetryMap
    const scenarioKey = currentScenario || Object.values(telemetryMap)[0]?.scenario_phase || 'NOMINAL_CRUISE';
    const isCo2Scen = scenarioKey.includes('CO2') || (Object.values(telemetryMap)[0]?.cabin_co2 || 0) > 3.0;
    const isHypokalemiaScen = scenarioKey.includes('HYPOKALEMIA');
    const isRadiationScen = scenarioKey.includes('RADIATION') || scenarioKey.includes('SOLAR');
    const isThrombosisScen = scenarioKey.includes('THROMBOSIS');
    const isAmmoniaScen = scenarioKey.includes('AMMONIA') || scenarioKey.includes('COOLANT');

    Object.entries(telemetryMap).forEach(([astId, pkt]) => {
      const crew = CREW.find(c => c.id === astId);
      if (!crew) return;
      const hrD = ((pkt.heart_rate - crew.baseHr) / crew.baseHr) * 100;
      const spo2D = pkt.spo2 - crew.baseSpo2;

      // Special Scenario: Acute Hypokalemia & Tachyarrhythmia
      if (isHypokalemiaScen || (pkt.potassium !== undefined && pkt.potassium < 3.5) || (pkt.computed_qtc && pkt.computed_qtc > 450)) {
        const kVal = pkt.potassium !== undefined ? pkt.potassium : 3.20;
        const qtcVal = pkt.computed_qtc || 482;
        const arfVal = pkt.computed_arf || 1.85;
        const isCrit = kVal < 3.2 || qtcVal > 480;

        evts.push({
          id: `HYPO-${astId}`,
          time: now,
          priority: isCrit ? 'CRITICAL' : 'WARNING',
          entity: `Crew ${crew.callsign} · ${crew.name}`,
          astronautId: astId,
          subsystem: 'Cardiology / Electrolytes',
          summary: `Serum K⁺ ${kVal.toFixed(2)} mmol/L · QTc ${qtcVal.toFixed(0)} ms Prolongation`,
          age: '< 2m',
          trend: 'WORSENING',
          trajectory: 'WORSENING',
          timeToLimit: '6 min to Ectopic Gate',
          evidenceStrength: 'HIGH',
          signalsCount: 4,
          acknowledged: !!acked[`HYPO-${astId}`],
          observed: [
            `Serum Potassium (K⁺): ${kVal.toFixed(2)} mmol/L (Floor: 3.50 mmol/L)`,
            `Fridericia QTc Interval: ${qtcVal.toFixed(0)} ms (Gate: 450 ms)`,
            `Heart Rate: ${pkt.heart_rate.toFixed(0)} bpm (baseline: ${crew.baseHr} bpm)`,
            `Arrhythmogenic Risk Factor (ARF): ${arfVal.toFixed(2)} (Safe: < 1.0)`,
          ],
          derived: [
            `I_Kr repolarization delay: +${(qtcVal - 402).toFixed(0)} ms above baseline`,
            `Hypokalemic shift: ${(kVal - 4.4).toFixed(2)} mmol/L below mean`,
          ],
          correlated: [
            'ST segment flattening observed on 12-lead ECG telemetry',
            'Compensatory chronotropic rate surge',
          ],
          possibleFactors: [
            'Microgravity fluid redistribution & aldosterone mineral excretion',
            'Intense exercise session without electrolyte replacement',
          ],
          actionsToEvaluate: [
            'Review point-of-care serum potassium and verify repeat assay',
            'Authorize oral potassium chloride supplement pack (20 mEq)',
            'Direct Medical Officer (Dr. Sian) to confirm 12-lead rhythm pass',
            'Maintain continuous 10-minute ECG telemetry monitoring gate',
          ],
          procedure: 'NASA-STD-3001-MED-CARD-04',
          confidence: 'HIGH certainty · multi-parameter biochemical & ECG lock',
          provenance: 'Telemetry feeder · labAssayService · Fridericia QTc engine',
          evidence: `K⁺ ${kVal.toFixed(2)} mmol/L · QTc ${qtcVal.toFixed(0)} ms · ARF ${arfVal.toFixed(2)}`,
          baselineRef: 'NASA-STD-3001 Vol 1/2 · Normal K⁺: 3.5 - 5.0 mmol/L',
          timelineSequence: [
            { time: '13:00:00', delta: 'T-08m 20s', signal: 'Serum K⁺', finding: 'Potassium drops below normal floor (3.42 mmol/L)', severity: 'WARNING' },
            { time: '13:04:15', delta: 'T-04m 05s', signal: 'Fridericia QTc', finding: 'Rate-corrected QT interval exceeds 450 ms threshold', severity: 'WARNING' },
            { time: '13:07:30', delta: 'T-00m 50s', signal: 'ARF Engine', finding: 'Arrhythmogenic risk factor surges to 1.85', severity: 'CRITICAL' },
            { time: '13:08:20', delta: 'T+00m 00s', signal: 'Sentry Matrix', finding: 'Autonomous sentry alert generated for CARD-04 protocol', severity: isCrit ? 'CRITICAL' : 'WARNING' },
          ],
        });
      }
      // Special Scenario: Solar Particle Event / Radiation Storm
      else if (isRadiationScen || (pkt.radiation_flux && pkt.radiation_flux > 5.0)) {
        const fluxVal = pkt.radiation_flux || 42.5;
        const doseVal = pkt.radiation_dose_gy || 0.082;
        const rsiVal = pkt.computed_rsi || 0.68;

        evts.push({
          id: `RAD-${astId}`,
          time: now,
          priority: fluxVal > 20 ? 'CRITICAL' : 'WARNING',
          entity: `Crew ${crew.callsign} · ${crew.name}`,
          astronautId: astId,
          subsystem: 'Radiation Environment',
          summary: `Solar Particle Event · Flux ${fluxVal.toFixed(1)} mGy/d · Dose ${(doseVal * 1000).toFixed(0)} mSv`,
          age: '< 1m',
          trend: 'WORSENING',
          trajectory: 'WORSENING',
          timeToLimit: '15 min to Storm Shelter Gate',
          evidenceStrength: 'HIGH',
          signalsCount: 4,
          acknowledged: !!acked[`RAD-${astId}`],
          observed: [
            `Solar Proton Flux: ${fluxVal.toFixed(1)} mGy/d (Threshold: 5.0 mGy/d)`,
            `Cumulative Mission Dose: ${(doseVal * 1000).toFixed(1)} mSv`,
            `Radiation Susceptibility Index (RSI): ${rsiVal.toFixed(2)} (Safe: < 0.20)`,
            `Silicon Mesh CAD Detectors: Coincident flux alarm active`,
          ],
          derived: [
            `Flux elevation: +${((fluxVal - 1.24) / 1.24 * 100).toFixed(0)}% above GCR quiet baseline`,
            `Estimated 24h absorbed dose rate exceeds permissible EVA envelope`,
          ],
          correlated: [
            'HERA 6-node silicon detector grid coincident triggering',
            'Deep Space Network solar coronal plasma warning confirmed',
          ],
          possibleFactors: [
            'Coronal Mass Ejection (CME) directed along Parker spiral interplanetary magnetic field',
          ],
          actionsToEvaluate: [
            'Direct all 4 crew members into water-wall protected central storm shelter',
            'Deploy auxiliary polyethylene shielding blankets over crew berths',
            'Suspend all scheduled EVA and exterior robotic arm operations',
            'Monitor leukocyte counts and DNA double-strand break indices',
          ],
          procedure: 'NASA-STD-3001-RAD-SPE-01',
          confidence: 'CONFIRMED · HERA silicon coincidence 99% certainty',
          provenance: 'HERA telemetry bus · Silicon microdosimeter mesh',
          evidence: `Flux ${fluxVal.toFixed(1)} mGy/d · RSI ${rsiVal.toFixed(2)} · CAD Active`,
          baselineRef: 'NASA-STD-3001 GCR Baseline 1.24 mGy/d · Career Limit 600 mSv',
          timelineSequence: [
            { time: '13:01:00', delta: 'T-07m 20s', signal: 'DSN Space Weather', finding: 'Solar flare optical & X-ray burst detected by SOHO/GOES', severity: 'NOMINAL' },
            { time: '13:05:10', delta: 'T-03m 10s', signal: 'HERA Silicon Grid', finding: 'High-energy proton flux crosses 10 MeV threshold', severity: 'WARNING' },
            { time: '13:08:20', delta: 'T+00m 00s', signal: 'CAD Dosimeters', finding: 'Personal dosimeters sound acoustic storm alarm', severity: 'CRITICAL' },
          ],
        });
      }
      // Special Scenario: Internal Jugular Venous Thrombosis
      else if (isThrombosisScen || (pkt.computed_trm && pkt.computed_trm > 1.6)) {
        const trmVal = pkt.computed_trm || 2.15;
        const hctVal = pkt.hematocrit || 48.5;
        const pltVal = pkt.platelet_count || 365;

        evts.push({
          id: `THROMB-${astId}`,
          time: now,
          priority: 'WARNING',
          entity: `Crew ${crew.callsign} · ${crew.name}`,
          astronautId: astId,
          subsystem: 'Vascular / Thrombosis',
          summary: `TRM Index ${trmVal.toFixed(2)} · Jugular Venous Stasis Risk`,
          age: '< 4m',
          trend: 'STABLE',
          trajectory: 'STABLE',
          timeToLimit: '4h Ultrasound Surveillance Gate',
          evidenceStrength: 'HIGH',
          signalsCount: 4,
          acknowledged: !!acked[`THROMB-${astId}`],
          observed: [
            `Thrombosis Risk Model (TRM): ${trmVal.toFixed(2)} (High Risk: > 1.50)`,
            `Hematocrit (Hct): ${hctVal.toFixed(1)}% (Baseline: ${crew.id === 'AST-02_PILOT' ? '36.4%' : '43.6%'})`,
            `Platelet Count (PLT): ${pltVal.toFixed(0)} ×10³/µL (Elevated)`,
            `Jugular Vein Flow Velocity: Stasis waveform (< 4 cm/s)`,
          ],
          derived: [
            `Virchow Triad vascular index: Stasis + Hemoconcentration + Endothelial stress`,
          ],
          correlated: [
            'Cephalad fluid shift persistence in microgravity',
            'Vascular ultrasound waveform retrograde flow detection',
          ],
          possibleFactors: [
            'Microgravity venous stagnation in internal jugular vein',
            'Relative hemoconcentration from fluid volume loss',
          ],
          actionsToEvaluate: [
            'Direct Medical Officer (Dr. Sian) to perform vascular compression ultrasound',
            'Administer 500 mL oral rehydration electrolyte solution',
            'Prepare subcutaneous low-molecular-weight heparin (Enoxaparin 40 mg)',
            'Verify lower body negative pressure (LBNP) device readiness',
          ],
          procedure: 'NASA-STD-3001-THROMB-01',
          confidence: 'HIGH evidence strength · Multimodal TRM ML engine',
          provenance: 'TRM Virchow model · rHEALTH cytometer · vascular ultrasound',
          evidence: `TRM ${trmVal.toFixed(2)} · Hct ${hctVal.toFixed(1)}% · PLT ${pltVal.toFixed(0)}k`,
          baselineRef: 'NASA-STD-3001 Venous Hemodynamics Standard',
          timelineSequence: [
            { time: '12:55:00', delta: 'T-13m 20s', signal: 'Vascular Doppler', finding: 'Internal jugular vein flow velocity drops below 4 cm/s', severity: 'NOMINAL' },
            { time: '13:03:10', delta: 'T-05m 10s', signal: 'rHEALTH Lab', finding: 'Hemoconcentration detected: Hct 48.5%, Platelets 365k', severity: 'WARNING' },
            { time: '13:08:20', delta: 'T+00m 00s', signal: 'TRM Sentry', finding: 'TRM index reaches 2.15: Thrombosis countermeasure advisory', severity: 'WARNING' },
          ],
        });
      }
      // Special Scenario: Ammonia Coolant Vapor Leak
      else if (isAmmoniaScen) {
        evts.push({
          id: `AMMONIA-${astId}`,
          time: now,
          priority: 'CRITICAL',
          entity: `Crew ${crew.callsign} · ${crew.name}`,
          astronautId: astId,
          subsystem: 'Life Support / Hazardous Materials',
          summary: 'Toxic Ammonia Coolant Breach · Airway Ingress',
          age: '< 1m',
          trend: 'WORSENING',
          trajectory: 'WORSENING',
          timeToLimit: 'Immediate Mask Donning Gate',
          evidenceStrength: 'HIGH',
          signalsCount: 4,
          acknowledged: !!acked[`AMMONIA-${astId}`],
          observed: [
            'External/Internal loop differential pressure drop detected',
            `Airway chemical reactivity: SpO₂ ${pkt.spo2.toFixed(1)}%`,
            `Sympathetic tachycardia reflex: ${pkt.heart_rate.toFixed(0)} bpm`,
            'Cabin trace ammonia contaminant sensor rising',
          ],
          derived: [
            'Chemical pneumonitis threat from vapor phase inhalation',
            'Secondary bronchial constriction pattern',
          ],
          correlated: [
            'Thermal loop Freon pressure decay',
            'Hab ventilation inter-module circulation surge',
          ],
          possibleFactors: [
            'Micrometeorite strike on external radiator heat exchanger loop',
          ],
          actionsToEvaluate: [
            'Command all 4 crew members to don positive-pressure emergency breathing masks',
            'Isolate suspected thermal loop bypass valves',
            'Deploy catalytic ammonia trace contaminant scrubbers',
            'Verify cabin ppm below permissible ceiling (10 ppm)',
          ],
          procedure: 'NASA-STD-3001-ECLSS-AMMONIA-01',
          confidence: 'CONFIRMED · redundant differential pressure & trace gas sensor lock',
          provenance: 'ATCS telemetry · Trace contaminant monitor · OSHA/NASA STD-3001',
          evidence: `SpO₂ ${pkt.spo2.toFixed(1)}% · HR ${pkt.heart_rate.toFixed(0)} bpm · Loop-A P-Drop`,
          baselineRef: 'Permissible exposure limit: < 10 ppm NH₃',
          timelineSequence: [
            { time: '13:02:00', delta: 'T-06m 20s', signal: 'ATCS Sensor', finding: 'External radiator coolant pressure delta detected', severity: 'WARNING' },
            { time: '13:06:15', delta: 'T-02m 05s', signal: 'Trace Gas NDIR', finding: 'Vapor phase ammonia ingress into cabin ventilation', severity: 'CRITICAL' },
            { time: '13:08:20', delta: 'T+00m 00s', signal: 'Sentry Matrix', finding: 'Autonomous emergency alert: ECLSS-AMMONIA-01 procedure armed', severity: 'CRITICAL' },
          ],
        });
      }
      // General Cardiovascular / Exertion Critical
      else if (pkt.evaluated_severity === 'CRITICAL' || pkt.heart_rate > 115 || (pkt.computed_arf && pkt.computed_arf > 1.8)) {
        evts.push({
          id: `CRIT-${astId}`,
          time: now,
          priority: 'CRITICAL',
          entity: `Crew ${crew.callsign} · ${crew.name}`,
          astronautId: astId,
          subsystem: 'Cardiovascular',
          summary: `HR ${pkt.heart_rate.toFixed(0)} bpm ${pctDelta(pkt.heart_rate, crew.baseHr)} from baseline`,
          age: '< 1m',
          trend: 'WORSENING',
          trajectory: 'WORSENING',
          timeToLimit: 'Excursion active · 10m evaluation gate',
          evidenceStrength: 'HIGH',
          signalsCount: 4,
          acknowledged: !!acked[`CRIT-${astId}`],
          observed: [
            `Heart rate: ${pkt.heart_rate.toFixed(0)} bpm (baseline: ${crew.baseHr} bpm)`,
            `SpO₂: ${pkt.spo2.toFixed(1)}% (baseline: ${crew.baseSpo2}%)`,
            `HRV RMSSD: ${pkt.hrv_rmssd.toFixed(0)} ms (baseline: ${crew.baseHrv} ms)`,
            `Core temp: ${pkt.core_temp.toFixed(1)} °C (baseline: ${crew.baseTemp} °C)`,
          ],
          derived: [
            `HR deviation from personal baseline: ${pctDelta(pkt.heart_rate, crew.baseHr)}`,
            pkt.computed_qtc ? `Fridericia QTc: ${pkt.computed_qtc.toFixed(0)} ms (computed from HR + simulated QT)` : '',
            pkt.computed_arf ? `Arrhythmogenic Risk Factor: ${pkt.computed_arf.toFixed(2)} (computed)` : '',
          ].filter(Boolean),
          correlated: [
            `HRV decreased ${absDelta(pkt.hrv_rmssd, crew.baseHrv)} ms — sympathetic activation`,
            spo2D < -1 ? `SpO₂ depressed ${spo2D.toFixed(1)}% — possible tissue hypoperfusion` : 'SpO₂ stable within baseline',
            `Cabin CO₂: ${pkt.cabin_co2.toFixed(2)} mmHg`,
          ],
          possibleFactors: [
            'Physical exertion or post-exercise response',
            'Acute stress or anxiety response',
            pkt.potassium && pkt.potassium < 3.8 ? `Electrolyte imbalance (K⁺: ${pkt.potassium.toFixed(2)} mmol/L)` : '',
            'Autonomic dysregulation from microgravity adaptation',
          ].filter(Boolean),
          actionsToEvaluate: [
            'Request crew verbal status via DSN uplink',
            'Direct Medical Officer to initiate 12-lead ECG',
            'Verify hydration status and electrolyte availability',
            'Monitor trend over next 10-minute telemetry window',
          ],
          procedure: 'M-204',
          confidence: 'HIGH evidence strength · 4 correlated signals',
          provenance: 'Telemetry stream · sentry_matrix.py · computational_biomarkers.py',
          evidence: `HR: ${pkt.heart_rate.toFixed(0)} bpm (${pctDelta(pkt.heart_rate, crew.baseHr)}) · SpO₂: ${pkt.spo2.toFixed(1)}% · QTc: ${(pkt.computed_qtc || 0).toFixed(0)} ms`,
          baselineRef: `Personal resting baseline: HR ${crew.baseHr} bpm · SpO₂ ${crew.baseSpo2}% · Source: nasa_astronaut_baselines.json (derived from OSDR OSD-575/569)`,
          timelineSequence: [
            { time: '13:04:10', delta: 'T-04m 10s', signal: 'Heart Rate', finding: 'Gradual rise above baseline (72 bpm → 88 bpm)', severity: 'NOMINAL' },
            { time: '13:06:25', delta: 'T-01m 55s', signal: 'HRV RMSSD', finding: 'Autonomic decay detected (65 ms → 38 ms, sympathetic shift)', severity: 'WARNING' },
            { time: '13:07:40', delta: 'T-00m 40s', signal: 'Fridericia QTc', finding: 'Rate-corrected QT interval exceeds 450 ms threshold', severity: 'WARNING' },
            { time: '13:08:20', delta: 'T+00m 00s', signal: 'Sentry Matrix', finding: 'Multi-signal excursion confirmed: Sentry alert generated', severity: 'CRITICAL' },
          ],
        });
      }
      // General Cardiovascular / Exertion Warning
      else if (pkt.evaluated_severity === 'WARNING' || hrD > 20 || spo2D < -2.5) {
        evts.push({
          id: `WARN-${astId}`,
          time: now,
          priority: 'WARNING',
          entity: `Crew ${crew.callsign} · ${crew.name}`,
          astronautId: astId,
          subsystem: 'Metabolic',
          summary: `HR ${pkt.heart_rate.toFixed(0)} bpm ${pctDelta(pkt.heart_rate, crew.baseHr)} · SpO₂ ${pkt.spo2.toFixed(1)}%`,
          age: '< 5m',
          trend: 'STABLE',
          trajectory: 'STABLE',
          timeToLimit: 'Stable under observation',
          evidenceStrength: 'MODERATE',
          signalsCount: 2,
          acknowledged: !!acked[`WARN-${astId}`],
          observed: [
            `Heart rate: ${pkt.heart_rate.toFixed(0)} bpm (baseline: ${crew.baseHr} bpm)`,
            `SpO₂: ${pkt.spo2.toFixed(1)}% (baseline: ${crew.baseSpo2}%)`,
          ],
          derived: [
            `HR deviation: ${pctDelta(pkt.heart_rate, crew.baseHr)}`,
            `SpO₂ delta: ${absDelta(pkt.spo2, crew.baseSpo2)}%`,
          ],
          correlated: ['Activity state under observation', 'Cabin atmosphere nominal'],
          possibleFactors: ['Physical exertion', 'Mild thermal stress', 'Circadian phase shift'],
          actionsToEvaluate: ['Monitor 15-minute trend', 'Review exercise schedule', 'Check hydration log'],
          procedure: 'NASA-STD-3001-MED-CARD-02',
          confidence: 'MODERATE evidence strength · baseline sentry evaluator',
          provenance: 'sentry_matrix.py · nasa_astronaut_baselines.json',
          evidence: `HR: ${pkt.heart_rate.toFixed(0)} bpm · SpO₂: ${pkt.spo2.toFixed(1)}%`,
          baselineRef: `Personal baseline: HR ${crew.baseHr} bpm · SpO₂ ${crew.baseSpo2}%`,
          timelineSequence: [
            { time: '13:02:00', delta: 'T-06m 20s', signal: 'Activity', finding: 'Crew initiated scheduled microgravity workout', severity: 'NOMINAL' },
            { time: '13:05:15', delta: 'T-03m 05s', signal: 'Heart Rate', finding: 'Tachycardia onset (+24% above resting baseline)', severity: 'WARNING' },
            { time: '13:08:20', delta: 'T+00m 00s', signal: 'Sentry Matrix', finding: 'Contextual exertion gate: Warning status held stable', severity: 'WARNING' },
          ],
        });
      }
    });

    // ECLSS Cabin Atmosphere Event (CO2 Scrubber Saturation)
    const anyPkt = Object.values(telemetryMap)[0];
    const co2Val = anyPkt?.cabin_co2 || 1.82;
    if (isCo2Scen || co2Val > 3.0) {
      evts.push({
        id: 'ENV-CO2',
        time: now,
        priority: co2Val > 5.0 ? 'CRITICAL' : 'WARNING',
        entity: 'ECLSS · Cabin Atmosphere',
        subsystem: 'Life Support',
        summary: `Cabin CO₂ ${co2Val.toFixed(2)} mmHg (Scrubber Bed Saturation)`,
        age: '< 10m',
        trend: 'WORSENING',
        trajectory: 'WORSENING',
        timeToLimit: co2Val > 3.0 ? 'Exceeded by +' + (co2Val - 3.0).toFixed(2) + ' mmHg' : '~11 min to 3.0 mmHg limit',
        evidenceStrength: 'HIGH',
        signalsCount: 4,
        acknowledged: !!acked['ENV-CO2'],
        observed: [
          `Cabin CO₂: ${co2Val.toFixed(2)} mmHg (Threshold: 3.00 mmHg)`,
          `Measured by redundant onboard NDIR gas sensors`,
          `Regenerative CO₂ Scrubber Bed A effluent saturation detected`,
        ],
        derived: [`${((co2Val - 1.8) / 1.8 * 100).toFixed(0)}% above nominal baseline (1.80 mmHg)`],
        correlated: ['Secondary hyperventilation response across crew telemetry', 'Thermal loop temperature steady'],
        possibleFactors: ['Amine regenerative scrubber bed A saturation', 'Inter-module airflow bypass damper issue'],
        actionsToEvaluate: [
          'Command automated valve transition to secondary scrubber bed (Bed B)',
          'Increase habitat inter-module ventilation fan speed to High (0.8 m/s)',
          'Direct crew to report headache or mild cognitive fatigue symptoms',
          'Confirm backup LiOH canister seals intact for contingency installation',
        ],
        procedure: 'NASA-STD-3001-ECLSS-CO2-01',
        confidence: 'HIGH certainty · redundant NDIR sensor telemetry',
        provenance: 'Environmental telemetry · NASA OCHMO CO₂ Technical Brief',
        evidence: `CO₂: ${co2Val.toFixed(2)} mmHg · Limit: 3.00 mmHg (NASA-STD-3001)`,
        baselineRef: 'Nominal cabin CO₂: 1.80 ± 0.25 mmHg (environmental_baselines)',
        timelineSequence: [
          { time: '12:50:00', delta: 'T-18m 20s', signal: 'Cabin CO₂', finding: 'Nominal baseline concentration at 1.82 mmHg', severity: 'NOMINAL' },
          { time: '13:00:15', delta: 'T-08m 05s', signal: 'CO₂ Scrubber Bed A', finding: 'Effluent sensor indicates early saturation breakthrough', severity: 'WARNING' },
          { time: '13:05:40', delta: 'T-02m 40s', signal: 'Cabin CO₂', finding: 'Exceeds NASA-STD-3001 1-hour flight rule limit (3.0 mmHg)', severity: 'WARNING' },
          { time: '13:08:20', delta: 'T+00m 00s', signal: 'ECLSS Sentry', finding: 'Persistent elevation confirmed: Sentry alert generated', severity: co2Val > 5.0 ? 'CRITICAL' : 'WARNING' },
        ],
      });
    }

    if (evts.length === 0) {
      evts.push({
        id: 'NOMINAL',
        time: now,
        priority: 'NOMINAL',
        entity: 'All Systems',
        subsystem: 'Mission',
        summary: 'All parameters within personal baselines',
        age: '—',
        trend: 'STABLE',
        trajectory: 'STABLE',
        timeToLimit: 'All margins > 70 days',
        evidenceStrength: 'HIGH',
        signalsCount: 6,
        acknowledged: true,
        observed: ['All crew vitals nominal at 10 Hz', 'Cabin atmosphere within limits'],
        derived: ['Z-score deviations < 1.5σ for all channels'],
        correlated: [],
        possibleFactors: [],
        actionsToEvaluate: ['Maintain standard surveillance'],
        confidence: 'HIGH evidence strength · all sentry gates green',
        provenance: 'H.E.L.I.O.S autonomous sentry',
        evidence: 'All crew and systems nominal',
        baselineRef: 'Per-astronaut baselines from nasa_astronaut_baselines.json',
      });
    }

    return evts.sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, ADVISORY: 2, NOMINAL: 3 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });
  }, [telemetryMap, acked, backendAlerts, currentScenario]);

  const missionState = useMemo(() => {
    if (events.some(e => e.priority === 'CRITICAL')) return 'CRITICAL';
    if (events.some(e => e.priority === 'WARNING')) return 'WARNING';
    return 'NOMINAL';
  }, [events]);

  const activeEvent = useMemo(() => {
    if (selEventId) return events.find(e => e.id === selEventId) || events[0];
    return events[0];
  }, [selEventId, events]);

  const ack = useCallback((id: string) => {
    setAcked(p => ({ ...p, [id]: !p[id] }));
  }, []);

  const activeDSN = DSN[dsnIdx];

  // ─────────────────────────────────────────────────────────────
  // SHARED STYLES
  // ─────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: '14px 16px',
    boxSizing: 'border-box',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: '#9ec7ef', // High-contrast aerospace steel-cyan for prominent section titles
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontFamily: T.sans,
    lineHeight: 1,
    marginBottom: 5,
  };

  const valStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: T.textPrimary,
    fontFamily: T.mono,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  };

  const unitStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    color: T.textMuted,
    fontFamily: T.sans,
    marginLeft: 2,
  };

  const tabBtn = (t2: MCCTab, label: string): React.ReactNode => {
    const isSel = tab === t2;
    return (
      <button
        key={t2}
        onClick={() => setTab(t2)}
        style={{
          background: isSel ? 'rgba(56, 189, 248, 0.30)' : '#0c0f12',
          border: isSel ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid #2c3642',
          borderRadius: 5,
          padding: '6px 15px',
          color: isSel ? '#ffffff' : '#9ec7ef',
          fontSize: 11,
          fontWeight: isSel ? 700 : 500,
          cursor: 'pointer',
          fontFamily: T.sans,
          letterSpacing: '0.04em',
          textShadow: isSel ? '0 1px 2px rgba(0, 0, 0, 0.75)' : 'none',
          boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)' : 'none',
          transition: 'all 0.12s ease',
        }}
      >
        {label}
      </button>
    );
  };

  // ─── Badge helper (dark background with subtle border outline) ───
  const Badge: React.FC<{
    children: React.ReactNode;
    color: string;
    borderColor?: string;
    bg?: string;
  }> = ({ children, color, borderColor, bg = '#0b0e11' }) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 4,
        background: bg,
        border: `1px solid ${borderColor || color + '44'}`,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: color,
        textTransform: 'uppercase',
        fontFamily: T.sans,
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  );

  // ─── Metric row helper ───
  const MetricRow = ({ label, value, unit, baseline, delta, color }: {
    label: string; value: string; unit: string; baseline?: string; delta?: string; color?: string;
  }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.borderSubtle}` }}>
      <span style={{ fontSize: 11, color: T.textSecondary, minWidth: 90 }}>{label}</span>
      <span style={{ ...valStyle, fontSize: 13, color: color || T.textPrimary }}>{value}<span style={unitStyle}>{unit}</span></span>
      {baseline && <span style={{ fontSize: 10, color: T.textMuted, minWidth: 70, textAlign: 'right' }}>base {baseline}</span>}
      {delta && <span style={{ fontSize: 10, fontFamily: T.mono, color: color || T.textSecondary, minWidth: 55, textAlign: 'right' }}>{delta}</span>}
    </div>
  );

  // ─── Status dot ───
  const Dot = ({ color, size = 6 }: { color: string; size?: number }) => (
    <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
  );

  // ─── Astronaut Avatar Icon ───
  const AvatarIcon: React.FC<{ initial: string; status: 'NOMINAL' | 'WARNING' | 'CRITICAL'; size?: number }> = ({
    initial,
    status,
    size = 36,
  }) => {
    const ringColor = status === 'CRITICAL' ? T.critical : status === 'WARNING' ? T.warning : T.nominal;
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1e252c 0%, #0d1115 100%)',
          border: `1.5px solid ${ringColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e4eaf0',
          fontSize: Math.round(size * 0.32),
          fontWeight: 700,
          fontFamily: T.mono,
          letterSpacing: '0.04em',
          flexShrink: 0,
          boxShadow: `0 0 8px ${ringColor}2b`,
        }}
      >
        {initial}
      </div>
    );
  };

  // ─── Sparkline helper ───
  const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({
    data,
    color,
    width = 54,
    height = 20,
  }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((val - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lastX = width - 2;
    const lastVal = data[data.length - 1];
    const lastY = height - 2 - ((lastVal - min) / range) * (height - 6);

    return (
      <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
        <path d={`M ${points.join(' L ')}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="2" fill={color} />
      </svg>
    );
  };

  // ─── TrendLineChart for 2-hour synchronous charts ───
  const TrendLineChart: React.FC<{
    title: string;
    currentVal: string;
    baselineVal: number;
    unit: string;
    data: number[];
    minY: number;
    maxY: number;
    lineColor: string;
    yTicks: number[];
    showTimeTicks?: boolean;
  }> = ({ title, currentVal, baselineVal, unit, data, minY, maxY, lineColor, yTicks, showTimeTicks = false }) => {
    const chartHeight = 54;
    const rangeY = maxY - minY || 1;
    const baselineY = Math.max(2, Math.min(chartHeight - 2, chartHeight - ((baselineVal - minY) / rangeY) * chartHeight));

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * 100;
      const y = Math.max(2, Math.min(chartHeight - 2, chartHeight - ((val - minY) / rangeY) * chartHeight));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lastVal = data[data.length - 1];
    const lastY = Math.max(2, Math.min(chartHeight - 2, chartHeight - ((lastVal - minY) / rangeY) * chartHeight));

    return (
      <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '7px 9px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: T.textSecondary, fontWeight: 600 }}>{title}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: lineColor }}>{currentVal}</span>
            <span style={{ fontSize: 9, color: T.textMuted }}>{unit}</span>
          </div>
        </div>

        <div style={{ position: 'relative', height: chartHeight, width: '100%' }}>
          {/* Y ticks background lines */}
          {yTicks.map(tVal => {
            const yPos = chartHeight - ((tVal - minY) / rangeY) * chartHeight;
            return (
              <div key={tVal} style={{ position: 'absolute', top: `${yPos}px`, left: 0, right: 0, height: 1, background: '#1c252f', pointerEvents: 'none' }}>
                <span style={{ position: 'absolute', right: 2, top: -7, fontSize: 8, fontFamily: T.mono, color: '#8fa3b7' }}>{tVal}</span>
              </div>
            );
          })}

          <svg viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {/* Baseline dashed reference line */}
            <line x1="0" y1={baselineY} x2="100" y2={baselineY} stroke="#5a6878" strokeDasharray="3,3" strokeWidth="0.9" />
            {/* Actual crew curve */}
            <polyline fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" points={points.join(' ')} />
            <circle cx="100" cy={lastY} r="2.4" fill={lineColor} />
          </svg>

          {/* Baseline tag */}
          <span style={{ position: 'absolute', left: 4, top: Math.max(0, baselineY - 11), fontSize: 8, fontFamily: T.mono, color: '#9db4cb' }}>
            Base {baselineVal}
          </span>
        </div>

        {showTimeTicks && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 3, borderTop: `1px solid #1c2530`, fontSize: 8, fontFamily: T.mono, color: T.textMuted }}>
            <span>12:30</span>
            <span>13:00</span>
            <span>13:30</span>
            <span>14:00</span>
            <span>14:30</span>
          </div>
        )}
      </div>
    );
  };

  // ─── Circular Confidence Progress Gauge ───
  const CircularGauge: React.FC<{ pct: number; label: string; size?: number; color?: string }> = ({
    pct,
    label,
    size = 80,
    color = '#529642',
  }) => {
    const strokeWidth = 7;
    const radius = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (pct / 100) * circ;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="#141a22" strokeWidth={strokeWidth} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16, fontFamily: T.mono, fontWeight: 700, color: T.textPrimary }}>{pct}%</span>
          </div>
        </div>
        <span style={{ fontSize: 9, color: T.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // OVERVIEW TAB — NASA MCC OPERATIONAL SUITE WITH LIVE ECG & GRAPHS
  // ─────────────────────────────────────────────────────────────
  const renderOverview = () => {
    const anyPkt = Object.values(telemetryMap)[0];
    const co2Val = anyPkt?.cabin_co2 || 1.82;
    const activeAlerts = events.filter(e => e.priority !== 'NOMINAL');
    const hasAnomaly = activeAlerts.length > 0;
    const primaryAlert = hasAnomaly ? activeAlerts[0] : null;

    const handleTriage = (astId: string) => {
      if (onOpenTriage) {
        onOpenTriage(astId);
      } else {
        setSelCrewId(astId);
        setTab('CREW');
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ─── 1. TOP OPERATIONAL INCIDENT & MISSION SYNOPTIC ANCHOR ─── */}
        <div style={{
          ...cardStyle,
          padding: '12px 16px',
          background: hasAnomaly
            ? 'linear-gradient(180deg, #1f1518 0%, #100d0f 100%)'
            : 'linear-gradient(180deg, #181d22 0%, #0f1316 100%)',
          border: hasAnomaly ? '1px solid rgba(239, 68, 68, 0.45)' : `1px solid ${T.border}`,
          boxShadow: hasAnomaly
            ? '0 4px 20px rgba(239, 68, 68, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 2px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}>
          {hasAnomaly && primaryAlert ? (() => {
            const targetAstId = primaryAlert.astronautId || 'AST-02_PILOT';
            const targetCrew = CREW.find(c => c.id === targetAstId) || CREW[1];
            const targetPkt = telemetryMap[targetAstId] || anyPkt;
            const scenKey = currentScenario || targetPkt?.scenario_phase || 'NOMINAL_CRUISE';
            const isHypo = scenKey.includes('HYPOKALEMIA') || (targetPkt?.potassium !== undefined && targetPkt.potassium < 3.5) || primaryAlert.id.includes('HYPO') || primaryAlert.summary.toLowerCase().includes('hypokalem');
            const isRad = scenKey.includes('RADIATION') || scenKey.includes('SOLAR') || (targetPkt?.radiation_flux !== undefined && targetPkt.radiation_flux > 5.0) || primaryAlert.id.includes('RAD');
            const isThromb = scenKey.includes('THROMBOSIS') || (targetPkt?.computed_trm !== undefined && targetPkt.computed_trm > 1.6) || primaryAlert.id.includes('THROMB');
            const isCo2Breach = scenKey.includes('CO2') || co2Val > 3.0 || primaryAlert.id.includes('CO2') || primaryAlert.summary.toLowerCase().includes('co2');
            const isAmmonia = scenKey.includes('AMMONIA') || primaryAlert.id.includes('AMMONIA');

            // Clean title: Strip raw parentheses formulas like "(492.0ms, K+=2.95 mmol/L, ARF=1.75)."
            const cleanSummary = primaryAlert.summary.replace(/\s*\([^)]*\)\.?$/, '').trim();
            let mainTitle = cleanSummary;
            let subTitle = '';
            if (cleanSummary.includes(':')) {
              const parts = cleanSummary.split(':');
              mainTitle = parts[0].trim();
              subTitle = parts.slice(1).join(':').trim();
            } else if (cleanSummary.includes('·')) {
              const parts = cleanSummary.split('·');
              mainTitle = parts[0].trim();
              subTitle = parts.slice(1).join('·').trim();
            }

            // Derive key metrics for the 4 prominent cards
            const targetHr = targetPkt ? Math.round(targetPkt.heart_rate) : 108;
            const targetHrD = ((targetHr - targetCrew.baseHr) / targetCrew.baseHr) * 100;
            const targetK = targetPkt?.potassium !== undefined ? targetPkt.potassium : 2.95;
            const targetQtc = targetPkt?.computed_qtc || 492;
            const targetArf = targetPkt?.computed_arf || 1.75;
            const targetFlux = targetPkt?.radiation_flux || 42.5;
            const targetDose = targetPkt?.radiation_dose_gy || 0.082;
            const targetTrm = targetPkt?.computed_trm || 2.15;
            const targetHct = targetPkt?.hematocrit || 48.5;
            const targetPlt = targetPkt?.platelet_count || 365;
            const targetSpo2 = targetPkt?.spo2 || 94.2;
            const targetResp = targetPkt
              ? (targetPkt.heart_rate > targetCrew.baseHr + 20 ? Math.round(targetCrew.baseResp * 1.35) : Math.round(targetCrew.baseResp * (targetPkt.heart_rate / targetCrew.baseHr)))
              : 24;

            interface DiagnosticTile {
              label: string;
              value: string;
              unit: string;
              status: string;
              reference: string;
              color: string;
            }

            let tiles: DiagnosticTile[] = [];

            if (isHypo) {
              tiles = [
                {
                  label: 'SERUM POTASSIUM (K⁺)',
                  value: targetK.toFixed(2),
                  unit: 'mmol/L',
                  status: 'CRITICAL DEFICIT',
                  reference: 'Floor Limit: 3.50',
                  color: '#ef4444',
                },
                {
                  label: 'FRIDERICIA QTc INTERVAL',
                  value: Math.round(targetQtc).toString(),
                  unit: 'ms',
                  status: `PROLONGED (+${Math.max(0, Math.round(targetQtc - 450))} ms)`,
                  reference: 'Flight Limit: < 450 ms',
                  color: '#ef4444',
                },
                {
                  label: 'ARRHYTHMIA RISK (ARF)',
                  value: targetArf.toFixed(2),
                  unit: 'INDEX',
                  status: 'HIGH ECTOPIC RISK',
                  reference: 'Safe Ceiling: < 1.00',
                  color: '#f59e0b',
                },
                {
                  label: 'HEART RATE (ECG II)',
                  value: targetHr.toString(),
                  unit: 'bpm',
                  status: `${targetHrD >= 0 ? '+' : ''}${targetHrD.toFixed(1)}% vs Base`,
                  reference: `Baseline: ${targetCrew.baseHr} bpm`,
                  color: Math.abs(targetHrD) > 15 ? '#f59e0b' : '#38bdf8',
                },
              ];
            } else if (isCo2Breach) {
              tiles = [
                {
                  label: 'CABIN CO₂ PARTIAL PRESSURE',
                  value: co2Val.toFixed(2),
                  unit: 'mmHg',
                  status: `LIMIT BREACH (+${Math.max(0, Math.round(((co2Val - 3.0) / 3.0) * 100))}%)`,
                  reference: 'Flight Rule: < 3.00 mmHg',
                  color: '#ef4444',
                },
                {
                  label: 'CDRA SCRUBBER ASSEMBLY',
                  value: 'BED A',
                  unit: 'SATURATED',
                  status: 'BREAKTHROUGH DETECTED',
                  reference: 'Action: Cycle Bed B / Arm LiOH',
                  color: '#ef4444',
                },
                {
                  label: 'CREW COMPENSATORY HR',
                  value: targetHr.toString(),
                  unit: 'bpm',
                  status: `${targetHrD >= 0 ? '+' : ''}${targetHrD.toFixed(1)}% ELEVATION`,
                  reference: `Baseline: ${targetCrew.baseHr} bpm`,
                  color: '#f59e0b',
                },
                {
                  label: 'RESPIRATION FREQUENCY',
                  value: targetResp.toString(),
                  unit: 'br/min',
                  status: 'HYPERVENTILATION',
                  reference: 'Baseline: 15 br/min',
                  color: '#f59e0b',
                },
              ];
            } else if (isRad) {
              tiles = [
                {
                  label: 'HERA SILICON PROTON FLUX',
                  value: targetFlux.toFixed(1),
                  unit: 'mGy/d',
                  status: 'CRITICAL SPE SPIKE',
                  reference: 'GCR Baseline: 1.24 mGy/d',
                  color: '#ef4444',
                },
                {
                  label: 'CUMULATIVE TISSUE DOSE',
                  value: (targetDose * 1000).toFixed(0),
                  unit: 'mSv',
                  status: 'ACCUMULATING RAPIDLY',
                  reference: 'Career Limit: 600 mSv',
                  color: '#f59e0b',
                },
                {
                  label: 'RADIATION SUSCEPTIBILITY',
                  value: (targetPkt?.computed_rsi || 0.68).toFixed(2),
                  unit: 'RSI',
                  status: 'HIGH VULNERABILITY',
                  reference: 'Safe Margin: < 0.20',
                  color: '#ef4444',
                },
                {
                  label: 'STORM SHELTER DIRECTIVE',
                  value: 'DEPLOY',
                  unit: 'WATER WALL',
                  status: 'IMMEDIATE RETREAT',
                  reference: 'Procedure: RAD-SPE-01',
                  color: '#ef4444',
                },
              ];
            } else if (isThromb) {
              tiles = [
                {
                  label: 'THROMBOSIS RISK (TRM)',
                  value: targetTrm.toFixed(2),
                  unit: 'INDEX',
                  status: 'HIGH CLOTTING RISK',
                  reference: 'Clinical Threshold: < 1.50',
                  color: '#ef4444',
                },
                {
                  label: 'IJV DOPPLER VELOCITY',
                  value: '< 4.0',
                  unit: 'cm/s',
                  status: 'VENOUS STASIS WAVEFORM',
                  reference: 'Nominal Flow: > 15 cm/s',
                  color: '#ef4444',
                },
                {
                  label: 'HEMATOCRIT CONCENTRATION',
                  value: targetHct.toFixed(1),
                  unit: '%',
                  status: 'HEMOCONCENTRATION',
                  reference: `Baseline: ${targetCrew.id === 'AST-02_PILOT' ? '36.4%' : '43.6%'}`,
                  color: '#f59e0b',
                },
                {
                  label: 'PLATELET COUNT (PLT)',
                  value: Math.round(targetPlt).toString(),
                  unit: 'k/µL',
                  status: 'HYPERCOAGULABILITY',
                  reference: 'Nominal: 150 – 400 k/µL',
                  color: '#f59e0b',
                },
              ];
            } else if (isAmmonia) {
              tiles = [
                {
                  label: 'ATCS EXTERNAL LOOP-A',
                  value: '-42.0',
                  unit: 'kPa',
                  status: 'PRESSURE DECAY',
                  reference: 'Loop Integrity Breach',
                  color: '#ef4444',
                },
                {
                  label: 'CABIN NH₃ VAPOR TRACE',
                  value: '18.4',
                  unit: 'ppm',
                  status: 'TOXIC CONCENTRATION',
                  reference: 'Permissible Ceiling: < 10 ppm',
                  color: '#ef4444',
                },
                {
                  label: 'CREW OXYGENATION (SpO₂)',
                  value: targetSpo2.toFixed(1),
                  unit: '%',
                  status: 'AIRWAY CONSTRICTION',
                  reference: 'Baseline: 98.5%',
                  color: '#ef4444',
                },
                {
                  label: 'POSITIVE PRESSURE MASKS',
                  value: 'DON PBAS',
                  unit: 'ALL CREW',
                  status: 'IMMEDIATE ACTION',
                  reference: 'Procedure: ECLSS-AMMONIA-01',
                  color: '#ef4444',
                },
              ];
            } else {
              tiles = [
                {
                  label: 'HEART RATE (ECG II)',
                  value: targetHr.toString(),
                  unit: 'bpm',
                  status: `${targetHrD >= 0 ? '+' : ''}${targetHrD.toFixed(1)}% EXCURSION`,
                  reference: `Resting Baseline: ${targetCrew.baseHr} bpm`,
                  color: targetHrD > 25 ? '#ef4444' : '#f59e0b',
                },
                {
                  label: 'PULSE OXIMETRY (SpO₂)',
                  value: (targetPkt?.spo2 || targetCrew.baseSpo2).toFixed(1),
                  unit: '%',
                  status: (targetPkt?.spo2 || targetCrew.baseSpo2) < 95 ? 'MILD DESATURATION' : 'NOMINAL PERFUSION',
                  reference: `Baseline: ${targetCrew.baseSpo2}%`,
                  color: (targetPkt?.spo2 || targetCrew.baseSpo2) < 95 ? '#f59e0b' : '#38bdf8',
                },
                {
                  label: 'HRV RMSSD (AUTONOMIC)',
                  value: Math.round(targetPkt?.hrv_rmssd || targetCrew.baseHrv).toString(),
                  unit: 'ms',
                  status: 'SYMPATHETIC STRAIN',
                  reference: `Baseline: ${targetCrew.baseHrv} ms`,
                  color: '#f59e0b',
                },
                {
                  label: 'CORE BODY TEMPERATURE',
                  value: (targetPkt?.core_temp || targetCrew.baseTemp).toFixed(1),
                  unit: '°C',
                  status: 'METABOLIC EXCURSION',
                  reference: `Baseline: ${targetCrew.baseTemp} °C`,
                  color: '#38bdf8',
                },
              ];
            }

            const procName = primaryAlert.procedure ? primaryAlert.procedure.replace('NASA-STD-3001-', '') : 'MED-CARD-04';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* ── 1. BOX MAIN TITLE & TOP CONTROL BAR ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 8,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ ...labelStyle, marginBottom: 0 }}>MISSION OPERATIONAL INCIDENT // FLIGHT EXCURSION</div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: primaryAlert.priority === 'CRITICAL' ? '#dc2626' : '#d97706',
                      color: '#ffffff',
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      letterSpacing: '0.06em',
                      fontFamily: T.mono,
                      boxShadow: primaryAlert.priority === 'CRITICAL' ? '0 0 10px rgba(220, 38, 38, 0.5)' : 'none',
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ffffff' }} />
                      {primaryAlert.priority}
                    </span>
                    <span style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontFamily: T.mono,
                    }}>
                      {primaryAlert.entity.toUpperCase()}
                    </span>
                  </div>

                  {/* Right: Operational Age & Action Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 9.5, fontFamily: T.mono, color: '#94a3b8' }}>
                      ACTIVE: <span style={{ color: '#f8fafc', fontWeight: 700 }}>{primaryAlert.age}</span>
                    </div>

                    <button
                      onClick={() => { setSelEventId(primaryAlert.id); setTab('INVESTIGATE'); }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#2563eb',
                        border: '1px solid #60a5fa',
                        borderRadius: 4,
                        padding: '4px 12px',
                        color: '#ffffff',
                        fontSize: 10.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: T.sans,
                        letterSpacing: '0.03em',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#2563eb')}
                    >
                      <span>INVESTIGATE EXCURSION →</span>
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontSize: 9,
                        fontFamily: T.mono,
                      }}>
                        {procName}
                      </span>
                    </button>
                  </div>
                </div>

                {/* ── 2. CLEAN INCIDENT HEADLINE ── */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '2px 0 4px 0' }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '0.01em',
                    fontFamily: T.sans,
                  }}>
                    {mainTitle}
                  </span>
                  {subTitle && (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#94a3b8',
                      fontFamily: T.sans,
                    }}>
                      — {subTitle}
                    </span>
                  )}
                </div>

                {/* ── 3. 4 PROMINENT DIAGNOSTIC BIOMARKER TILES (DARK RECESS, NO LEFT OUTLINE) ── */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                }}>
                  {tiles.map((tile, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#07090c',
                        border: '1px solid #1c2633',
                        borderRadius: 5,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.5)',
                      }}
                    >
                      {/* Tile Category Label */}
                      <span style={{
                        fontSize: 9.5,
                        fontFamily: T.mono,
                        fontWeight: 700,
                        color: '#94a3b8',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}>
                        {tile.label}
                      </span>

                      {/* Prominent Large Value & Unit */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{
                          fontSize: 22,
                          fontFamily: T.mono,
                          fontWeight: 800,
                          color: tile.color,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.1,
                        }}>
                          {tile.value}
                        </span>
                        {tile.unit && (
                          <span style={{
                            fontSize: 11,
                            fontFamily: T.mono,
                            fontWeight: 600,
                            color: '#94a3b8',
                          }}>
                            {tile.unit}
                          </span>
                        )}
                      </div>

                      {/* Status & Normal Reference Range */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 2,
                        paddingTop: 4,
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: 9.5,
                        fontFamily: T.mono,
                      }}>
                        <span style={{ color: tile.color, fontWeight: 700 }}>
                          {tile.status}
                        </span>
                        <span style={{ color: '#64748b' }}>
                          {tile.reference}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>MISSION OPERATIONAL STATUS // AUTONOMOUS SENTRY</div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#07090c',
                border: '1px solid #1c2633',
                borderRadius: 5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Dot color={T.nominal} size={8} />
                  <span style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: T.nominal,
                    letterSpacing: '0.05em',
                    fontFamily: T.sans,
                  }}>
                    MISSION HEALTH: NOMINAL
                  </span>
                  <span style={{ color: '#475569' }}>|</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: T.sans }}>
                    All 4 Crew Members Within Personal Baseline Corridors · Habitat Optimal
                  </span>
                </div>
                <span style={{ fontSize: 10, fontFamily: T.mono, color: '#64748b' }}>
                  AUTONOMOUS SENTRY PASS 84 · MARGINS &gt; 70 DAYS
                </span>
              </div>
            </div>
          )}

          {/* ── 4-BLOCK SUBSYSTEM & COMMUNICATIONS SYNOPTIC STRIP (COMPACT TITLES, SINGLE DATA, DARK BG) ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            marginTop: hasAnomaly ? 10 : 8,
            paddingTop: hasAnomaly ? 10 : 6,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            {/* 1. Crew Status Pill */}
            <div style={{
              background: '#07090c',
              border: hasAnomaly ? '1px solid rgba(245, 158, 11, 0.40)' : '1px solid #1c2633',
              borderRadius: 5,
              padding: '7px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Dot color={hasAnomaly ? T.warning : T.nominal} size={6} />
                <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 700, color: '#94a3b8' }}>
                  CREW
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontFamily: T.mono,
                fontWeight: 700,
                color: hasAnomaly ? T.warning : T.nominal,
              }}>
                {hasAnomaly ? '1 ATTENTION' : 'NOMINAL'}
              </span>
            </div>

            {/* 2. ECLSS Habitat Pill */}
            <div style={{
              background: '#07090c',
              border: co2Val > 3.0 ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid #1c2633',
              borderRadius: 5,
              padding: '7px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Dot color={co2Val > 3.0 ? '#ef4444' : T.nominal} size={6} />
                <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 700, color: '#94a3b8' }}>
                  ECLSS
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontFamily: T.mono,
                fontWeight: 700,
                color: co2Val > 3.0 ? '#ef4444' : '#f8fafc',
              }}>
                CO₂ {co2Val.toFixed(2)} mmHg
              </span>
            </div>

            {/* 3. Power & Thermal Pill */}
            <div style={{
              background: '#07090c',
              border: '1px solid #1c2633',
              borderRadius: 5,
              padding: '7px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Dot color={T.nominal} size={6} />
                <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 700, color: '#94a3b8' }}>
                  POWER
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontFamily: T.mono,
                fontWeight: 700,
                color: '#f8fafc',
              }}>
                EPS 28.4 V
              </span>
            </div>

            {/* 4. Deep Space Network Pill */}
            <div style={{
              background: '#07090c',
              border: activeDSN.snr > 30 ? '1px solid #1c2633' : '1px solid rgba(245, 158, 11, 0.40)',
              borderRadius: 5,
              padding: '7px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Dot color={activeDSN.snr > 30 ? T.nominal : T.warning} size={6} />
                <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 700, color: '#94a3b8' }}>
                  COMMS
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontFamily: T.mono,
                fontWeight: 700,
                color: '#f8fafc',
              }}>
                10 Hz LOCK
              </span>
            </div>
          </div>
        </div>

        {/* ─── 2. CABIN ECLSS ENVIRONMENTAL TELEMETRY RIBBON ─── */}
        <div style={{ width: '100%' }}>
          <CabinEnvironmentalBar
            telemetryMap={telemetryMap}
            currentScenario={currentScenario}
          />
        </div>

        {/* ─── 3. 4-ROW CREW LIVE BIOMETRIC TELEMETRY GRID WITH LIVE ECG & PLETHYSMOGRAM ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <div style={labelStyle}>Live Crew Health &amp; Dual-Trace Waveform Telemetry (10 Hz Synchronous Lock)</div>
            <span style={{ fontSize: 9, color: T.textMuted }}>ECG Lead-II (White) · SpO₂ Plethysmogram (Orange) · Real-Time QRS Rhythm</span>
          </div>

          <CrewGrid
            telemetryMap={telemetryMap}
            onOpenTriage={handleTriage}
          />
        </div>

        {/* ─── 4. OPERATIONAL ENVIRONMENTAL & DOSIMETRY MONITORING SUITE ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14 }}>
          {/* Graph 1: Mission Longitudinal Trajectory (Space Radiation Environment & Cumulative Dose) */}
          {(() => {
            const liveFlux = anyPkt?.radiation_flux !== undefined
              ? anyPkt.radiation_flux
              : (currentScenario && (currentScenario.includes('RADIATION') || currentScenario.includes('SOLAR')) ? 42.5 : 1.24);
            const liveDoseGy = anyPkt?.radiation_dose_gy !== undefined
              ? anyPkt.radiation_dose_gy
              : (currentScenario && (currentScenario.includes('RADIATION') || currentScenario.includes('SOLAR')) ? 0.184 : 0.1424);
            const liveDoseMsv = liveDoseGy * 1000;
            const isSpeEvent = liveFlux > 5.0 || (currentScenario && (currentScenario.includes('RADIATION') || currentScenario.includes('SOLAR')));

            // Scale: Left Y-axis (Dose: 0 to 250 mSv), Right Y-axis (Flux: 0 to 50 mGy/d)
            // Plot range: x from 48 to 480 (w=432), y from 30 to 160 (h=130)
            const doseToY = (d: number) => 160 - (Math.min(250, Math.max(0, d)) / 250) * 130;
            const fluxToY = (f: number) => 160 - (Math.min(50, Math.max(0, f)) / 50) * 130;

            const nowDoseY = doseToY(liveDoseMsv);
            const nowFluxY = fluxToY(liveFlux);

            // Helper: Smooth Catmull-Rom cubic Bezier spline generator
            const getSpline = (pts: { x: number; y: number }[], tension = 0.5) => {
              if (pts.length < 2) return '';
              let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
              for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[i === 0 ? 0 : i - 1];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
                const cp1x = p1.x + (p2.x - p0.x) * (tension / 3);
                const cp1y = p1.y + (p2.y - p0.y) * (tension / 3);
                const cp2x = p2.x - (p3.x - p1.x) * (tension / 3);
                const cp2y = p2.y - (p3.y - p1.y) * (tension / 3);
                d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
              }
              return d;
            };

            // Cumulative Dose Multi-Milestone Trajectory (monotonic physical tissue dose)
            const dosePoints = [
              { x: 48, y: 160.0 }, // FD-01 Launch
              { x: 85, y: doseToY(18.2) }, // FD-04 Van Allen exit
              { x: 135, y: doseToY(28.0) }, // FD-25 Translunar Drift
              { x: 185, y: doseToY(40.5) }, // FD-45 Lunar Flyby
              { x: 245, y: doseToY(63.0) }, // FD-80 Deep Space Cruise
              { x: 310, y: doseToY(98.5) }, // FD-112 SPE Flare step
              { x: 360, y: doseToY(108.0) }, // FD-135 Recovery
              { x: 415, y: doseToY(124.5) }, // FD-160 Deep Transit
              { x: 480, y: nowDoseY }, // FD-184 Today
            ];

            // Real-Time & Historical Ambient Flux Trajectory
            const fluxPoints = [
              { x: 48, y: fluxToY(0.2) },
              { x: 85, y: fluxToY(8.5) }, // Van Allen
              { x: 110, y: fluxToY(1.3) },
              { x: 185, y: fluxToY(1.24) },
              { x: 245, y: fluxToY(1.24) },
              { x: 300, y: fluxToY(2.1) },
              { x: 310, y: fluxToY(34.0) }, // Historical SPE peak
              { x: 325, y: fluxToY(6.5) },
              { x: 345, y: fluxToY(1.3) },
              { x: 415, y: fluxToY(1.24) },
              ...(isSpeEvent
                ? [
                    { x: 445, y: fluxToY(Math.min(liveFlux * 0.35, 18.0)) },
                    { x: 465, y: fluxToY(Math.min(liveFlux * 0.75, 36.0)) },
                    { x: 480, y: nowFluxY },
                  ]
                : [
                    { x: 450, y: fluxToY(1.24) },
                    { x: 480, y: nowFluxY },
                  ]),
            ];

            const doseSpline = getSpline(dosePoints, 0.4);
            const doseArea = `${doseSpline} L 480 160 L 48 160 Z`;
            const fluxSpline = getSpline(fluxPoints, 0.4);

            return (
              <div style={{
                ...cardStyle,
                background: isSpeEvent
                  ? 'linear-gradient(180deg, #1f1518 0%, #100d0f 100%)'
                  : 'linear-gradient(180deg, #181d22 0%, #0f1316 100%)',
                border: isSpeEvent
                  ? '1px solid rgba(239, 68, 68, 0.45)'
                  : `1px solid ${T.border}`,
                boxShadow: isSpeEvent
                  ? '0 4px 20px rgba(239, 68, 68, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  : cardStyle.boxShadow,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ ...labelStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Mission Dosimetry Trajectory // FD-01 → Today (FD-184)
                      </div>
                      <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Cumulative Tissue Dose (mSv) &amp; Real-Time Proton Flux (mGy/d)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, fontFamily: T.mono, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(230, 168, 60, 0.1)',
                        border: '1px solid rgba(230, 168, 60, 0.28)',
                        padding: '2px 8px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ width: 8, height: 2.5, background: '#e6a83c', borderRadius: 1 }} />
                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>Dose: {liveDoseMsv.toFixed(1)} mSv</span>
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: isSpeEvent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.1)',
                        border: `1px solid ${isSpeEvent ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.25)'}`,
                        padding: '2px 8px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ width: 8, height: 2.5, background: isSpeEvent ? '#ef4444' : '#38bdf8', borderRadius: 1 }} />
                        <span style={{ color: isSpeEvent ? '#ef4444' : '#38bdf8', fontWeight: 700 }}>
                          Flux: {liveFlux.toFixed(2)} mGy/d
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Dual-Axis SVG Container */}
                  <div style={{ position: 'relative', width: '100%', height: 185, background: '#090c0f', borderRadius: 4, border: `1px solid ${T.borderSubtle}`, overflow: 'hidden' }}>
                    <svg viewBox="0 0 540 185" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                      <defs>
                        <linearGradient id="doseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e6a83c" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#e6a83c" stopOpacity="0.01" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid Lines */}
                      <line x1="48" y1="30" x2="480" y2="30" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="48" y1="62.5" x2="480" y2="62.5" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="48" y1="95" x2="480" y2="95" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="48" y1="127.5" x2="480" y2="127.5" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="48" y1="160" x2="480" y2="160" stroke="#25303e" strokeWidth="1" />

                      {/* NASA 30-Day Caution Gate (250 mSv) */}
                      <line x1="48" y1="30" x2="480" y2="30" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" />
                      <text x="52" y="24" fill="#f87171" fontSize="7.5" fontFamily={T.mono} fontWeight="bold">
                        NASA 30-DAY PERMISSIBLE GATE (250 mSv)
                      </text>

                      {/* SPE Event Flux Threshold Gate (5.0 mGy/d) */}
                      <line x1="48" y1="147" x2="480" y2="147" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.8" />
                      <text x="210" y="144" fill="#f59e0b" fontSize="7" fontFamily={T.mono}>
                        SPE PROTON ALARM GATE (5.0 mGy/d)
                      </text>

                      {/* Flight Milestone Vertical Lines */}
                      <line x1="85" y1="20" x2="85" y2="160" stroke="#2a3545" strokeWidth="0.8" strokeDasharray="2,2" />
                      <text x="85" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">FD-04 TLI</text>

                      <line x1="185" y1="20" x2="185" y2="160" stroke="#2a3545" strokeWidth="0.8" strokeDasharray="2,2" />
                      <text x="185" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">LUNAR FLYBY</text>

                      <line x1="310" y1="20" x2="310" y2="160" stroke="#e6a83c" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6" />
                      <text x="310" y="172" fill="#e6a83c" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">SPE FLARE</text>

                      <line x1="415" y1="20" x2="415" y2="160" stroke="#2a3545" strokeWidth="0.8" strokeDasharray="2,2" />
                      <text x="415" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">DEEP TRANSIT</text>

                      <line x1="480" y1="20" x2="480" y2="160" stroke={isSpeEvent ? '#ef4444' : '#4ade80'} strokeWidth="1.2" />
                      <text x="480" y="172" fill={isSpeEvent ? '#ef4444' : '#4ade80'} fontSize="8" fontFamily={T.mono} textAnchor="middle" fontWeight="bold">
                        TODAY (FD-184)
                      </text>

                      {/* Cumulative Dose Smooth Area Fill & Catmull-Rom Spline (Amber) */}
                      <path d={doseArea} fill="url(#doseGrad)" />
                      <path
                        d={doseSpline}
                        fill="none"
                        stroke="#e6a83c"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="480" cy={nowDoseY} r="4" fill="#e6a83c" />
                      <circle cx="480" cy={nowDoseY} r="7" fill="none" stroke="#e6a83c" strokeWidth="1" opacity="0.5" />

                      {/* Ambient Flux Smooth Spline (Cyan / Red if SPE) */}
                      <path
                        d={fluxSpline}
                        fill="none"
                        stroke={isSpeEvent ? '#ef4444' : '#38bdf8'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="480" cy={nowFluxY} r="3.5" fill={isSpeEvent ? '#ef4444' : '#38bdf8'} />

                      {/* Left Y-Axis Ticks (mSv Dose) */}
                      <text x="42" y="33" fill="#e6a83c" fontSize="7.5" fontFamily={T.mono} textAnchor="end">250</text>
                      <text x="42" y="66" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">188</text>
                      <text x="42" y="98" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">125</text>
                      <text x="42" y="130" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">63</text>
                      <text x="42" y="162" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">0 mSv</text>

                      {/* Right Y-Axis Ticks (mGy/d Flux) */}
                      <text x="486" y="33" fill="#38bdf8" fontSize="7.5" fontFamily={T.mono} textAnchor="start">50</text>
                      <text x="486" y="66" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="start">38</text>
                      <text x="486" y="98" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="start">25</text>
                      <text x="486" y="130" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="start">12</text>
                      <text x="486" y="162" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="start">0 mGy/d</text>
                    </svg>
                  </div>

                  {/* Operational Metrics Footer in Recessed Contrast Wells */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4, paddingTop: 6, borderTop: `1px solid ${T.borderSubtle}` }}>
                    <div style={{
                      background: '#090d12',
                      border: `1px solid ${T.borderSubtle}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Cumulative Tissue Dose</div>
                      <div style={{ fontSize: 12.5, fontFamily: T.mono, fontWeight: 700, color: '#e6a83c', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {liveDoseMsv.toFixed(1)} mSv
                      </div>
                      <div style={{ fontSize: 8.5, color: T.nominal, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Career Margin: +{(600 - liveDoseMsv).toFixed(1)} mSv
                      </div>
                    </div>
                    <div style={{
                      background: isSpeEvent ? 'rgba(239, 68, 68, 0.08)' : '#090d12',
                      border: `1px solid ${isSpeEvent ? 'rgba(239, 68, 68, 0.40)' : T.borderSubtle}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Ambient Proton Flux</div>
                      <div style={{ fontSize: 12.5, fontFamily: T.mono, fontWeight: 700, color: isSpeEvent ? '#ef4444' : '#38bdf8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {liveFlux.toFixed(2)} mGy/d
                      </div>
                      <div style={{ fontSize: 8.5, color: isSpeEvent ? '#ef4444' : T.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isSpeEvent ? 'CRITICAL: High Solar Event' : 'GCR Quiet Baseline'}
                      </div>
                    </div>
                    <div style={{
                      background: isSpeEvent ? 'rgba(239, 68, 68, 0.08)' : '#090d12',
                      border: `1px solid ${isSpeEvent ? 'rgba(239, 68, 68, 0.40)' : T.borderSubtle}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Vehicle Shielding Status</div>
                      <div style={{ fontSize: 12.5, fontFamily: T.mono, fontWeight: 700, color: isSpeEvent ? '#ef4444' : '#4ade80', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isSpeEvent ? 'STORM SHELTER' : 'PASSIVE HULL'}
                      </div>
                      <div style={{ fontSize: 8.5, color: T.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isSpeEvent ? 'Water Wall Deployed' : 'Polyethylene Hull Core'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Graph 2: Continuous 24-Hour ECLSS Cabin Habitat ppCO2 Flight Rule Dynamics */}
          {(() => {
            const isBreach = co2Val > 3.0;
            const isElevated = co2Val > 2.0;

            // Left Y-axis (Cabin ppCO2 in mmHg, range 0 to 6.0 mmHg)
            // Plot range: x from 44 to 470 (w=426), y from 30 to 160 (h=130)
            const co2ToY = (c: number) => 160 - (Math.min(6.0, Math.max(0, c)) / 6.0) * 130;
            const nowCo2Y = co2ToY(co2Val);

            // Helper: Smooth Catmull-Rom cubic Bezier spline generator
            const getSpline = (pts: { x: number; y: number }[], tension = 0.5) => {
              if (pts.length < 2) return '';
              let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
              for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[i === 0 ? 0 : i - 1];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
                const cp1x = p1.x + (p2.x - p0.x) * (tension / 3);
                const cp1y = p1.y + (p2.y - p0.y) * (tension / 3);
                const cp2x = p2.x - (p3.x - p1.x) * (tension / 3);
                const cp2y = p2.y - (p3.y - p1.y) * (tension / 3);
                d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
              }
              return d;
            };

            // Generate 25 smooth hourly points modeling authentic 140-minute CDRA molecular sieve cycles
            const co2Points: { x: number; y: number }[] = [];
            for (let t = 0; t <= 24; t++) {
              const x = 44 + (t / 24) * 426;
              // CDRA 140-minute bed half-cycle wave (period ~ 2.33 hours, amplitude ~ 0.10 mmHg)
              const cdraWave = Math.sin((t / 2.33) * Math.PI * 2) * 0.10;
              // Crew circadian metabolic production cycle
              const diurnal = 0.05 * Math.sin(((t - 6) / 24) * Math.PI * 2);
              const nominalBaseline = 1.76 + diurnal + cdraWave;

              let pointVal = nominalBaseline;
              if (isBreach || (currentScenario && currentScenario.includes('CO2'))) {
                // Scrubber breakthrough / saturation accumulation over last 7 hours (t >= 17)
                if (t >= 17) {
                  const u = (t - 17) / 7;
                  const blend = u * u * (3 - 2 * u); // Smooth Hermite transition
                  const preFailure = 1.76 + diurnal;
                  pointVal = preFailure * (1 - blend) + co2Val * blend;
                }
              } else if (isElevated) {
                // Moderate elevation ramp over last 5 hours
                if (t >= 19) {
                  const u = (t - 19) / 5;
                  const blend = u * u * (3 - 2 * u);
                  pointVal = nominalBaseline * (1 - blend) + co2Val * blend;
                }
              } else {
                // Nominal gentle convergence to live co2Val over the last 3 hours
                if (t >= 21) {
                  const u = (t - 21) / 3;
                  const blend = u * u * (3 - 2 * u);
                  pointVal = nominalBaseline + (co2Val - nominalBaseline) * blend;
                }
              }
              if (t === 24) pointVal = co2Val;
              co2Points.push({ x, y: co2ToY(pointVal) });
            }

            const co2Spline = getSpline(co2Points, 0.45);
            const co2Area = `${co2Spline} L 470 160 L 44 160 Z`;

            return (
              <div style={{
                ...cardStyle,
                background: isBreach
                  ? 'linear-gradient(180deg, #1f1518 0%, #100d0f 100%)'
                  : isElevated
                  ? 'linear-gradient(180deg, #1c1913 0%, #12100a 100%)'
                  : 'linear-gradient(180deg, #181d22 0%, #0f1316 100%)',
                border: isBreach
                  ? '1px solid rgba(239, 68, 68, 0.45)'
                  : isElevated
                  ? '1px solid rgba(245, 158, 11, 0.40)'
                  : `1px solid ${T.border}`,
                boxShadow: isBreach
                  ? '0 4px 20px rgba(239, 68, 68, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  : isElevated
                  ? '0 4px 20px rgba(245, 158, 11, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  : cardStyle.boxShadow,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ ...labelStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        24-Hour Continuous Cabin ppCO₂ Dynamics
                      </div>
                      <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        NASA-STD-3001 Flight Rule Limits (&lt; 3.00 mmHg)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, fontFamily: T.mono, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      <span style={{
                        background: isBreach ? 'rgba(239, 68, 68, 0.18)' : isElevated ? 'rgba(245, 158, 11, 0.15)' : 'rgba(74, 222, 128, 0.12)',
                        border: `1px solid ${isBreach ? 'rgba(239, 68, 68, 0.4)' : isElevated ? 'rgba(245, 158, 11, 0.35)' : 'rgba(74, 222, 128, 0.3)'}`,
                        color: isBreach ? '#ef4444' : isElevated ? '#f59e0b' : '#4ade80',
                        padding: '2px 8px',
                        borderRadius: 3,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        ppCO₂: {co2Val.toFixed(2)} mmHg
                      </span>
                      <span style={{ color: '#849db5', whiteSpace: 'nowrap' }}>101.3 kPa · 21.3 kPa O₂</span>
                    </div>
                  </div>

                  {/* SVG Container with True Labeled Scales & Physical Zones */}
                  <div style={{ position: 'relative', width: '100%', height: 185, background: '#090c0f', borderRadius: 4, border: `1px solid ${T.borderSubtle}`, overflow: 'hidden' }}>
                    <svg viewBox="0 0 500 185" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                      <defs>
                        <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isBreach ? '#ef4444' : isElevated ? '#f59e0b' : '#4ade80'} stopOpacity={isBreach ? '0.35' : '0.22'} />
                          <stop offset="100%" stopColor={isBreach ? '#ef4444' : isElevated ? '#f59e0b' : '#4ade80'} stopOpacity="0.01" />
                        </linearGradient>
                      </defs>

                      {/* Physical Environmental Zone Backgrounds */}
                      {/* Red Excursion Zone (> 3.0 mmHg: y 30 to 95) */}
                      <rect x="44" y="30" width="426" height="65" fill="rgba(239, 68, 68, 0.05)" />
                      {/* Amber Caution Corridor (2.0 to 3.0 mmHg: y 95 to 116.7) */}
                      <rect x="44" y="95" width="426" height="21.7" fill="rgba(245, 158, 11, 0.04)" />
                      {/* Green Nominal Envelope (0 to 2.0 mmHg: y 116.7 to 160) */}
                      <rect x="44" y="116.7" width="426" height="43.3" fill="rgba(74, 222, 128, 0.02)" />

                      {/* Horizontal Grid Lines */}
                      <line x1="44" y1="30" x2="470" y2="30" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="44" y1="51.7" x2="470" y2="51.7" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="44" y1="95" x2="470" y2="95" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="44" y1="116.7" x2="470" y2="116.7" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="44" y1="138.3" x2="470" y2="138.3" stroke="#1f2732" strokeWidth="0.8" />
                      <line x1="44" y1="160" x2="470" y2="160" stroke="#25303e" strokeWidth="1" />

                      {/* NASA Flight Rule Limit: 3.00 mmHg (Red Dashed) */}
                      <line x1="44" y1="95" x2="470" y2="95" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4,3" />
                      <text x="48" y="90" fill="#f87171" fontSize="7.5" fontFamily={T.mono} fontWeight="bold">
                        NASA-STD-3001 1-HR FLIGHT RULE LIMIT (3.00 mmHg)
                      </text>

                      {/* Operational Caution Floor: 2.00 mmHg (Amber Dotted) */}
                      <line x1="44" y1="116.7" x2="470" y2="116.7" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.7" />
                      <text x="465" y="113" fill="#f59e0b" fontSize="6.8" fontFamily={T.mono} textAnchor="end">
                        CAUTION BAND (2.00 mmHg)
                      </text>

                      {/* Continuous Smooth 24H ppCO2 Spline & Area Fill */}
                      <path d={co2Area} fill="url(#co2Grad)" />
                      <path
                        d={co2Spline}
                        fill="none"
                        stroke={isBreach ? '#ef4444' : isElevated ? '#f59e0b' : '#4ade80'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="470" cy={nowCo2Y} r="4" fill={isBreach ? '#ef4444' : isElevated ? '#f59e0b' : '#4ade80'} />
                      <circle cx="470" cy={nowCo2Y} r="7" fill="none" stroke={isBreach ? '#ef4444' : isElevated ? '#f59e0b' : '#4ade80'} strokeWidth="1" opacity="0.5" />

                      {/* Left Y-Axis Ticks (mmHg) */}
                      <text x="38" y="33" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">6.0</text>
                      <text x="38" y="55" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">5.0</text>
                      <text x="38" y="98" fill="#ef4444" fontSize="7.5" fontFamily={T.mono} textAnchor="end" fontWeight="bold">3.0</text>
                      <text x="38" y="119" fill="#f59e0b" fontSize="7" fontFamily={T.mono} textAnchor="end">2.0</text>
                      <text x="38" y="141" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">1.0</text>
                      <text x="38" y="162" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">0.0</text>

                      {/* Time Axis Markers */}
                      <text x="44" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-24h</text>
                      <text x="120" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-18h</text>
                      <text x="200" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-12h</text>
                      <text x="280" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-6h</text>
                      <text x="350" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-3h</text>
                      <text x="410" y="172" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-1h</text>
                      <text x="470" y="172" fill={isBreach ? '#ef4444' : '#4ade80'} fontSize="7.5" fontFamily={T.mono} textAnchor="middle" fontWeight="bold">NOW</text>
                    </svg>
                  </div>

                  {/* Environmental Flight Rule Status Footer in Recessed Contrast Wells */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4, paddingTop: 6, borderTop: `1px solid ${T.borderSubtle}` }}>
                    <div style={{
                      background: isBreach ? 'rgba(239, 68, 68, 0.08)' : '#090d12',
                      border: `1px solid ${isBreach ? 'rgba(239, 68, 68, 0.40)' : T.borderSubtle}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Flight Rule Compliance</div>
                      <div style={{ fontSize: 12.5, fontFamily: T.mono, fontWeight: 700, color: isBreach ? '#ef4444' : '#4ade80', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isBreach ? 'EXCEEDED' : 'NOMINAL'}
                      </div>
                      <div style={{ fontSize: 8.5, color: isBreach ? '#ef4444' : T.nominal, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isBreach ? `+${(co2Val - 3.0).toFixed(2)} mmHg (1-Hr Limit)` : `Margin: +${(3.0 - co2Val).toFixed(2)} mmHg`}
                      </div>
                    </div>
                    <div style={{
                      background: isBreach ? 'rgba(239, 68, 68, 0.08)' : '#090d12',
                      border: `1px solid ${isBreach ? 'rgba(239, 68, 68, 0.40)' : T.borderSubtle}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>CDRA Scrubber Assembly</div>
                      <div style={{ fontSize: 12.5, fontFamily: T.mono, fontWeight: 700, color: isBreach ? '#ef4444' : '#f8fafc', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isBreach ? 'BED A SATURATED' : 'BED A/B CYCLING'}
                      </div>
                      <div style={{ fontSize: 8.5, color: isBreach ? '#ef4444' : T.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isBreach ? 'Cycle Bed B Bypass' : '140-Min Desorb Cycle'}
                      </div>
                    </div>
                    <div style={{
                      background: isBreach ? 'rgba(245, 158, 11, 0.08)' : '#090d12',
                      border: `1px solid ${isBreach ? 'rgba(245, 158, 11, 0.40)' : T.borderSubtle}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Contingency LiOH Reserves</div>
                      <div style={{ fontSize: 12.5, fontFamily: T.mono, fontWeight: 700, color: isBreach ? '#f59e0b' : '#4ade80', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isBreach ? 'ARM CANISTERS' : '6 CANISTERS'}
                      </div>
                      <div style={{ fontSize: 8.5, color: T.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isBreach ? 'Manual Install Directive' : '100% Reserve · Sealed'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────────────────────────
  // CREW TAB — NASA MCC 4-COLUMN DECISION DASHBOARD (OPTION 2)
  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // CREW TAB — NASA MCC 4-COLUMN DECISION DASHBOARD (FULLY DYNAMIC & SCENARIO-AWARE)
  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // CREW TAB — NASA MCC 4-COLUMN DECISION DASHBOARD (FULLY DYNAMIC & SCENARIO-AWARE)
  // ─────────────────────────────────────────────────────────────
  const renderCrew = () => {
    const selCrew = CREW.find(c => c.id === selCrewId) || CREW[1]; // Default to CREW-02 Pilot
    const anyPkt = Object.values(telemetryMap)[0];
    const co2Val = anyPkt?.cabin_co2 || 1.82;

    // Helper: generate realistic, smooth 2-hour trend history ending precisely at live metric value
    const generateTrendSeries = (baseVal: number, currentVal: number, count = 11, noise = 0.5) => {
      const arr: number[] = [];
      for (let i = 0; i < count; i++) {
        const frac = i / (count - 1);
        const curve = Math.pow(frac, 1.8);
        const jitter = i < count - 1 ? Math.sin(i * 1.7 + baseVal) * noise : 0;
        const val = baseVal + (currentVal - baseVal) * curve + jitter;
        arr.push(Number(val.toFixed(1)));
      }
      return arr;
    };

    // Compute crew member stats dynamically matching NASA MCC reference & live telemetry
    const getStats = (c: typeof CREW[number]) => {
      const p = telemetryMap[c.id];
      const osdr = NASA_OSDR_PROFILES[c.id] || NASA_OSDR_PROFILES['AST-02_PILOT'];
      const isPlt = c.id === 'AST-02_PILOT';
      const isMs1 = c.id === 'AST-03_MEDICAL';
      const isMs2 = c.id === 'AST-04_ENGINEER';

      // Live priority: if live telemetry packet exists, use actual measured sensor readings
      const hr = p ? Math.round(p.heart_rate) : Math.round(osdr.restHr);
      const spo2 = p ? p.spo2 : osdr.restSpo2;
      const resp = p
        ? (p.heart_rate > c.baseHr + 20 ? Math.round(c.baseResp * 1.35) : Math.round(c.baseResp * (p.heart_rate / c.baseHr)))
        : (isPlt ? 18 : (isMs1 ? 15 : isMs2 ? 13 : c.baseResp));
      const temp = p ? p.core_temp : osdr.restTemp;
      const hrv = p ? p.hrv_rmssd : osdr.restHrv;
      const workload = p
        ? (p.mission_state === 'WORKOUT' ? 0.82 : (p.heart_rate > c.baseHr + 15 ? 0.65 : 0.24))
        : (isPlt ? 0.82 : 0.24);

      // Clinical biomarkers & computed metrics from live telemetry packet with OSDR fallback
      const potassium = p?.potassium !== undefined ? p.potassium : osdr.k;
      const qtc = p?.computed_qtc !== undefined ? p.computed_qtc : (p?.heart_rate ? Math.round(390 * Math.pow(60 / p.heart_rate, 0.33)) : 402);
      const arf = p?.computed_arf !== undefined ? p.computed_arf : 0.72;
      const trm = p?.computed_trm !== undefined ? p.computed_trm : 1.02;
      const rsi = p?.computed_rsi !== undefined ? p.computed_rsi : 0.12;
      const radFlux = p?.radiation_flux !== undefined ? p.radiation_flux : 0.04;
      const radDose = p?.radiation_dose_gy !== undefined ? p.radiation_dose_gy : 0.05;
      const hct = p?.hematocrit !== undefined ? p.hematocrit : osdr.hct;
      const plt = p?.platelet_count !== undefined ? p.platelet_count : osdr.plt;
      const wbc = p?.wbc_count !== undefined ? p.wbc_count : osdr.wbc;
      const il6 = p?.il_6 !== undefined ? p.il_6 : osdr.il6;
      const crp = p?.crp !== undefined ? p.crp : osdr.crp;
      const lymphocytes = p?.lymphocyte_count !== undefined ? p.lymphocyte_count : 1.8;

      // Z-scores
      const z_score_hr = p?.z_score_hr !== undefined ? p.z_score_hr : Number(((hr - c.baseHr) / 4.8).toFixed(2));
      const z_score_hrv = p?.z_score_hrv !== undefined ? p.z_score_hrv : Number(((hrv - c.baseHrv) / 8.0).toFixed(2));
      const z_score_spo2 = Number(((spo2 - c.baseSpo2) / 0.6).toFixed(2));
      const z_score_resp = Number(((resp - c.baseResp) / 1.5).toFixed(2));
      const z_score_temp = Number(((temp - c.baseTemp) / 0.25).toFixed(2));

      // Deltas
      const hrDeltaPct = ((hr - c.baseHr) / c.baseHr) * 100;
      const spo2DeltaPct = ((spo2 - c.baseSpo2) / c.baseSpo2) * 100;
      const respDeltaPct = ((resp - c.baseResp) / c.baseResp) * 100;
      const tempDeltaAbs = temp - c.baseTemp;

      const rawSev = p?.evaluated_severity;
      const hasDbAlert = backendAlerts.some(a => (a.astronaut_id === c.id || a.astronaut_id === 'ALL_CREW') && a.severity !== 'NOMINAL');
      const scenKey = currentScenario || p?.scenario_phase || anyPkt?.scenario_phase || 'NOMINAL_CRUISE';
      const isAnomaly = (p && (rawSev === 'CRITICAL' || rawSev === 'WARNING' || hrDeltaPct > 20 || spo2 < 97 || potassium < 3.5 || qtc > 450 || trm > 1.6 || radFlux > 5.0)) ||
        (!p && isPlt) ||
        hasDbAlert ||
        (scenKey.includes('HYPOKALEMIA') && (c.id === 'AST-02_PILOT' || potassium < 3.5)) ||
        (scenKey.includes('THROMBOSIS') && (c.id === 'AST-02_PILOT' || trm > 1.6)) ||
        (scenKey.includes('RADIATION') && radFlux > 5.0) ||
        ((scenKey.includes('CO2') || co2Val > 3.0) && c.id === 'AST-02_PILOT');

      const status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = isAnomaly
        ? (rawSev === 'CRITICAL' || hrDeltaPct > 35 || potassium < 3.2 || qtc > 470 || radFlux > 20 || spo2 < 92 ? 'CRITICAL' : 'WARNING')
        : 'NOMINAL';
      const statusLabel = isAnomaly ? '↑ At Risk' : 'Nominal';

      return {
        hr,
        spo2,
        resp,
        temp,
        hrv,
        workload,
        potassium,
        qtc,
        arf,
        trm,
        rsi,
        radFlux,
        radDose,
        hct,
        plt,
        wbc,
        il6,
        crp,
        lymphocytes,
        z_score_hr,
        z_score_hrv,
        z_score_spo2,
        z_score_resp,
        z_score_temp,
        hrDeltaPct,
        spo2DeltaPct,
        respDeltaPct,
        tempDeltaAbs,
        status,
        statusLabel,
        isAnomaly,
        osdr,
      };
    };

    const selStats = getStats(selCrew);
    const selPkt = telemetryMap[selCrew.id];
    const scen = currentScenario || selPkt?.scenario_phase || anyPkt?.scenario_phase || 'NOMINAL_CRUISE';

    // Scenario flags for selected astronaut
    const isHypo = scen.includes('HYPOKALEMIA') || selStats.potassium < 3.50 || selStats.qtc > 450;
    const isRad = scen.includes('RADIATION') || scen.includes('SOLAR') || scen.includes('CYTOGENIC') || selStats.radFlux > 5.0;
    const isThromb = scen.includes('THROMBOSIS') || selStats.trm > 1.60;
    const isCo2 = scen.includes('CO2') || co2Val > 3.0;
    const isAmmonia = scen.includes('AMMONIA') || scen.includes('COOLANT');
    const isDecomp = scen.includes('DECOMPRESSION') || scen.includes('HYPOXIA') || selStats.spo2 < 92.0;
    const isImmune = scen.includes('SEPSIS') || scen.includes('CYTOKINE') || scen.includes('VIRUS') || selStats.il6 > 15.0;
    const isExertion = (selStats.hrDeltaPct > 20 || selPkt?.mission_state === 'WORKOUT') && !isHypo && !isRad && !isThromb && !isCo2 && !isAmmonia && !isDecomp && !isImmune;

    // Live Synchronous Trend series (Last 2 Hours) dynamically generated for ANY selected astronaut
    const hrTrendData = generateTrendSeries(selCrew.baseHr, selStats.hr, 11, 1.2);
    const spo2TrendData = generateTrendSeries(selCrew.baseSpo2, selStats.spo2, 11, 0.12);
    const respTrendData = generateTrendSeries(selCrew.baseResp, selStats.resp, 11, 0.35);
    const tempTrendData = generateTrendSeries(selCrew.baseTemp, selStats.temp, 11, 0.03);

    // Sparkline micro-series dynamically generated for ANY selected astronaut
    const sparkHr = generateTrendSeries(selCrew.baseHr, selStats.hr, 6, 0.8);
    const sparkSpo2 = generateTrendSeries(selCrew.baseSpo2, selStats.spo2, 5, 0.1);
    const sparkResp = generateTrendSeries(selCrew.baseResp, selStats.resp, 5, 0.3);
    const sparkTemp = generateTrendSeries(selCrew.baseTemp, selStats.temp, 5, 0.02);
    const sparkWork = generateTrendSeries(0.24, selStats.workload, 5, 0.02);

    // Dynamic Pearson correlation factors based on scenario
    const correlationFactors = (() => {
      if (isHypo) {
        return [
          { title: 'Serum K⁺ vs QTc Interval', sub: 'I_Kr channel delayed repolarization', weight: 94, r: '-0.94', color: '#ff4d4d' },
          { title: 'Fridericia QTc vs ARF Index', sub: 'Arrhythmogenic substrate coupling', weight: 88, r: '+0.88', color: '#fbbf24' },
          { title: 'Heart Rate vs Sympathetic Drift', sub: 'Compensatory chronotropic response', weight: 76, r: '+0.76', color: '#fbbf24' },
          { title: 'Fluid Loss vs Aldosterone Excretion', sub: 'Microgravity renal potassium wasting', weight: 62, r: '+0.62', color: '#38bdf8' },
        ];
      }
      if (isRad) {
        return [
          { title: 'HERA Proton Flux vs CAD Silicon', sub: 'Hull microdosimeter coincident triggering', weight: 96, r: '+0.96', color: '#ff4d4d' },
          { title: 'Cumulative Dose vs RSI Index', sub: 'DNA double-strand break susceptibility', weight: 89, r: '+0.89', color: '#fbbf24' },
          { title: 'GCR Background vs Solar Flare', sub: 'Coronal mass ejection particle influx', weight: 74, r: '+0.74', color: '#fbbf24' },
          { title: 'Leukocyte Radio-Sensitivity', sub: 'Circulating lymphocyte decline slope', weight: 58, r: '+0.58', color: '#38bdf8' },
        ];
      }
      if (isThromb) {
        return [
          { title: 'Jugular Flow Stasis vs TRM Index', sub: 'Internal jugular vein flow velocity stagnation', weight: 92, r: '+0.92', color: '#fbbf24' },
          { title: 'Hematocrit Hemoconcentration', sub: 'Relative plasma volume contraction', weight: 85, r: '+0.85', color: '#fbbf24' },
          { title: 'Cephalad Fluid Shift Persistence', sub: 'Chronic microgravity headward engorgement', weight: 78, r: '+0.78', color: '#fbbf24' },
          { title: 'Endothelial Shear Stress Variance', sub: 'Venous valve wall remodeling response', weight: 54, r: '+0.54', color: '#38bdf8' },
        ];
      }
      if (isCo2) {
        return [
          { title: 'Cabin CO₂ vs Minute Ventilation', sub: 'Hypercapnic respiratory drive coupling', weight: 90, r: '+0.90', color: '#fbbf24' },
          { title: 'Scrubber Effluent vs Hab Concentration', sub: 'Bed A breakthrough gradient tracking', weight: 94, r: '+0.94', color: '#fbbf24' },
          { title: 'Hypercapnic Autonomic Coupling', sub: 'Chemoreceptor chronotropic tachycardia', weight: 68, r: '+0.68', color: '#38bdf8' },
          { title: 'Thermal Loop Radiator Heat Flux', sub: 'Environmental loop convective balance', weight: 34, r: '+0.34', color: '#94a3b8' },
        ];
      }
      if (isAmmonia) {
        return [
          { title: 'Radiator P-Drop vs Ammonia Sensor', sub: 'ATCS loop differential pressure ingress', weight: 95, r: '+0.95', color: '#ff4d4d' },
          { title: 'Airway Reactivity vs Minute Resp', sub: 'Mucosal chemical irritation bronchospasm', weight: 86, r: '+0.86', color: '#fbbf24' },
          { title: 'Sympathetic Tachycardia Reflex', sub: 'Arterial hypoperfusion compensatory drive', weight: 78, r: '+0.78', color: '#fbbf24' },
          { title: 'Cabin Recirculation Flow Speed', sub: 'Trace contaminant scrubber filtration rate', weight: 44, r: '+0.44', color: '#38bdf8' },
        ];
      }
      if (isDecomp) {
        return [
          { title: 'Cabin Total Pressure vs SpO₂', sub: 'Alveolar oxygen diffusion gradient loss', weight: 96, r: '+0.96', color: '#ff4d4d' },
          { title: 'Hypoxemic Gradient vs Heart Rate', sub: 'Carotid chemoreceptor tachycardic reflex', weight: 88, r: '+0.88', color: '#fbbf24' },
          { title: 'Ventilatory Drive Compensation', sub: 'Tidal volume and tachypnea elevation', weight: 82, r: '+0.82', color: '#fbbf24' },
          { title: 'Avcoat Hull Depressurization Rate', sub: 'Pressure seal leak rate: -0.8 kPa/min', weight: 65, r: '+0.65', color: '#38bdf8' },
        ];
      }
      if (isImmune) {
        return [
          { title: 'Interleukin-6 vs WBC Count', sub: 'Innate immune sentinel mobilization', weight: 91, r: '+0.91', color: '#ff4d4d' },
          { title: 'C-Reactive Protein (CRP) Surge', sub: 'Acute phase hepatic reactant cascade', weight: 86, r: '+0.86', color: '#fbbf24' },
          { title: 'Core Body Temperature Slope', sub: 'Endotoxin pyrogen hypothalamic resetting', weight: 72, r: '+0.72', color: '#fbbf24' },
          { title: 'Microgravity Lymphocyte Ratio', sub: 'T-cell suppression / cytokine dysregulation', weight: 60, r: '+0.60', color: '#38bdf8' },
        ];
      }
      if (isExertion) {
        return [
          { title: 'High Physical Exertion', sub: 'Active cycle / EVA mass-handling protocol', weight: 88, r: '+0.88', color: '#fbbf24' },
          { title: 'Thermal Regulation Heat Flux', sub: 'Cabin ventilation convective balance (+0.4°C)', weight: 74, r: '+0.74', color: '#fbbf24' },
          { title: 'Ambient CO₂ Excretion Gradient', sub: 'Metabolic respiratory exchange ratio', weight: 56, r: '+0.56', color: '#38bdf8' },
          { title: 'Autonomic Circadian Shift', sub: 'Mission flight day rest-phase envelope', weight: 38, r: '+0.38', color: '#94a3b8' },
        ];
      }
      // Nominal
      return [
        { title: 'Cardiorespiratory Coupling', sub: 'Sinus arrhythmia & eupneic tidal rhythm', weight: 42, r: '+0.42', color: '#4ade80' },
        { title: 'Autonomic Parasympathetic Tone', sub: 'Vagal baroreflex baseline stability', weight: 35, r: '+0.35', color: '#4ade80' },
        { title: 'Baroreflex Homeostasis', sub: 'Stable mean arterial pressure regulation', weight: 31, r: '+0.31', color: '#4ade80' },
        { title: 'Circadian Metabolic Rhythm', sub: 'Entrained core temperature oscillation', weight: 28, r: '+0.28', color: '#4ade80' },
      ];
    })();

    // Active procedure target based on scenario
    const targetProcedureId = (() => {
      if (isHypo) return 'NASA-STD-3001-MED-CARD-04';
      if (isRad) return 'NASA-STD-3001-RAD-SPE-01';
      if (isThromb) return 'NASA-STD-3001-THROMB-01';
      if (isCo2) return 'NASA-STD-3001-ECLSS-CO2-01';
      if (isAmmonia) return 'NASA-STD-3001-ECLSS-AMMONIA-01';
      if (isExertion) return 'M-204';
      return 'NASA-STD-3001-MED-CARD-02';
    })();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ─── 1. Sub-Header Bar (Title + Time Range + Actions) ─── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 0',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Crew Health</span>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textMuted, fontWeight: 400 }}>
                · 10 Hz Telemetry Lock · Inspiration4 OSDR Baselines
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 3D Body Scanner quick toggle button */}
            <button
              onClick={() => setCrewSubTab('3D Bio-Scanner')}
              style={{
                background: crewSubTab === '3D Bio-Scanner' ? 'rgba(0, 229, 255, 0.16)' : '#0d131a',
                border: `1px solid ${crewSubTab === '3D Bio-Scanner' ? '#00e5ff' : '#233647'}`,
                borderRadius: 4,
                padding: '4px 10px',
                color: crewSubTab === '3D Bio-Scanner' ? '#00e5ff' : '#8da2b5',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.12s ease',
              }}
            >
              <span>3D Holographic Scanner</span>
            </button>

            {/* "What Changed?" (Δ Baseline) switch */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#0b0e11',
              border: `1px solid ${diffMode ? '#00e5ff66' : T.borderSubtle}`,
              borderRadius: 4,
              padding: '3px 8px',
            }}>
              <span style={{ fontSize: 9, color: diffMode ? '#00e5ff' : T.textSecondary, fontWeight: diffMode ? 700 : 500 }}>
                What Changed? (Δ Mode)
              </span>
              <button
                onClick={() => setDiffMode(!diffMode)}
                style={{
                  width: 26,
                  height: 14,
                  borderRadius: 7,
                  background: diffMode ? '#00e5ff' : '#222830',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.15s ease',
                }}
                title="Toggle between absolute values and delta from personal baseline"
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: diffMode ? 14 : 2,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#ffffff',
                  transition: 'left 0.15s ease',
                }} />
              </button>
            </div>

            {/* Time range selector */}
            <div style={{ display: 'flex', background: '#0b0e11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 2 }}>
              {(['1h', '6h', '12h', '24h', 'Custom'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  style={{
                    background: timeRange === r ? '#222830' : 'transparent',
                    border: timeRange === r ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                    color: timeRange === r ? '#ffffff' : T.textSecondary,
                    borderRadius: 3,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontWeight: timeRange === r ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Export button */}
            <button
              onClick={() => {
                const dataStr = `CREW HEALTH TELEMETRY REPORT\nMET: T+14d 08:42:19\nTime Window: ${timeRange}\nCrew: ${selCrew.crewNo} ${selCrew.role} (${selCrew.name})\nHR: ${selStats.hr} bpm (${selStats.hrDeltaPct >= 0 ? '+' : ''}${selStats.hrDeltaPct.toFixed(1)}% vs base ${selCrew.baseHr})\nSpO2: ${selStats.spo2.toFixed(1)}% (vs base ${selCrew.baseSpo2}%)\nResp: ${selStats.resp} br/min\nTemp: ${selStats.temp.toFixed(1)} °C\nStatus: ${selStats.statusLabel}`;
                navigator.clipboard.writeText(dataStr);
                alert('Crew health telemetry snapshot copied to clipboard.');
              }}
              style={{
                background: '#11151a',
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                padding: '4px 10px',
                color: T.textSecondary,
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>Export</span>
              <span style={{ fontSize: 8 }}>▼</span>
            </button>
          </div>
        </div>

        {/* ─── 2. Top 4 Astronaut Cards (Dynamically Connected) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {CREW.map(c => {
            const stats = getStats(c);
            const isSelected = c.id === selCrewId;

            return (
              <div
                key={c.id}
                onClick={() => setSelCrewId(c.id)}
                style={{
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'linear-gradient(180deg, #171c21 0%, #101317 100%)',
                  border: isSelected ? '1.5px solid rgba(56, 189, 248, 0.35)' : `1px solid ${stats.isAnomaly ? T.warningBorder : T.borderSubtle}`,
                  borderRadius: 6,
                  padding: '10px 11px',
                  cursor: 'pointer',
                  transition: 'all 0.14s ease',
                  boxShadow: isSelected ? '0 3px 12px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                {/* Header row: Avatar + Name + Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarIcon initial={c.avatarInitial} status={stats.status} size={32} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#ffffff' : T.textPrimary }}>
                        {c.crewNo} {c.role}
                      </div>
                      <div style={{ fontSize: 9, color: T.textMuted }}>{c.name} · {c.callsign}</div>
                    </div>
                  </div>

                  <Badge
                    color={severityColor(stats.status)}
                    borderColor={severityBorder(stats.status)}
                    bg={stats.isAnomaly ? '#141008' : '#090e0a'}
                  >
                    {stats.statusLabel}
                  </Badge>
                </div>

                {/* Mini Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, background: '#0a0d11', borderRadius: 4, padding: '6px 4px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 8, color: diffMode ? '#00e5ff' : T.textMuted }}>{diffMode ? 'Δ HR' : 'HR'}</div>
                    <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: diffMode ? '#00e5ff' : (stats.hrDeltaPct > 20 ? T.warning : T.textPrimary) }}>
                      {diffMode ? `${stats.hr - c.baseHr >= 0 ? '+' : ''}${stats.hr - c.baseHr}` : stats.hr}
                    </div>
                    <div style={{ fontSize: 8, fontFamily: T.mono, color: stats.hrDeltaPct > 20 ? T.warning : T.textMuted }}>
                      {diffMode ? `b:${c.baseHr}` : (stats.hrDeltaPct >= 0 ? `+${stats.hrDeltaPct.toFixed(0)}%` : `${stats.hrDeltaPct.toFixed(0)}%`)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 8, color: diffMode ? '#00e5ff' : T.textMuted }}>{diffMode ? 'Δ SpO₂' : 'SpO₂'}</div>
                    <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: diffMode ? '#00e5ff' : (stats.spo2 < 97 ? T.warning : T.textPrimary) }}>
                      {diffMode ? `${(stats.spo2 - c.baseSpo2) >= 0 ? '+' : ''}${(stats.spo2 - c.baseSpo2).toFixed(1)}%` : `${stats.spo2.toFixed(0)}%`}
                    </div>
                    <div style={{ fontSize: 8, fontFamily: T.mono, color: stats.spo2 < 97 ? T.warning : T.textMuted }}>
                      {diffMode ? `b:${c.baseSpo2}%` : (stats.spo2DeltaPct >= 0 ? `+${stats.spo2DeltaPct.toFixed(1)}%` : `${stats.spo2DeltaPct.toFixed(1)}%`)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 8, color: diffMode ? '#00e5ff' : T.textMuted }}>{diffMode ? 'Δ Resp' : 'Resp'}</div>
                    <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: diffMode ? '#00e5ff' : (stats.respDeltaPct > 20 ? T.warning : T.textPrimary) }}>
                      {diffMode ? `${stats.resp - c.baseResp >= 0 ? '+' : ''}${stats.resp - c.baseResp}` : stats.resp}
                    </div>
                    <div style={{ fontSize: 8, fontFamily: T.mono, color: stats.respDeltaPct > 20 ? T.warning : T.textMuted }}>
                      {diffMode ? `b:${c.baseResp}` : (stats.respDeltaPct >= 0 ? `+${stats.respDeltaPct.toFixed(0)}%` : `${stats.respDeltaPct.toFixed(0)}%`)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 8, color: diffMode ? '#00e5ff' : T.textMuted }}>{diffMode ? 'Δ Temp' : 'Temp'}</div>
                    <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: diffMode ? '#00e5ff' : (stats.tempDeltaAbs > 0.5 ? T.warning : T.textPrimary) }}>
                      {diffMode ? `${stats.tempDeltaAbs >= 0 ? '+' : ''}${stats.tempDeltaAbs.toFixed(1)}°` : stats.temp.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 8, fontFamily: T.mono, color: stats.tempDeltaAbs > 0.5 ? T.warning : T.textMuted }}>
                      {diffMode ? `b:${c.baseTemp}°` : (stats.tempDeltaAbs >= 0 ? `+${stats.tempDeltaAbs.toFixed(1)}` : `${stats.tempDeltaAbs.toFixed(1)}`)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── 3. Sub-Navigation Ribbon (Tabs) — Clean Buttons without External Container Dock ─── */}
        <div style={{
          display: 'flex',
          gap: 6,
          borderBottom: `1px solid ${T.borderSubtle}`,
          paddingBottom: 8,
          marginTop: 4,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}>
          {(['Overview', '3D Bio-Scanner', 'Trends', 'Correlation', 'Baseline & Deviation', 'Medical History', 'Procedures'] as const).map(sub => {
            const isSel = crewSubTab === sub;
            return (
              <button
                key={sub}
                onClick={() => setCrewSubTab(sub)}
                style={{
                  background: isSel ? 'rgba(56, 189, 248, 0.30)' : '#0c1015',
                  border: isSel ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid #202b38',
                  color: isSel ? '#ffffff' : '#9ec7ef',
                  borderRadius: 4,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  textShadow: isSel ? '0 1px 2px rgba(0, 0, 0, 0.75)' : 'none',
                  boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)' : 'none',
                  transition: 'all 0.12s ease',
                }}
              >
                {sub}
              </button>
            );
          })}
        </div>

        {/* ─── 4. Main Deep-Dive Content based on crewSubTab ─── */}
        {crewSubTab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 4-COLUMN OPERATIONAL DEEP DIVE GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.35fr 1.15fr 1.25fr', gap: 12, alignItems: 'stretch' }}>

              {/* ──── COLUMN 1: Key Metrics & Personal Baseline Comparison ──── */}
              <div style={cardStyle}>
                {/* Alert Badge Pill */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: selStats.isAnomaly ? '#161008' : '#090e0a',
                  border: `1px solid ${selStats.isAnomaly ? T.warningBorder : T.nominalBorder}`,
                  borderRadius: 4,
                  marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{selStats.isAnomaly ? '▲' : '●'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: selStats.isAnomaly ? T.warning : T.nominal }}>
                      {selCrew.crewNo} {selCrew.role}
                    </span>
                  </div>
                  <Badge color={severityColor(selStats.status)} borderColor={severityBorder(selStats.status)} bg="#090c0f">
                    {selStats.statusLabel}
                  </Badge>
                </div>

                <div style={{ ...labelStyle, marginBottom: 6 }}>Key Metrics</div>

                {/* Metric rows with mini SVG Sparklines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Heart Rate */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', padding: '6px 8px', borderRadius: 4, border: `1px solid ${T.borderSubtle}` }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.textMuted }}>Heart Rate</div>
                      <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: selStats.hrDeltaPct > 20 ? T.warning : T.textPrimary }}>
                        {selStats.hr} <span style={{ fontSize: 9, color: T.textMuted }}>bpm</span>
                      </div>
                      <div style={{ fontSize: 8, fontFamily: T.mono, color: selStats.hrDeltaPct > 20 ? T.warning : T.textMuted }}>
                        {selStats.hrDeltaPct >= 0 ? `+${selStats.hrDeltaPct.toFixed(1)}% vs base` : `${selStats.hrDeltaPct.toFixed(1)}% vs base`}
                      </div>
                    </div>
                    <Sparkline data={sparkHr} color={selStats.hrDeltaPct > 20 ? T.warning : T.nominal} />
                  </div>

                  {/* SpO2 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', padding: '6px 8px', borderRadius: 4, border: `1px solid ${T.borderSubtle}` }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.textMuted }}>SpO₂</div>
                      <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: selStats.spo2 < 97 ? T.warning : T.textPrimary }}>
                        {selStats.spo2.toFixed(1)} <span style={{ fontSize: 9, color: T.textMuted }}>%</span>
                      </div>
                      <div style={{ fontSize: 8, fontFamily: T.mono, color: selStats.spo2 < 97 ? T.warning : T.textMuted }}>
                        {selStats.spo2DeltaPct >= 0 ? `+${selStats.spo2DeltaPct.toFixed(1)}% vs base` : `${selStats.spo2DeltaPct.toFixed(1)}% vs base`}
                      </div>
                    </div>
                    <Sparkline data={sparkSpo2} color={selStats.spo2 < 97 ? T.warning : '#4682b4'} />
                  </div>

                  {/* Respiration */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', padding: '6px 8px', borderRadius: 4, border: `1px solid ${T.borderSubtle}` }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.textMuted }}>Respiration Rate</div>
                      <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: selStats.respDeltaPct > 20 ? T.warning : T.textPrimary }}>
                        {selStats.resp} <span style={{ fontSize: 9, color: T.textMuted }}>br/min</span>
                      </div>
                      <div style={{ fontSize: 8, fontFamily: T.mono, color: selStats.respDeltaPct > 20 ? T.warning : T.textMuted }}>
                        {selStats.respDeltaPct >= 0 ? `+${selStats.respDeltaPct.toFixed(1)}% vs base` : `${selStats.respDeltaPct.toFixed(1)}% vs base`}
                      </div>
                    </div>
                    <Sparkline data={sparkResp} color={selStats.respDeltaPct > 20 ? T.warning : T.nominal} />
                  </div>

                  {/* Core Temp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', padding: '6px 8px', borderRadius: 4, border: `1px solid ${T.borderSubtle}` }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.textMuted }}>Core Temperature</div>
                      <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: selStats.tempDeltaAbs > 0.5 ? T.warning : T.textPrimary }}>
                        {selStats.temp.toFixed(1)} <span style={{ fontSize: 9, color: T.textMuted }}>°C</span>
                      </div>
                      <div style={{ fontSize: 8, fontFamily: T.mono, color: selStats.tempDeltaAbs > 0.5 ? T.warning : T.textMuted }}>
                        {selStats.tempDeltaAbs >= 0 ? `+${selStats.tempDeltaAbs.toFixed(1)}°C vs base` : `${selStats.tempDeltaAbs.toFixed(1)}°C vs base`}
                      </div>
                    </div>
                    <Sparkline data={sparkTemp} color={selStats.tempDeltaAbs > 0.5 ? T.warning : '#e08a3c'} />
                  </div>

                  {/* Workload / Strain */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', padding: '6px 8px', borderRadius: 4, border: `1px solid ${T.borderSubtle}` }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.textMuted }}>Workload / Strain</div>
                      <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: selStats.workload > 0.6 ? T.warning : T.textPrimary }}>
                        {selStats.workload > 0.6 ? `High (${(selStats.workload).toFixed(2)})` : `Nominal (${(selStats.workload).toFixed(2)})`}
                      </div>
                      <div style={{ fontSize: 8, fontFamily: T.mono, color: selStats.workload > 0.6 ? T.warning : T.textMuted }}>
                        {selStats.workload > 0.6 ? '+45% vs base' : 'Nominal band'}
                      </div>
                    </div>
                    <Sparkline data={sparkWork} color={selStats.workload > 0.6 ? T.warning : '#7b68ee'} />
                  </div>
                </div>

                {/* Personal Baseline Comparison Table */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>Personal Baseline Comparison</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ color: '#9ec7ef', borderBottom: '1px solid #233140', fontWeight: 700 }}>
                        <th style={{ textAlign: 'left', padding: '4px 0' }}>Metric</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Current</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Baseline</th>
                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Delta</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontFamily: T.mono }}>
                      <tr style={{ borderBottom: `1px solid ${T.borderSubtle}` }}>
                        <td style={{ color: '#d4e3f2', padding: '5px 0', fontFamily: T.sans, fontWeight: 500 }}>Heart Rate</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.hrDeltaPct > 20 ? T.warning : '#ffffff' }}>{selStats.hr} bpm</td>
                        <td style={{ textAlign: 'right', color: '#8fa4ba' }}>{selCrew.baseHr} bpm</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.hrDeltaPct > 20 ? T.warning : T.nominal }}>
                          {selStats.hrDeltaPct >= 0 ? `+${selStats.hrDeltaPct.toFixed(1)}%` : `${selStats.hrDeltaPct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${T.borderSubtle}` }}>
                        <td style={{ color: '#d4e3f2', padding: '5px 0', fontFamily: T.sans, fontWeight: 500 }}>SpO₂</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.spo2 < 97 ? T.warning : '#ffffff' }}>{selStats.spo2.toFixed(1)}%</td>
                        <td style={{ textAlign: 'right', color: '#8fa4ba' }}>{selCrew.baseSpo2.toFixed(1)}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.spo2 < 97 ? T.warning : T.nominal }}>
                          {selStats.spo2DeltaPct >= 0 ? `+${selStats.spo2DeltaPct.toFixed(1)}%` : `${selStats.spo2DeltaPct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${T.borderSubtle}` }}>
                        <td style={{ color: '#d4e3f2', padding: '5px 0', fontFamily: T.sans, fontWeight: 500 }}>Respiration</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.respDeltaPct > 20 ? T.warning : '#ffffff' }}>{selStats.resp} br/m</td>
                        <td style={{ textAlign: 'right', color: '#8fa4ba' }}>{selCrew.baseResp} br/m</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.respDeltaPct > 20 ? T.warning : T.nominal }}>
                          {selStats.respDeltaPct >= 0 ? `+${selStats.respDeltaPct.toFixed(1)}%` : `${selStats.respDeltaPct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: `1px solid ${T.borderSubtle}` }}>
                        <td style={{ color: '#d4e3f2', padding: '5px 0', fontFamily: T.sans, fontWeight: 500 }}>Core Temp</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.tempDeltaAbs > 0.5 ? T.warning : '#ffffff' }}>{selStats.temp.toFixed(1)} °C</td>
                        <td style={{ textAlign: 'right', color: '#8fa4ba' }}>{selCrew.baseTemp.toFixed(1)} °C</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.tempDeltaAbs > 0.5 ? T.warning : T.nominal }}>
                          {selStats.tempDeltaAbs >= 0 ? `+${selStats.tempDeltaAbs.toFixed(1)}°C` : `${selStats.tempDeltaAbs.toFixed(1)}°C`}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: '#d4e3f2', padding: '5px 0', fontFamily: T.sans, fontWeight: 500 }}>Blood Press.</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.isAnomaly ? T.warning : '#ffffff' }}>{selStats.isAnomaly ? '135/88' : selCrew.baseBp}</td>
                        <td style={{ textAlign: 'right', color: '#8fa4ba' }}>{selCrew.baseBp}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: selStats.isAnomaly ? T.warning : T.nominal }}>{selStats.isAnomaly ? '+12%' : '0%'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ──── COLUMN 2: Synchronized Trends (Last 2 Hours) ──── */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={labelStyle}>Trends (Last 2 Hours)</div>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: selStats.isAnomaly ? T.warning : T.nominal }}>
                      <span style={{ width: 10, height: 2, background: selStats.isAnomaly ? T.warning : T.nominal, display: 'inline-block' }} />
                      {selCrew.crewNo}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#687788' }}>
                      <span style={{ width: 10, height: 1, borderTop: '1px dashed #687788', display: 'inline-block' }} />
                      Baseline
                    </span>
                  </div>
                </div>

                {/* 4 Synchronized Charts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <TrendLineChart
                    title="Heart Rate"
                    currentVal={`${selStats.hr}`}
                    baselineVal={selCrew.baseHr}
                    unit="bpm"
                    data={hrTrendData}
                    minY={60}
                    maxY={120}
                    lineColor={selStats.hrDeltaPct > 20 ? T.warning : T.nominal}
                    yTicks={[70, 90, 110]}
                  />

                  <TrendLineChart
                    title="SpO₂"
                    currentVal={`${selStats.spo2.toFixed(1)}`}
                    baselineVal={selCrew.baseSpo2}
                    unit="%"
                    data={spo2TrendData}
                    minY={94}
                    maxY={100}
                    lineColor={selStats.spo2 < 97 ? T.warning : '#4682b4'}
                    yTicks={[95, 97, 99]}
                  />

                  <TrendLineChart
                    title="Respiration Rate"
                    currentVal={`${selStats.resp}`}
                    baselineVal={selCrew.baseResp}
                    unit="br/min"
                    data={respTrendData}
                    minY={10}
                    maxY={22}
                    lineColor={selStats.respDeltaPct > 20 ? T.warning : T.nominal}
                    yTicks={[12, 16, 20]}
                  />

                  <TrendLineChart
                    title="Core Temperature"
                    currentVal={`${selStats.temp.toFixed(1)}`}
                    baselineVal={selCrew.baseTemp}
                    unit="°C"
                    data={tempTrendData}
                    minY={36.0}
                    maxY={37.6}
                    lineColor={selStats.tempDeltaAbs > 0.5 ? T.warning : '#e08a3c'}
                    yTicks={[36.2, 36.8, 37.4]}
                    showTimeTicks={true}
                  />
                </div>
              </div>

              {/* ──── COLUMN 3: EVENT CORRELATION ENGINE (DYNAMICALLY TIED TO ACTIVE SCENARIO) ──── */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={labelStyle}>EVENT CORRELATION ENGINE</div>
                  <span style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    color: selStats.isAnomaly ? '#fbbf24' : '#4ade80',
                    background: selStats.isAnomaly ? 'rgba(245, 158, 11, 0.14)' : 'rgba(34, 197, 94, 0.14)',
                    border: `1px solid ${selStats.isAnomaly ? 'rgba(245, 158, 11, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                    padding: '2px 6px',
                    borderRadius: 3,
                  }}>
                    {selStats.isAnomaly ? '● CAUSAL CHAIN ACTIVE' : '● NOMINAL HOMEOSTASIS'}
                  </span>
                </div>
                <div style={{ fontSize: 9.5, color: '#9ec7ef', marginBottom: 8 }}>
                  Causal Multi-Signal Synthesis · Target: <strong style={{ color: '#ffffff' }}>{selCrew.callsign} ({selCrew.name})</strong>
                </div>

                {/* Scenario-Aware Causal Step Pipeline */}
                {isHypo ? (
                  /* ─── SCENARIO 6: HYPOKALEMIA & ARRHYTHMIA CAUSAL PIPELINE ─── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                    <div style={{ background: '#120b0d', border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>
                          STAGE 1: [TRIGGER] RENAL POTASSIUM EXCRETION
                        </span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:05 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Serum Potassium (K⁺) Depletion</span>
                        <span style={{ color: '#f87171', fontFamily: T.mono }}>{selStats.potassium.toFixed(2)} mmol/L (Floor: 3.50)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>
                        Fluid redistribution and mineralocorticoid activity trigger potassium loss.
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#f87171', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Slows delayed rectifier I_Kr repolarization</span>
                    </div>

                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>
                          STAGE 2: [BIOCHEMICAL] MYOCARDIAL QTc PROLONGATION
                        </span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:12 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Fridericia QTc Interval</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{selStats.qtc.toFixed(0)} ms (Gate: 450 ms)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>
                        Delayed ventricular action potential duration widens cardiac recharge window.
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#fbbf24', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Surges arrhythmogenic vulnerability</span>
                    </div>

                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>
                          STAGE 3: [ELECTROPHYSIOLOGY] ARF RISK ELEVATION
                        </span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:20 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Arrhythmogenic Risk Factor (ARF)</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{selStats.arf.toFixed(2)} (Safe: &lt; 1.00)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>
                        Calculated arrhythmogenic index flags vulnerability to premature ventricular complexes.
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#f87171', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Autonomic chronotropic compensation</span>
                    </div>

                    <div style={{ background: '#120b0d', border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>
                          STAGE 4: [OUTCOME] TACHYCARDIA & ECTOPY THREAT
                        </span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:28 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Compensatory Rate Acceleration</span>
                        <span style={{ color: '#f87171', fontFamily: T.mono }}>{selStats.hr} bpm (+{selStats.hrDeltaPct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>
                        Oral KCl repletion packet and 12-lead ECG review required (NASA-STD-3001-MED-CARD-04).
                      </div>
                    </div>
                  </div>
                ) : isRad ? (
                  /* ─── SCENARIO 3: SOLAR RADIATION STORM CAUSAL PIPELINE ─── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                    <div style={{ background: '#120b0d', border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>STAGE 1: [TRIGGER] SOLAR PROTON FLUX SURGE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:04 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>HERA Silicon Microdosimeters</span>
                        <span style={{ color: '#f87171', fontFamily: T.mono }}>{selStats.radFlux.toFixed(1)} mGy/d (&gt;5.0 mGy/d limit)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>High-energy solar coronal plasma stream crosses interplanetary threshold.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#f87171', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Tissue ionizing dose accumulation</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 2: [BIODOSIMETRY] PERSONAL CAD DOSE RATE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:11 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Cumulative Mission Dose</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{(selStats.radDose * 1000).toFixed(0)} mSv</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Absorbed tissue-equivalent dose exceeds permissible unshielded envelope.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#fbbf24', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Cellular DNA double-strand break risk</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 3: [CYTOGENIC] RSI SUSCEPTIBILITY INDEX</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:19 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Radiation Susceptibility Index</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>RSI {selStats.rsi.toFixed(2)} (Safe: &lt; 0.20)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Radiosensitivity marker indicates heightened acute cytogenic vulnerability.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-2px 0', color: '#f87171', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Immediate storm shelter deployment required</span>
                    </div>
                    <div style={{ background: '#120b0d', border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>STAGE 4: [OUTCOME] STORM SHELTER PROTOCOL</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:25 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Water-Wall Radiation Shelter</span>
                        <span style={{ color: '#f87171', fontFamily: T.mono }}>EVA Terminated · Shelter Active</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Direct crew to central storm shelter (NASA-STD-3001-RAD-SPE-01).</div>
                    </div>
                  </div>
                ) : isThromb ? (
                  /* ─── SCENARIO 7: VENOUS THROMBOSIS CAUSAL PIPELINE ─── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                    <div style={{ background: '#0a0e14', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>STAGE 1: [TRIGGER] CEPHALAD FLUID SHIFT &amp; STASIS</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:08 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Internal Jugular Flow Velocity</span>
                        <span style={{ color: '#38bdf8', fontFamily: T.mono }}>&lt; 4 cm/s (Retrograde Stasis)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Loss of gravitational gradient causes chronic neck vein blood pooling.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#38bdf8', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Microgravity hemoconcentration</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 2: [HEMODYNAMICS] VISCOSITY ELEVATION</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:15 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Hematocrit &amp; Platelets</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>Hct {selStats.hct.toFixed(1)}% · PLT {selStats.plt.toFixed(0)}k</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Fluid volume loss increases red cell concentration and clotting cascade potential.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#fbbf24', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Virchow triad multi-signal convergence</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 3: [ENDOTHELIAL] TRM CLOT RISK SURGE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:22 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Thrombosis Risk Model (TRM)</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{selStats.trm.toFixed(2)} (High Risk: &gt; 1.50)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Algorithm correlates vascular stasis, viscosity, and endothelial shear stress.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#fbbf24', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Vascular ultrasound &amp; LBNP countermeasure</span>
                    </div>
                    <div style={{ background: '#120b0d', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 4: [OUTCOME] JUGULAR THROMBOSIS GATE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:30 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Point-of-Care Surveillance</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>Ultrasound &amp; LBNP Countermeasure</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Deploy LBNP therapy and perform compression Doppler ultrasound (THROMB-01).</div>
                    </div>
                  </div>
                ) : isCo2 ? (
                  /* ─── SCENARIO 1: CO2 SCRUBBER BREAKTHROUGH CAUSAL PIPELINE ─── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                    <div style={{ background: '#120b0d', border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>STAGE 1: [TRIGGER] ECLSS SCRUBBER SATURATION</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:06 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Ambient Cabin Carbon Dioxide</span>
                        <span style={{ color: '#f87171', fontFamily: T.mono }}>{co2Val.toFixed(2)} mmHg (Flight Rule: 3.00)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Amine regenerative bed A effluent sensor indicates breakthrough saturation.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#f87171', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Hypercapnic chemoreceptor stimulation</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 2: [PULMONARY] COMPENSATORY VENTILATION</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:14 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Respiration Rate Acceleration</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{selStats.resp} br/min (+{selStats.respDeltaPct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Compensatory hyperventilation to accelerate pulmonary CO₂ clearance.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#fbbf24', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Mild respiratory acidosis chronotropic reflex</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 3: [AUTONOMIC] TACHYCARDIC SURGE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:21 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Elevated Heart Rate</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{selStats.hr} bpm (Acidosis Response)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Sympathoadrenal response to maintain cerebral perfusion against rising pCO₂.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#f87171', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Bed B transition &amp; crew cognitive fatigue check</span>
                    </div>
                    <div style={{ background: '#120b0d', border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>STAGE 4: [OUTCOME] SCRUBBER TRANSITION REQUIRED</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:28 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Scrubber Bed Rotation</span>
                        <span style={{ color: '#f87171', fontFamily: T.mono }}>Command Bed B Transition</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Switch to Bed B and verify inter-module fan circulation (ECLSS-CO2-01).</div>
                    </div>
                  </div>
                ) : selStats.isAnomaly ? (
                  /* ─── GENERAL PHYSICAL EXERTION / CARDIOVASCULAR ANOMALY ─── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                    <div style={{ background: '#0a0e14', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>STAGE 1: [TRIGGER] PRIMARY STRESSOR</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:12 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Physical Exertion &amp; Workload</span>
                        <span style={{ color: '#38bdf8', fontFamily: T.mono }}>PSI {(selStats.workload * 7.5).toFixed(1)} / 10</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Metabolic ATP turnover initiates sympathetic demand envelope.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#38bdf8', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Drives autonomic rate acceleration</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 2: [RESPONSE] CARDIAC SURGE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:18 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Heart Rate Acceleration</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{selStats.hr} bpm ({selStats.hrDeltaPct >= 0 ? '+' : ''}{selStats.hrDeltaPct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Tachycardia envelope (+{(Math.abs(selStats.hrDeltaPct) / 10).toFixed(1)}σ deviation from {selCrew.baseHr} bpm base).</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#fbbf24', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Triggers compensatory minute ventilation</span>
                    </div>
                    <div style={{ background: '#0e0f14', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>STAGE 3: [COMPENSATION] VENTILATORY DRIVE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:24 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>Respiratory Hyperventilation</span>
                        <span style={{ color: '#fbbf24', fontFamily: T.mono }}>{selStats.resp} br/min ({selStats.respDeltaPct >= 0 ? '+' : ''}{selStats.respDeltaPct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>Compensatory hyperventilation to accelerate pulmonary CO₂ clearance.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-2px 0', color: '#f87171', fontSize: 9 }}>
                      ↓ <span style={{ fontSize: 7.5, color: '#64748b', marginLeft: 4 }}>Perfusion &amp; metabolic heat accumulation</span>
                    </div>
                    <div style={{ background: '#120b0d', border: `1px solid ${selStats.spo2 < 97 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.4)'}`, borderRadius: 4, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: selStats.spo2 < 97 ? '#f87171' : '#fbbf24', letterSpacing: '0.04em' }}>STAGE 4: [OUTCOME] PERFUSION &amp; THERMAL STATE</span>
                        <span style={{ fontSize: 8.5, fontFamily: T.mono, color: '#8fa9c4' }}>{simUtcTime.substring(0, 5)}:31 UTC</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                        <span>SpO₂ &amp; Thermal Elevation</span>
                        <span style={{ color: selStats.spo2 < 97 ? '#f87171' : '#fbbf24', fontFamily: T.mono }}>{selStats.spo2.toFixed(1)}% · {selStats.temp.toFixed(1)}°C</span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#8fa4ba', marginTop: 2 }}>{selStats.spo2 < 97 ? 'Peripheral arterial desaturation caution threshold crossed.' : 'Perfusion maintained under elevated core thermal strain.'}</div>
                    </div>
                  </div>
                ) : (
                  /* ─── NOMINAL CREW STATE (Crystal Clear Baseline Equilibrium) ─── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 4, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#4ade80', letterSpacing: '0.04em' }}>
                          ALL 5 BIOMETRIC CHANNELS IN NOMINAL EQUILIBRIUM
                        </span>
                      </div>
                      <div style={{ fontSize: 8.5, color: '#a0aec0', lineHeight: 1.35 }}>
                        Continuous cross-signal synthesis indicates healthy homeostasis for {selCrew.callsign}. No active standard deviation excursions detected.
                      </div>
                    </div>

                    {/* Channel Baseline Matrix */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '4px 8px' }}>
                        <span style={{ fontSize: 9, color: '#c5d5e5' }}>HEART RATE</span>
                        <span style={{ fontSize: 9, fontFamily: T.mono, color: '#ffffff' }}>{selStats.hr} bpm <span style={{ color: '#4ade80' }}>({selStats.hrDeltaPct >= 0 ? '+' : ''}{selStats.hrDeltaPct.toFixed(1)}%)</span></span>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4ade80' }}>NOMINAL [Z: {selStats.z_score_hr}σ]</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '4px 8px' }}>
                        <span style={{ fontSize: 9, color: '#c5d5e5' }}>SPO2 ARTERIAL SATURATION</span>
                        <span style={{ fontSize: 9, fontFamily: T.mono, color: '#ffffff' }}>{selStats.spo2.toFixed(1)}% <span style={{ color: '#4ade80' }}>(Optimal)</span></span>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4ade80' }}>OPTIMAL [Z: {selStats.z_score_spo2}σ]</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '4px 8px' }}>
                        <span style={{ fontSize: 9, color: '#c5d5e5' }}>RESPIRATION RATE</span>
                        <span style={{ fontSize: 9, fontFamily: T.mono, color: '#ffffff' }}>{selStats.resp} br/min <span style={{ color: '#4ade80' }}>(Eupneic)</span></span>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4ade80' }}>REST BAND [Z: {selStats.z_score_resp}σ]</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '4px 8px' }}>
                        <span style={{ fontSize: 9, color: '#c5d5e5' }}>CORE TEMPERATURE</span>
                        <span style={{ fontSize: 9, fontFamily: T.mono, color: '#ffffff' }}>{selStats.temp.toFixed(1)} °C</span>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4ade80' }}>HOMEOSTATIC [Z: {selStats.z_score_temp}σ]</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Possible Linked Factors with Weighted Correlation Bars (Dynamically Computed) */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ ...labelStyle, marginBottom: 5 }}>MULTI-SIGNAL CORRELATION WEIGHTS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {correlationFactors.map((f, i) => (
                      <div key={i} style={{ background: '#080c10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '5px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 9.5, fontWeight: 600, color: '#ffffff' }}>{f.title}</span>
                          <span style={{ fontSize: 9, fontFamily: T.mono, fontWeight: 700, color: f.color }}>{f.weight}% (r = {f.r})</span>
                        </div>
                        <div style={{ width: '100%', height: 3, background: '#17222d', borderRadius: 2, overflow: 'hidden', margin: '3px 0' }}>
                          <div style={{ width: `${f.weight}%`, height: '100%', background: f.color, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 8, color: '#8fa4ba' }}>{f.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ──── COLUMN 4: WHY IS THIS FLAGGED? & DECISION SUPPORT (DYNAMIC) ──── */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={labelStyle}>WHY IS THIS FLAGGED?</div>
                  <span style={{ fontSize: 8.5, color: '#9ec7ef', fontFamily: T.mono }}>NASA-STD-3001</span>
                </div>

                {/* Dynamically Evaluated Detection Rationale */}
                <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '7px 9px', marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9, color: '#c5d5e5', lineHeight: 1.35 }}>
                    {isHypo ? (
                      <>
                        <div>• <strong style={{ color: '#ff4d4d' }}>Hypokalemia Threshold:</strong> Serum K⁺ {selStats.potassium.toFixed(2)} mmol/L (Floor limit: 3.50 mmol/L) [CRITICAL DEPLETION]</div>
                        <div>• <strong style={{ color: '#fbbf24' }}>Cardiac Repolarization:</strong> Fridericia QTc {selStats.qtc.toFixed(0)} ms (Gate: 450 ms) [PROLONGED]</div>
                        <div>• <strong style={{ color: '#fbbf24' }}>Arrhythmogenic Index:</strong> ARF {selStats.arf.toFixed(2)} exceeds 1.0 safe boundary [ECTOPY RISK]</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Compensatory Tachycardia:</strong> HR {selStats.hr} bpm (+{selStats.hrDeltaPct.toFixed(1)}% vs baseline {selCrew.baseHr} bpm)</div>
                      </>
                    ) : isRad ? (
                      <>
                        <div>• <strong style={{ color: '#ff4d4d' }}>Solar Proton Surge:</strong> HERA Flux {selStats.radFlux.toFixed(1)} mGy/d exceeds 5.0 mGy/d threshold [STORM ACTIVE]</div>
                        <div>• <strong style={{ color: '#fbbf24' }}>Absorbed Mission Dose:</strong> {(selStats.radDose * 1000).toFixed(1)} mSv cumulative exposure</div>
                        <div>• <strong style={{ color: '#fbbf24' }}>DNA Susceptibility:</strong> RSI {selStats.rsi.toFixed(2)} indicates acute radiosensitivity hazard</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Flight Action Gate:</strong> Terminate EVA and transfer all 4 crew to water-wall storm shelter</div>
                      </>
                    ) : isThromb ? (
                      <>
                        <div>• <strong style={{ color: '#fbbf24' }}>Venous Hemodynamic Stasis:</strong> Internal jugular flow &lt; 4 cm/s retrograde stasis waveform</div>
                        <div>• <strong style={{ color: '#fbbf24' }}>Thrombosis Risk Model:</strong> TRM index {selStats.trm.toFixed(2)} (High-Risk Threshold: &gt; 1.50)</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Hemoconcentration:</strong> Hematocrit {selStats.hct.toFixed(1)}% · Platelets {selStats.plt.toFixed(0)} ×10³/µL</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Vascular Protocol:</strong> Compression Doppler ultrasound &amp; LBNP countermeasure armed</div>
                      </>
                    ) : isCo2 ? (
                      <>
                        <div>• <strong style={{ color: '#ff4d4d' }}>Cabin CO₂ Excursion:</strong> {co2Val.toFixed(2)} mmHg (NASA-STD-3001 Limit: 3.00 mmHg) [SATURATED]</div>
                        <div>• <strong style={{ color: '#fbbf24' }}>Ventilatory Drive:</strong> Respiration {selStats.resp} br/min (+{selStats.respDeltaPct.toFixed(1)}% above baseline {selCrew.baseResp})</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Acidosis Chronotropy:</strong> Heart rate {selStats.hr} bpm compensatory response</div>
                        <div>• <strong style={{ color: '#ffffff' }}>ECLSS Flight Rule:</strong> Automated valve rotation to secondary Scrubber Bed B mandatory</div>
                      </>
                    ) : selStats.isAnomaly ? (
                      <>
                        <div>• <strong style={{ color: '#ffffff' }}>HR Excursion:</strong> {selStats.hr} bpm ({selStats.hrDeltaPct >= 0 ? '+' : ''}{selStats.hrDeltaPct.toFixed(1)}% vs baseline {selCrew.baseHr} bpm) [EXCEEDS +20% ENVELOPE]</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Ventilatory Coupling:</strong> {selStats.resp} br/min ({selStats.respDeltaPct >= 0 ? '+' : ''}{selStats.respDeltaPct.toFixed(1)}% deviation above baseline {selCrew.baseResp})</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Perfusion Metric:</strong> SpO₂ {selStats.spo2.toFixed(1)}% ({selStats.spo2 < 97 ? 'Active desaturation warning' : 'Normal arterial saturation'})</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Statistical Anomaly:</strong> {(Math.abs(selStats.hrDeltaPct) / 10).toFixed(1)}σ standard deviation envelope (Threshold: 2.0σ)</div>
                      </>
                    ) : (
                      <>
                        <div>• <strong style={{ color: '#4ade80' }}>All Metrics Nominal:</strong> 0 flight rule limit violations across all channels</div>
                        <div>• <strong style={{ color: '#ffffff' }}>HR Baseline Stability:</strong> {selStats.hr} bpm conforms to personal OSDR resting envelope (Z: {selStats.z_score_hr}σ)</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Arterial Oxygenation:</strong> SpO₂ {selStats.spo2.toFixed(1)}% exceeds 98.0% minimum optimal floor</div>
                        <div>• <strong style={{ color: '#ffffff' }}>Autonomic Stability:</strong> HRV RMSSD {selStats.hrv} ms indicates balanced parasympathetic tone</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Circular Confidence Gauge (Dynamically Evaluated) */}
                <div style={{ marginTop: 8, padding: '6px 0', borderTop: `1px solid ${T.borderSubtle}`, borderBottom: `1px solid ${T.borderSubtle}` }}>
                  <CircularGauge
                    pct={selStats.isAnomaly ? 95 : 99}
                    label="Bayesian Multi-Signal Confidence"
                    color={selStats.isAnomaly ? (isHypo || isRad || co2Val > 3.0 ? '#ff4d4d' : '#fbbf24') : '#22c55e'}
                    size={72}
                  />
                </div>

                {/* Decision Support & Protocol Box */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>DECISION SUPPORT ENGINE</div>
                  <div style={{ fontSize: 9.5, color: '#c5d5e5', lineHeight: 1.4 }}>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Condition: </strong>
                      {isHypo ? 'Acute Hypokalemia & Tachyarrhythmia Risk' :
                       isRad ? 'Solar Particle Event Radiation Surge' :
                       isThromb ? 'Internal Jugular Venous Stasis Threat' :
                       isCo2 ? 'ECLSS Scrubber Bed Saturation' :
                       selStats.isAnomaly ? 'Cardiovascular Exertion Excursion' :
                       'Nominal Baseline Equilibrium'}
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Trajectory: </strong>
                      {selStats.isAnomaly ? 'Worsening ↗ (Active Excursion)' : 'Stable → (In Homeostasis)'}
                    </div>
                    <div>
                      <strong style={{ color: '#ffffff' }}>Time to Threshold: </strong>
                      {isHypo ? '6 min to Ectopic Gate' :
                       isRad ? '15 min to Storm Shelter Gate' :
                       isThromb ? '4h Ultrasound Surveillance Gate' :
                       isCo2 ? 'Exceeded by +' + (co2Val - 3.0).toFixed(2) + ' mmHg' :
                       selStats.isAnomaly ? '11 min to Caution Limit' :
                       'Nominal Corridor (>24 hr)'}
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#9ec7ef', textTransform: 'uppercase', marginBottom: 3 }}>
                      SUGGESTED CLINICAL CHECKS
                    </div>
                    <div style={{ fontSize: 9, color: '#8fa9c4', lineHeight: 1.35 }}>
                      {isHypo ? (
                        <>
                          1. Direct Medical Officer (Dr. Sian) to administer oral KCl pack (20 mEq)<br />
                          2. Lock 12-lead ECG telemetry and inspect ST segment / U-wave<br />
                          3. Increase oral electrolyte hydration fluid intake minimum 500 mL<br />
                          4. Maintain 10-minute continuous telemetry observation gate
                        </>
                      ) : isRad ? (
                        <>
                          1. Direct all 4 crew members to transfer into water-wall storm shelter<br />
                          2. Deploy polyethylene radiation shielding blankets over crew berths<br />
                          3. Suspend all scheduled EVA and exterior robotic arm operations<br />
                          4. Monitor serial leukocyte assay and calculate Radiation Sickness Index
                        </>
                      ) : isThromb ? (
                        <>
                          1. Direct Medical Officer (Dr. Sian) to perform vascular compression ultrasound<br />
                          2. Administer 500 mL oral rehydration electrolyte solution<br />
                          3. Prepare subcutaneous low-molecular-weight heparin (Enoxaparin 40 mg)<br />
                          4. Verify lower body negative pressure (LBNP) device readiness
                        </>
                      ) : isCo2 ? (
                        <>
                          1. Command automated valve transition to secondary scrubber bed (Bed B)<br />
                          2. Increase habitat inter-module ventilation fan speed to High (0.8 m/s)<br />
                          3. Direct crew to report headache or mild cognitive fatigue symptoms<br />
                          4. Confirm backup LiOH canister seals intact for contingency installation
                        </>
                      ) : selStats.isAnomaly ? (
                        <>
                          1. Direct crew member to reduce physical workload by 50%<br />
                          2. Increase suit/cabin airflow cooling ventilation by +15%<br />
                          3. Verify oral electrolyte hydration packet intake<br />
                          4. Request 12-lead ECG rhythm pass on next DSN contact
                        </>
                      ) : (
                        <>
                          1. Maintain scheduled mission duty cycle and rest intervals<br />
                          2. Scheduled biosensor impedance calibration in 4.2 hr<br />
                          3. Routine hydration packet log verification on watch handover<br />
                          4. Standard circadian lighting shift scheduled for 22:00 UTC
                        </>
                      )}
                    </div>
                  </div>

                  {/* Flight Procedure Action Button */}
                  <button
                    onClick={() => setActiveProcedureId(targetProcedureId)}
                    style={{
                      marginTop: 9,
                      width: '100%',
                      background: '#151b22',
                      border: `1px solid ${T.activeBorder}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    OPEN PROCEDURE: {targetProcedureId.replace('NASA-STD-3001-', '')} →
                  </button>

                  {onOpenTriage && (
                    <button
                      onClick={() => onOpenTriage(selCrew.id)}
                      style={{
                        marginTop: 5,
                        width: '100%',
                        background: '#101419',
                        border: `1px solid ${T.borderSubtle}`,
                        borderRadius: 4,
                        padding: '6px 10px',
                        color: '#9ec7ef',
                        fontSize: 9,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      OPEN CLINICAL TELEMETRY CONSOLE →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ──── 5. BOTTOM SECTION: Mission Timeline (Left) + Recent Events Log (Right) ──── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, alignItems: 'stretch' }}>

              {/* Mission Timeline Horizontal Bar */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={labelStyle}>Mission Timeline (24-Hour Cycle)</div>
                  <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>MET T+14d 08:42:19 · Shift 2 / Watch B</span>
                </div>

                {/* Segmented Timeline Bar */}
                <div style={{ position: 'relative', marginTop: 14, marginBottom: 14 }}>
                  {/* The bar track */}
                  <div style={{
                    display: 'flex',
                    height: 28,
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid #232b34',
                    background: '#0a0d10',
                  }}>
                    {/* Phase 1: EVA (10:00 - 12:30, 2.5h) */}
                    <div style={{ flex: 2.5, background: '#13283b', borderRight: '1px solid #1e3a54', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6fa5d2', fontSize: 9, fontWeight: 700 }}>
                      EVA 10:00–12:30
                    </div>
                    {/* Phase 2: Exercise (13:00 - 14:00, 1.0h) */}
                    <div style={{ flex: 1.5, background: '#2c2210', borderRight: '1px solid #4a3617', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d9a74a', fontSize: 9, fontWeight: 700 }}>
                      Exercise 13:00
                    </div>
                    {/* Phase 3: Transit (14:00 - 18:00, 4.0h) */}
                    <div style={{ flex: 4.0, background: '#172218', borderRight: '1px solid #283a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78ab7c', fontSize: 9, fontWeight: 700 }}>
                      Transit 14:00–18:00
                    </div>
                    {/* Phase 4: Sleep (18:00 - 06:00, 12.0h) */}
                    <div style={{ flex: 12.0, background: '#0c1015', borderRight: '1px solid #18202a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8ca6c2', fontSize: 9, fontWeight: 700 }}>
                      Sleep Block (Circadian Dark) 18:00–06:00
                    </div>
                    {/* Phase 5: Transit (06:00 - 10:00, 4.0h) */}
                    <div style={{ flex: 4.0, background: '#172218', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78ab7c', fontSize: 9, fontWeight: 700 }}>
                      Transit
                    </div>
                  </div>

                  {/* Anomaly Pin Marker Dynamically Linked */}
                  {selStats.isAnomaly && (
                    <div style={{
                      position: 'absolute',
                      left: '21.5%',
                      top: -12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 8, fontFamily: T.mono, color: T.critical, background: '#140808', border: `1px solid ${T.criticalBorder}`, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                        [ANOMALY] {simUtcTime.substring(0, 5)} ({selCrew.callsign})
                      </span>
                      <span style={{ width: 1.5, height: 32, background: T.critical, marginTop: 1 }} />
                    </div>
                  )}

                  {/* Current Time Needle at 14:35 */}
                  <div style={{
                    position: 'absolute',
                    left: '22.8%',
                    top: 29,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    <span style={{ width: 1.5, height: 10, background: '#ffffff' }} />
                    <span style={{ fontSize: 8, fontFamily: T.mono, color: '#ffffff', background: '#1e252e', border: '1px solid #3c4c5c', padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap', marginTop: 1 }}>
                      ▲ NOW {simUtcTime.substring(0, 5)}
                    </span>
                  </div>
                </div>

                {/* Timeline Legend */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, color: T.textMuted, marginTop: 14, paddingTop: 6, borderTop: `1px solid ${T.borderSubtle}` }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#13283b', border: '1px solid #1e3a54', display: 'inline-block' }} /> EVA</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#2c2210', border: '1px solid #4a3617', display: 'inline-block' }} /> Exercise</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#172218', border: '1px solid #283a2a', display: 'inline-block' }} /> Transit</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#0c1015', border: '1px solid #18202a', display: 'inline-block' }} /> Sleep</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ color: '#ffffff' }}>▲ Current MET</span>
                    <span style={{ color: T.critical }}>▲ ANOMALY PIN</span>
                  </div>
                </div>
              </div>

              {/* Recent Events Log Table — Live Backend SQLite & WebSocket Stream */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={labelStyle}>Recent Events Log</div>
                    <span style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: '#4ade80',
                      background: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.35)',
                      padding: '1px 6px',
                      borderRadius: 3,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 5px #22c55e' }} />
                      LIVE DB FEED (/api/alerts)
                    </span>
                  </div>
                  <span style={{ fontSize: 9, color: '#8fa9c4', fontFamily: T.mono }}>
                    {backendAlerts.length} DB ALERTS LOGGED
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr 55px 70px', gap: 6, padding: '5px 0', borderBottom: '1px solid #233140', fontSize: 9, color: '#9ec7ef', fontWeight: 700 }}>
                  <span>UTC TIME</span>
                  <span>EVENT DESCRIPTION</span>
                  <span>SOURCE</span>
                  <span style={{ textAlign: 'right' }}>SEVERITY</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {(backendAlerts.length > 0 ? backendAlerts.slice(0, 8).map((al: any) => ({
                    id: al.id,
                    time: al.timestamp ? (al.timestamp.includes('T') ? al.timestamp.substring(11, 19) : (al.timestamp.split(' ')[1] || al.timestamp).substring(0, 8)) : simUtcTime.substring(0, 8),
                    event: al.trigger_reason || al.voice_spoken_text || 'Automated AI Sentry Threshold Excursion',
                    sys: al.astronaut_id === 'ALL_CREW' ? 'ECLSS' : (CREW.find(c => c.id === al.astronaut_id)?.callsign || al.astronaut_id?.substring(0, 6) || 'Bio'),
                    prio: al.severity || 'WARNING',
                    targetAstId: al.astronaut_id,
                  })) : [
                    { id: 1, time: simUtcTime.substring(0, 8), event: 'Live Telemetry Bus Synced (10 Hz)', sys: 'Bus', prio: 'NOMINAL', targetAstId: 'AST-01_COMMANDER' },
                    { id: 2, time: simUtcTime.substring(0, 8), event: '4 Crew Biosensors Online', sys: 'Bio', prio: 'NOMINAL', targetAstId: 'AST-02_PILOT' },
                    { id: 3, time: simUtcTime.substring(0, 8), event: 'ECLSS Cabin Pressure 101.3 kPa', sys: 'ECLSS', prio: 'NOMINAL', targetAstId: 'ALL_CREW' },
                    { id: 4, time: simUtcTime.substring(0, 8), event: 'Radiation Flux 1.24 mGy/d Nominal', sys: 'Rad', prio: 'NOMINAL', targetAstId: 'ALL_CREW' },
                  ]).map((row, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (row.targetAstId && row.targetAstId !== 'ALL_CREW') {
                          setSelCrewId(row.targetAstId);
                        }
                      }}
                      title="Click to focus astronaut in dashboard"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '65px 1fr 55px 70px',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 4px',
                        borderBottom: `1px solid #141c24`,
                        fontSize: 9,
                        cursor: row.targetAstId && row.targetAstId !== 'ALL_CREW' ? 'pointer' : 'default',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <span style={{ fontFamily: T.mono, color: '#9bb1c7' }}>{row.time}</span>
                      <span style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {row.event}
                      </span>
                      <span style={{ color: '#9ec7ef', fontWeight: 600 }}>{row.sys}</span>
                      <div style={{ textAlign: 'right' }}>
                        <Badge color={severityColor(row.prio)} borderColor={severityBorder(row.prio)} bg="#090c0f">
                          {row.prio}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4b. Trends Sub-Tab (Expanded Multi-Signal Analysis) ─── */}
        {crewSubTab === 'Trends' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={labelStyle}>Full Multi-Signal Trend Analysis — {selCrew.crewNo} {selCrew.name}</div>
                <span style={{ fontSize: 9, color: T.textMuted }}>Continuous 10 Hz Telemetry Window · {timeRange}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <TrendLineChart title="Heart Rate (bpm)" currentVal={`${selStats.hr}`} baselineVal={selCrew.baseHr} unit="bpm" data={hrTrendData} minY={60} maxY={120} lineColor={selStats.hrDeltaPct > 20 ? T.warning : T.nominal} yTicks={[70, 90, 110]} showTimeTicks={true} />
                <TrendLineChart title="SpO₂ (%)" currentVal={`${selStats.spo2.toFixed(1)}`} baselineVal={selCrew.baseSpo2} unit="%" data={spo2TrendData} minY={94} maxY={100} lineColor={selStats.spo2 < 97 ? T.warning : '#4682b4'} yTicks={[95, 97, 99]} showTimeTicks={true} />
                <TrendLineChart title="Respiration Rate (br/min)" currentVal={`${selStats.resp}`} baselineVal={selCrew.baseResp} unit="br/min" data={respTrendData} minY={10} maxY={22} lineColor={selStats.respDeltaPct > 20 ? T.warning : T.nominal} yTicks={[12, 16, 20]} showTimeTicks={true} />
                <TrendLineChart title="Core Temp (°C)" currentVal={`${selStats.temp.toFixed(1)}`} baselineVal={selCrew.baseTemp} unit="°C" data={tempTrendData} minY={36.0} maxY={37.6} lineColor={selStats.tempDeltaAbs > 0.5 ? T.warning : '#e08a3c'} yTicks={[36.2, 36.8, 37.4]} showTimeTicks={true} />
              </div>
            </div>
          </div>
        )}

        {/* ─── 4c. Correlation Sub-Tab (Cross-Signal Pearson Correlation Matrix) ─── */}
        {crewSubTab === 'Correlation' && (() => {
          const corrPairs = isHypo ? [
            { pair: 'K⁺ vs QTc Interval', r: '-0.94', desc: 'Critical delay: I_Kr channel prolonged action potential', sig: 'CRITICAL' },
            { pair: 'QTc vs ARF Index', r: '+0.88', desc: 'Arrhythmogenic substrate flutter coupling', sig: 'HIGH' },
            { pair: 'HR vs QTc Fridericia', r: '+0.78', desc: 'Compensatory chronotropic rate surge', sig: 'HIGH' },
            { pair: 'HRV vs Serum K⁺', r: '+0.72', desc: 'Autonomic decay tracking electrolyte depletion', sig: 'HIGH' },
            { pair: 'Resp vs Workload', r: '+0.65', desc: 'Eupneic ventilatory response', sig: 'MODERATE' },
            { pair: 'SpO₂ vs Perfusion', r: '+0.82', desc: 'Stable peripheral microvascular perfusion', sig: 'HIGH' },
          ] : isRad ? [
            { pair: 'Proton Flux vs CAD Silicon', r: '+0.96', desc: 'HERA and CAD coincident sensor lock', sig: 'CRITICAL' },
            { pair: 'Absorbed Dose vs RSI', r: '+0.89', desc: 'Accumulated dose scaling radiosensitivity', sig: 'HIGH' },
            { pair: 'Total WBC vs Radiation', r: '-0.76', desc: 'Radiation-induced leukopenia progression', sig: 'HIGH' },
            { pair: 'Lymphocytes vs Dose', r: '-0.84', desc: 'Rapid peripheral lymphocyte depletion', sig: 'HIGH' },
            { pair: 'HR vs Stress Tone', r: '+0.68', desc: 'Sympathetic arousal from storm alert', sig: 'MODERATE' },
            { pair: 'Core Temp vs Flux', r: '+0.42', desc: 'Thermal loop convective background', sig: 'LOW' },
          ] : isThromb ? [
            { pair: 'Jugular Flow vs TRM', r: '+0.92', desc: 'Venous stagnation directly driving clot index', sig: 'HIGH' },
            { pair: 'Hematocrit vs TRM', r: '+0.85', desc: 'Hemoconcentration elevating blood viscosity', sig: 'HIGH' },
            { pair: 'Platelets vs Viscosity', r: '+0.78', desc: 'Thrombocytosis enhancing aggregation potential', sig: 'HIGH' },
            { pair: 'HR vs Fluid Shift', r: '+0.64', desc: 'Cephalic baroreceptor resetting', sig: 'MODERATE' },
            { pair: 'SpO₂ vs Flow Velocity', r: '-0.48', desc: 'Microcirculatory retrograde resistance', sig: 'MODERATE' },
            { pair: 'BP vs Venous Return', r: '+0.71', desc: 'Jugular venous engorgement pressure', sig: 'HIGH' },
          ] : isCo2 ? [
            { pair: 'Cabin CO₂ vs Resp Rate', r: '+0.90', desc: 'Hypercapnic chemoreceptor ventilatory surge', sig: 'HIGH' },
            { pair: 'Cabin CO₂ vs Heart Rate', r: '+0.74', desc: 'Sympathoadrenal chronotropic coupling', sig: 'HIGH' },
            { pair: 'Resp vs Workload', r: '+0.82', desc: 'Minute ventilation tracks metabolic CO₂', sig: 'HIGH' },
            { pair: 'HR vs HRV (RMSSD)', r: '-0.79', desc: 'Autonomic decay from respiratory acidosis', sig: 'HIGH' },
            { pair: 'SpO₂ vs Cabin CO₂', r: '-0.58', desc: 'Alveolar gas equation displacement gradient', sig: 'MODERATE' },
            { pair: 'Core Temp vs ATCS', r: '+0.62', desc: 'Cabin ventilation convective heat balance', sig: 'MODERATE' },
          ] : [
            { pair: 'HR vs Workload', r: '+0.88', desc: 'Positive correlation — physical exertion driven', sig: 'HIGH' },
            { pair: 'HR vs HRV (RMSSD)', r: '-0.79', desc: 'Sympathetic dominance / autonomic decay', sig: 'HIGH' },
            { pair: 'HR vs SpO₂', r: '-0.64', desc: 'Inverse coupling — desaturation on exertion', sig: 'MODERATE' },
            { pair: 'Resp vs Workload', r: '+0.82', desc: 'Hyperventilation tracking metabolic demand', sig: 'HIGH' },
            { pair: 'Core Temp vs HR', r: '+0.71', desc: 'Thermal strain coupling (Moran PSI 5.8)', sig: 'HIGH' },
            { pair: 'Cabin CO₂ vs Resp', r: '+0.44', desc: 'Mild hypercapnic compensatory drive', sig: 'LOW' },
          ];

          return (
            <div style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Cross-Signal Correlation Matrix (Pearson r)</div>
              <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 10 }}>
                Calculated across 720 temporal points (2-hour rolling window). Strong correlation (|r| &gt; 0.70) indicates coupled physiological strain.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {corrPairs.map((c, i) => (
                <div key={i} style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{c.pair}</span>
                    <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: c.r.startsWith('+') ? T.warning : '#4682b4' }}>{c.r}</span>
                  </div>
                  <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 4 }}>{c.desc}</div>
                </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ─── 4d. Baseline & Deviation Sub-Tab (Dynamic Z-Scores) ─── */}
        {crewSubTab === 'Baseline & Deviation' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Statistical Variance &amp; Baseline Deviation Envelope</div>
            <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 10 }}>
              Comparison against Inspiration4 OSDR (OSD-575/569) cohort baseline distributions for {selCrew.name} ({selCrew.callsign}).
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>Heart Rate Deviation Distribution</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • Resting Mean (μ): {selCrew.baseHr} bpm · Standard Deviation (σ): 4.8 bpm<br />
                  • Current Value: {selStats.hr} bpm<br />
                  • Z-Score: <strong style={{ color: Math.abs(selStats.z_score_hr) > 2 ? T.warning : T.nominal }}>{selStats.z_score_hr}σ</strong> ({Math.abs(selStats.z_score_hr) > 2 ? 'EXCURSION BEYOND 2σ' : 'NOMINAL WITHIN 1σ'})<br />
                  • Cumulative Time Above 2σ: {selStats.isAnomaly ? '18 minutes' : '0 minutes'}
                </div>
              </div>

              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>SpO₂ Peripheral Envelope</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • Resting Mean (μ): {selCrew.baseSpo2.toFixed(1)}% · Standard Deviation (σ): 0.6%<br />
                  • Current Value: {selStats.spo2.toFixed(1)}%<br />
                  • Z-Score: <strong style={{ color: selStats.spo2 < 97 ? T.warning : T.nominal }}>{selStats.z_score_spo2}σ</strong><br />
                  • Lower Flight Rule Floor: 95.0% (Current margin: +{(selStats.spo2 - 95.0).toFixed(1)}%)
                </div>
              </div>

              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>Respiration Rate Variance</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • Resting Mean (μ): {selCrew.baseResp} br/min · Standard Deviation (σ): 1.5 br/min<br />
                  • Current Value: {selStats.resp} br/min<br />
                  • Z-Score: <strong style={{ color: Math.abs(selStats.z_score_resp) > 2 ? T.warning : T.nominal }}>{selStats.z_score_resp}σ</strong><br />
                  • Eupneic Resting Corridor: 12 - 18 br/min
                </div>
              </div>

              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>Core Temperature Stability</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • Resting Mean (μ): {selCrew.baseTemp.toFixed(1)} °C · Standard Deviation (σ): 0.25 °C<br />
                  • Current Value: {selStats.temp.toFixed(1)} °C<br />
                  • Z-Score: <strong style={{ color: Math.abs(selStats.z_score_temp) > 2 ? T.warning : T.nominal }}>{selStats.z_score_temp}σ</strong><br />
                  • Thermal Flight Rule Ceiling: 38.0 °C (Margin: +{(38.0 - selStats.temp).toFixed(1)} °C)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4e. Medical History Sub-Tab (Authentic Inspiration4 OSDR Profiles) ─── */}
        {crewSubTab === 'Medical History' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Astronaut Medical Dossier &amp; NASA OSDR OSD-575/569 Baseline Profile</div>
            <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 10 }}>
              Authentic NASA Open Science Data Repository (OSDR) laboratory biomarkers and clinical flight dossier for {selCrew.name} ({selCrew.callsign}).
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
              {/* Box 1: Complete Blood Count (CBC) */}
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Complete Blood Count (CBC OSD-569)</div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 4, lineHeight: 1.6 }}>
                  • Total WBC: <strong style={{ color: '#ffffff' }}>{selStats.osdr.wbc.toFixed(1)} ×10³/µL</strong> (Normal 4.5 - 11.0)<br />
                  • Hematocrit (Hct): <strong style={{ color: '#ffffff' }}>{selStats.osdr.hct.toFixed(1)}%</strong> (Baseline)<br />
                  • Platelet Count (PLT): <strong style={{ color: '#ffffff' }}>{selStats.osdr.plt.toFixed(0)} ×10³/µL</strong><br />
                  • Hemoglobin (Hgb): <strong style={{ color: '#ffffff' }}>{selStats.osdr.hgb.toFixed(1)} g/dL</strong><br />
                  • Total RBC: <strong style={{ color: '#ffffff' }}>{selStats.osdr.rbc.toFixed(2)} M/µL</strong>
                </div>
              </div>

              {/* Box 2: Comprehensive Metabolic Panel (CMP) */}
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Metabolic &amp; Electrolytes (OSD-575)</div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 4, lineHeight: 1.6 }}>
                  • Serum Sodium (Na⁺): <strong style={{ color: '#ffffff' }}>{selStats.osdr.na.toFixed(0)} mmol/L</strong><br />
                  • Serum Potassium (K⁺): <strong style={{ color: '#ffffff' }}>{selStats.osdr.k.toFixed(2)} mmol/L</strong><br />
                  • Fasting Glucose: <strong style={{ color: '#ffffff' }}>{selStats.osdr.glu.toFixed(0)} mg/dL</strong><br />
                  • Blood Urea Nitrogen (BUN): <strong style={{ color: '#ffffff' }}>{selStats.osdr.bun.toFixed(1)} mg/dL</strong><br />
                  • Serum Creatinine (Cr): <strong style={{ color: '#ffffff' }}>{selStats.osdr.cr.toFixed(2)} mg/dL</strong>
                </div>
              </div>

              {/* Box 3: Cytokines & Flight Certification */}
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Cytokines &amp; Flight Certification</div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 4, lineHeight: 1.6 }}>
                  • Interleukin-6 (IL-6): <strong style={{ color: '#ffffff' }}>{selStats.osdr.il6.toFixed(2)} pg/mL</strong><br />
                  • C-Reactive Protein (CRP): <strong style={{ color: '#ffffff' }}>{selStats.osdr.crp.toFixed(2)} mg/L</strong><br />
                  • Resting Blood Pressure: <strong style={{ color: '#ffffff' }}>{selCrew.baseBp} mmHg</strong><br />
                  • Centrifuge G-Tolerance: <strong style={{ color: '#ffffff' }}>+8.5 Gz without GLOC</strong><br />
                  • Countermeasure Compliance: <strong style={{ color: '#5ebd4c' }}>100% (ARED / CEVIS)</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4f. Procedures Sub-Tab (Interactive Flight Checklists) ─── */}
        {crewSubTab === 'Procedures' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={labelStyle}>Flight Operational Procedures &amp; Countermeasure Cards</div>
              <span style={{ fontSize: 9, color: T.textMuted }}>NASA-STD-3001 Flight Operations</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(PROCEDURES).map(proc => (
                <div key={proc.id} style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 5, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge color={T.info} borderColor="#2a3a4a">{proc.id}</Badge>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>{proc.title}</span>
                    </div>
                    <div style={{ fontSize: 9, color: T.textMuted, marginTop: 3 }}>Category: {proc.category} · {proc.steps.length} sequential verification steps</div>
                  </div>
                  <button
                    onClick={() => setActiveProcedureId(proc.id)}
                    style={{
                      background: '#151b22',
                      border: `1px solid ${T.border}`,
                      borderRadius: 4,
                      padding: '5px 12px',
                      color: T.textSecondary,
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open Checklist →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── 4g. 3D Holographic Body Scanner Sub-Tab ─── */}
        {crewSubTab === '3D Bio-Scanner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <HolographicBodyScanner
              astronautId={selCrew.id}
              astronautName={selCrew.name}
              astronautRole={selCrew.role}
              crewNo={selCrew.crewNo}
              telemetry={telemetryMap[selCrew.id]}
              themeMode="CYAN"
              onSelectSubsystem={(sub) => {
                if (sub === 'CARDIAC') setActiveProcedureId('M-204');
              }}
            />
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // SYSTEMS TAB — SPACECRAFT HEALTH-CRITICAL SYSTEMS & DEVICE CATALOG (LIVE BOUND)
  // ─────────────────────────────────────────────────────────────
  const renderSystems = () => {
    const pkt = telemetryMap[selCrewId] || Object.values(telemetryMap)[0];
    const anyPkt = Object.values(telemetryMap)[0];
    const co2 = pkt?.cabin_co2 || anyPkt?.cabin_co2 || 1.82;
    const hrVal = pkt?.heart_rate ? Math.round(pkt.heart_rate) : 78;
    const spo2Val = pkt?.spo2 || 98.0;
    const tempVal = pkt?.core_temp || 36.6;
    const hrvVal = pkt?.hrv_rmssd ? Math.round(pkt.hrv_rmssd) : 65;
    const qtcVal = pkt?.computed_qtc || (pkt?.heart_rate ? Math.round(390 * Math.pow(60 / pkt.heart_rate, 0.33)) : 402);
    const kVal = pkt?.potassium !== undefined ? pkt.potassium : 4.40;
    const wbcVal = pkt?.wbc_count !== undefined ? pkt.wbc_count : 5.5;
    const hctVal = pkt?.hematocrit !== undefined ? pkt.hematocrit : 43.6;
    const pltVal = pkt?.platelet_count !== undefined ? pkt.platelet_count : 242;
    const il6Val = pkt?.il_6 !== undefined ? pkt.il_6 : 2.1;
    const crpVal = pkt?.crp !== undefined ? pkt.crp : 1.06;
    const radFluxVal = pkt?.radiation_flux !== undefined ? pkt.radiation_flux : 0.04;
    const radDoseVal = pkt?.radiation_dose_gy !== undefined ? pkt.radiation_dose_gy : 0.05;
    const isCo2Excursion = co2 > 3.0;
    const co2Margin = 3.0 - co2;

    interface SystemMetricItem {
      param: string;
      value: string;
      unit: string;
      limit: string;
      margin: string;
      trend: string;
      warning?: boolean;
    }

    interface SpacecraftSystemItem {
      id: string;
      name: string;
      acronym: string;
      category: 'ECLSS' | 'WEARABLE' | 'LAB' | 'RADIATION' | 'COUNTERMEASURE';
      categoryLabel: string;
      compartment: string;
      hwRef: string;
      measures: string;
      mode: 'CONTINUOUS' | 'PERIODIC' | 'ON DEMAND';
      workingStatus: 'WORKING' | 'WARNING' | 'STANDBY';
      status: 'NOMINAL' | 'MONITOR' | 'CALIBRATED' | 'STREAMING' | 'ARMED';
      telemetryMode: string;
      lastSync: string;
      metrics: SystemMetricItem[];
    }

    // 16 Installed Spacecraft Health Devices with Clear Specific Names, Measures & Operational Modes (LIVE BOUND)
    const spacecraftSystems: SpacecraftSystemItem[] = [
      {
        id: 'SYS-ECLSS-01',
        name: 'Atmospheric Pressure & Gas Assembly (PCA)',
        acronym: 'ECLSS-PCA',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Service Module · Rack-01',
        hwRef: 'NASA-PCA-BL-401',
        measures: 'Cabin Total Pressure, Oxygen (ppO₂), Nitrogen (ppN₂), Hull Leak Rate',
        mode: 'CONTINUOUS',
        workingStatus: 'WORKING',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.2s ago',
        metrics: [
          { param: 'Cabin Total Pressure', value: '101.3', unit: 'kPa', limit: '99 - 103 kPa', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Oxygen (ppO₂)', value: '20.9', unit: '%', limit: '19.5 - 23.0 %', margin: 'Safe', trend: 'STABLE' },
          { param: 'Nitrogen (ppN₂)', value: '79.2', unit: 'kPa', limit: '77 - 81 kPa', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Depress. Rate', value: '0.00', unit: 'kPa/min', limit: '< 0.10', margin: 'Airtight', trend: 'SEALED' },
        ],
      },
      {
        id: 'SYS-ECLSS-02',
        name: 'Regenerative CO₂ Scrubber Bed (CDRA)',
        acronym: 'ECLSS-RCRS',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Hab Core · Rack-02',
        hwRef: 'RCRS-AMINE-MK2',
        measures: 'Cabin Carbon Dioxide (pCO₂), Scrubber Bed Cycle, Airflow Velocity',
        mode: 'CONTINUOUS',
        workingStatus: isCo2Excursion ? 'WARNING' : 'WORKING',
        status: isCo2Excursion ? 'MONITOR' : 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.2s ago',
        metrics: [
          { param: 'Cabin pCO₂', value: co2.toFixed(2), unit: 'mmHg', limit: '< 3.00 mmHg', margin: `${co2Margin > 0 ? '+' : ''}${co2Margin.toFixed(2)}`, trend: co2 > 2.2 ? 'ELEVATED' : 'STABLE', warning: isCo2Excursion },
          { param: 'Scrubber Cycle', value: isCo2Excursion ? 'Bed B Armed' : 'Bed A Active', unit: '', limit: '≤ 60 min', margin: isCo2Excursion ? 'Breakthrough' : 'Regen OK', trend: isCo2Excursion ? 'CAUTION' : 'NOMINAL' },
          { param: 'Airflow Velocity', value: isCo2Excursion ? '0.62' : '0.45', unit: 'm/s', limit: '0.3 - 0.6 m/s', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Desorption Heater', value: '121.4', unit: '°C', limit: '115 - 130 °C', margin: 'Regen OK', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-ECLSS-03',
        name: 'Active Thermal Control System (ATCS)',
        acronym: 'ATCS-CLIMATE',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Thermal Bay · Radiator Trunnion',
        hwRef: 'ATCS-DUAL-PUMP-V4',
        measures: 'Cabin Air Temperature, Relative Humidity, Coolant Loops',
        mode: 'CONTINUOUS',
        workingStatus: 'WORKING',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.3s ago',
        metrics: [
          { param: 'Cabin Temperature', value: '21.4', unit: '°C', limit: '18 - 24 °C', margin: 'Comfort', trend: 'STABLE' },
          { param: 'Relative Humidity', value: '48', unit: '%', limit: '30 - 65 %', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Internal Water Loop', value: '19.8', unit: '°C', limit: '18 - 22 °C', margin: 'Nominal', trend: 'STABLE' },
          { param: 'External Freon Loop', value: '-4.2', unit: '°C', limit: '-10 - +5 °C', margin: 'Nominal', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-ECLSS-04',
        name: 'Water Reclamation & Processing System (WPA)',
        acronym: 'WPA-RECYCLE',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Hab Bay 2 · Environmental Rack',
        hwRef: 'WPA-CAT-REACTOR-9',
        measures: 'Potable Water Reserve, Water Purity, Total Organic Carbon, Biocide',
        mode: 'CONTINUOUS',
        workingStatus: 'WORKING',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.5s ago',
        metrics: [
          { param: 'Potable Reserve', value: '284', unit: 'L', limit: '> 100 L', margin: '71d Buffer', trend: 'STABLE' },
          { param: 'Recovery Rate', value: '98.2', unit: '%', limit: '> 95.0 %', margin: 'Closed Loop', trend: 'STABLE' },
          { param: 'Water Purity (TOC)', value: '0.08', unit: 'mg/L', limit: '< 0.50', margin: 'Sterile', trend: 'STABLE' },
          { param: 'Iodine Biocide', value: '2.1', unit: 'mg/L', limit: '1.5 - 3.5', margin: 'Protected', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-ECLSS-05',
        name: 'Emergency Medical Oxygen Delivery (EODS)',
        acronym: 'EODS-RESUSCITATE',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Crew Medical Quarters · Station A',
        hwRef: 'NASA-EODS-V2',
        measures: '100% O₂ Mask Delivery Pressure, Cylinder Reserve, Airway Suction',
        mode: 'ON DEMAND',
        workingStatus: 'WORKING',
        status: 'NOMINAL',
        telemetryMode: 'ON-DEMAND',
        lastSync: '1.0s ago',
        metrics: [
          { param: 'Manifold Pressure', value: '50.2', unit: 'psi', limit: '45 - 55 psi', margin: 'Charged', trend: 'STABLE' },
          { param: 'Emergency Tank', value: '100', unit: '%', limit: '> 90 %', margin: 'Full', trend: 'STABLE' },
          { param: 'Suction Vacuum', value: '-120', unit: 'mmHg', limit: '-100 to -150', margin: 'Ready', trend: 'STABLE' },
          { param: 'Mask Seal Check', value: 'PASSED', unit: '', limit: 'P > 40 psi', margin: 'Operational', trend: 'NOMINAL' },
        ],
      },
      {
        id: 'SYS-BIO-01',
        name: 'AstroSkin Wearable Bio-Monitor Garment',
        acronym: 'ASTROSKIN-01',
        category: 'WEARABLE',
        categoryLabel: 'Wearables & Telemetry',
        compartment: 'Crew Worn · Flight Garments',
        hwRef: 'CARRÉ-ASTROSKIN-MK3',
        measures: 'Continuous 3-Lead ECG, Respiration Rate, Skin Temperature, Accelerometry',
        mode: 'CONTINUOUS',
        workingStatus: 'WORKING',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Active Worn Units', value: '4 / 4', unit: 'crew', limit: '4 Worn', margin: '100% Synced', trend: 'NOMINAL' },
          { param: 'Heart Rate Stream', value: String(hrVal), unit: 'bpm', limit: '50 - 100 bpm', margin: hrVal > 100 ? 'Excursion' : 'Nominal', trend: hrVal > 100 ? 'ELEVATED' : 'STABLE', warning: hrVal > 100 },
          { param: 'Respiration Rate', value: `${(pkt?.heart_rate && pkt.heart_rate > 95 ? 18.2 : 14.2).toFixed(1)}`, unit: 'br/min', limit: '12 - 20', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Skin Temperature', value: `${(tempVal - 2.4).toFixed(1)}`, unit: '°C', limit: '32 - 36 °C', margin: 'Nominal', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-BIO-02',
        name: 'Autonomous Physiological Sensor Pod (CPOD)',
        acronym: 'CPOD-PHYSIO',
        category: 'WEARABLE',
        categoryLabel: 'Wearables & Telemetry',
        compartment: 'Sleep Station · Bio-Docks',
        hwRef: 'CPOD-PHYSIO-AUTONOMOUS',
        measures: 'Galvanic Skin Response (GSR), Sympathetic Stress Tone, Sleep Vitals',
        mode: 'CONTINUOUS',
        workingStatus: 'WORKING',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Active Pods', value: '4 / 4', unit: 'online', limit: '4 Online', margin: 'Locked', trend: 'NOMINAL' },
          { param: 'HRV RMSSD', value: String(hrvVal), unit: 'ms', limit: '< 0.45', margin: hrvVal < 40 ? 'Sympathetic' : 'Calm', trend: 'STABLE' },
          { param: 'Galvanic Response', value: '4.2', unit: 'µS', limit: '2 - 12 µS', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Sleep Architecture', value: 'REM/Deep', unit: '', limit: '> 1.5 hr/d', margin: 'Restorative', trend: 'NOMINAL' },
        ],
      },
      {
        id: 'SYS-BIO-03',
        name: 'Wearable 12-Lead ECG & Cardiac Vector Patch',
        acronym: 'CARDIO-PATCH',
        category: 'WEARABLE',
        categoryLabel: 'Wearables & Telemetry',
        compartment: 'Crew Worn · Sternal Patch',
        hwRef: 'NASA-BIO-VEC-12',
        measures: 'Lead-II Cardiac Rhythm, ST Segment Deviation, QTc Interval, Arrhythmias',
        mode: 'CONTINUOUS',
        workingStatus: kVal < 3.5 || qtcVal > 450 ? 'WARNING' : 'WORKING',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Heart Rhythm', value: kVal < 3.5 || qtcVal > 450 ? 'Prolonged QTc' : 'Sinus', unit: '', limit: 'Normal Sinus', margin: kVal < 3.5 ? 'Ectopy Gate' : 'Regular', trend: kVal < 3.5 ? 'CAUTION' : 'NOMINAL', warning: kVal < 3.5 || qtcVal > 450 },
          { param: 'Mean QTc Interval', value: String(qtcVal), unit: 'ms', limit: '< 450 ms', margin: qtcVal > 450 ? `+${qtcVal - 450}ms` : 'Safe', trend: qtcVal > 450 ? 'WIDENED' : 'STABLE', warning: qtcVal > 450 },
          { param: 'Arrhythmia Counter', value: kVal < 3.2 || qtcVal > 470 ? '2 PVCs' : '0', unit: 'events', limit: '< 5 / hr', margin: 'Sentry Pass', trend: 'STABLE' },
          { param: 'ST Deviation', value: kVal < 3.5 ? '0.08' : '0.02', unit: 'mV', limit: '< 0.10 mV', margin: 'Baseline', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-BIO-04',
        name: 'Reflectance Pulse Oximeter & PPG Sensor',
        acronym: 'PPG-PERFUSION',
        category: 'WEARABLE',
        categoryLabel: 'Wearables & Telemetry',
        compartment: 'Crew Worn · Wrist / Finger',
        hwRef: 'MAXIM-PPG-SPACE-V3',
        measures: 'Arterial Oxygen Saturation (SpO₂), Pulse Wave Velocity, Perfusion Index',
        mode: 'CONTINUOUS',
        workingStatus: spo2Val < 96.0 ? 'WARNING' : 'WORKING',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Arterial SpO₂', value: spo2Val.toFixed(1), unit: '%', limit: '> 95.0 %', margin: spo2Val < 96 ? 'Low' : 'Optimal', trend: spo2Val < 96 ? 'DEPRESSED' : 'STABLE', warning: spo2Val < 96 },
          { param: 'Perfusion Index', value: '3.4', unit: '%', limit: '> 1.0 %', margin: 'Good Flow', trend: 'STABLE' },
          { param: 'Pulse Wave Velocity', value: '6.8', unit: 'm/s', limit: '< 8.5 m/s', margin: 'Elastic', trend: 'STABLE' },
          { param: 'Microvascular Shift', value: '0.04', unit: 'index', limit: '< 0.20', margin: 'Normal', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-BIO-05',
        name: 'Non-Invasive Core Body Temperature Monitor (T-Mini)',
        acronym: 'T-MINI-CORE',
        category: 'WEARABLE',
        categoryLabel: 'Wearables & Telemetry',
        compartment: 'Crew Worn · Forehead / Sternum',
        hwRef: 'DRAEGER-DOUBLE-SENSOR-TM',
        measures: 'Deep Core Body Temperature, Double-Sensor Heat Flux Rate',
        mode: 'CONTINUOUS',
        workingStatus: tempVal > 37.4 ? 'WARNING' : 'WORKING',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Mean Core Temp', value: tempVal.toFixed(1), unit: '°C', limit: '36.2 - 37.6', margin: tempVal > 37.2 ? 'Warm' : 'Euthermic', trend: tempVal > 37.2 ? 'ELEVATED' : 'STABLE', warning: tempVal > 37.4 },
          { param: 'Forehead Heat Flux', value: '28.4', unit: 'W/m²', limit: '20 - 45', margin: 'Normal', trend: 'STABLE' },
          { param: 'Space Fever Margin', value: `+${(tempVal - 36.6).toFixed(1)}`, unit: '°C', limit: '< +1.0 °C', margin: 'Clear', trend: 'STABLE' },
          { param: 'Circadian Peak', value: '18:30', unit: 'UTC', limit: 'Expected', margin: 'Entrained', trend: 'NOMINAL' },
        ],
      },
      {
        id: 'SYS-LAB-01',
        name: 'In-Flight Blood Cell Analyzer (rHEALTH POC)',
        acronym: 'LAB-RHEALTH',
        category: 'LAB',
        categoryLabel: 'Lab & Diagnostics',
        compartment: 'Medical Lab · Rack-03',
        hwRef: 'RHEALTH-MICRO-CYTOMETER',
        measures: 'Complete Blood Count (WBC, RBC, Platelets, Hematocrit, Hemoglobin)',
        mode: 'ON DEMAND',
        workingStatus: 'WORKING',
        status: 'CALIBRATED',
        telemetryMode: 'PERIODIC LAB',
        lastSync: '2.4s ago',
        metrics: [
          { param: 'Total WBC Count', value: wbcVal.toFixed(1), unit: '×10³/µL', limit: '4.5 - 11.0', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Hemoglobin', value: (hctVal / 3.0).toFixed(1), unit: 'g/dL', limit: '13.5 - 17.5', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Platelets (PLT)', value: pltVal.toFixed(0), unit: '×10³/µL', limit: '150 - 450', margin: 'Normal', trend: 'STABLE' },
          { param: 'Hematocrit (Hct)', value: hctVal.toFixed(1), unit: '%', limit: '40 - 52 %', margin: hctVal > 50 ? 'Viscous' : 'Safe', trend: hctVal > 50 ? 'ELEVATED' : 'STABLE' },
        ],
      },
      {
        id: 'SYS-LAB-02',
        name: 'Clinical Chemistry & Electrolyte Analyzer (Piccolo)',
        acronym: 'LAB-PICCOLO',
        category: 'LAB',
        categoryLabel: 'Lab & Diagnostics',
        compartment: 'Medical Lab · Rack-03',
        hwRef: 'PICCOLO-XPRESS-CHEM',
        measures: 'Serum Potassium (K⁺), Sodium (Na⁺), Creatinine, Liver & Kidney Panels',
        mode: 'ON DEMAND',
        workingStatus: kVal < 3.5 ? 'WARNING' : 'WORKING',
        status: 'CALIBRATED',
        telemetryMode: 'PERIODIC LAB',
        lastSync: '2.5s ago',
        metrics: [
          { param: 'Serum Potassium (K⁺)', value: kVal.toFixed(2), unit: 'mmol/L', limit: '3.5 - 5.0', margin: kVal < 3.5 ? 'Depleted' : 'Safe', trend: kVal < 3.5 ? 'LOW' : 'STABLE', warning: kVal < 3.5 },
          { param: 'Serum Sodium (Na⁺)', value: '139', unit: 'mmol/L', limit: '135 - 145', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Serum Creatinine', value: '0.94', unit: 'mg/dL', limit: '0.7 - 1.3', margin: 'Renal OK', trend: 'STABLE' },
          { param: 'Blood Urea Nitrogen', value: '15.1', unit: 'mg/dL', limit: '7 - 20', margin: 'Hydrated', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-LAB-03',
        name: 'Multiplex Cytokine & Immunoassay System (Luminex)',
        acronym: 'LAB-CYTOKINE',
        category: 'LAB',
        categoryLabel: 'Lab & Diagnostics',
        compartment: 'Medical Lab · Cold Stowage 01',
        hwRef: 'LUMINEX-MAGPIX-71',
        measures: '71-Plex Immune Cytokines, Inflammatory Markers, Latent Viral Load',
        mode: 'PERIODIC',
        workingStatus: il6Val > 15 ? 'WARNING' : 'WORKING',
        status: 'CALIBRATED',
        telemetryMode: 'PERIODIC LAB',
        lastSync: '4.1s ago',
        metrics: [
          { param: 'Interleukin-6 (IL-6)', value: il6Val.toFixed(1), unit: 'pg/mL', limit: '< 5.0', margin: il6Val > 10 ? 'Inflamed' : 'Low Inflam', trend: il6Val > 10 ? 'ELEVATED' : 'STABLE', warning: il6Val > 15 },
          { param: 'C-Reactive Protein', value: crpVal.toFixed(2), unit: 'mg/L', limit: '< 3.0', margin: 'Nominal', trend: 'STABLE' },
          { param: 'TNF-Alpha', value: '3.8', unit: 'pg/mL', limit: '< 8.0', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Viral Reactivation', value: 'NEGATIVE', unit: '', limit: 'Negative', margin: 'Dormant', trend: 'NOMINAL' },
        ],
      },
      {
        id: 'SYS-RAD-01',
        name: 'HERA Spacecraft Radiation Sensor Grid',
        acronym: 'HERA-RAD',
        category: 'RADIATION',
        categoryLabel: 'Radiation Environment',
        compartment: 'Habitat Hull · 6-Node Mesh',
        hwRef: 'NASA-HERA-SILICON-HEX',
        measures: 'Galactic Cosmic Ray (GCR) Flux, Silicon Microdosimetry, SPE Alarms',
        mode: 'CONTINUOUS',
        workingStatus: radFluxVal > 5.0 ? 'WARNING' : 'WORKING',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'GCR Dose Rate', value: '1.24', unit: 'mGy/d', limit: '< 1.50', margin: 'Nominal GCR', trend: 'STABLE' },
          { param: 'Solar Proton Flux', value: radFluxVal.toFixed(1), unit: 'mGy/d', limit: '< 5.0', margin: radFluxVal > 5.0 ? 'Storm Alert' : 'Solar Quiet', trend: radFluxVal > 5.0 ? 'SURGING' : 'STABLE', warning: radFluxVal > 5.0 },
          { param: 'SPE Warning Status', value: radFluxVal > 5.0 ? 'WARNING' : 'GREEN', unit: '', limit: 'Threshold 5.0 mGy/d', margin: radFluxVal > 5.0 ? 'SPE Active' : 'No Storm', trend: radFluxVal > 5.0 ? 'CRITICAL' : 'NOMINAL', warning: radFluxVal > 5.0 },
          { param: 'Storm Shelter Buffer', value: '100', unit: '%', limit: '> 95 %', margin: 'Shielded', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-RAD-02',
        name: 'Crew Personal Active Dosimeter (CAD)',
        acronym: 'CAD-DOSIMETER',
        category: 'RADIATION',
        categoryLabel: 'Radiation Environment',
        compartment: 'Crew Worn · Sternal Clips',
        hwRef: 'NASA-CAD-ACTIVE-4',
        measures: 'Individual Absorbed Dose Rate, Cumulative Mission Radiation Exposure',
        mode: 'CONTINUOUS',
        workingStatus: 'WORKING',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Mean Active Dose', value: (radFluxVal * 0.3).toFixed(2), unit: 'mSv/d', limit: '< 0.50', margin: 'Nominal', trend: 'STABLE' },
          { param: 'Cumulative Mission', value: (radDoseVal * 1000).toFixed(1), unit: 'mSv', limit: '< 150 mSv', margin: 'Career Safe', trend: 'STABLE' },
          { param: 'Silicon Diode Health', value: '100', unit: '%', limit: '> 95 %', margin: '4 Synced', trend: 'STABLE' },
          { param: 'SPE Audible Buzzer', value: radFluxVal > 5.0 ? 'CHIRPING' : 'ARMED', unit: '', limit: 'Armed', margin: 'Chirp Ready', trend: 'NOMINAL', warning: radFluxVal > 5.0 },
        ],
      },
      {
        id: 'SYS-CTR-01',
        name: 'ARED & CEVIS Exercise Countermeasure Suite',
        acronym: 'EXERCISE-SUITE',
        category: 'COUNTERMEASURE',
        categoryLabel: 'Exercise & Countermeasures',
        compartment: 'Hab Node 1 · Exercise Bay',
        hwRef: 'ARED-CEVIS-PUMA-V2',
        measures: 'Resistive Piston Force, Cycle Ergometer Watts, Oxygen VO₂ Uptake',
        mode: 'PERIODIC',
        workingStatus: 'WORKING',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.2s ago',
        metrics: [
          { param: 'ARED Loading Force', value: pkt?.mission_state === 'WORKOUT' ? '240' : '0', unit: 'kg', limit: 'Up to 272 kg', margin: 'Piston OK', trend: 'STABLE' },
          { param: 'CEVIS Workload', value: pkt?.mission_state === 'WORKOUT' ? '175' : '0', unit: 'W', limit: '0 - 350 W', margin: 'Nominal', trend: 'STABLE' },
          { param: 'PUMA VO₂ Uptake', value: '38.4', unit: 'mL/kg/min', limit: '> 32.0', margin: 'Aerobic OK', trend: 'STABLE' },
          { param: 'Daily Crew Session', value: '2 / 4', unit: 'done', limit: '4 / 4 / day', margin: '2 In Queue', trend: 'NOMINAL' },
        ],
      },
    ];

    // Filter systems by chosen category
    const filteredSystems = sysCategoryFilter === 'ALL'
      ? spacecraftSystems
      : spacecraftSystems.filter(s => s.category === sysCategoryFilter);

    // Counts for filter pills
    const countAll = spacecraftSystems.length;
    const countEclss = spacecraftSystems.filter(s => s.category === 'ECLSS').length;
    const countWearable = spacecraftSystems.filter(s => s.category === 'WEARABLE').length;
    const countLab = spacecraftSystems.filter(s => s.category === 'LAB').length;
    const countRad = spacecraftSystems.filter(s => s.category === 'RADIATION').length;
    const countCtr = spacecraftSystems.filter(s => s.category === 'COUNTERMEASURE').length;

    // Consumables dataset with dynamic status and strict 4-column alignment
    const consumablesTable = [
      { label: 'O₂ Cryogenic Supply', value: '68.4', unit: 'kg', baseline: '80.0 kg', margin: '83 crew-days reserve' },
      { label: 'Potable H₂O Reserve', value: '284', unit: 'L', baseline: '300 L', margin: '71 crew-days supply' },
      { label: 'LiOH Backup Canisters', value: '12', unit: 'units', baseline: '12 units', margin: isCo2Excursion ? 'Bed B active · Backup armed' : 'Emergency scrubbers sealed' },
      { label: 'Medical Supply Packs', value: '4 / 4', unit: 'kits', baseline: '4 kits', margin: 'All medical kits sterile' },
      { label: 'Oral K⁺ Electrolyte Packs', value: kVal < 3.5 ? '15 / 16' : '16 / 16', unit: 'units', baseline: '16 units', margin: kVal < 3.5 ? 'Administered 20 mEq · 15 left' : 'Arrhythmia countermeasure' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ─── ZONE 1: MINIMAL SPACECRAFT HEALTH METRICS BANNER (DECLUTTERED) ─── */}
        <div
          style={{
            background: 'linear-gradient(180deg, #181d22 0%, #0f1316 100%)',
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: '10px 14px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={labelStyle}>SPACECRAFT HEALTH METRICS</div>
              <Badge color={T.nominal} borderColor={T.nominalBorder}>
                16 / 16 ONLINE
              </Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: T.mono, color: T.nominal }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.nominal, display: 'inline-block', boxShadow: `0 0 6px ${T.nominal}` }} />
              TELEMETRY LOCKED
            </div>
          </div>

          {/* 5-Column Clean, Self-Explanatory Spacecraft Health Gauges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {/* Counter 1: Installed Systems */}
            <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '9px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  INSTALLED SYSTEMS
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.nominal, letterSpacing: '0.04em' }}>
                  ALL ONLINE
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary, marginTop: 4 }}>
                16 / 16
              </div>
              <div style={{ width: '100%', height: 3, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: T.nominal }} />
              </div>
            </div>

            {/* Counter 2: System Health */}
            <div style={{ background: '#0a0d10', border: `1px solid ${isCo2Excursion ? T.warningBorder : T.borderSubtle}`, borderRadius: 4, padding: '9px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  SYSTEM HEALTH
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: isCo2Excursion ? T.warning : T.nominal, letterSpacing: '0.04em' }}>
                  {isCo2Excursion ? 'ADVISORY' : 'NOMINAL'}
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: isCo2Excursion ? T.warning : T.nominal, marginTop: 4 }}>
                {isCo2Excursion ? '94.2%' : '98.6%'}
              </div>
              <div style={{ width: '100%', height: 3, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: isCo2Excursion ? '94.2%' : '98.6%', height: '100%', background: isCo2Excursion ? T.warning : T.nominal }} />
              </div>
            </div>

            {/* Counter 3: Life Support Supply (Explaining 71 Days) */}
            <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '9px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  LIFE SUPPORT SUPPLY
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                  SAFE BUFFER
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary, marginTop: 4 }}>
                71 DAYS
              </div>
              <div style={{ width: '100%', height: 3, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: '82%', height: '100%', background: '#38bdf8' }} />
              </div>
            </div>

            {/* Counter 4: Flight Safety Rules */}
            <div
              title="Continuous automated NASA-STD-3001 safety checks (Cabin O2, CO2 limits, radiation limits, pressure, water purity, vital signs)"
              style={{ background: '#0a0d10', border: `1px solid ${isCo2Excursion ? T.warningBorder : T.borderSubtle}`, borderRadius: 4, padding: '9px 12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  SAFETY CHECKS
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: isCo2Excursion ? T.warning : T.nominal, letterSpacing: '0.04em' }}>
                  {isCo2Excursion ? '1 ADVISORY' : 'ALL NOMINAL'}
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: isCo2Excursion ? T.warning : T.nominal, marginTop: 4 }}>
                {isCo2Excursion ? '49 / 50' : '50 / 50'}
              </div>
              <div style={{ width: '100%', height: 3, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: isCo2Excursion ? '98%' : '100%', height: '100%', background: isCo2Excursion ? T.warning : T.nominal }} />
              </div>
            </div>

            {/* Counter 5: Telemetry Stream Rate */}
            <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '9px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  DATA STREAM RATE
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.nominal, letterSpacing: '0.04em' }}>
                  LIVE SYNC
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary, marginTop: 4 }}>
                10.0 Hz
              </div>
              <div style={{ width: '100%', height: 3, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: T.nominal }} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── ZONE 2: STRICTLY ALIGNED SPACECRAFT CONSUMABLES CONTAINER ─── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={labelStyle}>SPACECRAFT CONSUMABLES &amp; EMERGENCY FLIGHT MARGINS</div>
            <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>NASA-STD-3001 · 4 CREW AUTONOMOUS BUFFER</span>
          </div>

          {/* 4-Column Table Header with Strict Column Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '220px 140px 130px 1fr',
              padding: '6px 8px',
              background: '#0a0e13',
              borderRadius: '4px 4px 0 0',
              borderBottom: `1px solid ${T.border}`,
              fontSize: 9,
              fontWeight: 700,
              color: T.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <div>CONSUMABLE RESOURCE</div>
            <div style={{ textAlign: 'right' }}>CURRENT QUANTITY</div>
            <div style={{ textAlign: 'right' }}>NOMINAL BASELINE</div>
            <div style={{ textAlign: 'right' }}>FLIGHT MARGIN / STATUS</div>
          </div>

          {/* Table Rows with Identical Column Widths */}
          {consumablesTable.map((item, idx) => (
            <div
              key={item.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 140px 130px 1fr',
                alignItems: 'center',
                padding: '8px 8px',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                borderBottom: idx < consumablesTable.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary }}>{item.label}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.textPrimary }}>
                  {item.value}
                </span>
                <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>{item.unit}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, fontFamily: T.mono, color: T.textMuted }}>
                base {item.baseline}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, fontFamily: T.mono, color: '#9ec7ef', fontWeight: 600 }}>
                {item.margin}
              </div>
            </div>
          ))}
        </div>

        {/* ─── ZONE 3: COMPACT CATEGORY FILTER TABS — Clean Buttons without External Container Dock ─── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 4,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#9ec7ef', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
            FILTER:
          </span>
          {[
            { key: 'ALL', label: `ALL (${countAll})` },
            { key: 'ECLSS', label: `ECLSS (${countEclss})` },
            { key: 'WEARABLE', label: `WEARABLES (${countWearable})` },
            { key: 'LAB', label: `LAB & POC (${countLab})` },
            { key: 'RADIATION', label: `RADIATION (${countRad})` },
            { key: 'COUNTERMEASURE', label: `COUNTERMEASURES (${countCtr})` },
          ].map(f => {
            const isSel = sysCategoryFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setSysCategoryFilter(f.key as any)}
                style={{
                  background: isSel ? 'rgba(56, 189, 248, 0.30)' : '#0c0f12',
                  border: isSel ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid #2c3642',
                  borderRadius: 4,
                  padding: '5px 12px',
                  color: isSel ? '#ffffff' : '#9ec7ef',
                  fontSize: 10,
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: T.sans,
                  letterSpacing: '0.04em',
                  textShadow: isSel ? '0 1px 2px rgba(0, 0, 0, 0.75)' : 'none',
                  boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)' : 'none',
                  transition: 'all 0.12s ease',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ─── ZONE 4: INSTALLED SPACECRAFT HEALTH DEVICES CONTAINER CARDS (DECLUTTERED) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 14 }}>
          {filteredSystems.map(sys => {
            const isWarn = sys.workingStatus === 'WARNING' || sys.status === 'MONITOR';

            // Minimal Mode Badge styling
            const modeColors = {
              'CONTINUOUS': { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' },
              'PERIODIC': { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.35)', color: '#c084fc' },
              'ON DEMAND': { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.35)', color: '#facc15' },
            }[sys.mode] || { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' };

            return (
              <div
                key={sys.id}
                style={{
                  background: 'linear-gradient(180deg, #161b20 0%, #0e1215 100%)',
                  border: `1px solid ${isWarn ? T.warningBorder : T.border}`,
                  borderRadius: 6,
                  padding: '12px 14px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
                }}
              >
                <div>
                  {/* Card Header: Category + Minimal Status Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#9ec7ef',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {sys.categoryLabel}
                    </span>

                    {/* Minimal Badges: Working Status & Operating Mode */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Working Status Badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: isWarn ? 'rgba(245, 158, 11, 0.18)' : 'rgba(34, 197, 94, 0.14)',
                          border: `1px solid ${isWarn ? 'rgba(245, 158, 11, 0.45)' : 'rgba(34, 197, 94, 0.35)'}`,
                          color: isWarn ? '#fbbf24' : '#4ade80',
                          borderRadius: 3,
                          padding: '2px 7px',
                          fontSize: 8.5,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: isWarn ? '#f59e0b' : '#22c55e', display: 'inline-block' }} />
                        {isWarn ? 'WARNING' : 'WORKING'}
                      </span>

                      {/* Mode Badge: CONTINUOUS / PERIODIC / ON DEMAND */}
                      <span
                        style={{
                          background: modeColors.bg,
                          border: `1px solid ${modeColors.border}`,
                          color: modeColors.color,
                          borderRadius: 3,
                          padding: '2px 7px',
                          fontSize: 8.5,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {sys.mode}
                      </span>
                    </div>
                  </div>

                  {/* Specific Device Name as Clear Title */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', letterSpacing: '0.01em', marginBottom: 8 }}>
                    {sys.name}
                  </div>

                  {/* WHAT IT'S MEASURING (Clean Highlight) */}
                  <div
                    style={{
                      background: 'rgba(56, 189, 248, 0.05)',
                      borderLeft: '2px solid #38bdf8',
                      borderRadius: '0 4px 4px 0',
                      padding: '5px 9px',
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ fontSize: 8.5, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 6 }}>
                      MEASURES:
                    </span>
                    <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 500 }}>
                      {sys.measures}
                    </span>
                  </div>

                  {/* Clean 2x2 Key Telemetry Readouts Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {sys.metrics.map(m => (
                      <div
                        key={m.param}
                        style={{
                          background: '#0a0d10',
                          border: `1px solid ${m.warning ? T.warningBorder : T.borderSubtle}`,
                          borderRadius: 4,
                          padding: '6px 9px',
                        }}
                      >
                        <div style={{ fontSize: 9, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.param}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: m.warning ? T.warning : T.textPrimary }}>
                            {m.value} {m.unit && <span style={{ fontSize: 8.5, color: T.textMuted }}>{m.unit}</span>}
                          </span>
                          <span style={{ fontSize: 8.5, fontWeight: 600, color: m.warning ? T.warning : T.nominal }}>
                            {m.warning ? 'ADVISORY' : 'NOMINAL'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer: Compartment & View Telemetry Stream Action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: `1px solid ${T.borderSubtle}`,
                  }}
                >
                  <div style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>
                    {sys.compartment} · {sys.hwRef}
                  </div>
                  {onSelectView && (
                    <button
                      onClick={() => onSelectView('HEALTH_TELEMETRY')}
                      style={{
                        background: '#0a0e13',
                        border: `1px solid ${T.border}`,
                        borderRadius: 3,
                        padding: '4px 9px',
                        color: '#9ec7ef',
                        fontSize: 9,
                        fontWeight: 600,
                        cursor: 'pointer',
                        letterSpacing: '0.03em',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.color = '#9ec7ef';
                      }}
                    >
                      VIEW IN TELEMETRY →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // COMMS TAB
  // ─────────────────────────────────────────────────────────────
  const renderComms = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {/* DSN Tracking */}
      <div style={cardStyle}>
        <div style={labelStyle}>Deep Space Network Tracking</div>
        {DSN.map((stn, i) => (
          <div key={stn.name} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
            borderBottom: i < DSN.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
          }}>
            <Dot color={i === dsnIdx ? T.nominal : T.textMuted} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: i === dsnIdx ? 600 : 400, color: i === dsnIdx ? T.textPrimary : T.textSecondary }}>{stn.name}</div>
              <div style={{ fontSize: 9, color: T.textMuted }}>{stn.loc} · {stn.freq}</div>
            </div>
            <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textSecondary }}>SNR {stn.snr} dB</div>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              color: i === dsnIdx ? T.nominal : T.textMuted,
              background: '#090c0f',
              border: `1px solid ${i === dsnIdx ? T.nominalBorder : T.borderSubtle}`,
              borderRadius: 3,
              padding: '2px 6px',
              letterSpacing: '0.04em',
            }}>
              {i === dsnIdx ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 8, lineHeight: 1.4 }}>
          DSN station network tracking (Goldstone DSS-14, Madrid DSS-63, Canberra DSS-43).
          Autonomous rotation schedule every 45 seconds.
        </div>
      </div>

      {/* Station Handover & Conjunction Geometry */}
      <div style={cardStyle}>
        <div style={labelStyle}>Station Handover & Conjunction Geometry</div>
        <MetricRow label="Active Carrier" value={activeDSN.name.split(' ')[0]} unit="" delta="Carrier lock" color={T.nominal} />
        <MetricRow label="Next Handover" value="Madrid → Canberra" unit="" delta="in 01h 42m" />
        <MetricRow label="Receiver Margin" value="+14.2" unit=" dB" delta="above threshold" color={T.nominal} />
        <MetricRow label="Solar SEP Angle" value="14.8" unit=" °" delta="clear of disk (>3.0°)" color={T.nominal} />
        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 8, lineHeight: 1.4 }}>
          Sun-Earth-Probe (SEP) angle &gt; 3.0° ensures zero solar coronal plasma radio scintillation.
          Link margin guarantees continuous telemetry decode.
        </div>
      </div>

      {/* Propagation */}
      <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
        <div style={labelStyle}>Speed-of-Light Propagation Calculator (τ = d / c)</div>

        {/* Distance presets — Clean Buttons without External Container Dock */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 12 }}>
          {(Object.keys(DISTANCES) as DistancePreset[]).map(k => {
            const isSel = distPreset === k;
            return (
              <button
                key={k}
                onClick={() => setDistPreset(k)}
                style={{
                  background: isSel ? 'rgba(56, 189, 248, 0.30)' : '#0b0e11',
                  border: isSel ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid #202b38',
                  borderRadius: 4,
                  padding: '5px 12px',
                  fontSize: 10,
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? '#ffffff' : '#9ec7ef',
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  textShadow: isSel ? '0 1px 2px rgba(0, 0, 0, 0.75)' : 'none',
                  boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)' : 'none',
                  transition: 'all 0.12s ease',
                }}
              >
                {DISTANCES[k].label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: T.textMuted }}>DISTANCE (d)</div>
            <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 600, color: T.textPrimary, marginTop: 2 }}>
              {prop.km >= 1e6 ? `${(prop.km / 1e6).toFixed(1)}M` : prop.km >= 1e3 ? `${(prop.km / 1e3).toFixed(0)}k` : `${prop.km}`} <span style={unitStyle}>km</span>
            </div>
          </div>
          <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: T.textMuted }}>ONE-WAY LIGHT TIME</div>
            <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 600, color: T.textPrimary, marginTop: 2 }}>
              {prop.owFmt}
            </div>
          </div>
          <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: T.textMuted }}>ROUND-TRIP DELAY</div>
            <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 600, color: T.textPrimary, marginTop: 2 }}>
              {prop.rtFmt}
            </div>
          </div>
          <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: T.textMuted }}>RF CARRIER STATE</div>
            <div style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 600, color: connected ? T.nominal : T.critical, marginTop: 2 }}>
              {connected ? 'CARRIER LOCK' : 'NO LOCK'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 10, lineHeight: 1.5 }}>
          Speed-of-light propagation delay is strictly calculated using vacuum velocity c = 299,792 km/s.
          This is electromagnetic physics propagation time, NOT software network latency.
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // INVESTIGATE TAB
  // ─────────────────────────────────────────────────────────────
  const renderInvestigate = () => {
    if (!activeEvent || activeEvent.priority === 'NOMINAL') {
      return (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 13, color: T.nominal, marginBottom: 6 }}>
            <Dot color={T.nominal} size={8} /> No active anomalies to investigate
          </div>
          <div style={{ fontSize: 11, color: T.textMuted }}>All crew and systems are operating within prescribed baselines.</div>
        </div>
      );
    }

    const evt = activeEvent;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Event Header */}
        <div style={{
          ...cardStyle,
          borderColor: severityBorder(evt.priority),
          borderLeftWidth: 4,
          borderLeftColor: severityColor(evt.priority),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Dot color={severityColor(evt.priority)} size={8} />
              <Badge color={severityColor(evt.priority)} borderColor={severityBorder(evt.priority)} bg="#090c0f">
                {evt.priority}
              </Badge>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{evt.entity}</span>
              <span style={{ fontSize: 10, color: T.textMuted }}>{evt.subsystem}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: T.textMuted }}>{evt.time}</span>
              <span style={{ fontSize: 10, color: T.textMuted }}>Age: {evt.age}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: severityColor(evt.priority) }}>
                {trendArrow(evt.trend)} {evt.trend}
              </span>
              <button
                onClick={() => ack(evt.id)}
                style={{
                  background: evt.acknowledged ? '#090d09' : '#0b0e11',
                  border: `1px solid ${evt.acknowledged ? T.nominalBorder : T.border}`,
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 9,
                  color: evt.acknowledged ? T.nominal : T.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {evt.acknowledged ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.textPrimary, marginTop: 6, fontWeight: 500 }}>{evt.summary}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: T.textMuted }}>Trajectory: <strong style={{ color: severityColor(evt.priority) }}>{evt.trajectory}</strong></span>
            <span style={{ fontSize: 10, color: T.textMuted }}>•</span>
            <span style={{ fontSize: 10, color: T.textMuted }}>Time to Limit: <strong style={{ color: T.textPrimary }}>{evt.timeToLimit}</strong></span>
          </div>
        </div>

        {/* Pre-Anomaly Timeline Sequence */}
        {evt.timelineSequence && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={labelStyle}>Pre-Anomaly Timeline & Signal Cascade Sequence</div>
              <span style={{ fontSize: 9, color: T.textMuted }}>Temporal Correlation & Sequence (Not Implied Causality)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${evt.timelineSequence.length}, 1fr)`, gap: 8 }}>
              {evt.timelineSequence.map((step, idx) => (
                <div key={idx} style={{ background: '#0b0e11', border: `1px solid ${severityBorder(step.severity)}`, borderRadius: 4, padding: '7px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>{step.time}</span>
                    <span style={{ fontSize: 9, fontFamily: T.mono, color: severityColor(step.severity) }}>{step.delta}</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.textPrimary }}>{step.signal}</div>
                  <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2, lineHeight: 1.2 }}>{step.finding}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4-Category Evidence Structure */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Observed */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={labelStyle}>1. Observed (Directly Measured Telemetry)</div>
              <Badge color={T.nominal} borderColor={T.nominalBorder}>MEASURED</Badge>
            </div>
            {evt.observed.map((o, i) => (
              <div key={i} style={{ fontSize: 11, color: T.textPrimary, padding: '4px 0', borderBottom: `1px solid ${T.borderSubtle}` }}>{o}</div>
            ))}
          </div>

          {/* Derived */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={labelStyle}>2. Derived (Calculated from Data)</div>
              <Badge color={T.info} borderColor="#2a3a4a">CALCULATED</Badge>
            </div>
            {evt.derived.map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: T.textPrimary, padding: '4px 0', borderBottom: `1px solid ${T.borderSubtle}` }}>{d}</div>
            ))}
          </div>

          {/* Correlated */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={labelStyle}>3. Correlated Signals (Co-Occurring Trends)</div>
              <span style={{ fontSize: 9, color: T.textMuted }}>Temporal link</span>
            </div>
            {evt.correlated.map((c, i) => (
              <div key={i} style={{ fontSize: 11, color: T.textSecondary, padding: '4px 0', borderBottom: `1px solid ${T.borderSubtle}` }}>{c}</div>
            ))}
          </div>

          {/* Possible Factors */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={labelStyle}>4. Possible Factors (Hypotheses, Not Proven)</div>
              <span style={{ fontSize: 9, color: T.warning }}>Requires verification</span>
            </div>
            {evt.possibleFactors.map((f, i) => (
              <div key={i} style={{ fontSize: 11, color: T.textSecondary, padding: '4px 0', borderBottom: `1px solid ${T.borderSubtle}` }}>{f}</div>
            ))}
          </div>
        </div>

        {/* Decision Support & Provenance */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <div style={cardStyle}>
            <div style={labelStyle}>Actions to evaluate (Human-In-The-Loop)</div>
            {evt.actionsToEvaluate.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, padding: '5px 0', borderBottom: `1px solid ${T.borderSubtle}` }}>
                <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textMuted, minWidth: 16 }}>{i + 1}.</span>
                <span style={{ fontSize: 11, color: T.textPrimary }}>{a}</span>
              </div>
            ))}

            {evt.procedure && (
              <button
                onClick={() => setActiveProcedureId(evt.procedure!)}
                style={{
                  marginTop: 10,
                  background: '#151b22',
                  border: `1px solid ${T.activeBorder}`,
                  borderRadius: 4,
                  padding: '7px 12px',
                  color: '#cad5e2',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.12s ease',
                }}
              >
                REVIEW FLIGHT PROCEDURE: {evt.procedure} →
              </button>
            )}

            <div style={{ fontSize: 9, color: T.textMuted, marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
              These are suggested checks and decision support actions. The human MCC flight controller remains the decision maker.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Confidence & Provenance */}
            <div style={cardStyle}>
              <div style={labelStyle}>Detection Confidence</div>
              <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textPrimary, marginTop: 2 }}>{evt.confidence}</div>
              <div style={{ ...labelStyle, marginTop: 10 }}>Data Provenance</div>
              <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2, lineHeight: 1.4 }}>{evt.provenance}</div>
            </div>

            {/* Baseline Reference */}
            <div style={cardStyle}>
              <div style={labelStyle}>Baseline Reference</div>
              <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>{evt.baselineRef}</div>
            </div>
          </div>
        </div>

        {/* Event History / Shift Summary */}
        <div style={cardStyle}>
          <div style={labelStyle}>Event Log — Shift Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr 120px', gap: 6, marginTop: 6, paddingBottom: 4, borderBottom: `1px solid ${T.borderSubtle}` }}>
            <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700 }}>TIME</span>
            <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700 }}>PRIORITY</span>
            <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700 }}>EVENT</span>
            <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700 }}>ENTITY</span>
          </div>
          {events.map(e => (
            <button
              key={e.id}
              onClick={() => { setSelEventId(e.id); }}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 80px 1fr 120px',
                alignItems: 'center',
                gap: 6,
                padding: '6px 0',
                borderBottom: `1px solid ${T.borderSubtle}`,
                background: selEventId === e.id ? '#171c22' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                boxSizing: 'border-box',
                transition: 'all 0.12s ease',
              }}
            >
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textMuted }}>{e.time}</span>
              <Badge color={severityColor(e.priority)} borderColor={severityBorder(e.priority)} bg="#090c0f">
                {e.priority}
              </Badge>
              <span style={{ fontSize: 10, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</span>
              <span style={{ fontSize: 10, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.entity}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'relative',
      zIndex: 1,
      backgroundColor: T.bg,
      color: T.textPrimary,
      minHeight: 'calc(100vh - 60px)',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: T.sans,
      fontSize: 12,
    }}>

      {/* ─── TOP ORBITAL TELEMETRY CONTROLLER (INLINE CLEAN LAYOUT, NO NESTED BOXES, NO DUPLICATE CLOCKS) ─── */}
      <div style={{
        maxWidth: '1250px',
        margin: '0 auto',
        padding: '0 20px',
        boxSizing: 'border-box',
      }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '6px 12px',
            marginTop: 8,
            marginBottom: 6,
            background: '#090d12',
            border: '1px solid #1e293b',
            borderRadius: 4,
            flexWrap: 'nowrap',
          }}
        >
          {/* Left: Position Dropdown & Delay (Clean inline, NO nested boxes!) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: T.mono }}>
              POSITION:
            </span>

            {/* Shorter names & delays only */}
            <select
              value={orbitalPosition}
              onChange={e => handleOrbitalPositionSelect(e.target.value as DistancePreset)}
              style={{
                background: '#06090d',
                border: '1px solid #283548',
                color: '#f1f5f9',
                borderRadius: 3,
                padding: '3px 8px',
                fontSize: 10.5,
                fontWeight: 600,
                fontFamily: T.sans,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="LEO">LEO · &lt;1 ms</option>
              <option value="GATEWAY">Lunar Gateway · 1.3s</option>
              <option value="MARS_MIN">Mars Opposition · 3.0m</option>
              <option value="MARS_MAX">Mars Conjunction · 22.3m</option>
            </select>

            <span style={{ fontSize: 9, color: '#263342' }}>|</span>

            {/* Plain text delay without nested boxes */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, fontFamily: T.mono, color: '#64748b' }}>
                DELAY:
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: T.mono, color: orbitalPosition === 'LEO' ? '#4ade80' : orbitalPosition === 'GATEWAY' ? '#cbd5e1' : '#f59e0b' }}>
                {fmtTime(DISTANCES[orbitalPosition].km / C)}
              </span>
            </div>

            <span style={{ fontSize: 9, color: '#263342' }}>|</span>

            {/* Earth Station UTC vs Spacecraft Vehicle Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.mono }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }} title="Earth Ground Station (MCC Houston) UTC">
                <span style={{ fontSize: 8.5, fontWeight: 700, color: '#38bdf8' }}>EARTH:</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#f8fafc' }}>
                  {earthTime.toISOString().substring(11, 19)} UTC
                </span>
              </div>
              <span style={{ fontSize: 9, color: '#263342' }}>·</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }} title={`Spacecraft Habitat Vehicle Time (${DISTANCES[orbitalPosition]?.label}) — Delay: ${fmtTime(DISTANCES[orbitalPosition]?.delaySec ?? 0)}`}>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4ade80' }}>SPACECRAFT:</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>
                  {new Date(earthTime.getTime() - (DISTANCES[orbitalPosition]?.delaySec ?? 0) * 1000).toISOString().substring(11, 19)} UTC
                </span>
              </div>
            </div>
          </div>

          {/* Right: Sim Speed & Sync Reset (No nested boxes, no duplicate clocks!) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: T.mono }}>
                SIM SPEED:
              </span>
              <div style={{ display: 'flex', gap: 2, background: '#06090d', padding: '1px', borderRadius: 3, border: '1px solid #1e293b' }}>
                {[1, 2, 5, 10].map(spd => {
                  const isActive = speedMultiplier === spd;
                  return (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      title={`Set simulation playback to ${spd}x`}
                      style={{
                        background: isActive ? '#1e293b' : 'transparent',
                        border: isActive ? '1px solid #334155' : '1px solid transparent',
                        color: isActive ? '#f8fafc' : '#64748b',
                        borderRadius: 2,
                        padding: '2px 8px',
                        fontSize: 9,
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        fontFamily: T.mono,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {spd}x
                    </button>
                  );
                })}
              </div>
            </div>

            <span style={{ fontSize: 9, color: '#263342' }}>|</span>

            {/* Sync State & Reset to 1x Button */}
            <button
              onClick={() => handleSpeedChange(1)}
              title={speedMultiplier > 1 ? `Click to sync simulation clock (${formatSimMet(simMetSeconds)}) with spacecraft (resets to 1x)` : `Telemetry synchronized with spacecraft (${formatSimMet(simMetSeconds)})`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: speedMultiplier > 1 ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                border: speedMultiplier > 1 ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                borderRadius: 3,
                padding: '2px 7px',
                cursor: speedMultiplier > 1 ? 'pointer' : 'default',
                color: speedMultiplier > 1 ? '#38bdf8' : '#64748b',
                fontSize: 9,
                fontFamily: T.mono,
                fontWeight: 600,
                transition: 'all 0.12s ease',
              }}
            >
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: speedMultiplier > 1 ? '#38bdf8' : '#22c55e', display: 'inline-block' }} />
              {speedMultiplier > 1 ? 'SYNC & RESET (1x)' : 'SYNCED (1x REALTIME)'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── NAVIGATION TABS RIBBON (matches navbar width 1250px) ─── */}
      <div style={{
        maxWidth: '1250px',
        margin: '0 auto',
        padding: '0 20px',
        boxSizing: 'border-box',
      }}>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 0',
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          {/* Main Tab Switchings — Clean Buttons without External Container Dock */}
          <div style={{ display: 'flex', gap: 6 }}>
            {tabBtn('OVERVIEW', 'Overview')}
            {tabBtn('CREW', 'Crew')}
            {tabBtn('SYSTEMS', 'Systems')}
            {tabBtn('COMMS', 'Comms')}
            {tabBtn('INVESTIGATE', 'Investigate')}
          </div>

          {/* Quick Mission State Pill & Handover Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowHandover(true)}
              style={{
                background: '#0c0f12',
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                padding: '5px 12px',
                color: T.textSecondary,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                fontFamily: T.sans,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.12s ease',
              }}
            >
              SHIFT HANDOVER
            </button>

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 4,
              background: '#0b0e11',
              border: `1px solid ${severityBorder(missionState)}`,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: severityColor(missionState),
              fontFamily: T.sans,
            }}>
              <Dot color={severityColor(missionState)} size={5} />
              STATUS: {missionState}
            </span>
          </div>
        </nav>
      </div>

      {/* ─── CONTENT (matches 1250px width of other views) ─── */}
      <main style={{ padding: '16px 20px 80px 20px', maxWidth: '1250px', margin: '0 auto', boxSizing: 'border-box' }}>
        {tab === 'OVERVIEW' && renderOverview()}
        {tab === 'CREW' && renderCrew()}
        {tab === 'SYSTEMS' && renderSystems()}
        {tab === 'COMMS' && renderComms()}
        {tab === 'INVESTIGATE' && renderInvestigate()}
      </main>

      {/* ─── SHIFT HANDOVER BRIEFING MODAL ─── */}
      {showHandover && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#0e1216',
            border: `1px solid ${T.borderHighlight}`,
            borderRadius: 6,
            maxWidth: 680,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: T.textPrimary }}>
                  MCC OPERATIONAL SHIFT HANDOVER BRIEFING
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                  MET T+14d 08:42:19 · Flight Console: Sentry Matrix · DSN: {activeDSN.name}
                </div>
              </div>
              <button
                onClick={() => setShowHandover(false)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  color: T.textMuted,
                  fontSize: 12,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Unresolved Events */}
              <div style={{ background: '#14181d', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>1. Active / Unresolved Mission Events</div>
                {events.filter(e => e.priority !== 'NOMINAL').length === 0 ? (
                  <div style={{ fontSize: 11, color: T.nominal }}>● All active channels nominal. All telemetry channels within nominal baseline.</div>
                ) : (
                  events.filter(e => e.priority !== 'NOMINAL').map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.borderSubtle}` }}>
                      <span style={{ fontSize: 11, color: T.textPrimary }}>{e.entity} — {e.summary}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: T.textMuted }}>Age: {e.age}</span>
                        <Badge color={severityColor(e.priority)} borderColor={severityBorder(e.priority)} bg="#090c0f">{e.priority}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Crew Status Summary */}
              <div style={{ background: '#14181d', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>2. Crew Surveillance Status</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {CREW.map(c => {
                    const p = telemetryMap[c.id];
                    const sev = p?.evaluated_severity || 'NOMINAL';
                    return (
                      <div key={c.id} style={{ fontSize: 10, color: T.textSecondary }}>
                        <strong style={{ color: T.textPrimary }}>{c.callsign} {c.name}:</strong> {p ? `HR ${p.heart_rate.toFixed(0)} bpm, SpO₂ ${p.spo2.toFixed(1)}%` : 'No data'} ({sev})
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Subsystems & Comms */}
              <div style={{ background: '#14181d', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>3. Environmental & Deep Space Communications</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • ECLSS Cabin CO₂: {(Object.values(telemetryMap)[0]?.cabin_co2 || 1.8).toFixed(2)} mmHg (Flight rule limit: 3.0 mmHg)<br />
                  • DSN Station: {activeDSN.name} ({activeDSN.freq}) · SNR {activeDSN.snr} dB<br />
                  • Propagation Delay: {prop.owFmt} one-way ({prop.rtFmt} round-trip) · Mars Delay {marsDelay ? 'ACTIVE (22m)' : 'DISABLED (Real-time)'}
                </div>
              </div>

              {/* Pending Procedures */}
              <div style={{ background: '#14181d', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>4. Flight Rules & Checklist Gates</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • NASA-STD-3001 Med Card 04 available for acute tachyarrhythmia evaluation.<br />
                  • NASA-STD-3001 ECLSS CO2 01 available for scrubber saturation containment.<br />
                  • Operator human-in-the-loop validation mandatory prior to commanding.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => {
                  const summaryText = `MCC SHIFT HANDOVER BRIEFING\nMET: T+14d 08:42:19\nActive Station: ${activeDSN.name}\nMission State: ${missionState}\nEvents:\n${events.filter(e => e.priority !== 'NOMINAL').map(e => `- [${e.priority}] ${e.entity}: ${e.summary} (Age: ${e.age})`).join('\n') || 'All systems nominal'}\nECLSS CO2: ${(Object.values(telemetryMap)[0]?.cabin_co2 || 1.8).toFixed(2)} mmHg`;
                  navigator.clipboard.writeText(summaryText);
                  setCopiedHandover(true);
                  setTimeout(() => setCopiedHandover(false), 2000);
                }}
                style={{
                  background: copiedHandover ? '#122416' : '#151b22',
                  border: `1px solid ${copiedHandover ? T.nominal : T.border}`,
                  borderRadius: 4,
                  padding: '7px 14px',
                  color: copiedHandover ? T.nominal : T.textPrimary,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {copiedHandover ? 'COPIED TO CLIPBOARD' : 'COPY HANDOVER BRIEFING'}
              </button>

              <button
                onClick={() => setShowHandover(false)}
                style={{
                  background: '#1a2028',
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  padding: '7px 16px',
                  color: T.textPrimary,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── INTERACTIVE FLIGHT PROCEDURE CHECKLIST MODAL ─── */}
      {activeProcedureId && PROCEDURES[activeProcedureId] && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#0e1216',
            border: `1px solid ${T.borderHighlight}`,
            borderRadius: 6,
            maxWidth: 680,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
          }}>
            {(() => {
              const proc = PROCEDURES[activeProcedureId];
              const totalSteps = proc.steps.length;
              const completedSteps = proc.steps.filter(s => !!procedureChecks[`${proc.id}-${s.step}`]).length;
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, paddingBottom: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, fontFamily: T.mono, color: T.info, background: '#090e14', padding: '2px 6px', borderRadius: 3, border: `1px solid #1a2530` }}>
                          {proc.id}
                        </span>
                        <span style={{ fontSize: 10, color: T.textMuted }}>{proc.category}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginTop: 4 }}>
                        {proc.title}
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveProcedureId(null)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${T.border}`,
                        borderRadius: 4,
                        color: T.textMuted,
                        fontSize: 12,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>
                      Procedure Checklist Progress: <strong style={{ color: completedSteps === totalSteps ? T.nominal : T.textPrimary }}>{completedSteps} / {totalSteps} steps completed</strong>
                    </div>
                    {completedSteps === totalSteps && (
                      <Badge color={T.nominal} borderColor={T.nominalBorder}>PROCEDURE VERIFIED</Badge>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {proc.steps.map(s => {
                      const key = `${proc.id}-${s.step}`;
                      const isDone = !!procedureChecks[key];
                      return (
                        <div
                          key={s.step}
                          onClick={() => setProcedureChecks(p => ({ ...p, [key]: !p[key] }))}
                          style={{
                            background: isDone ? '#0c120d' : '#14181c',
                            border: `1px solid ${isDone ? T.nominalBorder : T.borderSubtle}`,
                            borderRadius: 4,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => {}}
                            style={{ marginTop: 2, cursor: 'pointer', accentColor: T.nominal }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>STEP {s.step}</span>
                              <span style={{ fontSize: 9, fontWeight: 700, color: T.textSecondary, background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 3, padding: '1px 5px' }}>
                                {s.role}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: isDone ? '#8ea88e' : T.textPrimary, textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.4 }}>
                              {s.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                    <button
                      onClick={() => setActiveProcedureId(null)}
                      style={{
                        background: '#1a2028',
                        border: `1px solid ${T.border}`,
                        borderRadius: 4,
                        padding: '7px 18px',
                        color: T.textPrimary,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Close Procedure
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

