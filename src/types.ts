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

/** Matériel nécessaire en plus des haltères. */
export type Materiel = 'halteres' | 'banc' | 'step';

/** bilateral : les deux côtés ensemble ; alterne : un côté puis l'autre à
 *  chaque répétition ; unilateral : toutes les répétitions d'un côté, puis
 *  l'autre côté (le temps de la série est doublé). */
export type Cotes = 'bilateral' | 'alterne' | 'unilateral';

export type Unite = 'reps' | 'secondes';

export type Niveau = 'debutant' | 'intermediaire' | 'avance';

export type Objectif = 'complet' | 'haut' | 'bas' | 'gainage' | 'dos';

export type FormatSeance = 'series' | 'circuit' | 'mixte';

export interface Exercice {
  id: string;
  nomFr: string;
  nomEn: string;
  zone: Zone;
  groupe: GroupeMusculaire;
  muscles: string;
  materiel: Materiel;
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
  /** Banc ou marche solide disponible (débloque 6 exercices du poster). */
  banc: boolean;
  /** Inclure les mouvements explosifs (squat sauté, swing). */
  explosifs: boolean;
  /** Nombre de séries souhaité par exercice ; null = automatique selon la
   *  durée. Si ce nombre ne tient pas dans la durée, l'automatique reprend. */
  seriesParExercice: 2 | 3 | 4 | null;
  /** Répétitions souhaitées par série ; null = automatique selon le niveau.
   *  Si ce nombre ne tient pas dans la durée, l'automatique reprend. */
  repsParSerie: 6 | 8 | 9 | 10 | 12 | null;
}

export interface BlocSeries {
  exerciceId: string;
  series: number;
  /** Répétitions par série (par côté si unilatéral ; secondes si l'exercice
   *  se mesure au temps). */
  reps: number;
  reposSec: number;
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
  poidsKg?: number;
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
  poids: Record<string, number>;
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
