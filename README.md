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
- **Format** : séries (repos chronométré), **superset** (deux exercices en
  alternance, le repos de l'un est le travail de l'autre), circuit (stations
  au temps) ou mixte (séries puis un court circuit).
- **Tempo** : 5 s / 5 s recommandé, 3 s / 3 s ou 2 s / 4 s.
- **Séries par exercice** (3 par défaut) et **répétitions par série**
  (8 par défaut). L'application ajuste le nombre d'exercices pour tenir dans
  la durée demandée, et revient au calcul automatique si le réglage ne tient
  pas.
- **Options** : banc ou marche solide, mouvements explosifs.

### Combien d'exercices tiennent dans une séance ?

Au tempo lent, l'arithmétique est impitoyable et c'est elle qui décide :

| | calcul | durée |
|---|---|---|
| Une répétition | 5 s de montée + 5 s de descente | **10 s** |
| Une série de 8 | 8 × 10 s | **1 min 20 s** |
| Une série unilatérale | droite puis gauche | **2 min 40 s** |
| Un exercice en 3 séries | 3 × (5 s de mise en place + 1 min 20 s + repos) | **environ 7 min** |

Une séance de 20 minutes garde environ 12 minutes pour les exercices une fois
l'échauffement et le retour au calme déduits : **deux exercices**, ou un seul
si le tirage sort un mouvement unilatéral. Trois leviers existent :

- le **superset**, qui fait tenir un tiers d'exercices en plus à durée égale ;
- une **durée plus longue** (30 min → 3 à 4 exercices, 45 min → 5 à 6) ;
- **moins de répétitions** : l'application descend d'elle-même à 6 plutôt que
  de ne proposer qu'un seul exercice, et le signale.

Le panneau « Pourquoi cette durée ? » sous la séance proposée montre où
passent les minutes : échauffement, mise en place, travail, repos, étirements.
Le temps qui reste une fois les exercices agencés est reversé au retour au
calme plutôt que perdu.

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
- **Poids saisi série par série** : le champ est pré-rempli avec la charge de
  la série précédente, il n'y a qu'à la corriger quand elle change.
- Retour au calme guidé, puis écran de fin récapitulatif.
- L'écran reste allumé pendant la séance, si le navigateur le permet.
- La séance reprend où elle en était si la page est rechargée.

### Historique et bibliothèque
Chaque séance enregistrée conserve la date, la durée réelle et prévue, et pour
chaque exercice les séries faites, le temps passé et la charge de chaque série
(« 16 · 16 · 18 kg »).

La bibliothèque présente les 40 exercices classés par zone, avec le poster
complet. Chaque fiche indique **combien de fois l'exercice a été fait sur
1 mois, 3 mois, 6 mois et depuis le début**, la date de la dernière fois, la
charge utilisée et le record. Les exercices travaillés dans le mois portent
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
