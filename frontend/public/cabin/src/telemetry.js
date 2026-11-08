// Real data from the H.E.L.I.O.S backend (FastAPI WebSocket, 10 Hz) -> crew / vitals state.
// The parser is deliberately tolerant (many key spellings / message shapes). Check it against the real payload:
// open the browser console, run  HELIOS.telemetry.last  to see the latest raw message.
//
// Backend WebSocket message schema (verified from backend/app/streaming/websocket_manager.py):
//
//   Type 1 — TELEMETRY_FRAME (10 Hz, main data stream):
//   { "type": "TELEMETRY_FRAME", "data": { "astronaut_id": "AST-01_COMMANDER",
//     "heart_rate": 62.0, "hrv_rmssd": 45.2, "spo2": 98.2, "core_temp": 36.7,
//     "sleep_score": 91.0, "cabin_co2": 2.6, "radiation_flux": 0.04,
//     "radiation_dose_gy": 0.029, "computed_arf": 0.74, "computed_trm": 1.0,
//     "computed_epi": 0.0, "computed_rsi": 0.1, "alert_severity": "NOMINAL",
//     "scenario_phase": "NOMINAL_CRUISE", ... }, "mars_delay_active": false }
//
//   Type 2 — PROACTIVE_ALERT (AI voice alert, event-driven):
//   { "type": "PROACTIVE_ALERT", "data": { "speech_text": "JARVIS voice...",
//     "triage_diagnosis": "...", "actionable_instruction": "..." } }
//
import { HELIOS } from './config.js';
import { crew, vitals } from './data.js';

const KEYS = {
  hr: ['heart_rate', 'hr', 'heartRate', 'bpm', 'pulse'],
  spo2: ['spo2', 'SpO2', 'spO2', 'oxygen_saturation', 'o2_sat'],
  resp: ['resp', 'respiration_rate', 'resp_rate', 'respiratory_rate', 'rr'],
  temp: ['core_temp', 'core_temperature', 'temperature', 'temp', 'body_temp'],
  hrv: ['hrv_rmssd', 'hrv', 'rmssd'],
  sleep: ['sleep_score', 'sleep'],
  co2: ['cabin_co2', 'co2'],
  flux: ['radiation_flux', 'flux'],
  dose: ['radiation_dose_gy', 'radiation_dose', 'dose'],
  arf: ['arf', 'computed_arf'], trm: ['trm', 'computed_trm'], epi: ['epi', 'computed_epi'], rsi: ['rsi', 'computed_rsi'],
  sev: ['alert_severity', 'evaluated_severity', 'severity', 'level', 'triage', 'alert_level', 'status', 'state'],
  directive: ['jarvis', 'directive', 'voice', 'advice', 'guidance', 'jarvis_message', 'message', 'actionable_instruction', 'speech_text', 'trigger_reason'],
  scenario: ['scenario_phase', 'scenario', 'scenario_name', 'active_scenario'],
};
const NEST = ['vitals', 'biometrics', 'sensors', 'telemetry', 'metrics', 'data', 'sentry', 'biomarkers', 'computed'];
const WHO = ['astronaut_id', 'crew_id', 'astronaut', 'crew_member', 'subject', 'slug', 'name', 'id'];
const LISTS = ['crew', 'astronauts', 'members', 'subjects'];

const pick = (o, k) => { for (const key of KEYS[k]) if (o[key] !== undefined && o[key] !== null && typeof o[key] !== 'object') return o[key]; };
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : undefined; };
const flat = (o) => { const out = {}; NEST.forEach((k) => { if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) Object.assign(out, o[k]); }); return Object.assign(out, o); };

function who(o) {
  for (const k of WHO) {
    const v = o[k]; if (v === undefined || v === null || typeof v === 'object') continue;
    const s = String(v).toLowerCase();
    const c = crew.find((m) => m.slug === s || m.id === s || m.match.some((w) => s.includes(w)) || s.includes(m.slug));
    if (c) return c;
  }
  return null;
}
const level = (v) => { if (typeof v !== 'string') return undefined; if (/crit|emerg|red|danger/i.test(v)) return 'CRITICAL'; if (/warn|caution|amber|alert|abnormal/i.test(v)) return 'WARNING'; return 'NOMINAL'; };

