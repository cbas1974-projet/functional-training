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
- **Format** : séries (repos chronométré), circuit (stations au temps) ou
  mixte (séries puis un court circuit).
- **Tempo** : 5 s / 5 s recommandé, 3 s / 3 s ou 2 s / 4 s.
- **Séries par exercice** (3 par défaut) et **répétitions par série**
  (8 par défaut). L'application ajuste le nombre d'exercices pour tenir dans
  la durée demandée, et revient au calcul automatique si le réglage ne tient
  pas.
- **Options** : banc ou marche solide, mouvements explosifs.

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
- Pause, précédent, suivant, « Passer l'exercice », saisie du poids utilisé.
- Retour au calme guidé, puis écran de fin récapitulatif.
- L'écran reste allumé pendant la séance, si le navigateur le permet.
- La séance reprend où elle en était si la page est rechargée.

### Historique et bibliothèque
Chaque séance enregistrée conserve la date, la durée réelle et prévue, et pour
chaque exercice les séries faites, le temps passé et le poids. La bibliothèque
présente les 40 exercices classés par zone, avec le poster complet.

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
│   ├── HistoriqueEntrainement.tsx
│   └── BibliothequeExercices.tsx
├── data/
│   ├── exercices.ts              # Les 40 exercices et leurs points d'attention
│   └── parametres.ts             # Durées, tempos, niveaux, formats, zones
├── utils/
│   ├── generateurSeance.ts       # Choix des exercices et calcul des volumes
│   ├── etapesSeance.ts           # Machine à étapes de la séance guidée
│   ├── formatage.ts              # Dates, durées, libellés
│   ├── sounds.ts                 # Cloche et bips (Web Audio)
│   └── storage.ts                # Sauvegarde locale
├── hooks/
│   ├── useMoteurEtapes.ts        # Moteur de temps (horloge, pause, reprise)
│   └── useVerrouEcran.ts         # Garde l'écran allumé
├── types.ts
└── App.tsx
```

## Évolutions prévues

Le modèle de données est pensé pour accueillir d'autres familles
d'entraînement : bandes élastiques, Swiss ball, poids de corps, yoga et
mobilité. Un exercice porte son matériel et sa zone ; l'ajout d'un schéma de
mouvement (pousser, tirer, charnière de hanche, squat, fente, rotation,
gainage) permettra de composer des séances équilibrées quel que soit le
matériel, et de remplacer un exercice par un équivalent avec un autre
matériel.

## Licence

MIT
