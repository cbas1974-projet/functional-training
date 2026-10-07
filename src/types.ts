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
   *  traîneau. Une pour deux : on s'y relaie. */
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

/** Famille d'entraînement : détermine la façon de travailler (répétitions
 *  chargées, maintiens au temps, enchaînements respiratoires). Seule la
 *  musculation entre dans les séances générées ; les deux autres alimentent la
 *  bibliothèque et les routines de mobilité. */
export type Famille = 'musculation' | 'yoga' | 'etirement';

/** bilateral : les deux côtés ensemble ; alterne : un côté puis l'autre à
 *  chaque répétition ; unilateral : toutes les répétitions d'un côté, puis
 *  l'autre côté (le temps de la série est doublé). */
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
  unite: Unite;
  /** Mouvement balistique (saut, swing) : incompatible avec le tempo lent,
   *  exclu tant que l'option « explosifs » n'est pas activée. */
  explosif?: boolean;
  position: string;
  /** Phase par laquelle commence chaque répétition : 'descend' pour les
   *  mouvements qui partent de la position haute (squat, fente, développé
   *  couché…), 'monte' sinon (valeur par défaut). */
  premierePhase?: 'monte' | 'descend';
  pointsAttention: string[];
  /** Pourquoi l'exercice est utile pour le jiu-jitsu (facultatif). */
  interetJjb?: string;
}

export interface Tempo {
  monteeSec: number;
  descenteSec: number;
  /** Arrêt en bas, juste après la descente : la position étirée, d'où l'on
   *  repart sans élan. Absent ou 0 = pas de pause (c'est le cas de toutes
   *  les séances enregistrées avant son arrivée). */
  pauseSec?: number;
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
  /** Inclure les mouvements explosifs (squat sauté, swing). */
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
   *  deux téléphones en tirent la même horloge. Absent = seul. */
  autre?: { series: number; reps: number };
  /** Ma dernière série se fait à la moitié de la charge : un soir de
   *  jiu-jitsu, on suit le rythme sans se vider. */
  derniereLegere?: boolean;
  /** Semaine dure réussie : la charge de la dernière fois, plus ce cran. */
  ajoutCharge?: number;
}

/** Un temps de l'échauffement ou du retour au calme. */
export interface MouvementGuide {
  nom: string;
  consigne: string;
  /** Durée propre ; absente, la durée de l'étape se partage également. */
  dureeSec?: number;
  /** Exercice de la bibliothèque à montrer (un étirement du poster). */
  exerciceId?: string;
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
  };
  blocs: BlocSeries[];
  circuit: Circuit | null;
  dureeEstimeeSec: number;
}

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
}

// ------------------------------------------------------------- Programme du mois
//
// Le vrai entraînement : l'application choisit les exercices dans la
// bibliothèque des posters, à partir d'objectifs musculaires. Le jeudi, la
// séance de référence, lourde, toujours la même ; le bas du corps le lundi et
// le haut le mardi, qui alternent d'une semaine à l'autre — mêmes muscles,
// autres exercices. Chacun s'entraîne avec l'application sur son propre
// téléphone, seul ou à deux sur une horloge commune.

/** Qui s'entraîne sur ce téléphone. */
export type Personne = 'sebastien' | 'max';

export type TypeSeanceMois = 'dure' | 'facile';

export interface SeanceDuMois {
  /** 'lundi-a', 'mardi-a', 'jeudi', 'lundi-b', 'mardi-b'. */
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
  /** Le dernier exercice, pour les jambes : presse, hack squat, traîneau ou
   *  marche du fermier. Seul, en séries, après les paires. */
  finale?: string;
  /** La partie du corps du jour : le bas le lundi, le haut le mardi, tout le
   *  corps le jeudi. */
  partie?: 'bas' | 'haut' | 'complet';
  /** Les paires : deux exercices opposés qui s'enchaînent sans pause ; la
   *  pause vient après la paire. Un exercice hors paire se fait seul. */
  liens?: string[][];
  /** Exercices faits chacun son tour (une machine pour deux) ; les autres se
   *  font en même temps. */
  tour?: string[];
}

/** Les réglages du programme que les deux téléphones partagent. */
export interface ReglagesDuo {
  /** Les répétitions de chacun. */
  reps?: Record<Personne, number>;
  /** Le tempo des séances du programme ; la séance libre garde celui du
   *  téléphone. */
  tempo?: Tempo;
  /** Le nombre d'exercices de chaque séance, sans compter le dernier pour
   *  les jambes : 4, 6, 8 ou 10. */
  exercices?: number;
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
   *  le tempo et le nombre d'exercices des séances. Le lien les transporte,
   *  pour que les deux téléphones calculent la même horloge. Absents, ceux
   *  par défaut. */
  duo?: ReglagesDuo;
  /** Le code d'équipe qui regroupe les deux téléphones sur le serveur ;
   *  absent, il se tire de la graine et du premier lundi. */
  equipe?: string;
  /** L'adresse du serveur, quand elle a été réglée sur un téléphone : le
   *  lien la transmet à l'autre. */
  serveur?: string;
}
