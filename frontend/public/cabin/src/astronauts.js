import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { CONFIG, CABIN } from './config.js';
import { crew, vitals } from './data.js';
import { normalize, rand } from './util.js';
import { makeAstronaut } from './procedural.js';

const tmp = new THREE.Vector3();

export class Crew {
  constructor(scene, assets, camera) {
    this.scene = scene; this.camera = camera; this.group = new THREE.Group(); scene.add(this.group);
    this.members = []; this.hover = null; this.selected = null; this.dragging = null;
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    const src = assets.astronaut;
    crew.forEach((c, i) => this.members.push(this.make(c, i, src)));
  }

  make(c, i, src) {
    const holder = new THREE.Group();
    let mixer = null, animate = null, obj;
    if (src) {
      obj = SkeletonUtils.clone(src.scene);
      obj.traverse((n) => { if (n.isMesh) { n.frustumCulled = false; n.castShadow = true; n.receiveShadow = true; (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => { m.envMapIntensity = 0.7; }); } });
      if (src.animations && src.animations.length) {
        mixer = new THREE.AnimationMixer(obj);
        const a = mixer.clipAction(src.animations[0]); a.play(); a.time = Math.random() * src.animations[0].duration; mixer.timeScale = rand(0.8, 1.1);
        mixer.update(0);
      }
      obj.updateMatrixWorld(true);
    } else {
      obj = makeAstronaut(); animate = obj.userData.animate;
    }
    const wrap = normalize(obj, { size: CONFIG.crewScale, by: 'max', pivot: 'center', precise: !!src });
    holder.add(wrap);

    // soft red alert ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(CONFIG.crewScale * 0.5, 0.09, 10, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.25, 0.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.visible = c.off; this.group.add(ring);
    const light = new THREE.PointLight(0xff3350, 0, 16, 1.8); this.group.add(light);

    // Cyan holographic manual control targeting ring
    const selRing = new THREE.Mesh(
      new THREE.RingGeometry(CONFIG.crewScale * 0.48, CONFIG.crewScale * 0.56, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.0), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    selRing.rotation.x = Math.PI / 2; selRing.visible = false; this.group.add(selRing);

    // hit proxy for picking
    const hit = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.crewScale * 0.5, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.crewId = c.id; this.group.add(hit);

    // in-world tag
    const el = document.createElement('div'); el.className = 'tag' + (c.off ? ' off' : '');
    el.innerHTML = `<span class="dot"></span><span>${c.role}</span><i><em>♥</em><span class="hr">${c.hrNow}</span></i>`;
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';
    const anchor = new THREE.Object3D(); const tag = new CSS2DObject(el); anchor.add(tag); this.group.add(anchor);

    this.group.add(holder);
    const m = {
      c, holder, wrap, mixer, animate, ring, light, selRing, hit, el, anchor, tag, hrEl: el.querySelector('.hr'),
      pos: c.pos.clone(), vel: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(CONFIG.crewDrift),
      drift: new THREE.Vector3(rand(-1, 1), rand(-0.6, 0.6), rand(-1, 1)).normalize().multiplyScalar(CONFIG.crewDrift * 0.5),
      seed: i * 1.7 + 0.3, yaw: c.yaw, spin: rand(-0.05, 0.05), flip: c.flip, tweenActive: false,
    };
    holder.position.copy(m.pos);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.select(m);
      window.hud?.openPanel?.(m);
      window.HELIOS?.rig?.focusCrew?.(m);
      window.audio?.playChirp?.();
    });
    return m;
  }

  select(m) {
    this.selected = m;
    this.members.forEach((x) => {
      if (x.selRing) x.selRing.visible = (x === m && !x.out && x !== this.firstPersonM);
    });
    if (m && typeof window !== 'undefined' && window.updateInstructionHud) {
      window.updateInstructionHud(true);
    } else {
      const hud = document.getElementById('astro-control-hud');
      const name = document.getElementById('ach-name');
      if (hud && name) {
        if (m) {
          name.textContent = `${m.c.call} · ${m.c.role.toUpperCase()}`;
          hud.classList.remove('hidden');
        } else {
          hud.classList.add('hidden');
        }
      }
    }
  }

  moveAstronaut(target, dx, dy, dz, dt, camera) {
    const m = target || this.firstPersonM || this.selected || this.dragging || this.members[0];
    if (!m || m.out) return;
    m.tweenActive = false;
    const speed = 28.0;

    if (camera && (dx !== 0 || dz !== 0)) {
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() > 0.001) fwd.normalize();
      else fwd.set(0, 0, -1);
      const rgt = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

      const move = new THREE.Vector3()
        .addScaledVector(fwd, -dz) // dz < 0 is forward (W), dz > 0 is backward (S)
        .addScaledVector(rgt, dx);  // dx < 0 is left (A), dx > 0 is right (D)
      if (move.lengthSq() > 0.001) {
        move.normalize().multiplyScalar(speed * dt);
        m.pos.add(move);
        m.vel.copy(move).multiplyScalar(1.2);
      }
    } else if (dx !== 0 || dz !== 0) {
      m.pos.x += dx * speed * dt;
      m.pos.z += dz * speed * dt;
      m.vel.set(dx * 2.5, m.vel.y, dz * 2.5);
    }

    // Height adjustment (Z/Space increases height / altitude (+Y), X/Shift decreases height (-Y))
    if (dy !== 0) {
      m.pos.y += dy * speed * dt;
      m.vel.y = dy * 2.5;
    }

    this.clamp(m.pos);
    m.holder.position.copy(m.pos);
    if (m.selRing) m.selRing.position.copy(m.pos);
    if (m.ring) m.ring.position.copy(m.pos);
    if (m.hit) m.hit.position.copy(m.pos);
  }

  moveSelected(dx, dy, dz, dt, camera) {
    this.moveAstronaut(this.selected, dx, dy, dz, dt, camera);
  }

  rotateAstronaut(target, dYaw, dPitch, dt) {
    const m = target || this.firstPersonM || this.selected || this.dragging || this.members[0];
    if (!m || m.out) return;
    const rotSpeed = 2.4; // rad/s (~138 deg/s)
    if (dYaw !== 0) {
      m.yaw = (m.yaw + dYaw * rotSpeed * dt) % (Math.PI * 2);
      m.holder.rotation.y = m.yaw;
    }
    if (dPitch !== 0) {
      m.pitch = Math.max(-1.3, Math.min(1.3, (m.pitch || 0) + dPitch * rotSpeed * dt));
      m.holder.rotation.x = m.pitch;
    }
    if (m.selRing) m.selRing.rotation.y = m.yaw;
    if (m.ring) m.ring.rotation.y = m.yaw;
  }

  adjustHeight(m, deltaY) {
    const target = m || this.firstPersonM || this.selected || this.dragging || this.members[0];
    if (!target || target.out) return;
    target.pos.y += deltaY;
    target.vel.y = deltaY * 2.0;
    this.clamp(target.pos);
    target.holder.position.copy(target.pos);
    if (target.selRing) target.selRing.position.copy(target.pos);
    if (target.ring) target.ring.position.copy(target.pos);
    if (target.hit) target.hit.position.copy(target.pos);
  }

  setFirstPerson(targetM) {
    this.firstPersonM = targetM;
    this.members.forEach((m) => {
      const isFP = (m === targetM);
      m.holder.visible = !isFP && !m.out;
      m.tag.visible = !isFP && !m.out;
      if (m.ring) m.ring.visible = !isFP && !m.out && m.c.off;
    });
  }

  /* --------------------------- pointer picking --------------------------- */
  pick(clientX, clientY, dom) {
    const r = dom.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (!this.group.visible) return null;
    const candidates = this.members.filter((m) => !m.out);
    const hitProxies = candidates.map((m) => m.hit);
    let hits = this.ray.intersectObjects(hitProxies, false);
    if (hits.length) return candidates.find((m) => m.hit === hits[0].object);
    const holders = candidates.map((m) => m.holder);
    hits = this.ray.intersectObjects(holders, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj) {
        const found = candidates.find((m) => m.holder === obj);
        if (found) return found;
        obj = obj.parent;
      }
    }
    return null;
  }
  setHover(m) { if (this.hover === m) return; if (this.hover) this.hover.el.classList.remove('hover'); this.hover = m; if (m) m.el.classList.add('hover'); }

  startDrag(m) { this.dragging = m; m.vel.set(0, 0, 0); m.dragTarget = m.pos.clone(); m.samples = []; }
  dragTo(clientX, clientY, dom) {
    const m = this.dragging; if (!m) return;
    const r = dom.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const n = this.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, m.pos);
    if (this.ray.ray.intersectPlane(plane, tmp)) m.dragTarget.copy(tmp);
    this.clamp(m.dragTarget);
  }
  endDrag() {
    const m = this.dragging; if (!m) return;
    const s = m.samples; let v = new THREE.Vector3();
    if (s && s.length > 2) { const a = s[0], b = s[s.length - 1], dt = Math.max(0.03, b.t - a.t); v.copy(b.p).sub(a.p).divideScalar(dt); }
    v.multiplyScalar(CONFIG.dragThrow * 0.25); if (v.length() > 6) v.setLength(6);
    m.vel.copy(v); this.dragging = null;
  }
  clamp(p) { const b = CABIN.bounds; p.x = THREE.MathUtils.clamp(p.x, b.min.x, b.max.x); p.y = THREE.MathUtils.clamp(p.y, b.min.y, b.max.y); p.z = THREE.MathUtils.clamp(p.z, b.min.z, b.max.z); return p; }

  shuffle() {
    const b = CABIN.bounds;
    this.members.forEach((m, i) => {
      const to = { x: rand(b.min.x, b.max.x), y: rand(b.min.y + 1, b.max.y - 1), z: rand(b.min.z, b.max.z) };
      m.vel.set(0, 0, 0); m.tweenActive = true;
      gsap.to(m.pos, { ...to, duration: 2.4, delay: i * 0.08, ease: 'power2.inOut', onComplete: () => { m.tweenActive = false; m.vel.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(CONFIG.crewDrift); } });
    });
  }

  /* ------------------------------- update ------------------------------- */
  update(dt, t, visible) {
    this.group.visible = visible; this.members.forEach((m) => { m.tag.visible = visible; }); if (!visible) return;
    this.members.forEach((m) => {
      if (m.out) { m.holder.visible = false; m.ring.visible = false; m.light.intensity = 0; m.tag.visible = false; return; }
      if (m === this.firstPersonM) {
        m.holder.visible = false;
        m.ring.visible = false;
        m.light.intensity = 0;
        m.tag.visible = false;
        const s = m.seed;
        m.holder.position.set(m.pos.x + Math.sin(t * 0.37 + s) * 0.25, m.pos.y + Math.sin(t * 0.61 + s * 2) * 0.4, m.pos.z + Math.cos(t * 0.29 + s) * 0.25);
        m.yaw += m.spin * dt;
        m.holder.rotation.set((m.flip ? Math.PI : 0) + Math.sin(t * 0.23 + s) * 0.28, m.yaw, Math.sin(t * 0.19 + s * 1.6) * 0.32, 'YXZ');
        return;
      }
      m.holder.visible = true; m.tag.visible = true;
      if (m === this.dragging) {
        m.pos.lerp(m.dragTarget, 1 - Math.exp(-14 * dt));
        m.samples.push({ p: m.pos.clone(), t }); if (m.samples.length > 7) m.samples.shift();
      } else if (!m.tweenActive) {
        m.vel.lerp(m.drift, 1 - Math.exp(-0.45 * dt));
        m.pos.addScaledVector(m.vel, dt);
        const b = CABIN.bounds;
        ['x', 'y', 'z'].forEach((k) => { if (m.pos[k] < b.min[k]) { m.pos[k] = b.min[k]; m.vel[k] = Math.abs(m.vel[k]); m.drift[k] = Math.abs(m.drift[k]); } else if (m.pos[k] > b.max[k]) { m.pos[k] = b.max[k]; m.vel[k] = -Math.abs(m.vel[k]); m.drift[k] = -Math.abs(m.drift[k]); } });
      }
      // visual float
      const s = m.seed;
      m.holder.position.set(m.pos.x + Math.sin(t * 0.37 + s) * 0.25, m.pos.y + Math.sin(t * 0.61 + s * 2) * 0.4, m.pos.z + Math.cos(t * 0.29 + s) * 0.25);
      if (m === this.selected) m.spin = 0;
      m.yaw += m.spin * dt;
      m.holder.rotation.set((m.flip ? Math.PI : 0) + (m.pitch || 0) + Math.sin(t * 0.23 + s) * 0.28, m.yaw, Math.sin(t * 0.19 + s * 1.6) * 0.32, 'YXZ');
      if (m.mixer) m.mixer.update(dt); if (m.animate) m.animate(t + s);

      m.anchor.position.copy(m.holder.position).y += CONFIG.crewScale * 0.62;
      m.hit.position.copy(m.holder.position);
      const hasAlarm = Boolean(m.c.off && ((vitals.scenario && vitals.scenario !== 'NOMINAL_CRUISE') || (vitals.alerts && vitals.alerts.length > 0)));
      if (hasAlarm && this.firstPersonM !== m) {
        const k = 0.5 + 0.5 * Math.sin(t * 3.14);
        m.ring.visible = !m.out;
        m.ring.position.copy(m.holder.position);
        m.ring.scale.setScalar(1 + k * 0.15);
        m.ring.material.opacity = 0.3 + k * 0.4;
        m.light.position.copy(m.holder.position);
        m.light.intensity = 2 + k * 4;
      } else {
        m.ring.visible = false;
        m.light.intensity = 0;
      }
      if (m.selRing && m.selRing.visible) {
        m.selRing.position.copy(m.holder.position);
        m.selRing.rotation.z = t * 1.5;
        const pulse = 1 + 0.12 * Math.sin(t * 6);
        m.selRing.scale.set(pulse, pulse, pulse);
      }
      const d = this.camera.position.distanceTo(m.holder.position);
      m.el.style.opacity = String(THREE.MathUtils.clamp(1.25 - d / 48, 0, 1));
    });
  }

  refreshTags() { this.members.forEach((m) => { m.hrEl.textContent = m.c.hrNow; }); }
}
