import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import './DragonDockingIntro.css';

export interface UploadedModelItem {
  id: string;
  name: string;
  object: THREE.Object3D;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  visible: boolean;
}

export interface DragonDockingIntroProps {
  onEnterStation: () => void;
  onEnterDashboard?: () => void;
}

// -------------------------------------------------------------
// Procedural Web Audio Sound Generator for Authentic Space FX
// -------------------------------------------------------------
class DockingSoundEngine {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  public muted: boolean = false;

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Deep space ambient hum
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(54, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.muted ? 0 : 0.08, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);
      osc.start();
    } catch {
      // AudioContext unavailable or restricted before user gesture
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(m ? 0 : 0.08, this.ctx.currentTime);
    }
  }

  playRcsBurst() {
    if (this.muted || !this.ctx) return;
    try {
      // White noise thruster burst
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch {}
  }

  playLockChime() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [880, 1108, 1318].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.06, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.6);
      });
    } catch {}
  }
}

const soundEngine = new DockingSoundEngine();

// -------------------------------------------------------------
// 3D Earth Component with Rotating Sphere & Atmospheric Rim
// -------------------------------------------------------------
function EarthBackground() {
  const earthGroupRef = useRef<THREE.Group>(null);
  const [earthScene, setEarthScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load('/models/earth.glb', (gltf) => {
      const obj = gltf.scene;
      obj.scale.set(180, 180, 180);
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).roughness = 0.6;
            (mesh.material as THREE.MeshStandardMaterial).metalness = 0.05;
          }
        }
      });
      setEarthScene(obj);
    });
  }, []);

  useFrame((_, delta) => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y += delta * 0.015;
    }
  });

  return (
    <group position={[0, -280, -320]}>
      <group ref={earthGroupRef}>
        {earthScene ? (
          <primitive object={earthScene} />
        ) : (
          <mesh>
            <sphereGeometry args={[180, 64, 64]} />
            <meshStandardMaterial color="#1a4c8c" roughness={0.7} metalness={0.1} />
          </mesh>
        )}
      </group>
      {/* Subtle Atmospheric Rayleigh Rim Glow */}
      <mesh scale={[1.025, 1.025, 1.025]}>
        <sphereGeometry args={[180, 64, 64]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// ISS Model & International Docking Adapter (IDA-2) Target
// -------------------------------------------------------------
function SpaceStationISS({ isDocked }: { isDocked: boolean }) {
  const [issObj, setIssObj] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load('/models/iss.glb', (gltf) => {
      const obj = gltf.scene;
      obj.scale.set(4.2, 4.2, 4.2);
      obj.position.set(0, 0, 0);
      obj.rotation.set(0, Math.PI, 0);
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              m.envMapIntensity = 0.8;
              if (m.emissive) {
                m.emissiveIntensity = 0.4;
              }
            });
          }
        }
      });
      setIssObj(obj);
    });
  }, []);

  return (
    <group position={[0, 0, 0]}>
      {issObj && <primitive object={issObj} />}

      {/* ISS Forward Port: Harmony Node 2 Docking Port (IDA-2 / PMA-2) */}
      <group position={[0, 0.45, 15.6]}>
        {/* Docking Outer Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.2, 0.12, 16, 32]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Soft Capture Petals (3 Guide Fins) */}
        {[0, 120, 240].map((deg) => (
          <group key={deg} rotation={[0, 0, (deg * Math.PI) / 180]}>
            <mesh position={[0, 1.25, 0.2]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[0.28, 0.5, 0.06]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* Alignment Target Plate & Crosshair */}
        <mesh position={[0, 0, -0.05]}>
          <circleGeometry args={[0.95, 32]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        {/* Laser Alignment Crosshair Lines */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.6, 0.04]} />
          <meshBasicMaterial color={isDocked ? '#22c55e' : '#38bdf8'} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[0.04, 1.6]} />
          <meshBasicMaterial color={isDocked ? '#22c55e' : '#38bdf8'} />
        </mesh>

        {/* Flashing Docking Alignment Beacon LEDs */}
        <DockingBeaconLEDs isDocked={isDocked} />
      </group>
    </group>
  );
}

function DockingBeaconLEDs({ isDocked }: { isDocked: boolean }) {
  const ledRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (ledRef.current) {
      if (isDocked) {
        ledRef.current.color.setHex(0x22c55e);
        ledRef.current.intensity = 2.5;
      } else {
        const pulse = (Math.sin(clock.getElapsedTime() * 4.0) + 1) * 0.5;
        ledRef.current.color.setHex(0xf59e0b);
        ledRef.current.intensity = 0.5 + pulse * 2.0;
      }
    }
  });

  return (
    <group position={[0, 1.45, 0.1]}>
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={isDocked ? '#22c55e' : '#f59e0b'} />
      </mesh>
      <pointLight ref={ledRef} distance={8} decay={2} intensity={2} />
    </group>
  );
}

