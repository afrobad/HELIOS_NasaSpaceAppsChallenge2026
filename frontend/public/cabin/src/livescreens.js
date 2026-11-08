// Projects the REAL H.E.L.I.O.S pages (main dashboard, MCC) onto the 3D wall monitors,
// and provides a fully interactive NASA Flight Operations Terminal modal.
import * as THREE from 'three';
import { HELIOS, MONITORS } from './config.js';

const W = 1280;                      // iframe CSS pixel width; height follows the screen aspect
const tmp = new THREE.Vector3(), ray = new THREE.Raycaster(), inv = new THREE.Matrix4();

function solve(A, b) {               // Gaussian elimination, 8x8
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}

/** CSS matrix3d that maps the rect (0,0)-(w,h) onto the quad d = [[x,y] x4] (TL, TR, BR, BL). */
function quadMatrix(w, h, d) {
  const s = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = s[i], [X, Y] = d[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  const [a, bb, c, dd, e, f, g, hh] = solve(A, b);
  return `matrix3d(${a},${dd},0,${g},${bb},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
const inPoly = (x, y, p) => { let r = false; for (let i = 0, j = 3; i < 4; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) r = !r; } return r; };

export class LiveScreens {
  constructor({ world, crew, camera, rig }) {
    Object.assign(this, { world, crew, camera, rig });
    this.enabled = HELIOS.liveFrames;
    this.items = [];
    this.interactive = null;
    this.terminalPage = 'dashboard';

    this.layer = document.createElement('div');
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', zIndex: '4', pointerEvents: 'none', overflow: 'hidden' });
    document.body.appendChild(this.layer);

    // Global reference for instant cross-system telemetry forwarding
    if (typeof window !== 'undefined') {
      window.live = this;
      if (window.HELIOS) window.HELIOS.live = this;
    }

    world.monitors.forEach((g, i) => {
      const cfg = MONITORS[i], plane = g.userData.screen; if (!plane || !cfg.page) return;
      const wrap = document.createElement('div'); wrap.className = 'live-frame'; wrap.dataset.id = cfg.id;
      const H = Math.round(W * (plane.geometry.parameters.height / plane.geometry.parameters.width));
      Object.assign(wrap.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: W + 'px',
        height: H + 'px',
        transformOrigin: '0 0',
        display: 'none',
        pointerEvents: 'none',
        background: 'transparent',
        overflow: 'hidden',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transformStyle: 'preserve-3d',
      });
      wrap.innerHTML = `
        <div class="lf-glass"></div>
        <div class="lf-label">${cfg.label}</div>
        <div class="lf-controls">
          <button type="button" class="lfc-btn exp">⛶ EXPAND TERMINAL</button>
          <button type="button" class="lfc-btn esc">✕ RELEASE</button>
        </div>
      `;
      wrap.querySelector('.lfc-btn.exp')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTerminal(cfg.page);
      });
      wrap.querySelector('.lfc-btn.esc')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.release();
      });

      this.layer.appendChild(wrap);
      const it = { cfg, plane, wrap, H, frame: null, quad: null, shown: false };
      this.items.push(it);
      this.load(it); // Auto-load live dashboard & MCC iframes immediately
    });

    this._setupTerminal();

    // Bidirectional sync bridge: Listen for messages from inside monitor iframes
    window.addEventListener('message', (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'HELIOS_TELEMETRY_SYNC' || e.data.type === 'NOMINAL_STATE' || e.data.scenario === 'NOMINAL_CRUISE') {
        import('./telemetry.js').then((mod) => {
          mod.applyLiveSync(e.data, true /* fromIframe */);
        });
        // Do NOT forward monitor iframe nominal resets up to parent window
      }
    });
  }

  _setupTerminal() {
    this.modal = document.getElementById('live-terminal-modal');
    this.termFrame = document.getElementById('term-frame');
    this.tabDash = document.getElementById('tab-dash');
    this.tabMcc = document.getElementById('tab-mcc');

    document.getElementById('term-close')?.addEventListener('click', () => this.closeTerminal());
    document.getElementById('term-backdrop')?.addEventListener('click', () => this.closeTerminal());

    this.tabDash?.addEventListener('click', () => this.switchTerminalTab('dashboard'));
    this.tabMcc?.addEventListener('click', () => this.switchTerminalTab('mcc'));

    document.getElementById('term-open-tab')?.addEventListener('click', () => {
      const url = HELIOS.pages?.[this.terminalPage] || (HELIOS.appUrl + (HELIOS.pages?.[this.terminalPage] || '/'));
      window.open(url, '_blank');
    });
  }

  openTerminal(page = 'dashboard') {
    if (!this.modal) return;
    this.release();
    this.switchTerminalTab(page);
    this.modal.classList.remove('hidden');
    window.audio?.playChirp(true);
  }

  closeTerminal() {
    if (!this.modal || this.modal.classList.contains('hidden')) return false;
    this.modal.classList.add('hidden');
    window.audio?.playClick();
    return true;
  }

  switchTerminalTab(page) {
    this.terminalPage = page;
    const url = HELIOS.pages?.[page] || (HELIOS.appUrl + (HELIOS.pages?.[page] || '/'));
    if (this.termFrame && this.termFrame.src !== url) {
      this.termFrame.src = url;
    }
    this.tabDash?.classList.toggle('on', page === 'dashboard');
    this.tabMcc?.classList.toggle('on', page === 'mcc');
    const statEl = document.getElementById('term-stat');
    if (statEl) {
      statEl.textContent = page === 'dashboard' ? 'COCKPIT BIO-TELEMETRY // NASA ISS' : 'EARTH FLIGHT DYNAMICS // DOWNLINK ACTIVE';
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.release();
      this.items.forEach((it) => this.hide(it));
    }
  }

  load(it) {
    if (it.frame) return;
    const f = document.createElement('iframe');
    const targetUrl = (HELIOS.pages && HELIOS.pages[it.cfg.page])
      ? HELIOS.pages[it.cfg.page]
      : (HELIOS.appUrl + (HELIOS.pages?.[it.cfg.page] || '/'));
    f.src = targetUrl;
    f.title = it.cfg.label;
    f.loading = 'eager';
    f.allow = 'autoplay; fullscreen';
    Object.assign(f.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      border: '0',
      background: 'transparent',
      opacity: '0',
      transition: 'opacity 0.35s ease',
    });
    
    // Automatically synchronize scenario and alerts to monitor iframe upon load
    const setLoaded = () => {
      f.style.opacity = '1';
      f.style.background = 'transparent';
      it.wrap.style.background = '#06090f';
      it.wrap.classList.add('has-frame');
      const sendSaved = () => {
        try {
          const saved = localStorage.getItem('helios_live_sync');
          if (saved) {
            f.contentWindow?.postMessage(JSON.parse(saved), '*');
          }
        } catch {}
      };
      sendSaved();
      setTimeout(sendSaved, 250);
      setTimeout(sendSaved, 750);
    };

    f.addEventListener('load', setLoaded);
    setTimeout(() => {
      if (f.style.opacity === '0') setLoaded();
    }, 1200);

    f.addEventListener('error', () => {
      f.style.opacity = '0';
      it.wrap.style.background = 'transparent';
    });

    it.wrap.insertBefore(f, it.wrap.firstChild);
    it.frame = f;
  }

  forwardSync(payload) {
    this.items.forEach((it) => {
      if (it.frame && it.frame.contentWindow) {
        try {
          it.frame.contentWindow.postMessage(payload, '*');
        } catch {}
      }
    });
    if (this.termFrame && this.termFrame.contentWindow) {
      try {
        this.termFrame.contentWindow.postMessage(payload, '*');
      } catch {}
    }
  }

  hide(it) {
    if (it.shown) {
      it.wrap.style.display = 'none';
      it.shown = false;
    }
    it.quad = null;
    it.currentPts = null;
  }

  /** Screen-space polygon of monitor `it`, or null when it is not usable. */
  project(it, visible) {
    const { plane } = it;
    plane.updateWorldMatrix(true, false);
    // Inset slightly by 2% so the screen sits strictly inside the physical monitor bezel frame
    const gp = plane.geometry.parameters, hw = (gp.width * 0.98) / 2, hh = (gp.height * 0.98) / 2;
    const cs = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([x, y]) => plane.localToWorld(new THREE.Vector3(x, y, 0)));
    const centre = plane.localToWorld(new THREE.Vector3(0, 0, 0)), nrm = plane.getWorldDirection(new THREE.Vector3());
    const cam = this.camera.position;

    // Use angle hysteresis to prevent rapid on/off flickering when rotating or floating:
    const dot = tmp.copy(cam).sub(centre).dot(nrm);
    const minDot = it.shown ? 0.015 : 0.05;
    if (dot <= minDot) return null;

    const pts = [];
    // Hysteresis for camera plane clipping to prevent corner flutter
    const maxZ = it.shown ? 0.20 : -0.25;
    for (const c of cs) {
      const v = c.clone().applyMatrix4(inv);
      if (v.z > maxZ) return null;             // corner is behind camera plane
      c.project(this.camera);
      pts.push([(c.x * 0.5 + 0.5) * innerWidth, (-c.y * 0.5 + 0.5) * innerHeight]);
    }
    const wpx = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const minWpx = it.shown ? 40 : 75;       // Hysteresis for minimum pixel width
    if (wpx < minWpx) return null;

    if (pts.every(([x]) => x < -250) || pts.every(([x]) => x > innerWidth + 250) || pts.every(([, y]) => y < -250) || pts.every(([, y]) => y > innerHeight + 250)) return null;

    return pts;
  }

  update() {
    const w = this.world, r = this.rig;
    const ok = this.enabled && w.phase === 'cabin' && w.cabin.visible && r.enabled && r.mode !== 'ext' && !document.body.classList.contains('intro');
    if (!ok) {
      if (this.items.some(it => it.shown)) {
        this.items.forEach(it => this.hide(it));
      }
      if (this.interactive) this.release();
      return;
    }
    this.camera.updateMatrixWorld();
    inv.copy(this.camera.matrixWorld).invert();
    this.items.forEach((it) => {
      const pts = this.project(it);
      if (!pts) {
        it.missCount = (it.missCount || 0) + 1;
        // Require 4 consecutive missing frames before hiding to absorb any single-frame camera bounce
        if (it.missCount > 3 || !it.shown) {
          this.hide(it);
          if (this.interactive === it) this.release();
        }
        return;
      }
      it.missCount = 0;
      this.load(it);

      // Lock directly to exact 3D projection on each frame so mouse scrolling never slips or offsets out of the monitor
      it.quad = pts;
      it.wrap.style.transform = quadMatrix(W, it.H, pts);
      if (!it.shown) {
        it.wrap.style.display = 'block';
        it.shown = true;
      }
    });
  }

  /** Which live screen is under this screen point (only visible ones). */
  hit(x, y) {
    return this.items.find((it) => it.shown && it.quad && inPoly(x, y, it.quad)) || null;
  }

  grab(it) {
    this.release();
    this.interactive = it;
    this.layer.style.pointerEvents = 'auto';
    this.layer.style.zIndex = '45';
    it.wrap.style.pointerEvents = 'auto';
    it.wrap.classList.add('interactive');
  }

  release() {
    if (!this.interactive) return false;
    this.interactive.wrap.style.pointerEvents = 'none';
    this.interactive.wrap.classList.remove('interactive');
    this.layer.style.pointerEvents = 'none';
    this.layer.style.zIndex = '4';
    this.interactive = null;
    return true;
  }
}
