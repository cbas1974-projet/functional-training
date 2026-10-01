# Functional Training

Générateur de séances d'entraînement guidées, pensé pour le téléphone et pour
un pratiquant de jiu-jitsu : **tempo lent, sans rebond**, pour solliciter les
tendons et les ligaments sans charge excessive.

L'application fonctionne entièrement dans le navigateur. Aucun compte, aucun
serveur : les réglages, la séance en cours et l'historique sont enregistrés
sur l'appareil.

## Fonctionnalités

### Nouvelle séance
- **Durée** : 5, 10, 15, 20, 30, 45 ou 60 minutes.
- **Zones travaillées** : tout le corps, ou une combinaison (haut du corps,
  bas du corps, dos, gainage, corps entier). Plusieurs zones alternent.
- **Niveau** : débutant, intermédiaire, avancé.
- **Format** : séries (repos chronométré), **superset** (2 à 4 exercices en
  alternance, le repos de l'un est le travail des autres), circuit (stations
  au temps) ou mixte (séries puis un court circuit).
- **Exercices par enchaînement** au format superset : paires, trios, rotation
  de 4, ou automatique — l'application prend alors la taille qui fait tenir
  le plus d'exercices.
- **Style de circuit** : **enchaîné** par défaut (trois ou quatre exercices
  d'affilée sans aucun repos, puis une vraie pause, et on recommence deux ou
  trois fois — autant de blocs que la durée en accepte), classique (stations au
  temps selon le niveau) ou tabata (20 s de travail, 10 s de repos). Les
  exercices sont appariés par opposition : c'est ce qui rend un bloc sans repos
  tenable.
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

### L'enchaîné n'est pas un circuit

Un circuit à trois tours ne remplira jamais une heure : quatre stations de 40 s
répétées trois fois, c'est douze minutes. L'enchaîné est donc construit comme un
**superset sans repos** plutôt que comme un circuit — trois ou quatre exercices
d'affilée, une vraie pause de 90 à 120 s, deux ou trois tours, puis un bloc
suivant avec d'autres exercices. Le modèle du superset sait aligner plusieurs
blocs ; celui du circuit n'en connaît qu'un.

Conséquence volontaire : **les exercices y gardent le tempo choisi**. Six
répétitions à 4 s / 4 s, c'est quarante-huit secondes de travail — la bonne
durée pour une station, sans sacrifier la tension lente qui fait le tendon.
L'effet cardio vient de l'absence de repos entre les trois exercices, pas de la
vitesse d'exécution.

En dessous d'un quart d'heure, le bloc se réduit : au tempo lent, trois
exercices dont un unilatéral coûtent déjà huit minutes pour deux tours.

### Circuit à rythme libre

En tabata, le travail est trop court pour un tempo lent — vingt secondes à
4 s / 4 s ne feraient que deux répétitions et demie. Ce style passe donc en
**rythme libre** : la bille disparaît, l'écran affiche le décompte des secondes,
et c'est le souffle qui mène. C'est l'opposé exact du tempo lent, à réserver aux
jours où c'est le cardio que tu travailles — et pas le tendon.

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

La bibliothèque présente les **186 exercices** classés par zone, avec les
quatre posters d'origine consultables en entier. Un filtre sépare les trois
familles :

| Famille | Nombre | Comment ça se travaille |
| --- | --- | --- |
| Musculation | 77 | Répétitions au tempo, avec une charge |
| Yoga | 57 | Postures tenues au temps, sans charge |
| Étirements | 52 | Positions tenues au temps, sans charge |

Le yoga et les étirements n'entrent jamais dans une séance de musculation
générée : on ne veut pas d'un squat enchaîné avec la posture du cadavre. Chaque
fiche indique **combien de fois l'exercice a été fait sur
1 mois, 3 mois, 6 mois et depuis le début**, la date de la dernière fois, la
charge utilisée et le record, ramenés à l'unité courante. Les exercices travaillés dans le mois portent
une pastille sur leur vignette : ce qui n'en a pas est ce qu'on néglige.

## Yoga et étirements

Le réglage **Discipline** change la nature de la séance : *Musculation* tire
dans les 77 exercices chargés, *Yoga et étirements* dans les 109 positions,
*Yoga seul* et *Étirements seuls* dans un seul poster.

En mobilité, l'application ne propose plus ni tempo, ni séries, ni format, ni
unité de charge — rien de tout cela ne s'applique. À la place, une **durée de
maintien** (20, 30, 45 ou 60 s). Le tapis est implicite : c'est le sol du dojo
ou une serviette, pas du matériel à déclarer.

Deux choses méritent d'être connues :

- **Une position unilatérale se tient des deux côtés.** Une posture annoncée à
  30 s en prend soixante, et l'écran de séance affiche « Côté droit », puis
  « Côté gauche » à la moitié. Le décompte du temps de la séance en tient
  compte : c'est pour ça qu'une séance de 20 minutes propose seize positions et
  pas vingt-cinq.
- **L'ordre suit celui des posters.** Les positions sont choisies en alternant
  les zones du corps, puis remises dans l'ordre d'impression : les posters vont
  de l'échauffement à la récupération, du debout au sol. Une séance commence
  donc par le chat et finit par la posture du cadavre, même quand elle pioche
  dans les deux posters à la fois — le rang est ramené à une fraction, ce qui
  rend les deux comparables.

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
│   ├── exercices.ts              # Les 77 exercices et leurs points d'attention
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

## La bibliothèque d'exercices

77 mouvements, tirés de deux posters QuickFit « Dumbbell Workouts » (volumes 1
et 2). Chacun porte son nom français, sa zone, son muscle, son **schéma de
mouvement**, son matériel, son niveau, ses côtés, ses points d'attention et,
quand il y a lieu, son intérêt pour le jiu-jitsu.

Les vignettes sont découpées automatiquement depuis une photo du poster :

```bash
python3 scripts/decouper_poster_photo.py photo.jpg dumbbell-v2 \
    --sortie public/exercices --planche controle.png
```

`decouper_poster_photo.py` part d'une photo de téléphone d'un poster plastifié :
il corrige l'éclairage par division par un flou large — ce qui efface la
dominante chaude et rend le fond blanc —, repère les bandeaux de section par
leur couleur, absorbe la perspective résiduelle en interpolant les bords, puis
détecte les traits de grille. Un trait est gris sur toute sa traversée, là où un
dessin est noir par endroits et le fond blanc partout : c'est ce qui les
distingue. Les rangées dont les traits ne survivent pas à la photo portent leurs
coupes en dur dans la disposition.

`decouper_poster.py`, plus ancien, reste pour un scan à plat à grille régulière.

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
