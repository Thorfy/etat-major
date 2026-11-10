// Textes des événements du monde, pour le journal et les messages.
import type { SimEvent } from '../sim/protocol.ts';

/** Nations concernées par un événement. */
export function eventNations(event: SimEvent): number[] {
  switch (event.type) {
    case 'war':
    case 'peace':
    case 'alliance':
    case 'allianceBroken':
      return [event.a, event.b];
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
  }
}

/** Clé stable d'un événement, pour l'affichage. */
export function eventKey(event: SimEvent): string {
  return `${event.type}-${event.tick}-${eventNations(event).join('-')}`;
}
