export const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatGdp(millions: number): string {
  if (millions <= 0) return 'n.c.';
  if (millions >= 1e6) return `${(millions / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Bn $`;
  if (millions >= 1e3) return `${integer.format(millions / 1e3)} Md $`;
  return `${integer.format(millions)} M $`;
}

/** Espace insécable : un pourcentage ne se coupe jamais avant son signe. */
const NBSP = ' ';

export function formatPercent(share: number): string {
  return `${integer.format(share * 100)}${NBSP}%`;
}

/** Variation signée, en pourcentage : « +1,2 % ». */
export function formatChange(share: number, digits = 1): string {
  const rounded = Math.round(share * 100 * 10 ** digits) / 10 ** digits;
  // Pas de « −0 % » : une variation qui s'arrondit à zéro n'a pas de signe.
  if (rounded === 0) return `${(0).toLocaleString('fr-FR', { minimumFractionDigits: digits })}${NBSP}%`;
  const value = rounded.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return `${rounded > 0 ? '+' : ''}${value}${NBSP}%`;
}

const MAX_SHOWN_RATIO = 20;

/** Rapport de force lisible, toujours exprimé du côté du joueur. */
export function formatRatio(ratio: number): string {
  const number = (value: number) =>
    value >= MAX_SHOWN_RATIO ? `> ${MAX_SHOWN_RATIO}` : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return ratio >= 1 ? `${number(ratio)} : 1` : `1 : ${number(1 / ratio)}`;
}

/** Grand nombre en abrégé, pour les indicateurs : « 412,3 k ». */
export const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
