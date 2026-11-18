// Score : quatre piliers rapportés au départ, indice, date butoir.
import { describe, expect, it } from 'vitest';
import { SCORE_END_TICK, SCORE_PARTNER_SHARE } from '../src/sim/balance.ts';
import type { SimEvent } from '../src/sim/protocol.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const W = 200;
const H = 80;
const A = 1;
const B = 2;
const C = 3;

function config(owner: (x: number, y: number) => number, nations: number): SimConfig {
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
    nations: Array.from({ length: nations }, () => ({ population: 20e6, gdpMusd: 2e6 })),
    provinces,
    provinceGrid,
    ownerGrid,
    seed: 5,
    player: A,
    ai: false,
    autoTrade: false,
  };
}

const weeks = (sim: Simulation, count: number) => {
  for (let t = 0; t < count * 600; t++) sim.step();
};

describe('score', () => {
  it('part de 100 pour tous, avec des piliers à 1', () => {
    const sim = new Simulation(config((x) => (x < 60 ? A : x < 130 ? B : C), 3));
    for (const n of [A, B, C]) {
      expect(sim.scoreOf(n)).toBe(100);
      expect(sim.pillarsOf(n)).toEqual([1, 1, 1, 1]);
    }
    expect(sim.snapshot().score).toMatchObject({ index: 100, of: 3, endTick: SCORE_END_TICK, ended: false });
  });

  it('conquérir fait monter la puissance du vainqueur et baisser le vaincu', () => {
    const sim = new Simulation(config((x) => (x < 100 ? A : B), 2));
    sim.declareWars([[A, B]]);
    // A prend une colonne de provinces de B.
    const internals = sim as unknown as { owners: Uint16Array; takeCell(cell: number, attacker: number, defender: number): unknown };
    for (let cell = 0; cell < W * H; cell++) if (internals.owners[cell] === B && cell % W < 120) internals.takeCell(cell, A, B);
    weeks(sim, 1);
    expect(sim.pillarsOf(A)[1]).toBeGreaterThan(1.05);
    expect(sim.pillarsOf(B)[1]).toBeLessThan(0.95);
    // B perd une part de son territoire d'origine : sa solidité baisse.
    expect(sim.pillarsOf(B)[3]).toBeLessThan(0.95);
    expect(sim.scoreOf(A)).toBeGreaterThan(sim.scoreOf(B));
  });

  it("l'influence se compare au monde : un accord rapporte à qui y gagne le plus, rien si tout le monde en a autant", () => {
    // B neuf fois plus gros que A (une colonne de provinces contre neuf) : pour A, il compte au quart de A ;
    // pour B, A ne compte qu'au quart de A. La sphère de A grandit plus que la moyenne, celle de B moins.
    const sim = new Simulation(config((x) => (x < 20 ? A : B), 2));
    expect(sim.proposeTradeDeal(A, B)).toBe(true);
    weeks(sim, 1);
    const reachA = 1 + SCORE_PARTNER_SHARE;
    const reachB = 1 + SCORE_PARTNER_SHARE / 9;
    expect(sim.pillarsOf(A)[2]).toBeCloseTo(reachA / ((reachA + reachB) / 2), 1);
    expect(sim.pillarsOf(B)[2]).toBeLessThan(1);
    // Deux pays égaux qui signent ensemble : personne n'y gagne.
    const even = new Simulation(config((x) => (x < 100 ? A : B), 2));
    even.proposeTradeDeal(A, B);
    weeks(even, 1);
    expect(even.pillarsOf(A)[2]).toBeCloseTo(1, 5);
  });

  it('une conquête calme se relève peu à peu, jusqu\'aux trois quarts de sa valeur', () => {
    const sim = new Simulation(config((x) => (x < 100 ? A : B), 2));
    sim.declareWars([[A, B]]);
    const internals = sim as unknown as { owners: Uint16Array; takeCell(cell: number, attacker: number, defender: number): unknown; provinceGdp: Float64Array; startGdp: Float64Array; provinceHome: Uint16Array; movements: { unrest: number }[] };
    for (let cell = 0; cell < W * H; cell++) if (internals.owners[cell] === B) internals.takeCell(cell, A, B);
    for (let t = 0; t < 30; t++) sim.step();
    expect(sim.isAlive(B)).toBe(false);
    const annexed = sim.provinceGrid[40 * W + 150];
    const share = () => internals.provinceGdp[annexed] / internals.startGdp[annexed];
    expect(share()).toBeCloseTo(0.35, 2);
    // Une région calme : l'agitation reste basse.
    for (let week = 0; week < 80; week++) {
      for (const movement of internals.movements) movement.unrest = 0;
      weeks(sim, 1);
    }
    expect(share()).toBeCloseTo(0.75, 2);
  });

  it('la date butoir annonce le bilan une fois, et la partie continue', () => {
    const sim = new Simulation(config((x) => (x < 100 ? A : B), 2));
    (sim as unknown as { tick: number }).tick = SCORE_END_TICK - 2;
    const seen: SimEvent[] = [];
    for (let t = 0; t < 10; t++) {
      sim.step();
      seen.push(...sim.drainChanges().events);
    }
    expect(seen.filter((event) => event.type === 'gameEnd')).toHaveLength(1);
    expect(sim.snapshot().score?.ended).toBe(true);
  });

  it('se garde dans une sauvegarde', () => {
    const make = () => config((x) => (x < 100 ? A : B), 2);
    const sim = new Simulation(make());
    sim.proposeTradeDeal(A, B);
    weeks(sim, 2);
    const save = sim.save();
    const resumed = new Simulation({ ...make(), saved: { owners: save.owners, supply: save.supply, forts: save.forts, state: JSON.parse(JSON.stringify(save.state)) } });
    expect(resumed.scoreOf(A)).toBeCloseTo(sim.scoreOf(A), 6);
    expect(resumed.pillarsOf(A)).toEqual(sim.pillarsOf(A));
  });
});
