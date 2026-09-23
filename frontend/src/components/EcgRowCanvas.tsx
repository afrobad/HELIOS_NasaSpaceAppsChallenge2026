import React, { useEffect, useRef, useState } from 'react';
import { wsService } from '../services/websocketService';
import type { TelemetryPacket } from '../types/telemetry';

interface EcgRowCanvasProps {
  astronautId: string;
  altAstronautId?: string;
  /** Optional fixed CSS height. If omitted, flex-fills available space */
  height?: number | string;
}

// ─── Physiological waveform math (same precision as full TelemetryCanvas) ───

function calcLeadII(phi: number): number {
  phi = phi - Math.floor(phi);
  let v = Math.sin(phi * Math.PI * 2) * 0.015;
  if (phi >= 0.10 && phi <= 0.24) {
    const n = (phi - 0.17) / 0.035;
    v += 0.18 * Math.exp(-n * n);
  }
  if (phi >= 0.27 && phi <= 0.31) {
    const n = (phi - 0.29) / 0.012;
    v -= 0.14 * Math.exp(-n * n);
  }
  if (phi >= 0.29 && phi <= 0.35) {
    const n = (phi - 0.32) / 0.014;
    v += 1.05 * Math.exp(-n * n);
  }
  if (phi >= 0.33 && phi <= 0.39) {
    const n = (phi - 0.36) / 0.014;
    v -= 0.30 * Math.exp(-n * n);
  }
  if (phi >= 0.46 && phi <= 0.70) {
    const n = (phi - 0.58) / 0.065;
    v += 0.32 * Math.exp(-n * n);
  }
  return v;
}

function calcPpg(phi: number): number {
  phi = phi - Math.floor(phi);
  if (phi < 0.20) return Math.sin((phi / 0.20) * (Math.PI / 2));
  if (phi < 0.36) return 1.0 - ((phi - 0.20) / 0.16) * 0.42;
  if (phi < 0.46) return 0.58 + Math.sin(((phi - 0.36) / 0.10) * Math.PI) * 0.12;
  return 0.58 * Math.exp(-((phi - 0.46) / 0.54) * 2.8);
}

const BUF = 600;
const ERASE = 20;

function createInitialWaves() {
  const ecg = new Float32Array(BUF);
  const ppg = new Float32Array(BUF);
  for (let i = 0; i < BUF; i++) {
    const phase = (i / BUF) * 4.2 * (62 / 60);
    ecg[i] = calcLeadII(phase);
    ppg[i] = calcPpg(phase);
  }
  return { ecg, ppg };
}

