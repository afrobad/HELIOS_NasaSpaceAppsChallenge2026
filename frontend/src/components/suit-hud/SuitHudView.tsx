import { useEffect, useRef, useState, useCallback } from 'react';
import './SuitHudView.css';
import { VB_ASPECT, VB_H, VB_W, VIEWBOX } from './geometry';
import { GlassUnderLayer, HelmetShellLayer } from './HelmetLayers';
import {
  BatteryPanel,
  BiometricsPanel,
  CompassStrip,
  FrameAccents,
  HolographicBodyWidget,
  HudDefs,
  LifeSupportPanel,
  SideGauge,
  VoiceWaveform,
  WaypointMarker,
} from './HudWidgets';
import { useSuitTelemetry, type SuitTelemetry, type ScrubberState } from './useSuitTelemetry';
import { wsService } from '../../services/websocketService';
import { audioService } from '../../services/audioService';
import type { TelemetryPacket, AlertPayload } from '../../types/telemetry';
import { ScenarioController, ALL_SCENARIOS } from '../ScenarioController';

export interface SuitHudViewProps {
  /** Live values; any field supplied here overrides the simulation. */
  telemetry?: Partial<SuitTelemetry>;
  /** Gently drift values around the reference numbers (default true). */
  simulate?: boolean;
  /** Background plate seen through the visor. */
  landscapeSrc?: string;
}

type Fit = 'slice' | 'meet';

/** Fill the screen when the crop is small; otherwise letterbox into the helmet. */
function computeFit(): Fit {
  const ratio = window.innerWidth / window.innerHeight / VB_ASPECT;
  return ratio > 0.9 && ratio < 1.12 ? 'slice' : 'meet';
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

const PLANET_WAYPOINTS: Record<string, { line1: string; line2: string; distanceKm: number; bearingDeg: number }> = {
  Mars: {
    line1: 'MARS BASE',
    line2: 'JEZERO HABITAT',
    distanceKm: 1.8,
    bearingDeg: 12,
  },
  Moon: {
    line1: 'ARTEMIS BASE',
    line2: 'SHACKLETON OUTPOST',
    distanceKm: 0.6,
    bearingDeg: 44,
  },
  'Space Station': {
    line1: 'HARMONY NODE',
    line2: 'QUEST AIRLOCK 2',
    distanceKm: 0.04,
    bearingDeg: 285,
  },
};

const extractAdviceBody = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^(?:(?:good\s+day|hello|urgent\s+alert|emergency|all\s+stations|all\s+crew\s+stations|all\s+crew)[,\s!:]+)?(?:(?:commander\s+\w+|pilot\s+\w+|doctor\s+\w+|specialist\s+\w+)(?:\s*(?:,|and)\s*(?:commander\s+\w+|pilot\s+\w+|doctor\s+\w+|specialist\s+\w+))*)[,\s!:]+/i, '')
    .trim()
    .toLowerCase();
};

export function formatHudStatusTitle(raw: string): string {
  if (!raw) return 'SYSTEM ANOMALY';
  let clean = raw.trim();
  if (clean.includes(';')) {
    clean = clean.split(';')[0].trim();
  }
  // Strip parentheses with stats e.g. (HR Z=+2.3, HRV Z=-2.0)
  clean = clean.replace(/\s*\([^)]*\)/gi, '').trim();
  // Strip leading numbering e.g. "06 · "
  clean = clean.replace(/^\d+\s*[·•-]\s*/, '').trim();
  // Replace slashes or colons with middle dots
  clean = clean.replace(/\s*[/]{2,}\s*/g, ' · ');
  clean = clean.replace(/:\s*/g, ' · ');
  // Clean joint anomaly or alert prefixes
  clean = clean.replace(/^(?:JOINT ANOMALY|ANOMALY|ALERT|WARNING|CAUTION)\s*[·•-]?\s*/i, '');
  
  if (clean.length > 44) {
    clean = clean.slice(0, 42).replace(/\s+\S*$/, '').trim() + '...';
  }
  return clean.toUpperCase();
}

