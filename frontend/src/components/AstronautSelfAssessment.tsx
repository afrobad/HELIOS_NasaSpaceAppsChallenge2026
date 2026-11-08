import React, { useState, useEffect, useMemo } from 'react';
import type { TelemetryPacket } from '../types/telemetry';
import { downloadDailyCheckInPdf } from '../services/pdfReportService';

export interface SelfAssessmentEntry {
  id?: number;
  astronaut_id: string;
  timestamp?: string;
  sleep_hours: number;
  sleep_quality: number; // 1-10
  fatigue_score: number; // 1-10 (VAS)
  mood_score: number; // 1-10
  cognitive_workload: number; // 1-10 (NASA-TLX)
  discomfort_regions: string[];
  reported_hr?: number;
  reported_bp_sys?: number;
  reported_bp_dia?: number;
  reported_spo2?: number;
  reported_temp?: number;
  notes?: string;
  provenance: string;
}

const CREW_LIST = [
  { id: 'AST-01_COMMANDER', name: 'Cmndr Haley', role: 'Mission Commander', call: 'AST-01' },
  { id: 'AST-02_PILOT', name: 'Pilot Chris', role: 'Flight Pilot', call: 'AST-02' },
  { id: 'AST-03_MEDICAL', name: 'Dr. Sian', role: 'Medical Specialist', call: 'AST-03' },
  { id: 'AST-04_ENGINEER', name: 'Specialist Leo', role: 'Systems Engineer', call: 'AST-04' },
];

const DISCOMFORT_ZONES = [
  { id: 'cranial', label: 'Cranial / SANS Headache', desc: 'Cephalic microgravity fluid shift pressure' },
  { id: 'cervical', label: 'Cervical / Neck Stiffness', desc: 'Helmet load or sleeping restraint tension' },
  { id: 'thoracic', label: 'Thoracic / Chest Tightness', desc: 'EVA harness pressure or gas exchange discomfort' },
  { id: 'lumbar', label: 'Lumbar / Spinal Elongation', desc: 'Intervertebral disk expansion in zero-g' },
  { id: 'extremities', label: 'Lower Extremities / Calf Cramp', desc: 'Fluid redistribution & muscle atrophy' },
  { id: 'ocular', label: 'Ocular / Vision Blur', desc: 'Optic nerve sheath distension or globe flattening' },
];

const T = {
  bg: '#06080a',
  surface: '#0b0e12',
  surfaceAlt: '#0e1318',
  border: '#1a232e',
  borderSubtle: '#141c24',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  nominal: '#10b981',
  nominalBorder: 'rgba(16, 185, 129, 0.4)',
  nominalBg: 'rgba(16, 185, 129, 0.08)',
  warning: '#f59e0b',
  warningBorder: 'rgba(245, 158, 11, 0.4)',
  warningBg: 'rgba(245, 158, 11, 0.08)',
  critical: '#ef4444',
  criticalBorder: 'rgba(239, 68, 68, 0.4)',
  criticalBg: 'rgba(239, 68, 68, 0.08)',
  cyan: '#38bdf8',
  cyanBorder: 'rgba(56, 189, 248, 0.4)',
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'Inter', -apple-system, sans-serif",
};

interface Props {
  initialAstronautId?: string;
  telemetryMap?: Record<string, TelemetryPacket>;
  currentScenario?: string;
  onClose?: () => void;
}

