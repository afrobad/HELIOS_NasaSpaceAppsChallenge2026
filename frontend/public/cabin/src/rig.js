import * as THREE from 'three';
import gsap from 'gsap';
import { STOPS, CONFIG } from './config.js';
import { clamp, damp, lerp } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ'), tmpDir = new THREE.Vector3();
const _vEyeT = new THREE.Vector3(), _vLookT = new THREE.Vector3(), _vFwd = new THREE.Vector3(), _vSway = new THREE.Vector3();

export class Rig {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom; this.enabled = false;
    this.posCurve = new THREE.CatmullRomCurve3(STOPS.map((s) => s.pos.clone()), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(STOPS.map((s) => s.look.clone()), false, 'centripetal');
    this.n = STOPS.length;
    this.target = 0; this.cur = 0; this.tween = null;
    this.eye = STOPS[0].pos.clone(); this.lookAt = STOPS[0].look.clone(); this.fov = STOPS[0].fov;
    this.mode = 'tour';           // tour | focus | crew
    this.focusM = null; this.focusOffset = new THREE.Vector3();
    this.mx = 0; this.my = 0; this.sx = 0; this.sy = 0;       // mouse parallax (target / smoothed)
    this.dragYaw = 0; this.dragPitch = 0; this.tYaw = 0; this.tPitch = 0;
    this.isDragging = false; this.vYaw = 0; this.vPitch = 0; this.parallaxWeight = 1.0;
    this.nudge = new THREE.Vector3(); this.keys = new Set(); this.roll = 0; this.swayOn = true;
    this.onStop = () => {}; this.activeIndex = 0;
    this.ext = null; this.snapNext = false; this.upCur = UP.clone();
    this.freePos = null; this.freeLookDir = new THREE.Vector3(0, 0, -1);
    this.bind();
  }

