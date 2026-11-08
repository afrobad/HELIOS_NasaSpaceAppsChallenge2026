/**
 * NASA Spaceflight Holographic Vascular & Anatomical Geometry
 *
 * Generates:
 * 1. High-density celestial stardust point cloud (SMPL base silhouette)
 * 2. Complete arterial vascular network (cerebral, carotid, aortic, brachial, iliac, femoral, tibial)
 * 3. Hot pink / magenta cardiac myocardium node
 */

/**
 * Generate a dense, luminous celestial stardust point cloud from base anatomy
 */
export function generateStardustPointCloud(
  baseVertices: Float32Array,
  lineIndices: Uint16Array,
  count = 3200
): Float32Array {
  const total = (baseVertices.length / 3) + count;
  const out = new Float32Array(total * 3);

  // Copy base vertices
  out.set(baseVertices, 0);

  let offset = baseVertices.length;
  const numEdges = lineIndices.length / 2;

  // Simple deterministic pseudorandom seed
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < count; i++) {
    const edgeIdx = Math.floor(rand() * numEdges);
    const i1 = lineIndices[edgeIdx * 2] * 3;
    const i2 = lineIndices[edgeIdx * 2 + 1] * 3;

    const t = rand();
    const jitter = (rand() - 0.5) * 0.016;

    out[offset++] = baseVertices[i1] * (1 - t) + baseVertices[i2] * t + jitter;
    out[offset++] = baseVertices[i1 + 1] * (1 - t) + baseVertices[i2 + 1] * t + jitter;
    out[offset++] = baseVertices[i1 + 2] * (1 - t) + baseVertices[i2 + 2] * t + jitter;
  }

  return out;
}

/**
 * Arterial Vascular Network Line Segments
 */
