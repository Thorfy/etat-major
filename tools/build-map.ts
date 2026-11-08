// Génère public/map/ à partir de data/raw/natural-earth/ et data/map-config.json :
//   provinces.dat : grille des provinces (RLE + deflate)
//   world.json    : nations et provinces
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { encodeRle } from '../src/map/codec.ts';
import { distanceToBoundary } from '../src/map/distance.ts';
import { MAP_HEIGHT as H, MAP_WIDTH as W, cellAreaKm2, wrapDeltaX } from '../src/map/projection.ts';
import type { NationData, ProvinceData, WorldData } from '../src/map/types.ts';
import { type GeoGeometry, polygonsOf, rasterizePolygon } from './lib/rasterize.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data', 'raw', 'natural-earth');
const outDir = join(root, 'public', 'map');
const config = JSON.parse(readFileSync(join(root, 'data', 'map-config.json'), 'utf8'));

interface Feature {
  properties: Record<string, any>;
  geometry: GeoGeometry;
}
const load = (name: string): Feature[] =>
  JSON.parse(readFileSync(join(rawDir, name), 'utf8')).features;

const admin0 = load('ne_10m_admin_0_countries.geojson');
const admin1 = load('ne_10m_admin_1_states_provinces.geojson');
const lakes = load('ne_10m_lakes.geojson');

// ---------------------------------------------------------------------------
// Nations : chaque entrée Natural Earth est rattachée à une nation jouable.
// ---------------------------------------------------------------------------

interface Nation {
  code: string;
  name: string;
  continent: string;
  population: number;
  gdpMusd: number;
  unclaimed: boolean;
  mergedInto: Nation | null;
  absorbed: string[];
}

const SOVEREIGN_TYPES = new Set(['Sovereign country', 'Sovereignty']);
const excluded = new Set<string>(config.excluded);
const unclaimed = new Set<string>(config.unclaimed);
const separate = new Set<string>(config.separateNations);
const roots = new Set<string>(Object.values(config.sovereignRoots));

function nationCodeOf(p: Record<string, any>): string {
  const code: string = p.ADM0_A3;
  if (config.aliases[code]) return config.aliases[code];
  if (unclaimed.has(code) || separate.has(code) || roots.has(code)) return code;
  if (SOVEREIGN_TYPES.has(p.TYPE)) return code;
  const parent = config.sovereignRoots[p.SOV_A3];
  if (!parent) throw new Error(`Rattachement inconnu pour ${code} (${p.NAME}, ${p.TYPE})`);
  return parent;
}

const nations = new Map<string, Nation>();
const a0ToNation = new Map<string, Nation>();
for (const f of admin0) {
  const p = f.properties;
  if (excluded.has(p.ADM0_A3)) continue;
  const code = nationCodeOf(p);
  let nation = nations.get(code);
  if (!nation) {
    nation = {
      code,
      name: '',
      continent: '',
      population: 0,
      gdpMusd: 0,
      unclaimed: unclaimed.has(code),
      mergedInto: null,
      absorbed: [],
    };
    nations.set(code, nation);
  }
  if (p.ADM0_A3 === code) {
    nation.name = config.nameOverrides[code] ?? p.NAME_FR ?? p.NAME;
    nation.continent = p.CONTINENT;
  }
  nation.population += Math.max(0, p.POP_EST ?? 0);
  nation.gdpMusd += Math.max(0, p.GDP_MD ?? 0);
  a0ToNation.set(p.ADM0_A3, nation);
}
for (const n of nations.values()) {
  if (!n.name) throw new Error(`Nation sans entrée principale : ${n.code}`);
}
const resolveNation = (n: Nation): Nation => {
  while (n.mergedInto) n = n.mergedInto;
  return n;
};

// ---------------------------------------------------------------------------
// Pixellisation : pays d'abord (filet de sécurité), provinces ensuite, lacs enfin.
// ---------------------------------------------------------------------------

