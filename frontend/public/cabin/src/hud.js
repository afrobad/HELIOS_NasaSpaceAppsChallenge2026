import { STOPS } from './config.js';
import { crew, vitals, ecg, missionTime } from './data.js';
import { $, smooth } from './util.js';

const RISK = [['ARF', 'arf', 1.6], ['TRM', 'trm', 2.2], ['EPI', 'epi', 1.5], ['RSI', 'rsi', 1.8]];
const stCls = (s) => (s === 'CRITICAL' ? 'crit' : s === 'WARNING' ? 'warn' : 'ok');

/** Per-astronaut helmet HUD (style of the project's /suit-hud) + crew panel + stop nav. */
export class HUD {
  constructor() {
    this.visor = $('visor'); this.par = $('hl-par'); this.glass = $('hl-glass'); this.ecgC = $('hl-ecg').getContext('2d'); this.cpEcg = $('cp-ecg').getContext('2d');
    this.panelCrew = null; this.helmet = crew[0]; this.visorOn = false;
    $('hl-strip').innerHTML = crew.map((c) => `<div class="chip" data-id="${c.id}"><i class="d"></i><span>${c.call}</span><b>--</b></div>`).join('');
    $('hl-risk').innerHTML = RISK.map(([n, k]) => `<div class="rk" data-k="${k}"><span>${n}</span><div class="bar"><i></i></div><b>—</b></div>`).join('');
    this.chips = [...document.querySelectorAll('#hl-strip .chip')];
    this.chips.forEach((ch, idx) => {
      ch.style.cursor = 'pointer';
      ch.addEventListener('click', (e) => {
        e.stopPropagation();
        window.audio?.playChirp();
        const m = crew[idx];
        if (m) {
          this.setHelmet(m);
          window.lookThrough?.(m);
        }
      });
      ch.addEventListener('mouseenter', () => {
        window.audio?.playClick();
      });
    });
    this.curStopIndex = 0;
    const SHORT_TAGS = ['HUD', 'CORR', 'BIO', 'CARGO', 'MCC', 'FLIGHT', 'NAV', 'CUPOLA', 'AFT', 'AIRLOCK'];
    $('stop-list').innerHTML = STOPS.map((s, i) =>
      `<button class="wpc-key" data-i="${i}" type="button" aria-label="Waypoint ${i + 1}: ${s.title}">
        <span class="wpc-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="wpc-lbl">${SHORT_TAGS[i] || ('WP' + (i + 1))}</span>
        <div class="wpc-indicator"></div>
        <div class="wpc-tooltip">
          <span class="wpc-tip-num">STOP ${String(i + 1).padStart(2, '0')}</span>
          <b class="wpc-tip-title">${s.title}</b>
          <span class="wpc-tip-coord">Z: ${s.pos.z > 0 ? '+' : ''}${s.pos.z.toFixed(1)}m · FOV ${s.fov}°</span>
        </div>
      </button>`
    ).join('');
    this.items = [...document.querySelectorAll('#stop-list .wpc-key')];

    $('wp-btn-prev')?.addEventListener('click', () => {
      window.audio?.playChirp();
      const prevI = (this.curStopIndex > 0 ? this.curStopIndex - 1 : STOPS.length - 1);
      if (this.navCallback) this.navCallback(prevI);
    });
    $('wp-btn-next')?.addEventListener('click', () => {
      window.audio?.playChirp();
      const nextI = (this.curStopIndex < STOPS.length - 1 ? this.curStopIndex + 1 : 0);
      if (this.navCallback) this.navCallback(nextI);
    });

    this.setStop(0, true); this.fillHelmet();
  }

