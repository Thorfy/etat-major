import { describe, expect, it } from 'vitest';
import { FORT_COST_PER_CELL, MAX_PRIORITY_ZONES } from '../src/sim/balance.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const A = 1;
const B = 2;
const W = 400;
const H = 60;
const ROW = 30;
const BORDER = 150;

/** A à l'ouest, B (deux fois moins riche) à l'est, provinces de 25 colonnes. */
function config(options: { gdpB?: number; ai?: boolean } = {}): SimConfig {
  const gdpB = options.gdpB ?? 1e6;
  const ownerGrid = new Uint16Array(W * H);
  const provinceGrid = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      ownerGrid[y * W + x] = x < BORDER ? A : B;
      provinceGrid[y * W + x] = Math.floor(x / 25) + 1;
    }
  }
  return {
    width: W,
    height: H,
    nations: [{ population: 50e6, gdpMusd: 2e6 }, { population: 40e6, gdpMusd: gdpB }],
    provinces: Array.from({ length: W / 25 }, (_, i) => ({
      nation: i < 6 ? 0 : 1,
      areaKm2: 20000,
      x: i * 25 + 12,
      y: ROW,
      population: 5e6,
      gdpMusd: i < 6 ? 2e6 / 6 : gdpB / 10,
    })),
    provinceGrid,
    ownerGrid,
    seed: 6,
    player: A,
    ai: options.ai ?? false,
    // Ces tests mesurent la défense : pas de bonus du réseau commercial.
    autoTrade: false,
  };
}

interface Preparation {
  forts?: boolean;
  counter?: boolean;
  priority?: boolean;
  /** Part des forces de B engagées au front ; le reste est sa réserve. */
  allocation?: number;
}

/** B se prépare (ou non), puis A lance une percée de 100 cellules : gain net de A en cellules. */
function breakthrough(preparation: Preparation): { gain: number; captured: number; counters: number } {
  const sim = new Simulation(config());
  sim.declareWars([[A, B]]);
  const hold = () => {
    sim.setFront(A, B, 0.5, 'hold');
    sim.setFront(B, A, preparation.allocation ?? 1, 'hold');
  };
  if (preparation.forts) {
    sim.setEffort(B, 0);
    sim.fortifyFront(B, A);
  }
  for (let t = 0; t < 600 * 20 && (!preparation.forts || sim.buildQueueOf(B).length > 0); t++) {
    hold();
    sim.step();
  }
  sim.setEffort(B, 0.5);
  if (preparation.counter) sim.setCounterShare(B, 0.3);
  if (preparation.priority) sim.addPriority(B, BORDER + 10, ROW);
  for (let t = 0; t < 600; t++) {
    hold();
    sim.step();
  }
  const start = sim.cellsOf(A);
  const id = sim.launchOffensive(A, BORDER - 1, ROW, BORDER + 99, ROW, 0.9);
  expect(id).toBeGreaterThan(0);
  let captured = 0;
  let counters = 0;
  for (let t = 0; t < 600 * 6; t++) {
    hold();
    sim.step();
    captured = sim.offensives.find((offensive) => offensive.id === id)?.captured ?? captured;
    counters = Math.max(counters, sim.offensives.filter((offensive) => offensive.nation === B && offensive.counter).length);
  }
  return { gain: sim.cellsOf(A) - start, captured, counters };
}

describe('défense planifiée', () => {
  it('arrête avec une ligne fortifiée une percée qui passe sans elle', () => {
    const open = breakthrough({});
    const fortified = breakthrough({ forts: true });
    expect(open.captured).toBeGreaterThan(200);
    expect(fortified.captured).toBeLessThan(open.captured * 0.1);
  });

  it('réduit une percée par un secteur prioritaire sur son axe', () => {
    const open = breakthrough({});
    const prioritized = breakthrough({ priority: true });
    expect(prioritized.captured).toBeLessThan(open.captured * 0.7);
  });

  it('prend une percée en tenaille avec la réserve de contre-attaque', () => {
    // À réserve égale : gardée inactive, ou lancée d'elle-même contre la percée.
    const idle = breakthrough({ allocation: 0.65 });
    const countered = breakthrough({ allocation: 0.65, counter: true });
    expect(countered.counters).toBe(2);
    expect(countered.gain).toBeLessThan(idle.gain * 0.85);
  });
});

