import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
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
export function HudDefs() {
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
}

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

export function VoiceWaveform({ animate, status }: { animate: boolean; status: string }) {
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const seeds = useMemo(() => {
    const rnd = mulberry32(1337);
    return Array.from({ length: WAVE_BARS }, () => ({
      f1: 0.004 + rnd() * 0.007,
      p1: rnd() * Math.PI * 2,
      f2: 0.0011 + rnd() * 0.0022,
      p2: rnd() * Math.PI * 2,
      base: 0.35 + rnd() * 0.65,
    }));
  }, []);

  const heightAt = (i: number, t: number) => {
    const s = seeds[i];
    const env = waveEnvelope(WAVE_X0 + i * WAVE_STEP);
    const n = animate
      ? 0.25 + 0.75 * Math.abs(Math.sin(t * s.f1 + s.p1) * (0.55 + 0.45 * Math.sin(t * s.f2 + s.p2)))
      : s.base;
    return Math.max(1.4, env * WAVE_MAX * n);
  };

  useRaf((t) => {
    for (let i = 0; i < WAVE_BARS; i++) {
      const el = bars.current[i];
      if (!el) continue;
      const h = heightAt(i, t);
      el.setAttribute('y', (WAVE_CY - h).toFixed(2));
      el.setAttribute('height', (h * 2).toFixed(2));
    }
  }, animate);

  return (
    <Reveal delay={0.1}>
      <g filter="url(#shud-glow-sm)">
        <path d="M336,38 L380,38" stroke="url(#shud-fade-l)" strokeWidth="1" />
        <path d="M644,38 L688,38" stroke="url(#shud-fade-r)" strokeWidth="1" />
        {seeds.map((_, i) => {
          const h = heightAt(i, 0);
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
              className="hud-wave-bar"
            />
          );
        })}
      </g>
      <g>
        <text x="512" y="75" textAnchor="middle" className="hud-ai-status">
          SUIT AI // {status}
        </text>
        <path d="M392,79 L398,85 L626,85 L632,79" className="hud-line hud-line--dim" />
      </g>
    </Reveal>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Thin frame accents (corner brackets)
 * ──────────────────────────────────────────────────────────────────────── */

export function FrameAccents() {
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
}

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

export function BiometricsPanel({ data, animate }: { data: SuitTelemetry; animate: boolean }) {
  const spoBar = 82 * Math.min(1, Math.max(0, (data.spo2 - 80) / 19));
  return (
    <Reveal delay={0.35}>
      <g >
        <text x="140" y="108" className="hud-title">BIOMETRICS</text>
        <path d="M130,121 L136,114 L300,114 L304,110" className="hud-line" />

        <HeartIcon />
        <text x="168" y="135" className="hud-label">HEART RATE</text>
        <text x="167" y="161">
          <tspan className="hud-value-xl">{data.heartRate}</tspan>
          <tspan className="hud-unit" dx="4">BPM</tspan>
        </text>

        <path d="M134,176 L300,176" className="hud-line hud-line--faint" />

        <DropIcon />
        <text x="168" y="193" className="hud-label">
          SpO
          <Sub>2</Sub>
        </text>
        <text x="167" y="217">
          <tspan className="hud-value-xl">{data.spo2}</tspan>
          <tspan className="hud-unit-lg" dx="1">%</tspan>
        </text>
        <path d={`M168,224 L${168 + spoBar},224`} className="hud-bar" />
      </g>
      <EcgTrace heartRate={data.heartRate} animate={animate} />
    </Reveal>
  );
}

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

export function LifeSupportPanel({ data }: { data: SuitTelemetry }) {
  const rows = [
    {
      y: 137,
      icon: <O2Icon y={137} />,
      label: (
        <>
          O<Sub>2</Sub> RESERVE
        </>
      ),
      value: (
        <>
          <tspan className="hud-value">{data.o2Reserve}</tspan>
          <tspan className="hud-value-unit" dx="1.5">%</tspan>
        </>
      ),
    },
    {
      y: 169,
      icon: <FanIcon y={169} />,
      label: (
        <>
          CO<Sub>2</Sub> SCRUBBER
        </>
      ),
      value: <tspan className={`hud-value hud-value--word ${data.co2Scrubber !== 'NOMINAL' ? 'hud-value--warn' : ''}`}>{data.co2Scrubber}</tspan>,
    },
    {
      y: 201,
      icon: <GaugeIcon y={201} />,
      label: <>SUIT PRESSURE</>,
      value: (
        <>
          <tspan className="hud-value">{data.suitPressurePsi.toFixed(1)}</tspan>
          <tspan className="hud-value-unit" dx="3">PSI</tspan>
        </>
      ),
    },
    {
      y: 234,
      icon: <ThermoIcon y={234} />,
      label: <>TEMPERATURE</>,
      value: <tspan className="hud-value">{data.temperatureC.toFixed(1)}°C</tspan>,
    },
  ];

  return (
    <Reveal delay={0.5}>
      <g >
        <text x="742" y="108" className="hud-title">LIFE SUPPORT</text>
        <path d="M733,121 L739,114 L906,114 L910,110" className="hud-line" />
        <path d="M733,121 L733,248" className="hud-line hud-line--faint" />
        {rows.map((r, i) => (
          <g key={r.y}>
            {r.icon}
            <text x="779" y={r.y + 3.2} className="hud-label">
              {r.label}
            </text>
            <text x="919" y={r.y + 4.5} textAnchor="end">
              {r.value}
            </text>
            {i < rows.length - 1 && <path d={`M741,${r.y + 16} L919,${r.y + 16}`} className="hud-line hud-line--faint" />}
          </g>
        ))}
      </g>
    </Reveal>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Waypoint marker (world-locked – lives in the parallax layer)
 * ──────────────────────────────────────────────────────────────────────── */

export function WaypointMarker({ data }: { data: SuitTelemetry }) {
  const w = data.waypoint;
  return (
    <Reveal delay={0.7}>
      <g >
        <circle cx="510" cy="234" r="12.5" className="hud-reticle-pulse" />
        <circle cx="510" cy="234" r="12.5" className="hud-reticle" />
        <circle cx="510" cy="234" r="4" className="hud-reticle-core" />

        <path d="M519,225 L535,198" className="hud-line" />
        <text x="541" y="196" className="hud-label hud-label--sm">{w.line1}</text>
        <text x="541" y="207" className="hud-label hud-label--sm">{w.line2}</text>
        <text x="541" y="224">
          <tspan className="hud-value">{w.distanceKm.toFixed(1)}</tspan>
          <tspan className="hud-value-unit" dx="3">km</tspan>
        </text>
        <path d="M542,240 L549,233 M544.5,233 L549,233 L549,237.5" className="hud-line hud-line--bright" />
        <text x="553" y="240" className="hud-label hud-label--md">{w.bearingDeg}°</text>

        <path d="M510,247 L510,286" className="hud-line" />
        <circle cx="510" cy="287" r="1.6" className="hud-reticle-core" />

        <path d="M507,300 L492,410" className="hud-line hud-line--dash" />
        <path d="M496,323 L512,323" className="hud-line" />
        <path d="M489,375 L505,375" className="hud-line" />
      </g>
    </Reveal>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Compass (bottom-centre)
 * ──────────────────────────────────────────────────────────────────────── */

const TICK_STEP = 10;

export function CompassStrip({ animate }: { animate: boolean }) {
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
      <g >
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
}

/* ────────────────────────────────────────────────────────────────────────
 * Battery (bottom-right)
 * ──────────────────────────────────────────────────────────────────────── */

const BATT_SEGMENTS = 10;

export function BatteryPanel({ pct }: { pct: number }) {
  const lit = Math.round((pct / 100) * BATT_SEGMENTS + 0.2);
  const x0 = 777;
  const segW = 5.2;
  const gap = 1.45;
  return (
    <Reveal delay={0.6}>
      <g >
        <text x="773" y="373" className="hud-label">BATTERY</text>
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
        <text x="860" y="401.5">
          <tspan className="hud-value">{Math.round(pct)}</tspan>
          <tspan className="hud-value-unit" dx="1.5">%</tspan>
        </text>
      </g>
    </Reveal>
  );
}

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

export function SideGauge({ side }: { side: Side }) {
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
      <g >
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
}

/* ────────────────────────────────────────────────────────────────────────
 * 3D Holographic Body Scanner Widget (Bottom-Left Visor Gap)
 * ──────────────────────────────────────────────────────────────────────── */

export function HolographicBodyWidget({
  heartRate,
  temperatureC,
}: {
  heartRate: number;
  temperatureC: number;
}) {
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
        />
      </foreignObject>
    </Reveal>
  );
}
