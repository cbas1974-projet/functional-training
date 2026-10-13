// Types de l'application Functional Training.
//
// Le modèle est conçu pour accueillir plusieurs familles d'entraînement
// (haltères, bandes élastiques, Swiss ball, poids de corps, yoga) : un
// exercice décrit son matériel, sa zone, son groupe musculaire et son
// schéma de mouvement, ce qui permet de composer des séances équilibrées
// et de remplacer un exercice par un équivalent avec un autre matériel.

export type Zone = 'haut' | 'gainage' | 'dos' | 'bas' | 'complet';

export type GroupeMusculaire =
  | 'biceps'
  | 'triceps'
  | 'epaules'
  | 'trapezes'
  | 'avant-bras'
  | 'pectoraux'
  | 'abdominaux'
  | 'obliques'
  | 'dorsaux'
  | 'quadriceps'
  | 'ischios-fessiers'
  | 'adducteurs'
  | 'mollets'
  | 'corps-entier';

/** Muscle ou région musculaire, telle que les posters la colorient sur leur
 *  planche anatomique — chaque case en porte une, vue de face et de dos, avec
 *  les muscles travaillés en noir et les muscles secondaires en gris.
 *
 *  Beaucoup plus fin que `GroupeMusculaire`, qui sert à équilibrer une séance
 *  et n'a qu'une valeur par exercice. C'est cette liste qui permet de répondre
 *  à « renforce mon bas du dos » : les lombaires n'étaient représentables par
 *  aucun groupe — « dorsaux » désigne le grand dorsal, le muscle des tractions,
 *  pas celui du bas du dos. */
export type Muscle =
  | 'nuque'
  | 'trapezes'
  | 'epaules'
  | 'coiffe-rotateurs'
  | 'pectoraux'
  | 'dorsaux'
  | 'lombaires'
  | 'biceps'
  | 'triceps'
  | 'avant-bras'
  | 'abdominaux'
  | 'obliques'
  | 'fessiers'
  /** Extérieur de la hanche et de la cuisse : moyen et petit fessier, tenseur
   *  du fascia lata. C'est eux qu'on renforce quand « la bandelette » tire —
   *  la bandelette ilio-tibiale elle-même est un tendon plat, pas un muscle :
   *  elle ne se renforce pas, elle se soulage. */
  | 'abducteurs'
  | 'ischios'
  | 'quadriceps'
  | 'adducteurs'
  | 'flechisseurs-hanche'
  | 'mollets';

/** Matériel nécessaire pour réaliser l'exercice. L'utilisateur déclare ce
 *  qu'il possède ; seuls les exercices réalisables lui sont proposés. */
export type Materiel =
  | 'aucun'
  | 'halteres'
  | 'kettlebell'
  | 'banc'
  | 'step'
  | 'barre-fixe'
  | 'elastique'
  | 'swissball'
  | 'tapis'
  /** Les machines de la salle : trap bar, presse à cuisses, hack squat,
   *  traîneau, extension et flexion des jambes, mollets assis. Une pour
   *  deux : on s'y relaie. */
  | 'salle';

/** Schéma de mouvement. C'est la clé de l'équilibre d'une séance : on évite
 *  d'empiler deux exercices du même schéma, et un remplacement propose le
 *  même schéma avec un autre matériel (soulevé de terre roumain aux haltères
 *  ↔ good morning à la bande ↔ pont fessier au sol). */
export type PatternMoteur =
  | 'squat'
  | 'charniere'
  | 'fente'
  | 'poussee-horizontale'
  | 'poussee-verticale'
  | 'tirage-horizontal'
  | 'tirage-vertical'
  | 'rotation'
  | 'anti-rotation'
  | 'flexion-tronc'
  | 'flexion-laterale'
  | 'portage'
  | 'isolation'
  | 'mobilite';

