import { describe, expect, it } from 'vitest';
import { AUTO_HUBS_BASE, AUTO_HUBS_PER_PROVINCES, AUTO_HUBS_PER_RESEARCH, AUTO_TRANSIT_BONUS, HUB_BONUS, NETWORK_CHECK_GROUPS } from '../src/sim/balance.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const W = 200;
const H = 80;
const A = 1;
const B = 2;
/** Une passe complète de vérification des réseaux. */
const CHECK = 10 * NETWORK_CHECK_GROUPS + 10;

/**
 * Provinces de 20 × 20 cellules ; `gdp(col, row)` fixe le PIB de chacune. A tient tout, sauf la
 * dernière rangée si `withB`.
 */
function config(gdp: (col: number, row: number) => number, withB = false): SimConfig {
  const ownerGrid = new Uint16Array(W * H);
  const provinceGrid = new Uint16Array(W * H);
  const provinces: SimConfig['provinces'] = [];
  const ids = new Map<string, number>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [col, row] = [Math.floor(x / 20), Math.floor(y / 20)];
      const nation = withB && row === 3 ? B : A;
      ownerGrid[y * W + x] = nation;
      const key = `${col}:${row}`;
      let id = ids.get(key);
      if (!id) {
        provinces.push({ nation: nation - 1, areaKm2: 10000, x: col * 20 + 10, y: row * 20 + 10, population: 1e6, gdpMusd: gdp(col, row) });
        id = provinces.length;
        ids.set(key, id);
      }
      provinceGrid[y * W + x] = id;
    }
  }
  return {
    width: W,
    height: H,
    nations: withB ? [{ population: 40e6, gdpMusd: 4e6 }, { population: 10e6, gdpMusd: 1e6 }] : [{ population: 40e6, gdpMusd: 4e6 }],
    provinces,
    provinceGrid,
    ownerGrid,
    seed: 4,
    player: A,
    ai: false,
  };
}

const run = (sim: Simulation, ticks: number) => {
  for (let t = 0; t < ticks; t++) sim.step();
};
const at = (sim: Simulation, col: number, row: number) => sim.provinceGrid[(row * 20 + 10) * W + col * 20 + 10];
const bonusOf = (sim: Simulation, p: number) => (sim as unknown as { axisBonus: Float64Array }).axisBonus[p];

describe('réseau commercial automatique', () => {
  it('relie les départements les plus riches, autant que le territoire en permet', () => {
    // Le PIB baisse d'une province à l'autre, en lisant la carte ligne par ligne.
    const sim = new Simulation(config((col, row) => 1e5 - (row * 10 + col) * 1000));
    run(sim, CHECK);
    const network = sim.networkOf(A);
    // 40 départements : la base, plus un par tranche de AUTO_HUBS_PER_PROVINCES.
    const capacity = AUTO_HUBS_BASE + Math.floor(40 / AUTO_HUBS_PER_PROVINCES);
    expect(sim.hubCapacityOf(A).total).toBe(capacity);
    expect(network.hubs).toHaveLength(capacity);
    expect(network.hubs[0]).toBe(at(sim, 0, 0));
    // Chaque ville principale est sur une route du réseau, et y gagne HUB_BONUS.
    const routes = sim.tradeAxes.filter((axis) => axis.auto && axis.nation === A);
    expect(routes.length).toBe(capacity - 1);
    for (const hub of network.hubs) expect(bonusOf(sim, hub)).toBe(HUB_BONUS);
  });

  it('saute un département déjà traversé, qui garde le bonus d\'une ville principale', () => {
    // Le plus riche, puis un département plus loin sur la rangée, puis celui du milieu, que la première
    // route traverse (la carte boucle : on reste loin du raccord).
    const order = [[1, 0], [5, 0], [3, 0]];
    const sim = new Simulation(config((col, row) => {
      const rank = order.findIndex(([c, r]) => c === col && r === row);
      // Les autres : plus riches vers le bas de la carte, pour que la rangée du haut ne soit que traversée.
      return rank >= 0 ? 1e6 - rank * 1e5 : 1e4 + row * 1e3 + col;
    }));
    run(sim, CHECK);
    const network = sim.networkOf(A);
    const middle = at(sim, 3, 0);
    expect(network.hubs).toContain(at(sim, 5, 0));
    expect(network.hubs).not.toContain(middle);
    expect(network.principal).toContain(middle);
    expect(bonusOf(sim, middle)).toBe(HUB_BONUS);
    // Un département traversé, qui n'est pas parmi les plus riches, n'a que le bonus de passage.
    const transit = sim.tradeAxes.filter((axis) => axis.auto).flatMap((axis) => axis.provinces).filter((p) => !network.principal.includes(p));
    expect(transit.length).toBeGreaterThan(0);
    for (const p of transit) expect(bonusOf(sim, p)).toBe(AUTO_TRANSIT_BONUS);
    // Le département sauté laisse sa place : il y a toujours autant de villes reliées.
    expect(network.hubs).toHaveLength(sim.hubCapacityOf(A).total);
  });

  it('gagne des villes principales par la recherche sur les échanges', () => {
    const sim = new Simulation(config((col, row) => 1e5 - (row * 10 + col) * 1000));
    const before = sim.hubCapacityOf(A).total;
    sim.queueResearch(A, 3);
    for (let t = 0; t < 600 * 40 && sim.researchOf(A, 3) === 0; t++) sim.step();
    expect(sim.hubCapacityOf(A).total).toBe(before + AUTO_HUBS_PER_RESEARCH);
    run(sim, CHECK);
    expect(sim.networkOf(A).hubs).toHaveLength(before + AUTO_HUBS_PER_RESEARCH);
  });

  it('se redessine quand un département en dépasse un autre', () => {
    const sim = new Simulation(config((col, row) => 1e5 - (row * 10 + col) * 1000));
    run(sim, CHECK);
    sim.drainChanges();
    const outsider = at(sim, 9, 3);
    expect(sim.networkOf(A).principal).not.toContain(outsider);
    // Il devient le plus riche du pays.
    (sim as unknown as { provinceGdp: Float64Array }).provinceGdp[outsider] = 1e7;
    run(sim, CHECK);
    expect(sim.networkOf(A).hubs[0]).toBe(outsider);
    const events = sim.drainChanges().events;
    expect(events.some((event) => event.type === 'networkChanged' && event.added.includes(outsider))).toBe(true);
  });

  it("contourne un département pris par l'ennemi, et perd la ville qu'il a prise", () => {
    const sim = new Simulation(config((col, row) => 1e5 - (row * 10 + col) * 1000, true));
    run(sim, CHECK);
    const hub = sim.networkOf(A).hubs[1];
    const controller = (sim as unknown as { controller: Uint16Array }).controller;
    controller[hub] = B;
    run(sim, CHECK);
    expect(sim.networkOf(A).principal).not.toContain(hub);
    const routes = sim.tradeAxes.filter((axis) => axis.auto && axis.nation === A);
    expect(routes.every((axis) => axis.active)).toBe(true);
    expect(routes.every((axis) => !axis.provinces.includes(hub))).toBe(true);
  });
});
