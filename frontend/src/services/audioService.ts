/**
 * frontend/src/services/audioService.ts
 * Aerospace audio synthesizer using Web Audio API for authentic flight alert tones
 * and Web Speech API with an asynchronous sequential queue to eliminate voice overlapping,
 * tone clashing, and repetitive chatter.
 */

export interface AudioConfig {
  rate?: number;
  pitch?: number;
  volume?: number;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL';
}

export interface VoiceLatencyMetrics {
  id: string;
  triggerTimestamp: number;
  firstAudioTimestamp: number;
  completionTimestamp: number;
  timeToFirstAudioMs: number;
  totalDurationMs: number;
  audioEngine: 'LOCAL_WEB_AUDIO_SPEECH_SYNTHESIS';
}

export interface SpeechQueueItem {
  id: string;
  text: string;
  tone?: 'klaxon' | 'chime' | 'beep' | 'none';
  config?: AudioConfig;
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onWord?: (wordIndex: number, progress?: number) => void;
  };
  priority: number; // 3: CRITICAL, 2: WARNING, 1: NOMINAL / Query
  timestamp: number;
}

class AudioService {
  private ctx: AudioContext | null = null;
  private isEngaged: boolean = true;
  private isTourModeActive: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private currentAbortController: AbortController | null = null;
  private selectedNeuralVoice: string = 'en-GB-RyanNeural';
  private voices: SpeechSynthesisVoice[] = [];

