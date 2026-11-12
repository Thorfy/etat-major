// Illustrations générées (tools/illustrate.ts), servies depuis public/art/ et chargées à la demande.
import type { NationData } from '../map/types.ts';

interface ArtProps {
  /** Chemin sous public/art/, sans extension : « evenements/guerre-1 », « blasons/FRA ». */
  id: string;
  alt?: string;
  class?: string;
  /** Les images du haut de l'écran se chargent tout de suite ; les autres à l'approche. */
  eager?: boolean;
}

/**
 * Une illustration. Une image absente (pas encore générée) reste invisible sans déplacer la mise
 * en page : sa place est tenue par le style.
 */
export function Art({ id, alt = '', class: className = '', eager = false }: ArtProps) {
  return (
    <img
      class={`art ${className}`}
      src={`art/${id}.webp`}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={(event) => (event.currentTarget.style.visibility = 'visible')}
      onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
    />
  );
}

/** Le blason inventé d'un pays. */
export function Blason({ nation, size = 'small' }: { nation: NationData; size?: 'small' | 'medium' | 'large' }) {
  return <Art id={`blasons/${nation.code}`} alt={`Blason : ${nation.name}`} class={`blason ${size}`} eager={size !== 'small'} />;
}

const TERRAIN_FILES = ['plaine', 'montagne', 'plateau', 'desert', 'arctique', 'jungle'] as const;

/**
 * Paysage d'une province : son terrain, et son état — ravagé si les combats l'ont abîmée,
 * industriel si elle est riche (plus de 3 M$ de PIB par km²), rural sinon.
 */
export function landscapeOf(terrain: number, gdpMusd: number, areaKm2: number, development: number, province = 0): string {
  const kind = development < 0.92 ? 'ravage' : gdpMusd / Math.max(1, areaKm2) >= 3 ? 'industriel' : 'rural';
  // Trois paysages par terrain et par état : chaque province garde toujours le même.
  const variant = province % 3;
  return `paysages/${TERRAIN_FILES[terrain] ?? 'plaine'}-${kind}${variant > 0 ? `-${variant + 1}` : ''}`;
}
