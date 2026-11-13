// Cœur de la simulation : aucune dépendance au navigateur, à l'horloge ou à
// Math.random. Mêmes données, même graine et mêmes ordres donnent la même partie.
import { findLandNeighbors } from '../map/adjacency.ts';
import { distanceToBoundary } from '../map/distance.ts';
import {
  ADJACENCY_INTERVAL_TICKS,
  AGGRESSION_ANNEX,
  AGGRESSION_BETRAYAL,
  AGGRESSION_CESSION,
  AGGRESSION_DECAY_PER_WEEK,
  AGGRESSION_WAR,
  AI_PEACE_MANPOWER,
  AI_PEACE_OFFER_CHANCE,
  AI_PEACE_OFFER_MIN_TICKS,
  AI_PEACE_OFFER_COOLDOWN_TICKS,
  AI_PEACE_STABILITY,
  AI_WINNING_HOME_SHARE,
  ALLIANCE_MAX_AGGRESSION,
  ALLIANCE_THREAT_AGGRESSION,
  ALLIANCE_THREAT_RATIO,
  DIPLOMACY_INTERVAL_TICKS,
  MAX_ALLIES,
  MAX_REBEL_COALITION,
  MIN_AGGRESSION_ANNEX,
  MIN_WAR_TICKS_FOR_PEACE,
  PEACE_OFFER_TICKS,
  REBEL_EFFORT,
  REBEL_MOBILIZATION,
  REBEL_STABILITY,
  SECESSION_MIN_SHARE,
  UNREST_STABILITY,
  UNREST_BASE,
  UNREST_INSTABILITY,
  UNREST_WAR,
  UNREST_DEFEAT,
  UNREST_SPEED_PER_WEEK,
  CARE_FULL_LEVELS,
  INVESTMENT_CARE,
  REFUSAL_CEILING,
  DEMAND_INVESTMENT_AT,
  DEMAND_INDEPENDENCE_AT,
  REVOLT_AT,
  UNREST_CALM,
  DEMAND_TICKS,
  REFUSAL_UNREST,
  INVESTMENT_CALM,
  INVESTMENT_DONE_CALM,
  INVESTMENT_WEEKS,
  INVESTMENT_BOOST,
  AI_INDEPENDENCE_MAX_SHARE,
  REGION_IDENTITY,
  REBEL_JOIN_UNREST,
  TICKS_PER_WEEK,
  TRUCE_TICKS,
  AI_COUNTER_SHARE,
  AI_FORT_MIN_CELLS,
  COUNTER_DEPTH,
  COUNTER_MAX_ATTEMPTS,
  COUNTER_MIN_CAPTURED,
  COUNTER_OFFSET,
  FORT_COST_PER_CELL,
  FORT_DEFENSE,
  FORT_FRONT_DEPTH,
  FORT_HALF_WIDTH,
  FORT_SPEED,
  MAX_COUNTER_SHARE,
  MAX_FORT_CELLS,
  MAX_FORT_LINE_LENGTH,
  MAX_PRIORITY_SHARE,
  MAX_PRIORITY_ZONES,
  PRIORITY_BOOST,
  PRIORITY_RADIUS,
  AI_BUILD_CHANCE,
  AI_MAX_QUEUE,
  BLOCKADE_RATIO,
  BUILD_COST,
  PROVINCE_BUILDINGS,
  isProvinceBuilding,
  type ProvinceBuilding,
  REFINERY_BONUS,
  STEELWORKS_BONUS,
  RECRUITMENT_BONUS,
  SERVICES_RECOVERY_BONUS,
  SERVICES_WEARINESS_CUT,
  SHIPYARD_NAVY,
  CASUALTY_WEARINESS,
  CONSTRUCTION_PER_MINUTE,
  DEFAULT_MILITARY_SHARE,
  DEPOT_MIN_CONSOLIDATION,
  FACTORY_BONUS,
  GARRISON_COST,
  INFRASTRUCTURE_BONUS,
  LAND_IMPORT_SHARE,
  MANPOWER_RATIO,
  MANPOWER_REGEN_PER_MINUTE,
  MAX_FACTORY_LEVEL,
  MAX_INFRASTRUCTURE_LEVEL,
  MIN_EFFORT_CAP,
  MIN_FREE_FORCE_SHARE,
  DRAINED_STRENGTH,
  WEARY_STRENGTH,
  OCCUPATION_WEARINESS_PER_MINUTE,
  OCCUPIED_MANPOWER,
  OCCUPIED_RESOURCES,
  OIL_SHORTAGE_FLOOR,
  PEACE_STABILITY,
  RESOURCE_NEED_RATIO,
  SEA_IMPORT_SHARE,
  STABILITY_RECOVERY_PER_MINUTE,
  START_STABILITY,
  STEEL_SHORTAGE_FLOOR,
  UNREST_CAPITULATION,
  VICTORY_STABILITY,
  WAR_WEARINESS_PER_MINUTE,
  LAND_NEIGHBORS_TICK,
  SEA_NEIGHBORS_TICK,
  AI_MIN_LAUNCH_SUPPLY,
  CONSOLIDATED_COST,
  CONSOLIDATION_SECONDS,
  INFRASTRUCTURE_COST_MAX,
  INFRASTRUCTURE_COST_MIN,
  MIN_SUPPLY,
  OFFENSIVE_SUPPLY_ATTRITION,
  SEA_SUPPLY_COST,
  SEA_SUPPLY_PER_CELL,
  MAX_SAMPLED_PORTS,
  SUPPLY_ATTACK_PENALTY,
  SUPPLY_ATTRITION,
  SUPPLY_COST_SCALE,
  SUPPLY_DEFENSE_PENALTY,
  SUPPLY_FADE_RANGE,
  SUPPLY_FREE_RANGE,
  TERRAIN_SUPPLY_COST,
  AI_AMPHIBIOUS_CHANCE,
  AI_ATTACK_RATIO,
  AI_ENGAGED_SHARE,
  AI_INTERVAL_TICKS,
  AI_MAX_OFFENSIVES,
  AI_OFFENSIVE_CHANCE,
  AI_OFFENSIVE_MIN_RESERVE,
  AI_OFFENSIVE_SHARE,
  AI_OUTNUMBERED_SHARE,
  AI_TARGET_MAX_DISTANCE,
  AI_TARGET_MIN_DISTANCE,
  AMPHIBIOUS_BASE_LOSS,
  AMPHIBIOUS_LOSS_PER_CELL,
  AMPHIBIOUS_MAX_LENGTH,
  AMPHIBIOUS_MAX_LOSS,
  AMPHIBIOUS_MIN_LOSS,
  AMPHIBIOUS_SPEED,
  AI_DESPERATE_EFFORT,
  AI_EFFORT_SPREAD,
  AI_PEACE_EFFORT,
  AI_WAR_EFFORT,
  ANNEXED_NAVY,
  AT_WAR_GROWTH,
  CAPTURE_DAMAGE,
  DEFAULT_WAR_EFFORT,
  DEMOBILIZE_PER_TICK,
  ECONOMY_INTERVAL_TICKS,
  EFFORT_CAPACITY_BASE,
  EFFORT_CHANGE_PER_SECOND,
  GROWTH_PER_MINUTE,
  MAX_DEVELOPMENT,
  MIN_DAMAGED_DEVELOPMENT,
  MIN_DEVELOPMENT,
  TICKS_PER_SECOND,
  VALUE_GDP_WEIGHT,
  ANNEXED_VALUE,
  ATTRITION_PER_TICK,
  BEACHHEAD_RADIUS,
  CAPITULATION_INTERVAL_TICKS,
  CAPITULATION_TICK,
  CAPITULATION_SHARE,
  DEFAULT_ALLOCATION,
  DEFENSE_MULTIPLIER,
  FLIP_STEEPNESS,
  HOME_DEFENSE,
  INITIAL_MOBILIZATION,
  LOSS_MULTIPLIER,
  LOST_PROVINCE_RETAINED,
  MAX_FLIP_CHANCE,
  MAX_FRONT_FLIPS_PER_TICK,
  MAX_FRONT_FLIP_BUDGET,
  MAX_OFFENSIVES_PER_NATION,
  MAX_OFFENSIVE_LENGTH,
  MAX_WAR_SHARE,
  MIN_FRONT_LENGTH,
  NAVAL_SUPPLY_RATIO,
  NEIGHBOR_WEIGHT,
  OCCUPIED_VALUE,
  OFFENSIVE_ATTRITION,
  OFFENSIVE_CELL_BASE_COST,
  OFFENSIVE_CELL_COST,
  OFFENSIVE_DEFENDER_LOSS,
  OFFENSIVE_DEPTH_FADE,
  OFFENSIVE_EDGE_FALLOFF,
  OFFENSIVE_HALF_WIDTH,
  OFFENSIVE_MIN_FORCE,
  OFFENSIVE_SPEED,
  OFFENSIVE_STALL_TICKS,
  PLAYER_GRACE_TICKS,
  PLAYER_DEMAND_COOLDOWN_TICKS,
  POCKET_DRAIN,
  POCKET_EDGE,
  POCKET_MIN_CELLS_SHOWN,
  POCKET_SPEED,
  REINFORCE_PER_TICK,
  RETREAT_ADVANTAGE,
  SEA_NEIGHBOR_RADIUS,
  SECTOR_CHURN,
  SECTOR_NOISE,
  SECTOR_SHIFT,
  SUPPLY_GROUPS,
  SUPPLY_INTERVAL_TICKS,
  TERRAIN_DEFENSE,
  TERRAIN_SPEED,
  TRANSFER_RATE,
  WAR_CAPACITY_RATIO,
  PLAYER_WAR_RATIO,
  PLAYER_WAR_COOLDOWN_TICKS,
  PEACEFUL_AGGRESSION,
  PEACEFUL_PLAYER_SPARED,
  WAR_CHANCE,
  WAR_INTERVAL_TICKS,
  baseCapacity,
  baseNavy,
  TRADE_DEPENDENCE,
  TRADE_DEAL_GAIN,
  TRADE_DEAL_CAP,
  MAX_TRADE_DEALS,
  TRADE_DEAL_RESOURCES,
  EMBARGO_AGGRESSION,
  EMBARGO_LIFT_AGGRESSION,
  AI_TRADE_DEAL_CHANCE,
  AXIS_BONUS,
  AXIS_MAX_PER_PROVINCE,
  MAX_AXES,
  MAX_AXIS_TERMINALS,
  REGION_LEVY_STEP,
  REGION_LEVY_UNREST,
  REGION_POLICY_MAX,
  REGION_POLICY_STABILITY,
  REGION_TAX_STEP,
  REGION_TAX_UNREST,
  AUTO_HUBS_BASE,
  AUTO_HUBS_PER_PROVINCES,
  AUTO_HUBS_PER_RESEARCH,
  AUTO_HUBS_TERRITORY_MAX,
  HUB_BONUS,
  AUTO_TRANSIT_BONUS,
  HUB_SWAP_MARGIN,
  NETWORK_CHECK_GROUPS,
  MAX_AXIS_CELLS,
  AXIS_COST_BASE,
  AXIS_COST_PER_CELL,
  SEA_AXIS_COST_PER_CELL,
  AXIS_REUSE_WEIGHT,
  SEA_LINK_MAX,
  SEA_LINK_PENALTY,
  AI_AXIS_MIN_DISTANCE,
  AI_MAX_AXES,
  AI_AXIS_CHANCE,
  AI_PROFILES,
  CONQUEROR_WAR_CHANCE,
} from './balance.ts';
import type {
  BuildKind,
  DemandKind,
  MovementState,
  BuildOrder,
  EconomySnapshot,
  PriorityZone,
  FrontSnapshot,
  NationLabel,
  PocketSnapshot,
  SimCommand,
  SimEvent,
  SimSave,
  SimSaveState,
  SimSnapshot,
  Stance,
  TradeAxis,
  NetworkState,
  AxisSnapshot,
} from './protocol.ts';
import { isMilitaryBuild } from './protocol.ts';
import {
  AI_DOCTRINE_LEANING,
  AI_DOCTRINE_SPREAD,
  AI_RESEARCH_CHANCE,
  DOCTRINE_AXIS_COUNT,
  DOCTRINE_EFFECTS,
  DOCTRINE_REACH,
  DOCTRINE_SPEED_PER_WEEK,
  DOCTRINE_WAR_SPEED,
  MAX_RESEARCH_LEVEL,
  RESEARCH_COST,
  archetypeOf,
  doctrineModifiers,
  type DoctrineModifiers,
} from './doctrine.ts';
import { landingProblem, traceRoute } from './route.ts';
import { findSeas } from './seas.ts';

export interface SimConfig {
  width: number;
  height: number;
  /** `identity` : région historique en sommeil, force de son identité (1 à 4). */
  nations: { population: number; gdpMusd: number; identity?: number }[];
  /**
   * Le propriétaire initial d'une province est `nation + 1`. `region` : indice de la région
   * historique (une nation en sommeil) dont elle fait partie. Sans population ni PIB,
   * la valeur d'une province suit la racine de sa surface.
   */
  provinces: {
    nation: number;
    areaKm2: number;
    x: number;
    y: number;
    population?: number;
    gdpMusd?: number;
    oil?: number;
    steel?: number;
    region?: number;
  }[];
  provinceGrid: Uint16Array;
  /** Carte de départ, copiée : la simulation possède sa propre grille. */
  ownerGrid: Uint16Array;
  /** Plaine partout si absente. */
  terrainGrid?: Uint8Array;
  seed: number;
  /** Nation pilotée par le joueur (0 si toutes sont pilotées par l'IA). */
  player: number;
  /** Faux : les autres nations n'agissent que sur ordre (utile pour les tests). */
  ai?: boolean;
  /** Faux : tout est ravitaillé partout, pour mesurer l'effet de la logistique. */
  logistics?: boolean;
  /** Faux : le commerce ne compte pas (accès toujours entier), pour les tests qui l'isolent. */
  trade?: boolean;
  /** Faux : pas de réseau automatique, les axes se tracent à la main (tests des axes). */
  autoTrade?: boolean;
  /** Faux : les demandes des régions du joueur ne sont plus espacées, pour les tests de l'agitation. */
  demandPacing?: boolean;
  /** Faux : l'IA garde une doctrine au centre, pour les tests qui ne mesurent pas les doctrines. */
  doctrines?: boolean;
  /** Partie à reprendre. */
  saved?: SimSave;
}

interface FrontSide {
  allocation: number;
  stance: Stance;
  force: number;
  captured: number;
  /** Forces par cellule de front, sans la posture. */
  rawDensity: number;
  /** Forces par cellule de front, posture comprise. */
  density: number;
  /** Ravitaillement moyen de ses cellules de front, de 0 à 1. */
  supply: number;
  /** Part de ses cellules de front en secteur prioritaire, mesurée au tick précédent. */
  priority: number;
}

interface Front {
  a: number;
  b: number;
  sides: FrontSide[];
  length: number;
  logRatio: number;
  /** Bascules encore permises à ce front. */
  flipBudget: number;
  /** Tick de la déclaration de guerre. */
  startTick: number;
}

interface Offensive {
  id: number;
  nation: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Vecteur du couloir, bouclage pris en compte. */
  dx: number;
  dy: number;
  lengthSquared: number;
  force: number;
  startForce: number;
  captured: number;
  stalledTicks: number;
  /** Tick d'arrivée d'un débarquement encore en mer, 0 sinon. */
  transitUntil: number;
  landingX: number;
  landingY: number;
  seaLoss: number;
  targetX: number;
  targetY: number;
  /** Ravitaillement de l'offensive, mesuré au tick précédent sur son couloir. */
  supply: number;
  supplySum: number;
  supplyCount: number;
  /** Lancée d'elle-même par la réserve de contre-attaque. */
  counter: boolean;
}

const INITIAL_LIST_CAPACITY = 1 << 14;
/** Niveau de ravitaillement de chaque octet de la grille : 0 vaut plein (sol national). */
const SUPPLY_LEVELS = Float32Array.from({ length: 256 }, (_, value) => (value === 0 ? 1 : (value - 1) / 254));
const UNREACHED = 0xffff;
/** Un bit par groupe de nations dont les poches et le ravitaillement sont à recalculer. */
const ALL_SUPPLY_GROUPS = (1 << SUPPLY_GROUPS) - 1;
const SUPPLY_PHASE_TICKS = SUPPLY_INTERVAL_TICKS / SUPPLY_GROUPS;

export class Simulation {
  readonly width: number;
  readonly height: number;
  readonly owners: Uint16Array;
  readonly provinceGrid: Uint16Array;
  readonly player: number;
  tick = 0;

  private readonly stride: number;
  private readonly aiEnabled: boolean;
  private readonly logisticsEnabled: boolean;
  private readonly tradeEnabled: boolean;
  private rngState: number;
  private readonly terrain: Uint8Array | null;

  fronts: Front[] = [];
  private readonly frontIndex: Int32Array;
  private readonly advantage: Float32Array;
  private readonly lengthCounts: Int32Array;

  readonly offensives: Offensive[] = [];
  private readonly offensivesByNation: Offensive[][];
  private nextOffensiveId = 1;
  private matchedOffensive: Offensive | null = null;

  private frontier: Int32Array = new Int32Array(INITIAL_LIST_CAPACITY);
  private frontierCount = 0;
  private readonly frontierPosition: Int32Array;

  private readonly sectors: Float32Array;
  private readonly sectorColumns: number;

  private readonly reserve: Float64Array;
  private readonly capacity: Float64Array;
  private readonly cellCounts: Int32Array;
  private readonly armies: Float64Array;
  private readonly navy: Float64Array;
  private readonly alive: Uint8Array;
  private readonly heldHome: Float64Array;
  private readonly totalHome: Float64Array;

  private readonly provinces: SimConfig['provinces'];
  private readonly provinceHome: Uint16Array;
  private readonly provinceCells: Int32Array;
  private readonly provinceValue: Float64Array;
  private readonly controller: Uint16Array;
  private readonly provinceCounts: (Map<number, number> | null)[];
  private capacityDirty = false;
  private hasCoast: Uint8Array = new Uint8Array(0);
  /** Numéro de mer navigable de chaque cellule d'eau (0 : terre ou lac). L'eau ne change jamais. */
  readonly seas: Uint16Array;
  private readonly seaCount: number;
  /** Ports nationaux, échantillonnés, par nation et par mer : clé nation × (seaCount + 1) + mer. */
  private homePorts = new Map<number, Int32Array>();
  /** Les ports se recalculent quand le sol national d'un pays change (annexion, paix, sécession). */
  private homePortsStale = true;
  /** Vrai pendant une annexion : les provinces changent de mains sans destructions. */
  private peacefulTransfer = false;
  private readonly demobilized: Float64Array;

  // Économie.
  /** PIB de départ de chaque province, en millions de dollars (réduit par l'annexion). */
  private readonly provinceGdp: Float64Array;
  /** Développement de chaque province, relatif à son niveau de départ. */
  readonly development: Float64Array;
  private readonly effort: Float64Array;
  private readonly effortTarget: Float64Array;
  /** Tempérament de chaque IA : décalage de l'effort qu'elle choisit. */
  private readonly temperament: Float64Array;
  /** Tempérament de chaque IA, indice dans AI_PROFILES. */
  private readonly profile: Uint8Array;
  /** PIB courant, provinces occupées et perdues comprises. */
  private readonly output: Float64Array;
  /** Croissance du PIB courant, par minute (négative en cas d'usure). */
  private readonly growth: Float64Array;
  /** Capacité militaire avant l'effet du pétrole, qui sert aussi à mesurer le besoin. */
  private readonly rawCapacity: Float64Array;

  // L'arrière.
  /** Hommes que chaque province apporte au réservoir de son pays. */
  private readonly provinceManpower: Float64Array;
  private readonly manpower: Float64Array;
  private readonly manpowerMax: Float64Array;
  /** Armée de chaque nation juste après les renforts du tick précédent : mesure des pertes. */
  private readonly armyAfterReinforce: Float64Array;
  /** Pertes accumulées depuis le dernier passage de l'économie. */
  private readonly losses: Float64Array;
  private readonly stability: Float64Array;
  private readonly provinceOil: Float64Array;
  private readonly provinceSteel: Float64Array;
  /** Besoin en pétrole par point de capacité, et en acier par million de dollars de PIB. */
  private oilPerCapacity = 0;
  private steelPerOutput = 0;
  /** Part des besoins couverte, de 0 à 1. */
  private readonly oilCoverage: Float64Array;
  private readonly steelCoverage: Float64Array;
  private readonly blockaded: Uint8Array;
  /** Bâtiments de chaque province. */
  readonly factories: Uint8Array;
  readonly infrastructure: Uint8Array;
  /** Bâtiments du sol national, par province. */
  readonly buildings: Record<ProvinceBuilding, Uint8Array>;
  /** Provinces qui touchent l'eau : un chantier naval s'y bâtit. */
  private readonly provinceCoastal: Uint8Array;
  readonly depots: Uint8Array;
  /** Chantiers en file, par nation ; le premier avance. */
  private queues: BuildOrder[][];
  /** Points accumulés sur le premier chantier de la file civile, et de la militaire. */
  private readonly buildProgress: Float64Array;
  private readonly militaryProgress: Float64Array;
  /** Part des points de construction qui va à la file militaire, quand les deux ont des chantiers. */
  private readonly militaryShare: Float64Array;
  /** Points de construction par minute, pour l'affichage. */
  private readonly constructionRate: Float64Array;

  // Défense planifiée.
  /** Fortification de chaque cellule : 0 aucune, 255 achevée. */
  readonly forts: Uint8Array;
  private pendingFortCells: number[] = [];
  private pendingFortValues: number[] = [];
  /** Part de l'armée gardée pour les contre-attaques. */
  private readonly counterShare: Float64Array;
  /** Tentatives de contre-attaque, par « nation:offensive ennemie ». */
  private counterAttempts = new Map<string, number>();
  private priorityZones: PriorityZone[][];
  /** Cellules de front en secteur prioritaire, par paire (attaquant, défenseur). */
  private readonly priorityCounts: Float64Array;

  // Diplomatie.
  /** Alliance par paire : 0 aucune, 1 traité, 2 coalition. */
  private readonly allied: Uint8Array;
  /** Fin de la trêve par paire, en tick. */
  private readonly truceUntil: Int32Array;
  private readonly aggression: Float64Array;
  private readonly coalitionAgainst: Uint16Array;
  private peaceOffers: { from: number; to: number; until: number }[] = [];
  /** Tick de la dernière offre de paix de chaque IA au joueur (très loin dans le passé : aucune). */
  private lastPeaceOffer: Float64Array;
  /** Tick de la dernière guerre déclarée au joueur par une IA (très loin dans le passé : aucune). */
  private lastWarOnPlayer = -1e12;
  /** Tick à partir duquel une région du joueur peut de nouveau lui adresser une demande. */
  private nextPlayerDemand = PLAYER_GRACE_TICKS;
  private readonly demandPacing: boolean;
  /** Commerce : accords (symétriques) et embargos (le premier refuse de commercer avec le second). */
  private readonly tradeDeal: Uint8Array;
  private readonly embargo: Uint8Array;
  private tradeDeals: [number, number][] = [];
  private embargoes: [number, number][] = [];
  /** Accès au commerce de chaque nation, de 0 à 1, et multiplicateur de PIB et de capacité. */
  private readonly tradeAccess: Float64Array;
  private readonly tradeFactor: Float64Array;
  /** Mers que borde chaque nation, un bit par mer. */
  private coastSeas: Uint32Array;
  private axes: TradeAxis[] = [];
  private nextAxisId = 1;
  /** Réseau commercial automatique de chaque nation. */
  private networks: NetworkState[] = [];
  private readonly autoTrade: boolean;
  private networkPhase = 0;
  /** Politiques régionales, par (pays × stride + région) : impôts et levée, de −2 à +2. */
  private regionPolicies = new Map<number, { tax: number; levy: number }>();
  /** Par province : niveaux d'impôts et de levée qui s'y appliquent (ceux de sa région chez qui la tient). */
  private provinceTax: Float64Array = new Float64Array(0);
  private provinceLevy: Float64Array = new Float64Array(0);
  /** Bonus des axes actifs par province, et leur nombre. */
  private readonly axisBonus: Float64Array;
  private readonly axisCount: Uint8Array;
  private axesVersion = 1;
  /** Provinces voisines par la terre, pour tracer les axes. */
  private provinceNeighbors: number[][] | null = null;
  /** Mers que borde chaque province (bits, comme coastSeas), calculées à la première demande. */
  private provinceSeas: Uint32Array | null = null;
  private sentAxesVersion = 0;
  /** Régions annexées qui s'agitent, par pays qui les tient. */
  private movements: MovementState[] = [];

  // Doctrines (jalon 10) : cinq axes par nation, à plat (nation × DOCTRINE_AXIS_COUNT + axe).
  private readonly doctrine: Float64Array;
  private readonly doctrineTarget: Float64Array;
  private readonly research: Uint8Array;
  /** Effets de la doctrine de chaque nation, recalculés quand elle bouge. */
  private readonly mods: DoctrineModifiers[];
  /** Grande doctrine du joueur, pour annoncer quand elle change. */
  private playerArchetype = -1;
  /** Carte de départ : de quoi faire renaître un pays annexé. */
  private readonly startHome: Uint16Array;
  /** Région historique de chaque province (0 : aucune), et multiplicateur d'agitation de chaque nation. */
  private readonly regionOf: Uint16Array;
  private readonly identity: Float64Array;
  /** 1 pour une région historique (une nation en sommeil au départ). */
  private readonly historicRegion: Uint8Array;
  private readonly startValue: Float64Array;
  private readonly startGdp: Float64Array;
  private readonly startManpower: Float64Array;
  private readonly nationGdp: number[];

  // Ravitaillement.
  private readonly landCells: Int32Array;
  private readonly coastCells: Int32Array;
  private readonly visited: Uint8Array;
  private readonly visitOrder: Int32Array;
  private readonly pocket: Uint8Array;
  /** Cellules en poche, par groupe de nations qui les a trouvées. */
  private pocketLists: number[][] = Array.from({ length: SUPPLY_GROUPS }, () => []);
  private readonly pocketCounts: Int32Array;
  private pockets: PocketSnapshot[] = [];
  /** Cellule d'ancrage par territoire d'origine : l'Alaska n'est pas une poche. */
  private readonly anchorOwner = new Map<number, number>();
  private readonly isAnchor: Uint8Array;
  private supplyDirty = 0;

  // Logistique.
  /** Ravitaillement de chaque cellule : 0 sur le sol national, sinon 1 + 254 × niveau. */
  readonly supply: Uint8Array;
  /** Cellules dont le ravitaillement n'est pas plein. */
  private supplyList: number[] = [];
  /** 1 pour les cellules de supplyList (marque de travail pendant le calcul). */
  private readonly supplyListed: Uint8Array;
  private readonly supplyDistance: Uint16Array;
  private readonly supplyCost: Uint8Array;
  /** Consolidation de chaque province occupée, de 0 à 1. */
  readonly consolidation: Float64Array;
  /** Somme du ravitaillement des cellules de front, par paire (attaquant, défenseur). */
  private readonly supplySums: Float64Array;
  private pendingSupplyCells: number[] = [];
  private pendingSupplyValues: number[] = [];

  // Voisinages, pour les déclarations de guerre de l'IA.
  private landNeighbors: number[][];
  private seaNeighbors: number[][];
  private readonly labelCells: Int32Array;

  private flipCells: Int32Array = new Int32Array(1024);
  private flipOwners: Uint16Array = new Uint16Array(1024);
  private flipOffensives: Int32Array = new Int32Array(1024);
  private flipCount = 0;
  private pendingCells: number[] = [];
  private pendingOwners: number[] = [];
  private pendingProvinces: number[] = [];
  private pendingHomes: number[] = [];
  private pendingEvents: SimEvent[] = [];

