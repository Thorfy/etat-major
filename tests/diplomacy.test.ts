import { describe, expect, it } from 'vitest';
import { DEMAND_INDEPENDENCE_AT, DEMAND_INVESTMENT_AT, MIN_WAR_TICKS_FOR_PEACE, TRUCE_TICKS } from '../src/sim/balance.ts';
import { Simulation, type SimConfig } from '../src/sim/Simulation.ts';

const W = 200;
const H = 80;

/**
 * Une carte en blocs : chaque nation possède les cellules que \`owner\` lui donne, en provinces
 * de 20 × 20 cellules.
 */
function config(owner: (x: number, y: number) => number, gdp: (nation: number) => number, nations: number, player = 1): SimConfig {
  const ownerGrid = new Uint16Array(W * H);
  const provinceGrid = new Uint16Array(W * H);
  const ids = new Map<string, number>();
  const provinces: SimConfig['provinces'] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = owner(x, y);
      ownerGrid[y * W + x] = n;
      if (n === 0) continue;
      const key = `${n}:${Math.floor(x / 20)}:${Math.floor(y / 20)}`;
      let id = ids.get(key);
      if (!id) {
        provinces.push({ nation: n - 1, areaKm2: 10000, x: Math.floor(x / 20) * 20 + 10, y: Math.floor(y / 20) * 20 + 10, population: 1e6, gdpMusd: 1e4 });
        id = provinces.length;
        ids.set(key, id);
      }
      provinceGrid[y * W + x] = id;
    }
  }
  return {
    width: W,
    height: H,
    nations: Array.from({ length: nations }, (_, i) => ({ population: 20e6, gdpMusd: gdp(i + 1) })),
    provinces,
    provinceGrid,
    ownerGrid,
    seed: 3,
    player,
    ai: false,
  };
}

const A = 1;
const B = 2;
const C = 3;
const D = 4;
const E = 5;

/** A à gauche, B à droite : un duel. */
const duel = (gdpB = 1e6) => new Simulation(config((x) => (x < 100 ? A : B), (n) => (n === A ? 2e6 : gdpB), 2));

const fight = (sim: Simulation, ticks: number, a: 'attack' | 'hold', b: 'attack' | 'hold', enemy = B) => {
  for (let t = 0; t < ticks; t++) {
    sim.setFront(A, enemy, 1, a);
    sim.setFront(enemy, A, 1, b);
    sim.step();
  }
};

/**
 * A s'effondre de l'intérieur : sa stabilité reste à 0,1, et il répond `answer` à chaque demande
 * de ses régions annexées, jusqu'à `until`.
 */
const collapse = (sim: Simulation, ticks: number, until: () => boolean, answer: (kind: string) => boolean = () => false) => {
  const internals = sim as unknown as { stability: Float64Array };
  for (let t = 0; t < ticks && !until(); t++) {
    internals.stability[A] = 0.1;
    for (const movement of sim.movementsOf(A)) {
      if (movement.demand !== '') sim.answerDemand(A, movement.origin, answer(movement.demand));
    }
    sim.step();
  }
};