// -------------------------------------------------------------
// SpaceX Crew Dragon Component with PBR Materials & Textures
// -------------------------------------------------------------
function SpaceXDragon({
  position,
  rotation,
  rcsFiring,
}: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  rcsFiring: boolean;
}) {
  const [dragonObj, setDragonObj] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const texLoader = new THREE.TextureLoader();
    const flagTex = texLoader.load('/models/spacex/space-x-crew-dragon/textures/gltf_embedded_1.png');
    const spacexTex = texLoader.load('/models/spacex/space-x-crew-dragon/textures/gltf_embedded_2.png');
    const nasaTex = texLoader.load('/models/spacex/space-x-crew-dragon/textures/gltf_embedded_3.png');
    const tex0 = texLoader.load('/models/spacex/space-x-crew-dragon/textures/gltf_embedded_0.png');

    flagTex.flipY = false;
    spacexTex.flipY = false;
    nasaTex.flipY = false;
    tex0.flipY = false;

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('/models/spacex/space_x_crew_dragon.glb', (gltf) => {
      const obj = gltf.scene;
      // Real Crew Dragon is ~8m length, scaled naturally relative to station
      obj.scale.set(1.55, 1.55, 1.55);

      // In raw model, nose cone is +X. We rotate -90 deg Y so nose points +Z towards ISS docking port!
      obj.rotation.set(0, -Math.PI / 2, 0);

      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const m = mesh.material as THREE.MeshStandardMaterial;
          if (m) {
            const name = (m.name || '').toLowerCase();
            if (name === 'white') {
              // Glossy clean aerospace white capsule
              m.color.setHex(0xfafafa);
              m.roughness = 0.22;
              m.metalness = 0.08;
              if ((m as any).clearcoat !== undefined) {
                (m as any).clearcoat = 0.9;
                (m as any).clearcoatRoughness = 0.05;
              }
            } else if (name === 'black') {
              // Dark trunk composite tiles
              m.color.setHex(0x14161a);
              m.roughness = 0.45;
              m.metalness = 0.2;
            } else if (name === 'wglass') {
              // Tinted dark visor windows
              m.color.setHex(0x0c1018);
              m.roughness = 0.08;
              m.metalness = 0.85;
              m.transparent = true;
              m.opacity = 0.85;
            } else if (name.includes('flag') || name === 'us_flag') {
              m.map = flagTex;
              m.transparent = true;
              m.needsUpdate = true;
            } else if (name.includes('nasa') || name === 'logo_nasa') {
              m.map = nasaTex;
              m.transparent = true;
              m.needsUpdate = true;
            } else if (name.includes('spacex') || name === 'spacex_sign' || name.includes('dragon')) {
              m.map = spacexTex;
              m.transparent = true;
              m.needsUpdate = true;
            } else if (name === 'material_0') {
              m.map = tex0;
              m.needsUpdate = true;
            } else if (name === 'material_1') {
              m.map = flagTex;
              m.needsUpdate = true;
            } else if (name === 'material_2') {
              m.map = spacexTex;
              m.needsUpdate = true;
            } else if (name === 'material_3') {
              m.map = nasaTex;
              m.needsUpdate = true;
            } else if (name === 'material_4') {
              m.color.setHex(0x1e2126);
              m.roughness = 0.35;
              m.metalness = 0.65;
            }
          }
        }
      });
      setDragonObj(obj);
    });
  }, []);

  return (
    <group position={position.toArray()} rotation={rotation}>
      {dragonObj && <primitive object={dragonObj} />}

      {/* Realistic Draco RCS Thruster Plumes */}
      {rcsFiring && (
        <>
          <RcsPlume position={[1.4, 0.4, -0.6]} direction={[1, 0.5, 0]} />
          <RcsPlume position={[-1.4, 0.4, -0.6]} direction={[-1, 0.5, 0]} />
          <RcsPlume position={[0, 1.4, -0.8]} direction={[0, 1, 0.3]} />
          <RcsPlume position={[0, -1.4, -0.8]} direction={[0, -1, 0.3]} />
        </>
      )}

      {/* Docking Light on Dragon Nose */}
      <spotLight
        position={[0, 0, 1.8]}
        target-position={[0, 0, 15]}
        angle={0.5}
        penumbra={0.6}
        intensity={3.5}
        color="#e0f2fe"
        distance={45}
      />
    </group>
  );
}

