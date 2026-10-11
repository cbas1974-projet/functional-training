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
  - **Ressenti, seule progression** : léger 4 fois de suite pour Speedy, 2
    pour Big Max ; lourd 2 fois pour les deux (`src/utils/ressenti.ts`).
  - **Réglages** : « Exercices par séance » 4, 6 ou 8 pour mardi et jeudi, le
    lundi deux de plus ; répétitions en trois lignes (Speedy · lundi, Speedy ·
    mardi et jeudi, Big Max). **Séance libre** : discipline, format, niveau,
    matériel et explosifs derrière « Plus de réglages ».
  - Le lien « Envoyer à Big Max » est plus compact (six séances, moins de
    3 000 caractères).

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
  - `npx vitest run` (930 tests) ;
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
