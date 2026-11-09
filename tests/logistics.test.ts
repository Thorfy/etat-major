import { describe, expect, it } from 'vitest';
import { CONSOLIDATION_SECONDS, TICKS_PER_SECOND } from '../src/sim/balance.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const A = 1;
const B = 2;
const W = 600;
const H = 40;
const ROW = 20;

/**
 * Une longue bande : A à l'ouest (100 colonnes), B, bien plus faible, sur tout le reste.
 * Les provinces font 20 colonnes de large.
 */
function stripConfig(options: { logistics?: boolean; terrain?: number } = {}): SimConfig {
  const ownerGrid = new Uint16Array(W * H);
  const provinceGrid = new Uint16Array(W * H);
  const terrainGrid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      ownerGrid[y * W + x] = x < 100 ? A : B;
      provinceGrid[y * W + x] = Math.floor(x / 20) + 1;
      terrainGrid[y * W + x] = x < 100 ? 0 : options.terrain ?? 0;
    }
  }
  return {
    width: W,
    height: H,
    nations: [{ population: 50e6, gdpMusd: 2e6 }, { population: 20e6, gdpMusd: 0.3e6 }],
    provinces: Array.from({ length: W / 20 }, (_, i) => ({
      nation: i < 5 ? 0 : 1,
      areaKm2: 20000,
      x: i * 20 + 10,
      y: ROW,
      population: 1e6,
      gdpMusd: 20000,
    })),
    provinceGrid,
    ownerGrid,
    terrainGrid,
    seed: 4,
    player: A,
    ai: false,
    logistics: options.logistics,
  };
}

/** Colonne atteinte par A sur la rangée du milieu. */
const tipOf = (sim: Simulation) => {
  let x = 0;
  while (x < W && sim.owners[ROW * W + x] === A) x++;
  return x;
};

/** A tient son front et enchaîne les flèches vers l'est, toujours depuis sa pointe. */
function thrust(sim: Simulation, minutes: number): number[] {
  const tips = [tipOf(sim)];
  for (let minute = 0; minute < minutes; minute++) {
    for (let t = 0; t < 600; t++) {
      sim.setFront(A, B, 0.3, 'hold');
      sim.setFront(B, A, 1, 'hold');
      if (sim.offensives.length === 0) {
        const x = tipOf(sim) - 1;
        sim.launchOffensive(A, x, ROW, Math.min(W - 1, x + 100), ROW, 0.9);
      }
      sim.step();
    }
    tips.push(tipOf(sim));
  }
  return tips;
}

describe('percée et ravitaillement', () => {
  it('fait s\'essouffler une percée trop profonde', () => {
    const supplied = new Simulation(stripConfig({ logistics: false }));
    const real = new Simulation(stripConfig());
    supplied.declareWars([[A, B]]);
    real.declareWars([[A, B]]);
    const free = thrust(supplied, 12);
    const tips = thrust(real, 12);
    // Au début, la logistique ne change presque rien.
    expect(tips[2] - tips[0]).toBeGreaterThan((free[2] - free[0]) * 0.8);
    // Loin du sol national, la percée avance nettement moins vite.
    expect(tips[12] - tips[8]).toBeLessThan((free[12] - free[8]) * 0.7);
    expect(tips[12]).toBeLessThan(free[12] * 0.85);
    expect(real.supplyAt(ROW * W + tips[12] - 1)).toBeLessThan(0.4);
    expect(supplied.supplyAt(ROW * W + free[12] - 1)).toBe(1);
  });

  it('ravitaille pleinement le sol national et le territoire conquis tout proche', () => {
    const sim = new Simulation(stripConfig());
    sim.declareWars([[A, B]]);
    thrust(sim, 3);
    expect(sim.supplyAt(ROW * W + 50)).toBe(1);
    expect(sim.supplyAt(ROW * W + 101)).toBe(1);
    const tip = tipOf(sim);
    expect(tip).toBeGreaterThan(125);
    expect(sim.supplyAt(ROW * W + tip - 1)).toBeLessThan(1);
  });

  it("se rétablit quand l'occupant consolide les provinces qu'il tient", () => {
    const sim = new Simulation(stripConfig());
    sim.declareWars([[A, B]]);
    // Avance sur tout le front : A tient des provinces entières.
    for (let t = 0; t < 600 * 5; t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 1, 'hold');
      sim.step();
    }
    const tip = tipOf(sim) - 1;
    const province = Math.floor(tip / 20) + 1;
    expect(sim.controllerOf(province - 1)).toBe(A);
    const before = sim.supplyAt(ROW * W + tip);
    const consolidationBefore = sim.consolidation[province - 1];
    for (let t = 0; t < CONSOLIDATION_SECONDS * TICKS_PER_SECOND; t++) {
      sim.setFront(A, B, 1, 'hold');
      sim.setFront(B, A, 1, 'hold');
      sim.step();
    }
    expect(sim.owners[ROW * W + tip]).toBe(A);
    expect(sim.consolidation[province - 1]).toBe(1);
    expect(sim.consolidation[province - 1]).toBeGreaterThan(consolidationBefore);
    expect(sim.supplyAt(ROW * W + tip)).toBeGreaterThanOrEqual(before);
  });

  it('ravitaille une province conquise par un dépôt', () => {
    const sim = new Simulation(stripConfig());
    sim.declareWars([[A, B]]);
    // Assez loin pour que la province ne soit plus ravitaillée pleinement.
    for (let t = 0; t < 600 * 10; t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 1, 'hold');
      sim.step();
    }
    // La dernière province entièrement tenue derrière la pointe.
    const province = Math.floor((tipOf(sim) - 1) / 20);
    expect(sim.controllerOf(province)).toBe(A);
    const cell = ROW * W + (province - 1) * 20 + 10;
    const hold = () => {
      sim.setFront(A, B, 1, 'hold');
      sim.setFront(B, A, 1, 'hold');
    };
    for (let t = 0; t < (CONSOLIDATION_SECONDS / 2) * TICKS_PER_SECOND + 20; t++) {
      hold();
      sim.step();
    }
    expect(sim.supplyAt(cell)).toBeLessThan(1);
    // Économie civile : les chantiers vont plus vite.
    sim.setEffort(A, 0);
    sim.build(A, province, 'depot');
    expect(sim.buildQueueOf(A)).toHaveLength(1);
    for (let t = 0; t < 600 * 20 && sim.depots[province] === 0; t++) {
      hold();
      sim.step();
    }
    expect(sim.depots[province]).toBe(1);
    for (let t = 0; t < 40; t++) {
      hold();
      sim.step();
    }
    expect(sim.supplyAt(cell)).toBe(1);
  });

  it('porte moins loin en montagne qu\'en plaine', () => {
    const supplyAfter = (terrain: number) => {
      const sim = new Simulation(stripConfig({ terrain }));
      sim.declareWars([[A, B]]);
      thrust(sim, 4);
      // Ravitaillement moyen de A sur son front avec B.
      return sim.snapshot().fronts[0].sides[0].supply;
    };
    expect(supplyAfter(1)).toBeLessThan(supplyAfter(0));
  });
});
