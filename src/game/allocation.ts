/**
 * Répartition des forces entre fronts. Monter un curseur au-delà de ce qui reste
 * disponible reprend le manque sur les autres fronts, proportionnellement.
 */
export function rebalance(current: ReadonlyMap<number, number>, enemy: number, requested: number): Map<number, number> {
  const value = Math.max(0, Math.min(1, requested));
  let others = 0;
  for (const [other, allocation] of current) {
    if (other !== enemy) others += allocation;
  }
  const scale = others + value > 1 ? (1 - value) / others : 1;
  const next = new Map<number, number>();
  for (const [other, allocation] of current) {
    if (other !== enemy) next.set(other, allocation * scale);
  }
  next.set(enemy, value);
  return next;
}
