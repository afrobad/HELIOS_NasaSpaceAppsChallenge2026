// Procedural fallbacks: if a model is missing from /model, these keep the whole system working.
import * as THREE from 'three';
import { CABIN } from './config.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.3, ...o });

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function makeAstronaut() {
  const g = new THREE.Group();
  const white = std(0xe9e9ee, { roughness: 0.75, metalness: 0.05 });
  const gold = std(0xd8a23a, { roughness: 0.12, metalness: 1 });
  const cap = (r, l, m = white) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6,14), m);
  const torso = cap(1.05, 1.5); g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 16), white); head.position.y = 2.25; g.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), gold);
  visor.scale.set(1, 0.9, 0.9); visor.position.set(0, 2.25, 0.32); visor.rotation.x = Math.PI * 0.38; g.add(visor);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.2, 0.9), std(0xcfcfd6)); pack.position.set(0, 0.2, -1.05); g.add(pack);
  const limbs = [];
  const mkLimb = (x, y, rz, len, r) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = cap(r, len); m.position.y = -(len / 2 + r); p.add(m); p.rotation.z = rz; g.add(p); limbs.push(p); return p; };
  mkLimb(-1.35, 0.9, 0.9, 1.1, 0.38); mkLimb(1.35, 0.9, -0.9, 1.1, 0.38);
  mkLimb(-0.55, -1.5, 0.22, 1.5, 0.45); mkLimb(0.55, -1.5, -0.22, 1.5, 0.45);
  g.userData.animate = (t) => limbs.forEach((l, i) => { l.rotation.x = Math.sin(t * 0.9 + i * 1.3) * 0.25; });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeEarth() {
  const texLoader = new THREE.TextureLoader();
  const tex = texLoader.load('/cabin/textures/earth_8k.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.05 }));
}

export function makeStation() {
  const g = new THREE.Group();
  const metal = std(0xc9ccd2, { metalness: 0.6, roughness: 0.4 });
  const panelTex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#0d2a5c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8b24a'; c.lineWidth = 2;
    for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 0.35), metal); g.add(truss);
  [[-4.5, 0], [0, 0], [4.5, 0]].forEach(([x]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3.2, 20), metal); m.rotation.z = Math.PI / 2; m.position.set(x, 0, 1.6); g.add(m); });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 24), metal); core.rotation.x = Math.PI / 2; core.position.z = 1.2; g.add(core);
  [-6.4, -4.4, 4.4, 6.4].forEach((x) => [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 4.6), panelMat); p.position.set(x, s * 2.7, 0); g.add(p); }));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Simple enclosed room matching the real cabin's dimensions + a window opening in the -Z wall. */
export function makeCabin() {
  const g = new THREE.Group();
  const grate = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#9d8f78'; c.fillRect(0, 0, w, h); c.fillStyle = '#4d4638'; for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 6); }, [8, 8]);
  const wall = std(0x9a8d76, { roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });
  const { xMin, xMax, zMin, zMax, floorY, ceilY, window: win } = CABIN;
  const W = xMax - xMin, D = zMax - zMin, H = ceilY - floorY, cx = (xMin + xMax) / 2, cz = (zMin + zMax) / 2;
  const plane = (w, h, p, r, m = wall) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); q.position.copy(p); q.rotation.set(...r); q.receiveShadow = true; g.add(q); };
  plane(W, D, new THREE.Vector3(cx, floorY, cz), [-Math.PI / 2, 0, 0], new THREE.MeshStandardMaterial({ map: grate, roughness: 0.6, metalness: 0.5 }));
  plane(W, D, new THREE.Vector3(cx, ceilY, cz), [Math.PI / 2, 0, 0]);
  plane(D, H, new THREE.Vector3(xMin, floorY + H / 2, cz), [0, Math.PI / 2, 0]);
  plane(D, H, new THREE.Vector3(xMax, floorY + H / 2, cz), [0, -Math.PI / 2, 0]);
  plane(W, H, new THREE.Vector3(cx, floorY + H / 2, zMax), [0, Math.PI, 0]);
  const wx0 = win.c.x - win.w / 2, wx1 = win.c.x + win.w / 2, wy0 = win.c.y - win.h / 2, wy1 = win.c.y + win.h / 2;
  const box = (x0, x1, y0, y1) => plane(x1 - x0, y1 - y0, new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, zMin), [0, 0, 0]);
  box(xMin, wx0, floorY, ceilY); box(wx1, xMax, floorY, ceilY); box(wx0, wx1, floorY, wy0); box(wx0, wx1, wy1, ceilY);
  return g;
}

export function makeMonitorFrame() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(7.8, 4.9, 0.35), std(0x1a1f26, { metalness: 0.8, roughness: 0.35 }));
  frame.position.z = -0.2; g.add(frame); return g;
}

export function makeConsole() {
  const g = new THREE.Group();
  const m = std(0x8c8f98, { metalness: 0.6, roughness: 0.45 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 6), m); desk.position.y = 1.2; g.add(desk);
  [-3.6, 3.6].forEach((x) => { const s = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.6, 0.35), std(0x0d2a3a, { emissive: 0x0b6f86, emissiveIntensity: 1.2 })); s.position.set(x, 4.2, -2.2); s.rotation.x = -0.15; g.add(s); });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function makeCorridor() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xcfd6dc, side: THREE.BackSide });
  const tube = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4, 16), m); tube.position.set(-1.1, 1.2, -8.3); g.add(tube);
  for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.4) })); l.position.set(-1.1, 3.1, -1.5 - i * 2.1); g.add(l); }
  return g;
}

export function makeGpsSatellite() {
  const g = new THREE.Group();
  const goldMat = std(0xf59e0b, { roughness: 0.25, metalness: 0.88 });
  const solarMat = std(0x0f172a, { roughness: 0.15, metalness: 0.95 });
  const silverMat = std(0xe2e8f0, { roughness: 0.28, metalness: 0.85 });
  const darkMat = std(0x1e293b, { roughness: 0.45, metalness: 0.65 });

  // 1. Central Satellite Bus (Gold MLI foil box)
  const bus = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 2.4), goldMat);
  g.add(bus);

  // 2. Earth-facing Cylindrical Antenna Mast & Communications Array (+Z facing Earth)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 24), silverMat);
  mast.position.y = 2.8;
  g.add(mast);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), silverMat);
  dome.position.y = 4.1;
  g.add(dome);

  // Helical GPS L-band navigation antennas
  [-0.6, 0.6].forEach((x) => {
    [-0.6, 0.6].forEach((z) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), silverMat);
      ant.position.set(x, 4.2, z);
      g.add(ant);
    });
  });

  // 3. Dual Extended Solar Array Wings (Left & Right along X-axis)
  [-1, 1].forEach((dir) => {
    // Boom arm
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), darkMat);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(dir * 2.4, 0, 0);
    g.add(boom);

    // Main Solar Wing Panels
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.8, 0.12), solarMat);
    wing.position.set(dir * 7.8, 0, 0);
    g.add(wing);

    // Panel border frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.9, 0.08), darkMat);
    frame.position.set(dir * 7.8, 0, 0);
    g.add(frame);
  });

  // 4. Apogee Kick Motor / Thruster Nozzles (-Y)
  const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 16), darkMat);
  thruster.position.y = -2.2;
  g.add(thruster);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
