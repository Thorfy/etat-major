// Réglages de la simulation. La puissance militaire est provisoire : elle viendra de
// l'économie au jalon 4.

export const TICKS_PER_SECOND = 10;
/**
 * Vitesses de jeu, en multiples de TICKS_PER_SECOND, affichées ×1, ×2 et ×4. La vitesse
 * normale fait 40 ticks par seconde réelle : une semaine de jeu toutes les 15 s.
 */
export const GAME_SPEEDS = [4, 8, 16] as const;
export const SPEED_LABELS = ['×1', '×2', '×4'] as const;

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
/**
 * La pression s'essouffle avec la distance au départ : −1 de log tous les N cellules. La
 * logistique fait l'essentiel de l'essoufflement depuis le jalon 5.
 */
export const OFFENSIVE_DEPTH_FADE = 220;
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
/** Une étendue d'eau d'au moins ce nombre de cellules est une mer ; en dessous, un lac. */
export const MIN_SEA_CELLS = 400;
/** Part de la marine d'une nation annexée que récupère le vainqueur. */
export const ANNEXED_NAVY = 0.25;

export function baseNavy(gdpMusd: number): number {
  return Math.sqrt(Math.max(1, gdpMusd / 1000));
}

// Capitulation.
/** Une nation capitule quand elle tient moins que cette part de la valeur de son territoire. */
export const CAPITULATION_SHARE = 0.25;
export const CAPITULATION_INTERVAL_TICKS = 20;
/** Décalage des contrôles de capitulation, pour ne pas tomber sur un contrôle du ravitaillement. */
export const CAPITULATION_TICK = 3;
/** Une province annexée rapporte cette part de sa valeur d'origine. */
export const ANNEXED_VALUE = 0.35;

// Guerres déclarées par l'IA.
export const WAR_INTERVAL_TICKS = 100;
export const WAR_CHANCE = 0.3;
/** Nombre maximal de guerres en cours, en part des nations encore en vie. */
export const MAX_WAR_SHARE = 0.2;
export const WAR_CAPACITY_RATIO = 1.4;
/**
 * Le joueur doit pouvoir se consacrer à son économie : l'IA ne l'attaque qu'à ce rapport de
 * force, jamais deux fois de suite à moins de PLAYER_WAR_COOLDOWN_TICKS (26 semaines), et un
 * joueur pacifique (agressivité sous PEACEFUL_AGGRESSION) est épargné la plupart du temps.
 */
export const PLAYER_WAR_RATIO = 2;
export const PLAYER_WAR_COOLDOWN_TICKS = 26 * 600;
export const PEACEFUL_AGGRESSION = 0.15;
export const PEACEFUL_PLAYER_SPARED = 0.6;
/**
 * L'IA juge la force qu'un voisin peut vraiment lui opposer : ce qu'il engage déjà sur
 * d'autres fronts n'en fait pas partie (sans descendre sous ce plancher), et un pays las ou à
 * court d'hommes pèse moins.
 */
export const MIN_FREE_FORCE_SHARE = 0.25;
export const WEARY_STRENGTH = 0.5;
export const DRAINED_STRENGTH = 0.4;
/** Répit du joueur en début de partie : 26 semaines, environ 6 min 30 à vitesse normale. */
export const PLAYER_GRACE_TICKS = 26 * 600;
export const ADJACENCY_INTERVAL_TICKS = 600;
/**
 * Voisinages par la terre puis par la mer, chacun sur un tick à part, choisi pour ne
 * tomber ni sur un contrôle du ravitaillement ni sur une décision de l'IA.
 */
export const LAND_NEIGHBORS_TICK = 2;
export const SEA_NEIGHBORS_TICK = 302;
/** Portée des voisinages maritimes, en cellules de la grille à demi-résolution. */
export const SEA_NEIGHBOR_RADIUS = 30;
export const AI_AMPHIBIOUS_CHANCE = 0.1;

// Ravitaillement et encerclements.
export const SUPPLY_INTERVAL_TICKS = 20;
/**
 * Les nations sont contrôlées en autant de groupes, à tour de rôle : chacune l'est toujours
 * toutes les SUPPLY_INTERVAL_TICKS, mais le calcul ne pèse jamais sur un seul tick.
 */
export const SUPPLY_GROUPS = 4;
/** Avantage minimal de l'ennemi sur une poche, même s'il ne fait que tenir. */
export const POCKET_EDGE = 1.6;
export const POCKET_SPEED = 1.6;
/** Part des forces perdue à chaque contrôle : part du territoire encerclé × ce réglage. */
export const POCKET_DRAIN = 0.04;
export const POCKET_MIN_CELLS_SHOWN = 3;

