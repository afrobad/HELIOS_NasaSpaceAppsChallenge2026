import React, { useEffect, useState, useRef, useMemo } from 'react';
import { audioService } from '../services/audioService';
import type { AlertPayload } from '../types/telemetry';

interface HeaderBarProps {
  connected: boolean;
  marsDelay?: boolean;
  onToggleMarsDelay?: (enabled: boolean) => void;
  activeView?: 'HUD' | 'HEALTH_TELEMETRY';
  onSelectView?: (view: 'HUD' | 'HEALTH_TELEMETRY') => void;
  latestAlert?: AlertPayload | null;
  selectedAstronautId?: string;
}

const getAstronautName = (id?: string): string => {
  switch (id) {
    case 'AST-01_COMMANDER':
    case 'crew_1':
      return 'Commander Haley';
    case 'AST-02_PILOT':
    case 'crew_2':
      return 'Pilot Chris';
    case 'AST-03_MEDICAL':
    case 'AST-03_MEDICAL_SPECIALIST':
    case 'crew_3':
      return 'Doctor Sian';
    case 'AST-04_ENGINEER':
    case 'AST-04_MISSION_SPECIALIST':
    case 'crew_4':
      return 'Specialist Leo';
    case 'ALL_CREW':
    case 'all_crew':
      return 'All Crew Stations';
    default:
      return 'Commander Haley';
  }
};

const formatChemicalSubscripts = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\bCO2\b/g, 'CO₂')
    .replace(/\bSpO2\b/g, 'SpO₂')
    .replace(/\bO2\b/g, 'O₂')
    .replace(/\bK\+\b/g, 'K⁺');
};

const extractAdviceBody = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^(?:(?:good\s+day|hello|urgent\s+alert|emergency|all\s+stations|all\s+crew\s+stations|all\s+crew)[,\s!:]+)?(?:(?:commander\s+\w+|pilot\s+\w+|doctor\s+\w+|specialist\s+\w+)(?:\s*(?:,|and)\s*(?:commander\s+\w+|pilot\s+\w+|doctor\s+\w+|specialist\s+\w+))*)[,\s!:]+/i, '')
    .trim()
    .toLowerCase();
};

