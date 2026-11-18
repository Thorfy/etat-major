// L'autarcie relie d'elle-même ses gisements au réseau, gratuitement, d'autant plus qu'elle est poussée.
import { describe, expect, it } from 'vitest';
import { DOCTRINE_AXIS_COUNT } from '../src/sim/doctrine.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const W = 200;
const H = 80;
const A = 1;
const B = 2;

/**
 * A en haut (deux rangées de dix provinces de 20 × 20 cellules), B en bas. Quatre gisements de pétrole
 * de A, de tailles 4, 3, 2 et 1, dans des provinces pauvres de la rangée du haut.
 */
function world(): SimConfig {
  const ownerGrid = new Uint16Array(W * H);
  const provinceGrid = new Uint16Array(W * H);
  const ids = new Map<string, number>();
  const provinces: SimConfig['provinces'] = [];
  const deposits = new Map([
    ['2,0', 4],
    ['5,0', 3],
    ['7,0', 2],
    ['9,0', 1],
  ]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = y < 40 ? A : B;
      ownerGrid[y * W + x] = n;
      const key = `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
      let id = ids.get(key);
      if (!id) {
        const oil = deposits.get(key) ?? 0;
        // Les gisements sont dans des provinces pauvres : jamais villes principales par leur richesse.
        provinces.push({ nation: n - 1, areaKm2: 10000, x: Math.floor(x / 20) * 20 + 10, y: Math.floor(y / 20) * 20 + 10, population: 1e6, gdpMusd: oil > 0 ? 1e3 : 1e4, oil });
        id = provinces.length;
        ids.set(key, id);
      }
      provinceGrid[y * W + x] = id;
    }
  }
  return {
    width: W,
    height: H,
    nations: [
      { population: 20e6, gdpMusd: 2e6 },
      { population: 20e6, gdpMusd: 2e6 },
    ],
    provinces,
    provinceGrid,
    ownerGrid,
    seed: 5,
    player: A,
    ai: false,
  };
}

/** Fixe la position de A sur l'axe Échanges (−1 : autarcie, +1 : libre-échange), et l'y tient. */
function withExchange(position: number): Simulation {
  const sim = new Simulation(world());
  const internals = sim as unknown as { doctrine: Float64Array; doctrineTarget: Float64Array };
  for (let t = 0; t < 600; t++) {
    internals.doctrine[A * DOCTRINE_AXIS_COUNT + 3] = position;
    internals.doctrineTarget[A * DOCTRINE_AXIS_COUNT + 3] = position;
    sim.step();
  }
  return sim;
}

const oilOf = (sim: Simulation, p: number) => (sim as unknown as { provinceOil: Float64Array }).provinceOil[p];

describe("réseau : de l'autarcie au libre-échange", () => {
  it("l'autarcie relie ses gisements gratuitement : tous à fond, la moitié au centre, aucun en libre-échange", () => {
    const oils = (position: number) => {
      const sim = withExchange(position);
      return (sim.networkOf(A).resources ?? []).map((p) => oilOf(sim, p));
    };
    expect(oils(-1)).toEqual([4, 3, 2, 1]);
    expect(oils(0)).toEqual([4, 3]);
    expect(oils(1)).toEqual([]);
  });

  it("en autarcie, chaque gisement relié est sur une route, sans prendre de place de ville principale", () => {
    const sim = withExchange(-1);
    const network = sim.networkOf(A);
    const onRoads = new Set(sim.tradeAxes.filter((axis) => axis.auto && axis.nation === A).flatMap((axis) => axis.provinces));
    for (const p of network.resources ?? []) {
      expect(onRoads.has(p)).toBe(true);
      expect(network.principal).toContain(p);
    }
    // Chaque ville compte : autant de villes reliées que la capacité, et aucune n'est un gisement pauvre.
    expect(network.hubs).toHaveLength(network.capacity);
    expect(network.hubs.some((p) => oilOf(sim, p) > 0)).toBe(false);
  });

  it('le libre-échange ne compte que les bouts de route : bien plus de villes reliées pour la même capacité', () => {
    const autarky = withExchange(-1).networkOf(A);
    const middle = withExchange(0).networkOf(A);
    const free = withExchange(1).networkOf(A);
    expect(free.capacity).toBe(autarky.capacity);
    expect(free.termini ?? 0).toBeLessThanOrEqual(free.capacity);
    expect(free.hubs.length).toBeGreaterThan(autarky.hubs.length);
    // Le centre est entre les deux.
    expect(middle.hubs.length).toBeGreaterThanOrEqual(autarky.hubs.length);
    expect(middle.hubs.length).toBeLessThanOrEqual(free.hubs.length);
  });
});
