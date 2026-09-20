// Ouvre une ou plusieurs adresses de l'application dans un vrai navigateur et
// vérifie que l'onglet Entraînement fonctionne (génération d'une séance,
// images chargées, aucune erreur JavaScript). Rapporte tout ce qui aide à
// diagnostiquer un échec : messages de console, requêtes bloquées, contenu
// de la page et une capture d'écran encodée en base64.
// Usage : node scripts/verifier_lien.mjs <url1> [url2 ...]
import { chromium } from 'playwright-core';

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error('Donnez au moins une adresse à vérifier.');
  process.exit(2);
}

const navigateur = await chromium.launch({ channel: process.env.CANAL_NAVIGATEUR || 'chrome' });
let toutOk = true;

for (const url of urls) {
  const erreurs = [];
  const console_ = [];
  const requetesEchouees = [];
  const page = await navigateur.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => console_.push(`${m.type()}: ${m.text()}`));
  page.on('requestfailed', (r) => requetesEchouees.push(`${r.url()} → ${r.failure()?.errorText}`));
  let ok = false;
  try {
    const reponse = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    const statut = reponse ? reponse.status() : 0;
    const type = reponse ? reponse.headers()['content-type'] : '';
    await page.waitForTimeout(3000);
    const etat = await page.evaluate(() => ({
      titre: document.title,
      racine: document.getElementById('root')?.children.length ?? -1,
      scripts: document.scripts.length,
      modules: [...document.scripts].filter((s) => s.type === 'module').length,
      imagesIntegrees: typeof window.__IMAGES_EXERCICES__ === 'object' ? Object.keys(window.__IMAGES_EXERCICES__).length : 0,
      texte: document.body.innerText.slice(0, 200).replace(/\s+/g, ' '),
      html: document.documentElement.outerHTML.length,
    }));
    console.log(`--- ${url}`);
    console.log(`    statut ${statut}, type ${type}, html ${etat.html} car., titre « ${etat.titre} », root ${etat.racine} enfant(s), scripts ${etat.scripts} (modules ${etat.modules}), images intégrées ${etat.imagesIntegrees}`);
    console.log(`    texte : ${etat.texte}`);
    // githack affiche un avertissement « External Content Notice » avec un
    // bouton « Open the page » au premier passage : on le franchit.
    const ouvrir = page.getByRole('button', { name: /Open the page/i });
    if (await ouvrir.count()) {
      await ouvrir.click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(3000);
      console.log('    avertissement githack franchi, url :', page.url());
    }
    // L'ancienne version vivait dans un onglet ; la version autonome ouvre
    // directement le formulaire.
    const onglet = page.getByRole('button', { name: /^Entraînement$/ });
    if (await onglet.count()) await onglet.click({ timeout: 20000 });
    await page.getByRole('button', { name: /Générer la séance/ }).click({ timeout: 20000 });
    await page.waitForTimeout(800);
    const images = await page.evaluate(() => [...document.images].map((i) => i.complete && i.naturalWidth > 0));
    const seance = await page.getByText('Séance proposée').count();
    ok = statut === 200 && seance > 0 && images.length > 0 && images.every(Boolean) && erreurs.length === 0;
    console.log(`    séance ${seance ? 'affichée' : 'absente'}, images ${images.filter(Boolean).length}/${images.length}, erreurs JS ${erreurs.length}`);
  } catch (e) {
    console.log(`--- ${url}`);
    console.log(`    exception : ${String(e.message).split('\n')[0]}`);
  } finally {
    toutOk &&= ok;
    console.log(`${ok ? 'OK    ' : 'ECHEC '} ${url}`);
    for (const e of erreurs.slice(0, 5)) console.log(`    erreur JS : ${e}`);
    for (const c of console_.slice(0, 10)) console.log(`    console : ${c}`);
    for (const r of requetesEchouees.slice(0, 10)) console.log(`    requête échouée : ${r}`);
    try {
      const capture = await page.screenshot({ type: 'jpeg', quality: 35 });
      console.log(`    CAPTURE_BASE64_DEBUT ${capture.toString('base64')} CAPTURE_BASE64_FIN`);
    } catch {
      // page fermée ou navigateur bloqué : pas de capture
    }
    await page.close();
  }
}

await navigateur.close();
process.exit(toutOk ? 0 : 1);
