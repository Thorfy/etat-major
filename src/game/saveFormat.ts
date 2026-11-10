// Format d'une sauvegarde : un en-tête JSON et la grille en RLE, le tout compressé.
import { decodeRle, encodeRle } from '../map/codec.ts';
import { SUPPLY_GROUPS } from '../sim/balance.ts';
import type { NationLabel, SimEvent, SimSave, SimSaveState } from '../sim/protocol.ts';

/** 2 : économie (jalon 4). 3 : logistique (jalon 5). 4 : l'arrière (jalon 6). 5 : défense planifiée (jalon 7). */
export const SAVE_VERSION = 5;

/** Ce que le jeu garde en plus de la simulation. */
export interface SaveMeta {
  version: number;
  /** Une partie ne se reprend que sur la carte pour laquelle elle a été jouée. */
  mapHash: number;
  player: number;
  playerName: string;
  tick: number;
  savedAt: number;
  offensiveShare: number;
  journal: SimEvent[];
  labels: NationLabel[];
}

export interface SaveFile {
  meta: SaveMeta;
  sim: SimSave;
}

export function hashGrid(grid: Uint16Array): number {
  let hash = 2166136261;
  for (let i = 0; i < grid.length; i++) hash = Math.imul(hash ^ grid[i], 16777619) >>> 0;
  return hash;
}

async function pipe(data: Blob, transform: CompressionStream | DecompressionStream): Promise<ArrayBuffer> {
  return new Response(data.stream().pipeThrough(transform as TransformStream<Uint8Array, Uint8Array>)).arrayBuffer();
}

export async function encodeSave(file: SaveFile): Promise<Blob> {
  const json = new TextEncoder().encode(JSON.stringify({ meta: file.meta, state: file.sim.state }));
  const rle = encodeRle(file.sim.owners);
  const supplyRle = encodeRle(Uint16Array.from(file.sim.supply));
  const fortRle = encodeRle(Uint16Array.from(file.sim.forts));
  const header = new Uint32Array([json.length, rle.length, supplyRle.length, fortRle.length]);
  const compressed = await pipe(
    new Blob([header, json, rle as Uint16Array<ArrayBuffer>, supplyRle as Uint16Array<ArrayBuffer>, fortRle as Uint16Array<ArrayBuffer>]),
    new CompressionStream('gzip'),
  );
  return new Blob([compressed], { type: 'application/gzip' });
}

/**
 * Lit un fichier de sauvegarde, de n'importe quelle version (connue par les métadonnées
 * rangées à côté), et le met à jour vers le format courant.
 */
export async function decodeSave(blob: Blob, cellCount: number, version: number): Promise<SaveFile> {
  if (version > SAVE_VERSION) throw new Error('elle vient d\'une version plus récente du jeu.');
  const buffer = await pipe(blob, new DecompressionStream('gzip'));
  // L'en-tête compte le JSON puis chaque grille : propriétaires, ravitaillement (version 3),
  // fortifications (version 5).
  const headerLength = version >= 5 ? 16 : version >= 3 ? 12 : 8;
  const header = new Uint32Array(buffer.slice(0, headerLength));
  const jsonEnd = headerLength + header[0];
  const { meta, state } = JSON.parse(new TextDecoder().decode(buffer.slice(headerLength, jsonEnd)));
  // Copies : le JSON peut laisser les grilles sur un octet impair.
  const rle = new Uint16Array(buffer.slice(jsonEnd, jsonEnd + header[1] * 2));
  const owners = decodeRle(rle, cellCount);
  let supply: Uint8Array | undefined;
  let forts: Uint8Array | undefined;
  const supplyStart = jsonEnd + header[1] * 2;
  if (version >= 3) {
    supply = Uint8Array.from(decodeRle(new Uint16Array(buffer.slice(supplyStart, supplyStart + header[2] * 2)), cellCount));
  }
  if (version >= 5) {
    const fortStart = supplyStart + header[2] * 2;
    forts = Uint8Array.from(decodeRle(new Uint16Array(buffer.slice(fortStart, fortStart + header[3] * 2)), cellCount));
  }
  return migrateSave({ meta, sim: { owners, supply: supply as Uint8Array, forts: forts as Uint8Array, state } }, cellCount);
}

/**
 * Met une sauvegarde ancienne au format courant. Seule la forme change ici ; les valeurs
 * qu'une ancienne version ne connaissait pas (économie, ravitaillement, arrière) prennent à
 * la reprise celles d'une partie neuve.
 */
export function migrateSave(file: SaveFile, cellCount: number): SaveFile {
  const { meta, sim } = file;
  if (meta.version >= SAVE_VERSION) return file;
  const state = sim.state as SimSaveState & { supplyDirty: number | boolean; pocketList?: number[] };
  // Version 3 : le ravitaillement par cellule, et le contrôle des poches par groupes.
  if (!sim.supply) sim.supply = new Uint8Array(cellCount);
  if (typeof state.supplyDirty === 'boolean') state.supplyDirty = state.supplyDirty ? (1 << SUPPLY_GROUPS) - 1 : 0;
  if (!state.pocketLists) {
    state.pocketLists = Array.from({ length: SUPPLY_GROUPS }, (_, group) => (group === 0 ? (state.pocketList ?? []) : []));
    delete state.pocketList;
  }
  for (const front of state.fronts) {
    for (const side of front.sides) side.supply ??= 1;
  }
  for (const offensive of state.offensives) {
    offensive.supply ??= 1;
    offensive.supplySum ??= 0;
    offensive.supplyCount ??= 0;
    offensive.counter ??= false;
  }
  // Version 5 : fortifications et secteurs prioritaires.
  if (!sim.forts) sim.forts = new Uint8Array(cellCount);
  for (const front of state.fronts) {
    for (const side of front.sides) side.priority ??= 0;
  }
  return { meta: { ...meta, version: SAVE_VERSION }, sim };
}
