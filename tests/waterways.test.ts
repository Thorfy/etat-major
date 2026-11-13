import { describe, expect, it } from 'vitest';
import { findSeas } from '../src/sim/seas.ts';
import { Waterways } from '../src/sim/waterways.ts';

const W = 200;
const H = 80;

/**
 * Une carte : `land(x, y)` donne la province d'une cellule de terre (0 pour l'eau), `river(x, y)` un
 * fleuve sur la terre. Chaque province a pour ville le centre de ses cellules.
 */
function waterways(land: (x: number, y: number) => number, river: (x: number, y: number) => boolean = () => false) {
  const provinceGrid = new Uint16Array(W * H);
  const rivers = new Uint8Array(W * H);
  const sums = new Map<number, [number, number, number]>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = land(x, y);
      provinceGrid[y * W + x] = p;
      if (p === 0) continue;
      if (river(x, y)) rivers[y * W + x] = 1;
      const sum = sums.get(p) ?? [0, 0, 0];
      sums.set(p, [sum[0] + x + 0.5, sum[1] + y + 0.5, sum[2] + 1]);
    }
  }
  const owners = provinceGrid.map((p) => (p === 0 ? 0 : 1));
  const centers: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  for (let p = 1; p <= Math.max(...sums.keys()); p++) {
    const [sx, sy, n] = sums.get(p) ?? [0, 0, 1];
    centers.push({ x: sx / n, y: sy / n });
  }
  const { sea } = findSeas(owners, W, H);
  const ways = new Waterways({ width: W, height: H, owners, seas: sea, rivers, provinceGrid, centers });
  /** Le tracé reste-t-il sur l'eau, fleuves compris ? */
  const onWater = (points: number[]) => {
    for (let i = 0; i + 2 < points.length; i += 2) {
      const dx = points[i + 2] - points[i];
      const dy = points[i + 3] - points[i + 1];
      const steps = Math.ceil(Math.hypot(dx, dy) * 2);
      for (let s = 0; s <= steps; s++) {
        const x = Math.floor(points[i] + (dx * s) / steps);
        const y = Math.floor(points[i + 1] + (dy * s) / steps);
        const cell = y * W + ((x + W) % W);
        if (provinceGrid[cell] !== 0 && rivers[cell] === 0) return false;
      }
    }
    return true;
  };
  return { ways, onWater };
}

describe('voies d’eau', () => {
  it('partent de la côte et contournent une péninsule sans couper les terres', () => {
    // Deux ports, 1 et 2, de part et d'autre d'une péninsule (3) qui descend du haut de la carte.
    const { ways, onWater } = waterways((x, y) => (y < 30 && x >= 20 && x < 40 ? 1 : y < 30 && x >= 100 && x < 120 ? 2 : y < 55 && x >= 60 && x < 70 ? 3 : 0));
    expect(ways.isPort(1)).toBe(true);
    const path = ways.path(1, 2, 400)!;
    expect(path).not.toBeNull();
    expect(onWater(path)).toBe(true);
    // Elle passe sous la pointe de la péninsule.
    const lowest = Math.max(...path.filter((_, i) => i % 2 === 1));
    expect(lowest).toBeGreaterThan(55);
    // La longueur par l'eau dépasse la distance à vol d'oiseau.
    expect(ways.reach(1, 400).get(2)).toBeGreaterThan(80);
  });

  it("ne passent pas un isthme, même étroit", () => {
    // Deux mers séparées par deux murs de terre de deux cellules (la carte boucle d'est en ouest).
    const { ways } = waterways((x, y) => (x === 100 || x === 101 || x === 0 || x === 1 ? 3 : y >= 30 && y < 50 && x >= 70 && x < 90 ? 1 : y >= 30 && y < 50 && x >= 110 && x < 130 ? 2 : 0));
    expect(ways.isPort(1) && ways.isPort(2)).toBe(true);
    expect(ways.reach(1, 1000).has(2)).toBe(false);
    expect(ways.path(1, 2, 1000)).toBeNull();
  });

  it("remontent un fleuve jusqu'à une région de l'intérieur", () => {
    // Un grand continent bordé d'une bande côtière (4) ; à l'intérieur, les provinces 1 à 3 d'ouest en
    // est. Un fleuve part de la côte ouest et traverse 4, 1 et 2 ; 3 ne touche ni l'eau, ni le fleuve.
    const { ways, onWater } = waterways(
      (x, y) => {
        if (y < 10 || y >= 70 || x < 20 || x >= 180) return 0;
        if (y < 13 || y >= 67 || x < 23 || x >= 177) return 4;
        return x < 60 ? 1 : x < 120 ? 2 : 3;
      },
      (x, y) => y === 40 && x < 100,
    );
    expect(ways.isPort(2)).toBe(true);
    expect(ways.isPort(3)).toBe(false);
    // Un port de la côte du nord rejoint la région 2 par la mer, puis par le fleuve.
    const path = ways.path(4, 2, 1000)!;
    expect(path).not.toBeNull();
    expect(onWater(path)).toBe(true);
    const [x, y] = path.slice(-2);
    expect(y).toBeCloseTo(40.5, 0);
    expect(x).toBeGreaterThan(60);
  });

  it('ne font pas passer d’une mer à l’autre par deux fleuves qui se touchent à leur source', () => {
    // Un continent qui fait tout le tour du monde sépare la mer du nord de celle du sud ; un fleuve le
    // traverse du nord au sud.
    const { ways } = waterways(
      (x, y) => (y < 20 || y >= 60 ? 0 : x < 100 ? (y < 40 ? 1 : 2) : y < 40 ? 3 : 4),
      (x) => x === 50,
    );
    // Les deux bouts du fleuve sont des ports, chacun sur sa mer.
    expect(ways.isPort(1) && ways.isPort(2)).toBe(true);
    expect(ways.reach(3, 1000).has(1)).toBe(true);
    expect(ways.reach(3, 1000).has(2)).toBe(false);
    expect(ways.reach(4, 1000).has(1)).toBe(false);
  });
});
