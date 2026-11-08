// Mesure la simulation sur la vraie carte, sans navigateur : parties jouées par des
// stratégies scriptées (rythme, équilibre) et pire cas (toutes les nations en guerre).
//   node tools/bench-sim.ts [ticks du pire cas]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { findLandNeighbors } from '../src/map/adjacency.ts';
import { decodeRle } from '../src/map/codec.ts';
import type { WorldData } from '../src/map/types.ts';
import { Simulation } from '../src/sim/Simulation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const world: WorldData = JSON.parse(readFileSync(join(root, 'public/map/world.json'), 'utf8'));
const cellCount = world.width * world.height;
const readGrid = (name: string) => {
  const raw = inflateSync(readFileSync(join(root, 'public/map', name)));
  return decodeRle(new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2).slice(), cellCount);
};
const provinceGrid = readGrid('provinces.dat');
const terrainGrid = Uint8Array.from(readGrid('terrain.dat'));
const ownerGrid = new Uint16Array(provinceGrid.length);
for (let i = 0; i < provinceGrid.length; i++) {
  if (provinceGrid[i]) ownerGrid[i] = world.provinces[provinceGrid[i] - 1].nation + 1;
}

const idOf = (code: string) => world.nations.findIndex((n) => n.code === code) + 1;
const make = (player: number, seed = 1) =>
  new Simulation({
    width: world.width,
    height: world.height,
    nations: world.nations,
    provinces: world.provinces,
    provinceGrid,
    ownerGrid,
    terrainGrid,
    seed,
    player,
  });
const minutes = (ticks: number) => (ticks / 600).toFixed(1);
const percentile = (sorted: number[], p: number) => sorted[Math.floor(sorted.length * p)];

interface Strategy {
  label: string;
  /** Appelée à chaque tick : donne ses ordres au nom du joueur. */
  orders(sim: Simulation, player: number, enemy: number, tick: number): void;
}

