import { describe, expect, it } from 'vitest';
import {
  BUILD_COST,
  FACTORY_BONUS,
  LAND_IMPORT_SHARE,
  MAX_FACTORY_LEVEL,
  SEA_IMPORT_SHARE,
} from '../src/sim/balance.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const A = 1;
const B = 2;
const W = 160;
const H = 40;

/**
 * A à l'ouest (x < 60), B au centre (60 à 120), la mer à l'est : elle touche aussi A par le
 * bouclage de la carte. Provinces de 20 colonnes. La province 4 de B, collée à A, porte du
 * pétrole ; A n'en a pas.
 */
function config(options: { gdpA?: number; gdpB?: number; ai?: boolean; seed?: number } = {}): SimConfig {
  const ownerGrid = new Uint16Array(W * H);
  const provinceGrid = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const owner = x < 60 ? A : x < 120 ? B : 0;
      ownerGrid[y * W + x] = owner;
      provinceGrid[y * W + x] = owner === 0 ? 0 : Math.floor(x / 20) + 1;
    }
  }
  return {
    width: W,
    height: H,
    nations: [
      { population: 50e6, gdpMusd: options.gdpA ?? 2e6 },
      { population: 50e6, gdpMusd: options.gdpB ?? 2e6 },
    ],
    provinces: Array.from({ length: 6 }, (_, i) => ({
      nation: i < 3 ? 0 : 1,
      areaKm2: 20000,
      x: i * 20 + 10,
      y: 20,
      population: 1e6,
      // Le PIB des provinces fait celui du pays : il règle la vitesse des chantiers.
      gdpMusd: ((i < 3 ? options.gdpA ?? 2e6 : options.gdpB ?? 2e6) / 3),
      oil: i === 3 ? 5 : 0,
      steel: 0,
    })),
    provinceGrid,
    ownerGrid,
    seed: options.seed ?? 2,
    player: A,
    ai: options.ai ?? false,
  };
}

const run = (sim: Simulation, ticks: number, orders: () => void = () => {}) => {
  for (let t = 0; t < ticks; t++) {
    orders();
    sim.step();
  }
};
const both = (sim: Simulation, a: 'attack' | 'hold', b: 'attack' | 'hold') => () => {
  sim.setFront(A, B, 1, a);
  sim.setFront(B, A, 1, b);
};

describe('main-d\'œuvre et lassitude', () => {
  it('fait payer une guerre d\'usure : réservoir vidé et stabilité en baisse', () => {
    const attacking = new Simulation(config());
    const holding = new Simulation(config());
    for (const sim of [attacking, holding]) sim.declareWars([[A, B]]);
    run(attacking, 600 * 10, both(attacking, 'attack', 'attack'));
    run(holding, 600 * 10, both(holding, 'hold', 'hold'));
    expect(attacking.manpowerOf(A)).toBeLessThan(holding.manpowerOf(A) * 0.8);
    expect(attacking.stabilityOf(A)).toBeLessThan(holding.stabilityOf(A) - 0.05);
    // Même sans combat, la guerre use un peu.
    expect(holding.stabilityOf(A)).toBeLessThan(0.8);
  });

  it('ne renforce plus une armée dont le réservoir est vide', () => {
    const sim = new Simulation(config());
    sim.declareWars([[A, B]]);
    let emptied = false;
    for (let t = 0; t < 600 * 40 && !emptied && sim.isAlive(A); t++) {
      both(sim, 'attack', 'hold')();
      sim.step();
      emptied = sim.manpowerOf(A) < 1;
    }
    expect(sim.isAlive(A)).toBe(true);
    expect(emptied).toBe(true);
    // Le réservoir vide, l'armée reste loin de sa capacité.
    expect(sim.armyOf(A)).toBeLessThan(sim.capacityOf(A) * 0.8);
  });

  it('se rétablit en paix', () => {
    const sim = new Simulation(config());
    sim.declareWars([[A, B]]);
    run(sim, 600 * 8, both(sim, 'attack', 'attack'));
    const worn = sim.stabilityOf(A);
    const later = new Simulation(config());
    // Pas de paix encore : on compare une nation jamais entrée en guerre.
    run(later, 600 * 8);
    expect(later.stabilityOf(A)).toBeGreaterThan(worn);
    expect(later.stabilityOf(A)).toBeCloseTo(0.85, 2);
  });

  it('plafonne l\'effort de guerre d\'un pays las', () => {
    const sim = new Simulation(config());
    sim.declareWars([[A, B]]);
    sim.setEffort(A, 1);
    let capped = false;
    for (let t = 0; t < 600 * 40 && !capped; t++) {
      both(sim, 'attack', 'attack')();
      sim.step();
      capped = sim.stabilityOf(A) < 0.5 && sim.effortOf(A) < 0.95;
    }
    expect(capped).toBe(true);
  });
});

