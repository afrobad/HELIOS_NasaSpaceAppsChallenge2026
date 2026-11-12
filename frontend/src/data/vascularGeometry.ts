/**
 * NASA Spaceflight Holographic Vascular, Blood-Flow & Anatomical Point-Cloud Geometry Engine
 *
 * Generates:
 * 1. Surface-area-weighted barycentric 3D anatomical silhouette point cloud with vertex normals
 * 2. Real-time animated arterial blood-flow particle stream (heart -> brain, arms, organs, legs)
 * 3. High-definition micro-dot organ volumes (Brain, Heart, Lungs, Kidneys, Vascular Tree, Vertebral/Pelvic Landmarks)
 */

import { HUMAN_TRI_INDICES } from './humanMeshGeometry';

export interface AnatomicalSurfaceCloud {
  positions: Float32Array;
  normals: Float32Array;
  scales: Float32Array;
}

export interface BloodFlowParticleStream {
  starts: Float32Array;
  ends: Float32Array;
  offsets: Float32Array;
  speeds: Float32Array;
  scales: Float32Array;
}

/**
 * Generates an accurate, uniform-density 3D surface point cloud
 * using triangle surface-area CDF sampling + interpolated vertex normals.
 * Designed for a high-clarity Fresnel rim-dot shader so the outer body contour
 * is razor-sharp while the interior remains dark and transparent for internal organs & blood flow.
 */
export function generateAnatomicalSurfacePointCloud(
  baseVertices: Float32Array,
  triIndices: Uint16Array = HUMAN_TRI_INDICES,
  surfaceCount = 24000
): AnatomicalSurfaceCloud {
  const numVerts = baseVertices.length / 3;
  const numTris = Math.floor(triIndices.length / 3);

  const vertexNormals = new Float32Array(baseVertices.length);
  const cdf = new Float32Array(numTris);

  let totalWeightedArea = 0;

  for (let t = 0; t < numTris; t++) {
    const i0 = triIndices[t * 3] * 3;
    const i1 = triIndices[t * 3 + 1] * 3;
    const i2 = triIndices[t * 3 + 2] * 3;

    const ax = baseVertices[i0], ay = baseVertices[i0 + 1], az = baseVertices[i0 + 2];
    const bx = baseVertices[i1], by = baseVertices[i1 + 1], bz = baseVertices[i1 + 2];
    const cx = baseVertices[i2], cy = baseVertices[i2 + 1], cz = baseVertices[i2 + 2];

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    const doubleArea = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const area = doubleArea * 0.5;

    vertexNormals[i0] += nx;
    vertexNormals[i0 + 1] += ny;
    vertexNormals[i0 + 2] += nz;

    vertexNormals[i1] += nx;
    vertexNormals[i1 + 1] += ny;
    vertexNormals[i1 + 2] += nz;

    vertexNormals[i2] += nx;
    vertexNormals[i2 + 1] += ny;
    vertexNormals[i2 + 2] += nz;

    const meanY = (ay + by + cy) / 3;
    const meanZ = (az + bz + cz) / 3;
    const absNx = Math.abs(nx) / (doubleArea || 1);

    // Weight lateral silhouette edges higher and keep anterior chest/face interior sparse
    // so internal brain, heart, lungs, spine, and flowing blood remain 100% clear
    let regionWeight = 0.75 + 0.85 * absNx;
    if (meanY > 1.18) {
      // Head/neck: emphasize lateral skull/jaw contour, keep front face ultra-clean
      regionWeight = meanZ > 0.04 ? 0.35 : 0.85;
    } else if (meanY > 0.35 && meanY <= 1.05 && meanZ > 0.06) {
      // Anterior chest window: keep front skin dots whisper-light so heart & lungs shine through
      regionWeight = 0.38;
    }

    const weightedArea = Math.max(area, 1e-6) * regionWeight;
    totalWeightedArea += weightedArea;
    cdf[t] = totalWeightedArea;
  }

  for (let v = 0; v < numVerts; v++) {
    const idx = v * 3;
    const nx = vertexNormals[idx];
    const ny = vertexNormals[idx + 1];
    const nz = vertexNormals[idx + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    vertexNormals[idx] = nx / len;
    vertexNormals[idx + 1] = ny / len;
    vertexNormals[idx + 2] = nz / len;
  }

  const totalPoints = surfaceCount;
  const positions = new Float32Array(totalPoints * 3);
  const normals = new Float32Array(totalPoints * 3);
  const scales = new Float32Array(totalPoints);

  let seed = 104729;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let p = 0; p < totalPoints; p++) {
    const target = rand() * totalWeightedArea;
    let low = 0;
    let high = numTris - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (cdf[mid] < target) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const tIdx = low * 3;
    const i0 = triIndices[tIdx] * 3;
    const i1 = triIndices[tIdx + 1] * 3;
    const i2 = triIndices[tIdx + 2] * 3;

    const r1 = Math.sqrt(rand());
    const r2 = rand();
    const w0 = 1 - r1;
    const w1 = r1 * (1 - r2);
    const w2 = r1 * r2;

    let nx = vertexNormals[i0] * w0 + vertexNormals[i1] * w1 + vertexNormals[i2] * w2;
    let ny = vertexNormals[i0 + 1] * w0 + vertexNormals[i1 + 1] * w1 + vertexNormals[i2 + 1] * w2;
    let nz = vertexNormals[i0 + 2] * w0 + vertexNormals[i1 + 2] * w1 + vertexNormals[i2 + 2] * w2;
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;

    const px = baseVertices[i0] * w0 + baseVertices[i1] * w1 + baseVertices[i2] * w2;
    const py = baseVertices[i0 + 1] * w0 + baseVertices[i1 + 1] * w1 + baseVertices[i2 + 1] * w2;
    const pz = baseVertices[i0 + 2] * w0 + baseVertices[i1 + 2] * w1 + baseVertices[i2 + 2] * w2;

    // Quantize Y slightly on 55% of points to create the subtle horizontal scan-band dot texture seen in the reference
    const scanQuantizedY = p % 2 === 0 ? Math.round(py * 115) / 115 : py;

    const outIdx = p * 3;
    positions[outIdx] = px;
    positions[outIdx + 1] = scanQuantizedY;
    positions[outIdx + 2] = pz;

    normals[outIdx] = nx;
    normals[outIdx + 1] = ny;
    normals[outIdx + 2] = nz;

    scales[p] = 0.72 + rand() * 0.48;
  }

  return { positions, normals, scales };
}

