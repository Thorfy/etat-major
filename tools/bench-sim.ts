// Mesure la simulation sur la vraie carte, sans navigateur.
//   node tools/bench-sim.ts world [minutes] [graine]   partie mondiale jouée par l'IA
//   node tools/bench-sim.ts duels                      stratégies scriptées, France/Allemagne
//   node tools/bench-sim.ts stress [ticks]             toutes les nations voisines en guerre
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { findLandNeighbors } from '../src/map/adjacency.ts';
import { decodeRle } from '../src/map/codec.ts';
import type { WorldData } from '../src/map/types.ts';
import { AI_PROFILES } from '../src/sim/balance.ts';
import { AI_DOCTRINE_LEANING, ARCHETYPES, DOCTRINE_AXES, archetypeOf } from '../src/sim/doctrine.ts';

// DOCTRINES=hasard : les doctrines de l'IA ne dépendent plus de son tempérament, pour mesurer chaque
// position sans le biais des belliqueux (qui penchent vers le mouvement et la masse).
if (process.env.DOCTRINES === 'hasard') for (const leaning of AI_DOCTRINE_LEANING as number[][]) leaning.fill(0);
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
const riverGrid = Uint8Array.from(readGrid('rivers.dat'));
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
    riverGrid,
    seed,
    player,
  });
const minutes = (ticks: number) => (ticks / 600).toFixed(1);
const percentile = (sorted: number[], p: number) => sorted[Math.floor(sorted.length * p)];
const summary = (durations: number[]) => {
  const sorted = [...durations].sort((a, b) => a - b);
  return `médiane ${percentile(sorted, 0.5).toFixed(2)} ms, p95 ${percentile(sorted, 0.95).toFixed(2)} ms, p99 ${percentile(sorted, 0.99).toFixed(2)} ms, max ${sorted[sorted.length - 1].toFixed(2)} ms`;
};

// ---------------------------------------------------------------------------
// Partie mondiale
// ---------------------------------------------------------------------------

/**
 * Bilan par doctrine, sur les 193 pays du départ : par grande doctrine, puis pôle par pôle (les pays
 * nettement d'un côté de l'axe, à 0,3 au moins). Terres : cellules finales sur cellules de départ.
 */
function doctrineReport(sim: Simulation) {
  type Row = { count: number; alive: number; land: number; gdp: number };
  const row = (): Row => ({ count: 0, alive: 0, land: 0, gdp: 0 });
  const add = (target: Row, n: number) => {
    target.count++;
    if (!sim.isAlive(n)) return;
    target.alive++;
    target.land += sim.cellsOf(n) / Math.max(1, world.nations[n - 1].cells);
    target.gdp += sim.outputOf(n) / Math.max(1, world.nations[n - 1].gdpMusd) - 1;
  };
  const show = (name: string, entry: Row) =>
    `${name} ${entry.alive}/${entry.count}, terres ×${entry.alive ? (entry.land / entry.alive).toFixed(2) : '-'}, PIB ${entry.alive ? ((entry.gdp / entry.alive) * 100).toFixed(0) : '-'} %`;
  const archetypes = new Map<number, Row>();
  const poles = DOCTRINE_AXES.map(() => [row(), row()]);
  for (let n = 1; n <= world.nations.length; n++) {
    if (world.nations[n - 1].parent !== undefined) continue;
    const doctrine = sim.doctrineOf(n);
    const archetype = archetypeOf(doctrine);
    if (!archetypes.has(archetype)) archetypes.set(archetype, row());
    add(archetypes.get(archetype)!, n);
    doctrine.forEach((value, axis) => {
      if (value <= -0.3) add(poles[axis][0], n);
      else if (value >= 0.3) add(poles[axis][1], n);
    });
  }
  console.log('  Doctrines :');
  for (const [archetype, entry] of [...archetypes].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`    ${show(archetype < 0 ? 'Équilibrée' : ARCHETYPES[archetype].name, entry)}`);
  }
  DOCTRINE_AXES.forEach((axis, index) => {
    console.log(`    ${axis.name.padEnd(12)} : ${show(axis.minus, poles[index][0])} | ${show(axis.plus, poles[index][1])}`);
  });
}

