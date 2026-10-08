import React, { useMemo } from 'react';
import type { TelemetryPacket } from '../types/telemetry';
import { EcgRowCanvas } from './EcgRowCanvas';
import { getAstronautOsdrProfile } from './HealthTelemetryView';
import { evaluateCrewClinicalSummary } from '../utils/clinicalPrioritization';
import { useStabilizedClinicalSummary } from '../hooks/useStabilizedClinicalSummary';

interface CrewGridProps {
  telemetryMap: Record<string, TelemetryPacket>;
  onOpenTriage: (astId: string) => void;
}

interface CrewMetadataItem {
  id: string;
  altId?: string;
  name: string;
  role: string;
  roleShort: string;
  callsign: string;
  avatar: string;
  age: number;
}

const CREW_METADATA: CrewMetadataItem[] = [
  {
    id: 'AST-01_COMMANDER',
    name: 'Cmndr Haley',
    callsign: 'HALEY',
    role: 'Mission Commander',
    roleShort: 'CDR',
    avatar: '/crew/haley.jpg',
    age: 38,
  },
  {
    id: 'AST-02_PILOT',
    name: 'Pilot Chris',
    callsign: 'CHRIS',
    role: 'Flight Pilot',
    roleShort: 'PLT',
    avatar: '/crew/chris.jpg',
    age: 42,
  },
  {
    id: 'AST-03_MEDICAL',
    altId: 'AST-03_MEDICAL_SPECIALIST',
    name: 'Dr. Sian',
    callsign: 'SIAN',
    role: 'Medical Specialist',
    roleShort: 'MED',
    avatar: '/crew/sian.jpg',
    age: 29,
  },
  {
    id: 'AST-04_ENGINEER',
    altId: 'AST-04_MISSION_SPECIALIST',
    name: 'Specialist Leo',
    callsign: 'LEO',
    role: 'Systems Engineer',
    roleShort: 'ENG',
    avatar: '/crew/leo.jpg',
    age: 45,
  },
];

// ─── Mission State Badge ───────────────────────────────────────────────────

const renderMissionBadge = (stateRaw?: string) => {
  const state = (stateRaw || 'REST').toUpperCase();
  const configs: Record<string, { color: string; border: string; bg: string; label: string; iconPath: string }> = {
    WORKOUT: {
      color: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.35)',
      bg: 'transparent',
      label: 'WORKOUT',
      iconPath: 'M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12',
    },
    SLEEP: {
      color: '#a5b4fc',
      border: 'rgba(165, 180, 252, 0.35)',
      bg: 'transparent',
      label: 'SLEEP',
      iconPath: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    },
    EVA: {
      color: '#c084fc',
      border: 'rgba(192, 132, 252, 0.35)',
      bg: 'transparent',
      label: 'EVA',
      iconPath: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    },
    REST: {
      color: '#94a3b8',
      border: 'rgba(148, 163, 184, 0.28)',
      bg: 'transparent',
      label: 'REST',
      iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2',
    },
  };
  const cfg = configs[state] || configs['REST'];
  return (
    <span
      className="hud-tooltip-trigger"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 7px',
        borderRadius: '9999px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        background: 'transparent',
        whiteSpace: 'nowrap',
        fontFamily: "'Tomorrow', sans-serif",
        cursor: 'default',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d={cfg.iconPath} />
      </svg>
      {cfg.label}
      <div className="hud-tooltip hud-tooltip-down">
        Mission Activity Phase · {cfg.label} protocol mode
      </div>
    </span>
  );
};

// ─── Main CrewGrid ──────────────────────────────────────────────────────────

interface CrewCardRowProps {
  crew: CrewMetadataItem;
  telemetry?: TelemetryPacket;
  onOpenTriage: (astId: string) => void;
}

