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

export interface SpeechQueueItem {
  id: string;
  text: string;
  tone?: 'klaxon' | 'chime' | 'beep' | 'none';
  config?: AudioConfig;
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onWord?: (wordIndex: number) => void;
  };
  priority: number; // 3: CRITICAL, 2: WARNING, 1: NOMINAL / Query
  timestamp: number;
}

class AudioService {
  private ctx: AudioContext | null = null;
  private isEngaged: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private currentAbortController: AbortController | null = null;
  private selectedNeuralVoice: string = 'en-GB-RyanNeural';
  private voices: SpeechSynthesisVoice[] = [];

  // Sequential Audio Queue State
  public static readonly INTER_TRANSMISSION_PAUSE_MS: number = 3500; // 3.5s quiet break after each voice transmission
  private lastTransmissionEndTime: number = 0;
  private breakTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: SpeechQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private activeItem: SpeechQueueItem | null = null;
  private recentSpoken: Map<string, number> = new Map();
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initVoices();
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

  public initAudioContext(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
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

  /**
   * Normalizes raw metrics into natural spoken English for human-like JARVIS prosody.
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
    if (!this.isEngaged) return;
    this.initAudioContext();
    if (!this.ctx) return;

    try {
      if (severity === 'CRITICAL' || tone === 'klaxon') {
        this.playCriticalKlaxon();
      } else if (severity === 'WARNING' || tone === 'chime') {
        this.playWarningChime();
      } else if (severity === 'NOMINAL') {
        this.playNominalChime();
      } else if (tone === 'beep') {
        this.playBeep();
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  }

  /**
   * CRITICAL: Urgent dual-pulsed aerospace alarm.
   */
  private playCriticalKlaxon(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.24);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.36);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(1.5, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.48);
  }

  /**
   * WARNING: Clear, polite, two-tone ascending flight advisory chime (587 Hz D5 -> 880 Hz A5).
   */
  private playWarningChime(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const notes = [
      { freq: 587.33, start: 0, dur: 0.22, vol: 0.12 },
      { freq: 880.00, start: 0.08, dur: 0.32, vol: 0.14 }
    ];

    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);

      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.linearRampToValueAtTime(n.vol, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.05);
    });
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

  private playBeep(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  private findNaturalJarvisVoice(): SpeechSynthesisVoice | null {
    if (this.voices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }

    // High-priority matchers favoring warm, natural, human voices
    const priorityMatchers = [
      (v: SpeechSynthesisVoice) => /ryan.*natural/i.test(v.name),
      (v: SpeechSynthesisVoice) => /christopher.*natural/i.test(v.name),
      (v: SpeechSynthesisVoice) => /george.*natural/i.test(v.name),
      (v: SpeechSynthesisVoice) => /guy.*natural/i.test(v.name),
      (v: SpeechSynthesisVoice) => /jenny.*natural/i.test(v.name),
      (v: SpeechSynthesisVoice) => /natural/i.test(v.name) && (v.lang === 'en-GB' || v.lang.startsWith('en')),
      // High-quality British & natural voices
      (v: SpeechSynthesisVoice) => /google.*uk.*male/i.test(v.name),
      (v: SpeechSynthesisVoice) => /daniel/i.test(v.name) && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => v.lang === 'en-GB',
      (v: SpeechSynthesisVoice) => /google.*uk.*female/i.test(v.name),
      (v: SpeechSynthesisVoice) => /google.*us/i.test(v.name),
      // Local desktop fallbacks
      (v: SpeechSynthesisVoice) => /mark/i.test(v.name) && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => /zira/i.test(v.name) && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
    ];

    for (const matcher of priorityMatchers) {
      const match = this.voices.find(matcher);
      if (match) return match;
    }

    return null;
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
      onWord?: (wordIndex: number) => void;
    };
    priority?: number;
  }): void {
    if (!this.isEngaged || typeof window === 'undefined') {
      return;
    }

    const rawText = item.text.trim();
    if (!rawText) return;

    const severity = item.config?.severity || 'NOMINAL';
    const priority = item.priority ?? (severity === 'CRITICAL' ? 3 : severity === 'WARNING' ? 2 : 1);

    // Anti-duplication check: ignore if identical sentence was spoken in the last 8 seconds
    const now = Date.now();
    const lastSpoken = this.recentSpoken.get(rawText);
    if (lastSpoken && now - lastSpoken < 8000) {
      return;
    }
    this.recentSpoken.set(rawText, now);

    // Prune stale cache entries
    for (const [key, ts] of this.recentSpoken.entries()) {
      if (now - ts > 20000) {
        this.recentSpoken.delete(key);
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

    // If life-safety CRITICAL and current active is lower priority, clear non-critical and pre-empt
    if (priority === 3 && this.activeItem && this.activeItem.priority < 3) {
      this.stopSpeaking();
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
    const item = this.queue.shift()!;
    this.activeItem = item;

    // CRITICAL: Always cancel any previous or background Web Speech synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 1. Prepare normalized speech text immediately
    const spokenText = this.normalizeTextForSpeech(item.text);
    const severity = item.config?.severity || 'NOMINAL';

    // 2. Prepare neural fetch immediately in parallel with alert tone (pass severity for distinct pitch & cadence)
    const voiceParam = encodeURIComponent(this.selectedNeuralVoice);
    const textParam = encodeURIComponent(spokenText);
    const sevParam = encodeURIComponent(severity);
    const neuralUrl = `/api/voice/synthesize?text=${textParam}&voice=${voiceParam}&severity=${sevParam}`;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    const controller = new AbortController();
    this.currentAbortController = controller;

    // Launch neural TTS fetch concurrently
    const fetchPromise = fetch(neuralUrl, { signal: controller.signal });

    // 3. Play severity-differentiated Alert Tone concurrently
    if (item.tone && item.tone !== 'none') {
      this.playTone(item.tone, severity);
      const toneDuration = severity === 'CRITICAL' ? 340 : severity === 'WARNING' ? 240 : 160;
      await new Promise((resolve) => setTimeout(resolve, toneDuration));
    }

    // Emotional Prosody Calibration: Measured, calm, authoritative delivery
    let targetRate = item.config?.rate ?? 1.0;
    let targetPitch = item.config?.pitch ?? 1.0;
    let targetVolume = item.config?.volume ?? 0.95;

    if (severity === 'CRITICAL') {
      targetRate = item.config?.rate ?? 0.90;
      targetPitch = item.config?.pitch ?? 1.00;
      targetVolume = 1.0;
    } else if (severity === 'WARNING') {
      targetRate = item.config?.rate ?? 0.93;
      targetPitch = item.config?.pitch ?? 0.97;
      targetVolume = 0.98;
    } else {
      targetRate = item.config?.rate ?? 1.0;
      targetPitch = item.config?.pitch ?? 0.96;
      targetVolume = 0.92;
    }

    // 4. Fetch neural audio blob with generous 8000ms budget — prevents accidental fallback to robotic desktop voice
    try {
      const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Neural audio fetch exceeded 8000ms budget')), 8000)
      );
      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (!res.ok) {
        throw new Error(`Neural audio endpoint HTTP ${res.status}`);
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Neural audio response is empty');
      }

      // Ensure Web Speech is completely cancelled before starting audio
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Cleanup any previous audio element or blob URL
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio = null;
      }
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }

      const blobUrl = URL.createObjectURL(blob);
      this.currentBlobUrl = blobUrl;
      const audio = new Audio(blobUrl);
      audio.volume = targetVolume;
      audio.playbackRate = targetRate;
      this.currentAudio = audio;

      const words = spokenText.split(/\s+/).filter(Boolean);
      let lastReportedWordIndex = -1;
      let wordProgressTimer: ReturnType<typeof setInterval> | null = null;

      let completed = false;
      const cleanupAndNext = () => {
        if (completed) return;
        completed = true;
        if (wordProgressTimer) {
          clearInterval(wordProgressTimer);
          wordProgressTimer = null;
        }
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (this.currentBlobUrl === blobUrl) {
          URL.revokeObjectURL(blobUrl);
          this.currentBlobUrl = null;
        }
        this.activeItem = null;
        this.lastTransmissionEndTime = Date.now();
        item.callbacks?.onEnd?.();

        // Enforce 3.5s quiet break after voice transmission before next queued transmission begins
        if (this.breakTimer) {
          clearTimeout(this.breakTimer);
        }
        this.breakTimer = setTimeout(() => {
          this.breakTimer = null;
          this.isProcessingQueue = false;
          this.processQueue();
        }, AudioService.INTER_TRANSMISSION_PAUSE_MS);
      };

      // Real-time word-by-word synchronization with audio playback
      audio.ontimeupdate = () => {
        if (!audio.duration || audio.duration === 0) return;
        const progress = Math.min(1.0, audio.currentTime / audio.duration);
        const wordIdx = Math.min(words.length - 1, Math.floor(progress * words.length));
        if (wordIdx > lastReportedWordIndex) {
          lastReportedWordIndex = wordIdx;
          item.callbacks?.onWord?.(wordIdx);
        }
      };

      // onplay fires the moment audio actually begins — starts word streaming
      audio.onplay = () => {
        item.callbacks?.onStart?.();

        // Smooth high-resolution word ticker ensuring steady word-by-word streaming
        const estDuration = audio.duration || (words.length * 0.35);
        const msPerWord = Math.max(160, (estDuration * 1000) / Math.max(words.length, 1));
        let curIdx = 0;
        wordProgressTimer = setInterval(() => {
          if (audio.paused || audio.ended) {
            if (wordProgressTimer) clearInterval(wordProgressTimer);
            return;
          }
          if (curIdx < words.length) {
            if (curIdx > lastReportedWordIndex) {
              lastReportedWordIndex = curIdx;
              item.callbacks?.onWord?.(curIdx);
            }
            curIdx++;
          }
        }, msPerWord);
      };

      audio.onended = cleanupAndNext;
      audio.onerror = (e) => {
        console.error('Playback error on neural audio blob:', e);
        cleanupAndNext();
      };

      await audio.play();
      return;

    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      this.fallbackWebSpeech(spokenText, item, targetRate, targetPitch, targetVolume);
    }
  }

  /**
   * Graceful degraded fallback using client-side SpeechSynthesis if backend neural audio is unreachable.
   */
  private fallbackWebSpeech(
    spokenText: string,
    item: SpeechQueueItem,
    targetRate: number,
    targetPitch: number,
    targetVolume: number
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isProcessingQueue = false;
      this.activeItem = null;
      return;
    }

    // Always clear browser speech synthesis queue before starting fallback
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    this.currentUtterance = utterance;

    utterance.rate = targetRate;
    utterance.pitch = targetPitch;
    utterance.volume = targetVolume;

    const naturalVoice = this.findNaturalJarvisVoice();
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    const words = spokenText.split(/\s+/).filter(Boolean);
    let wordCount = 0;
    let boundaryFired = false;
    let fallbackWordIdx = 0;
    const msPerWord = Math.max(160, Math.round(330 / targetRate));
    let speechTimer: ReturnType<typeof setInterval> | null = null;

    utterance.onboundary = () => {
      boundaryFired = true;
      item.callbacks?.onWord?.(wordCount++);
    };

    utterance.onstart = () => {
      item.callbacks?.onStart?.();
      // Backup timer in case browser does not support utterance onboundary
      speechTimer = setInterval(() => {
        if (!boundaryFired && fallbackWordIdx < words.length) {
          item.callbacks?.onWord?.(fallbackWordIdx++);
        }
      }, msPerWord);
    };

    const handleComplete = () => {
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
      item.callbacks?.onEnd?.();

      // Enforce 3.5s quiet break after voice transmission before next queued transmission begins
      if (this.breakTimer) {
        clearTimeout(this.breakTimer);
      }
      this.breakTimer = setTimeout(() => {
        this.breakTimer = null;
        this.isProcessingQueue = false;
        this.processQueue();
      }, AudioService.INTER_TRANSMISSION_PAUSE_MS);
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
      onWord?: (wordIndex: number) => void;
    }
  ): void {
    this.queueSpeech({
      text,
      tone: 'none',
      config,
      callbacks,
    });
  }

  public stopSpeaking(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    if (this.currentAudio) {
      try {
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
    this.queue = [];
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
