// Outside views + spacewalk.
//   Views:  'cabin'   inside the station
//           'station' free orbit around the ISS            (all deployed astronauts visible)
//           'earth'   station against the Earth below       (all deployed astronauts visible)
//           'out'     watch a spacewalking astronaut
//           'pov'     that astronaut's helmet camera
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { WORLD } from './config.js';
import { normalize, rand, $ } from './util.js';
import { makeAstronaut } from './procedural.js';

const SIZE = 2.4, UPW = new THREE.Vector3(0, 1, 0);
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const LABEL = {
  station: 'Outside · orbiting the station',
  earth: 'Outside · station above Earth',
  out: 'Spacewalk · watching astronaut',
  pov: 'Spacewalk · astronaut helmet camera',
  cabin: 'Back inside the cabin'
};

// Realistic distinct EVA tasks and hull work sites for each crew role with fixed ISS hull tether anchors
const EVA_TASKS = {
  cmd: {
    title: 'AMS-02 Cryo Refurbishment',
    anchor: v3(-5.1, 2.1, 0.3), // Port Truss Structural D-Ring on ISS Hull
    anchorNorm: v3(0, 1, 0),
    sites: [
      { p: v3(-21.0, 3.75, -3.75), n: v3(0, 0.9, -0.4).normalize() },
      { p: v3(-27.0, 4.5, -2.7), n: v3(-0.3, 0.9, -0.3).normalize() },
      { p: v3(-17.25, 3.3, -4.8), n: v3(0.2, 0.9, -0.3).normalize() }
    ]
  },
  plt: {
    title: 'iROSA 1B Solar Strut Rigging',
    anchor: v3(5.1, 2.1, 0.3), // Starboard Truss Structural D-Ring on ISS Hull
    anchorNorm: v3(0, 1, 0),
    sites: [
      { p: v3(22.5, 3.9, 3.0), n: v3(0.3, 0.9, 0.3).normalize() },
      { p: v3(29.25, 4.8, 5.25), n: v3(0.2, 0.9, 0.4).normalize() },
      { p: v3(18.0, 3.3, 1.8), n: v3(0.4, 0.9, 0.2).normalize() }
    ]
  },
  med: {
    title: 'Columbus External Bio-Payload',
    anchor: v3(3.0, 1.5, 0.75), // Quest Airlock EVA Egress Hatch on ISS Hull
    anchorNorm: v3(0.8, 0.5, 0.2).normalize(),
    sites: [
      { p: v3(6.75, 2.1, -6.3), n: v3(0.7, 0.6, -0.4).normalize() },
      { p: v3(8.7, 3.0, -4.2), n: v3(0.6, 0.7, -0.4).normalize() },
      { p: v3(5.4, 1.5, -7.8), n: v3(0.8, 0.5, -0.3).normalize() }
    ]
  },
  mis: {
    title: 'Canadarm2 Mobile Base System',
    anchor: v3(0.0, 2.4, 0.75), // Central Truss Guideway Anchor on ISS Hull
    anchorNorm: v3(0, 1, 0.2).normalize(),
    sites: [
      { p: v3(-3.75, 4.5, 2.25), n: v3(0, 0.9, 0.4).normalize() },
      { p: v3(2.25, 5.1, 3.3), n: v3(0.3, 0.9, 0.3).normalize() },
      { p: v3(-6.0, 3.9, 1.2), n: v3(-0.2, 0.9, 0.3).normalize() }
    ]
  }
};

export class EVA {
  constructor({ world, crew, rig, post, hud, assets, director }) {
    Object.assign(this, { world, crew, rig, post, hud, assets, director });
    this.active = false;
    this.view = 'cabin';
    this.busy = false;
    this.pending = null;
    this.activeId = null;
    this.walkers = new Map(); // id -> walker object
    this.onChange = null;
    this._lastView = 'cabin';

    // Exterior manual orbit/pan/zoom camera state (zero auto-rotation)
    this.extTarget = WORLD.issPos.clone();
    this.extDistance = 165;
    this.extYaw = 0.28;
    this.extPitch = -0.06;
    this.extFov = 64;

    this.visorEl = $('eva-visor');
  }