  constructor(config: SimConfig) {
    this.width = config.width;
    this.height = config.height;
    this.owners = config.ownerGrid.slice();
    this.provinceGrid = config.provinceGrid;
    this.terrain = config.terrainGrid ?? null;
    this.player = config.saved ? config.saved.state.player : config.player;
    this.aiEnabled = config.ai ?? true;
    this.logisticsEnabled = config.logistics ?? true;
    this.tradeEnabled = config.trade ?? true;
    // Sans commerce, pas de réseau ; sinon il est automatique, sauf demande contraire.
    this.autoTrade = this.tradeEnabled && (config.autoTrade ?? true);
    this.demandPacing = config.demandPacing ?? true;
    this.rngState = config.seed >>> 0 || 1;
    this.provinces = config.provinces;

    this.stride = config.nations.length + 1;
    const pairs = this.stride * this.stride;
    this.frontIndex = new Int32Array(pairs).fill(-1);
    this.advantage = new Float32Array(pairs).fill(-Infinity);
    this.lengthCounts = new Int32Array(pairs);
    this.supplySums = new Float64Array(pairs);
    this.priorityCounts = new Float64Array(pairs);
    this.allied = new Uint8Array(pairs);
    this.truceUntil = new Int32Array(pairs);
    this.frontierPosition = new Int32Array(this.owners.length).fill(-1);
    this.offensivesByNation = Array.from({ length: this.stride }, () => []);
    this.landNeighbors = Array.from({ length: this.stride }, () => []);
    this.seaNeighbors = Array.from({ length: this.stride }, () => []);

    this.sectorColumns = (this.width >> SECTOR_SHIFT) + 1;
    const sectorRows = (this.height >> SECTOR_SHIFT) + 1;
    this.sectors = new Float32Array(this.sectorColumns * sectorRows);
    for (let i = 0; i < this.sectors.length; i++) this.sectors[i] = (this.random() * 2 - 1) * SECTOR_NOISE;

    const provinceCount = config.provinces.length + 1;
    this.provinceHome = new Uint16Array(provinceCount);
    this.provinceCells = new Int32Array(provinceCount);
    this.provinceValue = new Float64Array(provinceCount);
    this.controller = new Uint16Array(provinceCount);
    this.consolidation = new Float64Array(provinceCount);
    this.provinceCounts = new Array(provinceCount).fill(null);

    this.reserve = new Float64Array(this.stride);
    this.capacity = new Float64Array(this.stride);
    this.cellCounts = new Int32Array(this.stride);
    this.armies = new Float64Array(this.stride);
    this.pocketCounts = new Int32Array(this.stride);
    this.navy = new Float64Array(this.stride);
    this.alive = new Uint8Array(this.stride);
    this.heldHome = new Float64Array(this.stride);
    this.totalHome = new Float64Array(this.stride);
    this.labelCells = new Int32Array(this.stride);
    this.provinceGdp = new Float64Array(provinceCount);
    this.development = new Float64Array(provinceCount).fill(1);
    this.effort = new Float64Array(this.stride).fill(DEFAULT_WAR_EFFORT);
    this.effortTarget = new Float64Array(this.stride).fill(DEFAULT_WAR_EFFORT);
    this.temperament = new Float64Array(this.stride);
    for (let n = 1; n < this.stride; n++) this.temperament[n] = (this.random() * 2 - 1) * AI_EFFORT_SPREAD;
    // Tempéraments : un hachage de la graine et du pays, sans toucher au tirage de la partie.
    this.profile = new Uint8Array(this.stride);
    for (let n = 1; n < this.stride; n++) {
      let hash = Math.imul((config.seed >>> 0) ^ Math.imul(n, 2654435761), 2246822519) >>> 0;
      hash = Math.imul(hash ^ (hash >>> 15), 3266489917) >>> 0;
      let roll = ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
      let index = 0;
      while (index < AI_PROFILES.length - 1 && roll >= AI_PROFILES[index].share) roll -= AI_PROFILES[index++].share;
      this.profile[n] = index;
    }
    // Doctrines : tout le monde part du centre. L'IA vise une position tirée de son tempérament,
    // avec un écart propre à chaque pays (un hachage, comme le tempérament).
    this.doctrine = new Float64Array(this.stride * DOCTRINE_AXIS_COUNT);
    this.doctrineTarget = new Float64Array(this.stride * DOCTRINE_AXIS_COUNT);
    this.research = new Uint8Array(this.stride * DOCTRINE_AXIS_COUNT);
    // Sans IA (ou sans doctrines), tout le monde reste au centre.
    const aiDoctrines = this.aiEnabled && (config.doctrines ?? true);
    for (let n = 1; aiDoctrines && n < this.stride; n++) {
      if (n === this.player) continue;
      const leaning = AI_DOCTRINE_LEANING[this.profile[n]] ?? AI_DOCTRINE_LEANING[0];
      for (let axis = 0; axis < DOCTRINE_AXIS_COUNT; axis++) {
        let hash = Math.imul((config.seed >>> 0) ^ Math.imul(n * 8 + axis + 1, 2246822519), 2654435761) >>> 0;
        hash = Math.imul(hash ^ (hash >>> 16), 3266489917) >>> 0;
        const roll = ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
        const value = leaning[axis] + (roll * 2 - 1) * AI_DOCTRINE_SPREAD;
        this.doctrineTarget[n * DOCTRINE_AXIS_COUNT + axis] = Math.max(-1, Math.min(1, value));
      }
    }
    const neutral = doctrineModifiers([0, 0, 0, 0, 0]);
    this.mods = Array.from({ length: this.stride }, () => neutral);
    this.output = new Float64Array(this.stride);
    this.growth = new Float64Array(this.stride);
    this.rawCapacity = new Float64Array(this.stride);
    this.provinceManpower = new Float64Array(provinceCount);
    this.manpower = new Float64Array(this.stride);
    this.manpowerMax = new Float64Array(this.stride);
    this.armyAfterReinforce = new Float64Array(this.stride).fill(-1);
    this.losses = new Float64Array(this.stride);
    this.stability = new Float64Array(this.stride).fill(START_STABILITY);
    this.provinceOil = new Float64Array(provinceCount);
    this.provinceSteel = new Float64Array(provinceCount);
    this.oilCoverage = new Float64Array(this.stride).fill(1);
    this.steelCoverage = new Float64Array(this.stride).fill(1);
    this.blockaded = new Uint8Array(this.stride);
    this.factories = new Uint8Array(provinceCount);
    this.infrastructure = new Uint8Array(provinceCount);
    this.buildings = {
      refinery: new Uint8Array(provinceCount),
      steelworks: new Uint8Array(provinceCount),
      recruitment: new Uint8Array(provinceCount),
      services: new Uint8Array(provinceCount),
      shipyard: new Uint8Array(provinceCount),
    };
    this.provinceCoastal = new Uint8Array(provinceCount);
    this.depots = new Uint8Array(provinceCount);
    this.queues = Array.from({ length: this.stride }, () => []);
    this.buildProgress = new Float64Array(this.stride);
    this.militaryProgress = new Float64Array(this.stride);
    this.militaryShare = new Float64Array(this.stride).fill(DEFAULT_MILITARY_SHARE);
    this.constructionRate = new Float64Array(this.stride);
    this.counterShare = new Float64Array(this.stride);
    this.aggression = new Float64Array(this.stride);
    this.coalitionAgainst = new Uint16Array(this.stride);
    this.lastPeaceOffer = new Float64Array(this.stride).fill(-1e12);
    this.tradeDeal = new Uint8Array(pairs);
    this.embargo = new Uint8Array(pairs);
    this.tradeAccess = new Float64Array(this.stride).fill(1);
    this.tradeFactor = new Float64Array(this.stride).fill(1);
    this.coastSeas = new Uint32Array(this.stride);
    this.axisBonus = new Float64Array(provinceCount);
    this.axisCount = new Uint8Array(provinceCount);
    this.nationGdp = config.nations.map((nation) => nation.gdpMusd);
    this.priorityZones = Array.from({ length: this.stride }, () => []);
    this.demobilized = new Float64Array(this.stride);

    let land = 0;
    for (let i = 0; i < this.owners.length; i++) {
      this.cellCounts[this.owners[i]]++;
      this.provinceCells[this.provinceGrid[i]]++;
      if (this.owners[i] !== 0) land++;
    }
    this.landCells = new Int32Array(land);
    const coast: number[] = [];
    for (let i = 0, k = 0; i < this.owners.length; i++) {
      if (this.owners[i] === 0) continue;
      this.landCells[k++] = i;
      if (this.touchesWater(i)) coast.push(i);
    }
    this.coastCells = Int32Array.from(coast);
    for (const cell of coast) this.provinceCoastal[this.provinceGrid[cell]] = 1;
    const seas = findSeas(this.owners, this.width, this.height);
    this.seas = seas.sea;
    this.seaCount = seas.sizes.length - 1;
    this.labelCells.set(this.cellCounts);
    this.visited = new Uint8Array(this.owners.length);
    this.visitOrder = new Int32Array(land);
    this.pocket = new Uint8Array(this.owners.length);
    this.isAnchor = new Uint8Array(this.owners.length);
    this.supply = new Uint8Array(this.owners.length);
    this.supplyListed = new Uint8Array(this.owners.length);
    this.supplyDistance = new Uint16Array(this.owners.length);
    this.forts = new Uint8Array(this.owners.length);
    this.supplyCost = new Uint8Array(this.owners.length);
    this.placeAnchors();

    // La capacité militaire se répartit entre les provinces selon leur part du PIB et de
    // la population : elle change de camp avec elles. Sans ces données, la racine de la
    // surface, pour ne pas tout donner aux déserts.
    const gdpTotal = new Float64Array(this.stride);
    const populationTotal = new Float64Array(this.stride);
    const rootArea = new Float64Array(this.stride);
    this.regionOf = new Uint16Array(provinceCount);
    this.identity = new Float64Array(this.stride).fill(1);
    this.historicRegion = new Uint8Array(this.stride);
    config.nations.forEach((nation, index) => {
      if (!nation.identity) return;
      this.identity[index + 1] = REGION_IDENTITY[nation.identity] ?? 1;
      this.historicRegion[index + 1] = 1;
    });
    config.provinces.forEach((province, index) => {
      const n = province.nation + 1;
      if (province.region !== undefined) this.regionOf[index + 1] = province.region + 1;
      this.provinceHome[index + 1] = n;
      this.controller[index + 1] = n;
      gdpTotal[n] += province.gdpMusd ?? 0;
      populationTotal[n] += province.population ?? 0;
      rootArea[n] += Math.sqrt(province.areaKm2);
    });
    config.provinces.forEach((province, index) => {
      const n = province.nation + 1;
      const nation = config.nations[province.nation];
      const area = Math.sqrt(province.areaKm2) / rootArea[n];
      const population = populationTotal[n] > 0 ? (province.population ?? 0) / populationTotal[n] : area;
      const gdp = gdpTotal[n] > 0 ? (province.gdpMusd ?? 0) / gdpTotal[n] : population;
      const weight = VALUE_GDP_WEIGHT * gdp + (1 - VALUE_GDP_WEIGHT) * population;
      this.provinceValue[index + 1] = baseCapacity(nation.population, nation.gdpMusd) * weight;
      this.provinceGdp[index + 1] = gdpTotal[n] > 0 ? (province.gdpMusd ?? 0) : nation.gdpMusd * gdp;
      this.provinceManpower[index + 1] = baseCapacity(nation.population, nation.gdpMusd) * population * MANPOWER_RATIO;
      this.provinceOil[index + 1] = province.oil ?? 0;
      this.provinceSteel[index + 1] = province.steel ?? 0;
    });
    // Besoins : le monde consomme une part de ce qu'il produit, chaque pays selon son armée
    // (pétrole) et son industrie (acier).
    let worldOil = 0;
    let worldSteel = 0;
    for (let p = 1; p < provinceCount; p++) {
      worldOil += this.provinceOil[p];
      worldSteel += this.provinceSteel[p];
    }
    this.recomputeCapacity();
    let worldCapacity = 0;
    let worldOutput = 0;
    for (let n = 1; n < this.stride; n++) {
      worldCapacity += this.rawCapacity[n];
      worldOutput += this.output[n];
    }
    this.oilPerCapacity = worldCapacity > 0 ? (RESOURCE_NEED_RATIO * worldOil) / worldCapacity : 0;
    this.steelPerOutput = worldOutput > 0 ? (RESOURCE_NEED_RATIO * worldSteel) / worldOutput : 0;
    this.recomputeManpower();
    this.manpower.set(this.manpowerMax);
    this.startHome = this.provinceHome.slice();
    this.startValue = this.provinceValue.slice();
    this.startGdp = this.provinceGdp.slice();
    this.startManpower = this.provinceManpower.slice();

    const hasCoast = new Uint8Array(this.stride);
    for (let k = 0; k < this.coastCells.length; k++) hasCoast[this.owners[this.coastCells[k]]] = 1;
    for (let n = 1; n < this.stride; n++) {
      this.alive[n] = this.cellCounts[n] > 0 ? 1 : 0;
      this.navy[n] = hasCoast[n] ? baseNavy(config.nations[n - 1].gdpMusd) : 0;
    }
    // Une région en sommeil n'a pas de flotte, mais en aura une si elle naît sur une côte.
    for (let p = 1; p < provinceCount; p++) if (this.provinceCoastal[p] && this.regionOf[p]) hasCoast[this.regionOf[p]] = 1;
    this.hasCoast = hasCoast;
    this.updateResources();
    this.recomputeCapacity();
    for (let n = 1; n < this.stride; n++) {
      this.reserve[n] = this.capacity[n] * INITIAL_MOBILIZATION;
    }
    this.refreshNeighbors();
    if (config.saved) this.restore(config.saved);
  }

  private touchesWater(cell: number): boolean {
    const { owners, width: W, height: H } = this;
    const x = cell % W;
    const y = (cell - x) / W;
    return (
      owners[x > 0 ? cell - 1 : cell + W - 1] === 0 ||
      owners[x < W - 1 ? cell + 1 : cell - W + 1] === 0 ||
      (y > 0 && owners[cell - W] === 0) ||
      (y < H - 1 && owners[cell + W] === 0)
    );
  }

  private random(): number {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 4294967296;
  }

  private wrapDelta(from: number, to: number): number {
    const W = this.width;
    let d = (to - from) % W;
    if (d > W / 2) d -= W;
    if (d < -W / 2) d += W;
    return d;
  }

  /** Total d'une nation : réserve, forces engagées et offensives en cours. */
  armyOf(nation: number): number {
    let total = this.reserve[nation];
    for (const front of this.fronts) {
      if (front.a === nation) total += front.sides[0].force;
      else if (front.b === nation) total += front.sides[1].force;
    }
    for (const offensive of this.offensivesByNation[nation]) total += offensive.force;
    return total;
  }

  reserveOf(nation: number): number {
    return this.reserve[nation];
  }

  cellsOf(nation: number): number {
    return this.cellCounts[nation];
  }

  capacityOf(nation: number): number {
    return this.capacity[nation];
  }

  /** PIB courant, en millions de dollars. */
  outputOf(nation: number): number {
    return this.output[nation];
  }

  effortOf(nation: number): number {
    return this.effort[nation];
  }

  manpowerOf(nation: number): number {
    return this.manpower[nation];
  }

  manpowerMaxOf(nation: number): number {
    return this.manpowerMax[nation];
  }

  stabilityOf(nation: number): number {
    return this.stability[nation];
  }

  oilCoverageOf(nation: number): number {
    return this.oilCoverage[nation];
  }

  steelCoverageOf(nation: number): number {
    return this.steelCoverage[nation];
  }

  isBlockaded(nation: number): boolean {
    return this.blockaded[nation] === 1;
  }

  buildQueueOf(nation: number): readonly BuildOrder[] {
    return this.queues[nation];
  }

  /** Paires (a < b) dont la valeur n'est pas nulle : [a, b, valeur]. */
  private pairsOf(value: (a: number, b: number) => number): [number, number, number][] {
    const pairs: [number, number, number][] = [];
    for (let a = 1; a < this.stride; a++) {
      for (let b = a + 1; b < this.stride; b++) {
        const v = value(a, b);
        if (v !== 0) pairs.push([a, b, v]);
      }
    }
    return pairs;
  }

  coalitionAgainstOf(nation: number): number {
    return this.coalitionAgainst[nation];
  }

  /** Régions agitées d'un pays (pour les tests et l'affichage). */
  movementsOf(parent: number): readonly MovementState[] {
    return this.movements.filter((movement) => movement.parent === parent);
  }

  peaceOffersTo(nation: number): readonly { from: number; to: number; until: number }[] {
    return this.peaceOffers.filter((offer) => offer.to === nation);
  }

  counterShareOf(nation: number): number {
    return this.counterShare[nation];
  }

  priorityZonesOf(nation: number): readonly PriorityZone[] {
    return this.priorityZones[nation];
  }

  isAlive(nation: number): boolean {
    return this.alive[nation] === 1;
  }

  controllerOf(province: number): number {
    return this.controller[province];
  }

  /** Ravitaillement d'une cellule, de 0 à 1 (1 sur le sol national). */
  supplyAt(cell: number): number {
    return SUPPLY_LEVELS[this.supply[cell]];
  }

  isPocket(cell: number): boolean {
    return this.pocket[cell] === 1;
  }

  get frontierSize(): number {
    return this.frontierCount;
  }

  get aliveCount(): number {
    let count = 0;
    for (let n = 1; n < this.stride; n++) count += this.alive[n];
    return count;
  }

  private frontOf(x: number, y: number): Front | null {
    const index = this.frontIndex[x * this.stride + y];
    return index < 0 ? null : this.fronts[index];
  }

  apply(command: SimCommand): void {
    switch (command.type) {
      case 'declareWars':
        this.declareWars(command.pairs);
        break;
      case 'setFront':
        this.setFront(command.nation, command.enemy, command.allocation, command.stance);
        break;
      case 'launchOffensive':
        this.launchOffensive(command.nation, command.fromX, command.fromY, command.toX, command.toY, command.share);
        break;
      case 'cancelOffensive':
        this.cancelOffensive(command.nation, command.id);
        break;
      case 'setEffort':
        this.setEffort(command.nation, command.effort);
        break;
      case 'build':
        this.build(command.nation, command.province, command.kind);
        break;
      case 'cancelBuild':
        this.cancelBuild(command.nation, command.index);
        break;
      case 'moveBuild':
        this.moveBuild(command.nation, command.from, command.to);
        break;
      case 'setMilitaryShare':
        this.setMilitaryShare(command.nation, command.share);
        break;
      case 'fortifyLine':
        this.fortifyLine(command.nation, command.fromX, command.fromY, command.toX, command.toY);
        break;
      case 'fortifyFront':
        this.fortifyFront(command.nation, command.enemy);
        break;
      case 'setCounterShare':
        this.setCounterShare(command.nation, command.share);
        break;
      case 'addPriority':
        this.addPriority(command.nation, command.x, command.y);
        break;
      case 'removePriority':
        this.removePriority(command.nation, command.index);
        break;
      case 'proposePeace':
        this.proposePeace(command.nation, command.enemy);
        break;
      case 'answerPeace':
        this.answerPeace(command.nation, command.enemy, command.accept);
        break;
      case 'answerDemand':
        this.answerDemand(command.nation, command.origin, command.accept);
        break;
      case 'setRegionPolicy':
        this.setRegionPolicy(command.nation, command.origin, command.tax, command.levy);
        break;
      case 'grantIndependence':
        this.grantIndependence(command.nation, command.origin);
        break;
      case 'proposeAlliance':
        this.proposeAlliance(command.nation, command.other);
        break;
      case 'breakAlliance':
        this.breakAlliance(command.nation, command.other);
        break;
      case 'proposeTradeDeal':
        this.proposeTradeDeal(command.nation, command.other);
        break;
      case 'endTradeDeal':
        this.endTradeDeal(command.nation, command.other);
        break;
      case 'setEmbargo':
        this.setEmbargo(command.nation, command.other, command.on);
        break;
      case 'buildAxis':
        this.buildAxis(command.nation, command.fromX, command.fromY, command.toX, command.toY);
        break;
      case 'removeAxis':
        this.removeAxis(command.nation, command.id);
        break;
      case 'setDoctrine':
        this.setDoctrine(command.nation, command.axis, command.value);
        break;
      case 'research':
        this.queueResearch(command.nation, command.axis);
        break;
    }
  }

  /** L'économie se reconvertit progressivement vers l'effort demandé. */
  setEffort(nation: number, effort: number): void {
    if (nation <= 0 || nation >= this.stride || !Number.isFinite(effort)) return;
    this.effortTarget[nation] = Math.max(0, Math.min(1, effort));
  }

  /**
   * Chaque paire est [agresseur, cible]. Une guerre agressive fait monter l'agressivité ; une
   * trêve ou un pacte de non-agression l'interdit. Personne n'entre en guerre pour défendre un
   * autre pays. Les guerres des coalitions et des sécessions ne coûtent rien.
   */
  declareWars(pairs: [number, number][], aggressive = true): void {
    const expanded: [number, number, boolean][] = [];
    for (const [x, y] of pairs) {
      if (x === y || x <= 0 || y <= 0 || x >= this.stride || y >= this.stride) continue;
      if (this.isAllied(x, y) || this.hasTruce(x, y)) continue;
      expanded.push([x, y, aggressive]);
    }
    const added: Front[] = [];
    for (const [x, y, costly] of expanded) {
      if (x === y || x <= 0 || y <= 0 || this.frontOf(x, y)) continue;
      if (!this.alive[x] || !this.alive[y]) continue;
      if (costly) this.aggression[x] += AGGRESSION_WAR;
      const a = Math.min(x, y);
      const b = Math.max(x, y);
      const side = (): FrontSide => ({ allocation: 0, stance: 'hold', force: 0, captured: 0, rawDensity: 0, density: 0, supply: 1, priority: 0 });
      const front: Front = { a, b, sides: [side(), side()], length: 0, logRatio: 0, flipBudget: 0, startTick: this.tick };
      const index = this.fronts.push(front) - 1;
      this.frontIndex[a * this.stride + b] = index;
      this.frontIndex[b * this.stride + a] = index;
      added.push(front);
      this.pendingEvents.push({ type: 'war', tick: this.tick, a, b });
    }
    if (added.length === 0) return;
    // Seules les cellules des nations entrées en guerre peuvent rejoindre la frontière.
    const involved = new Uint8Array(this.stride);
    for (const front of added) {
      involved[front.a] = 1;
      involved[front.b] = 1;
    }
    for (let k = 0; k < this.landCells.length; k++) {
      if (involved[this.owners[this.landCells[k]]]) this.refreshFrontier(this.landCells[k]);
    }
    this.measureFronts();
    this.supplyDirty = ALL_SUPPLY_GROUPS;
    if (this.player) {
      for (const front of added) {
        const enemy = front.a === this.player ? front.b : front.b === this.player ? front.a : 0;
        // Sans frontière commune, immobiliser des forces sur ce front ne servirait à rien.
        if (enemy !== 0 && front.length > 0) this.setFront(this.player, enemy, DEFAULT_ALLOCATION, 'hold');
      }
    }
    if (this.aiEnabled) this.decideAllocations();
  }

  /** Longueur de chaque front, sans attendre le prochain tick. */
  private measureFronts(): void {
    const { owners, width: W, height: H, stride, frontIndex, lengthCounts } = this;
    for (const front of this.fronts) {
      lengthCounts[front.a * stride + front.b] = 0;
      lengthCounts[front.b * stride + front.a] = 0;
    }
    for (let i = 0; i < this.frontierCount; i++) {
      const cell = this.frontier[i];
      const defender = owners[cell];
      const x = cell % W;
      const y = (cell - x) / W;
      const n0 = owners[x > 0 ? cell - 1 : cell + W - 1];
      const n1 = owners[x < W - 1 ? cell + 1 : cell - W + 1];
      const n2 = y > 0 ? owners[cell - W] : 0;
      const n3 = y < H - 1 ? owners[cell + W] : 0;
      for (let j = 0; j < 4; j++) {
        const attacker = j === 0 ? n0 : j === 1 ? n1 : j === 2 ? n2 : n3;
        if (attacker === 0 || attacker === defender) continue;
        if (j > 0 && attacker === n0) continue;
        if (j > 1 && attacker === n1) continue;
        if (j > 2 && attacker === n2) continue;
        const key = attacker * stride + defender;
        if (frontIndex[key] >= 0) lengthCounts[key]++;
      }
    }
    for (const front of this.fronts) {
      front.length = (lengthCounts[front.a * stride + front.b] + lengthCounts[front.b * stride + front.a]) / 2;
    }
  }

  /** La somme des allocations d'une nation ne dépasse jamais 100 %. */
  setFront(nation: number, enemy: number, allocation: number, stance: Stance): void {
    const front = this.frontOf(nation, enemy);
    if (!front) return;
    let others = 0;
    for (const other of this.fronts) {
      if (other === front) continue;
      if (other.a === nation) others += other.sides[0].allocation;
      else if (other.b === nation) others += other.sides[1].allocation;
    }
    const side = front.a === nation ? front.sides[0] : front.sides[1];
    side.allocation = Math.max(0, Math.min(allocation, 1 - others));
    side.stance = stance;
  }

  /**
   * Engage une part de la réserve dans un couloir. Le départ doit être sur le territoire
   * de la nation. Un trajet qui traverse assez d'eau devient un débarquement.
   * Renvoie l'identifiant, ou 0 si l'offensive est refusée.
   */
  launchOffensive(nation: number, fromX: number, fromY: number, toX: number, toY: number, share: number): number {
    const W = this.width;
    const H = this.height;
    const inside = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < W && y >= 0 && y < H;
    if (!inside(fromX, fromY) || !inside(toX, toY)) return 0;
    if (this.owners[fromY * W + fromX] !== nation) return 0;
    const list = this.offensivesByNation[nation];
    if (!list || list.length >= MAX_OFFENSIVES_PER_NATION) return 0;
    const force = this.reserve[nation] * Math.max(0, Math.min(1, share));
    if (force < OFFENSIVE_MIN_FORCE) return 0;
    let dx = this.wrapDelta(fromX, toX);
    let dy = toY - fromY;
    const length = Math.hypot(dx, dy);
    if (length === 0) return 0;

    const route = traceRoute(this.owners, W, H, fromX, fromY, toX, toY, this.seas);
    let transitUntil = 0;
    let seaLoss = 0;
    if (route.amphibious) {
      if (length > AMPHIBIOUS_MAX_LENGTH || this.navy[nation] <= 0) return 0;
      // Depuis sa propre côte, et vers une côte de la même mer.
      if (landingProblem(route, this.owners, nation) !== '') return 0;
      const landingOwner = this.owners[route.landingY * W + route.landingX];
      if (landingOwner === nation || !this.frontOf(nation, landingOwner)) return 0;
      transitUntil = this.tick + Math.max(1, Math.ceil(route.seaCells / AMPHIBIOUS_SPEED));
      seaLoss = this.seaLoss(nation, landingOwner, route.seaCells);
    } else if (length > MAX_OFFENSIVE_LENGTH) {
      dx = Math.round((dx / length) * MAX_OFFENSIVE_LENGTH);
      dy = Math.round((dy / length) * MAX_OFFENSIVE_LENGTH);
    }

    this.reserve[nation] -= force;
    const offensive: Offensive = {
      id: this.nextOffensiveId++,
      nation,
      fromX,
      fromY,
      toX: ((fromX + dx) % W + W) % W,
      toY: fromY + dy,
      dx,
      dy,
      lengthSquared: dx * dx + dy * dy,
      force,
      startForce: force,
      captured: 0,
      stalledTicks: 0,
      transitUntil,
      landingX: route.landingX,
      landingY: route.landingY,
      seaLoss,
      targetX: toX,
      targetY: toY,
      supply: 1,
      supplySum: 0,
      supplyCount: 0,
      counter: false,
    };
    this.offensives.push(offensive);
    list.push(offensive);
    return offensive.id;
  }

  /** Les pertes en mer dépendent de la distance et du rapport des marines. */
  private seaLoss(nation: number, enemy: number, seaCells: number): number {
    const own = this.navy[nation];
    const other = this.navy[enemy];
    const pressure = own + other > 0 ? (2 * other) / (own + other) : 1;
    const loss = (AMPHIBIOUS_BASE_LOSS + AMPHIBIOUS_LOSS_PER_CELL * seaCells) * pressure;
    return Math.max(AMPHIBIOUS_MIN_LOSS, Math.min(AMPHIBIOUS_MAX_LOSS, loss));
  }

  cancelOffensive(nation: number, id: number): void {
    const offensive = this.offensives.find((entry) => entry.id === id && entry.nation === nation);
    if (offensive) this.endOffensive(offensive);
  }