export function getVascularLineSegments(): Float32Array {
  const segments: number[] = [];

  const addLine = (
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ) => {
    segments.push(x1, y1, z1, x2, y2, z2);
  };

  // 1. Cerebral Circle of Willis in skull (circular loop at top)
  const steps = 18;
  const rad = 0.06;
  const cy = 1.30;
  const cz = 0.02;
  for (let i = 0; i < steps; i++) {
    const a1 = (i / steps) * Math.PI * 2;
    const a2 = ((i + 1) / steps) * Math.PI * 2;
    addLine(
      Math.sin(a1) * rad, cy + Math.cos(a1) * 0.04, cz + Math.sin(a1) * 0.02,
      Math.sin(a2) * rad, cy + Math.cos(a2) * 0.04, cz + Math.sin(a2) * 0.02
    );
  }

  // Cross cranial branches
  addLine(-rad * 0.6, cy + 0.02, cz, 0, cy + 0.04, cz + 0.01);
  addLine(rad * 0.6, cy + 0.02, cz, 0, cy + 0.04, cz + 0.01);
  addLine(0, cy - 0.04, cz, -rad * 0.5, cy + 0.01, cz);
  addLine(0, cy - 0.04, cz, rad * 0.5, cy + 0.01, cz);

  // 2. Carotid Arteries down neck
  addLine(-0.025, 1.25, 0.02, -0.030, 1.05, 0.03);
  addLine(-0.030, 1.05, 0.03, -0.030, 0.90, 0.04);

  addLine(0.025, 1.25, 0.02, 0.030, 1.05, 0.03);
  addLine(0.030, 1.05, 0.03, 0.030, 0.90, 0.04);

  // 3. Aortic Arch & Descending Aorta down trunk
  addLine(-0.030, 0.90, 0.04, 0.0, 0.93, 0.05);
  addLine(0.0, 0.93, 0.05, 0.030, 0.90, 0.04);
  addLine(0.0, 0.93, 0.05, -0.06, 0.74, 0.10); // Branch to heart myocardium

  addLine(0.0, 0.90, 0.04, 0.01, 0.70, 0.03);
  addLine(0.01, 0.70, 0.03, -0.01, 0.45, 0.03);
  addLine(-0.01, 0.45, 0.03, 0.01, 0.20, 0.02);
  addLine(0.01, 0.20, 0.02, 0.0, -0.05, 0.02);
  addLine(0.0, -0.05, 0.02, 0.0, -0.20, 0.01);

  // Renal branches left & right
  addLine(0.0, 0.18, 0.02, -0.10, 0.18, 0.03);
  addLine(0.0, 0.18, 0.02, 0.10, 0.18, 0.03);

  // 4. Arms — Subclavian, Brachial, Radial, Ulnar (strictly nested inside arm volume)
  // Right Arm (viewer left x < 0)
  addLine(0.0, 0.90, 0.04, -0.14, 0.85, 0.03);
  addLine(-0.14, 0.85, 0.03, -0.24, 0.78, 0.02); // Shoulder
  addLine(-0.24, 0.78, 0.02, -0.27, 0.52, 0.01); // Upper arm / brachial
  addLine(-0.27, 0.52, 0.01, -0.30, 0.28, 0.01); // Elbow
  addLine(-0.30, 0.28, 0.01, -0.32, 0.08, 0.02); // Radial
  addLine(-0.30, 0.28, 0.01, -0.28, 0.08, 0.01); // Ulnar
  addLine(-0.32, 0.08, 0.02, -0.30, -0.06, 0.02); // Palmar arch
  addLine(-0.28, 0.08, 0.01, -0.30, -0.06, 0.02);

  // Left Arm (viewer right x > 0)
  addLine(0.0, 0.90, 0.04, 0.14, 0.85, 0.03);
  addLine(0.14, 0.85, 0.03, 0.24, 0.78, 0.02);  // Shoulder
  addLine(0.24, 0.78, 0.02, 0.27, 0.52, 0.01);  // Upper arm / brachial
  addLine(0.27, 0.52, 0.01, 0.30, 0.28, 0.01);  // Elbow
  addLine(0.30, 0.28, 0.01, 0.32, 0.08, 0.02);  // Radial
  addLine(0.30, 0.28, 0.01, 0.28, 0.08, 0.01);  // Ulnar
  addLine(0.32, 0.08, 0.02, 0.30, -0.06, 0.02);  // Palmar arch
  addLine(0.28, 0.08, 0.01, 0.30, -0.06, 0.02);

  // 5. Legs — Iliac, Femoral, Popliteal, Tibial (strictly nested inside thigh and calf volume)
  // Right Leg (x < 0)
  addLine(0.0, -0.20, 0.01, -0.07, -0.32, 0.02); // Common iliac
  addLine(-0.07, -0.32, 0.02, -0.10, -0.45, 0.02);
  addLine(-0.10, -0.45, 0.02, -0.11, -0.65, 0.03); // Femoral
  addLine(-0.11, -0.65, 0.03, -0.10, -0.85, 0.02); // Knee / popliteal
  addLine(-0.10, -0.85, 0.02, -0.095, -1.05, 0.03); // Anterior tibial
  addLine(-0.10, -0.85, 0.02, -0.090, -1.05, 0.01); // Posterior tibial
  addLine(-0.095, -1.05, 0.03, -0.090, -1.30, 0.02); // Ankle
  addLine(-0.090, -1.05, 0.01, -0.085, -1.30, 0.01);
  addLine(-0.090, -1.30, 0.02, -0.095, -1.55, 0.04); // Foot / dorsalis pedis
  addLine(-0.085, -1.30, 0.01, -0.095, -1.55, 0.04);

  // Left Leg (x > 0)
  addLine(0.0, -0.20, 0.01, 0.07, -0.32, 0.02);  // Common iliac
  addLine(0.07, -0.32, 0.02, 0.10, -0.45, 0.02);
  addLine(0.10, -0.45, 0.02, 0.11, -0.65, 0.03);  // Femoral
  addLine(0.11, -0.65, 0.03, 0.10, -0.85, 0.02);  // Knee / popliteal
  addLine(0.10, -0.85, 0.02, 0.095, -1.05, 0.03); // Anterior tibial
  addLine(0.10, -0.85, 0.02, 0.090, -1.05, 0.01); // Posterior tibial
  addLine(0.095, -1.05, 0.03, 0.090, -1.30, 0.02); // Ankle
  addLine(0.090, -1.05, 0.01, 0.085, -1.30, 0.01);
  addLine(0.090, -1.30, 0.02, 0.095, -1.55, 0.04); // Foot / dorsalis pedis
  addLine(0.085, -1.30, 0.01, 0.095, -1.55, 0.04);

  return new Float32Array(segments);
}

