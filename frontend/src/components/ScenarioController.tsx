import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { audioService } from '../services/audioService';

interface ScenarioControllerProps {
  currentScenario: string;
  marsDelay: boolean;
  onToggleMarsDelay: (enabled: boolean) => void;
  onScenarioTriggered?: (scenarioKey: string, telemetry?: Record<string, any>) => void;
}

interface ScenarioMeta {
  key: string;
  label: string;
  badge: string;
  category: 'ENVIRONMENT' | 'CARDIO' | 'IMMUNE' | 'METABOLIC';
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  physiologicalShift?: string;
}

interface TooltipData {
  key: string;
  label: string;
  badge: string;
  category: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  physiologicalShift?: string;
  x: number;
  y: number;
  caretOffset: number;
  placement: 'top' | 'bottom';
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
    label: '01 · CO₂ Scrubber Leak',
    badge: 'CO₂: 4.25 mmHg · Limit Breach',
    category: 'ENVIRONMENT',
    description: 'Cabin carbon dioxide climbs past safety limits (>4.0 mmHg). Immediate secondary scrubbers required.',
    severity: 'WARNING',
    physiologicalShift: 'All Crew: Compensatory hyperventilation, SpO₂ dips to 96.2%, HR climbs to 82 bpm.',
  },
  {
    key: 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA',
    label: '02 · Cabin Decompression',
    badge: 'SpO₂: 88.5% · Hypoxic Drop',
    category: 'ENVIRONMENT',
    description: 'Cabin atmospheric pressure drops; severe hypoxic cascade. Don oxygen masks and seal pressure bulkheads.',
    severity: 'CRITICAL',
    physiologicalShift: 'All Crew: Critical hypoxia SpO₂ 88.5%, acute tachycardia HR 118 bpm, autonomic strain HRV 24 ms.',
  },
  {
    key: 'SCENARIO_3_SOLAR_RADIATION_STORM',
    label: '03 · Solar Radiation Storm',
    badge: 'Flux: 85 mGy/h · Dose 0.75 Gy',
    category: 'ENVIRONMENT',
    description: 'Energetic solar proton event; 0.75 Gy biodosimetry dose. Evacuate all crew to the water-shielded shelter.',
    severity: 'CRITICAL',
    physiologicalShift: 'All Crew: Acute lymphocyte depletion to 0.85k, RSI 1.25, active biodosimetry tracking.',
  },
  {
    key: 'SCENARIO_4_AMMONIA_COOLANT_LEAK',
    label: '04 · Ammonia Coolant Breach',
    badge: 'SpO₂: 89.5% · Toxic Ingress',
    category: 'ENVIRONMENT',
    description: 'External thermal coolant breach into cabin atmosphere; toxic aerosol blocks alveolar gas exchange.',
    severity: 'CRITICAL',
    physiologicalShift: 'All Crew: Chemical pneumonitis SpO₂ 89.5%, severe tachycardia HR 132 bpm, IL-6 inflammatory spike 28 pg/mL.',
  },
  {
    key: 'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER',
    label: '05 · Electrical Fire Smolder',
    badge: 'Avionics Bay · CRP: 8.5 mg/L',
    category: 'ENVIRONMENT',
    description: 'Smoldering wiring harness in avionics electronics bay; cut power bus and inspect panel with extinguisher.',
    severity: 'WARNING',
    physiologicalShift: 'All Crew: Particulate smoke ingress, SpO₂ 93.5%, HR 108 bpm, CRP systemic irritation 8.5 mg/L.',
  },
];

