# Plan du jeu

Grande stratégie solo en temps réel sur la Terre moderne, dans un navigateur.
Une partie dure 1 à 2 h, avec pause, vitesse réglable et sauvegarde.

## Décisions de conception

| Sujet | Décision |
|---|---|
| Monde | Terre réelle, époque moderne, ton neutre (les pays sont un plateau de jeu) |
| Carte | Hybride : provinces pour la logique, grille de pixels pour le front continu |
| Guerre | Pression abstraite, sans divisions : curseurs par front + flèches d'offensive |
| Systèmes | Économie, logistique, diplomatie, technologies et doctrines, nucléaire |
| Fin de partie | Bac à sable, avec classement mondial |
| Technique | TypeScript, Vite, WebGL2, simulation dans un Web Worker, hébergement statique |
| Style | Carte d'état-major sobre |

Choix par défaut, à confirmer :

- **Mers :** zones maritimes abstraites avec une puissance navale, et flèches amphibies
  depuis les ports. Pas de flottes individuelles.
- **Aviation :** intégrée à la puissance militaire et aux doctrines.
- **Micro-États :** ceux qui sont trop petits pour la grille sont rattachés à un voisin.
- **Frontières contestées :** contrôle effectif, modifiable dans `data/map-config.json`.
- **Nom :** « Risk » est provisoire et devra changer avant toute mise en ligne publique.

## Jalons

| # | Contenu | Terminé quand |
|---|---|---|
| 0 | Script de données, carte du monde, déplacement et zoom | La Terre s'affiche à 60 fps et un clic donne le pays et la province |
| 1 | Simulation et curseurs, entre deux pays | Un front bouge en direct et le pire cas de performance est mesuré |
| 2 | Flèches, terrain, encerclements, pause et vitesse | **Test clé : est-ce que c'est fun ?** |
| 3 | Monde entier, IA, capitulations, sauvegarde, traversées maritimes de base | Première partie complète jouable |
| 4 | Économie et industrie | Conquérir une région industrielle change le rapport de force |
| 5 | Logistique et ravitaillement détaillés | Une percée trop profonde s'essouffle |
| 6 | Diplomatie, alliances, tension mondiale | Une coalition se forme contre un pays trop expansionniste |
| 7 | Technologies et doctrines | Deux doctrines donnent deux styles de jeu différents |
| 8 | Nucléaire, classement, finitions, mise en ligne | Le jeu est accessible par une URL |

## État du jalon 0

Terminé. Choix techniques à retenir pour la suite :

- **Grille :** 4096×2048 cellules en projection de Miller, de 83,7° N à environ 58° S.
  Elle boucle en longitude, ce qui rend le Pacifique traversable.
- **Biais de surface :** Miller étire les hautes latitudes, donc la Russie et le Canada
  ont plus de cellules que leur surface réelle ne le voudrait. La surface réelle de chaque
  province est stockée à part : l'économie doit s'en servir, pas du nombre de cellules.
- **Propriétaires :** `ownerGrid` est séparée des provinces. Le jalon 1 n'aura qu'à
  l'écrire et à envoyer les zones modifiées à la texture (`texSubImage2D`).
- **`SharedArrayBuffer` exclu :** il exige des en-têtes HTTP indisponibles sur la plupart
  des hébergeurs statiques. La simulation enverra les cellules modifiées au rendu.

Points à reprendre plus tard :

- **Performances à vérifier sur une puce graphique intégrée.** Seuls une RTX 4070 SUPER
  (240 fps) et le rendu logiciel (2 à 7 fps) ont été testés. Le dézoom coûte environ
  3,5 fois plus cher, car il prend 4 échantillons par pixel. Ce serait la première
  optimisation à faire.
- **Provinces par population (jalon 4).** Le découpage suit la surface : la Russie en a
  403, le Groenland 116, la Chine 95. Il faudra fusionner les zones vides et affiner les
  zones denses.
- **Données par province (jalon 4).** Population et PIB n'existent que par pays, avec des
  années variables. La source par province reste à choisir.
- **Noms de provinces.** Certains viennent bruts de Natural Earth (« autonome juif ») ou
  de fusions et scissions (« Dorset-Jersey », « Sakha Ouest 13 »).
- **Terrain (jalon 2).** Aucune donnée de relief n'est encore intégrée.
