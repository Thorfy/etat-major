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

/** Fixe la position de A sur l'axe Échanges (−1 : autarcie), puis laisse le réseau se redessiner. */
function withAutarky(position: number): Simulation {
  const sim = new Simulation(world());
  (sim as unknown as { doctrine: Float64Array }).doctrine[A * DOCTRINE_AXIS_COUNT + 3] = position;
  for (let t = 0; t < 600; t++) sim.step();
  return sim;
}

const oilOf = (sim: Simulation, p: number) => (sim as unknown as { provinceOil: Float64Array }).provinceOil[p];

describe("routes de l'autarcie", () => {
  it('sans autarcie, aucun gisement pauvre n\'est relié', () => {
    const sim = withAutarky(0);
    const network = sim.networkOf(A);
    expect(network.resources ?? []).toEqual([]);
    expect(network.principal.some((p) => oilOf(sim, p) > 0)).toBe(false);
  });

  it('à mi-chemin, les deux plus gros gisements ; à fond, tous, sans prendre de place de ville principale', () => {
    const half = withAutarky(-0.5);
    const linked = half.networkOf(A).resources ?? [];
    expect(linked.map((p) => oilOf(half, p))).toEqual([4, 3]);

    const full = withAutarky(-1);
    const network = full.networkOf(A);
    expect((network.resources ?? []).map((p) => oilOf(full, p))).toEqual([4, 3, 2, 1]);
    // Chaque gisement est sur une route du réseau, et compte comme une ville du réseau…
    const onRoads = new Set(full.tradeAxes.filter((axis) => axis.auto && axis.nation === A).flatMap((axis) => axis.provinces));
    for (const p of network.resources ?? []) {
      expect(onRoads.has(p)).toBe(true);
      expect(network.principal).toContain(p);
    }
    // … sans prendre de place : les villes principales restent au plafond habituel.
    expect(network.hubs.length).toBeLessThanOrEqual(network.capacity);
    expect(network.hubs.some((p) => oilOf(full, p) > 0)).toBe(false);
  });
});