// ── Individual Crew Scenarios (Scenarios 6-18) ──
const INDIVIDUAL_SCENARIOS: ScenarioMeta[] = [
  // Cardiovascular & Electrophysiology
  {
    key: 'SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA',
    label: '06 · Hypokalemic Arrhythmia',
    badge: 'K⁺ 2.95 mmol/L · QTc 492ms',
    category: 'CARDIO',
    description: 'Potassium drops below safe threshold (2.95 mmol/L); dynamic QTc prolongation and ventricular flutter risk.',
    severity: 'WARNING',
    physiologicalShift: 'Target: K+ 2.95 mmol/L, QTc widening to 492 ms, ARF 1.75, tachycardia drift HR 78 bpm.',
  },
  {
    key: 'SCENARIO_7_VENOUS_THROMBOSIS_RISK',
    label: '07 · Jugular Vein Thrombosis',
    badge: 'Hct 52.5% · TRM 2.35 Clot Risk',
    category: 'CARDIO',
    description: 'Cephalic fluid pooling in zero-G causes neck internal jugular vein flow stasis and acute thrombosis risk.',
    severity: 'WARNING',
    physiologicalShift: 'Target: Hematocrit 52.5%, Platelet surge 385k, IL-6 18.5 pg/mL, TRM hypercoagulability 2.35.',
  },
  {
    key: 'SCENARIO_8_CARDIOVASCULAR_DECONDITIONING',
    label: '08 · Cardiac Deconditioning',
    badge: 'HR 98 bpm · HRV 18ms',
    category: 'CARDIO',
    description: 'Microgravity cardiac atrophy and orthostatic intolerance; resting pulse spikes during light postural effort.',
    severity: 'WARNING',
    physiologicalShift: 'Target: Resting HR spikes to 98 bpm (Z > +4.0), HRV collapses to 18 ms, microvascular tone dip.',
  },
  {
    key: 'SCENARIO_9_CORONARY_MICROVASCULAR_STRESS',
    label: '09 · Coronary Microvascular Strain',
    badge: 'CRP 6.8 mg/L · QTc 458ms',
    category: 'CARDIO',
    description: 'Coronary microvascular strain and endothelial irritation; chewable baby aspirin and mandatory cabin rest.',
    severity: 'WARNING',
    physiologicalShift: 'Target: HR 96 bpm, CRP systemic inflammatory drift 6.8 mg/L, QTc widens to 458 ms.',
  },

  // Infection & Immune System
  {
    key: 'SCENARIO_10_PRESYMPTOMATIC_SEPSIS',
    label: '10 · Presymptomatic Sepsis',
    badge: 'IL-6 125 pg/mL · EPI 1.65 Alert',
    category: 'IMMUNE',
    description: 'Immune cytokine cascade surges hours ahead of fever; autonomic uncoupling precedes clinical sepsis.',
    severity: 'CRITICAL',
    physiologicalShift: 'Target: IL-6 surges to 125 pg/mL, WBC 14.5k, CRP 16.5 mg/L, Temp 37.8°C, EPI 1.65 (Critical Cascade).',
  },
  {
    key: 'SCENARIO_11_LATENT_VIRUS_REACTIVATION',
    label: '11 · Latent Virus Reactivation',
    badge: 'IL-6 22 pg/mL · Lympho 1.4k',
    category: 'IMMUNE',
    description: 'Deep-space cosmic radiation wakes dormant herpesvirus/EBV; start oral antivirals and dark rest schedule.',
    severity: 'WARNING',
    physiologicalShift: 'Target: IL-6 22 pg/mL, Lymphocytes dip to 1.4k, resting pulse 78 bpm, EPI 0.95.',
  },
  {
    key: 'SCENARIO_12_CYTOKINE_RELEASE_STORM',
    label: '12 · Cytokine Storm Hyperdrive',
    badge: 'IL-6 195 pg/mL · Temp 38.9°C',
    category: 'IMMUNE',
    description: 'Acute systemic hyper-inflammatory overdrive; administer IV corticosteroids and cooling blanket.',
    severity: 'CRITICAL',
    physiologicalShift: 'Target: Massive cytokine surge IL-6 195 pg/mL, WBC 16.8k, CRP 24.0 mg/L, Temp 38.9°C, HR 126 bpm.',
  },
  {
    key: 'SCENARIO_13_RADIATION_MARROW_EXHAUSTION',
    label: '13 · Marrow Radiation Suppression',
    badge: 'Lympho 0.52k · Dose 0.95 Gy',
    category: 'IMMUNE',
    description: 'Hematopoietic bone marrow suppression following solar transit; absolute lymphocyte depletion under 0.6k.',
    severity: 'WARNING',
    physiologicalShift: 'Target: Severe lymphocytopenia to 0.52k, WBC drops to 2.4k, absorbed radiation dose 0.95 Gy, RSI 1.45.',
  },

  // Metabolic, SANS & Fluids
  {
    key: 'SCENARIO_14_NEPHROLITHIASIS',
    label: '14 · Renal Calculi (Kidney Stone)',
    badge: 'Pain HR 88 bpm · HRV 28ms',
    category: 'METABOLIC',
    description: 'Bone calcium loss in microgravity concentrates in renal tubules; drink 3 liters of fluid and take potassium citrate.',
    severity: 'WARNING',
    physiologicalShift: 'Target: Acute renal colic sympathetic pain HR 88 bpm, HRV drops to 28 ms, urine calcium concentration.',
  },
  {
    key: 'SCENARIO_15_INTRAVASCULAR_DEHYDRATION',
    label: '15 · Intravascular Dehydration',
    badge: 'Hct 52.0% · TRM 1.95 Shift',
    category: 'METABOLIC',
    description: 'Blood plasma volume contracts and thickens; drink balanced electrolyte solution and lie in micro-G neutral posture.',
    severity: 'WARNING',
    physiologicalShift: 'Target: Hemoconcentration Hct 52.0%, compensatory tachycardia HR 92 bpm, HRV collapses to 22 ms.',
  },
  {
    key: 'SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION',
    label: '16 · Hepatic Clearance Impairment',
    badge: 'CYP450 Slowdown · T½ +35%',
    category: 'METABOLIC',
    description: 'Liver CYP450 drug clearance slows under cosmic radiation and microgravity; adjust pharmaceutical dosing intervals.',
    severity: 'WARNING',
    physiologicalShift: 'Target: Phase I/II hepatic clearance impairment; drug half-lives prolonged by ~35%.',
  },
  {
    key: 'SCENARIO_17_SPACE_VISION_SANS',
    label: '17 · Spaceflight Neuro-Ocular (SANS)',
    badge: 'ONSD Elevated · ICP Congestion',
    category: 'METABOLIC',
    description: 'Cephalic venous congestion elevates optic nerve sheath diameter; initiate Lower Body Negative Pressure (LBNP).',
    severity: 'WARNING',
    physiologicalShift: 'Target: Optic sheath expansion, elevated intracranial compliance pressure, mild platelet reactivity 290k.',
  },
  {
    key: 'SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT',
    label: '18 · Circadian Sol Fatigue Drift',
    badge: 'Sleep Index 42 · HR +14 bpm',
    category: 'METABOLIC',
    description: 'Cumulative sleep deficit on 24.6h Martian Sol; resting heart rate baseline drifts upward by +14 bpm.',
    severity: 'WARNING',
    physiologicalShift: 'Target: Sleep quality drops to 42, baseline HR climbs by +14 bpm, autonomic vagal suppression HRV 22 ms.',
  },
];

