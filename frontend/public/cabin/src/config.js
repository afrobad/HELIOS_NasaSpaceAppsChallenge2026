import * as THREE from 'three';
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const trim = (u) => u.replace(/\/+$/, '');

/**
 * H.E.L.I.O.S project integration (the NASA Space Apps project: React frontend + FastAPI backend).
 *   appUrl  = the running frontend   (docs: npm run dev -> http://localhost:3000)
 *   apiUrl  = the running backend    (docs: uvicorn ... --port 8000)
 * Override without editing code:  index.html?app=http://host:3000&api=http://host:8000&live=0
 */
export const HELIOS = {
  appUrl: trim(Q.get('app') || (typeof location !== 'undefined' && location.origin && !location.origin.startsWith('file:') ? location.origin : 'http://localhost:3000')),
  apiUrl: trim(Q.get('api') || (typeof location !== 'undefined' && location.hostname ? `${location.protocol}//${location.hostname}:8000` : 'http://localhost:8000')),
  wsPath: '/ws/telemetry',
  /** Real pages shown on the wall monitors (iframes projected onto the 3D screens). */
  pages: { dashboard: '/?embed=1&cabin=1', mcc: '/mcc?embed=1&cabin=1' },
  liveFrames: Q.get('live') !== '0',
  /** If a telemetry message has no crew id, it is applied to this crew member. */
  primary: 'cmd',
  /** Seconds without a message before a crew member falls back to simulated values. */
  staleAfter: 3,
};

export const CONFIG = {
  brand: 'HELIOS // ISS DECK',
  /** Where "← Console" goes (the real H.E.L.I.O.S cockpit). */
  consoleUrl: HELIOS.appUrl,
  /** Folder (relative to index.html) scanned for GLB/GLTF files (via model/manifest.json). */
  modelDir: 'model/',
  /** Used only if manifest.json is missing. */
  fallbackFiles: [
    'animated_floating_astronaut_in_space_suit_loop.glb', 'iss.glb',
    'monitor__computer__realistic_computer_monitor.glb', 'old_nasa_style_computer_console.glb', 'sci-fi_computer_desk_console.glb',
    'space_ship_interior.glb',
  ],
  /**
   * Auto-classification rules (first match wins). Override any slot by name here:
   *   override: { astronaut: 'my_astro.glb' }
   */
  override: {},
  rules: [
    ['satellite', /gps|satellite/i],
    ['astronaut', /astronaut|spacesuit|suit/i],
    ['earth', /earth|planet/i],
    ['iss', /(^|[^a-z])iss([^a-z]|$)|station/i],
    ['corridorModel', /inside_spaceship|spaceship_interior/i],
    ['monitor', /monitor|display|screen/i],
    ['nasaConsole', /old_nasa_style|nasa.*console/i],
    ['console', /console|desk/i],
  ],

  // ----- TUNABLES -----
  scroll: { wheel: 0.00008, touch: 0.0012, damping: 0.12 },       // smooth, calibrated scroll feel (zero-jump)
  sway: { amp: 0.11, roll: 0.012 },                                // zero-g camera drift
  look: { mouseYaw: 0.2, mousePitch: 0.12, dragYaw: 0.9, dragPitch: 0.5 },
  bloom: { strength: 0.25, radius: 0.32, threshold: 0.82 },
  crewDrift: 0.35,                                                 // astronaut idle drift speed
  crewScale: 7.6,                                                  // astronaut size (world units)
  dragThrow: 0.9,                                                  // inertia after releasing a dragged crew member
};

/**
 * Cabin geometry: a LONG, BIG ISS-style module (axis = Z). Hatch at +Z, cockpit (cupola bay) at -Z.
 * Cross-section is a near-rectangular octagon (see `profile`, x/y pairs). Everything else is derived from these numbers.
 */
export const CABIN = {
  centre: V(0, 14, 0),
  floorY: 0, ceilY: 28,
  halfX: 15, halfZ: 56,
  profile: [[-13, 0], [13, 0], [15, 2.5], [15, 25.5], [13, 28], [-13, 28], [-15, 25.5], [-15, 2.5]],
  /** Cockpit / cupola bay that sticks out of the front bulkhead (frustum: near rect -> far rect). */
  bay: { depth: 20, near: { hw: 12, y0: 4, y1: 24 }, far: { hw: 8, y0: 8, y1: 20 } },
  window: { c: V(0, 14, -76), w: 16, h: 12 },
  bounds: { min: V(-11, 5, -36), max: V(11, 24, 50) },       // crew roaming volume
};

/** Sun directions: `toSun` points from the scene towards the sun. */
export const SUN = {
  intro: V(-0.62, 0.30, -0.72).normalize(),
  cabin: V(0.26, 0.065, -0.963).normalize(),
};

/** Exterior world poses per phase. */
export const WORLD = {
  issPos: V(-60, 24, -260),
  issSize: 108,
  earthR: 5000,
  earth: {
    intro: V(-100, -6050, -520),
    cabin: V(0, -4950, -7025),   // top limb of the Earth sits right at the horizon of the cupola windows
    station: V(-60, -6180, -520), // Earth sits underneath exterior ISS at realistic Low Earth Orbit (LEO) altitude (gracefully curved horizon)
  },
};

