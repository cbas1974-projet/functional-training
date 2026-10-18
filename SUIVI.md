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

## Backlog (sorti du registre le 2026-10-16, décision Seb)

- **Ex-CH-0122** : routine du soir plus courte (viser 5-6 min, au lieu de 10) et des listes qui tournent, pour qu'elle ne soit plus toujours pareille. Noté en piste le 14-15 octobre 2026, pas fait. Source : la section « Pistes » ci-dessous.

## 18 octobre 2026 : rattraper un soir d'étirements, puis semaine d'utilisation

- **Décision de Seb** : toutes les lignes du registre sur Functional Training sont fermées (CH-0104, CH-0179). Cette semaine il utilise l'app et **prend des notes** ; les corrections se feront **en fin de semaine prochaine ou après un entraînement**.
- **Routine du soir** : les sept points des derniers soirs sont maintenant des boutons (écran « Routine du soir » seulement, pas la carte de l'accueil) : un appui marque ou démarque ce soir-là. Raison : Seb s'étire tous les soirs, a fait celui du vendredi 16 octobre de mémoire sans le cocher, et la série paraissait cassée. Les données restent sur le téléphone, donc la correction se fait **dans l'app** (appui sur le point V du 16).
- Preuves : vitest 1077/1077 (3 tests ajoutés dans `CarteRoutineSoir.test.tsx`), tsc et eslint verts ; vu à l'écran en 375 px (15 et 17 marqués = « 2 soirs sur 7 », puis le 16 = « 3 soirs sur 7 · 3 d'affilée »).
- **Pas publié** : en attente du go de Seb (poussée sur main + vérification en ligne). Fichiers : `src/components/CarteRoutineSoir.tsx`, `src/components/RoutineSoir.tsx`.

## 17 octobre 2026 : une image à chaque mouvement