function applyCrew(c, raw) {
  const o = flat(raw); const now = performance.now();
  const hr = num(pick(o, 'hr')), sp = num(pick(o, 'spo2')), rs = num(pick(o, 'resp')), tp = num(pick(o, 'temp')), hv = num(pick(o, 'hrv')), sl = num(pick(o, 'sleep'));
  if (hr !== undefined) c.hrNow = Math.round(hr);
  if (sp !== undefined) c.spo2Now = sp <= 1.2 ? sp * 100 : sp;
  if (rs !== undefined) c.respNow = Math.round(rs);
  if (tp !== undefined) c.tempNow = Math.round(tp * 10) / 10;
  if (hv !== undefined) c.hrvNow = Math.round(hv);
  ['arf', 'trm', 'epi', 'rsi'].forEach((k) => { const v = num(pick(o, k)); if (v !== undefined) c.risk[k] = v; });
  const lv = level(pick(o, 'sev'));
  if (lv) c.state = lv;
  else if (c.risk.arf >= 1.6 || c.risk.trm >= 2.2 || c.risk.epi >= 1.5 || c.risk.rsi >= 1.8 || (c.spo2Now && c.spo2Now < 90)) c.state = 'CRITICAL';
  else if (c.risk.epi >= 0.9 || c.risk.rsi >= 1.0 || (c.spo2Now && c.spo2Now < 94)) c.state = 'WARNING';
  else if (hr !== undefined) c.state = 'NOMINAL';
  c.off = c.state !== 'NOMINAL';
  c.ready = sl !== undefined ? Math.round(Math.min(100, sl)) : (c.state === 'CRITICAL' ? 35 : c.state === 'WARNING' ? 68 : 92);
  c.live = now;
}

function applyCabin(raw) {
  const o = flat(raw);
  const co2 = num(pick(o, 'co2')), fx = num(pick(o, 'flux')), ds = num(pick(o, 'dose'));
  if (co2 !== undefined) vitals.co2 = Math.round(co2 * 100) / 100;
  if (fx !== undefined) vitals.flux = fx;
  if (ds !== undefined) vitals.dose = ds;
  const dr = pick(o, 'directive'); if (typeof dr === 'string' && dr.length) vitals.directive = dr;
  const sc = pick(o, 'scenario');
  const storedScenario = (typeof localStorage !== 'undefined') ? localStorage.getItem('helios_scenario') : null;
  if (storedScenario && storedScenario !== 'NOMINAL_CRUISE') {
    vitals.scenario = storedScenario;
  } else if (typeof sc === 'string') {
    vitals.scenario = sc;
  }
  const al = raw.alerts || raw.findings || raw.active_alerts;
  if (Array.isArray(al)) vitals.alerts = al.slice(0, 4).map((a) => (typeof a === 'string' ? { title: a, level: 'WARNING' } : { title: a.title || a.message || a.name || a.scenario || 'Alert', level: level(a.severity || a.level) || 'WARNING' }));
}

export const telemetry = { last: null, count: 0, ws: null };
let hzCount = 0, hzT = performance.now();
let lastSpokenDirective = '';

function handle(msg) {
  telemetry.last = msg; telemetry.count++; hzCount++;
  vitals.link = 'LIVE';

  const isNominal = (typeof localStorage !== 'undefined') && localStorage.getItem('helios_scenario') === 'NOMINAL_CRUISE';

  // ── Unwrap backend envelope ────────────────────────────────────────────────
  // Backend always sends { type: 'TELEMETRY_FRAME', data: {...} } or
  //                       { type: 'PROACTIVE_ALERT', data: {...} }
  if (msg && typeof msg === 'object' && msg.type) {
    if (msg.type === 'PROACTIVE_ALERT') {
      if (isNominal) return;
      // AI voice / JARVIS directive from the clinical sentry engine
      const d = msg.data || {};
      const speech = d.speech_text || d.triage_diagnosis || d.actionable_instruction || '';
      if (speech) {
        vitals.directive = speech;
        if (speech !== lastSpokenDirective) {
          lastSpokenDirective = speech;
          if (!(window.parent && window.parent !== window)) {
            window.audio?.speakJarvis?.(speech);
          }
        }
      }
      // Also extract any alert
      if (d.actionable_instruction) {
        vitals.alerts = [{ title: d.triage_diagnosis || 'JARVIS Alert', level: 'WARNING' }, ...vitals.alerts].slice(0, 4);
      }
      return;
    }
    if (msg.type === 'TELEMETRY_FRAME') {
      // Unwrap the data envelope and fall through to normal parsing
      msg = msg.data || {};
    }
    // Unknown type – fall through and try parsing the raw object
  }

  if (Array.isArray(msg)) { msg.forEach((m) => { const c = who(m || {}); if (c) applyCrew(c, m); }); return; }
  if (!msg || typeof msg !== 'object') return;
  applyCabin(flat(msg));
  let used = false;
  for (const k of LISTS) {
    const v = msg[k]; if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v)) v.forEach((m) => { const c = who(m || {}); if (c) { applyCrew(c, m); used = true; } });
    else Object.entries(v).forEach(([key, m]) => { const c = who({ id: key, ...(m || {}) }); if (c && m && typeof m === 'object') { applyCrew(c, { id: key, ...m }); used = true; } });
  }
  if (!used) { const c = who(msg) || crew.find((m) => m.id === HELIOS.primary) || crew[0]; applyCrew(c, msg); }
  checkCriticalAlarmState();
}

