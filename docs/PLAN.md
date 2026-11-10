# Plan du jeu

Grande stratégie solo en temps réel sur la Terre moderne, dans un navigateur.
Une partie dure 1 à 2 h, avec pause, vitesse réglable et sauvegarde.

## Décisions de conception

| Sujet | Décision |
|---|---|
| Monde | Terre réelle, époque moderne, ton neutre (les pays sont un plateau de jeu) |
| Carte | Hybride : provinces pour la logique, grille de pixels pour le front continu |
| Guerre | Pression abstraite, sans divisions : curseurs par front + flèches d'offensive |
| Systèmes | Économie et arrière, logistique, défense planifiée, diplomatie, technologies et doctrines, nucléaire |
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
- **Nom :** « État-major », choisi pour la mise en ligne. « Risk », le nom provisoire des
  premiers jalons, est une marque déposée.

## Jalons

| # | Contenu | Terminé quand |
|---|---|---|
| 0 | Script de données, carte du monde, déplacement et zoom | La Terre s'affiche à 60 fps et un clic donne le pays et la province |
| 1 | Simulation et curseurs, entre deux pays | Un front bouge en direct et le pire cas de performance est mesuré |
| 2 | Flèches, terrain, encerclements, pause et vitesse | **Test clé : est-ce que c'est fun ?** |
| 3 | Monde entier, IA, capitulations, sauvegarde, traversées maritimes de base | Première partie complète jouable |
| 4 | Économie et industrie | Conquérir une région industrielle change le rapport de force |
| 5 | Logistique et ravitaillement détaillés | Une percée trop profonde s'essouffle |
| 6 | L'arrière : chantiers, main-d'œuvre, lassitude de guerre, ressources stratégiques | Attaquer en boucle épuise le pays ; bâtir à l'arrière pèse sur la guerre |
| 7 | Défense planifiée : lignes fortifiées, réserve de contre-attaque, priorités par secteur | Une défense préparée arrête une attaque qui aurait percé sans elle |
| 8 | Diplomatie : trêves et paix, pactes de non-agression, séparatismes et soulèvements | Une région à bout fait sécession ; ses voisines annexées se soulèvent avec elle |
| 9 | Commerce : échanges entre pays et entre régions, axes commerciaux | Un axe tracé enrichit les régions qu'il traverse ; couper une route commerciale affaiblit l'ennemi |
| 10 | Technologies et doctrines | Deux doctrines donnent deux styles de jeu différents |
| 11 | Illustrations, générées avec ComfyUI (Qwen Image) | Chaque écran, événement, bâtiment et doctrine a son illustration, et le premier chargement reste léger |
| 12 | Nucléaire, classement, finitions, mise en ligne | Le jeu est accessible par une URL |

Les jalons 6 et 7 ont été ajoutés après le jalon 5, à la demande du joueur : il manquait des
décisions à l'intérieur du pays et pour préparer la défense, au-delà d'attaquer en boucle.
Le commerce (jalon 9) et les séparatismes (dans la diplomatie) ont été demandés pendant le
jalon 6 :

- **Séparatismes :** un pays dont la situation devient intenable (stabilité au plus bas,
  économie ruinée) voit des régions faire sécession et se battre contre lui. Ils viennent avec
  la diplomatie, qui apporte aussi les trêves : sans elles, une sécession ne finirait jamais.
  Pistes : ressusciter un pays annexé, ou découper un grand pays selon ses régions.
- **Commerce :** des échanges entre pays et entre régions, et des axes tracés par le joueur
  (routes, voies ferrées, lignes maritimes) qui enrichissent les régions traversées. Il
  remplace le marché mondial abstrait des ressources. Il suit la diplomatie, dont dépendent
  les accords commerciaux et les embargos.

Le jalon 11 (illustrations) a été demandé pendant le jalon 8. Il vient après les technologies et
doctrines, pour illustrer aussi leurs cartes :

- **Outil :** le ComfyUI du joueur et son pipeline Qwen Image, appelés par un script
  (`tools/illustrate.ts`) à travers l'API HTTP de ComfyUI (`/prompt`, `/history`, `/view`), à
  partir du flux de travail exporté au format API. Un catalogue (`data/illustrations.json`) donne
  pour chaque image son identifiant, sa consigne, son format et sa graine : on régénère une image
  ou toute la série à l'identique.
