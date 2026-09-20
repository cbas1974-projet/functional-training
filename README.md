# Functional Training

Générateur de séances d'entraînement guidées, pensé pour le téléphone et pour
un pratiquant de jiu-jitsu : **tempo lent, sans rebond**, pour solliciter les
tendons et les ligaments sans charge excessive.

L'application fonctionne entièrement dans le navigateur. Aucun compte, aucun
serveur : les réglages, la séance en cours et l'historique sont enregistrés
sur l'appareil.

## Fonctionnalités

### Nouvelle séance
- **Durée** : 5, 10, 15, 20, 30 ou 45 minutes.
- **Zones travaillées** : tout le corps, ou une combinaison (haut du corps,
  bas du corps, dos, gainage, corps entier). Plusieurs zones alternent.
- **Niveau** : débutant, intermédiaire, avancé.
- **Format** : séries (repos chronométré), **superset** (2 à 4 exercices en
  alternance, le repos de l'un est le travail des autres), circuit (stations
  au temps) ou mixte (séries puis un court circuit).
- **Exercices par enchaînement** au format superset : paires, trios, rotation
  de 4, ou automatique — l'application prend alors la taille qui fait tenir
  le plus d'exercices.
- **Tempo** : 4 s / 4 s recommandé ; 5 s / 5 s, 3 s / 3 s et 2 s / 4 s restent
  disponibles.
- **Séries par exercice** (3 par défaut) et **répétitions par série**
  (6 par défaut). L'application ajuste le nombre d'exercices pour tenir dans
  la durée demandée, et revient au calcul automatique si le réglage ne tient
  pas.
- **Unité des charges** : livres par défaut (le marquage des haltères vendus
  ici), kilogrammes au choix.
- **Options** : banc ou marche solide, mouvements explosifs.

### Combien d'exercices tiennent dans une séance ?

Au tempo lent, l'arithmétique est impitoyable et c'est elle qui décide :

| | calcul | durée |
|---|---|---|
| Une répétition à 4 s / 4 s | montée + descente | **8 s** |
| Une série de 6 | 6 × 8 s | **48 s** |
| La même à 5 s / 5 s en 8 reps | 8 × 10 s | **1 min 20 s** |
| Une série unilatérale | droite puis gauche | **× 2** |

Voilà ce que ça donne sur une séance de 20 minutes, échauffement et
étirements déduits :

| Réglage | Exercices | Repos réel de chaque muscle |
|---|---|---|
| 5 s / 5 s, 8 reps, séries droites | 2 | 1 min 30 |
| 4 s / 4 s, 6 reps, séries droites | 3 | 1 min 30 |
| **4 s / 4 s, 6 reps, superset** | **4** | **3 à 4 min** |

Le superset n'ajoute pas de la fatigue, il enlève du temps mort : pendant que
le biceps se repose, le triceps travaille. Le muscle, lui, récupère plus
longtemps qu'en séries droites.

Les autres leviers : une **durée plus longue** (30 min → 4 à 5 exercices,
45 min → 6 à 7), et **moins de répétitions** — l'application descend d'elle-même
à 6 plutôt que de ne proposer qu'un seul exercice, et le signale.

Le panneau « Pourquoi cette durée ? » sous la séance proposée montre où
passent les minutes : échauffement, mise en place, travail, repos, étirements.
Le temps qui reste une fois les exercices agencés est reversé au retour au
calme plutôt que perdu.

### Comment les enchaînements sont composés

Au format superset, les exercices ne sont pas appariés au hasard. Un
enchaînement réunit des mouvements qui ne se gênent pas :

- **schémas opposés** (poussée ↔ tirage, squat ↔ charnière de hanche) ou
  **muscles antagonistes** (biceps ↔ triceps, pectoraux ↔ dorsaux) ;
- **jamais deux fois le même muscle**, ni deux fois le même schéma ;
- **au plus un mouvement essoufflant** par enchaînement (squat, charnière,
  fente, portage, corps entier) : sinon c'est la cage thoracique qui lâche
  avant le muscle, et la qualité du gros mouvement en pâtit.

Faute de partenaire acceptable, un exercice reste seul et redevient une série
droite plutôt que d'être mal apparié.

### Pourquoi 4 s / 4 s et 6 répétitions par défaut

Ce qui fait progresser un tendon, c'est surtout **l'amplitude de la contrainte**
maintenue quelques secondes — donc la charge — plus que la lenteur en
elle-même. Les protocoles cliniques de référence pour la tendinopathie
travaillent autour de 3 s de montée / 3 s de descente avec une charge lourde.

Un tempo 5 s / 5 s oblige à alléger : le temps sous tension monte, la
contrainte descend. 4 s / 4 s avec 6 répétitions garde la lenteur et le
contrôle tout en permettant une charge sérieuse — et libère 40 % du temps
d'une série, ce qui fait tenir deux fois plus d'exercices. Les autres tempos
et nombres de répétitions restent disponibles.

### Séance proposée
Chaque exercice est présenté avec sa vignette, les séries et répétitions, les
points d'attention et son intérêt pour le jiu-jitsu. Un bouton remplace un
exercice par un autre de la même zone.

### Séance guidée (plein écran)
- Échauffement articulaire puis, pour chaque série, un compte à rebours
  « Préparez-vous ».
- **Métronome de tempo** : affichage MONTE / DESCENDS avec les secondes, et
  comptage automatique des répétitions. Les exercices unilatéraux annoncent le
  côté droit puis le côté gauche.
