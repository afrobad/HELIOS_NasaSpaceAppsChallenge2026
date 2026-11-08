import * as THREE from 'three';

/**
 * Authentic ISS Robotic Workstation (RWS)
 * Modeled after the SSRMS / Canadarm2 control workstation in the ISS Cupola.
 * 
 * Features 3 Upper Video Flight Monitors (EMS / MDR):
 * - Monitor 1 (Left):   CURRENT VIEW OF DRAGON (SpaceX Crew Dragon docking approach, nose cone open, docking collar, Draco RCS, HUD telemetry)
 * - Monitor 2 (Center): CURRENT VIEW OF ISS (Full International Space Station exterior, solar arrays, truss, modules, Canadarm2, Earth orbit HUD)
 * - Monitor 3 (Right):  VIEW OF PLANET (High-detail orbital planetary observation of Planet Earth, atmosphere limb, terminator city lights, ground track)
 * 
 * Center Laptop:
 * - Lenovo ThinkPad PCS (Portable Computer System) running SSRMS robotics joint angles & control telemetry
 * 
 * Flight Controls:
 * - Left Display & Control Panel (DCP) with tactile matrix pushbuttons, E-STOP button, DSP mission patch & hazard stripes
 * - Translational Hand Controller (THC)
 * - Rotational Hand Controller (RHC) with conical grip & protective guard frame
 */

function createScreenCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas, ctx, tex, w, h };
}

/* --------------------------------------------------------------------------
 * 1. LEFT MONITOR: CURRENT VIEW OF DRAGON (CAM 01)
 * -------------------------------------------------------------------------- */
