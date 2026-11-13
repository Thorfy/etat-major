// Calculs d'affichage de l'économie, sans effet sur la partie.
import { FACTORY_BONUS } from '../sim/balance.ts';

/** Densités de PIB (M$ par km²) qui bornent la teinte de la carte économique. */
const LOG_DENSITY_MIN = -1.5;
const LOG_DENSITY_MAX = 2;

/**
 * Richesse de chaque province pour la carte économique, de 0 à 255 : la densité de PIB
 * en échelle logarithmique. Elle fait ressortir les bassins industriels plutôt que les
 * grandes provinces vides. `gdp` et `development` sont indexés par identifiant.
 */
export function provinceWealth(
  areas: readonly number[],
  gdp: ArrayLike<number>,
  development?: ArrayLike<number>,
  factories?: ArrayLike<number>,
): Uint8Array {
  const wealth = new Uint8Array(areas.length + 1);
  for (let id = 1; id <= areas.length; id++) {
    // Les usines comptent : chacune ajoute FACTORY_BONUS au PIB tiré de la province.
    const value = gdp[id] * (development ? development[id] : 1) * (1 + FACTORY_BONUS * (factories ? factories[id] : 0));
    if (!(value > 0)) continue;
    const density = Math.log10(value / Math.max(1, areas[id - 1]));
    const scaled = (density - LOG_DENSITY_MIN) / (LOG_DENSITY_MAX - LOG_DENSITY_MIN);
    wealth[id] = Math.round(Math.max(0, Math.min(1, scaled)) * 255);
  }
  return wealth;
}

/**
 * Évolution de chaque province depuis le début de la partie, de 0 à 255 (128 : inchangée) :
 * son développement, qui monte en paix et retombe sous les combats et l'usure de la guerre.
 */
export function provinceTrend(development: ArrayLike<number>): Uint8Array {
  const trend = new Uint8Array(development.length);
  for (let id = 1; id < development.length; id++) {
    trend[id] = Math.round(Math.max(0, Math.min(255, 128 + (development[id] - 1) * 200)));
  }
  return trend;
}

/** Ce que l'effort de guerre fait à l'économie, en une phrase. */
export function effortEffect(effort: number, atWar: boolean): string {
  if (effort < 0.45) return atWar ? 'L\'industrie grandit, moins vite en guerre. L\'armée plafonne plus bas.' : 'L\'industrie grandit. L\'armée plafonne plus bas.';
  if (effort <= 0.55) return 'Équilibre : l\'industrie ne grandit ni ne s\'use.';
  return 'L\'armée peut grossir, mais l\'industrie s\'use.';
}