/**
 * Legacy helper kept for compatibility
 */
export function generateStardustPointCloud(
  baseVertices: Float32Array,
  _lineIndices: Uint16Array,
  count = 18500
): Float32Array {
  return generateAnatomicalSurfacePointCloud(baseVertices, HUMAN_TRI_INDICES, count).positions;
}

/**
 * Directed Arterial Vascular Tree Segments (Oriented in true direction of blood flow: Heart -> Periphery)
 * Enables both static vessel micro-dot rendering AND directional flowing blood corpuscle animation!
 */
export function getVascularLineSegments(): Float32Array {
  const segments: number[] = [];

  const addChain = (pts: Array<[number, number, number]>) => {
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push(
        pts[i][0], pts[i][1], pts[i][2],
        pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]
      );
    }
  };

  // 1. Ascending Aorta & Aortic Arch (from Left Ventricle [-0.045, 0.74, 0.085] to Arch [0.0, 0.93, 0.05])
  addChain([
    [-0.045, 0.74, 0.085],
    [-0.020, 0.84, 0.070],
    [0.0, 0.93, 0.055],
  ]);

  // 2. Bilateral Carotid & Vertebral Arteries (Aortic Arch -> Neck -> Cerebral Cortex)
  for (const side of [-1, 1]) {
    // Common Carotid -> Internal/External Carotid -> Cerebral Hemispheres
    addChain([
      [0.0, 0.93, 0.055],
      [side * 0.026, 0.98, 0.045],
      [side * 0.032, 1.08, 0.038],
      [side * 0.030, 1.18, 0.032],
      [side * 0.025, 1.27, 0.025],
      [side * 0.042, 1.34, 0.018],
      [side * 0.022, 1.40, 0.010],
    ]);
    // Anterior/Middle Cerebral branch
    addChain([
      [side * 0.025, 1.27, 0.025],
      [side * 0.012, 1.35, 0.035],
      [side * 0.052, 1.37, -0.010],
    ]);
  }

  // 3. Subclavian -> Axillary -> Brachial -> Radial/Ulnar -> Palmar Digital Arteries (Both Arms)
  for (const side of [-1, 1]) {
    // Main Subclavian to Brachial trunk (arching cleanly under the clavicle and down the arm)
    addChain([
      [0.0, 0.93, 0.055],
      [side * 0.08, 0.95, 0.045],
      [side * 0.16, 0.94, 0.035],
      [side * 0.22, 0.88, 0.025],
      [side * 0.25, 0.72, 0.018],
      [side * 0.275, 0.54, 0.014],
      [side * 0.295, 0.34, 0.012],
    ]);

    // Radial Artery (lateral forearm to thumb/palm)
    addChain([
      [side * 0.295, 0.34, 0.012],
      [side * 0.322, 0.16, 0.018],
      [side * 0.335, 0.01, 0.022],
      [side * 0.342, -0.08, 0.024],
    ]);

    // Ulnar Artery & Interosseous branch (medial forearm to palm)
    addChain([
      [side * 0.295, 0.34, 0.012],
      [side * 0.285, 0.15, 0.012],
      [side * 0.305, 0.00, 0.016],
      [side * 0.318, -0.08, 0.020],
    ]);

    // Deep Brachial / Circumflex Humeral collateral branch
    addChain([
      [side * 0.22, 0.88, 0.025],
      [side * 0.235, 0.68, 0.005],
      [side * 0.265, 0.44, 0.008],
    ]);
  }

  // 4. Pulmonary Arterial Trunk & Lobar Branches (Heart -> Left & Right Lungs)
  for (const side of [-1, 1]) {
    addChain([
      [-0.035, 0.77, 0.080],
      [side * 0.055, 0.82, 0.060],
      [side * 0.105, 0.86, 0.048],
    ]);
    addChain([
      [side * 0.055, 0.82, 0.060],
      [side * 0.115, 0.75, 0.052],
    ]);
    addChain([
      [side * 0.055, 0.82, 0.060],
      [side * 0.095, 0.68, 0.048],
    ]);
  }

  // 5. Descending Thoracic & Abdominal Aorta (Arch -> Diaphragm -> Iliac Bifurcation)
  addChain([
    [0.0, 0.93, 0.055],
    [0.008, 0.78, 0.035],
    [0.004, 0.60, 0.030],
    [-0.004, 0.42, 0.028],
    [0.002, 0.24, 0.024],
    [0.0, 0.06, 0.020],
    [0.0, -0.12, 0.016],
  ]);

  // Intercostal & Subcostal Aortic Branches
  for (const yLvl of [0.66, 0.52, 0.38, 0.28]) {
    for (const side of [-1, 1]) {
      addChain([
        [0.0, yLvl, 0.028],
        [side * 0.065, yLvl - 0.02, 0.032],
        [side * 0.115, yLvl - 0.05, 0.024],
      ]);
    }
  }

  // Bilateral Renal & Mesenteric Arteries
  for (const side of [-1, 1]) {
    addChain([
      [0.0, 0.22, 0.024],
      [side * 0.055, 0.21, 0.028],
      [side * 0.095, 0.20, 0.032],
    ]);
  }

  // 6. Common Iliac -> Femoral -> Popliteal -> Anterior/Posterior Tibial -> Pedal Arteries (Both Legs)
  for (const side of [-1, 1]) {
    // Common Iliac -> External Iliac -> Femoral -> Popliteal -> Anterior Tibial -> Dorsalis Pedis
    addChain([
      [0.0, -0.12, 0.016],
      [side * 0.055, -0.22, 0.020],
      [side * 0.095, -0.34, 0.024],
      [side * 0.112, -0.52, 0.028],
      [side * 0.105, -0.72, 0.024],
      [side * 0.098, -0.88, 0.020],
      [side * 0.102, -1.08, 0.028],
      [side * 0.095, -1.28, 0.024],
      [side * 0.092, -1.46, 0.032],
      [side * 0.100, -1.58, 0.055],
    ]);

    // Internal Iliac & Deep Femoral (Profunda Femoris) branch
    addChain([
      [side * 0.055, -0.22, 0.020],
      [side * 0.038, -0.32, 0.012],
    ]);
    addChain([
      [side * 0.095, -0.34, 0.024],
      [side * 0.075, -0.50, 0.018],
      [side * 0.072, -0.68, 0.015],
    ]);

    // Posterior Tibial & Peroneal branch down calf
    addChain([
      [side * 0.098, -0.88, 0.020],
      [side * 0.080, -1.10, 0.012],
      [side * 0.082, -1.32, 0.012],
      [side * 0.085, -1.54, 0.038],
    ]);
  }

  return new Float32Array(segments);
}

