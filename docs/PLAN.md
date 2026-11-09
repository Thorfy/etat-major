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

- **Mers :** version de base en place depuis le jalon 3 : une puissance navale par nation
  et des flèches amphibies depuis n'importe quelle côte. Les zones maritimes et les ports
  restent à décider. Pas de flottes individuelles.
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

## État du jalon 5

Terminé : une percée trop profonde s'essouffle. Sur une bande de test, la même suite de
flèches avance d'environ 20 cellules par minute sans logistique, du début à la fin. Avec la
logistique, elle tombe vers 9 cellules par minute au-delà de 100 cellules de profondeur, et le
ravitaillement de sa pointe descend à 0,18. **Le test de plaisir reste ouvert** : personne n'a
encore joué à la main.

**Règles.** Toutes sont des premiers réglages, dans `src/sim/balance.ts`.

- **Sol national :** toujours ravitaillé, tant qu'il n'est pas encerclé (les poches gardent
  leur règle du jalon 2).
- **Territoire conquis :** son ravitaillement dépend de la distance au sol national de son
  occupant, comptée en coût de transport. Il est plein sur 20 unités, puis s'éteint sur 60
  unités, sans descendre sous 15 % : on vit sur le pays.
- **Coût de transport d'une cellule :** le terrain (plaine 1, plateau 1,5, désert 2, montagne,
  arctique et jungle 2,5), multiplié par l'infrastructure de la province. Celle-ci va de ×0,5
  (bassin industriel) à ×1,5 (province vide), d'après la densité de PIB. On porte donc loin en
  Europe de l'Ouest, et peu dans le Sahara ou en Sibérie.
- **Consolidation :** une province occupée se consolide en 3 min. Son coût de transport tombe
  alors à 30 %. Elle ne compte qu'au profit de celui qui contrôle la province, c'est-à-dire qui
  en tient la majorité des cellules. Une percée étroite à travers de grandes provinces ne se
  consolide donc pas : il faut l'élargir.
- **Par la mer :** une côte conquise est ravitaillée depuis la mer, pour un coût de 15, tant que
  la marine vaut au moins la moitié de celle de l'ennemi. Une tête de pont dont la marine perd
  la mer devient une poche, comme avant.
- **Effets :** sur une cellule mal ravitaillée, l'attaquant perd jusqu'à 1,5 en log du rapport
  de force, et le défenseur qui l'occupe jusqu'à 1. Un camp mal ravitaillé s'use jusqu'à 0,06 %
  de ses forces par tick, même sans combat, et une offensive mal ravitaillée jusqu'à cinq fois
  plus vite. L'essoufflement propre aux flèches est divisé par deux (−1 de log tous les 220
  cellules au lieu de 110) : la logistique fait le reste.
- **IA :** elle ne lance plus d'offensive depuis une cellule ravitaillée à moins de 50 %.
- **Interface :** troisième carte « Ravitaillement » (bouton en haut ou touche R), du rouge
  (coupé) au vert (ravitaillé), sur le seul territoire conquis. Le panneau donne le
  ravitaillement de chaque front, des deux côtés, et celui de chaque offensive, avec un message
  quand l'une d'elles passe sous 40 %. La fiche d'une cellule conquise donne son ravitaillement
  et la consolidation de sa province.
- **Sauvegarde :** la grille du ravitaillement est sauvegardée telle quelle, car la recalculer
  à la reprise changerait la suite de la partie. Le format passe en version 3.

**Performances.** Le calcul du ravitaillement a d'abord fait passer le pire cas à 223 ms.
Trois changements l'ont ramené à 75 ms, en dessous de son niveau du jalon 4 :

- Les nations sont contrôlées en quatre groupes, à tour de rôle toutes les 0,5 s. Chacune
  reste contrôlée toutes les 2 s, mais aucun tick ne porte tout le calcul.
- Un seul parcours de la terre par contrôle, sans appel de fonction par cellule.
- Les calculs lourds ne tombent plus sur le même tick : voisinages par la terre et par la mer
  séparés (ils prenaient 87 ms ensemble), et capitulations décalées.

