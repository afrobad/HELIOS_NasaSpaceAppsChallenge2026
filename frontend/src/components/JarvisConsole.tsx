import React, { useEffect, useRef, useState } from 'react';
import { audioService } from '../services/audioService';
import type { AlertPayload } from '../types/telemetry';

interface JarvisConsoleProps {
  latestAlert: AlertPayload | null;
  selectedAstronautId: string;
}

const getAstronautName = (id: string): string => {
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

export const formatChemicalSubscripts = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\bCO2\b/g, 'CO₂')
    .replace(/\bSpO2\b/g, 'SpO₂')
    .replace(/\bO2\b/g, 'O₂')
    .replace(/\bK\+\b/g, 'K⁺');
};

/**
 * Strips leading crew names or greetings to isolate the core clinical directive for deduplication.
 */
export const extractAdviceBody = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^(?:(?:good\s+day|hello|urgent\s+alert|emergency|all\s+stations|all\s+crew\s+stations|all\s+crew)[,\s!:]+)?(?:(?:commander\s+\w+|pilot\s+\w+|doctor\s+\w+|specialist\s+\w+)(?:\s*(?:,|and)\s*(?:commander\s+\w+|pilot\s+\w+|doctor\s+\w+|specialist\s+\w+))*)[,\s!:]+/i, '')
    .trim()
    .toLowerCase();
};

