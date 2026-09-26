import React, { useState, useEffect, useMemo } from 'react';
import type { TelemetryPacket, CrewFullLabProfile, AlertPayload } from '../types/telemetry';
import { fetchCrewLabProfile } from '../services/labAssayService';
import { HeaderBar } from './HeaderBar';

interface HealthTelemetryViewProps {
  initialAstronautId?: string | null;
  telemetryMap: Record<string, TelemetryPacket>;
  onClose: () => void;
  marsDelay: boolean;
  connected?: boolean;
  onToggleMarsDelay?: (enabled: boolean) => void;
  activeView?: 'HUD' | 'HEALTH_TELEMETRY';
  onSelectView?: (view: 'HUD' | 'HEALTH_TELEMETRY') => void;
  latestAlert?: AlertPayload | null;
  onAstronautChange?: (astronautId: string) => void;
}

interface CrewMeta {
  id: string;
  name: string;
  role: string;
  age: number;
  callsign: string;
  avatar: string;
  subjectId: string;
  roleShort: string;
}

const CREW_MEMBERS: CrewMeta[] = [
  { id: 'AST-01_COMMANDER', name: 'Cmndr Haley', role: 'Mission Commander', age: 38, callsign: 'HALEY', avatar: '/crew/haley.jpg', subjectId: 'C001', roleShort: 'CDR' },
  { id: 'AST-02_PILOT', name: 'Pilot Chris', role: 'Flight Pilot', age: 42, callsign: 'CHRIS', avatar: '/crew/chris.jpg', subjectId: 'C002', roleShort: 'PLT' },
  { id: 'AST-03_MEDICAL', name: 'Dr. Sian', role: 'Medical Specialist', age: 29, callsign: 'SIAN', avatar: '/crew/sian.jpg', subjectId: 'C003', roleShort: 'MED' },
  { id: 'AST-04_ENGINEER', name: 'Specialist Leo', role: 'Systems Engineer', age: 45, callsign: 'LEO', avatar: '/crew/leo.jpg', subjectId: 'C004', roleShort: 'ENG' },
];

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
    hgb: 12.1,
    rbc: 4.02,
    na: 137.0,
    k: 3.50,
    glu: 83.0,
    bun: 20.0,
    cr: 0.95,
    alb: 4.4,
    alt: 16.0,
    ast: 23.0,
    crp: 0.93,
    fibrinogen: 200.0,
    tnf: 116.1,
    il6: 5.76,
    ifn: 3.1,
    il1b: 61.8,
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
    k: 3.00,
    glu: 103.0,
    bun: 21.0,
    cr: 0.89,
    alb: 4.2,
    alt: 19.0,
    ast: 18.0,
    crp: 8.36,
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

interface DeviceMeta {
  id: number;
  name: string;
  type: 'Wearable' | 'Cabin Environmental' | 'Point-of-Care Lab' | 'Computational Engine';
  parameter: string;
  source: string;
  status: 'Streaming' | 'Nominal' | 'Calibrated';
  iconType: string;
  accentColor: string;
}

const FLIGHT_DEVICES: DeviceMeta[] = [
  { id: 1, name: 'Astroskin Smart Garment', type: 'Wearable', parameter: 'Physiological Telemetry Garment (Bio-Monitor)', source: 'Canadian Space Agency / NASA', status: 'Streaming', iconType: 'astroskin', accentColor: '#38bdf8' },
  { id: 2, name: 'LifeGuard / CPOD Module', type: 'Wearable', parameter: 'Autonomous Multi-Parameter Sensor Pod', source: 'NASA Ames Research Center', status: 'Streaming', iconType: 'lifeguard', accentColor: '#38bdf8' },
  { id: 3, name: 'SpaceWear Flight System', type: 'Wearable', parameter: 'Wearable Multi-Vector Health Monitoring', source: 'Artemis Sensor Suite', status: 'Streaming', iconType: 'spacewear', accentColor: '#38bdf8' },
  { id: 4, name: 'ECG / Wearable ECG Sensor', type: 'Wearable', parameter: 'Continuous Lead II ECG, HR & HRV', source: 'Bio-Telemetry Pod', status: 'Streaming', iconType: 'ecg', accentColor: '#38bdf8' },
  { id: 5, name: 'Pulse Oximeter / PPG Sensor', type: 'Wearable', parameter: 'Blood Oxygen (SpO₂) & Peripheral Pulse', source: 'Digital Optode Optoelectronic', status: 'Streaming', iconType: 'pulse-oximeter', accentColor: '#38bdf8' },
  { id: 6, name: 'Blood-Pressure Monitor', type: 'Wearable', parameter: 'Arterial Pressure Measurement (Sys/Dia)', source: 'Non-Invasive Vascular Sensor', status: 'Streaming', iconType: 'bp-monitor', accentColor: '#38bdf8' },
  { id: 7, name: 'Respiratory (RIP) Belt', type: 'Wearable', parameter: 'Inductance Plethysmography & Respiration', source: 'Thoracic Expansion Sensor', status: 'Streaming', iconType: 'respiratory-belt', accentColor: '#38bdf8' },
  { id: 8, name: 'Capnograph / Capnometer', type: 'Wearable', parameter: 'Expiratory & Cabin CO₂ Monitoring', source: 'Optical Infrared Gas Sensor', status: 'Streaming', iconType: 'capnograph', accentColor: '#38bdf8' },
  { id: 9, name: 'PUMA Metabolic Analyzer', type: 'Point-of-Care Lab', parameter: 'Metabolic Rate & Energy Expenditure (VO₂)', source: 'Portable Unit for Metabolic Analysis', status: 'Calibrated', iconType: 'puma-metabolic', accentColor: '#38bdf8' },
  { id: 10, name: 'Core-Temp Sensor / T-Mini', type: 'Wearable', parameter: 'Deep Body Core Temperature & Thermal Drift', source: 'CorTemp / T-Mini Telemetry Capsule', status: 'Streaming', iconType: 'core-temp', accentColor: '#38bdf8' },
  { id: 11, name: 'EEG System / EEG Headband', type: 'Wearable', parameter: 'Cranial Electrophysiology & Brain Rhythms', source: 'Frontal Neural Telemetry Band', status: 'Nominal', iconType: 'eeg-headband', accentColor: '#38bdf8' },
  { id: 12, name: 'Actigraphy Sleep Tracker', type: 'Wearable', parameter: 'Sleep Score, Circadian Rest & Motor IMU', source: 'Actiwatch / IMU Pod', status: 'Nominal', iconType: 'actigraphy', accentColor: '#38bdf8' },
  { id: 13, name: 'Radiation Dosimeter Badge', type: 'Wearable', parameter: 'GCR Flux Rate & Accumulated Absorbed Dose', source: 'Active Tissue-Equivalent Counter', status: 'Streaming', iconType: 'radiation', accentColor: '#38bdf8' },
  { id: 14, name: 'Hematology Analyzer (CBC)', type: 'Point-of-Care Lab', parameter: 'CBC: All 20 Morphology Biomarkers', source: 'NASA OSDR OSD-569 Microfluidic', status: 'Calibrated', iconType: 'hematology', accentColor: '#38bdf8' },
  { id: 15, name: 'Clinical Chemistry Analyzer', type: 'Point-of-Care Lab', parameter: 'CMP: All 19 Chemistry Biomarkers', source: 'NASA OSDR OSD-575 Assay', status: 'Calibrated', iconType: 'chemistry', accentColor: '#38bdf8' },
  { id: 16, name: 'Multiplex Bead Immunoassay', type: 'Point-of-Care Lab', parameter: 'Cytokines: All 71 Immune Markers', source: 'NASA OSDR OSD-575 Luminex', status: 'Calibrated', iconType: 'immunoassay', accentColor: '#38bdf8' },
  { id: 17, name: 'Cardiovascular Protein Analyzer', type: 'Point-of-Care Lab', parameter: 'All 9 Acute-Phase CV Proteins', source: 'NASA OSDR OSD-575 Acute Phase', status: 'Calibrated', iconType: 'cv-protein', accentColor: '#38bdf8' },
  { id: 18, name: 'Z-Score Baseline Comparator', type: 'Computational Engine', parameter: 'Individualized Bayesian σ-Drift Evaluator', source: 'Bayesian Gaussian Engine', status: 'Nominal', iconType: 'engine', accentColor: '#38bdf8' },
  { id: 19, name: 'Fridericia QTc Engine', type: 'Computational Engine', parameter: 'Rate-corrected QT Interval Evaluation', source: 'Continuous Electrocardiography', status: 'Nominal', iconType: 'engine', accentColor: '#38bdf8' },
  { id: 20, name: 'Arrhythmogenic Risk (ARF)', type: 'Computational Engine', parameter: 'Electrolyte-Coupled Cardiac Risk Index', source: 'Multi-parametric Risk Matrix', status: 'Nominal', iconType: 'engine', accentColor: '#38bdf8' },
  { id: 21, name: 'Thrombosis Risk Metric (TRM)', type: 'Computational Engine', parameter: 'Virchow Triad Microgravity Stasis Risk', source: 'Hemoconcentration Engine', status: 'Nominal', iconType: 'engine', accentColor: '#38bdf8' },
  { id: 22, name: 'Radiation Sickness Index (RSI)', type: 'Computational Engine', parameter: 'Acute GCR Exposure Radiobiological Decay', source: 'Radiobiological Decay Model', status: 'Nominal', iconType: 'engine', accentColor: '#38bdf8' },
];

