// Jouer un pays sans navigateur, tour par tour : pour les tests de jeu (humains ou agents).
// La partie est sauvegardée dans un dossier entre deux appels.
//
//   node tools/playtest.ts new <dossier> "<Pays>" [graine]   nouvelle partie, en paix au 1er janvier 2026
//   node tools/playtest.ts state <dossier>                    situation du pays
//   node tools/playtest.ts run <dossier> <semaines>           fait avancer le temps (s'arrête sur un événement qui te concerne)
//   node tools/playtest.ts do <dossier> <ordre> [arguments]   donne un ordre (voir `help`)
//   node tools/playtest.ts help
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { decodeRle } from '../src/map/codec.ts';
import type { WorldData } from '../src/map/types.ts';
import { describeEvent } from '../src/game/events.ts';
import { formatDate } from '../src/game/time.ts';
import { BUILD_NAMES } from '../src/game/buildings.ts';
import { AI_PROFILES, TICKS_PER_WEEK } from '../src/sim/balance.ts';
import { DOCTRINE_AXES, archetypeName } from '../src/sim/doctrine.ts';
import type { BuildKind, SimEvent, SimSave, Stance } from '../src/sim/protocol.ts';
import { Simulation } from '../src/sim/Simulation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const world: WorldData = JSON.parse(readFileSync(join(root, 'public/map/world.json'), 'utf8'));
const W = world.width;
const cellCount = world.width * world.height;
const readGrid = (name: string) => {
  const raw = inflateSync(readFileSync(join(root, 'public/map', name)));
  return decodeRle(new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2).slice(), cellCount);
};
const provinceGrid = readGrid('provinces.dat');
const terrainGrid = Uint8Array.from(readGrid('terrain.dat'));
const riverGrid = Uint8Array.from(readGrid('rivers.dat'));
const ownerGrid = new Uint16Array(provinceGrid.length);
for (let i = 0; i < provinceGrid.length; i++) if (provinceGrid[i]) ownerGrid[i] = world.provinces[provinceGrid[i] - 1].nation + 1;

const nameOf = (id: number) => world.nations[id - 1]?.name ?? `pays ${id}`;
const idOf = (name: string) => {
  const exact = world.nations.findIndex((n) => n.name.toLowerCase() === name.toLowerCase());
  if (exact >= 0) return exact + 1;
  const candidates = world.nations.map((n, i) => [n.name, i + 1] as const).filter(([n]) => n.toLowerCase().startsWith(name.toLowerCase()));
  if (candidates.length === 1) return candidates[0][1];
  if (candidates.length > 1) throw new Error(`Nom ambigu « ${name} » : ${candidates.map(([n]) => n).join(', ')} (mets le nom entre guillemets)`);
  throw new Error(`Pays inconnu : ${name}`);
};
const provinceName = (p: number) => world.provinces[p - 1]?.name ?? `province ${p}`;

interface Meta {
  player: number;
  seed: number;
  start: { output: number; cells: number; army: number; capacity: number };
  /** Événements qui te concernent, depuis le dernier appel. */
  log: string[];
}

function makeSim(player: number, seed: number, saved?: SimSave): Simulation {
  return new Simulation({
    width: world.width,
    height: world.height,
    nations: world.nations,
    provinces: world.provinces,
    provinceGrid,
    ownerGrid: ownerGrid.slice(),
    terrainGrid,
    riverGrid,
    seed,
    player,
    saved,
  });
}

function store(dir: string, sim: Simulation, meta: Meta): void {
  mkdirSync(dir, { recursive: true });
  const save = sim.save();
  writeFileSync(join(dir, 'owners.bin'), deflateSync(Buffer.from(save.owners.buffer, save.owners.byteOffset, save.owners.byteLength)));
  writeFileSync(join(dir, 'supply.bin'), deflateSync(Buffer.from(save.supply)));
  writeFileSync(join(dir, 'forts.bin'), deflateSync(Buffer.from(save.forts)));
  writeFileSync(join(dir, 'state.json'), JSON.stringify(save.state));
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
}