| Mesure | Résultat |
|---|---|
| Pire cas, guerre mondiale, 10 min de jeu | Médiane 7,3 ms, p95 57 ms, p99 60 ms, **max 75 ms** (jalon 4 : 89 ms) |
| Monde sans joueur, 60 min, deux graines | 138 et 146 nations sur 193 ; tick max 65 et 64 ms |
| Frontière active à 60 min | 2 800 à 3 600 cellules (jalon 4 : 15 000 à 30 000) |
| Sauvegarde, après 60 min | Environ 440 Ko de JSON avant compression, plus la grille |
| Navigateur | Percée allemande en Pologne, carte et fiche ; reprise identique, grille du ravitaillement comprise |
| Tests | 101 réussis, dont 6 sur la logistique |

Le p95 monte, de 36 à 57 ms : les contrôles sont quatre fois plus fréquents, chacun plus léger.

**Duels de 30 min sur la vraie carte, le reste du monde jouant aussi** (gain du joueur en
cellules, deux graines ; entre parenthèses, le jalon 4) :

| Stratégie du joueur | France contre IA allemande | Allemagne contre IA française |
|---|---|---|
| Tient à 100 %, sans réserve | −397 et −1 111 (−574 et −647) | −57 et 0 (−59 et 0) |
| Tient à 60 %, sans offensive | −2 420 et −2 673 (capitule) | −378 et −290 (−245 et −246) |
| Attaque à 100 % | −1 491 et −1 674 (capitule) | −7 et −56 (−36 et −3) |
| Tient à 60 %, une offensive par minute | Capitule en 26 min (22 et 26 min) | +97 et +63 (+286 et +32) |
| Tient à 40 %, offensives toutes les 30 s | Capitule en 12 et 14 min (13 min) | +615 et +104 (+1 003 et +76) |
| Effort à 100 %, une offensive par minute | +727 et +170 à 10 min, puis −1 085 et −127 (+192 et +50) | +1 468 et +1 150 (+2 424 et +676) |

La défense en profondeur paie : une France passive ne capitule plus, car les avancées
allemandes s'épuisent en territoire français. Les gains offensifs baissent dans l'ensemble. La
France à effort maximal perce vite, puis reflue : sa percée s'épuise loin de ses bases pendant
que son industrie s'use. Les scripts qui enchaînent les flèches vers le cœur de l'Allemagne
s'effondrent toujours, ce qui est l'effet voulu.

Points à reprendre :

- **Rythme à éprouver par un joueur.** Une avance large et lente reste ravitaillée, parce que
  la consolidation suit. Seules les percées rapides s'essoufflent. Si c'est trop doux ou trop
  dur à la main : portée sans perte, durée de consolidation, malus d'attaque.
- **La France gagne toujours rarement contre l'Allemagne,** mais elle tient désormais.
- **Pas de dépôts, de routes ni de consommation :** une grande armée loin de chez elle est
  ravitaillée comme une petite. Le ravitaillement ne dépend que de la distance, du terrain, de
  l'infrastructure et de la consolidation.
- **Pas de blocus ni de ports :** la mer ravitaille n'importe quelle côte conquise, selon le seul
  rapport des marines.
- **Le ravitaillement se lit cellule par cellule** sur la carte et dans la fiche. Une flèche
  tracée ne montre pas encore à l'avance jusqu'où elle restera ravitaillée.
- **Pire cas plus régulier, mais pas plus bas en médiane :** p95 à 57 ms. Pistes si besoin :
  listes de cellules par nation, pour ne plus parcourir toute la terre à chaque contrôle.

## État du jalon 4

Terminé : la puissance militaire vient de l'économie, et le critère est tenu. Prendre la
province industrielle d'un pays de test fait passer le rapport de capacité au-delà de 2 contre 1,
contre moins de 1,3 pour une province pauvre de même taille. **Le test de plaisir reste ouvert** :
personne n'a encore joué à la main.

