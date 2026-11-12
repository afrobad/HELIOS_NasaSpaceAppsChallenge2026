import { useState, useEffect } from 'react';
import type { CrewAlert, AlertPayload, AlertEvidence, AlertStep, AlertTimelineEvent } from '../types/telemetry';
import { wsService } from './websocketService';

export const INITIAL_CREW_ALERTS: CrewAlert[] = [
  // ─── 1. COMMANDER HALEY (AST-01) ───
  {
    id: 'ALT-H01',
    crewId: 'AST-01_COMMANDER',
    metric: 'hr',
    title: 'Exertion Supraventricular Tachycardia & Arrhythmia Risk',
    hazard: 'cardiovascular',
    status: 'act',
    peakStatus: 'act',
    openedAt: 'T+00:14:22',
    explanation:
      'Heart rate spiked to 148 bpm during cycle ergometer exercise with persistent premature ventricular complexes (PVCs) and prolonged Fridericia QTc (482 ms). Exceeds 2.8σ from resting cardiovascular baseline.',
    z: 2.8,
    series: [72, 74, 76, 85, 112, 134, 148, 146, 141, 132, 124],
    evidence: [
      {
        source: 'NASA NTRS',
        id: '20170005625',
        title: 'Risk of Cardiac Rhythm Problems During Spaceflight',
        why: 'Human Research Program clinical evidence linking microgravity autonomic shifts to exertion dysrhythmias.',
        url: 'https://ntrs.nasa.gov/citations/20170005625',
      },
      {
        source: 'NASA OSDR',
        id: 'OSD-484 · doi:10.26030/semj-9y19',
        title: 'Astronauts plasma-derived exosomes induced gene expression in AC16 cells',
        why: 'Post-flight human plasma exosome alterations modulate cardiac muscle electrophysiology and stress signaling.',
        url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-484',
      },
    ],
    steps: [
      { text: 'Halt cycle ergometer exercise immediately and transition to active seated cooldown', done: true },
      { text: 'Capture diagnostic 12-lead ECG telemetry via Bio-Monitor garment', done: true },
      { text: 'Oral electrolyte fluid rehydration protocol (500 mL balanced oral rehydration solution)', done: false },
      { text: 'Notify Medical Officer and re-evaluate cardiac rhythm in 15 minutes', done: false },
    ],
    timeline: [
      { ts: 'T+00:14:22', kind: 'opened', label: 'Opened as ACT (148 bpm, PVC bursts)' },
      { ts: 'T+00:16:05', kind: 'step', label: 'Step done: Halt cycle ergometer exercise' },
      { ts: 'T+00:18:40', kind: 'step', label: 'Step done: Capture 12-lead ECG telemetry' },
    ],
  },
  {
    id: 'ALT-H02',
    crewId: 'AST-01_COMMANDER',
    metric: 'sleep',
    title: 'Circadian Desynchronization & Rest Latency Deficit',
    hazard: 'sleep',
    status: 'watch',
    peakStatus: 'watch',
    openedAt: 'T+00:46:10',
    explanation:
      'Total sleep duration recorded at 4.6 hours over last sleep block with marked REM suppression (11%). Psychomotor vigilance test (PVT) reaction latency degraded by 16%.',
    z: 1.8,
    series: [7.4, 7.1, 6.8, 6.2, 5.4, 4.8, 4.6],
    evidence: [
      {
        source: 'NASA NTRS',
        id: '20160003864',
        title: 'Risk of Performance Decrements Resulting from Sleep Loss and Circadian Desynchronization',
        why: 'Human Research Program quantified decrements in cognitive speed and operational error margins from acute sleep loss.',
        url: 'https://ntrs.nasa.gov/citations/20160003864',
      },
    ],
    steps: [
      { text: 'Dim sleep quarters ambient lighting to blue-depleted circadian rest spectrum (<480 nm)', done: true },
      { text: 'Schedule 45-minute tactical sleep nap opportunity prior to docking window', done: false },
      { text: 'Review mission timeline and reschedule high-cognitive operational tasks', done: false },
    ],
    timeline: [
      { ts: 'T+00:46:10', kind: 'opened', label: 'Opened as WATCH (4.6 hrs sleep recorded)' },
      { ts: 'T+00:49:12', kind: 'step', label: 'Step done: Dim sleep quarters ambient lighting' },
    ],
  },

  // ─── 2. PILOT CHRIS (AST-02) ───
  {
    id: 'ALT-C01',
    crewId: 'AST-02_PILOT',
    metric: 'decompression',
    title: 'Hypobaric Cabin Decompression & Arterial Hypoxia Alert',
    hazard: 'decompression',
    status: 'act',
    peakStatus: 'act',
    openedAt: 'T+00:08:14',
    explanation:
      'Cabin atmospheric pressure experienced a transient drop to 92.4 kPa with concurrent peripheral arterial oxygen saturation (SpO₂) dipping to 91%. Risk of venous gas emboli (VGE) formation.',
    z: 3.2,
    series: [98, 98, 97, 95, 93, 91, 91],
    evidence: [
      {
        source: 'NASA NTRS',
        id: '20160012725',
        title: 'ISS Hypobaric Cabin Environment and Physiological Decompression Sentry Guidelines',
        why: 'Threshold criteria for arterial hypoxia onset and venous gas bubble formation during atmospheric leaks.',
        url: 'https://ntrs.nasa.gov/citations/20160012725',
      },
    ],
    steps: [
      { text: 'Don emergency Quick-Don oxygen mask with 100% O2 delivery', done: true },
      { text: 'Verify pilot console pressure seal and lock forward hatch bulkhead', done: true },
      { text: 'Engage cabin automated N2 repressurization valve banks', done: true },
      { text: 'Perform precordial Doppler ultrasound assessment for venous gas emboli', done: false },
    ],
    timeline: [
      { ts: 'T+00:08:14', kind: 'opened', label: 'Opened as ACT (92.4 kPa, SpO2 91%)' },
      { ts: 'T+00:09:02', kind: 'step', label: 'Step done: Don emergency Quick-Don oxygen mask' },
      { ts: 'T+00:10:45', kind: 'step', label: 'Step done: Lock forward hatch bulkhead' },
      { ts: 'T+00:12:10', kind: 'step', label: 'Step done: Engage N2 repressurization valve banks' },
    ],
  },
  {
    id: 'ALT-C02',
    crewId: 'AST-02_PILOT',
    metric: 'co2',
    title: 'Elevated Cabin Carbon Dioxide Sentry (3.4 mmHg)',
    hazard: 'environment',
    status: 'watch',
    peakStatus: 'watch',
    openedAt: 'T+00:27:50',
    explanation:
      'Cabin CO₂ partial pressure reached 3.4 mmHg due to desiccant bed bypass during CDRA cycle regeneration. Pilot reports mild bilateral headache.',
    z: 2.1,
    series: [1.8, 2.0, 2.4, 2.8, 3.2, 3.4],
    evidence: [
      {
        source: 'NASA NTRS',
        id: '20160012725',
        title: 'Relationship Between Carbon Dioxide Levels and Reported Congestion/Headaches on ISS',
        why: 'Elevated crew headache odds ratio observed when spacecraft CO2 exceeds 3.0 mmHg.',
        url: 'https://ntrs.nasa.gov/citations/20160012725',
      },
    ],
    steps: [
      { text: 'Switch Carbon Dioxide Removal Assembly (CDRA) to high-throughput desorption cycle', done: true },
      { text: 'Inspect backup LiOH canister bed seals in Service Module', done: false },
      { text: 'Boost inter-module ventilation (IMV) circulation fan velocity', done: false },
    ],
    timeline: [
      { ts: 'T+00:27:50', kind: 'opened', label: 'Opened as WATCH (CO2 at 3.4 mmHg)' },
      { ts: 'T+00:30:15', kind: 'step', label: 'Step done: Switch CDRA to high-throughput cycle' },
    ],
  },

  // ─── 3. DR. SIAN (AST-03) ───
  {
    id: 'ALT-S01',
    crewId: 'AST-03_MEDICAL',
    metric: 'dose',
    title: 'Solar Particle Event (SPE) High-Energy Radiation Flux',
    hazard: 'radiation',
    status: 'act',
    peakStatus: 'act',
    openedAt: 'T+00:22:05',
    explanation:
      'External active dosimeters detected coronal mass ejection proton stream exceeding 1.8 mSv/h. Radiation Severity Index (RSI) elevated to 0.82 with cumulative organ exposure hazard.',
    z: 3.5,
    series: [0.04, 0.05, 0.14, 0.58, 1.25, 1.78, 1.82],
    evidence: [
      {
        source: 'NASA OSDR',
        id: 'OSD-993 · doi:10.26030/4kkv-z246',
        title: 'Space radiation induces distinct senescent phenotypes: Implications for space travel',
        why: 'Heavy particle radiation exposure triggers cellular senescence and DNA strand double-breaks in human hematopoiesis.',
        url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-993',
      },
    ],
    steps: [
      { text: 'Broadcast vessel-wide Radiation Shelter relocation alert to all modules', done: true },
      { text: 'Muster crew in central polyethylene/water-shielded Storm Haven shelter', done: true },
      { text: 'Distribute prophylactic radioprotective oral antioxidant formulation', done: false },
      { text: 'Lock external EVA airlock hatches and power down unshielded sensors', done: false },
    ],
    timeline: [
      { ts: 'T+00:22:05', kind: 'opened', label: 'Opened as ACT (SPE flux 1.82 mSv/h)' },
      { ts: 'T+00:23:18', kind: 'step', label: 'Step done: Broadcast vessel-wide shelter alert' },
      { ts: 'T+00:25:40', kind: 'step', label: 'Step done: Muster crew in central Storm Haven' },
    ],
  },

  // ─── 4. SPECIALIST LEO (AST-04) ───
  {
    id: 'ALT-L01',
    crewId: 'AST-04_ENGINEER',
    metric: 'environment',
    title: 'External Thermal Loop Ammonia (NH₃) Vapor Breakthrough',
    hazard: 'toxin',
    status: 'act',
    peakStatus: 'act',
    openedAt: 'T+00:11:30',
    explanation:
      'Internal atmosphere sensors detected 28 ppm trace ammonia vapor following secondary thermal control loop valve cycle. Severe respiratory and eye mucosal irritation hazard.',
    z: 3.9,
    series: [0, 0, 1, 6, 14, 22, 28],
    evidence: [
      {
        source: 'NASA NTRS',
        id: '20160012725',
        title: 'Emergency Ammonia Isolation and Atmospheric Decontamination Protocols',
        why: 'Guidelines for anhydrous ammonia breakthrough containment and catalytic air scrubber regeneration.',
        url: 'https://ntrs.nasa.gov/citations/20160012725',
      },
    ],
    steps: [
      { text: 'Don Emergency Escape Breathing Apparatus (EEBA) mask immediately', done: true },
      { text: 'Isolate module ventilation dampers and seal node inter-hatch', done: true },
      { text: 'Engage Trace Contaminant Control System (TCCS) charcoal scrubbing beds', done: false },
      { text: 'Verify zero-leak isolation across thermal loop heat exchanger manifold', done: false },
    ],
    timeline: [
      { ts: 'T+00:11:30', kind: 'opened', label: 'Opened as ACT (28 ppm NH3 detected)' },
      { ts: 'T+00:12:15', kind: 'step', label: 'Step done: Don EEBA mask immediately' },
      { ts: 'T+00:14:00', kind: 'step', label: 'Step done: Isolate module ventilation dampers' },
    ],
  },
];

