// Les cartes du jeu, rangées en familles : un bouton par famille en haut, ses sous-cartes dessous.
import type { MapMode } from '../render/MapView.ts';

export interface MapGroup {
  id: string;
  label: string;
  /** Touche qui ouvre la famille, puis passe d'une sous-carte à l'autre. */
  key: string;
  modes: { id: MapMode; label: string }[];
}

export const MAP_GROUPS: MapGroup[] = [
  {
    id: 'countries',
    label: 'Pays',
    key: 'p',
    modes: [
      { id: 'political', label: 'Pays' },
      { id: 'regions', label: 'Régions' },
      { id: 'stability', label: 'Stabilité' },
    ],
  },
  {
    id: 'economy',
    label: 'Économie',
    key: 'e',
    modes: [
      { id: 'economic', label: 'Richesse' },
      { id: 'growth', label: 'Évolution' },
      { id: 'routes', label: 'Routes' },
    ],
  },
  { id: 'relations', label: 'Relations', key: 't', modes: [{ id: 'relations', label: 'Relations' }] },
  { id: 'supply', label: 'Ravitaillement', key: 'r', modes: [{ id: 'supply', label: 'Ravitaillement' }] },
];

export const groupOf = (mode: MapMode): MapGroup => MAP_GROUPS.find((group) => group.modes.some((entry) => entry.id === mode)) ?? MAP_GROUPS[0];

/**
 * La touche d'une famille : l'ouvre sur sa première sous-carte, puis passe à la suivante ; après la
 * dernière, on revient à la carte des pays.
 */
export function nextModeForKey(current: MapMode, key: string): MapMode | null {
  const group = MAP_GROUPS.find((entry) => entry.key === key);
  if (!group) return null;
  const index = group.modes.findIndex((entry) => entry.id === current);
  if (index < 0) return group.modes[0].id;
  return index + 1 < group.modes.length ? group.modes[index + 1].id : 'political';
}
