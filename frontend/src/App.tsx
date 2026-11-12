import { useEffect, useState, useRef, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { ScenarioController } from './components/ScenarioController';
import { HealthTelemetryView } from './components/HealthTelemetryView';
import { MissionControlView } from './components/MissionControlView';
import { HolographicBodyScanner } from './components/HolographicBodyScanner';
import { SpaceBackground } from './components/SpaceBackground';
import { MainIndexDeck } from './components/MainIndexDeck';
import { SuitHudView } from './components/suit-hud/SuitHudView';
import { Cabin3DView } from './components/cabin3d/Cabin3DView';
import { DragonDockingIntro } from './components/docking/DragonDockingIntro';
import { AstronautSelfAssessment } from './components/AstronautSelfAssessment';
import { MissionRoutineAdherence } from './components/MissionRoutineAdherence';
import { ProjectTourOverlay } from './components/ProjectTourOverlay';
import { wsService } from './services/websocketService';
import { audioService } from './services/audioService';
import {
  parseCurrentRoute,
  navigateTo,
  getSlugFromAstronautId,
} from './services/routerService';
import type { TelemetryPacket, AlertPayload, DistancePreset } from './types/telemetry';
import { DISTANCES, fmtTime } from './types/telemetry';
import {
  DEFAULT_NOMINAL_TELEMETRY,
  generateScenarioTelemetry,
  generateScenarioAlert,
  tickOfflineTelemetry,
} from './utils/scenarioSimulator';

// Helper to broadcast live telemetry, scenarios, and alerts across tabs and frames
function broadcastCabinSync(telemetryMap: any, latestAlert: any, currentScenario: string) {
  // Embedded sub-frames (such as 3D cabin wall monitors) must NEVER broadcast state to localStorage or BroadcastChannel
  if (typeof window !== 'undefined' && window.self !== window.top) {
    return;
  }

  const isNominal = !currentScenario || currentScenario === 'NOMINAL_CRUISE';
  const payload = {
    type: isNominal ? 'NOMINAL_STATE' : 'HELIOS_TELEMETRY_SYNC',
    telemetryMap,
    latestAlert: isNominal ? null : latestAlert,
    scenario: isNominal ? 'NOMINAL_CRUISE' : currentScenario,
    timestamp: Date.now(),
  };

  // 1. Instant cross-tab sync via localStorage (fires in all open tabs/windows of localhost:3000)
  try {
    localStorage.setItem('helios_scenario', isNominal ? 'NOMINAL_CRUISE' : currentScenario);
    localStorage.setItem('helios_live_sync', JSON.stringify(payload));
  } catch {
    // Storage quota or private browsing
  }

  // 2. BroadcastChannel multi-context broadcast
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('helios-telemetry');
      bc.postMessage(payload);
      setTimeout(() => {
        try { bc.close(); } catch {}
      }, 500);
    }
  } catch {
    // BroadcastChannel unsupported
  }

  // 3. Post to parent window if inside an iframe (like wall monitor or modal terminal)
  try {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
  } catch {}
}