describe('paix et trêves', () => {
  it('donne chaque province disputée à qui la tient, puis interdit la guerre un an', () => {
    const sim = duel(5e5);
    sim.declareWars([[A, B]]);
    fight(sim, 600 * 5, 'attack', 'hold');
    // A tient des provinces de B.
    const taken = sim.provinceGrid.filter((province, cell) => province && sim.owners[cell] === A && sim.controllerOf(province) === A && cell % W >= 100);
    expect(taken.length).toBeGreaterThan(0);
    // B, qui perd, accepte.
    expect(sim.proposePeace(A, B)).toBe(true);
    expect(sim.fronts).toHaveLength(0);
    // Plus une seule cellule de B dans une province que A contrôle, et inversement.
    for (let cell = 0; cell < sim.owners.length; cell++) {
      const province = sim.provinceGrid[cell];
      if (!province) continue;
      expect(sim.owners[cell]).toBe(sim.controllerOf(province));
    }
    expect(sim.hasTruce(A, B)).toBe(true);
    sim.declareWars([[A, B]]);
    expect(sim.fronts).toHaveLength(0);
    for (let t = 0; t < TRUCE_TICKS + 10; t++) sim.step();
    expect(sim.hasTruce(A, B)).toBe(false);
  });

  it('est refusée trop tôt, et par une IA qui gagne', () => {
    const sim = duel(4e6);
    sim.declareWars([[A, B]]);
    expect(sim.proposePeace(A, B)).toBe(false);
    // A dégarnit son front : B lui prend des provinces.
    for (let t = 0; t < MIN_WAR_TICKS_FOR_PEACE + 600 * 2; t++) {
      sim.setFront(A, B, 0.2, 'hold');
      sim.setFront(B, A, 1, 'attack');
      sim.step();
    }
    const taken = sim.provinceGrid.filter((province, cell) => province && sim.owners[cell] === B && sim.controllerOf(province) === B && cell % W < 100);
    expect(taken.length).toBeGreaterThan(0);
    expect(sim.proposePeace(A, B)).toBe(false);
    expect(sim.fronts).toHaveLength(1);
  });

  it('se conclut dans une impasse où les deux camps sont à bout', () => {
    const sim = duel(4e6);
    sim.declareWars([[A, B]]);
    fight(sim, 600 * 12, 'hold', 'attack');
    expect(sim.proposePeace(A, B)).toBe(true);
  });

  it('est proposée au joueur par une IA à bout, qui attend sa réponse', () => {
    const sim = duel(5e5);
    sim.declareWars([[A, B]]);
    let offered = false;
    for (let t = 0; t < 600 * 40 && !offered && sim.isAlive(B); t++) {
      fight(sim, 1, 'attack', 'hold');
      offered = sim.peaceOffersTo(A).some((offer) => offer.from === B);
    }
    expect(offered).toBe(true);
    sim.answerPeace(A, B, true);
    expect(sim.fronts).toHaveLength(0);
  });
});

describe('pactes de non-agression', () => {
  // A en haut, sur toute la largeur ; B en bas à gauche ; C en bas à droite.
  const map = (gdpB = 1e6) =>
    new Simulation(config((x, y) => (y < 40 ? A : x < 100 ? B : C), (n) => (n === A ? 4e6 : n === B ? gdpB : 1e6), 3));

  it('interdisent la guerre entre signataires, sans entraîner personne dans les autres', () => {
    const sim = map();
    expect(sim.proposeAlliance(B, C)).toBe(true);
    expect(sim.isAllied(B, C)).toBe(true);
    sim.declareWars([[B, C]]);
    expect(sim.fronts).toHaveLength(0);
    // Attaqué, B se bat seul : C ne vient pas le défendre.
    sim.declareWars([[A, B]]);
    expect(sim.fronts.map((front) => [front.a, front.b])).toEqual([[A, B]]);
    expect(sim.aggressionOf(A)).toBeCloseTo(0.12, 6);
  });

  it('sont refusés à un pays trop agressif, ou trop faible pour être respecté', () => {
    const sim = map();
    (sim as unknown as { aggression: Float64Array }).aggression[B] = 0.5;
    expect(sim.proposeAlliance(B, C)).toBe(false);
    // Un pays bien plus faible est une proie : sans menace commune, pas de pacte.
    const weak = map(2e5);
    expect(weak.proposeAlliance(B, C)).toBe(false);
  });

  it("se rompent, au prix d'un peu d'agressivité", () => {
    const sim = map();
    sim.proposeAlliance(B, C);
    sim.breakAlliance(B, C);
    expect(sim.isAllied(B, C)).toBe(false);
    expect(sim.aggressionOf(B)).toBeGreaterThan(0);
  });
});