let currentAlarmStatus = 'NOMINAL';

function checkCriticalAlarmState() {
  const isCritical = crew.some((c) => c.state === 'CRITICAL' || (c.spo2Now && c.spo2Now < 88) || (c.risk && (c.risk.arf >= 1.6 || c.risk.trm >= 2.2 || c.risk.epi >= 1.5 || c.risk.rsi >= 1.8)))
    || (Array.isArray(vitals.alerts) && vitals.alerts.some((a) => a.level === 'CRITICAL'));
  const isWarning = !isCritical && (
    (vitals.scenario && vitals.scenario !== 'NOMINAL_CRUISE') ||
    crew.some((c) => c.state === 'WARNING' || c.off) ||
    (Array.isArray(vitals.alerts) && vitals.alerts.some((a) => a.level === 'WARNING'))
  );

  const nextStatus = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NOMINAL';
  if (nextStatus === currentAlarmStatus) return;
  currentAlarmStatus = nextStatus;

  if (isCritical) {
    window.audio?.stopCautionAlarm?.();
    window.audio?.startMasterAlarm?.();
    document.body.classList.add('cabin-alarm');
  } else if (isWarning) {
    window.audio?.stopMasterAlarm?.();
    window.audio?.startCautionAlarm?.();
    document.body.classList.remove('cabin-alarm');
  } else {
    window.audio?.stopAllAlarms?.();
    document.body.classList.remove('cabin-alarm');
  }
}