interface RawProvince {
  name: string;
  region: string | null;
  nation: Nation;
  isFallback: boolean;
  /** Code du territoire d'origine, pour distinguer métropole et dépendances. */
  a0: string;
}

const raw: (RawProvince | null)[] = [null];
const grid = new Uint16Array(W * H);

for (const f of admin0) {
  const p = f.properties;
  if (excluded.has(p.ADM0_A3)) continue;
  const id = raw.length;
  raw.push({ name: p.NAME_FR ?? p.NAME, region: null, nation: a0ToNation.get(p.ADM0_A3)!, isFallback: true, a0: p.ADM0_A3 });
  for (const polygon of polygonsOf(f.geometry)) rasterizePolygon(grid, W, H, polygon, id);
}
for (const f of admin1) {
  const p = f.properties;
  if (excluded.has(p.adm0_a3)) continue;
  const nation = a0ToNation.get(p.adm0_a3);
  if (!nation) throw new Error(`Province sans pays : ${p.name} (${p.adm0_a3})`);
  const id = raw.length;
  raw.push({
    name: p.name_fr || p.name || p.admin,
    region: p.region || null,
    nation,
    isFallback: false,
    a0: p.adm0_a3,
  });
  for (const polygon of polygonsOf(f.geometry)) rasterizePolygon(grid, W, H, polygon, id);
}
const lakesKept = lakes.filter(
  (f) => f.properties.scalerank <= config.lakeMaxScalerank && !config.excludedLakes.includes(f.properties.name),
);
for (const f of lakesKept) {
  for (const polygon of polygonsOf(f.geometry)) rasterizePolygon(grid, W, H, polygon, 0, false);
}
console.log(`${raw.length - 1} provinces brutes, ${lakesKept.length} lacs`);

/** Appelle fn pour chaque paire de cellules voisines d'identifiants différents (x bouclé). */
function forEachBorder(fn: (a: number, b: number) => void): void {
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const a = grid[row + x];
      const right = grid[row + (x + 1) % W];
      if (a !== right) fn(a, right);
      if (y + 1 < H) {
        const down = grid[row + W + x];
        if (a !== down) fn(a, down);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Micro-États et zones sans État : rattachés au voisin de plus longue frontière,
// sinon à la nation la plus proche, sinon retirés de la carte.
// ---------------------------------------------------------------------------

function nationStats() {
  const stats = new Map<Nation, { cells: number; sx: number; sy: number; x0: number }>();
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue;
    const nation = resolveNation(raw[grid[i]]!.nation);
    const x = i % W;
    let s = stats.get(nation);
    if (!s) stats.set(nation, (s = { cells: 0, sx: 0, sy: 0, x0: x }));
    s.cells++;
    s.sx += wrapDeltaX(s.x0, x);
    s.sy += Math.floor(i / W);
  }
  return stats;
}

const merges: string[] = [];
const dropped: string[] = [];
{
  const stats = nationStats();
  const borders = new Map<Nation, Map<Nation, number>>();
  forEachBorder((a, b) => {
    if (a === 0 || b === 0) return;
    const na = resolveNation(raw[a]!.nation);
    const nb = resolveNation(raw[b]!.nation);
    if (na === nb) return;
    for (const [from, to] of [[na, nb], [nb, na]] as const) {
      let m = borders.get(from);
      if (!m) borders.set(from, (m = new Map()));
      m.set(to, (m.get(to) ?? 0) + 1);
    }
  });

  const isMicro = (n: Nation) => n.unclaimed || (stats.get(n)?.cells ?? 0) < config.minNationCells;
  const centroid = (n: Nation) => {
    const s = stats.get(n)!;
    return { x: s.x0 + s.sx / s.cells, y: s.sy / s.cells };
  };

  const micro = [...stats.keys()].filter(isMicro).sort((a, b) => stats.get(a)!.cells - stats.get(b)!.cells);
  for (const n of micro) {
    let target: Nation | null = null;
    let best = 0;
    for (const [other, count] of borders.get(n) ?? []) {
      const candidate = resolveNation(other);
      if (candidate !== n && !candidate.unclaimed && count > best) {
        best = count;
        target = candidate;
      }
    }
    if (!target) {
      const c = centroid(n);
      let bestDistance = config.nearestNationRadiusCells;
      for (const other of stats.keys()) {
        if (other === n || other.mergedInto || isMicro(other)) continue;
        const o = centroid(other);
        const distance = Math.hypot(wrapDeltaX(c.x, o.x), c.y - o.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          target = other;
        }
      }
    }
    if (target) {
      n.mergedInto = target;
      target.population += n.population;
      target.gdpMusd += n.gdpMusd;
      target.absorbed.push(n.name);
      merges.push(`${n.name} -> ${target.name}`);
    } else {
      dropped.push(n.name);
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] !== 0 && raw[grid[i]]!.nation === n) grid[i] = 0;
      }
    }
  }
}
console.log(`Rattachés : ${merges.join(', ')}`);
console.log(`Retirés de la carte : ${dropped.join(', ') || 'aucun'}`);

