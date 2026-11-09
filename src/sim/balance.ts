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

/**
 * Plafond de bascules par front et par tick, en moyenne. Un front long ou sans défense
 * ne s'effondre pas d'un coup : la France ne tombe pas en moins d'une dizaine de minutes.
 */
export const MAX_FRONT_FLIPS_PER_TICK = 1.5;
/** Budget accumulable, pour que les bascules restent irrégulières. */
export const MAX_FRONT_FLIP_BUDGET = 4;

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

// Mer. La puissance navale est une valeur unique par nation, en attendant mieux.
/** Eau minimale sur le trajet pour qu'une flèche devienne un débarquement, en cellules. */
export const AMPHIBIOUS_MIN_SEA = 3;
export const AMPHIBIOUS_MAX_LENGTH = 1600;
/** Vitesse de traversée, en cellules par tick. */
export const AMPHIBIOUS_SPEED = 0.5;
/** Part des forces perdue à l'arrivée, à marines égales. */
export const AMPHIBIOUS_BASE_LOSS = 0.12;
export const AMPHIBIOUS_LOSS_PER_CELL = 0.0003;
export const AMPHIBIOUS_MIN_LOSS = 0.05;
export const AMPHIBIOUS_MAX_LOSS = 0.8;
export const BEACHHEAD_RADIUS = 2;
/** Une zone côtière est ravitaillée si sa marine vaut au moins cette part de celle de l'ennemi. */
export const NAVAL_SUPPLY_RATIO = 0.5;
/** Part de la marine d'une nation annexée que récupère le vainqueur. */
export const ANNEXED_NAVY = 0.25;

export function baseNavy(gdpMusd: number): number {
  return Math.sqrt(Math.max(1, gdpMusd / 1000));
}

// Capitulation.
/** Une nation capitule quand elle tient moins que cette part de la valeur de son territoire. */
export const CAPITULATION_SHARE = 0.25;
export const CAPITULATION_INTERVAL_TICKS = 20;
/** Une province annexée rapporte cette part de sa valeur d'origine. */
export const ANNEXED_VALUE = 0.35;

// Guerres déclarées par l'IA.
export const WAR_INTERVAL_TICKS = 100;
export const WAR_CHANCE = 0.5;
/** Nombre maximal de guerres en cours, en part des nations encore en vie. */
export const MAX_WAR_SHARE = 0.2;
export const WAR_CAPACITY_RATIO = 1.2;
/** Répit du joueur en début de partie. */
export const PLAYER_GRACE_TICKS = 1800;
export const ADJACENCY_INTERVAL_TICKS = 600;
/** Portée des voisinages maritimes, en cellules de la grille à demi-résolution. */
export const SEA_NEIGHBOR_RADIUS = 30;
export const AI_AMPHIBIOUS_CHANCE = 0.1;

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

// Économie.
export const ECONOMY_INTERVAL_TICKS = 10;
/**
 * Valeur militaire d'une province : sa part du PIB et de la population de son pays,
 * dans ces proportions. Les régions industrielles comptent donc le plus.
 */
export const VALUE_GDP_WEIGHT = 0.75;
/** Effort de guerre : part de l'économie tournée vers l'armée, de 0 à 1. */
export const DEFAULT_WAR_EFFORT = 0.5;
/** Multiplicateur de la capacité militaire : ce réglage + effort (de 0,5 à 1,5). */
export const EFFORT_CAPACITY_BASE = 0.5;
/** Vitesse de reconversion de l'économie, en effort par seconde de jeu. */
export const EFFORT_CHANGE_PER_SECOND = 0.008;
/**
 * Croissance de l'industrie par minute, à effort nul : (effort par défaut − effort) × 2 ×
 * ce réglage. Au-dessus de l'effort par défaut, l'industrie s'use au même rythme.
 */
export const GROWTH_PER_MINUTE = 0.02;
/** En guerre, la croissance est réduite d'autant. */
export const AT_WAR_GROWTH = 0.5;
/** Bornes du développement d'une province, relatif à son niveau de départ. */
export const MAX_DEVELOPMENT = 1.8;
export const MIN_DEVELOPMENT = 0.6;
/** Destructions : part du développement perdue quand une province change de mains. */
export const CAPTURE_DAMAGE = 0.15;
export const MIN_DAMAGED_DEVELOPMENT = 0.3;
/** Part de l'excédent démobilisée par tick quand la capacité passe sous l'armée. */
export const DEMOBILIZE_PER_TICK = 0.0004;
/** Effort de l'IA : en paix, en guerre, en sous-nombre, et écart de tempérament. */
export const AI_PEACE_EFFORT = 0.35;
export const AI_WAR_EFFORT = 0.65;
export const AI_DESPERATE_EFFORT = 0.9;
export const AI_EFFORT_SPREAD = 0.1;

/** Capacité militaire de départ d'une nation, répartie ensuite entre ses provinces. */
export function baseCapacity(population: number, gdpMusd: number): number {
  const gdpBillions = Math.max(1, gdpMusd / 1000);
  const populationMillions = Math.max(0.05, population / 1e6);
  return 10 * Math.sqrt(gdpBillions) * populationMillions ** 0.25;
}