/**
 * Arterial Vascular Glowing Nodes along the Vessels
 */
export function getVascularPoints(): Float32Array {
  const pts: number[] = [];
  const lines = getVascularLineSegments();
  for (let i = 0; i < lines.length; i += 6) {
    const x1 = lines[i];
    const y1 = lines[i + 1];
    const z1 = lines[i + 2];
    const x2 = lines[i + 3];
    const y2 = lines[i + 4];
    const z2 = lines[i + 5];

    // Place 3 points along each segment
    for (const t of [0.15, 0.5, 0.85]) {
      pts.push(
        x1 * (1 - t) + x2 * t,
        y1 * (1 - t) + y2 * t,
        z1 * (1 - t) + z2 * t
      );
    }
  }
  return new Float32Array(pts);
}

/**
 * Pulsing Pink/Magenta Myocardium Node Particles
 */
export function getHeartPoints(): Float32Array {
  const pts: number[] = [];
  // Center: [-0.07, 0.74, 0.12]
  const cx = -0.07;
  const cy = 0.74;
  const cz = 0.12;

  // Heart-shaped parametric distribution
  const count = 55;
  for (let i = 0; i < count; i++) {
    const u = (i / count) * Math.PI * 2;
    // 2D heart curve
    const hx = 0.045 * (16 * Math.pow(Math.sin(u), 3)) / 16;
    const hy = 0.045 * (13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) / 16;
    const hz = ((i % 5) - 2) * 0.012;

    pts.push(cx + hx, cy + hy, cz + hz);
  }

  return new Float32Array(pts);
}

/**
 * Authentic 3D Anatomical Human Skeleton Line Segments
 * Includes:
 * 1. Skull cranial vault & mandible
 * 2. Cervical, thoracic, lumbar spine with transverse vertebral discs
 * 3. Clavicles & Sternum
 * 4. 10 bilateral rib cage loops surrounding thoracic cavity & heart
 * 5. Pelvic girdle (iliac crests, sacrum, pubic symphysis, acetabula)
 * 6. Upper limbs (humerus, radius, ulna, metacarpals)
 * 7. Lower limbs (femurs with trochanters, patellae, tibiae, fibulae, tarsals)
 */
