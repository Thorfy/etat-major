// Messages échangés entre le jeu et le Worker de simulation.
import type { ProvinceBuilding } from './balance.ts';
// Partout, un identifiant de nation est son propriétaire de grille : indice + 1.

export type Stance = 'attack' | 'hold' | 'retreat';

/**
 * Chantiers : usine (PIB et capacité), infrastructure (transport), dépôt (ravitaillement),
 * fortifications (une bande de cellules, sans province).
 */
export type BuildKind = 'factory' | 'infrastructure' | 'depot' | 'fort' | 'investment' | 'axis' | 'research' | ProvinceBuilding;

export interface BuildOrder {
  province: number;
  kind: BuildKind;
  /** Cellules à fortifier, pour un chantier de fortifications. */
  cells?: number[];
  /** Axe commercial : provinces traversées, ligne maritime ou non, et longueur en cellules. */
  path?: number[];
  sea?: boolean;
  length?: number;
  /** Investissements : la région (pays d'origine annexé) qui les a demandés, et leur coût. */
  region?: number;
  cost?: number;
  /** Recherche : l'axe de doctrine dont elle repousse les bornes. */
  axis?: number;
}

/** Axe commercial tracé entre deux provinces d'un pays. */
export interface TradeAxis {
  id: number;
  nation: number;
  sea: boolean;
  /** Provinces traversées, dans l'ordre : elles en profitent. Ses deux ports pour une ligne maritime. */
  provinces: number[];
  /** Longueur, en cellules, de centre en centre. */
  length: number;
  /** Faux : coupé par l'ennemi, ou sous blocus. */
  active: boolean;
}

export interface AxisSnapshot {
  id: number;
  nation: number;
  sea: boolean;
  active: boolean;
  provinces: number;
  /** Centres des provinces traversées : x, y, x, y… */
  points: number[];
  /** Pour chacune : encore tenue par le pays de l'axe. */
  held: boolean[];
}

/** Ce qu'une région agitée demande : des investissements, ou l'indépendance sans combat. */
export type DemandKind = 'investment' | 'independence';

/** Une région annexée, ou une région historique, qui s'agite dans le pays qui la tient. */
export interface MovementState {
  parent: number;
  /** Pays d'origine disparu, ou région historique en sommeil, qui naîtrait. */
  origin: number;
  /** Agitation, de 0 à 1 : à 1, la région se soulève. */
  unrest: number;
  /** Part de la valeur du pays qu'elle pèse. */
  share: number;
  /** Demandes déjà faites depuis le dernier calme : 1 investissements, 2 indépendance. */
  asked: number;
  /** Demande en attente de réponse ('' : aucune), et son échéance. */
  demand: '' | DemandKind;
  until: number;
  /** Investissements acceptés, en chantier. */
  investing: boolean;
  /** Programmes d'investissements achevés. */
  invested: number;
  /** Demandes refusées depuis le dernier calme : chacune monte le plafond. */
  refused: number;
  /** Équipement de la région, de 0 à 1, et plafond vers lequel tend son agitation. */
  care: number;
  ceiling: number;
}

/** Secteur prioritaire : un disque de la carte où les forces d'un front se concentrent. */
export interface PriorityZone {
  x: number;
  y: number;
}

export type SimCommand =
  | { type: 'declareWars'; pairs: [number, number][] }
  | { type: 'setFront'; nation: number; enemy: number; allocation: number; stance: Stance }
  | { type: 'launchOffensive'; nation: number; fromX: number; fromY: number; toX: number; toY: number; share: number }
  | { type: 'cancelOffensive'; nation: number; id: number }
  /** Effort de guerre voulu, de 0 à 1 : l'économie s'y reconvertit progressivement. */
  | { type: 'setEffort'; nation: number; effort: number }
  | { type: 'build'; nation: number; province: number; kind: BuildKind }
  | { type: 'cancelBuild'; nation: number; index: number }
  | { type: 'fortifyLine'; nation: number; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'fortifyFront'; nation: number; enemy: number }
  | { type: 'setCounterShare'; nation: number; share: number }
  | { type: 'addPriority'; nation: number; x: number; y: number }
  | { type: 'removePriority'; nation: number; index: number }
  /** Proposer la paix : l'ennemi l'accepte ou non, aussitôt. */
  | { type: 'proposePeace'; nation: number; enemy: number }
  /** Répondre à une offre de paix reçue. */
  | { type: 'answerPeace'; nation: number; enemy: number; accept: boolean }
  /** Répondre à la demande d'une région agitée. */
  | { type: 'answerDemand'; nation: number; origin: number; accept: boolean }
  | { type: 'proposeAlliance'; nation: number; other: number }
  | { type: 'breakAlliance'; nation: number; other: number }
  | { type: 'proposeTradeDeal'; nation: number; other: number }
  | { type: 'endTradeDeal'; nation: number; other: number }
  | { type: 'setEmbargo'; nation: number; other: number; on: boolean }
  | { type: 'buildAxis'; nation: number; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'removeAxis'; nation: number; id: number }
  /** Doctrine visée sur un axe, de −1 à +1 : la doctrine y glisse peu à peu, dans les bornes de la recherche. */
  | { type: 'setDoctrine'; nation: number; axis: number; value: number }
  /** Ajoute à la file de chantiers la recherche du niveau suivant d'un axe de doctrine. */
  | { type: 'research'; nation: number; axis: number };

