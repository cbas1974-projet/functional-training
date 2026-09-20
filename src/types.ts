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

/** Matériel nécessaire pour réaliser l'exercice. L'utilisateur déclare ce
 *  qu'il possède ; seuls les exercices réalisables lui sont proposés. */
export type Materiel =
  | 'aucun'
  | 'halteres'
  | 'banc'
  | 'step'
  | 'elastique'
  | 'swissball'
  | 'tapis';

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
 *  chargées, maintiens au temps, enchaînements respiratoires). */
export type Famille = 'musculation' | 'mobilite';

/** bilateral : les deux côtés ensemble ; alterne : un côté puis l'autre à
 *  chaque répétition ; unilateral : toutes les répétitions d'un côté, puis
 *  l'autre côté (le temps de la série est doublé). */
export type Cotes = 'bilateral' | 'alterne' | 'unilateral';

export type Unite = 'reps' | 'secondes';

export type Niveau = 'debutant' | 'intermediaire' | 'avance';

export type Objectif = 'complet' | 'haut' | 'bas' | 'gainage' | 'dos';

export type FormatSeance = 'series' | 'superset' | 'circuit' | 'mixte';

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
}

export interface ParametresSeance {
  dureeMinutes: number;
  /** Zones travaillées, au moins une ; plusieurs zones alternent. */
  zones: Zone[];
  /** Ancien réglage à objectif unique, conservé pour lire les séances
   *  enregistrées avant l'arrivée des zones. */
  objectif?: Objectif;
  niveau: Niveau;
  format: FormatSeance;
  tempo: Tempo;
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
}

export interface Circuit {
  stations: string[];
  tours: number;
  travailSec: number;
  reposSec: number;
  reposEntreToursSec: number;
}

export interface Seance {
  id: string;
  creeLe: string;
  parametres: ParametresSeance;
  graine: number;
  echauffementSec: number;
  retourCalmeSec: number;
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
}
