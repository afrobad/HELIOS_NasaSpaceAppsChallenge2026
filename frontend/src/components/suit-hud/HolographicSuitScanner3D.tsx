import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface HolographicSuitScanner3DProps {
  heartRate?: number;
  temperatureC?: number;
  width?: number;
  height?: number;
}

// Astronaut vertical bounds in world coordinates (perfectly proportioned to viewport)
const ASTRONAUT_HEIGHT = 1.38; // Height in 3D scene
const ASTRONAUT_FEET_Y = -0.69; // Soles of the boots (-0.69) to helmet crown (+0.69)

// Scan sweep bounds: strictly from top of helmet down to the boots/feet!
// STOPS cleanly right at the feet/boots (-0.56) and reverses, never going below into empty space.
const SCAN_MIN_Y = -0.56; // At the boots/feet
const SCAN_MAX_Y = 0.56;  // At the helmet

// Anatomical horizontal radius and depth at elevation y
function getAstronautContour(y: number): { rx: number; rz: number; beamHalfWidth: number } {
  if (y > 0.40) {
    // Cranial (Helmet & Visor)
    return { rx: 0.16, rz: 0.17, beamHalfWidth: 0.18 };
  } else if (y > 0.22) {
    // Shoulders & Upper Chest
    return { rx: 0.25, rz: 0.19, beamHalfWidth: 0.27 };
  } else if (y > 0.02) {
    // Thoracic & Life Support Pack
    return { rx: 0.22, rz: 0.18, beamHalfWidth: 0.24 };
  } else if (y > -0.18) {
    // Abdominal & Waist
    return { rx: 0.19, rz: 0.16, beamHalfWidth: 0.21 };
  } else if (y > -0.38) {
    // Femoral & Upper Thighs
    return { rx: 0.20, rz: 0.16, beamHalfWidth: 0.22 };
  } else {
    // Tibial, Ankles & Boots (Feet)
    return { rx: 0.18, rz: 0.15, beamHalfWidth: 0.20 };
  }
}

