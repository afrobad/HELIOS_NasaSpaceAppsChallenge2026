import React, { useState, useMemo } from 'react';
import type { TelemetryPacket, AlertPayload, DistancePreset } from '../types/telemetry';
import { HolographicBodyScanner } from './HolographicBodyScanner';
import { EcgRowCanvas } from './EcgRowCanvas';
import { evaluateCrewClinicalSummary } from '../utils/clinicalPrioritization';
import { UniversalButton } from './common/UniversalButton';
import { UniversalTab } from './common/UniversalTab';
import {
  Heart,
  Zap,
  Wind,
  Crosshair,
  User,
  ArrowRight,
  Droplets,
  Sparkles,
  Shield,
  AlertTriangle,
  Volume2,
  CheckCircle2,
} from 'lucide-react';
import { audioService } from '../services/audioService';

interface MainIndexDeckProps {
  telemetryMap: Record<string, TelemetryPacket>;
  latestAlert?: AlertPayload | null;
  currentScenario?: string;
  orbitalPosition?: DistancePreset;
  onOpenTriage: (astronautId: string) => void;
  onSelectView?: (view: 'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER' | 'MCC_TELEMETRY') => void;
  scannerTheme?: 'CYAN' | 'THERMAL' | 'AMBER';
  onSelectScannerTheme?: (theme: 'CYAN' | 'THERMAL' | 'AMBER') => void;
  showEclssBar?: boolean;
  onToggleEclss?: () => void;
  targetAstronautId?: string | null;
  onSolveSituation?: () => void;
}

interface CrewMemberInfo {
  id: string;
  name: string;
  callsign: string;
  role: string;
  roleShort: string;
  crewNo: string;
  avatar: string;
  age: number;
  specialty: string;
}

const CREW_ROSTER: CrewMemberInfo[] = [
  {
    id: 'AST-01_COMMANDER',
    name: 'Haley',
    callsign: 'HALEY',
    role: 'Mission Commander',
    roleShort: 'CDR',
    crewNo: 'CREW-01',
    avatar: '/crew/haley.jpg',
    age: 38,
    specialty: 'Orbital Dynamics & Flight Control',
  },
  {
    id: 'AST-02_PILOT',
    name: 'Chris',
    callsign: 'CHRIS',
    role: 'Flight Pilot',
    roleShort: 'PLT',
    crewNo: 'CREW-02',
    avatar: '/crew/chris.jpg',
    age: 42,
    specialty: 'Propulsion & Extravehicular Activity',
  },
  {
    id: 'AST-03_MEDICAL',
    name: 'Dr. Sian',
    callsign: 'SIAN',
    role: 'Medical Specialist',
    roleShort: 'MED',
    crewNo: 'CREW-03',
    avatar: '/crew/sian.jpg',
    age: 29,
    specialty: 'Physiology & Clinical Countermeasures',
  },
  {
    id: 'AST-04_ENGINEER',
    name: 'Specialist Leo',
    callsign: 'LEO',
    role: 'Systems Engineer',
    roleShort: 'ENG',
    crewNo: 'CREW-04',
    avatar: '/crew/leo.jpg',
    age: 45,
    specialty: 'ECLSS Life Support & Power Subsystems',
  },
];

