import React, { useState, useEffect, useMemo } from 'react';

export type LinkState = 'NOMINAL' | 'DEGRADED' | 'FAILED';

export interface QueuedMessage {
  id: string;
  timestamp: string;
  priority: 'EMERGENCY' | 'OPERATIONAL' | 'ROUTINE';
  sender: string;
  recipient: string;
  content: string;
  sizeKb: number;
  status: 'QUEUED' | 'TRANSMITTING' | 'DELIVERED';
}

const T = {
  bg: '#06080a',
  surface: '#0b0e12',
  surfaceAlt: '#0e1318',
  border: '#1a232e',
  borderSubtle: '#141c24',
  textPrimary: '#e2e8f0',
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
  cyan: '#06b6d4',
  cyanBorder: 'rgba(6, 182, 212, 0.4)',
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'Inter', -apple-system, sans-serif",
};

interface Props {
  distancePreset?: string;
  onBlackoutChange?: (isBlackout: boolean) => void;
}

export const IssCommunicationSimulator: React.FC<Props> = ({ distancePreset = 'LEO', onBlackoutChange }) => {
  // Independent Link Fault Controls (Decoupled according to iss_contact.md)
  const [tdrsState, setTdrsState] = useState<LinkState>('NOMINAL');
  const [sBandState, setSBandState] = useState<LinkState>('NOMINAL');
  const [kuBandState, setKuBandState] = useState<LinkState>('NOMINAL');
  const [groundStationState, setGroundStationState] = useState<LinkState>('NOMINAL');
  const [activeTdrsSatellite, setActiveTdrsSatellite] = useState<'TDRS-12 (East)' | 'TDRS-10 (West)' | 'TDRS-11 (Z)'>('TDRS-12 (East)');
  const [autoFailoverActive, setAutoFailoverActive] = useState(true);

  // Store-and-Forward Message Queue State
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([
    {
      id: 'MSG-001',
      timestamp: '12:44:10',
      priority: 'OPERATIONAL',
      sender: 'CDR Haley (ISS)',
      recipient: 'CAPCOM (JSC MCC)',
      content: 'Routine daily check-in completed. Water recovery assembly loop B cycle nominal.',
      sizeKb: 14,
      status: 'DELIVERED',
    },
    {
      id: 'MSG-002',
      timestamp: '12:44:18',
      priority: 'ROUTINE',
      sender: 'PLT Chris (ISS)',
      recipient: 'Flight Dynamics (MCC)',
      content: 'Columbus payload rack telemetry sync packet verified.',
      sizeKb: 38,
      status: 'DELIVERED',
    },
  ]);

  const [newMessageText, setNewMessageText] = useState('');
  const [newPriority, setNewPriority] = useState<'EMERGENCY' | 'OPERATIONAL' | 'ROUTINE'>('OPERATIONAL');

  // Compute overall communication status
  const isFullBlackout = useMemo(() => {
    // Total blackout occurs only if all paths are simultaneously severed
    const spaceToGroundLost = tdrsState === 'FAILED' || groundStationState === 'FAILED';
    const allBandsLost = sBandState === 'FAILED' && kuBandState === 'FAILED';
    return (spaceToGroundLost && sBandState === 'FAILED') || (tdrsState === 'FAILED' && kuBandState === 'FAILED' && sBandState === 'FAILED') || allBandsLost;
  }, [tdrsState, sBandState, kuBandState, groundStationState]);

  useEffect(() => {
    onBlackoutChange?.(isFullBlackout);
  }, [isFullBlackout, onBlackoutChange]);

  // Decoupled Subsystem States according to iss_contact.md
  const voiceServiceStatus = useMemo(() => {
    if (sBandState === 'NOMINAL' && tdrsState !== 'FAILED' && groundStationState !== 'FAILED') {
      return { status: 'ONLINE', path: `${activeTdrsSatellite} S-band Primary`, color: T.nominal };
    }
    if (sBandState === 'DEGRADED') {
      return { status: 'DEGRADED', path: 'S-band High-Jitter (Low Rate 96 kbps)', color: T.warning };
    }
    if (sBandState === 'FAILED') {
      // S-band failed, but Ku-band or Russian Service Module VHF may still work
      if (tdrsState !== 'FAILED') {
        return { status: 'BACKUP VHF', path: 'Russian Service Module VHF-2 Relay', color: T.warning };
      }
      return { status: 'DISCONNECTED', path: 'Autonomous Onboard Audio Loop (Sentry Svc Active)', color: T.critical };
    }
    if (tdrsState === 'FAILED' || groundStationState === 'FAILED') {
      return { status: 'QUEUED', path: 'Store-and-Forward Emergency Audio Buffer', color: T.warning };
    }
    return { status: 'OFFLINE', path: 'LOS (Loss of Signal)', color: T.critical };
  }, [sBandState, tdrsState, groundStationState, activeTdrsSatellite]);

  const telemetryServiceStatus = useMemo(() => {
    if (sBandState === 'NOMINAL' && tdrsState !== 'FAILED' && groundStationState !== 'FAILED') {
      return { status: 'STREAMING 10 Hz', rate: '192 kbps', color: T.nominal };
    }
    if (sBandState === 'DEGRADED' || tdrsState === 'DEGRADED') {
      return { status: 'BUFFERED 1 Hz', rate: '24 kbps', color: T.warning };
    }
    return { status: 'LOCAL WAL LOG ONLY', rate: '0 kbps uplink', color: T.critical };
  }, [sBandState, tdrsState, groundStationState]);

  const videoServiceStatus = useMemo(() => {
    if (kuBandState === 'NOMINAL' && tdrsState !== 'FAILED' && groundStationState !== 'FAILED') {
      return { status: 'HD LIVE 60 FPS', rate: '300 Mbps SGANT', color: T.nominal };
    }
    if (kuBandState === 'DEGRADED') {
      return { status: 'SD STREAM 15 FPS', rate: '25 Mbps SGANT', color: T.warning };
    }
    if (kuBandState === 'FAILED') {
      return { status: 'OFFLINE (S-band unaffected)', rate: '0 Mbps', color: T.critical };
    }
    return { status: 'PAUSED (Link LOS)', rate: '0 Mbps', color: T.critical };
  }, [kuBandState, tdrsState, groundStationState]);

  // Autonomous TDRS Failover simulation
  useEffect(() => {
    if (tdrsState === 'FAILED' && autoFailoverActive) {
      const timer = setTimeout(() => {
        if (activeTdrsSatellite === 'TDRS-12 (East)') {
          setActiveTdrsSatellite('TDRS-10 (West)');
          setTdrsState('DEGRADED');
        } else {
          setActiveTdrsSatellite('TDRS-11 (Z)');
          setTdrsState('DEGRADED');
        }
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [tdrsState, autoFailoverActive, activeTdrsSatellite]);

  // Automatic message transmission when link is restored
  useEffect(() => {
    const canTransmit = sBandState !== 'FAILED' && tdrsState !== 'FAILED' && groundStationState !== 'FAILED';
    if (canTransmit) {
      const hasQueued = messageQueue.some((m) => m.status === 'QUEUED');
      if (hasQueued) {
        const timer = setTimeout(() => {
          setMessageQueue((prev) =>
            prev.map((msg) => (msg.status === 'QUEUED' ? { ...msg, status: 'DELIVERED' } : msg))
          );
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [sBandState, tdrsState, groundStationState, messageQueue]);

  const handleSendMessage = () => {
    if (!newMessageText.trim()) return;
    const canDeliverNow = sBandState !== 'FAILED' && tdrsState !== 'FAILED' && groundStationState !== 'FAILED';
    const newMsg: QueuedMessage = {
      id: `MSG-${String(messageQueue.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      priority: newPriority,
      sender: 'CDR Haley (ISS CM-02)',
      recipient: 'CAPCOM / Flight Surgeon (MCC Houston)',
      content: newMessageText.trim(),
      sizeKb: Math.round(12 + Math.random() * 20),
      status: canDeliverNow ? 'DELIVERED' : 'QUEUED',
    };
    setMessageQueue((prev) => [newMsg, ...prev]);
    setNewMessageText('');
  };

  const setPreset = (preset: 'ALL_NOMINAL' | 'KU_FAIL' | 'S_FAIL' | 'TDRS_LOS' | 'TOTAL_BLACKOUT') => {
    if (preset === 'ALL_NOMINAL') {
      setTdrsState('NOMINAL');
      setSBandState('NOMINAL');
      setKuBandState('NOMINAL');
      setGroundStationState('NOMINAL');
    } else if (preset === 'KU_FAIL') {
      setTdrsState('NOMINAL');
      setSBandState('NOMINAL');
      setKuBandState('FAILED');
      setGroundStationState('NOMINAL');
    } else if (preset === 'S_FAIL') {
      setTdrsState('NOMINAL');
      setSBandState('FAILED');
      setKuBandState('NOMINAL');
      setGroundStationState('NOMINAL');
    } else if (preset === 'TDRS_LOS') {
      setTdrsState('FAILED');
      setSBandState('NOMINAL');
      setKuBandState('NOMINAL');
      setGroundStationState('NOMINAL');
    } else if (preset === 'TOTAL_BLACKOUT') {
      setTdrsState('FAILED');
      setSBandState('FAILED');
      setKuBandState('FAILED');
      setGroundStationState('FAILED');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header & Overview Bar */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${isFullBlackout ? T.criticalBorder : T.border}`,
          borderRadius: 6,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
                backgroundColor: isFullBlackout ? T.critical : T.nominal,
                boxShadow: `0 0 8px ${isFullBlackout ? T.critical : T.nominal}`,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.04em' }}>
              ISS COMMUNICATION RESILIENCE SIMULATOR · NASA SPACE NETWORK (SN)
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: isFullBlackout ? T.critical : T.nominal,
                background: isFullBlackout ? T.criticalBg : T.nominalBg,
                border: `1px solid ${isFullBlackout ? T.criticalBorder : T.nominalBorder}`,
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              {isFullBlackout ? 'CONTINGENCY: TOTAL COMMS BLACKOUT' : 'SPACE NETWORK ACTIVE'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
            Ground Truth Ground-to-Orbit Architecture (Source: <code style={{ color: T.cyan, fontFamily: T.mono }}>iss_contact.md</code>).
            Decoupled radio paths prevent false link coupling: Ku-band high-rate failure does not disrupt S-band voice loops.
          </div>
        </div>

        {/* Quick Fault Injection Presets */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setPreset('ALL_NOMINAL')}
            style={{
              background: '#09120e',
              border: `1px solid ${T.nominalBorder}`,
              borderRadius: 4,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 600,
              color: T.nominal,
              cursor: 'pointer',
            }}
          >
            All Nominal
          </button>
          <button
            onClick={() => setPreset('KU_FAIL')}
            style={{
              background: '#120d09',
              border: `1px solid ${T.warningBorder}`,
              borderRadius: 4,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 600,
              color: T.warning,
              cursor: 'pointer',
            }}
            title="Loss of Ku-band high-rate video; S-band voice & telemetry remain 100% active"
          >
            Ku-Band Loss
          </button>
          <button
            onClick={() => setPreset('S_FAIL')}
            style={{
              background: '#120d09',
              border: `1px solid ${T.warningBorder}`,
              borderRadius: 4,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 600,
              color: T.warning,
              cursor: 'pointer',
            }}
            title="Loss of S-band primary transceiver; Ku-band video stays online, voice fails over to Russian VHF"
          >
            S-Band Loss
          </button>
          <button
            onClick={() => setPreset('TDRS_LOS')}
            style={{
              background: '#140c0c',
              border: `1px solid ${T.criticalBorder}`,
              borderRadius: 4,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 600,
              color: '#f87171',
              cursor: 'pointer',
            }}
            title="TDRS satellite handover anomaly or loss of line-of-sight"
          >
            TDRS LOS
          </button>
          <button
            onClick={() => setPreset('TOTAL_BLACKOUT')}
            style={{
              background: '#1f0d0d',
              border: `1px solid #ef4444`,
              borderRadius: 4,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
            }}
            title="Simultaneous failure across all space and ground segments"
          >
            Full Blackout
          </button>
        </div>
      </div>

      {/* Grid: Link Controls + Service Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 14 }}>
        {/* Independent Link Controls */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.04em', marginBottom: 10 }}>
            INDEPENDENT LINK STATUS & FAULT INJECTION
          </div>

          {/* TDRS Relay */}
          <div style={{ borderBottom: `1px solid ${T.borderSubtle}`, paddingBottom: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>
                  1. TDRS Satellite Relay Path
                </div>
                <div style={{ fontSize: 9, color: T.textMuted }}>
                  Active Node: <span style={{ color: T.cyan, fontFamily: T.mono }}>{activeTdrsSatellite}</span> (35,786 km GEO)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['NOMINAL', 'DEGRADED', 'FAILED'] as LinkState[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTdrsState(st)}
                    style={{
                      background: tdrsState === st ? (st === 'NOMINAL' ? T.nominalBg : st === 'DEGRADED' ? T.warningBg : T.criticalBg) : '#090c0f',
                      border: `1px solid ${tdrsState === st ? (st === 'NOMINAL' ? T.nominalBorder : st === 'DEGRADED' ? T.warningBorder : T.criticalBorder) : T.borderSubtle}`,
                      color: tdrsState === st ? (st === 'NOMINAL' ? T.nominal : st === 'DEGRADED' ? T.warning : T.critical) : T.textMuted,
                      borderRadius: 3,
                      padding: '2px 8px',
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            {tdrsState === 'FAILED' && autoFailoverActive && (
              <div style={{ fontSize: 9, color: T.warning, marginTop: 4, fontFamily: T.mono }}>
                ⚡ Auto-failover sequence armed: Searching alternate orbital TDRS slot...
              </div>
            )}
          </div>

          {/* S-band Radio */}
          <div style={{ borderBottom: `1px solid ${T.borderSubtle}`, paddingBottom: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>
                  2. S-band Radio (Voice & 10 Hz Telemetry)
                </div>
                <div style={{ fontSize: 9, color: T.textMuted }}>
                  Primary Transceiver · 192 kbps digital bi-directional loop
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['NOMINAL', 'DEGRADED', 'FAILED'] as LinkState[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setSBandState(st)}
                    style={{
                      background: sBandState === st ? (st === 'NOMINAL' ? T.nominalBg : st === 'DEGRADED' ? T.warningBg : T.criticalBg) : '#090c0f',
                      border: `1px solid ${sBandState === st ? (st === 'NOMINAL' ? T.nominalBorder : st === 'DEGRADED' ? T.warningBorder : T.criticalBorder) : T.borderSubtle}`,
                      color: sBandState === st ? (st === 'NOMINAL' ? T.nominal : st === 'DEGRADED' ? T.warning : T.critical) : T.textMuted,
                      borderRadius: 3,
                      padding: '2px 8px',
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            {sBandState === 'FAILED' && (
              <div style={{ fontSize: 9, color: T.warning, marginTop: 4, fontFamily: T.mono }}>
                ℹ️ Failover routing active: Voice switched to Russian Service Module VHF-2 backup loop.
              </div>
            )}
          </div>

          {/* Ku-band SGANT */}
          <div style={{ borderBottom: `1px solid ${T.borderSubtle}`, paddingBottom: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>
                  3. Ku-band Space-to-Ground (SGANT)
                </div>
                <div style={{ fontSize: 9, color: T.textMuted }}>
                  High-Rate Data · 300 Mbps Downlink (HD Video, Payloads, Web)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['NOMINAL', 'DEGRADED', 'FAILED'] as LinkState[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setKuBandState(st)}
                    style={{
                      background: kuBandState === st ? (st === 'NOMINAL' ? T.nominalBg : st === 'DEGRADED' ? T.warningBg : T.criticalBg) : '#090c0f',
                      border: `1px solid ${kuBandState === st ? (st === 'NOMINAL' ? T.nominalBorder : st === 'DEGRADED' ? T.warningBorder : T.criticalBorder) : T.borderSubtle}`,
                      color: kuBandState === st ? (st === 'NOMINAL' ? T.nominal : st === 'DEGRADED' ? T.warning : T.critical) : T.textMuted,
                      borderRadius: 3,
                      padding: '2px 8px',
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ground Station Relay */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textPrimary }}>
                  4. Ground Terminals (White Sands / Guam)
                </div>
                <div style={{ fontSize: 9, color: T.textMuted }}>
                  NASA Space Network Complex · Terrestrial Fiber to JSC MCC
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['NOMINAL', 'DEGRADED', 'FAILED'] as LinkState[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setGroundStationState(st)}
                    style={{
                      background: groundStationState === st ? (st === 'NOMINAL' ? T.nominalBg : st === 'DEGRADED' ? T.warningBg : T.criticalBg) : '#090c0f',
                      border: `1px solid ${groundStationState === st ? (st === 'NOMINAL' ? T.nominalBorder : st === 'DEGRADED' ? T.warningBorder : T.criticalBorder) : T.borderSubtle}`,
                      color: groundStationState === st ? (st === 'NOMINAL' ? T.nominal : st === 'DEGRADED' ? T.warning : T.critical) : T.textMuted,
                      borderRadius: 3,
                      padding: '2px 8px',
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Service Availability Matrix */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.04em', marginBottom: 10 }}>
            DECOUPLED SERVICE AVAILABILITY MATRIX
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {/* Voice Service */}
            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px' }}>
              <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Operational Voice Loops
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: voiceServiceStatus.color, marginTop: 4, fontFamily: T.mono }}>
                {voiceServiceStatus.status}
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2 }}>
                Active Route: {voiceServiceStatus.path}
              </div>
            </div>

            {/* Health Telemetry */}
            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px' }}>
              <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Continuous Health Telemetry
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: telemetryServiceStatus.color, marginTop: 4, fontFamily: T.mono }}>
                {telemetryServiceStatus.status}
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2 }}>
                Downlink Cadence: {telemetryServiceStatus.rate}
              </div>
            </div>

            {/* HD Video */}
            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px' }}>
              <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                HD Crew Video & Telemedicine
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: videoServiceStatus.color, marginTop: 4, fontFamily: T.mono }}>
                {videoServiceStatus.status}
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2 }}>
                Ku SGANT Bandwidth: {videoServiceStatus.rate}
              </div>
            </div>

            {/* Store & Forward Queue */}
            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.borderSubtle}`, borderRadius: 4, padding: '10px' }}>
              <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Store-and-Forward Buffer
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: messageQueue.some((m) => m.status === 'QUEUED') ? T.warning : T.nominal, marginTop: 4, fontFamily: T.mono }}>
                {messageQueue.filter((m) => m.status === 'QUEUED').length} PACKETS PENDING
              </div>
              <div style={{ fontSize: 9, color: T.textSecondary, marginTop: 2 }}>
                Local Retransmit: {messageQueue.some((m) => m.status === 'QUEUED') ? 'Queued (Auto-flush on signal lock)' : 'All Delivered'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 12, lineHeight: 1.4 }}>
            Ground Station Architecture Note: As documented in <strong style={{ color: T.textSecondary }}>iss_contact.md</strong>, S-band and Ku-band operate over independent transponders. A transmitter failure on Ku-band disables high-bandwidth payload video, but Mission Control maintains uninterrupted audio contact and vital telemetry over S-band.
          </div>
        </div>
      </div>

      {/* Store-and-Forward Message Terminal */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.04em' }}>
            STORE-AND-FORWARD EMERGENCY & OPERATIONAL MESSAGE LOG
          </div>
          <span style={{ fontSize: 9, color: T.textMuted, fontFamily: T.mono }}>
            BUFFER RETENTION: 100% PERSISTENT (SQLite WAL BACKED)
          </span>
        </div>

        {/* Input box */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as any)}
            style={{
              background: '#090c0f',
              border: `1px solid ${T.borderSubtle}`,
              color: newPriority === 'EMERGENCY' ? T.critical : newPriority === 'OPERATIONAL' ? T.warning : T.cyan,
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              padding: '6px 8px',
              fontFamily: T.mono,
            }}
          >
            <option value="OPERATIONAL">OPERATIONAL (P2)</option>
            <option value="EMERGENCY">EMERGENCY (P1)</option>
            <option value="ROUTINE">ROUTINE (P3)</option>
          </select>

          <input
            type="text"
            placeholder="Type flight dispatch or crew medical report to queue..."
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            style={{
              flex: 1,
              background: '#090c0f',
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: 4,
              padding: '6px 12px',
              color: T.textPrimary,
              fontSize: 11,
              fontFamily: T.sans,
              outline: 'none',
            }}
          />

          <button
            onClick={handleSendMessage}
            style={{
              background: 'rgba(56, 189, 248, 0.20)',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              borderRadius: 4,
              padding: '6px 16px',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            DISPATCH
          </button>
        </div>

        {/* Message List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
          {messageQueue.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: T.surfaceAlt,
                border: `1px solid ${T.borderSubtle}`,
                borderRadius: 4,
                fontSize: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: msg.priority === 'EMERGENCY' ? T.critical : msg.priority === 'OPERATIONAL' ? T.warning : T.cyan,
                    background: '#090c0f',
                    border: `1px solid ${msg.priority === 'EMERGENCY' ? T.criticalBorder : msg.priority === 'OPERATIONAL' ? T.warningBorder : T.cyanBorder}`,
                    borderRadius: 3,
                    padding: '1px 5px',
                    fontFamily: T.mono,
                  }}
                >
                  {msg.priority}
                </span>
                <span style={{ color: T.textMuted, fontFamily: T.mono }}>{msg.timestamp}</span>
                <span style={{ color: T.textSecondary, fontWeight: 600 }}>{msg.sender} → {msg.recipient}:</span>
                <span style={{ color: T.textPrimary }}>{msg.content}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: T.textMuted, fontFamily: T.mono }}>{msg.sizeKb} KB</span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: msg.status === 'DELIVERED' ? T.nominal : T.warning,
                    fontFamily: T.mono,
                  }}
                >
                  {msg.status === 'DELIVERED' ? '✓ DELIVERED' : '⏳ QUEUED IN BUFFER'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

