# Risk (titre provisoire)

Grande stratégie solo en temps réel sur la Terre moderne, dans un navigateur.
La feuille de route est dans [docs/PLAN.md](docs/PLAN.md).

## Lancer le jeu

```bash
npm install
```

```bash
npm run dev
```

Puis ouvrir http://localhost:5173. La carte générée est versionnée dans `public/map/` : rien d'autre n'est nécessaire.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires |
| `npm run build` | Vérification des types et build de production dans `dist/` |
| `npm run bench` | Joue des parties scriptées et mesure le pire cas de la simulation, sans navigateur |
| `npm run map:fetch` | Télécharge Natural Earth 5.1.2 dans `data/raw/` (environ 60 Mo) |
| `npm run map:build` | Régénère `public/map/` depuis ces données |

Les règles de la carte (rattachement des territoires, frontières contestées, noms, taille des provinces) se règlent dans `data/map-config.json`, puis `npm run map:build`.

## Données

Géographie, terrain, population et PIB : [Natural Earth](https://www.naturalearthdata.com/), domaine public. Quelques massifs absents de ces données sont tracés à la main, en contours approximatifs, dans `data/map-config.json`.