const ALL_SCENARIOS = [...UNIVERSAL_SCENARIOS, ...INDIVIDUAL_SCENARIOS];

type ScopeTab = 'UNIVERSAL' | 'INDIVIDUAL';
type ClinicalCategory = 'ALL' | 'CARDIO' | 'IMMUNE' | 'METABOLIC';

const formatCategoryShort = (cat?: string): string => {
  if (!cat) return '';
  switch (cat.toUpperCase()) {
    case 'ENVIRONMENT':
      return 'ENV';
    case 'CARDIO':
      return 'CARD';
    case 'IMMUNE':
      return 'IMM';
    case 'METABOLIC':
      return 'MET';
    default:
      return cat.toUpperCase();
  }
};

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

    const TOOLTIP_WIDTH = 340;
    const TOOLTIP_ESTIMATED_HEIGHT = 210;
    const VIEWPORT_PADDING = 16;

    // Horizontal clamping to ensure tooltip never bleeds off viewport edges
    const halfWidth = TOOLTIP_WIDTH / 2;
    const minX = halfWidth + VIEWPORT_PADDING;
    const maxX = window.innerWidth - halfWidth - VIEWPORT_PADDING;
    const clampedX = Math.max(minX, Math.min(maxX, cardCenterX));

    // Caret offset relative to tooltip center (clamped so it stays within rounded corners)
    const rawOffset = cardCenterX - clampedX;
    const maxCaretOffset = halfWidth - 24;
    const caretOffset = Math.max(-maxCaretOffset, Math.min(maxCaretOffset, rawOffset));

    // Vertical placement logic:
    // Check available space above and below the card
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;

    let placement: 'top' | 'bottom' = 'top';
    if (spaceAbove >= TOOLTIP_ESTIMATED_HEIGHT) {
      // Plenty of room above card
      placement = 'top';
    } else if (spaceBelow >= TOOLTIP_ESTIMATED_HEIGHT) {
      // Room below card
      placement = 'bottom';
    } else {
      // Constrained on both: choose whichever side has more space
      placement = spaceAbove >= spaceBelow ? 'top' : 'bottom';
    }

    const y = placement === 'top' ? rect.top - 8 : rect.bottom + 8;

    setActiveTooltip({
      key: sc.key,
      label: sc.label,
      badge: sc.badge,
      category: sc.category,
      description: sc.description,
      severity: sc.severity,
      physiologicalShift: sc.physiologicalShift,
      x: clampedX,
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

    if (onScenarioTriggered) {
      onScenarioTriggered(key);
    }

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
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.telemetry && onScenarioTriggered) {
          onScenarioTriggered(key, data.telemetry);
        }
      }
    } catch {
      // Offline fallback
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
      label: 'Nominal Cruise',
      badge: 'Stable baseline',
      category: 'ENVIRONMENT' as const,
      description: 'All crew vitals within safe baseline range. Autonomous life-support systems green.',
      severity: 'NOMINAL' as const,
      physiologicalShift: 'All stations reporting baseline autonomic and metabolic homeostasis.',
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

  const filteredIndividualScenarios =
    clinicalCategory === 'ALL'
      ? INDIVIDUAL_SCENARIOS
      : INDIVIDUAL_SCENARIOS.filter((s) => s.category === clinicalCategory);

  return (
    <>
      {/* ── Fixed Floating Action Trigger Pill (Bottom-Right) ── */}
      <button
        id="scenario-floating-trigger"
        onClick={() => setIsOpen(true)}
        aria-label="Open Simulation Scenarios Modal"
        title="Open Simulation Scenarios (Hotkey: S)"
        style={{
          position: 'fixed',
          bottom: '22px',
          right: '24px',
          zIndex: 9990,
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          padding: '9px 16px',
          background: 'rgba(17, 17, 17, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isNominalActive
            ? '1px solid rgba(16, 185, 129, 0.4)'
            : activeSeverity === 'CRITICAL'
              ? '1px solid rgba(244, 63, 94, 0.65)'
              : '1px solid rgba(245, 158, 11, 0.65)',
          borderRadius: '9999px',
          color: '#ffffff',
          cursor: 'pointer',
          boxShadow: isNominalActive
            ? '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 14px rgba(16, 185, 129, 0.18)'
            : activeSeverity === 'CRITICAL'
              ? '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(244, 63, 94, 0.3)'
              : '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(245, 158, 11, 0.3)',
          transition: 'all var(--hud-transition-fast)',
          fontFamily: "'Tomorrow', sans-serif",
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          e.currentTarget.style.borderColor = activeThemeColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.borderColor = isNominalActive
            ? 'rgba(16, 185, 129, 0.4)'
            : activeSeverity === 'CRITICAL'
              ? 'rgba(244, 63, 94, 0.65)'
              : 'rgba(245, 158, 11, 0.65)';
        }}
      >
        {/* Pulsing Status Beacon */}
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: activeThemeColor,
            boxShadow: `0 0 8px ${activeThemeColor}`,
            flexShrink: 0,
          }}
        />

        {/* Text Details with Target Astronaut Label */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff' }}>
              SCENARIOS
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '3px',
                background: isNominalActive
                  ? 'rgba(16, 185, 129, 0.18)'
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
                    ? '1px solid rgba(244, 63, 94, 0.4)'
                    : '1px solid rgba(245, 158, 11, 0.4)',
                letterSpacing: '0.02em',
              }}
            >
              {isNominalActive
                ? 'NOMINAL'
                : isUniversalActive
                  ? 'ALL STATIONS'
                  : activeTargetProfile
                    ? activeTargetProfile.shortName.toUpperCase()
                    : 'INDIVIDUAL'}
            </span>
          </div>
          <span
            style={{
              fontSize: '10px',
              color: '#94a3b8',
              maxWidth: '185px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeScenarioMeta.label}
          </span>
        </div>

        {/* Keycap Shortcut Indicator */}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            color: 'var(--hud-text-secondary)',
            marginLeft: '2px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
                  SIMULATION FLIGHT SCENARIOS
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Global Reset to Nominal Cruise */}
                <button
                  onClick={() => handleTrigger('NOMINAL_CRUISE')}
                  className="hud-btn"
                  style={{
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: isNominalActive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                    color: isNominalActive ? '#4ade80' : '#f8fafc',
                    border: isNominalActive ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isNominalActive) {
                      e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                      e.currentTarget.style.color = '#4ade80';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isNominalActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.color = '#f8fafc';
                    }
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                  RESET ALL TO NOMINAL
                </button>

                {/* Modal Close Button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setActiveTooltip(null);
                  }}
                  aria-label="Close Simulation Scenarios Modal"
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
                background: 'rgba(0, 0, 0, 0.35)',
                borderBottom: '1px solid var(--hud-border)',
                padding: '6px 20px 0',
                gap: '8px',
              }}
            >
              <button
                onClick={() => setScopeTab('UNIVERSAL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontSize: '12px',
                  fontWeight: scopeTab === 'UNIVERSAL' ? 800 : 600,
                  color: scopeTab === 'UNIVERSAL' ? '#ffffff' : '#64748b',
                  background: scopeTab === 'UNIVERSAL' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  borderTop: scopeTab === 'UNIVERSAL' ? '2px solid #38bdf8' : '2px solid transparent',
                  borderLeft: scopeTab === 'UNIVERSAL' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                  borderRight: scopeTab === 'UNIVERSAL' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                  borderBottom: 'none',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: "'Tomorrow', sans-serif",
                  letterSpacing: '0.03em',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>UNIVERSAL SCENARIOS</span>
              </button>

              <button
                onClick={() => setScopeTab('INDIVIDUAL')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontSize: '12px',
                  fontWeight: scopeTab === 'INDIVIDUAL' ? 800 : 600,
                  color: scopeTab === 'INDIVIDUAL' ? '#ffffff' : '#64748b',
                  background: scopeTab === 'INDIVIDUAL' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  borderTop: scopeTab === 'INDIVIDUAL' ? '2px solid #38bdf8' : '2px solid transparent',
                  borderLeft: scopeTab === 'INDIVIDUAL' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                  borderRight: scopeTab === 'INDIVIDUAL' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                  borderBottom: 'none',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: "'Tomorrow', sans-serif",
                  letterSpacing: '0.03em',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>INDIVIDUAL CREW SCENARIOS</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div
              onScroll={() => setActiveTooltip(null)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* ── TAB 1: UNIVERSAL SCENARIOS (Spacecraft-Wide) ── */}
              {scopeTab === 'UNIVERSAL' && (
                <>
                  <div
                    style={{
                      padding: '9px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--hud-radius-btn)',
                      fontSize: '11.5px',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span
                      style={{
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '11.5px',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      SPACECRAFT-WIDE EVENTS:
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '11.5px', lineHeight: 1.4 }}>
                      Life-support and environmental emergencies propagate across cabin modules and evaluate all 4 crew stations simultaneously.
                    </span>
                  </div>

                  {/* Universal Scenarios Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '10px',
                      paddingRight: '2px',
                    }}
                  >
                    {UNIVERSAL_SCENARIOS.map((sc) => {
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
                              ? (isScCritical ? 'rgba(244, 63, 94, 0.10)' : isScWarning ? 'rgba(245, 158, 11, 0.10)' : 'rgba(56, 189, 248, 0.10)')
                              : 'rgba(255, 255, 255, 0.02)',
                            border: isActive
                              ? `1.5px solid ${cardThemeColor}`
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.16s ease',
                            minHeight: '84px',
                            gap: '6px',
                            boxShadow: isActive ? `0 0 16px ${cardThemeColor}40` : 'none',
                            fontFamily: "'Tomorrow', sans-serif",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                            handleCardMouseEnter(e, sc);
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.transform = 'none';
                            }
                            handleCardMouseLeave();
                          }}
                        >
                          {/* Card Header: Title + Status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 700,
                                color: '#ffffff',
                                letterSpacing: '0.02em',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {sc.label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                              {isTriggering ? (
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8' }}>
                                  [SYNCING]
                                </span>
                              ) : isActive ? (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    color: '#030712',
                                    background: cardThemeColor,
                                    padding: '1px 7px',
                                    borderRadius: '3px',
                                    border: `1px solid ${cardThemeColor}`,
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  ● ACTIVE
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 600,
                                    color: '#94a3b8',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: '3px',
                                    letterSpacing: '0.03em',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {formatCategoryShort(sc.category)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Plain-English Description */}
                          <div style={{ width: '100%' }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '1.45',
                                color: '#94a3b8',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                transition: 'color 0.15s ease',
                              }}
                            >
                              {sc.description}
                            </p>
                          </div>

                          {/* Subtle Monospace Telemetry Marker */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
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
                            {isScCritical && !isActive && (
                              <img
                                src="/icons/critical.png"
                                alt="Critical"
                                title="Critical Severity"
                                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                              />
                            )}
                            {isScWarning && !isActive && (
                              <img
                                src="/icons/warning.png"
                                alt="Warning"
                                title="Warning Severity"
                                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── TAB 2: INDIVIDUAL CREW SCENARIOS (Targeted Clinical) ── */}
              {scopeTab === 'INDIVIDUAL' && (
                <>
                  {/* Crew Selector Deck */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>
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
                              background: isSelected ? 'rgba(56, 189, 248, 0.10)' : 'rgba(255, 255, 255, 0.02)',
                              border: isSelected ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.07)',
                              color: isSelected ? '#ffffff' : '#94a3b8',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.16s ease',
                              fontFamily: "'Tomorrow', sans-serif",
                              boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.2)' : 'none',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 5px',
                                borderRadius: '4px',
                                background: isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)',
                                color: isSelected ? '#030712' : '#94a3b8',
                                flexShrink: 0,
                              }}
                            >
                              {crew.callsign}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                              <span style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#ffffff' : '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {crew.name}
                              </span>
                              <span style={{ fontSize: '9.5px', color: isSelected ? '#38bdf8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                            color: isCatSelected ? '#ffffff' : '#64748b',
                            background: isCatSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            border: isCatSelected
                              ? '1px solid rgba(255, 255, 255, 0.18)'
                              : '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                            fontFamily: "'Tomorrow', sans-serif",
                          }}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Individual Scenarios Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
                              ? (isScCritical ? 'rgba(244, 63, 94, 0.10)' : isScWarning ? 'rgba(245, 158, 11, 0.10)' : 'rgba(56, 189, 248, 0.10)')
                              : 'rgba(255, 255, 255, 0.02)',
                            border: isTargetActive
                              ? `1.5px solid ${cardThemeColor}`
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.16s ease',
                            minHeight: '84px',
                            gap: '6px',
                            boxShadow: isTargetActive ? `0 0 16px ${cardThemeColor}40` : 'none',
                            fontFamily: "'Tomorrow', sans-serif",
                          }}
                          onMouseEnter={(e) => {
                            if (!isTargetActive) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                            handleCardMouseEnter(e, sc);
                          }}
                          onMouseLeave={(e) => {
                            if (!isTargetActive) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.transform = 'none';
                            }
                            handleCardMouseLeave();
                          }}
                        >
                          {/* Card Header: Title + Status/Category */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 700,
                                color: '#ffffff',
                                letterSpacing: '0.02em',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {sc.label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                              {isTriggering ? (
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8' }}>
                                  [SYNCING]
                                </span>
                              ) : isTargetActive ? (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    color: '#030712',
                                    background: cardThemeColor,
                                    padding: '1px 7px',
                                    borderRadius: '3px',
                                    border: `1px solid ${cardThemeColor}`,
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  ● ACTIVE
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 600,
                                    color: '#94a3b8',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '1px 6px',
                                    borderRadius: '3px',
                                    letterSpacing: '0.03em',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {formatCategoryShort(sc.category)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Plain-English Description */}
                          <div style={{ width: '100%' }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '1.45',
                                color: '#94a3b8',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                transition: 'color 0.15s ease',
                              }}
                            >
                              {sc.description}
                            </p>
                          </div>

                          {/* Subtle Monospace Telemetry Marker */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
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
                            {isScCritical && !isTargetActive && (
                              <img
                                src="/icons/critical.png"
                                alt="Critical"
                                title="Critical Severity"
                                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                              />
                            )}
                            {isScWarning && !isTargetActive && (
                              <img
                                src="/icons/warning.png"
                                alt="Warning"
                                title="Warning Severity"
                                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
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
                      fontWeight: 800,
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
                  }}
                >
                  {activeScenarioMeta.description}
                  {activeScenarioMeta.physiologicalShift && (
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
                : 'translate(-50%, 0)',
            zIndex: 100000,
            width: '340px',
            maxWidth: 'calc(100vw - 32px)',
            pointerEvents: 'none',
            background: 'rgba(11, 15, 25, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid #facc15',
            borderRadius: '8px',
            padding: '12px 14px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.95), 0 0 16px rgba(250, 204, 21, 0.25)',
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
                fontWeight: 800,
                color: '#ffffff',
                opacity: 1,
                letterSpacing: '0.02em',
                lineHeight: 1.3,
              }}
            >
              {activeTooltip.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {formatCategoryShort(activeTooltip.category)}
              </span>
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
              fontWeight: 500,
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '8px 10px',
              borderRadius: '5px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {activeTooltip.description}
          </div>

          {/* Physiological Shift Details */}
          {activeTooltip.physiologicalShift && (
            <div
              style={{
                fontSize: '11px',
                lineHeight: 1.45,
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#94a3b8',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                Shift:
              </span>
              <span style={{ color: '#f1f5f9', opacity: 0.95 }}>
                {activeTooltip.physiologicalShift}
              </span>
            </div>
          )}

          {/* Telemetry Badge Footer */}
          <div
            style={{
              paddingTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
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
          </div>

          {/* Caret arrow pointing to the anchor */}
          <div
            style={{
              position: 'absolute',
              left: `calc(50% + ${activeTooltip.caretOffset}px)`,
              transform: 'translateX(-50%)',
              ...(activeTooltip.placement === 'top'
                ? {
                  bottom: '-6px',
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid #facc15',
                  filter: 'drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6))',
                }
                : {
                  top: '-6px',
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderBottom: '6px solid #facc15',
                  filter: 'drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.6))',
                }),
              width: 0,
              height: 0,
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};
