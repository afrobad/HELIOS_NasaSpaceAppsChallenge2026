import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const rand = (a, b) => a + Math.random() * (b - a);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const $ = (id) => document.getElementById(id);

/** Radial glow texture (used by sun, flares, rings). */
export function glowTexture(size = 256, stops = null) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  (stops || [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,238,200,.75)'], [0.5, 'rgba(255,200,120,.18)'], [1, 'rgba(255,190,100,0)']])
    .forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Authentic NASA Starburst Diffraction Spikes (Multi-spike radiant flare as seen from orbit). */
export function sunStarburstTexture() {
  const size = 1024;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;

  // 1. Brilliant white-hot circular core
  const coreGrd = g.createRadialGradient(cx, cy, 0, cx, cy, 140);
  coreGrd.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  coreGrd.addColorStop(0.22, 'rgba(255, 252, 240, 0.95)');
  coreGrd.addColorStop(0.55, 'rgba(255, 230, 160, 0.45)');
  coreGrd.addColorStop(0.85, 'rgba(255, 200, 100, 0.12)');
  coreGrd.addColorStop(1, 'rgba(255, 180, 80, 0)');
  g.fillStyle = coreGrd;
  g.fillRect(0, 0, size, size);

  // 2. Wide solar corona
  const coronaGrd = g.createRadialGradient(cx, cy, 0, cx, cy, 480);
  coronaGrd.addColorStop(0, 'rgba(255, 245, 220, 0.7)');
  coronaGrd.addColorStop(0.2, 'rgba(255, 220, 150, 0.35)');
  coronaGrd.addColorStop(0.5, 'rgba(255, 180, 80, 0.12)');
  coronaGrd.addColorStop(1, 'rgba(255, 160, 60, 0)');
  g.fillStyle = coronaGrd;
  g.fillRect(0, 0, size, size);

  // 3. Radiant Diffraction Starburst Rays (16 multi-spike rays of varying lengths)
  const rays = [
    { angle: 0, len: 490, w: 2.8, alpha: 0.95 },
    { angle: Math.PI / 2, len: 490, w: 2.8, alpha: 0.95 },
    { angle: Math.PI / 4, len: 440, w: 2.2, alpha: 0.85 },
    { angle: 3 * Math.PI / 4, len: 440, w: 2.2, alpha: 0.85 },
    // Intermediate spikes
    { angle: Math.PI / 8, len: 360, w: 1.6, alpha: 0.65 },
    { angle: 3 * Math.PI / 8, len: 360, w: 1.6, alpha: 0.65 },
    { angle: 5 * Math.PI / 8, len: 360, w: 1.6, alpha: 0.65 },
    { angle: 7 * Math.PI / 8, len: 360, w: 1.6, alpha: 0.65 },
    // Subtle secondary spikes
    { angle: Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
    { angle: 3 * Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
    { angle: 5 * Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
    { angle: 7 * Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
    { angle: 9 * Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
    { angle: 11 * Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
    { angle: 13 * Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
    { angle: 15 * Math.PI / 16, len: 260, w: 1.2, alpha: 0.45 },
  ];

  rays.forEach(({ angle, len, w, alpha }) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    const rg = g.createLinearGradient(-len, 0, len, 0);
    rg.addColorStop(0, 'rgba(255, 240, 200, 0)');
    rg.addColorStop(0.35, `rgba(255, 245, 220, ${alpha * 0.4})`);
    rg.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
    rg.addColorStop(0.65, `rgba(255, 245, 220, ${alpha * 0.4})`);
    rg.addColorStop(1, 'rgba(255, 240, 200, 0)');
    g.fillStyle = rg;
    g.fillRect(-len, -w / 2, len * 2, w);
    g.restore();
  });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Subtle, delicate star-spark texture (tiny 4-ray solar glint, NOT a horizon streak). */
export function sparkTexture() {
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;

  // Center radial glow
  const rGrd = g.createRadialGradient(cx, cy, 0, cx, cy, 64);
  rGrd.addColorStop(0, 'rgba(255,255,255,1.0)');
  rGrd.addColorStop(0.25, 'rgba(255,245,210,0.65)');
  rGrd.addColorStop(0.6, 'rgba(255,220,150,0.18)');
  rGrd.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = rGrd; g.fillRect(0, 0, size, size);

  // Delicate cross rays (soft, thin, localized spark)
  const drawRay = (angle, len, w) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    const rg = g.createLinearGradient(-len, 0, len, 0);
    rg.addColorStop(0, 'rgba(255,240,200,0)');
    rg.addColorStop(0.4, 'rgba(255,250,230,0.4)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    rg.addColorStop(0.6, 'rgba(255,250,230,0.4)');
    rg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = rg;
    g.fillRect(-len, -w / 2, len * 2, w);
    g.restore();
  };

  drawRay(0, 96, 6);
  drawRay(Math.PI / 2, 96, 6);
  drawRay(Math.PI / 4, 52, 4);
  drawRay(-Math.PI / 4, 52, 4);

  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Horizontal streak texture (subtle warm starburst ray). */
export function streakTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 512, 0);
  grd.addColorStop(0, 'rgba(255,240,200,0)'); grd.addColorStop(0.5, 'rgba(255,250,235,.8)'); grd.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 64);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 64);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v; g.fillRect(0, 0, 512, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Light-shaft gradient: bright at u=0 fading to 0 at u=1, soft at the v edges. */
export function shaftTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, 'rgba(255,255,255,.95)'); h.addColorStop(0.6, 'rgba(255,255,255,.35)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h; g.fillRect(0, 0, 256, 64);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 64);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v; g.fillRect(0, 0, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Wrap an object in a Group, scaled so its largest dimension (or height) equals `size`,
 * with the pivot at the bbox centre ('center') or bottom-centre ('bottom').
 */
export function normalize(obj, { size = 1, by = 'max', pivot = 'center', precise = false } = {}) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, precise);
  const dim = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const ref = by === 'height' ? dim.y : by === 'width' ? dim.x : Math.max(dim.x, dim.y, dim.z);
  const s = ref > 1e-6 ? size / ref : 1;
  const inner = new THREE.Group(); inner.add(obj);
  obj.position.sub(pivot === 'bottom' ? new THREE.Vector3(ctr.x, box.min.y, ctr.z) : ctr);
  const outer = new THREE.Group(); outer.add(inner); outer.scale.setScalar(s);
  outer.userData.dim = dim.multiplyScalar(s);
  return outer;
}

export function disposeTree(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { Object.values(m).forEach((v) => v && v.isTexture && v.dispose()); m.dispose(); });
  });
}