function renderDragonScreen(ctx, w, h, t) {
  // Deep space background
  ctx.fillStyle = '#02050f';
  ctx.fillRect(0, 0, w, h);

  // Background stars
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 65; i++) {
    const sx = ((i * 137.5) % w);
    const sy = ((i * 269.3) % h);
    const r = (i % 3 === 0) ? 1.6 : 1.0;
    ctx.fillRect(sx, sy, r, r);
  }

  // Earth curvature & atmospheric glow in bottom-left background
  const earthGrad = ctx.createRadialGradient(-w * 0.1, h * 1.5, 120, -w * 0.1, h * 1.5, h * 1.4);
  earthGrad.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
  earthGrad.addColorStop(0.35, 'rgba(30, 58, 138, 0.32)');
  earthGrad.addColorStop(0.7, 'rgba(2, 6, 23, 0.12)');
  earthGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = earthGrad;
  ctx.beginPath();
  ctx.arc(-w * 0.1, h * 1.5, h * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Draw 3D-Perspective SpaceX Crew Dragon Spacecraft
  ctx.save();
  const cx = w * 0.50, cy = h * 0.48;
  const wobbleX = Math.sin(t * 1.1) * 2;
  const wobbleY = Math.cos(t * 0.8) * 1.5;
  ctx.translate(cx + wobbleX, cy + wobbleY);

  // High-intensity docking floodlight beam illuminating target
  const beamGrad = ctx.createRadialGradient(0, -60, 20, 0, 0, 260);
  beamGrad.addColorStop(0, 'rgba(240, 249, 255, 0.30)');
  beamGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)');
  beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(-220, 240);
  ctx.lineTo(220, 240);
  ctx.closePath();
  ctx.fill();

  // Draco RCS thruster plumes firing intermittently
  const rcsFiring = Math.sin(t * 4.2) > 0.15;
  if (rcsFiring) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.88)';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;
    // Port thruster flame
    ctx.beginPath();
    ctx.moveTo(-110, 22); ctx.lineTo(-142, 12); ctx.lineTo(-116, 32); ctx.closePath(); ctx.fill();
    // Starboard thruster flame
    ctx.beginPath();
    ctx.moveTo(110, 22); ctx.lineTo(142, 12); ctx.lineTo(116, 32); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Trunk aft body (black cylindrical with vertical cooling fins & solar arrays)
  const trunkGrad = ctx.createLinearGradient(-92, 0, 92, 0);
  trunkGrad.addColorStop(0, '#0f172a');
  trunkGrad.addColorStop(0.25, '#1e293b');
  trunkGrad.addColorStop(0.75, '#334155');
  trunkGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = trunkGrad;
  ctx.beginPath();
  ctx.moveTo(-88, 42);
  ctx.lineTo(88, 42);
  ctx.lineTo(108, 150);
  ctx.lineTo(-108, 150);
  ctx.closePath();
  ctx.fill();

  // Trunk solar array lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  for (let ly = 55; ly < 145; ly += 14) {
    ctx.beginPath(); ctx.moveTo(-92, ly); ctx.lineTo(92, ly); ctx.stroke();
  }

  // Aerodynamic fins on trunk
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-108, 120); ctx.lineTo(-136, 150); ctx.lineTo(-108, 150); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(108, 120); ctx.lineTo(136, 150); ctx.lineTo(108, 150); ctx.closePath(); ctx.fill();

  // SpaceX Wordmark Logo on Trunk
  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 17px "Rajdhani", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPACEX', 0, 110);

  // NASA Meatball Red Insignia
  ctx.fillStyle = '#dc2626';
  ctx.beginPath(); ctx.arc(-42, 106, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px sans-serif';
  ctx.fillText('NASA', -42, 109);

  // Dragon Capsule Main Conical Body (Pearl-white heat-resistant tiles)
  const capsuleGrad = ctx.createLinearGradient(-75, 0, 75, 0);
  capsuleGrad.addColorStop(0, '#cbd5e1');
  capsuleGrad.addColorStop(0.2, '#f8fafc');
  capsuleGrad.addColorStop(0.6, '#ffffff');
  capsuleGrad.addColorStop(0.85, '#e2e8f0');
  capsuleGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = capsuleGrad;
  ctx.beginPath();
  ctx.moveTo(0, -65);
  ctx.bezierCurveTo(42, -48, 80, 0, 88, 42);
  ctx.lineTo(-88, 42);
  ctx.bezierCurveTo(-80, 0, -42, -48, 0, -65);
  ctx.closePath();
  ctx.fill();

  // Capsule black heat-shield base band & forward window ports
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(0, 42, 88, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Recessed capsule windows
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.ellipse(-26, -5, 7, 11, -0.2, 0, Math.PI * 2);
  ctx.ellipse(26, -5, 7, 11, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Draco Thruster Housings (4 pods on shoulders)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-84, 12, 16, 14);
  ctx.fillRect(68, 12, 16, 14);

  // Open Nose Cone (hinged back at top, exposing the docking ring!)
  ctx.save();
  ctx.translate(0, -68);
  ctx.rotate(-0.42);
  const noseGrad = ctx.createLinearGradient(-32, 0, 32, 0);
  noseGrad.addColorStop(0, '#94a3b8');
  noseGrad.addColorStop(0.5, '#f8fafc');
  noseGrad.addColorStop(1, '#64748b');
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(-32, 0);
  ctx.bezierCurveTo(-18, -50, 18, -50, 32, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-10, -10, 20, 10);
  ctx.restore();

  // NASA Docking System (NDS) Soft-Capture Ring & 3 Petals
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(0, -64, 34, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 3 Docking Petals
  ctx.fillStyle = '#64748b';
  [-0.6, 0.6, 2.8].forEach(ang => {
    ctx.save(); ctx.rotate(ang); ctx.fillRect(-5, -74, 10, 13); ctx.restore();
  });

  // Docking floodlight LEDs
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.arc(-16, -58, 3.5, 0, Math.PI * 2);
  ctx.arc(16, -58, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end Dragon transform

  // ------------------------------------------------------------------------
  // HUD Overlays & Boresight Reticle
  // ------------------------------------------------------------------------
  // Outer frame
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, w - 56, h - 56);

  // Corner brackets
  const bLen = 26;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(28, 28 + bLen); ctx.lineTo(28, 28); ctx.lineTo(28 + bLen, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 28 - bLen, 28); ctx.lineTo(w - 28, 28); ctx.lineTo(w - 28, 28 + bLen); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(28, h - 28 - bLen); ctx.lineTo(28, h - 28); ctx.lineTo(28 + bLen, h - 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 28 - bLen, h - 28); ctx.lineTo(w - 28, h - 28); ctx.lineTo(w - 28, h - 28 - bLen); ctx.stroke();

  // Top Title Bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.fillRect(32, 32, w - 64, 46);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(52, 55, 6, 0, Math.PI * 2); ctx.fill(); // REC dot
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CAM 01 // IDA-2 FORWARD PORT DOCKING AXIS', 68, 60);

  // Live Timecode
  const sec = (t % 60).toFixed(1).padStart(4, '0');
  ctx.fillStyle = '#22c55e';
  ctx.textAlign = 'right';
  ctx.fillText(`MET 04:18:${sec} // HD 1080p`, w - 50, 60);

  // Center Docking Target Boresight
  ctx.save();
  ctx.translate(w / 2, h / 2 - 20);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-64, 0); ctx.lineTo(-12, 0); ctx.moveTo(12, 0); ctx.lineTo(64, 0);
  ctx.moveTo(0, -64); ctx.lineTo(0, -12); ctx.moveTo(0, 12); ctx.lineTo(0, 64);
  ctx.stroke();

  // Target Lock Box
  ctx.strokeStyle = '#38bdf8';
  ctx.strokeRect(-85, -85, 170, 170);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('TARGET: CREW DRAGON (C206)', -80, -92);
  ctx.restore();

  // Telemetry Badges (Bottom)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.fillRect(32, h - 105, w - 64, 72);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('● HARD CAPTURE VERIFIED // 12/12 HOOKS ENGAGED', 48, h - 80);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText('RANGE: 0.00 m   CLOSING VEL: 0.00 m/s   ANGULAR ERROR: 0.01°', 48, h - 58);
  ctx.fillText('DRACO RCS: STANDBY   IDA-2 VESTIBULE: PRESSURIZED 101.3 kPa', 48, h - 40);

  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'right';
  ctx.fillText('EXPEDITION 71 WELCOMES DRAGON CREW', w - 48, h - 58);
}

/* --------------------------------------------------------------------------
 * 2. CENTER MONITOR: CURRENT VIEW OF ISS (CAM 02)
 * -------------------------------------------------------------------------- */
function renderIssScreen(ctx, w, h, t) {
  // Deep space background
  ctx.fillStyle = '#020511';
  ctx.fillRect(0, 0, w, h);

  // Background stars
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 75; i++) {
    const sx = ((i * 193.7) % w);
    const sy = ((i * 311.2) % (h * 0.65));
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }

  // Planet Earth Filling Lower Half with Realistic Spherical Horizon
  const earthY = h * 0.70;
  const earthGrad = ctx.createRadialGradient(w * 0.5, earthY + 680, 200, w * 0.5, earthY + 680, 920);
  earthGrad.addColorStop(0, '#1e3a8a'); // Deep royal ocean
  earthGrad.addColorStop(0.45, '#0284c7'); // Azure waters
  earthGrad.addColorStop(0.78, '#38bdf8'); // Shallow turquoise
  earthGrad.addColorStop(0.92, '#7dd3fc'); // Atmospheric limb
  earthGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = earthGrad;
  ctx.beginPath();
  ctx.arc(w * 0.5, earthY + 680, 920, Math.PI, 0);
  ctx.fill();

  // Continental landmasses on Earth
  ctx.fillStyle = '#166534';
  ctx.beginPath();
  ctx.ellipse(w * 0.32, earthY + 35, 170, 48, 0.15, 0, Math.PI * 2);
  ctx.ellipse(w * 0.65, earthY + 58, 130, 38, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.ellipse(w * 0.42, earthY + 65, 95, 30, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // White Swirling Weather Cloud Systems
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  for (let i = 0; i < 6; i++) {
    const cx = w * 0.16 + i * 135 + Math.sin(t * 0.05 + i) * 12;
    const cy = earthY - 2 + (i % 3) * 16;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70, 15, 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // Atmospheric cyan Rayleigh fringe
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(w * 0.5, earthY + 680, 920, Math.PI + 0.15, -0.15);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ------------------------------------------------------------------------
  // International Space Station (ISS) Full Exterior Architecture
  // ------------------------------------------------------------------------
  ctx.save();
  const stationX = w * 0.50, stationY = h * 0.40;
  const driftX = Math.sin(t * 0.35) * 3;
  const driftY = Math.cos(t * 0.28) * 2;
  ctx.translate(stationX + driftX, stationY + driftY);

  // Main Horizontal Integrated Truss Structure (ITS)
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-270, -6, 540, 12);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  for (let tx = -265; tx <= 265; tx += 12) {
    ctx.beginPath(); ctx.moveTo(tx, -6); ctx.lineTo(tx, 6); ctx.stroke();
  }

  // 8 Giant Solar Array Wings (SAW / iROSA) in Golden Bronze
  const drawSolarWing = (x, y, flip) => {
    const swW = 82, swH = 145;
    const sGrad = ctx.createLinearGradient(x, y, x + swW, y);
    sGrad.addColorStop(0, '#92400e');
    sGrad.addColorStop(0.3, '#d97706');
    sGrad.addColorStop(0.7, '#f59e0b');
    sGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = sGrad;
    const sy = flip ? y - swH : y;
    ctx.fillRect(x, sy, swW, swH);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 1;
    for (let py = sy; py < sy + swH; py += 12) {
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + swW, py); ctx.stroke();
    }
    for (let px = x; px < x + swW; px += 26) {
      ctx.beginPath(); ctx.moveTo(px, sy); ctx.lineTo(px, sy + swH); ctx.stroke();
    }
  };

  // Port Solar Wings
  drawSolarWing(-265, 10, false);
  drawSolarWing(-265, -10, true);
  drawSolarWing(-178, 10, false);
  drawSolarWing(-178, -10, true);

  // Starboard Solar Wings
  drawSolarWing(96, 10, false);
  drawSolarWing(96, -10, true);
  drawSolarWing(183, 10, false);
  drawSolarWing(183, -10, true);

  // Central Pressurized Modules Cluster
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-40, -50, 80, 100, 6);
  ctx.fill(); ctx.stroke();

  // Destiny / Columbus transverse modules
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(-70, -16, 140, 32, 5);
  ctx.fill(); ctx.stroke();

  // Japanese Kibo Exposed Facility
  ctx.fillStyle = '#475569';
  ctx.fillRect(-80, -12, 12, 24);

  // Forward Node 2 & PMA-2/IDA-2 Docking Port
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, -54, 12, 0, Math.PI * 2);
  ctx.fill();

  // Canadarm2 (SSRMS) 7-Joint Robotic Arm
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(14, -8); ctx.lineTo(40, -40); ctx.lineTo(26, -78);
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(14, -8, 3.5, 0, Math.PI * 2);
  ctx.arc(40, -40, 3.5, 0, Math.PI * 2);
  ctx.arc(26, -78, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Large White Thermal Radiator Panels
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(-60, 22, 40, 60);
  ctx.fillRect(20, 22, 40, 60);
  ctx.strokeStyle = '#94a3b8';
  ctx.strokeRect(-60, 22, 40, 60);
  ctx.strokeRect(20, 22, 40, 60);

  ctx.restore(); // end ISS transform

  // ------------------------------------------------------------------------
  // HUD Overlays & Telemetry
  // ------------------------------------------------------------------------
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, w - 56, h - 56);

  // Corner brackets
  const bLen = 26;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(28, 28 + bLen); ctx.lineTo(28, 28); ctx.lineTo(28 + bLen, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 28 - bLen, 28); ctx.lineTo(w - 28, 28); ctx.lineTo(w - 28, 28 + bLen); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(28, h - 28 - bLen); ctx.lineTo(28, h - 28); ctx.lineTo(28 + bLen, h - 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 28 - bLen, h - 28); ctx.lineTo(w - 28, h - 28); ctx.lineTo(w - 28, h - 28 - bLen); ctx.stroke();

  // Top Title Bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.fillRect(32, 32, w - 64, 46);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath(); ctx.arc(52, 55, 6, 0, Math.PI * 2); ctx.fill(); // LIVE dot
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CAM 02 // ISS EXTERIOR INSPECTION // SSRMS BOOM CAM', 68, 60);

  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'right';
  ctx.fillText('ALT: 418.4 km | VEL: 7.66 km/s | INCL: 51.64°', w - 50, 60);

  // Bottom Telemetry Cards
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.fillRect(32, h - 105, w - 64, 72);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('● STATION ATTITUDE: +LVLH NOMINAL // SOLAR TRACKING: ACTIVE', 48, h - 80);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText('SOLAR GENERATION: 118.2 kW   BATTERY SOC: 98.4%   BETA ANGLE: +24.8°', 48, h - 58);
  ctx.fillText('CANADARM2 (SSRMS): BASE AT MBS WORK SITE 2 // LEE-A RIGIDIZED', 48, h - 40);

  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'right';
  ctx.fillText('ALL 16 SOLAR ARRAYS DEPLOYED // ECLSS NOMINAL', w - 48, h - 58);
}