export const EcgRowCanvas: React.FC<EcgRowCanvasProps> = ({
  astronautId,
  altAstronautId,
  height,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef<number>(window.devicePixelRatio || 1);

  const telRef = useRef({ heart_rate: 62.0, spo2: 98.2, hrv_rmssd: 65.0 });
  const waveRef = useRef({
    sweepIndex: 0,
    phase: 0.0,
    lastTime: performance.now(),
    ...createInitialWaves(),
  });

  // Live numeric stats for overlay labels (updated at 10 Hz via interval, not RAF)
  const [stats, setStats] = useState({ hr: 62, spo2: 98.2, rhythm: 'NSR' });

  // On astronaut switch, reset sweep index smoothly without zeroing out existing waves
  useEffect(() => {
    const w = waveRef.current;
    w.sweepIndex = 0;
    w.phase = 0.0;
    w.lastTime = performance.now();
  }, [astronautId]);

  // Subscribe to WebSocket for this specific astronaut
  useEffect(() => {
    const unsub = wsService.subscribeTelemetry((pkt: TelemetryPacket) => {
      const match =
        pkt.astronaut_id === astronautId ||
        (altAstronautId && pkt.astronaut_id === altAstronautId);
      if (match && pkt.heart_rate) {
        telRef.current = {
          heart_rate: pkt.heart_rate,
          spo2: pkt.spo2,
          hrv_rmssd: pkt.hrv_rmssd,
        };
      }
    });
    return () => unsub();
  }, [astronautId, altAstronautId]);

  // 10 Hz stats refresh for digital overlay
  useEffect(() => {
    const iv = setInterval(() => {
      const { heart_rate, spo2 } = telRef.current;
      let rhythm = 'NSR';
      if (heart_rate > 100) rhythm = 'TACHY';
      else if (heart_rate < 50) rhythm = 'BRADY';
      setStats({ hr: Math.round(heart_rate), spo2: Math.round(spo2 * 10) / 10, rhythm });
    }, 100);
    return () => clearInterval(iv);
  }, []);

  // Main RAF rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;

    const render = (now: number) => {
      const w = waveRef.current;
      const dpr = dprRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;

      if (W <= 0 || H <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min((now - w.lastTime) / 1000, 0.08);
      w.lastTime = now;

      const hr = telRef.current.heart_rate || 62.0;
      const sps = BUF / 4.2;
      const steps = Math.max(1, Math.round(sps * dt));

      for (let s = 0; s < steps; s++) {
        const stepDt = dt / steps;
        w.phase = (w.phase + stepDt * (hr / 60)) % 1.0;
        const idx = w.sweepIndex;
        w.ecg[idx] = calcLeadII(w.phase);
        w.ppg[idx] = calcPpg(w.phase);
        for (let g = 1; g <= ERASE; g++) {
          const ei = (idx + g) % BUF;
          w.ecg[ei] = NaN;
          w.ppg[ei] = NaN;
        }
        w.sweepIndex = (w.sweepIndex + 1) % BUF;
      }

      // Background
      ctx.fillStyle = '#0d1017';
      ctx.fillRect(0, 0, W, H);

      // Clinical grid (minor)
      ctx.strokeStyle = '#141720';
      ctx.lineWidth = 0.5;
      const gx = W / 48;
      const gy = H / 16;
      for (let x = gx; x < W; x += gx) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = gy; y < H; y += gy) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // Major grid
      ctx.strokeStyle = '#1c2234';
      ctx.lineWidth = 0.8;
      const mgx = W / 9.6;
      const mgy = H / 4;
      for (let x = mgx; x < W; x += mgx) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = mgy; y < H; y += mgy) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const stepX = W / BUF;

      // ECG track baseline at 58% from top (upper 72% of canvas)
      const ecgBase = H * 0.42;
      const ecgAmp = H * 0.28;

      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#ffffff';
      let inPath = false;
      for (let i = 0; i < BUF; i++) {
        const v = w.ecg[i];
        if (isNaN(v)) { inPath = false; continue; }
        const x = i * stepX;
        const y = ecgBase - v * ecgAmp;
        if (!inPath) { ctx.moveTo(x, y); inPath = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // PPG track in bottom 28% of canvas
      const ppgBase = H * 0.92;
      const ppgAmp = H * 0.22;

      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#ff7700';
      inPath = false;
      for (let i = 0; i < BUF; i++) {
        const v = w.ppg[i];
        if (isNaN(v)) { inPath = false; continue; }
        const x = i * stepX;
        const y = ppgBase - v * ppgAmp;
        if (!inPath) { ctx.moveTo(x, y); inPath = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Track divider
      ctx.strokeStyle = '#222b3a';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.68);
      ctx.lineTo(W, H * 0.68);
      ctx.stroke();

      // Sweep line
      const sweepX = w.sweepIndex * stepX;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 119, 0, 0.55)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, H);
      ctx.stroke();

      // Pip on ECG
      const prev = w.ecg[(w.sweepIndex - 1 + BUF) % BUF];
      if (!isNaN(prev)) {
        const pipY = ecgBase - prev * ecgAmp;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sweepX, pipY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const c = canvas.getContext('2d', { alpha: false });
      if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(container);
    window.addEventListener('resize', resize);
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const isAbnormal = stats.rhythm !== 'NSR';

  return (
    <div
      style={{
        width: '100%',
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Compact header: ECG labels + live stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'rgba(13, 16, 23, 0.85)',
          borderBottom: '1px solid #1a2030',
          borderRadius: '6px 6px 0 0',
          flexShrink: 0,
        }}
      >
        {/* Left labels */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ffffff',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#cbd5e1',
                letterSpacing: '0.04em',
              }}
            >
              ECG II
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ff7700',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#ff9933',
                letterSpacing: '0.04em',
              }}
            >
              SpO₂ Pleth
            </span>
          </div>
        </div>

        {/* Right live stats */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '15px',
                fontWeight: 800,
                color: isAbnormal ? '#f59e0b' : '#ffffff',
              }}
            >
              {stats.hr}
            </span>
            <span style={{ fontSize: '9px', color: '#64748b' }}>BPM</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <span
              className="font-mono-tabular"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: stats.spo2 < 95 ? 'var(--hud-critical)' : '#94a3b8',
              }}
            >
              {stats.spo2.toFixed(1)}
            </span>
            <span style={{ fontSize: '9px', color: '#64748b' }}>%</span>
          </div>

          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: isAbnormal ? '#f59e0b' : '#10b981',
              letterSpacing: '0.05em',
            }}
          >
            {stats.rhythm}
          </span>
        </div>
      </div>

      {/* Canvas container — fills remaining height completely, perfectly flush */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          background: '#0d1017',
          borderRadius: '0 0 6px 6px',
          overflow: 'hidden',
          border: '1px solid #1c212e',
          borderTop: 'none',
          boxSizing: 'border-box',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};