/**
 * High-Density Arterial Vascular Micro-Dot Tree along the Vessels
 */
export function getVascularPoints(): Float32Array {
  const pts: number[] = [];
  const lines = getVascularLineSegments();
  let seed = 7719;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < lines.length; i += 6) {
    const x1 = lines[i], y1 = lines[i + 1], z1 = lines[i + 2];
    const x2 = lines[i + 3], y2 = lines[i + 4], z2 = lines[i + 5];
    const segLen = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    const steps = Math.max(10, Math.round(segLen * 110));

    // Thicker vessel core near aorta/subclavian/iliac, finer at extremities
    const isMajorTrunk = Math.abs(x1) < 0.14 && y1 > -0.25 && y1 < 1.05;
    const radiusSpread = isMajorTrunk ? 0.0055 : 0.0032;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      pts.push(
        x1 * (1 - t) + x2 * t + (rand() - 0.5) * radiusSpread,
        y1 * (1 - t) + y2 * t + (rand() - 0.5) * radiusSpread,
        z1 * (1 - t) + z2 * t + (rand() - 0.5) * radiusSpread
      );
    }
  }
  return new Float32Array(pts);
}

/**
 * Generates an animated 3D Blood Flow Particle Stream along all arterial segments.
 * Each particle interpolates from `starts` to `ends` in a GPU vertex shader using `fract(uTime * speed + offset)`.
 */
