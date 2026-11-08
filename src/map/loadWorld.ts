import { decodeRle } from './codec.ts';
import { distanceToBoundary } from './distance.ts';
import type { WorldData } from './types.ts';

export interface LoadedWorld {
  data: WorldData;
  /** Identifiant de province de chaque cellule (0 = eau). */
  provinceGrid: Uint16Array;
  /** Propriétaire de chaque cellule (0 = eau, sinon indice de nation + 1). */
  ownerGrid: Uint16Array;
}

async function fetchOk(path: string): Promise<Response> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${path} : HTTP ${response.status}`);
  return response;
}

export async function loadWorld(): Promise<LoadedWorld> {
  const [json, dat] = await Promise.all([fetchOk('map/world.json'), fetchOk('map/provinces.dat')]);
  const data = (await json.json()) as WorldData;
  const stream = dat.body!.pipeThrough(new DecompressionStream('deflate'));
  const buffer = await new Response(stream).arrayBuffer();

  const provinceGrid = decodeRle(new Uint16Array(buffer), data.width * data.height);
  const ownerOfProvince = new Uint16Array(data.provinces.length + 1);
  data.provinces.forEach((province, index) => {
    ownerOfProvince[index + 1] = province.nation + 1;
  });
  const ownerGrid = new Uint16Array(provinceGrid.length);
  for (let i = 0; i < provinceGrid.length; i++) ownerGrid[i] = ownerOfProvince[provinceGrid[i]];
  return { data, provinceGrid, ownerGrid };
}

/** Portée du dégradé côtier, en cellules de la grille à demi-résolution. */
const COAST_RANGE = 32;

/**
 * Distance à la côte à demi-résolution, 0 sur terre et 255 à 64 cellules ou plus
 * du rivage. Elle sert au dégradé de la mer.
 */
export function buildCoastField(provinceGrid: Uint16Array, width: number, height: number) {
  const w = width >> 1;
  const h = height >> 1;
  const land = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = y * 2 * width + x * 2;
      const isLand = provinceGrid[a] || provinceGrid[a + 1] || provinceGrid[a + width] || provinceGrid[a + width + 1];
      land[y * w + x] = isLand ? 1 : 0;
    }
  }
  // La transformée ne boucle pas : on recopie une marge de chaque côté pour que le
  // dégradé traverse la longitude 180° sans couture.
  const paddedWidth = w + COAST_RANGE * 2;
  const padded = new Uint8Array(paddedWidth * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < paddedWidth; x++) {
      padded[y * paddedWidth + x] = land[y * w + (x - COAST_RANGE + w) % w];
    }
  }
  const distance = distanceToBoundary(padded, paddedWidth, h);
  const field = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      field[i] = land[i] ? 0 : Math.min(255, (distance[y * paddedWidth + x + COAST_RANGE] / COAST_RANGE) * 255);
    }
  }
  return { field, width: w, height: h };
}
