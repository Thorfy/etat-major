import { describe, expect, it } from 'vitest';
import {
  ARCHETYPES,
  DOCTRINE_AXIS_COUNT,
  DOCTRINE_EFFECTS,
  DOCTRINE_REACH,
  DOCTRINE_SPEED_PER_WEEK,
  MAX_RESEARCH_LEVEL,
  RESEARCH_COST,
  archetypeOf,
  doctrineModifiers,
} from '../src/sim/doctrine.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const A = 1;
const B = 2;
const WIDTH = 80;
const HEIGHT = 20;
const WEEK = 600;
const MANEUVER = 0;
const MASS = 1;
const AIR = 2;

/** Deux pays identiques de quatre provinces, en bandes verticales : A à gauche, B à droite. */
function config(options: { ai?: boolean; seed?: number } = {}): SimConfig {
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
    seed: options.seed ?? 3,
    player: A,
    ai: options.ai ?? false,
    trade: false,
  };
}

const run = (sim: Simulation, ticks: number) => {
  for (let t = 0; t < ticks; t++) sim.step();
};

/** Assez de semaines pour aller du centre à un bout d'axe. */
const FULL_SWING = Math.ceil(1 / DOCTRINE_SPEED_PER_WEEK) * WEEK + WEEK;

describe('doctrine', () => {
  it('part du centre, où elle ne change rien', () => {
    const sim = new Simulation(config());
    expect(sim.doctrineOf(A)).toEqual([0, 0, 0, 0, 0]);
    const neutral = doctrineModifiers([0, 0, 0, 0, 0]);
    for (const [key, value] of Object.entries(neutral)) {
      expect([0, 1], key).toContain(value);
    }
  });

  it('glisse vers sa cible, sans dépasser les bornes de la recherche', () => {
    const sim = new Simulation(config());
    sim.setDoctrine(A, MANEUVER, 1);
    run(sim, WEEK);
    expect(sim.doctrineOf(A)[MANEUVER]).toBeCloseTo(DOCTRINE_SPEED_PER_WEEK, 2);
    run(sim, FULL_SWING);
    expect(sim.doctrineOf(A)[MANEUVER]).toBeCloseTo(DOCTRINE_REACH[0], 6);
    sim.setDoctrine(A, MANEUVER, -0.1);
    run(sim, FULL_SWING);
    expect(sim.doctrineOf(A)[MANEUVER]).toBeCloseTo(-0.1, 6);
  });

  it('va moitié moins vite en guerre', () => {
    const sim = new Simulation(config());
    sim.declareWars([[A, B]]);
    sim.setDoctrine(A, MASS, 1);
    run(sim, WEEK);
    expect(sim.doctrineOf(A)[MASS]).toBeCloseTo(DOCTRINE_SPEED_PER_WEEK / 2, 2);
  });

  it('prend le nom de la grande doctrine la plus proche', () => {
    expect(archetypeOf([0, 0, 0, 0, 0])).toBe(-1);
    expect(archetypeOf([0.1, -0.1, 0, 0, 0])).toBe(-1);
    expect(ARCHETYPES[archetypeOf([0.8, -0.6, 0.7, 0, 0])].id).toBe('guerre-eclair');
    expect(ARCHETYPES[archetypeOf([-0.8, 0, -0.6, 0, 0])].id).toBe('defense-profondeur');
    expect(ARCHETYPES[archetypeOf([0, 0, 0, 0.9, -0.7])].id).toBe('republique-marchande');
    expect(ARCHETYPES[archetypeOf([0.7, 0.8, -0.5, 0, 0])].id).toBe('vague-humaine');
  });
});

