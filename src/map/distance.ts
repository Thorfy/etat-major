// Transformée de distance « chanfrein 3-4 », en deux passes. Sert à placer les
// noms de pays et à dessiner le dégradé côtier.

/**
 * Pour chaque cellule, distance approchée (en cellules) à la cellule la plus
 * proche portant un autre identifiant, sur une grille sans bouclage.
 */
export function distanceToBoundary(labels: ArrayLike<number>, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h);
  const sameOr = (i: number, n: number, cost: number) => (labels[i] === labels[n] ? d[n] + cost : cost);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let best = 1e9;
      if (x > 0) best = Math.min(best, sameOr(i, i - 1, 3));
      if (y > 0) {
        best = Math.min(best, sameOr(i, i - w, 3));
        if (x > 0) best = Math.min(best, sameOr(i, i - w - 1, 4));
        if (x < w - 1) best = Math.min(best, sameOr(i, i - w + 1, 4));
      }
      d[i] = best;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let best = d[i];
      if (x < w - 1) best = Math.min(best, sameOr(i, i + 1, 3));
      if (y < h - 1) {
        best = Math.min(best, sameOr(i, i + w, 3));
        if (x < w - 1) best = Math.min(best, sameOr(i, i + w + 1, 4));
        if (x > 0) best = Math.min(best, sameOr(i, i + w - 1, 4));
      }
      d[i] = best;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}