/** Une cellule du joueur au contact de l'ennemi, la plus proche d'une ligne verticale ou horizontale donnée. */
function frontCells(sim: Simulation, player: number, enemy: number): { x: number; y: number }[] {
  const { owners, width: W, height: H } = sim;
  const cells: { x: number; y: number }[] = [];
  for (let y = 1; y < H - 1; y += 2) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (owners[i] !== player) continue;
      if (owners[y * W + (x + 1) % W] === enemy || owners[y * W + (x + W - 1) % W] === enemy || owners[i - W] === enemy || owners[i + W] === enemy) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

const wrapDelta = (from: number, to: number) => {
  let d = (to - from) % world.width;
  if (d > world.width / 2) d -= world.width;
  if (d < -world.width / 2) d += world.width;
  return d;
};

/** Joueur humain simplifié : fronts tenus, réserve gardée, offensives répétées vers le cœur ennemi. */
function arrowPlayer(allocation: number, everyTicks: number, pincer: boolean): Strategy['orders'] {
  return (sim, player, enemy, tick) => {
    sim.setFront(player, enemy, allocation, 'hold');
    if (tick % everyTicks !== 0 || sim.reserveOf(player) < sim.armyOf(player) * 0.15) return;
    const cells = frontCells(sim, player, enemy);
    if (cells.length === 0) return;
    const provinces = world.provinces
      .map((province, index) => ({ province, id: index + 1 }))
      .filter(({ id, province }) => province.nation === enemy - 1 && sim.controllerOf(id) === enemy);
    if (provinces.length === 0) return;
    const center = provinces.reduce((sum, { province }) => ({ x: sum.x + province.x, y: sum.y + province.y }), { x: 0, y: 0 });
    const target = { x: Math.floor(center.x / provinces.length), y: Math.floor(center.y / provinces.length) };
    const start = pincer ? [cells[0], cells[cells.length - 1]] : [cells[cells.length >> 1]];
    for (const from of start) {
      const dx = wrapDelta(from.x, target.x);
      const dy = target.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const reach = Math.min(length, 80);
      const toX = ((from.x + Math.round((dx / length) * reach)) % world.width + world.width) % world.width;
      const toY = from.y + Math.round((dy / length) * reach);
      sim.launchOffensive(player, from.x, from.y, toX, toY, pincer ? 0.5 : 0.8);
    }
  };
}

const STRATEGIES: Strategy[] = [
  { label: 'Tient à 100 %, sans réserve', orders: (sim, p, e) => sim.setFront(p, e, 1, 'hold') },
  { label: 'Tient à 60 %, sans offensive', orders: (sim, p, e) => sim.setFront(p, e, 0.6, 'hold') },
  { label: 'Attaque à 100 %', orders: (sim, p, e) => sim.setFront(p, e, 1, 'attack') },
  { label: 'Tient à 60 %, une offensive par minute', orders: arrowPlayer(0.6, 600, false) },
  { label: 'Tient à 60 %, tenailles toutes les 2 min', orders: arrowPlayer(0.6, 1200, true) },
  { label: 'Tient à 40 %, offensives toutes les 30 s', orders: arrowPlayer(0.4, 300, false) },
];

function campaign(playerCode: string, enemyCode: string, strategy: Strategy, durationTicks: number, seed: number) {
  const player = idOf(playerCode);
  const enemy = idOf(enemyCode);
  const sim = make(player, seed);
  sim.declareWars([[player, enemy]]);
  const playerStart = sim.cellsOf(player);
  const enemyStart = sim.cellsOf(enemy);
  const samples: string[] = [];
  let maxEnemyPocket = 0;
  let ended = '';
  for (let t = 1; t <= durationTicks; t++) {
    strategy.orders(sim, player, enemy, t);
    sim.step();
    sim.drainChanges();
    if (t % 20 === 0) {
      const stats = sim.snapshot().nations.find((n) => n.id === enemy);
      maxEnemyPocket = Math.max(maxEnemyPocket, stats?.pocketCells ?? 0);
    }
    if (t % 6000 === 0) samples.push(`${minutes(t)}′ ${sim.cellsOf(player) - playerStart >= 0 ? '+' : ''}${sim.cellsOf(player) - playerStart}`);
    if (!ended && sim.cellsOf(enemy) < enemyStart * 0.25) ended = `ennemi à 25 % en ${minutes(t)}′`;
    if (!ended && sim.cellsOf(player) < playerStart * 0.25) ended = `joueur à 25 % en ${minutes(t)}′`;
  }
  return { samples, maxEnemyPocket, ended, armies: `${sim.armyOf(player).toFixed(0)}/${sim.armyOf(enemy).toFixed(0)}` };
}

const DURATION = 18000;
console.log(`--- Parties de ${minutes(DURATION)} min (gain du joueur en cellules, par graine)`);
for (const [playerCode, enemyCode] of [['FRA', 'DEU'], ['DEU', 'FRA']] as const) {
  console.log(`\n${playerCode} (joueur) contre ${enemyCode} (IA)`);
  for (const strategy of STRATEGIES) {
    for (const seed of [1, 2]) {
      const result = campaign(playerCode, enemyCode, strategy, DURATION, seed);
      console.log(`  ${strategy.label} [graine ${seed}] : ${result.samples.join(' | ')} — armées ${result.armies}, poche ennemie max ${result.maxEnemyPocket}${result.ended ? `, ${result.ended}` : ''}`);
    }
  }
}

const ticks = Number(process.argv[2] ?? 6000);
console.log(`\n--- Pire cas : guerre mondiale, IA active avec offensives, ${ticks} ticks (${minutes(ticks)} min de jeu)`);
const sim = make(0);
const pairs = findLandNeighbors(ownerGrid, world.width, world.height);
const before = performance.now();
sim.declareWars(pairs);
console.log(`${pairs.length} fronts déclarés en ${(performance.now() - before).toFixed(0)} ms, frontière ${sim.frontierSize} cellules`);
const durations: number[] = [];
let maxFlips = 0;
let maxBytes = 0;
let totalFlips = 0;
let maxOffensives = 0;
let maxPockets = 0;
for (let t = 0; t < ticks; t++) {
  const begin = performance.now();
  sim.step();
  const changes = sim.drainChanges();
  durations.push(performance.now() - begin);
  maxFlips = Math.max(maxFlips, changes.cells.length);
  totalFlips += changes.cells.length;
  maxBytes = Math.max(maxBytes, changes.cells.byteLength + changes.owners.byteLength + changes.provinces.byteLength);
  maxOffensives = Math.max(maxOffensives, sim.offensives.length);
  if (t % 200 === 0) maxPockets = Math.max(maxPockets, sim.snapshot().pockets.length);
  if ((t + 1) % Math.ceil(ticks / 5) === 0) {
    console.log(`  tick ${t + 1} : frontière ${sim.frontierSize}, offensives ${sim.offensives.length}, bascules cumulées ${totalFlips}`);
  }
}
durations.sort((a, b) => a - b);
console.log(`Tick : médiane ${percentile(durations, 0.5).toFixed(2)} ms, p95 ${percentile(durations, 0.95).toFixed(2)} ms, p99 ${percentile(durations, 0.99).toFixed(2)} ms, max ${durations[durations.length - 1].toFixed(2)} ms (budget : 100 ms)`);
console.log(`Bascules par tick au plus : ${maxFlips}, soit ${(maxBytes / 1024).toFixed(1)} Ko ; ${maxOffensives} offensives et ${maxPockets} poches en même temps au plus`);