function worldGame(durationMinutes: number, seed: number) {
  const sim = make(0, seed);
  const ticks = durationMinutes * 600;
  const landTotal = world.nations.reduce((sum, nation) => sum + nation.cells, 0);
  const durations: number[] = [];
  let capitulations = 0;
  let wars = 0;
  const declaredBy = new Float64Array(world.nations.length + 1);
  let maxBytes = 0;
  const firstLosses: string[] = [];
  const diplomacy: Record<string, number> = {};
  const coalitions: string[] = [];
  const secessions: string[] = [];
  let regionBirths = 0;
  console.log(`--- Partie mondiale, graine ${seed}, ${durationMinutes} min de jeu à ×1`);
  for (let t = 1; t <= ticks; t++) {
    const begin = performance.now();
    sim.step();
    const changes = sim.drainChanges();
    durations.push(performance.now() - begin);
    maxBytes = Math.max(maxBytes, changes.cells.byteLength + changes.owners.byteLength);
    for (const event of changes.events) {
      diplomacy[event.type] = (diplomacy[event.type] ?? 0) + 1;
      if (event.type === 'war') {
        wars++;
        declaredBy[event.a]++;
      }
      else if (event.type === 'capitulation') {
        capitulations++;
        if (firstLosses.length < 8) {
          firstLosses.push(`${world.nations[event.loser - 1].name} → ${world.nations[event.winner - 1].name} (${minutes(event.tick)}′)`);
        }
      } else if (event.type === 'coalition' && coalitions.length < 6) {
        coalitions.push(`contre ${world.nations[event.target - 1].name} (${event.members.length} pays, ${minutes(event.tick)}′)`);
      } else if ((event.type === 'secession' || event.type === 'independence') && secessions.length < 16) {
        if (world.nations[event.rebel - 1].parent !== undefined) regionBirths++;
        secessions.push(`${world.nations[event.rebel - 1].name} ${event.type === 'secession' ? 'se soulève contre' : 'quitte en paix'} ${world.nations[event.parent - 1].name} (${minutes(event.tick)}′)`);
      }
    }
    if (t % 6000 === 0) {
      const ranking = world.nations
        .map((nation, index) => ({ name: nation.name, cells: sim.cellsOf(index + 1) }))
        .sort((a, b) => b.cells - a.cells)
        .slice(0, 5)
        .map((entry) => `${entry.name} ${((entry.cells / landTotal) * 100).toFixed(0)} %`);
      const richest = world.nations
        .map((nation, index) => ({ name: nation.name, output: sim.outputOf(index + 1), start: nation.gdpMusd }))
        .sort((a, b) => b.output - a.output)
        .slice(0, 5)
        .map((entry) => `${entry.name} ${(entry.output / 1e6).toFixed(1)} Bn (${entry.output >= entry.start ? '+' : ''}${((entry.output / entry.start - 1) * 100).toFixed(0)} %)`);
      console.log(`  ${minutes(t)}′ : ${sim.aliveCount} nations, ${sim.fronts.length} guerres (${wars} déclarées), ${capitulations} capitulations, ${sim.offensives.length} offensives, frontière ${sim.frontierSize} — ${ranking.join(', ')}`);
      {
        // Conquérants : les plus gros gains de terres depuis le départ, avec leur tempérament.
        const gains = world.nations
          .map((nation, index) => ({ nation, id: index + 1, gain: sim.cellsOf(index + 1) - nation.cells }))
          .filter((entry) => entry.nation.parent === undefined && entry.gain > 0)
          .sort((x, y) => y.gain - x.gain)
          .slice(0, 4)
          .map((entry) => `${entry.nation.name} +${((entry.gain / Math.max(1, entry.nation.cells)) * 100).toFixed(0)} % (${AI_PROFILES[sim.profileOf(entry.id)].name}, ${((sim.cellsOf(entry.id) / landTotal) * 100).toFixed(1)} % des terres)`);
        console.log(`         Conquérants : ${gains.join(', ') || 'aucun'}`);
      }
      const allMovements = (sim as unknown as { movements: { origin: number; unrest: number; investing: boolean }[] }).movements;
      const historic = allMovements.filter((movement) => world.nations[movement.origin - 1].parent !== undefined);
      const movements = allMovements.filter((movement) => world.nations[movement.origin - 1].parent === undefined);
      const restless = movements.filter((movement) => movement.unrest > 0);
      const stirring = historic.filter((movement) => movement.unrest > 0);
      console.log(`         Régions historiques : ${historic.length} suivies, ${stirring.length} agitées (max ${(Math.max(0, ...stirring.map((movement) => movement.unrest)) * 100).toFixed(0)} %), ${historic.filter((movement) => movement.unrest >= 0.35).length} au seuil des demandes, ${regionBirths} nées parmi les séparations listées`);
      console.log(`         Diplomatie : ${diplomacy.peace ?? 0} paix, ${diplomacy.coalition ?? 0} coalitions, ${diplomacy.secession ?? 0} soulèvements, ${diplomacy.independence ?? 0} indépendances accordées`);
      console.log(`         Régions annexées : ${movements.length}, dont ${restless.length} agitées (max ${(Math.max(0, ...restless.map((movement) => movement.unrest)) * 100).toFixed(0)} %), ${movements.filter((movement) => movement.investing).length} avec investissements en chantier`);
      console.log(`         PIB : ${richest.join(', ')}`);
      {
        const internals = sim as unknown as { tradeDeals: unknown[]; embargoes: unknown[] };
        let accessSum = 0;
        let alive = 0;
        let cutOff = 0;
        for (let n = 1; n <= world.nations.length; n++) {
          if (!sim.isAlive(n)) continue;
          alive++;
          accessSum += sim.tradeAccessOf(n);
          if (sim.tradeAccessOf(n) < 0.5) cutOff++;
        }
        const axes = sim.tradeAxes;
        console.log(
          `         Commerce : ${internals.tradeDeals.length} accords, ${internals.embargoes.length} embargos, accès moyen ` +
            `${((accessSum / Math.max(1, alive)) * 100).toFixed(0)} %, ${cutOff} pays sous 50 %, ` +
            `${axes.length} axes (${axes.filter((axis) => !axis.active).length} coupés)`,
        );
      }
      let atWar = 0;
      let stabilitySum = 0;
      let manpowerSum = 0;
      let factories = 0;
      let blockaded = 0;
      const warring = new Set<number>();
      for (const front of sim.fronts) {
        warring.add(front.a);
        warring.add(front.b);
      }
      for (let n = 1; n <= world.nations.length; n++) {
        if (!sim.isAlive(n)) continue;
        if (warring.has(n)) {
          atWar++;
          stabilitySum += sim.stabilityOf(n);
          manpowerSum += sim.manpowerOf(n) / Math.max(1, sim.manpowerMaxOf(n));
        }
        if (sim.isBlockaded(n)) blockaded++;
      }
      for (let p = 1; p < sim.factories.length; p++) factories += sim.factories[p];
      const levels = Object.entries(sim.buildings).map(([kind, values]) => `${kind} ${values.reduce((sum, value) => sum + value, 0)}`).join(', ');
      let fortified = 0;
      for (let i = 0; i < sim.forts.length; i++) if (sim.forts[i] > 0) fortified++;
      const counters = sim.offensives.filter((offensive) => offensive.counter).length;
      console.log(`         Arrière : ${atWar} nations en guerre, stabilité moyenne ${atWar ? (stabilitySum / atWar).toFixed(2) : '-'}, réservoir moyen ${atWar ? ((manpowerSum / atWar) * 100).toFixed(0) : '-'} %, ${blockaded} sous blocus, ${factories} niveaux d'usine bâtis, ${fortified} cellules fortifiées, ${counters} contre-attaques en cours`);
      console.log(`         Bâtiments : ${levels}`);
    }
  }
  {
    // Bilan par tempérament, sur les 193 pays du départ.
    const rows = AI_PROFILES.map((profile) => ({ name: profile.name, count: 0, alive: 0, wars: 0, growth: 0, deals: 0, axes: 0 }));
    for (let n = 1; n <= world.nations.length; n++) {
      if (world.nations[n - 1].parent !== undefined) continue;
      const row = rows[sim.profileOf(n)];
      row.count++;
      row.wars += declaredBy[n];
      if (!sim.isAlive(n)) continue;
      row.alive++;
      row.growth += sim.outputOf(n) / Math.max(1, world.nations[n - 1].gdpMusd) - 1;
      row.deals += sim.dealsOf(n).length;
      row.axes += sim.tradeAxes.filter((axis) => axis.nation === n).length;
    }
    for (const row of rows) {
      console.log(
        `  ${row.name.padEnd(11)} : ${row.alive}/${row.count} en vie, ${(row.wars / Math.max(1, row.count)).toFixed(2)} guerres déclarées par pays, ` +
          `PIB ${row.alive ? ((row.growth / row.alive) * 100).toFixed(0) : '-'} %, ${row.alive ? (row.deals / row.alive).toFixed(1) : '-'} accords et ` +
          `${row.alive ? (row.axes / row.alive).toFixed(1) : '-'} axes par survivant`,
      );
    }
  }
  doctrineReport(sim);
  {
    // Économie mondiale et réseaux commerciaux automatiques, sur les pays en vie.
    let start = 0;
    let now = 0;
    let networks = 0;
    let hubs = 0;
    let principal = 0;
    let stability = 0;
    let alive = 0;
    for (let n = 1; n <= world.nations.length; n++) {
      if (!sim.isAlive(n)) continue;
      alive++;
      start += world.nations[n - 1].gdpMusd;
      now += sim.outputOf(n);
      stability += sim.stabilityOf(n);
      const network = sim.networkOf(n);
      if (network.hubs.length > 1) networks++;
      hubs += network.hubs.length;
      principal += network.principal.length;
    }
    console.log(
      `  Monde : PIB ${(((now / Math.max(1, start)) - 1) * 100).toFixed(0)} % depuis le départ, stabilité moyenne ${(stability / Math.max(1, alive)).toFixed(2)} ; ` +
        `réseaux : ${networks} pays reliés, ${(hubs / Math.max(1, alive)).toFixed(1)} villes principales et ${(principal / Math.max(1, alive)).toFixed(1)} avec les sautées, en moyenne`,
    );
  }
  console.log(`  Premières capitulations : ${firstLosses.join(', ')}`);
  console.log(`  Coalitions : ${coalitions.join(', ') || 'aucune'}`);
  console.log(`  Séparations : ${secessions.join(', ') || 'aucune'}`);
  console.log(`  Tick : ${summary(durations)} ; ${(maxBytes / 1024).toFixed(0)} Ko au plus en un tick`);
  const begin = performance.now();
  const save = sim.save();
  const json = JSON.stringify(save.state);
  console.log(`  Sauvegarde : ${(performance.now() - begin).toFixed(0)} ms, ${(json.length / 1024).toFixed(0)} Ko de JSON avant compression`);
}

