import { CREW, HELIOS } from './config.js';

/** Live crew state shared by the helmet HUDs, in-world tags, wall screens and crew panel. */
export const crew = CREW.map((c) => ({
  ...c, baseHr: c.hr, hrNow: c.hr, spo2Now: c.spo2, respNow: c.resp,
  tempNow: 36.7, hrvNow: 62, state: c.off ? 'WARNING' : 'NOMINAL',
  risk: { arf: null, trm: null, epi: null, rsi: null }, live: 0,
}));
export const byId = (id) => crew.find((c) => c.id === id);
export const isLive = (c) => c.live && (performance.now() - c.live) / 1000 < HELIOS.staleAfter;

/** Cabin-wide values + link state (filled by telemetry.js when the real backend is connected). */
export const vitals = {
  ready: 91, co2: 2.6, flux: 0.04, dose: 29.1, delayMin: 12.4,
  alerts: [],            // [{ title, level }]
  directive: '',         // latest JARVIS voice line from the backend
  scenario: '',
  link: 'CONNECTING',    // CONNECTING | LIVE | SIM
  hz: 0,
};

let t0 = performance.now();
export const missionTime = () => (performance.now() - t0) / 1000;

/** Called ~1 Hz: tiny random walk so simulated crew still look alive. Live crew (real backend data) are skipped. */
export function tickVitals() {
  const hasLiveAlert = Boolean((vitals.scenario && vitals.scenario !== 'NOMINAL_CRUISE') || (vitals.alerts && vitals.alerts.length > 0));
  crew.forEach((c) => {
    if (isLive(c)) return;
    c.hrNow = Math.round(Math.min(c.baseHr + 4, Math.max(c.baseHr - 4, c.hrNow + (Math.random() - 0.5) * 2.6)));
    c.spo2Now = Math.min(99.6, Math.max(95.5, c.spo2Now + (Math.random() - 0.5) * 0.2));
    c.respNow = Math.round(Math.min(c.resp + 1, Math.max(c.resp - 1, c.respNow + (Math.random() - 0.5) * 1.4)));
    c.tempNow = Math.round((36.7 + (Math.random() - 0.5) * 0.2) * 10) / 10;
    c.hrvNow = Math.round(62 + (Math.random() - 0.5) * 8);
    if (!hasLiveAlert) {
      c.off = false;
      c.state = 'NOMINAL';
    }
  });
  if (vitals.link !== 'LIVE') {
    vitals.co2 = Math.round((2.6 + (Math.random() - 0.5) * 0.12) * 100) / 100;
    vitals.dose = Math.round((29.1 + (Math.random() - 0.5) * 0.8) * 10) / 10;
    if (!hasLiveAlert) {
      vitals.alerts = [];
      vitals.directive = '';
      vitals.scenario = 'NOMINAL_CRUISE';
    }
  }
  crew.forEach((c) => { c.ready = c.state === 'CRITICAL' ? 35 : c.state === 'WARNING' ? Math.min(c.ready, 72) : Math.max(c.ready, 88); });
}

/** ECG waveform, phase in [0,1). */
export function ecg(p) {
  const g = (c, w, a) => a * Math.exp(-((p - c) * (p - c)) / (2 * w * w));
  return g(0.16, 0.03, 0.14) + g(0.27, 0.011, -0.16) + g(0.3, 0.011, 1.0) + g(0.335, 0.012, -0.26) + g(0.56, 0.05, 0.3);
}