export function applyLiveSync(d, fromIframe = false) {
  if (typeof window !== 'undefined') window.applyLiveSync = applyLiveSync;
  if (!d || typeof d !== 'object') return;
  const { telemetryMap, latestAlert, scenario } = d;

  // 1. Check if scenario is explicitly nominal or alerts are cleared
  const isExplicitNominal = d.type === 'NOMINAL_STATE' ||
    d.type === 'CLEAR_ALERTS' ||
    scenario === 'NOMINAL_CRUISE';

  if (isExplicitNominal) {
    try {
      localStorage.setItem('helios_scenario', 'NOMINAL_CRUISE');
    } catch {}
    lastSpokenDirective = '';
    window.audio?.stopJarvis?.();
    window.audio?.stopAllAlarms?.();
    window.audio?.stopMasterAlarm?.();
    window.audio?.stopCautionAlarm?.();
    currentAlarmStatus = 'NOMINAL';
    vitals.alerts = [];
    vitals.directive = 'JARVIS // BIOMETRICS: ALL CREW PARAMETERS NOMINAL WITHIN OSDR BASELINES';
    vitals.scenario = 'NOMINAL_CRUISE';
    const badgeEl = document.getElementById('deck-scenario-badge');
    const btnEl = document.getElementById('btn-scenarios');
    const scenarioSel = document.getElementById('scenario-select');
    if (scenarioSel) {
      scenarioSel.value = 'NOMINAL_CRUISE';
    }
    if (badgeEl && btnEl) {
      badgeEl.textContent = 'NOMINAL';
      badgeEl.className = 'scenario-badge';
      btnEl.classList.remove('anomaly');
    }
    
    // Explicitly restore OSDR nominal physiological baselines
    const BASELINES = {
      cmd: { hr: 62, spo2: 98.4, resp: 15, temp: 36.6, hrv: 65 },
      plt: { hr: 58, spo2: 98.6, resp: 14, temp: 36.7, hrv: 72 },
      med: { hr: 66, spo2: 98.0, resp: 14, temp: 36.9, hrv: 58 },
      mis: { hr: 64, spo2: 98.3, resp: 15, temp: 36.8, hrv: 62 },
    };
    crew.forEach((c) => {
      c.off = false;
      c.state = 'NOMINAL';
      c.ready = 92;
      const b = BASELINES[c.id];
      if (b) {
        c.hrNow = b.hr;
        c.spo2Now = b.spo2;
        c.respNow = b.resp;
        c.tempNow = b.temp;
        c.hrvNow = b.hrv;
        c.risk = { arf: 0.74, trm: 1.0, epi: 0.0, rsi: 0.1 };
      }
    });
    document.body.classList.remove('cabin-alarm');
    const visor = document.getElementById('visor');
    if (visor) visor.classList.remove('critical');
    const ab = document.getElementById('hl-alert-banner');
    if (ab) {
      ab.className = 'hl-alert-banner hidden';
      ab.classList.remove('active');
    }
    window.HELIOS?.crew?.members?.forEach((m) => {
      if (m.ring) m.ring.visible = false;
      if (m.light) m.light.intensity = 0;
    });
  } else {
    // 2. Scenario or Alert is ACTIVE!
    const effectiveScenario = scenario || vitals.scenario;
    try {
      if (effectiveScenario && effectiveScenario !== 'NOMINAL_CRUISE') {
        localStorage.setItem('helios_scenario', effectiveScenario);
      }
    } catch {}
    const isCritScenario = /SOLAR|DEPRESS|SEPSIS|TACHY|DECOMP|ARRHYTHMIA|SHOCK/i.test(effectiveScenario || '');
    const sev = latestAlert?.severity || (isCritScenario ? 'CRITICAL' : 'WARNING');
    const title = latestAlert?.headline || latestAlert?.triage_diagnosis || latestAlert?.title || d.text || (effectiveScenario ? effectiveScenario.replace(/_/g, ' ') : 'PHYSIOLOGICAL ALERT');
    const action = latestAlert?.speech_text || latestAlert?.actionable_instruction || (sev === 'CRITICAL' ? 'ENGAGE EMERGENCY PROTOCOLS IMMEDIATELY' : 'MONITOR BIOMETRIC BASELINE');
    
    vitals.alerts = [{ title, level: sev }];
    vitals.directive = action;
    vitals.scenario = effectiveScenario;
    const badgeEl = document.getElementById('deck-scenario-badge');
    const btnEl = document.getElementById('btn-scenarios');
    const scenarioSel = document.getElementById('scenario-select');
    if (scenarioSel && effectiveScenario) {
      for (let i = 0; i < scenarioSel.options.length; i++) {
        const val = scenarioSel.options[i].value;
        if (val === effectiveScenario || effectiveScenario.startsWith(val) || val.startsWith(effectiveScenario)) {
          scenarioSel.selectedIndex = i;
          break;
        }
      }
    }
    if (badgeEl && btnEl) {
      const shortName = effectiveScenario ? effectiveScenario.replace(/^SCENARIO_\d+_/, '').replace(/_/g, ' ') : 'ALERT';
      badgeEl.textContent = shortName.length > 10 ? shortName.slice(0, 8) + '…' : shortName;
      badgeEl.className = 'scenario-badge ' + (sev === 'CRITICAL' ? 'critical' : 'warning');
      btnEl.classList.add('anomaly');
    }

    // Mark affected crew
    const targetId = latestAlert?.target_crew_id || latestAlert?.astronaut_id;
    const isUniversal = !targetId || targetId === 'ALL' || isCritScenario;
    crew.forEach((c) => {
      const match = isUniversal || c.slug === targetId || c.id === targetId || String(targetId).toLowerCase().includes(c.id);
      if (match) {
        c.off = true;
        c.state = sev;
        c.ready = sev === 'CRITICAL' ? 38 : 65;
        c.live = performance.now();
      } else {
        c.off = false;
        c.state = 'NOMINAL';
      }
    });

    if (sev === 'CRITICAL') {
      window.audio?.startMasterAlarm?.();
      document.body.classList.add('cabin-alarm');
      window.hud?.toast?.(`MASTER CAUTION // ${title}`);
    } else {
      window.audio?.startCautionAlarm?.();
      document.body.classList.remove('cabin-alarm');
      window.hud?.toast?.(`CAUTION // ${title}`);
    }

    // Speak JARVIS clinical directive and action in cabin audio (standalone only)
    const spokenDirective = latestAlert?.speech_text || (action ? `${title}. ${action}.` : title);
    if (spokenDirective && spokenDirective !== lastSpokenDirective) {
      lastSpokenDirective = spokenDirective;
      if (!(window.parent && window.parent !== window)) {
        setTimeout(() => {
          window.audio?.speakJarvis?.(spokenDirective);
        }, 750);
      }
    }
  }

  // 3. Update actual biometrics if telemetryMap is provided
  if (telemetryMap && typeof telemetryMap === 'object') {
    Object.values(telemetryMap).forEach((pkt) => {
      const c = who(pkt);
      if (c) applyCrew(c, pkt);
    });
  }

  // 4. Forward to wall monitor frames and terminal if available (only if not originated from iframe)
  if (!fromIframe) {
    window.HELIOS?.live?.forwardSync?.(d);
    window.live?.forwardSync?.(d);
  }

  window.hud?.fillHelmet?.();
}