export function getSkeletonLineSegments(): Float32Array {
  const segments: number[] = [];

  const addLine = (
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ) => {
    segments.push(x1, y1, z1, x2, y2, z2);
  };

  // 1. Cranium / Skull Contour
  // Cranial Vault Ellipse
  const skullSteps = 24;
  const skRx = 0.076;
  const skRz = 0.088;
  const skCy = 1.34;
  for (let i = 0; i < skullSteps; i++) {
    const a1 = (i / skullSteps) * Math.PI * 2;
    const a2 = ((i + 1) / skullSteps) * Math.PI * 2;
    addLine(
      Math.sin(a1) * skRx, skCy + Math.cos(a1) * 0.06, Math.cos(a1) * skRz * 0.4,
      Math.sin(a2) * skRx, skCy + Math.cos(a2) * 0.06, Math.cos(a2) * skRz * 0.4
    );
    // Horizontal cranial ring
    addLine(
      Math.sin(a1) * skRx, skCy, Math.cos(a1) * skRz,
      Math.sin(a2) * skRx, skCy, Math.cos(a2) * skRz
    );
  }
  // Sagittal cranial arc (from brow over crown to occiput)
  const arcSteps = 16;
  for (let i = 0; i < arcSteps; i++) {
    const t1 = (i / arcSteps) * Math.PI;
    const t2 = ((i + 1) / arcSteps) * Math.PI;
    addLine(
      0, skCy + Math.sin(t1) * 0.11, Math.cos(t1) * skRz,
      0, skCy + Math.sin(t2) * 0.11, Math.cos(t2) * skRz
    );
  }
  // Mandible / Jaw arch
  addLine(-0.055, 1.25, -0.01, -0.045, 1.18, 0.04);
  addLine(-0.045, 1.18, 0.04, 0.0, 1.16, 0.065); // Chin
  addLine(0.0, 1.16, 0.065, 0.045, 1.18, 0.04);
  addLine(0.045, 1.18, 0.04, 0.055, 1.25, -0.01);

  // 2. Vertebral Column / Spine with Transverse Processes
  const spineYStart = 1.25; // C1 Atlas
  const spineYEnd = -0.25;  // Coccyx
  const vertebraeCount = 28;
  for (let i = 0; i < vertebraeCount; i++) {
    const frac = i / (vertebraeCount - 1);
    const y1 = spineYStart * (1 - frac) + spineYEnd * frac;
    const nextFrac = (i + 1) / (vertebraeCount - 1);
    const y2 = spineYStart * (1 - nextFrac) + spineYEnd * nextFrac;

    // Natural spinal curvature (cervical lordosis, thoracic kyphosis, lumbar lordosis)
    const z1 = -0.01 + Math.sin(frac * Math.PI * 2.5) * 0.025;
    const z2 = -0.01 + Math.sin(nextFrac * Math.PI * 2.5) * 0.025;

    // Main vertebral canal line
    addLine(0, y1, z1, 0, y2, z2);

    // Transverse processes (vertebra horizontal bars)
    const barWidth = 0.018 + 0.024 * Math.sin(frac * Math.PI);
    addLine(-barWidth, y1, z1, barWidth, y1, z1);
  }

  // 3. Clavicles & Sternum
  // Left and Right Clavicles arching out to shoulders
  addLine(0, 0.98, 0.06, -0.10, 0.99, 0.04);
  addLine(-0.10, 0.99, 0.04, -0.22, 0.96, 0.01);
  addLine(0, 0.98, 0.06, 0.10, 0.99, 0.04);
  addLine(0.10, 0.99, 0.04, 0.22, 0.96, 0.01);

  // Sternum down anterior chest
  addLine(0, 0.98, 0.06, 0, 0.88, 0.08); // Manubrium
  addLine(0, 0.88, 0.08, 0, 0.68, 0.09); // Sternal body to xiphoid

  // 4. Thoracic Rib Cage (9 Bilateral Curved Ribs)
  const ribConfigs = [
    { y: 0.92, lateralSpan: 0.13, zMax: 0.07 },
    { y: 0.88, lateralSpan: 0.155, zMax: 0.085 },
    { y: 0.84, lateralSpan: 0.170, zMax: 0.092 },
    { y: 0.80, lateralSpan: 0.175, zMax: 0.095 },
    { y: 0.76, lateralSpan: 0.175, zMax: 0.095 },
    { y: 0.72, lateralSpan: 0.170, zMax: 0.092 },
    { y: 0.68, lateralSpan: 0.160, zMax: 0.088 },
    { y: 0.64, lateralSpan: 0.145, zMax: 0.082 },
    { y: 0.60, lateralSpan: 0.130, zMax: 0.075 },
  ];

  ribConfigs.forEach(cfg => {
    const numRibPts = 7;
    // Generate Right Rib (viewer left x < 0) and Left Rib (viewer right x > 0)
    for (const side of [-1, 1]) {
      let prevX = side * 0.015;
      let prevY = cfg.y;
      let prevZ = -0.02;

      for (let p = 1; p <= numRibPts; p++) {
        const u = p / numRibPts; // 0 (spine) to 1 (sternum)
        // Angle sweeping around thoracic perimeter
        const angle = u * Math.PI;
        const curX = side * Math.sin(angle) * cfg.lateralSpan;
        const curY = cfg.y - u * 0.045;
        const curZ = -0.02 * (1 - u) + cfg.zMax * Math.sin(angle * 0.85);

        addLine(prevX, prevY, prevZ, curX, curY, curZ);
        prevX = curX;
        prevY = curY;
        prevZ = curZ;
      }
      // Connect anterior rib end to sternum line
      addLine(prevX, prevY, prevZ, 0, prevY - 0.01, 0.08);
    }
  });

  // 5. Pelvic Girdle (Iliac Wings, Sacrum, Pubic Arch, Acetabula)
  for (const side of [-1, 1]) {
    // Iliac crest arch from posterior sacrum upward-outward and around to ASIS
    addLine(side * 0.02, -0.08, -0.02, side * 0.10, -0.06, -0.01);
    addLine(side * 0.10, -0.06, -0.01, side * 0.17, -0.09, 0.02); // Iliac crest peak
    addLine(side * 0.17, -0.09, 0.02, side * 0.15, -0.18, 0.04);  // ASIS
    addLine(side * 0.15, -0.18, 0.04, side * 0.11, -0.24, 0.02);  // Acetabulum rim
    addLine(side * 0.11, -0.24, 0.02, side * 0.03, -0.27, 0.05);  // Pubic crest
    addLine(side * 0.03, -0.27, 0.05, 0, -0.28, 0.055);           // Pubic symphysis midline

    // Ischial ring down to ischial tuberosity
    addLine(side * 0.11, -0.24, 0.02, side * 0.08, -0.32, -0.02); // Ischium
    addLine(side * 0.08, -0.32, -0.02, side * 0.03, -0.27, 0.05); // Ischiopubic ramus

    // Pelvic brim internal ring
    addLine(0, -0.14, -0.02, side * 0.08, -0.18, 0.0);
    addLine(side * 0.08, -0.18, 0.0, side * 0.04, -0.24, 0.04);
  }

  // 6. Upper Limb Bones (Humerus, Radius, Ulna, Metacarpal Rays)
  for (const side of [-1, 1]) {
    const shX = side * 0.22;
    const elX = side * 0.28;
    const wrX = side * 0.30;

    // Humerus (shoulder to elbow)
    addLine(shX, 0.94, 0.01, elX, 0.52, 0.01);
    // Humerus head flare
    addLine(shX - side * 0.02, 0.95, 0.02, shX + side * 0.02, 0.93, 0.0);

    // Elbow joint cross
    addLine(elX - 0.02, 0.52, 0.01, elX + 0.02, 0.52, 0.01);

    // Radius (lateral) & Ulna (medial)
    addLine(elX, 0.52, 0.01, wrX + side * 0.015, 0.18, 0.02); // Radius
    addLine(elX, 0.52, 0.01, wrX - side * 0.015, 0.18, 0.00); // Ulna

    // Wrist carpal cluster
    addLine(wrX - 0.02, 0.18, 0.01, wrX + 0.02, 0.18, 0.01);

    // Metacarpal rays to hand
    for (let f = -2; f <= 2; f++) {
      const fX = wrX + f * 0.008;
      addLine(wrX, 0.18, 0.01, fX, 0.02, 0.01 + f * 0.003);
    }
  }

  // 7. Lower Limb Bones (Femur with Trochanter, Patella, Tibia, Fibula, Tarsals)
  for (const side of [-1, 1]) {
    const hipX = side * 0.11;
    const troX = side * 0.16;
    const knX = side * 0.10;
    const ankX = side * 0.095;

    // Femoral neck (acetabulum to greater trochanter)
    addLine(hipX, -0.24, 0.02, troX, -0.28, 0.01);

    // Femur shaft (trochanter to knee)
    addLine(troX, -0.28, 0.01, knX, -0.85, 0.02);

    // Greater trochanter flare
    addLine(troX, -0.28, 0.01, troX - side * 0.02, -0.34, 0.01);

    // Patella / Kneecap diamond
    addLine(knX, -0.82, 0.045, knX + 0.015, -0.85, 0.045);
    addLine(knX + 0.015, -0.85, 0.045, knX, -0.88, 0.045);
    addLine(knX, -0.88, 0.045, knX - 0.015, -0.85, 0.045);
    addLine(knX - 0.015, -0.85, 0.045, knX, -0.82, 0.045);

    // Knee joint condyle line
    addLine(knX - 0.035, -0.85, 0.02, knX + 0.035, -0.85, 0.02);

    // Tibia (thick medial shin bone)
    addLine(knX, -0.87, 0.02, ankX, -1.35, 0.02);

    // Fibula (lateral slender calf bone)
    addLine(knX + side * 0.032, -0.89, 0.01, ankX + side * 0.025, -1.35, 0.01);

    // Ankle malleolar cross
    addLine(ankX - 0.025, -1.35, 0.015, ankX + side * 0.03, -1.35, 0.015);

    // Tarsals and Metatarsal arch down to foot base
    addLine(ankX, -1.35, 0.015, ankX, -1.45, -0.03); // Calcaneus (heel)
    addLine(ankX, -1.35, 0.015, ankX, -1.52, 0.04);  // Midfoot arch
    addLine(ankX, -1.52, 0.04, ankX - 0.01, -1.58, 0.08); // Medial toe ray
    addLine(ankX, -1.52, 0.04, ankX + 0.01, -1.58, 0.07); // Lateral toe ray
  }

  return new Float32Array(segments);
}

