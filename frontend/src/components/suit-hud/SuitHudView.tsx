import { useEffect, useRef, useState } from 'react';
import './SuitHudView.css';
import { VB_ASPECT, VB_H, VB_W, VIEWBOX } from './geometry';
import { GlassUnderLayer, HelmetShellLayer } from './HelmetLayers';
import {
  BatteryPanel,
  BiometricsPanel,
  CompassStrip,
  FrameAccents,
  HolographicBodyWidget,
  HudDefs,
  LifeSupportPanel,
  SideGauge,
  VoiceWaveform,
  WaypointMarker,
} from './HudWidgets';
import { useSuitTelemetry, type SuitTelemetry } from './useSuitTelemetry';

export interface SuitHudViewProps {
  /** Live values; any field supplied here overrides the simulation. */
  telemetry?: Partial<SuitTelemetry>;
  /** Gently drift values around the reference numbers (default true). */
  simulate?: boolean;
  /** Background plate seen through the visor. */
  landscapeSrc?: string;
}

type Fit = 'slice' | 'meet';

/** Fill the screen when the crop is small; otherwise letterbox into the helmet. */
function computeFit(): Fit {
  const ratio = window.innerWidth / window.innerHeight / VB_ASPECT;
  return ratio > 0.9 && ratio < 1.12 ? 'slice' : 'meet';
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * First-person astronaut helmet HUD on the Martian surface.
 *
 * Built as five stacked, identically-scaled SVG layers:
 *   1. world      – Mars landscape plate (parallax)
 *   2. glass      – vignette + rim refraction
 *   3. hud        – helmet-locked HUD graphics
 *   4. waypoint   – world-locked nav marker (parallax)
 *   5. shell      – glass glare, helmet interior, bezel
 * Parallax layers move via CSS transforms so they stay GPU-composited.
 */
export function SuitHudView({ telemetry, simulate = true, landscapeSrc = '/suit-hud/mars_surface.jpg' }: SuitHudViewProps) {
  const data = useSuitTelemetry(telemetry, simulate);
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;
  const [fit, setFit] = useState<Fit>(computeFit);
  const worldLayers = useRef<(SVGSVGElement | null)[]>([]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'H.E.L.I.O.S · Suit HUD — Mars EVA';
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setFit(computeFit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Head-movement parallax: the world drifts opposite to the pointer.
  useEffect(() => {
    if (!animate) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    let running = false;

    const unitToPx = () => {
      const sx = window.innerWidth / VB_W;
      const sy = window.innerHeight / VB_H;
      return fit === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
    };
    const step = () => {
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      const s = unitToPx();
      const tf = `translate3d(${(cur.x * s).toFixed(2)}px, ${(cur.y * s).toFixed(2)}px, 0)`;
      worldLayers.current.forEach((el) => {
        if (el) el.style.transform = tf;
      });
      if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.01) {
        raf = requestAnimationFrame(step);
      } else {
        running = false;
      }
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    };
    const onMove = (e: PointerEvent) => {
      target.x = -((e.clientX / window.innerWidth) * 2 - 1) * 8;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1) * 5;
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [animate, fit]);

  const par = `xMidYMid ${fit}`;

  return (
    <main className="suit-hud" id="suit-hud-root">
      <h1 className="suit-hud__sr">Astronaut suit heads-up display — Mars EVA</h1>

      {/* 1 · World plate (oversized so parallax never reveals an edge) */}
      <svg
        ref={(el) => {
          worldLayers.current[0] = el;
        }}
        className="suit-hud__layer suit-hud__layer--world"
        viewBox={VIEWBOX}
        preserveAspectRatio={par}
        aria-hidden="true"
      >
        <image href={landscapeSrc} x="-16" y="-10" width="1056" height="589.4" preserveAspectRatio="xMidYMid slice" />
      </svg>

      {/* 2 · Glass under-effects */}
      <GlassUnderLayer fit={fit} />

      {/* 3 · Helmet-locked HUD */}
      <svg
        className={`suit-hud__layer suit-hud__hud ${animate ? '' : 'suit-hud--static'}`}
        viewBox={VIEWBOX}
        preserveAspectRatio={par}
        role="img"
        aria-label={`Suit HUD. Heart rate ${data.heartRate} BPM, SpO2 ${data.spo2}%, O2 reserve ${data.o2Reserve}%, CO2 scrubber ${data.co2Scrubber}, suit pressure ${data.suitPressurePsi} PSI, temperature ${data.temperatureC}°C, battery ${data.batteryPct}%.`}
      >
        <HudDefs />
        <FrameAccents />
        <SideGauge side="left" />
        <SideGauge side="right" />
        <VoiceWaveform animate={animate} status={data.aiStatus} />
        <BiometricsPanel data={data} animate={animate} />
        <HolographicBodyWidget heartRate={data.heartRate} temperatureC={data.temperatureC} />
        <LifeSupportPanel data={data} />
        <BatteryPanel pct={data.batteryPct} />
        <CompassStrip animate={animate} />
      </svg>

      {/* 4 · World-locked waypoint */}
      <svg
        ref={(el) => {
          worldLayers.current[1] = el;
        }}
        className="suit-hud__layer suit-hud__layer--world suit-hud__hud"
        viewBox={VIEWBOX}
        preserveAspectRatio={par}
        aria-label={`Waypoint ${data.waypoint.line1} ${data.waypoint.line2}, ${data.waypoint.distanceKm} km, bearing ${data.waypoint.bearingDeg} degrees`}
        role="img"
      >
        {/* filters are shared from the HUD layer's <HudDefs /> */}
        <WaypointMarker data={data} />
      </svg>

      {/* 5 · Glass glare + helmet shell */}
      <HelmetShellLayer fit={fit} />

      {/* Floating HUD controls bar (fades into background, active on hover) */}
      <nav className="suit-hud__controls" aria-label="HUD controls">
        <a href="/" className="suit-hud__btn" title="Return to HELIOS Dashboard">
          <span className="suit-hud__btn-icon">‹</span>
          <span>MCC DASHBOARD</span>
        </a>
        <button
          type="button"
          className="suit-hud__btn"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          title="Toggle Fullscreen"
        >
          <span>⛶ FULLSCREEN</span>
        </button>
      </nav>
    </main>
  );
}

export default SuitHudView;
