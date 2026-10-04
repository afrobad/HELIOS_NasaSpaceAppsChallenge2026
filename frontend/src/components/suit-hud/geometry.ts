/**
 * Shared geometry for the Suit HUD.
 *
 * Every layer of the HUD is drawn in the same 1024 × 571 coordinate space
 * (the native size of the reference artwork). Because every stacked SVG layer
 * uses the identical viewBox + preserveAspectRatio, all layers stay perfectly
 * registered with each other at any screen size.
 */

export const VB_W = 1024;
export const VB_H = 571;
export const VIEWBOX = `0 0 ${VB_W} ${VB_H}`;
export const VB_ASPECT = VB_W / VB_H;

/** Optical centre of the visor – used for concentric rim scaling. */
export const VISOR_CX = 512;
export const VISOR_CY = 255;

/**
 * Visor glass opening – a wide "ski-goggle" rounded rectangle whose lower
 * edge arches up over the chin console. Symmetric about x = 512.
 */
export const VISOR_D =
  'M512,2 C700,2 862,6 934,30 C988,50 1006,118 1006,200 L1006,330 ' +
  'C1006,402 988,452 936,480 C880,508 762,516 682,508 C612,502 592,488 512,488 ' +
  'C432,488 412,502 342,508 C262,516 144,508 88,480 C36,452 18,402 18,330 ' +
  'L18,200 C18,118 36,50 90,30 C162,6 324,2 512,2 Z';

/** SVG transform that scales a shape about the visor centre. */
export function scaleAboutVisor(sx: number, sy: number): string {
  return `translate(${VISOR_CX} ${VISOR_CY}) scale(${sx} ${sy}) translate(${-VISOR_CX} ${-VISOR_CY})`;
}

export type Side = 'left' | 'right';

/**
 * Polar → cartesian for the side gauges. `a` is an angular offset in degrees
 * from the horizontal; positive values move downward on screen. The left
 * gauge bulges to the left, the right gauge mirrors it.
 */
export function gaugePoint(cx: number, cy: number, r: number, side: Side, a: number): [number, number] {
  const rad = (a * Math.PI) / 180;
  const dx = r * Math.cos(rad);
  const dy = r * Math.sin(rad);
  return [side === 'left' ? cx - dx : cx + dx, cy + dy];
}

/** Polyline "points" string along a gauge arc between two offsets. */
export function gaugeArc(cx: number, cy: number, r: number, side: Side, a0: number, a1: number, step = 0.5): string {
  const pts: string[] = [];
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const [x, y] = gaugePoint(cx, cy, r, side, a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Small deterministic PRNG so animated noise is stable between renders. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
