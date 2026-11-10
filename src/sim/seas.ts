// Les mers navigables : chaque étendue d'eau d'un seul tenant reçoit un numéro. Un navire ne
// passe pas d'une mer à l'autre : on ne débarque, ni ne ravitaille par la mer, que sur une mer
// que l'on borde soi-même.
import { MIN_SEA_CELLS } from './balance.ts';

export interface Seas {
  /** Numéro de mer de chaque cellule ; 0 pour la terre et les lacs trop petits. */
  sea: Uint16Array;
  /** Taille de chaque mer, en cellules ; l'indice 0 n'est pas utilisé. */
  sizes: number[];
}

/**
 * Étendues d'eau en connexité 8 (un détroit en diagonale relie deux mers), la carte bouclant
 * d'est en ouest. Les étendues de moins de MIN_SEA_CELLS cellules sont des lacs : ni débarquement,
 * ni ravitaillement par eau.
 */
export function findSeas(owners: Uint16Array, width: number, height: number): Seas {
  const count = width * height;
  const label = new Int32Array(count);
  const queue = new Int32Array(count);
  const sea = new Uint16Array(count);
  const sizes = [0];
  let next = 0;
  for (let start = 0; start < count; start++) {
    if (owners[start] !== 0 || label[start] !== 0) continue;
    next++;
    label[start] = next;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    while (head < tail) {
      const cell = queue[head++];
      const x = cell % width;
      const y = (cell - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + width) % width;
          const other = ny * width + nx;
          if (owners[other] !== 0 || label[other] !== 0) continue;
          label[other] = next;
          queue[tail++] = other;
        }
      }
    }
    // Assez grande, l'étendue devient une mer ; ses cellules sont les dernières entrées en file.
    if (tail >= MIN_SEA_CELLS) {
      const id = sizes.length;
      if (id > 65535) continue;
      sizes.push(tail);
      for (let i = 0; i < tail; i++) sea[queue[i]] = id;
    }
  }
  return { sea, sizes };
}
