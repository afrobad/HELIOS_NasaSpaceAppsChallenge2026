import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TelemetryPacket, DistancePreset } from '../types/telemetry';
import { DISTANCES, fmtTime } from '../types/telemetry';
import { evaluateCrewClinicalSummary } from '../utils/clinicalPrioritization';
import {
  User,
  Shield,
  Columns2,
  Maximize2,
  Play,
  Pause,
  Zap,
  Crosshair,
  Radio,
  CheckCircle2,
  AlertTriangle,
  X,
  Flame,
  Sun,
  Activity,
  Heart,
  Brain,
  Wind,
  Bone,
  Droplets,
  Eye,
  Info,
  Layers,
} from 'lucide-react';
import {
  HUMAN_VERTICES,
  HUMAN_TRI_INDICES,
  HUMAN_LINE_INDICES,
} from '../data/humanMeshGeometry';
import {
  generateStardustPointCloud,
  getVascularLineSegments,
  getVascularPoints,
  getHeartPoints,
  getSkeletonLineSegments,
  getSkeletonPoints,
  getBrainNeuralNetwork,
} from '../data/vascularGeometry';

export interface HolographicBodyScannerProps {
  astronautId: string;
  astronautName: string;
  astronautRole: string;
  crewNo: string;
  telemetry?: TelemetryPacket;
  currentScenario?: string;
  themeMode?: 'CYAN' | 'THERMAL' | 'AMBER' | 'HEATMAP' | 'AEROSPACE';
  orbitalPosition?: DistancePreset;
  onSelectSubsystem?: (subsystem: 'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL') => void;
}

export function normalizeTheme(mode?: string): 'CYAN' | 'THERMAL' | 'AMBER' {
  if (mode === 'THERMAL' || mode === 'HEATMAP') return 'THERMAL';
  if (mode === 'AMBER' || mode === 'AEROSPACE') return 'AMBER';
  return 'CYAN';
}

interface Hotspot {
  id: 'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL';
  label: string;
  subsystemName: string;
  elevationTag: string;
  organ: string;
  pos: [number, number, number];
  scanTargetY: number;
  severity: 'NOMINAL' | 'WARNING' | 'CRITICAL';
  metric: string;
  detail: string;
  region: string;
  protocol: string;
}

// Anatomical cross-section radius lookup function for dynamic tomographic body contouring
function getBodyContourRadii(y: number): { rx: number; rz: number } {
  if (y > 1.15) {
    const t = Math.max(0, Math.min(1, (y - 1.15) / 0.35));
    return { rx: 0.16 + 0.03 * (1 - t), rz: 0.19 };
  } else if (y > 0.80) {
    const t = (y - 0.80) / 0.35;
    return { rx: 0.22 + 0.16 * (1 - t), rz: 0.18 + 0.05 * (1 - t) };
  } else if (y > 0.45) {
    const t = (y - 0.45) / 0.35;
    return { rx: 0.34 + 0.08 * t, rz: 0.21 + 0.04 * t };
  } else if (y > 0.05) {
    const t = (y - 0.05) / 0.40;
    return { rx: 0.25 + 0.08 * t, rz: 0.18 + 0.03 * t };
  } else if (y > -0.30) {
    return { rx: 0.30, rz: 0.20 };
  } else if (y > -0.85) {
    const t = (y + 0.85) / 0.55;
    return { rx: 0.25 + 0.04 * t, rz: 0.16 + 0.03 * t };
  } else if (y > -1.30) {
    const t = (y + 1.30) / 0.45;
    return { rx: 0.20 + 0.04 * t, rz: 0.14 + 0.02 * t };
  } else {
    return { rx: 0.22, rz: 0.18 };
  }
}