export const INITIAL_RESOLVED_ALERTS: CrewAlert[] = [
  {
    id: 'ALT-RES-01',
    crewId: 'AST-01_COMMANDER',
    metric: 'cardiovascular',
    title: 'Space Motion Sickness (SMS) Acute Neurovestibular Adaptation',
    hazard: 'cardiovascular',
    status: 'resolved',
    peakStatus: 'act',
    openedAt: 'T-04:12:00',
    resolvedAt: 'T-02:15:00',
    explanation:
      'Acute cephalic fluid shift and vestibular mismatch induced transient motion discomfort following insertion. Controlled via Promethazine countermeasure.',
    z: 2.2,
    series: [100, 85, 70, 60, 45, 20, 10],
    evidence: [],
    steps: [
      { text: 'Intramuscular Promethazine countermeasure administration', done: true },
      { text: 'Head movement restriction protocol during orbital insertion', done: true },
    ],
    timeline: [
      { ts: 'T-04:12:00', kind: 'opened', label: 'Opened as ACT (Acute motion sickness)' },
      { ts: 'T-03:45:00', kind: 'step', label: 'Step done: Intramuscular Promethazine' },
      { ts: 'T-02:15:00', kind: 'resolved', label: 'Resolved, back within nominal range' },
    ],
  },
  {
    id: 'ALT-RES-02',
    crewId: 'AST-04_ENGINEER',
    metric: 'environment',
    title: 'Cabin Particulate HEPA Filtration Auto-Purge',
    hazard: 'environment',
    status: 'resolved',
    peakStatus: 'watch',
    openedAt: 'T-06:30:00',
    resolvedAt: 'T-04:45:00',
    explanation:
      'Particulate sensor detected transient lunar simulant dust aerosolization (0.42 mg/m3) during cargo container transfer.',
    z: 1.6,
    series: [0.1, 0.2, 0.42, 0.35, 0.2, 0.08],
    evidence: [],
    steps: [
      { text: 'Activate high-velocity cabin HEPA air scrubber recirculator', done: true },
      { text: 'Inspect air intake filter seals', done: true },
    ],
    timeline: [
      { ts: 'T-06:30:00', kind: 'opened', label: 'Opened as WATCH (Particulate spike)' },
      { ts: 'T-04:45:00', kind: 'resolved', label: 'Resolved, back within nominal range' },
    ],
  },
];