/** La forme d'une répétition, telle que le métronome la dicte. Rien à voir
 *  avec `PatternMoteur`, qui range l'exercice pour équilibrer la séance (une
 *  « rotation » russe et un tour de taille « anti-rotation » ont pourtant la
 *  même famille de forme pour le métronome) : la forme dit seulement comment
 *  la charge bouge pendant une répétition.
 *
 *  vertical   : on monte, on descend — le cas par défaut. Le métronome dit
 *               MONTE, DESCENDS, et TIENS là où se tient l'arrêt.
 *  circulaire : un cercle continu, sans haut ni bas (tour de taille, halo,
 *               tour du monde) : jamais d'arrêt, et on change de sens à
 *               mi-série, annoncé d'un bip, sans s'arrêter. Les trois cercles
 *               du kettlebell se font au temps (`unite: 'secondes'`) : 30 s
 *               dans un sens, puis 30 s dans l'autre (`SENS_CERCLE_SEC`),
 *               chacun à son rythme, un décompte et pas de métronome. Un
 *               cercle en répétitions, lui, compterait des tours : un tour
 *               dure la montée plus la descente, le métronome dit « TOURNE »
 *               d'un bout à l'autre du tour, et la bille en fait le tour.
 *  rotation   : d'un côté à l'autre (rotation russe, balayage, coups
 *               croisés, passage de la cloche sous le corps) : jamais
 *               d'arrêt. Une répétition va à droite (le temps de la montée)
 *               puis à gauche (celui de la descente) ; le métronome dit
 *               « À DROITE », « À GAUCHE », et la bille va et vient sur un
 *               rail couché. */
export type FormeMouvement = 'vertical' | 'circulaire' | 'rotation';

/** Famille d'entraînement : détermine la façon de travailler (répétitions
 *  chargées, maintiens au temps, enchaînements respiratoires). Seule la
 *  musculation entre dans les séances générées ; les deux autres alimentent la
 *  bibliothèque et les routines de mobilité. */
export type Famille = 'musculation' | 'yoga' | 'etirement';

/** bilateral : les deux côtés ensemble ; alterne : un côté puis l'autre à
 *  chaque répétition ; unilateral : toutes les répétitions d'un côté, puis
 *  l'autre côté (le temps de la série est doublé, plus le temps de changer
 *  de côté entre les deux : `changementDeCoteSec`). */
export type Cotes = 'bilateral' | 'alterne' | 'unilateral';

export type Unite = 'reps' | 'secondes';

export type Niveau = 'debutant' | 'intermediaire' | 'avance';

export type Objectif = 'complet' | 'haut' | 'bas' | 'gainage' | 'dos';

/** Ce qu'on vient travailler. La musculation compte des répétitions chargées ;
 *  le yoga et les étirements tiennent des positions au temps, sans charge et
 *  sans tempo. « mobilite » pioche dans les deux. */
export type Discipline = 'musculation' | 'yoga' | 'etirement' | 'mobilite';

export type FormatSeance = 'series' | 'superset' | 'circuit' | 'mixte';

/** Façon de mener un circuit.
 *  classique : travail moyen, repos court entre les stations.
 *  tabata    : 20 s de travail, 10 s de repos, beaucoup de tours.
 *  enchaine  : trois ou quatre stations d'affilée sans aucun repos, puis une
 *              vraie pause avant de recommencer le tour. */
export type StyleCircuit = 'classique' | 'tabata' | 'enchaine';

/** Unité dans laquelle les charges sont saisies et affichées. Les haltères
 *  vendus au Québec sont marqués en livres ; le kilogramme reste disponible. */
export type UnitePoids = 'lb' | 'kg';