  onNav(fn) {
    this.navCallback = fn;
    this.items.forEach((btn) => {
      btn.addEventListener('click', () => {
        window.audio?.playChirp();
        fn(+btn.dataset.i);
      });
      btn.addEventListener('mouseenter', () => {
        window.audio?.playClick();
      });
    });
  }
  setStop(i) {
    this.curStopIndex = i;
    this.items.forEach((btn, k) => btn.classList.toggle('on', k === i));
    const s = STOPS[i];
    if (s) {
      const curNum = $('wp-cur-num'); if (curNum) curNum.textContent = String(i + 1).padStart(2, '0');
      const actTitle = $('wpc-active-title'); if (actTitle) actTitle.textContent = s.title;
      const actZone = $('wpc-active-zone'); if (actZone) actZone.textContent = s.pos.z > 20 ? 'Aft Airlock & Bio Corridor' : s.pos.z > -15 ? 'Midship Operations & Telemetry' : 'Forward Flight Deck & Cupola Window';
      const actFov = $('wpc-active-fov'); if (actFov) actFov.textContent = `${s.fov}°`;
    }
  }

  /** Whose helmet are we looking through? */
  setHelmet(m) { this.helmet = m ? (m.c || m) : crew[0]; this.fillHelmet(); }

  /** u = tour progress 0..1 · active = tour mode · crewMode = looking through a helmet · (px,py) = head parallax -1..1 */
  update(u, active, crewMode, px = 0, py = 0) {
    const o = crewMode ? 1 : 0;
    this.visor.style.opacity = o.toFixed(3); this.visor.style.display = o < 0.01 ? 'none' : 'block'; this.visorOn = o >= 0.01;
    this.visor.style.filter = 'none';
    document.body.classList.toggle('helmet', this.visorOn);
    if (!this.visorOn) {
      window.audio?.stopMasterAlarm?.();
      const ab = $('hl-alert-banner'); if (ab) ab.classList.remove('active');
    }
    // head-tracking parallax: HUD floats ±14px, the glass/glare moves the other way (visor curvature depth)
    this.par.style.transform = `translate(${(-px * 14).toFixed(1)}px,${(-py * 14).toFixed(1)}px)`;
    this.glass.style.transform = `translate(${(px * 9).toFixed(1)}px,${(py * 7).toFixed(1)}px)`;
  }

