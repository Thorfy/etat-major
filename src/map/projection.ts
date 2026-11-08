// Projection de la grille du monde : cylindrique de Miller, coupée sous 58° S
// (pas d'Antarctique). Cylindrique pour que la carte boucle en longitude.

export const MAP_WIDTH = 4096;
export const MAP_HEIGHT = 2048;
export const TOP_LATITUDE = 83.7;

const EARTH_RADIUS_KM = 6371;
const RADIANS_PER_CELL = (2 * Math.PI) / MAP_WIDTH;
const DEG = Math.PI / 180;

const millerY = (latDeg: number) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latDeg * DEG));
const TOP_Y = millerY(TOP_LATITUDE);

export function lonToX(lon: number): number {
  return ((lon + 180) / 360) * MAP_WIDTH;
}

export function latToY(lat: number): number {
  return (TOP_Y - millerY(lat)) / RADIANS_PER_CELL;
}

export function xToLon(x: number): number {
  return (x / MAP_WIDTH) * 360 - 180;
}

export function yToLat(y: number): number {
  const m = TOP_Y - y * RADIANS_PER_CELL;
  return (2.5 * (Math.atan(Math.exp(0.8 * m)) - Math.PI / 4)) / DEG;
}

/** Surface réelle couverte par une cellule de la rangée `row`, en km². */
export function cellAreaKm2(row: number): number {
  const phi = yToLat(row + 0.5) * DEG;
  return EARTH_RADIUS_KM ** 2 * Math.cos(phi) * Math.cos(0.8 * phi) * RADIANS_PER_CELL ** 2;
}

/** Écart horizontal le plus court entre deux x, carte bouclée (signé). */
export function wrapDeltaX(from: number, to: number): number {
  let d = (to - from) % MAP_WIDTH;
  if (d > MAP_WIDTH / 2) d -= MAP_WIDTH;
  if (d < -MAP_WIDTH / 2) d += MAP_WIDTH;
  return d;
}
