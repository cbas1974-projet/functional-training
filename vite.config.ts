import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Commit à l'origine du build. Netlify fournit COMMIT_REF, GitHub Actions
 *  GITHUB_SHA ; en local, il n'y en a pas. */
const version = process.env.COMMIT_REF || process.env.GITHUB_SHA || 'dev'

/** L'heure du build, affichée en bas des Réglages avec le commit : pour savoir
 *  d'un coup d'œil si le téléphone a la dernière version. */
const construitLe = new Date().toISOString()

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
  define: {
    __VERSION__: JSON.stringify(version.slice(0, 7)),
    __CONSTRUIT_LE__: JSON.stringify(construitLe),
  },
  // Chemins relatifs : le build fonctionne à la racine d'un site (Netlify,
  // GitHub Pages) comme dans un sous-dossier ou ouvert depuis un simple dossier.
  base: './',
})