describe('recherche', () => {
  it('repousse les bornes, un niveau après l\'autre, aux frais des chantiers', () => {
    const sim = new Simulation(config());
    expect(sim.queueResearch(A, MANEUVER)).toBe(true);
    const queued = sim.snapshot().nations.find((nation) => nation.id === A)!.builds;
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ kind: 'research', axis: MANEUVER, cost: RESEARCH_COST });
    expect(sim.queueResearch(A, MANEUVER)).toBe(true);
    expect(sim.queueResearch(A, MANEUVER)).toBe(true);
    // Trois niveaux au plus, en comptant ceux en file.
    expect(sim.queueResearch(A, MANEUVER)).toBe(false);
    for (let t = 0; t < 200 * WEEK && sim.researchOf(A, MANEUVER) < MAX_RESEARCH_LEVEL; t++) sim.step();
    expect(sim.researchOf(A, MANEUVER)).toBe(MAX_RESEARCH_LEVEL);
    expect(sim.reachOf(A, MANEUVER)).toBe(1);
    sim.setDoctrine(A, MANEUVER, 1);
    run(sim, 3 * FULL_SWING);
    expect(sim.doctrineOf(A)[MANEUVER]).toBeCloseTo(1, 6);
  });

  it('se lance aussi pour l\'IA, vers la doctrine qu\'elle vise', () => {
    const sim = new Simulation(config({ ai: true, seed: 5 }));
    const target = sim.save().state.doctrineTarget!.slice(B * DOCTRINE_AXIS_COUNT, (B + 1) * DOCTRINE_AXIS_COUNT);
    expect(target.some((value) => Math.abs(value) > DOCTRINE_REACH[0])).toBe(true);
    run(sim, 60 * WEEK);
    const levels = Array.from({ length: DOCTRINE_AXIS_COUNT }, (_, axis) => sim.researchOf(B, axis));
    expect(levels.reduce((total, level) => total + level, 0)).toBeGreaterThan(0);
    // Le joueur n'a rien demandé : il reste au centre.
    expect(sim.doctrineOf(A)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('effets', () => {
  it('la masse grossit l\'armée et le réservoir', () => {
    const neutral = new Simulation(config());
    const mass = new Simulation(config());
    mass.setDoctrine(A, MASS, 1);
    run(neutral, FULL_SWING);
    run(mass, FULL_SWING);
    const reach = DOCTRINE_REACH[0];
    expect(mass.capacityOf(A) / neutral.capacityOf(A)).toBeCloseTo(1 + DOCTRINE_EFFECTS.massCapacity * reach, 2);
    expect(mass.manpowerMaxOf(A) / neutral.manpowerMaxOf(A)).toBeCloseTo(1 + DOCTRINE_EFFECTS.massManpower * reach, 2);
  });

  it('la qualité donne plus de poids à chaque homme sur le front', () => {
    const sim = new Simulation(config());
    sim.setDoctrine(A, MASS, -1);
    run(sim, FULL_SWING);
    sim.declareWars([[A, B]]);
    sim.setFront(A, B, 0.6, 'hold');
    sim.setFront(B, A, 0.6, 'hold');
    run(sim, 200);
    const front = sim.snapshot().fronts[0];
    const [sideA, sideB] = front.a === A ? front.sides : [front.sides[1], front.sides[0]];
    const logRatio = front.a === A ? front.logRatio : -front.logRatio;
    const perMan = logRatio - Math.log(sideA.force / sideB.force);
    expect(perMan).toBeCloseTo(Math.log(1 + DOCTRINE_EFFECTS.qualityStrength * DOCTRINE_REACH[0]), 2);
  });

  it('chaque pôle a un coût en face de son gain', () => {
    const pole = (axis: number, value: number) => {
      const doctrine = [0, 0, 0, 0, 0];
      doctrine[axis] = value;
      return doctrineModifiers(doctrine);
    };
    const move = pole(MANEUVER, 1);
    expect(move.attackEdge).toBeGreaterThan(0);
    expect(move.defenseEdge).toBeLessThan(0);
    const position = pole(MANEUVER, -1);
    expect(position.defenseEdge).toBeGreaterThan(0);
    expect(position.attackEdge).toBeLessThan(0);
    const mass = pole(MASS, 1);
    expect(mass.capacity).toBeGreaterThan(1);
    expect(mass.strength).toBeLessThan(1);
    const quality = pole(MASS, -1);
    expect(quality.strength).toBeGreaterThan(1);
    expect(quality.capacity).toBeLessThan(1);
    const air = pole(AIR, 1);
    expect(air.air).toBe(1);
    expect(air.capacity).toBeLessThan(1);
    expect(pole(AIR, -1).capacity).toBeGreaterThan(1);
    const free = pole(3, 1);
    expect(free.dealGain).toBeGreaterThan(1);
    expect(free.tradeDependence).toBeGreaterThan(1);
    const autarky = pole(3, -1);
    expect(autarky.tradeDependence).toBeLessThan(1);
    expect(autarky.dealGain).toBeLessThan(1);
    const central = pole(4, 1);
    expect(central.effortCap).toBeGreaterThan(0);
    expect(central.unrest).toBeGreaterThan(1);
    const autonomy = pole(4, -1);
    expect(autonomy.unrest).toBeLessThan(1);
    expect(autonomy.construction).toBeLessThan(1);
  });
});

describe('sauvegarde des doctrines', () => {
  it('garde doctrine, cible et recherche, et reprend la même partie', () => {
    const sim = new Simulation(config({ ai: true, seed: 8 }));
    sim.setDoctrine(A, MANEUVER, -1);
    sim.queueResearch(A, MANEUVER);
    run(sim, 6 * WEEK);
    const save = sim.save();
    const resumed = new Simulation({ ...config({ ai: true, seed: 8 }), saved: { owners: save.owners, supply: save.supply, forts: save.forts, state: JSON.parse(JSON.stringify(save.state)) } });
    expect(resumed.doctrineOf(A)).toEqual(sim.doctrineOf(A));
    expect(resumed.researchOf(A, MANEUVER)).toBe(sim.researchOf(A, MANEUVER));
    expect(resumed.stateHash()).toBe(sim.stateHash());
    run(sim, 6 * WEEK);
    run(resumed, 6 * WEEK);
    expect(resumed.stateHash()).toBe(sim.stateHash());
  });
});
