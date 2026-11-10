import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, decodeSave, encodeSave, hashGrid } from '../src/game/saveFormat.ts';
import { encodeRle } from '../src/map/codec.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';
import { traceRoute } from '../src/sim/route.ts';

const A = 1;
const B = 2;
const C = 3;

interface WorldOptions {
  width?: number;
  height?: number;
  seed?: number;
  player?: number;
  ai?: boolean;
  nations?: number;
  gdp?: (nation: number) => number;
  owner: (x: number, y: number) => number;
  /** Découpe chaque nation en bandes verticales de cette largeur. */
  provinceWidth?: number;
}

function makeWorld(options: WorldOptions): SimConfig {
  const width = options.width ?? 120;
  const height = options.height ?? 40;
  const nationCount = options.nations ?? 2;
  const ownerGrid = new Uint16Array(width * height);
  const provinceGrid = new Uint16Array(width * height);
  const stripe = options.provinceWidth ?? width;
  const provinceIds = new Map<string, number>();
  const provinces: SimConfig['provinces'] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const owner = options.owner(x, y);
      ownerGrid[y * width + x] = owner;
      if (owner === 0) continue;
      const key = `${owner}:${Math.floor(x / stripe)}`;
      let id = provinceIds.get(key);
      if (!id) {
        provinces.push({ nation: owner - 1, areaKm2: 1000, x, y: Math.floor(height / 2) });
        id = provinces.length;
        provinceIds.set(key, id);
      }
      provinceGrid[y * width + x] = id;
    }
  }
  return {
    width,
    height,
    nations: Array.from({ length: nationCount }, (_, i) => ({ population: 50e6, gdpMusd: options.gdp?.(i + 1) ?? 2e6 })),
    provinces,
    provinceGrid,
    ownerGrid,
    seed: options.seed ?? 7,
    player: options.player ?? 0,
    ai: options.ai ?? false,
  };
}

/** Deux îles séparées par la mer des deux côtés : la carte boucle en longitude. */
const islands = (x: number) => (x < 50 ? A : x < 70 ? 0 : x < 110 ? B : 0);

const holdAll = (sim: Simulation) => {
  sim.setFront(A, B, 0.2, 'hold');
  sim.setFront(B, A, 0.2, 'hold');
};

describe('trajets', () => {
  const W = 120;
  const H = 40;
  const grid = makeWorld({ owner: islands }).ownerGrid;

  it('reconnaît une traversée et trouve la plage de débarquement', () => {
    const route = traceRoute(grid, W, H, 45, 20, 90, 20);
    expect(route.amphibious).toBe(true);
    expect(route.landingX).toBe(70);
    expect(route.landingY).toBe(20);
    expect(route.seaCells).toBe(20);
  });

  it('ne fait pas d\'un trajet à terre un débarquement', () => {
    expect(traceRoute(grid, W, H, 10, 20, 40, 20).amphibious).toBe(false);
  });

  it('refuse une cible en mer', () => {
    expect(traceRoute(grid, W, H, 45, 20, 60, 20).amphibious).toBe(false);
  });

  it('ignore un trajet trop court sur l\'eau', () => {
    const river = makeWorld({ owner: (x) => (x === 60 || x === 61 ? 0 : x < 60 ? A : B) }).ownerGrid;
    expect(traceRoute(river, W, H, 50, 20, 70, 20).amphibious).toBe(false);
  });

  it('traverse la longitude 180°', () => {
    const wrap = makeWorld({ owner: (x) => (x < 10 ? A : x > 100 ? B : 0) }).ownerGrid;
    const route = traceRoute(wrap, W, H, 5, 20, 110, 20);
    expect(route.amphibious).toBe(false); // la voie la plus courte ne touche pas d'eau
    const route2 = traceRoute(makeWorld({ owner: (x) => (x < 10 ? A : x > 100 && x < 112 ? B : 0) }).ownerGrid, W, H, 5, 20, 105, 20);
    expect(route2.amphibious).toBe(true);
    expect(route2.landingX).toBe(111);
  });
});

