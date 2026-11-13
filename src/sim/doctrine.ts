/**
 * Doctrines (jalon 10) : la doctrine d'un pays est sa position sur cinq axes, chacun de −1 à +1.
 * Chaque pôle apporte un gain et coûte quelque chose ; le centre ne gagne ni ne perd rien. La
 * recherche (des chantiers comme les autres) repousse les bornes de chaque axe, et la doctrine
 * glisse lentement vers la position choisie : on peut pivoter, pas d'un clic.
 */

export const DOCTRINE_AXES = [
  { id: 'maneuver', name: 'Manœuvre', plus: 'Mouvement', minus: 'Position' },
  { id: 'mass', name: 'Recrutement', plus: 'Masse', minus: 'Qualité' },
  { id: 'air', name: 'Armes', plus: 'Air', minus: 'Sol' },
  { id: 'trade', name: 'Échanges', plus: 'Libre-échange', minus: 'Autarcie' },
  { id: 'state', name: 'État', plus: 'Centralisation', minus: 'Autonomie' },
] as const;
export const DOCTRINE_AXIS_COUNT = DOCTRINE_AXES.length;
export type Doctrine = readonly number[];

/** Bornes de chaque axe selon son niveau de recherche (0 au départ, 3 au plus). */
export const DOCTRINE_REACH = [0.25, 0.5, 0.75, 1] as const;
export const MAX_RESEARCH_LEVEL = DOCTRINE_REACH.length - 1;
/** Coût d'un niveau de recherche, en points de construction, multiplié par le niveau visé. */
export const RESEARCH_COST = 60;
/** La doctrine glisse vers sa cible à cette vitesse par semaine, moitié moins vite en guerre. */
export const DOCTRINE_SPEED_PER_WEEK = 0.05;
export const DOCTRINE_WAR_SPEED = 0.5;

/**
 * Effets de chaque pôle à fond (|valeur| = 1), proportionnels en deçà. Les avantages au combat
 * sont en log du rapport de force, comme le reste du front.
 */
export const DOCTRINE_EFFECTS = {
  // Mouvement : attaque et offensives plus vives, défense plus fragile.
  movementAttack: 0.25,
  movementSpeed: 0.5,
  movementDefense: 0.15,
  // Position : défense et fortifications plus fortes et moins chères, attaque plus lente.
  positionDefense: 0.25,
  positionFort: 0.5,
  positionFortCost: 0.4,
  positionAttack: 0.2,
  positionSpeed: 0.3,
  // Masse : plus d'hommes et une plus grande armée, mais chacun pèse moins et tombe davantage.
  massCapacity: 0.3,
  massManpower: 0.4,
  massStrength: 0.2,
  massLosses: 0.4,
  // Qualité : chaque homme pèse plus et tombe moins, mais l'armée est plus petite et veut de l'acier.
  qualityStrength: 0.3,
  qualityLosses: 0.35,
  qualityCapacity: 0.25,
  qualityManpower: 0.2,
  qualitySteel: 0.3,
  // Air : supériorité aérienne face à qui en a moins, mais des avions chers et gourmands en pétrole.
  airEdge: 0.3,
  airCapacity: 0.15,
  airOil: 0.6,
  // Sol : une armée de terre moins chère et plus sobre, à la merci de l'aviation adverse.
  groundCapacity: 0.1,
  groundOil: 0.25,
  // Libre-échange : accords, axes et importations rapportent plus ; embargos et guerres coûtent plus.
  freeTradeDependence: 0.6,
  freeTradeDeals: 1,
  freeTradeAxes: 0.5,
  freeTradeImports: 0.15,
  // Autarcie : on dépend moins des autres et l'on tire plus de ses gisements, mais les accords rapportent moins.
  autarkyDependence: 0.6,
  autarkyDeals: 0.6,
  autarkyResources: 0.4,
  // Centralisation : effort de guerre plus poussé, armée et chantiers plus efficaces ; les régions s'agitent.
  centralEffortCap: 0.15,
  centralCapacity: 0.1,
  centralConstruction: 0.15,
  centralUnrest: 0.5,
  centralWeariness: 0.3,
  // Autonomie : régions calmes, lassitude moindre, conquêtes vite intégrées ; l'État rend moins.
  autonomyUnrest: 0.5,
  autonomyWeariness: 0.2,
  autonomyConsolidation: 1,
  autonomyEffortCap: 0.15,
  autonomyConstruction: 0.1,
} as const;