describe('coalitions', () => {
  it("ne se forment jamais entre voisins contre un conquérant", () => {
    // A au centre, entouré de quatre voisins plus petits ; il en dévore deux.
    const sim = new Simulation(
      config(
        (x, y) => (x >= 60 && x < 140 && y >= 20 && y < 60 ? A : x < 60 ? B : x >= 140 ? C : y < 20 ? D : E),
        (n) => (n === A ? 3e6 : 6e5),
        5,
      ),
    );
    for (const victim of [B, C]) {
      sim.declareWars([[A, victim]]);
      for (let t = 0; t < 600 * 60 && sim.isAlive(victim); t++) fight(sim, 1, 'attack', 'hold', victim);
    }
    expect(sim.isAlive(B) || sim.isAlive(C)).toBe(false);
    for (let t = 0; t < 600 * 10; t++) sim.step();
    expect(sim.coalitionAgainstOf(D)).toBe(0);
    expect(sim.coalitionAgainstOf(E)).toBe(0);
    expect(sim.isAllied(D, E)).toBe(false);
  });

  it("réunissent les régions rebelles qui se touchent, et elles seules", () => {
    // A à gauche et sur une bande x ∈ [170, 180) ; B, C côte à côte ; D isolé derrière la bande.
    const sim = new Simulation(
      config(
        (x) => (x < 100 || (x >= 170 && x < 180) ? A : x < 140 ? B : x < 170 ? C : D),
        (n) => (n === A ? 4e6 : 3e5),
        4,
      ),
    );
    for (const victim of [B, C, D]) {
      sim.declareWars([[A, victim]]);
      for (let t = 0; t < 600 * 60 && sim.isAlive(victim); t++) fight(sim, 1, 'attack', 'hold', victim);
      expect(sim.isAlive(victim)).toBe(false);
    }
    // A s'effondre de l'intérieur et refuse toutes les demandes : B se soulève, et C, qui le touche, avec lui.
    collapse(sim, 600 * 30, () => sim.isAlive(B));
    expect(sim.isAlive(B)).toBe(true);
    expect(sim.isAlive(C)).toBe(true);
    expect(sim.coalitionAgainstOf(B)).toBe(A);
    expect(sim.coalitionAgainstOf(C)).toBe(A);
    expect(sim.isAllied(B, C)).toBe(true);
    // D, séparé d'eux par une terre de A, ne se joint pas à leur coalition.
    expect(sim.coalitionAgainstOf(D)).toBe(0);
    sim.declareWars([[B, C]]);
    expect(sim.fronts.some((front) => (front.a === B && front.b === C) || (front.a === C && front.b === B))).toBe(false);
  });
});

describe('régions annexées', () => {
  /** A annexe B, puis s'effondre. */
  const annexed = () => {
    const sim = duel(4e5);
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 600 * 60 && sim.isAlive(B); t++) fight(sim, 1, 'attack', 'hold');
    expect(sim.isAlive(B)).toBe(false);
    return sim;
  };

  it("s'agitent peu à peu, demandent des investissements puis l'indépendance, et ne se soulèvent qu'après deux refus", () => {
    const sim = annexed();
    const start = sim.tick;
    const demands: { kind: string; tick: number; unrest: number }[] = [];
    collapse(sim, 600 * 40, () => sim.isAlive(B), (kind) => {
      const movement = sim.movementsOf(A)[0];
      demands.push({ kind, tick: sim.tick, unrest: movement.unrest });
      return false;
    });
    expect(demands.map((demand) => demand.kind)).toEqual(['investment', 'independence']);
    // Progressif : la première demande vient après des semaines d'agitation, pas d'un coup.
    expect(demands[0].tick - start).toBeGreaterThan(600 * 4);
    expect(demands[0].unrest).toBeGreaterThanOrEqual(DEMAND_INVESTMENT_AT);
    expect(demands[0].unrest).toBeLessThan(DEMAND_INDEPENDENCE_AT);
    // Après les deux refus, B se soulève : il reprend ses terres d'origine, et se bat contre A.
    expect(sim.isAlive(B)).toBe(true);
    expect(sim.tick).toBeGreaterThan(demands[1].tick);
    expect(sim.owners[40 * W + 190]).toBe(B);
    expect(sim.fronts.some((front) => front.a === A && front.b === B)).toBe(true);
  });

  it("obtiennent l'indépendance sans combat, si on la leur accorde", () => {
    const sim = annexed();
    collapse(sim, 600 * 40, () => sim.isAlive(B), (kind) => kind === 'independence');
    expect(sim.isAlive(B)).toBe(true);
    expect(sim.owners[40 * W + 190]).toBe(B);
    expect(sim.fronts.some((front) => front.a === B || front.b === B)).toBe(false);
    expect(sim.hasTruce(A, B)).toBe(true);
  });

  it('se calment avec des investissements, qui passent en tête des chantiers', () => {
    const sim = annexed();
    let accepted = 0;
    collapse(sim, 600 * 20, () => accepted > 0, (kind) => {
      accepted = sim.movementsOf(A)[0].unrest;
      return kind === 'investment';
    });
    expect(accepted).toBeGreaterThanOrEqual(DEMAND_INVESTMENT_AT);
    sim.step();
    expect(sim.buildQueueOf(A)[0]?.kind).toBe('investment');
    expect(sim.movementsOf(A)[0].investing).toBe(true);
    // Même dans un pays à bout, la région attend la fin du chantier sans s'agiter davantage.
    collapse(sim, 600 * 30, () => !sim.movementsOf(A)[0].investing);
    expect(sim.buildQueueOf(A)).toHaveLength(0);
    expect(sim.movementsOf(A)[0].unrest).toBeLessThan(accepted - 0.3);
    expect(sim.isAlive(B)).toBe(false);
  });

  it("valent un refus si l'on abandonne leurs investissements", () => {
    const sim = annexed();
    collapse(sim, 600 * 20, () => sim.movementsOf(A)[0]?.investing === true, (kind) => kind === 'investment');
    const before = sim.movementsOf(A)[0].unrest;
    sim.cancelBuild(A, 0);
    expect(sim.movementsOf(A)[0].investing).toBe(false);
    expect(sim.movementsOf(A)[0].unrest).toBeCloseTo(before + 0.15, 6);
  });

  it("négligées dans un pays stable, demandent des investissements sans jamais se soulever", () => {
    const sim = annexed();
    const demands: string[] = [];
    for (let t = 0; t < 600 * 40; t++) {
      for (const movement of sim.movementsOf(A)) {
        if (movement.demand !== '') {
          demands.push(movement.demand);
          sim.answerDemand(A, movement.origin, false);
        }
      }
      sim.step();
    }
    expect(demands).toEqual(['investment']);
    expect(sim.movementsOf(A)[0].unrest).toBeLessThan(DEMAND_INDEPENDENCE_AT);
    expect(sim.isAlive(B)).toBe(false);
  });

  it('équipées, restent calmes même dans un pays à bout', () => {
    const sim = annexed();
    // Deux niveaux de services publics dans chaque province de l'ancien B (à l'est).
    const provinces = new Set<number>();
    for (let cell = 0; cell < sim.provinceGrid.length; cell++) if (cell % W >= 100 && sim.provinceGrid[cell]) provinces.add(sim.provinceGrid[cell]);
    for (const province of provinces) sim.buildings.services[province] = 2;
    collapse(sim, 600 * 40, () => sim.isAlive(B));
    expect(sim.movementsOf(A)[0].care).toBe(1);
    expect(sim.movementsOf(A)[0].unrest).toBeLessThan(0.05);
    expect(sim.isAlive(B)).toBe(false);
  });
});