describe('débarquements', () => {
  const start = (gdp?: (nation: number) => number) => {
    const sim = new Simulation(makeWorld({ owner: islands, gdp }));
    sim.declareWars([[A, B]]);
    holdAll(sim);
    return sim;
  };

  it('prend du temps, puis crée une tête de pont sur la côte ennemie', () => {
    const sim = start();
    const id = sim.launchOffensive(A, 45, 20, 90, 20, 1);
    expect(id).toBeGreaterThan(0);
    expect(sim.snapshot().offensives[0].inTransit).toBe(true);
    const cellsBefore = sim.cellsOf(A);
    for (let t = 0; t < 30; t++) {
      holdAll(sim);
      sim.step();
    }
    expect(sim.cellsOf(A)).toBe(cellsBefore);
    for (let t = 0; t < 25; t++) {
      holdAll(sim);
      sim.step();
    }
    expect(sim.snapshot().offensives[0].inTransit).toBe(false);
    expect(sim.owners[20 * 120 + 70]).toBe(A);
    expect(sim.cellsOf(A)).toBeGreaterThan(cellsBefore);
  });

  it('perd moins de forces avec une marine plus forte', () => {
    const lossWith = (gdpA: number) => {
      const sim = start((n) => (n === A ? gdpA : 2e6));
      const id = sim.launchOffensive(A, 45, 20, 90, 20, 1);
      const before = sim.snapshot().offensives.find((o) => o.id === id)!.force;
      for (let t = 0; t < 41; t++) {
        holdAll(sim);
        sim.step();
      }
      const after = sim.snapshot().offensives.find((o) => o.id === id)!;
      expect(after.inTransit).toBe(false);
      return 1 - after.force / before;
    };
    expect(lossWith(50e6)).toBeLessThan(lossWith(2e5));
  });

  it('refuse un débarquement chez un neutre, ou sans marine', () => {
    const neutral = new Simulation(makeWorld({ owner: islands }));
    expect(neutral.launchOffensive(A, 45, 20, 90, 20, 1)).toBe(0);

    const landlocked = new Simulation(makeWorld({
      nations: 3,
      owner: (x, y) => {
        if (x >= 70) return B;
        if (x >= 50) return 0;
        // A est entouré par C, sans accès à la mer.
        return x > 5 && x < 30 && y > 5 && y < 35 ? A : C;
      },
    }));
    landlocked.declareWars([[A, B]]);
    expect(landlocked.launchOffensive(A, 29, 20, 75, 20, 1)).toBe(0);
  });

  it('rend ses forces si le débarquement est annulé en mer', () => {
    const sim = start();
    const before = sim.reserveOf(A);
    const id = sim.launchOffensive(A, 45, 20, 90, 20, 0.5);
    sim.cancelOffensive(A, id);
    expect(sim.reserveOf(A)).toBeCloseTo(before, 6);
  });

  it('ne compte pas une tête de pont comme une poche tant que la marine suit', () => {
    const sim = start();
    sim.launchOffensive(A, 45, 20, 90, 20, 1);
    for (let t = 0; t < 120; t++) {
      holdAll(sim);
      sim.step();
    }
    expect(sim.isPocket(20 * 120 + 70)).toBe(false);
  });

  it('ravitaille une tête de pont par la mer tant que la marine la tient', () => {
    const sim = start();
    sim.launchOffensive(A, 45, 20, 90, 20, 1);
    for (let t = 0; t < 120; t++) {
      holdAll(sim);
      sim.step();
    }
    expect(sim.owners[20 * 120 + 70]).toBe(A);
    expect(sim.supplyAt(20 * 120 + 70)).toBe(1);
  });

  it('ne ravitaille plus une tête de pont dont la marine a perdu la mer', () => {
    const sim = start((n) => (n === A ? 1e3 : 50e6));
    sim.launchOffensive(A, 45, 20, 90, 20, 1);
    let cut = false;
    for (let t = 0; t < 200 && !cut; t++) {
      holdAll(sim);
      sim.step();
      cut = sim.owners[20 * 120 + 70] === A && sim.supplyAt(20 * 120 + 70) < 0.2;
    }
    expect(cut).toBe(true);
  });

  it('coupe le ravitaillement côtier d\'une marine trop faible', () => {
    const sim = start((n) => (n === A ? 1e3 : 50e6));
    sim.launchOffensive(A, 45, 20, 90, 20, 1);
    let pocket = false;
    for (let t = 0; t < 200 && !pocket; t++) {
      holdAll(sim);
      sim.step();
      pocket = sim.isPocket(20 * 120 + 71) || sim.isPocket(20 * 120 + 70);
    }
    expect(pocket).toBe(true);
  });
});

