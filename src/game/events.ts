// Textes des événements du monde, pour le journal et les messages.
import { ARCHETYPES, BALANCED_ARCHETYPE, DOCTRINE_AXES } from '../sim/doctrine.ts';
import type { SimEvent } from '../sim/protocol.ts';

/** Nations concernées par un événement. */
export function eventNations(event: SimEvent): number[] {
  switch (event.type) {
    case 'war':
    case 'peace':
    case 'alliance':
    case 'allianceBroken':
    case 'tradeDeal':
    case 'tradeDealEnded':
      return [event.a, event.b];
    case 'tradeDealRefused':
    case 'embargo':
    case 'embargoLifted':
      return [event.from, event.to];
    case 'axisBuilt':
    case 'axisRestored':
    case 'axisRefused':
    case 'networkChanged':
    case 'researchDone':
    case 'doctrineNamed':
      return [event.nation];
    case 'axisCut':
      return event.by ? [event.nation, event.by] : [event.nation];
    case 'capitulation':
      return [event.loser, event.winner];
    case 'peaceRefused':
    case 'peaceOffer':
    case 'allianceRefused':
      return [event.from, event.to];
    case 'coalition':
      return [event.target, ...event.members];
    case 'secession':
    case 'independence':
      return [event.parent, event.rebel];
    case 'demand':
      return [event.parent, event.origin];
  }
}

/** Une ligne de journal. */
export function describeEvent(event: SimEvent, nameOf: (id: number) => string): string {
  switch (event.type) {
    case 'war':
      return `Guerre : ${nameOf(event.a)} et ${nameOf(event.b)}`;
    case 'capitulation':
      return `${nameOf(event.loser)} capitule devant ${nameOf(event.winner)}`;
    case 'peace':
      return `Paix : ${nameOf(event.a)} et ${nameOf(event.b)}`;
    case 'peaceRefused':
      return `${nameOf(event.to)} refuse la paix à ${nameOf(event.from)}`;
    case 'peaceOffer':
      return `${nameOf(event.from)} propose la paix à ${nameOf(event.to)}`;
    case 'alliance':
      return `Pacte de non-agression : ${nameOf(event.a)} et ${nameOf(event.b)}`;
    case 'allianceRefused':
      return `${nameOf(event.to)} refuse le pacte de ${nameOf(event.from)}`;
    case 'allianceBroken':
      return `${nameOf(event.a)} rompt son pacte avec ${nameOf(event.b)}`;
    case 'coalition':
      return `Soulèvement contre ${nameOf(event.target)} : ${event.members.map(nameOf).join(', ')}`;
    case 'secession':
      return `${nameOf(event.rebel)} se soulève contre ${nameOf(event.parent)}`;
    case 'independence':
      return `${nameOf(event.rebel)} obtient son indépendance de ${nameOf(event.parent)}`;
    case 'demand':
      return `${nameOf(event.origin)} demande ${event.kind === 'investment' ? 'des investissements' : "l'indépendance"} à ${nameOf(event.parent)}`;
    case 'tradeDeal':
      return `Accord commercial : ${nameOf(event.a)} et ${nameOf(event.b)}`;
    case 'tradeDealRefused':
      return `${nameOf(event.to)} refuse l'accord commercial de ${nameOf(event.from)}`;
    case 'tradeDealEnded':
      return `Fin de l'accord commercial entre ${nameOf(event.a)} et ${nameOf(event.b)}`;
    case 'embargo':
      return `${nameOf(event.from)} impose un embargo à ${nameOf(event.to)}`;
    case 'embargoLifted':
      return `${nameOf(event.from)} lève son embargo sur ${nameOf(event.to)}`;
    case 'axisBuilt':
      return `${nameOf(event.nation)} ouvre un axe commercial`;
    case 'axisCut':
      return event.by ? `${nameOf(event.by)} coupe un axe commercial de ${nameOf(event.nation)}` : `Un axe commercial de ${nameOf(event.nation)} est coupé`;
    case 'axisRestored':
      return `${nameOf(event.nation)} rétablit un axe commercial`;
    case 'axisRefused':
      return `Axe commercial refusé : ${event.terminals} terminus`;
    case 'networkChanged':
      return `Réseau commercial de ${nameOf(event.nation)} redessiné`;
    case 'researchDone':
      return `Recherche achevée : ${DOCTRINE_AXES[event.axis].name}, niveau ${event.level}`;
    case 'doctrineNamed':
      return `Doctrine de ${nameOf(event.nation)} : ${(ARCHETYPES[event.archetype] ?? BALANCED_ARCHETYPE).name}`;
  }
}

/** Clé stable d'un événement, pour l'affichage. */
export function eventKey(event: SimEvent): string {
  return `${event.type}-${event.tick}-${eventNations(event).join('-')}`;
}