**Données.** Natural Earth ne donne population et PIB que par pays. Chaque pays les répartit
entre ses provinces : 35 % de la population et 15 % du PIB selon la surface habitable (pondérée
par le terrain), le reste selon la population des villes (`populated places`, 7 342 villes).
Exemples : l'Île-de-France porte 33 % du PIB français, la Rhénanie-du-Nord-Westphalie 21 % de
l'allemand, Moscou 11 % du russe. Les réglages sont dans `data/map-config.json` (`economy`).

**Règles.** Toutes sont des premiers réglages, dans `src/sim/balance.ts`.

- **Valeur d'une province :** 75 % de sa part du PIB et 25 % de sa part de la population de son
  pays. La capacité militaire totale d'un pays au départ ne change pas, elle se concentre dans
  ses régions industrielles. Les capitulations suivent cette valeur : perdre Paris et le Nord
  rapproche bien plus la France de la capitulation que perdre la Lozère.
- **Développement :** chaque province part à 100 %. Il multiplie sa valeur et son PIB.
- **Effort de guerre :** un curseur de 0 à 100 %, 50 % au départ. La capacité militaire est
  multipliée par 0,5 + l'effort (de ×0,5 à ×1,5). L'économie se reconvertit à 0,8 point par
  seconde : passer de 50 à 100 % prend environ une minute.
- **Croissance et usure :** sous 50 %, les provinces tenues par leur pays grandissent, jusqu'à
  +2 % par minute à effort nul (moitié moins en guerre), dans la limite de 180 %. Au-dessus, elles
  s'usent au même rythme, sans descendre sous 60 %. Une économie de guerre totale est donc un
  sprint : elle paie pendant une vingtaine de minutes, puis l'industrie usée la rattrape.
- **Destructions :** une province qui change de mains au combat perd 15 % de son développement,
  sans descendre sous 30 %. Une annexion après capitulation se fait sans destructions.
- **Démobilisation :** une armée au-dessus de la capacité fond de 0,04 % de l'excédent par tick.
- **IA :** effort de 35 % en paix, 65 % en guerre, 90 % en sous-nombre, avec un tempérament de
  ±10 points tiré au début de la partie.
- **Interface :** section Économie du panneau (PIB, croissance ou usure, effort de guerre),
  fiche des pays et des provinces (PIB, population, développement), et carte économique
  (bouton en haut ou touche E) teintée par la densité de PIB. Un message rappelle de relever
  l'effort au début d'une guerre s'il est encore à 50 % ou moins.
- **Sauvegarde :** l'économie est sauvegardée. Le format passe en version 2 : les parties du
  jalon 3 sont refusées avec un message.

**Duels de 30 min sur la vraie carte, le reste du monde jouant aussi** (gain du joueur en
cellules, deux graines, et rapport de capacité joueur/ennemi à la fin) :

| Stratégie du joueur | France contre IA allemande | Allemagne contre IA française |
|---|---|---|
| Tient à 100 %, sans réserve | −574 et −647 (0,74) | −59 et 0 (1,23) |
| Tient à 60 %, sans offensive | Capitule en 24 et 29 min | −245 et −246 (1,23) |
| Attaque à 100 % | Capitule en 22 et 26 min | −36 et −3 (1,23) |
| Tient à 60 %, une offensive par minute | Capitule en 22 et 26 min | +286 et +32 (1,16) |
| Tient à 40 %, offensives toutes les 30 s | Capitule en 13 min | +1 003 et +76 (1,30) |
| **Même chose qu'une offensive par minute, effort à 100 %** | **+192 et +50 (0,9)** | **+2 424 et +676 (1,35)** |

L'effort de guerre est le levier décisif. Pour la première fois, un script français gagne du
terrain contre l'Allemagne, mais seulement s'il relève son effort. Les autres scripts restent
à 50 % alors que l'IA monte à 65 ou 90 % dès la guerre : face à elle, ils perdent bien plus
qu'au jalon 3. À l'inverse, l'Allemagne ne balaie plus la France, car l'IA française mobilise
aussi. Un joueur qui ignore le curseur sera donc nettement puni, d'où le rappel en début de guerre.

