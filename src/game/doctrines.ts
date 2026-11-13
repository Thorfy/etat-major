// Doctrines, en clair : ce que fait chaque pôle, et ce que donne une position sur un axe.
import { DOCTRINE_AXES, DOCTRINE_EFFECTS as E } from '../sim/doctrine.ts';

const percent = (share: number) => `${Math.round(share * 100)} %`;
/** Un avantage en log du rapport de force, en pourcentage de force. */
const edge = (log: number) => percent(Math.exp(log) - 1);
const signed = (share: number) => `${share >= 0 ? '+' : '−'}${percent(Math.abs(share))}`;

/** Ce que fait chaque pôle à fond : [côté moins, côté plus], dans l'ordre des axes. */
export const POLE_EFFECTS: readonly [string, string][] = [
  [
    `Défense +${edge(E.positionDefense)}, fortifications ${percent(E.positionFort)} plus fortes et ${percent(E.positionFortCost)} moins chères ; ` +
      `attaque −${percent(1 - Math.exp(-E.positionAttack))}, offensives ${percent(E.positionSpeed)} plus lentes.`,
    `Attaque +${edge(E.movementAttack)}, offensives ${percent(E.movementSpeed)} plus rapides ; défense −${percent(1 - Math.exp(-E.movementDefense))}.`,
  ],
  [
    `Chaque homme pèse ${percent(E.qualityStrength)} de plus et tombe ${percent(E.qualityLosses)} moins ; ` +
      `armée −${percent(E.qualityCapacity)}, réservoir −${percent(E.qualityManpower)}, acier +${percent(E.qualitySteel)}.`,
    `Armée +${percent(E.massCapacity)}, réservoir +${percent(E.massManpower)} ; chaque homme pèse ${percent(E.massStrength)} de moins ` +
      `et tombe ${percent(E.massLosses)} plus.`,
  ],
  [
    `Armée +${percent(E.groundCapacity)}, pétrole −${percent(E.groundOil)} ; aucune défense face à l'aviation adverse.`,
    `Supériorité aérienne : jusqu'à +${edge(E.airEdge)} en attaque comme en défense face à qui a moins d'avions ; ` +
      `armée −${percent(E.airCapacity)}, pétrole +${percent(E.airOil)}.`,
  ],
  [
    `Embargos et guerres te coûtent ${percent(E.autarkyDependence)} de moins, gisements +${percent(E.autarkyResources)} ; ` +
      `accords −${percent(E.autarkyDeals)}.`,
    `Accords +${percent(E.freeTradeDeals)}, axes +${percent(E.freeTradeAxes)}, importations +${percent(E.freeTradeImports)} ; ` +
      `embargos et guerres te coûtent ${percent(E.freeTradeDependence)} de plus.`,
  ],
  [
    `Régions ${percent(E.autonomyUnrest)} plus calmes, lassitude −${percent(E.autonomyWeariness)}, conquêtes intégrées ` +
      `${percent(E.autonomyConsolidation)} plus vite ; effort de guerre −${percent(E.autonomyEffortCap)}, chantiers −${percent(E.autonomyConstruction)}.`,
    `Effort de guerre +${percent(E.centralEffortCap)}, armée +${percent(E.centralCapacity)}, chantiers +${percent(E.centralConstruction)} ; ` +
      `régions ${percent(E.centralUnrest)} plus agitées, lassitude +${percent(E.centralWeariness)}.`,
  ],
];

/** Effets d'une position sur un axe, en chiffres, pour la valeur atteinte. */
export function axisEffects(axis: number, value: number): string {
  const v = Math.abs(value);
  if (v < 0.005) return 'Au centre : ni gain ni coût.';
  const plus = value > 0;
  switch (axis) {
    case 0:
      return plus
        ? `Attaque +${edge(E.movementAttack * v)}, offensives ${signed(E.movementSpeed * v)}, défense −${percent(1 - Math.exp(-E.movementDefense * v))}.`
        : `Défense +${edge(E.positionDefense * v)}, forts ${signed(E.positionFort * v)} (coût −${percent(E.positionFortCost * v)}), attaque −${percent(1 - Math.exp(-E.positionAttack * v))}.`;
    case 1:
      return plus
        ? `Armée +${percent(E.massCapacity * v)}, réservoir +${percent(E.massManpower * v)}, poids −${percent(E.massStrength * v)}, pertes +${percent(E.massLosses * v)}.`
        : `Poids +${percent(E.qualityStrength * v)}, pertes −${percent(E.qualityLosses * v)}, armée −${percent(E.qualityCapacity * v)}, acier +${percent(E.qualitySteel * v)}.`;
    case 2:
      return plus
        ? `Aviation ${percent(v)} : jusqu'à +${edge(E.airEdge * v)} au combat, armée −${percent(E.airCapacity * v)}, pétrole +${percent(E.airOil * v)}.`
        : `Armée +${percent(E.groundCapacity * v)}, pétrole −${percent(E.groundOil * v)}, sans aviation.`;
    case 3:
      return plus
        ? `Accords +${percent(E.freeTradeDeals * v)}, axes +${percent(E.freeTradeAxes * v)}, dépendance +${percent(E.freeTradeDependence * v)}.`
        : `Dépendance −${percent(E.autarkyDependence * v)}, gisements +${percent(E.autarkyResources * v)}, accords −${percent(E.autarkyDeals * v)}.`;
    default:
      return plus
        ? `Effort +${percent(E.centralEffortCap * v)}, armée +${percent(E.centralCapacity * v)}, chantiers +${percent(E.centralConstruction * v)}, régions +${percent(E.centralUnrest * v)} d'agitation.`
        : `Régions −${percent(E.autonomyUnrest * v)} d'agitation, lassitude −${percent(E.autonomyWeariness * v)}, effort −${percent(E.autonomyEffortCap * v)}, chantiers −${percent(E.autonomyConstruction * v)}.`;
  }
}

/** Nom du pôle vers lequel penche une valeur, ou « centre ». */
export function poleName(axis: number, value: number): string {
  if (Math.abs(value) < 0.005) return 'centre';
  return value > 0 ? DOCTRINE_AXES[axis].plus : DOCTRINE_AXES[axis].minus;
}