  fillHelmet() {
    const c = this.helmet; if (!c) return;
    $('hl-call').textContent = c.call; $('hl-role').textContent = c.role.toUpperCase();
    $('hl-hr').textContent = c.hrNow; $('hl-spo2').textContent = c.spo2Now.toFixed(1); $('hl-resp').textContent = c.respNow; $('hl-temp').textContent = c.tempNow.toFixed(1); $('hl-hrv').textContent = c.hrvNow;
    $('hl-co2').textContent = vitals.co2.toFixed(2); $('hl-flux').textContent = vitals.flux.toFixed(2); $('hl-dose').textContent = vitals.dose.toFixed(1);
    RISK.forEach(([, k, lim]) => { const el = this.visor.querySelector(`.rk[data-k="${k}"]`), v = c.risk[k]; el.querySelector('b').textContent = v == null ? '—' : v.toFixed(2); el.querySelector('i').style.width = `${Math.round(Math.min(1, (v == null ? 0.12 : v / lim)) * 100)}%`; el.classList.toggle('crit', v != null && v >= lim); });
    const st = $('hl-state'); st.textContent = c.state; st.className = stCls(c.state);
    $('hl-alerts').textContent = vitals.alerts.length ? `${vitals.alerts.length} OPEN` : '0 OPEN';
    const lk = $('hl-link'); lk.textContent = vitals.link === 'LIVE' ? `LIVE ${vitals.hz || 10}Hz` : vitals.link === 'SIM' ? 'SIM' : '…'; lk.className = vitals.link === 'LIVE' ? 'ok' : 'warn';
    $('hl-dir').textContent = vitals.directive ? vitals.directive.toUpperCase() : (c.off ? `${c.role.toUpperCase()}: BIOMETRIC VARIANCE · ENGAGING FLIGHT SURGEON PROTOCOLS` : 'JARVIS // BIOMETRICS: ALL CREW PARAMETERS NOMINAL WITHIN OSDR BASELINES');
    $('hl-dir').className = 'hl-dir' + (c.off ? ' ' + stCls(c.state) : '');
    this.chips.forEach((ch, i) => { const m = crew[i]; ch.classList.toggle('me', m === c); ch.classList.toggle('bad', m.off); ch.querySelector('b').textContent = m.hrNow; ch.querySelector('.d').className = 'd ' + stCls(m.state); });
    const hln = $('hl-n'); if (hln) hln.textContent = crew.length;
    const hloff = $('hl-off'); if (hloff) hloff.textContent = crew.filter((m) => m.off).length;

    // Critical scenario & Master Caution integration (/suit-hud parity)
    const activeScenario = Boolean(vitals.scenario && vitals.scenario !== 'NOMINAL_CRUISE');
    const isScenarioCritical = activeScenario && /SOLAR|DEPRESS|SEPSIS|TACHY|DECOMP|ARRHYTHMIA|SHOCK/i.test(vitals.scenario || '');
    const hasCriticalAlert = Boolean(vitals.alerts && vitals.alerts.some((a) => a.level === 'CRITICAL' || /CRIT|DANGER|EMERG/i.test(a.level)));
    const hasAnyCriticalCrew = crew.some((m) => m.state === 'CRITICAL');

    const isCrit = isScenarioCritical || hasCriticalAlert || hasAnyCriticalCrew || c.state === 'CRITICAL';
    const isWarn = !isCrit && (
      activeScenario ||
      (vitals.alerts && vitals.alerts.length > 0) ||
      crew.some((m) => m.off || m.state === 'WARNING') ||
      c.state === 'WARNING' || c.off
    );

    const nextAlertLevel = isCrit ? 'CRITICAL' : isWarn ? 'WARNING' : 'NOMINAL';

    // Only update DOM classes and trigger audio on genuine state transitions (prevents HUD blinking)
    if (this._lastAlertLevel !== nextAlertLevel) {
      this._lastAlertLevel = nextAlertLevel;

      this.visor.classList.toggle('critical', isCrit);
      if (isCrit) {
        document.body.classList.add('cabin-alarm');
      } else {
        document.body.classList.remove('cabin-alarm');
      }

      const ab = $('hl-alert-banner');
      if (ab) {
        if (isCrit) {
          ab.className = 'hl-alert-banner active crit';
          const habType = $('hab-type'); if (habType) habType.textContent = 'CRITICAL ALERT';
          const habCode = $('hab-code'); if (habCode) habCode.textContent = vitals.alerts[0]?.title || `${c.role.toUpperCase()}: ACUTE PHYSIOLOGICAL COMPROMISE`;
          const habText = $('hab-text'); if (habText) habText.textContent = vitals.directive ? vitals.directive.toUpperCase() : 'ADMINISTER HIGH-FLOW O2 & PREPARE RECOVERY PROTOCOLS';
          window.audio?.stopCautionAlarm?.();
          window.audio?.startMasterAlarm?.();
        } else if (isWarn) {
          ab.className = 'hl-alert-banner active warn';
          const habType = $('hab-type'); if (habType) habType.textContent = 'MASTER CAUTION';
          const habCode = $('hab-code'); if (habCode) habCode.textContent = vitals.alerts[0]?.title || `${c.role.toUpperCase()}: BIOMETRIC VARIANCE DETECTED`;
          const habText = $('hab-text'); if (habText) habText.textContent = vitals.directive ? vitals.directive.toUpperCase() : 'MONITOR VITALS & RESTRICT EXERTION';
          window.audio?.stopMasterAlarm?.();
          window.audio?.startCautionAlarm?.();
        } else {
          ab.className = 'hl-alert-banner';
          window.audio?.stopAllAlarms?.();
        }
      }
    } else if (isCrit || isWarn) {
      // Smoothly update directive text without re-triggering transitions
      const habCode = $('hab-code');
      const expectedCode = vitals.alerts[0]?.title || (isCrit ? `${c.role.toUpperCase()}: ACUTE PHYSIOLOGICAL COMPROMISE` : `${c.role.toUpperCase()}: BIOMETRIC VARIANCE DETECTED`);
      if (habCode && habCode.textContent !== expectedCode) habCode.textContent = expectedCode;

      const habText = $('hab-text');
      const expectedAction = vitals.directive ? vitals.directive.toUpperCase() : (isCrit ? 'ADMINISTER HIGH-FLOW O2 & PREPARE RECOVERY PROTOCOLS' : 'MONITOR VITALS & RESTRICT EXERTION');
      if (habText && habText.textContent !== expectedAction) habText.textContent = expectedAction;
    }

    // Holographic Body Scanner Widget status
    const hHead = $('hbw-head'), hChest = $('hbw-chest'), hLimbs = $('hbw-limbs');
    const hStatus = $('hbw-status'), hSub = $('hbw-sub');
    if (hHead && hChest && hLimbs) {
      if (isCrit) {
        hHead.setAttribute('class', 'hbw-dot crit');
        hChest.setAttribute('class', 'hbw-dot crit');
        hLimbs.setAttribute('class', 'hbw-dot warn');
        if (hStatus) hStatus.textContent = 'BIO-SCAN: ANOMALY';
        if (hSub) hSub.textContent = 'ACUTE METABOLIC COMPROMISE';
      } else if (isWarn) {
        hHead.setAttribute('class', 'hbw-dot nominal');
        hChest.setAttribute('class', 'hbw-dot warn');
        hLimbs.setAttribute('class', 'hbw-dot nominal');
        if (hStatus) hStatus.textContent = 'BIO-SCAN: VARIANCE';
        if (hSub) hSub.textContent = 'ELEVATED METABOLIC LOAD';
      } else {
        hHead.setAttribute('class', 'hbw-dot nominal');
        hChest.setAttribute('class', 'hbw-dot nominal');
        hLimbs.setAttribute('class', 'hbw-dot nominal');
        if (hStatus) hStatus.textContent = 'BIO-SCAN: NOMINAL';
        if (hSub) hSub.textContent = '4 SENSORS LOCKED';
      }
    }
  }

