/**
 * NASA-Grade Procedural Audio & Telemetry Sound Engine for HELIOS ISS Deck.
 * Synthesizes cinematic space intro ambiance, ISS ECLSS life-support ventilation,
 * RCS thrusters, avionics telemetry confirmation chirps, and cardiac heartbeats
 * via Web Audio API. 100% self-contained, no external MP3 dependencies.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.on = true; // Auto sound ON by default
    this.masterGain = null;
    this.ambienceGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.heartbeatTimer = null;
    this.musicOscs = [];
    this.masterAlarmActive = false;
    this.masterAlarmTimer = null;

    // Auto-unlock Web Audio on first user interaction if suspended by browser policy
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            if (this.on && this.masterGain) {
              this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
            }
          });
        }
      };
      ['click', 'pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => {
        window.addEventListener(ev, unlock, { once: false, passive: true });
      });
    }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = (this.ctx = new AudioCtx());

    // Master bus (initialized to 0.9 for auto-sound)
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.9;
    this.masterGain.connect(ctx.destination);

    // Sub-busses
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.45;
    this.musicGain.connect(this.masterGain);

    this.ambienceGain = ctx.createGain();
    this.ambienceGain.gain.value = 0.6;
    this.ambienceGain.connect(this.masterGain);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);

    this._setupCabinECLSS();
  }

  /** Ambient ISS Life Support Ventilation Hum (55Hz / 110Hz + soft air noise) */
  _setupCabinECLSS() {
    const ctx = this.ctx;
    // Harmonic ventilation drone: 55Hz, 110Hz, 165Hz
    [55, 110.2, 165].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = idx === 0 ? 0.08 : 0.03 / (idx + 1);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;

      osc.connect(lp);
      lp.connect(g);
      g.connect(this.ambienceGain);
      osc.start();
    });

    // Air circulation pink-noise filtered hiss
    const bufLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.18;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    noiseSource.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.55;

    const ng = ctx.createGain();
    ng.gain.value = 0.028;

    noiseSource.connect(bp);
    bp.connect(ng);
    ng.connect(this.ambienceGain);
    noiseSource.start();
  }

  /** Cinematic space intro ambient synth pad */
  playIntroAtmosphere() {
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Chord progression notes (D2, A2, D3, F3, C4)
    const freqs = [73.42, 110.0, 146.83, 174.61, 261.63];
    this.stopIntroAtmosphere();

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime);

      // Subtle detune for shimmer
      osc.detune.setValueAtTime((i % 2 === 0 ? 1 : -1) * 7, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(750, ctx.currentTime + 6.0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.045 / (i + 1), ctx.currentTime + 3.0);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start();

      this.musicOscs.push({ osc, gain });
    });
  }

  /** Smoothly fade out intro music */
  stopIntroAtmosphere(fadeDuration = 2.5) {
    if (!this.ctx || !this.musicOscs.length) return;
    const now = this.ctx.currentTime;
    this.musicOscs.forEach(({ osc, gain }) => {
      try {
        gain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);
        setTimeout(() => { try { osc.stop(); } catch(e){} }, fadeDuration * 1000 + 100);
      } catch (e) {}
    });
    this.musicOscs = [];
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;
    this.on = !this.on;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.masterGain.gain.linearRampToValueAtTime(this.on ? 0.85 : 0, this.ctx.currentTime + 0.2);
    if (!this.on) {
      this.stopAllAlarms();
      if (this.sfxGain) this.sfxGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.musicGain) this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.ambienceGain) this.ambienceGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } else {
      if (this.sfxGain) this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      if (this.musicGain) this.musicGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
      if (this.ambienceGain) this.ambienceGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
      this.playChirp();
    }
    return this.on;
  }

  /** Crisp aerospace telemetry confirmation chirp */
  playChirp(high = false) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    const startF = high ? 2400 : 1760;
    const endF = high ? 3200 : 2340;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startF, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endF, c.currentTime + 0.045);

    g.gain.setValueAtTime(0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(c.currentTime + 0.055);
  }

  /** Tactile UI mechanical click */
  playClick() {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.03);

    g.gain.setValueAtTime(0.09, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.035);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(c.currentTime + 0.04);
  }

  /** Orbital RCS thruster burst / camera fly whoosh */
  whoosh(len = 1.4) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const s = c.createBufferSource();
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(140, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(2400, c.currentTime + len * 0.7);

    const g = c.createGain();
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.35, c.currentTime + len * 0.4);
    g.gain.linearRampToValueAtTime(0.001, c.currentTime + len);

    s.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    s.start();
  }

  /** NASA caution/warning dual-tone alert chime */
  playAlertTone() {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    [1046.5, 1318.5].forEach((freq, idx) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + idx * 0.12);

      g.gain.setValueAtTime(0, c.currentTime + idx * 0.12);
      g.gain.linearRampToValueAtTime(0.18, c.currentTime + idx * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + idx * 0.12 + 0.28);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(c.currentTime + idx * 0.12);
      osc.stop(c.currentTime + idx * 0.12 + 0.3);
    });
  }

  /** Cardiac ECG beep pulse */
  playHeartbeat() {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(840, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, c.currentTime + 0.06);

    g.gain.setValueAtTime(0.07, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.065);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(c.currentTime + 0.07);
  }

  /**
   * Aviation-grade MASTER WARNING — authentic dual-pulse klaxon alarm.
   * Modeled after ISS emergency and aircraft GPWS warning systems.
   * Two sharp sawtooth bursts with waveshaper distortion and rapid pitch sweeps.
   */
  /**
   * Aviation-grade NASA ISS Master Alarm — authentic dual-tone acoustic pulse warble.
   * Modeled after Apollo / Space Shuttle / ISS emergency tone standards (1017 Hz / 840 Hz sine chimes).
   * Pleasant, crisp, high-tech, and never abrasive. Strictly honors sound toggle (silent if muted).
   */
  playCriticalKlaxon() {
    if (!this.on) return;
    if (!this.ctx) this.init();
    if (!this.ctx || !this.on) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pulses = [
      { f: 1017, start: 0.00, dur: 0.16 },
      { f: 840,  start: 0.20, dur: 0.16 },
      { f: 1017, start: 0.40, dur: 0.16 },
      { f: 840,  start: 0.60, dur: 0.16 },
    ];

    pulses.forEach(({ f, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.linearRampToValueAtTime(0.16, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(gain);
      gain.connect(this.sfxGain || this.masterGain || ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  }

  /** Starts repeating master alarm while a critical situation persists */
  startMasterAlarm() {
    if (!this.on) return;
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.stopCautionAlarm();
    if (this.masterAlarmActive) return;
    this.masterAlarmActive = true;
    const now = performance.now();
    if (!this._lastMasterAlarmTime || now - this._lastMasterAlarmTime > 1800) {
      this._lastMasterAlarmTime = now;
      this.playCriticalKlaxon();
    }
    if (this.masterAlarmTimer) clearInterval(this.masterAlarmTimer);
    this.masterAlarmTimer = setInterval(() => {
      if (this.masterAlarmActive && this.on) {
        this.playCriticalKlaxon();
      } else {
        this.stopMasterAlarm();
      }
    }, 4200);
  }

  /** Starts repeating caution alarm while an abnormal/warning condition persists */
  startCautionAlarm() {
    if (!this.on || this.masterAlarmActive) return;
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.cautionAlarmActive) return;
    this.cautionAlarmActive = true;
    const now = performance.now();
    if (!this._lastCautionAlarmTime || now - this._lastCautionAlarmTime > 1800) {
      this._lastCautionAlarmTime = now;
      this.playAlertTone();
    }
    if (this.cautionAlarmTimer) clearInterval(this.cautionAlarmTimer);
    this.cautionAlarmTimer = setInterval(() => {
      if (this.cautionAlarmActive && !this.masterAlarmActive && this.on) {
        this.playAlertTone();
      } else {
        this.stopCautionAlarm();
      }
    }, 5500);
  }

  /** Silences the critical master alarm */
  stopMasterAlarm() {
    this.masterAlarmActive = false;
    if (this.masterAlarmTimer) {
      clearInterval(this.masterAlarmTimer);
      this.masterAlarmTimer = null;
    }
  }

  /** Silences the caution alarm */
  stopCautionAlarm() {
    this.cautionAlarmActive = false;
    if (this.cautionAlarmTimer) {
      clearInterval(this.cautionAlarmTimer);
      this.cautionAlarmTimer = null;
    }
  }

  /**
   * NASA Quindar Tone (Key-Up): 2525 Hz sine beep for 250 ms.
   * Heard on Apollo and ISS Space-to-Ground radio communications before Houston speaks.
   */
  playQuindarIntro() {
    if (!this.on) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2525, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.015);
    gain.gain.setValueAtTime(0.065, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    // Subtle radio click/squelch
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(140, now);
    clickGain.gain.setValueAtTime(0.04, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain || this.masterGain || ctx.destination);
    click.connect(clickGain);
    clickGain.connect(this.sfxGain || this.masterGain || ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
    click.start(now);
    click.stop(now + 0.04);
  }

  /**
   * NASA Quindar Tone (Key-Down): 2475 Hz sine beep for 250 ms.
   * Closes the radio channel transmission from CAPCOM.
   */
  playQuindarOutro() {
    if (!this.on) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2475, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.015);
    gain.gain.setValueAtTime(0.065, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain || this.masterGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Plays realistic CAPCOM Radio transmission with authentic Quindar beeps.
   */
  playCapcomRadio(messageText) {
    if (!this.on) return;
    this.playQuindarIntro();
    setTimeout(() => {
      this.speakJarvis(messageText, () => {
        this.playQuindarOutro();
      });
    }, 320);
  }

  /**
   * Physiological EMU Spacesuit In-Helmet Audio:
   * Soft oxygen airflow loop + cardiac pulse synced to astronaut BPM.
   */
  startSuitPhysiology(bpm = 72) {
    if (!this.on) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    this.stopSuitPhysiology();

    const intervalMs = Math.max(450, Math.min(1500, (60 / bpm) * 1000));
    this.suitPhysiologyTimer = setInterval(() => {
      if (!this.on) return;
      this.playHeartbeat();
    }, intervalMs);
  }

  stopSuitPhysiology() {
    if (this.suitPhysiologyTimer) {
      clearInterval(this.suitPhysiologyTimer);
      this.suitPhysiologyTimer = null;
    }
  }

  /** Silences all alarms when situation returns to nominal or when muted */
  stopAllAlarms() {
    this.stopMasterAlarm();
    this.stopCautionAlarm();
    this.stopJarvis();
    this.stopSuitPhysiology();
  }

  /**
   * Synthesizes authentic JARVIS voice directives inside the ISS Deck cabin
   * instructing the crew on emergency clinical and operational recovery actions.
   */
  speakJarvis(text, onComplete) {
    if (!this.on) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // Prevent dual voice overlap when embedded inside the HELIOS application:
    // The parent window's audioService handles unified vocal directives for the mission.
    if (window.parent && window.parent !== window) {
      if (onComplete) onComplete();
      return;
    }
    if (!text || typeof text !== 'string' || !text.trim()) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.trim());
      utter.rate = 1.02;
      utter.pitch = 0.98;
      utter.volume = this.on ? 1.0 : 0;

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => /Ryan|Guy|George|David|Oliver|Natural|Google UK English Male|Google US English|Microsoft/i.test(v.name) && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utter.voice = preferred;

      if (onComplete) {
        utter.onend = onComplete;
        utter.onerror = onComplete;
      }
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('[Audio] Jarvis speech synthesis error:', e);
      if (onComplete) onComplete();
    }
  }

  stopJarvis() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}

export const Ambience = SoundEngine;