function RcsPlume({ position, direction }: { position: [number, number, number]; direction: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = 0.7 + Math.random() * 0.6;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <coneGeometry args={[0.15, 0.6, 12]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// -------------------------------------------------------------
// Uploaded User Models Renderer
// -------------------------------------------------------------
function UploadedModelsLayer({ models }: { models: UploadedModelItem[] }) {
  return (
    <>
      {models
        .filter((m) => m.visible)
        .map((m) => (
          <primitive
            key={m.id}
            object={m.object}
            position={m.position}
            rotation={m.rotation.map((deg) => (deg * Math.PI) / 180) as [number, number, number]}
            scale={[m.scale, m.scale, m.scale]}
          />
        ))}
    </>
  );
}

// -------------------------------------------------------------
// Master Animation Controller & Camera Presets
// -------------------------------------------------------------
function FlightDirector({
  progress,
  cameraPreset,
  setFlightTelemetry,
  setRcsActive,
  setIsDocked,
}: {
  progress: number; // 0 to 1
  cameraPreset: 'cinematic' | 'chase' | 'docking' | 'wide' | 'orbit';
  setFlightTelemetry: (t: any) => void;
  setRcsActive: (active: boolean) => void;
  setIsDocked: (docked: boolean) => void;
}) {
  const { camera } = useThree();

  // Compute Dragon position along 4-Scene Trajectory:
  // Scene 1 (0.00 - 0.25): Orbit (X: -45 -> -20, Y: 12 -> 6, Z: 140 -> 90)
  // Scene 2 (0.25 - 0.50): V-Bar Approach (X: -20 -> -4, Y: 6 -> 1.5, Z: 90 -> 35)
  // Scene 3 (0.50 - 0.75): Position Alignment (X: -4 -> 0, Y: 1.5 -> 0.45, Z: 35 -> 22)
  // Scene 4 (0.75 - 1.00): Automatic Final Docking (X: 0, Y: 0.45, Z: 22 -> 16.9)
  const dragonPos = useMemo(() => new THREE.Vector3(), []);
  const dragonRot = useMemo(() => new THREE.Euler(), []);

  useFrame(() => {
    let x = 0, y = 0, z = 0;
    let pitch = 0, yaw = 0, roll = 0;
    let range = 0, vel = 0, alignErr = 0;
    let rcs = false;
    let docked = false;

    if (progress <= 0.25) {
      // Scene 1: Orbit
      const p = progress / 0.25;
      x = THREE.MathUtils.lerp(-55, -24, p);
      y = THREE.MathUtils.lerp(14, 5, p);
      z = THREE.MathUtils.lerp(155, 95, p);
      yaw = THREE.MathUtils.lerp(0.25, 0.12, p);
      pitch = THREE.MathUtils.lerp(-0.08, -0.02, p);
      roll = Math.sin(p * Math.PI) * 0.05;

      range = 155 - p * 60;
      vel = 0.45;
      alignErr = 1.4 - p * 0.5;
      rcs = false;
    } else if (progress <= 0.50) {
      // Scene 2: V-Bar Approach
      const p = (progress - 0.25) / 0.25;
      x = THREE.MathUtils.lerp(-24, -3.5, p);
      y = THREE.MathUtils.lerp(5, 1.2, p);
      z = THREE.MathUtils.lerp(95, 36, p);
      yaw = THREE.MathUtils.lerp(0.12, 0.04, p);
      pitch = THREE.MathUtils.lerp(-0.02, 0.0, p);
      roll = THREE.MathUtils.lerp(0.04, 0.01, p);

      range = 95 - p * 59;
      vel = 0.26;
      alignErr = 0.9 - p * 0.6;
      rcs = p > 0.6 && Math.sin(progress * 40) > 0.4;
    } else if (progress <= 0.75) {
      // Scene 3: Position Alignment & Stationkeeping
      const p = (progress - 0.50) / 0.25;
      x = THREE.MathUtils.lerp(-3.5, 0.0, p);
      y = THREE.MathUtils.lerp(1.2, 0.45, p);
      z = THREE.MathUtils.lerp(36, 22.0, p);
      // Subtle RCS micro-corrections
      yaw = THREE.MathUtils.lerp(0.04, 0.0, p) + Math.sin(p * 22) * 0.008;
      pitch = Math.cos(p * 18) * 0.006;
      roll = Math.sin(p * 15) * 0.005;

      range = 36 - p * 14;
      vel = 0.12;
      alignErr = Math.max(0.02, 0.3 - p * 0.28);
      rcs = Math.sin(progress * 50) > 0.2;
    } else {
      // Scene 4: Automatic Docking Contact (Target IDA-2 at Z = 15.6)
      const p = (progress - 0.75) / 0.25;
      x = 0;
      y = 0.45;
      z = THREE.MathUtils.lerp(22.0, 16.9, p);
      yaw = 0;
      pitch = 0;
      roll = 0;

      range = Math.max(0.0, (22.0 - 16.9) * (1 - p));
      vel = THREE.MathUtils.lerp(0.08, 0.0, p);
      alignErr = 0.01;
      rcs = p < 0.3 && Math.sin(progress * 30) > 0.5;
      docked = p >= 0.95;
    }

    dragonPos.set(x, y, z);
    dragonRot.set(pitch, yaw, roll);
    setRcsActive(rcs);
    setIsDocked(docked);

    setFlightTelemetry({
      range: range.toFixed(1),
      velocity: vel.toFixed(2),
      alignError: alignErr.toFixed(2),
      stage:
        progress <= 0.25
          ? 'ORBITAL RENDEZVOUS'
          : progress <= 0.50
          ? 'V-BAR APPROACH'
          : progress <= 0.75
          ? 'POSITION ALIGNMENT'
          : docked
          ? 'HARD CAPTURE VERIFIED'
          : 'AUTOMATIC DOCKING',
      docked,
    });

    // Camera Presets
    if (cameraPreset === 'orbit') {
      // Free orbit controls active
      return;
    }

    if (cameraPreset === 'chase') {
      // Smooth chase camera directly behind Crew Dragon looking towards ISS
      camera.position.lerp(new THREE.Vector3(x * 0.7, y + 2.5, z + 12), 0.08);
      camera.lookAt(new THREE.Vector3(x * 0.3, y, z - 10));
    } else if (cameraPreset === 'docking') {
      // Close-up docking port camera over Dragon nose looking into ISS target
      camera.position.lerp(new THREE.Vector3(0.6, 1.2, z - 2.8), 0.1);
      camera.lookAt(new THREE.Vector3(0, 0.45, 15.6));
    } else if (cameraPreset === 'wide') {
      // Epic wide shot showing Earth, Dragon, and ISS truss
      camera.position.lerp(new THREE.Vector3(-45, 28, 85), 0.05);
      camera.lookAt(new THREE.Vector3(0, 0, 30));
    } else {
      // Cinematic Director (Auto Choreographed)
      if (progress <= 0.25) {
        // Scene 1: Smooth tracking hero orbit shot
        const p = progress / 0.25;
        const camX = x - 12 - Math.sin(p * Math.PI) * 8;
        const camY = y + 4 + Math.cos(p * Math.PI) * 2;
        const camZ = z + 14 - p * 10;
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.06);
        camera.lookAt(new THREE.Vector3(x, y, z));
      } else if (progress <= 0.50) {
        // Scene 2: Wide cinematic tracking shot with Earth horizon in view
        const p = (progress - 0.25) / 0.25;
        const camX = THREE.MathUtils.lerp(-28, -14, p);
        const camY = THREE.MathUtils.lerp(12, 6, p);
        const camZ = THREE.MathUtils.lerp(80, 45, p);
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.06);
        camera.lookAt(new THREE.Vector3(x * 0.5, y * 0.5, z * 0.5));
      } else if (progress <= 0.75) {
        // Scene 3: Inspection alignment angle
        const p = (progress - 0.50) / 0.25;
        const camX = THREE.MathUtils.lerp(10, 4.5, p);
        const camY = THREE.MathUtils.lerp(4, 2.2, p);
        const camZ = THREE.MathUtils.lerp(28, 20, p);
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.07);
        camera.lookAt(new THREE.Vector3(0, 0.45, 17));
      } else {
        // Scene 4: Close-up docking latch contact shot
        const p = (progress - 0.75) / 0.25;
        const camX = THREE.MathUtils.lerp(3.2, 1.8, p);
        const camY = THREE.MathUtils.lerp(2.0, 1.1, p);
        const camZ = THREE.MathUtils.lerp(18.5, 17.8, p);
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
        camera.lookAt(new THREE.Vector3(0, 0.45, 16.2));
      }
    }
  });

  return <SpaceXDragon position={dragonPos} rotation={dragonRot} rcsFiring={false} />;
}

