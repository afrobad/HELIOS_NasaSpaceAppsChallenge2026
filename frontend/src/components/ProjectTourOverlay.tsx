import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, X, Volume2, Sparkles, Navigation } from 'lucide-react';
import { audioService } from '../services/audioService';
import './ProjectTourOverlay.css';

export interface TourStep {
  id: string;
  view: 'HUD' | 'HEALTH_TELEMETRY' | 'SELF_ASSESSMENT' | 'MISSION_ROUTINE' | 'MCC' | 'CABIN_3D';
  stepNumber: number;
  badge: string;
  title: string;
  targetSelector?: string;
  targetLabel?: string;
  narration: string;
  cabinStop?: string;
  cabinDuration?: number;
  waitForCabinArrival?: boolean;
  action?: 'TRIGGER_SCENARIO' | 'RESET_NOMINAL' | 'NONE';
  scenarioKey?: string;
  durationMs: number;
}

const TOUR_STEPS: TourStep[] = [
  // ─── 1. MAIN DASHBOARD ───
  {
    id: 'DASHBOARD_CREW',
    view: 'HUD',
    stepNumber: 1,
    badge: '01 / 08 · MAIN DASHBOARD',
    title: 'Astronaut Roster & Crew Manifest',
    targetSelector: '[data-tour="crew-manifest"]',
    targetLabel: 'CREW TELEMETRY MANIFEST',
    narration: 'Welcome to Helios, our automated mission health platform. On the left, the Crew Manifest continuously tracks all four astronauts aboard the station in real time.',
    durationMs: 5500,
  },
  {
    id: 'DASHBOARD_VITALS',
    view: 'HUD',
    stepNumber: 1,
    badge: '01 / 08 · MAIN DASHBOARD',
    title: 'Continuous Lead-II ECG & Heart Rates',
    targetSelector: '[data-tour="live-ecg"]',
    targetLabel: 'LIVE LEAD-II ECG WAVEFORM',
    narration: 'Here, live electrocardiogram waveforms and vital heart rates are monitored continuously, flagging any microgravity cardiovascular stress or arrhythmia.',
    durationMs: 5500,
  },
  {
    id: 'DASHBOARD_BIOTWIN',
    view: 'HUD',
    stepNumber: 1,
    badge: '01 / 08 · MAIN DASHBOARD',
    title: '3D Holographic Digital Bio-Twin',
    targetSelector: '[data-tour="bio-twin"]',
    targetLabel: '3D HOLOGRAPHIC DIGITAL BIO-TWIN',
    narration: 'In the center, our 3D Digital Bio-Twin models organ physiology, vascular fluid redistribution, and adaptation to the spaceflight environment.',
    durationMs: 6000,
  },
  {
    id: 'DASHBOARD_DUAL_USE',
    view: 'HUD',
    stepNumber: 1,
    badge: '01 / 08 · MAIN DASHBOARD',
    title: 'Dual Spacecraft & Ground Architecture',
    targetSelector: '.helios-header-clocks',
    targetLabel: 'SYNCHRONIZED DUAL-DOMAIN ARCHITECTURE',
    narration: 'This platform functions symmetrically: astronauts use it autonomously in orbit, while Flight Surgeons at Mission Control on Earth monitor downlinked telemetry.',
    durationMs: 6000,
  },

  // ─── 2. CRITICAL SITUATION DEMONSTRATION ───
  {
    id: 'SCENARIO_TRIGGER',
    view: 'HUD',
    stepNumber: 2,
    badge: '02 / 08 · CRITICAL SITUATION DEMO',
    title: 'Activating In-Flight Emergency',
    targetSelector: '[data-tour="scenario-trigger"]',
    targetLabel: 'AUTONOMOUS SENTRY SIMULATOR',
    action: 'TRIGGER_SCENARIO',
    scenarioKey: 'SCENARIO_1_CO2_SCRUBBER_BREAKTHROUGH',
    narration: 'Now, let us observe how the system handles a sudden emergency. We simulate an environmental scrubber failure leading to rapid cabin carbon dioxide accumulation.',
    durationMs: 6000,
  },
  {
    id: 'SCENARIO_AI_SURGEON',
    view: 'HUD',
    stepNumber: 2,
    badge: '02 / 08 · CRITICAL SITUATION DEMO',
    title: 'Autonomous Helix-Ai Analyst Detection',
    targetSelector: '[data-tour="alert-banner"]',
    targetLabel: 'HELIX-AI ANALYST DIAGNOSTIC TRIAGE',
    narration: 'Instantly, our Autonomous Helix-Ai Analyst detects physiological hypoxia across the crew, broadcasts audio guidance, and formulates prioritized clinical directives.',
    durationMs: 6500,
  },
  {
    id: 'SCENARIO_RESET',
    view: 'HUD',
    stepNumber: 2,
    badge: '02 / 08 · CRITICAL SITUATION DEMO',
    title: 'Countermeasure Resolution & Normalization',
    targetSelector: '[data-tour="ai-diagnostic"]',
    targetLabel: 'CLINICAL STABILIZATION',
    action: 'RESET_NOMINAL',
    narration: 'Once emergency oxygen protocols are verified, the AI confirms crew biometric recovery and returns all telemetry channels back to nominal cruise.',
    durationMs: 5500,
  },

  // ─── 3. HEALTH & CLINICAL TELEMETRY ───
  {
    id: 'TELEMETRY_WORKSTATION',
    view: 'HEALTH_TELEMETRY',
    stepNumber: 3,
    badge: '03 / 08 · HEALTH TELEMETRY',
    title: 'Biosensor Streams & Multi-Lead Telemetry',
    targetSelector: '[data-tour="telemetry-card"]',
    targetLabel: 'CLINICAL BIOSENSOR TELEMETRY',
    narration: 'On the Health Telemetry console, crew medical officers examine real-time wearable sensor streams, pulse oximetry, and multi-day physiological trend lines.',
    durationMs: 6500,
  },

  // ─── 4. DAILY SELF-CHECK ───
  {
    id: 'SELF_CHECK_VIEW',
    view: 'SELF_ASSESSMENT',
    stepNumber: 4,
    badge: '04 / 08 · DAILY SELF-CHECK',
    title: 'Cognitive & Symptom Assessment',
    targetSelector: '[data-tour="self-assessment-card"]',
    targetLabel: 'COGNITIVE BATTERY & CHECK-IN',
    narration: 'The Self Check module provides daily cognitive assessments and symptom screenings, identifying neurological strain and fatigue before they impact mission safety.',
    durationMs: 6500,
  },

  // ─── 5. MISSION ROUTINE ───
  {
    id: 'MISSION_ROUTINE_VIEW',
    view: 'MISSION_ROUTINE',
    stepNumber: 5,
    badge: '05 / 08 · MISSION ROUTINE',
    title: 'Daily Schedule & Countermeasure Adherence',
    targetSelector: '[data-tour="routine-card"]',
    targetLabel: 'EXERCISE & OPERATIONAL SCHEDULE',
    narration: 'Under Mission Routine, daily sleep schedules, science work, and mandatory resistance exercise countermeasures are tracked to prevent bone and muscle atrophy.',
    durationMs: 6500,
  },

  // ─── 6. EARTH MISSION CONTROL ───
  {
    id: 'EARTH_MCC_VIEW',
    view: 'MCC',
    stepNumber: 6,
    badge: '06 / 08 · EARTH MISSION CONTROL',
    title: 'Houston Flight Surgeon Telemetry Console',
    targetSelector: '[data-tour="mcc-console"]',
    targetLabel: 'EARTH MISSION CONTROL CENTER (MCC)',
    narration: 'At Earth Mission Control, ground flight surgeons monitor real-time telemetry while testing simulated deep-space communication delays across planetary distances.',
    durationMs: 6500,
  },

  // ─── 7. ISS FLIGHT DECK (ONE BY ONE DETAILED INSPECTION) ───
  {
    id: 'CABIN_APPROACH',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS ARRIVAL SEQUENCE',
    title: 'Expedition 71 Rendezvous & Docking',
    targetLabel: 'PMA-2 DOCKING & AIRLOCK EQUALIZATION',
    narration: 'Approaching the International Space Station aboard Crew Dragon. Equalizing PMA-2 airlock hatch before entering the forward habitation deck.',
    durationMs: 14000,
    waitForCabinArrival: true,
  },
  {
    id: 'CABIN_HELMET',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Astronaut Helmet Visor & Clinical HUD POV',
    cabinStop: 'helmet',
    cabinDuration: 1.2,
    targetLabel: 'SUIT HUD // VISOR TELEMETRY POV',
    narration: 'Entering the astronaut suit helmet POV. The augmented reality visor projects real-time heart rate, oxygen saturation, and clinical directives directly into the astronaut\'s field of view.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_CORRIDOR',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Habitation Module Corridor & Conduits',
    cabinStop: 'corridor',
    cabinDuration: 1.2,
    targetLabel: 'CENTRAL HABITATION CORRIDOR',
    narration: 'Looking down the central corridor, structural ribs and overhead conduit raceways carry life support, power, and high-speed data lines linking the station modules.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_BOARD',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Primary Biometrics Console & Bio Monitors',
    cabinStop: 'board',
    cabinDuration: 1.2,
    targetLabel: 'PRIMARY BIOMETRICS CONSOLE',
    narration: 'Facing the primary biometrics console, these dedicated wall monitors display real-time crew cardiovascular telemetry, metabolic expenditure, and multi-lead ECG waveforms.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_CARGO',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'ECLSS Cargo Transfer Bags & Logistics',
    cabinStop: 'cargo',
    cabinDuration: 1.2,
    targetLabel: 'CTB CARGO RACK BAYS',
    narration: 'Turning to the logistics bays, standardized Cargo Transfer Bags, or CTBs, are strapped into modular racks with barcode labels tracking rations, filters, and medical kits.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_ALERTS',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Earth MCC Downlink Telemetry Terminal',
    cabinStop: 'alerts',
    cabinDuration: 1.2,
    targetLabel: 'MISSION CONTROL WALL MONITOR',
    narration: 'Here on the starboard bulkhead, this terminal displays flight surgeon advisory logs and telemetry feeds downlinked directly to Houston Mission Control in real time.',
    durationMs: 9000,
  },
  {
    id: 'CABIN_CONSOLES',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Robotic Workstation & Forward Flight Consoles',
    cabinStop: 'consoles',
    cabinDuration: 1.2,
    targetLabel: 'ROBOTIC WORKSTATION (RWS)',
    narration: 'Approaching the forward cockpit, the Robotic Workstation features multi-screen flight displays and rotational hand controllers used to operate the Canadarm2 robotic arm.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_CUPOLA',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Forward 7-Window Cupola Observation Dome',
    cabinStop: 'window',
    cabinDuration: 1.2,
    targetLabel: '7-WINDOW CUPOLA OBSERVATION DOME',
    narration: 'Entering the Cupola observation dome, seven panoramic optical windows look out over the curved blue horizon of Earth drifting below at seven point six kilometers per second.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_PHOTO',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Orbital Science Photography & Geotagging',
    cabinStop: 'photo',
    cabinDuration: 1.2,
    targetSelector: '.photo-preview-card, #btn-geotag',
    targetLabel: 'CAPTURED ORBITAL ASTROPHOTO // CUPOLA NIKON D6',
    narration: 'Through the Photo tool, astronauts operate a calibrated orbital camera. High-resolution imagery of Earth features is geotagged in real time with sub-satellite coordinates and post-processed for scientific downlink.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_BACK',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Aft Bulkhead Module Overview',
    cabinStop: 'back',
    cabinDuration: 1.2,
    targetLabel: 'AFT BULKHEAD MODULE OVERVIEW',
    narration: 'Looking back across the entire length of the module, we see the unified integration of science stowage, environmental life support, and crew quarters.',
    durationMs: 9000,
  },
  {
    id: 'CABIN_RETURN',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Airlock Hatch Nominal Cruise',
    cabinStop: 'return',
    cabinDuration: 1.2,
    targetLabel: 'AIRLOCK HATCH NOMINAL CRUISE',
    narration: 'Reaching the aft airlock hatch, the inter-module pressure seal maintains nominal cabin atmosphere during orbital cruise.',
    durationMs: 8500,
  },
  {
    id: 'CABIN_DEPLOY',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'EVA Spacewalk Deployment & Air-Lock Sorties',
    cabinStop: 'return',
    cabinDuration: 1.2,
    targetSelector: '.deploy-wrap',
    targetLabel: 'EVA SPACEWALK DEPLOYMENT SYSTEM',
    narration: 'From the EVA menu, flight controllers can deploy crew members outside on spacewalk sorties. Real-time suit telemetry monitors umbilical life support and micrometeoroid protection while outside.',
    durationMs: 9500,
  },
  {
    id: 'CABIN_CAPCOM',
    view: 'CABIN_3D',
    stepNumber: 7,
    badge: '07 / 08 · ISS FLIGHT DECK',
    title: 'Houston CAPCOM Audio & Voice Link',
    cabinStop: 'corridor',
    cabinDuration: 1.2,
    targetSelector: '#btn-capcom',
    targetLabel: 'CAPCOM QUINDAR RADIO DISPATCHES',
    narration: 'The CAPCOM system delivers authentic Houston ground-to-orbit voice communications with Quindar radio beeps, relaying medical clearances and flight director advisories to the orbiting crew.',
    durationMs: 9500,
  },

  // ─── 8. EXTERIOR ORBITAL PERSPECTIVE ───
  {
    id: 'EXTERIOR_ORBIT',
    view: 'CABIN_3D',
    stepNumber: 8,
    badge: '08 / 08 · EXTERIOR ORBIT VIEW',
    title: 'ISS Low Earth Orbit (Topside Orbital View)',
    cabinStop: 'exterior',
    cabinDuration: 1.2,
    targetSelector: '#iss-tle-location',
    targetLabel: 'REAL-TIME ORBITAL LOCATION & PASS',
    narration: 'Viewing from high above the topside of the station, the International Space Station glides across the brilliant blue curve of Earth at four hundred eight kilometers altitude, continuously tracking its live sub-satellite geographic pass in real time.',
    durationMs: 9500,
  },

  // ─── 9. COMPLETION & EXPLORATION ───
  {
    id: 'TOUR_COMPLETION',
    view: 'HUD',
    stepNumber: 8,
    badge: 'TOUR COMPLETE · READY FOR EXPLORATION',
    title: 'Tour Complete — Explore Freely',
    action: 'RESET_NOMINAL',
    targetLabel: 'H.E.L.I.O.S. OPERATIONAL',
    narration: 'That concludes our automated tour. You can now freely explore all modules, test emergency simulations, or inspect individual astronaut baselines at your own pace.',
    durationMs: 8000,
  },
];

