// Les grands fleuves sur la grille de la carte : une cellule de terre par où passe un fleuve vaut 1.
// Les routes maritimes les remontent pour atteindre les régions de l'intérieur.
// Entrée : data/raw/natural-earth/ne_50m_rivers_lake_centerlines.geojson (npm run map:fetch).
// Sortie : public/map/rivers.dat, en RLE puis deflate, comme provinces.dat.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { decodeRle, encodeRle } from '../src/map/codec.ts';
import { MAP_HEIGHT as H, MAP_WIDTH as W, latToY, lonToX, wrapDeltaX } from '../src/map/projection.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'data', 'raw', 'natural-earth', 'ne_50m_rivers_lake_centerlines.geojson');
const outDir = join(root, 'public', 'map');

// La terre : les cellules qui ont une province.
const provincesDat = readFileSync(join(outDir, 'provinces.dat'));
const raw = inflateSync(provincesDat);
const provinceGrid = decodeRle(new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), W * H);

const rivers = new Uint16Array(W * H);
let cells = 0;
const mark = (x: number, y: number) => {
  const cx = ((Math.round(x) % W) + W) % W;
  const cy = Math.round(y);
  if (cy < 0 || cy >= H) return;
  const cell = cy * W + cx;
  // Sur l'eau, la mer suffit ; un fleuve ne compte que sur la terre.
  if (provinceGrid[cell] === 0 || rivers[cell] === 1) return;
  rivers[cell] = 1;
  cells++;
};

/** Un tracé continu de cellules d'un point à l'autre, sans saut en diagonale. */
const line = (x0: number, y0: number, x1: number, y1: number) => {
  const dx = wrapDeltaX(x0, x1);
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil((Math.abs(dx) + Math.abs(dy)) * 2));
  for (let i = 0; i <= steps; i++) mark(x0 + (dx * i) / steps, y0 + (dy * i) / steps);
};

interface Feature {
  properties: { featurecla: string; name: string | null };
  geometry: { type: 'LineString'; coordinates: number[][] } | { type: 'MultiLineString'; coordinates: number[][][] };
}
const features = (JSON.parse(readFileSync(source, 'utf8')) as { features: Feature[] }).features;
let lines = 0;
for (const feature of features) {
  const { geometry } = feature;
  const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  for (const part of parts) {
    lines++;
    for (let i = 0; i + 1 < part.length; i++) {
      line(lonToX(part[i][0]), latToY(part[i][1]), lonToX(part[i + 1][0]), latToY(part[i + 1][1]));
    }
  }
}

const rle = encodeRle(rivers);
const compressed = deflateSync(Buffer.from(rle.buffer, rle.byteOffset, rle.byteLength), { level: 9 });
writeFileSync(join(outDir, 'rivers.dat'), compressed);
console.log(`${features.length} fleuves, ${lines} tracés, ${cells} cellules ; rivers.dat ${(compressed.length / 1024).toFixed(0)} Ko`);
