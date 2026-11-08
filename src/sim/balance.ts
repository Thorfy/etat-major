// Réglages de la simulation. Valeurs provisoires : la puissance militaire viendra
// de l'économie au jalon 4, et le terrain modifiera la pression au jalon 2.

export const TICKS_PER_SECOND = 10;

/** Probabilité maximale par tick qu'une cellule de front bascule. */
export const MAX_FLIP_CHANCE = 0.02;
/** Sensibilité de cette probabilité à l'avantage local (en log du rapport de force). */
export const FLIP_STEEPNESS = 1.1;
/** Multiplicateur selon le nombre de voisines ennemies : lisse les pointes du front. */
export const NEIGHBOR_WEIGHT = [0, 0.6, 1.2, 2.2, 3.5];

/** Amplitude de la variation locale du front, en log du rapport de force. */
export const SECTOR_NOISE = 0.5;
export const SECTOR_SHIFT = 5;
/** Part des secteurs qui évoluent à chaque tick. */
export const SECTOR_CHURN = 0.004;

export const MIN_FRONT_LENGTH = 20;
/** Part de l'armée totale qui peut changer de position par tick. */
export const TRANSFER_RATE = 0.004;
export const ATTRITION_PER_TICK = 0.0004;
/** Part du manque à combler par tick pour revenir à la capacité militaire. */
export const REINFORCE_PER_TICK = 0.0006;
/** Une province occupée rapporte moins de capacité qu'une province nationale. */
export const OCCUPIED_VALUE = 0.3;
export const INITIAL_MOBILIZATION = 0.8;

export const DEFENSE_MULTIPLIER = { attack: 1, hold: 1.3, retreat: 0.6 } as const;
export const LOSS_MULTIPLIER = { attack: 1, hold: 0.6, retreat: 0.25 } as const;
/** Bonus de l'adversaire d'une nation qui cède volontairement du terrain. */
export const RETREAT_ADVANTAGE = 1;

export const AI_INTERVAL_TICKS = 30;
export const AI_ENGAGED_SHARE = 0.85;
export const AI_ATTACK_RATIO = 1.1;

export const DEFAULT_ALLOCATION = 0.6;

/** Capacité militaire de départ. Formule provisoire en attendant l'économie. */
export function baseCapacity(population: number, gdpMusd: number): number {
  const gdpBillions = Math.max(1, gdpMusd / 1000);
  const populationMillions = Math.max(0.05, population / 1e6);
  return 10 * Math.sqrt(gdpBillions) * populationMillions ** 0.25;
}