/* --------------------------------------------------------------------------
 * 3. RIGHT MONITOR: VIEW OF PLANET (CAM 03)
 * -------------------------------------------------------------------------- */
function renderPlanetScreen(ctx, w, h, t) {
  // Deep space background
  ctx.fillStyle = '#01030a';
  ctx.fillRect(0, 0, w, h);

  // Background stars
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const sx = ((i * 223.1) % w);
    const sy = ((i * 181.7) % h);
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }

  // Distant Moon crescent in upper-left corner
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath(); ctx.arc(75, 105, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#01030a';
  ctx.beginPath(); ctx.arc(82, 102, 14, 0, Math.PI * 2); ctx.fill();

  // ------------------------------------------------------------------------
  // The Planet (Earth - The Blue Marble)
  // ------------------------------------------------------------------------
  const prX = w * 0.50, prY = h * 0.48;
  const planetR = 185;

  ctx.save();
  ctx.translate(prX, prY);

  // Outer atmospheric haze glow
  const atmosGlow = ctx.createRadialGradient(0, 0, planetR * 0.95, 0, 0, planetR * 1.15);
  atmosGlow.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
  atmosGlow.addColorStop(0.35, 'rgba(30, 64, 175, 0.45)');
  atmosGlow.addColorStop(0.7, 'rgba(14, 165, 233, 0.2)');
  atmosGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = atmosGlow;
  ctx.beginPath();
  ctx.arc(0, 0, planetR * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Deep Ocean Sphere (base)
  const oceanGrad = ctx.createRadialGradient(-planetR * 0.35, -planetR * 0.35, 20, 0, 0, planetR);
  oceanGrad.addColorStop(0, '#0284c7');
  oceanGrad.addColorStop(0.5, '#1e40af');
  oceanGrad.addColorStop(0.85, '#0f172a');
  oceanGrad.addColorStop(1, '#020617');
  ctx.fillStyle = oceanGrad;
  ctx.beginPath();
  ctx.arc(0, 0, planetR, 0, Math.PI * 2);
  ctx.fill();

  // Clip to planetary sphere
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, planetR, 0, Math.PI * 2);
  ctx.clip();

  // Continental Landmasses
  const rot = t * 0.02;
  ctx.save();
  ctx.rotate(rot);

  // Europe & Mediterranean
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(-28, -48, 72, 42, 0.3, 0, Math.PI * 2);
  ctx.ellipse(42, -32, 58, 36, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Iberian peninsula & Britain
  ctx.beginPath();
  ctx.ellipse(-72, -62, 26, 20, 0.1, 0, Math.PI * 2);
  ctx.ellipse(-52, -92, 20, 26, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // North Africa & Sahara Desert
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.ellipse(-12, 24, 105, 52, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(32, 48, 62, 38, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Swirling Atmospheric Weather Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.arc(-76, -42, 36, 0, Math.PI * 1.5);
  ctx.bezierCurveTo(-48, -18, -105, -14, -76, -42);
  ctx.fill();
  for (let ci = 0; ci < 8; ci++) {
    const cy = -115 + ci * 30;
    ctx.beginPath();
    ctx.ellipse(-58 + (ci % 3) * 52, cy, 80, 11, 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore(); // end rotation

  // Day / Night Terminator Line & City Lights
  const termGrad = ctx.createLinearGradient(-planetR * 0.1, 0, planetR * 0.8, 0);
  termGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  termGrad.addColorStop(0.35, 'rgba(2, 6, 23, 0.75)');
  termGrad.addColorStop(0.7, 'rgba(2, 6, 23, 0.96)');
  termGrad.addColorStop(1, 'rgba(2, 6, 23, 0.99)');
  ctx.fillStyle = termGrad;
  ctx.fillRect(-planetR, -planetR, planetR * 2, planetR * 2);

  // Night-side Glowing City Lights
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 6;
  const cityClusters = [
    [48, -42], [72, -28], [88, -14], [108, 10], [62, 18], [82, 42],
    [116, -38], [130, -8], [102, 58]
  ];
  cityClusters.forEach(([cx, cy]) => {
    ctx.beginPath(); ctx.arc(cx, cy, 2.0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(253, 224, 71, 0.4)';
    ctx.beginPath(); ctx.arc(cx, cy, 5.0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde047';
  });
  ctx.shadowBlur = 0;

  ctx.restore(); // end clip

  // Thin cyan atmospheric rim edge
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, planetR, 0, Math.PI * 2); ctx.stroke();

  ctx.restore(); // end Planet transform

  // ------------------------------------------------------------------------
  // HUD Overlays & Planetary Telemetry
  // ------------------------------------------------------------------------
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, w - 56, h - 56);

  // Corner brackets
  const bLen = 26;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(28, 28 + bLen); ctx.lineTo(28, 28); ctx.lineTo(28 + bLen, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 28 - bLen, 28); ctx.lineTo(w - 28, 28); ctx.lineTo(w - 28, 28 + bLen); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(28, h - 28 - bLen); ctx.lineTo(28, h - 28); ctx.lineTo(28 + bLen, h - 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w - 28 - bLen, h - 28); ctx.lineTo(w - 28, h - 28); ctx.lineTo(w - 28, h - 28 - bLen); ctx.stroke();

  // Top Title Bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.fillRect(32, 32, w - 64, 46);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath(); ctx.arc(52, 55, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CAM 03 // PLANETARY OBSERVATION // NADIR OPTICAL SENSOR', 68, 60);

  ctx.fillStyle = '#22c55e';
  ctx.textAlign = 'right';
  ctx.fillText('BODY: EARTH (TERRA) // 1.000 AU', w - 50, 60);

  // Reticle crosshair over Sub-Satellite Point
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(prX, prY, 38, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(prX - 52, prY); ctx.lineTo(prX + 52, prY);
  ctx.moveTo(prX, prY - 52); ctx.lineTo(prX, prY + 52);
  ctx.stroke();

  // Bottom Telemetry Cards
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.fillRect(32, h - 105, w - 64, 72);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('● SUB-SATELLITE POINT: 36°08\' N  05°21\' W (STRAIT OF GIBRALTAR)', 48, h - 80);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText('SUNLIGHT PASS: DAY/NIGHT TERMINATOR IN VIEW   SOLAR ELEV: +52.4°', 48, h - 58);
  ctx.fillText('ATMOSPHERE: RAYLEIGH SCATTERING NOMINAL   ALBEDO: 0.306   CLOUD: 34.2%', 48, h - 40);

  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'right';
  ctx.fillText('ORBIT #41,208 // ASCENDING NODE', w - 48, h - 58);
}

/* --------------------------------------------------------------------------
 * 4. CENTER LAPTOP: SSRMS ROBOTICS PCS THINKPAD
 * -------------------------------------------------------------------------- */
function renderPcsScreen(ctx, w, h, t) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Windows Titlebar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, w, 28);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PCS // SSRMS ROBOTICS TELEMETRY & JOINT ANGLES', 12, 19);

  // Joint Telemetry Table
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(15, 38, w - 30, h - 85);

  const joints = [
    { name: 'SR (Shoulder Roll)',  base: 12.4, status: 'LOCKED // RUN' },
    { name: 'SY (Shoulder Yaw)',   base: 88.2, status: 'RUNNING' },
    { name: 'SP (Shoulder Pitch)', base: 20.4, status: 'LOCKED // RUN' },
    { name: 'EP (Elbow Pitch)',    base: 37.2, status: 'RUNNING' },
    { name: 'WP (Wrist Pitch)',    base: 85.4, status: 'LOCKED // RUN' },
    { name: 'WY (Wrist Yaw)',      base: -12.1, status: 'LOCKED // RUN' },
    { name: 'WR (Wrist Roll)',     base: 62.4, status: 'LOCKED // RUN' },
  ];

  ctx.font = '13px monospace';
  joints.forEach((j, idx) => {
    const y = 64 + idx * 24;
    const isRunning = j.status.includes('RUNNING');
    const angleDelta = isRunning ? Math.sin(t * 0.8 + idx) * 0.4 : 0;
    const angle = (j.base + angleDelta).toFixed(1);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText(j.name, 25, y);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${angle > 0 ? '+' : ''}${angle}°`, 230, y);
    ctx.fillStyle = isRunning ? '#38bdf8' : '#22c55e';
    ctx.fillText(j.status, 330, y);
  });

  // End-Effector Latch & Control Status
  ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
  ctx.fillRect(15, h - 42, w - 30, 32);
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('AUTOPILOT: STANDBY // MANUAL JOYSTICK (RHC/THC) ACTIVE', 25, h - 21);
}

/* --------------------------------------------------------------------------
 * Main Factory: build the RWS 3D structure and wire the 3 monitors
 * -------------------------------------------------------------------------- */
export function createRoboticWorkstation(opts = {}) {
  const group = new THREE.Group();
  group.name = 'ISS_Robotic_Workstation_RWS';

  // Common Materials
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.45, metalness: 0.75 });
  const blackAlum = new THREE.MeshStandardMaterial({ color: 0x0f1216, roughness: 0.55, metalness: 0.65 });
  const blueTrim = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.8 });
  const steelTube = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
  const goldBrass = new THREE.MeshStandardMaterial({ color: 0xb48a3c, roughness: 0.3, metalness: 0.85 });
  const redEstop = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.3 });

  /* ------------------------------------------------------------------------
   * 1. Main Console Desk & Structural Frame
   * ------------------------------------------------------------------------ */
  const deskWidth = 12.0, deskDepth = 5.2, deskThick = 0.55;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(deskWidth, deskThick, deskDepth), darkMetal);
  desk.position.set(0, 0, 0);
  desk.castShadow = desk.receiveShadow = true;
  group.add(desk);

  // Corner Bumper Pads
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6, metalness: 0.2 });
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, deskThick + 0.1, 0.8), bumperMat);
      b.position.set(sx * (deskWidth / 2 - 0.4), 0, sz * (deskDepth / 2 - 0.4));
      group.add(b);
    });
  });

  // Lower avionics chassis
  const underBox = new THREE.Mesh(new THREE.BoxGeometry(10.8, 2.6, 4.4), blackAlum);
  underBox.position.set(0, -1.5, -0.1);
  group.add(underBox);

  // Structural Mounting Tubes
  const tube1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.2, 16), steelTube);
  tube1.rotation.z = Math.PI / 4;
  tube1.position.set(-4.5, -2.2, 1.2);
  const tube2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.2, 16), steelTube);
  tube2.rotation.z = -Math.PI / 4;
  tube2.position.set(4.5, -2.2, 1.2);
  group.add(tube1, tube2);

  /* ------------------------------------------------------------------------
   * 2. The 3 Upper Video Flight Monitors (EMS / MDR)
   * ------------------------------------------------------------------------ */
  const monW = 3.6, monH = 2.6, monD = 0.45;
  const monPositions = [-3.8, 0, 3.8];

  // High-Resolution 1024x768 Canvases for extreme clarity
  const screenDragon = createScreenCanvas(1024, 768);
  const screenIss = createScreenCanvas(1024, 768);
  const screenPlanet = createScreenCanvas(1024, 768);

  const screens = [
    { data: screenDragon, render: renderDragonScreen, title: 'CURRENT VIEW OF DRAGON' },
    { data: screenIss,    render: renderIssScreen,    title: 'CURRENT VIEW OF ISS' },
    { data: screenPlanet, render: renderPlanetScreen, title: 'VIEW OF PLANET' }
  ];

  // Initial draw
  screens.forEach((s) => {
    s.render(s.data.ctx, s.data.w, s.data.h, 0);
    s.data.tex.needsUpdate = true;
  });

  monPositions.forEach((posX, i) => {
    const monGroup = new THREE.Group();
    monGroup.position.set(posX, 2.8, -0.6);

    // Bezel Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(monW, monH, monD), blackAlum);
    monGroup.add(frame);

    // Blue corner shock bumpers
    [[-1, 1], [1, 1]].forEach(([bx, by]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, monD + 0.08), blueTrim);
      b.position.set(bx * (monW / 2 - 0.15), by * (monH / 2 - 0.15), 0);
      monGroup.add(b);
    });

    // Display Screen Quad
    const screenMat = new THREE.MeshBasicMaterial({
      map: screens[i].data.tex,
      toneMapped: false
    });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(monW - 0.45, monH - 0.45), screenMat);
    screenMesh.position.z = monD / 2 + 0.02;
    monGroup.add(screenMesh);

    // Button strip along bottom bezel
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
    for (let b = 0; b < 4; b++) {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.1), btnMat);
      btn.position.set(-1.0 + b * 0.4, -monH / 2 + 0.2, monD / 2 + 0.02);
      monGroup.add(btn);
    }

    // Articulated mounting arm down to desk
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 12), steelTube);
    arm.position.set(0, -monH / 2 - 0.6, 0);
    monGroup.add(arm);

    group.add(monGroup);
  });

  /* ------------------------------------------------------------------------
   * 3. Center ThinkPad PCS Laptop
   * ------------------------------------------------------------------------ */
  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(0.6, deskThick / 2 + 0.02, 0.4);

  const lapBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 2.4), blackAlum);
  lapBase.position.set(0, 0.1, 0);
  laptopGroup.add(lapBase);

  // Keyboard
  const kbData = createScreenCanvas(256, 192);
  const kbCtx = kbData.ctx;
  kbCtx.fillStyle = '#111827'; kbCtx.fillRect(0, 0, 256, 192);
  kbCtx.fillStyle = '#374151';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 12; c++) {
      kbCtx.fillRect(14 + c * 19, 15 + r * 18, 16, 14);
    }
  }
  kbCtx.fillStyle = '#ef4444';
  kbCtx.beginPath(); kbCtx.arc(128, 60, 4, 0, Math.PI * 2); kbCtx.fill(); // trackpoint
  kbCtx.fillStyle = '#1f2937'; kbCtx.fillRect(103, 120, 50, 40);
  kbData.tex.needsUpdate = true;

  const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.0), new THREE.MeshStandardMaterial({ map: kbData.tex, roughness: 0.6 }));
  kb.rotation.x = -Math.PI / 2;
  kb.position.set(0, 0.21, 0);
  laptopGroup.add(kb);

  // Screen Lid
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.18, -1.15);
  lidGroup.rotation.x = (15 * Math.PI) / 180;

  const lid = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.16), blackAlum);
  lid.position.set(0, 1.1, 0);
  lidGroup.add(lid);

  const pcsData = createScreenCanvas(512, 384);
  renderPcsScreen(pcsData.ctx, pcsData.w, pcsData.h, 0);
  pcsData.tex.needsUpdate = true;

  const pcsScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.9),
    new THREE.MeshBasicMaterial({ map: pcsData.tex, toneMapped: false })
  );
  pcsScreen.position.set(0, 1.1, 0.09);
  lidGroup.add(pcsScreen);
  laptopGroup.add(lidGroup);
  group.add(laptopGroup);

  /* ------------------------------------------------------------------------
   * 4. Display and Control Panel (DCP) on Left
   * ------------------------------------------------------------------------ */
  const dcpGroup = new THREE.Group();
  dcpGroup.position.set(-3.6, deskThick / 2 + 0.15, 0.4);

  const dcpBox = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 3.2), blackAlum);
  dcpBox.rotation.x = (12 * Math.PI) / 180;
  dcpGroup.add(dcpBox);

  const dcpData = createScreenCanvas(512, 384);
  const dg = dcpData.ctx, dw = dcpData.w, dh = dcpData.h;
  dg.fillStyle = '#181e26'; dg.fillRect(0, 0, dw, dh);
  const drawGrid = (x0, y0, cols, rows, label) => {
    dg.fillStyle = '#38bdf8'; dg.font = 'bold 12px monospace';
    dg.fillText(label, x0, y0 - 6);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = x0 + c * 32, by = y0 + r * 28;
        dg.fillStyle = '#334155'; dg.fillRect(bx, by, 26, 22);
        dg.strokeStyle = '#64748b'; dg.lineWidth = 1; dg.strokeRect(bx, by, 26, 22);
        dg.fillStyle = '#e2e8f0'; dg.font = '10px monospace';
        dg.fillText(String(r * cols + c + 1), bx + 8, by + 15);
      }
    }
  };
  drawGrid(20, 35, 4, 3, 'MONITOR SELECT');
  drawGrid(165, 35, 4, 3, 'CAMERA SELECT');

  dg.fillStyle = '#22c55e';
  for (let i = 0; i < 7; i++) {
    dg.beginPath(); dg.arc(320 + i * 22, 50, 5, 0, Math.PI * 2); dg.fill();
  }
  dg.fillStyle = '#94a3b8'; dg.font = '10px monospace';
  dg.fillText('JOINT BRAKES RELEASED', 315, 75);

  // DSP Mission Patch
  const patchX = 390, patchY = 240, pr = 55;
  dg.fillStyle = '#991b1b'; dg.beginPath(); dg.arc(patchX, patchY, pr, 0, Math.PI * 2); dg.fill();
  dg.strokeStyle = '#f59e0b'; dg.lineWidth = 4; dg.stroke();
  dg.fillStyle = '#ffffff'; dg.font = 'bold 11px sans-serif';
  dg.fillText('JEFF DAVE KEN', patchX - 42, patchY - 25);
  dg.fillText('BRAD ERIN', patchX - 32, patchY + 36);
  dg.fillStyle = '#38bdf8';
  dg.beginPath(); dg.arc(patchX, patchY, 26, 0, Math.PI * 2); dg.fill();
  dg.fillStyle = '#fde047'; dg.font = '900 16px sans-serif';
  dg.fillText('D.S.P.', patchX - 22, patchY + 6);

  // Caution Yellow & Black Hazard Stripes
  const stripeW = 140, stripeH = 34, sx = 20, sy = 280;
  dg.fillStyle = '#eab308'; dg.fillRect(sx, sy, stripeW, stripeH);
  dg.fillStyle = '#0f172a';
  for (let s = -20; s < stripeW; s += 20) {
    dg.beginPath();
    dg.moveTo(sx + s, sy); dg.lineTo(sx + s + 12, sy);
    dg.lineTo(sx + s + 4, sy + stripeH); dg.lineTo(sx + s - 8, sy + stripeH);
    dg.closePath(); dg.fill();
  }
  dg.fillStyle = '#0f172a'; dg.fillRect(sx + 20, sy + 6, stripeW - 40, stripeH - 12);
  dg.fillStyle = '#fde047'; dg.font = 'bold 12px monospace';
  dg.fillText('CAUTION: SSRMS RWS', sx + 26, sy + 22);

  // E-STOP Button outline
  dg.fillStyle = '#ffffff'; dg.fillRect(180, 275, 75, 45);
  dg.fillStyle = '#dc2626'; dg.fillRect(185, 280, 65, 35);
  dg.fillStyle = '#ffffff'; dg.font = 'bold 13px sans-serif';
  dg.fillText('STOP', 200, 303);
  dcpData.tex.needsUpdate = true;

  const dcpFace = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 3.0),
    new THREE.MeshStandardMaterial({ map: dcpData.tex, roughness: 0.5, metalness: 0.3 })
  );
  dcpFace.rotation.x = -Math.PI / 2;
  dcpFace.position.set(0, 0.32, 0);
  dcpBox.add(dcpFace);

  const estop = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16), redEstop);
  estop.position.set(-1.2, 0.45, 0.6);
  dcpBox.add(estop);
  group.add(dcpGroup);

  /* ------------------------------------------------------------------------
   * 5. Hand Controllers (THC & RHC)
   * ------------------------------------------------------------------------ */
  // THC on Left
  const thcGroup = new THREE.Group();
  thcGroup.position.set(-1.4, deskThick / 2 + 0.3, -1.0);
  const thcBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), darkMetal);
  const thcPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12), steelTube);
  thcPost.position.y = 0.5;
  const thcHandle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.35), blackAlum);
  thcHandle.position.y = 0.9;
  thcGroup.add(thcBase, thcPost, thcHandle);
  group.add(thcGroup);

  // RHC on Right
  const rhcGroup = new THREE.Group();
  rhcGroup.position.set(4.2, deskThick / 2 + 0.3, 0.4);
  const rhcBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 2.2), darkMetal);
  const boot = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8 }));
  boot.position.y = 0.35;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 1.4, 16), blackAlum);
  grip.position.y = 1.15;
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.18), redEstop);
  trigger.position.set(0, 1.5, 0.28);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 12, 24, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.8 }));
  guard.rotation.x = Math.PI / 2;
  guard.position.set(0, 0.8, 0);
  rhcGroup.add(rhcBase, boot, grip, trigger, guard);
  group.add(rhcGroup);

  /* ------------------------------------------------------------------------
   * Dynamic Animation Loop: Throttle canvas updates to realistic ~12 fps
   * ------------------------------------------------------------------------ */
  let lastUpdate = 0;
  group.update = (dt, t) => {
    // Update every 80ms (12.5 fps: realistic NASA digital telemetry frame rate)
    if (t - lastUpdate < 0.08) return;
    lastUpdate = t;

    // 1. Dragon screen update
    screens[0].render(screens[0].data.ctx, screens[0].data.w, screens[0].data.h, t);
    screens[0].data.tex.needsUpdate = true;

    // 2. ISS screen update
    screens[1].render(screens[1].data.ctx, screens[1].data.w, screens[1].data.h, t);
    screens[1].data.tex.needsUpdate = true;

    // 3. Planet screen update
    screens[2].render(screens[2].data.ctx, screens[2].data.w, screens[2].data.h, t);
    screens[2].data.tex.needsUpdate = true;

    // 4. Laptop PCS update
    renderPcsScreen(pcsData.ctx, pcsData.w, pcsData.h, t);
    pcsData.tex.needsUpdate = true;
  };

  return group;
}
