import { useEffect, useState, useRef, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { CrewGrid } from './components/CrewGrid';
import { CabinEnvironmentalBar } from './components/CabinEnvironmentalBar';
import { ScenarioController } from './components/ScenarioController';
import { HealthTelemetryView } from './components/HealthTelemetryView';
import { MissionControlView } from './components/MissionControlView';
import { HolographicBodyScanner } from './components/HolographicBodyScanner';
import { SpaceBackground } from './components/SpaceBackground';
import { wsService } from './services/websocketService';
import {
  parseCurrentRoute,
  navigateTo,
  getSlugFromAstronautId,
} from './services/routerService';
import type { TelemetryPacket, AlertPayload, DistancePreset } from './types/telemetry';
import { DISTANCES, fmtTime } from './types/telemetry';

export function App() {
  // Parse initial route: default root '/' opens HUD; '/telemetry/:name' opens Health Telemetry; '/mcc' opens Earth MCC; '/scanner' opens 3D Hologram
  const initialRoute = parseCurrentRoute();
  const [activeView, setActiveView] = useState<'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER'>(initialRoute.view);
  const [activeTriageAstronautId, setActiveTriageAstronautId] = useState<string | null>(
    initialRoute.view === 'HEALTH_TELEMETRY' ? initialRoute.astronautId : null
  );
  const [scannerAstronautId, setScannerAstronautId] = useState<string>('AST-02_PILOT');

  const [connected, setConnected] = useState<boolean>(false);
  const [marsDelay, setMarsDelay] = useState<boolean>(false);
  const [orbitalPosition, setOrbitalPosition] = useState<DistancePreset>('MARS_MAX');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
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

  useEffect(() => {
    inTransitSignalRef.current = inTransitSignal;
  }, [inTransitSignal]);

  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryPacket>>({});
  const [latestAlert, setLatestAlert] = useState<AlertPayload | null>(null);
  const [currentScenario, setCurrentScenario] = useState<string>('NOMINAL_CRUISE');

  // Buffer recent packets to update React state smoothly at 10 Hz
  const bufferedPacketsRef = useRef<Record<string, TelemetryPacket>>({});

  // Synchronize browser history / URL with application view
  useEffect(() => {
    const handlePopState = () => {
      const route = parseCurrentRoute();
      setActiveView(route.view);
      if (route.view === 'HEALTH_TELEMETRY') {
        setActiveTriageAstronautId(route.astronautId);
      } else if (route.view === 'SCANNER') {
        setScannerAstronautId(route.astronautId || 'AST-02_PILOT');
        setActiveTriageAstronautId(null);
      } else {
        setActiveTriageAstronautId(null);
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
          bufferedPacketsRef.current = data.telemetry;
          setTelemetryMap(data.telemetry);
          const firstPacket = Object.values(data.telemetry)[0] as TelemetryPacket | undefined;
          if (firstPacket && firstPacket.scenario_phase) {
            setCurrentScenario(firstPacket.scenario_phase);
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
      // If a scenario downlink signal is in-transit across deep space to Earth MCC:
      if (inTransitSignalRef.current) {
        inTransitPacketsRef.current[packet.astronaut_id] = packet;
        return;
      }

      bufferedPacketsRef.current[packet.astronaut_id] = packet;

      if (packet.scenario_phase) {
        setCurrentScenario((prev) => (prev === packet.scenario_phase ? prev : packet.scenario_phase));
      }
    });

    // 10 Hz live telemetry state ticker (100ms) to ensure cards fluctuate continuously with real sensor data
    const telemetryInterval = setInterval(() => {
      if (Object.keys(bufferedPacketsRef.current).length > 0) {
        setTelemetryMap({ ...bufferedPacketsRef.current });
      }
    }, 100);

    // 4. Subscribe to Proactive JARVIS Alerts
    const unsubAlert = wsService.subscribeAlert((alert: AlertPayload) => {
      if (inTransitSignalRef.current) {
        inTransitAlertRef.current = alert;
        return;
      }
      setLatestAlert(alert);
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
    const isDelayed = pos === 'MARS_MIN' || pos === 'MARS_MAX';
    setMarsDelay(isDelayed);
    fetch(`/api/mars-delay?enabled=${isDelayed}`, { method: 'POST' }).catch(() => {});
  }, []);

  const handleToggleMarsDelay = async (enabled: boolean) => {
    setMarsDelay(enabled);
    setOrbitalPosition(enabled ? 'MARS_MAX' : 'LEO');
    try {
      await fetch(`/api/mars-delay?enabled=${enabled}`, { method: 'POST' });
    } catch {
      // Ignore
    }
  };

  const applyTelemetryUpdate = useCallback((scenarioKey: string, telemetry?: Record<string, any>) => {
    setCurrentScenario(scenarioKey);
    if (telemetry && Object.keys(telemetry).length > 0) {
      bufferedPacketsRef.current = { ...bufferedPacketsRef.current, ...telemetry };
    }
    if (Object.keys(inTransitPacketsRef.current).length > 0) {
      bufferedPacketsRef.current = { ...bufferedPacketsRef.current, ...inTransitPacketsRef.current };
      inTransitPacketsRef.current = {};
    }
    setTelemetryMap({ ...bufferedPacketsRef.current });

    if (inTransitAlertRef.current) {
      setLatestAlert(inTransitAlertRef.current);
      inTransitAlertRef.current = null;
    }
    setInTransitSignal(null);
  }, []);

  const handleScenarioTriggered = useCallback((scenarioKey: string, telemetry?: Record<string, any>) => {
    const delaySec = DISTANCES[orbitalPosition]?.delaySec ?? 0;
    if (delaySec <= 0.05) {
      applyTelemetryUpdate(scenarioKey, telemetry);
    } else {
      setInTransitSignal({
        scenarioKey,
        telemetry,
        originPosition: orbitalPosition,
        delaySec,
        remainingSec: delaySec,
        startTime: Date.now(),
      });
    }
  }, [orbitalPosition, applyTelemetryUpdate]);

  // Deep-space light propagation countdown ticker (accelerated by speedMultiplier)
  useEffect(() => {
    if (!inTransitSignal) return;

    const timer = setInterval(() => {
      const elapsedRealSec = (Date.now() - inTransitSignal.startTime) / 1000;
      const effectiveElapsed = elapsedRealSec * speedMultiplier;
      const remaining = Math.max(0, inTransitSignal.delaySec - effectiveElapsed);

      if (remaining <= 0) {
        applyTelemetryUpdate(inTransitSignal.scenarioKey, inTransitSignal.telemetry);
      } else {
        setInTransitSignal((prev) => (prev ? { ...prev, remainingSec: remaining } : null));
      }
    }, 100);

    return () => clearInterval(timer);
  }, [inTransitSignal, speedMultiplier, applyTelemetryUpdate]);

  const handleWarpSignal = useCallback(() => {
    if (inTransitSignal) {
      applyTelemetryUpdate(inTransitSignal.scenarioKey, inTransitSignal.telemetry);
    }
  }, [inTransitSignal, applyTelemetryUpdate]);

  // Navigation Handlers with instant browser URL synchronization
  const handleOpenTriage = useCallback((astId: string) => {
    const slug = getSlugFromAstronautId(astId);
    setActiveTriageAstronautId(astId);
    setActiveView('HEALTH_TELEMETRY');
    navigateTo(`/telemetry/${slug}`);
  }, []);

  const handleSelectView = useCallback(
    (view: 'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER') => {
      if (view === 'HUD') {
        setActiveView('HUD');
        setActiveTriageAstronautId(null);
        navigateTo('/');
      } else if (view === 'MCC') {
        setActiveView('MCC');
        setActiveTriageAstronautId(null);
        navigateTo('/mcc');
      } else if (view === 'SCANNER') {
        setActiveView('SCANNER');
        setActiveTriageAstronautId(null);
        navigateTo('/scanner');
      } else {
        const targetId = activeTriageAstronautId || 'AST-01_COMMANDER';
        const slug = getSlugFromAstronautId(targetId);
        setActiveView('HEALTH_TELEMETRY');
        setActiveTriageAstronautId(targetId);
        navigateTo(`/telemetry/${slug}`);
      }
    },
    [activeTriageAstronautId]
  );

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

  return (
    <>
      {/* GPU-Composited Photorealistic Earth Orbital Space Background */}
      <SpaceBackground activeView={activeView} />

      {/* Deep-Space Telemetry Downlink In-Transit Status Ribbon */}
      {inTransitSignal && (
        <div
          style={{
            position: 'fixed',
            top: 48,
            left: 0,
            width: '100%',
            zIndex: 9999,
            background: 'linear-gradient(90deg, rgba(6, 17, 32, 0.97) 0%, rgba(10, 25, 47, 0.97) 100%)',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Pulsing deep-space radio indicator */}
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

          {/* Action button to warp signal to Earth immediately */}
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
      )}

      {/* Flight HUD View (Default Home Page) */}
      {activeView === 'HUD' && (
        <>
          {/* Top Sticky Navbar & Full-Width ECLSS Cabin Environmental Ribbon */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              overflow: 'visible',
              background: '#0c0c0c',
              width: '100%',
            }}
          >
            <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '0 20px' }}>
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
                selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
              />
            </div>
            {/* Full-Viewport Width Sticky ECLSS Environmental Ribbon directly beneath the navbar */}
            <CabinEnvironmentalBar
              telemetryMap={telemetryMap}
              currentScenario={currentScenario}
            />
          </div>

          <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '16px 20px 72px', position: 'relative', zIndex: 1 }}>
            {/* Primary Flight HUD: 4-Row Crew Biometric Telemetry Grid with Inline ECG */}
            <CrewGrid
              telemetryMap={telemetryMap}
              onOpenTriage={handleOpenTriage}
            />
          </div>
        </>
      )}

      {/* Comprehensive Health Telemetry & 10-Category Clinical Analysis Console */}
      {activeView === 'HEALTH_TELEMETRY' && (
        <>
          {/* JARVIS fixed bottom bar on telemetry page — jarvisOnly skips the top nav */}
          <HeaderBar
            jarvisOnly
            connected={connected}
            latestAlert={latestAlert}
            selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
            activeView={activeView}
            onSelectView={handleSelectView}
          />
          <HealthTelemetryView
            initialAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
            telemetryMap={telemetryMap}
            marsDelay={marsDelay}
            connected={connected}
            latestAlert={latestAlert}
            onToggleMarsDelay={handleToggleMarsDelay}
            activeView={activeView}
            onSelectView={handleSelectView}
            onClose={handleCloseTelemetry}
            onAstronautChange={handleAstronautChange}
          />
        </>
      )}

      {/* Earth Mission Control Center (MCC Ground Sentry Console) */}
      {activeView === 'MCC' && (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', backgroundColor: '#070a07' }}>
          {/* Top Sticky Header for instant view navigation */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              overflow: 'visible',
              background: '#070a07',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              width: '100%',
            }}
          >
            <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '0 20px' }}>
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
                selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
              />
            </div>
          </div>

          <MissionControlView
            telemetryMap={telemetryMap}
            latestAlert={latestAlert}
            connected={connected}
            marsDelay={marsDelay}
            onToggleMarsDelay={handleToggleMarsDelay}
            orbitalPosition={orbitalPosition}
            onSelectOrbitalPosition={handleOrbitalPositionChange}
            speedMultiplier={speedMultiplier}
            onSpeedMultiplierChange={setSpeedMultiplier}
            onSelectView={handleSelectView}
            currentScenario={currentScenario}
            onOpenTriage={handleOpenTriage}
          />
        </div>
      )}

      {/* ─── DEDICATED 3D HOLOGRAPHIC ANATOMICAL BODY SCANNER VIEW ─── */}
      {activeView === 'SCANNER' && (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', backgroundColor: '#04080e' }}>
          {/* Top Sticky Header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              background: '#04080e',
              borderBottom: '1px solid rgba(0, 229, 255, 0.18)',
              width: '100%',
            }}
          >
            <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '0 20px' }}>
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
              />
            </div>
          </div>

          <main style={{ padding: '16px 20px 80px 20px', maxWidth: '1250px', margin: '0 auto', boxSizing: 'border-box' }}>
            {/* Crew Selector Ribbon for 3D Hologram */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              padding: '9px 14px',
              background: '#070d16',
              border: '1px solid #142232',
              borderRadius: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#68849e' }}>SELECT CREW MEMBER:</span>
                {[
                  { id: 'AST-01_COMMANDER', name: 'Haley', role: 'Commander', crewNo: 'CREW-01' },
                  { id: 'AST-02_PILOT', name: 'Chris', role: 'Pilot', crewNo: 'CREW-02', alert: true },
                  { id: 'AST-03_MEDICAL', name: 'Dr. Sian', role: 'Medical Specialist', crewNo: 'CREW-03' },
                  { id: 'AST-04_ENGINEER', name: 'Leo', role: 'Systems Engineer', crewNo: 'CREW-04' },
                ].map(c => {
                  const active = scannerAstronautId === c.id;
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
                      {c.alert && (
                        <span style={{ fontSize: 8, background: '#cf9834', color: '#04080e', padding: '0 4px', borderRadius: 2, fontWeight: 800 }}>
                          TACHY
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
                />
              );
            })()}
          </main>
        </div>
      )}

      {/* Global Scenario Controller (Floating Action Pill + Aerospace Modal) */}
      <ScenarioController
        currentScenario={currentScenario}
        marsDelay={marsDelay}
        onToggleMarsDelay={handleToggleMarsDelay}
        onScenarioTriggered={handleScenarioTriggered}
      />
    </>
);
}

export default App;
