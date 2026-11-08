// =============================================================================
// HELIOS ISS CABIN CARGO SYSTEM — REALISTIC CARGO TRANSFER BAGS (CTB)
// High-fidelity procedural Cargo Transfer Bags modelled on authentic NASA ISS
// stowage racks (CTB 1.0, CTB 2.0, CTB 0.5, M-02 Wet Trash) with woven canvas
// grain, seam stitching, dual vertical webbing straps, crisp technical barcode
// labels, and horizontal black cargo restraint bungee cords.
// =============================================================================

import * as THREE from 'three';

const CTB_DEFINITIONS = [
  { code: 'CTB 1.0', sub: 'SPARE FILTERS',     serial: '04211J', bg: '#ece7dc', isYellow: false, w: 3.0, h: 2.7, d: 2.8 },
  { code: 'CTB 2.0', sub: 'EXERCISE - CEVIS',  serial: '04285J', bg: '#e8e3d8', isYellow: false, w: 3.0, h: 4.8, d: 2.8 },
  { code: 'CTB 1.0', sub: 'PAYLOAD - SAMPLES', serial: '04455J', bg: '#ece6da', isYellow: false, w: 3.0, h: 2.7, d: 2.8 },
  { code: 'M-02',    sub: 'TRASH - WET',       serial: '04398J', bg: '#ebe5d9', isYellow: true,  w: 3.0, h: 2.7, d: 2.8 },
  { code: 'CTB 0.5', sub: 'FOOD - 005',        serial: '04022J', bg: '#dcd1bf', isYellow: false, w: 3.0, h: 1.5, d: 2.8 },
  { code: 'CTB 1.0', sub: 'CREW PROVISIONS',   serial: '04189K', bg: '#9eb0bd', isYellow: false, w: 3.0, h: 2.7, d: 2.8 },
  { code: 'CTB 2.0', sub: 'ECLSS - FILTERS',   serial: '04312J', bg: '#96a8b6', isYellow: false, w: 3.0, h: 4.8, d: 2.8 },
  { code: 'CTB 1.0', sub: 'EVA - TOOLS',       serial: '04519J', bg: '#d5cbba', isYellow: false, w: 3.0, h: 2.7, d: 2.8 },
];

