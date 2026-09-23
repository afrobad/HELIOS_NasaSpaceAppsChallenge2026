import React from 'react';
import type { TelemetryPacket } from '../types/telemetry';
import { EcgRowCanvas } from './EcgRowCanvas';

interface CrewGridProps {
  telemetryMap: Record<string, TelemetryPacket>;
  onOpenTriage: (astId: string) => void;
}

const CREW_METADATA = [
  { id: 'AST-01_COMMANDER', name: 'Cmndr Haley', role: 'Mission Commander', age: 38 },
  { id: 'AST-02_PILOT', name: 'Pilot Chris', role: 'Flight Pilot', age: 42 },
  {
    id: 'AST-03_MEDICAL',
    altId: 'AST-03_MEDICAL_SPECIALIST',
    name: 'Dr. Sian',
    role: 'Medical Specialist',
    age: 29,
  },
  {
    id: 'AST-04_ENGINEER',
    altId: 'AST-04_MISSION_SPECIALIST',
    name: 'Specialist Leo',
    role: 'Systems Engineer',
    age: 45,
  },
];

// ─── Status badge renderers ─────────────────────────────────────────────────

const renderMissionBadge = (stateRaw?: string) => {
  const state = (stateRaw || 'REST').toUpperCase();
  const configs: Record<string, { color: string; border: string; bg: string; label: string; iconPath: string }> = {
    WORKOUT: {
      color: '#38bdf8',
      border: 'rgba(56,189,248,0.35)',
      bg: 'rgba(56,189,248,0.08)',
      label: 'WORKOUT',
      iconPath: 'M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12',
    },
    SLEEP: {
      color: '#a5b4fc',
      border: 'rgba(165,180,252,0.35)',
      bg: 'rgba(165,180,252,0.08)',
      label: 'SLEEP',
      iconPath: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    },
    EVA: {
      color: '#c084fc',
      border: 'rgba(192,132,252,0.35)',
      bg: 'rgba(192,132,252,0.08)',
      label: 'EVA',
      iconPath: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    },
    REST: {
      color: '#94a3b8',
      border: 'rgba(148,163,184,0.25)',
      bg: 'rgba(148,163,184,0.08)',
      label: 'REST',
      iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2',
    },
  };
  const cfg = configs[state] || configs['REST'];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d={cfg.iconPath} />
      </svg>
      {cfg.label}
    </span>
  );
};

const renderSeverityBadge = (severityRaw: string) => {
  const sev = (severityRaw || 'NOMINAL').toUpperCase();
  if (sev === 'CRITICAL') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.45)',
          background: 'rgba(239,68,68,0.12)',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        CRITICAL
      </span>
    );
  }
  if (sev === 'WARNING') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: '#ff7700',
          border: '1px solid rgba(255,119,0,0.4)',
          background: 'rgba(255,119,0,0.1)',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        WARNING
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: '#10b981',
        border: '1px solid rgba(16,185,129,0.35)',
        background: 'rgba(16,185,129,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      NOMINAL
    </span>
  );
};

// ─── Main CrewGrid ──────────────────────────────────────────────────────────