- Inventaire : les 275 exercices de la bibliothèque avaient déjà leur image ; les trous étaient dans les listes de mouvements (cardio « Tapis ou rameur », balancements de jambe du jeudi, `ECHAUFFEMENT` et `RETOUR_CALME` d'usage de la séance libre).
- 10 images créées (OpenAI, voir `IMAGES.md`) et branchées par `exerciceId` ; `VERSION_IMAGES` monté à 6 ; 2 tests ajoutés (chaque mouvement a une image qui existe). Vérifié à l'écran en 375 px : le rameur à l'échauffement et le balancement du jeudi. Publication : en attente du go de Seb.

## 14 et 15 octobre 2026

- **Le jeudi** (programme version 11) : la planche de Copenhague sort du
  programme (Big Max a du mal avec elle), le **squat cosaque** la remplace ;
  la **montée sur marche** finit le jeudi à la place des mollets (déjà au
  mardi). Ajoutés aux classiques (`ADMIS_A_PART`). Les **11 tests
  de `programmeMois.test.ts`** sont remis à jour le 15 octobre (vitest, tsc,
  eslint verts). Effet à noter : sans la Copenhague, **chaque mardi prend la
  planche latérale** comme 3e « jambe légère » (donc 2 vraies jambes + elle) ;
  à six exercices avec les huit objectifs, la machine à mollets n'est plus
  garantie (les mollets ne finissent plus le jeudi).
- **Minuteur** : sur un exercice au temps (planche, swing), le bouton
  « ▶ 30 s » lance le décompte, sonne et vibre à zéro, puis se relance.
  Vérifié dans le navigateur ; **son et vibration non vérifiés sur un vrai
  téléphone**.
- **Échauffement à la grande boucle élastique**, adapté au jour, une image
  par mouvement (lundi : passage d'épaules, marche latérale, good morning,
  squat ; mardi : écartés, passage d'épaules, rotation externe, tirage au
  visage ; jeudi : balancements, marche latérale, squat, pont fessier).
  Mêmes durées. **L'image à l'écran pendant l'échauffement n'est pas vue**
  (données vérifiées seulement).
- **Images refaites avec OpenAI** (skill /gen-image, gpt-image-2) : 79, dont
  tout le programme du mois. Registre : [IMAGES.md](IMAGES.md).
  `IMAGES_A_FAIRE.md` (Gemini) est dépassé. Les planches gardent les images
  du poster de yoga. **Règle** : les images de Sébastien d'abord.
- **La finale en allers-retours** (plus au chrono) : traîneau, marche du
  fermier, sac de sable (les marches à monter en font partie) ; objectif
  **10** (`OBJECTIF_ALLERS_RETOURS`). Un compteur « +1 / − » chacun, le visage
  😊 😐 ☹️, et « la dernière fois : 12 😊 → on monte le poids »
  (`allersPasses`). Enregistré dans `allersRetours` de l'exercice. Le 15
  octobre, Speedy et Big Max ont fait 12 allers-retours de traîneau sur
  30 pieds (pas dans l'historique : la finale se comptait encore au temps).
  Vérifié par un test qui joue la finale et à l'écran à 375 px (seul).
- **En alternant = 8 de chaque côté** (décision de Sébastien : « 3 × 8 en
  alternant », c'est 8 à droite et 8 à gauche). Le temps d'une série double
  et la charge soulevée compte les deux côtés (`deChaqueCote`,
  `generateurSeance.ts`) ; pas pour un cercle ou une rotation. L'écran dit
  « 3 × 8 de chaque côté, en alternant ». Durées, graine 1, à deux : lundi
  1 h 14, mardi 1 h 18 / 1 h 11, jeudi 1 h 21 / 1 h 25 (accepté). La charge
  soulevée du 15 octobre (Speedy 4 476 lb) a été recalculée à la main : juste
  avec l'ancienne règle ; Big Max à 8 205, cohérent avec ses 10 à 30 lb de plus.
- **Pistes** : l'oiseau revient le mardi et le jeudi (« Changer » en
  attendant) ; la routine du soir trop longue et toujours pareille (viser
  5-6 min, des listes qui tournent) ; des GIF à deux temps à partir des
  positions 1 et 2.

## 13 octobre 2026 (après la séance)

**Rodage cette semaine ; programme figé un mois à partir du lundi 19
octobre.** Version **1.4.0**, programme **version 10** (même graine : les
anciens liens s'ouvrent, recomposés ; les charges notées restent).

- **La composition retenue** (8 exercices : le premier et le dernier seuls,
  3 paires de deux zones — qui va avec qui dépend du tirage —, un tirage du
  dos chaque jour ; puis la finale de 10 min et les étirements) :
  - **Lundi** (chaque semaine) : trap bar seule · Superman, rowing,
    développé épaules, fente latérale (intérieur de cuisse), planche
    latérale (extérieur), développé incliné · presse ou hack squat seule ·
    finale marche du fermier. ≈ 1 h 11.
  - **Mardi A** : développé couché seul · développé épaules et rowing (du
    lundi), un curl, chacun avec une jambe légère : mollets, pont fessier,
    Copenhague · pompes seules · finale sac de sable. ≈ 1 h 10 à 1 h 13.
  - **Mardi B** : pareil, un autre curl ; les mollets à la machine une
    semaine, aux haltères l'autre.
  - **Jeudi A** : swing seul · Copenhague, extension et flexion à la
    machine, chacune avec le rowing (du lundi), une élévation, l'oiseau ou
    la rotation externe · mollets seuls · finale traîneau. ≈ 1 h 12.
  - **Jeudi B** : pareil, d'autres élévations, les autres mollets.
- **3 séries pour les deux** : points faibles vides par défaut ; un programme
  qui portait l'ancien défaut de Big Max tel quel repart à vide, une liste
  changée reste. **Big Max** : jamais d'appui sur les mains ou les coudes
  derrière soi (planche inversée, dips au sol, chameau, roue, héros couché) —
  programme, « Changer », routine du soir, sa séance libre. **👎 « Pas
  aimé »** à côté de « J'ai mal » ; l'accueil le dit la fois suivante,
  « Changer ? » ou « Garder ». **L'image d'un exercice s'agrandit** en séance.
- **Tranché par Claude** : la fente latérale le lundi (plus de vraies
  jambes), la Copenhague le jeudi et en jambe légère le mardi ; la planche
  latérale reste l'extérieur de cuisse ; le pont fessier, allongé, ne compte
  plus comme chargeant le bas du dos ; les mollets finissent le jeudi ; le
  sac de sable, nouvel exercice classique (un dessin simple, ajouté à
  IMAGES_A_FAIRE) ; la finale : 1 min d'installation comptée, un poids
  facultatif (la dernière fois en gris), faite à la moitié du temps, 30 s
  dans l'essai, absente sur deux téléphones ; jamais de machine lourde dans
  « Changer » le mardi et le jeudi. **À savoir** : le lundi n'est pas le
  plus long à l'horloge (le jeudi, ses machines chacun son tour).
- **Vérifié à 375 px** (Playwright) : un mardi à deux jusqu'à la finale
  (10:00, Démarrer, Pause, Terminer) et aux étirements, un 👎 et son bandeau
  au jeudi, l'image en grand, l'essai jusqu'à la fin de sa finale.
  **Non vérifié** : le son et la vibration sur un vrai téléphone, une vraie
  séance à la salle.

## Séance du 13 octobre 2026

- **Version 1.3.0, exercice par exercice** (retour de Sébastien en pleine
  séance : toucher « Série terminée » à chaque série, c'était de trop). Tout
  l'exercice — ou toute la paire — d'un coup : les séries des deux,
  pré-remplies, modifiables ; « J'ai mal » pour chacun ; 70 % / 100 % sous la
  case touchée. Les visages de la dernière série sont **obligatoires** : le
  gros bouton reste grisé et dit lequel manque (« Choisis un visage : Big Max,
  Curl alterné »), le toucher y ramène. **Un seul « Exercice terminé »**
  (« Paire terminée ») note les charges affichées et lance la pause de fin
  (1 min, 1 min 30 trap bar, « +15 s », « Passer » ; rien avant les
  étirements), puis l'exercice suivant s'ouvre. **« Pause · 1 min »**, petit,
  toujours là, pour souffler entre les tours sans changer d'exercice ;
  « Tempo » en petit sur chaque exercice. Mêmes durées (l'accueil dit
  toujours ≈ 1 h). Une séance commencée en 1.2.0 reprend exercice par
  exercice, avec ses charges (`versLeDerouleParExercice`).
- **Le bug des 70 %** (capture de ce matin : Big Max, développé couché, S1 =
  23, S2 à S4 à 15). Cause : une série pré-remplie copie la série d'avant, et
  le 100 % sans dernière fois est la dernière série notée. « J'ai mal »
  réécrivait la série en cours à 70 % (et « Série terminée » notait ces 70 %) ;
  douleur éteinte, les séries suivantes recopiaient ces 70 % — l'éteindre
  réécrivait même la série en cours d'après eux. Pareil après un toucher sur
  « 70 % ». Corrigé : une série notée à 70 % (d'un toucher, ou aux 70 % d'une
  douleur éteinte) ne fait plus ni la suite ni le 100 % (`allegees`,
  `src/utils/charges.ts`) ; « J'ai mal » ne réécrit plus aucune case sur un
  seul téléphone, et sa charge part de ce qui est noté aujourd'hui (sans
  dernière fois, elle valait 0 : pas de 70 % du tout).
- **Tranché par Claude** : la séance libre garde son déroulé série par série
  (seule, minutée) et profite de la correction des 70 % ; « Passer cet
  exercice » le saute en entier, ses séries ne comptent pas ; quitter au
  milieu d'un exercice n'en compte aucune série ; pas de visage demandé sur
  un exercice sans charge (Superman, planches, pompes) ; le nom de
  l'exercice dans le bouton seulement pour une paire. Les tests jouent la
  séance dans un navigateur simulé (jsdom, ajouté aux outils de test).
- **À savoir** : une séance faite toute à 70 % (douleur) devient « la
  dernière fois » ; la douleur éteinte la fois d'après, on repart de ces 70 %
  (à corriger à la main) — c'était déjà le cas.
- **Vérifié à 375 px** (Playwright) : le développé seul (Big Max 23 partout,
  15 avec « J'ai mal », 23 de nouveau), le bouton grisé et l'entourage,
  « Pause · 1 min » sans changer d'exercice, la pause de fin puis la paire,
  une séance entière jusqu'à l'enregistrement (24 / 24 séries, Big Max à
  part), la reprise après rechargement et celle d'une séance 1.2.0, l'essai,
  la séance libre. **Non vérifié** : un vrai téléphone (son, vibration,
  clavier qui se range sous les raccourcis), une vraie séance à la salle.
- **À tester à la salle** : un seul « Exercice terminé » par exercice ;
  « Pause · 1 min » entre les tours ; les visages obligatoires ; « J'ai mal »
  allumé puis éteint ; une séance 1.2.0 en cours qui reprend.
- **Version 1.2.0, programme version 9** (même graine : les anciens liens
  s'ouvrent, recomposés). L'accueil prévient une fois, avec « Compris » : un
  exercice changé ou une paire refaite à la main est à refaire, les charges
  restent (il ne sait pas s'il y avait des retouches : il prévient toujours).
- **Le ressenti** : 😊 facile, 😐 correct, ☹️ difficile, sur la **dernière
  série de chacun** (Speedy la 3e, Big Max la 4e), facultatif, la même donnée
  qu'avant (`ressenti`). **On monte plus vite** : Speedy après deux 😊, Big Max
  après un ; ☹️ deux fois pour redescendre ; compté par exercice, quel que soit
  le jour.
- **« J'ai mal » pour chacun** (`douleursAutre`) : un petit bouton par
  colonne ; 70 % et pas de montée pour celui qui a mal seulement, jusqu'à ce
  qu'on l'éteigne. Les douleurs d'avant sont à la personne du téléphone.
- **Points faibles** (Réglages, 13 cases) : une série de plus aux exercices
  dont c'est le groupe principal, une au plus par exercice. Par défaut, Big
  Max : pecs, épaules, biceps, triceps ; Speedy : aucun. Les groupes de la
  bibliothèque, regroupés : quadriceps → avant de cuisse ; ischios-fessiers →
  arrière de cuisse ou fessiers (selon le premier muscle principal) ;
  adducteurs → intérieur ; abducteurs → extérieur (la planche latérale) ;
  abdominaux et obliques → abdos ; lombaires → bas du dos (le Superman) ;
  dorsaux et trapèzes → haut du dos ; avant-bras → biceps ; l'oiseau →
  épaules ; tout le corps (la marche du fermier) → rien.
- **Des classiques seulement, le premier mois** (`EXERCICES_CLASSIQUES`,
  `src/utils/programmeMois.ts`, programme et « Changer ») : développés,
  rowings, curls, extensions, élévations, squats, soulevé roumain, pont,
  fentes, mollets, marche du fermier, le kettlebell de base, la planche et la
  planche latérale (ajoutées), le Superman sans poids, la Copenhague, les sept
  machines. Dehors : bouche d'incendie, moulin à vent, bûcherons, mollet sur
  une jambe lesté, tour de taille, relevé turc, halo…
- **Le programme** : le lundi pareil chaque semaine (la presse ou le hack
  squat en paire, la marche du fermier pour finir) ; le mardi A et B reprend
  deux exercices du haut du lundi et finit sur des pompes ; le jeudi A et B
  en reprend au moins un. **Mollets assis** (nouvelle machine, `salle.ts`) un
  mardi sur deux, à la place du mollet sur une jambe. Une pause d'un toucher
  entre les tours d'un exercice seul à deux, sauf la marche du fermier.
  Durées (graine 1, à deux) : lundi 1 h 03, mardi 1 h 05 / 1 h 09, jeudi
  59 min / 1 h 02.
- **Tranché par Claude** : aux mollets assis, la seconde tenue est en bas,
  talons sous la marche, là où le métronome s'arrête ; la séance libre a aussi
  les visages. **À savoir** : peu de classiques et les reprises du lundi, donc
  le mardi B ne change souvent que deux exercices du mardi A, et le rowing
  incliné revient les trois jours.
- **Vérifié à 375 px** (Playwright) : une séance à deux, les visages des deux,
  la douleur de Big Max seul, la séance suivante (charges et douleur gardées),
  « Séance d'essai » sous la carte du jour, le bandeau de recomposition.
  **Non vérifié** : le son et la vibration sur un vrai téléphone, une vraie
  séance à la salle.
- **À tester à la salle** :
  1. Les visages sous la dernière série de chacun : assez gros, rien avant.
  2. « J'ai mal » de Big Max : 70 % pour lui seul, encore là la fois d'après.
  3. La pause d'un toucher entre les tours du développé couché (1 min 30 à la
     trap bar) ; la marche du fermier du lundi, elle, enchaîne.

## Séance du 12 octobre 2026

- **Audit du 13 octobre** ([docs/audit-2026-10-13.md](docs/audit-2026-10-13.md)) : les 5 points importants et les mineurs 7, 8, 10 corrigés ; 6 et 9 laissés.
- **Le jeudi, la machine d'une paire se fait chacun son tour** (Big Max, puis Speedy, puis l'autre exercice ensemble) : le jeudi dure ≈ 1 h (de 56 min à 1 h 08 ; graine 1 : 1 h 05 / 59 min). « Changer » ne casse plus la règle des zones ; « Les deux » montre Big Max ; la séance libre retrouve ses enchaînements ; un double toucher ne compte qu'une fois.
- **À tester à la salle** : le jeudi, l'ordre de la machine et la durée ; un double toucher sur « Série terminée ».
- **À tester demain matin, à la salle** (sur le téléphone de Speedy, « Avec
  Big Max ») :
  1. L'accueil annonce **8 exercices** : le premier et le dernier « Seul,
     chacun son tour », trois paires entre les deux, **jamais deux exercices
     de la même zone** (« Haut ↔ tronc », « Haut ↔ bas », « Bas ↔ tronc »).
  2. L'écran de séance montre **tout le programme du jour** : l'exercice en
     cours ouvert, le suivant marqué « Ensuite », rappelé au-dessus des
     boutons.
  3. **Pas de décompte pendant une série** : seulement « Série terminée ·
     série ≈ 1 min » (le métronome vient si on touche « Tempo »).
  4. Une paire : **A, B, A, B sans pause entre les tours** ; un exercice
     seul : Big Max, puis Speedy, en alternance, sans pause.
  5. À la fin d'une paire ou d'un exercice seul, **la pause part seulement
     au toucher** : « Pause · 1 min », **1 min 30 après la trap bar** (ou
     « Sans pause »).
  6. Fin de la pause : **un son et une vibration** (Android ; l'iPhone ne
     vibre pas depuis le navigateur), puis l'exercice suivant tout seul.
  7. **Deux colonnes de charges**, Speedy et Big Max ; à la deuxième séance,
     **pré-remplies avec la dernière fois** (la première série de la trap bar
     à 70 %, comme avant). Lourd / Correct / Léger pour les deux à la fin de
     chaque exercice ; à la fin, la charge totale de chacun.
- **Un seul téléphone pour deux** (décision de Sébastien) : celui qui le tient
  note pour les deux. Pendant les séries et les pauses, l'écran est la liste
  du programme (`ListeProgramme`, `src/components/SeanceGuidee.tsx`) :
  l'échauffement coché, le groupe en cours déroulé (une ligne par série, la
  charge de Speedy et celle de Big Max côte à côte, « ▶ Série 2 — Big Max »),
  les groupes faits et à venir en une ligne. Gardés : « J'ai mal à cet
  exercice » et ses 70 %, les raccourcis 70 % / 100 %, la charge par côté
  (en petit, sous la case touchée), pas de case de poids sans charge
  (`seCharge` : un crochet quand la série est faite). La séance enregistrée
  garde ce qu'a fait l'autre (`SeanceRealisee.partenaire`) ; ce téléphone en
  tire les charges et le ressenti de l'autre pour la fois d'après
  (`historiqueDe`). L'accueil montre, sous chaque exercice, le volume et la
  dernière charge de l'autre. La reprise après un rechargement garde les
  charges des deux et les séries faites.
- **Pas de chrono pendant une série** : une série se finit sur « Série
  terminée » (`manuelle`) ; sa durée (« série ≈ 48 s ») n'est qu'une
  estimation, au tempo, la plus longue des deux quand on la fait ensemble,
  plus 15 s pour passer à la suivante. Le métronome, le changement de côté
  et le cercle au temps ne viennent que sur « Tempo », et repartent de zéro.
  La routine du soir et la séance libre gardent leurs décomptes.
- **La pause se lance d'un clic** (`construireEtapesUnTelephone`,
  `src/utils/etapesSeance.ts`) : 1 min partout, 1 min 30 pour la trap bar
  (`reposDe`), à la fin d'une paire ou d'un exercice seul, une seule fois —
  les pauses empilées (repos + installation) ont disparu. À la fin : la
  cloche, une vibration (`vibrer`, `src/utils/sounds.ts`, protégée quand le
  téléphone ne sait pas vibrer), et la séance repart d'elle-même. Rien après
  le dernier exercice (les étirements suivent ; son ressenti s'y donne).
  Seul, sans l'autre : une pause à lancer entre deux séries d'un exercice
  seul.
- **Paires : jamais deux exercices de la même zone** (`src/utils/zones.ts`) :
  le haut (zones « haut », « dos » sauf le bas du dos), le bas (« bas »), le
  tronc (« gainage », et tout exercice qui vise le bas du dos — le Superman) ;
  un exercice de tout le corps prend les zones de ses muscles principaux
  (le good morning : bas et tronc). Appliqué à `accordPaire` (programme,
  nouvel accord « même zone ») et à `scoreCompagnon` (séance libre : un
  enchaînement compte donc trois exercices au plus). Les règles du souffle,
  du bas du dos et du swing restent.
- **Version 8 du programme** (même graine : les deux téléphones retombent sur
  le même ; les liens de la version 7 s'ouvrent, recomposés) : **8 exercices
  les trois jours, semaines A et B, le premier et le dernier seuls, trois
  paires entre les deux**. « Exercices par séance » : 4, 6 ou 8, les trois
  jours, 8 par défaut. Durées à deux, graine 1 : lundi 1 h 03 / 1 h 11, mardi
  1 h 01 / 1 h 08, jeudi 58 / 52 min (semaines A / B) ; sur 30 graines, lundi
  ≈ 1 h 06, mardi ≈ 1 h 04, jeudi ≈ 55 min.
- **Tranché par Claude, à valider par Sébastien** :
  - **Les deux exercices seuls de chaque jour** : lundi, la trap bar en tête
    et la presse ou le hack squat pour finir (A / B) ; jeudi, le swing en
    tête et le traîneau pour finir ; **mardi, le développé couché aux
    haltères en tête et la marche du fermier pour finir** — la trap bar, la
    presse et le hack squat n'ont pas leur place le jour du haut, avec le
    jiu-jitsu le soir.
  - **Le mardi**, jour du haut, ne peut pas jumeler deux exercices du haut :
    chacun va avec le ventre (du gainage, rien sur le bas du dos) ou **une
    jambe légère** (une isolation des jambes sans machine : mollets, bouche
    d'incendie, élévation latérale de jambe), qui ne vole pas les jambes du
    jiu-jitsu.
  - **Le jeudi**, jour des jambes : la Copenhague et les deux machines,
    chacune avec le ventre ou un tirage léger (oiseau, rowing appuyé) ; les
    machines ne vont plus ensemble, et il n'y a plus de place pour une fente.
    Il dure parfois un peu plus d'une heure, quand ses tirages légers se
    font d'un bras puis de l'autre (61 min au plus, sur 30 graines).
  - **Le lundi** : le Superman, le ventre ou une jambe légère, chacun avec le
    haut du corps (un développé au-dessus de la tête, un tirage, un
    développé).
  - **La semaine B** reprend le moins possible les exercices de la semaine A
    (sauf les favoris : trap bar, Superman, développé couché, swing,
    Copenhague, les deux machines).
  - **L'oiseau aux haltères et au kettlebell comptent pour un seul
    mouvement** (`MEME_MOUVEMENT`, `src/utils/generateurSeance.ts`) : le jeudi
    en tirait les deux, un sur trois. Un test le vérifie pour tous les
    programmes.
  - **Un nombre d'exercices choisi avant la version 8 repart à 8** : il
    valait pour le mardi et le jeudi, le lundi en avait deux de plus
    (`mettreANiveau`). Pareil sur les deux téléphones et pour un ancien lien.
  - **« Ensuite · … » au-dessus des boutons** : à 375 px, la carte d'une paire
    remplit l'écran et cachait le suivant.
  - « Sans pause » à côté de « Pause · 1 min » ; « Passer cette paire »
    saute la paire entière.
- **La séance commune sur deux téléphones est cachée, pas supprimée** :
  `SEANCE_COMMUNE` (`src/hooks/useSeanceCommune.ts`) ne s'allume qu'avec
  `VITE_SEANCE_COMMUNE=oui` à la publication ; alors l'ancienne horloge
  revient telle quelle. Le serveur et `src/utils/etatCommun.ts` n'ont pas
  changé : pas de mise à jour du VPS. Les tests de l'horloge commune tournent
  sur une semaine de la version 7 (`semaineDeuxTelephones.fixture.ts`).
- **Version 1.1.0**, affichée dans les Réglages (lue dans `package.json` à la
  construction, `__VERSION_APP__`).
- **Vérifié dans le navigateur à 375 px** (Playwright, serveur de dev) : une
  séance du lundi à deux, la liste et « Ensuite », les charges des deux,
  l'alternance sans pause, la pause de 1 min 30 au clic puis la vibration
  demandée et l'exercice suivant tout seul, la paire sans pause entre les
  tours, la pause de 1 min, la reprise après rechargement, l'enregistrement
  (les charges et le ressenti de Big Max dans `partenaire`), le
  pré-remplissage à la séance suivante, l'écran de fin.
- **Non vérifié** : la vibration et le son sur un vrai téléphone ; une vraie
  séance à la salle ; la séance commune rallumée (`VITE_SEANCE_COMMUNE=oui`)
  dans le navigateur (seulement par les tests) ; ce que le serveur fait du
  champ `partenaire` (lu dans son code : il garde la séance telle qu'elle
  arrive, 64 Ko au plus — pas exécuté). Le téléphone de Big Max ne connaît
  pas les charges notées pour lui sur celui de Speedy : faire la séance
  toujours sur le même téléphone.

## Séance du 11 octobre 2026

- **À présenter à Sébastien, en liste courte avec un avis par point, avant
  d'en coder quoi que ce soit** : l'audit de la logique
  (`docs/audit-logique.md`) et l'audit dans le navigateur (`docs/audit-ux.md`).
- **La nouvelle semaine** (version 6 du programme, recomposé avec la même
  graine : pareil sur les deux téléphones ; les anciens liens s'ouvrent
  toujours). **Lundi, tout le corps** : 8 exercices (4 paires), 10
  répétitions chacun, la trap bar en tête avec le haut du corps, le Superman
  avec le ventre, développés et tirages, la presse ou le hack squat pour finir
  (≈ 1 h 20). **Mardi, le haut** : 6 exercices, Speedy 8 / Big Max 10, la
  marche du fermier (≈ 1 h 10 mesuré). **Jeudi, les jambes, modéré** : 6
  exercices, Speedy 8 / Big Max 10, le **swing à deux mains** en tête (30 s,
  léger, « Ce sont les fesses qui lancent, pas le dos… ») avec un tirage léger
  du haut du corps, l'intérieur avec l'extérieur de cuisse (une fente
  latérale), les deux machines des cuisses ensemble, le traîneau ; ni trap
  bar, ni presse, ni hack squat (≈ 1 h). Les trois jours en semaines A et B ;
  la trap bar, le Superman, le swing et les machines reviennent chaque semaine.
  - **Nouvelle règle des paires** : jamais deux exercices qui coupent le
    souffle ; un explosif (le swing) ne va qu'avec un tirage léger, sinon seul.
  - **Retirés** : la semaine dure, la dernière série à la moitié de la charge
    le mardi. **Liste des mis de côté vidée** (fentes, une jambe, good
    morning, rowings sans appui) ; le mécanisme reste. Le rowing alterné buste
    penché compte désormais comme chargeant le bas du dos, comme les autres.
  - **Ressenti, seule progression** : léger 3 fois de suite pour Speedy (4
    avant le lot « séance »), 2 pour Big Max ; lourd 2 fois pour les deux
    (`src/utils/ressenti.ts`).
  - **Réglages** : « Exercices par séance » 4, 6 ou 8 pour mardi et jeudi, le
    lundi deux de plus ; répétitions en trois lignes (Speedy · lundi, Speedy ·
    mardi et jeudi, Big Max). **Séance libre** : discipline, format, niveau,
    matériel et explosifs derrière « Plus de réglages ».
  - Le lien « Envoyer à Big Max » est plus compact (six séances, moins de
    3 000 caractères).
- **Le lien court** (option A choisie par Sébastien : 3 000 caractères dans
  Messenger, c'était absurde). « Envoyer à Big Max » ne transporte plus que
  la recette : version, graine, premier lundi, empreinte des séances, les
  réglages qui changent (dont l'équipe et le serveur s'il n'est pas celui du
  site) et les retouches à la main. **56 à 62 caractères** pour un programme
  neuf, une centaine avec un code d'équipe et un autre serveur, + 17 à 20 par
  « Changer », + 5 à 7 pour une paire ou chacun son tour. Le téléphone qui
  reçoit recompose, rejoue les retouches et vérifie l'empreinte ; s'il ne
  retombe pas sur les mêmes séances (autre version), un bandeau le dit. Ce que
  la recette ne sait pas refaire part en lien long ; les liens longs se
  lisent toujours (`encoderProgramme`, `src/utils/programmeMois.ts`).

- **Décisions de Sébastien sur l'audit de la logique** (points 1.4, 1.5,
  1.8, pépites 5 et 7 ; version 7 du programme, recomposé avec la même
  graine). **Extension des jambes** (machine et haltère) : plus aucun arrêt,
  ni genoux pliés ni jambes tendues, et « Genoux sensibles : de 90° jusqu'à
  presque tendu, sans verrouiller ni tenir en haut » ; à l'échauffement, des
  squats « aussi bas que le genou le permet ». **Speedy : 8 répétitions à la
  trap bar**, même le lundi (et aux autres soulevés de terre lourds, debout à
  deux mains), Big Max 10 ; l'accueil et les Réglages le disent. **Pause
  après une paire : 1 min**, 1 min 30 après celle de la trap bar ; seul,
  chacun garde la sienne. **Le ventre, le dos immobile** : plus de crunchs,
  V-ups, relevés de buste ni rotations russes au programme (ils restent en
  bibliothèque et en séance libre), du gainage à la place ; **le Superman sans
  poids** (nouvel exercice `superman`, dessin), celui au kettlebell hors
  programme. **La planche de Copenhague courte** (`copenhagen-plank`, dessin,
  15 s de chaque côté) chaque jeudi, avec l'extérieur de cuisse ; à six
  exercices, le jeudi n'a donc plus de fente (elles reviennent à huit). Durées
  à deux, graine 1 : lundi 1 h 13 / 1 h 20, mardi 1 h 07 / 1 h 04, jeudi
  56 / 54 min (semaines A / B). Le Superman sans poids et la Copenhague
  n'ont pas de case de poids (`seCharge`).
- **Lot « séance » (décidé par Sébastien après l'audit UX)** : une barre
  fixe en bas de la séance guidée avec le gros bouton de l'étape (Démarrer,
  Série terminée, Go, Passer + « +15 s », Étirements finis) et Pause ;
  Précédent / Suivant petits en haut, « Suivant » demande avant de sauter une
  série, « Passer l'exercice » petit et confirmé. Fin : « Enregistrer » en
  haut, « Ne pas enregistrer » petit en bas et confirmé. Quitter : une seule
  question dans l'application (Reprendre plus tard, Enregistrer ce qui est
  fait, Tout jeter — redemandé —, Continuer) ; la journée n'est cochée qu'à
  partir de la moitié des séries (`assezFaite`). « CHANGE DE CÔTÉ » 5 s
  (+5 s) aussi aux étirements de fin (5 min 25 s) et aux balancements de
  jambe de l'échauffement. Lourd / Correct / Léger expliqués. Léger 3 fois
  pour Speedy. **« J'ai mal à cet exercice »** (accueil et séance, sur ce
  téléphone) : repère, pas de montée, chaque série à 70 % de la charge de
  travail retenue au signalement (`src/utils/douleurs.ts`). **70 %** : la
  première série des exercices qui chargent le bas du dos, et deux
  raccourcis « 70 % · X » / « 100 % · Y » sous chaque saisie
  (`src/utils/charges.ts`). Trap bar, presse, hack squat :
  `chargeParCote`, « disques seulement, sans la barre », « soit 35 lb de
  chaque côté ». Pas de saisie de poids ni de ressenti pour un exercice sans
  charge (`seCharge`, qui s'appuie sur `chargeReglable`).

- **La routine du soir**, demandée par Sébastien (« des étirements ou de la
  mobilité à faire tous les soirs, pas mon entraînement ») — **dix minutes au
  plus**, « pas plus, sinon je ne la ferai pas » : une carte en haut de
  l'accueil (« Routine du soir · 10 min », sept points, « 5 soirs sur 7 »), un
  écran avec les parties et « Commencer » en bas, et une routine guidée plein
  écran — image, consignes, décompte, côté droit / « Change de côté » 5 s /
  côté gauche, cloche douce, Pause, Précédent, Suivant, Quitter. Seul sur son
  téléphone, sans serveur. Détail dans le [README](README.md#routine-du-soir).
  - **Quatre parties, chacune s'éteint d'un appui** (la dernière allumée reste) :
    **gainage** ≈ 3 min (planche 30 s ; planche latérale et chien d'arrêt 30 s
    de chaque côté ; 5 s entre deux), **mobilité jiu-jitsu** ≈ 2 min (deux
    mouvements), **cou** ≈ 1 min 15 (inclinaison de côté, flexion avant, 20 s de
    chaque côté, en douceur, sans cercles), **étirements** ≈ 3 min 30 (trois par
    personne). Toute la routine : **9 min 55 s** pour Speedy comme pour Big Max
    (`DUREE_MAX_SEC` = 10 min, un test le vérifie). Un cou à 1 min 30 aurait
    fait dépasser les dix minutes.
  - **Étirements** — Speedy : bébé heureux, ischio-jambiers allongé, genou
    ramené en travers. Big Max : mollet contre un mur, quadriceps sur le côté,
    ischio-jambiers allongé. **La liste du physio de Big Max remplacera la
    sienne dès qu'on l'aura** (`ROUTINE_PAR_DEFAUT.max`, `src/utils/routineSoir.ts`) ;
    sa liste de départ n'est pas gardée sur son téléphone tant qu'il n'y touche
    pas, donc la changer en code suffit.
  - **Mobilité** — ni le 90/90 ni le « livre ouvert » n'existent dans la
    bibliothèque : le demi-pigeon (Speedy) ou l'écart des jambes allongé (Big Max,
    pour ses genoux) tiennent la place du 90/90, la torsion couchée celle du
    livre ouvert ; l'écran dit ce que chacun remplace. **Un vrai dessin pour
    chacun reste à faire**, comme pour le chien d'arrêt (il emprunte le dessin du
    « rowing chien d'arrêt », banc et haltère, avec une note à l'écran). Le cou :
    la bibliothèque n'a que des étirements, pas d'isométrique ni de mobilité.
  - Durées (constantes) : 45 s ou 30 s par côté (20 s au cou), 5 s pour changer
    de côté, 5 s entre deux exercices, 10 s pour s'installer aux étirements.
  - **Modifiable** : la liste d'étirements — « Changer » (choix dans la
    bibliothèque, sans ce que la personne doit éviter : flexions avant debout et
    équilibre sur une jambe pour Speedy, fentes et genoux très pliés pour Big
    Max, ni ce que les autres parties font déjà), ↑ ↓, « Retirer », « Ajouter »
    (trois au plus), « Remettre la liste de départ ». Si une liste retouchée
    dépasse dix minutes, l'écran le dit, sans rien interdire.
  - **Suivi léger, gardé sur le téléphone seulement** (`routineSoir` dans la
    sauvegarde locale, relue avec prudence ; les anciennes sauvegardes se
    chargent comme avant) : les soirs faits et les parties éteintes, hors de
    l'historique et des statistiques, sans envoi au serveur. Le marquer vient en
    finissant la routine, ou à la main. Avant 4 h du matin, c'est encore le soir
    d'hier. **Piste, pas demandée** : envoyer les soirs au serveur pour que
    chacun voie ceux de l'autre.
  - Pas de reprise si on quitte en route : dix minutes, on recommence.
    **À essayer sur un vrai téléphone** : la cloche douce, l'écran qui reste
    allumé, et si 10 s pour s'installer aux étirements est juste.

- **Analyse 80/20** : [docs/maturite-80-20.md](docs/maturite-80-20.md). Il
  reste une séance test à deux en salle, un lot de corrections, et un bouton
  d'export hors du VPS ; puis on gèle 4 semaines (corrections seulement).

- **Corrigé : « TIENS » au mauvais endroit.** L'arrêt du tempo se tenait
  toujours en bas, après la descente. Juste pour un curl ou un développé,
  absurde à la Superman ou à la bouche d'incendie : l'application disait
  « TIENS » allongé à plat, la jambe posée. Maintenant, **on tient là où le
  muscle travaille** : en bas quand la position basse est étirée sous la
  charge, **en haut quand la position basse est un repos**. 37 exercices
  tiennent désormais en haut, muscles serrés : les Superman, la bouche
  d'incendie, l'élévation latérale de jambe, la ruade, les ponts fessiers, les
  élévations latérales et frontales, les haussements d'épaules, les extensions
  triceps buste penché, les crunchs et relevés, le mollet au sol, les deux
  machines des cuisses… Le métronome dit MONTE, TIENS, DESCENDS, la bille
  s'arrête en haut du rail, et la consigne « On tient en haut, muscles
  serrés » s'affiche avec les autres. L'arrêt change de place, pas de durée :
  les séances durent autant.
- **L'extension des jambes à la machine** retrouve un arrêt, jambes tendues,
  comme le dit l'affiche de la salle — jamais genoux pliés, pour les genoux
  de Big Max. Sa répétition dure une seconde de plus au tempo par défaut.
- Trois exercices commencent maintenant par la descente, comme leur position
  de départ, bras ou cloche en l'air : l'extension triceps à un bras, le
  moulin à vent et le bûcheron au kettlebell.
- Restent en bas, exprès : le mollet sur une marche (le talon sous la marche
  étire le mollet sous la charge), les curls, les rowings, et le rowing
  vertical (tenu en haut, il pincerait l'épaule).
- **Lourd, correct ou léger**, à la demande de Sébastien : comme on ne monte
  pas les charges à chaque séance, chacun dit comment c'était. Après la
  dernière série de chaque exercice, trois gros boutons (facultatifs), pendant
  la pause qui suit — ou aux étirements pour le dernier exercice. La réponse
  est gardée avec l'exercice dans l'historique, part vers le serveur avec lui,
  et s'affiche en petit dans le détail d'une séance.
- **Léger deux fois de suite**, à la même charge : la fois d'après, la charge
  proposée monte de 5 lb (2,5 kg), avec « Léger les 2 dernières fois : on
  monte de 5 lb » dans la séance et « ↑ +5 lb proposé » sur l'accueil.
  **Lourd deux fois de suite** : un cran de moins. Une montée ne se propose
  qu'une fois : quand la charge change, le compte repart de zéro. Avec la
  semaine dure réussie du jeudi, un seul cran, pas deux ; « lourd » passe avant.
  Les seuils et le cran sont des constantes (`src/utils/ressenti.ts`).
- L'essai et « Voir comme » montrent les boutons mais ne gardent rien. La
  proposition ne vaut que pour les séances du programme ; en séance libre, on
  peut répondre, mais la charge n'est pas ajustée.
- Le serveur n'a pas changé : il garde la séance telle qu'elle arrive, le
  ressenti compris (un test le vérifie). Pas de mise à jour du VPS à faire.
- **Corrigé : MONTE / TIENS / DESCENDS au tour de taille**, où il n'y a ni
  haut ni bas. Chaque exercice a maintenant une **forme** : vertical (par
  défaut), **cercle** ou **d'un côté à l'autre**. Le tour de taille, le halo
  et le tour du monde tournent : « TOURNE » pendant tout le tour (6 s au
  tempo par défaut), la bille fait le tour d'un cercle, et à mi-série
  « Change de sens ! » d'un bip, sans s'arrêter — le halo change de sens à
  mi-série lui aussi, plus à chaque tour. Les rotations russes (haltère et
  kettlebell), le balayage en position creuse, les coups croisés assis en V
  et le passage de la cloche sous la planche disent « À DROITE » 3 s, « À
  GAUCHE » 3 s : une répétition, c'est les deux. Aucun ne s'arrête jamais :
  leur répétition est d'une seconde plus courte.
- **Changer de côté**, demandé par Sébastien : entre le côté droit et le
  côté gauche d'un exercice unilatéral, l'écran dit « CHANGE DE CÔTÉ » et
  compte 5 s (« Côté gauche dans 5 s »), avec les bips de la préparation ;
  « +5 s » en donne cinq de plus, autant de fois qu'il faut. La durée
  annoncée compte les 5 s (une série unilatérale dure 5 s de plus), pas les
  « +5 s ». À deux, « +5 s » arrête l'horloge commune comme « +15 s » au
  repos, refusé si l'autre est en pleine série. Le changement fait partie de
  la série : pas de nouvelle étape, l'essai et l'horloge commune le comptent
  d'office.
- **Relu, les 151 exercices un par un**, et corrigé en passant : le crunch
  genou-haltère debout dit maintenant comme celui au kettlebell « MONTE (le
  genou), TIENS, DESCENDS » ; l'écarté et le pull-over en position creuse,
  le soulevé de terre sur une jambe au kettlebell, le good morning et le
  burpee partent par la descente ; le pas chassé bas avec rowing et le saut
  de grenouille, par la montée ; la rotation externe coudes au corps dit
  « OUVRE, TIENS, FERME ». Plus d'arrêt en bas aux squats et fentes qui en
  avaient encore un (cosaque, bras tendu, sur une jambe vers un banc,
  esquive latérale, fente bulgare, fente latérale et développé, pas chassé
  bas), au soulevé de terre sur une jambe aux haltères et aux deux bûcherons
  (penchés et tournés en bas) ; ni aux mouvements explosifs. La plupart
  sont avancés ou mis de côté, et la composition du programme ne dépend pas
  du tempo : pas de nouvelle version, seules les durées bougent de quelques
  secondes.
- **Le tableau des mouvements**, `docs/mouvements.md` : une ligne par
  exercice, ce que dit le métronome pendant une répétition (« MONTE 3 s →
  DESCENDS 3 s → TIENS 1 s »), les côtés, la durée d'une série de 8, et
  pourquoi. Il sort du code (`npm run mouvements`), un test vérifie qu'il le
  suit. **À relire par Sébastien**, pour signaler ce qui sonne encore faux.
- **Les cercles au temps**, à la demande de Sébastien (« pas facile d'y
  aller à 3/3 » au halo) : le halo, le tour de taille et le tour du monde se
  font maintenant **30 s dans un sens, « Change de sens ! » d'un bip sans
  s'arrêter, 30 s dans l'autre** — une minute par série, la même pour les
  deux, sans métronome (un décompte dans un cercle qui se remplit). Le poids
  se note et « lourd, correct, léger » le règle comme avant ; l'essai fait
  20 s + 20 s. Le relevé turc complet (avancé, hors programme) passe au temps
  lui aussi, un côté puis l'autre avec les 5 s pour changer de côté. Les
  autres candidats sont passés en revue en tête de `docs/mouvements.md`
  (« Au temps ou au tempo ? ») : **à décider par Sébastien**, les coups
  croisés assis en V (les explosifs ont été décidés ensuite, juste
  dessous) ; les rotations russes, les planches et les rowings en planche
  gardent le tempo. Le programme n'est pas recomposé : seules les séries de
  cercles passent de 48 s à 1 min.
- **Les 16 explosifs au temps**, décidé par Sébastien : « pas fuir un
  exercice, pouvoir un jour le faire sans douleur — donc mettre moins de
  poids ». Swings, arrachés, épaulé, tirage haut, balanciers, sauts, burpee :
  plus de tempo, un décompte, à son rythme, **léger** (« À ton rythme, léger :
  la qualité avant la vitesse »). **30 s** par série (`BALISTIQUE_SEC`) pour
  les neuf qui lancent une charge, de chaque côté avec « CHANGE DE CÔTÉ » 5 s
  et « +5 s » pour les six à un bras ; **20 s** (`SAUT_SEC`) pour les sept
  sauts et le burpee (`saut: true` dans la fiche). Le poids, « lourd, correct,
  léger » et les crans de charge restent (`chargeReglable`). L'essai les
  raccourcit d'un tiers, la durée annoncée est celle des étapes, seul, à deux
  et en séance libre, où ils prennent leur temps et non la tenue du niveau.
  Une station de circuit d'un seul bras prend aussi ses 5 s. Toujours
  option seulement (« mouvements explosifs »), jamais dans le programme, qui
  est identique octet pour octet (vérifié sur 11 956 empreintes de programmes,
  de séances et de séances libres sans l'option).

## Séance du 10 octobre 2026

- **Deux machines ajoutées**, à la demande de Sébastien : l'**extension des
  jambes** (l'avant de la cuisse, assis) et la **flexion des jambes couché**
  (l'arrière de la cuisse, allongé sur le ventre). Elles sont dans la
  bibliothèque, avec un dessin simple dans le même style que les autres
  machines (`leg-extension-machine`, `leg-curl-machine`).
- **Le lundi, elles vont en paire**, juste après les objectifs, dès six
  exercices, en semaine A comme en semaine B : ce sont les préférées du duo.
  À quatre exercices, les objectifs prennent toute la place.
- **À deux, on se croise** : Big Max commence sur l'une, Speedy sur l'autre,
  puis on échange. Personne n'attend la machine. Une minute de pause après la
  paire.
- **Les genoux de Big Max** : à l'extension, pas d'arrêt genoux pliés, pas
  plus bas que l'angle droit, une charge modérée ; si le genou fait mal, on
  réduit l'amplitude. À la flexion couché, les hanches restent collées au banc,
  sans cambrer le bas du dos.
- **Le programme est recomposé** (version 5) à la prochaine ouverture, avec la
  même graine, pareil sur les deux téléphones. Le mardi et le jeudi ne
  changent pas ; un exercice changé à la main se perd, comme à chaque
  nouvelle version.
- L'extension et le leg curl aux haltères restent dans la bibliothèque, mais
  jamais dans la même séance que leur machine : c'est le même mouvement. Pour
  que le lundi à dix exercices trouve encore ses paires, la place « fente »
  accepte aussi la chaise au mur avec développé et le thruster.
- Les 2 nouveaux dessins sont à refaire avec les 4 autres (point 4 plus
  bas).

## Fermeture du 7 octobre 2026

### Où on en est

- **En ligne** : https://sgtraining.netlify.app. Netlify publie chaque push sur
  `main`. Le contrôle GitHub « Vérifier le site » ouvre le site publié, et
  vérifie le serveur à chaque push et chaque matin.
- **Le serveur est sur le VPS** depuis le 7 octobre :
  https://srv1302277.hstgr.cloud, branché dans `netlify.toml`. Il assure :
  - le direct à deux ;
  - l'historique des deux, tout depuis le premier jour ;
  - les copies de sécurité : chaque nuit (30 gardées), et la première de
    chaque mois pour toujours.
- **Le lot du 7 octobre**, fait par une équipe d'agents, puis assemblé et
  vérifié (701 tests, parcours dans un navigateur) :
  - **Surnoms** : Speedy (Sébastien) et Big Max (Max) partout à l'écran. Les
    identifiants internes ne changent pas.
  - **Paires d'exercices opposés tous les jours**. Une seule pause, après la
    paire : 1 min pour les petits muscles, 1 min 30 avec un gros exercice,
    2 min avec la trap bar. La finale reste seule.
  - **Le programme** : 6 exercices par défaut (4, 6, 8 ou 10 au choix), au
    tempo 3 s / 3 s + 1 s en bas, réglable. Ces deux réglages appartiennent au
    programme et valent pour les deux téléphones. Durée : environ 1 h 06 à
    deux.
  - **« ✓ Ensemble / Chacun son tour »** sur deux lignes.
  - **Séance d'essai** (environ 10 minutes, rien n'est gardé, séance commune
    numérotée) et **« Voir comme Big Max »**.
  - **Mensurations** : poids, taille et âge, le jour 1 puis une fois par
    mois. Un onglet **« Progression »** montre trois graphiques.
  - **Protections du serveur** : débit par adresse, tailles maximales, base
    plafonnée à 100 Mo.
  - **Précautions** :
    - pas d'arrêt en bas pour les exercices du dos et ceux qui plient fort le
      genou ;
    - mis de côté jusqu'à l'examen de la jambe de Speedy
      (`EXERCICES_MIS_DE_COTE`) : les fentes, les exercices sur une jambe, le
      good morning et les rowings sans appui ;
    - des étirements des jambes à chaque fin de séance.
- **Recherche scientifique** du 7 octobre : elle fonde ces choix de tempo, de
  pauses et de précautions. Sources principales :
  - Schoenfeld 2015, sur la durée des répétitions ;
  - la prise de position ACSM 2026 ;
  - Bohm 2015, sur les tendons ;
  - Zhang 2025, sur les supersets ;
  - Fredericson 2000 et une revue de 2024, sur la bandelette ;
  - Felson 2007, sur le genou qui lâche.

### En attente de Sébastien

Le serveur du VPS a été mis à jour le 10 octobre (mensurations,
protections, machines des cuisses). Pour une prochaine mise à jour du
serveur : hPanel → VPS → Manage → Web console, taper
`bind 'set enable-bracketed-paste off'`, puis coller la ligne
d'installation du README.


1. **Faire examiner la jambe de Speedy** (l'impression qu'elle « lâche »).
   Ensuite, rouvrir `EXERCICES_MIS_DE_COTE` dans `programmeMois.ts` selon
   l'avis du professionnel.
2. **La liste des étirements du physio de Big Max.** Elle remplacera sa liste
   de la routine du soir (`ROUTINE_PAR_DEFAUT.max`).
3. **Les images.** Les 6 dessins des machines (`trap-bar-deadlift`,
   `leg-press`, `hack-squat`, `traineau`, `leg-extension-machine`,
   `leg-curl-machine`) sont à refaire avec Gemini, sur le PC de Sébastien.
   - Les demandes, prêtes à coller, sont dans [IMAGES_A_FAIRE.md](IMAGES_A_FAIRE.md)
     (Gemini « Nano Banana »).
   - Joindre `public/exercices/goblet-squat.png` comme modèle de style :
     poster noir et blanc, femme en brassière, positions 1 et 2 dans des
     ronds noirs, petite silhouette anatomique en haut à gauche, format
     paysage 3:2.
   - Envoyer les images à Claude, qui les recadre en 640 × 440.

### Pistes, pas demandées

- Le mardi, des étirements du haut du corps. Aujourd'hui, les 5 étirements de
  fin sont les mêmes chaque jour : 4 pour les jambes et une torsion.
- Exporter l'historique et les mesures dans un fichier, pour en garder une
  copie hors du VPS.
- Les séries d'approche avant le premier gros exercice, et la règle de douleur
  affichée. La recherche les recommande, mais elles n'ont pas été retenues le
  7 octobre.
- « Chacun son tempo » : inutile pour l'instant, le tempo du programme vaut
  pour les deux.
- Deux fentes avec développé (`kb-lunge-press`, `kb-rotating-side-lunge-press`)
  restent possibles : sans elles, le lundi à 10 exercices manque de
  candidats. Si la jambe proteste : « Changer ».

### Décisions prises

- **Tempo 3 s / 3 s + 1 s par défaut**, choisi par Sébastien après la
  recherche. Il est lent et sans rebond. Pour les tendons, la charge compte
  plus que la lenteur. Le mouvement lent et léger, façon Systema, reste bon
  pour le contrôle et la mobilité.
- **Des paires tous les jours**, et la finale seule. L'échauffement et les
  étirements sont communs aux deux.
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

- **Claude est chef de projet, pas exécutant** (demandé le 11 octobre). Pour
  chaque demande, avant de coder : 1) son avis, et ce qu'il conteste dans la
  demande ; 2) deux ou trois options, avec sa recommandation et ce qu'elle
  coûte ; 3) la confronter au but du projet et à l'analyse 80/20
  (`docs/maturite-80-20.md`). On code seulement après le choix de Sébastien.
  Une phrase de Sébastien n'est pas un ordre à exécuter mot à mot.
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
  - `npx vitest run` (975 tests) ;
  - `npx tsc -b --noEmit` ;
  - `npx eslint .` ;
  - `npm run build`.
- **Équipe d'agents** :
  - chaque agent travaille dans son propre `git worktree` (`/home/user/ft-*`),
    avec `node_modules` lié à celui du dépôt ;
  - on assemble par `git merge --squash` dans une branche d'intégration, on
    vérifie tout, puis on pousse sur `main` ;
  - pour les petits travaux, Haiku ou Sonnet ; Opus pour le délicat.
- **Tests dans un navigateur** : des scripts Playwright temporaires
  (`*.tmp.mjs` à la racine, à effacer avant le commit), avec `playwright-core`
  et Chromium dans `/opt/pw-browsers/chromium`.
  - Le serveur local tourne avec `PORT=18080 DONNEES=… setsid node serveur/serveur.ts &`.
    `setsid` permet de le figer avec SIGSTOP pour simuler un réseau muet.
  - Construire le site avec `VITE_SERVEUR=http://127.0.0.1:18080 npx vite build`,
    puis le servir avec `npx vite preview --port 4173`.