export const MainIndexDeck: React.FC<MainIndexDeckProps> = ({
  telemetryMap,
  latestAlert,
  currentScenario = 'NOMINAL_CRUISE',
  orbitalPosition,
  onOpenTriage,
  onSelectView: _onSelectView,
  scannerTheme: externalScannerTheme,
  onSelectScannerTheme: _onSelectScannerTheme,
  showEclssBar: externalShowEclssBar,
  onToggleEclss: _onToggleEclss,
  targetAstronautId,
  onSolveSituation,
}) => {
  // Selected astronaut currently focused in the center 3D Holographic Scanner
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>('AST-02_PILOT');

  // Auto-focus target astronaut when scenario is initiated or switched
  React.useEffect(() => {
    if (targetAstronautId && CREW_ROSTER.some((c) => c.id === targetAstronautId)) {
      setSelectedAstronautId(targetAstronautId);
    }
  }, [targetAstronautId, currentScenario]);
  // Filter for crew list: 'ALL' | 'ANOMALY'
  const [crewFilter, setCrewFilter] = useState<'ALL' | 'ANOMALY'>('ALL');
  // Scanner Theme: 'CYAN' | 'THERMAL' | 'AMBER'
  const [internalScannerTheme] = useState<'CYAN' | 'THERMAL' | 'AMBER'>('CYAN');
  const scannerTheme = externalScannerTheme ?? internalScannerTheme;
  // Selected anatomical subsystem: 'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL'
  const [activeSubsystem, setActiveSubsystem] = useState<'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL'>('CARDIAC');
  // Environmental Drawer toggle
  const [internalShowEclssBar] = useState<boolean>(true);
  const showEclssBar = externalShowEclssBar ?? internalShowEclssBar;

  // Active crew metadata
  const activeCrew = useMemo(() => {
    return CREW_ROSTER.find((c) => c.id === selectedAstronautId) || CREW_ROSTER[1];
  }, [selectedAstronautId]);

  // Active telemetry packet
  const activeTelemetry: TelemetryPacket = useMemo(() => {
    const raw = telemetryMap[selectedAstronautId];
    const isScenElevated = Boolean(currentScenario && currentScenario !== 'NOMINAL_CRUISE');
    const isRadScen = isScenElevated && (currentScenario.includes('RADIATION') || currentScenario.includes('SOLAR'));

    if (raw) {
      return {
        ...raw,
        scenario_phase: isScenElevated ? currentScenario : (raw.scenario_phase || currentScenario),
        radiation_flux: isRadScen ? Math.max(raw.radiation_flux ?? 0, 85.0) : raw.radiation_flux,
        radiation_dose_gy: isRadScen ? Math.max((raw as any).radiation_dose_gy ?? 0, 0.75) : (raw as any).radiation_dose_gy,
      };
    }

    return {
      timestamp: new Date().toISOString(),
      tick: 0,
      astronaut_id: selectedAstronautId,
      astronaut_name: activeCrew.name,
      mission_state: 'REST',
      heart_rate: 62,
      hrv_rmssd: 68,
      spo2: 98.4,
      core_temp: 36.6,
      sleep_score: 92,
      cabin_co2: 1.82,
      potassium: 4.4,
      hematocrit: 42.0,
      wbc_count: 6.8,
      platelet_count: 240,
      crp: 0.8,
      computed_qtc: 405,
      scenario_phase: currentScenario,
      radiation_flux: isRadScen ? 85.0 : 0.04,
      z_score_hr: 0.1,
      z_score_hrv: 0.1,
      evaluated_severity: 'NOMINAL',
    };
  }, [telemetryMap, selectedAstronautId, activeCrew.name, currentScenario]);

  // Clinical Summary for Active Astronaut
  const activeClinical = useMemo(() => {
    return evaluateCrewClinicalSummary(selectedAstronautId, activeTelemetry);
  }, [selectedAstronautId, activeTelemetry]);

  // Determine if active crew is abnormal or if an active scenario/alert is in effect
  const isScenarioElevated = Boolean(currentScenario && currentScenario !== 'NOMINAL_CRUISE');
  const isAbnormal = isScenarioElevated || activeClinical.isAbnormal || activeTelemetry.heart_rate > 100 || activeTelemetry.spo2 < 97.0 || Boolean(latestAlert && latestAlert.severity !== 'NOMINAL');

  // Filtered crew members
  const filteredCrew = useMemo(() => {
    if (crewFilter === 'ANOMALY') {
      return CREW_ROSTER.filter((c) => {
        const t = telemetryMap[c.id];
        const summary = evaluateCrewClinicalSummary(c.id, t || ({} as any));
        return summary.isAbnormal || (t && (t.heart_rate > 100 || t.spo2 < 97.0));
      });
    }
    return CREW_ROSTER;
  }, [crewFilter, telemetryMap]);


  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        minHeight: 'calc(100vh - 56px)',
        padding: '4px 16px 14px',
        maxWidth: '1840px',
        margin: '0 auto',
        boxSizing: 'border-box',
        fontFamily: "var(--hud-font-sans, 'Tomorrow', -apple-system, BlinkMacSystemFont, sans-serif)",
      }}
    >

      {/* ─── 2. ECLSS CABIN ENVIRONMENTAL DRAWER (HIGH-CONTRAST TELEMETRY SLAB) ─── */}
      {showEclssBar && (
        <section
          aria-label="Cabin Environmental Ribbon"
          style={{
            marginBottom: 8,
            background: 'linear-gradient(180deg, rgba(18, 26, 21, 0.96) 0%, rgba(12, 18, 14, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(122, 148, 99, 0.20)',
            borderRadius: 8,
            padding: '7px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Left Title: Status indicator with pulsating dot and icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ position: 'relative', display: 'flex', height: 7, width: 7 }}>
              <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', background: '#4ade80', opacity: 0.65, animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: 7, width: 7, background: '#22c55e' }} />
            </span>
            <Wind size={14} style={{ color: '#a1b48e' }} />
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
              ECLSS LIFE SUPPORT:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 11, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
            {/* Dynamic Cabin Pressure */}
            {(() => {
              const isDecompression = currentScenario === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA';
              const pressureVal = isDecompression ? 88.0 : 101.3;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>CABIN PRESSURE:</span>
                  <span style={{ color: isDecompression ? '#ef4444' : '#ffffff', fontWeight: 800 }}>
                    {pressureVal.toFixed(1)} <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>kPa</span>
                  </span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isDecompression ? 'rgba(239, 68, 68, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${isDecompression ? 'rgba(239, 68, 68, 0.32)' : 'rgba(16, 185, 129, 0.24)'}`,
                      color: isDecompression ? '#ef4444' : '#34d399',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isDecompression ? 'CRITICAL LEAK' : 'NOMINAL'}
                  </span>
                </div>
              );
            })()}

            <div style={{ width: 1, height: 16, background: 'rgba(122, 148, 99, 0.18)' }} />

            {/* Dynamic Oxygen Fraction */}
            {(() => {
              const isLowO2 = (activeTelemetry.spo2 ?? 98.4) < 92.0 || currentScenario === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA';
              const o2Val = isLowO2 ? 17.6 : 20.9;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>O₂ FRACTION:</span>
                  <span style={{ color: isLowO2 ? '#f59e0b' : '#ffffff', fontWeight: 800 }}>{o2Val.toFixed(1)}%</span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isLowO2 ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${isLowO2 ? 'rgba(245, 158, 11, 0.32)' : 'rgba(16, 185, 129, 0.24)'}`,
                      color: isLowO2 ? '#f59e0b' : '#34d399',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isLowO2 ? 'HYPOXIC' : 'STABLE'}
                  </span>
                </div>
              );
            })()}

            <div style={{ width: 1, height: 16, background: 'rgba(122, 148, 99, 0.18)' }} />

            {/* Dynamic Cabin CO2 */}
            {(() => {
              const co2Val = activeTelemetry.cabin_co2 ?? 1.82;
              const isCrit = co2Val > 4.0;
              const isWarn = co2Val > 2.8;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>CABIN CO₂:</span>
                  <span style={{ color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#ffffff', fontWeight: 800 }}>
                    {co2Val.toFixed(2)} <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>mmHg</span>
                  </span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isCrit ? 'rgba(239, 68, 68, 0.16)' : isWarn ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${isCrit ? 'rgba(239, 68, 68, 0.32)' : isWarn ? 'rgba(245, 158, 11, 0.32)' : 'rgba(16, 185, 129, 0.24)'}`,
                      color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#34d399',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isCrit ? 'CRITICAL' : isWarn ? 'ELEVATED' : 'NOMINAL'}
                  </span>
                </div>
              );
            })()}

            <div style={{ width: 1, height: 16, background: 'rgba(122, 148, 99, 0.18)' }} />

            {/* Cabin Temp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>CABIN TEMP:</span>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>
                {activeTelemetry.core_temp ? (activeTelemetry.core_temp - 15.4).toFixed(1) : '21.4'}°C
              </span>
            </div>

            <div style={{ width: 1, height: 16, background: 'rgba(122, 148, 99, 0.18)' }} />

            {/* Dynamic Radiation Flux */}
            {(() => {
              const radVal = activeTelemetry.radiation_flux ?? 0.04;
              const isCrit = radVal > 10.0;
              const isWarn = radVal > 0.15;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>RAD FLUX:</span>
                  <span style={{ color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#ffffff', fontWeight: 800 }}>
                    {radVal.toFixed(2)} <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>mSv/h</span>
                  </span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isCrit ? 'rgba(239, 68, 68, 0.16)' : isWarn ? 'rgba(245, 158, 11, 0.16)' : 'rgba(56, 189, 248, 0.12)',
                      border: `1px solid ${isCrit ? 'rgba(239, 68, 68, 0.32)' : isWarn ? 'rgba(245, 158, 11, 0.32)' : 'rgba(56, 189, 248, 0.24)'}`,
                      color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#38bdf8',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isCrit ? 'SPE STORM' : isWarn ? 'ELEVATED' : 'SHIELDED'}
                  </span>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ─── 2.5 EMERGENCY DIRECTIVE & RECOMMENDED ACTION BANNER ─── */}
      {isAbnormal && latestAlert && latestAlert.severity !== 'NOMINAL' && (
        <section
          aria-label="Active Clinical Directive Banner"
          data-tour="alert-banner"
          style={{
            marginBottom: 18,
            background: latestAlert.severity === 'CRITICAL'
              ? 'linear-gradient(135deg, rgba(22, 6, 10, 0.96) 0%, rgba(35, 10, 18, 0.98) 100%)'
              : 'linear-gradient(135deg, rgba(24, 16, 6, 0.96) 0%, rgba(36, 22, 10, 0.98) 100%)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: latestAlert.severity === 'CRITICAL'
              ? '1.5px solid rgba(239, 68, 68, 0.85)'
              : '1.5px solid rgba(245, 158, 11, 0.85)',
            borderRadius: 16,
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            boxShadow: latestAlert.severity === 'CRITICAL'
              ? '0 12px 36px rgba(239, 68, 68, 0.35), 0 0 20px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 12px 36px rgba(245, 158, 11, 0.30), 0 0 20px rgba(245, 158, 11, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: latestAlert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)',
                border: latestAlert.severity === 'CRITICAL' ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(245, 158, 11, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: latestAlert.severity === 'CRITICAL' ? '0 0 16px rgba(239, 68, 68, 0.5)' : '0 0 16px rgba(245, 158, 11, 0.4)',
              }}
            >
              <AlertTriangle size={22} style={{ color: latestAlert.severity === 'CRITICAL' ? '#fca5a5' : '#fde68a' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              {/* Row 1: Badges & Problem Diagnosis Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    background: latestAlert.severity === 'CRITICAL' ? '#dc2626' : '#d97706',
                    padding: '3px 9px',
                    borderRadius: 6,
                    boxShadow: latestAlert.severity === 'CRITICAL' ? '0 0 12px rgba(220, 38, 38, 0.6)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Helix-Ai Analyst // {latestAlert.severity}
                </span>

                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#ffffff', fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)", letterSpacing: '0.02em', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {latestAlert.reason || latestAlert.triage_diagnosis}
                </span>
              </div>

              {/* Row 2: Prominent Surgeon Directive Action Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: latestAlert.severity === 'CRITICAL' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: '#ffffff',
                  lineHeight: 1.5,
                  boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.6)',
                }}
              >
                <span style={{ color: latestAlert.severity === 'CRITICAL' ? '#fca5a5' : '#fde047', fontWeight: 900, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  RECOMMENDED HELIX-AI ACTION:
                </span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                  {latestAlert.actionable_instruction || 'Follow standard stabilization protocol and monitor vitals.'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Action: Beautiful "SOLVED" Button (Restore All Systems to Nominal) */}
          {onSolveSituation && (
            <UniversalButton
              variant="emerald"
              size="md"
              pill
              icon={<CheckCircle2 size={18} />}
              iconPosition="left"
              onClick={onSolveSituation}
              title="Situation Solved — Restore all life support and crew telemetry back to Nominal"
            >
              SOLVED · ALL NOMINAL
            </UniversalButton>
          )}
        </section>
      )}

      {/* ─── 3. MAIN COMMAND TRI-PANE VIEWPORT (ENTERPRISE GRID SYSTEM) ─── */}
      <div className="helios-main-deck-grid">
        {/* ─────────────────────────────────────────────────────────────
            LEFT FLANK: TACTICAL CREW ROSTER & QUICK VITAL CARDS
           ───────────────────────────────────────────────────────────── */}
        <aside className="helios-left-flank" data-tour="crew-manifest">
          {/* Flank Header with Segmented Filter Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 12px',
              background: 'linear-gradient(180deg, rgba(18, 26, 21, 0.96) 0%, rgba(12, 18, 15, 0.98) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(122, 148, 99, 0.18)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <User size={13} style={{ color: '#a1b48e' }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  lineHeight: 1,
                }}
              >
                CREW MANIFEST
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <UniversalTab
                active={crewFilter === 'ALL'}
                accent="cyan"
                size="sm"
                pill
                onClick={() => setCrewFilter('ALL')}
              >
                ALL (4)
              </UniversalTab>
              <UniversalTab
                active={crewFilter === 'ANOMALY'}
                accent="amber"
                size="sm"
                pill
                onClick={() => setCrewFilter('ANOMALY')}
              >
                ALERT ({CREW_ROSTER.filter(c => {
                  const t = telemetryMap[c.id];
                  return t && ((t.heart_rate ?? 60) > 100 || (t.spo2 ?? 98) < 95.0 || t.evaluated_severity === 'CRITICAL' || t.evaluated_severity === 'WARNING');
                }).length})
              </UniversalTab>
            </div>
          </div>

          {/* 4 Astronaut Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredCrew.map((crew) => {
              const isSelected = selectedAstronautId === crew.id;
              const telemetry = telemetryMap[crew.id];
              const summary = evaluateCrewClinicalSummary(crew.id, telemetry || ({} as any));
              const hr = telemetry?.heart_rate ?? 62;
              const spo2 = telemetry?.spo2 ?? 98.4;
              const temp = telemetry?.core_temp ?? 36.6;
              const hrv = telemetry?.hrv_rmssd ?? 68;
              const isCritical = telemetry?.evaluated_severity === 'CRITICAL' || spo2 < 90 || hr > 115 || (telemetry?.potassium !== undefined && telemetry.potassium < 3.0) || (telemetry?.radiation_flux ?? 0) > 10;
              const isWarning = !isCritical && (telemetry?.evaluated_severity === 'WARNING' || summary.isAbnormal || hr > 88 || spo2 < 96.5 || (telemetry?.cabin_co2 ?? 0) > 3.0);
              const hasAlert = isCritical || isWarning;

              return (
                <div
                  key={crew.id}
                  onClick={() => setSelectedAstronautId(crew.id)}
                  style={{
                    position: 'relative',
                    background: isCritical
                      ? 'linear-gradient(135deg, rgba(38, 14, 20, 0.96) 0%, rgba(22, 9, 14, 0.98) 100%)'
                      : isWarning
                        ? 'linear-gradient(135deg, rgba(34, 24, 12, 0.96) 0%, rgba(20, 15, 9, 0.98) 100%)'
                        : isSelected
                          ? 'linear-gradient(135deg, rgba(35, 50, 38, 0.97) 0%, rgba(24, 36, 27, 0.99) 100%)'
                          : 'linear-gradient(180deg, rgba(22, 30, 24, 0.92) 0%, rgba(16, 23, 18, 0.96) 100%)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: isCritical
                      ? '1px solid rgba(239, 68, 68, 0.36)'
                      : isWarning
                        ? '1px solid rgba(245, 158, 11, 0.32)'
                        : isSelected
                          ? '1px solid rgba(161, 180, 142, 0.35)'
                          : '1px solid rgba(122, 148, 99, 0.16)',
                    borderRadius: 10,
                    padding: '8px 11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isCritical
                      ? '0 6px 20px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                      : isWarning
                        ? '0 6px 20px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                        : isSelected
                          ? '0 8px 22px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                          : '0 6px 18px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                    transform: isSelected ? 'translateY(-1px)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !hasAlert) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.borderColor = 'rgba(161, 180, 142, 0.30)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !hasAlert) {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.borderColor = 'rgba(122, 148, 99, 0.16)';
                    }
                  }}
                >
                  {/* Top Row: Avatar, Name, Role Badge, and Holo-Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Avatar with Subtle Border */}
                      <div
                        style={{
                          position: 'relative',
                          width: 36,
                          height: 36,
                          borderRadius: 9999,
                          border: `1.5px solid ${isCritical ? 'rgba(239, 68, 68, 0.65)' : isWarning ? 'rgba(245, 158, 11, 0.65)' : isSelected ? 'rgba(161, 180, 142, 0.7)' : 'rgba(122, 148, 99, 0.45)'}`,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: '#0b1007',
                        }}
                      >
                        <img
                          src={crew.avatar}
                          alt={crew.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em', lineHeight: 1.1 }}>
                            {crew.name}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              lineHeight: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '3px 6px',
                              borderRadius: 4,
                              background: 'rgba(32, 45, 35, 0.85)',
                              border: '1px solid rgba(122, 148, 99, 0.20)',
                              color: '#e2e8f0',
                            }}
                          >
                            {crew.roleShort}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2, lineHeight: 1.1 }}>
                          {crew.crewNo} · Age {crew.age}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill Badges (Active Badges Removed — Only Medical Severity Shown) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {isCritical ? (
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            lineHeight: 1,
                            color: '#fca5a5',
                            background: 'rgba(64, 18, 26, 0.88)',
                            border: '1px solid rgba(239, 68, 68, 0.30)',
                            padding: '3.5px 7px',
                            borderRadius: 9999,
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                          <span>CRITICAL</span>
                        </span>
                      ) : isWarning ? (
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            lineHeight: 1,
                            color: '#fde047',
                            background: 'rgba(58, 38, 14, 0.88)',
                            border: '1px solid rgba(245, 158, 11, 0.28)',
                            padding: '3.5px 7px',
                            borderRadius: 9999,
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                          <span>WARNING</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            lineHeight: 1,
                            color: '#34d399',
                            background: 'rgba(16, 44, 26, 0.82)',
                            border: '1px solid rgba(16, 185, 129, 0.24)',
                            padding: '3.5px 7px',
                            borderRadius: 9999,
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                          <span>NOMINAL</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vitals Spark Grid - Elevated Contrast Inner Container */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr',
                      gap: 6,
                      background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.92) 0%, rgba(18, 26, 20, 0.96) 100%)',
                      borderRadius: 7,
                      padding: '6px 9px',
                      border: '1px solid rgba(122, 148, 99, 0.14)',
                      fontFamily: 'monospace',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 700, lineHeight: 1.1 }}>HR</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: hr > 100 ? '#ef4444' : hr > 85 ? '#fbbf24' : '#ffffff',
                          marginTop: 2,
                          lineHeight: 1.1,
                        }}
                      >
                        {hr.toFixed(0)} <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>bpm</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 700, lineHeight: 1.1 }}>SPO₂</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: spo2 < 90 ? '#ef4444' : spo2 < 96.5 ? '#fbbf24' : '#ffffff',
                          marginTop: 2,
                          lineHeight: 1.1,
                        }}
                      >
                        {spo2.toFixed(1)}%
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 700, lineHeight: 1.1 }}>TEMP</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: temp > 37.5 ? '#fbbf24' : '#ffffff', marginTop: 2, lineHeight: 1.1 }}>
                        {temp.toFixed(1)}°
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 700, lineHeight: 1.1 }}>HRV</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', marginTop: 2, lineHeight: 1.1 }}>
                        {hrv.toFixed(0)} <span style={{ fontSize: 8.5, color: '#94a3b8', fontWeight: 600 }}>ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Clinical Assessment Issue Chip */}
                  {hasAlert && (
                    <div
                      style={{
                        marginTop: 7,
                        padding: '5px 8px',
                        borderRadius: 6,
                        background: isCritical ? 'rgba(64, 18, 26, 0.85)' : 'rgba(58, 38, 14, 0.85)',
                        border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.28)' : 'rgba(245, 158, 11, 0.28)'}`,
                        fontSize: 9,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: isCritical ? '#fecaca' : '#fef08a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'monospace',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: isCritical ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {summary.primaryConcern?.title || (isCritical ? 'CRITICAL PHYSIOLOGICAL VARIANCE' : 'PHYSIOLOGICAL STRAIN')}
                      </span>
                    </div>
                  )}

                  {/* Bottom Specialty Metadata Footer (Redundant Triage Button Removed) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      fontSize: 9,
                      lineHeight: 1,
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                    }}
                  >
                    <span style={{ color: '#cbd5e1', fontSize: 9.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }} />
                      <span>{crew.specialty.split('&')[0].trim()}</span>
                    </span>
                    <span style={{ color: '#64748b', fontSize: 8.5, fontWeight: 600 }}>
                      {crew.role}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tactical Mission Protocol Sensor Status */}
          <div
            style={{
              padding: '9px 14px',
              background: 'linear-gradient(180deg, rgba(18, 26, 21, 0.96) 0%, rgba(12, 18, 15, 0.98) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(122, 148, 99, 0.18)',
              borderRadius: 12,
              fontSize: 10,
              color: '#cbd5e1',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ color: '#a1b48e', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1 }}>
              <Shield size={12} />
              <span>CREW TELEMETRY LINK</span>
            </div>
            <span style={{ color: '#34d399', fontSize: 9, fontWeight: 800, lineHeight: 1 }}>ONLINE</span>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────────
            CENTER FLANK: THE 3D HOLOGRAPHIC BIO-TWIN SCANNER VIEWPORT
           ───────────────────────────────────────────────────────────── */}
        <main className="helios-center-flank">
          {/* Unified Bio-Twin Container (Header seamlessly connected with Scanner Container) */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(14, 20, 16, 0.96) 0%, rgba(9, 14, 11, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(122, 148, 99, 0.20)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 18px 44px rgba(0, 0, 0, 0.78), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Minimal Connected Header with Typographical Hierarchy (No Badges, No Numbering) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 16px',
                background: 'linear-gradient(180deg, rgba(20, 28, 22, 0.94) 0%, rgba(14, 20, 16, 0.96) 100%)',
                borderBottom: '1px solid rgba(122, 148, 99, 0.16)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#94a3b8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  HOLOGRAPHIC BIO-TWIN
                </span>
                <span style={{ color: 'rgba(255, 255, 255, 0.16)', fontSize: 11 }}>/</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#f8fafc',
                    letterSpacing: '0.01em',
                  }}
                >
                  {activeCrew.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    fontFamily: 'monospace',
                    color: '#94a3b8',
                  }}
                >
                  {activeCrew.crewNo} · {activeCrew.role}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.05em' }}>
                {activeClinical.isAbnormal ? (
                  <span style={{ color: activeClinical.severity === 'CRITICAL' ? '#f87171' : '#fbbf24', fontWeight: 700 }}>
                    {activeClinical.primaryConcern.title}
                  </span>
                ) : (
                  <span>DRAG TO ROTATE 360°</span>
                )}
              </div>
            </div>

            {/* Embedded 3D Holographic Body Scanner */}
            <div data-tour="bio-twin">
              <HolographicBodyScanner
                astronautId={activeCrew.id}
                astronautName={activeCrew.name}
                astronautRole={activeCrew.role}
                crewNo={activeCrew.crewNo}
                telemetry={activeTelemetry}
                currentScenario={currentScenario}
                themeMode={scannerTheme}
                orbitalPosition={orbitalPosition}
                onSelectSubsystem={(sub) => setActiveSubsystem(sub)}
              />
            </div>
          </div>

          {/* Bottom Hotspot Clinical Action Banner - Single Unified Deep Clinical Report Action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 14px',
              background: 'linear-gradient(180deg, rgba(20, 28, 22, 0.96) 0%, rgba(13, 19, 15, 0.98) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(122, 148, 99, 0.18)',
              borderRadius: 12,
              fontSize: 10.5,
              fontFamily: 'monospace',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crosshair size={15} style={{ color: '#a1b48e' }} />
              <span style={{ color: '#ffffff', fontWeight: 800 }}>
                ORGAN FOCUS: {activeSubsystem}
              </span>
              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                {activeSubsystem === 'CARDIAC'
                  ? 'Myocardium & Rhythm Assessment'
                  : activeSubsystem === 'OCULAR'
                    ? 'Retinal Nerve Fiber Layer & SANS Risk'
                    : activeSubsystem === 'RENAL'
                      ? 'Calculi & Electrolyte Balance'
                      : 'Bone Mineral Density Load Protocol'}
              </span>
            </div>

            <UniversalButton
              variant="cyan"
              size="sm"
              pill
              icon={<ArrowRight size={12} />}
              iconPosition="right"
              onClick={() => onOpenTriage(activeCrew.id)}
              title={`Open comprehensive deep clinical report for ${activeCrew.name}`}
            >
              DEEP CLINICAL REPORT
            </UniversalButton>
          </div>
        </main>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT FLANK: REAL-TIME ECG WAVEFORM & CLINICAL DIAGNOSTICS LAB
           ───────────────────────────────────────────────────────────── */}
        <aside className="helios-right-flank">
          {/* Live ECG Rhythm Strip Card (Expanded Height & High-Contrast Inner Canvas) */}
          <div
            data-tour="live-ecg"
            style={{
              background: 'linear-gradient(180deg, rgba(18, 26, 21, 0.96) 0%, rgba(12, 18, 15, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(122, 148, 99, 0.18)',
              borderRadius: 12,
              padding: '10px 13px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Heart
                  size={13}
                  style={{
                    color: isAbnormal ? '#f43f5e' : '#a1b48e',
                  }}
                />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    lineHeight: 1,
                  }}
                >
                  LIVE LEAD II ECG WAVEFORM
                </span>
              </div>

              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isAbnormal ? '#fb7185' : '#34d399',
                  background: isAbnormal ? 'rgba(64, 18, 26, 0.85)' : 'rgba(16, 44, 26, 0.82)',
                  border: `1px solid ${isAbnormal ? 'rgba(244, 63, 94, 0.28)' : 'rgba(16, 185, 129, 0.24)'}`,
                  padding: '3.5px 8px',
                  borderRadius: 9999,
                }}
              >
                {isAbnormal ? 'TACHY RHYTHM' : 'NORMAL SINUS'}
              </span>
            </div>

            {/* Embedded ECG Canvas with Expanded Height (114px) */}
            <div
              style={{
                height: 114,
                width: '100%',
                background: '#070c08',
                borderRadius: 8,
                border: '1px solid rgba(122, 148, 99, 0.16)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <EcgRowCanvas
                astronautId={activeCrew.id}
                telemetry={activeTelemetry}
                height={114}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 6,
                fontSize: 9,
                color: '#cbd5e1',
                fontFamily: 'monospace',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              <span>SWEEP: 25 mm/s</span>
              <span>QTc: {activeTelemetry.computed_qtc || 405} ms</span>
              <span>R-R: {Math.round(60000 / (activeTelemetry.heart_rate || 72))} ms</span>
            </div>
          </div>

          {/* Vitals Telemetry Matrix (Elevated Inner Tiles for Clear Visual Contrast) */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(18, 26, 21, 0.96) 0%, rgba(12, 18, 15, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(122, 148, 99, 0.18)',
              borderRadius: 12,
              padding: '9px 13px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#ffffff',
                fontFamily: 'monospace',
                marginBottom: 7,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                lineHeight: 1,
              }}
            >
              <Zap size={13} style={{ color: '#a1b48e' }} />
              <span>PHYSIOLOGICAL VITAL MATRIX</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 7,
                fontFamily: 'monospace',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {/* 1. Heart Rate */}
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.92) 0%, rgba(18, 26, 20, 0.96) 100%)',
                  border: '1px solid rgba(122, 148, 99, 0.14)',
                  borderRadius: 7,
                  padding: '7px 10px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1 }}>Heart Rate</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: activeTelemetry.heart_rate > 100 ? '#fbbf24' : '#ffffff', lineHeight: 1.1 }}>
                    {activeTelemetry.heart_rate.toFixed(0)}
                  </span>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>bpm</span>
                </div>
                <div style={{ fontSize: 8.5, color: Math.abs(activeTelemetry.z_score_hr) > 1.5 ? '#fbbf24' : '#34d399', marginTop: 2, fontWeight: 700, lineHeight: 1.1 }}>
                  Z: {activeTelemetry.z_score_hr >= 0 ? '+' : ''}{activeTelemetry.z_score_hr.toFixed(1)}σ
                </div>
              </div>

              {/* 2. SpO2 */}
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.92) 0%, rgba(18, 26, 20, 0.96) 100%)',
                  border: '1px solid rgba(122, 148, 99, 0.14)',
                  borderRadius: 7,
                  padding: '7px 10px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1 }}>O₂ Saturation</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: activeTelemetry.spo2 < 97 ? '#fbbf24' : '#ffffff', lineHeight: 1.1 }}>
                    {activeTelemetry.spo2.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>%</span>
                </div>
                <div style={{ fontSize: 8.5, color: '#34d399', marginTop: 2, fontWeight: 700, lineHeight: 1.1 }}>
                  Capillary Nom
                </div>
              </div>

              {/* 3. Core Temp */}
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.92) 0%, rgba(18, 26, 20, 0.96) 100%)',
                  border: '1px solid rgba(122, 148, 99, 0.14)',
                  borderRadius: 7,
                  padding: '7px 10px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1 }}>Core Body Temp</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                    {activeTelemetry.core_temp.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>°C</span>
                </div>
                <div style={{ fontSize: 8.5, color: '#cbd5e1', marginTop: 2, fontWeight: 600, lineHeight: 1.1 }}>
                  Circadian Steady
                </div>
              </div>

              {/* 4. HRV (RMSSD) */}
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.92) 0%, rgba(18, 26, 20, 0.96) 100%)',
                  border: '1px solid rgba(122, 148, 99, 0.14)',
                  borderRadius: 7,
                  padding: '7px 10px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1 }}>HRV (RMSSD)</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                    {activeTelemetry.hrv_rmssd.toFixed(0)}
                  </span>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>ms</span>
                </div>
                <div style={{ fontSize: 8.5, color: '#cbd5e1', marginTop: 2, fontWeight: 600, lineHeight: 1.1 }}>
                  Vagal Autonomic
                </div>
              </div>
            </div>
          </div>

          {/* Blood & Fluid Chemistry Strip */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(18, 26, 21, 0.96) 0%, rgba(12, 18, 15, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(122, 148, 99, 0.18)',
              borderRadius: 12,
              padding: '9px 13px',
              fontFamily: 'monospace',
              fontVariantNumeric: 'tabular-nums',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#ffffff',
                marginBottom: 7,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                lineHeight: 1,
              }}
            >
              <Droplets size={13} style={{ color: '#a1b48e' }} />
              <span>FLUID & BIOCHEMISTRY PANEL</span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 9.5,
                background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.90) 0%, rgba(18, 26, 20, 0.94) 100%)',
                border: '1px solid rgba(122, 148, 99, 0.12)',
                borderRadius: 8,
                padding: '7px 10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', borderBottom: '1px solid rgba(148, 163, 184, 0.09)', paddingBottom: 4 }}>
                <span>Serum Potassium (K⁺):</span>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>{activeTelemetry.potassium ?? 4.4} mmol/L</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', borderBottom: '1px solid rgba(148, 163, 184, 0.09)', paddingBottom: 4 }}>
                <span>Hematocrit (HCT):</span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>{activeTelemetry.hematocrit ?? 42.0}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', borderBottom: '1px solid rgba(148, 163, 184, 0.09)', paddingBottom: 4 }}>
                <span>WBC Leukocytes:</span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>{activeTelemetry.wbc_count ?? 6.8} × 10³/µL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                <span>C-Reactive Protein (CRP):</span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>{activeTelemetry.crp ?? 0.8} mg/L</span>
              </div>
            </div>
          </div>

          {/* AI Flight Surgeon Decision Card (Redundant Workstation Button Removed) */}
          <div
            data-tour="ai-diagnostic"
            style={{
              background: isAbnormal
                ? 'linear-gradient(135deg, rgba(34, 24, 12, 0.96) 0%, rgba(20, 15, 9, 0.98) 100%)'
                : 'linear-gradient(180deg, rgba(18, 26, 21, 0.96) 0%, rgba(12, 18, 15, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: isAbnormal ? '1px solid rgba(245, 158, 11, 0.28)' : '1px solid rgba(122, 148, 99, 0.18)',
              borderRadius: 12,
              padding: '10px 13px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Sparkles size={14} style={{ color: isAbnormal ? '#fbbf24' : '#a1b48e' }} />
                <span style={{ fontSize: 10.5, fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em', fontFamily: 'monospace', lineHeight: 1 }}>
                  HELIX-AI ANALYST DIAGNOSTIC
                </span>
              </div>
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isAbnormal ? (latestAlert?.severity === 'CRITICAL' ? '#fca5a5' : '#fde047') : '#34d399',
                  background: isAbnormal ? (latestAlert?.severity === 'CRITICAL' ? 'rgba(64, 18, 26, 0.85)' : 'rgba(58, 38, 14, 0.85)') : 'rgba(16, 44, 26, 0.82)',
                  border: `1px solid ${isAbnormal ? (latestAlert?.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(245, 158, 11, 0.28)') : 'rgba(16, 185, 129, 0.24)'}`,
                  padding: '3.5px 8px',
                  borderRadius: 9999,
                }}
              >
                {isAbnormal ? (latestAlert?.severity ? `ALERT: ${latestAlert.severity}` : 'ANOMALY DETECTED') : 'NOMINAL'}
              </span>
            </div>

            {(isAbnormal || isScenarioElevated) ? (
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em' }}>
                  PROBLEM / DIAGNOSIS:
                </div>
                <div style={{ fontSize: 10, color: '#ffffff', fontWeight: 800, marginBottom: 6, lineHeight: 1.35 }}>
                  {latestAlert?.reason || latestAlert?.triage_diagnosis || activeClinical?.primaryConcern?.title || currentScenario.replace(/_/g, ' ')}
                </div>

                <div style={{ fontSize: 9, fontWeight: 800, color: (latestAlert?.severity === 'CRITICAL' || activeClinical?.severity === 'CRITICAL') ? '#fca5a5' : '#fde047', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em' }}>
                  RECOMMENDED ACTION:
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: '#f8fafc',
                    lineHeight: 1.4,
                    background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.90) 0%, rgba(18, 26, 20, 0.95) 100%)',
                    padding: '6px 9px',
                    borderRadius: 6,
                    border: `1px solid ${(latestAlert?.severity === 'CRITICAL' || activeClinical?.severity === 'CRITICAL') ? 'rgba(239, 68, 68, 0.28)' : 'rgba(245, 158, 11, 0.28)'}`,
                  }}
                >
                  {latestAlert?.actionable_instruction || activeClinical?.primaryConcern?.recommendation || 'Initiate NASA clinical countermeasure protocol and monitor.'}
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 10,
                  color: '#e2e8f0',
                  lineHeight: 1.48,
                  fontFamily: 'monospace',
                  background: 'linear-gradient(180deg, rgba(26, 36, 28, 0.90) 0%, rgba(18, 26, 20, 0.95) 100%)',
                  border: '1px solid rgba(122, 148, 99, 0.14)',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                All physiological baselines within nominal flight limits. Autonomic cardiac stability steady at 60 FPS sentry lock.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MainIndexDeck;