export function getBloodFlowParticles(): BloodFlowParticleStream {
  const lines = getVascularLineSegments();
  const numSegments = Math.floor(lines.length / 6);

  const startsList: number[] = [];
  const endsList: number[] = [];
  const offsetsList: number[] = [];
  const speedsList: number[] = [];
  const scalesList: number[] = [];

  let seed = 314159;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let seg = 0; seg < numSegments; seg++) {
    const idx = seg * 6;
    const x1 = lines[idx], y1 = lines[idx + 1], z1 = lines[idx + 2];
    const x2 = lines[idx + 3], y2 = lines[idx + 4], z2 = lines[idx + 5];
    const segLen = Math.hypot(x2 - x1, y2 - y1, z2 - z1);

    // Number of flowing blood corpuscles proportional to vessel length
    const count = Math.max(8, Math.round(segLen * 95));
    const isMajorArtery = Math.abs(x1) < 0.12 && y1 > -0.20 && y1 < 1.0;

    for (let c = 0; c < count; c++) {
      const jitter = isMajorArtery ? 0.0035 : 0.0020;
      const jx = (rand() - 0.5) * jitter;
      const jy = (rand() - 0.5) * jitter;
      const jz = (rand() - 0.5) * jitter;

      startsList.push(x1 + jx, y1 + jy, z1 + jz);
      endsList.push(x2 + jx, y2 + jy, z2 + jz);
      offsetsList.push(rand());
      // Speed inversely proportional to segment length so velocity looks physically continuous across segments
      const baseVel = 0.24 / Math.max(segLen, 0.08);
      speedsList.push(baseVel * (0.85 + 0.30 * rand()));
      scalesList.push(isMajorArtery ? 0.95 + 0.45 * rand() : 0.70 + 0.35 * rand());
    }
  }

  return {
    starts: new Float32Array(startsList),
    ends: new Float32Array(endsList),
    offsets: new Float32Array(offsetsList),
    speeds: new Float32Array(speedsList),
    scales: new Float32Array(scalesList),
  };
}

