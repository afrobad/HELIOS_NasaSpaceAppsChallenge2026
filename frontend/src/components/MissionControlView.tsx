import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { TelemetryPacket, AlertPayload } from '../types/telemetry';
import { HolographicBodyScanner } from './HolographicBodyScanner';
import { CrewGrid } from './CrewGrid';
import { CabinEnvironmentalBar } from './CabinEnvironmentalBar';

// ─────────────────────────────────────────────────────────────
// MCC Design Tokens — Refined Olive-Charcoal Operational Palette
// ─────────────────────────────────────────────────────────────
const T = {
  bg: '#070a07', // Darker, rich aerospace olive-black
  surface: 'linear-gradient(180deg, #1b2025 0%, #121518 100%)', // Professional aerospace gray gradient
  surfaceHover: 'linear-gradient(180deg, #20262c 0%, #161a1e 100%)',
  surfaceFlat: '#14181c',
  surfaceElevated: '#1e242a',
  surfaceRecessed: '#0b0e11', // Dark inset & badge background
  border: '#2c3642', // Subtle refined slate-gray border
  borderSubtle: '#202833',
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
  tabBg: 'rgba(14, 18, 24, 0.65)',
  tabBorder: 'rgba(255, 255, 255, 0.16)',
  tabActiveBg: 'rgba(56, 189, 248, 0.16)',
  tabActiveBorder: 'rgba(56, 189, 248, 0.75)',
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

type DistancePreset = 'LEO' | 'GATEWAY' | 'MARS_MIN' | 'MARS_MAX';
const DISTANCES: Record<DistancePreset, { km: number; label: string }> = {
  LEO: { km: 408, label: 'LEO (ISS)' },
  GATEWAY: { km: 384400, label: 'Lunar Gateway' },
  MARS_MIN: { km: 54600000, label: 'Mars Opposition' },
  MARS_MAX: { km: 400200000, label: 'Mars Conjunction' },
};

const C = 299792; // km/s

function fmtTime(sec: number): string {
  if (sec < 0.001) return '<1 ms';
  if (sec < 1) return `${(sec * 1000).toFixed(0)} ms`;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

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
  connected,
  marsDelay = false,
  onToggleMarsDelay: _onToggleMarsDelay,
  onSelectView,
  onOpenTriage,
  currentScenario,
}) => {
  const [tab, setTab] = useState<MCCTab>('OVERVIEW');
  const [sysCategoryFilter, setSysCategoryFilter] = useState<'ALL' | 'ECLSS' | 'WEARABLE' | 'LAB' | 'RADIATION' | 'COUNTERMEASURE'>('ALL');
  const [selEventId, setSelEventId] = useState<string | null>(null);
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [distPreset, setDistPreset] = useState<DistancePreset>('MARS_MAX');
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

  // ─── DERIVE MISSION EVENTS FROM LIVE TELEMETRY ───
  const events: MissionEvent[] = useMemo(() => {
    const evts: MissionEvent[] = [];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    Object.entries(telemetryMap).forEach(([astId, pkt]) => {
      const crew = CREW.find(c => c.id === astId);
      if (!crew) return;
      const hrD = ((pkt.heart_rate - crew.baseHr) / crew.baseHr) * 100;
      const spo2D = pkt.spo2 - crew.baseSpo2;

      if (pkt.evaluated_severity === 'CRITICAL' || pkt.heart_rate > 115 || (pkt.computed_arf && pkt.computed_arf > 1.8)) {
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
          procedure: 'NASA-STD-3001-MED-CARD-04',
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
      } else if (pkt.evaluated_severity === 'WARNING' || hrD > 20 || spo2D < -2.5) {
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

    // ECLSS CO₂ event
    const anyPkt = Object.values(telemetryMap)[0];
    if (anyPkt?.cabin_co2 > 3.0) {
      evts.push({
        id: 'ENV-CO2',
        time: now,
        priority: anyPkt.cabin_co2 > 5.0 ? 'CRITICAL' : 'WARNING',
        entity: 'ECLSS · Cabin Atmosphere',
        subsystem: 'Life Support',
        summary: `CO₂ ${anyPkt.cabin_co2.toFixed(1)} mmHg (limit: 3.0)`,
        age: '< 10m',
        trend: 'WORSENING',
        trajectory: 'WORSENING',
        timeToLimit: '~11 min to 3.0 mmHg flight rule limit',
        evidenceStrength: 'HIGH',
        signalsCount: 3,
        acknowledged: !!acked['ENV-CO2'],
        observed: [`Cabin CO₂: ${anyPkt.cabin_co2.toFixed(2)} mmHg`, 'Measured by onboard NDIR sensor (simulated)'],
        derived: [`${((anyPkt.cabin_co2 - 1.8) / 1.8 * 100).toFixed(0)}% above nominal mean (1.8 mmHg)`],
        correlated: ['Scrubber performance degradation pattern', 'All crew present in habitation module'],
        possibleFactors: ['CO₂ scrubber bed saturation', 'Reduced ventilation mixing', 'Crew exertion with closed hatches'],
        actionsToEvaluate: [
          'Switch to backup CO₂ scrubber bed',
          'Increase ventilation fan speed',
          'Direct crew to report headache or cognitive symptoms',
        ],
        procedure: 'NASA-STD-3001-ECLSS-CO2-01',
        confidence: 'HIGH evidence strength · direct sensor telemetry',
        provenance: 'Environmental telemetry · NASA OCHMO CO₂ Technical Brief',
        evidence: `CO₂: ${anyPkt.cabin_co2.toFixed(2)} mmHg · Threshold: 3.0 mmHg (NASA-STD-3001)`,
        baselineRef: 'Nominal cabin CO₂: 1.8 ± 0.25 mmHg (environmental_baselines)',
        timelineSequence: [
          { time: '12:50:00', delta: 'T-18m 20s', signal: 'Cabin CO₂', finding: 'Nominal baseline concentration at 1.82 mmHg', severity: 'NOMINAL' },
          { time: '13:00:15', delta: 'T-08m 05s', signal: 'CO₂ Scrubber Bed A', finding: 'Effluent sensor indicates early saturation breakthrough', severity: 'WARNING' },
          { time: '13:05:40', delta: 'T-02m 40s', signal: 'Cabin CO₂', finding: 'Exceeds NASA-STD-3001 1-hour flight rule limit (3.0 mmHg)', severity: 'WARNING' },
          { time: '13:08:20', delta: 'T+00m 00s', signal: 'ECLSS Sentry', finding: 'Persistent elevation confirmed: Sentry alert generated', severity: anyPkt.cabin_co2 > 5.0 ? 'CRITICAL' : 'WARNING' },
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
  }, [telemetryMap, acked]);

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
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
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
          background: isSel ? 'rgba(56, 189, 248, 0.16)' : 'rgba(14, 18, 24, 0.65)',
          border: isSel ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: 5,
          padding: '7px 16px',
          color: isSel ? '#ffffff' : '#b8cbde',
          fontSize: 11,
          fontWeight: isSel ? 700 : 500,
          cursor: 'pointer',
          fontFamily: T.sans,
          letterSpacing: '0.04em',
          boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.20), 0 2px 8px rgba(0, 0, 0, 0.45)' : 'none',
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
        <div style={{ ...cardStyle, padding: '10px 14px', background: 'linear-gradient(180deg, #181d22 0%, #0f1216 100%)' }}>
          {/* Active Incident Dominant Banner */}
          {hasAnomaly && primaryAlert ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 10,
              borderBottom: `1px solid ${T.borderSubtle}`,
              marginBottom: 9,
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge color={severityColor(primaryAlert.priority)} borderColor={severityBorder(primaryAlert.priority)} bg="#140808">
                  ● ACTIVE {primaryAlert.priority}
                </Badge>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, fontFamily: T.sans }}>
                      {primaryAlert.entity} — {primaryAlert.summary}
                    </span>
                    <span style={{ fontSize: 10, color: severityColor(primaryAlert.priority), fontFamily: T.mono, fontWeight: 600 }}>
                      [ {primaryAlert.trajectory} · RATE: +2.4 bpm/min ]
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>Duration: <strong style={{ color: T.textPrimary, fontFamily: T.mono }}>{primaryAlert.age}</strong></span>
                    <span>·</span>
                    <span>Primary Signal: <strong style={{ color: T.warning, fontFamily: T.mono }}>HR 108 bpm (+31.7% from base 82)</strong></span>
                    <span>·</span>
                    <span>ECLSS Environment: <strong style={{ color: T.nominal, fontFamily: T.mono }}>Nominal (CO₂ {co2Val.toFixed(2)} mmHg)</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => { setSelEventId(primaryAlert.id); setTab('INVESTIGATE'); }}
                  style={{
                    background: 'linear-gradient(180deg, #2b3642 0%, #1a222a 100%)',
                    border: '1px solid #4a5b6e',
                    borderRadius: 4,
                    padding: '5px 12px',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: T.sans,
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>INVESTIGATE EXCURSION</span>
                  <span style={{ fontSize: 12 }}>→</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 8,
              borderBottom: `1px solid ${T.borderSubtle}`,
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dot color={T.nominal} size={7} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.nominal, letterSpacing: '0.06em' }}>
                  MISSION HEALTH: NOMINAL · ALL 4 CREW MEMBERS WITHIN STABLE ENVELOPES · HABITAT OPTIMAL
                </span>
              </div>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textMuted }}>AUTONOMOUS SENTRY PASS 84 · MARGINS &gt; 70 DAYS</span>
            </div>
          )}

          {/* Subsystem & Communications Synoptic Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dot color={hasAnomaly ? T.warning : T.nominal} size={6} />
              <span style={{ fontSize: 10, color: T.textSecondary }}>CREW HEALTH:</span>
              <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 600, color: hasAnomaly ? T.warning : T.nominal }}>
                {hasAnomaly ? '1 ATTENTION / 3 NOM' : '4/4 NOMINAL'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dot color={co2Val > 3.0 ? T.warning : T.nominal} size={6} />
              <span style={{ fontSize: 10, color: T.textSecondary }}>ECLSS HABITAT:</span>
              <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 600, color: co2Val > 3.0 ? T.warning : T.nominal }}>
                101.3 kPa · CO₂ {co2Val.toFixed(2)} mmHg
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dot color={T.nominal} size={6} />
              <span style={{ fontSize: 10, color: T.textSecondary }}>POWER &amp; THERMAL:</span>
              <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 600, color: T.nominal }}>
                EPS 28.4V · 21.4°C
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <Dot color={activeDSN.snr > 30 ? T.nominal : T.warning} size={6} />
              <span style={{ fontSize: 10, color: T.textSecondary }}>DSN {activeDSN.name.split(' ')[0]}:</span>
              <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 600, color: T.textPrimary }}>
                {prop.owFmt} OWLT · 10 Hz Lock
              </span>
            </div>
          </div>
        </div>

        {/* ─── 2. CABIN ECLSS ENVIRONMENTAL TELEMETRY RIBBON ─── */}
        <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.borderSubtle}` }}>
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

        {/* ─── 4. EXTRA OPERATIONAL GRAPHS: LONGITUDINAL TRAJECTORY & 24H ECLSS HABITAT ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14 }}>
          {/* Graph 1: Mission Longitudinal Trajectory (Flight Day 01 -> Today FD-184) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={labelStyle}>Mission Longitudinal Trajectory // Flight Day 01 → Today (FD-184)</div>
                <div style={{ fontSize: 10, color: T.textSecondary }}>
                  Resting Cardiovascular Baseline Drift &amp; Cumulative Space Radiation Exposure
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 9, fontFamily: T.mono }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 2, background: '#5ebd4c', display: 'inline-block' }} />
                  <span style={{ color: '#b8cbde' }}>Resting HR (bpm)</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 2, background: '#e6a83c', display: 'inline-block' }} />
                  <span style={{ color: '#b8cbde' }}>Cumul. Rad (mSv)</span>
                </span>
              </div>
            </div>

            {/* SVG Longitudinal Graph Container */}
            <div style={{ position: 'relative', width: '100%', height: 185, background: '#090c0f', borderRadius: 4, border: `1px solid ${T.borderSubtle}`, overflow: 'hidden' }}>
              <svg viewBox="0 0 540 185" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                <defs>
                  <linearGradient id="radAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e6a83c" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#e6a83c" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="hrAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5ebd4c" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#5ebd4c" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference grid lines */}
                <line x1="40" y1="35" x2="520" y2="35" stroke="#1f2732" strokeWidth="0.8" />
                <line x1="40" y1="75" x2="520" y2="75" stroke="#1f2732" strokeWidth="0.8" />
                <line x1="40" y1="115" x2="520" y2="115" stroke="#1f2732" strokeWidth="0.8" />
                <line x1="40" y1="155" x2="520" y2="155" stroke="#25303e" strokeWidth="1" />

                {/* NASA Career Permissible Limit Line (Red Dashed) */}
                <line x1="40" y1="35" x2="520" y2="35" stroke="#ff4d4d" strokeWidth="1" strokeDasharray="4,4" />
                <text x="44" y="30" fill="#ff7070" fontSize="8" fontFamily={T.mono} fontWeight="bold">
                  NASA CAREER PERMISSIBLE LIMIT (600 mSv)
                </text>

                {/* Mission Milestones Vertical Guidelines */}
                <line x1="85" y1="20" x2="85" y2="155" stroke="#2a3545" strokeWidth="0.8" strokeDasharray="2,2" />
                <text x="85" y="166" fill="#849db5" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">FD-04 TLI</text>

                <line x1="140" y1="20" x2="140" y2="155" stroke="#2a3545" strokeWidth="0.8" strokeDasharray="2,2" />
                <text x="140" y="166" fill="#849db5" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">LUNAR FLYBY</text>

                <line x1="225" y1="20" x2="225" y2="155" stroke="#e6a83c" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6" />
                <text x="225" y="166" fill="#e6a83c" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">SPE FLARE</text>

                <line x1="360" y1="20" x2="360" y2="155" stroke="#2a3545" strokeWidth="0.8" strokeDasharray="2,2" />
                <text x="360" y="166" fill="#849db5" fontSize="7.5" fontFamily={T.mono} textAnchor="middle">DEEP TRANSIT</text>

                <line x1="515" y1="20" x2="515" y2="155" stroke="#5ebd4c" strokeWidth="1.2" />
                <text x="515" y="166" fill="#5ebd4c" fontSize="8" fontFamily={T.mono} textAnchor="middle" fontWeight="bold">TODAY (FD-184)</text>

                {/* 1. Cumulative Radiation Shaded Area & Curve (0 mSv -> 142.4 mSv) */}
                <polygon
                  fill="url(#radAreaGrad)"
                  points="40,155 85,152 140,147 225,138 230,129 360,118 450,112 515,108 515,155"
                />
                <polyline
                  fill="none"
                  stroke="#e6a83c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="40,155 85,152 140,147 225,138 230,129 360,118 450,112 515,108"
                />
                <circle cx="515" cy="108" r="3" fill="#e6a83c" />

                {/* 2. Resting HR Adaptation Curve (65 bpm -> 78 bpm fluid shift -> 64 -> 68.2 bpm) */}
                <polygon
                  fill="url(#hrAreaGrad)"
                  points="40,155 60,105 85,92 110,120 140,128 225,124 360,120 450,116 515,114 515,155"
                />
                <polyline
                  fill="none"
                  stroke="#5ebd4c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="40,125 60,105 85,92 110,120 140,128 225,124 360,120 450,116 515,114"
                />
                <circle cx="515" cy="114" r="3" fill="#5ebd4c" />

                {/* Axis Left Labels (HR bpm) */}
                <text x="34" y="38" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">85 bpm</text>
                <text x="34" y="78" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">75 bpm</text>
                <text x="34" y="118" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">65 bpm</text>
                <text x="34" y="157" fill="#849db5" fontSize="7" fontFamily={T.mono} textAnchor="end">55 bpm</text>

                {/* Callout markers on today point */}
                <rect x="420" y="85" width="92" height="18" rx="3" fill="#141920" stroke="#e6a83c" strokeWidth="0.8" />
                <text x="424" y="97" fill="#e6a83c" fontSize="8" fontFamily={T.mono} fontWeight="bold">Dose: 142.4 mSv</text>

                <rect x="420" y="122" width="92" height="18" rx="3" fill="#141920" stroke="#5ebd4c" strokeWidth="0.8" />
                <text x="424" y="134" fill="#5ebd4c" fontSize="8" fontFamily={T.mono} fontWeight="bold">Rest HR: 68 bpm</text>
              </svg>
            </div>

            {/* Trajectory Insights Footer */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${T.borderSubtle}` }}>
              <div>
                <div style={{ fontSize: 9, color: T.textMuted }}>Cumulative Exposure</div>
                <div style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: '#e6a83c' }}>142.4 mSv</div>
                <div style={{ fontSize: 8.5, color: T.nominal }}>Margin: +457.6 mSv (Safe)</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textMuted }}>Cardiovascular Drift</div>
                <div style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: '#5ebd4c' }}>+4.2 bpm (+6.4%)</div>
                <div style={{ fontSize: 8.5, color: T.textMuted }}>Cephalic fluid shift stabilized</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textMuted }}>Mission Elapsed Timeline</div>
                <div style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: T.textPrimary }}>FD-184 / 310d</div>
                <div style={{ fontSize: 8.5, color: T.textMuted }}>Phase: Mars Transfer Orbit</div>
              </div>
            </div>
          </div>

          {/* Graph 2: Continuous 24-Hour ECLSS Cabin Habitat Multi-Channel Graph */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={labelStyle}>Continuous 24-Hour ECLSS Cabin Habitat Multi-Channel Graph</div>
                <div style={{ fontSize: 10, color: T.textSecondary }}>
                  Atmospheric Pressure, Carbon Dioxide (ppCO₂), Oxygen &amp; Thermal Balance
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 8.5, fontFamily: T.mono }}>
                <span style={{ color: '#5ebd4c' }}>Press: 101.3 kPa</span>
                <span style={{ color: '#e6a83c' }}>CO₂: {co2Val.toFixed(2)} mmHg</span>
                <span style={{ color: '#7ea4cb' }}>O₂: 21.3 kPa</span>
              </div>
            </div>

            {/* SVG 24-Hour ECLSS Graph */}
            <div style={{ position: 'relative', width: '100%', height: 185, background: '#090c0f', borderRadius: 4, border: `1px solid ${T.borderSubtle}`, overflow: 'hidden' }}>
              <svg viewBox="0 0 500 185" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                {/* Horizontal reference lines */}
                <line x1="30" y1="35" x2="480" y2="35" stroke="#1f2732" strokeWidth="0.8" />
                <line x1="30" y1="75" x2="480" y2="75" stroke="#1f2732" strokeWidth="0.8" />
                <line x1="30" y1="115" x2="480" y2="115" stroke="#1f2732" strokeWidth="0.8" />
                <line x1="30" y1="155" x2="480" y2="155" stroke="#25303e" strokeWidth="1" />

                {/* NASA Flight Rule Limit: ppCO2 3.0 mmHg (Red Dashed) */}
                <line x1="30" y1="52" x2="480" y2="52" stroke="#ff4d4d" strokeWidth="1" strokeDasharray="3,3" />
                <text x="34" y="47" fill="#ff7070" fontSize="7.5" fontFamily={T.mono} fontWeight="bold">
                  NASA-STD-3001 1-HOUR CO₂ FLIGHT RULE LIMIT (3.00 mmHg)
                </text>

                {/* 1. Cabin Total Pressure (101.3 kPa - Steady Green Line) */}
                <line x1="30" y1="35" x2="480" y2="35" stroke="#5ebd4c" strokeWidth="1.8" />
                <circle cx="480" cy="35" r="2.5" fill="#5ebd4c" />

                {/* 2. Partial Pressure O2 (21.3 kPa - Cyan Line) */}
                <polyline
                  fill="none"
                  stroke="#7ea4cb"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  points="30,80 120,79 220,80 320,79 410,80 480,80"
                />

                {/* 3. Partial Pressure CO2 (Amber curve with transient workout bump) */}
                <polyline
                  fill="none"
                  stroke="#e6a83c"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="30,115 100,114 180,112 260,98 320,90 390,102 450,110 480,111"
                />
                <circle cx="480" cy="111" r="2.5" fill="#e6a83c" />

                {/* Time Axis Markers */}
                <text x="30" y="168" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-24h</text>
                <text x="140" y="168" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-18h</text>
                <text x="250" y="168" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-12h</text>
                <text x="360" y="168" fill="#849db5" fontSize="7.5" fontFamily={T.mono}>T-6h</text>
                <text x="475" y="168" fill="#5ebd4c" fontSize="7.5" fontFamily={T.mono} textAnchor="end" fontWeight="bold">NOW</text>
              </svg>
            </div>

            {/* Environmental Verdict Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: `1px solid ${T.borderSubtle}` }}>
              <div style={{ fontSize: 9.5, color: T.nominal, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>✓</span>
                <span>ECLSS PASS: Cabin atmosphere nominal. No hypoxic or toxic decompress transients.</span>
              </div>
              <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>Margin to CO₂ Limit: +1.18 mmHg</span>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────────────────────────
  // CREW TAB — NASA MCC 4-COLUMN DECISION DASHBOARD (OPTION 2)
  // ─────────────────────────────────────────────────────────────
  const renderCrew = () => {
    const selCrew = CREW.find(c => c.id === selCrewId) || CREW[1]; // Default to CREW-02 Pilot

    // Compute crew member stats dynamically matching NASA MCC reference & live telemetry
    const getStats = (c: typeof CREW[number]) => {
      const p = telemetryMap[c.id];
      const isPlt = c.id === 'AST-02_PILOT';
      const isCdr = c.id === 'AST-01_COMMANDER';
      const isMs1 = c.id === 'AST-03_MEDICAL';
      const isMs2 = c.id === 'AST-04_ENGINEER';

      // Use live telemetry if available, else exact reference values
      const hr = p && p.heart_rate > 90 ? Math.round(p.heart_rate) : (isPlt ? 108 : (p ? Math.round(p.heart_rate) : (isCdr ? 68 : isMs1 ? 74 : 70)));
      const spo2 = p && p.spo2 < 97 ? p.spo2 : (isPlt ? 96.0 : (p ? p.spo2 : (isMs1 ? 99.0 : c.baseSpo2)));
      const resp = isPlt ? (p ? Math.round(14 * (p.heart_rate / 82)) : 18) : (isMs1 ? 15 : isMs2 ? 13 : c.baseResp);
      const temp = p && p.core_temp > 37.0 ? p.core_temp : (isPlt ? 37.1 : (p ? p.core_temp : (isCdr ? 36.6 : isMs1 ? 36.8 : 36.4)));
      const hrv = p ? p.hrv_rmssd : (isPlt ? 38 : c.baseHrv);
      const workload = isPlt ? 0.82 : 0.24;

      const hrDeltaPct = ((hr - c.baseHr) / c.baseHr) * 100;
      const spo2DeltaPct = ((spo2 - c.baseSpo2) / c.baseSpo2) * 100;
      const respDeltaPct = ((resp - c.baseResp) / c.baseResp) * 100;
      const tempDeltaAbs = temp - c.baseTemp;

      const rawSev = p?.evaluated_severity;
      const isAnomaly = isPlt || (p && (rawSev === 'CRITICAL' || rawSev === 'WARNING'));
      const status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = isAnomaly
        ? (isPlt ? 'WARNING' : (rawSev === 'CRITICAL' ? 'CRITICAL' : 'WARNING'))
        : 'NOMINAL';
      const statusLabel = isAnomaly ? '↑ At Risk' : 'Nominal';

      return {
        hr,
        spo2,
        resp,
        temp,
        hrv,
        workload,
        hrDeltaPct,
        spo2DeltaPct,
        respDeltaPct,
        tempDeltaAbs,
        status,
        statusLabel,
        isAnomaly,
      };
    };

    const selStats = getStats(selCrew);

    // Trend series (Last 2 Hours) for the selected astronaut
    const hrTrendData = selCrew.id === 'AST-02_PILOT'
      ? [81, 82, 80, 83, 82, 85, 89, 95, 102, 106, 108]
      : [selCrew.baseHr - 1, selCrew.baseHr + 1, selCrew.baseHr, selCrew.baseHr - 2, selCrew.baseHr, selCrew.baseHr + 1, selCrew.baseHr - 1, selCrew.baseHr, selStats.hr, selStats.hr];

    const spo2TrendData = selCrew.id === 'AST-02_PILOT'
      ? [98.2, 98.0, 98.1, 98.0, 97.8, 97.6, 97.2, 96.8, 96.5, 96.2, 96.0]
      : [selCrew.baseSpo2, selCrew.baseSpo2 + 0.1, selCrew.baseSpo2, selCrew.baseSpo2 - 0.1, selCrew.baseSpo2, selStats.spo2];

    const respTrendData = selCrew.id === 'AST-02_PILOT'
      ? [14, 14, 13, 14, 14, 15, 15, 16, 17, 18, 18]
      : [selCrew.baseResp, selCrew.baseResp, selCrew.baseResp - 1, selCrew.baseResp, selCrew.baseResp, selStats.resp];

    const tempTrendData = selCrew.id === 'AST-02_PILOT'
      ? [36.4, 36.4, 36.5, 36.5, 36.5, 36.6, 36.7, 36.8, 36.9, 37.0, 37.1]
      : [selCrew.baseTemp, selCrew.baseTemp, selCrew.baseTemp + 0.1, selCrew.baseTemp, selStats.temp];

    // Sparkline micro-series
    const sparkHr = selCrew.id === 'AST-02_PILOT' ? [82, 85, 89, 96, 104, 108] : [76, 78, 77, 79, 78];
    const sparkSpo2 = selCrew.id === 'AST-02_PILOT' ? [98.2, 97.8, 97.2, 96.6, 96.0] : [98.0, 98.2, 98.1, 98.4];
    const sparkResp = selCrew.id === 'AST-02_PILOT' ? [14, 14, 15, 17, 18] : [14, 14, 13, 14];
    const sparkTemp = selCrew.id === 'AST-02_PILOT' ? [36.4, 36.5, 36.7, 36.9, 37.1] : [36.6, 36.6, 36.7, 36.6];
    const sparkWork = selCrew.id === 'AST-02_PILOT' ? [0.35, 0.45, 0.62, 0.74, 0.82] : [0.22, 0.24, 0.25, 0.24];

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
              <span style={{ fontSize: 11 }}>⚡</span>
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

        {/* ─── 2. Top 4 Astronaut Cards (Identical to Reference Image) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {CREW.map(c => {
            const stats = getStats(c);
            const isSelected = c.id === selCrewId;

            return (
              <div
                key={c.id}
                onClick={() => setSelCrewId(c.id)}
                style={{
                  background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'linear-gradient(180deg, #171c21 0%, #101317 100%)',
                  border: isSelected ? '1.5px solid rgba(56, 189, 248, 0.75)' : `1px solid ${stats.isAnomaly ? T.warningBorder : 'rgba(255, 255, 255, 0.16)'}`,
                  borderRadius: 6,
                  padding: '10px 11px',
                  cursor: 'pointer',
                  transition: 'all 0.14s ease',
                  boxShadow: isSelected ? '0 3px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)' : 'none',
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

        {/* ─── 3. Sub-Navigation Ribbon (Tabs) with Increased Border Opacity & Low-Opacity Solid Selected Color ─── */}
        <div style={{
          display: 'flex',
          gap: 6,
          background: 'rgba(10, 14, 18, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          padding: '5px 6px',
          borderRadius: 7,
          marginTop: 6,
          marginBottom: 10,
          flexWrap: 'wrap',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
        }}>
          {(['Overview', '3D Bio-Scanner', 'Trends', 'Correlation', 'Baseline & Deviation', 'Medical History', 'Procedures'] as const).map(sub => {
            const isSel = crewSubTab === sub;
            return (
              <button
                key={sub}
                onClick={() => setCrewSubTab(sub)}
                style={{
                  background: isSel ? 'rgba(56, 189, 248, 0.16)' : 'rgba(14, 18, 24, 0.65)',
                  border: isSel ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(255, 255, 255, 0.16)',
                  color: isSel ? '#ffffff' : '#b0c5dc',
                  borderRadius: 4,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.20), 0 2px 6px rgba(0, 0, 0, 0.35)' : 'none',
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
                    <span style={{ fontSize: 12 }}>{selStats.isAnomaly ? '⚠️' : '✓'}</span>
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
                        {selStats.workload > 0.6 ? 'High (0.82)' : 'Nominal (0.24)'}
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

              {/* ──── COLUMN 3: Event Correlation & Linked Factors ──── */}
              <div style={cardStyle}>
                <div style={labelStyle}>Event Correlation</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 8 }}>Chronological Multi-Signal Timeline</div>

                {/* Timeline Step Sequence */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', paddingLeft: 12 }}>
                  {/* Vertical line connector */}
                  <div style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 1, background: '#252c34' }} />

                  {selStats.isAnomaly ? [
                    { time: '14:32:10', sig: 'Heart Rate ↑', note: '82 → 108 bpm (+31.7% deviation above baseline)', sev: 'WARNING' },
                    { time: '14:32:14', sig: 'Respiration ↑', note: '14 → 18 br/min (compensatory hyperventilation)', sev: 'WARNING' },
                    { time: '14:32:18', sig: 'SpO₂ ↓', note: '98.0% → 96.0% (mild desaturation trend)', sev: 'WARNING' },
                    { time: '14:32:25', sig: 'Workload ↑', note: 'Physical strain spike detected (PSI 5.8)', sev: 'INFO' },
                    { time: '14:32:31', sig: 'Temperature ↑', note: 'Core thermal rise: 36.4°C → 37.1°C', sev: 'INFO' },
                  ].map((step, idx) => (
                    <div key={idx} style={{ position: 'relative', background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '5px 7px' }}>
                      <span style={{ position: 'absolute', left: -12, top: 8, width: 7, height: 7, borderRadius: '50%', background: severityColor(step.sev), border: '1px solid #000' }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>{step.time}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: severityColor(step.sev) }}>{step.sig}</span>
                      </div>
                      <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2, lineHeight: 1.25 }}>{step.note}</div>
                    </div>
                  )) : (
                    [
                      { time: '14:10:00', sig: 'Heart Rate →', note: 'Baseline steady 68-72 bpm', sev: 'NOMINAL' },
                      { time: '13:45:00', sig: 'Airflow Nominal', note: 'Suit loop circulation verified', sev: 'NOMINAL' },
                      { time: '13:00:00', sig: 'Shift Handover Nominal', note: 'Watch duty rotation logged', sev: 'NOMINAL' },
                    ].map((step, idx) => (
                      <div key={idx} style={{ position: 'relative', background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '5px 7px' }}>
                        <span style={{ position: 'absolute', left: -12, top: 8, width: 7, height: 7, borderRadius: '50%', background: T.nominal, border: '1px solid #000' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>{step.time}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.nominal }}>{step.sig}</span>
                        </div>
                        <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2 }}>{step.note}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Possible Linked Factors */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ ...labelStyle, marginBottom: 5 }}>Possible Linked Factors</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { icon: '⚡', title: 'High Physical Exertion', sub: 'Active exercise / EVA preparation protocol' },
                      { icon: '⚡', title: 'Thermal Regulation Stress', sub: 'Cabin airflow transition zone (+0.4°C hab)' },
                      { icon: '⚡', title: 'Elevated Cabin CO₂', sub: 'CO₂ 2.1 mmHg transient during workout' },
                      { icon: '⚡', title: 'Autonomic Fatigue', sub: 'Cumulative mission day 14 sleep debt' },
                    ].map((f, i) => (
                      <div key={i} style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '5px 7px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: T.warning }}>{f.icon}</span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: T.textPrimary }}>{f.title}</div>
                          <div style={{ fontSize: 8, color: T.textMuted }}>{f.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ──── COLUMN 4: Why is this flagged? & Decision Support ──── */}
              <div style={cardStyle}>
                <div style={labelStyle}>Why is this flagged?</div>

                {/* Detection Rationale List */}
                <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '7px 9px', marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9, color: T.textSecondary, lineHeight: 1.35 }}>
                    <div>• Sustained HR elevation &gt;25% above resting baseline for &gt;15 min</div>
                    <div>• Synchronized respiratory rate increase with mild desaturation</div>
                    <div>• Deviation exceeds 2.5σ standard deviation envelope</div>
                    <div>• Moran Strain Index crossed caution threshold (5.8/10)</div>
                  </div>
                </div>

                {/* Circular Confidence Gauge */}
                <div style={{ marginTop: 10, padding: '8px 0', borderTop: `1px solid ${T.borderSubtle}`, borderBottom: `1px solid ${T.borderSubtle}` }}>
                  <CircularGauge pct={selStats.isAnomaly ? 92 : 98} label="Multi-Signal Confidence" color={selStats.isAnomaly ? T.warning : T.nominal} size={76} />
                </div>

                {/* Decision Support & Protocol Box */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ ...labelStyle, marginBottom: 4 }}>Decision Support</div>
                  <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.4 }}>
                    <div><strong style={{ color: T.textPrimary }}>Condition:</strong> {selStats.isAnomaly ? 'Moderate Cardiovascular Anomaly' : 'Nominal Baseline Equilibrium'}</div>
                    <div><strong style={{ color: T.textPrimary }}>Trajectory:</strong> {selStats.isAnomaly ? 'Increasing ↗' : 'Stable →'}</div>
                    <div><strong style={{ color: T.textPrimary }}>Time to Threshold:</strong> {selStats.isAnomaly ? '11 min' : 'Nominal'}</div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', marginBottom: 3 }}>Suggested Checks</div>
                    <div style={{ fontSize: 9, color: T.textSecondary, lineHeight: 1.35 }}>
                      1. Direct crew member to reduce physical workload<br />
                      2. Increase suit/cabin airflow cooling by +15%<br />
                      3. Verify oral electrolyte hydration packet intake<br />
                      4. Monitor 12-lead ECG rhythm on next DSN pass
                    </div>
                  </div>

                  {/* Flight Procedure Action Button */}
                  <button
                    onClick={() => setActiveProcedureId('M-204')}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      background: '#151b22',
                      border: `1px solid ${T.activeBorder}`,
                      borderRadius: 4,
                      padding: '7px 10px',
                      color: '#cad5e2',
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
                    <span>📖</span> Open Procedure: M-204 →
                  </button>

                  {onOpenTriage && (
                    <button
                      onClick={() => onOpenTriage(selCrew.id)}
                      style={{
                        marginTop: 6,
                        width: '100%',
                        background: '#101419',
                        border: `1px solid ${T.borderSubtle}`,
                        borderRadius: 4,
                        padding: '6px 10px',
                        color: T.textSecondary,
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
                      <span>🩺</span> Open Clinical Telemetry Console →
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

                  {/* Anomaly Pin Marker at 14:32 */}
                  <div style={{
                    position: 'absolute',
                    left: '21.5%',
                    top: -12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 8, fontFamily: T.mono, color: T.critical, background: '#140808', border: `1px solid ${T.criticalBorder}`, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                      ⚠️ 14:32 (PLT Anomaly)
                    </span>
                    <span style={{ width: 1.5, height: 32, background: T.critical, marginTop: 1 }} />
                  </div>

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
                      ▲ NOW 14:35
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
                    <span style={{ color: T.critical }}>⚠️ Anomaly Pin</span>
                  </div>
                </div>
              </div>

              {/* Recent Events Log Table */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={labelStyle}>Recent Events Log</div>
                  <span style={{ fontSize: 9, color: T.textMuted }}>UTC Time Order</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px 65px', gap: 6, padding: '5px 0', borderBottom: '1px solid #233140', fontSize: 9, color: '#9ec7ef', fontWeight: 700 }}>
                  <span>TIME</span>
                  <span>EVENT</span>
                  <span>SYSTEM</span>
                  <span style={{ textAlign: 'right' }}>PRIORITY</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                  {[
                    { time: '14:32:10', event: 'HR excursion (+31.7%)', sys: 'Cardio', prio: 'CRITICAL' },
                    { time: '14:32:18', event: 'SpO₂ drop to 96.0%', sys: 'Resp', prio: 'WARNING' },
                    { time: '14:25:00', event: 'Workload transition High', sys: 'Ops', prio: 'INFO' },
                    { time: '13:45:22', event: 'EVA airlock repress nominal', sys: 'ECLSS', prio: 'NOMINAL' },
                    { time: '13:00:00', event: 'Exercise cycle initiated', sys: 'Bio', prio: 'NOMINAL' },
                  ].map((row, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px 65px', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid #1a222c`, fontSize: 9 }}>
                      <span style={{ fontFamily: T.mono, color: '#9bb1c7' }}>{row.time}</span>
                      <span style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{row.event}</span>
                      <span style={{ color: '#c5d5e5' }}>{row.sys}</span>
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

        {/* ─── 4c. Correlation Sub-Tab (Cross-Signal Pearson Correlation) ─── */}
        {crewSubTab === 'Correlation' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Cross-Signal Correlation Matrix (Pearson r)</div>
            <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 10 }}>
              Calculated across 720 temporal points (2-hour rolling window). Strong correlation (|r| &gt; 0.70) indicates coupled physiological strain.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { pair: 'HR vs Workload', r: '+0.88', desc: 'Strong positive correlation — physical exertion driven', sig: 'HIGH' },
                { pair: 'HR vs HRV (RMSSD)', r: '-0.79', desc: 'Sympathetic dominance / autonomic decay confirmed', sig: 'HIGH' },
                { pair: 'HR vs SpO₂', r: '-0.64', desc: 'Moderate inverse coupling — desaturation on exertion', sig: 'MODERATE' },
                { pair: 'Resp vs Workload', r: '+0.82', desc: 'Hyperventilation response tracking metabolic demand', sig: 'HIGH' },
                { pair: 'Core Temp vs HR', r: '+0.71', desc: 'Thermal strain coupling (Moran PSI 5.8)', sig: 'HIGH' },
                { pair: 'Cabin CO₂ vs Resp', r: '+0.44', desc: 'Mild hypercapnic compensatory drive', sig: 'LOW' },
              ].map((c, i) => (
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
        )}

        {/* ─── 4d. Baseline & Deviation Sub-Tab ─── */}
        {crewSubTab === 'Baseline & Deviation' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Statistical Variance & Baseline Deviation Envelope</div>
            <div style={{ fontSize: 10, color: T.textSecondary, marginBottom: 10 }}>
              Comparison against Inspiration4 OSDR (OSD-575/569) cohort baseline distributions.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>Heart Rate Deviation Distribution</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • Resting Mean (μ): {selCrew.baseHr} bpm · Standard Deviation (σ): 4.8 bpm<br />
                  • Current Value: {selStats.hr} bpm<br />
                  • Z-Score: {((selStats.hr - selCrew.baseHr) / 4.8).toFixed(2)}σ ({selStats.hrDeltaPct > 20 ? 'CRITICAL EXCURSION > 3σ' : 'NOMINAL < 1σ'})<br />
                  • Cumulative Time Above 2σ: 18 minutes
                </div>
              </div>
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>SpO₂ Peripheral Envelope</div>
                <div style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.5 }}>
                  • Resting Mean (μ): {selCrew.baseSpo2.toFixed(1)}% · Standard Deviation (σ): 0.6%<br />
                  • Current Value: {selStats.spo2.toFixed(1)}%<br />
                  • Z-Score: {((selStats.spo2 - selCrew.baseSpo2) / 0.6).toFixed(2)}σ<br />
                  • Lower Warning Gate: 95.0% (Current margin: +{(selStats.spo2 - 95.0).toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4e. Medical History Sub-Tab ─── */}
        {crewSubTab === 'Medical History' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Astronaut Medical Dossier & Flight Certification</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Clinical Profile</div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                  • Age / Flight Exp: 38 yr · 2 Missions (Artemis II, ISS Expedition 71)<br />
                  • Resting Blood Pressure: {selCrew.baseBp} mmHg<br />
                  • VO₂ Max: 52.4 mL/kg/min (Superior)<br />
                  • Allergy / Sensitivities: NKDA
                </div>
              </div>
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>G-Tolerance & Microgravity</div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                  • Centrifuge Tolerance: +8.5 Gz without GLOC<br />
                  • Space Motion Sickness: Resolved (Day 2)<br />
                  • Bone Density (DEXA): Baseline verified<br />
                  • Countermeasure Compliance: 100% (ARED / T2)
                </div>
              </div>
              <div style={{ background: '#0a0d11', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Cumulative Mission Exposure</div>
                <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                  • Radiation Absorbed Dose: 14.2 mGy (Career margin: 89%)<br />
                  • Total Cumulative EVA Time: 14h 28m<br />
                  • Sentry Matrix Surveillance: Active (Channel 2 locked)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 4f. Procedures Sub-Tab ─── */}
        {crewSubTab === 'Procedures' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={labelStyle}>Flight Operational Procedures & Countermeasure Cards</div>
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
  // SYSTEMS TAB — SPACECRAFT HEALTH-CRITICAL SYSTEMS & DEVICE CATALOG
  // ─────────────────────────────────────────────────────────────
  const renderSystems = () => {
    const pkt = Object.values(telemetryMap)[0];
    const co2 = pkt?.cabin_co2 || 1.82;
    const hrVal = pkt?.heart_rate ? Math.round(pkt.heart_rate) : 78;
    const spo2Val = pkt?.spo2 || 98.0;
    const tempVal = pkt?.core_temp || 36.6;
    const hrvVal = pkt?.hrv_rmssd ? Math.round(pkt.hrv_rmssd) : 65;
    const qtcVal = pkt?.computed_qtc || 402;
    const kVal = pkt?.potassium || 4.40;
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
      usageDescription: string;
      status: 'NOMINAL' | 'MONITOR' | 'CALIBRATED' | 'STREAMING' | 'ARMED';
      telemetryMode: 'CONTINUOUS 10 Hz' | 'PERIODIC LAB' | 'ON-DEMAND';
      lastSync: string;
      metrics: SystemMetricItem[];
    }

    // 16 Installed Spacecraft Health-Critical Systems with Concise Operational Roles
    const spacecraftSystems: SpacecraftSystemItem[] = [
      {
        id: 'SYS-ECLSS-01',
        name: 'Orion ECLSS Atmospheric Pressure & Gas Assembly (PCA)',
        acronym: 'ECLSS-PCA',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Service Module · Rack-01',
        hwRef: 'NASA-PCA-BL-401',
        usageDescription: 'Two-gas O₂/N₂ pressure regulation (101.3 kPa / 14.7 psi) · Hypoxia prevention & automatic depressurization isolation.',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.2s ago',
        metrics: [
          { param: 'Cabin Total Pressure', value: '101.3', unit: 'kPa', limit: '99.0 - 103.0 kPa', margin: 'Nominal (±0.0 kPa)', trend: 'STABLE' },
          { param: 'Oxygen (ppO₂)', value: '20.9', unit: '%', limit: '19.5 - 23.0 %', margin: '+1.4% safety buffer', trend: 'STABLE' },
          { param: 'Nitrogen (ppN₂)', value: '79.2', unit: 'kPa', limit: '77.0 - 81.0 kPa', margin: 'Nominal diluent mix', trend: 'STABLE' },
          { param: 'Depressurization Rate', value: '0.00', unit: 'kPa/min', limit: '< 0.10 kPa/min', margin: 'Hull seal airtight', trend: 'SEALED' },
        ],
      },
      {
        id: 'SYS-ECLSS-02',
        name: 'Amine Regenerative CO₂ Scrubber Bed (RCRS / CDRA)',
        acronym: 'ECLSS-RCRS',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Hab Core · Rack-02',
        hwRef: 'RCRS-AMINE-MK2',
        usageDescription: 'Cyclic solid-amine CO₂ scrubbing · Keeps pCO₂ < 3.00 mmHg to eliminate hypercapnia, headaches & cognitive impairment.',
        status: isCo2Excursion ? 'MONITOR' : 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.2s ago',
        metrics: [
          { param: 'Cabin pCO₂', value: co2.toFixed(2), unit: 'mmHg', limit: '< 3.00 mmHg', margin: `${co2Margin > 0 ? '+' : ''}${co2Margin.toFixed(2)} mmHg margin`, trend: co2 > 2.2 ? 'ELEVATED' : 'STABLE', warning: isCo2Excursion },
          { param: 'Scrubber Bed Cycle', value: 'Bed A (Active)', unit: '', limit: 'Cycle ≤ 60 min', margin: 'Bed B desorbing', trend: 'NOMINAL' },
          { param: 'Cabin Airflow Velocity', value: '0.45', unit: 'm/s', limit: '0.30 - 0.60 m/s', margin: 'Prevents CO₂ pockets', trend: 'STABLE' },
          { param: 'Desorption Vacuum Heaters', value: '121.4', unit: '°C', limit: '115 - 130 °C', margin: 'Core regen nominal', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-ECLSS-03',
        name: 'Active Thermal Control System (ATCS Dual Internal/External Loop)',
        acronym: 'ATCS-CLIMATE',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Thermal Bay · Radiator Trunnion',
        hwRef: 'ATCS-DUAL-PUMP-V4',
        usageDescription: 'Cabin climate equilibrium (21.4°C / 48% RH) · Dual-loop water/Freon heat rejection to space radiators.',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.3s ago',
        metrics: [
          { param: 'Cabin Air Temperature', value: '21.4', unit: '°C', limit: '18.0 - 24.0 °C', margin: '+0.4°C setpoint hold', trend: 'STABLE' },
          { param: 'Relative Humidity', value: '48', unit: '%', limit: '30 - 65 %', margin: 'Comfort zone nominal', trend: 'STABLE' },
          { param: 'Internal Water Heat Loop', value: '19.8', unit: '°C', limit: '18.0 - 22.0 °C', margin: 'Metabolic sink OK', trend: 'STABLE' },
          { param: 'External Radiator Loop (Freon)', value: '-4.2', unit: '°C', limit: '-10.0 - +5.0 °C', margin: 'Space rejection normal', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-ECLSS-04',
        name: 'Potable Water Reclamation & Processing System (PWS / UPA)',
        acronym: 'ECLSS-PWS',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Hydration Bulkhead · Rack-04',
        hwRef: 'PWS-UPA-RECYCLE-V3',
        usageDescription: '98% closed-loop sweat/urine recycling into pure potable water · Iodinated antimicrobial mineral dispensing.',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.4s ago',
        metrics: [
          { param: 'Potable Clean Water Reserve', value: '284', unit: 'L', limit: 'Min > 80 L reserve', margin: '71 crew-days supply', trend: 'STABLE' },
          { param: 'Water Recovery Efficiency', value: '98.2', unit: '%', limit: 'Design > 95.0 %', margin: '+3.2% closed-loop surplus', trend: 'STABLE' },
          { param: 'Product Water Conductivity', value: '0.42', unit: 'μS/cm', limit: '< 1.00 μS/cm', margin: 'Ultra-pure reserve', trend: 'PURIFIED' },
          { param: 'Biocidal Iodine Residual', value: '1.8', unit: 'mg/L', limit: '1.0 - 3.0 mg/L', margin: 'Antimicrobial nominal', trend: 'NOMINAL' },
        ],
      },
      {
        id: 'SYS-ECLSS-05',
        name: 'Emergency Oxygen Delivery & Medical Suction System (EODS)',
        acronym: 'MED-EODS',
        category: 'ECLSS',
        categoryLabel: 'ECLSS & Atmosphere',
        compartment: 'Medical Station · Central Bulkhead',
        hwRef: 'NASA-EODS-SUCT-M1',
        usageDescription: '100% positive-pressure emergency O₂ mask delivery & airway vacuum suction for hypoxia or smoke inhalation.',
        status: 'ARMED',
        telemetryMode: 'ON-DEMAND',
        lastSync: 'Standby / Armed',
        metrics: [
          { param: '100% O₂ Emergency Reserve', value: '12.4', unit: 'MPa', limit: 'Min > 10.0 MPa', margin: '180 min positive mask', trend: 'ARMED' },
          { param: 'Medical Suction Vacuum', value: '-40', unit: 'kPa', limit: '-35 to -45 kPa', margin: 'Airway clearing ready', trend: 'STABLE' },
          { param: 'Rapid-Deploy Mask Array', value: '4 / 4', unit: 'Stowed', limit: '4 masks intact', margin: 'All crew positions covered', trend: 'LOCKED' },
          { param: 'Overpressure Relief Valve', value: 'Nominal', unit: 'Lock', limit: 'Trigger at 15.0 kPa', margin: 'Regulator locked', trend: 'SEALED' },
        ],
      },
      {
        id: 'SYS-BIO-01',
        name: 'AstroSkin / Bio-Monitor Continuous Wearable Smart Garment',
        acronym: 'WEAR-ASTROSKIN',
        category: 'WEARABLE',
        categoryLabel: 'Wearable Biometrics',
        compartment: 'Crew Smart Flight Garment',
        hwRef: 'CSA-ASTROSKIN-M4',
        usageDescription: 'Continuous biometric flight garment · Multi-lead ECG, dual-band RIP respiration & skin thermometry.',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Crew Heart Rate (Primary)', value: String(hrVal), unit: 'bpm', limit: '50 - 120 bpm (rest)', margin: 'Resting baseline nominal', trend: 'STABLE' },
          { param: 'Dual-Lead Respiration Rate', value: '15', unit: 'brpm', limit: '10 - 24 brpm', margin: 'Ventilatory drive balanced', trend: 'STABLE' },
          { param: 'Peripheral Skin Temperature', value: '33.2', unit: '°C', limit: '32.0 - 35.0 °C', margin: 'Vasomotor perfusion OK', trend: 'STABLE' },
          { param: 'Multi-Axis Inertial Load', value: '0.002', unit: 'g', limit: '< 0.05 g resting', margin: 'Microgravity stationarity', trend: 'NOMINAL' },
        ],
      },
      {
        id: 'SYS-BIO-02',
        name: 'LifeGuard / CPOD Autonomous Physiological Pod',
        acronym: 'WEAR-CPOD',
        category: 'WEARABLE',
        categoryLabel: 'Wearable Biometrics',
        compartment: 'Crew Harness · EVA Telemetry Port',
        hwRef: 'NASA-CPOD-MOD2',
        usageDescription: 'Autonomous EVA/sleep backup pod · Galvanic skin response (GSR) & sympathetic stress monitoring.',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.2s ago',
        metrics: [
          { param: 'Pulse Oximetry (SpO₂)', value: spo2Val.toFixed(1), unit: '%', limit: '≥ 95.0 %', margin: `+${(spo2Val - 95.0).toFixed(1)}% above floor`, trend: 'STABLE' },
          { param: 'Galvanic Skin Conductance', value: '4.2', unit: 'μS', limit: '1.0 - 12.0 μS', margin: 'Calm autonomic baseline', trend: 'STABLE' },
          { param: 'Mesh Telemetry SNR', value: '99.8', unit: '%', limit: '> 90.0 %', margin: 'Wireless mesh locked', trend: 'LOCKED' },
          { param: 'Pod Autonomous Battery', value: '96.4', unit: '%', limit: 'Min > 20.0 %', margin: '18.5 hours endurance', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-BIO-03',
        name: 'Wearable Cardiac Vector & Continuous 12-Lead ECG Patch',
        acronym: 'WEAR-12LEAD-ECG',
        category: 'WEARABLE',
        categoryLabel: 'Wearable Biometrics',
        compartment: 'Chest Vector Patch Dock',
        hwRef: 'CARDIO-VEC-12L',
        usageDescription: 'Continuous vector Lead-II ECG · Automated Fridericia QTc interval & arrhythmia monitoring.',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.1s ago',
        metrics: [
          { param: 'Heart Rhythm Morphology', value: 'Sinus Rhythm', unit: '', limit: 'Sinus rhythm mandatory', margin: '0 ectopics / min', trend: 'NOMINAL' },
          { param: 'Fridericia QTc Interval', value: qtcVal.toFixed(0), unit: 'ms', limit: '< 450 ms threshold', margin: `${(450 - qtcVal).toFixed(0)} ms margin`, trend: 'STABLE' },
          { param: 'HRV RMSSD Autonomic Tone', value: String(hrvVal), unit: 'ms', limit: '> 35 ms baseline', margin: 'Vagal reserve OK', trend: 'STABLE' },
          { param: 'Arrhythmogenic Risk (ARF)', value: '0.72', unit: 'Index', limit: '< 1.20 index', margin: 'Low arrhythmic risk', trend: 'NOMINAL' },
        ],
      },
      {
        id: 'SYS-BIO-04',
        name: 'Reflectance PPG & Peripheral Perfusion Sensor',
        acronym: 'WEAR-PPG-OXI',
        category: 'WEARABLE',
        categoryLabel: 'Wearable Biometrics',
        compartment: 'Forehead & Digit Optical Port',
        hwRef: 'PPG-PERF-OXI-MOD3',
        usageDescription: 'Dual-wavelength SpO₂ & perfusion index · Detects microvascular blood shifts & occult tissue hypoxia.',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.3s ago',
        metrics: [
          { param: 'Arterial Oxygen (SpO₂)', value: spo2Val.toFixed(1), unit: '%', limit: '≥ 95.0 %', margin: 'Arterial sat nominal', trend: 'STABLE' },
          { param: 'Perfusion Index (PI)', value: '3.8', unit: '%', limit: '> 1.0 % minimum', margin: 'Pulsatile flow robust', trend: 'NOMINAL' },
          { param: 'Optical Pulse Waveform', value: '1.42', unit: 'V peak', limit: '0.8 - 2.0 V', margin: 'Dicrotic notch crisp', trend: 'STABLE' },
          { param: 'Motion Optical Artifact', value: '0.02', unit: '%', limit: '< 5.0 %', margin: 'Motion cancel OK', trend: 'LOCKED' },
        ],
      },
      {
        id: 'SYS-BIO-05',
        name: 'Double-Sensor Non-Invasive Core Body Temperature Monitor (T-Mini)',
        acronym: 'WEAR-TMINI-CORE',
        category: 'WEARABLE',
        categoryLabel: 'Wearable Biometrics',
        compartment: 'Temporal Bone Heat-Flux Array',
        hwRef: 'TMINI-HEATFLUX-D2',
        usageDescription: 'Dual-heat-flux non-invasive thermometry · Continuous deep core temperature & space fever monitoring.',
        status: 'STREAMING',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.4s ago',
        metrics: [
          { param: 'Core Body Temperature', value: tempVal.toFixed(2), unit: '°C', limit: '36.0 - 37.8 °C', margin: 'Normothermic equilibrium', trend: 'STABLE' },
          { param: 'Thermal Drift Velocity', value: '+0.02', unit: '°C/h', limit: '< 0.25 °C/h', margin: 'Dissipation stable', trend: 'STABLE' },
          { param: 'Cutaneous Heat Flux', value: '42.8', unit: 'W/m²', limit: '30 - 65 W/m²', margin: 'Radiance normal', trend: 'NOMINAL' },
          { param: 'Sensor Thermal Coupling', value: '99.2', unit: '%', limit: '> 90.0 %', margin: 'Thermal bond tight', trend: 'LOCKED' },
        ],
      },
      {
        id: 'SYS-LAB-01',
        name: 'Point-of-Care Hematology Cell Analyzer (rHEALTH / CBC)',
        acronym: 'LAB-rHEALTH-CBC',
        category: 'LAB',
        categoryLabel: 'Clinical Lab & POC',
        compartment: 'Crew Medical Locker · Rack-03',
        hwRef: 'NASA-rHEALTH-CBC-V2',
        usageDescription: 'Point-of-care microfluidic laser cytometer · Complete blood count (WBC, RBC, PLT, HCT) for space anemia.',
        status: 'CALIBRATED',
        telemetryMode: 'PERIODIC LAB',
        lastSync: '48m ago (Lab Calibrated)',
        metrics: [
          { param: 'White Blood Cells (WBC)', value: '5.0', unit: 'k/μL', limit: '4.0 - 10.5 k/μL', margin: 'Normal immune count', trend: 'STABLE' },
          { param: 'Hematocrit (HCT)', value: '43.6', unit: '%', limit: '37.0 - 49.0 %', margin: 'RBC mass preserved', trend: 'STABLE' },
          { param: 'Platelet Count (PLT)', value: '227', unit: 'k/μL', limit: '150 - 450 k/μL', margin: 'Clotting reserve OK', trend: 'STABLE' },
          { param: 'Hemoglobin (HGB)', value: '14.7', unit: 'g/dL', limit: '13.0 - 17.5 g/dL', margin: 'Oxygen capacity OK', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-LAB-02',
        name: 'Clinical Chemistry & Electrolyte Analyzer (Piccolo Xpress CMP)',
        acronym: 'LAB-PICCOLO-CMP',
        category: 'LAB',
        categoryLabel: 'Clinical Lab & POC',
        compartment: 'Crew Medical Locker · Centrifuge',
        hwRef: 'PICCOLO-CMP-MK3',
        usageDescription: 'Centrifugal whole-blood dry-chemistry · Rapid serum electrolytes (K⁺, Na⁺), renal BUN/Cr & liver panel.',
        status: 'CALIBRATED',
        telemetryMode: 'PERIODIC LAB',
        lastSync: '48m ago (Lab Calibrated)',
        metrics: [
          { param: 'Serum Potassium (K⁺)', value: kVal.toFixed(2), unit: 'mmol/L', limit: '3.5 - 5.0 mmol/L', margin: `+${(kVal - 3.5).toFixed(2)} mmol/L safety margin`, trend: 'STABLE' },
          { param: 'Serum Sodium (Na⁺)', value: '138.0', unit: 'mmol/L', limit: '135 - 145 mmol/L', margin: 'Osmolality balanced', trend: 'STABLE' },
          { param: 'Blood Urea Nitrogen (BUN)', value: '18.0', unit: 'mg/dL', limit: '7 - 20 mg/dL', margin: 'Filtration normal', trend: 'STABLE' },
          { param: 'Serum Creatinine (Cr)', value: '1.12', unit: 'mg/dL', limit: '0.7 - 1.3 mg/dL', margin: 'eGFR > 90 normal', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-LAB-03',
        name: 'Multiplex Cytokine & Immunoassay System (71-Plex Luminex)',
        acronym: 'LAB-IMMUNO-71P',
        category: 'LAB',
        categoryLabel: 'Clinical Lab & POC',
        compartment: 'Medical Research Lab · Rack-05',
        hwRef: 'IMMUNO-71P-OSDR',
        usageDescription: '71-Plex multiplex bead cytokine assay · Systemic inflammation & latent viral reactivation profiling.',
        status: 'CALIBRATED',
        telemetryMode: 'PERIODIC LAB',
        lastSync: '48m ago (Lab Calibrated)',
        metrics: [
          { param: 'Interleukin-6 (IL-6)', value: '6.86', unit: 'pg/mL', limit: '< 12.0 pg/mL', margin: 'Inflammatory baseline', trend: 'STABLE' },
          { param: 'Tumor Necrosis Factor (TNF-α)', value: '75.8', unit: 'pg/mL', limit: '< 110.0 pg/mL', margin: 'Flight baseline normal', trend: 'STABLE' },
          { param: 'High-Sensitivity CRP', value: '1.06', unit: 'mg/L', limit: '< 3.00 mg/L', margin: 'Vascular baseline OK', trend: 'STABLE' },
          { param: 'Plasma Fibrinogen', value: '260', unit: 'mg/dL', limit: '200 - 400 mg/dL', margin: 'Coagulation normal', trend: 'STABLE' },
        ],
      },
      {
        id: 'SYS-RAD-01',
        name: 'HERA Spacecraft Radiation Network (Hybrid Electronic Radiation Assessor)',
        acronym: 'RAD-HERA-NET',
        category: 'RADIATION',
        categoryLabel: 'Radiation & Habitat',
        compartment: 'Distributed 6-Node Habitat Array',
        hwRef: 'HERA-NET-6NODE',
        usageDescription: 'Autonomous 6-node habitat radiation grid · Real-time GCR flux tracking & Solar Particle Event shelter alarm.',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.2s ago',
        metrics: [
          { param: 'Habitat Ambient Dose Rate', value: '0.04', unit: 'mSv/h', limit: '< 0.20 mSv/h (SPE trigger)', margin: 'Interplanetary quiet', trend: 'STABLE' },
          { param: 'Solar Proton Flux (>10 MeV)', value: '0.42', unit: 'p/(cm²·s·sr)', limit: '< 10.0 threshold', margin: 'Below shelter gate', trend: 'STABLE' },
          { param: 'Heavy Ion LET Peak', value: '0.8', unit: 'keV/μm', limit: '< 2.5 keV/μm', margin: 'GCR background normal', trend: 'NOMINAL' },
          { param: 'Sensor Network Active Nodes', value: '6 / 6', unit: 'Online', limit: 'Min ≥ 4 nodes active', margin: '100% volume covered', trend: 'LOCKED' },
        ],
      },
      {
        id: 'SYS-RAD-02',
        name: 'Crew Personal Active Dosimeter (CAD) & SPE Alarmer',
        acronym: 'RAD-CAD-P1',
        category: 'RADIATION',
        categoryLabel: 'Radiation & Habitat',
        compartment: 'Personal Suit Clip-On (4 Crew)',
        hwRef: 'NASA-CAD-MOD3',
        usageDescription: 'Personal chest dosimeter · Cumulative organ absorbed dose tracking & audible radiation spike alert.',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: '0.3s ago',
        metrics: [
          { param: 'Crew Instantaneous Dose Rate', value: '0.05', unit: 'mSv/h', limit: '< 0.15 mSv/h', margin: 'Normal cruise exposure', trend: 'STABLE' },
          { param: 'Accumulated Mission Dose', value: '0.052', unit: 'Gy', limit: '< 0.600 Gy career limit', margin: '91.3% career margin remaining', trend: 'NOMINAL' },
          { param: 'Local Audio Alarm State', value: 'Armed', unit: 'Silent', limit: 'Trigger at 0.50 mSv/h', margin: 'Alarm standby normal', trend: 'ARMED' },
          { param: 'Mesh Radio Telemetry Lock', value: '100', unit: '%', limit: '> 95% continuous', margin: 'Direct bridge lock', trend: 'LOCKED' },
        ],
      },
      {
        id: 'SYS-CTR-01',
        name: 'ARED & CEVIS Exercise Countermeasure Suite with PUMA Analyzer',
        acronym: 'CTR-ARED-CEVIS',
        category: 'COUNTERMEASURE',
        categoryLabel: 'Countermeasures & Neuro',
        compartment: 'Exercise Bay · VIS Mount',
        hwRef: 'ARED-CEVIS-PUMA-MOD4',
        usageDescription: '600-lb resistive loading & cycle ergometer with PUMA VO₂ analyzer · Prevents osteopenia & muscle atrophy.',
        status: 'NOMINAL',
        telemetryMode: 'CONTINUOUS 10 Hz',
        lastSync: 'Active Session Logged',
        metrics: [
          { param: 'Daily Resistive Workload', value: '108', unit: 'kJ/session', limit: 'Target ≥ 95 kJ/crew/day', margin: '113% target achieved', trend: 'COMPLIANT' },
          { param: 'Cycle Ergometer Peak Power', value: '220', unit: 'Watts', limit: 'Target 180 - 240 W', margin: 'Cardiac target met', trend: 'NOMINAL' },
          { param: 'Peak Aerobic VO₂ Uptake', value: '38.4', unit: 'mL/kg/min', limit: 'Baseline > 35.0', margin: 'Aerobic fitness OK', trend: 'STABLE' },
          { param: 'Hull Vibration Transmission', value: '0.003', unit: 'g force', limit: '< 0.015 g dynamic', margin: 'Isolated from frame', trend: 'LOCKED' },
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

    // Consumables dataset with strict 4-column alignment
    const consumablesTable = [
      { label: 'O₂ Cryogenic Supply', value: '68.4', unit: 'kg', baseline: '80.0 kg', margin: '83 crew-days reserve' },
      { label: 'Potable H₂O Reserve', value: '284', unit: 'L', baseline: '300 L', margin: '71 crew-days supply' },
      { label: 'LiOH Backup Canisters', value: '12', unit: 'units', baseline: '12 units', margin: 'Emergency scrubbers sealed' },
      { label: 'Medical Supply Packs', value: '4 / 4', unit: 'kits', baseline: '4 kits', margin: 'All medical kits sterile' },
      { label: 'Oral K⁺ Electrolyte Packs', value: '16', unit: 'units', baseline: '16 units', margin: 'Arrhythmia countermeasure' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ─── ZONE 1: UNIVERSAL HEALTH METRICS COUNTERS BANNER ─── */}
        <div
          style={{
            background: 'linear-gradient(180deg, #1b2026 0%, #101418 100%)',
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: '12px 16px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={labelStyle}>UNIVERSAL SPACECRAFT HEALTH METRICS · HARDWARE STATUS & COMPLIANCE</div>
              <Badge color={T.nominal} borderColor={T.nominalBorder}>
                16 / 16 SYSTEMS ACTIVE
              </Badge>
            </div>
            <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textMuted }}>
              NASA-STD-3001 VOL 2 · FLIGHT SURGEON CONSOLE · ALL BUS TELEMETRY SYNCED
            </div>
          </div>

          {/* 5-Column Universal Counters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {/* Counter 1 */}
            <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                MONITORED HARDWARE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary }}>16 / 16</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.nominal, textTransform: 'uppercase' }}>100% ONLINE</span>
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 3 }}>
                11 Continuous · 3 POC Lab · 2 Active Rad
              </div>
            </div>

            {/* Counter 2 */}
            <div style={{ background: '#0a0d10', border: `1px solid ${isCo2Excursion ? T.warningBorder : T.borderSubtle}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SUBSYSTEM HEALTH INDEX
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: isCo2Excursion ? T.warning : T.nominal }}>
                  {isCo2Excursion ? '94.2%' : '98.6%'}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: isCo2Excursion ? T.warning : T.nominal }}>
                  {isCo2Excursion ? 'ADVISORY' : 'NOMINAL'}
                </span>
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 3 }}>
                {isCo2Excursion ? '1 System Excursion (CO₂ Scrubber)' : '0 Critical Faults · 16 Nominal'}
              </div>
            </div>

            {/* Counter 3 */}
            <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CONSUMABLES FLIGHT MARGIN
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary }}>71 - 83</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9ec7ef' }}>CREW-DAYS</span>
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 3 }}>
                O₂: 83d (68.4 kg) · H₂O: 71d (284 L)
              </div>
            </div>

            {/* Counter 4 */}
            <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                FLIGHT RULE COMPLIANCE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: isCo2Excursion ? T.warning : T.nominal }}>
                  {isCo2Excursion ? '96.0%' : '98.0%'}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: isCo2Excursion ? T.warning : T.nominal }}>
                  {isCo2Excursion ? 'WATCH' : 'COMPLIANT'}
                </span>
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 3 }}>
                {isCo2Excursion ? 'CO₂ 3.0 mmHg rule active gate' : '49 of 50 rules in green zone'}
              </div>
            </div>

            {/* Counter 5 */}
            <div style={{ background: '#0a0d10', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                TELEMETRY BUS & CADENCE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary }}>10.0 Hz</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.nominal }}>SYNC LOCKED</span>
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 3 }}>
                Bitrate: 1.42 Mbps · Latency: 42 ms (DSN)
              </div>
            </div>
          </div>
        </div>

        {/* ─── ZONE 2: STRICTLY ALIGNED SPACECRAFT CONSUMABLES CONTAINER (MARS DELAY REMOVED) ─── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={labelStyle}>SPACECRAFT CONSUMABLES & EMERGENCY FLIGHT MARGINS</div>
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

        {/* ─── ZONE 3: COMPACT CATEGORY FILTER TABS WITH INCREASED BORDER OPACITY & SOLID TINT ─── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 2,
          flexWrap: 'wrap',
          background: 'rgba(10, 14, 18, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          padding: '5px 8px',
          borderRadius: 7,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
          width: 'fit-content',
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
                  background: isSel ? 'rgba(56, 189, 248, 0.16)' : 'rgba(14, 18, 24, 0.65)',
                  border: isSel ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: 4,
                  padding: '5px 12px',
                  color: isSel ? '#ffffff' : '#b8cbde',
                  fontSize: 10,
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: T.sans,
                  letterSpacing: '0.03em',
                  boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.20), 0 2px 6px rgba(0, 0, 0, 0.35)' : 'none',
                  transition: 'all 0.12s ease',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ─── ZONE 4: INSTALLED SPACECRAFT HEALTH DEVICES CONTAINER CARDS ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 14 }}>
          {filteredSystems.map(sys => {
            const isWarn = sys.status === 'MONITOR';
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
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                }}
              >
                <div>
                  {/* Card Top Sub-Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      <span style={{ fontSize: 9, color: T.textMuted }}>·</span>
                      <span style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>{sys.compartment}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge
                        color={
                          sys.status === 'NOMINAL' || sys.status === 'STREAMING'
                            ? T.nominal
                            : sys.status === 'MONITOR'
                            ? T.warning
                            : sys.status === 'CALIBRATED'
                            ? '#38bdf8'
                            : T.warning
                        }
                        borderColor={
                          sys.status === 'NOMINAL' || sys.status === 'STREAMING'
                            ? T.nominalBorder
                            : sys.status === 'MONITOR'
                            ? T.warningBorder
                            : '#1c3e56'
                        }
                      >
                        <Dot
                          color={
                            sys.status === 'NOMINAL' || sys.status === 'STREAMING'
                              ? T.nominal
                              : sys.status === 'MONITOR'
                              ? T.warning
                              : '#38bdf8'
                          }
                          size={5}
                        />
                        {sys.status}
                      </Badge>
                      <span
                        style={{
                          fontSize: 8,
                          fontFamily: T.mono,
                          padding: '2px 5px',
                          borderRadius: 3,
                          background: '#101419',
                          border: `1px solid ${T.borderSubtle}`,
                          color: T.textMuted,
                        }}
                      >
                        {sys.telemetryMode}
                      </span>
                    </div>
                  </div>

                  {/* Primary System Name & Acronym */}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.01em' }}>
                      {sys.name}
                    </div>
                  </div>

                  {/* ─── PUNCHY HIGHLIGHT: WHAT EACH SYSTEM IS USED FOR (MINIMAL, NON-TEXT-HEAVY) ─── */}
                  <div
                    style={{
                      background: 'rgba(56, 189, 248, 0.04)',
                      borderLeft: '2px solid #38bdf8',
                      borderRadius: '0 4px 4px 0',
                      padding: '6px 10px',
                      margin: '8px 0 10px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#38bdf8',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#38bdf8', display: 'inline-block' }} />
                      PRIMARY ROLE & PURPOSE
                    </div>
                    <div style={{ fontSize: 10, color: '#e2e8f0', lineHeight: 1.4, fontWeight: 500 }}>
                      {sys.usageDescription}
                    </div>
                  </div>

                  {/* Parameters Table */}
                  <div style={{ marginTop: 8, borderTop: `1px solid ${T.borderSubtle}` }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                        padding: '4px 0',
                        borderBottom: `1px solid ${T.borderSubtle}`,
                        fontSize: 8,
                        fontWeight: 700,
                        color: T.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <div>MEASURED PARAMETER</div>
                      <div style={{ textAlign: 'right' }}>CURRENT VALUE</div>
                      <div style={{ textAlign: 'right' }}>FLIGHT LIMIT</div>
                      <div style={{ textAlign: 'right' }}>SAFETY MARGIN</div>
                    </div>

                    {sys.metrics.map((m, mi) => (
                      <div
                        key={m.param}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                          alignItems: 'center',
                          padding: '5px 0',
                          borderBottom: mi < sys.metrics.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
                        }}
                      >
                        <span style={{ fontSize: 10, color: T.textSecondary }}>{m.param}</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: m.warning ? T.warning : T.textPrimary }}>
                            {m.value}
                          </span>
                          {m.unit && <span style={{ fontSize: 9, color: T.textMuted, marginLeft: 2 }}>{m.unit}</span>}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 9, fontFamily: T.mono, color: T.textMuted }}>
                          {m.limit}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 9, fontFamily: T.mono, color: m.warning ? T.warning : '#9ec7ef' }}>
                          {m.margin} <span style={{ fontSize: 10, color: m.warning ? T.warning : T.nominal }}>{m.trend === 'ELEVATED' ? '↗' : m.trend === 'SEALED' ? '✓' : '→'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer: Hardware Reference & View Telemetry Stream Action */}
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
                    REF: {sys.hwRef} · SYNC: {sys.lastSync}
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

        {/* Distance presets */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginTop: 6,
          marginBottom: 12,
          background: 'rgba(10, 14, 18, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          padding: '5px 8px',
          borderRadius: 7,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
          width: 'fit-content',
        }}>
          {(Object.keys(DISTANCES) as DistancePreset[]).map(k => {
            const isSel = distPreset === k;
            return (
              <button
                key={k}
                onClick={() => setDistPreset(k)}
                style={{
                  background: isSel ? 'rgba(56, 189, 248, 0.16)' : 'rgba(14, 18, 24, 0.65)',
                  border: isSel ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: 4,
                  padding: '5px 12px',
                  fontSize: 10,
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? '#ffffff' : '#b8cbde',
                  cursor: 'pointer',
                  boxShadow: isSel ? 'inset 0 1px 0 rgba(255, 255, 255, 0.20)' : 'none',
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
                {evt.acknowledged ? '✓ Acknowledged' : 'Acknowledge'}
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
                <span>📖</span> Review Flight Procedure: {evt.procedure} →
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
        }}>
          {/* Main Tab Switching Container with Increased Opacity Border Outline */}
          <div style={{
            display: 'flex',
            gap: 6,
            background: 'rgba(10, 14, 18, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            padding: '4px',
            borderRadius: 7,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
          }}>
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
              <span>📋</span> Shift Handover
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
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Unresolved Events */}
              <div style={{ background: '#14181d', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>1. Active / Unresolved Mission Events</div>
                {events.filter(e => e.priority !== 'NOMINAL').length === 0 ? (
                  <div style={{ fontSize: 11, color: T.nominal }}>✓ No active anomalies. All telemetry channels within nominal baseline.</div>
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
                {copiedHandover ? '✓ Copied to Clipboard!' : '📋 Copy Handover Briefing to Clipboard'}
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
                      ✕
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