/* ── PRECISE VECTOR ICONS IN UNIFIED AEROSPACE CYAN (#38bdf8) ──────────── */
const renderDeviceIcon = (iconType: string) => {
  const commonProps = {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#38bdf8',
    strokeWidth: '1.8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: {
      flexShrink: 0,
      display: 'block' as const,
      filter: 'drop-shadow(0 0 3px rgba(56, 189, 248, 0.45))',
    },
  };

  switch (iconType) {
    case 'astroskin':
      return (
        <svg {...commonProps}>
          <path d="M7 3h10l3.5 5.5l-2.5 1.5l-1 -2v12h-14v-12l-1 2l-2.5 -1.5z" />
          <path d="M10 11h4" />
          <path d="M12 9v4" />
          <circle cx="12" cy="17" r="1" fill="#38bdf8" />
        </svg>
      );
    case 'lifeguard':
      return (
        <svg {...commonProps}>
          <rect x="5" y="4" width="14" height="16" rx="4" />
          <path d="M9 2h6v2h-6z" />
          <path d="M9 20h6v2h-6z" />
          <path d="M9 12h2l1 -2l2 4l1 -2h2" />
        </svg>
      );
    case 'spacewear':
      return (
        <svg {...commonProps}>
          <path d="M7 4l5 4l5 -4" />
          <path d="M6 8l6 5l6 -5" />
          <path d="M12 13v8" />
          <path d="M8 21h8" />
        </svg>
      );
    case 'ecg':
      return (
        <svg {...commonProps}>
          <path d="M3 12h4l2 -6l3 13l2.5 -9l1.5 4l1 -2h4" />
        </svg>
      );
    case 'pulse-oximeter':
      return (
        <svg {...commonProps}>
          <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
          <path d="M12 9v6" />
          <path d="M9 12h6" />
        </svg>
      );
    case 'bp-monitor':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="11" r="8" />
          <path d="M12 7v4l2.5 2.5" />
          <path d="M12 19v2a2 2 0 0 0 2 2h2" />
        </svg>
      );
    case 'respiratory-belt':
      return (
        <svg {...commonProps}>
          <path d="M2 13c2.5 0 3.5 -6 6.5 -6s4 12 7 12s4 -6 6.5 -6" />
          <circle cx="8.5" cy="7" r="1" fill="#38bdf8" />
          <circle cx="15.5" cy="19" r="1" fill="#38bdf8" />
        </svg>
      );
    case 'capnograph':
      return (
        <svg {...commonProps}>
          <path d="M4 12h7a3 3 0 0 1 3 3v1a3 3 0 0 0 3 3h3" />
          <circle cx="6" cy="12" r="2" fill="#38bdf8" />
          <path d="M4 8h10" />
          <path d="M4 16h6" />
        </svg>
      );
    case 'core-temp':
      return (
        <svg {...commonProps}>
          <path d="M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5" />
          <circle cx="12" cy="17" r="1.5" fill="#38bdf8" />
          <path d="M17 7a3 3 0 0 1 0 4" />
          <path d="M19.5 5a6 6 0 0 1 0 8" />
        </svg>
      );
    case 'eeg-headband':
      return (
        <svg {...commonProps}>
          <path d="M4 14a8 8 0 0 1 16 0" />
          <path d="M3 14h3l1.5 -3l2 6l2 -4l1.5 2l2 -1h6" />
        </svg>
      );
    case 'actigraphy':
      return (
        <svg {...commonProps}>
          <rect x="6" y="5" width="12" height="14" rx="3" />
          <path d="M9 2h6v3h-6z" />
          <path d="M9 19h6v3h-6z" />
          <path d="M10 12l2 2l3 -3" />
        </svg>
      );
    case 'radiation':
      return (
        <svg {...commonProps}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <circle cx="12" cy="13" r="1.5" fill="#38bdf8" />
          <path d="M12 9.5v2" />
          <path d="M9.5 15l1.5 -1" />
          <path d="M14.5 15l-1.5 -1" />
          <path d="M9 4V2h6v2" />
        </svg>
      );
    case 'puma-metabolic':
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="14" rx="3" />
          <path d="M9 6v-3h6v3" />
          <path d="M8 12h8" />
          <path d="M8 15h5" />
          <circle cx="16" cy="15" r="1" fill="#38bdf8" />
        </svg>
      );
    case 'hematology':
      return (
        <svg {...commonProps}>
          <path d="M6 18h12" />
          <path d="M7 14h10" />
          <path d="M9 6a3 3 0 0 1 6 0v5h-6z" />
          <circle cx="12" cy="4" r="1" fill="#38bdf8" />
          <path d="M12 11v3" />
          <path d="M16 11a4 4 0 0 1 -4 4" />
        </svg>
      );
    case 'chemistry':
      return (
        <svg {...commonProps}>
          <path d="M9 3h6" />
          <path d="M10 3v5l-4 7.5a2 2 0 0 0 1.7 2.5h8.6a2 2 0 0 0 1.7 -2.5l-4 -7.5v-5" />
          <path d="M8 14h8" />
        </svg>
      );
    case 'immunoassay':
      return (
        <svg {...commonProps}>
          <path d="M12 13v7" />
          <path d="M12 13l-4 -5" />
          <path d="M12 13l4 -5" />
          <circle cx="8" cy="7" r="2" fill="#38bdf8" />
          <circle cx="16" cy="7" r="2" fill="#38bdf8" />
          <circle cx="12" cy="20" r="1.5" />
        </svg>
      );
    case 'cv-protein':
      return (
        <svg {...commonProps}>
          <path d="M12 21l-7 -7a5 5 0 0 1 7 -7a5 5 0 0 1 7 7l-7 7" />
          <path d="M12 10v4" />
          <path d="M10 12h4" />
        </svg>
      );
    case 'engine':
    default:
      return (
        <svg {...commonProps}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <path d="M9 2v4" />
          <path d="M15 2v4" />
          <path d="M9 18v4" />
          <path d="M15 18v4" />
          <path d="M2 9h4" />
          <path d="M2 15h4" />
          <path d="M18 9h4" />
          <path d="M18 15h4" />
          <circle cx="12" cy="12" r="2" fill="#38bdf8" />
        </svg>
      );
  }
};

/* ── AUTHENTIC PHYSIOLOGICAL NOISE & SPARKLINE HISTORY GENERATOR ────────── */
const gaussianNoise = (scale: number = 1.0) => {
  const g = (Math.random() + Math.random() + Math.random() - 1.5) * 1.6;
  return g * scale;
};

function createSyntheticHistory(baseVal: number, noiseScale: number, count = 32): number[] {
  const points: number[] = [];
  let curr = baseVal;
  for (let i = 0; i < count; i++) {
    curr += (baseVal - curr) * 0.18 + gaussianNoise(noiseScale);
    points.push(Number(curr.toFixed(2)));
  }
  return points;
}