// Cellules de la métropole : le nom du Danemark va au Danemark, pas au Groenland.
const homeCell = new Uint8Array(W * H);
for (let i = 0; i < grid.length; i++) {
  if (grid[i] === 0) continue;
  const province = raw[grid[i]]!;
  if (province.a0 === resolveNation(province.nation).code) homeCell[i] = 1;
}

// ---------------------------------------------------------------------------
// Provinces : on fusionne les trop petites, puis on scinde les trop grandes.
// ---------------------------------------------------------------------------

interface Blob {
  id: number;
  nation: Nation;
  cells: number;
  sx: number;
  sy: number;
  x0: number;
  members: { name: string; region: string | null; cells: number; isFallback: boolean }[];
  neighbors: Map<Blob, number>;
  parent: Blob | null;
}

const blobs: (Blob | null)[] = raw.map((r, id) =>
  r
    ? {
        id,
        nation: resolveNation(r.nation),
        cells: 0,
        sx: 0,
        sy: 0,
        x0: -1,
        members: [],
        neighbors: new Map(),
        parent: null,
      }
    : null,
);
const findBlob = (b: Blob): Blob => {
  while (b.parent) b = b.parent;
  return b;
};

for (let i = 0; i < grid.length; i++) {
  const id = grid[i];
  if (id === 0) continue;
  const b = blobs[id]!;
  const x = i % W;
  if (b.x0 < 0) b.x0 = x;
  b.cells++;
  b.sx += wrapDeltaX(b.x0, x);
  b.sy += Math.floor(i / W);
}
for (const b of blobs) {
  if (b && b.cells > 0) {
    const r = raw[b.id]!;
    b.members.push({ name: r.name, region: r.region, cells: b.cells, isFallback: r.isFallback });
  }
}
forEachBorder((a, c) => {
  if (a === 0 || c === 0) return;
  const ba = blobs[a]!;
  const bc = blobs[c]!;
  if (ba.nation !== bc.nation) return;
  ba.neighbors.set(bc, (ba.neighbors.get(bc) ?? 0) + 1);
  bc.neighbors.set(ba, (bc.neighbors.get(ba) ?? 0) + 1);
});

const blobCenter = (b: Blob) => ({ x: b.x0 + b.sx / b.cells, y: b.sy / b.cells });

function mergeBlobs(small: Blob, big: Blob): void {
  const shift = wrapDeltaX(big.x0, small.x0);
  big.sx += small.sx + shift * small.cells;
  big.sy += small.sy;
  big.cells += small.cells;
  big.members.push(...small.members);
  small.parent = big;
  for (const [other, count] of small.neighbors) {
    other.neighbors.delete(small);
    if (other === big) continue;
    big.neighbors.set(other, (big.neighbors.get(other) ?? 0) + count);
    other.neighbors.set(big, (other.neighbors.get(big) ?? 0) + count);
  }
  big.neighbors.delete(small);
  small.neighbors.clear();
}

