import { useEffect, useState, useRef, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { CrewGrid } from './components/CrewGrid';
import { ScenarioController } from './components/ScenarioController';
import { HealthTelemetryView } from './components/HealthTelemetryView';
import { wsService } from './services/websocketService';
import {
  parseCurrentRoute,
  navigateTo,
  getSlugFromAstronautId,
} from './services/routerService';
import type { TelemetryPacket, AlertPayload } from './types/telemetry';

export function App() {
  // Parse initial route: default root '/' opens HUD; '/telemetry/:name' opens Health Telemetry
  const initialRoute = parseCurrentRoute();
  const [activeView, setActiveView] = useState<'HUD' | 'HEALTH_TELEMETRY'>(initialRoute.view);
  const [activeTriageAstronautId, setActiveTriageAstronautId] = useState<string | null>(
    initialRoute.view === 'HEALTH_TELEMETRY' ? initialRoute.astronautId : null
  );

  const [connected, setConnected] = useState<boolean>(false);
  const [marsDelay, setMarsDelay] = useState<boolean>(false);
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
      bufferedPacketsRef.current[packet.astronaut_id] = packet;

      if (packet.scenario_phase) {
        setCurrentScenario(packet.scenario_phase);
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

  const handleToggleMarsDelay = async (enabled: boolean) => {
    setMarsDelay(enabled);
    try {
      await fetch(`/api/mars-delay?enabled=${enabled}`, { method: 'POST' });
    } catch {
      // Ignore
    }
  };

  // Navigation Handlers with instant browser URL synchronization
  const handleOpenTriage = useCallback((astId: string) => {
    const slug = getSlugFromAstronautId(astId);
    setActiveTriageAstronautId(astId);
    setActiveView('HEALTH_TELEMETRY');
    navigateTo(`/telemetry/${slug}`);
  }, []);

  const handleSelectView = useCallback(
    (view: 'HUD' | 'HEALTH_TELEMETRY') => {
      if (view === 'HUD') {
        setActiveView('HUD');
        setActiveTriageAstronautId(null);
        navigateTo('/');
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
    <div style={{ maxWidth: '1250px', margin: '0 auto', padding: '0 20px 32px' }}>
      {/* Flight HUD View (Default Home Page) */}
      {activeView === 'HUD' && (
        <>
          <HeaderBar
            connected={connected}
            marsDelay={marsDelay}
            onToggleMarsDelay={handleToggleMarsDelay}
            activeView={activeView}
            onSelectView={handleSelectView}
            latestAlert={latestAlert}
            selectedAstronautId={activeTriageAstronautId || 'AST-01_COMMANDER'}
          />

          {/* Primary Flight HUD: 4-Row Crew Biometric Telemetry Grid with Inline ECG */}
          <CrewGrid
            telemetryMap={telemetryMap}
            onOpenTriage={handleOpenTriage}
          />

          {/* Benchmark Scenario Jump Controller */}
          <ScenarioController
            currentScenario={currentScenario}
            marsDelay={marsDelay}
            onToggleMarsDelay={handleToggleMarsDelay}
            onScenarioTriggered={(scenarioKey, telemetry) => {
              setCurrentScenario(scenarioKey);
              if (telemetry && Object.keys(telemetry).length > 0) {
                bufferedPacketsRef.current = { ...bufferedPacketsRef.current, ...telemetry };
                setTelemetryMap({ ...bufferedPacketsRef.current });
              }
            }}
          />
        </>
      )}

      {/* Comprehensive Health Telemetry & 10-Category Clinical Analysis Console */}
      {activeView === 'HEALTH_TELEMETRY' && (
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
      )}
    </div>
  );
}

export default App;
