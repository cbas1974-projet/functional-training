# Suivi du projet

Le carnet de bord entre deux conversations avec Claude : où on en est, ce
qui attend, ce qui a été décidé. Le fonctionnement de l'application est
décrit dans le [README](README.md).

## Pour reprendre

Sébastien écrit simplement :

> Lis SUIVI.md du projet functional-training et dis-moi par quoi on commence.

Claude, de son côté :
1. Se place dans le dépôt `cbas1974-projet/functional-training` (le cloner
   s'il n'est pas là, puis `npm install`).
2. Lit ce fichier en entier, puis le README.
3. Vérifie que tout passe : `npx vitest run`, `npx tsc -b --noEmit`,
   `npx eslint .`.
4. Résume en quelques lignes simples ce qui attend, propose par quoi
   commencer, et attend le feu vert de Sébastien avant les gros changements.

## Fermeture du 6 octobre 2026

### Où on en est

- **En ligne** : https://sgtraining.netlify.app. Netlify publie chaque push sur
  `main`, puis le contrôle GitHub « Vérifier le site » ouvre le site publié
  dans un navigateur.
- **Ce qui marche déjà** :
  - la charge totale soulevée en fin de séance, avec l'écart par rapport à la
    dernière fois ;
  - les nouvelles images ;
  - l'historique de chacun ;
  - « Refaire le programme » garde les répétitions, le serveur et le code
    d'équipe.
- **Prêt, mais pas encore branché** : le direct à deux (une horloge commune
  pour les deux téléphones) et l'historique commun « Avec Max ». Il manque
  l'installation du serveur sur le VPS.
- **Derniers commits** :
  - `8587e3e` : direct à deux, charge soulevée, historique des deux ;
  - `a1d077f` : l'installateur se range derrière le Traefik déjà présent sur
    le VPS.

### En attente de Sébastien

1. **Installer le serveur sur le VPS.**
   - Dans hPanel : VPS → Manage → Web console. Coller cette ligne, puis
     envoyer une capture de la fin (« ✓ Serveur prêt ») :

     ```
     curl -fsSL https://raw.githubusercontent.com/cbas1974-projet/functional-training/main/serveur/installer.sh | sh -s -- srv1302277.hstgr.cloud
     ```
   - La ligne a été testée sur une copie de la configuration du VPS : Traefik
     y sert déjà d'autres services, et le serveur se range derrière lui sans
     y toucher.
   - Ensuite, côté Claude : mettre `VITE_SERVEUR = "https://srv1302277.hstgr.cloud"`
     dans `[build.environment]` de `netlify.toml`, pousser, puis vérifier que
     le site parle bien au serveur.
2. **Nouvelles photos d'exercices**, que Sébastien va ajouter. À remplacer en
   priorité :
   - les 4 dessins faits par Claude, jugés laids : `trap-bar-deadlift`,
     `leg-press`, `hack-squat` et `traineau` ;
   - les 3 anciennes images gardées du premier poster, parce que la nouvelle
     photo était floue à ces endroits : `romanian-deadlift`, `step-up` et
     `woodchop`.

   Autre piste : des dessins faits avec Gemini, quand son forfait revient.
   Si une nouvelle image semble moins belle que l'ancienne, on remet
   l'ancienne : elles sont toutes dans l'historique git.
3. **La liste des étirements du physio de Max**, pour remplacer les
   étirements génériques.

### Prochains travaux, pas encore commencés

Demandés le 6 octobre. Finalement, rien n'a été fait cette nuit-là : on
s'est arrêté à cette fermeture.

1. **Le tempo à deux, en deux façons à tester.** Un choix dans Réglages,
   « Tempo à deux » :
   - **Chacun le sien** : chacun garde son tempo, et les deux tempos voyagent
     avec le programme. Chaque téléphone peut ainsi calculer la durée des
     séries de l'autre, et l'horloge commune reste juste.
   - **Le même pour les deux** : un seul tempo, dans le programme.

   Sébastien et Max testeront les deux, et on gardera la meilleure.

   Côté code :
   - aujourd'hui, `perspectiveAutre` et `construireEtapesHorloge` supposent
     le même tempo (`seance.parametres`) pour les deux ;
   - il faut donner le tempo du partenaire à la séance (par exemple
     `seance.horloge.tempoPartenaire`) et l'échanger dans `perspectiveAutre` ;
   - il faut le ranger dans `programme.duo`, et le passer à
     `validerProgramme` et au lien de partage ;
   - ajouter des tests.
2. **Les copies de sécurité sur le VPS.**
   - Une copie de `serveur/donnees/entrainement.sqlite` chaque nuit, gardée
     30 jours, et une copie par mois, gardée pour toujours. Chaque copie
     contient tout l'historique depuis le premier jour.
   - Posées par l'installateur (cron) : elles s'activent la prochaine fois
     que la ligne est collée.
   - Lever aussi la limite de 500 séances de la liste « Avec Max »
     (`LIMIT 500` dans `serveur.ts`) : Sébastien veut tout l'historique
     depuis le jour 1.
3. **La vérification automatique du serveur** dans le workflow « Vérifier le
   site » : `https://<serveur>/api/heure` doit répondre. L'adresse se lit dans
   `VITE_SERVEUR` de `netlify.toml` ; sans adresse, l'étape ne fait rien.

### Décisions prises

- **Le serveur est sur le VPS Hostinger de Sébastien**, pas sur Supabase :
  c'est plus durable, ça lui appartient, et ça ne se met pas en pause. Il
  veut d'ailleurs quitter Supabase.
- **À deux, les boutons suivent une règle** : l'horloge commune ne coupe
  jamais la série de quelqu'un, elle ne raccourcit que les attentes. Le
  détail, bouton par bouton, est dans le README.
- **Les repos** : 1 min 30 et 1 min. À la trap bar, 2 minutes de repos, avec
  des étirements. Le physio de Max lui a prescrit des étirements.

### Façon de travailler avec Sébastien

- Discuter avant les gros changements : donner un avis d'expert, c'est lui
  qui décide. « On discute seulement » veut dire : ne rien modifier.
- Écrire en français simple, sans jargon : il n'est pas technicien.
- Le travail se pousse sur `main` du dépôt functional-training. Chaque
  commit se termine par les lignes `Co-Authored-By` et `Claude-Session`.
- Il surveille son forfait (`/usage`). Une conversation trop longue coûte
  cher : on la compacte après une fermeture comme celle-ci.

### Notes techniques pour reprendre

- **Accès réseau** : le bac à sable de Claude ne joint ni le VPS, ni Netlify,
  ni Supabase. Il joint GitHub. Les vérifications en ligne passent donc par
  GitHub Actions.
- **Docker** marche dans le bac à sable : lancer `dockerd` en arrière-plan.
  Un faux VPS (Traefik, plus `traefik/whoami` à la place du service déjà
  en place) a servi à tester l'installateur.
- **Vérifications** :
  - `npx vitest run` (482 tests) ;
  - `npx tsc -b --noEmit` ;
  - `npx eslint .` ;
  - `npm run build`.
- **Tests dans un navigateur** : des scripts Playwright temporaires
  (`*.tmp.mjs` à la racine, à effacer avant le commit), avec `playwright-core`
  et Chromium dans `/opt/pw-browsers/chromium`.
  - Le serveur local tourne avec `PORT=18080 DONNEES=… setsid node serveur/serveur.ts &`.
    `setsid` permet de le figer avec SIGSTOP pour simuler un réseau muet.
  - Construire le site avec `VITE_SERVEUR=http://127.0.0.1:18080 npx vite build`,
    puis le servir avec `npx vite preview --port 4173`.