export interface Exercice {
  id: string;
  nomFr: string;
  nomEn: string;
  zone: Zone;
  groupe: GroupeMusculaire;
  muscles: string;
  /** Muscles que la planche anatomique du poster noircit : ceux que
   *  l'exercice travaille directement. */
  musclesPrincipaux?: Muscle[];
  /** Ceux qu'elle grise : sollicités, sans être la cible. */
  musclesSecondaires?: Muscle[];
  materiel: Materiel;
  /** Schéma de mouvement, pour équilibrer la séance et proposer des
   *  équivalents avec un autre matériel. */
  pattern: PatternMoteur;
  /** Famille d'entraînement ; 'musculation' par défaut. */
  famille?: Famille;
  /** 1 = accessible aux débutants, 2 = intermédiaire, 3 = avancé */
  niveauMin: 1 | 2 | 3;
  cotes: Cotes;
  /** reps : au tempo, le métronome dicte et compte les répétitions.
   *  secondes : au temps, un décompte et pas de métronome — les tenues, les
   *  portages, le traîneau, les cercles du kettlebell, le relevé turc et les
   *  mouvements explosifs. Le `reps` du bloc est alors une durée en
   *  secondes : par côté pour un exercice unilatéral, dans chaque sens pour
   *  un cercle (`partiesAuTemps`). */
  unite: Unite;
  /** Mouvement balistique (saut, swing) : incompatible avec le tempo lent,
   *  il se fait au temps (`unite: 'secondes'`), à son rythme, avec une
   *  charge légère (`BALISTIQUE_SEC`, `SAUT_SEC`). Exclu tant que l'option
   *  « explosifs » n'est pas activée, et toujours hors du programme. */
  explosif?: boolean;
  /** Un explosif où l'on quitte le sol — squat sauté, saut de grenouille,
   *  patineur, saut de bûche, burpee : une série plus courte, 20 s au lieu
   *  de 30 (`SAUT_SEC`). */
  saut?: boolean;
  /** Une tenue au temps dont la fiche impose la durée, en secondes — par
   *  côté pour un exercice d'un côté : la planche de Copenhague courte, 15 s
   *  de chaque côté. Absente, la tenue suit la séance (`secondesAuTemps`). */
  tenueImposeeSec?: number;
  /** Pas d'arrêt en bas, quel que soit le tempo : on descend contrôlé et on
   *  remonte sans rebond. Pour les exercices où la position basse tenue
   *  fatigue le bas du dos ou le genou (soulevés de terre, rowings penchés,
   *  squats, fentes…). La durée d'une répétition, la bille, le métronome et la
   *  durée annoncée de la séance en tiennent compte : voir
   *  `tempoPourExercice`. */
  sansPauseEnBas?: boolean;
  /** L'arrêt du tempo se tient en haut, juste après la montée, muscles
   *  serrés, puis on redescend — au lieu d'en bas, après la descente.
   *
   *  La règle : on tient là où le muscle travaille. En bas quand la position
   *  basse est étirée sous la charge (curl, développé, écarté, rowing,
   *  mollet sur une marche…) : c'est le cas par défaut. En haut quand la
   *  position basse est un repos — allongé à plat, jambe posée, haltères qui
   *  pendent sans rien demander au muscle visé : Superman, bouche d'incendie,
   *  pont fessier, élévations latérales et frontales, haussements d'épaules,
   *  crunchs, flexion des jambes à la machine… ou quand le mouvement consiste à serrer
   *  la contraction. Tenir en bas, à plat ou jambe posée, ne travaillerait
   *  rien.
   *
   *  Même durée que l'arrêt en bas : la répétition et la séance gardent leur
   *  durée. Sur un exercice `sansPauseEnBas`, il redonnerait un arrêt, en
   *  haut seulement ; aucun ne le fait plus : l'extension des jambes ne tient
   *  ni genoux pliés ni jambes tendues (les genoux de Big Max). Voir
   *  `tempoPourExercice`. */
  pauseEnHaut?: boolean;
  /** Plie le genou sous charge (squats, fentes, presse…) : on ne descend que
   *  jusqu'où le genou ne fait pas mal. Ajoute une consigne aux points
   *  d'attention (`consignesDe`). */
  genouAMenager?: boolean;
  /** Chargé de disques des deux côtés (trap bar, presse, hack squat) : le
   *  poids noté est celui des disques seulement, sans la barre ni le
   *  chariot, et l'écran dit combien en mettre de chaque côté. */
  chargeParCote?: boolean;
  /** Le matériel ne sert que d'appui, pas de charge : les pompes sur haltères
   *  ou sur kettlebells se font au poids du corps — rien à noter, rien à
   *  monter (`chargeReglable`). */
  appuiSeulement?: boolean;
  position: string;
  /** Phase par laquelle commence chaque répétition : 'descend' pour les
   *  mouvements qui partent de la position haute (squat, fente, développé
   *  couché…), 'monte' sinon (valeur par défaut). Sans effet sur un
   *  mouvement circulaire ou en rotation, qui part toujours du même bout. */
  premierePhase?: 'monte' | 'descend';
  /** La forme de la répétition pour le métronome ; absente, verticale (on
   *  monte, on descend). Un mouvement circulaire ou en rotation ne s'arrête
   *  jamais, quels que soient le tempo, `pauseEnHaut` ou `sansPauseEnBas`.
   *  Un cercle fait au temps change de sens à mi-série (`etatMaintien`).
   *  Voir `FormeMouvement` et `tempoPourExercice`. */
  mouvement?: Exclude<FormeMouvement, 'vertical'>;
  /** Les mots du métronome quand MONTE et DESCENDS ne disent pas le geste :
   *  la rotation externe coudes au corps s'ouvre et se ferme à l'horizontale
   *  (« OUVRE », « FERME »). Absents, MONTE et DESCENDS. */
  motsTempo?: { monte: string; descend: string };
  pointsAttention: string[];
  /** Pourquoi l'exercice est utile pour le jiu-jitsu (facultatif). */
  interetJjb?: string;
}

export interface Tempo {
  monteeSec: number;
  descenteSec: number;
  /** Arrêt en bas, juste après la descente : la position étirée, d'où l'on
   *  repart sans élan — sauf aux exercices qui tiennent en haut
   *  (`Exercice.pauseEnHaut`). Absent ou 0 = pas de pause (c'est le cas de
   *  toutes les séances enregistrées avant son arrivée). */
  pauseSec?: number;
}