**Mesures.**

| Mesure | Résultat |
|---|---|
| Monde sans joueur, 60 min à ×1, deux graines | 145 et 138 nations sur 193 à la fin (jalon 3 : environ 145) |
| Tick de ces parties | Médiane 0,4 et 0,8 ms, p99 22 et 29 ms, max 81 et 82 ms |
| Pire cas, guerre mondiale, 10 min de jeu | Médiane 3,5 ms, p95 36 ms, p99 44 ms, **max 89 ms** (jalon 3 : 170 ms) |
| Sauvegarde, après 60 min | 584 et 755 Ko de JSON avant compression |
| Tests | 95 réussis, dont 13 sur l'économie |

Le pire cas repasse sous le budget de 100 ms, sans optimisation dédiée : la cause des pics du
jalon 3 reste non isolée, et ce résultat peut varier d'une partie à l'autre.

Points à reprendre :

- **Équilibre de l'effort à éprouver par un joueur.** L'écart entre 50 % et 100 % d'effort
  décide presque seul des duels. Si c'est trop tranché à la main, pistes : une IA moins prompte
  à mobiliser, ou une reconversion plus lente.
- **Provinces par population.** Le découpage suit toujours la surface : la Russie a 403
  provinces, et une province industrielle peut être immense (« Sussex de l'Ouest et environs »
  porte 25 % du PIB britannique avec Londres).
- **Données approximatives.** La répartition par les villes est une estimation : elle ignore
  les zones industrielles sans grande ville et compte les agglomérations qui débordent sur
  plusieurs provinces. 43 villes tombent hors de toute province, et les pays sans ville connue
  répartissent tout selon la surface habitable.
- **Pas de commerce ni de ressources :** le PIB ne dépend que du territoire et de l'effort.
  Pétrole, blocus et échanges ne sont pas venus avec la logistique du jalon 5. Ils pourraient
  venir avec la diplomatie (jalon 6).
- **La richesse va aux pays épargnés.** Sur 60 min, les États-Unis, souvent en guerre, perdent
  19 % de PIB, quand le Japon en paix en gagne 44 %. C'est voulu, mais il n'y a encore aucun
  frein à la croissance d'un pays en paix. La Russie garde ses 23 % de terres.

## État du jalon 3

Terminé : une partie complète se joue, de la paix à la capitulation, avec sauvegarde.
**Le test de plaisir du jalon 2 reste ouvert** : toutes les parties ont été jouées par des
scripts ou des clics simulés.

**Règles ajoutées.** Toutes sont des premiers réglages, dans `src/sim/balance.ts`.

- **Monde :** on choisit un pays, on démarre en paix. Une nation en paix attaque parfois un
  voisin au moins 1,2 fois plus faible, par terre ou par mer. Le joueur a 3 min de répit.
- **Déclarer la guerre :** à un voisin, ou à n'importe qui avec une marine. Sans frontière
  commune, le front démarre à 0 % de forces, avec une alerte au premier contact.
- **Débarquements :** une flèche qui traverse au moins 3 cellules d'eau part en mer. La
  traversée prend du temps, les pertes dépendent de la distance et du rapport des marines,
  puis une tête de pont apparaît. La flèche peut faire 1 600 cellules, puis reprend la
  portée normale après le débarquement.
- **Marine :** une seule valeur par nation, tirée du PIB, nulle sans accès à la mer. Une zone
  côtière coupée reste ravitaillée si sa marine vaut au moins la moitié de celle de l'ennemi.
  Il n'y a ni flottes ni zones maritimes.
- **Capitulation :** sous 25 % de la valeur de son territoire d'origine. L'ennemi qui en tient
  le plus annexe le reste, îles comprises. Les provinces annexées ne valent plus que 35 % et
  ne sont plus hachurées. Les autres guerres du vaincu s'arrêtent.
