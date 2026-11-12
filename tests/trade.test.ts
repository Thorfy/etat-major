import { describe, expect, it } from 'vitest';
import { AXIS_BONUS, TRADE_DEAL_GAIN, TRADE_DEPENDENCE } from '../src/sim/balance.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const W = 200;
const H = 80;
const A = 1;
const B = 2;
const C = 3;

/**
 * Une carte en blocs, en provinces de 20 × 20 cellules ; `owner` donne 0 pour la mer.
 */
function config(owner: (x: number, y: number) => number, nations: number, options: Partial<SimConfig> = {}): SimConfig {
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
    ...options,
  };
}

/**
 * A, B et C côte à côte : A ne touche que B. La carte boucle en longitude : un étroit bras d'eau,
 * trop petit pour être une mer, sépare C de A.
 */
const row = (options: Partial<SimConfig> = {}) => new Simulation(config((x) => (x < 60 ? A : x < 130 ? B : x < 196 ? C : 0), 3, options));
const run = (sim: Simulation, ticks: number) => {
  for (let t = 0; t < ticks; t++) {
    for (const front of sim.fronts) {
      sim.setFront(front.a, front.b, 0.2, 'hold');
      sim.setFront(front.b, front.a, 0.2, 'hold');
    }
    sim.step();
  }
};

describe('commerce entre pays', () => {
  it('commerce avec tous ses voisins en paix, sans rien gagner ni perdre', () => {
    const sim = row();
    run(sim, 20);
    expect(sim.tradeAccessOf(A)).toBe(1);
    expect(sim.tradeFactorOf(A)).toBe(1);
  });

  it('perd ses échanges avec un pays en guerre, et une part de son PIB', () => {
    const sim = row();
    run(sim, 20);
    const before = sim.outputOf(A);
    sim.declareWars([[A, B]]);
    run(sim, 20);
    // A ne touchait que B : il est coupé de tout. B commerce encore avec C.
    expect(sim.tradeAccessOf(A)).toBe(0);
    expect(sim.tradeFactorOf(A)).toBeCloseTo(1 - TRADE_DEPENDENCE, 10);
    expect(sim.tradeAccessOf(B)).toBeGreaterThan(0.3);
    expect(sim.tradeAccessOf(B)).toBeLessThan(0.7);
    expect(sim.outputOf(A)).toBeLessThan(before * (1 - TRADE_DEPENDENCE / 2));
  });

  it('gagne à un accord commercial, que rompt un embargo', () => {
    const sim = row();
    expect(sim.proposeTradeDeal(A, B)).toBe(true);
    run(sim, 20);
    expect(sim.tradeFactorOf(A)).toBeCloseTo(1 + TRADE_DEAL_GAIN, 2);
    expect(sim.dealsOf(B)).toEqual([A]);
    sim.setEmbargo(A, B, true);
    run(sim, 20);
    expect(sim.dealsOf(A)).toEqual([]);
    expect(sim.tradeAccessOf(A)).toBe(0);
    expect(sim.tradeAccessOf(B)).toBeLessThan(1);
    sim.setEmbargo(A, B, false);
    run(sim, 20);
    expect(sim.tradeAccessOf(A)).toBe(1);
  });

  it("se voit refuser un accord, trop agressif, et pas avec un pays qu'il ne touche pas", () => {
    const sim = row();
    expect(sim.proposeTradeDeal(A, C)).toBe(false);
    (sim as unknown as { aggression: Float64Array }).aggression[A] = 0.5;
    expect(sim.proposeTradeDeal(A, B)).toBe(false);
  });

  it("subit l'embargo de ses voisins s'il est trop agressif, levé quand il se calme", () => {
    const sim = row({ ai: true });
    const internals = sim as unknown as { aggression: Float64Array };
    internals.aggression[A] = 0.7;
    run(sim, 200);
    expect(sim.hasEmbargo(B, A)).toBe(true);
    expect(sim.tradeAccessOf(A)).toBe(0);
    internals.aggression[A] = 0.2;
    run(sim, 200);
    expect(sim.hasEmbargo(B, A)).toBe(false);
  });

  it('commerce par la mer avec un pays lointain, sauf sous blocus', () => {
    // A et B sur deux îles séparées par la mer : aucun voisin par la terre.
    const sim = new Simulation(config((x, y) => (y < 10 || y >= 70 ? 0 : x < 60 ? A : x >= 140 ? B : 0), 2));
    run(sim, 20);
    expect(sim.tradeAccessOf(A)).toBe(1);
    sim.setEmbargo(B, A, true);
    run(sim, 20);
    expect(sim.tradeAccessOf(A)).toBe(0);
  });
});