const regionOf = (b: Blob) => {
  const dominant = [...b.members].sort((m, n) => n.cells - m.cells)[0];
  return dominant?.region ?? null;
};

let changed = true;
while (changed) {
  changed = false;
  const alive = blobs
    .filter((b): b is Blob => !!b && !b.parent && b.cells > 0)
    .sort((a, b) => a.cells - b.cells);
  for (const b of alive) {
    if (b.parent || b.cells >= config.minProvinceCells) continue;
    let target: Blob | null = null;
    let bestScore = -1;
    for (const [other, count] of b.neighbors) {
      if (other.cells + b.cells > config.maxProvinceCells) continue;
      const sameRegion = regionOf(other) !== null && regionOf(other) === regionOf(b) ? 3 : 1;
      const score = (count * sameRegion) / (1 + other.cells / config.minProvinceCells);
      if (score > bestScore) {
        bestScore = score;
        target = other;
      }
    }
    if (!target) {
      // Île isolée : on la rattache à la province la plus proche de la même nation.
      const c = blobCenter(b);
      let bestDistance = config.nearestNationRadiusCells;
      for (const other of alive) {
        if (other === b || other.parent || other.nation !== b.nation) continue;
        if (other.cells + b.cells > config.maxProvinceCells) continue;
        const o = blobCenter(other);
        const distance = Math.hypot(wrapDeltaX(c.x, o.x), c.y - o.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          target = other;
        }
      }
    }
    if (target) {
      mergeBlobs(b, target);
      changed = true;
    }
  }
}

function blobName(b: Blob): string {
  const members = [...b.members].sort((m, n) => n.cells - m.cells);
  const real = members.filter((m) => !m.isFallback);
  const named = (real.length > 0 ? real : members).filter((m, _, list) => m.cells >= list[0].cells * 0.05);
  if (named.length === 1) return named[0].name;
  if (named.length === 2) return `${named[0].name}-${named[1].name}`;
  const regions = new Set(named.map((m) => m.region));
  if (regions.size === 1 && named[0].region) return named[0].region;
  return `${named[0].name} et environs`;
}

interface FinalProvince {
  name: string;
  nation: Nation;
}
const finals: (FinalProvince | null)[] = [null];
const blobToFinal = new Map<Blob, number>();
for (const b of blobs) {
  if (!b || b.parent || b.cells === 0) continue;
  blobToFinal.set(b, finals.length);
  finals.push({ name: blobName(b), nation: b.nation });
}
const remap = new Uint16Array(raw.length);
for (const b of blobs) {
  if (b && b.cells > 0) remap[b.id] = blobToFinal.get(findBlob(b))!;
}
for (let i = 0; i < grid.length; i++) grid[i] = remap[grid[i]];

