import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { audioService } from '../services/audioService';

interface ScenarioControllerProps {
  currentScenario: string;
  marsDelay: boolean;
  onToggleMarsDelay: (enabled: boolean) => void;
  onScenarioTriggered?: (scenarioKey: string, telemetry?: Record<string, any>) => void;
}

export type MissionCohort = 'ALL' | 'ARTEMIS_I' | 'ARTEMIS_II';

interface ScenarioMeta {
  key: string;
  label: string;
  badge: string;
  category: 'ENVIRONMENT' | 'CARDIO' | 'IMMUNE' | 'METABOLIC';
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  physiologicalShift?: string;
  artemisCohort: 'ARTEMIS_I' | 'ARTEMIS_II';
  nasaCitation: string;
}

interface TooltipData {
  key: string;
  label: string;
  badge: string;
  category: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  physiologicalShift?: string;
  artemisCohort?: 'ARTEMIS_I' | 'ARTEMIS_II';
  nasaCitation?: string;
  x: number;
  y: number;
  caretOffset: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

interface CrewProfile {
  id: string;
  name: string;
  shortName: string;
  role: string;
  callsign: string;
  age: number;
  baseline: {
    hr: number;
    hrv: number;
    spo2: number;
    temp: number;
  };
}

const CREW_PROFILES: CrewProfile[] = [
  {
    id: 'AST-01_COMMANDER',
    name: 'Commander Haley',
    shortName: 'Commander',
    role: 'Mission Commander',
    callsign: 'C001',
    age: 38,
    baseline: { hr: 62.0, hrv: 65.0, spo2: 98.2, temp: 36.8 },
  },
  {
    id: 'AST-02_PILOT',
    name: 'Pilot Chris',
    shortName: 'Pilot',
    role: 'Spacecraft Pilot',
    callsign: 'C002',
    age: 42,
    baseline: { hr: 58.0, hrv: 72.0, spo2: 98.5, temp: 36.7 },
  },
  {
    id: 'AST-03_MEDICAL',
    name: 'Doctor Sian',
    shortName: 'Medical Officer',
    role: 'Chief Medical Officer',
    callsign: 'C003',
    age: 29,
    baseline: { hr: 66.0, hrv: 58.0, spo2: 98.0, temp: 36.9 },
  },
  {
    id: 'AST-04_ENGINEER',
    name: 'Specialist Leo',
    shortName: 'Flight Engineer',
    role: 'Systems Flight Engineer',
    callsign: 'C004',
    age: 34,
    baseline: { hr: 64.0, hrv: 62.0, spo2: 98.3, temp: 36.8 },
  },
];
// ── Universal Spacecraft-Wide Scenarios (Scenarios 1-5) ──
const UNIVERSAL_SCENARIOS: ScenarioMeta[] = [
  {
    key: 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH',
    label: '01 · Carbon Dioxide Scrubber Failure',
    badge: 'CO₂: 4.25 mmHg · Air Warning',
    category: 'ENVIRONMENT',
    description: 'Orion air scrubber valve circuit failed, causing carbon dioxide to build up in the cabin. Astronauts put on emergency breathing masks and switch to backup lithium hydroxide filters.',
    severity: 'WARNING',
    physiologicalShift: 'Elevated carbon dioxide triggers mild blood acidification (respiratory acidosis), blood oxygen dips to 96.2%, and heart rate speeds to 82 bpm to compensate.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Inspection Report IG-24-011: Orion life-support air scrubber motor valve circuit failure.',
  },
  {
    key: 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA',
    label: '02 · Cabin Air Leak & Decompression',
    badge: 'SpO₂: 88.5% · Cabin 88.0 kPa',
    category: 'ENVIRONMENT',
    description: 'Heat shield thermal damage caused a cabin pressure seal leak, dropping air pressure to 88.0 kPa. Astronauts put on pressurized oxygen masks and seal pressure hatches.',
    severity: 'CRITICAL',
    physiologicalShift: 'Low air pressure starves the blood of oxygen (hypoxia dips SpO₂ to 88.5%), pulse races to 118 bpm, and body stress reserves drop sharply.',
    artemisCohort: 'ARTEMIS_I',
    nasaCitation: 'NASA Artemis I Post-Flight Report: Avcoat heat shield loss across >100 locations from trapped gas pressure.',
  },
  {
    key: 'SCENARIO_3_SOLAR_RADIATION_STORM',
    label: '03 · Deep-Space Solar Radiation Storm',
    badge: 'Radiation: 85 mGy/h · Dose 0.75 Gy',
    category: 'ENVIRONMENT',
    description: 'Orion flies through a powerful solar proton storm. Cabin sensors detect 85 mGy/h of cosmic radiation. Astronauts immediately take shelter behind protective water-storage walls.',
    severity: 'CRITICAL',
    physiologicalShift: 'Cosmic rays rapidly deplete protective white blood cells (lymphocytes drop to 0.85k), pushing the Radiation Sickness Index (RSI) to 1.25.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Exploration Medical Capability (ExMC) & Artemis Deep-Space Radiation Flight Rules.',
  },
  {
    key: 'SCENARIO_4_AMMONIA_COOLANT_LEAK',
    label: '04 · Toxic Cooling System Vapor Leak',
    badge: 'SpO₂: 89.5% · Chemical Fumes',
    category: 'ENVIRONMENT',
    description: 'The external thermal cooling loop cracked, leaking toxic coolant vapor into the breathing cabin. Astronauts isolate ventilation ducts and don emergency breathing apparatus.',
    severity: 'CRITICAL',
    physiologicalShift: 'Inhaling toxic fumes irritates lung airways (chemical pneumonitis), dropping blood oxygen to 89.5%, accelerating pulse to 132 bpm, and triggering body inflammation.',
    artemisCohort: 'ARTEMIS_I',
    nasaCitation: 'Orion Active Thermal Control System: Cabin Coolant Ingress Hazard Mitigation Protocol.',
  },
  {
    key: 'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER',
    label: '05 · Electrical Wiring Smoke & Overheat',
    badge: 'Avionics Bay · Smoke Irritation',
    category: 'ENVIRONMENT',
    description: 'Cosmic radiation tripped electrical power breakers in the Service Module, causing wiring insulation in the equipment bay to overheat and release smoke into the cabin.',
    severity: 'WARNING',
    physiologicalShift: 'Fine airborne smoke particles irritate respiratory airways, lowering blood oxygen to 93.5%, raising heart rate to 108 bpm, and elevating blood inflammation markers.',
    artemisCohort: 'ARTEMIS_I',
    nasaCitation: 'NASA Artemis I Flight Day 19 Anomaly: Power Distribution Unit uncommanded electrical switch trips.',
  },
];

// ── Individual Crew Scenarios (Scenarios 6-18: Artemis II Crewed Hazards) ──
const INDIVIDUAL_SCENARIOS: ScenarioMeta[] = [
  // Cardiovascular & Electrophysiology
  {
    key: 'SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA',
    label: '06 · Space Motion Sickness & Low Potassium',
    badge: 'Potassium: 2.95 mmol/L · Heart Alert',
    category: 'CARDIO',
    description: 'Zero-gravity disorients the inner ear, triggering severe space adaptation sickness and repeated vomiting. This rapidly flushes vital potassium electrolytes from the body.',
    severity: 'WARNING',
    physiologicalShift: 'Critically low potassium (2.95 mmol/L) disrupts cardiac electrical timing, dangerously prolonging heart muscle recharge (QTc widens to 492 ms) with flutter risk.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Human Research Program: Space motion sickness and acute electrolyte depletion in the first 48 hours.',
  },
  {
    key: 'SCENARIO_7_VENOUS_THROMBOSIS_RISK',
    label: '07 · Neck Vein Stagnation & Blood Clot Risk',
    badge: 'Blood Thickness 52.5% · Clot Risk: 2.35',
    category: 'CARDIO',
    description: 'Without gravity pulling blood toward the feet, fluid pools in the head and neck. Blood flow in the internal jugular neck vein stops moving, creating acute risk of a blood clot.',
    severity: 'WARNING',
    physiologicalShift: 'Blood plasma loss concentrates red cells (Hematocrit 52.5%) and clotting platelets surge (385k), raising Thrombosis Clot Risk Index to a dangerous 2.35.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA ISS Flight Findings: Microgravity jugular vein blood flow stagnation and ultrasound clot monitoring.',
  },
  {
    key: 'SCENARIO_8_CARDIOVASCULAR_DECONDITIONING',
    label: '08 · High-G Re-Entry Gravity Blackout Strain',
    badge: 'Heart Rate: 98 bpm · Stress Alert',
    category: 'CARDIO',
    description: 'Returning to Earth at Mach 32, the capsule pulls an intense 8G deceleration force. After days in zero-G, relaxed blood vessels allow blood to drain away from the brain into the legs.',
    severity: 'WARNING',
    physiologicalShift: 'Resting heart rate spikes to 98 bpm to force blood to the brain, heart rate variability collapses (HRV to 18 ms), and blood vessels struggle to maintain pressure.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA-STD-3001: High-G lunar re-entry deceleration and post-landing fainting tolerance standards.',
  },
  {
    key: 'SCENARIO_9_CORONARY_MICROVASCULAR_STRESS',
    label: '09 · Deep-Space Blood Vessel Stress',
    badge: 'Vascular Inflammation: 6.8 · QTc 458ms',
    category: 'CARDIO',
    description: 'High mission cognitive workload combined with deep-space cosmic radiation irritates the delicate inner lining of heart blood vessels. Astronaut takes aspirin and rests.',
    severity: 'WARNING',
    physiologicalShift: 'Radiation oxidative stress inflames blood vessel walls, raising inflammatory markers (CRP to 6.8 mg/L) and delaying cardiac electrical recharge (QTc to 458 ms).',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Spaceflight Cardiovascular Health: Blood vessel oxidative stress under deep-space cosmic radiation.',
  },

  // Infection & Immune System
  {
    key: 'SCENARIO_10_PRESYMPTOMATIC_SEPSIS',
    label: '10 · Early Silent Bacterial Blood Infection',
    badge: 'Immune Spike: 125 pg/mL · Sepsis Alert',
    category: 'IMMUNE',
    description: 'Microgravity weakens body immune barriers, allowing bacteria to enter the bloodstream. The body sounds an immune chemical alarm hours before any physical fever appears.',
    severity: 'CRITICAL',
    physiologicalShift: 'Immune alarm proteins surge (IL-6 jumps to 125 pg/mL) and white blood cells climb (14.5k), warning of severe bloodstream infection hours before fever develops.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Space Omics SOMA Dataset: Early subclinical immune cytokine dysregulation in spaceflight.',
  },
  {
    key: 'SCENARIO_11_LATENT_VIRUS_REACTIVATION',
    label: '11 · Dormant Virus Reactivation',
    badge: 'Immune Marker: 22 pg/mL · White Cells 1.4k',
    category: 'IMMUNE',
    description: 'Spaceflight stress hormones and radiation suppress immune defenses, allowing dormant childhood viruses (like chickenpox/herpes) to wake up and multiply in the body.',
    severity: 'WARNING',
    physiologicalShift: 'Protective immune defense cells drop (lymphocytes down to 1.4k) and inflammatory signals rise (IL-6 to 22 pg/mL); astronaut begins oral antiviral medication.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Human Research Program: Latent herpesvirus reactivation and T-cell fatigue during long-duration flight.',
  },
  {
    key: 'SCENARIO_12_CYTOKINE_RELEASE_STORM',
    label: '12 · Runaway Immune Cytokine Storm',
    badge: 'Immune Surge: 195 pg/mL · Fever: 38.9°C',
    category: 'IMMUNE',
    description: 'The astronaut immune system goes into overdrive, releasing a massive wave of inflammatory chemicals that attack the body own healthy organs. Requires emergency steroid medication.',
    severity: 'CRITICAL',
    physiologicalShift: 'Massive inflammatory surge (IL-6 reaches 195 pg/mL), white blood cells spike to 16.8k, fever reaches 38.9°C, and pulse accelerates to 126 bpm.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Space Immunology: Hyper-inflammatory cytokine storm cascades triggered by microgravity and radiation.',
  },
  {
    key: 'SCENARIO_13_RADIATION_MARROW_EXHAUSTION',
    label: '13 · Bone Marrow Radiation Suppression',
    badge: 'White Cells: 0.52k · Radiation: 0.95 Gy',
    category: 'IMMUNE',
    description: 'Heavy cosmic rays penetrate deep into bone marrow, damaging the body factory that creates blood cells. The astronaut immune defenses drop to dangerous lows.',
    severity: 'WARNING',
    physiologicalShift: 'Protective white blood cells drop dangerously low (lymphocytes down to 0.52k, total white cells to 2.4k), raising Radiation Sickness Index (RSI) to 1.45.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'Andrews Space Radiation Model: Bone marrow damage and white blood cell loss from cosmic radiation.',
  },

  // Metabolic, SANS & Fluids
  {
    key: 'SCENARIO_14_NEPHROLITHIASIS',
    label: '14 · Microgravity Kidney Stone Attack',
    badge: 'Pain Pulse: 88 bpm · Calcium High',
    category: 'METABOLIC',
    description: 'In zero-gravity, bones rapidly shed calcium into the bloodstream. This excess calcium filters into the kidneys and crystallizes into a painful kidney stone.',
    severity: 'WARNING',
    physiologicalShift: 'Sharp kidney pain triggers a nervous system stress response (pulse rises to 88 bpm, stress reserves drop); astronaut hydrates heavily with potassium citrate.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Clinical Practice Guidelines: Microgravity bone calcium loss and kidney stone prevention.',
  },
  {
    key: 'SCENARIO_15_INTRAVASCULAR_DEHYDRATION',
    label: '15 · Dehydration & Blood Plasma Loss',
    badge: 'Thick Blood: 52.0% · Clot Risk: 1.95',
    category: 'METABOLIC',
    description: 'Because fluids shift toward the head in zero-G, the brain mistakenly senses excess water and turns off thirst. The astronaut body becomes severely dehydrated.',
    severity: 'WARNING',
    physiologicalShift: 'Loss of water shrinks blood volume and thickens blood (Hematocrit climbs to 52.0%), forcing the heart to beat faster (92 bpm) to pump viscous blood.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Space Physiology: Fluid shifts, thirst suppression, and blood volume contraction in weightlessness.',
  },
  {
    key: 'SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION',
    label: '16 · Slowed Liver Medicine Breakdown',
    badge: 'Liver Metabolism: -35% · Dose Warning',
    category: 'METABOLIC',
    description: 'Microgravity and cosmic radiation slow down the liver primary drug-clearing enzymes. Medications stay in the body 35% longer, creating risk of accidental drug overdose.',
    severity: 'WARNING',
    physiologicalShift: 'Liver drug breakdown slows by ~35%, extending medication lifetime in the bloodstream; medical officer must space medication doses further apart.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Space Pharmacology: Altered liver drug processing and metabolism on lunar and deep-space missions.',
  },
  {
    key: 'SCENARIO_17_SPACE_VISION_SANS',
    label: '17 · Space Vision Syndrome & Head Pressure',
    badge: 'Optic Nerve Swelling · Head Pressure High',
    category: 'METABOLIC',
    description: 'Weightlessness causes fluids to pool continuously in the head. The resulting high pressure behind the eyes squashes the optic nerve and blurs astronaut vision (SANS).',
    severity: 'WARNING',
    physiologicalShift: 'Fluid pressure swells the optic nerve sheath behind the eye and increases skull pressure; astronaut uses negative-pressure leg suction to pull fluids down.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Human Research Program: Spaceflight-Associated Neuro-ocular Syndrome (SANS) visual impairment.',
  },
  {
    key: 'SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT',
    label: '18 · Lunar Orbit Sleep Loss & Exhaustion',
    badge: 'Sleep Score: 42/100 · Heart Rate: +14 bpm',
    category: 'METABOLIC',
    description: 'High-stress maneuvering near the Moon and constant spacecraft lighting disrupt the astronaut circadian sleep clock, causing chronic fatigue and cognitive exhaustion.',
    severity: 'WARNING',
    physiologicalShift: 'Sleep quality drops to 42/100, resting baseline pulse rises by +14 bpm, and autonomic nervous system recovery collapses.',
    artemisCohort: 'ARTEMIS_II',
    nasaCitation: 'NASA Behavioral Health: Circadian rhythm disruption, sleep deprivation, and cardiac fatigue in lunar orbit.',
  },
];

const ALL_SCENARIOS = [...UNIVERSAL_SCENARIOS, ...INDIVIDUAL_SCENARIOS];

type ScopeTab = 'UNIVERSAL' | 'INDIVIDUAL';
type ClinicalCategory = 'ALL' | 'CARDIO' | 'IMMUNE' | 'METABOLIC';

export const ScenarioController: React.FC<ScenarioControllerProps> = ({
  currentScenario,
  marsDelay,
  onToggleMarsDelay,
  onScenarioTriggered,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [scopeTab, setScopeTab] = useState<ScopeTab>('UNIVERSAL');
  const [selectedCrewId, setSelectedCrewId] = useState<string>('AST-01_COMMANDER');
  const [activeTargetCrewId, setActiveTargetCrewId] = useState<string | null>(null);
  const [clinicalCategory, setClinicalCategory] = useState<ClinicalCategory>('ALL');
  const [triggeringKey, setTriggeringKey] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<TooltipData | null>(null);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);

  const scrollBodyRef = useRef<HTMLDivElement>(null);

  // Subscribe to JARVIS transmission state to slide button up/down
  useEffect(() => {
    const unsub = audioService.onStateChange((state) => {
      setIsTransmitting(state.isTransmitting);
    });
    // Set initial state
    setIsTransmitting(audioService.isTransmitting());
    return unsub;
  }, []);

  // Auto-reset scroll position when switching tabs, categories, or crew members
  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [scopeTab, clinicalCategory, selectedCrewId]);