describe('plafond de vitesse', () => {
  it('borne les bascules d\'un front très long et sans défense', () => {
    const sim = new Simulation(makeWorld({
      width: 200,
      height: 200,
      owner: (x) => (x < 100 ? A : B),
    }));
    sim.declareWars([[A, B]]);
    const start = sim.cellsOf(A);
    const ticks = 400;
    for (let t = 0; t < ticks; t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0, 'hold');
      sim.step();
    }
    const gained = sim.cellsOf(A) - start;
    expect(gained).toBeGreaterThan(ticks * 1.5 * 0.8);
    expect(gained).toBeLessThanOrEqual(ticks * 1.5);
  });
});

describe('capitulation', () => {
  /** B a un continent contre A et une île lointaine : celle-ci doit être annexée aussi. */
  const withIsland = () =>
    new Simulation(makeWorld({
      provinceWidth: 10,
      owner: (x, y) => {
        if (x < 40) return A;
        if (x < 80) return B;
        if (x > 100 && y > 15 && y < 25) return B;
        return 0;
      },
    }));

  const conquer = (sim: Simulation) => {
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 80000 && sim.isAlive(B); t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0, 'hold');
      sim.step();
    }
  };

  it('annexe tout le reste, îles comprises, et clôt les fronts', () => {
    const sim = withIsland();
    conquer(sim);
    expect(sim.isAlive(B)).toBe(false);
    expect(sim.cellsOf(B)).toBe(0);
    expect(sim.owners[20 * 120 + 105]).toBe(A);
    expect(sim.fronts.length).toBe(0);
    expect(sim.frontierSize).toBe(0);
    const events = sim.drainChanges().events;
    expect(events.some((event) => event.type === 'capitulation' && event.loser === B && event.winner === A)).toBe(true);
  });

  it('transmet tous les changements de grille, annexion comprise', () => {
    const sim = withIsland();
    const mirror = sim.owners.slice();
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 80000 && sim.isAlive(B); t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0, 'hold');
      sim.step();
      const { cells, owners } = sim.drainChanges();
      cells.forEach((cell, i) => {
        mirror[cell] = owners[i];
      });
    }
    expect(sim.isAlive(B)).toBe(false);
    expect(mirror).toEqual(sim.owners);
  });

  it('augmente la capacité du vainqueur, sans lui donner la valeur entière', () => {
    const sim = withIsland();
    const before = sim.capacityOf(A);
    const loserValue = sim.capacityOf(B);
    conquer(sim);
    expect(sim.capacityOf(A)).toBeGreaterThan(before);
    expect(sim.capacityOf(A)).toBeLessThan(before + loserValue);
    expect(sim.capacityOf(B)).toBe(0);
  });

  it('libère le tiers en guerre contre le vaincu et lui rend ses forces', () => {
    const sim = new Simulation(makeWorld({
      nations: 3,
      provinceWidth: 10,
      owner: (x) => (x < 40 ? A : x < 80 ? B : C),
    }));
    sim.declareWars([[A, B], [B, C]]);
    for (let t = 0; t < 100; t++) {
      sim.setFront(C, B, 0.5, 'hold');
      sim.step();
    }
    const armyOfC = sim.armyOf(C);
    for (let t = 0; t < 80000 && sim.isAlive(B); t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0, 'hold');
      sim.setFront(C, B, 0.5, 'hold');
      sim.step();
    }
    expect(sim.isAlive(B)).toBe(false);
    expect(sim.fronts.length).toBe(0);
    expect(sim.reserveOf(C)).toBeGreaterThan(armyOfC * 0.9);
    // Le déroulé continue sans erreur, même avec la frontière vide.
    expect(() => sim.step()).not.toThrow();
  });

  it('garde une frontière exacte après une annexion, si la guerre continue ailleurs', () => {
    // A annexe B, et reste en guerre contre C qui touchait B : la frontière doit s'y déplacer.
    const sim = new Simulation(makeWorld({
      nations: 3,
      provinceWidth: 10,
      owner: (x) => (x < 40 ? A : x < 80 ? B : C),
    }));
    sim.declareWars([[A, B], [A, C]]);
    for (let t = 0; t < 80000 && sim.isAlive(B); t++) {
      sim.setFront(A, B, 0.9, 'attack');
      sim.setFront(B, A, 0, 'hold');
      sim.setFront(A, C, 0, 'hold');
      sim.setFront(C, A, 0, 'hold');
      sim.step();
    }
    expect(sim.isAlive(B)).toBe(false);
    expect(sim.fronts.length).toBe(1);
    let expected = 0;
    for (let y = 0; y < sim.height; y++) {
      for (let x = 0; x < sim.width; x++) {
        const owner = sim.owners[y * sim.width + x];
        const around = [
          sim.owners[y * sim.width + (x + 1) % sim.width],
          sim.owners[y * sim.width + (x + sim.width - 1) % sim.width],
          y > 0 ? sim.owners[(y - 1) * sim.width + x] : 0,
          y < sim.height - 1 ? sim.owners[(y + 1) * sim.width + x] : 0,
        ];
        if (owner !== 0 && around.some((n) => n !== 0 && n !== owner)) expected++;
      }
    }
    expect(expected).toBeGreaterThan(0);
    expect(sim.frontierSize).toBe(expected);
    expect(sim.fronts[0].length).toBeGreaterThan(0);
  });

  it('survit à la capitulation du joueur', () => {
    const sim = new Simulation(makeWorld({ provinceWidth: 10, owner: (x) => (x < 60 ? A : B), player: A, ai: true }));
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 80000 && sim.isAlive(A); t++) {
      sim.setFront(A, B, 0, 'retreat');
      sim.step();
    }
    expect(sim.isAlive(A)).toBe(false);
    expect(() => {
      for (let t = 0; t < 50; t++) sim.step();
      sim.snapshot();
    }).not.toThrow();
  });
});

