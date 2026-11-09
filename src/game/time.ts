// Calendrier de la partie : le temps de jeu se lit en dates, pas en minutes.
import { TICKS_PER_SECOND } from '../sim/balance.ts';

/** La partie commence le 1er janvier 2026. */
export const START_DATE = Date.UTC(2026, 0, 1);

/**
 * Une minute de simulation vaut une semaine. Les réglages « par minute » de la simulation
 * sont donc des rythmes par semaine.
 */
export const TICKS_PER_WEEK = 60 * TICKS_PER_SECOND;
const MS_PER_TICK = (7 * 24 * 3600 * 1000) / TICKS_PER_WEEK;

export function dateOf(tick: number): Date {
  return new Date(START_DATE + tick * MS_PER_TICK);
}

/** « 12 mars 2026 ». */
export function formatDate(tick: number): string {
  return dateOf(tick).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** « 12 mars 2026 », en abrégé : « 12 mars 26 ». */
export function formatShortDate(tick: number): string {
  return dateOf(tick).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });
}

/** Durée lisible : « 5 semaines », « 8 mois », « 2 ans et 3 mois ». */
export function formatDuration(ticks: number): string {
  const weeks = Math.round(ticks / TICKS_PER_WEEK);
  if (weeks < 9) return weeks <= 1 ? '1 semaine' : `${weeks} semaines`;
  const months = Math.round(weeks / (52 / 12));
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} ans` : `${years} ans et ${rest} mois`;
}
