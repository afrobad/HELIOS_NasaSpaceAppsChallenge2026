import React, { useState, useMemo } from 'react';
import { useAlertStore } from '../services/alertStore';
import type { CrewAlert, AlertEvidence, AlertStep } from '../types/telemetry';
import { CREW_SLUG_REGISTRY } from '../services/routerService';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Activity, 
  ShieldAlert, 
  Wind, 
  Radio, 
  Moon, 
  Clock, 
  CheckSquare, 
  Square,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import { UniversalButton } from './common/UniversalButton';
import { UniversalTab } from './common/UniversalTab';

interface FlightAlertsViewProps {
  initialAstronautId?: string;
  onSelectAstronaut?: (id: string) => void;
}

export const FlightAlertsView: React.FC<FlightAlertsViewProps> = ({
  initialAstronautId = 'ALL',
  onSelectAstronaut: _onSelectAstronaut,
}) => {
  const { activeAlerts, resolvedAlerts, toggleStep, resolveAlert, isBackendConnected, refreshAlerts } = useAlertStore();
  const [selectedCrewId, setSelectedCrewId] = useState<string>(initialAstronautId);
  const [activeFilter, setActiveFilter] = useState<'all' | 'act' | 'watch' | 'resolved'>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Filter alerts by crew
  const crewActiveAlerts = useMemo(() => {
    if (selectedCrewId === 'ALL') return activeAlerts;
    return activeAlerts.filter((a) => a.crewId === selectedCrewId);
  }, [activeAlerts, selectedCrewId]);

  const crewResolvedAlerts = useMemo(() => {
    if (selectedCrewId === 'ALL') return resolvedAlerts;
    return resolvedAlerts.filter((a) => a.crewId === selectedCrewId);
  }, [resolvedAlerts, selectedCrewId]);

  // Filter alerts by urgency
  const displayedAlerts = useMemo(() => {
    if (activeFilter === 'resolved') return crewResolvedAlerts;
    if (activeFilter === 'act') return crewActiveAlerts.filter((a) => a.status === 'act');
    if (activeFilter === 'watch') return crewActiveAlerts.filter((a) => a.status === 'watch');
    return crewActiveAlerts;
  }, [activeFilter, crewActiveAlerts, crewResolvedAlerts]);

  // Selected alert fallback
  const currentAlert: CrewAlert | null = useMemo(() => {
    if (!displayedAlerts.length) return null;
    const found = displayedAlerts.find((a) => a.id === selectedAlertId);
    return found || displayedAlerts[0] || null;
  }, [displayedAlerts, selectedAlertId]);

  const actCount = useMemo(() => crewActiveAlerts.filter((a) => a.status === 'act').length, [crewActiveAlerts]);
  const watchCount = useMemo(() => crewActiveAlerts.filter((a) => a.status === 'watch').length, [crewActiveAlerts]);

  const getHazardIcon = (hazard: CrewAlert['hazard']) => {
    switch (hazard) {
      case 'cardiovascular':
        return <Activity size={16} color="#ef4444" />;
      case 'radiation':
        return <Radio size={16} color="#ef4444" />;
      case 'decompression':
        return <Wind size={16} color="#38bdf8" />;
      case 'sleep':
        return <Moon size={16} color="#a855f7" />;
      case 'toxin':
        return <ShieldAlert size={16} color="#f59e0b" />;
      default:
        return <AlertTriangle size={16} color="#f59e0b" />;
    }
  };

  const getAstronautName = (crewId: string) => {
    const found = CREW_SLUG_REGISTRY.find((c) => c.id === crewId);
    return found ? found.name : crewId.replace(/_/g, ' ');
  };

  // Sparkline generator
  const renderSparkline = (points: number[]) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const w = 120;
    const h = 28;
    const padding = 3;

    const pathD = points
      .map((val, idx) => {
        const x = padding + (idx / (points.length - 1)) * (w - padding * 2);
        const y = h - padding - ((val - min) / range) * (h - padding * 2);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
        <path d={pathD} fill="none" stroke="#a1b48e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {points.length > 0 && (
          <circle
            cx={(w - padding).toFixed(1)}
            cy={(h - padding - ((points[points.length - 1] - min) / range) * (h - padding * 2)).toFixed(1)}
            r="3"
            fill="#ef4444"
          />
        )}
      </svg>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '1840px',
        margin: '0 auto',
        padding: '20px 24px 60px 24px',
        boxSizing: 'border-box',
        gap: '20px',
        color: '#e2e8f0',
        fontFamily: "var(--hud-font-sans, 'Hubot Sans', sans-serif)",
      }}
    >
      {/* ── 1. HEADER SECTION ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          background: 'linear-gradient(180deg, rgba(20, 30, 23, 0.95) 0%, rgba(13, 19, 15, 0.98) 100%)',
          border: '1px solid rgba(122, 148, 99, 0.22)',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: "var(--hud-font-brand, 'Orbitron', sans-serif)",
                fontSize: '18px',
                fontWeight: 900,
                letterSpacing: '0.10em',
                color: '#ffffff',
                textTransform: 'uppercase',
              }}
            >
              Flight Alerts Console
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#94a3b8',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                fontFamily: 'monospace',
              }}
            >
              NASA-STD-3001
            </span>
          </div>
          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
            Multi-crew physiological anomaly queue, biometric z-score deviations, and actionable countermeasures
          </span>
        </div>

        {/* Consolidated Telemetry Status & Sync (Zero Badge Clutter) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '4px 11px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: isBackendConnected ? '#10b981' : '#64748b',
              }}
            />
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: isBackendConnected ? '#cbd5e1' : '#64748b',
                letterSpacing: '0.04em',
                fontFamily: 'monospace',
              }}
            >
              {isBackendConnected ? 'LIVE 10Hz // SENTRY' : 'LOCAL SENTRY'}
            </span>
          </div>

          <UniversalButton
            variant="cyan"
            size="xs"
            pill
            icon={<RefreshCw size={11} />}
            iconPosition="left"
            onClick={() => refreshAlerts?.()}
            title="Poll backend /api/alerts for real-time proactive alerts"
          >
            SYNC
          </UniversalButton>
        </div>
      </div>

      {/* ── 2. FILTER BARS: CREW & SEVERITY ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Crew Roster Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <UniversalTab
            active={selectedCrewId === 'ALL'}
            accent="cyan"
            size="sm"
            pill
            onClick={() => setSelectedCrewId('ALL')}
          >
            Whole Crew ({activeAlerts.length})
          </UniversalTab>
          {CREW_SLUG_REGISTRY.map((c) => {
            const count = activeAlerts.filter((a) => a.crewId === c.id).length;
            const isSel = selectedCrewId === c.id;
            return (
              <UniversalTab
                key={c.id}
                active={isSel}
                accent="cyan"
                size="sm"
                pill
                badge={count > 0 ? count : undefined}
                onClick={() => setSelectedCrewId(c.id)}
              >
                {c.name}
              </UniversalTab>
            );
          })}
        </div>

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="#8c9c8e" />
          {(
            [
              { id: 'all', label: `Active (${crewActiveAlerts.length})` },
              { id: 'act', label: `Act (${actCount})` },
              { id: 'watch', label: `Watch (${watchCount})` },
              { id: 'resolved', label: `Resolved (${crewResolvedAlerts.length})` },
            ] as const
          ).map((f) => (
            <UniversalTab
              key={f.id}
              active={activeFilter === f.id}
              accent="cyan"
              size="sm"
              pill
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
            </UniversalTab>
          ))}
        </div>
      </div>

      {/* ── 3. MAIN WORKSPACE: ALERT QUEUE (LEFT) & DETAIL ACTION CARD (RIGHT) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 440px) 1fr',
          gap: '20px',
          minHeight: '620px',
        }}
      >
        {/* LEFT COLUMN: ALERT QUEUE LIST */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto',
            maxHeight: '750px',
            paddingRight: '6px',
          }}
        >
          {displayedAlerts.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(20, 30, 23, 0.4)',
                border: '1px dashed rgba(122, 148, 99, 0.25)',
                borderRadius: '8px',
                color: '#8c9c8e',
              }}
            >
              <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>No Alerts Found</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                All crew physiological indicators in this category are within nominal NASA baselines.
              </div>
            </div>
          ) : (
            displayedAlerts.map((alert) => {
              const isSelected = currentAlert?.id === alert.id;
              const isAct = alert.status === 'act';
              const isResolved = alert.status === 'resolved';

              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlertId(alert.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    backgroundColor: isSelected
                      ? 'linear-gradient(180deg, rgba(32, 48, 36, 0.95) 0%, rgba(20, 32, 23, 0.98) 100%)'
                      : 'rgba(20, 30, 23, 0.65)',
                    border: `1px solid ${
                      isSelected
                        ? '#a1b48e'
                        : isAct
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(122, 148, 99, 0.18)'
                    }`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: isSelected ? '0 4px 16px rgba(0, 0, 0, 0.5)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getHazardIcon(alert.hazard)}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#8c9c8e',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {getAstronautName(alert.crewId)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          backgroundColor: isResolved
                            ? 'rgba(16, 185, 129, 0.15)'
                            : isAct
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                          color: isResolved ? '#10b981' : isAct ? '#ef4444' : '#f59e0b',
                          border: `1px solid ${
                            isResolved ? 'rgba(16, 185, 129, 0.4)' : isAct ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'
                          }`,
                        }}
                      >
                        {alert.status.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: isAct ? '#ef4444' : '#f59e0b',
                          fontFamily: 'monospace',
                        }}
                      >
                        +{alert.z}σ
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isSelected ? '#ffffff' : '#e2e8f0',
                      lineHeight: '1.35',
                    }}
                  >
                    {alert.title}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                      <Clock size={12} />
                      <span>{alert.openedAt}</span>
                    </div>
                    {alert.series && renderSparkline(alert.series)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: ACTION PROTOCOL & CLINICAL DETAIL */}
        {currentAlert ? (
          <div
            style={{
              padding: '24px 28px',
              borderRadius: '8px',
              background: 'linear-gradient(180deg, rgba(20, 30, 23, 0.95) 0%, rgba(13, 19, 15, 0.98) 100%)',
              border: '1px solid rgba(122, 148, 99, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Header: Title, Astronaut, Urgency */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor:
                        currentAlert.status === 'resolved'
                          ? 'rgba(16, 185, 129, 0.18)'
                          : currentAlert.status === 'act'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(245, 158, 11, 0.2)',
                      color:
                        currentAlert.status === 'resolved'
                          ? '#10b981'
                          : currentAlert.status === 'act'
                          ? '#ef4444'
                          : '#f59e0b',
                      border: `1px solid ${
                        currentAlert.status === 'resolved'
                          ? 'rgba(16, 185, 129, 0.4)'
                          : currentAlert.status === 'act'
                          ? 'rgba(239, 68, 68, 0.4)'
                          : 'rgba(245, 158, 11, 0.4)'
                      }`,
                    }}
                  >
                    STATUS: {currentAlert.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '12px', color: '#8c9c8e', fontWeight: 600 }}>
                    {getAstronautName(currentAlert.crewId)} · HAZARD: {currentAlert.hazard.toUpperCase()}
                  </span>
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#ffffff',
                    fontFamily: "var(--hud-font-brand, 'Orbitron', sans-serif)",
                    letterSpacing: '0.04em',
                  }}
                >
                  {currentAlert.title}
                </h2>
              </div>

              {currentAlert.status !== 'resolved' && (
                <UniversalButton
                  variant="emerald"
                  size="md"
                  pill
                  icon={<CheckCircle2 size={15} />}
                  iconPosition="left"
                  onClick={() => resolveAlert(currentAlert.id)}
                  title="Mark flight alert as resolved and commit to log"
                >
                  RESOLVE & LOG
                </UniversalButton>
              )}
            </div>

            {/* Physiological Explanation Box */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '6px',
                backgroundColor: 'rgba(9, 14, 11, 0.85)',
                border: '1px solid rgba(122, 148, 99, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#8c9c8e', letterSpacing: '0.08em' }}>
                  CLINICAL PHYSIOLOGICAL ASSESSMENT
                </span>
                <span style={{ fontSize: '11.5px', color: '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>
                  BASELINE SHIFT: +{currentAlert.z}σ DEVIATION
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.6', color: '#d1d5db' }}>
                {currentAlert.explanation}
              </p>
            </div>

            {/* Interactive Action Protocol Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: "var(--hud-font-brand, 'Orbitron', sans-serif)",
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#ffffff',
                  }}
                >
                  ACTION CARD PROTOCOL ({currentAlert.steps.filter((s) => s.done).length}/{currentAlert.steps.length} COMPLETE)
                </span>
                <span style={{ fontSize: '11.5px', color: '#8c9c8e' }}>Click step to toggle execution</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentAlert.steps.map((step: AlertStep, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => toggleStep(currentAlert.id, idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: step.done ? 'rgba(16, 185, 129, 0.08)' : 'rgba(20, 30, 23, 0.5)',
                      border: `1px solid ${step.done ? 'rgba(16, 185, 129, 0.25)' : 'rgba(122, 148, 99, 0.15)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {step.done ? (
                      <CheckSquare size={17} color="#10b981" style={{ flexShrink: 0 }} />
                    ) : (
                      <Square size={17} color="#64748b" style={{ flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        fontSize: '13px',
                        color: step.done ? '#94a3b8' : '#f1f5f9',
                        textDecoration: step.done ? 'line-through' : 'none',
                        lineHeight: '1.4',
                      }}
                    >
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* NASA Evidence Citations */}
            {currentAlert.evidence && currentAlert.evidence.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span
                  style={{
                    fontFamily: "var(--hud-font-brand, 'Orbitron', sans-serif)",
                    fontSize: '12.5px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#ffffff',
                  }}
                >
                  NASA SCIENTIFIC EVIDENCE & CITATIONS
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {currentAlert.evidence.map((ev: AlertEvidence, idx: number) => (
                    <a
                      key={idx}
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '12px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(9, 14, 11, 0.7)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        textDecoration: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.6)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>{ev.source} · {ev.id}</span>
                        <ExternalLink size={13} color="#38bdf8" />
                      </div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f1f5f9', lineHeight: '1.3' }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                        {ev.why}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span
                style={{
                  fontFamily: "var(--hud-font-brand, 'Orbitron', sans-serif)",
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#8c9c8e',
                }}
              >
                EVENT AUDIT TIMELINE
              </span>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(9, 14, 11, 0.6)',
                  borderRadius: '6px',
                  border: '1px solid rgba(122, 148, 99, 0.15)',
                }}
              >
                {currentAlert.timeline.map((evt, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px' }}>
                    <span style={{ fontFamily: 'monospace', color: '#a1b48e', minWidth: '70px' }}>{evt.ts}</span>
                    <span style={{ color: '#64748b' }}>—</span>
                    <span style={{ color: evt.kind === 'resolved' ? '#10b981' : '#cbd5e1' }}>{evt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

