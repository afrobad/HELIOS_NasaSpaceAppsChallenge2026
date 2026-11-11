import * as THREE from 'three';
if (typeof window !== 'undefined') window.THREE = THREE;
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG, STOPS, HELIOS } from './config.js';
import { loadAssets } from './assets.js';
import { Screens } from './screens.js';
import { World } from './world.js';
import { Crew } from './astronauts.js';
import { Rig } from './rig.js';
import { createPost } from './post.js';
import { HUD } from './hud.js';
import { Director } from './director.js';
import { EVA } from './eva.js';
import { Ambience } from './audio.js';
import { tickVitals } from './data.js';
import { startTelemetry, telemetry } from './telemetry.js';
import { LiveScreens } from './livescreens.js';
import { $ } from './util.js';

const showError = (e) => { console.error(e); const el = $('ld-err'); if (el) el.textContent = 'Something went wrong:\n' + (e && e.message ? e.message : e); };
addEventListener('error', (ev) => showError(ev.error || ev.message));
addEventListener('unhandledrejection', (ev) => showError(ev.reason));

async function boot() {
  /* Safety loader dismiss fallback: Never let user get stuck on loading screen */
  const forceDismissTimer = setTimeout(() => {
    console.warn('[HELIOS] Safety loader timeout reached: forcing cabin display');
    document.body.classList.remove('booting');
    if ($('loader')) $('loader').style.display = 'none';
  }, 35000);

  const stage = $('stage');

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: false, powerPreference: 'high-performance' });
  let pr = Math.min(window.devicePixelRatio || 1, 1.25);
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer(); labels.setSize(innerWidth, innerHeight);
  Object.assign(labels.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '5' });
  document.body.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1.0, 120000);
  window.camera = camera;
  scene.add(camera);

  /* ---------- assets ---------- */
  const log = $('ld-log');
  const assets = await loadAssets(
    (p) => { $('ld-bar').style.width = (p * 100).toFixed(1) + '%'; },
    (label, status) => { const li = document.createElement('li'); li.className = status === 'generated' ? 'gen' : ''; li.innerHTML = `<b>${status === 'generated' ? 'GENERATED' : 'LOADED'}</b>${label}`; log.appendChild(li); },
  );
  $('ld-text').textContent = 'BUILDING CABIN…';
  await new Promise((r) => setTimeout(r, 30));

  const screens = new Screens();
  const world = new World(scene, renderer, assets, screens);
  window.world = world;
  const crew = new Crew(scene, assets, camera);
  const post = createPost(renderer, scene, camera);
  const hud = new HUD();
  window.hud = hud;
  const audio = new Ambience();
  window.audio = audio;
  const rig = new Rig(camera, renderer.domElement);
  window.rig = rig;
  const director = new Director({ camera, world, rig, post, hud, audio });
  window.director = director;
  const eva = new EVA({ world, crew, rig, post, hud, assets, director });
  const live = new LiveScreens({ world, crew, camera, rig });      // real H.E.L.I.O.S pages on the wall monitors
  window.live = live;
  const wsUrl = startTelemetry();                                   // real crew data from the backend (falls back to simulation)

  rig.onStop = (i) => hud.setStop(i);
  hud.onNav((i) => {
    closeCrew();
    if (i === 0) {
      const commander = crew.members.find((m) => !m.out) || crew.members[0];
      if (commander) {
        lookThrough(commander);
        return;
      }
    }
    if (crewView) {
      leaveHelmet();
    }
    rig.goTo(i);
  });
  window.HELIOS = { THREE, scene, camera, renderer, world, crew, rig, director, eva, post, hud, assets, CONFIG, STOPS, telemetry, live, cfg: HELIOS, wsUrl }; // handy for tuning in the console

  // Automated Interactive Project Tour Bridge
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'TOUR_NAVIGATE_CABIN') {
      const stopId = e.data.stopId;
      const duration = typeof e.data.duration === 'number' ? e.data.duration : 1.2;

      // Clean up photo preview modal and viewfinder when moving to any other stop or closing
      if (stopId !== 'photo') {
        $('photo-preview-modal')?.classList.add('hidden');
        $('geotag-modal')?.classList.add('hidden');
        if (renderer && renderer.domElement) renderer.domElement.style.filter = '';
      }

      if (stopId === 'close_modals') {
        return;
      }

      if (stopId === 'exterior' || stopId === 'orbit') {
        if (typeof leaveHelmet === 'function') leaveHelmet();
        if (typeof eva !== 'undefined') {
          // Topside view of ISS looking down at ISS and Earth
          eva.extPitch = 0.95; // Looking down from above (+Y)
          eva.extYaw = 0.15;
          eva.extDistance = 210;
          eva.show('earth');
        }
      } else if (stopId === 'photo') {
        if (typeof eva !== 'undefined' && (rig.mode === 'ext' || eva.view !== 'cabin')) {
          eva.leave();
        }
        if (typeof leaveHelmet === 'function') leaveHelmet();
        const cupolaIdx = STOPS.findIndex((s) => s.id === 'window' || s.title?.includes('Cupola'));
        if (cupolaIdx >= 0 && typeof rig !== 'undefined') {
          rig.goTo(cupolaIdx, duration);
        }
        // Demo photo capture: open camera viewfinder, then automatically snap photo
        $('photo-preview-modal')?.classList.add('hidden');
        setTimeout(() => {
          $('btn-geotag')?.click();
          setTimeout(() => {
            $('btn-snap-photo')?.click();
          }, 1100);
        }, 500);
      } else if (stopId === 'helmet') {
        if (typeof eva !== 'undefined' && (rig.mode === 'ext' || eva.view !== 'cabin')) {
          eva.leave();
        }
        const commander = (crew && crew.members && (crew.members.find((m) => !m.out) || crew.members[0])) || null;
        if (commander && typeof lookThrough === 'function') {
          lookThrough(commander);
        }
      } else if (stopId === 'corridor_flythrough') {
        if (typeof eva !== 'undefined' && (rig.mode === 'ext' || eva.view !== 'cabin')) {
          eva.leave();
        }
        if (typeof leaveHelmet === 'function') leaveHelmet();
        if (typeof rig !== 'undefined') {
          rig.smoothFlyThrough(1, 5, duration);
        }
      } else {
        if (typeof eva !== 'undefined' && (rig.mode === 'ext' || eva.view !== 'cabin')) {
          eva.leave();
        }
        if (typeof leaveHelmet === 'function') leaveHelmet();
        const idx = STOPS.findIndex((s) => s.id === stopId);
        if (idx >= 0 && typeof rig !== 'undefined') {
          rig.goTo(idx, duration);
        }
      }
    }
  });

  /* ---------- UI wiring ---------- */
  const stopFor = { board: 'board', alerts: 'alerts', window: 'window' };
  document.addEventListener('click', (e) => {
    const h = e.target.closest && e.target.closest('.hot'); if (!h) return;
    const i = STOPS.findIndex((s) => s.id === (stopFor[h.dataset.stop] || h.dataset.stop)); if (i >= 0) rig.goTo(i);
  });
  $('btn-skip').addEventListener('click', () => {
    audio.playClick();
    director.skip(0);
  });
  $('btn-replay').addEventListener('click', () => {
    audio.whoosh();
    leaveHelmet();
    eva.reset();
    director.play();
  });
  const viewSel = $('view-select');
  const helmetSel = $('helmet-select');
  const deploySel = $('deploy-select');
  const legacySel = $('eva-select');
  const sel = viewSel || legacySel;

  const syncSel = () => {
    if (viewSel) {
      if (crewView) viewSel.value = 'v:pov';
      else viewSel.value = 'v:' + eva.view;
    }
    if (legacySel) legacySel.value = 'v:' + eva.view;
  };

  // Instruction HUD box (Astronaut flight controls inside cabin, Station navigation / Spacewalk outside)
  let hudDismissed = false;
  let lastHudStateKey = '';
  const achHud = $('astro-control-hud');
  const achName = $('ach-name');
  const achDesc = $('ach-desc');

  const updateInstructionHud = (forceShow = false) => {
    if (!achHud || !achName || !achDesc) return;
    if (world.phase === 'intro' || world.phase === 'corridor') {
      achHud.classList.add('hidden');
      return;
    }
    if (forceShow) hudDismissed = false;
    if (hudDismissed) {
      achHud.classList.add('hidden');
      return;
    }

    const inCabin = world.phase === 'cabin' && rig.mode !== 'ext' && eva.view === 'cabin' && !document.body.classList.contains('outside');

    if (inCabin) {
      const m = crew.selected || (rig.mode === 'crew' ? (rig.focusM || hud.helmet) : null);
      if (m && !m.out) {
        const stateKey = `cabin:${m.c.id}`;
        if (stateKey !== lastHudStateKey) {
          lastHudStateKey = stateKey;
          const astName = m.c.name ? `${m.c.name.toUpperCase()} · ` : '';
          achName.textContent = `${m.c.call} · ${astName}${m.c.role.toUpperCase()}`;
          achDesc.innerHTML = `<kbd class="highlight">SCROLL YOUR MOUSE</kbd> EXPLORE DECK · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> TRAVEL · <kbd>Z</kbd>/<kbd>X</kbd> ALTITUDE · <kbd>Q</kbd>/<kbd>E</kbd> 360° ROTATE · <kbd>R</kbd>/<kbd>F</kbd> PITCH · <kbd>MOUSE</kbd> DRAG`;
        }
        achHud.classList.remove('hidden');
      } else {
        // In cabin, instruction box stays visible until the user clicks ✕
        const stateKey = 'cabin:tour';
        if (stateKey !== lastHudStateKey) {
          lastHudStateKey = stateKey;
          achName.textContent = `ISS FLIGHT DECK // 6-DOF CAMERA FLIGHT`;
          achDesc.innerHTML = `<kbd>W</kbd><kbd>S</kbd> FRONT/BACK · <kbd>A</kbd><kbd>D</kbd> LEFT/RIGHT · <kbd>Q</kbd><kbd>E</kbd> ROTATE · <kbd>SPACE</kbd>/<kbd>SHIFT</kbd> UP/DOWN · <kbd>MOUSE</kbd> LOOK · <kbd>SCROLL</kbd> STOPS`;
        }
        achHud.classList.remove('hidden');
      }
    } else {
      // Outside of cabin view (Orbit Station or Spacewalk EVA)
      // Astronaut is ONLY shown outside if explicitly deployed by the user!
      const hasWalkers = eva.hasActiveWalkers && eva.hasActiveWalkers();
      const activeWalker = hasWalkers && eva.getActiveWalker ? eva.getActiveWalker() : null;

      if (hasWalkers) {
        const titleRole = activeWalker ? `${activeWalker.member.c.call} · ${(activeWalker.member.c.name || activeWalker.member.c.role).toUpperCase()}` : 'ASTRONAUT DEPLOYED';
        const stateKey = `eva:${titleRole}`;
        if (stateKey !== lastHudStateKey) {
          lastHudStateKey = stateKey;
          achName.textContent = `EVA SPACEWALK // ${titleRole}`;
          achDesc.innerHTML = `ZERO-G FLIGHT: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> TRAVEL · <kbd>Z</kbd>/<kbd>X</kbd> ALTITUDE · <kbd>Q</kbd>/<kbd>E</kbd> ROTATE · <kbd>MOUSE</kbd> DRAG · <span style="color:#38bdf8;font-weight:700;">Unselect Helmet pov to get full view</span>`;
        }
        achHud.classList.remove('hidden');
      } else {
        const stateKey = 'ext:station';
        if (stateKey !== lastHudStateKey) {
          lastHudStateKey = stateKey;
          achName.textContent = `ORBIT STATION // 6-DOF FLIGHT VIEW`;
          achDesc.innerHTML = `FLIGHT: <kbd>W</kbd><kbd>S</kbd> FORWARD/BACK · <kbd>A</kbd><kbd>D</kbd> STRAFE · <kbd>Z</kbd><kbd>X</kbd> HEIGHT · <kbd>Q</kbd><kbd>E</kbd> ORBIT · <kbd>MOUSE</kbd> DRAG`;
        }
        achHud.classList.remove('hidden');
      }
    }
  };
  window.updateInstructionHud = updateInstructionHud;

  $('ach-release')?.addEventListener('click', (e) => {
    e.stopPropagation();
    hudDismissed = true;
    if (crew.selected) {
      crew.selected = null;
      crew.members.forEach((x) => { if (x.selRing) x.selRing.visible = false; });
    }
    achHud?.classList.add('hidden');
  });

  eva.onChange = (v) => {
    syncSel();
    document.body.classList.toggle('outside', v !== 'cabin');
    updateInstructionHud(true);
  };

  // DROPDOWN 1: VIEW & MODULES
  viewSel?.addEventListener('change', (e) => {
    audio.playClick();
    const v = e.target.value; e.target.blur();
    updateInstructionHud(true);
    if (v === 'v:pov') {
      const isInside = !document.body.classList.contains('outside') && eva.view === 'cabin';
      if (isInside) {
        const target = (crew.selected && !crew.selected.out) ? crew.selected : (crew.members.find((m) => !m.out) || crew.members[0]);
        lookThrough(target);
      } else {
        const w = eva.getActiveWalker();
        const target = (w && w.member) || crew.members.find((m) => m.out) || crew.members[0];
        if (target && target.out) {
          eva.show('pov');
          lookThrough(target);
        } else {
          eva.show('station');
        }
      }
    } else if (v.startsWith('v:')) {
      const targetView = v.slice(2);
      if (targetView === 'cabin') {
        leaveHelmet();
        eva.leave();
        document.body.classList.remove('outside', 'helmet');
        rig.mode = 'tour';
        rig.enabled = true;
        const cupolaIdx = STOPS.findIndex((s) => s.id === 'window');
        rig.goTo(cupolaIdx >= 0 ? cupolaIdx : 1, 1.4);
        hud.toast('Inside Cabin · Camera Flight View');
      } else {
        if (!eva.hasActiveWalkers()) {
          leaveHelmet();
        }
        eva.show(targetView);
      }
    } else if (v.startsWith('go:')) {
      const i = STOPS.findIndex((s) => s.id === v.slice(3));
      leaveHelmet();
      eva.whenReady(() => {
        if (rig.mode === 'ext') {
          eva.leave();
          setTimeout(() => rig.goTo(Math.max(0, i), 2.4), 1100);
        } else {
          rig.goTo(Math.max(0, i), 2.4);
        }
      });
    }
    syncSel();
  });

  // DROPDOWN 2: HELMET POV
  helmetSel?.addEventListener('change', (e) => {
    audio.playClick();
    const v = e.target.value; e.target.blur();
    if (v.startsWith('helmet:') && v !== 'helmet:none') {
      const id = v.slice(7);
      const m = crew.members.find((x) => x.c.id === id || x.c.slug === id || x.c.call.toLowerCase() === id.toLowerCase() || (x.c.name && x.c.name.toLowerCase().includes(id.toLowerCase())));
      if (m) {
        eva.whenReady(() => {
          lookThrough(m);
        });
      }
      updateInstructionHud(true);
    }
    helmetSel.value = 'helmet:none';
  });

  // DROPDOWN 3: DEPLOY / EVA
  deploySel?.addEventListener('change', (e) => {
    audio.playClick();
    const v = e.target.value; e.target.blur();
    if (v.startsWith('send:')) {
      const id = v.slice(5);
      const m = crew.members.find((x) => x.c.id === id);
      if (m) {
        hud.setHelmet(m);
        eva.sendOut(id, 'pov');
        crewView = true;
        document.body.classList.add('helmet', 'outside');
        $('btn-crew')?.classList.add('on');
        hud.toast(`Deployed ${m.c.name || m.c.role} to EVA · Spacewalk Visor POV Active`);
      } else {
        eva.sendOut(id, 'out');
      }
      updateInstructionHud(true);
    } else if (v === 'in') {
      eva.bringIn('all');
      leaveHelmet();
      if (helmetSel) helmetSel.value = 'helmet:none';
      updateInstructionHud(true);
    }
    deploySel.value = 'deploy:none';
  });

  // macOS Dropdown Menus: Clicking chevron arrow, icon, or label directly opens the picker menu
  document.querySelectorAll('.nav-dropdown-wrap').forEach((wrap) => {
    wrap.addEventListener('click', (e) => {
      const targetSelect = wrap.querySelector('select');
      if (targetSelect && e.target !== targetSelect) {
        targetSelect.focus();
        if (typeof targetSelect.showPicker === 'function') {
          try {
            targetSelect.showPicker();
          } catch (err) {}
        }
      }
    });
  });

  // Backwards compatibility with legacy eva-select
  legacySel?.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v.startsWith('v:') || v.startsWith('go:')) {
      if (viewSel) { viewSel.value = v; viewSel.dispatchEvent(new Event('change')); }
    } else if (v.startsWith('helmet:')) {
      if (helmetSel) { helmetSel.value = v; helmetSel.dispatchEvent(new Event('change')); }
    } else if (v.startsWith('send:') || v === 'in') {
      if (deploySel) { deploySel.value = v; deploySel.dispatchEvent(new Event('change')); }
    }
  });
  $('btn-back').addEventListener('click', () => {
    audio.playClick();
    leaveHelmet();
    eva.leave();
    document.body.classList.remove('outside', 'helmet');
    rig.mode = 'tour';
    rig.enabled = true;
    const cupolaIdx = STOPS.findIndex((s) => s.id === 'window');
    rig.goTo(cupolaIdx >= 0 ? cupolaIdx : 1, 1.4);
    hud.toast('Inside Cabin · Camera Flight View');
    updateInstructionHud(true);
    syncSel();
  });
  $('btn-shuffle').addEventListener('click', () => {
    audio.playChirp();
    const isExterior = rig.mode === 'ext' || eva.view !== 'cabin' || (eva.hasActiveWalkers && eva.hasActiveWalkers());
    if (isExterior && eva.hasActiveWalkers && eva.hasActiveWalkers()) {
      eva.cycleWalker();
    } else {
      crew.shuffle();
    }
  });
  $('btn-console').addEventListener('click', () => {
    audio.playClick();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'EXIT_CABIN' }, '*');
      window.parent.location.href = '/';
    } else if (CONFIG.consoleUrl) {
      location.href = CONFIG.consoleUrl;
    } else {
      hud.toast('Console is not connected in this build');
      rig.goTo(0);
    }
  });
  // Simulation Scenario Selection Engine: Open Scenario Modal Box (matches Dashboard)
  $('btn-scenarios')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    audio.playClick();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'OPEN_SCENARIOS' }, '*');
    }
    window.dispatchEvent(new CustomEvent('helios:open_scenarios'));
  });
  $('btn-live').addEventListener('click', (e) => {
    audio.playChirp();
    live.openTerminal('dashboard');
    hud.toast('Opening NASA Operations Terminal');
  });
  $('btn-sound').addEventListener('click', (e) => {
    const on = audio.toggle();
    e.currentTarget.innerHTML = `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${on ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'}</svg><span class="btn-lbl">${on ? 'Audio' : 'Mute'}</span>`;
    e.currentTarget.classList.toggle('on', on);
    hud.toast(on ? 'Station Audio Active' : 'Station Audio Muted');
  });

  // ---- NASA CAPCOM Quindar Radio Comms ----
  const capcomDispatches = [
    'Station, Houston on Space to Ground 1: Copy nominal telemetry lock. All four crew member baseline parameters verified within limits.',
    'Expedition 71, Houston: Telemetry downlink confirmed. Cupola astrophotography pass approved on the orbital flight plan.',
    'Station, Houston: Tracking TLE orbit pass over horizon. Station life support and thermal control systems nominal.',
    'Houston to Expedition 71: Good morning station. Flight surgeon reports all biometric parameters nominal across the shift.',
    'Station, Houston on Space to Ground 2: EVA preparations verified. Umbilical lifeline pressure checks complete.',
  ];
  let capcomIndex = 0;
  $('btn-capcom')?.addEventListener('click', () => {
    audio.playClick();
    const msg = capcomDispatches[capcomIndex % capcomDispatches.length];
    capcomIndex++;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'HELIOS_SPEAK_DIRECTIVE',
        text: msg,
        tone: 'chime',
        severity: 'INFO',
      }, '*');
    } else {
      if (audio.playCapcomRadio) {
        audio.playCapcomRadio(msg);
      } else {
        audio.speakJarvis(msg);
      }
    }
    hud.toast('CAPCOM // Space-to-Ground 1 Audio Transmission Active');
  });

  // ---- Dynamic Geographic Landmark & Ocean Identification ----
  // Continuously computed from the 3D globe's actual nadir coordinates directly below the ISS,
  // 100% synchronized with the calibrated Earth rotation (T_orbit = 145.0s) and real-time Keplerian orbit
  function getLiveSubSatelliteRegion() {
    let latDeg = 0, lonDeg = 0;
    if (world && typeof world.getNadirGeoCoords === 'function') {
      const g = world.getNadirGeoCoords();
      latDeg = g.lat;
      lonDeg = g.lon;
    } else {
      const incRad = 51.6 * (Math.PI / 180);
      const T_orbit = 145.0; // 145 seconds per orbit in simulation (gentle & smooth per user request)
      const wOrb = (2 * Math.PI) / T_orbit;
      const wEarth = wOrb * (92 / 1440);
      const lambdaNode0 = -48.0 * (Math.PI / 180);

      const tSec = Date.now() / 1000;
      const u = -Math.PI / 2 + (world && world.orbitAngle !== undefined ? world.orbitAngle : wOrb * tSec);
      const latRad = Math.asin(Math.sin(incRad) * Math.sin(u));
      latDeg = latRad * (180 / Math.PI);

      const raOrb = Math.atan2(Math.sin(u) * Math.cos(incRad), Math.cos(u));
      let lonRad = (lambdaNode0 + raOrb - wEarth * tSec) % (Math.PI * 2);
      if (lonRad > Math.PI) lonRad -= Math.PI * 2;
      if (lonRad < -Math.PI) lonRad += Math.PI * 2;
      lonDeg = lonRad * (180 / Math.PI);
    }

    const latStr = `${Math.abs(latDeg).toFixed(2)}° ${latDeg >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(lonDeg).toFixed(2)}° ${lonDeg >= 0 ? 'E' : 'W'}`;

    // ========================================================================
    // 1. BANGLADESH & BENGAL DELTA (20.5° N <= latDeg <= 26.8° N, 88.0° E <= lonDeg <= 92.8° E)
    // ========================================================================
    if (latDeg >= 20.5 && latDeg <= 26.8 && lonDeg >= 88.0 && lonDeg <= 92.8) {
      if (lonDeg >= 91.4 && latDeg <= 23.0) {
        return { name: 'CHITTAGONG PORT & COX\'S BAZAR COAST', coords: `${latStr}, ${lonStr} · BANGLADESH`, type: 'BAY OF BENGAL MARITIME HUB & LONGEST NATURAL SEA BEACH' };
      }
      if (latDeg <= 22.4) {
        return { name: 'SUNDARBANS MANGROVE & BAY OF BENGAL', coords: `${latStr}, ${lonStr} · BANGLADESH`, type: 'WORLD LARGEST TIDAL HALOPHYTIC MANGROVE FOREST' };
      }
      if (latDeg > 22.4 && latDeg <= 24.2 && lonDeg <= 90.8) {
        return { name: 'DHAKA & PADMA-MEGHNA RIVER BASIN', coords: `${latStr}, ${lonStr} · BANGLADESH`, type: 'BENGAL ALLUVIAL DELTA & POPULATION CENTER' };
      }
      if (latDeg > 24.0 && lonDeg >= 91.0) {
        return { name: 'SYLHET SURMA VALLEY & TEA HIGHLANDS', coords: `${latStr}, ${lonStr} · BANGLADESH`, type: 'VERDANT RAINFOREST VALLEY & TEA HIGHLANDS' };
      }
      return { name: 'RANGPUR & TEESTA-JAMUNA RIVER BASIN', coords: `${latStr}, ${lonStr} · BANGLADESH`, type: 'NORTHERN BENGAL BRAIDED RIVER BASIN' };
    }

    // ========================================================================
    // 2. INDIA & SRI LANKA
    // ========================================================================
    if (latDeg >= 5.5 && latDeg <= 37.0 && lonDeg >= 68.0 && lonDeg <= 97.0) {
      if (latDeg <= 10.0 && lonDeg >= 79.5 && lonDeg <= 82.0) {
        return { name: 'SRI LANKA & PALK STRAIT // ADAM\'S BRIDGE', coords: `${latStr}, ${lonStr} · SRI LANKA`, type: 'TROPICAL TEARDROP ISLAND & ANCIENT SHOAL' };
      }
      if (latDeg >= 26.8 && latDeg <= 32.0 && lonDeg >= 78.0 && lonDeg <= 90.0) {
        return { name: 'HIMALAYAS & MOUNT EVEREST // GLACIATED PEAKS', coords: `${latStr}, ${lonStr} · INDIA/NEPAL`, type: 'HIGHEST MOUNTAIN SYSTEM ON EARTH' };
      }
      if (latDeg >= 27.5 && latDeg <= 31.0 && lonDeg >= 75.5 && lonDeg <= 79.5) {
        return { name: 'NEW DELHI & TAJ MAHAL // NORTHERN PLAINS', coords: `${latStr}, ${lonStr} · INDIA`, type: 'INDO-GANGETIC ALLUVIAL PLAIN & HISTORIC MONUMENTS' };
      }
      if (latDeg >= 17.5 && latDeg <= 21.0 && lonDeg >= 71.5 && lonDeg <= 75.0) {
        return { name: 'MUMBAI & MAHARASHTRA COAST // ARABIAN SEA', coords: `${latStr}, ${lonStr} · INDIA`, type: 'FINANCIAL CAPITAL & BIODIVERSE WESTERN GHATS' };
      }
      if (latDeg >= 12.0 && latDeg <= 16.0 && lonDeg >= 75.0 && lonDeg <= 78.5) {
        return { name: 'BENGALURU & DECCAN CRATON // TECH CORRIDOR', coords: `${latStr}, ${lonStr} · INDIA`, type: 'PENINSULAR GRANITE PLATEAU & AEROSPACE HUB' };
      }
      if (latDeg >= 11.5 && latDeg <= 15.0 && lonDeg >= 78.5 && lonDeg <= 81.5) {
        return { name: 'CHENNAI & COROMANDEL COAST // BAY OF BENGAL', coords: `${latStr}, ${lonStr} · INDIA`, type: 'ANCIENT DRAVIDIAN MARITIME SHELF' };
      }
      if (latDeg >= 23.5 && latDeg <= 29.5 && lonDeg >= 68.5 && lonDeg <= 75.5) {
        return { name: 'THAR DESERT & RAJASTHAN FORTS // JAIPUR', coords: `${latStr}, ${lonStr} · INDIA`, type: 'GREAT INDIAN ARID DESERT & HISTORIC FORTS' };
      }
      if (latDeg >= 21.5 && latDeg <= 25.0 && lonDeg >= 86.5 && lonDeg < 88.0) {
        return { name: 'KOLKATA & HOOGHLY ESTUARY // WEST BENGAL', coords: `${latStr}, ${lonStr} · INDIA`, type: 'GANGETIC RIVERINE CULTURAL BASIN' };
      }
      if (latDeg >= 8.0 && latDeg < 12.0 && lonDeg <= 77.8) {
        return { name: 'KERALA BACKWATERS & CAPE COMORIN', coords: `${latStr}, ${lonStr} · INDIA`, type: 'TROPICAL PALM LAGOONS & OCEAN CONFLUENCE' };
      }
      if (latDeg >= 24.5 && lonDeg >= 92.8) {
        return { name: 'ASSAM & BRAHMAPUTRA VALLEY // NORTHEAST HILLS', coords: `${latStr}, ${lonStr} · INDIA`, type: 'HIMALAYAN BIODIVERSITY CORRIDOR' };
      }
      if (latDeg >= 20.0 && latDeg < 27.0 && lonDeg >= 74.5 && lonDeg <= 85.0) {
        return { name: 'CENTRAL INDIA & VINDHYA-SATPURA RANGES', coords: `${latStr}, ${lonStr} · INDIA`, type: 'ANCIENT TIGER BIOSPHERE & SAL FORESTS' };
      }
      return { name: 'INDIAN SUBCONTINENT // GANGETIC PLAIN & DECCAN', coords: `${latStr}, ${lonStr} · INDIA`, type: 'PENINSULAR SHIELD & ALLUVIAL PLAINS' };
    }

    // ========================================================================
    // 3. BAY OF BENGAL, ARABIAN SEA & EQUATORIAL INDIAN OCEAN
    // ========================================================================
    if (latDeg >= 0 && latDeg <= 22.0 && lonDeg >= 80.0 && lonDeg <= 96.0) {
      if (latDeg >= 11.0 && latDeg <= 14.5 && lonDeg >= 92.0 && lonDeg <= 94.5) {
        return { name: 'ANDAMAN & NICOBAR ISLANDS // CORAL REEFS', coords: `${latStr}, ${lonStr} · BAY OF BENGAL`, type: 'TROPICAL ISLAND VOLCANIC ARC & RAINFOREST' };
      }
      if (latDeg < 6.0) {
        return { name: 'EQUATORIAL INDIAN OCEAN // BAY OF BENGAL OUTFLOW', coords: `${latStr}, ${lonStr}`, type: 'TROPICAL WARM POOL & EQUATORIAL CONVERGENCE' };
      }
      return { name: 'BAY OF BENGAL // NORTHERN INDIAN OCEAN', coords: `${latStr}, ${lonStr}`, type: 'WORLD LARGEST WATER BAY & MONSOON BASIN' };
    }
    if (latDeg >= 0 && latDeg <= 25.0 && lonDeg >= 55.0 && lonDeg < 80.0) {
      if (latDeg < 8.0) {
        return { name: 'EQUATORIAL INDIAN OCEAN // ARABIAN SEA ENTRANCE', coords: `${latStr}, ${lonStr}`, type: 'TROPICAL OCEANIC CURRENT & GYRE' };
      }
      return { name: 'ARABIAN SEA & GULF OF OMAN', coords: `${latStr}, ${lonStr}`, type: 'NORTHWEST INDIAN OCEAN UPWELLING MARGIN' };
    }

    // ========================================================================
    // 4. CENTRAL ASIA, AFGHANISTAN & CAUCASUS
    // ========================================================================
    if (latDeg >= 28.0 && latDeg <= 51.6 && lonDeg >= 40.0 && lonDeg <= 92.0) {
      if (latDeg >= 48.0 && lonDeg >= 55.0) {
        return { name: 'URAL MOUNTAINS & WESTERN SIBERIA', coords: `${latStr}, ${lonStr} · RUSSIA/KAZAKHSTAN`, type: 'CONTINENTAL DIVIDE & LOWLAND PLAIN' };
      }
      if (lonDeg >= 40.0 && lonDeg <= 55.0 && latDeg >= 38.0 && latDeg <= 48.0) {
        return { name: 'CAUCASUS MOUNTAINS & CASPIAN SEA BASIN', coords: `${latStr}, ${lonStr} · RUSSIA/AZERBAIJAN`, type: 'ISLAND SEA BASIN & ALPINE RIDGE' };
      }
      if (lonDeg >= 60.0 && lonDeg <= 72.0 && latDeg >= 28.0 && latDeg < 38.0) {
        return { name: 'HINDU KUSH & AFGHAN HIGHLANDS // KABUL', coords: `${latStr}, ${lonStr} · AFGHANISTAN/PAKISTAN`, type: 'RUGGED ALPINE MASSIF & VALLEYS' };
      }
      if (lonDeg >= 68.0 && lonDeg <= 82.0 && latDeg >= 38.0 && latDeg <= 44.0) {
        return { name: 'TIAN SHAN MOUNTAINS & LAKE ISSYK-KUL // KYRGYZSTAN', coords: `${latStr}, ${lonStr} · CENTRAL ASIA`, type: 'GLACIATED CELESTIAL MOUNTAIN RANGE' };
      }
      if (lonDeg >= 75.0 && lonDeg <= 92.0 && latDeg >= 36.0 && latDeg <= 44.0) {
        return { name: 'TAKLAMAKAN DESERT & TARIM BASIN // SILK ROAD', coords: `${latStr}, ${lonStr} · XINJIANG, CHINA`, type: 'HYPER-ARID DESERT BASIN & OASIS CORRIDOR' };
      }
      if (lonDeg >= 52.0 && lonDeg <= 75.0 && latDeg >= 36.0 && latDeg <= 48.0) {
        return { name: 'KAZAKH STEPPE & ANCIENT SILK ROAD // ARAL SEA', coords: `${latStr}, ${lonStr} · KAZAKHSTAN/UZBEKISTAN`, type: 'EURASIAN CONTINENTAL STEPPE & DESERT' };
      }
    }

    // ========================================================================
    // 5. EAST & SOUTHEAST ASIA
    // ========================================================================
    if (lonDeg >= 97.0 && lonDeg <= 150.0) {
      // Indonesia & Maritime Continent (Equator / Southern Hemisphere)
      if (latDeg >= -11.0 && latDeg <= 6.0) {
        if (lonDeg >= 95.0 && lonDeg <= 106.0) return { name: 'SUMATRA TROPICAL RAINFOREST & SUNDA STRAIT', coords: `${latStr}, ${lonStr} · INDONESIA`, type: 'VOLCANIC ARC & EQUATORIAL RAINFOREST' };
        if (lonDeg > 106.0 && lonDeg <= 116.0 && latDeg <= -5.0) return { name: 'JAVA VOLCANIC SPINE & BALI // JAKARTA', coords: `${latStr}, ${lonStr} · INDONESIA`, type: 'PACIFIC RING OF FIRE & HIGH-DENSITY CRATER BELT' };
        if (lonDeg >= 108.0 && lonDeg <= 119.0 && latDeg > -5.0) return { name: 'BORNEO RAINFOREST & MAKASSAR STRAIT', coords: `${latStr}, ${lonStr} · INDONESIA/MALAYSIA`, type: 'ANCIENT PRIMARY EQUATORIAL JUNGLE & STRAIT' };
        return { name: 'INDONESIAN ARCHIPELAGO // CELEBES & MOLUCCAS', coords: `${latStr}, ${lonStr} · INDONESIA`, type: 'MARITIME CONTINENT & SPICE ISLANDS' };
      }
      // Southeast Asia (Mainland & Philippines)
      if (latDeg > 6.0 && latDeg < 20.0) {
        if (lonDeg >= 98.0 && lonDeg <= 106.0) return { name: 'BANGKOK & GULF OF THAILAND // MEKONG DELTA', coords: `${latStr}, ${lonStr} · THAILAND/VIETNAM`, type: 'TROPICAL RIVER BASIN & FERTILE DELTA' };
        if (lonDeg > 106.0 && lonDeg <= 115.0) return { name: 'SOUTH CHINA SEA & PARACEL SHALLOWS', coords: `${latStr}, ${lonStr}`, type: 'MARGINAL TROPICAL SEA & ATOLLS' };
        if (lonDeg > 115.0 && lonDeg <= 126.0) return { name: 'PHILIPPINE ARCHIPELAGO // MANILA BAY', coords: `${latStr}, ${lonStr} · PHILIPPINES`, type: 'PACIFIC RING OF FIRE & TROPICAL SEAS' };
      }
      // China
      if (latDeg >= 20.0 && latDeg < 36.0 && lonDeg >= 97.0 && lonDeg <= 122.0) {
        if (lonDeg <= 104.0) return { name: 'TIBETAN PLATEAU & HENGDUAN GORGES', coords: `${latStr}, ${lonStr} · CHINA`, type: 'ROOF OF THE WORLD & PARALLEL RIVERS' };
        if (latDeg <= 26.0 && lonDeg >= 110.0) return { name: 'PEARL RIVER DELTA // HONG KONG & GUANGZHOU', coords: `${latStr}, ${lonStr} · CHINA`, type: 'COASTAL ESTUARY & INDUSTRIAL MEGAPOLIS' };
        if (latDeg > 28.0 && latDeg <= 33.0 && lonDeg >= 116.0) return { name: 'SHANGHAI & YANGTZE RIVER DELTA', coords: `${latStr}, ${lonStr} · CHINA`, type: 'WORLD THIRD LONGEST RIVER BASIN' };
        return { name: 'SICHUAN BASIN & TIBETAN MARGIN', coords: `${latStr}, ${lonStr} · CHINA`, type: 'FERTILE RED BASIN & MOUNTAIN MARGIN' };
      }
      if (latDeg >= 36.0 && latDeg <= 44.0 && lonDeg >= 110.0 && lonDeg <= 122.0) {
        return { name: 'BEIJING & GREAT WALL // NORTH CHINA PLAIN', coords: `${latStr}, ${lonStr} · CHINA`, type: 'HISTORIC CAPITAL & ALLUVIAL PLAIN' };
      }
      // Korea & Japan
      if (lonDeg >= 124.0 && lonDeg <= 145.0) {
        if (lonDeg <= 130.0 && latDeg >= 33.0 && latDeg <= 42.0) return { name: 'SEOUL & KOREAN PENINSULA // HAN RIVER', coords: `${latStr}, ${lonStr} · SOUTH KOREA`, type: 'MOUNTAINOUS PENINSULA & CAPITAL MEGAPOLIS' };
        if (latDeg >= 30.0 && latDeg <= 45.0) return { name: 'TOKYO & MT FUJI // JAPANESE ARCHIPELAGO', coords: `${latStr}, ${lonStr} · JAPAN`, type: 'PACIFIC RING OF FIRE & STRATOVOLCANO' };
      }
    }

    // ========================================================================
    // 6. RUSSIA & SIBERIA (+45° N <= lat <= +51.6° N)
    // ========================================================================
    if (latDeg >= 45.0 && latDeg <= 51.6) {
      if (lonDeg >= 30.0 && lonDeg < 55.0) return { name: 'MOSCOW & EUROPEAN RUSSIA // NORTHERN APEX (+51.6° N)', coords: `${latStr}, ${lonStr} · RUSSIA`, type: 'EAST EUROPEAN PLAIN & NORTHERN ORBITAL APEX' };
      if (lonDeg >= 55.0 && lonDeg < 85.0) return { name: 'URAL MOUNTAINS & WESTERN SIBERIA', coords: `${latStr}, ${lonStr} · RUSSIA`, type: 'CONTINENTAL DIVIDE & LOWLAND PLAIN' };
      if (lonDeg >= 85.0 && lonDeg < 115.0) return { name: 'CENTRAL SIBERIAN TAIGA & LAKE BAIKAL', coords: `${latStr}, ${lonStr} · RUSSIA`, type: 'BOREAL TAIGA & DEEPEST FRESHWATER LAKE' };
      if (lonDeg >= 115.0 && lonDeg <= 170.0) return { name: 'RUSSIAN FAR EAST & KAMCHATKA VOLCANOES', coords: `${latStr}, ${lonStr} · RUSSIA`, type: 'PACIFIC VOLCANIC BELT & OKHOTSK SEA' };
    }

    // ========================================================================
    // 7. EUROPE & MEDITERRANEAN (-15° W <= lonDeg <= 40° E, latDeg >= 35° N)
    // ========================================================================
    if (lonDeg >= -15.0 && lonDeg <= 40.0 && latDeg >= 35.0) {
      if (lonDeg < -9.5) return { name: 'NORTH ATLANTIC OCEAN (IBERIAN SHELF)', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC MARGIN & COASTAL SWELL' };
      if (latDeg >= 42.0 && latDeg <= 51.6) {
        if (lonDeg >= -10.0 && lonDeg < -1.0 && latDeg < 48.5) return { name: 'BAY OF BISCAY & CELTIC SEA', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC GULF & CONTINENTAL SHELF' };
        if (lonDeg >= -6.0 && lonDeg <= 2.0) return { name: 'PARIS & SEINE VALLEY // FRANCE', coords: `${latStr}, ${lonStr} · FRANCE`, type: 'WEST EUROPEAN ALLUVIAL LOWLAND' };
        if (lonDeg > 2.0 && lonDeg <= 14.0) return { name: 'ALPS MOUNTAINS & RHINE VALLEY // GERMANY', coords: `${latStr}, ${lonStr} · SWITZERLAND/GERMANY`, type: 'SNOW-CAPPED ALPINE GLACIAL ARCS' };
        if (lonDeg >= -10.0 && lonDeg < -1.0 && latDeg >= 48.5) return { name: 'LONDON & ENGLISH CHANNEL // UNITED KINGDOM', coords: `${latStr}, ${lonStr} · UK`, type: 'BRITISH ISLES & NORTH SEA' };
        if (lonDeg >= 14.0 && lonDeg <= 30.0) return { name: 'CARPATHIAN BASIN & DANUBE RIVER // CENTRAL EUROPE', coords: `${latStr}, ${lonStr} · POLAND/AUSTRIA/HUNGARY`, type: 'CENTRAL EUROPEAN PLAIN & ARCS' };
        if (lonDeg > 30.0) return { name: 'UKRAINIAN STEPPE & BLACK SEA COAST', coords: `${latStr}, ${lonStr} · UKRAINE`, type: 'PONTIC-CASPIAN ALLUVIAL STEPPE' };
      }
      if (latDeg >= 35.0 && latDeg < 42.0) {
        if (lonDeg >= -9.5 && lonDeg < 3.5) return { name: 'IBERIAN PENINSULA & MADRID // SPAIN & GIBRALTAR', coords: `${latStr}, ${lonStr} · SPAIN`, type: 'MEDITERRANEAN PLATEAU & MESETA' };
        if (lonDeg >= 3.5 && lonDeg <= 18.5) return { name: 'MEDITERRANEAN SEA & ITALIAN PENINSULA // ROME', coords: `${latStr}, ${lonStr} · ITALY`, type: 'MEDITERRANEAN SEA & APENNINE RIDGE' };
        if (lonDeg > 18.5 && lonDeg <= 28.0) return { name: 'AEGEAN SEA & GREEK ARCHIPELAGO // ATHENS', coords: `${latStr}, ${lonStr} · GREECE`, type: 'MEDITERRANEAN BASIN & ISLANDS' };
        return { name: 'ANATOLIAN PENINSULA & BOSPORUS // TURKEY', coords: `${latStr}, ${lonStr} · TURKEY`, type: 'EURASIAN BRIDGE & HIGHLANDS' };
      }
    }

    // ========================================================================
    // 8. MIDDLE EAST & NORTH AFRICA
    // ========================================================================
    if (lonDeg >= -18.0 && lonDeg <= 58.0 && latDeg >= 12.0 && latDeg < 35.0) {
      if (lonDeg >= -15.0 && lonDeg <= -8.0 && latDeg >= 18.0 && latDeg <= 24.0) {
        return { name: 'THE EYE OF THE SAHARA (RICHAT STRUCTURE)', coords: `${latStr}, ${lonStr} · MAURITANIA`, type: 'CIRCULAR GEOLOGIC DOME · 40KM DIA' };
      }
      if (lonDeg >= 26.0 && lonDeg <= 35.0 && latDeg >= 22.0) {
        return { name: 'NILE RIVER VALLEY & GIZA PYRAMIDS', coords: `${latStr}, ${lonStr} · EGYPT`, type: 'HISTORIC RIVER DELTA & DESERT' };
      }
      if (lonDeg >= 32.0 && lonDeg <= 44.0 && latDeg < 28.0) {
        return { name: 'RED SEA RIFT & CORAL REEFS', coords: `${latStr}, ${lonStr}`, type: 'TECTONIC SPREADING RIFT & WARM SEA' };
      }
      if (lonDeg >= 50.0 && lonDeg <= 57.0 && latDeg < 28.0) {
        return { name: 'DUBAI & THE PALM // UNITED ARAB EMIRATES', coords: `${latStr}, ${lonStr} · UAE`, type: 'PERSIAN GULF ARCHITECTURE & COAST' };
      }
      if (lonDeg >= 44.0 && lonDeg <= 55.0 && latDeg < 26.0) {
        return { name: 'PERSIAN GULF & RUB AL-KHALI DESERT', coords: `${latStr}, ${lonStr} · SAUDI ARABIA`, type: 'EMPTY QUARTER SAND SEAS' };
      }
      if (lonDeg < 0) {
        return { name: 'WESTERN SAHARA & ATLAS MOUNTAINS', coords: `${latStr}, ${lonStr} · MOROCCO/MAGHREB`, type: 'DESERT DUNES & OROGENIC RANGE' };
      }
      return { name: 'SAHARA DESERT & TIBESTI MOUNTAINS', coords: `${latStr}, ${lonStr} · CHAD/LIBYA`, type: 'VOLCANIC MASSIF & SAND SEAS' };
    }

    // ========================================================================
    // 9. SUB-SAHARAN & SOUTHERN AFRICA (Route 2 key segment!)
    // ========================================================================
    if (lonDeg >= -18.0 && lonDeg <= 52.0 && latDeg < 12.0 && latDeg >= -35.0) {
      if (latDeg < -26.0 && lonDeg > 33.0) {
        return { name: 'SOUTH INDIAN OCEAN // AGULHAS CURRENT', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · BOUNDARY CURRENT' };
      }
      // West Africa / Gulf of Guinea
      if (latDeg >= 0 && latDeg < 12.0 && lonDeg <= 10.0) {
        return { name: 'GULF OF GUINEA & WEST AFRICAN COAST', coords: `${latStr}, ${lonStr} · WEST AFRICA`, type: 'TROPICAL ATLANTIC COAST & RAINFOREST' };
      }
      // Congo River Basin (Route 2 Equator crossing)
      if (latDeg >= -8.0 && latDeg <= 5.0 && lonDeg >= 10.0 && lonDeg <= 32.0) {
        return { name: 'CONGO RIVER BASIN // EQUATORIAL AFRICA', coords: `${latStr}, ${lonStr} · CONGO/DRC`, type: 'EQUATORIAL RAINFOREST & CONGO RIVER DRAINAGE' };
      }
      // East Africa & Lake Victoria
      if (latDeg >= -12.0 && latDeg < 5.0 && lonDeg > 32.0 && lonDeg <= 42.0) {
        return { name: 'EAST AFRICAN RIFT & MT KILIMANJARO // LAKE VICTORIA', coords: `${latStr}, ${lonStr} · KENYA/TANZANIA`, type: 'GREAT RIFT VALLEY & STRATOVOLCANO' };
      }
      // Madagascar & Mozambique Channel
      if (latDeg >= -26.0 && latDeg <= -12.0 && lonDeg >= 42.0) {
        return { name: 'MADAGASCAR & MOZAMBIQUE CHANNEL', coords: `${latStr}, ${lonStr} · MADAGASCAR`, type: 'ENDEMIC ISLAND BIOSPHERE & STRAIT' };
      }
      // Kalahari & Okavango
      if (latDeg < -18.0 && latDeg >= -26.0 && lonDeg >= 18.0 && lonDeg <= 28.0) {
        return { name: 'KALAHARI DESERT & OKAVANGO DELTA', coords: `${latStr}, ${lonStr} · BOTSWANA/NAMIBIA`, type: 'SAVANNA BASIN & INLAND DELTA' };
      }
      // South Africa (Route 2 southern exit)
      if (latDeg < -26.0 && lonDeg <= 33.0) {
        if (lonDeg <= 22.0) return { name: 'CAPE OF GOOD HOPE & TABLE MOUNTAIN', coords: `${latStr}, ${lonStr} · SOUTH AFRICA`, type: 'CAPE PENINSULA & OCEAN CONFLUENCE' };
        return { name: 'SOUTH AFRICA & DRAKENSBERG ESCARPMENT // DURBAN', coords: `${latStr}, ${lonStr} · SOUTH AFRICA`, type: 'BASALT ESCARPMENT & AGULHAS COAST' };
      }
      return { name: 'CENTRAL AFRICAN SAVANNA & ZAMBEZI BASIN', coords: `${latStr}, ${lonStr} · ANGOLA/ZAMBIA`, type: 'TROPICAL PLATEAU & RIVER DRAINAGE' };
    }

    // ========================================================================
    // 10. NORTH AMERICA & CARIBBEAN (Route 2 key segment!)
    // ========================================================================
    if (lonDeg >= -130.0 && lonDeg <= -50.0 && latDeg >= 10.0) {
      // Open North Atlantic / Sargasso Sea off the Americas
      if (lonDeg >= -64.0 && latDeg >= 20.0 && latDeg <= 36.0) {
        return { name: 'NORTH ATLANTIC OCEAN // SARGASSO SEA', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC GYRE & PELAGIC BASIN' };
      }
      // Northern Canada apex (+51.6° N)
      if (latDeg >= 48.0) {
        if (lonDeg >= -85.0) return { name: 'HUDSON BAY & NORTH ATLANTIC // NORTHERN CANADA (+51.6° N)', coords: `${latStr}, ${lonStr} · CANADA`, type: 'SUB-ARCTIC SHIELD & NORTHERN ORBITAL BOUNDARY' };
        return { name: 'CANADIAN ROCKIES & ALBERTA PLAINS', coords: `${latStr}, ${lonStr} · CANADA`, type: 'OROGENIC BELT & GLACIATED LAKES' };
      }
      // US East Coast (Route 2 southeast pass)
      if (lonDeg >= -80.0 && lonDeg <= -68.0 && latDeg >= 36.0 && latDeg < 48.0) {
        return { name: 'NEW YORK CITY & US EAST COAST // CHESAPEAKE BAY', coords: `${latStr}, ${lonStr} · US EAST COAST`, type: 'ATLANTIC FINANCIAL MEGAPOLIS & COASTAL SHELF' };
      }
      // Florida & Kennedy Space Center
      if (lonDeg >= -83.0 && lonDeg <= -78.5 && latDeg >= 24.5 && latDeg < 32.0) {
        return { name: 'KENNEDY SPACE CENTER & CAPE CANAVERAL // FLORIDA', coords: `${latStr}, ${lonStr} · FLORIDA, US`, type: 'HISTORIC NASA LAUNCH RANGE & EVERGLADES' };
      }
      // Caribbean & Bahamas (Route 2 crossing towards Atlantic)
      if (latDeg >= 12.0 && latDeg <= 26.0 && lonDeg >= -85.0 && lonDeg <= -60.0) {
        return { name: 'CARIBBEAN SEA & BAHAMAS CORAL SHALLOWS', coords: `${latStr}, ${lonStr} · CARIBBEAN`, type: 'TURQUOISE REEF BANKS & TROPICAL BASIN' };
      }
      // Gulf of Mexico & Yucatan
      if (latDeg >= 18.0 && latDeg < 30.0 && lonDeg >= -98.0 && lonDeg < -83.0) {
        return { name: 'GULF OF MEXICO & YUCATAN PENINSULA', coords: `${latStr}, ${lonStr} · MEXICO/US`, type: 'MARGINAL TROPICAL SEA & CARBONATE SHELF' };
      }
      // Texas & NASA Houston
      if (lonDeg >= -104.0 && lonDeg < -93.0 && latDeg >= 26.0 && latDeg < 36.0) {
        return { name: 'TEXAS PLAINS & HOUSTON // NASA JOHNSON SPACE CENTER', coords: `${latStr}, ${lonStr} · TEXAS, US`, type: 'GULF COASTAL LOWLAND & MISSION CONTROL' };
      }
      // Great Lakes & Midwest
      if (lonDeg >= -92.0 && lonDeg < -80.0 && latDeg >= 40.0) {
        return { name: 'GREAT LAKES & CHICAGO // LAKE MICHIGAN', coords: `${latStr}, ${lonStr} · US GREAT LAKES`, type: 'GLACIAL FRESHWATER SYSTEM & URBAN SHORELINE' };
      }
      // Western US & Pacific
      if (lonDeg <= -115.0 && latDeg >= 32.0) {
        return { name: 'CALIFORNIA COAST & SILICON VALLEY // SAN FRANCISCO', coords: `${latStr}, ${lonStr} · CALIFORNIA, US`, type: 'PACIFIC COASTLINE & SAN ANDREAS FAULT' };
      }
      if (lonDeg > -115.0 && lonDeg <= -104.0) {
        return { name: 'ROCKY MOUNTAINS & GRAND CANYON // COLORADO PLATEAU', coords: `${latStr}, ${lonStr} · US WEST`, type: 'CONTINENTAL DIVIDE & CANYON GORGE' };
      }
      return { name: 'UNITED STATES // CONTINENTAL INTERIOR & PLAINS', coords: `${latStr}, ${lonStr} · US`, type: 'NORTH AMERICAN CONTINENTAL SHIELD' };
    }

    // ========================================================================
    // 11. SOUTH AMERICA (Route 1 key segment!)
    // ========================================================================
    if (lonDeg >= -82.0 && lonDeg <= -34.0 && latDeg <= 12.0) {
      // Open Atlantic Ocean off northeast coast of South America
      if (latDeg > 5.0 && lonDeg > -50.0) {
        return { name: 'TROPICAL NORTH ATLANTIC OCEAN', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · TRADE WINDS' };
      }
      // Equator Crossing over Brazil & Amazon (Route 1)
      if (latDeg >= -6.0 && latDeg <= 5.0 && lonDeg >= -72.0 && lonDeg <= -44.0) {
        return { name: 'EQUATOR CROSSING · BRAZIL & AMAZON BASIN', coords: `${latStr}, ${lonStr} · BRAZIL`, type: 'EQUATORIAL RAINFOREST & TROPICAL RIVER BASIN' };
      }
      if (latDeg > 0) {
        if (lonDeg >= -78.0 && lonDeg <= -68.0) return { name: 'COLOMBIAN ANDES & BOGOTA VALLEY', coords: `${latStr}, ${lonStr} · COLOMBIA`, type: 'NORTHERN ANDEAN HIGHLANDS' };
        return { name: 'GUIANA HIGHLANDS & ORINOCO BASIN', coords: `${latStr}, ${lonStr} · VENEZUELA/BRAZIL`, type: 'ANCIENT PRECAMBRIAN TEPUIS' };
      }
      // Chile & Andes
      if (lonDeg >= -76.0 && lonDeg <= -67.0) {
        if (latDeg <= -40.0) return { name: 'CHILEAN FJORDS & PATAGONIA GLACIERS', coords: `${latStr}, ${lonStr} · CHILE`, type: 'SUB-ANTARCTIC FJORD & GLACIAL REGION' };
        if (latDeg <= -30.0) return { name: 'CENTRAL CHILE & SANTIAGO // ANDES CORDILLERA', coords: `${latStr}, ${lonStr} · CHILE`, type: 'VALLE CENTRAL & HIGH MOUNTAINS' };
        return { name: 'NORTHERN CHILE & ATACAMA DESERT', coords: `${latStr}, ${lonStr} · CHILE`, type: 'HIGH ALTITUDE HYPER-ARID PLATEAU' };
      }
      // Brazil Rainforest & Coast
      if (latDeg >= -15.0 && lonDeg >= -75.0 && lonDeg <= -45.0) return { name: 'AMAZON RAINFOREST & RIVER BASIN', coords: `${latStr}, ${lonStr} · BRAZIL`, type: 'TROPICAL RIVER BASIN & BIOSPHERE' };
      if (latDeg < -18.0 && lonDeg > -58.0) return { name: 'RIO DE JANEIRO & SAO PAULO COAST', coords: `${latStr}, ${lonStr} · BRAZIL`, type: 'ATLANTIC RAINFOREST & COASTAL MEGAPOLIS' };
      // Argentina & Pampas
      if (latDeg <= -40.0) return { name: 'PATAGONIA & STRAIT OF MAGELLAN', coords: `${latStr}, ${lonStr} · ARGENTINA`, type: 'SUB-ANTARCTIC STEPPE & CHILE MARGIN' };
      if (latDeg < -18.0) return { name: 'PAMPAS & BUENOS AIRES // RIO DE LA PLATA', coords: `${latStr}, ${lonStr} · ARGENTINA`, type: 'FERTILE ALLUVIAL LOWLAND PLAINS' };
      return { name: 'PERUVIAN ANDES & MACHU PICCHU', coords: `${latStr}, ${lonStr} · PERU`, type: 'HIGH ANDEAN MOUNTAIN RANGE' };
    }

    // ========================================================================
    // 12. AUSTRALIA & OCEANIA (Route 2 southern exit & Route 1 return)
    // ========================================================================
    if (latDeg <= -11.0 && lonDeg >= 113.0 && lonDeg <= 155.0) {
      if (latDeg <= -45.0) return { name: 'SOUTHERN OCEAN // SOUTH OF AUSTRALIA (-51.6° S APEX)', coords: `${latStr}, ${lonStr}`, type: 'CIRCUMPOLAR ANTARCTIC CONVERGENCE' };
      if (latDeg >= -24.0 && lonDeg >= 142.0) return { name: 'GREAT BARRIER REEF & CORAL SEA', coords: `${latStr}, ${lonStr} · QUEENSLAND, AUSTRALIA`, type: 'WORLD LARGEST LIVING REEF SYSTEM' };
      if (latDeg <= -28.0 && lonDeg >= 144.0) return { name: 'SYDNEY HARBOUR & BLUE MOUNTAINS', coords: `${latStr}, ${lonStr} · NSW, AUSTRALIA`, type: 'COASTAL HARBOUR & TASMAN BASIN' };
      if (lonDeg <= 128.0) return { name: 'WESTERN AUSTRALIA & PERTH COAST // PILBARA', coords: `${latStr}, ${lonStr} · AUSTRALIA`, type: 'ARID ANCIENT CRATON & INDIAN OCEAN COAST' };
      return { name: 'AUSTRALIAN OUTBACK & ULURU (AYERS ROCK)', coords: `${latStr}, ${lonStr} · NT, AUSTRALIA`, type: 'RED DESERT MONOLITH & OUTBACK' };
    }
    // New Zealand
    if (latDeg <= -34.0 && lonDeg > 155.0 && lonDeg <= 178.0) {
      return { name: 'NEW ZEALAND SOUTHERN ALPS & COOK STRAIT', coords: `${latStr}, ${lonStr} · NEW ZEALAND`, type: 'ALPINE GLACIER & PACIFIC FJORD' };
    }

    // ========================================================================
    // 13. OCEANIC WATER BASINS (ACCURATELY PARTITIONED!)
    // ========================================================================
    // South Atlantic Ocean (-38° W <= lonDeg <= 18° E, latDeg < 0)
    if (lonDeg >= -38.0 && lonDeg <= 18.0 && latDeg < 0) {
      if (latDeg < -40.0) return { name: 'SOUTH ATLANTIC OCEAN (ROARING FORTIES)', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC CIRCUMPOLAR CURRENT' };
      return { name: 'SOUTH ATLANTIC OCEAN', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · OPEN WATER' };
    }
    // North Atlantic Ocean (-65° W <= lonDeg <= -12° W, latDeg >= 0)
    if (lonDeg >= -65.0 && lonDeg <= -12.0 && latDeg >= 0) {
      if (latDeg > 35.0) return { name: 'NORTH ATLANTIC OCEAN (AZORES HIGH)', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC GYRE & SWELL BASIN' };
      return { name: 'TROPICAL NORTH ATLANTIC OCEAN', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · TRADE WINDS' };
    }
    // Indian Ocean (20° E <= lonDeg <= 113° E, latDeg < 0)
    if (lonDeg > 20.0 && lonDeg < 113.0 && latDeg < 0) {
      if (latDeg <= -45.0) return { name: 'SOUTHERN OCEAN // SOUTH OF AUSTRALIA (-51.6° S APEX)', coords: `${latStr}, ${lonStr}`, type: 'CIRCUMPOLAR ANTARCTIC CONVERGENCE' };
      if (latDeg > -15.0) return { name: 'EQUATORIAL INDIAN OCEAN', coords: `${latStr}, ${lonStr}`, type: 'TROPICAL WARM POOL & EQUATORIAL TROUGH' };
      return { name: 'SOUTH INDIAN OCEAN', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · OPEN WATER' };
    }
    // South Pacific Ocean
    if (latDeg < 0) {
      if (latDeg <= -45.0) return { name: 'SOUTH PACIFIC OCEAN // ORBITAL LOOP APEX (-51.6° S)', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · POINT NEMO REGION' };
      return { name: 'SOUTH PACIFIC OCEAN & POLYNESIA', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · POLYNESIAN TRIANGLE' };
    }
    // North Pacific Ocean
    return { name: 'NORTH PACIFIC OCEAN & HAWAIIAN RIDGE', coords: `${latStr}, ${lonStr}`, type: 'OCEANIC BASIN · DEEP WATER' };
  }
  window.getLiveSubSatelliteRegion = getLiveSubSatelliteRegion;

  // ---- Cupola Astrophotography Landmark Geotagger & Camera Viewfinder ----
  let camBrightness = 100;
  let camContrast = 100;
  let camSaturation = 100;
  let lastCapturedPhotoUrl = '';

  const updateCamFilterPreview = () => {
    const filter = `brightness(${camBrightness}%) contrast(${camContrast}%) saturate(${camSaturation}%)`;
    renderer.domElement.style.filter = filter;
    const bVal = $('cam-brightness-val'); if (bVal) bVal.textContent = `${camBrightness}%`;
    const cVal = $('cam-contrast-val'); if (cVal) cVal.textContent = `${camContrast}%`;
    const sVal = $('cam-saturation-val'); if (sVal) sVal.textContent = `${camSaturation}%`;
  };

  $('cam-brightness')?.addEventListener('input', (e) => {
    camBrightness = parseInt(e.target.value, 10) || 100;
    updateCamFilterPreview();
  });
  $('cam-contrast')?.addEventListener('input', (e) => {
    camContrast = parseInt(e.target.value, 10) || 100;
    updateCamFilterPreview();
  });
  $('cam-saturation')?.addEventListener('input', (e) => {
    camSaturation = parseInt(e.target.value, 10) || 100;
    updateCamFilterPreview();
  });
  $('cam-reset-adjust')?.addEventListener('click', () => {
    audio.playClick();
    camBrightness = 100;
    camContrast = 100;
    camSaturation = 100;
    const bInput = $('cam-brightness'); if (bInput) bInput.value = '100';
    const cInput = $('cam-contrast'); if (cInput) cInput.value = '100';
    const sInput = $('cam-saturation'); if (sInput) sInput.value = '100';
    updateCamFilterPreview();
  });

  const closeViewfinder = () => {
    audio.playClick();
    renderer.domElement.style.filter = '';
    $('geotag-modal')?.classList.add('hidden');
  };
  $('btn-close-geotag')?.addEventListener('click', closeViewfinder);

  $('btn-geotag')?.addEventListener('click', () => {
    audio.playChirp();
    const modal = $('geotag-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    // If inside cabin, glide smoothly to Cupola 7-Window observation dome (Stop 7)
    if (rig.mode !== 'ext' && eva.view === 'cabin') {
      const cupolaIdx = STOPS.findIndex((s) => s.id === 'window' || s.title?.includes('Cupola'));
      if (cupolaIdx >= 0) rig.goTo(cupolaIdx, 2.0);
    }

    updateCamFilterPreview();
    const lm = getLiveSubSatelliteRegion();
    if ($('target-name')) $('target-name').textContent = lm.name;
    if ($('target-coords')) $('target-coords').textContent = lm.coords;
    if ($('vf-time')) {
      const now = new Date();
      $('vf-time').textContent = `EXPEDITION 71 · UTC ${now.toISOString().substring(11, 19)}`;
    }
    hud.toast('Nikon D6 Astrophotography Viewfinder Engaged');
  });

  // Photo Preview Dialog Actions
  $('btn-download-photo')?.addEventListener('click', () => {
    audio.playClick();
    if (!lastCapturedPhotoUrl) return;
    const a = document.createElement('a');
    a.download = `NASA_ISS_CUPOLA_ASTROPHOTO_${Date.now()}.jpg`;
    a.href = lastCapturedPhotoUrl;
    a.click();
    hud.toast('NASA Expedition 71 Astrophoto Downloaded!');
  });
  $('btn-retake-photo')?.addEventListener('click', () => {
    audio.playClick();
    $('photo-preview-modal')?.classList.add('hidden');
    hud.toast('Ready for next shot');
  });
  $('btn-close-photo-preview')?.addEventListener('click', () => {
    audio.playClick();
    $('photo-preview-modal')?.classList.add('hidden');
  });

  // ---- Snap Postcard Snapshot Exporter ----
  $('btn-snap-photo')?.addEventListener('click', () => {
    audio.playClick();

    // Trigger visual shutter flash
    const flashEl = $('cam-flash');
    if (flashEl) {
      flashEl.classList.remove('flash-anim');
      void flashEl.offsetWidth;
      flashEl.classList.add('flash-anim');
    }

    try {
      // Force high-fidelity frame render with post-processing
      if (typeof post !== 'undefined' && post.render) {
        post.render(performance.now() * 0.001);
      } else {
        renderer.render(world.scene, camera);
      }
      const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.98);

      // Create composite postcard canvas with user adjustments & NASA Expedition 71 Watermark
      const postCanvas = document.createElement('canvas');
      postCanvas.width = 1920;
      postCanvas.height = 1080;
      const ctx = postCanvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        // Apply user-chosen Brightness, Contrast, and Saturation filters directly to exported photo!
        ctx.filter = `brightness(${camBrightness}%) contrast(${camContrast}%) saturate(${camSaturation}%)`;
        ctx.drawImage(img, 0, 0, 1920, 1080);
        ctx.filter = 'none'; // reset filter for watermark & text overlays

        // Gradient banner at bottom
        const grad = ctx.createLinearGradient(0, 900, 0, 1080);
        grad.addColorStop(0, 'rgba(2, 6, 14, 0)');
        grad.addColorStop(1, 'rgba(2, 6, 14, 0.94)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 870, 1920, 210);

        // Aerospace typography overlay
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 26px "JetBrains Mono", monospace';
        ctx.fillText('NASA // EXPEDITION 71 · CUPOLA ASTROPHOTOGRAPHY', 48, 985);

        const lm = getLiveSubSatelliteRegion();
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px "Inter", sans-serif';
        ctx.fillText(`${lm.name} — ${lm.coords}`, 48, 1020);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px "JetBrains Mono", monospace';
        ctx.fillText(`FILTER: BRI ${camBrightness}% · CON ${camContrast}% · SAT ${camSaturation}%`, 48, 1052);

        ctx.textAlign = 'right';
        ctx.fillText(`CAPTURED: ${new Date().toISOString()} · ISS ALT 408 KM · 51.6° INC`, 1872, 1052);
        ctx.textAlign = 'left';

        lastCapturedPhotoUrl = postCanvas.toDataURL('image/jpeg', 0.94);

        // Present Photo Preview Dialog so user can review the picture before downloading!
        const previewModal = $('photo-preview-modal');
        const previewImg = $('photo-preview-img');
        if (previewModal && previewImg) {
          previewImg.src = lastCapturedPhotoUrl;
          previewModal.classList.remove('hidden');
        }
        hud.toast('Orbital Astrophoto Captured! Review your image.');
      };
      img.src = dataUrl;
    } catch (e) {
      console.warn('Postcard snapshot error:', e);
      hud.toast('Astrophoto Frame Captured');
    }
  });

  // ---- Real-Time NORAD TLE Orbit Tracking Calculation ----
  // Updates in real time, synchronized 1:1 with Earth 3D model rotation!
  let lastBadgeText = '', lastBadgeLoc = '';
  function updateOrbitBadge() {
    const lm = getLiveSubSatelliteRegion();
    const newCoords = `ISS LEO · ${lm.coords.split('(')[0].trim()} · 408 KM · 27,600 KM/H`;
    const newLoc = `OVERFLYING: ${lm.name.split('(')[0].trim()}`;

    if (newCoords !== lastBadgeText) {
      lastBadgeText = newCoords;
      const coordsEl = $('iss-tle-coords');
      if (coordsEl) coordsEl.textContent = newCoords;
    }
    if (newLoc !== lastBadgeLoc) {
      lastBadgeLoc = newLoc;
      const locEl = $('iss-tle-location');
      if (locEl) locEl.textContent = newLoc;
    }

    // Update astrophotography modal target if open
    const targetNameEl = $('target-name');
    if (targetNameEl && !$('geotag-modal')?.classList.contains('hidden')) {
      targetNameEl.textContent = lm.name;
      if ($('target-coords')) $('target-coords').textContent = lm.coords;
      const targetTypeEl = document.querySelector('.target-type');
      if (targetTypeEl) targetTypeEl.textContent = lm.type;
    }
  }
  window.updateOrbitBadge = updateOrbitBadge;
  setInterval(updateOrbitBadge, 1000);
  let crewView = false;
  const lookThrough = (target) => {
    if (!target) return;
    const m = (target.holder ? target : crew.members.find((am) => am.c === target || am.c?.id === (target.id || target))) || crew.members[0];
    if (!m) return;
    crewView = true;
    document.body.classList.add('helmet');
    audio.playChirp(true);
    $('btn-crew')?.classList.add('on');
    crew.setFirstPerson(m);
    hud.setHelmet(m);
    syncSel();

    // Sync helmet-select dropdown to display the active astronaut:
    if (helmetSel) {
      helmetSel.value = `helmet:${m.c.id}`;
    }

    // If astronaut is deployed outside on an EVA spacewalk:
    if (m.out) {
      eva.sendOut(m.c.id, 'pov');
      document.body.classList.add('outside');
      hud.toast(`Spacewalk Helmet POV · ${m.c.role}`);
      updateInstructionHud(true);
      return;
    }

    // Inside cabin view (stays inside cabin):
    if (rig.mode === 'ext') eva.leave();
    rig.crewView(m);
    document.body.classList.remove('outside');
    hud.toast(`Helmet HUD · ${m.c.role}`);
    updateInstructionHud(true);
  };
  const leaveHelmet = () => {
    if (!crewView) return;
    crewView = false;
    document.body.classList.remove('helmet');
    audio.stopMasterAlarm?.();
    audio.playClick();
    $('btn-crew')?.classList.remove('on');
    crew.setFirstPerson(null);
    if (helmetSel) {
      helmetSel.value = 'helmet:none';
    }
    syncSel();
    if (rig.mode === 'ext') {
      eva.show('station');
    } else {
      rig.exitFocus();
      const commander = crew.members.find((m) => !m.out) || crew.members[0];
      hud.setHelmet(commander);
      hud.toast('Exit Helmet POV · Cabin Tour View');
    }
    updateInstructionHud(true);
  };
  director.onCabin = (safeIdx) => {
    eva.show('cabin');
    document.body.classList.remove('intro', 'show-intro', 'outside', 'ext-mode');
    if (safeIdx === 0) {
      const commander = crew.members.find((m) => !m.out) || crew.members[0];
      if (commander) {
        lookThrough(commander);
        hud.setStop(0, true);
        syncSel();
        updateInstructionHud(true);
        return;
      }
    }
    leaveHelmet();
    rig.mode = 'tour';
    rig.enabled = true;
    rig.goTo(safeIdx, 0.4);
    syncSel();
    updateInstructionHud(true);
    setTimeout(() => {
      hud.toast('ISS Flight Deck Active · Scroll Mouse or Drag to Tour Deck Modules');
    }, 300);
  };
  rig.onExitFocus = () => {
    if (!closingCrew) closeCrew();
    crewView = false;
    document.body.classList.remove('helmet');
    audio.stopMasterAlarm?.();
    $('btn-crew').classList.remove('on');
    crew.setFirstPerson(null);
  };
  window.lookThrough = lookThrough;
  window.leaveHelmet = leaveHelmet;
  // Dedicated Fullscreen Toggle
  const fsBtn = $('btn-fullscreen');
  if (fsBtn) {
    const updateFsIcon = () => {
      const isFS = !!document.fullscreenElement;
      fsBtn.classList.toggle('on', isFS);
      fsBtn.title = isFS ? 'Exit Fullscreen' : 'Toggle Fullscreen';
      fsBtn.innerHTML = isFS
        ? `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg><span class="btn-lbl">Exit Fullscreen</span>`
        : `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg><span class="btn-lbl">Fullscreen</span>`;
    };
    fsBtn.addEventListener('click', () => {
      audio.playClick();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', updateFsIcon);
  }

  $('btn-crew')?.addEventListener('click', () => {
    if (crewView) leaveHelmet();
    else {
      const isInside = !document.body.classList.contains('outside') && eva.view === 'cabin';
      let target = null;
      if (isInside) {
        target = (crew.selected && !crew.selected.out) ? crew.selected : (crew.members.find((m) => !m.out) || crew.members[0]);
      } else {
        const w = eva.getActiveWalker();
        target = (w && w.member) || crew.members.find((m) => m.out) || crew.members[0];
      }
      lookThrough(target);
    }
  });
  addEventListener('keydown', (e) => {
    const n = '1234'.indexOf(e.key);
    if (n >= 0 && crew.members[n]) lookThrough(crew.members[n]);
  });
  let closingCrew = false;
  const closeCrew = () => {
    if (closingCrew) return;
    closingCrew = true;
    crew.select(null);
    hud.closePanel();
    if (rig.mode === 'focus') rig.exitFocus();
    closingCrew = false;
  };
  window.closeCrew = closeCrew;
  $('cp-close').addEventListener('click', closeCrew);

  /* Astronaut Manual Zero-G Flight & 360° Rotation Controls */
  const astroKeys = new Set();
  const FLIGHT_KEYS = ['w', 'a', 's', 'd', 'z', 'x', ' ', 'shift', 'q', 'e', 'r', 'f', 'j', 'l', 'i', 'k', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (FLIGHT_KEYS.includes(k)) {
      astroKeys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    }
    if (e.key === 'Escape') {
      if (live.closeTerminal()) return;
      if (live.release()) { hud.toast('Monitor released'); return; }
      if (rig.mode === 'ext') eva.show('cabin');
      closeCrew();
      leaveHelmet();
    }
    if (e.key.toLowerCase() === 'g') $('debug').classList.toggle('hidden');
  });
  addEventListener('keyup', (e) => {
    astroKeys.delete(e.key.toLowerCase());
  });

  /* ---------- pointer: look, hover, drag-crew, click ---------- */
  const dom = renderer.domElement; let down = null;
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => {
    if (!rig.enabled) return;
    try { dom.setPointerCapture(e.pointerId); } catch (_) {}
    if (live.release()) hud.toast('Monitor released');
    const m = crew.pick(e.clientX, e.clientY, dom);
    if (m) {
      crew.select(m);
      audio.playChirp();
    }
    rig.isDragging = true;
    rig.vYaw = 0;
    rig.vPitch = 0;
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, m, moved: false, id: e.pointerId, button: e.button, shiftKey: e.shiftKey };
    stage.classList.add('dragging');
  });
  let lastHoverTime = 0;
  dom.addEventListener('pointermove', (e) => {
    rig.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    if (down) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > (down.m ? 5 : 1)) {
        down.moved = true;
        if (down.m) crew.startDrag(down.m);
      }
      if (down.moved) {
        if (down.m) {
          rig.blockTouch = true;
          crew.dragTo(e.clientX, e.clientY, dom);
        } else {
          const isPan = down.button === 1 || down.button === 2 || e.shiftKey;
          rig.dragLook(dx, dy, isPan);
        }
      }
    } else if (rig.enabled && world.phase === 'cabin') {
      const now = performance.now();
      if (now - lastHoverTime > 35) {
        lastHoverTime = now;
        const m = crew.pick(e.clientX, e.clientY, dom);
        crew.setHover(m);
        stage.classList.toggle('hover', !!m);
      }
    }
  });
  // Mouse wheel: adjust astronaut height if actively dragging crew, otherwise rig.js handles smooth tour scrolling
  dom.addEventListener('wheel', (e) => {
    if (rig.mode === 'ext') {
      e.preventDefault();
      rig.scrollBy(e.deltaY);
      return;
    }
    const draggingM = down && down.m && crew.dragging;
    if (draggingM && world.phase === 'cabin' && rig.mode !== 'ext') {
      e.preventDefault();
      const deltaY = -Math.sign(e.deltaY) * 0.9;
      crew.adjustHeight(draggingM, deltaY);
      audio.playClick();
      return;
    }
  }, { passive: false });
  const up = (e) => {
    rig.isDragging = false;
    if (!down) return; stage.classList.remove('dragging');
    rig.blockTouch = false;
    if (crew.dragging) crew.endDrag();
    else if (down.m && !down.moved) { crew.select(down.m); hud.openPanel(down.m); rig.focusCrew(down.m); }
    else if (!down.moved) {
      const it = live.hit(e.clientX, e.clientY);
      if (it) {
        live.grab(it);
        hud.toast(`${it.cfg.label} · interactive — Esc to release`);
      } else {
        closeCrew();
      }
    }
    down = null;
  };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('pointerleave', () => { rig.setPointer(0, 0); rig.isDragging = false; });
  rig.blockTouch = false;

  /* ---------- resize ---------- */
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    labels.setSize(innerWidth, innerHeight); post.resize(innerWidth, innerHeight, pr);
  };
  addEventListener('resize', resize); resize();

  /* ---------- go ---------- */
  clearTimeout(forceDismissTimer);
  document.body.classList.remove('booting');
  setTimeout(() => { $('loader').style.display = 'none'; }, 1000);
  try {
    audio.init();
    audio.playIntroAtmosphere();
  } catch (err) {
    console.warn('[Audio] Autoplay deferred until user gesture', err);
  }
  const qParams = new URLSearchParams(window.location.search);
  const skipArrival = qParams.get('arrival') === 'false' || qParams.get('skip') === '1' || qParams.has('stop');
  const targetStopParam = qParams.get('stop');
  const targetViewParam = qParams.get('view');

  if (skipArrival) {
    let stopIdx = 0;
    if (targetStopParam !== null) {
      stopIdx = isNaN(targetStopParam)
        ? STOPS.findIndex(s => s.id === targetStopParam)
        : parseInt(targetStopParam, 10);
      if (stopIdx < 0 || stopIdx >= STOPS.length) stopIdx = 0;
    }
    director.skip(stopIdx);
    if (targetViewParam) {
      setTimeout(() => eva.show(targetViewParam), 400);
    }
  } else {
    director.play();
  }
  setInterval(tickVitals, 1000);
  setInterval(() => { hud.tick(); crew.refreshTags(); }, 250);
  console.info('[HELIOS] telemetry ->', wsUrl, '| live pages ->', HELIOS.appUrl);

  /* ---------- loop ---------- */
  const clock = new THREE.Clock(); let t = 0, acc = 0, frames = 0;
  let isPageVisible = !document.hidden;
  document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    if (isPageVisible) clock.start();
  });

  let _lastOutside = null, _lastIntro = null, _lastExtMode = null, _lastHelmet = null;
  let currentPr = pr, slowCount = 0, fastCount = 0;

  renderer.setAnimationLoop(() => {
    if (!isPageVisible) return;
    const dt = Math.min(clock.getDelta(), 0.05); t += dt;
    director.update(dt, t);
    eva.update(dt, t);
    rig.update(dt, t);
    const inCabin = world.phase === 'cabin', ext = rig.mode === 'ext';
    const isOutside = !inCabin || ext || eva.view !== 'cabin';
    const isHelmetView = (crewView || rig.mode === 'crew') && (!isOutside || (eva.view === 'pov' && eva.hasActiveWalkers()));

    if (_lastOutside !== isOutside) { _lastOutside = isOutside; document.body.classList.toggle('outside', isOutside); }
    const isIntro = director.state !== 'cabin';
    if (_lastIntro !== isIntro) { _lastIntro = isIntro; document.body.classList.toggle('intro', isIntro); }
    const isExtMode = ext || !inCabin;
    if (_lastExtMode !== isExtMode) { _lastExtMode = isExtMode; document.body.classList.toggle('ext-mode', isExtMode); }
    if (_lastHelmet !== isHelmetView) { _lastHelmet = isHelmetView; document.body.classList.toggle('helmet', isHelmetView); }

    // Apply manual astronaut flight controls (WASD travel + Z/X height + Q/E 360° rotation)
    if (astroKeys.size > 0) {
      let dx = 0, dy = 0, dz = 0;
      if (astroKeys.has('a')) dx -= 1;
      if (astroKeys.has('d')) dx += 1;
      if (astroKeys.has('w')) dz -= 1;
      if (astroKeys.has('s')) dz += 1;
      // Z increases height / altitude (+Y), X decreases height (-Y)
      if (astroKeys.has('z') || astroKeys.has(' ')) dy += 1;
      if (astroKeys.has('x') || astroKeys.has('shift')) dy -= 1;

      // Full 360° Keyboard Rotation:
      // Q / ArrowLeft / J: Rotate Yaw Left (360° continuously)
      // E / ArrowRight / L: Rotate Yaw Right (360° continuously)
      // ArrowUp / PageUp: Pitch Up
      // ArrowDown / PageDown: Pitch Down
      let dYaw = 0, dPitch = 0;
      if (astroKeys.has('q') || astroKeys.has('arrowleft') || astroKeys.has('j')) dYaw += 1;
      if (astroKeys.has('e') || astroKeys.has('arrowright') || astroKeys.has('l')) dYaw -= 1;
      if (astroKeys.has('arrowup') || astroKeys.has('pageup') || astroKeys.has('i')) dPitch += 1;
      if (astroKeys.has('arrowdown') || astroKeys.has('pagedown') || astroKeys.has('k')) dPitch -= 1;

      const isEvaMode = Boolean((eva.active || ext || eva.view !== 'cabin' || (eva.hasActiveWalkers && eva.hasActiveWalkers())) && (eva.getActiveWalker && eva.getActiveWalker()));

      if (isEvaMode) {
        // Spacewalk / EVA visor flight controls:
        // W = Front / Forward, S = Back / Backward, A = Left, D = Right, Z/Space = Ascend, X/Shift = Descend
        if (dx !== 0 || dy !== 0 || dz !== 0) {
          eva.move(dx, dy, dz, dt, camera);
        }
        if (dYaw !== 0 || dPitch !== 0) {
          eva.rotate(dYaw, dPitch, dt);
        }
      } else if (crew.selected || (rig.mode === 'crew' && (rig.focusM || hud.helmet)) || (rig.mode === 'focus' && rig.focusM)) {
        const activeTarget = crew.selected || rig.focusM || hud.helmet;
        if (activeTarget && !activeTarget.out) {
          if (dx !== 0 || dy !== 0 || dz !== 0) {
            crew.moveAstronaut(activeTarget, dx, dy, dz, dt, camera);
          }
          if (dYaw !== 0 || dPitch !== 0) {
            crew.rotateAstronaut(activeTarget, dYaw, dPitch, dt);
          }
        }
      } else {
        // Free camera flight inside ISS cabin (Game-style 6-DOF controls):
        // W = Front / Forward along camera view direction
        // S = Back / Backward along camera view direction
        // A = Strafe Left, D = Strafe Right
        // Space / Z = Ascend (+Y), Shift / X = Descend (-Y)
        // Q / E = Rotate Yaw Left / Right (360° game-style)
        if (dx !== 0 || dy !== 0 || dz !== 0) {
          rig.moveCamera(dx, dy, dz, dt, camera);
        }
        if (dYaw !== 0 || dPitch !== 0) {
          rig.rotateCamera(dYaw, dPitch, dt);
        }
      }
    }

    crew.update(dt, t, inCabin && !ext);
    world.update(dt, t, camera, ext);
    world.cabin.visible = inCabin && !ext; world.hotspots.forEach((h) => { h.visible = inCabin && !ext; }); // on a spacewalk the cabin shell must not float in space
    screens.update(dt, t, inCabin);
    hud.update(rig.cur, inCabin && rig.mode === 'tour' && rig.enabled, isHelmetView, rig.sx, rig.sy);
    live.update();
    hud.drawEcg(t);
    post.render(t);
    labels.render(scene, camera);

    // Frame metrics & Adaptive Dynamic Resolution
    acc += dt; frames++;
    if (acc > 2) {
      const ms = (acc / frames) * 1000; acc = 0; frames = 0;
      if (ms > 23.0 && currentPr > 0.85) {
        slowCount++; fastCount = 0;
        if (slowCount >= 2) {
          slowCount = 0;
          currentPr = Math.max(0.85, currentPr - 0.15);
          renderer.setPixelRatio(currentPr);
          post.resize(innerWidth, innerHeight, currentPr);
        }
      } else if (ms < 15.0 && currentPr < pr) {
        fastCount++; slowCount = 0;
        if (fastCount >= 4) {
          fastCount = 0;
          currentPr = Math.min(pr, currentPr + 0.1);
          renderer.setPixelRatio(currentPr);
          post.resize(innerWidth, innerHeight, currentPr);
        }
      }
      if (!$('debug').classList.contains('hidden')) {
        const p = camera.position, l = rig.lookAt;
        $('debug').textContent = `fps ${(1000 / ms).toFixed(0)}  pr ${currentPr.toFixed(2)}\ncam  ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\nlook ${l.x.toFixed(1)}, ${l.y.toFixed(1)}, ${l.z.toFixed(1)}\nstop ${rig.activeIndex + 1}/${STOPS.length}  u=${rig.cur.toFixed(3)}\nphase ${world.phase}`;
      }
    }
  });
}

boot().catch(showError);