// Logistique. Le sol national est toujours ravitaillé. Sur le territoire conquis, le
// ravitaillement s'affaiblit avec la distance au sol national, comptée en coût de transport.
/** Coût de transport d'une cellule, par terrain : plaine, montagne, plateau, désert, arctique, jungle. */
export const TERRAIN_SUPPLY_COST = [1, 2.5, 1.5, 2, 2.5, 2.5];
/**
 * Infrastructure : une région dense et riche transporte mieux. Le coût est multiplié par un
 * facteur qui va de ce maximum (province vide) à ce minimum (bassin industriel).
 */
export const INFRASTRUCTURE_COST_MAX = 1.5;
export const INFRASTRUCTURE_COST_MIN = 0.5;
/** Une province occupée se consolide (voies réparées) en ce nombre de secondes de jeu. */
export const CONSOLIDATION_SECONDS = 180;
/** Une province consolidée ne coûte plus que cette part de son coût de transport. */
export const CONSOLIDATED_COST = 0.3;
/** Coût de transport jusqu'à une côte conquise, si la marine tient la mer. */
export const SEA_SUPPLY_COST = 15;
/**
 * Plus le coût de transport par cellule de mer qui sépare cette côte du port national le plus
 * proche sur la même mer : loin de chez soi, les troupes débarquées sont mal ravitaillées, donc
 * attaquent mal (SUPPLY_ATTACK_PENALTY). À 300 cellules, 90 % ; à 1 000, 50 % ; au-delà de 1 600, le minimum.
 */
export const SEA_SUPPLY_PER_CELL = 0.04;
/** Ports nationaux retenus par nation et par mer pour mesurer cette distance. */
export const MAX_SAMPLED_PORTS = 64;
/** Distance ravitaillée sans perte, puis distance sur laquelle le ravitaillement s'éteint. */
export const SUPPLY_FREE_RANGE = 20;
export const SUPPLY_FADE_RANGE = 60;
/** Ravitaillement minimal, même très loin : on vit sur le pays. */
export const MIN_SUPPLY = 0.15;
/** Précision du calcul des distances : pas de 1 / ce réglage. */
export const SUPPLY_COST_SCALE = 2;
/** Malus de l'attaquant mal ravitaillé, en log du rapport de force, à ravitaillement nul. */
export const SUPPLY_ATTACK_PENALTY = 1.5;
/** Malus du défenseur mal ravitaillé, sur une cellule qu'il occupe. */
export const SUPPLY_DEFENSE_PENALTY = 1;
/** Usure supplémentaire par tick d'un camp au ravitaillement nul, en part de ses forces. */
export const SUPPLY_ATTRITION = 0.0006;
/** Une offensive sans ravitaillement s'use ce nombre de fois plus vite. */
export const OFFENSIVE_SUPPLY_ATTRITION = 4;
/** L'IA ne lance pas d'offensive depuis une cellule moins ravitaillée que ça. */
export const AI_MIN_LAUNCH_SUPPLY = 0.5;

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

// ---------------------------------------------------------------------------
// L'arrière (jalon 6).
// ---------------------------------------------------------------------------

// Main-d'œuvre : les renforts puisent dans un réservoir d'hommes que les pertes vident.
/** Réservoir maximal, en part de la capacité militaire de départ portée par la population. */
export const MANPOWER_RATIO = 1.2;
/** Le réservoir se reconstitue de cette part de son maximum par minute. */
export const MANPOWER_REGEN_PER_MINUTE = 0.03;
/** Une province occupée fournit cette part de ses hommes à l'occupant. */
export const OCCUPIED_MANPOWER = 0.1;

// Lassitude de guerre : la stabilité baisse avec la guerre, les pertes et l'occupation.
export const START_STABILITY = 0.8;
/** En paix, la stabilité remonte vers ce niveau. */
export const PEACE_STABILITY = 0.85;
export const STABILITY_RECOVERY_PER_MINUTE = 0.02;
/** Usure par minute de guerre, multipliée par 0,5 + effort de guerre. */
export const WAR_WEARINESS_PER_MINUTE = 0.005;
/** Stabilité perdue pour des pertes égales à tout le réservoir de main-d'œuvre. */
export const CASUALTY_WEARINESS = 0.2;
/** Usure par minute si tout le territoire national est occupé (au prorata sinon). */
export const OCCUPATION_WEARINESS_PER_MINUTE = 0.04;
/** Stabilité gagnée par le vainqueur d'une capitulation. */
export const VICTORY_STABILITY = 0.1;
/**
 * Effort de guerre possible au plus : tout tant que la stabilité reste à son niveau de départ,
 * puis de moins en moins, jusqu'à ce réglage à stabilité nulle.
 */