export const HeaderBar: React.FC<HeaderBarProps> = ({
  connected,
  marsDelay: _marsDelay,
  onToggleMarsDelay: _onToggleMarsDelay,
  activeView = 'HUD',
  onSelectView,
  latestAlert,
  selectedAstronautId = 'AST-01_COMMANDER',
}) => {
  const [audioEngaged, setAudioEngaged] = useState<boolean>(true);
  const [metSeconds, setMetSeconds] = useState<number>(14 * 3600 + 43 * 60 + 18);

  // JARVIS in Header State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeSpeech, setActiveSpeech] = useState<string>(
    latestAlert?.speech_text || 'All systems nominal. Sentry telemetry active.'
  );
  const [activeSeverity, setActiveSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL'>(
    latestAlert?.severity || 'NOMINAL'
  );
  const [showJarvisTooltip, setShowJarvisTooltip] = useState<boolean>(false);
  const [queryText, setQueryText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean>(true);

  const isSpeakingRef = useRef<boolean>(false);
  const activeSpeechTextRef = useRef<string>(activeSpeech);
  const pendingObservedAlertRef = useRef<AlertPayload | null>(null);
  const lastSpokenAdviceBodyRef = useRef<string>('');
  const lastSpokenTimestampRef = useRef<number>(0);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeSpeechTextRef.current = activeSpeech;
  }, [activeSpeech]);

  useEffect(() => {
    // Enable audio service and unlock audio context
    audioService.setEngaged(true);
    const unlockAudio = () => {
      audioService.initAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    const timer = setInterval(() => {
      setMetSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll AI status periodically
  useEffect(() => {
    const checkAi = async () => {
      try {
        const res = await fetch('/api/ai/status');
        if (res.ok) {
          const data = await res.json();
          setOllamaOnline(data.ai_engine?.status === 'ONLINE');
        }
      } catch {
        setOllamaOnline(false);
      }
    };
    checkAi();
    const interval = setInterval(checkAi, 20000);
    return () => clearInterval(interval);
  }, []);

  const getMetParts = (totalSec: number) => {
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return {
      day: `T+${d}d`,
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    };
  };

  const priorityTheme = useMemo(() => {
    if (activeSeverity === 'CRITICAL') {
      return {
        color: '#ef4444',
        border: 'rgba(239, 68, 68, 0.18)',
        bg: 'rgba(239, 68, 68, 0.05)',
        innerBg: 'rgba(239, 68, 68, 0.04)',
        badgeBg: 'rgba(239, 68, 68, 0.18)',
        glow: '0 16px 36px -4px rgba(0, 0, 0, 0.9), 0 0 12px -4px rgba(239, 68, 68, 0.12)',
      };
    }
    if (activeSeverity === 'WARNING') {
      return {
        color: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.18)',
        bg: 'rgba(245, 158, 11, 0.05)',
        innerBg: 'rgba(245, 158, 11, 0.04)',
        badgeBg: 'rgba(245, 158, 11, 0.18)',
        glow: '0 16px 36px -4px rgba(0, 0, 0, 0.9), 0 0 12px -4px rgba(245, 158, 11, 0.1)',
      };
    }
    return {
      color: '#22c55e',
      border: 'rgba(34, 197, 94, 0.15)',
      bg: 'rgba(34, 197, 94, 0.03)',
      innerBg: 'rgba(34, 197, 94, 0.03)',
      badgeBg: 'rgba(34, 197, 94, 0.14)',
      glow: '0 16px 36px -4px rgba(0, 0, 0, 0.9)',
    };
  }, [activeSeverity]);

  const handleToggleAudio = () => {
    const next = !audioEngaged;
    audioService.setEngaged(next);
    setAudioEngaged(next);
    if (next) {
      audioService.playTone('chime');
    }
  };

  /**
   * Speak Statement Handler:
   * Queues speech with audioService. Text updates strictly inside onStart
   * to guarantee lockstep audio/text synchronization without premature text flashing.
   */
  const speakStatement = (
    text: string,
    tone: 'klaxon' | 'chime' | 'beep' | 'none' = 'chime',
    config: { severity?: 'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL'; rate?: number; volume?: number } = {}
  ) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const sev = config.severity || 'NOMINAL';

    // Clear any pending dismiss
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    setActiveSeverity(sev);
    lastSpokenAdviceBodyRef.current = extractAdviceBody(cleanText);
    lastSpokenTimestampRef.current = Date.now();

    if (!audioService.getEngaged()) {
      audioService.setEngaged(true);
    }

    audioService.queueSpeech({
      text: cleanText,
      tone,
      config: {
        ...config,
        severity: sev,
      },
      callbacks: {
        onStart: () => {
          // Streaming begins the instant audio begins playing — lockstep sync
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          setActiveSpeech(cleanText);
          activeSpeechTextRef.current = cleanText;
          setShowJarvisTooltip(true);
        },
        onEnd: () => {
          handleSpeechFinished();
        },
      },
    });
  };

  /**
   * When speech ends, evaluate buffered changes or schedule auto-dismiss.
   */
  const handleSpeechFinished = () => {
    isSpeakingRef.current = false;
    setIsSpeaking(false);

    // If new changes were observed & buffered while speaking, play them now after quiet break
    const pending = pendingObservedAlertRef.current;
    if (pending && pending.speech_text) {
      const pendingAdvice = extractAdviceBody(pending.speech_text);
      if (pendingAdvice && pendingAdvice === lastSpokenAdviceBodyRef.current) {
        pendingObservedAlertRef.current = null;
      } else if (pending.speech_text !== activeSpeechTextRef.current) {
        pendingObservedAlertRef.current = null;
        setTimeout(() => {
          if (!isSpeakingRef.current) {
            speakStatement(
              pending.speech_text,
              pending.tone || (pending.severity === 'CRITICAL' ? 'klaxon' : 'chime'),
              {
                ...pending.audio_config,
                severity: pending.severity,
              }
            );
          }
        }, 3500);
        return;
      }
    }

    // Auto-hide tooltip 6 seconds after transmission ends
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    autoDismissTimerRef.current = setTimeout(() => {
      setShowJarvisTooltip(false);
    }, 6000);
  };

  // React to incoming WebSocket alerts
  useEffect(() => {
    if (!latestAlert || !latestAlert.speech_text) return;

    const alertText = latestAlert.speech_text.trim();
    if (!alertText) return;

    // Prevent duplicate triggers of identical text
    if (alertText === activeSpeechTextRef.current) return;

    // Semantic deduplication: if core advice was recently spoken (<8s), ignore without re-triggering
    const incomingAdvice = extractAdviceBody(alertText);
    const timeSinceLastSpoken = Date.now() - lastSpokenTimestampRef.current;
    if (incomingAdvice && incomingAdvice === lastSpokenAdviceBodyRef.current && timeSinceLastSpoken < 8000) {
      return;
    }

    const isEmergency = latestAlert.severity === 'CRITICAL' || latestAlert.severity === 'WARNING';
    const isHigherPriority =
      (latestAlert.severity === 'CRITICAL' && activeSeverity !== 'CRITICAL') ||
      (latestAlert.severity === 'WARNING' && activeSeverity === 'NOMINAL');

    if (isEmergency && (isHigherPriority || !isSpeakingRef.current || activeSeverity === 'NOMINAL')) {
      // PREEMPT IMMEDIATELY: Stop lower-priority speech, sound emergency tone, and deliver emergency directive
      audioService.stopSpeaking();
      pendingObservedAlertRef.current = null;
      speakStatement(
        latestAlert.speech_text,
        latestAlert.tone || (latestAlert.severity === 'CRITICAL' ? 'klaxon' : 'chime'),
        {
          ...latestAlert.audio_config,
          severity: latestAlert.severity,
        }
      );
      return;
    }

    if (isSpeakingRef.current) {
      // Buffer sequential telemetry calculation for playback after current speech completes
      pendingObservedAlertRef.current = latestAlert;
    } else {
      speakStatement(
        latestAlert.speech_text,
        latestAlert.tone || 'chime',
        {
          ...latestAlert.audio_config,
          severity: latestAlert.severity,
        }
      );
    }
  }, [latestAlert, activeSeverity]);

  // Handle Quick Query from JARVIS tooltip
  const handleSendQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryText.trim() || isProcessing) return;

    const query = queryText.trim();
    setQueryText('');
    setIsProcessing(true);

    audioService.stopSpeaking();

    try {
      const res = await fetch('/api/voice/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          astronaut_id: selectedAstronautId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        speakStatement(data.speech_text, 'chime', {
          ...data.audio_config,
          severity: data.severity || 'NOMINAL',
        });
      }
    } catch {
      speakStatement(
        `All systems continue nominal monitoring, ${getAstronautName(selectedAstronautId)}. Proceed with flight protocol.`,
        'chime',
        { severity: 'NOMINAL' }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const targetCrewName = getAstronautName(latestAlert?.astronaut_id || selectedAstronautId);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 0',
        borderBottom: '1px solid #1c1c1c',
        marginBottom: '14px',
        flexWrap: 'wrap',
        gap: '12px',
        position: 'relative',
      }}
    >
      {/* ── LEFT: HERO BRAND LOGO & MINIMAL VIEW SWITCHER ─────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Brand Logo Hero with Solid Look */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 900,
              letterSpacing: '0.12em',
              color: '#ffffff',
              fontFamily: "var(--hud-font-brand, 'Orbitron', system-ui, sans-serif)",
              lineHeight: 1,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
            }}
          >
            HELIOS
          </span>

          {/* Minimal Non-Uppercase Connection Status Beacon */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 7px',
              borderRadius: '9999px',
              backgroundColor: connected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: connected ? '1px solid rgba(34, 197, 94, 0.22)' : '1px solid rgba(239, 68, 68, 0.22)',
              fontSize: '10px',
              fontWeight: 500,
              color: connected ? '#22c55e' : '#ef4444',
              fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: connected ? '#22c55e' : '#ef4444',
                boxShadow: connected ? '0 0 5px rgba(34, 197, 94, 0.6)' : 'none',
              }}
            />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Minimal Hairline Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: '#222222' }} />

        {/* View Switcher: Minimal Non-Uppercase Segmented Control */}
        {onSelectView && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#0e0e0e',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid #1f1f1f',
              gap: '2px',
            }}
          >
            <button
              onClick={() => onSelectView('HUD')}
              style={{
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: activeView === 'HUD' ? 600 : 400,
                borderRadius: '5px',
                border: 'none',
                cursor: 'pointer',
                background: activeView === 'HUD' ? '#222222' : 'transparent',
                color: activeView === 'HUD' ? '#ffffff' : '#737373',
                fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                transition: 'all 0.15s ease',
              }}
            >
              Flight hud
            </button>
            <button
              onClick={() => onSelectView('HEALTH_TELEMETRY')}
              style={{
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: activeView === 'HEALTH_TELEMETRY' ? 600 : 400,
                borderRadius: '5px',
                border: 'none',
                cursor: 'pointer',
                background: activeView === 'HEALTH_TELEMETRY' ? '#222222' : 'transparent',
                color: activeView === 'HEALTH_TELEMETRY' ? '#ffffff' : '#737373',
                fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                transition: 'all 0.15s ease',
              }}
            >
              Health telemetry
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: CONTROLS, ICONS & JARVIS IN HEADER ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* MET Clock with Clear Typographic Hierarchy */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '30px',
            padding: '0 9px',
            background: '#0e0e0e',
            borderRadius: '6px',
            border: '1px solid #222222',
          }}
        >
          <span
            style={{
              fontSize: '9px',
              color: '#ff7700',
              fontWeight: 600,
              letterSpacing: '0.06em',
              background: 'rgba(255, 119, 0, 0.12)',
              padding: '1px 4px',
              borderRadius: '3px',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            MET
          </span>
          <span
            style={{
              fontSize: '10px',
              color: '#6b7280',
              fontWeight: 500,
              letterSpacing: '0.02em',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            {getMetParts(metSeconds).day}
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#f3f4f6',
              fontFamily: "'Tomorrow', sans-serif",
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.02em',
            }}
          >
            {getMetParts(metSeconds).time}
          </span>
        </div>

        {/* Voice Audio Toggle: ICONS ONLY */}
        <button
          onClick={handleToggleAudio}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '30px',
            borderRadius: '6px',
            border: audioEngaged ? '1px solid rgba(255, 119, 0, 0.35)' : '1px solid #222222',
            background: audioEngaged ? 'rgba(255, 119, 0, 0.12)' : '#111111',
            color: audioEngaged ? '#ff7700' : '#666666',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title={audioEngaged ? 'Voice Audio: Active (Click to mute)' : 'Voice Audio: Muted (Click to unmute)'}
        >
          {audioEngaged ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>

        {/* ── JARVIS IN HEADER WITH VISUAL ACTIVE/INACTIVE CONTRAST ──────── */}
        <div style={{ position: 'relative' }}>
          {/* Header Button Pod: Clear Active vs Inactive State */}
          <button
            onClick={() => setShowJarvisTooltip((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '92px',
              height: '30px',
              padding: '0 8px',
              borderRadius: '6px',
              flexShrink: 0,
              boxSizing: 'border-box',
              border: isSpeaking
                ? '1px solid #ff7700'
                : showJarvisTooltip
                ? '1px solid #383838'
                : '1px solid #222222',
              background: isSpeaking
                ? 'rgba(255, 119, 0, 0.18)'
                : showJarvisTooltip
                ? '#161616'
                : '#0e0e0e',
              color: isSpeaking ? '#ff881a' : showJarvisTooltip ? '#e5e5e5' : '#6b7280',
              cursor: 'pointer',
              boxShadow: isSpeaking ? '0 0 12px rgba(255, 119, 0, 0.35)' : 'none',
              transition: 'all 0.15s ease',
            }}
            title={
              isSpeaking
                ? 'JARVIS Transmitting (Click to view transcript)'
                : ollamaOnline
                ? 'JARVIS Standby · Ollama AI Online'
                : 'JARVIS Standby · Ollama Offline'
            }
          >
            {/* Animated Equalizer Bars - Muted dark gray on inactive, vibrant pulsing orange on active */}
            <div
              style={{
                width: '12px',
                height: '14px',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <span
                className={isSpeaking ? 'hud-bar-anim-1' : ''}
                style={{
                  width: '2px',
                  height: '14px',
                  backgroundColor: isSpeaking ? '#ff7700' : '#404040',
                  borderRadius: '1px',
                  transform: isSpeaking ? undefined : 'scaleY(0.25)',
                  transformOrigin: 'bottom',
                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                }}
              />
              <span
                className={isSpeaking ? 'hud-bar-anim-2' : ''}
                style={{
                  width: '2px',
                  height: '14px',
                  backgroundColor: isSpeaking ? '#ff7700' : '#404040',
                  borderRadius: '1px',
                  transform: isSpeaking ? undefined : 'scaleY(0.4)',
                  transformOrigin: 'bottom',
                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                }}
              />
              <span
                className={isSpeaking ? 'hud-bar-anim-3' : ''}
                style={{
                  width: '2px',
                  height: '14px',
                  backgroundColor: isSpeaking ? '#ff7700' : '#404040',
                  borderRadius: '1px',
                  transform: isSpeaking ? undefined : 'scaleY(0.25)',
                  transformOrigin: 'bottom',
                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                }}
              />
            </div>

            {/* Invariant Center Label */}
            <span
              style={{
                fontSize: '11px',
                fontWeight: isSpeaking ? 800 : 600,
                letterSpacing: '0.04em',
                flex: 1,
                textAlign: 'center',
                fontFamily: "'Tomorrow', sans-serif",
                color: isSpeaking ? '#ff881a' : showJarvisTooltip ? '#e5e5e5' : '#6b7280',
              }}
            >
              JARVIS
            </span>

            {/* Invariant Fixed Status Slot */}
            <div
              style={{
                width: '8px',
                height: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: isSpeaking ? '#ff7700' : ollamaOnline ? '#4b5563' : '#262626',
                  boxShadow: isSpeaking ? '0 0 7px #ff7700' : 'none',
                  transition: 'all 0.2s ease',
                }}
              />
            </div>
          </button>

          {/* ── PRIORITY-OUTLINED TRANSMITTING TOOLTIP FROM NAVBAR ────────── */}
          {showJarvisTooltip && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '370px',
                maxWidth: '90vw',
                backgroundColor: '#0c0c0c',
                border: `1px solid ${priorityTheme.border}`,
                borderRadius: '8px',
                padding: '12px',
                boxShadow: priorityTheme.glow,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                animation: 'hudFadeIn 0.18s ease-out',
              }}
            >
              {/* Pointer Arrow */}
              <div
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '26px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#0c0c0c',
                  borderTop: `1px solid ${priorityTheme.border}`,
                  borderLeft: `1px solid ${priorityTheme.border}`,
                  transform: 'rotate(45deg)',
                }}
              />

              {/* Tooltip Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: priorityTheme.color,
                      boxShadow: `0 0 6px ${priorityTheme.color}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      color: priorityTheme.color,
                      textTransform: 'uppercase',
                    }}
                  >
                    JARVIS
                  </span>
                  <span
                    style={{
                      fontSize: '8px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      backgroundColor: priorityTheme.badgeBg,
                      color: priorityTheme.color,
                    }}
                  >
                    {activeSeverity}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Replay Audio Button */}
                  <button
                    onClick={() => {
                      if (activeSpeech) {
                        speakStatement(
                          activeSpeech,
                          activeSeverity === 'CRITICAL' ? 'klaxon' : 'chime',
                          { severity: activeSeverity }
                        );
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#a3a3a3',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                    }}
                    title="Replay Audio"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  </button>

                  {/* Close Dismiss Button */}
                  <button
                    onClick={() => setShowJarvisTooltip(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#737373',
                      cursor: 'pointer',
                      fontSize: '12px',
                      lineHeight: 1,
                      padding: '2px',
                    }}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Message Transcript Text: Minimal tint — no border */}
              <div
                style={{
                  fontSize: '11px',
                  lineHeight: 1.55,
                  color: '#f9fafb',
                  fontWeight: 500,
                  padding: '9px 11px',
                  backgroundColor: priorityTheme.innerBg,
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.04)',                }}
              >
                {formatChemicalSubscripts(activeSpeech)}
              </div>

              {/* Tooltip Footer: Recipient & Quick Ask Input */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ color: '#737373' }}>
                  Target: <strong style={{ color: '#cbd5e1' }}>{targetCrewName}</strong>
                </span>

                <form onSubmit={handleSendQuery} style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    placeholder="Ask JARVIS..."
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    style={{
                      background: '#131313',
                      border: '1px solid #242424',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '9px',
                      padding: '3px 6px',
                      width: '110px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !queryText.trim()}
                    style={{
                      background: '#222222',
                      border: '1px solid #333333',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '9px',
                      padding: '2px 5px',
                      cursor: 'pointer',
                    }}
                  >
                    Ask
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
