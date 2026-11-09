import { describe, expect, it } from 'vitest';
import { rebalance } from '../src/game/allocation.ts';
import { areLandNeighbors, findLandNeighbors } from '../src/map/adjacency.ts';
import { effortEffect, provinceWealth } from '../src/game/economy.ts';
import { formatDate, formatDuration, formatShortDate } from '../src/game/time.ts';
import { formatChange, formatPercent, formatRatio } from '../src/ui/format.ts';

const total = (map: Map<number, number>) => [...map.values()].reduce((a, b) => a + b, 0);

describe('répartition des forces', () => {
  it('ne touche pas aux autres fronts s\'il reste de la place', () => {
    const next = rebalance(new Map([[1, 0.2], [2, 0.3]]), 2, 0.5);
    expect(next.get(1)).toBe(0.2);
    expect(next.get(2)).toBe(0.5);
  });

  it('reprend le manque proportionnellement sur les autres fronts', () => {
    const next = rebalance(new Map([[1, 0.6], [2, 0.2], [3, 0.2]]), 3, 0.6);
    expect(next.get(3)).toBe(0.6);
    expect(next.get(1)).toBeCloseTo(0.3, 10);
    expect(next.get(2)).toBeCloseTo(0.1, 10);
    expect(total(next)).toBeCloseTo(1, 10);
  });

  it('peut prendre tout ce qu\'un front engagé à 100 % occupe', () => {
    const next = rebalance(new Map([[1, 1], [2, 0]]), 2, 1);
    expect(next.get(1)).toBe(0);
    expect(next.get(2)).toBe(1);
  });

  it('borne les valeurs demandées', () => {
    expect(rebalance(new Map([[1, 0.5]]), 1, 3).get(1)).toBe(1);
    expect(rebalance(new Map([[1, 0.5]]), 1, -3).get(1)).toBe(0);
  });
});

describe('voisinages', () => {
  // 1 1 0 2
  // 3 3 0 2   la colonne 3 touche la colonne 0 par le bouclage
  const grid = Uint16Array.from([1, 1, 0, 2, 3, 3, 0, 2]);

  it('trouve chaque paire une fois, à travers le bouclage', () => {
    const pairs = findLandNeighbors(grid, 4, 2).map((pair) => pair.join('-')).sort();
    expect(pairs).toEqual(['1-2', '1-3', '2-3']);
  });

  it('teste une paire dans les deux sens', () => {
    expect(areLandNeighbors(grid, 4, 2, 1, 2)).toBe(true);
    expect(areLandNeighbors(grid, 4, 2, 2, 1)).toBe(true);
    expect(areLandNeighbors(Uint16Array.from([1, 0, 2, 0]), 4, 1, 1, 2)).toBe(false);
  });
});

describe('affichage', () => {
  it('écrit le rapport de force du côté du joueur et plafonne les extrêmes', () => {
    expect(formatRatio(1)).toBe('1 : 1');
    expect(formatRatio(2.5)).toBe('2,5 : 1');
    expect(formatRatio(0.5)).toBe('1 : 2');
    expect(formatRatio(1986)).toBe('> 20 : 1');
    expect(formatRatio(1 / 1986)).toBe('1 : > 20');
  });

  it('formate le temps écoulé', () => {
    // Une minute de simulation (600 ticks) vaut une semaine, à partir du 1er janvier 2026.
    expect(formatDate(0)).toBe('1 janvier 2026');
    expect(formatDate(600 * 10)).toBe('12 mars 2026');
    expect(formatShortDate(600 * 52)).toBe('31 déc. 26');
    expect(formatDuration(600 * 3)).toBe('3 semaines');
    expect(formatDuration(600 * 30)).toBe('7 mois');
    expect(formatDuration(600 * 130)).toBe('2 ans et 6 mois');
  });
});

describe("affichage de l'économie", () => {
  it('écrit les variations sans « −0 % »', () => {
    expect(formatChange(-0.001, 0)).toBe('0 %');
    expect(formatChange(0.0123)).toBe('+1,2 %');
    expect(formatChange(-0.0151, 0)).toBe('-2 %');
    expect(formatPercent(0.535)).toBe('54 %');
  });

  it('teinte les provinces selon leur densité de PIB, pas leur taille', () => {
    // Même PIB : la petite province est la plus dense.
    const wealth = provinceWealth([100, 1_000_000, 50], [0, 10_000, 10_000, 0]);
    expect(wealth[1]).toBeGreaterThan(wealth[2]);
    expect(wealth[3]).toBe(0);
    // Le développement compte : une province détruite pâlit.
    const damaged = provinceWealth([100], [0, 1000], [0, 0.5]);
    expect(damaged[1]).toBeLessThan(provinceWealth([100], [0, 1000])[1]);
  });

  it("explique l'effet de l'effort de guerre", () => {
    expect(effortEffect(0.2, false)).toMatch(/grandit/);
    expect(effortEffect(0.5, true)).toMatch(/Équilibre/);
    expect(effortEffect(0.9, true)).toMatch(/s'use/);
  });
});
