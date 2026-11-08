import * as THREE from 'three';
import gsap from 'gsap';
import { INTRO, WORLD, STOPS } from './config.js';
import { $ } from './util.js';

// Pre-allocated reusable vectors for garbage-free 60fps intro animation
const _vCamIss = new THREE.Vector3();
const _vLookIss = new THREE.Vector3();
const _vRel = new THREE.Vector3();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vWorldLook = new THREE.Vector3();

export class Director {
  constructor({ camera, world, rig, post, hud, audio }) {
    Object.assign(this, { camera, world, rig, post, hud, audio });
    this.state = 'idle'; this.p = 0; this.q = 0; this.tl = null;
    const c = WORLD.issPos;
    this.curve = new THREE.CatmullRomCurve3([INTRO.start, INTRO.mid, INTRO.end].map((o) => c.clone().add(o)), false, 'centripetal');
    this.body = document.body;
  }

  typeText(str) {
    const el = $('intro-text'); el.textContent = ''; let i = 0; clearInterval(this._ty);
    this._ty = setInterval(() => { el.textContent = str.slice(0, ++i); if (i >= str.length) clearInterval(this._ty); }, 70);
  }

  kill() { if (this.tl) { this.tl.kill(); this.tl = null; } gsap.killTweensOf(this.post.u.uWhite); gsap.killTweensOf(this.post.u.uBlur); }

  /** Phase 1 → 2 → 3 */
  play() {
    this.kill(); const { post, world, rig } = this;
    this.body.classList.add('intro', 'show-intro'); this.hud.closePanel(); rig.enabled = false; rig.exitFocus(); rig.setProgress(0);
    world.setPhase('intro'); this.state = 'intro'; this.p = 0; this._introStage = 0;
    if (world && world.dragonCrew) world.dragonCrew.visible = true;
    post.u.uWhite.value = 0; post.u.uBlur.value = 0;
    this.typeText('EXPEDITION 71 // CREW DRAGON RENDEZVOUS // APPROACHING THE STATION');
    this.audio.playIntroAtmosphere();
    this.audio.whoosh(2.4);
    const D = INTRO.duration;
    this.tl = gsap.timeline();
    this.tl.to(this, { p: 1, duration: D, ease: 'power1.inOut' }, 0)
      .add(() => this.corridor(), D);
  }

  corridor() {
    const { world, post, rig } = this;
    rig.enabled = false;
    rig.exitFocus();
    world.setPhase('corridor');
    this.state = 'corridor';
    this.q = 0;
    this.body.classList.remove('show-intro');
    this.audio.whoosh(2.6);
    this.camera.fov = 62; // Authentic natural human eye FOV (zero fish-eye edge distortion)
    this.camera.updateProjectionMatrix();

    // Absolute ZERO screen flash! Clear, illuminated view of the 3D spaceship model interior
    gsap.killTweensOf(post.u.uWhite);
    gsap.killTweensOf(post.u.uBlur);
    post.u.uWhite.value = 0;
    post.u.uBlur.value = 0;

    const T = 3.2; // Smooth, cinematic zero-g float through the corridor
    this.typeText('INTER-MODULE AIRLOCK // PMA-2 TO NODE 2 // HATCH EQUALIZED');
    this.tl = gsap.timeline();
    this.tl.to(this, { q: 1, duration: T, ease: 'power1.inOut' }, 0)
      .add(() => this.cabin(0), T);
  }

