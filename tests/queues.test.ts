import { describe, expect, it } from 'vitest';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const A = 1;
const B = 2;
const WIDTH = 80;
const HEIGHT = 20;
const WEEK = 600;

/** Deux pays de quatre provinces, en bandes verticales : A à gauche, B à droite. */
function config(): SimConfig {
  const ownerGrid = new Uint16Array(WIDTH * HEIGHT);
  const provinceGrid = new Uint16Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      ownerGrid[y * WIDTH + x] = x < 40 ? A : B;
      provinceGrid[y * WIDTH + x] = Math.floor(x / 10) + 1;
    }
  }
  return {
    width: WIDTH,
    height: HEIGHT,
    nations: [{ population: 50e6, gdpMusd: 2e6 }, { population: 50e6, gdpMusd: 2e6 }],
    provinces: Array.from({ length: 8 }, (_, i) => ({
      nation: i < 4 ? 0 : 1,
      areaKm2: 1000,
      x: i * 10 + 5,
      y: 10,
      population: 12.5e6,
      gdpMusd: 0.5e6,
    })),
    provinceGrid,
    ownerGrid,
    seed: 3,
    player: A,
    ai: false,
    trade: false,
  };
}

const builds = (sim: Simulation) => sim.snapshot().nations.find((nation) => nation.id === A)!.builds;
const run = (sim: Simulation, ticks: number) => {
  for (let t = 0; t < ticks; t++) sim.step();
};

describe('files de chantiers', () => {
  it('avancent en même temps, la civile et la militaire', () => {
    const sim = new Simulation(config());
    sim.build(A, 1, 'factory');
    sim.build(A, 2, 'factory');
    sim.queueResearch(A, 0);
    run(sim, WEEK);
    const queue = builds(sim);
    const factory = queue.find((order) => order.kind === 'factory')!;
    const research = queue.find((order) => order.kind === 'research');
    expect(factory.military).toBe(false);
    expect(factory.progress).toBeGreaterThan(0);
    // La recherche, moins chère, a déjà pu s'achever ; sinon, elle avance aussi.
    if (research) expect(research.progress).toBeGreaterThan(0);
    else expect(sim.researchOf(A, 0)).toBe(1);
  });

  it('donnent tous les points à une file quand l\'autre est vide', () => {
    const shared = new Simulation(config());
    const alone = new Simulation(config());
    for (const sim of [shared, alone]) sim.build(A, 1, 'factory');
    shared.fortifyLine(A, 35, 2, 35, 18);
    run(shared, WEEK / 2);
    run(alone, WEEK / 2);
    const progress = (sim: Simulation) => builds(sim).find((order) => order.kind === 'factory')!.progress;
    expect(progress(shared)).toBeCloseTo(progress(alone) / 2, 0);
    shared.setMilitaryShare(A, 0);
    const before = progress(shared);
    run(shared, WEEK / 4);
    run(alone, WEEK / 4);
    expect(progress(shared) - before).toBeGreaterThan(0);
  });

  it('se réordonnent, sans perdre les points accumulés', () => {
    const sim = new Simulation(config());
    sim.build(A, 1, 'factory');
    sim.build(A, 2, 'factory');
    sim.build(A, 3, 'factory');
    run(sim, 100);
    const accumulated = builds(sim)[0].progress;
    expect(accumulated).toBeGreaterThan(0);
    sim.moveBuild(A, 2, 0);
    const queue = builds(sim);
    expect(queue.map((order) => order.province)).toEqual([3, 1, 2]);
    expect(queue[0].progress).toBeCloseTo(accumulated, 6);
    expect(queue[1].progress).toBe(0);
  });

  it('perdent à l\'annulation ce qui était accumulé sur la seule file concernée', () => {
    const sim = new Simulation(config());
    sim.build(A, 1, 'factory');
    sim.fortifyLine(A, 35, 2, 35, 18);
    run(sim, 100);
    const fort = builds(sim).find((order) => order.kind === 'fort')!;
    expect(fort.progress).toBeGreaterThan(0);
    sim.cancelBuild(A, 0);
    const queue = builds(sim);
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe('fort');
    expect(queue[0].progress).toBeCloseTo(fort.progress, 6);
  });
});