const CrewCardRow: React.FC<CrewCardRowProps> = ({ crew, telemetry, onOpenTriage }) => {
  const profile = getAstronautOsdrProfile(crew.id);
  const rawSummary = useMemo(
    () => evaluateCrewClinicalSummary(crew.id, telemetry, profile),
    [crew.id, telemetry, profile]
  );
  // 1-second clinical state dwell time machine: prevents rapid view flipping from sensor noise
  const summary = useStabilizedClinicalSummary(crew.id, rawSummary, 1000);

  const isCritical = summary.severity === 'CRITICAL';
  const isWarning = summary.severity === 'WARNING';
  const isAbnormal = summary.isAbnormal;

  const borderColor = isCritical
    ? 'rgba(239, 68, 68, 0.45)'
    : isWarning
    ? 'rgba(245, 158, 11, 0.40)'
    : '#283548';

  const statusColor = isCritical
    ? '#ef4444'
    : isWarning
    ? '#f59e0b'
    : '#22c55e';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '0',
        background: isCritical
          ? 'linear-gradient(180deg, #1c1518 0%, #110d10 100%)'
          : isWarning
          ? 'linear-gradient(180deg, #1c1913 0%, #12100a 100%)'
          : 'linear-gradient(180deg, #181d22 0%, #0f1316 100%)',
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        overflow: 'hidden',
        boxSizing: 'border-box',
        minHeight: '176px',
        boxShadow: isCritical
          ? '0 0 0 1px rgba(239, 68, 68, 0.35), 0 4px 16px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : isWarning
          ? '0 0 0 1px rgba(245, 158, 11, 0.25), 0 4px 16px rgba(245, 158, 11, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 2px 10px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        transition: 'box-shadow 400ms ease, border-color 400ms ease, background 400ms ease',
      }}
    >
            {/* ── ZONE 1: INTEGRATED CREW IDENTITY & TRIAGE BLOCK ──────── */}
            <div
              style={{
                width: '124px',
                flexShrink: 0,
                padding: '10px 8px',
                borderRight: '1px solid #1f2732',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                textAlign: 'center',
                background: isCritical
                  ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.12) 0%, rgba(0, 0, 0, 0.4) 100%)'
                  : isWarning
                  ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.10) 0%, rgba(0, 0, 0, 0.4) 100%)'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.25) 100%)',
                boxSizing: 'border-box',
              }}
            >
              {/* Astronaut Avatar with Live Severity Glow Ring */}
              <div
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: `2px solid ${statusColor}`,
                  boxShadow: isCritical
                    ? '0 0 12px rgba(239, 68, 68, 0.50)'
                    : isWarning
                    ? '0 0 8px rgba(245, 158, 11, 0.40)'
                    : '0 0 6px rgba(34, 197, 94, 0.30)',
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
                    bottom: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    border: '1.5px solid #000000',
                    boxShadow: `0 0 4px ${statusColor}`,
                  }}
                />
              </div>

              {/* Callsign + Name + Role + Mission State */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 800,
                      color: '#ffffff',
                      letterSpacing: '0.04em',
                      fontFamily: "'Tomorrow', sans-serif",
                    }}
                  >
                    {crew.callsign}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'rgba(148, 163, 184, 0.90)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '110px',
                  }}
                >
                  {crew.name}
                </div>

                <div style={{ marginTop: '2px' }}>
                  {renderMissionBadge(telemetry?.mission_state)}
                </div>
              </div>

              {/* Action Button: Triage Alert vs Telemetry */}
              <div style={{ width: '100%', marginTop: '2px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTriage(crew.id);
                  }}
                  className="hud-btn"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    minHeight: '26px',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    borderRadius: '4px',
                    background: isCritical
                      ? 'rgba(250, 204, 21, 0.20)'
                      : isWarning
                      ? 'rgba(250, 204, 21, 0.14)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: isCritical
                      ? '1px solid rgba(250, 204, 21, 0.65)'
                      : isWarning
                      ? '1px solid rgba(250, 204, 21, 0.45)'
                      : '1px solid rgba(148, 163, 184, 0.35)',
                    color: isCritical
                      ? '#fde047'
                      : isWarning
                      ? '#facc15'
                      : '#f1f5f9',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                >
                  {isCritical || isWarning ? (
                    <>
                      <span>Triage Alert</span>
                      <span style={{ fontSize: '10px' }}>→</span>
                    </>
                  ) : (
                    <>
                      <span>Telemetry</span>
                      <span style={{ fontSize: '10px', opacity: 0.85 }}>→</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ── ZONE 2: ADAPTIVE DYNAMIC CLINICAL SUMMARY ────────────── */}
            <div
              style={{
                width: '335px',
                flexShrink: 0,
                padding: '10px 14px',
                borderRight: '1px solid var(--hud-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: isAbnormal ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.10)',
                boxSizing: 'border-box',
              }}
            >
              {/* Top Banner: Primary Clinical Concern vs Nominal Resting Profile */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    padding: summary.primaryConcern.bgColor === 'transparent' ? '2px 0' : '4px 8px',
                    borderRadius: '4px',
                    background: summary.primaryConcern.bgColor,
                    border: summary.primaryConcern.borderColor === 'transparent' ? 'none' : `1px solid ${summary.primaryConcern.borderColor}`,
                    marginBottom: '8px',
                  }}
                >
                  <div
                    className="hud-tooltip-trigger"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      overflow: 'hidden',
                      cursor: 'default',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: summary.primaryConcern.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: summary.primaryConcern.color,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily: "'Tomorrow', sans-serif",
                      }}
                    >
                      {summary.primaryConcern.title}
                    </span>
                    <div className="hud-tooltip hud-tooltip-down">
                      {isAbnormal
                        ? `Primary Clinical Concern · ${summary.primaryConcern.title}`
                        : 'Baseline Status · All biometrics aligned with nominal resting profile'}
                    </div>
                  </div>

                  <div
                    className="hud-tooltip-trigger"
                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: isCritical ? '#facc15' : isWarning ? '#fde047' : '#34d399',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        flexShrink: 0,
                        fontFamily: "'Tomorrow', sans-serif",
                        cursor: 'help',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      PRI {summary.physReserveIndex}%
                    </span>

                    {/* Rich Aerospace Hover Tooltip Showing Full Form & Dynamic Value */}
                    <div className="hud-tooltip hud-tooltip-down-right">
                      Physiological Reserve Index · Multi-organ metabolic resilience buffer ({summary.physReserveIndex}%)
                    </div>
                  </div>
                </div>

                {/* Adaptive Middle: Prioritized Biomarkers (Abnormal) OR Baseline Vitals (Nominal) */}
                {isAbnormal ? (
                  /* ABNORMAL: Prioritized 4 Deviating Biomarkers */
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '6px',
                    }}
                  >
                    {summary.prioritizedBiomarkers.map((bio, idx) => {
                      const isBioCrit = bio.tier === 'CRITICAL';
                      const isBioWarn = bio.tier === 'WARNING';
                      const valColor = isBioCrit
                        ? 'var(--hud-critical)'
                        : isBioWarn
                        ? 'var(--hud-orange)'
                        : '#ffffff';

                      const pillColor = isBioCrit
                        ? '#ef4444'
                        : isBioWarn
                        ? '#f59e0b'
                        : '#64748b';

                      const tooltipPositionClass = idx < 2
                        ? (idx % 2 === 0 ? 'hud-tooltip-down' : 'hud-tooltip-down-right')
                        : (idx % 2 === 0 ? 'hud-tooltip-up' : 'hud-tooltip-up-right');

                      return (
                        <div
                          key={bio.id}
                          className="hud-tooltip-trigger"
                          style={{
                            background: 'rgba(0, 0, 0, 0.40)',
                            border: `1px solid ${
                              isBioCrit
                                ? 'rgba(239, 68, 68, 0.35)'
                                : isBioWarn
                                ? 'rgba(245, 158, 11, 0.30)'
                                : 'rgba(255, 255, 255, 0.08)'
                            }`,
                            borderRadius: '5px',
                            padding: '5px 7px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            cursor: 'default',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'rgba(148, 163, 184, 0.85)',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {bio.symbol}
                            </span>
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '0 4px',
                                borderRadius: '2px',
                                color: pillColor,
                                background: `${pillColor}15`,
                                border: `1px solid ${pillColor}35`,
                              }}
                            >
                              {bio.tier === 'CRITICAL' ? 'CRIT' : bio.tier === 'WARNING' ? 'WARN' : 'DEV'}
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              justifyContent: 'space-between',
                              gap: '4px',
                            }}
                          >
                            <span
                              className="font-mono-tabular"
                              style={{
                                fontSize: '13px',
                                fontWeight: 800,
                                color: valColor,
                                lineHeight: 1.1,
                              }}
                            >
                              {bio.formattedValue}
                            </span>
                            <span
                              className="font-mono-tabular"
                              style={{
                                fontSize: '8.5px',
                                fontWeight: 600,
                                color: bio.deltaStr.includes('↑')
                                  ? '#f87171'
                                  : bio.deltaStr.includes('↓')
                                  ? '#38bdf8'
                                  : '#94a3b8',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {bio.deltaStr}
                            </span>
                          </div>

                          {/* Minimal 1-line signal tooltip with 250ms appearance delay */}
                          <div className={`hud-tooltip ${tooltipPositionClass}`}>
                            {bio.name} · {bio.clinicalMeaning} ({bio.deltaStr})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* NOMINAL: Clean 4-Primary Vitals — Minimal & Scannable */
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'rgba(148, 163, 184, 0.75)',
                        lineHeight: 1.35,
                      }}
                    >
                      All biometrics aligned with resting baseline.
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '5px',
                      }}
                    >
                      {/* HR */}
                      <div
                        className="hud-tooltip-trigger"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          borderRadius: '5px',
                          padding: '5px 7px',
                          cursor: 'default',
                        }}
                      >
                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>HR</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--hud-font-mono, monospace)', lineHeight: 1.1 }}>
                          {summary.nominalVitals.hr.val} <span style={{ fontSize: '8.5px', color: '#64748b' }}>bpm</span>
                        </div>
                        <div className="hud-tooltip hud-tooltip-down">
                          Heart Rate · Ventricular contractions per minute (Baseline: {profile.restHr} bpm)
                        </div>
                      </div>

                      {/* SpO2 */}
                      <div
                        className="hud-tooltip-trigger"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          borderRadius: '5px',
                          padding: '5px 7px',
                          cursor: 'default',
                        }}
                      >
                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>SpO₂</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--hud-font-mono, monospace)', lineHeight: 1.1 }}>
                          {Number(summary.nominalVitals.spo2.val).toFixed(1)}<span style={{ fontSize: '8.5px', color: '#64748b' }}>%</span>
                        </div>
                        <div className="hud-tooltip hud-tooltip-down">
                          Oxygen Saturation · Peripheral arterial blood oxygen fraction (Baseline: {Number(profile.restSpo2).toFixed(1)}%)
                        </div>
                      </div>

                      {/* TEMP */}
                      <div
                        className="hud-tooltip-trigger"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          borderRadius: '5px',
                          padding: '5px 7px',
                          cursor: 'default',
                        }}
                      >
                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>TEMP</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--hud-font-mono, monospace)', lineHeight: 1.1 }}>
                          {Number(summary.nominalVitals.temp.val).toFixed(1)}<span style={{ fontSize: '8.5px', color: '#64748b' }}>°C</span>
                        </div>
                        <div className="hud-tooltip hud-tooltip-down-right">
                          Core Temperature · Internal thermal homeostasis (Baseline: {Number(profile.restTemp).toFixed(1)}°C)
                        </div>
                      </div>

                      {/* BP */}
                      <div
                        className="hud-tooltip-trigger"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          borderRadius: '5px',
                          padding: '5px 7px',
                          cursor: 'default',
                        }}
                      >
                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>BP</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--hud-font-mono, monospace)', lineHeight: 1.1 }}>
                          {summary.nominalVitals.bp.val} <span style={{ fontSize: '8.5px', color: '#64748b' }}>mmHg</span>
                        </div>
                        <div className="hud-tooltip hud-tooltip-down-right">
                          Blood Pressure · Systolic/diastolic arterial perfusion pressure ({summary.nominalVitals.bp.val} mmHg)
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Trajectory & NASA OSDR Calibration Footnote */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px solid var(--hud-border-subtle)',
                  marginTop: '6px',
                }}
              >
                <div
                  className="hud-tooltip-trigger"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: summary.trajectory.color,
                    letterSpacing: '0.03em',
                    fontFamily: "'Tomorrow', sans-serif",
                    cursor: 'default',
                  }}
                >
                  <span>{summary.trajectory.label}</span>
                  <div className="hud-tooltip hud-tooltip-up">
                    Clinical Trajectory · Multi-signal predictive trend: {summary.trajectory.label}
                  </div>
                </div>

                <div
                  className="hud-tooltip-trigger"
                  style={{
                    fontSize: '9px',
                    color: 'rgba(148, 163, 184, 0.65)',
                    letterSpacing: '0.02em',
                    cursor: 'default',
                  }}
                >
                  NASA-OSDR
                  <div className="hud-tooltip hud-tooltip-up-right">
                    NASA Open Science Data Repository · Biomarker baseline profile calibration
                  </div>
                </div>
              </div>
            </div>

            {/* ── ZONE 3: REAL-TIME DUAL-TRACE WAVEFORM CANVAS ──────────── */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '8px 12px 10px',
                gap: '0',
                background: 'rgba(0, 0, 0, 0.20)',
              }}
            >
              {/* Telemetry Canvas Header */}
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: 'rgba(148, 163, 184, 0.85)',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <div
                  className="hud-tooltip-trigger"
                  style={{ display: 'flex', alignItems: 'center', cursor: 'default' }}
                >
                  <span style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600, letterSpacing: '0.03em', fontFamily: "'Tomorrow', sans-serif" }}>
                    ECG Lead-II + SpO₂ Plethysmogram
                  </span>
                  <div className="hud-tooltip hud-tooltip-down">
                    Dual-Trace Telemetry · Synchronized Lead-II ECG and SpO₂ plethysmographic pulse waveform
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="hud-tooltip-trigger" style={{ cursor: 'default' }}>
                    <span
                      className="font-mono-tabular"
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        color: summary.nominalVitals.hr.val > 100 && !telemetry?.mission_state?.includes('WORKOUT')
                          ? 'var(--hud-orange)'
                          : '#ffffff',
                      }}
                    >
                      {summary.nominalVitals.hr.val} BPM
                    </span>
                    <div className="hud-tooltip hud-tooltip-down-right">
                      Instantaneous Pulse · Derived from ECG Lead-II R-wave peak intervals
                    </div>
                  </div>

                  <span style={{ color: '#475569', fontSize: '9px' }}>•</span>

                  <div className="hud-tooltip-trigger" style={{ cursor: 'default' }}>
                    <span
                      className="font-mono-tabular"
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        color: Number(summary.nominalVitals.spo2.val) < 95 ? 'var(--hud-critical)' : '#ffffff',
                      }}
                    >
                      {Number(summary.nominalVitals.spo2.val).toFixed(1)}% SpO₂
                    </span>
                    <div className="hud-tooltip hud-tooltip-down-right">
                      Peripheral Oxygenation · Optical photoplethysmogram arterial saturation
                    </div>
                  </div>

                  <span style={{ color: '#475569', fontSize: '9px' }}>•</span>

                  <div className="hud-tooltip-trigger" style={{ cursor: 'default' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        color: isCritical
                          ? '#ef4444'
                          : isWarning
                          ? '#f59e0b'
                          : '#22c55e',
                      }}
                    >
                      {summary.severity === 'NOMINAL' ? 'SINUS' : isCritical ? 'ARRHYTHMIA / CRIT' : 'TACHY / WARN'}
                    </span>
                    <div className="hud-tooltip hud-tooltip-down-right">
                      Cardiac Rhythm Status · Real-time QRS morphology & rhythm classification
                    </div>
                  </div>
                </div>
              </div>

              {/* ECG row canvas — fills remaining column height flush */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <EcgRowCanvas
                  astronautId={crew.id}
                  altAstronautId={crew.altId}
                  telemetry={telemetry}
                />
              </div>
            </div>
    </div>
  );
};

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

        return (
          <CrewCardRow
            key={crew.id}
            crew={crew}
            telemetry={telemetry}
            onOpenTriage={onOpenTriage}
          />
        );
      })}
    </div>
  );
};