export function formatHudDirective(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim();
  // Strip repetitive prefixes
  clean = clean.replace(/^(?:action|directive|instruction|recommendation)[\s:/-]+/i, '').trim();
  // Take first sentence
  if (clean.includes('.')) {
    clean = clean.split('.')[0].trim();
  }
  // Replace slashes with middle dots
  clean = clean.replace(/\s*[/]{2,}\s*/g, ' · ');
  if (clean.length > 68) {
    clean = clean.slice(0, 65).replace(/\s+\S*$/, '').trim() + '...';
  }
  return clean.toUpperCase();
}

export interface HudWarningState {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'WARNING';
  directive: string;
  metrics?: string;
  code: string;
  targetCrew?: string;
  timestamp: number;
}

interface CrewIdentity {
  id: string;
  name: string;
  shortName: string;
  callsign: string;
  aliases: string[];
}

export const CREW_IDENTITIES: Record<string, CrewIdentity> = {
  'AST-01_COMMANDER': {
    id: 'AST-01_COMMANDER',
    name: 'Commander Haley',
    shortName: 'Commander',
    callsign: 'C001',
    aliases: ['commander', 'haley', 'cdr', 'c001', 'crew_1', 'ast-01', 'ast-01_commander'],
  },
  'AST-02_PILOT': {
    id: 'AST-02_PILOT',
    name: 'Pilot Chris',
    shortName: 'Pilot',
    callsign: 'C002',
    aliases: ['pilot', 'chris', 'plt', 'c002', 'crew_2', 'ast-02', 'ast-02_pilot'],
  },
  'AST-03_MEDICAL': {
    id: 'AST-03_MEDICAL',
    name: 'Doctor Sian',
    shortName: 'Medical Officer',
    callsign: 'C003',
    aliases: ['doctor', 'sian', 'cmo', 'medical', 'c003', 'crew_3', 'ast-03', 'ast-03_medical'],
  },
  'AST-04_ENGINEER': {
    id: 'AST-04_ENGINEER',
    name: 'Specialist Leo',
    shortName: 'Flight Engineer',
    callsign: 'C004',
    aliases: ['specialist', 'leo', 'eng', 'engineer', 'c004', 'crew_4', 'ast-04', 'ast-04_engineer'],
  },
};

/**
 * Validates whether an incoming Sentry caution & warning alert refers specifically
 * to the selected astronaut wearing this helmet suit HUD.
 * Excludes vessel-wide collective alerts ("ALL_CREW") and alerts intended for other crew members.
 */
export function isAlertReferredToCrew(alert: AlertPayload, targetCrewId: string): boolean {
  if (!alert || !targetCrewId) return false;

  const rawId = (alert.astronaut_id || '').trim();
  const rawName = (alert.astronaut_name || '').toLowerCase();
  const rawReason = (alert.triage_diagnosis || alert.reason || '').toLowerCase();

  // 1. Explicit collective "ALL_CREW" broadcasts are vessel-wide announcements, NOT individual helmet HUD directives
  if (
    rawId === 'ALL_CREW' ||
    rawName.includes('all crew') ||
    rawName.includes('all stations') ||
    rawReason.includes('spacecraft-wide alert')
  ) {
    return false;
  }

  const targetIdentity = CREW_IDENTITIES[targetCrewId] || {
    id: targetCrewId,
    name: '',
    shortName: '',
    callsign: '',
    aliases: [targetCrewId.toLowerCase()],
  };

  // 2. Direct ID or Multi-ID (+ separated) matching
  if (rawId) {
    const constituentIds = rawId.split('+').map((s) => s.trim().toLowerCase());
    const hasIdMatch = constituentIds.some((cid) => {
      if (cid === targetCrewId.toLowerCase()) return true;
      return targetIdentity.aliases.includes(cid);
    });
    if (hasIdMatch) return true;

    // If rawId was provided and contains known crew members, but none matched this astronaut, return false
    const allKnownAliases = Object.values(CREW_IDENTITIES).flatMap((iden) => iden.aliases);
    const isKnownCrewAlert = constituentIds.some((cid) =>
      allKnownAliases.includes(cid) || Object.keys(CREW_IDENTITIES).map((k) => k.toLowerCase()).includes(cid)
    );
    if (isKnownCrewAlert) {
      return false;
    }
  }

  // 3. Fallback: Check if the astronaut's name or alias is mentioned in astronaut_name
  if (rawName) {
    const isNamed = targetIdentity.aliases.some((alias) => rawName.includes(alias));
    if (isNamed) return true;
  }

  return false;
}