- Bips de montée et de descente, cloche de fin de série.
- Repos chronométré avec aperçu de l'exercice suivant et bouton « +15 s ».
- Pause, précédent, suivant, « Passer l'exercice ».
- **Poids saisi série par série**, en livres : le champ est pré-rempli avec la
  charge de la série précédente, il n'y a qu'à la corriger quand elle change.
- Retour au calme guidé, puis écran de fin récapitulatif.
- L'écran reste allumé pendant la séance, si le navigateur le permet.
- La séance reprend où elle en était si la page est rechargée.

### Historique et bibliothèque
Chaque séance enregistrée conserve la date, la durée réelle et prévue, et pour
chaque exercice les séries faites, le temps passé et la charge de chaque série
(« 30 · 30 · 35 lb »). Chaque séance garde l'unité dans laquelle elle a été
saisie : changer d'unité ne réécrit pas le passé, et les statistiques
convertissent ce qu'il faut pour rester comparables.

La bibliothèque présente les 40 exercices classés par zone, avec le poster
complet. Chaque fiche indique **combien de fois l'exercice a été fait sur
1 mois, 3 mois, 6 mois et depuis le début**, la date de la dernière fois, la
charge utilisée et le record, ramenés à l'unité courante. Les exercices travaillés dans le mois portent
une pastille sur leur vignette : ce qui n'en a pas est ce qu'on néglige.

## Installation et lancement

Node.js 20 ou plus récent est nécessaire.

```bash
npm install     # une seule fois
npm run dev     # http://localhost:5173
```

Pour tester depuis un téléphone sur le même réseau : `npm run dev -- --host`,
puis ouvrir l'adresse « Network » affichée.

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Version de production dans `dist/` |
| `npm run preview` | Sert la version de production |
| `npm test` | Tests unitaires (Vitest) |
| `npm run lint` | Analyse statique (ESLint) |
| `npm run build:unique` | Fichier HTML autonome dans `dist-unique/` |

`npm run build:unique` produit un unique fichier `SGtraining.html` qui
contient les styles, le script et les 41 images. Il s'ouvre directement depuis
un téléphone, sans serveur ni connexion.

## Mise en ligne (Netlify)

`netlify.toml` contient déjà la commande de build et le dossier publié. Dans
Netlify : « Add new site », « Import an existing project », choisir ce dépôt.
Chaque push redéploie le site.

## Images des exercices

Les vignettes de `public/exercices/` proviennent d'un poster du commerce,
« Dumbbell Workouts », découpé automatiquement. Usage personnel.

```bash
pip install pillow
python3 scripts/decouper_poster.py photo_du_poster.jpg --sortie public/exercices
```

Le script repère les bandes bleues du poster, en déduit la grille de cinq
colonnes, découpe chaque case et retire le libellé anglais. Pour des vignettes
plus nettes, relancez-le avec une photo de meilleure résolution. Vous pouvez
aussi remplacer un fichier PNG par votre propre photo en gardant son nom.

## Structure du projet

```
src/
├── components/
│   ├── Entrainement.tsx          # Écran principal : réglages, plan, historique
│   ├── SeanceGuidee.tsx          # Séance guidée plein écran et métronome
│   ├── FicheExercice.tsx         # Vignette et nom d'un exercice
│   ├── PaceurTempo.tsx           # La bille qui monte et descend au tempo
│   ├── HistoriqueEntrainement.tsx
│   └── BibliothequeExercices.tsx
├── data/
│   ├── exercices.ts              # Les 40 exercices et leurs points d'attention
│   └── parametres.ts             # Durées, tempos, niveaux, formats, zones
├── utils/
│   ├── generateurSeance.ts       # Choix des exercices et calcul des volumes
│   ├── etapesSeance.ts           # Machine à étapes de la séance guidée
│   ├── statistiques.ts           # Fréquence d'un exercice, charges par série
│   ├── formatage.ts              # Dates, durées, libellés
│   ├── sounds.ts                 # Cloche et bips (Web Audio)
│   └── storage.ts                # Sauvegarde locale
├── hooks/
│   ├── useMoteurEtapes.ts        # Moteur de temps (horloge, pause, reprise)
│   └── useVerrouEcran.ts         # Garde l'écran allumé
├── types.ts
└── App.tsx
```

## Comment le temps est calculé

`generateurSeance.ts` et `etapesSeance.ts` partagent un seul modèle de coût :
la durée annoncée sur la séance proposée est **exactement** la somme des
étapes que déroulera la séance guidée, à la seconde près. Un test le vérifie
pour toutes les durées, tous les formats et tous les niveaux.

Le générateur respecte d'abord le nombre de séries demandé, puis les
répétitions demandées. Il ne descend les répétitions que dans un cas : quand
les réglages choisis ne laisseraient qu'un seul exercice dans la séance.

## Évolutions prévues

Le modèle de données est pensé pour accueillir d'autres familles
d'entraînement : bandes élastiques, Swiss ball, poids de corps, yoga et
mobilité. Chaque exercice porte déjà son matériel, sa zone et son **schéma de
mouvement** (squat, charnière, fente, poussée, tirage, rotation, portage…),
ce qui permet de composer des séances équilibrées quel que soit le matériel
et de remplacer un exercice par un équivalent d'une autre famille.

Reste à faire : une routine de mobilité guidée de 10 minutes (maintiens au
temps : 90/90, squat profond, psoas, rotations thoraciques, épaules, nuque),
et l'export de l'historique dans un fichier de sauvegarde.

## Licence

MIT
