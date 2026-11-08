# HELIOS · 3D CABIN

Scroll-driven, mouse-interactive 3D tour of a space station: orbital approach → airlock white-out → weightless float through the cabin
(10 stops, no text panels while scrolling, helmet-visor HUD, spacewalking astronaut, floating crew with live tags, live wall dashboards, forward window onto Earth).

## Run it
Browsers will not load 3D models from `file://`, so serve the folder:

- **Windows:** double-click `start.bat`
- **Mac / Linux:** `./start.sh`
- or anything you like: `python3 -m http.server 5173` / `npx http-server . -p 5173`

Then open **http://localhost:5173** (Chrome / Edge recommended). It needs internet once per session to fetch Three.js, GSAP and fonts from a CDN.

## Controls
| Action | Input |
|---|---|
| Float forward / back | Mouse wheel, trackpad, touch swipe, ↑ ↓ |
| Jump between stops | Right-hand dots, ← → |
| Change view | Move the mouse (parallax) or click-drag the background |
| Nudge position / roll | W A S D / Q E (R resets view, Space pauses drift) |
| Inspect a crew member | Click them (camera glides in, vitals panel opens, Esc to close) |
| **Move a crew member** | Click-drag them; release to throw them (they keep drifting) |
| Shuffle crew | "Shuffle crew" button |
| Look through a helmet | "Crew view" button |
| **VIEW dropdown** (top bar, always visible) | Inside the cabin · jump to cockpit / cupola windows · **Outside views (no astronaut needed):** orbit the station, station above Earth · **Spacewalk:** watch / helmet cam (an astronaut is sent automatically) · send any crew member out · bring back |
| Back from outside | orange **↩ Back inside** button or Esc |
| Debug overlay | G |

## Your models (`/model`)
Every `.glb/.gltf` in `/model` is picked up automatically (run `node tools/gen-manifest.mjs`, or just `start.sh/.bat`, after adding files).
Files are matched to roles by name keywords (see `rules` in `src/config.js`); override explicitly with `CONFIG.override = { astronaut: 'my_file.glb' }`.

Roles: cabin interior · airlock corridor · station exterior · Earth · animated astronaut · wall monitor · desk console.
**Anything missing is generated procedurally** (`src/procedural.js`), so the experience always runs. The browser console prints a LOADED / GENERATED table.

## What's new in this version
- **Much bigger cabin** (30 × 28 × 112 units, was 20 × 19 × 60) rebuilt like the reference photos: white padded panels, rack doors, fluorescent light bars, blue tie lines, cargo bags with olive straps, gold portholes, cable looms (`src/module.js`).
- **Cockpit / cupola** at the front: a dark bay with 4 big windows onto Earth, the three sci-fi desk consoles set up in an arc (`CONSOLES` in config.js) and live dashboards on the cockpit desk. Pilot, commander and engineer start there.
- **VIEW dropdown** that always shows (the old EVA menu was hidden on narrow windows / phones) + outside views that need no astronaut.

## Tuning (all in `src/config.js`)
- `STOPS` – camera position / look-at / FOV / caption for each of the 10 stops
- `CREW` – roles, heart rates, start positions, which are off-nominal (red ring)
- `CABIN` – size of the module + cockpit bay (`profile`, `halfX`, `halfZ`, `bay`)
- `MONITORS`, `CONSOLES` – where the wall screens sit / how the cockpit consoles are arranged
- `scroll`, `sway`, `look`, `bloom`, `crewDrift`, `crewScale`, `dragThrow` – feel
- `CONFIG.consoleUrl` – where "← Console" navigates
- Wall dashboards are drawn in `src/screens.js`; the visor HUD is plain HTML/CSS in `index.html` + `css/style.css`

Tip: press **G**, fly to a spot you like, and copy the camera numbers into `STOPS`.

## Structure
```
index.html  css/style.css
model/                 your GLB files + manifest.json
src/main.js            boot, loop, input
src/config.js          every tunable
src/assets.js          model scan + classification + loading
src/procedural.js      generated stand-ins
src/world.js           space, Earth, station, cabin, lights, shafts, monitors
src/astronauts.js      crew: float, tags, hover, click, drag-to-move, shuffle
src/rig.js             scroll-driven spline camera, mouse look, focus modes
src/director.js        intro → corridor white-out → cabin
src/screens.js         live dashboards drawn to canvas textures
src/hud.js  post.js  audio.js  data.js  util.js
```

---
# v3 changes (H.E.L.I.O.S project integration)

**Crew: exactly 4 astronauts** (Commander, Pilot, Medical Officer, Mission Specialist) - `CREW` in `src/config.js`.

**Wall monitors (2):** monitor 1 = the real **Main Dashboard** (`/`), monitor 2 = the real **MCC** (`/mcc`).
The pages are shown as iframes glued to the 3D screens (`src/livescreens.js`). Far away / behind an astronaut / back-facing -> the 3D screen
(same live data, drawn in `src/screens.js`) shows instead. **Click a monitor to interact with the page, Esc to release.** Top bar button "Live pages" toggles it.