// -------------------------------------------------------------
// Main Component Export: DragonDockingIntro
// -------------------------------------------------------------
export const DragonDockingIntro: React.FC<DragonDockingIntroProps> = ({
  onEnterStation,
  onEnterDashboard,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [cameraPreset, setCameraPreset] = useState<'cinematic' | 'chase' | 'docking' | 'wide' | 'orbit'>('cinematic');
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const [flightTelemetry, setFlightTelemetry] = useState({
    range: '155.0',
    velocity: '0.45',
    alignError: '1.40',
    stage: 'ORBITAL RENDEZVOUS',
    docked: false,
  });
  const [rcsActive, setRcsActive] = useState<boolean>(false);
  const [isDocked, setIsDocked] = useState<boolean>(false);

  // Uploaded models collection
  const [uploadedModels, setUploadedModels] = useState<UploadedModelItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio initialization on first user interaction
  useEffect(() => {
    const handleGesture = () => {
      soundEngine.init();
      window.removeEventListener('click', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    return () => window.removeEventListener('click', handleGesture);
  }, []);

  // Sound triggers
  useEffect(() => {
    soundEngine.setMuted(soundMuted);
  }, [soundMuted]);

  useEffect(() => {
    if (rcsActive) {
      soundEngine.playRcsBurst();
    }
  }, [rcsActive]);

  useEffect(() => {
    if (isDocked) {
      soundEngine.playLockChime();
    }
  }, [isDocked]);

  // Main animation timer loop (60s total for full sequence at 1x speed)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (0.0016 / 60) * 60 * playbackSpeed;
        if (next >= 1.0) {
          setIsPlaying(false);
          return 1.0;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Handle 3D Model Upload (GLB, GLTF, OBJ)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase();

    const reader = new FileReader();
    if (ext === 'obj') {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        try {
          const loader = new OBJLoader();
          const obj = loader.parse(text);
          obj.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                color: 0x94a3b8,
                metalness: 0.5,
                roughness: 0.4,
              });
            }
          });
          const newItem: UploadedModelItem = {
            id: `model_${Date.now()}`,
            name: file.name,
            object: obj,
            position: [0, 4, 30],
            rotation: [0, 0, 0],
            scale: 1.0,
            visible: true,
          };
          setUploadedModels((prev) => [...prev, newItem]);
          setIsDrawerOpen(true);
        } catch (err) {
          console.error('Failed to parse OBJ file:', err);
          alert('Failed to parse OBJ file.');
        }
      };
      reader.readAsText(file);
    } else if (ext === 'glb' || ext === 'gltf') {
      reader.onload = (evt) => {
        const arrayBuf = evt.target?.result as ArrayBuffer;
        try {
          const loader = new GLTFLoader();
          loader.parse(arrayBuf, '', (gltf) => {
            const newItem: UploadedModelItem = {
              id: `model_${Date.now()}`,
              name: file.name,
              object: gltf.scene,
              position: [0, 4, 30],
              rotation: [0, 0, 0],
              scale: 1.0,
              visible: true,
            };
            setUploadedModels((prev) => [...prev, newItem]);
            setIsDrawerOpen(true);
          });
        } catch (err) {
          console.error('Failed to parse GLB/GLTF file:', err);
          alert('Failed to parse GLB/GLTF file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Supported 3D model formats: .glb, .gltf, .obj');
    }
  };

  const updateModelTransform = (
    id: string,
    key: 'position' | 'rotation' | 'scale',
    value: any,
    axisIdx?: number
  ) => {
    setUploadedModels((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (key === 'scale') {
          return { ...m, scale: value };
        }
        if (axisIdx !== undefined) {
          const copy = [...m[key]] as [number, number, number];
          copy[axisIdx] = value;
          return { ...m, [key]: copy };
        }
        return m;
      })
    );
  };

  const currentSceneIdx =
    progress <= 0.25 ? 1 : progress <= 0.50 ? 2 : progress <= 0.75 ? 3 : 4;

  const jumpToScene = (sceneNum: number) => {
    if (sceneNum === 1) setProgress(0.0);
    else if (sceneNum === 2) setProgress(0.255);
    else if (sceneNum === 3) setProgress(0.505);
    else if (sceneNum === 4) setProgress(0.755);
    setIsPlaying(true);
  };

  return (
    <div className="dragon-docking-container">
      {/* 3D WebGL Canvas Layer */}
      <div className="docking-canvas-wrapper">
        <Canvas
          shadows
          camera={{ fov: 48, near: 0.1, far: 4000, position: [-35, 15, 120] }}
          gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <color attach="background" args={['#010204']} />
          <ambientLight intensity={0.25} />
          {/* Main Sun Light with sharp space shadows */}
          <directionalLight
            position={[80, 120, 60]}
            intensity={4.2}
            color="#fffcf5"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={600}
            shadow-camera-left={-80}
            shadow-camera-right={80}
            shadow-camera-top={80}
            shadow-camera-bottom={-80}
          />
          {/* Earth-shine Soft Blue Fill */}
          <directionalLight position={[0, -100, -80]} intensity={1.2} color="#38bdf8" />

          {/* Starfield */}
          <Stars radius={600} depth={80} count={6000} factor={4} saturation={0.5} fade speed={0.4} />

          {/* Realistic 3D Earth */}
          <EarthBackground />

          {/* ISS with IDA-2 Docking Port Target */}
          <SpaceStationISS isDocked={isDocked} />

          {/* Master Flight Director & Animated Dragon */}
          <FlightDirector
            progress={progress}
            cameraPreset={cameraPreset}
            setFlightTelemetry={setFlightTelemetry}
            setRcsActive={setRcsActive}
            setIsDocked={setIsDocked}
          />

          {/* Uploaded User 3D Models */}
          <UploadedModelsLayer models={uploadedModels} />

          {/* Orbit Controls (Active only in 'Free Orbit' preset) */}
          {cameraPreset === 'orbit' && <OrbitControls enableDamping dampingFactor={0.05} />}
        </Canvas>
      </div>

      {/* Cinematic Film Vignette */}
      <div className="cinema-vignette" />

      {/* Top Header Bar */}
      <header className="docking-top-bar">
        <div className="nasa-spacex-badge">
          <span className="badge-tag">NASA // SPACEX</span>
          <span className="badge-title">CREW DRAGON ENDEAVOUR · EXPEDITION 71</span>
          <div className="badge-status">
            <span className="status-dot-pulse" />
            <span>IDA-2 DOCKING SEQUENCE</span>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="btn-telemetry"
            onClick={() => setSoundMuted(!soundMuted)}
            title="Toggle Audio Effects"
          >
            {soundMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}
          </button>

          <button
            className="btn-telemetry"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            title="Upload and Manage 3D Models"
          >
            📦 3D MODEL LAB {uploadedModels.length > 0 && `(${uploadedModels.length})`}
          </button>

          {onEnterDashboard && (
            <button className="btn-telemetry" onClick={onEnterDashboard}>
              📊 FLIGHT HUD
            </button>
          )}

          <button className="btn-enter-station" onClick={onEnterStation}>
            🚀 ENTER ISS CABIN &rarr;
          </button>
        </div>
      </header>

      {/* Left Telemetry Panel */}
      <div className="flight-telemetry-panel">
        <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
          APPROACH TELEMETRY
        </div>
        <div className="telemetry-row">
          <span className="telemetry-label">PHASE:</span>
          <span className="telemetry-val green">{flightTelemetry.stage}</span>
        </div>
        <div className="telemetry-row">
          <span className="telemetry-label">RANGE TO IDA-2:</span>
          <span className="telemetry-val">{flightTelemetry.range} m</span>
        </div>
        <div className="telemetry-row">
          <span className="telemetry-label">CLOSING VEL:</span>
          <span className="telemetry-val">+{flightTelemetry.velocity} m/s</span>
        </div>
        <div className="telemetry-row">
          <span className="telemetry-label">ANGULAR ERROR:</span>
          <span className="telemetry-val amber">{flightTelemetry.alignError}&deg;</span>
        </div>
        <div className="telemetry-row">
          <span className="telemetry-label">DRACO RCS:</span>
          <span className="telemetry-val green">{rcsActive ? 'FIRING BURST' : 'STANDBY'}</span>
        </div>
        <div className="telemetry-row">
          <span className="telemetry-label">CAPTURE LATCH:</span>
          <span className={`telemetry-val ${isDocked ? 'green' : 'amber'}`}>
            {isDocked ? 'HARD LOCK CONFIRMED' : 'SOFT ARMED'}
          </span>
        </div>
      </div>

      {/* Center Reticle (Visible during Scenes 2, 3, 4) */}
      {progress > 0.25 && (
        <div className="docking-center-hud">
          <div className={`reticle-ring ${isDocked ? 'locked' : ''}`}>
            <div className="reticle-inner-cross" />
          </div>
          <div className="hud-target-label">
            {isDocked ? 'TARGET CAPTURED · 0.00m' : `IDA-2 FORWARD PORT // ${flightTelemetry.range}m`}
          </div>
        </div>
      )}

      {/* Right Camera Presets Bar */}
      <div className="camera-presets-bar">
        <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1, marginBottom: 4 }}>
          CAMERA VIEWS
        </div>
        <button
          className={`preset-btn ${cameraPreset === 'cinematic' ? 'active' : ''}`}
          onClick={() => setCameraPreset('cinematic')}
        >
          🎥 CINEMATIC DIRECTOR
        </button>
        <button
          className={`preset-btn ${cameraPreset === 'chase' ? 'active' : ''}`}
          onClick={() => setCameraPreset('chase')}
        >
          🛰️ CHASE CAM
        </button>
        <button
          className={`preset-btn ${cameraPreset === 'docking' ? 'active' : ''}`}
          onClick={() => setCameraPreset('docking')}
        >
          🎯 DOCKING PORT CAM
        </button>
        <button
          className={`preset-btn ${cameraPreset === 'wide' ? 'active' : ''}`}
          onClick={() => setCameraPreset('wide')}
        >
          🌍 ORBITAL WIDE
        </button>
        <button
          className={`preset-btn ${cameraPreset === 'orbit' ? 'active' : ''}`}
          onClick={() => setCameraPreset('orbit')}
        >
          🎮 FREE ORBIT CONTROLS
        </button>
      </div>

      {/* Bottom Timeline & Controls */}
      <footer className="docking-bottom-timeline">
        <div className="timeline-top-controls">
          <div className="scene-tabs">
            <button
              className={`scene-tab-btn ${currentSceneIdx === 1 ? 'active' : ''}`}
              onClick={() => jumpToScene(1)}
            >
              1 · ORBIT
            </button>
            <button
              className={`scene-tab-btn ${currentSceneIdx === 2 ? 'active' : ''}`}
              onClick={() => jumpToScene(2)}
            >
              2 · APPROACH
            </button>
            <button
              className={`scene-tab-btn ${currentSceneIdx === 3 ? 'active' : ''}`}
              onClick={() => jumpToScene(3)}
            >
              3 · ALIGNMENT
            </button>
            <button
              className={`scene-tab-btn ${currentSceneIdx === 4 ? 'active' : ''}`}
              onClick={() => jumpToScene(4)}
            >
              4 · DOCKING
            </button>
          </div>

          <div className="playback-buttons">
            <button
              className="control-icon-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
            <button
              className="control-icon-btn"
              onClick={() => {
                setProgress(0);
                setIsPlaying(true);
              }}
              title="Restart"
            >
              ↺ RESTART
            </button>

            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>SPEED:</span>
            <select
              className="speed-select"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            >
              <option value="0.5">0.5x</option>
              <option value="1.0">1.0x</option>
              <option value="2.0">2.0x</option>
              <option value="4.0">4.0x</option>
            </select>
          </div>
        </div>

        <div className="timeline-slider-row">
          <span className="timeline-time-label">
            MET {Math.floor(progress * 60)}s
          </span>
          <input
            type="range"
            className="timeline-slider"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => {
              setProgress(parseFloat(e.target.value));
              setIsPlaying(false);
            }}
          />
          <span className="timeline-time-label" style={{ textAlign: 'right' }}>
            {(progress * 100).toFixed(0)}%
          </span>
        </div>
      </footer>

      {/* Model Upload & Controls Drawer */}
      {isDrawerOpen && (
        <aside className="model-manager-drawer">
          <div className="drawer-header">
            <span className="drawer-title">3D MODEL STUDIO (GLB / GLTF / OBJ)</span>
            <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}>
              &times;
            </button>
          </div>

          <div
            className="dropzone-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-text">
              📁 Click or drag .GLB, .GLTF, or .OBJ models here
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,.obj"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

          {uploadedModels.length === 0 ? (
            <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', margin: '12px 0' }}>
              No custom models uploaded. Upload any spacecraft or satellite model to position it in orbit!
            </div>
          ) : (
            uploadedModels.map((m) => (
              <div key={m.id} className="model-item-card">
                <div className="model-item-header">
                  <span style={{ color: '#f8fafc' }}>{m.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: m.visible ? '#22c55e' : '#64748b',
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                      onClick={() =>
                        setUploadedModels((prev) =>
                          prev.map((x) => (x.id === m.id ? { ...x, visible: !x.visible } : x))
                        )
                      }
                    >
                      {m.visible ? '👁 SHOW' : 'HIDE'}
                    </button>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                      onClick={() =>
                        setUploadedModels((prev) => prev.filter((x) => x.id !== m.id))
                      }
                    >
                      DELETE
                    </button>
                  </div>
                </div>

                {/* Position Controls */}
                <div className="transform-control-row">
                  <label>POS X:</label>
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    value={m.position[0]}
                    onChange={(e) =>
                      updateModelTransform(m.id, 'position', parseFloat(e.target.value), 0)
                    }
                  />
                  <span>{m.position[0]}m</span>
                </div>
                <div className="transform-control-row">
                  <label>POS Y:</label>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={m.position[1]}
                    onChange={(e) =>
                      updateModelTransform(m.id, 'position', parseFloat(e.target.value), 1)
                    }
                  />
                  <span>{m.position[1]}m</span>
                </div>
                <div className="transform-control-row">
                  <label>POS Z:</label>
                  <input
                    type="range"
                    min={-50}
                    max={120}
                    value={m.position[2]}
                    onChange={(e) =>
                      updateModelTransform(m.id, 'position', parseFloat(e.target.value), 2)
                    }
                  />
                  <span>{m.position[2]}m</span>
                </div>

                {/* Rotation Controls */}
                <div className="transform-control-row">
                  <label>YAW:</label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={m.rotation[1]}
                    onChange={(e) =>
                      updateModelTransform(m.id, 'rotation', parseFloat(e.target.value), 1)
                    }
                  />
                  <span>{m.rotation[1]}&deg;</span>
                </div>

                {/* Scale Controls */}
                <div className="transform-control-row">
                  <label>SCALE:</label>
                  <input
                    type="range"
                    min={0.1}
                    max={8.0}
                    step={0.1}
                    value={m.scale}
                    onChange={(e) =>
                      updateModelTransform(m.id, 'scale', parseFloat(e.target.value))
                    }
                  />
                  <span>{m.scale.toFixed(1)}x</span>
                </div>
              </div>
            ))
          )}
        </aside>
      )}

      {/* Docking Hard Capture Success Banner */}
      {isDocked && (
        <div className="docking-complete-banner">
          <div className="docking-complete-title">HARD CAPTURE COMPLETE · ALL HOOKS ENGAGED</div>
          <div className="docking-complete-subtitle">
            IDA-2 VESTIBULE PRESSURIZATION NOMINAL // EXPEDITION 71 WELCOMES DRAGON CREW
          </div>
          <button className="btn-enter-station" style={{ margin: '0 auto' }} onClick={onEnterStation}>
            🚀 ENTER ISS INTERIOR &rarr;
          </button>
        </div>
      )}
    </div>
  );
};

export default DragonDockingIntro;