export interface FrontSnapshot {
  a: number;
  b: number;
  length: number;
  /** Log du rapport de force de `a` sur `b`, posture comprise. */
  logRatio: number;
  sides: [FrontSideSnapshot, FrontSideSnapshot];
}

export interface FrontSideSnapshot {
  allocation: number;
  stance: Stance;
  force: number;
  captured: number;
  /** Ravitaillement moyen de ses cellules de front, de 0 à 1. */
  supply: number;
  /** Part de ses cellules de front en secteur prioritaire. */
  priority: number;
}

export interface NationSnapshot {
  id: number;
  army: number;
  reserve: number;
  capacity: number;
  cells: number;
  pocketCells: number;
  navy: number;
  /** PIB courant, en millions de dollars. */
  output: number;
  /** Effort de guerre atteint, et effort visé. */
  effort: number;
  effortTarget: number;
  /** Croissance du PIB par minute (négative : usure de l'économie de guerre). */
  growth: number;
  /** Effort maximal que permet la stabilité. */
  effortCap: number;
  manpower: number;
  manpowerMax: number;
  /** Stabilité, de 0 à 1 : la lassitude de guerre la fait baisser. */
  stability: number;
  /** Part des besoins en pétrole et en acier couverte, de 0 à 1. */
  oil: number;
  steel: number;
  /** Une marine ennemie bien plus forte coupe les importations par la mer. */
  blockaded: boolean;
  /** Accès au commerce, de 0 à 1, et multiplicateur du PIB qui en vient. */
  trade: number;
  tradeFactor: number;
  /** Joueur seulement : accords commerciaux, embargos qu'il impose, et qu'il subit. */
  deals: number[];
  embargoes: number[];
  embargoedBy: number[];
  /** Points de construction par minute. */
  construction: number;
  /** File de chantiers (joueur seulement) ; seul le premier avance. */
  builds: { province: number; kind: BuildKind; cellCount: number; cost: number; progress: number; region: number; axis: number }[];
  /** Doctrine atteinte sur chaque axe, de −1 à +1. */
  doctrine: number[];
  /** Joueur seulement : doctrine visée et niveaux de recherche de chaque axe. */
  doctrineTarget: number[];
  research: number[];
  /** Régions annexées qui s'agitent dans ce pays. */
  movements: {
    origin: number;
    unrest: number;
    share: number;
    demand: '' | DemandKind;
    until: number;
    investing: boolean;
    care: number;
    ceiling: number;
  }[];
  /** Part de l'armée gardée pour les contre-attaques. */
  counterShare: number;
  /** Secteurs prioritaires (joueur seulement). */
  priorityZones: PriorityZone[];
  /** Agressivité : au-delà d'un seuil, les voisins se coalisent. */
  aggression: number;
  /** Tempérament de l'IA (indice dans AI_PROFILES). */
  profile: number;
  /** Diplomatie du joueur (vide pour les autres nations). */
  allies: number[];
  truces: { nation: number; until: number }[];
  peaceOffers: { nation: number; until: number }[];
  /** Régions rebelles soulevées ensemble contre cette nation. */
  coalition: number[];
}