/** Generates an authentic high-resolution CanvasTexture for a Cargo Transfer Bag face */
function createCtbTexture(def) {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 1. Base woven fabric canvas
  ctx.fillStyle = def.bg;
  ctx.fillRect(0, 0, S, S);

  // 2. Micro canvas woven crosshatch texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.024)';
  for (let y = 0; y < S; y += 4) {
    ctx.fillRect(0, y, S, 2);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let x = 0; x < S; x += 4) {
    ctx.fillRect(x, 0, 2, S);
  }

  // 3. Pillowed border / soft edge bevel shading
  const gradL = ctx.createLinearGradient(0, 0, 42, 0);
  gradL.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  gradL.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradL; ctx.fillRect(0, 0, 42, S);

  const gradR = ctx.createLinearGradient(S, 0, S - 42, 0);
  gradR.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  gradR.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradR; ctx.fillRect(S - 42, 0, 42, S);

  const gradT = ctx.createLinearGradient(0, 0, 0, 42);
  gradT.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  gradT.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradT; ctx.fillRect(0, 0, S, 42);

  const gradB = ctx.createLinearGradient(0, S, 0, S - 42);
  gradB.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  gradB.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradB; ctx.fillRect(0, S - 42, S, 42);

  // 4. Heavy nylon perimeter seam stitching (dashed lines)
  ctx.save();
  ctx.strokeStyle = 'rgba(55, 48, 40, 0.75)';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([7, 7]);
  const r = 26, pad = 24;
  ctx.beginPath();
  ctx.moveTo(pad + r, pad);
  ctx.lineTo(S - pad - r, pad);
  ctx.arcTo(S - pad, pad, S - pad, pad + r, r);
  ctx.lineTo(S - pad, S - pad - r);
  ctx.arcTo(S - pad, S - pad, S - pad - r, S - pad, r);
  ctx.lineTo(pad + r, S - pad);
  ctx.arcTo(pad, S - pad, pad, S - pad - r, r);
  ctx.lineTo(pad, pad + r);
  ctx.arcTo(pad, pad, pad + r, pad, r);
  ctx.stroke();
  ctx.restore();

  // 5. Two vertical nylon webbing straps running down the face
  const strapWidth = 66;
  const strapX1 = 76;
  const strapX2 = S - 76 - strapWidth;
  [strapX1, strapX2].forEach((sx) => {
    // Strap base
    ctx.fillStyle = 'rgba(120, 126, 128, 0.38)';
    ctx.fillRect(sx, 0, strapWidth, S);
    // Strap border lines
    ctx.fillStyle = 'rgba(80, 85, 88, 0.55)';
    ctx.fillRect(sx, 0, 3, S);
    ctx.fillRect(sx + strapWidth - 3, 0, 3, S);
    // Horizontal weave ribbing
    ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
    for (let sy = 0; sy < S; sy += 8) {
      ctx.fillRect(sx + 3, sy, strapWidth - 6, 2);
    }
  });

  // 6. NASA Technical Barcode Label
  const lw = 236;
  const lh = 120;
  const lx = Math.round((S - lw) / 2);
  const ly = Math.round((S - lh) / 2) - 10;

  ctx.save();
  ctx.fillStyle = def.isYellow ? '#f5c518' : '#fafafa';
  ctx.fillRect(lx, ly, lw, lh);
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 3;
  ctx.strokeRect(lx, ly, lw, lh);

  // Label Title (CTB 1.0, CTB 2.0, M-02)
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 26px "Tomorrow", "JetBrains Mono", monospace';
  ctx.fillText(def.code, lx + 14, ly + 34);

  // Subtitle (SPARE FILTERS, EXERCISE - CEVIS, etc.)
  ctx.font = 'bold 13px "Tomorrow", "JetBrains Mono", monospace';
  ctx.fillStyle = '#222222';
  ctx.fillText(def.sub, lx + 14, ly + 58);

  // Barcode Stripes
  const bx = lx + 14, by = ly + 70, bh = 34;
  const bars = [3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 3, 1, 2, 4, 2, 1, 3, 2];
  let curX = bx;
  ctx.fillStyle = '#111111';
  bars.forEach((barW, idx) => {
    if (idx % 2 === 0) {
      ctx.fillRect(curX, by, barW, bh);
    }
    curX += barW + 2;
  });

  // Serial Number
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#333333';
  ctx.fillText(def.serial, lx + lw - 54, by + bh - 4);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Pre-caches all textures and creates reusable materials */
class CtbMaterialRegistry {
  constructor() {
    this.materials = CTB_DEFINITIONS.map((def) => {
      const frontTex = createCtbTexture(def);
      const sideMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(def.bg),
        roughness: 0.88,
        metalness: 0.05,
      });
      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: 0.85,
        metalness: 0.05,
      });

      // BoxGeometry material array: [+X, -X, +Y, -Y, +Z, -Z]
      // For bags on the left wall facing walkway (+X), material index 0 is front face!
      return {
        def,
        // Material array for left wall facing +X:
        leftWallMats: [frontMat, sideMat, sideMat, sideMat, sideMat, sideMat],
        // Material array for right wall facing -X:
        rightWallMats: [sideMat, frontMat, sideMat, sideMat, sideMat, sideMat],
        // Material array for facing +Z:
        frontMats: [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat],
      };
    });
    this.bungeeMat = new THREE.MeshStandardMaterial({
      color: 0x184275, // NASA blue cargo retention bungee cord
      roughness: 0.5,
      metalness: 0.2,
    });
    this.clipMat = new THREE.MeshStandardMaterial({
      color: 0x98a2ad, // Aerospace anodized aluminum
      roughness: 0.3,
      metalness: 0.85,
    });
  }

  get(index, facing = 'leftWall') {
    const item = this.materials[index % this.materials.length];
    if (facing === 'leftWall') return item.leftWallMats;
    if (facing === 'rightWall') return item.rightWallMats;
    return item.frontMats;
  }
}