/**
 * High-Density Volumetric 3D Cardiac Myocardium & Ventricular Point Cloud
 * Matches the bright glowing anatomical heart in the reference image.
 */
export function getHeartPoints(): Float32Array {
  const pts: number[] = [];
  // Anatomical left-thoracic heart center: [-0.042, 0.74, 0.088]
  const cx = -0.042;
  const cy = 0.74;
  const cz = 0.088;

  let seed = 90210;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Sculpted 3D myocardium shell + glowing left ventricular core (1,350 points)
  const count = 1350;
  for (let i = 0; i < count; i++) {
    const u = rand() * Math.PI * 2;
    const v = (rand() - 0.5) * Math.PI;
    const shellBias = i < 450 ? 0.25 + 0.45 * rand() : 0.68 + 0.32 * Math.cbrt(rand());

    const sinU = Math.sin(u);
    const cosU = Math.cos(u);
    const cosV = Math.cos(v);
    const sinV = Math.sin(v);

    const rawX = 0.048 * Math.pow(sinU, 3) * cosV * shellBias;
    const rawY = 0.046 * ((13 * cosU - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) / 16) * cosV * shellBias;
    const rawZ = 0.036 * sinV * shellBias;

    // Anatomical cardiac axis tilt (apex points down-left-anterior, matching the reference image)
    const tilt = -0.42;
    const hx = rawX * Math.cos(tilt) - rawY * Math.sin(tilt);
    const hy = rawX * Math.sin(tilt) + rawY * Math.cos(tilt);

    pts.push(cx + hx, cy + hy, cz + rawZ);
  }

  return new Float32Array(pts);
}

/**
 * Bilateral Volumetric 3D Pulmonary Lungs & Bronchial Arborization Point Cloud
 * Fine, delicate alveolar stippling flanking the heart inside the thoracic cavity.
 */
export function getLungPoints(): Float32Array {
  const pts: number[] = [];
  let seed = 44101;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const totalPerLung = 1150;
  for (const side of [-1, 1]) {
    const cx = side * 0.092;
    const cy = 0.77;
    const cz = 0.048;

    for (let i = 0; i < totalPerLung; i++) {
      const u = rand() * Math.PI * 2;
      const cosTheta = 2 * rand() - 1;
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
      const r = i % 3 === 0 ? 0.35 + 0.65 * Math.cbrt(rand()) : 0.82 + 0.18 * rand();

      let lx = sinTheta * Math.cos(u) * 0.072 * r;
      const ly = cosTheta * 0.128 * r;
      let lz = sinTheta * Math.sin(u) * 0.058 * r;

      const heightNorm = (ly / 0.128 + 1) * 0.5;
      const taper = 1.15 - 0.42 * heightNorm;
      lx *= taper;
      lz *= taper;

      const yOffset = ly < -0.07 ? 0.018 * (1 - (lx * lx) / (0.072 * 0.072)) : 0;

      const px = cx + lx;
      const py = cy + ly + yOffset;
      const pz = cz + lz;

      // Carve cardiac notch around the heart so the heart glows unobstructed
      if (px > -0.095 && px < 0.025 && py < 0.79 && py > 0.66 && pz > 0.03) {
        continue;
      }

      pts.push(px, py, pz);
    }
  }

  return new Float32Array(pts);
}

/**
 * Bilateral Bean-Shaped Renal Cortex & Medulla Point Cloud
 */
export function getKidneyPoints(): Float32Array {
  const pts: number[] = [];
  let seed = 55213;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const perKidney = 380;
  for (const side of [-1, 1]) {
    const cx = side * 0.095;
    const cy = side === -1 ? 0.20 : 0.215;
    const cz = 0.032;

    for (let i = 0; i < perKidney; i++) {
      const u = rand() * Math.PI * 2;
      const cosTheta = 2 * rand() - 1;
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
      const r = i % 3 === 0 ? 0.55 + 0.45 * rand() : 0.88 + 0.12 * rand();

      let kx = sinTheta * Math.cos(u) * 0.032 * r;
      const ky = cosTheta * 0.050 * r;
      const kz = sinTheta * Math.sin(u) * 0.025 * r;

      const bend = (1 - (ky / 0.050) * (ky / 0.050)) * 0.010;
      kx += side * bend;

      pts.push(cx + kx, cy + ky, cz + kz);
    }
  }

  return new Float32Array(pts);
}