  orbit(dYaw, dPitch) {
    this.extYaw = this.extYaw - dYaw;
    this.extPitch = Math.max(-1.48, Math.min(1.48, this.extPitch - dPitch));
  }

  zoom(delta) {
    const factor = delta > 0 ? 1.10 : 0.90;
    this.extDistance = Math.max(2.5, Math.min(500, this.extDistance * factor));
  }

  pan(dx, dy, camera) {
    if (!camera) return;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const scale = Math.max(0.35, this.extDistance * 0.0034);
    this.extTarget.addScaledVector(right, -dx * scale);
    this.extTarget.addScaledVector(up, dy * scale);
  }

  /**
   * Game-like 6-DoF free flight in exterior space:
   * W/S: Forward / Backward in current look direction
   * A/D: Strafe Left / Right
   * X/Z: Increase / Decrease Height (Altitude)
   */
  moveExterior(dx, dy, dz, dt, camera) {
    if (!camera) return;
    const speed = Math.max(65.0, this.extDistance * 0.55);

    // 1. Forward / Backward (W / S)
    if (dz !== 0) {
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      // dz < 0 is W (forward), dz > 0 is S (backward)
      this.extTarget.addScaledVector(fwd, -dz * speed * dt);
    }

    // 2. Strafe Left / Right (A / D)
    if (dx !== 0) {
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      const right = new THREE.Vector3().crossVectors(fwd, UPW).normalize();
      this.extTarget.addScaledVector(right, dx * speed * dt);
    }

    // 3. Elevation Height Up / Down (X = Up, Z = Down)
    if (dy !== 0) {
      // dy > 0 is X (increase height), dy < 0 is Z (decrease height)
      this.extTarget.y += dy * speed * dt;
    }
  }

  focusOn(pos) {
    if (pos) this.extTarget.copy(pos);
  }

