import { useEffect, useRef, useState, memo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface MarsSurfaceView3DProps {
  fit?: 'contain' | 'cover' | 'slice';
  className?: string;
  onLoaded?: () => void;
}

// Module-level cache for the 36MB Mars Base model so it loads instantly on view switches
let cachedMarsModel: THREE.Group | null = null;
let modelLoadingPromise: Promise<THREE.Group> | null = null;

function loadMarsBaseModel(onProgress?: (pct: number) => void): Promise<THREE.Group> {
  if (cachedMarsModel) {
    return Promise.resolve(cachedMarsModel.clone(true));
  }
  if (modelLoadingPromise) {
    return modelLoadingPromise.then((m) => m.clone(true));
  }

  const loader = new GLTFLoader();
  modelLoadingPromise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      '/models/mars_one_mission_-_base.glb',
      (gltf) => {
        const scene = gltf.scene;
        scene.updateMatrixWorld(true);

        // Convert KHR_materials_unlit to realistic Martian PBR materials
        scene.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            const mesh = node as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              const origMat = mesh.material as THREE.MeshBasicMaterial;
              const map = origMat.map;
              if (map) {
                map.colorSpace = THREE.SRGBColorSpace;
                map.anisotropy = 8;
                map.needsUpdate = true;
              }

              // Standard PBR material responding naturally to Martian sun & ambient atmosphere
              const stdMat = new THREE.MeshStandardMaterial({
                map: map || null,
                roughness: 0.72,
                metalness: 0.16,
                toneMapped: true,
              });
              mesh.material = stdMat;
            }
          }
        });

        cachedMarsModel = scene;
        resolve(scene.clone(true));
      },
      (xhr) => {
        if (xhr.lengthComputable && onProgress) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          onProgress(pct);
        }
      },
      (err) => {
        console.error('[HELIOS] Failed to load Mars One Base 3D model:', err);
        modelLoadingPromise = null;
        reject(err);
      }
    );
  });

  return modelLoadingPromise;
}

export const MarsSurfaceView3D = memo(function MarsSurfaceView3D({
  className = '',
  onLoaded,
}: MarsSurfaceView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadPct, setLoadPct] = useState<number>(cachedMarsModel ? 100 : 0);
  const [isReady, setIsReady] = useState<boolean>(!!cachedMarsModel);

  // Interaction look state (360° mouse drag look through astronaut helmet visor)
  const lookRef = useRef({
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let animId = 0;

    // 1. Three.js Scene Setup with Martian atmospheric scattering
    const scene = new THREE.Scene();
    const marsSkyColor = new THREE.Color(0xd98242); // Warm dusty Martian ochre/orange
    scene.background = marsSkyColor;
    scene.fog = new THREE.FogExp2(0xd98242, 0.0032);

    // 2. Camera Setup (Matching "Mars One" reference render elevation & angle)
    const aspect = container.clientWidth / (container.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.4, 2500);
    // Base is at (0, 2.0, -3.0); solar panels extend forward to Z ~ 22.
    // Elevated viewpoint overlooking panels and modules:
    const baseCamPos = new THREE.Vector3(3.2, 7.6, 28.5);
    const baseLookTarget = new THREE.Vector3(0.0, 3.2, -2.5);
    camera.position.copy(baseCamPos);
    camera.lookAt(baseLookTarget);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 4. Martian Sunlight & Atmospheric Lighting
    const hemiLight = new THREE.HemisphereLight(0xffbe88, 0x824422, 1.4);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd2, 2.6);
    sunLight.position.set(120, 240, 160);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 600;
    const shadowD = 60;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const ambientFill = new THREE.AmbientLight(0xff9450, 0.45);
    scene.add(ambientFill);

    // 5. Airborne Martian Dust / Sand Particles
    const dustCount = 350;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3 + 0] = (Math.random() - 0.5) * 80;
      dustPositions[i * 3 + 1] = Math.random() * 25 + 0.5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffd4aa,
      size: 0.18,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // 6. Load 3D Mars Base Model
    loadMarsBaseModel((pct) => {
      if (!destroyed) setLoadPct(pct);
    })
      .then((model) => {
        if (destroyed) return;
        scene.add(model);
        setIsReady(true);
        if (onLoaded) onLoaded();
      })
      .catch((err) => {
        console.error('Error adding Mars Base model:', err);
      });

    // 7. Interactive 360° Drag Look Event Handlers
    const onPointerDown = (e: PointerEvent) => {
      lookRef.current.isDragging = true;
      lookRef.current.startX = e.clientX;
      lookRef.current.startY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!lookRef.current.isDragging) {
        // Subtle hover head-tracking
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        lookRef.current.targetYaw = -nx * 0.15;
        lookRef.current.targetPitch = -ny * 0.08;
        return;
      }
      const dx = e.clientX - lookRef.current.startX;
      const dy = e.clientY - lookRef.current.startY;
      lookRef.current.startX = e.clientX;
      lookRef.current.startY = e.clientY;

      lookRef.current.targetYaw += dx * 0.0035;
      lookRef.current.targetPitch = Math.max(-0.65, Math.min(0.65, lookRef.current.targetPitch - dy * 0.0035));
    };

    const onPointerUp = () => {
      lookRef.current.isDragging = false;
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);

    // 8. Responsive Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 9. Animation Loop
    let lastTime = performance.now();
    const animate = () => {
      if (destroyed) return;
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smooth camera interpolation for fluid helmet look feel
      const lk = lookRef.current;
      lk.yaw += (lk.targetYaw - lk.yaw) * (1 - Math.exp(-12 * dt));
      lk.pitch += (lk.targetPitch - lk.pitch) * (1 - Math.exp(-12 * dt));

      // Subtle breathing / wind sway
      const swayY = Math.sin(now * 0.0012) * 0.04;
      const swayX = Math.cos(now * 0.0009) * 0.03;

      camera.position.set(baseCamPos.x + swayX, baseCamPos.y + swayY, baseCamPos.z);

      // Apply yaw & pitch from base look target
      const lookDir = baseLookTarget.clone().sub(baseCamPos).normalize();
      lookDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), lk.yaw);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), lk.yaw);
      lookDir.applyAxisAngle(right, lk.pitch);

      camera.lookAt(camera.position.clone().add(lookDir));

      // Animate drifting Martian dust
      const dustArr = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dustArr[i * 3 + 0] += dt * 1.8; // Drift east with wind
        dustArr[i * 3 + 1] += Math.sin(now * 0.001 + i) * dt * 0.2;
        if (dustArr[i * 3 + 0] > 40) dustArr[i * 3 + 0] = -40;
      }
      dustGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      dustGeo.dispose();
      dustMat.dispose();
    };
  }, [onLoaded]);

  return (
    <div
      ref={containerRef}
      className={`mars-surface-3d ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'auto',
        cursor: 'grab',
      }}
    >
      {/* High-Tech Tactical Loading Screen */}
      {!isReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1b0c06 0%, #070302 100%)',
            zIndex: 10,
            color: '#ff9d5c',
            fontFamily: 'monospace',
            letterSpacing: '0.08em',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            MARS RECONNAISSANCE // JEZERO BASE ALPHA
          </div>
          <div
            style={{
              width: 240,
              height: 4,
              background: 'rgba(255, 140, 66, 0.2)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${loadPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ff7a29, #ffb36b)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>
            DOWNLINKING 3D SURFACE GEOMETRY {loadPct > 0 ? `· ${loadPct}%` : '...'}
          </div>
        </div>
      )}
    </div>
  );
});

