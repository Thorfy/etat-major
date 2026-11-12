// Génère public/map/ à partir de data/raw/natural-earth/ et data/map-config.json :
//   provinces.dat : grille des provinces (RLE + deflate)
//   world.json    : nations et provinces
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { encodeRle } from '../src/map/codec.ts';
import { distanceToBoundary } from '../src/map/distance.ts';
import { MAP_HEIGHT as H, MAP_WIDTH as W, cellAreaKm2, latToY, lonToX, wrapDeltaX } from '../src/map/projection.ts';
import { TERRAIN_IDS, TERRAIN_NAMES, type TerrainKey } from '../src/map/terrain.ts';
import type { NationData, ProvinceData, WorldData } from '../src/map/types.ts';
import { type GeoGeometry, type GeoPolygon, polygonsOf, rasterizePolygon } from './lib/rasterize.ts';

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
  /** Code ISO 3166-2 et nom d'origine, pour le catalogue des régions historiques. */
  iso: string | null;
  neName: string;
  /** Région historique (clé « FRA-BRE »), attribuée d'après data/regions.json. */
  historic: string | null;
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
  raw.push({ name: p.NAME_FR ?? p.NAME, iso: null, neName: p.NAME, historic: null, region: null, nation: a0ToNation.get(p.ADM0_A3)!, isFallback: true, a0: p.ADM0_A3 });
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
    iso: p.iso_3166_2 ?? null,
    neName: p.name ?? '',
    historic: null,
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
// Régions historiques (data/regions.json) : chaque subdivision reçoit au plus une région.
// Un code ou un nom l'emporte sur « region: », qui l'emporte sur « a0: ».
// ---------------------------------------------------------------------------

