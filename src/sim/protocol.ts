// Messages échangés entre le jeu et le Worker de simulation.
// Partout, un identifiant de nation est son propriétaire de grille : indice + 1.

export type Stance = 'attack' | 'hold' | 'retreat';

export type SimCommand =
  | { type: 'declareWars'; pairs: [number, number][] }
  | { type: 'setFront'; nation: number; enemy: number; allocation: number; stance: Stance }
  | { type: 'launchOffensive'; nation: number; fromX: number; fromY: number; toX: number; toY: number; share: number }
  | { type: 'cancelOffensive'; nation: number; id: number };

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
}

export interface NationSnapshot {
  id: number;
  army: number;
  reserve: number;
  capacity: number;
  cells: number;
  pocketCells: number;
  navy: number;
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
  provinces: { nation: number; areaKm2: number; x: number; y: number }[];
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
  events: SimEvent[];
  labels: NationLabel[];
  snapshot: SimSnapshot | null;
  /** Durée du dernier calcul de tick, en ms. */
  tickMs: number;
}

export interface WorkerSaved {
  type: 'saved';
  requestId: number;
  save: SimSave;
}

export type FromWorker = WorkerUpdate | WorkerSaved;

/** État complet de la simulation. Tout sauf `owners` passe tel quel par JSON. */
export interface SimSave {
  owners: Uint16Array;
  state: SimSaveState;
}

export interface SimSaveState {
  tick: number;
  rngState: number;
  player: number;
  nextOffensiveId: number;
  supplyDirty: boolean;
  fronts: {
    a: number;
    b: number;
    length: number;
    logRatio: number;
    flipBudget: number;
    sides: { allocation: number; stance: Stance; force: number; captured: number; rawDensity: number; density: number }[];
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
  pocketList: number[];
  pocketCounts: number[];
  pockets: PocketSnapshot[];
  landNeighbors: number[][];
  seaNeighbors: number[][];
  labelCells: number[];
}
