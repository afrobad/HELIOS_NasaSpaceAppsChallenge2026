import React, { useState, useMemo, useRef, useEffect } from 'react';
import { audioService } from '../services/audioService';
import { useAlertStore } from '../services/alertStore';
import { CREW_SLUG_REGISTRY } from '../services/routerService';
import { HelixTalkingAvatar, type HelixAvatarState } from './HelixTalkingAvatar';
import { geminiService } from '../services/geminiService';
import type { TelemetryPacket } from '../types/telemetry';
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  FileText, 
  Copy, 
  Check, 
  Activity, 
  ShieldCheck, 
  Flame, 
  Moon, 
  Wind,
  Compass,
  CornerDownLeft,
  Bot,
  RotateCcw,
  Radio,
  Cpu
} from 'lucide-react';
import { UniversalButton } from './common/UniversalButton';
import { UniversalTab } from './common/UniversalTab';

interface ClinicalAnalystViewProps {
  telemetryMap?: Record<string, TelemetryPacket>;
  currentScenario?: string;
  onNavigateToAlerts?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'helix' | 'user';
  text: string;
  timestamp: string;
  category?: 'MISSION_DUTY' | 'TRIAGE' | 'RIDGE' | 'SBAR' | 'DEVICE' | 'SAFETY' | 'GENERAL';
  source?: 'GEMINI_AI' | 'LOCAL_RAG';
}

const STORAGE_KEY = 'helios_helix_chat_history_v2';

const getInitialMessages = (): ChatMessage[] => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return [
    {
      id: 'init-1',
      sender: 'helix',
      text: 'Greetings. I am Helix-AI, autonomous flight clinical intelligence. I synthesize multi-crew telemetry across all 4 astronauts, cross-reference all 18 flight telemetry devices, monitor NASA RIDGE space hazards, and enforce NASA-STD-3001 mission clearances. How can I assist the flight crew?',
      timestamp: 'MET 14d 08:44:00',
      category: 'GENERAL',
      source: 'LOCAL_RAG',
    },
  ];
};