  bind() {
    const d = this.dom;
    addEventListener('wheel', (e) => {
      if (!this.enabled || (e.target?.closest && e.target.closest('#crew-panel'))) return;
      if (window.HELIOS?.crew?.dragging) return; // do not scroll deck when dragging astronaut
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 80 : 1);
      this.scrollBy(e.deltaY * k * CONFIG.scroll.wheel);
    }, { passive: false });
    this.touchY = null;
    d.addEventListener('touchstart', (e) => { if (e.touches.length === 1) this.touchY = e.touches[0].clientY; }, { passive: true });
    d.addEventListener('touchmove', (e) => { if (this.touchY == null || !this.enabled || this.blockTouch) return; const y = e.touches[0].clientY; this.scrollBy((this.touchY - y) * CONFIG.scroll.touch); this.touchY = y; }, { passive: true });
    d.addEventListener('touchend', () => { this.touchY = null; });
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (['q', 'e'].includes(k)) this.keys.add(k);
      if (k === 'r') {
        if (this.mode === 'tour' && !window.HELIOS?.crew?.selected && !window.HELIOS?.eva?.active) {
          this.tYaw = this.tPitch = 0;
          this.vYaw = this.vPitch = 0;
          this.nudge.set(0, 0, 0);
        }
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  scrollBy(dv) {
    if (this.mode === 'ext') {
      window.HELIOS?.eva?.zoom?.(dv);
      return;
    }
    this.freePos = null;
    if (this.mode !== 'tour') this.exitFocus();
    if (this.tween) { this.tween.kill(); this.tween = null; this.target = this.cur; }
    // Calibrated step clamping prevents a single wheel notch from skipping multiple deck modules!
    const step = clamp(dv, -0.012, 0.012);
    this.target = clamp(this.target + step, 0, 1);
  }
  goTo(i, dur = 0.8) {
    i = clamp(i, 0, this.n - 1);
    this.freePos = null;
    if (this.mode !== 'tour') this.exitFocus();
    if (this.tween) this.tween.kill();
    this.tYaw = 0; this.tPitch = 0;
    this.vYaw = 0; this.vPitch = 0;
    this.dragYaw = 0; this.dragPitch = 0;
    this.nudge.set(0, 0, 0);
    const to = i / (this.n - 1);
    this.tween = gsap.to(this, {
      cur: to,
      target: to,
      duration: dur,
      ease: 'power2.out',
      onComplete: () => { this.tween = null; }
    });
  }
  smoothFlyThrough(startIdx, endIdx, dur = 4.0) {
    startIdx = clamp(startIdx, 0, this.n - 1);
    endIdx = clamp(endIdx, 0, this.n - 1);
    this.freePos = null;
    if (this.mode !== 'tour') this.exitFocus();
    if (this.tween) this.tween.kill();
    const from = startIdx / (this.n - 1);
    const to = endIdx / (this.n - 1);
    this.cur = this.target = from;
    this.tween = gsap.to(this, {
      cur: to,
      target: to,
      duration: dur,
      ease: 'sine.inOut',
      onComplete: () => { this.tween = null; }
    });
  }
  setProgress(u) {
    if (this.tween) { this.tween.kill(); this.tween = null; }
    this.freePos = null;
    this.cur = this.target = clamp(u, 0, 1);
  }

  focusCrew(m) { this.mode = 'focus'; this.focusM = m; const dir = tmpDir.copy(m.holder.position).sub(this.camera.position).normalize(); this.focusOffset.copy(dir).multiplyScalar(-12).add(new THREE.Vector3(0, 1.8, 0)); }
  crewView(m) {
    this.mode = 'crew';
    this.focusM = m;
    this.snapNext = true;
    if (m && m.holder) {
      this.tYaw = this.dragYaw = m.holder.rotation.y || 0;
      this.tPitch = this.dragPitch = 0;
      const headH = (CONFIG.crewScale || 3.2) * 0.42;
      const eyeP = m.holder.position.clone().add(new THREE.Vector3(0, headH, 0));
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.tYaw, 0, 'YXZ'));
      this.eye.copy(eyeP);
      this.lookAt.copy(eyeP.clone().addScaledVector(fwd, 25));
    }
  }
  /** External camera (spacewalk): fn(t) -> { eye, look, up, fov } in world space. */
  setExternal(fn) { this.mode = 'ext'; this.ext = fn; this.focusM = null; this.snapNext = true; }
  exitFocus() { if (this.mode === 'ext') this.snapNext = true; this.mode = 'tour'; this.focusM = null; this.ext = null; if (this.onExitFocus) this.onExitFocus(); }

  setPointer(nx, ny) { this.mx = nx; this.my = ny; }
  dragLook(dx, dy, isPan = false) {
    if (this.mode === 'ext') {
      if (window.HELIOS?.eva?.view === 'pov') {
        window.HELIOS?.eva?.dragLook?.(dx, dy);
        return;
      }
      if (isPan) {
        window.HELIOS?.eva?.pan?.(dx, dy, this.camera);
      } else {
        window.HELIOS?.eva?.orbit?.(dx * 0.005, dy * 0.005);
      }
      return;
    }

    const sensX = 0.0042;
    const sensY = 0.0035;
    const deltaYaw = -dx * sensX;
    const deltaPitch = -dy * sensY;

    if (this.mode === 'crew' && this.focusM) {
      // In helmet POV, mouse drag rotates astronaut yaw and pitch freely 360 degrees without wrap glitch!
      this.tYaw += deltaYaw;
      this.tPitch = clamp(this.tPitch + deltaPitch, -1.35, 1.35);
      this.focusM.yaw = this.tYaw;
      this.focusM.holder.rotation.y = this.tYaw;
      this.vYaw = deltaYaw * 16.0;
      this.vPitch = deltaPitch * 16.0;
      return;
    }

    // Inside cabin deck: continuous, super-smooth 360 moving without wrap discontinuity
    this.tYaw += deltaYaw;
    this.tPitch = clamp(this.tPitch + deltaPitch, -1.30, 1.30);
    this.vYaw = deltaYaw * 16.0;
    this.vPitch = deltaPitch * 16.0;
  }

  /**
   * Free 6-DOF game-style camera movement:
   * W = front/forward along camera sightline, S = back/backward along sightline
   * A = strafe left, D = strafe right
   * Space / Z = ascend (+Y), Shift / X = descend (-Y)
   */
  moveCamera(dx, dy, dz, dt, camera) {
    if (this.mode === 'ext') {
      window.HELIOS?.eva?.pan?.(dx * 15, dz * 15, camera);
      return;
    }
    if (this.mode !== 'tour') this.exitFocus();
    if (this.tween) { this.tween.kill(); this.tween = null; }

    if (!this.freePos) {
      this.freePos = this.camera ? this.camera.position.clone() : this.eye.clone();
      this.freeLookDir = new THREE.Vector3();
      if (this.lookAt.distanceTo(this.eye) < 0.1) this.freeLookDir.set(0, 0, -1);
      else this.freeLookDir.copy(this.lookAt).sub(this.eye).normalize();
    }

    const speed = 20.0;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    if (fwd.lengthSq() < 0.001) fwd.set(0, 0, -1);
    else fwd.normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const rgt = new THREE.Vector3().crossVectors(fwd, up).normalize();

    // dx: strafe (+1 right, -1 left)
    // -dz: forward/back (W is dz = -1, so -dz = +1 forward along camera view vector)
    // dy: elevation (+1 up, -1 down)
    const moveVec = new THREE.Vector3()
      .addScaledVector(fwd, -dz)
      .addScaledVector(rgt, dx)
      .addScaledVector(up, dy);

    if (moveVec.lengthSq() > 0.001) {
      moveVec.normalize().multiplyScalar(speed * dt);
      this.freePos.add(moveVec);
    }

    // Authentic ISS module interior collision bounds (prevents clipping through walls/bulkheads)
    this.freePos.x = clamp(this.freePos.x, -12.5, 12.5);
    this.freePos.y = clamp(this.freePos.y, 3.5, 24.5);
    this.freePos.z = clamp(this.freePos.z, -72.0, 52.0);

    this.eye.copy(this.freePos);

    // Synchronize station corridor stop tracker without restricting free movement
    const normalizedZ = clamp((50.0 - this.freePos.z) / 115.0, 0, 1);
    this.cur = this.target = normalizedZ;
    const approxStop = Math.round(normalizedZ * (this.n - 1));
    if (approxStop !== this.activeIndex) {
      this.activeIndex = approxStop;
      if (this.onStop) this.onStop(approxStop);
    }
  }

  /**
   * Game-style camera rotation:
   * Q = rotate yaw left (360° continuously)
   * E = rotate yaw right (360° continuously)
   */
  rotateCamera(dYaw, dPitch, dt) {
    if (this.mode === 'ext') {
      window.HELIOS?.eva?.rotate?.(dYaw, dPitch, dt);
      return;
    }
    const rotSpeed = 2.2; // ~126 deg/s
    this.tYaw += dYaw * rotSpeed * dt;
    if (dPitch) {
      this.tPitch = clamp(this.tPitch + dPitch * (rotSpeed * 0.8) * dt, -1.30, 1.30);
    }
  }

  update(dt, t) {
    if (!this.enabled) return;
    // scroll progress (super-smooth, instantaneous tracking)
    if (!this.tween && !this.freePos) this.cur += (this.target - this.cur) * (1 - Math.exp(-dt * 26.0));
    const u = clamp(this.cur, 0, 1);
    const idx = Math.round(u * (this.n - 1));
    if (idx !== this.activeIndex) { this.activeIndex = idx; this.onStop(idx); }

    let eyeT, lookT, fovT, upT = UP;
    if (this.mode === 'tour') {
      if (this.freePos) {
        eyeT = this.freePos;
        lookT = _vLookT.copy(this.freePos).addScaledVector(this.freeLookDir, 25);
        fovT = 64;
      } else {
        eyeT = this.posCurve.getPoint(u, _vEyeT);
        lookT = this.lookCurve.getPoint(u, _vLookT);
        const f = u * (this.n - 1), i0 = Math.floor(f), i1 = Math.min(this.n - 1, i0 + 1);
        fovT = lerp(STOPS[i0].fov, STOPS[i1].fov, f - i0);
      }
    } else if (this.mode === 'focus' && this.focusM) {
      lookT = _vLookT.copy(this.focusM.holder.position);
      eyeT = _vEyeT.copy(lookT).add(this.focusOffset);
      fovT = 52;
    } else if (this.mode === 'crew' && this.focusM) {
      const m = this.focusM;
      const p = m.holder.position;
      const headH = (CONFIG.crewScale || 3.2) * 0.42;
      eyeT = _vEyeT.set(p.x, p.y + headH, p.z);
      tmpE.set(this.dragPitch, this.dragYaw, 0, 'YXZ');
      _vFwd.set(0, 0, -1).applyEuler(tmpE);
      lookT = _vLookT.copy(eyeT).addScaledVector(_vFwd, 25);
      fovT = 76;
    } else if (this.mode === 'ext' && this.ext) {
      const e = this.ext(t); eyeT = e.eye; lookT = e.look; fovT = e.fov; upT = e.up || UP;
    } else { eyeT = this.eye; lookT = this.lookAt; fovT = this.fov; }

    // WASD nudge decay and roll damping
    const K = this.keys;
    if (!K.size) this.nudge.multiplyScalar(Math.exp(-dt * 0.35));
    this.roll = damp(this.roll, (K.has('q') ? 0.25 : 0) - (K.has('e') ? 0.25 : 0), 4, dt);
    _vEyeT.copy(eyeT).add(this.nudge);
    eyeT = _vEyeT;

    if (this.mode === 'tour') {
      if (this.snapNext) { this.snapNext = false; }
      this.eye.copy(eyeT);
      this.lookAt.copy(lookT);
      this.fov = fovT;
      this.upCur.copy(upT);
    } else {
      let k = this.mode === 'crew' ? 1 - Math.exp(-dt * 26) : 1 - Math.exp(-dt * 16);
      if (this.snapNext) { k = 1; this.snapNext = false; this.fov = fovT; }
      this.eye.lerp(eyeT, k);
      this.lookAt.lerp(lookT, k);
      this.upCur.lerp(upT, Math.min(1, k * 0.5)).normalize();
      this.fov = lerp(this.fov, fovT, 1 - Math.exp(-dt * 16));
    }

    // zero-g sway
    const A = this.swayOn ? CONFIG.sway.amp * (this.mode === 'ext' ? 0.2 : 1) : 0;
    _vSway.set(Math.sin(t * 0.37) + Math.sin(t * 0.91) * 0.4, Math.sin(t * 0.53 + 1) + Math.sin(t * 1.3) * 0.3, Math.cos(t * 0.29)).multiplyScalar(A);
    this.camera.position.copy(this.eye).add(_vSway);

    // orientation: look-at + mouse parallax + drag-look + roll
    // Inertia & momentum coasting when user releases mouse
    if (!this.isDragging) {
      if (Math.abs(this.vYaw) > 0.0001) {
        this.tYaw += this.vYaw * dt;
        this.vYaw *= Math.exp(-dt * 9.0);
      } else {
        this.vYaw = 0;
      }
      if (Math.abs(this.vPitch) > 0.0001) {
        this.tPitch = clamp(this.tPitch + this.vPitch * dt, -1.30, 1.30);
        this.vPitch *= Math.exp(-dt * 9.0);
      } else {
        this.vPitch = 0;
      }
    }

    // High-frequency, buttery-smooth exponential damping (instant 1:1 response during drag, smooth glide on release)
    const kLook = this.isDragging ? (1 - Math.exp(-dt * 50.0)) : (1 - Math.exp(-dt * 24.0));
    this.dragYaw += (this.tYaw - this.dragYaw) * kLook;
    this.dragPitch += (this.tPitch - this.dragPitch) * kLook;

    // Passive cursor parallax (smoothly faded out while dragging so cursor never fights rotation)
    const targetParallax = this.isDragging ? 0 : 1;
    this.parallaxWeight = damp(this.parallaxWeight !== undefined ? this.parallaxWeight : 1, targetParallax, 12, dt);
    this.sx = damp(this.sx, this.mx, 8, dt);
    this.sy = damp(this.sy, this.my, 8, dt);

    tmpM.lookAt(this.camera.position, this.lookAt, this.upCur);
    this.camera.quaternion.setFromRotationMatrix(tmpM);
    if (this.mode !== 'ext' && this.mode !== 'crew') {
      tmpE.set(
        this.dragPitch + this.sy * CONFIG.look.mousePitch * this.parallaxWeight + Math.sin(t * 0.41) * 0.003,
        this.dragYaw - this.sx * CONFIG.look.mouseYaw * this.parallaxWeight,
        this.roll + (this.swayOn ? Math.sin(t * 0.33) * CONFIG.sway.roll : 0)
      );
      tmpQ.setFromEuler(tmpE);
      this.camera.quaternion.multiply(tmpQ);
    }
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }
}
