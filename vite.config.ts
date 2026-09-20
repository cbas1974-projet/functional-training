import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le build fonctionne à la racine d'un site (Netlify,
  // GitHub Pages) comme dans un sous-dossier ou ouvert depuis un simple dossier.
  base: './',
})