describe('fortifications', () => {
  it('ne fortifient qu\'une bande du territoire de la nation, contre des points de construction', () => {
    const sim = new Simulation(config());
    // Ligne qui déborde chez B : seule la partie de A est retenue.
    const cells = sim.fortifyLine(A, 140, 10, 160, 10);
    expect(cells).toBeGreaterThan(0);
    const order = sim.buildQueueOf(A)[0];
    expect(order.kind).toBe('fort');
    expect(order.cells!.every((cell) => sim.owners[cell] === A)).toBe(true);
    expect(sim.orderCost(order)).toBe(Math.ceil(cells * FORT_COST_PER_CELL));
  });

  it('renforcent une frontière en paix, à la demande du joueur seulement', () => {
    const sim = new Simulation(config());
    // L'IA (chantier urgent) ne fortifie que ses fronts.
    expect(sim.fortifyFront(B, A, true)).toBe(0);
    const cells = sim.fortifyFront(B, A);
    expect(cells).toBeGreaterThan(H);
    const order = sim.buildQueueOf(B)[0];
    expect(order.kind).toBe('fort');
    // Le long de la frontière, sur son propre sol.
    expect(order.cells!.every((cell) => sim.owners[cell] === B)).toBe(true);
    expect(order.cells!.includes(ROW * W + BORDER)).toBe(true);
  });

  it('se bâtissent, puis tombent avec les cellules prises', () => {
    const sim = new Simulation(config());
    sim.declareWars([[A, B]]);
    expect(sim.fortifyFront(B, A)).toBeGreaterThan(H);
    sim.setEffort(B, 0);
    for (let t = 0; t < 600 * 20 && sim.buildQueueOf(B).length > 0; t++) sim.step();
    const fortified = (x: number) => sim.forts[ROW * W + x] > 0;
    expect(fortified(BORDER)).toBe(true);
    expect(fortified(BORDER + 2)).toBe(true);
    expect(fortified(BORDER + 10)).toBe(false);
    // A, bien plus fort, finit par percer : une cellule prise perd sa fortification.
    for (let t = 0; t < 600 * 30 && sim.owners[ROW * W + BORDER] === B; t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0.2, 'hold');
      sim.step();
    }
    expect(sim.owners[ROW * W + BORDER]).toBe(A);
    expect(fortified(BORDER)).toBe(false);
  });

  it('se sauvegardent avec la partie', () => {
    const sim = new Simulation(config());
    sim.fortifyFront(B, A);
    sim.declareWars([[A, B]]);
    sim.fortifyFront(B, A);
    sim.setEffort(B, 0);
    for (let t = 0; t < 600 * 20 && sim.buildQueueOf(B).length > 0; t++) sim.step();
    sim.addPriority(B, BORDER + 5, ROW);
    sim.setCounterShare(B, 0.2);
    const save = sim.save();
    const resumed = new Simulation({ ...config(), saved: { owners: save.owners, supply: save.supply, forts: save.forts, state: JSON.parse(JSON.stringify(save.state)) } });
    expect(resumed.stateHash()).toBe(sim.stateHash());
    expect(resumed.forts).toEqual(sim.forts);
    expect(resumed.priorityZonesOf(B)).toEqual([{ x: BORDER + 5, y: ROW }]);
    expect(resumed.counterShareOf(B)).toBe(0.2);
  });
});

describe('secteurs prioritaires', () => {
  it('se placent sur son territoire, trois au plus', () => {
    const sim = new Simulation(config());
    sim.addPriority(A, BORDER + 20, ROW); // chez B : refusé
    for (let i = 0; i < MAX_PRIORITY_ZONES + 1; i++) sim.addPriority(A, 100 - i * 10, ROW);
    expect(sim.priorityZonesOf(A)).toHaveLength(MAX_PRIORITY_ZONES);
    sim.removePriority(A, 0);
    expect(sim.priorityZonesOf(A)).toHaveLength(MAX_PRIORITY_ZONES - 1);
  });
});

describe('IA', () => {
  it('fortifie un front où elle est en sous-nombre, et garde une réserve de contre-attaque', () => {
    const sim = new Simulation(config({ ai: true }));
    sim.declareWars([[A, B]]);
    let fortified = false;
    for (let t = 0; t < 600 * 10 && !fortified; t++) {
      sim.setFront(A, B, 1, 'hold');
      sim.step();
      fortified = sim.buildQueueOf(B).some((order) => order.kind === 'fort') || sim.forts.some((value) => value > 0);
    }
    expect(fortified).toBe(true);
    expect(sim.counterShareOf(B)).toBeGreaterThan(0);
  });
});
