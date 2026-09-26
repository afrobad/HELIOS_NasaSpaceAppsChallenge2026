import React, { useState } from 'react';
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
}

const CriticalHexagonIcon: React.FC<{ color?: string; size?: number }> = ({ color = '#ef4444', size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path
      d="M8 1.2L14.5 4.8V11.2L8 14.8L1.5 11.2V4.8L8 1.2Z"
      stroke={color}
      strokeWidth="1.6"
      strokeLinejoin="round"
      fill={color === '#000000' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(239, 68, 68, 0.12)'}
    />
    <line x1="8" y1="4.8" x2="8" y2="9.2" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="8" cy="11.8" r="0.9" fill={color} />
  </svg>
);

const WarningTriangleIcon: React.FC<{ color?: string; size?: number }> = ({ color = '#eab308', size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path
      d="M8 1.8L14.8 13.8H1.2L8 1.8Z"
      stroke={color}
      strokeWidth="1.6"
      strokeLinejoin="round"
      fill={color === '#000000' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(234, 179, 8, 0.12)'}
    />
    <line x1="8" y1="5.8" x2="8" y2="9.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="8" cy="11.9" r="0.9" fill={color} />
  </svg>
);

const SCENARIOS: ScenarioMeta[] = [
  // ── Life Support & Cabin (Scenarios 1-5) ──
  {
    key: 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH',
    label: '1. CO₂ Scrubber Leak',
    badge: 'Air quality',
    category: 'ENVIRONMENT',
    description: 'Cabin carbon dioxide rises above safety limits; switch to secondary scrubbers.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA',
    label: '2. Cabin Decompression',
    badge: 'Pressure drop',
    category: 'ENVIRONMENT',
    description: 'Cabin air pressure drops and oxygen falls; don oxygen masks and seal bulkheads.',
    severity: 'CRITICAL',
  },
  {
    key: 'SCENARIO_3_SOLAR_RADIATION_STORM',
    label: '3. Solar Radiation Storm',
    badge: 'Cosmic flux',
    category: 'ENVIRONMENT',
    description: 'Energetic solar proton event; evacuate crew into the water-shielded shelter.',
    severity: 'CRITICAL',
  },
  {
    key: 'SCENARIO_4_AMMONIA_COOLANT_LEAK',
    label: '4. Ammonia Coolant Leak',
    badge: 'Toxic ingress',
    category: 'ENVIRONMENT',
    description: 'External coolant breach into cabin atmosphere; don respirator masks and isolate loop.',
    severity: 'CRITICAL',
  },
  {
    key: 'SCENARIO_5_ELECTRICAL_FIRE_SMOLDER',
    label: '5. Electrical Fire Smolder',
    badge: 'Avionics smoke',
    category: 'ENVIRONMENT',
    description: 'Smoldering wiring harness in electronics bay; cut power bus and inspect panel.',
    severity: 'WARNING',
  },

  // ── Cardiovascular & Electrophysiology (Scenarios 6-9) ──
  {
    key: 'SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA',
    label: '6. Low Potassium / Arrhythmia',
    badge: 'QTc expansion',
    category: 'CARDIO',
    description: 'Potassium drops below safe threshold; drink oral potassium and monitor heart rhythm.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_7_VENOUS_THROMBOSIS_RISK',
    label: '7. Jugular Vein Blood Clot',
    badge: 'Neck stasis',
    category: 'CARDIO',
    description: 'Zero-gravity headward fluid pooling slows neck vein blood flow; don thigh cuffs.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_8_CARDIOVASCULAR_DECONDITIONING',
    label: '8. Heart Deconditioning',
    badge: 'Pulse spike',
    category: 'CARDIO',
    description: 'Resting pulse climbs during light effort; increase daily cycle exercise duration.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_9_CORONARY_MICROVASCULAR_STRESS',
    label: '9. Cardiac Vessel Stress',
    badge: 'Vessel strain',
    category: 'CARDIO',
    description: 'Heart blood vessels under strain; take chewable baby aspirin and enforce rest in cabin.',
    severity: 'WARNING',
  },

  // ── Infection & Immune System (Scenarios 10-13) ──
  {
    key: 'SCENARIO_10_PRESYMPTOMATIC_SEPSIS',
    label: '10. Early Silent Infection',
    badge: 'Cytokine surge',
    category: 'IMMUNE',
    description: 'Immune signals surge hours ahead of fever; start oral fluids and early medication.',
    severity: 'CRITICAL',
  },
  {
    key: 'SCENARIO_11_LATENT_VIRUS_REACTIVATION',
    label: '11. Dormant Virus Reactivation',
    badge: 'Immune dip',
    category: 'IMMUNE',
    description: 'Deep-space radiation wakes dormant virus; start antiviral tablets and sleep schedule.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_12_CYTOKINE_RELEASE_STORM',
    label: '12. Inflammatory Cytokine Storm',
    badge: 'Hyper-inflammation',
    category: 'IMMUNE',
    description: 'Immune chemicals spike into acute systemic overdrive; administer anti-inflammatories.',
    severity: 'CRITICAL',
  },
  {
    key: 'SCENARIO_13_RADIATION_MARROW_EXHAUSTION',
    label: '13. Marrow Radiation Fatigue',
    badge: 'White cell drop',
    category: 'IMMUNE',
    description: 'White blood cells deplete after radiation exposure; initiate protective immune care.',
    severity: 'WARNING',
  },

  // ── Metabolic, SANS & Fluids (Scenarios 14-18) ──
  {
    key: 'SCENARIO_14_NEPHROLITHIASIS',
    label: '14. Kidney Stone Risk',
    badge: 'Renal calcium',
    category: 'METABOLIC',
    description: 'Bone calcium loss concentrates in urine; drink 3 liters of water and take citrate.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_15_INTRAVASCULAR_DEHYDRATION',
    label: '15. Severe Dehydration',
    badge: 'Blood thickening',
    category: 'METABOLIC',
    description: 'Blood volume drops and thickens; drink balanced electrolyte fluids and lie flat.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_16_HEPATIC_METABOLIC_DYSFUNCTION',
    label: '16. Metabolic Clearance Stress',
    badge: 'Liver slowdown',
    category: 'METABOLIC',
    description: 'Liver medication clearance slows under radiation; recalibrate drug dosages.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_17_SPACE_VISION_SANS',
    label: '17. Eye Vision SANS Shift',
    badge: 'Optic pressure',
    category: 'METABOLIC',
    description: 'Headward fluid pressure stresses optic nerves; apply lower body negative pressure.',
    severity: 'WARNING',
  },
  {
    key: 'SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT',
    label: '18. Chronic Sleep Debt',
    badge: 'Fatigue drift',
    category: 'METABOLIC',
    description: 'Cumulative sleep loss elevates resting heart rate; enforce 8 hours of quiet dark rest.',
    severity: 'WARNING',
  },
];

type CategoryKey = 'ALL' | 'ENVIRONMENT' | 'CARDIO' | 'IMMUNE' | 'METABOLIC';

const CATEGORY_TABS: { key: CategoryKey; label: string; count: number }[] = [
  { key: 'ALL', label: 'All scenarios', count: 18 },
  { key: 'ENVIRONMENT', label: 'Cabin & air', count: 5 },
  { key: 'CARDIO', label: 'Cardio & rhythm', count: 4 },
  { key: 'IMMUNE', label: 'Immune & infection', count: 4 },
  { key: 'METABOLIC', label: 'Metabolic & SANS', count: 5 },
];

export const ScenarioController: React.FC<ScenarioControllerProps> = ({
  currentScenario,
  marsDelay,
  onToggleMarsDelay,
  onScenarioTriggered,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('ALL');
  const [triggeringKey, setTriggeringKey] = useState<string | null>(null);

  const handleTrigger = async (key: string) => {
    setTriggeringKey(key);
    audioService.stopSpeaking();
    try {
      if (key === 'SCENARIO_4_DEEP_SPACE_BLACKOUT') {
        onToggleMarsDelay(true);
      } else if (key === 'NOMINAL_CRUISE' && marsDelay) {
        onToggleMarsDelay(false);
      }

      const res = await fetch(`/api/scenario/${key}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (onScenarioTriggered) {
          onScenarioTriggered(key, data?.telemetry);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setTimeout(() => setTriggeringKey(null), 300);
    }
  };

  const activeScenarioMeta =
    SCENARIOS.find(
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
    };

  const visibleScenarios =
    activeCategory === 'ALL'
      ? SCENARIOS
      : SCENARIOS.filter((s) => s.category === activeCategory);

  const isNominalActive = currentScenario === 'NOMINAL_CRUISE';

  return (
    <div className="hud-panel" style={{ marginBottom: '16px', fontFamily: "'Tomorrow', sans-serif" }}>
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--hud-border-subtle)',
          marginBottom: '10px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em', fontFamily: "'Tomorrow', sans-serif" }}>
            SIMULATION SCENARIOS
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 107, 53, 0.15)',
              color: 'var(--hud-orange)',
              fontWeight: 500,
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            18
          </span>
        </div>

        {/* Quick Reset to Nominal Cruise */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => handleTrigger('NOMINAL_CRUISE')}
            className={`hud-btn ${isNominalActive ? 'hud-btn-active' : ''}`}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              background: isNominalActive ? 'var(--hud-orange)' : 'rgba(255, 255, 255, 0.05)',
              color: isNominalActive ? '#000000' : 'var(--hud-text-secondary)',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            RESET TO NOMINAL
          </button>
        </div>
      </div>

      {/* Category Tabs - Minimalized Contrast */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '10px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {CATEGORY_TABS.map((tab) => {
          const isSelected = activeCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              style={{
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                background: isSelected ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                border: isSelected
                  ? '1px solid rgba(255, 255, 255, 0.12)'
                  : '1px solid transparent',
                borderRadius: '4px',
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

      {/* Scenario Buttons Grid (No border outlines on left, crisp indicators with icons) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '8px',
          marginBottom: '12px',
          maxHeight: '260px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {visibleScenarios.map((sc) => {
          const isActive =
            currentScenario === sc.key ||
            (sc.key === 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH' && currentScenario === 'SCENARIO_3_CO2_HYPOXIA') ||
            (sc.key === 'SCENARIO_3_SOLAR_RADIATION_STORM' && currentScenario === 'SCENARIO_8_SOLAR_RADIATION_STORM') ||
            (sc.key === 'SCENARIO_10_PRESYMPTOMATIC_SEPSIS' && currentScenario === 'SCENARIO_5_PRESYMPTOMATIC_SEPSIS') ||
            (sc.key === 'SCENARIO_18_CIRCADIAN_FATIGUE_DRIFT' && currentScenario === 'SCENARIO_1_BASELINE_DRIFT');

          const isTriggering = triggeringKey === sc.key;
          const isCritical = sc.severity === 'CRITICAL';

          return (
            <button
              key={sc.key}
              onClick={() => handleTrigger(sc.key)}
              className={`hud-btn ${isActive ? 'hud-btn-active' : ''}`}
              style={{
                justifyContent: 'flex-start',
                padding: '8px 10px',
                textAlign: 'left',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isActive ? '#000000' : '#ffffff',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      fontFamily: "'Tomorrow', sans-serif",
                    }}
                  >
                    {sc.label}
                  </span>
                  {isTriggering && (
                    <span style={{ fontSize: '9px', color: isActive ? '#000' : 'var(--hud-orange)', fontFamily: "'Tomorrow', sans-serif" }}>
                      [SYNC]
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      color: isActive ? 'rgba(0, 0, 0, 0.75)' : 'var(--hud-text-dim)',
                      letterSpacing: '0.01em',
                      fontFamily: "'Tomorrow', sans-serif",
                    }}
                  >
                    {sc.badge}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {isCritical ? (
                      <CriticalHexagonIcon color={isActive ? '#000000' : '#ef4444'} size={13} />
                    ) : (
                      <WarningTriangleIcon color={isActive ? '#000000' : '#eab308'} size={13} />
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Scenario Context Description Bar (No left border, non-uppercase description) */}
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--hud-bg-card)',
          borderRadius: 'var(--hud-radius-btn)',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
          fontFamily: "'Tomorrow', sans-serif",
        }}
      >
        <span style={{ color: 'var(--hud-orange)', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: "'Tomorrow', sans-serif" }}>
          Active: {activeScenarioMeta.label}
        </span>
        <span style={{ color: 'var(--hud-text-secondary)', fontSize: '11px', fontFamily: "'Tomorrow', sans-serif" }}>
          {activeScenarioMeta.description}
        </span>
      </div>
    </div>
  );
};


