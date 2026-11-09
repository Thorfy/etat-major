import { describe, expect, it } from 'vitest';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const A = 1;
const B = 2;

interface MapOptions {
  width?: number;
  height?: number;
  seed?: number;
  player?: number;
  ai?: boolean;
  /** Propriétaire de chaque cellule, à partir de sa position. */
  owner?: (x: number, y: number) => number;
  terrain?: (x: number, y: number) => number;
}

/** Une province par nation : ces tests ne portent pas sur les provinces. */
function makeSim(options: MapOptions = {}) {
  const width = options.width ?? 120;
  const height = options.height ?? 60;
  const owner = options.owner ?? ((x) => (x < width / 2 ? A : B));
  const ownerGrid = new Uint16Array(width * height);
  const provinceGrid = new Uint16Array(width * height);
  const terrainGrid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = owner(x, y);
      ownerGrid[y * width + x] = id;
      provinceGrid[y * width + x] = id;
      terrainGrid[y * width + x] = options.terrain?.(x, y) ?? 0;
    }
  }
  const config: SimConfig = {
    width,
    height,
    nations: [
      { population: 50e6, gdpMusd: 2e6 },
      { population: 50e6, gdpMusd: 2e6 },
    ],
    provinces: [
      { nation: 0, areaKm2: 1000, x: width / 4, y: height / 2 },
      { nation: 1, areaKm2: 1000, x: (3 * width) / 4, y: height / 2 },
    ],
    provinceGrid,
    ownerGrid,
    terrainGrid,
    seed: options.seed ?? 7,
    player: options.player ?? A,
    ai: options.ai ?? false,
  };
  return new Simulation(config);
}

function runOrders(sim: Simulation, ticks: number, orders: () => void) {
  for (let t = 0; t < ticks; t++) {
    orders();
    sim.step();
  }
}

const count = (sim: Simulation, owner: number, test: (x: number, y: number) => boolean) => {
  let total = 0;
  for (let y = 0; y < sim.height; y++) {
    for (let x = 0; x < sim.width; x++) {
      if (sim.owners[y * sim.width + x] === owner && test(x, y)) total++;
    }
  }
  return total;
};

describe('terrain', () => {
  const attackInto = (terrainId: number) => {
    const sim = makeSim({ terrain: (x) => (x >= 60 ? terrainId : 0) });
    sim.declareWars([[A, B]]);
    runOrders(sim, 1200, () => {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0.15, 'hold');
    });
    return sim.cellsOf(A);
  };

  it('ralentit l\'attaquant en montagne par rapport à la plaine', () => {
    const start = makeSim().cellsOf(A);
    const plain = attackInto(0) - start;
    const mountain = attackInto(1) - start;
    expect(plain).toBeGreaterThan(0);
    expect(mountain).toBeLessThan(plain * 0.6);
  });

  it('marche sans grille de terrain', () => {
    const sim = new Simulation({
      width: 4,
      height: 1,
      nations: [{ population: 1e6, gdpMusd: 1e3 }, { population: 1e6, gdpMusd: 1e3 }],
      provinces: [{ nation: 0, areaKm2: 1, x: 0, y: 0 }, { nation: 1, areaKm2: 1, x: 2, y: 0 }],
      provinceGrid: Uint16Array.from([1, 1, 2, 2]),
      ownerGrid: Uint16Array.from([1, 1, 2, 2]),
      seed: 1,
      player: 0,
    });
    sim.declareWars([[1, 2]]);
    expect(() => sim.step()).not.toThrow();
  });
});

