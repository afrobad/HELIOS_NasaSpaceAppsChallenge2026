import React, { useRef, useEffect, memo } from 'react';
import * as THREE from 'three';

export type HelixAvatarState = 'IDLE' | 'LISTENING' | 'THINKING' | 'TALKING';

export interface HelixTalkingAvatarProps {
  state?: HelixAvatarState;
  size?: number; // Canvas display size in pixels (default 260)
  onToggleMic?: () => void;
  isListening?: boolean;
}

/**
 * HelixTalkingAvatar — Aerospace Holographic Autonomous Medical Drone
 * 
 * Faithfully crafted to mirror the exact cybernetic NASA-STD-3001 sentry robot:
 * - 360° Circular Reticle Dial with radial tick marks & dual high-energy cyan telemetry arcs
 * - Organically Morphing 3D Geodesic Point-Cloud Brain (~1,200 glowing white-cyan star points)
 * - Precision Chamfered Visor Frame with diagonal notches (top-left & bottom-right cutouts)
 * - Dual Solid Glowing Cyan Square LED Eyes (■  ■) with natural blinking and state dynamics
 * - Zero audio clutter between the eyes: pure iconic robotic face matching reference design
 * - Procedural Three.js: 0MB asset downloads, zero lag, 60/90 FPS hardware acceleration
 */