// Helper functions to map backend alerts & WebSocket payloads into CrewAlert
function mapBackendAlertToCrewAlert(alert: any): CrewAlert {
  const id = `ALT-BACKEND-${alert.id}`;
  const rawId = alert.astronaut_id || 'ALL_CREW';
  const crewId = rawId === 'ALL_CREW' ? 'AST-01_COMMANDER' : rawId;
  const severity = (alert.severity || 'WARNING').toUpperCase();
  const isCritical = severity === 'CRITICAL';
  const status: 'act' | 'watch' | 'resolved' = alert.acknowledged ? 'resolved' : (isCritical ? 'act' : 'watch');
  const trigger = alert.trigger_reason || 'Proactive Telemetry Deviation';

  let hazard: CrewAlert['hazard'] = 'cardiovascular';
  const text = (trigger + ' ' + (alert.voice_spoken_text || '')).toLowerCase();
  if (text.includes('radiation') || text.includes('spe') || text.includes('flare') || text.includes('cme')) hazard = 'radiation';
  else if (text.includes('co2') || text.includes('scrubber') || text.includes('cabin') || text.includes('hepa')) hazard = 'environment';
  else if (text.includes('decompression') || text.includes('hypoxia') || text.includes('pressure') || text.includes('spo2')) hazard = 'decompression';
  else if (text.includes('sleep') || text.includes('circadian') || text.includes('fatigue')) hazard = 'sleep';
  else if (text.includes('toxin') || text.includes('lithium') || text.includes('ammonia')) hazard = 'toxin';

  let evidenceMetrics: AlertEvidence[] = [];
  try {
    if (alert.evidence_json) {
      const parsed = typeof alert.evidence_json === 'string' ? JSON.parse(alert.evidence_json) : alert.evidence_json;
      if (parsed.heart_rate) {
        evidenceMetrics.push({
          source: 'NASA Flight Telemetry',
          id: 'HR-ECG',
          title: `Heart Rate: ${parsed.heart_rate} bpm`,
          why: `Telemetry recorded during sentry trigger evaluation: HR ${parsed.heart_rate} bpm.`,
          url: 'https://ntrs.nasa.gov',
        });
      }
      if (parsed.cabin_co2) {
        evidenceMetrics.push({
          source: 'NASA ECLSS Sentry',
          id: 'ECLSS-CO2',
          title: `Cabin CO₂: ${parsed.cabin_co2} mmHg`,
          why: 'ECLSS air scrubber sensor telemetry exceeds operational guidance thresholds.',
          url: 'https://ntrs.nasa.gov/citations/20160012725',
        });
      }
      if (parsed.spo2) {
        evidenceMetrics.push({
          source: 'Pulse Oximeter Pulse-02',
          id: 'SPO2-01',
          title: `SpO₂: ${parsed.spo2}%`,
          why: 'Continuous peripheral capillary arterial oxygen saturation reading.',
          url: 'https://ntrs.nasa.gov',
        });
      }
    }
  } catch {}

  if (evidenceMetrics.length === 0) {
    evidenceMetrics.push({
      source: 'NASA Spacecraft Sentry',
      id: `SENTRY-${alert.id}`,
      title: trigger,
      why: alert.voice_spoken_text || 'Proactive threshold deviation detected in live aerospace telemetry stream.',
      url: 'https://ntrs.nasa.gov',
    });
  }

  const timeStr = alert.timestamp ? (alert.timestamp.includes('T') ? alert.timestamp.substring(11, 19) : alert.timestamp) : 'LIVE';

  return {
    id,
    crewId,
    metric: hazard === 'environment' ? 'co2' : (hazard === 'decompression' ? 'spo2' : 'hr'),
    title: trigger,
    hazard,
    status,
    peakStatus: isCritical ? 'act' : 'watch',
    openedAt: timeStr,
    explanation: alert.voice_spoken_text || trigger,
    z: alert.confidence ? Number((alert.confidence * 3.4).toFixed(1)) : 2.7,
    series: [74, 76, 82, 92, 106, 114, 118],
    evidence: evidenceMetrics,
    steps: [
      { text: 'Cross-verify biometrics against baseline flight profiles', done: false },
      { text: 'Execute prescribed life-support countermeasure', done: false },
      { text: 'Notify flight surgeon and document resolution log', done: false },
    ],
    timeline: [
      { ts: timeStr, kind: 'opened', label: `Opened as ${severity}: ${trigger.slice(0, 45)}` },
    ],
  };
}