  tick() { // ~4 Hz
    const m = Math.floor(missionTime()), mm = String(37 + Math.floor(m / 60)).padStart(2, '0'), ss = String(m % 60).padStart(2, '0');
    $('hl-met').textContent = `MET T+00:${mm}:${ss}`;
    if (this.visorOn) this.fillHelmet();
    if (this.panelCrew) this.fillPanel(this.panelCrew);
  }

  drawEcg(t) {
    const draw = (g, w, h, color) => { g.clearRect(0, 0, w, h); g.strokeStyle = color; g.lineWidth = 1.8; g.shadowColor = color; g.shadowBlur = 6; g.beginPath();
      for (let i = 0; i <= w; i += 2) { const p = (((i / w) * 2 - t * 0.55) % 1 + 1) % 1; const y = h * 0.72 - ecg(p) * h * 0.62; i ? g.lineTo(i, y) : g.moveTo(i, y); } g.stroke(); };
    if (this.visorOn) draw(this.ecgC, 240, 46, this.helmet.off ? '#ff3d57' : '#7dffd0');
    if (this.panelCrew) draw(this.cpEcg, 200, 34, this.panelCrew.c.off ? '#ff3d57' : '#3dffa2');
  }

  fillPanel(m) {
    const c = m.c; $('cp-role').textContent = c.role; $('cp-hr').textContent = c.hrNow; $('cp-spo2').textContent = c.spo2Now.toFixed(1); $('cp-resp').textContent = c.respNow; $('cp-ready').textContent = c.ready;
    $('cp-state').textContent = c.state; $('crew-panel').classList.toggle('off', c.off);
  }
  openPanel(m) { this.panelCrew = m; this.fillPanel(m); $('crew-panel').classList.remove('hidden'); }
  closePanel() { this.panelCrew = null; $('crew-panel').classList.add('hidden'); }

  toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 2400); }
}
