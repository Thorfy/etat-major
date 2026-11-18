// Le score à l'écran : les quatre piliers, leurs explications, et leur valeur en points.
import { SCORE_POINTS_PER_DOUBLING } from '../sim/balance.ts';

export const PILLARS = [
  { name: 'Richesse', hint: 'Ta part du PIB mondial.' },
  { name: 'Puissance', hint: "Moitié ta part des terres du monde (à leur valeur d'origine, une province occupée pour moitié), moitié ta part de la capacité militaire mondiale." },
  { name: 'Influence', hint: "Ta sphère, comparée à celle des autres : un quart du PIB de chaque partenaire commercial, un dixième de chaque pacte, jamais plus que le tien." },
  { name: 'Solidité', hint: "Ta stabilité, fois la part de ton territoire d'origine que tu tiens encore." },
] as const;

/** Points qu'un pilier rapporte : doubler vaut +25, perdre la moitié −25. */
export function pillarPoints(ratio: number): number {
  return SCORE_POINTS_PER_DOUBLING * Math.log2(Math.max(1e-6, ratio));
}

/** « ×1,32 (+10) » : le pilier rapporté à son départ, et ce qu'il vaut en points. */
export function formatMultiple(ratio: number): string {
  const points = Math.round(pillarPoints(ratio));
  const multiple = ratio.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `×${multiple} (${points > 0 ? '+' : points < 0 ? '−' : ''}${Math.abs(points)})`;
}

/** « 1er », « 12e ». */
export function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`;
}
