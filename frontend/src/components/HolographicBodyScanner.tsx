import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TelemetryPacket } from '../types/telemetry';
import {
  HUMAN_VERTICES,
  HUMAN_LINE_INDICES,
  HUMAN_TRI_INDICES,
  HUMAN_SPINE_VERTICES,
} from '../data/humanMeshGeometry';

export interface HolographicBodyScannerProps {
  astronautId: string;
  astronautName: string;
  astronautRole: string;
  crewNo: string;
  telemetry?: TelemetryPacket;
  themeMode?: 'CYAN' | 'HEATMAP' | 'AEROSPACE';
  onSelectSubsystem?: (subsystem: 'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL') => void;
}

interface Hotspot {
  id: 'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL';
  label: string;
  subsystemName: string;
  elevationTag: string;
  organ: string;
  pos: [number, number, number];
  scanTargetY: number;
  severity: 'NOMINAL' | 'WARNING' | 'CRITICAL';
  metric: string;
  detail: string;
  region: string;
  protocol: string;
}

// Anatomical cross-section radius lookup function for dynamic tomographic body contouring
function getBodyContourRadii(y: number): { rx: number; rz: number } {
  // y ranges from -1.50 (feet) to +1.50 (head) on scaled mesh (scale 0.82)
  if (y > 1.15) {
    // Cranial (Head & Brain)
    const t = Math.max(0, Math.min(1, (y - 1.15) / 0.35));
    return { rx: 0.16 + 0.03 * (1 - t), rz: 0.19 };
  } else if (y > 0.80) {
    // Cervical / Upper Thoracic
    const t = (y - 0.80) / 0.35;
    return { rx: 0.22 + 0.16 * (1 - t), rz: 0.18 + 0.05 * (1 - t) };
  } else if (y > 0.45) {
    // Thoracic / Myocardium & Ribcage
    const t = (y - 0.45) / 0.35;
    return { rx: 0.34 + 0.08 * t, rz: 0.21 + 0.04 * t };
  } else if (y > 0.05) {
    // Abdominal / Renal Cortex & Waist
    const t = (y - 0.05) / 0.40;
    return { rx: 0.25 + 0.08 * t, rz: 0.18 + 0.03 * t };
  } else if (y > -0.30) {
    // Pelvic / Lumbar Spine
    return { rx: 0.30, rz: 0.20 };
  } else if (y > -0.85) {
    // Femoral / Quadriceps
    const t = (y + 0.85) / 0.55;
    return { rx: 0.25 + 0.04 * t, rz: 0.16 + 0.03 * t };
  } else if (y > -1.30) {
    // Tibial / Calves & Shins
    const t = (y + 1.30) / 0.45;
    return { rx: 0.20 + 0.04 * t, rz: 0.14 + 0.02 * t };
  } else {
    // Plantar Base & Feet
    return { rx: 0.22, rz: 0.18 };
  }
}

