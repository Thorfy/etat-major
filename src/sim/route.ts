// Trajet d'une flèche : y a-t-il assez d'eau pour en faire un débarquement ?
import { AMPHIBIOUS_MIN_SEA } from './balance.ts';

export interface Route {
  amphibious: boolean;
  seaCells: number;
  /** Première cellule de terre après la dernière eau du trajet. */
  landingX: number;
  landingY: number;
}

export function traceRoute(
  owners: Uint16Array,
  width: number,
  height: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
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
  for (let i = 0; i <= steps; i++) {
    const x = ((Math.round(fromX + (dx * i) / steps) % width) + width) % width;
    const y = Math.max(0, Math.min(height - 1, Math.round(fromY + (dy * i) / steps)));
    if (owners[y * width + x] === 0) {
      seaCells++;
      previousWater = true;
    } else {
      if (previousWater) {
        landingX = x;
        landingY = y;
      }
      previousWater = false;
    }
  }
  // La dernière cellule doit être à terre : on ne débarque pas au milieu de l'eau.
  const amphibious = seaCells >= AMPHIBIOUS_MIN_SEA && landingX >= 0 && !previousWater;
  return { amphibious, seaCells, landingX, landingY };
}
