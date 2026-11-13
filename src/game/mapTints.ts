// Teintes des cartes des relations et de l'intérieur, nation par nation.
import type { EconomySnapshot } from '../sim/protocol.ts';

export type Relation = 'self' | 'war' | 'ally' | 'coalition' | 'truce' | 'embargo' | 'neutral';

/** Couleur de chaque relation, en octets RGB : les légendes reprennent les mêmes. */
export const RELATION_COLORS: Record<Relation, [number, number, number]> = {
  self: [245, 200, 73],
  war: [204, 41, 26],
  ally: [59, 107, 173],
  coalition: [92, 140, 191],
  truce: [140, 158, 184],
  embargo: [140, 82, 140],
  neutral: [214, 209, 194],
};
/** Un voisin neutre très agressif tire vers l'orange : une menace. */
const AGGRESSIVE: [number, number, number] = [222, 150, 92];

/** Stabilité : calme, tendue, à bout. */
export const STABILITY_COLORS = { calm: [204, 209, 189], tense: [217, 168, 97], broken: [140, 38, 31] } as const;

const mixRgb = (a: readonly number[], b: readonly number[], t: number) => a.map((value, i) => Math.round(value + (b[i] - value) * t));

/**
 * Relations de `subject` avec chaque nation, en RGBA : la couleur de la relation, et une alpha
 * réduite pour un partenaire commercial (la carte le raye de vert).
 */
export function relationTint(subject: number, count: number, economy: EconomySnapshot | null, wars: readonly [number, number][]): Uint8Array {
  const relation: Relation[] = Array(count + 1).fill('neutral');
  const trade = new Uint8Array(count + 1);
  const pairs = (flat: ArrayLike<number>, step: number, visit: (a: number, b: number, k: number) => void) => {
    for (let i = 0; i + step - 1 < flat.length; i += step) visit(flat[i], flat[i + 1], step > 2 ? flat[i + 2] : 0);
  };
  const other = (a: number, b: number) => (a === subject ? b : b === subject ? a : 0);
  if (economy) {
    pairs(economy.embargoes, 2, (a, b) => {
      const n = other(a, b);
      if (n) relation[n] = 'embargo';
    });
    pairs(economy.truces, 2, (a, b) => {
      const n = other(a, b);
      if (n) relation[n] = 'truce';
    });
    pairs(economy.alliances, 3, (a, b, kind) => {
      const n = other(a, b);
      if (n) relation[n] = kind === 2 ? 'coalition' : 'ally';
    });
    pairs(economy.tradeDeals, 2, (a, b) => {
      const n = other(a, b);
      if (n) trade[n] = 1;
    });
  }
  for (const [a, b] of wars) {
    const n = other(a, b);
    if (n) relation[n] = 'war';
  }
  if (subject > 0 && subject <= count) relation[subject] = 'self';
  const tint = new Uint8Array((count + 1) * 4);
  for (let n = 1; n <= count; n++) {
    let rgb: number[] = RELATION_COLORS[relation[n]];
    if (relation[n] === 'neutral' && economy) rgb = mixRgb(rgb, AGGRESSIVE, Math.min(1, (economy.aggression[n] ?? 0) / 0.6));
    tint.set([rgb[0], rgb[1], rgb[2], trade[n] ? 128 : 255], n * 4);
  }
  return tint;
}

/** Stabilité de chaque nation, en RGBA : du calme pâle au rouge sombre d'un pays à bout. */
export function stabilityTint(count: number, economy: EconomySnapshot | null): Uint8Array {
  const tint = new Uint8Array((count + 1) * 4);
  for (let n = 1; n <= count; n++) {
    const stability = economy ? (economy.stability[n] ?? 0.8) : 0.8;
    const { calm, tense, broken } = STABILITY_COLORS;
    const rgb = stability >= 0.45 ? mixRgb(tense, calm, Math.min(1, (stability - 0.45) / 0.35)) : mixRgb(broken, tense, stability / 0.45);
    tint.set([rgb[0], rgb[1], rgb[2], 255], n * 4);
  }
  return tint;
}
