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
- **Prêt, mais pas encore branché** : il manque l'installation du serveur
  sur le VPS pour :
  - le direct à deux (une horloge commune pour les deux téléphones) ;
  - l'historique commun « Avec Max », tout depuis le premier jour ;
  - les copies de sécurité : une chaque nuit (les 30 dernières gardées) et
    la première de chaque mois (gardée pour toujours) ;
  - la vérification automatique du serveur, chaque matin et à chaque push.
- **Derniers commits** :
  - `8587e3e` : direct à deux, charge soulevée, historique des deux ;
  - `a1d077f` : l'installateur se range derrière le Traefik déjà présent sur
    le VPS ;
  - « Copies de sécurité, tout l'historique, vérification du serveur »
    (6 octobre, après la fermeture).

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
   - La fin doit aussi afficher « ✓ Copies de sécurité » : le serveur fait
     sa première copie dès qu'il démarre.
   - Ensuite, côté Claude : mettre `VITE_SERVEUR = "https://srv1302277.hstgr.cloud"`
     dans `[build.environment]` de `netlify.toml`, pousser, puis vérifier que
     le site parle bien au serveur. Ce même push allume la vérification
     automatique du serveur (le job « serveur » du contrôle « Vérifier le
     site ») : elle doit passer au vert.
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

Les copies de sécurité et la vérification automatique du serveur, demandées
le même jour, sont faites (voir « Où on en est »). Reste :

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
2. **Plus tard, si Sébastien le veut** : exporter l'historique dans un
   fichier, pour en garder une copie hors du VPS (sur son PC ou son
   Google Drive). Pas demandé.

### Décisions prises

- **Le serveur est sur le VPS Hostinger de Sébastien**, pas sur Supabase :
  c'est plus durable, ça lui appartient, et ça ne se met pas en pause. Il
  veut d'ailleurs quitter Supabase.
- **À deux, les boutons suivent une règle** : l'horloge commune ne coupe
  jamais la série de quelqu'un, elle ne raccourcit que les attentes. Le
  détail, bouton par bouton, est dans le README.
- **Tout l'historique, depuis le jour 1** : le serveur garde tout, sans
  limite. Le téléphone en garde des années (au plus 1,5 million de
  caractères, plus de 700 séances) ; avant, il n'en gardait que 200.
- **Les copies de sécurité sont faites par le serveur lui-même**, et non par
  une tâche (cron) posée sur le VPS comme prévu d'abord : rien d'autre à
  installer, et une nuit manquée (VPS éteint) se rattrape au démarrage.
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
- **Les copies de sécurité** : `faireLesCopies` dans `serveur.ts`, au
  démarrage puis toutes les heures. `VACUUM INTO` dans un `.tmp`, renommé
  ensuite. Le jour change à minuit, heure de `America/Toronto`. L'instant
  de la dernière copie est dans la réponse de `/api/heure` (champ `copie`).
- **La vérification du matin** (`schedule` du workflow, 11 h 17 UTC) : les
  courriels d'échec vont au compte qui a poussé la ligne `cron`
  (`cbas1974-projet`). GitHub la suspend après 60 jours sans commit sur un
  dépôt public ; on la relance dans l'onglet *Actions*.
- **Vérifications** :
  - `npx vitest run` (487 tests) ;
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