export const INTRO = {
  duration: 18.0,
  start: V(160, 90, 320), mid: V(80, 38, 160), end: V(22, 0, 52),
};

/** Wall monitors: pos = point on the +X wall surface, screen faces into the cabin. */
export const MONITORS = [
  { id: 'board',  page: 'dashboard', label: 'MAIN DASHBOARD',      pos: V(15, 13, 38),  rotY: -Math.PI / 2, width: 13 },
  { id: 'alerts', page: 'mcc',       label: 'MISSION CONTROL (MCC)', pos: V(15, 13, -10), rotY: -Math.PI / 2, width: 13 },
];

/**
 * COCKPIT & HABITATION CONSOLES (sci-fi desk GLB).
 * Shifted to the sides of the cabin facing the central walkway, keeping the center
 * wide open for the ISS Robotic Workstation (RWS) in front of the Cupola (ZERO overlap).
 */
export const CONSOLES = [
  { id: 'side-left',  pos: V(-10.2, 0, -32), rotY: Math.PI / 2 - 0.1,  width: 9.5 },
  { id: 'side-right', pos: V(10.2, 0, -32),  rotY: -Math.PI / 2 + 0.1, width: 9.5 },
];

/**
 * Exactly 4 astronauts. `slug` = the canonical astronaut_id used by the H.E.L.I.O.S backend
 * WebSocket `/ws/telemetry` (field: `astronaut_id` in every TELEMETRY_FRAME packet).
 * `match` = extra words used to recognise this person in a telemetry message.
 *
 * Verified against `data/nasa_astronaut_baselines.json` and `backend/app/streaming/telemetry_feeder.py`.
 * Baseline resting heart rates and SpO2 from the NASA OSDR spaceflight baseline profiles.
 */
export const CREW = [
  {
    id: 'cmd', slug: 'AST-01_COMMANDER', call: 'CDR', name: 'Cmndr Haley', role: 'Mission Commander',
    match: ['commander', 'cdr', 'ast-01', 'c001', 'ast-01_commander', 'haley'],
    hr: 62, spo2: 98.2, resp: 15, ready: 91, off: false,
    pos: V(-3, 12, 36), yaw: 2.6,  flip: false,
  },
  {
    id: 'plt', slug: 'AST-02_PILOT',     call: 'PLT', name: 'Pilot Chris', role: 'Spacecraft Pilot',
    match: ['pilot', 'plt', 'ast-02', 'c002', 'ast-02_pilot', 'chris'],
    hr: 58, spo2: 98.5, resp: 14, ready: 92, off: false,
    pos: V(6, 12, -33), yaw: -1.2, flip: false,
  },
  {
    id: 'med', slug: 'AST-03_MEDICAL',   call: 'MED', name: 'Dr. Sian', role: 'Chief Medical Officer',
    match: ['medical', 'med', 'doctor', 'ast-03', 'c003', 'ast-03_medical', 'sian'],
    hr: 66, spo2: 98.0, resp: 14, ready: 90, off: false,
    pos: V(7, 8, 6),  yaw: -2.2, flip: false,
  },
  {
    id: 'mis', slug: 'AST-04_ENGINEER',  call: 'MS',  name: 'Specialist Leo', role: 'Systems Flight Engineer',
    match: ['engineer', 'specialist', 'ms', 'ast-04', 'c004', 'ast-04_engineer', 'ast-04_mission_specialist', 'leo'],
    hr: 64, spo2: 98.3, resp: 15, ready: 88, off: false,
    pos: V(4, 10, 24),  yaw: 1.4,  flip: false,
  },
];

export const STOPS = [
  { id: 'helmet',   title: 'Suit HUD // Visor Telemetry',           pos: V(0, 12.2, 48),    look: V(0, 12.2, -56),    fov: 68 },
  { id: 'corridor', title: 'Habitation Module Corridor',           pos: V(0, 12.5, 42),    look: V(0, 12.5, -56),    fov: 66 },
  { id: 'board',    title: 'Primary Biometrics Console',           pos: V(1.5, 13.0, 38),  look: V(15.0, 13.0, 38),  fov: 62 },
  { id: 'cargo',    title: 'ECLSS Cargo & Plant Habitat',          pos: V(2.0, 12.0, 16),  look: V(-13.0, 11.5, 16), fov: 64 },
  { id: 'alerts',   title: 'Earth MCC Telemetry Downlink',         pos: V(1.5, 13.0, -10), look: V(15.0, 13.0, -10), fov: 62 },
  { id: 'cockpit',  title: 'Forward Flight Deck',                  pos: V(0, 13.0, -28),   look: V(0, 11.5, -56),    fov: 66 },
  { id: 'consoles', title: 'ISS Robotic Workstation (RWS)',        pos: V(0, 11.2, -48),   look: V(0, 9.8, -62.0),   fov: 68 },
  { id: 'window',   title: 'ISS 7-Window Cupola Observation Dome', pos: V(0, 13.5, -58),   look: V(0, 14.0, -76.0),  fov: 75 },
  { id: 'back',     title: 'Aft Bulkhead Module Overview',         pos: V(0, 12.5, -30),   look: V(0, 12.5, 56),     fov: 70 },
  { id: 'return',   title: 'Airlock Hatch Nominal Cruise',         pos: V(0, 12.2, 46),    look: V(0, 12.2, 56),     fov: 68 },
];