- **Plafond :** 1,5 cellule par tick et par front, pour qu'aucun pays ne s'écroule en une minute.
- **Noms de pays :** ils suivent le territoire et disparaissent avec le pays.
- **Sauvegarde :** deux emplacements dans le navigateur, automatique toutes les 2 min et
  manuel. Une partie reprise démarre en pause.
- **Défaite :** on peut revenir au menu ou regarder le monde continuer.

**Vérifié.**

- Une partie reprise après une sauvegarde suit la même partie qu'une partie jamais
  interrompue : même carte et même empreinte d'état après 2 400 ticks, avec IA et offensives.
- Dans le navigateur, la carte reprise après rechargement a la même empreinte. Un fichier
  fait environ 230 Ko au début d'une partie.
- Le build de production marche depuis un sous-dossier, sauvegarde comprise.

**Parties mondiales sans joueur** (IA seule, 60 min à ×1, deux graines) : environ 145 nations
sur 193 à la fin, soit 0,8 capitulation par minute, et 15 à 20 guerres en cours en moyenne.
À ce rythme, il faudrait bien plus de 2 h pour qu'il ne reste que quelques blocs.

**Pire cas**, toutes les nations voisines en guerre :

| Mesure | Résultat |
|---|---|
| Tick sans navigateur, 10 min de jeu | Médiane 6,4 ms, p95 37 ms, p99 88 ms, **max 170 ms** |
| Tick dans le Worker, à ×4 | Environ 6 ms, **max 170 ms** |
| Image, carte entière, à ×4 | Médiane 4,2 ms, p99 5,5 ms, max 9,2 ms |

Le budget de 100 ms est donc dépassé par pics. Cela se produit dans le Worker : l'image ne
saute pas, la simulation prend un court retard qu'elle rattrape. Causes probables, non isolées :
le contrôle du ravitaillement, toutes les 2 s, et le recalcul des voisinages, toutes les 60 s.

Points à reprendre :

- **Équilibre à éprouver par un joueur.** Les scripts jouant la France contre l'Allemagne n'ont
  jamais gagné de terrain, et ces duels n'ont pas été remesurés depuis le plafond par front.
- **Pas de paix.** Une guerre ne finit que par une capitulation. Un front bloqué le reste. La
  diplomatie arrive au jalon 6.
- **Prudence de l'IA :** elle attaque sur la seule capacité, sans regarder ses autres fronts.
- **Géants peu inquiétés :** la Russie reste autour de 23 % de la terre dans ces parties, et
  peu de pays sont assez forts pour l'attaquer. À revoir avec l'économie.
- **Une carte régénérée invalide les sauvegardes**, ce qui est volontaire : la reprise refuse
  alors la partie, avec un message.
- **Pas de reconquête après une annexion :** impossible de libérer un pays disparu.
- **Sauvegarde automatique :** une partie reprise en pause n'est pas ré-enregistrée tant que
  le temps ne repart pas, et la dernière sauvegarde peut donc dater de 2 min.

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

**Parties scriptées de 30 min sur la vraie carte, avant le jalon 3 et donc sans le reste du
monde** (gain du joueur, en cellules, avec une seule graine). Les stratégies sont rigides :
elles ne réagissent pas comme un joueur.

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

- **Puissance militaire provisoire** : réglé au jalon 4. `baseCapacity` ne fixe plus que la
  capacité de départ d'un pays, que l'économie fait ensuite évoluer.

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
- **Provinces par population.** Toujours ouvert après le jalon 4. Le découpage suit la
  surface : la Russie en a 403, le Groenland 116, la Chine 95. Il faudra fusionner les zones
  vides et affiner les zones denses.
- **Données par province :** réglé au jalon 4, par la population des villes. Les données
  par pays restent d'années variables.
- **Noms de provinces.** Certains viennent bruts de Natural Earth (« autonome juif ») ou
  de fusions et scissions (« Dorset-Jersey », « Sakha Ouest 13 »).