// Scission par k-moyennes des provinces trop vastes.
const SECTORS = ['Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest', 'Nord', 'Nord-Est'];
{
  const cellsByFinal = new Map<number, number[]>();
  const counts = new Uint32Array(finals.length);
  for (let i = 0; i < grid.length; i++) counts[grid[i]]++;
  for (let id = 1; id < finals.length; id++) {
    if (counts[id] > config.maxProvinceCells) cellsByFinal.set(id, []);
  }
  for (let i = 0; i < grid.length; i++) cellsByFinal.get(grid[i])?.push(i);

  for (const [id, cells] of cellsByFinal) {
    const k = Math.ceil(cells.length / config.splitTargetCells);
    const anchor = cells[0] % W;
    const xs = Float64Array.from(cells, (i) => wrapDeltaX(anchor, i % W));
    const ys = Float64Array.from(cells, (i) => Math.floor(i / W));

    // Initialisation déterministe : point le plus éloigné des centres déjà choisis.
    const cx = [xs[0]];
    const cy = [ys[0]];
    while (cx.length < k) {
      let far = 0;
      let farDistance = -1;
      for (let i = 0; i < xs.length; i += 7) {
        let nearest = Infinity;
        for (let c = 0; c < cx.length; c++) {
          nearest = Math.min(nearest, (xs[i] - cx[c]) ** 2 + (ys[i] - cy[c]) ** 2);
        }
        if (nearest > farDistance) {
          farDistance = nearest;
          far = i;
        }
      }
      cx.push(xs[far]);
      cy.push(ys[far]);
    }
    const assignment = new Uint16Array(xs.length);
    for (let iteration = 0; iteration < 10; iteration++) {
      const sumX = new Float64Array(k);
      const sumY = new Float64Array(k);
      const n = new Uint32Array(k);
      for (let i = 0; i < xs.length; i++) {
        let best = 0;
        let bestDistance = Infinity;
        for (let c = 0; c < k; c++) {
          const distance = (xs[i] - cx[c]) ** 2 + (ys[i] - cy[c]) ** 2;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = c;
          }
        }
        assignment[i] = best;
        sumX[best] += xs[i];
        sumY[best] += ys[i];
        n[best]++;
      }
      for (let c = 0; c < k; c++) {
        if (n[c] > 0) {
          cx[c] = sumX[c] / n[c];
          cy[c] = sumY[c] / n[c];
        }
      }
    }

    // Noms : province d'origine + direction par rapport à son centre.
    const parent = finals[id]!;
    const mx = xs.reduce((a, v) => a + v, 0) / xs.length;
    const my = ys.reduce((a, v) => a + v, 0) / ys.length;
    const used = new Map<string, number>();
    const partIds: number[] = [];
    for (let c = 0; c < k; c++) {
      const angle = Math.atan2(cy[c] - my, cx[c] - mx);
      const sector = SECTORS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
      const rank = (used.get(sector) ?? 0) + 1;
      used.set(sector, rank);
      const name = `${parent.name} ${sector}${rank > 1 ? ` ${rank}` : ''}`;
      if (c === 0) {
        finals[id] = { name, nation: parent.nation };
        partIds.push(id);
      } else {
        partIds.push(finals.length);
        finals.push({ name, nation: parent.nation });
      }
    }
    for (let i = 0; i < cells.length; i++) grid[cells[i]] = partIds[assignment[i]];
  }
}
if (finals.length > 0xffff) throw new Error('Trop de provinces pour 16 bits');

// Nettoyage : une cellule entourée de terre dont aucune voisine n'appartient à sa
// province est un résidu d'écart entre les tracés sources. Les îles sont épargnées.
{
  let cleaned = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const id = grid[i];
        if (id === 0) continue;
        const around = [grid[y * W + (x + W - 1) % W], grid[y * W + (x + 1) % W], grid[i - W], grid[i + W]];
        if (around.includes(id) || around.includes(0)) continue;
        const votes = new Map<number, number>();
        for (const neighbor of around) votes.set(neighbor, (votes.get(neighbor) ?? 0) + 1);
        grid[i] = [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
        cleaned++;
      }
    }
  }
  console.log(`${cleaned} cellules isolées nettoyées`);
}

// ---------------------------------------------------------------------------
// Sortie : numérotation par nation, couleurs, emplacement des noms.
// ---------------------------------------------------------------------------

const nationList = [...new Set(finals.filter((f) => f).map((f) => f!.nation))].sort((a, b) =>
  a.name.localeCompare(b.name, 'fr'),
);
const nationIndex = new Map(nationList.map((n, i) => [n, i]));