describe('guerres de l\'IA', () => {
  const line = () => makeWorld({
    width: 200,
    nations: 4,
    provinceWidth: 10,
    gdp: (n) => [8e6, 2e6, 2e6, 8e5][n - 1],
    owner: (x) => (x < 50 ? 1 : x < 100 ? 2 : x < 150 ? 3 : 4),
  });

  it('fait attaquer un voisin plus faible, jamais un plus fort', () => {
    const sim = new Simulation({ ...line(), ai: true, seed: 3 });
    let wars = 0;
    for (let t = 0; t < 20000 && wars < 1; t++) {
      sim.step();
      for (const event of sim.drainChanges().events) {
        if (event.type === 'war') wars++;
      }
    }
    expect(wars).toBeGreaterThan(0);
    const front = sim.fronts[0];
    const capacities = [sim.capacityOf(front.a), sim.capacityOf(front.b)];
    expect(Math.max(...capacities) / Math.min(...capacities)).toBeGreaterThan(1);
  });

  it('épargne le joueur pendant le répit', () => {
    const sim = new Simulation({ ...line(), ai: true, seed: 3, player: 2 });
    for (let t = 0; t < 1700; t++) {
      sim.step();
      expect(sim.fronts.some((front) => front.a === 2 || front.b === 2)).toBe(false);
    }
  });

  it('va chercher un voisin par la mer quand il n\'en a pas à terre', () => {
    const sim = new Simulation({
      ...makeWorld({
        provinceWidth: 10,
        gdp: (n) => (n === A ? 8e6 : 2e6),
        owner: (x) => (x < 50 ? A : x < 70 ? 0 : B),
      }),
      ai: true,
      seed: 11,
    });
    let declared = false;
    let landed = false;
    for (let t = 0; t < 30000 && !landed; t++) {
      sim.step();
      sim.drainChanges();
      declared ||= sim.fronts.length > 0;
      landed = sim.owners.some((owner, cell) => owner === A && cell % 120 >= 70);
    }
    expect(declared).toBe(true);
    expect(landed).toBe(true);
  });
});

