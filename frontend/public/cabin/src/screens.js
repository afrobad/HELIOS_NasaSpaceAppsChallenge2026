// Live dashboards drawn to canvases and mapped onto the 3D wall monitors.
import * as THREE from 'three';
import { crew, byId, vitals, ecg, isLive } from './data.js';

export const SCREEN_W = 1024, SCREEN_H = 622;
const C = { bg: '#070707', panel: 'rgba(13,19,28,.92)', line: 'rgba(98,243,247,.32)', cyan: '#62f3f7', dim: 'rgba(180,220,235,.7)', red: '#ef4444', amber: '#f59e0b', green: '#22c55e', mag: '#d946ef', white: '#ffffff' };

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function panel(g, x, y, w, h, stroke = C.line, fill = C.panel) { rr(g, x, y, w, h, 10); g.fillStyle = fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = stroke; g.stroke(); }
function txt(g, s, x, y, font, color = C.white, align = 'left') { g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); }
const MONO = '"Tomorrow","JetBrains Mono",monospace', UI = '"Tomorrow","Rajdhani",sans-serif', TECH = '"Tomorrow","Orbitron",sans-serif';

function background(g, accent) {
  g.fillStyle = C.bg; g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const gr = g.createRadialGradient(SCREEN_W / 2, 0, 0, SCREEN_W / 2, 0, 700); gr.addColorStop(0, accent); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.18; g.fillStyle = gr; g.fillRect(0, 0, SCREEN_W, SCREEN_H); g.globalAlpha = 1;
}
function scan(g, t) { g.fillStyle = 'rgba(255,255,255,.025)'; for (let y = 0; y < SCREEN_H; y += 4) g.fillRect(0, y, SCREEN_W, 1); g.fillStyle = 'rgba(53,232,255,.05)'; g.fillRect(0, (t * 90) % SCREEN_H, SCREEN_W, 36); }
function header(g, left, right, color = C.cyan) {
  txt(g, left, 28, 44, `700 22px ${UI}`, C.white); txt(g, right, SCREEN_W - 28, 44, `500 13px ${MONO}`, color, 'right');
  g.fillStyle = C.line; g.fillRect(28, 56, SCREEN_W - 56, 1.5);
}
function gauge(g, cx, cy, r, val, label) {
  g.lineCap = 'round'; g.lineWidth = 16; g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
  const grd = g.createLinearGradient(cx - r, 0, cx + r, 0); grd.addColorStop(0, C.red); grd.addColorStop(0.5, C.amber); grd.addColorStop(1, C.green);
  g.strokeStyle = grd; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * val / 100)); g.stroke();
  txt(g, String(Math.round(val)), cx, cy + 16, `900 66px ${TECH}`, C.white, 'center'); txt(g, '/100', cx, cy + 46, `500 16px ${TECH}`, C.dim, 'center');
  txt(g, label, cx, cy - r - 18, `500 12px ${MONO}`, C.dim, 'center');
}
function ecgLine(g, x, y, w, h, t, color, speed = 0.55) {
  g.strokeStyle = color; g.lineWidth = 2.4; g.shadowColor = color; g.shadowBlur = 8; g.beginPath();
  for (let i = 0; i <= w; i += 2) { const p = (((i / w) * 2.2 - t * speed) % 1 + 1) % 1; const yy = y + h / 2 - ecg(p) * h * 0.46; i ? g.lineTo(x + i, yy) : g.moveTo(x + i, yy); }
  g.stroke(); g.shadowBlur = 0;
}
function bodyTwin(g, cx, cy, s, t, alertSpots) {
  g.strokeStyle = 'rgba(53,232,255,.7)'; g.lineWidth = 2; g.fillStyle = 'rgba(53,232,255,.06)';
  const e = (x, y, rx, ry) => { g.beginPath(); g.ellipse(cx + x * s, cy + y * s, rx * s, ry * s, 0, 0, 7); g.fill(); g.stroke(); };
  e(0, -92, 17, 20); rr(g, cx - 28 * s, cy - 68 * s, 56 * s, 84 * s, 18 * s); g.fill(); g.stroke();
  [[-42, -62, 12, 66, 0.06], [42, -62, 12, 66, -0.06]].forEach(([x, y, w, h, a]) => { g.save(); g.translate(cx + x * s, cy + y * s); g.rotate(a); rr(g, -w * s / 2, 0, w * s, h * s, 6 * s); g.fill(); g.stroke(); g.restore(); });
  [[-14, 18], [14, 18]].forEach(([x, y]) => { rr(g, cx + (x - 9) * s, cy + y * s, 18 * s, 84 * s, 8 * s); g.fill(); g.stroke(); });
  g.setLineDash([4, 6]); g.beginPath(); g.moveTo(cx - 70 * s, cy - 40 * s + Math.sin(t) * 20 * s); g.lineTo(cx + 70 * s, cy - 40 * s + Math.sin(t) * 20 * s); g.stroke(); g.setLineDash([]);
  const spots = [[0, -40, C.green], [-8, -24, C.green], [-22, 40, alertSpots ? C.red : C.green], [0, -92, C.cyan]];
  spots.forEach(([x, y, col], i) => { const k = 0.6 + 0.4 * Math.sin(t * 3 + i); g.fillStyle = col; g.globalAlpha = k; g.beginPath(); g.arc(cx + x * s, cy + y * s, 5 * s, 0, 7); g.fill(); g.globalAlpha = 1; });
}

