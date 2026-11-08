// Remplissage de polygones GeoJSON sur la grille, en balayage de lignes.
import { latToY, lonToX } from '../../src/map/projection.ts';

export type GeoRing = number[][];
export type GeoPolygon = GeoRing[];
export type GeoGeometry =
  | { type: 'Polygon'; coordinates: GeoPolygon }
  | { type: 'MultiPolygon'; coordinates: GeoPolygon[] };

export function polygonsOf(geometry: GeoGeometry): GeoPolygon[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/** Aire minimale (en cellules) d'une île trop petite pour tomber sur un centre de cellule. */
const MIN_STAMP_AREA = 0.15;

/**
 * Remplit un polygone (règle pair-impair, trous inclus) et renvoie le nombre de
 * cellules écrites. Une île qui ne couvre aucun centre de cellule mais dépasse
 * MIN_STAMP_AREA reçoit une cellule, si `stamp` est vrai et qu'elle est libre.
 */
export function rasterizePolygon(
  grid: Uint16Array,
  width: number,
  height: number,
  polygon: GeoPolygon,
  id: number,
  stamp = true,
): number {
  const rings = polygon.map((ring) => ({
    xs: ring.map((p) => lonToX(p[0])),
    ys: ring.map((p) => latToY(p[1])),
  }));

  let minY = Infinity;
  let maxY = -Infinity;
  for (const { ys } of rings) {
    for (const y of ys) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const firstRow = Math.max(0, Math.ceil(minY - 0.5));
  const lastRow = Math.min(height - 1, Math.floor(maxY - 0.5));

  let written = 0;
  if (firstRow <= lastRow) {
    const crossings: number[][] = Array.from({ length: lastRow - firstRow + 1 }, () => []);
    for (const { xs, ys } of rings) {
      for (let i = 0, n = xs.length - 1; i < n; i++) {
        const [y0, y1] = [ys[i], ys[i + 1]];
        if (y0 === y1) continue;
        const top = Math.min(y0, y1);
        const bottom = Math.max(y0, y1);
        const from = Math.max(firstRow, Math.ceil(top - 0.5));
        const to = Math.min(lastRow, Math.ceil(bottom - 0.5) - 1);
        for (let row = from; row <= to; row++) {
          const t = (row + 0.5 - y0) / (y1 - y0);
          crossings[row - firstRow].push(xs[i] + t * (xs[i + 1] - xs[i]));
        }
      }
    }
    for (let r = 0; r < crossings.length; r++) {
      const list = crossings[r].sort((a, b) => a - b);
      const offset = (firstRow + r) * width;
      for (let k = 0; k + 1 < list.length; k += 2) {
        const start = Math.max(0, Math.ceil(list[k] - 0.5));
        const end = Math.min(width, Math.ceil(list[k + 1] - 0.5));
        if (end > start) {
          grid.fill(id, offset + start, offset + end);
          written += end - start;
        }
      }
    }
  }

  if (written === 0 && stamp) {
    const { xs, ys } = rings[0];
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, n = xs.length - 1; i < n; i++) {
      area += xs[i] * ys[i + 1] - xs[i + 1] * ys[i];
      cx += xs[i];
      cy += ys[i];
    }
    const count = xs.length - 1;
    if (Math.abs(area) / 2 >= MIN_STAMP_AREA && count > 0) {
      const x = Math.floor(cx / count);
      const y = Math.floor(cy / count);
      if (x >= 0 && x < width && y >= 0 && y < height && grid[y * width + x] === 0) {
        grid[y * width + x] = id;
        written = 1;
      }
    }
  }
  return written;
}
