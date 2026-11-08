// Types de terrain d'une cellule. L'ordre fixe les identifiants stockés dans terrain.dat.

export const TERRAIN_NAMES = ['Plaine', 'Montagne', 'Plateau', 'Désert', 'Arctique', 'Jungle'] as const;

export const TERRAIN_IDS = {
  plain: 0,
  mountain: 1,
  highland: 2,
  desert: 3,
  arctic: 4,
  jungle: 5,
} as const;

export type TerrainKey = keyof typeof TERRAIN_IDS;