/**
 * Skeletal Glowing Joint & Node Points
 */
export function getSkeletonPoints(): Float32Array {
  const pts: number[] = [];
  const lines = getSkeletonLineSegments();
  for (let i = 0; i < lines.length; i += 6) {
    // Put a point at the start of each skeletal segment
    pts.push(lines[i], lines[i + 1], lines[i + 2]);
  }
  return new Float32Array(pts);
}

/**
 * Cranial Neural Network Brain Nodes & Synaptic Web
 */
export function getBrainNeuralNetwork(): { lines: Float32Array; points: Float32Array } {
  const pts: number[] = [];
  const lines: number[] = [];

  // Cranial center: (0, 1.34, 0.01)
  const cx = 0;
  const cy = 1.34;
  const cz = 0.01;
  const rx = 0.062;
  const ry = 0.072;
  const rz = 0.076;

  // Deterministic seed for reproducible brain nodes
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const nodeCount = 95;
  const rawNodes: Array<[number, number, number]> = [];

  for (let i = 0; i < nodeCount; i++) {
    // Hemispheric distribution with medial longitudinal fissure gap
    const hemisphere = i % 2 === 0 ? 1 : -1;
    const u = rand() * Math.PI * 2;
    const v = (rand() - 0.5) * Math.PI;
    const rad = 0.35 + 0.65 * Math.cbrt(rand());

    const nx = cx + hemisphere * (0.012 + Math.cos(v) * Math.cos(u) * rx * rad);
    const ny = cy + Math.sin(v) * ry * rad;
    const nz = cz + Math.cos(v) * Math.sin(u) * rz * rad;

    rawNodes.push([nx, ny, nz]);
    pts.push(nx, ny, nz);
  }

  // Connect nearby synapses within threshold distance
  const maxSynapseDist = 0.038;
  for (let i = 0; i < rawNodes.length; i++) {
    let connections = 0;
    for (let j = i + 1; j < rawNodes.length; j++) {
      const dx = rawNodes[i][0] - rawNodes[j][0];
      const dy = rawNodes[i][1] - rawNodes[j][1];
      const dz = rawNodes[i][2] - rawNodes[j][2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < maxSynapseDist && connections < 3) {
        lines.push(
          rawNodes[i][0], rawNodes[i][1], rawNodes[i][2],
          rawNodes[j][0], rawNodes[j][1], rawNodes[j][2]
        );
        connections++;
      }
    }
  }

  return {
    points: new Float32Array(pts),
    lines: new Float32Array(lines),
  };
}