// Real-time synchronization with the H.E.L.I.O.S Dashboard (via postMessage, BroadcastChannel, and localStorage)
if (typeof window !== 'undefined') {
  // Check initial state from localStorage immediately on load
  try {
    const saved = localStorage.getItem('helios_live_sync');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.scenario && parsed.scenario !== 'NOMINAL_CRUISE') {
        applyLiveSync(parsed);
      } else {
        applyLiveSync({ type: 'NOMINAL_STATE', scenario: 'NOMINAL_CRUISE', latestAlert: null });
      }
    } else {
      const savedScenario = localStorage.getItem('helios_scenario');
      if (savedScenario && savedScenario !== 'NOMINAL_CRUISE') {
        applyLiveSync({ scenario: savedScenario });
      } else {
        applyLiveSync({ type: 'NOMINAL_STATE', scenario: 'NOMINAL_CRUISE', latestAlert: null });
      }
    }
  } catch {}

  // Cross-tab storage listener (rock-solid, works across all tabs and windows instantly)
  window.addEventListener('storage', (e) => {
    if (e.key === 'helios_live_sync' || e.key === 'helios_scenario') {
      if (!e.newValue || e.newValue === 'NOMINAL_CRUISE') {
        applyLiveSync({ type: 'NOMINAL_STATE', scenario: 'NOMINAL_CRUISE' });
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue);
        applyLiveSync(parsed);
      } catch {
        if (e.newValue === 'NOMINAL_CRUISE') {
          applyLiveSync({ type: 'NOMINAL_STATE', scenario: 'NOMINAL_CRUISE' });
        }
      }
    }
  });

  // Iframe postMessage listener
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    const d = e.data;
    if (d.type === 'HELIOS_TELEMETRY_SYNC') {
      applyLiveSync(d, true);
    } else if (d.type === 'NOMINAL_STATE' || d.type === 'CLEAR_ALERTS' || d.scenario === 'NOMINAL_CRUISE') {
      applyLiveSync({ type: 'NOMINAL_STATE', scenario: 'NOMINAL_CRUISE' }, true);
    } else if (d.type === 'CRITICAL_ALERT' || (d.type === 'SCENARIO_TRIGGERED' && d.data?.severity === 'CRITICAL') || d.severity === 'CRITICAL') {
      applyLiveSync({ latestAlert: { headline: d.data?.directive || d.text, severity: 'CRITICAL' }, scenario: 'CRITICAL_SCENARIO' }, true);
    }
  });

  // BroadcastChannel listener
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('helios-telemetry');
      bc.onmessage = (e) => {
        if (e.data && typeof e.data === 'object') {
          if (e.data.type === 'NOMINAL_STATE' || e.data.scenario === 'NOMINAL_CRUISE') {
            applyLiveSync({ type: 'NOMINAL_STATE', scenario: 'NOMINAL_CRUISE' });
          } else if (e.data.type === 'HELIOS_TELEMETRY_SYNC') {
            applyLiveSync(e.data);
          }
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }
  }
}

export function startTelemetry() {
  const url = HELIOS.apiUrl.replace(/^http/i, 'ws') + HELIOS.wsPath;
  let delay = 1500;
  const open = () => {
    let ws; try { ws = new WebSocket(url); } catch (e) { vitals.link = 'SIM'; return setTimeout(open, delay); }
    telemetry.ws = ws;
    ws.onopen = () => { delay = 1500; };
    ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) { /* ignore non-JSON frames */ } };
    ws.onclose = () => { vitals.link = 'SIM'; delay = Math.min(delay * 1.6, 10000); setTimeout(open, delay); };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* noop */ } };
  };
  open();
  setInterval(() => { // link health + message rate
    const now = performance.now(); vitals.hz = Math.round((hzCount * 1000) / (now - hzT)); hzCount = 0; hzT = now;
    if (vitals.link === 'LIVE' && !crew.some((c) => c.live && (now - c.live) / 1000 < HELIOS.staleAfter)) vitals.link = 'SIM';
  }, 1000);
  return url;
}