export const MIN_EFFORT_CAP = 0.3;
/** Une nation instable capitule plus tôt : jusqu'à ce supplément de seuil à stabilité nulle. */
export const UNREST_CAPITULATION = 0.25;
/** Résistance : une province occupée non consolidée coûte cette part de sa valeur à l'occupant. */
export const GARRISON_COST = 0.2;

// Ressources stratégiques.
/** Le monde produit plus qu'il ne consomme : les besoins valent cette part de la production. */
export const RESOURCE_NEED_RATIO = 0.8;
/** Part des besoins importable : par la mer, ou par la terre seule (pays enclavé ou bloqué). */
export const SEA_IMPORT_SHARE = 0.7;
export const LAND_IMPORT_SHARE = 0.4;
/** Une marine ennemie au moins ce nombre de fois plus forte impose un blocus. */
export const BLOCKADE_RATIO = 2;
/** Part de la production d'un gisement occupé qui revient à l'occupant. */
export const OCCUPIED_RESOURCES = 0.5;
/** Sans pétrole, l'armée ne garde que cette part de sa capacité. */
export const OIL_SHORTAGE_FLOOR = 0.6;
/** Sans acier, chantiers et croissance ne gardent que cette part de leur rythme. */
export const STEEL_SHORTAGE_FLOOR = 0.4;

// Chantiers : la part civile de l'économie bâtit, province par province.
/** Points de construction par minute : ce réglage × racine du PIB en Md$ × (1 − effort). */
export const CONSTRUCTION_PER_MINUTE = 2;
export const MAX_FACTORY_LEVEL = 3;
export const MAX_INFRASTRUCTURE_LEVEL = 3;
/** Coût d'un chantier, multiplié par le niveau visé pour les usines et l'infrastructure. */
export const BUILD_COST = { factory: 200, infrastructure: 120, depot: 150 } as const;
/** Chaque niveau d'usine ajoute cette part à la valeur et au PIB de la province. */
export const FACTORY_BONUS = 0.15;
/** Chaque niveau d'infrastructure retire cette part au coût de transport de la province. */
export const INFRASTRUCTURE_BONUS = 0.2;
/** Un dépôt se bâtit dans une province occupée, consolidée au moins à ce point. */
export const DEPOT_MIN_CONSOLIDATION = 0.5;

/**
 * Bâtiments du sol national, au-delà des usines : niveau maximal et coût par niveau (le coût est
 * multiplié par le niveau visé). Raffinerie et aciérie demandent un gisement, le chantier naval
 * une côte.
 */
export const PROVINCE_BUILDINGS = {
  refinery: { max: 2, cost: 160 },
  steelworks: { max: 2, cost: 160 },
  recruitment: { max: 3, cost: 100 },
  services: { max: 3, cost: 120 },
  shipyard: { max: 3, cost: 180 },
} as const;
export type ProvinceBuilding = keyof typeof PROVINCE_BUILDINGS;
export const isProvinceBuilding = (kind: string): kind is ProvinceBuilding => kind in PROVINCE_BUILDINGS;
/** Chaque niveau de raffinerie (d'aciérie) ajoute cette part au pétrole (à l'acier) du gisement. */
export const REFINERY_BONUS = 0.5;
export const STEELWORKS_BONUS = 0.5;
/** Chaque niveau de centre de recrutement ajoute cette part aux hommes mobilisables de la province. */
export const RECRUITMENT_BONUS = 0.2;
/**
 * Services publics, par niveau moyen sur le sol national (pondéré par la valeur des provinces) :
 * la stabilité remonte plus vite en paix, et la guerre l'use moins.
 */
export const SERVICES_RECOVERY_BONUS = 0.5;
export const SERVICES_WEARINESS_CUT = 0.1;
/** Chaque niveau de chantier naval achevé ajoute cette part de sa marine de départ au pays. */
export const SHIPYARD_NAVY = 0.15;
/** Chance qu'une IA lance un chantier à chacune de ses décisions, si sa file est courte. */
export const AI_BUILD_CHANCE = 0.3;
export const AI_MAX_QUEUE = 2;

// ---------------------------------------------------------------------------
// Défense planifiée (jalon 7).
// ---------------------------------------------------------------------------