export const JarvisConsole: React.FC<JarvisConsoleProps> = ({
  latestAlert,
  selectedAstronautId,
}) => {
  const currentCrewName = getAstronautName(selectedAstronautId);
  const [queryText, setQueryText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ollamaStatus, setOllamaStatus] = useState<'ONLINE' | 'OFFLINE' | 'INITIATING'>('INITIATING');
  const [initiationProgress, setInitiationProgress] = useState<number>(15);
  const [activeModel, setActiveModel] = useState<string>('jarvis');
  const initiationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeSpeech, setActiveSpeech] = useState<string>('');
  const [streamedWordCount, setStreamedWordCount] = useState<number>(0);
  const targetWordsRef = useRef<string[]>([]);
  const [activeSeverity, setActiveSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL'>('NOMINAL');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Concurrency & Synchronization Refs
  const isSpeakingRef = useRef<boolean>(false);
  const activeSpeechTextRef = useRef<string>(activeSpeech);
  const pendingObservedAlertRef = useRef<AlertPayload | null>(null);
  const hasSpokenCustomMessageRef = useRef<boolean>(false);
  const lastSpokenAdviceBodyRef = useRef<string>('');
  const lastSpokenTimestampRef = useRef<number>(0);

  // Sync ref with state
  useEffect(() => {
    activeSpeechTextRef.current = activeSpeech;
  }, [activeSpeech]);

  /**
   * Triggers local AI model initiation and warm-up, running a smooth simulated
   * percentage progress ticker that reaches 100% when the model is verified online.
   */
  const triggerInitiation = async () => {
    setOllamaStatus('INITIATING');
    setInitiationProgress(15);

    if (initiationIntervalRef.current) {
      clearInterval(initiationIntervalRef.current);
    }

    // Smooth ticker advancing up to 94% while warming weights
    initiationIntervalRef.current = setInterval(() => {
      setInitiationProgress((prev) => {
        if (prev >= 94) return 94;
        const step = prev < 50 ? 9 : prev < 75 ? 6 : 2;
        return Math.min(94, prev + step);
      });
    }, 180);

    try {
      const res = await fetch('/api/ai/initiate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'INITIATED' || data.ready) {
          if (data.model) setActiveModel(data.model);
          setInitiationProgress(100);
          if (initiationIntervalRef.current) {
            clearInterval(initiationIntervalRef.current);
            initiationIntervalRef.current = null;
          }
          setTimeout(() => {
            setOllamaStatus('ONLINE');
          }, 350);
          return;
        }
      }
    } catch {
      // Continue to verification poll
    }

    // Verify online status via polling in case daemon takes a moment to spawn
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      try {
        const sRes = await fetch('/api/ai/status');
        if (sRes.ok) {
          const sData = await sRes.json();
          const engine = sData.ai_engine || {};
          if (engine.status === 'ONLINE') {
            if (engine.active_model) setActiveModel(engine.active_model);
            setInitiationProgress(100);
            if (initiationIntervalRef.current) {
              clearInterval(initiationIntervalRef.current);
              initiationIntervalRef.current = null;
            }
            setTimeout(() => {
              setOllamaStatus('ONLINE');
            }, 350);
            return;
          }
        }
      } catch {
        // Continue loop
      }
    }

    if (initiationIntervalRef.current) {
      clearInterval(initiationIntervalRef.current);
      initiationIntervalRef.current = null;
    }
    setInitiationProgress(0);
    setOllamaStatus('OFFLINE');
  };

  // Check Ollama AI status on mount and auto-trigger turn on every time
  useEffect(() => {
    const checkAndTrigger = async () => {
      try {
        const res = await fetch('/api/ai/status');
        if (res.ok) {
          const data = await res.json();
          const engine = data.ai_engine || {};
          if (engine.status === 'ONLINE') {
            setOllamaStatus('ONLINE');
            setInitiationProgress(100);
            if (engine.active_model) setActiveModel(engine.active_model);
            return;
          }
        }
      } catch {
        // Fall through to auto-initiate
      }
      triggerInitiation();
    };

    checkAndTrigger();

    // Periodic safety loop: if offline, automatically trigger turning on every time
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/ai/status');
        if (res.ok) {
          const data = await res.json();
          const engine = data.ai_engine || {};
          if (engine.status === 'ONLINE') {
            setOllamaStatus('ONLINE');
            if (engine.active_model) setActiveModel(engine.active_model);
          } else if (ollamaStatus !== 'INITIATING') {
            triggerInitiation();
          }
        }
      } catch {
        if (ollamaStatus !== 'INITIATING') {
          triggerInitiation();
        }
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      if (initiationIntervalRef.current) {
        clearInterval(initiationIntervalRef.current);
      }
    };
  }, []);

  // Dynamic AI Greeting when astronaut selection changes (speaks ONLY when nominal and NO active emergency)
  useEffect(() => {
    let isCancelled = false;
    const fetchGreeting = async () => {
      // Strictly suppress greetings if an alert is active or if current state is elevated
      if (latestAlert && (latestAlert.severity === 'CRITICAL' || latestAlert.severity === 'WARNING')) {
        return;
      }
      if (activeSeverity === 'CRITICAL' || activeSeverity === 'WARNING') {
        return;
      }

      try {
        const res = await fetch(`/api/voice/greeting/${encodeURIComponent(selectedAstronautId)}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.speech_text && !isSpeakingRef.current) {
            // If the astronaut is actually elevated, deliver the clinical advisory with appropriate tone
            if (data.severity === 'CRITICAL' || data.severity === 'WARNING') {
              speakStatement(data.speech_text, data.severity === 'CRITICAL' ? 'klaxon' : 'chime', {
                severity: data.severity,
              });
            } else if (!latestAlert && (hasSpokenCustomMessageRef.current || audioService.getEngaged())) {
              speakStatement(data.speech_text, 'chime', {
                severity: 'NOMINAL',
              });
            }
          }
        }
      } catch {
        // Handled
      }
    };
    fetchGreeting();
    return () => {
      isCancelled = true;
    };
  }, [selectedAstronautId, latestAlert, activeSeverity]);

  // Visualizer Canvas Equalizer
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerAnimRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const renderBars = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const numBars = 5;
      const barWidth = 3;
      const barSpacing = 4;
      const totalW = numBars * barWidth + (numBars - 1) * barSpacing;
      const startX = (canvas.width - totalW) / 2;

      for (let i = 0; i < numBars; i++) {
        let heightMultiplier = 0.25;
        if (isSpeaking) {
          heightMultiplier = 0.35 + 0.65 * Math.abs(Math.sin(phase + i * 0.8));
        } else {
          heightMultiplier = 0.20 + 0.08 * Math.sin(phase * 0.5 + i * 0.5);
        }

        const barH = canvas.height * heightMultiplier;
        const x = startX + i * (barWidth + barSpacing);
        const y = (canvas.height - barH) / 2;

        ctx.fillStyle = isSpeaking ? '#ffffff' : '#475569';
        ctx.fillRect(x, y, barWidth, barH);
      }

      phase += 0.14;
      visualizerAnimRef.current = requestAnimationFrame(renderBars);
    };

    visualizerAnimRef.current = requestAnimationFrame(renderBars);
    return () => {
      if (visualizerAnimRef.current) cancelAnimationFrame(visualizerAnimRef.current);
    };
  }, [isSpeaking]);

  /**
   * Dispatches speech. Text in the AI container updates ONLY when audio actually
   * starts playing (onStart = audio.onplay), guaranteeing perfect text/voice sync.
   */
  const speakStatement = (
    text: string,
    tone: 'klaxon' | 'chime' | 'beep' | 'none' = 'chime',
    config?: { severity?: 'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL'; rate?: number; volume?: number }
  ) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    const sev = config?.severity || 'NOMINAL';
    setActiveSeverity(sev);
    hasSpokenCustomMessageRef.current = true;
    lastSpokenAdviceBodyRef.current = extractAdviceBody(cleanText);
    lastSpokenTimestampRef.current = Date.now();

    const words = cleanText.split(/\s+/).filter(Boolean);
    targetWordsRef.current = words;
    setStreamedWordCount(1);

    // Ensure audio service is engaged
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
          setStreamedWordCount(1);
        },
        onWord: (wordIndex: number) => {
          setStreamedWordCount((prev) => Math.max(prev, Math.min(words.length, wordIndex + 1)));
        },
        onEnd: () => {
          setStreamedWordCount(words.length);
          handleSpeechFinished();
        },
      },
    });
  };

  /**
   * When the active message finishes speaking, check for newly observed changes
   * buffered during playback, and speak the next message seamlessly, keeping the
   * current directive persistent and visible for continuous astronaut reference.
   */
  const handleSpeechFinished = () => {
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setStreamedWordCount(targetWordsRef.current.length);

    // If new changes were observed & buffered while speaking, play them now
    const pending = pendingObservedAlertRef.current;
    if (pending && pending.speech_text) {
      const pendingAdvice = extractAdviceBody(pending.speech_text);
      if (pendingAdvice && pendingAdvice === lastSpokenAdviceBodyRef.current) {
        pendingObservedAlertRef.current = null;
      } else if (pending.speech_text !== activeSpeechTextRef.current) {
        pendingObservedAlertRef.current = null;
        // Wait for 3.5s quiet break after voice transmission before playing follow-up
        setTimeout(() => {
          if (!isSpeakingRef.current) {
            speakStatement(
              pending.speech_text,
              pending.tone || 'chime',
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
  };

  /**
   * Continuous telemetry observation handler:
   * LIFE-SAFETY PREEMPTION: If a CRITICAL or WARNING alert arrives, immediately abort
   * any active nominal speech and display/speak the life-saving emergency directive without delay!
   * If an equivalent or lower alert arrives while busy, buffer sequentially.
   */
  useEffect(() => {
    if (!latestAlert || !latestAlert.speech_text) return;

    const alertText = latestAlert.speech_text.trim();
    if (!alertText) return;

    // Prevent duplicate triggers of identical text
    if (alertText === activeSpeechTextRef.current) return;

    // Semantic deduplication: if the core clinical advice is identical to what was recently spoken (< 8 seconds),
    // update the display banner with the latest multi-crew names without re-speaking identical advice over TTS
    const incomingAdvice = extractAdviceBody(alertText);
    const timeSinceLastSpoken = Date.now() - lastSpokenTimestampRef.current;
    if (incomingAdvice && incomingAdvice === lastSpokenAdviceBodyRef.current && timeSinceLastSpoken < 8000) {
      setActiveSpeech(alertText);
      activeSpeechTextRef.current = alertText;
      return;
    }

    const isEmergency = latestAlert.severity === 'CRITICAL' || latestAlert.severity === 'WARNING';
    const isHigherPriority =
      (latestAlert.severity === 'CRITICAL' && activeSeverity !== 'CRITICAL') ||
      (latestAlert.severity === 'WARNING' && activeSeverity === 'NOMINAL');

    if (isEmergency && (isHigherPriority || !isSpeakingRef.current || activeSeverity === 'NOMINAL')) {
      // PREEMPT IMMEDIATELY: Stop any nominal speech or chatter, sound the alert tone, and speak the emergency
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
      // Buffer sequential telemetry calculation for sequential playback
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


  const handleSendQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryText.trim() || isProcessing) return;

    const query = queryText.trim();
    setQueryText('');
    setIsProcessing(true);

    // Cancel any previous voice/observation so user prompt takes immediate priority
    audioService.stopSpeaking();
    pendingObservedAlertRef.current = null;

    try {
      const res = await fetch('/api/voice/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
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
        `Hello ${currentCrewName}. All systems continue nominal monitoring. I advise proceeding with scheduled mission tasks.`,
        'chime',
        { severity: 'NOMINAL' }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="hud-panel"
      style={{
        marginBottom: '16px',
        background: 'linear-gradient(135deg, #131416 0%, #17181c 50%, #1b1c20 100%)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Header Bar - Clean Minimal Layout */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
          JARVIS AI
        </span>

        {/* Minimal Model Status & Equalizer Visualizer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              letterSpacing: '0.02em',
              lineHeight: 1,
              cursor: ollamaStatus !== 'ONLINE' ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (ollamaStatus !== 'ONLINE') triggerInitiation();
            }}
            title={
              ollamaStatus === 'ONLINE'
                ? `Local AI Inference Engine: ${activeModel}`
                : ollamaStatus === 'INITIATING'
                ? `Initiating AI Engine (${initiationProgress}%)...`
                : 'AI Engine Offline — click to trigger start'
            }
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor:
                  ollamaStatus === 'ONLINE'
                    ? '#e2e8f0'
                    : ollamaStatus === 'INITIATING'
                    ? '#38bdf8'
                    : '#ef4444',
                boxShadow:
                  ollamaStatus === 'ONLINE'
                    ? '0 0 5px rgba(226, 232, 240, 0.4)'
                    : ollamaStatus === 'INITIATING'
                    ? '0 0 5px rgba(56, 189, 248, 0.5)'
                    : 'none',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color:
                  ollamaStatus === 'ONLINE'
                    ? '#cbd5e1'
                    : ollamaStatus === 'INITIATING'
                    ? '#38bdf8'
                    : '#64748b',
                fontFamily: 'var(--hud-font-mono)',
                fontSize: '10.5px',
                fontWeight: 500,
              }}
            >
              {ollamaStatus === 'INITIATING'
                ? `loading ${initiationProgress}%`
                : ollamaStatus === 'ONLINE'
                ? (activeModel.includes('3.2') ? 'llama-3.2' : activeModel)
                : 'offline'}
            </span>
          </div>

          <canvas
            ref={visualizerCanvasRef}
            width={36}
            height={14}
            style={{ width: '36px', height: '14px', background: 'transparent', display: 'block' }}
          />
        </div>
      </div>

      {/* Focusable AI Message Section with Severity Accents — Available strictly during speech or transmission */}
      <div
        tabIndex={0}
        role="region"
        aria-label="JARVIS Active Voice Message"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          background: isFocused ? '#18191e' : 'rgba(20, 21, 26, 0.75)',
          border: isFocused ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.07)',
          borderLeft: isFocused
            ? activeSeverity === 'CRITICAL'
              ? '3px solid #ef4444'
              : activeSeverity === 'WARNING'
              ? '3px solid #f59e0b'
              : '3px solid #10b981'
            : activeSeverity === 'CRITICAL'
            ? '3px solid rgba(239, 68, 68, 0.85)'
            : activeSeverity === 'WARNING'
            ? '3px solid rgba(245, 158, 11, 0.85)'
            : '3px solid rgba(16, 185, 129, 0.5)',
          borderRadius: '0 var(--hud-radius-btn) var(--hud-radius-btn) 0',
          padding: '13px 16px',
          marginBottom: '10px',
          outline: 'none',
          boxShadow: isFocused ? '0 2px 14px rgba(0, 0, 0, 0.35)' : 'none',
          transition: 'border-color 150ms ease, background 150ms ease',
          cursor: 'text',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {activeSpeech ? (
          <div
            style={{
              fontSize: '13.5px',
              lineHeight: '1.55',
              color: '#ffffff',
              fontWeight: 500,
              letterSpacing: '0.01em',
              userSelect: 'text',
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: '4px',
            }}
          >
            <span>
              {formatChemicalSubscripts(
                isSpeaking && targetWordsRef.current.length > 0
                  ? targetWordsRef.current.slice(0, Math.max(1, streamedWordCount)).join(' ')
                  : activeSpeech
              )}
            </span>
            {isSpeaking && streamedWordCount < targetWordsRef.current.length && (
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '13px',
                  backgroundColor: '#38bdf8',
                  marginLeft: '2px',
                  verticalAlign: 'middle',
                  boxShadow: '0 0 6px rgba(56, 189, 248, 0.7)',
                }}
              />
            )}
          </div>
        ) : isProcessing ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#38bdf8',
              fontFamily: 'var(--hud-font-mono)',
              fontSize: '11px',
              letterSpacing: '0.04em',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: '#38bdf8',
                boxShadow: '0 0 5px rgba(56, 189, 248, 0.5)',
                flexShrink: 0,
              }}
            />
            <span>TRANSMITTING QUERY // AWAITING VOICE DIRECTIVE...</span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#64748b',
              fontFamily: 'var(--hud-font-mono)',
              fontSize: '11px',
              letterSpacing: '0.04em',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 5px rgba(16, 185, 129, 0.4)',
                flexShrink: 0,
              }}
            />
            <span>STANDBY // LIFE SUPPORT SENTRY MONITORING {currentCrewName.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Query Input Bar with Modern Upper-Arrow Icon */}
      <form onSubmit={handleSendQuery} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder={`Ask JARVIS for ${currentCrewName} (e.g. 'JARVIS, what is the status?')`}
          style={{
            flex: 1,
            padding: '9px 14px',
            background: 'rgba(14, 15, 18, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--hud-radius-btn)',
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'var(--hud-font-sans)',
            outline: 'none',
            transition: 'border-color 120ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}
        />
        <button
          type="submit"
          disabled={isProcessing || !queryText.trim()}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: 'var(--hud-radius-btn)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: !queryText.trim() || isProcessing
              ? 'rgba(255, 255, 255, 0.05)'
              : '#ffffff',
            border: !queryText.trim() || isProcessing
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid #ffffff',
            color: !queryText.trim() || isProcessing ? '#64748b' : '#0b0c10',
            cursor: !queryText.trim() || isProcessing ? 'not-allowed' : 'pointer',
            transition: 'all 120ms ease',
            boxShadow: 'none',
            outline: 'none',
            flexShrink: 0,
          }}
          title="Transmit query to JARVIS (Enter)"
          aria-label="Transmit query"
        >
          {isProcessing ? (
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
              <path d="M12 3a9 9 0 0 1 9 9" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