  // Sequential Audio Queue State
  public static readonly INTER_TRANSMISSION_PAUSE_MS: number = 0; // Zero delay for clinical alerts (instant speech)
  private lastTransmissionEndTime: number = 0;
  private breakTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: SpeechQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private activeItem: SpeechQueueItem | null = null;
  private isVoicePlaying: boolean = false;
  private recentSpoken: Map<string, number> = new Map();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: { isTransmitting: boolean; isSpeaking: boolean; isVoicePlaying: boolean }) => void> = new Set();
  private latencyHistory: VoiceLatencyMetrics[] = [];

  constructor() {
    this.initVoices();
  }

  public getLatencyMetrics(): VoiceLatencyMetrics[] {
    return [...this.latencyHistory];
  }

  public recordLatencyMetric(metric: VoiceLatencyMetrics): void {
    this.latencyHistory.unshift(metric);
    if (this.latencyHistory.length > 30) {
      this.latencyHistory.pop();
    }
  }

  public interrupt(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.currentUtterance = null;
    this.queue = [];
    this.isProcessingQueue = false;
    this.isVoicePlaying = false;
    this.activeItem = null;
    this.notifyListeners();
  }

  public setTourMode(active: boolean): void {
    this.isTourModeActive = active;
    this.speechQueue = [];
    this.stopSpeaking();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
  }

  public getTourMode(): boolean {
    return this.isTourModeActive;
  }

  public setNeuralVoice(voice: string): void {
    this.selectedNeuralVoice = voice;
  }

  public getNeuralVoice(): string {
    return this.selectedNeuralVoice;
  }

  private initVoices(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
    }
  }

  public isEmbeddedFrame(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      if (window.self !== window.top) return true;
    } catch {
      return true;
    }
    return false;
  }

  public initAudioContext(): void {
    if (this.isEmbeddedFrame()) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Autoplay policy: AudioContext will resume on first user interaction
        const unlock = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
          }
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
      });
    }
    this.isEngaged = true;
  }

  public setEngaged(engaged: boolean): void {
    this.isEngaged = engaged;
    if (engaged) {
      this.initAudioContext();
    } else {
      this.stopSpeaking();
    }
  }

  public getEngaged(): boolean {
    return this.isEngaged;
  }

  public isSpeaking(): boolean {
    return (
      this.isProcessingQueue ||
      !!this.currentAudio ||
      !!this.currentUtterance ||
      (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking)
    );
  }

  public isTransmitting(): boolean {
    return this.isProcessingQueue;
  }

  public getIsVoicePlaying(): boolean {
    return (
      this.isVoicePlaying ||
      (!!this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended) ||
      (!!this.currentUtterance && typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking)
    );
  }

  public onStateChange(listener: (state: { isTransmitting: boolean; isSpeaking: boolean; isVoicePlaying: boolean }) => void): () => void {
    this.listeners.add(listener);
    listener({
      isTransmitting: this.isTransmitting(),
      isSpeaking: this.isSpeaking(),
      isVoicePlaying: this.getIsVoicePlaying(),
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = {
      isTransmitting: this.isTransmitting(),
      isSpeaking: this.isSpeaking(),
      isVoicePlaying: this.getIsVoicePlaying(),
    };
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Normalizes raw metrics into natural spoken English for human-like AI Surgeon prosody.
   */
  public normalizeTextForSpeech(text: string): string {
    let clean = text.trim();

    // 1. Convert titles and ranks to full spoken English
    clean = clean.replace(/\b(Cmndr|Cmdr)\.?\s+/gi, 'Commander ');
    clean = clean.replace(/\bDr\.?\s+/gi, 'Doctor ');
    clean = clean.replace(/\bSpec\.?\s+/gi, 'Specialist ');

    // 2. Convert decimal percentages to whole numbers (e.g., 98.2% -> 98 percent)
    clean = clean.replace(/(\d+)\.\d+%/g, '$1 percent');
    clean = clean.replace(/(\d+)%/g, '$1 percent');

    // 3. Convert decimal heart rates (e.g., 60.8 bpm -> 61 beats per minute)
    clean = clean.replace(/(\d+)\.(\d+)\s*(?:bpm|beats per minute)/gi, (_, whole, dec) => {
      const rounded = Number(dec) >= 5 ? Number(whole) + 1 : Number(whole);
      return `${rounded} beats per minute`;
    });
    clean = clean.replace(/\bbpm\b/gi, 'beats per minute');

    // 4. Convert HRV milliseconds (e.g., 66.5 ms -> 67 milliseconds)
    clean = clean.replace(/(\d+)\.(\d+)\s*ms\b/gi, (_, whole, dec) => {
      const rounded = Number(dec) >= 5 ? Number(whole) + 1 : Number(whole);
      return `${rounded} milliseconds`;
    });

    // 5. Expand clinical, chemical, and aerospace acronyms into natural fluent speech
    clean = clean.replace(/\b(SpO2|SpO₂|SPO2)\b/g, 'oxygen saturation');
    clean = clean.replace(/\b(CO2|CO₂)\b/g, 'carbon dioxide');
    clean = clean.replace(/\bcarbon\s+di\s*oxide\b/gi, 'carbon dioxide');
    clean = clean.replace(/\b(O2|O₂)\b/g, 'oxygen');
    clean = clean.replace(/\b(N2|N₂)\b/g, 'nitrogen');
    clean = clean.replace(/\bHR\b/g, 'heart rate');
    clean = clean.replace(/\bHRV\b/g, 'heart rate variability');
    clean = clean.replace(/\b(\d+(?:\.\d+)?)\s*mmHg\b/gi, '$1 millimeters of mercury');
    clean = clean.replace(/\bmmHg\b/gi, 'millimeters of mercury');
    clean = clean.replace(/\bK\+?\b|\bK⁺\b/g, 'potassium');
    clean = clean.replace(/\bIL-?6\b/gi, 'interleukin six');
    clean = clean.replace(/\bHCT\b/g, 'hematocrit');
    clean = clean.replace(/\bWBC\b/g, 'white blood cells');
    clean = clean.replace(/\bPLT\b/g, 'platelets');
    clean = clean.replace(/\bIV\b/g, 'intravenous');
    clean = clean.replace(/°C/g, ' degrees Celsius');
    clean = clean.replace(/\bZ-Score\b/gi, 'variance score');
    clean = clean.replace(/\bZ:\s*/gi, 'variance ');

    // 6. Strip Markdown asterisks, backticks, hashes
    clean = clean.replace(/[*_#`~]/g, '');

    return clean;
  }

  /**
   * Synthesizes authentic aerospace alert tones via Web Audio API.
  /**
   * Synthesizes authentic aerospace alert tones via Web Audio API.
   * Differentiates acoustic tones across NOMINAL, WARNING, and CRITICAL states.
   */
  public playTone(
    tone: 'klaxon' | 'chime' | 'beep' | 'none',
    severity?: 'CRITICAL' | 'WARNING' | 'INFO' | 'NOMINAL'
  ): void {
    if (this.isTourModeActive || tone === 'none') return;
    if (!this.isEngaged || this.isEmbeddedFrame()) return;
    this.initAudioContext();
    if (!this.ctx) return;

    try {
      if (severity === 'CRITICAL' || tone === 'klaxon') {
        this.playCriticalKlaxon();
      } else if (severity === 'WARNING' || tone === 'chime') {
        this.playWarningChime();
      } else if (severity === 'NOMINAL' && tone !== 'none' && tone !== 'beep') {
        this.playNominalChime();
      } else if (tone === 'beep') {
        this.playBeep();
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  }

  /**
   * CRITICAL: Aviation-grade NASA ISS Master Alarm — dual-tone acoustic pulse warble.
   * Modeled after Apollo / Space Shuttle / ISS emergency tone standards (1017 Hz / 840 Hz sine chimes).
   */
  private playCriticalKlaxon(): void {
    if (!this.ctx || !this.isEngaged) return;
    const now = this.ctx.currentTime;

    const pulses = [
      { f: 1017, startOffset: 0.00, duration: 0.16 },
      { f: 840, startOffset: 0.20, duration: 0.16 },
      { f: 1017, startOffset: 0.40, duration: 0.16 },
      { f: 840, startOffset: 0.60, duration: 0.16 },
    ];

    pulses.forEach(({ f, startOffset, duration }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + startOffset);

      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.linearRampToValueAtTime(0.16, now + startOffset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    });
  }

  /**
   * WARNING: NASA/CAPCOM-style authoritative caution tone.
   * Descending two-note pattern (high→low) — unmistakable and professional.
   * Used in actual mission control for non-emergency flight advisories.
   */
  private playWarningChime(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Note 1: High tone — sharp, attention-grabbing
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(960, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.20, now + 0.015);
    gain1.gain.setValueAtTime(0.20, now + 0.10);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Note 2: Low tone — authoritative resolution drop
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(640, now + 0.18);
    gain2.gain.setValueAtTime(0.001, now + 0.18);
    gain2.gain.linearRampToValueAtTime(0.17, now + 0.195);
    gain2.gain.setValueAtTime(0.17, now + 0.30);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.46);
  }

  /**
   * NOMINAL: Gentle, soothing warm harmonic bell (528 Hz + 660 Hz). Reassuring and calm.
   */
  private playNominalChime(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    [528.0, 660.0].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.04 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.40);
    });
  }

  /**
   * BEEP: Crisp radio-click acknowledgment tone (ATC/CAPCOM channel open).
   * 1200 Hz clean sine with sharp envelope — sounds like a real radio handset.
   */
  private playBeep(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Two very short click-in pulses (like keying a radio mic)
    [0, 0.11].forEach((offset) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now + offset);
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.13, now + offset + 0.008);
      gain.gain.setValueAtTime(0.13, now + offset + 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.085);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  public findNaturalAiSurgeonVoice(): SpeechSynthesisVoice | null {
    if (this.voices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }

    // High-priority local desktop voices (100% reliable offline, zero network latency)
    // Strictly filter out any Microsoft Edge / Chrome "Online" voices which fail on localhost
    const offlineVoices = this.voices.filter(
      (v) => !/online/i.test(v.name) && (v.localService === true || /desktop/i.test(v.name) || !v.name.includes('Natural'))
    );
    const pool = offlineVoices.length > 0 ? offlineVoices : this.voices.filter((v) => !/online/i.test(v.name));

    const priorityMatchers = [
      (v: SpeechSynthesisVoice) => /david/i.test(v.name) && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => /zira/i.test(v.name) && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => /mark/i.test(v.name) && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => /google.*us/i.test(v.name),
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en') && (v.localService === true || /desktop/i.test(v.name)),
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
    ];

    for (const matcher of priorityMatchers) {
      const match = pool.find(matcher);
      if (match) return match;
    }

    return pool[0] || this.voices.find((v) => !/online/i.test(v.name)) || this.voices[0] || null;
  }

  /**
   * Enqueues a speech statement to be played sequentially without overlapping.
   */
  public queueSpeech(item: {
    text: string;
    tone?: 'klaxon' | 'chime' | 'beep' | 'none';
    config?: AudioConfig;
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onWord?: (wordIndex: number, progress?: number) => void;
    };
    priority?: number;
  }): void {
    if (typeof window === 'undefined' || this.isEmbeddedFrame() || this.isTourModeActive) {
      return;
    }
    if (!this.isEngaged) {
      return;
    }
    try {
      this.initAudioContext();
    } catch { }

    const rawText = item.text.trim();
    if (!rawText) return;

    const severity = item.config?.severity || 'NOMINAL';
    const priority = item.priority ?? (severity === 'CRITICAL' ? 3 : severity === 'WARNING' ? 2 : 1);

    // Anti-duplication check: ignore if identical sentence was spoken in the last 4 seconds
    // Only apply if no callbacks are attached (background chatter deduplication; UI actions always speak)
    const now = Date.now();
    if (!item.callbacks) {
      const lastSpoken = this.recentSpoken.get(rawText);
      if (lastSpoken && now - lastSpoken < 4000) {
        return;
      }
      this.recentSpoken.set(rawText, now);
    }

    // Prune stale cache entries
    for (const [key, ts] of this.recentSpoken.entries()) {
      if (now - ts > 20000) {
        this.recentSpoken.delete(key);
      }
    }

    // Strict Clinical Guard: If an active emergency scenario is unresolved,
    // NEVER announce that all systems are nominal! Nominal announcements are strictly prohibited
    // until all issues have been resolved/nominal and mission is back in NOMINAL_CRUISE.
    const activeScenario = typeof localStorage !== 'undefined' ? localStorage.getItem('helios_scenario') : null;
    const isScenarioActive = Boolean(activeScenario && activeScenario !== 'NOMINAL_CRUISE');
    if (isScenarioActive) {
      const lower = rawText.toLowerCase();
      const isNominalAnnouncement = (
        severity === 'NOMINAL' ||
        lower.includes('all systems nominal') ||
        lower.includes('systems continue nominal') ||
        lower.includes('baselines within nominal') ||
        lower.includes('flight cruise restored') ||
        lower.includes('all crew vital signs are stable and within safe limits')
      );
      if (isNominalAnnouncement) {
        return; // Suppress premature nominal announcement during active unresolved scenario
      }
    }

    const queueItem: SpeechQueueItem = {
      id: `sq_${now}_${Math.random().toString(36).slice(2, 6)}`,
      text: rawText,
      tone: item.tone || 'none',
      config: item.config,
      callbacks: item.callbacks,
      priority,
      timestamp: now,
    };

    // If life-safety ALERT (CRITICAL or WARNING) and current active is lower/equal priority, clear queue and preempt immediately
    if (priority >= 2 && this.activeItem && this.activeItem.priority <= priority) {
      this.stopSpeaking();
      this.queue = [];
      this.queue.unshift(queueItem);
      this.processQueue();
      return;
    }

    // Insert sorted by priority (higher priority first), maintaining FIFO within same priority
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (queueItem.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, queueItem);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(queueItem);
    }

    this.processQueue();
  }

  /**
   * Processes the audio queue sequentially, guaranteeing one message completes before the next begins.
   * Pre-fetches neural audio as a Blob to prevent buffering/streaming decoding errors,
   * cancels any residual Web Speech voices, and strictly eliminates voice overlapping.
   */
  private async processQueue(): Promise<void> {
    if (!this.isEngaged || this.isProcessingQueue || this.queue.length === 0) {
      return;
    }

    // Enforce 3.5-second quiet break after previous transmission finishes
    const elapsedSinceLast = Date.now() - this.lastTransmissionEndTime;
    if (this.lastTransmissionEndTime > 0 && elapsedSinceLast < AudioService.INTER_TRANSMISSION_PAUSE_MS) {
      const remainingWait = AudioService.INTER_TRANSMISSION_PAUSE_MS - elapsedSinceLast;
      if (!this.breakTimer) {
        this.breakTimer = setTimeout(() => {
          this.breakTimer = null;
          this.processQueue();
        }, remainingWait);
      }
      return;
    }

    this.isProcessingQueue = true;
    this.notifyListeners();
    const item = this.queue.shift()!;
    this.activeItem = item;

    // CRITICAL: Always cancel any previous or background Web Speech synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 1. Prepare normalized speech text immediately
    const spokenText = this.normalizeTextForSpeech(item.text);
    const severity = item.config?.severity || 'NOMINAL';

    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    // 2. Play severity-differentiated Alert Tone immediately
    if (item.tone && item.tone !== 'none') {
      this.playTone(item.tone, severity);
      const toneDuration = severity === 'CRITICAL' ? 180 : severity === 'WARNING' ? 140 : 100;
      await new Promise((resolve) => setTimeout(resolve, toneDuration));
    }

    // Emotional Prosody Calibration: Natural, crisp conversational pace with clean pauses
    const targetRate = item.config?.rate ?? (severity === 'CRITICAL' ? 1.05 : 1.0);
    const targetPitch = item.config?.pitch ?? 1.0;
    const targetVolume = item.config?.volume ?? (severity === 'CRITICAL' ? 1.0 : severity === 'WARNING' ? 0.98 : 0.95);

    // 3. Instantaneous zero-delay aerospace vocal synthesis via Web Speech API
    this.speakWebSpeech(spokenText, item, targetRate, targetPitch, targetVolume);
  }

  /**
   * Authoritative, zero-delay client-side SpeechSynthesis with natural human prosody.
   */
  private speakWebSpeech(
    spokenText: string,
    item: SpeechQueueItem,
    targetRate: number,
    targetPitch: number,
    targetVolume: number
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isProcessingQueue = false;
      this.activeItem = null;
      this.notifyListeners();
      return;
    }

    // Always clear browser speech synthesis queue before starting fallback
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    this.currentUtterance = utterance;

    utterance.rate = targetRate;
    utterance.pitch = targetPitch;
    utterance.volume = targetVolume;

    const naturalVoice = this.findNaturalAiSurgeonVoice();
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    const triggerTime = performance.now();
    let firstAudioTime = 0;

    const words = spokenText.split(/\s+/).filter(Boolean);
    let wordCount = 0;
    let boundaryFired = false;
    // Calibrate Web Speech pacing: ~210ms per word with +120ms anticipation
    const msPerWord = Math.max(130, Math.round(210 / targetRate));
    const totalEstimatedMs = Math.max(400, (words.length * msPerWord) - 250);
    let speechTimer: ReturnType<typeof setInterval> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let startTime = 0;

    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      boundaryFired = true;
      if (e.name === 'word' && typeof e.charIndex === 'number') {
        const textBefore = spokenText.slice(0, e.charIndex);
        const wordIdx = textBefore.trim().split(/\s+/).filter(Boolean).length;
        const charProgress = spokenText.length > 0 ? Math.min(1.0, (e.charIndex + 4) / spokenText.length) : 0;
        item.callbacks?.onWord?.(wordIdx, charProgress);
      } else {
        const progress = Math.min(1.0, (wordCount + 1) / Math.max(words.length, 1));
        item.callbacks?.onWord?.(wordCount++, progress);
      }
    };

    utterance.onstart = () => {
      firstAudioTime = performance.now();
      this.isVoicePlaying = true;
      this.notifyListeners();
      item.callbacks?.onStart?.();
      startTime = Date.now();

      // Continuous progress timer in case browser does not support onboundary
      speechTimer = setInterval(() => {
        if (!boundaryFired && startTime > 0) {
          const elapsed = Date.now() - startTime + 120;
          const progress = Math.min(0.99, elapsed / totalEstimatedMs);
          const targetWordIdx = Math.min(words.length - 1, Math.floor(progress * words.length));
          item.callbacks?.onWord?.(targetWordIdx, progress);
        }
      }, 40);

      // Robust fallback completion timer: guarantees onEnd fires even if Chrome drops onend event!
      safetyTimer = setTimeout(() => {
        if (this.currentUtterance === utterance) {
          handleComplete();
        }
      }, totalEstimatedMs + 1800);
    };

    const handleComplete = () => {
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      this.isVoicePlaying = false;
      this.notifyListeners();
      if (speechTimer) {
        clearInterval(speechTimer);
        speechTimer = null;
      }
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      this.currentUtterance = null;
      this.activeItem = null;
      this.lastTransmissionEndTime = Date.now();
      item.callbacks?.onWord?.(words.length - 1, 1.0);
      item.callbacks?.onEnd?.();

      const completionTime = performance.now();
      this.recordLatencyMetric({
        id: item.id,
        triggerTimestamp: triggerTime,
        firstAudioTimestamp: firstAudioTime || completionTime,
        completionTimestamp: completionTime,
        timeToFirstAudioMs: Math.max(1, Math.round((firstAudioTime || completionTime) - triggerTime)),
        totalDurationMs: Math.max(1, Math.round(completionTime - triggerTime)),
        audioEngine: 'LOCAL_WEB_AUDIO_SPEECH_SYNTHESIS',
      });

      if (AudioService.INTER_TRANSMISSION_PAUSE_MS <= 0) {
        this.isProcessingQueue = false;
        this.notifyListeners();
        this.processQueue();
      } else {
        if (this.breakTimer) {
          clearTimeout(this.breakTimer);
        }
        this.breakTimer = setTimeout(() => {
          this.breakTimer = null;
          this.isProcessingQueue = false;
          this.notifyListeners();
          this.processQueue();
        }, AudioService.INTER_TRANSMISSION_PAUSE_MS);
      }
    };

    utterance.onend = handleComplete;
    utterance.onerror = handleComplete;

    this.keepAliveTimer = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Backward-compatible speak method, routing through the sequential queue.
   */
  public speak(
    text: string,
    config?: AudioConfig,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onWord?: (wordIndex: number, progress?: number) => void;
    }
  ): void {
    this.queueSpeech({
      text,
      tone: 'none',
      config,
      callbacks,
    });
  }

  public stopKlaxon(): void {
    this.stopSpeaking();
  }

  public stopSpeaking(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.onerror = null;
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {
        // no-op
      }
      this.currentAudio = null;
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    this.activeItem = null;
    this.isProcessingQueue = false;
    this.isVoicePlaying = false;
    this.queue = [];
    this.lastTransmissionEndTime = 0;
    this.recentSpoken.clear();
    this.notifyListeners();
  }

  public isInTransmissionBreak(): boolean {
    if (this.isSpeaking()) return false;
    return (Date.now() - this.lastTransmissionEndTime) < AudioService.INTER_TRANSMISSION_PAUSE_MS;
  }

  public getLastTransmissionEndTime(): number {
    return this.lastTransmissionEndTime;
  }
}

export const audioService = new AudioService();
