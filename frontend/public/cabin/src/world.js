import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CABIN, SUN, WORLD, MONITORS, CONSOLES } from './config.js';
import { normalize, glowTexture, sparkTexture, streakTexture, shaftTexture, sunStarburstTexture, rand } from './util.js';
import { makeEarth, makeStation, makeMonitorFrame, makeConsole, makeCorridor, makeGpsSatellite } from './procedural.js';
import { buildModule } from './module.js';
import { SolarSystem } from './solarsystem.js';
import { createRoboticWorkstation } from './rws.js';
import { createMicrogravityScienceGlovebox } from './msg.js';

// Pre-allocated reusable vectors and matrices for zero-GC 60fps orbit calculations
const _vEarthNadir = new THREE.Vector3();
const _vEarthFwd = new THREE.Vector3();
const _rL = new THREE.Vector3();
const _northL = new THREE.Vector3();
const _eastL = new THREE.Vector3();
const _trackDirL = new THREE.Vector3();
const _sideL = new THREE.Vector3();
const _fwdProjW = new THREE.Vector3();
const _sideW = new THREE.Vector3();
const _mLocal = new THREE.Matrix4();
const _mWorld = new THREE.Matrix4();
const _mRot = new THREE.Matrix4();
const _mLocalTransposed = new THREE.Matrix4();
const _sunDir = new THREE.Vector3();
const _sunPos = new THREE.Vector3();
const _cupolaPos = new THREE.Vector3(0, 13.5, -56.5);
const _issPosTmp = new THREE.Vector3();

/**
 * Authentic 2K Procedural Texture of the Moon (Luna).
 * Photorealistic lunar surface featuring:
 * - Pale silvery-grey anorthositic highlands
 * - Dark volcanic basalt maria (Mare Tranquillitatis, Serenitatis, Imbrium, Oceanus Procellarum, Crisium)
 * - Major rayed impact craters (Tycho, Copernicus, Kepler, Aristarchus) with radiant ejecta blankets
 * - Hundreds of micro-craters with realistic rim shadows and central peaks.
 */
function makeMoonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Base lunar highlands silvery-grey gradient
  const bg = ctx.createLinearGradient(0, 0, 0, 1024);
  bg.addColorStop(0.0, '#b8c0cc');
  bg.addColorStop(0.5, '#a3abb8');
  bg.addColorStop(1.0, '#b8c0cc');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 2048, 1024);

  // Surface micro-cratering and fine regolith noise
  for (let y = 0; y < 1024; y += 4) {
    for (let x = 0; x < 2048; x += 4) {
      const n1 = Math.sin(x * 0.035) * Math.cos(y * 0.035);
      const n2 = Math.sin(x * 0.08 + y * 0.06) * 0.5;
      const n3 = Math.sin(x * 0.22 - y * 0.18) * 0.25;
      const v = Math.floor(155 + (n1 + n2 + n3) * 32 + (Math.random() - 0.5) * 22);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  // Authentic Lunar Maria (dark basaltic volcanic plains)
  const maria = [
    // Oceanus Procellarum (Ocean of Storms - largest dark plain)
    { x: 520, y: 480, rx: 250, ry: 200, rot: 0.1, color: 'rgba(45, 52, 64, 0.78)' },
    // Mare Imbrium (Sea of Rains)
    { x: 740, y: 360, rx: 170, ry: 130, rot: -0.1, color: 'rgba(40, 48, 60, 0.82)' },
    // Mare Serenitatis (Sea of Serenity)
    { x: 1020, y: 410, rx: 130, ry: 105, rot: 0.15, color: 'rgba(44, 52, 65, 0.80)' },
    // Mare Tranquillitatis (Sea of Tranquility - Apollo 11 landing site)
    { x: 1140, y: 520, rx: 140, ry: 110, rot: 0.05, color: 'rgba(42, 50, 62, 0.84)' },
    // Mare Crisium (Sea of Crises - distinct isolated circular mare)
    { x: 1360, y: 440, rx: 90, ry: 75, rot: -0.1, color: 'rgba(38, 45, 58, 0.86)' },
    // Mare Fecunditatis
    { x: 1260, y: 640, rx: 110, ry: 85, rot: 0.2, color: 'rgba(48, 56, 68, 0.75)' },
    // Mare Nectaris
    { x: 1120, y: 660, rx: 75, ry: 60, rot: 0.1, color: 'rgba(45, 54, 66, 0.78)' },
    // Mare Nubium
    { x: 680, y: 660, rx: 120, ry: 95, rot: -0.15, color: 'rgba(46, 55, 68, 0.76)' },
    // Mare Humorum
    { x: 520, y: 680, rx: 70, ry: 60, rot: 0.0, color: 'rgba(42, 50, 62, 0.78)' }
  ];

  maria.forEach((m) => {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, m.rot, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.filter = 'blur(12px)';
    ctx.fill();
    ctx.restore();

    // Layer 2: Deeper central basalt bed
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx * 0.72, m.ry * 0.68, m.rot, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 36, 46, 0.45)';
    ctx.filter = 'blur(16px)';
    ctx.fill();
    ctx.restore();
  });

  // Hundreds of small and medium impact craters
  for (let i = 0; i < 180; i++) {
    const cx = Math.random() * 2048;
    const cy = Math.random() * 1024;
    const cr = 3 + Math.random() * 9;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235, 240, 248, 0.45)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 0.8, cr * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(35, 42, 54, 0.55)';
    ctx.fill();
  }

  // Major rayed impact craters with luminous ejecta blankets (Tycho, Copernicus, Kepler, Aristarchus)
  const majorCraters = [
    // Tycho (prominent southern highlands crater with immense ray system)
    { x: 880, y: 780, r: 18, rayLen: 420, rayCount: 28 },
    // Copernicus (prominent crater in Oceanus Procellarum / Mare Imbrium)
    { x: 700, y: 480, r: 22, rayLen: 280, rayCount: 22 },
    // Kepler
    { x: 560, y: 490, r: 13, rayLen: 180, rayCount: 16 },
    // Aristarchus (brightest feature on the Moon)
    { x: 490, y: 390, r: 12, rayLen: 140, rayCount: 14 }
  ];

  majorCraters.forEach((c) => {
    // Ejecta rays radiating across the lunar surface
    ctx.save();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.32)';
    ctx.lineWidth = 1.6;
    const step = (Math.PI * 2) / c.rayCount;
    for (let a = 0; a < Math.PI * 2; a += step) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      const len = c.rayLen * (0.65 + Math.random() * 0.45);
      const curX = c.x + Math.cos(a) * len;
      const curY = c.y + Math.sin(a) * len;
      ctx.lineTo(curX, curY);
      ctx.stroke();
    }
    ctx.restore();

    // Raised crater rim (bright chalky white)
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Inner crater bowl shadow
    ctx.beginPath();
    ctx.arc(c.x + 2.5, c.y + 1.8, c.r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = '#262e3d';
    ctx.fill();

    // Central rebound peak
    ctx.beginPath();
    ctx.arc(c.x + 0.5, c.y + 0.5, c.r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Authentic Lunar Bump Map for physical surface crater depths and rim elevations
 */
function makeMoonBumpMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 1024, 512);

  // Maria depressions
  ctx.fillStyle = '#505050';
  const maria = [
    { x: 260, y: 240, rx: 120, ry: 100 },
    { x: 370, y: 180, rx: 85, ry: 65 },
    { x: 510, y: 205, rx: 65, ry: 50 },
    { x: 570, y: 260, rx: 70, ry: 55 },
    { x: 680, y: 220, rx: 45, ry: 38 }
  ];
  maria.forEach((m) => {
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Crater rims (high white) & floors (low black)
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 1024, y = Math.random() * 512, r = 2 + Math.random() * 8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(x + 1, y + 1, r * 0.7, 0, Math.PI * 2); ctx.fillStyle = '#202020'; ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Procedural synchronous fallback texture for Earth.
 * Ensures from frame 0 that Earth is NEVER blank, white, or unloaded.
 * Features deep blue oceans, continental landmasses, deserts, and weather swirls.
 */
function makeDefaultEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Deep oceanic blue
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
  oceanGrad.addColorStop(0, '#0f2942');
  oceanGrad.addColorStop(0.5, '#0b3564');
  oceanGrad.addColorStop(1, '#081d33');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 2048, 1024);

  const drawLand = (pts, color) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Eurasia & Africa
  drawLand([[1000, 180], [1150, 150], [1350, 170], [1650, 220], [1750, 320], [1600, 420], [1450, 390], [1300, 420], [1200, 350], [1050, 300], [980, 230]], '#2d5a27');
  // Europe
  drawLand([[960, 220], [1080, 200], [1120, 260], [1050, 320], [980, 340], [940, 280]], '#3b6e32');
  // Sahara & Middle East
  drawLand([[960, 340], [1240, 340], [1280, 430], [1180, 520], [980, 520], [920, 420]], '#c29b62');
  // Sub-Saharan Africa
  drawLand([[980, 520], [1180, 520], [1150, 720], [1060, 820], [1000, 700], [950, 580]], '#2a5522');
  // North America
  drawLand([[320, 160], [550, 180], [680, 260], [580, 450], [420, 460], [300, 380], [240, 260]], '#2f6228');
  // South America
  drawLand([[450, 470], [580, 520], [620, 680], [520, 850], [450, 820], [420, 620]], '#26541f');
  // Australia
  drawLand([[1600, 640], [1800, 650], [1850, 780], [1720, 820], [1620, 770]], '#b46a3c');
  // Polar Ice Caps
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 2048, 80);
  ctx.fillRect(0, 940, 2048, 84);

  // Weather & Cloud swirl belts
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  for (let y = 140; y < 880; y += 45) {
    for (let x = 0; x < 2048; x += 180) {
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(y * 0.1) * 60, y, 90 + Math.cos(x * 0.05) * 40, 18, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

const CORRIDOR_OFFSET = new THREE.Vector3(500, -500, 0);

// Screen quad measured from the supplied monitor model (in the model's own frame).
const MON = { cx: 3.89, cy: 1.04, cz: -27.4, w: 7.44, h: 4.52 };

export class World {
  constructor(scene, renderer, assets, screens) {
    this.scene = scene; this.renderer = renderer; this.assets = assets; this.A = assets; this.screens = screens;
    this.phase = 'intro';
    this.hotspots = [];
    this.t = 0;
    this.orbitTime = 0;
    this.currentSubLat = -51.6;
    this.currentSubLon = -138.0;
    this.currentHeading = 48.5;

    const pm = new THREE.PMREMGenerator(renderer);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    scene.environment = this.envTex;
    scene.background = new THREE.Color(0x000000);

    this.buildLights();
    this.buildSpace();
    this.buildCabin();
    this.buildCorridor();
    this.setPhase('intro');
  }

  /* ----------------------------- lights ----------------------------- */
  buildLights() {
    const s = this.scene;
    this.sun = new THREE.DirectionalLight(0xfff4e6, 3.8);
    this.sun.castShadow = false;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 5; sc.far = 340;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    s.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbce0ff, 0x222834, 0.28); s.add(this.hemi);
    this.fill = new THREE.AmbientLight(0x4a6582, 0.15); s.add(this.fill);
    this.accents = []; // filled by buildCabin (module lights)
  }

  /* ----------------------------- space ------------------------------ */
  buildSpace() {
    const space = this.space = new THREE.Group(); this.scene.add(space);

    // stars
    const n = 6000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), R = 26000;
      pos.set([r * Math.cos(a) * R, u * R, r * Math.sin(a) * R], i * 3);
      const k = 0.55 + Math.random() * 0.45, tint = Math.random();
      col.set([k * (tint > 0.8 ? 1 : 0.85), k * 0.92, k * (tint < 0.3 ? 1 : 0.9)], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 1.8,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      fog: false,
      toneMapped: false
    }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -100;
    space.add(this.stars);

    // ------------------------------------------------------------------------
    // Photorealistic ESO / NASA 360-degree Milky Way Celestial Panorama
    // High-resolution galactic core, Great Rift molecular dust lanes & star clouds
    // ------------------------------------------------------------------------
    const mwLoader = new THREE.TextureLoader();
    mwLoader.load('/cabin/textures/milkyway.jpg', (mwTex) => {
      mwTex.colorSpace = THREE.SRGBColorSpace;
      mwTex.anisotropy = 8;
      const mwGeo = new THREE.SphereGeometry(28000, 64, 48);
      const mwMat = new THREE.MeshBasicMaterial({
        map: mwTex,
        side: THREE.BackSide,
        transparent: false,
        depthWrite: true,
        depthTest: true,
        toneMapped: false
      });
      this.mwMesh = new THREE.Mesh(mwGeo, mwMat);
      // Tilt Milky Way along galactic equator matching astrophotography in Image 2
      this.mwMesh.rotation.set(0.68, 0.42, 0.85);
      this.mwMesh.frustumCulled = false;
      this.mwMesh.renderOrder = -200;
      space.add(this.mwMesh);
    });

    // earth - Pristine NASA 8K Planetary Sphere with authentic Day/Night transitions
    const R = WORLD.earthR;
    const defaultEarthTex = makeDefaultEarthTexture();

    const earthUniforms = this.earthUniforms = {
      tDiffuse: { value: defaultEarthTex },
      uSunDir: { value: new THREE.Vector3(0.26, 0.065, -0.963).normalize() },
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) }
    };

    // Load authentic 8K NASA Blue Marble texture (8192x4096) with 16x anisotropic filtering
    const texLoader = new THREE.TextureLoader();
    texLoader.load('/cabin/textures/earth_8k.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 16;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      // The 8K source texture has South Pole / Antarctica at row 0.
      // Setting flipY = false correctly aligns Antarctica at South Pole (v = 0)
      // and North America / Europe / Asia / Bangladesh at North Pole (v = 1)!
      tex.flipY = false;
      earthUniforms.tDiffuse.value = tex;
      tex.needsUpdate = true;
    });

    const earthMat = new THREE.ShaderMaterial({
      uniforms: earthUniforms,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vPosW = worldPos.xyz;
          vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uSunDir;
        uniform vec3 uCameraPos;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;

        void main() {
          vec4 texCol = texture2D(tDiffuse, vUv);
          vec3 N = normalize(vNormalW);
          vec3 L = normalize(uSunDir);
          vec3 V = normalize(uCameraPos - vPosW);

          // Authentic NASA 8K Planetary Surface with vibrant, rich natural continent coloration
          vec3 albedo = texCol.rgb;

          // Water mask: Oceans are deep sapphire blue, land contains green vegetation or warm desert tones
          float isWater = clamp((texCol.b * 1.5 - texCol.r * 0.95 - texCol.g * 0.75) * 2.8, 0.0, 1.0);

          // Enhance vibrancy and contrast of real land (lush green river basins, golden desert sands)
          // Land receives zero white-out or specular washout
          vec3 landBoost = vec3(
            pow(albedo.r, 1.1) * 1.08,
            pow(albedo.g, 0.95) * 1.15,
            pow(albedo.b, 1.15) * 0.92
          );
          albedo = mix(landBoost, albedo, isWater);

          // PBR-grade Day/Night diffuse lighting with smooth orbital terminator (NEVER pitch black)
          float NdotL = dot(N, L);
          float dayLight = smoothstep(-0.16, 0.20, NdotL);

          // Ocean specular sun glint - strictly isolated to open water (ZERO glare on land)
          vec3 H = normalize(L + V);
          float NdotH = max(0.0, dot(N, H));
          float sharpGlint = pow(NdotH, 72.0) * 1.6;
          float specGlint = sharpGlint * isWater * smoothstep(0.02, 0.28, NdotL);
          vec3 oceanSpecular = vec3(1.0, 0.96, 0.88) * specGlint;

          // Stratospheric Rayleigh Limb (crisp, narrow atmospheric halo at silhouette edge only)
          float VdotN = max(0.0, dot(V, N));
          float limb = pow(1.0 - VdotN, 4.8);
          vec3 limbColor = vec3(0.18, 0.58, 1.0) * limb * smoothstep(-0.20, 0.30, NdotL) * 0.65;

          // Luminous night earth with soft deep space ambient fill
          vec3 nightEarth = albedo * 0.07 + vec3(0.012, 0.020, 0.040);
          vec3 dayEarth = albedo * (0.92 + 0.20 * max(0.0, NdotL));
          vec3 baseSurface = mix(nightEarth, dayEarth, dayLight);

          vec3 finalColor = baseSurface + oceanSpecular + limbColor;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    const earthGeo = new THREE.SphereGeometry(R, 128, 96);
    const earthMesh = this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.castShadow = false;
    earthMesh.receiveShadow = false;

    this.earthTilt = new THREE.Group();
    this.earthTilt.rotation.set(0, 0, 0);

    this.earthSpin = new THREE.Group();
    this.earthSpin.add(earthMesh);
    this.earthTilt.add(this.earthSpin);

    this.earth = new THREE.Group();
    this.earth.add(this.earthTilt);

    // Ethereal glowing atmospheric layer (soft Rayleigh & Mie gradient with golden sunset/sunrise)
    const atmUniforms = this.atmUniforms = {
      uSunDir: { value: new THREE.Vector3(0.26, 0.065, -0.963).normalize() },
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) }
    };
    const atmMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: atmUniforms,
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vPosW;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vPosW = worldPos.xyz;
          vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uCameraPos;
        varying vec3 vNormalW;
        varying vec3 vPosW;

        void main() {
          vec3 V = normalize(uCameraPos - vPosW);
          vec3 N = normalize(vNormalW);
          vec3 L = normalize(uSunDir);

          float VdotN = dot(V, N);
          float rim = clamp(1.0 - abs(VdotN), 0.0, 1.0);
          float glow = pow(rim, 3.4);

          // Atmospheric color gradient: deep space sapphire -> celestial cyan -> airy horizon glow
          vec3 deepBlue = vec3(0.04, 0.28, 0.88);
          vec3 electricCyan = vec3(0.32, 0.72, 0.98);
          vec3 horizonAir = vec3(0.62, 0.86, 1.0);

          vec3 atmColor = mix(deepBlue, electricCyan, smoothstep(0.1, 0.65, rim));
          atmColor = mix(atmColor, horizonAir, smoothstep(0.65, 1.0, rim) * 0.45);

          // Sunlit forward scattering (natural sunrise/sunset glow where sun grazes the horizon):
          float NdotL = dot(N, L);
          float sunFacing = smoothstep(-0.25, 0.55, NdotL);
          float VdotL = dot(-V, L);
          float mie = pow(max(0.0, VdotL), 10.0) * 1.5;
          float sunGlow = sunFacing * (1.0 + mie * 1.8);

          // Golden sunrise/sunset scattering at orbital terminator
          vec3 sunriseGlow = vec3(1.0, 0.75, 0.48) * mie * smoothstep(0.1, 0.6, rim) * smoothstep(0.4, -0.2, abs(NdotL));

          // Night airglow rim
          vec3 nightAirglow = vec3(0.04, 0.16, 0.36) * 0.35 * (1.0 - sunFacing);

          vec3 finalAtm = (atmColor * sunGlow + sunriseGlow + nightAirglow) * glow * 1.6;
          gl_FragColor = vec4(finalAtm, glow);
        }
      `
    });
    const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.018, 96, 64), atmMat);
    atm.renderOrder = 1;
    this.earth.add(atm); space.add(this.earth);

    // ------------------------------------------------------------------------
    // The Moon (Luna) - Natural Satellite orbiting the real Earth
    // Authentic 3D cratered lunar regolith model with maria and Tycho rays
    // (NEVER clone earth.glb — zero duplicate Earths in space!)
    // ------------------------------------------------------------------------
    const moonTex = makeMoonTexture();
    const moonBump = makeMoonBumpMap();
    const moonGeo = new THREE.SphereGeometry(145, 64, 48);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      bumpMap: moonBump,
      bumpScale: 3.2,
      roughness: 0.94,
      metalness: 0.04
    });
    const moonObj = new THREE.Mesh(moonGeo, moonMat);
    this.moon = moonObj;
    this.moon.castShadow = true;
    this.moon.receiveShadow = true;
    space.add(this.moon);

    // Full Solar System (Heliocentric, Earth on Orbit 3, ZERO duplicate Earths)
    this.solarSystem = new SolarSystem(space);

    // station exterior
    const issObj = this.A.iss ? this.A.iss.scene : makeStation();
    this.iss = normalize(issObj, { size: WORLD.issSize, by: 'max', pivot: 'center' });
    this.iss.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          m.envMapIntensity = 0.90;
          const matName = (m.name || o.name || '').toLowerCase();

          // 1. Solar array wings & photovoltaic cells (preserve authentic deep blue & gold grid)
          if (matName.includes('solar') || matName.includes('panel') || matName.includes('array')) {
            m.metalness = 0.10;
            m.roughness = 0.30;
            m.side = THREE.DoubleSide;
            if (m.emissive) {
              m.emissive.setRGB(0.01, 0.03, 0.06);
              m.emissiveIntensity = 0.20;
            }
          }
          // 2. Gold / copper MLI thermal insulation foil
          else if (matName.includes('gold') || matName.includes('ins') || matName.includes('foil')) {
            m.metalness = 0.85;
            m.roughness = 0.25;
            if (m.emissive) {
              m.emissive.setRGB(0.12, 0.08, 0.02);
              m.emissiveIntensity = 0.25;
            }
          }
          // 3. Station pressurized modules (anodized aluminum & white beta-cloth blankets)
          else {
            if (m.roughness !== undefined) m.roughness = THREE.MathUtils.clamp(m.roughness, 0.45, 0.70);
            if (m.metalness !== undefined) m.metalness = THREE.MathUtils.clamp(m.metalness, 0.08, 0.35);
            if (m.emissive) {
              // Minimal deep-space shadow fill so dark side isn't pitch black, without bleaching daylight colors
              m.emissive.setRGB(0.03, 0.04, 0.06);
              m.emissiveIntensity = 0.15;
            }
          }

          // Ensure authentic sRGB color reproduction & correct inverted texture vertical orientation on ISS modules & flags (fixes upside down NASDA, ESA, USA, Unity & flags)
          if (m.map) {
            m.map.colorSpace = THREE.SRGBColorSpace;
            m.map.wrapS = THREE.RepeatWrapping;
            m.map.wrapT = THREE.RepeatWrapping;
            m.map.repeat.set(1, -1);
            m.map.offset.set(0, 1);
            m.map.anisotropy = 16;
            m.map.minFilter = THREE.LinearMipmapLinearFilter;
            m.map.magFilter = THREE.LinearFilter;
            m.map.generateMipmaps = true;
            m.map.needsUpdate = true;
          }
          m.needsUpdate = true;
        });
      }
    });
    this.iss.position.copy(WORLD.issPos);
    this.issSpin = new THREE.Group(); this.issSpin.position.copy(WORLD.issPos);
    this.iss.position.set(0, 0, 0); this.issSpin.add(this.iss); space.add(this.issSpin);

    // ------------------------------------------------------------------------
    // NASA / DoD GPS III Navstar Satellite (models/gps_satellite.glb)
    // Orbiting Earth well below the ISS in Low Earth Orbit (LEO) with authentic
    // blue solar array wings, gold MLI foil, and navigation antenna array.
    // ------------------------------------------------------------------------
    const gpsObj = (this.assets?.satellite || this.A?.satellite)
      ? SkeletonUtils.clone((this.assets?.satellite || this.A?.satellite).scene)
      : makeGpsSatellite();

    const goldFoilMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 0.35,
      metalness: 0.90,
      roughness: 0.22,
      side: THREE.DoubleSide
    });
    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: new THREE.Color(0x0ea5e9),
      emissiveIntensity: 0.50,
      metalness: 0.95,
      roughness: 0.12,
      side: THREE.DoubleSide
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      emissive: new THREE.Color(0x64748b),
      emissiveIntensity: 0.15,
      metalness: 0.88,
      roughness: 0.22,
      side: THREE.DoubleSide
    });
    const darkChassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.35,
      side: THREE.DoubleSide
    });

    const baseGps = normalize(gpsObj, { size: 1.0, by: 'max', pivot: 'center' });
    baseGps.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const idx = parseInt(o.name.replace('Object_', '')) || 0;
        if (idx === 4 || idx === 5 || idx === 6) {
          o.material = solarPanelMat;
        } else if (idx === 1 || idx === 2 || idx === 11 || idx === 12) {
          o.material = goldFoilMat;
        } else if (idx === 0 || idx === 14 || idx === 16) {
          o.material = silverMat;
        } else {
          o.material = darkChassisMat;
        }
      }
    });

    // Wrap in an outer holder group so baseGps permanently retains its 1.0-unit normalization.
    this.gpsSatellite = new THREE.Group();
    this.gpsSatellite.name = 'Navstar_GPS_Satellite';
    this.gpsSatellite.add(baseGps);
    this.gpsSatellite.scale.setScalar(8.0);
    this.gpsAngle = 1.15;

    // High-visibility cyan navigation strobe beacon so user can immediately spot it
    const gpsBeacon = new THREE.PointLight(0x38bdf8, 3.5, 60, 1.6);
    gpsBeacon.position.set(0, 0.5, 0);
    this.gpsBeacon = gpsBeacon;
    this.gpsSatellite.add(gpsBeacon);

    space.add(this.gpsSatellite);

    // ------------------------------------------------------------------------
    // ISS Continuous Circular Inclined Orbit & Shifting Web Ground Track
    // (Inclination 51.6 degrees, shifting westward as Earth rotates beneath it)
    // ------------------------------------------------------------------------
    this._buildOrbitWeb();

    // ------------------------------------------------------------------------
    // Real ISS Forward Docking Port (Harmony Node 2 PMA-2 / IDA-2)
    // Docking alignment aids positioned flush onto the real ISS docking ring!
    // ------------------------------------------------------------------------
    const dockPort = this.dockPort = new THREE.Group();
    // Centered flush on the real PMA-2 / IDA-2 forward docking interface of Node 2
    dockPort.position.set(-0.075, -3.034, 17.11);

    // Alignment Target Crosshair Plate & Laser Crosshairs flush at IDA-2 ring
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({ color: 0x070b14, transparent: true, opacity: 0.85 }));
    plate.position.z = -0.02;
    dockPort.add(plate);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const chH = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.035), lineMat);
    const chV = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 1.5), lineMat);
    chH.position.z = 0.01; chV.position.z = 0.01;
    dockPort.add(chH, chV);
    this.dockCrosshairs = [chH, chV];

    // Docking Status Beacon LED (top apex of the real IDA-2 ring)
    this.dockLed = new THREE.PointLight(0xf59e0b, 2.2, 12, 1.5);
    this.dockLed.position.set(0, 0.96, 0.12);
    const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    ledMesh.position.copy(this.dockLed.position);
    this.dockLedMesh = ledMesh;
    dockPort.add(this.dockLed, ledMesh);

    // Dual high-intensity docking floodlights illuminating the IDA-2 port and approach axis
    const floodL = new THREE.SpotLight(0xf8fafc, 3.2, 28, Math.PI / 4, 0.4);
    floodL.position.set(-1.4, 0, 0.2);
    floodL.target.position.set(0, 0, 8);
    const floodR = new THREE.SpotLight(0xf8fafc, 3.2, 28, Math.PI / 4, 0.4);
    floodR.position.set(1.4, 0, 0.2);
    floodR.target.position.set(0, 0, 8);
    dockPort.add(floodL, floodL.target, floodR, floodR.target);

    this.issSpin.add(dockPort);

    // ------------------------------------------------------------------------
    // SpaceX Crew Dragon Spacecraft
    // ------------------------------------------------------------------------
    const dragonGroup = this.dragonGroup = new THREE.Group();
    // Default docked position: nose flush at the real Harmony Node 2 forward port!
    dragonGroup.position.set(-0.075, -3.034, 17.11);
    this.issSpin.add(dragonGroup);

    // Inner group to hold the Dragon model with exact nose-tip alignment
    const dragonInner = new THREE.Group();
    dragonInner.position.set(0, 0, 0);
    dragonGroup.add(dragonInner);

    // Rotate so nose points in -Z towards the ISS docking port
    dragonInner.rotation.set(0, Math.PI / 2, 0);
    // Scale Crew Dragon naturally (~8m long, ~4m diameter)
    const DRAGON_SCALE = 2.8;
    dragonInner.scale.set(DRAGON_SCALE, DRAGON_SCALE, DRAGON_SCALE);

    // Real Textures from folder
    // Load SpaceX Crew Dragon GLB
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('/models/spacex/space_x_crew_dragon.glb', (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.renderOrder = 0;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            const name = (m.name || '').toLowerCase();
            if (name === 'wglass') {
              m.color.setHex(0x080c14); // Deep tinted astronaut reflective visor glass
              m.roughness = 0.04;
              m.metalness = 0.98;
              m.transparent = false;
              m.opacity = 1.0;
              m.depthWrite = true;
              m.depthTest = true;
              m.side = THREE.DoubleSide;
              if (m.clearcoat !== undefined) {
                m.clearcoat = 1.0;
                m.clearcoatRoughness = 0.02;
              }
              o.renderOrder = 2;
            } else {
              m.transparent = false;
              m.opacity = 1.0;
              m.depthWrite = true;
              m.depthTest = true;
              if (name === 'white') {
                m.color.setHex(0xfbfcfd);
                m.roughness = 0.22;
                m.metalness = 0.08;
                if (m.clearcoat !== undefined) {
                  m.clearcoat = 0.85;
                  m.clearcoatRoughness = 0.06;
                }
              } else if (name === 'black') {
                m.color.setHex(0x131518);
                m.roughness = 0.45;
                m.metalness = 0.18;
              } else if (name === 'material_4') {
                m.color.setHex(0x1e2126);
                m.roughness = 0.35;
                m.metalness = 0.65;
              } else if (m.map) {
                m.roughness = 0.25;
                m.metalness = 0.05;
              }
              m.needsUpdate = true;
            }
          });
        }
      });
      model.position.set(-1.265, -1.0173, -0.0340);
      dragonInner.add(model);
      this.dragonModel = model;
      this.dragonNose = model.getObjectByName('_2') || model.getObjectByName('Object_13');
      this.createDragonCockpit(model);
      if (this.phase === 'cabin' && this.dragonCrew) {
        this.dragonCrew.visible = false;
      }
    });

    // Dragon NASA Docking System (NDS) Collar & Soft-Capture Ring (revealed when nose cone opens)
    const ndsGroup = this.dragonNdsGroup = new THREE.Group();
    ndsGroup.position.set(0, 0, 0.05);

    // Soft capture collar ring
    const ndsRingMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const ndsRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.065, 16, 48), ndsRingMat);
    ndsGroup.add(ndsRing);

    // 3 NASA Docking System Petals (interlocking with IDA-2)
    const ndsPetalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
    [60, 180, 300].forEach((deg) => {
      const pGroup = new THREE.Group();
      pGroup.rotation.z = (deg * Math.PI) / 180;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.50, 0.06), ndsPetalMat);
      petal.position.set(0, 0.72, -0.15);
      petal.rotation.x = -0.25;
      pGroup.add(petal);
      ndsGroup.add(pGroup);
    });

    // LiDAR & Rendezvous Navigation Sensors (illuminated green/cyan LEDs)
    const lidarLedMat = this.dragonLidarMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const lidar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), lidarLedMat);
    lidar1.position.set(0.65, 0.42, -0.05); lidar1.rotation.x = Math.PI / 2;
    const lidar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), lidarLedMat);
    lidar2.position.set(-0.65, 0.42, -0.05); lidar2.rotation.x = Math.PI / 2;
    ndsGroup.add(lidar1, lidar2);

    // Docking floodlight illuminating the target port
    const dockSpot = this.dragonDockSpot = new THREE.SpotLight(0xe0f2fe, 3.5, 30, Math.PI / 4, 0.35, 1.2);
    dockSpot.position.set(0, 0.65, 0.1);
    dockSpot.target.position.set(0, 0, -10);
    ndsGroup.add(dockSpot, dockSpot.target);

    ndsGroup.visible = false;
    dragonGroup.add(ndsGroup);

    // Draco RCS Thrusters (clean, sleek thruster ports without cartoon polygonal cones)
    const rcsMat = this.rcsMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0, visible: false });
    this.rcsPlumes = [];

    // ------------------------------------------------------------------------
    // Radiant Starburst Sun with multi-spike diffraction rays and golden corona
    // (Accurate, realistic Sun reflection as seen from orbit in Image 2)
    // ------------------------------------------------------------------------
    this.flare = new THREE.Group();
    const glow = new THREE.SpriteMaterial({
      map: glowTexture(256),
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      toneMapped: false
    });
    const core = new THREE.Sprite(glow);
    core.scale.set(2200, 2200, 1);

    const bigHalo = new THREE.Sprite(glow.clone());
    bigHalo.scale.set(5800, 5800, 1);
    bigHalo.material.color.setHex(0xffe6a0);
    bigHalo.material.opacity = 0.42;

    // Multi-spike Radiant Diffraction Starburst Rays (16 rays radiating into space)
    const starburstMat = new THREE.SpriteMaterial({
      map: sunStarburstTexture(),
      color: 0xfff8e8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
      toneMapped: false
    });
    const starburst = new THREE.Sprite(starburstMat);
    starburst.scale.set(4800, 4800, 1);

    // Anamorphic horizontal lens flare ray across the sun
    const streakMat = new THREE.SpriteMaterial({
      map: streakTexture(),
      color: 0xffeedd,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.65,
      toneMapped: false
    });
    const streak = new THREE.Sprite(streakMat);
    streak.scale.set(7600, 420, 1);

    this.flare.add(core, bigHalo, starburst, streak);
    this.flare.visible = true;
    space.add(this.flare);
  }

  /* ----------------------------- cabin ------------------------------ */
  buildCabin() {
    const cab = this.cabin = new THREE.Group(); this.scene.add(cab);

    const mod = buildModule({ tex: (id) => this.screens.texture(id) }); cab.add(mod.group); this.accents = mod.lights;

    // greenhouse bay on the left wall (aft half)
    const gh = new THREE.Group(); gh.position.set(-13.2, 12.5, 24);
    gh.add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 7.2, 9.0), new THREE.MeshStandardMaterial({ color: 0x24282e, metalness: 0.8, roughness: 0.4 })));
    const glowM = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.45, 1.3), toneMapped: false })); glowM.position.x = 1.65; glowM.rotation.y = Math.PI / 2; gh.add(glowM);
    for (let i = 0; i < 12; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9 + Math.random() * 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x59d96b, roughness: 0.8 })); p.position.set(1.85, -2 + Math.random() * 0.5, -3.6 + (i % 6) * 1.4); gh.add(p); }
    const pl = new THREE.PointLight(0xff4fa8, 60, 20, 1.8); pl.position.set(3, 0, 0); gh.add(pl); cab.add(gh);

    // Shifted Sci-Fi Computer Consoles: positioned cleanly on cabin sides (facing central walkway, zero overlap)
    this.consoles = CONSOLES.map((c) => {
      const proto = this.A.console ? SkeletonUtils.clone(this.A.console.scene) : makeConsole();
      const o = normalize(proto, { size: c.width, by: 'width', pivot: 'bottom' });
      o.position.copy(c.pos); o.rotation.y = c.rotY;
      o.traverse((n) => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { m.envMapIntensity = 0.8; if (m.emissive && m.emissiveMap) m.emissiveIntensity = 1.6; }); } });
      cab.add(o);
      return o;
    });

    // ------------------------------------------------------------------------
    // ISS Robotic Workstation (RWS) - Main Control Panel in front of the Cupola
    // ------------------------------------------------------------------------
    const rws = createRoboticWorkstation();
    rws.position.set(0, 6.2, -59.5);
    rws.rotation.y = 0; // facing crew looking forward into Cupola
    cab.add(rws);
    this.rws = rws;

    // Ambient monitor telemetry illumination for the Robotic Workstation
    const rwsGlow = new THREE.PointLight(0x38bdf8, 85, 24, 1.8);
    rwsGlow.position.set(0, 9.2, -58.5);
    cab.add(rwsGlow);

    // ------------------------------------------------------------------------
    // ISS Microgravity Science Glovebox (MSG) - Authentic ISPR payload racks
    // Mounted on cabin sides (like old NASA style computers, ZERO overlap)
    // ------------------------------------------------------------------------
    const msgLeft = createMicrogravityScienceGlovebox();
    msgLeft.position.set(-11.4, 0.05, -16.0);
    msgLeft.rotation.y = Math.PI / 2;
    cab.add(msgLeft);

    const msgRight = createMicrogravityScienceGlovebox();
    msgRight.position.set(11.4, 0.05, 8.0);
    msgRight.rotation.y = -Math.PI / 2;
    cab.add(msgRight);
    this.msgRacks = [msgLeft, msgRight];

    // soft screen glow over the forward consoles
    const cg = new THREE.PointLight(0x4fc8ff, 70, 26, 1.8); cg.position.set(0, 9, -38); cab.add(cg);

    // NASA Retro Computer Consoles along the corridor sides (blended naturally with ISS lighting)
    const nasaConsoleSrc = this.A.nasaConsole || this.A.console;
    if (nasaConsoleSrc) {
      const NASA_CONSOLE_CONFIGS = [
        // Stop 04 Cargo & ECLSS Workstation (left wall, prominently facing corridor walkway)
        { pos: new THREE.Vector3(-9.0, 0.05, 25.0), rotY: Math.PI / 2 - 0.15, height: 5.8 },
        // Stop 04 Cargo & ECLSS Workstation (right wall, facing walkway)
        { pos: new THREE.Vector3(9.0, 0.05, 23.0), rotY: -Math.PI / 2 + 0.15, height: 5.8 },
        // Mid-corridor Telemetry Station (left wall)
        { pos: new THREE.Vector3(-9.0, 0.05, 8.0), rotY: Math.PI / 2 - 0.1, height: 5.8 },
        // Forward Bay Workstation (right wall)
        { pos: new THREE.Vector3(9.0, 0.05, -6.0), rotY: -Math.PI / 2 + 0.1, height: 5.8 }
      ];
      NASA_CONSOLE_CONFIGS.forEach((cfg) => {
        const proto = SkeletonUtils.clone(nasaConsoleSrc.scene);
        const nc = normalize(proto, { size: cfg.height, by: 'height', pivot: 'bottom' });
        nc.position.copy(cfg.pos);
        nc.rotation.y = cfg.rotY;
        nc.traverse((n) => {
          if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
            n.material = n.material.clone();
            n.material.envMapIntensity = 1.0;
            n.material.roughness = 0.45;
            n.material.metalness = 0.25;
            if (n.material.emissive) {
              n.material.emissive.setHex(0x1a382c);
              n.material.emissiveIntensity = 0.8;
            }
          }
        });
        cab.add(nc);

        // Retro CRT Phosphor Green/Cyan Terminal Glow
        const scrGlow = new THREE.PointLight(0x40ffbb, 38, 16, 1.8);
        const fwdOffset = new THREE.Vector3(0, 0, 1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), cfg.rotY);
        scrGlow.position.copy(cfg.pos).add(new THREE.Vector3(0, 3.8, 0)).add(fwdOffset);
        cab.add(scrGlow);
      });
    }

    // wall monitors with live dashboards
    this.monitors = MONITORS.map((cfg) => {
      const g = new THREE.Group();
      let inner, screenMesh;
      if (this.A.monitor) {
        inner = this.A.monitor.scene.clone(true);
        inner.traverse((n) => {
          if (!n.isMesh) return; const nm = (n.material && n.material.name) || '';
          if (nm === 'Black_metal' || nm === 'White_metal' || nm === 'Material.004') n.visible = false;
          n.castShadow = true; if (n.material) n.material.envMapIntensity = 0.8;
        });
        inner.position.set(-MON.cx, -MON.cy, -MON.cz);
        const planeInner = new THREE.Mesh(new THREE.PlaneGeometry(MON.w, MON.h), new THREE.MeshBasicMaterial({ map: this.screens.texture(cfg.id), toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
        planeInner.position.set(MON.cx, MON.cy, MON.cz + 0.04); inner.add(planeInner); screenMesh = planeInner;
      } else {
        inner = new THREE.Group(); inner.add(makeMonitorFrame());
        const p = new THREE.Mesh(new THREE.PlaneGeometry(MON.w, MON.h), new THREE.MeshBasicMaterial({ map: this.screens.texture(cfg.id), toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
        p.position.z = 0.04; inner.add(p); screenMesh = p;
      }
      g.userData.screen = screenMesh; g.userData.cfg = cfg;
      // seat the back of the visible monitor body exactly on the wall plate (group origin = wall surface)
      g.add(inner); g.updateMatrixWorld(true);
      const box = new THREE.Box3();
      inner.traverse((n) => { if (n.isMesh && n.visible) { n.geometry.computeBoundingBox(); box.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld)); } });
      if (isFinite(box.min.z)) inner.position.z -= box.min.z;
      g.scale.setScalar(cfg.width / MON.w);
      g.position.set(cfg.pos.x - 0.5, cfg.pos.y, cfg.pos.z); g.rotation.y = cfg.rotY; cab.add(g);
      cab.add(mod.group.userData.plate(cfg.pos.z, cfg.width));
      const l = new THREE.PointLight(0x35e8ff, 40, 22, 1.8); l.position.copy(cfg.pos).add(new THREE.Vector3(-4, 0, 0)); cab.add(l);
      this.addHotspot(cfg.pos.clone().add(new THREE.Vector3(-2, 7.4, 0)), cfg.id);
      return g;
    });
    this.addHotspot(new THREE.Vector3(0, 21.5, -74), 'window');

    // light shafts through the window (subtle atmospheric rays, soft and non-blurry)
    const lightDir = SUN.cabin.clone().negate();
    const shaftTex = shaftTexture(); this.shafts = [];
    for (let i = 0; i < 4; i++) {
      const L = 80, len = L, wid = rand(1.8, 3.0);
      const start = new THREE.Vector3(-5 + i * 3.2, rand(11, 16), -75);
      const mat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: rand(0.005, 0.012), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(0.4, 0.75, 1.0), toneMapped: true });
      const grp = new THREE.Group();
      const a = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), mat);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(len, wid), mat); b.rotation.x = Math.PI / 2;
      grp.add(a, b); grp.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), lightDir);
      grp.position.copy(start).addScaledVector(lightDir, len / 2); grp.userData = { base: mat.opacity, ph: Math.random() * 6 };
      cab.add(grp); this.shafts.push(grp);
    }

    // floating dust in the light
    const dn = 800, dp = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) dp.set([rand(-12, 12), rand(1, 27), rand(-52, 52)], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.12, color: 0xffeccc, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: true }));
    cab.add(this.dust);
  }

  _buildOrbitWeb() {
    // Pure, pristine Earth: All artificial grid lines, ground tracks, and markers
    // have been permanently removed per user request for 100% natural, realistic Earth.
    this.orbitWebGroup = new THREE.Group();
    this.subSatMarker = null;
  }

  buildCorridor() {
    this.corridor = new THREE.Group();

    // ------------------------------------------------------------------------
    // Authentic NASA ISS Pressurized Module Corridor & Bulkhead Hatch
    // 100% Faithful to ISS Lab Architecture:
    // - Quilted white Nomex thermal blankets on ceiling raceway
    // - ISPR modular equipment racks with circular inspection covers & avionics
    // - NASA Royal Blue ventilation kickplate louvers on lower 45-degree chamfers
    // - Vertical zero-g crew handrails in royal blue finish
    // - Articulated astronaut laptop workstation
    // - Iconic NASA Common Bulkhead Round Hatch Door with flat bottom sill,
    //   rotary dogging latch mechanism, central viewport, and flanking fan vents
    // ------------------------------------------------------------------------
    const corridorGroup = new THREE.Group();

    // 1. Procedural High-Res NASA Nomex Quilted Acoustic Blanket Texture
    function createBlanketTexture() {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, 1024, 1024);
      // Quilted stitching lines with soft depth
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'; ctx.lineWidth = 4;
      const step = 128;
      for (let x = 0; x <= 1024; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
      for (let y = 0; y <= 1024; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
      // Puffy tuft buttons and blue velcro tabs
      for (let x = 0; x < 1024; x += step) {
        for (let y = 0; y < 1024; y += step) {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
          ctx.beginPath(); ctx.arc(x + step / 2, y + step / 2, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x + step / 2 - 2, y + step / 2 - 2, 2.5, 0, Math.PI * 2); ctx.fill();
          if ((x + y) % (step * 2) === 0) {
            ctx.fillStyle = 'rgba(29, 78, 216, 0.85)';
            ctx.fillRect(x + 24, y + 54, 80, 20);
          }
        }
      }
      // NASA inspection stencils
      ctx.fillStyle = 'rgba(71, 85, 105, 0.65)';
      ctx.font = 'bold 20px monospace'; ctx.fillText('NASA JSC · ISS HARMONY NODE 2', 64, 96);
      ctx.font = '15px monospace'; ctx.fillText('ACOUSTIC BLANKET ASSY // P/N 683-1402-01', 64, 124);
      ctx.fillText('PMA-2 FORWARD VESTIBULE // EXP 71', 64, 148);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 4);
      return tex;
    }

    // 2. Procedural ISPR Equipment Rack / Locker Texture
    function createRackTexture() {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 1024, 1024);
      for (let row = 0; row < 4; row++) {
        const y = row * 256;
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(16, y + 16, 992, 224);
        ctx.fillStyle = '#94a3b8'; ctx.strokeRect(20, y + 20, 984, 216);
        ctx.fillStyle = '#64748b'; ctx.fillRect(26, y + 26, 972, 204);
        ctx.fillStyle = '#1e293b';
        [36, 988].forEach(bx => { [y + 36, y + 220].forEach(by => { ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill(); }); });
        for (let s = 0; s < 6; s++) {
          const sx = 80 + s * 70;
          ctx.fillStyle = '#0f172a'; ctx.fillRect(sx, y + 120, 24, 48);
          ctx.fillStyle = s % 2 === 0 ? '#22c55e' : '#38bdf8';
          ctx.beginPath(); ctx.arc(sx + 12, y + 90, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 20px monospace';
        ctx.fillText(`ISPR BAY 0${row + 1} // ECLSS & AVIONICS`, 80, y + 64);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 3);
      return tex;
    }

    // 3. Procedural Aerospace White Floor Panel Texture
    function createFloorTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 512;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3;
      // Grid panel seams
      for (let x = 0; x <= 512; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
      for (let y = 0; y <= 512; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
      // Fastener rivets & blue foot-restraint clips
      for (let x = 64; x < 512; x += 128) {
        for (let y = 64; y < 512; y += 128) {
          ctx.fillStyle = '#475569';
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(x - 18, y + 24, 36, 10);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 8);
      return tex;
    }

    // 4. Procedural NASA Royal Blue Ventilation Kickplate Louver Texture
    function createLouverTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 512;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1e3a8a'; ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#0f172a';
      // Horizontal slotted louver airflow grilles
      for (let y = 16; y < 512; y += 24) {
        ctx.fillRect(24, y, 464, 10);
      }
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
      for (let y = 16; y < 512; y += 24) {
        ctx.beginPath(); ctx.moveTo(24, y + 11); ctx.lineTo(488, y + 11); ctx.stroke();
      }
      // Top and bottom metallic fastener rails
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 0, 512, 12);
      ctx.fillRect(0, 500, 512, 12);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 10);
      return tex;
    }

    const blanketTex = createBlanketTexture();
    const rackTex = createRackTexture();
    const floorTex = createFloorTexture();
    const louverTex = createLouverTexture();

    const blanketMat = new THREE.MeshStandardMaterial({ map: blanketTex, roughness: 0.72, metalness: 0.08 });
    const rackMat = new THREE.MeshStandardMaterial({ map: rackTex, roughness: 0.38, metalness: 0.45 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.52, metalness: 0.58 });
    const louverMat = new THREE.MeshStandardMaterial({ map: louverTex, roughness: 0.35, metalness: 0.65 });
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.28 });
    const blueRailMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.85, roughness: 0.22 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.88, roughness: 0.24 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });

    // ------------------------------------------------------------------------
    // Seamless Airtight Octagonal Hull Construction (100% Zero-Gap Architecture)
    // ------------------------------------------------------------------------
    const cx = -1.1, cy = 1.35, cz = -5.0, L = 12.0;

    // 1. Center Flat Floor Deck (1.70m wide, non-skid treadplate)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.70, L), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, cy - 1.225, cz);
    corridorGroup.add(floor);

    // 2. Center Flat Ceiling Raceway (1.70m wide, Nomex acoustic blankets)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(1.70, L), blanketMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, cy + 1.225, cz);
    corridorGroup.add(ceil);

    // 3. Left Wall (ISPR Modular Equipment Racks)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.70), rackMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(cx - 1.225, cy, cz);
    corridorGroup.add(leftWall);

    // 4. Right Wall (ISPR Modular Equipment Racks)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.70), rackMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(cx + 1.225, cy, cz);
    corridorGroup.add(rightWall);

    // Helper for 45-degree chamfers
    function createChamfer(px, py, angle, mat) {
      const g = new THREE.Group();
      g.position.set(px, py, cz);
      g.rotation.z = angle;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.70, L), mat);
      p.rotation.x = -Math.PI / 2;
      g.add(p);
      return g;
    }

    // 5. Lower Left 45° Chamfer: NASA Royal Blue Ventilation Louvers
    const louverLeft = createChamfer(cx - 0.98, cy - 0.98, -Math.PI / 4, louverMat);
    // 6. Lower Right 45° Chamfer: NASA Royal Blue Ventilation Louvers
    const louverRight = createChamfer(cx + 0.98, cy - 0.98, Math.PI / 4, louverMat);
    // 7. Upper Left 45° Chamfer: White Nomex Blanket Conduit
    const topChamferL = createChamfer(cx - 0.98, cy + 0.98, -3 * Math.PI / 4, blanketMat);
    // 8. Upper Right 45° Chamfer: White Nomex Blanket Conduit
    const topChamferR = createChamfer(cx + 0.98, cy + 0.98, 3 * Math.PI / 4, blanketMat);

    corridorGroup.add(louverLeft, louverRight, topChamferL, topChamferR);

    // Overhead Longitudinal Fluorescent Diffuser Light Strips
    const ledDiffMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const led1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, L), ledDiffMat);
    led1.position.set(cx - 0.92, cy + 0.92, cz);
    led1.rotation.z = -Math.PI / 4;
    const led2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, L), ledDiffMat);
    led2.position.set(cx + 0.92, cy + 0.92, cz);
    led2.rotation.z = Math.PI / 4;
    corridorGroup.add(led1, led2);

    // Circular Access / Inspection Port Discs (flush on ISPR racks, matching reference photo)
    const discGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.015, 32);
    const discMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.25, roughness: 0.45 });
    const discRimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.25 });
    const yellowLabelMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });

    for (let z = -0.5; z >= -9.5; z -= 2.4) {
      [-1, 1].forEach(side => {
        const xPos = side === -1 ? cx - 1.215 : cx + 1.215;
        const rotY = side === -1 ? Math.PI / 2 : -Math.PI / 2;
        [cy + 0.40, cy - 0.35].forEach(yPos => {
          const disc = new THREE.Mesh(discGeo, discMat);
          disc.rotation.z = Math.PI / 2;
          disc.rotation.y = rotY;
          disc.position.set(xPos, yPos, z);

          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 8, 32), discRimMat);
          rim.rotation.y = rotY;
          rim.position.set(xPos + (side === -1 ? 0.008 : -0.008), yPos, z);

          // Horizontal twin twist handles
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.015), chromeMat);
          handle.rotation.y = rotY;
          handle.position.set(xPos + (side === -1 ? 0.014 : -0.014), yPos, z);

          // Yellow hazard label
          const label = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.004), yellowLabelMat);
          label.rotation.y = rotY;
          label.position.set(xPos + (side === -1 ? 0.014 : -0.014), yPos + 0.12, z);

          corridorGroup.add(disc, rim, handle, label);
        });
      });
    }

    // Vertical NASA ISS Royal Blue Zero-G Handrails
    for (let z = 0.5; z >= -10.0; z -= 1.8) {
      [-1, 1].forEach(side => {
        const xPos = side === -1 ? cx - 1.12 : cx + 1.12;
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 16), blueRailMat);
        rail.position.set(xPos, cy, z);
        const st1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.10, 8), chromeMat);
        st1.rotation.z = side === -1 ? Math.PI / 2 : -Math.PI / 2;
        st1.position.set(side === -1 ? xPos - 0.05 : xPos + 0.05, cy + 0.52, z);
        const st2 = st1.clone();
        st2.position.set(side === -1 ? xPos - 0.05 : xPos + 0.05, cy - 0.52, z);
        corridorGroup.add(rail, st1, st2);
      });
    }

    // Astronaut Laptop Workstation on Left Rack
    const laptopGroup = new THREE.Group();
    laptopGroup.position.set(cx - 0.95, cy - 0.05, -4.6);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.04), chromeMat);
    arm.position.set(-0.10, 0, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.24), chromeMat);
    base.position.set(0.12, 0.01, 0);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.015), chromeMat);
    screen.position.set(0.12, 0.11, -0.11);
    screen.rotation.x = 0.25;
    const screenDisp = new THREE.Mesh(
      new THREE.PlaneGeometry(0.29, 0.19),
      new THREE.MeshBasicMaterial({ color: 0x0284c7 })
    );
    screenDisp.position.set(0.12, 0.11, -0.10);
    screenDisp.rotation.x = 0.25;
    laptopGroup.add(arm, base, screen, screenDisp);
    corridorGroup.add(laptopGroup);

    // Entrance End-Cap sealing tunnel entrance (z = +1.0)
    const entranceCap = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), blanketMat);
    entranceCap.position.set(cx, cy, 1.0);
    corridorGroup.add(entranceCap);

    // Balanced Laboratory Lighting (crisp contrast & realistic zero-lag shading)
    const amb = new THREE.AmbientLight(0xffffff, 1.2);
    corridorGroup.add(amb);
    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 1.1);
    corridorGroup.add(hemi);

    const dl1 = new THREE.PointLight(0xe0f2fe, 1.4, 8);
    dl1.position.set(cx, cy + 1.0, -2.5);
    const dl2 = new THREE.PointLight(0xe0f2fe, 1.4, 8);
    dl2.position.set(cx, cy + 1.0, -7.5);
    corridorGroup.add(dl1, dl2);

    this.corridor.add(corridorGroup);
    this.corridor.position.copy(CORRIDOR_OFFSET);

    // ------------------------------------------------------------------------
    // NASA Bulkhead Hatch Assembly & Frame with Open Doorway Cutout
    // ------------------------------------------------------------------------
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-1.1, 1.35, -9.8);

    // Bulkhead Wall (Left, Right, Top, Bottom panels forming doorway portal)
    const bulkheadMat = new THREE.MeshStandardMaterial({ map: blanketTex, roughness: 0.68, metalness: 0.15 });
    const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.65), bulkheadMat);
    wallLeft.position.set(-1.0, 0, 0);
    const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.65), bulkheadMat);
    wallRight.position.set(1.0, 0, 0);
    const wallTop = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.52), bulkheadMat);
    wallTop.position.set(0, 1.06, 0);
    const wallBtm = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.45), bulkheadMat);
    wallBtm.position.set(0, -1.10, 0);
    doorGroup.add(wallLeft, wallRight, wallTop, wallBtm);

    // Flanking Circular Air Circulation Fan Vents (iconic bronze rims)
    [-0.76, 0.76].forEach(vx => {
      const ventRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 16, 32), bronzeMat);
      ventRing.position.set(vx, 0.58, 0.04);
      const ventInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.04, 32),
        new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.85, metalness: 0.6 })
      );
      ventInner.rotation.x = Math.PI / 2;
      ventInner.position.set(vx, 0.58, 0.02);
      const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), chromeMat);
      fanHub.rotation.x = Math.PI / 2;
      fanHub.position.set(vx, 0.58, 0.04);
      doorGroup.add(ventRing, ventInner, fanHub);
    });

    // Airtight Silicone Pressure Seal Ring Gasket around doorway
    const sealMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6, metalness: 0.1 });
    const sealRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.04, 16, 48), sealMat);
    sealRing.position.z = 0.02;
    doorGroup.add(sealRing);

    // Upper Status LED Bar
    const ledHudMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.3 });
    const ledBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.06), ledHudMat);
    ledBar.position.set(0, 1.08, 0.06);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.04, 0.02), ledMat);
    led.position.set(0, 0, 0.035);
    ledBar.add(led);
    doorGroup.add(ledBar);

    // NASA Common Bulkhead Hatch (Extruded Geometry with Flat Bottom Sill)
    const R = 0.80, btmY = -0.68, btmHalfW = 0.46, chamferX = 0.66, chamferY = -0.42;
    const startAngle = Math.atan2(chamferY, chamferX);
    const endAngle = Math.atan2(chamferY, -chamferX);

    const hatchShape = new THREE.Shape();
    hatchShape.moveTo(-btmHalfW, btmY);
    hatchShape.lineTo(btmHalfW, btmY);
    hatchShape.lineTo(chamferX, chamferY);
    hatchShape.absarc(0, 0, R, startAngle, endAngle, false);
    hatchShape.lineTo(-btmHalfW, btmY);

    const hatchGeo = new THREE.ExtrudeGeometry(hatchShape, {
      depth: 0.07, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.02, bevelThickness: 0.02
    });

    const hatchDoorMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, metalness: 0.65, roughness: 0.35
    });

    // Left Hinge Pivot Group
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.78, 0, 0.05);

    // Door Body offset inside Pivot Group
    const doorBody = new THREE.Group();
    doorBody.position.set(0.78, 0, 0);

    const hatchMesh = new THREE.Mesh(hatchGeo, hatchDoorMat);
    hatchMesh.position.set(0, 0, -0.035);
    doorBody.add(hatchMesh);

    // Central Circular Multi-Pane Viewport Window
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, roughness: 0.08, metalness: 0.95, transparent: true, opacity: 0.78
    });
    const winMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.10, 32), winMat);
    winMesh.rotation.x = Math.PI / 2;
    winMesh.position.set(0, 0.22, 0.01);
    const winBezel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 12, 32), ribMat);
    winBezel.position.set(0, 0.22, 0.05);
    doorBody.add(winMesh, winBezel);

    // Mechanical Rotary Dogging Latch Mechanism
    const latchGroup = new THREE.Group();
    latchGroup.position.set(0, -0.08, 0.06);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
    const latchWheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 10, 24), wheelMat);
    const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.024, 0.02), wheelMat);
    const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.26, 0.02), wheelMat);
    const centerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16), chromeMat);
    centerPin.rotation.x = Math.PI / 2;
    latchWheel.add(spoke1, spoke2, centerPin);
    latchGroup.add(latchWheel);

    const doggingRods = [];
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.92, roughness: 0.2 });
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.52, 8), rodMat);
      rod.rotation.z = angle + Math.PI / 2;
      const initDist = 0.38;
      rod.position.set(Math.cos(angle) * initDist, Math.sin(angle) * initDist, 0);
      latchGroup.add(rod);
      doggingRods.push({ mesh: rod, angle, initDist });
    }
    doorBody.add(latchGroup);

    // Pressure Equalization Valve & Crew Assist Handrail
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), wheelMat);
    valve.rotation.x = Math.PI / 2;
    valve.position.set(-0.35, -0.32, 0.05);
    const doorRail = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.65, 16), blueRailMat);
    doorRail.rotation.z = Math.PI / 2;
    doorRail.position.set(0, -0.48, 0.08);
    doorBody.add(valve, doorRail);

    // Left Hinge Stanchions
    const hinge1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 16), ribMat);
    hinge1.position.set(-0.78, 0.35, 0.05);
    const hinge2 = hinge1.clone();
    hinge2.position.set(-0.78, -0.35, 0.05);
    doorGroup.add(hinge1, hinge2);

    doorPivot.add(doorBody);
    doorGroup.add(doorPivot);

    // Luminous ISS Cabin Portal Light streaming into airlock when hatch swings open
    const portalLight = new THREE.PointLight(0xffedd5, 8, 20, 1.6);
    portalLight.position.set(0, 0, -1.2);
    doorGroup.add(portalLight);

    // Warm luminous Habitation Deck backdrop visible through opened doorway
    const cabinBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ color: 0xffedd5, toneMapped: false })
    );
    cabinBackdrop.position.set(0, 0, -1.4);
    doorGroup.add(cabinBackdrop);

    this.corridor.add(doorGroup);
    this.corridorDoor = { doorGroup, doorPivot, doorBody, latchWheel, doggingRods, led, portalLight };

    this.scene.add(this.corridor);
  }

  corridorStart() { return new THREE.Vector3(-1.1, 1.35, 0.2).add(CORRIDOR_OFFSET); }
  corridorEnd() { return new THREE.Vector3(-1.1, 1.35, -9.8).add(CORRIDOR_OFFSET); }

  updateCorridorDoor(q) {
    if (!this.corridorDoor) return;
    const { doorPivot, doorBody, latchWheel, doggingRods, led, portalLight } = this.corridorDoor;

    if (q < 0.38) {
      // Phase 1: Sealed & Locked
      doorPivot.rotation.y = 0;
      doorBody.position.z = 0;
      latchWheel.rotation.z = 0;
      doggingRods.forEach(r => {
        r.mesh.position.set(Math.cos(r.angle) * r.initDist, Math.sin(r.angle) * r.initDist, 0);
      });
      led.material.color.setHex(0xf59e0b); // Amber: pressure equalizing / sealed
      portalLight.intensity = 6;
    } else if (q < 0.54) {
      // Phase 2: Pressure Equalization & Mechanical Unlatching
      const u = (q - 0.38) / 0.16;
      const ease = u * u * (3 - 2 * u);
      latchWheel.rotation.z = ease * (Math.PI / 2);
      doggingRods.forEach(r => {
        const d = r.initDist - ease * 0.06;
        r.mesh.position.set(Math.cos(r.angle) * d, Math.sin(r.angle) * d, 0);
      });
      doorBody.position.z = ease * 0.02; // Unseats from gasket
      doorPivot.rotation.y = 0;
      led.material.color.setHex(0x10b981); // Emerald Green: unlatched
      portalLight.intensity = 6 + ease * 14;
    } else {
      // Phase 3: Smooth Side-Hinge Door Swing Open into Cabin
      latchWheel.rotation.z = Math.PI / 2;
      doggingRods.forEach(r => {
        const d = r.initDist - 0.06;
        r.mesh.position.set(Math.cos(r.angle) * d, Math.sin(r.angle) * d, 0);
      });
      doorBody.position.z = 0.02;
      led.material.color.setHex(0x10b981);

      const u = Math.min(1.0, (q - 0.54) / 0.38);
      const ease = u * u * (3 - 2 * u);
      doorPivot.rotation.y = ease * 1.74; // 100 degrees swing into cabin
      portalLight.intensity = 20 + ease * 60;
    }
  }

  createDragonCockpit(model) {
    // Disabled: SpaceX Crew Dragon exterior is a solid, aerodynamic pressurized hull.
    // Floating interior seats and monitor assemblies protruded through the bottom hull in space.
    return;
  }

  addHotspot(pos, stopId) {
    const el = document.createElement('div'); el.className = 'hot'; el.dataset.stop = stopId;
    const o = new CSS2DObject(el); o.position.copy(pos); this.cabin.add(o); this.hotspots.push(o);
  }

  /* ----------------------------- phases ----------------------------- */
  setPhase(phase) {
    this.phase = phase;
    const space = phase === 'intro' || phase === 'cabin';
    const toSun = phase === 'cabin' ? SUN.cabin : SUN.intro;
    this.space.visible = phase !== 'corridor';
    this.cabin.visible = phase === 'cabin'; this.hotspots.forEach((h) => { h.visible = phase === 'cabin'; });
    this.corridor.visible = phase === 'corridor';
    this.earth.position.copy(phase === 'cabin' ? WORLD.earth.cabin : WORLD.earth.intro);

    // Astronaut visibility: Once docked in cabin phase, astronauts have entered the ISS cabin,
    // so they are no longer inside the Dragon. Replay Arrival sets phase to 'intro' where they reappear.
    if (this.dragonCrew) {
      this.dragonCrew.visible = (phase !== 'cabin');
    }

    // Old Sun position in the sky
    const target = phase === 'cabin' ? CABIN.centre : WORLD.issPos;
    const sunDist = phase === 'cabin' ? 8200 : 5800;
    const sunPos = target.clone().addScaledVector(toSun, sunDist);

    this.sun.target.position.copy(target);
    this.sun.position.copy(sunPos);
    this.sun.castShadow = phase === 'cabin';
    this.sun.intensity = phase === 'cabin' ? 2.4 : 2.2;
    this.sun.color.set(phase === 'cabin' ? 0xffe6c4 : 0xfff3e0);

    // Old Sun flare (the beloved Sun in the sky)
    this.flare.position.copy(sunPos);
    this.flare.visible = true;

    // Physically align Solar System so the central Old Sun is at sunPos and Earth sits precisely on Orbit 3
    if (this.solarSystem) {
      this.solarSystem.alignWithSunAndEarth(sunPos, this.earth.position);
    }
    if (this.earthUniforms) {
      this.earthUniforms.uSunDir.value.copy(toSun);
    }
    if (this.atmUniforms) {
      this.atmUniforms.uSunDir.value.copy(toSun);
    }
    this.hemi.intensity = phase === 'cabin' ? 0.5 : 0.08;
    this.fill.intensity = phase === 'cabin' ? 0.45 : 0.0;
    this.accents.forEach((l) => { if (phase === 'cabin') { if (!l.parent) this.cabin.add(l); } else if (l.parent) l.parent.remove(l); });
    this.scene.environment = phase === 'cabin' || phase === 'corridor' ? this.envTex : null;
    if (this.issSpin) {
      this.issSpin.visible = (phase !== 'cabin');
    }
  }

  update(dt, t, cam, ext = false) {
    this.t = t;
    this.issSpin.rotation.y += dt * 0.02; this.issSpin.rotation.x = Math.sin(t * 0.05) * 0.03;

    // 1. Continuous Physical 51.6° Inclined ISS Orbit around the rotating Earth:
    // Implements the authentic NORAD Keplerian ground track matching user specifications:
    // Route 1 (Orbit 1):
    //   - Starts in South Pacific Ocean at southernmost apex (lat -51.6°, lon -138°)
    //   - Moves Northeast crossing Equator over South America (Brazil & Amazon) into Atlantic
    //   - Continues across Atlantic over Europe (France, Germany) and European Russia (apex +51.6°)
    //   - Turns Southeast over Asia (China, India, Bangladesh, Bay of Bengal)
    //   - Crosses Equator into Indian Ocean, passing south of Australia and completing loop in South Pacific.
    // Route 2 (Westward-shifted subsequent pass as Earth rotates underneath):
    //   - Northern boundary over North Atlantic / northern Canada (+51.6°)
    //   - Travels Southeast over US East Coast, Caribbean, across Atlantic
    //   - Crosses Equator over Central & Southern Africa (Congo, South Africa)
    //   - Continues Southeast over Indian Ocean to Southern Ocean south of Australia (-51.6°).
    const inc = 51.6 * (Math.PI / 180);
    const T_orbit = 145.0; // 145 seconds per orbit in simulation (gentle & slightly reduced speed per user request)
    const wOrb = (2 * Math.PI) / T_orbit;
    const wEarth = wOrb * (92 / 1440); // Earth axial rotation: 360°/24h vs ISS 92m orbit (~23° shift per pass)
    const lambdaNode0 = -48.0 * (Math.PI / 180); // Ascending node over Brazil (-48° W)

    this.orbitTime = (this.orbitTime !== undefined ? this.orbitTime : 0) + dt;
    const tOrb = this.orbitTime;

    // Orbital argument of latitude u (starts at -pi/2 in South Pacific):
    const u = -Math.PI / 2 + wOrb * tOrb;
    this.orbitAngle = u;

    // Sub-satellite latitude in [-51.6°, +51.6°]:
    const latRad = Math.asin(Math.sin(inc) * Math.sin(u));
    const latDeg = latRad * (180 / Math.PI);

    // Orbital right ascension in the inclined orbital plane:
    const raOrb = Math.atan2(Math.sin(u) * Math.cos(inc), Math.cos(u));

    // Sub-satellite longitude on the rotating Earth:
    let lonRad = (lambdaNode0 + raOrb - wEarth * tOrb) % (Math.PI * 2);
    if (lonRad > Math.PI) lonRad -= Math.PI * 2;
    if (lonRad < -Math.PI) lonRad += Math.PI * 2;
    const lonDeg = lonRad * (180 / Math.PI);

    // Orbital velocity track azimuth heading:
    const vLat = Math.cos(u) * Math.sin(inc);
    const cosLat = Math.cos(latRad);
    const vLon = (Math.cos(inc) / (cosLat * cosLat) - (wEarth / wOrb)) * cosLat;
    const heading = (Math.atan2(vLon, vLat) + Math.PI * 2) % (Math.PI * 2);

    // Save live physical coordinates on the World instance for telemetry lookup
    this.currentSubLat = latDeg;
    this.currentSubLon = lonDeg;
    this.currentHeading = heading * (180 / Math.PI);

    // 2. Realistic Earth positioning:
    // In exterior views (station, spacewalk, earth orbit), Earth sits directly below the ISS station!
    // Inside cabin, Earth sits right outside the Cupola window!
    if (this.phase === 'intro') {
      this.earth.position.copy(WORLD.earth.intro);
    } else if (ext) {
      this.earth.position.copy(WORLD.earth.station);
    } else {
      this.earth.position.copy(WORLD.earth.cabin);
    }

    // 3. Ground-Truth 3D Globe Orientation:
    // Mathematically rotates earthMesh so the true sub-satellite point (lat, lon) is precisely
    // at the observer/station Nadir, and the ground-track heading aligns with the station flight axis!
    if (this.earthMesh) {
      const earthPos = this.earth.position;
      let nadirWorld, fwdWorld;
      if (this.phase === 'cabin' && !ext) {
        _vEarthNadir.copy(_cupolaPos).sub(earthPos).normalize();
        _vEarthFwd.set(0, 0, -1);
        nadirWorld = _vEarthNadir;
        fwdWorld = _vEarthFwd;
      } else {
        if (this.issSpin) this.issSpin.getWorldPosition(_issPosTmp);
        else _issPosTmp.set(-60, 24, -260);
        _vEarthNadir.copy(_issPosTmp).sub(earthPos).normalize();
        _vEarthFwd.set(0, 0, 1);
        nadirWorld = _vEarthNadir;
        fwdWorld = _vEarthFwd;
      }

      // Local sphere basis vectors at (latRad, lonRad):
      _rL.set(
        Math.cos(latRad) * Math.cos(lonRad),
        Math.sin(latRad),
        -Math.cos(latRad) * Math.sin(lonRad)
      ).normalize();

      _northL.set(
        -Math.sin(latRad) * Math.cos(lonRad),
        Math.cos(latRad),
        Math.sin(latRad) * Math.sin(lonRad)
      ).normalize();

      _eastL.set(
        -Math.sin(lonRad),
        0,
        -Math.cos(lonRad)
      ).normalize();

      _trackDirL.copy(_northL).multiplyScalar(Math.cos(heading)).addScaledVector(_eastL, Math.sin(heading)).normalize();
      _sideL.crossVectors(_trackDirL, _rL).normalize();

      // World basis vectors:
      _fwdProjW.copy(fwdWorld).addScaledVector(nadirWorld, -fwdWorld.dot(nadirWorld)).normalize();
      _sideW.crossVectors(_fwdProjW, nadirWorld).normalize();

      // Change of basis: M_world * M_local^T
      _mLocal.makeBasis(_sideL, _trackDirL, _rL);
      _mWorld.makeBasis(_sideW, _fwdProjW, nadirWorld);
      _mLocalTransposed.copy(_mLocal).transpose();
      _mRot.multiplyMatrices(_mWorld, _mLocalTransposed);

      if (this.earthTilt) this.earthTilt.rotation.set(0, 0, 0);
      if (this.earthSpin) this.earthSpin.rotation.set(0, 0, 0);
      this.earthMesh.quaternion.setFromRotationMatrix(_mRot);
      this.earth.updateMatrixWorld(true);
    }

    // 5. Continuous ISS Day/Night orbital revolution around Earth:
    if (this.phase === 'cabin' || ext) {
      if (ext) {
        _sunDir.set(
          -0.64 + Math.sin(tOrb * 0.2) * 0.02,
          0.032 + Math.cos(tOrb * 0.2) * 0.01,
          -0.76
        ).normalize();
      } else {
        _sunDir.set(
          0.26 + Math.sin(tOrb * 0.2) * 0.03,
          0.065 + Math.cos(tOrb * 0.2) * 0.015,
          -0.963
        ).normalize();
      }

      if (this.earthUniforms) {
        this.earthUniforms.uSunDir.value.copy(_sunDir);
      }
      if (this.atmUniforms) {
        this.atmUniforms.uSunDir.value.copy(_sunDir);
      }

      // Update physical directional sunlight & solar flare
      const target = this.phase === 'cabin' ? (ext ? WORLD.issPos : CABIN.centre) : WORLD.issPos;
      const sunDist = this.phase === 'cabin' ? (ext ? 5800 : 8200) : 5800;
      _sunPos.copy(target).addScaledVector(_sunDir, sunDist);
      this.sun.position.copy(_sunPos);
      this.flare.position.copy(_sunPos);

      // Dynamic Day/Night solar intensity & twilight transition
      const sunElevation = _sunDir.y;
      const dayFactor = THREE.MathUtils.smoothstep(sunElevation, -0.12, 0.22);

      if (this.phase === 'cabin' && !ext) {
        this.sun.intensity = THREE.MathUtils.lerp(0.12, 2.4, dayFactor);
        this.flare.scale.setScalar(THREE.MathUtils.smoothstep(sunElevation, -0.05, 0.15));
        this.flare.visible = sunElevation > -0.08;
      } else {
        this.sun.intensity = THREE.MathUtils.lerp(0.85, 3.4, dayFactor);
        this.flare.scale.setScalar(1.0);
        this.flare.visible = true;
      }

      // Stable celestial solar system alignment (prevents rapid tumbling/spinning of orbit lines!)
      if (this.solarSystem && (!this._solarAligned || ext !== this._lastExt)) {
        this._solarAligned = true;
        this._lastExt = ext;
        this.solarSystem.alignWithSunAndEarth(_sunPos, this.earth.position);
      }
    }

    // 4. Update Solar System planetary orbits (Keplerian motion & axial spins)
    if (this.solarSystem) {
      this.solarSystem.update(dt, t);
    }

    if (cam) {
      if (this.earthUniforms) this.earthUniforms.uCameraPos.value.copy(cam.position);
      if (this.atmUniforms) this.atmUniforms.uCameraPos.value.copy(cam.position);
      this.stars.position.copy(cam.position);
      if (this.mwMesh) this.mwMesh.position.copy(cam.position);
    }

    // Duplicate ISS station is visible ONLY in exterior views (spacewalk EVA, station view, or intro)
    // When inside the ISS cabin looking out the Cupola window, this.issSpin is hidden!
    if (this.issSpin) {
      this.issSpin.visible = (this.phase !== 'cabin' || !!ext);
    }

    // Pure, pristine Earth: All artificial grid lines, ground tracks, and markers
    // have been permanently removed per user request for 100% natural, realistic Earth.

    // ------------------------------------------------------------------------
    // NASA / DoD Navstar GPS III Satellite Orbiting below ISS
    // Circular orbit around Earth in exterior view, and visible gliding beneath
    // the ISS across the 7-window Cupola nadir Earth horizon!
    // ------------------------------------------------------------------------
    if (this.gpsSatellite) {
      this.gpsAngle = (this.gpsAngle || 0.85) + dt * 0.14;
      const angle = this.gpsAngle;

      // Pulse the cyan navigation strobe beacon
      if (this.gpsBeacon) {
        this.gpsBeacon.intensity = 2.5 + Math.sin(t * 6.0) * 1.8;
      }

      const ep = this.earth.position;
      const isCabin = this.phase === 'cabin' && !ext;

      if (isCabin) {
        // Cupola observation view:
        // GPS Satellite passes gracefully underneath the ISS over the blue Earth horizon!
        // Camera is at (0, 13.5, -56.5). Window looks towards -Z and downward at Earth.
        // Sweeps directly through the central 7-window Cupola dome and bottom Nadir window
        const sweep = (angle * 0.7) % (Math.PI * 2);
        const x = Math.sin(sweep) * 18; // centered between -18 and +18: perfectly framed in front Cupola window
        const y = -14 + Math.cos(sweep * 2.0) * 2.8; // directly over the blue Earth horizon
        const z = -88 - Math.cos(sweep) * 12; // crisp, clear close-range viewing outside the glass

        this.gpsSatellite.position.set(x, y, z);
        this.gpsSatellite.scale.setScalar(8.5); // 8.5 units: clearly visible with gold bus, antennas & blue solar panels

        // Satellite points its L-band antenna array down toward Earth
        const dirToEarth = ep.clone().sub(this.gpsSatellite.position).normalize();
        this.gpsSatellite.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirToEarth);
        this.gpsSatellite.rotateY(angle * 0.4);
      } else {
        // Exterior View (Station / EVA):
        // Authentic circular orbit around Earth, close to Earth and well below the ISS!
        // ISS is at (-60, 24, -260). Earth center is ep (-60, -6180, -520).
        // Earth radius is 5000 (top surface at y = -1180).
        // Satellite orbits Earth at altitude 360 - 480 above Earth (y = -820 to -700, ~780 below ISS)!
        // Positioned directly in the nadir sector beneath the ISS over the blue Earth!
        const sweep = angle * 0.65;
        const ox = Math.sin(sweep) * 260;
        const oz = Math.cos(sweep) * 220;
        const oy = 5420 - Math.pow(Math.sin(sweep), 2.0) * 240;

        const sx = -60 + ox;
        const sy = ep.y + oy; // stays at y = -1000 to -760 (between Earth surface -1180 and ISS +24)
        const sz = -260 + oz;

        this.gpsSatellite.position.set(sx, sy, sz);
        this.gpsSatellite.scale.setScalar(28.0); // 28.0 units: distinctly visible against Earth beneath ISS

        // Nadir Earth-pointing attitude
        const dirToEarth = ep.clone().sub(this.gpsSatellite.position).normalize();
        this.gpsSatellite.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirToEarth);
        this.gpsSatellite.rotateY(sweep * 0.3);
      }
    }

    // Authentic Moon orbital revolution around the real Earth
    if (this.moon) {
      const moonAngle = t * 0.015 + 1.6;
      const moonDist = 7400;
      this.moon.position.set(
        this.earth.position.x + Math.cos(moonAngle) * moonDist,
        this.earth.position.y + Math.sin(moonAngle) * 2200 + 3800,
        this.earth.position.z + Math.sin(moonAngle) * moonDist
      );
      this.moon.rotation.y += dt * 0.006;
    }

    // Frustum/proximity culling: Only update RWS monitor screens when inside cabin and near forward flight deck
    if (this.rws && this.rws.update && this.phase === 'cabin' && cam && cam.position.z < -20) {
      this.rws.update(dt, t);
    }
    if (this.phase === 'cabin') {
      if (this.dust) {
        this.dust.position.y = (this.dust.position.y + dt * 0.12) % 2.0;
        this.dust.rotation.y += dt * 0.006;
      }
      this.shafts.forEach((s) => s.children.forEach((m) => { m.material.opacity = s.userData.base * (0.8 + 0.2 * Math.sin(t * 0.6 + s.userData.ph)); }));
    }
  }

  getNadirGeoCoords() {
    if (this.currentSubLat !== undefined && this.currentSubLon !== undefined) {
      return { lat: this.currentSubLat, lon: this.currentSubLon };
    }
    if (!this.earthMesh || !this.earth) return { lat: 0, lon: 0 };
    this.earthMesh.updateMatrixWorld(true);
    const earthCenter = new THREE.Vector3();
    this.earth.getWorldPosition(earthCenter);
    let nadirDir;
    const ext = this.rig && (this.rig.mode === 'ext' || this.rig.mode === 'spacewalk' || this.rig.mode === 'earth');
    if (this.phase === 'cabin' && !ext) {
      const cupolaPt = new THREE.Vector3(0, 13.5, -56.5);
      nadirDir = cupolaPt.sub(earthCenter).normalize();
    } else {
      const issPos = new THREE.Vector3();
      if (this.issSpin) {
        this.issSpin.getWorldPosition(issPos);
      } else {
        issPos.set(-60, 24, -260);
      }
      nadirDir = issPos.sub(earthCenter).normalize();
    }
    const R = (this.earthMesh.geometry && this.earthMesh.geometry.parameters && this.earthMesh.geometry.parameters.radius) || 5000;
    const surfacePtWorld = earthCenter.clone().addScaledVector(nadirDir, R);
    const localPt = this.earthMesh.worldToLocal(surfacePtWorld).normalize();
    const lat = Math.asin(THREE.MathUtils.clamp(localPt.y, -1, 1)) * (180 / Math.PI);
    const lon = Math.atan2(-localPt.z, localPt.x) * (180 / Math.PI);
    return { lat, lon };
  }
}