function mapPayloadToCrewAlert(payload: AlertPayload): CrewAlert {
  const id = payload.id || `ALT-WS-${Date.now()}`;
  const rawId = payload.astronaut_id || 'AST-01_COMMANDER';
  const crewId = rawId === 'ALL_CREW' ? 'AST-01_COMMANDER' : rawId;
  const isCritical = payload.severity === 'CRITICAL';
  const status: 'act' | 'watch' | 'resolved' = isCritical ? 'act' : 'watch';
  const title = payload.triage_diagnosis || payload.reason || 'Proactive Telemetry Anomaly Detected';

  let hazard: CrewAlert['hazard'] = 'cardiovascular';
  const text = (title + ' ' + (payload.speech_text || '')).toLowerCase();
  if (text.includes('radiation') || text.includes('spe') || text.includes('flare')) hazard = 'radiation';
  else if (text.includes('co2') || text.includes('scrubber') || text.includes('cabin')) hazard = 'environment';
  else if (text.includes('decompression') || text.includes('pressure') || text.includes('hypoxia')) hazard = 'decompression';
  else if (text.includes('sleep') || text.includes('circadian') || text.includes('fatigue')) hazard = 'sleep';
  else if (text.includes('toxin') || text.includes('lithium')) hazard = 'toxin';

  const timeStr = payload.timestamp ? (payload.timestamp.includes('T') ? payload.timestamp.substring(11, 19) : payload.timestamp) : 'LIVE';

  const evidenceItems: AlertEvidence[] = (payload.evidence_breakdown || []).map((e) => ({
    source: 'NASA Sentry Engine',
    id: e.metric,
    title: e.clinical_finding,
    why: `${e.metric}: ${e.value}`,
    url: 'https://ntrs.nasa.gov',
  }));

  const steps: AlertStep[] = [
    { text: payload.actionable_instruction || 'Inspect telemetry readings and execute stabilization protocols', done: false },
    { text: 'Perform secondary diagnostic assessment', done: false },
  ];

  return {
    id,
    crewId,
    metric: hazard === 'environment' ? 'co2' : (hazard === 'decompression' ? 'spo2' : 'hr'),
    title,
    hazard,
    status,
    peakStatus: isCritical ? 'act' : 'watch',
    openedAt: timeStr,
    explanation: payload.speech_text || title,
    z: payload.confidence ? Number((payload.confidence * 3.5).toFixed(1)) : 2.8,
    series: [72, 78, 86, 98, 110, 116],
    evidence: evidenceItems.length > 0 ? evidenceItems : [
      {
        source: 'NASA Spacecraft Sentry',
        id: payload.id || 'ALT-EV',
        title,
        why: payload.speech_text || title,
        url: 'https://ntrs.nasa.gov',
      },
    ],
    steps,
    timeline: [
      { ts: timeStr, kind: 'opened', label: `Proactive Alert: ${title.slice(0, 42)}` },
    ],
  };
}

