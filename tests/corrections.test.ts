// Corrections après la flotte de testeurs : stabilité, réseau de départ, guerres fantômes, fronts sans
// contact, annexions, paix lisible, refus expliqués, offensives qui s'arrêtent.
import { describe, expect, it } from 'vitest';
import { MIN_WAR_TICKS_FOR_PEACE, PEACE_STABILITY, UNREST_STABILITY_DRAG } from '../src/sim/balance.ts';
import type { SimEvent } from '../src/sim/protocol.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const W = 200;
const H = 80;
const A = 1;
const B = 2;
const C = 3;

/** Une carte en blocs, en provinces de 20 × 20 cellules ; `owner` donne 0 pour la mer. */
function config(owner: (x: number, y: number) => number, nations: number, options: Partial<SimConfig> = {}, weights: number[] = []): SimConfig {
  const ownerGrid = new Uint16Array(W * H);
  const provinceGrid = new Uint16Array(W * H);
  const ids = new Map<string, number>();
  const provinces: SimConfig['provinces'] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = owner(x, y);
      ownerGrid[y * W + x] = n;
      if (n === 0) continue;
      const key = `${n}:${Math.floor(x / 20)}:${Math.floor(y / 20)}`;
      let id = ids.get(key);
      if (!id) {
        provinces.push({ nation: n - 1, areaKm2: 10000, x: Math.floor(x / 20) * 20 + 10, y: Math.floor(y / 20) * 20 + 10, population: 1e6, gdpMusd: 1e4 });
        id = provinces.length;
        ids.set(key, id);
      }
      provinceGrid[y * W + x] = id;
    }
  }
  return {
    width: W,
    height: H,
    nations: Array.from({ length: nations }, (_, i) => ({ population: 20e6 * (weights[i] ?? 1), gdpMusd: 2e6 * (weights[i] ?? 1) })),
    provinces,
    provinceGrid,
    ownerGrid,
    seed: 5,
    player: A,
    ai: false,
    autoTrade: false,
    ...options,
  };
}

type Internals = {
  stability: Float64Array;
  movements: { parent: number; origin: number; unrest: number; share: number }[];
  peaceStabilityOf(nation: number): number;
  takeCell(cell: number, attacker: number, defender: number): unknown;
  owners: Uint16Array;
  fronts: { a: number; b: number; length: number; sides: { force: number }[] }[];
};
const inside = (sim: Simulation) => sim as unknown as Internals;

/** Donne à `taker` toutes les cellules de `from` qui satisfont `where`. */
function hand(sim: Simulation, from: number, taker: number, where: (x: number, y: number) => boolean): void {
  const internals = inside(sim);
  for (let cell = 0; cell < W * H; cell++) {
    const x = cell % W;
    const y = (cell - x) / W;
    if (internals.owners[cell] === from && where(x, y)) internals.takeCell(cell, taker, from);
  }
}

const events = (sim: Simulation): SimEvent[] => sim.drainChanges().events;

describe('stabilité', () => {
  it("une victoire sur un micro-État ne rassure presque pas, et jamais au-delà du niveau de paix", () => {
    // A immense, B minuscule (une colonne de provinces).
    const sim = new Simulation(config((x) => (x < 180 ? A : B), 2, {}, [1, 0.05]));
    inside(sim).stability[A] = 0.5;
    sim.declareWars([[A, B]]);
    hand(sim, B, A, () => true);
    for (let t = 0; t < 30; t++) sim.step();
    expect(sim.isAlive(B)).toBe(false);
    // Un vaincu vingt fois plus petit : un vingtième du bonus.
    expect(sim.stabilityOf(A)).toBeLessThan(0.52);
  });

  it('les régions agitées tirent le niveau de paix vers le bas', () => {
    const sim = new Simulation(config((x) => (x < 100 ? A : B), 2));
    expect(inside(sim).peaceStabilityOf(A)).toBeCloseTo(PEACE_STABILITY, 5);
    inside(sim).movements.push({ parent: A, origin: B, unrest: 1, share: 0.5 } as never);
    expect(inside(sim).peaceStabilityOf(A)).toBeCloseTo(PEACE_STABILITY - UNREST_STABILITY_DRAG * 0.5, 5);
  });
});

describe('réseau de départ', () => {
  it("ne gonfle pas le PIB au premier jour : il fait déjà partie de l'économie réelle", () => {
    const sim = new Simulation(config((_, y) => (y < 40 ? A : B), 2, { autoTrade: true }));
    const before = sim.outputOf(A);
    for (let t = 0; t < 300; t++) sim.step();
    expect(sim.networkOf(A)).not.toBeNull();
    expect(Math.abs(sim.outputOf(A) / before - 1)).toBeLessThan(0.01);
  });
});

