import React, { useEffect, useRef, useState } from 'react';
import { wsService } from '../services/websocketService';
import type { TelemetryPacket } from '../types/telemetry';

interface TelemetryCanvasProps {
  selectedAstronautId: string;
  astronautName: string;
}

/**
 * Calculates normalized physiological Lead II ECG voltage for a cardiac cycle phase in [0, 1).
 * Accurately models P-wave, PR segment, Q-wave, rapid QRS spike, S-wave, ST segment, and T-wave.
 */
function calculateLeadIIEcg(phi: number): number {
  phi = phi - Math.floor(phi);

  // Micro-baseline biological fluctuation
  let v = Math.sin(phi * Math.PI * 2) * 0.015;

  // P wave: Atrial Depolarization (rounded smooth upward deflection)
  if (phi >= 0.10 && phi <= 0.24) {
    const pNorm = (phi - 0.17) / 0.035;
    v += 0.18 * Math.exp(-pNorm * pNorm);
  }

  // Q wave: Septal Depolarization (sharp minor downward notch)
  if (phi >= 0.27 && phi <= 0.31) {
    const qNorm = (phi - 0.29) / 0.012;
    v -= 0.14 * Math.exp(-qNorm * qNorm);
  }

  // R wave: Ventricular Depolarization (high-amplitude, razor-sharp upward spike)
  if (phi >= 0.29 && phi <= 0.35) {
    const rNorm = (phi - 0.32) / 0.014;
    v += 1.05 * Math.exp(-rNorm * rNorm);
  }

  // S wave: Basal Ventricular Depolarization (sharp downward dip below baseline)
  if (phi >= 0.33 && phi <= 0.39) {
    const sNorm = (phi - 0.36) / 0.014;
    v -= 0.30 * Math.exp(-sNorm * sNorm);
  }

  // T wave: Ventricular Repolarization (broad, gentle upward dome)
  if (phi >= 0.46 && phi <= 0.70) {
    const tNorm = (phi - 0.58) / 0.065;
    v += 0.32 * Math.exp(-tNorm * tNorm);
  }

  return v;
}

/**
 * Calculates normalized arterial photoplethysmogram (PPG / pulse volume) for phase in [0, 1).
 * Features systolic upstroke, dicrotic notch, and diastolic runoff.
 */
function calculatePpgWave(phi: number): number {
  phi = phi - Math.floor(phi);
  if (phi < 0.20) {
    return Math.sin((phi / 0.20) * (Math.PI / 2));
  } else if (phi < 0.36) {
    const f = (phi - 0.20) / 0.16;
    return 1.0 - f * 0.42;
  } else if (phi < 0.46) {
    const f = (phi - 0.36) / 0.10;
    return 0.58 + Math.sin(f * Math.PI) * 0.12;
  } else {
    const f = (phi - 0.46) / 0.54;
    return 0.58 * Math.exp(-f * 2.8);
  }
}

const BUFFER_SIZE = 750; // High-density waveform samples across canvas
const ERASE_GAP = 24;     // Clean blanking interval ahead of sweep line