/* ------------------------------- MAIN DASHBOARD (replica of the cockpit page, live data) ------------------------------- */
const stCol = (s) => (s === 'CRITICAL' ? C.red : s === 'WARNING' ? C.amber : C.green);
const linkLbl = () => (vitals.link === 'LIVE' ? `LIVE · ${vitals.hz || 10} Hz` : vitals.link === 'SIM' ? 'OFFLINE · SIM DATA' : 'CONNECTING…');

function drawBoard(g, t) {
  background(g, 'rgba(53,232,255,1)'); header(g, 'H.E.L.I.O.S · COCKPIT DASHBOARD', linkLbl(), vitals.link === 'LIVE' ? C.green : C.amber);
  crew.forEach((c, i) => {
    const x = 28 + i * 241, y = 74, w = 229, col = stCol(c.state);
    panel(g, x, y, w, 300, c.off ? col : C.line, c.off ? 'rgba(60,18,24,.78)' : C.panel);
    txt(g, c.role.toUpperCase(), x + 14, y + 26, `600 12px ${UI}`, C.white); txt(g, c.state, x + w - 14, y + 26, `700 10px ${MONO}`, col, 'right');
    txt(g, String(c.hrNow), x + 14, y + 98, `900 56px ${TECH}`, C.white); txt(g, '♥ bpm', x + 130, y + 98, `500 14px ${MONO}`, C.red);
    ecgLine(g, x + 10, y + 108, w - 20, 70, t + i * 0.21, c.off ? C.red : C.green, 0.55);
    [['SpO₂', c.spo2Now.toFixed(1), '%'], ['RESP', c.respNow, '/min'], ['TEMP', c.tempNow.toFixed(1), '°C'], ['HRV', c.hrvNow, 'ms']].forEach(([k, v, u], j) => {
      const xx = x + 14 + (j % 2) * 104, yy = y + 204 + Math.floor(j / 2) * 46;
      txt(g, k, xx, yy, `500 10px ${MONO}`, C.dim); txt(g, String(v), xx, yy + 24, `700 20px ${TECH}`, C.white); txt(g, u, xx + g.measureText(String(v)).width + 6, yy + 24, `500 10px ${MONO}`, C.cyan);
    });
  });
  panel(g, 28, 390, 968, 212);
  txt(g, 'CABIN & RISK INDICES', 48, 420, `500 12px ${MONO}`, C.dim);
  [['CABIN CO₂', vitals.co2.toFixed(2) + ' mmHg', Math.min(1, vitals.co2 / 4.25)], ['RADIATION FLUX', vitals.flux.toFixed(2) + ' mGy/h', Math.min(1, vitals.flux / 85)], ['DOSE', vitals.dose.toFixed(1), Math.min(1, vitals.dose / 100)]]
    .forEach(([n, s, v], i) => { const x = 48 + i * 200; txt(g, n, x, 454, `600 12px ${UI}`, C.white); txt(g, s, x, 476, `500 13px ${MONO}`, C.cyan); g.fillStyle = 'rgba(255,255,255,.1)'; rr(g, x, 488, 176, 8, 4); g.fill(); g.fillStyle = v > 0.7 ? C.red : C.green; rr(g, x, 488, Math.max(6, 176 * v), 8, 4); g.fill(); });
  const R = [['ARF', 'arf', 1.6], ['TRM', 'trm', 2.2], ['EPI', 'epi', 1.5], ['RSI', 'rsi', 1.8]], lead = crew.find((c) => c.state !== 'NOMINAL') || crew[0];
  R.forEach(([n, k, lim], i) => { const x = 660 + (i % 2) * 168, y = 436 + Math.floor(i / 2) * 58, v = lead.risk[k]; txt(g, n, x, y, `600 12px ${UI}`, C.white); txt(g, v == null ? '—' : v.toFixed(2), x + 150, y, `700 14px ${MONO}`, v != null && v >= lim ? C.red : C.cyan, 'right'); g.fillStyle = 'rgba(255,255,255,.1)'; rr(g, x, y + 10, 150, 7, 3); g.fill(); g.fillStyle = v != null && v >= lim ? C.red : C.green; rr(g, x, y + 10, Math.max(4, 150 * Math.min(1, (v || 0.15 * lim) / lim)), 7, 3); g.fill(); });
  const dir = vitals.directive || (vitals.alerts.length ? vitals.alerts[0].title : 'JARVIS · all crew within personal baselines');
  txt(g, 'JARVIS', 48, 560, `700 12px ${MONO}`, C.mag); txt(g, dir.slice(0, 96), 112, 560, `500 13px ${UI}`, C.white);
  txt(g, 'SENSE · EXPLAIN · ACT', 48, 586, `500 10px ${MONO}`, C.dim);
  scan(g, t);
}