interface RegionDef {
  key: string;
  country: string;
  name: string;
  identity: number;
}
const regionDefs = new Map<string, RegionDef>();
{
  const catalog = JSON.parse(readFileSync(join(root, 'data', 'regions.json'), 'utf8')).countries as Record<
    string,
    [string, string, number, string[]][]
  >;
  const rank = new Map<number, number>();
  for (const [country, list] of Object.entries(catalog)) {
    const members = raw.flatMap((r, id) => (r && resolveNation(r.nation).code === country ? [id] : []));
    if (members.length === 0) throw new Error(`Régions : pays inconnu ${country}`);
    for (const [id, name, identity, specs] of list) {
      const key = `${country}-${id}`;
      if (regionDefs.has(key)) throw new Error(`Régions : ${key} en double`);
      if (!(identity >= 1 && identity <= 4)) throw new Error(`Régions : ${key} : identité ${identity}`);
      regionDefs.set(key, { key, country, name, identity });
      const removed: number[] = [];
      for (const spec of specs) {
        const negative = spec.startsWith('-');
        const body = negative ? spec.slice(1) : spec;
        let level: number;
        let match: (r: RawProvince) => boolean;
        if (body.startsWith('a0:')) {
          level = 1;
          match = (r) => r.a0 === body.slice(3);
        } else if (body.startsWith('region:')) {
          level = 2;
          match = (r) => r.region === body.slice(7);
        } else {
          level = 3;
          match = (r) => r.iso === body || r.neName === body || r.name === body;
        }
        const hits = members.filter((m) => match(raw[m]!));
        if (hits.length === 0) throw new Error(`Régions : ${key} : « ${spec} » ne désigne rien`);
        for (const m of hits) {
          const r = raw[m]!;
          if (negative) {
            removed.push(m);
            continue;
          }
          const current = rank.get(m) ?? 0;
          if (current === level && r.historic !== key) throw new Error(`Régions : ${r.name} à la fois dans ${r.historic} et ${key}`);
          if (level >= current) {
            r.historic = key;
            rank.set(m, level);
          }
        }
      }
      for (const m of removed) {
        if (raw[m]!.historic === key) {
          raw[m]!.historic = null;
          rank.delete(m);
        }
      }
    }
  }
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
  members: { name: string; region: string | null; historic: string | null; cells: number; isFallback: boolean }[];
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
    b.members.push({ name: r.name, region: r.region, historic: r.historic, cells: b.cells, isFallback: r.isFallback });
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

const historicOf = (b: Blob) => {
  const dominant = [...b.members].sort((m, n) => n.cells - m.cells)[0];
  return dominant?.historic ?? null;
};
/**
 * Une province ne déborde pas d'une région historique : une région, même minuscule, garde ses
 * provinces. Seul un éclat hors région, trop petit pour tenir seul, peut y être rattaché.
 */
const crossesHistory = (b: Blob, other: Blob) => {
  const mine = historicOf(b);
  if (mine === historicOf(other)) return false;
  return mine !== null || b.cells >= config.minProvinceCells / 3;
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
      if (other.cells + b.cells > config.maxProvinceCells || crossesHistory(b, other)) continue;
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
        if (other.cells + b.cells > config.maxProvinceCells || crossesHistory(b, other)) continue;
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
  historic: string | null;
}

/** Région historique majoritaire en cellules (le cœur du pays compte comme une région). */
const historicStats = new Map<string, { inside: number; outside: number }>();
function blobHistoric(b: Blob): string | null {
  const cells = new Map<string | null, number>();
  for (const m of b.members) cells.set(m.historic, (cells.get(m.historic) ?? 0) + m.cells);
  const best = [...cells].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0])))[0][0];
  for (const [key, count] of cells) {
    if (key === null) continue;
    const stats = historicStats.get(key) ?? { inside: 0, outside: 0 };
    if (key === best) stats.inside += count;
    else stats.outside += count;
    historicStats.set(key, stats);
  }
  return best;
}
const finals: (FinalProvince | null)[] = [null];
const blobToFinal = new Map<Blob, number>();
for (const b of blobs) {
  if (!b || b.parent || b.cells === 0) continue;
  blobToFinal.set(b, finals.length);
  finals.push({ name: blobName(b), nation: b.nation, historic: blobHistoric(b) });
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
        finals[id] = { name, nation: parent.nation, historic: parent.historic };
        partIds.push(id);
      } else {
        partIds.push(finals.length);
        finals.push({ name, nation: parent.nation, historic: parent.historic });
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
  population: 0,
  gdpMusd: 0,
  oil: 0,
  steel: 0,
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

// Terrain : du moins prioritaire au plus prioritaire, les montagnes l'emportent.
const terrainGrid = new Uint16Array(W * H);
{
  const regions = load('ne_10m_geography_regions_polys.geojson');
  const terrainOf = (p: Record<string, any>): TerrainKey | null =>
    config.terrainByName[p.NAME] ?? config.terrainClasses[p.FEATURECLA] ?? null;
  // Limite ondulée : une latitude droite se verrait comme une règle posée sur la carte.
  const arcticRow = latToY(config.arcticLatitude);
  for (let x = 0; x < W; x++) {
    const limit = Math.round(arcticRow + 26 * Math.sin(x * 0.011) + 13 * Math.sin(x * 0.037 + 1.7) + 6 * Math.sin(x * 0.11 + 0.4));
    for (let y = 0; y < limit; y++) terrainGrid[y * W + x] = TERRAIN_IDS.arctic;
  }
  const groups: { terrain: TerrainKey; polygons: GeoPolygon[] }[] = [];
  for (const f of regions) {
    const terrain = terrainOf(f.properties);
    if (terrain) groups.push({ terrain, polygons: polygonsOf(f.geometry) });
  }
  for (const extra of config.terrainExtras as { terrain: TerrainKey; ring: number[][] }[]) {
    groups.push({ terrain: extra.terrain, polygons: [[extra.ring]] });
  }
  for (const key of ['highland', 'desert', 'jungle', 'arctic', 'plain', 'mountain'] as const) {
    for (const group of groups) {
      if (group.terrain !== key) continue;
      for (const polygon of group.polygons) rasterizePolygon(terrainGrid, W, H, polygon, TERRAIN_IDS[key], false);
    }
  }
  // Plaine écrit 0 : rien à faire de plus. L'eau n'a pas de terrain.
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) terrainGrid[i] = 0;
  }
}

