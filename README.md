# Functional Training

Générateur de séances d'entraînement guidées, pensé pour le téléphone et pour
un pratiquant de jiu-jitsu : **tempo lent, sans rebond**, pour solliciter les
tendons et les ligaments sans charge excessive.

L'application fonctionne entièrement dans le navigateur. Aucun compte, aucun
serveur : les réglages, la séance en cours et l'historique sont enregistrés
sur l'appareil.

## Fonctionnalités

L'application s'ouvre sur le **programme du mois** : la séance du jour, prête à
commencer. La séance libre, l'historique et les exercices sont à un bouton.

### Le programme du mois

L'application compose les séances elle-même, avec les exercices des posters, à
partir d'**objectifs musculaires** — par défaut les faiblesses déclarées : bas
du dos, épaules, extérieur et intérieur de cuisse. Rien à taper.

- **Chaque séance** commence par **5 minutes de tapis ou de rameur** et
  quatre mouvements légers choisis pour le jour, et finit par **5 minutes
  d'étirements** du poster, avec leur image — trente secondes de chaque côté
  quand l'étirement se fait d'un côté. Juste avant, **les jambes pour finir** :
  presse à cuisses, hack squat, traîneau ou marche du fermier.
- **Jeudi, la séance de référence**, toujours la même, lourde, en séries
  droites : le **soulevé de terre à la trap bar en premier**, quand le dos est
  frais, un rowing poitrine contre le banc (la trap bar a déjà chargé le bas
  du dos), le bas du dos, les épaules au-dessus de la tête, puis la presse ou
  le hack squat. Le jeudi est le dernier entraînement avant trois jours de
  repos ; les autres séances le préparent et l'entretiennent.