// Fortifications : un chantier qui fortifie une bande de cellules de son territoire.
/** Demi-largeur de la bande fortifiée le long d'une ligne tracée, en cellules. */
export const FORT_HALF_WIDTH = 2;
/** Profondeur fortifiée derrière un front, en cellules. */
export const FORT_FRONT_DEPTH = 3;
export const MAX_FORT_LINE_LENGTH = 150;
export const MAX_FORT_CELLS = 2500;
/** Points de construction par cellule fortifiée. */
export const FORT_COST_PER_CELL = 0.6;
/** Malus de l'assaillant sur une cellule fortifiée, en log du rapport de force. */
export const FORT_DEFENSE = 1;
/** Une cellule fortifiée tombe ce nombre de fois moins vite. */
export const FORT_SPEED = 0.6;
/** L'IA fortifie un front où elle est en sous-nombre, si la bande est assez grande. */
export const AI_FORT_MIN_CELLS = 40;

// Réserve de contre-attaque : une part de l'armée gardée pour couper les percées ennemies.
export const MAX_COUNTER_SHARE = 0.5;
export const AI_COUNTER_SHARE = 0.25;
/** Une percée ennemie est contrée dès qu'elle a pris ce nombre de cellules sur le sol national. */
export const COUNTER_MIN_CAPTURED = 25;
/** La contre-attaque frappe la percée à cette part de sa profondeur, près de sa base. */
export const COUNTER_DEPTH = 0.4;
/** Écart entre le couloir ennemi et le départ de la contre-attaque, en plus de sa demi-largeur. */
export const COUNTER_OFFSET = 8;
export const COUNTER_MAX_ATTEMPTS = 3;

// Secteurs prioritaires : les forces d'un front s'y concentrent, au détriment du reste.
export const MAX_PRIORITY_ZONES = 3;
export const PRIORITY_RADIUS = 25;
/** Densité gagnée dans un secteur prioritaire ; le reste du front la paie. */
export const PRIORITY_BOOST = 0.6;
/** Au-delà de cette part du front en secteurs prioritaires, la concentration n'a plus de sens. */
export const MAX_PRIORITY_SHARE = 0.5;

// ---------------------------------------------------------------------------
// Diplomatie (jalon 8). Une semaine de jeu vaut 600 ticks.
// ---------------------------------------------------------------------------

const WEEK = 600;
export const TICKS_PER_WEEK = WEEK;
export const DIPLOMACY_INTERVAL_TICKS = 100;

// Paix et trêves.
/** Après une paix, les deux pays ne peuvent plus se faire la guerre pendant un an. */
export const TRUCE_TICKS = 52 * WEEK;
/** Pas de paix avant quelques semaines de guerre. */
export const MIN_WAR_TICKS_FOR_PEACE = 4 * WEEK;
/** L'IA veut la paix sous cette stabilité, ou sous cette part de réservoir d'hommes. */
export const AI_PEACE_STABILITY = 0.45;
export const AI_PEACE_MANPOWER = 0.25;
/** Une IA qui tient encore presque tout son territoire et a pris plus qu'elle n'a perdu refuse. */
export const AI_WINNING_HOME_SHARE = 0.9;
/** L'IA propose la paix au joueur au bout de ce temps, si elle la veut. */
export const AI_PEACE_OFFER_MIN_TICKS = 8 * WEEK;
/** Après une offre au joueur (acceptée, refusée ou ignorée), la même IA attend ce délai avant la suivante. */
export const AI_PEACE_OFFER_COOLDOWN_TICKS = 16 * WEEK;
export const AI_PEACE_OFFER_CHANCE = 0.3;
export const PEACE_OFFER_TICKS = 8 * WEEK;

// Agressivité : un pays trop agressif voit ses pactes refusés.
/** Agressivité gagnée en déclarant une guerre. */
export const AGGRESSION_WAR = 0.12;
/** En annexant : ce réglage × la valeur annexée rapportée à la sienne (avec un minimum). */
export const AGGRESSION_ANNEX = 0.5;
export const MIN_AGGRESSION_ANNEX = 0.05;
/** En obtenant des provinces par un traité de paix. */
export const AGGRESSION_CESSION = 0.2;
/** En rompant une alliance. */
export const AGGRESSION_BETRAYAL = 0.05;
export const AGGRESSION_DECAY_PER_WEEK = 0.01;