/** Le tempo d'un exercice, tel que le lisent la durée d'une série, les
 *  étapes, le métronome et la bille (`tempoPourExercice`) : celui de la
 *  séance, plus l'endroit où se tient l'arrêt. Jamais enregistré : les
 *  réglages ne portent qu'un `Tempo`. */
export interface TempoExercice extends Tempo {
  /** L'arrêt se tient en haut, après la montée ; absent, en bas, après la
   *  descente. */
  pauseEnHaut?: boolean;
  /** Un cercle ou un va-et-vient, jamais d'arrêt ; absent, vertical. */
  mouvement?: Exclude<FormeMouvement, 'vertical'>;
}

export interface ParametresSeance {
  dureeMinutes: number;
  /** Zones travaillées, au moins une ; plusieurs zones alternent. */
  zones: Zone[];
  /** Ancien réglage à objectif unique, conservé pour lire les séances
   *  enregistrées avant l'arrivée des zones. */
  objectif?: Objectif;
  niveau: Niveau;
  /** Discipline travaillée ; 'musculation' si absente (séances enregistrées
   *  avant l'arrivée du yoga et des étirements). */
  discipline?: Discipline;
  format: FormatSeance;
  tempo: Tempo;
  /** Durée de maintien d'une position, en secondes. Ne sert qu'aux disciplines
   *  de mobilité ; absente = valeur par défaut. */
  tenueSec?: number;
  /** Matériel dont dispose l'utilisateur. Les haltères et « aucun » sont
   *  toujours implicites. */
  materiels: Materiel[];
  /** Ancien réglage, conservé pour lire les séances enregistrées avant
   *  l'arrivée de la liste de matériel. */
  banc?: boolean;
  /** Inclure les mouvements explosifs (squat sauté, swing), faits au temps. */
  explosifs: boolean;
  /** Nombre de séries souhaité par exercice ; null = automatique selon la
   *  durée. Si ce nombre ne tient pas dans la durée, l'automatique reprend. */
  seriesParExercice: 2 | 3 | 4 | null;
  /** Répétitions souhaitées par série ; null = automatique selon le niveau.
   *  Si ce nombre ne tient pas dans la durée, l'automatique reprend. */
  repsParSerie: 6 | 8 | 9 | 10 | 12 | null;
  /** Unité des charges. Absente sur les séances enregistrées avant son
   *  arrivée : celles-là avaient été saisies en kilogrammes. */
  unitePoids?: UnitePoids;
  /** Façon de mener le circuit ; 'classique' si absent. */
  styleCircuit?: StyleCircuit;
  /** Nombre d'exercices par enchaînement au format superset : 2 (paire),
   *  3 (trio) ou 4 (rotation). Absent = automatique, l'appli prend la taille
   *  qui fait tenir le plus d'exercices dans la durée. */
  tailleRotation?: 2 | 3 | 4;
  /** Ce qui rythme la répétition à l'écran pendant une série :
   *  une bille qui monte et descend, le décompte en chiffres, ou les deux. */
  guideVisuel: GuideVisuel;
}

/** bille : une bille parcourt un rail au rythme du tempo, on la suit du coin
 *  de l'œil ; chiffre : le décompte des secondes en grand ; les-deux : la
 *  bille avec les secondes inscrites dedans. */
export type GuideVisuel = 'bille' | 'chiffre' | 'les-deux';

export interface BlocSeries {
  exerciceId: string;
  series: number;
  /** Répétitions par série (par côté si unilatéral ; secondes si l'exercice
   *  se mesure au temps). */
  reps: number;
  reposSec: number;
  /** Numéro du superset auquel appartient le bloc. Deux blocs qui partagent
   *  ce numéro sont enchaînés en alternance (A1, B1, A2, B2…) : le repos de
   *  l'un est le travail de l'autre, ce qui double presque le nombre
   *  d'exercices tenables dans la même durée. Absent = bloc classique. */
  superset?: number;
  /** Repos court entre les deux exercices d'un superset, en secondes. */
  transitionSec?: number;
  /** À deux, chacun son tour sur le même appareil : le repos de l'un est la
   *  série de l'autre. Absent = en même temps, côte à côte. */
  tour?: boolean;
  /** À deux : les séries et les répétitions de l'autre sur cet exercice. Les
   *  deux téléphones en tirent la même horloge — ou, sur un seul téléphone,
   *  celui qui le tient note aussi pour l'autre. Absent = seul. Sur un seul
   *  téléphone, le cran que propose le ressenti de l'autre
   *  (`ajustementRessenti`, comme celui du bloc). */
  autre?: { series: number; reps: number; ajustementRessenti?: number };
  /** Le ressenti des dernières fois : la charge de la dernière fois, plus ce
   *  cran (léger assez de fois de suite : trois pour Speedy, deux pour Big
   *  Max) ou moins ce cran (lourd deux fois de suite) ; négatif = on
   *  redescend. Voir `ajustementDeCharge`. */
  ajustementRessenti?: number;
}