/**
 * Maps authentic NASA OSDR sensor telemetry packet to HUD telemetry values.
 * Directly reflects the authentic vitals of the selected crew member.
 */
function packetToSuitTelemetry(
  packet: TelemetryPacket,
  planet: string
): Partial<SuitTelemetry> {
  const hr = Math.round(packet.heart_rate || 62);
  const spo2 = Math.round(packet.spo2 || 98);
  const temp = Number((packet.core_temp || 36.7).toFixed(1));

  // Authentic Scrubber condition derived from real cabin CO2
  let co2Scrubber: ScrubberState = 'NOMINAL';
  const co2 = packet.cabin_co2 || 1.82;
  if (co2 > 3.0 || packet.scenario_phase === 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH') {
    co2Scrubber = 'FAULT';
  } else if (co2 > 2.2) {
    co2Scrubber = 'DEGRADED';
  }

  // Authentic Suit Pressure derived from real packet
  const isDecomp = packet.scenario_phase === 'SCENARIO_2_SLOW_DECOMPRESSION_HYPOXIA' || (spo2 < 90 && spo2 > 0);
  const suitPressurePsi = isDecomp ? 2.8 : 4.3;

  // Authentic O2 Reserve
  const o2Reserve = isDecomp ? 64 : packet.mission_state === 'WORKOUT' ? 82 : 94;

  // Battery status
  const batteryPct = Math.max(54, Math.min(99, 88 - ((packet.tick || 0) % 300) * 0.08));

  // AI Status
  let aiStatus = 'ONLINE';
  if (packet.evaluated_severity === 'CRITICAL') {
    aiStatus = 'CRITICAL ALERT';
  } else if (packet.evaluated_severity === 'WARNING') {
    aiStatus = 'CAUTION';
  } else if (packet.mission_state === 'WORKOUT') {
    aiStatus = 'EVA ACTIVE';
  }

  const waypoint = PLANET_WAYPOINTS[planet] || PLANET_WAYPOINTS.Mars;

  return {
    heartRate: hr,
    spo2,
    temperatureC: temp,
    co2Scrubber,
    suitPressurePsi,
    o2Reserve,
    batteryPct,
    aiStatus,
    waypoint,
  };
}

/**
 * First-person astronaut helmet HUD with live NASA OSDR sensor telemetry.
 *
 * Built as stacked SVG layers with authentic Master Caution & Warning
 * annunciators, on-screen directive banners, and controlled AI voice alerting.
 */
