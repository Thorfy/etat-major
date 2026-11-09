// Format d'une sauvegarde : un en-tête JSON et la grille en RLE, le tout compressé.
import { decodeRle, encodeRle } from '../map/codec.ts';
import type { NationLabel, SimEvent, SimSave } from '../sim/protocol.ts';

/** 2 : économie (jalon 4). 3 : logistique (jalon 5). */
export const SAVE_VERSION = 3;

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
  const header = new Uint32Array([json.length, rle.length, supplyRle.length]);
  const compressed = await pipe(
    new Blob([header, json, rle as Uint16Array<ArrayBuffer>, supplyRle as Uint16Array<ArrayBuffer>]),
    new CompressionStream('gzip'),
  );
  return new Blob([compressed], { type: 'application/gzip' });
}

export async function decodeSave(blob: Blob, cellCount: number): Promise<SaveFile> {
  const buffer = await pipe(blob, new DecompressionStream('gzip'));
  const [jsonLength, rleLength, supplyLength] = new Uint32Array(buffer.slice(0, 12));
  const jsonEnd = 12 + jsonLength;
  const { meta, state } = JSON.parse(new TextDecoder().decode(buffer.slice(12, jsonEnd)));
  // Copies : le JSON peut laisser les grilles sur un octet impair.
  const rle = new Uint16Array(buffer.slice(jsonEnd, jsonEnd + rleLength * 2));
  const supplyStart = jsonEnd + rleLength * 2;
  const supplyRle = new Uint16Array(buffer.slice(supplyStart, supplyStart + supplyLength * 2));
  return { meta, sim: { owners: decodeRle(rle, cellCount), supply: Uint8Array.from(decodeRle(supplyRle, cellCount)), state } };
}
