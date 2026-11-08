// Scans /model and writes model/manifest.json so the browser knows which GLB/GLTF files exist.
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'model');
if (!existsSync(root)) { console.error('No /model folder found'); process.exit(1); }
const files = readdirSync(root).filter(f => /\.(glb|gltf)$/i.test(f)).sort();
writeFileSync(join(root, 'manifest.json'), JSON.stringify({ files }, null, 2));
console.log(`manifest.json written with ${files.length} model(s).`);
