import React, { useState, useMemo } from 'react';
import type { TelemetryPacket, AlertPayload, DistancePreset } from '../types/telemetry';
import { HolographicBodyScanner } from './HolographicBodyScanner';
import { EcgRowCanvas } from './EcgRowCanvas';
import { evaluateCrewClinicalSummary } from '../utils/clinicalPrioritization';
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

      {/* ─── 2. ECLSS CABIN ENVIRONMENTAL DRAWER (MAC-STYLE ROUNDED FROSTED SLAB) ─── */}
      {showEclssBar && (
        <section
          aria-label="Cabin Environmental Ribbon"
          style={{
            marginBottom: 6,
            background: 'linear-gradient(180deg, rgba(12, 18, 30, 0.65) 0%, rgba(8, 13, 22, 0.75) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
            <Wind size={15} />
            <span>ECLSS LIFE SUPPORT:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', fontSize: 11, fontFamily: 'monospace' }}>
            {/* Dynamic Cabin Pressure */}
            {(() => {
              const isDecompression = currentScenario === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA';
              const pressureVal = isDecompression ? 88.0 : 101.3;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8' }}>CABIN PRESSURE:</span>
                  <span style={{ color: isDecompression ? '#ef4444' : '#ffffff', fontWeight: 700 }}>
                    {pressureVal.toFixed(1)} kPa
                  </span>
                  <span style={{ color: isDecompression ? '#ef4444' : '#34d399', fontSize: 9.5, fontWeight: 700 }}>
                    {isDecompression ? 'CRITICAL LEAK' : 'NOMINAL'}
                  </span>
                </div>
              );
            })()}

            {/* Dynamic Oxygen Fraction */}
            {(() => {
              const isLowO2 = (activeTelemetry.spo2 ?? 98.4) < 92.0 || currentScenario === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA';
              const o2Val = isLowO2 ? 17.6 : 20.9;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8' }}>O₂ FRACTION:</span>
                  <span style={{ color: isLowO2 ? '#f59e0b' : '#ffffff', fontWeight: 700 }}>{o2Val.toFixed(1)}%</span>
                  <span style={{ color: isLowO2 ? '#f59e0b' : '#34d399', fontSize: 9.5, fontWeight: 700 }}>
                    {isLowO2 ? 'HYPOXIC' : 'STABLE'}
                  </span>
                </div>
              );
            })()}

            {/* Dynamic Cabin CO2 */}
            {(() => {
              const co2Val = activeTelemetry.cabin_co2 ?? 1.82;
              const isCrit = co2Val > 4.0;
              const isWarn = co2Val > 2.8;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8' }}>CABIN CO₂:</span>
                  <span style={{ color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#ffffff', fontWeight: 700 }}>
                    {co2Val.toFixed(2)} mmHg
                  </span>
                  <span style={{ color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#34d399', fontSize: 9.5, fontWeight: 700 }}>
                    {isCrit ? 'CRITICAL' : isWarn ? 'ELEVATED' : 'NOMINAL'}
                  </span>
                </div>
              );
            })()}

            {/* Cabin Temp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#94a3b8' }}>CABIN TEMP:</span>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>
                {activeTelemetry.core_temp ? (activeTelemetry.core_temp - 15.4).toFixed(1) : '21.4'}°C
              </span>
            </div>

            {/* Dynamic Radiation Flux */}
            {(() => {
              const radVal = activeTelemetry.radiation_flux ?? 0.04;
              const isCrit = radVal > 10.0;
              const isWarn = radVal > 0.15;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8' }}>RAD FLUX:</span>
                  <span style={{ color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#ffffff', fontWeight: 700 }}>
                    {radVal.toFixed(2)} mSv/h
                  </span>
                  <span style={{ color: isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#38bdf8', fontSize: 9.5, fontWeight: 700 }}>
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
            <button
              type="button"
              onClick={onSolveSituation}
              className="helios-solved-btn"
              title="Situation Solved — Restore all life support and crew telemetry back to Nominal"
            >
              <CheckCircle2 size={20} className="helios-solved-icon" />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: 1.15 }}>
                <span className="helios-solved-title">SOLVED</span>
                <span className="helios-solved-sub">All Nominal</span>
              </div>
            </button>
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
              background: 'linear-gradient(180deg, rgba(14, 22, 36, 0.7) 0%, rgba(10, 16, 26, 0.8) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <User size={14} style={{ color: '#38bdf8' }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                }}
              >
                CREW MANIFEST
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 9999,
                padding: 2,
                gap: 2,
              }}
            >
              <button
                onClick={() => setCrewFilter('ALL')}
                style={{
                  background: crewFilter === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  border: 'none',
                  color: crewFilter === 'ALL' ? '#38bdf8' : '#94a3b8',
                  borderRadius: 9999,
                  padding: '3px 8px',
                  fontSize: 9.5,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'all 0.14s ease',
                }}
              >
                ALL (4)
              </button>
              <button
                onClick={() => setCrewFilter('ANOMALY')}
                style={{
                  background: crewFilter === 'ANOMALY' ? 'rgba(245, 158, 11, 0.22)' : 'transparent',
                  border: 'none',
                  color: crewFilter === 'ANOMALY' ? '#fbbf24' : '#94a3b8',
                  borderRadius: 9999,
                  padding: '3px 8px',
                  fontSize: 9.5,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'all 0.14s ease',
                }}
              >
                ALERT ({CREW_ROSTER.filter(c => {
                  const t = telemetryMap[c.id];
                  return t && ((t.heart_rate ?? 60) > 100 || (t.spo2 ?? 98) < 95.0 || t.evaluated_severity === 'CRITICAL' || t.evaluated_severity === 'WARNING');
                }).length})
              </button>
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
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(18, 10, 16, 0.9) 100%)'
                      : isWarning
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(18, 14, 10, 0.9) 100%)'
                        : isSelected
                          ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.14) 0%, rgba(13, 22, 38, 0.85) 100%)'
                          : 'linear-gradient(180deg, rgba(14, 21, 35, 0.6) 0%, rgba(10, 16, 26, 0.75) 100%)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: isCritical
                      ? '1.5px solid #ef4444'
                      : isWarning
                        ? '1.5px solid #f59e0b'
                        : isSelected
                          ? '1.5px solid rgba(56, 189, 248, 0.55)'
                          : '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: 10,
                    padding: '7px 11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isCritical
                      ? '0 0 24px rgba(239, 68, 68, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      : isWarning
                        ? '0 0 18px rgba(245, 158, 11, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                        : isSelected
                          ? '0 8px 24px rgba(56, 189, 248, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          : '0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !hasAlert) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !hasAlert) {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    }
                  }}
                >
                  {/* Top Row: Avatar, Name, Role Badge, and Holo-Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Avatar with Smooth Glow Border */}
                      <div
                        style={{
                          position: 'relative',
                          width: 36,
                          height: 36,
                          borderRadius: 9999,
                          border: `2px solid ${isCritical ? '#ef4444' : isWarning ? '#f59e0b' : isSelected ? '#38bdf8' : '#10b981'}`,
                          boxShadow: `0 0 10px ${isCritical ? 'rgba(239, 68, 68, 0.45)' : isWarning ? 'rgba(245, 158, 11, 0.4)' : isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: '#0a1622',
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
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em' }}>
                            {crew.name}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              padding: '1.5px 5px',
                              borderRadius: 4,
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: '#cbd5e1',
                            }}
                          >
                            {crew.roleShort}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginTop: 1 }}>
                          {crew.crewNo} · Age {crew.age}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.16)',
                            border: '1px solid rgba(56, 189, 248, 0.45)',
                            padding: '2px 7px',
                            borderRadius: 9999,
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                          ACTIVE
                        </span>
                      )}
                      {isCritical ? (
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#fca5a5',
                            background: 'rgba(239, 68, 68, 0.22)',
                            border: '1px solid rgba(239, 68, 68, 0.6)',
                            padding: '2px 7px',
                            borderRadius: 9999,
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} />
                          CRITICAL
                        </span>
                      ) : isWarning ? (
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#fde047',
                            background: 'rgba(245, 158, 11, 0.22)',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            padding: '2px 7px',
                            borderRadius: 9999,
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
                          WARNING
                        </span>
                      ) : !isSelected ? (
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: '#34d399',
                            background: 'rgba(16, 185, 129, 0.12)',
                            padding: '2px 7px',
                            borderRadius: 9999,
                          }}
                        >
                          NOMINAL
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Vitals Spark Grid - Mac Style Rounded Inner Slab */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr',
                      gap: 6,
                      background: 'rgba(0, 0, 0, 0.35)',
                      borderRadius: 7,
                      padding: '5px 8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontFamily: 'monospace',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8' }}>HR</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: hr > 100 ? '#ef4444' : hr > 85 ? '#fbbf24' : '#ffffff',
                          marginTop: 1,
                        }}
                      >
                        {hr.toFixed(0)} <span style={{ fontSize: 8, color: '#64748b' }}>bpm</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8' }}>SPO₂</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: spo2 < 90 ? '#ef4444' : spo2 < 96.5 ? '#fbbf24' : '#ffffff',
                          marginTop: 1,
                        }}
                      >
                        {spo2.toFixed(1)}%
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8' }}>TEMP</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: temp > 37.5 ? '#fbbf24' : '#ffffff', marginTop: 1 }}>
                        {temp.toFixed(1)}°
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 8.5, color: '#94a3b8' }}>HRV</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', marginTop: 1 }}>
                        {hrv.toFixed(0)} <span style={{ fontSize: 8, color: '#64748b' }}>ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Clinical Assessment Issue Chip */}
                  {hasAlert && (
                    <div
                      style={{
                        marginTop: 7,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: isCritical ? 'rgba(239, 68, 68, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                        border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                        fontSize: 9,
                        fontWeight: 700,
                        color: isCritical ? '#fca5a5' : '#fde047',
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

                  {/* Bottom Action Footer for Card */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      fontSize: 9,
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#38bdf8', fontSize: 7 }}>●</span>
                      {crew.specialty.split('&')[0].trim()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTriage(crew.id);
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#38bdf8',
                        fontSize: 9,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>TRIAGE CLINICAL</span>
                      <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tactical Mission Protocol Sensor Status */}
          <div
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(180deg, rgba(14, 21, 35, 0.5) 0%, rgba(9, 14, 24, 0.7) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 14,
              fontSize: 10,
              color: '#94a3b8',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
            }}
          >
            <div style={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={12} />
              <span>CREW TELEMETRY LINK</span>
            </div>
            <span style={{ color: '#34d399', fontSize: 8.5, fontWeight: 700 }}>ONLINE</span>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────────
            CENTER FLANK: THE 3D HOLOGRAPHIC BIO-TWIN SCANNER VIEWPORT
           ───────────────────────────────────────────────────────────── */}
        <main className="helios-center-flank">
          {/* Holo-Bay Cyber Frame Header with Mac-Style Traffic Light Beacons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              background: 'linear-gradient(180deg, rgba(15, 23, 40, 0.8) 0%, rgba(9, 14, 25, 0.9) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderBottom: 'none',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Mac-Style Subtle Window Indicator Bullets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#f43f5e', opacity: 0.85 }} />
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#f59e0b', opacity: 0.85 }} />
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#10b981', opacity: 0.85 }} />
              </div>

              <span
                style={{
                  fontFamily: "var(--hud-font-brand, 'Orbitron', sans-serif)",
                  fontSize: 13,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '0.06em',
                }}
              >
                HOLOGRAPHIC BIO-TWIN // {activeCrew.crewNo} {activeCrew.name.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontWeight: 700,
                }}
              >
                {activeCrew.role}
              </span>

              {/* Real-time Dynamic Clinical Badge on 3D Header */}
              {activeClinical.isAbnormal && (
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: activeClinical.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(245, 158, 11, 0.22)',
                    color: activeClinical.severity === 'CRITICAL' ? '#fca5a5' : '#fde047',
                    border: activeClinical.severity === 'CRITICAL' ? '1px solid #ef4444' : '1px solid #f59e0b',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: activeClinical.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                    boxShadow: `0 0 6px ${activeClinical.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}`,
                  }} />
                  {activeClinical.primaryConcern.title}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
              {activeClinical.isAbnormal ? (
                <span style={{ color: activeClinical.severity === 'CRITICAL' ? '#f87171' : '#fbbf24', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} />
                  <span>PHYSIOLOGICAL STRAIN FLAGGED</span>
                </span>
              ) : (
                <span>DRAG TO ROTATE 360°</span>
              )}
            </div>
          </div>

          {/* Embedded 3D Holographic Body Scanner Container with Mac-Style Rounded Base */}
          <div
            data-tour="bio-twin"
            style={{
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), inset 0 0 24px rgba(56, 189, 248, 0.04)',
            }}
          >
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

          {/* Bottom Hotspot Clinical Action Banner - Mac Style Frosted Slab */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 12px',
              background: 'linear-gradient(180deg, rgba(14, 21, 35, 0.7) 0%, rgba(9, 14, 24, 0.8) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              fontSize: 10.5,
              fontFamily: 'monospace',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crosshair size={15} style={{ color: '#38bdf8' }} />
              <span style={{ color: '#ffffff', fontWeight: 800 }}>
                ORGAN FOCUS: {activeSubsystem}
              </span>
              <span style={{ color: '#94a3b8' }}>
                {activeSubsystem === 'CARDIAC'
                  ? 'Myocardium & Rhythm Assessment'
                  : activeSubsystem === 'OCULAR'
                    ? 'Retinal Nerve Fiber Layer & SANS Risk'
                    : activeSubsystem === 'RENAL'
                      ? 'Calculi & Electrolyte Balance'
                      : 'Bone Mineral Density Load Protocol'}
              </span>
            </div>

            <button
              onClick={() => onOpenTriage(activeCrew.id)}
              style={{
                background: 'rgba(56, 189, 248, 0.16)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                borderRadius: 9999,
                padding: '5px 14px',
                color: '#38bdf8',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                letterSpacing: '0.04em',
                transition: 'all 0.16s ease',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.28)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.16)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <span>DEEP CLINICAL REPORT</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </main>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT FLANK: REAL-TIME ECG WAVEFORM & CLINICAL DIAGNOSTICS LAB
           ───────────────────────────────────────────────────────────── */}
        <aside className="helios-right-flank">
          {/* Live ECG Rhythm Strip Card (Mac-Style Card) */}
          <div
            data-tour="live-ecg"
            style={{
              background: 'linear-gradient(180deg, rgba(14, 21, 35, 0.7) 0%, rgba(9, 14, 24, 0.8) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '8px 13px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Heart
                  size={14}
                  style={{
                    color: isAbnormal ? '#f43f5e' : '#38bdf8',
                  }}
                />
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                  }}
                >
                  LIVE LEAD II ECG WAVEFORM
                </span>
              </div>

              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: isAbnormal ? '#fb7185' : '#34d399',
                  background: isAbnormal ? 'rgba(244, 63, 94, 0.16)' : 'rgba(16, 185, 129, 0.14)',
                  border: `1px solid ${isAbnormal ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.35)'}`,
                  padding: '2px 7px',
                  borderRadius: 9999,
                }}
              >
                {isAbnormal ? 'TACHY RHYTHM' : 'NORMAL SINUS'}
              </span>
            </div>

            {/* Embedded ECG Canvas with Rounded Inset */}
            <div
              style={{
                height: 62,
                width: '100%',
                background: '#020409',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.06)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <EcgRowCanvas
                astronautId={activeCrew.id}
                telemetry={activeTelemetry}
                height={62}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 5,
                fontSize: 8.5,
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              <span>SWEEP: 25 mm/s</span>
              <span>QTc: {activeTelemetry.computed_qtc || 405} ms</span>
              <span>R-R: {Math.round(60000 / (activeTelemetry.heart_rate || 72))} ms</span>
            </div>
          </div>

          {/* Vitals Telemetry Matrix (Mac-Style Card with 4 Refined Tiles) */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(14, 21, 35, 0.7) 0%, rgba(9, 14, 24, 0.8) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '8px 13px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#ffffff',
                fontFamily: 'monospace',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Zap size={13} style={{ color: '#38bdf8' }} />
              <span>PHYSIOLOGICAL VITAL MATRIX</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 7,
                fontFamily: 'monospace',
              }}
            >
              {/* 1. Heart Rate */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 7,
                  padding: '6px 9px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase' }}>Heart Rate</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: activeTelemetry.heart_rate > 100 ? '#fbbf24' : '#ffffff' }}>
                    {activeTelemetry.heart_rate.toFixed(0)}
                  </span>
                  <span style={{ fontSize: 9, color: '#64748b' }}>bpm</span>
                </div>
                <div style={{ fontSize: 8, color: Math.abs(activeTelemetry.z_score_hr) > 1.5 ? '#fbbf24' : '#34d399', marginTop: 1, fontWeight: 600 }}>
                  Z: {activeTelemetry.z_score_hr >= 0 ? '+' : ''}{activeTelemetry.z_score_hr.toFixed(1)}σ
                </div>
              </div>

              {/* 2. SpO2 */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 7,
                  padding: '6px 9px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase' }}>O₂ Saturation</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: activeTelemetry.spo2 < 97 ? '#fbbf24' : '#ffffff' }}>
                    {activeTelemetry.spo2.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 9, color: '#64748b' }}>%</span>
                </div>
                <div style={{ fontSize: 8, color: '#34d399', marginTop: 1, fontWeight: 600 }}>
                  Capillary Nom
                </div>
              </div>

              {/* 3. Core Temp */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 7,
                  padding: '6px 9px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase' }}>Core Body Temp</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                    {activeTelemetry.core_temp.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 9, color: '#64748b' }}>°C</span>
                </div>
                <div style={{ fontSize: 8, color: '#cbd5e1', marginTop: 1 }}>
                  Circadian Steady
                </div>
              </div>

              {/* 4. HRV (RMSSD) */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 7,
                  padding: '6px 9px',
                }}
              >
                <div style={{ fontSize: 8.5, color: '#94a3b8', textTransform: 'uppercase' }}>HRV (RMSSD)</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                    {activeTelemetry.hrv_rmssd.toFixed(0)}
                  </span>
                  <span style={{ fontSize: 9, color: '#64748b' }}>ms</span>
                </div>
                <div style={{ fontSize: 8, color: '#cbd5e1', marginTop: 1 }}>
                  Vagal Autonomic
                </div>
              </div>
            </div>
          </div>

          {/* Blood & Fluid Chemistry Strip */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(14, 21, 35, 0.7) 0%, rgba(9, 14, 24, 0.8) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '8px 13px',
              fontFamily: 'monospace',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#ffffff',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Droplets size={13} style={{ color: '#38bdf8' }} />
              <span>FLUID & BIOCHEMISTRY PANEL</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4.5, fontSize: 9.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>Serum Potassium (K⁺):</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{activeTelemetry.potassium ?? 4.4} mmol/L</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>Hematocrit (HCT):</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{activeTelemetry.hematocrit ?? 42.0}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>WBC Leukocytes:</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{activeTelemetry.wbc_count ?? 6.8} × 10³/µL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>C-Reactive Protein (CRP):</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{activeTelemetry.crp ?? 0.8} mg/L</span>
              </div>
            </div>
          </div>

          {/* AI Flight Surgeon Decision Card (Mac-Style Card) */}
          <div
            data-tour="ai-diagnostic"
            style={{
              background: isAbnormal
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(20, 14, 8, 0.85) 100%)'
                : 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(10, 16, 28, 0.85) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: isAbnormal ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 12,
              padding: '8px 13px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Sparkles size={14} style={{ color: isAbnormal ? '#fbbf24' : '#38bdf8' }} />
                <span style={{ fontSize: 10.5, fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em', fontFamily: 'monospace' }}>
                  HELIX-AI ANALYST DIAGNOSTIC
                </span>
              </div>
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: isAbnormal ? (latestAlert?.severity === 'CRITICAL' ? '#ef4444' : '#fbbf24') : '#38bdf8',
                  background: isAbnormal ? (latestAlert?.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)') : 'rgba(56, 189, 248, 0.16)',
                  padding: '2px 7px',
                  borderRadius: 9999,
                }}
              >
                {isAbnormal ? (latestAlert?.severity ? `ALERT: ${latestAlert.severity}` : 'ANOMALY DETECTED') : 'NOMINAL'}
              </span>
            </div>

            {(isAbnormal || isScenarioElevated) ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em' }}>
                  PROBLEM / DIAGNOSIS:
                </div>
                <div style={{ fontSize: 10, color: '#f8fafc', fontWeight: 700, marginBottom: 6, lineHeight: 1.35 }}>
                  {latestAlert?.reason || latestAlert?.triage_diagnosis || activeClinical?.primaryConcern?.title || currentScenario.replace(/_/g, ' ')}
                </div>

                <div style={{ fontSize: 9, fontWeight: 800, color: (latestAlert?.severity === 'CRITICAL' || activeClinical?.severity === 'CRITICAL') ? '#f87171' : '#fbbf24', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em' }}>
                  RECOMMENDED ACTION:
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: '#e2e8f0',
                    lineHeight: 1.35,
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '6px 9px',
                    borderRadius: 6,
                    border: `1px solid ${(latestAlert?.severity === 'CRITICAL' || activeClinical?.severity === 'CRITICAL') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  }}
                >
                  {latestAlert?.actionable_instruction || activeClinical?.primaryConcern?.recommendation || 'Initiate NASA clinical countermeasure protocol and monitor.'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.45, marginBottom: 8, fontFamily: 'monospace' }}>
                All physiological baselines within nominal flight limits. Autonomic cardiac stability steady at 60 FPS sentry lock.
              </div>
            )}

            <button
              onClick={() => onOpenTriage(activeCrew.id)}
              style={{
                width: '100%',
                background: isAbnormal
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.35) 0%, rgba(217, 119, 6, 0.25) 100%)'
                  : 'linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(2, 132, 199, 0.2) 100%)',
                border: `1px solid ${isAbnormal ? 'rgba(245, 158, 11, 0.6)' : 'rgba(56, 189, 248, 0.5)'}`,
                borderRadius: 8,
                padding: '8px 14px',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 800,
                fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isAbnormal
                  ? '0 4px 16px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  : '0 4px 16px rgba(56, 189, 248, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.filter = 'brightness(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.filter = 'none';
              }}
            >
              <span>LAUNCH FULL CLINICAL WORKSTATION</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MainIndexDeck;
