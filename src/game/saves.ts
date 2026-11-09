// Parties sauvegardées dans le navigateur (IndexedDB).
import type { SaveMeta } from './saveFormat.ts';

const DB_NAME = 'risk';
const STORE = 'saves';

export type SaveSlot = 'auto' | 'manual';

export interface StoredSave {
  slot: SaveSlot;
  meta: SaveMeta;
  blob: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'slot' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Stockage du navigateur indisponible.'));
    request.onblocked = () => reject(new Error('Stockage du navigateur bloqué par un autre onglet.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      // On attend la fin de la transaction : c'est elle qui garantit l'écriture.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? new Error('Écriture impossible.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Écriture annulée (stockage plein ?).'));
    });
  } finally {
    db.close();
  }
}

export function writeSave(save: StoredSave): Promise<IDBValidKey> {
  return withStore('readwrite', (store) => store.put(save));
}

export function readSave(slot: SaveSlot): Promise<StoredSave | undefined> {
  return withStore<StoredSave | undefined>('readonly', (store) => store.get(slot));
}

/** Liste sans erreur : un navigateur sans stockage n'empêche pas de jouer. */
export async function listSaves(): Promise<StoredSave[]> {
  try {
    const saves = await withStore<StoredSave[]>('readonly', (store) => store.getAll());
    return saves.sort((a, b) => b.meta.savedAt - a.meta.savedAt);
  } catch {
    return [];
  }
}