describe('déclaration de guerre du joueur', () => {
  it('mesure le front tout de suite et n\'immobilise rien sans frontière', () => {
    const sim = new Simulation(makeWorld({
      nations: 3,
      player: A,
      owner: (x) => (x < 40 ? A : x < 70 ? B : x < 90 ? 0 : C),
    }));
    sim.declareWars([[A, B], [A, C]]);
    const withB = sim.fronts.find((front) => front.b === B)!;
    const withC = sim.fronts.find((front) => front.b === C)!;
    expect(withB.length).toBeGreaterThan(0);
    expect(withB.sides[0].allocation).toBeGreaterThan(0);
    // À l'ouest, A touche C par le bouclage : cette carte-ci garde donc un contact.
    expect(withC.length).toBeGreaterThan(0);

    const island = new Simulation(makeWorld({ player: A, owner: islands }));
    island.declareWars([[A, B]]);
    expect(island.fronts[0].length).toBe(0);
    expect(island.fronts[0].sides[0].allocation).toBe(0);
  });
});

describe('sauvegarde', () => {
  const config = () => makeWorld({
    width: 200,
    height: 60,
    nations: 4,
    provinceWidth: 10,
    seed: 17,
    player: 1,
    ai: true,
    gdp: (n) => [3e6, 2e6, 1e6, 5e5][n - 1],
    owner: (x, y) => {
      if (y > 50) return 0;
      if (x < 50) return 1;
      if (x < 110) return 2;
      if (x < 125) return 0;
      return x < 165 ? 3 : 4;
    },
  });

  const play = (sim: Simulation, ticks: number) => {
    for (let t = 0; t < ticks; t++) {
      if (t === 200) sim.declareWars([[1, 2]]);
      if (t === 300) sim.launchOffensive(1, 45, 20, 70, 20, 0.5);
      sim.step();
    }
  };

  it('reprend exactement la même partie qu\'une partie jamais interrompue', () => {
    const original = new Simulation(config());
    play(original, 2400);

    // Aller-retour par JSON, comme dans un vrai fichier.
    const raw = original.save();
    const saved = { owners: raw.owners, supply: raw.supply, forts: raw.forts, state: JSON.parse(JSON.stringify(raw.state)) };

    const resumed = new Simulation({ ...config(), saved });
    expect(resumed.tick).toBe(original.tick);
    expect(resumed.stateHash()).toBe(original.stateHash());

    for (let t = 0; t < 2400; t++) {
      original.step();
      resumed.step();
    }
    expect(resumed.stateHash()).toBe(original.stateHash());
    expect(resumed.owners).toEqual(original.owners);
    expect(resumed.aliveCount).toBe(original.aliveCount);
  });

  it('survit au format de fichier complet', async () => {
    const sim = new Simulation(config());
    play(sim, 800);
    const meta = {
      version: SAVE_VERSION,
      mapHash: hashGrid(config().provinceGrid),
      player: 1,
      playerName: 'Test',
      tick: sim.tick,
      savedAt: 123,
      offensiveShare: 0.7,
      journal: [],
      labels: [],
    };
    const blob = await encodeSave({ meta, sim: sim.save() });
    const decoded = await decodeSave(blob, sim.owners.length, SAVE_VERSION);
    expect(decoded.meta).toEqual(meta);
    const resumed = new Simulation({ ...config(), saved: decoded.sim });
    expect(resumed.stateHash()).toBe(sim.stateHash());
  });

  it('met à jour et reprend les sauvegardes des versions précédentes', async () => {
    const sim = new Simulation(config());
    play(sim, 800);
    const current = sim.save();
    // Ce que chaque version a ajouté à l'état de la simulation.
    const added: Record<number, string[]> = {
      2: ['provinceGdp', 'development', 'effort', 'effortTarget', 'growth'],
      3: ['consolidation'],
      4: [
        'rawCapacity', 'provinceManpower', 'manpower', 'manpowerMax', 'armyAfterReinforce', 'losses', 'stability',
        'oilCoverage', 'steelCoverage', 'blockaded', 'factories', 'infrastructure', 'depots', 'queues', 'buildProgress',
        'constructionRate',
      ],
      5: ['counterShare', 'counterAttempts', 'priorityZones'],
      6: ['alliances', 'truces', 'aggression', 'coalitionAgainst', 'peaceOffers'],
    };
    const gzip = async (parts: BlobPart[]) =>
      new Blob([await new Response(new Blob(parts).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()]);
    for (const version of [1, 2, 3, 4, 5]) {
      const state = JSON.parse(JSON.stringify(current.state));
      for (let later = version + 1; later <= 6; later++) for (const key of added[later] ?? []) delete state[key];
      for (const front of state.fronts) delete front.startTick;
      if (version < 5) {
        for (const front of state.fronts) for (const side of front.sides) delete side.priority;
        for (const offensive of state.offensives) delete offensive.counter;
      }
      if (version < 3) {
        // Avant la version 3 : poches en une seule liste, indicateur booléen, pas de ravitaillement.
        state.pocketList = state.pocketLists.flat();
        delete state.pocketLists;
        state.supplyDirty = true;
        for (const front of state.fronts) for (const side of front.sides) delete side.supply;
        for (const offensive of state.offensives) {
          delete offensive.supply;
          delete offensive.supplySum;
          delete offensive.supplyCount;
        }
      }
      const meta = { version, mapHash: 0, player: 1, playerName: 'Test', tick: sim.tick, savedAt: 1, offensiveShare: 0.7, journal: [], labels: [] };
      const json = new TextEncoder().encode(JSON.stringify({ meta, state }));
      const rle = encodeRle(current.owners) as Uint16Array<ArrayBuffer>;
      const supplyRle = encodeRle(Uint16Array.from(current.supply)) as Uint16Array<ArrayBuffer>;
      const fortRle = encodeRle(Uint16Array.from(current.forts)) as Uint16Array<ArrayBuffer>;
      const blob = await gzip(
        version >= 5
          ? [new Uint32Array([json.length, rle.length, supplyRle.length, fortRle.length]), json, rle, supplyRle, fortRle]
          : version >= 3
            ? [new Uint32Array([json.length, rle.length, supplyRle.length]), json, rle, supplyRle]
            : [new Uint32Array([json.length, rle.length]), json, rle],
      );

      const decoded = await decodeSave(blob, sim.owners.length, version);
      expect(decoded.meta.version).toBe(SAVE_VERSION);
      const resumed = new Simulation({ ...config(), saved: decoded.sim });
      expect(resumed.tick).toBe(sim.tick);
      expect(resumed.owners).toEqual(sim.owners);
      // La partie continue sans erreur, avec une armée et une capacité cohérentes.
      play(resumed, 600);
      for (const nation of [A, B]) {
        if (!resumed.isAlive(nation)) continue;
        expect(resumed.capacityOf(nation)).toBeGreaterThan(0);
        expect(Number.isFinite(resumed.armyOf(nation))).toBe(true);
        expect(resumed.manpowerOf(nation)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('refuse une sauvegarde d\'une version plus récente', async () => {
    await expect(decodeSave(new Blob([]), 10, SAVE_VERSION + 1)).rejects.toThrow(/plus récente/);
  });
});

describe('noms de pays', () => {
  it('fait disparaître le nom d\'un vaincu et déplace celui du vainqueur', () => {
    const sim = new Simulation(makeWorld({ provinceWidth: 10, owner: (x) => (x < 40 ? A : x < 80 ? B : 0) }));
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 80000 && sim.isAlive(B); t++) {
      sim.setFront(A, B, 1, 'attack');
      sim.setFront(B, A, 0, 'hold');
      sim.step();
    }
    const labels = sim.updateLabels();
    expect(labels.find((label) => label.id === B)?.r).toBe(-1);
    expect(labels.find((label) => label.id === A)?.r).toBeGreaterThan(0);
    expect(sim.updateLabels()).toEqual([]);
  });
});

describe('mers et éloignement', () => {
  it("refuse un débarquement sur une mer intérieure qu'on ne borde pas", () => {
    // Océan x ∈ [60, 80) entre A et B ; une mer intérieure x ∈ [130, 155), y ∈ [10, 30) chez B ;
    // l'océan encore à l'est de B, pour que la carte qui boucle ne relie pas A à B par la terre.
    const inland = (x: number, y: number) =>
      x < 60 ? A : x < 80 || x >= 200 ? 0 : x >= 130 && x < 155 && y >= 10 && y < 30 ? 0 : B;
    const sim = new Simulation(makeWorld({ width: 300, height: 40, owner: inland }));
    sim.declareWars([[A, B]]);
    // Par l'océan, puis par-dessus B, pour toucher terre depuis la mer intérieure : refusé.
    expect(sim.launchOffensive(A, 55, 20, 160, 20, 0.3)).toBe(0);
    // La côte de B sur l'océan reste à portée.
    expect(sim.launchOffensive(A, 55, 20, 90, 20, 0.3)).toBeGreaterThan(0);
  });

  it('ravitaille mal une tête de pont loin de ses ports', () => {
    // Deux cartes : B à 40 cellules d'eau de A, ou à 900.
    const beachhead = (W: number, sea: number, fromX: number, toX: number, landing: number) => {
      const owner = (x: number) => (x < 20 ? A : x < 20 + sea ? 0 : x < 100 + sea ? B : 0);
      const sim = new Simulation(makeWorld({ width: W, height: 20, owner, gdp: (n) => (n === A ? 20e6 : 2e6) }));
      sim.declareWars([[A, B]]);
      expect(sim.launchOffensive(A, fromX, 10, toX, 10, 1)).toBeGreaterThan(0);
      for (let t = 0; t < 2400 && sim.owners[10 * W + landing] !== A; t++) {
        sim.setFront(A, B, 0, 'hold');
        sim.setFront(B, A, 0, 'hold');
        sim.step();
      }
      expect(sim.owners[10 * W + landing]).toBe(A);
      for (let t = 0; t < 60; t++) sim.step();
      return sim.supplyAt(10 * W + landing);
    };
    const near = beachhead(200, 40, 17, 70, 60);
    const distant = beachhead(2000, 900, 17, 930, 920);
    expect(near).toBe(1);
    expect(distant).toBeLessThan(0.7);
  });
});
