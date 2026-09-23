import React, { useState, useEffect, useMemo } from 'react';
import type { TelemetryPacket, CrewFullLabProfile, AlertPayload } from '../types/telemetry';
import { fetchCrewLabProfile } from '../services/labAssayService';
import { HeaderBar } from './HeaderBar';

interface HealthTelemetryViewProps {
  initialAstronautId?: string | null;
  telemetryMap: Record<string, TelemetryPacket>;
  onClose: () => void;
  marsDelay: boolean;
  connected?: boolean;
  onToggleMarsDelay?: (enabled: boolean) => void;
  activeView?: 'HUD' | 'HEALTH_TELEMETRY';
  onSelectView?: (view: 'HUD' | 'HEALTH_TELEMETRY') => void;
  latestAlert?: AlertPayload | null;
  onAstronautChange?: (astronautId: string) => void;
}

interface CrewMeta {
  id: string;
  name: string;
  role: string;
  age: number;
  callsign: string;
}

const CREW_MEMBERS: CrewMeta[] = [
  { id: 'AST-01_COMMANDER', name: 'Cmndr Haley', role: 'Mission Commander', age: 38, callsign: 'HALEY' },
  { id: 'AST-02_PILOT', name: 'Pilot Chris', role: 'Flight Pilot', age: 42, callsign: 'CHRIS' },
  { id: 'AST-03_MEDICAL', name: 'Dr. Sian', role: 'Medical Specialist', age: 29, callsign: 'SIAN' },
  { id: 'AST-04_ENGINEER', name: 'Specialist Leo', role: 'Systems Engineer', age: 45, callsign: 'LEO' },
];

interface DeviceMeta {
  id: number;
  name: string;
  type: 'Wearable' | 'Cabin Environmental' | 'Point-of-Care Lab' | 'Computational Engine';
  parameter: string;
  source: string;
  status: 'Streaming' | 'Nominal' | 'Calibrated';
}

const FLIGHT_DEVICES: DeviceMeta[] = [
  { id: 1, name: 'Cardiac Monitor / Holter', type: 'Wearable', parameter: 'Lead II ECG, HR, HRV', source: 'Bio-Telemetry Pod', status: 'Streaming' },
  { id: 2, name: 'Pulse Oximeter (PPG)', type: 'Wearable', parameter: 'SpO₂, Peripheral Pulse', source: 'Digital Optode', status: 'Streaming' },
  { id: 3, name: 'Ingestible Core Temp Sensor', type: 'Wearable', parameter: 'Core Body Temperature', source: 'CorTemp Telemetry Capsule', status: 'Streaming' },
  { id: 4, name: 'Actigraphy Sleep Tracker', type: 'Wearable', parameter: 'Sleep Score, Circadian Rest', source: 'Actiwatch / IMU Pod', status: 'Nominal' },
  { id: 5, name: 'Radiation Dosimeter Badge', type: 'Wearable', parameter: 'GCR Flux, Absorbed Dose', source: 'Active Tissue-Equivalent Counter', status: 'Streaming' },
  { id: 6, name: 'Cabin CO₂ Life-Support Monitor', type: 'Cabin Environmental', parameter: 'Partial Pressure CO₂', source: 'CDRA Optical Gas Sensor', status: 'Streaming' },
  { id: 7, name: 'Hematology Analyzer', type: 'Point-of-Care Lab', parameter: 'CBC: All 20 Morphology Markers', source: 'NASA OSDR OSD-569 Microfluidic', status: 'Calibrated' },
  { id: 8, name: 'Clinical Chemistry Analyzer', type: 'Point-of-Care Lab', parameter: 'CMP: All 19 Chemistry Markers', source: 'NASA OSDR OSD-575 Assay', status: 'Calibrated' },
  { id: 9, name: 'Multiplex Bead Immunoassay', type: 'Point-of-Care Lab', parameter: 'Cytokines: All 71 Immune Markers', source: 'NASA OSDR OSD-575 Luminex', status: 'Calibrated' },
  { id: 10, name: 'Cardiovascular Protein Analyzer', type: 'Point-of-Care Lab', parameter: 'All 9 Acute-Phase CV Proteins', source: 'NASA OSDR OSD-575 Acute Phase', status: 'Calibrated' },
  { id: 11, name: 'Z-Score Baseline Comparator', type: 'Computational Engine', parameter: 'Individualized σ-drift', source: 'Bayesian Gaussian Evaluator', status: 'Nominal' },
  { id: 12, name: 'Fridericia QTc Engine', type: 'Computational Engine', parameter: 'Rate-corrected QT interval', source: 'Continuous Electrocardiography', status: 'Nominal' },
  { id: 13, name: 'Arrhythmogenic Risk (ARF)', type: 'Computational Engine', parameter: 'Electrolyte-Coupled Cardiac Risk', source: 'Multi-parametric Risk Matrix', status: 'Nominal' },
  { id: 14, name: 'Thrombosis Risk Metric (TRM)', type: 'Computational Engine', parameter: 'Virchow Triad Microgravity Stasis', source: 'Hemoconcentration Engine', status: 'Nominal' },
  { id: 15, name: 'Radiation Sickness Index (RSI)', type: 'Computational Engine', parameter: 'Acute GCR Exposure Index', source: 'Radiobiological Decay Model', status: 'Nominal' },
];

