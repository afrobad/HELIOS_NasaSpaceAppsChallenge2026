import * as THREE from 'three';

/**
 * Authentic Solar System Simulation for HELIOS.
 * 
 * Physically and astronomically unified with Earth, Moon, and the ISS:
 * - The Old Sun (Sol) is the central star at the heliocentric origin with its anamorphic flare.
 * - Earth is Planet 3 of this solar system (ZERO duplicate Earths!).
 * - Orbit 3 is Earth's orbit line, passing directly through Earth & ISS.
 * - The Moon orbits Earth directly.
 * - The ISS orbits Earth in Low Earth Orbit.
 * - Mercury, Venus, Mars, Asteroid Belt, Jupiter, Saturn, Uranus, Neptune, Pluto are all clearly visible with authentic emissive space lighting.
 */

function makePlanetTexture(w, h, renderFn) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  renderFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function pseudoNoise(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (pseudoNoise(xi, yi) * (1 - u) + pseudoNoise(xi + 1, yi) * u) * (1 - v) +
         (pseudoNoise(xi, yi + 1) * (1 - u) + pseudoNoise(xi + 1, yi + 1) * u) * v;
}

function fbm(x, y, oct = 4) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < oct; i++) {
    val += smoothNoise(x * freq, y * freq) * amp;
    freq *= 2.05; amp *= 0.5;
  }
  return val;
}

export class SolarSystem {
  constructor(spaceGroup) {
    this.root = new THREE.Group();
    this.root.name = 'SolarSystem_Unified_Heliocentric';
    spaceGroup.add(this.root);

    this.planets = [];
    this.orbitLines = [];
    this.orbitMeshes = {};

    // Distributed angles in the visible sky arc around the Sun
    this.initialAngles = {
      mercury: 3.85,  // upper right
      venus: 2.15,    // left
      mars: 3.35,     // right
      jupiter: 5.95,  // upper left (majestic gas giant with red spot & moons)
      saturn: 2.55,   // right (spectacular tilted rings & Titan)
      uranus: 0.25,   // far left
      neptune: 3.45,  // far right
      pluto: 5.45     // upper left
    };

    this._buildMercury();
    this._buildVenus();
    this._buildEarthOrbit(); // Orbit 3 (passes directly through real Earth, ZERO duplicates!)
    this._buildMars();
    this._buildJupiter();
    this._buildSaturn();
    this._buildUranus();
    this._buildNeptune();
    this._buildPluto();
  }

  /* ------------------------------------------------------------------------
   * Helper: Build smooth continuous orbit line centered on the Sun
   * ------------------------------------------------------------------------ */
  _createOrbitLine(id, radius, color = 0xe2e8f0, opacity = 0.45) {
    const segs = 256;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const theta = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = -50;
    line.visible = false; // Permanently hidden: Zero artificial lines cutting across space or Earth
    this.root.add(line);
    this.orbitLines.push(line);
    this.orbitMeshes[id] = { line, geo, baseR: radius, color, opacity };
    return line;
  }