/**
 * Subtle Axial Skeletal Guide Segments (used only for raycasting)
 */
export function getSkeletonLineSegments(): Float32Array {
  const segments: number[] = [];
  const addLine = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    segments.push(x1, y1, z1, x2, y2, z2);
  };

  // Axial Spine guide
  addLine(0, 1.15, 0.0, 0, -0.22, 0.0);
  // Clavicles
  addLine(-0.20, 0.96, 0.03, 0.20, 0.96, 0.03);
  // Pelvis
  addLine(-0.14, -0.15, 0.02, 0.14, -0.15, 0.02);
  // Femurs & Tibiae for skeletal click raycasting
  for (const side of [-1, 1]) {
    addLine(side * 0.11, -0.24, 0.02, side * 0.10, -0.85, 0.02);
    addLine(side * 0.10, -0.85, 0.02, side * 0.095, -1.45, 0.02);
  }

  return new Float32Array(segments);
}

/**
 * Sculpted White/Ice-Cyan Skeletal Landmark Dot Clusters
 * Matches the reference image:
 * 1. Distinct stacked Cervical, Thoracic & Lumbar Vertebral column blocks down the midline
 * 2. Crisp bilateral Clavicle (collarbone) & Manubrium dot ridges across the upper chest
 * 3. Curved bilateral Iliac / Pelvic Crest C-arcs in the lower abdomen
 * 4. Subtle lateral thoracic rib-tip accents & knee/ankle joint markers
 */
export function getSkeletonPoints(): Float32Array {
  const pts: number[] = [];
  let seed = 88421;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // 1. Stacked Vertebral Column Segments (22 distinct vertebrae from C2 to L5 with intervertebral gaps)
  const numVertebrae = 22;
  const yTop = 1.16;
  const yBot = -0.14;
  for (let v = 0; v < numVertebrae; v++) {
    const frac = v / (numVertebrae - 1);
    const vy = yTop * (1 - frac) + yBot * frac;
    const vz = 0.015 + Math.sin(frac * Math.PI * 2.2) * 0.012;

    // Vertebral body width increases from cervical -> thoracic -> lumbar
    const halfW = 0.010 + 0.014 * Math.pow(frac, 0.7);
    const halfH = 0.012;

    // Dense vertebral body block + transverse process tips
    const dotsPerVertebra = 42;
    for (let d = 0; d < dotsPerVertebra; d++) {
      const isProcess = d < 12;
      const dx = isProcess
        ? (d % 2 === 0 ? 1 : -1) * (halfW + 0.008 + rand() * 0.012)
        : (rand() - 0.5) * 2 * halfW;
      const dy = (rand() - 0.5) * 2 * (isProcess ? halfH * 0.45 : halfH);
      const dz = (rand() - 0.5) * 0.012;
      pts.push(dx, vy + dy, vz + dz);
    }
  }

  // 2. Bilateral Clavicles (Collarbones) & Sternal Notch (Bright horizontal S-curved ridges at y ~ 0.95)
  for (const side of [-1, 1]) {
    const clavicleDots = 160;
    for (let i = 0; i < clavicleDots; i++) {
      const t = i / (clavicleDots - 1); // 0 at sternal notch, 1 at acromion shoulder
      const cx = side * (0.018 + t * 0.185);
      const cy = 0.945 + Math.sin(t * Math.PI) * 0.018 - t * 0.008;
      const cz = 0.058 - t * 0.028;
      pts.push(
        cx + (rand() - 0.5) * 0.008,
        cy + (rand() - 0.5) * 0.009,
        cz + (rand() - 0.5) * 0.008
      );
    }
  }

  // 3. Bilateral Pelvic Iliac Crest C-Arcs (Matches the curved white pelvic brackets in the reference image)
  for (const side of [-1, 1]) {
    const pelvicDots = 150;
    for (let i = 0; i < pelvicDots; i++) {
      const t = i / (pelvicDots - 1); // 0 (top medial iliac wing) -> 0.5 (lateral crest) -> 1.0 (inferior pubic/acetabular curve)
      const angle = (t - 0.15) * Math.PI * 1.15;
      const px = side * (0.042 + Math.sin(angle) * 0.072);
      const py = -0.15 + Math.cos(angle) * 0.065;
      const pz = 0.025 + Math.sin(t * Math.PI) * 0.015;
      pts.push(
        px + (rand() - 0.5) * 0.008,
        py + (rand() - 0.5) * 0.008,
        pz + (rand() - 0.5) * 0.008
      );
    }
  }

  // 4. Subtle Lateral Thoracic Rib-Margin Accents (Outer rib arcs framing the lungs without crossing in front of the heart)
  const ribLevels = [0.86, 0.80, 0.74, 0.68, 0.62, 0.56];
  for (const ry of ribLevels) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 28; i++) {
        const t = i / 27; // Outer lateral arc only (0.45 to 0.95 of rib span)
        const xSpan = 0.105 + t * 0.065;
        const rx = side * xSpan;
        const curY = ry - t * 0.028;
        const rz = 0.045 - t * 0.025;
        pts.push(
          rx + (rand() - 0.5) * 0.005,
          curY + (rand() - 0.5) * 0.005,
          rz + (rand() - 0.5) * 0.005
        );
      }
    }
  }

  // 5. Subtle Chin / Mandibular Contour Accent beneath the Brain
  for (let i = 0; i < 65; i++) {
    const t = (i / 64) * 2 - 1; // -1 to 1
    const mx = t * 0.046;
    const my = 1.175 + t * t * 0.032;
    const mz = 0.055 - t * t * 0.035;
    pts.push(
      mx + (rand() - 0.5) * 0.004,
      my + (rand() - 0.5) * 0.004,
      mz + (rand() - 0.5) * 0.004
    );
  }

  return new Float32Array(pts);
}

