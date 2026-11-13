// Nom d'une région historique tant qu'elle n'est pas indépendante : « Bretagne », pas « Duché de
// Bretagne ». Le nom d'État (data/regions.json) n'apparaît qu'à sa naissance.

/** Noms d'État dont le nom de région ne se déduit pas en retirant le titre. */
const OVERRIDES: Record<string, string> = {
  'République corse': 'Corse',
  'République catalane': 'Catalogne',
  'République riograndense': 'Rio Grande do Sul',
  'Royaume ashanti': 'Ashanti',
  'Royaume zoulou': 'Zoulouland',
  'Royaume Kongo': 'Bas-Congo',
  'États pontificaux': 'Latium',
  'État druze': 'Djebel druze',
  'État des Alaouites': 'Pays alaouite',
  "République d'Extrême-Orient": 'Extrême-Orient',
  "République de l'Oural": 'Oural',
  'République des Sept-Îles': 'Îles Ioniennes',
  "République d'Ezo": 'Hokkaidō',
  'Royaume de Dali': 'Yunnan',
  'Khanat de Khiva': 'Khorezm',
  'Royaume des Mosquitos': 'Côte des Mosquitos',
  "Confédération de l'Équateur": 'Nordeste',
  'République de Venise': 'Vénétie',
  'Duché de Milan': 'Lombardie',
  'République de Gênes': 'Ligurie',
  'Royaume de Majorque': 'Baléares',
  'Comté de Toulouse': 'Languedoc',
  'Royaume de Tahiti': 'Polynésie',
  'République du Cap': 'Province du Cap',
  'République du Rio Grande': 'Nord-Est mexicain',
  'Royaume de Lanna': 'Nord thaïlandais',
  'Royaume de Ryūkyū': 'Okinawa',
};

/** Titre d'État en tête du nom, avec son article : « Duché de », « Royaume d'», « Sultanat de l'». */
const TITLE = /^(Province libre|État fédéral|Grand-duché|Principauté|Royaume|République|Dominion|Sultanat|Émirat|Khanat|Duché|Comté|État) (de l'|de la |des |du |de |d')/;

export function regionName(stateName: string): string {
  const override = OVERRIDES[stateName];
  if (override) return override;
  const name = stateName.replace(TITLE, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}
