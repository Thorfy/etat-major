# État-major

Grande stratégie solo en temps réel sur la Terre moderne, dans un navigateur.

Jouer en ligne : https://thorfy.github.io/etat-major/
La feuille de route est dans [docs/PLAN.md](docs/PLAN.md).

## Lancer le jeu

```bash
npm install
```

```bash
npm run dev
```

Puis ouvrir http://localhost:5173. La carte générée est versionnée dans `public/map/` : rien d'autre n'est nécessaire.

Les parties sont sauvegardées dans le navigateur. Régénérer la carte rend les anciennes sauvegardes illisibles.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires |
| `npm run build` | Vérification des types et build de production dans `dist/` |
| `npm run bench` | Joue une partie mondiale sans navigateur (`-- duels` : stratégies scriptées, `-- stress` : pire cas) |
| `npm run map:fetch` | Télécharge Natural Earth 5.1.2 dans `data/raw/` (environ 65 Mo) |
| `npm run map:build` | Régénère `public/map/` depuis ces données |

Les règles de la carte (rattachement des territoires, frontières contestées, noms, taille des provinces, répartition de la population et du PIB entre provinces) se règlent dans `data/map-config.json`, puis `npm run map:build`. Les réglages du jeu sont dans `src/sim/balance.ts`.

## Données

Géographie, terrain, villes, population et PIB : [Natural Earth](https://www.naturalearthdata.com/), domaine public. Population et PIB n'y existent que par pays : leur répartition entre provinces est une estimation, d'après les villes et la surface habitable. Quelques massifs absents de ces données sont tracés à la main, en contours approximatifs, dans `data/map-config.json`.