export const HolographicBodyScanner: React.FC<HolographicBodyScannerProps> = ({
  astronautId,
  astronautName,
  astronautRole,
  crewNo,
  telemetry,
  themeMode: initialTheme = 'CYAN',
  onSelectSubsystem,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL'>('CARDIAC');
  const [autoRotate, setAutoRotate] = useState(false);
  const [colorTheme, setColorTheme] = useState<'CYAN' | 'HEATMAP' | 'AEROSPACE'>(initialTheme);
  const [laserMode, setLaserMode] = useState<'SWEEP' | 'LOCK_ORGAN' | 'OFF'>('SWEEP');

  // Direct DOM references for 60 FPS HUD telemetry updates without triggering React re-renders
  const elevationDomRef = useRef<HTMLSpanElement>(null);
  const regionDomRef = useRef<HTMLSpanElement>(null);
  const sliceIndexDomRef = useRef<HTMLSpanElement>(null);
  const azimuthDomRef = useRef<HTMLSpanElement>(null);
  const elevationRulerChevronRef = useRef<HTMLDivElement>(null);

  // Derive dynamic vitals
  const isPilot = astronautId === 'AST-02_PILOT';
  const hr = telemetry?.heart_rate || (isPilot ? 108 : 72);
  const spo2 = telemetry?.spo2 || (isPilot ? 96.0 : 98.4);
  const temp = telemetry?.core_temp || (isPilot ? 37.1 : 36.6);

  // Synchronous refs for WebGL 60 FPS animation loop (decoupled from React render cycle)
  const hrRef = useRef(hr);
  const autoRotateRef = useRef(autoRotate);
  const laserModeRef = useRef(laserMode);
  const selectedHotspotRef = useRef(selectedHotspot);
  const onSelectSubsystemRef = useRef(onSelectSubsystem);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const snapTargetAzimuthRef = useRef<number | null>(null);
  const updateMaterialsRef = useRef<((theme: string, pilotAnomaly: boolean) => void) | null>(null);

  useEffect(() => {
    hrRef.current = hr;
  }, [hr]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    laserModeRef.current = laserMode;
  }, [laserMode]);

  useEffect(() => {
    selectedHotspotRef.current = selectedHotspot;
  }, [selectedHotspot]);

  useEffect(() => {
    onSelectSubsystemRef.current = onSelectSubsystem;
  }, [onSelectSubsystem]);

  useEffect(() => {
    if (updateMaterialsRef.current) {
      updateMaterialsRef.current(colorTheme, isPilot);
    }
  }, [colorTheme, isPilot]);

  // Scaled hotspot definitions (mesh scaled to 0.82, perfectly matching centered body)
  const MESH_SCALE = 0.82;

  const hotspots: Hotspot[] = useMemo(() => [
    {
      id: 'OCULAR',
      label: 'Cranial / SANS Ocular',
      subsystemName: 'Retina / SANS Risk',
      elevationTag: '+1.25m Cranial',
      organ: 'Retinal Nerve Fiber Layer (OCT)',
      region: 'CRANIAL (+1.25m)',
      pos: [0.0 * MESH_SCALE, 1.52 * MESH_SCALE, 0.22 * MESH_SCALE],
      scanTargetY: 1.52 * MESH_SCALE,
      severity: isPilot ? 'WARNING' : 'NOMINAL',
      metric: isPilot ? 'RNFL +14 µm · IOP 18.5 mmHg' : 'RNFL Normal · IOP 15.2 mmHg',
      detail: isPilot ? 'Cephalad microgravity fluid shift detected; mild optic disc edema Grade 1.' : 'Normal ocular baseline; intracranial pressure nominal.',
      protocol: 'Weekly bi-ocular OCT scans · Monitor optic nerve sheath diameter (ONSD)',
    },
    {
      id: 'CARDIAC',
      label: 'Thoracic / Cardiovascular',
      subsystemName: 'Myocardium & Rhythm',
      elevationTag: '+0.70m Thoracic',
      organ: 'Myocardium & Autonomic Tone',
      region: 'THORACIC (+0.70m)',
      pos: [-0.15 * MESH_SCALE, 0.85 * MESH_SCALE, 0.24 * MESH_SCALE],
      scanTargetY: 0.85 * MESH_SCALE,
      severity: isPilot ? 'CRITICAL' : 'NOMINAL',
      metric: `HR ${hr.toFixed(0)} bpm · SpO₂ ${spo2.toFixed(1)}% · Temp ${temp.toFixed(1)}°C`,
      detail: isPilot ? 'Sinus tachycardia excursion (+31.7% vs base); sympathetic dominance.' : 'Cardiac electrophysiology nominal; sinus rhythm steady.',
      protocol: 'Execute Flight Procedure M-204 · Oral chilled electrolyte hydration · Recumbent rest',
    },
    {
      id: 'RENAL',
      label: 'Abdominal / Renal Balance',
      subsystemName: 'Hydration & Calculi',
      elevationTag: '+0.24m Abdominal',
      organ: 'Nephrolithiasis & Electrolytes',
      region: 'ABDOMINAL (+0.24m)',
      pos: [0.07 * MESH_SCALE, 0.29 * MESH_SCALE, -0.28 * MESH_SCALE],
      scanTargetY: 0.29 * MESH_SCALE,
      severity: isPilot ? 'WARNING' : 'NOMINAL',
      metric: isPilot ? 'Kidney Stone Risk: 2.1% · K⁺ 3.6' : 'Kidney Stone Risk: 0.2% · K⁺ 4.2',
      detail: isPilot ? 'Bone calcium resorption & mild hypovolemia elevating calcification probability.' : 'Serum potassium and renal filtration rate within nominal bounds.',
      protocol: 'Target daily hydration ≥ 2.5 L · Track urine specific gravity · Potassium panel',
    },
    {
      id: 'SKELETAL',
      label: 'Musculoskeletal / Femoral',
      subsystemName: 'Bone Density (BMD)',
      elevationTag: '-0.57m Femoral',
      organ: 'Bone Mineral Density (BMD)',
      region: 'FEMORAL (-0.57m)',
      pos: [0.27 * MESH_SCALE, -0.69 * MESH_SCALE, 0.12 * MESH_SCALE],
      scanTargetY: -0.69 * MESH_SCALE,
      severity: 'NOMINAL',
      metric: 'BMD Index 94.5% · ARED 11.8 MJ',
      detail: 'Resistive countermeasure exercise maintaining trabecular load profile.',
      protocol: 'Maintain ARED resistive deadlift & squat cycles (150 kN load target)',
    },
  ], [isPilot, hr, spo2, temp]);

  // Smooth View Snap Trigger
  const snapToAngle = useCallback((targetDeg: number) => {
    const rad = (targetDeg * Math.PI) / 180;
    snapTargetAzimuthRef.current = rad;
    setAutoRotate(false);
  }, []);

  // Reset Camera View
  const handleResetCamera = useCallback(() => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(0, 0, 4.9);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      snapTargetAzimuthRef.current = null;
      setAutoRotate(false);
    }
  }, []);

  // ─── Three.js Scene Setup (Mounts STRICTLY ONCE) ───
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 540;
    const height = container.clientHeight || 490;

    // 1. Scene & Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02050a);

    // Camera calibrated: Head top (+1.47) and Pedestal (-1.50) fit 100% inside 490px view
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.9);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Clear previous children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'grab';

    // 2. OrbitControls with Smooth Damping & Clamped Pitch
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.minDistance = 3.0;
    controls.maxDistance = 7.5;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.25; // Clamped so body never flips upside down
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.8;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 3. Lighting System (Aerospace Holographic Ambient)
    const ambientLight = new THREE.AmbientLight(0x061c2e, 1.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00e5ff, 0.8);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x0088cc, 0.6);
    rimLight.position.set(-2, -1, -3);
    scene.add(rimLight);

    // ─── 4. Anatomical Body Group (Scaled to 0.82 for 100% Non-Clipping View) ───
    const bodyGroup = new THREE.Group();
    bodyGroup.scale.set(0.82, 0.82, 0.82);
    bodyGroup.position.set(0, 0, 0);
    scene.add(bodyGroup);

    // 4a. Inner Anatomical Muscle Mass Silhouette (Matte Hologram, NO plastic specular shine!)
    const solidGeo = new THREE.BufferGeometry();
    solidGeo.setAttribute('position', new THREE.BufferAttribute(HUMAN_VERTICES, 3));
    solidGeo.setIndex(new THREE.BufferAttribute(HUMAN_TRI_INDICES, 1));
    solidGeo.computeVertexNormals();

    const solidMat = new THREE.MeshLambertMaterial({
      color: 0x021626,
      emissive: 0x001422,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    const solidMesh = new THREE.Mesh(solidGeo, solidMat);
    bodyGroup.add(solidMesh);

    // 4b. High-Resolution Wireframe Polygon Lattice (3,319 edges)
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.BufferAttribute(HUMAN_VERTICES, 3));
    wireGeo.setIndex(new THREE.BufferAttribute(HUMAN_LINE_INDICES, 1));

    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.88,
    });
    const wireLines = new THREE.LineSegments(wireGeo, wireMat);
    bodyGroup.add(wireLines);

    // 4c. Glowing Vertex Cloud (1,629 nodes)
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(HUMAN_VERTICES, 3));

    const pointsMat = new THREE.PointsMaterial({
      color: 0x80f5ff,
      size: 0.022,
      transparent: true,
      opacity: 0.85,
    });
    const pointsMesh = new THREE.Points(pointsGeo, pointsMat);
    bodyGroup.add(pointsMesh);

    // 4d. Central Spinal Axis
    const spineGeo = new THREE.BufferGeometry();
    spineGeo.setAttribute('position', new THREE.BufferAttribute(HUMAN_SPINE_VERTICES, 3));
    const spineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const spineLine = new THREE.Line(spineGeo, spineMat);
    bodyGroup.add(spineLine);

    // 4e. Circular Holographic Pedestal at feet
    const baseGrid = new THREE.PolarGridHelper(1.25, 16, 4, 32, 0x00e5ff, 0x005588);
    baseGrid.position.y = -1.82;
    bodyGroup.add(baseGrid);

    // 4f. Real-Time Pulsing Cardiac Node
    const cardiacGeo = new THREE.SphereGeometry(0.048, 16, 16);
    const cardiacMat = new THREE.MeshBasicMaterial({
      color: isPilot ? 0xff3b30 : 0x00e5ff,
    });
    const cardiacMesh = new THREE.Mesh(cardiacGeo, cardiacMat);
    cardiacMesh.position.set(-0.15, 0.85, 0.24);
    bodyGroup.add(cardiacMesh);

    const cardiacRingGeo = new THREE.RingGeometry(0.062, 0.078, 24);
    const cardiacRingMat = new THREE.MeshBasicMaterial({
      color: isPilot ? 0xff4d4d : 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const cardiacRing = new THREE.Mesh(cardiacRingGeo, cardiacRingMat);
    cardiacRing.position.set(-0.15, 0.85, 0.25);
    bodyGroup.add(cardiacRing);

    // 4g. Interactive Hotspots Nodes (High-precision medical sentry reticles)
    const hotspotMeshes: THREE.Mesh[] = [];
    hotspots.forEach(hs => {
      // Inner glowing core
      const g = new THREE.SphereGeometry(0.038, 16, 16);
      const m = new THREE.MeshBasicMaterial({
        color: hs.severity === 'CRITICAL' ? 0xff3b30 : hs.severity === 'WARNING' ? 0xffaa00 : 0x00e5ff,
      });
      const node = new THREE.Mesh(g, m);
      // Hotspot positions on unscaled bodyGroup
      node.position.set(hs.pos[0] / 0.82, hs.pos[1] / 0.82, hs.pos[2] / 0.82);
      node.userData = { id: hs.id };
      bodyGroup.add(node);
      hotspotMeshes.push(node);

      // Delicate outer targeting ring
      const rGeo = new THREE.RingGeometry(0.052, 0.068, 24);
      const rMat = new THREE.MeshBasicMaterial({
        color: hs.severity === 'CRITICAL' ? 0xff3b30 : hs.severity === 'WARNING' ? 0xffaa00 : 0x00e5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.80,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(node.position.x, node.position.y, node.position.z + 0.01);
      bodyGroup.add(rMesh);
    });

    // ─── 5. Realistic Tomographic Laser Scanner (No Hula Hoops!) ───
    const scanGroup = new THREE.Group();
    scene.add(scanGroup);

    // 5a. Sleek Razor-Sharp Cyan Laser Beam (Horizontal line spanning the body width)
    const laserBeamPts = new Float32Array([-1.1, 0, 0, 1.1, 0, 0]);
    const laserBeamGeo = new THREE.BufferGeometry();
    laserBeamGeo.setAttribute('position', new THREE.BufferAttribute(laserBeamPts, 3));
    const laserBeamMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const laserBeamLine = new THREE.Line(laserBeamGeo, laserBeamMat);
    scanGroup.add(laserBeamLine);

    // 5b. Subtle Luminous Planar Aura (Depth sheet that visually sweeps across the body)
    const scanSheetGeo = new THREE.PlaneGeometry(2.2, 0.28);
    scanSheetGeo.rotateX(Math.PI / 2);
    const scanSheetMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const scanSheet = new THREE.Mesh(scanSheetGeo, scanSheetMat);
    scanGroup.add(scanSheet);

    // 5c. Dynamic Tomographic Contour Slice Loop (Expands and contracts with body anatomy!)
    const sliceCurve = new THREE.EllipseCurve(0, 0, 1, 1, 0, 2 * Math.PI, false, 0);
    const slicePoints = sliceCurve.getPoints(48);
    const sliceGeo = new THREE.BufferGeometry().setFromPoints(slicePoints);
    sliceGeo.rotateX(Math.PI / 2);
    const sliceMat = new THREE.LineBasicMaterial({
      color: 0x80f5ff,
      transparent: true,
      opacity: 0.90,
    });
    const sliceContourLine = new THREE.LineLoop(sliceGeo, sliceMat);
    scanGroup.add(sliceContourLine);

    // 5d. Minimalist HUD Targeting Brackets `[  ]` framing the active slice
    const bracketGroup = new THREE.Group();
    scanGroup.add(bracketGroup);

    // 4 Corner Brackets
    const createCornerBracket = (x: number, z: number, sx: number, sz: number) => {
      const bPts = new Float32Array([
        x - 0.08 * sx, 0, z,
        x, 0, z,
        x, 0, z - 0.08 * sz,
      ]);
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.BufferAttribute(bPts, 3));
      const bMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.75 });
      return new THREE.Line(bGeo, bMat);
    };

    bracketGroup.add(createCornerBracket(-0.85, -0.35, -1, -1));
    bracketGroup.add(createCornerBracket(0.85, -0.35, 1, -1));
    bracketGroup.add(createCornerBracket(-0.85, 0.35, -1, 1));
    bracketGroup.add(createCornerBracket(0.85, 0.35, 1, 1));

    // 5e. Real Physical 3D Point Light moving with laser
    const scanLight = new THREE.PointLight(0x00e5ff, 2.2, 2.4);
    scanGroup.add(scanLight);

    // Theme color updater
    updateMaterialsRef.current = (theme: string, pilotAnomaly: boolean) => {
      let pColor = 0x00e5ff;
      let nColor = 0x80f5ff;
      let silColor = 0x021626;

      if (theme === 'AEROSPACE') {
        pColor = 0x529642;
        nColor = 0xa3e699;
        silColor = 0x081a0c;
      } else if (theme === 'HEATMAP') {
        pColor = pilotAnomaly ? 0xcf9834 : 0x529642;
        nColor = pilotAnomaly ? 0xffbe59 : 0x8cf277;
        silColor = pilotAnomaly ? 0x221402 : 0x081a0c;
      }

      wireMat.color.setHex(pColor);
      pointsMat.color.setHex(nColor);
      solidMat.color.setHex(silColor);
      scanSheetMat.color.setHex(pColor);
      sliceMat.color.setHex(nColor);
      scanLight.color.setHex(pColor);
    };

    // ─── 6. Pointer & Raycasting Event Handling ───
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      renderer.domElement.style.cursor = 'grabbing';
      snapTargetAzimuthRef.current = null;
    };

    const onPointerUp = (e: PointerEvent) => {
      renderer.domElement.style.cursor = 'grab';

      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);

      // Only treat as click if pointer moved < 5px
      if (dx < 5 && dy < 5) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(hotspotMeshes);
        if (intersects.length > 0) {
          const hitId = intersects[0].object.userData.id as 'OCULAR' | 'CARDIAC' | 'RENAL' | 'SKELETAL';
          setSelectedHotspot(hitId);
          if (onSelectSubsystemRef.current) onSelectSubsystemRef.current(hitId);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);

    // ─── 7. Animation Loop (Uninterrupted 60 FPS) ───
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let currentScanY = 0;
    let targetScanY = 0;

    const getRegionName = (y: number): string => {
      if (y > 1.10) return 'CRANIAL / SANS OCULAR';
      if (y > 0.75) return 'CERVICAL / CAROTID';
      if (y > 0.40) return 'THORACIC / CARDIAC';
      if (y > 0.05) return 'ABDOMINAL / RENAL';
      if (y > -0.30) return 'PELVIC / LUMBAR';
      if (y > -0.85) return 'FEMORAL / MUSCULOSKELETAL';
      if (y > -1.25) return 'TIBIAL / LOWER PERIPHERY';
      return 'PLANTAR / BASE';
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Handle smooth view snap animation
      if (snapTargetAzimuthRef.current !== null) {
        const currentAz = controls.getAzimuthalAngle();
        const diff = snapTargetAzimuthRef.current - currentAz;
        if (Math.abs(diff) > 0.02) {
          controls.autoRotate = false;
          const step = diff * 0.12;
          camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), step);
        } else {
          snapTargetAzimuthRef.current = null;
        }
      }

      // Update OrbitControls
      controls.update();

      // Update Azimuth HUD directly via DOM text ref (0 React re-renders!)
      if (azimuthDomRef.current) {
        const rawAz = controls.getAzimuthalAngle();
        const deg = Math.round((((rawAz % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2)) * 360);
        azimuthDomRef.current.textContent = `${deg}°`;
      }

      // ─── Sweeping Laser Scanner Plane ───
      const mode = laserModeRef.current;
      if (mode === 'OFF') {
        scanGroup.visible = false;
      } else {
        scanGroup.visible = true;

        if (mode === 'SWEEP') {
          // Smooth continuous vertical oscillation across the full 2.95m body
          targetScanY = Math.sin(elapsed * 1.25) * 1.40;
          currentScanY += (targetScanY - currentScanY) * 0.15;
        } else if (mode === 'LOCK_ORGAN') {
          // Lock to the selected hotspot elevation
          const activeHs = hotspots.find(h => h.id === selectedHotspotRef.current);
          targetScanY = activeHs ? activeHs.scanTargetY : 0.70;
          currentScanY += (targetScanY - currentScanY) * 0.10;
        }

        // Apply scan group elevation
        scanGroup.position.y = currentScanY;

        // Dynamic tomographic contour expansion/contraction to hug body
        const contour = getBodyContourRadii(currentScanY);
        sliceContourLine.scale.set(contour.rx * 1.08, 1, contour.rz * 1.08);

        // Subtle pulsation on scan sheet opacity
        scanSheetMat.opacity = 0.20 + 0.08 * Math.sin(elapsed * 4.0);

        // Update elevation HUD telemetry readouts directly via DOM ref
        if (elevationDomRef.current) {
          elevationDomRef.current.textContent = `${currentScanY >= 0 ? '+' : ''}${currentScanY.toFixed(2)} m`;
        }
        if (regionDomRef.current) {
          regionDomRef.current.textContent = getRegionName(currentScanY);
        }
        if (sliceIndexDomRef.current) {
          const sliceNum = Math.round(((currentScanY + 1.45) / 2.90) * 128);
          sliceIndexDomRef.current.textContent = `SLICE #${Math.max(1, Math.min(128, sliceNum))}`;
        }
        if (elevationRulerChevronRef.current) {
          // Map -1.45m .. +1.45m to 0% .. 100% of vertical ruler
          const pct = Math.max(0, Math.min(100, ((currentScanY + 1.45) / 2.90) * 100));
          elevationRulerChevronRef.current.style.bottom = `${pct}%`;
        }
      }

      // ─── Real-Time Cardiac Node Pulsing ───
      const currentHr = hrRef.current || 72;
      const bps = (currentHr / 60) * Math.PI * 2;
      const pulseScale = 1.0 + 0.35 * Math.sin(elapsed * bps);
      cardiacMesh.scale.set(pulseScale, pulseScale, pulseScale);
      cardiacRing.scale.set(pulseScale * 1.18, pulseScale * 1.18, 1);

      renderer.render(scene, camera);
    };

    animate();

    // ─── 8. Robust ResizeObserver for Responsive Viewport ───
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          if (w < 480) {
            camera.position.z = 5.4;
          } else {
            camera.position.z = 4.9;
          }
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container && dom) {
        container.removeChild(dom);
      }
    };
  }, []); // Run STRICTLY ONCE on mount — telemetry stream updates via ref without unmounting!

  return (
    <div style={{
      background: 'linear-gradient(180deg, #060b12 0%, #03060a 100%)',
      border: '1px solid #1a2530',
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
    }}>
      {/* ─── Top Technical Header Strip ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid #141e28',
        background: '#04080e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 800,
            fontFamily: 'monospace',
            padding: '2px 6px',
            borderRadius: 3,
            background: '#00e5ff',
            color: '#02050a',
            letterSpacing: '0.05em',
          }}>
            BIO-SCAN
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
            {crewNo} · {astronautName.toUpperCase()}
          </span>
          <span style={{ fontSize: 10, color: '#687e94', marginLeft: 4 }}>
            {astronautRole} · 10 Hz Telemetry Lock
          </span>
        </div>

        {/* View Snap & Control Buttons in Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* 1-Click View Angle Snap Buttons */}
          <button
            onClick={() => snapToAngle(0)}
            style={{
              background: '#09121a',
              border: '1px solid #1a2938',
              color: '#8da4ba',
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Front
          </button>
          <button
            onClick={() => snapToAngle(180)}
            style={{
              background: '#09121a',
              border: '1px solid #1a2938',
              color: '#8da4ba',
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
          <button
            onClick={() => snapToAngle(90)}
            style={{
              background: '#09121a',
              border: '1px solid #1a2938',
              color: '#8da4ba',
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Profile
          </button>
          <button
            onClick={handleResetCamera}
            style={{
              background: '#0d1d2b',
              border: '1px solid #00e5ff44',
              color: '#00e5ff',
              borderRadius: 3,
              padding: '3px 7px',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>

          <span style={{ width: 1, height: 14, background: '#1c2936', margin: '0 3px' }} />

          {/* Auto-Orbit Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            style={{
              background: autoRotate ? '#122a40' : '#09121a',
              border: `1px solid ${autoRotate ? '#00e5ff' : '#1a2938'}`,
              color: autoRotate ? '#00e5ff' : '#6b7f94',
              borderRadius: 3,
              padding: '3px 8px',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {autoRotate ? '⏸ Orbit' : '▶ Orbit'}
          </button>

          {/* Laser Mode Toggle */}
          <button
            onClick={() => {
              setLaserMode(prev => prev === 'SWEEP' ? 'LOCK_ORGAN' : prev === 'LOCK_ORGAN' ? 'OFF' : 'SWEEP');
            }}
            style={{
              background: laserMode !== 'OFF' ? '#122a40' : '#09121a',
              border: `1px solid ${laserMode !== 'OFF' ? '#00e5ff' : '#1a2938'}`,
              color: laserMode !== 'OFF' ? '#00e5ff' : '#6b7f94',
              borderRadius: 3,
              padding: '3px 8px',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {laserMode === 'SWEEP' ? '⚡ Sweep' : laserMode === 'LOCK_ORGAN' ? '🎯 Lock' : 'Beam Off'}
          </button>

          <span style={{ width: 1, height: 14, background: '#1c2936', margin: '0 3px' }} />

          {/* Theme Mode Selector */}
          {(['CYAN', 'HEATMAP', 'AEROSPACE'] as const).map(t => (
            <button
              key={t}
              onClick={() => setColorTheme(t)}
              style={{
                background: colorTheme === t ? '#0d1f2d' : '#080d14',
                border: colorTheme === t ? '1px solid #00e5ff' : '1px solid #192735',
                color: colorTheme === t ? '#00e5ff' : '#6b7d90',
                borderRadius: 3,
                padding: '3px 7px',
                fontSize: 9,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t === 'CYAN' ? 'Cyan' : t === 'HEATMAP' ? 'Thermal' : 'HUD'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main 3D Viewport & Inspection Split Card (Height 490px Fits Entire Screen!) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', height: 490, maxHeight: 490 }}>
        {/* Left: 3D Holographic Canvas Viewport */}
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#02050a' }}>
          {/* WebGL Canvas Container */}
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

          {/* Tactical Viewport Overlays (Top Left) */}
          <div style={{
            position: 'absolute',
            top: 10,
            left: 12,
            pointerEvents: 'none',
            fontSize: 9,
            fontFamily: 'monospace',
            color: '#8cb3d9',
            lineHeight: 1.45,
          }}>
            <div style={{ color: '#00e5ff', fontWeight: 700 }}>
              ELEVATION: <span ref={elevationDomRef} style={{ color: '#ffffff', fontWeight: 700 }}>+0.70 m</span> · <span ref={sliceIndexDomRef} style={{ color: '#00e5ff' }}>SLICE #64</span>
            </div>
            <div>
              REGION: <span ref={regionDomRef} style={{ color: '#b5d5f5' }}>THORACIC / CARDIAC</span>
            </div>
            <div>
              SCAN BEAM:{' '}
              <span style={{ color: laserMode === 'OFF' ? '#8cb3d9' : '#00e5ff', fontWeight: 700 }}>
                {laserMode === 'SWEEP' ? 'ACTIVE SWEEP' : laserMode === 'LOCK_ORGAN' ? 'TARGET LOCK' : 'INACTIVE'}
              </span>
            </div>
            <div>
              AZIMUTH: <span ref={azimuthDomRef} style={{ color: '#ffffff', fontWeight: 700 }}>0°</span>
            </div>
          </div>

          {/* Tactical Viewport Overlays (Top Right) */}
          <div style={{
            position: 'absolute',
            top: 10,
            right: 12,
            pointerEvents: 'none',
            fontSize: 9,
            fontFamily: 'monospace',
            textAlign: 'right',
            color: '#8cb3d9',
            lineHeight: 1.45,
          }}>
            <div>SENSORS: 4/4 ACTIVE</div>
            <div style={{ color: isPilot ? '#e6a83c' : '#5ebd4c', fontWeight: 700 }}>
              {isPilot ? 'ANOMALY: ACTIVE EXCURSION (P1)' : 'ANOMALY: NOMINAL'}
            </div>
          </div>

          {/* Vertical Elevation Ruler (Left Edge) */}
          <div style={{
            position: 'absolute',
            top: 95,
            bottom: 25,
            left: 12,
            width: 28,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: 'monospace',
            fontSize: 8,
            color: '#7090b0',
            pointerEvents: 'none',
            borderLeft: '1px solid #1e3347',
            paddingLeft: 4,
          }}>
            <div style={{ position: 'relative' }}>
              <span>+1.5m</span>
              <span style={{ fontSize: 7, color: '#557595', display: 'block' }}>CRANIAL</span>
            </div>
            <div style={{ position: 'relative' }}>
              <span>+0.7m</span>
              <span style={{ fontSize: 7, color: '#557595', display: 'block' }}>THORACIC</span>
            </div>
            <div style={{ position: 'relative' }}>
              <span>+0.0m</span>
              <span style={{ fontSize: 7, color: '#557595', display: 'block' }}>PELVIC</span>
            </div>
            <div style={{ position: 'relative' }}>
              <span>-0.7m</span>
              <span style={{ fontSize: 7, color: '#557595', display: 'block' }}>FEMORAL</span>
            </div>
            <div style={{ position: 'relative' }}>
              <span>-1.5m</span>
              <span style={{ fontSize: 7, color: '#557595', display: 'block' }}>PLANTAR</span>
            </div>

            {/* Glowing pointer chevron tracking scan elevation */}
            <div
              ref={elevationRulerChevronRef}
              style={{
                position: 'absolute',
                left: -6,
                bottom: '50%',
                fontSize: 10,
                color: '#00e5ff',
                textShadow: '0 0 8px #00e5ff',
                transition: 'bottom 0.05s linear',
              }}
            >
              ▶
            </div>
          </div>

          {/* Interactive Hint at Bottom Left */}
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            pointerEvents: 'none',
            fontSize: 9,
            color: '#7295b8',
            fontFamily: 'monospace',
          }}>
            Drag to Rotate 360° · Scroll to Zoom · Click Hotspots
          </div>
        </div>

        {/* Right: Full Simultaneous Physiological Subsystems Panel */}
        <div style={{
          borderLeft: '1px solid #141e28',
          background: '#04080e',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#1c2f42 #050a10',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#7e96ad', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  PHYSIOLOGICAL SUBSYSTEMS
                </span>
                <span style={{ fontSize: 9, color: '#4a6075', fontFamily: 'monospace' }}>[4/4 TELEMETRY LINK]</span>
              </div>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 600 }}>● LIVE 10 Hz</span>
            </div>

            {/* Subsystems Stack - All 4 visible at once */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {hotspots.map(hs => {
                const isFocused = selectedHotspot === hs.id && laserMode === 'LOCK_ORGAN';
                const isSelected = selectedHotspot === hs.id;
                const isCrit = hs.severity === 'CRITICAL';
                const isWarn = hs.severity === 'WARNING';

                const cardBorder = isFocused
                  ? '1px solid #00e5ff'
                  : isCrit
                    ? '1px solid #7a2222'
                    : isWarn
                      ? '1px solid #7a5215'
                      : isSelected
                        ? '1px solid #00e5ff55'
                        : '1px solid #14202e';

                const cardBg = isFocused
                  ? 'linear-gradient(135deg, rgba(0,229,255,0.12) 0%, #07121b 100%)'
                  : isCrit
                    ? 'linear-gradient(135deg, rgba(255,59,48,0.08) 0%, #0d0606 100%)'
                    : isWarn
                      ? 'linear-gradient(135deg, rgba(255,170,0,0.06) 0%, #0d0905 100%)'
                      : '#070c13';

                return (
                  <div
                    key={hs.id}
                    onClick={() => {
                      setSelectedHotspot(hs.id);
                      setLaserMode('LOCK_ORGAN');
                      if (onSelectSubsystem) onSelectSubsystem(hs.id);
                    }}
                    style={{
                      background: cardBg,
                      border: cardBorder,
                      borderRadius: 5,
                      padding: '7px 9px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isFocused ? '0 0 12px rgba(0,229,255,0.16)' : 'none',
                    }}
                  >
                    {/* Header: Subsystem Title, Organ, Region & Status Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isCrit ? '#ff3b30' : isWarn ? '#ffaa00' : '#00e5ff',
                          boxShadow: `0 0 6px ${isCrit ? '#ff3b30' : isWarn ? '#ffaa00' : '#00e5ff'}`,
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
                          {hs.id}
                        </span>
                        <span style={{ fontSize: 9, color: '#6e869e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          · {hs.organ}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 8,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          padding: '1px 5px',
                          borderRadius: 2,
                          background: isCrit ? '#330d0d' : isWarn ? '#332008' : '#061c24',
                          color: isCrit ? '#ff4d4d' : isWarn ? '#ffbe3b' : '#00e5ff',
                          border: `1px solid ${isCrit ? '#661b1b' : isWarn ? '#66420c' : '#0d3c4e'}`,
                        }}>
                          {hs.severity}
                        </span>

                        <span style={{
                          fontSize: 8,
                          fontFamily: 'monospace',
                          padding: '1px 5px',
                          borderRadius: 2,
                          background: isFocused ? '#00e5ff' : '#0d1722',
                          color: isFocused ? '#02050a' : '#607b93',
                          border: `1px solid ${isFocused ? '#00e5ff' : '#1c2c3c'}`,
                          fontWeight: 700,
                        }}>
                          {isFocused ? '✓ LOCKED' : hs.region.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Metric Row */}
                    <div style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: isCrit ? '#ff7575' : isWarn ? '#ffd066' : '#e0f2fe',
                      marginBottom: 2,
                    }}>
                      {hs.metric}
                    </div>

                    {/* Clinical Finding */}
                    <div style={{ fontSize: 9, color: '#889eb3', lineHeight: 1.3, marginBottom: 4 }}>
                      {hs.detail}
                    </div>

                    {/* Protocol Action Line */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#04070c',
                      borderRadius: 3,
                      padding: '3px 6px',
                      borderLeft: `2px solid ${isCrit ? '#ff3b30' : isWarn ? '#ffaa00' : '#00e5ff'}`,
                    }}>
                      <span style={{ fontSize: 8, color: '#97adbf', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '82%' }}>
                        <strong style={{ color: '#5f7c96' }}>RX:</strong> {hs.protocol}
                      </span>
                      <span style={{
                        fontSize: 8,
                        color: isFocused ? '#00e5ff' : '#466075',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        flexShrink: 0,
                      }}>
                        {isFocused ? '● ACTIVE BEAM' : '🎯 TARGET'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Metadata */}
          <div style={{ borderTop: '1px solid #121c27', paddingTop: 6, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#4a5e72', fontFamily: 'monospace' }}>
            <span>STANDARD: NASA-STD-3001</span>
            <span>COHORT: OSDR INSPIRATION4</span>
          </div>
        </div>
      </div>
    </div>
  );
};
