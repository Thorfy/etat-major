import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le jeu doit marcher depuis n'importe quel sous-dossier d'un hébergeur statique.
  base: './',
  server: { port: 5173, strictPort: true },
});