describe('guerres fantômes et fronts sans contact', () => {
  it("un pays qui n'a plus une cellule capitule, même si un tiers tient ses terres", () => {
    // A et C bordent B ; A est en guerre avec B, C non. C prend tout B.
    const sim = new Simulation(config((x) => (x < 70 ? A : x < 130 ? B : C), 3));
    sim.declareWars([[A, B]]);
    hand(sim, B, C, () => true);
    for (let t = 0; t < 30; t++) sim.step();
    expect(sim.isAlive(B)).toBe(false);
    expect(sim.fronts.some((front) => front.a === B || front.b === B)).toBe(false);
  });

  it("un front sans contact ne garde aucune force, et ne compte pas dans les 100 %", () => {
    // A et B sur deux îles ; A borde aussi C par la terre.
    const sim = new Simulation(config((x, y) => (y < 10 || y >= 70 ? 0 : x < 60 ? A : x < 90 ? C : x >= 140 && x < 190 ? B : 0), 3));
    sim.declareWars([[A, B], [A, C]]);
    sim.setFront(A, B, 0.9, 'hold');
    sim.setFront(A, C, 0.8, 'hold');
    for (let t = 0; t < 200; t++) sim.step();
    const island = inside(sim).fronts.find((front) => front.a === A && front.b === B || front.a === B && front.b === A)!;
    expect(island.length).toBe(0);
    expect(island.sides[island.a === A ? 0 : 1].force).toBe(0);
    const land = sim.fronts.find((front) => (front.a === A && front.b === C) || (front.a === C && front.b === A))!;
    expect(land.sides[land.a === A ? 0 : 1].allocation).toBeCloseTo(0.8, 5);
  });

  it("l'IA accepte la paix d'une guerre sans contact, et dit pourquoi elle refuse sinon", () => {
    const sim = new Simulation(config((x, y) => (y < 10 || y >= 70 ? 0 : x < 60 ? A : x >= 140 && x < 190 ? B : 0), 2));
    sim.declareWars([[A, B]]);
    sim.proposePeace(A, B);
    expect(events(sim).find((event) => event.type === 'peaceRefused')).toMatchObject({ reason: 'early' });
    for (let t = 0; t < MIN_WAR_TICKS_FOR_PEACE + 10; t++) sim.step();
    expect(sim.proposePeace(A, B)).toBe(true);
  });
});

describe('annexions et paix', () => {
  it("à la capitulation, chaque province restante revient à l'ennemi le plus proche", () => {
    // A à l'ouest, B au centre (six colonnes de provinces), C à l'est. A prend quatre colonnes de B ;
    // B, à bout (stabilité nulle), capitule en tenant encore les deux dernières.
    const sim = new Simulation(config((x) => (x < 40 ? A : x < 160 ? B : C), 3));
    sim.declareWars([[A, B], [C, B]]);
    inside(sim).stability[B] = 0;
    hand(sim, B, A, (x) => x < 120);
    for (let t = 0; t < 30; t++) sim.step();
    expect(sim.isAlive(B)).toBe(false);
    // La colonne 120-140, voisine de A, lui revient ; la colonne 140-160, voisine de C, à C.
    const owners = inside(sim).owners;
    expect(owners[40 * W + 130]).toBe(A);
    expect(owners[40 * W + 150]).toBe(C);
  });

  it('dit ce que la paix donnerait avant de la signer', () => {
    const sim = new Simulation(config((x) => (x < 100 ? A : B), 2));
    sim.declareWars([[A, B]]);
    // A tient toute une colonne de provinces de B (x 100-120), et une partie de la suivante.
    hand(sim, B, A, (x) => x < 125);
    const terms = sim.peaceTerms(A, B);
    expect(terms.provincesGained).toBe(4);
    expect(terms.provincesLost).toBe(0);
    // La colonne suivante reste à B, qui en tient la majorité : A y rend ses 5 × 80 cellules.
    expect(terms.cellsLost).toBe(5 * 80);
    expect(sim.peaceTerms(B, A)).toMatchObject({ provincesLost: 4, cellsGained: 5 * 80 });
  });
});

describe('refus et offensives', () => {
  it('un accord ou un pacte refusé dit pourquoi', () => {
    // A ne touche que B ; C, de l'autre côté, est hors de portée.
    const sim = new Simulation(config((x) => (x < 60 ? A : x < 130 ? B : x < 196 ? C : 0), 3));
    expect(sim.proposeTradeDeal(A, C)).toBe(false);
    expect(events(sim).find((event) => event.type === 'tradeDealRefused')).toMatchObject({ reason: 'unreachable' });
    (sim as unknown as { aggression: Float64Array }).aggression[A] = 0.9;
    expect(sim.proposeAlliance(A, B)).toBe(false);
    expect(events(sim).find((event) => event.type === 'allianceRefused')).toMatchObject({ reason: 'aggressive' });
  });

  it("le joueur apprend pourquoi son offensive s'arrête", () => {
    const sim = new Simulation(config((x) => (x < 100 ? A : B), 2));
    sim.declareWars([[A, B]]);
    sim.setFront(A, B, 0.2, 'hold');
    expect(sim.launchOffensive(A, 95, 40, 125, 40, 0.8)).toBeGreaterThan(0);
    const seen: SimEvent[] = [];
    for (let t = 0; t < 6000 && !seen.some((event) => event.type === 'offensiveEnded'); t++) {
      sim.step();
      if (t % 50 === 0) seen.push(...events(sim));
    }
    seen.push(...events(sim));
    const ended = seen.find((event) => event.type === 'offensiveEnded');
    expect(ended).toBeDefined();
    expect(['reached', 'exhausted', 'stalled']).toContain((ended as { reason: string }).reason);
  });
});
