// Ce que fait chaque bâtiment, en clair, pour la fiche et la file de chantiers.
import {
  DEPOT_MIN_CONSOLIDATION,
  FACTORY_BONUS,
  FORT_DEFENSE,
  FORT_SPEED,
  INFRASTRUCTURE_BONUS,
  INVESTMENT_BOOST,
  PROVINCE_BUILDINGS,
  RECRUITMENT_BONUS,
  REFINERY_BONUS,
  SERVICES_RECOVERY_BONUS,
  SERVICES_WEARINESS_CUT,
  SHIPYARD_NAVY,
  STEELWORKS_BONUS,
  MAX_FACTORY_LEVEL,
  MAX_INFRASTRUCTURE_LEVEL,
} from '../sim/balance.ts';
import type { BuildKind } from '../sim/protocol.ts';

const percent = (share: number) => `${Math.round(share * 100)} %`;

export const BUILD_NAMES: Record<BuildKind, string> = {
  factory: 'Usine',
  infrastructure: 'Infrastructure',
  depot: 'Dépôt',
  fort: 'Fortifications',
  investment: 'Investissements',
  refinery: 'Raffinerie',
  steelworks: 'Aciérie',
  recruitment: 'Centre de recrutement',
  services: 'Services publics',
  shipyard: 'Chantier naval',
};

export const BUILD_EFFECTS: Record<BuildKind, string> = {
  factory:
    `+${percent(FACTORY_BONUS)} de PIB et de capacité militaire tirés de la province, par niveau ` +
    `(${MAX_FACTORY_LEVEL} au plus). Seulement sur ton sol national.`,
  infrastructure:
    `Routes et rail : −${percent(INFRASTRUCTURE_BONUS)} du coût de transport par niveau ` +
    `(${MAX_INFRASTRUCTURE_LEVEL} au plus). Tes troupes portent leur ravitaillement plus loin à travers ` +
    `une province conquise. Seulement en territoire conquis : ton sol national est toujours ravitaillé.`,
  depot:
    `La province ravitaille tes troupes comme ton sol national : tes offensives repartent de là. ` +
    `En territoire conquis, consolidé à ${percent(DEPOT_MIN_CONSOLIDATION)} au moins.`,
  fort:
    `L'assaillant y voit son rapport de force divisé par ${Math.exp(FORT_DEFENSE).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}, ` +
    `et chaque cellule tombe ${percent(1 - FORT_SPEED)} moins vite.`,
  investment:
    `Promis à une région annexée qui s'agite. Pendant le chantier, elle se tient tranquille ; achevé, il ` +
    `la calme encore, et sa valeur et son PIB remontent de ${percent(INVESTMENT_BOOST)} de leur niveau d'origine. ` +
    `L'abandonner vaut un refus.`,
  refinery:
    `+${percent(REFINERY_BONUS)} de pétrole tiré du gisement de la province, par niveau (${PROVINCE_BUILDINGS.refinery.max} au plus). ` +
    `Le pétrole manquant affaiblit l'armée. Sur un gisement de pétrole de ton sol national.`,
  steelworks:
    `+${percent(STEELWORKS_BONUS)} d'acier tiré du gisement de la province, par niveau (${PROVINCE_BUILDINGS.steelworks.max} au plus). ` +
    `L'acier manquant ralentit chantiers et croissance. Sur un gisement d'acier de ton sol national.`,
  recruitment:
    `+${percent(RECRUITMENT_BONUS)} d'hommes mobilisables dans la province, par niveau (${PROVINCE_BUILDINGS.recruitment.max} au plus) : ` +
    `un réservoir plus grand, qui se reconstitue plus vite.`,
  services:
    `Hôpitaux et écoles, ${PROVINCE_BUILDINGS.services.max} niveaux. Sur l'ensemble du pays, chaque niveau moyen fait remonter la stabilité ` +
    `${percent(SERVICES_RECOVERY_BONUS)} plus vite en paix, et la guerre l'use ${percent(SERVICES_WEARINESS_CUT)} moins. Dans une région annexée, ` +
    `ils comptent double pour son équipement, qui la tient calme.`,
  shipyard:
    `Chaque niveau achevé lance des navires : +${percent(SHIPYARD_NAVY)} de ta marine de départ (${PROVINCE_BUILDINGS.shipyard.max} niveaux ` +
    `par province côtière). Plus de marine : débarquements moins coûteux, blocus plus faciles à imposer ou à briser.`,
};