  /* ---------------------------- walker factory ---------------------------- */
  getOrCreateWalker(m) {
    const id = m.c.id;
    if (this.walkers.has(id)) return this.walkers.get(id);

    const src = this.assets.astronaut;
    let obj, animate = null, mixer = null;
    try {
      if (!src) throw new Error('no astronaut model');
      obj = SkeletonUtils.clone(src.scene);
      obj.traverse((n) => {
        if (n.isMesh) {
          n.frustumCulled = false;
          n.castShadow = false;
          (Array.isArray(n.material) ? n.material : [n.material]).forEach((mat) => { mat.envMapIntensity = 0.9; });
        }
      });
      if (src.animations && src.animations.length) {
        mixer = new THREE.AnimationMixer(obj);
        mixer.clipAction(src.animations[0]).play();
        mixer.timeScale = 0.9;
      }
      obj.updateMatrixWorld(true);
    } catch (e) {
      obj = makeAstronaut();
      animate = obj.userData.animate;
      mixer = null;
    }

    const wrap = normalize(obj, { size: SIZE, by: 'max', pivot: 'center', precise: !!(src && !animate) });
    const holder = new THREE.Group();
    holder.add(wrap);

    const el = document.createElement('div');
    el.className = 'tag';
    const tag = new CSS2DObject(el);
    tag.position.set(0, SIZE * 0.62, 0);
    holder.add(tag);

    // Headlamp
    const lamp = new THREE.PointLight(0xfff0d8, 0, 26, 1.5);
    this.world.issSpin.add(lamp);

    // Realistic 64-segment Kevlar safety tether
    const tetherSegs = 64;
    const tetherPts = Array.from({ length: tetherSegs }, () => v3());
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tetherSegs * 3), 3));
    const tether = new THREE.Line(tg, new THREE.LineBasicMaterial({
      color: 0xf5d996,
      transparent: true,
      opacity: 0.95
    }));
    tether.frustumCulled = false;
    this.world.issSpin.add(tether);
    this.world.issSpin.add(holder);

    const taskInfo = EVA_TASKS[id] || EVA_TASKS.plt;
    const wps = taskInfo.sites.map(s => ({ p: s.p.clone(), n: s.n.clone() }));
    const s0 = wps[0];
    const pos = s0.p.clone().addScaledVector(s0.n, SIZE * 1.5);

    const hullAnchor = taskInfo.anchor ? taskInfo.anchor.clone() : v3(1.8, 1.2, 0.5);
    const hullAnchorNorm = taskInfo.anchorNorm ? taskInfo.anchorNorm.clone() : v3(0, 1, 0);

    // Visible structural D-Ring carabiner anchor physically mounted on ISS Hull
    const dRingGeom = new THREE.TorusGeometry(0.25, 0.05, 8, 16);
    const dRingMat = new THREE.MeshStandardMaterial({ color: 0xffb84d, metalness: 0.9, roughness: 0.2 });
    const dRing = new THREE.Mesh(dRingGeom, dRingMat);
    dRing.position.copy(hullAnchor);
    dRing.quaternion.setFromUnitVectors(v3(0, 0, 1), hullAnchorNorm);
    this.world.issSpin.add(dRing);

    // Find astronaut spine / backpack harness node for 100% physically connected tether
    let harnessNode = null;
    holder.traverse((n) => {
      if (n.isBone && (n.name === 'Spine_27_10' || n.name === 'Spine_16_9' || n.name.toLowerCase().includes('spine'))) {
        if (!harnessNode) harnessNode = n;
      }
    });

    const walker = {
      id,
      member: m,
      holder,
      wrap,
      harnessNode,
      tagEl: el,
      tag,
      lamp,
      tether,
      tetherPts,
      tetherSegs,
      hullAnchor,
      hullAnchorNorm,
      dRing,
      wps,
      idx: 0,
      work: 0,
      pos,
      vel: v3(),
      quat: this.frame(s0),
      yaw: 0,
      pitch: 0,
      taskName: taskInfo.title,
      mixer,
      animate
    };

    holder.position.copy(pos);
    holder.quaternion.copy(walker.quat);
    el.innerHTML = `<span class="dot"></span><span>${m.c.call} · ${taskInfo.title}</span>`;

    this.walkers.set(id, walker);
    return walker;
  }

  getActiveWalker() {
    if (this.activeId && this.walkers.has(this.activeId)) {
      return this.walkers.get(this.activeId);
    }
    const first = this.walkers.values().next().value;
    return first || null;
  }

  /* ------------------------------ helpers ------------------------------ */
  fade(fn) {
    if (this.busy) { this.pending = fn; return; }
    this.busy = true;
    const u = this.post.u;
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { this.busy = false; }, 3500);
    gsap.timeline()
      .to(u.uWhite, { value: 1, duration: 0.4, ease: 'power2.in' }, 0)
      .to(u.uBlur, { value: 1, duration: 0.4 }, 0)
      .add(() => {
        try { fn(); } catch (e) {
          console.error(e);
          this.hud.toast('Outside view error: ' + (e && e.message ? e.message : e));
        }
      })
      .to(u.uWhite, { value: 0, duration: 0.8, ease: 'power2.out' })
      .to(u.uBlur, { value: 0, duration: 0.7 }, '<')
      .add(() => {
        u.uWhite.value = 0;
        u.uBlur.value = 0;
        this.busy = false;
        clearTimeout(this._bt);
        if (this.pending) {
          const p = this.pending;
          this.pending = null;
          this.fade(p);
        }
      });
  }

  whenReady(fn) {
    const live = () => this.world.phase === 'cabin' && this.rig.enabled;
    if (live()) { fn(); return; }
    if (this.director && this.world.phase !== 'cabin') {
      this.director.skip();
    }
    let tries = 0;
    clearInterval(this._wr);
    this._wr = setInterval(() => {
      tries++;
      if (live()) { clearInterval(this._wr); fn(); }
      else if (tries > 60) clearInterval(this._wr);
    }, 100);
  }

  camFor(kind) {
    return kind === 'pov' ? this.pov : kind === 'out' ? this.out : kind === 'earth' ? this.earthCam : this.stationCam;
  }

  applyView(kind) {
    this.view = kind;
    this.rig.setExternal(this.camFor(kind));
  }

  /* ------------------------------ actions ------------------------------ */
  show(kind) {
    if (kind === 'cabin') { this.leave(); return; }
    document.body.classList.add('outside');
    if (kind !== 'pov') {
      document.body.classList.remove('helmet');
    }
    this.whenReady(() => {
      // Astronauts ONLY show outside when explicitly deployed via DEPLOY / EVA menu!
      if ((kind === 'out' || kind === 'pov') && !this.hasActiveWalkers()) {
        this.hud.toast('No astronaut deployed outside · Returning inside cabin');
        this.leave();
        return;
      }
      this.fade(() => {
        this.applyView(kind);
        this.hud.toast(LABEL[kind] || 'Outside');
      });
    });
  }

  leave() {
    this.view = 'cabin';
    this.active = this.hasActiveWalkers();
    if (this.rig.mode === 'ext') this.rig.exitFocus();
    document.body.classList.remove('outside', 'helmet');
    if (typeof window !== 'undefined' && typeof window.leaveHelmet === 'function') {
      window.leaveHelmet();
    }
  }

  hasActiveWalkers() {
    for (const w of this.walkers.values()) {
      if (w.member && w.member.out) return true;
    }
    return false;
  }

  sendOut(id, kind = 'out') {
    this.whenReady(() => {
      const m = this.crew.members.find((x) => x.c.id === id);
      if (!m) return;
      this.fade(() => {
        m.out = true;
        this.activeId = id;
        this.active = true;
        this.crew.selected = null;
        this.hud.closePanel();

        const walker = this.getOrCreateWalker(m);
        walker.holder.visible = true;
        walker.tether.visible = true;
        if (walker.dRing) walker.dRing.visible = true;
        walker.lamp.intensity = 55;

        this.applyView(kind);
        this.hud.toast(`${m.c.role} deployed to EVA · Spacewalk Active`);
      });
    });
  }

  bringIn(id = 'all') {
    this.whenReady(() => this.fade(() => {
      if (id && id !== 'all') {
        const walker = this.walkers.get(id);
        if (walker) {
          if (walker.member) walker.member.out = false;
          if (walker.holder) walker.holder.visible = false;
          if (walker.tether) walker.tether.visible = false;
          if (walker.dRing) walker.dRing.visible = false;
          if (walker.lamp) walker.lamp.intensity = 0;
          if (walker.tagEl) {
            walker.tagEl.style.opacity = '0';
            walker.tagEl.style.display = 'none';
          }
          this.hud.toast(`${walker.member ? walker.member.c.role : id} returned inside`);
        }
      } else {
        for (const w of this.walkers.values()) {
          if (w.member) w.member.out = false;
          if (w.holder) w.holder.visible = false;
          if (w.tether) w.tether.visible = false;
          if (w.dRing) w.dRing.visible = false;
          if (w.lamp) w.lamp.intensity = 0;
          if (w.tagEl) {
            w.tagEl.style.opacity = '0';
            w.tagEl.style.display = 'none';
          }
        }
        if (this.crew && this.crew.members) {
          this.crew.members.forEach(m => { m.out = false; });
        }
        this.activeId = null;
        this.hud.toast('All crew returned inside');
      }
      this.active = this.hasActiveWalkers();
      if (!this.active) {
        this.leave();
      }
    }));
  }

  cycleWalker() {
    const list = Array.from(this.walkers.values()).filter(w => w.holder.visible);
    if (!list.length) return false;

    // Find current active index and advance to next
    const curIdx = list.findIndex(w => w.id === this.activeId);
    const nextIdx = (curIdx + 1) % list.length;
    const nextWalker = list[nextIdx];
    this.activeId = nextWalker.id;

    // Shift duty positions for all active spacewalkers
    list.forEach(w => {
      w.idx = (w.idx + 1) % w.wps.length;
      w.work = 0;
    });

    if (this.view === 'pov') {
      this.hud.toast(`Crew Shift · Helmet POV: ${nextWalker.member.c.role} (${nextWalker.taskName})`);
    } else {
      const targetPos = nextWalker.pos.clone().applyMatrix4(this.world.issSpin.matrixWorld);
      this.extTarget.copy(targetPos);
      this.hud.toast(`Crew Shift · Active Focus: ${nextWalker.member.c.role} (${nextWalker.taskName})`);
    }
    return true;
  }

  /* ------------------------- manual controls ------------------------- */
  dragLook(dx, dy) {
    const w = this.getActiveWalker();
    if (w) {
      w.yaw = w.yaw - dx * 0.005;
      w.pitch = Math.max(-1.35, Math.min(1.35, w.pitch - dy * 0.004));
    }
    if (this.view === 'out') {
      this.orbit(dx * 0.005, dy * 0.004);
    }
  }

  rotate(dYaw, dPitch, dt) {
    const w = this.getActiveWalker();
    if (w) {
      w.yaw = w.yaw + dYaw * 2.2 * dt;
      w.pitch = Math.max(-1.45, Math.min(1.45, w.pitch + dPitch * 2.0 * dt));
    }
    if (this.view === 'out' || this.view === 'station' || this.view === 'earth') {
      this.orbit(dYaw * 2.2 * dt, dPitch * 2.0 * dt);
    }
  }

  move(dx, dy, dz, dt, camera) {
    const w = this.getActiveWalker();
    if (!w) return;
    const speed = 34.0; // Responsive agile EVA propulsion
    if (camera && (dx !== 0 || dz !== 0)) {
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() > 0.001) fwd.normalize();
      else fwd.set(0, 0, -1);
      const rgt = new THREE.Vector3().crossVectors(fwd, UPW).normalize();
      const moveVec = new THREE.Vector3()
        .addScaledVector(fwd, -dz)
        .addScaledVector(rgt, dx);
      if (moveVec.lengthSq() > 0.001) {
        moveVec.normalize().multiplyScalar(speed * dt);
        w.pos.add(moveVec);
        w.vel.copy(moveVec).divideScalar(dt * 2.0);
      }
    } else if (dx !== 0 || dz !== 0) {
      w.pos.x += dx * speed * dt;
      w.pos.z += dz * speed * dt;
    }
    if (dy !== 0) {
      w.pos.y += dy * 24.0 * dt;
      w.vel.y = dy * 3.5;
    }
    w.pos.x = THREE.MathUtils.clamp(w.pos.x, -220, 220);
    w.pos.y = THREE.MathUtils.clamp(w.pos.y, -120, 140);
    w.pos.z = THREE.MathUtils.clamp(w.pos.z, -220, 220);
    w.holder.position.copy(w.pos);
  }

  hide() {
    for (const w of this.walkers.values()) {
      w.member.out = false;
      w.holder.visible = false;
      w.tether.visible = false;
      w.lamp.intensity = 0;
    }
    this.active = false;
    this.visorEl.classList.remove('on');
  }

  reset() {
    this.hide();
    this.view = 'cabin';
    this.busy = false;
    this.pending = null;
  }

  frame(s) {
    const F = s.n.clone().negate();
    let U = UPW.clone().addScaledVector(s.n, -UPW.dot(s.n));
    if (U.lengthSq() < 0.05) U = v3(1, 0, 0).addScaledVector(s.n, -s.n.x);
    U.normalize();
    const X = U.clone().cross(F).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, U, F));
  }

  /* ------------------------------- cameras ------------------------------- */
  pov = () => {
    const w = this.getActiveWalker();
    if (!w) return this.stationCam();
    const h = w.holder;
    h.updateWorldMatrix(true, true);
    const q = h.getWorldQuaternion(new THREE.Quaternion());
    const eye = v3(0, SIZE * 0.35, SIZE * 0.18).applyMatrix4(h.matrixWorld);
    const forward = v3(0, 0, 1).applyQuaternion(q);
    const U = v3(0, 1, 0).applyQuaternion(q);
    return { eye, look: eye.clone().addScaledVector(forward, 25), up: U, fov: 82 };
  };

  out = () => {
    const w = this.getActiveWalker();
    if (!w) return this.stationCam();
    const h = w.holder;
    h.updateWorldMatrix(true, true);
    const p = h.getWorldPosition(v3());
    const cp = Math.cos(this.extPitch), sp = Math.sin(this.extPitch);
    const cy = Math.cos(this.extYaw), sy = Math.sin(this.extYaw);
    const d = Math.max(1.8, Math.min(180, this.extDistance * 0.28));
    const eye = v3(
      p.x + d * cp * sy,
      p.y + d * sp + 1.2,
      p.z + d * cp * cy
    );
    return { eye, look: p.clone(), up: UPW, fov: 52 };
  };

  stationCam = () => {
    const cp = Math.cos(this.extPitch), sp = Math.sin(this.extPitch);
    const cy = Math.cos(this.extYaw), sy = Math.sin(this.extYaw);
    const d = this.extDistance;
    const eye = v3(
      this.extTarget.x + d * cp * sy,
      this.extTarget.y + d * sp,
      this.extTarget.z + d * cp * cy
    );
    return { eye, look: this.extTarget.clone(), up: UPW, fov: this.extFov };
  };

  earthCam = () => {
    const cp = Math.cos(this.extPitch), sp = Math.sin(this.extPitch);
    const cy = Math.cos(this.extYaw), sy = Math.sin(this.extYaw);
    const d = this.extDistance * 1.15;
    const eye = v3(
      this.extTarget.x + d * cp * sy,
      this.extTarget.y + d * sp + 18,
      this.extTarget.z + d * cp * cy
    );
    return { eye, look: this.extTarget.clone().add(v3(0, -18, -10)), up: UPW, fov: 56 };
  };

  /* -------------------------------- loop -------------------------------- */
  update(dt, t) {
    if (this.rig.mode !== 'ext' && this.view !== 'cabin') this.view = 'cabin';
    if (this.view !== this._lastView) {
      this._lastView = this.view;
      if (this.onChange) this.onChange(this.view);
    }
    const hasActive = this.hasActiveWalkers();
    this.visorEl.classList.toggle('on', hasActive && this.view === 'pov');

    if (!hasActive) {
      for (const walker of this.walkers.values()) {
        if (walker.holder) walker.holder.visible = false;
        if (walker.tether) walker.tether.visible = false;
        if (walker.lamp) walker.lamp.intensity = 0;
        if (walker.tagEl) {
          walker.tagEl.style.opacity = '0';
          walker.tagEl.style.display = 'none';
        }
      }
      return;
    }

    const activeWalker = this.getActiveWalker();
    const isPov = hasActive && this.view === 'pov';

    // Animate every deployed astronaut independently outside the ISS
    for (const walker of this.walkers.values()) {
      if (!walker.member || !walker.member.out) {
        if (walker.holder) walker.holder.visible = false;
        if (walker.tether) walker.tether.visible = false;
        if (walker.lamp) walker.lamp.intensity = 0;
        if (walker.tagEl) {
          walker.tagEl.style.opacity = '0';
          walker.tagEl.style.display = 'none';
        }
        continue;
      }

      const isCurrentPov = isPov && (walker === activeWalker);

      walker.holder.visible = true;
      // In first-person helmet POV, hide the astronaut's own suit mesh so it never clips into their visor camera
      if (walker.wrap) {
        walker.wrap.visible = !isCurrentPov;
      }
      walker.tether.visible = true;
      walker.lamp.intensity = 55;

      const h = walker.holder;

      const isControlled = (walker === activeWalker) && (isPov || this.view === 'out');

      if (isControlled) {
        // Active spacewalker: Smooth zero-g drift with inertia, player in full control
        walker.vel.multiplyScalar(Math.exp(-1.4 * dt));
        walker.pos.addScaledVector(walker.vel, dt);
        h.position.copy(walker.pos);

        // Orient astronaut holder matching player's pitch and yaw
        const userQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(walker.pitch || 0, walker.yaw || 0, 0, 'YXZ')
        );
        h.quaternion.copy(userQuat);
      } else {
        const s = walker.wps[walker.idx];
        const stand = s.p.clone().addScaledVector(s.n, SIZE * 0.52);
        const dVec = stand.clone().sub(walker.pos);
        const dist = dVec.length();
        const want = dist > 0.5 ? dVec.normalize().multiplyScalar(Math.min(2.4, dist * 0.6)) : v3();
        walker.vel.lerp(want, 1 - Math.exp(-1.4 * dt));
        walker.pos.addScaledVector(walker.vel, dt);

        // Perform realistic work at inspection station, then rotate to next work site
        if (dist < 0.8) {
          walker.work += dt;
          if (walker.work > 10) {
            walker.idx = (walker.idx + 1) % walker.wps.length;
            walker.work = 0;
          }
        }
        walker.quat.slerp(this.frame(s), 1 - Math.exp(-1.6 * dt));

        const wob = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          Math.sin(t * 0.7 + (walker.idx || 0)) * 0.05,
          Math.sin(t * 0.5 + 1) * 0.06,
          Math.sin(t * 0.4) * 0.04
        ));
        h.quaternion.copy(walker.quat).multiply(wob);
        h.position.copy(walker.pos)
          .addScaledVector(s.n, Math.sin(t * 0.8) * 0.15)
          .addScaledVector(v3(Math.sin(t * 0.6), Math.cos(t * 0.5), 0), 0.1);
      }

      if (walker.mixer) walker.mixer.update(dt);
      if (walker.animate) walker.animate(t);
      const shouldShowTag = walker.member.out && !isCurrentPov && (this.view === 'station' || this.view === 'out');
      walker.tagEl.style.opacity = shouldShowTag ? '1' : '0';
      walker.tagEl.style.display = shouldShowTag ? '' : 'none';

      // Headlamp lighting the work area
      const F = v3(0, 0, 1).applyQuaternion(h.quaternion);
      walker.lamp.position.copy(h.position)
        .addScaledVector(F, SIZE * 0.45)
        .addScaledVector(v3(0, 1, 0).applyQuaternion(h.quaternion), SIZE * 0.3);

      // Multi-segment realistic tether with catenary sag & microgravity waves
      // End A: Rigidly bolted to the ISS hull D-ring
      const a = walker.hullAnchor ? walker.hullAnchor.clone() : walker.wps[0].p.clone().addScaledVector(walker.wps[0].n, 0.4);

      // End B: 100% physically connected to the astronaut's life-support backpack harness
      const b = new THREE.Vector3();
      if (walker.harnessNode) {
        walker.harnessNode.getWorldPosition(b);
        this.world.issSpin.worldToLocal(b);
      } else {
        b.copy(h.position);
      }

      const ab = b.clone().sub(a);
      const tetherDist = ab.length();
      const dir = ab.clone().normalize();

      let perp1 = v3(0, 1, 0).cross(dir);
      if (perp1.lengthSq() < 0.01) perp1 = v3(1, 0, 0).cross(dir);
      perp1.normalize();
      const perp2 = dir.clone().cross(perp1).normalize();

      const sagMagnitude = Math.min(tetherDist * 0.22, 6.0);
      const nPts = walker.tetherSegs;
      const hullNorm = walker.hullAnchorNorm ? walker.hullAnchorNorm.clone() : walker.wps[0].n.clone();

      for (let i = 0; i < nPts; i++) {
        const u = i / (nPts - 1);
        const envelope = Math.sin(u * Math.PI);
        const basePt = a.clone().lerp(b, u);
        const sagVec = hullNorm.clone().multiplyScalar(0.5).add(v3(0, -0.85, 0)).normalize().multiplyScalar(sagMagnitude * envelope);
        const waveA = Math.sin(u * Math.PI * 2.8 + t * 0.75 + walker.idx) * (0.45 * envelope);
        const waveB = Math.cos(u * Math.PI * 3.4 - t * 0.6) * (0.35 * envelope);

        basePt.add(sagVec).addScaledVector(perp1, waveA).addScaledVector(perp2, waveB);
        walker.tetherPts[i].copy(basePt);
      }
      const arr = walker.tether.geometry.attributes.position;
      walker.tetherPts.forEach((p, i) => arr.setXYZ(i, p.x, p.y, p.z));
      arr.needsUpdate = true;
    }
  }
}