/**
 * Bilateral Cerebral Cortex & Synaptic Point-Cloud Brain
 * Dense, luminous cortical dot cluster inside the cranial vault.
 */
export function getBrainNeuralNetwork(): { lines: Float32Array; points: Float32Array } {
  const pts: number[] = [];
  const lines: number[] = [];

  const cx = 0;
  const cy = 1.345;
  const cz = 0.012;
  const rx = 0.062;
  const ry = 0.064;
  const rz = 0.072;

  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const nodeCount = 1450;
  const hubNodes: Array<[number, number, number]> = [];

  for (let i = 0; i < nodeCount; i++) {
    const hemisphere = i % 2 === 0 ? 1 : -1;
    const u = rand() * Math.PI * 2;
    const cosTheta = 2 * rand() - 1;
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const rad = i % 4 === 0 ? 0.35 + 0.55 * Math.cbrt(rand()) : 0.84 + 0.16 * rand();

    const gyri = 1.0 + 0.045 * Math.sin(u * 6.0) * Math.cos(cosTheta * 8.0);

    const nx = cx + hemisphere * (0.006 + Math.abs(sinTheta * Math.cos(u)) * rx * rad * gyri);
    const ny = cy + cosTheta * ry * rad * gyri;
    const nz = cz + sinTheta * Math.sin(u) * rz * rad * gyri;

    pts.push(nx, ny, nz);
    if (i < 120) {
      hubNodes.push([nx, ny, nz]);
    }
  }

  const maxSynapseDist = 0.034;
  for (let i = 0; i < hubNodes.length; i++) {
    let connections = 0;
    for (let j = i + 1; j < hubNodes.length; j++) {
      const dx = hubNodes[i][0] - hubNodes[j][0];
      const dy = hubNodes[i][1] - hubNodes[j][1];
      const dz = hubNodes[i][2] - hubNodes[j][2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < maxSynapseDist && connections < 2) {
        lines.push(
          hubNodes[i][0], hubNodes[i][1], hubNodes[i][2],
          hubNodes[j][0], hubNodes[j][1], hubNodes[j][2]
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
