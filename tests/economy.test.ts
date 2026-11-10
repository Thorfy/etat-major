import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeRle } from '../src/map/codec.ts';
import type { WorldData } from '../src/map/types.ts';
import {
  AI_DESPERATE_EFFORT,
  AI_EFFORT_SPREAD,
  AI_PEACE_EFFORT,
  CAPTURE_DAMAGE,
  MAX_DEVELOPMENT,
  MIN_DEVELOPMENT,
} from '../src/sim/balance.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const A = 1;
const B = 2;
const WIDTH = 80;
const HEIGHT = 20;

/**
 * Deux pays de quatre provinces en bandes verticales : A à gauche, B à droite.
 * La province 5, collée à A, porte presque tout le PIB de B ; la 8 est la plus pauvre.
 */
function economyConfig(options: { richFirst?: boolean; ai?: boolean; seed?: number } = {}): SimConfig {
  const ownerGrid = new Uint16Array(WIDTH * HEIGHT);
  const provinceGrid = new Uint16Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      ownerGrid[y * WIDTH + x] = x < 40 ? A : B;
      provinceGrid[y * WIDTH + x] = Math.floor(x / 10) + 1;
    }
  }
  const richFirst = options.richFirst ?? true;
  const gdpOfB = richFirst ? [1.7e6, 0.1e6, 0.1e6, 0.1e6] : [0.1e6, 0.1e6, 0.1e6, 1.7e6];
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
      gdpMusd: i < 4 ? 0.5e6 : gdpOfB[i - 4],
    })),
    provinceGrid,
    ownerGrid,
    seed: options.seed ?? 3,
    player: A,
    ai: options.ai ?? false,
  };
}

const makeEconomy = (options: Parameters<typeof economyConfig>[0] = {}) => new Simulation(economyConfig(options));

const run = (sim: Simulation, ticks: number, orders: () => void = () => {}) => {
  for (let t = 0; t < ticks; t++) {
    orders();
    sim.step();
  }
};

/** A attaque jusqu'à tenir la province 5, puis tout le monde tient. */
function takeProvince5(sim: Simulation): void {
  sim.declareWars([[A, B]]);
  for (let t = 0; t < 40000 && sim.controllerOf(5) !== A; t++) {
    sim.setFront(A, B, 1, 'attack');
    sim.setFront(B, A, 0, 'hold');
    sim.step();
  }
  expect(sim.controllerOf(5)).toBe(A);
}

describe('valeur des provinces', () => {
  it('suit la part du PIB et de la population', () => {
    const sim = makeEconomy();
    const economy = sim.economySnapshot();
    // 75 % de la part du PIB (85 %) et 25 % de la part de la population (25 %).
    expect(sim.capacityOf(B)).toBeCloseTo(sim.capacityOf(A), 6);
    expect(economy.output[B]).toBeCloseTo(2e6, 0);
    expect(economy.provinceGdp[5]).toBeCloseTo(1.7e6, 0);
  });

  it('change davantage le rapport de force quand la région prise est industrielle', () => {
    const balanceAfterTaking = (richFirst: boolean) => {
      const sim = makeEconomy({ richFirst });
      takeProvince5(sim);
      // Une conquête ne rapporte pleinement qu'une fois consolidée : plus de garnison à payer.
      run(sim, 2000, () => {
        sim.setFront(A, B, 1, 'hold');
        sim.setFront(B, A, 1, 'hold');
      });
      return sim.capacityOf(A) / sim.capacityOf(B);
    };
    const rich = balanceAfterTaking(true);
    const poor = balanceAfterTaking(false);
    expect(rich).toBeGreaterThan(2);
    expect(poor).toBeLessThan(1.3);
  });
});

describe('effort de guerre', () => {
  it('se reconvertit progressivement, puis multiplie la capacité', () => {
    const sim = makeEconomy();
    const start = sim.capacityOf(A);
    sim.setEffort(A, 1);
    run(sim, 100);
    expect(sim.effortOf(A)).toBeCloseTo(0.58, 6);
    run(sim, 1500);
    expect(sim.effortOf(A)).toBe(1);
    // ×1,5 au plus, moins l'usure de l'industrie pendant ce temps.
    expect(sim.capacityOf(A)).toBeGreaterThan(start * 1.35);
    expect(sim.capacityOf(A)).toBeLessThan(start * 1.5);
  });

  it('fait grandir l\'industrie à effort bas, et l\'use à effort haut', () => {
    const sim = makeEconomy();
    sim.setEffort(A, 0);
    sim.setEffort(B, 1);
    run(sim, 600 * 40);
    const economy = sim.economySnapshot();
    expect(economy.development[1]).toBeGreaterThan(1.4);
    expect(economy.development[1]).toBeLessThan(MAX_DEVELOPMENT);
    expect(economy.development[5]).toBeLessThan(0.8);
    expect(economy.development[5]).toBeGreaterThan(MIN_DEVELOPMENT);
    expect(economy.output[A]).toBeGreaterThan(2e6 * 1.4);
  });

  it('grandit moitié moins vite en guerre', () => {
    const atPeace = makeEconomy();
    const atWar = makeEconomy();
    atWar.declareWars([[A, B]]);
    for (const sim of [atPeace, atWar]) {
      sim.setEffort(A, 0);
      run(sim, 600, () => sim.setFront(A, B, 0, 'hold'));
    }
    const gain = (sim: Simulation) => sim.economySnapshot().development[1] - 1;
    expect(gain(atWar) / gain(atPeace)).toBeGreaterThan(0.4);
    expect(gain(atWar) / gain(atPeace)).toBeLessThan(0.6);
  });

  it('borne les ordres', () => {
    const sim = makeEconomy();
    sim.setEffort(A, 7);
    sim.setEffort(B, Number.NaN);
    run(sim, 2000);
    expect(sim.effortOf(A)).toBe(1);
    expect(sim.effortOf(B)).toBe(0.5);
  });

  it('démobilise une armée que l\'économie ne peut plus entretenir', () => {
    const sim = makeEconomy();
    sim.setEffort(A, 1);
    run(sim, 600 * 6);
    const army = sim.armyOf(A);
    sim.setEffort(A, 0);
    run(sim, 600 * 6);
    expect(sim.armyOf(A)).toBeLessThan(army * 0.8);
    expect(sim.armyOf(A)).toBeGreaterThan(sim.capacityOf(A));
  });

  it('pousse l\'IA à s\'armer en guerre et à grandir en paix', () => {
    const sim = makeEconomy({ ai: true });
    run(sim, 300);
    expect(sim.economySnapshot().effort[B]).toBeLessThan(AI_PEACE_EFFORT + AI_EFFORT_SPREAD + 0.05);
    sim.declareWars([[A, B]]);
    run(sim, 1200, () => sim.setFront(A, B, 1, 'hold'));
    // Face à un joueur qui engage tout, l'IA est en sous-nombre.
    expect(sim.economySnapshot().effort[B]).toBeGreaterThan(AI_DESPERATE_EFFORT - AI_EFFORT_SPREAD - 0.01);
  });
});