describe('ressources', () => {
  it('importe une part de ses besoins, et produit le reste', () => {
    const sim = new Simulation(config());
    expect(sim.oilCoverageOf(A)).toBeCloseTo(SEA_IMPORT_SHARE, 6);
    expect(sim.oilCoverageOf(B)).toBe(1);
  });

  it('perd ses importations par la mer sous le blocus d\'une marine bien plus forte', () => {
    const sim = new Simulation(config({ gdpA: 2e5, gdpB: 20e6 }));
    sim.declareWars([[A, B]]);
    run(sim, 20, both(sim, 'hold', 'hold'));
    expect(sim.isBlockaded(A)).toBe(true);
    expect(sim.oilCoverageOf(A)).toBeCloseTo(LAND_IMPORT_SHARE, 6);
    expect(sim.isBlockaded(B)).toBe(false);
  });

  it('gagne du pétrole en prenant un gisement', () => {
    const sim = new Simulation(config({ gdpB: 5e5 }));
    sim.declareWars([[A, B]]);
    const before = sim.oilCoverageOf(A);
    for (let t = 0; t < 600 * 20 && sim.controllerOf(4) !== A; t++) {
      both(sim, 'attack', 'hold')();
      sim.step();
    }
    expect(sim.controllerOf(4)).toBe(A);
    run(sim, 20, both(sim, 'hold', 'hold'));
    expect(sim.oilCoverageOf(A)).toBeGreaterThan(before);
  });
});

describe('chantiers', () => {
  it('bâtit une usine qui augmente la capacité de la province', () => {
    const sim = new Simulation(config());
    const before = sim.capacityOf(A);
    sim.build(A, 1, 'factory');
    expect(sim.buildQueueOf(A)).toHaveLength(1);
    let built = false;
    for (let t = 0; t < 600 * 10 && !built; t++) {
      sim.step();
      built = sim.factories[1] === 1;
    }
    expect(built).toBe(true);
    expect(sim.buildQueueOf(A)).toHaveLength(0);
    // Trois provinces de même valeur : l'usine ajoute 15 % du tiers de la capacité.
    expect(sim.capacityOf(A)).toBeCloseTo(before * (1 + FACTORY_BONUS / 3), 1);
  });

  it('va plus vite avec une économie civile', () => {
    const timeToBuild = (effort: number) => {
      const sim = new Simulation(config());
      sim.setEffort(A, effort);
      run(sim, 1200);
      sim.build(A, 1, 'factory');
      let t = 0;
      while (sim.factories[1] === 0 && t < 600 * 30) {
        sim.step();
        t++;
      }
      return t;
    };
    expect(timeToBuild(0)).toBeLessThan(timeToBuild(1) * 0.5);
  });

  it('refuse ce qui n\'est pas permis', () => {
    const sim = new Simulation(config());
    sim.build(A, 4, 'factory'); // province de B
    sim.build(A, 1, 'depot'); // pas de dépôt sur le sol national
    sim.build(A, 1, 'infrastructure'); // ni d'infrastructure
    for (let i = 0; i < MAX_FACTORY_LEVEL + 1; i++) sim.build(A, 2, 'factory');
    expect(sim.buildQueueOf(A).map((order) => order.province)).toEqual([2, 2, 2]);
    expect(sim.buildCost(2, 'factory')).toBe(BUILD_COST.factory);
    sim.cancelBuild(A, 1);
    expect(sim.buildQueueOf(A)).toHaveLength(2);
  });

  it("accepte une file de chantiers sans limite", () => {
    const sim = new Simulation(config());
    // Trois provinces, trois niveaux d'usine chacune : 9 chantiers, au-delà de l'ancienne limite de 6.
    for (const province of [1, 2, 3]) {
      for (let level = 0; level < 3; level++) sim.build(A, province, 'factory');
    }
    expect(sim.buildQueueOf(A)).toHaveLength(9);
  });

  it('perd un niveau d\'usine quand la province tombe', () => {
    const sim = new Simulation(config({ gdpB: 5e5 }));
    sim.build(B, 4, 'factory');
    run(sim, 600 * 10);
    expect(sim.factories[4]).toBe(1);
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 600 * 20 && sim.controllerOf(4) !== A; t++) {
      both(sim, 'attack', 'hold')();
      sim.step();
    }
    expect(sim.controllerOf(4)).toBe(A);
    expect(sim.factories[4]).toBe(0);
    // Conquise, la province accepte de l'infrastructure, refusée sur le sol national.
    sim.build(A, 4, 'infrastructure');
    expect(sim.buildQueueOf(A).map((order) => [order.province, order.kind])).toEqual([[4, 'infrastructure']]);
  });

  it('fait bâtir l\'IA', () => {
    const sim = new Simulation(config({ ai: true, seed: 3 }));
    run(sim, 600 * 10);
    const built = [1, 2, 3, 4, 5, 6].reduce((total, p) => total + sim.factories[p] + sim.infrastructure[p], 0);
    expect(built).toBeGreaterThan(0);
  });
});

