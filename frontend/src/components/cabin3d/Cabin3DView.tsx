import React, { useEffect, useRef } from 'react';

export interface Cabin3DViewProps {
  onExit?: () => void;
  telemetryMap?: Record<string, any>;
  latestAlert?: any;
  currentScenario?: string;
  initialAstronautId?: string;
  onOpenTriage?: (astronautId: string) => void;
  onTriggerScenario?: (scenarioKey: string) => void;
  isTourActive?: boolean;
}

export const Cabin3DView: React.FC<Cabin3DViewProps> = ({
  onExit,
  telemetryMap,
  latestAlert,
  currentScenario,
  onTriggerScenario,
  isTourActive = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'HELIOS · ISS DECK';

    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'EXIT_CABIN' || e.data?.type === 'EXIT_CABIN') {
        if (onExit) {
          onExit();
        } else {
          window.location.href = '/';
        }
      } else if (e.data === 'OPEN_SCENARIOS' || e.data?.type === 'OPEN_SCENARIOS') {
        window.dispatchEvent(new CustomEvent('helios:open_scenarios'));
      } else if (e.data?.type === 'TRIGGER_SCENARIO' && e.data.scenario) {
        if (onTriggerScenario) {
          onTriggerScenario(e.data.scenario);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      document.title = prevTitle;
      window.removeEventListener('message', handleMessage);
    };
  }, [onExit, onTriggerScenario]);

  const lastSyncPayloadRef = useRef<string>('');

  // Real-time synchronization of telemetry, alerts, and scenario to cabin iframe (throttled on change)
  useEffect(() => {
    const effScenario = currentScenario || localStorage.getItem('helios_scenario') || 'NOMINAL_CRUISE';
    const serialized = JSON.stringify({ effScenario, alertId: latestAlert?.id, alertSev: latestAlert?.severity });
    if (serialized === lastSyncPayloadRef.current) {
      return;
    }
    lastSyncPayloadRef.current = serialized;

    const payload = {
      type: effScenario === 'NOMINAL_CRUISE' && !latestAlert ? 'NOMINAL_STATE' : 'HELIOS_TELEMETRY_SYNC',
      telemetryMap,
      latestAlert,
      scenario: effScenario,
      fromCabin: true,
    };

    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(payload, '*');
      } catch {}
    }
  }, [telemetryMap, latestAlert, currentScenario]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        backgroundColor: '#020408',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
      }}
    >
      <iframe
        ref={iframeRef}
        src="/cabin/index.html"
        title="HELIOS 3D CABIN"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="autoplay; fullscreen; pointer-lock"
      />
    </div>
  );
};

export default Cabin3DView;