export const HelixTalkingAvatar: React.FC<HelixTalkingAvatarProps> = memo(({
  state = 'IDLE',
  size = 260,
  onToggleMic,
  isListening = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let animId: number;

    // ─── 1. Scene, Camera & Transparent WebGL Renderer ───
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0, 4.45);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(size, size);
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0));
    renderer.setClearColor(0x000000, 0);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Helper: Circular luminous particle texture
    const createLuminousDotTexture = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255, 255, 255, 1)');
        g.addColorStop(0.25, 'rgba(0, 240, 255, 0.95)');
        g.addColorStop(0.65, 'rgba(0, 180, 255, 0.35)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(c);
    };

    const dotTexture = createLuminousDotTexture();

    // ─── 2. Aerospace HUD Reticle Dial & Dual Concentric Arcs ───
    const hudGroup = new THREE.Group();
    scene.add(hudGroup);

    // 2a. Background Faint Starfield Dots (surrounding the reticle)
    const starCount = 80;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let s = 0; s < starCount; s++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.35 + Math.random() * 0.95;
      starPositions[s * 3] = Math.cos(angle) * r;
      starPositions[s * 3 + 1] = Math.sin(angle) * r;
      starPositions[s * 3 + 2] = (Math.random() - 0.5) * 0.4 - 0.2;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.024,
      map: dotTexture,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    hudGroup.add(starPoints);

    // 2b. Full 360° Circular Dial Base Ring (faint guiding circle)
    const dialR = 1.76;
    const ringSegments = 96;
    const ringPositions: number[] = [];
    for (let i = 0; i <= ringSegments; i++) {
      const theta = (i / ringSegments) * Math.PI * 2;
      ringPositions.push(Math.cos(theta) * dialR, Math.sin(theta) * dialR, 0);
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPositions, 3));
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.18,
    });
    const ringLine = new THREE.Line(ringGeo, ringMat);
    hudGroup.add(ringLine);

    // 2c. Radial Tick Marks (60 ticks around the compass perimeter)
    const tickCount = 60;
    const tickGeo = new THREE.BufferGeometry();
    const tickPositions: number[] = [];
    const tickColors: number[] = [];

    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const isCardinal = i % 15 === 0; // 0, 90, 180, 270 deg
      const isMajor = i % 5 === 0;
      const len = isCardinal ? 0.12 : isMajor ? 0.075 : 0.045;
      const r1 = dialR - len;
      const r2 = dialR;

      const x1 = Math.cos(angle) * r1;
      const y1 = Math.sin(angle) * r1;
      const x2 = Math.cos(angle) * r2;
      const y2 = Math.sin(angle) * r2;

      tickPositions.push(x1, y1, 0, x2, y2, 0);

      // Brightness variation
      const r = isCardinal ? 0.6 : isMajor ? 0.25 : 0.1;
      const g = isCardinal ? 0.95 : isMajor ? 0.75 : 0.45;
      const b = isCardinal ? 1.0 : isMajor ? 0.95 : 0.75;
      tickColors.push(r, g, b, r, g, b);
    }
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
    tickGeo.setAttribute('color', new THREE.Float32BufferAttribute(tickColors, 3));
    const tickMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const tickLines = new THREE.LineSegments(tickGeo, tickMat);
    hudGroup.add(tickLines);

    // 2d. Upper-Right Dual High-Energy Cyan Arcs (exact match to reference photo)
    // Inner primary arc (anchored at upper-right: ~25° to ~85°)
    const arcGeo1Inner = new THREE.RingGeometry(1.79, 1.835, 48, 1, 0.14 * Math.PI, 0.33 * Math.PI);
    const arcMat1Inner = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const arcMesh1Inner = new THREE.Mesh(arcGeo1Inner, arcMat1Inner);
    hudGroup.add(arcMesh1Inner);

    // Outer concentric thin arc (anchored at upper-right: ~35° to ~65°)
    const arcGeo1Outer = new THREE.RingGeometry(1.86, 1.885, 48, 1, 0.20 * Math.PI, 0.16 * Math.PI);
    const arcMat1Outer = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const arcMesh1Outer = new THREE.Mesh(arcGeo1Outer, arcMat1Outer);
    hudGroup.add(arcMesh1Outer);

    // 2e. Lower-Right Neon Cyan Arc (anchored at lower-right: ~305° to ~335°)
    const arcGeo2 = new THREE.RingGeometry(1.79, 1.835, 48, 1, 1.69 * Math.PI, 0.17 * Math.PI);
    const arcMat2 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const arcMesh2 = new THREE.Mesh(arcGeo2, arcMat2);
    hudGroup.add(arcMesh2);

    // ─── 3. Morphing Geodesic Point-Cloud Brain (~1,200 points) ───
    const sphereRadius = 0.95;
    const sphereLatSegments = 30;
    const sphereLonSegments = 40;
    const totalPoints = (sphereLatSegments + 1) * (sphereLonSegments + 1);

    const basePositions = new Float32Array(totalPoints * 3);
    const currentPositions = new Float32Array(totalPoints * 3);
    const pointColors = new Float32Array(totalPoints * 3);

    let pIdx = 0;
    for (let lat = 0; lat <= sphereLatSegments; lat++) {
      const theta = (lat / sphereLatSegments) * Math.PI; // 0 to PI
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= sphereLonSegments; lon++) {
        const phi = (lon / sphereLonSegments) * Math.PI * 2; // 0 to 2PI
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        // Organic dome shaping: slightly flattened at poles & squircle contour
        const yNorm = cosTheta;
        const squircleFactor = 1.0 - 0.08 * Math.pow(Math.abs(yNorm), 3.5) + 0.025 * Math.cos(4.0 * phi);
        const r = sphereRadius * squircleFactor;

        const x = r * sinTheta * cosPhi;
        const y = r * cosTheta;
        const z = r * sinTheta * sinPhi;

        const i3 = pIdx * 3;
        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;

        currentPositions[i3] = x;
        currentPositions[i3 + 1] = y;
        currentPositions[i3 + 2] = z;

        // Front-facing and center points are bright white-cyan, edges have subtle cyan tint
        const depthBias = Math.max(0, sinTheta * sinPhi); // closer to viewer (+z)
        const centerProximity = 1.0 - Math.min(1.0, Math.abs(y) / sphereRadius);

        const rCol = 0.70 + centerProximity * 0.30;
        const gCol = 0.88 + centerProximity * 0.12;
        const bCol = 1.0;

        pointColors[i3] = rCol * (0.85 + depthBias * 0.15);
        pointColors[i3 + 1] = gCol * (0.85 + depthBias * 0.15);
        pointColors[i3 + 2] = bCol;

        pIdx++;
      }
    }

    const brainGeo = new THREE.BufferGeometry();
    brainGeo.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    brainGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

    const brainMat = new THREE.PointsMaterial({
      size: 0.052,
      vertexColors: true,
      map: dotTexture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const brainPoints = new THREE.Points(brainGeo, brainMat);
    scene.add(brainPoints);

    // ─── 4. Chamfered HUD Cybernetic Visor Frame ───
    // Visor matches the user's reference image:
    // Diagonal chamfer notch at top-left AND diagonal chamfer notch at bottom-right
    const visorGroup = new THREE.Group();
    visorGroup.position.set(0, 0, 0.98); // Exactly in front of the head
    scene.add(visorGroup);

    const vw = 0.52;  // half-width
    const vh = 0.235; // half-height
    const ch = 0.085; // chamfer notch size

    // Ordered vertices with top-left & bottom-right diagonal chamfers
    const visorPoints = [
      new THREE.Vector3(-vw + ch, vh, 0),   // Top-left chamfer end
      new THREE.Vector3(vw, vh, 0),         // Top-right 90° corner
      new THREE.Vector3(vw, -vh + ch, 0),   // Right vertical down to chamfer
      new THREE.Vector3(vw - ch, -vh, 0),   // Bottom-right chamfer cut
      new THREE.Vector3(-vw, -vh, 0),       // Bottom-left 90° corner
      new THREE.Vector3(-vw, vh - ch, 0),   // Left vertical up to chamfer
      new THREE.Vector3(-vw + ch, vh, 0),   // Close loop
    ];

    const visorLineGeo = new THREE.BufferGeometry().setFromPoints(visorPoints);
    const visorLineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.95,
    });
    const visorBorder = new THREE.Line(visorLineGeo, visorLineMat);
    visorGroup.add(visorBorder);

    // Dark translucent glass fill inside the visor
    const visorShape = new THREE.Shape();
    visorShape.moveTo(-vw + ch, vh);
    visorShape.lineTo(vw, vh);
    visorShape.lineTo(vw, -vh + ch);
    visorShape.lineTo(vw - ch, -vh);
    visorShape.lineTo(-vw, -vh);
    visorShape.lineTo(-vw, vh - ch);
    visorShape.closePath();

    const visorGlassGeo = new THREE.ShapeGeometry(visorShape);
    const visorGlassMat = new THREE.MeshBasicMaterial({
      color: 0x01060c,
      transparent: true,
      opacity: 0.90,
    });
    const visorGlassMesh = new THREE.Mesh(visorGlassGeo, visorGlassMat);
    visorGlassMesh.position.z = -0.01;
    visorGroup.add(visorGlassMesh);

    // ─── 5. Dual Solid Glowing Cyan Square LED Eyes (■  ■) ───
    // Iconic square glowing blocks matching reference image
    const eyeSize = 0.125;
    const eyeSpacing = 0.135; // Golden spacing matching user image (gap ≈ 1.1x eyeSize)
    const eyeGeo = new THREE.PlaneGeometry(eyeSize, eyeSize);
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 1.0,
    });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-eyeSpacing, 0.0, 0.02);
    visorGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(eyeSpacing, 0.0, 0.02);
    visorGroup.add(rightEye);

    // High-luminance white-cyan core inside each square eye (neon phosphor look)
    const eyeCoreGeo = new THREE.PlaneGeometry(eyeSize * 0.52, eyeSize * 0.52);
    const eyeCoreMat = new THREE.MeshBasicMaterial({
      color: 0xdff8ff,
      transparent: true,
      opacity: 0.95,
    });
    const leftEyeCore = new THREE.Mesh(eyeCoreGeo, eyeCoreMat);
    leftEyeCore.position.set(-eyeSpacing, 0.0, 0.025);
    visorGroup.add(leftEyeCore);

    const rightEyeCore = new THREE.Mesh(eyeCoreGeo, eyeCoreMat);
    rightEyeCore.position.set(eyeSpacing, 0.0, 0.025);
    visorGroup.add(rightEyeCore);

    // Soft additive cyan bloom halo behind each square eye
    const eyeGlowGeo = new THREE.PlaneGeometry(eyeSize * 2.8, eyeSize * 2.8);
    const eyeGlowMat = new THREE.MeshBasicMaterial({
      map: dotTexture,
      color: 0x00e1ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const leftEyeGlow = new THREE.Mesh(eyeGlowGeo, eyeGlowMat);
    leftEyeGlow.position.set(-eyeSpacing, 0.0, 0.01);
    visorGroup.add(leftEyeGlow);

    const rightEyeGlow = new THREE.Mesh(eyeGlowGeo, eyeGlowMat);
    rightEyeGlow.position.set(eyeSpacing, 0.0, 0.01);
    visorGroup.add(rightEyeGlow);

    // ─── 6. Speech Ring Ripple Wave (Radiates outward when TALKING) ───
    const voiceRippleGeo = new THREE.RingGeometry(1.05, 1.08, 64);
    const voiceRippleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const voiceRippleMesh = new THREE.Mesh(voiceRippleGeo, voiceRippleMat);
    voiceRippleMesh.position.z = -0.05;
    scene.add(voiceRippleMesh);

    // ─── 7. Kinetic Animation Loop (60/90 FPS Decoupled) ───
    const startTime = performance.now();
    let nextBlinkTime = 3.0;
    const blinkDuration = 0.16;
    let isBlinking = false;
    let blinkStartTime = 0;
    let scanOffset = 0;

    const animate = () => {
      if (isDisposed) return;
      animId = requestAnimationFrame(animate);

      const elapsed = (performance.now() - startTime) * 0.001;
      const currentState = stateRef.current;

      // 7a. Telemetry Arcs Micro-Pulse (Anchored in upper-right & lower-right)
      const pulseSpeed = currentState === 'THINKING' ? 3.2 : currentState === 'TALKING' ? 1.8 : 0.8;
      const arcOscillation = Math.sin(elapsed * pulseSpeed) * 0.035;
      arcMesh1Inner.rotation.z = arcOscillation;
      arcMesh1Outer.rotation.z = -arcOscillation * 1.25;
      arcMesh2.rotation.z = arcOscillation * 0.85;

      // Organic micro-floating bob of the head & visor
      const floatY = Math.sin(elapsed * 1.4) * 0.03;
      const swayZ = Math.cos(elapsed * 0.85) * 0.015;
      brainPoints.position.y = floatY;
      visorGroup.position.y = floatY;
      brainPoints.rotation.z = swayZ;
      visorGroup.rotation.z = swayZ;

      // 7b. Morphing Geodesic Point-Cloud Brain Dynamics
      const posAttr = brainGeo.getAttribute('position') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;

      const waveFreq = currentState === 'THINKING' ? 5.2 : currentState === 'TALKING' ? 4.0 : 1.8;
      const waveAmp = currentState === 'THINKING' ? 0.08 : currentState === 'TALKING' ? 0.06 : 0.028;

      for (let i = 0; i < totalPoints; i++) {
        const i3 = i * 3;
        const bx = basePositions[i3];
        const by = basePositions[i3 + 1];
        const bz = basePositions[i3 + 2];

        // 3D Harmonic surface displacement wave
        const disp = 1.0 + waveAmp * Math.sin(bx * 3.8 + elapsed * waveFreq) * Math.cos(by * 4.2 + elapsed * (waveFreq * 0.75));

        posArr[i3] = bx * disp;
        posArr[i3 + 1] = by * disp;
        posArr[i3 + 2] = bz * disp;
      }
      posAttr.needsUpdate = true;

      // 7c. Eye Blinking Logic
      if (elapsed > nextBlinkTime && !isBlinking && currentState !== 'THINKING') {
        isBlinking = true;
        blinkStartTime = elapsed;
      }

      if (isBlinking) {
        const progress = (elapsed - blinkStartTime) / blinkDuration;
        if (progress >= 1.0) {
          isBlinking = false;
          nextBlinkTime = elapsed + 3.0 + Math.random() * 3.5;
          leftEye.scale.y = 1.0;
          rightEye.scale.y = 1.0;
          leftEyeCore.scale.y = 1.0;
          rightEyeCore.scale.y = 1.0;
        } else {
          // Rapid vertical close & open
          const eyeScaleY = Math.max(0.06, Math.abs(Math.cos(progress * Math.PI)));
          leftEye.scale.y = eyeScaleY;
          rightEye.scale.y = eyeScaleY;
          leftEyeCore.scale.y = eyeScaleY;
          rightEyeCore.scale.y = eyeScaleY;
        }
      }

      // 7d. State-Driven Cybernetic Behavior
      if (currentState === 'THINKING') {
        // Horizontal radar telemetry scan across visor
        scanOffset = Math.sin(elapsed * 4.8) * 0.05;
        const lx = -eyeSpacing + scanOffset;
        const rx = eyeSpacing + scanOffset;
        leftEye.position.x = lx;
        rightEye.position.x = rx;
        leftEyeCore.position.x = lx;
        rightEyeCore.position.x = rx;
        leftEyeGlow.position.x = lx;
        rightEyeGlow.position.x = rx;

        eyeMat.color.setHex(0xf59e0b); // Amber during thinking
        visorLineMat.color.setHex(0xf59e0b);
        voiceRippleMat.opacity = 0.0;
      } else if (currentState === 'LISTENING') {
        // Wide alert glowing cyan eyes
        leftEye.position.x = -eyeSpacing;
        rightEye.position.x = eyeSpacing;
        leftEyeCore.position.x = -eyeSpacing;
        rightEyeCore.position.x = eyeSpacing;
        leftEyeGlow.position.x = -eyeSpacing;
        rightEyeGlow.position.x = eyeSpacing;

        leftEye.scale.set(1.15, 1.15, 1);
        rightEye.scale.set(1.15, 1.15, 1);
        leftEyeCore.scale.set(1.15, 1.15, 1);
        rightEyeCore.scale.set(1.15, 1.15, 1);
        eyeMat.color.setHex(0x38bdf8);
        visorLineMat.color.setHex(0x38bdf8);
        voiceRippleMat.opacity = 0.0;
      } else if (currentState === 'TALKING') {
        // Talking: Eye brightness pulse & expanding sound ring ripple
        leftEye.position.x = -eyeSpacing;
        rightEye.position.x = eyeSpacing;
        leftEyeCore.position.x = -eyeSpacing;
        rightEyeCore.position.x = eyeSpacing;
        leftEyeGlow.position.x = -eyeSpacing;
        rightEyeGlow.position.x = eyeSpacing;

        const talkPulse = 1.0 + Math.sin(elapsed * 12.0) * 0.12;
        leftEye.scale.set(1.0, isBlinking ? leftEye.scale.y : talkPulse, 1);
        rightEye.scale.set(1.0, isBlinking ? rightEye.scale.y : talkPulse, 1);
        leftEyeCore.scale.set(1.0, isBlinking ? leftEyeCore.scale.y : talkPulse, 1);
        rightEyeCore.scale.set(1.0, isBlinking ? rightEyeCore.scale.y : talkPulse, 1);

        eyeMat.color.setHex(0x00ffff);
        visorLineMat.color.setHex(0x00f0ff);

        // Radiating speech ripple
        const rippleScale = 1.0 + (elapsed * 1.8) % 0.8;
        voiceRippleMesh.scale.set(rippleScale, rippleScale, 1);
        voiceRippleMat.opacity = Math.max(0, 0.65 * (1.0 - (rippleScale - 1.0) / 0.8));
      } else {
        // IDLE: Clean, nominal state
        leftEye.position.x = -eyeSpacing;
        rightEye.position.x = eyeSpacing;
        leftEyeCore.position.x = -eyeSpacing;
        rightEyeCore.position.x = eyeSpacing;
        leftEyeGlow.position.x = -eyeSpacing;
        rightEyeGlow.position.x = eyeSpacing;

        leftEye.scale.set(1.0, isBlinking ? leftEye.scale.y : 1.0, 1.0);
        rightEye.scale.set(1.0, isBlinking ? rightEye.scale.y : 1.0, 1.0);
        leftEyeCore.scale.set(1.0, isBlinking ? leftEyeCore.scale.y : 1.0, 1.0);
        rightEyeCore.scale.set(1.0, isBlinking ? rightEyeCore.scale.y : 1.0, 1.0);

        eyeMat.color.setHex(0x00f5ff);
        visorLineMat.color.setHex(0x00f0ff);
        voiceRippleMat.opacity = 0.0;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      renderer.dispose();
      dotTexture.dispose();
      starGeo.dispose();
      starMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      tickGeo.dispose();
      tickMat.dispose();
      arcGeo1Inner.dispose();
      arcMat1Inner.dispose();
      arcGeo1Outer.dispose();
      arcMat1Outer.dispose();
      arcGeo2.dispose();
      arcMat2.dispose();
      brainGeo.dispose();
      brainMat.dispose();
      visorLineGeo.dispose();
      visorLineMat.dispose();
      visorGlassGeo.dispose();
      visorGlassMat.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
      eyeCoreGeo.dispose();
      eyeCoreMat.dispose();
      eyeGlowGeo.dispose();
      eyeGlowMat.dispose();
      voiceRippleGeo.dispose();
      voiceRippleMat.dispose();
    };
  }, [size]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, rgba(10, 20, 32, 0.96) 0%, rgba(3, 7, 12, 0.98) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: 8,
        padding: '12px 14px 14px 14px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.7), 0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Aerospace HUD Corner Accent Brackets */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          width: 8,
          height: 8,
          borderTop: '1.5px solid rgba(56, 189, 248, 0.6)',
          borderLeft: '1.5px solid rgba(56, 189, 248, 0.6)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 8,
          height: 8,
          borderTop: '1.5px solid rgba(56, 189, 248, 0.6)',
          borderRight: '1.5px solid rgba(56, 189, 248, 0.6)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          width: 8,
          height: 8,
          borderBottom: '1.5px solid rgba(56, 189, 248, 0.6)',
          borderLeft: '1.5px solid rgba(56, 189, 248, 0.6)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          width: 8,
          height: 8,
          borderBottom: '1.5px solid rgba(56, 189, 248, 0.6)',
          borderRight: '1.5px solid rgba(56, 189, 248, 0.6)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Telemetry Header Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
          padding: '0 4px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: state === 'THINKING' ? '#f59e0b' : state === 'TALKING' ? '#00f0ff' : '#10b981',
              boxShadow: `0 0 8px ${state === 'THINKING' ? '#f59e0b' : state === 'TALKING' ? '#00f0ff' : '#10b981'}`,
            }}
          />
          <span
            style={{
              fontFamily: "var(--hud-font-brand, 'Orbitron', monospace)",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: '#f1f5f9',
            }}
          >
            HELIX-AI CORE V4.8
          </span>
        </div>

        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: '0.06em',
            padding: '1.5px 6px',
            borderRadius: 3,
            backgroundColor: state === 'THINKING'
              ? 'rgba(245, 158, 11, 0.2)'
              : state === 'TALKING'
              ? 'rgba(0, 240, 255, 0.2)'
              : isListening
              ? 'rgba(239, 68, 68, 0.2)'
              : 'rgba(16, 185, 129, 0.16)',
            color: state === 'THINKING'
              ? '#f59e0b'
              : state === 'TALKING'
              ? '#00f0ff'
              : isListening
              ? '#ef4444'
              : '#10b981',
            border: `1px solid ${
              state === 'THINKING'
                ? 'rgba(245, 158, 11, 0.4)'
                : state === 'TALKING'
                ? 'rgba(0, 240, 255, 0.4)'
                : isListening
                ? 'rgba(239, 68, 68, 0.4)'
                : 'rgba(16, 185, 129, 0.3)'
            }`,
          }}
        >
          {state === 'THINKING'
            ? 'NEURAL SYNTHESIS'
            : state === 'TALKING'
            ? 'AUDIO TRANSMISSION'
            : isListening
            ? 'LISTENING'
            : 'SENTRY ONLINE'}
        </span>
      </div>

      {/* 3D Holographic Talking Drone Canvas */}
      <div
        ref={mountRef}
        style={{
          width: size,
          height: size,
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom Voice Intercom Mic Pill */}
      {onToggleMic && (
        <button
          type="button"
          onClick={onToggleMic}
          style={{
            marginTop: -6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 14,
            backgroundColor: isListening ? 'rgba(239, 68, 68, 0.25)' : 'rgba(122, 148, 99, 0.18)',
            border: `1px solid ${isListening ? '#ef4444' : 'rgba(122, 148, 99, 0.35)'}`,
            color: isListening ? '#fca5a5' : '#cbd5e1',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'monospace',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            zIndex: 2,
          }}
          title={isListening ? 'Click to stop voice input' : 'Click to speak to Helix AI'}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isListening ? '#ef4444' : '#10b981',
              boxShadow: `0 0 6px ${isListening ? '#ef4444' : '#10b981'}`,
              animation: isListening ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span>{isListening ? 'LISTENING (CLICK TO STOP)' : 'VOICE INTERCOM (MIC)'}</span>
        </button>
      )}
    </div>
  );
});

HelixTalkingAvatar.displayName = 'HelixTalkingAvatar';