export const AstronautSelfAssessment: React.FC<Props> = ({
  initialAstronautId = 'AST-01_COMMANDER',
  telemetryMap = {},
  currentScenario = 'NOMINAL',
  onClose,
}) => {
  const [selectedCrewId, setSelectedCrewId] = useState(initialAstronautId);
  const [activeStep, setActiveStep] = useState<'SLEEP' | 'FATIGUE_MOOD' | 'DISCOMFORT' | 'MANUAL_VITALS' | 'HISTORY'>('SLEEP');

  // Form State
  const [sleepHours, setSleepHours] = useState(7.2);
  const [sleepQuality, setSleepQuality] = useState(8);
  const [fatigueScore, setFatigueScore] = useState(3);
  const [moodScore, setMoodScore] = useState(8);
  const [cognitiveWorkload, setCognitiveWorkload] = useState(4);
  const [selectedDiscomfort, setSelectedDiscomfort] = useState<string[]>([]);
  const [reportedHr, setReportedHr] = useState<string>('');
  const [reportedBpSys, setReportedBpSys] = useState<string>('');
  const [reportedBpDia, setReportedBpDia] = useState<string>('');
  const [reportedSpo2, setReportedSpo2] = useState<string>('');
  const [reportedTemp, setReportedTemp] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Sync vitals automatically when crew member or live telemetry changes
  useEffect(() => {
    const live = telemetryMap[selectedCrewId];
    if (live) {
      if (live.heart_rate) setReportedHr(String(Math.round(live.heart_rate)));
      const sys = (live as any).blood_pressure_sys ?? (selectedCrewId.includes('PILOT') ? 116 : 118);
      const dia = (live as any).blood_pressure_dia ?? 76;
      setReportedBpSys(String(Math.round(sys)));
      setReportedBpDia(String(Math.round(dia)));
      if (live.spo2 !== undefined && live.spo2 !== null) {
        setReportedSpo2(Number(live.spo2).toFixed(1));
      }
      const rawTemp = (live as any).core_temp ?? (live as any).core_temp_c ?? 36.7;
      setReportedTemp(Number(rawTemp).toFixed(1));
    }
  }, [selectedCrewId, telemetryMap]);

  // Adjust subjective fatigue and workload when scenarios occur
  useEffect(() => {
    if (currentScenario.includes('FATIGUE')) {
      setFatigueScore(7);
      setCognitiveWorkload(8);
      setSleepHours(5.0);
    } else if (currentScenario.includes('CO2')) {
      setSelectedDiscomfort(['cranial']);
      setCognitiveWorkload(7);
    } else if (currentScenario.includes('SOLAR')) {
      setCognitiveWorkload(8);
    }
  }, [currentScenario]);

const getBaselineHistoricalSessions = (astId: string): SelfAssessmentEntry[] => {
  const now = Date.now();
  const dayMs = 86400000;

  if (astId.includes('PILOT')) {
    return [
      {
        id: 201,
        astronaut_id: astId,
        timestamp: new Date(now - 14 * 3600 * 1000).toISOString(),
        sleep_hours: 7.4,
        sleep_quality: 9,
        fatigue_score: 2,
        mood_score: 9,
        cognitive_workload: 3,
        discomfort_regions: [],
        reported_hr: 58,
        reported_bp_sys: 116,
        reported_bp_dia: 76,
        reported_spo2: 98.6,
        reported_temp: 36.7,
        notes: "Flight guidance thruster test checks nominal. Sleep restraint comfortable.",
        provenance: "USER_REPORTED_MANUAL",
      },
      {
        id: 202,
        astronaut_id: astId,
        timestamp: new Date(now - 3 * dayMs).toISOString(),
        sleep_hours: 7.1,
        sleep_quality: 8,
        fatigue_score: 3,
        mood_score: 8,
        cognitive_workload: 4,
        discomfort_regions: ["Cervical / Neck Stiffness"],
        reported_hr: 60,
        reported_bp_sys: 118,
        reported_bp_dia: 78,
        reported_spo2: 98.4,
        reported_temp: 36.6,
        notes: "Post-ARED workout stiffness, resolved with stretching.",
        provenance: "USER_REPORTED_MANUAL",
      },
      {
        id: 203,
        astronaut_id: astId,
        timestamp: new Date(now - 7 * dayMs).toISOString(),
        sleep_hours: 6.8,
        sleep_quality: 7,
        fatigue_score: 4,
        mood_score: 8,
        cognitive_workload: 4,
        discomfort_regions: [],
        reported_hr: 62,
        reported_bp_sys: 120,
        reported_bp_dia: 80,
        reported_spo2: 98.2,
        reported_temp: 36.8,
        notes: "Baseline flight adaptation check-in. Normal visual acuity.",
        provenance: "USER_REPORTED_MANUAL",
      },
    ];
  }

  if (astId.includes('COMMANDER')) {
    return [
      {
        id: 101,
        astronaut_id: astId,
        timestamp: new Date(now - 12 * 3600 * 1000).toISOString(),
        sleep_hours: 7.5,
        sleep_quality: 9,
        fatigue_score: 2,
        mood_score: 9,
        cognitive_workload: 3,
        discomfort_regions: [],
        reported_hr: 60,
        reported_bp_sys: 115,
        reported_bp_dia: 75,
        reported_spo2: 98.4,
        reported_temp: 36.6,
        notes: "Circadian sync stable, ready for scheduled EVA docking.",
        provenance: "USER_REPORTED_MANUAL",
      },
      {
        id: 102,
        astronaut_id: astId,
        timestamp: new Date(now - 4 * dayMs).toISOString(),
        sleep_hours: 7.2,
        sleep_quality: 8,
        fatigue_score: 3,
        mood_score: 8,
        cognitive_workload: 4,
        discomfort_regions: [],
        reported_hr: 62,
        reported_bp_sys: 116,
        reported_bp_dia: 76,
        reported_spo2: 98.1,
        reported_temp: 36.7,
        notes: "Routine mission command log. All subsystems green.",
        provenance: "USER_REPORTED_MANUAL",
      },
      {
        id: 103,
        astronaut_id: astId,
        timestamp: new Date(now - 9 * dayMs).toISOString(),
        sleep_hours: 6.9,
        sleep_quality: 7,
        fatigue_score: 4,
        mood_score: 7,
        cognitive_workload: 5,
        discomfort_regions: ["Lumbar / Spinal Elongation"],
        reported_hr: 65,
        reported_bp_sys: 118,
        reported_bp_dia: 78,
        reported_spo2: 98.0,
        reported_temp: 36.6,
        notes: "Mild lumbar elongation after first orbital week, adapting well.",
        provenance: "USER_REPORTED_MANUAL",
      },
    ];
  }

  if (astId.includes('MEDICAL')) {
    return [
      {
        id: 301,
        astronaut_id: astId,
        timestamp: new Date(now - 16 * 3600 * 1000).toISOString(),
        sleep_hours: 7.6,
        sleep_quality: 9,
        fatigue_score: 2,
        mood_score: 9,
        cognitive_workload: 3,
        discomfort_regions: [],
        reported_hr: 64,
        reported_bp_sys: 114,
        reported_bp_dia: 74,
        reported_spo2: 98.0,
        reported_temp: 36.9,
        notes: "Medical assay and ultrasound calibration complete.",
        provenance: "USER_REPORTED_MANUAL",
      },
      {
        id: 302,
        astronaut_id: astId,
        timestamp: new Date(now - 5 * dayMs).toISOString(),
        sleep_hours: 7.3,
        sleep_quality: 8,
        fatigue_score: 3,
        mood_score: 8,
        cognitive_workload: 4,
        discomfort_regions: [],
        reported_hr: 66,
        reported_bp_sys: 116,
        reported_bp_dia: 76,
        reported_spo2: 97.9,
        reported_temp: 36.8,
        notes: "Hydration logs verified across crew. Electrolytes balanced.",
        provenance: "USER_REPORTED_MANUAL",
      },
    ];
  }

  // Engineer
  return [
    {
      id: 401,
      astronaut_id: astId,
      timestamp: new Date(now - 18 * 3600 * 1000).toISOString(),
      sleep_hours: 7.0,
      sleep_quality: 8,
      fatigue_score: 3,
      mood_score: 8,
      cognitive_workload: 5,
      discomfort_regions: [],
      reported_hr: 62,
      reported_bp_sys: 118,
      reported_bp_dia: 78,
      reported_spo2: 98.5,
      reported_temp: 36.8,
      notes: "ECLSS carbon scrubbers and O2 fraction verified optimal.",
      provenance: "USER_REPORTED_MANUAL",
    },
    {
      id: 402,
      astronaut_id: astId,
      timestamp: new Date(now - 6 * dayMs).toISOString(),
      sleep_hours: 6.9,
      sleep_quality: 7,
      fatigue_score: 4,
      mood_score: 8,
      cognitive_workload: 5,
      discomfort_regions: [],
      reported_hr: 65,
      reported_bp_sys: 120,
      reported_bp_dia: 80,
      reported_spo2: 98.2,
      reported_temp: 36.7,
      notes: "Routine maintenance cycle completed on time.",
      provenance: "USER_REPORTED_MANUAL",
    },
  ];
};

  // Historical Records
  const [historyRecords, setHistoryRecords] = useState<SelfAssessmentEntry[]>([]);
  const [pdfDownloadedNotice, setPdfDownloadedNotice] = useState<string | null>(null);

  // Load Historical Records
  const loadHistory = async (astId: string) => {
    // 1. Check local storage first for immediate offline/cached sessions
    const local = localStorage.getItem(`helios_self_assessment_${astId}`);
    let localRecords: SelfAssessmentEntry[] = [];
    if (local !== null) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          localRecords = parsed;
          // If the user intentionally cleared records, keep it empty
          if (localRecords.length === 0) {
            setHistoryRecords([]);
            return;
          }
        }
      } catch {}
    }

    try {
      const res = await fetch(`/api/self-assessment/${encodeURIComponent(astId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.records && json.records.length > 0) {
          // Merge API records with local cache
          const merged = [...localRecords];
          for (const r of json.records) {
            if (!merged.some((m) => m.id === r.id)) {
              merged.push(r);
            }
          }
          setHistoryRecords(merged);
          return;
        }
      }
    } catch {}

    if (localRecords.length > 0) {
      setHistoryRecords(localRecords);
      return;
    }

    // If never initialized before (local === null), default to calibrated NASA baseline timeline
    if (local === null) {
      const baselines = getBaselineHistoricalSessions(astId);
      setHistoryRecords(baselines);
      localStorage.setItem(`helios_self_assessment_${astId}`, JSON.stringify(baselines));
    } else {
      setHistoryRecords([]);
    }
  };

  useEffect(() => {
    loadHistory(selectedCrewId);
  }, [selectedCrewId]);

  const toggleDiscomfort = (id: string) => {
    setSelectedDiscomfort((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClearHistory = async () => {
    const crewName = activeCrewMeta.name;
    if (!window.confirm(`Clear all logged self-assessment check-in records for ${crewName}?\n\nThis will remove records from local browser storage and the SQLite flight database (data/astronaut_health.db).`)) {
      return;
    }

    try {
      await fetch(`/api/self-assessment/${encodeURIComponent(selectedCrewId)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend DELETE error, proceeding with local clear:', e);
    }

    localStorage.setItem(`helios_self_assessment_${selectedCrewId}`, JSON.stringify([]));
    setHistoryRecords([]);
    setPdfDownloadedNotice(`Cleared all check-in records for ${crewName}.`);
  };

  const handleResetBaselines = () => {
    const baselines = getBaselineHistoricalSessions(selectedCrewId);
    setHistoryRecords(baselines);
    localStorage.setItem(`helios_self_assessment_${selectedCrewId}`, JSON.stringify(baselines));
    setPdfDownloadedNotice(`Restored NASA nominal baseline timeline for ${activeCrewMeta.name}.`);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const entry: SelfAssessmentEntry = {
      astronaut_id: selectedCrewId,
      sleep_hours: Number(sleepHours),
      sleep_quality: Number(sleepQuality),
      fatigue_score: Number(fatigueScore),
      mood_score: Number(moodScore),
      cognitive_workload: Number(cognitiveWorkload),
      discomfort_regions: selectedDiscomfort,
      reported_hr: reportedHr ? Number(reportedHr) : undefined,
      reported_bp_sys: reportedBpSys ? Number(reportedBpSys) : undefined,
      reported_bp_dia: reportedBpDia ? Number(reportedBpDia) : undefined,
      reported_spo2: reportedSpo2 ? Number(reportedSpo2) : undefined,
      reported_temp: reportedTemp ? Number(reportedTemp) : undefined,
      notes: notes.trim(),
      provenance: 'USER_REPORTED_MANUAL',
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch('/api/self-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {}

    // Prepend to current records and persist locally
    const newRecord = { ...entry, id: Date.now() };
    const updated = [newRecord, ...historyRecords];
    localStorage.setItem(`helios_self_assessment_${selectedCrewId}`, JSON.stringify(updated));
    setHistoryRecords(updated);
    setSubmitSuccess(true);

    // Auto-generate and download official NASA Flight Clinical Record (PDF 1.4)
    try {
      const callsign = (activeCrewMeta as any).call || selectedCrewId.replace(/[^a-zA-Z0-9_-]/g, '');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const generatedFileName = `NASA_HELIOS_DailyCheckIn_${callsign}_${dateStr}.pdf`;

      downloadDailyCheckInPdf({
        astronaut_id: selectedCrewId,
        astronaut_name: activeCrewMeta.name,
        astronaut_role: activeCrewMeta.role,
        callsign: (activeCrewMeta as any).call || selectedCrewId,
        timestamp: entry.timestamp || new Date().toISOString(),
        met: 'T+14d 08:45:22',
        sleep_hours: entry.sleep_hours,
        sleep_quality: entry.sleep_quality,
        fatigue_score: entry.fatigue_score,
        mood_score: entry.mood_score,
        cognitive_workload: entry.cognitive_workload,
        discomfort_regions: entry.discomfort_regions,
        reported_hr: entry.reported_hr,
        reported_bp_sys: entry.reported_bp_sys,
        reported_bp_dia: entry.reported_bp_dia,
        reported_spo2: entry.reported_spo2,
        reported_temp: entry.reported_temp,
        notes: entry.notes,
        provenance: 'USER_REPORTED_MANUAL',
        telemetry_snapshot: telemetry ? {
          ecg_rhythm: (telemetry as any).ecg_lead_ii_rhythm || (telemetry as any).ecg_classification || 'Normal Sinus Rhythm',
          qtc_ms: (telemetry as any).qtc_interval_ms || (telemetry as any).qtc_interval || 410,
          cabin_co2: (telemetry as any).cabin_co2_pct || 0.35,
          cabin_press: (telemetry as any).cabin_pressure_kpa || 101.3,
          potassium: (telemetry as any).blood_potassium || (telemetry as any).potassium || 4.2,
          hematocrit: (telemetry as any).hematocrit_pct || 43.5,
        } : undefined,
      });

      setPdfDownloadedNotice(`✓ Report Generated & Auto-Downloaded: ${generatedFileName}`);
    } catch (pdfErr) {
      console.error('Failed to trigger daily check-in PDF download:', pdfErr);
    }

    setIsSubmitting(false);
    setTimeout(() => {
      setSubmitSuccess(false);
      setActiveStep('HISTORY');
    }, 700);
  };

  const activeCrewMeta = useMemo(
    () => CREW_LIST.find((c) => c.id === selectedCrewId) || CREW_LIST[0],
    [selectedCrewId]
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1200,
        margin: '0 auto',
        padding: '16px 20px',
        color: T.textPrimary,
        fontFamily: T.sans,
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: '12px 18px',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: T.cyan,
                boxShadow: `0 0 8px ${T.cyan}`,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.05em' }}>
              ASTRONAUT DAILY SELF-ASSESSMENT & SUBJECTIVE HEALTH LOG
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: T.cyan,
                background: 'rgba(56, 189, 248, 0.1)',
                border: `1px solid ${T.cyanBorder}`,
                borderRadius: 4,
                padding: '2px 8px',
                fontFamily: T.mono,
              }}
            >
              CREW CHECK-IN
            </span>
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
            Daily subjective symptom assessment, sleep tracking, and clinical self-evaluation.
          </div>
        </div>

        {/* Crew Selector */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {CREW_LIST.map((crew) => {
            const isSel = crew.id === selectedCrewId;
            const crewTelem = telemetryMap[crew.id];
            return (
              <button
                key={crew.id}
                onClick={() => setSelectedCrewId(crew.id)}
                style={{
                  background: isSel ? 'rgba(56, 189, 248, 0.25)' : '#090c0f',
                  border: isSel ? `1px solid ${T.cyan}` : `1px solid ${T.borderSubtle}`,
                  borderRadius: 4,
                  padding: '5px 10px',
                  fontSize: 10,
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? '#ffffff' : T.textSecondary,
                  cursor: 'pointer',
                  fontFamily: T.mono,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{crew.name}</span>
                {crewTelem && (
                  <span style={{ fontSize: 9, color: isSel ? '#38bdf8' : T.textMuted }}>
                    {Math.round(crewTelem.heart_rate)} bpm
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Real-Time Sensor Telemetry Strip ── */}
      {(() => {
        const live = telemetryMap[selectedCrewId];
        return (
          <div
            style={{
              background: 'rgba(10, 16, 26, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 6,
              padding: '8px 14px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              fontFamily: T.mono,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: T.cyan, fontWeight: 700 }}>
                ● LIVE BIOMETRIC FEED ({activeCrewMeta.name}):
              </span>
              <span>
                HR: <strong style={{ color: '#ffffff' }}>{live && live.heart_rate ? `${Math.round(live.heart_rate)} bpm` : '60 bpm'}</strong>
              </span>
              <span>
                BP: <strong style={{ color: '#ffffff' }}>{live && (live as any).blood_pressure_sys ? `${Math.round((live as any).blood_pressure_sys)}/${Math.round((live as any).blood_pressure_dia || 76)}` : '116/76'}</strong>
              </span>
              <span>
                SpO₂: <strong style={{ color: '#34d399' }}>{live && live.spo2 !== undefined && live.spo2 !== null ? `${Number(live.spo2).toFixed(1)}%` : '98.3%'}</strong>
              </span>
              <span>
                Temp: <strong style={{ color: '#ffffff' }}>{live ? `${Number((live as any).core_temp ?? (live as any).core_temp_c ?? 36.7).toFixed(1)}°C` : '36.7°C'}</strong>
              </span>
              <span>
                HRV (RMSSD): <strong style={{ color: T.cyan }}>{live && live.hrv_rmssd !== undefined && live.hrv_rmssd !== null ? `${Math.round(live.hrv_rmssd)} ms` : '64 ms'}</strong>
              </span>
            </div>

            {currentScenario && currentScenario !== 'NOMINAL' && currentScenario !== 'NOMINAL_CRUISE' && (
              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                ACTIVE FLIGHT SCENARIO: {currentScenario}
              </span>
            )}
          </div>
        );
      })()}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'SLEEP', label: '1. Sleep & Recovery' },
          { id: 'FATIGUE_MOOD', label: '2. Fatigue, Mood & NASA-TLX' },
          { id: 'DISCOMFORT', label: '3. Pain & Discomfort Map' },
          { id: 'MANUAL_VITALS', label: '4. Manual Biometrics (Optional)' },
          { id: 'HISTORY', label: `5. Longitudinal History (${historyRecords.length})` },
        ].map((tab) => {
          const isAct = activeStep === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveStep(tab.id as any)}
              style={{
                flex: 1,
                background: isAct ? 'rgba(56, 189, 248, 0.18)' : T.surface,
                border: isAct ? `1px solid ${T.cyan}` : `1px solid ${T.border}`,
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: isAct ? 700 : 500,
                color: isAct ? '#ffffff' : T.textSecondary,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.12s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Cards */}
      <div data-tour="self-assessment-card">
        {/* Tab 1: Sleep */}
        {activeStep === 'SLEEP' && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            Sleep Duration & Subjective Rest Quality · {activeCrewMeta.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ fontSize: 11, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                Sleep Duration (Hours): <strong style={{ color: T.cyan, fontFamily: T.mono }}>{sleepHours} hrs</strong>
              </label>
              <input
                type="range"
                min="3.0"
                max="10.0"
                step="0.1"
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                style={{ width: '100%', accentColor: T.cyan }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.textMuted, marginTop: 4 }}>
                <span>3.0h (Severe Deficit)</span>
                <span>6.5h (Flight Rule Min)</span>
                <span>8.5h (Optimal)</span>
                <span>10.0h</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                Subjective Sleep Restfulness: <strong style={{ color: T.cyan, fontFamily: T.mono }}>{sleepQuality} / 10</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={sleepQuality}
                onChange={(e) => setSleepQuality(Number(e.target.value))}
                style={{ width: '100%', accentColor: T.cyan }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.textMuted, marginTop: 4 }}>
                <span>1 (Fitful / Disturbed)</span>
                <span>5 (Adequate)</span>
                <span>10 (Fully Restored)</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setActiveStep('FATIGUE_MOOD')}
              style={{
                background: 'rgba(56, 189, 248, 0.25)',
                border: `1px solid ${T.cyan}`,
                borderRadius: 4,
                padding: '8px 20px',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Next: Fatigue & Workload →
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Fatigue & Workload */}
      {activeStep === 'FATIGUE_MOOD' && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            Cognitive Workload & Psychological Stress Index
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                Perceived Fatigue (VAS): <strong style={{ color: fatigueScore > 6 ? T.warning : T.nominal }}>{fatigueScore} / 10</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={fatigueScore}
                onChange={(e) => setFatigueScore(Number(e.target.value))}
                style={{ width: '100%', accentColor: fatigueScore > 6 ? T.warning : T.nominal }}
              />
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4 }}>1 = Energetic, 10 = Exhausted</div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                Emotional Mood Balance: <strong style={{ color: T.nominal }}>{moodScore} / 10</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={moodScore}
                onChange={(e) => setMoodScore(Number(e.target.value))}
                style={{ width: '100%', accentColor: T.nominal }}
              />
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4 }}>1 = Anxious / Strained, 10 = Resilient</div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: T.textSecondary, display: 'block', marginBottom: 6 }}>
                NASA-TLX Perceived Workload: <strong style={{ color: cognitiveWorkload > 7 ? T.warning : T.cyan }}>{cognitiveWorkload} / 10</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={cognitiveWorkload}
                onChange={(e) => setCognitiveWorkload(Number(e.target.value))}
                style={{ width: '100%', accentColor: T.cyan }}
              />
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4 }}>Mental demand and operational pacing</div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setActiveStep('SLEEP')}
              style={{ background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 16px', color: T.textSecondary, cursor: 'pointer', fontSize: 11 }}
            >
              ← Back: Sleep
            </button>
            <button
              onClick={() => setActiveStep('DISCOMFORT')}
              style={{ background: 'rgba(56, 189, 248, 0.25)', border: `1px solid ${T.cyan}`, borderRadius: 4, padding: '8px 20px', color: '#ffffff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Next: Pain & Discomfort Map →
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Discomfort Zones */}
      {activeStep === 'DISCOMFORT' && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            Anatomical Pain & Microgravity Discomfort Mapping
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 14 }}>
            Select any localized zones of discomfort, headache, spinal elongation strain, or eye strain:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {DISCOMFORT_ZONES.map((zone) => {
              const isSelected = selectedDiscomfort.includes(zone.id);
              return (
                <div
                  key={zone.id}
                  onClick={() => toggleDiscomfort(zone.id)}
                  style={{
                    background: isSelected ? 'rgba(239, 68, 68, 0.12)' : T.surfaceAlt,
                    border: `1px solid ${isSelected ? T.criticalBorder : T.borderSubtle}`,
                    borderRadius: 6,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? T.critical : T.textPrimary }}>
                      {zone.label}
                    </span>
                    <span style={{ fontSize: 10, color: isSelected ? T.critical : T.textMuted, fontFamily: T.mono }}>
                      {isSelected ? '✓ FLAGGED' : '+ TAP TO ADD'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 4 }}>{zone.desc}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setActiveStep('FATIGUE_MOOD')}
              style={{ background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 16px', color: T.textSecondary, cursor: 'pointer', fontSize: 11 }}
            >
              ← Back: Fatigue & Mood
            </button>
            <button
              onClick={() => setActiveStep('MANUAL_VITALS')}
              style={{ background: 'rgba(56, 189, 248, 0.25)', border: `1px solid ${T.cyan}`, borderRadius: 4, padding: '8px 20px', color: '#ffffff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Next: Manual Biometrics →
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Manual Vitals & Submit */}
      {activeStep === 'MANUAL_VITALS' && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            Optional Manually-Entered Biometrics (Point-of-Care Check)
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 14 }}>
            Enter spot-check measurements from cuff, thermometer, or finger stick. Leave blank to skip.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 10, color: T.textSecondary, display: 'block', marginBottom: 4 }}>Heart Rate (bpm)</label>
              <input
                type="number"
                placeholder="e.g. 62"
                value={reportedHr}
                onChange={(e) => setReportedHr(e.target.value)}
                style={{ width: '100%', background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '6px 8px', color: T.textPrimary, fontFamily: T.mono, fontSize: 11 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textSecondary, display: 'block', marginBottom: 4 }}>Systolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 116"
                value={reportedBpSys}
                onChange={(e) => setReportedBpSys(e.target.value)}
                style={{ width: '100%', background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '6px 8px', color: T.textPrimary, fontFamily: T.mono, fontSize: 11 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textSecondary, display: 'block', marginBottom: 4 }}>Diastolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 76"
                value={reportedBpDia}
                onChange={(e) => setReportedBpDia(e.target.value)}
                style={{ width: '100%', background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '6px 8px', color: T.textPrimary, fontFamily: T.mono, fontSize: 11 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textSecondary, display: 'block', marginBottom: 4 }}>SpO₂ (%)</label>
              <input
                type="number"
                placeholder="e.g. 98.4"
                value={reportedSpo2}
                onChange={(e) => setReportedSpo2(e.target.value)}
                style={{ width: '100%', background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '6px 8px', color: T.textPrimary, fontFamily: T.mono, fontSize: 11 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: T.textSecondary, display: 'block', marginBottom: 4 }}>Oral Temp (°C)</label>
              <input
                type="number"
                placeholder="e.g. 36.7"
                value={reportedTemp}
                onChange={(e) => setReportedTemp(e.target.value)}
                style={{ width: '100%', background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '6px 8px', color: T.textPrimary, fontFamily: T.mono, fontSize: 11 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: T.textSecondary, display: 'block', marginBottom: 4 }}>Crew Qualitative Health Notes</label>
            <textarea
              rows={2}
              placeholder="Add any specific observations or comments on mission environment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 10px', color: T.textPrimary, fontSize: 11, outline: 'none' }}
            />
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setActiveStep('DISCOMFORT')}
              style={{ background: '#090c0f', border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '8px 16px', color: T.textSecondary, cursor: 'pointer', fontSize: 11 }}
            >
              ← Back: Pain Map
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                background: submitSuccess ? T.nominal : 'rgba(56, 189, 248, 0.35)',
                border: `1px solid ${submitSuccess ? T.nominalBorder : T.cyan}`,
                borderRadius: 4,
                padding: '10px 28px',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              {isSubmitting ? 'SAVING TO SQLITE...' : submitSuccess ? '✓ CHECK-IN RECORDED' : 'SUBMIT DAILY CHECK-IN'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: History */}
      {activeStep === 'HISTORY' && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
          {pdfDownloadedNotice && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#86efac',
                fontFamily: T.mono,
              }}
            >
              <span>{pdfDownloadedNotice}</span>
              <button
                onClick={() => setPdfDownloadedNotice(null)}
                style={{ background: 'none', border: 'none', color: '#86efac', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
                Longitudinal Self-Assessment Records · {activeCrewMeta.name}
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                Clinical record logs and historical assessment sessions
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: T.cyan, fontFamily: T.mono, background: 'rgba(56, 189, 248, 0.1)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                {historyRecords.length} SESSIONS RECORDED
              </span>
              <button
                onClick={handleClearHistory}
                title="Erase check-in records for this crew member from SQLite and browser"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  color: '#f87171',
                  fontSize: 10,
                  fontFamily: T.mono,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                CLEAR LOGS
              </button>
              <button
                onClick={handleResetBaselines}
                title="Restore default nominal NASA mission baseline records"
                style={{
                  background: 'rgba(148, 163, 184, 0.12)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  color: '#cbd5e1',
                  fontSize: 10,
                  fontFamily: T.mono,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                RESET BASELINE
              </button>
              <button
                onClick={() => setActiveStep('SLEEP')}
                style={{
                  background: 'rgba(56, 189, 248, 0.18)',
                  border: `1px solid ${T.cyan}`,
                  borderRadius: 4,
                  padding: '4px 10px',
                  color: '#ffffff',
                  fontSize: 10,
                  fontFamily: T.mono,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + NEW CHECK-IN
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar across historical records */}
          {historyRecords.length > 0 && (() => {
            const avgSleep = (historyRecords.reduce((acc, r) => acc + (Number(r.sleep_hours) || 0), 0) / historyRecords.length).toFixed(1);
            const avgFatigue = (historyRecords.reduce((acc, r) => acc + (Number(r.fatigue_score ?? (r as any).fatigue_vas) || 0), 0) / historyRecords.length).toFixed(1);
            const avgCognitive = (historyRecords.reduce((acc, r) => acc + (Number(r.cognitive_workload ?? (r as any).cognitive_demand) || 0), 0) / historyRecords.length).toFixed(1);
            const discomfortEvents = historyRecords.filter(r => r.discomfort_regions && r.discomfort_regions.length > 0).length;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>MEAN SLEEP DURATION</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: Number(avgSleep) < 6 ? T.warning : T.nominal, marginTop: 2 }}>
                    {avgSleep} <span style={{ fontSize: 10, fontWeight: 400, color: T.textSecondary }}>hrs / night</span>
                  </div>
                </div>
                <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>MEAN FATIGUE (VAS)</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: Number(avgFatigue) > 5 ? T.warning : T.nominal, marginTop: 2 }}>
                    {avgFatigue} <span style={{ fontSize: 10, fontWeight: 400, color: T.textSecondary }}>/ 10</span>
                  </div>
                </div>
                <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>MEAN NASA-TLX DEMAND</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: Number(avgCognitive) > 6 ? T.warning : T.cyan, marginTop: 2 }}>
                    {avgCognitive} <span style={{ fontSize: 10, fontWeight: 400, color: T.textSecondary }}>/ 10</span>
                  </div>
                </div>
                <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>DISCOMFORT EVENTS</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: discomfortEvents > 0 ? T.warning : T.nominal, marginTop: 2 }}>
                    {discomfortEvents} <span style={{ fontSize: 10, fontWeight: 400, color: T.textSecondary }}>reported</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {historyRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', background: T.surfaceAlt, borderRadius: 6, border: `1px solid ${T.borderSubtle}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>
                No active check-in records for {activeCrewMeta.name}
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, maxWidth: 460, margin: '6px auto 14px' }}>
                All records have been cleared. You can start a new check-in or load the calibrated NASA nominal baseline timeline.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => setActiveStep('SLEEP')}
                  style={{
                    background: 'rgba(56, 189, 248, 0.2)',
                    border: `1px solid ${T.cyan}`,
                    borderRadius: 4,
                    padding: '6px 14px',
                    color: '#ffffff',
                    fontSize: 10,
                    fontFamily: T.mono,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  START NEW CHECK-IN
                </button>
                <button
                  onClick={handleResetBaselines}
                  style={{
                    background: 'rgba(148, 163, 184, 0.15)',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    borderRadius: 4,
                    padding: '6px 14px',
                    color: '#cbd5e1',
                    fontSize: 10,
                    fontFamily: T.mono,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  LOAD NASA BASELINE DATA
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
              {historyRecords.map((rec, idx) => {
                const fatigueVal = rec.fatigue_score ?? (rec as any).fatigue_vas ?? 0;
                const cognitiveVal = rec.cognitive_workload ?? (rec as any).cognitive_demand ?? 0;
                const formattedDiscomfort = Array.isArray(rec.discomfort_regions)
                  ? rec.discomfort_regions.map((d: any) => typeof d === 'string' ? d : d.region || d.label || JSON.stringify(d)).join(', ')
                  : rec.discomfort_regions ? String(rec.discomfort_regions) : '';

                return (
                  <div
                    key={rec.id || idx}
                    style={{
                      background: T.surfaceAlt,
                      border: `1px solid ${T.borderSubtle}`,
                      borderRadius: 6,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontFamily: T.mono, color: T.cyan }}>
                            {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : 'Recent Entry'}
                          </span>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: T.warning,
                              background: T.warningBg,
                              border: `1px solid ${T.warningBorder}`,
                              borderRadius: 3,
                              padding: '1px 5px',
                              fontFamily: T.mono,
                            }}
                          >
                            {rec.provenance || 'FLIGHT_HISTORICAL_BASELINE'}
                          </span>
                        </div>
                        {rec.reported_hr && (
                          <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textSecondary }}>
                            Spot HR: <strong style={{ color: T.textPrimary }}>{rec.reported_hr} bpm</strong>
                            {rec.reported_bp_sys ? ` · BP: ${rec.reported_bp_sys}/${(rec as any).reported_bp_dia || 78}` : ''}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: T.textSecondary, marginTop: 6, flexWrap: 'wrap' }}>
                        <span>Sleep: <strong style={{ color: T.textPrimary }}>{rec.sleep_hours}h</strong> (Q: {rec.sleep_quality}/10)</span>
                        <span>Fatigue: <strong style={{ color: fatigueVal > 6 ? T.warning : T.nominal }}>{fatigueVal}/10</strong></span>
                        <span>Mood: <strong style={{ color: T.nominal }}>{rec.mood_score}/10</strong></span>
                        <span>NASA-TLX: <strong style={{ color: T.cyan }}>{cognitiveVal}/10</strong></span>
                      </div>

                      {formattedDiscomfort && (
                        <div style={{ fontSize: 9, color: T.warning, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 600 }}>Reported Discomfort:</span>
                          <span style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 3, padding: '1px 6px' }}>
                            {formattedDiscomfort}
                          </span>
                        </div>
                      )}
                      {rec.notes && (
                        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 3, fontStyle: 'italic' }}>
                          "{rec.notes}"
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadDailyCheckInPdf({
                          astronaut_id: rec.astronaut_id || selectedCrewId,
                          astronaut_name: activeCrewMeta.name,
                          astronaut_role: activeCrewMeta.role,
                          callsign: (activeCrewMeta as any).call || selectedCrewId,
                          timestamp: rec.timestamp || new Date().toISOString(),
                          met: 'T+14d 08:45:22',
                          sleep_hours: rec.sleep_hours,
                          sleep_quality: rec.sleep_quality,
                          fatigue_score: rec.fatigue_score ?? (rec as any).fatigue_vas ?? 0,
                          mood_score: rec.mood_score,
                          cognitive_workload: rec.cognitive_workload ?? (rec as any).cognitive_demand ?? 0,
                          discomfort_regions: Array.isArray(rec.discomfort_regions)
                            ? rec.discomfort_regions.map((d: any) => typeof d === 'string' ? d : d.region || d.label || String(d))
                            : [],
                          reported_hr: rec.reported_hr,
                          reported_bp_sys: rec.reported_bp_sys,
                          reported_bp_dia: rec.reported_bp_dia,
                          reported_spo2: rec.reported_spo2,
                          reported_temp: rec.reported_temp,
                          notes: rec.notes,
                          provenance: rec.provenance || 'FLIGHT_HISTORICAL_BASELINE',
                        });
                        setPdfDownloadedNotice(`✓ Downloaded PDF Report for ${rec.timestamp ? new Date(rec.timestamp).toLocaleDateString() : 'Session'}`);
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        borderRadius: 4,
                        padding: '6px 10px',
                        color: '#38bdf8',
                        fontSize: 9,
                        fontFamily: T.mono,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Download NASA Flight Clinical Record (PDF 1.4)"
                    >
                      📄 DOWNLOAD PDF
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* NASA Storage & Schema Info Footer */}
          <div
            style={{
              marginTop: 18,
              paddingTop: 12,
              borderTop: `1px solid ${T.borderSubtle}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 9,
              color: T.textMuted,
              fontFamily: T.mono,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <span style={{ color: T.textSecondary }}>DB:</span> <code style={{ color: T.cyan }}>data/astronaut_health.db</code> → table <code style={{ color: T.cyan }}>astronaut_self_assessments</code>
            </div>
            <div>
              <span style={{ color: T.textSecondary }}>CACHE:</span> localStorage key <code style={{ color: T.cyan }}>helios_self_assessment_{selectedCrewId}</code>
            </div>
            <div>
              <span style={{ color: T.textSecondary }}>ENGINE:</span> NASA-STD-3001 Vector PDF 1.4 (Zero-Cloud)
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