/* ------------------------------- CREW VITALS (cockpit desk, left) ------------------------------- */
function drawVitals(g, t) {
  const p = byId('plt') || crew[0], col = stCol(p.state);
  background(g, 'rgba(255,79,163,1)'); header(g, `Live Vitals · ${p.role}`, `${p.call} · ${p.state}`, col);
  panel(g, 28, 74, 560, 170); txt(g, 'HEART RATE', 46, 102, `500 12px ${MONO}`, C.dim); txt(g, String(p.hrNow), 46, 190, `900 76px ${TECH}`, C.white); txt(g, '♥ bpm', 170, 190, `500 18px ${MONO}`, C.red);
  ecgLine(g, 250, 96, 320, 130, t, C.green, 0.6);
  panel(g, 28, 258, 274, 150); txt(g, 'SpO₂', 46, 286, `500 12px ${MONO}`, C.dim); txt(g, p.spo2Now.toFixed(1), 46, 358, `700 54px ${TECH}`, C.white); txt(g, '%', 196, 358, `500 18px ${MONO}`, C.cyan);
  g.strokeStyle = C.cyan; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 230; i += 3) { const y = 392 - Math.sin(i * 0.05 + t * 2) * 6; i ? g.lineTo(46 + i, y) : g.moveTo(46 + i, y); } g.stroke();
  panel(g, 314, 258, 274, 150); txt(g, 'RESP', 332, 286, `500 12px ${MONO}`, C.dim); txt(g, String(p.respNow), 332, 358, `700 54px ${TECH}`, C.white); txt(g, '/min', 410, 358, `500 18px ${MONO}`, C.cyan);
  g.strokeStyle = C.cyan; g.beginPath(); for (let i = 0; i < 230; i += 3) { const y = 392 - Math.sin(i * 0.03 + t * 1.2) * 9; i ? g.lineTo(332 + i, y) : g.moveTo(332 + i, y); } g.stroke();
  panel(g, 28, 422, 560, 180); txt(g, 'CREW BOARD', 46, 450, `500 12px ${MONO}`, C.dim);
  crew.forEach((c, i) => { const y = 478 + i * 30; txt(g, c.role, 46, y, `600 14px ${UI}`, C.white); txt(g, `${c.hrNow} bpm`, 330, y, `500 13px ${MONO}`, C.cyan, 'right'); txt(g, `${c.spo2Now.toFixed(0)} %`, 420, y, `500 13px ${MONO}`, C.cyan, 'right'); txt(g, c.state, 570, y, `700 11px ${MONO}`, stCol(c.state), 'right'); });
  panel(g, 604, 74, 392, 528, 'rgba(255,79,163,.7)', 'rgba(60,12,40,.86)');
  txt(g, 'JARVIS DIRECTIVE', 626, 106, `600 12px ${MONO}`, C.mag);
  const msg = vitals.directive || 'No active directive. All monitored crew are inside their personal zero-g baselines.';
  let line = '', ly = 150; msg.split(' ').forEach((w) => { if ((line + w).length > 30) { txt(g, line, 626, ly, `500 17px ${UI}`, C.white); line = ''; ly += 26; } line += w + ' '; }); txt(g, line, 626, ly, `500 17px ${UI}`, C.white);
  txt(g, `LINK ${vitals.link}`, 626, 560, `600 13px ${MONO}`, vitals.link === 'LIVE' ? C.green : C.amber);
  scan(g, t);
}