export const HealthTelemetryView: React.FC<HealthTelemetryViewProps> = ({
  initialAstronautId,
  telemetryMap,
  onClose,
  marsDelay,
  connected,
  onToggleMarsDelay,
  activeView,
  onSelectView,
  latestAlert,
  onAstronautChange,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialAstronautId || 'AST-01_COMMANDER'
  );

  // Synchronize when parent route changes (e.g. back/forward navigation)
  useEffect(() => {
    if (initialAstronautId && initialAstronautId !== selectedId) {
      setSelectedId(initialAstronautId);
    }
  }, [initialAstronautId]);

  const [deviceFilter, setDeviceFilter] = useState<'ALL' | 'WEARABLE' | 'LAB' | 'ENGINE'>('ALL');
  const [labProfile, setLabProfile] = useState<CrewFullLabProfile | null>(null);

  // Expandable Category Drawers
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [immuneClusterTab, setImmuneClusterTab] = useState<
    'pyrogens' | 'interferons' | 'interleukins' | 'chemokines' | 'growth'
  >('pyrogens');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch authentic NASA OSDR lab profile on astronaut change
  useEffect(() => {
    let isMounted = true;
    fetchCrewLabProfile(selectedId).then((profile) => {
      if (isMounted && profile) {
        setLabProfile(profile);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  const currentPacket: TelemetryPacket | undefined = useMemo(() => {
    return (
      telemetryMap[selectedId] ||
      (selectedId === 'AST-03_MEDICAL' ? telemetryMap['AST-03_MEDICAL_SPECIALIST'] : undefined) ||
      (selectedId === 'AST-04_ENGINEER' ? telemetryMap['AST-04_MISSION_SPECIALIST'] : undefined)
    );
  }, [telemetryMap, selectedId]);

  const activeCrew = useMemo(() => {
    return CREW_MEMBERS.find((c) => c.id === selectedId) || CREW_MEMBERS[0];
  }, [selectedId]);

  // Real-time telemetry metrics
  const hr = currentPacket?.heart_rate ?? 65.0;
  const hrv = currentPacket?.hrv_rmssd ?? 62.0;
  const spo2 = currentPacket?.spo2 ?? 98.2;
  const temp = currentPacket?.core_temp ?? 36.8;
  const co2 = currentPacket?.cabin_co2 ?? 1.8;
  const sleep = currentPacket?.sleep_score ?? 85.0;
  const k = currentPacket?.potassium ?? (labProfile?.cmp?.potassium?.value ?? 4.2);
  const hct = currentPacket?.hematocrit ?? (labProfile?.cbc?.hematocrit?.value ?? 44.5);
  const wbc = currentPacket?.wbc_count ?? (labProfile?.cbc?.white_blood_cells?.value ?? 6.8);
  const il6 = currentPacket?.il_6 ?? (labProfile?.immune?.clusters?.pyrogens_and_inflammatory?.il_6?.concentration_pg_ml ?? 6.2);
  const plt = currentPacket?.platelet_count ?? (labProfile?.cbc?.platelets?.value ?? 245.0);
  const crp = currentPacket?.crp ?? (labProfile?.cardiovascular?.crp?.value ?? 1.2);
  const qtc = currentPacket?.computed_qtc ?? 402.0;
  const arf = currentPacket?.computed_arf ?? 0.72;
  const trm = currentPacket?.computed_trm ?? 1.02;
  const rsi = currentPacket?.computed_rsi ?? 0.12;
  const radFlux = currentPacket?.radiation_flux ?? 0.04;
  const radDose = currentPacket?.radiation_dose_gy ?? 0.05;
  const alc = currentPacket?.lymphocyte_count ?? (labProfile?.cbc?.absolute_lymphocytes?.value ? (labProfile.cbc.absolute_lymphocytes.value / 1000) : 2.15);
  const severity = currentPacket?.evaluated_severity ?? 'NOMINAL';

  const sysBp = Math.round(112 + (hr - 60) * 0.35);
  const diaBp = Math.round(72 + (hr - 60) * 0.18);
  const respRate = Math.round(13 + (hr > 100 ? 5 : hr > 80 ? 2 : 0) + (spo2 < 95 ? 4 : 0));

  // Authentic OSDR fallback values
  const sodiumVal = labProfile?.cmp?.sodium?.value ? `${labProfile.cmp.sodium.value} mmol/L` : '139.2 mmol/L';
  const glucoseVal = labProfile?.cmp?.glucose?.value ? `${labProfile.cmp.glucose.value} mg/dL` : '92 mg/dL';
  const albuminVal = labProfile?.cmp?.albumin?.value ? `${labProfile.cmp.albumin.value} g/dL` : '4.4 g/dL';
  const bunVal = labProfile?.cmp?.bun?.value ? `${labProfile.cmp.bun.value} mg/dL` : '14 mg/dL';
  const tnfVal = labProfile?.immune?.clusters?.pyrogens_and_inflammatory?.tnf_alpha?.concentration_pg_ml
    ? `${labProfile.immune.clusters.pyrogens_and_inflammatory.tnf_alpha.concentration_pg_ml} pg/mL`
    : '4.8 pg/mL';
  const fibrinogenVal = labProfile?.cardiovascular?.fibrinogen?.value
    ? `${(labProfile.cardiovascular.fibrinogen.value / 1000000).toFixed(0)} mg/dL`
    : '280 mg/dL';

  const healthPercent = useMemo(() => {
    if (severity === 'CRITICAL') return 58;
    if (severity === 'WARNING') return 76;
    if (severity === 'INFO') return 88;
    return 96;
  }, [severity]);

  const overallPill = useMemo(() => {
    if (severity === 'CRITICAL') return { label: 'Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)' };
    if (severity === 'WARNING') return { label: 'Attention', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' };
    return { label: 'Stable', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.14)' };
  }, [severity]);

  const filteredDevices = useMemo(() => {
    if (deviceFilter === 'WEARABLE') return FLIGHT_DEVICES.filter((d) => d.type === 'Wearable');
    if (deviceFilter === 'LAB') return FLIGHT_DEVICES.filter((d) => d.type === 'Point-of-Care Lab');
    if (deviceFilter === 'ENGINE') return FLIGHT_DEVICES.filter((d) => d.type === 'Computational Engine');
    return FLIGHT_DEVICES;
  }, [deviceFilter]);

  const toggleExpand = (cardNumber: number) => {
    setExpandedCard((prev) => (prev === cardNumber ? null : cardNumber));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        backgroundColor: '#070707',
        color: '#f8fafc',
        fontFamily: 'var(--hud-font-sans, "Tomorrow", system-ui, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1250px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          borderLeft: '1px solid #1a1a1a',
          borderRight: '1px solid #1a1a1a',
          backgroundColor: '#070707',
        }}
      >
        {/* ── UNIFIED MAIN HEADER WITH BRAND LOGO & SYSTEM CONTROLS ──────── */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(10, 10, 10, 0.96)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid #1f1f1f',
            padding: '0 24px',
          }}
        >
          <HeaderBar
            connected={connected ?? true}
            marsDelay={marsDelay}
            onToggleMarsDelay={onToggleMarsDelay || (() => { })}
            activeView={activeView || 'HEALTH_TELEMETRY'}
            onSelectView={onSelectView || ((v) => { if (v === 'HUD') onClose(); })}
            latestAlert={latestAlert}
            selectedAstronautId={selectedId}
          />
        </div>

        {/* ── STREAMLINED HERO COMMAND BAR (COMPACT, HIGH-DENSITY, ZERO FLUFF) ── */}
        <div
          style={{
            padding: '12px 24px',
            background: '#0a0a0a',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          {/* LEFT: Dominant Hero Health Score (Title over Percentage) & Crew Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Health Score Block: Title over Percentage */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#888888', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Tomorrow', sans-serif" }}>
                Health Score
              </span>
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: 800,
                  color: overallPill.color,
                  fontFamily: "'Tomorrow', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {healthPercent}%
              </span>
            </div>

            {/* Crew Info: Minimal Name & Subtitle below */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f3f4f6', letterSpacing: '-0.01em' }}>
                {activeCrew.name}
              </div>
              <div style={{ fontSize: '10px', color: '#737373', letterSpacing: '0.01em' }}>
                Inspiration4 (C001)
              </div>
            </div>
          </div>

          {/* CENTER: Concise Vital Indicators (No bulky containers, Tomorrow font, Sharp icons) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {/* Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#666666', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Tomorrow', sans-serif" }}>
                Alerts
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {severity === 'CRITICAL' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : severity === 'WARNING' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                )}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: severity === 'CRITICAL' ? '#ef4444' : severity === 'WARNING' ? '#f59e0b' : '#22c55e',
                    fontFamily: "'Tomorrow', sans-serif",
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {severity === 'NOMINAL' ? '0' : '1'}
                </span>
              </div>
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#1c1c1c' }} />

            {/* Biomarkers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#666666', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Tomorrow', sans-serif" }}>
                Biomarkers
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f3f4f6', fontFamily: "'Tomorrow', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  149 / 149
                </span>
              </div>
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#1c1c1c' }} />

            {/* Telemetry Bus */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#666666', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Tomorrow', sans-serif" }}>
                Telemetry Bus
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#e5e5e5', fontFamily: "'Tomorrow', sans-serif" }}>
                  {marsDelay ? '22m Delay' : 'Live · 10 Hz'}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Compact Astronaut Selection Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {CREW_MEMBERS.map((crew) => {
              const isSelected = crew.id === selectedId;
              const crewPacket = telemetryMap[crew.id];
              const crewSev = crewPacket?.evaluated_severity || 'NOMINAL';
              const dotColor =
                crewSev === 'CRITICAL' ? '#ef4444' : crewSev === 'WARNING' ? '#f59e0b' : '#22c55e';
              const roleShort = crew.id.includes('COMMANDER') ? 'CDR' : crew.id.includes('PILOT') ? 'PLT' : crew.id.includes('MEDICAL') ? 'MED' : 'ENG';
              const shortName = crew.name.replace('Cmndr ', '').replace('Pilot ', '').replace('Dr. ', '').replace('Specialist ', '');

              return (
                <button
                  key={crew.id}
                  onClick={() => {
                    setSelectedId(crew.id);
                    onAstronautChange?.(crew.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '9999px',
                    border: isSelected ? '1px solid #525252' : '1px solid #222222',
                    background: isSelected ? '#222222' : '#111111',
                    color: isSelected ? '#ffffff' : '#737373',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 500,
                    fontFamily: "'Tomorrow', sans-serif",
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: dotColor }} />
                  <span>{shortName}</span>
                  <span style={{ fontSize: '8px', opacity: 0.65, fontWeight: 700 }}>{roleShort}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. MAIN CONTENT: 10 CATEGORICAL CARDS + DEDICATED FULL-HEIGHT SIDEBAR */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            alignItems: 'stretch',
            minHeight: 'calc(100vh - 280px)',
          }}
        >
          {/* Left Column: 10 Health Categories */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                Subsystems &amp; Biomarkers for {activeCrew.name}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', display: 'flex', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} /> Live
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} /> OSDR Lab
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> Abnormal
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '14px',
              }}
            >
              {/* 1. Cardiovascular (14 Signals) */}
              <CategoryCard
                title="1. Cardiovascular"
                icon={<HeartIcon />}
                statusPill={{ label: hr > 100 || arf >= 0.85 ? 'Attention' : 'Stable', color: hr > 100 || arf >= 0.85 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Heart rate', value: `${hr.toFixed(0)} bpm`, dotColor: hr > 100 ? '#f59e0b' : '#22c55e', trend: hr > 100 ? 'up' : 'stable' },
                  { label: 'ECG / Cardiac rhythm', value: hr > 115 ? 'Tachycardia' : hr < 50 ? 'Bradycardia' : 'Normal', dotColor: hr > 115 ? '#f59e0b' : '#22c55e', trend: 'stable' },
                  { label: 'Blood pressure', value: `${sysBp}/${diaBp} mmHg`, dotColor: '#94a3b8' },
                  { label: 'Arrhythmia detection', value: arf >= 0.85 ? 'Elevated risk' : 'None', dotColor: arf >= 0.85 ? '#ef4444' : '#22c55e', trend: 'stable' },
                  { label: 'Fridericia QTc', value: `${qtc.toFixed(0)} ms`, dotColor: qtc >= 485 ? '#ef4444' : '#22c55e', trend: qtc >= 485 ? 'up' : 'stable' },
                  ...(expandedCard === 1
                    ? [
                      { label: 'Fibrinogen (OSD-575)', value: fibrinogenVal, dotColor: '#94a3b8' },
                      { label: 'C-reactive protein (CRP)', value: `${crp.toFixed(1)} mg/L`, dotColor: crp > 5.0 ? '#f59e0b' : '#22c55e' },
                      { label: 'L-selectin adhesion', value: labProfile?.cardiovascular?.l_selectin?.value ? `${(labProfile.cardiovascular.l_selectin.value / 1000).toFixed(0)} ng/mL` : '740 ng/mL', dotColor: '#94a3b8' },
                      { label: 'Platelet factor 4 (PF4)', value: labProfile?.cardiovascular?.pf4?.value ? `${labProfile.cardiovascular.pf4.value.toFixed(0)} ng/mL` : '320 ng/mL', dotColor: '#94a3b8' },
                      { label: 'Haptoglobin', value: labProfile?.cardiovascular?.haptoglobin?.value ? `${(labProfile.cardiovascular.haptoglobin.value / 1000000).toFixed(2)} mg/mL` : '1.10 mg/mL', dotColor: '#94a3b8' },
                      { label: 'A2-macroglobulin', value: labProfile?.cardiovascular?.a2_macroglobulin?.value ? `${(labProfile.cardiovascular.a2_macroglobulin.value / 1000000).toFixed(2)} mg/mL` : '1.85 mg/mL', dotColor: '#94a3b8' },
                      { label: 'Alpha-1 acid glycoprotein', value: labProfile?.cardiovascular?.agp?.value ? `${(labProfile.cardiovascular.agp.value / 1000000).toFixed(2)} mg/mL` : '0.65 mg/mL', dotColor: '#94a3b8' },
                      { label: 'Fetuin-A36', value: labProfile?.cardiovascular?.fetuin_a36?.value ? `${(labProfile.cardiovascular.fetuin_a36.value / 1000000).toFixed(2)} mg/mL` : '0.38 mg/mL', dotColor: '#94a3b8' },
                      { label: 'Serum amyloid P (SAP)', value: labProfile?.cardiovascular?.sap?.value ? `${(labProfile.cardiovascular.sap.value / 1000).toFixed(1)} μg/mL` : '24.5 μg/mL', dotColor: '#94a3b8' },
                    ]
                    : []),
                ]}
                actionButton={{
                  label: expandedCard === 1 ? 'Collapse CV Panel ▲' : 'All 14 CV Biomarkers (OSD-575) ▼',
                  onClick: () => toggleExpand(1),
                }}
              />

              {/* 2. Respiratory (6 Signals) */}
              <CategoryCard
                title="2. Respiratory & Atmosphere"
                icon={<LungsIcon />}
                statusPill={{ label: spo2 < 95 || co2 >= 3.0 ? 'Attention' : 'Stable', color: spo2 < 95 || co2 >= 3.0 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'SpO₂ (Oxygen saturation)', value: `${spo2.toFixed(0)} %`, dotColor: spo2 < 94 ? '#ef4444' : spo2 < 96 ? '#f59e0b' : '#22c55e', trend: spo2 < 96 ? 'down' : 'stable' },
                  { label: 'Respiratory rate', value: `${respRate} /min`, dotColor: respRate > 20 ? '#f59e0b' : '#22c55e' },
                  { label: 'Oxygen availability', value: '20.9 %', dotColor: '#22c55e' },
                  { label: 'CO₂ level (CDRA)', value: `${co2.toFixed(1)} mmHg`, dotColor: co2 >= 3.0 ? '#f59e0b' : '#22c55e', trend: co2 >= 3.0 ? 'up' : 'stable' },
                  { label: 'Cabin pressure', value: '101.3 kPa', dotColor: '#38bdf8' },
                  { label: 'Ventilation air exchange', value: '0.45 m/s', dotColor: '#22c55e' },
                ]}
              />

              {/* 3. Temperature (4 Signals) */}
              <CategoryCard
                title="3. Temperature"
                icon={<TempIcon />}
                statusPill={{ label: temp >= 37.5 ? 'Attention' : 'Stable', color: temp >= 37.5 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Core body temperature', value: `${temp.toFixed(1)} °C`, dotColor: temp >= 38.3 ? '#ef4444' : temp >= 37.5 ? '#f59e0b' : '#22c55e', trend: temp >= 37.5 ? 'up' : 'stable' },
                  { label: 'Cabin temperature', value: '21.4 °C', dotColor: '#22c55e', trend: 'stable' },
                  { label: 'Thermal drift rate', value: temp >= 37.5 ? '+0.4 °C/h' : '0.0 °C/h', dotColor: temp >= 37.5 ? '#f59e0b' : '#22c55e' },
                  { label: 'Heat equilibrium', value: temp >= 37.5 ? 'Heat retention' : 'Equilibrium', dotColor: temp >= 37.5 ? '#f59e0b' : '#22c55e' },
                ]}
              />

              {/* 4. Neurological & Fatigue (5 Signals) */}
              <CategoryCard
                title="4. Neurological & Fatigue"
                icon={<BrainIcon />}
                statusPill={{ label: sleep < 70 ? 'Attention' : 'Nominal', color: sleep < 70 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Actigraphy sleep score', value: `${sleep.toFixed(0)} / 100`, dotColor: sleep < 65 ? '#f59e0b' : '#22c55e', trend: sleep < 70 ? 'down' : 'stable' },
                  { label: 'Autonomic nervous tone', value: hrv < 45 ? 'Sympathetic strain' : 'Balanced', dotColor: hrv < 45 ? '#f59e0b' : '#22c55e' },
                  { label: 'Neurological response', value: 'Alert / Normal', dotColor: '#22c55e', trend: 'stable' },
                  { label: 'Circadian phase status', value: 'Phase II (Active)', dotColor: '#38bdf8' },
                  { label: 'Autonomic σ-drift', value: `${Math.abs(currentPacket?.z_score_hrv ?? 0.2).toFixed(1)} σ`, dotColor: Math.abs(currentPacket?.z_score_hrv ?? 0) > 2.0 ? '#f59e0b' : '#22c55e' },
                ]}
              />

              {/* 5. Complete Blood Count (OSD-569 — 20 Signals) */}
              <CategoryCard
                title="5. Hematology (OSD-569 CBC)"
                icon={<ShieldIcon />}
                statusPill={{ label: il6 >= 15.0 || wbc > 12.0 ? 'Attention' : 'Nominal', color: il6 >= 15.0 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Hematocrit (HCT)', value: `${hct.toFixed(1)} %`, dotColor: '#22c55e' },
                  { label: 'White blood cells (WBC)', value: `${wbc.toFixed(1)} k/μL`, dotColor: wbc > 12.0 ? '#ef4444' : '#22c55e' },
                  { label: 'Platelets (PLT)', value: `${plt.toFixed(0)} k/μL`, dotColor: '#22c55e' },
                  { label: 'Hemoglobin (Hgb)', value: labProfile?.cbc?.hemoglobin?.value ? `${labProfile.cbc.hemoglobin.value} g/dL` : '15.1 g/dL', dotColor: '#22c55e' },
                  { label: 'Red blood cells (RBC)', value: labProfile?.cbc?.red_blood_cells?.value ? `${labProfile.cbc.red_blood_cells.value} M/μL` : '4.85 M/μL', dotColor: '#22c55e' },
                  ...(expandedCard === 5
                    ? [
                      { label: 'Absolute neutrophils', value: labProfile?.cbc?.absolute_neutrophils?.value ? `${labProfile.cbc.absolute_neutrophils.value} /μL` : '4200 /μL', dotColor: '#22c55e' },
                      { label: 'Neutrophils %', value: labProfile?.cbc?.neutrophils_percent?.value ? `${labProfile.cbc.neutrophils_percent.value} %` : '62.0 %', dotColor: '#22c55e' },
                      { label: 'Absolute lymphocytes', value: labProfile?.cbc?.absolute_lymphocytes?.value ? `${labProfile.cbc.absolute_lymphocytes.value} /μL` : '2100 /μL', dotColor: '#22c55e' },
                      { label: 'Lymphocytes %', value: labProfile?.cbc?.lymphocytes_percent?.value ? `${labProfile.cbc.lymphocytes_percent.value} %` : '29.5 %', dotColor: '#22c55e' },
                      { label: 'Absolute monocytes', value: labProfile?.cbc?.absolute_monocytes?.value ? `${labProfile.cbc.absolute_monocytes.value} /μL` : '480 /μL', dotColor: '#22c55e' },
                      { label: 'Monocytes %', value: labProfile?.cbc?.monocytes_percent?.value ? `${labProfile.cbc.monocytes_percent.value} %` : '6.8 %', dotColor: '#22c55e' },
                      { label: 'Absolute eosinophils', value: labProfile?.cbc?.absolute_eosinophils?.value ? `${labProfile.cbc.absolute_eosinophils.value} /μL` : '120 /μL', dotColor: '#22c55e' },
                      { label: 'Eosinophils %', value: labProfile?.cbc?.eosinophils_percent?.value ? `${labProfile.cbc.eosinophils_percent.value} %` : '1.8 %', dotColor: '#22c55e' },
                      { label: 'Absolute basophils', value: labProfile?.cbc?.absolute_basophils?.value ? `${labProfile.cbc.absolute_basophils.value} /μL` : '35 /μL', dotColor: '#22c55e' },
                      { label: 'Basophils %', value: labProfile?.cbc?.basophils_percent?.value ? `${labProfile.cbc.basophils_percent.value} %` : '0.5 %', dotColor: '#22c55e' },
                      { label: 'Mean cell volume (MCV)', value: labProfile?.cbc?.mcv?.value ? `${labProfile.cbc.mcv.value} fL` : '89.0 fL', dotColor: '#22c55e' },
                      { label: 'Mean cell Hb (MCH)', value: labProfile?.cbc?.mch?.value ? `${labProfile.cbc.mch.value} pg` : '30.2 pg', dotColor: '#22c55e' },
                      { label: 'Cell Hb conc (MCHC)', value: labProfile?.cbc?.mchc?.value ? `${labProfile.cbc.mchc.value} g/dL` : '33.8 g/dL', dotColor: '#22c55e' },
                      { label: 'Red cell width (RDW)', value: labProfile?.cbc?.rdw?.value ? `${labProfile.cbc.rdw.value} %` : '12.4 %', dotColor: '#22c55e' },
                      { label: 'Platelet volume (MPV)', value: labProfile?.cbc?.mpv?.value ? `${labProfile.cbc.mpv.value} fL` : '9.8 fL', dotColor: '#22c55e' },
                    ]
                    : []),
                ]}
                actionButton={{
                  label: expandedCard === 5 ? 'Collapse CBC Morphology ▲' : 'All 20 CBC Biomarkers (OSD-569) ▼',
                  onClick: () => toggleExpand(5),
                }}
              />

              {/* 6. Comprehensive Metabolic Panel (OSD-575 — 19 Signals) */}
              <CategoryCard
                title="6. Metabolic & Chemistry (CMP)"
                icon={<FlaskIcon />}
                statusPill={{ label: k < 3.5 ? 'Attention' : 'Nominal', color: k < 3.5 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Serum sodium (Na⁺)', value: sodiumVal, dotColor: '#22c55e' },
                  { label: 'Serum potassium (K⁺)', value: `${k.toFixed(2)} mmol/L`, dotColor: k < 3.0 ? '#ef4444' : k < 3.5 ? '#f59e0b' : '#22c55e', trend: k < 3.5 ? 'down' : 'stable' },
                  { label: 'Blood glucose', value: glucoseVal, dotColor: '#22c55e' },
                  { label: 'Blood urea nitrogen (BUN)', value: bunVal, dotColor: '#22c55e' },
                  { label: 'Serum creatinine', value: labProfile?.cmp?.creatinine?.value ? `${labProfile.cmp.creatinine.value} mg/dL` : '0.92 mg/dL', dotColor: '#22c55e' },
                  ...(expandedCard === 6
                    ? [
                      { label: 'Serum calcium (Ca²⁺)', value: labProfile?.cmp?.calcium?.value ? `${labProfile.cmp.calcium.value} mg/dL` : '9.4 mg/dL', dotColor: '#22c55e' },
                      { label: 'Serum chloride (Cl⁻)', value: labProfile?.cmp?.chloride?.value ? `${labProfile.cmp.chloride.value} mmol/L` : '102 mmol/L', dotColor: '#22c55e' },
                      { label: 'Carbon dioxide (CO₂)', value: labProfile?.cmp?.carbon_dioxide?.value ? `${labProfile.cmp.carbon_dioxide.value} mmol/L` : '26 mmol/L', dotColor: '#22c55e' },
                      { label: 'BUN / Creatinine ratio', value: labProfile?.cmp?.bun_to_creatinine_ratio?.value ? `${labProfile.cmp.bun_to_creatinine_ratio.value}` : '15.2', dotColor: '#22c55e' },
                      { label: 'eGFR filtration rate', value: labProfile?.cmp?.egfr_non_african_american?.value ? `${labProfile.cmp.egfr_non_african_american.value} mL/min` : '105 mL/min', dotColor: '#22c55e' },
                      { label: 'Total serum protein', value: labProfile?.cmp?.total_protein?.value ? `${labProfile.cmp.total_protein.value} g/dL` : '7.2 g/dL', dotColor: '#22c55e' },
                      { label: 'Serum albumin', value: albuminVal, dotColor: '#22c55e' },
                      { label: 'Serum globulin', value: labProfile?.cmp?.globulin?.value ? `${labProfile.cmp.globulin.value} g/dL` : '2.8 g/dL', dotColor: '#22c55e' },
                      { label: 'Albumin / Globulin ratio', value: labProfile?.cmp?.albumin_to_globulin_ratio?.value ? `${labProfile.cmp.albumin_to_globulin_ratio.value}` : '1.57', dotColor: '#22c55e' },
                      { label: 'Alkaline phosphatase', value: labProfile?.cmp?.alkaline_phosphatase?.value ? `${labProfile.cmp.alkaline_phosphatase.value} U/L` : '68 U/L', dotColor: '#22c55e' },
                      { label: 'Alanine transaminase (ALT)', value: labProfile?.cmp?.alt?.value ? `${labProfile.cmp.alt.value} U/L` : '24 U/L', dotColor: '#22c55e' },
                      { label: 'Aspartate transaminase (AST)', value: labProfile?.cmp?.ast?.value ? `${labProfile.cmp.ast.value} U/L` : '22 U/L', dotColor: '#22c55e' },
                      { label: 'Total bilirubin', value: labProfile?.cmp?.total_bilirubin?.value ? `${labProfile.cmp.total_bilirubin.value} mg/dL` : '0.6 mg/dL', dotColor: '#22c55e' },
                      { label: 'eGFR African American', value: labProfile?.cmp?.egfr_african_american?.value ? `${labProfile.cmp.egfr_african_american.value} mL/min` : '118 mL/min', dotColor: '#22c55e' },
                    ]
                    : []),
                ]}
                actionButton={{
                  label: expandedCard === 6 ? 'Collapse CMP Panel ▲' : 'All 19 CMP Biomarkers (OSD-575) ▼',
                  onClick: () => toggleExpand(6),
                }}
              />

              {/* 7. Deep-Space Immune & Cytokine Profiling (OSD-575 — 71 Cytokines) */}
              <CategoryCard
                title="7. Immune & Cytokines (OSD-575)"
                icon={<DropIcon />}
                statusPill={{ label: il6 >= 15.0 ? 'Attention' : 'Nominal', color: il6 >= 15.0 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Interleukin-6 (IL-6)', value: `${il6.toFixed(1)} pg/mL`, dotColor: il6 >= 30.0 ? '#ef4444' : il6 >= 15.0 ? '#f59e0b' : '#22c55e', trend: il6 >= 15.0 ? 'up' : 'stable' },
                  { label: 'TNF-alpha (TNF-α)', value: tnfVal, dotColor: '#22c55e' },
                  { label: 'Interferon-gamma (IFN-γ)', value: labProfile?.immune?.clusters?.interferons_and_viral?.ifn_gamma?.concentration_pg_ml ? `${labProfile.immune.clusters.interferons_and_viral.ifn_gamma.concentration_pg_ml} pg/mL` : '3.4 pg/mL', dotColor: '#22c55e' },
                  { label: 'Interleukin-1 beta (IL-1β)', value: labProfile?.immune?.clusters?.pyrogens_and_inflammatory?.il_1_beta?.concentration_pg_ml ? `${labProfile.immune.clusters.pyrogens_and_inflammatory.il_1_beta.concentration_pg_ml} pg/mL` : '1.2 pg/mL', dotColor: '#22c55e' },
                  { label: 'Total cytokines monitored', value: '71 Markers', dotColor: '#94a3b8' },
                  ...(expandedCard === 7
                    ? Object.entries(
                      immuneClusterTab === 'pyrogens'
                        ? labProfile?.immune?.clusters?.pyrogens_and_inflammatory || {}
                        : immuneClusterTab === 'interferons'
                          ? labProfile?.immune?.clusters?.interferons_and_viral || {}
                          : immuneClusterTab === 'interleukins'
                            ? labProfile?.immune?.clusters?.interleukins_and_tcell || {}
                            : immuneClusterTab === 'chemokines'
                              ? labProfile?.immune?.clusters?.chemokines_and_trafficking || {}
                              : labProfile?.immune?.clusters?.growth_factors_and_remodeling || {}
                    ).map(([name, data]) => ({
                      label: name.replace(/_/g, ' '),
                      value: data.concentration_pg_ml !== null ? `${data.concentration_pg_ml} pg/mL` : '0.0 pg/mL',
                      dotColor: '#94a3b8',
                    }))
                    : []),
                ]}
                customHeaderRight={
                  expandedCard === 7 ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {[
                        { key: 'pyrogens', label: 'Pyrogens (6)' },
                        { key: 'interferons', label: 'Interferons (4)' },
                        { key: 'interleukins', label: 'Interleukins (24)' },
                        { key: 'chemokines', label: 'Chemokines (20)' },
                        { key: 'growth', label: 'Growth (17)' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            setImmuneClusterTab(tab.key as any);
                          }}
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: immuneClusterTab === tab.key ? '1px solid #525252' : '1px solid #262626',
                            backgroundColor: immuneClusterTab === tab.key ? '#262626' : 'transparent',
                            color: immuneClusterTab === tab.key ? '#ffffff' : '#888888',
                            cursor: 'pointer',
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  ) : undefined
                }
                actionButton={{
                  label: expandedCard === 7 ? 'Collapse Cytokine Panel ▲' : 'Inspect All 71 Cytokines by Cluster ▼',
                  onClick: () => toggleExpand(7),
                }}
              />

              {/* 8. Space Radiation Exposure (5 Signals) */}
              <CategoryCard
                title="8. Radiation Exposure"
                icon={<RadiationIcon />}
                statusPill={{ label: radFlux >= 0.15 || rsi >= 0.5 ? 'Attention' : 'Nominal', color: radFlux >= 0.15 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Current dose rate', value: `${radFlux.toFixed(2)} mSv/h`, dotColor: radFlux >= 0.15 ? '#f59e0b' : '#22c55e', trend: radFlux >= 0.15 ? 'up' : 'stable' },
                  { label: 'Cumulative absorbed dose', value: `${radDose.toFixed(2)} Gy`, dotColor: '#22c55e' },
                  { label: 'Radiation sickness index', value: rsi.toFixed(2), dotColor: rsi >= 0.5 ? '#f59e0b' : '#22c55e' },
                  { label: 'Absolute lymphocytes', value: `${alc.toFixed(2)} k/μL`, dotColor: alc < 1.0 ? '#ef4444' : '#22c55e' },
                  { label: 'DNA double-strand breaks', value: radDose > 0.2 ? 'Elevated repairs' : 'Nominal repair', dotColor: radDose > 0.2 ? '#f59e0b' : '#22c55e' },
                ]}
              />

              {/* 9. Thrombosis & Vascular Risk (6 Signals) */}
              <CategoryCard
                title="9. Thrombosis & Vascular"
                icon={<VascularIcon />}
                statusPill={{ label: trm >= 1.25 ? 'Attention' : 'Nominal', color: trm >= 1.25 ? '#f59e0b' : '#22c55e' }}
                rows={[
                  { label: 'Thrombosis risk metric', value: trm.toFixed(2), dotColor: trm >= 1.25 ? '#f59e0b' : '#22c55e', trend: trm >= 1.25 ? 'up' : 'stable' },
                  { label: 'Fibrinogen level', value: fibrinogenVal, dotColor: '#22c55e' },
                  { label: 'L-selectin adhesion', value: labProfile?.cardiovascular?.l_selectin?.value ? `${(labProfile.cardiovascular.l_selectin.value / 1000).toFixed(0)} ng/mL` : '740 ng/mL', dotColor: '#94a3b8' },
                  { label: 'Platelet factor 4 (PF4)', value: labProfile?.cardiovascular?.pf4?.value ? `${labProfile.cardiovascular.pf4.value.toFixed(0)} ng/mL` : '320 ng/mL', dotColor: '#94a3b8' },
                  { label: 'Venous stasis status', value: trm > 1.3 ? 'Cephalic stasis' : 'Normal flow', dotColor: trm > 1.3 ? '#f59e0b' : '#22c55e' },
                  { label: 'Cephalic hemoconcentration', value: '-0.6 kg fluid shift', dotColor: '#94a3b8' },
                ]}
              />

              {/* 10. Integrated Clinical Directive & JARVIS (4 Signals) */}
              <CategoryCard
                title="10. Integrated Directives & JARVIS"
                icon={<DirectivesIcon />}
                statusPill={{ label: severity === 'NOMINAL' ? 'Stable' : severity, color: severity === 'NOMINAL' ? '#22c55e' : '#f59e0b' }}
                rows={[
                  { label: 'Early sepsis cascade (EPI)', value: (currentPacket?.computed_epi ?? 0.05).toFixed(2), dotColor: (currentPacket?.computed_epi ?? 0) > 0.8 ? '#ef4444' : '#22c55e' },
                  { label: 'Primary diagnosis', value: severity === 'CRITICAL' ? 'Acute Physiological Anomaly' : severity === 'WARNING' ? 'Moderate Baseline Strain' : 'Equilibrium baseline', dotColor: severity === 'NOMINAL' ? '#22c55e' : '#f59e0b' },
                  { label: 'Actionable directive', value: severity === 'CRITICAL' ? 'Initiate clinical countermeasure' : severity === 'WARNING' ? 'Schedule rest & hydration' : 'Continue mission activities', dotColor: '#22c55e' },
                  { label: 'Autonomous decision sentry', value: 'Online (Ollama BioMistral)', dotColor: '#94a3b8' },
                ]}
              />
            </div>
          </div>

          {/* Right Column: Dedicated Full-Height Sidebar */}
          <aside
            style={{
              backgroundColor: '#0c0c0c',
              borderLeft: '1px solid #1e1e1e',
              padding: '20px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Devices Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Monitoring Devices
                </div>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                  15 Active Systems
                </span>
              </div>

              {/* Device Filter Pills */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {(['ALL', 'WEARABLE', 'LAB', 'ENGINE'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDeviceFilter(filter)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '9999px',
                      fontSize: '9px',
                      fontWeight: 600,
                      border: deviceFilter === filter ? '1px solid #525252' : '1px solid #262626',
                      background: deviceFilter === filter ? '#262626' : 'transparent',
                      color: deviceFilter === filter ? '#ffffff' : '#888888',
                      cursor: 'pointer',
                    }}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'WEARABLE' ? 'Wearable' : filter === 'LAB' ? 'Lab Assays' : 'Engines'}
                  </button>
                ))}
              </div>

              {/* Device List without Containers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '430px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredDevices.map((dev) => (
                  <div
                    key={dev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3px 0',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#f1f5f9' }}>
                      {dev.id}. {dev.name}
                    </div>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        background: dev.status === 'Streaming' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        color: dev.status === 'Streaming' ? '#22c55e' : '#94a3b8',
                        border: dev.status === 'Streaming' ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {dev.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clean Hairline Divider */}
            <div style={{ height: '1px', backgroundColor: '#1c1c1c' }} />

            {/* Recent Events & Alerts Feed */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Events &amp; Directives
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '10px' }}>
                <div style={{ borderLeft: '2px solid #f59e0b', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>14:28</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>Sleep duration below baseline</span>
                  <div style={{ color: '#888888' }}>Slight circadian disruption flagged.</div>
                </div>
                <div style={{ borderLeft: '2px solid #22c55e', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>12:15</span>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>Heart rate elevation during exercise</span>
                  <div style={{ color: '#888888' }}>Contextual workout gating active.</div>
                </div>
                <div style={{ borderLeft: '2px solid #94a3b8', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>09:42</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>NASA OSDR Lab Assays Loaded</span>
                  <div style={{ color: '#888888' }}>All 119 biomarkers synchronized for {activeCrew.name}.</div>
                </div>
                <div style={{ borderLeft: '2px solid #94a3b8', paddingLeft: '8px' }}>
                  <span style={{ color: '#737373', marginRight: '6px' }}>08:11</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Radiation dose updated</span>
                  <div style={{ color: '#888888' }}>GCR flux within deep-space norms.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

/* ── REUSABLE CATEGORY CARD COMPONENT ─────────────────────────────────────── */
interface CategoryRowItem {
  label: string;
  value: string;
  dotColor: string;
  trend?: 'up' | 'down' | 'stable';
}

interface CategoryCardProps {
  title: string;
  icon: React.ReactNode;
  statusPill?: { label: string; color: string };
  rows: CategoryRowItem[];
  actionButton?: { label: string; onClick: () => void };
  customHeaderRight?: React.ReactNode;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  icon,
  statusPill,
  rows,
  actionButton,
  customHeaderRight,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#121212',
        border: '1px solid #242424',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
    >
      {/* Title Header with Professional Icon + Status Pill */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.01em', color: '#ffffff', fontFamily: "'Tomorrow', sans-serif" }}>
              {title}
            </span>
          </div>

          {statusPill && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: `${statusPill.color}1a`,
                color: statusPill.color,
                border: `1px solid ${statusPill.color}40`,
                letterSpacing: '0.02em',
                fontFamily: "'Tomorrow', sans-serif",
              }}
            >
              {statusPill.label}
            </span>
          )}
        </div>
        {customHeaderRight}
      </div>

      {/* Metric Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, i) => (
          <div
            key={row.label + i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1.4fr) minmax(130px, 1.4fr) 52px',
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: i < rows.length - 1 ? '1px solid #1c1c1c' : 'none',
              fontSize: '11px',
            }}
          >
            {/* Left: Metric Name in Clean Sentence Case */}
            <span style={{ color: '#a3a3a3', letterSpacing: '0.01em', fontFamily: "'Tomorrow', sans-serif" }}>
              {row.label}
            </span>

            {/* Middle: Real-time Status Dot + Tabular Numeral Value */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: row.dotColor,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${row.dotColor}80`,
                }}
              />
              <span
                style={{
                  color: '#f5f5f5',
                  fontWeight: 600,
                  fontFamily: 'var(--hud-font-mono, monospace)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.02em',
                }}
              >
                {row.value}
              </span>
            </div>

            {/* Right: Micro Sparkline */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <MicroSparkline trend={row.trend || 'stable'} color={row.dotColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Expand / Collapse Button if available */}
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          style={{
            marginTop: '4px',
            padding: '5px',
            borderRadius: '6px',
            border: '1px solid #333333',
            backgroundColor: '#1a1a1a',
            color: '#d4d4d4',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.15s ease',
            fontFamily: "'Tomorrow', sans-serif",
            letterSpacing: '0.02em',
          }}
        >
          {actionButton.label}
        </button>
      )}
    </div>
  );
};

/* ── MICRO SPARKLINE TRACE COMPONENT ──────────────────────────────────────── */
const MicroSparkline: React.FC<{ trend: 'up' | 'down' | 'stable'; color: string }> = ({ trend, color }) => {
  const pathD =
    trend === 'up'
      ? 'M 2 12 Q 12 11, 22 9 T 42 3'
      : trend === 'down'
        ? 'M 2 4 Q 12 6, 22 9 T 42 13'
        : 'M 2 8 Q 12 7, 22 9 T 42 8';

  return (
    <svg width="44" height="16" viewBox="0 0 44 16" fill="none" style={{ opacity: 0.85 }}>
      <path d={pathD} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ── SHARP PROFESSIONAL SVG CATEGORY ICONS ────────────────────────────────── */
const HeartIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" strokeWidth="1.2">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const LungsIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 4v8M12 7c-2 0-5 1-6 4v6c0 1.5 1.5 3 3 3h1c1.5 0 2-2 2-4V9" />
    <path d="M12 7c2 0 5 1 6 4v6c0 1.5-1.5 3-3 3h-1c-1.5 0-2-2-2-4V9" />
  </svg>
);

const TempIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const BrainIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z" />
  </svg>
);

const DropIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const FlaskIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round">
    <path d="M10 2v7.31L4.62 17.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.68-3.5L14 9.31V2" />
    <line x1="8" y1="2" x2="16" y2="2" />
    <line x1="7" y1="15" x2="17" y2="15" />
  </svg>
);

const ShieldIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const RadiationIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const VascularIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const DirectivesIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 3v18h18" />
  </svg>
);