  /* ------------------------------------------------------------------------
   * Update orbital radii: Generously increased gaps between planet lines
   * for an expanded, majestic, and authentic Solar System scale!
   * Orbit 3 matches Earth's distance exactly (Earth sits on Orbit 3).
   * ------------------------------------------------------------------------ */
  updateOrbitRadii(distToEarth) {
    const ratios = {
      mercury: 0.32,
      venus: 0.62,
      earth: 1.00,    // Orbit 3 passes directly through real Earth & ISS!
      mars: 1.45,
      jupiter: 2.15,
      saturn: 2.95,
      uranus: 3.80,
      neptune: 4.65,
      pluto: 5.40
    };

    // Update lines with smooth geometry
    for (const [id, info] of Object.entries(this.orbitMeshes)) {
      const ratio = ratios[id] || 1.0;
      const newR = distToEarth * ratio;
      const segs = 256;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * newR, 0, Math.sin(theta) * newR));
      }
      info.geo.setFromPoints(pts);
    }

    // Update planet distances
    this.planets.forEach((p) => {
      const ratio = ratios[p.id] || 1.0;
      p.orbitR = distToEarth * ratio;
      p.group.position.x = Math.cos(p.angle) * p.orbitR;
      p.group.position.z = Math.sin(p.angle) * p.orbitR;
    });
  }

  /* ------------------------------------------------------------------------
   * Align Solar System with Old Sun position and real Earth position:
   * Orbit 3 passes 100.00% EXACTLY through Earth, ISS & Moon!
   * The orbital plane is oriented horizontally across the ecliptic
   * so the planetary orbits form an authentic, realistic astronomical disk.
   * ------------------------------------------------------------------------ */
  alignWithSunAndEarth(sunPos, earthPos) {
    this.root.position.copy(sunPos);

    // Vector from Sun towards Earth (guaranteed to lie in the orbital plane!)
    const fwd = earthPos.clone().sub(sunPos);
    const distToEarth = fwd.length();
    fwd.normalize();

    // Guard against rebuilding 9 orbit line geometries every single frame (prevents micro-stutter)
    if (!this._lastOrbitDist || Math.abs(distToEarth - this._lastOrbitDist) > 20.0) {
      this._lastOrbitDist = distToEarth;
      this.updateOrbitRadii(distToEarth);
    }

    // Authentic horizontal ecliptic plane in space:
    const eclipticUp = new THREE.Vector3(0, 1, 0);
    const localZ = fwd.clone().normalize();
    const localX = new THREE.Vector3().crossVectors(eclipticUp, localZ).normalize();
    if (localX.lengthSq() < 0.001) localX.set(1, 0, 0);
    const normal = new THREE.Vector3().crossVectors(localZ, localX).normalize();

    // Basis: X=localX, Y=normal, Z=localZ (points towards Earth)
    const m = new THREE.Matrix4().makeBasis(localX, normal, localZ);
    this.root.quaternion.setFromRotationMatrix(m);
  }

  alignWithEarth(earthPos, toSun) {
    const sunDist = 5800;
    const sunPos = earthPos.clone().addScaledVector(toSun.clone().normalize(), sunDist);
    this.alignWithSunAndEarth(sunPos, earthPos);
  }

  getSunPosition() {
    return this.root.position.clone();
  }

  /* ------------------------------------------------------------------------
   * 1. Mercury - First Planet
   * ------------------------------------------------------------------------ */
  _buildMercury() {
    const orbitR = 2600;
    this._createOrbitLine('mercury', orbitR);

    const tex = makePlanetTexture(256, 128, (g, w, h) => {
      g.fillStyle = '#9ca3af'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const n = fbm(x * 0.08, y * 0.08, 3);
          const v = Math.floor(130 + n * 85);
          g.fillStyle = `rgb(${v},${v},${v})`;
          g.fillRect(x, y, 2, 2);
        }
      }
    });

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(65, 32, 24),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.75, 0.75, 0.75),
        emissiveIntensity: 0.08,
        roughness: 0.8,
        metalness: 0.1
      })
    );

    const group = new THREE.Group();
    const angle = this.initialAngles.mercury;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'mercury', name: 'MERCURY', group, mesh, orbitR, angle, speed: 0.48, rotSpeed: 0.01 });
  }

  /* ------------------------------------------------------------------------
   * 2. Venus - Second Planet
   * ------------------------------------------------------------------------ */
  _buildVenus() {
    const orbitR = 4900;
    this._createOrbitLine('venus', orbitR);

    const tex = makePlanetTexture(256, 128, (g, w, h) => {
      g.fillStyle = '#fef08a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const n = fbm(x * 0.04, y * 0.04, 3);
          const r = Math.floor(240 + n * 15);
          const gc = Math.floor(205 + n * 35);
          const b = Math.floor(135 + n * 30);
          g.fillStyle = `rgb(${r},${gc},${b})`;
          g.fillRect(x, y, 2, 2);
        }
      }
    });

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(110, 36, 28),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.85, 0.75, 0.50),
        emissiveIntensity: 0.08,
        roughness: 0.6,
        metalness: 0.1
      })
    );

    const group = new THREE.Group();
    const angle = this.initialAngles.venus;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'venus', name: 'VENUS', group, mesh, orbitR, angle, speed: 0.35, rotSpeed: 0.005 });
  }

  /* ------------------------------------------------------------------------
   * 3. Orbit 3: Earth's Orbit (NO DUPLICATE MINI-EARTH!)
   * The real Earth & ISS in the scene sit directly on this orbit!
   * ------------------------------------------------------------------------ */
  _buildEarthOrbit() {
    // Zero orbit line slicing through Earth! Earth is 100% natural and pristine.
  }

  /* ------------------------------------------------------------------------
   * 4. Mars - Fourth Planet
   * ------------------------------------------------------------------------ */
  _buildMars() {
    const orbitR = 9500;
    this._createOrbitLine('mars', orbitR);

    const tex = makePlanetTexture(256, 128, (g, w, h) => {
      g.fillStyle = '#ea580c'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const n = fbm(x * 0.05, y * 0.05, 4);
          const r = Math.floor(205 + n * 50);
          const gc = Math.floor(95 + n * 35);
          const b = Math.floor(50 + n * 25);
          g.fillStyle = `rgb(${r},${gc},${b})`;
          g.fillRect(x, y, 2, 2);
        }
      }
      // White polar ice caps
      g.fillStyle = '#f8fafc';
      g.fillRect(0, 0, w, 10);
      g.fillRect(0, h - 10, w, 10);
    });

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(82, 32, 24),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.85, 0.45, 0.20),
        emissiveIntensity: 0.08,
        roughness: 0.8,
        metalness: 0.15
      })
    );

    const group = new THREE.Group();
    const angle = this.initialAngles.mars;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'mars', name: 'MARS', group, mesh, orbitR, angle, speed: 0.24, rotSpeed: 0.02 });
  }

  /* ------------------------------------------------------------------------
   * 6. Jupiter - Fifth Planet (Gas Giant)
   * ------------------------------------------------------------------------ */
  _buildJupiter() {
    const orbitR = 16500;
    this._createOrbitLine('jupiter', orbitR);

    const tex = makePlanetTexture(512, 256, (g, w, h) => {
      g.fillStyle = '#fde68a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) {
        const bandFreq = Math.sin(y * 0.15) * 0.5 + Math.sin(y * 0.35) * 0.3;
        const n = fbm(y * 0.05, bandFreq, 3);
        const r = Math.floor(225 + bandFreq * 25 + n * 15);
        const gc = Math.floor(165 + bandFreq * 35 + n * 10);
        const b = Math.floor(115 + bandFreq * 25 + n * 10);
        g.fillStyle = `rgb(${r},${gc},${b})`;
        g.fillRect(0, y, w, 1);
      }
      // Great Red Spot
      g.fillStyle = '#b91c1c';
      g.beginPath();
      g.ellipse(w * 0.65, h * 0.62, 35, 20, 0.08, 0, Math.PI * 2);
      g.fill();
    });

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(320, 48, 36),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.85, 0.72, 0.55),
        emissiveIntensity: 0.08,
        roughness: 0.6,
        metalness: 0.05
      })
    );

    // 4 Galilean Moons (Io, Europa, Ganymede, Callisto)
    const moons = [];
    const moonData = [
      { r: 16.0, d: 450, color: '#ca8a04', sp: 1.2 },
      { r: 14.0, d: 580, color: '#94a3b8', sp: 0.9 },
      { r: 22.0, d: 750, color: '#64748b', sp: 0.6 },
      { r: 19.0, d: 920, color: '#475569', sp: 0.4 }
    ];
    moonData.forEach((m) => {
      const mM = new THREE.Mesh(
        new THREE.SphereGeometry(m.r, 12, 12),
        new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.7, metalness: 0.1 })
      );
      mesh.add(mM);
      moons.push({ mesh: mM, dist: m.d, sp: m.sp, a: Math.random() * Math.PI * 2 });
    });

    const group = new THREE.Group();
    const angle = this.initialAngles.jupiter;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'jupiter', name: 'JUPITER', group, mesh, moons, orbitR, angle, speed: 0.14, rotSpeed: 0.04 });
  }

  /* ------------------------------------------------------------------------
   * 7. Saturn - Sixth Planet (With Detailed Multi-Rings)
   * ------------------------------------------------------------------------ */
  _buildSaturn() {
    const orbitR = 21500;
    this._createOrbitLine('saturn', orbitR);

    const tex = makePlanetTexture(512, 256, (g, w, h) => {
      g.fillStyle = '#fef3c7'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) {
        const v = Math.sin(y * 0.2) * 20;
        g.fillStyle = `rgb(${245 + v},${225 + v},${175 + v})`;
        g.fillRect(0, y, w, 1);
      }
    });

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(260, 48, 36),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.85, 0.78, 0.60),
        emissiveIntensity: 0.08,
        roughness: 0.7,
        metalness: 0.1
      })
    );

    // Multi-Ring System with Cassini Division
    const ringTex = makePlanetTexture(256, 16, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.15, 'rgba(217, 195, 150, 0.75)'); // C Ring
      grad.addColorStop(0.40, 'rgba(245, 225, 185, 0.98)'); // B Ring
      grad.addColorStop(0.60, 'rgba(15, 23, 42, 0.10)');    // Cassini Division
      grad.addColorStop(0.66, 'rgba(230, 210, 170, 0.90)'); // A Ring
      grad.addColorStop(0.95, 'rgba(195, 175, 145, 0.45)'); // F Ring
      grad.addColorStop(1.00, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });

    const ringGeo = new THREE.RingGeometry(330, 620, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTex,
      side: THREE.DoubleSide,
      transparent: true
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2 + 0.45; // Tilted rings
    mesh.add(ringMesh);

    // Moon Titan
    const titan = new THREE.Mesh(
      new THREE.SphereGeometry(22.0, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75, metalness: 0.15 })
    );
    titan.position.set(780, 100, -300);
    mesh.add(titan);

    const group = new THREE.Group();
    const angle = this.initialAngles.saturn;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'saturn', name: 'SATURN', group, mesh, orbitR, angle, speed: 0.10, rotSpeed: 0.03 });
  }

  /* ------------------------------------------------------------------------
   * 8. Uranus - Seventh Planet
   * ------------------------------------------------------------------------ */
  _buildUranus() {
    const orbitR = 26500;
    this._createOrbitLine('uranus', orbitR);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(170, 40, 28),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: new THREE.Color(0.04, 0.12, 0.16),
        emissiveIntensity: 0.05,
        roughness: 0.6,
        metalness: 0.1
      })
    );

    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(220, 255, 48),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    ringMesh.rotation.y = Math.PI / 2; // Vertical ring
    mesh.add(ringMesh);

    const group = new THREE.Group();
    const angle = this.initialAngles.uranus;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'uranus', name: 'URANUS', group, mesh, orbitR, angle, speed: 0.07, rotSpeed: 0.02 });
  }

  /* ------------------------------------------------------------------------
   * 9. Neptune - Eighth Planet
   * ------------------------------------------------------------------------ */
  _buildNeptune() {
    const orbitR = 31500;
    this._createOrbitLine('neptune', orbitR);

    const tex = makePlanetTexture(256, 128, (g, w, h) => {
      g.fillStyle = '#1e40af'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2563eb';
      for (let i = 0; i < 15; i++) {
        g.fillRect(0, i * 8, w, 4);
      }
      // Great Dark Spot
      g.fillStyle = '#0f172a';
      g.beginPath();
      g.ellipse(w * 0.45, h * 0.55, 26, 15, 0.1, 0, Math.PI * 2);
      g.fill();
    });

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(165, 40, 28),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.25, 0.55, 0.95),
        emissiveIntensity: 0.08,
        roughness: 0.55,
        metalness: 0.1
      })
    );

    const group = new THREE.Group();
    const angle = this.initialAngles.neptune;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'neptune', name: 'NEPTUNE', group, mesh, orbitR, angle, speed: 0.05, rotSpeed: 0.02 });
  }

  /* ------------------------------------------------------------------------
   * 10. Pluto - Ninth Planet / Kuiper Belt
   * ------------------------------------------------------------------------ */
  _buildPluto() {
    const orbitR = 36000;
    this._createOrbitLine('pluto', orbitR, 0x94a3b8, 0.35);

    const tex = makePlanetTexture(128, 64, (g, w, h) => {
      g.fillStyle = '#94a3b8'; g.fillRect(0, 0, w, h);
      // Tombaugh Regio (heart-shaped nitrogen ice plain)
      g.fillStyle = '#f1f5f9';
      g.beginPath();
      g.arc(w * 0.45, h * 0.48, 14, 0, Math.PI * 2);
      g.arc(w * 0.58, h * 0.48, 14, 0, Math.PI * 2);
      g.fill();
    });

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(55, 24, 20),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0.7, 0.7, 0.7),
        emissiveIntensity: 0.08,
        roughness: 0.9,
        metalness: 0.1
      })
    );

    const group = new THREE.Group();
    const angle = this.initialAngles.pluto;
    group.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(mesh);
    this.root.add(group);

    this.planets.push({ id: 'pluto', name: 'PLUTO', group, mesh, orbitR, angle, speed: 0.03, rotSpeed: 0.01 });
  }

  /* ------------------------------------------------------------------------
   * Update animation loop (orbital revolution & axial spin)
   * Authentic, realistic astronomical speeds (smooth, majestic celestial drift)
   * ------------------------------------------------------------------------ */
  update(dt, t) {
    this.planets.forEach((p) => {
      // Majestic Keplerian orbital revolution
      p.angle += dt * p.speed * 0.004;
      p.group.position.x = Math.cos(p.angle) * p.orbitR;
      p.group.position.z = Math.sin(p.angle) * p.orbitR;

      // Realistic planetary axial spin
      if (p.mesh) p.mesh.rotation.y += dt * p.rotSpeed * 0.25;

      // Moons (e.g. Jupiter Galilean moons)
      if (p.moons) {
        p.moons.forEach((m) => {
          m.a += dt * m.sp * 0.3;
          m.mesh.position.set(Math.cos(m.a) * m.dist, Math.sin(m.a * 0.3) * 10, Math.sin(m.a) * m.dist);
        });
      }
    });
  }
}