// ---------------------------------------------------------------------------
// Duels scriptés
// ---------------------------------------------------------------------------

interface Strategy {
  label: string;
  /** Appelée à chaque tick : donne ses ordres au nom du joueur. */
  orders(sim: Simulation, player: number, enemy: number, tick: number): void;
}

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
function arrowPlayer(allocation: number, everyTicks: number): Strategy['orders'] {
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
    const from = cells[cells.length >> 1];
    const dx = wrapDelta(from.x, target.x);
    const dy = target.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const reach = Math.min(length, 80);
    const toX = ((from.x + Math.round((dx / length) * reach)) % world.width + world.width) % world.width;
    sim.launchOffensive(player, from.x, from.y, toX, from.y + Math.round((dy / length) * reach), 0.8);
  };
}

const STRATEGIES: Strategy[] = [
  { label: 'Tient à 100 %, sans réserve', orders: (sim, p, e) => sim.setFront(p, e, 1, 'hold') },
  { label: 'Tient à 60 %, sans offensive', orders: (sim, p, e) => sim.setFront(p, e, 0.6, 'hold') },
  { label: 'Attaque à 100 %', orders: (sim, p, e) => sim.setFront(p, e, 1, 'attack') },
  { label: 'Tient à 60 %, une offensive par minute', orders: arrowPlayer(0.6, 600) },
  { label: 'Tient à 40 %, offensives toutes les 30 s', orders: arrowPlayer(0.4, 300) },
  {
    label: 'Effort de guerre 100 %, tient à 60 %, une offensive par minute',
    orders: (sim, p, e, t) => {
      sim.setEffort(p, 1);
      arrowPlayer(0.6, 600)(sim, p, e, t);
    },
  },
];