  // Keyboard shortcut listener: [S] to toggle modal, [Escape] to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setActiveTooltip(null);
      } else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => {
          if (prev) setActiveTooltip(null);
          return !prev;
        });
      }
    };

    const handleDismissTooltip = () => {
      setActiveTooltip(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleDismissTooltip);
    window.addEventListener('scroll', handleDismissTooltip, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleDismissTooltip);
      window.removeEventListener('scroll', handleDismissTooltip, true);
    };
  }, [isOpen]);

  const handleCardMouseEnter = (e: React.MouseEvent<HTMLElement>, sc: ScenarioMeta) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height / 2;

    const TOOLTIP_WIDTH = 340;
    const TOOLTIP_ESTIMATED_HEIGHT = 310;
    const VIEWPORT_PADDING = 14;

    // Available space in all 4 cardinal directions from the card
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
    const spaceLeft = rect.left - VIEWPORT_PADDING;
    const spaceRight = window.innerWidth - rect.right - VIEWPORT_PADDING;

    const fitsTop = spaceAbove >= TOOLTIP_ESTIMATED_HEIGHT;
    const fitsBottom = spaceBelow >= TOOLTIP_ESTIMATED_HEIGHT;
    const fitsLeft = spaceLeft >= TOOLTIP_WIDTH;
    const fitsRight = spaceRight >= TOOLTIP_WIDTH;

    let placement: 'top' | 'bottom' | 'left' | 'right';

    // 4-Way dynamic placement logic:
    // If both top and bottom fit without touching header/screen edges, pick whichever has more room
    if (fitsTop && fitsBottom) {
      placement = spaceAbove >= spaceBelow ? 'top' : 'bottom';
    } else if (fitsTop) {
      placement = 'top';
    } else if (fitsBottom) {
      placement = 'bottom';
    } else {
      // Both top and bottom touch or cross the screen limits!
      // Dynamically place LEFT or RIGHT
      if (fitsRight && fitsLeft) {
        placement = spaceRight >= spaceLeft ? 'right' : 'left';
      } else if (fitsRight) {
        placement = 'right';
      } else if (fitsLeft) {
        placement = 'left';
      } else {
        // Fallback for compact viewports: pick orientation with maximum available clearance
        const maxHoriz = Math.max(spaceLeft, spaceRight);
        const maxVert = Math.max(spaceAbove, spaceBelow);
        if (maxHoriz >= maxVert) {
          placement = spaceRight >= spaceLeft ? 'right' : 'left';
        } else {
          placement = spaceBelow >= spaceAbove ? 'bottom' : 'top';
        }
      }
    }

    let x = 0;
    let y = 0;
    let caretOffset = 0;

    if (placement === 'top' || placement === 'bottom') {
      const halfWidth = TOOLTIP_WIDTH / 2;
      const minX = halfWidth + VIEWPORT_PADDING;
      const maxX = window.innerWidth - halfWidth - VIEWPORT_PADDING;
      const clampedX = Math.max(minX, Math.min(maxX, cardCenterX));

      const rawOffset = cardCenterX - clampedX;
      const maxCaretOffset = halfWidth - 24;
      caretOffset = Math.max(-maxCaretOffset, Math.min(maxCaretOffset, rawOffset));
      x = clampedX;

      if (placement === 'top') {
        y = Math.max(TOOLTIP_ESTIMATED_HEIGHT + VIEWPORT_PADDING, rect.top - 8);
      } else {
        y = Math.min(window.innerHeight - VIEWPORT_PADDING - TOOLTIP_ESTIMATED_HEIGHT, rect.bottom + 8);
      }
    } else {
      // placement === 'left' or 'right'
      const halfHeight = TOOLTIP_ESTIMATED_HEIGHT / 2;
      const minY = halfHeight + VIEWPORT_PADDING;
      const maxY = window.innerHeight - halfHeight - VIEWPORT_PADDING;
      const clampedY = Math.max(minY, Math.min(maxY, cardCenterY));

      const rawCaretY = cardCenterY - clampedY;
      const maxCaretY = halfHeight - 24;
      caretOffset = Math.max(-maxCaretY, Math.min(maxCaretY, rawCaretY));
      y = clampedY;

      if (placement === 'left') {
        x = Math.max(TOOLTIP_WIDTH + VIEWPORT_PADDING, rect.left - 8);
      } else {
        x = Math.min(window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING, rect.right + 8);
      }
    }

    setActiveTooltip({
      key: sc.key,
      label: sc.label,
      badge: sc.badge,
      category: sc.category,
      description: sc.description,
      severity: sc.severity,
      physiologicalShift: sc.physiologicalShift,
      artemisCohort: sc.artemisCohort,
      nasaCitation: sc.nasaCitation,
      x,
      y,
      caretOffset,
      placement,
    });
  };

  const handleCardMouseLeave = () => {
    setActiveTooltip(null);
  };

  const handleTrigger = async (key: string, targetCrewId?: string) => {
    setTriggeringKey(key);
    audioService.stopSpeaking();

    const isUniversal = [
      'NOMINAL_CRUISE',
      'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH',
      'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA',
      'SCENARIO_3_SOLAR_RADIATION_STORM',
      'SCENARIO_4_AMMONIA_COOLANT_LEAK',
      'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER',
    ].includes(key);

    const effectiveTarget = isUniversal ? null : (targetCrewId || selectedCrewId || 'AST-01_COMMANDER');
    setActiveTargetCrewId(effectiveTarget);

    try {
      if (key === 'SCENARIO_4_DEEP_SPACE_BLACKOUT') {
        onToggleMarsDelay(true);
      } else if (key === 'NOMINAL_CRUISE' && marsDelay) {
        onToggleMarsDelay(false);
      }

      const queryUrl = effectiveTarget
        ? `/api/scenario/${key}?astronaut_id=${effectiveTarget}`
        : `/api/scenario/${key}`;

      const res = await fetch(queryUrl, { method: 'POST' });
      let telData: Record<string, any> | undefined;
      if (res.ok) {
        const data = await res.json().catch(() => null);
        telData = data?.telemetry;
      }
      if (onScenarioTriggered) {
        onScenarioTriggered(key, telData);
      }
    } catch {
      // Offline fallback: notify scenario trigger
      if (onScenarioTriggered) {
        onScenarioTriggered(key);
      }
    } finally {
      setTimeout(() => setTriggeringKey(null), 300);
    }
  };

  const activeScenarioMeta =
    ALL_SCENARIOS.find(
      (s) =>
        s.key === currentScenario ||
        (s.key === 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH' && currentScenario === 'SCENARIO_3_CO2_HYPOXIA') ||
        (s.key === 'SCENARIO_3_SOLAR_RADIATION_STORM' && currentScenario === 'SCENARIO_8_SOLAR_RADIATION_STORM') ||
        (s.key === 'SCENARIO_10_PRESYMPTOMATIC_SEPSIS' && currentScenario === 'SCENARIO_5_PRESYMPTOMATIC_SEPSIS') ||
        (s.key === 'SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT' && currentScenario === 'SCENARIO_1_BASELINE_DRIFT')
    ) || {
      key: 'NOMINAL_CRUISE',
      label: 'Nominal Flight Cruise',
      badge: 'Stable Baseline',
      category: 'ENVIRONMENT' as const,
      description: 'All astronaut vitals are within safe baseline ranges. Spacecraft autonomous life-support systems are operating nominally.',
      severity: 'NOMINAL' as const,
      physiologicalShift: 'Normal resting heart rate, oxygen levels, and metabolic balance across all crew members.',
      artemisCohort: 'ARTEMIS_II' as const,
      nasaCitation: 'NASA-STD-3001: Human Spaceflight Baseline Health Standards for nominal cruise.',
    };

  const isNominalActive = currentScenario === 'NOMINAL_CRUISE';
  const isUniversalActive = UNIVERSAL_SCENARIOS.some((s) => s.key === activeScenarioMeta.key) || isNominalActive;

  const activeSeverity = isNominalActive ? 'NOMINAL' : activeScenarioMeta.severity;
  const activeThemeColor =
    activeSeverity === 'CRITICAL'
      ? '#f43f5e'
      : activeSeverity === 'WARNING'
        ? '#f59e0b'
        : 'var(--hud-nominal)';

  const activeTargetProfile = activeTargetCrewId ? CREW_PROFILES.find((c) => c.id === activeTargetCrewId) : null;

  const visibleUniversalScenarios = UNIVERSAL_SCENARIOS;

  const filteredIndividualScenarios = INDIVIDUAL_SCENARIOS.filter(
    (s) => clinicalCategory === 'ALL' || s.category === clinicalCategory
  );

  const shortScenarioLabel = isNominalActive
    ? 'NOMINAL'
    : (activeScenarioMeta.label.includes('·')
        ? activeScenarioMeta.label.split('·')[1].trim()
        : activeScenarioMeta.label);

  return (
    <>
      {/* ── Fixed Floating Action Trigger Pill (Bottom-Right) ── */}
      <button
        id="scenario-floating-trigger"
        onClick={() => setIsOpen(true)}
        aria-label="Open Scenarios Engine"
        title={isNominalActive ? "Simulation Scenarios · NOMINAL CRUISE (Hotkey: S)" : `Simulation Scenarios · ${activeScenarioMeta.label} (${activeSeverity}) · Hotkey: S`}
        style={{
          position: 'fixed',
          bottom: isTransmitting ? '72px' : '18px',
          right: '20px',
          zIndex: 9990,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '4px 8px 4px 9px',
          height: '28px',
          background: 'rgba(8, 14, 23, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isNominalActive
            ? '1px solid rgba(16, 185, 129, 0.35)'
            : activeSeverity === 'CRITICAL'
              ? '1px solid rgba(244, 63, 94, 0.65)'
              : '1px solid rgba(245, 158, 11, 0.65)',
          borderRadius: '9999px',
          color: '#ffffff',
          cursor: 'pointer',
          boxShadow: isNominalActive
            ? '0 4px 14px rgba(0, 0, 0, 0.45), 0 0 10px rgba(16, 185, 129, 0.12)'
            : activeSeverity === 'CRITICAL'
              ? '0 4px 14px rgba(0, 0, 0, 0.45), 0 0 14px rgba(244, 63, 94, 0.32)'
              : '0 4px 14px rgba(0, 0, 0, 0.45), 0 0 12px rgba(245, 158, 11, 0.28)',
          transition: 'all var(--hud-transition-fast), bottom 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: "'Tomorrow', sans-serif",
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
          e.currentTarget.style.borderColor = activeThemeColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = isNominalActive
            ? 'rgba(16, 185, 129, 0.35)'
            : activeSeverity === 'CRITICAL'
              ? 'rgba(244, 63, 94, 0.65)'
              : 'rgba(245, 158, 11, 0.65)';
        }}
      >
        {/* Pulsing Status Beacon */}
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: activeThemeColor,
            boxShadow: `0 0 6px ${activeThemeColor}`,
            flexShrink: 0,
            animation: !isNominalActive ? 'beaconDotPulse 1.2s ease-in-out infinite' : 'none',
          }}
        />

        {/* Title */}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#e2e8f0',
            lineHeight: 1,
          }}
        >
          SCENARIOS
        </span>

        {/* Status Badge */}
        <span
          style={{
            fontSize: '8px',
            fontWeight: 700,
            padding: '1.5px 5.5px',
            borderRadius: '999px',
            background: isNominalActive
              ? 'rgba(16, 185, 129, 0.14)'
              : activeSeverity === 'CRITICAL'
                ? 'rgba(244, 63, 94, 0.18)'
                : 'rgba(245, 158, 11, 0.18)',
            color: isNominalActive
              ? 'var(--hud-nominal)'
              : activeSeverity === 'CRITICAL'
                ? '#f43f5e'
                : '#fbbf24',
            border: isNominalActive
              ? '1px solid rgba(16, 185, 129, 0.35)'
              : activeSeverity === 'CRITICAL'
                ? '1px solid rgba(244, 63, 94, 0.45)'
                : '1px solid rgba(245, 158, 11, 0.45)',
            letterSpacing: '0.04em',
            maxWidth: isNominalActive ? 'none' : '110px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}
        >
          {shortScenarioLabel}
        </span>

        {/* Keycap Shortcut Indicator */}
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            fontFamily: "'Share Tech Mono', monospace",
            padding: '1.5px 4.5px',
            borderRadius: '3px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: '#94a3b8',
            marginLeft: '1px',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}
        >
          S
        </span>
      </button>

      {/* ── Modal Dialog Overlay ── */}
      {isOpen && (
        <div
          id="scenario-modal-backdrop"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(4, 6, 10, 0.86)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            id="scenario-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '920px',
              maxHeight: '92vh',
              background: 'rgba(13, 16, 23, 0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--hud-radius-panel)',
              boxShadow: '0 25px 75px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            {/* Modal Top Header Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.02)',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Possible Scenarios
                </span>
                <span style={{ fontSize: '10px', fontWeight: 400, color: '#879ebfff', letterSpacing: '0.02em' }}>
                  Based on NASA spaceflight history &amp; ISS incident records
                </span>
              </div>
              

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Global Reset to Nominal Cruise */}
                <button
                  onClick={() => handleTrigger('NOMINAL_CRUISE')}
                  className="hud-btn"
                  title={isNominalActive ? 'All systems currently operating nominally' : 'Reset all systems and crew vitals back to nominal cruise'}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    background: isNominalActive ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                    color: isNominalActive ? '#4ade80' : '#e2e8f0',
                    border: isNominalActive ? '1px solid rgba(74, 222, 128, 0.30)' : '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: isNominalActive ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    if (!isNominalActive) {
                      e.currentTarget.style.background = 'rgba(34, 197, 94, 0.14)';
                      e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.45)';
                      e.currentTarget.style.color = '#4ade80';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isNominalActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                      e.currentTarget.style.color = '#e2e8f0';
                    }
                  }}
                >
                  {isNominalActive ? (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#4ade80',
                        boxShadow: '0 0 6px rgba(74, 222, 128, 0.6)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, opacity: 0.9 }}
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  )}
                  <span>{isNominalActive ? 'All Nominal' : 'Reset to Nominal'}</span>
                </button>

                {/* Modal Close Button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setActiveTooltip(null);
                  }}
                  aria-label="Close Possible Scenarios Modal"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 'var(--hud-radius-btn)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ── Top Level Scope Switcher: Universal vs Individual ── */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.55)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '6px 20px 0',
                gap: '8px',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <button
                onClick={() => setScopeTab('UNIVERSAL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  paddingBottom: scopeTab === 'UNIVERSAL' ? '11px' : '10px',
                  marginBottom: scopeTab === 'UNIVERSAL' ? '-1px' : '0',
                  fontSize: '12px',
                  fontWeight: scopeTab === 'UNIVERSAL' ? 600 : 500,
                  color: scopeTab === 'UNIVERSAL' ? '#ffffff' : '#64748b',
                  background: scopeTab === 'UNIVERSAL' ? 'rgba(26, 35, 52, 0.98)' : 'transparent',
                  border: 'none',
                  borderBottom: scopeTab === 'UNIVERSAL' ? '1px solid rgba(26, 35, 52, 0.98)' : 'none',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  fontFamily: "'Tomorrow', sans-serif",
                  letterSpacing: '0.03em',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  zIndex: scopeTab === 'UNIVERSAL' ? 3 : 1,
                }}
                onMouseEnter={(e) => {
                  if (scopeTab !== 'UNIVERSAL') {
                    e.currentTarget.style.color = '#cbd5e1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (scopeTab !== 'UNIVERSAL') {
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <span>UNIVERSAL</span>
              </button>

              <button
                onClick={() => setScopeTab('INDIVIDUAL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  paddingBottom: scopeTab === 'INDIVIDUAL' ? '11px' : '10px',
                  marginBottom: scopeTab === 'INDIVIDUAL' ? '-1px' : '0',
                  fontSize: '12px',
                  fontWeight: scopeTab === 'INDIVIDUAL' ? 600 : 500,
                  color: scopeTab === 'INDIVIDUAL' ? '#ffffff' : '#64748b',
                  background: scopeTab === 'INDIVIDUAL' ? 'rgba(26, 35, 52, 0.98)' : 'transparent',
                  border: 'none',
                  borderBottom: scopeTab === 'INDIVIDUAL' ? '1px solid rgba(26, 35, 52, 0.98)' : 'none',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  fontFamily: "'Tomorrow', sans-serif",
                  letterSpacing: '0.03em',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  zIndex: scopeTab === 'INDIVIDUAL' ? 3 : 1,
                }}
                onMouseEnter={(e) => {
                  if (scopeTab !== 'INDIVIDUAL') {
                    e.currentTarget.style.color = '#cbd5e1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (scopeTab !== 'INDIVIDUAL') {
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <span>INDIVIDUAL</span>
              </button>
            </div>

            {/* ── Pinned Subheader for Individual View: Crew Selector & Clinical Category Tabs ── */}
            {scopeTab === 'INDIVIDUAL' && (
              <div
                style={{
                  padding: '12px 20px 10px',
                  background: 'rgba(26, 35, 52, 0.98)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flexShrink: 0,
                  zIndex: 2,
                }}
              >
                {/* Crew Selector Deck */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>
                      TARGET CREW MEMBER
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                    }}
                  >
                    {CREW_PROFILES.map((crew) => {
                      const isSelected = selectedCrewId === crew.id;
                      return (
                        <button
                          key={crew.id}
                          onClick={() => setSelectedCrewId(crew.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '9px',
                            padding: '8px 12px',
                            borderRadius: '7px',
                            background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'rgba(11, 15, 25, 0.92)',
                            border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.11)',
                            color: isSelected ? '#ffffff' : '#94a3b8',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.16s ease',
                            fontFamily: "'Tomorrow', sans-serif",
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 500,
                              padding: '2px 5px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                              border: isSelected ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                              color: isSelected ? '#38bdf8' : '#cbd5e1',
                              flexShrink: 0,
                              letterSpacing: '0.02em',
                            }}
                          >
                            {crew.callsign}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                            <span style={{ fontSize: '11px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#ffffff' : '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {crew.name}
                            </span>
                            <span style={{ fontSize: '9.5px', color: isSelected ? '#7dd3fc' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {crew.shortName}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clinical Category Tabs */}
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    paddingBottom: '2px',
                    flexShrink: 0,
                  }}
                >
                  {[
                    { key: 'ALL' as const, label: 'All Anomalies', count: 13 },
                    { key: 'CARDIO' as const, label: 'Cardiovascular', count: 4 },
                    { key: 'IMMUNE' as const, label: 'Immunology', count: 4 },
                    { key: 'METABOLIC' as const, label: 'Metabolic & SANS', count: 5 },
                  ].map((tab) => {
                    const isCatSelected = clinicalCategory === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setClinicalCategory(tab.key)}
                        style={{
                          padding: '4px 11px',
                          fontSize: '11px',
                          fontWeight: isCatSelected ? 600 : 400,
                          color: isCatSelected ? '#7dd3fc' : '#94a3b8',
                          background: isCatSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(11, 15, 25, 0.75)',
                          border: isCatSelected
                            ? '1px solid rgba(56, 189, 248, 0.35)'
                            : '1px solid rgba(255, 255, 255, 0.09)',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                          fontFamily: "'Tomorrow', sans-serif",
                          flexShrink: 0,
                        }}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Scrollable Body */}
            <div
              ref={scrollBodyRef}
              onScroll={() => setActiveTooltip(null)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
                flex: 1,
                background: 'rgba(26, 35, 52, 0.98)',
              }}
            >
              {/* ── TAB 1: UNIVERSAL SCENARIOS (Spacecraft-Wide) ── */}
              {scopeTab === 'UNIVERSAL' && (
                <>
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(11, 15, 25, 0.92)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderLeft: '3px solid #38bdf8',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
                    }}
                  >
                    <span
                      style={{
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        letterSpacing: '0.01em',
                      }}
                    >
                      Spacecraft-Wide Events
                    </span>
                    <span style={{ color: '#cbd5e1', fontSize: '11.5px', lineHeight: 1.45 }}>
                      Life-support and environmental emergencies propagate across cabin modules and evaluate all 4 crew stations simultaneously.
                    </span>
                  </div>

                  {/* Universal Scenarios Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                      gap: '10px',
                      paddingRight: '2px',
                    }}
                  >
                    {visibleUniversalScenarios.map((sc) => {
                      const isActive =
                        currentScenario === sc.key ||
                        (sc.key === 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH' && currentScenario === 'SCENARIO_3_CO2_HYPOXIA') ||
                        (sc.key === 'SCENARIO_3_SOLAR_RADIATION_STORM' && currentScenario === 'SCENARIO_8_SOLAR_RADIATION_STORM');

                      const isTriggering = triggeringKey === sc.key;
                      const isScCritical = sc.severity === 'CRITICAL';
                      const isScWarning = sc.severity === 'WARNING';
                      const cardThemeColor = isScCritical ? '#f43f5e' : (isScWarning ? '#f59e0b' : '#38bdf8');

                      return (
                        <button
                          key={sc.key}
                          onClick={() => handleTrigger(sc.key)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: isActive
                              ? (isScCritical ? 'rgba(244, 63, 94, 0.16)' : isScWarning ? 'rgba(245, 158, 11, 0.16)' : 'rgba(56, 189, 248, 0.16)')
                              : 'rgba(11, 15, 25, 0.92)',
                            border: isActive
                              ? `1.5px solid ${cardThemeColor}`
                              : '1px solid rgba(255, 255, 255, 0.11)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.16s ease',
                            minHeight: '88px',
                            gap: '8px',
                            boxShadow: isActive ? `0 0 20px ${cardThemeColor}40` : '0 2px 8px rgba(0, 0, 0, 0.4)',
                            fontFamily: "'Tomorrow', sans-serif",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'rgba(16, 22, 36, 0.98)';
                              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.55), 0 0 8px rgba(56, 189, 248, 0.15)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                            handleCardMouseEnter(e, sc);
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'rgba(11, 15, 25, 0.92)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.11)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
                              e.currentTarget.style.transform = 'none';
                            }
                            handleCardMouseLeave();
                          }}
                        >
                          {/* Card Header: Full Title + Active status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#ffffff',
                                letterSpacing: '0.01em',
                                lineHeight: '1.35',
                                flex: 1,
                                wordBreak: 'break-word',
                              }}
                            >
                              {sc.label}
                            </span>
                            {isTriggering ? (
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8', flexShrink: 0 }}>
                                [SYNCING]
                              </span>
                            ) : null}
                          </div>

                          {/* Plain-English Description */}
                          <div style={{ width: '100%' }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '1.45',
                                color: '#cbd5e1',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                transition: 'color 0.15s ease',
                                fontFamily: "'Tomorrow', sans-serif",
                              }}
                            >
                              {sc.description}
                            </p>
                          </div>

                          {/* Subtle Monospace Telemetry Marker + Artemis Badge Bottom Right */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '4px' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                color: '#38bdf8',
                                fontFamily: "'Share Tech Mono', monospace",
                                letterSpacing: '0.01em',
                                fontWeight: 600,
                              }}
                            >
                              {sc.badge}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: '8.5px',
                                  fontWeight: 700,
                                  color: sc.artemisCohort === 'ARTEMIS_I' ? '#38bdf8' : '#fbbf24',
                                  background: sc.artemisCohort === 'ARTEMIS_I' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(251, 191, 36, 0.14)',
                                  border: `1px solid ${sc.artemisCohort === 'ARTEMIS_I' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(251, 191, 36, 0.35)'}`,
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                {sc.artemisCohort === 'ARTEMIS_I' ? 'ARTEMIS I' : 'ARTEMIS II'}
                              </span>
                              {isScCritical && (
                                <img
                                  src="/icons/critical.png"
                                  alt="Critical"
                                  title="Critical Severity"
                                  style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                                />
                              )}
                              {isScWarning && (
                                <img
                                  src="/icons/warning.png"
                                  alt="Warning"
                                  title="Warning Severity"
                                  style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                                />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── TAB 2: INDIVIDUAL CREW SCENARIOS (Targeted Clinical Grid) ── */}
              {scopeTab === 'INDIVIDUAL' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: '10px',
                    paddingRight: '2px',
                  }}
                >
                  {filteredIndividualScenarios.map((sc) => {
                    const isKeyActive =
                      currentScenario === sc.key ||
                      (sc.key === 'SCENARIO_10_PRESYMPTOMATIC_SEPSIS' && currentScenario === 'SCENARIO_5_PRESYMPTOMATIC_SEPSIS') ||
                      (sc.key === 'SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT' && currentScenario === 'SCENARIO_1_BASELINE_DRIFT');

                    const isTargetActive = isKeyActive && activeTargetCrewId === selectedCrewId;
                    const isTriggering = triggeringKey === sc.key;
                    const isScCritical = sc.severity === 'CRITICAL';
                    const isScWarning = sc.severity === 'WARNING';
                    const cardThemeColor = isScCritical ? '#f43f5e' : (isScWarning ? '#f59e0b' : '#38bdf8');

                    return (
                      <button
                        key={sc.key}
                        onClick={() => handleTrigger(sc.key, selectedCrewId)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          background: isTargetActive
                            ? (isScCritical ? 'rgba(244, 63, 94, 0.16)' : isScWarning ? 'rgba(245, 158, 11, 0.16)' : 'rgba(56, 189, 248, 0.16)')
                            : 'rgba(11, 15, 25, 0.92)',
                          border: isTargetActive
                            ? `1.5px solid ${cardThemeColor}`
                            : '1px solid rgba(255, 255, 255, 0.11)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.16s ease',
                          minHeight: '88px',
                          gap: '8px',
                          boxShadow: isTargetActive ? `0 0 20px ${cardThemeColor}40` : '0 2px 8px rgba(0, 0, 0, 0.4)',
                          fontFamily: "'Tomorrow', sans-serif",
                        }}
                        onMouseEnter={(e) => {
                          if (!isTargetActive) {
                            e.currentTarget.style.background = 'rgba(16, 22, 36, 0.98)';
                            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.55), 0 0 8px rgba(56, 189, 248, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                          handleCardMouseEnter(e, sc);
                        }}
                        onMouseLeave={(e) => {
                          if (!isTargetActive) {
                            e.currentTarget.style.background = 'rgba(11, 15, 25, 0.92)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.11)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
                            e.currentTarget.style.transform = 'none';
                          }
                          handleCardMouseLeave();
                        }}
                      >
                        {/* Card Header: Full Title + Active status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#ffffff',
                              letterSpacing: '0.01em',
                              lineHeight: '1.35',
                              flex: 1,
                              wordBreak: 'break-word',
                            }}
                          >
                            {sc.label}
                          </span>
                          {isTriggering ? (
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8', flexShrink: 0 }}>
                              [SYNCING]
                            </span>
                          ) : null}
                        </div>

                        {/* Plain-English Description */}
                        <div style={{ width: '100%' }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '12px',
                              lineHeight: '1.45',
                              color: '#cbd5e1',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'color 0.15s ease',
                              fontFamily: "'Tomorrow', sans-serif",
                            }}
                          >
                            {sc.description}
                          </p>
                        </div>

                        {/* Subtle Monospace Telemetry Marker + Artemis Badge Bottom Right */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '4px' }}>
                          <span
                            style={{
                              fontSize: '10.5px',
                              color: '#38bdf8',
                              fontFamily: "'Share Tech Mono', monospace",
                              letterSpacing: '0.01em',
                              fontWeight: 600,
                            }}
                          >
                            {sc.badge}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: '8.5px',
                                fontWeight: 800,
                                color: sc.artemisCohort === 'ARTEMIS_I' ? '#38bdf8' : '#fbbf24',
                                background: sc.artemisCohort === 'ARTEMIS_I' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(251, 191, 36, 0.14)',
                                border: `1px solid ${sc.artemisCohort === 'ARTEMIS_I' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(251, 191, 36, 0.35)'}`,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {sc.artemisCohort === 'ARTEMIS_I' ? 'ARTEMIS I' : 'ARTEMIS II'}
                            </span>
                            {isScCritical && (
                              <img
                                src="/icons/critical.png"
                                alt="Critical"
                                title="Critical Severity"
                                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                              />
                            )}
                            {isScWarning && (
                              <img
                                src="/icons/warning.png"
                                alt="Warning"
                                title="Warning Severity"
                                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dynamic Scenario Context Description Footer */}
            <div
              style={{
                padding: '14px 20px',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(15, 23, 42, 0.95) 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.10)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              {/* Left Column: Heading On Top, Description Placed Below It */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                {/* Active Scenario Heading Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '12px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: activeThemeColor,
                        boxShadow: `0 0 10px ${activeThemeColor}`,
                        display: 'inline-block',
                      }}
                    />
                    ACTIVE: {activeScenarioMeta.label}
                  </span>

                  {activeTargetProfile && !isUniversalActive && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {activeTargetProfile.callsign} · {activeTargetProfile.name}
                    </span>
                  )}

                  {isUniversalActive && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: '4px',
                        background: isNominalActive ? 'rgba(34, 197, 94, 0.14)' : 'rgba(56, 189, 248, 0.14)',
                        border: isNominalActive ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(56, 189, 248, 0.35)',
                        color: isNominalActive ? '#4ade80' : '#38bdf8',
                        letterSpacing: '0.02em',
                      }}
                    >
                      ALL CABIN STATIONS
                    </span>
                  )}

                  {!isNominalActive && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: '4px',
                        background: activeSeverity === 'CRITICAL' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        border: activeSeverity === 'CRITICAL' ? '1px solid rgba(244, 63, 94, 0.45)' : '1px solid rgba(245, 158, 11, 0.4)',
                        color: activeSeverity === 'CRITICAL' ? '#f43f5e' : '#fbbf24',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {activeSeverity}
                    </span>
                  )}
                </div>

                {/* Description Placed Below the Heading */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    lineHeight: '1.5',
                    color: '#cbd5e1',
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  {activeScenarioMeta.description}
                  {!isNominalActive && activeScenarioMeta.physiologicalShift && (
                    <span style={{ color: '#94a3b8', marginLeft: '6px', fontWeight: 500 }}>
                      ({activeScenarioMeta.physiologicalShift})
                    </span>
                  )}
                </p>
              </div>

              {/* Right Column: Keybind Prompt */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--hud-text-dim)',
                  fontSize: '10px',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <span>Press</span>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '10px',
                  }}
                >
                  ESC
                </span>
                <span>or</span>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '10px',
                  }}
                >
                  S
                </span>
                <span>to close</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── High-Fidelity HUD Scenario Description Tooltip (Portaled to document.body) ── */}
      {isOpen && activeTooltip && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            transform:
              activeTooltip.placement === 'top'
                ? 'translate(-50%, -100%)'
                : activeTooltip.placement === 'bottom'
                  ? 'translate(-50%, 0)'
                  : activeTooltip.placement === 'left'
                    ? 'translate(-100%, -50%)'
                    : 'translate(0, -50%)',
            zIndex: 100000,
            width: '340px',
            maxWidth: 'calc(100vw - 28px)',
            pointerEvents: 'none',
            background: 'rgba(11, 15, 25, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: activeTooltip.severity === 'CRITICAL' ? '1.5px solid #f43f5e' : activeTooltip.severity === 'WARNING' ? '1.5px solid #fbbf24' : '1.5px solid #38bdf8',
            borderRadius: '8px',
            padding: '12px 14px',
            boxShadow: activeTooltip.severity === 'CRITICAL' ? '0 16px 40px rgba(0, 0, 0, 0.95), 0 0 16px rgba(244, 63, 94, 0.3)' : activeTooltip.severity === 'WARNING' ? '0 16px 40px rgba(0, 0, 0, 0.95), 0 0 16px rgba(251, 191, 36, 0.3)' : '0 16px 40px rgba(0, 0, 0, 0.95), 0 0 16px rgba(56, 189, 248, 0.3)',
            color: '#f8fafc',
            fontFamily: "'Tomorrow', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          {/* Tooltip Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                opacity: 1,
                letterSpacing: '0.02em',
                lineHeight: 1.3,
                flex: 1,
              }}
            >
              {activeTooltip.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {activeTooltip.severity === 'CRITICAL' && (
                <img
                  src="/icons/critical.png"
                  alt="Critical"
                  title="Critical Severity"
                  style={{
                    width: '14px',
                    height: '14px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.6))',
                  }}
                />
              )}
              {activeTooltip.severity === 'WARNING' && (
                <img
                  src="/icons/warning.png"
                  alt="Warning"
                  title="Warning Severity"
                  style={{
                    width: '14px',
                    height: '14px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.6))',
                  }}
                />
              )}
            </div>
          </div>

          {/* Main Hero Description Text */}
          <div
            style={{
              fontSize: '12px',
              lineHeight: 1.5,
              color: '#ffffff',
              opacity: 1,
              fontWeight: 400,
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '8px 10px',
              borderRadius: '5px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            {activeTooltip.description}
          </div>

          {/* Physiological Shift Details - Uses Full Space Under Label */}
          {activeTooltip.physiologicalShift && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: '#38bdf8',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Physiological Shift:
              </span>
              <span style={{ fontSize: '11px', lineHeight: 1.45, color: '#f1f5f9', opacity: 0.95 }}>
                {activeTooltip.physiologicalShift}
              </span>
            </div>
          )}

          {/* NASA Flight & Safety Citation */}
          {activeTooltip.nasaCitation && (
            <div
              style={{
                fontSize: '10px',
                lineHeight: 1.4,
                color: '#cbd5e1',
                background: 'rgba(56, 189, 248, 0.06)',
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                NASA Flight &amp; Safety Citation:
              </span>
              <span>{activeTooltip.nasaCitation}</span>
            </div>
          )}

          {/* Telemetry Badge Footer + Artemis Badge on Bottom Right */}
          <div
            style={{
              paddingTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                color: '#38bdf8',
                fontWeight: 600,
                fontSize: '10.5px',
                letterSpacing: '0.01em',
              }}
            >
              {activeTooltip.badge}
            </span>
            {activeTooltip.artemisCohort && (
              <span
                style={{
                  fontSize: '8.5px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: activeTooltip.artemisCohort === 'ARTEMIS_I' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(251, 191, 36, 0.16)',
                  color: activeTooltip.artemisCohort === 'ARTEMIS_I' ? '#38bdf8' : '#fbbf24',
                  border: `1px solid ${activeTooltip.artemisCohort === 'ARTEMIS_I' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(251, 191, 36, 0.35)'}`,
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                }}
              >
                {activeTooltip.artemisCohort === 'ARTEMIS_I' ? 'ARTEMIS I' : 'ARTEMIS II'}
              </span>
            )}
          </div>

          {/* Caret arrow pointing to the anchor */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              ...(activeTooltip.placement === 'top'
                ? {
                  bottom: '-6px',
                  left: `calc(50% + ${activeTooltip.caretOffset}px)`,
                  transform: 'translateX(-50%)',
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: activeTooltip.severity === 'CRITICAL' ? '6px solid #f43f5e' : activeTooltip.severity === 'WARNING' ? '6px solid #fbbf24' : '6px solid #38bdf8',
                  filter: 'drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6))',
                }
                : activeTooltip.placement === 'bottom'
                  ? {
                    top: '-6px',
                    left: `calc(50% + ${activeTooltip.caretOffset}px)`,
                    transform: 'translateX(-50%)',
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: activeTooltip.severity === 'CRITICAL' ? '6px solid #f43f5e' : activeTooltip.severity === 'WARNING' ? '6px solid #fbbf24' : '6px solid #38bdf8',
                    filter: 'drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.6))',
                  }
                  : activeTooltip.placement === 'left'
                    ? {
                      right: '-6px',
                      top: `calc(50% + ${activeTooltip.caretOffset}px)`,
                      transform: 'translateY(-50%)',
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      borderLeft: activeTooltip.severity === 'CRITICAL' ? '6px solid #f43f5e' : activeTooltip.severity === 'WARNING' ? '6px solid #fbbf24' : '6px solid #38bdf8',
                      filter: 'drop-shadow(2px 0 2px rgba(0, 0, 0, 0.6))',
                    }
                    : {
                      left: '-6px',
                      top: `calc(50% + ${activeTooltip.caretOffset}px)`,
                      transform: 'translateY(-50%)',
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      borderRight: activeTooltip.severity === 'CRITICAL' ? '6px solid #f43f5e' : activeTooltip.severity === 'WARNING' ? '6px solid #fbbf24' : '6px solid #38bdf8',
                      filter: 'drop-shadow(-2px 0 2px rgba(0, 0, 0, 0.6))',
                    }),
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};
