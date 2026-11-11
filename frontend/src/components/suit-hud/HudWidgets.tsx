import { useEffect, useMemo, useRef, memo, type CSSProperties, type ReactNode } from 'react';
import { gaugeArc, gaugePoint, mulberry32, type Side } from './geometry';
import type { SuitTelemetry } from './useSuitTelemetry';
import { HolographicSuitScanner3D } from './HolographicSuitScanner3D';

/* ────────────────────────────────────────────────────────────────────────
 * Shared bits
 * ──────────────────────────────────────────────────────────────────────── */

function useRaf(cb: (t: number) => void, enabled: boolean) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    const loop = (t: number) => {
      cbRef.current(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [enabled]);
}

/** Subscript digit rendered with tspans (fonts rarely ship ₂ glyphs). */
function Sub({ children, size = 6 }: { children: string; size?: number }) {
  return (
    <>
      <tspan fontSize={size} dy="2">
        {children}
      </tspan>
      <tspan dy="-2">{'\u200b'}</tspan>
    </>
  );
}

/** Group that fades in with a CRT-style flicker during HUD boot. */
function Reveal({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <g className="hud-reveal" style={{ '--d': `${delay}s` } as CSSProperties}>
      {children}
    </g>
  );
}

/** SVG defs used by the HUD layer. */
export const HudDefs = memo(function HudDefs() {
  return (
    <defs>
      {/* Glow filters kept strictly for ambient rim/waveform highlights, never applied to text */}
      <filter id="shud-glow-sm" x="-25%" y="-60%" width="150%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="b1" />
        <feMerge>
          <feMergeNode in="b1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="shud-rim-glow" filterUnits="userSpaceOnUse" x="-40" y="0" width="1104" height="571">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <linearGradient id="shud-fade-l" x1="336" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#62f3f7" stopOpacity="0" />
        <stop offset="1" stopColor="#62f3f7" stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id="shud-fade-r" x1="688" y1="0" x2="644" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#62f3f7" stopOpacity="0" />
        <stop offset="1" stopColor="#62f3f7" stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id="shud-ecg-fade" x1="232" y1="0" x2="298" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#62f3f7" stopOpacity="0" />
        <stop offset="0.22" stopColor="#62f3f7" stopOpacity="0.9" />
        <stop offset="1" stopColor="#bffcff" stopOpacity="1" />
      </linearGradient>
      <linearGradient id="shud-compass-fade-l" x1="330" y1="0" x2="410" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#62f3f7" stopOpacity="0" />
        <stop offset="1" stopColor="#62f3f7" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="shud-compass-fade-r" x1="694" y1="0" x2="614" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#62f3f7" stopOpacity="0" />
        <stop offset="1" stopColor="#62f3f7" stopOpacity="0.6" />
      </linearGradient>
      <clipPath id="shud-compass-clip">
        <rect x="408" y="470" width="208" height="16" />
      </clipPath>
    </defs>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * Top: voice waveform + "SUIT AI // ONLINE"
 * ──────────────────────────────────────────────────────────────────────── */

const WAVE_X0 = 382;
const WAVE_STEP = 4;
const WAVE_BARS = 66;
const WAVE_CY = 38;
const WAVE_MAX = 22;

function waveEnvelope(x: number) {
  const g = (c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
  return Math.min(1, 0.14 + 0.86 * g(512, 52) + 0.55 * g(452, 22) + 0.55 * g(574, 22) + 0.25 * g(418, 16) + 0.25 * g(608, 16));
}

export interface VoiceWaveformProps {
  animate?: boolean;
  status?: string;
  statusLabel?: string;
  detailText?: string;
  directive?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  isOnline?: boolean;
  isTransmitting?: boolean;
}

export const VoiceWaveform = memo(function VoiceWaveform({
  animate = true,
  status,
  statusLabel,
  detailText,
  directive,
  severity = 'NOMINAL',
  isOnline = true,
  isTransmitting = false,
}: VoiceWaveformProps) {
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const ampRef = useRef<number>(0);
  const settledRef = useRef<boolean>(false);

  const seeds = useMemo(() => {
    const rnd = mulberry32(1337);
    return Array.from({ length: WAVE_BARS }, () => ({
      f1: 0.005 + rnd() * 0.008,
      p1: rnd() * Math.PI * 2,
      f2: 0.0016 + rnd() * 0.003,
      p2: rnd() * Math.PI * 2,
      f3: 0.01 + rnd() * 0.015,
      p3: rnd() * Math.PI * 2,
      base: 0.35 + rnd() * 0.65,
    }));
  }, []);

  const heightAt = (i: number, t: number, amp: number) => {
    const s = seeds[i];
    const env = waveEnvelope(WAVE_X0 + i * WAVE_STEP);
    // Quiet resting tick height when not transmitting voice
    const restingH = 1.3 + 0.5 * env;
    if (amp <= 0.01) {
      return restingH;
    }
    // Dynamic music/remix equalizer wave calculation when voice is actively transmitting
    const wave = Math.abs(
      Math.sin(t * s.f1 + s.p1) * 0.52 +
      Math.sin(t * s.f2 + s.p2) * 0.32 +
      Math.sin(t * s.f3 + s.p3) * 0.16
    );
    const n = 0.22 + 0.78 * wave;
    const dynamicH = Math.max(1.3, env * WAVE_MAX * n);
    return restingH + (dynamicH - restingH) * amp;
  };

  useRaf((t) => {
    // Smooth attack and release: springs to life upon speech and gently returns to resting baseline
    const targetAmp = isTransmitting ? 1.0 : 0.0;
    const diff = targetAmp - ampRef.current;
    if (Math.abs(diff) > 0.001) {
      ampRef.current += diff * (isTransmitting ? 0.22 : 0.08);
      settledRef.current = false;
    } else {
      ampRef.current = targetAmp;
    }

    const currentAmp = ampRef.current;
    // 90 FPS performance optimization: skip DOM writes once resting waveform settles
    if (!isTransmitting && currentAmp <= 0.001) {
      if (settledRef.current) return;
      settledRef.current = true;
    }

    for (let i = 0; i < WAVE_BARS; i++) {
      const el = bars.current[i];
      if (!el) continue;
      const h = heightAt(i, t, currentAmp);
      el.setAttribute('y', (WAVE_CY - h).toFixed(2));
      el.setAttribute('height', (h * 2).toFixed(2));
    }
  }, animate);

  const isCritical = severity === 'CRITICAL';
  const isWarning = severity === 'WARNING';
  const hasDirective = Boolean(directive && directive.trim().length > 0);

  // Derive status label and detail text
  let finalStatus = statusLabel;
  let finalDetail = detailText;

  if (!finalStatus && status) {
    const parts = status
      .replace(/^(?:SUIT AI|AI SURGEON|Helix-Ai Analyst|HELIX-AI ANALYST)[\s/·•:-]+/i, '')
      .split(/[/·•:]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    finalStatus = parts[0] || (isCritical ? 'CRITICAL' : isWarning ? 'CAUTION' : isOnline ? 'ONLINE' : 'OFFLINE');
    finalDetail = parts.slice(1).join(' · ');
  }

  if (!finalStatus) {
    finalStatus = isCritical ? 'CRITICAL' : isWarning ? 'CAUTION' : isOnline ? 'ONLINE' : 'OFFLINE';
  }

  // Strip any remaining slashes or redundant prefixes
  const cleanDetail = finalDetail ? finalDetail.replace(/\s*[/]{2,}\s*/g, ' · ').trim() : '';
  const formattedDirective = directive
    ? directive.replace(/^(?:action|directive|instruction|recommendation)[\s:/-]+/i, '').trim()
    : '';

  const barClass = `hud-wave-bar ${
    isCritical
      ? 'hud-wave-bar--critical'
      : isWarning
      ? 'hud-wave-bar--warning'
      : ''
  } ${isTransmitting ? 'hud-wave-bar--active' : 'hud-wave-bar--idle'}`;

  return (
    <Reveal delay={0.1}>
      <g filter="url(#shud-glow-sm)">
        <path d="M336,38 L380,38" stroke="url(#shud-fade-l)" strokeWidth="1" />
        <path d="M644,38 L688,38" stroke="url(#shud-fade-r)" strokeWidth="1" />
        {seeds.map((_, i) => {
          const h = heightAt(i, 0, 0);
          return (
            <rect
              key={i}
              ref={(el) => {
                bars.current[i] = el;
              }}
              x={WAVE_X0 + i * WAVE_STEP - 1}
              y={WAVE_CY - h}
              width="2"
              height={h * 2}
              rx="1"
              className={barClass}
            />
          );
        })}
      </g>
      <g>
        <foreignObject
          x="270"
          y={hasDirective ? 48 : 54}
          width="484"
          height={hasDirective ? 34 : 24}
          style={{ overflow: 'hidden', pointerEvents: 'none' }}
        >
          <div className="hud-ai-status-container">
            {/* Line 1: Icon (before Surgeon label) + AI SURGEON + Status + Detail */}
            <div
              className={`hud-ai-status-row ${
                isCritical
                  ? 'hud-ai-status-row--critical'
                  : isWarning
                  ? 'hud-ai-status-row--warning'
                  : ''
              }`}
            >
              {isCritical ? (
                <img
                  src="/icons/critical.png"
                  alt="Critical Alert"
                  className="hud-ai-status-icon hud-ai-status-icon--critical"
                />
              ) : isWarning ? (
                <img
                  src="/icons/warning.png"
                  alt="Master Caution"
                  className="hud-ai-status-icon hud-ai-status-icon--warning"
                />
              ) : (
                <span
                  className={`hud-ai-status-dot ${
                    isOnline ? 'hud-ai-status-dot--online' : 'hud-ai-status-dot--offline'
                  }`}
                  title={isOnline ? 'Helix-Ai Analyst Link: Active (10 Hz)' : 'Helix-Ai Analyst Link: Disconnected'}
                />
              )}

              <span className="hud-ai-label">Helix-Ai Analyst</span>
              <span className="hud-ai-sep">·</span>
              <span
                className={`hud-ai-state ${
                  isCritical
                    ? 'hud-ai-state--critical'
                    : isWarning
                    ? 'hud-ai-state--warning'
                    : isOnline
                    ? 'hud-ai-state--online'
                    : 'hud-ai-state--offline'
                }`}
              >
                {finalStatus}
              </span>
              {cleanDetail && (
                <>
                  <span className="hud-ai-sep">·</span>
                  <span className="hud-ai-detail">{cleanDetail}</span>
                </>
              )}
            </div>

            {/* Line 2: Minimal Actionable Guidance */}
            {hasDirective && (
              <div className="hud-ai-directive-row">
                <span className="hud-ai-directive-tag">ACTION</span>
                <span>{formattedDirective}</span>
              </div>
            )}
          </div>
        </foreignObject>

        {/* Sleek Under-Bracket framing the text */}
        <path
          d={
            hasDirective
              ? 'M370,82 L380,87 L644,87 L654,82'
              : 'M388,78 L396,84 L628,84 L636,78'
          }
          className={`hud-line hud-line--dim ${
            isCritical ? 'hud-line--critical' : isWarning ? 'hud-line--warning' : ''
          }`}
        />
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * Thin frame accents (corner brackets)
 * ──────────────────────────────────────────────────────────────────────── */

export const FrameAccents = memo(function FrameAccents() {
  return (
    <Reveal delay={0}>
      <g  className="hud-line">
        <path d="M150,38 L196,38" className="hud-line--faint" />
        <path d="M196,38 L222,14 L258,14" className="hud-line--dim" />
        <path d="M874,38 L828,38" className="hud-line--faint" />
        <path d="M828,38 L802,14 L766,14" className="hud-line--dim" />
        <path d="M236,476 L252,490 L362,490" className="hud-line--dim" />
        <path d="M788,476 L772,490 L662,490" className="hud-line--dim" />
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * BIOMETRICS (top-left)
 * ──────────────────────────────────────────────────────────────────────── */

const ECG_X0 = 232;
const ECG_X1 = 298;
const ECG_BASE = 153;
const ECG_PERIOD = 42; // px per beat

function ecgValue(phase: number) {
  const p = phase - Math.floor(phase);
  if (p < 0.1) return 0;
  if (p < 0.2) return -1.6 * Math.sin(((p - 0.1) / 0.1) * Math.PI);
  if (p < 0.25) return 0;
  if (p < 0.28) return ((p - 0.25) / 0.03) * 2.2;
  if (p < 0.32) return 2.2 - ((p - 0.28) / 0.04) * 15.2;
  if (p < 0.37) return -13 + ((p - 0.32) / 0.05) * 22;
  if (p < 0.41) return 9 - ((p - 0.37) / 0.04) * 9;
  if (p < 0.5) return 0;
  if (p < 0.66) return -3.2 * Math.sin(((p - 0.5) / 0.16) * Math.PI);
  return 0;
}

function ecgPath(offsetPx: number) {
  let d = '';
  for (let x = ECG_X0; x <= ECG_X1; x += 1) {
    const y = ECG_BASE + ecgValue((x + offsetPx) / ECG_PERIOD);
    d += `${x === ECG_X0 ? 'M' : 'L'}${x},${y.toFixed(2)}`;
  }
  return d;
}

function EcgTrace({ heartRate, animate }: { heartRate: number; animate: boolean }) {
  const pathRef = useRef<SVGPathElement>(null);
  const state = useRef({ offset: 0, last: 0 });
  useRaf((t) => {
    const s = state.current;
    const dt = s.last ? Math.min(64, t - s.last) : 16;
    s.last = t;
    s.offset += (dt / 1000) * ECG_PERIOD * (heartRate / 60);
    pathRef.current?.setAttribute('d', ecgPath(s.offset));
  }, animate);
  return (
    <g filter="url(#shud-glow-sm)">
      <path ref={pathRef} d={ecgPath(10)} fill="none" stroke="url(#shud-ecg-fade)" strokeWidth="1.3" strokeLinejoin="round" />
    </g>
  );
}

function HeartIcon() {
  return (
    <g className="hud-icon">
      <path d="M147,150 L139.2,142.2 C136.4,139.4 136.6,135 139.6,133.3 C142.2,131.8 145.1,132.8 147,135.3 C148.9,132.8 151.8,131.8 154.4,133.3 C157.4,135 157.6,139.4 154.8,142.2 Z" />
      <path d="M140.6,140.2 L143.6,140.2 L145.2,137.4 L147.4,143 L149.1,140.2 L153.4,140.2" strokeWidth="1" />
    </g>
  );
}

function DropIcon() {
  return (
    <g className="hud-icon">
      <path d="M147,188.5 C147,188.5 140.8,195.6 140.8,199.8 A6.2,6.2 0 0 0 153.2,199.8 C153.2,195.6 147,188.5 147,188.5 Z" />
    </g>
  );
}

export const BiometricsPanel = memo(function BiometricsPanel({ data, animate }: { data: SuitTelemetry; animate: boolean }) {
  const spoBar = 82 * Math.min(1, Math.max(0, (data.spo2 - 80) / 19));
  const isHrWarn = data.heartRate > 105 || data.heartRate < 50;
  const isSpo2Warn = data.spo2 < 93;

  return (
    <Reveal delay={0.35}>
      <g>
        <text x="140" y="108" className="hud-title">BIOMETRICS</text>
        <path d="M130,121 L136,114 L300,114 L304,110" className="hud-line" />

        <HeartIcon />
        <text x="168" y="135" className="hud-label">HEART RATE</text>
        <text x="167" y="161">
          <tspan className={`hud-value-xl ${isHrWarn ? 'hud-value--warn' : ''}`}>{data.heartRate}</tspan>
          <tspan className="hud-unit" dx="4">BPM</tspan>
        </text>

        <path d="M134,176 L300,176" className="hud-line hud-line--faint" />

        <DropIcon />
        <text x="168" y="193" className="hud-label">
          SpO
          <Sub>2</Sub>
        </text>
        <text x="167" y="217">
          <tspan className={`hud-value-xl ${isSpo2Warn ? 'hud-value--warn' : ''}`}>{data.spo2}</tspan>
          <tspan className="hud-unit-lg" dx="1">%</tspan>
        </text>
        <path d={`M168,224 L${168 + spoBar},224`} className={`hud-bar ${isSpo2Warn ? 'hud-value--warn' : ''}`} />
      </g>
      <EcgTrace heartRate={data.heartRate} animate={animate} />
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * LIFE SUPPORT (top-right)
 * ──────────────────────────────────────────────────────────────────────── */

const LS_ICON_X = 757;

function O2Icon({ y }: { y: number }) {
  return (
    <g className="hud-icon">
      <circle cx={LS_ICON_X} cy={y} r="10.5" />
      <text x={LS_ICON_X - 1.2} y={y + 3} textAnchor="middle" className="hud-icon-text">
        O<tspan fontSize="5" dy="2">2</tspan>
      </text>
    </g>
  );
}

function FanIcon({ y }: { y: number }) {
  return (
    <g className="hud-icon">
      <circle cx={LS_ICON_X} cy={y} r="10.5" />
      {[0, 120, 240].map((a) => (
        <path
          key={a}
          d={`M${LS_ICON_X},${y} C${LS_ICON_X - 3.6},${y - 2.4} ${LS_ICON_X - 3.4},${y - 7.4} ${LS_ICON_X + 0.4},${y - 7.2} C${LS_ICON_X + 3.6},${y - 6.8} ${LS_ICON_X + 2.6},${y - 2.4} ${LS_ICON_X},${y} Z`}
          transform={`rotate(${a + 20} ${LS_ICON_X} ${y})`}
          className="hud-icon-fill"
        />
      ))}
      <circle cx={LS_ICON_X} cy={y} r="1.3" className="hud-icon-fill" />
    </g>
  );
}

function GaugeIcon({ y }: { y: number }) {
  const r = 6.4;
  const p = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(LS_ICON_X + r * Math.cos(rad)).toFixed(2)},${(y + r * Math.sin(rad)).toFixed(2)}`;
  };
  return (
    <g className="hud-icon">
      <circle cx={LS_ICON_X} cy={y} r="10.5" />
      <path d={`M${p(150)} A${r},${r} 0 1 1 ${p(30)}`} strokeWidth="1.1" />
      <path d={`M${LS_ICON_X},${y} L${LS_ICON_X + 3.6},${y - 3.6}`} strokeWidth="1.3" />
      <circle cx={LS_ICON_X} cy={y} r="1.3" className="hud-icon-fill" />
    </g>
  );
}

function ThermoIcon({ y }: { y: number }) {
  return (
    <g className="hud-icon">
      <path d={`M${LS_ICON_X - 2.6},${y + 3.2} L${LS_ICON_X - 2.6},${y - 8} A2.6,2.6 0 0 1 ${LS_ICON_X + 2.6},${y - 8} L${LS_ICON_X + 2.6},${y + 3.2} A4.6,4.6 0 1 1 ${LS_ICON_X - 2.6},${y + 3.2} Z`} />
      <path d={`M${LS_ICON_X},${y + 5.6} L${LS_ICON_X},${y - 5}`} strokeWidth="1.6" />
      <circle cx={LS_ICON_X} cy={y + 6.4} r="2.2" className="hud-icon-fill" />
    </g>
  );
}

const formatTte = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const LifeSupportPanel = memo(function LifeSupportPanel({ data }: { data: SuitTelemetry }) {
  const isO2Warn = data.o2Reserve < 75;
  const isPressWarn = data.suitPressurePsi < 3.5;
  const isTempWarn = data.temperatureC > 37.8 || data.temperatureC < 35.8;

  const rows = [
    {
      y: 137,
      icon: <O2Icon y={137} />,
      label: (
        <>
          O<Sub>2</Sub> RESERVE
        </>
      ),
      primary: `${data.o2Reserve}%`,
      secondary: `TTE ${formatTte(data.o2TteMinutes ?? 412)}`,
      isWarn: isO2Warn,
      isWord: false,
    },
    {
      y: 169,
      icon: <FanIcon y={169} />,
      label: (
        <>
          CO<Sub>2</Sub> SCRUBBER
        </>
      ),
      primary: data.co2Scrubber,
      secondary: `${data.ppCo2 ?? 1.8} mmHg`,
      isWarn: data.co2Scrubber !== 'NOMINAL',
      isWord: true,
    },
    {
      y: 201,
      icon: <GaugeIcon y={201} />,
      label: <>SUIT PRESSURE</>,
      primary: `${data.suitPressurePsi.toFixed(1)} PSI`,
      secondary: 'ΔP NOM',
      isWarn: isPressWarn,
      isWord: false,
    },
    {
      y: 234,
      icon: <ThermoIcon y={234} />,
      label: <>LCVG COOLANT</>,
      primary: `${(data.lcvgTempC ?? 18.2).toFixed(1)}°C`,
      secondary: `${data.feedwaterPct ?? 88}% H₂O`,
      isWarn: isTempWarn,
      isWord: false,
    },
  ];

  return (
    <Reveal delay={0.5}>
      <g>
        <text x="742" y="108" className="hud-title">LIFE SUPPORT (ECLSS)</text>
        <path d="M733,121 L739,114 L919,114 L923,110" className="hud-line" />
        <path d="M733,121 L733,248" className="hud-line hud-line--faint" />
        {rows.map((r, i) => (
          <g key={r.y}>
            {r.icon}
            {/* Line 1: Parameter label on left, secondary telemetry unit on right */}
            <text x="777" y={r.y - 2} className="hud-label">
              {r.label}
            </text>
            <text x="919" y={r.y - 2} textAnchor="end" className="hud-label hud-label--sm" style={{ opacity: 0.82 }}>
              {r.secondary}
            </text>
            {/* Line 2: Prominent primary telemetry reading with zero overlap risk */}
            <text x="777" y={r.y + 11}>
              <tspan className={`hud-value ${r.isWord ? 'hud-value--word' : ''} ${r.isWarn ? 'hud-value--warn' : ''}`}>
                {r.primary}
              </tspan>
            </text>
            {i < rows.length - 1 && <path d={`M741,${r.y + 17} L919,${r.y + 17}`} className="hud-line hud-line--faint" />}
          </g>
        ))}
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * NASA-STD-3001 MASTER CAUTION & WARNING (C&W) ANNUNCIATOR MATRIX
 * ──────────────────────────────────────────────────────────────────────── */

export const CautionWarningMatrix = memo(function CautionWarningMatrix({
  data,
}: {
  data: SuitTelemetry;
}) {
  const flags = useMemo(() => {
    return [
      { id: 'O2', label: 'O₂ FLOW', isCritical: data.o2Reserve < 60, isWarning: data.o2Reserve < 75 },
      { id: 'CO2', label: 'CO₂ HIGH', isCritical: data.co2Scrubber === 'FAULT', isWarning: data.co2Scrubber === 'DEGRADED' },
      { id: 'P_SUIT', label: 'P-SUIT', isCritical: data.suitPressurePsi < 3.2, isWarning: data.suitPressurePsi < 3.8 },
      { id: 'VENT', label: 'VENT LOOP', isCritical: data.temperatureC > 38.5 || data.temperatureC < 34.0, isWarning: data.temperatureC > 37.8 || data.temperatureC < 35.8 },
      { id: 'H2O', label: 'H₂O EVAP', isCritical: data.feedwaterPct < 25, isWarning: data.feedwaterPct < 45 },
      { id: 'BATT', label: 'BATT LOW', isCritical: data.batteryPct < 20, isWarning: data.batteryPct < 35 },
      { id: 'COMM', label: 'COMM LOSS', isCritical: (data.commSignalPct ?? 98) < 40, isWarning: (data.commSignalPct ?? 98) < 70 },
      { id: 'RAD', label: 'RAD FLUX', isCritical: (data.radiationFlux ?? 0.04) > 10.0, isWarning: (data.radiationFlux ?? 0.04) > 1.5 },
    ];
  }, [data]);

  const x0 = 312;
  const tileW = 46;
  const tileH = 13;
  const gap = 4;

  return (
    <Reveal delay={0.25}>
      <g className="hud-cw-matrix">
        {flags.map((flag, idx) => {
          const x = x0 + idx * (tileW + gap);
          const y = 84;
          const statusClass = flag.isCritical
            ? 'hud-cw-tile--critical'
            : flag.isWarning
            ? 'hud-cw-tile--warning'
            : 'hud-cw-tile--nominal';

          return (
            <g key={flag.id} className={`hud-cw-tile ${statusClass}`}>
              <rect
                x={x}
                y={y}
                width={tileW}
                height={tileH}
                rx="2"
                className="hud-cw-bg"
              />
              <text
                x={x + tileW / 2}
                y={y + 9}
                textAnchor="middle"
                className="hud-cw-text"
              >
                {flag.label}
              </text>
            </g>
          );
        })}
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * NASA ATTITUDE GYRO & PITCH LADDER (Center Reticle Collimator)
 * ──────────────────────────────────────────────────────────────────────── */

export const AttitudeGyroLadder = memo(function AttitudeGyroLadder({
  pitchDeg = 1.8,
  rollDeg = -0.6,
  animate = true,
}: {
  pitchDeg?: number;
  rollDeg?: number;
  animate?: boolean;
}) {
  const ladderRef = useRef<SVGGElement>(null);

  useRaf((t) => {
    // Micro head sway representing human posture & breathing inside helmet
    const microPitch = pitchDeg + Math.sin(t / 2200) * 0.6;
    const microRoll = rollDeg + Math.cos(t / 2800) * 0.4;
    if (ladderRef.current) {
      const dy = -microPitch * 3.5;
      ladderRef.current.setAttribute(
        'transform',
        `translate(510 234) rotate(${microRoll.toFixed(2)}) translate(-510 ${234 + dy})`
      );
    }
  }, animate);

  return (
    <Reveal delay={0.45}>
      {/* 1. Stationary Helmet-Locked Boresight Waterline [ ── + ── ] */}
      <g filter="url(#shud-glow-sm)">
        {/* Center reticle dot */}
        <circle cx="510" cy="234" r="1.5" className="hud-reticle-core" />
        {/* Left and right boresight wings */}
        <path d="M486,234 L498,234 L498,238" className="hud-line hud-line--bright" strokeWidth="1.2" />
        <path d="M534,234 L522,234 L522,238" className="hud-line hud-line--bright" strokeWidth="1.2" />
        {/* Pitch reference carrot top */}
        <path d="M510,224 L507,220 L513,220 Z" className="hud-fill" />
      </g>

      {/* 2. Gyro Horizon & Pitch Ladder Rungs (World/Inertial-Stabilized) */}
      <g ref={ladderRef}>
        {/* Artificial Horizon 0° line (interrupted by boresight) */}
        <g opacity="0.65">
          <path d="M440,234 L478,234" className="hud-line" strokeWidth="1.2" />
          <circle cx="438" cy="234" r="1.5" className="hud-fill" />
          <path d="M542,234 L580,234" className="hud-line" strokeWidth="1.2" />
          <circle cx="582" cy="234" r="1.5" className="hud-fill" />
          <text x="432" y="236.5" textAnchor="end" className="hud-label hud-label--sm" style={{ fontSize: '7.5px' }}>
            00
          </text>
          <text x="588" y="236.5" textAnchor="start" className="hud-label hud-label--sm" style={{ fontSize: '7.5px' }}>
            00
          </text>
        </g>

        {/* +10° Climb / Elevation Rung */}
        <g opacity="0.45">
          <path d="M462,196 L484,196 L484,201" className="hud-line" strokeWidth="1" />
          <path d="M558,196 L536,196 L536,201" className="hud-line" strokeWidth="1" />
          <text x="456" y="198.5" textAnchor="end" className="hud-label hud-label--sm" style={{ fontSize: '7px' }}>
            +10
          </text>
          <text x="564" y="198.5" textAnchor="start" className="hud-label hud-label--sm" style={{ fontSize: '7px' }}>
            +10
          </text>
        </g>

        {/* -10° Dive / Depression Rung (Dashed for negative pitch per Mil-STD / NASA HUD) */}
        <g opacity="0.45">
          <path d="M462,272 L484,272 L484,267" className="hud-line hud-line--dash" strokeWidth="1" />
          <path d="M558,272 L536,272 L536,267" className="hud-line hud-line--dash" strokeWidth="1" />
          <text x="456" y="274.5" textAnchor="end" className="hud-label hud-label--sm" style={{ fontSize: '7px' }}>
            -10
          </text>
          <text x="564" y="274.5" textAnchor="start" className="hud-label hud-label--sm" style={{ fontSize: '7px' }}>
            -10
          </text>
        </g>

        {/* Bank angle roll ticks arc at top */}
        <g opacity="0.4" className="hud-line hud-line--faint">
          <path d="M475,172 A75,75 0 0 1 545,172" fill="none" strokeWidth="0.8" />
          <path d="M510,159 L510,163" strokeWidth="1.2" />
          <path d="M485,166 L488,170" strokeWidth="0.8" />
          <path d="M535,166 L532,170" strokeWidth="0.8" />
        </g>
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * NASA MISSION ELAPSED TIME (MET) & DSN COMM BITRATE STATUS
 * ──────────────────────────────────────────────────────────────────────── */

export const MissionTimeBanner = memo(function MissionTimeBanner({
  evaMet = '03:41:20',
  commSignalPct = 98,
  planet = 'Mars',
  earthUtc = '',
  marsSolarTime = '',
  marsSol = 142,
  lunarTime = '',
  lunarDay = 14,
}: {
  evaMet?: string;
  commSignalPct?: number;
  planet?: string;
  earthUtc?: string;
  marsSolarTime?: string;
  marsSol?: number;
  lunarTime?: string;
  lunarDay?: number;
}) {
  const isMars = planet === 'Mars';
  const isMoon = planet === 'Moon';

  const timeLabel = isMars ? 'MARS TIME' : isMoon ? 'LUNAR TIME' : 'STATION GMT';
  const timeValue = isMars
    ? `SOL ${marsSol} · ${(marsSolarTime || '12:22:49').replace(/\s*LMST/i, '')}`
    : isMoon
    ? `DAY ${lunarDay} · ${(lunarTime || earthUtc || 'SYNC').replace(/\s*(LTC|UTC)/i, '')}`
    : ((earthUtc || 'SYNC').replace(/\s*UTC/i, ''));
  const valueColor = isMars ? '#fed7aa' : isMoon ? '#bfdbfe' : '#effffe';

  return (
    <Reveal delay={0.15}>
      {/* Top Left: Real-Time Dynamic Surface Time (Compact Stacked HUD Badge) */}
      <g>
        <path d="M140,82 L254,82" className="hud-line hud-line--faint" />
        <circle cx="140" cy="82" r="1.5" className="hud-fill" />
        <text
          x="144"
          y="69"
          className="hud-label hud-label--sm"
          style={{ letterSpacing: '0.12em', opacity: 0.85, fontSize: '8.5px' }}
        >
          {timeLabel}
        </text>
        <text
          x="144"
          y="79"
          className="hud-value"
          style={{ fontSize: '10px', fontWeight: 700, fill: valueColor, letterSpacing: '0.04em' }}
        >
          {timeValue}
        </text>
      </g>

      {/* Top Right: DSN High-Gain Telemetry Link */}
      <g>
        <path d="M784,82 L896,82" className="hud-line hud-line--faint" />
        <circle cx="896" cy="82" r="1.5" className="hud-fill" />
        <text
          x="788"
          y="69"
          className="hud-label hud-label--sm"
          style={{ letterSpacing: '0.08em', opacity: 0.85, fontSize: '8.5px' }}
        >
          DSN BIT-LOCK
        </text>
        <text
          x="788"
          y="79"
          className="hud-value"
          style={{ fontSize: '10px', fontWeight: 700, fill: '#38bdf8', letterSpacing: '0.04em' }}
        >
          10 Hz · {commSignalPct}%
        </text>
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * Waypoint marker (world-locked – lives in the parallax layer)
 * ──────────────────────────────────────────────────────────────────────── */

export const CREW_SCENE_WAYPOINTS: Record<string, Record<string, { mode: string; line1: string; line2: string; distanceKm: number; bearingDeg: number }>> = {
  'Space Station': {
    'AST-01_COMMANDER': {
      mode: 'ORBITAL DOCK',
      line1: 'DESTINY LABORATORY',
      line2: 'TRUSS INTEGRITY S0',
      distanceKm: 0.028,
      bearingDeg: 310,
    },
    'AST-02_PILOT': {
      mode: 'DOCKING ADAPTER',
      line1: 'HARMONY NODE 2',
      line2: 'PMA-2 DOCK MECHANISM',
      distanceKm: 0.014,
      bearingDeg: 15,
    },
    'AST-03_MEDICAL': {
      mode: 'CREW AIRLOCK',
      line1: 'QUEST JOINT AIRLOCK',
      line2: 'HYPERBARIC RETREAT LOCK',
      distanceKm: 0.042,
      bearingDeg: 285,
    },
    'AST-04_ENGINEER': {
      mode: 'SARJ TRUSS ROTARY',
      line1: 'S6 SOLAR ARRAY ROTARY',
      line2: 'PHOTOVOLTAIC RADIATOR P6',
      distanceKm: 0.068,
      bearingDeg: 180,
    },
  },
  Moon: {
    'AST-01_COMMANDER': {
      mode: 'LUNAR TRAVERSE',
      line1: 'ARTEMIS BASE CAMP',
      line2: 'FOUNDATION HABITAT',
      distanceKm: 0.62,
      bearingDeg: 44,
    },
    'AST-02_PILOT': {
      mode: 'LANDER ASCENT',
      line1: 'STARSHIP HLS LANDER',
      line2: 'PAD 01 ASCENT STAGE',
      distanceKm: 1.1,
      bearingDeg: 142,
    },
    'AST-03_MEDICAL': {
      mode: 'MOBILE HABITAT',
      line1: 'PRESSURIZED ROVER 01',
      line2: 'SHACKLETON BIO-LAB',
      distanceKm: 0.41,
      bearingDeg: 190,
    },
    'AST-04_ENGINEER': {
      mode: 'SURFACE POWER',
      line1: 'KILOPLOWER FISSION RIG',
      line2: 'CRYO-STORAGE CELL B',
      distanceKm: 0.94,
      bearingDeg: 76,
    },
  },
  Mars: {
    'AST-01_COMMANDER': {
      mode: 'SURFACE EVA',
      line1: 'MARS ONE BASE',
      line2: 'HABITAT POD 01 // AIRLOCK',
      distanceKm: 0.032,
      bearingDeg: 4,
    },
    'AST-02_PILOT': {
      mode: 'SURFACE EVA',
      line1: 'MARS ONE BASE',
      line2: 'HABITAT POD 02 // COMMS',
      distanceKm: 0.035,
      bearingDeg: 8,
    },
    'AST-03_MEDICAL': {
      mode: 'BIO-SHELTER',
      line1: 'MARS ONE BASE',
      line2: 'BIO-HABITAT MODULE 03',
      distanceKm: 0.028,
      bearingDeg: 356,
    },
    'AST-04_ENGINEER': {
      mode: 'SOLAR ARRAY',
      line1: 'MARS ONE BASE',
      line2: 'PV COLLECTOR GRID 02',
      distanceKm: 0.016,
      bearingDeg: 14,
    },
  },
};

export const WaypointMarker = memo(function WaypointMarker({
  data,
  planet = 'Mars',
  crewId = 'AST-01_COMMANDER',
}: {
  data: SuitTelemetry;
  planet?: string;
  crewId?: string;
}) {
  const isMoon = planet === 'Moon';
  const isISS = planet === 'Space Station';

  const defaultForPlanet = CREW_SCENE_WAYPOINTS[planet]?.[crewId] ||
    CREW_SCENE_WAYPOINTS[planet]?.['AST-01_COMMANDER'] || {
      mode: isMoon ? 'LUNAR TRAVERSE' : isISS ? 'ORBITAL DOCK' : 'SURFACE EVA',
      line1: isMoon ? 'ARTEMIS BASE CAMP' : isISS ? 'HARMONY NODE' : 'MARS ONE BASE',
      line2: isMoon ? 'SHACKLETON OUTPOST' : isISS ? 'QUEST AIRLOCK 2' : 'HABITAT POD 01',
      distanceKm: isISS ? 0.04 : isMoon ? 0.6 : 0.032,
      bearingDeg: isISS ? 285 : isMoon ? 44 : 4,
    };

  const matchesCurrentPlanet = Boolean(
    data.waypoint?.line1 && (
      (isISS && (data.waypoint.line1.includes('NODE') || data.waypoint.line1.includes('HARMONY') || data.waypoint.line1.includes('QUEST') || data.waypoint.line1.includes('DESTINY') || data.waypoint.line1.includes('SARJ'))) ||
      (isMoon && (data.waypoint.line1.includes('ARTEMIS') || data.waypoint.line1.includes('SHACKLETON') || data.waypoint.line1.includes('LUNAR') || data.waypoint.line1.includes('LANDER'))) ||
      (!isISS && !isMoon && (data.waypoint.line1.includes('MARS') || data.waypoint.line1.includes('JEZERO') || data.waypoint.line1.includes('MAV') || data.waypoint.line1.includes('HABITAT')))
    )
  );

  const activeWp = matchesCurrentPlanet ? { ...defaultForPlanet, ...data.waypoint } : defaultForPlanet;

  const modeBadge = activeWp.mode;
  const targetLabel1 = activeWp.line1;
  const targetLabel2 = activeWp.line2;
  const distKm = activeWp.distanceKm;
  const bearingDeg = activeWp.bearingDeg;

  // Intelligent distance formatting
  const distText = distKm < 0.1
    ? `${Math.round(distKm * 1000)}`
    : distKm.toFixed(1);
  const distUnit = distKm < 0.1 ? 'm' : 'km';

  return (
    <Reveal delay={0.7}>
      <g>
        {/* Outer Reticle Pulse & Core Rings */}
        <circle cx="510" cy="234" r="16" className="hud-reticle-pulse" />
        <circle cx="510" cy="234" r="12.5" className="hud-reticle" />
        <circle cx="510" cy="234" r="4" className="hud-reticle-core" />

        {/* Center Target Crosshairs */}
        <path d="M499,234 L504,234 M516,234 L521,234" className="hud-line hud-line--bright" />
        <path d="M510,223 L510,228 M510,240 L510,245" className="hud-line hud-line--bright" />

        {/* Sci-Fi Tactical Corner Framing Brackets */}
        <path d="M492,222 L492,216 L498,216" className="hud-line hud-line--dim" />
        <path d="M528,216 L528,222 M522,216 L528,216" className="hud-line hud-line--dim" />
        <path d="M492,246 L492,252 L498,252" className="hud-line hud-line--dim" />
        <path d="M528,246 L528,252 M522,252 L528,252" className="hud-line hud-line--dim" />

        {/* Leader Line to Waypoint Telemetry Block (Anchored cleanly at corner bracket) */}
        <path d="M528,216 L542,196 L632,196 L632,200" className="hud-line" />

        {/* Tactical Mode & Target Designators */}
        <text x="546" y="190" className="hud-label hud-label--sm" fill="#38bdf8" style={{ fontSize: '7.5px', letterSpacing: '0.12em', fontWeight: 600 }}>
          {modeBadge} · NAV-LOCK
        </text>
        <text x="546" y="208" style={{ fontSize: '10.5px', fontWeight: 700, fill: '#ffffff', letterSpacing: '0.08em' }}>
          {targetLabel1}
        </text>
        <text x="546" y="219" className="hud-label hud-label--sm" style={{ opacity: 0.75, letterSpacing: '0.06em' }}>
          {targetLabel2}
        </text>

        {/* Unified Telemetry Vector: Distance + Bearing */}
        <text x="546" y="233">
          <tspan className="hud-value" style={{ fontSize: '12px', fontWeight: 800 }}>{distText}</tspan>
          <tspan className="hud-value-unit" dx="2" style={{ fontSize: '8.5px' }}>{distUnit}</tspan>
          <tspan fill="#38bdf8" dx="8" style={{ fontSize: '10.5px', fontWeight: 700 }}>↗</tspan>
          <tspan className="hud-label" dx="3" style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em' }}>
            BEARING {bearingDeg}°
          </tspan>
        </text>

        {/* Vertical Azimuth Plummet Line */}
        <path d="M510,254 L510,286" className="hud-line" />
        <circle cx="510" cy="287" r="1.6" className="hud-reticle-core" />

        {/* Ranging Pitch Ladder Ticks */}
        <path d="M507,300 L492,410" className="hud-line hud-line--dash" />
        <path d="M496,323 L512,323" className="hud-line" />
        <path d="M489,375 L505,375" className="hud-line" />
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * Compass (bottom-centre)
 * ──────────────────────────────────────────────────────────────────────── */

const TICK_STEP = 10;

export const CompassStrip = memo(function CompassStrip({ animate }: { animate: boolean }) {
  const ticksRef = useRef<SVGGElement>(null);
  useRaf((t) => {
    const off = 3.2 * Math.sin(t / 2600) + 1.4 * Math.sin(t / 1100);
    ticksRef.current?.setAttribute('transform', `translate(${off.toFixed(2)} 0)`);
  }, animate);

  const ticks = useMemo(() => {
    const out: { x: number; major: boolean }[] = [];
    for (let x = 390; x <= 630; x += TICK_STEP) out.push({ x, major: (x - 510) % 50 === 0 });
    return out;
  }, []);

  return (
    <Reveal delay={0.85}>
      <g>
        <path d="M510,443 L515.5,451.5 L504.5,451.5 Z" className="hud-fill" />
        <text x="510" y="470" textAnchor="middle" className="hud-compass-n">N</text>
        <path d="M456,466 L497,466" className="hud-line hud-line--dim" />
        <path d="M523,466 L564,466" className="hud-line hud-line--dim" />
        <path d="M330,484 L410,484" stroke="url(#shud-compass-fade-l)" strokeWidth="1" />
        <path d="M614,484 L694,484" stroke="url(#shud-compass-fade-r)" strokeWidth="1" />
      </g>
      <g filter="url(#shud-glow-sm)">
        <path d="M410,484 L614,484" className="hud-line hud-line--dim" />
        <g clipPath="url(#shud-compass-clip)">
          <g ref={ticksRef}>
            {ticks.map((tk) => (
              <path key={tk.x} d={`M${tk.x},484 L${tk.x},${tk.major ? 476 : 480}`} className={`hud-line ${tk.major ? '' : 'hud-line--dim'}`} />
            ))}
          </g>
        </g>
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * Battery (bottom-right)
 * ──────────────────────────────────────────────────────────────────────── */

const BATT_SEGMENTS = 10;

export const BatteryPanel = memo(function BatteryPanel({ pct }: { pct: number }) {
  const lit = Math.round((pct / 100) * BATT_SEGMENTS + 0.2);
  const x0 = 777;
  const segW = 5.2;
  const gap = 1.45;
  return (
    <Reveal delay={0.6}>
      <g>
        <text x="773" y="373" className="hud-label">EMU BATTERY BUS · 28.4V</text>
        <path d="M767,378 L896,378" className="hud-line hud-line--faint" />
        <rect x="773" y="385" width="74" height="22" rx="2.5" className="hud-batt-shell" />
        <rect x="847.5" y="391" width="4" height="10" rx="1" className="hud-fill" />
        {Array.from({ length: BATT_SEGMENTS }, (_, i) => (
          <rect
            key={i}
            x={x0 + i * (segW + gap)}
            y="389"
            width={segW}
            height="14"
            rx="0.8"
            className={i < lit ? 'hud-batt-seg' : 'hud-batt-seg hud-batt-seg--off'}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
        <text x="860" y="398">
          <tspan className="hud-value">{Math.round(pct)}</tspan>
          <tspan className="hud-value-unit" dx="1.5">%</tspan>
        </text>
        <text x="860" y="408" className="hud-label hud-label--sm" style={{ fontSize: '7.2px', opacity: 0.75 }}>
          4.8A DRAW
        </text>
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * Side gauges hugging the visor rim
 * ──────────────────────────────────────────────────────────────────────── */

const G_CY = 280;
const G_R = 534;
const G_SEGMENTS: [number, number][] = [
  [-14.2, -12.1],
  [-11.6, -9.5],
  [-9.0, -6.9],
  [-6.4, -4.4],
  [3.8, 5.9],
  [6.4, 8.5],
  [9.0, 11.1],
  [11.6, 13.4],
];

export const SideGauge = memo(function SideGauge({ side }: { side: Side }) {
  const cx = side === 'left' ? 588 : 436;
  const ticks = useMemo(() => {
    const out: string[] = [];
    for (let a = -17; a <= 17; a += 1) {
      const major = a % 5 === 0;
      const [x1, y1] = gaugePoint(cx, G_CY, major ? 515 : 519, side, a);
      const [x2, y2] = gaugePoint(cx, G_CY, 525, side, a);
      out.push(`M${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}`);
    }
    return out.join(' ');
  }, [cx, side]);

  return (
    <Reveal delay={0.2}>
      {/* soft cyan light spilling onto the glass rim */}
      <polyline points={gaugeArc(cx, G_CY, 546, side, -16, 15)} fill="none" stroke="#3fe6f0" strokeOpacity="0.35" strokeWidth="12" filter="url(#shud-rim-glow)" />
      <g>
        <polyline points={gaugeArc(cx, G_CY, 545, side, -18, 18)} className="hud-line hud-line--faint" fill="none" />
        <polyline points={gaugeArc(cx, G_CY, 534, side, -3.9, 3.3)} className="hud-gauge-track" fill="none" />
        {G_SEGMENTS.map(([a0, a1], i) => (
          <polyline
            key={i}
            points={gaugeArc(cx, G_CY, G_R, side, a0, a1, 0.25)}
            className="hud-gauge-seg"
            fill="none"
            style={{ '--i': side === 'left' ? i : G_SEGMENTS.length - i } as CSSProperties}
          />
        ))}
        <path d={ticks} className="hud-line hud-line--dim" />
        <polyline points={gaugeArc(cx, G_CY, 509, side, -12, 12)} className="hud-line hud-line--faint" fill="none" />
      </g>
    </Reveal>
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * 3D Holographic Body Scanner Widget (Bottom-Left Visor Gap)
 * ──────────────────────────────────────────────────────────────────────── */

export const HolographicBodyWidget = memo(function HolographicBodyWidget({
  heartRate,
  temperatureC,
  crewId = 'AST-01_COMMANDER',
}: {
  heartRate: number;
  temperatureC: number;
  crewId?: string;
}) {
  const callsign = {
    'AST-01_COMMANDER': 'CDR HALEY · BIO-SCAN',
    'AST-02_PILOT':     'PLT CHRIS · BIO-SCAN',
    'AST-03_MEDICAL':   'CMO SIAN · BIO-SCAN',
    'AST-04_ENGINEER':  'ENG LEO · BIO-SCAN',
  }[crewId] || 'EVA-01 · BIO-SCAN';

  return (
    <Reveal delay={0.4}>
      {/* Sci-fi HUD Framing Brackets */}
      <g className="hud-line hud-line--dim">
        <path d="M142,268 L142,258 L154,258" />
        <path d="M266,258 L278,258 L278,268" />
        <path d="M142,428 L142,438 L154,438" />
        <path d="M266,438 L278,438 L278,428" />
        {/* Subtle elevation ticks on left ruler */}
        {[285, 320, 355, 390, 415].map((y) => (
          <path key={y} d={`M137,${y} L142,${y}`} className="hud-line hud-line--faint" />
        ))}
      </g>
      {/* 3D Hologram Mount */}
      <foreignObject x="142" y="258" width="136" height="180" style={{ overflow: 'visible', pointerEvents: 'auto' }}>
        <HolographicSuitScanner3D
          heartRate={heartRate}
          temperatureC={temperatureC}
          width={136}
          height={180}
          astronautLabel={callsign}
        />
      </foreignObject>
    </Reveal>
  );
});