export const HolographicBodyScanner: React.FC<HolographicBodyScannerProps> = ({
  astronautId,
  astronautName,
  astronautRole: _astronautRole,
  crewNo,
  telemetry,
  currentScenario,
  themeMode: initialTheme = 'CYAN',
  orbitalPosition = 'LEO',
  onSelectSubsystem,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL'>('CARDIAC');
  const [autoRotate, setAutoRotate] = useState(true);
  const [colorTheme, setColorTheme] = useState<'CYAN' | 'THERMAL' | 'AMBER'>(() => normalizeTheme(initialTheme));
  const [laserMode, setLaserMode] = useState<'SWEEP' | 'LOCK_ORGAN' | 'OFF'>('SWEEP');
  const [modelType, setModelType] = useState<'HUMAN' | 'SUIT'>('HUMAN');
  const [viewMode, setViewMode] = useState<'SPLIT' | 'FULL'>('SPLIT');
  const [selectedSuitSubsystem, setSelectedSuitSubsystem] = useState<'VISOR' | 'PLSS' | 'DCM' | 'SAFER' | 'TMG'>('PLSS');
  const inspectionMode = 'ANATOMY';
  const [selectedOrganId, setSelectedOrganId] = useState<'BRAIN' | 'HEART' | 'LUNGS' | 'KIDNEYS' | 'VASCULAR' | 'SKELETAL'>('HEART');
  const [showOrganModal, setShowOrganModal] = useState(false);
  const [showBadges, setShowBadges] = useState(true);

  // Sync prop changes
  useEffect(() => {
    if (initialTheme) {
      setColorTheme(normalizeTheme(initialTheme));
    }
  }, [initialTheme]);

  // Direct DOM references for 60 FPS HUD telemetry updates without triggering React re-renders
  const elevationDomRef = useRef<HTMLSpanElement>(null);
  const regionDomRef = useRef<HTMLSpanElement>(null);
  const sliceIndexDomRef = useRef<HTMLSpanElement>(null);
  const azimuthDomRef = useRef<HTMLSpanElement>(null);
  const elevationRulerChevronRef = useRef<HTMLDivElement>(null);

  // SVG lines and hotspot target ring DOM references for 60 FPS lag-free tracking
  const lineRefs = useRef<Record<string, SVGLineElement | null>>({});
  const ringRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const badgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerSizeRef = useRef({ width: 540, height: 500 });

  // ── CLINICAL SUMMARY & ANOMALY RESOLUTION FOR BIO-TWIN ──
  const clinical = useMemo(() => {
    return evaluateCrewClinicalSummary(astronautId, telemetry || {});
  }, [astronautId, telemetry]);

  const primaryBiomarker = clinical.prioritizedBiomarkers[0];
  const primaryBioId = primaryBiomarker?.id;
  const primaryBioTier = primaryBiomarker?.tier;

  const hr = telemetry?.heart_rate ?? 64;
  const spo2 = telemetry?.spo2 ?? 98.6;
  const hct = telemetry?.hematocrit ?? 42.0;
  const k = telemetry?.potassium ?? 4.4;
  const co2 = telemetry?.cabin_co2 ?? 1.82;
  const temp = telemetry?.core_temp ?? 36.6;
  const radFlux = telemetry?.radiation_flux ?? 0.04;
  const radDose = telemetry?.radiation_dose_gy ?? 0.0;
  const trm = telemetry?.computed_trm ?? 1.0;
  const qtc = telemetry?.computed_qtc ?? 405;
  const arf = telemetry?.computed_arf ?? 0.0;
  const bmd = (telemetry as any)?.bmd_index ?? 94.5;

  // Active Solar / Cosmic Radiation Status Detection (Gated Strictly to True Radiation Storm Events)
  const storedScenario = typeof window !== 'undefined' ? localStorage.getItem('helios_scenario') : null;
  const activeScenarioKey = currentScenario || telemetry?.scenario_phase || storedScenario || 'NOMINAL_CRUISE';
  const isRadiationScenario =
    activeScenarioKey.includes('RADIATION') ||
    activeScenarioKey.includes('SOLAR') ||
    activeScenarioKey === 'SCENARIO_3_SOLAR_RADIATION_STORM' ||
    activeScenarioKey === 'SCENARIO_8_SOLAR_RADIATION_STORM' ||
    activeScenarioKey === 'SCENARIO_13_RADIATION_MARROW_EXHAUSTION' ||
    activeScenarioKey === 'SOLAR_STORM' ||
    activeScenarioKey === 'SOLAR_RADIATION_STORM';

  const isRadiationActive = isRadiationScenario || (radFlux >= 15.0) || (radDose >= 0.50);
  const isRadiationCritical = isRadiationScenario || (radFlux >= 50.0) || (radDose >= 0.70);

  // Global Bio-Twin Severity
  const isCriticalAlert = telemetry?.evaluated_severity === 'CRITICAL' ||
    clinical.severity === 'CRITICAL' ||
    spo2 < 90.0 ||
    hr > 120 ||
    (telemetry?.potassium !== undefined && telemetry.potassium < 3.10) ||
    isRadiationCritical;

  const isWarningAlert = !isCriticalAlert && (
    telemetry?.evaluated_severity === 'WARNING' ||
    clinical.severity === 'WARNING' ||
    isRadiationActive ||
    hr > 105 ||
    spo2 < 94.0 ||
    co2 > 3.4 ||
    hct > 52.0 ||
    trm > 1.80 ||
    (telemetry?.potassium !== undefined && (telemetry.potassium < 3.40 || telemetry.potassium > 5.2))
  );

  const activeSeverity: 'CRITICAL' | 'WARNING' | 'NOMINAL' = isCriticalAlert ? 'CRITICAL' : isWarningAlert ? 'WARNING' : 'NOMINAL';

  // Subsystem Specific Severities
  // 1. Cardiac
  const isCardiacCritical = isCriticalAlert && (primaryBioId === 'hr' || primaryBioId === 'arf' || primaryBioId === 'spo2' || hr > 110 || qtc > 470 || arf > 1.2 || spo2 < 90.0);
  const isCardiacWarning = !isCardiacCritical && (
    isRadiationActive ||
    isWarningAlert ||
    primaryBioId === 'hr' ||
    primaryBioId === 'arf' ||
    hr > 95 ||
    qtc > 445
  );
  const cardiacSeverity: 'CRITICAL' | 'WARNING' | 'NOMINAL' = isCardiacCritical ? 'CRITICAL' : isCardiacWarning ? 'WARNING' : 'NOMINAL';

  // 2. Renal & Cortical Perfusion (Fluid Shift & Hemoconcentration)
  const isRenalCritical = (telemetry?.potassium !== undefined && telemetry.potassium < 3.20) || (primaryBioId === 'hct' && primaryBioTier === 'CRITICAL');
  const isRenalAlert = isRenalCritical ||
    isRadiationActive ||
    (isWarningAlert && (
      (telemetry?.potassium !== undefined && (telemetry.potassium < 3.40 || telemetry.potassium > 5.2)) ||
      (primaryBioId === 'hct' && primaryBioTier !== 'NOMINAL') ||
      hct > 51.0 ||
      telemetry?.scenario_phase === 'SCENARIO_14_NEPHROLITHIASIS' ||
      telemetry?.scenario_phase === 'SCENARIO_15_INTRAVASCULAR_DEHYDRATION'
    ));
  const renalSeverity: 'CRITICAL' | 'WARNING' | 'NOMINAL' = isRenalCritical ? 'CRITICAL' : isRenalAlert ? 'WARNING' : 'NOMINAL';

  // 3. Cranial & Neuro-Ocular (SANS & Radiation Phosphenes)
  const isOcularAlert = isRadiationActive || (isWarningAlert && (
    telemetry?.scenario_phase === 'SCENARIO_17_SPACE_VISION_SANS' ||
    co2 > 3.2 ||
    primaryBioId === 'co2'
  ));
  const ocularSeverity: 'CRITICAL' | 'WARNING' | 'NOMINAL' = isOcularAlert ? 'WARNING' : 'NOMINAL';

  // 4. Musculoskeletal & Deconditioning (Bone Marrow Suppression Under Radiation)
  const isSkeletalCrit = bmd < 85.0 || isRadiationCritical;
  const isSkeletalAlert = isSkeletalCrit || isRadiationActive || (isWarningAlert && (
    telemetry?.scenario_phase === 'SCENARIO_8_CARDIOVASCULAR_DECONDITIONING' ||
    bmd < 90.0 ||
    (primaryBioId === 'hct' && trm > 1.4)
  ));
  const skeletalSeverity: 'CRITICAL' | 'WARNING' | 'NOMINAL' = isSkeletalCrit ? 'CRITICAL' : isSkeletalAlert ? 'WARNING' : 'NOMINAL';

  // Synchronous refs for WebGL 60 FPS animation loop
  const hrRef = useRef(hr);
  const autoRotateRef = useRef(autoRotate);
  const laserModeRef = useRef(laserMode);
  const showBadgesRef = useRef(showBadges);
  const modelTypeRef = useRef(modelType);
  const selectedHotspotRef = useRef(selectedHotspot);
  const onSelectSubsystemRef = useRef(onSelectSubsystem);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const snapTargetAzimuthRef = useRef<number | null>(null);
  const targetFocusYRef = useRef<number | null>(null);
  const targetCameraZRef = useRef<number | null>(null);
  const targetCameraPosRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const targetControlsTargetRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const updateMaterialsRef = useRef<((theme: string, severity: 'CRITICAL' | 'WARNING' | 'NOMINAL') => void) | null>(null);
  const switchModelRef = useRef<((type: 'HUMAN' | 'SUIT') => void) | null>(null);
  const focusSuitSubsystemRef = useRef<((id: 'VISOR' | 'PLSS' | 'DCM' | 'SAFER' | 'TMG') => void) | null>(null);
  const activeSeverityRef = useRef(activeSeverity);

  useEffect(() => {
    activeSeverityRef.current = activeSeverity;
  }, [activeSeverity]);

  useEffect(() => {
    hrRef.current = hr;
  }, [hr]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    laserModeRef.current = laserMode;
  }, [laserMode]);

  useEffect(() => {
    showBadgesRef.current = showBadges;
  }, [showBadges]);

  useEffect(() => {
    selectedHotspotRef.current = selectedHotspot;
  }, [selectedHotspot]);

  useEffect(() => {
    onSelectSubsystemRef.current = onSelectSubsystem;
  }, [onSelectSubsystem]);

  useEffect(() => {
    if (updateMaterialsRef.current) {
      updateMaterialsRef.current(colorTheme, activeSeverity);
    }
  }, [colorTheme, activeSeverity]);

  const MESH_SCALE = 0.82;

  const hotspots: Hotspot[] = useMemo(() => [
    {
      id: 'OCULAR',
      label: 'Cranial / SANS Ocular',
      subsystemName: 'Optic Nerve Sheath (SANS)',
      elevationTag: '+1.32m Cranial',
      organ: 'Optic Nerve Sheath',
      region: 'CRANIAL (+1.32m)',
      pos: [0, 1.32 * MESH_SCALE, 0.14 * MESH_SCALE],
      scanTargetY: 1.32 * MESH_SCALE,
      severity: ocularSeverity,
      metric: isRadiationActive
        ? `Rad Flux ${radFlux.toFixed(1)} mGy/h · Phosphenes`
        : isOcularAlert
          ? 'ONSD 6.8 mm · Retinal Engorgement'
          : 'ONSD 5.2 mm · Retinal Microaneurysm 0',
      detail: isRadiationActive
        ? 'Solar proton event crossing cranial cavity; retinal Cerenkov phosphene flashes and visual pathway oxidative stress.'
        : isOcularAlert
          ? 'Cephalad venous congestion exceeding nominal ICP thresholds.'
          : 'Nominal intracranial ICP dynamics; optic sheath margins sharp.',
      protocol: isRadiationActive
        ? 'Relocate to water-shielded storm shelter; avoid spacecraft viewport exposure.'
        : isOcularAlert
          ? 'Deploy LBNP countermeasure suit; scheduled funduscopic OCT.'
          : 'Funduscopic OCT imaging q48h (NASA SANS Protocol B).',
    },
    {
      id: 'CARDIAC',
      label: 'Cardiovascular / Myocardium',
      subsystemName: 'Cardiac Rhythm & QTc',
      elevationTag: '+0.70m Thoracic',
      organ: 'Left Ventricle',
      region: 'THORACIC (+0.70m)',
      pos: [-0.08 * MESH_SCALE, 0.72 * MESH_SCALE, 0.16 * MESH_SCALE],
      scanTargetY: 0.72 * MESH_SCALE,
      severity: cardiacSeverity,
      metric: isRadiationActive
        ? `HR ${Math.round(hr)} bpm · SPE Tachy · Strain`
        : isCardiacCritical
          ? `HR ${Math.round(hr)} bpm · QTc ${qtc}ms · ARF ${arf.toFixed(2)}`
          : primaryBioId === 'hct' || trm > 1.40
            ? `HR ${Math.round(hr)} bpm · TRM ${trm.toFixed(2)} · Viscous`
            : isCardiacWarning
              ? `HR ${Math.round(hr)} bpm · QTc ${qtc}ms · Strain`
              : `HR ${Math.round(hr)} bpm · QTc ${qtc}ms · Stable`,
      detail: isRadiationActive
        ? 'Compensatory sinus tachycardia secondary to cosmic radiation storm alert; heightened autonomic stress response.'
        : isCardiacCritical
          ? (k < 3.5
            ? `Compensatory sinus tachycardia secondary to severe hypokalemia.`
            : `Critical cardiovascular strain under active mission scenario.`)
          : primaryBioId === 'hct'
            ? `Intravascular hemoconcentration elevating afterload.`
            : isCardiacWarning
              ? `Elevated cardiovascular workload; chronotropic adaptation.`
              : 'Resting sinus rhythm; nominal microgravity cardiac output.',
      protocol: isRadiationActive
        ? 'Monitor continuous Lead II telemetry; maintain calm seated posture inside storm shelter.'
        : isCardiacCritical
          ? 'Administer oral KCl electrolyte pack (20-40 mEq); suspend EVA.'
          : primaryBioId === 'hct'
            ? 'Scheduled oral hydration protocol; monitor central venous pressure.'
            : isCardiacWarning
              ? 'Continuous 12-lead vectorcardiography; titrate workload.'
              : 'Maintain nominal telemetry logging; routine submaximal cycle.',
    },
    {
      id: 'RENAL',
      label: 'Renal / Cortical Perfusion',
      subsystemName: 'Renal Perfusion & Osmolality',
      elevationTag: '+0.18m Abdominal',
      organ: 'Renal Cortices',
      region: 'ABDOMINAL (+0.18m)',
      pos: [-0.14 * MESH_SCALE, 0.18 * MESH_SCALE, 0.12 * MESH_SCALE],
      scanTargetY: 0.18 * MESH_SCALE,
      severity: renalSeverity,
      metric: isRadiationActive
        ? `Rad Dose ${(radDose || 0.75).toFixed(2)} Gy · Radioprotection`
        : isRenalCritical
          ? `K+ ${k.toFixed(2)} mmol/L · Urine Osm 920 mOsm`
          : (isRenalAlert && (primaryBioId === 'hct' || hct > 48.0))
            ? `Hct ${hct.toFixed(1)}% · Prerenal Shift`
            : isRenalAlert
              ? `K+ ${k.toFixed(2)} mmol/L · Osm 810 mOsm`
              : `K+ ${k.toFixed(2)} mmol/L · Urine Osm 450 mOsm`,
      detail: isRadiationActive
        ? 'Elevated cellular turnover and free radical metabolic load; ensure optimal renal clearance and radioprotective electrolyte support.'
        : (isRenalAlert && (primaryBioId === 'hct' || hct > 48.0))
          ? `Intravascular plasma volume contraction with hemoconcentration.`
          : isRenalAlert
            ? 'Prerenal azotemia secondary to microgravity fluid loss.'
            : 'Nominal bilateral cortical filtration; fluid balance stable.',
      protocol: isRadiationActive
        ? 'Oral radioprotective hydration protocol (2.5 L/day); monitor fluid output and electrolytes.'
        : primaryBioId === 'hct' || hct > 48.0
          ? 'Administer 1000 mL chilled electrolyte pack; re-evaluate q2h.'
          : isRenalAlert
            ? 'Administer 750 mL chilled electrolyte oral hydration.'
            : 'Routine fluid balance protocol (2.5 L/day target).',
    },
    {
      id: 'SKELETAL',
      label: 'Musculoskeletal / Femoral',
      subsystemName: 'Bone Density (BMD)',
      elevationTag: '-0.57m Femoral',
      organ: 'Bone Density (BMD)',
      region: 'FEMORAL (-0.57m)',
      pos: [0.12 * MESH_SCALE, -0.62 * MESH_SCALE, 0.12 * MESH_SCALE],
      scanTargetY: -0.62 * MESH_SCALE,
      severity: skeletalSeverity,
      metric: isRadiationCritical
        ? `Rad Flux ${radFlux.toFixed(1)} mGy/h · Marrow Crit`
        : isRadiationActive
          ? `Dose ${(radDose || 0.75).toFixed(2)} Gy · Marrow Strain`
          : isSkeletalAlert
            ? `BMD Loss Alert · Index ${bmd.toFixed(1)}%`
            : `BMD Index ${bmd.toFixed(1)}% · ARED 11.8 MJ`,
      detail: isRadiationCritical
        ? 'Acute solar particle event (85 mGy/h). High-energy proton penetration induces severe hematopoietic bone marrow suppression and acute lymphopenia.'
        : isRadiationActive
          ? 'Elevated cosmic ionizing flux exposure with trabecular bone marrow radiosensitivity.'
          : isSkeletalAlert
            ? 'Trabecular deconditioning under zero-G musculoskeletal unloading.'
            : 'Resistive countermeasure maintaining trabecular load profile.',
      protocol: isRadiationActive
        ? 'Direct crew to water-shielded storm shelter immediately; monitor dosimeter badges; pause physical EVA.'
        : isSkeletalAlert
          ? 'Increase ARED resistive loading to 180 kN; add dietary D3.'
          : 'Maintain ARED resistive deadlift & squat cycles (150 kN).',
    },
  ], [cardiacSeverity, renalSeverity, ocularSeverity, skeletalSeverity, hr, spo2, hct, k, trm, qtc, arf, bmd, telemetry, isCardiacCritical, isCardiacWarning, isRenalAlert, isRenalCritical, isOcularAlert, isSkeletalAlert, isRadiationActive, isRadiationCritical, radFlux, radDose, clinical]);

  // Interactive EVA Spacesuit Subsystems & Real-Time Specifications
  const suitSubsystems = useMemo(() => [
    {
      id: 'VISOR' as const,
      label: 'VISOR / HUD',
      name: 'Extravehicular Visor Assembly (EVVA)',
      spec: 'Gold vapor-deposited polycarbonate shielding 100% solar UV & IR. Optical grade anti-fog matrix.',
      telemetry: 'Tint: 94% · CO₂ Sentry: Nominal · Retinal Projection: Calibrated',
      status: 'ACTIVE',
      color: '#fbbf24',
      targetY: 0.85,
    },
    {
      id: 'PLSS' as const,
      label: 'PLSS BACKPACK',
      name: 'Portable Life Support System',
      spec: 'Dual 27.6 MPa O₂ tanks, regenerable amine CO₂ scrubbers, sublimator ice evaporator loop.',
      telemetry: 'Primary O₂: 98.4% · Scrubbed CO₂: 0.2 mmHg · Sublimator: 1.2 L/h nominal',
      status: 'OPTIMAL',
      color: '#00e5ff',
      targetY: 0.40,
    },
    {
      id: 'DCM' as const,
      label: 'DCM CHEST MODULE',
      name: 'Display & Control Module',
      spec: 'Chest-mounted operational controls: suit pressure regulator, primary/secondary oxygen actuator.',
      telemetry: 'Pressure: 29.6 kPa (4.3 psi pure O₂) · Comm: S-Band Primary Online',
      status: 'NOMINAL',
      color: '#38bdf8',
      targetY: 0.18,
    },
    {
      id: 'SAFER' as const,
      label: 'SAFER RCS',
      name: 'Simplified Aid for EVA Rescue',
      spec: 'Self-rescue cold-gas nitrogen thruster pack with 24 nozzles delivering 3.05 m/s delta-V.',
      telemetry: 'GN₂ Pressure: 20.7 MPa · 24 Nozzles Armed · Flight Controller Ready',
      status: 'ARMED',
      color: '#00e5a3',
      targetY: -0.10,
    },
    {
      id: 'TMG' as const,
      label: 'TMG LAYERS',
      name: 'Thermal Micrometeoroid Garment',
      spec: '14-layer ortho-fabric, aluminized Mylar insulation, and Kevlar puncture-resistant outer weave.',
      telemetry: 'Ext Temp: -48°C / +62°C · Micrometeoroid Puncture Sensors: 0 (Nominal)',
      status: 'SEALED',
      color: '#a855f7',
      targetY: -0.45,
    },
  ], []);



  // 6 Primary Anatomical Organ Systems for Direct Interactive Human Body Inspection
  const anatomicalParts = useMemo(() => {
    // 1. Brain & Ocular (Cranial)
    const isBrainCrit = ocularSeverity === 'CRITICAL' || isRadiationCritical;
    const isBrainWatch = !isBrainCrit && (ocularSeverity === 'WARNING' || co2 > 3.4 || hr > 115 || isRadiationActive);
    const brainStatus: 'NOMINAL' | 'WATCH' | 'CRITICAL' = isBrainCrit ? 'CRITICAL' : isBrainWatch ? 'WATCH' : 'NOMINAL';
    const brainColor = isBrainCrit ? '#ef4444' : isBrainWatch ? '#f59e0b' : '#00e5a3';

    // 2. Heart & Cardiac (Thoracic)
    const isHeartCrit = cardiacSeverity === 'CRITICAL' || isRadiationCritical;
    const isHeartWatch = !isHeartCrit && (cardiacSeverity === 'WARNING' || isRadiationActive);
    const heartStatus: 'NOMINAL' | 'WATCH' | 'CRITICAL' = isHeartCrit ? 'CRITICAL' : isHeartWatch ? 'WATCH' : 'NOMINAL';
    const heartColor = isHeartCrit ? '#ef4444' : isHeartWatch ? '#f59e0b' : '#00e5a3';

    // 3. Lungs & Pulmonary (Pulmonary)
    const isLungsCrit = spo2 < 90.0 || co2 > 4.5 || isRadiationCritical;
    const isLungsWatch = !isLungsCrit && (spo2 < 94.0 || co2 > 3.2 || isRadiationActive);
    const lungsStatus: 'NOMINAL' | 'WATCH' | 'CRITICAL' = isLungsCrit ? 'CRITICAL' : isLungsWatch ? 'WATCH' : 'NOMINAL';
    const lungsColor = isLungsCrit ? '#ef4444' : isLungsWatch ? '#f59e0b' : '#00e5a3';

    // 4. Kidneys & Renal (Abdominal)
    const isRenalCritDirect = renalSeverity === 'CRITICAL' || isRadiationCritical;
    const isRenalWatchDirect = !isRenalCritDirect && (renalSeverity === 'WARNING' || isRadiationActive);
    const renalStatus: 'NOMINAL' | 'WATCH' | 'CRITICAL' = isRenalCritDirect ? 'CRITICAL' : isRenalWatchDirect ? 'WATCH' : 'NOMINAL';
    const renalColor = isRenalCritDirect ? '#ef4444' : isRenalWatchDirect ? '#f59e0b' : '#00e5a3';

    // 5. Vascular & Circulation (Circulatory)
    const isVascCrit = trm >= 2.2 || hct >= 53.0 || isRadiationCritical;
    const isVascWatch = !isVascCrit && ((trm >= 1.60 || hct >= 51.5) || isRadiationActive);
    const vascStatus: 'NOMINAL' | 'WATCH' | 'CRITICAL' = isVascCrit ? 'CRITICAL' : isVascWatch ? 'WATCH' : 'NOMINAL';
    const vascColor = isVascCrit ? '#ef4444' : isVascWatch ? '#f59e0b' : '#00e5a3';

    // 6. Skeletal & Spine (Femoral)
    const isSkeletalCritDirect = skeletalSeverity === 'CRITICAL' || isRadiationCritical;
    const isSkeletalWatchDirect = !isSkeletalCritDirect && (skeletalSeverity === 'WARNING' || isRadiationActive);
    const skeletalStatus: 'NOMINAL' | 'WATCH' | 'CRITICAL' = isSkeletalCritDirect ? 'CRITICAL' : isSkeletalWatchDirect ? 'WATCH' : 'NOMINAL';
    const skeletalColor = isSkeletalCritDirect ? '#ef4444' : isSkeletalWatchDirect ? '#f59e0b' : '#00e5a3';

    return [
      {
        id: 'BRAIN' as const,
        title: 'Brain & Ocular',
        subsystemName: 'Cranial & SANS Ocular',
        region: 'CRANIAL (+1.32m)',
        elevationTag: '+1.32m Cranial',
        side: 'LEFT' as const,
        pos: [0.0, 1.30, 0.05] as [number, number, number],
        scanTargetY: 1.30 * 0.82,
        status: brainStatus,
        color: brainColor,
        metric: isRadiationActive ? `Flux ${radFlux.toFixed(1)} · Phosphenes` : isOcularAlert ? 'ONSD 6.8 mm · High ICP' : 'ONSD 5.2 mm · ICP 11',
        functionSummary: 'Coordinates cognitive operations, autonomic cardiopulmonary regulation, neurovestibular balance, and visual pathway transmission via optic nerves. In microgravity, upward cephalic fluid shift increases intracranial pressure, stressing the optic nerve sheath.',
        healthDetail: isRadiationActive
          ? 'Cosmic ion penetration through cranial envelope. Elevated risk of retinal Cerenkov phosphene flashes and CNS oxidative strain.'
          : isOcularAlert
            ? 'Cephalad venous engorgement detected with optic nerve sheath enlargement (>5.8 mm threshold). Grade 2 Frisen papilledema risk.'
            : 'Normal cranial perfusion and intracranial pressure. Optic disc margins sharp with zero optic sheath dilation.',
        protocol: isRadiationActive
          ? 'Direct crew to water-shielded storm module; avoid external viewports.'
          : isOcularAlert
            ? 'Deploy chinstrap negative-pressure suit (LBNP); scheduled funduscopic OCT scans.'
            : 'Funduscopic OCT imaging q48h (NASA SANS Protocol B); monitor visual acuity.',
        subsystemId: 'OCULAR' as const,
      },
      {
        id: 'HEART' as const,
        title: 'Heart & Cardiac',
        subsystemName: 'Cardiovascular & Myocardium',
        region: 'THORACIC (+0.72m)',
        elevationTag: '+0.72m Thoracic',
        side: 'LEFT' as const,
        pos: [-0.07, 0.72, 0.10] as [number, number, number],
        scanTargetY: 0.72 * 0.82,
        status: heartStatus,
        color: heartColor,
        metric: isRadiationActive ? `HR ${Math.round(hr)} bpm · SPE Stress` : isCardiacCritical ? `HR ${Math.round(hr)} bpm · Crit` : `HR ${Math.round(hr)} bpm · NSR`,
        functionSummary: 'Drives systemic blood circulation, regulates arterial blood pressure via baroreceptors, and delivers oxygen to tissues. Microgravity removes hydrostatic blood pooling in legs, reducing cardiac volume and predisposing to ventricular remodeling and arrhythmias.',
        healthDetail: isRadiationActive
          ? `Compensatory sinus tachycardia (HR ${Math.round(hr)} bpm) under active solar radiation storm alert; heightened autonomic and sympathetic stress response.`
          : isCardiacCritical
            ? `Acute cardiovascular strain detected with compensatory tachycardia (HR ${Math.round(hr)} bpm) and QTc prolongation (${qtc}ms).`
            : isCardiacWarning
              ? `Mild compensatory chronotropic workload. Myocardial conduction under close sentry monitoring.`
              : 'Normal resting sinus rhythm with stable stroke volume and nominal microgravity myocardial compliance.',
        protocol: isRadiationActive
          ? 'Continuous Lead II ECG telemetry logging; crew seated in shielded storm compartment.'
          : isCardiacCritical
            ? 'Administer oral potassium electrolyte pouch (20-40 mEq); pause strenuous EVA work; attach continuous ECG.'
            : 'Maintain nominal telemetry logging; scheduled submaximal aerobic cycle exercise.',
        subsystemId: 'CARDIAC' as const,
      },
      {
        id: 'KIDNEYS' as const,
        title: 'Kidneys & Renal',
        subsystemName: 'Renal Perfusion & Electrolytes',
        region: 'ABDOMINAL (+0.18m)',
        elevationTag: '+0.18m Abdominal',
        side: 'LEFT' as const,
        pos: [-0.10, 0.20, 0.05] as [number, number, number],
        scanTargetY: 0.18 * 0.82,
        status: renalStatus,
        color: renalColor,
        metric: isRadiationActive ? `Dose ${(radDose || 0.75).toFixed(2)} Gy · Rad Shift` : isRenalCritical ? `K+ ${k.toFixed(1)} · Critical` : `K+ ${k.toFixed(2)} mmol/L`,
        functionSummary: 'Filters blood, regulates total body fluid balance, controls potassium/sodium ion concentrations, and secretes renin. Microgravity induces acute cephalic fluid shift, prompting rapid diuresis, potassium excretion, and calcium precipitation.',
        healthDetail: isRadiationActive
          ? 'Accelerated renal clearance of radiation cellular breakdown products; radioprotective electrolyte maintenance required.'
          : isRenalCritical
            ? `Critical hypokalemia (K+ ${k.toFixed(2)} mmol/L) or acute fluid contraction compromising renal cortical perfusion.`
            : isRenalAlert
              ? `Mild electrolyte shift and elevated urine concentration. Early pre-renal dehydration risk.`
              : 'Bilateral cortical glomerular filtration nominal. Electrolyte balance and fluid balance stable.',
        protocol: isRadiationActive
          ? 'Initiate oral hydration and radioprotective electrolyte protocol (2.5 L/day target).'
          : isRenalAlert
            ? 'Administer 750–1000 mL chilled electrolyte oral hydration; assess urine specific gravity.'
            : 'Routine fluid balance protocol (2.5 L/24h consumption target); monitor electrolyte panel.',
        subsystemId: 'RENAL' as const,
      },
      {
        id: 'LUNGS' as const,
        title: 'Lungs & Pulmonary',
        subsystemName: 'Pulmonary Gas Exchange',
        region: 'PULMONARY (+0.82m)',
        elevationTag: '+0.82m Pulmonary',
        side: 'RIGHT' as const,
        pos: [0.08, 0.80, 0.08] as [number, number, number],
        scanTargetY: 0.80 * 0.82,
        status: lungsStatus,
        color: lungsColor,
        metric: isRadiationCritical ? `Flux ${radFlux.toFixed(1)} mGy/h · SPE Alert` : isRadiationActive ? `Flux ${radFlux.toFixed(1)} mGy/h · Watch` : isLungsCrit ? `SpO₂ ${spo2.toFixed(1)}% · Low` : `SpO₂ ${spo2.toFixed(1)}% · Nom`,
        functionSummary: 'Facilitates alveolar gas diffusion, oxygenating arterial blood and removing metabolic carbon dioxide. In closed spacecraft habitats, lack of gravity eliminates natural air convection, creating dead-space pockets of exhaled CO₂ and risk of hypoxia.',
        healthDetail: isRadiationActive
          ? 'Ionizing radiation flux traversing thoracic parenchymal space. Solar proton event induces microvascular pulmonary oxidative stress.'
          : isLungsCrit
            ? `Arterial hypoxemia detected (SpO₂ ${spo2.toFixed(1)}%). Alveolar-arterial oxygen gradient compromised.`
            : isLungsWatch
              ? `Mild hypercapnic workload secondary to ambient spacecraft CO₂ (${co2.toFixed(1)} mmHg).`
              : 'Alveolar gas exchange nominal; pulmonary parenchyma fully expanded with clear bilateral breath sounds.',
        protocol: isRadiationActive
          ? 'Immediate storm shelter ingress; verify life support cabin air particulate filtration.'
          : isLungsCrit
            ? 'Initiate emergency mask supplemental oxygen; verify ECLSS CO₂ scrubber air circulation.'
            : 'Monitor cabin scrubbing rates; maintain atmospheric partial pressure O₂ > 21.0 kPa.',
        subsystemId: 'CARDIAC' as const,
      },
      {
        id: 'VASCULAR' as const,
        title: 'Vascular Network',
        subsystemName: 'Circulation & Hemodynamics',
        region: 'CIRCULATORY (+0.40m)',
        elevationTag: '+0.40m Circulatory',
        side: 'RIGHT' as const,
        pos: [0.16, 0.40, 0.04] as [number, number, number],
        scanTargetY: 0.40 * 0.82,
        status: vascStatus,
        color: vascColor,
        metric: isRadiationCritical ? `Rad Flux ${radFlux.toFixed(1)} mGy/h · CRIT` : isRadiationActive ? `Lymph ${telemetry?.lymphocyte_count ?? 0.85} · Rad Alert` : isVascCrit ? `Hct ${hct.toFixed(1)}% · Viscous` : `Hct ${hct.toFixed(1)}% · Nom`,
        functionSummary: 'Maintains systemic arterial compliance, peripheral vascular resistance, and venous return. Microgravity plasma volume loss increases hematocrit and whole blood viscosity, elevating venous stasis and jugular thrombosis risk.',
        healthDetail: isRadiationCritical
          ? `Critical solar proton flux (${radFlux.toFixed(1)} mGy/h) inducing rapid lymphocyte depletion and systemic vascular endothelium irradiation.`
          : isRadiationActive
            ? 'Solar proton event elevating systemic vascular oxidative stress and immune cytokine signaling.'
            : isVascCrit
              ? `Significant hemoconcentration (Hct ${hct.toFixed(1)}%) with elevated thrombosis risk marker (TRM ${trm.toFixed(2)}).`
              : isVascWatch
                ? `Mild hemoconcentration secondary to reduced plasma volume. Peripheral resistance slightly elevated.`
                : 'Intravascular plasma volume and peripheral arterial compliance within safe baseline limits.',
        protocol: isRadiationActive
          ? 'Water-shielded storm shelter ingress immediately; serial lymphocyte and CBC tracking.'
          : isVascWatch
            ? 'Bilateral internal jugular vein (IJV) compression ultrasound; oral rehydration protocol; avoid static posture.'
            : 'Maintain scheduled resistive exercise; routine daily hydration protocol.',
        subsystemId: 'RENAL' as const,
      },
      {
        id: 'SKELETAL' as const,
        title: 'Skeletal & Spine',
        subsystemName: 'Bone Density & Biomechanics',
        region: 'FEMORAL (-0.65m)',
        elevationTag: '-0.65m Femoral',
        side: 'RIGHT' as const,
        pos: [0.10, -0.65, 0.04] as [number, number, number],
        scanTargetY: -0.65 * 0.82,
        status: skeletalStatus,
        color: skeletalColor,
        metric: isRadiationCritical ? `Dose ${(radDose || 0.75).toFixed(2)} Gy · Marrow Crit` : isRadiationActive ? `Flux ${radFlux.toFixed(1)} · Marrow Alert` : isSkeletalAlert ? `BMD ${bmd.toFixed(1)}% · Alert` : `BMD ${bmd.toFixed(1)}% · Nom`,
        functionSummary: 'Provides structural frame, protects vital organs, and serves as the mineral reservoir for calcium and phosphate. In microgravity, unweighted bones lose mineral density at 1–1.5% per month, with spinal disc expansion causing lumbar pain.',
        healthDetail: isRadiationCritical
          ? `Severe ionizing radiation penetration of pelvic and femoral bone marrow. Acute hematopoietic suppression risk (absorbed dose ${(radDose || 0.75).toFixed(2)} Gy).`
          : isRadiationActive
            ? 'Elevated bone marrow radiation exposure secondary to cosmic solar proton flux.'
            : isSkeletalAlert
              ? `Elevated trabecular demineralization and bone resorption flux. Axial spinal elongation noted.`
              : 'Bone mineral density (BMD Index) within acceptable spaceflight thresholds. Cortical matrix intact.',
        protocol: isRadiationActive
          ? 'Relocate to water-shielded storm shelter; cease physical exertion; monitor leukocyte count.'
          : isSkeletalAlert
            ? 'Increase ARED resistive squat/deadlift loading to 180 kN; add dietary vitamin D3 supplementation.'
            : 'Maintain standard daily ARED resistive deadlift & squat cycles (150 kN load target).',
        subsystemId: 'SKELETAL' as const,
      },
    ];
  }, [orbitalPosition, hr, spo2, hct, k, co2, temp, radFlux, radDose, trm, bmd, telemetry, isOcularAlert, clinical, ocularSeverity, cardiacSeverity, renalSeverity, skeletalSeverity, isCardiacCritical, isCardiacWarning, isRenalAlert, isRenalCritical, isSkeletalAlert, isRadiationActive, isRadiationCritical, currentScenario]);

  const activeDisplayTargets = anatomicalParts;
  const activeDisplayTargetsRef = useRef(activeDisplayTargets);
  useEffect(() => {
    activeDisplayTargetsRef.current = activeDisplayTargets;
  }, [activeDisplayTargets]);

  // Smooth View Snap Trigger
  const snapToAngle = useCallback((targetDeg: number) => {
    const rad = (targetDeg * Math.PI) / 180;
    snapTargetAzimuthRef.current = rad;
    setAutoRotate(false);
  }, []);

  // Reset Camera View
  const handleResetCamera = useCallback(() => {
    targetCameraPosRef.current = { x: 0, y: -0.05, z: 5.85 };
    targetControlsTargetRef.current = { x: 0, y: 0, z: 0 };
    snapTargetAzimuthRef.current = null;
    targetFocusYRef.current = null;
    targetCameraZRef.current = null;
    setAutoRotate(true);
    setShowOrganModal(false);
    setLaserMode('SWEEP');
  }, []);

  // Smoothly return 3D human body back to real/nominal center position when dismissing detail cards
  const handleCloseOrganModal = useCallback(() => {
    setShowOrganModal(false);
    targetCameraPosRef.current = { x: 0, y: -0.05, z: 5.85 };
    targetControlsTargetRef.current = { x: 0, y: 0, z: 0 };
    targetFocusYRef.current = null;
    targetCameraZRef.current = null;
    snapTargetAzimuthRef.current = null;
    setAutoRotate(true);
    setLaserMode('SWEEP');
  }, []);

  // Handle Anatomical Organ Selection & Cinematic Focus
  const handleOrganClick = useCallback((organ: typeof anatomicalParts[0]) => {
    targetCameraPosRef.current = null;
    targetControlsTargetRef.current = null;
    setSelectedOrganId(organ.id as any);
    setSelectedHotspot(organ.subsystemId);
    setShowOrganModal(true);
    targetFocusYRef.current = organ.scanTargetY;

    if (onSelectSubsystem) {
      onSelectSubsystem(organ.subsystemId);
    }
  }, [onSelectSubsystem]);

  // Unified Target Selector (Anatomy)
  const handleTargetSelect = useCallback((targetId: string) => {
    const organ = anatomicalParts.find(o => o.id === targetId) || anatomicalParts[0];
    handleOrganClick(organ);
  }, [anatomicalParts, handleOrganClick]);

  const handleTargetSelectRef = useRef(handleTargetSelect);
  useEffect(() => {
    handleTargetSelectRef.current = handleTargetSelect;
  }, [handleTargetSelect]);

  const inspectionModeRef = useRef(inspectionMode);
  useEffect(() => {
    inspectionModeRef.current = inspectionMode;
  }, [inspectionMode]);

  // ─── Three.js Scene Setup (Mounts STRICTLY ONCE) ───
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 540;
    const height = container.clientHeight || 500;
    containerSizeRef.current = { width, height };

    // 1. Scene & Transparent Renderer Setup (NO solid background, shows rotating Earth video!)
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, -0.05, 5.85);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'grab';

    // 2. OrbitControls with Smooth Damping
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.minDistance = 3.0;
    controls.maxDistance = 7.5;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.8;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 3. Ambient & Rim Lighting
    const ambientLight = new THREE.AmbientLight(0x0a2236, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x0088cc, 0.8);
    rimLight.position.set(-2, -1, -3);
    scene.add(rimLight);

    // ─── 4. Human Anatomical Model Group ───
    const humanGroup = new THREE.Group();
    humanGroup.scale.set(0.82, 0.82, 0.82);
    humanGroup.position.set(0, 0, 0);
    scene.add(humanGroup);

    // Luminous Radial Sprite Particle Textures (Soft celestial glow instead of square pixels)
    const createGlowTexture = (colorInner: string, colorMid: string, colorOuter: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, colorInner);
      grad.addColorStop(0.25, colorMid);
      grad.addColorStop(0.60, colorOuter);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const cyanGlowTex = createGlowTexture('#ffffff', 'rgba(120, 235, 255, 0.95)', 'rgba(0, 180, 240, 0.35)');
    const redGlowTex = createGlowTexture('#ffffff', 'rgba(255, 40, 80, 0.98)', 'rgba(220, 15, 50, 0.40)');
    const heartGlowTex = createGlowTexture('#ffffff', 'rgba(255, 20, 140, 1.0)', 'rgba(236, 72, 153, 0.45)');
    const lungGlowTex = createGlowTexture('#e0f7fe', 'rgba(56, 189, 248, 0.90)', 'rgba(6, 182, 212, 0.35)');
    const brainGlowTex = createGlowTexture('#ffffff', 'rgba(244, 63, 94, 0.95)', 'rgba(236, 72, 153, 0.40)');
    const boneGlowTex = createGlowTexture('#ffffff', 'rgba(180, 250, 240, 0.90)', 'rgba(45, 212, 191, 0.30)');

    // 4a-1. Volumetric Translucent Holographic 3D Body Mesh Surface
    // Ultra-ethereal transparency so internal skeleton, brain, arterial tree and heart shine through vividly
    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute('position', new THREE.BufferAttribute(HUMAN_VERTICES, 3));
    bodyGeo.setIndex(new THREE.BufferAttribute(HUMAN_TRI_INDICES, 1));
    bodyGeo.computeVertexNormals();

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x011d32,
      emissive: 0x00263e,
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.1,
      transmission: 0.60,
      ior: 1.34,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    humanGroup.add(bodyMesh);

    // 4a-2. Elegant Wireframe Polygon Lattice (subtle high-tech contour lines)
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.BufferAttribute(HUMAN_VERTICES, 3));
    wireGeo.setIndex(new THREE.BufferAttribute(HUMAN_LINE_INDICES, 1));
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00c8e6,
      transparent: true,
      opacity: 0.08,
    });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    humanGroup.add(wireMesh);

    // 4a-3. High-Density Celestial Stardust Point Cloud (Luminous glowing outer silhouette constellation)
    const stardustVertices = generateStardustPointCloud(HUMAN_VERTICES, HUMAN_LINE_INDICES, 18500);
    const stardustGeo = new THREE.BufferGeometry();
    stardustGeo.setAttribute('position', new THREE.BufferAttribute(stardustVertices, 3));

    const stardustMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.036,
      map: cyanGlowTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stardustMesh = new THREE.Points(stardustGeo, stardustMat);
    humanGroup.add(stardustMesh);

    // 4a-4. Authentic 3D Anatomical Internal Skeleton (Spine, Ribcage, Pelvis, Limbs, Skull)
    const skelLines = getSkeletonLineSegments();
    const skelGeo = new THREE.BufferGeometry();
    skelGeo.setAttribute('position', new THREE.BufferAttribute(skelLines, 3));

    const skelMat = new THREE.LineBasicMaterial({
      color: 0xccfbf1, // Luminous pale cyan-white bone
      transparent: true,
      opacity: 0.84,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const skelMesh = new THREE.LineSegments(skelGeo, skelMat);
    humanGroup.add(skelMesh);

    // Glowing Skeletal Joint/Disc Nodes
    const skelPts = getSkeletonPoints();
    const skelPtsGeo = new THREE.BufferGeometry();
    skelPtsGeo.setAttribute('position', new THREE.BufferAttribute(skelPts, 3));

    const skelPtsMat = new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.024,
      map: boneGlowTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const skelPtsMesh = new THREE.Points(skelPtsGeo, skelPtsMat);
    humanGroup.add(skelPtsMesh);

    // 4a-5. Cranial Neural Network / Holographic Brain
    const brainNet = getBrainNeuralNetwork();
    const brainGroup = new THREE.Group();
    humanGroup.add(brainGroup);

    const brainPtsGeo = new THREE.BufferGeometry();
    brainPtsGeo.setAttribute('position', new THREE.BufferAttribute(brainNet.points, 3));

    const brainPtsMat = new THREE.PointsMaterial({
      color: 0xff1493, // Vivid deep pink/magenta neural nodes
      size: 0.038,
      map: brainGlowTex,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const brainPtsMesh = new THREE.Points(brainPtsGeo, brainPtsMat);
    brainGroup.add(brainPtsMesh);

    const brainLinesGeo = new THREE.BufferGeometry();
    brainLinesGeo.setAttribute('position', new THREE.BufferAttribute(brainNet.lines, 3));

    const brainLinesMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e, // Rose pink synaptic web
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const brainLinesMesh = new THREE.LineSegments(brainLinesGeo, brainLinesMat);
    brainGroup.add(brainLinesMesh);

    // 4b. Glowing Scarlet Red Arterial / Vascular Tree (strictly nested inside body)
    const vascLines = getVascularLineSegments();
    const vascGeo = new THREE.BufferGeometry();
    vascGeo.setAttribute('position', new THREE.BufferAttribute(vascLines, 3));

    const vascMat = new THREE.LineBasicMaterial({
      color: 0xff173d,
      transparent: true,
      opacity: 0.95,
      linewidth: 2,
    });
    const vascMesh = new THREE.LineSegments(vascGeo, vascMat);
    humanGroup.add(vascMesh);

    // Glowing Red Arterial Nodes along the vessels
    const vascPts = getVascularPoints();
    const vascPtsGeo = new THREE.BufferGeometry();
    vascPtsGeo.setAttribute('position', new THREE.BufferAttribute(vascPts, 3));

    const vascPtsMat = new THREE.PointsMaterial({
      color: 0xff2a4d,
      size: 0.036,
      map: redGlowTex,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const vascPtsMesh = new THREE.Points(vascPtsGeo, vascPtsMat);
    humanGroup.add(vascPtsMesh);

    // 4c. Pulsing Hot Pink / Magenta Myocardium Node (Vivid pink heart in left chest)
    const heartGroup = new THREE.Group();
    humanGroup.add(heartGroup);

    const heartPts = getHeartPoints();
    const heartGeo = new THREE.BufferGeometry();
    heartGeo.setAttribute('position', new THREE.BufferAttribute(heartPts, 3));

    const heartMat = new THREE.PointsMaterial({
      color: 0xff007f, // Hot pink / magenta
      size: 0.056,
      map: heartGlowTex,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const heartMesh = new THREE.Points(heartGeo, heartMat);
    heartGroup.add(heartMesh);

    // Inner glowing myocardium core
    const heartCoreGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const heartCoreMat = new THREE.MeshBasicMaterial({
      color: 0xff1493,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const heartCore = new THREE.Mesh(heartCoreGeo, heartCoreMat);
    heartCore.position.set(-0.07, 0.74, 0.10);
    heartGroup.add(heartCore);

    // Volumetric Cardiac Aura Sphere (Pulsating biological glow)
    const heartAuraGeo = new THREE.SphereGeometry(0.075, 20, 20);
    const heartAuraMat = new THREE.MeshBasicMaterial({
      color: 0xff1055,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
    });
    const heartAura = new THREE.Mesh(heartAuraGeo, heartAuraMat);
    heartAura.position.set(-0.07, 0.74, 0.10);
    heartGroup.add(heartAura);

    // 4d. Volumetric Breathing Pulmonary Lungs Group
    const lungsGroup = new THREE.Group();
    humanGroup.add(lungsGroup);

    const lungMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
    });

    const leftLungGeo = new THREE.SphereGeometry(0.082, 14, 14);
    leftLungGeo.scale(0.85, 1.40, 0.75);
    const leftLungMesh = new THREE.Mesh(leftLungGeo, lungMat);
    leftLungMesh.position.set(0.08, 0.78, 0.07);
    lungsGroup.add(leftLungMesh);

    const rightLungGeo = new THREE.SphereGeometry(0.078, 14, 14);
    rightLungGeo.scale(0.82, 1.35, 0.72);
    const rightLungMesh = new THREE.Mesh(rightLungGeo, lungMat.clone());
    rightLungMesh.position.set(-0.09, 0.78, 0.07);
    lungsGroup.add(rightLungMesh);

    // Bronchial arborization branches (Trachea bifurcation into main left/right bronchi)
    const bronchusMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const bronchusPts = new Float32Array([
      // Carina bifurcation
      0, 0.88, 0.06,  -0.05, 0.80, 0.07,
      0, 0.88, 0.06,   0.05, 0.80, 0.07,
      // Left branches
      -0.05, 0.80, 0.07, -0.09, 0.75, 0.06,
      -0.05, 0.80, 0.07, -0.08, 0.72, 0.08,
      // Right branches
       0.05, 0.80, 0.07,  0.09, 0.75, 0.06,
       0.05, 0.80, 0.07,  0.08, 0.72, 0.08,
    ]);
    const bronchusGeo = new THREE.BufferGeometry();
    bronchusGeo.setAttribute('position', new THREE.BufferAttribute(bronchusPts, 3));
    const bronchusMesh = new THREE.LineSegments(bronchusGeo, bronchusMat);
    lungsGroup.add(bronchusMesh);

    // Alveolar gas-exchange particle cloud
    const alveoliPts: number[] = [];
    for (let p = 0; p < 70; p++) {
      const side = p % 2 === 0 ? 1 : -1;
      const lx = side * (0.04 + Math.random() * 0.055);
      const ly = 0.70 + Math.random() * 0.16;
      const lz = 0.03 + Math.random() * 0.06;
      alveoliPts.push(lx, ly, lz);
    }
    const alveoliGeo = new THREE.BufferGeometry();
    alveoliGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(alveoliPts), 3));
    const alveoliMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.030,
      map: lungGlowTex,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
    });
    const alveoliCloud = new THREE.Points(alveoliGeo, alveoliMat);
    lungsGroup.add(alveoliCloud);

    // 4e. Bilateral Glowing Renal Kidneys Group
    const kidneysGroup = new THREE.Group();
    humanGroup.add(kidneysGroup);

    const kidneyMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7, // Deep vivid purple / renal filtration
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    const kidneyGeo = new THREE.SphereGeometry(0.042, 12, 12);
    kidneyGeo.scale(0.8, 1.25, 0.7);

    const leftKidney = new THREE.Mesh(kidneyGeo, kidneyMat);
    leftKidney.position.set(-0.10, 0.20, 0.045);
    kidneysGroup.add(leftKidney);

    const rightKidney = new THREE.Mesh(kidneyGeo.clone(), kidneyMat.clone());
    rightKidney.position.set(0.10, 0.22, 0.045);
    kidneysGroup.add(rightKidney);

    const renalCoreMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const leftRenalCore = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), renalCoreMat);
    leftRenalCore.position.set(-0.10, 0.20, 0.045);
    kidneysGroup.add(leftRenalCore);

    const rightRenalCore = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), renalCoreMat);
    rightRenalCore.position.set(0.10, 0.22, 0.045);
    kidneysGroup.add(rightRenalCore);

    // 4f. Authentic 3D NASA Polar Target Scanner Grid Disc at floor (y = -1.78)
    const floorY = -1.78;
    const gridGroup = new THREE.Group();
    gridGroup.position.set(0, floorY, 0);
    humanGroup.add(gridGroup);

    const gridMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.55,
    });

    // 3 Concentric Target Rings (r = 0.35, 0.70, 1.05)
    [0.35, 0.70, 1.05].forEach((radius) => {
      const ringCurve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
      const ringPts = ringCurve.getPoints(48);
      const rGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      rGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.LineLoop(rGeo, gridMat);
      gridGroup.add(ringMesh);
    });

    // 8 Radial Spokes dividing the circle at 45° intervals
    const spokesPts: number[] = [];
    const numSpokes = 8;
    const outerR = 1.05;
    for (let s = 0; s < numSpokes; s++) {
      const angle = (s / numSpokes) * Math.PI * 2;
      spokesPts.push(0, 0, 0);
      spokesPts.push(Math.sin(angle) * outerR, 0, Math.cos(angle) * outerR);
    }
    const spokesGeo = new THREE.BufferGeometry();
    spokesGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(spokesPts), 3));
    const spokesMesh = new THREE.LineSegments(spokesGeo, gridMat);
    gridGroup.add(spokesMesh);

    // Rotating Radar Scanner Sweep Arm
    const radarArmPts = new Float32Array([0, 0.002, 0, 0, 0.002, outerR]);
    const radarArmGeo = new THREE.BufferGeometry();
    radarArmGeo.setAttribute('position', new THREE.BufferAttribute(radarArmPts, 3));
    const radarArmMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });
    const radarArmMesh = new THREE.Line(radarArmGeo, radarArmMat);
    gridGroup.add(radarArmMesh);

    // 4g. 3D Hotspot Target Reticles on the body for all anatomical parts & hazards
    const hotspot3DMeshes: THREE.Mesh[] = [];
    const hotspotRingMeshes: THREE.Mesh[] = [];
    const hotspotNodeMap: Record<string, { node: THREE.Mesh; ring: THREE.Mesh; mode: string }> = {};

    const allCandidateTargets = [
      { id: 'BRAIN', pos: [0.0, 1.30, 0.05], color: 0x38bdf8, subsystemId: 'OCULAR', mode: 'ANATOMY' },
      { id: 'HEART', pos: [-0.07, 0.72, 0.10], color: 0xec4899, subsystemId: 'CARDIAC', mode: 'ANATOMY' },
      { id: 'LUNGS', pos: [0.08, 0.80, 0.08], color: 0x06b6d4, subsystemId: 'CARDIAC', mode: 'ANATOMY' },
      { id: 'KIDNEYS', pos: [-0.10, 0.20, 0.05], color: 0xa855f7, subsystemId: 'RENAL', mode: 'ANATOMY' },
      { id: 'VASCULAR', pos: [0.16, 0.40, 0.04], color: 0xf43f5e, subsystemId: 'RENAL', mode: 'ANATOMY' },
      { id: 'SKELETAL', pos: [0.10, -0.65, 0.04], color: 0x14b8a6, subsystemId: 'SKELETAL', mode: 'ANATOMY' },
      { id: 'ISOLATION', pos: [0.0, 1.05, 0.05], color: 0x38bdf8, subsystemId: 'OCULAR', mode: 'HAZARDS' },
      { id: 'ENVIRONMENT', pos: [0.0, 0.60, 0.12], color: 0x00e5a3, subsystemId: 'CARDIAC', mode: 'HAZARDS' },
      { id: 'RADIATION', pos: [0.0, 0.15, 0.05], color: 0x00e5ff, subsystemId: 'RENAL', mode: 'HAZARDS' },
      { id: 'DISTANCE', pos: [0.15, 0.22, 0.04], color: 0x00e5a3, subsystemId: 'RENAL', mode: 'HAZARDS' },
      { id: 'GRAVITY', pos: [0.08, -0.60, 0.04], color: 0x00e5a3, subsystemId: 'SKELETAL', mode: 'HAZARDS' },
    ];

    allCandidateTargets.forEach(ht => {
      // Visual inner core node
      const g = new THREE.SphereGeometry(0.026, 16, 16);
      const m = new THREE.MeshBasicMaterial({ color: ht.color });
      const node = new THREE.Mesh(g, m);
      node.position.set(ht.pos[0], ht.pos[1], ht.pos[2]);
      node.userData = { id: ht.subsystemId, targetId: ht.id, mode: ht.mode };
      humanGroup.add(node);
      hotspot3DMeshes.push(node);

      // Dedicated enlarged 3D invisible pick volume for effortless click registration
      const hitG = new THREE.SphereGeometry(0.16, 12, 12);
      const hitM = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitG, hitM);
      hitMesh.position.set(ht.pos[0], ht.pos[1], ht.pos[2]);
      hitMesh.userData = { id: ht.subsystemId, targetId: ht.id, mode: ht.mode };
      humanGroup.add(hitMesh);
      hotspot3DMeshes.push(hitMesh);

      // Outer targeting ring
      const rGeo = new THREE.RingGeometry(0.046, 0.058, 24);
      const rMat = new THREE.MeshBasicMaterial({
        color: ht.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(ht.pos[0], ht.pos[1], ht.pos[2] + 0.01);
      rMesh.userData = { id: ht.subsystemId, targetId: ht.id, mode: ht.mode };
      humanGroup.add(rMesh);
      hotspotRingMeshes.push(rMesh);

      hotspotNodeMap[ht.id] = { node, ring: rMesh, mode: ht.mode };
    });

    // ─── 4f. NASA EVA Suit Model Group (High-Fidelity Space EMU) ───
    const suitGroup = new THREE.Group();
    suitGroup.visible = false;
    scene.add(suitGroup);

    // Strobe / Beacon lights on EVA Suit
    const helmetBeaconLight = new THREE.PointLight(0x00e5ff, 1.2, 2.5);
    helmetBeaconLight.position.set(0, 0.88, 0.22);
    suitGroup.add(helmetBeaconLight);

    const helmetBeaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    helmetBeaconMesh.position.set(0, 0.88, 0.22);
    suitGroup.add(helmetBeaconMesh);

    // Dual Umbilical Conduits (O2 and Liquid Cooling from PLSS to DCM Chest)
    const leftCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.22, 0.45, -0.32),
      new THREE.Vector3(-0.35, 0.32, -0.12),
      new THREE.Vector3(-0.26, 0.14, 0.20),
      new THREE.Vector3(-0.08, 0.24, 0.26),
    ]);
    const leftTubeGeo = new THREE.TubeGeometry(leftCurve, 32, 0.018, 10, false);
    const leftTubeMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x007799,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7,
    });
    const leftTubeMesh = new THREE.Mesh(leftTubeGeo, leftTubeMat);
    suitGroup.add(leftTubeMesh);

    const rightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.22, 0.45, -0.32),
      new THREE.Vector3(0.35, 0.32, -0.12),
      new THREE.Vector3(0.26, 0.14, 0.20),
      new THREE.Vector3(0.08, 0.24, 0.26),
    ]);
    const rightTubeGeo = new THREE.TubeGeometry(rightCurve, 32, 0.018, 10, false);
    const rightTubeMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7,
    });
    const rightTubeMesh = new THREE.Mesh(rightTubeGeo, rightTubeMat);
    suitGroup.add(rightTubeMesh);

    const suitLoader = new GLTFLoader();
    suitLoader.load(
      '/models/Astronaut.glb',
      (gltf) => {
        const rawModel = gltf.scene;
        const suitMeshContainer = new THREE.Group();

        // Visor gold reflective material
        const visorMat = new THREE.MeshStandardMaterial({
          color: 0xffb700,
          metalness: 0.95,
          roughness: 0.12,
          emissive: 0x442800,
          emissiveIntensity: 0.4,
        });

        // NASA White Suit composite weave
        const suitMat = new THREE.MeshStandardMaterial({
          color: 0xebf2f8,
          metalness: 0.22,
          roughness: 0.65,
          emissive: 0x091420,
          emissiveIntensity: 0.25,
        });

        // Edge highlights for holographic AR definition
        const edgeLineMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
        });

        rawModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geo = mesh.geometry.clone();

            const nameLower = (mesh.name || '').toLowerCase();
            const isVisor = nameLower.includes('visor') || nameLower.includes('glass') || nameLower.includes('face');

            const renderedMesh = new THREE.Mesh(geo, isVisor ? visorMat : suitMat);
            suitMeshContainer.add(renderedMesh);

            const edgesGeo = new THREE.EdgesGeometry(geo, 25);
            const edgeLines = new THREE.LineSegments(edgesGeo, edgeLineMat);
            suitMeshContainer.add(edgeLines);
          }
        });

        const rawBox = new THREE.Box3().setFromObject(suitMeshContainer);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const targetH = 2.42;
        const scaleFactor = targetH / (rawSize.y || 1);
        suitMeshContainer.scale.set(scaleFactor * 0.88, scaleFactor, scaleFactor * 0.88);
        suitMeshContainer.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(suitMeshContainer);
        const center = scaledBox.getCenter(new THREE.Vector3());
        suitMeshContainer.position.set(-center.x, -center.y, -center.z);
        suitMeshContainer.updateMatrixWorld(true);

        suitGroup.add(suitMeshContainer);
      },
      undefined,
      (err) => console.warn('Could not load Astronaut.glb:', err)
    );

    switchModelRef.current = (type: 'HUMAN' | 'SUIT') => {
      modelTypeRef.current = type;
      setModelType(type);
      if (type === 'HUMAN') {
        humanGroup.visible = true;
        suitGroup.visible = false;
      } else {
        humanGroup.visible = false;
        suitGroup.visible = true;
      }
    };

    focusSuitSubsystemRef.current = (id: 'VISOR' | 'PLSS' | 'DCM' | 'SAFER' | 'TMG') => {
      const sub = suitSubsystems.find(s => s.id === id);
      if (!sub) return;
      setSelectedSuitSubsystem(id);
      targetFocusYRef.current = sub.targetY;
    };

    // ─── 5. Optional Laser Scanner Plane ───
    const scanGroup = new THREE.Group();
    scene.add(scanGroup);

    const laserBeamPts = new Float32Array([-1.1, 0, 0, 1.1, 0, 0]);
    const laserBeamGeo = new THREE.BufferGeometry();
    laserBeamGeo.setAttribute('position', new THREE.BufferAttribute(laserBeamPts, 3));
    const laserBeamMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const laserBeamLine = new THREE.Line(laserBeamGeo, laserBeamMat);
    scanGroup.add(laserBeamLine);

    const scanSheetGeo = new THREE.PlaneGeometry(2.2, 0.28);
    scanSheetGeo.rotateX(Math.PI / 2);
    const scanSheetMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const scanSheet = new THREE.Mesh(scanSheetGeo, scanSheetMat);
    scanGroup.add(scanSheet);

    const sliceCurve = new THREE.EllipseCurve(0, 0, 1, 1, 0, 2 * Math.PI, false, 0);
    const slicePoints = sliceCurve.getPoints(48);
    const sliceGeo = new THREE.BufferGeometry().setFromPoints(slicePoints);
    sliceGeo.rotateX(Math.PI / 2);
    const sliceMat = new THREE.LineBasicMaterial({
      color: 0x80f5ff,
      transparent: true,
      opacity: 0.90,
    });
    const sliceContourLine = new THREE.LineLoop(sliceGeo, sliceMat);
    scanGroup.add(sliceContourLine);

    const scanLight = new THREE.PointLight(0x00e5ff, 2.2, 2.4);
    scanGroup.add(scanLight);

    updateMaterialsRef.current = (theme: string, severity: 'CRITICAL' | 'WARNING' | 'NOMINAL') => {
      let pColor = 0x5ce1e6;
      let vColor = 0xff173d;
      let vpColor = 0xff2a4d;
      let hColor = 0xff007f;
      let hcColor = 0xff1493;
      let baseColor = 0x00e5ff;
      let bodyCol = 0x002638;
      let bodyEmis = 0x00121d;
      let wireCol = 0x00c8e6;
      let skelColor = 0xccfbf1;
      let skelPtsColor = 0x5eead4;
      let brainColor = 0xff1493;
      let brainLineColor = 0xf43f5e;
      let radarColor = 0x00f0ff;

      if (severity === 'CRITICAL') {
        pColor = 0xff3b5c; // Vivid crimson stardust
        vColor = 0xff0033; // Emergency deep red vascular network
        vpColor = 0xff173d;
        hColor = 0xff173d; // Pulsing emergency myocardium
        hcColor = 0xcc0022;
        baseColor = 0xef4444; // Emergency red pedestal
        bodyCol = 0x3d0b14; // Alert deep crimson anatomical silhouette
        bodyEmis = 0x220509;
        wireCol = 0xff2244; // Vibrant alert red wireframe!
        skelColor = 0xff8899;
        skelPtsColor = 0xff3b5c;
        brainColor = 0xff0055;
        brainLineColor = 0xff173d;
        radarColor = 0xef4444;
      } else if (severity === 'WARNING') {
        pColor = 0xfbbf24; // Tactical amber stardust
        vColor = 0xd97706; // Amber vascular network
        vpColor = 0xf59e0b;
        hColor = 0xf59e0b; // Amber myocardium
        hcColor = 0xb45309;
        baseColor = 0xf59e0b; // Tactical amber pedestal
        bodyCol = 0x2e1e04; // Alert deep amber silhouette
        bodyEmis = 0x1a1102;
        wireCol = 0xf59e0b; // Vibrant tactical amber wireframe!
        skelColor = 0xfde68a;
        skelPtsColor = 0xfbbf24;
        brainColor = 0xf59e0b;
        brainLineColor = 0xd97706;
        radarColor = 0xf59e0b;
      } else if (theme === 'THERMAL') {
        pColor = 0xff9933; // Infrared warm orange
        vColor = 0xff3300; // Fiery crimson heat vessels
        vpColor = 0xff4500;
        hColor = 0xffffff; // Incandescent white-hot metabolic core
        hcColor = 0xff5500;
        baseColor = 0xff7700;
        bodyCol = 0x4a1800;
        bodyEmis = 0x240c00;
        wireCol = 0xff6600;
        skelColor = 0xffffff;
        skelPtsColor = 0xffeedd;
        brainColor = 0xffaa00;
        brainLineColor = 0xff5500;
        radarColor = 0xff7700;
      } else if (theme === 'AMBER') {
        pColor = 0xf59e0b; // Apollo/Orion tactical amber phosphor
        vColor = 0xd97706; // Deep gold
        vpColor = 0xfbbf24;
        hColor = 0xfbbf24; // Amber myocardium
        hcColor = 0xf59e0b;
        baseColor = 0xf59e0b;
        bodyCol = 0x3d2800;
        bodyEmis = 0x1f1400;
        wireCol = 0xf59e0b;
        skelColor = 0xfde68a;
        skelPtsColor = 0xfbbf24;
        brainColor = 0xf59e0b;
        brainLineColor = 0xd97706;
        radarColor = 0xf59e0b;
      }

      bodyMat.color.setHex(bodyCol);
      bodyMat.emissive.setHex(bodyEmis);
      wireMat.color.setHex(wireCol);
      stardustMat.color.setHex(pColor);
      skelMat.color.setHex(skelColor);
      skelPtsMat.color.setHex(skelPtsColor);
      brainPtsMat.color.setHex(brainColor);
      brainLinesMat.color.setHex(brainLineColor);
      vascMat.color.setHex(vColor);
      vascPtsMat.color.setHex(vpColor);
      heartMat.color.setHex(hColor);
      heartCoreMat.color.setHex(hcColor);
      gridMat.color.setHex(baseColor);
      radarArmMat.color.setHex(radarColor);
      scanSheetMat.color.setHex(pColor);
      sliceMat.color.setHex(pColor);
      scanLight.color.setHex(severity === 'CRITICAL' ? 0xff173d : severity === 'WARNING' ? 0xf59e0b : pColor);
    };

    // Apply initial materials on mount
    updateMaterialsRef.current(colorTheme, activeSeverityRef.current);

    // ─── 6. Pointer & Raycasting Event Handling ───
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      renderer.domElement.style.cursor = 'grabbing';
      snapTargetAzimuthRef.current = null;
    };

    const onPointerUp = (e: PointerEvent) => {
      renderer.domElement.style.cursor = 'grab';

      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);

      if (dx < 6 && dy < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);

        // Raycast against all interactive anatomical elements: reticles, organs, skeleton, and body silhouette
        const candidateObjects = [
          ...hotspot3DMeshes.filter(m => m.visible !== false),
          heartCore,
          leftLungMesh,
          rightLungMesh,
          leftKidney,
          rightKidney,
          bodyMesh,
          skelMesh,
          vascMesh,
          ...(modelTypeRef.current === 'SUIT' ? [suitGroup] : []),
        ].filter(Boolean);

        const intersects = raycaster.intersectObjects(candidateObjects, true);
        if (intersects.length > 0) {
          // Priority 1: Check if any intersected object is a direct hotspot reticle or dedicated hit volume
          const hotspotHit = intersects.find(hit => hit.object.userData?.targetId);
          if (hotspotHit) {
            handleTargetSelectRef.current(hotspotHit.object.userData.targetId);
            return;
          }

          // Priority 2: Check if any intersected object is a direct organ mesh
          const organHit = intersects.find(hit => 
            hit.object === leftLungMesh || hit.object === rightLungMesh ||
            hit.object === heartCore ||
            hit.object === leftKidney || hit.object === rightKidney
          );
          if (organHit) {
            if (organHit.object === leftLungMesh || organHit.object === rightLungMesh) {
              handleTargetSelectRef.current('LUNGS');
              return;
            }
            if (organHit.object === heartCore) {
              handleTargetSelectRef.current('HEART');
              return;
            }
            if (organHit.object === leftKidney || organHit.object === rightKidney) {
              handleTargetSelectRef.current('KIDNEYS');
              return;
            }
          }

          // Priority 3: Body Mesh / Surface click: calculate precise anatomical region
          const hit = intersects[0];
          const localPt = humanGroup.worldToLocal(hit.point.clone());
          const y = localPt.y;
          const x = localPt.x;
          const z = localPt.z;

          if (modelTypeRef.current === 'SUIT') {
            if (z < -0.12) {
              focusSuitSubsystemRef.current?.('PLSS');
            } else if (y > 0.65) {
              focusSuitSubsystemRef.current?.('VISOR');
            } else if (y > 0.15) {
              focusSuitSubsystemRef.current?.('DCM');
            } else if (y > -0.25) {
              focusSuitSubsystemRef.current?.('SAFER');
            } else {
              focusSuitSubsystemRef.current?.('TMG');
            }
            return;
          }

          let targetOrgan: 'BRAIN' | 'HEART' | 'LUNGS' | 'KIDNEYS' | 'VASCULAR' | 'SKELETAL' = 'HEART';
          // 1. Head / Cranial / Eyes
          if (y >= 1.05) {
            targetOrgan = 'BRAIN';
          }
          // 2. Lower Pelvis, Legs, Knees, Feet
          else if (y < 0.0) {
            targetOrgan = 'SKELETAL';
          }
          // 3. Torso: High-precision anatomical distance matching
          else {
            const heartDist = Math.hypot(x - (-0.07), (y - 0.74) * 1.25, (z - 0.09) * 0.9);
            const leftLungDist = Math.hypot(x - 0.09, (y - 0.78) * 1.15, (z - 0.06) * 0.9);
            const rightLungDist = Math.hypot(x - (-0.09), (y - 0.78) * 1.15, (z - 0.06) * 0.9);
            const lungsDist = Math.min(leftLungDist, rightLungDist);
            const vascDist = Math.hypot(x - 0.02, (y - 0.44) * 1.15, z - 0.05);
            const kidneyDist = Math.min(
              Math.hypot(x - (-0.11), (y - 0.20) * 1.2, z - 0.045),
              Math.hypot(x - 0.11, (y - 0.20) * 1.2, z - 0.045)
            );

            // Posterior spine bias if clicked from behind
            if (z < -0.07 && Math.abs(x) < 0.08) {
              targetOrgan = 'SKELETAL';
            } else {
              const minDist = Math.min(heartDist, lungsDist, vascDist, kidneyDist);
              if (minDist === heartDist && heartDist < 0.24) {
                targetOrgan = 'HEART';
              } else if (minDist === lungsDist && lungsDist < 0.28) {
                targetOrgan = 'LUNGS';
              } else if (minDist === kidneyDist && kidneyDist < 0.26) {
                targetOrgan = 'KIDNEYS';
              } else if (minDist === vascDist && vascDist < 0.26) {
                targetOrgan = 'VASCULAR';
              } else if (y > 0.60) {
                targetOrgan = x < -0.03 ? 'HEART' : 'LUNGS';
              } else if (y > 0.32) {
                targetOrgan = 'VASCULAR';
              } else {
                targetOrgan = 'KIDNEYS';
              }
            }
          }
          handleTargetSelectRef.current(targetOrgan);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (snapTargetAzimuthRef.current !== null) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const candidateObjects = [
        ...hotspot3DMeshes.filter(m => m.visible !== false),
        bodyMesh,
        heartCore,
        leftLungMesh,
        rightLungMesh,
        leftKidney,
        rightKidney,
        ...(modelTypeRef.current === 'SUIT' ? [suitGroup] : []),
      ].filter(Boolean);
      const intersects = raycaster.intersectObjects(candidateObjects, true);
      renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointermove', onPointerMove);

    // ─── 7. Animation Loop (60 FPS Tracking & Pulsing) ───
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let currentScanY = 0;
    let targetScanY = 0;

    const getRegionName = (y: number): string => {
      if (y > 1.10) return 'CRANIAL / ISOLATION';
      if (y > 0.75) return 'THORACIC / ENVIRONMENT';
      if (y > 0.40) return 'CARDIAC / MYOCARDIUM';
      if (y > 0.05) return 'ABDOMINAL / RADIATION';
      if (y > -0.30) return 'PELVIC / DISTANCE';
      if (y > -0.85) return 'FEMORAL / GRAVITY';
      if (y > -1.25) return 'TIBIAL / LOWER PERIPHERY';
      return 'PLANTAR / BASE';
    };

    const tempVec = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Handle smooth view snap animation
      if (snapTargetAzimuthRef.current !== null) {
        const currentAz = controls.getAzimuthalAngle();
        const diff = snapTargetAzimuthRef.current - currentAz;
        if (Math.abs(diff) > 0.02) {
          controls.autoRotate = false;
          const step = diff * 0.12;
          camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), step);
        } else {
          snapTargetAzimuthRef.current = null;
        }
      }

      controls.update();

      // Handle smooth vertical focus pan animation & centering return
      if (targetFocusYRef.current !== null) {
        const curY = controls.target.y;
        const diffY = targetFocusYRef.current - curY;
        if (Math.abs(diffY) > 0.005) {
          controls.target.y += diffY * 0.08;
        } else {
          controls.target.y = targetFocusYRef.current;
          if (targetFocusYRef.current === 0) {
            targetFocusYRef.current = null;
          }
        }
        if (targetFocusYRef.current === 0) {
          const diffCamY = -0.05 - camera.position.y;
          if (Math.abs(diffCamY) > 0.005) {
            camera.position.y += diffCamY * 0.08;
          }
        }
        if (Math.abs(controls.target.x) > 0.005) {
          controls.target.x += (0 - controls.target.x) * 0.08;
        }
        if (Math.abs(controls.target.z) > 0.005) {
          controls.target.z += (0 - controls.target.z) * 0.08;
        }
      }

      // Handle smooth camera zoom/distance return animation
      if (targetCameraZRef.current !== null) {
        const curLen = camera.position.length();
        const diffLen = targetCameraZRef.current - curLen;
        if (Math.abs(diffLen) > 0.02) {
          camera.position.setLength(curLen + diffLen * 0.08);
        } else {
          camera.position.setLength(targetCameraZRef.current);
          targetCameraZRef.current = null;
        }
      }

      // Smooth return for controls.target
      if (targetControlsTargetRef.current) {
        controls.target.x += (targetControlsTargetRef.current.x - controls.target.x) * 0.08;
        controls.target.y += (targetControlsTargetRef.current.y - controls.target.y) * 0.08;
        controls.target.z += (targetControlsTargetRef.current.z - controls.target.z) * 0.08;
        if (
          Math.abs(targetControlsTargetRef.current.x - controls.target.x) < 0.003 &&
          Math.abs(targetControlsTargetRef.current.y - controls.target.y) < 0.003 &&
          Math.abs(targetControlsTargetRef.current.z - controls.target.z) < 0.003
        ) {
          controls.target.set(
            targetControlsTargetRef.current.x,
            targetControlsTargetRef.current.y,
            targetControlsTargetRef.current.z
          );
          targetControlsTargetRef.current = null;
        }
      }

      // Smooth return for camera.position
      if (targetCameraPosRef.current) {
        camera.position.x += (targetCameraPosRef.current.x - camera.position.x) * 0.08;
        camera.position.y += (targetCameraPosRef.current.y - camera.position.y) * 0.08;
        camera.position.z += (targetCameraPosRef.current.z - camera.position.z) * 0.08;
        if (
          Math.abs(targetCameraPosRef.current.x - camera.position.x) < 0.005 &&
          Math.abs(targetCameraPosRef.current.y - camera.position.y) < 0.005 &&
          Math.abs(targetCameraPosRef.current.z - camera.position.z) < 0.005
        ) {
          camera.position.set(
            targetCameraPosRef.current.x,
            targetCameraPosRef.current.y,
            targetCameraPosRef.current.z
          );
          targetCameraPosRef.current = null;
          if (autoRotateRef.current) {
            controls.autoRotate = true;
          }
        }
      }

      // Azimuth HUD text
      if (azimuthDomRef.current) {
        const rawAz = controls.getAzimuthalAngle();
        const deg = Math.round((((rawAz % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2)) * 360);
        azimuthDomRef.current.textContent = `${deg}°`;
      }

      // Laser Scanner Plane
      const mode = laserModeRef.current;
      if (mode === 'OFF') {
        scanGroup.visible = false;
      } else {
        scanGroup.visible = true;
        if (mode === 'SWEEP') {
          const cycle = (Math.sin(elapsed * 1.25) + 1) * 0.5;
          targetScanY = -1.60 + cycle * (1.35 - (-1.60));
          currentScanY += (targetScanY - currentScanY) * 0.15;
        } else if (mode === 'LOCK_ORGAN') {
          const activeHs = hotspots.find(h => h.id === selectedHotspotRef.current);
          targetScanY = activeHs ? activeHs.scanTargetY : 0.70;
          currentScanY += (targetScanY - currentScanY) * 0.10;
        }

        scanGroup.position.y = currentScanY;
        const contour = getBodyContourRadii(currentScanY);
        sliceContourLine.scale.set(contour.rx * 1.08, 1, contour.rz * 1.08);
        scanSheetMat.opacity = 0.20;

        if (elevationDomRef.current) {
          elevationDomRef.current.textContent = `${currentScanY >= 0 ? '+' : ''}${currentScanY.toFixed(2)} m`;
        }
        if (regionDomRef.current) {
          regionDomRef.current.textContent = getRegionName(currentScanY);
        }
        if (sliceIndexDomRef.current) {
          const sliceNum = Math.round(((currentScanY + 1.60) / 2.95) * 128);
          sliceIndexDomRef.current.textContent = `#${Math.max(1, Math.min(128, sliceNum))}`;
        }
        if (elevationRulerChevronRef.current) {
          const pct = Math.max(0, Math.min(100, ((currentScanY + 1.60) / 2.95) * 100));
          elevationRulerChevronRef.current.style.bottom = `${pct}%`;
        }
      }

      // ─── Real-Time Floor Radar Sweep Rotation ───
      radarArmMesh.rotation.y = elapsed * 1.5;

      // ─── Real-Time Brainwave Synaptic Pulsation ───
      const brainPulse = 1.0 + 0.045 * Math.sin(elapsed * 2.8);
      brainGroup.scale.set(brainPulse, brainPulse, brainPulse);

      // ─── Real-Time Double-Beat Pulsing Heart ───
      const currentHr = hrRef.current || 72;
      const bps = (currentHr / 60) * Math.PI * 2;
      const pulseScale = 1.0 + 0.26 * Math.pow(Math.sin(elapsed * bps), 4);
      heartGroup.scale.set(pulseScale, pulseScale, pulseScale);

      // ─── Real-Time Pulmonary Lungs Breathing ───
      const lungBreath = 1.0 + 0.05 * Math.sin(elapsed * 2.0);
      lungsGroup.scale.set(lungBreath, lungBreath, lungBreath);

      // ─── Real-Time Renal Kidneys Filtration Pulse ───
      const kidneyPulse = 1.0 + 0.04 * Math.sin(elapsed * 1.6);
      kidneysGroup.scale.set(kidneyPulse, kidneyPulse, kidneyPulse);

      // ─── Real-Time Microgravity EVA Spacesuit Floating & Strobe Animation ───
      if (modelTypeRef.current === 'SUIT') {
        suitGroup.position.y = Math.sin(elapsed * 1.25) * 0.035;
        suitGroup.rotation.z = Math.sin(elapsed * 0.65) * 0.016;
        suitGroup.rotation.x = Math.sin(elapsed * 0.85) * 0.012;

        const beaconPulse = 0.5 + 0.5 * Math.sin(elapsed * 3.5);
        helmetBeaconLight.intensity = 0.6 + 1.2 * beaconPulse;
        helmetBeaconMesh.scale.setScalar(0.9 + 0.3 * beaconPulse);
      }

      // ─── Real-Time 3D Mesh Visibility, Colors & Pulsation ───
      const currentMode = inspectionModeRef.current;
      allCandidateTargets.forEach(t => {
        const entry = hotspotNodeMap[t.id];
        if (entry) {
          const isVis = entry.mode === currentMode;
          entry.node.visible = isVis;
          entry.ring.visible = isVis;
        }
      });

      activeDisplayTargetsRef.current.forEach((t) => {
        const entry = hotspotNodeMap[t.id];
        if (entry) {
          (entry.node.material as THREE.MeshBasicMaterial).color.set(t.color);
          (entry.ring.material as THREE.MeshBasicMaterial).color.set(t.color);
          entry.ring.scale.setScalar(1.0);
        }
      });

      // Rock-solid steady holographic lighting & wireframe (no automatic blinking/strobing)
      const curSev = activeSeverityRef.current;
      if (curSev === 'CRITICAL') {
        wireMat.opacity = 0.22;
        scanLight.intensity = 2.4;
      } else if (curSev === 'WARNING') {
        wireMat.opacity = 0.16;
        scanLight.intensity = 2.2;
      } else {
        wireMat.opacity = 0.09;
        scanLight.intensity = 2.2;
      }

      // ─── Project 3D Hotspot Targets to 2D Screen for Dotted Leader Lines ───
      const curW = containerSizeRef.current.width;
      const curH = containerSizeRef.current.height;

      if (showBadgesRef.current) {
        activeDisplayTargetsRef.current.forEach(ht => {
          tempVec.set(ht.pos[0], ht.pos[1], ht.pos[2]);
          tempVec.applyMatrix4(humanGroup.matrixWorld);
          tempVec.project(camera);

          const screenX = ((tempVec.x + 1) / 2) * curW;
          const screenY = ((-tempVec.y + 1) / 2) * curH;

          // Position 2D Hotspot Reticle Ring
          const ringEl = ringRefs.current[ht.id];
          if (ringEl) {
            ringEl.style.transform = `translate(${screenX - 17}px, ${screenY - 17}px)`;
            const ringCircle = ringEl.querySelector('.reticle-ring-circle') as HTMLElement;
            if (ringCircle) {
              ringCircle.style.borderColor = ht.color;
              ringCircle.style.boxShadow = `0 0 12px ${ht.color}`;
            }
            const innerDot = ringEl.querySelector('.reticle-inner-dot') as HTMLElement;
            if (innerDot) {
              innerDot.style.background = ht.color;
              innerDot.style.boxShadow = `0 0 8px ${ht.color}`;
            }
          }

          // Draw Dotted Leader Line from Badge to Hotspot (Pixel-Perfect Dynamic Connection)
          const lineEl = lineRefs.current[ht.id];
          if (lineEl) {
            const badgeEl = badgeRefs.current[ht.id];
            let badgeAnchorX = ht.side === 'LEFT' ? 145 : curW - 145;
            let badgeAnchorY = curH * 0.5;

            if (badgeEl && mountRef.current) {
              const bRect = badgeEl.getBoundingClientRect();
              const cRect = mountRef.current.getBoundingClientRect();
              badgeAnchorY = (bRect.top - cRect.top) + bRect.height * 0.5;
              badgeAnchorX = ht.side === 'LEFT' ? (bRect.right - cRect.left) : (bRect.left - cRect.left);
            }

            lineEl.setAttribute('x1', String(badgeAnchorX));
            lineEl.setAttribute('y1', String(badgeAnchorY));
            lineEl.setAttribute('x2', String(screenX));
            lineEl.setAttribute('y2', String(screenY));
            lineEl.setAttribute('stroke', ht.color);
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // ─── Responsive ResizeObserver ───
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          containerSizeRef.current = { width: w, height: h };
          camera.aspect = w / h;
          if (w < 480) {
            camera.position.z = 5.8;
          } else if (w < 640) {
            camera.position.z = 5.4;
          } else {
            camera.position.z = 5.2;
          }
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container && dom) {
        container.removeChild(dom);
      }
    };
  }, []);

  // Target Icon Selector for Anatomical Organs
  const renderTargetIcon = (id: string, color: string) => {
    switch (id) {
      case 'BRAIN':
        return <Brain size={16} color={color} />;
      case 'HEART':
        return <Heart size={16} color={color} />;
      case 'LUNGS':
        return <Wind size={16} color={color} />;
      case 'KIDNEYS':
        return <Droplets size={16} color={color} />;
      case 'VASCULAR':
        return <Activity size={16} color={color} />;
      case 'SKELETAL':
        return <Bone size={16} color={color} />;
      default:
        return <Activity size={16} color={color} />;
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(12, 19, 32, 0.60) 0%, rgba(6, 10, 18, 0.72) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "var(--hud-font-sans, 'Tomorrow', -apple-system, BlinkMacSystemFont, sans-serif)",
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    }}>
      {/* ─── Top Technical Header Strip ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        background: 'rgba(7, 12, 22, 0.75)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
            {crewNo} · {astronautName.toUpperCase()}
          </span>
        </div>

        {/* Operational Controls: Model Selector, Sensor Themes & View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* 3D Model Mode: Body vs Spacesuit */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 7,
              padding: 2,
              gap: 2,
            }}
          >
            <button
              onClick={() => {
                switchModelRef.current && switchModelRef.current('HUMAN');
                handleCloseOrganModal();
              }}
              style={{
                background: modelType === 'HUMAN' ? 'rgba(56, 189, 248, 0.24)' : 'transparent',
                border: modelType === 'HUMAN' ? '1px solid #38bdf8' : '1px solid transparent',
                color: modelType === 'HUMAN' ? '#38bdf8' : '#94a3b8',
                borderRadius: 5,
                padding: '4px 9px',
                fontSize: 10,
                fontWeight: modelType === 'HUMAN' ? 700 : 500,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.14s ease',
              }}
            >
              <User size={12} />
              <span>3D Body</span>
            </button>
            <button
              onClick={() => {
                switchModelRef.current && switchModelRef.current('SUIT');
                handleCloseOrganModal();
              }}
              style={{
                background: modelType === 'SUIT' ? 'rgba(56, 189, 248, 0.24)' : 'transparent',
                border: modelType === 'SUIT' ? '1px solid #38bdf8' : '1px solid transparent',
                color: modelType === 'SUIT' ? '#38bdf8' : '#94a3b8',
                borderRadius: 5,
                padding: '4px 9px',
                fontSize: 10,
                fontWeight: modelType === 'SUIT' ? 700 : 500,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.14s ease',
              }}
            >
              <Shield size={12} />
              <span>EVA Suit</span>
            </button>
          </div>

          <span style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.12)' }} />

          {/* ── INSPECTION MODE: ANATOMY & ORGANS ── */}
          <button
            onClick={() => {
              setShowOrganModal(true);
            }}
            title="Inspect Human Biological Anatomy: Brain, Heart, Lungs, Kidneys, Vascular Network, Skeletal Structure"
            style={{
              background: 'rgba(56, 189, 248, 0.24)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              borderRadius: 7,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.14s ease',
            }}
          >
            <Heart size={12} color="#38bdf8" />
            <span>Anatomy & Organs</span>
          </button>

          <span style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.12)' }} />

          {/* ── SENSOR THEME MODE SELECTOR (CYAN, THERMAL, AMBER) ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 7,
              padding: 2,
              gap: 2,
            }}
          >
            {[
              {
                id: 'CYAN' as const,
                label: 'CYAN',
                sub: 'Bio-Holo',
                title: 'Holographic Bio-Scanner: Cyan stardust point cloud & arterial network for structural anatomy and cephalic fluid shift tracking (NASA-STD-3001).',
                accent: '#00e5ff',
                icon: Activity,
              },
              {
                id: 'THERMAL' as const,
                label: 'THERMAL',
                sub: 'IR Heatmap',
                title: 'Infrared Biomedical Thermography: Visualizes metabolic core heat accumulation, EVA exertion dissipation, and thermal strain gradients.',
                accent: '#ff8833',
                icon: Flame,
              },
              {
                id: 'AMBER' as const,
                label: 'AMBER',
                sub: 'Tactical HUD',
                title: 'Tactical Flight HUD: Apollo/Orion high-contrast amber phosphor mode for high-vibration flight phases and urgent physiological anomaly sentry.',
                accent: '#f59e0b',
                icon: Sun,
              },
            ].map(t => {
              const active = colorTheme === t.id;
              const IconComponent = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setColorTheme(t.id)}
                  title={t.title}
                  style={{
                    background: active ? `${t.accent}2c` : 'transparent',
                    border: active ? `1px solid ${t.accent}` : '1px solid transparent',
                    color: active ? t.accent : '#94a3b8',
                    borderRadius: 5,
                    padding: '4px 9px',
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: active ? `0 0 10px ${t.accent}40` : 'none',
                    transition: 'all 0.14s ease',
                  }}
                >
                  <IconComponent size={12} color={active ? t.accent : '#94a3b8'} />
                  <span>{t.label}</span>
                  <span style={{ fontSize: 8.5, opacity: active ? 0.95 : 0.6 }}>
                    ({t.sub})
                  </span>
                </button>
              );
            })}
          </div>

          <span style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.12)' }} />

          {/* Layout Toggle: Split vs Full 3D Focus */}
          <button
            onClick={() => setViewMode(prev => prev === 'SPLIT' ? 'FULL' : 'SPLIT')}
            title="Toggle between full 3D view and split telemetry inspection"
            style={{
              background: viewMode === 'FULL' ? 'rgba(0, 229, 255, 0.22)' : 'rgba(255, 255, 255, 0.06)',
              border: viewMode === 'FULL' ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.12)',
              color: viewMode === 'FULL' ? '#00e5ff' : '#cbd5e1',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.14s ease',
            }}
          >
            {viewMode === 'FULL' ? (
              <>
                <Columns2 size={12} />
                <span>Split Telemetry</span>
              </>
            ) : (
              <>
                <Maximize2 size={12} />
                <span>Full 3D View</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Main 3D Viewport & Inspection Split Card (Fluid Aerospace 470px Framing) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'FULL' ? '1fr' : 'minmax(480px, 1fr) 310px',
        height: 470,
        maxHeight: 520,
        position: 'relative',
      }}>
        {/* Left: 3D Holographic Canvas Viewport (100% Transparent to show rotating Earth video!) */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: 'transparent',
        }}>
          {/* WebGL Canvas Container */}
          <div ref={mountRef} style={{ width: '100%', height: '100%', background: 'transparent' }} />

          {/* ── SVG OVERLAY FOR DOTTED LEADER LINES ── */}
          {showBadges && (
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {activeDisplayTargets.map(t => (
                <line
                  key={t.id}
                  ref={el => { lineRefs.current[t.id] = el; }}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="0"
                  stroke={t.color}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity={selectedOrganId === t.id ? 0.95 : 0.45}
                />
              ))}
            </svg>
          )}

          {/* ── 2D HOTSPOT RETICLE RINGS ON BODY (TRACKED AT 60 FPS) ── */}
          {showBadges && activeDisplayTargets.map(t => (
            <div
              key={t.id}
              ref={el => { ringRefs.current[t.id] = el; }}
              onClick={(e) => {
                e.stopPropagation();
                handleTargetSelect(t.id);
              }}
              title={`Inspect ${t.title || t.subsystemName || t.id}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 34,
                height: 34,
                borderRadius: '50%',
                pointerEvents: 'auto',
                cursor: 'pointer',
                zIndex: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'translate(-999px, -999px)',
                transition: 'filter 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'drop-shadow(0 0 8px #ffffff)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              <div
                className="reticle-ring-circle"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `1.8px solid ${t.color}`,
                  boxShadow: `0 0 10px ${t.color}88`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div
                  className="reticle-inner-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: t.color,
                    boxShadow: `0 0 8px ${t.color}`,
                  }}
                />
              </div>
            </div>
          ))}

          {/* ── LEFT BADGES (ANATOMICAL ORGANS) ── */}
          {showBadges && activeDisplayTargets.filter(t => t.side === 'LEFT').map((t, idx) => {
            const isSelected = selectedOrganId === t.id;
            const topPos = idx === 0 ? '14%' : idx === 1 ? '41%' : '68%';

            return (
              <div
                key={t.id}
                ref={el => { badgeRefs.current[t.id] = el; }}
                onClick={() => handleTargetSelect(t.id)}
                style={{
                  position: 'absolute',
                  top: topPos,
                  left: 8,
                  cursor: 'pointer',
                  zIndex: 20,
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                  background: isSelected ? 'rgba(7, 18, 28, 0.94)' : 'rgba(8, 14, 22, 0.86)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${isSelected ? t.color : `${t.color}55`}`,
                  borderRadius: 8,
                  padding: '5px 9px',
                  boxShadow: isSelected
                    ? `0 0 16px ${t.color}44, 0 4px 16px rgba(0,0,0,0.6)`
                    : '0 4px 14px rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  width: 204,
                  maxWidth: 218,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: `${t.color}16`,
                  border: `1px solid ${t.color}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {renderTargetIcon(t.id, t.color)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1.5, flex: 1, overflow: 'hidden' }}>
                  {/* Line 1: Title (Full width available) */}
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    lineHeight: 1.2,
                  }}>
                    {t.title}
                  </div>
                  {/* Line 2: Status Pill + Metric (Clean, aligned, zero overflow) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: t.color,
                      background: `${t.color}22`,
                      border: `1px solid ${t.color}44`,
                      padding: '1px 5px',
                      borderRadius: 3,
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                    }}>
                      {t.status}
                    </span>
                    <span style={{
                      fontSize: 8,
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}>
                      {t.metric}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── RIGHT BADGES (ANATOMICAL ORGANS) ── */}
          {showBadges && activeDisplayTargets.filter(t => t.side === 'RIGHT').map((t, idx) => {
            const isSelected = selectedOrganId === t.id;
            const topPos = idx === 0 ? '14%' : idx === 1 ? '41%' : '68%';

            return (
              <div
                key={t.id}
                ref={el => { badgeRefs.current[t.id] = el; }}
                onClick={() => handleTargetSelect(t.id)}
                style={{
                  position: 'absolute',
                  top: topPos,
                  right: 8,
                  cursor: 'pointer',
                  zIndex: 20,
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                  background: isSelected ? 'rgba(7, 18, 28, 0.94)' : 'rgba(8, 14, 22, 0.86)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${isSelected ? t.color : `${t.color}55`}`,
                  borderRadius: 8,
                  padding: '5px 9px',
                  boxShadow: isSelected
                    ? `0 0 16px ${t.color}44, 0 4px 16px rgba(0,0,0,0.6)`
                    : '0 4px 14px rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  width: 204,
                  maxWidth: 218,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: `${t.color}16`,
                  border: `1px solid ${t.color}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {renderTargetIcon(t.id, t.color)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1.5, flex: 1, overflow: 'hidden' }}>
                  {/* Line 1: Title (Full width available) */}
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    lineHeight: 1.2,
                  }}>
                    {t.title}
                  </div>
                  {/* Line 2: Status Pill + Metric (Clean, aligned, zero overflow) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: t.color,
                      background: `${t.color}22`,
                      border: `1px solid ${t.color}44`,
                      padding: '1px 5px',
                      borderRadius: 3,
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                    }}>
                      {t.status}
                    </span>
                    <span style={{
                      fontSize: 8,
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}>
                      {t.metric}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── INTERACTIVE FLOATING ANATOMICAL ORGAN FUNCTION & HEALTH CARD ── */}
          {inspectionMode === 'ANATOMY' && showOrganModal && selectedOrganId && (() => {
            const organ = anatomicalParts.find(o => o.id === selectedOrganId) || anatomicalParts[1];
            const organColor = organ.color || '#38bdf8';

            return (
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: 420,
                  width: 'calc(100% - 28px)',
                  maxHeight: '42%',
                  overflowY: 'auto',
                  background: 'rgba(6, 11, 20, 0.96)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: `1.5px solid ${organColor}`,
                  boxShadow: `0 14px 44px rgba(0,0,0,0.95), 0 0 24px ${organColor}40`,
                  borderRadius: 12,
                  padding: '8px 12px',
                  zIndex: 35,
                }}
              >
                {/* Header: Title, Subsystem & Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: `${organColor}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {renderTargetIcon(organ.id, organColor)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '0.03em' }}>
                        {organ.title.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 9, color: '#7dd3fc', fontFamily: 'monospace' }}>
                        SUBSYSTEM: {organ.subsystemName.toUpperCase()} · {organ.elevationTag}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: organColor,
                      background: `${organColor}20`,
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: `1px solid ${organColor}50`,
                    }}>
                      {organ.status}
                    </span>
                    <button
                      onClick={handleCloseOrganModal}
                      title="Close Organ Inspection HUD"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Live Biometrics Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0,0,0,0.45)',
                  padding: '5px 10px',
                  borderRadius: 6,
                  marginBottom: 8,
                  borderLeft: `3px solid ${organColor}`,
                }}>
                  <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>LIVE BIOMETRICS:</span>
                  <span style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: organ.status === 'CRITICAL' ? '#fca5a5' : organ.status === 'WATCH' ? '#fde047' : '#e0f2fe',
                  }}>
                    {organ.metric}
                  </span>
                </div>

                {/* Biological Function (What the organ does in the human body & spaceflight) */}
                <div style={{ marginBottom: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 700, color: '#38bdf8', marginBottom: 2, fontFamily: 'monospace' }}>
                    <Info size={11} />
                    <span>ORGAN FUNCTION & SPACE PHYSIOLOGY:</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.4 }}>
                    {organ.functionSummary}
                  </div>
                </div>

                {/* Health Status & Clinical Findings */}
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.35, marginBottom: 8 }}>
                  <strong style={{ color: '#e2e8f0' }}>Health Status:</strong> {organ.healthDetail}
                </div>

                {/* Flight Surgeon Protocol (Rx) & Action */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0, 0, 0, 0.65)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  borderLeft: `3px solid ${organColor}`,
                }}>
                  <span style={{ fontSize: 9, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>
                    <strong style={{ color: organColor }}>RX:</strong> {organ.protocol}
                  </span>
                  <button
                    onClick={() => {
                      targetFocusYRef.current = organ.scanTargetY;
                      if (onSelectSubsystem) onSelectSubsystem(organ.subsystemId);
                    }}
                    style={{
                      background: `${organColor}26`,
                      border: `1px solid ${organColor}`,
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 9,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: organColor,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Crosshair size={10} />
                    <span>FOCUS</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Tactical Viewport Overlays (Top Left) */}
          <div style={{
            position: 'absolute',
            top: 10,
            left: 12,
            pointerEvents: 'none',
            fontSize: 8.5,
            fontFamily: 'monospace',
            color: '#8cb3d9',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 15,
          }}>
            <span>ELEV: <span ref={elevationDomRef} style={{ color: '#ffffff', fontWeight: 700 }}>+0.70 m</span></span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span>SLICE: <span ref={sliceIndexDomRef} style={{ color: '#00e5ff' }}>#64</span></span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span>AZ: <span ref={azimuthDomRef} style={{ color: '#ffffff', fontWeight: 700 }}>0°</span></span>
            <span style={{ display: 'none' }} ref={regionDomRef} />
          </div>

          {/* ── INTERACTIVE EVA SPACESUIT SUBSYSTEM HUD ── */}
          {modelType === 'SUIT' && (
            <div
              style={{
                position: 'absolute',
                bottom: 38,
                left: 12,
                maxWidth: 400,
                width: 'calc(100% - 24px)',
                background: 'rgba(6, 14, 24, 0.94)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 10,
                padding: '8px 12px',
                zIndex: 22,
                boxShadow: '0 8px 32px rgba(0,0,0,0.85), 0 0 20px rgba(56, 189, 248, 0.25)',
              }}
            >
              {/* Subsystem Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                  EVA EMU SUBSYSTEMS:
                </span>
                {suitSubsystems.map(sub => {
                  const isSelected = selectedSuitSubsystem === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => focusSuitSubsystemRef.current && focusSuitSubsystemRef.current(sub.id)}
                      style={{
                        background: isSelected ? `${sub.color}26` : 'rgba(255, 255, 255, 0.05)',
                        border: isSelected ? `1px solid ${sub.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                        color: isSelected ? sub.color : '#94a3b8',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 9,
                        fontWeight: isSelected ? 700 : 500,
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: isSelected ? `0 0 10px ${sub.color}40` : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: sub.color }} />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Subsystem Detail Card */}
              {(() => {
                const activeSub = suitSubsystems.find(s => s.id === selectedSuitSubsystem) || suitSubsystems[1];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
                        {activeSub.name}
                      </span>
                      <span style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: activeSub.color,
                        background: `${activeSub.color}20`,
                        padding: '1px 6px',
                        borderRadius: 3,
                        border: `1px solid ${activeSub.color}40`,
                      }}>
                        {activeSub.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.3 }}>
                      {activeSub.spec}
                    </div>
                    <div style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: activeSub.color,
                      marginTop: 2,
                      background: 'rgba(0,0,0,0.4)',
                      padding: '3px 6px',
                      borderRadius: 4,
                      borderLeft: `2px solid ${activeSub.color}`,
                    }}>
                      {activeSub.telemetry}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Floating Camera, Orbit & Laser Deck on 3D Viewport ── */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(6, 12, 22, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              padding: '3px 6px',
              zIndex: 18,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              onClick={() => snapToAngle(0)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: 5,
                padding: '3px 7px',
                fontSize: 9.5,
                fontWeight: 600,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              Front
            </button>
            <button
              onClick={() => snapToAngle(180)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: 5,
                padding: '3px 7px',
                fontSize: 9.5,
                fontWeight: 600,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              onClick={handleResetCamera}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                borderRadius: 5,
                padding: '3px 7px',
                fontSize: 9.5,
                fontWeight: 700,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>

            <span style={{ width: 1, height: 16, background: 'rgba(255, 255, 255, 0.12)', margin: '0 2px' }} />

            {/* Orbit Toggle */}
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              style={{
                background: autoRotate ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${autoRotate ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                color: autoRotate ? '#38bdf8' : '#94a3b8',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 9.5,
                fontWeight: 600,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {autoRotate ? <Pause size={10} /> : <Play size={10} />}
              <span>Orbit</span>
            </button>

            {/* Laser Scanner Mode */}
            <button
              onClick={() => {
                setLaserMode(prev => prev === 'OFF' ? 'SWEEP' : prev === 'SWEEP' ? 'LOCK_ORGAN' : 'OFF');
              }}
              style={{
                background: laserMode !== 'OFF' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${laserMode !== 'OFF' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                color: laserMode !== 'OFF' ? '#38bdf8' : '#94a3b8',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 9.5,
                fontWeight: 600,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.14s ease',
              }}
            >
              {laserMode === 'SWEEP' ? <Zap size={10} /> : laserMode === 'LOCK_ORGAN' ? <Crosshair size={10} /> : <Radio size={10} />}
              <span>{laserMode === 'SWEEP' ? 'Sweep' : laserMode === 'LOCK_ORGAN' ? 'Lock' : 'Beam'}</span>
            </button>

            {/* Badges/Callouts Visibility Toggle */}
            <button
              onClick={() => setShowBadges(!showBadges)}
              title="Toggle HUD Callout Badges on/off"
              style={{
                background: showBadges ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${showBadges ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                color: showBadges ? '#38bdf8' : '#94a3b8',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 9.5,
                fontWeight: 600,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.14s ease',
              }}
            >
              <Activity size={10} />
              <span>{showBadges ? 'Callouts' : 'Minimal'}</span>
            </button>
          </div>
        </div>

        {/* Right: Full Simultaneous Physiological Subsystems Panel (Shown in Split Mode) */}
        {viewMode === 'SPLIT' && (
          <div style={{
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(6, 10, 16, 0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#1c2f42 #050a10',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                  PHYSIOLOGICAL SUBSYSTEMS
                </span>
                <span style={{
                  fontSize: 8.5,
                  color: isRadiationCritical || activeSeverity === 'CRITICAL' ? '#f87171' : (isRadiationActive || activeSeverity === 'WARNING') ? '#fbbf24' : '#38bdf8',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: isRadiationCritical || activeSeverity === 'CRITICAL' ? '#ef4444' : (isRadiationActive || activeSeverity === 'WARNING') ? '#f59e0b' : '#00e5a3',
                    boxShadow: isRadiationCritical || activeSeverity === 'CRITICAL' ? '0 0 6px #ef4444' : (isRadiationActive || activeSeverity === 'WARNING') ? '0 0 6px #f59e0b' : '0 0 6px #00e5a3'
                  }} />
                  {isRadiationCritical ? 'SHELTER ALARM' : isRadiationActive ? 'SPE ALERT' : activeSeverity}
                </span>
              </div>

              {/* Subsystems Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {hotspots.map(hs => {
                  const isSelected = selectedHotspot === hs.id;
                  const isCrit = hs.severity === 'CRITICAL';
                  const isWarn = hs.severity === 'WARNING';

                  const cardBorder = isSelected
                    ? '1px solid #38bdf8'
                    : isCrit
                      ? '1px solid rgba(239, 68, 68, 0.45)'
                      : isWarn
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.08)';

                  const cardBg = isSelected
                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.14) 0%, rgba(8, 14, 22, 0.92) 100%)'
                    : isCrit
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 8, 8, 0.9) 100%)'
                      : isWarn
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(15, 12, 6, 0.9) 100%)'
                        : 'rgba(9, 14, 22, 0.75)';

                  return (
                    <div
                      key={hs.id}
                      onClick={() => {
                        setSelectedHotspot(hs.id);
                        if (onSelectSubsystem) onSelectSubsystem(hs.id);
                      }}
                      style={{
                        background: cardBg,
                        border: cardBorder,
                        borderLeft: `3px solid ${isSelected ? '#38bdf8' : isCrit ? '#ef4444' : isWarn ? '#f59e0b' : 'rgba(56, 189, 248, 0.35)'}`,
                        borderRadius: 8,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: isSelected
                          ? '0 0 14px rgba(56, 189, 248, 0.22), inset 0 1px 0 rgba(255,255,255,0.08)'
                          : '0 2px 6px rgba(0,0,0,0.25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <span style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#38bdf8',
                            boxShadow: `0 0 5px ${isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#38bdf8'}`,
                            flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em', flexShrink: 0 }}>
                            {hs.id}
                          </span>
                          <span style={{ fontSize: 8.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            · {hs.organ}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {isSelected ? (
                            <span style={{
                              fontSize: 8,
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              padding: '1.5px 6px',
                              borderRadius: 9999,
                              background: 'rgba(56, 189, 248, 0.2)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.45)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              whiteSpace: 'nowrap',
                            }}>
                              <CheckCircle2 size={7.5} />
                              <span>ACTIVE</span>
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 7.5,
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              padding: '1.5px 5px',
                              borderRadius: 3,
                              background: isCrit ? 'rgba(239, 68, 68, 0.18)' : isWarn ? 'rgba(245, 158, 11, 0.18)' : 'rgba(56, 189, 248, 0.12)',
                              color: isCrit ? '#f87171' : isWarn ? '#fbbf24' : '#38bdf8',
                              border: `1px solid ${isCrit ? 'rgba(239, 68, 68, 0.4)' : isWarn ? 'rgba(245, 158, 11, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`,
                              whiteSpace: 'nowrap',
                            }}>
                              {hs.severity}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metric Row */}
                      <div style={{
                        fontSize: 10,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: isCrit ? '#fca5a5' : isWarn ? '#fde047' : '#e0f2fe',
                      }}>
                        {hs.metric}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Active Subsystem Deep-Dive Telemetry Inspector ── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(8, 14, 24, 0.9) 0%, rgba(4, 8, 16, 0.95) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.28)',
                borderRadius: 8,
                padding: '7px 9px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                fontFamily: 'monospace',
              }}>
                {/* Inspector Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Activity size={10} style={{ color: '#38bdf8' }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                      INSPECTOR // {selectedHotspot}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 7.5,
                    color: '#34d399',
                    background: 'rgba(52, 211, 153, 0.14)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontWeight: 700,
                  }}>
                    SENTRY 60Hz
                  </span>
                </div>

                {/* 2x2 Sensor Metric Tiles */}
                {selectedHotspot === 'CARDIAC' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 5 }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>QTc INTERVAL</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{qtc} ms</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>AUTONOMIC ARF</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>{arf.toFixed(2)}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>VISCOSITY TRM</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{trm.toFixed(2)}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>RHYTHM</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>Sinus NSR</div>
                    </div>
                  </div>
                )}

                {selectedHotspot === 'OCULAR' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 5 }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>ONSD SHEATH</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: isOcularAlert ? '#f87171' : '#38bdf8' }}>{isOcularAlert ? '6.8 mm' : '5.2 mm'}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>ICP PRESSURE</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>11.2 mmHg</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>RETINAL MICRO</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>0 Lesions</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>OPTIC MARGIN</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>Frisén Gr.0</div>
                    </div>
                  </div>
                )}

                {selectedHotspot === 'RENAL' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 5 }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>SERUM K⁺</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>{k.toFixed(2)} mmol/L</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>URINE OSM</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>450 mOsm/kg</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>CORTICAL GFR</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>116 mL/min</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>FLUID BALANCE</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>+120 mL / 24h</div>
                    </div>
                  </div>
                )}

                {selectedHotspot === 'SKELETAL' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 5 }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'RAD FLUX' : 'BMD INDEX'}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationCritical ? '#ef4444' : isRadiationActive ? '#f59e0b' : isSkeletalAlert ? '#f87171' : '#38bdf8' }}>
                        {isRadiationActive ? `${radFlux.toFixed(1)} mGy/h` : `${bmd.toFixed(1)}%`}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'MARROW RSI' : 'RESORPTION'}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationActive ? '#ef4444' : '#ffffff' }}>
                        {isRadiationActive ? '1.25 CRIT' : '0.02% / wk'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'ABSORBED DOSE' : 'ARED TARGET'}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationActive ? '#f59e0b' : '#34d399' }}>
                        {isRadiationActive ? `${(radDose || 0.75).toFixed(2)} Gy` : '150 kN'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'LYMPHOCYTES' : 'AXIAL SPINAL'}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationActive ? '#ef4444' : '#ffffff' }}>
                        {isRadiationActive ? `${telemetry?.lymphocyte_count ?? 0.85} (LOW)` : '+1.8 cm'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Micro Live Wave Sparkline */}
                <div style={{
                  height: 18,
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.45)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px',
                  boxSizing: 'border-box',
                }}>
                  <svg width="100%" height="16" viewBox="0 0 280 16" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {selectedHotspot === 'CARDIAC' && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.4"
                        points="0,8 20,8 25,7 30,8 38,8 42,2 46,14 50,8 58,8 64,6 72,8 90,8 110,8 115,7 120,8 128,8 132,2 136,14 140,8 148,8 154,6 162,8 180,8 200,8 205,7 210,8 218,8 222,2 226,14 230,8 238,8 244,6 252,8 280,8"
                      />
                    )}
                    {selectedHotspot === 'OCULAR' && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.4"
                        points="0,8 25,5 50,8 75,11 100,7 125,5 150,9 175,8 200,6 225,8 250,11 275,7 280,8"
                      />
                    )}
                    {selectedHotspot === 'RENAL' && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.4"
                        points="0,9 35,7 70,9 105,6 140,8 175,10 210,8 245,7 280,9"
                      />
                    )}
                    {selectedHotspot === 'SKELETAL' && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.4"
                        points="0,11 25,11 40,4 55,11 90,11 105,4 120,11 155,11 170,4 185,11 220,11 235,4 250,11 280,11"
                      />
                    )}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
