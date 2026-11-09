// Télécharge les données sources de la carte (Natural Earth, domaine public).
// Version figée pour que la génération de la carte reste reproductible.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 'v5.1.2';
const BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${VERSION}`;
const FILES = [
  'geojson/ne_10m_admin_0_countries.geojson',
  'geojson/ne_10m_admin_1_states_provinces.geojson',
  'geojson/ne_10m_lakes.geojson',
  'geojson/ne_10m_geography_regions_polys.geojson',
  'geojson/ne_10m_populated_places_simple.geojson',
  'LICENSE.md',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data', 'raw', 'natural-earth');
await mkdir(outDir, { recursive: true });

for (const file of FILES) {
  const target = join(outDir, file.split('/').pop()!);
  const existing = await stat(target).catch(() => null);
  if (existing && existing.size > 0) {
    console.log(`déjà présent : ${target}`);
    continue;
  }
  const response = await fetch(`${BASE}/${file}`);
  if (!response.ok) throw new Error(`${file} : HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(target, body);
  console.log(`${file} : ${(body.length / 1e6).toFixed(1)} Mo`);
}
