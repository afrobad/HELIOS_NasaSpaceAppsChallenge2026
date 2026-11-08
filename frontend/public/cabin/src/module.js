// BIG ISS-style module interior (axis = Z) modelled on the reference photos:
//  - clean white padded panels, rack doors with handles, fluorescent light bars, blue cable-tie lines,
//    white cargo bags with olive straps, gold-bezel portholes, cable looms, navy hatch bulkhead (+Z)
//  - at the front (-Z) a COCKPIT / CUPOLA bay: dark frustum with 4 big windows onto Earth + a console desk.
// All sizes are derived from CABIN in config.js.
import * as THREE from 'three';
import { CABIN } from './config.js';
import { createCupolaDome } from './cupola.js';
import { createCargoRackBay, createCorridorCargoStacks } from './cargo.js';

const HX = CABIN.halfX, HZ = CABIN.halfZ, L = HZ * 2, CEIL = CABIN.ceilY;
const PROFILE = CABIN.profile, BAY = CABIN.bay;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* deterministic random so the layout is identical on every load */
let R = Math.random;
const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rand = (a, b) => a + R() * (b - a);

/* ------------------------------ textures ------------------------------ */
const tex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const speck = (g, w, h, n, a, lo = 110, hi = 235) => { for (let i = 0; i < n; i++) { const v = (lo + R() * (hi - lo)) | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${a})`; g.fillRect(R() * w, R() * h, 1 + R() * 14, 1 + R() * 6); } };
const screws = (g, pts, r = 4, col = 'rgba(60,66,74,.55)') => { g.fillStyle = col; pts.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); };

function makeTextures() {
  const wall = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#dfe2e5'; g.fillRect(0, 0, w, h); speck(g, w, h, 520, 0.06);
    g.strokeStyle = 'rgba(70,78,86,.6)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(70,78,86,.26)'; g.lineWidth = 2; g.strokeRect(20, 20, w - 40, h - 40);
    g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w / 2, h - 20); g.stroke();
    screws(g, [[34, 34], [w - 34, 34], [34, h - 34], [w - 34, h - 34], [w / 2, 34], [w / 2, h - 34]]);
    g.fillStyle = 'rgba(90,96,104,.45)'; for (let i = 0; i < 7; i++) g.fillRect(70, 330 + i * 14, 120, 5);
    g.fillStyle = 'rgba(196,201,206,.95)'; g.fillRect(290, 90, 150, 52);
  });
  const floor = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#d6dadd'; g.fillRect(0, 0, w, h); speck(g, w, h, 380, 0.07);
    g.strokeStyle = '#8c949c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = 'rgba(90,98,106,.65)'; g.fillRect(w / 2 - 34, h / 2 - 7, 68, 14); // recessed foot-loop handle
    screws(g, [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]], 5);
  });
  const ceil = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#eceeef'; g.fillRect(0, 0, w, h); speck(g, w, h, 260, 0.05, 150, 240);
    g.strokeStyle = 'rgba(90,98,106,.55)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(90,98,106,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    screws(g, [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]], 3);
  });
  const navy = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#1a2440'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(160,190,255,.22)'; g.lineWidth = 2;
    for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    speck(g, w, h, 160, 0.1, 40, 120);
  });
  const bay = tex(512, 512, (g, w, h) => { // cupola frame: dark graphite with panel seams
    g.fillStyle = '#1b2230'; g.fillRect(0, 0, w, h); speck(g, w, h, 300, 0.08, 40, 110);
    g.strokeStyle = 'rgba(120,150,200,.28)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.strokeStyle = 'rgba(120,150,200,.14)'; g.strokeRect(26, 26, w - 52, h - 52);
    screws(g, [[40, 40], [w - 40, 40], [40, h - 40], [w - 40, h - 40]], 4, 'rgba(180,200,230,.35)');
  });
  return { wall, floor, ceil, navy, bay };
}

/* ------------------------------ geometry helpers ------------------------------ */
/** Quad strip along Z between two profile points (double-sided, UV in world units / tile). */
function strip(p0, p1, mat, tile = 8) {
  const g = new THREE.BufferGeometry(), len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  g.setAttribute('position', new THREE.Float32BufferAttribute([p0[0], p0[1], -HZ, p0[0], p0[1], HZ, p1[0], p1[1], HZ, p1[0], p1[1], -HZ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L / tile, 0, L / tile, len / tile, 0, len / tile], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = m.castShadow = true; return m;
}
const ellipsePts = (rx, ry, n = 40) => Array.from({ length: n }, (_, i) => new THREE.Vector2(Math.cos((i / n) * 6.2832) * rx, Math.sin((i / n) * 6.2832) * ry));
const scalePts = (p, k) => p.map((v) => v.clone().multiplyScalar(k));

/** Flat frame (bezel) around a hole. */
function bezel(pts, k, depth, mat) {
  const s = new THREE.Shape(scalePts(pts, k)); s.holes.push(new THREE.Path(pts.slice().reverse()));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }), mat); m.castShadow = true; return m;
}

/** Four-sided frame between a quad (A,B,C,D) and a smaller concentric quad (scale s). The inner quad is the open window. */
function quadFrame(A, B, C, D, s, mat) {
  const c = new THREE.Vector3().add(A).add(B).add(C).add(D).multiplyScalar(0.25);
  const inner = [A, B, C, D].map((p) => p.clone().sub(c).multiplyScalar(s).add(c));
  const P = [A, B, C, D, ...inner];
  const pos = []; P.forEach((p) => pos.push(p.x, p.y, p.z));
  const e1 = B.clone().sub(A).normalize(), e2 = D.clone().sub(A); e2.addScaledVector(e1, -e2.dot(e1)).normalize();
  const uv = []; P.forEach((p) => { const d = p.clone().sub(A); uv.push(d.dot(e1) / 8, d.dot(e2) / 8); });
  const idx = []; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; idx.push(i, j, 4 + j, i, 4 + j, 4 + i); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = m.castShadow = true; return { mesh: m, inner };
}
function solidQuad(A, B, C, D, mat) {
  const g = new THREE.BufferGeometry(); const P = [A, B, C, D], pos = []; P.forEach((p) => pos.push(p.x, p.y, p.z));
  const e1 = B.clone().sub(A).normalize(), e2 = D.clone().sub(A); e2.addScaledVector(e1, -e2.dot(e1)).normalize();
  const uv = []; P.forEach((p) => { const d = p.clone().sub(A); uv.push(d.dot(e1) / 8, d.dot(e2) / 8); });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
/** Thin box between two points (used for glowing window trims). */
function edgeBar(p, q, t, mat) {
  const d = q.clone().sub(p), len = d.length(); d.normalize();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, t, t), mat); m.scale.x = len;
  m.position.copy(p).addScaledVector(d, len / 2); m.quaternion.setFromUnitVectors(V3(1, 0, 0), d); return m;
}

/**
 * Returns { group, lights:[...] }.   opts.tex(id) -> CanvasTexture of a live dashboard (used on the cockpit desk).
 */
export function buildModule(opts = {}) {
  R = seeded(11);
  const T = makeTextures(), group = new THREE.Group();
  const mk = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0.06, side: THREE.DoubleSide, ...o });
  const wallM = mk(T.wall), ceilM = mk(T.ceil), floorM = mk(T.floor, { roughness: 0.6, metalness: 0.2 }), navyM = mk(T.navy), bayM = mk(T.bay, { roughness: 0.5, metalness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb48a3c, roughness: 0.35, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.4, metalness: 0.85 });
  const blueTape = new THREE.MeshStandardMaterial({ color: 0x1f4fe0, roughness: 0.55, metalness: 0.05, emissive: 0x0b2a9a, emissiveIntensity: 0.55 });

  /* ---------- shell: floor, chamfers, ceiling (with an overhead dome window) ---------- */
  const floor = strip(PROFILE[0], PROFILE[1], floorM, 8); group.add(floor);
  group.add(strip(PROFILE[1], PROFILE[2], wallM), strip(PROFILE[7], PROFILE[0], wallM));
  group.add(strip(PROFILE[3], PROFILE[4], wallM), strip(PROFILE[5], PROFILE[6], wallM));
  const cx = PROFILE[4][0];
  { // ceiling with a round window at z = 14
    const s = new THREE.Shape([new THREE.Vector2(-cx, -HZ), new THREE.Vector2(cx, -HZ), new THREE.Vector2(cx, HZ), new THREE.Vector2(-cx, HZ)]);
    s.holes.push(new THREE.Path(ellipsePts(4.6, 4.6, 32).map((v) => new THREE.Vector2(v.x, v.y + 14)).reverse()));
    const g = new THREE.ShapeGeometry(s, 24), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getY(i); p.setXYZ(i, x, CEIL, z); g.attributes.uv.setXY(i, x / 10, z / 10); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, ceilM); m.receiveShadow = true; group.add(m);
    const ring = bezel(ellipsePts(4.6, 4.6, 32), 1.16, 0.6, gold); ring.rotation.x = Math.PI / 2; ring.position.set(0, CEIL + 0.3, 14); group.add(ring);
  }

  /* ---------- side walls with portholes (real holes: you see space) ---------- */
  const y0 = PROFILE[2][1], y1 = PROFILE[3][1], yc = (y0 + y1) / 2;
  const portholes = { 1: [26, 2, -26], '-1': [44, 8, -8, -22, -36] };
  [1, -1].forEach((side) => {
    const s = new THREE.Shape([new THREE.Vector2(-HZ, y0), new THREE.Vector2(HZ, y0), new THREE.Vector2(HZ, y1), new THREE.Vector2(-HZ, y1)]);
    const pts = ellipsePts(2.7, 3.7, 36);
    portholes[side].forEach((z) => s.holes.push(new THREE.Path(pts.map((v) => new THREE.Vector2(v.x + z, v.y + yc)).reverse())));
    const g = new THREE.ShapeGeometry(s, 24), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getX(i), y = p.getY(i); p.setXYZ(i, side * HX, y, z); g.attributes.uv.setXY(i, z / 8, y / 8); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, wallM); m.receiveShadow = m.castShadow = true; group.add(m);
    portholes[side].forEach((z) => { const b = bezel(pts, 1.17, 0.6, gold); b.rotation.y = -side * Math.PI / 2; b.position.set(side * HX, yc, z); group.add(b); });
  });

  /* ---------- aft bulkhead (+Z): navy hatch wall ---------- */
  const octShape = () => new THREE.Shape(PROFILE.map(([x, y]) => new THREE.Vector2(x, y)));
  {
    const g = new THREE.ShapeGeometry(octShape(), 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x, y, HZ); g.attributes.uv.setXY(i, x / 8, y / 8); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, navyM); m.receiveShadow = true; group.add(m);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.8, 48), new THREE.MeshStandardMaterial({ color: 0x2b3350, roughness: 0.5, metalness: 0.8 }));
    hatch.rotation.x = Math.PI / 2; hatch.position.set(0, 12, HZ - 0.45); group.add(hatch);
    const hr = new THREE.Mesh(new THREE.TorusGeometry(5.75, 0.26, 12, 56), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.5, 1.7), toneMapped: false })); hr.position.set(0, 12, HZ - 0.85); group.add(hr);
    const win = new THREE.Mesh(new THREE.CircleGeometry(2, 28), new THREE.MeshBasicMaterial({ color: 0x0a1020 })); win.position.set(0, 12, HZ - 0.9); win.rotation.y = Math.PI; group.add(win);
    const winR = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.18, 10, 32), gold); winR.position.set(0, 12, HZ - 0.9); group.add(winR);
  }

  /* ---------- authentic ISS 7-Window Cupola Observation Dome ---------- */
  const cupola = createCupolaDome();
  group.add(cupola);

  /* ---------- forward bulkhead (-Z): authentic Node 3 / Cupola portal ---------- */
  const z0 = -HZ;
  {
    const s = octShape();
    // Portal opening into the Cupola dome (radius 12.0 centered at Y = 13.5)
    s.holes.push(new THREE.Path(ellipsePts(12.0, 11.2, 48).map((v) => new THREE.Vector2(v.x, v.y + 13.5)).reverse()));
    const g = new THREE.ShapeGeometry(s, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x, y, z0); g.attributes.uv.setXY(i, x / 8, y / 8); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, navyM); m.receiveShadow = m.castShadow = true; group.add(m);

    // Heavy aerospace portal frame bezel ring
    const portalBezel = bezel(ellipsePts(12.0, 11.2, 48), 1.12, 0.45, new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.4 }));
    portalBezel.position.set(0, 13.5, z0 + 0.1);
    group.add(portalBezel);
  }

  /* ---------- wall racks (instanced bodies + doors + handles + details) ---------- */
  const skip = {
    1: [[38, 8.8], [14, 8.8], [-10, 8.8], [26, 4.6], [2, 4.6], [-26, 4.6]],
    '-1': [[24, 6.6], [44, 4.6], [8, 4.6], [-8, 4.6], [-22, 4.6], [-36, 4.6]],
  };
  const bays = [];
  [1, -1].forEach((side) => { for (let z = -50; z <= 52; z += 4.8) { if (skip[side].some(([c, h]) => Math.abs(z - c) < h)) continue; bays.push({ side, z }); } });
  const rackH = y1 - y0, rackY = yc;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color();
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.1 }), bays.length);
  const bodyCols = [0xe4e7ea, 0xd8dce0, 0xeceef0, 0xcdd2d7];
  bays.forEach((b, i) => { S.set(1.9, rackH - 0.2, 4.6); P.set(b.side * (HX - 0.95), rackY, b.z); M.compose(P, Q.identity(), S); body.setMatrixAt(i, M); body.setColorAt(i, C.setHex(bodyCols[i % 4])); });
  body.castShadow = body.receiveShadow = true; group.add(body);

  const doors = [], handles = [], det = [], glows = [], vstraps = [];
  bays.forEach((b, bi) => {
    const fx = b.side * (HX - 1.93);
    for (let r = 0; r < 4; r++) {
      const dy = y0 + 3.4 + r * 5.5;
      doors.push({ x: fx, y: dy, z: b.z, w: 3.9, h: 4.8 });
      handles.push({ x: fx - b.side * 0.1, y: dy + 0.4, z: b.z + 1.3, w: 0.28, h: 1.5 });
    }
    for (let k = 0; k < 7; k++) {
      const w = rand(0.4, 1.3), h = rand(0.3, 1.1), y = y0 + 1.5 + R() * (rackH - 3), z = b.z + rand(-1.5, 1.5);
      (R() < 0.25 ? glows : det).push({ x: fx - b.side * 0.07, y, z, w, h });
    }
    if (bi % 2 === 0) vstraps.push({ x: fx - b.side * 0.1, z: b.z - 2.35 });
  });
  const mkInst = (list, mat, colors, thick = 0.14) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, Math.max(1, list.length));
    list.forEach((d, i) => { S.set(thick, d.h, d.w); P.set(d.x, d.y, d.z); M.compose(P, Q.identity(), S); im.setMatrixAt(i, M); im.setColorAt(i, C.setHex(colors[(R() * colors.length) | 0])); });
    im.count = list.length; return im;
  };
  group.add(mkInst(doors, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.25 }), [0xf1f3f5, 0xe6e9ec, 0xdfe3e7, 0xf6f7f8], 0.1));
  group.add(mkInst(handles, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.7 }), [0x2a2e33, 0x3a4047], 0.2));
  group.add(mkInst(det, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.5 }), [0x15171a, 0x24272b, 0x8a9096, 0xd4a017, 0x2a4a7a, 0xb33a2a, 0xe8e8e8]));
  group.add(mkInst(glows, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), [0x35e8ff, 0xffb347, 0x6dffb0, 0x35e8ff]));
  { // vertical blue cable-tie lines on the racks
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blueTape, Math.max(1, vstraps.length));
    vstraps.forEach((d, i) => { S.set(0.16, rackH - 1, 0.2); P.set(d.x, rackY, d.z); M.compose(P, Q.identity(), S); im.setMatrixAt(i, M); }); im.count = vstraps.length; group.add(im);
  }

  /* ---------- mounting plates behind the wall monitors ---------- */
  group.userData.plate = (z, width = 13) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, width * 0.82, width * 1.2), new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.55, metalness: 0.7 })); p.position.set(HX - 0.25, 13, z); return p; };

  /* ---------- ceiling: fluorescent light bars, steel cross rails, blue tie lines ---------- */
  const tubeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.25), toneMapped: false });
  const tubes = [], houses = [];
  [-11.2, 11.2].forEach((x) => { for (let z = -49; z <= 49; z += 14) { tubes.push({ x, y: CEIL - 0.45, z, len: 10 }); houses.push({ x, y: CEIL - 0.25, z, len: 10.6 }); } });
  const tubeIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tubeM, tubes.length);
  tubes.forEach((d, i) => { S.set(0.7, 0.25, d.len); P.set(d.x, d.y, d.z); M.compose(P, Q.identity(), S); tubeIM.setMatrixAt(i, M); }); group.add(tubeIM);
  const houseIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.5, metalness: 0.7 }), houses.length);
  houses.forEach((d, i) => { S.set(1.5, 0.3, d.len); P.set(d.x, d.y, d.z); M.compose(P, Q.identity(), S); houseIM.setMatrixAt(i, M); }); group.add(houseIM);
  for (let z = -48; z <= 48; z += 12) { const rail = new THREE.Mesh(new THREE.BoxGeometry(cx * 2 - 4, 0.45, 0.6), steel); rail.position.set(0, CEIL - 0.3, z); rail.castShadow = true; group.add(rail); }
  [-3.5, 3.5].forEach((x) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, L - 8), blueTape); t.position.set(x, CEIL - 0.06, 0); group.add(t); });

  /* ---------- floor: blue guide lines + yellow edge strips ---------- */
  [-6.5, 6.5].forEach((x) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, L - 4), blueTape); t.position.set(x, 0.05, 0); group.add(t); });
  for (let z = -44; z <= 44; z += 11) { const t = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 0.3), blueTape); t.position.set(0, 0.05, z); group.add(t); }
  [-1, 1].forEach((sd) => { const hz = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, L - 1), new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.6 })); hz.position.set(sd * 11.7, 0.04, 0); group.add(hz); });

  /* ---------- authentic NASA Cargo Transfer Bags (CTBs) & stowage rack bay ---------- */
  group.add(createCargoRackBay());
  group.add(createCorridorCargoStacks());

  /* ---------- cable looms along ceiling / upper walls (orange hoses like the photo) ---------- */
  const cabM = [0x15161a, 0x15161a, 0xc8601a, 0x6d7278, 0x111111].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2 }));
  for (let i = 0; i < 16; i++) {
    const sd = R() < 0.5 ? -1 : 1, baseX = sd * rand(4, 12.2), baseY = rand(23.5, 27), pts = [];
    for (let k = 0; k <= 9; k++) pts.push(new THREE.Vector3(baseX + Math.sin(k * 1.3 + i) * 0.8, baseY - Math.abs(Math.sin(k * 0.8 + i)) * rand(0.4, 1.8), -HZ + 4 + (k / 9) * (L - 8)));
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, rand(0.1, 0.24), 6), cabM[i % 5]); t.castShadow = true; group.add(t);
  }

  /* ---------- handrails ---------- */
  [-1, 1].forEach((sd) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, L - 6, 8), steel); rail.rotation.x = Math.PI / 2; rail.position.set(sd * 12.3, 6.6, 0); group.add(rail);
    for (let z = -48; z <= 48; z += 8) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), steel); b.rotation.z = Math.PI / 2; b.position.set(sd * 12.75, 6.6, z); group.add(b); }
  });

  /* ---------- cockpit: glow strips along the floor beside the consoles ---------- */
  const cyanM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.6, 1.8), toneMapped: false });
  [-1, 1].forEach((sd) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 26), cyanM); b.position.set(sd * 12.4, 0.14, -43); group.add(b); });

  /* ---------- point lights (kept few: forward renderer) ---------- */
  const lights = [];
  [40, 22, 4, -14, -30].forEach((z) => { const l = new THREE.PointLight(0xfff0dc, 120, 52, 1.5); l.position.set(0, CEIL - 3, z); lights.push(l); });
  const cock = new THREE.PointLight(0x7fdcff, 110, 48, 1.6); cock.position.set(0, 14, -66); lights.push(cock);
  return { group, lights };
}
