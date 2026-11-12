import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TelemetryPacket, DistancePreset } from '../types/telemetry';
import { evaluateCrewClinicalSummary } from '../utils/clinicalPrioritization';
import {
  User,
  Shield,
  Columns2,
  Maximize2,
  Crosshair,
  CheckCircle2,
  X,
  Flame,
  Sun,
  Activity,
  Heart,
  Brain,
  Wind,
  Bone,
  Droplets,
  ChevronDown,
  Gauge,
  Thermometer,
  Navigation,
  Layers,
  Eye,
} from 'lucide-react';
import {
  ASTRODOC_TOTAL_POINTS,
  ASTRODOC_BODY_RIG,
  ASTRODOC_VIEWBOX,
  ASTRODOC_VERTEX_SHADER,
  ASTRODOC_FRAGMENT_SHADER,
  generateProceduralAstroDocBody,
  loadAstroDocBodyBin,
  projectAstroDocPoint,
  computeAstroDocFigRect,
} from '../data/astroDocBody';

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
  id: string;
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
  astronautRole: _astronautRole,
  telemetry,
  currentScenario,
  themeMode: initialTheme = 'CYAN',
  orbitalPosition = 'LEO',
  onSelectSubsystem,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<string>('CARDIAC');
  const [autoRotate, setAutoRotate] = useState(true);
  const [colorTheme, setColorTheme] = useState<'CYAN' | 'THERMAL' | 'AMBER'>(() => normalizeTheme(initialTheme));
  const [laserMode, setLaserMode] = useState<'SWEEP' | 'LOCK_ORGAN' | 'OFF'>('SWEEP');
  const [modelType, setModelType] = useState<'HUMAN' | 'SUIT'>('HUMAN');
  const [viewMode, setViewMode] = useState<'SPLIT' | 'FULL'>('SPLIT');
  const [selectedSuitSubsystem, setSelectedSuitSubsystem] = useState<string>('PLSS');
  const inspectionMode = 'ANATOMY';
  const [selectedOrganId, setSelectedOrganId] = useState<string>('HEART');
  const [showOrganModal, setShowOrganModal] = useState(false);
  const [showBadges] = useState(true);

  // Dropdown states for Model and Theme selectors
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setIsThemeDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModelDropdownOpen(false);
        setIsThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  // SVG lines, 300x660 figure overlay, and hotspot target ring DOM references for 60 FPS lag-free tracking
  const figSvgRef = useRef<SVGSVGElement | null>(null);
  const scanLineSvgRef = useRef<SVGLineElement | null>(null);
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

  const hr = telemetry?.heart_rate ?? 62;
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
  const isOcularCritical = (isCriticalAlert && (co2 > 4.5 || primaryBioId === 'co2')) || isRadiationCritical;
  const isOcularAlert = isOcularCritical || isRadiationActive || (isWarningAlert && (
    telemetry?.scenario_phase === 'SCENARIO_17_SPACE_VISION_SANS' ||
    co2 > 3.2 ||
    primaryBioId === 'co2'
  ));
  const ocularSeverity: 'CRITICAL' | 'WARNING' | 'NOMINAL' = isOcularCritical ? 'CRITICAL' : isOcularAlert ? 'WARNING' : 'NOMINAL';

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
  const selectedOrganIdRef = useRef(selectedOrganId);
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
  const focusSuitSubsystemRef = useRef<((id: string) => void) | null>(null);
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
      controlsRef.current.autoRotate = modelTypeRef.current === 'SUIT' && autoRotate;
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
    selectedOrganIdRef.current = selectedOrganId;
  }, [selectedOrganId]);

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

  // ─── AUTHENTIC NASA xEMU / ARTEMIS EVA SUIT TELEMETRY (DYNAMIC & SYNCED) ───
  const isDecomp = activeScenarioKey?.includes('DECOMPRESSION') || activeScenarioKey?.includes('HYPOXIA') || spo2 < 90.0;
  const isScrubberFault = activeScenarioKey?.includes('CO2_SCRUBBER') || co2 > 2.8;
  const isWorkout = telemetry?.mission_state === 'WORKOUT';

  // Suit internal pure O2 pressure (4.3 psi / 29.6 kPa nominal)
  const suitPressurePsi = isDecomp ? 2.8 : 4.3;
  const suitPressureKpa = (suitPressurePsi * 6.89476).toFixed(1);

  // PLSS Primary Oxygen Reserve (%) & Tank Pressure
  const o2Reserve = isDecomp ? 64 : isWorkout ? 82 : Math.max(76, Math.min(99, Math.round(98 - ((telemetry?.tick || 0) % 200) * 0.05)));
  const o2TankPressureMpa = (27.6 * (o2Reserve / 100)).toFixed(1);
  const o2TteMinutes = Math.round((o2Reserve / 100) * 480);
  const o2TteHours = Math.floor(o2TteMinutes / 60);
  const o2TteRemMins = o2TteMinutes % 60;

  // Helmet Partial Pressure CO2 (mmHg)
  const ppCo2 = isScrubberFault ? Number(Math.max(3.8, co2).toFixed(1)) : 0.2;
  const co2ScrubberState: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL' = isScrubberFault ? 'CRITICAL' : co2 > 2.2 ? 'DEGRADED' : 'OPTIMAL';

  // LCVG (Liquid Cooling & Ventilation Garment) Temperature & Sublimator
  const lcvgTemp = Math.round((18.2 + ((temp || 36.7) - 36.7) * 0.5) * 10) / 10;
  const sublimatorRate = isWorkout ? 1.6 : 1.2;

  // EMU Battery Status (28V DC Silver-Zinc)
  const batteryPct = Math.max(68, Math.min(96, Math.round(88 - ((telemetry?.tick || 0) % 300) * 0.04)));
  const batteryVolts = (27.8 + (batteryPct / 100) * 0.8).toFixed(1);

  // SAFER Rescue RCS (Cold-gas GN2)
  const saferPressureMpa = 20.7;
  const saferThrustersArmed = 24;
  const saferDeltaV = '3.05 m/s';

  // 6 Primary EVA Spacesuit Subsystems for 3D Holographic Model Callouts
  const suitParts = useMemo(() => [
    {
      id: 'SUIT_VISOR',
      title: 'Helmet & Visor',
      subsystemName: 'Extravehicular Visor Assembly',
      region: 'CRANIAL (+0.82m)',
      elevationTag: '+0.82m Helmet',
      side: 'LEFT' as const,
      pos: [0, 0.82, 0.22] as [number, number, number],
      scanTargetY: 0.82,
      status: (co2ScrubberState === 'CRITICAL' ? 'CRITICAL' : isScrubberFault ? 'WATCH' : 'NOMINAL') as 'NOMINAL' | 'WATCH' | 'CRITICAL',
      color: isScrubberFault ? '#fbbf24' : '#34d399',
      primaryValue: '94% Tint',
      unitLabel: `ppCO₂: ${ppCo2} mmHg`,
      metric: `ppCO₂ ${ppCo2} mmHg · HUD Calibrated`,
      functionSummary: 'Gold vapor-deposited polycarbonate shielding 100% solar UV & IR. Dual optical anti-fog matrix with integrated heads-up retinal projection microdisplay.',
      healthDetail: isScrubberFault
        ? 'Elevated helmet deadspace CO₂ buildup (>2.5 mmHg). Check amine scrubber cartridge circulation.'
        : 'Visor seal pressure intact. Optical anti-fog heater nominal. HUD microdisplay locked at 60 Hz.',
      protocol: isScrubberFault
        ? 'Engage manual purge valve for 3 seconds; verify Metox / amine scrubber bypass.'
        : 'Routine hourly visor seal inspection and sun-shield tint adjustment.',
      subsystemId: 'VISOR',
    },
    {
      id: 'SUIT_DCM',
      title: 'DCM Chest Module',
      subsystemName: 'Display & Control Module',
      region: 'THORACIC (+0.32m)',
      elevationTag: '+0.32m Chest',
      side: 'LEFT' as const,
      pos: [0, 0.32, 0.28] as [number, number, number],
      scanTargetY: 0.32,
      status: (isDecomp ? 'CRITICAL' : 'NOMINAL') as 'NOMINAL' | 'WATCH' | 'CRITICAL',
      color: isDecomp ? '#f87171' : '#38bdf8',
      primaryValue: `${suitPressurePsi.toFixed(1)} psi`,
      unitLabel: `${suitPressureKpa} kPa · Pure O₂`,
      metric: `Pressure ${suitPressurePsi.toFixed(1)} psi · Auto Regulator`,
      functionSummary: 'Chest-mounted operational command interface: regulates internal pure O₂ suit pressure (4.3 psi nominal), primary/secondary O₂ actuators, and emergency cabin umbilical purge.',
      healthDetail: isDecomp
        ? 'SUIT PRESSURE LOSS DETECTED (<3.0 psi). Automated O2 makeup valve open at maximum flow rate (6.8 kg/h).'
        : 'Suit pressure regulation nominal at 4.3 psi (29.6 kPa). Automated makeup valve operating in closed-loop servo mode.',
      protocol: isDecomp
        ? 'EMERGENCY: Abort EVA immediately; ingress airlock within 12 minutes; engage secondary oxygen pack (SOP).'
        : 'Monitor pressure decay delta q15m (normal allowable leak rate <0.02 kPa/min).',
      subsystemId: 'DCM',
    },
    {
      id: 'SUIT_LCVG',
      title: 'LCVG Thermal Suit',
      subsystemName: 'Liquid Cooling & Ventilation',
      region: 'ABDOMINAL (-0.15m)',
      elevationTag: '-0.15m Coolant',
      side: 'LEFT' as const,
      pos: [-0.22, -0.15, 0.16] as [number, number, number],
      scanTargetY: -0.15,
      status: (temp > 37.5 ? 'WATCH' : 'NOMINAL') as 'NOMINAL' | 'WATCH' | 'CRITICAL',
      color: temp > 37.5 ? '#fbbf24' : '#34d399',
      primaryValue: `${lcvgTemp.toFixed(1)} °C`,
      unitLabel: 'Loop 1.8 L/m Nom',
      metric: `Loop ${lcvgTemp.toFixed(1)} °C · Flow 1.8 L/min`,
      functionSummary: 'Knitted nylon/spandex undergarment embedded with 91 meters of flexible water tubing. Absorbs metabolic heat from crew during high-workload spacewalks and circulates to PLSS ice sublimator.',
      healthDetail: temp > 37.5
        ? 'Crew thermal load elevated from high EVA metabolic exertion. Sublimator ice melt rate elevated.'
        : 'Thermal balance in equilibrium. Liquid cooling garment inlet temperature at 18.2°C; core body temperature stable.',
      protocol: temp > 37.5
        ? 'Adjust DCM comfort cooling valve to MAX; slow physical translation cadence.'
        : 'Maintain cooling valve at Comfort Position 2 (18.0°C).',
      subsystemId: 'LCVG',
    },
    {
      id: 'SUIT_PLSS',
      title: 'PLSS Life Support',
      subsystemName: 'Portable Life Support System',
      region: 'DORSAL (+0.45m)',
      elevationTag: '+0.45m Backpack',
      side: 'RIGHT' as const,
      pos: [-0.18, 0.45, -0.28] as [number, number, number],
      scanTargetY: 0.45,
      status: (isDecomp || isScrubberFault ? 'CRITICAL' : 'OPTIMAL') as 'NOMINAL' | 'WATCH' | 'CRITICAL',
      color: isDecomp || isScrubberFault ? '#f87171' : '#00e5ff',
      primaryValue: `${o2Reserve}% O₂`,
      unitLabel: `TTE: ${o2TteHours}h ${o2TteRemMins}m`,
      metric: `O₂ ${o2Reserve}% · TTE ${o2TteHours}h ${o2TteRemMins}m`,
      functionSummary: 'Backpack module containing dual 27.6 MPa primary oxygen tanks, regenerable amine CO₂ scrubber cartridges, water ice sublimator, and 28V DC silver-zinc power bus.',
      healthDetail: isDecomp
        ? 'Primary O2 depletion rate accelerated due to suit pressure compensation. SOP reserve auto-armed.'
        : 'Dual O₂ tanks nominal at 27.6 MPa. Sublimator ice loop active at 1.2 L/h. Battery bus nominal at 28.4 V DC.',
      protocol: isDecomp
        ? 'Abort EVA. Ingress airlock. Verify hatch seal and initiate rapid repressurization.'
        : 'Standard PLSS consumables check every 30 minutes; report O₂ psi and battery amp-hours to Flight.',
      subsystemId: 'PLSS',
    },
    {
      id: 'SUIT_SAFER',
      title: 'SAFER RCS System',
      subsystemName: 'Simplified Aid for EVA Rescue',
      region: 'LUMBAR (+0.02m)',
      elevationTag: '+0.02m Waist',
      side: 'RIGHT' as const,
      pos: [0.22, 0.02, -0.20] as [number, number, number],
      scanTargetY: 0.02,
      status: 'ARMED' as 'NOMINAL' | 'WATCH' | 'CRITICAL',
      color: '#00e5a3',
      primaryValue: `${saferPressureMpa} MPa`,
      unitLabel: `24 Thrusters · ΔV 3.0m/s`,
      metric: `GN₂ ${saferPressureMpa} MPa · 24 Thrusters Armed`,
      functionSummary: 'Self-rescue cold-gas nitrogen propulsion pack mounted beneath the PLSS. Equipped with 24 cold-gas thrusters producing 3.05 m/s delta-V for crew self-recovery in the event of tether separation.',
      healthDetail: 'Nitrogen bottle pressure locked at 20.7 MPa (3,000 psi). Automatic attitude hold (AAH) sensor suite calibrated. Hand controller stowed and armed.',
      protocol: 'In the event of tether failure, deploy hand controller; engage Automatic Attitude Hold (AAH); arrest rates.',
      subsystemId: 'SAFER',
    },
    {
      id: 'SUIT_TMG',
      title: 'TMG Outer Layers',
      subsystemName: 'Thermal Micrometeoroid Garment',
      region: 'PERIPHERY (-0.55m)',
      elevationTag: '-0.55m Outer Shell',
      side: 'RIGHT' as const,
      pos: [0.22, -0.55, 0.14] as [number, number, number],
      scanTargetY: -0.55,
      status: (isRadiationActive ? 'WATCH' : 'SEALED') as 'NOMINAL' | 'WATCH' | 'CRITICAL',
      color: isRadiationActive ? '#fbbf24' : '#a855f7',
      primaryValue: '14 Layers',
      unitLabel: 'Punctures: 0 · Shield Nom',
      metric: `14 Layers · Ext -48°C / +62°C`,
      functionSummary: '14-layer protective outer envelope: aluminized Mylar radiation insulation, woven Orthofabric outer shell, and Kevlar high-velocity micrometeoroid puncture barrier.',
      healthDetail: isRadiationActive
        ? 'High energetic particle flux detected on exterior dosimeter patches. Outer thermal layer intact.'
        : 'Zero micrometeoroid punctures detected across all 14 layers. External surface temperature within -48°C to +62°C thermal envelope.',
      protocol: isRadiationActive
        ? 'Limit direct solar exposure; translate in vehicle shadow where feasible.'
        : 'Inspect glove RTV silicone palms and tethers every 45 minutes for sharp edge snags.',
      subsystemId: 'TMG',
    },
  ], [isDecomp, isScrubberFault, co2ScrubberState, suitPressurePsi, suitPressureKpa, ppCo2, temp, lcvgTemp, o2Reserve, o2TankPressureMpa, o2TteHours, o2TteRemMins, saferPressureMpa, isRadiationActive]);

  // Suit Hotspots for Right-Hand Panel
  const suitHotspots: Hotspot[] = useMemo(() => [
    {
      id: 'PLSS',
      label: 'PLSS Life Support',
      subsystemName: 'Portable Life Support System',
      organ: 'Dual O₂ Tanks & Sublimator',
      elevationTag: '+0.45m Backpack',
      region: 'DORSAL (+0.45m)',
      pos: [-0.18, 0.45, -0.28],
      scanTargetY: 0.45,
      severity: isDecomp || isScrubberFault ? 'CRITICAL' : 'NOMINAL',
      metric: `${o2Reserve}% O₂ · ${o2TankPressureMpa} MPa`,
      detail: `Dual 27.6 MPa tanks. Consumables remaining: ${o2TteHours}h ${o2TteRemMins}m. Sublimator ice loop active at ${sublimatorRate} L/h.`,
      protocol: 'Standard PLSS consumables check every 30 minutes.',
    },
    {
      id: 'DCM',
      label: 'Display & Control',
      subsystemName: 'DCM Chest Module',
      organ: 'Suit Pressure Regulator',
      elevationTag: '+0.32m Chest',
      region: 'THORACIC (+0.32m)',
      pos: [0, 0.32, 0.28],
      scanTargetY: 0.32,
      severity: isDecomp ? 'CRITICAL' : 'NOMINAL',
      metric: `${suitPressurePsi.toFixed(1)} psi · Pure O₂`,
      detail: `Suit internal pure O₂ pressure regulation nominal at 4.3 psi (${suitPressureKpa} kPa). Makeup valve servo operating.`,
      protocol: 'Monitor suit pressure decay delta q15m.',
    },
    {
      id: 'VISOR',
      label: 'Helmet & Visor',
      subsystemName: 'Extravehicular Visor Assembly',
      organ: 'Gold Polycarbonate & HUD',
      elevationTag: '+0.82m Helmet',
      region: 'CRANIAL (+0.82m)',
      pos: [0, 0.82, 0.22],
      scanTargetY: 0.82,
      severity: isScrubberFault ? 'WARNING' : 'NOMINAL',
      metric: `94% Tint · CO₂ ${ppCo2} mmHg`,
      detail: `100% solar UV/IR attenuation. Optical anti-fog matrix nominal. Deadspace ppCO₂ at ${ppCo2} mmHg.`,
      protocol: 'Adjust gold sun-visor for orbital day/night terminator crossings.',
    },
    {
      id: 'LCVG',
      label: 'Thermal Garment',
      subsystemName: 'Liquid Cooling Garment',
      organ: '91m Water Chilled Loop',
      elevationTag: '-0.15m Coolant',
      region: 'ABDOMINAL (-0.15m)',
      pos: [-0.22, -0.15, 0.16],
      scanTargetY: -0.15,
      severity: 'NOMINAL',
      metric: `${lcvgTemp.toFixed(1)} °C · Flow 1.8 L/m`,
      detail: `Chilled water loop circulating at 1.8 L/min. Crew thermal balance in equilibrium.`,
      protocol: 'Maintain comfort valve setting at position 2 (18.0°C).',
    },
    {
      id: 'SAFER',
      label: 'Rescue Propulsion',
      subsystemName: 'Aid for EVA Rescue',
      organ: 'Cold-Gas GN₂ Thrusters',
      elevationTag: '+0.02m Waist',
      region: 'LUMBAR (+0.02m)',
      pos: [0.22, 0.02, -0.20],
      scanTargetY: 0.02,
      severity: 'NOMINAL',
      metric: `${saferPressureMpa} MPa · 24 Armed`,
      detail: `Nitrogen pressure 20.7 MPa. 24 cold-gas nozzles armed delivering 3.05 m/s delta-V.`,
      protocol: 'Attitude hold sensor active; hand controller stowed.',
    },
    {
      id: 'TMG',
      label: 'Outer Shield',
      subsystemName: 'Thermal Micrometeoroid Garment',
      organ: '14-Layer Kevlar & Mylar',
      elevationTag: '-0.55m Outer Shell',
      region: 'PERIPHERY (-0.55m)',
      pos: [0.22, -0.55, 0.14],
      scanTargetY: -0.55,
      severity: isRadiationActive ? 'WARNING' : 'NOMINAL',
      metric: `14 Layers · Punctures: 0`,
      detail: `14-layer multi-layer insulation intact. Zero micrometeoroid punctures detected across shell.`,
      protocol: 'Inspect tethers and RTV glove palms every 45 minutes.',
    },
  ], [isDecomp, isScrubberFault, o2Reserve, o2TankPressureMpa, o2TteHours, o2TteRemMins, sublimatorRate, suitPressurePsi, suitPressureKpa, ppCo2, lcvgTemp, saferPressureMpa, isRadiationActive]);



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
        region: 'CRANIAL (+1.70m)',
        elevationTag: '+1.70m Cranial',
        side: 'LEFT' as const,
        pos: ASTRODOC_BODY_RIG.at[0],
        scanTargetY: 1.34 * 0.82,
        status: brainStatus,
        color: brainColor,
        primaryValue: isRadiationActive ? `${radFlux.toFixed(1)} mGy/h` : isOcularAlert ? '6.8 mm' : '5.2 mm',
        unitLabel: isRadiationActive ? 'Phosphenes' : isOcularAlert ? 'ONSD · High ICP' : 'ONSD · ICP 11',
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
        region: 'THORACIC (+0.78m)',
        elevationTag: '+0.78m Thoracic',
        side: 'LEFT' as const,
        pos: ASTRODOC_BODY_RIG.at[3],
        scanTargetY: 0.73 * 0.82,
        status: heartStatus,
        color: heartColor,
        primaryValue: `${Math.round(hr)} bpm`,
        unitLabel: isRadiationActive ? 'SPE Stress' : isCardiacCritical ? `QTc ${qtc}ms · Crit` : `QTc ${qtc}ms · NSR`,
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
        region: 'ABDOMINAL (+0.30m)',
        elevationTag: '+0.30m Abdominal',
        side: 'LEFT' as const,
        pos: ASTRODOC_BODY_RIG.at[2],
        scanTargetY: 0.20 * 0.82,
        status: renalStatus,
        color: renalColor,
        primaryValue: isRadiationActive ? `${(radDose || 0.75).toFixed(2)} Gy` : `${k.toFixed(2)} mmol/L`,
        unitLabel: isRadiationActive ? 'Rad Shift' : isRenalCritical ? 'K⁺ · Crit' : 'K⁺ · 450 mOsm',
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
        region: 'PULMONARY (+0.86m)',
        elevationTag: '+0.86m Pulmonary',
        side: 'RIGHT' as const,
        pos: [-ASTRODOC_BODY_RIG.at[1][0], ASTRODOC_BODY_RIG.at[1][1], ASTRODOC_BODY_RIG.at[1][2]] as [number, number, number],
        scanTargetY: 0.80 * 0.82,
        status: lungsStatus,
        color: lungsColor,
        primaryValue: isRadiationActive ? `${radFlux.toFixed(1)} mGy/h` : `${spo2.toFixed(1)}%`,
        unitLabel: isRadiationActive ? 'SPE Alert' : `SpO₂ · CO₂ ${co2.toFixed(1)}`,
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
        region: 'CIRCULATORY (+0.31m)',
        elevationTag: '+0.31m Circulatory',
        side: 'RIGHT' as const,
        pos: ASTRODOC_BODY_RIG.at[4],
        scanTargetY: 0.34 * 0.82,
        status: vascStatus,
        color: vascColor,
        primaryValue: isRadiationCritical ? `${radFlux.toFixed(1)} mGy/h` : `${hct.toFixed(1)}%`,
        unitLabel: isRadiationActive ? `Lymph ${telemetry?.lymphocyte_count ?? 0.85}` : `Hct · TRM ${trm.toFixed(2)}`,
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
        region: 'FEMORAL (-1.15m)',
        elevationTag: '-1.15m Femoral',
        side: 'RIGHT' as const,
        pos: ASTRODOC_BODY_RIG.at[5],
        scanTargetY: -0.78 * 0.82,
        status: skeletalStatus,
        color: skeletalColor,
        primaryValue: isRadiationCritical ? `${(radDose || 0.75).toFixed(2)} Gy` : `${bmd.toFixed(1)}%`,
        unitLabel: isRadiationActive ? 'Marrow Dose' : 'BMD · ARED 11.8 MJ',
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

  const activeDisplayTargets = modelType === 'SUIT' ? suitParts : anatomicalParts;
  const activeDisplayTargetsRef = useRef(activeDisplayTargets);
  const badgeAnchorsCacheRef = useRef<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    activeDisplayTargetsRef.current = activeDisplayTargets;
    badgeAnchorsCacheRef.current = {};
  }, [activeDisplayTargets, modelType]);

  // Smooth View Snap Trigger

  // Reset Camera View

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

  // Handle Anatomical Organ / Suit Subsystem Selection & Cinematic Focus
  const handleOrganClick = useCallback((organ: typeof anatomicalParts[0] | typeof suitParts[0] | any) => {
    targetCameraPosRef.current = null;
    targetControlsTargetRef.current = null;
    setSelectedOrganId(organ.id as any);
    setSelectedHotspot((organ as any).subsystemId || organ.id);
    setShowOrganModal(true);
    targetFocusYRef.current = organ.scanTargetY;

    if (onSelectSubsystem) {
      onSelectSubsystem(((organ as any).subsystemId || organ.id) as any);
    }
  }, [onSelectSubsystem]);

  // Unified Target Selector (Anatomy & EVA Suit)
  const handleTargetSelect = useCallback((targetId: string) => {
    const target = activeDisplayTargets.find(o => o.id === targetId) || activeDisplayTargets[0];
    if (target) {
      handleOrganClick(target as any);
    }
  }, [activeDisplayTargets, handleOrganClick]);

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
    const isMobileDevice = typeof window !== 'undefined' && (window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent));
    const targetPixelRatio = Math.min(window.devicePixelRatio || 1, isMobileDevice ? 1.5 : 1.75);
    renderer.setPixelRatio(targetPixelRatio);
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
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.4;
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

    // ─── 4. AstroDocX 3D Human Body Point-Cloud Group (36,000 Hybrid Points: 24k Base + 12k Internal Detail) ───
    const humanGroup = new THREE.Group();
    humanGroup.position.set(0, 0, 0);
    scene.add(humanGroup);

    const initialBody = generateProceduralAstroDocBody(ASTRODOC_TOTAL_POINTS);
    const astroGeo = new THREE.BufferGeometry();
    astroGeo.setAttribute('position', new THREE.BufferAttribute(initialBody.pos, 3));
    astroGeo.setAttribute('aNrm', new THREE.BufferAttribute(initialBody.nrm, 3));
    astroGeo.setAttribute('aReg', new THREE.BufferAttribute(initialBody.reg, 1));
    astroGeo.setAttribute('aSeed', new THREE.BufferAttribute(initialBody.seed, 1));

    const initFigRect = computeAstroDocFigRect(width, height, 1);
    const astroUniforms = {
      uAng: { value: 0.0 },
      uTime: { value: 0.0 },
      uBeat: { value: 0.0 },
      uPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uK: { value: ASTRODOC_VIEWBOX.k },
      uYMid: { value: ASTRODOC_VIEWBOX.yMid },
      uFocus: { value: -1.0 },
      uScan: { value: 0.0 },
      uTheme: { value: 0.0 },
      uS0: { value: 0.0 },
      uS1: { value: 0.0 },
      uS2: { value: 0.0 },
      uS3: { value: 0.0 },
      uS4: { value: 0.0 },
      uS5: { value: 0.0 },
      uHeart: { value: new THREE.Vector3(...ASTRODOC_BODY_RIG.heart) },
      uFigRect: { value: new THREE.Vector4(initFigRect.x, initFigRect.y, initFigRect.w, initFigRect.h) },
      uViewSize: { value: new THREE.Vector2(width, height) },
    };

    const astroMat = new THREE.RawShaderMaterial({
      vertexShader: ASTRODOC_VERTEX_SHADER,
      fragmentShader: ASTRODOC_FRAGMENT_SHADER,
      uniforms: astroUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });

    const astroPoints = new THREE.Points(astroGeo, astroMat);
    astroPoints.frustumCulled = false;
    humanGroup.add(astroPoints);

    let isDisposed = false;
    loadAstroDocBodyBin('/assets/body-ftVWkDPf.bin').then(binData => {
      // Only apply binary data if it matches the high-density buffer size to prevent truncating the geometry
      if (isDisposed || !binData || binData.n !== initialBody.n) return;
      (astroGeo.attributes.position.array as Float32Array).set(binData.pos);
      (astroGeo.attributes.aNrm.array as Float32Array).set(binData.nrm);
      (astroGeo.attributes.aReg.array as Float32Array).set(binData.reg);
      (astroGeo.attributes.aSeed.array as Float32Array).set(binData.seed);
      astroGeo.attributes.position.needsUpdate = true;
      astroGeo.attributes.aNrm.needsUpdate = true;
      astroGeo.attributes.aReg.needsUpdate = true;
      astroGeo.attributes.aSeed.needsUpdate = true;
    });

    // Store latest projected 2D coordinates for fast click/hover hit testing
    let latestProjectedMap: Record<string, { x: number; y: number }> = {};
    let latestFigRect = initFigRect;

    // ─── 4f. NASA EVA Suit Model Group (High-Fidelity Space EMU) ───
    const suitGroup = new THREE.Group();
    suitGroup.visible = false;
    scene.add(suitGroup);

    // Dedicated studio & solar lighting for the physical EVA space suit inside suitGroup
    const suitSunLight = new THREE.DirectionalLight(0xfff8ee, 2.4);
    suitSunLight.position.set(2.5, 4.0, 3.5);
    suitGroup.add(suitSunLight);

    const suitFillLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    suitFillLight.position.set(-2.5, 1.5, 2.0);
    suitGroup.add(suitFillLight);

    const suitBackRim = new THREE.DirectionalLight(0x38bdf8, 1.6);
    suitBackRim.position.set(0, 3.0, -3.5);
    suitGroup.add(suitBackRim);

    const suitAmbient = new THREE.AmbientLight(0x475569, 1.4);
    suitGroup.add(suitAmbient);

    // Strobe / Beacon light on helmet
    const helmetBeaconLight = new THREE.PointLight(0x00e5ff, 1.4, 3.0);
    helmetBeaconLight.position.set(0, 0.88, 0.22);
    suitGroup.add(helmetBeaconLight);

    const helmetBeaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    helmetBeaconMesh.position.set(0, 0.88, 0.22);
    suitGroup.add(helmetBeaconMesh);

    // Subtle Chest DCM status indicator LED
    const chestLedLight = new THREE.PointLight(0x38bdf8, 0.8, 1.5);
    chestLedLight.position.set(0, 0.32, 0.28);
    suitGroup.add(chestLedLight);

    // Lazy-load NASA EVA Suit GLB model on demand (saves 2.87MB network & CPU during initial load)
    let isSuitLoaded = false;
    let isSuitLoading = false;
    const loadSuitModel = () => {
      if (isSuitLoaded || isSuitLoading) return;
      isSuitLoading = true;
      const suitLoader = new GLTFLoader();
      suitLoader.load(
        '/models/Astronaut.glb',
        (gltf) => {
          isSuitLoaded = true;
          isSuitLoading = false;
          const rawModel = gltf.scene;
          const suitMeshContainer = new THREE.Group();

          // Retain authentic NASA spacesuit textures, gold visor, and enhance with aerospace materials
          rawModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              if (mesh.material) {
                const origMat = mesh.material as THREE.MeshStandardMaterial;
                origMat.color.setRGB(1.0, 1.0, 1.0);
                origMat.roughness = 0.44;
                origMat.metalness = 0.16;
                // Subtle aerospace rim glow
                origMat.emissive = new THREE.Color(0x0284c7);
                origMat.emissiveIntensity = 0.05;
                origMat.needsUpdate = true;
              }
            }
          });

          // Add rawModel hierarchy to container (maintains complete node tree & transforms)
          suitMeshContainer.add(rawModel);

          // Accurate uniform scale (preserves natural human suit anatomical proportions)
          const rawBox = new THREE.Box3().setFromObject(suitMeshContainer);
          const rawSize = rawBox.getSize(new THREE.Vector3());
          const targetH = 2.40;
          const scaleFactor = targetH / (rawSize.y || 1);
          suitMeshContainer.scale.set(scaleFactor, scaleFactor, scaleFactor);
          suitMeshContainer.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(suitMeshContainer);
          const center = scaledBox.getCenter(new THREE.Vector3());
          suitMeshContainer.position.set(-center.x, -center.y, -center.z);
          suitMeshContainer.updateMatrixWorld(true);

          suitGroup.add(suitMeshContainer);
        },
        undefined,
        (err) => {
          isSuitLoading = false;
          console.warn('Could not load Astronaut.glb:', err);
        }
      );
    };

    switchModelRef.current = (type: 'HUMAN' | 'SUIT') => {
      modelTypeRef.current = type;
      setModelType(type);
      if (type === 'HUMAN') {
        humanGroup.visible = true;
        suitGroup.visible = false;
        setSelectedOrganId('HEART');
        setSelectedHotspot('CARDIAC');
      } else {
        loadSuitModel();
        humanGroup.visible = false;
        suitGroup.visible = true;
        setSelectedOrganId('SUIT_PLSS');
        setSelectedHotspot('PLSS');
      }
    };

    focusSuitSubsystemRef.current = (id: string) => {
      const sub = suitParts.find(s => s.id === id || s.subsystemId === id);
      if (!sub) return;
      setSelectedOrganId(sub.id);
      setSelectedHotspot(sub.subsystemId);
      targetFocusYRef.current = sub.scanTargetY;
    };

    // ─── 5. Precision Axial Scan Ring (Clean anatomical slice contour without blinding wide sheet) ───
    const scanGroup = new THREE.Group();
    scene.add(scanGroup);

    const laserBeamPts = new Float32Array([-0.46, 0, 0, 0.46, 0, 0]);
    const laserBeamGeo = new THREE.BufferGeometry();
    laserBeamGeo.setAttribute('position', new THREE.BufferAttribute(laserBeamPts, 3));
    const laserBeamMat = new THREE.LineBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.42,
    });
    const laserBeamLine = new THREE.Line(laserBeamGeo, laserBeamMat);
    scanGroup.add(laserBeamLine);

    const scanSheetGeo = new THREE.PlaneGeometry(0.95, 0.24);
    scanSheetGeo.rotateX(Math.PI / 2);
    const scanSheetMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scanSheet = new THREE.Mesh(scanSheetGeo, scanSheetMat);
    scanGroup.add(scanSheet);

    const sliceCurve = new THREE.EllipseCurve(0, 0, 1, 1, 0, 2 * Math.PI, false, 0);
    const slicePoints = sliceCurve.getPoints(48);
    const sliceGeo = new THREE.BufferGeometry().setFromPoints(slicePoints);
    sliceGeo.rotateX(Math.PI / 2);
    const sliceMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.78,
    });
    const sliceContourLine = new THREE.LineLoop(sliceGeo, sliceMat);
    scanGroup.add(sliceContourLine);

    const scanLight = new THREE.PointLight(0x00e5ff, 1.4, 2.0);
    scanGroup.add(scanLight);

    updateMaterialsRef.current = (theme: string, severity: 'CRITICAL' | 'WARNING' | 'NOMINAL') => {
      astroUniforms.uTheme.value = theme === 'THERMAL' ? 1.0 : theme === 'AMBER' ? 2.0 : 0.0;
      const pColor = severity === 'CRITICAL' ? 0xf43f5e : severity === 'WARNING' ? 0xf59e0b : theme === 'THERMAL' ? 0xf97316 : theme === 'AMBER' ? 0xf59e0b : 0x7fe8ff;
      scanSheetMat.color.setHex(pColor);
      sliceMat.color.setHex(pColor);
      scanLight.color.setHex(severity === 'CRITICAL' ? 0xff173d : severity === 'WARNING' ? 0xf59e0b : pColor);
    };

    // Apply initial materials on mount
    updateMaterialsRef.current(colorTheme, activeSeverityRef.current);

    // ─── 6. Pointer & Click Event Handling ───
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
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (modelTypeRef.current === 'SUIT') {
          const mouse = new THREE.Vector2(
            (clickX / rect.width) * 2 - 1,
            -(clickY / rect.height) * 2 + 1
          );
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects([suitGroup], true);
          if (intersects.length > 0) {
            const hit = intersects[0];
            const localPt = suitGroup.worldToLocal(hit.point.clone());
            const y = localPt.y;
            const z = localPt.z;
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
          }
          return;
        }

        // Check 2D screen proximity to the 6 projected AstroDocX organ anchors
        let bestId: string | null = null;
        let bestDist = 52;
        activeDisplayTargetsRef.current.forEach(t => {
          const p = latestProjectedMap[t.id];
          if (!p) return;
          const dist = Math.hypot(clickX - p.x, clickY - p.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestId = t.id;
          }
        });

        if (bestId) {
          handleTargetSelectRef.current(bestId);
          return;
        }

        // If clicked inside the 300x660 figure silhouette, select the corresponding anatomical region by Y
        if (
          clickX >= latestFigRect.x + latestFigRect.w * 0.15 &&
          clickX <= latestFigRect.x + latestFigRect.w * 0.85 &&
          clickY >= latestFigRect.y &&
          clickY <= latestFigRect.y + latestFigRect.h
        ) {
          const figYNorm = (clickY - latestFigRect.y) / latestFigRect.h;
          if (figYNorm < 0.22) {
            handleTargetSelectRef.current('BRAIN');
          } else if (figYNorm < 0.38) {
            handleTargetSelectRef.current(clickX < latestFigRect.x + latestFigRect.w * 0.5 ? 'HEART' : 'LUNGS');
          } else if (figYNorm < 0.56) {
            handleTargetSelectRef.current(clickX < latestFigRect.x + latestFigRect.w * 0.5 ? 'KIDNEYS' : 'VASCULAR');
          } else {
            handleTargetSelectRef.current('SKELETAL');
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (snapTargetAzimuthRef.current !== null) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const moveX = e.clientX - rect.left;
      const moveY = e.clientY - rect.top;

      if (modelTypeRef.current === 'SUIT') {
        const mouse = new THREE.Vector2(
          (moveX / rect.width) * 2 - 1,
          -(moveY / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([suitGroup], true);
        renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';
        return;
      }

      const nearAnchor = activeDisplayTargetsRef.current.some(t => {
        const p = latestProjectedMap[t.id];
        return p && Math.hypot(moveX - p.x, moveY - p.y) < 38;
      });
      const inBody =
        moveX >= latestFigRect.x + latestFigRect.w * 0.22 &&
        moveX <= latestFigRect.x + latestFigRect.w * 0.78 &&
        moveY >= latestFigRect.y + latestFigRect.h * 0.05 &&
        moveY <= latestFigRect.y + latestFigRect.h * 0.95;

      renderer.domElement.style.cursor = nearAnchor || inBody ? 'pointer' : 'grab';
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointermove', onPointerMove);

    // ─── 7. Animation Loop (60 FPS AstroDocX Shader Uniforms, Arterial Pulse & Scan Sweep) ───
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let lastElapsed = 0;
    let beatPhase = 0;
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

    const statusToNum = (st?: string): number => {
      if (st === 'CRITICAL') return 2.0;
      if (st === 'WATCH' || st === 'WARNING') return 1.0;
      return 0.0;
    };

    let isTabVisible = typeof document !== 'undefined' ? !document.hidden : true;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && !isDisposed) {
        lastElapsed = clock.getElapsedTime();
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      if (isDisposed || !isTabVisible) return;
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const dt = Math.min(0.1, Math.max(0.001, elapsed - lastElapsed));
      lastElapsed = elapsed;

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
          if (autoRotateRef.current && modelTypeRef.current === 'SUIT') {
            controls.autoRotate = true;
          }
        }
      }

      const rawAz = controls.getAzimuthalAngle();
      // Gentle harmonic frontal oscillation (+/- 12.6 deg) + full 360 deg interactive drag rotation
      const idleSway = autoRotateRef.current ? 0.22 * Math.sin(elapsed * 0.35) : 0.0;
      const uAng = -rawAz + idleSway;
      if (azimuthDomRef.current) {
        const deg = Math.round((((uAng % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2)) * 360);
        azimuthDomRef.current.textContent = `${deg}°`;
      }

      const curW = containerSizeRef.current.width;
      const curH = containerSizeRef.current.height;
      const zoomScale = 5.85 / Math.max(3.4, Math.min(7.2, camera.position.length()));
      const figRect = computeAstroDocFigRect(curW, curH, zoomScale);
      latestFigRect = figRect;

      // Update AstroDocX Shader Uniforms (Phase-Locked to Live BPM without Discontinuities)
      const currentHr = Math.max(40, Math.min(200, hrRef.current || 62));
      beatPhase = (beatPhase + dt * (currentHr / 60.0)) % 1.0;
      const uBeat = beatPhase;

      const mode = laserModeRef.current;
      const uScan = mode === 'OFF' ? -1.0 : ((elapsed % 5.5) / 5.5);

      const activeOrgan = selectedOrganIdRef.current;
      const focusIdx =
        activeOrgan === 'BRAIN' ? 0.0 :
        activeOrgan === 'VASCULAR' ? 1.0 :
        activeOrgan === 'LUNGS' ? 2.0 :
        activeOrgan === 'KIDNEYS' ? 3.0 :
        activeOrgan === 'SKELETAL' ? 4.0 :
        activeOrgan === 'HEART' ? 5.0 : -1.0;

      const targets = activeDisplayTargetsRef.current;
      const findStatus = (id: string) => statusToNum(targets.find(t => t.id === id)?.status);

      const pr = Math.min(window.devicePixelRatio || 1, 2);
      astroUniforms.uAng.value = uAng;
      astroUniforms.uTime.value = elapsed;
      astroUniforms.uBeat.value = uBeat;
      astroUniforms.uPR.value = pr * Math.min(1.28, Math.max(0.92, figRect.w / 220));
      astroUniforms.uFocus.value = focusIdx;
      astroUniforms.uScan.value = uScan;
      astroUniforms.uS0.value = findStatus('BRAIN');
      astroUniforms.uS1.value = findStatus('VASCULAR');
      astroUniforms.uS2.value = findStatus('LUNGS');
      astroUniforms.uS3.value = findStatus('KIDNEYS');
      astroUniforms.uS4.value = findStatus('SKELETAL');
      astroUniforms.uS5.value = findStatus('HEART');
      astroUniforms.uFigRect.value.set(figRect.x, figRect.y, figRect.w, figRect.h);
      astroUniforms.uViewSize.value.set(curW, curH);

      // Update SVG Floor & Scanline overlay in 300x660 figure space
      if (figSvgRef.current) {
        figSvgRef.current.style.left = `${figRect.x}px`;
        figSvgRef.current.style.top = `${figRect.y}px`;
        figSvgRef.current.style.width = `${figRect.w}px`;
        figSvgRef.current.style.height = `${figRect.h}px`;
      }
      if (scanLineSvgRef.current) {
        if (uScan >= 0 && modelTypeRef.current === 'HUMAN') {
          const scanY660 = 40 + uScan * 580;
          scanLineSvgRef.current.setAttribute('y1', scanY660.toFixed(1));
          scanLineSvgRef.current.setAttribute('y2', scanY660.toFixed(1));
          scanLineSvgRef.current.style.opacity = '1';
        } else {
          scanLineSvgRef.current.style.opacity = '0';
        }
      }

      // Keep 3D slice ring only for EVA Suit mode; AstroDocX body uses shader scan wave + SVG scanline
      if (modelTypeRef.current === 'SUIT' && mode !== 'OFF') {
        scanGroup.visible = true;
        const cycle = (Math.sin(elapsed * 1.05) + 1) * 0.5;
        targetScanY = -1.45 + cycle * (1.35 - (-1.45));
        currentScanY += (targetScanY - currentScanY) * 0.15;
        scanGroup.position.y = currentScanY;
        const contour = getBodyContourRadii(currentScanY);
        sliceContourLine.scale.set(contour.rx * 1.04, 1, contour.rz * 1.04);
        scanSheetMat.opacity = 0.035;
      } else {
        scanGroup.visible = false;
        currentScanY = 1.75 - Math.max(0, uScan) * 3.6;
      }

      if (elevationDomRef.current) {
        elevationDomRef.current.textContent = `${currentScanY >= 0 ? '+' : ''}${currentScanY.toFixed(2)} m`;
      }
      if (regionDomRef.current) {
        regionDomRef.current.textContent = getRegionName(currentScanY);
      }
      if (sliceIndexDomRef.current) {
        const sliceNum = Math.round(((1.75 - currentScanY) / 3.6) * 128);
        sliceIndexDomRef.current.textContent = `#${Math.max(1, Math.min(128, sliceNum))}`;
      }
      if (elevationRulerChevronRef.current) {
        const pct = Math.max(0, Math.min(100, ((currentScanY + 1.85) / 3.6) * 100));
        elevationRulerChevronRef.current.style.bottom = `${pct}%`;
      }

      // ─── Real-Time Microgravity EVA Spacesuit Floating & Strobe Animation ───
      if (modelTypeRef.current === 'SUIT') {
        suitGroup.position.y = Math.sin(elapsed * 1.25) * 0.035;
        suitGroup.rotation.z = Math.sin(elapsed * 0.65) * 0.016;
        suitGroup.rotation.x = Math.sin(elapsed * 0.85) * 0.012;

        const beaconPulse = 0.5 + 0.5 * Math.sin(elapsed * 3.5);
        helmetBeaconLight.intensity = 0.6 + 1.2 * beaconPulse;
        helmetBeaconMesh.scale.setScalar(0.9 + 0.3 * beaconPulse);
      }

      const curSev = activeSeverityRef.current;
      scanLight.intensity = curSev === 'CRITICAL' ? 1.8 : 1.4;

      // ─── Project 3D AstroDocX Organ Anchors to 2D Screen for Minimal Dots & Stationary Card Leader Lines ───
      if (showBadgesRef.current) {
        const projectedMap: Record<string, { x: number; y: number }> = {};

        activeDisplayTargetsRef.current.forEach(ht => {
          const [bx, by] = projectAstroDocPoint(ht.pos, uAng);
          const screenX = figRect.x + (bx / ASTRODOC_VIEWBOX.width) * figRect.w;
          const screenY = figRect.y + (by / ASTRODOC_VIEWBOX.height) * figRect.h;
          projectedMap[ht.id] = { x: screenX, y: screenY };

          // Position Minimal 2D Small-Dot Pointer (20x20 container -> center is -10px)
          const ringEl = ringRefs.current[ht.id];
          if (ringEl) {
            ringEl.style.transform = `translate(${screenX - 10}px, ${screenY - 10}px)`;
            const ringCircle = ringEl.querySelector('.reticle-ring-circle') as HTMLElement;
            if (ringCircle) {
              ringCircle.style.borderColor = `${ht.color}55`;
              ringCircle.style.background = `${ht.color}18`;
            }
            const innerDot = ringEl.querySelector('.reticle-inner-dot') as HTMLElement;
            if (innerDot) {
              innerDot.style.background = ht.color;
              innerDot.style.boxShadow = `0 0 8px ${ht.color}`;
            }
          }
        });

        latestProjectedMap = projectedMap;

        // Connect Leader Lines from Stationary Callout Cards to 3D Organ Dots (Cached Layout - 0 Reflows in rAF Loop)
        activeDisplayTargetsRef.current.forEach(ht => {
          const p = projectedMap[ht.id];
          const badgeEl = badgeRefs.current[ht.id];
          const lineEl = lineRefs.current[ht.id];
          if (!p || !lineEl) return;

          let cached = badgeAnchorsCacheRef.current[ht.id];
          if (!cached && badgeEl && mountRef.current) {
            const bRect = badgeEl.getBoundingClientRect();
            const cRect = mountRef.current.getBoundingClientRect();
            cached = {
              x: ht.side === 'LEFT' ? (bRect.right - cRect.left) : (bRect.left - cRect.left),
              y: (bRect.top - cRect.top) + bRect.height * 0.5,
            };
            badgeAnchorsCacheRef.current[ht.id] = cached;
          }

          const badgeAnchorX = cached ? cached.x : (ht.side === 'LEFT' ? 210 : curW - 210);
          const badgeAnchorY = cached ? cached.y : p.y;

          lineEl.setAttribute('x1', String(badgeAnchorX));
          lineEl.setAttribute('y1', String(badgeAnchorY));
          lineEl.setAttribute('x2', String(p.x));
          lineEl.setAttribute('y2', String(p.y));
          lineEl.setAttribute('stroke', ht.color);
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
          badgeAnchorsCacheRef.current = {};
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      controls.dispose();
      astroGeo.dispose();
      astroMat.dispose();
      renderer.dispose();
      if (container && dom) {
        container.removeChild(dom);
      }
    };
  }, []);

  // Target Icon Selector for Anatomical Organs & EVA Spacesuit Subsystems
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
      case 'SUIT_VISOR':
      case 'VISOR':
        return <Eye size={16} color={color} />;
      case 'SUIT_DCM':
      case 'DCM':
        return <Gauge size={16} color={color} />;
      case 'SUIT_LCVG':
      case 'LCVG':
        return <Thermometer size={16} color={color} />;
      case 'SUIT_PLSS':
      case 'PLSS':
        return <Shield size={16} color={color} />;
      case 'SUIT_SAFER':
      case 'SAFER':
        return <Navigation size={16} color={color} />;
      case 'SUIT_TMG':
      case 'TMG':
        return <Layers size={16} color={color} />;
      default:
        return <Activity size={16} color={color} />;
    }
  };

  return (
    <div style={{
      background: 'transparent',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "var(--hud-font-sans, 'Tomorrow', -apple-system, BlinkMacSystemFont, sans-serif)",
    }}>
      {/* ─── Top Technical Control Strip (Dropdown Selectors & Full 3D View Toggle) ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '7px 16px',
        borderBottom: '1px solid rgba(122, 148, 99, 0.18)',
        background: 'linear-gradient(180deg, rgba(18, 26, 21, 0.95) 0%, rgba(12, 18, 15, 0.98) 100%)',
        position: 'relative',
        zIndex: 40,
      }}>
        {/* Left Controls: Model Selector & Sensor Themes as Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          
          {/* 1. Model Selector Dropdown */}
          <div ref={modelDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsModelDropdownOpen(prev => !prev);
                setIsThemeDropdownOpen(false);
              }}
              style={{
                background: isModelDropdownOpen
                  ? 'linear-gradient(180deg, #2d4030 0%, #1e2c20 100%)'
                  : 'linear-gradient(180deg, #223024 0%, #172219 100%)',
                border: isModelDropdownOpen
                  ? '1px solid rgba(161, 180, 142, 0.50)'
                  : '1px solid rgba(122, 148, 99, 0.28)',
                color: '#f1f5f9',
                borderRadius: 5,
                padding: '4.5px 10px',
                fontSize: 10.5,
                fontWeight: 600,
                fontFamily: 'monospace',
                lineHeight: 1,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.14s ease',
              }}
            >
              {modelType === 'HUMAN' ? <User size={12} color="#34d399" /> : <Shield size={12} color="#38bdf8" />}
              <span>{modelType === 'HUMAN' ? '3D Body' : 'EVA Suit'}</span>
              <ChevronDown
                size={11}
                color="#94a3b8"
                style={{
                  transform: isModelDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {isModelDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 100,
                  background: 'linear-gradient(180deg, rgba(20, 30, 23, 0.98) 0%, rgba(13, 19, 15, 0.99) 100%)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(122, 148, 99, 0.35)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  padding: 4,
                  minWidth: 175,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {[
                  { id: 'HUMAN' as const, label: '3D Body', sub: 'Bio-Twin Hologram', icon: User, color: '#34d399' },
                  { id: 'SUIT' as const, label: 'EVA Suit', sub: 'NASA EMU Suit', icon: Shield, color: '#38bdf8' },
                ].map(opt => {
                  const active = modelType === opt.id;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        switchModelRef.current && switchModelRef.current(opt.id);
                        handleCloseOrganModal();
                        setIsModelDropdownOpen(false);
                      }}
                      style={{
                        background: active ? 'rgba(122, 148, 99, 0.22)' : 'transparent',
                        border: 'none',
                        color: active ? '#ffffff' : '#cbd5e1',
                        borderRadius: 4,
                        padding: '6px 9px',
                        fontSize: 10.5,
                        fontFamily: 'monospace',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={e => {
                        if (!active) e.currentTarget.style.background = 'rgba(122, 148, 99, 0.12)';
                      }}
                      onMouseLeave={e => {
                        if (!active) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Icon size={12} color={opt.color} />
                        <div>
                          <div style={{ fontWeight: active ? 700 : 500 }}>{opt.label}</div>
                          <div style={{ fontSize: 8.5, color: '#8291a0' }}>{opt.sub}</div>
                        </div>
                      </div>
                      {active && <CheckCircle2 size={11} color="#34d399" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span style={{ width: 1, height: 16, background: 'rgba(122, 148, 99, 0.22)' }} />

          {/* 2. Sensor Theme Mode Dropdown */}
          <div ref={themeDropdownRef} style={{ position: 'relative' }}>
            {(() => {
              const themeList = [
                {
                  id: 'CYAN' as const,
                  label: 'CYAN',
                  sub: 'Bio-Holo',
                  desc: 'Cephalic fluid shift & anatomy',
                  icon: Activity,
                  color: '#38bdf8',
                },
                {
                  id: 'THERMAL' as const,
                  label: 'THERMAL',
                  sub: 'IR Heatmap',
                  desc: 'Metabolic core heat dissipation',
                  icon: Flame,
                  color: '#ea580c',
                },
                {
                  id: 'AMBER' as const,
                  label: 'AMBER',
                  sub: 'Tactical HUD',
                  desc: 'Apollo/Orion high-contrast sentry',
                  icon: Sun,
                  color: '#d97706',
                },
              ];
              const activeThemeObj = themeList.find(t => t.id === colorTheme) || themeList[0];
              const ActiveIcon = activeThemeObj.icon;

              return (
                <>
                  <button
                    onClick={() => {
                      setIsThemeDropdownOpen(prev => !prev);
                      setIsModelDropdownOpen(false);
                    }}
                    style={{
                      background: isThemeDropdownOpen
                        ? 'linear-gradient(180deg, #2d4030 0%, #1e2c20 100%)'
                        : 'linear-gradient(180deg, #223024 0%, #172219 100%)',
                      border: isThemeDropdownOpen
                        ? '1px solid rgba(161, 180, 142, 0.50)'
                        : '1px solid rgba(122, 148, 99, 0.28)',
                      color: '#f1f5f9',
                      borderRadius: 5,
                      padding: '4.5px 10px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.14s ease',
                    }}
                  >
                    <ActiveIcon size={12} color={activeThemeObj.color} />
                    <span>{activeThemeObj.label}</span>
                    <span style={{ fontSize: 9, opacity: 0.8, color: '#94a3b8' }}>({activeThemeObj.sub})</span>
                    <ChevronDown
                      size={11}
                      color="#94a3b8"
                      style={{
                        transform: isThemeDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {isThemeDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        zIndex: 100,
                        background: 'linear-gradient(180deg, rgba(20, 30, 23, 0.98) 0%, rgba(13, 19, 15, 0.99) 100%)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(122, 148, 99, 0.35)',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                        borderRadius: 6,
                        padding: 4,
                        minWidth: 220,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {themeList.map(t => {
                        const active = colorTheme === t.id;
                        const IconComponent = t.icon;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setColorTheme(t.id);
                              setIsThemeDropdownOpen(false);
                            }}
                            style={{
                              background: active ? 'rgba(122, 148, 99, 0.22)' : 'transparent',
                              border: 'none',
                              color: active ? '#ffffff' : '#cbd5e1',
                              borderRadius: 4,
                              padding: '6px 9px',
                              fontSize: 10.5,
                              fontFamily: 'monospace',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={e => {
                              if (!active) e.currentTarget.style.background = 'rgba(122, 148, 99, 0.12)';
                            }}
                            onMouseLeave={e => {
                              if (!active) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <IconComponent size={12} color={t.color} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                  <span style={{ fontWeight: active ? 700 : 500 }}>{t.label}</span>
                                  <span style={{ fontSize: 9, color: '#94a3b8' }}>({t.sub})</span>
                                </div>
                                <div style={{ fontSize: 8.5, color: '#8291a0', whiteSpace: 'nowrap' }}>{t.desc}</div>
                              </div>
                            </div>
                            {active && <CheckCircle2 size={11} color="#34d399" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Very Right: Layout Toggle (Split vs Full 3D View) */}
        <button
          onClick={() => setViewMode(prev => prev === 'SPLIT' ? 'FULL' : 'SPLIT')}
          title="Toggle between full 3D view and split telemetry inspection"
          style={{
            background: viewMode === 'FULL'
              ? 'linear-gradient(180deg, #2d4030 0%, #1e2c20 100%)'
              : 'linear-gradient(180deg, #223024 0%, #172219 100%)',
            border: viewMode === 'FULL'
              ? '1px solid rgba(161, 180, 142, 0.50)'
              : '1px solid rgba(122, 148, 99, 0.28)',
            color: viewMode === 'FULL' ? '#ffffff' : '#e2e8f0',
            borderRadius: 5,
            padding: '4.5px 10px',
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: 'monospace',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            flexShrink: 0,
            marginLeft: 'auto',
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

      {/* ─── Main 3D Viewport & Inspection Split Card (Fluid Aerospace 470px Framing) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'FULL' ? '1fr' : 'minmax(480px, 1fr) 310px',
        height: 470,
        maxHeight: 520,
        position: 'relative',
      }}>
        {/* Left: 3D Holographic Canvas Viewport (Deep Obsidian Stage for Maximum Container & Point-Cloud Contrast) */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 48%, rgba(5, 11, 22, 0.85) 0%, rgba(2, 5, 11, 0.96) 100%)',
        }}>
          {/* WebGL Canvas Container */}
          <div ref={mountRef} style={{ width: '100%', height: '100%', background: 'transparent' }} />

          {/* ── ASTRODOCX 300x660 FIGURE OVERLAY (Concentric Floor Ellipses & Sweeping Scanline) ── */}
          {modelType === 'HUMAN' && (
            <svg
              ref={figSvgRef}
              viewBox="0 0 300 660"
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 200,
                height: 440,
                pointerEvents: 'none',
                zIndex: 5,
                overflow: 'visible',
              }}
            >
              <defs>
                <radialGradient id="twin-floor-grad" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" stopColor="#2dd4e8" stopOpacity="0.32" />
                  <stop offset="1" stopColor="#2dd4e8" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g className="twin-floor">
                <ellipse cx="150" cy="625" rx="112" ry="18" fill="url(#twin-floor-grad)" stroke="rgba(127, 232, 255, 0.24)" strokeWidth="1" />
                <ellipse cx="150" cy="625" rx="82" ry="12" fill="none" stroke="rgba(127, 232, 255, 0.28)" strokeWidth="1" strokeDasharray="3 5" />
                <ellipse cx="150" cy="625" rx="46" ry="7" fill="none" stroke="rgba(127, 232, 255, 0.18)" strokeWidth="1" />
              </g>
              <line
                ref={scanLineSvgRef}
                x1="44"
                x2="256"
                y1="0"
                y2="0"
                stroke="rgba(191, 246, 255, 0.55)"
                strokeWidth="1"
              />
            </svg>
          )}

          {/* ── SVG OVERLAY FOR HORIZONTAL DOTTED LEADER LINES (twin-leader) ── */}
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
                  strokeWidth={selectedOrganId === t.id ? "1.35" : "1"}
                  strokeDasharray="2 4"
                  opacity={selectedOrganId === t.id ? 0.78 : 0.36}
                />
              ))}
            </svg>
          )}

          {/* ── MINIMAL SMALL-DOT POINTERS ON BODY (twin-halo + twin-dot) ── */}
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
                width: 20,
                height: 20,
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
                e.currentTarget.style.filter = 'drop-shadow(0 0 6px #ffffff)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              <div
                className="reticle-ring-circle"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `1px solid ${t.color}4d`,
                  background: `${t.color}14`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div
                  className="reticle-inner-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: t.color,
                    boxShadow: `0 0 8px ${t.color}`,
                  }}
                />
              </div>
            </div>
          ))}

          {/* ── LEFT STATIONARY TELEMETRY CALLOUTS (Elevated Contrast Container, Subtle Border, Fixed Size, Aligned Text) ── */}
          {showBadges && (
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              {activeDisplayTargets.filter(t => t.side === 'LEFT').map(t => {
                const isSelected = selectedOrganId === t.id;
                const isNominal = t.status === 'NOMINAL';
                const statusTextColor =
                  t.status === 'CRITICAL'
                    ? '#f87171'
                    : t.status === 'WATCH'
                      ? '#fbbf24'
                      : '#34d399';

                return (
                  <div
                    key={t.id}
                    ref={el => { badgeRefs.current[t.id] = el; }}
                    onClick={() => handleTargetSelect(t.id)}
                    style={{
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      width: 196,
                      height: 56,
                      minHeight: 56,
                      maxHeight: 56,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      borderRadius: 10,
                      padding: '9px 12px',
                      background: isSelected
                        ? 'linear-gradient(180deg, rgba(38, 54, 40, 0.96) 0%, rgba(24, 38, 27, 0.98) 100%)'
                        : isNominal
                          ? 'linear-gradient(180deg, rgba(26, 36, 28, 0.92) 0%, rgba(18, 26, 20, 0.96) 100%)'
                          : 'linear-gradient(180deg, rgba(46, 20, 26, 0.92) 0%, rgba(30, 13, 18, 0.96) 100%)',
                      border: isSelected
                        ? '1px solid rgba(161, 180, 142, 0.32)'
                        : isNominal
                          ? '1px solid rgba(122, 148, 99, 0.16)'
                          : '1px solid rgba(248, 113, 113, 0.28)',
                      boxShadow: isSelected
                        ? '0 6px 18px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                        : '0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'background 0.16s ease, border-color 0.16s ease',
                    }}
                  >
                    {/* Row 1: Subsystem Title + Subtle Colored Status Text */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      width: '100%',
                      lineHeight: 1,
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {t.title}
                      </span>
                      <span style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: statusTextColor,
                        letterSpacing: '0.05em',
                        lineHeight: 1,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        {t.status}
                      </span>
                    </div>

                    {/* Row 2: Clean Left-Aligned Primary Metric + Unit/Context (No Truncation or Wide Gap) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'flex-start',
                      gap: 8,
                      width: '100%',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        fontVariantNumeric: 'tabular-nums',
                        color: '#ffffff',
                        letterSpacing: '-0.01em',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {t.primaryValue}
                      </span>
                      <span style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        fontVariantNumeric: 'tabular-nums',
                        color: '#94a3b8',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {t.unitLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RIGHT STATIONARY TELEMETRY CALLOUTS (Elevated Contrast Container, Subtle Border, Fixed Size, Aligned Text) ── */}
          {showBadges && (
            <div
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              {activeDisplayTargets.filter(t => t.side === 'RIGHT').map(t => {
                const isSelected = selectedOrganId === t.id;
                const isNominal = t.status === 'NOMINAL';
                const statusTextColor =
                  t.status === 'CRITICAL'
                    ? '#f87171'
                    : t.status === 'WATCH'
                      ? '#fbbf24'
                      : '#34d399';

                return (
                  <div
                    key={t.id}
                    ref={el => { badgeRefs.current[t.id] = el; }}
                    onClick={() => handleTargetSelect(t.id)}
                    style={{
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      width: 196,
                      height: 56,
                      minHeight: 56,
                      maxHeight: 56,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      borderRadius: 10,
                      padding: '9px 12px',
                      background: isSelected
                        ? 'linear-gradient(180deg, rgba(38, 54, 40, 0.96) 0%, rgba(24, 38, 27, 0.98) 100%)'
                        : isNominal
                          ? 'linear-gradient(180deg, rgba(26, 36, 28, 0.92) 0%, rgba(18, 26, 20, 0.96) 100%)'
                          : 'linear-gradient(180deg, rgba(46, 20, 26, 0.92) 0%, rgba(30, 13, 18, 0.96) 100%)',
                      border: isSelected
                        ? '1px solid rgba(161, 180, 142, 0.32)'
                        : isNominal
                          ? '1px solid rgba(122, 148, 99, 0.16)'
                          : '1px solid rgba(248, 113, 113, 0.28)',
                      boxShadow: isSelected
                        ? '0 6px 18px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                        : '0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'background 0.16s ease, border-color 0.16s ease',
                    }}
                  >
                    {/* Row 1: Subsystem Title + Subtle Colored Status Text */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      width: '100%',
                      lineHeight: 1,
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {t.title}
                      </span>
                      <span style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: statusTextColor,
                        letterSpacing: '0.05em',
                        lineHeight: 1,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        {t.status}
                      </span>
                    </div>

                    {/* Row 2: Clean Left-Aligned Primary Metric + Unit/Context (No Truncation or Wide Gap) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'flex-start',
                      gap: 8,
                      width: '100%',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        fontVariantNumeric: 'tabular-nums',
                        color: '#ffffff',
                        letterSpacing: '-0.01em',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {t.primaryValue}
                      </span>
                      <span style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        fontVariantNumeric: 'tabular-nums',
                        color: '#94a3b8',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {t.unitLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── INTERACTIVE FLOATING ANATOMICAL ORGAN FUNCTION & HEALTH CARD (COMPACT FIXED SIZE — NO SCROLLBAR) ── */}
          {inspectionMode === 'ANATOMY' && showOrganModal && selectedOrganId && (() => {
            const organ = anatomicalParts.find(o => o.id === selectedOrganId) || anatomicalParts[1];
            const organColor = organ.color || '#38bdf8';

            return (
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 410,
                  maxWidth: 'calc(100% - 24px)',
                  height: 168,
                  maxHeight: 168,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  background: 'linear-gradient(180deg, rgba(22, 32, 25, 0.97) 0%, rgba(14, 21, 16, 0.99) 100%)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(122, 148, 99, 0.26)',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  zIndex: 35,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Header: Icon, Title, Subsystem, Status Badge & Close X */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', lineHeight: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: 'rgba(122, 148, 99, 0.16)',
                      border: '1px solid rgba(122, 148, 99, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {renderTargetIcon(organ.id, organColor)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {organ.title.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {organ.subsystemName.split('&')[0].trim().toUpperCase()} · {organ.elevationTag}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: organ.status === 'CRITICAL' ? '#f87171' : organ.status === 'WATCH' ? '#fbbf24' : '#34d399',
                      background: organ.status === 'CRITICAL' ? 'rgba(64, 18, 26, 0.85)' : organ.status === 'WATCH' ? 'rgba(58, 38, 14, 0.85)' : 'rgba(18, 36, 24, 0.85)',
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: `1px solid ${organ.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.28)' : organ.status === 'WATCH' ? 'rgba(245, 158, 11, 0.28)' : 'rgba(122, 148, 99, 0.28)'}`,
                    }}>
                      {organ.status}
                    </span>
                    <button
                      onClick={handleCloseOrganModal}
                      title="Close Organ Inspection HUD"
                      style={{
                        background: 'linear-gradient(180deg, #223024 0%, #172219 100%)',
                        border: '1px solid rgba(122, 148, 99, 0.28)',
                        borderRadius: 4,
                        color: '#cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: '3px',
                        lineHeight: 1,
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Biometrics & Rapid Action Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: 'rgba(10, 16, 12, 0.85)',
                  border: '1px solid rgba(122, 148, 99, 0.14)',
                  padding: '4px 8px',
                  borderRadius: 6,
                  lineHeight: 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>BIOMETRICS:</span>
                    <span style={{
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      color: organ.status === 'CRITICAL' ? '#fca5a5' : organ.status === 'WATCH' ? '#fde047' : '#f8fafc',
                      lineHeight: 1,
                    }}>
                      {organ.metric}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      targetFocusYRef.current = organ.scanTargetY;
                      if (onSelectSubsystem) onSelectSubsystem(organ.subsystemId);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 9,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      lineHeight: 1,
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <Crosshair size={10} />
                    <span>FOCUS</span>
                  </button>
                </div>

                {/* Structured Clinical Synopsis (Concise Physiology & Assessment — Fits Perfectly) */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  background: 'rgba(16, 24, 18, 0.65)',
                  border: '1px solid rgba(122, 148, 99, 0.12)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 9.5,
                  lineHeight: 1.35,
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    color: '#cbd5e1',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    <strong style={{ color: '#7a9463', fontWeight: 700, fontFamily: 'monospace' }}>PHYSIOLOGY: </strong>
                    {organ.functionSummary}
                  </div>
                  <div style={{
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: 9.5,
                  }}>
                    <strong style={{ color: organColor, fontWeight: 700, fontFamily: 'monospace' }}>RX PROTOCOL: </strong>
                    {organ.protocol}
                  </div>
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
            fontSize: 9.5,
            fontFamily: 'monospace',
            lineHeight: 1,
            color: '#94a3b8',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 15,
            background: 'linear-gradient(180deg, rgba(16, 26, 44, 0.88) 0%, rgba(11, 18, 31, 0.92) 100%)',
            padding: '4.5px 9px',
            borderRadius: 6,
            border: '1px solid rgba(148, 163, 184, 0.12)',
          }}>
            <span>ELEV: <span ref={elevationDomRef} style={{ color: '#ffffff', fontWeight: 700 }}>+0.70 m</span></span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>SLICE: <span ref={sliceIndexDomRef} style={{ color: '#38bdf8', fontWeight: 700 }}>#64</span></span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>AZ: <span ref={azimuthDomRef} style={{ color: '#ffffff', fontWeight: 700 }}>0°</span></span>
            <span style={{ display: 'none' }} ref={regionDomRef} />
          </div>
        </div>

        {/* Right: Full Simultaneous Subsystems Panel (Shown in Split Mode) */}
        {viewMode === 'SPLIT' && (() => {
          const displayHotspots = modelType === 'SUIT' ? suitHotspots : hotspots;
          return (
          <div style={{
            borderLeft: '1px solid rgba(148, 163, 184, 0.10)',
            background: 'linear-gradient(180deg, rgba(9, 15, 26, 0.96) 0%, rgba(6, 10, 18, 0.98) 100%)',
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
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em', lineHeight: 1 }}>
                  {modelType === 'SUIT' ? 'EVA SUIT SUBSYSTEMS' : 'PHYSIOLOGICAL SUBSYSTEMS'}
                </span>
                {modelType === 'SUIT' ? (
                  <span style={{
                    fontSize: 9,
                    color: isDecomp ? '#f87171' : isScrubberFault ? '#fbbf24' : '#38bdf8',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isDecomp ? '#ef4444' : isScrubberFault ? '#f59e0b' : '#0ea5e9',
                    }} />
                    <span>{isDecomp ? 'DECOMP ALARM' : isScrubberFault ? 'CO2 ALERT' : 'NASA xEMU SENTRY'}</span>
                  </span>
                ) : (
                  <span style={{
                    fontSize: 9,
                    color: isRadiationCritical || activeSeverity === 'CRITICAL' ? '#f87171' : (isRadiationActive || activeSeverity === 'WARNING') ? '#fbbf24' : '#34d399',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isRadiationCritical || activeSeverity === 'CRITICAL' ? '#ef4444' : (isRadiationActive || activeSeverity === 'WARNING') ? '#f59e0b' : '#10b981',
                    }} />
                    <span>{isRadiationCritical ? 'SHELTER ALARM' : isRadiationActive ? 'SPE ALERT' : activeSeverity}</span>
                  </span>
                )}
              </div>

              {/* Subsystems Stack (Elevated Contrast Container, Subtle Border, Fixed Size, Aligned Text) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {displayHotspots.map(hs => {
                  const isSelected = selectedHotspot === hs.id;
                  const isCrit = hs.severity === 'CRITICAL';
                  const isWarn = hs.severity === 'WARNING';

                  const cardBorder = isSelected
                    ? '1px solid rgba(161, 180, 142, 0.32)'
                    : isCrit
                      ? '1px solid rgba(239, 68, 68, 0.30)'
                      : isWarn
                        ? '1px solid rgba(245, 158, 11, 0.28)'
                        : '1px solid rgba(122, 148, 99, 0.16)';

                  const cardBg = isSelected
                    ? 'linear-gradient(180deg, rgba(38, 54, 40, 0.96) 0%, rgba(24, 38, 27, 0.98) 100%)'
                    : isCrit
                      ? 'linear-gradient(180deg, rgba(46, 20, 26, 0.92) 0%, rgba(30, 13, 18, 0.96) 100%)'
                      : isWarn
                        ? 'linear-gradient(180deg, rgba(42, 30, 16, 0.92) 0%, rgba(28, 20, 12, 0.96) 100%)'
                        : 'linear-gradient(180deg, rgba(24, 34, 27, 0.92) 0%, rgba(16, 24, 18, 0.96) 100%)';

                  const statusColor = isCrit
                    ? '#f87171'
                    : isWarn
                      ? '#fbbf24'
                      : isSelected
                        ? '#a1b48e'
                        : '#34d399';

                  const metricParts = hs.metric.split('·');
                  const primaryReading = metricParts[0]?.trim() || hs.metric;
                  const secondaryReading = metricParts.slice(1).join(' · ').trim();

                  return (
                    <div
                      key={hs.id}
                      onClick={() => {
                        setSelectedHotspot(hs.id);
                        if (modelType === 'SUIT') {
                          const targetPart = suitParts.find(p => p.subsystemId === hs.id);
                          if (targetPart) handleOrganClick(targetPart as any);
                        } else {
                          if (onSelectSubsystem) onSelectSubsystem(hs.id as any);
                        }
                      }}
                      style={{
                        background: cardBg,
                        border: cardBorder,
                        borderRadius: 9,
                        height: 52,
                        minHeight: 52,
                        maxHeight: 52,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        padding: '8px 11px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.16s ease, border-color 0.16s ease',
                      }}
                    >
                      {/* Row 1: Subsystem Title + Subtle Colored Status Text */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, lineHeight: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, flex: 1, overflow: 'hidden', lineHeight: 1 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: isSelected ? '#ffffff' : '#e2e8f0', letterSpacing: '0.04em', flexShrink: 0, lineHeight: 1 }}>
                            {hs.id}
                          </span>
                          <span style={{ fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>
                            {hs.organ}
                          </span>
                        </div>

                        <span style={{
                          fontSize: 8.5,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: statusColor,
                          letterSpacing: '0.06em',
                          lineHeight: 1,
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}>
                          {isSelected ? 'ACTIVE' : hs.severity}
                        </span>
                      </div>

                      {/* Row 2: Fixed Single-Line Primary Metric Value + Secondary Context */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontFamily: 'monospace',
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: isCrit ? '#fca5a5' : isWarn ? '#fde047' : '#ffffff',
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}>
                          {primaryReading}
                        </span>
                        {secondaryReading && (
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            color: '#94a3b8',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {secondaryReading}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Active Subsystem Deep-Dive Telemetry Inspector ── */}
              <div style={{
                background: 'linear-gradient(180deg, rgba(16, 26, 44, 0.94) 0%, rgba(11, 18, 31, 0.97) 100%)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: 9,
                padding: '8px 10px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                fontFamily: 'monospace',
              }}>
                {/* Inspector Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1 }}>
                    <Activity size={10} style={{ color: '#38bdf8' }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em', lineHeight: 1 }}>
                      INSPECTOR // {modelType === 'SUIT' ? `EVA SUIT · ${selectedHotspot}` : selectedHotspot}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 7.5,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399',
                    background: 'rgba(12, 44, 36, 0.85)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                    padding: '2.5px 6px',
                    borderRadius: 4,
                    fontWeight: 700,
                  }}>
                    {modelType === 'SUIT' ? 'xEMU 10Hz' : 'SENTRY 60Hz'}
                  </span>
                </div>

                {/* 2x2 Sensor Metric Tiles: EVA Suit Mode */}
                {modelType === 'SUIT' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
                    {selectedHotspot === 'VISOR' ? (
                      <>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>HELMET CO₂</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isScrubberFault ? '#fbbf24' : '#ffffff' }}>{ppCo2} mmHg</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>UV/IR FILTER</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>100% SHIELD</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>SUN TINT</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24' }}>94% ACTIVE</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>ANTI-FOG</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>HEATED NOM</div>
                        </div>
                      </>
                    ) : selectedHotspot === 'DCM' ? (
                      <>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>SUIT PRESSURE</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isDecomp ? '#f87171' : '#38bdf8' }}>{suitPressurePsi.toFixed(2)} psi</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>METRIC PRESS</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{suitPressureKpa} kPa</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>REGULATOR</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>AUTO CLOSED</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>PURGE VALVE</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>SEALED</div>
                        </div>
                      </>
                    ) : selectedHotspot === 'LCVG' ? (
                      <>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>LCVG INLET</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>{lcvgTemp.toFixed(1)} °C</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>LOOP FLOW</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>1.8 L/min</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>CORE TEMP</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: temp > 37.5 ? '#fbbf24' : '#34d399' }}>{(temp || 36.7).toFixed(1)} °C</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>SUBLIMATOR</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{sublimatorRate} L/h</div>
                        </div>
                      </>
                    ) : selectedHotspot === 'SAFER' ? (
                      <>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>GN₂ TANK</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#00e5a3' }}>{saferPressureMpa} MPa</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>THRUSTERS</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>24 ARMED</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>DELTA-V</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>{saferDeltaV}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>CONTROLLER</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>STOWED</div>
                        </div>
                      </>
                    ) : selectedHotspot === 'TMG' ? (
                      <>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>FABRIC LAYERS</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#c084fc' }}>14 LAYERS</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>PUNCTURE SENS</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>0 DETECTED</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>RAD ATTEN</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationActive ? '#fbbf24' : '#ffffff' }}>{(radFlux || 0.04).toFixed(2)} mSv/h</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>EXT TEMP</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>-48°C / +62°C</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>PRIMARY O₂</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isDecomp ? '#f87171' : '#00e5ff' }}>{o2Reserve}% ({o2TteHours}h {o2TteRemMins}m)</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>O₂ PRESSURE</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{o2TankPressureMpa} MPa</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>CO₂ SCRUBBER</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isScrubberFault ? '#fbbf24' : '#34d399' }}>{co2ScrubberState}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>BATTERY BUS</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{batteryPct}% ({batteryVolts}V)</div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* 2x2 Sensor Metric Tiles: Physiological Anatomy Mode */
                  <>
                    {selectedHotspot === 'CARDIAC' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>QTc INTERVAL</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{qtc} ms</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>AUTONOMIC ARF</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>{arf.toFixed(2)}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>VISCOSITY TRM</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>{trm.toFixed(2)}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>RHYTHM</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>Sinus NSR</div>
                        </div>
                      </div>
                    )}

                    {selectedHotspot === 'OCULAR' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>ONSD SHEATH</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isOcularAlert ? '#f87171' : '#38bdf8' }}>{isOcularAlert ? '6.8 mm' : '5.2 mm'}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>ICP PRESSURE</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>11.2 mmHg</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>RETINAL MICRO</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>0 Lesions</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>OPTIC MARGIN</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>Frisén Gr.0</div>
                        </div>
                      </div>
                    )}

                    {selectedHotspot === 'RENAL' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>SERUM K⁺</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8' }}>{k.toFixed(2)} mmol/L</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>URINE OSM</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>450 mOsm/kg</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>CORTICAL GFR</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399' }}>116 mL/min</div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>FLUID BALANCE</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#ffffff' }}>+120 mL / 24h</div>
                        </div>
                      </div>
                    )}

                    {selectedHotspot === 'SKELETAL' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6 }}>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'RAD FLUX' : 'BMD INDEX'}</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationCritical ? '#ef4444' : isRadiationActive ? '#f59e0b' : isSkeletalAlert ? '#f87171' : '#38bdf8' }}>
                            {isRadiationActive ? `${radFlux.toFixed(1)} mGy/h` : `${bmd.toFixed(1)}%`}
                          </div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'MARROW RSI' : 'RESORPTION'}</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationActive ? '#ef4444' : '#ffffff' }}>
                            {isRadiationActive ? '1.25 CRIT' : '0.02% / wk'}
                          </div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'ABSORBED DOSE' : 'ARED TARGET'}</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationActive ? '#f59e0b' : '#34d399' }}>
                            {isRadiationActive ? `${(radDose || 0.75).toFixed(2)} Gy` : '150 kN'}
                          </div>
                        </div>
                        <div style={{ background: 'linear-gradient(180deg, rgba(24, 39, 64, 0.92) 0%, rgba(18, 29, 48, 0.96) 100%)', padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(148, 163, 184, 0.11)' }}>
                          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>{isRadiationActive ? 'LYMPHOCYTES' : 'AXIAL SPINAL'}</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: isRadiationActive ? '#ef4444' : '#ffffff' }}>
                            {isRadiationActive ? `${telemetry?.lymphocyte_count ?? 0.85} (LOW)` : '+1.8 cm'}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Micro Live Wave Sparkline */}
                <div style={{
                  height: 20,
                  width: '100%',
                  background: '#050a14',
                  border: '1px solid rgba(148, 163, 184, 0.10)',
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
                    {modelType === 'SUIT' && (
                      <polyline
                        fill="none"
                        stroke="#00e5ff"
                        strokeWidth="1.4"
                        points="0,8 15,6 30,4 45,3 60,3 75,5 90,8 105,11 120,13 135,13 150,11 165,8 180,6 195,4 210,3 225,5 240,8 255,11 270,12 280,8"
                      />
                    )}
                    {modelType !== 'SUIT' && selectedHotspot === 'CARDIAC' && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.4"
                        points="0,8 20,8 25,7 30,8 38,8 42,2 46,14 50,8 58,8 64,6 72,8 90,8 110,8 115,7 120,8 128,8 132,2 136,14 140,8 148,8 154,6 162,8 180,8 200,8 205,7 210,8 218,8 222,2 226,14 230,8 238,8 244,6 252,8 280,8"
                      />
                    )}
                    {modelType !== 'SUIT' && selectedHotspot === 'OCULAR' && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.4"
                        points="0,8 25,5 50,8 75,11 100,7 125,5 150,9 175,8 200,6 225,8 250,11 275,7 280,8"
                      />
                    )}
                    {modelType !== 'SUIT' && selectedHotspot === 'RENAL' && (
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.4"
                        points="0,9 35,7 70,9 105,6 140,8 175,10 210,8 245,7 280,9"
                      />
                    )}
                    {modelType !== 'SUIT' && selectedHotspot === 'SKELETAL' && (
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
          );
        })()}
      </div>
    </div>
  );
};