export const TelemetryCanvas: React.FC<TelemetryCanvasProps> = ({
  selectedAstronautId,
  astronautName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef<number>(window.devicePixelRatio || 1);

  // Live telemetry metrics ref (updated from 10 Hz WebSocket with zero React re-render overhead)
  const telemetryRef = useRef({
    heart_rate: 62.0,
    hrv_rmssd: 65.0,
    spo2: 98.2,
    lastReceived: performance.now(),
  });

  // High-precision waveform buffer state
  const stateRef = useRef({
    sweepIndex: 0,
    cardiacPhase: 0.0,
    lastTime: performance.now(),
    ecgBuffer: new Float32Array(BUFFER_SIZE).fill(NaN),
    ppgBuffer: new Float32Array(BUFFER_SIZE).fill(NaN),
  });

  const [fps, setFps] = useState<number>(60);
  const [hudStats, setHudStats] = useState({
    hr: 62.0,
    hrv: 65,
    spo2: 98.2,
    rhythm: 'NORMAL SINUS RHYTHM',
    pr: 152,
    qrs: 84,
    qtc: 408,
  });

  // 1. Instantly refresh and clear waveform on astronaut switch
  useEffect(() => {
    const state = stateRef.current;
    state.ecgBuffer.fill(NaN);
    state.ppgBuffer.fill(NaN);
    state.sweepIndex = 0;
    state.cardiacPhase = 0.0;
    state.lastTime = performance.now();
  }, [selectedAstronautId]);

  // 2. Ingest high-frequency 10 Hz WebSocket telemetry directly into ref
  useEffect(() => {
    const unsubscribe = wsService.subscribeTelemetry((packet: TelemetryPacket) => {
      const idMatch =
        packet.astronaut_id === selectedAstronautId ||
        (selectedAstronautId === 'AST-03_MEDICAL' && packet.astronaut_id === 'AST-03_MEDICAL_SPECIALIST') ||
        (selectedAstronautId === 'AST-03_MEDICAL_SPECIALIST' && packet.astronaut_id === 'AST-03_MEDICAL') ||
        (selectedAstronautId === 'AST-04_ENGINEER' && packet.astronaut_id === 'AST-04_MISSION_SPECIALIST') ||
        (selectedAstronautId === 'AST-04_MISSION_SPECIALIST' && packet.astronaut_id === 'AST-04_ENGINEER');

      if (idMatch && packet.heart_rate) {
        telemetryRef.current = {
          heart_rate: packet.heart_rate,
          hrv_rmssd: packet.hrv_rmssd,
          spo2: packet.spo2,
          lastReceived: performance.now(),
        };
      }
    });

    return () => unsubscribe();
  }, [selectedAstronautId]);

  // 3. Periodic HUD state sync (10 Hz update for digital labels without affecting canvas RAF)
  useEffect(() => {
    const interval = setInterval(() => {
      const { heart_rate, hrv_rmssd, spo2 } = telemetryRef.current;
      const qtc = Math.round(410 * Math.sqrt(60 / Math.max(heart_rate, 40)));
      let rhythm = 'NORMAL SINUS RHYTHM';
      if (heart_rate > 100) rhythm = 'SINUS TACHYCARDIA';
      else if (heart_rate < 50) rhythm = 'SINUS BRADYCARDIA';

      setHudStats({
        hr: Math.round(heart_rate * 10) / 10,
        hrv: Math.round(hrv_rmssd),
        spo2: Math.round(spo2 * 10) / 10,
        rhythm,
        pr: 148 + Math.round((60 - heart_rate) * 0.4),
        qrs: 84,
        qtc,
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // 4. High-performance GPU-accelerated requestAnimationFrame rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const render = (now: number) => {
      const state = stateRef.current;
      const dpr = dprRef.current;
      // Work in CSS-pixel space (ctx is scaled by dpr in handleResize)
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Frame time delta in seconds (clamped to prevent spiral on background tab)
      const dt = Math.min((now - state.lastTime) / 1000, 0.1);
      state.lastTime = now;

      // Dynamic FPS calculation
      frameCount++;
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }

      // Step forward waveform generation based on current instantaneous heart rate
      const currentHr = telemetryRef.current.heart_rate || 62.0;
      const samplesPerSecond = BUFFER_SIZE / 4.2;
      const samplesToAdvance = Math.max(1, Math.round(samplesPerSecond * dt));

      for (let s = 0; s < samplesToAdvance; s++) {
        const stepDt = dt / samplesToAdvance;
        state.cardiacPhase = (state.cardiacPhase + stepDt * (currentHr / 60)) % 1.0;

        const idx = state.sweepIndex;
        state.ecgBuffer[idx] = calculateLeadIIEcg(state.cardiacPhase);
        state.ppgBuffer[idx] = calculatePpgWave(state.cardiacPhase);

        // Erase gap ahead of sweep line
        for (let g = 1; g <= ERASE_GAP; g++) {
          const eraseIdx = (idx + g) % BUFFER_SIZE;
          state.ecgBuffer[eraseIdx] = NaN;
          state.ppgBuffer[eraseIdx] = NaN;
        }

        state.sweepIndex = (state.sweepIndex + 1) % BUFFER_SIZE;
      }

      // --- RENDERING CANVAS SCENE ---
      // 1. Matte Dark Gray Background
      ctx.fillStyle = '#0d1017';
      ctx.fillRect(0, 0, width, height);

      // 2. High-Detail Clinical Telemetry Grid (0.04s Minor / 0.2s Major Division)
      const gridMinorX = width / 60;
      const gridMajorX = width / 12;
      const gridMinorY = height / 24;
      const gridMajorY = height / 6;

      // Minor grid lines
      ctx.strokeStyle = '#151923';
      ctx.lineWidth = 0.5;
      for (let x = gridMinorX; x < width; x += gridMinorX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = gridMinorY; y < height; y += gridMinorY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Major grid lines
      ctx.strokeStyle = '#1d2332';
      ctx.lineWidth = 1.0;
      for (let x = gridMajorX; x < width; x += gridMajorX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = gridMajorY; y < height; y += gridMajorY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Track Divider Line
      const trackDividerY = height * 0.64;
      ctx.strokeStyle = '#273042';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, trackDividerY);
      ctx.lineTo(width, trackDividerY);
      ctx.stroke();

      const stepX = width / BUFFER_SIZE;

      // 3. Clinical 1 mV Calibration Pulse Indicator (left margin bracket)
      const ecgBaselineY = height * 0.40;
      const ecgAmplitudeScale = height * 0.25;

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(10, ecgBaselineY);
      ctx.lineTo(16, ecgBaselineY);
      ctx.lineTo(16, ecgBaselineY - 1.0 * ecgAmplitudeScale);
      ctx.lineTo(26, ecgBaselineY - 1.0 * ecgAmplitudeScale);
      ctx.lineTo(26, ecgBaselineY);
      ctx.lineTo(32, ecgBaselineY);
      ctx.stroke();

      // --- TRACK 1: LEAD II ECG CARDIAC WAVEFORM (High-Visibility Crisp White, Zero Glow) ---
      ctx.save();
      ctx.shadowBlur = 0; // Explicitly zero glow
      ctx.beginPath();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#ffffff';

      let ecgInPath = false;
      for (let i = 0; i < BUFFER_SIZE; i++) {
        const val = state.ecgBuffer[i];
        if (isNaN(val)) {
          ecgInPath = false;
          continue;
        }
        const x = i * stepX;
        const y = ecgBaselineY - val * ecgAmplitudeScale;

        if (!ecgInPath) {
          ctx.moveTo(x, y);
          ecgInPath = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();

      // --- TRACK 2: ARTERIAL PLETHYSMOGRAM (High-Contrast Orange, Zero Glow) ---
      const ppgBaseY = height * 0.94;
      const ppgHeight = height * 0.24;

      ctx.save();
      ctx.shadowBlur = 0; // Explicitly zero glow
      ctx.beginPath();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#ff7700';

      let ppgInPath = false;
      for (let i = 0; i < BUFFER_SIZE; i++) {
        const val = state.ppgBuffer[i];
        if (isNaN(val)) {
          ppgInPath = false;
          continue;
        }
        const x = i * stepX;
        const y = ppgBaseY - val * ppgHeight;

        if (!ppgInPath) {
          ctx.moveTo(x, y);
          ppgInPath = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();

      // --- VERTICAL SWEEP LINE (Crisp 1px Clean Line, Zero Glow) ---
      const sweepX = state.sweepIndex * stepX;
      ctx.save();
      ctx.shadowBlur = 0; // ZERO GLOW per user request
      ctx.strokeStyle = '#ff7700';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, height);
      ctx.stroke();

      // Solid crisp indicator pip (zero blur)
      const curEcgVal = state.ecgBuffer[(state.sweepIndex - 1 + BUFFER_SIZE) % BUFFER_SIZE];
      if (!isNaN(curEcgVal)) {
        const pipY = ecgBaselineY - curEcgVal * ecgAmplitudeScale;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sweepX, pipY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const resizeCtx = canvas.getContext('2d', { alpha: false });
      if (resizeCtx) {
        resizeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isWarningRhythm = hudStats.rhythm !== 'NORMAL SINUS RHYTHM';

  return (
    <div className="hud-panel" style={{ marginBottom: '16px' }}>
      {/* Header Bar: Typographic Hierarchy, Hero Name, Device Subtitle, Background-Free Rhythm Icon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--hud-border-subtle)',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Left: Hero Name + Background-Free Rhythm Icon + Non-Uppercase Device Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
              }}
            >
              {astronautName}
            </h2>

            {/* Rhythm indicator icon without any background container */}
            <span
              title={`Cardiac Rhythm: ${hudStats.rhythm}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isWarningRhythm ? '#f59e0b' : '#10b981',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'default',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: isWarningRhythm
                    ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.45))'
                    : 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.45))',
                }}
              >
                <path d="M2 12h4l2.5-6 4 12 3-8 2.5 4H22" />
              </svg>
            </span>
          </div>

          {/* Device name under the name with non-uppercase attribute */}
          <span
            style={{
              fontSize: '13px',
              color: 'var(--hud-text-muted)',
              textTransform: 'none',
              fontWeight: 400,
              letterSpacing: '0.01em',
            }}
          >
            Biometric Telemetry
          </span>
        </div>

        {/* Right: Technical Clinical Intervals & Live Rate */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '18px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>HR:</span>
            <span className="font-mono-tabular" style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
              {hudStats.hr.toFixed(1)}
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>BPM</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>PR:</span>
            <span className="font-mono-tabular" style={{ fontSize: '13px', color: '#e2e8f0' }}>
              {hudStats.pr}ms
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>QRS:</span>
            <span className="font-mono-tabular" style={{ fontSize: '13px', color: '#e2e8f0' }}>
              {hudStats.qrs}ms
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>QTc:</span>
            <span className="font-mono-tabular" style={{ fontSize: '13px', color: '#e2e8f0' }}>
              {hudStats.qtc}ms
            </span>
          </div>

          <div className="font-mono-tabular" style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            {fps} FPS
          </div>
        </div>
      </div>

      {/* HTML5 Canvas Container (Increased Height, Responsive & Spacious) */}
      <div
        style={{
          width: '100%',
          height: '340px',
          minHeight: '320px',
          position: 'relative',
          borderRadius: '6px',
          overflow: 'hidden',
          background: '#0d1017',
          border: '1px solid #1c212e',
        }}
      >
        {/* Top Overlay Strip: Graph Labels with Maximum Opacity at the Top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 14px',
            background: 'linear-gradient(180deg, rgba(13, 16, 23, 0.95) 0%, rgba(13, 16, 23, 0.65) 75%, transparent 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* ECG Lead II Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
                ECG Lead II
              </span>
              <span className="font-mono-tabular" style={{ fontSize: '11px', color: '#cbd5e1', marginLeft: '2px', opacity: 1 }}>
                · 25 mm/s · 10 mm/mV
              </span>
            </div>

            {/* Pulse Oximetry Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff7700', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ff7700', letterSpacing: '0.04em' }}>
                Pulse Oximetry
              </span>
              <span style={{ fontSize: '11px', color: '#fdba74', marginLeft: '2px', opacity: 1 }}>
                · Pleth Wave
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="font-mono-tabular" style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 600 }}>
              CAL 1.0 mV
            </span>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', background: '#0d1017' }}
        />
      </div>

      {/* Minimal Bottom Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
          fontSize: '11px',
          color: 'var(--hud-text-dim)',
        }}
      >
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '2px', background: '#ffffff' }} />
            <span style={{ color: '#e2e8f0' }}>ECG</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '2px', background: '#ff7700' }} />
            <span style={{ color: '#ff9933' }}>Pulse Wave</span>
          </div>
        </div>

        <div style={{ color: '#64748b' }}>
          Real-time 10 Hz Telemetry Feed
        </div>
      </div>
    </div>
  );
};