/* ------------------------------- MCC (replica of the Earth Mission Control console, live data) ------------------------------- */
function drawAlerts(g, t) {
  background(g, '#030712');
  header(g, 'NASA MISSION CONTROL // JSC FLIGHT SURGEON CONSOLE', `DSN LOCK · RADIO DELAY ${vitals.delayMin.toFixed(1)}m · ${linkLbl()}`, C.amber);
  panel(g, 28, 74, 430, 528, 'rgba(56,189,248,0.35)', 'rgba(6,11,20,0.96)');
  txt(g, 'CREW BIOMETRIC TELEMETRY (DOWNLINK)', 46, 102, `700 12px ${MONO}`, C.cyan);
  crew.forEach((c, i) => {
    const y = 120 + i * 118, col = stCol(c.state);
    panel(g, 42, y, 402, 104, c.off ? col : 'rgba(56,189,248,0.3)', c.off ? 'rgba(60,18,24,0.95)' : 'rgba(11,20,32,0.96)');
    txt(g, c.role.toUpperCase(), 58, y + 28, `700 15px ${UI}`, C.white);
    txt(g, c.state, 424, y + 28, `700 11px ${MONO}`, col, 'right');
    txt(g, `${c.hrNow}`, 58, y + 78, `700 36px ${TECH}`, C.white);
    txt(g, 'BPM', 128, y + 78, `700 11px ${MONO}`, C.red);
    txt(g, `SpO₂ ${c.spo2Now.toFixed(1)}%`, 200, y + 58, `700 13px ${MONO}`, C.cyan);
    txt(g, `RESP ${c.respNow}/min`, 200, y + 80, `700 13px ${MONO}`, C.cyan);
    ecgLine(g, 310, y + 38, 120, 54, t + i * 0.2, col, 0.55);
  });
  panel(g, 470, 74, 340, 528, 'rgba(56,189,248,0.35)', 'rgba(6,11,20,0.96)');
  txt(g, 'AUTONOMOUS CLINICAL ALERTS', 488, 102, `700 12px ${MONO}`, C.amber);
  const feed = vitals.alerts.length ? vitals.alerts : [{ title: 'All clinical biomarkers nominal within OSDR baseline', level: 'NOMINAL' }];
  feed.slice(0, 4).forEach((a, i) => {
    const y = 120 + i * 108, col = stCol(a.level);
    panel(g, 484, y, 312, 94, col, 'rgba(18,24,36,0.9)');
    g.fillStyle = col; g.beginPath(); g.arc(502, y + 24, 5, 0, 7); g.fill();
    txt(g, a.level, 516, y + 28, `700 11px ${MONO}`, col);
    let line = '', ly = y + 54;
    a.title.split(' ').forEach((w) => {
      if ((line + w).length > 28) {
        txt(g, line, 498, ly, `500 13px ${UI}`, C.white);
        line = ''; ly += 19;
      }
      line += w + ' ';
    });
    txt(g, line, 498, ly, `500 13px ${UI}`, C.white);
  });
  panel(g, 822, 74, 174, 528, 'rgba(255,178,61,0.5)', 'rgba(6,11,20,0.96)');
  txt(g, 'DEEP-SPACE LINK', 836, 102, `700 12px ${MONO}`, C.amber);
  g.lineWidth = 10; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(908, 200, 52, 0, 7); g.stroke();
  g.strokeStyle = C.amber; g.beginPath(); g.arc(908, 200, 52, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); g.stroke();
  txt(g, vitals.delayMin.toFixed(1), 908, 208, `700 26px ${TECH}`, C.white, 'center');
  txt(g, 'MIN ONE-WAY', 908, 274, `600 10px ${MONO}`, C.dim, 'center');
  txt(g, 'DOWNLINK', 836, 320, `600 11px ${MONO}`, C.dim);
  txt(g, vitals.link || 'ACTIVE', 836, 344, `700 16px ${TECH}`, C.green);
  txt(g, 'JSC SURGEON', 836, 396, `600 11px ${MONO}`, C.dim);
  txt(g, 'ONLINE', 836, 420, `700 16px ${TECH}`, C.green);
  panel(g, 832, 458, 154, 130, 'rgba(56,189,248,0.4)', 'rgba(11,22,36,0.9)');
  txt(g, 'TERMINAL', 909, 492, `700 11px ${MONO}`, C.cyan, 'center');
  txt(g, 'CLICK TO', 909, 524, `700 12px ${UI}`, C.white, 'center');
  txt(g, 'EXPAND MCC', 909, 546, `700 14px ${TECH}`, C.amber, 'center');
  // Subtle static CRT scanlines without jumping bars
  g.fillStyle = 'rgba(255,255,255,0.018)';
  for (let y = 0; y < SCREEN_H; y += 4) g.fillRect(0, y, SCREEN_W, 1);
}

export class Screens {
  constructor() {
    this.items = {};
    [['board', drawBoard], ['vitals', drawVitals], ['alerts', drawAlerts]].forEach(([id, fn]) => {
      const c = document.createElement('canvas'); c.width = SCREEN_W; c.height = SCREEN_H;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      this.items[id] = { c, g: c.getContext('2d'), tex, fn };
    });
    this.acc = 0; this.drawAll(0);
  }
  texture(id) { return this.items[id].tex; }
  drawAll(t) { Object.values(this.items).forEach((it) => { it.fn(it.g, t); it.tex.needsUpdate = true; }); }
  update(dt, t, awake = true) { this.acc += dt; if (awake && this.acc > 0.32) { this.acc = 0; this.drawAll(t); } }
}
