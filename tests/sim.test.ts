import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/sim/Simulation.ts';

const W = 96;
const H = 48;
const A = 1;
const B = 2;

/** Deux pays côte à côte sur une carte bouclée, avec une mer à droite et une à gauche. */
function makeSim(seed = 7, player = 0) {
  const provinceGrid = new Uint16Array(W * H);
  const ownerGrid = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 8; x < W - 8; x++) {
      const owner = x < W / 2 ? A : B;
      ownerGrid[y * W + x] = owner;
      // Quatre provinces par pays, en bandes horizontales.
      provinceGrid[y * W + x] = (owner - 1) * 4 + Math.floor(y / 12) + 1;
    }
  }
  const provinces = Array.from({ length: 8 }, (_, i) => ({ nation: i < 4 ? 0 : 1, areaKm2: 1000 }));
  return new Simulation({
    width: W,
    height: H,
    nations: [
      { population: 50e6, gdpMusd: 2e6 },
      { population: 50e6, gdpMusd: 2e6 },
    ],
    provinces,
    provinceGrid,
    ownerGrid,
    seed,
    player,
  });
}

const run = (sim: Simulation, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.step();
};

/** Attaque d'un camp nettement supérieur, l'autre tient avec peu de forces. */
function aOverwhelmsB(sim: Simulation) {
  sim.declareWars([[A, B]]);
  sim.setFront(A, B, 1, 'attack');
  sim.setFront(B, A, 0.05, 'hold');
}

describe('déterminisme', () => {
  const play = (seed: number) => {
    const sim = makeSim(seed, A);
    sim.declareWars([[A, B]]);
    sim.setFront(A, B, 0.8, 'attack');
    run(sim, 500);
    sim.setFront(A, B, 0.3, 'hold');
    run(sim, 500);
    return sim.stateHash();
  };

  it('rejoue la même partie à partir de la même graine', () => {
    expect(play(42)).toBe(play(42));
  });

  it('change de partie avec une autre graine', () => {
    expect(play(42)).not.toBe(play(43));
  });
});

describe('invariants du front', () => {
  it('ne touche jamais la mer et conserve le total de terre', () => {
    const sim = makeSim(7, A);
    aOverwhelmsB(sim);
    const seaBefore = sim.owners.filter((owner) => owner === 0).length;
    run(sim, 1500);
    expect(sim.owners.filter((owner) => owner === 0).length).toBe(seaBefore);
    expect(sim.cellsOf(A) + sim.cellsOf(B)).toBe(sim.owners.length - seaBefore);
    expect(sim.owners.filter((owner) => owner === A).length).toBe(sim.cellsOf(A));
  });

  it('garde une frontière active exacte après des milliers de bascules', () => {
    const sim = makeSim(9, A);
    aOverwhelmsB(sim);
    run(sim, 1000);
    let expected = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const owner = sim.owners[y * W + x];
        if (owner === 0) continue;
        const around = [
          sim.owners[y * W + (x + 1) % W],
          sim.owners[y * W + (x + W - 1) % W],
          y > 0 ? sim.owners[(y - 1) * W + x] : 0,
          y < H - 1 ? sim.owners[(y + 1) * W + x] : 0,
        ];
        if (around.some((n) => n !== 0 && n !== owner)) expected++;
      }
    }
    expect(sim.frontierSize).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('ne fait basculer une cellule que si elle touche l\'attaquant', () => {
    const sim = makeSim(11, A);
    aOverwhelmsB(sim);
    for (let t = 0; t < 300; t++) {
      const before = sim.owners.slice();
      sim.step();
      const { cells, owners } = sim.drainChanges();
      cells.forEach((cell, i) => {
        const x = cell % W;
        const y = Math.floor(cell / W);
        const neighbors = [before[y * W + (x + 1) % W], before[y * W + (x + W - 1) % W], before[(y - 1) * W + x], before[(y + 1) * W + x]];
        expect(neighbors).toContain(owners[i]);
      });
    }
  });

  it('transmet exactement les changements de la grille', () => {
    const sim = makeSim(5, A);
    const mirror = sim.owners.slice();
    aOverwhelmsB(sim);
    for (let t = 0; t < 400; t++) {
      sim.step();
      const { cells, owners } = sim.drainChanges();
      cells.forEach((cell, i) => {
        mirror[cell] = owners[i];
      });
    }
    expect(mirror).toEqual(sim.owners);
  });
});

