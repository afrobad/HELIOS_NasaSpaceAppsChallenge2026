import * as THREE from 'three';

/**
 * Authentic ISS Microgravity Science Glovebox (MSG)
 * Modeled after the real NASA/ESA ISPR payload rack on the International Space Station.
 * Features:
 * - Full International Standard Payload Rack (ISPR) frame with cylindrical hull chamfers
 * - Sealed Glovebox workspace chamber with angled acrylic viewing window
 * - 2 front circular glove ports with sealed gauntlet rings & 1 side glove port
 * - Overhead Command & Monitoring Unit (CMU) avionics electronics panel
 * - Lower payload equipment drawer & airlock pass-through chamber
 * - Fluid/gas quick-disconnect valve matrix & circuit breakers
 * - Extendable floor foot restraint bar with dual foot loops for zero-g anchoring
 */

function makePanelTexture(w, h, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createMicrogravityScienceGlovebox(opts = {}) {
  const group = new THREE.Group();
  group.name = 'ISS_Microgravity_Science_Glovebox_MSG';

  // Materials
  const rackBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.35 });
  const darkAlumMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.75 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
  const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.5 });
  const gloveRingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.8 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    transmission: 0.85,
    ior: 1.45,
    reflectivity: 0.8
  });

  const rw = 4.6, rh = 8.8, rd = 3.6;

  /* ------------------------------------------------------------------------
   * 1. ISPR Main Rack Chassis Frame
   * ------------------------------------------------------------------------ */
  // Left and Right outer side walls (with authentic rear bevel to match ISS hull)
  [-1, 1].forEach((side) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.18, rh, rd), rackBodyMat);
    wall.position.set(side * (rw / 2 - 0.09), rh / 2, 0);
    wall.castShadow = true;
    group.add(wall);
  });

  // Top header plate and Bottom floor plate
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.22, rd), rackBodyMat);
  topPlate.position.set(0, rh - 0.11, 0);
  const botPlate = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.22, rd), rackBodyMat);
  botPlate.position.set(0, 0.11, 0);
  group.add(topPlate, botPlate);

  // Rear back bulkhead plate
  const backPlate = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.36, rh - 0.4, 0.15), rackBodyMat);
  backPlate.position.set(0, rh / 2, -rd / 2 + 0.08);
  group.add(backPlate);

  /* ------------------------------------------------------------------------
   * 2. Sealed Glovebox Working Volume Chamber (Middle-Top)
   * ------------------------------------------------------------------------ */
  const boxW = 4.2, boxH = 3.6, boxD = 2.8;
  const boxY = 5.2;

  // Chamber enclosure body
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), darkAlumMat);
  chamber.position.set(0, boxY, 0.3);
  group.add(chamber);

  // Angled Front Viewing Window Frame
  const fwdFrame = new THREE.Mesh(new THREE.BoxGeometry(boxW - 0.3, boxH - 0.4, 0.15), windowFrameMat);
  fwdFrame.position.set(0, boxY, 0.3 + boxD / 2 + 0.08);
  group.add(fwdFrame);

  // Transparent acrylic viewing window pane
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(boxW - 0.6, boxH - 0.7), glassMat);
  winPane.position.set(0, boxY, 0.3 + boxD / 2 + 0.16);
  group.add(winPane);

  // 2 Front Circular Glove Ports with Sealed Gauntlet Rings
  const portRadius = 0.58;
  [-1.15, 1.15].forEach((px) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(portRadius, 0.08, 16, 32), gloveRingMat);
    ring.position.set(px, boxY - 0.25, 0.3 + boxD / 2 + 0.22);
    // Port Inner Seal / Gauntlet Cap
    const cap = new THREE.Mesh(new THREE.CircleGeometry(portRadius - 0.04, 24), darkAlumMat);
    cap.position.set(px, boxY - 0.25, 0.3 + boxD / 2 + 0.20);
    // Glove port handle bar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.08), steelMat);
    bar.position.set(px, boxY - 0.25, 0.3 + boxD / 2 + 0.26);
    group.add(ring, cap, bar);
  });

  // 1 Left Side Glove Port
  const sideRing = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 16, 32), gloveRingMat);
  sideRing.rotation.y = Math.PI / 2;
  sideRing.position.set(-rw / 2 + 0.05, boxY - 0.25, 0.3);
  group.add(sideRing);

  // Interior Glovebox Task Light (illuminating the science workspace)
  const taskLight = new THREE.PointLight(0xffffff, 45, 8, 1.6);
  taskLight.position.set(0, boxY + 1.2, 0.3);
  group.add(taskLight);

  /* ------------------------------------------------------------------------
   * 3. Overhead Command & Monitoring Unit (CMU) Avionics Panel
   * ------------------------------------------------------------------------ */
  const cmuTex = makePanelTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#1e293b'; g.fillRect(0, 0, w, h);
    // Status display screen
    g.fillStyle = '#020617'; g.fillRect(15, 15, 120, h - 30);
    g.fillStyle = '#22c55e'; g.font = 'bold 12px monospace';
    g.fillText('MSG: NOMINAL', 24, 38);
    g.fillText('PRES: 101.3 kPa', 24, 58);
    g.fillText('O2: 21.0 %', 24, 78);
    g.fillStyle = '#38bdf8';
    g.fillText('CHAMBER SEALED', 24, 98);

    // Circuit breakers & switch array
    g.fillStyle = '#334155';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 14; c++) {
        g.fillRect(160 + c * 24, 22 + r * 28, 16, 18);
        g.fillStyle = '#94a3b8';
        g.fillRect(165 + c * 24, 27 + r * 28, 6, 8);
        g.fillStyle = '#334155';
      }
    }
  });

  const cmuPanel = new THREE.Mesh(
    new THREE.BoxGeometry(boxW - 0.2, 1.3, 0.3),
    new THREE.MeshStandardMaterial({ map: cmuTex, roughness: 0.5, metalness: 0.3 })
  );
  cmuPanel.position.set(0, rh - 0.95, rd / 2 - 0.15);
  group.add(cmuPanel);

  /* ------------------------------------------------------------------------
   * 4. Lower Payload Utility Bays & Airlock Pass-Through
   * ------------------------------------------------------------------------ */
  const lowerTex = makePanelTexture(512, 384, (g, w, h) => {
    g.fillStyle = '#cbd5e1'; g.fillRect(0, 0, w, h);
    // Drawer seams
    g.strokeStyle = '#64748b'; g.lineWidth = 3;
    g.strokeRect(10, 10, w - 20, 100);
    g.strokeRect(10, 120, w / 2 - 20, 160);
    g.strokeRect(w / 2 + 10, 120, w / 2 - 20, 160);
    g.strokeRect(10, 290, w - 20, 80);

    // Airlock hatch on the right
    const arcX = w * 0.75, arcY = 200, ar = 50;
    g.fillStyle = '#94a3b8'; g.beginPath(); g.arc(arcX, arcY, ar, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#475569'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#e2e8f0'; g.beginPath(); g.arc(arcX, arcY, ar - 12, 0, Math.PI * 2); g.fill();

    // Valve matrix & circuit breakers
    for (let i = 0; i < 8; i++) {
      g.fillStyle = '#1e293b';
      g.fillRect(25 + i * 26, 150, 18, 18);
      g.fillStyle = '#38bdf8';
      g.beginPath(); g.arc(34 + i * 26, 159, 4, 0, Math.PI * 2); g.fill();
    }

    // Caution Label
    g.fillStyle = '#eab308'; g.fillRect(25, 315, 110, 32);
    g.fillStyle = '#000000'; g.font = 'bold 11px sans-serif';
    g.fillText('CAUTION: MSG', 32, 335);

    // MSG Model Label
    g.fillStyle = '#0f172a'; g.font = 'bold 14px sans-serif';
    g.fillText('ISS // MICROGRAVITY SCIENCE GLOVEBOX (MSG)', 25, 55);
    g.font = '11px monospace';
    g.fillText('ISPR PAYLOAD RACK // EXPEDITION 71', 25, 75);
  });

  const lowerBay = new THREE.Mesh(
    new THREE.BoxGeometry(boxW - 0.1, 3.2, 0.4),
    new THREE.MeshStandardMaterial({ map: lowerTex, roughness: 0.6, metalness: 0.25 })
  );
  lowerBay.position.set(0, 1.85, rd / 2 - 0.2);
  group.add(lowerBay);

  // Pull-out equipment handles
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.8 });
  [-1.2, 1.2].forEach((hx) => {
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.2), handleMat);
    h1.position.set(hx, 2.8, rd / 2 + 0.05);
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.2), handleMat);
    h2.position.set(hx, 1.5, rd / 2 + 0.05);
    group.add(h1, h2);
  });

  /* ------------------------------------------------------------------------
   * 5. Floor Foot Restraint Bar & Dual Foot Loops (Zero-G Anchoring)
   * ------------------------------------------------------------------------ */
  const barGroup = new THREE.Group();
  barGroup.position.set(0, 0.2, rd / 2);

  // Extendable aluminum mounting arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 2.2), steelMat);
  armL.position.set(-1.6, 0.1, 1.1);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 2.2), steelMat);
  armR.position.set(1.6, 0.1, 1.1);
  // Cross foot bar
  const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 16), steelMat);
  crossBar.rotation.z = Math.PI / 2;
  crossBar.position.set(0, 0.1, 2.2);
  barGroup.add(armL, armR, crossBar);

  // Dual foot loop pads with retention straps
  const loopMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  [-0.65, 0.65].forEach((lx) => {
    // Foot plate
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 1.1), loopMat);
    pad.position.set(lx, 0.04, 2.2);
    // Foot strap loop
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16, Math.PI), darkAlumMat);
    strap.position.set(lx, 0.18, 2.2);
    barGroup.add(pad, strap);
  });

  group.add(barGroup);

  return group;
}