describe('IA opportuniste', () => {
  it('voit un pays engagé ailleurs ou las comme une proie plus facile', () => {
    const sim = new Simulation(config());
    const atPeace = sim.availableStrength(A);
    expect(atPeace).toBeCloseTo(sim.capacityOf(A), 6);
    sim.declareWars([[A, B]]);
    sim.setFront(A, B, 0.9, 'hold');
    // Engagé à 90 % contre B, A n'oppose plus qu'un quart de sa force à un troisième pays.
    expect(sim.availableStrength(A)).toBeCloseTo(sim.capacityOf(A) * 0.25, 6);
    run(sim, 600 * 10, both(sim, 'attack', 'attack'));
    sim.setFront(A, B, 0, 'hold');
    // Las et à court d'hommes, il pèse encore moins que sa capacité.
    expect(sim.availableStrength(A)).toBeLessThan(sim.capacityOf(A) * 0.9);
  });
});

describe('bâtiments du sol national', () => {
  /** Bâtit `kind` dans `province` pour `nation`, puis laisse le chantier aboutir. */
  const built = (sim: Simulation, nation: number, province: number, kind: Parameters<Simulation['build']>[2]) => {
    sim.build(nation, province, kind);
    for (let t = 0; t < 600 * 20 && sim.buildQueueOf(nation).length > 0; t++) sim.step();
    return sim.buildQueueOf(nation).length === 0;
  };

  it("ne se bâtissent que là où ils servent", () => {
    const sim = new Simulation(config());
    // Raffinerie : sur un gisement de pétrole (la province 4 de B), pas ailleurs.
    expect(sim.canBuild(B, 4, 'refinery', 0)).toBe(true);
    expect(sim.canBuild(B, 5, 'refinery', 0)).toBe(false);
    expect(sim.canBuild(A, 1, 'refinery', 0)).toBe(false);
    // Aciérie : aucun gisement d'acier sur cette carte.
    expect(sim.canBuild(B, 4, 'steelworks', 0)).toBe(false);
    // Chantier naval : sur la côte (la province 6 de B touche la mer), pas à l'intérieur.
    expect(sim.canBuild(B, 6, 'shipyard', 0)).toBe(true);
    expect(sim.canBuild(B, 5, 'shipyard', 0)).toBe(false);
    // Jamais chez un autre.
    expect(sim.canBuild(A, 4, 'services', 0)).toBe(false);
    expect(sim.canBuild(A, 1, 'services', 0)).toBe(true);
    // Niveau maximal.
    for (let i = 0; i < 3; i++) sim.build(A, 2, 'recruitment');
    sim.build(A, 2, 'recruitment');
    expect(sim.buildQueueOf(A).filter((order) => order.kind === 'recruitment')).toHaveLength(3);
  });

  it('un centre de recrutement grossit le réservoir', () => {
    const sim = new Simulation(config());
    const control = new Simulation(config());
    expect(built(sim, A, 1, 'recruitment')).toBe(true);
    while (control.tick < sim.tick) control.step();
    for (let t = 0; t < 60; t++) {
      sim.step();
      control.step();
    }
    // Trois provinces égales : +20 % sur l'une, soit un quinzième de plus.
    expect(sim.manpowerMaxOf(A) / control.manpowerMaxOf(A)).toBeCloseTo(1 + 0.2 / 3, 3);
  });

  it('un chantier naval lance des navires', () => {
    const sim = new Simulation(config());
    const navy = () => (sim as unknown as { navy: Float64Array }).navy[B];
    const before = navy();
    expect(before).toBeGreaterThan(0);
    expect(built(sim, B, 6, 'shipyard')).toBe(true);
    expect(navy()).toBeCloseTo(before * 1.15, 6);
  });

  it('une raffinerie accroît le pétrole du gisement', () => {
    // Des besoins dix fois plus grands : le gisement de B ne suffit plus.
    const coverage = (refinery: boolean) => {
      const sim = new Simulation(config());
      if (refinery) expect(built(sim, B, 4, 'refinery')).toBe(true);
      (sim as unknown as { oilPerCapacity: number }).oilPerCapacity *= 10;
      for (let t = 0; t < 600; t++) sim.step();
      return sim.oilCoverageOf(B);
    };
    const without = coverage(false);
    expect(without).toBeLessThan(1);
    expect(coverage(true)).toBeGreaterThan(without);
  });

  it('des services publics font remonter la stabilité plus vite', () => {
    const recovered = (levels: number) => {
      const sim = new Simulation(config());
      for (let level = 0; level < levels; level++) for (const province of [1, 2, 3]) expect(built(sim, A, province, 'services')).toBe(true);
      (sim as unknown as { stability: Float64Array }).stability[A] = 0.3;
      for (let t = 0; t < 600 * 4; t++) sim.step();
      return sim.stabilityOf(A);
    };
    expect(recovered(2)).toBeGreaterThan(recovered(0) + 0.02);
  });

  it('perdent un niveau quand la province tombe', () => {
    const sim = new Simulation(config({ gdpB: 5e5 }));
    expect(built(sim, B, 4, 'services')).toBe(true);
    expect(sim.buildings.services[4]).toBe(1);
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 600 * 20 && sim.controllerOf(4) !== A; t++) {
      both(sim, 'attack', 'hold')();
      sim.step();
    }
    expect(sim.controllerOf(4)).toBe(A);
    expect(sim.buildings.services[4]).toBe(0);
  });
});
