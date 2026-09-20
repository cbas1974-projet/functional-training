import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Commit à l'origine du build. Netlify fournit COMMIT_REF, GitHub Actions
 *  GITHUB_SHA ; en local, il n'y en a pas. */
const version = process.env.COMMIT_REF || process.env.GITHUB_SHA || 'dev'

/** Inscrit la version dans la page publiée. C'est ce qui permet de vérifier
 *  qu'une adresse en ligne sert bien le commit qu'on vient de pousser, et
 *  pas le build précédent encore en cache. */
function marqueurDeVersion() {
  return {
    name: 'marqueur-de-version',
    transformIndexHtml(html: string) {
      return html.replace(
        '</head>',
        `  <meta name="version" content="${version}" />\n  </head>`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), marqueurDeVersion()],
  // Chemins relatifs : le build fonctionne à la racine d'un site (Netlify,
  // GitHub Pages) comme dans un sous-dossier ou ouvert depuis un simple dossier.
  base: './',
})