function duels() {
  const duration = 18000;
  console.log(`--- Duels de ${minutes(duration)} min, le reste du monde joue aussi (gain du joueur en cellules)`);
  for (const [playerCode, enemyCode] of [['FRA', 'DEU'], ['DEU', 'FRA']] as const) {
    console.log(`\n${playerCode} (joueur) contre ${enemyCode} (IA)`);
    for (const strategy of STRATEGIES) {
      for (const seed of [1, 2]) {
        const player = idOf(playerCode);
        const enemy = idOf(enemyCode);
        // L'IA du reste du monde reste active : seule compte la différence pour le joueur.
        const sim = make(player, seed);
        sim.declareWars([[player, enemy]]);
        const start = sim.cellsOf(player);
        const samples: string[] = [];
        let end = '';
        for (let t = 1; t <= duration; t++) {
          if (sim.isAlive(player) && sim.isAlive(enemy)) strategy.orders(sim, player, enemy, t);
          sim.step();
          sim.drainChanges();
          if (t % 6000 === 0) {
            const gain = sim.cellsOf(player) - start;
            const balance = sim.capacityOf(player) / Math.max(1, sim.capacityOf(enemy));
            samples.push(`${minutes(t)}′ ${gain >= 0 ? '+' : ''}${gain} (capacité ${balance.toFixed(2)})`);
          }
          if (!end && !sim.isAlive(enemy)) end = `ennemi capitule en ${minutes(t)}′`;
          if (!end && !sim.isAlive(player)) end = `joueur capitule en ${minutes(t)}′`;
        }
        console.log(`  ${strategy.label} [graine ${seed}] : ${samples.join(' | ')}${end ? ` — ${end}` : ''}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pire cas
// ---------------------------------------------------------------------------

function stress(ticks: number) {
  console.log(`--- Pire cas : guerre mondiale, IA active, ${ticks} ticks (${minutes(ticks)} min de jeu)`);
  const sim = make(0);
  const pairs = findLandNeighbors(ownerGrid, world.width, world.height);
  const before = performance.now();
  sim.declareWars(pairs);
  console.log(`${pairs.length} fronts déclarés en ${(performance.now() - before).toFixed(0)} ms, frontière ${sim.frontierSize} cellules`);
  const durations: number[] = [];
  let maxBytes = 0;
  let maxOffensives = 0;
  let capitulations = 0;
  for (let t = 0; t < ticks; t++) {
    const begin = performance.now();
    sim.step();
    const changes = sim.drainChanges();
    durations.push(performance.now() - begin);
    maxBytes = Math.max(maxBytes, changes.cells.byteLength + changes.owners.byteLength + changes.provinces.byteLength);
    maxOffensives = Math.max(maxOffensives, sim.offensives.length);
    capitulations += changes.events.filter((event) => event.type === 'capitulation').length;
    if ((t + 1) % Math.ceil(ticks / 5) === 0) {
      console.log(`  tick ${t + 1} : frontière ${sim.frontierSize}, offensives ${sim.offensives.length}, nations ${sim.aliveCount}, capitulations ${capitulations}`);
    }
  }
  console.log(`Tick : ${summary(durations)} (budget : 100 ms)`);
  console.log(`${(maxBytes / 1024).toFixed(0)} Ko au plus en un tick ; ${maxOffensives} offensives en même temps au plus`);
}

const [mode, argument, argument2] = process.argv.slice(2);
if (mode === 'duels') duels();
else if (mode === 'stress') stress(Number(argument ?? 6000));
else worldGame(Number(argument ?? 60), Number(argument2 ?? 1));