describe('offensives', () => {
  /** Fronts à l'arrêt : seule l'offensive peut faire bouger des cellules. */
  const holdBoth = (sim: Simulation) => () => {
    sim.setFront(A, B, 0.5, 'hold');
    sim.setFront(B, A, 0.5, 'hold');
  };

  const setup = () => {
    const sim = makeSim();
    sim.declareWars([[A, B]]);
    holdBoth(sim)();
    return sim;
  };

  it('avance même si la nation ne fait que tenir, et seulement dans le couloir', () => {
    const sim = setup();
    runOrders(sim, 150, holdBoth(sim));
    const id = sim.launchOffensive(A, 55, 30, 90, 30, 1);
    expect(id).toBeGreaterThan(0);
    runOrders(sim, 150, holdBoth(sim));
    const gained = count(sim, A, (x) => x >= 60);
    expect(gained).toBeGreaterThan(0);
    // Le couloir fait 12 cellules de part et d'autre de la ligne, et rien au-delà.
    expect(count(sim, A, (x, y) => x >= 60 && Math.abs(y - 30) > 13)).toBe(0);
  });

  it('prend sur la réserve et rend le reste à l\'annulation', () => {
    const sim = setup();
    const before = sim.reserveOf(A);
    const armyBefore = sim.armyOf(A);
    const id = sim.launchOffensive(A, 55, 30, 90, 30, 0.5);
    expect(sim.reserveOf(A)).toBeCloseTo(before / 2, 6);
    expect(sim.armyOf(A)).toBeCloseTo(armyBefore, 6);
    sim.cancelOffensive(A, id);
    expect(sim.offensives.length).toBe(0);
    expect(sim.reserveOf(A)).toBeCloseTo(before, 6);
  });

  it('refuse un départ hors du territoire, une réserve vide ou un trop grand nombre', () => {
    const sim = setup();
    expect(sim.launchOffensive(A, 90, 30, 100, 30, 0.5)).toBe(0);
    expect(sim.launchOffensive(A, 55, 30, 55, 30, 0.5)).toBe(0);
    expect(sim.launchOffensive(A, 55, 30, 9999, 30, 0.5)).toBe(0);
    expect(sim.launchOffensive(A, 55, 30, 90, 30, 0)).toBe(0);
    expect(sim.launchOffensive(A, 55, 10, 90, 10, 0.1)).toBeGreaterThan(0);
    expect(sim.launchOffensive(A, 55, 30, 90, 30, 0.1)).toBeGreaterThan(0);
    expect(sim.launchOffensive(A, 55, 50, 90, 50, 0.1)).toBeGreaterThan(0);
    expect(sim.launchOffensive(A, 55, 40, 90, 40, 0.1)).toBe(0);
  });

  it('borne la portée d\'une flèche', () => {
    const wide = makeSim({ width: 400, height: 60, owner: (x) => (x < 200 ? A : B) });
    wide.declareWars([[A, B]]);
    wide.launchOffensive(A, 190, 30, 390, 30, 0.5);
    const { toX, toY } = wide.snapshot().offensives[0];
    expect(toX).toBe(290);
    expect(toY).toBe(30);
  });

  it('ne laisse pas le joueur annuler l\'offensive d\'une autre nation', () => {
    const sim = setup();
    const id = sim.launchOffensive(A, 55, 30, 90, 30, 0.5);
    sim.cancelOffensive(B, id);
    expect(sim.offensives.length).toBe(1);
  });

  it('s\'arrête quand la cible est atteinte et rend ses forces', () => {
    const sim = setup();
    const id = sim.launchOffensive(A, 58, 30, 64, 30, 1);
    expect(id).toBeGreaterThan(0);
    for (let t = 0; t < 4000 && sim.offensives.length > 0; t++) {
      holdBoth(sim)();
      sim.step();
    }
    expect(sim.offensives.length).toBe(0);
    expect(sim.owners[30 * sim.width + 64]).toBe(A);
  });

  it('coûte des forces aux deux camps', () => {
    const quiet = setup();
    const attacked = setup();
    attacked.launchOffensive(A, 55, 30, 110, 30, 1);
    runOrders(quiet, 600, holdBoth(quiet));
    runOrders(attacked, 600, holdBoth(attacked));
    expect(attacked.armyOf(B)).toBeLessThan(quiet.armyOf(B));
    expect(attacked.armyOf(A)).toBeLessThan(quiet.armyOf(A));
  });

  it('garde le déterminisme avec des offensives et l\'IA', () => {
    const play = () => {
      const sim = makeSim({ player: A, ai: true, seed: 21 });
      sim.declareWars([[A, B]]);
      sim.setFront(A, B, 0.5, 'hold');
      for (let t = 0; t < 2000; t++) {
        if (t === 300) sim.launchOffensive(A, 55, 20, 90, 30, 0.8);
        sim.step();
      }
      return sim.stateHash();
    };
    expect(play()).toBe(play());
  });
});

