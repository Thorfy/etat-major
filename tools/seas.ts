// Analyse : les étendues d'eau de la carte, et les pays qui bordent chacune.
//   node tools/seas.ts [connexité 4|8]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { decodeRle } from '../src/map/codec.ts';
import type { WorldData } from '../src/map/types.ts';
import { findSeas } from '../src/sim/seas.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const world: WorldData = JSON.parse(readFileSync(join(root, 'public/map/world.json'), 'utf8'));
const cellCount = world.width * world.height;
const raw = inflateSync(readFileSync(join(root, 'public/map/provinces.dat')));
const provinceGrid = decodeRle(new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2).slice(), cellCount);
const owners = new Uint16Array(cellCount);
for (let i = 0; i < cellCount; i++) if (provinceGrid[i]) owners[i] = world.provinces[provinceGrid[i] - 1].nation + 1;

const W = world.width;
const started = performance.now();
const { sea, sizes } = findSeas(owners, W, world.height);
console.log(`${sizes.length - 1} mers navigables en ${(performance.now() - started).toFixed(0)} ms`);
const borders = sizes.map(() => new Set<string>());
for (let cell = 0; cell < cellCount; cell++) {
  if (sea[cell] === 0) continue;
  const x = cell % W;
  for (const next of [x > 0 ? cell - 1 : cell + W - 1, x < W - 1 ? cell + 1 : cell - W + 1, cell - W, cell + W]) {
    if (next < 0 || next >= cellCount || owners[next] === 0) continue;
    borders[sea[cell]].add(world.nations[owners[next] - 1].code);
  }
}
const order = sizes.map((size, id) => [id, size]).slice(1).sort((a, b) => b[1] - a[1]);
for (const [id, size] of order.slice(0, 25)) {
  const list = [...borders[id]];
  console.log(`mer ${id} : ${size} cellules, ${list.length} pays : ${list.slice(0, 18).join(' ')}${list.length > 18 ? ' …' : ''}`);
}
for (const code of ['KAZ', 'TUR', 'FRA', 'RUS', 'SWE', 'EGY', 'IRN', 'UKR', 'CHN', 'AUS']) {
  const id = world.nations.findIndex((n) => n.code === code) + 1;
  const seas = new Set<number>();
  for (let cell = 0; cell < cellCount; cell++) {
    if (owners[cell] !== id) continue;
    const x = cell % W;
    for (const next of [x > 0 ? cell - 1 : cell + W - 1, x < W - 1 ? cell + 1 : cell - W + 1, cell - W, cell + W]) {
      if (next >= 0 && next < cellCount && sea[next]) seas.add(sea[next]);
    }
  }
  console.log(`${code} borde : ${[...seas].map((s) => `${s} (${sizes[s]})`).join(', ')}`);
}
