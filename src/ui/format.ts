export const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatGdp(millions: number): string {
  if (millions <= 0) return 'n.c.';
  if (millions >= 1e6) return `${(millions / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Bn $`;
  if (millions >= 1e3) return `${integer.format(millions / 1e3)} Md $`;
  return `${integer.format(millions)} M $`;
}

export function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

const MAX_SHOWN_RATIO = 20;

/** Rapport de force lisible, toujours exprimé du côté du joueur. */
export function formatRatio(ratio: number): string {
  const number = (value: number) =>
    value >= MAX_SHOWN_RATIO ? `> ${MAX_SHOWN_RATIO}` : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return ratio >= 1 ? `${number(ratio)} : 1` : `1 : ${number(1 / ratio)}`;
}