const order = finals
  .map((f, id) => ({ f, id }))
  .filter((e): e is { f: FinalProvince; id: number } => !!e.f)
  .sort((a, b) => nationIndex.get(a.f.nation)! - nationIndex.get(b.f.nation)! || a.f.name.localeCompare(b.f.name, 'fr'));
const finalRemap = new Uint16Array(finals.length);
order.forEach((e, index) => {
  finalRemap[e.id] = index + 1;
});
for (let i = 0; i < grid.length; i++) grid[i] = finalRemap[grid[i]];

// Deux provinces d'une même nation ne portent jamais le même nom.
{
  const seen = new Map<string, number>();
  for (const e of order) {
    const key = `${nationIndex.get(e.f.nation)}|${e.f.name}`;
    const rank = (seen.get(key) ?? 0) + 1;
    seen.set(key, rank);
    if (rank > 1) e.f.name = `${e.f.name} ${rank}`;
  }
}

const provinces: ProvinceData[] = order.map((e) => ({
  name: e.f.name,
  nation: nationIndex.get(e.f.nation)!,
  x: 0,
  y: 0,
  cells: 0,
  areaKm2: 0,
}));
const nationOfCell = new Uint16Array(W * H);
const nationCells = new Uint32Array(nationList.length);
const nationArea = new Float64Array(nationList.length);
{
  const anchors = new Int32Array(provinces.length).fill(-1);
  const sumX = new Float64Array(provinces.length);
  const sumY = new Float64Array(provinces.length);
  for (let y = 0; y < H; y++) {
    const area = cellAreaKm2(y);
    for (let x = 0; x < W; x++) {
      const id = grid[y * W + x];
      if (id === 0) continue;
      const index = id - 1;
      const province = provinces[index];
      if (anchors[index] < 0) anchors[index] = x;
      province.cells++;
      province.areaKm2 += area;
      sumX[index] += wrapDeltaX(anchors[index], x);
      sumY[index] += y;
      nationOfCell[y * W + x] = province.nation + 1;
      nationCells[province.nation]++;
      nationArea[province.nation] += area;
    }
  }
  provinces.forEach((province, index) => {
    province.x = Math.round(((anchors[index] + sumX[index] / province.cells + W) % W) * 10) / 10;
    province.y = Math.round((sumY[index] / province.cells) * 10) / 10;
    province.areaKm2 = Math.round(province.areaKm2);
  });
}

// Coloration gloutonne : deux nations voisines n'ont jamais la même teinte.
const PALETTE = [
  '#c4a884', '#a9b98c', '#cf9a72', '#8fa8ab', '#dcc66f', '#a58f9e',
  '#b9c7a0', '#bd8f8a', '#8e9f76', '#d9a84e', '#9c9fb8', '#b3a998',
];
const colors = new Array<string>(nationList.length);
{
  const adjacency = nationList.map(() => new Set<number>());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = nationOfCell[y * W + x];
      if (a === 0) continue;
      const neighbors = [nationOfCell[y * W + (x + 1) % W], y + 1 < H ? nationOfCell[(y + 1) * W + x] : 0];
      for (const b of neighbors) {
        if (b !== 0 && b !== a) {
          adjacency[a - 1].add(b - 1);
          adjacency[b - 1].add(a - 1);
        }
      }
    }
  }
  const used = new Array<number>(PALETTE.length).fill(0);
  const byDegree = nationList.map((_, i) => i).sort((a, b) => adjacency[b].size - adjacency[a].size || a - b);
  for (const n of byDegree) {
    const taken = new Set([...adjacency[n]].map((m) => colors[m]).filter(Boolean));
    let pick = -1;
    for (let c = 0; c < PALETTE.length; c++) {
      if (!taken.has(PALETTE[c]) && (pick < 0 || used[c] < used[pick])) pick = c;
    }
    if (pick < 0) throw new Error(`Palette insuffisante pour ${nationList[n].name}`);
    used[pick]++;
    colors[n] = PALETTE[pick];
  }
}

