import React, { useEffect, useState, useRef, useMemo } from 'react';
import { audioService } from '../services/audioService';
import type { AlertPayload } from '../types/telemetry';

interface HeaderBarProps {
  connected: boolean;
  marsDelay?: boolean;
  onToggleMarsDelay?: (enabled: boolean) => void;
  activeView?: 'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER';
  onSelectView?: (view: 'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER') => void;
  latestAlert?: AlertPayload | null;
  selectedAstronautId?: string;
  /** When true, renders ONLY the fixed bottom JARVIS bar — no top navbar */
  jarvisOnly?: boolean;
}

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
  selectedAstronautId: _selectedAstronautId = 'AST-01_COMMANDER',
  jarvisOnly = false,
}) => {
  const [audioEngaged, setAudioEngaged] = useState<boolean>(true);
  const [metSeconds, setMetSeconds] = useState<number>(14 * 3600 + 43 * 60 + 18);
  const [utcTime, setUtcTime] = useState<string>(() => new Date().toISOString().substring(11, 19) + ' UTC');

  // JARVIS in Header State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [activeSpeech, setActiveSpeech] = useState<string>(
    latestAlert?.speech_text || 'All systems nominal. Sentry telemetry active.'
  );
  const [activeSeverity, setActiveSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL'>(
    latestAlert?.severity || 'NOMINAL'
  );
  const [displayedWordCount, setDisplayedWordCount] = useState<number>(0);

  const isSpeakingRef = useRef<boolean>(false);
  const activeSpeechTextRef = useRef<string>(activeSpeech);
  const pendingObservedAlertRef = useRef<AlertPayload | null>(null);
  const lastSpokenAdviceBodyRef = useRef<string>('');
  const lastSpokenTimestampRef = useRef<number>(0);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechWords = useMemo(() => {
    return activeSpeech.split(/\s+/).filter(Boolean);
  }, [activeSpeech]);
  const speechWordsRef = useRef<string[]>(speechWords);

  useEffect(() => {
    speechWordsRef.current = speechWords;
  }, [speechWords]);

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
      setUtcTime(new Date().toISOString().substring(11, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
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

  const transmissionTheme = useMemo(() => {
    if (activeSeverity === 'CRITICAL') {
      return {
        bg: 'linear-gradient(90deg, rgba(225, 29, 72, 0.22) 0%, rgba(159, 18, 57, 0.14) 100%)',
        border: '1px solid rgba(244, 63, 94, 0.55)',
        glow: '0 4px 16px rgba(0, 0, 0, 0.65), 0 0 1px rgba(244, 63, 94, 0.35)',
        accentColor: '#f43f5e',
        textColor: '#cbd5e1',
        latestWordColor: '#ffffff',
        iconSrc: '/icons/critical.png',
        iconAlt: 'Critical Severity Alert',
      };
    }
    if (activeSeverity === 'WARNING') {
      return {
        bg: 'linear-gradient(90deg, rgba(245, 158, 11, 0.22) 0%, rgba(180, 83, 9, 0.14) 100%)',
        border: '1px solid rgba(251, 191, 36, 0.55)',
        glow: '0 4px 16px rgba(0, 0, 0, 0.65), 0 0 1px rgba(251, 191, 36, 0.35)',
        accentColor: '#fbbf24',
        textColor: '#cbd5e1',
        latestWordColor: '#ffffff',
        iconSrc: '/icons/warning.png',
        iconAlt: 'Warning Severity Alert',
      };
    }
    // NOMINAL / INFO
    return {
      bg: 'linear-gradient(90deg, rgba(14, 165, 233, 0.20) 0%, rgba(3, 105, 161, 0.12) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.5)',
      glow: '0 4px 16px rgba(0, 0, 0, 0.65), 0 0 1px rgba(56, 189, 248, 0.3)',
      accentColor: '#38bdf8',
      textColor: '#cbd5e1',
      latestWordColor: '#ffffff',
      iconSrc: '/icons/heartbeat_blue.png',
      iconAlt: 'Nominal Baseline Transmission',
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
          // Streaming begins the exact instant audio begins playing — lockstep sync
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          setIsTransmitting(true);
          setActiveSpeech(cleanText);
          activeSpeechTextRef.current = cleanText;

          const words = cleanText.split(/\s+/).filter(Boolean);
          speechWordsRef.current = words;
          setDisplayedWordCount(1);
        },
        onWord: (_wordIndex: number, progress?: number) => {
          const total = speechWordsRef.current.length;
          if (typeof progress === 'number' && progress >= 0) {
            const targetCount = Math.min(total, Math.max(1, Math.ceil(progress * total)));
            setDisplayedWordCount((prev) => Math.max(prev, targetCount));
          } else {
            setDisplayedWordCount((prev) => Math.min(total, Math.max(prev, _wordIndex + 1)));
          }
        },
        onEnd: () => {
          const totalWords = activeSpeechTextRef.current.split(/\s+/).filter(Boolean).length;
          setDisplayedWordCount(totalWords);
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

    // Keep transmission navbar readable after transmission ends (12 seconds)
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    autoDismissTimerRef.current = setTimeout(() => {
      setIsTransmitting(false);
    }, 12000);
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


  // ── JARVIS FIXED BOTTOM BAR (shared across HUD and Telemetry views) ──
  const jarvisBar = (
    <div
      className="jarvis-transmission-navbar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        // Slide up from below when transmitting, slide back down when not
        transform: isTransmitting ? 'translateY(0)' : 'translateY(calc(100% + 2px))',
        transition: 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s ease',
        opacity: isTransmitting ? 1 : 0,
        pointerEvents: isTransmitting ? 'auto' : 'none',
        background: '#07080b',
        borderTop: `2px solid ${transmissionTheme.accentColor}`,
        boxShadow: `0 -4px 32px rgba(0, 0, 0, 0.85), 0 -1px 0 rgba(255,255,255,0.04), inset 0 1px 0 ${transmissionTheme.accentColor}22`,
        boxSizing: 'border-box',
      }}
    >
      {/* Inner container: same maxWidth and padding as main content area */}
      <div
        style={{
          maxWidth: '1250px',
          margin: '0 auto',
          padding: '0 20px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* PINNED LEFT: Severity Icon + JARVIS Label + Audio Bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 14px 0 0',
            borderRight: 'rgba(255, 255, 255, 0.08) 1px solid',
            flexShrink: 0,
          }}
        >
          <img
            src={transmissionTheme.iconSrc}
            alt={transmissionTheme.iconAlt}
            style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.7))' }}
          />
          <span
            style={{
              fontFamily: "'Orbitron', var(--hud-font-brand, system-ui, sans-serif)",
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.14em',
              color: transmissionTheme.accentColor,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            JARVIS
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px', width: '14px', flexShrink: 0 }}>
            {(['hud-bar-anim-1', 'hud-bar-anim-2', 'hud-bar-anim-3'] as const).map((cls, i) => (
              <span
                key={i}
                className={isSpeaking ? cls : ''}
                style={{
                  width: '2px',
                  height: '14px',
                  backgroundColor: transmissionTheme.accentColor,
                  borderRadius: '1px',
                  transform: isSpeaking ? undefined : `scaleY(${i === 1 ? 0.5 : 0.25})`,
                  transformOrigin: 'bottom',
                  transition: 'transform 0.2s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* MIDDLE: Streaming AI telemetry text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '5px',
            flex: 1,
            minWidth: 0,
            padding: '6px 14px',
            backgroundColor: '#0c0d10',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '6px',
            boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.7)',
            height: '38px',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {speechWords.slice(0, displayedWordCount).map((word, idx) => {
            const isLatest = isSpeaking && idx === displayedWordCount - 1;
            return (
              <span
                key={`${idx}-${word}`}
                className="jarvis-word-item"
                style={{
                  color: isLatest ? transmissionTheme.latestWordColor : transmissionTheme.textColor,
                  fontFamily: "var(--hud-font-mono, 'Tomorrow', monospace)",
                  fontSize: '12px',
                  fontWeight: isLatest ? 700 : 500,
                  letterSpacing: '0.02em',
                  textShadow: isLatest ? `0 0 10px ${transmissionTheme.accentColor}` : 'none',
                  transition: 'color 0.15s ease, text-shadow 0.15s ease',
                }}
              >
                {formatChemicalSubscripts(word)}
              </span>
            );
          })}
          {isSpeaking && (
            <span
              className="jarvis-pulse-cursor"
              style={{
                display: 'inline-block',
                width: '6px',
                height: '13px',
                backgroundColor: transmissionTheme.accentColor,
                borderRadius: '1px',
                marginLeft: '2px',
                boxShadow: `0 0 8px ${transmissionTheme.accentColor}`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  // When jarvisOnly: skip the top nav, return only the fixed JARVIS bar
  if (jarvisOnly) {
    return jarvisBar;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* ── MAIN TOP NAVBAR CONTAINER ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 0',
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
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'transparent',
              border: connected ? '1px solid rgba(34, 197, 94, 0.32)' : '1px solid rgba(239, 68, 68, 0.32)',
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
                boxShadow: connected ? '0 0 6px rgba(34, 197, 94, 0.7)' : 'none',
              }}
            />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Minimal Hairline Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: '#222222' }} />

        {/* Navigation Items: Dashboard & Health-Telemetry (Replaces Pill Switch) */}
        {onSelectView && (
          <nav
            aria-label="Main Navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => onSelectView('HUD')}
              style={{
                position: 'relative',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: activeView === 'HUD' ? 600 : 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeView === 'HUD' ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                color: activeView === 'HUD' ? '#ffffff' : '#888888',
                fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'HUD') {
                  e.currentTarget.style.color = '#e5e7eb';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'HUD') {
                  e.currentTarget.style.color = '#888888';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              Dashboard
              {activeView === 'HUD' && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    left: '10px',
                    right: '10px',
                    height: '2px',
                    background: 'linear-gradient(90deg, #ff7700, #ff9933)',
                    borderRadius: '2px',
                    boxShadow: '0 0 6px rgba(255, 119, 0, 0.6)',
                  }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectView('HEALTH_TELEMETRY')}
              style={{
                position: 'relative',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: activeView === 'HEALTH_TELEMETRY' ? 600 : 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeView === 'HEALTH_TELEMETRY' ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                color: activeView === 'HEALTH_TELEMETRY' ? '#ffffff' : '#888888',
                fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'HEALTH_TELEMETRY') {
                  e.currentTarget.style.color = '#e5e7eb';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'HEALTH_TELEMETRY') {
                  e.currentTarget.style.color = '#888888';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              Health-Telemetry
              {activeView === 'HEALTH_TELEMETRY' && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    left: '10px',
                    right: '10px',
                    height: '2px',
                    background: 'linear-gradient(90deg, #ff7700, #ff9933)',
                    borderRadius: '2px',
                    boxShadow: '0 0 6px rgba(255, 119, 0, 0.6)',
                  }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectView('MCC')}
              style={{
                position: 'relative',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: activeView === 'MCC' ? 600 : 500,
                borderRadius: '6px',
                border: activeView === 'MCC' ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid transparent',
                cursor: 'pointer',
                background: activeView === 'MCC' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: activeView === 'MCC' ? '#ffffff' : '#888888',
                fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'MCC') {
                  e.currentTarget.style.color = '#e5e7eb';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'MCC') {
                  e.currentTarget.style.color = '#888888';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              Earth MCC
              {activeView === 'MCC' && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    left: '10px',
                    right: '10px',
                    height: '2px',
                    background: 'linear-gradient(90deg, #64748b, #94a3b8)',
                    borderRadius: '2px',
                    boxShadow: '0 0 6px rgba(148, 163, 184, 0.5)',
                  }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectView('SCANNER')}
              style={{
                position: 'relative',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: activeView === 'SCANNER' ? 700 : 500,
                borderRadius: '6px',
                border: activeView === 'SCANNER' ? '1px solid #00e5ff' : '1px solid rgba(0, 229, 255, 0.28)',
                cursor: 'pointer',
                background: activeView === 'SCANNER' ? 'rgba(0, 229, 255, 0.16)' : 'rgba(0, 229, 255, 0.06)',
                color: activeView === 'SCANNER' ? '#00e5ff' : '#67e8f9',
                fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'SCANNER') {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)';
                  e.currentTarget.style.borderColor = '#00e5ff';
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'SCANNER') {
                  e.currentTarget.style.color = '#67e8f9';
                  e.currentTarget.style.background = 'rgba(0, 229, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.28)';
                }
              }}
            >
              <span style={{ fontSize: '12px', filter: 'drop-shadow(0 0 4px #00e5ff)' }}>⚡</span>
              <span>3D Hologram</span>
              {activeView === 'SCANNER' && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    left: '10px',
                    right: '10px',
                    height: '2px',
                    background: 'linear-gradient(90deg, #00e5ff, #38bdf8)',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px rgba(0, 229, 255, 0.9)',
                  }}
                />
              )}
            </button>
          </nav>
        )}

        {/* MCC Sentry Console Badge (displayed in navbar on MCC page) */}
        {activeView === 'MCC' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 9px',
              borderRadius: '4px',
              background: '#0b0e11',
              border: '1px solid #1f2732',
              fontSize: '10px',
              fontFamily: "var(--hud-font-sans, 'Tomorrow', sans-serif)",
              letterSpacing: '0.04em',
              color: '#8da0b3',
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#529642', boxShadow: '0 0 5px rgba(82, 150, 66, 0.6)' }} />
            <span style={{ fontWeight: 600, color: '#b0c2d4' }}>MCC SENTRY</span>
            <span style={{ color: '#323d4a' }}>·</span>
            <span style={{ color: '#68788a' }}>ARES-VI GROUND STATION</span>
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

        {/* Live UTC Clock (displayed in HeaderBar, prominent during MCC) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '30px',
            padding: '0 9px',
            background: '#0b0e11',
            borderRadius: '6px',
            border: '1px solid #1f2730',
          }}
        >
          <span
            style={{
              fontSize: '9px',
              color: '#7e93a8',
              fontWeight: 600,
              letterSpacing: '0.06em',
              background: 'rgba(126, 147, 168, 0.12)',
              padding: '1px 4px',
              borderRadius: '3px',
              fontFamily: "'Tomorrow', sans-serif",
            }}
          >
            UTC
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#dbe2ea',
              fontFamily: "'Tomorrow', sans-serif",
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.02em',
            }}
          >
            {utcTime}
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
            border: audioEngaged ? '1px solid rgba(250, 204, 21, 0.45)' : '1px solid #222222',
            background: audioEngaged ? 'rgba(250, 204, 21, 0.14)' : '#111111',
            color: audioEngaged ? '#facc15' : '#666666',
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

      </div>
    </header>


    {/* ── JARVIS FIXED BOTTOM TRANSMISSION BAR ── */}
    {jarvisBar}
  </div>
);
};

export default HeaderBar;