// ---------------------------------------------------------------------------
// Économie : Natural Earth ne donne population et PIB que par pays. Une part rurale
// suit la surface habitable, le reste suit la population des villes : l'industrie se
// concentre là où vivent les gens.
// ---------------------------------------------------------------------------

const cityPopulation = new Float64Array(provinces.length);
const depositPlaces: string[] = [];
const habitable = new Float64Array(provinces.length);
let unplacedCities = 0;
{
  const economy = config.economy;
  const weights = TERRAIN_NAMES.map(() => 0);
  for (const [key, weight] of Object.entries(economy.habitability as Record<TerrainKey, number>)) {
    weights[TERRAIN_IDS[key as TerrainKey]] = weight;
  }
  for (let y = 0; y < H; y++) {
    const area = cellAreaKm2(y);
    for (let x = 0; x < W; x++) {
      const id = grid[y * W + x];
      if (id !== 0) habitable[id - 1] += area * weights[terrainGrid[y * W + x]];
    }
  }
  // Une ville côtière peut tomber dans l'eau de la grille : on prend la terre la plus proche.
  const radius: number = economy.citySearchRadiusCells;
  const provinceAt = (cx: number, cy: number, reach = radius): number => {
    let best = 0;
    let bestDistance = Infinity;
    for (let dy = -reach; dy <= reach; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= H) continue;
      for (let dx = -reach; dx <= reach; dx++) {
        const id = grid[y * W + ((cx + dx + W) % W)];
        const distance = dx * dx + dy * dy;
        if (id !== 0 && distance < bestDistance) {
          bestDistance = distance;
          best = id;
        }
      }
    }
    return best;
  };
  for (const place of load('ne_10m_populated_places_simple.geojson')) {
    const population = place.properties.pop_max;
    const point = place.geometry as unknown as { type: string; coordinates: [number, number] };
    if (!(population > 0) || point.type !== 'Point') continue;
    const [lon, lat] = point.coordinates;
    const id = provinceAt(Math.floor(lonToX(lon)) % W, Math.floor(latToY(lat)));
    if (id === 0) unplacedCities++;
    else cityPopulation[id - 1] += population;
  }

  const cityTotal = new Float64Array(nationList.length);
  const habitableTotal = new Float64Array(nationList.length);
  const areaTotal = new Float64Array(nationList.length);
  provinces.forEach((province, index) => {
    cityTotal[province.nation] += cityPopulation[index];
    habitableTotal[province.nation] += habitable[index];
    areaTotal[province.nation] += province.areaKm2;
  });
  provinces.forEach((province, index) => {
    const n = province.nation;
    const rural = habitableTotal[n] > 0 ? habitable[index] / habitableTotal[n] : province.areaKm2 / Math.max(1, areaTotal[n]);
    // Sans ville connue, tout suit la surface habitable.
    const urban = cityTotal[n] > 0 ? cityPopulation[index] / cityTotal[n] : rural;
    const share = (ruralShare: number) => ruralShare * rural + (1 - ruralShare) * urban;
    province.population = Math.round(nationList[n].population * share(economy.ruralPopulationShare));
    province.gdpMusd = Math.round(nationList[n].gdpMusd * share(economy.ruralGdpShare) * 10) / 10;
  });

  // Ressources stratégiques : chaque gisement rejoint la province qui le porte, ou la
  // province côtière la plus proche s'il est en mer.
  type Deposit = { name: string; at: [number, number]; output: number };
  const resources = config.resources as { searchRadiusCells: number; oil: Deposit[]; steel: Deposit[] };
  for (const kind of ['oil', 'steel'] as const) {
    for (const deposit of resources[kind]) {
      const [lon, lat] = deposit.at;
      const id = provinceAt(Math.floor(lonToX(lon)) % W, Math.floor(latToY(lat)), resources.searchRadiusCells);
      if (id === 0) throw new Error(`Gisement hors de toute province : ${deposit.name}`);
      provinces[id - 1][kind] = Math.round((provinces[id - 1][kind] + deposit.output) * 10) / 10;
      depositPlaces.push(`${deposit.name} → ${provinces[id - 1].name} (${nationList[provinces[id - 1].nation].code})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Régions historiques : des nations en sommeil, après les nations du départ, pour ne pas
// changer leurs indices. Elles ne possèdent rien ; leurs provinces portent leur indice.
// ---------------------------------------------------------------------------

const regionReport: string[] = [];
{
  const used = new Map<string, number>();
  for (const e of order) if (e.f.historic) used.set(e.f.historic, (used.get(e.f.historic) ?? 0) + 1);
  const keys = [...regionDefs.keys()].filter((key) => used.has(key));
  const missing = [...regionDefs.keys()].filter((key) => !used.has(key));
  if (missing.length > 0) regionReport.push(`Régions sans province (trop petites, fondues dans une voisine) : ${missing.join(', ')}`);
  const regionIndex = new Map(keys.map((key, k) => [key, nationList.length + k]));
  order.forEach((e, index) => {
    if (e.f.historic) provinces[index].region = regionIndex.get(e.f.historic)!;
  });
  // Grille des régions : 0 l'eau, 0xffff la terre hors région.
  const regionOfCell = new Uint16Array(W * H);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue;
    const region = provinces[grid[i] - 1].region;
    regionOfCell[i] = region === undefined ? 0xffff : region + 1;
  }
  const regionDistances = distanceToBoundary(regionOfCell, W, H);
  const totals = keys.map(() => ({ cells: 0, area: 0, population: 0, gdp: 0, label: { x: 0, y: 0, r: -1 }, near: new Set<string>() }));
  for (let i = 0; i < grid.length; i++) {
    const region = regionOfCell[i];
    if (region === 0 || region === 0xffff) continue;
    const t = totals[region - 1 - nationList.length];
    const x = i % W;
    const y = (i - x) / W;
    t.cells++;
    t.area += cellAreaKm2(y);
    if (regionDistances[i] > t.label.r) t.label = { x, y, r: Math.round(regionDistances[i] * 10) / 10 };
    for (const j of [y * W + (x + 1) % W, y * W + (x + W - 1) % W, y > 0 ? i - W : -1, y + 1 < H ? i + W : -1]) {
      if (j < 0 || nationOfCell[j] === 0) continue;
      const other = regionOfCell[j];
      if (other !== region && other !== 0xffff && other !== 0) t.near.add(`r${other}`);
      t.near.add(colors[nationOfCell[j] - 1]);
    }
  }
  provinces.forEach((province) => {
    if (province.region === undefined) return;
    const t = totals[province.region - nationList.length];
    t.population += province.population;
    t.gdp += province.gdpMusd;
  });
  // Couleur : ni celle du pays, ni celle d'un voisin, ni celle d'une région voisine.
  const regionColors: string[] = [];
  keys.forEach((key, k) => {
    const def = regionDefs.get(key)!;
    const t = totals[k];
    const parent = nationIndex.get(nations.get(def.country)!)!;
    const taken = new Set<string>([colors[parent]]);
    for (const near of t.near) {
      if (near.startsWith('r')) {
        const other = Number(near.slice(1)) - 1 - nationList.length;
        if (regionColors[other]) taken.add(regionColors[other]);
      } else taken.add(near);
    }
    regionColors[k] = PALETTE.find((c) => !taken.has(c)) ?? PALETTE[(k * 5) % PALETTE.length];
    nationData.push({
      code: key,
      name: def.name,
      continent: nationList[parent].continent,
      population: Math.round(t.population),
      gdpMusd: Math.round(t.gdp * 10) / 10,
      color: regionColors[k],
      cells: 0,
      areaKm2: Math.round(t.area),
      label: t.label,
      parent,
      identity: def.identity,
    });
  });
  // Fidélité au catalogue : part des cellules de chaque région restées dans ses provinces.
  let inside = 0;
  let outside = 0;
  const worst: string[] = [];
  for (const [key, stats] of historicStats) {
    inside += stats.inside;
    outside += stats.outside;
    const share = stats.inside / Math.max(1, stats.inside + stats.outside);
    if (share < 0.75) worst.push(`${key} ${(share * 100).toFixed(0)} %`);
  }
  regionReport.push(
    `${keys.length} régions historiques dans ${new Set(keys.map((key) => regionDefs.get(key)!.country)).size} pays, ` +
      `${((inside / Math.max(1, inside + outside)) * 100).toFixed(1)} % de leurs cellules dans leurs provinces`,
  );
  if (worst.length > 0) regionReport.push(`Régions mal découpées par les provinces : ${worst.join(', ')}`);
}

mkdirSync(outDir, { recursive: true });
const terrainRle = encodeRle(terrainGrid);
const terrainCompressed = deflateSync(Buffer.from(terrainRle.buffer, terrainRle.byteOffset, terrainRle.byteLength), { level: 9 });
writeFileSync(join(outDir, 'terrain.dat'), terrainCompressed);
const rle = encodeRle(grid);
const compressed = deflateSync(Buffer.from(rle.buffer, rle.byteOffset, rle.byteLength), { level: 9 });
writeFileSync(join(outDir, 'provinces.dat'), compressed);
const json = JSON.stringify(world);
writeFileSync(join(outDir, 'world.json'), json);

// ---------------------------------------------------------------------------
// Rapport de contrôle.
// ---------------------------------------------------------------------------

const land = nationCells.reduce((a, b) => a + b, 0);
{
  const shares = new Array<number>(TERRAIN_NAMES.length).fill(0);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 0) shares[terrainGrid[i]]++;
  }
  console.log(`Terrain : ${shares.map((count, id) => `${TERRAIN_NAMES[id]} ${((count / land) * 100).toFixed(1)} %`).join(', ')}, terrain.dat ${(terrainCompressed.length / 1024).toFixed(0)} Ko`);
}
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
{
  const richest = [...provinces]
    .sort((a, b) => b.gdpMusd - a.gdpMusd)
    .slice(0, 10)
    .map((p) => `${p.name} (${nationData[p.nation].code}) ${(p.gdpMusd / 1000).toFixed(0)} Md $`);
  console.log(`\nÉconomie : ${unplacedCities} villes hors de toute province. Provinces les plus riches : ${richest.join(', ')}`);
  for (const code of ['FRA', 'DEU', 'GBR', 'RUS', 'USA', 'CHN']) {
    const index = nationData.findIndex((n) => n.code === code);
    const own = provinces.filter((p) => p.nation === index).sort((a, b) => b.gdpMusd - a.gdpMusd);
    const total = own.reduce((sum, p) => sum + p.gdpMusd, 0);
    console.log(`  ${code} : ${own.slice(0, 4).map((p) => `${p.name} ${((p.gdpMusd / total) * 100).toFixed(0)} %`).join(', ')}`);
  }
}
{
  const total = (kind: 'oil' | 'steel') => {
    const byNation = new Map<string, number>();
    for (const p of provinces) if (p[kind] > 0) byNation.set(nationData[p.nation].code, (byNation.get(nationData[p.nation].code) ?? 0) + p[kind]);
    return [...byNation].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, value]) => `${code} ${value.toFixed(1)}`).join(', ');
  };
  console.log(`
Ressources : ${depositPlaces.length} gisements. Pétrole : ${total('oil')}. Acier : ${total('steel')}`);
}
console.log(`\n${regionReport.join('\n')}`);
const smallest = [...nationData].filter((n) => n.parent === undefined).sort((a, b) => a.cells - b.cells).slice(0, 12);
console.log(`\nPlus petites nations : ${smallest.map((n) => `${n.name} (${n.cells})`).join(', ')}`);
const counts = new Map<string, number>();
for (const p of provinces) {
  const code = nationData[p.nation].code;
  counts.set(code, (counts.get(code) ?? 0) + 1);
}
console.log(`Provinces par nation : ${[...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e.join(' ')).join(', ')}`);