describe('rapport de force', () => {
  it('fait avancer le camp supérieur qui attaque', () => {
    const sim = makeSim();
    const start = sim.cellsOf(A);
    aOverwhelmsB(sim);
    // IA désactivée pour B : on neutralise en repassant ses ordres avant chaque intervalle.
    for (let t = 0; t < 1000; t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0.05, 'hold');
      sim.step();
    }
    expect(sim.cellsOf(A)).toBeGreaterThan(start + 100);
  });

  it('laisse le front immobile quand personne n\'attaque', () => {
    const sim = makeSim(3, A);
    sim.declareWars([[A, B]]);
    const before = sim.cellsOf(A);
    for (let t = 0; t < 600; t++) {
      sim.setFront(A, B, 0.5, 'hold');
      sim.setFront(B, A, 0.5, 'hold');
      sim.step();
    }
    expect(sim.cellsOf(A)).toBe(before);
  });

  it('cède du terrain en repli même sans attaque adverse', () => {
    const sim = makeSim(3, A);
    sim.declareWars([[A, B]]);
    const before = sim.cellsOf(A);
    for (let t = 0; t < 600; t++) {
      sim.setFront(A, B, 0.5, 'retreat');
      sim.setFront(B, A, 0.5, 'hold');
      sim.step();
    }
    expect(sim.cellsOf(A)).toBeLessThan(before);
  });

  it('use les deux camps au combat, pas ceux qui tiennent', () => {
    const peace = makeSim(3, A);
    peace.declareWars([[A, B]]);
    const war = makeSim(3, A);
    war.declareWars([[A, B]]);
    for (let t = 0; t < 600; t++) {
      peace.setFront(A, B, 0.5, 'hold');
      peace.setFront(B, A, 0.5, 'hold');
      war.setFront(A, B, 0.5, 'attack');
      war.setFront(B, A, 0.5, 'attack');
      peace.step();
      war.step();
    }
    expect(war.armyOf(A)).toBeLessThan(peace.armyOf(A));
    expect(war.armyOf(B)).toBeLessThan(peace.armyOf(B));
  });
});

describe('ordres', () => {
  it('borne la somme des allocations à 100 %', () => {
    const sim = makeSim(1, A);
    sim.declareWars([[A, B]]);
    sim.setFront(A, B, 1.7, 'attack');
    expect(sim.fronts[0].sides[0].allocation).toBe(1);
    sim.setFront(A, B, -1, 'attack');
    expect(sim.fronts[0].sides[0].allocation).toBe(0);
  });

  it('ignore un ordre sur un front inexistant et une guerre contre soi-même', () => {
    const sim = makeSim(1, A);
    sim.declareWars([[A, A]]);
    expect(sim.fronts.length).toBe(0);
    expect(() => sim.setFront(A, B, 1, 'attack')).not.toThrow();
  });

  it('déplace les forces progressivement vers le front', () => {
    const sim = makeSim(1, A);
    sim.declareWars([[A, B]]);
    sim.setFront(A, B, 1, 'hold');
    const army = sim.armyOf(A);
    sim.step();
    expect(sim.fronts[0].sides[0].force).toBeLessThan(army * 0.02);
    run(sim, 400);
    expect(sim.fronts[0].sides[0].force).toBeGreaterThan(army * 0.8);
  });
});

describe('provinces', () => {
  it('change de contrôleur à la majorité et déplace la capacité', () => {
    const sim = makeSim(13, A);
    aOverwhelmsB(sim);
    const capacityBefore = sim.snapshot().nations.find((n) => n.id === B)!.capacity;
    const taken: number[] = [];
    for (let t = 0; t < 12000 && taken.length === 0; t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0.05, 'hold');
      sim.step();
      const { provinces } = sim.drainChanges();
      for (let i = 0; i < provinces.length; i += 2) taken.push(provinces[i]);
    }
    expect(taken.length).toBeGreaterThan(0);
    expect(sim.controllerOf(taken[0])).toBe(A);
    expect(sim.snapshot().nations.find((n) => n.id === B)!.capacity).toBeLessThan(capacityBefore);
  });
});
