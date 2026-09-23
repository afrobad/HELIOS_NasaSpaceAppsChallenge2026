import React, { useState } from 'react';

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
  description: string;
}

const SCENARIOS: ScenarioMeta[] = [
  {
    key: 'NOMINAL_CRUISE',
    label: '1. NOMINAL CRUISE',
    badge: 'BASELINE',
    description: 'All crew vitals within baseline range. Systems green.',
  },
  {
    key: 'SCENARIO_1_BASELINE_DRIFT',
    label: '2. FATIGUE DRIFT',
    badge: 'DRIFT',
    description: 'Sleep debt causing elevated resting heart rate during rest cycles.',
  },
  {
    key: 'SCENARIO_2_WORKOUT_GATING',
    label: '3. WORKOUT GATING',
    badge: 'EXERCISE',
    description: 'Elevated HR during exercise is gated to prevent false alarms.',
  },
  {
    key: 'SCENARIO_3_CO2_HYPOXIA',
    label: '4. CO₂ / HYPOXIA',
    badge: 'CRITICAL',
    description: 'CO₂ rising and SpO₂ dropping — JARVIS triggers vessel-wide triage.',
  },
  {
    key: 'SCENARIO_4_DEEP_SPACE_BLACKOUT',
    label: '5. MARS BLACKOUT',
    badge: '22M DELAY',
    description: 'Comms blackout activates autonomous decision-making without Earth link.',
  },
  {
    key: 'SCENARIO_5_PRESYMPTOMATIC_SEPSIS',
    label: '6. SILENT SEPSIS',
    badge: 'CYTOKINE',
    description: 'Subclinical IL-6 surge & autonomic uncoupling detected hours before fever.',
  },
  {
    key: 'SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA',
    label: '7. HYPOKALEMIA',
    badge: 'QTc EXPANSION',
    description: 'Microgravity renal K+ wasting & dynamic Fridericia QTc > 480ms ventricular vulnerability.',
  },
  {
    key: 'SCENARIO_7_VENOUS_THROMBOSIS_RISK',
    label: '8. VENOUS CLOT',
    badge: 'IJV STASIS',
    description: 'Cephalic hemoconcentration (Hct 52%) & hypercoagulability modeling 2020 ISS incident.',
  },
  {
    key: 'SCENARIO_8_SOLAR_RADIATION_STORM',
    label: '9. SOLAR STORM',
    badge: 'ARS BIODOSIMETRY',
    description: 'Coronal mass ejection radiation surge & lymphocyte depletion — storm shelter protocol.',
  },
];


export const ScenarioController: React.FC<ScenarioControllerProps> = ({
  currentScenario,
  marsDelay,
  onToggleMarsDelay,
  onScenarioTriggered,
}) => {
  const [triggeringKey, setTriggeringKey] = useState<string | null>(null);

  const handleTrigger = async (key: string) => {
    setTriggeringKey(key);
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
    SCENARIOS.find((s) => s.key === currentScenario) || SCENARIOS[0];

  return (
    <div className="hud-panel" style={{ marginBottom: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--hud-border-subtle)',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
            SCENARIOS
          </span>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--hud-text-dim)' }}>
          ACTIVE:{' '}
          <span style={{ color: 'var(--hud-orange)', fontWeight: 700 }}>
            {activeScenarioMeta.label}
          </span>
        </div>
      </div>

      {/* Scenario Buttons Grid (Minimal Rectangular Buttons, High-Contrast Orange Active) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {SCENARIOS.map((sc) => {
          const isActive =
            currentScenario === sc.key ||
            (sc.key === 'SCENARIO_4_DEEP_SPACE_BLACKOUT' && marsDelay);
          const isTriggering = triggeringKey === sc.key;

          return (
            <button
              key={sc.key}
              onClick={() => handleTrigger(sc.key)}
              className={`hud-btn ${isActive ? 'hud-btn-active' : ''}`}
              style={{
                justifyContent: 'flex-start',
                padding: '8px 12px',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-mono-tabular" style={{ fontSize: '12px', fontWeight: 700 }}>
                    {sc.label}
                  </span>
                  {isTriggering && (
                    <span style={{ fontSize: '10px', color: '#fff' }}>[SYNC]</span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    color: isActive ? 'rgba(255, 255, 255, 0.85)' : 'var(--hud-text-dim)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {sc.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Scenario Context Description Bar */}
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--hud-bg-card)',
          borderRadius: 'var(--hud-radius-btn)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
        }}
      >
        <span style={{ color: 'var(--hud-orange)', fontWeight: 700, fontSize: '11px' }}>
          CONTEXT:
        </span>
        <span style={{ color: 'var(--hud-text-secondary)' }}>
          {activeScenarioMeta.description}
        </span>
      </div>
    </div>
  );
};