  cabin(targetStopIndex = 0) {
    this.audio.stopIntroAtmosphere(1.5);
    const { world, post, rig, camera } = this;
    world.setPhase('cabin');
    this.state = 'cabin';
    gsap.killTweensOf(post.u.uWhite);
    gsap.killTweensOf(post.u.uBlur);
    post.u.uWhite.value = 0;
    post.u.uBlur.value = 0;
    if (world && world.dragonCrew) world.dragonCrew.visible = false;
    if (world && world.dragonGroup) {
      world.dragonGroup.position.set(-0.075, -3.034, 17.11);
      world.dragonGroup.rotation.set(0, 0, 0);
      if (world.dragonNose) {
        world.dragonNose.rotation.set(-Math.PI / 2, -0.85, 0);
        world.dragonNose.position.set(-0.0266, 1.0173 - 0.15, 0.034 + 0.10);
      }
      if (world.dragonNdsGroup) {
        world.dragonNdsGroup.visible = true;
        world.dragonNdsGroup.position.set(0, 0, 0.02);
      }
      if (world.dragonDockSpot) world.dragonDockSpot.intensity = 3.5;
      if (world.rcsMat) world.rcsMat.opacity = 0;
      if (world.dockLed) { world.dockLed.color.setHex(0x22c55e); world.dockLed.intensity = 2.8; }
      if (world.dockLedMesh) world.dockLedMesh.material.color.setHex(0x22c55e);
      if (world.dockCrosshairs) world.dockCrosshairs.forEach(ch => ch.material.color.setHex(0x22c55e));
    }
    const safeIdx = Math.max(0, Math.min(targetStopIndex, STOPS.length - 1));
    rig.exitFocus();
    rig.mode = safeIdx === 0 ? 'crew' : 'tour';
    const s = STOPS[safeIdx];
    rig.eye.copy(s.pos);
    rig.lookAt.copy(s.look);
    rig.fov = s.fov;
    camera.fov = s.fov;
    camera.position.copy(s.pos);
    camera.lookAt(s.look);
    camera.updateProjectionMatrix();
    rig.snapNext = true;
    rig.activeIndex = safeIdx;
    this.hud.setStop(safeIdx, true);
    rig.setProgress(safeIdx / (STOPS.length - 1));
    rig.enabled = true;
    this.body.classList.remove('intro', 'show-intro', 'outside', 'ext-mode');
    if (safeIdx !== 0) {
      this.body.classList.remove('helmet');
    }
    gsap.killTweensOf(post.u.uWhite);
    gsap.killTweensOf(post.u.uBlur);
    post.u.uWhite.value = 0;
    post.u.uBlur.value = 0;
    if (this.onCabin) {
      this.onCabin(safeIdx);
    }
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'HELIOS_CABIN_ARRIVED', stopIndex: safeIdx }, '*');
    }
  }

  skip(targetStopIndex = 0) {
    this.kill(); this.audio.stopIntroAtmosphere(0.6); const { post } = this; this.state = 'skipping';
    if (this.world && this.world.dragonCrew) this.world.dragonCrew.visible = false;
    if (this.world && this.world.dragonGroup) {
      this.world.dragonGroup.position.set(-0.075, -3.034, 17.11);
      this.world.dragonGroup.rotation.set(0, 0, 0);
      if (this.world.dragonNose) {
        this.world.dragonNose.rotation.set(-Math.PI / 2, -0.85, 0);
        this.world.dragonNose.position.set(-0.0266, 1.0173 - 0.15, 0.034 + 0.10);
      }
      if (this.world.dragonNdsGroup) this.world.dragonNdsGroup.visible = true;
      if (this.world.dragonDockSpot) this.world.dragonDockSpot.intensity = 3.5;
      if (this.world.rcsMat) this.world.rcsMat.opacity = 0;
      if (this.world.dockLed) { this.world.dockLed.color.setHex(0x22c55e); this.world.dockLed.intensity = 2.5; }
      if (this.world.dockLedMesh) { this.world.dockLedMesh.material.color.setHex(0x22c55e); }
      if (this.world.dockCrosshairs) { this.world.dockCrosshairs.forEach(ch => ch.material.color.setHex(0x22c55e)); }
    }
    gsap.killTweensOf(post.u.uWhite);
    gsap.killTweensOf(post.u.uBlur);
    post.u.uWhite.value = 0;
    post.u.uBlur.value = 0;
    this.cabin(targetStopIndex);
    this.audio.whoosh(1.0);
  }

  update() {
    const cam = this.camera;
    if (this.state === 'intro') {
      const p = this.p, c = WORLD.issPos;

      // 1. Seamless SpaceX Crew Dragon approach & docking animation
      if (this.world && this.world.dragonGroup) {
        const dg = this.world.dragonGroup;
        if (p < 0.74) {
          const tApproach = p / 0.74;
          const ease = Math.pow(1 - tApproach, 2.0);
          const dist = ease * 80;
          const offsetX = Math.sin((1 - tApproach) * Math.PI) * 2.8;
          const offsetY = Math.sin((1 - tApproach) * Math.PI) * 1.2;
          dg.position.set(-0.075 + offsetX, -3.034 + offsetY, 17.11 + dist);
          dg.rotation.set(
            Math.sin(p * 18) * 0.012 * ease,
            Math.cos(p * 14) * 0.015 * ease,
            Math.sin(p * 12) * 0.010 * ease
          );
          if (p > 0.08 && p < 0.65 && this.world.rcsMat) {
            const pulse = (Math.sin(p * 35) + 1) * 0.5;
            this.world.rcsMat.opacity = pulse > 0.45 ? 0.8 : 0.0;
          } else if (this.world.rcsMat) {
            this.world.rcsMat.opacity = 0.0;
          }
          if (this.world.dockLed) {
            const amberPulse = (Math.sin(p * 25) + 1) * 0.5;
            this.world.dockLed.color.setHex(0xf59e0b);
            this.world.dockLed.intensity = 1.2 + amberPulse * 1.8;
          }
        } else {
          dg.position.set(-0.075, -3.034, 17.11);
          dg.rotation.set(0, 0, 0);
          if (this.world.rcsMat) this.world.rcsMat.opacity = 0.0;
          if (this.world.dockLed) {
            this.world.dockLed.color.setHex(0x22c55e);
            this.world.dockLed.intensity = 2.8;
          }
          if (this.world.dockLedMesh) {
            this.world.dockLedMesh.material.color.setHex(0x22c55e);
          }
          if (this.world.dockCrosshairs) {
            this.world.dockCrosshairs.forEach(ch => ch.material.color.setHex(0x22c55e));
          }
        }

        // 2. Nose Cone Deployment & NASA Docking System Reveal
        if (this.world.dragonNose) {
          if (p < 0.42) {
            this.world.dragonNose.rotation.set(-Math.PI / 2, 0, 0);
            this.world.dragonNose.position.set(-0.0266, 1.0173, 0.034);
            if (this.world.dragonDockSpot) this.world.dragonDockSpot.intensity = 0;
            if (this.world.dragonNdsGroup) this.world.dragonNdsGroup.visible = false;
          } else {
            const tNose = Math.min(1.0, (p - 0.42) / 0.16);
            const easeNose = tNose * tNose * (3 - 2 * tNose);
            this.world.dragonNose.rotation.set(-Math.PI / 2, -0.85 * easeNose, 0);
            this.world.dragonNose.position.set(-0.0266, 1.0173 - 0.15 * easeNose, 0.034 + 0.10 * easeNose);
            if (this.world.dragonDockSpot) this.world.dragonDockSpot.intensity = 3.5 * easeNose;
            if (this.world.dragonNdsGroup) {
              this.world.dragonNdsGroup.visible = true;
              this.world.dragonNdsGroup.position.set(0, 0, 0.02);
            }
          }
        }

        // 3. Dynamic Multi-Chapter Cinematography (zero GC allocation)
        const dPos = dg.position;
        let fov = 44;

        if (p <= 0.22) {
          // Chapter 1: Starts from kinda far as previous intro, then swoops inward towards Dragon
          const u = p / 0.22;
          const easeU = u * u * (3 - 2 * u);
          _vA.set(145, 80, 270);
          _vB.copy(dPos).add(_vRel.set(-6.8, 2.8, 6.5));
          _vCamIss.lerpVectors(_vA, _vB, easeU);

          _vA.set(0, -3.03, 45);
          _vB.copy(dPos).add(_vRel.set(0, 0.2, 3.0));
          _vLookIss.lerpVectors(_vA, _vB, easeU);
          fov = THREE.MathUtils.lerp(48, 41, easeU);
        } else if (p <= 0.42) {
          // Chapter 2: Close Hero Tracking Shot - prominently framing illuminated cockpit window, 4 astronauts & dual pilot touchscreens
          const u = (p - 0.22) / 0.20;
          const easeU = u * u * (3 - 2 * u);
          if (u < 0.5) {
            _vA.set(-6.2, 2.7, 5.8);
            _vB.set(-4.5, 2.2, 2.2);
            _vRel.lerpVectors(_vA, _vB, u * 2);
          } else {
            _vA.set(-4.5, 2.2, 2.2);
            _vB.set(-4.8, 2.3, 0.5);
            _vRel.lerpVectors(_vA, _vB, (u - 0.5) * 2);
          }
          _vCamIss.copy(dPos).add(_vRel);
          _vLookIss.copy(dPos).add(_vRel.set(
            THREE.MathUtils.lerp(0.0, 0.1, easeU),
            THREE.MathUtils.lerp(0.2, 0.05, easeU),
            THREE.MathUtils.lerp(2.2, 0.6, easeU)
          ));
          fov = THREE.MathUtils.lerp(40, 38, easeU);
        } else if (p <= 0.65) {
          // Chapter 3: Front-three-quarter view as nose cone swings open, revealing docking ring
          const u = (p - 0.42) / 0.23;
          const easeU = u * u * (3 - 2 * u);
          _vA.set(-4.8, 2.3, 0.5);
          _vB.set(-4.8, 2.4, -6.5);
          _vRel.lerpVectors(_vA, _vB, easeU);
          _vCamIss.copy(dPos).add(_vRel);
          _vLookIss.copy(dPos).add(_vRel.set(0, -0.1, THREE.MathUtils.lerp(1.5, 0.2, easeU)));
          fov = 43;
        } else if (p <= 0.86) {
          // Chapter 4: Close-Up Docking Cam right at Harmony forward IDA-2 interface
          const u = (p - 0.65) / 0.21;
          const easeU = u * u * (3 - 2 * u);
          _vA.copy(dPos).add(_vRel.set(-4.8, 2.4, -6.5));
          _vB.set(-3.2, -1.53, 20.92); // portInterface + (-3.2, 1.5, 3.8)
          _vCamIss.lerpVectors(_vA, _vB, easeU);
          _vLookIss.set(0.3, -3.03, 17.92); // portInterface + (0.3, 0.0, 0.8)
          fov = THREE.MathUtils.lerp(43, 48, easeU);
        } else {
          // Chapter 5: Majestic Wide Orbital View - Crew Dragon firmly docked at ISS in space (camera stays completely outside!)
          const u = (p - 0.86) / 0.14;
          const easeU = u * u * (3 - 2 * u);
          _vA.set(-3.2, -1.53, 20.92);
          _vB.set(-16.0, 8.5, 32.0); // Majestic cinematic pull-back framing Dragon docked to ISS above Earth
          _vCamIss.lerpVectors(_vA, _vB, easeU);
          _vLookIss.set(0.0, -3.03, 17.12); // Locked on the real docking interface
          fov = THREE.MathUtils.lerp(48, 44, easeU);
        }

        // Convert station coordinates to world coordinates
        cam.position.copy(c).add(_vCamIss);
        _vWorldLook.copy(c).add(_vLookIss);
        cam.lookAt(_vWorldLook);
        cam.rotateZ(Math.sin(p * Math.PI) * 0.02);
        if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }

        // Documentary Subtitles with real-time range & phase
        if (p < 0.22 && this._introStage !== 1) {
          this._introStage = 1;
          this.typeText('EXPEDITION 71 // ORBITAL RENDEZVOUS // SPACEX CREW DRAGON ON APPROACH');
        } else if (p >= 0.22 && p < 0.42 && this._introStage !== 2) {
          this._introStage = 2;
          this.typeText('CREW DRAGON // FLIGHT DECK TELEMETRY // 4 CREW ON STATION // VELOCITY: 0.35 m/s');
        } else if (p >= 0.42 && p < 0.65 && this._introStage !== 3) {
          this._introStage = 3;
          this.typeText('DOCKING MECHANISM ACTIVE // NOSE CONE DEPLOYED // TARGET LOCK: IDA-2');
        } else if (p >= 0.65 && p < 0.86 && this._introStage !== 4) {
          this._introStage = 4;
          this.typeText('FINAL APPROACH // ALIGNMENT PIN CAPTURE // SOFT DOCKING CONFIRMED');
        } else if (p >= 0.86 && this._introStage !== 5) {
          this._introStage = 5;
          this.typeText('CONTACT & CAPTURE // HARD DOCKING COMPLETE // ALL 12 HOOKS LATCHED');
        }
      }
    } else if (this.state === 'corridor') {
      const a = this.world.corridorStart(), b = this.world.corridorEnd();
      const swayX = Math.sin(this.q * Math.PI * 2) * 0.015;
      const swayY = Math.sin(this.q * Math.PI * 3) * 0.02;
      cam.position.lerpVectors(a, b, this.q);
      cam.position.x += swayX;
      cam.position.y += swayY;
      cam.lookAt(cam.position.x, cam.position.y - 0.02, cam.position.z - 4);
      if (this.world && this.world.updateCorridorDoor) {
        this.world.updateCorridorDoor(this.q);
      }
    }
  }
}