describe('axes commerciaux', () => {
  /** A seul, sur toute la largeur, au-dessus de B. */
  const wide = () => new Simulation(config((_, y) => (y < 40 ? A : B), 2));

  it('enrichissent les provinces traversées, une fois bâtis', () => {
    const sim = wide();
    run(sim, 20);
    const before = sim.capacityOf(A);
    expect(sim.buildAxis(A, 10, 20, 90, 20)).toBeGreaterThan(60);
    expect(sim.buildQueueOf(A)[0].kind).toBe('axis');
    for (let t = 0; t < 600 * 60 && sim.tradeAxes.length === 0; t++) sim.step();
    expect(sim.tradeAxes).toHaveLength(1);
    const axis = sim.tradeAxes[0];
    expect(axis.active).toBe(true);
    expect(axis.sea).toBe(false);
    expect(axis.provinces.length).toBe(5);
    run(sim, 20);
    // 5 provinces sur 20 gagnent AXIS_BONUS chacune.
    expect(sim.capacityOf(A)).toBeGreaterThan(before * (1 + AXIS_BONUS * 0.2));
  });

  it("sont coupés dès que l'ennemi prend une province du tracé, et revivent quand on la reprend", () => {
    const sim = wide();
    sim.buildAxis(A, 10, 20, 90, 20);
    for (let t = 0; t < 600 * 60 && sim.tradeAxes.length === 0; t++) sim.step();
    const province = sim.tradeAxes[0].provinces[2];
    const controller = (sim as unknown as { controller: Uint16Array }).controller;
    controller[province] = B;
    run(sim, 20);
    expect(sim.tradeAxes[0].active).toBe(false);
    const events = sim.drainChanges().events;
    expect(events.some((event) => event.type === 'axisCut' && event.nation === A && event.by === B)).toBe(true);
    controller[province] = A;
    run(sim, 20);
    expect(sim.tradeAxes[0].active).toBe(true);
  });

  it("relient deux îles par une ligne maritime", () => {
    const sim = new Simulation(config((x, y) => (y < 10 || y >= 70 ? 0 : x < 60 ? A : x >= 100 && x < 160 ? A : x >= 170 ? B : 0), 2));
    expect(sim.buildAxis(A, 50, 40, 110, 40)).toBeGreaterThan(0);
    for (let t = 0; t < 600 * 60 && sim.tradeAxes.length === 0; t++) sim.step();
    expect(sim.tradeAxes[0].sea).toBe(true);
    expect(sim.tradeAxes[0].provinces).toHaveLength(2);
  });

  it('reprennent les tronçons déjà tracés, sans les payer deux fois', () => {
    const sim = wide();
    sim.buildAxis(A, 10, 20, 90, 20);
    for (let t = 0; t < 600 * 60 && sim.tradeAxes.length === 0; t++) sim.step();
    // Prolonger la route : seules les 20 cellules nouvelles se paient.
    expect(sim.buildAxis(A, 10, 20, 110, 20)).toBe(20);
    for (let t = 0; t < 600 * 60 && sim.tradeAxes.length === 1; t++) sim.step();
    expect(sim.tradeAxes[1].provinces.slice(0, 5)).toEqual(sim.tradeAxes[0].provinces);
  });

  it('se refusent hors de son sol', () => {
    const sim = wide();
    expect(sim.buildAxis(A, 10, 20, 170, 60)).toBe(0);
  });

  it("entrent chez un partenaire commercial, l'enrichissent, et sont coupés à la fin de l'accord", () => {
    const sim = wide();
    // Sans accord, pas de route chez B.
    expect(sim.buildAxis(A, 10, 20, 10, 70)).toBe(0);
    expect(sim.proposeTradeDeal(A, B)).toBe(true);
    expect(sim.buildAxis(A, 10, 20, 10, 70)).toBeGreaterThan(0);
    for (let t = 0; t < 600 * 60 && sim.tradeAxes.length === 0; t++) sim.step();
    const axis = sim.tradeAxes[0];
    expect(axis.active).toBe(true);
    const theirs = axis.provinces.filter((p) => sim.controllerOf(p) === B);
    expect(theirs.length).toBeGreaterThan(0);
    // Les provinces de B traversées gagnent elles aussi le bonus.
    const bonus = (sim as unknown as { axisBonus: Float64Array }).axisBonus;
    for (const p of theirs) expect(bonus[p]).toBeGreaterThan(0);
    sim.endTradeDeal(A, B);
    run(sim, 20);
    expect(sim.tradeAxes[0].active).toBe(false);
    for (const p of theirs) expect(bonus[p]).toBe(0);
    expect(sim.proposeTradeDeal(A, B)).toBe(true);
    run(sim, 20);
    expect(sim.tradeAxes[0].active).toBe(true);
  });
});