/** Un temps de l'échauffement ou du retour au calme. */
export interface MouvementGuide {
  nom: string;
  consigne: string;
  /** Durée propre ; absente, la durée de l'étape se partage également. */
  dureeSec?: number;
  /** Exercice de la bibliothèque à montrer (un étirement du poster). */
  exerciceId?: string;
  /** Les quelques secondes pour changer de côté, entre le côté droit et le
   *  côté gauche d'un mouvement d'un seul côté : « CHANGE DE CÔTÉ », et
   *  « +5 s » si besoin. */
  changementDeCote?: boolean;
}

export interface Circuit {
  stations: string[];
  tours: number;
  travailSec: number;
  reposSec: number;
  reposEntreToursSec: number;
  /** 'tempo' : les répétitions sont rythmées par la bille, comme en séries.
   *  'libre' : le travail est trop court pour un tempo lent — on affiche le
   *  décompte des secondes et chacun va à son rythme. 'tempo' si absent. */
  rythme?: 'tempo' | 'libre';
}

export interface Seance {
  id: string;
  creeLe: string;
  /** Nom de la séance du programme (« Mardi A ») ; absent pour une séance
   *  libre. */
  titre?: string;
  parametres: ParametresSeance;
  graine: number;
  echauffementSec: number;
  retourCalmeSec: number;
  /** Échauffement détaillé (tapis ou rameur, puis mouvements) ; absent,
   *  l'échauffement articulaire habituel. Ses durées font `echauffementSec`. */
  echauffement?: MouvementGuide[];
  /** Étirements de fin, avec leur image ; absents, ceux d'usage. */
  retourCalme?: MouvementGuide[];
  /** Séance du programme : l'horloge attend « Go » à chaque nouvel exercice,
   *  et à deux elle est commune aux deux téléphones. Absente pour une séance
   *  libre. */
  horloge?: {
    /** Qui fait la séance sur ce téléphone. */
    personne?: Personne;
    /** À deux : le prénom de l'autre. */
    partenaire?: string;
    /** À deux : c'est moi qui commence quand c'est chacun son tour sur une
     *  machine, et moi qui prends le premier exercice d'un groupe lié. */
    jeCommence?: boolean;
    /** La mise en place avant chaque nouvel exercice, en secondes ; absente,
     *  30 s. L'essai la raccourcit. */
    installationSec?: number;
    /** La séance se mène sur un seul téléphone : celui qui le tient note pour
     *  les deux (décision du 12 octobre 2026). Exercice par exercice (13
     *  octobre 2026) : pas de minuteur, toutes les séries d'un exercice ou
     *  d'une paire à l'écran, finies d'un seul « Exercice terminé » ; une
     *  paire se fait A, B, A, B sans pause entre les tours — sa machine
     *  chacun son tour —, un exercice seul chacun son tour ; la pause de fin
     *  part d'elle-même. Absent : l'horloge d'avant, qui déroule les séries au
     *  tempo — celle de la séance commune sur deux téléphones
     *  (`SEANCE_COMMUNE`). Voir `construireEtapes`. */
    unTelephone?: boolean;
  };
  blocs: BlocSeries[];
  circuit: Circuit | null;
  dureeEstimeeSec: number;
}

/** Comment la charge d'un exercice a été trouvée, dite sur sa dernière
 *  série : lourde (☹️), correcte (😐) ou légère (😊). Facultatif : on peut ne
 *  rien dire. */
export type Ressenti = 'lourd' | 'correct' | 'leger';

export interface ExerciceRealise {
  exerciceId: string;
  seriesPrevues: number;
  seriesFaites: number;
  reps: number;
  /** Temps réellement passé sur l'exercice, repos compris. */
  dureeSec: number;
  /** Charge retenue pour l'exercice : la plus lourde des séries, dans
   *  l'unité de la séance (`parametres.unitePoids`). */
  poids?: number;
  /** Ancien nom du champ, quand tout était en kilogrammes. Lu une fois au
   *  chargement, puis remplacé par `poids`. */
  poidsKg?: number;
  /** Charge de chaque série, dans l'ordre ; 0 = non saisie. */
  poidsParSerie?: number[];
  /** Le ressenti de la personne sur la charge, dit sur la dernière série ;
   *  absent = rien dit (et toutes les séances d'avant son arrivée). */
  ressenti?: Ressenti;
}

