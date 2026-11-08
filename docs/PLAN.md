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

## État du jalon 2

Code terminé, **test clé encore ouvert : seul un joueur peut dire si c'est fun.** Toutes
les parties ont été jouées par des scripts ou des clics simulés.

**Ajouts.**

- **Terrain :** montagne, plateau, désert, arctique et jungle freinent l'attaquant. Les
  régions viennent de Natural Earth, et les massifs manquants sont des contours
  approximatifs dans `data/map-config.json`. Il n'y a ni rivières ni forêts.
- **Offensives :** une flèche d'au plus 100 cellules engage une part de la réserve et
  pousse dans un couloir, même si le front ne fait que tenir. Chaque cellule coûte des
  forces, et la pression retombe avec la profondeur.
- **Encerclements :** toutes les 2 s, une zone coupée du cœur du pays et au contact d'un
  ennemi devient une poche. Elle s'effrite et draine les forces. Les îles et les exclaves
  d'origine, comme l'Alaska, sont exemptées tant qu'elles gardent leur point d'ancrage.
- **Pause et vitesse :** ×1, ×2, ×4, avec ordres possibles en pause.
- **IA :** elle engage presque tout en sous-nombre, et lance des offensives sinon.

**Parties scriptées de 30 min sur la vraie carte** (gain du joueur, en cellules, avec une
seule graine). Les stratégies sont rigides : elles ne réagissent pas comme un joueur.

| Stratégie | France contre IA allemande | Allemagne contre IA française |
|---|---|---|
| Tient à 100 %, sans réserve | −114 | −67 |
| Tient à 60 %, sans offensive | −3 517 | −186 |
| Attaque à 100 % | −1 909 | +713 (armée usée) |
| Tient à 60 %, une offensive par minute | −108 | +788 |
| Tient à 40 %, offensives toutes les 30 s | Effondrement en 12 min | +5 917 |

**Pire cas** : toutes les nations voisines en guerre, avec offensives et poches.

| Mesure | Résultat |
|---|---|
| Tick sans navigateur | Médiane 5,8 ms, p95 49 ms, p99 84 ms, max 91 ms |
| Tick dans le Worker, à ×4 | Environ 5 ms, max 56 ms |
| Image, carte entière, à ×4 | Médiane 4,2 ms, p99 5,3 ms, max 6,1 ms |

Le rendu ne souffre pas. Le coût vient du contrôle du ravitaillement, toutes les 2 s, qui
parcourt toute la terre en guerre : il reste sous le budget de 100 ms, mais de peu, et sur
une machine rapide. Pistes si besoin : ne traiter que les nations qui ont changé, ou
répartir le contrôle sur plusieurs ticks. Il tourne dans le Worker : un pic retarde la
simulation, pas l'image.

Points à reprendre :

- **La France ne gagne de terrain avec aucun script.** C'est peut-être la rigidité des
  scripts, ou un vrai déséquilibre pour le camp faible.
- **Résultats très variables selon la graine** dans certains matchs. Il faudra plus de
  graines pour conclure sur une stratégie.
- **Poches côtières :** une poche au bord de la mer s'effrite aussi. Le ravitaillement
  maritime reste à décider avec les traversées (jalon 3).
- **Point d'ancrage perdu :** si une exclave perd sa cellule d'ancrage, elle peut devenir
  une poche. C'est voulu, mais le joueur ne le voit pas sur la carte.
- **Panneau des fronts** long à faible hauteur d'écran : il défile.

## État du jalon 1

Terminé. Le front bouge en direct, piloté par une posture et un curseur par front.

**Modèle de combat.** Chaque front compare la densité de forces des deux camps (force
engagée ÷ longueur du front, multipliée par la posture). À chaque tick, une cellule de
front bascule avec une probabilité qui dépend de cet avantage, d'une variation locale par
secteur et du nombre de ses voisines ennemies, ce qui lisse les pointes.

**Pire cas mesuré à ce jalon**, avant les offensives et les poches : 322 fronts ouverts en
même temps, soit toutes les nations voisines en guerre, sur RTX 4070 SUPER.

| Mesure | Résultat |
|---|---|
| Tick sans navigateur, 20 min de jeu | Médiane 1,1 ms, p99 2,8 ms, max 10,6 ms (budget : 100 ms) |
| Tick dans le Worker | Environ 3 ms, max 8,2 ms |
| Image, carte entière en guerre mondiale | Médiane 4,2 ms, p99 5 ms, max 6,1 ms |
| Frontière active | Environ 55 000 cellules au plus |
| Bascules | Environ 2 500 par seconde, au plus 323 par tick (1,9 Ko) |

La grille 4096×2048 est donc confirmée : le repli en 2048×1024 n'est pas nécessaire.

Points à reprendre :

- **Îles et territoires d'outre-mer** hors d'atteinte tant que les traversées maritimes
  n'existent pas (jalon 3). Une nation sans frontière terrestre reste en vie : il n'y a
  pas encore de capitulation.
- **Puissance militaire provisoire** : `baseCapacity` dépend du PIB et de la population de
  départ. Elle sera remplacée par l'économie au jalon 4.
- **Noms de pays** : ils restent à leur place d'origine, même sur un pays entièrement conquis.
- **Sauvegarde et rejeu** : la simulation est déterministe à ordres égaux, mais les ordres
  ne sont pas encore journalisés avec leur tick. Il faudra le faire au jalon 3.

## État du jalon 0

Terminé. Choix techniques à retenir pour la suite :

- **Grille :** 4096×2048 cellules en projection de Miller, de 83,7° N à environ 58° S.
  Elle boucle en longitude, ce qui rend le Pacifique traversable.
- **Biais de surface :** Miller étire les hautes latitudes, donc la Russie et le Canada
  ont plus de cellules que leur surface réelle ne le voudrait. La surface réelle de chaque
  province est stockée à part : l'économie doit s'en servir, pas du nombre de cellules.
- **Propriétaires :** `ownerGrid` est séparée des provinces, et seules les tuiles modifiées
  sont renvoyées à la texture (`texSubImage2D`).
- **`SharedArrayBuffer` exclu :** il exige des en-têtes HTTP indisponibles sur la plupart
  des hébergeurs statiques. La simulation envoie les cellules modifiées au rendu.

Points à reprendre plus tard :

- **Performances à vérifier sur une puce graphique intégrée.** Seuls une RTX 4070 SUPER
  (240 fps) et le rendu logiciel (2 à 7 fps, mesuré au jalon 0) ont été testés. Le dézoom
  coûte environ 3,5 fois plus cher, car il prend 4 échantillons par pixel. Ce serait la
  première optimisation à faire.
- **Provinces par population (jalon 4).** Le découpage suit la surface : la Russie en a
  403, le Groenland 116, la Chine 95. Il faudra fusionner les zones vides et affiner les
  zones denses.
- **Données par province (jalon 4).** Population et PIB n'existent que par pays, avec des
  années variables. La source par province reste à choisir.
- **Noms de provinces.** Certains viennent bruts de Natural Earth (« autonome juif ») ou
  de fusions et scissions (« Dorset-Jersey », « Sakha Ouest 13 »).