  /** Les forces restantes retournent en réserve. */
  private endOffensive(offensive: Offensive): void {
    this.reserve[offensive.nation] += offensive.force;
    offensive.force = 0;
    this.offensives.splice(this.offensives.indexOf(offensive), 1);
    const list = this.offensivesByNation[offensive.nation];
    list.splice(list.indexOf(offensive), 1);
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  step(): void {
    this.tick++;
    this.evolveSectors();
    // Les voisinages servent aux décisions de l'IA et à la diplomatie (alliances, coalitions).
    const phase = this.tick % ADJACENCY_INTERVAL_TICKS;
    if (phase === LAND_NEIGHBORS_TICK) this.refreshLandNeighbors();
    else if (phase === SEA_NEIGHBORS_TICK) {
      this.seaNeighbors = this.findSeaNeighbors();
      this.refreshCoastSeas();
    }
    if (this.aiEnabled) {
      if (this.tick % WAR_INTERVAL_TICKS === 0) this.decideWars();
      if (this.tick % AI_INTERVAL_TICKS === 0) {
        this.decideAllocations();
        this.decideOffensives();
        this.decideEfforts();
        this.decideBuilds();
      }
    }
    // La réserve de contre-attaque joue aussi pour le joueur : elle est automatique.
    if (this.tick % AI_INTERVAL_TICKS === 0) this.decideCounters();
    if (this.tick % DIPLOMACY_INTERVAL_TICKS === 0) this.decideDiplomacy();
    if (this.tick % ECONOMY_INTERVAL_TICKS === 0) this.updateEconomy();
    this.computeArmies();
    this.updateFronts();
    this.reinforce();
    this.updateOffensives();
    this.scanFrontier();
    this.applyFlips();
    if (this.tick % SUPPLY_PHASE_TICKS === 0) {
      const group = (this.tick / SUPPLY_PHASE_TICKS) % SUPPLY_GROUPS;
      if (this.supplyDirty & (1 << group)) this.updateSupply(group);
    }
    if (this.tick % CAPITULATION_INTERVAL_TICKS === CAPITULATION_TICK) this.checkCapitulations();
  }

  private evolveSectors(): void {
    const changes = Math.ceil(this.sectors.length * SECTOR_CHURN);
    for (let i = 0; i < changes; i++) {
      const sector = Math.floor(this.random() * this.sectors.length);
      this.sectors[sector] = (this.random() * 2 - 1) * SECTOR_NOISE;
    }
  }

  private decideAllocations(): void {
    const lengths = new Float64Array(this.stride);
    const opposing = new Float64Array(this.stride);
    for (const front of this.fronts) {
      lengths[front.a] += front.length;
      lengths[front.b] += front.length;
      if (front.length > 0) {
        opposing[front.a] += front.sides[1].force;
        opposing[front.b] += front.sides[0].force;
      }
    }
    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        if (nation === this.player) continue;
        const side = front.sides[s];
        const enemy = front.sides[1 - s];
        const army = this.armyOf(nation);
        const share = opposing[nation] > army * AI_ENGAGED_SHARE ? AI_OUTNUMBERED_SHARE : AI_ENGAGED_SHARE;
        side.allocation = lengths[nation] > 0 ? (share * front.length) / lengths[nation] : 0;
        const planned = army * side.allocation;
        side.stance = planned > enemy.force * AI_ATTACK_RATIO ? 'attack' : 'hold';
      }
    }
  }

  /** L'IA grandit en paix, s'arme en guerre, et jette tout dans la balance en sous-nombre. */
  private decideEfforts(): void {
    const opposing = new Float64Array(this.stride);
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
      opposing[front.a] += front.sides[1].force;
      opposing[front.b] += front.sides[0].force;
    }
    for (let n = 1; n < this.stride; n++) {
      if (n === this.player || !this.alive[n]) continue;
      let effort = AI_PEACE_EFFORT;
      if (atWar[n]) effort = opposing[n] > this.armies[n] * AI_ENGAGED_SHARE ? AI_DESPERATE_EFFORT : AI_WAR_EFFORT;
      this.effortTarget[n] = Math.max(0, Math.min(1, effort + this.temperament[n] + AI_PROFILES[this.profile[n]].effort));
      this.counterShare[n] = atWar[n] ? AI_COUNTER_SHARE : 0;
    }
  }

  private decideOffensives(): void {
    const attempted = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        const enemy = s === 0 ? front.b : front.a;
        if (nation === this.player || attempted[nation]) continue;
        attempted[nation] = 1;
        if (this.random() >= AI_OFFENSIVE_CHANCE) continue;
        if (this.offensivesByNation[nation].length >= AI_MAX_OFFENSIVES) continue;
        if (this.reserve[nation] < this.armyOf(nation) * AI_OFFENSIVE_MIN_RESERVE) continue;
        if (front.length === 0 || this.random() < AI_AMPHIBIOUS_CHANCE) this.launchAiAmphibious(nation, enemy);
        else this.launchAiOffensive(nation);
      }
    }
  }

  /** Part d'une cellule de front au hasard, vers une province ennemie de valeur à portée. */
  private launchAiOffensive(nation: number): void {
    if (this.frontierCount === 0) return;
    const { owners, width: W, height: H } = this;
    for (let attempt = 0; attempt < 24; attempt++) {
      const cell = this.frontier[Math.floor(this.random() * this.frontierCount)];
      if (owners[cell] !== nation) continue;
      // Pas d'offensive depuis une pointe déjà à bout de souffle.
      if (SUPPLY_LEVELS[this.supply[cell]] < AI_MIN_LAUNCH_SUPPLY) continue;
      const x = cell % W;
      const y = (cell - x) / W;
      const around = [
        owners[y * W + (x + 1) % W],
        owners[y * W + (x + W - 1) % W],
        y > 0 ? owners[cell - W] : 0,
        y < H - 1 ? owners[cell + W] : 0,
      ];
      const enemy = around.find((other) => other !== 0 && other !== nation && this.frontOf(nation, other));
      if (!enemy) continue;

      let best = -1;
      let bestScore = 0;
      for (let province = 1; province < this.controller.length; province++) {
        if (this.controller[province] !== enemy) continue;
        const data = this.provinces[province - 1];
        const distance = Math.hypot(this.wrapDelta(x, data.x), data.y - y);
        if (distance < AI_TARGET_MIN_DISTANCE || distance > AI_TARGET_MAX_DISTANCE) continue;
        const score = this.provinceValue[province] * (0.4 + this.random());
        if (score > bestScore) {
          bestScore = score;
          best = province;
        }
      }
      if (best < 0) continue;
      const target = this.provinces[best - 1];
      this.launchOffensive(nation, x, y, Math.floor(target.x), Math.floor(target.y), AI_OFFENSIVE_SHARE);
      return;
    }
  }

  // -------------------------------------------------------------------------
  // Mers et ports
  // -------------------------------------------------------------------------

  /** Ports nationaux d'une nation sur une mer, échantillonnés ; absent si elle ne la borde pas. */
  private portsOf(nation: number, sea: number): Int32Array | undefined {
    if (this.homePortsStale) this.refreshHomePorts();
    return this.homePorts.get(nation * (this.seaCount + 1) + sea);
  }

  /**
   * Les côtes du sol national de chaque pays, mer par mer. Seul le sol national compte, qu'il soit
   * occupé ou non : le résultat ne dépend que de provinceHome, sauvegardé avec la partie.
   */
  private refreshHomePorts(): void {
    const { coastCells, provinceGrid, provinceHome, seas, width: W, height: H } = this;
    const lists = new Map<number, number[]>();
    for (let k = 0; k < coastCells.length; k++) {
      const cell = coastCells[k];
      const nation = provinceHome[provinceGrid[cell]];
      if (nation === 0) continue;
      const x = cell % W;
      const y = (cell - x) / W;
      for (let j = 0; j < 4; j++) {
        if ((j === 2 && y === 0) || (j === 3 && y === H - 1)) continue;
        const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
        const sea = seas[next];
        if (sea === 0) continue;
        const key = nation * (this.seaCount + 1) + sea;
        let list = lists.get(key);
        if (!list) lists.set(key, (list = []));
        if (list[list.length - 1] !== cell) list.push(cell);
      }
    }
    this.homePorts.clear();
    for (const [key, list] of lists) {
      const step = Math.max(1, Math.ceil(list.length / MAX_SAMPLED_PORTS));
      const sample: number[] = [];
      for (let i = 0; i < list.length; i += step) sample.push(list[i]);
      this.homePorts.set(key, Int32Array.from(sample));
    }
    this.homePortsStale = false;
  }

  /**
   * Coût de transport d'un ravitaillement par mer jusqu'à `cell`, au-delà du coût fixe : la
   * distance au port national le plus proche sur cette mer. Infini sans port sur cette mer.
   */
  private seaSupplyCost(nation: number, sea: number, cell: number): number {
    const ports = this.portsOf(nation, sea);
    if (!ports) return Infinity;
    const W = this.width;
    const x = cell % W;
    const y = (cell - x) / W;
    let best = Infinity;
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const px = port % W;
      const dx = this.wrapDelta(x, px);
      const dy = (port - px) / W - y;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return Math.round(SEA_SUPPLY_PER_CELL * Math.sqrt(best) * SUPPLY_COST_SCALE);
  }

  /** Cherche sur sa côte le départ le plus proche d'une province ennemie, puis débarque. */
  private launchAiAmphibious(nation: number, enemy: number): void {
    if (this.navy[nation] <= 0) return;
    const held: number[] = [];
    for (let province = 1; province < this.controller.length; province++) {
      if (this.controller[province] === enemy) held.push(province);
    }
    if (held.length === 0) return;
    const target = this.provinces[held[Math.floor(this.random() * held.length)] - 1];
    const toX = Math.floor(target.x);
    const toY = Math.floor(target.y);
    if (this.owners[toY * this.width + toX] !== enemy) return;

    const own: number[] = [];
    for (let k = 0; k < this.coastCells.length; k++) {
      if (this.owners[this.coastCells[k]] === nation) own.push(this.coastCells[k]);
    }
    if (own.length === 0) return;
    let bestCell = -1;
    let bestSea = Infinity;
    for (let attempt = 0; attempt < 16; attempt++) {
      const cell = own[Math.floor(this.random() * own.length)];
      const x = cell % this.width;
      const y = (cell - x) / this.width;
      const route = traceRoute(this.owners, this.width, this.height, x, y, toX, toY, this.seas);
      if (!route.amphibious || route.seaCells >= bestSea) continue;
      if (landingProblem(route, this.owners, nation) !== '') continue;
      if (this.owners[route.landingY * this.width + route.landingX] !== enemy) continue;
      bestSea = route.seaCells;
      bestCell = cell;
    }
    if (bestCell < 0) return;
    const x = bestCell % this.width;
    this.launchOffensive(nation, x, (bestCell - x) / this.width, toX, toY, AI_OFFENSIVE_SHARE);
  }

  // -------------------------------------------------------------------------
  // Guerres décidées par l'IA
  // -------------------------------------------------------------------------

  private refreshNeighbors(): void {
    this.refreshLandNeighbors();
    this.seaNeighbors = this.findSeaNeighbors();
    this.refreshCoastSeas();
  }

  /** Les mers que borde chaque nation, d'après les côtes qu'elle tient. */
  private refreshCoastSeas(): void {
    const { coastCells, owners, seas, width: W, height: H } = this;
    const masks = new Uint32Array(this.stride);
    for (let k = 0; k < coastCells.length; k++) {
      const cell = coastCells[k];
      const owner = owners[cell];
      if (owner === 0) continue;
      const x = cell % W;
      const y = (cell - x) / W;
      for (let j = 0; j < 4; j++) {
        if ((j === 2 && y === 0) || (j === 3 && y === H - 1)) continue;
        const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
        const sea = seas[next];
        if (sea !== 0) masks[owner] |= 1 << ((sea - 1) % 31);
      }
    }
    this.coastSeas = masks;
  }

  private refreshLandNeighbors(): void {
    const land: number[][] = Array.from({ length: this.stride }, () => []);
    for (const [a, b] of findLandNeighbors(this.owners, this.width, this.height)) {
      land[a].push(b);
      land[b].push(a);
    }
    this.landNeighbors = land;
  }

  /**
   * Étend chaque côte sur la mer, à demi-résolution : deux nations dont les zones se
   * rencontrent à moins de SEA_NEIGHBOR_RADIUS cellules sont voisines par la mer.
   */
  private findSeaNeighbors(): number[][] {
    const w = this.width >> 1;
    const h = this.height >> 1;
    const labels = new Uint16Array(w * h);
    const depth = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        labels[y * w + x] = this.owners[y * 2 * this.width + x * 2];
      }
    }
    let tail = 0;
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== 0) queue[tail++] = i;
    }
    const seen = new Set<number>();
    const result: number[][] = Array.from({ length: this.stride }, () => []);
    const link = (a: number, b: number) => {
      if (a === b) return;
      const key = Math.min(a, b) * 65536 + Math.max(a, b);
      if (seen.has(key)) return;
      seen.add(key);
      result[a].push(b);
      result[b].push(a);
    };
    let head = 0;
    while (head < tail) {
      const cell = queue[head++];
      const owner = labels[cell];
      const x = cell % w;
      const y = (cell - x) / w;
      for (let j = 0; j < 4; j++) {
        let next: number;
        if (j === 0) next = y * w + (x + w - 1) % w;
        else if (j === 1) next = y * w + (x + 1) % w;
        else if (j === 2) {
          if (y === 0) continue;
          next = cell - w;
        } else {
          if (y === h - 1) continue;
          next = cell + w;
        }
        const other = labels[next];
        if (other === 0) {
          if (depth[cell] < SEA_NEIGHBOR_RADIUS) {
            labels[next] = owner;
            depth[next] = depth[cell] + 1;
            queue[tail++] = next;
          }
        } else if (other !== owner && (depth[cell] > 0 || depth[next] > 0)) {
          link(owner, other);
        }
      }
    }
    return result;
  }

  /**
   * Une nation en paix attaque parfois un voisin plus faible, par terre d'abord : une seule, tirée
   * selon son tempérament, à chaque passe. Les conquérants cherchent en plus la guerre à leur
   * propre rythme, dès qu'ils sont en paix.
   */
  private decideWars(): void {
    if (this.fronts.length >= Math.max(1, this.aliveCount * MAX_WAR_SHARE)) return;
    for (let n = 1; n < this.stride; n++) {
      if (n === this.player || !this.alive[n] || !AI_PROFILES[this.profile[n]].conqueror) continue;
      if (this.random() < CONQUEROR_WAR_CHANCE) this.tryWar(n);
    }
    if (this.random() >= WAR_CHANCE) return;
    const living: number[] = [];
    for (let n = 1; n < this.stride; n++) {
      if (this.alive[n] && n !== this.player) living.push(n);
    }
    if (living.length === 0) return;
    // Un pays belliqueux est tiré bien plus souvent qu'un commerçant.
    let total = 0;
    for (const n of living) total += AI_PROFILES[this.profile[n]].war;
    let roll = this.random() * total;
    let nation = living[living.length - 1];
    for (const n of living) {
      roll -= AI_PROFILES[this.profile[n]].war;
      if (roll < 0) {
        nation = n;
        break;
      }
    }
    this.tryWar(nation);
  }

  /** La nation déclare la guerre à un voisin qu'elle peut battre, s'il y en a un et qu'elle est en paix. */
  private tryWar(nation: number): void {
    const ratio = AI_PROFILES[this.profile[nation]].warRatio;
    if (this.fronts.some((front) => front.a === nation || front.b === nation)) return;

    // Un voisin occupé ailleurs, las ou à court d'hommes pèse moins : il devient une proie.
    const pick = (candidates: number[]) => {
      const weak = candidates.filter((other) => {
        if (!this.alive[other]) return false;
        if (this.isAllied(nation, other) || this.hasTruce(nation, other)) return false;
        if (other === this.player) {
          // Le joueur : seulement après son répit, pas deux guerres de suite, et à deux contre un au
          // moins, même pour un belliqueux ; un commerçant en exige davantage.
          if (this.tick < PLAYER_GRACE_TICKS || this.tick - this.lastWarOnPlayer < PLAYER_WAR_COOLDOWN_TICKS) return false;
          return this.capacity[nation] >= this.availableStrength(other) * PLAYER_WAR_RATIO * Math.max(1, ratio / WAR_CAPACITY_RATIO);
        }
        return this.capacity[nation] >= this.availableStrength(other) * ratio;
      });
      if (weak.length === 0) return 0;
      if (AI_PROFILES[this.profile[nation]].conqueror) {
        // Un conquérant vise la plus grosse proie qu'il peut battre.
        return weak.reduce((best, other) => (this.totalHome[other] > this.totalHome[best] ? other : best));
      }
      return weak[Math.floor(this.random() * weak.length)];
    };
    const land = pick(this.landNeighbors[nation]);
    const enemy = land !== 0 ? land : this.navy[nation] > 0 ? pick(this.seaNeighbors[nation]) : 0;
    if (enemy === 0) return;
    if (enemy === this.player) {
      // Un joueur pacifique est le plus souvent épargné.
      if (this.aggression[enemy] < PEACEFUL_AGGRESSION && this.random() < PEACEFUL_PLAYER_SPARED) return;
      this.lastWarOnPlayer = this.tick;
    }
    this.declareWars([[nation, enemy]]);
  }

  /**
   * Force qu'une nation peut opposer à un nouvel ennemi : sa capacité, moins ce qu'elle
   * engage déjà ailleurs, réduite si elle est lasse ou à court d'hommes. Un pays occupé sur un
   * autre front, ou épuisé, devient une proie, joueur compris.
   */
  availableStrength(nation: number): number {
    let engaged = 0;
    for (const front of this.fronts) {
      if (front.a === nation) engaged += front.sides[0].allocation;
      else if (front.b === nation) engaged += front.sides[1].allocation;
    }
    const free = Math.max(MIN_FREE_FORCE_SHARE, 1 - engaged);
    const morale = 1 - WEARY_STRENGTH * Math.max(0, 1 - this.stability[nation] / START_STABILITY);
    const men = this.manpowerMax[nation] > 0 ? this.manpower[nation] / this.manpowerMax[nation] : 1;
    const reserves = 1 - DRAINED_STRENGTH * (1 - men);
    return this.capacity[nation] * free * morale * reserves;
  }

  // -------------------------------------------------------------------------
  // Diplomatie
  // -------------------------------------------------------------------------

  isAllied(a: number, b: number): boolean {
    return this.allied[a * this.stride + b] !== 0;
  }

  hasTruce(a: number, b: number): boolean {
    return this.truceUntil[a * this.stride + b] > this.tick;
  }

  aggressionOf(nation: number): number {
    return this.aggression[nation];
  }

  alliesOf(nation: number): number[] {
    const allies: number[] = [];
    for (let n = 1; n < this.stride; n++) if (n !== nation && this.isAllied(nation, n)) allies.push(n);
    return allies;
  }

  private setAlliance(a: number, b: number, kind: number): void {
    this.allied[a * this.stride + b] = kind;
    this.allied[b * this.stride + a] = kind;
  }

  /** Un pays disparu n'a plus ni alliances, ni trêves, ni offres en cours. */
  private endDiplomacyOf(nation: number): void {
    for (let n = 1; n < this.stride; n++) {
      this.setAlliance(nation, n, 0);
      this.truceUntil[nation * this.stride + n] = 0;
      this.truceUntil[n * this.stride + nation] = 0;
    }
    this.coalitionAgainst[nation] = 0;
    this.aggression[nation] = 0;
    this.peaceOffers = this.peaceOffers.filter((offer) => offer.from !== nation && offer.to !== nation);
    for (const [a, b] of [...this.tradeDeals]) if (a === nation || b === nation) this.setTradeDeal(a, b, false);
    for (const [a, b] of [...this.embargoes]) if (a === nation || b === nation) this.setEmbargoFlag(a, b, false);
    if (this.axes.some((axis) => axis.nation === nation)) {
      this.axes = this.axes.filter((axis) => axis.nation !== nation);
      this.recomputeAxisBonus();
    }
  }

  /** L'IA veut-elle la paix avec cet ennemi ? Lasse, saignée, ou en train de perdre. */
  private aiWantsPeace(ai: number, enemy: number): boolean {
    const front = this.frontOf(ai, enemy);
    if (!front || this.tick - front.startTick < MIN_WAR_TICKS_FOR_PEACE) return false;
    const held = this.totalHome[ai] > 0 ? this.heldHome[ai] / this.totalHome[ai] : 1;
    const theirs = this.totalHome[enemy] > 0 ? this.heldHome[enemy] / this.totalHome[enemy] : 1;
    const tired = this.stability[ai] < AI_PEACE_STABILITY * AI_PROFILES[this.profile[ai]].peaceStability;
    const drained = this.manpowerMax[ai] > 0 && this.manpower[ai] / this.manpowerMax[ai] < AI_PEACE_MANPOWER;
    const winning = held >= AI_WINNING_HOME_SHARE && theirs < held;
    // Qui gagne refuse, sauf à bout de forces ; un conquérant, tant qu'il lui reste des hommes.
    if (winning && AI_PROFILES[this.profile[ai]].conqueror && !drained) return false;
    if (winning && !(tired && drained) && this.stability[ai] >= AI_PEACE_STABILITY * 0.6) return false;
    return tired || drained || held < theirs;
  }

  proposePeace(nation: number, enemy: number): boolean {
    if (!this.frontOf(nation, enemy)) return false;
    // Une IA décide ; une offre au joueur passe par answerPeace.
    if (enemy !== this.player && this.aiWantsPeace(enemy, nation)) {
      this.makePeace(nation, enemy);
      return true;
    }
    this.pendingEvents.push({ type: 'peaceRefused', tick: this.tick, from: nation, to: enemy });
    return false;
  }

  answerPeace(nation: number, enemy: number, accept: boolean): void {
    const offer = this.peaceOffers.find((entry) => entry.from === enemy && entry.to === nation);
    if (!offer) return;
    this.peaceOffers = this.peaceOffers.filter((entry) => entry !== offer);
    if (accept) this.makePeace(nation, enemy);
  }

  /**
   * Paix au statu quo : chaque province disputée entre les deux revient à qui en tient la
   * majorité (les cellules minoritaires suivent), puis une trêve d'un an. Un traité qui
   * cède des provinces rend le bénéficiaire plus agressif.
   */
  makePeace(a: number, b: number): void {
    const front = this.frontOf(a, b);
    if (!front) return;
    const { owners, provinceGrid, landCells } = this;
    const moved: number[] = [];
    this.peacefulTransfer = true;
    for (let k = 0; k < landCells.length; k++) {
      const cell = landCells[k];
      const owner = owners[cell];
      if (owner !== a && owner !== b) continue;
      const province = provinceGrid[cell];
      const home = this.provinceHome[province];
      const holder = this.controller[province];
      if ((home !== a && home !== b) || (holder !== a && holder !== b) || owner === holder) continue;
      owners[cell] = holder;
      this.pocket[cell] = 0;
      this.cellCounts[owner]--;
      this.cellCounts[holder]++;
      this.pendingCells.push(cell);
      this.pendingOwners.push(holder);
      this.transferProvinceCell(province, owner, holder);
      moved.push(cell);
    }
    this.peacefulTransfer = false;
    for (let p = 1; p < this.controller.length; p++) {
      const home = this.provinceHome[p];
      const holder = this.controller[p];
      if ((home !== a && home !== b) || (holder !== a && holder !== b) || home === holder) continue;
      this.aggression[holder] += (AGGRESSION_CESSION * this.provinceValue[p]) / Math.max(1e-6, this.totalHome[holder]);
      this.provinceHome[p] = holder;
      this.homePortsStale = true;
      this.consolidation[p] = 0;
      const kept = this.annexedValueOf(this.controller[p]);
      this.provinceValue[p] *= kept;
      this.provinceGdp[p] *= kept;
      this.provinceManpower[p] *= kept;
      this.pendingHomes.push(p, holder);
    }
    // Les forces du front rentrent ; les offensives de l'un chez l'autre s'arrêtent.
    for (const offensive of [...this.offensives]) {
      if (offensive.nation !== a && offensive.nation !== b) continue;
      const other = offensive.nation === a ? b : a;
      const y = Math.max(0, Math.min(this.height - 1, offensive.targetY));
      const target = this.owners[y * this.width + offensive.targetX];
      if (target === other || this.provinceHome[provinceGrid[y * this.width + offensive.targetX]] === other) this.endOffensive(offensive);
    }
    this.removeFront(front);
    this.truceUntil[a * this.stride + b] = this.tick + TRUCE_TICKS;
    this.truceUntil[b * this.stride + a] = this.tick + TRUCE_TICKS;
    this.peaceOffers = this.peaceOffers.filter((offer) => !((offer.from === a && offer.to === b) || (offer.from === b && offer.to === a)));
    this.recomputeCapacity();
    this.recomputeManpower();
    const involved = new Uint8Array(this.stride);
    involved[a] = 1;
    involved[b] = 1;
    for (let k = 0; k < landCells.length; k++) {
      if (involved[owners[landCells[k]]]) this.refreshFrontier(landCells[k]);
    }
    for (const cell of moved) this.refreshAround(cell);
    this.measureFronts();
    this.supplyDirty = ALL_SUPPLY_GROUPS;
    this.pendingEvents.push({ type: 'peace', tick: this.tick, a: Math.min(a, b), b: Math.max(a, b) });
  }

  /** Retire un front : ses forces rentrent en réserve. */
  private removeFront(front: Front): void {
    const { a, b } = front;
    this.reserve[a] += front.sides[0].force;
    this.reserve[b] += front.sides[1].force;
    this.frontIndex[a * this.stride + b] = -1;
    this.frontIndex[b * this.stride + a] = -1;
    this.advantage[a * this.stride + b] = -Infinity;
    this.advantage[b * this.stride + a] = -Infinity;
    this.fronts.splice(this.fronts.indexOf(front), 1);
    this.reindexFronts();
  }

  /**
   * L'IA signe un pacte de non-agression avec un pays peu agressif, s'il n'est pas pour elle
   * une proie (elle ne pourrait pas l'attaquer de toute façon), ou face à une menace commune :
   * un ennemi en commun, ou un voisin bien plus fort et agressif.
   */
  private aiAcceptsAlliance(ai: number, proposer: number): boolean {
    if (!this.alive[ai] || !this.alive[proposer] || this.isAllied(ai, proposer) || this.frontOf(ai, proposer)) return false;
    if (this.alliesOf(ai).length >= MAX_ALLIES) return false;
    if (this.aggression[proposer] >= ALLIANCE_MAX_AGGRESSION) return false;
    const ratio = proposer === this.player ? PLAYER_WAR_RATIO : WAR_CAPACITY_RATIO;
    if (this.capacity[ai] < this.capacity[proposer] * ratio) return true;
    for (const front of this.fronts) {
      const enemy = front.a === ai ? front.b : front.b === ai ? front.a : 0;
      if (enemy !== 0 && this.frontOf(proposer, enemy)) return true;
    }
    const neighbors = new Set([...this.landNeighbors[ai], ...this.seaNeighbors[ai]]);
    for (const other of neighbors) {
      if (other === proposer || !this.alive[other]) continue;
      const threatening = this.capacity[other] >= this.capacity[ai] * ALLIANCE_THREAT_RATIO;
      const hostile = this.aggression[other] >= ALLIANCE_THREAT_AGGRESSION || this.frontOf(ai, other) !== null;
      if (threatening && hostile) return true;
    }
    return false;
  }

  proposeAlliance(nation: number, other: number): boolean {
    if (nation === other || nation <= 0 || other <= 0 || nation >= this.stride || other >= this.stride) return false;
    if (this.alliesOf(nation).length < MAX_ALLIES && this.aiAcceptsAlliance(other, nation)) {
      this.setAlliance(nation, other, 1);
      this.pendingEvents.push({ type: 'alliance', tick: this.tick, a: Math.min(nation, other), b: Math.max(nation, other) });
      return true;
    }
    this.pendingEvents.push({ type: 'allianceRefused', tick: this.tick, from: nation, to: other });
    return false;
  }

  breakAlliance(nation: number, other: number): void {
    if (!this.isAllied(nation, other)) return;
    this.setAlliance(nation, other, 0);
    this.aggression[nation] += AGGRESSION_BETRAYAL;
    this.pendingEvents.push({ type: 'allianceBroken', tick: this.tick, a: nation, b: other });
  }

  /**
   * Toutes les 10 s de jeu : paix entre IA épuisées, offres de paix au joueur, coalitions
   * contre les pays trop agressifs, sécessions des pays à bout.
   */
  private decideDiplomacy(): void {
    // Offres expirées.
    this.peaceOffers = this.peaceOffers.filter((offer) => offer.until > this.tick && this.frontOf(offer.from, offer.to));
    // Un traité parcourt toute la terre : un seul entre IA par passe, les autres attendent.
    let treaties = 0;
    for (const front of [...this.fronts]) {
      const { a, b } = front;
      if (a === this.player || b === this.player) {
        // L'IA propose la paix au joueur ; c'est lui qui répond.
        const ai = a === this.player ? b : a;
        if (this.tick - front.startTick < AI_PEACE_OFFER_MIN_TICKS) continue;
        if (this.tick - this.lastPeaceOffer[ai] < AI_PEACE_OFFER_COOLDOWN_TICKS) continue;
        if (this.peaceOffers.some((offer) => offer.from === ai)) continue;
        if (this.aiWantsPeace(ai, this.player) && this.random() < AI_PEACE_OFFER_CHANCE) {
          this.lastPeaceOffer[ai] = this.tick;
          this.peaceOffers.push({ from: ai, to: this.player, until: this.tick + PEACE_OFFER_TICKS });
          this.pendingEvents.push({ type: 'peaceOffer', tick: this.tick, from: ai, to: this.player });
        }
      } else if (treaties === 0 && this.aiEnabled && this.aiWantsPeace(a, b) && this.aiWantsPeace(b, a)) {
        this.makePeace(a, b);
        treaties++;
      }
    }
    this.decideCoalitions();
    this.decideTrade();
    this.updateMovements();
  }

  /**
   * Une coalition ne vit que le temps de son soulèvement : un membre qui fait la paix avec son
   * ancien maître, ou dont l'ancien maître a disparu, la quitte.
   */
  private decideCoalitions(): void {
    for (let member = 1; member < this.stride; member++) {
      const target = this.coalitionAgainst[member];
      if (target === 0) continue;
      if (this.alive[member] && this.alive[target] && this.frontOf(member, target)) continue;
      this.coalitionAgainst[member] = 0;
      for (let other = 1; other < this.stride; other++) {
        if (this.allied[member * this.stride + other] === 2) this.setAlliance(member, other, 0);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Mouvements régionaux : agitation, demandes, indépendance, soulèvement
  // -------------------------------------------------------------------------

  /**
   * Qui réclame la province `p` à `holder` : son pays d'origine s'il a disparu ; sinon, si elle
   * est encore à son pays d'origine, sa région historique tant qu'elle n'est pas indépendante.
   * 0 : personne.
   */
  private claimantOf(p: number, holder = this.controller[p]): number {
    const origin = this.startHome[p];
    if (origin !== holder) return this.alive[origin] ? 0 : origin;
    const region = this.regionOf[p];
    return region !== 0 && !this.alive[region] ? region : 0;
  }

  /**
   * Chaque région annexée (un pays disparu dont le vainqueur tient les terres), et chaque région
   * historique encore à son pays, s'agite quand ce pays est instable, en guerre ou envahi, d'autant
   * plus que son identité est forte, et se calme quand il va bien. Elle demande d'abord des
   * investissements, puis l'indépendance sans combat ; chaque refus l'agite davantage. À
   * l'agitation maximale, elle se soulève, avec les régions agitées qui la touchent.
   */
  private updateMovements(): void {
    this.refreshProvincePolicies();
    // Revendications : valeur d'origine, par (pays qui tient, pays disparu ou région en sommeil).
    const claims = new Map<number, number>();
    // Équipement, pondéré par la valeur d'origine de chaque province de la région.
    const equipped = new Map<number, number>();
    const { buildings } = this;
    for (let p = 1; p < this.controller.length; p++) {
      const parent = this.controller[p];
      if (parent === 0) continue;
      const origin = this.claimantOf(p, parent);
      if (origin === 0) continue;
      const key = parent * this.stride + origin;
      claims.set(key, (claims.get(key) ?? 0) + this.startValue[p]);
      const levels =
        this.factories[p] +
        buildings.recruitment[p] +
        buildings.refinery[p] +
        buildings.steelworks[p] +
        buildings.shipyard[p] +
        2 * buildings.services[p] +
        // Un axe tracé à la main équipe la région ; le réseau automatique, gratuit, ne la calme pas.
        (this.autoTrade ? 0 : Math.min(AXIS_MAX_PER_PROVINCE, this.axisCount[p]));
      equipped.set(key, (equipped.get(key) ?? 0) + this.startValue[p] * Math.min(1, levels / CARE_FULL_LEVELS));
    }
    const claimed = new Map(claims);
    const shareOf = (key: number, parent: number) => (claims.get(key) ?? 0) / Math.max(1e-9, this.totalHome[parent]);
    // Les mouvements dont le pays a disparu, ou la région renaît, ou dont il reste trop peu, s'éteignent.
    const kept: MovementState[] = [];
    for (const movement of this.movements) {
      const key = movement.parent * this.stride + movement.origin;
      const share = shareOf(key, movement.parent);
      if (this.alive[movement.parent] && !this.alive[movement.origin] && share >= this.minShareOf(movement.origin)) {
        movement.share = share;
        kept.push(movement);
      }
      claims.delete(key);
    }
    for (const [key, claim] of claims) {
      const parent = Math.floor(key / this.stride);
      const origin = key % this.stride;
      const share = claim / Math.max(1e-9, this.totalHome[parent]);
      if (!this.alive[parent] || share < this.minShareOf(origin)) continue;
      kept.push({ parent, origin, unrest: 0, share, asked: 0, demand: '', until: 0, investing: false, invested: 0, refused: 0, care: 0, ceiling: 0 });
    }
    this.movements = kept;
    if (kept.length === 0) return;

    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }
    const weeks = DIPLOMACY_INTERVAL_TICKS / TICKS_PER_WEEK;
    for (const movement of kept) {
      const parent = movement.parent;
      const key = parent * this.stride + movement.origin;
      const buildingCare = (equipped.get(key) ?? 0) / Math.max(1e-9, claimed.get(key) ?? 0);
      movement.care = Math.min(1, buildingCare + INVESTMENT_CARE * (movement.invested ?? 0));
      const instability = Math.max(0, UNREST_STABILITY - this.stability[parent]);
      const lost = this.totalHome[parent] > 0 ? Math.max(0, 1 - this.heldHome[parent] / this.totalHome[parent]) : 0;
      movement.ceiling = Math.min(
        1,
        (1 - movement.care) *
          this.identity[movement.origin] *
          this.mods[parent].unrest *
          (UNREST_BASE +
            UNREST_INSTABILITY * instability +
            (atWar[parent] ? UNREST_WAR : 0) +
            UNREST_DEFEAT * lost +
            REFUSAL_CEILING * (movement.refused ?? 0) +
            this.policyUnrest(parent, movement.origin)),
      );
      movement.ceiling = Math.max(0, movement.ceiling);
      // Vers le plafond, à vitesse fixe ; des investissements en chantier l'empêchent de monter.
      const gap = movement.ceiling - movement.unrest;
      let step = Math.sign(gap) * Math.min(Math.abs(gap), UNREST_SPEED_PER_WEEK * weeks);
      if (movement.investing) step = Math.min(0, step);
      movement.unrest = Math.max(0, Math.min(1, movement.unrest + step));
      if (movement.demand !== '' && this.tick >= movement.until) this.resolveDemand(movement, movement.demand, false);
      if (movement.demand !== '') continue;
      if (movement.unrest < UNREST_CALM) {
        movement.asked = 0;
        movement.refused = 0;
      }
      // Le joueur reçoit ses demandes une à une, espacées : les autres régions attendent leur tour.
      if (movement.parent === this.player && !this.playerMayReceiveDemand()) continue;
      if (movement.asked < 1 && !movement.investing && movement.unrest >= DEMAND_INVESTMENT_AT) this.makeDemand(movement, 'investment');
      else if (movement.asked < 2 && movement.unrest >= DEMAND_INDEPENDENCE_AT) this.makeDemand(movement, 'independence');
    }
    // Un soulèvement par passe : il parcourt toute la terre.
    // Une région du joueur ne se soulève qu'après avoir demandé son indépendance : il est prévenu.
    const rebel = this.movements.find(
      (movement) => movement.demand === '' && movement.unrest >= REVOLT_AT && (movement.parent !== this.player || movement.asked >= 2),
    );
    if (rebel) this.revolt(rebel);
  }

  /** Un pays annexé doit peser un peu pour s'agiter ; une région historique, si petite soit-elle, s'agite. */
  private minShareOf(origin: number): number {
    return this.historicRegion[origin] ? 0 : SECESSION_MIN_SHARE;
  }

  /** La région demande ; l'IA répond aussitôt, le joueur a DEMAND_TICKS pour le faire. */
  private playerMayReceiveDemand(): boolean {
    if (!this.demandPacing) return true;
    if (this.tick < this.nextPlayerDemand) return false;
    return !this.movements.some((movement) => movement.parent === this.player && movement.demand !== '');
  }

  private makeDemand(movement: MovementState, kind: DemandKind): void {
    movement.asked = kind === 'investment' ? 1 : 2;
    if (movement.parent === this.player) {
      this.nextPlayerDemand = this.tick + PLAYER_DEMAND_COOLDOWN_TICKS;
      movement.demand = kind;
      movement.until = this.tick + DEMAND_TICKS;
      this.pendingEvents.push({ type: 'demand', tick: this.tick, parent: movement.parent, origin: movement.origin, kind });
      return;
    }
    const parent = movement.parent;
    const atWar = this.fronts.some((front) => front.a === parent || front.b === parent);
    // L'IA investit si elle n'est pas en guerre ; elle laisse partir une petite région, une région
    // historique de son propre sol seulement si la guerre l'y oblige.
    const historic = this.historicRegion[movement.origin] === 1;
    const small = movement.share < AI_INDEPENDENCE_MAX_SHARE;
    const accept = kind === 'investment' ? !atWar : small && (!historic || atWar);
    this.resolveDemand(movement, kind, accept);
  }

  // -------------------------------------------------------------------------
  // Politique régionale : impôts, levées, indépendance accordée
  // -------------------------------------------------------------------------

  regionPolicyOf(nation: number, origin: number): { tax: number; levy: number } {
    return this.regionPolicies.get(nation * this.stride + origin) ?? { tax: 0, levy: 0 };
  }

  setRegionPolicy(nation: number, origin: number, tax: number, levy: number): void {
    if (nation <= 0 || nation >= this.stride || origin <= 0 || origin >= this.stride || nation === origin) return;
    if (!Number.isFinite(tax) || !Number.isFinite(levy)) return;
    const clamp = (value: number) => Math.max(-REGION_POLICY_MAX, Math.min(REGION_POLICY_MAX, Math.round(value)));
    const policy = { tax: clamp(tax), levy: clamp(levy) };
    const key = nation * this.stride + origin;
    if (policy.tax === 0 && policy.levy === 0) this.regionPolicies.delete(key);
    else this.regionPolicies.set(key, policy);
    this.refreshProvincePolicies();
    this.recomputeCapacity();
    this.recomputeManpower();
  }

  /** Niveaux d'impôts et de levée de chaque province, d'après la région qu'elle forme chez qui la tient. */
  private refreshProvincePolicies(): void {
    const count = this.controller.length;
    if (this.provinceTax.length !== count) {
      this.provinceTax = new Float64Array(count);
      this.provinceLevy = new Float64Array(count);
    } else {
      this.provinceTax.fill(0);
      this.provinceLevy.fill(0);
    }
    if (this.regionPolicies.size === 0) return;
    for (let p = 1; p < count; p++) {
      const holder = this.controller[p];
      if (holder === 0) continue;
      const origin = this.claimantOf(p, holder);
      if (origin === 0) continue;
      const policy = this.regionPolicies.get(holder * this.stride + origin);
      if (!policy) continue;
      this.provinceTax[p] = policy.tax;
      this.provinceLevy[p] = policy.levy;
    }
  }

  private policyUnrest(nation: number, origin: number): number {
    const { tax, levy } = this.regionPolicyOf(nation, origin);
    return REGION_TAX_UNREST * tax + REGION_LEVY_UNREST * levy;
  }

  /** Poids des impôts et levées alourdis (ou allégés) d'un pays : la part de chaque région × ses niveaux. */
  private policyPressure(nation: number): number {
    if (this.regionPolicies.size === 0) return 0;
    let pressure = 0;
    for (const movement of this.movements) {
      if (movement.parent !== nation) continue;
      const { tax, levy } = this.regionPolicyOf(nation, movement.origin);
      pressure += movement.share * (tax + levy);
    }
    return pressure;
  }

  /** Rendre son indépendance à une région : elle renaît en paix, avec une trêve. */
  grantIndependence(nation: number, origin: number): void {
    if (nation <= 0 || nation >= this.stride || origin <= 0 || origin >= this.stride || nation === origin) return;
    if (!this.alive[nation] || this.alive[origin]) return;
    const movement = this.movements.find((entry) => entry.parent === nation && entry.origin === origin);
    if (movement) {
      this.movements = this.movements.filter((entry) => entry !== movement);
    } else {
      let held = false;
      for (let p = 1; p < this.controller.length && !held; p++) held = this.controller[p] === nation && this.claimantOf(p, nation) === origin;
      if (!held) return;
    }
    this.regionPolicies.delete(nation * this.stride + origin);
    this.revive(origin, nation, true);
    this.refreshProvincePolicies();
  }

  answerDemand(nation: number, origin: number, accept: boolean): void {
    const movement = this.movements.find((entry) => entry.parent === nation && entry.origin === origin && entry.demand !== '');
    if (!movement) return;
    this.resolveDemand(movement, movement.demand as DemandKind, accept);
  }

  private resolveDemand(movement: MovementState, kind: DemandKind, accept: boolean): void {
    movement.demand = '';
    movement.until = 0;
    if (!accept) {
      movement.unrest = Math.min(1, movement.unrest + REFUSAL_UNREST);
      movement.refused = (movement.refused ?? 0) + 1;
      return;
    }
    const parent = movement.parent;
    if (kind === 'investment') {
      // Le chantier passe en tête de file ; ce qui était commencé y reste acquis.
      const cost = Math.max(50, Math.round(this.constructionRate[parent] * INVESTMENT_WEEKS));
      this.queues[parent].unshift({ province: 0, kind: 'investment', region: movement.origin, cost });
      movement.investing = true;
      movement.unrest = Math.max(0, movement.unrest - INVESTMENT_CALM);
      return;
    }
    this.movements = this.movements.filter((entry) => entry !== movement);
    this.revive(movement.origin, parent, true);
  }

  /** Investissements achevés : la région se calme, et sa valeur et son PIB remontent. */
  private completeInvestment(parent: number, region: number): void {
    const movement = this.movements.find((entry) => entry.parent === parent && entry.origin === region);
    if (movement) {
      movement.investing = false;
      movement.invested = (movement.invested ?? 0) + 1;
      movement.unrest = Math.max(0, movement.unrest - INVESTMENT_DONE_CALM);
    }
    for (let p = 1; p < this.controller.length; p++) {
      if (this.controller[p] !== parent || this.claimantOf(p) !== region) continue;
      this.provinceValue[p] = Math.min(this.startValue[p], this.provinceValue[p] + INVESTMENT_BOOST * this.startValue[p]);
      this.provinceGdp[p] = Math.min(this.startGdp[p], this.provinceGdp[p] + INVESTMENT_BOOST * this.startGdp[p]);
    }
  }

  /** Les investissements ne valent que tant que la région s'agite encore dans ce pays. */
  private investmentValid(parent: number, region: number): boolean {
    return this.movements.some((entry) => entry.parent === parent && entry.origin === region && entry.investing);
  }

  /** La région se soulève, avec les régions agitées qui la touchent de proche en proche. */
  private revolt(first: MovementState): void {
    const parent = first.parent;
    const candidates = new Map<number, number>();
    for (const movement of this.movements) {
      if (movement.parent === parent && movement !== first && movement.demand === '' && movement.unrest >= REBEL_JOIN_UNREST) {
        candidates.set(movement.origin, movement.share);
      }
    }
    this.revive(first.origin, parent);
    const members = [first.origin];
    while (members.length < MAX_REBEL_COALITION) {
      const next = this.touchingClaimant(parent, members, candidates);
      if (next === 0) break;
      this.revive(next, parent);
      members.push(next);
    }
    this.movements = this.movements.filter((movement) => !(movement.parent === parent && members.includes(movement.origin)));
    if (members.length > 1) {
      for (const member of members) {
        this.coalitionAgainst[member] = parent;
        for (const other of members) if (other !== member && !this.isAllied(member, other)) this.setAlliance(member, other, 2);
      }
      this.pendingEvents.push({ type: 'coalition', tick: this.tick, target: parent, members: [...members] });
    }
  }

  /**
   * La région candidate la plus lourde parmi celles dont une cellule encore tenue par `parent`
   * touche une cellule d'un des `members` : la coalition rebelle reste d'un seul tenant.
   */
  private touchingClaimant(parent: number, members: number[], candidates: Map<number, number>): number {
    const { owners, provinceGrid, landCells, width, height } = this;
    const touching = new Uint8Array(this.stride);
    const inGroup = new Uint8Array(this.stride);
    for (const member of members) inGroup[member] = 1;
    for (let k = 0; k < landCells.length; k++) {
      const cell = landCells[k];
      if (owners[cell] !== parent) continue;
      const origin = this.claimantOf(provinceGrid[cell], parent);
      if (origin === 0 || touching[origin] || origin === this.player) continue;
      const x = cell % width;
      const y = (cell - x) / width;
      if (
        (x > 0 && inGroup[owners[cell - 1]]) ||
        (x < width - 1 && inGroup[owners[cell + 1]]) ||
        (y > 0 && inGroup[owners[cell - width]]) ||
        (y < height - 1 && inGroup[owners[cell + width]])
      ) {
        touching[origin] = 1;
      }
    }
    let best = 0;
    for (let n = 1; n < this.stride; n++) {
      const share = candidates.get(n);
      if (!touching[n] || share === undefined) continue;
      if (share > (best ? candidates.get(best)! : 0)) best = n;
    }
    return best;
  }

  /**
   * Le pays renaît sur ses provinces d'origine tenues par l'ancien vainqueur. Soulevé, il lui
   * déclare la guerre ; indépendant par accord (`peaceful`), il signe une trêve.
   */
  private revive(rebel: number, parent: number, peaceful = false): void {
    const { owners, provinceGrid, landCells } = this;
    // Les provinces qu'il réclame, figées avant que les cellules changent de mains.
    const claim = new Uint16Array(this.controller.length);
    for (let p = 1; p < claim.length; p++) claim[p] = this.claimantOf(p, parent);
    const moved: number[] = [];
    this.peacefulTransfer = true;
    for (let k = 0; k < landCells.length; k++) {
      const cell = landCells[k];
      if (owners[cell] !== parent || claim[provinceGrid[cell]] !== rebel) continue;
      owners[cell] = rebel;
      this.pocket[cell] = 0;
      if (this.forts[cell] !== 0) this.setFort(cell, 0);
      this.cellCounts[parent]--;
      this.cellCounts[rebel]++;
      this.pendingCells.push(cell);
      this.pendingOwners.push(rebel);
      this.transferProvinceCell(provinceGrid[cell], parent, rebel);
      moved.push(cell);
    }
    this.peacefulTransfer = false;
    if (moved.length === 0) return;
    for (let p = 1; p < this.controller.length; p++) {
      if (claim[p] !== rebel || this.controller[p] !== rebel) continue;
      this.provinceHome[p] = rebel;
      this.homePortsStale = true;
      this.provinceValue[p] = this.startValue[p];
      this.provinceGdp[p] = this.startGdp[p];
      this.provinceManpower[p] = this.startManpower[p];
      this.consolidation[p] = 0;
      this.pendingHomes.push(p, rebel);
    }
    this.alive[rebel] = 1;
    this.stability[rebel] = REBEL_STABILITY;
    this.effort[rebel] = REBEL_EFFORT;
    this.effortTarget[rebel] = REBEL_EFFORT;
    this.queues[rebel] = [];
    this.navy[rebel] = this.hasCoast[rebel] ? baseNavy(this.nationGdp[rebel - 1]) * 0.5 : 0;
    this.labelCells[rebel] = 0;
    this.recomputeCapacity();
    this.recomputeManpower();
    this.reserve[rebel] = this.capacity[rebel] * REBEL_MOBILIZATION;
    this.manpower[rebel] = this.manpowerMax[rebel] * 0.5;
    this.armyAfterReinforce[rebel] = -1;
    // La sécession soulage un peu le pays qui la subit.
    this.stability[parent] = Math.min(1, this.stability[parent] + 0.05);
    for (const cell of moved) this.refreshAround(cell);
    this.supplyDirty = ALL_SUPPLY_GROUPS;
    if (peaceful) {
      this.truceUntil[rebel * this.stride + parent] = this.tick + TRUCE_TICKS;
      this.truceUntil[parent * this.stride + rebel] = this.tick + TRUCE_TICKS;
      this.pendingEvents.push({ type: 'independence', tick: this.tick, parent, rebel });
      return;
    }
    this.pendingEvents.push({ type: 'secession', tick: this.tick, parent, rebel });
    this.declareWars([[rebel, parent]], false);
  }

  // -------------------------------------------------------------------------
  // Capitulation et annexion
  // -------------------------------------------------------------------------

  private checkCapitulations(): void {
    if (this.fronts.length === 0) return;
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }
    for (let n = 1; n < this.stride; n++) {
      // Une nation instable capitule plus tôt.
      const unrest = (UNREST_CAPITULATION * Math.max(0, START_STABILITY - this.stability[n])) / START_STABILITY;
      if (atWar[n] && this.alive[n] && this.heldHome[n] < this.totalHome[n] * (CAPITULATION_SHARE + unrest)) {
        this.capitulate(n);
      }
    }
  }

  /** Le vainqueur est l'ennemi qui tient la plus grande part du territoire du vaincu. */
  private capitulate(loser: number): void {
    const tally = new Float64Array(this.stride);
    for (let p = 1; p < this.controller.length; p++) {
      if (this.provinceHome[p] === loser && this.controller[p] !== loser && this.frontOf(loser, this.controller[p])) {
        tally[this.controller[p]] += this.provinceValue[p];
      }
    }
    let winner = 0;
    for (let n = 1; n < this.stride; n++) {
      if (tally[n] > (winner ? tally[winner] : 0)) winner = n;
    }
    if (winner === 0) return;
    // Annexer rend agressif, d'autant plus que le vaincu pèse lourd face au vainqueur.
    const annexedShare = this.totalHome[loser] / Math.max(1e-6, this.totalHome[winner]);
    this.aggression[winner] += Math.max(MIN_AGGRESSION_ANNEX, AGGRESSION_ANNEX * Math.min(1, annexedShare));

    // Tout ce qu'il reste au vaincu, îles comprises, revient au vainqueur.
    const transferred: number[] = [];
    this.peacefulTransfer = true;
    for (let k = 0; k < this.landCells.length; k++) {
      const cell = this.landCells[k];
      if (this.owners[cell] !== loser) continue;
      transferred.push(cell);
      this.owners[cell] = winner;
      this.pocket[cell] = 0;
      this.cellCounts[loser]--;
      this.cellCounts[winner]++;
      this.pendingCells.push(cell);
      this.pendingOwners.push(winner);
      this.transferProvinceCell(this.provinceGrid[cell], loser, winner);
    }
    this.peacefulTransfer = false;

    for (let p = 1; p < this.controller.length; p++) {
      if (this.provinceHome[p] !== loser) continue;
      if (this.controller[p] === loser) {
        this.controller[p] = winner;
        this.pendingProvinces.push(p, winner);
      }
      this.provinceHome[p] = this.controller[p];
      this.homePortsStale = true;
      this.consolidation[p] = 0;
      const kept = this.annexedValueOf(this.controller[p]);
      this.provinceValue[p] *= kept;
      this.provinceGdp[p] *= kept;
      this.provinceManpower[p] *= kept;
      this.pendingHomes.push(p, this.controller[p]);
    }

    this.navy[winner] += this.navy[loser] * ANNEXED_NAVY;
    this.navy[loser] = 0;
    this.stability[winner] = Math.min(1, this.stability[winner] + VICTORY_STABILITY);
    this.queues[loser] = [];
    this.manpower[loser] = 0;
    this.alive[loser] = 0;
    this.endDiplomacyOf(loser);
    for (const offensive of [...this.offensivesByNation[loser]]) this.endOffensive(offensive);
    this.reserve[loser] = 0;
    this.removeFrontsOf(loser);
    this.recomputeCapacity();
    this.recomputeManpower();
    // Peut quitter la frontière : ce qui y était. Peut y entrer : ce qui vient de changer de main.
    const previous = this.frontier.slice(0, this.frontierCount);
    for (let i = 0; i < previous.length; i++) this.refreshFrontier(previous[i]);
    for (const cell of transferred) this.refreshAround(cell);
    this.measureFronts();
    this.supplyDirty = ALL_SUPPLY_GROUPS;
    this.pendingEvents.push({ type: 'capitulation', tick: this.tick, loser, winner });
  }

  /** Les forces des nations encore en guerre ailleurs regagnent leur réserve. */
  private removeFrontsOf(loser: number): void {
    const kept: Front[] = [];
    for (const front of this.fronts) {
      const { a, b } = front;
      this.frontIndex[a * this.stride + b] = -1;
      this.frontIndex[b * this.stride + a] = -1;
      if (a === loser || b === loser) {
        this.advantage[a * this.stride + b] = -Infinity;
        this.advantage[b * this.stride + a] = -Infinity;
        const other = a === loser ? b : a;
        this.reserve[other] += front.sides[a === loser ? 1 : 0].force;
      } else {
        kept.push(front);
      }
    }
    this.fronts = kept;
    this.reindexFronts();
  }

  private reindexFronts(): void {
    this.fronts.forEach((front, index) => {
      this.frontIndex[front.a * this.stride + front.b] = index;
      this.frontIndex[front.b * this.stride + front.a] = index;
    });
  }

  /**
   * Capacité militaire et PIB courant. Une province rapporte selon son développement ;
   * occupée, presque rien à l'occupant, et une part à son pays d'origine. L'effort de
   * guerre multiplie ensuite la capacité. La capitulation, elle, ne regarde que la valeur
   * de départ du territoire : bâtir ou détruire ne la rapproche pas.
   */
  private recomputeCapacity(): void {
    const { capacity, output, development, provinceGdp, rawCapacity } = this;
    rawCapacity.fill(0);
    output.fill(0);
    this.heldHome.fill(0);
    this.totalHome.fill(0);
    for (let p = 1; p < this.controller.length; p++) {
      const value = this.provinceValue[p];
      const home = this.provinceHome[p];
      const holder = this.controller[p];
      const taxed = holder === home && this.provinceTax.length > p ? 1 + REGION_TAX_STEP * this.provinceTax[p] : 1;
      const developed = development[p] * (1 + FACTORY_BONUS * this.factories[p]) * (1 + this.axisBonus[p] * this.mods[holder].axisBonus) * taxed;
      this.totalHome[home] += value;
      if (holder === home) {
        this.heldHome[home] += value;
        rawCapacity[home] += value * developed;
        output[home] += provinceGdp[p] * developed;
      } else {
        // Tant qu'elle n'est pas consolidée, une province occupée coûte une garnison.
        const garrison = GARRISON_COST * (1 - this.consolidation[p]);
        rawCapacity[holder] += value * developed * (OCCUPIED_VALUE - garrison);
        output[holder] += provinceGdp[p] * developed * OCCUPIED_VALUE;
        rawCapacity[home] += value * developed * LOST_PROVINCE_RETAINED;
        output[home] += provinceGdp[p] * developed * LOST_PROVINCE_RETAINED;
      }
    }
    for (let n = 1; n < this.stride; n++) {
      output[n] *= this.tradeFactor[n];
      rawCapacity[n] = Math.max(0, rawCapacity[n] * (EFFORT_CAPACITY_BASE + this.effort[n]) * this.tradeFactor[n] * this.mods[n].capacity);
      // Sans pétrole, une armée ne roule pas.
      capacity[n] = rawCapacity[n] * (OIL_SHORTAGE_FLOOR + (1 - OIL_SHORTAGE_FLOOR) * this.oilCoverage[n]);
    }
    this.capacityDirty = false;
  }

  /** Réservoir maximal : les hommes des provinces nationales tenues, et un peu des occupées. */
  private recomputeManpower(): void {
    const { manpowerMax } = this;
    manpowerMax.fill(0);
    for (let p = 1; p < this.controller.length; p++) {
      const holder = this.controller[p];
      const levied = holder === this.provinceHome[p] && this.provinceLevy.length > p ? 1 + REGION_LEVY_STEP * this.provinceLevy[p] : 1;
      const recruited = (1 + RECRUITMENT_BONUS * this.buildings.recruitment[p]) * levied;
      manpowerMax[holder] += this.provinceManpower[p] * recruited * (holder === this.provinceHome[p] ? 1 : OCCUPIED_MANPOWER);
    }
    for (let n = 1; n < this.stride; n++) manpowerMax[n] *= this.mods[n].manpower;
  }

  /**
   * Couverture des besoins en pétrole et en acier : production des gisements tenus, plus
   * ce qui s'importe. Un pays sans côte, ou soumis au blocus d'une marine bien plus forte,
   * n'importe que par la terre.
   */
  private updateResources(): void {
    const oil = new Float64Array(this.stride);
    const steel = new Float64Array(this.stride);
    const oilNeed = new Float64Array(this.stride);
    const steelNeed = new Float64Array(this.stride);
    for (let p = 1; p < this.controller.length; p++) {
      if (this.provinceOil[p] === 0 && this.provinceSteel[p] === 0) continue;
      const holder = this.controller[p];
      const share = (holder === this.provinceHome[p] ? 1 : OCCUPIED_RESOURCES) * this.mods[holder].resources;
      oil[holder] += this.provinceOil[p] * share * (1 + REFINERY_BONUS * this.buildings.refinery[p]);
      steel[holder] += this.provinceSteel[p] * share * (1 + STEELWORKS_BONUS * this.buildings.steelworks[p]);
    }
    const strongestEnemyNavy = new Float64Array(this.stride);
    for (const front of this.fronts) {
      strongestEnemyNavy[front.a] = Math.max(strongestEnemyNavy[front.a], this.navy[front.b]);
      strongestEnemyNavy[front.b] = Math.max(strongestEnemyNavy[front.b], this.navy[front.a]);
    }
    for (let n = 1; n < this.stride; n++) {
      const enemyNavy = strongestEnemyNavy[n];
      this.blockaded[n] = this.hasCoast[n] && enemyNavy > 0 && enemyNavy >= BLOCKADE_RATIO * this.navy[n] ? 1 : 0;
      oilNeed[n] = this.rawCapacity[n] * this.oilPerCapacity * this.mods[n].oilNeed;
      steelNeed[n] = this.output[n] * this.steelPerOutput * this.mods[n].steelNeed;
    }
    this.updateTrade();
    for (let n = 1; n < this.stride; n++) {
      // Un pays importe d'autant plus qu'il commerce avec ses partenaires possibles, et chaque
      // accord avec un pays qui a du pétrole ou de l'acier à revendre en apporte encore.
      const base = ((this.hasCoast[n] && !this.blockaded[n] ? SEA_IMPORT_SHARE : LAND_IMPORT_SHARE) + this.mods[n].imports) * this.tradeAccess[n];
      let oilDeals = 0;
      let steelDeals = 0;
      for (const [a, b] of this.tradeDeals) {
        const partner = a === n ? b : b === n ? a : 0;
        if (partner === 0 || !this.tradesWith(n, partner)) continue;
        if (oil[partner] > oilNeed[partner]) oilDeals++;
        if (steel[partner] > steelNeed[partner]) steelDeals++;
      }
      const oilImports = base + TRADE_DEAL_RESOURCES * oilDeals;
      const steelImports = base + TRADE_DEAL_RESOURCES * steelDeals;
      this.oilCoverage[n] = oilNeed[n] > 0 ? Math.min(1, oil[n] / oilNeed[n] + oilImports) : 1;
      this.steelCoverage[n] = steelNeed[n] > 0 ? Math.min(1, steel[n] / steelNeed[n] + steelImports) : 1;
    }
  }

  // -------------------------------------------------------------------------
  // Commerce : partenaires, accords, embargos, axes
  // -------------------------------------------------------------------------

  /** Deux pays peuvent-ils commercer, par la terre ou par une mer qu'ils bordent tous deux ? */
  private connected(a: number, b: number): boolean {
    return (this.coastSeas[a] & this.coastSeas[b]) !== 0 || this.landNeighbors[a].includes(b);
  }

  /** Commercent-ils en ce moment : ni guerre, ni embargo, ni blocus sur la route maritime ? */
  tradesWith(a: number, b: number, byLand = this.landNeighbors[a].includes(b)): boolean {
    if (!this.alive[a] || !this.alive[b] || a === b) return false;
    if (this.embargo[a * this.stride + b] || this.embargo[b * this.stride + a]) return false;
    if (this.frontOf(a, b)) return false;
    if (byLand) return true;
    return (this.coastSeas[a] & this.coastSeas[b]) !== 0 && !this.blockaded[a] && !this.blockaded[b];
  }

  /**
   * Accès au commerce de chaque nation : part, pondérée par le PIB, de ses partenaires possibles
   * avec qui elle commerce encore. Il fixe le multiplicateur de PIB et de capacité, auquel les
   * accords ajoutent leur gain.
   */
  private updateTrade(): void {
    const { stride, output } = this;
    const byLand = new Uint8Array(stride);
    const dealGain = new Float64Array(stride);
    for (const [a, b] of this.tradeDeals) {
      if (!this.tradesWith(a, b)) continue;
      dealGain[a] += TRADE_DEAL_GAIN * Math.min(1, Math.max(0, output[b]) / Math.max(1, output[a]));
      dealGain[b] += TRADE_DEAL_GAIN * Math.min(1, Math.max(0, output[a]) / Math.max(1, output[b]));
    }
    for (let n = 1; n < stride; n++) {
      if (!this.alive[n] || !this.tradeEnabled) {
        this.tradeAccess[n] = 1;
        this.tradeFactor[n] = 1;
        continue;
      }
      for (const m of this.landNeighbors[n]) byLand[m] = 1;
      let potential = 0;
      let trading = 0;
      for (let m = 1; m < stride; m++) {
        if (m === n || !this.alive[m]) continue;
        const land = byLand[m] === 1;
        if (!land && (this.coastSeas[n] & this.coastSeas[m]) === 0) continue;
        const weight = Math.max(0, output[m]);
        potential += weight;
        if (this.tradesWith(n, m, land)) trading += weight;
      }
      for (const m of this.landNeighbors[n]) byLand[m] = 0;
      this.tradeAccess[n] = potential > 0 ? trading / potential : 1;
      const mods = this.mods[n];
      this.tradeFactor[n] =
        1 - TRADE_DEPENDENCE * mods.tradeDependence * (1 - this.tradeAccess[n]) + Math.min(TRADE_DEAL_CAP * mods.dealGain, dealGain[n] * mods.dealGain);
    }
  }

  dealsOf(nation: number): number[] {
    const partners: number[] = [];
    for (const [a, b] of this.tradeDeals) if (a === nation) partners.push(b);
    else if (b === nation) partners.push(a);
    return partners;
  }

  hasTradeDeal(a: number, b: number): boolean {
    return this.tradeDeal[a * this.stride + b] === 1;
  }

  hasEmbargo(from: number, to: number): boolean {
    return this.embargo[from * this.stride + to] === 1;
  }

  tradeAccessOf(nation: number): number {
    return this.tradeAccess[nation];
  }

  /** Part de leur valeur que gardent les provinces annexées par une nation. */
  private annexedValueOf(nation: number): number {
    return nation === this.player || nation === 0 ? ANNEXED_VALUE : AI_PROFILES[this.profile[nation]].annexedValue;
  }

  profileOf(nation: number): number {
    return this.profile[nation];
  }

  tradeFactorOf(nation: number): number {
    return this.tradeFactor[nation];
  }

  private setTradeDeal(a: number, b: number, on: boolean): void {
    const value = on ? 1 : 0;
    if (this.tradeDeal[a * this.stride + b] === value) return;
    this.tradeDeal[a * this.stride + b] = value;
    this.tradeDeal[b * this.stride + a] = value;
    if (on) {
      this.tradeDeals.push([Math.min(a, b), Math.max(a, b)]);
      this.buildDealRoute(Math.min(a, b), Math.max(a, b));
    } else {
      this.tradeDeals = this.tradeDeals.filter(([x, y]) => !(x === Math.min(a, b) && y === Math.max(a, b)));
      const before = this.axes.length;
      this.axes = this.axes.filter((axis) => !(axis.partner && ((axis.nation === a && axis.partner === b) || (axis.nation === b && axis.partner === a))));
      if (this.axes.length !== before) this.axesVersion++;
    }
  }

  /** Capitale approchée d'un pays : sa province nationale la plus riche qu'il tient encore. */
  private capitalOf(nation: number): number {
    let best = 0;
    for (let p = 1; p < this.controller.length; p++) {
      if (this.controller[p] !== nation || this.provinceHome[p] !== nation) continue;
      if (best === 0 || this.provinceGdp[p] > this.provinceGdp[best]) best = p;
    }
    return best;
  }

  /**
   * Un accord commercial se voit : une route relie les deux capitales, par les terres des deux pays
   * (ou par la mer), en reprenant les tronçons déjà tracés.
   */
  private buildDealRoute(a: number, b: number): void {
    const from = this.capitalOf(a);
    const to = this.capitalOf(b);
    if (from === 0 || to === 0) return;
    const plan = this.planAxis(a, from, to);
    if (!plan) return;
    this.axes.push({ id: this.nextAxisId++, nation: a, sea: plan.sea, provinces: plan.path, length: plan.length + plan.seaLength, active: true, partner: b, seaLinks: plan.seaLinks });
    this.axesVersion++;
  }

  private setEmbargoFlag(from: number, to: number, on: boolean): void {
    const value = on ? 1 : 0;
    if (this.embargo[from * this.stride + to] === value) return;
    this.embargo[from * this.stride + to] = value;
    if (on) this.embargoes.push([from, to]);
    else this.embargoes = this.embargoes.filter(([x, y]) => !(x === from && y === to));
  }

  /**
   * L'IA signe un accord commercial avec un pays avec qui elle commerce, s'il n'est pas trop
   * agressif et qu'il lui reste de la place.
   */
  private aiAcceptsTradeDeal(ai: number, proposer: number): boolean {
    if (!this.alive[ai] || !this.alive[proposer] || ai === proposer || this.hasTradeDeal(ai, proposer)) return false;
    if (this.dealsOf(ai).length >= MAX_TRADE_DEALS || this.dealsOf(proposer).length >= MAX_TRADE_DEALS) return false;
    if (this.aggression[proposer] >= ALLIANCE_MAX_AGGRESSION) return false;
    return this.connected(ai, proposer) && this.tradesWith(ai, proposer);
  }

  proposeTradeDeal(nation: number, other: number): boolean {
    if (nation === other || nation <= 0 || other <= 0 || nation >= this.stride || other >= this.stride) return false;
    if (this.aiAcceptsTradeDeal(other, nation)) {
      this.setTradeDeal(nation, other, true);
      this.pendingEvents.push({ type: 'tradeDeal', tick: this.tick, a: Math.min(nation, other), b: Math.max(nation, other) });
      this.capacityDirty = true;
      return true;
    }
    this.pendingEvents.push({ type: 'tradeDealRefused', tick: this.tick, from: nation, to: other });
    return false;
  }

  endTradeDeal(nation: number, other: number): void {
    if (!this.hasTradeDeal(nation, other)) return;
    this.setTradeDeal(nation, other, false);
    this.pendingEvents.push({ type: 'tradeDealEnded', tick: this.tick, a: nation, b: other });
  }

  /** Un embargo rompt l'accord commercial, et coupe le commerce dans les deux sens. */
  setEmbargo(nation: number, other: number, on: boolean): void {
    if (nation === other || nation <= 0 || other <= 0 || nation >= this.stride || other >= this.stride) return;
    if (this.hasEmbargo(nation, other) === on) return;
    if (on && this.hasTradeDeal(nation, other)) this.setTradeDeal(nation, other, false);
    this.setEmbargoFlag(nation, other, on);
    this.pendingEvents.push({ type: on ? 'embargo' : 'embargoLifted', tick: this.tick, from: nation, to: other });
  }

  /**
   * Diplomatie commerciale : les accords rompus par une guerre ou un embargo, les embargos de
   * l'IA contre ses voisins trop agressifs, et un accord de plus entre IA de temps à autre.
   */
  private decideTrade(): void {
    for (const [a, b] of [...this.tradeDeals]) {
      if (this.alive[a] && this.alive[b] && !this.frontOf(a, b) && !this.hasEmbargo(a, b) && !this.hasEmbargo(b, a)) continue;
      this.setTradeDeal(a, b, false);
      this.pendingEvents.push({ type: 'tradeDealEnded', tick: this.tick, a, b });
    }
    if (!this.aiEnabled) return;
    // Chacun selon son tempérament : un commerçant sanctionne vite, un belliqueux jamais.
    const embargoAt = (n: number) => EMBARGO_AGGRESSION + AI_PROFILES[this.profile[n]].embargoAt - AI_PROFILES[0].embargoAt;
    for (const [from, to] of [...this.embargoes]) {
      if (from !== this.player && this.aggression[to] < embargoAt(from) - (EMBARGO_AGGRESSION - EMBARGO_LIFT_AGGRESSION)) this.setEmbargo(from, to, false);
    }
    for (let n = 1; n < this.stride; n++) {
      if (n === this.player || !this.alive[n]) continue;
      for (const m of [...this.landNeighbors[n], ...this.seaNeighbors[n]]) {
        if (this.alive[m] && this.aggression[m] >= embargoAt(n) && !this.hasEmbargo(n, m)) this.setEmbargo(n, m, true);
      }
    }
    if (this.random() >= AI_TRADE_DEAL_CHANCE) return;
    const candidates: number[] = [];
    let weights = 0;
    for (let n = 1; n < this.stride; n++) {
      if (n === this.player || !this.alive[n] || this.dealsOf(n).length >= MAX_TRADE_DEALS) continue;
      candidates.push(n);
      weights += AI_PROFILES[this.profile[n]].trade;
    }
    if (candidates.length === 0) return;
    // Un commerçant propose bien plus souvent qu'un belliqueux.
    let roll = this.random() * weights;
    let proposer = candidates[candidates.length - 1];
    for (const n of candidates) {
      roll -= AI_PROFILES[this.profile[n]].trade;
      if (roll < 0) {
        proposer = n;
        break;
      }
    }
    // Le partenaire le plus riche qui accepte, parmi ses voisins par la terre et par la mer.
    let best = 0;
    for (const m of new Set([...this.landNeighbors[proposer], ...this.seaNeighbors[proposer]])) {
      if (m === this.player || !this.aiAcceptsTradeDeal(m, proposer)) continue;
      if (best === 0 || this.output[m] > this.output[best]) best = m;
    }
    if (best !== 0) this.proposeTradeDeal(proposer, best);
  }

  /** Axes d'une nation, bâtis ou en chantier. */
  axesOf(nation: number): number {
    return this.axes.filter((axis) => axis.nation === nation && !axis.partner).length + this.queues[nation].filter((order) => order.kind === 'axis').length;
  }

  get tradeAxes(): readonly TradeAxis[] {
    return this.axes;
  }

  /**
   * Un axe peut traverser les provinces de son pays, et celles d'un partenaire commercial avec qui
   * il commerce : c'est une route internationale, qui enrichit les provinces des deux pays.
   */
  private axisAllows(nation: number, holder: number): boolean {
    return holder === nation || (holder !== 0 && this.hasTradeDeal(nation, holder) && this.tradesWith(nation, holder));
  }

  /** Distance, en cellules, entre les centres de deux provinces. */
  private provinceDistance(a: number, b: number): number {
    const pa = this.provinces[a - 1];
    const pb = this.provinces[b - 1];
    return Math.hypot(this.wrapDelta(pa.x, pb.x), pa.y - pb.y);
  }

  /** Provinces voisines par la terre, calculées à la première demande. */
  private provinceNeighborsOf(province: number): number[] {
    if (!this.provinceNeighbors) {
      const { provinceGrid, width: W, height: H } = this;
      const lists: number[][] = Array.from({ length: this.controller.length }, () => []);
      const seen = new Set<number>();
      const link = (a: number, b: number) => {
        if (a === 0 || b === 0 || a === b) return;
        const key = Math.min(a, b) * 65536 + Math.max(a, b);
        if (seen.has(key)) return;
        seen.add(key);
        lists[a].push(b);
        lists[b].push(a);
      };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cell = y * W + x;
          link(provinceGrid[cell], provinceGrid[y * W + ((x + 1) % W)]);
          if (y + 1 < H) link(provinceGrid[cell], provinceGrid[cell + W]);
        }
      }
      this.provinceNeighbors = lists;
    }
    return this.provinceNeighbors[province];
  }

  /**
   * Tracé d'un axe, de ville en ville : le plus court chemin entre les centres des provinces, par
   * des provinces que la nation tient. Faute de chemin par la terre, une ligne maritime entre deux
   * provinces côtières.
   */
  /** Mers que borde chaque province : la géographie ne change pas, on la calcule une fois. */
  private seasOfProvinces(): Uint32Array {
    if (!this.provinceSeas) {
      const { coastCells, provinceGrid, seas, width: W, height: H } = this;
      const masks = new Uint32Array(this.controller.length);
      for (let k = 0; k < coastCells.length; k++) {
        const cell = coastCells[k];
        const province = provinceGrid[cell];
        if (province === 0) continue;
        const x = cell % W;
        const y = (cell - x) / W;
        for (let j = 0; j < 4; j++) {
          if ((j === 2 && y === 0) || (j === 3 && y === H - 1)) continue;
          const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
          const sea = seas[next];
          if (sea !== 0) masks[province] |= 1 << ((sea - 1) % 31);
        }
      }
      this.provinceSeas = masks;
    }
    return this.provinceSeas;
  }

  planAxis(
    nation: number,
    from: number,
    to: number,
  ): { path: number[]; sea: boolean; length: number; seaLinks: number[]; seaLength: number } | null {
    const count = this.controller.length;
    if (from <= 0 || to <= 0 || from >= count || to >= count || from === to) return null;
    if (this.controller[from] !== nation || !this.axisAllows(nation, this.controller[to])) return null;
    // Routes déjà tracées, les siennes en chantier comprises, et celles des autres pays (partenaires,
    // routes d'accords) : le nouveau tracé les reprend volontiers, et les routes se rejoignent.
    const built = new Set<number>();
    const linkKey = (a: number, b: number) => Math.min(a, b) * 65536 + Math.max(a, b);
    const routes = [
      ...this.axes.map((axis) => ({ path: axis.provinces, sea: this.seaLinksOf(axis) })),
      ...this.queues[nation].filter((order) => order.kind === 'axis').map((order) => ({ path: order.path ?? [], sea: this.seaLinksOf(order) })),
    ];
    for (const { path, sea } of routes) for (let i = 0; i + 1 < path.length; i++) if (!sea.includes(i)) built.add(linkKey(path[i], path[i + 1]));
    // Ports possibles : les provinces côtières qu'elle peut traverser, avec les mers qu'elles bordent.
    const seasOf = this.seasOfProvinces();
    const ports: number[] = [];
    for (let p = 1; p < count; p++) if (seasOf[p] !== 0 && this.axisAllows(nation, this.controller[p])) ports.push(p);
    const bySea = new Set<number>();
    // Dijkstra sur les provinces tenues : elles sont au plus quelques centaines par nation.
    const distance = new Map<number, number>([[from, 0]]);
    const previous = new Map<number, number>();
    const done = new Set<number>();
    while (true) {
      let current = 0;
      let best = Infinity;
      for (const [p, d] of distance) if (!done.has(p) && d < best) [current, best] = [p, d];
      if (current === 0 || current === to || best > MAX_AXIS_CELLS) break;
      done.add(current);
      for (const next of this.provinceNeighborsOf(current)) {
        if (done.has(next) || !this.axisAllows(nation, this.controller[next])) continue;
        const d = best + this.provinceDistance(current, next) * (built.has(linkKey(current, next)) ? AXIS_REUSE_WEIGHT : 1);
        if (d < (distance.get(next) ?? Infinity)) {
          distance.set(next, d);
          previous.set(next, current);
          bySea.delete(next);
        }
      }
      // Par la mer, d'un port à un autre qui borde la même mer.
      const mask = seasOf[current];
      if (mask === 0) continue;
      for (const next of ports) {
        if (next === current || done.has(next) || (seasOf[next] & mask) === 0) continue;
        const crossing = this.provinceDistance(current, next);
        if (crossing > SEA_LINK_MAX) continue;
        const d = best + crossing + SEA_LINK_PENALTY;
        if (d < (distance.get(next) ?? Infinity)) {
          distance.set(next, d);
          previous.set(next, current);
          bySea.add(next);
        }
      }
    }
    if (distance.has(to) && distance.get(to)! <= MAX_AXIS_CELLS) {
      const path = [to];
      while (path[path.length - 1] !== from) path.push(previous.get(path[path.length - 1])!);
      path.reverse();
      // Seuls les tronçons nouveaux se paient ; une traversée se paie au tarif de la mer.
      let length = 0;
      let seaLength = 0;
      const seaLinks: number[] = [];
      for (let i = 0; i + 1 < path.length; i++) {
        if (bySea.has(path[i + 1])) {
          seaLinks.push(i);
          seaLength += this.provinceDistance(path[i], path[i + 1]);
        } else if (!built.has(linkKey(path[i], path[i + 1]))) length += this.provinceDistance(path[i], path[i + 1]);
      }
      return { path, sea: seaLinks.length > 0, length, seaLinks, seaLength };
    }
    // Dernier recours : une ligne directe entre deux ports lointains d'une même mer.
    if (!this.provinceCoastal[from] || !this.provinceCoastal[to] || (seasOf[from] & seasOf[to]) === 0) return null;
    const crossing = this.provinceDistance(from, to);
    return { path: [from, to], sea: true, length: 0, seaLinks: [0], seaLength: crossing };
  }

  /** Tronçons d'un axe pris par la mer ; une ancienne ligne maritime l'est tout entière. */
  private seaLinksOf(route: { sea?: boolean; seaLinks?: number[]; provinces?: number[]; path?: number[] }): number[] {
    if (route.seaLinks) return route.seaLinks;
    if (!route.sea) return [];
    const length = (route.provinces ?? route.path ?? []).length;
    return Array.from({ length: Math.max(0, length - 1) }, (_, i) => i);
  }

  /** Met un axe en chantier entre les provinces de deux cellules ; renvoie sa longueur (0 : impossible). */
  buildAxis(nation: number, fromX: number, fromY: number, toX: number, toY: number): number {
    const { width: W, height: H } = this;
    const cellOf = (x: number, y: number) => {
      const cx = Math.round(x);
      const cy = Math.round(y);
      return Number.isFinite(cx) && Number.isFinite(cy) && cy >= 0 && cy < H ? this.provinceGrid[cy * W + (((cx % W) + W) % W)] : 0;
    };
    return this.buildAxisBetween(nation, cellOf(fromX, fromY), cellOf(toX, toY));
  }

  /**
   * Terminus du réseau commercial d'une nation : les villes où ne passe qu'un seul tronçon de ses
   * axes (en chantier compris), une route d'accord non comprise. `extra` : un tracé envisagé.
   */
  axisTerminals(nation: number, extra: number[] = []): number {
    const paths = [
      ...this.axes.filter((axis) => axis.nation === nation && !axis.partner).map((axis) => axis.provinces),
      ...this.queues[nation].filter((order) => order.kind === 'axis').map((order) => order.path ?? []),
      extra,
    ];
    const links = new Set<number>();
    const degree = new Map<number, number>();
    for (const path of paths) {
      for (let i = 0; i + 1 < path.length; i++) {
        const [a, b] = [path[i], path[i + 1]];
        if (a === b) continue;
        const key = Math.min(a, b) * 65536 + Math.max(a, b);
        if (links.has(key)) continue;
        links.add(key);
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
      }
    }
    let terminals = 0;
    for (const value of degree.values()) if (value === 1) terminals++;
    return terminals;
  }

  buildAxisBetween(nation: number, from: number, to: number): number {
    if (nation <= 0 || nation >= this.stride || !this.alive[nation]) return 0;
    if (this.autoTrade) return 0;
    if (this.axesOf(nation) >= MAX_AXES) return 0;
    const plan = this.planAxis(nation, from, to);
    if (!plan) return 0;
    const terminals = this.axisTerminals(nation, plan.path);
    if (terminals > MAX_AXIS_TERMINALS && terminals > this.axisTerminals(nation)) {
      if (nation === this.player) this.pendingEvents.push({ type: 'axisRefused', tick: this.tick, nation, terminals });
      return 0;
    }
    this.queues[nation].push({ province: from, kind: 'axis', path: plan.path, sea: plan.sea, length: plan.length, seaLinks: plan.seaLinks, seaLength: plan.seaLength });
    return Math.max(1, Math.round(plan.length + plan.seaLength));
  }

  removeAxis(nation: number, id: number): void {
    const before = this.axes.length;
    this.axes = this.axes.filter((axis) => !(axis.id === id && axis.nation === nation));
    if (this.axes.length === before) return;
    this.axesVersion++;
    this.recomputeAxisBonus();
  }

  private completeAxis(nation: number, order: BuildOrder): void {
    const provinces = (order.path ?? []).slice();
    const seaLinks = this.seaLinksOf(order);
    this.axes.push({ id: this.nextAxisId++, nation, sea: seaLinks.length > 0, provinces, length: (order.length ?? 0) + (order.seaLength ?? 0), active: true, seaLinks });
    this.axesVersion++;
    this.pendingEvents.push({ type: 'axisBuilt', tick: this.tick, nation });
    this.recomputeAxisBonus();
    this.refreshAxes();
  }

  /**
   * Un axe est coupé dès qu'une province de son tracé n'est plus à son pays ni à un partenaire
   * commercial (une ligne maritime : un de ses ports, ou sous blocus) ; il revit quand tout est repris,
   * ou l'accord rétabli.
   */
  private refreshAxes(): void {
    let changed = false;
    for (const axis of this.axes) {
      let by = 0;
      const lost = axis.provinces.find((p) => !this.axisAllows(axis.nation, this.controller[p]));
      if (lost !== undefined) by = this.controller[lost] || -1;
      else if (axis.sea && this.blockaded[axis.nation]) by = -1;
      const active = by === 0;
      if (active === axis.active) continue;
      axis.active = active;
      changed = true;
      if (axis.partner || axis.auto) continue;
      this.pendingEvents.push(
        active ? { type: 'axisRestored', tick: this.tick, nation: axis.nation } : { type: 'axisCut', tick: this.tick, nation: axis.nation, by: Math.max(0, by) },
      );
    }
    if (changed) {
      this.axesVersion++;
      this.recomputeAxisBonus();
    }
  }

  private recomputeAxisBonus(): void {
    this.axisCount.fill(0);
    if (this.autoTrade) {
      // Un département traversé par une route active gagne AXIS_BONUS ; une ville principale, HUB_BONUS.
      for (const axis of this.axes) {
        if (!axis.active || axis.partner) continue;
        for (const p of axis.provinces) this.axisCount[p] = 1;
      }
      for (const network of this.networks) {
        for (const p of network?.principal ?? []) if (this.axisCount[p] > 0) this.axisCount[p] = 2;
      }
      for (let p = 1; p < this.axisBonus.length; p++) this.axisBonus[p] = this.axisCount[p] === 2 ? HUB_BONUS : this.axisCount[p] === 1 ? AUTO_TRANSIT_BONUS : 0;
      this.capacityDirty = true;
      return;
    }
    for (const axis of this.axes) {
      if (!axis.active || axis.partner) continue;
      for (const p of axis.provinces) if (this.axisCount[p] < 255) this.axisCount[p]++;
    }
    for (let p = 1; p < this.axisBonus.length; p++) this.axisBonus[p] = AXIS_BONUS * Math.min(AXIS_MAX_PER_PROVINCE, this.axisCount[p]);
    this.capacityDirty = true;
  }

  // -------------------------------------------------------------------------
  // Réseau commercial automatique
  // -------------------------------------------------------------------------

  /** Richesse d'un département pour le choix des villes principales (sans le bonus du réseau). */
  private hubWealth(p: number): number {
    return this.provinceGdp[p] * this.development[p] * (1 + FACTORY_BONUS * this.factories[p]);
  }

  /** Villes principales permises : la base, le territoire, la recherche (axe Échanges). */
  hubCapacityOf(nation: number): { base: number; territory: number; research: number; total: number } {
    let held = 0;
    for (let p = 1; p < this.controller.length; p++) if (this.controller[p] === nation && this.provinceHome[p] === nation) held++;
    const territory = Math.min(AUTO_HUBS_TERRITORY_MAX, Math.floor(held / AUTO_HUBS_PER_PROVINCES));
    const research = AUTO_HUBS_PER_RESEARCH * this.research[nation * DOCTRINE_AXIS_COUNT + 3];
    return { base: AUTO_HUBS_BASE, territory, research, total: AUTO_HUBS_BASE + territory + research };
  }

  networkOf(nation: number): NetworkState {
    return this.networks[nation] ?? { hubs: [], principal: [], capacity: 0 };
  }

  /** Faut-il redessiner le réseau : capacité changée, ville perdue, route coupée, ou un département qui détrône une ville principale. */
  private networkNeedsRebuild(nation: number): boolean {
    const network = this.networks[nation];
    if (!network) return true;
    if (network.capacity !== this.hubCapacityOf(nation).total) return true;
    if (network.principal.some((p) => this.controller[p] !== nation)) return true;
    const own = this.axes.filter((axis) => axis.auto && axis.nation === nation);
    if (own.some((axis) => !axis.active)) return true;
    if (network.hubs.length === 0) return false;
    const onNetwork = new Set(own.flatMap((axis) => axis.provinces));
    for (const p of network.hubs) onNetwork.add(p);
    const weakest = Math.min(...network.hubs.map((p) => this.hubWealth(p)));
    for (let p = 1; p < this.controller.length; p++) {
      if (this.controller[p] !== nation || this.provinceHome[p] !== nation || onNetwork.has(p)) continue;
      if (this.hubWealth(p) > weakest * HUB_SWAP_MARGIN) return true;
    }
    return false;
  }

  /**
   * Redessine le réseau d'une nation : du département le plus riche au moins riche, chacun relié au
   * plus riche par le plus court chemin (qui reprend volontiers les routes tracées). Un département
   * déjà traversé est sauté, mais compte comme ville principale.
   */
  private rebuildNetwork(nation: number): void {
    const before = this.networks[nation]?.hubs ?? [];
    this.axes = this.axes.filter((axis) => !(axis.auto && axis.nation === nation));
    const capacity = this.hubCapacityOf(nation).total;
    const hubs: number[] = [];
    const principal: number[] = [];
    if (this.alive[nation]) {
      const candidates: number[] = [];
      for (let p = 1; p < this.controller.length; p++) if (this.controller[p] === nation && this.provinceHome[p] === nation) candidates.push(p);
      candidates.sort((a, b) => this.hubWealth(b) - this.hubWealth(a) || a - b);
      const onNetwork = new Set<number>();
      const root = candidates[0];
      if (root !== undefined) {
        hubs.push(root);
        principal.push(root);
        onNetwork.add(root);
      }
      for (let i = 1; i < candidates.length && hubs.length < capacity; i++) {
        const p = candidates[i];
        if (onNetwork.has(p)) {
          principal.push(p);
          continue;
        }
        const plan = this.planAxis(nation, p, root);
        if (!plan) continue;
        this.axes.push({ id: this.nextAxisId++, nation, sea: plan.sea, provinces: plan.path, length: plan.length + plan.seaLength, active: true, seaLinks: plan.seaLinks, auto: true });
        for (const q of plan.path) onNetwork.add(q);
        hubs.push(p);
        principal.push(p);
      }
    }
    this.networks[nation] = { hubs, principal, capacity };
    this.axesVersion++;
    if (nation === this.player) {
      const added = hubs.filter((p) => !before.includes(p));
      const removed = before.filter((p) => !hubs.includes(p));
      if (before.length > 0 && (added.length > 0 || removed.length > 0)) {
        this.pendingEvents.push({ type: 'networkChanged', tick: this.tick, nation, added, removed });
      }
    }
  }

  /** Une passe d'économie sur NETWORK_CHECK_GROUPS : chaque pays vérifie son réseau à tour de rôle. */
  private updateNetworks(): void {
    if (!this.autoTrade) return;
    const phase = this.networkPhase;
    this.networkPhase = (phase + 1) % NETWORK_CHECK_GROUPS;
    let changed = false;
    for (let n = 1 + phase; n < this.stride; n += NETWORK_CHECK_GROUPS) {
      if (!this.alive[n]) {
        if (this.networks[n] && this.axes.some((axis) => axis.auto && axis.nation === n)) {
          this.axes = this.axes.filter((axis) => !(axis.auto && axis.nation === n));
          this.networks[n] = { hubs: [], principal: [], capacity: 0 };
          changed = true;
        }
        continue;
      }
      if (!this.networkNeedsRebuild(n)) continue;
      this.rebuildNetwork(n);
      changed = true;
    }
    if (changed) {
      this.axesVersion++;
      this.recomputeAxisBonus();
    }
  }

  /** L'IA trace, en paix, un axe entre deux de ses provinces riches et éloignées. */
  private aiPlanAxis(nation: number, provinces: number[]): boolean {
    const own = provinces
      .filter((p) => this.provinceHome[p] === nation)
      .sort((a, b) => this.provinceGdp[b] - this.provinceGdp[a] || a - b)
      .slice(0, 8);
    if (own.length < 2) return false;
    const linked = new Set(this.axes.filter((axis) => axis.nation === nation).flatMap((axis) => [axis.provinces[0], axis.provinces[axis.provinces.length - 1]]));
    for (let i = 0; i < own.length; i++) {
      for (let j = i + 1; j < own.length; j++) {
        const [a, b] = [own[i], own[j]];
        if (linked.has(a) && linked.has(b)) continue;
        if (this.provinceDistance(a, b) < AI_AXIS_MIN_DISTANCE) continue;
        if (this.buildAxisBetween(nation, a, b) > 0) return true;
      }
    }
    return false;
  }

  /**
   * Chaque seconde : l'économie se reconvertit vers l'effort voulu, puis les provinces
   * tenues par leur pays grandissent (effort bas) ou s'usent (effort haut).
   */
  private updateEconomy(): void {
    this.updateDoctrines();
    const { effort, effortTarget, development, provinceGdp } = this;
    const step = (EFFORT_CHANGE_PER_SECOND * ECONOMY_INTERVAL_TICKS) / TICKS_PER_SECOND;
    for (let n = 1; n < this.stride; n++) {
      // Un pays las de la guerre ne suit plus un effort trop lourd.
      const gap = Math.min(effortTarget[n], this.effortCap(n)) - effort[n];
      effort[n] += Math.max(-step, Math.min(step, gap));
    }
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }
    const minutes = ECONOMY_INTERVAL_TICKS / TICKS_PER_SECOND / 60;
    const rate = new Float64Array(this.stride);
    for (let n = 1; n < this.stride; n++) {
      rate[n] = 2 * GROWTH_PER_MINUTE * (DEFAULT_WAR_EFFORT - effort[n]) * minutes;
      if (rate[n] > 0 && atWar[n]) rate[n] *= AT_WAR_GROWTH;
      if (rate[n] > 0) rate[n] *= this.steelFactor(n);
    }
    const gained = new Float64Array(this.stride);
    const base = new Float64Array(this.stride);
    for (let p = 1; p < this.controller.length; p++) {
      const holder = this.controller[p];
      if (holder !== this.provinceHome[p] || rate[holder] === 0) continue;
      const before = development[p];
      // Croissance et usure ralentissent à l'approche de leurs bornes.
      const room = rate[holder] > 0 ? (MAX_DEVELOPMENT - before) / (MAX_DEVELOPMENT - 1) : (before - MIN_DEVELOPMENT) / (1 - MIN_DEVELOPMENT);
      const after = before + rate[holder] * Math.max(0, Math.min(1, room));
      development[p] = after;
      gained[holder] += provinceGdp[p] * (after - before);
      base[holder] += provinceGdp[p] * before;
    }
    for (let n = 1; n < this.stride; n++) this.growth[n] = base[n] > 0 ? gained[n] / base[n] / minutes : 0;
    this.recomputeCapacity();

    // L'occupant répare peu à peu les voies des provinces qu'il tient.
    const consolidating = ECONOMY_INTERVAL_TICKS / TICKS_PER_SECOND / CONSOLIDATION_SECONDS;
    for (let p = 1; p < this.controller.length; p++) {
      if (this.controller[p] === this.provinceHome[p] || this.consolidation[p] >= 1) continue;
      this.consolidation[p] = Math.min(1, this.consolidation[p] + consolidating * this.mods[this.controller[p]].consolidation);
      this.supplyDirty = ALL_SUPPLY_GROUPS;
    }

    this.updateResources();
    this.refreshAxes();
    this.updateNetworks();
    this.recomputeCapacity();
    this.recomputeManpower();
    // Niveau moyen des services publics sur le sol national tenu, pondéré par la valeur.
    const services = new Float64Array(this.stride);
    const weight = new Float64Array(this.stride);
    for (let p = 1; p < this.controller.length; p++) {
      const home = this.provinceHome[p];
      if (this.controller[p] !== home) continue;
      services[home] += this.buildings.services[p] * this.provinceValue[p];
      weight[home] += this.provinceValue[p];
    }
    for (let n = 1; n < this.stride; n++) services[n] = weight[n] > 0 ? services[n] / weight[n] : 0;
    for (let n = 1; n < this.stride; n++) {
      this.aggression[n] = Math.max(0, this.aggression[n] - AGGRESSION_DECAY_PER_WEEK * minutes);
      if (!this.alive[n]) continue;
      // Le réservoir se reconstitue lentement.
      this.manpower[n] = Math.min(this.manpowerMax[n], this.manpower[n] + this.manpowerMax[n] * MANPOWER_REGEN_PER_MINUTE * minutes);
      this.updateStability(n, atWar[n] === 1, minutes, services[n]);
      // Alourdir impôts et levées use la stabilité ; les alléger la rétablit.
      const pressure = this.policyPressure(n);
      if (pressure !== 0) this.stability[n] = Math.max(0, Math.min(1, this.stability[n] - REGION_POLICY_STABILITY * pressure * minutes));
      this.advanceConstruction(n, minutes);
    }
  }

  // -------------------------------------------------------------------------
  // Doctrines et recherche (jalon 10)
  // -------------------------------------------------------------------------

  doctrineOf(nation: number): number[] {
    return Array.from(this.doctrine.subarray(nation * DOCTRINE_AXIS_COUNT, (nation + 1) * DOCTRINE_AXIS_COUNT));
  }

  researchOf(nation: number, axis: number): number {
    return this.research[nation * DOCTRINE_AXIS_COUNT + axis];
  }

  /** Borne que la recherche permet sur un axe, des deux côtés. */
  reachOf(nation: number, axis: number): number {
    return DOCTRINE_REACH[this.research[nation * DOCTRINE_AXIS_COUNT + axis]];
  }

  setDoctrine(nation: number, axis: number, value: number): void {
    if (nation <= 0 || nation >= this.stride || !Number.isInteger(axis) || axis < 0 || axis >= DOCTRINE_AXIS_COUNT) return;
    if (!Number.isFinite(value)) return;
    this.doctrineTarget[nation * DOCTRINE_AXIS_COUNT + axis] = Math.max(-1, Math.min(1, value));
  }

  /** Met en file la recherche du niveau suivant d'un axe, s'il en reste un. */
  queueResearch(nation: number, axis: number): boolean {
    if (nation <= 0 || nation >= this.stride || !this.alive[nation]) return false;
    if (!Number.isInteger(axis) || axis < 0 || axis >= DOCTRINE_AXIS_COUNT) return false;
    const queue = this.queues[nation];
    const queued = queue.filter((order) => order.kind === 'research' && order.axis === axis).length;
    const level = this.research[nation * DOCTRINE_AXIS_COUNT + axis] + queued;
    if (level >= MAX_RESEARCH_LEVEL) return false;
    queue.push({ province: 0, kind: 'research', axis, cost: RESEARCH_COST * (level + 1) });
    return true;
  }

  private completeResearch(nation: number, axis: number): void {
    const index = nation * DOCTRINE_AXIS_COUNT + axis;
    if (this.research[index] >= MAX_RESEARCH_LEVEL) return;
    this.research[index]++;
    if (nation === this.player) this.pendingEvents.push({ type: 'researchDone', tick: this.tick, nation, axis, level: this.research[index] });
  }

  /**
   * Chaque doctrine glisse vers sa cible, dans les bornes de sa recherche : moitié moins vite en
   * guerre, où l'armée se réforme sous le feu.
   */
  private updateDoctrines(): void {
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }
    const weeks = ECONOMY_INTERVAL_TICKS / TICKS_PER_WEEK;
    for (let n = 1; n < this.stride; n++) {
      if (!this.alive[n]) continue;
      const step = DOCTRINE_SPEED_PER_WEEK * weeks * (atWar[n] ? DOCTRINE_WAR_SPEED : 1);
      let moved = false;
      for (let axis = 0; axis < DOCTRINE_AXIS_COUNT; axis++) {
        const index = n * DOCTRINE_AXIS_COUNT + axis;
        const reach = DOCTRINE_REACH[this.research[index]];
        const target = Math.max(-reach, Math.min(reach, this.doctrineTarget[index]));
        const gap = target - this.doctrine[index];
        if (gap === 0) continue;
        this.doctrine[index] += Math.sign(gap) * Math.min(Math.abs(gap), step);
        moved = true;
      }
      if (!moved) continue;
      this.mods[n] = doctrineModifiers(this.doctrineOf(n));
      if (n === this.player) {
        const archetype = archetypeOf(this.doctrineOf(n));
        if (archetype !== this.playerArchetype) {
          this.playerArchetype = archetype;
          this.pendingEvents.push({ type: 'doctrineNamed', tick: this.tick, nation: n, archetype });
        }
      }
    }
  }

  /** L'IA recherche l'axe où sa doctrine visée dépasse le plus ses bornes. */
  private aiResearch(nation: number): boolean {
    if (this.queues[nation].some((order) => order.kind === 'research')) return false;
    let best = -1;
    let bestGap = 0.05;
    for (let axis = 0; axis < DOCTRINE_AXIS_COUNT; axis++) {
      const index = nation * DOCTRINE_AXIS_COUNT + axis;
      if (this.research[index] >= MAX_RESEARCH_LEVEL) continue;
      const gap = Math.abs(this.doctrineTarget[index]) - DOCTRINE_REACH[this.research[index]];
      if (gap > bestGap) {
        bestGap = gap;
        best = axis;
      }
    }
    return best >= 0 && this.queueResearch(nation, best);
  }

  /** Effort de guerre que la stabilité permet encore : tout, tant qu'elle reste à son niveau de départ. */
  private effortCap(nation: number): number {
    const cap = Math.min(1, MIN_EFFORT_CAP + ((1 - MIN_EFFORT_CAP) * this.stability[nation]) / START_STABILITY);
    return Math.max(0, Math.min(1, cap + this.mods[nation].effortCap));
  }

  private steelFactor(nation: number): number {
    return STEEL_SHORTAGE_FLOOR + (1 - STEEL_SHORTAGE_FLOOR) * this.steelCoverage[nation];
  }

  /** La guerre, les pertes et l'occupation usent la stabilité ; la paix la rétablit. */
  private updateStability(n: number, atWar: boolean, minutes: number, services = 0): void {
    let stability = this.stability[n];
    if (atWar) {
      stability -= WAR_WEARINESS_PER_MINUTE * (0.5 + this.effort[n]) * (1 - SERVICES_WEARINESS_CUT * services) * this.mods[n].weariness * minutes;
    } else {
      const gap = PEACE_STABILITY - stability;
      const recovery = STABILITY_RECOVERY_PER_MINUTE * (1 + SERVICES_RECOVERY_BONUS * services);
      stability += Math.sign(gap) * Math.min(Math.abs(gap), recovery * minutes);
    }
    stability -= (CASUALTY_WEARINESS * this.losses[n]) / Math.max(1, this.manpowerMax[n]);
    this.losses[n] = 0;
    const lost = this.totalHome[n] > 0 ? 1 - this.heldHome[n] / this.totalHome[n] : 0;
    stability -= OCCUPATION_WEARINESS_PER_MINUTE * lost * minutes;
    this.stability[n] = Math.max(0, Math.min(1, stability));
  }

  /**
   * La part civile de l'économie fait avancer le premier chantier de chaque file, civile et
   * militaire : elles se partagent les points quand toutes deux ont des chantiers.
   */
  private advanceConstruction(n: number, minutes: number): void {
    const rate = CONSTRUCTION_PER_MINUTE * Math.sqrt(Math.max(0, this.output[n]) / 1000) * (1 - this.effort[n]) * this.steelFactor(n) * this.mods[n].construction;
    this.constructionRate[n] = rate;
    const queue = this.queues[n];
    const hasMilitary = queue.some((order) => isMilitaryBuild(order.kind));
    const hasCivil = queue.some((order) => !isMilitaryBuild(order.kind));
    const share = hasMilitary && hasCivil ? this.militaryShare[n] : hasMilitary ? 1 : 0;
    this.buildProgress[n] = hasCivil ? this.buildProgress[n] + rate * minutes * (1 - share) : 0;
    this.militaryProgress[n] = hasMilitary ? this.militaryProgress[n] + rate * minutes * share : 0;
    if (hasCivil) this.completeOrders(n, false);
    if (hasMilitary) this.completeOrders(n, true);
    if (this.capacityDirty) this.recomputeCapacity();
  }

  /** Achève, dans l'ordre, les chantiers d'une file que ses points accumulés paient. */
  private completeOrders(n: number, military: boolean): void {
    const queue = this.queues[n];
    const progress = military ? this.militaryProgress : this.buildProgress;
    for (;;) {
      const index = queue.findIndex((entry) => isMilitaryBuild(entry.kind) === military);
      if (index < 0) {
        progress[n] = 0;
        return;
      }
      const order = queue[index];
      // Un chantier devenu impossible (province perdue, niveau atteint) est abandonné.
      if (!this.orderValid(n, order)) {
        queue.splice(index, 1);
        continue;
      }
      const cost = this.orderCost(order);
      if (progress[n] < cost) return;
      progress[n] -= cost;
      queue.splice(index, 1);
      this.finishOrder(n, order);
    }
  }

  /** Un chantier achevé prend effet. */
  private finishOrder(n: number, order: BuildOrder): void {
    if (order.kind === 'factory') this.factories[order.province]++;
    else if (order.kind === 'infrastructure') this.infrastructure[order.province]++;
    else if (order.kind === 'depot') this.depots[order.province] = 1;
    else if (order.kind === 'investment') this.completeInvestment(n, order.region ?? 0);
    else if (order.kind === 'axis') this.completeAxis(n, order);
    else if (order.kind === 'research') this.completeResearch(n, order.axis ?? 0);
    else if (isProvinceBuilding(order.kind)) {
      this.buildings[order.kind][order.province]++;
      // Le chantier naval lance ses navires à l'achèvement.
      if (order.kind === 'shipyard') this.navy[n] += SHIPYARD_NAVY * baseNavy(this.nationGdp[n - 1]);
    }
    // Seules les cellules encore tenues à l'achèvement sont fortifiées.
    else for (const cell of order.cells ?? []) if (this.owners[cell] === n) this.setFort(cell, 255);
    this.capacityDirty = true;
    this.supplyDirty = ALL_SUPPLY_GROUPS;
  }

  private orderValid(nation: number, order: BuildOrder): boolean {
    if (order.kind === 'fort') return (order.cells?.length ?? 0) > 0;
    if (order.kind === 'research') return this.research[nation * DOCTRINE_AXIS_COUNT + (order.axis ?? 0)] < MAX_RESEARCH_LEVEL;
    if (order.kind === 'investment') return this.investmentValid(nation, order.region ?? 0);
    if (order.kind === 'axis') {
      const path = order.path ?? [];
      return path.length > 1 && this.controller[path[0]] === nation && this.axisAllows(nation, this.controller[path[path.length - 1]]);
    }
    return this.canBuild(nation, order.province, order.kind, 0);
  }

  orderCost(order: BuildOrder): number {
    if (order.kind === 'fort') return order.cost ?? Math.ceil((order.cells?.length ?? 0) * FORT_COST_PER_CELL);
    if (order.kind === 'investment' || order.kind === 'research') return order.cost ?? 0;
    if (order.kind === 'axis') {
      // Une ancienne ligne maritime n'a que sa longueur, toute en mer.
      const seaLength = order.seaLength ?? (order.sea ? (order.length ?? 0) : 0);
      const landLength = order.seaLength === undefined && order.sea ? 0 : (order.length ?? 0);
      return Math.ceil(AXIS_COST_BASE + landLength * AXIS_COST_PER_CELL + seaLength * SEA_AXIS_COST_PER_CELL);
    }
    return this.buildCost(order.province, order.kind);
  }

  private setFort(cell: number, value: number): void {
    if (this.forts[cell] === value) return;
    this.forts[cell] = value;
    this.pendingFortCells.push(cell);
    this.pendingFortValues.push(value);
  }

  /** Met en file un chantier de fortifications ; renvoie le nombre de cellules retenues. */
  private queueFort(nation: number, cells: number[], urgent = false): number {
    if (nation <= 0 || nation >= this.stride || !this.alive[nation]) return 0;
    if (cells.length === 0) return 0;
    const fortCells = cells.slice(0, MAX_FORT_CELLS);
    const order: BuildOrder = { province: 0, kind: 'fort', cells: fortCells, cost: Math.ceil(fortCells.length * FORT_COST_PER_CELL * this.mods[nation].fortCost) };
    const queue = this.queues[nation];
    if (urgent) {
      // Une urgence passe en tête de la file, qui n'a pas de limite.
      queue.unshift(order);
    } else {
      queue.push(order);
    }
    return order.cells!.length;
  }

  /** Fortifie une bande le long d'un segment tracé, sur le seul territoire de la nation. */
  fortifyLine(nation: number, fromX: number, fromY: number, toX: number, toY: number): number {
    const { width: W, height: H } = this;
    const valid = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y) && y >= 0 && y < H;
    if (!valid(fromX, fromY) || !valid(toX, toY)) return 0;
    let dx = this.wrapDelta(fromX, toX);
    let dy = toY - fromY;
    const length = Math.hypot(dx, dy);
    if (length > MAX_FORT_LINE_LENGTH) {
      dx = (dx / length) * MAX_FORT_LINE_LENGTH;
      dy = (dy / length) * MAX_FORT_LINE_LENGTH;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
    const chosen = new Set<number>();
    const r = FORT_HALF_WIDTH;
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(fromX + (dx * s) / steps);
      const cy = Math.round(fromY + (dy * s) / steps);
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          if (ox * ox + oy * oy > r * r) continue;
          const y = cy + oy;
          if (y < 0 || y >= H) continue;
          const cell = y * W + (((cx + ox) % W) + W) % W;
          if (this.owners[cell] === nation && this.forts[cell] === 0) chosen.add(cell);
        }
      }
    }
    return this.queueFort(nation, [...chosen].sort((a, b) => a - b));
  }

  /** Fortifie le front face à un ennemi, sur quelques cellules de profondeur. */
  fortifyFront(nation: number, enemy: number, urgent = false): number {
    if (nation <= 0 || nation >= this.stride || enemy <= 0 || enemy >= this.stride || nation === enemy) return 0;
    const atWar = this.frontOf(nation, enemy) !== null;
    // L'IA ne fortifie que ses fronts ; le joueur, toute frontière terrestre.
    if (urgent && !atWar) return 0;
    const { owners, width: W, height: H } = this;
    const depth = new Map<number, number>();
    let layer: number[] = [];
    // En guerre, la frontière active ; en paix, toutes les cellules du pays.
    const seeds = atWar ? this.frontier.subarray(0, this.frontierCount) : this.landCells;
    for (let i = 0; i < seeds.length; i++) {
      const cell = seeds[i];
      if (owners[cell] !== nation) continue;
      const x = cell % W;
      const y = (cell - x) / W;
      const touches =
        owners[y * W + ((x + 1) % W)] === enemy ||
        owners[y * W + ((x + W - 1) % W)] === enemy ||
        (y > 0 && owners[cell - W] === enemy) ||
        (y < H - 1 && owners[cell + W] === enemy);
      if (touches && !depth.has(cell)) {
        depth.set(cell, 0);
        layer.push(cell);
      }
    }
    for (let d = 1; d < FORT_FRONT_DEPTH && layer.length > 0; d++) {
      const next: number[] = [];
      for (const cell of layer) {
        const x = cell % W;
        const y = (cell - x) / W;
        for (const other of [y * W + ((x + 1) % W), y * W + ((x + W - 1) % W), y > 0 ? cell - W : -1, y < H - 1 ? cell + W : -1]) {
          if (other < 0 || owners[other] !== nation || depth.has(other)) continue;
          depth.set(other, d);
          next.push(other);
        }
      }
      layer = next;
    }
    const cells = [...depth.keys()].filter((cell) => this.forts[cell] === 0).sort((a, b) => a - b);
    // L'IA ne se lance pas pour une poignée de cellules.
    if (urgent && cells.length < AI_FORT_MIN_CELLS) return 0;
    return this.queueFort(nation, cells, urgent);
  }

  setCounterShare(nation: number, share: number): void {
    if (nation <= 0 || nation >= this.stride || !Number.isFinite(share)) return;
    this.counterShare[nation] = Math.max(0, Math.min(MAX_COUNTER_SHARE, share));
  }

  addPriority(nation: number, x: number, y: number): void {
    if (nation <= 0 || nation >= this.stride || !Number.isInteger(x) || !Number.isInteger(y)) return;
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) return;
    if (this.owners[y * this.width + x] !== nation) return;
    const zones = this.priorityZones[nation];
    if (zones.length >= MAX_PRIORITY_ZONES) return;
    zones.push({ x, y });
  }

  removePriority(nation: number, index: number): void {
    const zones = this.priorityZones[nation];
    if (zones && Number.isInteger(index) && index >= 0 && index < zones.length) zones.splice(index, 1);
  }

  private inPriorityZone(nation: number, x: number, y: number): boolean {
    for (const zone of this.priorityZones[nation]) {
      const dx = this.wrapDelta(zone.x, x);
      const dy = y - zone.y;
      if (dx * dx + dy * dy <= PRIORITY_RADIUS * PRIORITY_RADIUS) return true;
    }
    return false;
  }

  /**
   * Réserve de contre-attaque : une percée ennemie qui s'enfonce sur le sol national est
   * prise de flanc près de sa base, pour la couper. Chaque percée n'est contrée qu'une fois.
   */
  private decideCounters(): void {
    const { owners, width: W, height: H } = this;
    for (const offensive of this.offensives) {
      if (offensive.transitUntil > 0 || offensive.captured < COUNTER_MIN_CAPTURED) continue;
      const target = this.owners[Math.max(0, Math.min(H - 1, offensive.targetY)) * W + offensive.targetX];
      const victim = this.provinceHome[this.provinceGrid[Math.max(0, Math.min(H - 1, offensive.targetY)) * W + offensive.targetX]];
      for (const defender of new Set([target, victim])) {
        if (defender === 0 || defender === offensive.nation || !this.alive[defender] || this.counterShare[defender] <= 0) continue;
        if (!this.frontOf(defender, offensive.nation)) continue;
        const key = `${defender}:${offensive.id}`;
        const attempts = this.counterAttempts.get(key) ?? 0;
        if (attempts >= COUNTER_MAX_ATTEMPTS) continue;
        this.counterAttempts.set(key, attempts + 1);
        // Jusqu'où la percée est-elle allée ? Le long de son axe, la dernière cellule tenue.
        const length = Math.sqrt(offensive.lengthSquared);
        let tip = 0;
        for (let t = 0; t <= 1; t += 1 / Math.max(1, length)) {
          const x = (((Math.round(offensive.fromX + offensive.dx * t)) % W) + W) % W;
          const y = Math.round(offensive.fromY + offensive.dy * t);
          if (y < 0 || y >= H) break;
          if (owners[y * W + x] === offensive.nation) tip = t;
        }
        const t = tip * COUNTER_DEPTH;
        const cx = offensive.fromX + offensive.dx * t;
        const cy = offensive.fromY + offensive.dy * t;
        const px = -offensive.dy / length;
        const py = offensive.dx / length;
        const reach = OFFENSIVE_HALF_WIDTH + COUNTER_OFFSET;
        const point = (side: number) => {
          const x = (((Math.round(cx + px * reach * side)) % W) + W) % W;
          const y = Math.max(0, Math.min(H - 1, Math.round(cy + py * reach * side)));
          return { x, y, owner: owners[y * W + x] };
        };
        // En tenaille : de chaque flanc tenu, vers l'axe de la percée, pour la couper en deux.
        const flanks = [point(-1), point(1)].filter((flank) => flank.owner === defender);
        if (flanks.length === 0) continue;
        const axis = {
          x: (((Math.round(cx)) % W) + W) % W,
          y: Math.max(0, Math.min(H - 1, Math.round(cy))),
        };
        if (owners[axis.y * W + axis.x] === defender) continue;
        const army = this.armyOf(defender);
        let reserve = this.reserve[defender];
        if (reserve <= 0) continue;
        let budget = army * this.counterShare[defender];
        let launchedAny = false;
        for (const [index, flank] of flanks.entries()) {
          // Chaque bras de la tenaille prend sa part de ce qu'il reste de la réserve gardée.
          const force = budget / (flanks.length - index);
          const id = this.launchOffensive(defender, flank.x, flank.y, axis.x, axis.y, Math.min(1, force / reserve));
          if (id === 0) continue;
          const launched = this.offensivesByNation[defender].find((entry) => entry.id === id)!;
          launched.counter = true;
          budget -= launched.force;
          reserve = this.reserve[defender];
          launchedAny = true;
          if (reserve <= 0) break;
        }
        if (launchedAny) this.counterAttempts.set(key, COUNTER_MAX_ATTEMPTS);
      }
    }
  }

  /** Coût du prochain niveau d'un bâtiment dans une province. */
  buildCost(province: number, kind: BuildKind): number {
    if (kind === 'factory') return BUILD_COST.factory * (this.factories[province] + 1);
    if (kind === 'infrastructure') return BUILD_COST.infrastructure * (this.infrastructure[province] + 1);
    if (isProvinceBuilding(kind)) return PROVINCE_BUILDINGS[kind].cost * (this.buildings[kind][province] + 1);
    return BUILD_COST.depot;
  }

  /**
   * Une nation peut-elle bâtir là ? `queued` compte les chantiers du même genre déjà en
   * file pour cette province, qui rapprochent du niveau maximal.
   */
  canBuild(nation: number, province: number, kind: BuildKind, queued: number): boolean {
    if (province <= 0 || province >= this.controller.length || this.controller[province] !== nation) return false;
    const home = this.provinceHome[province] === nation;
    if (kind === 'fort' || kind === 'investment' || kind === 'axis' || kind === 'research') return false;
    if (kind === 'factory') return home && this.factories[province] + queued < MAX_FACTORY_LEVEL;
    if (isProvinceBuilding(kind)) {
      if (!home || this.buildings[kind][province] + queued >= PROVINCE_BUILDINGS[kind].max) return false;
      if (kind === 'refinery') return this.provinceOil[province] > 0;
      if (kind === 'steelworks') return this.provinceSteel[province] > 0;
      if (kind === 'shipyard') return this.provinceCoastal[province] === 1;
      return true;
    }
    // L'infrastructure et le dépôt servent au ravitaillement, qui ne manque qu'en territoire conquis.
    if (kind === 'infrastructure') return !home && this.infrastructure[province] + queued < MAX_INFRASTRUCTURE_LEVEL;
    return !home && this.depots[province] === 0 && queued === 0 && this.consolidation[province] >= DEPOT_MIN_CONSOLIDATION;
  }

  build(nation: number, province: number, kind: BuildKind): void {
    if (nation <= 0 || nation >= this.stride || !this.alive[nation]) return;
    // Les fortifications passent par fortifyLine et fortifyFront.
    if (kind !== 'factory' && kind !== 'infrastructure' && kind !== 'depot' && !isProvinceBuilding(kind)) return;
    const queue = this.queues[nation];
    const queued = queue.filter((order) => order.province === province && order.kind === kind).length;
    if (!this.canBuild(nation, province, kind, queued)) return;
    queue.push({ province, kind });
  }

  cancelBuild(nation: number, index: number): void {
    const queue = this.queues[nation];
    if (!queue || !Number.isInteger(index) || index < 0 || index >= queue.length) return;
    const [order] = queue.splice(index, 1);
    // Abandonner des investissements promis vaut un refus.
    if (order.kind === 'investment') {
      const movement = this.movements.find((entry) => entry.parent === nation && entry.origin === order.region);
      if (movement) {
        movement.investing = false;
        movement.unrest = Math.min(1, movement.unrest + REFUSAL_UNREST);
        movement.refused = (movement.refused ?? 0) + 1;
      }
    }
    // Ce qui était accumulé sur le premier chantier d'une file est perdu avec lui.
    const military = isMilitaryBuild(order.kind);
    if (!queue.slice(0, index).some((entry) => isMilitaryBuild(entry.kind) === military)) {
      (military ? this.militaryProgress : this.buildProgress)[nation] = 0;
    }
  }

  /** Change l'ordre de la file : les points déjà accumulés vont au nouveau premier chantier. */
  moveBuild(nation: number, from: number, to: number): void {
    const queue = this.queues[nation];
    if (!queue || !Number.isInteger(from) || !Number.isInteger(to)) return;
    if (from < 0 || from >= queue.length || to < 0 || to >= queue.length || from === to) return;
    const [order] = queue.splice(from, 1);
    queue.splice(to, 0, order);
  }

  setMilitaryShare(nation: number, share: number): void {
    if (nation <= 0 || nation >= this.stride || !Number.isFinite(share)) return;
    this.militaryShare[nation] = Math.max(0, Math.min(1, share));
  }

  /** L'IA bâtit des usines en paix, des dépôts derrière ses conquêtes en guerre. */
  private decideBuilds(): void {
    const owned: number[][] = Array.from({ length: this.stride }, () => []);
    for (let p = 1; p < this.controller.length; p++) owned[this.controller[p]].push(p);
    const atWar = new Uint8Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
    }
    for (let n = 1; n < this.stride; n++) {
      if (n === this.player || !this.alive[n]) continue;
      if (this.random() >= AI_BUILD_CHANCE * AI_PROFILES[this.profile[n]].build) continue;
      // En sous-nombre sur un front, l'IA le fortifie, en urgence : avant tout autre chantier.
      if (atWar[n] && !this.queues[n].some((order) => order.kind === 'fort')) {
        const weakest = this.fronts.find((front) => {
          if (front.a !== n && front.b !== n) return false;
          const own = front.a === n ? front.sides[0] : front.sides[1];
          const other = front.a === n ? front.sides[1] : front.sides[0];
          return front.length > 0 && other.force > own.force;
        });
        if (weakest && this.fortifyFront(n, weakest.a === n ? weakest.b : weakest.a, true) > 0) continue;
      }
      if (this.queues[n].length >= AI_MAX_QUEUE) continue;
      if (this.random() < AI_RESEARCH_CHANCE && this.aiResearch(n)) continue;
      const provinces = owned[n];
      if (provinces.length === 0) continue;
      if (atWar[n]) {
        const depot = provinces.find((p) => this.canBuild(n, p, 'depot', 0));
        if (depot !== undefined) {
          this.build(n, depot, 'depot');
          continue;
        }
      }
      if (!this.autoTrade && !atWar[n] && this.axesOf(n) < Math.min(AI_MAX_AXES * 2, AI_PROFILES[this.profile[n]].maxAxes) && this.random() < AI_AXIS_CHANCE && this.aiPlanAxis(n, provinces)) continue;
      // Une usine dans l'une des provinces les plus riches, sinon de l'infrastructure en territoire conquis.
      const rich = provinces
        .filter((p) => this.canBuild(n, p, 'factory', 0))
        .sort((a, b) => this.provinceGdp[b] - this.provinceGdp[a] || a - b)
        .slice(0, 5);
      if (rich.length > 0 && this.random() < 0.75) {
        this.build(n, rich[Math.floor(this.random() * rich.length)], 'factory');
      } else {
        // Sinon, ce dont le pays manque le plus : navires, pétrole, acier, calme, hommes, routes.
        const men = this.manpowerMax[n] > 0 ? this.manpower[n] / this.manpowerMax[n] : 1;
        const needs: BuildKind[] = [];
        if (this.blockaded[n]) needs.push('shipyard');
        if (this.oilCoverage[n] < 0.9) needs.push('refinery');
        if (this.steelCoverage[n] < 0.9) needs.push('steelworks');
        if (this.stability[n] < 0.6) needs.push('services');
        if (men < 0.5) needs.push('recruitment');
        needs.push('infrastructure');
        for (const kind of needs) {
          const options = provinces.filter((p) => this.canBuild(n, p, kind, 0));
          if (options.length === 0) continue;
          this.build(n, options[Math.floor(this.random() * options.length)], kind);
          break;
        }
      }
    }
  }

  private computeArmies(): void {
    const { armies } = this;
    for (let n = 1; n < this.stride; n++) armies[n] = this.reserve[n];
    for (const front of this.fronts) {
      armies[front.a] += front.sides[0].force;
      armies[front.b] += front.sides[1].force;
    }
    for (const offensive of this.offensives) armies[offensive.nation] += offensive.force;
  }

  private updateFronts(): void {
    const { advantage, stride } = this;
    for (const front of this.fronts) {
      const [sideA, sideB] = front.sides;
      this.moveForces(front.a, sideA);
      this.moveForces(front.b, sideB);

      const length = Math.max(front.length, MIN_FRONT_LENGTH);
      sideA.rawDensity = sideA.force / length;
      sideB.rawDensity = sideB.force / length;
      // La qualité donne plus de poids à chaque homme, la masse moins.
      sideA.density = sideA.rawDensity * DEFENSE_MULTIPLIER[sideA.stance] * this.mods[front.a].strength;
      sideB.density = sideB.rawDensity * DEFENSE_MULTIPLIER[sideB.stance] * this.mods[front.b].strength;
      const logRatio = Math.log((sideA.density + 1e-3) / (sideB.density + 1e-3));
      front.logRatio = logRatio;

      const aRetreats = sideA.stance === 'retreat';
      const bRetreats = sideB.stance === 'retreat';
      advantage[front.a * stride + front.b] =
        !aRetreats && (sideA.stance === 'attack' || bRetreats)
          ? logRatio + (bRetreats ? RETREAT_ADVANTAGE : 0)
          : -Infinity;
      advantage[front.b * stride + front.a] =
        !bRetreats && (sideB.stance === 'attack' || aRetreats)
          ? -logRatio + (aRetreats ? RETREAT_ADVANTAGE : 0)
          : -Infinity;

      // Deux camps qui tiennent ne se combattent pas. Sinon, chacun perd une part
      // de ses forces d'autant plus grande que l'adversaire est nombreux.
      const engaged = front.length > 0 && (sideA.stance !== 'hold' || sideB.stance !== 'hold');
      const total = sideA.force + sideB.force;
      if (engaged && total > 0) {
        const scale = ATTRITION_PER_TICK * Math.min(1, front.length / MIN_FRONT_LENGTH);
        const lossA = sideA.force * (2 * sideB.force) / total * scale * LOSS_MULTIPLIER[sideA.stance] * this.mods[front.a].losses;
        const lossB = sideB.force * (2 * sideA.force) / total * scale * LOSS_MULTIPLIER[sideB.stance] * this.mods[front.b].losses;
        sideA.force = Math.max(0, sideA.force - lossA);
        sideB.force = Math.max(0, sideB.force - lossB);
      }
      // Un camp mal ravitaillé s'use, même quand personne n'attaque.
      if (front.length > 0) {
        sideA.force *= 1 - SUPPLY_ATTRITION * (1 - sideA.supply);
        sideB.force *= 1 - SUPPLY_ATTRITION * (1 - sideB.supply);
      }
    }
  }

  /** Les forces rejoignent ou quittent le front progressivement. */
  private moveForces(nation: number, side: FrontSide): void {
    const army = this.armies[nation];
    const target = army * side.allocation;
    const limit = army * TRANSFER_RATE;
    if (side.force < target) {
      const moved = Math.min(target - side.force, limit, this.reserve[nation]);
      side.force += moved;
      this.reserve[nation] -= moved;
    } else if (side.force > target) {
      const moved = Math.min(side.force - target, limit);
      side.force -= moved;
      this.reserve[nation] += moved;
    }
  }

  /**
   * L'armée tend vers la capacité militaire : elle se renforce en dessous et se
   * démobilise au-dessus, quand l'économie ne peut plus l'entretenir.
   */
  private reinforce(): void {
    this.computeArmies();
    let shrinking = false;
    const keep = this.demobilized;
    keep.fill(1);
    for (let n = 1; n < this.stride; n++) {
      if (!this.alive[n]) continue;
      // Ce qui manque depuis le tick précédent est tombé au combat ou en route.
      if (this.armyAfterReinforce[n] >= 0) this.losses[n] += Math.max(0, this.armyAfterReinforce[n] - this.armies[n]);
      const missing = this.capacity[n] - this.armies[n];
      let after = this.armies[n];
      if (missing > 0) {
        // Les renforts puisent dans le réservoir de main-d'œuvre.
        const added = Math.min(missing * REINFORCE_PER_TICK, this.manpower[n]);
        this.reserve[n] += added;
        this.manpower[n] -= added;
        after += added;
      } else if (missing < 0 && this.armies[n] > 0) {
        keep[n] = 1 + (missing / this.armies[n]) * DEMOBILIZE_PER_TICK;
        this.reserve[n] *= keep[n];
        shrinking = true;
        // Les démobilisés rentrent chez eux : ils retournent au réservoir.
        const released = this.armies[n] * (1 - keep[n]);
        this.manpower[n] = Math.min(this.manpowerMax[n], this.manpower[n] + released);
        after -= released;
      }
      this.armyAfterReinforce[n] = after;
    }
    if (!shrinking) return;
    for (const front of this.fronts) {
      front.sides[0].force *= keep[front.a];
      front.sides[1].force *= keep[front.b];
    }
    for (const offensive of this.offensives) offensive.force *= keep[offensive.nation];
  }

  private updateOffensives(): void {
    const { owners, width: W, height: H } = this;
    for (let i = this.offensives.length - 1; i >= 0; i--) {
      const offensive = this.offensives[i];
      if (offensive.transitUntil > 0) {
        if (this.tick >= offensive.transitUntil) this.land(offensive);
        continue;
      }
      if (offensive.supplyCount > 0) {
        offensive.supply = offensive.supplySum / offensive.supplyCount;
        offensive.supplySum = 0;
        offensive.supplyCount = 0;
      }
      offensive.force *= 1 - OFFENSIVE_ATTRITION * (1 + OFFENSIVE_SUPPLY_ATTRITION * (1 - offensive.supply));
      offensive.stalledTicks++;
      const toY = Math.max(0, Math.min(H - 1, offensive.toY));
      const reached = owners[toY * W + offensive.toX] === offensive.nation;
      if (reached || offensive.force < OFFENSIVE_MIN_FORCE || offensive.stalledTicks > OFFENSIVE_STALL_TICKS) {
        this.endOffensive(offensive);
      }
    }
  }

  /** Arrivée d'un débarquement : tête de pont, puis couloir classique vers la cible. */
  private land(offensive: Offensive): void {
    const { owners, width: W, height: H } = this;
    const { landingX: x, landingY: y, nation } = offensive;
    const owner = owners[y * W + x];
    const front = this.frontOf(nation, owner);
    if (owner === nation || !front) {
      this.endOffensive(offensive);
      return;
    }
    offensive.force *= 1 - offensive.seaLoss;
    offensive.transitUntil = 0;
    offensive.stalledTicks = 0;

    const taken: number[] = [];
    for (let dy = -BEACHHEAD_RADIUS; dy <= BEACHHEAD_RADIUS; dy++) {
      for (let dx = -BEACHHEAD_RADIUS; dx <= BEACHHEAD_RADIUS; dx++) {
        if (dx * dx + dy * dy > BEACHHEAD_RADIUS * BEACHHEAD_RADIUS) continue;
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        const cell = ny * W + ((x + dx + W) % W);
        if (owners[cell] !== owner) continue;
        this.takeCell(cell, nation, owner);
        taken.push(cell);
      }
    }
    for (const cell of taken) this.refreshAround(cell);
    if (this.capacityDirty) this.recomputeCapacity();

    let dx = this.wrapDelta(x, offensive.targetX);
    let dy = offensive.targetY - y;
    const length = Math.hypot(dx, dy);
    if (length === 0 || this.owners[offensive.targetY * W + offensive.targetX] === nation) {
      this.endOffensive(offensive);
      return;
    }
    if (length > MAX_OFFENSIVE_LENGTH) {
      dx = Math.round((dx / length) * MAX_OFFENSIVE_LENGTH);
      dy = Math.round((dy / length) * MAX_OFFENSIVE_LENGTH);
    }
    offensive.fromX = x;
    offensive.fromY = y;
    offensive.dx = dx;
    offensive.dy = dy;
    offensive.toX = ((x + dx) % W + W) % W;
    offensive.toY = y + dy;
    offensive.lengthSquared = Math.max(1, dx * dx + dy * dy);
    this.supplyDirty = ALL_SUPPLY_GROUPS;
  }

  /**
   * Avantage de la meilleure offensive de `attacker` qui couvre cette cellule,
   * -Infinity si aucune. Laisse l'offensive retenue dans matchedOffensive.
   */
  private offensiveEdge(attacker: number, front: Front, x: number, y: number): number {
    let best = -Infinity;
    this.matchedOffensive = null;
    const own = front.a === attacker ? front.sides[0] : front.sides[1];
    const enemy = front.a === attacker ? front.sides[1] : front.sides[0];
    for (const offensive of this.offensivesByNation[attacker]) {
      if (offensive.transitUntil > 0) continue;
      const px = this.wrapDelta(offensive.fromX, x);
      const py = y - offensive.fromY;
      const t = Math.max(0, Math.min(1, (px * offensive.dx + py * offensive.dy) / offensive.lengthSquared));
      const ex = px - t * offensive.dx;
      const ey = py - t * offensive.dy;
      const squared = ex * ex + ey * ey;
      if (squared > OFFENSIVE_HALF_WIDTH * OFFENSIVE_HALF_WIDTH) continue;
      const pressure = (own.rawDensity + offensive.force / (2 * OFFENSIVE_HALF_WIDTH)) * this.mods[attacker].strength;
      const depth = t * Math.sqrt(offensive.lengthSquared);
      const edge =
        Math.log((pressure + 1e-3) / (enemy.density + 1e-3)) -
        (Math.sqrt(squared) / OFFENSIVE_HALF_WIDTH) * OFFENSIVE_EDGE_FALLOFF -
        depth / OFFENSIVE_DEPTH_FADE;
      if (edge > best) {
        best = edge;
        this.matchedOffensive = offensive;
      }
    }
    return best;
  }

  private scanFrontier(): void {
    const { owners, width: W, height: H, stride, frontIndex, advantage, lengthCounts, supplySums, priorityCounts, supply, forts, sectors, sectorColumns, terrain, pocket, fronts, offensivesByNation, provinceHome, provinceGrid, mods } = this;
    const airEdge = DOCTRINE_EFFECTS.airEdge;
    const list = this.frontier;
    const count = this.frontierCount;
    for (const front of fronts) {
      lengthCounts[front.a * stride + front.b] = 0;
      lengthCounts[front.b * stride + front.a] = 0;
      supplySums[front.a * stride + front.b] = 0;
      supplySums[front.b * stride + front.a] = 0;
      priorityCounts[front.a * stride + front.b] = 0;
      priorityCounts[front.b * stride + front.a] = 0;
      front.flipBudget = Math.min(MAX_FRONT_FLIP_BUDGET, front.flipBudget + MAX_FRONT_FLIPS_PER_TICK);
    }
    this.flipCount = 0;

    for (let i = 0; i < count; i++) {
      const cell = list[i];
      const defender = owners[cell];
      const x = cell % W;
      const y = (cell - x) / W;
      const i0 = x > 0 ? cell - 1 : cell + W - 1;
      const i1 = x < W - 1 ? cell + 1 : cell - W + 1;
      const n0 = owners[i0];
      const n1 = owners[i1];
      const n2 = y > 0 ? owners[cell - W] : 0;
      const n3 = y < H - 1 ? owners[cell + W] : 0;
      const sector = sectors[(y >> SECTOR_SHIFT) * sectorColumns + (x >> SECTOR_SHIFT)];
      const terrainId = terrain ? terrain[cell] : 0;
      const onHomeSoil = provinceHome[provinceGrid[cell]] === defender;
      const encircled = pocket[cell] === 1;
      // Un occupant mal ravitaillé défend mal. Une poche a déjà sa propre règle.
      const defenderSupply = SUPPLY_LEVELS[supply[cell]];
      // Une cellule fortifiée résiste mieux et tombe moins vite.
      const fort = forts[cell] / 255;
      const defenderMods = mods[defender];
      const local =
        sector -
        TERRAIN_DEFENSE[terrainId] -
        (onHomeSoil ? HOME_DEFENSE : 0) +
        (encircled ? 0 : SUPPLY_DEFENSE_PENALTY * (1 - defenderSupply)) -
        FORT_DEFENSE * fort * defenderMods.fortDefense -
        defenderMods.defenseEdge;
      const fortSpeed = 1 - (1 - FORT_SPEED) * fort;
      const prioritized = this.priorityZones[defender].length > 0 && this.inPriorityZone(defender, x, y);

      let best = 0;
      let bestChance = 0;
      let bestOffensive: Offensive | null = null;
      for (let j = 0; j < 4; j++) {
        const attacker = j === 0 ? n0 : j === 1 ? n1 : j === 2 ? n2 : n3;
        if (attacker === 0 || attacker === defender) continue;
        if (j > 0 && attacker === n0) continue;
        if (j > 1 && attacker === n1) continue;
        if (j > 2 && attacker === n2) continue;
        const key = attacker * stride + defender;
        const index = frontIndex[key];
        if (index < 0) continue;
        lengthCounts[key]++;
        supplySums[key] += defenderSupply;
        if (prioritized) priorityCounts[key]++;
        // L'attaque part de la cellule voisine : c'est son ravitaillement qui compte.
        const from = j === 0 ? i0 : j === 1 ? i1 : j === 2 ? cell - W : cell + W;
        const attackerSupply = SUPPLY_LEVELS[supply[from]];

        let edge = advantage[key];
        let speed = 1;
        let matched: Offensive | null = null;
        if (offensivesByNation[attacker].length > 0) {
          const offensiveEdge = this.offensiveEdge(attacker, fronts[index], x, y);
          if (offensiveEdge > -Infinity) {
            matched = this.matchedOffensive!;
            matched.supplySum += attackerSupply;
            matched.supplyCount++;
            speed = OFFENSIVE_SPEED * mods[attacker].offensiveSpeed;
            if (offensiveEdge > edge) edge = offensiveEdge;
          }
        }
        edge -= SUPPLY_ATTACK_PENALTY * (1 - attackerSupply);
        // Doctrine : élan de l'attaquant, et supériorité aérienne de qui a le plus d'avions.
        edge += mods[attacker].attackEdge + airEdge * (mods[attacker].air - defenderMods.air);
        // Secteurs prioritaires : le défenseur s'y concentre, et s'amincit d'autant ailleurs.
        const defenderSide = fronts[index].a === defender ? fronts[index].sides[0] : fronts[index].sides[1];
        if (prioritized) edge -= Math.log(1 + PRIORITY_BOOST);
        else if (defenderSide.priority > 0) {
          const share = Math.min(MAX_PRIORITY_SHARE, defenderSide.priority);
          edge -= Math.log(1 - (PRIORITY_BOOST * share) / (1 - share));
        }
        if (encircled) {
          if (edge < POCKET_EDGE) edge = POCKET_EDGE;
          speed *= POCKET_SPEED;
        }
        edge += local;
        if (edge <= 0) continue;
        const neighbors = (n0 === attacker ? 1 : 0) + (n1 === attacker ? 1 : 0) + (n2 === attacker ? 1 : 0) + (n3 === attacker ? 1 : 0);
        const chance = MAX_FLIP_CHANCE * (1 - Math.exp(-FLIP_STEEPNESS * edge)) * NEIGHBOR_WEIGHT[neighbors] * speed * TERRAIN_SPEED[terrainId] * fortSpeed;
        if (chance > bestChance) {
          bestChance = chance;
          best = attacker;
          bestOffensive = matched;
        }
      }
      if (best !== 0 && this.random() < bestChance) {
        const front = fronts[frontIndex[best * stride + defender]];
        if (front.flipBudget < 1) continue;
        front.flipBudget--;
        if (this.flipCount === this.flipCells.length) this.growFlips();
        this.flipCells[this.flipCount] = cell;
        this.flipOwners[this.flipCount] = best;
        this.flipOffensives[this.flipCount] = bestOffensive ? bestOffensive.id : 0;
        this.flipCount++;
      }
    }

    for (const front of fronts) {
      const aFacesB = front.b * stride + front.a;
      const bFacesA = front.a * stride + front.b;
      front.length = (lengthCounts[bFacesA] + lengthCounts[aFacesB]) / 2;
      front.sides[0].supply = lengthCounts[aFacesB] > 0 ? supplySums[aFacesB] / lengthCounts[aFacesB] : 1;
      front.sides[1].supply = lengthCounts[bFacesA] > 0 ? supplySums[bFacesA] / lengthCounts[bFacesA] : 1;
      front.sides[0].priority = lengthCounts[aFacesB] > 0 ? priorityCounts[aFacesB] / lengthCounts[aFacesB] : 0;
      front.sides[1].priority = lengthCounts[bFacesA] > 0 ? priorityCounts[bFacesA] / lengthCounts[bFacesA] : 0;
    }
  }

  private growFlips(): void {
    const size = this.flipCells.length * 2;
    const cells = new Int32Array(size);
    cells.set(this.flipCells);
    this.flipCells = cells;
    const owners = new Uint16Array(size);
    owners.set(this.flipOwners);
    this.flipOwners = owners;
    const offensives = new Int32Array(size);
    offensives.set(this.flipOffensives);
    this.flipOffensives = offensives;
  }

  /** Une cellule change de camp. La frontière active est à rafraîchir ensuite. */
  private takeCell(cell: number, attacker: number, defender: number): Front | null {
    this.owners[cell] = attacker;
    this.pocket[cell] = 0;
    this.inheritSupply(cell, attacker);
    if (this.forts[cell] !== 0) this.setFort(cell, 0);
    this.cellCounts[defender]--;
    this.cellCounts[attacker]++;
    this.pendingCells.push(cell);
    this.pendingOwners.push(attacker);
    this.transferProvinceCell(this.provinceGrid[cell], defender, attacker);
    const front = this.frontOf(attacker, defender);
    if (front) front.sides[front.a === attacker ? 0 : 1].captured++;
    return front;
  }

  /**
   * Une cellule conquise prend tout de suite le ravitaillement de sa meilleure voisine du
   * même camp, sans attendre le prochain contrôle : sinon la pointe d'une percée, faite de
   * cellules fraîches, passerait pour pleinement ravitaillée.
   */
  private inheritSupply(cell: number, owner: number): void {
    if (!this.logisticsEnabled) return;
    const { owners, supply, width: W, height: H } = this;
    let value = 0;
    if (this.provinceHome[this.provinceGrid[cell]] !== owner) {
      const x = cell % W;
      const y = (cell - x) / W;
      let best = -1;
      for (let j = 0; j < 4; j++) {
        if ((j === 2 && y === 0) || (j === 3 && y === H - 1)) continue;
        const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
        if (owners[next] !== owner) continue;
        const level = supply[next] === 0 ? 255 : supply[next];
        if (level > best) best = level;
      }
      // Sans voisine (un débarquement), on suppose la cellule ravitaillée jusqu'au contrôle.
      value = best < 0 ? 255 : best;
    }
    if (supply[cell] !== value) {
      supply[cell] = value;
      this.pendingSupplyCells.push(cell);
      this.pendingSupplyValues.push(value);
    }
    if (value !== 0 && this.supplyListed[cell] === 0) {
      this.supplyListed[cell] = 1;
      this.supplyList.push(cell);
    }
  }

  private refreshAround(cell: number): void {
    const { width: W, height: H } = this;
    const x = cell % W;
    const y = (cell - x) / W;
    this.refreshFrontier(cell);
    this.refreshFrontier(x > 0 ? cell - 1 : cell + W - 1);
    this.refreshFrontier(x < W - 1 ? cell + 1 : cell - W + 1);
    if (y > 0) this.refreshFrontier(cell - W);
    if (y < H - 1) this.refreshFrontier(cell + W);
  }

  private applyFlips(): void {
    if (this.flipCount > 0) this.supplyDirty = ALL_SUPPLY_GROUPS;
    for (let i = 0; i < this.flipCount; i++) {
      const cell = this.flipCells[i];
      const attacker = this.flipOwners[i];
      const defender = this.owners[cell];
      const front = this.takeCell(cell, attacker, defender)!;

      const offensiveId = this.flipOffensives[i];
      if (offensiveId !== 0) {
        const offensive = this.offensivesByNation[attacker].find((entry) => entry.id === offensiveId);
        if (offensive) {
          const enemySide = front.sides[front.a === attacker ? 1 : 0];
          const cost = OFFENSIVE_CELL_BASE_COST + OFFENSIVE_CELL_COST * enemySide.density;
          offensive.force = Math.max(0, offensive.force - cost);
          offensive.captured++;
          offensive.stalledTicks = 0;
          enemySide.force = Math.max(0, enemySide.force - cost * OFFENSIVE_DEFENDER_LOSS);
        }
      }
    }
    for (let i = 0; i < this.flipCount; i++) this.refreshAround(this.flipCells[i]);
    if (this.capacityDirty) this.recomputeCapacity();
  }

  private transferProvinceCell(province: number, from: number, to: number): void {
    let counts = this.provinceCounts[province];
    if (!counts) {
      counts = new Map([[this.controller[province], this.provinceCells[province]]]);
      this.provinceCounts[province] = counts;
    }
    counts.set(from, (counts.get(from) ?? 0) - 1);
    const held = (counts.get(to) ?? 0) + 1;
    counts.set(to, held);
    if (held * 2 > this.provinceCells[province] && this.controller[province] !== to) {
      const previous = this.controller[province];
      const home = this.provinceHome[province];
      const value = this.provinceValue[province];
      if (previous === home) this.heldHome[home] -= value;
      if (to === home) this.heldHome[home] += value;
      // Les combats détruisent une part de l'industrie, à chaque changement de mains.
      // Une annexion se fait sans combat, donc sans destructions.
      if (!this.peacefulTransfer) {
        const damaged = this.development[province] * (1 - CAPTURE_DAMAGE);
        this.development[province] = Math.min(this.development[province], Math.max(MIN_DAMAGED_DEVELOPMENT, damaged));
      }
      this.controller[province] = to;
      this.consolidation[province] = 0;
      if (!this.peacefulTransfer) {
        // Les combats abattent un niveau d'usine et d'infrastructure ; le dépôt est perdu.
        if (this.factories[province] > 0) this.factories[province]--;
        if (this.infrastructure[province] > 0) this.infrastructure[province]--;
        for (const levels of Object.values(this.buildings)) if (levels[province] > 0) levels[province]--;
      }
      this.depots[province] = 0;
      this.capacityDirty = true;
      this.pendingProvinces.push(province, to);
    }
  }

  // -------------------------------------------------------------------------
  // Ravitaillement : une partie du territoire coupée du reste et au contact d'un
  // ennemi est une poche. Elle s'effrite, même si l'ennemi ne fait que tenir.
  // -------------------------------------------------------------------------

  /** Un point d'ancrage par territoire d'origine : les exclaves restent ravitaillées. */
  private placeAnchors(): void {
    const { landCells, owners, visited, visitOrder } = this;
    visited.fill(0);
    let cursor = 0;
    for (let k = 0; k < landCells.length; k++) {
      const seed = landCells[k];
      if (visited[seed]) continue;
      const start = cursor;
      cursor = this.floodFill(seed, cursor, null);
      const anchor = visitOrder[start + ((cursor - start) >> 1)];
      this.isAnchor[anchor] = 1;
      this.anchorOwner.set(anchor, owners[seed]);
    }
    // Le contrôle des poches suppose un marquage vierge.
    visited.fill(0);
  }

  /**
   * Remplit la zone d'un même propriétaire. Les cellules sont écrites à la suite dans
   * visitOrder ; renvoie la fin de la zone. Si `flags` est fourni, il décrit la zone.
   */
  private floodFill(
    seed: number,
    begin: number,
    flags: { touchesEnemy: boolean; anchored: boolean; coastal: boolean } | null,
  ): number {
    const { owners, visited, visitOrder, width: W, height: H, frontIndex, stride, isAnchor, anchorOwner } = this;
    const owner = owners[seed];
    let head = begin;
    let tail = begin;
    visitOrder[tail++] = seed;
    visited[seed] = 1;
    while (head < tail) {
      const cell = visitOrder[head++];
      const x = cell % W;
      const y = (cell - x) / W;
      if (flags && isAnchor[cell] && anchorOwner.get(cell) === owner) flags.anchored = true;
      for (let j = 0; j < 4; j++) {
        let next: number;
        if (j === 0) next = x > 0 ? cell - 1 : cell + W - 1;
        else if (j === 1) next = x < W - 1 ? cell + 1 : cell - W + 1;
        else if (j === 2) {
          if (y === 0) continue;
          next = cell - W;
        } else {
          if (y === H - 1) continue;
          next = cell + W;
        }
        const other = owners[next];
        if (other === owner) {
          if (!visited[next]) {
            visited[next] = 1;
            visitOrder[tail++] = next;
          }
        } else if (flags) {
          if (other === 0) {
            const sea = this.seas[next];
            if (sea !== 0 && this.portsOf(owner, sea)) flags.coastal = true;
          }
          else if (frontIndex[other * stride + owner] >= 0) flags.touchesEnemy = true;
        }
      }
    }
    return tail;
  }

  /** Poches et ravitaillement des nations d'un groupe (identifiant modulo SUPPLY_GROUPS). */
  private updateSupply(group: number): void {
    const { owners, landCells, visited, visitOrder, pocket, pocketCounts } = this;
    this.supplyDirty &= ~(1 << group);
    const inGroup = (nation: number) => nation % SUPPLY_GROUPS === group;

    const atWar = new Uint8Array(this.stride);
    const enemyNavy = new Float64Array(this.stride);
    for (const front of this.fronts) {
      atWar[front.a] = 1;
      atWar[front.b] = 1;
      enemyNavy[front.a] = Math.max(enemyNavy[front.a], this.navy[front.b]);
      enemyNavy[front.b] = Math.max(enemyNavy[front.b], this.navy[front.a]);
    }

    const pocketList: number[] = [];
    for (const cell of this.pocketLists[group]) pocket[cell] = 0;
    this.pocketLists[group] = pocketList;
    for (let n = group; n < this.stride; n += SUPPLY_GROUPS) pocketCounts[n] = 0;
    this.pockets = this.pockets.filter((entry) => !inGroup(entry.nation));

    // Nations de ce groupe en guerre : les seules dont les cellules comptent ici.
    const active = new Uint8Array(this.stride);
    for (let n = group; n < this.stride; n += SUPPLY_GROUPS) active[n] = atWar[n];
    const { provinceHome, provinceGrid } = this;
    const zones: { owner: number; start: number; end: number; touchesEnemy: boolean; anchored: boolean; coastal: boolean }[] = [];
    const largest = new Int32Array(this.stride);
    const occupied: number[] = [];
    let cursor = 0;
    // Un seul parcours de la terre : territoire conquis à ravitailler, et zones à remplir.
    for (let k = 0; k < landCells.length; k++) {
      const seed = landCells[k];
      const owner = owners[seed];
      if (active[owner] === 0) continue;
      if (provinceHome[provinceGrid[seed]] !== owner) occupied.push(seed);
      if (visited[seed]) continue;
      const flags = { touchesEnemy: false, anchored: false, coastal: false };
      const start = cursor;
      cursor = this.floodFill(seed, cursor, flags);
      zones.push({ owner, start, end: cursor, ...flags });
      if (cursor - start > largest[owner]) largest[owner] = cursor - start;
    }

    const mainClaimed = new Uint8Array(this.stride);
    for (const zone of zones) {
      const size = zone.end - zone.start;
      // La première zone de taille maximale est le cœur du pays.
      if (size === largest[zone.owner] && !mainClaimed[zone.owner]) {
        mainClaimed[zone.owner] = 1;
        continue;
      }
      if (zone.anchored || !zone.touchesEnemy) continue;
      // Par la mer : têtes de pont et côtes tiennent tant que la marine suit.
      const navy = this.navy[zone.owner];
      if (zone.coastal && navy > 0 && navy >= enemyNavy[zone.owner] * NAVAL_SUPPLY_RATIO) continue;
      let sumX = 0;
      let sumY = 0;
      const anchorX = visitOrder[zone.start] % this.width;
      for (let i = zone.start; i < zone.end; i++) {
        const cell = visitOrder[i];
        pocket[cell] = 1;
        pocketList.push(cell);
        const x = cell % this.width;
        sumX += this.wrapDelta(anchorX, x);
        sumY += (cell - x) / this.width;
      }
      if (size >= POCKET_MIN_CELLS_SHOWN) {
        pocketCounts[zone.owner] += size;
        this.pockets.push({
          nation: zone.owner,
          x: anchorX + sumX / size,
          y: sumY / size,
          cells: size,
        });
      }
    }

    // Le marquage de visite ne sert qu'à ce calcul : on l'efface derrière soi.
    for (let i = 0; i < cursor; i++) visited[visitOrder[i]] = 0;

    for (const front of this.fronts) {
      for (let s = 0; s < 2; s++) {
        const nation = s === 0 ? front.a : front.b;
        if (pocketCounts[nation] === 0 || !inGroup(nation)) continue;
        const share = pocketCounts[nation] / Math.max(1, this.cellCounts[nation]);
        front.sides[s].force *= 1 - share * POCKET_DRAIN;
      }
    }
    if (this.logisticsEnabled) this.updateLogistics(group, occupied, enemyNavy, pocketList);
  }

  /**
   * Ravitaillement du territoire conquis : distance au sol national de son occupant, en
   * coût de transport (terrain, infrastructure, consolidation), par l'algorithme de Dial.
   * Une côte conquise est aussi ravitaillée par la mer si la marine la tient. Une poche
   * n'est plus ravitaillée du tout.
   */
  private updateLogistics(group: number, occupied: number[], enemyNavy: Float64Array, pocketList: number[]): void {
    const { owners, provinceGrid, provinceHome, supply, supplyListed, supplyDistance: distance, terrain, width: W, height: H } = this;

    const provinceCost = new Float64Array(this.controller.length);
    for (let p = 1; p < provinceCost.length; p++) {
      const area = Math.max(1, this.provinces[p - 1].areaKm2);
      const density = Math.log10(Math.max(1e-6, (this.provinceGdp[p] * this.development[p]) / area));
      const wealth = Math.max(0, Math.min(1, (density + 1.5) / 3.5));
      const infrastructure = INFRASTRUCTURE_COST_MAX - (INFRASTRUCTURE_COST_MAX - INFRASTRUCTURE_COST_MIN) * wealth;
      const built = 1 - INFRASTRUCTURE_BONUS * this.infrastructure[p];
      provinceCost[p] = infrastructure * built * (1 - (1 - CONSOLIDATED_COST) * this.consolidation[p]);
    }
    // Coût de transport de chaque cellule conquise, en pas entiers.
    const cost = this.supplyCost;
    for (const cell of occupied) {
      distance[cell] = UNREACHED;
      const terrainCost = TERRAIN_SUPPLY_COST[terrain ? terrain[cell] : 0];
      cost[cell] = Math.max(1, Math.round(terrainCost * provinceCost[provinceGrid[cell]] * SUPPLY_COST_SCALE));
    }

    const maxDistance = (SUPPLY_FREE_RANGE + SUPPLY_FADE_RANGE) * SUPPLY_COST_SCALE;
    const buckets: number[][] = Array.from({ length: maxDistance + 1 }, () => []);
    const last = W * (H - 1);
    const seaStart = SEA_SUPPLY_COST * SUPPLY_COST_SCALE;
    // Points de départ : les cellules conquises au contact du sol national, ou d'une mer tenue.
    for (const cell of occupied) {
      const owner = owners[cell];
      const navalSupply = this.navy[owner] > 0 && this.navy[owner] >= enemyNavy[owner] * NAVAL_SUPPLY_RATIO;
      const x = cell % W;
      // Un dépôt ravitaille sa province comme le sol national.
      const province = provinceGrid[cell];
      let start = this.depots[province] === 1 && this.controller[province] === owner ? 0 : Infinity;
      for (let j = 0; j < 4; j++) {
        const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
        if ((j === 2 && cell < W) || (j === 3 && cell >= last)) continue;
        const other = owners[next];
        if (other === owner && provinceHome[provinceGrid[next]] === owner) start = 0;
        else if (other === 0 && navalSupply && this.seas[next] !== 0) {
          const bySea = seaStart + this.seaSupplyCost(owner, this.seas[next], cell);
          if (bySea < start) start = bySea;
        }
      }
      if (start === Infinity) continue;
      const d = start + cost[cell];
      if (d <= maxDistance && d < distance[cell]) {
        distance[cell] = d;
        buckets[d].push(cell);
      }
    }
    for (let d = 0; d <= maxDistance; d++) {
      const bucket = buckets[d];
      for (let i = 0; i < bucket.length; i++) {
        const cell = bucket[i];
        if (distance[cell] !== d) continue;
        const owner = owners[cell];
        const x = cell % W;
        for (let j = 0; j < 4; j++) {
          if ((j === 2 && cell < W) || (j === 3 && cell >= last)) continue;
          const next = j === 0 ? (x > 0 ? cell - 1 : cell + W - 1) : j === 1 ? (x < W - 1 ? cell + 1 : cell - W + 1) : j === 2 ? cell - W : cell + W;
          // Seul le territoire conquis du même occupant prolonge le trajet.
          if (owners[next] !== owner || provinceHome[provinceGrid[next]] === owner) continue;
          const nd = d + cost[next];
          if (nd <= maxDistance && nd < distance[next]) {
            distance[next] = nd;
            buckets[nd].push(next);
          }
        }
      }
    }

    // Nouvelles valeurs, et retour au plein pour ce qui n'est plus occupé.
    const fresh: number[] = [];
    const write = (cell: number, value: number) => {
      if (supplyListed[cell] === 2) return;
      supplyListed[cell] = 2;
      fresh.push(cell);
      if (supply[cell] !== value) {
        supply[cell] = value;
        this.pendingSupplyCells.push(cell);
        this.pendingSupplyValues.push(value);
      }
    };
    for (const cell of pocketList) write(cell, 1);
    for (const cell of occupied) {
      const d = distance[cell] / SUPPLY_COST_SCALE;
      const level = distance[cell] === UNREACHED ? MIN_SUPPLY : d <= SUPPLY_FREE_RANGE ? 1 : Math.max(MIN_SUPPLY, 1 - ((d - SUPPLY_FREE_RANGE) / SUPPLY_FADE_RANGE) * (1 - MIN_SUPPLY));
      write(cell, 1 + Math.round(level * 254));
    }
    for (const cell of this.supplyList) {
      if (supplyListed[cell] === 2) continue;
      // Les cellules des autres groupes attendent leur tour, telles quelles.
      if (owners[cell] % SUPPLY_GROUPS !== group) {
        fresh.push(cell);
        continue;
      }
      supplyListed[cell] = 0;
      if (supply[cell] !== 0) {
        supply[cell] = 0;
        this.pendingSupplyCells.push(cell);
        this.pendingSupplyValues.push(0);
      }
    }
    for (const cell of fresh) supplyListed[cell] = 1;
    this.supplyList = fresh;
  }

  // -------------------------------------------------------------------------
  // Frontière active : seules les cellules touchant un ennemi sont calculées.
  // -------------------------------------------------------------------------

  private isFrontier(cell: number): boolean {
    const { owners, width: W, height: H, stride, frontIndex } = this;
    const owner = owners[cell];
    if (owner === 0) return false;
    const x = cell % W;
    const y = (cell - x) / W;
    const left = owners[x > 0 ? cell - 1 : cell + W - 1];
    if (left !== 0 && left !== owner && frontIndex[left * stride + owner] >= 0) return true;
    const right = owners[x < W - 1 ? cell + 1 : cell - W + 1];
    if (right !== 0 && right !== owner && frontIndex[right * stride + owner] >= 0) return true;
    if (y > 0) {
      const up = owners[cell - W];
      if (up !== 0 && up !== owner && frontIndex[up * stride + owner] >= 0) return true;
    }
    if (y < H - 1) {
      const down = owners[cell + W];
      if (down !== 0 && down !== owner && frontIndex[down * stride + owner] >= 0) return true;
    }
    return false;
  }

  private refreshFrontier(cell: number): void {
    const position = this.frontierPosition[cell];
    const should = this.isFrontier(cell);
    if (should && position < 0) {
      if (this.frontierCount === this.frontier.length) {
        const grown = new Int32Array(this.frontier.length * 2);
        grown.set(this.frontier);
        this.frontier = grown;
      }
      this.frontier[this.frontierCount] = cell;
      this.frontierPosition[cell] = this.frontierCount;
      this.frontierCount++;
    } else if (!should && position >= 0) {
      const last = this.frontier[--this.frontierCount];
      this.frontier[position] = last;
      this.frontierPosition[last] = position;
      this.frontierPosition[cell] = -1;
    }
  }

  // -------------------------------------------------------------------------
  // Sorties
  // -------------------------------------------------------------------------

  /** Tout ce qui a changé depuis le dernier appel. */
  drainChanges(): {
    cells: Uint32Array;
    owners: Uint16Array;
    provinces: Uint16Array;
    homes: Uint16Array;
    supplyCells: Uint32Array;
    supplyValues: Uint8Array;
    fortCells: Uint32Array;
    fortValues: Uint8Array;
    events: SimEvent[];
  } {
    const changes = {
      cells: Uint32Array.from(this.pendingCells),
      owners: Uint16Array.from(this.pendingOwners),
      provinces: Uint16Array.from(this.pendingProvinces),
      homes: Uint16Array.from(this.pendingHomes),
      supplyCells: Uint32Array.from(this.pendingSupplyCells),
      supplyValues: Uint8Array.from(this.pendingSupplyValues),
      fortCells: Uint32Array.from(this.pendingFortCells),
      fortValues: Uint8Array.from(this.pendingFortValues),
      events: this.pendingEvents,
    };
    this.pendingFortCells = [];
    this.pendingFortValues = [];
    this.pendingSupplyCells = [];
    this.pendingSupplyValues = [];
    this.pendingCells = [];
    this.pendingOwners = [];
    this.pendingProvinces = [];
    this.pendingHomes = [];
    this.pendingEvents = [];
    return changes;
  }

  /**
   * Nouvel emplacement du nom des nations dont le territoire a nettement changé.
   * Sans effet sur la partie : c'est de l'affichage.
   */
  updateLabels(): NationLabel[] {
    const changed: number[] = [];
    const updates: NationLabel[] = [];
    for (let n = 1; n < this.stride; n++) {
      if (this.labelCells[n] < 0) continue;
      if (!this.alive[n] || this.cellCounts[n] === 0) {
        this.labelCells[n] = -1;
        updates.push({ id: n, x: 0, y: 0, r: -1 });
      } else if (Math.abs(this.cellCounts[n] - this.labelCells[n]) > this.labelCells[n] * 0.05) {
        changed.push(n);
      }
    }
    if (changed.length === 0) return updates;

    const w = this.width >> 1;
    const h = this.height >> 1;
    const grid = new Uint16Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) grid[y * w + x] = this.owners[y * 2 * this.width + x * 2];
    }
    const distances = distanceToBoundary(grid, w, h);
    const best = new Float32Array(this.stride).fill(-1);
    const bestCell = new Int32Array(this.stride);
    for (let i = 0; i < grid.length; i++) {
      const owner = grid[i];
      if (owner !== 0 && distances[i] > best[owner]) {
        best[owner] = distances[i];
        bestCell[owner] = i;
      }
    }
    for (const n of changed) {
      if (best[n] < 0) continue;
      this.labelCells[n] = this.cellCounts[n];
      const x = bestCell[n] % w;
      updates.push({ id: n, x: x * 2, y: ((bestCell[n] - x) / w) * 2, r: best[n] * 2 });
    }
    return updates;
  }

  /** Économie de tout le monde, pour la carte économique et la fiche des pays. */
  economySnapshot(): EconomySnapshot {
    return {
      development: Float32Array.from(this.development),
      provinceGdp: Float32Array.from(this.provinceGdp),
      output: Float32Array.from(this.output),
      capacity: Float32Array.from(this.capacity),
      effort: Float32Array.from(this.effort),
      consolidation: Float32Array.from(this.consolidation),
      factories: this.factories.slice(),
      infrastructure: this.infrastructure.slice(),
      buildings: {
        refinery: this.buildings.refinery.slice(),
        steelworks: this.buildings.steelworks.slice(),
        recruitment: this.buildings.recruitment.slice(),
        services: this.buildings.services.slice(),
        shipyard: this.buildings.shipyard.slice(),
      },
      depots: this.depots.slice(),
      stability: Float32Array.from(this.stability),
      aggression: Float32Array.from(this.aggression),
      coalitionAgainst: this.coalitionAgainst.slice(),
      alliances: Uint16Array.from(this.pairsOf((a, b) => this.allied[a * this.stride + b]).flat()),
      doctrine: Float32Array.from(this.doctrine),
      tradeDeals: Uint16Array.from(this.tradeDeals.flat()),
      embargoes: Uint16Array.from(this.embargoes.flat()),
      truces: Uint16Array.from(this.pairsOf((a, b) => (this.hasTruce(a, b) ? 1 : 0)).flatMap(([a, b]) => [a, b])),
      provinceUnrest: this.provinceUnrest(),
    };
  }

  /** Agitation de chaque province : celle du mouvement de sa région dans le pays qui la tient. */
  private provinceUnrest(): Uint8Array {
    const unrest = new Uint8Array(this.controller.length);
    if (this.movements.length === 0) return unrest;
    const byKey = new Map<number, number>();
    for (const movement of this.movements) byKey.set(movement.parent * this.stride + movement.origin, movement.unrest);
    for (let p = 1; p < this.controller.length; p++) {
      const holder = this.controller[p];
      if (holder === 0) continue;
      const origin = this.claimantOf(p, holder);
      if (origin === 0) continue;
      const value = byKey.get(holder * this.stride + origin);
      if (value !== undefined) unrest[p] = 1 + Math.round(value * 254);
    }
    return unrest;
  }

  snapshot(): SimSnapshot {
    const fronts: FrontSnapshot[] = this.fronts.map((front) => {
      const side = (s: FrontSide) => ({ allocation: s.allocation, stance: s.stance, force: s.force, captured: s.captured, supply: s.supply, priority: s.priority });
      return {
        a: front.a,
        b: front.b,
        length: front.length,
        logRatio: front.logRatio,
        marks: front.a === this.player || front.b === this.player ? this.frontMarks(front) : [],
        sides: [side(front.sides[0]), side(front.sides[1])],
      };
    });
    const participants = new Set<number>();
    if (this.player) participants.add(this.player);
    for (const front of this.fronts) {
      participants.add(front.a);
      participants.add(front.b);
    }
    return {
      tick: this.tick,
      frontierSize: this.frontierCount,
      aliveNations: this.aliveCount,
      fronts,
      nations: [...participants].map((id) => ({
        id,
        army: this.armyOf(id),
        reserve: this.reserve[id],
        capacity: this.capacity[id],
        cells: this.cellCounts[id],
        pocketCells: this.pocketCounts[id],
        navy: this.navy[id],
        output: this.output[id],
        effort: this.effort[id],
        effortTarget: this.effortTarget[id],
        growth: this.growth[id],
        effortCap: this.effortCap(id),
        manpower: this.manpower[id],
        manpowerMax: this.manpowerMax[id],
        stability: this.stability[id],
        oil: this.oilCoverage[id],
        steel: this.steelCoverage[id],
        blockaded: this.blockaded[id] === 1,
        trade: this.tradeAccess[id],
        tradeFactor: this.tradeFactor[id],
        deals: id === this.player ? this.dealsOf(id) : [],
        embargoes: id === this.player ? this.embargoes.filter(([from]) => from === id).map(([, to]) => to) : [],
        embargoedBy: id === this.player ? this.embargoes.filter(([, to]) => to === id).map(([from]) => from) : [],
        construction: this.constructionRate[id],
        militaryShare: this.militaryShare[id],
        // La file de chantiers ne sert qu'au joueur.
        builds:
          id === this.player
            ? this.queues[id].map((order, index) => ({
                province: order.province,
                kind: order.kind,
                cellCount: order.kind === 'axis' ? Math.round(order.length ?? 0) : (order.cells?.length ?? 0),
                cost: this.orderCost(order),
                progress:
                  this.queues[id].findIndex((entry) => isMilitaryBuild(entry.kind) === isMilitaryBuild(order.kind)) === index
                    ? (isMilitaryBuild(order.kind) ? this.militaryProgress : this.buildProgress)[id]
                    : 0,
                military: isMilitaryBuild(order.kind),
                region: order.region ?? 0,
                axis: order.axis ?? 0,
              }))
            : [],
        doctrine: this.doctrineOf(id),
        axisTerminals: id === this.player ? this.axisTerminals(id) : 0,
        network:
          id === this.player && this.autoTrade
            ? (() => {
                const { base, territory, research, total } = this.hubCapacityOf(id);
                const network = this.networkOf(id);
                return { principal: network.principal.slice(), hubs: network.hubs.slice(), capacity: total, base, territory, research };
              })()
            : null,
        doctrineTarget: id === this.player ? Array.from(this.doctrineTarget.subarray(id * DOCTRINE_AXIS_COUNT, (id + 1) * DOCTRINE_AXIS_COUNT)) : [],
        research: id === this.player ? Array.from(this.research.subarray(id * DOCTRINE_AXIS_COUNT, (id + 1) * DOCTRINE_AXIS_COUNT)) : [],
        movements: this.movements
          .filter((movement) => movement.parent === id)
          .map(({ origin, unrest, share, demand, until, investing, care, ceiling }) => ({
            origin,
            unrest,
            share,
            demand,
            until,
            investing,
            care: care ?? 0,
            ceiling: ceiling ?? 0,
          })),
        counterShare: this.counterShare[id],
        regionPolicies:
          id === this.player
            ? [...this.regionPolicies]
                .filter(([key]) => Math.floor(key / this.stride) === id)
                .map(([key, policy]) => ({ origin: key % this.stride, tax: policy.tax, levy: policy.levy }))
            : [],
        priorityZones: id === this.player ? this.priorityZones[id].map((zone) => ({ ...zone })) : [],
        aggression: this.aggression[id],
        profile: this.profile[id],
        allies: id === this.player ? this.alliesOf(id).filter((other) => this.allied[id * this.stride + other] === 1) : [],
        truces:
          id === this.player
            ? [...Array(this.stride).keys()]
                .filter((other) => other > 0 && this.hasTruce(id, other))
                .map((other) => ({ nation: other, until: this.truceUntil[id * this.stride + other] }))
            : [],
        peaceOffers: this.peaceOffers.filter((offer) => offer.to === id).map((offer) => ({ nation: offer.from, until: offer.until })),
        coalition: [...Array(this.stride).keys()].filter((n) => n > 0 && this.alive[n] && this.coalitionAgainst[n] === id),
      })),
      offensives: this.offensives.map(({ id, nation, fromX, fromY, toX, toY, force, startForce, captured, transitUntil, targetX, targetY, supply, counter }) => ({
        id,
        nation,
        fromX,
        fromY,
        toX: transitUntil > 0 ? targetX : toX,
        toY: transitUntil > 0 ? targetY : toY,
        force,
        startForce,
        captured,
        inTransit: transitUntil > 0,
        supply,
        counter,
      })),
      pockets: this.pockets,
      axes: this.axesSnapshot(),
    };
  }

  /**
   * Points répartis le long d'un front : une cellule de chaque camp par carré de FRONT_MARK_SPACING
   * cellules, au plus FRONT_MARK_MAX ; c'est de l'affichage.
   */
  private frontMarks(front: Front): number[] {
    const { owners, width: W, height: H } = this;
    const SPACING = 24;
    const MAX = 16;
    const seen = new Set<number>();
    const marks: number[] = [];
    for (let i = 0; i < this.frontierCount && marks.length < MAX * 3; i++) {
      const cell = this.frontier[i];
      const owner = owners[cell];
      if (owner !== front.a && owner !== front.b) continue;
      const enemy = owner === front.a ? front.b : front.a;
      const x = cell % W;
      const y = (cell - x) / W;
      const touches =
        owners[y * W + ((x + 1) % W)] === enemy ||
        owners[y * W + ((x + W - 1) % W)] === enemy ||
        (y > 0 && owners[cell - W] === enemy) ||
        (y < H - 1 && owners[cell + W] === enemy);
      if (!touches) continue;
      const side = owner === front.a ? 0 : 1;
      const bucket = (Math.floor(y / SPACING) * 1024 + Math.floor(x / SPACING)) * 2 + side;
      if (seen.has(bucket)) continue;
      seen.add(bucket);
      marks.push(x, y, side);
    }
    return marks;
  }

  /** Axes du monde, seulement s'ils ont changé depuis le dernier instantané : c'est de l'affichage. */
  private axesSnapshot(): AxisSnapshot[] | undefined {
    if (this.sentAxesVersion === this.axesVersion) return undefined;
    this.sentAxesVersion = this.axesVersion;
    const W = this.width;
    return this.axes.map((axis) => {
      // Les villes traversées : le centre de chaque province, et qui la tient.
      const points: number[] = [];
      for (const p of axis.provinces) points.push(((this.provinces[p - 1].x % W) + W) % W, this.provinces[p - 1].y);
      return {
        id: axis.id,
        nation: axis.nation,
        sea: axis.sea,
        active: axis.active,
        provinces: axis.provinces.length,
        points,
        path: axis.provinces.slice(),
        held: axis.provinces.map((p) => this.axisAllows(axis.nation, this.controller[p])),
        partner: axis.partner ?? 0,
        auto: axis.auto === true,
        seaLinks: this.seaLinksOf(axis),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Sauvegarde : tout ce qui n'est pas déductible de la carte de départ.
  // -------------------------------------------------------------------------

  save(): SimSave {
    return {
      owners: this.owners.slice(),
      supply: this.supply.slice(),
      forts: this.forts.slice(),
      state: {
        tick: this.tick,
        rngState: this.rngState,
        player: this.player,
        nextOffensiveId: this.nextOffensiveId,
        supplyDirty: this.supplyDirty,
        fronts: this.fronts.map((front) => ({ ...front, sides: front.sides.map((side) => ({ ...side })) })),
        offensives: this.offensives.map((offensive) => ({ ...offensive })),
        frontier: Array.from(this.frontier.subarray(0, this.frontierCount)),
        sectors: Array.from(this.sectors),
        reserve: Array.from(this.reserve),
        capacity: Array.from(this.capacity),
        cellCounts: Array.from(this.cellCounts),
        navy: Array.from(this.navy),
        alive: Array.from(this.alive),
        heldHome: Array.from(this.heldHome),
        totalHome: Array.from(this.totalHome),
        provinceHome: Array.from(this.provinceHome),
        provinceValue: Array.from(this.provinceValue),
        controller: Array.from(this.controller),
        provinceCounts: this.provinceCounts.map((counts) => (counts ? [...counts] : null)),
        // Une cellule prise dans une poche n'en fait plus partie, même si elle reste dans la liste.
        pocketLists: this.pocketLists.map((list) => list.filter((cell) => this.pocket[cell] === 1)),
        pocketCounts: Array.from(this.pocketCounts),
        pockets: this.pockets.map((pocket) => ({ ...pocket })),
        landNeighbors: this.landNeighbors,
        seaNeighbors: this.seaNeighbors,
        labelCells: Array.from(this.labelCells),
        provinceGdp: Array.from(this.provinceGdp),
        development: Array.from(this.development),
        effort: Array.from(this.effort),
        effortTarget: Array.from(this.effortTarget),
        growth: Array.from(this.growth),
        consolidation: Array.from(this.consolidation),
        rawCapacity: Array.from(this.rawCapacity),
        provinceManpower: Array.from(this.provinceManpower),
        manpower: Array.from(this.manpower),
        manpowerMax: Array.from(this.manpowerMax),
        armyAfterReinforce: Array.from(this.armyAfterReinforce),
        losses: Array.from(this.losses),
        stability: Array.from(this.stability),
        oilCoverage: Array.from(this.oilCoverage),
        steelCoverage: Array.from(this.steelCoverage),
        blockaded: Array.from(this.blockaded),
        factories: Array.from(this.factories),
        infrastructure: Array.from(this.infrastructure),
        buildings: {
          refinery: Array.from(this.buildings.refinery),
          steelworks: Array.from(this.buildings.steelworks),
          recruitment: Array.from(this.buildings.recruitment),
          services: Array.from(this.buildings.services),
          shipyard: Array.from(this.buildings.shipyard),
        },
        depots: Array.from(this.depots),
        queues: this.queues.map((queue) => queue.map((order) => ({ ...order }))),
        buildProgress: Array.from(this.buildProgress),
        militaryProgress: Array.from(this.militaryProgress),
        militaryShare: Array.from(this.militaryShare),
        constructionRate: Array.from(this.constructionRate),
        counterShare: Array.from(this.counterShare),
        counterAttempts: [...this.counterAttempts].map(([key, attempts]) => {
          const [nation, id] = key.split(':').map(Number);
          return [nation, id, attempts] as [number, number, number];
        }),
        priorityZones: this.priorityZones.map((zones) => zones.map((zone) => ({ ...zone }))),
        alliances: this.pairsOf((a, b) => this.allied[a * this.stride + b]),
        truces: this.pairsOf((a, b) => (this.hasTruce(a, b) ? this.truceUntil[a * this.stride + b] : 0)),
        aggression: Array.from(this.aggression),
        coalitionAgainst: Array.from(this.coalitionAgainst),
        peaceOffers: this.peaceOffers.map((offer) => ({ ...offer })),
        lastPeaceOffer: Array.from(this.lastPeaceOffer),
        lastWarOnPlayer: this.lastWarOnPlayer,
        nextPlayerDemand: this.nextPlayerDemand,
        profiles: Array.from(this.profile),
        tradeDeals: this.tradeDeals.map(([a, b]) => [a, b] as [number, number]),
        embargoes: this.embargoes.map(([a, b]) => [a, b] as [number, number]),
        tradeAccess: Array.from(this.tradeAccess),
        tradeFactor: Array.from(this.tradeFactor),
        coastSeas: Array.from(this.coastSeas),
        axes: this.axes.map((axis) => ({ ...axis, provinces: axis.provinces.slice() })),
        nextAxisId: this.nextAxisId,
        networkPhase: this.networkPhase,
        networks: Array.from({ length: this.stride }, (_, n) => {
          const network = this.networks[n];
          return network ? { hubs: network.hubs.slice(), principal: network.principal.slice(), capacity: network.capacity } : { hubs: [], principal: [], capacity: -1 };
        }),
        doctrine: Array.from(this.doctrine),
        doctrineTarget: Array.from(this.doctrineTarget),
        research: Array.from(this.research),
        movements: this.movements.map((movement) => ({ ...movement })),
        regionPolicies: [...this.regionPolicies].map(([key, policy]) => [Math.floor(key / this.stride), key % this.stride, policy.tax, policy.levy] as [number, number, number, number]),
      },
    };
  }

  private restore(saved: SimSave): void {
    const { state } = saved;
    // Une sauvegarde d'une version plus ancienne n'a pas tout : ce qui manque garde les
    // valeurs d'une partie neuve, calculées par le constructeur.
    const legacy = state as Partial<SimSaveState>;
    const startHome = this.provinceHome.slice();
    this.owners.set(saved.owners);
    this.tick = state.tick;
    this.rngState = state.rngState;
    this.nextOffensiveId = state.nextOffensiveId;
    this.supplyDirty = state.supplyDirty;
    this.sectors.set(state.sectors);
    this.reserve.set(state.reserve);
    this.capacity.set(state.capacity);
    this.cellCounts.set(state.cellCounts);
    this.navy.set(state.navy);
    this.alive.set(state.alive);
    this.heldHome.set(state.heldHome);
    this.totalHome.set(state.totalHome);
    this.provinceHome.set(state.provinceHome);
    this.homePortsStale = true;
    this.provinceValue.set(state.provinceValue);
    this.controller.set(state.controller);
    state.provinceCounts.forEach((counts, province) => {
      this.provinceCounts[province] = counts ? new Map(counts) : null;
    });
    this.pocketCounts.set(state.pocketCounts);
    this.pockets = state.pockets;
    this.pocketLists = state.pocketLists.map((list) => list.slice());
    for (const list of this.pocketLists) for (const cell of list) this.pocket[cell] = 1;
    this.landNeighbors = state.landNeighbors;
    this.seaNeighbors = state.seaNeighbors;
    this.labelCells.set(state.labelCells);
    // Une province annexée avant que ces valeurs existent n'en garde que la part annexée.
    for (const [values, target] of [
      [legacy.provinceGdp, this.provinceGdp],
      [legacy.provinceManpower, this.provinceManpower],
    ] as const) {
      if (values) target.set(values);
      else {
        for (let p = 1; p < target.length; p++) if (state.provinceHome[p] !== startHome[p]) target[p] *= ANNEXED_VALUE;
      }
    }
    const restoreArray = (target: Float64Array | Uint8Array, values: number[] | undefined) => {
      if (values) target.set(values);
    };
    restoreArray(this.development, legacy.development);
    restoreArray(this.effort, legacy.effort);
    restoreArray(this.effortTarget, legacy.effortTarget);
    restoreArray(this.growth, legacy.growth);
    restoreArray(this.consolidation, legacy.consolidation);
    restoreArray(this.manpower, legacy.manpower);
    restoreArray(this.armyAfterReinforce, legacy.armyAfterReinforce);
    restoreArray(this.losses, legacy.losses);
    restoreArray(this.stability, legacy.stability);
    restoreArray(this.oilCoverage, legacy.oilCoverage);
    restoreArray(this.steelCoverage, legacy.steelCoverage);
    restoreArray(this.blockaded, legacy.blockaded);
    restoreArray(this.factories, legacy.factories);
    restoreArray(this.infrastructure, legacy.infrastructure);
    for (const kind of Object.keys(this.buildings) as ProvinceBuilding[]) restoreArray(this.buildings[kind], legacy.buildings?.[kind]);
    restoreArray(this.depots, legacy.depots);
    if (legacy.queues) this.queues = legacy.queues.map((queue) => queue.map((order) => ({ ...order })));
    restoreArray(this.buildProgress, legacy.buildProgress);
    restoreArray(this.militaryProgress, legacy.militaryProgress);
    restoreArray(this.militaryShare, legacy.militaryShare);
    restoreArray(this.constructionRate, legacy.constructionRate);
    restoreArray(this.counterShare, legacy.counterShare);
    if (legacy.counterAttempts) this.counterAttempts = new Map(legacy.counterAttempts.map(([nation, id, attempts]) => [`${nation}:${id}`, attempts]));
    if (legacy.priorityZones) this.priorityZones = legacy.priorityZones.map((zones) => zones.map((zone) => ({ ...zone })));
    for (const [a, b, kind] of legacy.alliances ?? []) this.setAlliance(a, b, kind);
    for (const [a, b, until] of legacy.truces ?? []) {
      this.truceUntil[a * this.stride + b] = until;
      this.truceUntil[b * this.stride + a] = until;
    }
    restoreArray(this.aggression, legacy.aggression);
    if (legacy.coalitionAgainst) this.coalitionAgainst.set(legacy.coalitionAgainst);
    this.peaceOffers = (legacy.peaceOffers ?? []).map((offer) => ({ ...offer }));
    restoreArray(this.lastPeaceOffer, legacy.lastPeaceOffer);
    if (typeof legacy.lastWarOnPlayer === 'number') this.lastWarOnPlayer = legacy.lastWarOnPlayer;
    if (typeof legacy.nextPlayerDemand === 'number') this.nextPlayerDemand = legacy.nextPlayerDemand;
    if (legacy.profiles) this.profile.set(legacy.profiles.slice(0, this.stride));
    for (const [a, b] of legacy.tradeDeals ?? []) this.setTradeDeal(a, b, true);
    for (const [a, b] of legacy.embargoes ?? []) this.setEmbargoFlag(a, b, true);
    restoreArray(this.tradeAccess, legacy.tradeAccess);
    restoreArray(this.tradeFactor, legacy.tradeFactor);
    if (legacy.coastSeas) this.coastSeas = Uint32Array.from(legacy.coastSeas);
    this.axes = (legacy.axes ?? []).map((axis) => ({ ...axis, provinces: axis.provinces.slice() }));
    this.nextAxisId = legacy.nextAxisId ?? 1;
    // Un réseau jamais calculé (capacité -1) le sera à son tour.
    this.networks = [];
    (legacy.networks ?? []).forEach((network, n) => {
      if (network && network.capacity >= 0) this.networks[n] = { hubs: network.hubs.slice(), principal: network.principal.slice(), capacity: network.capacity };
    });
    this.networkPhase = legacy.networkPhase ?? 0;
    if (this.tradeDeals.length > 0 && !this.axes.some((axis) => axis.partner)) {
      for (const [a, b] of this.tradeDeals) this.buildDealRoute(a, b);
    }
    this.recomputeAxisBonus();
    // Une partie d'avant les doctrines garde les cibles tirées pour l'IA, et part du centre.
    restoreArray(this.doctrine, legacy.doctrine);
    restoreArray(this.doctrineTarget, legacy.doctrineTarget);
    if (legacy.research) this.research.set(legacy.research.slice(0, this.research.length));
    for (let n = 1; n < this.stride; n++) this.mods[n] = doctrineModifiers(this.doctrineOf(n));
    if (this.player) this.playerArchetype = archetypeOf(this.doctrineOf(this.player));
    for (const [nation, origin, tax, levy] of legacy.regionPolicies ?? []) this.regionPolicies.set(nation * this.stride + origin, { tax, levy });
    this.movements = (legacy.movements ?? []).map((movement) => ({ ...movement, invested: movement.invested ?? 0, refused: movement.refused ?? 0, care: movement.care ?? 0, ceiling: movement.ceiling ?? 0 }));
    this.refreshProvincePolicies();
    if (saved.forts) {
      this.forts.set(saved.forts);
      for (let k = 0; k < this.landCells.length; k++) {
        const cell = this.landCells[k];
        if (this.forts[cell] === 0) continue;
        this.pendingFortCells.push(cell);
        this.pendingFortValues.push(this.forts[cell]);
      }
    }
    this.recomputeCapacity();
    this.recomputeManpower();
    // Le ravitaillement repart tel quel : le recalculer ici changerait la suite de la partie.
    if (saved.supply) this.supply.set(saved.supply);
    for (let k = 0; k < this.landCells.length; k++) {
      const cell = this.landCells[k];
      if (this.supply[cell] === 0) continue;
      this.supplyList.push(cell);
      this.supplyListed[cell] = 1;
      this.pendingSupplyCells.push(cell);
      this.pendingSupplyValues.push(this.supply[cell]);
    }

    this.fronts = state.fronts.map((front) => ({ ...front, startTick: front.startTick ?? state.tick, sides: front.sides.map((side) => ({ ...side })) }));
    this.reindexFronts();
    for (const offensive of state.offensives) {
      const copy = { ...offensive };
      this.offensives.push(copy);
      this.offensivesByNation[copy.nation].push(copy);
    }

    // L'ordre de la frontière fixe l'ordre des tirages au sort : il est conservé.
    if (state.frontier.length > this.frontier.length) this.frontier = new Int32Array(state.frontier.length * 2);
    state.frontier.forEach((cell, index) => {
      this.frontier[index] = cell;
      this.frontierPosition[cell] = index;
    });
    this.frontierCount = state.frontier.length;
  }

  /** Empreinte de l'état complet, pour vérifier le déterminisme. */
  stateHash(): number {
    let hash = 2166136261;
    const mix = (value: number) => {
      hash = Math.imul(hash ^ value, 16777619) >>> 0;
    };
    for (let i = 0; i < this.owners.length; i++) mix(this.owners[i]);
    for (const front of this.fronts) {
      mix(Math.round(front.sides[0].force * 1000));
      mix(Math.round(front.sides[1].force * 1000));
    }
    for (const offensive of this.offensives) mix(Math.round(offensive.force * 1000));
    for (let n = 1; n < this.stride; n++) {
      mix(Math.round(this.reserve[n] * 1000));
      mix(Math.round(this.effort[n] * 1e6));
      mix(Math.round(this.manpower[n] * 1000));
      mix(Math.round(this.stability[n] * 1e6));
      mix(Math.round(this.buildProgress[n] * 1000));
      mix(Math.round(this.militaryProgress[n] * 1000) + Math.round(this.militaryShare[n] * 100));
      mix(this.queues[n].length);
      mix(Math.round(this.counterShare[n] * 1000));
      mix(this.priorityZones[n].length);
      mix(Math.round(this.aggression[n] * 1e6));
      mix(this.coalitionAgainst[n]);
      for (let m = n + 1; m < this.stride; m++) {
        if (this.allied[n * this.stride + m]) mix(n * 65536 + m * 4 + this.allied[n * this.stride + m]);
        if (this.hasTruce(n, m)) mix(this.truceUntil[n * this.stride + m]);
      }
    }
    for (let n = 1; n < this.stride; n++) if (this.lastPeaceOffer[n] > 0) mix(this.lastPeaceOffer[n] + n);
    if (this.lastWarOnPlayer > 0) mix(this.lastWarOnPlayer);
    mix(this.nextPlayerDemand);
    for (const [a, b] of this.tradeDeals) mix(a * 65536 + b);
    for (const [a, b] of this.embargoes) mix(a * 65536 + b + 7);
    for (const axis of this.axes) mix(axis.id * 1024 + axis.nation * 2 + (axis.active ? 1 : 0));
    for (let n = 1; n < this.stride; n++) mix(Math.round(this.tradeFactor[n] * 1e6));
    mix(this.networkPhase);
    for (const [key, policy] of this.regionPolicies) mix(key * 25 + (policy.tax + 2) * 5 + (policy.levy + 2));
    for (const network of this.networks) if (network) mix(network.hubs.length * 4096 + network.principal.length);
    for (let i = DOCTRINE_AXIS_COUNT; i < this.doctrine.length; i++) {
      mix(Math.round(this.doctrine[i] * 1e6) + this.research[i]);
      mix(Math.round(this.doctrineTarget[i] * 1e6));
    }
    for (const movement of this.movements) {
      mix(movement.parent * 65536 + movement.origin);
      mix(Math.round(movement.unrest * 1e6) + movement.asked + 8 * (movement.invested ?? 0));
    }
    let fortSum = 0;
    for (let k = 0; k < this.landCells.length; k++) {
      const cell = this.landCells[k];
      if (this.forts[cell] !== 0) fortSum = (fortSum + Math.imul(cell + 1, 2654435761) + this.forts[cell]) >>> 0;
    }
    mix(fortSum);
    for (let p = 1; p < this.factories.length; p++) mix(this.factories[p] * 16 + this.infrastructure[p] * 2 + this.depots[p]);
    for (const levels of Object.values(this.buildings)) for (let p = 1; p < levels.length; p++) if (levels[p]) mix(p * 8 + levels[p]);
    for (let p = 1; p < this.development.length; p++) {
      mix(Math.round(this.development[p] * 1e6));
      mix(Math.round(this.consolidation[p] * 1e6));
    }
    // Somme commutative : l'ordre de la liste ne change rien à la partie.
    let supplySum = 0;
    for (const cell of this.supplyList) {
      // Une cellule revenue au plein attend d'être retirée de la liste : elle ne compte pas.
      if (this.supply[cell] !== 0) supplySum = (supplySum + Math.imul(cell + 1, 2654435761) + this.supply[cell]) >>> 0;
    }
    mix(supplySum);
    mix(this.rngState);
    return hash;
  }
}
