// Contenu de public/map/world.json, produit par tools/build-map.ts.

export interface NationData {
  code: string;
  name: string;
  continent: string;
  population: number;
  /** PIB en millions de dollars US (donnée Natural Earth, 0 si inconnue). */
  gdpMusd: number;
  color: string;
  cells: number;
  areaKm2: number;
  /** Centre du plus grand cercle inscrit, pour placer le nom. */
  label: { x: number; y: number; r: number };
}

export interface ProvinceData {
  name: string;
  /** Indice dans WorldData.nations. */
  nation: number;
  x: number;
  y: number;
  cells: number;
  areaKm2: number;
  /** Part de la population du pays, estimée d'après ses villes et sa surface habitable. */
  population: number;
  /** Part du PIB du pays, en millions de dollars US, estimée de la même façon. */
  gdpMusd: number;
  /** Production de pétrole des gisements de la province (ordre de grandeur, Mb/j). */
  oil: number;
  /** Production d'acier (ordre de grandeur, dizaines de Mt/an). */
  steel: number;
}

export interface WorldData {
  width: number;
  height: number;
  nations: NationData[];
  /** L'identifiant d'une province dans la grille est son indice + 1 ; 0 est l'eau. */
  provinces: ProvinceData[];
}