- **Lundi, le bas du corps** (bas du dos, extérieur et intérieur de cuisse),
  et **mardi, le haut** (épaules d'abord), en **enchaîné** : trois exercices à
  la suite, puis 1 min 30 de pause, trois tours. Le mardi, jiu-jitsu des
  adultes le soir : rien qui charge le bas du dos, et la marche du fermier pour
  finir. Les machines restent hors des enchaînements.
- **Semaines A et B** : lundi et mardi alternent d'une semaine à l'autre —
  mêmes muscles, autres exercices. Le programme dure quatre semaines, puis
  l'application propose d'en refaire un. Commencé un vendredi ou un week-end,
  il part du lundi suivant.
- **La semaine dure**, le jeudi une semaine sur deux (semaine B) : **même
  poids, deux répétitions de plus** — Max 12, Sébastien 10. Si le dos
  s'arrondit, on arrête la série. Quand toutes les séries sont faites, le
  jeudi suivant propose **un cran de plus** : 5 lb (2,5 kg).
- **Les pauses** : 2 min à la trap bar, 1 min 30 aux gros exercices, 1 min aux
  petits muscles. Dans un exercice, ou un groupe enchaîné ou lié, le chrono ne
  s'arrête pas. À chaque nouvel exercice, l'écran montre le suivant et **la
  charge à installer**, et la séance repart seulement sur **« Go »**.
- **Lier deux exercices**, le jeudi : « Lier » sur un exercice allume les
  autres en **vert** (bons partenaires : pousser et tirer, le haut et le bas)
  ou en **rouge** (mêmes muscles, ou deux fois le bas du dos). Liés, ils
  s'enchaînent sans pause ; la pause vient après la paire, et l'accueil dit
  le temps gagné.
- **Jamais deux exercices qui chargent le bas du dos dans le même
  enchaînement**, aucun mouvement explosif, rien au-delà du niveau
  intermédiaire, et seulement le matériel de la salle : haltères, kettlebells,
  banc, tapis, et quatre machines — trap bar, presse à cuisses, hack squat,
  traîneau. Elles ne sont sur aucun poster : leur image est un dessin simple,
  à remplacer par une photo du même nom dans `public/exercices/`.
- **En même temps ou chacun son tour** : chaque exercice porte sa façon de se
  faire à deux. Les poids libres, le kettlebell et les étirements se font
  côte à côte ; les machines, une pour deux, chacun son tour — **Max
  commence**, et la série de l'un est le repos de l'autre. Sur un groupe lié
  qui compte une machine, on se croise : Max au premier exercice, Sébastien
  au second, puis on échange. Un toucher change la façon de faire, et la durée
  de la séance suit.
- **Toucher une image** l'ouvre en grand, avec les consignes : pour voir le
  détail du mouvement avant de commencer.
- **Changer** un exercice ouvre la liste des exercices des mêmes muscles, avec
  leur image : le même geste d'abord, et ce que le programme ne fait pas déjà
  avant ce qui revient un autre jour. Le changement vaut pour chaque séance de
  ce nom.
- **Objectifs** et **Refaire**, dans *Réglages* : choisir d'autres muscles,
  ou tirer un autre programme. L'historique et les charges restent.

### Sébastien et Max, chacun sur son téléphone

Au premier lancement, l'application demande qui s'entraîne sur ce téléphone.
Trois séries par exercice ; **Max fait deux répétitions de plus** (10 contre
8, ce qui laisse à Sébastien une quinzaine de secondes de repos en plus) et
**une série de plus aux poussées** — pectoraux, épaules, triceps : le haut du
corps est son point faible. Le mardi, **la dernière série de Sébastien se
fait à la moitié de la charge**, pré-remplie : on garde du jus pour le
jiu-jitsu. Les répétitions de chacun se règlent dans *Réglages*.

En haut de l'accueil, **Seul** ou **Avec Max** :

- **Seul** : ses répétitions, ses pauses, son temps.
- **À deux** : **une horloge commune**. Chaque série commence ensemble ;
  celui qui a fini avant attend l'autre. Pendant la série de plus de Max,
  l'écran de Sébastien annonce « Repos prolongé — Max fait sa série de plus ».
  La durée annoncée est la même sur les deux téléphones, et appuyer sur « Go »
  ensemble à chaque nouvel exercice les remet à la même seconde.
- **Pendant la série de l'autre et les grosses pauses** — les deux minutes de
  la trap bar, et celle qui suit sa dernière série —, l'écran propose un
  étirement, avec son image : le dos pour Sébastien, les cuisses et les
  mollets pour Max, comme le physio le lui a demandé. 20 s de chaque côté, en
  douceur, jamais jusqu'à la douleur.

**En direct, avec le serveur.** Quand le serveur est branché (voir
[Le serveur](#le-serveur-vps)), l'horloge commune passe par lui. Max ouvre
l'application le même jour, sur la même séance, en mode « Avec
Sébastien » : les deux téléphones affichent la même étape à la même seconde.
Les téléphones ne se parlent pas entre eux, chacun parle au serveur. Un
bandeau dit où on en est : « En direct avec Max », « Max n'a pas encore
rejoint » ou « Hors ligne ». Si le réseau coupe, l'application continue
seule ; un appui fait hors ligne part dès que le réseau revient, même si la
page s'est rechargée entre-temps.

La règle des boutons, à deux : **l'horloge commune ne coupe jamais la série
de quelqu'un, elle ne raccourcit que les attentes.**

| Bouton | À deux |
| --- | --- |
| Commencer | Ouvre la séance commune du jour, ou la rejoint là où elle en est |
| Go | Lance le nouvel exercice pour les deux (demande confirmation si l'autre n'a pas fini le précédent) |
| Pause / Reprendre | Arrête et relance le chrono des deux |
| Suivant, pendant une attente | Écourte le repos, l'échauffement ou l'attente pour les deux, au plus jusqu'à la prochaine série de l'un ou de l'autre — refusé pendant la série de l'autre : « Max finit sa série. » Si les deux appuient en même temps, ça ne compte qu'une fois |
| Suivant, pendant sa série | Si l'autre attend, il commence plus tôt ; sinon on finit plus tôt et on l'attend |
| +15 s | Arrête le chrono des deux quinze secondes : le repos s'allonge, rien ne recule. Refusé si l'autre est en pleine série |
| Passer l'exercice | Pour soi seul (un genou qui fait mal) : l'autre continue, on se retrouve au prochain « Go » |
| Précédent | Désactivé : l'horloge est commune |

**Envoyer à Max** (ou à Sébastien) partage un lien qui contient tout le
programme, liens et répétitions de chacun compris : Max l'ouvre et a les
mêmes séances, les mêmes semaines A et B, la même horloge. S'il
avait déjà un programme, l'application lui demande s'il prend celui-ci. Tant
que l'autre téléphone n'a pas le programme — au premier jour, ou après un
changement —, l'accueil le rappelle. Une application installée sur l'écran
d'accueil d'un iPhone ne s'ouvre pas sur les liens des messages : on colle
alors le lien dans *Réglages*.

Chacun note ses charges sur son téléphone. La séance guidée **propose la
charge de la dernière fois**, série par série, et l'affiche sous la saisie
(« Dernière fois : 25 · 30 · 30 »).

### Séance libre
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
- **Tempo** : 3 s / 3 s **+ 2 s en bas** recommandé — la pause se tient en
  position étirée, et l'on repart sans élan. 4 s / 4 s, 4 s / 4 s + 2 s en bas,
  3 s / 3 s, 5 s / 5 s et 2 s / 4 s restent disponibles.
- **Séries par exercice** (3 par défaut) et **répétitions par série**
  (8 par défaut). L'application ajuste le nombre d'exercices pour tenir dans
  la durée demandée, et revient au calcul automatique si le réglage ne tient
  pas.
- **Unité des charges** : livres par défaut (le marquage des haltères vendus
  ici), kilogrammes au choix.
- **Options** : banc ou marche solide, mouvements explosifs.

### Combien d'exercices tiennent dans une séance ?

Au tempo lent, l'arithmétique est impitoyable et c'est elle qui décide :

| | calcul | durée |
|---|---|---|
| Une répétition à 3 s / 3 s + 2 s en bas | montée + descente + pause | **8 s** |
| Une série de 8 | 8 × 8 s | **1 min 4 s** |
| La même à 4 s / 4 s + 2 s en bas | 8 × 10 s | **1 min 20 s** |
| Une série unilatérale | droite puis gauche | **× 2** |

Voilà ce que ça donne sur une séance de 20 minutes, échauffement et
étirements déduits :

| Réglage | Exercices | Repos réel de chaque muscle |
|---|---|---|
| 5 s / 5 s, 8 reps, séries droites | 2 | 1 min 30 |
| 3 s / 3 s + 2 s, 8 reps, séries droites | 2 | 1 min 30 |
| 4 s / 4 s, 6 reps, séries droites | 2 à 3 | 1 min 30 |
| **4 s / 4 s, 6 reps, superset** | **3 à 4** | **3 à 4 min** |
| **3 s / 3 s + 2 s, 8 reps, enchaîné** | **4 à 5** | **4 à 5 min** |

Le superset n'ajoute pas de la fatigue, il enlève du temps mort : pendant que
le biceps se repose, le triceps travaille. Le muscle, lui, récupère plus
longtemps qu'en séries droites.

Les autres leviers : une **durée plus longue** (en enchaîné, 30 min → 7 à 8
exercices, 45 min → 9 à 10), et **moins de répétitions** — l'application descend
d'elle-même à 6 plutôt que de ne proposer qu'un seul exercice, et le signale.

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

Conséquence volontaire : **les exercices y gardent le tempo choisi**. Huit
répétitions à 3 s / 3 s avec 2 s en bas, c'est une minute de travail — la
bonne durée pour une station, sans sacrifier la tension lente qui fait le
tendon.
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

### Pourquoi 8 répétitions à 3 s / 3 s + 2 s en bas par défaut

Ce qui fait progresser un tendon, c'est une **contrainte élevée tenue quelques
secondes** : il faut les deux, la charge et la durée. Une charge trop légère ne
suffit pas, si lente soit-elle. Les protocoles cliniques de référence pour la
tendinopathie (*heavy slow resistance*) travaillent à 3 s de montée / 3 s de
descente, de 15 à 6 répétitions maximales, trois fois par semaine.

**La pause en bas** ajoute deux choses. Elle supprime le rebond : on repart d'un
arrêt complet, la remontée est plus dure, donc la charge un peu plus légère pour
le même effort. Et elle charge la position étirée : la musculation en amplitude
complète améliore l'amplitude autant que les étirements. Elle se tient muscles
engagés ; si le dos s'arrondit en bas (soulevé de terre), on la supprime pour
cet exercice.

**Huit répétitions** tombent dans la fourchette des lignes directrices pour les
adultes vieillissants (8 à 12 répétitions, 60 à 80 % du maximum, vitesse lente à
modérée), et restent assez lourdes pour le tendon. On s'arrête quand il en
resterait deux : aller jusqu'à l'échec n'apporte rien de plus en force, et
coûte en récupération. Les lignes directrices 2026 de l'ACSM le disent
autrement : la régularité compte plus que n'importe quel réglage, et le meilleur
nombre de répétitions est celui qu'on tiendra des années.

Ce que le tempo lent ne travaille pas, c'est la **vitesse**, la qualité qui
décline le plus tôt avec l'âge. Le 2 s / 4 s, avec une montée décidée, et les
mouvements explosifs du kettlebell sont là pour ça. Les autres tempos et
nombres de répétitions restent disponibles.

### Séance proposée
Chaque exercice est présenté avec sa vignette, les séries et répétitions, les
points d'attention et son intérêt pour le jiu-jitsu. Un bouton remplace un
exercice par un autre de la même zone.

### Séance guidée (plein écran)
- Échauffement articulaire puis, pour chaque série, un compte à rebours
  « Préparez-vous ».
- **Métronome de tempo** : affichage MONTE / DESCENDS / TIENS avec les
  secondes, et comptage automatique des répétitions. Pendant la pause en bas,
  la bille s'arrête au pied du rail. Les exercices unilatéraux annoncent le
  côté droit puis le côté gauche.
- Bips de montée, de descente et de pause, cloche de fin de série.
- Repos chronométré avec aperçu de l'exercice suivant et bouton « +15 s ».
- Pause, précédent, suivant, « Passer l'exercice ».
- **Poids saisi série par série**, en livres : le champ est pré-rempli avec la
  charge de la série précédente, sinon celle de la dernière fois ; il n'y a
  qu'à la corriger quand elle change.
- Retour au calme guidé, puis écran de fin récapitulatif, avec la **charge
  totale soulevée** : poids × répétitions de chaque série faite, les deux
  côtés pour un exercice unilatéral. À côté, l'écart avec la dernière fois
  qu'on a fait cette séance (« +600 lb par rapport à la dernière fois
  (+10 %) »).
- L'écran reste allumé pendant la séance, si le navigateur le permet.
- La séance reprend où elle en était si la page est rechargée : l'accueil
  propose de la reprendre.

### Historique et bibliothèque
Chaque séance enregistrée conserve la date, la durée réelle et prévue, et pour
chaque exercice les séries faites, le temps passé et la charge de chaque série
(« 30 · 30 · 35 lb »). Chaque séance garde l'unité dans laquelle elle a été
saisie : changer d'unité ne réécrit pas le passé, et les statistiques
convertissent ce qu'il faut pour rester comparables. Chaque séance affiche
sa charge soulevée.

Avec le serveur, chaque séance enregistrée part aussi dans **l'historique
des deux**, et celles faites avant de brancher le serveur partent une fois.
En haut de l'historique, **Moi** ou **Avec Max** : ses séances seules, ou
celles des deux, chacune avec son nom. Une séance supprimée sur son
téléphone disparaît aussi de l'historique des deux.

La bibliothèque présente les **258 exercices** classés par zone, avec les
six posters d'origine consultables en entier. Un filtre sépare les trois
familles :

| Famille | Nombre | Comment ça se travaille |
| --- | --- | --- |
| Musculation | 149 | Répétitions au tempo, avec une charge — 77 aux haltères, 68 au kettlebell, 4 machines de la salle |
| Yoga | 57 | Postures tenues au temps, sans charge |
| Étirements | 52 | Positions tenues au temps, sans charge |

Le yoga et les étirements n'entrent jamais dans une séance de musculation
générée : on ne veut pas d'un squat enchaîné avec la posture du cadavre. Chaque
fiche indique **combien de fois l'exercice a été fait sur
1 mois, 3 mois, 6 mois et depuis le début**, la date de la dernière fois, la
charge utilisée et le record, ramenés à l'unité courante. Les exercices travaillés dans le mois portent
une pastille sur leur vignette : ce qui n'en a pas est ce qu'on néglige.

## Chercher par muscle

Chaque case des posters porte une **planche anatomique** : une silhouette de
face et de dos, les muscles travaillés en noir, les secondaires en gris. Les
145 planches — 77 aux haltères, 68 au kettlebell — ont été relues une à une, et
leur lecture est inscrite dans chaque fiche (`musclesPrincipaux`,
`musclesSecondaires`).

C'est ce qui permet de répondre à « renforce mon bas du dos ». La zone « dos »
ne le permettait pas : elle mélange le grand dorsal — le muscle des tractions —
et les érecteurs du rachis, qui n'ont rien à voir. Le vocabulaire est maintenant
celui de la planche : nuque, trapèzes, épaules, coiffe des rotateurs, pectoraux,
grand dorsal, bas du dos, biceps, triceps, avant-bras, abdominaux, obliques,
fessiers, **extérieur de cuisse** (moyen fessier, tenseur du fascia lata),
ischio-jambiers, quadriceps, adducteurs, fléchisseurs de hanche, mollets.

Huit objectifs prêts à l'emploi dans la bibliothèque — bas du dos, épaules,
extérieur de cuisse, intérieur de cuisse, bras, tronc, jambes, haut du dos —
classent les exercices **du plus direct au plus accessoire** : un muscle noirci vaut trois fois un muscle grisé, et à note
égale, l'exercice qui vise le moins de muscles à la fois passe devant.

### Là où la planche se trompe

La planche est un indice, pas une vérité. Sur les **145** planches, aucune ne
noircit les érecteurs du rachis — pas même celles de la **Superman** et du
**Good Morning**, deux exercices dont l'extension du dos est précisément le
travail. Lus à pleine résolution, ils montrent les fessiers et les ischios en
noir, le bas du dos en gris clair. C'est une convention de l'illustrateur, pas
de la biomécanique : ces deux fiches sont corrigées, et c'est ce qui les met en
tête de l'objectif « bas du dos ».

Deuxième limite : la planche ne sépare pas le moyen fessier du grand fessier —
la fesse est une seule zone. Or c'est le moyen fessier, avec le tenseur du
fascia lata, qui tient l'**extérieur de la cuisse**. Il est donc déduit du
mouvement : une abduction de hanche (élévation latérale de jambe, bouche
d'incendie), un pas chassé, ou un appui sur une seule jambe qui oblige à tenir
le bassin. Ces déductions sont signalées en commentaire dans les fiches.

Et un mot sur la **bandelette ilio-tibiale** : c'est un tendon plat, pas un
muscle. Elle ne se renforce pas et ne s'étire pratiquement pas. Quand elle
« tire », c'est presque toujours le moyen fessier qui manque, et le tenseur du
fascia lata qui compense. D'où l'objectif « extérieur de cuisse » plutôt que
« bandelette ».

La lecture des planches est volontairement grossière : elle distingue des
régions (haut du dos, bas du dos, grand dorsal, quadriceps, ischios, fessiers,
adducteurs, mollets…), pas des muscles individuels. C'est la précision que
l'image permet, et elle suffit à la question posée.

## Kettlebell

Les deux posters de kettlebell ont été photographiés de biais : la bande du
haut penchait de 144 px quand celle du bas n'en penchait que 13. Ce n'est pas
une rotation mais de la **perspective**, et aucune coupe horizontale ne tombe
juste sur une image pareille. Le script corrige donc d'abord la perspective
(quatre points relevés à la main sur les bandeaux, envoyés sur un rectangle),
avant toute découpe.

Vingt et un exercices existent aux deux matériels — squat gobelet, rowing,
arraché… La séance n'en tire jamais qu'un : le mouvement est reconnu à son nom
anglais, identique d'un poster à l'autre. Les versions au kettlebell portent
« au kettlebell » dans leur nom, pour qu'on ne lise pas deux fois « Fente
latérale » côte à côte.

Les onze mouvements balistiques — swings, arraché, épaulé, balanciers en
rotation, sauts — sont marqués **explosifs** : la séance les écarte tant que
l'option n'est pas cochée.

Pour les voir dans les séances, cocher **Kettlebell** dans *Réglages avancés →
Mon matériel*.

## Yoga et étirements

Le réglage **Discipline** change la nature de la séance : *Musculation* tire
dans les 145 exercices chargés, *Yoga et étirements* dans les 109 positions,
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

Node.js 22 ou plus récent est nécessaire (le serveur et ses tests utilisent
`node:sqlite`).

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

## Le serveur (VPS)

Le site reste sur Netlify. Le serveur, installé sur le VPS, garde deux
choses : **la séance commune du jour** (l'horloge des deux téléphones) et
**l'historique des deux**, avec les charges. Rien de confidentiel : pas de
compte, pas de mot de passe. Un code d'équipe, tiré du programme et
transmis avec le lien « Envoyer à Max », regroupe les deux téléphones. Il
reste le même quand on refait le programme.

Sans serveur, ou sans réseau, l'application fonctionne comme avant : tout
reste sur le téléphone.

**Installer.** Dans le terminal du VPS (chez Hostinger : hPanel → VPS →
Terminal), en root :

```bash
curl -fsSL https://raw.githubusercontent.com/cbas1974-projet/functional-training/main/serveur/installer.sh | sh -s -- srvXXXXXX.hstgr.cloud
```

Remplacer `srvXXXXXX.hstgr.cloud` par le nom du VPS (ou un sous-domaine qui
pointe vers lui). Le script installe Docker s'il manque, télécharge le code
dans `/opt/entrainement`, démarre le serveur et son certificat HTTPS (Caddy),
puis vérifie que `https://srvXXXXXX.hstgr.cloud/api/heure` répond. Les ports
80 et 443 doivent être libres et ouverts dans le pare-feu du VPS. Relancer
la même commande met le serveur à jour.

**Brancher l'application.** Dans *Réglages → Serveur, pour le direct à deux*, coller l'adresse
`https://srvXXXXXX.hstgr.cloud`, puis « Essayer ». L'adresse voyage avec le
lien « Envoyer à Max ». On peut aussi la fixer pour tout le site, au moment
de publier : `VITE_SERVEUR = "https://srvXXXXXX.hstgr.cloud"` dans la
section `[build.environment]` de `netlify.toml`.

**Les données** sont dans `/opt/entrainement/serveur/donnees/` : un seul
fichier SQLite à copier pour une sauvegarde. Les séances communes de plus
d'un mois sont effacées ; l'historique reste.

**Essayer sur son poste** : `node serveur/serveur.ts` (port 8080, données
dans `./donnees`), puis `VITE_SERVEUR=http://127.0.0.1:8080 npm run dev`.

| Route | Rôle |
| --- | --- |
| `GET /api/heure` | L'heure du serveur, pour caler les téléphones |
| `GET`, `POST /api/equipes/:equipe/seances/:jour_seance` | La séance commune ; un appui (Commencer, Go, Pause…) |
| `GET /api/equipes/:equipe/seances/:jour_seance/flux` | La séance commune en direct (Server-Sent Events) |
| `PUT`, `DELETE /api/equipes/:equipe/historique/:id` | Une séance faite ; une séance supprimée |
| `GET /api/equipes/:equipe/historique` | Les séances des deux |

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
│   ├── Accueil.tsx               # Programme du mois : la séance du jour, changer, partager
│   ├── Feuille.tsx               # Feuille de réglages et ses boutons
│   ├── Entrainement.tsx          # Séance libre : réglages, plan, historique
│   ├── SeanceGuidee.tsx          # Séance guidée plein écran et métronome
│   ├── FicheExercice.tsx         # Vignette et nom d'un exercice
│   ├── ImageEnGrand.tsx          # L'image d'un exercice en grand, avec ses consignes
│   ├── PaceurTempo.tsx           # La bille qui monte et descend au tempo
│   ├── HistoriqueEntrainement.tsx
│   └── BibliothequeExercices.tsx
├── data/
│   ├── exercices.ts              # Les 77 exercices et leurs points d'attention
│   ├── salle.ts                  # Trap bar, presse, hack squat, traîneau
│   └── parametres.ts             # Durées, tempos, niveaux, formats, zones
├── utils/
│   ├── generateurSeance.ts       # Choix des exercices et calcul des volumes
│   ├── etapesSeance.ts           # Machine à étapes de la séance guidée
│   ├── programmeMois.ts          # Composition du programme, calendrier A/B, charges, lien
│   ├── statistiques.ts           # Fréquence d'un exercice, charges par série, charge totale
│   ├── etatCommun.ts             # La séance commune : ses appuis, partagés avec le serveur
│   ├── horlogeCommune.ts         # Où en est chacun sur l'horloge commune, et la règle des boutons
│   ├── enLigne.ts                # Le serveur hors séance : envoi des séances, historique des deux
│   ├── formatage.ts              # Dates, durées, libellés
│   ├── sounds.ts                 # Cloche et bips (Web Audio)
│   └── storage.ts                # Sauvegarde locale
├── hooks/
│   ├── useMoteurEtapes.ts        # Moteur de temps (horloge, pause, reprise)
│   ├── useSeanceCommune.ts       # La séance commune en direct, et les appuis à envoyer
│   ├── useMoteurCommun.ts        # Le moteur de temps quand l'horloge est commune
│   └── useVerrouEcran.ts         # Garde l'écran allumé
├── types.ts
└── App.tsx
serveur/
├── serveur.ts                    # Le serveur : séance commune, historique, SQLite
├── installer.sh                  # Installation sur le VPS en une commande
├── Dockerfile, docker-compose.yml
└── Caddyfile                     # HTTPS automatique
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