/** Économie du monde entier, envoyée moins souvent que le reste. */
export interface EconomySnapshot {
  /** Par province (indice = identifiant, 0 inutilisé). */
  development: Float32Array;
  /** PIB de départ de chaque province, réduit après une annexion. */
  provinceGdp: Float32Array;
  /** Par nation (indice = identifiant). */
  output: Float32Array;
  capacity: Float32Array;
  effort: Float32Array;
  /** Par province : consolidation de l'occupant, de 0 à 1. */
  consolidation: Float32Array;
  /** Par province : niveaux d'usine et d'infrastructure, et dépôt (0 ou 1). */
  factories: Uint8Array;
  infrastructure: Uint8Array;
  depots: Uint8Array;
  /** Par province : niveaux des bâtiments du sol national (raffinerie, aciérie…). */
  buildings: Record<ProvinceBuilding, Uint8Array>;
  /** Par nation. */
  stability: Float32Array;
  aggression: Float32Array;
  /** Nation contre laquelle chaque nation s'est soulevée en coalition (0 : aucune). */
  coalitionAgainst: Uint16Array;
  /** Alliances, à plat : a, b, sorte (1 traité, 2 coalition), a, b, sorte… */
  alliances: Uint16Array;
  /** Doctrine de chaque nation, à plat : ses cinq axes à la suite (indice = nation × 5 + axe). */
  doctrine: Float32Array;
}

export interface OffensiveSnapshot {
  id: number;
  nation: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  force: number;
  startForce: number;
  captured: number;
  /** Encore en mer. */
  inTransit: boolean;
  /** Ravitaillement de son couloir, de 0 à 1. */
  supply: number;
  /** Lancée d'elle-même par la réserve de contre-attaque. */
  counter: boolean;
}

export interface PocketSnapshot {
  nation: number;
  x: number;
  y: number;
  cells: number;
}

export interface SimSnapshot {
  tick: number;
  frontierSize: number;
  aliveNations: number;
  fronts: FrontSnapshot[];
  nations: NationSnapshot[];
  offensives: OffensiveSnapshot[];
  pockets: PocketSnapshot[];
  /** Axes commerciaux du monde, seulement quand ils ont changé. */
  axes?: AxisSnapshot[];
}

export type SimEvent =
  | { type: 'war'; tick: number; a: number; b: number }
  | { type: 'capitulation'; tick: number; loser: number; winner: number }
  | { type: 'peace'; tick: number; a: number; b: number }
  | { type: 'peaceRefused'; tick: number; from: number; to: number }
  | { type: 'peaceOffer'; tick: number; from: number; to: number }
  | { type: 'alliance'; tick: number; a: number; b: number }
  | { type: 'allianceRefused'; tick: number; from: number; to: number }
  | { type: 'allianceBroken'; tick: number; a: number; b: number }
  | { type: 'coalition'; tick: number; target: number; members: number[] }
  | { type: 'secession'; tick: number; parent: number; rebel: number }
  | { type: 'demand'; tick: number; parent: number; origin: number; kind: DemandKind }
  | { type: 'independence'; tick: number; parent: number; rebel: number }
  | { type: 'tradeDeal'; tick: number; a: number; b: number }
  | { type: 'tradeDealRefused'; tick: number; from: number; to: number }
  | { type: 'tradeDealEnded'; tick: number; a: number; b: number }
  | { type: 'embargo'; tick: number; from: number; to: number }
  | { type: 'embargoLifted'; tick: number; from: number; to: number }
  | { type: 'axisBuilt'; tick: number; nation: number }
  | { type: 'axisCut'; tick: number; nation: number; by: number }
  | { type: 'axisRestored'; tick: number; nation: number }
  | { type: 'researchDone'; tick: number; nation: number; axis: number; level: number }
  /** La doctrine du joueur change de nom (−1 : équilibrée). */
  | { type: 'doctrineNamed'; tick: number; nation: number; archetype: number };

export interface NationLabel {
  id: number;
  x: number;
  y: number;
  /** Négatif : la nation n'existe plus, son nom disparaît. */
  r: number;
}

export interface WorkerInit {
  type: 'init';
  width: number;
  height: number;
  nations: { population: number; gdpMusd: number; identity?: number }[];
  provinces: { nation: number; areaKm2: number; x: number; y: number; population: number; gdpMusd: number; oil: number; steel: number; region?: number }[];
  provinceGrid: Uint16Array;
  ownerGrid: Uint16Array;
  terrainGrid: Uint8Array;
  seed: number;
  player: number;
  /** Partie à reprendre : `ownerGrid` reste alors la carte de départ. */
  saved?: SimSave;
}

export type ToWorker =
  | WorkerInit
  | { type: 'command'; command: SimCommand }
  /** 0 = pause, sinon multiplicateur de la vitesse normale. */
  | { type: 'speed'; speed: number }
  | { type: 'save'; requestId: number };