let _registry = null;
function getRegistry() {
  if (!_registry) _registry = new CtbMaterialRegistry();
  return _registry;
}

/**
 * Builds the complete Cargo Transfer Bag (CTB) Rack Wall as seen in real ISS photos.
 * Installed prominently along the left wall at Stop 3 (ECLSS Cargo & Habitats).
 */
export function createCargoRackBay() {
  const g = new THREE.Group();
  const reg = getRegistry();

  // Grid layout: 8 columns along Z (from Z = 16 to Z = 38), stacked 5-6 tiers high (Y = 1.4 to 18)
  const colZ = [16.5, 19.5, 22.5, 25.5, 28.5, 31.5, 34.5, 37.5];
  const wallX = -13.6; // Sitting flush against the left wall frame

  // Heights and patterns matching authentic ISS cargo layouts
  const colConfigurations = [
    // col 0: 6 standard CTB 1.0 bags
    [0, 1, 2, 3, 4, 5],
    // col 1: mix of blue-grey and canvas bags
    [5, 0, 7, 2, 4, 0],
    // col 2: includes a tall CTB 2.0 bag
    [1, 0, 2, 4],
    // col 3: canvas and yellow M-02 trash bag
    [2, 3, 0, 7, 5],
    // col 4: standard stack
    [0, 4, 1, 0, 2],
    // col 5: mixed provisions and food
    [5, 6, 0, 2, 7],
    // col 6: includes blue-grey CTB 2.0
    [6, 0, 3, 1],
    // col 7: standard stack
    [0, 7, 2, 4, 5],
  ];

  colZ.forEach((z, colIdx) => {
    const configs = colConfigurations[colIdx % colConfigurations.length];
    let currentY = 0.5;

    configs.forEach((matIdx) => {
      const def = CTB_DEFINITIONS[matIdx % CTB_DEFINITIONS.length];
      const bagH = def.h;
      const bagW = 2.8;
      const bagD = def.w * 0.95;

      const geom = new THREE.BoxGeometry(bagW, bagH, bagD);
      const mesh = new THREE.Mesh(geom, reg.get(matIdx, 'leftWall'));
      mesh.position.set(wallX + bagW / 2, currentY + bagH / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);

      currentY += bagH + 0.12;
    });
  });

  return g;
}

/**
 * Builds realistic Cargo Transfer Bags stacked along the corridor walkway edges.
 */
export function createCorridorCargoStacks() {
  const g = new THREE.Group();
  const reg = getRegistry();

  const walkwayPositions = [
    // Left side stacks (skipping console/workstation zones)
    { x: -11.5, z: 42.0, mats: [0, 4] },
    { x: -11.5, z: 46.5, mats: [2, 0] },
    { x: -11.5, z: -18.0, mats: [5, 1] },
    { x: -11.5, z: -23.0, mats: [0, 3] },
    // Right side stacks
    { x: 11.5, z: 12.0, mats: [1, 2] },
    { x: 11.5, z: 16.0, mats: [0, 7] },
    { x: 11.5, z: 42.0, mats: [7, 0] },
    { x: 11.5, z: 46.5, mats: [3, 5] },
  ];

  walkwayPositions.forEach((pos) => {
    const isLeft = pos.x < 0;
    const facing = isLeft ? 'leftWall' : 'rightWall';
    let curY = 0.2;

    pos.mats.forEach((matIdx) => {
      const def = CTB_DEFINITIONS[matIdx];
      const bagW = 2.8;
      const bagH = def.h;
      const bagD = def.w;

      const geom = new THREE.BoxGeometry(bagW, bagH, bagD);
      const mesh = new THREE.Mesh(geom, reg.get(matIdx, facing));
      mesh.position.set(pos.x, curY + bagH / 2, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      curY += bagH + 0.08;
    });
  });

  return g;
}