export function HolographicSuitScanner3D({
  heartRate = 72,
  temperatureC = 21.4,
  width = 136,
  height = 180,
}: HolographicSuitScanner3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [regionTag, setRegionTag] = useState<string>('THORACIC');

  const hrRef = useRef(heartRate);
  hrRef.current = heartRate;

  const dragRef = useRef({
    isDragging: false,
    prevX: 0,
    userRotationY: 0,
    velocity: 0,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current.isDragging = true;
    dragRef.current.prevX = e.clientX;
    dragRef.current.velocity = 0;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const deltaX = e.clientX - dragRef.current.prevX;
    dragRef.current.prevX = e.clientX;
    dragRef.current.userRotationY += deltaX * 0.016;
    dragRef.current.velocity = deltaX * 0.016;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current.isDragging = false;
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = width || container.clientWidth || 136;
    const h = height || container.clientHeight || 180;

    // 1. Scene, Camera & WebGL Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
    camera.position.set(0, 0, 3.4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(w, h);

    // The HUD SVG (viewBox 1024×571) is stretched to fill the screen, so this 136×180 canvas
    // is visually upscaled ~2×. Render the drawing buffer at the TRUE on-screen pixel size
    // (× devicePixelRatio, plus a little supersampling) so the hologram is razor sharp.
    let currentPixelRatio = 0;
    const syncPixelRatio = () => {
      const rect = container.getBoundingClientRect();
      const onScreenScale = rect.width > 0 ? rect.width / w : 1;
      const target = Math.min(Math.max((window.devicePixelRatio || 1) * onScreenScale * 1.25, 1), 5);
      if (Math.abs(target - currentPixelRatio) / (currentPixelRatio || 1) > 0.04) {
        currentPixelRatio = target;
        renderer.setPixelRatio(target);
      }
    };
    syncPixelRatio();
    window.addEventListener('resize', syncPixelRatio);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'grab';

    // 2. Turntable Root Group (360° rotation)
    const turntable = new THREE.Group();
    scene.add(turntable);

    // 3. Astronaut Mesh Group (inside turntable)
    const astronautGroup = new THREE.Group();
    turntable.add(astronautGroup);

    // ─── High-Precision, Lean Hologram Materials ───
    // 3a. Dark translucent depth occluder (blocks messy back-lines so front stays sharp and lean)
    const occluderMat = new THREE.MeshBasicMaterial({
      color: 0x020d17,
      transparent: true,
      opacity: 0.78,
      side: THREE.FrontSide,
      depthWrite: true,
    });

    // 3b. Delicate Fresnel X-Ray Edge Glow (clean cyan rim, NormalBlending)
    const rimShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        rimColor: { value: new THREE.Color(0x7dd3fc) },
        coreColor: { value: new THREE.Color(0x082f49) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 rimColor;
        uniform vec3 coreColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          float vDotN = abs(dot(normalize(vViewPosition), normalize(vNormal)));
          float rim = pow(1.0 - vDotN, 3.4);
          float core = pow(1.0 - vDotN, 1.8) * 0.10;
          vec3 col = mix(coreColor, rimColor, rim);
          float alpha = clamp(rim * 0.60 + core, 0.0, 0.70);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    // 3c. Micro-Particle Point Cloud (ultra-fine, crisp stippled points matching reference)
    const pointsMat = new THREE.PointsMaterial({
      color: 0xe6fbff,
      size: 0.0075, // Pin-sharp micro-dots
      transparent: true,
      opacity: 0.72,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    // 3d. Architectural Feature Edges (sharp suit seams, creases & contours)
    const edgeLineMat = new THREE.LineBasicMaterial({
      color: 0x7ff3ff,
      transparent: true,
      opacity: 0.58,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    // 4. Cardiac Vitals Beacon Node at Chest (y = 0.23, z = 0.14, x = -0.04)
    const cardiacGeo = new THREE.SphereGeometry(0.020, 8, 8);
    const cardiacMat = new THREE.MeshBasicMaterial({ color: 0x62f3f7 });
    const cardiacMesh = new THREE.Mesh(cardiacGeo, cardiacMat);
    cardiacMesh.position.set(-0.04, 0.23, 0.14);
    turntable.add(cardiacMesh);

    const cardiacRingGeo = new THREE.RingGeometry(0.030, 0.040, 16);
    const cardiacRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const cardiacRing = new THREE.Mesh(cardiacRingGeo, cardiacRingMat);
    cardiacRing.position.set(-0.04, 0.23, 0.145);
    turntable.add(cardiacRing);

    // 5. Precision Tomographic Laser Scanner Slice (mounted on turntable)
    // No bulky pedestal rings! Clean scanning beam and contour loop that stops strictly at feet.
    const scanBeam = new THREE.Group();

    // 5a. Sleek Horizontal Laser Line
    const laserPts = [new THREE.Vector3(-0.30, 0, 0), new THREE.Vector3(0.30, 0, 0)];
    const laserGeo = new THREE.BufferGeometry().setFromPoints(laserPts);
    const laserLine = new THREE.Line(
      laserGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90 })
    );
    scanBeam.add(laserLine);

    // 5b. Tomographic Elliptical Cross-Section Contour Loop
    const scanContourCurve = new THREE.EllipseCurve(0, 0, 0.22, 0.18, 0, Math.PI * 2, false, 0);
    const scanContourPts = scanContourCurve.getPoints(24).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const scanContourGeo = new THREE.BufferGeometry().setFromPoints(scanContourPts);
    const scanContourLine = new THREE.LineLoop(
      scanContourGeo,
      new THREE.LineBasicMaterial({ color: 0x62f3f7, transparent: true, opacity: 0.70 })
    );
    scanBeam.add(scanContourLine);

    // 5c. Delicate Planar Luminous Sheet (subtle depth slice)
    const scanSheetGeo = new THREE.PlaneGeometry(0.50, 0.36);
    scanSheetGeo.rotateX(Math.PI / 2);
    const scanSheetMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const scanSheet = new THREE.Mesh(scanSheetGeo, scanSheetMat);
    scanBeam.add(scanSheet);

    turntable.add(scanBeam);

    // 6. Load NASA Astronaut GLTF Model
    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [
      occluderMat,
      rimShaderMat,
      pointsMat,
      edgeLineMat,
      cardiacGeo,
      cardiacMat,
      cardiacRingGeo,
      cardiacRingMat,
      laserGeo,
      scanContourGeo,
      scanSheetGeo,
      scanSheetMat,
    ];

    const loader = new GLTFLoader();
    loader.load(
      '/models/Astronaut.glb',
      (gltf) => {
        const rawModel = gltf.scene;

        rawModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geo = mesh.geometry.clone();
            disposables.push(geo);

            // 6a. Dark Occluder Hull (ensures crisp clean silhouettes without wire overlap)
            const occluderMesh = new THREE.Mesh(geo, occluderMat);
            astronautGroup.add(occluderMesh);

            // 6b. Delicate Fresnel X-Ray Rim
            const rimMesh = new THREE.Mesh(geo, rimShaderMat);
            astronautGroup.add(rimMesh);

            // 6c. Micro-Particle Point Cloud (luminous star-dust effect)
            const points = new THREE.Points(geo, pointsMat);
            astronautGroup.add(points);

            // 6d. Feature Edge Wireframe (clean CAD lines, creases > 22°)
            const edgesGeo = new THREE.EdgesGeometry(geo, 22);
            disposables.push(edgesGeo);
            const edgeLines = new THREE.LineSegments(edgesGeo, edgeLineMat);
            astronautGroup.add(edgeLines);
          }
        });

        // Measure the REAL model bounds, then scale + centre it exactly on the origin
        // (the camera looks at the origin, so the body is perfectly centred in the frame).
        const rawBox = new THREE.Box3().setFromObject(astronautGroup);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const scaleFactor = ASTRONAUT_HEIGHT / (rawSize.y || 1);
        // Slender X/Z scaling (0.88) keeps the lean, athletic silhouette.
        astronautGroup.scale.set(scaleFactor * 0.88, scaleFactor, scaleFactor * 0.88);
        astronautGroup.position.set(0, 0, 0);
        astronautGroup.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(astronautGroup);
        const center = scaledBox.getCenter(new THREE.Vector3());
        astronautGroup.position.set(-center.x, -center.y, -center.z);
        astronautGroup.updateMatrixWorld(true);

        // Scanner bounds come from the measured body: soles of boots -> crown of helmet.
        const finalBox = new THREE.Box3().setFromObject(astronautGroup);
        const bodyH = finalBox.max.y - finalBox.min.y;
        bodyMinY = finalBox.min.y;
        bodyMaxY = finalBox.max.y;
        scanMinY = finalBox.min.y + bodyH * 0.015; // reverses right at the boot soles
        scanMaxY = finalBox.max.y - bodyH * 0.02;  // reverses right at the helmet crown
        scanBeam.visible = true;
      },
      undefined,
      (err) => {
        console.warn('Could not load Astronaut.glb:', err);
      }
    );

    // 7. 60 FPS Animation Loop
    // Scan bounds (replaced with measured model bounds once the GLB loads)
    let bodyMinY = ASTRONAUT_FEET_Y;
    let bodyMaxY = ASTRONAUT_FEET_Y + ASTRONAUT_HEIGHT;
    let scanMinY = SCAN_MIN_Y;
    let scanMaxY = SCAN_MAX_Y;
    scanBeam.visible = false; // hidden until the body is loaded & measured

    let animId = 0;
    const startTime = performance.now() * 0.001;
    let lastUiUpdate = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsed = performance.now() * 0.001 - startTime;

      // Smooth continuous turntable rotation
      if (dragRef.current.isDragging) {
        turntable.rotation.y = dragRef.current.userRotationY;
      } else {
        if (Math.abs(dragRef.current.velocity) > 0.0003) {
          dragRef.current.velocity *= 0.92;
          dragRef.current.userRotationY += dragRef.current.velocity;
          turntable.rotation.y = dragRef.current.userRotationY;
        } else {
          dragRef.current.userRotationY += 0.006;
          turntable.rotation.y = dragRef.current.userRotationY;
        }
      }

      // Cardiac heartbeat pulse (72 BPM)
      const currentBpm = hrRef.current || 72;
      const beatFreq = (currentBpm / 60) * Math.PI * 2;
      const pulse = Math.max(0, Math.sin(elapsed * beatFreq));
      const s = 1.0 + pulse * 0.45;
      cardiacMesh.scale.set(s, s, s);
      cardiacRing.scale.set(s * 1.3, s * 1.3, 1);
      (cardiacRing.material as THREE.MeshBasicMaterial).opacity = 0.4 + pulse * 0.55;

      // Laser Scanner Sweep: STRICTLY bounded between boots (SCAN_MIN_Y = -0.56) and helmet (SCAN_MAX_Y = +0.56)!
      // Stops precisely at the feet/boots and sweeps upward, NEVER going below the boots!
      const sweepCycle = (Math.sin(elapsed * 1.4) + 1) * 0.5; // 0.0 to 1.0
      const scanY = scanMinY + sweepCycle * (scanMaxY - scanMinY);
      scanBeam.position.y = scanY;

      // Normalised body height (0 = soles, 1 = crown), mapped onto the contour table
      const tBody = (scanY - bodyMinY) / (bodyMaxY - bodyMinY || 1);
      const contour = getAstronautContour(-0.69 + tBody * 1.38);
      laserLine.scale.set(contour.beamHalfWidth / 0.30, 1, 1);
      scanContourLine.scale.set(contour.rx / 0.22, 1, contour.rz / 0.18);
      scanSheet.scale.set(contour.beamHalfWidth / 0.25, 1, contour.rz / 0.18);

      // Readout updates smoothly
      if (elapsed - lastUiUpdate > 0.15) {
        lastUiUpdate = elapsed;
        syncPixelRatio(); // keep drawing buffer matched to on-screen size (fullscreen, zoom, layout)
        if (tBody > 0.78) setRegionTag('CRANIAL');
        else if (tBody > 0.58) setRegionTag('THORACIC');
        else if (tBody > 0.42) setRegionTag('ABDOMINAL');
        else if (tBody > 0.18) setRegionTag('FEMORAL');
        else setRegionTag('PEDAL // BOOTS');
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', syncPixelRatio);
      renderer.dispose();
      disposables.forEach((d) => d.dispose());
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

  return (
    <div
      className="hud-scanner-root"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      title="3D Astronaut Hologram · Drag to rotate"
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* Minimal Top Header Tag */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: 4,
          right: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          fontFamily: "'Rajdhani', sans-serif",
        }}
      >
        <span
          style={{
            fontSize: '7.5px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#62f3f7',
          }}
        >
          EVA-01 // BIO-SCAN
        </span>
        <span
          style={{
            fontSize: '7px',
            letterSpacing: '0.04em',
            color: '#effffe',
            opacity: 0.85,
          }}
        >
          {temperatureC.toFixed(1)}°C
        </span>
      </div>

      {/* Minimal Bottom Status Line */}
      <div
        style={{
          position: 'absolute',
          bottom: 2,
          left: 4,
          right: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: '7.5px',
        }}
      >
        <span style={{ color: '#94e8eb', letterSpacing: '0.04em' }}>{regionTag}</span>
        <span style={{ color: '#62f3f7', fontWeight: 600, letterSpacing: '0.05em' }}>360° ROT</span>
      </div>
    </div>
  );
}

export default HolographicSuitScanner3D;
