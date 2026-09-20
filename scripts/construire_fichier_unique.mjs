// Assemble l'application construite (dist/) en UN SEUL fichier HTML autonome :
// styles, script et les 41 images sont intégrés. Le fichier obtenu s'ouvre
// directement dans un navigateur (téléphone compris), sans serveur, et peut
// être déposé tel quel chez n'importe quel hébergeur.
//
// Usage : npm run build:unique   →   dist-unique/SGtraining.html
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = 'dist';
const SORTIE = 'dist-unique';
const NOM = 'SGtraining.html';

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

// 1. Images → data URI, exposées avant le script de l'application.
const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const images = {};
for (const fichier of readdirSync(join(DIST, 'exercices'))) {
  const type = types[extname(fichier).toLowerCase()];
  if (!type) continue;
  const id = fichier.replace(/\.[^.]+$/, '');
  images[id] = `data:${type};base64,${readFileSync(join(DIST, 'exercices', fichier)).toString('base64')}`;
}
const scriptImages = `<script>window.__IMAGES_EXERCICES__=${JSON.stringify(images)}</script>`;

// 2. Feuille de style et script intégrés à la place des liens.
let resultat = html.replace(
  /<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/,
  (_, chemin) => `<style>${readFileSync(join(DIST, chemin), 'utf8')}</style>`,
);
// Le bundle n'utilise ni import/export ni import.meta : on l'exécute comme un
// script classique placé en fin de page (après la div racine), ce qui le rend
// compatible avec les hébergeurs et visionneuses qui ne gèrent pas les
// modules inline.
let scriptApplication = '';
resultat = resultat.replace(
  /<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/,
  (_, chemin) => {
    const js = readFileSync(join(DIST, chemin), 'utf8').replaceAll('</script', '<\\/script');
    scriptApplication = `${scriptImages}\n<script>${js}</script>`;
    return '';
  },
);
if (!scriptApplication) throw new Error('Script de l’application introuvable dans dist/index.html');
resultat = resultat.replace('</body>', `${scriptApplication}\n</body>`);

// 3. Icône d'onglet intégrée elle aussi.
resultat = resultat.replace(/<link rel="icon"[^>]*href="\.?\/?vite\.svg"[^>]*>/, () => {
  const svg = readFileSync(join(DIST, 'vite.svg')).toString('base64');
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${svg}" />`;
});

if (!resultat.includes('<style>') || !resultat.includes('__IMAGES_EXERCICES__')) {
  throw new Error('Assemblage incomplet : structure de dist/index.html inattendue');
}

mkdirSync(SORTIE, { recursive: true });
writeFileSync(join(SORTIE, NOM), resultat);
console.log(`${join(SORTIE, NOM)} : ${(Buffer.byteLength(resultat) / 1024 / 1024).toFixed(2)} Mo, ${Object.keys(images).length} images intégrées`);