function load(dir: string): { sim: Simulation; meta: Meta } {
  if (!existsSync(join(dir, 'meta.json'))) throw new Error(`Pas de partie dans ${dir} : lance d'abord « new ».`);
  const meta: Meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const ownersRaw = inflateSync(readFileSync(join(dir, 'owners.bin')));
  const saved: SimSave = {
    owners: new Uint16Array(ownersRaw.buffer.slice(ownersRaw.byteOffset, ownersRaw.byteOffset + ownersRaw.byteLength)),
    supply: new Uint8Array(inflateSync(readFileSync(join(dir, 'supply.bin')))),
    forts: new Uint8Array(inflateSync(readFileSync(join(dir, 'forts.bin')))),
    state: JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')),
  };
  return { sim: makeSim(meta.player, meta.seed, saved), meta };
}

const pct = (v: number) => `${Math.round(v * 100)} %`;
const signed = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)} %`;
const md = (musd: number) => (musd >= 1e6 ? `${(musd / 1e6).toFixed(2)} Bn $` : `${Math.round(musd / 1e3)} Md $`);

/** Ce qui concerne le joueur : guerres, paix, demandes, offres… avec lui, ou ses voisins. */
function concerns(event: SimEvent, player: number, near: Set<number>): boolean {
  const ids = Object.entries(event)
    .filter(([key]) => key !== 'tick' && key !== 'type' && key !== 'origin')
    .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is number => typeof v === 'number');
  if (event.type === 'demand') return event.parent === player;
  if (ids.includes(player)) return true;
  return (event.type === 'war' || event.type === 'capitulation') && ids.some((id) => near.has(id));
}

/** Événements qui mettraient le jeu en pause au navigateur. */
function interrupts(event: SimEvent, player: number): boolean {
  if (event.type === 'war' && (event.a === player || event.b === player)) return true;
  if (event.type === 'demand' && event.parent === player) return true;
  if (event.type === 'peaceOffer' && event.to === player) return true;
  if (event.type === 'secession' && event.parent === player) return true;
  if (event.type === 'capitulation' && (event.loser === player || event.winner === player)) return true;
  return false;
}

function neighborsOf(sim: Simulation, player: number): { land: number[]; sea: number[] } {
  const internals = sim as unknown as { landNeighbors: number[][]; seaNeighbors: number[][] };
  const land = internals.landNeighbors[player] ?? [];
  const sea = (internals.seaNeighbors[player] ?? []).filter((n) => !land.includes(n));
  return { land, sea };
}

function rankOf(values: (n: number) => number, sim: Simulation, player: number): number {
  const mine = values(player);
  let rank = 1;
  for (let n = 1; n <= world.nations.length; n++) if (n !== player && sim.isAlive(n) && values(n) > mine) rank++;
  return rank;
}

function report(sim: Simulation, meta: Meta): string {
  const p = meta.player;
  const snap = sim.snapshot();
  const me = snap.nations.find((n) => n.id === p);
  const lines: string[] = [];
  lines.push(`=== ${nameOf(p)} — ${formatDate(sim.tick)} (semaine ${Math.floor(sim.tick / TICKS_PER_WEEK)}) — ${snap.aliveNations} pays en vie ===`);
  if (!sim.isAlive(p) || !me) {
    lines.push('TON PAYS N\'EXISTE PLUS : partie perdue.');
    return lines.join('\n');
  }
  const output = sim.outputOf(p);
  lines.push(
    `PIB ${md(output)} (${signed(output / meta.start.output - 1)} depuis le départ, rang ${rankOf((n) => sim.outputOf(n), sim, p)}) · ` +
      `territoire ${sim.cellsOf(p)} cellules (${signed(sim.cellsOf(p) / meta.start.cells - 1)}, rang ${rankOf((n) => sim.cellsOf(n), sim, p)}) · ` +
      `capacité militaire ${Math.round(sim.capacityOf(p))} (rang ${rankOf((n) => sim.capacityOf(n), sim, p)})`,
  );
  lines.push(
    `Armée ${Math.round(me.army)} (réserve ${Math.round(me.reserve)}) · marine ${Math.round(me.navy)} · main-d'œuvre ${Math.round(me.manpower)}/${Math.round(me.manpowerMax)} · ` +
      `stabilité ${pct(me.stability)} · pétrole ${pct(me.oil)} · acier ${pct(me.steel)} · commerce ${pct(me.trade)}${me.blockaded ? ' · SOUS BLOCUS' : ''}`,
  );
  lines.push(
    `Effort de guerre ${pct(me.effort)} (visé ${pct(me.effortTarget)}, max ${pct(me.effortCap)}) · croissance ${(me.growth * 100).toFixed(2)} %/sem · ` +
      `chantiers ${Math.round(me.construction)} pts/sem (part militaire ${pct(me.militaryShare)}) · agressivité ${pct(me.aggression)}`,
  );
  const doctrine = me.doctrine.map((v, i) => `${DOCTRINE_AXES[i].name} ${v.toFixed(2)}→${me.doctrineTarget[i].toFixed(2)} (rech. ${me.research[i]})`).join(', ');
  lines.push(`Doctrine « ${archetypeName(me.doctrine)} » : ${doctrine}`);
  if (me.builds.length > 0) {
    lines.push(`File de chantiers : ${me.builds.map((b) => `${BUILD_NAMES[b.kind]}${b.province ? ` (${provinceName(b.province)})` : ''} ${Math.round((b.progress / Math.max(1, b.cost)) * 100)} %`).join(' ; ')}`);
  } else lines.push('File de chantiers : vide');

  // Fronts.
  const fronts = snap.fronts.filter((f) => f.a === p || f.b === p);
  if (fronts.length > 0) {
    lines.push('--- Guerres ---');
    for (const f of fronts) {
      const mine = f.a === p ? f.sides[0] : f.sides[1];
      const theirs = f.a === p ? f.sides[1] : f.sides[0];
      const enemy = f.a === p ? f.b : f.a;
      lines.push(
        `${nameOf(enemy)} : forces sur le front ${Math.round(mine.force)} contre ${Math.round(theirs.force)} · ta posture ${mine.stance} à ${pct(mine.allocation)} · la sienne ${theirs.stance} · ` +
          `gains nets ${mine.captured - theirs.captured} cellules · ravitaillement ${pct(mine.supply)}/${pct(theirs.supply)} · longueur ${f.length}` +
          (f.peace ? ` · à la paix : tu gardes ${f.peace.provincesGained} provinces, tu en rends ${f.peace.provincesLost}` : ''),
      );
    }
  }
  const offensives = snap.offensives.filter((o) => o.nation === p);
  if (offensives.length > 0) lines.push(`Tes offensives : ${offensives.map((o) => `#${o.id} force ${Math.round(o.force)}/${Math.round(o.startForce)}${o.inTransit ? ' (en mer)' : ''}`).join(' ; ')}`);
  const against = snap.offensives.filter((o) => o.nation !== p && fronts.some((f) => f.a === o.nation || f.b === o.nation));
  if (against.length > 0) lines.push(`Offensives ennemies : ${against.map((o) => `${nameOf(o.nation)} force ${Math.round(o.force)}`).join(' ; ')}`);

  // Voisins.
  const { land, sea } = neighborsOf(sim, p);
  const describe = (n: number) => {
    const rel = sim.isAllied(p, n) ? 'pacte' : fronts.some((f) => f.a === n || f.b === n) ? 'GUERRE' : sim.hasTruce(p, n) ? 'trêve' : 'paix';
    const trade = sim.hasTradeDeal(p, n) ? ', accord' : sim.hasEmbargo(p, n) ? ', ton embargo' : sim.hasEmbargo(n, p) ? ', son embargo' : '';
    const profile = AI_PROFILES[sim.profileOf(n)]?.name ?? '?';
    return `${nameOf(n)} [${rel}${trade}] armée ${Math.round(sim.armyOf(n))} (toi ${Math.round(sim.armyOf(p))}), PIB ${md(sim.outputOf(n))}, agressivité ${pct(sim.aggressionOf(n))}, ${profile}`;
  };
  lines.push('--- Voisins par la terre ---');
  for (const n of land.filter((n) => sim.isAlive(n))) lines.push(`  ${describe(n)}`);
  if (sea.length > 0) lines.push(`--- Voisins par la mer --- ${sea.filter((n) => sim.isAlive(n)).map(nameOf).join(', ')}`);
  lines.push(`Accords : ${me.deals.map(nameOf).join(', ') || 'aucun'} · à portée d'un accord : ${me.dealReach.length} pays · pactes : ${me.allies.map(nameOf).join(', ') || 'aucun'}`);
  if (me.peaceOffers.length > 0) lines.push(`OFFRES DE PAIX REÇUES : ${me.peaceOffers.map((o) => nameOf(o.nation)).join(', ')} (do accepter-paix / refuser-paix)`);
  if (me.truces.length > 0) lines.push(`Trêves : ${me.truces.map((t) => `${nameOf(t.nation)} jusqu'au ${formatDate(t.until)}`).join(', ')}`);

  // Régions.
  const agitated = me.movements.filter((m) => m.unrest > 0.2 || m.demand);
  if (agitated.length > 0) {
    lines.push('--- Régions agitées ---');
    for (const m of agitated) {
      lines.push(`  ${nameOf(m.origin)} (id ${m.origin}) : agitation ${pct(m.unrest)} → plafond ${pct(m.ceiling)}, ${pct(m.share)} du pays, équipée ${pct(m.care)}${m.demand ? `, DEMANDE ${m.demand === 'investment' ? 'des investissements' : "l'indépendance"}` : ''}${m.investing ? ', investissements en cours' : ''}`);
    }
  }
  if (meta.log.length > 0) {
    lines.push('--- Depuis ton dernier coup d\'œil ---');
    for (const line of meta.log.slice(-25)) lines.push(`  ${line}`);
    meta.log = [];
  }
  return lines.join('\n');
}

function runWeeks(sim: Simulation, meta: Meta, weeks: number): string {
  const p = meta.player;
  const end = sim.tick + Math.round(weeks * TICKS_PER_WEEK);
  const near = new Set([...neighborsOf(sim, p).land, ...neighborsOf(sim, p).sea]);
  let stopped = '';
  let world = 0;
  while (sim.tick < end) {
    sim.step();
    if (sim.tick % 50 !== 0) continue;
    for (const event of sim.drainChanges().events) {
      if (concerns(event, p, near)) meta.log.push(`${formatDate(event.tick)} : ${describeEvent(event, nameOf)}`);
      else if (event.type === 'war' || event.type === 'capitulation') world++;
      if (!stopped && interrupts(event, p)) stopped = describeEvent(event, nameOf);
    }
    if (stopped || !sim.isAlive(p)) break;
  }
  const head = stopped ? `ARRÊT (le jeu se mettrait en pause) : ${stopped}\n` : '';
  return `${head}(${world} guerres ou capitulations ailleurs dans le monde pendant ce temps)\n`;
}

/** Une offensive depuis ta ligne vers la province la plus riche de l'ennemi, à portée. */
function offensiveToward(sim: Simulation, p: number, enemy: number, share: number): string {
  const owners = (sim as unknown as { owners: Uint16Array }).owners;
  // Cible : sa province la plus riche qu'il tient.
  let target = 0;
  for (let q = 1; q <= world.provinces.length; q++) {
    if (sim.controllerOf(q) !== enemy) continue;
    if (target === 0 || world.provinces[q - 1].gdpMusd > world.provinces[target - 1].gdpMusd) target = q;
  }
  if (target === 0) return 'Aucune province ennemie.';
  const tx = Math.round(world.provinces[target - 1].x);
  const ty = Math.round(world.provinces[target - 1].y);
  // Départ : ta cellule la plus proche de la cible.
  let best = -1;
  let bestD = Infinity;
  for (let cell = 0; cell < owners.length; cell++) {
    if (owners[cell] !== p) continue;
    const x = cell % W;
    const y = (cell - x) / W;
    let dx = Math.abs(x - tx);
    dx = Math.min(dx, W - dx);
    const d = dx * dx + (y - ty) ** 2;
    if (d < bestD) [best, bestD] = [cell, d];
  }
  const fx = best % W;
  const fy = (best - fx) / W;
  let dx = tx - fx;
  if (dx > W / 2) dx -= W;
  if (dx < -W / 2) dx += W;
  const dy = ty - fy;
  const length = Math.hypot(dx, dy);
  const reach = Math.min(1, 95 / Math.max(1, length));
  const toX = (((Math.round(fx + dx * reach)) % W) + W) % W;
  const toY = Math.round(fy + dy * reach);
  const id = sim.launchOffensive(p, fx, fy, toX, toY, share);
  return id ? `Offensive #${id} lancée vers ${provinceName(target)} (${Math.round(length)} cellules, flèche de ${Math.round(length * reach)}).` : `Offensive refusée (réserve trop faible, trop d'offensives, ou départ impossible).`;
}

/** Provinces où bâtir, les plus riches d'abord. */
function buildChoices(sim: Simulation, p: number): string {
  const kinds: BuildKind[] = ['factory', 'infrastructure', 'depot', 'refinery', 'steelworks', 'recruitment', 'services', 'shipyard'];
  const mine = [];
  for (let q = 1; q <= world.provinces.length; q++) if (sim.controllerOf(q) === p) mine.push(q);
  mine.sort((a, b) => world.provinces[b - 1].gdpMusd - world.provinces[a - 1].gdpMusd);
  const lines = [`${mine.length} provinces. Chantiers possibles (provinces les plus riches d'abord, coût en points) :`];
  for (const kind of kinds) {
    const options = mine.filter((q) => sim.canBuild(p, q, kind, 0)).slice(0, 4);
    if (options.length === 0) continue;
    lines.push(`  ${kind} (${BUILD_NAMES[kind]}, ${sim.buildCost(options[0], kind)} pts) : ${options.map((q) => `${provinceName(q)} [${q}]`).join(', ')}`);
  }
  return lines.join('\n');
}

const HELP = `Ordres (do <dossier> <ordre> ...). Les pays se désignent par leur nom (ou son début).
  guerre <pays>                     déclarer la guerre
  front <pays> <0..1> <attack|hold|retreat>   forces engagées sur ce front et posture
  offensive <pays> [part 0..1]      flèche d'offensive vers sa province la plus riche (part de ta réserve, défaut 0.5)
  paix <pays>                       proposer la paix (l'IA répond aussitôt)
  accepter-paix <pays> / refuser-paix <pays>
  pacte <pays> / rompre-pacte <pays>
  accord <pays> / fin-accord <pays> / embargo <pays> / lever-embargo <pays>
  fortifier <pays>                  bande de fortifications le long de la frontière (file militaire)
  effort <0..1>                     effort de guerre visé (l'économie s'y reconvertit peu à peu)
  part-militaire <0..1>             part des chantiers pour la file militaire
  contre-attaque <0..1>             part de l'armée gardée pour contrer les percées
  chantiers                         liste les chantiers possibles
  batir <id province> <type>        type : factory, infrastructure, depot, refinery, steelworks, recruitment, services, shipyard
  annuler-chantier <index>
  doctrine <axe 0..4> <-1..1>       cible de doctrine (0 manœuvre : -position/+mouvement, 1 recrutement : -qualité/+masse,
                                    2 armes : -sol/+air, 3 échanges : -autarcie/+libre-échange, 4 état : -autonomie/+centralisation)
  recherche <axe 0..4>              recherche le niveau suivant de cet axe
  demande <id région> <oui|non>     répondre à la demande d'une région
  independance <id région>          lui rendre son indépendance
  politique <id région> <impôts -2..2> <levée -2..2>`;

function order(sim: Simulation, meta: Meta, args: string[]): string {
  const p = meta.player;
  const [verb, ...rest] = args;
  const nation = () => idOf(rest[0]);
  const num = (i: number) => {
    const v = Number(rest[i]);
    if (!Number.isFinite(v)) throw new Error(`Nombre attendu : ${rest[i]}`);
    return v;
  };
  switch (verb) {
    case 'guerre':
      sim.apply({ type: 'declareWars', pairs: [[p, nation()]] });
      return `Guerre déclarée à ${nameOf(nation())} (si c'était possible : voisin, ou marine pour débarquer).`;
    case 'front':
      sim.apply({ type: 'setFront', nation: p, enemy: nation(), allocation: num(1), stance: (rest[2] ?? 'hold') as Stance });
      return `Front ${nameOf(nation())} : ${pct(num(1))}, ${rest[2] ?? 'hold'}.`;
    case 'offensive':
      return offensiveToward(sim, p, nation(), rest[1] ? num(1) : 0.5);
    case 'paix':
      sim.apply({ type: 'proposePeace', nation: p, enemy: nation() });
      return `Paix proposée à ${nameOf(nation())} : voir le résultat dans l'état (guerre finie ou non).`;
    case 'accepter-paix':
    case 'refuser-paix':
      sim.apply({ type: 'answerPeace', nation: p, enemy: nation(), accept: verb === 'accepter-paix' });
      return 'Réponse envoyée.';
    case 'pacte':
      return sim.proposeAlliance(p, nation()) ? `Pacte signé avec ${nameOf(nation())}.` : `${nameOf(nation())} refuse le pacte.`;
    case 'rompre-pacte':
      sim.apply({ type: 'breakAlliance', nation: p, other: nation() });
      return 'Pacte rompu.';
    case 'accord':
      return sim.proposeTradeDeal(p, nation()) ? `Accord commercial signé avec ${nameOf(nation())}.` : `${nameOf(nation())} refuse l'accord (ou hors de portée, ou plus de place).`;
    case 'fin-accord':
      sim.apply({ type: 'endTradeDeal', nation: p, other: nation() });
      return 'Accord rompu.';
    case 'embargo':
    case 'lever-embargo':
      sim.apply({ type: 'setEmbargo', nation: p, other: nation(), on: verb === 'embargo' });
      return 'Fait.';
    case 'fortifier':
      sim.apply({ type: 'fortifyFront', nation: p, enemy: nation() });
      return `Fortification de la frontière avec ${nameOf(nation())} ajoutée à la file militaire.`;
    case 'effort':
      sim.apply({ type: 'setEffort', nation: p, effort: num(0) });
      return `Effort de guerre visé : ${pct(num(0))}.`;
    case 'part-militaire':
      sim.apply({ type: 'setMilitaryShare', nation: p, share: num(0) });
      return 'Fait.';
    case 'contre-attaque':
      sim.apply({ type: 'setCounterShare', nation: p, share: num(0) });
      return 'Fait.';
    case 'chantiers':
      return buildChoices(sim, p);
    case 'batir': {
      const before = sim.buildQueueOf(p).length;
      sim.apply({ type: 'build', nation: p, province: num(0), kind: rest[1] as BuildKind });
      return sim.buildQueueOf(p).length > before ? `${BUILD_NAMES[rest[1] as BuildKind]} ajouté(e) à la file (${provinceName(num(0))}).` : 'Chantier impossible ici.';
    }
    case 'annuler-chantier':
      sim.apply({ type: 'cancelBuild', nation: p, index: num(0) });
      return 'Fait.';
    case 'doctrine':
      sim.apply({ type: 'setDoctrine', nation: p, axis: num(0), value: num(1) });
      return 'Cible de doctrine fixée.';
    case 'recherche': {
      const before = sim.buildQueueOf(p).length;
      sim.apply({ type: 'research', nation: p, axis: num(0) });
      return sim.buildQueueOf(p).length > before ? 'Recherche ajoutée à la file militaire.' : 'Recherche impossible : niveau maximal atteint, ou déjà en file.';
    }
    case 'demande':
      sim.apply({ type: 'answerDemand', nation: p, origin: num(0), accept: rest[1] === 'oui' });
      return 'Réponse envoyée.';
    case 'independance':
      sim.apply({ type: 'grantIndependence', nation: p, origin: num(0) });
      return 'Indépendance accordée.';
    case 'politique':
      sim.apply({ type: 'setRegionPolicy', nation: p, origin: num(0), tax: num(1), levy: num(2) });
      return 'Politique régionale fixée.';
    default:
      return `Ordre inconnu : ${verb}\n${HELP}`;
  }
}

const [mode, dir, ...args] = process.argv.slice(2);
try {
  if (mode === 'help' || !mode) console.log(`${readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 8).join('\n')}\n\n${HELP}`);
  else if (mode === 'new') {
    const player = idOf(args[0]);
    const seed = Number(args[1] ?? 1);
    const sim = makeSim(player, seed);
    const meta: Meta = { player, seed, start: { output: sim.outputOf(player), cells: sim.cellsOf(player), army: sim.armyOf(player), capacity: sim.capacityOf(player) }, log: [] };
    console.log(report(sim, meta));
    store(dir, sim, meta);
  } else if (mode === 'state') {
    const { sim, meta } = load(dir);
    console.log(report(sim, meta));
    store(dir, sim, meta);
  } else if (mode === 'run') {
    const { sim, meta } = load(dir);
    const out = runWeeks(sim, meta, Number(args[0] ?? 4));
    console.log(out + report(sim, meta));
    store(dir, sim, meta);
  } else if (mode === 'do') {
    const { sim, meta } = load(dir);
    const out = order(sim, meta, args);
    for (const event of sim.drainChanges().events) meta.log.push(`${formatDate(event.tick)} : ${describeEvent(event, nameOf)}`);
    console.log(out);
    store(dir, sim, meta);
    appendFileSync(join(dir, 'orders.log'), `${formatDate(sim.tick)} ${args.join(' ')} → ${out.split('\n')[0]}\n`);
  } else console.log(HELP);
} catch (error) {
  console.error(`Erreur : ${(error as Error).message}`);
  process.exit(1);
}