export interface SeanceRealisee {
  id: string;
  date: string;
  /** Nom de la séance du programme, s'il y en a un. */
  titre?: string;
  parametres: ParametresSeance;
  dureePrevueSec: number;
  dureeReelleSec: number;
  exercices: ExerciceRealise[];
  terminee: boolean;
  /** Sur un seul téléphone, à deux : ce que l'autre a fait, noté par celui
   *  qui tenait le téléphone — ses séries, ses charges, son ressenti. Les
   *  `exercices` restent ceux de la personne du téléphone. Absent : seul, ou
   *  chacun sur son téléphone (et toutes les séances d'avant). */
  partenaire?: { personne: Personne; exercices: ExerciceRealise[] };
}

/** Progression d'une séance guidée, sauvegardée pour pouvoir la reprendre
 *  si la page est rechargée (téléphone verrouillé, navigateur fermé…). */
export interface ProgressionSeance {
  seance: Seance;
  indexEtape: number;
  tempsCumuleSec: number;
  tempsParEtapeSec: number[];
  /** Charges saisies, par exercice puis par série (index 0 = série 1).
   *  0 = série non renseignée. */
  poids: Record<string, number[]>;
  /** Ressentis donnés jusque-là, par exercice ; absent avant leur arrivée. */
  ressentis?: Record<string, Ressenti>;
  /** Sur un seul téléphone, à deux : les charges et les ressentis de l'autre,
   *  notés ici. */
  poidsAutre?: Record<string, number[]>;
  ressentisAutre?: Record<string, Ressenti>;
  /** Sur un seul téléphone : les exercices finis sur « Exercice terminé »,
   *  par leur place dans les étapes (version 1.2.0 : les séries finies sur
   *  « Série terminée »). Absent : une étape compte quand on y a passé au
   *  moins la moitié de son temps, comme avant. */
  faites?: number[];
  /** Les séries notées à 70 % d'un toucher, ou pendant une douleur éteinte
   *  depuis, par exercice (numéros à partir de 1) : elles ne disent pas la
   *  charge de travail — ni le 100 %, ni la série d'après n'en partent. Sur un
   *  seul téléphone, celles de l'autre à part. */
  allegees?: Record<string, number[]>;
  allegeesAutre?: Record<string, number[]>;
  /** 'par-exercice' : sur un seul téléphone, la séance se déroule exercice
   *  par exercice (version 1.3.0, 13 octobre 2026) — `indexEtape`, `faites`
   *  et `tempsParEtapeSec` comptent ces étapes-là. Absent sur un seul
   *  téléphone : une séance de la version 1.2.0, série par série, relue au
   *  chargement (`versLeDerouleParExercice`). */
  deroule?: 'par-exercice';
  demarreeLe: string;
  /** Dernière sauvegarde (ISO), pour le bandeau de reprise. */
  sauvegardeeLe?: string;
}