**Helmet HUD per astronaut:** stop 01 (hatch) and "Crew view" / VIEW -> "Look through a helmet" / keys `1` `2` `3` `4`. Style follows the project's `/suit-hud`
(visor curvature, glare + vignette, +-14px head parallax, Rajdhani/Tomorrow type, waypoint reticle). Data = that astronaut's real telemetry.

**Real data:** `src/telemetry.js` connects to `ws://localhost:8000/ws/telemetry` (10 Hz). If the backend is off, everything falls back to simulated values
(HUD shows `SIM`; with the backend it shows `LIVE 10Hz`).

## Run everything
1. Backend:  `python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload`
2. Frontend: `cd frontend && npm run dev`  (http://localhost:3000)
3. Cabin:    `./start.sh` -> http://localhost:5173
Custom hosts: `http://localhost:5173/?app=http://HOST:3000&api=http://HOST:8000` (`&live=0` = no iframes).

## Needed on the H.E.L.I.O.S side (otherwise the iframes show a "refused to connect" page)
- Backend security middleware (SEC-06) sends `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self' http://localhost:5173 http://127.0.0.1:5173` (configurable via `HELIOS_EMBED_ORIGINS`).
- Frontend supports `?embed=1&cabin=1` mode to strip browser-like chrome for wall monitors, fit iframe 1280px 1.65:1 without scrollbars.
- Demo embed flag: `VITE_HELIOS_DEMO_EMBED=true` (off by default) in `frontend/.env`.

---

## Real WebSocket Message Schema & Example

The H.E.L.I.O.S backend streams 10 Hz real-time multi-agent telemetry via WebSocket envelopes:

### Envelope 1: `TELEMETRY_FRAME`
```json
{
  "type": "TELEMETRY_FRAME",
  "data": {
    "astronaut_id": "AST-01_COMMANDER",
    "timestamp": "2026-10-31T12:00:00.000Z",
    "heart_rate": 62.0,
    "hrv_rmssd": 45.2,
    "spo2": 98.2,
    "core_temp": 36.7,
    "respiration_rate": 15.0,
    "sleep_score": 91.0,
    "cabin_co2": 2.6,
    "radiation_flux": 0.04,
    "radiation_dose_gy": 0.0291,
    "computed_arf": 0.74,
    "computed_trm": 1.0,
    "computed_epi": 0.0,
    "computed_rsi": 0.1,
    "alert_severity": "NOMINAL",
    "scenario_phase": "NOMINAL_CRUISE",
    "active_anomaly": null
  },
  "mars_delay_active": false,
  "delay_seconds": 0.0
}
```

### Envelope 2: `PROACTIVE_ALERT`
```json
{
  "type": "PROACTIVE_ALERT",
  "data": {
    "speech_text": "Commander Haley: Microgravity cardiovascular adaptation nominal. Keep hydration rate steady.",
    "triage_diagnosis": "Cardiovascular stability within NASA-STD-3001 bounds.",
    "actionable_instruction": "Maintain scheduled aerobic cycle protocol at 14:00 MET."
  }
}
```

---

## Integration Summary of Changes

1. **`backend/app/main.py`**:
   - Replaced strict `X-Frame-Options: DENY` with `SAMEORIGIN`.
   - Updated Content-Security-Policy `frame-ancestors 'self' http://localhost:5173 http://127.0.0.1:5173` dynamically parsed from `HELIOS_EMBED_ORIGINS` environment variable.
2. **`frontend/src/App.tsx` & `frontend/src/index.css`**:
   - Added `?embed=1&cabin=1` query parameter detection.
   - Hides `HeaderBar`, `ScenarioController`, and other non-monitor chrome.
   - Sets `body.embed-mode` with `overflow: hidden`, dark background, and 1.65:1 viewport fit.
   - Created `frontend/.env.example` documenting `VITE_HELIOS_DEMO_EMBED`.
3. **`HELIOS_3D_CABIN_v3/helios/src/config.js`**:
   - Canonicalized crew slugs to the 4 official NASA IDs: `AST-01_COMMANDER`, `AST-02_PILOT`, `AST-03_MEDICAL`, `AST-04_ENGINEER`.
   - Updated baselines to match `data/nasa_astronaut_baselines.json`.
4. **`HELIOS_3D_CABIN_v3/helios/src/telemetry.js`**:
   - Unwraps outer `TELEMETRY_FRAME` payload before mapping data fields.
   - Added proactive alert event parsing mapping JARVIS directives into `vitals.directive`.
   - Preserves offline `SIM` fallback.
5. **`HELIOS_3D_CABIN_v3/helios/index.html` & `css/style.css`**:
   - Faithfully implemented NASA ski-goggle visor shape and outer helmet interior mask from `geometry.ts` (`VISOR_D`, 1024x571 artboard).
   - Matched exact `/suit-hud` CSS tokens (`--hud: #62f3f7`, `--hud-line`, `--hud-text`, `--hud-bright`).
6. **`HELIOS_3D_CABIN_v3/helios/src/screens.js`**:
   - Updated 3D canvas fallback screens with obsidian `#070707` and `Tomorrow` font tokens.