export const CrewGrid: React.FC<CrewGridProps> = ({ telemetryMap, onOpenTriage }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      {CREW_METADATA.map((crew) => {
        const telemetry =
          telemetryMap[crew.id] ||
          (crew.altId ? telemetryMap[crew.altId] : undefined);
        const severity = telemetry?.evaluated_severity || 'NOMINAL';
        const isWarning = severity === 'WARNING';
        const isCritical = severity === 'CRITICAL';

        const borderColor = isCritical
          ? 'var(--hud-critical)'
          : isWarning
          ? 'rgba(255, 119, 0, 0.45)'
          : 'var(--hud-border)';

        return (
          <div
            key={crew.id}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: '0',
              background: 'var(--hud-bg-card)',
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--hud-radius-card)',
              overflow: 'hidden',
              // Pulse red glow on critical
              boxShadow: isCritical
                ? '0 0 0 1px rgba(239, 68, 68, 0.15), 0 2px 16px rgba(239, 68, 68, 0.08)'
                : isWarning
                ? '0 0 0 1px rgba(255, 119, 0, 0.10)'
                : 'none',
              transition: 'box-shadow 200ms ease, border-color 200ms ease',
            }}
          >
            {/* ── LEFT: Crew telemetry card ─────────────────────────────── */}
            <div
              style={{
                width: '430px',
                flexShrink: 0,
                padding: '15px 18px',
                borderRight: '1px solid var(--hud-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  paddingBottom: '9px',
                  borderBottom: '1px solid var(--hud-border-subtle)',
                  marginBottom: '11px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {crew.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(148, 163, 184, 0.85)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {crew.role}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {renderMissionBadge(telemetry?.mission_state)}
                  {renderSeverityBadge(severity)}
                </div>
              </div>

              {/* Vitals 2×2 grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  columnGap: '14px',
                  rowGap: '10px',
                  marginBottom: '11px',
                }}
              >
                {/* Heart Rate */}
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(148, 163, 184, 0.8)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    HEART RATE
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '3px',
                      marginTop: '2px',
                    }}
                  >
                    <span
                      className="font-mono-tabular"
                      style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color:
                          (telemetry?.heart_rate ?? 62) > 100
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry ? telemetry.heart_rate.toFixed(0) : '62'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.75)' }}>
                      BPM
                    </span>
                  </div>
                </div>

                {/* HRV */}
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(148, 163, 184, 0.8)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    HRV
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '3px',
                      marginTop: '2px',
                    }}
                  >
                    <span
                      className="font-mono-tabular"
                      style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff' }}
                    >
                      {telemetry ? telemetry.hrv_rmssd.toFixed(0) : '65'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.75)' }}>
                      ms
                    </span>
                  </div>
                </div>

                {/* SpO2 */}
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(148, 163, 184, 0.8)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      lineHeight: 1,
                    }}
                  >
                    SpO<sub style={{ fontSize: '7px', verticalAlign: 'baseline', position: 'relative', top: '1px' }}>2</sub>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '3px',
                      marginTop: '2px',
                    }}
                  >
                    <span
                      className="font-mono-tabular"
                      style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color:
                          (telemetry?.spo2 ?? 98) < 95
                            ? 'var(--hud-critical)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry ? telemetry.spo2.toFixed(1) : '98.2'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.75)' }}>
                      %
                    </span>
                  </div>
                </div>

                {/* Core Temp */}
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(148, 163, 184, 0.8)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    CORE TEMP
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '3px',
                      marginTop: '2px',
                    }}
                  >
                    <span
                      className="font-mono-tabular"
                      style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff' }}
                    >
                      {telemetry ? telemetry.core_temp.toFixed(1) : '36.8'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.75)' }}>
                      °C
                    </span>
                  </div>
                </div>
              </div>

              {/* POC Labs biomarker strip */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid var(--hud-border-subtle)',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  marginBottom: '9px',
                  fontSize: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                    color: 'var(--hud-text-dim)',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    gap: '6px',
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap', fontSize: '10px', color: 'rgba(148, 163, 184, 0.8)' }}>POC LABS</span>
                  {telemetry?.computed_rsi &&
                  (telemetry.computed_rsi >= 0.35 ||
                    (telemetry.radiation_flux && telemetry.radiation_flux >= 10.0)) ? (
                    <span
                      className="font-mono-tabular"
                      style={{
                        color:
                          telemetry.computed_rsi >= 1.0
                            ? 'var(--hud-critical)'
                            : 'var(--hud-orange)',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        fontSize: '10px',
                      }}
                    >
                      RSI {telemetry.computed_rsi.toFixed(2)}
                    </span>
                  ) : telemetry?.computed_epi && telemetry.computed_epi >= 0.9 ? (
                    <span
                      className="font-mono-tabular"
                      style={{
                        color: 'var(--hud-critical)',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        fontSize: '10px',
                      }}
                    >
                      EPI {telemetry.computed_epi.toFixed(2)}
                    </span>
                  ) : (
                    <span
                      style={{
                        color: 'var(--hud-nominal)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        fontSize: '10px',
                      }}
                    >
                      NOMINAL
                    </span>
                  )}
                </div>

                {/* Biomarker row 1 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '4px',
                    textAlign: 'left',
                    marginBottom: '4px',
                    fontSize: '9px',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>K⁺</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.potassium ?? 4.2) < 3.5
                            ? 'var(--hud-critical)'
                            : (telemetry?.potassium ?? 4.2) < 3.8
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.potassium ? telemetry.potassium.toFixed(2) : '4.20'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>IL-6</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.il_6 ?? 6.2) >= 15.0
                            ? 'var(--hud-critical)'
                            : (telemetry?.il_6 ?? 6.2) >= 10.0
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.il_6 ? telemetry.il_6.toFixed(1) : '6.2'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>HCT</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.hematocrit ?? 44.0) >= 50.0
                            ? 'var(--hud-critical)'
                            : (telemetry?.hematocrit ?? 44.0) >= 48.0
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.hematocrit ? telemetry.hematocrit.toFixed(1) : '44.0'}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>WBC</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.wbc_count ?? 6.8) >= 14.0 ||
                          (telemetry?.wbc_count ?? 6.8) < 3.0
                            ? 'var(--hud-critical)'
                            : (telemetry?.wbc_count ?? 6.8) >= 11.0
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.wbc_count ? telemetry.wbc_count.toFixed(1) : '6.8'}k
                    </div>
                  </div>
                </div>

                {/* Biomarker row 2 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '4px',
                    textAlign: 'left',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '4px',
                    fontSize: '9px',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>FLUX</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.radiation_flux ?? 0.05) >= 100.0
                            ? 'var(--hud-critical)'
                            : (telemetry?.radiation_flux ?? 0.05) >= 10.0
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.radiation_flux !== undefined
                        ? telemetry.radiation_flux >= 1.0
                          ? telemetry.radiation_flux.toFixed(0)
                          : telemetry.radiation_flux.toFixed(2)
                        : '0.05'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>ALC</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.lymphocyte_count ?? 2.2) < 1.0
                            ? 'var(--hud-critical)'
                            : (telemetry?.lymphocyte_count ?? 2.2) < 1.5
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.lymphocyte_count
                        ? telemetry.lymphocyte_count.toFixed(1)
                        : '2.2'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>DOSE</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.radiation_dose_gy ?? 0) >= 1.0
                            ? 'var(--hud-critical)'
                            : (telemetry?.radiation_dose_gy ?? 0) >= 0.5
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.radiation_dose_gy !== undefined
                        ? `${telemetry.radiation_dose_gy.toFixed(2)}Gy`
                        : '0.00Gy'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--hud-text-dim)' }}>PLT</div>
                    <div
                      className="font-mono-tabular"
                      style={{
                        fontWeight: 700,
                        color:
                          (telemetry?.platelet_count ?? 240.0) >= 380.0 ||
                          (telemetry?.platelet_count ?? 240.0) < 100.0
                            ? 'var(--hud-critical)'
                            : (telemetry?.platelet_count ?? 240.0) >= 320.0
                            ? 'var(--hud-orange)'
                            : '#ffffff',
                      }}
                    >
                      {telemetry?.platelet_count
                        ? telemetry.platelet_count.toFixed(0)
                        : '240'}
                      k
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Z-score + Triage button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '7px',
                  borderTop: '1px solid var(--hud-border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.75)' }}>
                  {telemetry && Math.abs(telemetry.z_score_hr) >= 1.5 ? (
                    <span
                      className="font-mono-tabular"
                      style={{ color: 'var(--hud-orange)', fontWeight: 600 }}
                    >
                      Δ{' '}
                      {telemetry.z_score_hr >= 0
                        ? `+${telemetry.z_score_hr.toFixed(1)}σ`
                        : `${telemetry.z_score_hr.toFixed(1)}σ`}
                    </span>
                  ) : (
                    <span>BASELINE</span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTriage(crew.id);
                  }}
                  className="hud-btn"
                  style={{ padding: '3px 10px', minHeight: '24px', fontSize: '10px' }}
                >
                  TRIAGE
                </button>
              </div>
            </div>

            {/* ── RIGHT: Inline ECG canvas ─────────────────────────────── */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 12px',
                gap: '0',
              }}
            >
              {/* Row title */}
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'rgba(148, 163, 184, 0.75)',
                  letterSpacing: '0.06em',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>BIOMETRIC WAVEFORM</span>
                <span
                  style={{
                    fontSize: '9px',
                    color: '#3d4f6a',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                  }}
                >
                  · Real-time 10 Hz Feed
                </span>
              </div>

              {/* ECG row canvas — fills remaining height */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <EcgRowCanvas
                  astronautId={crew.id}
                  altAstronautId={crew.altId}
                  height={130}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