- **Style unique** pour toute la série : une consigne de style commune, partagée par chaque image.
- **Quoi :** écran d'accueil et choix du pays, chaque type d'événement (guerre, capitulation,
  paix, pacte, soulèvement, indépendance, demande d'une région), chaque bâtiment et chantier,
  chaque doctrine, la défaite et les fenêtres de fin de partie.
- **Poids :** WebP de 100 à 250 Ko, chargés à la demande ; le premier chargement du site reste
  d'environ 1 Mo. GitHub bloque les fichiers de plus de 100 Mio, recommande un dépôt de moins de
  1 Go, et limite le site publié à 1 Go : quelques centaines d'images (50 à 100 Mo) y tiennent
  largement, sans Git LFS (que GitHub Pages ne sert pas tel quel).

Corrections ajoutées au jalon 6, à la demande du joueur : une IA qui n'attaque plus seulement
les pays bien plus faibles, le choix du pays en cliquant sur la carte, des sauvegardes mises à
jour d'une version à l'autre, et une nouvelle gestion du temps (l'ancien ×4 devient la vitesse
normale, et le temps se compte en dates).

## État du jalon 8

Terminé : une région à bout fait sécession, et les régions annexées qui la touchent se soulèvent
avec elle, en coalition. Dans le test du critère, un pays qui a annexé trois voisins s'effondre :
les deux qui se touchent renaissent ensemble et s'allient, le troisième, séparé d'eux par une
terre du vainqueur, reste à part. **Le test de plaisir reste ouvert** au-delà des parties du
joueur décrites plus bas.

**Paix et trêves.**

- **Proposer la paix** (carte du front, ou fiche du pays) : l'IA décide aussitôt. Elle accepte si
  elle est lasse (stabilité sous 45 %), saignée (réservoir sous 25 %) ou si elle perd (elle tient
  une moindre part de son territoire que toi). Une IA qui gagne refuse, sauf à bout de forces. Pas
  de paix avant 4 semaines de guerre.
- **Traité :** chaque province disputée entre les deux revient à qui en tient la majorité, cellules
  minoritaires comprises, et la frontière se redessine. Les provinces cédées sont annexées (35 % de
  leur valeur, comme après une capitulation). Puis une trêve d'un an interdit la guerre entre eux.
- **L'IA propose la paix** au joueur quand elle la veut, après 4 semaines : l'offre s'affiche dans
  la section Diplomatie (Accepter, Refuser) et expire après 8 semaines.
- **Entre IA :** deux pays qui veulent tous deux la paix la signent. Dans une impasse où les deux
  réservoirs sont vides, c'est ce qui finit la guerre.

**Pactes de non-agression.** Proposés depuis la fiche d'un pays en paix, 4 au plus. Deux
signataires ne peuvent plus se déclarer la guerre (ni l'IA ni le joueur), mais **aucun n'entre en
guerre pour défendre l'autre** : il n'y a d'appel aux armes nulle part. L'IA signe avec un pays
agressif à moins de 45 % qu'elle ne pourrait pas attaquer de toute façon, ou face à une menace
commune (un ennemi en commun, ou un voisin 1,2 fois plus fort qu'elle et agressif). Un pacte
protège donc un flanc quand on est occupé ailleurs. Le rompre coûte un peu d'agressivité.

**Agressivité.** Déclarer une guerre ajoute 12 points d'agressivité ; annexer un pays ajoute
50 points × son poids rapporté au sien (5 au moins) ; obtenir des provinces par traité, un peu.
Elle retombe d'un point par semaine. Les guerres des soulèvements ne coûtent rien. Au-delà de 45 %,
plus personne ne signe de pacte avec ce pays. Elle ne fait plus naître de coalition (voir les
corrections plus bas).

**Séparatismes et soulèvements.** Un pays dont la stabilité tombe sous 25 % peut voir renaître le
pays qu'il avait annexé (une chance sur quatre toutes les 10 s de jeu) : celui-ci reprend ses
provinces d'origine encore tenues, avec leur valeur de départ, une armée mobilisée à 60 % et une
stabilité de 70 %, et lui déclare la guerre. Les autres pays annexés dont les terres touchent les
siennes, de proche en proche (4 au plus, 1 % du pays au moins chacun), renaissent avec lui et
forment une **coalition** : ils ne peuvent pas se faire la guerre entre eux, et chacun combat
l'ancien maître. C'est la seule coalition du jeu. Un membre qui fait la paix la quitte. Il ne
s'agit que de pays disparus : un pays qui n'a rien annexé ne se fragmente pas.

**Interface.** Onglet Diplomatie du panneau (agressivité, pactes, trêves, rebelles coalisés, offres
de paix), bouton « Proposer la paix » dans chaque carte de front, bloc Diplomatie dans la fiche
d'un pays (relation, rapport de force, agressivité, pactes, soulèvement, boutons), messages et
journal pour chaque événement. Voir aussi la refonte de l'interface plus bas.

**Performances.** Un traité ou une sécession parcourt toute la terre. Plusieurs traités sur la même
passe ont fait monter un tick à 113 ms : un seul traité entre IA et une seule sécession par passe
de 10 s, désormais.

| Mesure | Résultat |
|---|---|
| Monde sans joueur, 120 semaines, deux graines | 99 nations sur 193 à la graine 1 ; 57 paix ; 2 sécessions par graine, aucun soulèvement à plusieurs |
| Exemples | Le Kirghizistan quitte l'Ouzbékistan, Singapour la Malaisie, le Guatemala le Mexique, l'Islande le Danemark |
| Tick de ces parties | Max 39 et 42 ms |
| Pire cas, guerre mondiale, 10 semaines | Médiane 5,2 ms, p99 37 ms, **max 71 ms** |
| Navigateur | Alliance refusée, paix refusée trop tôt, puis acceptée dans une impasse, trêve affichée |
| Tests | 137 réussis, dont 12 sur la diplomatie ; sauvegardes des versions 1 à 5 mises à jour |

**Corrections après les parties du joueur.**

Première partie (« je me suis fait rouler dessus en attaquant l'Allemagne ») :

- **Les coalitions ne défendaient pas que contre leur cible.** Une alliance de coalition appelait
  ses membres contre n'importe quel agresseur : attaquer un membre, pour une tout autre raison,
  faisait entrer toute la coalition en guerre. Désormais, seuls les alliés par traité défendent
  contre tout le monde ; un partenaire de coalition ne défend que contre la cible de la coalition.
- **Voir avant d'attaquer.** La fiche d'un pays montre ses alliés, sa coalition et ses partenaires,
  et le rapport de force entre toi et lui, ses défenseurs compris. Si des alliés entreraient en
  guerre, le bouton les compte (« Déclarer la guerre : X et 2 alliés »), la fiche les nomme, et une
  confirmation est demandée. Sur la carte, les alliés du pays sélectionné sont éclaircis et rayés.
- Dans la partie vérifiée au navigateur, la fiche de l'Allemagne affichait 1 321 contre 1 546 :
  elle était déjà plus forte que la France avant toute alliance.

Deuxième partie (« les alliances sont beaucoup trop fortes […] impossible à gérer pour un joueur
lambda ») : les alliances deviennent des pactes de non-agression, sans aucun soutien militaire.
L'appel aux armes disparaît, coalitions comprises ; la fiche ne garde que le rapport de force face
au seul pays visé. La confirmation avant une guerre qui entraînait des alliés n'a plus lieu d'être.

Troisième partie (« les coalitions c'est pas gérable […] seulement par des états à l'intérieur
d'une nation qui se rebelle ») : les voisins ne se coalisent plus jamais contre un pays agressif.
Une coalition ne naît que d'un soulèvement, entre régions annexées qui se touchent (voir
Séparatismes). Dans les parties sans joueur, aucune IA n'a annexé assez de voisins contigus pour
en voir une : elle menace surtout un grand empire, celui du joueur le plus souvent.

**Refonte de l'interface** (« trop d'info à gauche […] l'UI saute tout le temps ») :

- **Barre du haut**, fixe : pays, date, vitesse, puis les indicateurs clés (armée, main-d'œuvre,
  stabilité, PIB, pétrole, acier, territoire), le choix de la carte, Sauvegarder et Menu. Sous
  1 500 px de large, les indicateurs passent sur une seconde ligne, toujours la même.
- **Panneau de gauche à onglets** : Fronts (offensives, cartes de front), Économie (production,
  effort de guerre, chantiers), Défense (situation, lignes fortifiées, secteurs, contre-attaque),
  Diplomatie (relations, offres de paix). Hauteur fixe ; chaque onglet défile seul. Une pastille
  compte les fronts, les chantiers et les offres de paix, et passe au rouge sur une alerte
  (offensive ennemie, encerclement, offre de paix, soulèvement).
- **Lignes stables :** les lignes ne naissent plus ni ne disparaissent ; une valeur absente
  s'écrit « — ». Les notes d'aide ont une hauteur réservée. Les indicateurs ont une largeur fixe.
- **Fiche de droite :** le pays, puis sa diplomatie (relation, rapport de force, agressivité,
  pactes, soulèvement) et deux boutons à place fixe (paix, pacte ou rupture ; déclarer la guerre),
  ou « Bâtir ici » pour ses propres provinces, puis la province. Elle descend jusqu'au bas de
  l'écran et défile si besoin.
- **Journal** en bas au centre, sur une hauteur fixe ; sur téléphone, la fiche ouverte remplace
  le panneau de gauche.
- Vérifié au navigateur, à ×4 : aucun panneau n'a bougé d'un pixel en 8 s de jeu, à 1 600 × 900 ;
  captures à 1 366 × 768 et 390 × 844.

Quatrième retour (« pour les bâtiments au survol il faut indiquer ce qu'ils font, pas de limite
dans la liste d'attente ») : au survol d'un chantier dans la fiche, une note à hauteur réservée dit
ce qu'il apporte (et pourquoi il est impossible, s'il l'est) ; la file de chantiers du joueur n'a
plus de limite (elle en avait 6 ; l'IA garde sa limite de 2). En l'écrivant, un défaut est apparu :
**l'infrastructure ne servait qu'en territoire conquis**, où elle allège le transport, mais elle
était proposée sur le sol national, toujours ravitaillé, et l'IA y en bâtissait. Elle ne se bâtit
plus qu'en territoire conquis, comme le dépôt ; l'IA aussi n'en bâtit plus que là. Les niveaux déjà
bâtis sur un sol national restent, sans effet.

Cinquième retour (« les pays qui débarquent peuvent débarquer dans les mers intérieures […] plus
on est éloigné plus il doit y avoir un malus d'attaque ») :

- **Mers.** La carte compte désormais ses mers : chaque étendue d'eau d'un seul tenant (connexité 8,
  un détroit en diagonale suffit) d'au moins 400 cellules ; en dessous, c'est un lac. Sur la vraie
  carte, 12 mers : l'océan mondial (Méditerranée et Baltique comprises), la mer Noire (le Bosphore
  est fermé à cette résolution), la Caspienne, les Grands Lacs, le lac Victoria et des mers
  arctiques du Canada et de la Russie (`node tools/seas.ts` les liste).
- **Débarquements.** Un débarquement embarque sur sa propre côte, sans traverser de pays avant la
  mer, et touche terre depuis cette même mer. Avant, une flèche qui passait par n'importe quelle eau
  débarquait sur la dernière côte rencontrée, Caspienne comprise. L'IA suit la même règle. Le joueur
  reçoit un message qui dit pourquoi.
- **Éloignement.** Le ravitaillement par la mer coûtait le même prix près de chez soi qu'à l'autre
  bout du monde. Il coûte désormais, en plus, 0,04 par cellule entre la côte ravitaillée et le port
  national le plus proche sur la même mer : 90 % de ravitaillement à 300 cellules, 50 % à 1 000, le
  minimum au-delà de 1 600 (l'Australie ou la Chine en Europe). Un camp mal ravitaillé attaque mal
  (rapport de force divisé jusqu'à 3,6) et s'use plus vite. Seuls les ports du sol national
  comptent, et seulement sur leur mer : la mer Noire ne ravitaille que ses riverains.
- Coût : la carte des mers se calcule une fois (0,2 s au lancement) ; les ports, à chaque
  changement de sol national. Partie mondiale de 120 min : tick max 56 ms ; pire cas : 71 ms.
- Vérifié au navigateur : la France en guerre contre le Kazakhstan ne peut pas débarquer sur la
  Caspienne ; elle débarque en Tunisie. Tests : 140 réussis.

Sixième retour (« pour les factions qui se rebellent il faut qu'elles envoient une demande avant
de se rebeller […] que ce soit progressif et pas tout d'un coup ») : les sécessions tirées au sort
deviennent des **mouvements régionaux**.

- **Agitation.** Chaque région annexée (un pays disparu, pesant au moins 1 % de celui qui la
  tient) a une agitation de 0 à 100 %. Elle monte chaque semaine de 0,15 × (45 % − stabilité du
  pays), plus 1 point en guerre, et retombe d'autant quand le pays va bien. À 10 % de stabilité,
  il faut une quinzaine de semaines pour aller au bout ; un pays stable reste calme.
- **Demandes.** À 35 %, la région demande des **investissements** : accepter met en tête de file
  un chantier de 6 semaines de chantiers du pays ; elle se calme aussitôt (−15 points), ne s'agite
  plus pendant le chantier, puis se calme encore à l'achèvement (−30 points), et sa valeur et son
  PIB remontent de 30 % de leur niveau d'origine. À 65 %, elle demande l'**indépendance sans
  combat** : accepter la fait renaître en paix, avec une trêve d'un an. Chaque refus, ou une
  demande laissée 8 semaines sans réponse, ou un chantier abandonné, ajoute 15 points.
- **Soulèvement.** À 100 % seulement, la région se soulève et déclare la guerre, avec les régions
  qui la touchent et dont l'agitation dépasse 50 % (la coalition rebelle). Une région calmée
  (sous 15 %) pourra de nouveau demander.
- **L'IA** investit quand elle n'est pas en guerre, et laisse partir une région qui pèse moins de
  5 % de son pays.
- **Interface :** section « Régions annexées » de l'onglet Diplomatie (une jauge par région, avec
  des repères aux deux seuils, ses demandes et leurs boutons), pastille de l'onglet, message à
  chaque demande, ligne « Agitation » dans la fiche d'une province annexée, chantier
  « Investissements » dans la file.
- Partie mondiale de 120 min : 112 régions annexées, 20 agitées (56 % au plus), 2 indépendances
  accordées par l'IA, aucun soulèvement ; tick max 51 ms. Tests : 144 réussis.

Septième retour : une fois ses trois niveaux d'usine bâtis, une province n'offrait plus rien. Cinq
**bâtiments du sol national** s'ajoutent, chacun branché sur un système existant :

| Bâtiment | Où | Niveaux, coût par niveau | Effet par niveau |
|---|---|---|---|
| Raffinerie | Gisement de pétrole | 2, 160 pts | +50 % du pétrole du gisement |
| Aciérie | Gisement d'acier | 2, 160 pts | +50 % de l'acier du gisement |
| Centre de recrutement | Partout | 3, 100 pts | +20 % d'hommes mobilisables dans la province |
| Services publics | Partout | 3, 120 pts | Par niveau moyen du pays : stabilité 50 % plus rapide à remonter, guerre 10 % moins usante ; dans une région annexée, −1,2 point d'agitation par semaine |
| Chantier naval | Province côtière | 3, 180 pts | +15 % de la marine de départ du pays, à l'achèvement |

Les combats abattent un niveau de chacun, comme pour l'usine. L'IA bâtit ce dont elle manque
(chantier naval sous blocus, raffinerie ou aciérie quand la couverture baisse, services publics
quand la stabilité baisse, recrutement quand le réservoir se vide) : en 120 min, 32 niveaux de
recrutement, 15 de services publics, 5 d'aciérie, 2 de raffinerie. Au navigateur, le premier essai
a montré que le Worker n'envoyait plus le relevé économique (les tableaux des bâtiments, rangés
dans un objet, n'étaient pas dans la liste des transferts) : corrigé. Tests : 150 réussis.

Points à reprendre :

- **Équilibre à éprouver par un joueur :** seuils d'agressivité et de lassitude, fréquence des
  sécessions et des soulèvements.
- **Pas de négociation :** une paix est toujours le statu quo des provinces tenues. Pas de
  restitution, de réparations ni d'échange de provinces.
- **Les IA ne s'allient entre elles que dans un soulèvement**, jamais par traité.
- **Séparatismes limités aux pays disparus.** Découper un grand pays selon ses régions demanderait
  de créer des nations en cours de partie.
- **Pas d'opinion entre pays :** les décisions ne regardent que la force, la lassitude et
  l'agressivité du moment.

## État du jalon 7

Terminé : une défense préparée arrête une attaque qui aurait percé sans elle. Sur une bande de
test, la même percée contre un défenseur deux fois moins riche prend 404 cellules sans
préparation, et 6 seulement contre un front fortifié. **Le test de plaisir reste ouvert** :
personne n'a encore joué à la main.

**Lignes fortifiées.** Un nouveau type de chantier, payé en points de construction (0,6 par
cellule) :

- **Tracer une ligne** (section Défense, puis glisser sur la carte) : une bande de 5 cellules de
  large, 150 cellules de long au plus, sur ton seul territoire. Elle prépare une défense en
  profondeur derrière le front.
- **Fortifier ce front** (dans la carte de chaque front) : la bande de 3 cellules de profondeur
  le long de la frontière avec cet ennemi.
- **Effets :** une cellule fortifiée retire 1 au log du rapport de force de l'assaillant, et tombe
  1,7 fois moins vite. Une cellule prise perd sa fortification. Le quadrillage sombre des
  cellules fortifiées se voit sur toutes les cartes.
- **Limites :** une ligne ne tient que si on y laisse des forces (avec 65 % des forces au front
  au lieu de 100 %, la même percée passe : 580 cellules). Face à un assaillant bien plus fort
  (défenseur cinq fois moins riche), elle ne suffit pas (649 cellules contre 622 sans).

**Réserve de contre-attaque.** Un curseur de 0 à 50 % de l'armée. Quand une offensive ennemie a
pris 25 cellules sur ton sol, la simulation lance d'elle-même une tenaille : une contre-offensive
de chaque flanc vers l'axe de la percée, à 40 % de sa profondeur, pour la couper près de sa base.
Chaque percée n'est contrée qu'une fois. La réserve doit exister : sans forces hors des fronts,
rien ne part. À réserve égale, gardée inactive ou lancée d'elle-même, le gain de l'assaillant
baisse d'un quart (589 cellules contre 438). Un message annonce chaque contre-attaque.

**Secteurs prioritaires.** Trois au plus, placés d'un clic sur ton territoire : des disques de
25 cellules de rayon où le défenseur gagne 60 % de densité. Le reste du front la paie : la part
du front en secteur prioritaire, plafonnée à moitié, s'y retranche d'autant. Sur l'axe d'une
percée, un secteur la divise par deux (187 cellules contre 404).

**IA.** En guerre, elle garde 25 % de son armée en réserve de contre-attaque. Sur un front où
l'ennemi a plus de forces qu'elle, elle met en chantier, en tête de file, la fortification de ce
front (40 cellules au moins). Une première version la mettait en fin de file : sa file, pleine
d'usines bâties en paix, ne laissait passer que 25 cellules fortifiées en une heure de partie
mondiale ; il y en a désormais environ 1 800. Elle ne place pas de secteur prioritaire.

**Sauvegarde.** Version 5 : la grille des fortifications rejoint le fichier, avec les secteurs et
les réserves. Les sauvegardes des versions 1 à 4 sont mises à jour au chargement (testé).

**Mesures.**

| Mesure | Résultat |
|---|---|
| Pire cas, guerre mondiale, 10 semaines de jeu | Médiane 9,2 ms, p99 62 ms, **max 80 ms** (jalon 6 : 75 ms) |
| Monde sans joueur, 60 semaines | 132 nations sur 193 (137 avant les fortifications d'urgence de l'IA) ; tick max 56 ms |
| Navigateur | Front fortifié d'un bouton, ligne tracée à la souris, secteur posé d'un clic, réserve réglée |
| Tests | 125 réussis, dont 8 sur la défense planifiée |

Points à reprendre :

- **Équilibre à éprouver par un joueur.** Une ligne fortifiée tenue à plein arrête presque tout
  assaillant de force voisine. C'est voulu (« la défense préparée arrête l'attaque »), mais peut
  figer les fronts : à surveiller avec les duels, non refaits pour ce jalon.
- **Contre-attaques prudentes :** une seule tenaille par percée, à un seul point. Pas de
  contre-attaque contre une percée sur un territoire déjà occupé, seulement sur le sol national
  ou la cible visée.
- **Pas d'outil pour retirer une ligne fortifiée** une fois bâtie, ni pour la réparer à
  l'identique : il faut la retracer.
- **L'IA ne trace pas de lignes en profondeur** ni de secteurs prioritaires.

## État du jalon 6

Terminé : attaquer en boucle épuise le pays. Dans les duels scriptés, l'Allemagne qui lance
une offensive toutes les 30 s gagne 1 003 et 887 cellules en 20 min, puis s'effondre et finit à
−2 802 et −879 à 30 min. Ses pertes ont vidé son réservoir d'hommes et sa stabilité. La même
Allemagne qui n'attaque qu'une fois par minute garde ses gains. **Le test de plaisir reste
ouvert** : personne n'a encore joué à la main.

**Main-d'œuvre.** Les renforts puisent dans un réservoir d'hommes, tiré de la population des
provinces nationales tenues (10 % pour les provinces occupées). Il vaut 1,2 fois la capacité
militaire de départ, et se reconstitue de 3 % de son maximum par minute. Les pertes ne
reviennent pas, les démobilisés si. Un réservoir vide ne renforce plus l'armée.

**Lassitude de guerre.** Chaque nation a une stabilité, à 80 % au départ :

- **Ce qui la fait baisser :** la guerre (0,5 point par minute, plus avec un effort élevé), les
  pertes (20 points pour des pertes égales à tout le réservoir) et l'occupation du territoire
  national (jusqu'à 4 points par minute).
- **Ce qui la remonte :** la paix, vers 85 % ; une capitulation adverse rapporte 10 points.
- **Ses effets :** sous 80 %, l'effort de guerre possible baisse (jusqu'à 30 % à stabilité nulle),
  et la nation capitule plus tôt (jusqu'à 50 % de son territoire perdu au lieu de 75 %).
- **Résistance :** une province occupée non consolidée coûte une garnison à l'occupant
  (20 % de sa valeur) au lieu de lui rapporter. Conquérir ne paie qu'une fois consolidé.

**Ressources stratégiques.** 39 gisements de pétrole et 40 bassins sidérurgiques, placés à la
main en ordres de grandeur (`data/map-config.json`, `resources`), rattachés à 78 provinces.

- **Besoins :** le monde consomme 80 % de ce qu'il produit, en pétrole selon l'armée, en acier
  selon le PIB.
- **Importations :** 70 % des besoins par la mer, 40 % par la terre seule (pays enclavé ou sous
  blocus). Une marine ennemie au moins deux fois plus forte impose un blocus.
- **Effets :** sans pétrole, l'armée ne garde que 60 % de sa capacité ; sans acier, chantiers et
  croissance ne gardent que 40 % de leur rythme. Un gisement occupé rapporte la moitié de sa
  production à l'occupant.
- **Au départ :** un pays sans gisement couvre 70 % de son pétrole. La France perd ainsi 12 % de
  capacité face à l'Arabie saoudite, et la perte s'aggrave sous blocus.

**Chantiers.** La part civile de l'économie produit des points de construction : 2 × racine du
PIB en milliards × (1 − effort), soit environ 50 par minute pour la France à 50 %. Un seul
chantier avance à la fois, dans une file de 6 au plus.

| Bâtiment | Où | Effet | Coût |
|---|---|---|---|
| Usine, 3 niveaux | Sol national | +15 % de valeur militaire et de PIB de la province par niveau | 200 × niveau |
| Infrastructure, 3 niveaux | Toute province tenue | −20 % de coût de transport par niveau | 120 × niveau |
| Dépôt | Province occupée, consolidée à 50 % | Ravitaille sa province comme le sol national | 150 |

Une province prise au combat perd un niveau d'usine et d'infrastructure, et son dépôt. L'IA
bâtit des usines dans ses provinces les plus riches, de l'infrastructure, et des dépôts derrière
ses conquêtes.

**Correction de la logistique du jalon 5.** Une cellule tout juste conquise gardait jusqu'à 2 s
la valeur « pleinement ravitaillée », en attendant le contrôle de son groupe. La pointe d'une
percée, faite de ces cellules, échappait donc en partie à l'essoufflement. Elle hérite
désormais tout de suite du ravitaillement de sa meilleure voisine.

**Interface.** La section Économie montre la main-d'œuvre, la stabilité, la couverture en
pétrole et en acier (et le blocus), les points de construction et la file de chantiers, que l'on
peut annuler. La fiche d'une province donne ses gisements, ses bâtiments, et des boutons
« Bâtir ici » avec leur coût, ou la raison d'un refus. La carte économique montre les gisements :
goutte noire pour le pétrole, carré d'acier pour l'acier.

**Mesures.**

| Mesure | Résultat |
|---|---|
| Monde sans joueur, 60 min, deux graines | 138 et 140 nations sur 193 |
| Stabilité moyenne des pays en guerre | 0,73 à 10 min, 0,57 à 30 min, 0,32 à 0,36 à 60 min |
| Réservoir moyen des pays en guerre | 73 % à 10 min, 30 % à 60 min |
| Usines bâties par l'IA en 60 min | Environ 380 niveaux |
| Pire cas, guerre mondiale, 10 min | Médiane 7,1 ms, p99 60 ms, **max 75 ms** (inchangé) |
| Sauvegarde, après 60 min | 543 et 621 Ko de JSON avant compression |
| Navigateur | Usine bâtie depuis la fiche, file, carte des gisements ; reprise identique, file comprise |
| Tests | 114 réussis, dont 11 sur l'arrière et 1 sur les dépôts |

**Duels de 30 min sur la vraie carte, le reste du monde jouant aussi** (gain du joueur en
cellules, deux graines ; entre parenthèses, le jalon 5) :

| Stratégie du joueur | France contre IA allemande | Allemagne contre IA française |
|---|---|---|
| Tient à 100 %, sans réserve | −88 et −191 (−397 et −1 111) | −68 et 0 (−57 et 0) |
| Tient à 60 %, sans offensive | −1 336 et −1 326 (−2 420 et −2 673) | −275 et −32 (−378 et −290) |
| Attaque à 100 % | Capitule en 23 et 24 min (−1 491 et −1 674) | −47 et −45 (−7 et −56) |
| Tient à 60 %, une offensive par minute | −2 038, capitule en 28 min (capitule en 26) | +596 et +118 (+97 et +63) |
| Tient à 40 %, offensives toutes les 30 s | Capitule en 10 min (12 et 14) | +1 003 et +887 à 20 min, puis −2 802 et −879 |
| Effort à 100 %, une offensive par minute | Capitule en 20 min, et −2 088 (−1 085 et −127) | +1 107 et +1 281 (+1 468 et +1 150) |

Tenir paie davantage, attaquer sans relâche coûte bien plus cher. La France reste le camp
faible : les scripts n'utilisent ni les chantiers ni les dépôts, et à effort maximal la lassitude
la rattrape vite.

Points à reprendre :

- **Lassitude à éprouver par un joueur.** Une France à effort maximal qui attaque chaque minute
  capitule en 20 min dans une partie. Si c'est trop dur à la main : usure par minute de guerre,
  poids des pertes, plafond d'effort.
- **La richesse des pays épargnés s'emballe :** sur 60 min, le Japon en paix gagne jusqu'à 93 %
  de PIB, l'Allemagne 56 à 69 %. Usines et croissance s'additionnent sans frein en paix.
- **Pas de paix possible :** la lassitude hâte les capitulations, mais une guerre ne finit
  toujours que par l'une d'elles. La diplomatie (jalon 8) devra offrir une sortie.
- **Gisements approximatifs,** placés à la main ; pas de commerce entre pays, les importations
  viennent d'un marché mondial abstrait.
- **Côte connue au départ seulement :** un pays qui perd toutes ses côtes importe encore par la
  mer, et un pays enclavé qui en conquiert une n'y gagne rien.

### Corrections demandées pendant le jalon 6

**L'IA n'attaquait presque jamais les grands pays.** Ce n'était pas propre au joueur : sur deux
parties d'une heure sans joueur, les 10 pays les plus puissants subissaient 0 à 0,1 attaque
chacun, contre 0,5 à 0,6 pour les petits. Une IA n'attaque qu'un voisin au moins 1,2 fois plus
faible, et un grand pays en a peu. Désormais, l'IA compare sa capacité à la force qu'un voisin
peut vraiment lui opposer : sa capacité, moins ce qu'il engage déjà sur d'autres fronts (un
quart au moins reste), réduite jusqu'à moitié s'il est las et de 40 % au plus s'il est à court
d'hommes. Un pays en paix et en forme reste rarement attaqué ; un pays occupé ailleurs ou
épuisé devient une proie, joueur compris. Mesuré sur les mêmes parties : 0,1 à 0,2 attaque pour
les 10 premiers, et la France attaquée deux fois dans l'une d'elles. Une variante qui retenait la
plus belle occasion parmi plusieurs pays doublait le nombre de guerres (157 au lieu de 86) au
profit des gros contre les tout petits : écartée.

**Choisir son pays sur la carte.** Au menu, un clic sur un pays le choisit, et le panneau montre
sa population, son PIB et sa superficie. La fiche de province n'apparaît plus au menu, où elle
cachait ce panneau.

**Sauvegardes d'une version à l'autre.** Une sauvegarde plus ancienne est mise à jour au
chargement au lieu d'être refusée : sa forme est convertie (en-tête du fichier, liste des poches,
champs du ravitaillement), et ce qu'une version ne connaissait pas encore (économie,
ravitaillement, arrière) prend les valeurs d'une partie neuve. Les provinces déjà annexées
gardent seulement leur part annexée de PIB et d'hommes. Seule une sauvegarde d'une version plus
récente, ou jouée sur une autre carte, reste refusée. Testé sur des fichiers des versions 1 à 3
reconstitués.

**Gestion du temps.** L'ancien ×4 devient la vitesse normale : ×1, ×2 et ×4 font désormais 40,
80 et 160 ticks par seconde (mesuré dans le navigateur : 40, 81 et 159). Le temps se compte en
dates, à partir du 1er janvier 2026 : **une minute de simulation vaut une semaine**. Tous les
rythmes « par minute » de ce plan sont donc des rythmes par semaine (croissance, chantiers,
main-d'œuvre, lassitude), et l'interface les affiche ainsi. À vitesse normale, une semaine passe
en 15 s et une heure de jeu couvre un peu plus de quatre ans. Le répit du joueur passe à
12 semaines, soit 3 min à vitesse normale. Le Worker n'envoie plus que 10 états complets par
seconde, quelle que soit la vitesse.

Conséquence à suivre : à vitesse normale, le monde évolue quatre fois plus vite qu'avant en temps
réel. Les mesures « 60 min » des jalons précédents valent donc 60 semaines de jeu, soit environ
15 min de jeu réelles à ×1.

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
- **Pas de commerce ni de ressources :** pétrole, acier et blocus sont venus au jalon 6. Le
  commerce entre pays reste à faire, peut-être avec la diplomatie (jalon 8).
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
