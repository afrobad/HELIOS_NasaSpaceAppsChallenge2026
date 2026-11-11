import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

const SLOTS = ['iss', 'astronaut', 'monitor', 'console', 'nasaConsole'];
export const SLOT_LABEL = {
  iss: 'Station exterior', astronaut: 'Crew (animated)',
  monitor: 'Wall displays', console: 'Desk consoles', nasaConsole: 'NASA Computer Console',
};

async function listFiles() {
  try {
    const r = await fetch(CONFIG.modelDir + 'manifest.json', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j.files) && j.files.length) return j.files; }
  } catch (e) { /* fall through */ }
  return CONFIG.fallbackFiles;
}

/** Decide which file feeds which slot, by overrides first, then by name rules. */
function classify(files) {
  const map = {};
  Object.entries(CONFIG.override).forEach(([slot, f]) => { if (files.includes(f)) map[slot] = f; });
  const used = new Set(Object.values(map));
  for (const [slot, rx] of CONFIG.rules) {
    if (map[slot]) continue;
    const hit = files.find((f) => !used.has(f) && rx.test(f));
    if (hit) { map[slot] = hit; used.add(hit); }
  }
  return map;
}

/**
 * Some exporters write KHR_materials_pbrSpecularGlossiness. Newer three.js builds no longer read it,
 * which leaves the textures off. If a material came through without its map, re-attach the diffuse texture.
 */
async function fixSpecGloss(gltf) {
  const parser = gltf.parser, json = parser.json, jobs = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      const assoc = parser.associations && parser.associations.get(m);
      if (!assoc || assoc.materials === undefined) return;
      const def = json.materials && json.materials[assoc.materials];
      const ext = def && def.extensions && def.extensions.KHR_materials_pbrSpecularGlossiness;
      if (!ext || m.map) return;
      if (ext.diffuseTexture) {
        jobs.push(parser.getDependency('texture', ext.diffuseTexture.index).then((t) => {
          t.colorSpace = THREE.SRGBColorSpace; m.map = t; m.color.set(1, 1, 1); m.metalness = 0; m.roughness = 0.62; m.needsUpdate = true;
        }));
      } else if (ext.diffuseFactor) {
        m.color.setRGB(ext.diffuseFactor[0], ext.diffuseFactor[1], ext.diffuseFactor[2]); m.metalness = 0; m.roughness = 0.62; m.needsUpdate = true;
      }
    });
  });
  await Promise.all(jobs);
}

/**
 * Loads every model found in /model. Missing slots resolve to null (the world then builds a procedural stand-in).
 * onLog(slotLabel, 'loaded' | 'generated'), onProgress(0..1)
 */
export async function loadAssets(onProgress, onLog) {
  const files = await listFiles();
  const map = classify(files);
  const loader = new GLTFLoader();
  const out = {}, report = [];
  const prog = {}; const total = () => { const v = Object.values(prog); return v.length ? v.reduce((a, b) => a + b, 0) / SLOTS.length : 0; };

  await Promise.all(SLOTS.map(async (slot) => {
    const file = map[slot];
    prog[slot] = 0;
    if (!file) { out[slot] = null; prog[slot] = 1; report.push({ slot, status: 'GENERATED', note: 'not in /model' }); onLog(SLOT_LABEL[slot], 'generated'); onProgress(total()); return; }
    try {
      const gltf = await new Promise((res, rej) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) {
            done = true;
            console.warn(`[HELIOS] Model load timeout (30s fallback) for ${slot}: ${file}`);
            rej(new Error(`Timeout loading ${file}`));
          }
        }, 30000);
        loader.load(
          CONFIG.modelDir + encodeURIComponent(file),
          (data) => {
            if (!done) { done = true; clearTimeout(timer); res(data); }
          },
          (e) => {
            if (!done && e.lengthComputable) { prog[slot] = (e.loaded / e.total) * 0.95; onProgress(total()); }
          },
          (err) => {
            if (!done) { done = true; clearTimeout(timer); rej(err); }
          }
        );
      });
      await fixSpecGloss(gltf).catch((e) => console.warn('[HELIOS] fixSpecGloss error on', slot, e));
      out[slot] = gltf; prog[slot] = 1; report.push({ slot, status: 'LOADED', file });
      onLog(SLOT_LABEL[slot], 'loaded');
    } catch (err) {
      console.warn('[HELIOS] failed to load', slot, err);
      out[slot] = null; prog[slot] = 1; report.push({ slot, status: 'GENERATED', note: 'load failed' });
      onLog(SLOT_LABEL[slot], 'generated');
    }
    onProgress(total());
  }));
  console.table(report);
  return out;
}