describe('sauvegarde du commerce', () => {
  it('garde accords, embargos et axes', () => {
    const make = () => config((x, y) => (y < 40 ? A : x < 100 ? B : C), 3);
    const sim = new Simulation(make());
    sim.proposeTradeDeal(A, B);
    sim.setEmbargo(C, A, true);
    sim.buildAxis(A, 10, 20, 90, 20);
    for (let t = 0; t < 600 * 60 && sim.tradeAxes.length === 0; t++) sim.step();
    run(sim, 30);
    const save = sim.save();
    const resumed = new Simulation({ ...make(), saved: { owners: save.owners, supply: save.supply, forts: save.forts, state: JSON.parse(JSON.stringify(save.state)) } });
    expect(resumed.stateHash()).toBe(sim.stateHash());
    expect(resumed.hasTradeDeal(A, B)).toBe(true);
    expect(resumed.hasEmbargo(C, A)).toBe(true);
    expect(resumed.tradeAxes).toHaveLength(1);
    run(sim, 100);
    run(resumed, 100);
    expect(resumed.stateHash()).toBe(sim.stateHash());
    expect(resumed.capacityOf(A)).toBeCloseTo(sim.capacityOf(A), 6);
  });
});

describe("tempéraments de l'IA", () => {
  it('se tirent tous, selon la graine, et se gardent dans la sauvegarde', () => {
    const make = (seed: number) => config((x) => (x < 100 ? A : B), 200, { seed });
    const sim = new Simulation(make(5));
    const counts = [0, 0, 0, 0];
    for (let n = 1; n <= 200; n++) counts[sim.profileOf(n)]++;
    for (const count of counts) expect(count).toBeGreaterThan(15);
    // Une autre graine, d'autres tempéraments.
    const other = new Simulation(make(6));
    expect([...Array(200).keys()].some((i) => other.profileOf(i + 1) !== sim.profileOf(i + 1))).toBe(true);
    const save = sim.save();
    const resumed = new Simulation({ ...make(6), saved: { owners: save.owners, supply: save.supply, forts: save.forts, state: JSON.parse(JSON.stringify(save.state)) } });
    for (let n = 1; n <= 200; n++) expect(resumed.profileOf(n)).toBe(sim.profileOf(n));
  });
});