describe('encerclements', () => {
  // A encercle complètement une enclave de B située dans sa moitié, et B a son cœur à droite.
  const enclave = (x: number, y: number) => x >= 20 && x < 30 && y >= 25 && y < 35;
  // Une bande de mer sépare les deux pays pour que seule l'enclave soit au contact.
  const owner = (x: number, y: number) => {
    if (enclave(x, y)) return B;
    if (x === 60 || x === 119) return 0;
    return x < 60 ? A : B;
  };

  it('exempte une exclave d\'origine', () => {
    const sim = makeSim({ owner });
    sim.declareWars([[A, B]]);
    runOrders(sim, 80, () => {
      sim.setFront(A, B, 0.5, 'hold');
      sim.setFront(B, A, 0.5, 'hold');
    });
    expect(sim.isPocket(30 * 120 + 25)).toBe(false);
    expect(sim.cellsOf(B)).toBe(makeSim({ owner }).cellsOf(B));
  });

  /** Coupe un pays en deux avec une bande conquise par l'autre camp. */
  const cutOff = () => {
    const sim = makeSim({ owner: (x) => (x < 30 ? A : B), seed: 3 });
    sim.declareWars([[A, B]]);
    const W = sim.width;
    const flips: number[] = [];
    // A traverse B de haut en bas à x = 70..72 : on l'écrit directement via des bascules forcées.
    for (let y = 0; y < sim.height; y++) {
      for (let x = 30; x < 73; x++) {
        if (y >= 28 && y < 31) flips.push(y * W + x);
      }
    }
    for (let y = 0; y < sim.height; y++) {
      for (let x = 70; x < 73; x++) flips.push(y * W + x);
    }
    const unique = [...new Set(flips)];
    const internals = sim as unknown as { owners: Uint16Array; cellCounts: Int32Array; refreshFrontier(cell: number): void; supplyDirty: boolean };
    for (const cell of unique) {
      if (internals.owners[cell] === B) {
        internals.owners[cell] = A;
        internals.cellCounts[A]++;
        internals.cellCounts[B]--;
      }
    }
    for (let i = 0; i < internals.owners.length; i++) internals.refreshFrontier(i);
    internals.supplyDirty = true;
    return sim;
  };

  it('repère la plus petite partie coupée, pas la plus grande', () => {
    const sim = cutOff();
    runOrders(sim, 20, () => {
      sim.setFront(A, B, 0.5, 'hold');
      sim.setFront(B, A, 0.5, 'hold');
    });
    const smaller = sim.snapshot().pockets;
    expect(smaller.length).toBeGreaterThan(0);
    expect(smaller.every((pocket) => pocket.nation === B)).toBe(true);
    // À droite de la bande : la zone de B la plus grande reste ravitaillée.
    expect(sim.isPocket(10 * 120 + 100)).toBe(false);
    expect(sim.snapshot().nations.find((n) => n.id === B)!.pocketCells).toBeGreaterThan(0);
  });

  it('fait s\'effriter la poche sans attaque, et elle seule', () => {
    const sim = cutOff();
    const orders = () => {
      sim.setFront(A, B, 0.5, 'hold');
      sim.setFront(B, A, 0.5, 'hold');
    };
    runOrders(sim, 20, orders);
    const pocketCells = () => sim.snapshot().nations.find((n) => n.id === B)!.pocketCells;
    const before = pocketCells();
    const mainBefore = count(sim, B, (x) => x > 72);
    runOrders(sim, 400, orders);
    expect(pocketCells()).toBeLessThan(before);
    expect(count(sim, B, (x) => x > 72)).toBe(mainBefore);
  });

  it('ne compte pas une île sans contact comme une poche', () => {
    const island = (x: number, y: number) => x >= 10 && x < 14 && y >= 5 && y < 9;
    const sim = makeSim({
      owner: (x, y) => {
        if (island(x, y)) return B;
        if (x < 16 || y < 11) return 0;
        return x < 60 ? A : B;
      },
    });
    sim.declareWars([[A, B]]);
    runOrders(sim, 60, () => {
      sim.setFront(A, B, 0.5, 'hold');
      sim.setFront(B, A, 0.5, 'hold');
    });
    expect(sim.snapshot().pockets.length).toBe(0);
    expect(sim.isPocket(6 * 120 + 11)).toBe(false);
  });
});

