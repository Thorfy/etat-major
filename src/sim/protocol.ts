// Messages échangés entre le jeu et le Worker de simulation.
// Partout, un identifiant de nation est son propriétaire de grille : indice + 1.

export type Stance = 'attack' | 'hold' | 'retreat';

/** Chantiers : usine (PIB et capacité), infrastructure (transport), dépôt (ravitaillement). */
export type BuildKind = 'factory' | 'infrastructure' | 'depot';

export interface BuildOrder {
  province: number;
  kind: BuildKind;
}

export type SimCommand =
  | { type: 'declareWars'; pairs: [number, number][] }
  | { type: 'setFront'; nation: number; enemy: number; allocation: number; stance: Stance }
  | { type: 'launchOffensive'; nation: number; fromX: number; fromY: number; toX: number; toY: number; share: number }
  | { type: 'cancelOffensive'; nation: number; id: number }
  /** Effort de guerre voulu, de 0 à 1 : l'économie s'y reconvertit progressivement. */
  | { type: 'setEffort'; nation: number; effort: number }
  | { type: 'build'; nation: number; province: number; kind: BuildKind }
  | { type: 'cancelBuild'; nation: number; index: number };

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
  /** Points de construction par minute. */
  construction: number;
  /** File de chantiers (joueur seulement) ; seul le premier avance. */
  builds: (BuildOrder & { cost: number; progress: number })[];
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
  /** Par nation. */
  stability: Float32Array;
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
}

export type SimEvent =
  | { type: 'war'; tick: number; a: number; b: number }
  | { type: 'capitulation'; tick: number; loser: number; winner: number };

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
  nations: { population: number; gdpMusd: number }[];
  provinces: { nation: number; areaKm2: number; x: number; y: number; population: number; gdpMusd: number; oil: number; steel: number }[];
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
    sides: { allocation: number; stance: Stance; force: number; captured: number; rawDensity: number; density: number; supply: number }[];
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
  queues: BuildOrder[][];
  buildProgress: number[];
  constructionRate: number[];
}