export const ClinicalAnalystView: React.FC<ClinicalAnalystViewProps> = ({
  telemetryMap,
  currentScenario: _currentScenario,
  onNavigateToAlerts,
}) => {
  const { activeAlerts } = useAlertStore();
  const [avatarState, setAvatarState] = useState<HelixAvatarState>('IDLE');
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [timeHorizonTab, setTimeHorizonTab] = useState<'NOW' | 'TODAY' | 'SBAR'>('NOW');
  const [copiedSbar, setCopiedSbar] = useState<boolean>(false);
  const [transmittedMcc, setTransmittedMcc] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Persistent Chat History
  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; model: string | null }>({
    available: false,
    model: null,
  });

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check backend AI engine & Gemini status
  useEffect(() => {
    let isMounted = true;
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (isMounted && data) {
          const isAvail = Boolean(data.gemini?.available || data.ai_engine?.status === 'ONLINE');
          const modelName = data.gemini?.model || data.ai_engine?.active_model || 'LOCAL_RAG';
          setAiStatus({ available: isAvail, model: modelName });
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch {}
    }
  }, [messages]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, avatarState]);

  // Speech Recognition Setup (Web Speech API)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setAvatarState('LISTENING');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputQuery(transcript);
          handleProcessQuestion(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setAvatarState('IDLE');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your query in the console input.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setAvatarState('IDLE');
    } else {
      audioService.stopSpeaking();
      recognitionRef.current.start();
    }
  };

  // Reset conversation to initial state
  const handleResetChat = () => {
    const resetMsg: ChatMessage = {
      id: `init-${Date.now()}`,
      sender: 'helix',
      text: 'Conversation reset. Helix-AI sentry is ready. Select a telemetry query chip or speak via the intercom.',
      timestamp: 'MET 14d 08:45:00',
      category: 'GENERAL',
      source: 'LOCAL_RAG',
    };
    setMessages([resetMsg]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // 1-click message copy
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Crew readiness & Mission Duty Clearance calculation (NASA-STD-3001 Bioastronautics)
  const crewFitness = useMemo(() => {
    return CREW_SLUG_REGISTRY.map((c) => {
      let readiness = 96;
      let dutyStatus: 'CLEARED' | 'CABIN_DUTY' | 'REST_PROTOCOL' = 'CLEARED';
      let reason = 'All telemetry markers within nominal baseline. Cleared for flight duty.';
      let badgeLabel = 'CLEARED ✓';
      let badgeColor = '#10b981';
      let badgeBg = 'rgba(16, 185, 129, 0.12)';
      let badgeBorder = 'rgba(16, 185, 129, 0.30)';

      if (c.id === 'AST-01_COMMANDER') {
        readiness = 88;
        dutyStatus = 'CABIN_DUTY';
        badgeLabel = 'CABIN ONLY';
        badgeColor = '#fbbf24';
        badgeBg = 'rgba(245, 158, 11, 0.12)';
        badgeBorder = 'rgba(245, 158, 11, 0.30)';
        reason = 'Post-exercise SVT recovery active; high-exertion ARED deadlift cycles suspended.';
      } else if (c.id === 'AST-02_PILOT') {
        readiness = 84;
        dutyStatus = 'REST_PROTOCOL';
        badgeLabel = 'REST BLOCK';
        badgeColor = '#38bdf8';
        badgeBg = 'rgba(56, 189, 248, 0.12)';
        badgeBorder = 'rgba(56, 189, 248, 0.30)';
        reason = 'Protected 45m sleep block assigned; safety-critical navigation handed off to Dr. Sian.';
      } else if (c.id === 'AST-03_MEDICAL') {
        readiness = 98;
        dutyStatus = 'CLEARED';
        badgeLabel = 'CLEARED ✓';
        badgeColor = '#10b981';
        badgeBg = 'rgba(16, 185, 129, 0.12)';
        badgeBorder = 'rgba(16, 185, 129, 0.30)';
        reason = 'Cardiorespiratory, radiation dosimeter & cognitive markers nominal. Primary flight duty.';
      } else if (c.id === 'AST-04_ENGINEER') {
        readiness = 96;
        dutyStatus = 'CLEARED';
        badgeLabel = 'CLEARED ✓';
        badgeColor = '#10b981';
        badgeBg = 'rgba(16, 185, 129, 0.12)';
        badgeBorder = 'rgba(16, 185, 129, 0.30)';
        reason = 'Motor telemetry & vital signs nominal. Cleared for all spacecraft engineering & spacewalk duties.';
      }

      return {
        ...c,
        readiness,
        cleared: dutyStatus === 'CLEARED',
        dutyStatus,
        badgeLabel,
        badgeColor,
        badgeBg,
        badgeBorder,
        reason,
      };
    });
  }, [activeAlerts]);

  // NASA RIDGE Hazards calculation (Deep Space Multi-Vector Surveillance)
  const ridgeHazards = useMemo(() => {
    return [
      {
        id: 'R',
        name: 'Space Radiation (R)',
        status: 'ADVISORY',
        badgeColor: '#fbbf24',
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        badgeBorder: 'rgba(245, 158, 11, 0.30)',
        metric: '1.82 mSv/h SPE Proton Flux',
        detail: 'Solar Particle Event flux elevated · Cabin storm shelter standby · Secondary CAD dosimeter nominal',
        icon: Flame,
        iconColor: '#fbbf24',
      },
      {
        id: 'I',
        name: 'Isolation & Confinement (I)',
        status: 'MONITORED',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.12)',
        badgeBorder: 'rgba(56, 189, 248, 0.30)',
        metric: 'Pilot Sleep 4.6h Rest Deficit',
        detail: 'Cognitive fatigue flagged for Pilot Chris · Circadian melatonin lighting active in crew quarters',
        icon: Moon,
        iconColor: '#38bdf8',
      },
      {
        id: 'D',
        name: 'Distance from Earth (D)',
        status: 'NOMINAL',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.12)',
        badgeBorder: 'rgba(16, 185, 129, 0.30)',
        metric: 'Autonomous Sentry Active',
        detail: 'Deep-space communication autonomy locked · Next Houston ground station pass in 52m',
        icon: Compass,
        iconColor: '#10b981',
      },
      {
        id: 'G',
        name: 'Gravity Fields (G)',
        status: 'ADVISORY',
        badgeColor: '#fbbf24',
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        badgeBorder: 'rgba(245, 158, 11, 0.30)',
        metric: 'Commander SVT Exertion Flag',
        detail: 'Post-exercise supraventricular recovery monitored · ARED deadlift cycles suspended',
        icon: Activity,
        iconColor: '#fbbf24',
      },
      {
        id: 'E',
        name: 'Hostile/Closed Environment (E)',
        status: 'NOMINAL',
        badgeColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.12)',
        badgeBorder: 'rgba(16, 185, 129, 0.30)',
        metric: 'Cabin Atmosphere Nominal',
        detail: 'Cabin CO₂ 3.1 mmHg · CDRA scrubber nominal scrub cycle · Node 2 atmosphere nominal',
        icon: Wind,
        iconColor: '#10b981',
      },
    ];
  }, []);

  // Formatted SBAR ground handoff report
  const sbarReportText = useMemo(() => {
    return `[SBAR FLIGHT SURGEON HANDOFF REPORT]\n` +
      `SPACECRAFT: HELIOS-01 · ORBIT: DEEP-SPACE LEO · MET: 14d 08:44:00\n\n` +
      `[SITUATION]\n` +
      `2 of 4 crew members have active workload modifications. Commander Haley and Pilot Chris are currently assigned to low-strain intravehicular duty while Dr. Sian and Specialist Leo are fully cleared.\n\n` +
      `[BACKGROUND]\n` +
      `Commander Haley experienced transient supraventricular tachycardia during ARED deadlift workout. Pilot Chris logged a 4.6h sleep block following 72h orbital rendezvous operations.\n\n` +
      `[ASSESSMENT]\n` +
      `• Commander Haley (CDR): Post-exertion SVT resolving (HR resting 76 bpm, QTc 435ms, sinus rhythm). Myocardial recovery nominal.\n` +
      `• Pilot Chris (PLT): Arterial oxygen saturation stable (SpO₂ 96%). Tactical rest block indicated for cognitive fatigue mitigation.\n` +
      `• Dr. Sian (MED): Fully Cleared (Readiness 98%, immune & bioastronautics profile nominal).\n` +
      `• Specialist Leo (ENG): Fully Cleared (Readiness 96%, telemetry nominal).\n\n` +
      `[RECOMMENDATION]\n` +
      `1. Designate Dr. Sian and Specialist Leo as primary operational leads for tomorrow's airlock ops.\n` +
      `2. Enforce 45-minute tactical sleep nap for Pilot Chris in crew quarters.\n` +
      `3. Capture 12-lead Bio-Monitor ECG telemetry for Commander Haley and transmit on next Houston ground pass.`;
  }, []);

  // Copy SBAR report to clipboard
  const handleCopySbar = () => {
    navigator.clipboard.writeText(sbarReportText);
    setCopiedSbar(true);
    setTimeout(() => setCopiedSbar(false), 2500);
  };

  // Simulate instant MCC transmission
  const handleTransmitMcc = () => {
    const nowStamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTransmittedMcc(`TRANSMITTED TO HOUSTON (MET 14d ${nowStamp}) ✓`);
    setTimeout(() => setTransmittedMcc(null), 4000);
  };

  // Process user queries via Gemini AI with Telemetry RAG Grounding
  const handleProcessQuestion = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    // 1. Add User Message
    const userMsgId = `usr-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: q,
      timestamp: `MET 14d ${nowTime}`,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setAvatarState('THINKING');

    // 2. Query Gemini AI with Live Telemetry + Device Knowledge Base
    try {
      const historySnapshot = messages.slice(-4).map((m) => ({ sender: m.sender, text: m.text }));
      const aiResponse = await geminiService.query(q, {
        telemetryMap,
        activeAlerts,
        conversationHistory: historySnapshot,
      });

      const helixMsg: ChatMessage = {
        id: `hlx-${Date.now()}`,
        sender: 'helix',
        text: aiResponse.displayText,
        timestamp: `MET 14d ${nowTime}`,
        category: aiResponse.category,
        source: aiResponse.source,
      };

      setMessages((prev) => [...prev, helixMsg]);

      // 3. Voice readout if speech is active
      if (isVoiceActive) {
        setAvatarState('TALKING');
        try {
          audioService.playTone('chime', 'NOMINAL');
          audioService.speak(
            aiResponse.spokenText,
            { volume: 0.9, rate: 1.05 },
            {
              onStart: () => setAvatarState('TALKING'),
              onEnd: () => setAvatarState('IDLE'),
            }
          );
        } catch {
          setAvatarState('IDLE');
        }

        // Safety fallback to IDLE after estimated speech duration
        const speechDurationMs = Math.min(14000, Math.max(3000, aiResponse.spokenText.length * 55));
        setTimeout(() => {
          setAvatarState('IDLE');
        }, speechDurationMs);
      } else {
        setAvatarState('IDLE');
      }
    } catch {
      setAvatarState('IDLE');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '1840px',
        margin: '0 auto',
        padding: '16px 20px 48px 20px',
        boxSizing: 'border-box',
        gap: 14,
        color: '#e2e8f0',
        fontFamily: "var(--hud-font-sans, 'Hubot Sans', sans-serif)",
      }}
    >
      {/* ─── 1. COMPACT TOP AEROSPACE HEADER ─── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 18px',
          background: 'linear-gradient(180deg, rgba(20, 30, 23, 0.95) 0%, rgba(13, 19, 15, 0.98) 100%)',
          border: '1px solid rgba(122, 148, 99, 0.22)',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} color="#00f0ff" />
            <span
              style={{
                fontFamily: "var(--hud-font-brand, 'Orbitron', monospace)",
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: '0.12em',
                color: '#ffffff',
                textTransform: 'uppercase',
              }}
            >
              Helix-Ai Autonomous Clinical Intelligence
            </span>
          </div>

          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: aiStatus.available ? 'rgba(34, 197, 94, 0.12)' : 'rgba(0, 240, 255, 0.12)',
              border: `1px solid ${aiStatus.available ? 'rgba(34, 197, 94, 0.35)' : 'rgba(0, 240, 255, 0.35)'}`,
              color: aiStatus.available ? '#4ade80' : '#00f0ff',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              fontFamily: 'monospace',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: aiStatus.available ? '#22c55e' : '#00f0ff',
                boxShadow: aiStatus.available ? '0 0 6px #22c55e' : 'none',
              }}
            />
            {aiStatus.available ? `AI SENTRY LIVE: ${aiStatus.model?.toUpperCase()}` : 'NASA-STD-3001 SENTRY · GEMINI RAG'}
          </span>
        </div>

        {/* Header Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Audio Speech Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isVoiceActive) {
                audioService.stopSpeaking();
                setIsVoiceActive(false);
                setAvatarState('IDLE');
              } else {
                setIsVoiceActive(true);
              }
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 5,
              background: isVoiceActive ? 'rgba(0, 240, 255, 0.16)' : 'rgba(30, 44, 32, 0.85)',
              border: `1px solid ${isVoiceActive ? 'rgba(0, 240, 255, 0.45)' : 'rgba(122, 148, 99, 0.25)'}`,
              color: isVoiceActive ? '#00f0ff' : '#94a3b8',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
            title={isVoiceActive ? 'Mute AI voice output' : 'Enable AI voice output'}
          >
            {isVoiceActive ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{isVoiceActive ? 'VOICE READOUT: ON' : 'VOICE READOUT: MUTED'}</span>
          </button>

          {/* Alerts Queue Link */}
          {onNavigateToAlerts && (
            <button
              type="button"
              onClick={onNavigateToAlerts}
              style={{
                padding: '5px 12px',
                borderRadius: 5,
                background: 'rgba(239, 68, 68, 0.16)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#ef4444',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertTriangle size={13} />
              <span>FLIGHT ALERTS QUEUE</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. MAIN DUAL-PANE COCKPIT LAYOUT ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 1.05fr) minmax(340px, 1.15fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* LEFT PANE: HELIX-AI TALKING AVATAR & INTERACTIVE CHATTING INTERFACE   */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'linear-gradient(180deg, rgba(18, 27, 21, 0.95) 0%, rgba(12, 18, 14, 0.98) 100%)',
            border: '1px solid rgba(122, 148, 99, 0.22)',
            borderRadius: 8,
            padding: '16px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Top: 3D Holographic Talking Robot Avatar matching user's photo */}
          <HelixTalkingAvatar
            state={avatarState}
            size={240}
            onToggleMic={handleToggleMic}
            isListening={isListening}
          />

          {/* Quick Telemetry & Device Consultation Suggestion Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {[
              'Who is cleared for mission duty?',
              'Explain the 18 flight telemetry devices',
              'How does Astroskin measure HRV & ECG?',
              'Check Astropal SpO₂ & hypoxia flags',
              'Evaluate RIDGE space hazards',
              'Generate SBAR ground handoff',
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleProcessQuestion(chip)}
                style={{
                  padding: '4px 9px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(122, 148, 99, 0.14)',
                  border: '1px solid rgba(122, 148, 99, 0.28)',
                  color: '#cbd5e1',
                  fontSize: 10.5,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(122, 148, 99, 0.26)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(122, 148, 99, 0.14)';
                  e.currentTarget.style.color = '#cbd5e1';
                }}
              >
                "{chip}"
              </button>
            ))}
          </div>

          {/* Conversation History Header with Reset Option */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 2px',
              marginTop: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#8c9c8e',
                  letterSpacing: '0.06em',
                }}
              >
                AUTONOMOUS MISSION LOG
              </span>
              <span style={{ fontSize: 9.5, color: '#475569' }}>({messages.length} transmissions)</span>
            </div>

            <button
              type="button"
              onClick={handleResetChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 3,
                backgroundColor: 'transparent',
                border: '1px solid rgba(122, 148, 99, 0.22)',
                color: '#8c9c8e',
                fontSize: 9.5,
                fontWeight: 700,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
              title="Reset conversation stream and clear stored history"
            >
              <RotateCcw size={10} />
              <span>CLEAR HISTORY</span>
            </button>
          </div>

          {/* Scrollable Conversation History */}
          <div
            ref={chatScrollRef}
            style={{
              height: 360,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '12px 14px',
              backgroundColor: 'rgba(8, 13, 10, 0.9)',
              border: '1px solid rgba(122, 148, 99, 0.2)',
              borderRadius: 6,
            }}
          >
            {messages.map((msg) => {
              const isHelix = msg.sender === 'helix';
              const isCopied = copiedMessageId === msg.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: isHelix ? 'flex-start' : 'flex-end',
                    maxWidth: '92%',
                    gap: 3,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 9.5,
                      fontFamily: 'monospace',
                      color: isHelix ? '#00f0ff' : '#a1b48e',
                    }}
                  >
                    <span>{isHelix ? 'HELIX-AI SENTRY' : 'ASTRONAUT OPERATOR'}</span>
                    <span style={{ color: '#64748b' }}>·</span>
                    <span style={{ color: '#64748b' }}>{msg.timestamp}</span>
                    {msg.source && (
                      <span
                        style={{
                          fontSize: 8.5,
                          padding: '1px 5px',
                          borderRadius: 3,
                          backgroundColor: msg.source === 'GEMINI_AI' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          color: msg.source === 'GEMINI_AI' ? '#00f0ff' : '#94a3b8',
                          border: msg.source === 'GEMINI_AI' ? '1px solid rgba(0, 240, 255, 0.3)' : 'none',
                        }}
                      >
                        {msg.source === 'GEMINI_AI' ? 'GEMINI FLASH' : 'LOCAL RAG'}
                      </span>
                    )}
                    {msg.category && (
                      <span
                        style={{
                          fontSize: 8.5,
                          padding: '1px 5px',
                          borderRadius: 3,
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#94a3b8',
                        }}
                      >
                        {msg.category}
                      </span>
                    )}

                    {/* Copy message button */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: isCopied ? '#10b981' : '#64748b',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Copy recommendation"
                    >
                      {isCopied ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: isHelix ? '2px 8px 8px 8px' : '8px 2px 8px 8px',
                      backgroundColor: isHelix
                        ? 'rgba(16, 26, 20, 0.95)'
                        : 'linear-gradient(180deg, #1f2f23 0%, #17241a 100%)',
                      border: isHelix
                        ? '1px solid rgba(0, 240, 255, 0.3)'
                        : '1px solid rgba(161, 180, 142, 0.35)',
                      color: isHelix ? '#f1f5f9' : '#ffffff',
                      fontSize: 12,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-line',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* Thinking / Synthesizing Indicator */}
            {avatarState === 'THINKING' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  alignSelf: 'flex-start',
                  padding: '8px 14px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(0, 240, 255, 0.12)',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                  color: '#00f0ff',
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#00f0ff',
                    boxShadow: '0 0 8px #00f0ff',
                  }}
                />
                <span>SYNTHESIZING TELEMETRY VIA GEMINI RAG...</span>
              </div>
            )}
          </div>

          {/* Interactive Chat Console Input */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleProcessQuestion(inputQuery)}
              placeholder="Ask Helix-Ai (e.g. 'How does Astroskin measure HRV?', 'Check Pilot Chris SpO2')..."
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 5,
                backgroundColor: 'rgba(8, 13, 10, 0.95)',
                border: '1px solid rgba(122, 148, 99, 0.32)',
                color: '#ffffff',
                fontSize: 12,
                outline: 'none',
                fontFamily: "var(--hud-font-sans, 'Hubot Sans', sans-serif)",
              }}
            />

            {/* Microphone Voice Input Button */}
            <button
              type="button"
              onClick={handleToggleMic}
              style={{
                padding: '9px 11px',
                borderRadius: 5,
                backgroundColor: isListening ? 'rgba(239, 68, 68, 0.25)' : 'rgba(30, 44, 32, 0.9)',
                border: isListening ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(122, 148, 99, 0.3)',
                color: isListening ? '#ef4444' : '#a1b48e',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title={isListening ? 'Stop recording voice' : 'Speak to Helix via microphone'}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleProcessQuestion(inputQuery)}
              style={{
                padding: '9px 14px',
                borderRadius: 5,
                backgroundColor: 'rgba(122, 148, 99, 0.28)',
                border: '1px solid rgba(161, 180, 142, 0.45)',
                color: '#ffffff',
                fontSize: 11.5,
                fontWeight: 700,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>SEND</span>
              <CornerDownLeft size={13} />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* RIGHT PANE: OPERATIONAL SYNTHESIS, CREW MATRIX & TIME DIRECTIVES       */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── CARD 1: CREW FLIGHT READINESS & MISSION DUTY MATRIX ── */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'linear-gradient(180deg, rgba(12, 19, 26, 0.96) 0%, rgba(8, 13, 18, 0.98) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={15} color="#38bdf8" />
                  <span
                    style={{
                      fontFamily: "var(--hud-font-brand, 'Orbitron', monospace)",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: '#ffffff',
                      textTransform: 'uppercase',
                    }}
                  >
                    Crew Flight Readiness & Duty Clearance
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#64748b', paddingLeft: 21 }}>
                  Operational bioastronautics clearances for intravehicular & mission duty
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#38bdf8', fontFamily: 'monospace', padding: '1.5px 6px', borderRadius: 3, backgroundColor: 'rgba(56, 189, 248, 0.10)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                NASA-STD-3001
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {crewFitness.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(15, 23, 32, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                    <UserCheck size={15} color={c.dutyStatus === 'CLEARED' ? '#10b981' : c.dutyStatus === 'CABIN_DUTY' ? '#fbbf24' : '#38bdf8'} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{c.name}</span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>({c.role})</span>
                      </div>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: '#94a3b8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.reason}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace' }}>
                      {c.readiness}%
                    </span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 3,
                        fontSize: 9.5,
                        fontWeight: 800,
                        backgroundColor: c.badgeBg,
                        color: c.badgeColor,
                        border: `1px solid ${c.badgeBorder}`,
                        fontFamily: 'monospace',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {c.badgeLabel}
                    </span>
                    <UniversalButton
                      variant="cyan"
                      size="xs"
                      pill
                      onClick={() => handleProcessQuestion(`How is ${c.name} doing? Give detailed telemetry status and mission duty clearance.`)}
                      title={`Consult Helix about ${c.name}`}
                    >
                      QUERY
                    </UniversalButton>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CARD 2: NASA RIDGE 5 HAZARDS SENTRY ── */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'linear-gradient(180deg, rgba(12, 19, 26, 0.96) 0%, rgba(8, 13, 18, 0.98) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color="#00f0ff" />
                  <span
                    style={{
                      fontFamily: "var(--hud-font-brand, 'Orbitron', monospace)",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: '#ffffff',
                      textTransform: 'uppercase',
                    }}
                  >
                    NASA RIDGE · Space Health Hazards Sentry
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#64748b', paddingLeft: 21 }}>
                  Continuous surveillance: Radiation, Isolation, Distance, Gravity, Environment
                </span>
              </div>
              <span style={{ fontSize: 9.5, color: '#10b981', fontFamily: 'monospace', padding: '1.5px 6px', borderRadius: 3, backgroundColor: 'rgba(16, 185, 129, 0.10)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                SURVEILLANCE ACTIVE
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ridgeHazards.map((h) => {
                const Icon = h.icon;
                return (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '7px 11px',
                      borderRadius: 6,
                      backgroundColor: 'rgba(15, 23, 32, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                      <Icon size={14} color={h.iconColor} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#f8fafc' }}>{h.name}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.metric} · {h.detail}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: 9,
                          fontWeight: 800,
                          backgroundColor: h.badgeBg,
                          color: h.badgeColor,
                          border: `1px solid ${h.badgeBorder}`,
                          fontFamily: 'monospace',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {h.status}
                      </span>
                      <UniversalButton
                        variant="cyan"
                        size="xs"
                        pill
                        onClick={() => handleProcessQuestion(`Provide clinical mitigation protocol for ${h.name}.`)}
                        title={`Query protocol for ${h.name}`}
                      >
                        PROTOCOL
                      </UniversalButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── CARD 3: TIME-HORIZON OPERATIONAL DIRECTIVES & SBAR EXPORT ── */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'linear-gradient(180deg, rgba(12, 19, 26, 0.96) 0%, rgba(8, 13, 18, 0.98) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              {/* Segmented Horizon Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {[
                  { id: 'NOW' as const, label: 'NOW (Immediate)' },
                  { id: 'TODAY' as const, label: 'TODAY (Cadence)' },
                  { id: 'SBAR' as const, label: 'SBAR HANDOFF' },
                ].map((tab) => (
                  <UniversalTab
                    key={tab.id}
                    active={timeHorizonTab === tab.id}
                    accent="cyan"
                    size="sm"
                    pill
                    onClick={() => setTimeHorizonTab(tab.id)}
                  >
                    {tab.label}
                  </UniversalTab>
                ))}
              </div>

              {/* Action Buttons: Transmit & Export SBAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UniversalButton
                  variant={transmittedMcc ? 'emerald' : 'cyan'}
                  size="xs"
                  pill
                  icon={<Radio size={11} />}
                  iconPosition="left"
                  onClick={handleTransmitMcc}
                  title="Transmit SBAR report to Houston Mission Control Center"
                >
                  {transmittedMcc || 'BURST TO MCC'}
                </UniversalButton>

                <UniversalButton
                  variant={copiedSbar ? 'emerald' : 'neutral'}
                  size="xs"
                  pill
                  icon={copiedSbar ? <Check size={11} /> : <Copy size={11} />}
                  iconPosition="left"
                  onClick={handleCopySbar}
                  title="Export SBAR handover to clipboard"
                >
                  {copiedSbar ? 'COPIED' : 'EXPORT SBAR'}
                </UniversalButton>
              </div>
            </div>

            {/* Dynamic Horizon Content */}
            <div
              style={{
                padding: '11px 13px',
                borderRadius: 6,
                backgroundColor: 'rgba(10, 16, 22, 0.90)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: 11.5,
                lineHeight: 1.6,
                color: '#cbd5e1',
                maxHeight: 180,
                overflowY: 'auto',
                fontFamily: timeHorizonTab === 'SBAR' ? 'monospace' : "var(--hud-font-sans, 'Hubot Sans', sans-serif)",
                whiteSpace: 'pre-line',
              }}
            >
              {timeHorizonTab === 'NOW' && (
                <div>
                  <div style={{ color: '#38bdf8', fontWeight: 800, marginBottom: 6, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.04em' }}>
                    // FLIGHT SURGEON CLINICAL DIRECTIVES · IMMEDIATE PRIORITY
                  </div>
                  • <strong style={{ color: '#f8fafc' }}>[REASSIGNMENT]</strong> Reassign safety-critical orbital navigation tasks away from Pilot Chris during rest block.<br />
                  • <strong style={{ color: '#f8fafc' }}>[COOLDOWN]</strong> Halt ARED resistive deadlift and cycle ergometer for Commander Haley; transition to seated active recovery.<br />
                  • <strong style={{ color: '#f8fafc' }}>[ATMOSPHERE]</strong> CDRA scrubber purge nominal in Node 2; trace NH₃ transient cleared.
                </div>
              )}

              {timeHorizonTab === 'TODAY' && (
                <div>
                  <div style={{ color: '#fbbf24', fontWeight: 800, marginBottom: 6, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.04em' }}>
                    // TODAY REST & DUTY CADENCE · MET 14d
                  </div>
                  • <strong style={{ color: '#f8fafc' }}>[REST BLOCK]</strong> Enforce protected 45-minute tactical sleep nap for Pilot Chris in crew quarters.<br />
                  • <strong style={{ color: '#f8fafc' }}>[DIAGNOSTICS]</strong> Capture diagnostic 12-lead Bio-Monitor ECG telemetry for Commander Haley.<br />
                  • <strong style={{ color: '#f8fafc' }}>[AIRLOCK CREW]</strong> Designate Dr. Sian and Specialist Leo as primary spacewalk crew for mission airlock egress prep.
                </div>
              )}

              {timeHorizonTab === 'SBAR' && (
                <div>
                  {sbarReportText}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
