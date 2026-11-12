/**
 * frontend/src/components/MissionRoutineAdherence.tsx
 * 
 * NASA Astronaut Daily Mission Routine, Countermeasure Adherence & Cognitive PVT Drill
 * Fully dynamic with real-time astronaut telemetry, adaptive clinical countermeasures,
 * live workout gating, metabolic expenditure tracking, and psychomotor vigilance drill.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { TelemetryPacket } from '../types/telemetry';
import {
  Activity,
  Heart,
  Droplets,
  Flame,
  CheckCircle2,
  Clock,
  Zap,
  Play,
  RotateCcw,
  Shield,
  Brain,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export interface RoutineTask {
  id: string;
  name: string;
  category: 'EXERCISE' | 'HYDRATION' | 'COGNITIVE' | 'CLINICAL';
  target: string;
  completed: boolean;
  timestamp?: string;
  liveBadge?: string;
}

interface CrewProfile {
  id: string;
  name: string;
  role: string;
  roleShort: string;
  avatar: string;
  baseHr: number;
}

const CREW_PROFILES: Record<string, CrewProfile> = {
  'AST-01_COMMANDER': {
    id: 'AST-01_COMMANDER',
    name: 'Commander Haley',
    role: 'Mission Commander · Inspiration4',
    roleShort: 'CDR',
    avatar: '/crew/haley.jpg',
    baseHr: 60,
  },
  'AST-02_PILOT': {
    id: 'AST-02_PILOT',
    name: 'Pilot Chris',
    role: 'Spacecraft Pilot · Propulsion Lead',
    roleShort: 'PLT',
    avatar: '/crew/chris.jpg',
    baseHr: 56,
  },
  'AST-03_MEDICAL': {
    id: 'AST-03_MEDICAL',
    name: 'Dr. Sian',
    role: 'Chief Medical Officer · Payload Specialist',
    roleShort: 'MED',
    avatar: '/crew/sian.jpg',
    baseHr: 64,
  },
  'AST-04_ENGINEER': {
    id: 'AST-04_ENGINEER',
    name: 'Specialist Leo',
    role: 'Flight Engineer · ECLSS Specialist',
    roleShort: 'ENG',
    avatar: '/crew/leo.jpg',
    baseHr: 62,
  },
};

const resolveCrewId = (id: string): string => {
  if (id === 'AST-03_SPECIALIST' || id === 'AST-03_MEDICAL_SPECIALIST') return 'AST-03_MEDICAL';
  if (id === 'AST-04_MISSION_SPECIALIST') return 'AST-04_ENGINEER';
  if (CREW_PROFILES[id]) return id;
  return 'AST-01_COMMANDER';
};

const T = {
  surface: 'rgba(10, 16, 26, 0.85)',
  surfaceAlt: 'rgba(6, 10, 18, 0.92)',
  surfaceCard: 'linear-gradient(135deg, rgba(14, 22, 36, 0.8) 0%, rgba(8, 14, 24, 0.9) 100%)',
  border: 'rgba(56, 189, 248, 0.22)',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#ffffff',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  nominal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  cyan: '#38bdf8',
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'Inter', -apple-system, sans-serif",
};

interface Props {
  astronautId?: string;
  telemetryMap?: Record<string, TelemetryPacket>;
  currentScenario?: string;
  onClose?: () => void;
}

export const MissionRoutineAdherence: React.FC<Props> = ({
  astronautId = 'AST-01_COMMANDER',
  telemetryMap = {},
  currentScenario = 'NOMINAL',
  onClose: _onClose,
}) => {
  const [selectedCrewId, setSelectedCrewId] = useState<string>(() => resolveCrewId(astronautId));
  const [isSimulatedWorkout, setIsSimulatedWorkout] = useState<boolean>(false);

  useEffect(() => {
    if (astronautId) {
      setSelectedCrewId(resolveCrewId(astronautId));
    }
  }, [astronautId]);

  const activeProfile = CREW_PROFILES[resolveCrewId(selectedCrewId)] || CREW_PROFILES['AST-01_COMMANDER'];

  // Robust live telemetry resolution supporting multiple ID conventions
  const normalizedId = resolveCrewId(selectedCrewId);
  const activeTelemetry: TelemetryPacket | undefined =
    telemetryMap[normalizedId] ||
    telemetryMap[selectedCrewId] ||
    (normalizedId === 'AST-03_MEDICAL' ? telemetryMap['AST-03_MEDICAL_SPECIALIST'] || telemetryMap['AST-03_SPECIALIST'] : undefined) ||
    (normalizedId === 'AST-04_ENGINEER' ? telemetryMap['AST-04_MISSION_SPECIALIST'] : undefined);

  // Live physiological values bound directly to telemetry
  const baseLiveHr = Math.round(activeTelemetry?.heart_rate ?? activeProfile.baseHr);
  const liveHr = isSimulatedWorkout ? Math.max(128, baseLiveHr + 45) : baseLiveHr;
  const liveSpo2 = activeTelemetry?.spo2 ?? 98.2;
  const liveTemp = activeTelemetry?.core_temp ?? 36.8;
  const liveHrv = Math.round(activeTelemetry?.hrv_rmssd ?? 65);
  const liveK = activeTelemetry?.potassium ?? 4.40;
  const liveHct = activeTelemetry?.hematocrit ?? 43.6;

  const isWorkout = isSimulatedWorkout || activeTelemetry?.mission_state === 'WORKOUT' || liveHr > 95;

  // Calorie & Metabolic burn rates dynamically derived from live heart rate
  const liveBurnRateKcal = Math.round(isWorkout ? (liveHr - 45) * 5.2 : (liveHr - 30) * 1.35);

  // Hydration state per crew
  const [waterMl, setWaterMl] = useState<number>(() => {
    const savedWater = localStorage.getItem(`helios_fluid_${normalizedId}`);
    if (savedWater) {
      try { return Number(savedWater); } catch {}
    }
    return normalizedId === 'AST-01_COMMANDER' ? 2500 : 1600;
  });

  useEffect(() => {
    const savedWater = localStorage.getItem(`helios_fluid_${normalizedId}`);
    if (savedWater) {
      try { setWaterMl(Number(savedWater)); } catch {}
    } else {
      setWaterMl(normalizedId === 'AST-01_COMMANDER' ? 2500 : 1600);
    }
  }, [normalizedId]);

  useEffect(() => {
    localStorage.setItem(`helios_fluid_${normalizedId}`, waterMl.toString());
  }, [waterMl, normalizedId]);

  // Dynamic tasks generation reacting to real-time clinical biomarkers & flight scenarios
  const defaultTasks: RoutineTask[] = useMemo(() => {
    const list: RoutineTask[] = [
      {
        id: 't1',
        name: 'Morning Clinical Self-Assessment & Sleep Debt Log',
        category: 'CLINICAL',
        target: 'Record VAS symptom scoring and sleep duration',
        completed: true,
        timestamp: '08:15 UTC',
      },
      {
        id: 't2',
        name: 'ARED Resistive Exercise (Squat, Deadlift & Heel Raise)',
        category: 'EXERCISE',
        target: '11.8 MJ mechanical work profile · Maintain bone density',
        completed: !isWorkout && liveHr <= 90,
        timestamp: !isWorkout && liveHr <= 90 ? '10:30 UTC' : undefined,
        liveBadge: isWorkout ? `ACTIVE WORKOUT (HR: ${liveHr} bpm · ${liveBurnRateKcal} kcal/h)` : undefined,
      },
      {
        id: 't3',
        name: 'T2 Cycle Ergometer (CEVIS) Aerobic Endurance Protocol',
        category: 'EXERCISE',
        target: '30 min at 75% VO₂ peak · Counteract microgravity cardiac remodeling',
        completed: normalizedId === 'AST-01_COMMANDER',
        timestamp: normalizedId === 'AST-01_COMMANDER' ? '11:15 UTC' : undefined,
      },
      {
        id: 't4',
        name: 'Cognitive PVT Vigilance & Psychomotor Reaction Drill',
        category: 'COGNITIVE',
        target: '< 280 ms reaction latency · NASA cognitive fatigue sentry',
        completed: normalizedId === 'AST-01_COMMANDER',
        timestamp: normalizedId === 'AST-01_COMMANDER' ? '242 ms' : undefined,
      },
      {
        id: 't5',
        name: 'Daily Fluid Balance & Electrolyte Hydration Target',
        category: 'HYDRATION',
        target: liveHct > 44.0
          ? `ELEVATED TARGET: Intravascular fluid contraction (Hct ${liveHct.toFixed(1)}%)`
          : '2.5 L oral hydration · Maintain central venous return',
        completed: waterMl >= 2500,
        timestamp: waterMl >= 2500 ? 'Target Achieved' : `${waterMl}/2500 mL`,
      },
    ];

    // Reactive clinical countermeasure tasks based on active scenarios
    if (currentScenario.includes('HYPOKALEMIA') || liveK < 3.8) {
      list.unshift({
        id: 't_hypok',
        name: 'CLINICAL PRIORITY: Oral KCl Electrolyte Supplementation',
        category: 'CLINICAL',
        target: `Administer 20-40 mEq KCl pouch · Serum K⁺: ${liveK.toFixed(2)} mmol/L`,
        completed: false,
        liveBadge: 'URGENT COUNTERMEASURE',
      });
    }

    if (currentScenario.includes('CO2') || currentScenario.includes('SCRUBBER')) {
      list.push({
        id: 't_eclss',
        name: 'ECLSS LiOH Scrubber Inspection & Cabin Air Circulation',
        category: 'CLINICAL',
        target: 'Verify CO₂ scrubber absorption rate > 98%',
        completed: false,
        liveBadge: 'ENVIRONMENTAL SENTRY',
      });
    }

    if (normalizedId === 'AST-03_MEDICAL') {
      list.push({
        id: 't_med_lab',
        name: 'NASA OSDR Bio-Assay In-Flight Capillary Sampling',
        category: 'CLINICAL',
        target: 'Sample capillary hematocrit & urine osmolality q48h',
        completed: true,
        timestamp: '09:45 UTC',
      });
    }

    return list;
  }, [normalizedId, isWorkout, liveHr, liveBurnRateKcal, liveHct, liveK, waterMl, currentScenario]);

  // Tasks state per astronaut with persistence
  const [tasks, setTasks] = useState<RoutineTask[]>(() => {
    const saved = localStorage.getItem(`helios_routine_tasks_${normalizedId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return defaultTasks;
  });

  useEffect(() => {
    const saved = localStorage.getItem(`helios_routine_tasks_${normalizedId}`);
    if (saved) {
      try {
        const parsed: RoutineTask[] = JSON.parse(saved);
        // Merge dynamically updated targets and badges
        const merged = defaultTasks.map(def => {
          const match = parsed.find(p => p.id === def.id);
          return match ? { ...def, completed: match.completed, timestamp: match.timestamp || def.timestamp } : def;
        });
        setTasks(merged);
        return;
      } catch {}
    }
    setTasks(defaultTasks);
  }, [normalizedId, defaultTasks]);

  useEffect(() => {
    localStorage.setItem(`helios_routine_tasks_${normalizedId}`, JSON.stringify(tasks));
  }, [tasks, normalizedId]);

  // Toggle routine task completion
  const toggleTask = (id: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              timestamp: !t.completed ? new Date().toISOString().substring(11, 16) + ' UTC' : undefined,
            }
          : t
      )
    );
  };

  // Hydration tracker handlers
  const addWater = (ml: number) => {
    setWaterMl(prev => {
      const next = Math.min(3500, prev + ml);
      if (next >= 2500) {
        setTasks(tPrev =>
          tPrev.map(t => (t.id === 't5' ? { ...t, completed: true, timestamp: 'Target Achieved' } : t))
        );
      }
      return next;
    });
  };

  const resetWater = () => {
    setWaterMl(1200);
    setTasks(tPrev =>
      tPrev.map(t => (t.id === 't5' ? { ...t, completed: false, timestamp: undefined } : t))
    );
  };

  // Psychomotor Vigilance Task (PVT) Game State & Reaction Logic
  const [pvtState, setPvtState] = useState<'IDLE' | 'WAITING' | 'STIMULUS' | 'RESULT'>('IDLE');
  const [reactionTimeMs, setReactionTimeMs] = useState<number | null>(null);
  const [pvtBest, setPvtBest] = useState<number | null>(() => {
    const savedBest = localStorage.getItem(`helios_pvt_best_${normalizedId}`);
    return savedBest ? Number(savedBest) : (normalizedId === 'AST-01_COMMANDER' ? 242 : null);
  });
  const pvtStartTimeRef = useRef<number>(0);
  const pvtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPvtTest = () => {
    setPvtState('WAITING');
    setReactionTimeMs(null);
    const randomDelay = Math.floor(1800 + Math.random() * 2800); // 1.8 to 4.6 seconds
    pvtTimerRef.current = setTimeout(() => {
      pvtStartTimeRef.current = performance.now();
      setPvtState('STIMULUS');
    }, randomDelay);
  };

  const handlePvtClick = () => {
    if (pvtState === 'WAITING') {
      if (pvtTimerRef.current) clearTimeout(pvtTimerRef.current);
      setPvtState('RESULT');
      setReactionTimeMs(-1); // False start
    } else if (pvtState === 'STIMULUS') {
      const elapsed = Math.round(performance.now() - pvtStartTimeRef.current);
      setReactionTimeMs(elapsed);
      setPvtState('RESULT');
      setPvtBest(prev => {
        const next = prev === null ? elapsed : Math.min(prev, elapsed);
        localStorage.setItem(`helios_pvt_best_${normalizedId}`, next.toString());
        return next;
      });
      if (elapsed < 320) {
        setTasks(prev =>
          prev.map(t => (t.id === 't4' ? { ...t, completed: true, timestamp: `${elapsed} ms` } : t))
        );
      }
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const adherencePercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // SVG Radial Ring calculation
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (adherencePercent / 100) * ringCircumference;

  return (
    <div style={{ width: '100%', maxWidth: 1440, margin: '0 auto', padding: '12px 18px', color: T.textPrimary, fontFamily: T.sans }}>
      {/* ── Top Header Bar with Live Crew Switcher ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: T.surfaceCard,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 16,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Activity size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '0.04em', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>ASTRONAUT MISSION ROUTINE & COUNTERMEASURES</span>
              <span style={{
                fontSize: 8.5,
                fontFamily: T.mono,
                color: '#34d399',
                background: 'rgba(52, 211, 153, 0.14)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                padding: '1.5px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}>
                ● TELEMETRY LINKED
              </span>
            </div>
            <div style={{ fontSize: 9.5, color: T.textMuted, fontFamily: T.mono, marginTop: 2 }}>
              Flight schedule adherence, live exercise load tracking, fluid balance & cognitive readiness
            </div>
          </div>
        </div>

        {/* Crew Selector Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.45)', padding: 4, borderRadius: 8, border: `1px solid ${T.borderSubtle}` }}>
          {Object.entries(CREW_PROFILES).map(([id, meta]) => {
            const isSel = normalizedId === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedCrewId(id)}
                style={{
                  background: isSel ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.28) 0%, rgba(2, 132, 199, 0.2) 100%)' : 'transparent',
                  border: isSel ? `1px solid ${T.cyan}` : '1px solid transparent',
                  borderRadius: 6,
                  padding: '5px 12px',
                  color: isSel ? '#ffffff' : T.textMuted,
                  fontSize: 10.5,
                  fontWeight: isSel ? 800 : 600,
                  fontFamily: T.mono,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.16s ease',
                  boxShadow: isSel ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isSel ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)',
                  boxShadow: isSel ? '0 0 6px #38bdf8' : 'none',
                }} />
                <span>{meta.roleShort} {meta.name.split(' ')[1] || meta.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Live Astronaut Telemetry & Daily Adherence Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {/* 1. Active Astronaut Card */}
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px', backdropFilter: 'blur(16px)' }}>
          <div style={{ fontSize: 9.5, color: T.textMuted, fontFamily: T.mono, letterSpacing: '0.04em' }}>CREW ROSTER IDENTIFIER</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{activeProfile.name}</span>
            <span style={{ fontSize: 9, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.16)', padding: '1px 5px', borderRadius: 3 }}>
              {activeProfile.roleShort}
            </span>
          </div>
          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>{activeProfile.role}</div>
        </div>

        {/* 2. Live Cardiovascular Telemetry */}
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px', backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 9.5, color: T.textMuted, fontFamily: T.mono, letterSpacing: '0.04em' }}>LIVE CARDIAC EXPENDITURE</div>
            <button
              onClick={() => setIsSimulatedWorkout(prev => !prev)}
              title="Toggle simulated exercise workout state"
              style={{
                background: isWorkout ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.12)',
                border: `1px solid ${isWorkout ? T.warning : T.cyan}`,
                color: isWorkout ? '#fde047' : '#38bdf8',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 8.5,
                fontFamily: T.mono,
                cursor: 'pointer',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Zap size={9} />
              <span>{isWorkout ? 'END DRILL' : 'SIMULATE WORKOUT'}</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: isWorkout ? '#fbbf24' : '#ffffff' }}>
              {liveHr}
            </span>
            <span style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: T.mono }}>bpm</span>
            <span style={{ fontSize: 9.5, color: '#38bdf8', fontFamily: T.mono, marginLeft: 8 }}>
              {liveBurnRateKcal} kcal/h
            </span>
          </div>
          <div style={{ fontSize: 9, color: isWorkout ? '#fde047' : '#34d399', fontFamily: T.mono, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: isWorkout ? '#f59e0b' : '#10b981' }} />
            <span>{isWorkout ? 'ARED/CEVIS EXERCISE ACTIVE' : 'NOMINAL FLIGHT BASELINE'}</span>
          </div>
        </div>

        {/* 3. Daily Adherence Radial Gauge */}
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(16px)' }}>
          <div>
            <div style={{ fontSize: 9.5, color: T.textMuted, fontFamily: T.mono, letterSpacing: '0.04em' }}>DAILY ADHERENCE SCORE</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: adherencePercent >= 80 ? '#34d399' : '#fbbf24', marginTop: 1 }}>
              {adherencePercent}%
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: T.mono, marginTop: 1 }}>
              {completedCount} of {tasks.length} countermeasures verified
            </div>
          </div>
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r={ringRadius} stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" fill="none" />
              <circle
                cx="28"
                cy="28"
                r={ringRadius}
                stroke={adherencePercent >= 80 ? '#34d399' : '#fbbf24'}
                strokeWidth="4.5"
                fill="none"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#f8fafc', fontFamily: T.mono }}>
              {completedCount}/{tasks.length}
            </div>
          </div>
        </div>

        {/* 4. Real-Time Biomarker Strip */}
        <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px', backdropFilter: 'blur(16px)' }}>
          <div style={{ fontSize: 9.5, color: T.textMuted, fontFamily: T.mono, letterSpacing: '0.04em' }}>PHYSIOLOGICAL PROFILE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4, fontFamily: T.mono, fontSize: 9.5 }}>
            <div>
              <span style={{ color: '#94a3b8' }}>SpO₂: </span>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>{liveSpo2.toFixed(1)}%</span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>HRV: </span>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>{liveHrv} ms</span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Serum K⁺: </span>
              <span style={{ color: liveK < 3.8 ? '#f87171' : '#38bdf8', fontWeight: 700 }}>{liveK.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Hct: </span>
              <span style={{ color: liveHct > 44 ? '#fbbf24' : '#ffffff', fontWeight: 700 }}>{liveHct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Routine Tasks on Left, Interactive PVT Drill & Hydration on Right ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(520px, 1.4fr) minmax(380px, 1fr)', gap: 16 }}>
        {/* Left: Interactive Checklist */}
        <div
          data-tour="routine-card"
          style={{
            background: T.surfaceCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 18,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', color: '#f8fafc' }}>
                DAILY COUNTERMEASURE SCHEDULE · {activeProfile.name}
              </div>
              <div style={{ fontSize: 9.5, color: T.textMuted, fontFamily: T.mono, marginTop: 2 }}>
                Click any task to verify completion or toggle mission status
              </div>
            </div>
            <span style={{
              fontSize: 9,
              color: T.cyan,
              fontFamily: T.mono,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 700,
            }}>
              INTERACTIVE LOG
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map(task => {
              const isTaskActive = task.liveBadge !== undefined;
              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  style={{
                    background: task.completed
                      ? 'rgba(16, 185, 129, 0.08)'
                      : isTaskActive
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(10, 16, 26, 0.65)',
                    border: `1px solid ${
                      task.completed
                        ? 'rgba(16, 185, 129, 0.35)'
                        : isTaskActive
                          ? 'rgba(245, 158, 11, 0.4)'
                          : 'rgba(255, 255, 255, 0.08)'
                    }`,
                    borderLeft: `3px solid ${
                      task.completed
                        ? '#10b981'
                        : isTaskActive
                          ? '#f59e0b'
                          : task.category === 'EXERCISE'
                            ? '#38bdf8'
                            : task.category === 'HYDRATION'
                              ? '#0ea5e9'
                              : task.category === 'COGNITIVE'
                                ? '#fbbf24'
                                : '#34d399'
                    }`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        border: `1.5px solid ${task.completed ? '#10b981' : 'rgba(255, 255, 255, 0.25)'}`,
                        background: task.completed ? '#10b981' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 900,
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {task.completed && '✓'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: task.completed ? '#f8fafc' : '#e2e8f0' }}>
                          {task.name}
                        </span>
                        {task.liveBadge && (
                          <span style={{
                            fontSize: 8,
                            fontWeight: 800,
                            fontFamily: T.mono,
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.18)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}>
                            {task.liveBadge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.target}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 800,
                        color: task.category === 'EXERCISE'
                          ? '#38bdf8'
                          : task.category === 'HYDRATION'
                            ? '#0ea5e9'
                            : task.category === 'COGNITIVE'
                              ? '#fbbf24'
                              : '#34d399',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontFamily: T.mono,
                      }}
                    >
                      {task.category}
                    </span>
                    {task.timestamp && (
                      <div style={{ fontSize: 9, color: '#34d399', fontFamily: T.mono, marginTop: 3, fontWeight: 600 }}>
                        {task.timestamp}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Interactive Hydration Countermeasure & Cognitive PVT Drill */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hydration Tracker Card */}
          <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Droplets size={14} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc' }}>FLUID & ELECTROLYTE TARGET</span>
              </div>
              <span style={{ fontSize: 10.5, color: waterMl >= 2500 ? '#34d399' : '#fbbf24', fontFamily: T.mono, fontWeight: 800 }}>
                {waterMl} / 2500 mL
              </span>
            </div>

            <div style={{ height: 8, background: 'rgba(0, 0, 0, 0.45)', borderRadius: 4, overflow: 'hidden', marginBottom: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.round((waterMl / 2500) * 100))}%`,
                  height: '100%',
                  background: waterMl >= 2500
                    ? 'linear-gradient(90deg, #0ea5e9 0%, #10b981 100%)'
                    : 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                  borderRadius: 4,
                  transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => addWater(250)}
                style={{
                  flex: 1,
                  background: 'rgba(56, 189, 248, 0.14)',
                  border: `1px solid ${T.cyan}`,
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#ffffff',
                  fontSize: 10.5,
                  fontFamily: T.mono,
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
              >
                + 250 mL Water
              </button>
              <button
                onClick={() => addWater(500)}
                style={{
                  flex: 1,
                  background: 'rgba(14, 165, 233, 0.18)',
                  border: '1px solid #0ea5e9',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#ffffff',
                  fontSize: 10.5,
                  fontFamily: T.mono,
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
              >
                + 500 mL Electrolytes
              </button>
              <button
                onClick={resetWater}
                title="Reset fluid intake tracker"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#94a3b8',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>

          {/* Psychomotor Vigilance Task (PVT) Game Box */}
          <div style={{ background: T.surfaceCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Brain size={14} style={{ color: '#fbbf24' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc' }}>PSYCHOMOTOR VIGILANCE (PVT)</div>
                  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>NASA Cognitive Reaction Latency Drill</div>
                </div>
              </div>
              {pvtBest !== null && (
                <span style={{ fontSize: 9.5, color: '#34d399', fontFamily: T.mono, fontWeight: 800, background: 'rgba(52, 211, 153, 0.12)', padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(52, 211, 153, 0.25)' }}>
                  BEST: {pvtBest} ms
                </span>
              )}
            </div>

            <div
              onClick={handlePvtClick}
              style={{
                height: 155,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: pvtState === 'IDLE' ? 'default' : 'pointer',
                userSelect: 'none',
                background:
                  pvtState === 'STIMULUS'
                    ? '#b91c1c'
                    : pvtState === 'WAITING'
                      ? 'rgba(15, 23, 42, 0.95)'
                      : 'rgba(5, 8, 14, 0.85)',
                border: `2px solid ${
                  pvtState === 'STIMULUS'
                    ? '#ef4444'
                    : pvtState === 'WAITING'
                      ? '#38bdf8'
                      : 'rgba(255, 255, 255, 0.08)'
                }`,
                boxShadow: pvtState === 'STIMULUS' ? '0 0 24px rgba(239, 68, 68, 0.6)' : 'none',
                transition: 'background-color 0.04s ease',
              }}
            >
              {pvtState === 'IDLE' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4, color: '#f8fafc' }}>Cognitive Test Ready</div>
                  <div style={{ fontSize: 9.5, color: T.textMuted, marginBottom: 12 }}>
                    Click Start. When box turns RED, click as fast as possible!
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startPvtTest();
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(2, 132, 199, 0.25) 100%)',
                      border: `1px solid ${T.cyan}`,
                      borderRadius: 6,
                      padding: '8px 24px',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: T.mono,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    START PVT TEST
                  </button>
                </div>
              )}

              {pvtState === 'WAITING' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>WAIT FOR RED FLASH...</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>Do not click prematurely!</div>
                </div>
              )}

              {pvtState === 'STIMULUS' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', letterSpacing: '0.06em' }}>CLICK NOW!</div>
                </div>
              )}

              {pvtState === 'RESULT' && (
                <div style={{ textAlign: 'center' }}>
                  {reactionTimeMs === -1 ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.warning }}>FALSE START</div>
                      <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 4 }}>Clicked before the visual stimulus appeared.</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 900, color: (reactionTimeMs || 0) < 280 ? '#34d399' : '#fbbf24', fontFamily: T.mono }}>
                        {reactionTimeMs} ms
                      </div>
                      <div style={{ fontSize: 9.5, color: (reactionTimeMs || 0) < 280 ? '#34d399' : '#fbbf24', marginTop: 2, fontWeight: 600 }}>
                        {(reactionTimeMs || 0) < 280 ? '✓ Optimal Alertness · Flight Certified' : 'Moderate Alertness · Recommend Scheduled Rest'}
                      </div>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startPvtTest();
                    }}
                    style={{
                      marginTop: 10,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 4,
                      padding: '4px 14px',
                      color: '#cbd5e1',
                      fontSize: 10,
                      fontFamily: T.mono,
                      cursor: 'pointer',
                    }}
                  >
                    Test Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