export interface EntrainementState {
  parametres: ParametresSeance;
  seanceCourante: Seance | null;
  enCours: ProgressionSeance | null;
  historique: SeanceRealisee[];
  /** Le programme du mois ; null tant qu'il n'a pas été composé. */
  programme?: ProgrammeMois | null;
  /** Qui s'entraîne sur ce téléphone ; null tant qu'on ne l'a pas dit. */
  personne?: Personne | null;
  /** L'autre téléphone n'a pas ce programme-ci : il vient d'être composé, ou
   *  il a changé depuis le dernier envoi. */
  programmeARenvoyer?: boolean;
  /** On s'entraîne à deux (horloge commune) ou seul (son propre temps). */
  aDeux?: boolean;
  /** Séances faites pas encore reçues par le serveur (leurs identifiants) :
   *  elles repartent quand le réseau revient. */
  aEnvoyer?: string[];
  /** Séances supprimées ici, à effacer aussi du serveur. */
  aEffacer?: string[];
  /** Le serveur et l'équipe (« adresse|code ») qui ont déjà reçu les séances
   *  faites avant d'être branchés : on ne les renvoie pas à chaque fois. */
  historiqueEnvoyeA?: string;
  /** Les mesures du corps de ce téléphone : poids, taille, âge, à une date. */
  mesures?: Mesure[];
  /** Mesures notées ou corrigées ici pas encore reçues par le serveur (leurs
   *  identifiants) : elles repartent quand le réseau revient. */
  mesuresAEnvoyer?: string[];
  /** Mesures supprimées ici, à effacer aussi du serveur. */
  mesuresAEffacer?: string[];
  /** Le serveur et l'équipe (« adresse|code ») qui ont déjà reçu les mesures
   *  notées avant d'être branchés. */
  mesuresEnvoyeesA?: string;
  /** La routine du soir de ce téléphone : sa liste d'étirements et les soirs
   *  où elle a été faite. Reste ici, hors de l'historique d'entraînement, et ne
   *  part jamais vers le serveur. Absente des sauvegardes d'avant son arrivée. */
  routineSoir?: RoutineSoirLocale;
  /** « J'ai mal à cet exercice », par exercice : sur ce téléphone seulement,
   *  pour celui qui s'entraîne ici (la personne des réglages) — celles d'avant
   *  le 13 octobre 2026 aussi, notées avant qu'on sépare les deux. Absent des
   *  sauvegardes d'avant. */
  douleurs?: Record<string, Douleur>;
  /** Sur un seul téléphone, à deux : celles de l'autre, notées ici, à part —
   *  la douleur de l'un ne touche jamais les charges de l'autre. */
  douleursAutre?: Record<string, Douleur>;
  /** Le programme sauvegardé vient d'être recomposé : il était de cette
   *  version-là, plus ancienne. L'accueil le dit une fois — un exercice changé
   *  ou une paire refaite à la main est à refaire —, puis l'oublie. */
  programmeRecomposeDepuis?: number;
}

/** Une douleur signalée sur un exercice : pas de charge en plus proposée, et
 *  chaque série pré-remplie à 70 % de la charge de travail. */
export interface Douleur {
  /** Quand elle a été signalée (ISO). */
  depuis: string;
  /** La charge de travail à ce moment-là — 100 % —, si on la connaissait :
   *  les 70 % se calculent toujours sur elle, ils ne fondent pas d'une
   *  séance à l'autre. */
  charge?: number;
  /** L'unité de `charge`. */
  unite?: UnitePoids;
}

/** Les quatre parties de la routine du soir, dans l'ordre : le gainage, la
 *  mobilité pour le jiu-jitsu, le cou, les étirements. */
export type PartieRoutine = 'gainage' | 'mobilite' | 'cou' | 'etirements';

/** Ce que ce téléphone garde de la routine du soir (`src/utils/routineSoir.ts`). */
export interface RoutineSoirLocale {
  /** La liste d'étirements choisie à la main, par personne ; absente, la liste
   *  de départ. Des identifiants de la bibliothèque (étirements et yoga). */
  listes?: Partial<Record<Personne, string[]>>;
  /** Les soirs où elle a été faite (AAAA-MM-JJ), du plus ancien au plus récent. */
  soirs?: string[];
  /** Les parties éteintes ; absente, les quatre font partie de la routine. Au
   *  moins une reste allumée. */
  eteintes?: PartieRoutine[];
}

// ------------------------------------------------------------- Mensurations

/** Une mesure du corps, notée à une date : le poids, la taille, l'âge. La plus
 *  ancienne est le point de départ, le « jour 1 ». */
export interface Mesure {
  id: string;
  /** Le jour de la mesure (AAAA-MM-JJ), à l'heure du téléphone. */
  date: string;
  /** Le poids de corps, dans l'unité `unitePoids`. */
  poids: number;
  /** L'unité du poids au moment de la mesure : changer d'unité ensuite ne
   *  réécrit pas le passé, les courbes convertissent ce qu'il faut. */
  unitePoids: UnitePoids;
  /** La taille, en centimètres. */
  tailleCm: number;
  /** L'âge, en années. */
  age: number;
}

// ------------------------------------------------------------- Programme du mois
//
// Le vrai entraînement : l'application choisit les exercices dans la
// bibliothèque des posters, à partir d'objectifs musculaires. Le lundi, tout
// le corps, la grosse séance ; le mardi, le haut ; le jeudi, les jambes. Les
// trois jours alternent d'une semaine à l'autre — mêmes muscles, autres
// exercices. Chacun s'entraîne avec l'application sur son propre
// téléphone, seul ou à deux sur une horloge commune.

/** Qui s'entraîne sur ce téléphone. */
export type Personne = 'sebastien' | 'max';

export type TypeSeanceMois = 'dure' | 'facile';