export interface WorkerUpdate {
  type: 'update';
  cells: Uint32Array;
  owners: Uint16Array;
  /** Paires (province, nouveau contrôleur). */
  provinces: Uint16Array;
  /** Paires (province, nouveau pays d'origine), après une annexion. */
  homes: Uint16Array;
  /** Cellules dont le ravitaillement a changé, et leur nouvelle valeur (0 : plein). */
  supplyCells: Uint32Array;
  supplyValues: Uint8Array;
  /** Cellules dont la fortification a changé, et leur nouvelle valeur (0 : aucune). */
  fortCells: Uint32Array;
  fortValues: Uint8Array;
  events: SimEvent[];
  labels: NationLabel[];
  snapshot: SimSnapshot | null;
  economy: EconomySnapshot | null;
  /** Durée du dernier calcul de tick, en ms. */
  tickMs: number;
}

export interface WorkerSaved {
  type: 'saved';
  requestId: number;
  save: SimSave;
}

export type FromWorker = WorkerUpdate | WorkerSaved;

/** État complet de la simulation. Tout sauf les grilles passe tel quel par JSON. */
export interface SimSave {
  owners: Uint16Array;
  /** Ravitaillement de chaque cellule, tel que le dernier calcul l'a laissé. */
  supply: Uint8Array;
  /** Fortification de chaque cellule. */
  forts: Uint8Array;
  state: SimSaveState;
}

export interface SimSaveState {
  tick: number;
  rngState: number;
  player: number;
  nextOffensiveId: number;
  /** Un bit par groupe de nations à recalculer. */
  supplyDirty: number;
  fronts: {
    a: number;
    b: number;
    length: number;
    logRatio: number;
    flipBudget: number;
    startTick: number;
    sides: { allocation: number; stance: Stance; force: number; captured: number; rawDensity: number; density: number; supply: number; priority: number }[];
  }[];
  offensives: {
    id: number;
    nation: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    dx: number;
    dy: number;
    lengthSquared: number;
    force: number;
    startForce: number;
    captured: number;
    stalledTicks: number;
    transitUntil: number;
    landingX: number;
    landingY: number;
    seaLoss: number;
    targetX: number;
    targetY: number;
    supply: number;
    supplySum: number;
    supplyCount: number;
    counter: boolean;
  }[];
  frontier: number[];
  sectors: number[];
  reserve: number[];
  capacity: number[];
  cellCounts: number[];
  navy: number[];
  alive: number[];
  heldHome: number[];
  totalHome: number[];
  provinceHome: number[];
  provinceValue: number[];
  controller: number[];
  provinceCounts: ([number, number][] | null)[];
  pocketLists: number[][];
  pocketCounts: number[];
  pockets: PocketSnapshot[];
  landNeighbors: number[][];
  seaNeighbors: number[][];
  labelCells: number[];
  provinceGdp: number[];
  development: number[];
  effort: number[];
  effortTarget: number[];
  growth: number[];
  consolidation: number[];
  rawCapacity: number[];
  provinceManpower: number[];
  manpower: number[];
  manpowerMax: number[];
  armyAfterReinforce: number[];
  losses: number[];
  stability: number[];
  oilCoverage: number[];
  steelCoverage: number[];
  blockaded: number[];
  factories: number[];
  infrastructure: number[];
  depots: number[];
  buildings: Record<ProvinceBuilding, number[]>;
  queues: BuildOrder[][];
  buildProgress: number[];
  constructionRate: number[];
  counterShare: number[];
  /** Tentatives de contre-attaque déjà faites : [nation, offensive ennemie, tentatives]. */
  counterAttempts: [number, number, number][];
  priorityZones: PriorityZone[][];
  /** Alliances : [a, b, 1 traité ou 2 coalition]. */
  alliances: [number, number, number][];
  truces: [number, number, number][];
  aggression: number[];
  coalitionAgainst: number[];
  peaceOffers: { from: number; to: number; until: number }[];
  /** Tick de la dernière offre de paix de chaque IA au joueur. */
  lastPeaceOffer: number[];
  /** Tick de la dernière guerre déclarée au joueur par une IA. */
  lastWarOnPlayer?: number;
  /** Tempérament de chaque IA. */
  profiles?: number[];
  /** Commerce (jalon 9). */
  tradeDeals?: [number, number][];
  embargoes?: [number, number][];
  tradeAccess?: number[];
  tradeFactor?: number[];
  coastSeas?: number[];
  axes?: TradeAxis[];
  nextAxisId?: number;
  /** Doctrines (jalon 10) : atteinte, visée, et niveaux de recherche, cinq axes par nation. */
  doctrine?: number[];
  doctrineTarget?: number[];
  research?: number[];
  movements: MovementState[];
}