export function App() {
  // Parse initial route: '/' -> HUD; '/telemetry/:name' -> Health Telemetry; '/mcc' -> Earth MCC; '/mcc/telemetry/:name' -> Earth MCC Telemetry; '/scanner' -> 3D Hologram
  const initialRoute = parseCurrentRoute();
  const [activeView, setActiveView] = useState<'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER' | 'MCC_TELEMETRY' | 'SUIT_HUD' | 'CABIN_3D' | 'DRAGON_DOCKING' | 'SELF_ASSESSMENT' | 'MISSION_ROUTINE'>(initialRoute.view);
  const [activeTriageAstronautId, setActiveTriageAstronautId] = useState<string | null>(
    initialRoute.view === 'HEALTH_TELEMETRY' ? initialRoute.astronautId : null
  );
  const [activeMccAstronautId, setActiveMccAstronautId] = useState<string | null>(
    initialRoute.view === 'MCC_TELEMETRY' ? initialRoute.astronautId : null
  );
  const [scannerAstronautId, setScannerAstronautId] = useState<string>('AST-02_PILOT');

  const [connected, setConnected] = useState<boolean>(false);
  const connectedRef = useRef<boolean>(false);
  const [marsDelay, setMarsDelay] = useState<boolean>(false);
  const [orbitalPosition, setOrbitalPosition] = useState<DistancePreset>('LEO');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [targetAstronautId, setTargetAstronautId] = useState<string | null>('AST-01_COMMANDER');
  const targetAstronautIdRef = useRef<string | null>('AST-01_COMMANDER');
  const [isTourActive, setIsTourActive] = useState<boolean>(false);

  useEffect(() => {
    audioService.setTourMode(isTourActive);
  }, [isTourActive]);

  // Embed mode detection: inside an iframe with ?embed=1 (hides browser chrome for wall monitors)
  const isEmbedMode = typeof window !== 'undefined' && (() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('embed') === '1' || sp.get('cabin') === '1') return true;
      if (window.self !== window.top) return true;
      return false;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (isEmbedMode) {
      document.body.classList.add('embed-mode');
      document.documentElement.style.overflow = 'hidden';
      audioService.setEngaged(false);
      audioService.stopSpeaking();
      audioService.stopKlaxon();
    }
    return () => {
      document.body.classList.remove('embed-mode');
      document.documentElement.style.overflow = '';
      if (!isEmbedMode) {
        audioService.setEngaged(true);
      }
    };
  }, [isEmbedMode]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  // ─── 1. SPACECRAFT ONBOARD TELEMETRY STATE (INSTANT, LOCAL 10 HZ, ZERO DELAY) ───
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryPacket>>(() => {
    try {
      const saved = localStorage.getItem('helios_live_sync');
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.telemetryMap && Object.keys(p.telemetryMap).length > 0) {
          return p.telemetryMap;
        }
      }
      const savedScenario = localStorage.getItem('helios_scenario');
      if (savedScenario && savedScenario !== 'NOMINAL_CRUISE') {
        return generateScenarioTelemetry(savedScenario, 'AST-01_COMMANDER');
      }
    } catch {}
    return JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY));
  });
  const [latestAlert, setLatestAlert] = useState<AlertPayload | null>(() => {
    try {
      const saved = localStorage.getItem('helios_live_sync');
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.latestAlert && p.scenario && p.scenario !== 'NOMINAL_CRUISE') return p.latestAlert;
      }
    } catch {}
    return null;
  });
  const [currentScenario, setCurrentScenario] = useState<string>(() => {
    try {
      const savedScenario = localStorage.getItem('helios_scenario');
      if (savedScenario) return savedScenario;
      const saved = localStorage.getItem('helios_live_sync');
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.scenario) return p.scenario;
      }
    } catch {}
    return 'NOMINAL_CRUISE';
  });
  const [scannerTheme, setScannerTheme] = useState<'CYAN' | 'THERMAL' | 'AMBER'>('CYAN');
  const [showEclssBar, setShowEclssBar] = useState<boolean>(true);
  const bufferedPacketsRef = useRef<Record<string, TelemetryPacket>>(
    (() => {
      try {
        const saved = localStorage.getItem('helios_live_sync');
        if (saved) {
          const p = JSON.parse(saved);
          if (p?.telemetryMap && Object.keys(p.telemetryMap).length > 0) {
            return p.telemetryMap;
          }
        }
        const savedScenario = localStorage.getItem('helios_scenario');
        if (savedScenario && savedScenario !== 'NOMINAL_CRUISE') {
          return generateScenarioTelemetry(savedScenario, 'AST-01_COMMANDER');
        }
      } catch {}
      return JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY));
    })()
  );

  // ─── 2. EARTH MISSION CONTROL TELEMETRY STATE (SUBJECT TO LIGHT PROPAGATION DELAY) ───
  const [mccTelemetryMap, setMccTelemetryMap] = useState<Record<string, TelemetryPacket>>(
    () => JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY))
  );
  const [mccAlert, setMccAlert] = useState<AlertPayload | null>(null);
  const [mccScenario, setMccScenario] = useState<string>('NOMINAL_CRUISE');
  const bufferedMccPacketsRef = useRef<Record<string, TelemetryPacket>>(
    JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY))
  );

  // Deep-Space In-Transit Signal Tracking for Earth Ground Station
  const [inTransitSignal, setInTransitSignal] = useState<{
    scenarioKey: string;
    telemetry?: Record<string, any>;
    originPosition: DistancePreset;
    delaySec: number;
    remainingSec: number;
    startTime: number;
  } | null>(null);

  const inTransitSignalRef = useRef<typeof inTransitSignal>(null);
  const inTransitPacketsRef = useRef<Record<string, TelemetryPacket>>({});
  const inTransitAlertRef = useRef<AlertPayload | null>(null);
  const mccScenarioRef = useRef<string>(mccScenario);
  const orbitalPositionRef = useRef<DistancePreset>(orbitalPosition);
  const marsDelayRef = useRef<boolean>(marsDelay);
  const mccBaselineSnapshotRef = useRef<Record<string, TelemetryPacket>>(
    JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY))
  );

  useEffect(() => {
    inTransitSignalRef.current = inTransitSignal;
  }, [inTransitSignal]);

  useEffect(() => {
    mccScenarioRef.current = mccScenario;
  }, [mccScenario]);

  useEffect(() => {
    orbitalPositionRef.current = orbitalPosition;
  }, [orbitalPosition]);

  useEffect(() => {
    marsDelayRef.current = marsDelay;
  }, [marsDelay]);

  // Synchronize browser history / URL with application view
  useEffect(() => {
    const handlePopState = () => {
      const route = parseCurrentRoute();
      setActiveView(route.view);
      if (route.view === 'HEALTH_TELEMETRY') {
        setActiveTriageAstronautId(route.astronautId);
        setActiveMccAstronautId(null);
      } else if (route.view === 'MCC_TELEMETRY') {
        setActiveMccAstronautId(route.astronautId);
        setActiveTriageAstronautId(null);
      } else if (route.view === 'SCANNER') {
        setScannerAstronautId(route.astronautId || 'AST-02_PILOT');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
      } else if (route.view === 'SUIT_HUD') {
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
      } else {
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    // 0. Seed initial telemetry data immediately so metrics are never empty on load
    fetch('/api/telemetry/latest-all')
      .then((res) => res.json())
      .then((data) => {
        if (data.telemetry) {
          // If a non-nominal scenario is already active in this session, preserve its biometrics
          const activeSavedScenario = localStorage.getItem('helios_scenario');
          if (activeSavedScenario && activeSavedScenario !== 'NOMINAL_CRUISE') {
            return;
          }
          const onboardData = JSON.parse(JSON.stringify(data.telemetry));
          const mccData = JSON.parse(JSON.stringify(data.telemetry));
          bufferedPacketsRef.current = onboardData;
          bufferedMccPacketsRef.current = mccData;
          mccBaselineSnapshotRef.current = JSON.parse(JSON.stringify(data.telemetry));
          setTelemetryMap(onboardData);
          setMccTelemetryMap(mccData);
          const firstPacket = Object.values(data.telemetry)[0] as TelemetryPacket | undefined;
          if (firstPacket && firstPacket.scenario_phase) {
            setCurrentScenario(firstPacket.scenario_phase);
            setMccScenario(firstPacket.scenario_phase);
            mccScenarioRef.current = firstPacket.scenario_phase;
          }
        }
      })
      .catch(() => {
        // Fallback handled by live WebSocket
      });

    // 1. Connect WebSocket
    wsService.connect();

    // 2. Subscribe to status
    const unsubStatus = wsService.subscribeStatus((isConnected) => {
      setConnected(isConnected);
    });

    // 3. Subscribe to 10 Hz Telemetry
    const unsubTelemetry = wsService.subscribeTelemetry((packet: TelemetryPacket) => {
      const activeStored = localStorage.getItem('helios_scenario') || currentScenario;
      const isScenarioActive = activeStored && activeStored !== 'NOMINAL_CRUISE';

      let effectivePacket = packet;
      if (isScenarioActive) {
        // If incoming packet hasn't updated its phase or values yet, shape it to the active scenario:
        if (!packet.scenario_phase || packet.scenario_phase === 'NOMINAL_CRUISE') {
          const shaped = generateScenarioTelemetry(activeStored, targetAstronautIdRef.current);
          if (shaped[packet.astronaut_id]) {
            effectivePacket = { ...packet, ...shaped[packet.astronaut_id] };
          }
        }
      } else {
        // Active scenario is NOMINAL_CRUISE: sanitize any lingering or out-of-order emergency packet
        if (effectivePacket.scenario_phase && effectivePacket.scenario_phase !== 'NOMINAL_CRUISE') {
          const nom = DEFAULT_NOMINAL_TELEMETRY[effectivePacket.astronaut_id];
          if (nom) {
            effectivePacket = {
              ...effectivePacket,
              ...nom,
              timestamp: effectivePacket.timestamp || new Date().toISOString(),
              scenario_phase: 'NOMINAL_CRUISE',
              evaluated_severity: 'NOMINAL',
              alert_severity: 'NOMINAL',
            };
          }
        }
      }

      // Spacecraft onboard sensors are ALWAYS instant:
      bufferedPacketsRef.current[effectivePacket.astronaut_id] = effectivePacket;

      // Maintain scenario phase consistency between user selection and live telemetry
      if (isScenarioActive) {
        if (currentScenario !== activeStored) {
          setCurrentScenario(activeStored);
        }
      } else {
        if (currentScenario !== 'NOMINAL_CRUISE') {
          setCurrentScenario('NOMINAL_CRUISE');
        }
      }

      // Deep-space delay check for Earth MCC:
      const delaySec = DISTANCES[orbitalPositionRef.current]?.delaySec ?? 0;
      const isDeepSpaceDelayed = delaySec > 0.05 || marsDelayRef.current;

      if (isDeepSpaceDelayed) {
        // If a scenario transmission is currently in flight OR if incoming packet is from a newer scenario:
        const isPacketInTransit =
          inTransitSignalRef.current !== null ||
          (Boolean(packet.scenario_phase) && packet.scenario_phase !== mccScenarioRef.current);

        if (isPacketInTransit) {
          // Quarantine new scenario packets into in-transit buffer
          inTransitPacketsRef.current[packet.astronaut_id] = packet;

          // Crucial: Earth MCC MUST NOT receive this packet!
          // Maintain the clean pre-scenario baseline packet for Earth MCC:
          if (mccBaselineSnapshotRef.current[packet.astronaut_id]) {
            bufferedMccPacketsRef.current[packet.astronaut_id] = {
              ...mccBaselineSnapshotRef.current[packet.astronaut_id],
            };
          }
          return;
        }
      }

      // Earth MCC receives packets directly when in LEO or matching the active Earth MCC phase:
      bufferedMccPacketsRef.current[packet.astronaut_id] = packet;
      if (packet.scenario_phase && !isDeepSpaceDelayed) {
        setMccScenario((prev) => (prev === packet.scenario_phase ? prev : packet.scenario_phase));
        mccScenarioRef.current = packet.scenario_phase;
      }
    });

    // 10 Hz state ticker (100ms) to update React components smoothly with real sensor data
    let offlineTick = 0;
    const telemetryInterval = setInterval(() => {
      offlineTick++;
      // If offline (WebSocket disconnected), apply subtle physiological micro-ticking
      if (!connectedRef.current && Object.keys(bufferedPacketsRef.current).length > 0) {
        bufferedPacketsRef.current = tickOfflineTelemetry(bufferedPacketsRef.current, offlineTick);
      }
      if (Object.keys(bufferedPacketsRef.current).length > 0) {
        setTelemetryMap({ ...bufferedPacketsRef.current });
      }
      if (Object.keys(bufferedMccPacketsRef.current).length > 0) {
        setMccTelemetryMap({ ...bufferedMccPacketsRef.current });
      }
    }, 100);

    // 4. Subscribe to Proactive AI Surgeon Alerts
    const unsubAlert = wsService.subscribeAlert((alert: AlertPayload) => {
      const activeStored = localStorage.getItem('helios_scenario');
      if (activeStored === 'NOMINAL_CRUISE' && alert.severity !== 'NOMINAL') {
        // Discard stale in-flight alerts from an old scenario
        return;
      }

      // Spacecraft onboard alert is always instant:
      setLatestAlert(alert);

      // Deep-space delay check for Earth MCC:
      const delaySec = DISTANCES[orbitalPositionRef.current]?.delaySec ?? 0;
      const isDeepSpaceDelayed = delaySec > 0.05 || marsDelayRef.current;

      if (isDeepSpaceDelayed && (inTransitSignalRef.current !== null || alert.severity !== 'NOMINAL')) {
        inTransitAlertRef.current = alert;
      } else {
        setMccAlert(alert);
      }
    });

    return () => {
      clearInterval(telemetryInterval);
      unsubStatus();
      unsubTelemetry();
      unsubAlert();
      wsService.disconnect();
    };
  }, []);

  const handleOrbitalPositionChange = useCallback((pos: DistancePreset) => {
    setOrbitalPosition(pos);
    orbitalPositionRef.current = pos;
    const isDelayed = pos === 'MARS_MIN' || pos === 'MARS_MAX';
    setMarsDelay(isDelayed);
    marsDelayRef.current = isDelayed;
    fetch(`/api/mars-delay?enabled=${isDelayed}`, { method: 'POST' }).catch(() => {});

    // If switched to non-delayed position (e.g. LEO), immediately warp in-transit signal to Earth MCC:
    if (!isDelayed && inTransitSignalRef.current) {
      applyMccTelemetryUpdate(inTransitSignalRef.current.scenarioKey, inTransitSignalRef.current.telemetry);
    }
  }, []);

  const handleToggleMarsDelay = async (enabled: boolean) => {
    setMarsDelay(enabled);
    marsDelayRef.current = enabled;
    const newPos = enabled ? 'MARS_MAX' : 'LEO';
    setOrbitalPosition(newPos);
    orbitalPositionRef.current = newPos;
    try {
      await fetch(`/api/mars-delay?enabled=${enabled}`, { method: 'POST' });
    } catch {
      // Ignore
    }
    if (!enabled && inTransitSignalRef.current) {
      applyMccTelemetryUpdate(inTransitSignalRef.current.scenarioKey, inTransitSignalRef.current.telemetry);
    }
  };

  // Deliver delayed signal to Earth MCC Ground Station
  const applyMccTelemetryUpdate = useCallback((scenarioKey: string, telemetry?: Record<string, any>) => {
    setMccScenario(scenarioKey);
    mccScenarioRef.current = scenarioKey;

    if (telemetry && Object.keys(telemetry).length > 0) {
      bufferedMccPacketsRef.current = { ...bufferedMccPacketsRef.current, ...JSON.parse(JSON.stringify(telemetry)) };
    }
    if (Object.keys(inTransitPacketsRef.current).length > 0) {
      bufferedMccPacketsRef.current = { ...bufferedMccPacketsRef.current, ...JSON.parse(JSON.stringify(inTransitPacketsRef.current)) };
      inTransitPacketsRef.current = {};
    }
    mccBaselineSnapshotRef.current = JSON.parse(JSON.stringify(bufferedMccPacketsRef.current));
    setMccTelemetryMap({ ...bufferedMccPacketsRef.current });

    if (inTransitAlertRef.current) {
      setMccAlert(inTransitAlertRef.current);
      inTransitAlertRef.current = null;
    }
    inTransitSignalRef.current = null;
    setInTransitSignal(null);
  }, []);

  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  // Voice synthesis coordinator for AI Surgeon across all views without HeaderBar (SUIT_HUD and CABIN_3D)
  const lastSpokenAlertRef = useRef<string>('');

  const playAiSurgeonAlert = useCallback((alert: AlertPayload | null) => {
    if (isTourActive || audioService.getTourMode()) return;
    if (!alert || !alert.speech_text || alert.severity === 'NOMINAL') {
      audioService.stopSpeaking();
      lastSpokenAlertRef.current = '';
      return;
    }
    const cleanText = alert.speech_text.trim();
    if (!cleanText) return;

    const alertKey = `${alert.id || alert.speech_text}_${cleanText}`;
    if (alertKey === lastSpokenAlertRef.current) return;
    lastSpokenAlertRef.current = alertKey;

    audioService.initAudioContext();
    audioService.setEngaged(true);
    const tone = alert.tone || (alert.severity === 'CRITICAL' ? 'klaxon' : 'chime');
    audioService.queueSpeech({
      text: cleanText,
      tone,
      config: {
        ...alert.audio_config,
        severity: alert.severity,
      },
      callbacks: {
        onStart: () => {},
        onEnd: () => {},
      },
    });
  }, [isTourActive]);

  // When activeView is SUIT_HUD or CABIN_3D and latestAlert changes, speak AI Surgeon directive
  useEffect(() => {
    if (activeView !== 'SUIT_HUD' && activeView !== 'CABIN_3D') {
      lastSpokenAlertRef.current = '';
      return;
    }
    if (isTourActive) return;
    playAiSurgeonAlert(latestAlert);
  }, [latestAlert, activeView, isTourActive, playAiSurgeonAlert]);

  // Scenario Triggered: Spacecraft onboard responds INSTANTLY; Earth MCC enters in-transit delay
  const handleScenarioTriggered = useCallback(
    (scenarioKey: string, telemetry?: Record<string, any>, targetCrewId?: string | null) => {
      // 1. Spacecraft Onboard: 100% instant update with zero latency
      try {
        localStorage.setItem('helios_scenario', scenarioKey);
      } catch {}
      setCurrentScenario(scenarioKey);
      const effectiveTarget = targetCrewId || targetAstronautIdRef.current || 'AST-01_COMMANDER';
      setTargetAstronautId(effectiveTarget);
      targetAstronautIdRef.current = effectiveTarget;

      // Synthesize realistic scenario telemetry immediately (operates in offline & online)
      const simulated = generateScenarioTelemetry(scenarioKey, effectiveTarget, bufferedPacketsRef.current);
      const effectiveTelemetry = (telemetry && Object.keys(telemetry).length > 0)
        ? { ...simulated, ...JSON.parse(JSON.stringify(telemetry)) }
        : simulated;

      bufferedPacketsRef.current = effectiveTelemetry;
      setTelemetryMap({ ...effectiveTelemetry });

      let alert: AlertPayload | null = null;
      if (scenarioKey === 'NOMINAL_CRUISE') {
        alert = generateScenarioAlert('NOMINAL_CRUISE', effectiveTarget);
        setLatestAlert(alert);
        setMccAlert(alert);
        inTransitAlertRef.current = null;
        inTransitSignalRef.current = null;
        setInTransitSignal(null);
        audioService.stopKlaxon();
        audioService.stopSpeaking();
        lastSpokenAlertRef.current = '';
      } else {
        // Trigger clinical alert immediately - HeaderBar coordinates unified AI Surgeon voice & subtitles
        alert = generateScenarioAlert(scenarioKey, effectiveTarget, effectiveTelemetry);
        if (alert) {
          audioService.initAudioContext();
          audioService.setEngaged(true);
          setLatestAlert(alert);
          if (!isTourActive && !audioService.getTourMode() && (activeViewRef.current === 'SUIT_HUD' || activeViewRef.current === 'CABIN_3D')) {
            lastSpokenAlertRef.current = '';
            playAiSurgeonAlert(alert);
          }
        }
      }

      // Synchronously broadcast scenario & alert to ISS Deck / Cabin views in real time
      broadcastCabinSync(effectiveTelemetry, alert, scenarioKey);

      // 2. Earth MCC: Subject to deep-space radio propagation delay
      const currentPos = orbitalPositionRef.current;
      const delaySec = DISTANCES[currentPos]?.delaySec ?? 0;
      const isDelayed = (delaySec > 0.05 || marsDelayRef.current) && scenarioKey !== 'NOMINAL_CRUISE';

      if (!isDelayed) {
        applyMccTelemetryUpdate(scenarioKey, effectiveTelemetry);
      } else {
        // Capture clean Earth MCC pre-scenario baseline IF no signal is currently in transit:
        if (!inTransitSignalRef.current && Object.keys(bufferedMccPacketsRef.current).length > 0) {
          mccBaselineSnapshotRef.current = JSON.parse(JSON.stringify(bufferedMccPacketsRef.current));
        }

        // Buffer into inTransitPacketsRef (NOT bufferedMccPacketsRef):
        Object.entries(effectiveTelemetry).forEach(([id, pkt]) => {
          inTransitPacketsRef.current[id] = pkt as TelemetryPacket;
        });

        // Explicitly keep Earth MCC locked to the clean baseline!
        if (Object.keys(mccBaselineSnapshotRef.current).length > 0) {
          bufferedMccPacketsRef.current = JSON.parse(JSON.stringify(mccBaselineSnapshotRef.current));
          setMccTelemetryMap({ ...bufferedMccPacketsRef.current });
        }

        const calculatedDelay = delaySec > 0 ? delaySec : 1334.925;
        const newSignal = {
          scenarioKey,
          telemetry: effectiveTelemetry,
          originPosition: currentPos,
          delaySec: calculatedDelay,
          remainingSec: inTransitSignalRef.current?.remainingSec ?? calculatedDelay,
          startTime: inTransitSignalRef.current?.startTime ?? Date.now(),
        };

        // Crucial: Update ref synchronously so any incoming WebSocket frames are held immediately!
        inTransitSignalRef.current = newSignal;
        setInTransitSignal(newSignal);
      }
    },
    [applyMccTelemetryUpdate]
  );

  // Handler for "SOLVED" button: instantly restores nominal flight cruise and clears all active clinical alarms
  const handleSolveSituation = useCallback(async () => {
    // 1. Force local state & storage to NOMINAL_CRUISE immediately
    try {
      localStorage.setItem('helios_scenario', 'NOMINAL_CRUISE');
    } catch {}
    setCurrentScenario('NOMINAL_CRUISE');
    setMccScenario('NOMINAL_CRUISE');
    mccScenarioRef.current = 'NOMINAL_CRUISE';

    // 2. Clear all active emergency alerts immediately
    const nomAlert = generateScenarioAlert('NOMINAL_CRUISE', targetAstronautIdRef.current);
    setLatestAlert(nomAlert);
    setMccAlert(nomAlert);
    inTransitAlertRef.current = null;
    inTransitSignalRef.current = null;
    setInTransitSignal(null);
    lastSpokenAlertRef.current = '';

    // 3. Immediately reset telemetry buffers for all 4 crew members to nominal baseline
    const nom = JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY));
    bufferedPacketsRef.current = nom;
    setTelemetryMap({ ...nom });
    bufferedMccPacketsRef.current = nom;
    setMccTelemetryMap({ ...nom });

    // 4. Silence alarms and klaxons immediately
    audioService.stopKlaxon();
    audioService.stopSpeaking();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    audioService.playTone('chime', 'NOMINAL');

    // 5. Broadcast nominal state across tabs / cabin 3D / monitor iframes
    broadcastCabinSync(nom, nomAlert, 'NOMINAL_CRUISE');

    // 6. Notify backend API to jump back to NOMINAL_CRUISE playback
    try {
      const getApiUrl = (endpoint: string) => {
        if (typeof window !== 'undefined') {
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocal && window.location.port !== '8000') {
            return `http://${window.location.hostname}:8000${endpoint}`;
          }
        }
        return endpoint;
      };
      const queryUrl = getApiUrl('/api/scenario/NOMINAL_CRUISE');
      let res = await fetch(queryUrl, { method: 'POST' }).catch(() => null);
      if (!res?.ok) {
        res = await fetch('/api/scenario/NOMINAL_CRUISE', { method: 'POST' }).catch(() => null);
      }
      if (res?.ok) {
        const data = await res.json().catch(() => null);
        if (data?.telemetry && Object.keys(data.telemetry).length > 0) {
          bufferedPacketsRef.current = { ...data.telemetry };
          setTelemetryMap({ ...data.telemetry });
        }
      }
    } catch {
      // Backend offline fallback handled above
    }

    setTimeout(() => {
      audioService.speak('Situation resolved. All life support and crew biometric systems restored to nominal baseline.');
    }, 200);
  }, []);

  const isIncomingSyncRef = useRef<boolean>(false);

  // Synchronize live telemetry and alerts to cabin 3D views (both embedded & cross-tab)
  useEffect(() => {
    if (isIncomingSyncRef.current) {
      isIncomingSyncRef.current = false;
      return;
    }
    broadcastCabinSync(telemetryMap, latestAlert, currentScenario || 'NOMINAL_CRUISE');
  }, [currentScenario, latestAlert]);

  // Bidirectional Synchronization: Receive scenario & alert updates from other tabs, wall monitor iframes, or ISS Deck
  useEffect(() => {
    const handleIncomingSync = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.fromCabin || payload.fromIframe) return; // Prevent echo feedback loops from monitor iframes
      isIncomingSyncRef.current = true;
      if (payload.type === 'HELIOS_SPEAK_DIRECTIVE' && payload.text && !isEmbedMode) {
        audioService.initAudioContext();
        audioService.setEngaged(true);
        audioService.queueSpeech({
          text: payload.text,
          tone: payload.tone || 'chime',
          config: { severity: payload.severity || 'INFO' },
        });
        return;
      }
      if (payload.type === 'NOMINAL_STATE' || payload.scenario === 'NOMINAL_CRUISE') {
        const wasNonNominal = currentScenario && currentScenario !== 'NOMINAL_CRUISE';
        try {
          localStorage.setItem('helios_scenario', 'NOMINAL_CRUISE');
        } catch {}
        setCurrentScenario('NOMINAL_CRUISE');
        const nomAlert = generateScenarioAlert('NOMINAL_CRUISE', targetAstronautIdRef.current);
        setLatestAlert(nomAlert);
        setMccAlert(nomAlert);
        inTransitAlertRef.current = null;
        inTransitSignalRef.current = null;
        setInTransitSignal(null);
        audioService.stopKlaxon();
        audioService.stopSpeaking();
        const nom = JSON.parse(JSON.stringify(DEFAULT_NOMINAL_TELEMETRY));
        bufferedPacketsRef.current = nom;
        setTelemetryMap(nom);
        bufferedMccPacketsRef.current = nom;
        setMccTelemetryMap(nom);
        return;
      }
      if (payload.type === 'HELIOS_TELEMETRY_SYNC') {
        if (payload.scenario) {
          try {
            localStorage.setItem('helios_scenario', payload.scenario);
          } catch {}
          if (payload.scenario !== currentScenario) {
            setCurrentScenario(payload.scenario);
          }
        }
        if (payload.latestAlert !== undefined) {
          setLatestAlert(payload.latestAlert);
        }
        if (payload.telemetryMap && Object.keys(payload.telemetryMap).length > 0) {
          bufferedPacketsRef.current = { ...bufferedPacketsRef.current, ...payload.telemetryMap };
          setTelemetryMap({ ...bufferedPacketsRef.current });
        } else if (payload.scenario && payload.scenario !== 'NOMINAL_CRUISE') {
          const syn = generateScenarioTelemetry(payload.scenario, targetAstronautIdRef.current);
          bufferedPacketsRef.current = { ...bufferedPacketsRef.current, ...syn };
          setTelemetryMap({ ...bufferedPacketsRef.current });
        }
        if (payload.scenario && payload.scenario !== mccScenarioRef.current && !inTransitSignalRef.current) {
          setMccScenario(payload.scenario);
          mccScenarioRef.current = payload.scenario;
        }
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('helios-telemetry');
        bc.onmessage = (e) => handleIncomingSync(e.data);
      } catch {}
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'helios_live_sync' && e.newValue) {
        try {
          handleIncomingSync(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'PLAY_DRAGON_DOCKING' || e.data?.type === 'PLAY_DRAGON_DOCKING') {
        handleSelectView('DRAGON_DOCKING');
        return;
      }
      if (e.data === 'OPEN_SCENARIOS' || e.data?.type === 'OPEN_SCENARIOS') {
        window.dispatchEvent(new CustomEvent('helios:open_scenarios'));
        return;
      }
      if (e.data?.type === 'TRIGGER_SCENARIO' && e.data.scenario) {
        handleScenarioTriggered(e.data.scenario, e.data.telemetry, e.data.targetCrewId);
        return;
      }
      handleIncomingSync(e.data);
    };
    window.addEventListener('message', handleMessage);

    return () => {
      if (bc) {
        try { bc.close(); } catch {}
      }
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
    };
  }, [currentScenario]);

  // Deep-space light propagation countdown ticker (accelerated by speedMultiplier)
  useEffect(() => {
    if (!inTransitSignal) return;

    const timer = setInterval(() => {
      const elapsedRealSec = (Date.now() - inTransitSignal.startTime) / 1000;
      const effectiveElapsed = elapsedRealSec * speedMultiplier;
      const remaining = Math.max(0, inTransitSignal.delaySec - effectiveElapsed);

      if (remaining <= 0) {
        applyMccTelemetryUpdate(inTransitSignal.scenarioKey, inTransitSignal.telemetry);
      } else {
        setInTransitSignal((prev) => (prev ? { ...prev, remainingSec: remaining } : null));
      }
    }, 100);

    return () => clearInterval(timer);
  }, [inTransitSignal, speedMultiplier, applyMccTelemetryUpdate]);

  const handleWarpSignal = useCallback(() => {
    const currentSignal = inTransitSignalRef.current || inTransitSignal;
    if (currentSignal) {
      applyMccTelemetryUpdate(currentSignal.scenarioKey, currentSignal.telemetry);
    }
  }, [inTransitSignal, applyMccTelemetryUpdate]);

  // Navigation Handlers with instant browser URL synchronization
  const handleOpenTriage = useCallback((astId: string) => {
    const slug = getSlugFromAstronautId(astId);
    setActiveTriageAstronautId(astId);
    setActiveView('HEALTH_TELEMETRY');
    navigateTo(`/telemetry/${slug}`);
  }, []);

  const handleCloseTelemetry = useCallback(() => {
    setActiveView('HUD');
    setActiveTriageAstronautId(null);
    navigateTo('/');
  }, []);

  const handleAstronautChange = useCallback((astId: string) => {
    const slug = getSlugFromAstronautId(astId);
    setActiveTriageAstronautId(astId);
    navigateTo(`/telemetry/${slug}`);
  }, []);

  // Earth MCC Dedicated Telemetry Console Navigation
  const handleOpenMccTelemetry = useCallback((astId: string) => {
    const slug = getSlugFromAstronautId(astId);
    setActiveMccAstronautId(astId);
    setActiveView('MCC_TELEMETRY');
    navigateTo(`/mcc/telemetry/${slug}`);
  }, []);

  const handleCloseMccTelemetry = useCallback(() => {
    setActiveView('MCC');
    setActiveMccAstronautId(null);
    navigateTo('/mcc');
  }, []);

  const handleMccAstronautChange = useCallback((astId: string) => {
    const slug = getSlugFromAstronautId(astId);
    setActiveMccAstronautId(astId);
    navigateTo(`/mcc/telemetry/${slug}`);
  }, []);

  const handleSelectView = useCallback(
    (view: 'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER' | 'MCC_TELEMETRY' | 'SUIT_HUD' | 'CABIN_3D' | 'DRAGON_DOCKING' | 'SELF_ASSESSMENT' | 'MISSION_ROUTINE') => {
      if (view === 'DRAGON_DOCKING') {
        setActiveView('DRAGON_DOCKING');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        navigateTo('/docking');
      } else if (view === 'HUD') {
        setActiveView('HUD');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        sessionStorage.setItem('helios_docking_intro_seen', 'true');
        navigateTo('/');
      } else if (view === 'SELF_ASSESSMENT') {
        setActiveView('SELF_ASSESSMENT');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        sessionStorage.setItem('helios_docking_intro_seen', 'true');
        navigateTo('/self-assessment');
      } else if (view === 'MISSION_ROUTINE') {
        setActiveView('MISSION_ROUTINE');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        sessionStorage.setItem('helios_docking_intro_seen', 'true');
        navigateTo('/mission-routine');

      } else if (view === 'CABIN_3D') {
        setActiveView('CABIN_3D');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        sessionStorage.setItem('helios_docking_intro_seen', 'true');
        navigateTo('/iss');
      } else if (view === 'MCC') {
        setActiveView('MCC');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        navigateTo('/mcc');
      } else if (view === 'MCC_TELEMETRY') {
        const targetId = activeMccAstronautId || 'AST-01_COMMANDER';
        const slug = getSlugFromAstronautId(targetId);
        setActiveView('MCC_TELEMETRY');
        setActiveMccAstronautId(targetId);
        navigateTo(`/mcc/telemetry/${slug}`);
      } else if (view === 'SCANNER') {
        setActiveView('SCANNER');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        navigateTo('/scanner');
      } else if (view === 'SUIT_HUD') {
        setActiveView('SUIT_HUD');
        setActiveTriageAstronautId(null);
        setActiveMccAstronautId(null);
        navigateTo('/suit-hud');
      } else {
        const targetId = activeTriageAstronautId || 'AST-01_COMMANDER';
        const slug = getSlugFromAstronautId(targetId);
        setActiveView('HEALTH_TELEMETRY');
        setActiveTriageAstronautId(targetId);
        navigateTo(`/telemetry/${slug}`);
      }
    },
    [activeTriageAstronautId, activeMccAstronautId]
  );

  // Deep-Space Telemetry Downlink In-Transit Status Ribbon (Strictly rendered within Earth MCC domain)
  const renderInTransitBanner = () => {
    if (!inTransitSignal) return null;
    return (
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(6, 17, 32, 0.98) 0%, rgba(10, 25, 47, 0.98) 100%)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.45)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.85), 0 0 15px rgba(56, 189, 248, 0.2)',
          backdropFilter: 'blur(10px)',
          padding: '6px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontFamily: "var(--hud-font-mono, 'Tomorrow', monospace)",
          width: '100%',
          position: 'relative',
          zIndex: 150,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#38bdf8',
                boxShadow: '0 0 10px #38bdf8',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.06em' }}>
              DEEP SPACE DOWNLINK IN-TRANSIT
            </span>
          </div>

          <span style={{ color: '#334155' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
            <span style={{ color: '#64748b' }}>ORIGIN:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{DISTANCES[inTransitSignal.originPosition].label}</span>
            <span style={{ color: '#64748b' }}>({(DISTANCES[inTransitSignal.originPosition].km / 1e6).toFixed(1)}M km)</span>
          </div>

          <span style={{ color: '#334155' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
            <span style={{ color: '#64748b' }}>SCENARIO:</span>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>
              {inTransitSignal.scenarioKey.replace(/^SCENARIO_\d+_/, '').replace(/_/g, ' ')}
            </span>
          </div>

          <span style={{ color: '#334155' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
            <span style={{ color: '#64748b' }}>LIGHT TRAVEL REMAINING:</span>
            <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 11 }}>
              {fmtTime(inTransitSignal.remainingSec)}
            </span>
            {speedMultiplier > 1 && (
              <span style={{ color: '#38bdf8', fontSize: 9 }}>({speedMultiplier}x speed)</span>
            )}
          </div>
        </div>

        <button
          onClick={handleWarpSignal}
          title="Accelerate light-speed propagation and instantly deliver the telemetry packet to Earth MCC"
          style={{
            background: 'rgba(56, 189, 248, 0.16)',
            border: '1px solid #38bdf8',
            borderRadius: 4,
            padding: '3px 10px',
            color: '#ffffff',
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
        >
          <span>WARP SIGNAL TO EARTH (INSTANT RECEPTION)</span>
        </button>
      </div>
    );
  };

  return (
    <>
      {/* GPU-Composited Photorealistic Earth Orbital Space Background (disabled in embed frames for high FPS) */}
      {!isEmbedMode && <SpaceBackground activeView={activeView} />}

      {/* ─── 1. FLIGHT HUD VIEW (DEFAULT HOME PAGE — 100% INSTANT SPACECRAFT DATA) ─── */}
      {activeView === 'HUD' && (
        <>
          {/* Universal Floating Header Capsule */}
          {!isEmbedMode && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 200,
                overflow: 'visible',
                width: '100%',
                padding: '8px 20px 0',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ maxWidth: '1840px', margin: '0 auto' }}>
                <HeaderBar
                  connected={connected}
                  marsDelay={false}
                  orbitalPosition={orbitalPosition}
                  speedMultiplier={speedMultiplier}
                  activeView={activeView}
                  onSelectView={handleSelectView}
                  latestAlert={latestAlert}
                  selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
                  scannerTheme={scannerTheme}
                  onSelectScannerTheme={setScannerTheme}
                  showEclssBar={showEclssBar}
                  onToggleEclss={() => setShowEclssBar((prev) => !prev)}
                  currentScenario={currentScenario}
                  telemetryMap={telemetryMap}
                  onOpenTriage={handleOpenTriage}
                  onStartTour={() => setIsTourActive(true)}
                  isTourActive={isTourActive}
                  onSolveSituation={handleSolveSituation}
                />
              </div>
            </div>
          )}

          {/* Futuristic 3D Holographic Flight Command Deck */}
          <MainIndexDeck
            telemetryMap={telemetryMap}
            latestAlert={latestAlert}
            currentScenario={currentScenario}
            orbitalPosition={orbitalPosition}
            onOpenTriage={handleOpenTriage}
            onSelectView={handleSelectView}
            scannerTheme={scannerTheme}
            onSelectScannerTheme={setScannerTheme}
            showEclssBar={showEclssBar}
            onToggleEclss={() => setShowEclssBar((prev) => !prev)}
            targetAstronautId={targetAstronautId}
            onSolveSituation={handleSolveSituation}
          />
        </>
      )}

      {/* ─── 2. ONBOARD SPACECRAFT HEALTH TELEMETRY & CLINICAL ANALYSIS (INSTANT) ─── */}
      {activeView === 'HEALTH_TELEMETRY' && (
        <>
          {/* Universal Floating Header Capsule */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              overflow: 'visible',
              width: '100%',
              padding: '12px 20px 0',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: '1840px', margin: '0 auto' }}>
              <HeaderBar
                connected={connected}
                marsDelay={false}
                orbitalPosition={orbitalPosition}
                speedMultiplier={speedMultiplier}
                activeView={activeView}
                onSelectView={handleSelectView}
                latestAlert={latestAlert}
                selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
                scannerTheme={scannerTheme}
                onSelectScannerTheme={setScannerTheme}
                showEclssBar={showEclssBar}
                onToggleEclss={() => setShowEclssBar((prev) => !prev)}
                currentScenario={currentScenario}
                telemetryMap={telemetryMap}
                onOpenTriage={handleOpenTriage}
                onStartTour={() => setIsTourActive(true)}
                isTourActive={isTourActive}
                onSolveSituation={handleSolveSituation}
              />
            </div>
          </div>
          <div data-tour="health-telemetry-view">
            <HealthTelemetryView
              hideHeader={true}
              initialAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
              telemetryMap={telemetryMap}
              marsDelay={false}
              connected={connected}
              latestAlert={latestAlert}
              onToggleMarsDelay={handleToggleMarsDelay}
              activeView={activeView}
              onSelectView={handleSelectView}
              onClose={handleCloseTelemetry}
              onAstronautChange={handleAstronautChange}
            />
          </div>
        </>
      )}

      {/* ─── 2.5 ASTRONAUT DAILY SELF-ASSESSMENT & SUBJECTIVE HEALTH LOG ─── */}
      {activeView === 'SELF_ASSESSMENT' && (
        <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1, backgroundColor: 'transparent' }}>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              overflow: 'visible',
              width: '100%',
              padding: '12px 20px 0',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: '1840px', margin: '0 auto' }}>
              <HeaderBar
                connected={connected}
                marsDelay={false}
                orbitalPosition={orbitalPosition}
                speedMultiplier={speedMultiplier}
                activeView={activeView}
                onSelectView={handleSelectView}
                latestAlert={latestAlert}
                selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
                scannerTheme={scannerTheme}
                onSelectScannerTheme={setScannerTheme}
                showEclssBar={showEclssBar}
                onToggleEclss={() => setShowEclssBar((prev) => !prev)}
                currentScenario={currentScenario}
                telemetryMap={telemetryMap}
                onOpenTriage={handleOpenTriage}
                onStartTour={() => setIsTourActive(true)}
                isTourActive={isTourActive}
                onSolveSituation={handleSolveSituation}
              />
            </div>
          </div>
          <div data-tour="self-assessment-view" style={{ maxWidth: '1840px', margin: '14px auto 0', padding: '0 20px 40px' }}>
            <AstronautSelfAssessment
              initialAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
              telemetryMap={telemetryMap}
              currentScenario={currentScenario}
              onClose={() => handleSelectView('HUD')}
            />
          </div>
        </div>
      )}

      {/* ─── 2.6 ASTRONAUT MISSION ROUTINE, PVT DRILL & COUNTERMEASURE ADHERENCE ─── */}
      {activeView === 'MISSION_ROUTINE' && (
        <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1, backgroundColor: 'transparent' }}>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              overflow: 'visible',
              width: '100%',
              padding: '12px 20px 0',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: '1840px', margin: '0 auto' }}>
              <HeaderBar
                connected={connected}
                marsDelay={false}
                orbitalPosition={orbitalPosition}
                speedMultiplier={speedMultiplier}
                activeView={activeView}
                onSelectView={handleSelectView}
                latestAlert={latestAlert}
                selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
                scannerTheme={scannerTheme}
                onSelectScannerTheme={setScannerTheme}
                showEclssBar={showEclssBar}
                onToggleEclss={() => setShowEclssBar((prev) => !prev)}
                currentScenario={currentScenario}
                telemetryMap={telemetryMap}
                onOpenTriage={handleOpenTriage}
                onStartTour={() => setIsTourActive(true)}
                isTourActive={isTourActive}
                onSolveSituation={handleSolveSituation}
              />
            </div>
          </div>
          <div data-tour="mission-routine-view" style={{ maxWidth: '1840px', margin: '14px auto 0', padding: '0 20px 40px' }}>
            <MissionRoutineAdherence
              astronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
              telemetryMap={telemetryMap}
              currentScenario={currentScenario}
              onClose={() => handleSelectView('HUD')}
            />
          </div>
        </div>
      )}



      {/* ─── 3. EARTH MISSION CONTROL CENTER (MCC GROUND CONSOLE — DELAYED TELEMETRY) ─── */}
      {activeView === 'MCC' && (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', backgroundColor: 'transparent' }}>
          {/* Top Sticky Header */}
          {!isEmbedMode && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 200,
                overflow: 'visible',
                width: '100%',
                padding: '8px 20px 0',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ maxWidth: '1840px', margin: '0 auto' }}>
                <HeaderBar
                  connected={connected}
                  marsDelay={marsDelay}
                  onToggleMarsDelay={handleToggleMarsDelay}
                  orbitalPosition={orbitalPosition}
                  onSelectOrbitalPosition={handleOrbitalPositionChange}
                  speedMultiplier={speedMultiplier}
                  activeView={activeView}
                  onSelectView={handleSelectView}
                  latestAlert={mccAlert}
                  selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
                  scannerTheme={scannerTheme}
                  onSelectScannerTheme={setScannerTheme}
                  showEclssBar={showEclssBar}
                  onToggleEclss={() => setShowEclssBar((prev) => !prev)}
                  currentScenario={mccScenario}
                  telemetryMap={mccTelemetryMap}
                  onOpenTriage={handleOpenMccTelemetry}
                  onStartTour={() => setIsTourActive(true)}
                  isTourActive={isTourActive}
                  onSolveSituation={handleSolveSituation}
                />
              </div>
              {/* Deep-Space Downlink In-Transit Status Ribbon (shown only on Earth MCC views) */}
              {renderInTransitBanner()}
            </div>
          )}

          <div data-tour="mcc-view">
            <MissionControlView
              telemetryMap={mccTelemetryMap}
              latestAlert={mccAlert}
              connected={connected}
              marsDelay={marsDelay}
              onToggleMarsDelay={handleToggleMarsDelay}
              orbitalPosition={orbitalPosition}
              onSelectOrbitalPosition={handleOrbitalPositionChange}
              speedMultiplier={speedMultiplier}
              onSpeedMultiplierChange={setSpeedMultiplier}
              onSelectView={handleSelectView}
              currentScenario={mccScenario}
              onOpenTriage={handleOpenMccTelemetry}
              onOpenMccTelemetry={handleOpenMccTelemetry}
            />
          </div>
        </div>
      )}

      {/* ─── 4. DEDICATED EARTH MCC BIOMEDICAL TELEMETRY CONSOLE (/mcc/telemetry/:name) ─── */}
      {activeView === 'MCC_TELEMETRY' && (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', backgroundColor: isEmbedMode ? '#070b12' : 'transparent' }}>
          {/* Top Sticky Header for Earth Ground Station */}
          {!isEmbedMode && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 200,
                overflow: 'visible',
                width: '100%',
                padding: '8px 20px 0',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ maxWidth: '1840px', margin: '0 auto' }}>
                <HeaderBar
                  connected={connected}
                  marsDelay={marsDelay}
                  onToggleMarsDelay={handleToggleMarsDelay}
                  orbitalPosition={orbitalPosition}
                  onSelectOrbitalPosition={handleOrbitalPositionChange}
                  speedMultiplier={speedMultiplier}
                  activeView={activeView}
                  onSelectView={handleSelectView}
                  latestAlert={mccAlert}
                  selectedAstronautId={activeMccAstronautId || 'AST-01_COMMANDER'}
                  scannerTheme={scannerTheme}
                  onSelectScannerTheme={setScannerTheme}
                  showEclssBar={showEclssBar}
                  onToggleEclss={() => setShowEclssBar((prev) => !prev)}
                  currentScenario={mccScenario}
                  telemetryMap={mccTelemetryMap}
                  onOpenTriage={handleOpenMccTelemetry}
                  onStartTour={() => setIsTourActive(true)}
                  isTourActive={isTourActive}
                  onSolveSituation={handleSolveSituation}
                />
              </div>

              {/* Earth Ground Station Operational Breadcrumb Bar */}
              <div
                style={{
                  background: 'linear-gradient(90deg, #0b1117 0%, #080d12 100%)',
                  borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: '7px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: "var(--hud-font-mono, 'Tomorrow', monospace)",
                  fontSize: '11px',
                  color: '#94a3b8',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={handleCloseMccTelemetry}
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: 4,
                      padding: '3px 10px',
                      color: '#38bdf8',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                      letterSpacing: '0.04em',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                    }}
                  >
                    <span>← RETURN TO MCC MAIN CONSOLE</span>
                  </button>

                  <span style={{ color: '#334155' }}>|</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#38bdf8',
                        boxShadow: '0 0 8px #38bdf8',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: '#f8fafc', fontWeight: 800, letterSpacing: '0.06em' }}>
                      EARTH MCC // CLINICAL TELEMETRY CONSOLE
                    </span>
                    <span style={{ color: '#64748b' }}>(JSC FLIGHT SURGEON WORKSTATION)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '10.5px' }}>
                    <span style={{ color: '#64748b' }}>DOWNLINK:</span>
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>
                      DSN KA-BAND ({DISTANCES[orbitalPosition]?.label})
                    </span>
                  </div>

                  <span style={{ color: '#334155' }}>|</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '10.5px' }}>
                    <span style={{ color: '#64748b' }}>PROPAGATION LATENCY:</span>
                    <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                      +{fmtTime(DISTANCES[orbitalPosition]?.delaySec ?? 0)} ONE-WAY
                    </span>
                  </div>
                </div>
              </div>

              {/* Deep-Space Downlink In-Transit Status Ribbon */}
              {renderInTransitBanner()}
            </div>
          )}

          {/* Compact Embedded Header Bar for Cabin Wall Monitor */}
          {isEmbedMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 16px',
                background: 'linear-gradient(90deg, #0b1117 0%, #080d12 100%)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
                fontFamily: "var(--hud-font-mono, 'Tomorrow', monospace)",
                position: 'sticky',
                top: 0,
                zIndex: 100,
              }}
            >
              <button
                onClick={handleCloseMccTelemetry}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: 4,
                  padding: '3px 10px',
                  color: '#38bdf8',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ← RETURN TO MCC OVERVIEW
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '10.5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                <span style={{ color: '#f8fafc', fontWeight: 700, letterSpacing: '0.04em' }}>
                  EARTH MCC // CLINICAL TELEMETRY ({activeMccAstronautId ? activeMccAstronautId.replace('AST-0', 'CREW-0') : 'CREW-01'})
                </span>
              </div>
            </div>
          )}

          {/* Earth MCC Health Telemetry Component fed by delayed Earth state */}
          <HealthTelemetryView
            hideHeader={true}
            initialAstronautId={activeMccAstronautId || 'AST-01_COMMANDER'}
            telemetryMap={mccTelemetryMap}
            marsDelay={marsDelay}
            connected={connected}
            latestAlert={mccAlert}
            onToggleMarsDelay={handleToggleMarsDelay}
            activeView={activeView}
            onSelectView={handleSelectView}
            onClose={handleCloseMccTelemetry}
            onAstronautChange={handleMccAstronautChange}
          />
        </div>
      )}

      {/* ─── 5. DEDICATED 3D HOLOGRAPHIC ANATOMICAL BODY SCANNER VIEW ─── */}
      {activeView === 'SCANNER' && (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', backgroundColor: 'transparent' }}>
          {/* Top Sticky Header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              width: '100%',
              padding: '12px 20px 0',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: '1840px', margin: '0 auto' }}>
              <HeaderBar
                connected={connected}
                marsDelay={marsDelay}
                onToggleMarsDelay={handleToggleMarsDelay}
                orbitalPosition={orbitalPosition}
                onSelectOrbitalPosition={handleOrbitalPositionChange}
                speedMultiplier={speedMultiplier}
                activeView={activeView}
                onSelectView={handleSelectView}
                latestAlert={latestAlert}
                selectedAstronautId={scannerAstronautId}
                scannerTheme={scannerTheme}
                onSelectScannerTheme={setScannerTheme}
                showEclssBar={showEclssBar}
                onToggleEclss={() => setShowEclssBar((prev) => !prev)}
                currentScenario={currentScenario}
                telemetryMap={telemetryMap}
                onOpenTriage={handleOpenTriage}
                onStartTour={() => setIsTourActive(true)}
                isTourActive={isTourActive}
                onSolveSituation={handleSolveSituation}
              />
            </div>
          </div>

          <main style={{ padding: '16px 20px 80px 20px', maxWidth: '1500px', margin: '0 auto', boxSizing: 'border-box' }}>
            {/* Crew Selector Ribbon for 3D Hologram */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              padding: '10px 16px',
              background: 'linear-gradient(180deg, rgba(14, 22, 38, 0.75) 0%, rgba(9, 14, 24, 0.82) 100%)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: 14,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#68849e' }}>SELECT CREW MEMBER:</span>
                {[
                  { id: 'AST-01_COMMANDER', name: 'Haley', role: 'Commander', crewNo: 'CREW-01' },
                  { id: 'AST-02_PILOT', name: 'Chris', role: 'Pilot', crewNo: 'CREW-02' },
                  { id: 'AST-03_MEDICAL', name: 'Dr. Sian', role: 'Medical Specialist', crewNo: 'CREW-03' },
                  { id: 'AST-04_ENGINEER', name: 'Leo', role: 'Systems Engineer', crewNo: 'CREW-04' },
                ].map(c => {
                  const active = scannerAstronautId === c.id;
                  const crewTel = telemetryMap[c.id];
                  const isCrewAlert = crewTel?.evaluated_severity === 'CRITICAL' || crewTel?.evaluated_severity === 'WARNING' || (crewTel?.heart_rate ?? 60) > 100;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setScannerAstronautId(c.id)}
                      style={{
                        background: active ? '#10283d' : '#0b141e',
                        border: `1px solid ${active ? '#00e5ff' : '#1c2d3e'}`,
                        borderRadius: 4,
                        padding: '4px 10px',
                        color: active ? '#ffffff' : '#8aa2b8',
                        fontSize: 10,
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span>{c.crewNo} {c.name}</span>
                      {isCrewAlert && (
                        <span style={{ fontSize: 8, background: '#cf9834', color: '#04080e', padding: '0 4px', borderRadius: 2, fontWeight: 800 }}>
                          ALERT
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: '#68849e' }}>
                <span style={{ color: '#00e5ff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 6px #00e5ff' }} />
                  <span>Interactive 3D WebGL Wireframe Active</span>
                </span>
                <span>·</span>
                <span>Click & Drag to Rotate 360°</span>
              </div>
            </div>

            {/* 3D Holographic Body Scanner Viewport */}
            {(() => {
              const currentCrew = [
                { id: 'AST-01_COMMANDER', name: 'Haley', role: 'Commander', crewNo: 'CREW-01' },
                { id: 'AST-02_PILOT', name: 'Chris', role: 'Pilot', crewNo: 'CREW-02' },
                { id: 'AST-03_MEDICAL', name: 'Dr. Sian', role: 'Medical Specialist', crewNo: 'CREW-03' },
                { id: 'AST-04_ENGINEER', name: 'Leo', role: 'Systems Engineer', crewNo: 'CREW-04' },
              ].find(c => c.id === scannerAstronautId) || { id: 'AST-02_PILOT', name: 'Chris', role: 'Pilot', crewNo: 'CREW-02' };

              return (
                <HolographicBodyScanner
                  astronautId={currentCrew.id}
                  astronautName={currentCrew.name}
                  astronautRole={currentCrew.role}
                  crewNo={currentCrew.crewNo}
                  telemetry={telemetryMap[currentCrew.id]}
                  themeMode="CYAN"
                  orbitalPosition={orbitalPosition}
                />
              );
            })()}
          </main>
        </div>
      )}

      {/* ─── 6. FIRST-PERSON ASTRONAUT SUIT VISOR HUD VIEW ─── */}
      {activeView === 'SUIT_HUD' && (
        <SuitHudView
          telemetryMap={telemetryMap}
          currentScenario={currentScenario}
          latestAlert={latestAlert}
          initialAstronautId={activeTriageAstronautId || targetAstronautId || 'AST-01_COMMANDER'}
          onExit={() => handleSelectView('HUD')}
          onOpenTriage={handleOpenTriage}
          onTriggerScenario={handleScenarioTriggered}
        />
      )}

      {/* ─── 7. ASTRODOCX 3D CABIN & FIRST-PERSON DOCK TOUR VIEW ─── */}
      {activeView === 'CABIN_3D' && (
        <Cabin3DView
          telemetryMap={telemetryMap}
          latestAlert={latestAlert}
          currentScenario={currentScenario}
          initialAstronautId={activeTriageAstronautId || targetAstronautId || 'AST-01_COMMANDER'}
          onExit={() => handleSelectView('HUD')}
          onOpenTriage={handleOpenTriage}
          onTriggerScenario={handleScenarioTriggered}
          isTourActive={isTourActive}
        />
      )}

      {/* ─── 8. SPACEX CREW DRAGON CINEMATIC DOCKING INTRO VIEW ─── */}
      {activeView === 'DRAGON_DOCKING' && (
        <DragonDockingIntro
          onEnterStation={() => handleSelectView('CABIN_3D')}
          onEnterDashboard={() => handleSelectView('HUD')}
        />
      )}

      {/* Global Scenario Controller (Floating Action Pill + Aerospace Modal) */}
      {activeView !== 'DRAGON_DOCKING' && (
        <ScenarioController
          currentScenario={currentScenario}
          marsDelay={marsDelay}
          hideFloatingPill={isEmbedMode || activeView === 'CABIN_3D'}
          onToggleMarsDelay={handleToggleMarsDelay}
          onScenarioTriggered={handleScenarioTriggered}
          selectedCrewId={targetAstronautId || 'AST-01_COMMANDER'}
          onSelectCrewId={(id) => {
            setTargetAstronautId(id);
            targetAstronautIdRef.current = id;
          }}
        />
      )}

      {/* ─── 9. AUTOMATED 3-MINUTE INTERACTIVE PROJECT TOUR OVERLAY ─── */}
      <ProjectTourOverlay
        active={isTourActive}
        onEndTour={() => setIsTourActive(false)}
        onSelectView={handleSelectView}
        onTriggerScenario={handleScenarioTriggered}
      />
    </>
  );
}

export default App;