export function SuitHudView({ telemetry, simulate = false, landscapeSrc = '/suit-hud/mars_surface.jpg' }: SuitHudViewProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;
  const [fit, setFit] = useState<Fit>(computeFit);
  const worldLayers = useRef<(HTMLElement | SVGSVGElement | null)[]>([]);

  // Navigation & Crew State
  const [scenario, setScenario] = useState('NOMINAL_CRUISE');
  const [planet, setPlanet] = useState('Mars');
  const [crewId, setCrewId] = useState('AST-01_COMMANDER');

  // Live Telemetry from selected crew
  const [liveTelemetry, setLiveTelemetry] = useState<Partial<SuitTelemetry>>({});

  // Caution & Warning (C&W) Visual and Speech State
  const [activeWarning, setActiveWarning] = useState<HudWarningState | null>(null);
  const [isVoiceTransmitting, setIsVoiceTransmitting] = useState<boolean>(false);
  const [audioEngaged, setAudioEngaged] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Anti-Chatter / Deduplication Refs (talks only when needed)
  const lastSpokenAdviceRef = useRef<string>('');
  const lastSpokenTimeRef = useRef<number>(0);
  const activeSpeechTextRef = useRef<string>('');

  // Sentry WebSocket link status (online / offline)
  useEffect(() => {
    const unsubStatus = wsService.subscribeStatus((connected: boolean) => {
      setIsOnline(connected);
    });
    return () => unsubStatus();
  }, []);

  // When live telemetry is connected, simulate is disabled so real sensor data isn't overwritten with drift
  const data = useSuitTelemetry({ ...telemetry, ...liveTelemetry }, simulate);

  const bgMap: Record<string, string> = {
    Mars: '/suit-hud/mars_surface.jpg',
    Moon: '/suit-hud/moon_surface.jpg',
    'Space Station': '/suit-hud/space_station.jpg',
  };
  const bgVideoMap: Record<string, string | null> = {
    'Space Station': '/space/earth_rotating.mp4',
    Mars: null,
    Moon: null,
  };
  const effectiveLandscape = bgMap[planet] || landscapeSrc;
  const effectiveVideo = bgVideoMap[planet] || null;

  useEffect(() => {
    const prev = document.title;
    document.title = `H.E.L.I.O.S · Suit HUD — ${planet}`;
    return () => {
      document.title = prev;
    };
  }, [planet]);

  useEffect(() => {
    const onResize = () => setFit(computeFit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Audio Context unlock on initial user gesture
  useEffect(() => {
    (window as any).__audioService = audioService;
    audioService.setEngaged(true);
    const unlockAudio = () => {
      audioService.initAudioContext();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
  }, []);

  // Listen to audio transmission state for equalizer activation
  useEffect(() => {
    const unsub = audioService.onStateChange((state) => {
      setIsVoiceTransmitting(Boolean(state.isVoicePlaying || (state.isSpeaking && audioService.getEngaged())));
    });
    return () => unsub();
  }, []);

  const handleToggleAudio = () => {
    const next = !audioEngaged;
    audioService.setEngaged(next);
    setAudioEngaged(next);
    if (!next) {
      setIsVoiceTransmitting(false);
    }
  };

  /**
   * Delivers vocal directive ONLY when needed, with strict deduplication and 8s cooldown.
   * Matches the calm, authoritative bedside sentry demeanor of the main dashboard.
   */
  const speakAlertDirective = useCallback((
    text: string,
    tone: 'klaxon' | 'chime' | 'beep' | 'none',
    severity: 'CRITICAL' | 'WARNING'
  ) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    // Prevent duplicate triggers of identical speech
    if (cleanText === activeSpeechTextRef.current) return;

    // Semantic deduplication: if core clinical advice was spoken recently (<8s), do not chatter
    const incomingAdvice = extractAdviceBody(cleanText);
    const timeSinceLastSpoken = Date.now() - lastSpokenTimeRef.current;
    if (incomingAdvice && incomingAdvice === lastSpokenAdviceRef.current && timeSinceLastSpoken < 8000) {
      return;
    }

    lastSpokenAdviceRef.current = incomingAdvice;
    lastSpokenTimeRef.current = Date.now();
    activeSpeechTextRef.current = cleanText;

    // Immediately preempt any lower-priority speech
    audioService.stopSpeaking();

    if (!audioService.getEngaged()) {
      audioService.setEngaged(true);
    }

    audioService.queueSpeech({
      text: cleanText,
      tone,
      config: {
        severity,
        rate: severity === 'CRITICAL' ? 1.05 : 1.0,
      },
      callbacks: {
        onStart: () => {
          setIsVoiceTransmitting(true);
        },
        onEnd: () => {
          activeSpeechTextRef.current = '';
          setIsVoiceTransmitting(false);
        },
      },
    });
  }, []);

  // 1. Initial REST Telemetry Snapshot for Selected Crew (Zero Scenario Pollution)
  useEffect(() => {
    let isSubscribed = true;

    fetch('/api/telemetry/latest-all')
      .then((res) => res.json())
      .then((payload) => {
        if (!isSubscribed) return;
        if (payload?.telemetry && payload.telemetry[crewId]) {
          const pkt: TelemetryPacket = payload.telemetry[crewId];
          setLiveTelemetry(packetToSuitTelemetry(pkt, planet));
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [crewId, planet]);

  // 2. Continuous 10 Hz WebSocket Telemetry Stream (strictly filtered for selected crew)
  useEffect(() => {
    wsService.connect();

    const unsub = wsService.subscribeTelemetry((packet: TelemetryPacket) => {
      if (packet.astronaut_id === crewId) {
        setLiveTelemetry(packetToSuitTelemetry(packet, planet));

        // When telemetry confirms nominal cruise, automatically clear active warnings
        if (packet.scenario_phase === 'NOMINAL_CRUISE' && packet.evaluated_severity === 'NOMINAL') {
          setActiveWarning(null);
          setIsVoiceTransmitting(false);
        }
      }
    });

    return () => {
      unsub();
    };
  }, [crewId, planet]);

  // 3. WebSocket Alert Subscription (listens strictly to directives referred to the selected crew)
  useEffect(() => {
    const unsubAlert = wsService.subscribeAlert((alert: AlertPayload) => {
      if (!alert) return;

      const isReferred = isAlertReferredToCrew(alert, crewId);

      if (alert.severity === 'NOMINAL') {
        // Systems nominal - if this refers to the active astronaut or whole ship, clear warnings
        if (isReferred || alert.astronaut_id === 'ALL_CREW' || !alert.astronaut_id) {
          audioService.stopSpeaking();
          setActiveWarning(null);
          setIsVoiceTransmitting(false);
        }
        return;
      }

      // STRICT FILTER: Discard any alert that does NOT refer specifically to this astronaut
      if (!isReferred) {
        return;
      }

      if (alert.severity === 'CRITICAL' || alert.severity === 'WARNING') {
        const alertCode = alert.id ? `CW-${alert.id.slice(0, 6).toUpperCase()}` : 'CW-EVA-901';
        const title = alert.triage_diagnosis || alert.reason || 'SENTRY FLIGHT ANOMALY';
        const directive = alert.actionable_instruction || alert.speech_text || alert.reason;

        setActiveWarning({
          id: alert.id || String(Date.now()),
          title,
          severity: alert.severity,
          directive,
          code: alertCode,
          targetCrew: alert.astronaut_name || alert.astronaut_id,
          timestamp: Date.now(),
        });

        // Deliver speech directive only when needed
        const speechText = alert.speech_text || directive;
        const tone = alert.tone || (alert.severity === 'CRITICAL' ? 'klaxon' : 'chime');
        speakAlertDirective(speechText, tone, alert.severity);
      }
    });

    return () => {
      unsubAlert();
    };
  }, [crewId, speakAlertDirective]);

  // 4. Crew Switch Reset: Immediately clear old warnings and silence voice when switching astronauts
  useEffect(() => {
    audioService.stopSpeaking();
    setIsVoiceTransmitting(false);
    activeSpeechTextRef.current = '';
    lastSpokenAdviceRef.current = '';
    setActiveWarning(null);
  }, [crewId]);

  // 5. Handle Scenario Trigger Dispatch
  const handleScenarioTriggered = (
    scenKey: string,
    telData?: Record<string, any>,
    targetCrewId?: string | null
  ) => {
    setScenario(scenKey);

    if (telData && telData[crewId]) {
      setLiveTelemetry(packetToSuitTelemetry(telData[crewId], planet));
    }

    if (scenKey === 'NOMINAL_CRUISE') {
      // Returning to nominal - stop speaking, silence alerts, clean HUD
      audioService.stopSpeaking();
      setActiveWarning(null);
      setIsVoiceTransmitting(false);
      return;
    }

    // If an individual scenario is targeted at a DIFFERENT astronaut,
    // do not display or transmit directives onto this astronaut's visor HUD!
    if (targetCrewId && targetCrewId !== crewId) {
      return;
    }

    // Non-nominal scenario triggered for the active astronaut (or universal spacecraft event)!
    const scenMeta = ALL_SCENARIOS.find((s) => s.key === scenKey);
    if (scenMeta) {
      const sev: 'CRITICAL' | 'WARNING' = scenMeta.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
      const directive = scenMeta.description || scenMeta.physiologicalShift || scenMeta.label;
      const alertCode = `ORION-${scenMeta.key.slice(0, 10).toUpperCase()}`;

      setActiveWarning({
        id: scenKey,
        title: scenMeta.label.replace(/^\d+\s*[·•-]\s*/, ''),
        severity: sev,
        directive,
        metrics: scenMeta.badge,
        code: alertCode,
        targetCrew: targetCrewId || crewId,
        timestamp: Date.now(),
      });

      // AI speaks directive ONCE with appropriate alarm tone
      const tone = sev === 'CRITICAL' ? 'klaxon' : 'chime';
      speakAlertDirective(directive, tone, sev);
    }
  };

  // Keyboard shortcut: [Escape] silences active HUD warning voice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        audioService.stopSpeaking();
        setIsVoiceTransmitting(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Head-movement parallax: the world drifts opposite to the pointer.
  useEffect(() => {
    if (!animate) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    let running = false;

    // Cache scale to eliminate layout reflow queries on every rAF tick
    let scale = fit === 'slice'
      ? Math.max(window.innerWidth / VB_W, window.innerHeight / VB_H)
      : Math.min(window.innerWidth / VB_W, window.innerHeight / VB_H);

    const onResize = () => {
      scale = fit === 'slice'
        ? Math.max(window.innerWidth / VB_W, window.innerHeight / VB_H)
        : Math.min(window.innerWidth / VB_W, window.innerHeight / VB_H);
    };
    window.addEventListener('resize', onResize, { passive: true });

    const step = () => {
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      const tf = `translate3d(${(cur.x * scale).toFixed(2)}px, ${(cur.y * scale).toFixed(2)}px, 0)`;
      worldLayers.current.forEach((el) => {
        if (el) el.style.transform = tf;
      });
      if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.01) {
        raf = requestAnimationFrame(step);
      } else {
        running = false;
      }
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    };
    const onMove = (e: PointerEvent) => {
      target.x = -((e.clientX / window.innerWidth) * 2 - 1) * 8;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1) * 5;
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [animate, fit]);

  const par = `xMidYMid ${fit}`;

  return (
    <main className="suit-hud" id="suit-hud-root">
      <h1 className="suit-hud__sr">Astronaut suit heads-up display — {planet} EVA</h1>

      {/* 1 · World plate (oversized so parallax never reveals an edge, hardware-accelerated FPP video/image) */}
      <div
        ref={(el) => {
          worldLayers.current[0] = el;
        }}
        className="suit-hud__world-plate"
        aria-hidden="true"
      >
        {effectiveVideo ? (
          <video
            key={effectiveVideo}
            className="suit-hud__fpp-video"
            autoPlay
            loop
            muted
            playsInline
            poster={effectiveLandscape}
          >
            <source src={effectiveVideo} type="video/mp4" />
          </video>
        ) : (
          <img
            key={effectiveLandscape}
            src={effectiveLandscape}
            alt=""
            className="suit-hud__static-bg"
            loading="eager"
          />
        )}
      </div>

      {/* 2 · Glass under-effects (atmosphere & rim refraction adapted to planet and scenario) */}
      <GlassUnderLayer
        fit={fit}
        planet={planet}
        scenario={scenario}
        severity={activeWarning?.severity || 'NOMINAL'}
      />

      {/* 3 · Helmet-locked HUD */}
      <svg
        className={`suit-hud__layer suit-hud__hud ${animate ? '' : 'suit-hud--static'}`}
        viewBox={VIEWBOX}
        preserveAspectRatio={par}
        role="img"
        aria-label={`Suit HUD. Heart rate ${data.heartRate} BPM, SpO2 ${data.spo2}%, O2 reserve ${data.o2Reserve}%, CO2 scrubber ${data.co2Scrubber}, suit pressure ${data.suitPressurePsi} PSI, temperature ${data.temperatureC}°C, battery ${data.batteryPct}%.`}
      >
        <HudDefs />
        <FrameAccents />
        <SideGauge side="left" />
        <SideGauge side="right" />
        <VoiceWaveform
          animate={animate}
          severity={
            activeWarning
              ? activeWarning.severity
              : data.aiStatus === 'CRITICAL ALERT'
              ? 'CRITICAL'
              : data.aiStatus === 'CAUTION'
              ? 'WARNING'
              : 'NOMINAL'
          }
          statusLabel={
            activeWarning
              ? (activeWarning.severity === 'CRITICAL' ? 'CRITICAL' : 'CAUTION')
              : data.aiStatus === 'CRITICAL ALERT'
              ? 'CRITICAL'
              : data.aiStatus === 'CAUTION'
              ? 'CAUTION'
              : isOnline
              ? 'ONLINE'
              : 'OFFLINE'
          }
          detailText={
            activeWarning
              ? formatHudStatusTitle(activeWarning.title)
              : data.aiStatus === 'CRITICAL ALERT'
              ? 'VITALS EXCURSION'
              : data.aiStatus === 'CAUTION'
              ? 'ELEVATED VITALS'
              : isOnline
              ? 'ALL NOMINAL'
              : 'LINK SEARCH'
          }
          directive={
            activeWarning?.directive
              ? formatHudDirective(activeWarning.directive)
              : undefined
          }
          isOnline={isOnline}
          isTransmitting={isVoiceTransmitting}
        />
        <BiometricsPanel data={data} animate={animate} />
        <HolographicBodyWidget heartRate={data.heartRate} temperatureC={data.temperatureC} />
        <LifeSupportPanel data={data} />
        <BatteryPanel pct={data.batteryPct} />
        <CompassStrip animate={animate} />
      </svg>

      {/* 4 · World-locked waypoint (center navigator) */}
      <svg
        ref={(el) => {
          worldLayers.current[1] = el;
        }}
        className="suit-hud__layer suit-hud__layer--world suit-hud__hud"
        viewBox={VIEWBOX}
        preserveAspectRatio={par}
        aria-label={`Waypoint ${data.waypoint.line1} ${data.waypoint.line2}, ${data.waypoint.distanceKm} km, bearing ${data.waypoint.bearingDeg} degrees`}
        role="img"
      >
        <WaypointMarker data={data} planet={planet} />
      </svg>

      {/* 5 · Glass glare + helmet shell (specular reflections adapted to planet) */}
      <HelmetShellLayer fit={fit} planet={planet} />

      {/* Floating HUD controls header bar (fades into background, active on hover) */}
      <header className="suit-hud__header" aria-label="HUD Header Controls">
        <div className="suit-hud__header-left">
          <select
            className="suit-hud__select"
            value={crewId}
            onChange={(e) => setCrewId(e.target.value)}
            aria-label="Crew Switch"
          >
            <option value="AST-01_COMMANDER">CDR Haley (Commander)</option>
            <option value="AST-02_PILOT">PLT Chris (Pilot)</option>
            <option value="AST-03_MEDICAL">CMO Dr. Sian (Medical)</option>
            <option value="AST-04_ENGINEER">ENG Leo (Systems)</option>
          </select>

          <select
            className="suit-hud__select"
            value={planet}
            onChange={(e) => setPlanet(e.target.value)}
            aria-label="Planet Selection"
          >
            <option value="Mars">Mars Surface</option>
            <option value="Moon">Lunar Surface</option>
            <option value="Space Station">Space Station (ISS)</option>
          </select>
        </div>

        <div className="suit-hud__header-right">
          <button
            type="button"
            className="suit-hud__btn"
            onClick={handleToggleAudio}
            title={audioEngaged ? 'Mute AI Voice Directives' : 'Enable AI Voice Directives'}
          >
            <span>{audioEngaged ? '🔊 AI VOICE: ON' : '🔇 AI VOICE: OFF'}</span>
          </button>
          <a href="/" className="suit-hud__btn" title="Return to HELIOS Dashboard">
            <span className="suit-hud__btn-icon">‹</span>
            <span>MCC DASHBOARD</span>
          </a>
          <button
            type="button"
            className="suit-hud__btn"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            title="Toggle Fullscreen"
          >
            <span>⛶ FULLSCREEN</span>
          </button>
        </div>
      </header>

      {/* Floating Main Scenario Engine (Minimal Tactical Design) */}
      <ScenarioController
        currentScenario={scenario}
        marsDelay={false}
        onToggleMarsDelay={() => {}}
        selectedCrewId={crewId}
        onSelectCrewId={(newCrewId) => setCrewId(newCrewId)}
        onScenarioTriggered={handleScenarioTriggered}
      />
    </main>
  );
}

export default SuitHudView;