// Pactes de non-agression : deux pays qui en signent un ne peuvent plus se faire la guerre.
// Aucun n'entre en guerre pour défendre l'autre.
export const MAX_ALLIES = 4;
/** L'IA signe aussi face à un voisin au moins aussi menaçant que ça, ou à un ennemi commun. */
export const ALLIANCE_THREAT_RATIO = 1.2;
export const ALLIANCE_THREAT_AGGRESSION = 0.3;
/** L'IA refuse le pacte d'un pays plus agressif que ça. */
export const ALLIANCE_MAX_AGGRESSION = 0.45;

// Mouvements régionaux : dans un pays instable, une région annexée s'agite peu à peu. Elle demande
// d'abord des investissements, puis l'indépendance sans combat ; refusée, elle finit par se soulever.
/** Part minimale de la valeur du pays qu'une région annexée doit peser pour s'agiter. */
export const SECESSION_MIN_SHARE = 0.01;
/**
 * L'agitation d'une région tend vers un plafond : (1 − équipement) × (base + instabilité + guerre
 * + invasion + refus). Une région négligée d'un pays stable plafonne à la base : elle demande des
 * investissements sans jamais se soulever. Une région entièrement équipée reste calme, même dans
 * un pays à bout.
 */
export const UNREST_BASE = 0.4;
/** Le plafond monte de ça par point de stabilité du pays sous UNREST_STABILITY. */
export const UNREST_INSTABILITY = 2;
/** Chaque demande refusée, tant que la région ne s'est pas calmée, monte le plafond d'autant. */
export const REFUSAL_CEILING = 0.15;
export const UNREST_STABILITY = 0.45;
/** Un pays en guerre voit ses régions mal équipées s'agiter d'autant en plus. */
export const UNREST_WAR = 0.1;
/** Un pays envahi les voit s'agiter d'autant par point de son territoire d'origine perdu. */
export const UNREST_DEFEAT = 1.5;
/** L'agitation va vers son plafond à cette vitesse, par semaine, en montant comme en descendant. */
export const UNREST_SPEED_PER_WEEK = 0.05;
/**
 * Équipement d'une province : ses niveaux de bâtiments (usine, centre de recrutement, raffinerie,
 * aciérie, chantier naval ; services publics comptés double), rapportés à ce nombre. Chaque
 * programme d'investissements achevé y ajoute INVESTMENT_CARE pour toute la région.
 */
export const CARE_FULL_LEVELS = 4;
export const INVESTMENT_CARE = 0.25;
export const DEMAND_INVESTMENT_AT = 0.35;
export const DEMAND_INDEPENDENCE_AT = 0.65;
/** Au maximum, la région se soulève. */
export const REVOLT_AT = 1;
/** Sous ce niveau, la région est de nouveau calme : elle pourra redemander. */
export const UNREST_CALM = 0.15;
/** Une demande sans réponse est refusée au bout de ce délai. */
export const DEMAND_TICKS = 8 * WEEK;
/** Un refus fait monter l'agitation d'autant. */
export const REFUSAL_UNREST = 0.15;
/** Accepter les investissements calme aussitôt, puis encore à leur achèvement. */
export const INVESTMENT_CALM = 0.15;
export const INVESTMENT_DONE_CALM = 0.3;
/** Les investissements coûtent ce nombre de semaines de chantiers du pays. */
export const INVESTMENT_WEEKS = 6;
/** À l'achèvement, valeur et PIB de la région remontent de cette part de leur niveau d'origine. */
export const INVESTMENT_BOOST = 0.3;
/** L'IA accorde l'indépendance à une région qui pèse moins que ça. */
export const AI_INDEPENDENCE_MAX_SHARE = 0.05;
/**
 * Régions historiques (data/regions.json) : une région de son propre pays s'agite comme une région
 * annexée, plafond multiplié par la force de son identité (1 faible à 4 très forte). Dans un pays
 * stable et en paix, seule une identité très forte demande des investissements ; la guerre et
 * l'instabilité réveillent les autres, les plus fortes d'abord. Une identité faible ne se soulève
 * que dans un pays à bout. L'IA ne laisse partir une région historique qu'en guerre.
 */
export const REGION_IDENTITY = [0, 0.6, 0.7, 0.8, 0.9];
/**
 * Coalition rebelle : les régions dont les terres touchent celles de la première, de proche en
 * proche, se soulèvent avec elle si leur agitation atteint ce niveau. Ce sont les seules
 * coalitions du jeu.
 */
export const REBEL_JOIN_UNREST = 0.5;
export const MAX_REBEL_COALITION = 4;
export const REBEL_STABILITY = 0.7;
export const REBEL_EFFORT = 0.65;
export const REBEL_MOBILIZATION = 0.6;