interface ProjectTourOverlayProps {
  active: boolean;
  onEndTour: () => void;
  onSelectView: (view: 'HUD' | 'HEALTH_TELEMETRY' | 'MCC' | 'SCANNER' | 'MCC_TELEMETRY' | 'SUIT_HUD' | 'CABIN_3D' | 'DRAGON_DOCKING' | 'SELF_ASSESSMENT' | 'MISSION_ROUTINE') => void;
  onTriggerScenario: (scenarioKey: string) => void;
}

export const ProjectTourOverlay: React.FC<ProjectTourOverlayProps> = ({
  active,
  onEndTour,
  onSelectView,
  onTriggerScenario,
}) => {
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [charProgress, setCharProgress] = useState<number>(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepStartTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const currentAbortRef = useRef<AbortController | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const executedStepRef = useRef<number>(-1);
  const stepTokenRef = useRef<number>(0);

  const onSelectViewRef = useRef(onSelectView);
  onSelectViewRef.current = onSelectView;

  const onTriggerScenarioRef = useRef(onTriggerScenario);
  onTriggerScenarioRef.current = onTriggerScenario;

  const currentStep = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];
  const totalSteps = TOUR_STEPS.length;
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  // Pre-cache top natural English FEMALE voice at mount (strictly offline local voices)
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      const offlineVoices = voices.filter(
        (v) => !/online/i.test(v.name) && (v.localService === true || /desktop/i.test(v.name) || !v.name.includes('Natural'))
      );
      const pool = offlineVoices.length > 0 ? offlineVoices : voices.filter((v) => !/online/i.test(v.name));

      // Prioritize natural female voices (Zira on Windows, Samantha on macOS/iOS)
      const preferred = pool.find((v) => /zira/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /samantha/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /victoria/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /karen/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /hazel/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /catherine/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /susan/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /female/i.test(v.name) && v.lang.startsWith('en'))
        || pool.find((v) => /google.*us/i.test(v.name))
        || pool.find((v) => v.lang.startsWith('en') && (v.localService === true || /desktop/i.test(v.name)))
        || pool.find((v) => v.lang.startsWith('en'))
        || pool[0];

      if (preferred) voiceRef.current = preferred;
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Broadcast cabin camera stop when inside CABIN_3D
  const dispatchCabinStop = useCallback((stopId: string, duration?: number) => {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((ifr) => {
      try {
        ifr.contentWindow?.postMessage({ type: 'TOUR_NAVIGATE_CABIN', stopId, duration }, '*');
      } catch { }
    });
  }, []);

  const dispatchCabinStopRef = useRef(dispatchCabinStop);
  dispatchCabinStopRef.current = dispatchCabinStop;

  // Real-time NORAD/TLE Orbit Location for Exterior Orbital Perspective
  const [liveOrbitRegion, setLiveOrbitRegion] = useState<string>('');

  useEffect(() => {
    if (!active) return;
    const updateOrbit = () => {
      try {
        const ifr = document.querySelector('iframe');
        if (ifr && ifr.contentDocument) {
          const locEl = ifr.contentDocument.getElementById('iss-tle-location');
          const coordsEl = ifr.contentDocument.getElementById('iss-tle-coords');
          if (locEl && locEl.textContent) {
            const locText = locEl.textContent.trim();
            const coordsText = coordsEl?.textContent?.trim() || '';
            setLiveOrbitRegion(`${locText} · ${coordsText}`);
          }
        }
      } catch { }
    };
    updateOrbit();
    const iv = setInterval(updateOrbit, 800);
    return () => clearInterval(iv);
  }, [active]);

  // Update Spotlight Bounding Box for targetSelector with boundary clamping & smooth scrolling
  const updateHighlight = useCallback(() => {
    if (!currentStep.targetSelector) {
      setHighlightRect(null);
      return;
    }
    let el: Element | null = document.querySelector(currentStep.targetSelector);
    let ifrRect = { top: 0, left: 0 };
    if (!el) {
      const ifr = document.querySelector('iframe');
      if (ifr && ifr.contentDocument) {
        try {
          el = ifr.contentDocument.querySelector(currentStep.targetSelector);
          if (el) {
            ifrRect = ifr.getBoundingClientRect();
          }
        } catch { }
      }
    }
    if (el) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch { }
      const rect = el.getBoundingClientRect();
      const domRect = new DOMRect(
        ifrRect.left + rect.left,
        ifrRect.top + rect.top,
        rect.width,
        rect.height
      );
      setHighlightRect(domRect);
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

  // Recalculate spotlight on scroll or resize
  useEffect(() => {
    if (!active) return;
    updateHighlight();
    const interval = setInterval(updateHighlight, 300);
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [active, updateHighlight]);

  // Safely stop all speech engines (Audio element, Web Speech API, and pending fetch)
  const stopCurrentSpeech = useCallback(() => {
    // Invalidate any in-flight promises, network fetches, or audio play attempts
    stepTokenRef.current += 1;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.onended = null;
        currentAudioRef.current.ontimeupdate = null;
        currentAudioRef.current.onerror = null;
        currentAudioRef.current.src = '';
        currentAudioRef.current.load();
      } catch { }
      currentAudioRef.current = null;
    }
    if (currentBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      } catch { }
      currentBlobUrlRef.current = null;
    }
    if (currentAbortRef.current) {
      currentAbortRef.current.abort();
      currentAbortRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch { }
    }
    currentUtteranceRef.current = null;
  }, []);

  // End Tour & Return smoothly to Main Dashboard
  const handleEndTour = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    stopCurrentSpeech();
    dispatchCabinStopRef.current('close_modals');
    executedStepRef.current = -1;
    audioService.setTourMode(false);
    audioService.stopSpeaking();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch { }
    }
    onTriggerScenario('NOMINAL_CRUISE');
    onSelectView('HUD');
    onEndTour();
  }, [onTriggerScenario, onSelectView, onEndTour, stopCurrentSpeech]);

  // Advance to next step
  const goToNextStep = useCallback(() => {
    stopCurrentSpeech();
    dispatchCabinStopRef.current('close_modals');
    executedStepRef.current = -1;

    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
      elapsedBeforePauseRef.current = 0;
    } else {
      // Completed tour! Return to dashboard
      handleEndTour();
    }
  }, [stepIndex, handleEndTour, stopCurrentSpeech]);

  const goToNextStepRef = useRef(goToNextStep);
  goToNextStepRef.current = goToNextStep;

  // Step backward to previous step
  const goToPrevStep = useCallback(() => {
    stopCurrentSpeech();
    dispatchCabinStopRef.current('close_modals');
    executedStepRef.current = -1;

    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
      elapsedBeforePauseRef.current = 0;
    }
  }, [stepIndex, stopCurrentSpeech]);

  // Real-time Female Neural Voice Engine:
  // 1. Primary: Instant 0ms broadcast-grade MP3 audio (/audio/tour/step_${stepIdx}.mp3)
  // 2. Secondary: Fast local backend neural synthesis (/api/voice/synthesize?voice=en-US-JennyNeural)
  // 3. Fallback: Browser Web Speech API with female voice
  const speakCurrentStep = useCallback((stepIdx: number, text: string) => {
    if (typeof window === 'undefined') return;

    // 1. Ensure audio context and tour mode engaged
    audioService.initAudioContext();
    audioService.setEngaged(true);
    audioService.setTourMode(true);

    stopCurrentSpeech();

    const currentToken = stepTokenRef.current;
    let hasEnded = false;
    let fallbackToSynthTriggered = false;
    let fallbackToWebSpeechTriggered = false;

    // Finish step safely (guaranteed only once per step, never duplicates)
    const completeStep = (delay = 700) => {
      if (hasEnded || currentToken !== stepTokenRef.current) return;
      hasEnded = true;
      setCharProgress(text.length);

      const step = TOUR_STEPS[stepIdx];
      if (step && step.waitForCabinArrival) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (currentToken === stepTokenRef.current) {
            goToNextStepRef.current();
          }
        }, 22000);
        return;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (currentToken === stepTokenRef.current) {
          goToNextStepRef.current();
        }
      }, delay);
    };

    // Tertiary Fallback: Web Speech API (runs strictly once when audio element & backend fail)
    const speakFallbackWebSpeech = () => {
      if (hasEnded || currentToken !== stepTokenRef.current || fallbackToWebSpeechTriggered) return;
      fallbackToWebSpeechTriggered = true;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // Ensure any audio element is completely torn down
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.onended = null;
          currentAudioRef.current.ontimeupdate = null;
          currentAudioRef.current.onerror = null;
          currentAudioRef.current.src = '';
        } catch { }
        currentAudioRef.current = null;
      }
      if (currentAbortRef.current) {
        try { currentAbortRef.current.abort(); } catch { }
        currentAbortRef.current = null;
      }

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.98;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;

        let localVoice = voiceRef.current;
        if (!localVoice) {
          const voices = window.speechSynthesis.getVoices();
          const offlineVoices = voices.filter(
            (v) => !/online/i.test(v.name) && (v.localService === true || /desktop/i.test(v.name) || !v.name.includes('Natural'))
          );
          const pool = offlineVoices.length > 0 ? offlineVoices : voices.filter((v) => !/online/i.test(v.name));
          localVoice = pool.find((v) => /zira/i.test(v.name) && v.lang.startsWith('en'))
            || pool.find((v) => /samantha/i.test(v.name) && v.lang.startsWith('en'))
            || pool.find((v) => /victoria/i.test(v.name) && v.lang.startsWith('en'))
            || pool.find((v) => /karen/i.test(v.name) && v.lang.startsWith('en'))
            || pool.find((v) => /female/i.test(v.name) && v.lang.startsWith('en'))
            || pool.find((v) => v.lang.startsWith('en'))
            || pool[0] || null;
          if (localVoice) voiceRef.current = localVoice;
        }
        if (localVoice) utterance.voice = localVoice;
        currentUtteranceRef.current = utterance;

        utterance.onboundary = (e) => {
          if (currentToken === stepTokenRef.current && typeof e.charIndex === 'number') {
            setCharProgress(e.charIndex);
          }
        };

        utterance.onend = () => {
          if (currentToken !== stepTokenRef.current) return;
          completeStep(700);
        };

        utterance.onerror = (e: any) => {
          if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
          if (currentToken !== stepTokenRef.current) return;
          completeStep(1200);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis fallback error:', err);
        completeStep(2000);
      }
    };

    // Secondary Fallback: Backend Neural API (runs strictly once when static MP3 fails)
    const speakBackendNeural = () => {
      if (hasEnded || currentToken !== stepTokenRef.current || fallbackToSynthTriggered) return;
      fallbackToSynthTriggered = true;

      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.onended = null;
          currentAudioRef.current.ontimeupdate = null;
          currentAudioRef.current.onerror = null;
          currentAudioRef.current.src = '';
        } catch { }
        currentAudioRef.current = null;
      }

      const abortController = new AbortController();
      currentAbortRef.current = abortController;
      const synthUrl = `/api/voice/synthesize?${new URLSearchParams({
        text,
        voice: 'en-US-JennyNeural',
        severity: 'NOMINAL',
      }).toString()}`;

      fetch(synthUrl, { signal: abortController.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          if (hasEnded || currentToken !== stepTokenRef.current) return;
          const blobUrl = URL.createObjectURL(blob);
          currentBlobUrlRef.current = blobUrl;
          const dynamicAudio = new Audio(blobUrl);
          dynamicAudio.volume = 1.0;
          currentAudioRef.current = dynamicAudio;

          dynamicAudio.ontimeupdate = () => {
            if (currentToken === stepTokenRef.current && dynamicAudio.duration && dynamicAudio.duration > 0) {
              const ratio = dynamicAudio.currentTime / dynamicAudio.duration;
              setCharProgress(Math.min(text.length, Math.floor(ratio * text.length)));
            }
          };

          dynamicAudio.onended = () => {
            if (currentToken !== stepTokenRef.current) return;
            completeStep(700);
          };

          dynamicAudio.onerror = () => {
            if (currentToken !== stepTokenRef.current) return;
            speakFallbackWebSpeech();
          };

          dynamicAudio.play().catch((err) => {
            if (currentToken === stepTokenRef.current && err?.name !== 'AbortError') {
              speakFallbackWebSpeech();
            }
          });
        })
        .catch((err) => {
          if (err.name !== 'AbortError' && currentToken === stepTokenRef.current) {
            speakFallbackWebSpeech();
          }
        });
    };

    // Primary: Instant Static MP3 Audio
    const staticUrl = `/audio/tour/step_${stepIdx}.mp3`;
    const audio = new Audio();
    audio.src = staticUrl;
    audio.volume = 1.0;
    audio.preload = 'auto';
    currentAudioRef.current = audio;

    audio.ontimeupdate = () => {
      if (currentToken === stepTokenRef.current && audio.duration && audio.duration > 0) {
        const ratio = audio.currentTime / audio.duration;
        setCharProgress(Math.min(text.length, Math.floor(ratio * text.length)));
      }
    };

    audio.onended = () => {
      if (currentToken !== stepTokenRef.current) return;
      completeStep(700);
    };

    audio.onerror = () => {
      if (currentToken !== stepTokenRef.current || hasEnded) return;
      speakBackendNeural();
    };

    audio.play().catch((playErr) => {
      if (currentToken !== stepTokenRef.current || hasEnded) return;
      if (playErr && playErr.name === 'AbortError') return;
      speakBackendNeural();
    });
  }, [stopCurrentSpeech]);

  // Reset state whenever tour is activated
  useEffect(() => {
    if (active) {
      setStepIndex(0);
      setIsPaused(false);
      executedStepRef.current = -1;
    }
  }, [active]);

  // Synchronize ISS Arrival: When arrival animation finishes, smoothly advance to first flight deck brief
  useEffect(() => {
    if (!active) return;
    const handleCabinArrival = (e: MessageEvent) => {
      if (e.data === 'HELIOS_CABIN_ARRIVED' || e.data?.type === 'HELIOS_CABIN_ARRIVED') {
        const step = TOUR_STEPS[stepIndex];
        if (step && step.waitForCabinArrival) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            goToNextStepRef.current();
          }, 600);
        }
      }
    };
    window.addEventListener('message', handleCabinArrival);
    return () => window.removeEventListener('message', handleCabinArrival);
  }, [active, stepIndex]);

  // Execute Step Lifecycle strictly once per stepIndex change
  useEffect(() => {
    if (!active) {
      stopCurrentSpeech();
      executedStepRef.current = -1;
      audioService.setTourMode(false);
      return;
    }

    if (executedStepRef.current === stepIndex) return;
    executedStepRef.current = stepIndex;

    const step = TOUR_STEPS[stepIndex];
    if (!step) return;

    // 1. Navigate to Step View
    onSelectViewRef.current(step.view);

    // 2. Execute Action if any
    if (step.action === 'TRIGGER_SCENARIO' && step.scenarioKey) {
      onTriggerScenarioRef.current(step.scenarioKey);
    } else if (step.action === 'RESET_NOMINAL') {
      onTriggerScenarioRef.current('NOMINAL_CRUISE');
    }

    // 3. Cabin navigation if inside CABIN_3D (smooth camera transition!)
    if (step.view === 'CABIN_3D' && step.cabinStop) {
      const dur = step.cabinDuration || 1.4;
      dispatchCabinStopRef.current(step.cabinStop, dur);
      setTimeout(() => {
        dispatchCabinStopRef.current(step.cabinStop!, dur);
      }, 150);
      setTimeout(() => {
        dispatchCabinStopRef.current(step.cabinStop!, dur);
      }, 400);
    }

    // 4. Instant Voice Narration (Zero delay!)
    setCharProgress(0);
    stepStartTimeRef.current = Date.now();
    elapsedBeforePauseRef.current = 0;

    if (!isPaused) {
      speakCurrentStep(stepIndex, step.narration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [stepIndex, active, isPaused, speakCurrentStep, stopCurrentSpeech]);

  // Pause / Resume Toggle
  const togglePause = () => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      if (currentAudioRef.current && currentAudioRef.current.paused) {
        currentAudioRef.current.play().catch(() => { });
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } else {
      // Pause
      setIsPaused(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (currentAudioRef.current && !currentAudioRef.current.paused) {
        currentAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      }
    }
  };

  // Dynamic Word-by-Word Teleprompter Rendering
  const renderDynamicText = (text: string, currentPos: number) => {
    const words = text.split(' ');
    let runningLength = 0;

    return words.map((word, idx) => {
      const wordStart = runningLength;
      const wordEnd = runningLength + word.length;
      runningLength += word.length + 1; // +1 for space

      let className = 'helios-tour-word--upcoming';
      if (currentPos >= wordEnd) {
        className = 'helios-tour-word--spoken';
      } else if (currentPos >= wordStart && currentPos < wordEnd) {
        className = 'helios-tour-word--active';
      }

      return (
        <span key={`${word}-${idx}`} className={className}>
          {word}{' '}
        </span>
      );
    });
  };

  if (!active) return null;

  // Clamped spotlight dimensions to stay safely within viewport bounds
  const pad = 6;
  const rawTop = highlightRect ? highlightRect.top - pad : 0;
  const rawLeft = highlightRect ? highlightRect.left - pad : 0;
  const boxTop = highlightRect ? Math.max(6, Math.min(window.innerHeight - 60, rawTop)) : 0;
  const boxLeft = highlightRect ? Math.max(6, Math.min(window.innerWidth - 60, rawLeft)) : 0;
  const maxWidth = highlightRect ? Math.max(60, window.innerWidth - boxLeft - 12) : 0;
  const maxHeight = highlightRect ? Math.max(30, window.innerHeight - boxTop - 12) : 0;
  const boxWidth = highlightRect ? Math.min(maxWidth, highlightRect.width + pad * 2) : 0;
  const boxHeight = highlightRect ? Math.min(maxHeight, highlightRect.height + pad * 2) : 0;

  // When element is near the top edge (< 75px), place tag & pointer BELOW the box so they never clip off screen
  const isNearTop = boxTop < 75;
  // When element is in the right half of the screen, align tag to the RIGHT to avoid overflowing screen edge
  const isNearRight = highlightRect ? (highlightRect.left + highlightRect.width / 2) > (window.innerWidth / 2) : false;

  return (
    <div className="helios-tour-overlay">
      {/* ─── 1. Animated Spotlight Bounding Box ─── */}
      {highlightRect && (
        <div
          className="helios-tour-spotlight-box"
          style={{
            top: boxTop,
            left: boxLeft,
            width: boxWidth,
            height: boxHeight,
          }}
        >
          {/* Corner Brackets */}
          <div className="helios-tour-corner helios-tour-corner--tl" />
          <div className="helios-tour-corner helios-tour-corner--tr" />
          <div className="helios-tour-corner helios-tour-corner--bl" />
          <div className="helios-tour-corner helios-tour-corner--br" />

          {/* Pointer Arrow */}
          <div
            className={`helios-tour-pointer-arrow ${isNearTop ? 'helios-tour-pointer-arrow--bottom' : 'helios-tour-pointer-arrow--top'}`}
          >
            <Navigation
              size={18}
              style={{
                transform: isNearTop ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            />
          </div>

          {/* Target Element Tag */}
          {currentStep.targetLabel && (
            <div
              className={`helios-tour-target-tag ${isNearTop ? 'helios-tour-target-tag--bottom' : 'helios-tour-target-tag--top'} ${isNearRight ? 'helios-tour-target-tag--right' : 'helios-tour-target-tag--left'}`}
            >
              {currentStep.targetLabel}
            </div>
          )}
        </div>
      )}

      {/* ─── 2. Floating Subtitle Card at Bottom Center ─── */}
      <div className="helios-tour-card-container">
        <div className="helios-tour-card">
          {/* Progress Bar */}
          <div className="helios-tour-progress-track">
            <div
              className="helios-tour-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Header */}
          <div className="helios-tour-card-header">
            <div className="helios-tour-badge-group">
              <span className="helios-tour-pill">
                <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
                {currentStep.badge}
              </span>
              <span className="helios-tour-step-title">{currentStep.title}</span>
            </div>

            <div className="helios-tour-voice-indicator">
              <Volume2 size={14} color="#00f3ff" />
              <div className="helios-tour-voice-bar" />
              <div className="helios-tour-voice-bar" />
              <div className="helios-tour-voice-bar" />
              <div className="helios-tour-voice-bar" />
            </div>
          </div>

          {/* Real-time Geographic Orbit Location Badge during Exterior Topside Orbit View */}
          {currentStep.id === 'EXTERIOR_ORBIT' && liveOrbitRegion && (
            <div className="helios-tour-live-orbit-badge">
              <div className="helios-tour-live-orbit-dot" />
              <span>LIVE OVERFLIGHT // {liveOrbitRegion}</span>
            </div>
          )}

          {/* Narration Subtitle Text with Real-Time Word Tracking */}
          <div className="helios-tour-speech-text">
            {renderDynamicText(currentStep.narration, charProgress)}
          </div>

          {/* Interactive Controls Bar */}
          <div className="helios-tour-card-controls">
            <div className="helios-tour-actions-left">
              <button
                type="button"
                onClick={togglePause}
                className="helios-tour-btn"
                title={isPaused ? "Resume Tour" : "Pause Tour"}
              >
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                type="button"
                onClick={goToPrevStep}
                disabled={stepIndex === 0}
                className="helios-tour-btn"
                title="Previous Step"
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>

              <button
                type="button"
                onClick={goToNextStep}
                className="helios-tour-btn helios-tour-btn--primary"
                title="Next Step"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="helios-tour-actions-right">
              <span className="helios-tour-timer">
                {stepIndex + 1} / {totalSteps}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEndTour(e);
                }}
                className="helios-tour-btn helios-tour-btn--danger"
                title="Exit Interactive Tour"
                style={{ pointerEvents: 'auto', cursor: 'pointer', zIndex: 100030 }}
              >
                <X size={13} />
                <span>End Tour</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
