# TASK FOR ANTIGRAVITY - connect HELIOS 3D CABIN to the H.E.L.I.O.S project

You have TWO codebases:
1. **H.E.L.I.O.S project** (my NASA Space Apps 2026 project): React 19 + TypeScript + Vite frontend (`frontend/`), FastAPI backend (`backend/app`), routes `/` (cockpit/main dashboard), `/suit-hud` (first-person helmet HUD), `/mcc` (Earth Mission Control console), WebSocket `/ws/telemetry` at 10 Hz. Dev: frontend http://localhost:3000, backend http://localhost:8000.
2. **HELIOS 3D CABIN** (`helios/`, Three.js, no build step, ES modules, `python3 -m http.server 5173` or `./start.sh`). It already contains the first integration pass: 4 astronauts, 2 wall monitors, helmet HUD, telemetry client, iframe projection. Your job is to finish and verify it against the REAL project code.

## HARD RULES
- **Do NOT change the visual style of the 3D cabin** (geometry, materials, lighting, camera path, models, post-processing). It must stay identical to the current zip. Only touch what is listed below.
- Exactly **4 astronauts** everywhere (3D crew, tags, VIEW dropdown, HUD crew strip, screens, counters like "CREW 4 ONLINE"). No 5th/6th crew member anywhere.
- All numbers shown on monitors and in helmet HUDs must come from the H.E.L.I.O.S backend/frontend, never invented. Simulation is only an offline fallback and must be labelled `SIM`.

## PART A - Real data (helios/src/telemetry.js, data.js, config.js)
1. Open the backend WebSocket handler (`/ws/telemetry`, `backend/app/main.py` + the telemetry feeder / sentry_matrix.py). Print one real message and its schema.
2. Make `src/telemetry.js` parse the **exact** schema (keep the tolerant fallback). Map every field to: `hrNow, spo2Now, respNow, tempNow, hrvNow, state (NOMINAL|WARNING|CRITICAL), risk {arf,trm,epi,rsi}`, cabin `co2, flux, dose`, `alerts[]`, JARVIS `directive`.
3. Find the real list of crew (names, slugs used by `/telemetry/:slug`, roles, baselines in `data/nasa_astronaut_baselines.json`). Set the 4 entries of `CREW` in `src/config.js` (`slug`, `role`, `call`, `match`) to the real crew. If the backend has more than 4 astronauts, use the 4 the project treats as the main crew and tell me which ones. (My guesses currently in config: jared / sian / haley / chris - verify, they are only placeholders except `haley`.)
4. If the backend streams per-astronaut data on separate sockets or REST endpoints instead of one stream, adapt `startTelemetry()` accordingly.
5. Verify in the browser: HUD link badge shows `LIVE 10Hz`; trigger one of the 18 scenarios in the main dashboard and confirm the cabin helmet HUD, the 3D wall screens, the in-world crew tags and the red off-nominal ring react within ~1 s.

## PART B - Wall monitors = real pages
Two wall monitors (`MONITORS` in config.js): `board` -> Main Dashboard (`/`), `alerts` -> MCC (`/mcc`). They are iframes projected onto the 3D screens (`src/livescreens.js`).
1. **Allow framing.** The backend SEC-06 middleware sends `X-Frame-Options: DENY` and a strict CSP. Change it so the cabin origin can embed the app: remove `X-Frame-Options` (or `SAMEORIGIN`) and set CSP `frame-ancestors 'self' http://localhost:5173 http://127.0.0.1:5173` (read allowed origins from an env var `HELIOS_EMBED_ORIGINS`, default those two). Keep every other SEC-xx header and the existing security tests passing (`pytest`; update the SEC-06 test to the new expected header).
2. **Embed mode.** Add a `?embed=1&cabin=1` mode to the React app: hide browser-like chrome that does not make sense inside a monitor, avoid scrollbars (`overflow:hidden`, fit to the iframe size, which is 1280px wide with 1.65:1 aspect), keep all live data/waveforms running at full speed.
3. **MCC auth gate.** `/mcc` is auth-gated. For `?embed=1` in **demo mode only** (env flag `HELIOS_DEMO_EMBED=true`, off by default) skip the login modal so the monitor shows the console. Do not weaken real authentication when the flag is off. Document the flag.
4. Verify: the two monitors show the real dashboard and real MCC, animated, at the start (stop 02 "Main Dashboard") and (stop 05 "Mission Control (MCC)"). Click a monitor -> it becomes interactive, Esc releases. If a page fails to load, the 3D canvas screen must show through (it does by design) - confirm there is no blank rectangle.
5. Keep `src/screens.js` (the 3D fallback screens) visually consistent with the real pages: use the exact colours/typography of the project's cockpit page and MCC page (read the React components and CSS tokens, e.g. obsidian `#070707`, `Tomorrow` font) instead of my approximations.

## PART C - Helmet HUD = copy of `/suit-hud` (helmet style only)
The helmet HUD in the cabin (`#visor` in `index.html`, `.hl-*` in `css/style.css`, `src/hud.js`) is a rough approximation I wrote from documentation only. Replace it with a faithful copy of the **helmet / visor styling** of the React `/suit-hud` page:
1. Find the SuitHud component and its CSS. Copy: visor curvature shape and frame, vignette, glare layers, scanlines, colours, borders, clip-paths, typography (`Rajdhani`, `Tomorrow`), element positions and proportions, animations, head-tracking parallax (+-14px), waypoint reticle.
2. **Do NOT copy the planetary backdrops** (Mars / Lunar / ISS photo) - the backdrop in the cabin is the 3D cabin itself.
3. Convert React/JSX to plain HTML + CSS + JS inside the cabin (no build step, no React). Keep ids used by `hud.js` or update `hud.js` accordingly.
4. Each of the 4 astronauts has his/her own HUD (selected via stop 01 = Commander, "Crew view" button, VIEW -> "Look through a helmet", keys 1-4). Content = **that astronaut's** real data (role, vitals, ECG, SpO2, resp, temp, HRV, risk indices ARF/TRM/EPI/RSI, cabin CO2/flux/dose, alerts, JARVIS directive, crew strip of the 4). Match the `/suit-hud` "crew role perspectives" behaviour.
5. The HUD must be visible while looking through each helmet in "Crew view" and fade as you float forward from stop 01 (existing behaviour).

## PART D - Cleanup & delivery
- Remove every leftover of the old 6-person crew (`eng`, `pay`) and the old middle "vitals" wall monitor / "Pilot" stop (already removed - double check).
- Run the cabin, open the browser console: no errors, no 404, fps >= 30. Test with backend ON and OFF (OFF must fall back to `SIM` without crashing).
- Update `README.md`, then give me: (1) a summary of what you changed per file, (2) the real WebSocket message example, (3) the final zip `HELIOS_3D_CABIN_v3.zip` of the `helios/` folder.
