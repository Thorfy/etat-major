// Mesure la simulation sur la vraie carte, sans navigateur : rythme d'un duel et
// pire cas (toutes les nations voisines en guerre).
//   node tools/bench-sim.ts [ticks du pire cas]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { findLandNeighbors } from '../src/map/adjacency.ts';
import { decodeRle } from '../src/map/codec.ts';
import type { WorldData } from '../src/map/types.ts';
import { Simulation } from '../src/sim/Simulation.ts';
import type { Stance } from '../src/sim/protocol.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const world: WorldData = JSON.parse(readFileSync(join(root, 'public/map/world.json'), 'utf8'));
const rawRle = inflateSync(readFileSync(join(root, 'public/map/provinces.dat')));
const rle = new Uint16Array(rawRle.buffer, rawRle.byteOffset, rawRle.byteLength / 2);
const provinceGrid = decodeRle(rle.slice(), world.width * world.height);
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
    seed,
    player,
  });
const minutes = (ticks: number) => (ticks / 600).toFixed(1);
const percentile = (sorted: number[], p: number) => sorted[Math.floor(sorted.length * p)];

function conquest(label: string, attacker: string, defender: string, share: number, defenderShare: number, stance: Stance) {
  const a = idOf(attacker);
  const d = idOf(defender);
  const sim = make(a);
  sim.declareWars([[a, d]]);
  const start = sim.cellsOf(d);
  const marks = [0.1, 0.25, 0.5, 0.75];
  const reached: string[] = [];
  for (let t = 1; t <= 36000; t++) {
    sim.setFront(a, d, share, 'attack');
    sim.setFront(d, a, defenderShare, stance);
    sim.step();
    sim.drainChanges();
    if (marks.length && (start - sim.cellsOf(d)) / start >= marks[0]) reached.push(`${marks.shift()! * 100} % en ${minutes(t)} min`);
    if (marks.length === 0) break;
  }
  console.log(`${label} : ${reached.join(', ') || 'moins de 10 %'} | ${defender} garde ${sim.cellsOf(d)}/${start}, armées ${sim.armyOf(a).toFixed(0)} contre ${sim.armyOf(d).toFixed(0)}, ${minutes(sim.tick)} min simulées`);
}

function duelAi(attacker: string, defender: string, playerStance: Stance, playerShare: number) {
  const a = idOf(attacker);
  const d = idOf(defender);
  const sim = make(a);
  sim.declareWars([[a, d]]);
  const startA = sim.cellsOf(a);
  const startD = sim.cellsOf(d);
  const samples: string[] = [];
  for (let t = 1; t <= 18000; t++) {
    sim.setFront(a, d, playerShare, playerStance);
    sim.step();
    sim.drainChanges();
    if (t % 3000 === 0) samples.push(`${minutes(t)} min ${sim.cellsOf(a) - startA >= 0 ? '+' : ''}${sim.cellsOf(a) - startA}`);
  }
  console.log(`Joueur ${attacker} (${playerStance} ${playerShare * 100} %) contre IA ${defender} [${startA}/${startD}] : ${samples.join(', ')} | armées ${sim.armyOf(a).toFixed(0)} / ${sim.armyOf(d).toFixed(0)}`);
}

console.log('--- Rythme');
conquest('Allemagne écrase France qui tient à 10 %', 'DEU', 'FRA', 1, 0.1, 'hold');
conquest('Allemagne contre France qui tient à 60 %', 'DEU', 'FRA', 1, 0.6, 'hold');
duelAi('FRA', 'DEU', 'hold', 0.6);
duelAi('FRA', 'DEU', 'hold', 1);
duelAi('FRA', 'DEU', 'attack', 1);

const ticks = Number(process.argv[2] ?? 6000);
console.log(`\n--- Pire cas : guerre mondiale, ${ticks} ticks (${minutes(ticks)} min de jeu)`);
const sim = make(0);
const pairs = findLandNeighbors(ownerGrid, world.width, world.height);
const before = performance.now();
sim.declareWars(pairs);
console.log(`${pairs.length} fronts déclarés en ${(performance.now() - before).toFixed(0)} ms, frontière ${sim.frontierSize} cellules`);
const durations: number[] = [];
let maxFlips = 0;
let maxBytes = 0;
let totalFlips = 0;
for (let t = 0; t < ticks; t++) {
  const begin = performance.now();
  sim.step();
  const changes = sim.drainChanges();
  durations.push(performance.now() - begin);
  maxFlips = Math.max(maxFlips, changes.cells.length);
  totalFlips += changes.cells.length;
  maxBytes = Math.max(maxBytes, changes.cells.byteLength + changes.owners.byteLength + changes.provinces.byteLength);
  if ((t + 1) % Math.ceil(ticks / 5) === 0) {
    console.log(`  tick ${t + 1} : frontière ${sim.frontierSize}, bascules cumulées ${totalFlips}`);
  }
}
durations.sort((a, b) => a - b);
console.log(`Tick : médiane ${percentile(durations, 0.5).toFixed(2)} ms, p95 ${percentile(durations, 0.95).toFixed(2)} ms, p99 ${percentile(durations, 0.99).toFixed(2)} ms, max ${durations[durations.length - 1].toFixed(2)} ms (budget : 100 ms)`);
console.log(`Bascules par tick au plus : ${maxFlips}, soit ${(maxBytes / 1024).toFixed(1)} Ko à transmettre`);
