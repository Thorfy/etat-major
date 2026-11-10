// Trajet d'une flèche : y a-t-il assez d'eau pour en faire un débarquement, et est-il possible ?
import { AMPHIBIOUS_MIN_SEA } from './balance.ts';

export interface Route {
  amphibious: boolean;
  seaCells: number;
  /** Première cellule de terre après la dernière eau du trajet. */
  landingX: number;
  landingY: number;
  /** Dernière cellule de terre avant la première mer navigable : le port d'embarquement (−1 : aucun). */
  shoreCell: number;
  /** Mer où l'on embarque, et mer d'où l'on débarque (0 : lac, ou pas de carte des mers). */
  launchSea: number;
  landingSea: number;
}

/** Pourquoi un débarquement est impossible : '' s'il est possible. */
export type LandingProblem = '' | 'shore' | 'sea';

export function traceRoute(
  owners: Uint16Array,
  width: number,
  height: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  seas?: Uint16Array,
): Route {
  let dx = (toX - fromX) % width;
  if (dx > width / 2) dx -= width;
  if (dx < -width / 2) dx += width;
  const dy = toY - fromY;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));

  let seaCells = 0;
  let previousWater = false;
  let landingX = -1;
  let landingY = -1;
  let lastLand = -1;
  let shoreCell = -1;
  let launchSea = 0;
  let waterSea = 0;
  let landingSea = 0;
  for (let i = 0; i <= steps; i++) {
    const x = ((Math.round(fromX + (dx * i) / steps) % width) + width) % width;
    const y = Math.max(0, Math.min(height - 1, Math.round(fromY + (dy * i) / steps)));
    const cell = y * width + x;
    if (owners[cell] === 0) {
      seaCells++;
      previousWater = true;
      waterSea = seas ? seas[cell] : 0;
      if (launchSea === 0 && waterSea !== 0) {
        launchSea = waterSea;
        shoreCell = lastLand;
      }
    } else {
      if (previousWater) {
        landingX = x;
        landingY = y;
        landingSea = waterSea;
      }
      previousWater = false;
      lastLand = cell;
    }
  }
  // La dernière cellule doit être à terre : on ne débarque pas au milieu de l'eau.
  const amphibious = seaCells >= AMPHIBIOUS_MIN_SEA && landingX >= 0 && !previousWater;
  return { amphibious, seaCells, landingX, landingY, shoreCell, launchSea, landingSea };
}

/**
 * Un débarquement part de sa propre côte, sur une mer navigable, et touche terre depuis cette même
 * mer : ni lac, ni mer intérieure qu'on ne borde pas (la Caspienne depuis l'océan).
 */
export function landingProblem(route: Route, owners: Uint16Array, nation: number): LandingProblem {
  if (route.shoreCell < 0 || owners[route.shoreCell] !== nation) return 'shore';
  if (route.launchSea === 0 || route.landingSea !== route.launchSea) return 'sea';
  return '';
}