/** Modificateurs qu'une doctrine donne à son pays, recalculés quand elle bouge. */
export interface DoctrineModifiers {
  /** Ajouté à l'avantage de ses attaques (log). */
  attackEdge: number;
  /** Retranché à l'avantage de qui l'attaque (log). */
  defenseEdge: number;
  /** Multiplie la vitesse de ses offensives. */
  offensiveSpeed: number;
  /** Multiplie l'effet et le coût de ses fortifications. */
  fortDefense: number;
  fortCost: number;
  /** Multiplie le poids de chaque homme au front, et ses pertes. */
  strength: number;
  losses: number;
  /** Multiplie sa capacité militaire et son réservoir d'hommes. */
  capacity: number;
  manpower: number;
  /** Puissance aérienne, de 0 à 1 : face à une aviation moindre, elle donne airEdge par point d'écart. */
  air: number;
  /** Multiplient ses besoins en pétrole et en acier. */
  oilNeed: number;
  steelNeed: number;
  /** Multiplient sa dépendance au commerce, le gain de ses accords et le bonus de ses axes. */
  tradeDependence: number;
  dealGain: number;
  axisBonus: number;
  /** Ajouté à la part de pétrole et d'acier qu'elle importe. */
  imports: number;
  /** Multiplie ce que rendent ses gisements. */
  resources: number;
  /** Ajouté à l'effort de guerre que sa stabilité permet. */
  effortCap: number;
  /** Multiplient ses chantiers, l'agitation de ses régions, sa lassitude, la consolidation de ses conquêtes. */
  construction: number;
  unrest: number;
  weariness: number;
  consolidation: number;
}

export function doctrineModifiers(doctrine: Doctrine): DoctrineModifiers {
  const E = DOCTRINE_EFFECTS;
  const plus = (axis: number) => Math.max(0, doctrine[axis] ?? 0);
  const minus = (axis: number) => Math.max(0, -(doctrine[axis] ?? 0));
  const [move, position] = [plus(0), minus(0)];
  const [mass, quality] = [plus(1), minus(1)];
  const [air, ground] = [plus(2), minus(2)];
  const [free, autarky] = [plus(3), minus(3)];
  const [central, autonomy] = [plus(4), minus(4)];
  return {
    attackEdge: E.movementAttack * move - E.positionAttack * position,
    defenseEdge: E.positionDefense * position - E.movementDefense * move,
    offensiveSpeed: 1 + E.movementSpeed * move - E.positionSpeed * position,
    fortDefense: 1 + E.positionFort * position,
    fortCost: 1 - E.positionFortCost * position,
    strength: 1 + E.qualityStrength * quality - E.massStrength * mass,
    losses: 1 + E.massLosses * mass - E.qualityLosses * quality,
    capacity:
      (1 + E.massCapacity * mass - E.qualityCapacity * quality) *
      (1 - E.airCapacity * air + E.groundCapacity * ground) *
      (1 + E.centralCapacity * central),
    manpower: 1 + E.massManpower * mass - E.qualityManpower * quality,
    air,
    oilNeed: 1 + E.airOil * air - E.groundOil * ground,
    steelNeed: 1 + E.qualitySteel * quality,
    tradeDependence: 1 + E.freeTradeDependence * free - E.autarkyDependence * autarky,
    dealGain: 1 + E.freeTradeDeals * free - E.autarkyDeals * autarky,
    axisBonus: 1 + E.freeTradeAxes * free,
    imports: E.freeTradeImports * free,
    resources: 1 + E.autarkyResources * autarky,
    effortCap: E.centralEffortCap * central - E.autonomyEffortCap * autonomy,
    construction: 1 + E.centralConstruction * central - E.autonomyConstruction * autonomy,
    unrest: 1 + E.centralUnrest * central - E.autonomyUnrest * autonomy,
    weariness: 1 + E.centralWeariness * central - E.autonomyWeariness * autonomy,
    consolidation: 1 + E.autonomyConsolidation * autonomy,
  };
}

