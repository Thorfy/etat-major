// Réglages de la simulation. La puissance militaire est provisoire : elle viendra de
// l'économie au jalon 4.

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
export const ATTRITION_PER_TICK = 0.0007;
/** Part du manque à combler par tick pour revenir à la capacité militaire. */
export const REINFORCE_PER_TICK = 0.0006;
/** Une province occupée rapporte moins de capacité qu'une province nationale. */
export const OCCUPIED_VALUE = 0.12;
/** Part de la valeur d'une province perdue que son pays d'origine conserve. */
export const LOST_PROVINCE_RETAINED = 0.35;
/** Malus de l'attaquant sur le sol national du défenseur (en log du rapport de force). */
export const HOME_DEFENSE = 0.2;
export const INITIAL_MOBILIZATION = 0.8;

export const DEFENSE_MULTIPLIER = { attack: 1, hold: 1.3, retreat: 0.6 } as const;
export const LOSS_MULTIPLIER = { attack: 1, hold: 0.6, retreat: 0.25 } as const;
/** Bonus de l'adversaire d'une nation qui cède volontairement du terrain. */
export const RETREAT_ADVANTAGE = 1;

// Terrain, par identifiant de terrain.ts : plaine, montagne, plateau, désert, arctique, jungle.
/** Malus de l'attaquant, en log du rapport de force. */
export const TERRAIN_DEFENSE = [0, 0.9, 0.35, 0.15, 0.2, 0.55];
/** Multiplicateur de la vitesse d'avancée. */
export const TERRAIN_SPEED = [1, 0.45, 0.75, 0.85, 0.7, 0.55];

// Offensives.
export const OFFENSIVE_HALF_WIDTH = 12;
/** La pression retombe du centre du couloir vers ses bords (en log du rapport de force). */
export const OFFENSIVE_EDGE_FALLOFF = 0.5;
export const OFFENSIVE_SPEED = 1.7;
/** Portée maximale d'une flèche, en cellules. */
export const MAX_OFFENSIVE_LENGTH = 100;
/** La pression s'essouffle avec la distance au départ : −1 de log tous les N cellules. */
export const OFFENSIVE_DEPTH_FADE = 110;
/** Coût de chaque cellule conquise : une base fixe, plus une part de la densité adverse. */
export const OFFENSIVE_CELL_BASE_COST = 0.5;
export const OFFENSIVE_CELL_COST = 0.02;
/** Part de ce coût infligée aussi aux forces adverses du front. */
export const OFFENSIVE_DEFENDER_LOSS = 0.35;
export const OFFENSIVE_ATTRITION = 0.0004;
export const OFFENSIVE_MIN_FORCE = 5;
/** Une offensive sans aucune cellule conquise pendant ce nombre de ticks prend fin. */
export const OFFENSIVE_STALL_TICKS = 300;
export const MAX_OFFENSIVES_PER_NATION = 3;
export const DEFAULT_OFFENSIVE_SHARE = 0.7;

// Ravitaillement et encerclements.
export const SUPPLY_INTERVAL_TICKS = 20;
/** Avantage minimal de l'ennemi sur une poche, même s'il ne fait que tenir. */
export const POCKET_EDGE = 1.6;
export const POCKET_SPEED = 1.6;
/** Part des forces perdue à chaque contrôle : part du territoire encerclé × ce réglage. */
export const POCKET_DRAIN = 0.04;
export const POCKET_MIN_CELLS_SHOWN = 3;

// IA.
export const AI_INTERVAL_TICKS = 30;
export const AI_ENGAGED_SHARE = 0.7;
/** En sous-nombre, l'IA engage presque tout et ne garde plus de réserve d'offensive. */
export const AI_OUTNUMBERED_SHARE = 0.95;
export const AI_ATTACK_RATIO = 1.1;
/** Chance de préparer une offensive à chaque décision, s'il reste de la réserve. */
export const AI_OFFENSIVE_CHANCE = 0.15;
export const AI_OFFENSIVE_MIN_RESERVE = 0.15;
export const AI_OFFENSIVE_SHARE = 0.6;
export const AI_MAX_OFFENSIVES = 2;
export const AI_TARGET_MIN_DISTANCE = 30;
export const AI_TARGET_MAX_DISTANCE = 90;

export const DEFAULT_ALLOCATION = 0.6;

/** Capacité militaire de départ. Formule provisoire en attendant l'économie. */
export function baseCapacity(population: number, gdpMusd: number): number {
  const gdpBillions = Math.max(1, gdpMusd / 1000);
  const populationMillions = Math.max(0.05, population / 1e6);
  return 10 * Math.sqrt(gdpBillions) * populationMillions ** 0.25;
}
