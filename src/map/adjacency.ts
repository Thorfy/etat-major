// Voisinages terrestres d'une grille de propriétaires (x bouclé).

/** Toutes les paires de propriétaires voisins, chaque paire une fois (a < b). */
export function findLandNeighbors(owners: Uint16Array, width: number, height: number): [number, number][] {
  const seen = new Set<number>();
  const pairs: [number, number][] = [];
  const add = (x: number, y: number) => {
    if (x === y || x === 0 || y === 0) return;
    const a = Math.min(x, y);
    const b = Math.max(x, y);
    const key = a * 65536 + b;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([a, b]);
  };
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const owner = owners[row + x];
      if (owner === 0) continue;
      add(owner, owners[row + (x + 1) % width]);
      if (y + 1 < height) add(owner, owners[row + width + x]);
    }
  }
  return pairs;
}

export function areLandNeighbors(owners: Uint16Array, width: number, height: number, a: number, b: number): boolean {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const owner = owners[row + x];
      if (owner !== a && owner !== b) continue;
      const other = owner === a ? b : a;
      if (owners[row + (x + 1) % width] === other) return true;
      if (y + 1 < height && owners[row + width + x] === other) return true;
    }
  }
  return false;
}