/**
 * Noms des grandes doctrines : chacune est une direction sur quelques axes (+1, −1, ou 0 pour
 * « indifférent »). La doctrine d'un pays prend le nom de celle dont elle s'approche le plus,
 * ou reste « équilibrée » près du centre.
 */
export const ARCHETYPES = [
  { id: 'guerre-eclair', name: 'Guerre éclair', axes: [1, -1, 1, 0, 0] },
  { id: 'vague-humaine', name: 'Vague humaine', axes: [1, 1, -1, 0, 0] },
  { id: 'defense-profondeur', name: 'Défense en profondeur', axes: [-1, 0, -1, 0, 0] },
  { id: 'nation-en-armes', name: 'Nation en armes', axes: [-1, 1, 0, 0, -1] },
  { id: 'forteresse', name: 'Forteresse autarcique', axes: [-1, 0, 0, -1, 0] },
  { id: 'puissance-aerienne', name: 'Puissance aérienne', axes: [-1, 0, 1, 0, 0] },
  { id: 'guerre-totale', name: 'Guerre totale', axes: [0, 1, 0, -1, 1] },
  { id: 'arsenal', name: 'Arsenal industriel', axes: [0, -1, 0, -1, 1] },
  { id: 'republique-marchande', name: 'République marchande', axes: [0, 0, 0, 1, -1] },
  { id: 'empire-marchand', name: 'Empire marchand', axes: [0, 0, 1, 1, 1] },
] as const;
export const BALANCED_ARCHETYPE = { id: 'equilibree', name: 'Doctrine équilibrée' } as const;
/** Sous ce score, la doctrine reste équilibrée. */
export const ARCHETYPE_THRESHOLD = 0.3;

/** Indice de la grande doctrine la plus proche, −1 pour une doctrine équilibrée. */
export function archetypeOf(doctrine: Doctrine): number {
  let best = -1;
  let bestScore = ARCHETYPE_THRESHOLD;
  ARCHETYPES.forEach((archetype, index) => {
    let score = 0;
    let weight = 0;
    archetype.axes.forEach((sign, axis) => {
      if (sign === 0) return;
      score += sign * (doctrine[axis] ?? 0);
      weight++;
    });
    // Un axe tenu à l'opposé de la direction fait baisser le score.
    score /= weight;
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

export function archetypeName(doctrine: Doctrine): string {
  const index = archetypeOf(doctrine);
  return index < 0 ? BALANCED_ARCHETYPE.name : ARCHETYPES[index].name;
}

/**
 * Penchants de l'IA selon son tempérament (prudent, belliqueux, commerçant, bâtisseur) ; chaque
 * pays y ajoute un écart tiré au hasard, pour couvrir tout le spectre.
 */
export const AI_DOCTRINE_LEANING: readonly Doctrine[] = [
  [-0.3, 0, -0.2, 0, 0],
  [0.8, 0.5, 0.3, -0.4, 0.6],
  [0, -0.4, 0.2, 0.9, -0.5],
  [-0.4, -0.5, 0, -0.2, 0.4],
];
export const AI_DOCTRINE_SPREAD = 0.7;
/** Chance qu'une IA lance une recherche à chacune de ses décisions de chantier. */
export const AI_RESEARCH_CHANCE = 0.35;