// In-memory module singleton with subscriber support
let activeAlertsState: CrewAlert[] = [...INITIAL_CREW_ALERTS];
let resolvedAlertsState: CrewAlert[] = [...INITIAL_RESOLVED_ALERTS];
let isBackendConnected = false;
let isWsConnected = false;
let isInitialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('[AlertStore] listener error:', e);
    }
  });
}

async function fetchBackendAlerts(): Promise<void> {
  try {
    const res = await fetch('/api/alerts?limit=50');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.alerts)) {
      isBackendConnected = true;
      const backendCrewAlerts: CrewAlert[] = data.alerts.map(mapBackendAlertToCrewAlert);

      const existingActiveIds = new Set(activeAlertsState.map((a) => a.id));
      const existingResolvedIds = new Set(resolvedAlertsState.map((a) => a.id));

      const newActives: CrewAlert[] = [];
      const newResolved: CrewAlert[] = [];

      for (const bAlert of backendCrewAlerts) {
        if (bAlert.status === 'resolved') {
          if (!existingResolvedIds.has(bAlert.id)) {
            newResolved.push(bAlert);
          }
        } else {
          if (!existingActiveIds.has(bAlert.id) && !existingResolvedIds.has(bAlert.id)) {
            newActives.push(bAlert);
          }
        }
      }

      if (newActives.length > 0 || newResolved.length > 0) {
        activeAlertsState = [...newActives, ...activeAlertsState];
        resolvedAlertsState = [...newResolved, ...resolvedAlertsState];
      }
      notifyListeners();
    }
  } catch (err) {
    if (isBackendConnected) {
      isBackendConnected = false;
      notifyListeners();
    }
    console.warn('[AlertStore] Backend fetch failed; preserving local fallback alerts:', err);
  }
}

