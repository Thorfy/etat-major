import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le jeu doit marcher depuis n'importe quel sous-dossier d'un hébergeur statique.
  base: './',
  // Les modèles 3D des unités (tools/units3d.ts) s'écrivent pendant qu'on joue : pas de rechargement.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/assets3d/**'] } },
});
