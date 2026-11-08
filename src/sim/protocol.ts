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
  fronts: FrontSnapshot[];
  nations: NationSnapshot[];
  offensives: OffensiveSnapshot[];
  pockets: PocketSnapshot[];
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
}

export type ToWorker =
  | WorkerInit
  | { type: 'command'; command: SimCommand }
  /** 0 = pause, sinon multiplicateur de la vitesse normale. */
  | { type: 'speed'; speed: number };

export interface WorkerUpdate {
  type: 'update';
  cells: Uint32Array;
  owners: Uint16Array;
  /** Paires (province, nouveau contrôleur). */
  provinces: Uint16Array;
  snapshot: SimSnapshot | null;
  /** Durée du dernier calcul de tick, en ms. */
  tickMs: number;
}