describe('sauvegarde', () => {
  it('garde alliances, trêves et agressivité', () => {
    const sim = new Simulation(config((x, y) => (y < 40 ? A : x < 100 ? B : C), (n) => (n === A ? 4e6 : 1e6), 3));
    (sim as unknown as { aggression: Float64Array }).aggression[A] = 0.4;
    sim.proposeAlliance(B, C);
    sim.declareWars([[A, B]]);
    for (let t = 0; t < 1200; t++) sim.step();
    const save = sim.save();
    const resumed = new Simulation({
      ...config((x, y) => (y < 40 ? A : x < 100 ? B : C), (n) => (n === A ? 4e6 : 1e6), 3),
      saved: { owners: save.owners, supply: save.supply, forts: save.forts, state: JSON.parse(JSON.stringify(save.state)) },
    });
    expect(resumed.stateHash()).toBe(sim.stateHash());
    expect(resumed.isAllied(B, C)).toBe(true);
    expect(resumed.aggressionOf(A)).toBeCloseTo(sim.aggressionOf(A), 10);
  });
});

describe('appel aux armes', () => {
  it("n'existe pas, même entre partenaires d'une coalition", () => {
    // A en haut ; B, C, D en bas. B et C forment une coalition contre A.
    const sim = new Simulation(
      config((x, y) => (y < 40 ? A : x < 70 ? B : x < 140 ? C : D), (n) => (n === A ? 4e6 : 1e6), 4),
    );
    const internals = sim as unknown as { allied: Uint8Array; coalitionAgainst: Uint16Array; stride: number };
    internals.allied[B * internals.stride + C] = 2;
    internals.allied[C * internals.stride + B] = 2;
    internals.coalitionAgainst[B] = A;
    internals.coalitionAgainst[C] = A;
    sim.declareWars([[A, B]]);
    expect(sim.fronts.map((front) => [front.a, front.b])).toEqual([[A, B]]);
    sim.declareWars([[D, C]]);
    expect(sim.fronts.map((front) => [front.a, front.b])).toEqual([[A, B], [C, D]]);
  });
});