/* ── MICRO SPARKLINE TRACE COMPONENT (MATCHING DEMO CONSOLE TAB ALGORITHM) ──── */
export const MicroSparkline: React.FC<{
  history?: number[];
  color: string;
  width?: number;
  height?: number;
  noGraph?: boolean;
}> = ({ history, color, width = 64, height = 18, noGraph = false }) => {
  if (noGraph || !history || history.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        <line
          x1="2"
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="rgba(255, 255, 255, 0.30)"
          strokeWidth="1.2"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const a = Math.min(...history);
  const b = Math.max(...history);
  const span = b - a;
  // Dynamic scale auto-normalizer matching Demo/astronaut-telemetry/index.html
  const r = span < 0.05 ? 1 : span;
  const pad = 2;
  const usableH = height - pad * 2;

  const points = history
    .map((y, i) => {
      const px = ((i * (width - 4)) / (history.length - 1) + 2).toFixed(1);
      const py = (height - pad - ((y - a) / r) * usableH).toFixed(1);
      return `${px},${py}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
    </svg>
  );
};

export const HealthTelemetryView: React.FC<HealthTelemetryViewProps> = ({
  initialAstronautId,
  telemetryMap,
  onClose,
  marsDelay,
  connected,
  onToggleMarsDelay,
  activeView,
  onSelectView,
  latestAlert,
  onAstronautChange,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialAstronautId || 'AST-01_COMMANDER'
  );

  // Synchronize when parent route changes (e.g. back/forward navigation)
  useEffect(() => {
    if (initialAstronautId && initialAstronautId !== selectedId) {
      setSelectedId(initialAstronautId);
    }
  }, [initialAstronautId]);

  const [deviceFilter, setDeviceFilter] = useState<'ALL' | 'WEARABLE' | 'LAB' | 'ENGINE'>('ALL');
  const [labProfile, setLabProfile] = useState<CrewFullLabProfile | null>(null);
  const [hoveredCrewId, setHoveredCrewId] = useState<string | null>(null);

  // Expandable Category Drawers
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [immuneClusterTab, setImmuneClusterTab] = useState<
    'pyrogens' | 'interferons' | 'interleukins' | 'chemokines' | 'growth'
  >('pyrogens');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch authentic NASA OSDR lab profile on astronaut change
  useEffect(() => {
    let isMounted = true;
    fetchCrewLabProfile(selectedId).then((profile) => {
      if (isMounted && profile) {
        setLabProfile(profile);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  const currentPacket: TelemetryPacket | undefined = useMemo(() => {
    return (
      telemetryMap[selectedId] ||
      (selectedId === 'AST-03_MEDICAL' ? telemetryMap['AST-03_MEDICAL_SPECIALIST'] : undefined) ||
      (selectedId === 'AST-04_ENGINEER' ? telemetryMap['AST-04_MISSION_SPECIALIST'] : undefined)
    );
  }, [telemetryMap, selectedId]);

  const activeCrew = useMemo(() => {
    return CREW_MEMBERS.find((c) => c.id === selectedId) || CREW_MEMBERS[0];
  }, [selectedId]);

  const defaultProfile = useMemo(() => getAstronautOsdrProfile(selectedId), [selectedId]);

  // Real-time telemetry metrics with astronaut baseline fallbacks
  const hr = currentPacket?.heart_rate ?? defaultProfile.restHr;
  const hrv = currentPacket?.hrv_rmssd ?? defaultProfile.restHrv;
  const spo2 = currentPacket?.spo2 ?? defaultProfile.restSpo2;
  const temp = currentPacket?.core_temp ?? defaultProfile.restTemp;
  const co2 = currentPacket?.cabin_co2 ?? 1.8;
  const sleep = currentPacket?.sleep_score ?? defaultProfile.restSleep;

  // Active clinical scenario detection (only override authentic lab baseline when anomaly actively presents)
  const isHypokalemia = (currentPacket?.potassium !== undefined && (currentPacket.potassium < 3.3 || currentPacket.potassium > 5.5)) ||
    ((currentPacket?.scenario_phase?.includes('HYPOKALEMIA')) ?? false);
  const isInflammationSpike = (currentPacket?.il_6 !== undefined && currentPacket.il_6 > 12.0) ||
    ((currentPacket?.scenario_phase?.includes('AMMONIA') || currentPacket?.scenario_phase?.includes('SMOLDER') || currentPacket?.scenario_phase?.includes('SEPSIS')) ?? false);
  const isHematocritShift = (currentPacket?.hematocrit !== undefined && Math.abs(currentPacket.hematocrit - 44.2) > 4.5);

  // Authentic NASA OSDR lab biomarkers (OSD-569 CBC, OSD-575 CMP/CV/Immune) with scenario overrides
  const k: number = (isHypokalemia && currentPacket?.potassium !== undefined) ? currentPacket.potassium : (labProfile?.cmp?.potassium?.value ?? defaultProfile.k);
  const hct: number = (isHematocritShift && currentPacket?.hematocrit !== undefined) ? currentPacket.hematocrit : (labProfile?.cbc?.hematocrit?.value ?? defaultProfile.hct);
  const wbc: number = (isInflammationSpike && currentPacket?.wbc_count !== undefined) ? currentPacket.wbc_count : (labProfile?.cbc?.white_blood_cells?.value ?? defaultProfile.wbc);
  const il6: number = (isInflammationSpike && currentPacket?.il_6 !== undefined) ? currentPacket.il_6 : (labProfile?.immune?.clusters?.pyrogens_and_inflammatory?.il_6?.concentration_pg_ml ?? defaultProfile.il6);
  const plt: number = (currentPacket?.platelet_count !== undefined && Math.abs(currentPacket.platelet_count - 245) > 40)
    ? currentPacket.platelet_count
    : (labProfile?.cbc?.platelets?.value ?? defaultProfile.plt);
  const crp = isInflammationSpike && currentPacket?.crp
    ? currentPacket.crp
    : (labProfile?.cardiovascular?.crp?.value ?? defaultProfile.crp);
  const qtc = currentPacket?.computed_qtc ?? 402.0;
  const arf = currentPacket?.computed_arf ?? 0.72;
  const trm = currentPacket?.computed_trm ?? 1.02;
  const rsi = currentPacket?.computed_rsi ?? 0.12;
  const radFlux = currentPacket?.radiation_flux ?? 0.04;
  const radDose = currentPacket?.radiation_dose_gy ?? 0.05;
  const alc = currentPacket?.lymphocyte_count ?? (labProfile?.cbc?.absolute_lymphocytes?.value ? (labProfile.cbc.absolute_lymphocytes.value / 1000) : 2.15);
  const severity = currentPacket?.evaluated_severity ?? 'NOMINAL';

  const sysBp = Math.round(112 + (hr - 60) * 0.35);
  const diaBp = Math.round(72 + (hr - 60) * 0.18);
  const respRate = Math.round(13 + (hr > 100 ? 5 : hr > 80 ? 2 : 0) + (spo2 < 95 ? 4 : 0));

  // Authentic OSDR lab values with astronaut-specific fallbacks
  const sodiumVal = labProfile?.cmp?.sodium?.value ? `${labProfile.cmp.sodium.value} mmol/L` : `${defaultProfile.na.toFixed(1)} mmol/L`;
  const glucoseVal = labProfile?.cmp?.glucose?.value ? `${labProfile.cmp.glucose.value} mg/dL` : `${defaultProfile.glu.toFixed(0)} mg/dL`;
  const albuminVal = labProfile?.cmp?.albumin?.value ? `${labProfile.cmp.albumin.value} g/dL` : `${defaultProfile.alb.toFixed(1)} g/dL`;
  const bunVal = labProfile?.cmp?.bun?.value ? `${labProfile.cmp.bun.value} mg/dL` : `${defaultProfile.bun.toFixed(0)} mg/dL`;
  const creatinineVal = labProfile?.cmp?.creatinine?.value ? `${labProfile.cmp.creatinine.value} mg/dL` : `${defaultProfile.cr.toFixed(2)} mg/dL`;
  const hgbVal = labProfile?.cbc?.hemoglobin?.value ? `${labProfile.cbc.hemoglobin.value} g/dL` : `${defaultProfile.hgb.toFixed(1)} g/dL`;
  const rbcVal = labProfile?.cbc?.red_blood_cells?.value ? `${labProfile.cbc.red_blood_cells.value} M/μL` : `${defaultProfile.rbc.toFixed(2)} M/μL`;
  const tnfVal = labProfile?.immune?.clusters?.pyrogens_and_inflammatory?.tnf_alpha?.concentration_pg_ml
    ? `${labProfile.immune.clusters.pyrogens_and_inflammatory.tnf_alpha.concentration_pg_ml} pg/mL`
    : `${defaultProfile.tnf.toFixed(1)} pg/mL`;
  const fibrinogenVal = labProfile?.cardiovascular?.fibrinogen?.value
    ? `${(labProfile.cardiovascular.fibrinogen.value / 1000000).toFixed(0)} mg/dL`
    : `${defaultProfile.fibrinogen.toFixed(0)} mg/dL`;

  // Historical time-series buffers matching Demo/astronaut-telemetry/index.html console tab
  const [metricHistories, setMetricHistories] = useState<Record<string, number[]>>(() => ({
    hr: createSyntheticHistory(defaultProfile.restHr, 0.9),
    ecg: createSyntheticHistory(60000 / Math.max(defaultProfile.restHr, 40), 6.0),
    bp_sys: createSyntheticHistory(114, 1.8),
    arf: createSyntheticHistory(0.72, 0.02),
    qtc: createSyntheticHistory(402.0, 2.2),
    crp: createSyntheticHistory(defaultProfile.crp, 0.08),
    spo2: createSyntheticHistory(defaultProfile.restSpo2, 0.15),
    rr: createSyntheticHistory(14, 0.4),
    etco2: createSyntheticHistory(38.0, 0.4),
    min_vent: createSyntheticHistory(7.3, 0.2),
    o2: createSyntheticHistory(20.9, 0.03),
    co2: createSyntheticHistory(1.8, 0.06),
    pressure: createSyntheticHistory(101.3, 0.05),
    ventilation: createSyntheticHistory(0.45, 0.02),
    temp: createSyntheticHistory(defaultProfile.restTemp, 0.03),
    skin_temp: createSyntheticHistory(defaultProfile.restTemp - 2.8, 0.03),
    cabin_temp: createSyntheticHistory(21.4, 0.04),
    drift_rate: createSyntheticHistory(0.0, 0.02),
    equilibrium: createSyntheticHistory(1.0, 0.02),
    sleep: createSyntheticHistory(defaultProfile.restSleep, 0.8),
    hrv: createSyntheticHistory(defaultProfile.restHrv, 1.2),
    neurological: createSyntheticHistory(98.0, 0.5),
    circadian: createSyntheticHistory(2.0, 0.05),
    z_hrv: createSyntheticHistory(0.2, 0.08),
    hct: createSyntheticHistory(defaultProfile.hct, 0.2),
    wbc: createSyntheticHistory(defaultProfile.wbc, 0.12),
    plt: createSyntheticHistory(defaultProfile.plt, 3.0),
    hgb: createSyntheticHistory(defaultProfile.hgb, 0.1),
    rbc: createSyntheticHistory(defaultProfile.rbc, 0.04),
    na: createSyntheticHistory(defaultProfile.na, 0.4),
    k: createSyntheticHistory(defaultProfile.k, 0.04),
    glu: createSyntheticHistory(defaultProfile.glu, 1.2),
    bun: createSyntheticHistory(defaultProfile.bun, 0.3),
    creatinine: createSyntheticHistory(defaultProfile.cr, 0.02),
    il6: createSyntheticHistory(defaultProfile.il6, 0.25),
    tnf: createSyntheticHistory(defaultProfile.tnf, 0.1),
    ifn: createSyntheticHistory(defaultProfile.ifn, 0.08),
    il1b: createSyntheticHistory(defaultProfile.il1b, 0.04),
    cytokines: createSyntheticHistory(71.0, 0.0),
    rad_flux: createSyntheticHistory(0.04, 0.01),
    rad_dose: createSyntheticHistory(0.05, 0.002),
    rsi: createSyntheticHistory(0.12, 0.02),
    alc: createSyntheticHistory(2.15, 0.05),
    dna_breaks: createSyntheticHistory(2.0, 0.4),
    trm: createSyntheticHistory(1.02, 0.02),
    fibrinogen: createSyntheticHistory(defaultProfile.fibrinogen, 3.5),
    l_selectin: createSyntheticHistory(740.0, 8.0),
    pf4: createSyntheticHistory(320.0, 4.0),
    // Dropdown CV Panel
    haptoglobin: createSyntheticHistory(1.10, 0.03),
    a2_macroglobulin: createSyntheticHistory(1.85, 0.04),
    agp: createSyntheticHistory(0.65, 0.02),
    fetuin_a36: createSyntheticHistory(0.38, 0.015),
    sap: createSyntheticHistory(24.5, 0.5),
    // Dropdown CBC Morphology
    abs_neutrophils: createSyntheticHistory(4200, 60),
    neutrophils_pct: createSyntheticHistory(62.0, 0.8),
    abs_lymphocytes: createSyntheticHistory(2100, 35),
    lymphocytes_pct: createSyntheticHistory(29.5, 0.6),
    abs_monocytes: createSyntheticHistory(480, 15),
    monocytes_pct: createSyntheticHistory(6.8, 0.3),
    abs_eosinophils: createSyntheticHistory(120, 8),
    eosinophils_pct: createSyntheticHistory(1.8, 0.1),
    abs_basophils: createSyntheticHistory(35, 3),
    basophils_pct: createSyntheticHistory(0.5, 0.05),
    mcv: createSyntheticHistory(89.0, 0.4),
    mch: createSyntheticHistory(30.2, 0.2),
    mchc: createSyntheticHistory(33.8, 0.25),
    rdw: createSyntheticHistory(12.4, 0.15),
    mpv: createSyntheticHistory(9.8, 0.12),
    // Dropdown CMP Panel
    calcium: createSyntheticHistory(9.4, 0.08),
    chloride: createSyntheticHistory(102.0, 0.5),
    co2_blood: createSyntheticHistory(26.0, 0.4),
    egfr: createSyntheticHistory(105.0, 1.2),
    total_protein: createSyntheticHistory(7.2, 0.1),
    albumin: createSyntheticHistory(4.4, 0.06),
    globulin: createSyntheticHistory(2.8, 0.05),
    alkaline_phosphatase: createSyntheticHistory(68.0, 1.0),
    alt: createSyntheticHistory(24.0, 0.6),
    ast: createSyntheticHistory(22.0, 0.5),
    total_bilirubin: createSyntheticHistory(0.6, 0.02),
    venous_stasis: createSyntheticHistory(1.0, 0.03),
    fluid_shift: createSyntheticHistory(-0.6, 0.02),
    epi: createSyntheticHistory(0.05, 0.01),
    diagnosis_conf: createSyntheticHistory(96.0, 0.5),
    directive_conf: createSyntheticHistory(98.5, 0.4),
    sentry_online: createSyntheticHistory(99.9, 0.05),
  }));

  // Dynamic cache for cytokine sparklines in the immune dropdown section
  const cytokineCacheRef = React.useRef<Record<string, number[]>>({});
  const getCytokineHistory = (name: string, baseVal: number) => {
    const key = `${selectedId}_${name}_${baseVal}`;
    if (!cytokineCacheRef.current[key]) {
      cytokineCacheRef.current[key] = createSyntheticHistory(baseVal, Math.max(baseVal * 0.04, 0.08));
    }
    return cytokineCacheRef.current[key];
  };

  // Re-seed histories when astronaut changes
  useEffect(() => {
    setMetricHistories({
      hr: createSyntheticHistory(hr, 0.9),
      ecg: createSyntheticHistory(60000 / Math.max(hr, 40), 6.0),
      bp_sys: createSyntheticHistory(sysBp, 1.8),
      arf: createSyntheticHistory(arf, 0.02),
      qtc: createSyntheticHistory(qtc, 2.2),
      crp: createSyntheticHistory(crp, 0.08),
      spo2: createSyntheticHistory(spo2, 0.15),
      rr: createSyntheticHistory(respRate, 0.4),
      etco2: createSyntheticHistory(spo2 < 95 ? 43.0 : 38.0, 0.4),
      min_vent: createSyntheticHistory(respRate * 0.52, 0.2),
      o2: createSyntheticHistory(20.9, 0.03),
      co2: createSyntheticHistory(co2, 0.06),
      pressure: createSyntheticHistory(101.3, 0.05),
      ventilation: createSyntheticHistory(0.45, 0.02),
      temp: createSyntheticHistory(temp, 0.03),
      skin_temp: createSyntheticHistory(temp - 2.8, 0.03),
      cabin_temp: createSyntheticHistory(21.4, 0.04),
      drift_rate: createSyntheticHistory(temp >= 37.5 ? 0.4 : 0.0, 0.02),
      equilibrium: createSyntheticHistory(1.0, 0.02),
      sleep: createSyntheticHistory(sleep, 0.8),
      hrv: createSyntheticHistory(hrv, 1.2),
      neurological: createSyntheticHistory(98.0, 0.5),
      circadian: createSyntheticHistory(2.0, 0.05),
      z_hrv: createSyntheticHistory(Math.abs(currentPacket?.z_score_hrv ?? 0.2), 0.08),
      hct: createSyntheticHistory(hct, 0.2),
      wbc: createSyntheticHistory(wbc, 0.12),
      plt: createSyntheticHistory(plt, 3.0),
      hgb: createSyntheticHistory(labProfile?.cbc?.hemoglobin?.value ?? defaultProfile.hgb, 0.1),
      rbc: createSyntheticHistory(labProfile?.cbc?.red_blood_cells?.value ?? defaultProfile.rbc, 0.04),
      na: createSyntheticHistory(labProfile?.cmp?.sodium?.value ?? defaultProfile.na, 0.4),
      k: createSyntheticHistory(k, 0.04),
      glu: createSyntheticHistory(labProfile?.cmp?.glucose?.value ?? defaultProfile.glu, 1.2),
      bun: createSyntheticHistory(labProfile?.cmp?.bun?.value ?? defaultProfile.bun, 0.3),
      creatinine: createSyntheticHistory(labProfile?.cmp?.creatinine?.value ?? defaultProfile.cr, 0.02),
      il6: createSyntheticHistory(il6, 0.25),
      tnf: createSyntheticHistory(labProfile?.immune?.clusters?.pyrogens_and_inflammatory?.tnf_alpha?.concentration_pg_ml ?? defaultProfile.tnf, 0.1),
      ifn: createSyntheticHistory(defaultProfile.ifn, 0.08),
      il1b: createSyntheticHistory(defaultProfile.il1b, 0.04),
      cytokines: createSyntheticHistory(71.0, 0.0),
      rad_flux: createSyntheticHistory(radFlux, 0.01),
      rad_dose: createSyntheticHistory(radDose, 0.002),
      rsi: createSyntheticHistory(rsi, 0.02),
      alc: createSyntheticHistory(alc, 0.05),
      dna_breaks: createSyntheticHistory(radDose > 0.2 ? 12.0 : 2.0, 0.4),
      trm: createSyntheticHistory(trm, 0.02),
      fibrinogen: createSyntheticHistory(labProfile?.cardiovascular?.fibrinogen?.value ? (labProfile.cardiovascular.fibrinogen.value / 1000000) : defaultProfile.fibrinogen, 3.5),
      l_selectin: createSyntheticHistory(740.0, 8.0),
      pf4: createSyntheticHistory(320.0, 4.0),
      // Dropdown CV Panel
      haptoglobin: createSyntheticHistory(labProfile?.cardiovascular?.haptoglobin?.value ? (labProfile.cardiovascular.haptoglobin.value / 1000000) : 1.10, 0.03),
      a2_macroglobulin: createSyntheticHistory(labProfile?.cardiovascular?.a2_macroglobulin?.value ? (labProfile.cardiovascular.a2_macroglobulin.value / 1000000) : 1.85, 0.04),
      agp: createSyntheticHistory(labProfile?.cardiovascular?.agp?.value ? (labProfile.cardiovascular.agp.value / 1000000) : 0.65, 0.02),
      fetuin_a36: createSyntheticHistory(labProfile?.cardiovascular?.fetuin_a36?.value ? (labProfile.cardiovascular.fetuin_a36.value / 1000000) : 0.38, 0.015),
      sap: createSyntheticHistory(labProfile?.cardiovascular?.sap?.value ? (labProfile.cardiovascular.sap.value / 1000) : 24.5, 0.5),
      // Dropdown CBC Morphology
      abs_neutrophils: createSyntheticHistory(labProfile?.cbc?.absolute_neutrophils?.value ?? 4200, 60),
      neutrophils_pct: createSyntheticHistory(labProfile?.cbc?.neutrophils_percent?.value ?? 62.0, 0.8),
      abs_lymphocytes: createSyntheticHistory(labProfile?.cbc?.absolute_lymphocytes?.value ?? 2100, 35),
      lymphocytes_pct: createSyntheticHistory(labProfile?.cbc?.lymphocytes_percent?.value ?? 29.5, 0.6),
      abs_monocytes: createSyntheticHistory(labProfile?.cbc?.absolute_monocytes?.value ?? 480, 15),
      monocytes_pct: createSyntheticHistory(labProfile?.cbc?.monocytes_percent?.value ?? 6.8, 0.3),
      abs_eosinophils: createSyntheticHistory(labProfile?.cbc?.absolute_eosinophils?.value ?? 120, 8),
      eosinophils_pct: createSyntheticHistory(labProfile?.cbc?.eosinophils_percent?.value ?? 1.8, 0.1),
      abs_basophils: createSyntheticHistory(labProfile?.cbc?.absolute_basophils?.value ?? 35, 3),
      basophils_pct: createSyntheticHistory(labProfile?.cbc?.basophils_percent?.value ?? 0.5, 0.05),
      mcv: createSyntheticHistory(labProfile?.cbc?.mcv?.value ?? 89.0, 0.4),
      mch: createSyntheticHistory(labProfile?.cbc?.mch?.value ?? 30.2, 0.2),
      mchc: createSyntheticHistory(labProfile?.cbc?.mchc?.value ?? 33.8, 0.25),
      rdw: createSyntheticHistory(labProfile?.cbc?.rdw?.value ?? 12.4, 0.15),
      mpv: createSyntheticHistory(labProfile?.cbc?.mpv?.value ?? 9.8, 0.12),
      // Dropdown CMP Panel
      calcium: createSyntheticHistory(labProfile?.cmp?.calcium?.value ?? 9.4, 0.08),
      chloride: createSyntheticHistory(labProfile?.cmp?.chloride?.value ?? 102.0, 0.5),
      co2_blood: createSyntheticHistory(labProfile?.cmp?.carbon_dioxide?.value ?? 26.0, 0.4),
      egfr: createSyntheticHistory(labProfile?.cmp?.egfr_non_african_american?.value ?? 105.0, 1.2),
      total_protein: createSyntheticHistory(labProfile?.cmp?.total_protein?.value ?? 7.2, 0.1),
      albumin: createSyntheticHistory(labProfile?.cmp?.albumin?.value ?? 4.4, 0.06),
      globulin: createSyntheticHistory(labProfile?.cmp?.globulin?.value ?? 2.8, 0.05),
      alkaline_phosphatase: createSyntheticHistory(labProfile?.cmp?.alkaline_phosphatase?.value ?? 68.0, 1.0),
      alt: createSyntheticHistory(labProfile?.cmp?.alt?.value ?? 24.0, 0.6),
      ast: createSyntheticHistory(labProfile?.cmp?.ast?.value ?? 22.0, 0.5),
      total_bilirubin: createSyntheticHistory(labProfile?.cmp?.total_bilirubin?.value ?? 0.6, 0.02),
      venous_stasis: createSyntheticHistory(trm > 1.3 ? 1.4 : 1.0, 0.03),
      fluid_shift: createSyntheticHistory(-0.6, 0.02),
      epi: createSyntheticHistory(currentPacket?.computed_epi ?? 0.05, 0.01),
      diagnosis_conf: createSyntheticHistory(96.0, 0.5),
      directive_conf: createSyntheticHistory(98.5, 0.4),
      sentry_online: createSyntheticHistory(99.9, 0.05),
    });
  }, [selectedId, labProfile]);

  // Live historical streaming update as telemetry updates
  useEffect(() => {
    if (!currentPacket) return;

    setMetricHistories((prev) => {
      const next: Record<string, number[]> = {};
      const pushVal = (key: string, val: number) => {
        const hist = prev[key] || Array(30).fill(val);
        next[key] = [...hist.slice(-35), Number(val.toFixed(2))];
      };

      pushVal('hr', hr);
      pushVal('ecg', 60000 / Math.max(hr, 40));
      pushVal('bp_sys', sysBp);
      pushVal('arf', arf);
      pushVal('qtc', qtc);
      pushVal('crp', crp);
      pushVal('spo2', spo2);
      pushVal('rr', respRate);
      pushVal('etco2', spo2 < 95 ? 43.0 : 38.0);
      pushVal('min_vent', respRate * 0.52);
      pushVal('o2', 20.9);
      pushVal('co2', co2);
      pushVal('pressure', 101.3);
      pushVal('ventilation', 0.45);
      pushVal('temp', temp);
      pushVal('skin_temp', temp - 2.8);
      pushVal('cabin_temp', 21.4);
      pushVal('drift_rate', temp >= 37.5 ? 0.4 : 0.0);
      pushVal('equilibrium', 1.0);
      pushVal('sleep', sleep);
      pushVal('hrv', hrv);
      pushVal('neurological', 98.0);
      pushVal('circadian', 2.0);
      pushVal('z_hrv', Math.abs(currentPacket.z_score_hrv ?? 0.2));
      pushVal('hct', hct);
      pushVal('wbc', wbc);
      pushVal('plt', plt);
      pushVal('k', k);
      pushVal('il6', il6);
      pushVal('rad_flux', radFlux);
      pushVal('rad_dose', radDose);
      pushVal('rsi', rsi);
      pushVal('alc', alc);
      pushVal('trm', trm);
      pushVal('epi', currentPacket.computed_epi ?? 0.05);

      return { ...prev, ...next };
    });
  }, [currentPacket?.tick, currentPacket?.heart_rate, currentPacket?.spo2]);

  // Dynamic Multi-Organ Health Reserve Score derived from physiological Z-scores, NASA OSDR lab deviations & scenario severity
  const healthPercent = useMemo(() => {
    if (severity === 'CRITICAL') {
      const drop = Math.min(25, (100 - spo2) * 2 + (hr > 120 ? 10 : 0) + (rsi > 0.5 ? 12 : 0) + (k < 3.0 ? 10 : 0));
      return Math.max(45, Math.min(65, Math.round(62 - drop * 0.4)));
    }
    if (severity === 'WARNING') {
      const drop = Math.min(15, (hr > 95 ? 6 : 0) + (spo2 < 96 ? 8 : 0) + (k < 3.2 ? 8 : 0));
      return Math.max(68, Math.min(82, Math.round(78 - drop * 0.4)));
    }
    if (severity === 'INFO') {
      return 88;
    }

    // NOMINAL State: Dynamic composite multi-system reserve score (92% - 99%)
    let score = 99.4;

    // 1. Cardiovascular reserve (HR & HRV deviations from astronaut's personal resting baseline)
    const zHr = Math.abs(hr - defaultProfile.restHr) / 4.0;
    score -= Math.min(3.5, zHr * 0.7);

    const zHrv = Math.max(0, (defaultProfile.restHrv - hrv) / 7.0);
    score -= Math.min(3.0, zHrv * 0.5);

    // 2. Respiratory & Oxygenation reserve
    if (spo2 < 99.0) {
      score -= Math.min(4.0, (99.0 - spo2) * 1.8);
    }

    // 3. Thermoregulatory & Metabolic stability
    const zTemp = Math.abs(temp - defaultProfile.restTemp) / 0.15;
    score -= Math.min(2.5, zTemp * 0.4);

    // 4. Biochemical & Electrolyte Homeostasis
    if (k < 3.5) {
      score -= Math.min(4.0, (3.5 - k) * 6.0);
    } else if (k > 5.0) {
      score -= Math.min(3.0, (k - 5.0) * 5.0);
    }

    // 5. Authentic NASA OSDR Inflammation & Hematology baseline profile
    // Sian (C003) has authentic mild baseline elevation (OSD-575 CRP: 8.36 mg/L)
    if (crp > 3.0) {
      score -= Math.min(2.8, (crp / 10.0) * 1.6);
    }
    if (wbc > 7.5) {
      score -= Math.min(2.0, (wbc - 7.5) * 0.8);
    }

    // 6. Neuro-Sleep Recovery Adjustment
    const sleepAdj = (sleep - 84.0) * 0.05;
    score += Math.max(-1.5, Math.min(1.0, sleepAdj));

    return Math.round(Math.max(88, Math.min(99, score)));
  }, [severity, hr, hrv, spo2, temp, sleep, k, crp, wbc, rsi, defaultProfile]);

  const overallPill = useMemo(() => {
    if (severity === 'CRITICAL') return { label: 'Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)' };
    if (severity === 'WARNING') return { label: 'Attention', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' };
    return { label: 'Stable', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.14)' };
  }, [severity]);

  const hazardStatus = useMemo(() => {
    const sc = currentPacket?.scenario_phase || '';
    if (sc.includes('AMMONIA') || sc === 'SCENARIO_4_AMMONIA_COOLANT_LEAK') {
      return {
        label: 'NH₃ LEAK (28 ppm)',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.35)',
      };
    }
    if (sc.includes('FIRE') || sc.includes('SMOLDER') || sc === 'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER') {
      return {
        label: 'SMOLDER DETECTED',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.35)',
      };
    }
    if (radFlux >= 1.0 || sc.includes('SOLAR_RADIATION') || sc.includes('SOLAR_STORM')) {
      return {
        label: `SOLAR STORM (${radFlux.toFixed(0)} mSv/h)`,
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.35)',
      };
    }
    if (sc.includes('DECOMPRESSION') || sc === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA') {
      return {
        label: 'DECOMPRESSION ALERT',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.35)',
      };
    }
    if (co2 >= 3.0 || sc.includes('CO2_SCRUBBER')) {
      return {
        label: `CO₂ ELEVATED (${co2.toFixed(1)} mmHg)`,
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.35)',
      };
    }
    return {
      label: 'NOMINAL',
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.10)',
      border: 'rgba(34, 197, 94, 0.25)',
    };
  }, [currentPacket?.scenario_phase, radFlux, co2]);

  const cabinPressureVal = useMemo(() => {
    const sc = currentPacket?.scenario_phase || '';
    if (sc.includes('DECOMPRESSION') || sc === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA') {
      return 92.4;
    }
    return 101.3;
  }, [currentPacket?.scenario_phase]);

  const cabinO2Val = useMemo(() => {
    const sc = currentPacket?.scenario_phase || '';
    if (sc.includes('DECOMPRESSION') || sc === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA') {
      return 18.2;
    }
    return 20.9;
  }, [currentPacket?.scenario_phase]);

  const filteredDevices = useMemo(() => {
    if (deviceFilter === 'WEARABLE') return FLIGHT_DEVICES.filter((d) => d.type === 'Wearable' || d.type === 'Cabin Environmental');
    if (deviceFilter === 'LAB') return FLIGHT_DEVICES.filter((d) => d.type === 'Point-of-Care Lab');
    if (deviceFilter === 'ENGINE') return FLIGHT_DEVICES.filter((d) => d.type === 'Computational Engine');
    return FLIGHT_DEVICES;
  }, [deviceFilter]);

  const toggleExpand = (cardNumber: number) => {
    setExpandedCard((prev) => (prev === cardNumber ? null : cardNumber));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        backgroundColor: '#070707',
        color: '#f8fafc',
        fontFamily: 'var(--hud-font-sans, "Tomorrow", system-ui, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1250px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          borderLeft: '1px solid #1a1a1a',
          borderRight: '1px solid #1a1a1a',
          backgroundColor: '#070707',
        }}
      >
        {/* ── UNIFIED MAIN HEADER WITH BRAND LOGO & SYSTEM CONTROLS ──────── */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(10, 10, 10, 0.96)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid #1f1f1f',
            padding: '0 24px',
          }}
        >
          <HeaderBar
            connected={connected ?? true}
            marsDelay={marsDelay}
            onToggleMarsDelay={onToggleMarsDelay || (() => { })}
            activeView={activeView || 'HEALTH_TELEMETRY'}
            onSelectView={onSelectView || ((v) => { if (v === 'HUD') onClose(); })}
            latestAlert={latestAlert}
            selectedAstronautId={selectedId}
          />
        </div>

        {/* ── HIGH-FIDELITY HERO COMMAND BAR (ACTIVE SUBJECT PROFILE, HUD TELEMETRY & IMAGE SWITCHER) ── */}
        <div
          style={{
            padding: '12px 24px 0 24px',
            background: 'linear-gradient(180deg, #0e121a 0%, #07090d 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap',
            position: 'relative',
          }}
        >
          {/* LEFT: Active Crew Identity (Avatar + Left-Aligned Name with Alerts Under It) + Health Score placed after name (NO badge) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '10px' }}>
            {/* Astronaut Avatar with Live Severity Glow Ring */}
            <div
              style={{
                position: 'relative',
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                border: `2px solid ${overallPill.color}`,
                boxShadow: `0 0 12px ${overallPill.color}40`,
                overflow: 'hidden',
                flexShrink: 0,
                backgroundColor: '#111827',
              }}
            >
              <img
                src={activeCrew.avatar}
                alt={activeCrew.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: overallPill.color,
                  border: '1.5px solid #07090d',
                  boxShadow: `0 0 6px ${overallPill.color}`,
                }}
              />
            </div>

            {/* Left-Aligned Name Stack with Alerts Kept Underneath */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
              {/* Top Row: Name + Role Tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#ffffff',
                    fontFamily: "'Tomorrow', sans-serif",
                    letterSpacing: '-0.01em',
                    lineHeight: 1.1,
                  }}
                >
                  {activeCrew.name}
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'rgba(56, 189, 248, 0.14)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38bdf8',
                    fontFamily: "'Tomorrow', sans-serif",
                    letterSpacing: '0.04em',
                  }}
                >
                  {activeCrew.roleShort}
                </span>
              </div>

              {/* Under Name: Alerts Readout + Mission Subject Context */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {severity === 'CRITICAL' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : severity === 'WARNING' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                )}
                <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif" }}>
                  Alerts:
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: severity === 'CRITICAL' ? '#ef4444' : severity === 'WARNING' ? '#f59e0b' : '#22c55e',
                    fontFamily: "'Tomorrow', sans-serif",
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {severity === 'NOMINAL' ? '0' : '1'} {severity === 'NOMINAL' ? 'NOM' : 'WARN'}
                </span>
                <span style={{ color: '#475569', fontSize: '10px' }}>•</span>
                <span style={{ fontSize: '10px', color: '#64748b', fontFamily: "'Tomorrow', sans-serif" }}>
                  Inspiration4 ({activeCrew.subjectId})
                </span>
              </div>
            </div>

            {/* Subtle Vertical Divider */}
            <div style={{ width: '1px', height: '38px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />

            {/* Health Score Placed AFTER Name (Clean Number, NO Badge) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#94a3b8',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                Health Score
              </span>
              <span
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: overallPill.color,
                  fontFamily: "'Tomorrow', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  textShadow: `0 0 18px ${overallPill.color}35`,
                }}
              >
                {healthPercent}%
              </span>
            </div>
          </div>

          {/* ── CENTER: CABIN ENVIRONMENTAL TELEMETRY (ALL 3 PRIORITIES: LIFE-SAFETY, CIRCULATION & HAZARD SENTRY) ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #242831 0%, #161920 100%)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              boxShadow: 'none',
              marginBottom: '10px',
            }}
          >
            {/* Top Sub-Bar: Module Identity + Dynamic Priority 3 Hazard Sentry Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  CABIN ECLSS
                </span>
              </div>

              {/* Priority 3: Dynamic Contaminant & Hazard Sentry */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: hazardStatus.bg,
                  border: `1px solid ${hazardStatus.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: hazardStatus.color,
                    fontFamily: "'Tomorrow', sans-serif",
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                  }}
                >
                  {hazardStatus.label}
                </span>
              </div>
            </div>

            {/* Bottom Row: 6 Core Environmental Signals with Optimized Clean Labels */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'nowrap' }}>
              {/* 1. Pressure */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PRESSURE
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2.5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: cabinPressureVal < 95.0 ? '#ef4444' : '#38bdf8', fontFamily: 'var(--hud-font-mono, monospace)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {cabinPressureVal.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: cabinPressureVal < 95.0 ? '#ef4444' : '#38bdf8', fontFamily: "'Tomorrow', sans-serif" }}>
                    kPa
                  </span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.10)' }} />

              {/* 2. O2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  O₂
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2.5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: cabinO2Val < 19.5 ? '#ef4444' : '#ffffff', fontFamily: 'var(--hud-font-mono, monospace)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {cabinO2Val.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: cabinO2Val < 19.5 ? '#ef4444' : '#22c55e', fontFamily: "'Tomorrow', sans-serif" }}>
                    %
                  </span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.10)' }} />

              {/* 3. CO2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  CO₂
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2.5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: co2 >= 3.0 ? '#f59e0b' : '#ffffff', fontFamily: 'var(--hud-font-mono, monospace)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {co2.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: co2 >= 3.0 ? '#f59e0b' : '#38bdf8', fontFamily: "'Tomorrow', sans-serif" }}>
                    mmHg
                  </span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.10)' }} />

              {/* 4. Radiation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  RADIATION
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2.5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: radFlux >= 1.0 ? '#ef4444' : radFlux >= 0.15 ? '#f59e0b' : '#38bdf8', fontFamily: 'var(--hud-font-mono, monospace)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {radFlux >= 10.0 ? radFlux.toFixed(0) : radFlux.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: radFlux >= 1.0 ? '#ef4444' : radFlux >= 0.15 ? '#f59e0b' : '#38bdf8', fontFamily: "'Tomorrow', sans-serif" }}>
                    mSv/h
                  </span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.10)' }} />

              {/* 5. Temp */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  TEMP
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2.5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--hud-font-mono, monospace)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    21.4
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#22c55e', fontFamily: "'Tomorrow', sans-serif" }}>
                    °C
                  </span>
                </div>
              </div>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255, 255, 255, 0.10)' }} />

              {/* 6. Airflow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', fontFamily: "'Tomorrow', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  AIRFLOW
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2.5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--hud-font-mono, monospace)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    0.45
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#22c55e', fontFamily: "'Tomorrow', sans-serif" }}>
                    m/s
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: CREW SELECTOR (DOCKED IN BOTTOM CONTAINER, ZERO LAYOUT SHIFT) ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              alignItems: 'flex-end',
              alignSelf: 'flex-end',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: "'Tomorrow', sans-serif",
                paddingRight: '6px',
              }}
            >
              Crew Selection (4)
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
              {CREW_MEMBERS.map((crew) => {
                const isSelected = crew.id === selectedId;
                const isHovered = crew.id === hoveredCrewId && !isSelected;
                const crewPacket =
                  telemetryMap[crew.id] ||
                  (crew.id === 'AST-03_MEDICAL' ? telemetryMap['AST-03_MEDICAL_SPECIALIST'] : undefined) ||
                  (crew.id === 'AST-04_ENGINEER' ? telemetryMap['AST-04_MISSION_SPECIALIST'] : undefined);
                const crewSev = crewPacket?.evaluated_severity || 'NOMINAL';
                const dotColor =
                  crewSev === 'CRITICAL' ? '#ef4444' : crewSev === 'WARNING' ? '#f59e0b' : '#22c55e';
                const shortName = crew.name.replace('Cmndr ', '').replace('Pilot ', '').replace('Dr. ', '').replace('Specialist ', '');

                return (
                  <button
                    key={crew.id}
                    onClick={() => {
                      setSelectedId(crew.id);
                      onAstronautChange?.(crew.id);
                    }}
                    onMouseEnter={() => setHoveredCrewId(crew.id)}
                    onMouseLeave={() => setHoveredCrewId(null)}
                    title={`${crew.name} - ${crew.role} (${crew.subjectId})`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '6px 11px 6px 7px',
                      height: '38px',
                      boxSizing: 'border-box',
                      borderRadius: '8px 8px 0 0',
                      outline: 'none',
                      borderTop: isSelected
                        ? '1.5px solid #38bdf8'
                        : isHovered
                        ? '1.5px solid rgba(255, 255, 255, 0.22)'
                        : '1.5px solid rgba(255, 255, 255, 0.12)',
                      borderLeft: isSelected
                        ? '1px solid rgba(56, 189, 248, 0.40)'
                        : isHovered
                        ? '1px solid rgba(255, 255, 255, 0.16)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRight: isSelected
                        ? '1px solid rgba(56, 189, 248, 0.40)'
                        : isHovered
                        ? '1px solid rgba(255, 255, 255, 0.16)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      borderBottom: 'none',
                      marginBottom: '-1px',
                      background: isSelected
                        ? 'linear-gradient(180deg, rgba(56, 189, 248, 0.14) 0%, #0d121a 100%)'
                        : isHovered
                        ? 'linear-gradient(180deg, #242b38 0%, #151a22 100%)'
                        : 'linear-gradient(180deg, #181d26 0%, #0f131a 100%)',
                      boxShadow: isSelected
                        ? '0 -2px 10px rgba(56, 189, 248, 0.15), inset 0 1px 0 rgba(56, 189, 248, 0.35)'
                        : 'none',
                      color: isSelected ? '#ffffff' : isHovered ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                      position: 'relative',
                      zIndex: isSelected ? 3 : 1,
                    }}
                  >
                    {/* Astronaut Photo Thumbnail with live health status ring */}
                    <div
                      style={{
                        position: 'relative',
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: `1.5px solid ${dotColor}`,
                        boxShadow: isSelected ? `0 0 6px ${dotColor}` : 'none',
                        backgroundColor: '#0f172a',
                      }}
                    >
                      <img
                        src={crew.avatar}
                        alt={crew.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-1px',
                          right: '-1px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: dotColor,
                          border: '1px solid #000000',
                          boxShadow: `0 0 3px ${dotColor}`,
                        }}
                      />
                    </div>

                    {/* Short Name */}
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: isSelected ? 700 : 600,
                        fontFamily: "'Tomorrow', sans-serif",
                        letterSpacing: '-0.01em',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {shortName}
                    </span>

                    {/* Role Tag */}
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.20)' : 'rgba(255, 255, 255, 0.08)',
                        border: isSelected ? '1px solid rgba(56, 189, 248, 0.40)' : '1px solid rgba(255, 255, 255, 0.10)',
                        color: isSelected ? '#38bdf8' : '#94a3b8',
                        fontFamily: "'Tomorrow', sans-serif",
                        letterSpacing: '0.04em',
                        lineHeight: 1,
                      }}
                    >
                      {crew.roleShort}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── COMMENTED OUT: 149/149 BIOMARKERS & 10 HZ TELEMETRY BUS (PROPERLY HIDDEN AS REQUESTED) ──
          <div style={{ display: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Tomorrow', sans-serif" }}>
                Biomarkers
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', fontFamily: "'Tomorrow', sans-serif", fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  149 / 149
                </span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              </div>
            </div>

            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Tomorrow', sans-serif" }}>
                Telemetry Bus
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: marsDelay ? '#f59e0b' : '#38bdf8', fontFamily: "'Tomorrow', sans-serif", lineHeight: 1 }}>
                  {marsDelay ? '22m Delay (Relay)' : 'Live · 10 Hz'}
                </span>
              </div>
            </div>
          </div>
          */}
        </div>

        {/* ── 3. MAIN CONTENT: 10 CATEGORICAL CARDS + DEDICATED FULL-HEIGHT SIDEBAR */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            alignItems: 'stretch',
            minHeight: 'calc(100vh - 280px)',
          }}
        >
          {/* Left Column: 10 Health Categories */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                Subsystems &amp; Biomarkers for {activeCrew.name}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', display: 'flex', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} /> Live
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} /> OSDR Lab
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> Abnormal
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '14px',
              }}
            >
              {/* 1. Cardiovascular (14 Signals) */}
              <CategoryCard
                title="1. Cardiovascular"
                icon={<HeartIcon />}
                statusPill={{ label: hr > 100 || arf >= 0.85 ? 'Attention' : 'Stable', color: hr > 100 || arf >= 0.85 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Heart rate', value: `${hr.toFixed(0)} bpm`, dotColor: hr > 100 ? '#f59e0b' : '#22c55e', trend: hr > 100 ? 'up' : 'stable', history: metricHistories['hr'] },
                  { label: 'ECG / Cardiac rhythm', value: hr > 115 ? 'Tachycardia' : hr < 50 ? 'Bradycardia' : 'Normal', dotColor: hr > 115 ? '#f59e0b' : '#22c55e', trend: 'stable', history: metricHistories['ecg'] },
                  { label: 'Blood pressure', value: `${sysBp}/${diaBp} mmHg`, dotColor: '#94a3b8', history: metricHistories['bp_sys'] },
                  { label: 'Arrhythmia detection', value: arf >= 0.85 ? 'Elevated risk' : 'None', dotColor: arf >= 0.85 ? '#ef4444' : '#22c55e', trend: 'stable', history: metricHistories['arf'] },
                  { label: 'Fridericia QTc', value: `${qtc.toFixed(0)} ms`, dotColor: qtc >= 485 ? '#ef4444' : '#22c55e', trend: qtc >= 485 ? 'up' : 'stable', history: metricHistories['qtc'] },
                  ...(expandedCard === 1
                    ? [
                      { label: 'Fibrinogen (OSD-575)', value: fibrinogenVal, dotColor: '#94a3b8', history: metricHistories['fibrinogen'] },
                      { label: 'C-reactive protein (CRP)', value: `${crp.toFixed(1)} mg/L`, dotColor: crp > 5.0 ? '#f59e0b' : '#22c55e', history: metricHistories['crp'] },
                      { label: 'L-selectin adhesion', value: labProfile?.cardiovascular?.l_selectin?.value ? `${(labProfile.cardiovascular.l_selectin.value / 1000).toFixed(0)} ng/mL` : '740 ng/mL', dotColor: '#94a3b8', history: metricHistories['l_selectin'] },
                      { label: 'Platelet factor 4 (PF4)', value: labProfile?.cardiovascular?.pf4?.value ? `${labProfile.cardiovascular.pf4.value.toFixed(0)} ng/mL` : '320 ng/mL', dotColor: '#94a3b8', history: metricHistories['pf4'] },
                      { label: 'Haptoglobin', value: labProfile?.cardiovascular?.haptoglobin?.value ? `${(labProfile.cardiovascular.haptoglobin.value / 1000000).toFixed(2)} mg/mL` : '1.10 mg/mL', dotColor: '#94a3b8', history: metricHistories['haptoglobin'] },
                      { label: 'A2-macroglobulin', value: labProfile?.cardiovascular?.a2_macroglobulin?.value ? `${(labProfile.cardiovascular.a2_macroglobulin.value / 1000000).toFixed(2)} mg/mL` : '1.85 mg/mL', dotColor: '#94a3b8', history: metricHistories['a2_macroglobulin'] },
                      { label: 'Alpha-1 acid glycoprotein', value: labProfile?.cardiovascular?.agp?.value ? `${(labProfile.cardiovascular.agp.value / 1000000).toFixed(2)} mg/mL` : '0.65 mg/mL', dotColor: '#94a3b8', history: metricHistories['agp'] },
                      { label: 'Fetuin-A36', value: labProfile?.cardiovascular?.fetuin_a36?.value ? `${(labProfile.cardiovascular.fetuin_a36.value / 1000000).toFixed(2)} mg/mL` : '0.38 mg/mL', dotColor: '#94a3b8', history: metricHistories['fetuin_a36'] },
                      { label: 'Serum amyloid P (SAP)', value: labProfile?.cardiovascular?.sap?.value ? `${(labProfile.cardiovascular.sap.value / 1000).toFixed(1)} μg/mL` : '24.5 μg/mL', dotColor: '#94a3b8', history: metricHistories['sap'] },
                    ]
                    : []),
                ]}
                actionButton={{
                  label: expandedCard === 1 ? 'Collapse CV Panel ▲' : 'All 14 CV Biomarkers (OSD-575) ▼',
                  onClick: () => toggleExpand(1),
                }}
              />

              {/* 2. Respiratory (5 Signals) */}
              <CategoryCard
                title="2. Pulmonary & Respiratory"
                icon={<LungsIcon />}
                statusPill={{ label: spo2 < 95 || respRate > 20 ? 'Attention' : 'Stable', color: spo2 < 95 || respRate > 20 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'SpO₂ (Oxygen saturation)', value: `${spo2.toFixed(0)} %`, dotColor: spo2 < 94 ? '#ef4444' : spo2 < 96 ? '#f59e0b' : '#22c55e', trend: spo2 < 96 ? 'down' : 'stable', history: metricHistories['spo2'] },
                  { label: 'Respiratory rate', value: `${respRate} /min`, dotColor: respRate > 20 ? '#f59e0b' : '#22c55e', history: metricHistories['rr'] },
                  { label: 'End-tidal CO₂ (EtCO₂)', value: `${spo2 < 95 ? 43 : 38} mmHg`, dotColor: spo2 < 95 ? '#f59e0b' : '#22c55e', trend: spo2 < 95 ? 'up' : 'stable', history: metricHistories['etco2'] },
                  { label: 'Minute ventilation', value: `${(respRate * 0.52).toFixed(1)} L/min`, dotColor: respRate > 20 ? '#f59e0b' : '#22c55e', history: metricHistories['min_vent'] },
                  { label: 'Thoracoabdominal synchrony', value: 'Synchronous / Nominal', dotColor: '#22c55e', noGraph: true },
                ]}
              />

              {/* 3. Temperature (4 Signals) */}
              <CategoryCard
                title="3. Thermoregulation"
                icon={<TempIcon />}
                statusPill={{ label: temp >= 37.5 ? 'Attention' : 'Stable', color: temp >= 37.5 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Core body temperature', value: `${temp.toFixed(1)} °C`, dotColor: temp >= 38.3 ? '#ef4444' : temp >= 37.5 ? '#f59e0b' : '#22c55e', trend: temp >= 37.5 ? 'up' : 'stable', history: metricHistories['temp'] },
                  { label: 'Peripheral skin temp', value: `${(temp - 2.8).toFixed(1)} °C`, dotColor: '#22c55e', trend: 'stable', history: metricHistories['skin_temp'] },
                  { label: 'Thermal drift rate', value: temp >= 37.5 ? '+0.4 °C/h' : '0.0 °C/h', dotColor: temp >= 37.5 ? '#f59e0b' : '#22c55e', history: metricHistories['drift_rate'] },
                  { label: 'Heat balance equilibrium', value: temp >= 37.5 ? 'Heat retention' : 'Equilibrium', dotColor: temp >= 37.5 ? '#f59e0b' : '#22c55e', noGraph: true },
                ]}
              />

              {/* 4. Neurological & Fatigue (5 Signals) */}
              <CategoryCard
                title="4. Neurological & Fatigue"
                icon={<BrainIcon />}
                statusPill={{ label: sleep < 70 ? 'Attention' : 'Nominal', color: sleep < 70 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Actigraphy sleep score', value: `${sleep.toFixed(0)} / 100`, dotColor: sleep < 65 ? '#f59e0b' : '#22c55e', trend: sleep < 70 ? 'down' : 'stable', history: metricHistories['sleep'] },
                  { label: 'Autonomic nervous tone', value: hrv < 45 ? 'Sympathetic strain' : 'Balanced', dotColor: hrv < 45 ? '#f59e0b' : '#22c55e', noGraph: true },
                  { label: 'Neurological response', value: 'Alert / Normal', dotColor: '#22c55e', trend: 'stable', noGraph: true },
                  { label: 'Circadian phase status', value: 'Phase II (Active)', dotColor: '#38bdf8', noGraph: true },
                  { label: 'Autonomic σ-drift', value: `${Math.abs(currentPacket?.z_score_hrv ?? 0.2).toFixed(1)} σ`, dotColor: Math.abs(currentPacket?.z_score_hrv ?? 0) > 2.0 ? '#f59e0b' : '#22c55e', history: metricHistories['z_hrv'] },
                ]}
              />

              {/* 5. Complete Blood Count (OSD-569 — 20 Signals) */}
              <CategoryCard
                title="5. Hematology (OSD-569 CBC)"
                icon={<ShieldIcon />}
                statusPill={{ label: il6 >= 15.0 || wbc > 12.0 ? 'Attention' : 'Nominal', color: il6 >= 15.0 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Hematocrit (HCT)', value: `${hct.toFixed(1)} %`, dotColor: '#22c55e', history: metricHistories['hct'] },
                  { label: 'White blood cells (WBC)', value: `${wbc.toFixed(1)} k/μL`, dotColor: wbc > 12.0 ? '#ef4444' : '#22c55e', history: metricHistories['wbc'] },
                  { label: 'Platelets (PLT)', value: `${plt.toFixed(0)} k/μL`, dotColor: '#22c55e', history: metricHistories['plt'] },
                  { label: 'Hemoglobin (Hgb)', value: hgbVal, dotColor: '#22c55e', history: metricHistories['hgb'] },
                  { label: 'Red blood cells (RBC)', value: rbcVal, dotColor: '#22c55e', history: metricHistories['rbc'] },
                  ...(expandedCard === 5
                    ? [
                      { label: 'Absolute neutrophils', value: labProfile?.cbc?.absolute_neutrophils?.value ? `${labProfile.cbc.absolute_neutrophils.value} /μL` : '4200 /μL', dotColor: '#22c55e', history: metricHistories['abs_neutrophils'] },
                      { label: 'Neutrophils %', value: labProfile?.cbc?.neutrophils_percent?.value ? `${labProfile.cbc.neutrophils_percent.value} %` : '62.0 %', dotColor: '#22c55e', history: metricHistories['neutrophils_pct'] },
                      { label: 'Absolute lymphocytes', value: labProfile?.cbc?.absolute_lymphocytes?.value ? `${labProfile.cbc.absolute_lymphocytes.value} /μL` : '2100 /μL', dotColor: '#22c55e', history: metricHistories['abs_lymphocytes'] },
                      { label: 'Lymphocytes %', value: labProfile?.cbc?.lymphocytes_percent?.value ? `${labProfile.cbc.lymphocytes_percent.value} %` : '29.5 %', dotColor: '#22c55e', history: metricHistories['lymphocytes_pct'] },
                      { label: 'Absolute monocytes', value: labProfile?.cbc?.absolute_monocytes?.value ? `${labProfile.cbc.absolute_monocytes.value} /μL` : '480 /μL', dotColor: '#22c55e', history: metricHistories['abs_monocytes'] },
                      { label: 'Monocytes %', value: labProfile?.cbc?.monocytes_percent?.value ? `${labProfile.cbc.monocytes_percent.value} %` : '6.8 %', dotColor: '#22c55e', history: metricHistories['monocytes_pct'] },
                      { label: 'Absolute eosinophils', value: labProfile?.cbc?.absolute_eosinophils?.value ? `${labProfile.cbc.absolute_eosinophils.value} /μL` : '120 /μL', dotColor: '#22c55e', history: metricHistories['abs_eosinophils'] },
                      { label: 'Eosinophils %', value: labProfile?.cbc?.eosinophils_percent?.value ? `${labProfile.cbc.eosinophils_percent.value} %` : '1.8 %', dotColor: '#22c55e', history: metricHistories['eosinophils_pct'] },
                      { label: 'Absolute basophils', value: labProfile?.cbc?.absolute_basophils?.value ? `${labProfile.cbc.absolute_basophils.value} /μL` : '35 /μL', dotColor: '#22c55e', history: metricHistories['abs_basophils'] },
                      { label: 'Basophils %', value: labProfile?.cbc?.basophils_percent?.value ? `${labProfile.cbc.basophils_percent.value} %` : '0.5 %', dotColor: '#22c55e', history: metricHistories['basophils_pct'] },
                      { label: 'Mean cell volume (MCV)', value: labProfile?.cbc?.mcv?.value ? `${labProfile.cbc.mcv.value} fL` : '89.0 fL', dotColor: '#22c55e', history: metricHistories['mcv'] },
                      { label: 'Mean cell Hb (MCH)', value: labProfile?.cbc?.mch?.value ? `${labProfile.cbc.mch.value} pg` : '30.2 pg', dotColor: '#22c55e', history: metricHistories['mch'] },
                      { label: 'Cell Hb conc (MCHC)', value: labProfile?.cbc?.mchc?.value ? `${labProfile.cbc.mchc.value} g/dL` : '33.8 g/dL', dotColor: '#22c55e', history: metricHistories['mchc'] },
                      { label: 'Red cell width (RDW)', value: labProfile?.cbc?.rdw?.value ? `${labProfile.cbc.rdw.value} %` : '12.4 %', dotColor: '#22c55e', history: metricHistories['rdw'] },
                      { label: 'Platelet volume (MPV)', value: labProfile?.cbc?.mpv?.value ? `${labProfile.cbc.mpv.value} fL` : '9.8 fL', dotColor: '#22c55e', history: metricHistories['mpv'] },
                    ]
                    : []),
                ]}
                actionButton={{
                  label: expandedCard === 5 ? 'Collapse CBC Morphology ▲' : 'All 20 CBC Biomarkers (OSD-569) ▼',
                  onClick: () => toggleExpand(5),
                }}
              />

              {/* 6. Comprehensive Metabolic Panel (OSD-575 — 19 Signals) */}
              <CategoryCard
                title="6. Metabolic & Chemistry (CMP)"
                icon={<FlaskIcon />}
                statusPill={{ label: k < 3.5 ? 'Attention' : 'Nominal', color: k < 3.5 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Serum sodium (Na⁺)', value: sodiumVal, dotColor: '#22c55e', history: metricHistories['na'] },
                  { label: 'Serum potassium (K⁺)', value: `${k.toFixed(2)} mmol/L`, dotColor: k < 3.0 ? '#ef4444' : k < 3.5 ? '#f59e0b' : '#22c55e', trend: k < 3.5 ? 'down' : 'stable', history: metricHistories['k'] },
                  { label: 'Blood glucose', value: glucoseVal, dotColor: '#22c55e', history: metricHistories['glu'] },
                  { label: 'Blood urea nitrogen (BUN)', value: bunVal, dotColor: '#22c55e', history: metricHistories['bun'] },
                  { label: 'Serum creatinine', value: creatinineVal, dotColor: '#22c55e', history: metricHistories['creatinine'] },
                  ...(expandedCard === 6
                    ? [
                      { label: 'Serum calcium (Ca²⁺)', value: labProfile?.cmp?.calcium?.value ? `${labProfile.cmp.calcium.value} mg/dL` : '9.4 mg/dL', dotColor: '#22c55e', history: metricHistories['calcium'] },
                      { label: 'Serum chloride (Cl⁻)', value: labProfile?.cmp?.chloride?.value ? `${labProfile.cmp.chloride.value} mmol/L` : '102 mmol/L', dotColor: '#22c55e', history: metricHistories['chloride'] },
                      { label: 'Serum bicarbonate (CO₂)', value: labProfile?.cmp?.carbon_dioxide?.value ? `${labProfile.cmp.carbon_dioxide.value} mmol/L` : '26 mmol/L', dotColor: '#22c55e', history: metricHistories['co2_blood'] },
                      { label: 'BUN / Creatinine ratio', value: labProfile?.cmp?.bun_to_creatinine_ratio?.value ? `${labProfile.cmp.bun_to_creatinine_ratio.value}` : '15.2', dotColor: '#22c55e', noGraph: true },
                      { label: 'eGFR filtration rate', value: labProfile?.cmp?.egfr_non_african_american?.value ? `${labProfile.cmp.egfr_non_african_american.value} mL/min` : '105 mL/min', dotColor: '#22c55e', history: metricHistories['egfr'] },
                      { label: 'Total serum protein', value: labProfile?.cmp?.total_protein?.value ? `${labProfile.cmp.total_protein.value} g/dL` : '7.2 g/dL', dotColor: '#22c55e', history: metricHistories['total_protein'] },
                      { label: 'Serum albumin', value: albuminVal, dotColor: '#22c55e', history: metricHistories['albumin'] },
                      { label: 'Serum globulin', value: labProfile?.cmp?.globulin?.value ? `${labProfile.cmp.globulin.value} g/dL` : '2.8 g/dL', dotColor: '#22c55e', history: metricHistories['globulin'] },
                      { label: 'Albumin / Globulin ratio', value: labProfile?.cmp?.albumin_to_globulin_ratio?.value ? `${labProfile.cmp.albumin_to_globulin_ratio.value}` : '1.57', dotColor: '#22c55e', noGraph: true },
                      { label: 'Alkaline phosphatase', value: labProfile?.cmp?.alkaline_phosphatase?.value ? `${labProfile.cmp.alkaline_phosphatase.value} U/L` : '68 U/L', dotColor: '#22c55e', history: metricHistories['alkaline_phosphatase'] },
                      { label: 'Alanine transaminase (ALT)', value: labProfile?.cmp?.alt?.value ? `${labProfile.cmp.alt.value} U/L` : '24 U/L', dotColor: '#22c55e', history: metricHistories['alt'] },
                      { label: 'Aspartate transaminase (AST)', value: labProfile?.cmp?.ast?.value ? `${labProfile.cmp.ast.value} U/L` : '22 U/L', dotColor: '#22c55e', history: metricHistories['ast'] },
                      { label: 'Total bilirubin', value: labProfile?.cmp?.total_bilirubin?.value ? `${labProfile.cmp.total_bilirubin.value} mg/dL` : '0.6 mg/dL', dotColor: '#22c55e', history: metricHistories['total_bilirubin'] },
                      { label: 'eGFR African American', value: labProfile?.cmp?.egfr_african_american?.value ? `${labProfile.cmp.egfr_african_american.value} mL/min` : '118 mL/min', dotColor: '#22c55e', noGraph: true },
                    ]
                    : []),
                ]}
                actionButton={{
                  label: expandedCard === 6 ? 'Collapse CMP Panel ▲' : 'All 19 CMP Biomarkers (OSD-575) ▼',
                  onClick: () => toggleExpand(6),
                }}
              />

              {/* 7. Deep-Space Immune & Cytokine Profiling (OSD-575 — 71 Cytokines) */}
              <CategoryCard
                title="7. Immune & Cytokines (OSD-575)"
                icon={<DropIcon />}
                statusPill={{ label: il6 >= 15.0 ? 'Attention' : 'Nominal', color: il6 >= 15.0 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Interleukin-6 (IL-6)', value: `${il6.toFixed(1)} pg/mL`, dotColor: il6 >= 30.0 ? '#ef4444' : il6 >= 15.0 ? '#f59e0b' : '#22c55e', trend: il6 >= 15.0 ? 'up' : 'stable', history: metricHistories['il6'] },
                  { label: 'TNF-alpha (TNF-α)', value: tnfVal, dotColor: '#22c55e', history: metricHistories['tnf'] },
                  { label: 'Interferon-gamma (IFN-γ)', value: labProfile?.immune?.clusters?.interferons_and_viral?.ifn_gamma?.concentration_pg_ml ? `${labProfile.immune.clusters.interferons_and_viral.ifn_gamma.concentration_pg_ml} pg/mL` : '3.4 pg/mL', dotColor: '#22c55e', history: metricHistories['ifn'] },
                  { label: 'Interleukin-1 beta (IL-1β)', value: labProfile?.immune?.clusters?.pyrogens_and_inflammatory?.il_1_beta?.concentration_pg_ml ? `${labProfile.immune.clusters.pyrogens_and_inflammatory.il_1_beta.concentration_pg_ml} pg/mL` : '1.2 pg/mL', dotColor: '#22c55e', history: metricHistories['il1b'] },
                  { label: 'Total cytokines monitored', value: '71 Markers', dotColor: '#94a3b8', noGraph: true },
                  ...(expandedCard === 7
                    ? Object.entries(
                      immuneClusterTab === 'pyrogens'
                        ? labProfile?.immune?.clusters?.pyrogens_and_inflammatory || {}
                        : immuneClusterTab === 'interferons'
                          ? labProfile?.immune?.clusters?.interferons_and_viral || {}
                          : immuneClusterTab === 'interleukins'
                            ? labProfile?.immune?.clusters?.interleukins_and_tcell || {}
                            : immuneClusterTab === 'chemokines'
                              ? labProfile?.immune?.clusters?.chemokines_and_trafficking || {}
                              : labProfile?.immune?.clusters?.growth_factors_and_remodeling || {}
                    ).map(([name, data]) => {
                      const conc = data.concentration_pg_ml;
                      const hasVal = conc !== null && conc > 0;
                      return {
                        label: name.replace(/_/g, ' '),
                        value: hasVal ? `${conc} pg/mL` : '0.0 pg/mL',
                        dotColor: '#94a3b8',
                        history: hasVal ? getCytokineHistory(name, conc) : undefined,
                        noGraph: !hasVal,
                      };
                    })
                    : []),
                ]}
                customHeaderRight={
                  expandedCard === 7 ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {[
                        { key: 'pyrogens', label: 'Pyrogens (6)' },
                        { key: 'interferons', label: 'Interferons (4)' },
                        { key: 'interleukins', label: 'Interleukins (24)' },
                        { key: 'chemokines', label: 'Chemokines (20)' },
                        { key: 'growth', label: 'Growth (17)' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            setImmuneClusterTab(tab.key as any);
                          }}
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: immuneClusterTab === tab.key ? '1px solid #525252' : '1px solid #262626',
                            backgroundColor: immuneClusterTab === tab.key ? '#262626' : 'transparent',
                            color: immuneClusterTab === tab.key ? '#ffffff' : '#888888',
                            cursor: 'pointer',
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  ) : undefined
                }
                actionButton={{
                  label: expandedCard === 7 ? 'Collapse Cytokine Panel ▲' : 'Inspect All 71 Cytokines by Cluster ▼',
                  onClick: () => toggleExpand(7),
                }}
              />

              {/* 8. Space Radiation Exposure (5 Signals) */}
              <CategoryCard
                title="8. Radiation Exposure"
                icon={<RadiationIcon />}
                statusPill={{ label: radFlux >= 0.15 || rsi >= 0.5 ? 'Attention' : 'Nominal', color: radFlux >= 0.15 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Current dose rate', value: `${radFlux.toFixed(2)} mSv/h`, dotColor: radFlux >= 0.15 ? '#f59e0b' : '#22c55e', trend: radFlux >= 0.15 ? 'up' : 'stable', history: metricHistories['rad_flux'] },
                  { label: 'Cumulative absorbed dose', value: `${radDose.toFixed(2)} Gy`, dotColor: '#22c55e', history: metricHistories['rad_dose'] },
                  { label: 'Radiation sickness index', value: rsi.toFixed(2), dotColor: rsi >= 0.5 ? '#f59e0b' : '#22c55e', history: metricHistories['rsi'] },
                  { label: 'Absolute lymphocytes', value: `${alc.toFixed(2)} k/μL`, dotColor: alc < 1.0 ? '#ef4444' : '#22c55e', history: metricHistories['alc'] },
                  { label: 'DNA double-strand breaks', value: radDose > 0.2 ? 'Elevated repairs' : 'Nominal repair', dotColor: radDose > 0.2 ? '#f59e0b' : '#22c55e', noGraph: true },
                ]}
              />

              {/* 9. Thrombosis & Vascular Risk (6 Signals) */}
              <CategoryCard
                title="9. Thrombosis & Vascular"
                icon={<VascularIcon />}
                statusPill={{ label: trm >= 1.25 ? 'Attention' : 'Nominal', color: trm >= 1.25 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Thrombosis risk metric', value: trm.toFixed(2), dotColor: trm >= 1.25 ? '#f59e0b' : '#22c55e', trend: trm >= 1.25 ? 'up' : 'stable', history: metricHistories['trm'] },
                  { label: 'Fibrinogen level', value: fibrinogenVal, dotColor: '#22c55e', history: metricHistories['fibrinogen'] },
                  { label: 'L-selectin adhesion', value: labProfile?.cardiovascular?.l_selectin?.value ? `${(labProfile.cardiovascular.l_selectin.value / 1000).toFixed(0)} ng/mL` : '740 ng/mL', dotColor: '#94a3b8', history: metricHistories['l_selectin'] },
                  { label: 'Platelet factor 4 (PF4)', value: labProfile?.cardiovascular?.pf4?.value ? `${labProfile.cardiovascular.pf4.value.toFixed(0)} ng/mL` : '320 ng/mL', dotColor: '#94a3b8', history: metricHistories['pf4'] },
                  { label: 'Venous stasis status', value: trm > 1.3 ? 'Cephalic stasis' : 'Normal flow', dotColor: trm > 1.3 ? '#f59e0b' : '#22c55e', noGraph: true },
                  { label: 'Cephalic hemoconcentration', value: '-0.6 kg fluid shift', dotColor: '#94a3b8', noGraph: true },
                ]}
              />

              {/* 10. Integrated Clinical Directive & JARVIS (4 Signals) */}
              <CategoryCard
                title="10. Integrated Directives & JARVIS"
                icon={<DirectivesIcon />}
                statusPill={{ label: severity === 'NOMINAL' ? 'Stable' : severity, color: severity === 'NOMINAL' ? '#22c55e' : '#f59e0b' }}
                rows={[
                  { label: 'Early sepsis cascade (EPI)', value: (currentPacket?.computed_epi ?? 0.05).toFixed(2), dotColor: (currentPacket?.computed_epi ?? 0) > 0.8 ? '#ef4444' : '#22c55e', history: metricHistories['epi'] },
                  { label: 'Primary diagnosis', value: severity === 'CRITICAL' ? 'Acute Physiological Anomaly' : severity === 'WARNING' ? 'Moderate Baseline Strain' : 'Equilibrium baseline', dotColor: severity === 'NOMINAL' ? '#22c55e' : '#f59e0b', noGraph: true },
                  { label: 'Actionable directive', value: severity === 'CRITICAL' ? 'Initiate clinical countermeasure' : severity === 'WARNING' ? 'Schedule rest & hydration' : 'Continue mission activities', dotColor: '#22c55e', noGraph: true },
                  { label: 'Autonomous decision sentry', value: 'Online (Ollama BioMistral)', dotColor: '#94a3b8', noGraph: true },
                ]}
              />
            </div>
          </div>

          {/* Right Column: Dedicated Full-Height Sidebar */}
          <aside
            style={{
              backgroundColor: '#0c0c0c',
              borderLeft: '1px solid #1e1e1e',
              padding: '20px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Devices Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Monitoring Devices
                </div>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 600, fontFamily: "'Tomorrow', sans-serif" }}>
                  {filteredDevices.length} Active Systems
                </span>
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '10px', lineHeight: 1.3 }}>
                Flight hardware & biosensors collecting real-time astronaut health telemetry.
              </div>

              {/* Device Filter Pills */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {(['ALL', 'WEARABLE', 'LAB', 'ENGINE'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDeviceFilter(filter)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '9999px',
                      fontSize: '9px',
                      fontWeight: 600,
                      border: deviceFilter === filter ? '1px solid #525252' : '1px solid #262626',
                      background: deviceFilter === filter ? '#262626' : 'transparent',
                      color: deviceFilter === filter ? '#ffffff' : '#888888',
                      cursor: 'pointer',
                    }}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'WEARABLE' ? 'Wearable' : filter === 'LAB' ? 'Lab Assays' : 'Engines'}
                  </button>
                ))}
              </div>

              {/* Device List with Accurate Vector Icons in Unified Cyan (#38bdf8) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '430px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {filteredDevices.map((dev) => (
                  <div
                    key={dev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      {/* Numerical Identifier Badge (matching flight instrumentation style) */}
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.22)',
                          color: '#38bdf8',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontFamily: "'Tomorrow', sans-serif",
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {dev.id}
                      </span>

                      {/* Precise Vector Icon in unified #38bdf8 cyan */}
                      {renderDeviceIcon(dev.iconType)}

                      {/* Device Meta */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#f1f5f9',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.25,
                          }}
                          title={dev.name}
                        >
                          {dev.name}
                        </div>
                        <div
                          style={{
                            fontSize: '9px',
                            color: '#94a3b8',
                            letterSpacing: '0.01em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.2,
                            marginTop: '1px',
                          }}
                          title={`${dev.parameter} (${dev.source})`}
                        >
                          {dev.parameter}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      style={{
                        fontSize: '8.5px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '9999px',
                        flexShrink: 0,
                        letterSpacing: '0.02em',
                        background:
                          dev.status === 'Streaming'
                            ? 'rgba(34, 197, 94, 0.12)'
                            : dev.status === 'Calibrated'
                            ? 'rgba(56, 189, 248, 0.10)'
                            : 'rgba(255, 255, 255, 0.04)',
                        color:
                          dev.status === 'Streaming'
                            ? '#22c55e'
                            : dev.status === 'Calibrated'
                            ? '#38bdf8'
                            : '#94a3b8',
                        border:
                          dev.status === 'Streaming'
                            ? '1px solid rgba(34, 197, 94, 0.28)'
                            : dev.status === 'Calibrated'
                            ? '1px solid rgba(56, 189, 248, 0.25)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {dev.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clean Hairline Divider */}
            <div style={{ height: '1px', backgroundColor: '#1c1c1c' }} />

            {/* Recent Events & Alerts Feed */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Events &amp; Directives
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '10px' }}>
                <div style={{ borderLeft: '2px solid #f59e0b', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>14:28</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>Sleep duration below baseline</span>
                  <div style={{ color: '#888888' }}>Slight circadian disruption flagged.</div>
                </div>
                <div style={{ borderLeft: '2px solid #22c55e', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>12:15</span>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>Heart rate elevation during exercise</span>
                  <div style={{ color: '#888888' }}>Contextual workout gating active.</div>
                </div>
                <div style={{ borderLeft: '2px solid #94a3b8', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>09:42</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>NASA OSDR Lab Assays Loaded</span>
                  <div style={{ color: '#888888' }}>All 119 biomarkers synchronized for {activeCrew.name}.</div>
                </div>
                <div style={{ borderLeft: '2px solid #94a3b8', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>08:11</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Radiation dose updated</span>
                  <div style={{ color: '#888888' }}>GCR flux within deep-space norms.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

/* ── REUSABLE CATEGORY CARD COMPONENT ─────────────────────────────────────── */
interface CategoryRowItem {
  label: string;
  value: string;
  dotColor: string;
  trend?: 'up' | 'down' | 'stable';
  history?: number[];
  noGraph?: boolean;
}

interface CategoryCardProps {
  title: string;
  icon: React.ReactNode;
  statusPill?: { label: string; color: string };
  rows: CategoryRowItem[];
  actionButton?: { label: string; onClick: () => void };
  customHeaderRight?: React.ReactNode;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  icon,
  statusPill,
  rows,
  actionButton,
  customHeaderRight,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#121212',
        border: '1px solid #242424',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
    >
      {/* Title Header with Professional Icon + Status Pill */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.01em', color: '#ffffff', fontFamily: "'Tomorrow', sans-serif" }}>
              {title}
            </span>
          </div>

          {statusPill && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: `${statusPill.color}1a`,
                color: statusPill.color,
                border: `1px solid ${statusPill.color}40`,
                letterSpacing: '0.02em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              {statusPill.label}
            </span>
          )}
        </div>
        {customHeaderRight}
      </div>

      {/* Metric Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, i) => (
          <div
            key={row.label + i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(130px, 1.4fr) 64px',
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: i < rows.length - 1 ? '1px solid #1c1c1c' : 'none',
              fontSize: '11px',
            }}
          >
            {/* Left: Metric Name in Clean Sentence Case */}
            <span style={{ color: '#a3a3a3', letterSpacing: '0.01em', fontFamily: "'Tomorrow', sans-serif" }}>
              {row.label}
            </span>

            {/* Middle: Real-time Status Dot + Tabular Numeral Value */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: row.dotColor,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${row.dotColor}80`,
                }}
              />
              <span
                style={{
                  color: '#f5f5f5',
                  fontWeight: 600,
                  fontFamily: 'var(--hud-font-mono, monospace)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.02em',
                }}
              >
                {row.value}
              </span>
            </div>

            {/* Right: Micro Sparkline or Subtle White Dotted Line */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '64px' }}>
              <MicroSparkline
                history={row.history}
                color={row.dotColor}
                width={64}
                height={18}
                noGraph={row.noGraph}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Expand / Collapse Button if available */}
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          style={{
            marginTop: '4px',
            padding: '5px',
            borderRadius: '6px',
            border: '1px solid #333333',
            backgroundColor: '#1a1a1a',
            color: '#d4d4d4',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.15s ease',
            fontFamily: "'Tomorrow', sans-serif",
            letterSpacing: '0.02em',
          }}
        >
          {actionButton.label}
        </button>
      )}
    </div>
  );
};

/* ── SHARP PROFESSIONAL SVG CATEGORY ICONS ────────────────────────────────── */
const HeartIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" strokeWidth="1.2">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const LungsIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 4v8M12 7c-2 0-5 1-6 4v6c0 1.5 1.5 3 3 3h1c1.5 0 2-2 2-4V9" />
    <path d="M12 7c2 0 5 1 6 4v6c0 1.5-1.5 3-3 3h-1c-1.5 0-2-2-2-4V9" />
  </svg>
);

const TempIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const BrainIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z" />
  </svg>
);

const DropIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const FlaskIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round">
    <path d="M10 2v7.31L4.62 17.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.68-3.5L14 9.31V2" />
    <line x1="8" y1="2" x2="16" y2="2" />
    <line x1="7" y1="15" x2="17" y2="15" />
  </svg>
);

const ShieldIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const RadiationIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const VascularIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const DirectivesIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 3v18h18" />
  </svg>
);