function handleLiveWsAlert(payload: AlertPayload): void {
  try {
    const incoming = mapPayloadToCrewAlert(payload);
    const exists = activeAlertsState.some(
      (a) => a.id === incoming.id || (a.title === incoming.title && a.crewId === incoming.crewId)
    );
    if (!exists) {
      activeAlertsState = [incoming, ...activeAlertsState];
      notifyListeners();
    }
  } catch (err) {
    console.warn('[AlertStore] Failed to process incoming WS alert payload:', err);
  }
}

export function initAlertStore(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Initial REST fetch
  fetchBackendAlerts();

  // 2. Real-time WebSocket subscriptions
  wsService.subscribeAlert(handleLiveWsAlert);
  wsService.subscribeStatus((connected) => {
    isWsConnected = connected;
    notifyListeners();
  });

  // 3. Periodic background poll to keep SQLite proactive sentry alerts in sync
  setInterval(() => {
    fetchBackendAlerts();
  }, 5000);
}

export const alertStore = {
  init(): void {
    initAlertStore();
  },

  getActiveAlerts(): CrewAlert[] {
    return activeAlertsState;
  },

  getResolvedAlerts(): CrewAlert[] {
    return resolvedAlertsState;
  },

  getActiveCount(crewId?: string): number {
    if (crewId && crewId !== 'ALL') {
      return activeAlertsState.filter((a) => a.crewId === crewId && a.status !== 'resolved').length;
    }
    return activeAlertsState.filter((a) => a.status !== 'resolved').length;
  },

  isBackendConnected(): boolean {
    return isBackendConnected;
  },

  isWsConnected(): boolean {
    return isWsConnected;
  },

  fetchBackendAlerts(): Promise<void> {
    return fetchBackendAlerts();
  },

  toggleStep(alertId: string, stepIndex: number): void {
    activeAlertsState = activeAlertsState.map((alert) => {
      if (alert.id !== alertId) return alert;
      const newSteps = [...alert.steps];
      const prevDone = newSteps[stepIndex].done;
      newSteps[stepIndex] = { ...newSteps[stepIndex], done: !prevDone };

      const newTimeline = [...alert.timeline];
      if (!prevDone) {
        newTimeline.push({
          ts: `T+${new Date().toISOString().substring(14, 19)}`,
          kind: 'step',
          label: `Step completed: ${newSteps[stepIndex].text.slice(0, 38)}...`,
        });
      }

      return {
        ...alert,
        steps: newSteps,
        timeline: newTimeline,
      };
    });
    notifyListeners();
  },

  resolveAlert(alertId: string): void {
    const alertToResolve = activeAlertsState.find((a) => a.id === alertId);
    if (!alertToResolve) return;

    const resolvedItem: CrewAlert = {
      ...alertToResolve,
      status: 'resolved',
      resolvedAt: `T+${new Date().toISOString().substring(14, 19)}`,
      timeline: [
        ...alertToResolve.timeline,
        {
          ts: `T+${new Date().toISOString().substring(14, 19)}`,
          kind: 'resolved',
          label: 'Action card executed · Alert resolved and logged',
        },
      ],
    };

    activeAlertsState = activeAlertsState.filter((a) => a.id !== alertId);
    resolvedAlertsState = [resolvedItem, ...resolvedAlertsState];
    notifyListeners();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useAlertStore(crewId?: string) {
  const [, setTick] = useState(0);

  useEffect(() => {
    initAlertStore();
    return alertStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const activeAlerts = alertStore.getActiveAlerts();
  const resolvedAlerts = alertStore.getResolvedAlerts();
  const activeCount = alertStore.getActiveCount(crewId);

  return {
    activeAlerts,
    resolvedAlerts,
    activeCount,
    isBackendConnected: alertStore.isBackendConnected(),
    isWsConnected: alertStore.isWsConnected(),
    refreshAlerts: alertStore.fetchBackendAlerts,
    toggleStep: alertStore.toggleStep,
    resolveAlert: alertStore.resolveAlert,
  };
}