describe('destructions', () => {
  it('abîment une province à chaque changement de mains', () => {
    const sim = makeEconomy();
    takeProvince5(sim);
    expect(sim.development[5]).toBeCloseTo(1 - CAPTURE_DAMAGE, 6);
  });

  it('épargnent un pays annexé sans combat', () => {
    const sim = makeEconomy();
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 80000 && sim.isAlive(B); t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0, 'retreat');
      sim.step();
    }
    expect(sim.isAlive(B)).toBe(false);
    // La province du fond, la 8, n'a pas été prise par les armes.
    const conquered = [5, 6, 7, 8].filter((province) => sim.development[province] < 1);
    expect(conquered.length).toBeLessThan(4);
  });
});

describe('sauvegarde', () => {
  it('garde l\'économie et reprend la même partie', () => {
    const options = { ai: true, seed: 11 };
    const sim = makeEconomy(options);
    sim.setEffort(A, 0.1);
    sim.declareWars([[A, B]]);
    const orders = (target: Simulation) => () => target.setFront(A, B, 0.6, 'attack');
    run(sim, 900, orders(sim));
    const save = sim.save();
    // Le passage par JSON est celui du fichier de sauvegarde.
    const resumed = new Simulation({ ...economyConfig(options), saved: { owners: save.owners, supply: save.supply, forts: save.forts, state: JSON.parse(JSON.stringify(save.state)) } });
    expect(resumed.stateHash()).toBe(sim.stateHash());
    run(sim, 900, orders(sim));
    run(resumed, 900, orders(resumed));
    expect(resumed.stateHash()).toBe(sim.stateHash());
    expect(resumed.capacityOf(A)).toBe(sim.capacityOf(A));
  });
});

describe('vraie carte', () => {
  const root = join(import.meta.dirname, '..');
  const world: WorldData = JSON.parse(readFileSync(join(root, 'public/map/world.json'), 'utf8'));

  it('répartit tout le PIB et toute la population de chaque pays', () => {
    const gdp = new Float64Array(world.nations.length);
    const population = new Float64Array(world.nations.length);
    for (const province of world.provinces) {
      gdp[province.nation] += province.gdpMusd;
      population[province.nation] += province.population;
    }
    world.nations.forEach((nation, n) => {
      expect(Math.abs(gdp[n] - nation.gdpMusd)).toBeLessThanOrEqual(Math.max(1, nation.gdpMusd * 0.001));
      expect(Math.abs(population[n] - nation.population)).toBeLessThanOrEqual(Math.max(50, nation.population * 0.001));
    });
  });

  it('concentre la puissance allemande dans ses régions industrielles', () => {
    const cellCount = world.width * world.height;
    const raw = inflateSync(readFileSync(join(root, 'public/map/provinces.dat')));
    const provinceGrid = decodeRle(new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2).slice(), cellCount);
    const ownerGrid = new Uint16Array(cellCount);
    for (let i = 0; i < cellCount; i++) {
      if (provinceGrid[i]) ownerGrid[i] = world.provinces[provinceGrid[i] - 1].nation + 1;
    }
    const sim = new Simulation({
      width: world.width,
      height: world.height,
      nations: world.nations,
      provinces: world.provinces,
      provinceGrid,
      ownerGrid,
      seed: 1,
      player: 0,
      ai: false,
    });
    const germany = world.nations.findIndex((nation) => nation.code === 'DEU');
    const own = world.provinces.map((province, index) => ({ province, id: index + 1 })).filter(({ province }) => province.nation === germany);
    const shareOf = (name: string) => {
      const entry = own.find(({ province }) => province.name === name)!;
      return entry.province.gdpMusd / own.reduce((sum, { province }) => sum + province.gdpMusd, 0);
    };
    expect(shareOf('Rhénanie-du-Nord-Westphalie')).toBeGreaterThan(0.15);
    expect(shareOf('Mecklembourg-Poméranie-Occidentale')).toBeLessThan(0.03);
    expect(sim.outputOf(germany + 1)).toBeCloseTo(world.nations[germany].gdpMusd, -3);
  });
});