export interface SeanceDuMois {
  /** 'lundi-a', 'mardi-a', 'jeudi-a', 'lundi-b', 'mardi-b', 'jeudi-b' ; sans
   *  alternance, 'lundi', 'mardi', 'jeudi'. */
  id: string;
  nom: string;
  /** Jour de la semaine : 1 = lundi, 2 = mardi, 4 = jeudi. */
  jour: number;
  /** Semaine A ou B ; absente, la séance revient toutes les semaines. */
  semaine?: 'A' | 'B';
  type: TypeSeanceMois;
  /** Séries : trois par exercice, les exercices par paires (`liens`). Les
   *  anciens « enchaînés » de trois du lundi et du mardi n'existent plus : un
   *  programme qui en avait est recomposé. */
  format: 'series';
  /** Identifiants d'exercices de la bibliothèque, dans l'ordre de la séance :
   *  les deux exercices d'une paire côte à côte. */
  exercices: string[];
  /** Le dernier exercice : la marche du fermier le lundi (la presse ou le
   *  hack squat passent dans une paire), les pompes le mardi, le traîneau le
   *  jeudi. Seul, en séries, après les paires. */
  finale?: string;
  /** La partie du corps du jour : tout le corps le lundi (type 'dure'), le
   *  haut le mardi, le bas le jeudi. */
  partie?: 'bas' | 'haut' | 'complet';
  /** Les paires : deux exercices opposés qui s'enchaînent sans pause ; la
   *  pause vient après la paire. Un exercice hors paire se fait seul. */
  liens?: string[][];
  /** Exercices faits chacun son tour (une machine pour deux) ; les autres se
   *  font en même temps. */
  tour?: string[];
}

/** Les points faibles qu'on peut cocher dans les Réglages, par grand groupe
 *  musculaire : chacun coché donne une série de plus aux exercices dont c'est
 *  le groupe principal (`pointFaibleDe`, `src/utils/programmeMois.ts`). */
export type PointFaible =
  | 'avant-cuisse'
  | 'arriere-cuisse'
  | 'fessiers'
  | 'interieur-cuisse'
  | 'exterieur-cuisse'
  | 'mollets'
  | 'abdos'
  | 'bas-du-dos'
  | 'haut-du-dos'
  | 'epaules'
  | 'pecs'
  | 'biceps'
  | 'triceps';

/** Les réglages du programme que les deux téléphones partagent. */
export interface ReglagesDuo {
  /** Les répétitions de chacun les jours de jiu-jitsu de Speedy (mardi,
   *  jeudi) ; Big Max fait les siennes tous les jours. */
  reps?: Record<Personne, number>;
  /** Les répétitions de Speedy le lundi, sans jiu-jitsu le soir. */
  repsLundi?: number;
  /** Le tempo des séances du programme ; la séance libre garde celui du
   *  téléphone. */
  tempo?: Tempo;
  /** Le nombre d'exercices des séances, le dernier compris : 4, 6 ou 8, les
   *  trois jours. Le premier et le dernier se font seuls, les autres par
   *  paires. (Avant la version 8 du programme : sans compter le dernier, et
   *  deux de plus le lundi.) */
  exercices?: number;
  /** Les points faibles de chacun, cochés dans les Réglages ; absents, ceux
   *  par défaut — Big Max : pecs, épaules, biceps, triceps ; Speedy : aucun
   *  (`POINTS_FAIBLES_PAR_DEFAUT`). Toujours les deux, dans l'ordre de la
   *  liste. */
  pointsFaibles?: Record<Personne, PointFaible[]>;
}

export interface ProgrammeMois {
  /** Lundi de la semaine A (AAAA-MM-JJ) : l'alternance se compte depuis lui. */
  debut: string;
  /** Identifiants des objectifs musculaires retenus. */
  objectifs: string[];
  /** Matériel de la salle, avec lequel le programme a été composé. */
  materiels: Materiel[];
  /** Graine du tirage : deux programmes de même graine sont identiques. */
  graine: number;
  seances: SeanceDuMois[];
  /** Version de la composition ; un programme plus ancien est recomposé
   *  avec la même graine. */
  version?: number;
  /** Les réglages communs aux deux téléphones : les répétitions de chacun,
   *  le tempo, le nombre d'exercices des séances et les points faibles. Le
   *  lien les transporte, pour que les deux téléphones calculent la même
   *  horloge. Absents, ceux par défaut. */
  duo?: ReglagesDuo;
  /** Le code d'équipe qui regroupe les deux téléphones sur le serveur ;
   *  absent, il se tire de la graine et du premier lundi. */
  equipe?: string;
  /** L'adresse du serveur, quand elle a été réglée sur un téléphone : le
   *  lien la transmet à l'autre. */
  serveur?: string;
}