describe('capacité militaire', () => {
  /** Quatre provinces par pays, en bandes verticales. */
  const makeProvinces = () => {
    const width = 80;
    const height = 20;
    const ownerGrid = new Uint16Array(width * height);
    const provinceGrid = new Uint16Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ownerGrid[y * width + x] = x < 40 ? A : B;
        provinceGrid[y * width + x] = Math.floor(x / 10) + 1;
      }
    }
    return new Simulation({
      width,
      height,
      nations: [{ population: 50e6, gdpMusd: 2e6 }, { population: 50e6, gdpMusd: 2e6 }],
      provinces: Array.from({ length: 8 }, (_, i) => ({ nation: i < 4 ? 0 : 1, areaKm2: 1000, x: i * 10 + 5, y: 10 })),
      provinceGrid,
      ownerGrid,
      seed: 9,
      player: A,
      ai: false,
    });
  };
  const capacity = (sim: Simulation, id: number) => sim.snapshot().nations.find((n) => n.id === id)!.capacity;

  it('laisse une part au vaincu, donne peu au vainqueur et se restaure à la libération', () => {
    const sim = makeProvinces();
    sim.declareWars([[A, B]]);
    const startA = capacity(sim, A);
    const startB = capacity(sim, B);
    let takenBy = 0;
    for (let t = 0; t < 40000 && takenBy === 0; t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0, 'hold');
      sim.step();
      if (sim.controllerOf(5) === A) takenBy = A;
    }
    expect(takenBy).toBe(A);
    // D'autres provinces de B ont pu tomber en même temps : on les compte. Une province
    // prise est abîmée par les combats, et chacune compte selon son développement.
    const value = startB / 4;
    const lost = [5, 6, 7, 8].filter((province) => sim.controllerOf(province) === A);
    expect(lost.length).toBeGreaterThan(0);
    for (const province of lost) expect(sim.development[province]).toBeCloseTo(0.85, 6);
    const kept = [5, 6, 7, 8].filter((province) => sim.controllerOf(province) === B);
    const sum = (provinces: number[]) => provinces.reduce((total, province) => total + sim.development[province] * value, 0);
    expect(capacity(sim, B)).toBeCloseTo(sum(kept) + sum(lost) * 0.35, 6);
    expect(capacity(sim, A)).toBeCloseTo(startA + sum(lost) * 0.12, 6);

    for (let t = 0; t < 40000 && sim.controllerOf(5) !== B; t++) {
      sim.setFront(A, B, 0, 'retreat');
      sim.setFront(B, A, 1, 'attack');
      sim.step();
    }
    expect(sim.controllerOf(5)).toBe(B);
  });
});

describe('IA', () => {
  it('engage presque tout en sous-nombre, et garde une réserve sinon', () => {
    const allocationOf = (playerShare: number) => {
      const sim = makeSim({ player: A, ai: true, seed: 5 });
      sim.declareWars([[A, B]]);
      for (let t = 0; t < 400; t++) {
        sim.setFront(A, B, playerShare, 'hold');
        sim.step();
      }
      return sim.fronts[0].sides[1].allocation;
    };
    expect(allocationOf(1)).toBeGreaterThan(0.9);
    expect(allocationOf(0.2)).toBeLessThan(0.8);
  });

  it('lance des offensives contre un joueur immobile', () => {
    const sim = makeSim({ player: A, ai: true, seed: 5 });
    sim.declareWars([[A, B]]);
    sim.setFront(A, B, 1, 'hold');
    let launched = false;
    for (let t = 0; t < 6000 && !launched; t++) {
      sim.step();
      launched = sim.offensives.some((offensive) => offensive.nation === B);
    }
    expect(launched).toBe(true);
  });
});
