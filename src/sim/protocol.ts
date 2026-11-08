// Messages échangés entre le jeu et le Worker de simulation.
// Partout, un identifiant de nation est son propriétaire de grille : indice + 1.

export type Stance = 'attack' | 'hold' | 'retreat';

export type SimCommand =
  | { type: 'declareWars'; pairs: [number, number][] }
  | { type: 'setFront'; nation: number; enemy: number; allocation: number; stance: Stance };

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
}

export interface SimSnapshot {
  tick: number;
  frontierSize: number;
  fronts: FrontSnapshot[];
  nations: NationSnapshot[];
}

export interface WorkerInit {
  type: 'init';
  width: number;
  height: number;
  nations: { population: number; gdpMusd: number }[];
  provinces: { nation: number; areaKm2: number }[];
  provinceGrid: Uint16Array;
  ownerGrid: Uint16Array;
  seed: number;
  player: number;
}

export type ToWorker = WorkerInit | { type: 'command'; command: SimCommand };

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