const distances = distanceToBoundary(nationOfCell, W, H);
const labels = nationList.map(() => ({ x: 0, y: 0, r: -1 }));
const labelsAnywhere = nationList.map(() => ({ x: 0, y: 0, r: -1 }));
for (let i = 0; i < grid.length; i++) {
  const n = nationOfCell[i];
  if (n === 0) continue;
  const spot = { x: i % W, y: Math.floor(i / W), r: Math.round(distances[i] * 10) / 10 };
  if (distances[i] > labelsAnywhere[n - 1].r) labelsAnywhere[n - 1] = spot;
  if (homeCell[i] && distances[i] > labels[n - 1].r) labels[n - 1] = spot;
}
labels.forEach((label, n) => {
  if (label.r < 0) labels[n] = labelsAnywhere[n];
});

const nationData: NationData[] = nationList.map((n, i) => ({
  code: n.code,
  name: n.name,
  continent: n.continent,
  population: n.population,
  gdpMusd: n.gdpMusd,
  color: colors[i],
  cells: nationCells[i],
  areaKm2: Math.round(nationArea[i]),
  label: labels[i],
}));
const world: WorldData = { width: W, height: H, nations: nationData, provinces };

mkdirSync(outDir, { recursive: true });
const rle = encodeRle(grid);
const compressed = deflateSync(Buffer.from(rle.buffer, rle.byteOffset, rle.byteLength), { level: 9 });
writeFileSync(join(outDir, 'provinces.dat'), compressed);
const json = JSON.stringify(world);
writeFileSync(join(outDir, 'world.json'), json);

// ---------------------------------------------------------------------------
// Rapport de contrôle.
// ---------------------------------------------------------------------------

const land = nationCells.reduce((a, b) => a + b, 0);
const sizes = provinces.map((p) => p.cells).sort((a, b) => a - b);
console.log(`\n${nationData.length} nations, ${provinces.length} provinces, ${land} cellules de terre (${((land / grid.length) * 100).toFixed(1)} %)`);
console.log(`Taille des provinces : min ${sizes[0]}, médiane ${sizes[sizes.length >> 1]}, max ${sizes[sizes.length - 1]}`);
console.log(`Sous le seuil de ${config.minProvinceCells} cellules : ${sizes.filter((s) => s < config.minProvinceCells).length}`);
console.log(`provinces.dat : ${(compressed.length / 1024).toFixed(0)} Ko, world.json : ${(json.length / 1024).toFixed(0)} Ko`);

const REFERENCE_KM2: Record<string, number> = {
  RUS: 17.1e6, CAN: 9.98e6, USA: 9.83e6, CHN: 9.6e6, BRA: 8.51e6, AUS: 7.69e6, IND: 3.29e6,
  DZA: 2.38e6, FRA: 0.64e6, DEU: 0.357e6, JPN: 0.378e6, GBR: 0.244e6, BEL: 0.0305e6, LUX: 0.00259e6,
};
console.log('\nContrôle des surfaces (grille / référence) :');
for (const [code, reference] of Object.entries(REFERENCE_KM2)) {
  const n = nationData.find((d) => d.code === code);
  if (n) console.log(`  ${code} ${n.name} : ${(n.areaKm2 / 1e3).toFixed(0)}k / ${(reference / 1e3).toFixed(0)}k km² (${((n.areaKm2 / reference) * 100).toFixed(0)} %)`);
}
const smallest = [...nationData].sort((a, b) => a.cells - b.cells).slice(0, 12);
console.log(`\nPlus petites nations : ${smallest.map((n) => `${n.name} (${n.cells})`).join(', ')}`);
const counts = new Map<string, number>();
for (const p of provinces) {
  const code = nationData[p.nation].code;
  counts.set(code, (counts.get(code) ?? 0) + 1);
}
console.log(`Provinces par nation : ${[...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e.join(' ')).join(', ')}`);
