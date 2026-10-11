// Programme du mois : l'application compose les séances elle-même, dans la
// bibliothèque des posters, à partir d'objectifs musculaires — bas du dos,
// épaules, extérieur et intérieur de cuisse par défaut. Trois matins par
// semaine : le lundi, tout le corps, la grosse séance (pas de jiu-jitsu le
// soir), la trap bar en tête ; le mardi, le haut du corps ; le jeudi, les
// jambes, modéré, le swing en tête. Les trois jours alternent d'une semaine à
// l'autre : mêmes muscles, autres exercices. Tous les jours, les exercices vont
// par paires d'exercices opposés : les deux à la suite, puis une minute de
// pause — une minute trente après la paire de la trap bar. Chacun suit la
// séance sur son téléphone, avec ses répétitions et ses charges ; à deux, les
// deux téléphones déroulent la même horloge.
import type {
  BlocSeries,
  Exercice,
  Materiel,
  MouvementGuide,
  Muscle,
  ParametresSeance,
  PatternMoteur,
  Personne,
  ProgrammeMois,
  ReglagesDuo,
  Seance,
  SeanceDuMois,
  SeanceRealisee,
  Tempo,
  UnitePoids,
} from '../types';
import { EXERCICES, EXERCICES_PAR_ID, NOM_MUSCLE } from '../data/exercices';
import { TEMPOS } from '../data/parametres';
import { construireEtapes, dureeTotaleSec } from './etapesSeance';
import { memeTempo } from './formatage';
import { cleMouvement, estExigeant, familleDe, secondesAuTemps } from './generateurSeance';
import { exercicesPourMuscles, musclesDe } from './muscles';
import { CRAN_CHARGE as CRAN, convertirPoids, uniteDeSeance } from './statistiques';
import { ajustementDeCharge, avecCran } from './ressenti';

/** L'identifiant désigne bien un exercice de la bibliothèque — et non une
 *  propriété héritée comme « constructor », qu'un lien trafiqué glisserait. */
const estConnu = (id: unknown): id is string =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(EXERCICES_PAR_ID, id);

// ------------------------------------------------------------- Les personnes

export interface ProfilPersonne {
  id: Personne;
  /** Une série de plus aux exercices de poussée — pectoraux, épaules,
   *  triceps : le haut du corps est son point faible. */
  seriePlusPoussee: boolean;
  /** Du jiu-jitsu le soir, le dimanche, le mardi et le jeudi : ces jours-là,
   *  moins de répétitions, pour garder du jus pour le cours
   *  (`repsDuJour`). */
  jiuJitsu: boolean;
  /** Étirements proposés pendant les longues pauses. */
  etirementsPause: string[];
  /** Le bas du dos à ménager : pas plus de répétitions que ça aux soulevés
   *  de terre lourds (`estSouleveLourd`), même le lundi. */
  repsMaxSouleve?: number;
}

/** Le bas du dos de Speedy fatigue vite : 8 répétitions au plus aux soulevés
 *  de terre lourds — la trap bar d'abord —, même le lundi, où il en fait 10
 *  ailleurs. Dix répétitions lentes, c'est une minute de dos sous charge : il
 *  lâcherait avant les jambes, vers la huitième (audit du 11 octobre 2026,
 *  point 1.4). Big Max fait les siennes. */
export const REPS_MAX_SOULEVE = 8;

export const PERSONNES: ProfilPersonne[] = [
  // Le dos à ménager : il s'étire pendant que Max fait sa série, sans flexion
  // avant debout — elle fatigue son bas du dos — mais avec les mollets.
  {
    id: 'sebastien',
    seriePlusPoussee: false,
    jiuJitsu: true,
    etirementsPause: ['etir-rachis-debout', 'etir-mollet-mur', 'etir-inclinaison-tronc'],
    repsMaxSouleve: REPS_MAX_SOULEVE,
  },
  // Des jambes très fortes, le haut du corps moins ; les genoux demandent
  // d'étirer les cuisses, les mollets et l'arrière des cuisses — pas de fente,
  // dure pour le genou.
  {
    id: 'max',
    seriePlusPoussee: true,
    jiuJitsu: false,
    etirementsPause: ['etir-quadriceps-debout', 'etir-mollet-mur', 'etir-ischios-debout'],
  },
];

const PROFILS = Object.fromEntries(PERSONNES.map((p) => [p.id, p])) as Record<Personne, ProfilPersonne>;

/** Les noms affichés. Les identifiants (`sebastien`, `max`) ne changent pas : ils
 *  vivent dans les sauvegardes et sur le serveur. */
export const NOM_PERSONNE: Record<Personne, string> = { sebastien: 'Speedy', max: 'Big Max' };

export const autrePersonne = (personne: Personne): Personne =>
  personne === 'sebastien' ? 'max' : 'sebastien';

/** Les soirs de jiu-jitsu de Speedy : le dimanche, le mardi et le jeudi.
 *  Le lundi, rien le soir : c'est le jour de la grosse séance. */
export const JOURS_JIU_JITSU = [0, 2, 4];

/** Les répétitions de chacun les jours de jiu-jitsu (mardi, jeudi) : Speedy
 *  deux de moins que Big Max — il garde du jus pour le cours du soir, et ça
 *  lui laisse une quinzaine de secondes de repos en plus. Big Max, sans
 *  jiu-jitsu, fait les siennes tous les jours. */
export const REPS_PAR_DEFAUT: Record<Personne, number> = { sebastien: 8, max: 10 };
/** Le lundi, pas de jiu-jitsu le soir : Speedy en fait autant que Big Max. */
export const REPS_LUNDI_PAR_DEFAUT = 10;

/** Les répétitions de chacun les jours de jiu-jitsu, pour ce programme. */
export const repsDuDuo = (programme: Pick<ProgrammeMois, 'duo'>): Record<Personne, number> => ({
  ...REPS_PAR_DEFAUT,
  ...programme.duo?.reps,
});

/** Les répétitions du lundi de Speedy, pour ce programme. */
export const repsLundiDe = (programme: Pick<ProgrammeMois, 'duo'>): number =>
  programme.duo?.repsLundi ?? REPS_LUNDI_PAR_DEFAUT;

/** Les répétitions de chacun, ce jour-là : un soir de jiu-jitsu, celles des
 *  jours de jiu-jitsu ; sinon (le lundi), Speedy fait celles du lundi, et
 *  Big Max les siennes, comme tous les jours. */
export function repsDuJour(programme: Pick<ProgrammeMois, 'duo'>, jour: number): Record<Personne, number> {
  const reps = repsDuDuo(programme);
  if (JOURS_JIU_JITSU.includes(jour)) return reps;
  return Object.fromEntries(
    PERSONNES.map((p) => [p.id, p.jiuJitsu ? repsLundiDe(programme) : reps[p.id]]),
  ) as Record<Personne, number>;
}

/** Chacun son tour sur une machine : Max commence. */
const COMMENCE: Personne = 'max';

/** Les étirements proposés pendant les longues pauses. */
export const etirementsPauseDe = (personne: Personne): string[] =>
  PROFILS[personne].etirementsPause.filter(estConnu);

// ------------------------------------------------------------- Réglages

/** Les faiblesses déclarées : c'est autour d'elles que le programme se bâtit. */
export const OBJECTIFS_PAR_DEFAUT = ['bas-du-dos', 'epaules', 'exterieur-cuisse', 'interieur-cuisse'];

/** Ce qu'on trouve dans la salle : haltères, kettlebells, bancs, tapis, et
 *  les machines — trap bar, presse à cuisses, hack squat, traîneau,
 *  extension et flexion des jambes. */
export const MATERIELS_PROGRAMME: Materiel[] = ['halteres', 'kettlebell', 'banc', 'tapis', 'salle'];

/** Le nombre d'exercices qu'on peut choisir pour le mardi et le jeudi, sans
 *  compter le dernier exercice : deux, trois ou quatre paires. Le lundi en
 *  compte deux de plus (`EXERCICES_EN_PLUS_LUNDI`) : six, huit ou dix. */
export const NOMBRES_EXERCICES = [4, 6, 8];
/** Six exercices le mardi et le jeudi, trois paires, et le dernier exercice. */
export const EXERCICES_PAR_DEFAUT = 6;
/** Le lundi, la grosse séance : une paire de plus — huit exercices par
 *  défaut. */
export const EXERCICES_EN_PLUS_LUNDI = 2;
/** Le tempo des séances du programme : 3 s / 3 s, et 1 s en bas, qui casse
 *  le rebond sans obliger à trop alléger. */
export const TEMPO_PROGRAMME: Tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 1 };

/** Le nombre d'exercices des séances de ce programme, le mardi et le jeudi. */
export const nombreExercicesDe = (programme: Pick<ProgrammeMois, 'duo'>): number =>
  programme.duo?.exercices ?? EXERCICES_PAR_DEFAUT;

/** Le nombre d'exercices d'une séance, sans le dernier : celui du réglage, et
 *  deux de plus le lundi (la séance de tout le corps). */
export const nombreExercicesDuJour = (nombre: number, seance: SeanceAGabarit): number =>
  nombre + (gabaritDe(seance) === 'dure' ? EXERCICES_EN_PLUS_LUNDI : 0);

/** Le tempo des séances de ce programme : le même sur les deux téléphones. */
export const tempoDuProgramme = (programme: Pick<ProgrammeMois, 'duo'>): Tempo =>
  programme.duo?.tempo ?? TEMPO_PROGRAMME;

/** Version de la composition. Un programme plus ancien est recomposé, avec
 *  la même graine : 3 = le bas du corps le lundi, le haut le mardi, la séance
 *  de référence le jeudi ; 4 = des paires d'exercices opposés tous les jours,
 *  au nombre d'exercices choisi ; 5 = le lundi, la paire des deux machines
 *  des cuisses (extension et flexion des jambes) ; 6 = la nouvelle semaine :
 *  le lundi tout le corps avec la trap bar, le mardi le haut, le jeudi les
 *  jambes avec le swing et les deux machines, les trois jours en semaines A
 *  et B, et les fentes de retour ; 7 = le ventre sans plier le dos, le
 *  Superman sans poids, la planche de Copenhague le jeudi (l'audit). */
export const VERSION_PROGRAMME = 7;

/** La durée inscrite dans les réglages d'une séance du programme ; la vraie
 *  est celle de ses étapes. */
const DUREE_REFERENCE_MIN = 60;
/** Garde-fou : une séance ne dépasse pas deux heures et demie. Au-delà, elle
 *  perd ses dernières paires — même à dix exercices, on n'y arrive pas. */
export const DUREE_MAXI_SEC = 150 * 60;
/** Trois séries par exercice ; Max en fait une de plus aux poussées. */
export const SERIES_PROGRAMME = 3;
/** Repos après une série d'un gros exercice, fait seul ; après une paire,
 *  c'est la pause de la paire (`reposDePaire`). */
export const REPOS_SEC = 90;
/** Repos après une série d'un petit muscle, fait seul : bras, épaules en
 *  isolation, abdominaux, mollets, intérieur et extérieur de cuisse. */
export const REPOS_PETITS_SEC = 60;
/** La trap bar faite seule : la plus lourde, deux minutes. */
export const REPOS_TRAP_BAR_SEC = 120;
/** La pause après une paire : une minute partout. Chaque muscle se repose
 *  quand même plus de deux minutes, puisque l'autre exercice de la paire lui
 *  sert de repos ; plus de cardio, et un lundi plus court (audit du 11
 *  octobre 2026, pépite 7). */
export const REPOS_PAIRE_SEC = 60;
/** Sauf après la paire de la trap bar : une minute trente. */
export const REPOS_PAIRE_TRAP_BAR_SEC = 90;
/** Les deux exercices d'une paire : le temps de passer de l'un à l'autre. */
export const TRANSITION_LIEN_SEC = 15;
/** Tenue des exercices au temps : planche, marche du fermier. Un cercle au
 *  kettlebell tourne `SENS_CERCLE_SEC` dans chaque sens, un explosif dure
 *  `BALISTIQUE_SEC` ou `SAUT_SEC` (`secondesAuTemps`). */
const TENUE_SEC = 30;
/** On tire parmi les meilleurs candidats d'un emplacement : deux programmes
 *  ne se ressemblent pas tous, sans jamais prendre un exercice hors sujet. */
const MEILLEURS = 3;

// ------------------------------------------------------------- Mis de côté

/** Les exercices mis de côté du programme du mois, pour les deux — ils font les
 *  mêmes exercices ensemble. La liste est vide depuis le 11 octobre 2026 :
 *  Sébastien a rendu au programme les fentes, les exercices sur une jambe, le
 *  good morning et les rowings sans appui, qu'on y avait mis en attendant
 *  l'examen de sa jambe.
 *
 *  Le mécanisme reste, pour plus tard : un identifiant ajouté ici sort du
 *  programme (`candidatsProgramme`) et de « Changer » (`alternatives` passe
 *  par la même liste), mais reste dans la bibliothèque et la séance libre. Un
 *  programme déjà composé garde ses exercices ; « Refaire » le programme tire
 *  parmi les nouveaux candidats. Si on y remettait les fentes, la place
 *  « fente » du jeudi prendrait d'elle-même un autre exercice des quadriceps
 *  (`classer` relâche le schéma de mouvement plutôt que de laisser la place
 *  vide). */
export const EXERCICES_MIS_DE_COTE: string[] = [];

// ------------------------------------------------------------- Emplacements

/** Une place dans une séance : les muscles qu'elle doit travailler. */
interface Emplacement {
  /** Deux emplacements de même clé ne cohabitent pas dans une séance. */
  cle: string;
  muscles: Muscle[];
  /** Au moins un de ces muscles doit être la cible de l'exercice. */
  principal?: Muscle[];
  patterns?: PatternMoteur[];
  /** Quand elle est donnée, seuls ces exercices peuvent remplir la place. */
  parmi?: string[];
  /** Le muscle de cette place n'a que peu d'exercices directs — le bas du
   *  dos, l'extérieur et l'intérieur de cuisse : la semaine B peut y reprendre
   *  celui de la semaine A quand elle n'en trouve pas d'autre, plutôt que de
   *  laisser l'objectif sans exercice. Les autres exercices de la semaine A
   *  restent interdits. */
  reprise?: boolean;
  /** Quand il y en a, ces exercices passent devant les autres. */
  preferer?: (exercice: Exercice) => boolean;
  /** Les machines de la salle y ont leur place ; ailleurs, elles attendent
   *  la fin de la séance. */
  salle?: boolean;
  /** Les favoris du duo pour cette place : ils passent devant tous les
   *  autres — une machine comprise, même sans `salle` —, et la semaine B les
   *  reprend comme la semaine A. */
  favoris?: string[];
  /** Les places qui lui font le meilleur partenaire, dans l'ordre : c'est
   *  là qu'on cherche d'abord l'autre exercice de sa paire. */
  avec?: string[];
  /** Sans partenaire possible, l'exercice entre quand même, seul : le swing,
   *  qui ouvre le jeudi. Les autres places attendent d'avoir un partenaire. */
  seulSiBesoin?: boolean;
}

/** Les trois jours : le lundi, tout le corps, lourd (« dure », la trap bar) ;
 *  le mardi, le haut ; le jeudi, les jambes, modéré (« bas », le swing). */
type Gabarit = 'dure' | 'bas' | 'haut';

type SeanceAGabarit = Pick<SeanceDuMois, 'type' | 'jour' | 'partie'>;

const gabaritDe = (seance: SeanceAGabarit): Gabarit => {
  if (seance.type === 'dure') return 'dure';
  if (seance.partie === 'bas' || seance.partie === 'haut') return seance.partie;
  // Programme d'avant la version 3 : le bas le mardi, le haut le jeudi.
  return seance.jour === 4 ? 'haut' : 'bas';
};

const TRONC: PatternMoteur[] = ['anti-rotation', 'flexion-tronc', 'rotation', 'flexion-laterale'];
/** Le ventre, au programme : d'abord du gainage où le dos ne bouge pas — la
 *  planche avec passage de la cloche, le demi-relevé turc, la planche
 *  latérale, le tour de taille. Sinon, un bûcheron ou une flexion latérale,
 *  debout ; jamais un exercice qui plie le dos (`plieLeDos`). */
const DOS_IMMOBILE: PatternMoteur[] = ['anti-rotation'];

const principauxDe = (exercice: Exercice): Muscle[] => exercice.musclesPrincipaux ?? [];

/** Le lundi s'ouvre sur la trap bar, quand le dos est frais — en paire avec
 *  le haut du corps : à deux, on se croise sur la machine. Elle revient
 *  chaque lundi, semaine A comme semaine B. */
const CHARNIERE_TRAP_BAR: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], salle: true, preferer: (e) => e.materiel === 'salle', favoris: ['trap-bar-deadlift'], avec: ['tirage', 'epaules', 'poussee'] };
/** Sans les machines : un soulevé de terre roumain ou au kettlebell. Pas un
 *  pont fessier ; et le bas du dos a sa place à lui. */
const CHARNIERE_LIBRE: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], preferer: (e) => !principauxDe(e).includes('lombaires'), avec: ['tirage', 'epaules', 'poussee'] };
/** Sans les machines, le lundi garde aussi un squat, à deux jambes. */
const SQUAT_LOURD: Emplacement = { cle: 'jambes', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['squat'], preferer: (e) => e.cotes === 'bilateral', avec: ['epaules', 'poussee', 'tirage', 'oiseau'] };

/** Le Superman du lundi, sans poids : au programme, il remplace celui au
 *  kettlebell (`HORS_PROGRAMME`). */
export const SUPERMAN = 'superman';
/** L'intérieur de cuisse du jeudi, chaque semaine : la planche de Copenhague
 *  courte, le genou sur le banc, 15 s de chaque côté. */
export const COPENHAGUE = 'copenhagen-plank';

/** Le swing à deux mains : le seul mouvement explosif du programme. Il ouvre
 *  le jeudi, au temps, léger — ce sont les fesses qui lancent, pas le dos. */
export const SWING_DU_JEUDI = 'kb-double-arm-swing';
/** Le jeudi s'ouvre sur le swing, chaque semaine. Son partenaire : un
 *  tirage léger du haut du corps (`tirage-leger`) — jamais une fente, un
 *  squat ou un autre exercice des jambes qui coupe le souffle (`accordPaire`).
 *  S'il n'en trouve pas, il se fait seul. */
const SWING: Emplacement = { cle: 'swing', muscles: ['fessiers', 'ischios'], principal: ['fessiers', 'ischios'], parmi: [SWING_DU_JEUDI], favoris: [SWING_DU_JEUDI], avec: ['tirage-leger'], seulSiBesoin: true };

/** Les places de base de chaque jour, après celles des objectifs. Chacune
 *  dit avec quelles places elle fait une bonne paire. */
const BASE: Record<Gabarit, Emplacement[]> = {
  // Le lundi, tout le corps : pousser et tirer, le ventre avec le bas du dos.
  dure: [
    // On tire, sans charger le bas du dos — la trap bar l'a déjà fait : un
    // rowing poitrine contre le banc plutôt que buste penché.
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes', 'biceps'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'], preferer: (e) => !chargeLeBasDuDos(e), avec: ['charniere', 'bas-du-dos', 'poussee'] },
    // Le ventre, face au bas du dos : les deux côtés du tronc — le dos immobile.
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: DOS_IMMOBILE, avec: ['bas-du-dos'] },
    // On pousse une charge : un développé sur banc avant les pompes.
    { cle: 'poussee', muscles: ['pectoraux', 'triceps', 'epaules'], principal: ['pectoraux'], patterns: ['poussee-horizontale'], preferer: (e) => e.materiel === 'banc', avec: ['oiseau', 'dorsaux', 'tirage', 'bas-du-dos'] },
    // Un second tirage, pour le dos : face aux épaules.
    { cle: 'dorsaux', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux', 'trapezes'], patterns: ['tirage-horizontal', 'tirage-vertical'], preferer: (e) => !chargeLeBasDuDos(e), avec: ['epaules', 'poussee'] },
    // L'arrière des épaules, qui les tient en place.
    { cle: 'oiseau', muscles: ['epaules', 'trapezes', 'dorsaux'], principal: ['epaules', 'trapezes'], patterns: ['tirage-horizontal', 'tirage-vertical'], avec: ['poussee'] },
    { cle: 'biceps', muscles: ['biceps', 'avant-bras'], principal: ['biceps'], avec: ['triceps'] },
    { cle: 'triceps', muscles: ['triceps'], principal: ['triceps'], avec: ['biceps'] },
    { cle: 'jambes', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps'], patterns: ['squat', 'fente'], preferer: (e) => e.cotes === 'bilateral', avec: ['coiffe', 'epaules', 'oiseau', 'tirage'] },
    { cle: 'coiffe', muscles: ['coiffe-rotateurs', 'epaules'], principal: ['coiffe-rotateurs'], avec: ['jambes', 'mollets'] },
    { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers'], principal: ['lombaires'], preferer: (e) => !principauxDe(e).includes('ischios'), avec: ['tronc', 'epaules', 'poussee'] },
    { cle: 'mollets', muscles: ['mollets'], principal: ['mollets'], avec: ['coiffe', 'biceps', 'triceps'] },
  ],
  // Le jeudi, les jambes, modéré : jiu-jitsu le soir. Ni trap bar, ni presse,
  // ni hack squat (`DANS_LE_JOUR`, `FINALES`).
  bas: [
    // Les deux machines des cuisses, en paire : l'extension des jambes
    // (quadriceps) avec la flexion des jambes couché (ischios). Ce sont les
    // préférées du duo : elles viennent juste après les objectifs, dès six
    // exercices, chaque jeudi, semaine A comme semaine B (`favoris`). À deux,
    // chacun commence sur l'une, puis on échange : personne n'attend. Sans les
    // machines, ces places prennent l'extension et le leg curl aux haltères.
    { cle: 'cuisse-avant', muscles: ['quadriceps'], principal: ['quadriceps'], patterns: ['isolation'], favoris: ['leg-extension-machine'], avec: ['cuisse-arriere'] },
    { cle: 'cuisse-arriere', muscles: ['ischios'], principal: ['ischios'], patterns: ['isolation'], favoris: ['leg-curl-machine'], avec: ['cuisse-avant'] },
    // Les fentes, de retour : elles travaillent les stabilisateurs.
    { cle: 'fente', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['fente'], avec: ['cuisse-arriere', 'tirage-leger'] },
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: DOS_IMMOBILE, avec: ['bas-du-dos'] },
    { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers', 'ischios'], principal: ['lombaires'], avec: ['tronc', 'cuisse-avant', 'squat'] },
    { cle: 'squat', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps'], patterns: ['squat'], avec: ['cuisse-arriere', 'fessiers'] },
    { cle: 'fessiers', muscles: ['fessiers'], principal: ['fessiers'], avec: ['squat', 'cuisse-avant'] },
    { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], avec: ['adducteurs'] },
    { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], favoris: [COPENHAGUE], avec: ['abducteurs'] },
    // Le partenaire du swing : un tirage léger du haut du corps, l'arrière des
    // épaules ou un rowing appuyé — rien qui charge le bas du dos ni qui coupe
    // le souffle. La dernière place : elle sert au swing, pas aux autres.
    { cle: 'tirage-leger', muscles: ['epaules', 'dorsaux', 'trapezes'], principal: ['epaules', 'dorsaux'], patterns: ['tirage-horizontal', 'isolation'], preferer: (e) => principauxDe(e).includes('epaules'), avec: ['swing'] },
  ],
  // Le haut du corps : pousser avec tirer. Le tronc n'y a pas de partenaire —
  // il s'oppose au bas du dos, que le mardi ne charge pas.
  haut: [
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'], avec: ['epaules', 'poussee'] },
    { cle: 'poussee', muscles: ['pectoraux', 'triceps'], principal: ['pectoraux'], patterns: ['poussee-horizontale', 'poussee-verticale'], avec: ['tirage', 'dorsaux'] },
    { cle: 'biceps', muscles: ['biceps', 'avant-bras'], principal: ['biceps'], avec: ['triceps', 'bras'] },
    { cle: 'triceps', muscles: ['triceps'], principal: ['triceps'], avec: ['biceps', 'bras'] },
    { cle: 'epaules', muscles: ['epaules', 'coiffe-rotateurs'], principal: ['epaules'], patterns: ['poussee-verticale', 'isolation'], avec: ['dorsaux', 'trapezes', 'tirage'] },
    { cle: 'dorsaux', muscles: ['dorsaux'], principal: ['dorsaux'], patterns: ['tirage-vertical', 'tirage-horizontal'], avec: ['poussee', 'coiffe', 'epaules'] },
    { cle: 'coiffe', muscles: ['coiffe-rotateurs'], principal: ['coiffe-rotateurs'], avec: ['dorsaux', 'trapezes'] },
    { cle: 'trapezes', muscles: ['trapezes'], principal: ['trapezes'], avec: ['coiffe', 'poussee-bis'] },
    { cle: 'poussee-bis', muscles: ['pectoraux', 'triceps'], principal: ['pectoraux'], avec: ['oiseau', 'trapezes'] },
    { cle: 'oiseau', muscles: ['epaules', 'trapezes', 'dorsaux'], principal: ['dorsaux', 'trapezes'], patterns: ['tirage-horizontal', 'isolation'], avec: ['poussee-bis', 'poussee'] },
    { cle: 'avant-bras', muscles: ['avant-bras', 'biceps'], principal: ['avant-bras'], avec: ['triceps', 'poussee-bis', 'coiffe'] },
  ],
};

/** Chaque objectif devient une place, dans les séances où il a sa place : le
 *  bas du dos le lundi (le jeudi, le swing travaille déjà l'arrière du
 *  corps) ; les épaules le mardi, et un développé le lundi ; l'extérieur et
 *  l'intérieur de cuisse le jeudi. */
const PAR_OBJECTIF: Record<
  string,
  { emplacement: Emplacement; gabarits: Gabarit[]; surcharge?: Partial<Record<Gabarit, Partial<Emplacement>>> }
> = {
  'bas-du-dos': {
    // Avec le ventre : les deux côtés du tronc. Le lundi, la trap bar a déjà
    // chargé l'arrière des cuisses et le dos : pour le bas du dos, le Superman,
    // allongé, plutôt qu'une deuxième charnière debout (le good morning) — et
    // chaque semaine, le dos de Speedy fatigue vite. Sans poids : une charge
    // au bout des bras écrase le bas du dos (McGill).
    emplacement: { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers', 'ischios'], principal: ['lombaires'], reprise: true, avec: ['tronc', 'cuisse-avant', 'squat'] },
    gabarits: ['dure'],
    surcharge: { dure: { favoris: [SUPERMAN], preferer: (e) => !principauxDe(e).includes('ischios'), avec: ['tronc', 'epaules', 'poussee', 'tirage'] } },
  },
  epaules: {
    emplacement: { cle: 'epaules', muscles: ['epaules', 'coiffe-rotateurs'], principal: ['epaules'], avec: ['tirage', 'dorsaux', 'trapezes'] },
    gabarits: ['dure', 'haut'],
    // Le lundi, les épaules se travaillent lourd : un développé au-dessus de la
    // tête, face à un tirage.
    surcharge: { dure: { muscles: ['epaules', 'triceps'], patterns: ['poussee-verticale'], avec: ['dorsaux', 'tirage', 'oiseau'] } },
  },
  'exterieur-cuisse': {
    // Un exercice d'une jambe qui tient le bassin : la bouche d'incendie,
    // l'élévation latérale de jambe — les stabilisateurs de la hanche.
    emplacement: { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], patterns: ['isolation'], reprise: true, avec: ['adducteurs'] },
    gabarits: ['bas'],
  },
  'interieur-cuisse': {
    // La planche de Copenhague courte, chaque jeudi : la meilleure protection
    // de l'aine pour le hockey de Big Max (Harøy 2019), et la garde de Speedy.
    // Sans banc, une fente latérale.
    emplacement: { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], reprise: true, favoris: [COPENHAGUE], preferer: (e) => e.pattern === 'fente', avec: ['abducteurs'] },
    gabarits: ['bas'],
  },
  bras: {
    emplacement: { cle: 'bras', muscles: ['biceps', 'triceps', 'avant-bras'], principal: ['biceps', 'triceps'], avec: ['triceps', 'biceps'] },
    gabarits: ['haut'],
  },
  // Le ventre s'oppose au bas du dos : il a sa place les jours qui le
  // travaillent, pas le mardi.
  tronc: {
    emplacement: { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: DOS_IMMOBILE, avec: ['bas-du-dos'] },
    gabarits: ['bas', 'dure'],
  },
  jambes: {
    emplacement: { cle: 'jambes', muscles: ['quadriceps', 'fessiers', 'ischios'], principal: ['quadriceps', 'ischios'], avec: ['ischios', 'cuisse-arriere', 'cuisse-avant', 'squat'] },
    gabarits: ['dure', 'bas'],
    surcharge: { dure: { avec: ['epaules', 'tirage', 'poussee', 'oiseau', 'coiffe'] } },
  },
  'haut-du-dos': {
    emplacement: { cle: 'tirage', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux', 'trapezes'], avec: ['epaules', 'poussee'] },
    gabarits: ['dure', 'haut'],
    surcharge: { dure: { avec: ['charniere', 'poussee', 'bas-du-dos'] } },
  },
};

/** Les places d'une séance, dans l'ordre où on les remplit : le lundi, la
 *  trap bar d'abord, fraîche ; le jeudi, le swing ; puis les objectifs, puis
 *  les places de base. */
function emplacementsDe(gabarit: Gabarit, objectifs: string[], materiels: Materiel[]): Emplacement[] {
  const parObjectif = objectifs
    .map((id) => PAR_OBJECTIF[id])
    .filter((o) => o !== undefined && o.gabarits.includes(gabarit))
    .map((o) => ({ ...o.emplacement, ...o.surcharge?.[gabarit] }));
  const resultat: Emplacement[] = [];
  const cles = new Set<string>();
  const ajouter = (emplacement: Emplacement) => {
    if (cles.has(emplacement.cle)) return;
    cles.add(emplacement.cle);
    resultat.push(emplacement);
  };
  if (gabarit === 'dure') {
    const machines = materiels.includes('salle');
    ajouter(machines ? CHARNIERE_TRAP_BAR : CHARNIERE_LIBRE);
    if (!machines) ajouter(SQUAT_LOURD);
  }
  if (gabarit === 'bas') ajouter(SWING);
  parObjectif.forEach(ajouter);
  BASE[gabarit].forEach(ajouter);
  return resultat;
}

// ------------------------------------------------------------- Le choix

/** Hors du programme, mais dans la bibliothèque et la séance libre : le
 *  Superman au kettlebell. Au programme, le Superman se fait sans poids
 *  (`SUPERMAN`) : une charge au bout des bras écrase le bas du dos, cambré
 *  (audit du 11 octobre 2026, point 1.5). */
export const HORS_PROGRAMME = ['kb-superman'];

/** Plie le dos : les crunchs, les V-ups, les relevés de buste (la flexion du
 *  tronc), et les rotations faites assis ou allongé — la rotation russe, les
 *  coups croisés en V. McGill les déconseille à un dos qui fatigue vite,
 *  surtout le matin (audit, point 1.5) : au programme, le ventre travaille
 *  le dos immobile (`DOS_IMMOBILE`). Ils restent dans la bibliothèque et la
 *  séance libre. */
export const plieLeDos = (exercice: Exercice): boolean =>
  exercice.pattern === 'flexion-tronc' ||
  (exercice.pattern === 'rotation' && /^(assis|allongé)/i.test(exercice.position));

/** Les exercices dont on peut composer un programme : musculation, avec le
 *  matériel de la salle, sans mouvement explosif ni niveau avancé, rien qui
 *  plie le dos (`plieLeDos`), et sans ceux qu'on a mis de côté
 *  (`EXERCICES_MIS_DE_COTE`, `HORS_PROGRAMME`). */
export function candidatsProgramme(materiels: Materiel[]): Exercice[] {
  const possedes = new Set<Materiel>(['aucun', ...materiels]);
  return EXERCICES.filter(
    (e) =>
      familleDe(e) === 'musculation' &&
      possedes.has(e.materiel) &&
      e.niveauMin <= 2 &&
      !e.explosif &&
      !plieLeDos(e) &&
      !HORS_PROGRAMME.includes(e.id) &&
      !EXERCICES_MIS_DE_COTE.includes(e.id),
  );
}

/** Charge le bas du dos : les lombaires travaillent, en cible ou en soutien
 *  (soulevé de terre, rowing buste penché, good morning). Un pont fessier ou
 *  une ruade, allongés, ne comptent pas. */
export function chargeLeBasDuDos(exercice: Exercice): boolean {
  return musclesDe(exercice).includes('lombaires');
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function aleatoire(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const viseLePrincipal = (exercice: Exercice, principal?: Muscle[]) =>
  !principal || (exercice.musclesPrincipaux ?? []).some((m) => principal.includes(m));

interface Preferences {
  /** Mouvements interdits (déjà dans la séance, ou dans sa variante). */
  exclus: Set<string>;
  /** Les mouvements des favoris de la séance : seule leur place les prend —
   *  le leg curl aux haltères ne vient pas prendre la place de la machine. */
  reserves?: Set<string>;
  /** Mouvements déjà pris ailleurs dans le programme : ils passent après. */
  dejaPris: Set<string>;
  /** Exercices à repousser en fin de liste. */
  repousser?: (exercice: Exercice) => boolean;
}

/** Les exercices qui remplissent le mieux une place : ceux qui la visent, au
 *  meilleur rang des préférences, du plus direct au plus accessoire. On
 *  relâche les exigences pas à pas plutôt que de laisser la place vide — sauf
 *  pour un partenaire (`strict`), qui doit en viser les muscles. `admis`
 *  écarte des exercices à chaque pas. */
function classer(
  emplacement: Emplacement,
  candidats: Exercice[],
  preferences: Preferences,
  { strict = false, admis = () => true }: { strict?: boolean; admis?: (exercice: Exercice) => boolean } = {},
): Exercice[] {
  const siens = new Set((emplacement.favoris ?? []).filter(estConnu).map((id) => cleMouvement(EXERCICES_PAR_ID[id])));
  const libres = candidats.filter(
    (e) =>
      !preferences.exclus.has(cleMouvement(e)) &&
      (!preferences.reserves?.has(cleMouvement(e)) || siens.has(cleMouvement(e))) &&
      (e.materiel !== 'salle' || emplacement.salle || emplacement.favoris?.includes(e.id)) &&
      (!emplacement.parmi || emplacement.parmi.includes(e.id)),
  );
  const filtres: ((e: Exercice) => boolean)[] = [
    (e) => (!emplacement.patterns || emplacement.patterns.includes(e.pattern)) && viseLePrincipal(e, emplacement.principal),
    (e) => viseLePrincipal(e, emplacement.principal),
    ...(strict ? [] : [() => true]),
  ];
  for (const filtre of filtres) {
    const classes = exercicesPourMuscles(libres.filter(filtre), emplacement.muscles).filter(admis);
    if (classes.length === 0) continue;
    const rang = (e: Exercice) =>
      emplacement.favoris?.includes(e.id)
        ? -1
        : (preferences.dejaPris.has(cleMouvement(e)) ? 4 : 0) +
      (preferences.repousser?.(e) ? 2 : 0) +
      (emplacement.preferer && !emplacement.preferer(e) ? 1 : 0);
    const ordonnes = [...classes].sort((a, b) => rang(a) - rang(b));
    return ordonnes.filter((e) => rang(e) === rang(ordonnes[0]));
  }
  return [];
}

/** Remplit une place : un tirage parmi les trois premiers candidats — deux
 *  programmes ne se ressemblent pas tous, sans jamais prendre un exercice
 *  hors sujet. */
function choisir(
  emplacement: Emplacement,
  candidats: Exercice[],
  preferences: Preferences,
  alea: () => number,
  options: { strict?: boolean; admis?: (exercice: Exercice) => boolean } = {},
): Exercice | null {
  const tete = classer(emplacement, candidats, preferences, options).slice(0, MEILLEURS);
  if (tete.length === 0) return null;
  const poids = tete.map((_, i) => MEILLEURS - i);
  let tirage = alea() * poids.reduce((somme, p) => somme + p, 0);
  for (let i = 0; i < tete.length; i += 1) {
    tirage -= poids[i];
    if (tirage < 0) return tete[i];
  }
  return tete[0];
}

// ------------------------------------------------------------- Les paires

/** Ce que fait un exercice dans la séance : son étiquette sur l'accueil. */
export type Role = 'pousse' | 'tire' | 'jambes' | 'bas-du-dos' | 'tronc' | 'corps-entier';

export const NOM_ROLE: Record<Role, string> = {
  pousse: 'pousse',
  tire: 'tire',
  jambes: 'jambes',
  'bas-du-dos': 'bas du dos',
  tronc: 'tronc',
  'corps-entier': 'tout le corps',
};

const MUSCLES_HAUT: Muscle[] = ['nuque', 'trapezes', 'epaules', 'coiffe-rotateurs', 'pectoraux', 'dorsaux', 'biceps', 'triceps', 'avant-bras'];
const MUSCLES_BAS: Muscle[] = ['fessiers', 'abducteurs', 'ischios', 'quadriceps', 'adducteurs', 'mollets'];

/** L'exercice vise au moins un de ces muscles. */
const vise = (exercice: Exercice, ...muscles: Muscle[]) => principauxDe(exercice).some((m) => muscles.includes(m));

/** Pousser ou tirer : le schéma de mouvement d'abord, sinon les muscles — un
 *  curl ou un oiseau tirent, une extension des triceps pousse. */
function sensDe(exercice: Exercice): 'pousse' | 'tire' {
  if (exercice.pattern === 'poussee-horizontale' || exercice.pattern === 'poussee-verticale') return 'pousse';
  if (exercice.pattern === 'tirage-horizontal' || exercice.pattern === 'tirage-vertical') return 'tire';
  return vise(exercice, 'dorsaux', 'trapezes', 'biceps', 'avant-bras') && !vise(exercice, 'pectoraux', 'triceps')
    ? 'tire'
    : 'pousse';
}

/** Le rôle d'un exercice : le tronc, le bas du dos, les jambes, tout le
 *  corps, ou le haut du corps, qui pousse ou qui tire. */
export function roleDe(exercice: Exercice): Role {
  if (TRONC.includes(exercice.pattern)) return 'tronc';
  if (vise(exercice, 'lombaires')) return 'bas-du-dos';
  const haut = vise(exercice, ...MUSCLES_HAUT);
  const bas = vise(exercice, ...MUSCLES_BAS);
  if (exercice.groupe === 'corps-entier' || (haut && bas)) return 'corps-entier';
  if (bas) return 'jambes';
  return haut ? sensDe(exercice) : 'tronc';
}

/** Les étiquettes d'un exercice : son rôle, et « bas du dos » quand il le
 *  charge sans le viser — deux exercices qui le chargent ne vont jamais
 *  ensemble. */
export function rolesDe(exercice: Exercice): Role[] {
  const role = roleDe(exercice);
  return role !== 'bas-du-dos' && chargeLeBasDuDos(exercice) ? [role, 'bas-du-dos'] : [role];
}

/** La partie du corps d'un exercice : le bas du dos compte avec les jambes. */
function partieDe(exercice: Exercice): 'haut' | 'bas' | 'tronc' | 'corps-entier' {
  const role = roleDe(exercice);
  if (role === 'pousse' || role === 'tire') return 'haut';
  if (role === 'jambes' || role === 'bas-du-dos') return 'bas';
  return role;
}

/** Travaille le haut du corps, seul ou avec le reste. */
const avecLeHaut = (exercice: Exercice) =>
  partieDe(exercice) === 'haut' || (partieDe(exercice) === 'corps-entier' && vise(exercice, ...MUSCLES_HAUT));

/** Un tirage léger du haut du corps : l'arrière des épaules (un oiseau) ou un
 *  rowing, rien qui charge le bas du dos. Le jeudi, c'est le partenaire du
 *  swing. */
const estTirageLeger = (e: Exercice) =>
  partieDe(e) === 'haut' &&
  sensDe(e) === 'tire' &&
  (e.pattern === 'tirage-horizontal' || (e.pattern === 'isolation' && vise(e, 'dorsaux', 'epaules'))) &&
  !chargeLeBasDuDos(e);

/** Ce qui a sa place chaque jour : le lundi, tout, mais le haut du corps
 *  sans charger le bas du dos — la trap bar l'a déjà fait ; le mardi, le haut
 *  du corps seulement, et rien qui charge le bas du dos — jiu-jitsu le soir ;
 *  le jeudi, le bas du corps et le tronc, et un tirage léger pour le swing. */
const DANS_LE_JOUR: Record<Gabarit, (exercice: Exercice) => boolean> = {
  dure: (e) => !(partieDe(e) === 'haut' && chargeLeBasDuDos(e)),
  bas: (e) =>
    partieDe(e) === 'bas' ||
    partieDe(e) === 'tronc' ||
    (partieDe(e) === 'corps-entier' && vise(e, ...MUSCLES_BAS)) ||
    estTirageLeger(e),
  haut: (e) => partieDe(e) === 'haut' && !chargeLeBasDuDos(e),
};

/** Le bas du corps seulement : les jambes et le bas du dos — ou un mouvement
 *  de tout le corps qui ne vise qu'eux, comme le swing. */
const basSeulement = (e: Exercice) =>
  partieDe(e) === 'bas' ||
  (partieDe(e) === 'corps-entier' &&
    principauxDe(e).length > 0 &&
    principauxDe(e).every((m) => m === 'lombaires' || MUSCLES_BAS.includes(m)));

/** Ce qui fait une bonne paire : deux exercices qui s'opposent. Des plus
 *  précises aux plus larges ; des muscles opposés valent un peu mieux que le
 *  haut avec le bas. Chaque test lit la paire dans un sens ; on essaie les
 *  deux. */
const OPPOSITIONS: { raison: string; force: number; test: (a: Exercice, b: Exercice) => boolean }[] = [
  {
    raison: 'biceps ↔ triceps',
    force: 3,
    test: (a, b) => vise(a, 'biceps') && sensDe(a) === 'tire' && vise(b, 'triceps') && sensDe(b) === 'pousse',
  },
  {
    raison: 'pectoraux ↔ dos',
    force: 3,
    test: (a, b) => vise(a, 'pectoraux') && sensDe(a) === 'pousse' && vise(b, 'dorsaux', 'trapezes') && sensDe(b) === 'tire',
  },
  {
    raison: 'épaules ↔ dos',
    force: 3,
    test: (a, b) => vise(a, 'epaules') && sensDe(a) === 'pousse' && vise(b, 'dorsaux', 'trapezes') && sensDe(b) === 'tire',
  },
  // Deux objectifs : plus fort que les autres, pour qu'ils restent ensemble
  // quand un squat sumo ou un fessier offre une autre paire de même force.
  { raison: 'intérieur ↔ extérieur de cuisse', force: 4, test: (a, b) => vise(a, 'adducteurs') && vise(b, 'abducteurs') },
  { raison: 'quadriceps ↔ ischios', force: 3, test: (a, b) => vise(a, 'quadriceps') && vise(b, 'ischios') },
  { raison: 'quadriceps ↔ bas du dos', force: 3, test: (a, b) => vise(a, 'quadriceps') && vise(b, 'lombaires') },
  { raison: 'quadriceps ↔ fessiers', force: 3, test: (a, b) => vise(a, 'quadriceps') && vise(b, 'fessiers') },
  // Le ventre et le bas du dos : les deux côtés du tronc.
  { raison: 'ventre ↔ bas du dos', force: 3, test: (a, b) => roleDe(a) === 'tronc' && vise(a, 'abdominaux', 'obliques') && vise(b, 'lombaires') },
  // Le swing et son tirage léger : plus fort qu'un haut avec un bas
  // ordinaire, pour qu'ils restent ensemble.
  { raison: 'haut ↔ bas', force: 4, test: (a, b) => estTirageLeger(a) && b.explosif === true && basSeulement(b) },
  { raison: 'pousser ↔ tirer', force: 2, test: (a, b) => avecLeHaut(a) && avecLeHaut(b) && sensDe(a) === 'pousse' && sensDe(b) === 'tire' },
  { raison: 'haut ↔ bas', force: 2, test: (a, b) => partieDe(a) === 'haut' && basSeulement(b) },
];

const oppositionDe = (a: Exercice, b: Exercice) => OPPOSITIONS.find((o) => o.test(a, b) || o.test(b, a));

/** Deux exercices en paire : un bon partenaire, ou un à éviter. */
export type Accord = 'bon' | 'bas-du-dos' | 'memes-muscles' | 'souffle' | 'pas-opposes';

export interface AccordPaire {
  accord: Accord;
  /** Ce qui les unit (« pousser ↔ tirer ») ou pourquoi les éviter ensemble
   *  (« le bas du dos deux fois »). */
  raison: string;
}

const NOM_PARTIE = { haut: 'le haut du corps', bas: 'les jambes', tronc: 'le tronc', 'corps-entier': 'tout le corps' };

/** La règle des paires : jamais deux exercices qui chargent le bas du dos,
 *  jamais les mêmes muscles principaux, jamais deux exercices qui coupent le
 *  souffle (`estExigeant` : squat, charnière, fente, portage, tout le corps —
 *  comme dans les enchaînements de la séance libre) ; et deux exercices qui
 *  s'opposent —
 *  le haut avec le bas, pousser avec tirer, ou des muscles opposés :
 *  quadriceps et ischios, intérieur et extérieur de cuisse, biceps et
 *  triceps, pectoraux ou épaules et dos, ventre et bas du dos. */
export function accordPaire(a: Exercice, b: Exercice): AccordPaire {
  // La bibliothèque ne change pas : un accord calculé une fois l'est pour de bon.
  const deLaBibliotheque = EXERCICES_PAR_ID[a.id] === a && EXERCICES_PAR_ID[b.id] === b;
  const cle = `${a.id}|${b.id}`;
  const connu = deLaBibliotheque ? ACCORDS.get(cle) : undefined;
  if (connu) return connu;
  const accord = calculerAccord(a, b);
  if (deLaBibliotheque) ACCORDS.set(cle, accord);
  return accord;
}

/** Les accords déjà calculés. */
const ACCORDS = new Map<string, AccordPaire>();

function calculerAccord(a: Exercice, b: Exercice): AccordPaire {
  if (chargeLeBasDuDos(a) && chargeLeBasDuDos(b)) return { accord: 'bas-du-dos', raison: 'le bas du dos deux fois' };
  const communs = principauxDe(a).filter((m) => principauxDe(b).includes(m));
  if (a.id === b.id || communs.length > 0) {
    const noms = communs.map((m) => NOM_MUSCLE[m].toLowerCase()).join(', ');
    return { accord: 'memes-muscles', raison: noms ? `mêmes muscles : ${noms}` : 'mêmes muscles' };
  }
  // Le swing avec une fente, un squat : c'est le souffle qui lâche avant le
  // muscle, et la qualité du geste en pâtit.
  if (estExigeant(a) && estExigeant(b)) return { accord: 'souffle', raison: 'deux exercices qui coupent le souffle' };
  // Un mouvement explosif — le swing du jeudi — ne va qu'avec un tirage léger
  // du haut du corps : jamais avec un autre exercice des jambes.
  for (const [explosif, autre] of [[a, b], [b, a]]) {
    if (explosif.explosif && !estTirageLeger(autre)) {
      return { accord: 'souffle', raison: 'un explosif va avec un tirage léger du haut du corps' };
    }
  }
  const opposition = oppositionDe(a, b);
  if (opposition) return { accord: 'bon', raison: opposition.raison };
  const [pa, pb] = [partieDe(a), partieDe(b)];
  if (pa === 'haut' && pb === 'haut') {
    return { accord: 'pas-opposes', raison: sensDe(a) === 'pousse' ? 'pas opposés : pousser deux fois' : 'pas opposés : tirer deux fois' };
  }
  return { accord: 'pas-opposes', raison: pa === pb ? `pas opposés : deux fois ${NOM_PARTIE[pa]}` : 'pas opposés' };
}

/** Une machine avec un exercice libre : à deux, on se croise, personne
 *  n'attend. */
const BONUS_MACHINE = 2;
/** Deux machines différentes : on se croise aussi — Big Max commence sur
 *  l'une, Speedy sur l'autre, puis on échange. Le bonus est plus fort que
 *  celui de deux paires « machine + exercice libre » réunies (deux fois
 *  `BONUS_MACHINE`, avec des oppositions au plus aussi fortes) : la paire
 *  des deux machines — l'extension et la flexion des jambes, le jeudi — ne
 *  se défait jamais pour aller chacune avec un exercice libre. */
const BONUS_DEUX_MACHINES = 6;

/** La force d'une bonne paire : celle de l'opposition, plus le bonus des
 *  machines, où l'on se croise. -1 pour une paire à éviter. */
function forcePaire(a: Exercice, b: Exercice): number {
  if (accordPaire(a, b).accord !== 'bon') return -1;
  const machines = [a, b].filter((e) => e.materiel === 'salle').length;
  const bonus = machines === 2 ? BONUS_DEUX_MACHINES : machines === 1 ? BONUS_MACHINE : 0;
  return (oppositionDe(a, b)?.force ?? 0) + bonus;
}

/** Les paires automatiques d'une liste d'exercices : le plus de paires
 *  possible, puis les plus fortes. Elles ne dépendent pas de l'ordre de la
 *  liste — refaites, elles retombent sur les mêmes ; l'ordre, lui, est
 *  gardé : chaque paire prend la place de son premier exercice, et la trap
 *  bar reste en tête. */
export function apparier(ids: string[]): { exercices: string[]; paires: string[][] } {
  const uniques = [...new Set(ids)];
  const tries = uniques.filter(estConnu).sort();
  const forces = tries.map((a) => tries.map((b) => (a === b ? -1 : forcePaire(EXERCICES_PAR_ID[a], EXERCICES_PAR_ID[b]))));
  const libres = tries.map(() => true);
  const enCours: [number, number][] = [];
  let meilleur = { paires: [] as [number, number][], force: 0 };
  // On essaie toutes les façons d'apparier : dix exercices au plus, c'est
  // quelques milliers d'essais.
  const explorer = (force: number) => {
    const i = libres.indexOf(true);
    const restants = libres.filter(Boolean).length;
    if (enCours.length + Math.floor(restants / 2) < meilleur.paires.length) return;
    if (i < 0) {
      const mieux =
        enCours.length > meilleur.paires.length || (enCours.length === meilleur.paires.length && force > meilleur.force);
      if (mieux) meilleur = { paires: [...enCours], force };
      return;
    }
    libres[i] = false;
    for (let j = i + 1; j < tries.length; j += 1) {
      if (!libres[j] || forces[i][j] < 0) continue;
      libres[j] = false;
      enCours.push([i, j]);
      explorer(force + forces[i][j]);
      enCours.pop();
      libres[j] = true;
    }
    explorer(force);
    libres[i] = true;
  };
  explorer(0);

  const partenaire = new Map<string, string>();
  for (const [i, j] of meilleur.paires) {
    partenaire.set(tries[i], tries[j]);
    partenaire.set(tries[j], tries[i]);
  }
  const exercices: string[] = [];
  const paires: string[][] = [];
  for (const id of uniques) {
    if (exercices.includes(id)) continue;
    const autre = partenaire.get(id);
    exercices.push(id, ...(autre ? [autre] : []));
    if (autre) paires.push([id, autre]);
  }
  return { exercices, paires };
}

/** La séance avec ses paires automatiques. */
function avecPairesAutomatiques(seance: SeanceDuMois): SeanceDuMois {
  const { exercices, paires } = apparier(seance.exercices);
  return rangee({ ...seance, exercices, liens: paires });
}

/** Les mêmes paires, dans n'importe quel ordre. */
const empreinte = (paires: string[][] = []) =>
  paires
    .map((paire) => [...paire].sort().join('+'))
    .sort()
    .join(',');

/** La séance a encore ses paires automatiques. */
export const pairesAutomatiques = (seance: Pick<SeanceDuMois, 'exercices' | 'liens'>): boolean =>
  empreinte(apparier(seance.exercices).paires) === empreinte(seance.liens);

/** « Refaire les paires » : la séance retrouve ses paires automatiques. */
export function refairePaires(programme: ProgrammeMois, seanceId: string): ProgrammeMois {
  return {
    ...programme,
    seances: programme.seances.map((s) => (s.id === seanceId ? avecPairesAutomatiques(s) : s)),
  };
}

// ------------------------------------------------------------- Pour finir

/** Le dernier exercice de chaque séance, seul. Le lundi, une machine lourde
 *  pour les jambes : la presse ou le hack squat. Le mardi, la marche du
 *  fermier : un bon cardio (on peut aussi porter un sac de sable sur
 *  l'épaule). Le jeudi, jiu-jitsu le soir : le traîneau, pas de machine
 *  lourde. Jamais la trap bar, qui se fait fraîche, en tête du lundi. */
const FINALES: Record<Gabarit, string[]> = {
  dure: ['leg-press', 'hack-squat'],
  bas: ['traineau'],
  haut: ['farmers-walk', 'kb-farmers-walk'],
};
/** Sans les machines de la salle : la marche du fermier, tous les jours. */
const FINALES_SANS_MACHINE = ['farmers-walk', 'kb-farmers-walk'];

/** Un aller-retour de traîneau : pousser, puis tirer à reculons. */
const TRAINEAU_SEC = 30;
/** La marche du fermier, en fin de séance. */
const PORTAGE_SEC = 40;

/** Séries et répétitions du dernier exercice. Le traîneau se compte en
 *  allers-retours, un de plus que de séries : quatre chacun. */
function volumeFinale(exercice: Exercice, series: number, reps: number): { series: number; reps: number } {
  if (exercice.id === 'traineau') return { series: series + 1, reps: TRAINEAU_SEC };
  if (exercice.unite === 'secondes') return { series, reps: PORTAGE_SEC };
  return { series, reps };
}

// ------------------------------------------------------------- Échauffement et étirements

/** Cinq minutes de tapis ou de rameur pour commencer… */
const CARDIO: MouvementGuide = {
  nom: 'Tapis ou rameur',
  consigne: 'Rythme facile : on peut parler, le souffle monte un peu.',
  dureeSec: 5 * 60,
};

/** … puis quatre mouvements légers, choisis pour le jour : le lundi, un
 *  good morning à vide avant la trap bar ; le jeudi, un pont fessier, qui
 *  réveille les fesses avant le swing. */
const MOUVEMENT_SEC = 45;
const leger = (nom: string, consigne: string): MouvementGuide => ({ nom, consigne, dureeSec: MOUVEMENT_SEC });
const CERCLES_BRAS = leger('Cercles de bras', 'Petits puis grands, vers l’arrière puis vers l’avant.');
const BASSIN = leger('Rotations du bassin', 'Mains sur les hanches, grands cercles dans les deux sens.');
const SQUATS = leger('Squats à vide', 'Lents, aussi bas que le genou le permet, talons au sol, buste droit.');
const MOUVEMENTS_LEGERS: Record<Gabarit, MouvementGuide[]> = {
  dure: [CERCLES_BRAS, BASSIN, SQUATS, leger('Good morning à vide', 'Mains sur la nuque : on plie aux hanches, dos plat, genoux souples.')],
  bas: [
    BASSIN,
    leger('Balancements de jambe', 'Une main au mur : d’avant en arrière, puis de côté ; on change de jambe à mi-temps.'),
    SQUATS,
    leger('Pont fessier', 'Allongé sur le dos, genoux pliés : on monte le bassin en serrant les fessiers, puis on redescend lentement.'),
  ],
  haut: [
    CERCLES_BRAS,
    leger('Rotations du buste', 'Bras croisés, on tourne les épaules ; le bassin reste face à l’avant.'),
    leger('Chat-vache', 'À quatre pattes, arrondir puis creuser le dos en respirant.'),
    leger('Pompes contre le mur', 'Mains au mur, corps gainé, lentement.'),
  ],
};

/** Les étirements des jambes, à chaque fin de séance — le lundi, le mardi et
 *  le jeudi, semaines A et B —, les mêmes pour les deux : le mollet, l'avant de
 *  la cuisse, l'arrière de la cuisse et le fessier. Rien qui plie le genou en
 *  fente, rien en flexion avant debout, qui fatigue le bas du dos. Dans l'ordre
 *  qui change le moins de position : debout, sur le côté, puis sur le dos. */
const ETIREMENTS_JAMBES = ['etir-mollet-mur', 'etir-quadriceps-cote', 'etir-ischios-allonge', 'etir-fessier-chiffre-4'];
/** Cinq étirements du poster pour finir, une minute chacun — trente secondes
 *  de chaque côté, ils se font tous d'un côté : cinq minutes. Les quatre des
 *  jambes d'abord, puis la torsion allongée, qui prend la place qui reste. */
const ETIREMENTS_DE_FIN = [...ETIREMENTS_JAMBES, 'etir-torsion-allongee'];
const ETIREMENT_SEC = 60;

/** L'échauffement d'une séance du programme : le cardio, puis les
 *  mouvements légers du jour. */
export function echauffementDe(seance: SeanceAGabarit): MouvementGuide[] {
  return [CARDIO, ...MOUVEMENTS_LEGERS[gabaritDe(seance)]];
}

/** Les étirements de fin d'une séance du programme, avec leur image : les
 *  mêmes à chaque séance, les jambes toujours. Un étirement d'un côté se fait en
 *  deux temps, droit puis gauche. */
export function etirementsDe(): MouvementGuide[] {
  return ETIREMENTS_DE_FIN.filter(estConnu).flatMap((id) => {
    const etirement = EXERCICES_PAR_ID[id];
    const consigne = etirement.pointsAttention[0] ?? '';
    if (etirement.cotes !== 'unilateral') {
      return [{ nom: etirement.nomFr, consigne, dureeSec: ETIREMENT_SEC, exerciceId: id }];
    }
    return (['droit', 'gauche'] as const).map((cote) => ({
      nom: `${etirement.nomFr} · côté ${cote}`,
      consigne,
      dureeSec: ETIREMENT_SEC / 2,
      exerciceId: id,
    }));
  });
}

const dureeDes = (mouvements: MouvementGuide[]) =>
  mouvements.reduce((total, mouvement) => total + (mouvement.dureeSec ?? 0), 0);

// ------------------------------------------------------------- Le programme

export interface OptionsProgramme {
  objectifs?: string[];
  materiels?: Materiel[];
  /** Les trois jours changent d'une semaine à l'autre (six séances, semaines
   *  A et B) ou non (trois séances). */
  alternance?: boolean;
  graine?: number;
  aujourdhui?: Date;
  /** Le nombre d'exercices du mardi et du jeudi, sans le dernier : 4, 6 ou
   *  8 ; six par défaut. Le lundi en a deux de plus. */
  exercices?: number;
}

/** Un nombre d'exercices qu'on peut choisir, ou rien. */
const nombreValide = (nombre: unknown): number | undefined =>
  typeof nombre === 'number' && NOMBRES_EXERCICES.includes(nombre) ? nombre : undefined;

/** Réglages complets pour mesurer une séance : le tempo du programme, 4 s /
 *  4 s et 2 s en bas. */
const parametresMesure: ParametresSeance = {
  dureeMinutes: DUREE_REFERENCE_MIN,
  zones: ['bas', 'haut', 'dos', 'gainage', 'complet'],
  niveau: 'intermediaire',
  discipline: 'musculation',
  format: 'series',
  tempo: { ...TEMPO_PROGRAMME },
  materiels: ['halteres'],
  explosifs: false,
  seriesParExercice: 3,
  repsParSerie: 8,
  guideVisuel: 'les-deux',
};

/** On mesure une séance à deux, aux répétitions du jour. */
const MESURE: ContexteSeance = { personne: 'sebastien', aDeux: true };

export function genererProgramme(options: OptionsProgramme = {}): ProgrammeMois {
  const objectifs = options.objectifs ?? OBJECTIFS_PAR_DEFAUT;
  const materiels = options.materiels ?? MATERIELS_PROGRAMME;
  const alternance = options.alternance ?? true;
  const nombre = nombreValide(options.exercices) ?? EXERCICES_PAR_DEFAUT;
  const graine = (options.graine ?? Date.now()) >>> 0;
  const alea = aleatoire(graine);
  const candidats = candidatsProgramme(materiels);
  // Le swing du jeudi : le seul mouvement explosif du programme, s'il y a des
  // kettlebells.
  const swing = materiels.includes(EXERCICES_PAR_ID[SWING_DU_JEUDI].materiel) ? [EXERCICES_PAR_ID[SWING_DU_JEUDI]] : [];
  const dejaPris = new Set<string>();

  /** Les exercices d'une séance, deux par deux, jusqu'au nombre du jour : les
   *  objectifs d'abord — le lundi, la trap bar en tête ; le jeudi, le swing.
   *  Chaque place prend son exercice, puis lui cherche un partenaire qui s'y
   *  oppose : dans les places qu'elle suggère, puis dans les suivantes. Sans
   *  partenaire possible, la place est laissée — sauf celle du swing, qui se
   *  fait alors seul. */
  const composer = (gabarit: Gabarit, interdits: Exercice[] = []): Exercice[] => {
    const voulus = nombre + (gabarit === 'dure' ? EXERCICES_EN_PLUS_LUNDI : 0);
    // Le mardi, jiu-jitsu le soir : rien qui charge le bas du dos ; le jeudi,
    // les jambes, et le swing.
    const duJour = [...candidats, ...(gabarit === 'bas' ? swing : [])].filter(DANS_LE_JOUR[gabarit]);
    const bonsAvec = (exercice: Exercice) => duJour.filter((e) => accordPaire(exercice, e).accord === 'bon');
    const places = emplacementsDe(gabarit, objectifs, materiels);
    const reserves = new Set(
      places.flatMap((p) => p.favoris ?? []).filter(estConnu).map((id) => cleMouvement(EXERCICES_PAR_ID[id])),
    );
    /** Les exercices pris, et la place de chacun : la séance suit l'ordre
     *  des places — les objectifs d'abord. */
    const pris: { exercice: Exercice; place: number }[] = [];
    // Au plus un exercice sur trois qui charge le bas du dos, et jamais deux
    // dans une paire.
    const quotaDos = gabarit === 'dure' ? 3 : Math.ceil(voulus / 3);

    /** Remplit ces places deux par deux, sans les mouvements exclus. */
    const remplir = (restantes: Emplacement[], exclus: Set<string>) => {
      const preferences = (sans?: Exercice): Preferences => {
        const tropDeDos = pris.filter((p) => chargeLeBasDuDos(p.exercice)).length >= quotaDos;
        return {
          exclus: sans ? new Set([...exclus, cleMouvement(sans)]) : exclus,
          reserves,
          dejaPris,
          // Les mouvements à deux mains ou en alternant d'abord : une série
          // d'un seul côté coûte deux fois le temps — et le lundi, à deux
          // mains, on charge plus lourd.
          repousser: (e) => (tropDeDos && chargeLeBasDuDos(e)) || e.cotes === 'unilateral',
        };
      };
      const prendre = (exercice: Exercice, place: Emplacement) => {
        pris.push({ exercice, place: places.indexOf(place) });
        exclus.add(cleMouvement(exercice));
        dejaPris.add(cleMouvement(exercice));
      };
      /** Les places où chercher le partenaire : celles que la place suggère
       *  d'abord, puis les autres, dans l'ordre. Une place de favoris ne prête
       *  son exercice qu'aux places qu'elle désigne : les deux machines des
       *  cuisses restent ensemble. */
      const ouChercher = (emplacement: Emplacement) => {
        const suggerees = emplacement.avec ?? [];
        const rang = (place: Emplacement) =>
          suggerees.includes(place.cle) ? suggerees.indexOf(place.cle) : suggerees.length;
        return restantes
          .filter((place) => !place.favoris || (place.avec ?? []).includes(emplacement.cle))
          .sort((a, b) => rang(a) - rang(b));
      };
      while (pris.length + 2 <= voulus && restantes.length > 0) {
        const emplacement = restantes.shift()!;
        // Un exercice n'entre que s'il a un partenaire possible — sauf le
        // swing, qui se fait seul s'il le faut.
        const aUnPartenaire = (premier: Exercice) =>
          ouChercher(emplacement).some((place) => classer(place, bonsAvec(premier), preferences(premier), { strict: true }).length > 0);
        const premier =
          choisir(emplacement, duJour, preferences(), alea, { admis: aUnPartenaire }) ??
          (emplacement.seulSiBesoin ? choisir(emplacement, duJour, preferences(), alea) : null);
        if (!premier) continue;
        let apparie = false;
        for (const place of ouChercher(emplacement)) {
          const second = choisir(place, bonsAvec(premier), preferences(premier), alea, { strict: true });
          if (!second) continue;
          prendre(premier, emplacement);
          prendre(second, place);
          restantes.splice(restantes.indexOf(place), 1);
          apparie = true;
          break;
        }
        if (!apparie && emplacement.seulSiBesoin) prendre(premier, emplacement);
      }
    };

    // La semaine B prend d'autres exercices que la semaine A — sauf ceux qui
    // visent un muscle à peine servi (`reprise`), quand elle n'en trouve pas
    // d'autre, et les favoris du duo (`favoris` : la trap bar et le Superman
    // du lundi, le swing, la planche de Copenhague et les deux machines des
    // cuisses du jeudi), qui reviennent chaque semaine.
    const reprenable = (e: Exercice) =>
      places.some((p) => (p.reprise && p.principal && viseLePrincipal(e, p.principal)) || p.favoris?.includes(e.id));
    remplir([...places], new Set(interdits.filter((e) => !reprenable(e)).map(cleMouvement)));
    // Quand il n'en reste plus assez pour faire des paires, elle en reprend
    // quelques-uns de plus.
    if (pris.length + 2 <= voulus && interdits.length > 0) {
      const libres = places.filter((_, i) => !pris.some((p) => p.place === i));
      remplir(libres, new Set(pris.map((p) => cleMouvement(p.exercice))));
    }
    return pris.sort((a, b) => a.place - b.place).map((p) => p.exercice);
  };

  /** Le dernier exercice : hors des mouvements de la séance, et pas déjà le
   *  dernier d'une autre séance quand on a le choix. */
  const finaleDe = (gabarit: Gabarit, exercices: Exercice[]): Exercice | undefined => {
    const dansLaSeance = new Set(exercices.map(cleMouvement));
    const possibles = (ids: string[]) =>
      ids
        .filter(estConnu)
        .map((id) => EXERCICES_PAR_ID[id])
        .filter((e) => candidats.includes(e) && !dansLaSeance.has(cleMouvement(e)));
    const pool = possibles(FINALES[gabarit]).length > 0 ? possibles(FINALES[gabarit]) : possibles(FINALES_SANS_MACHINE);
    if (pool.length === 0) return undefined;
    const nouvelles = pool.filter((e) => !dejaPris.has(cleMouvement(e)));
    const choix = nouvelles.length > 0 ? nouvelles : pool;
    const retenue = choix[Math.floor(alea() * choix.length)];
    dejaPris.add(cleMouvement(retenue));
    return retenue;
  };

  /** Une séance du programme : ses exercices par paires, puis le dernier,
   *  seul. Les machines se font chacun son tour, une pour deux — dans une
   *  paire, on se croise. */
  const seanceDe = (
    entete: Pick<SeanceDuMois, 'id' | 'nom' | 'jour' | 'semaine' | 'type' | 'partie'>,
    gabarit: Gabarit,
    exercices: Exercice[],
  ): SeanceDuMois => {
    const finale = finaleDe(gabarit, exercices);
    const avec = (ids: string[]): SeanceDuMois => {
      const tour = [...ids, ...(finale ? [finale.id] : [])].filter((id) => EXERCICES_PAR_ID[id].materiel === 'salle');
      return avecPairesAutomatiques(
        rangee({
          ...entete,
          format: 'series',
          exercices: ids,
          ...(finale ? { finale: finale.id } : {}),
          ...(tour.length > 0 ? { tour } : {}),
        }),
      );
    };
    // Le garde-fou : au-delà de deux heures et demie, la séance perd ses
    // dernières paires — jamais la première, celle de la trap bar le lundi.
    let seance = avec(exercices.map((e) => e.id));
    while ((seance.liens ?? []).length > 2 && dureeSec(seance) > DUREE_MAXI_SEC) {
      const derniere = seance.liens!.at(-1)!;
      seance = avec(seance.exercices.filter((id) => !derniere.includes(id)));
    }
    return seance;
  };

  /** Les trois jours : le lundi, tout le corps, la grosse séance ; le mardi,
   *  le haut ; le jeudi, les jambes. */
  const JOURS_DU_PROGRAMME: {
    gabarit: Gabarit;
    entete: (semaine: 'A' | 'B' | undefined) => Pick<SeanceDuMois, 'id' | 'nom' | 'jour' | 'semaine' | 'type' | 'partie'>;
  }[] = [
    { gabarit: 'dure', entete: (semaine) => enteteDe('lundi', 'tout le corps', 1, semaine, 'dure', 'complet') },
    { gabarit: 'haut', entete: (semaine) => enteteDe('mardi', 'le haut', 2, semaine, 'facile', 'haut') },
    { gabarit: 'bas', entete: (semaine) => enteteDe('jeudi', 'les jambes', 4, semaine, 'facile', 'bas') },
  ];
  // Le lundi d'abord : c'est la grosse séance ; les autres prennent d'autres
  // exercices. Puis la semaine B, si les jours alternent.
  const semaineA = JOURS_DU_PROGRAMME.map((j) => composer(j.gabarit));
  const semaineB = alternance ? JOURS_DU_PROGRAMME.map((j, i) => composer(j.gabarit, semaineA[i])) : [];
  const seances: SeanceDuMois[] = [
    ...JOURS_DU_PROGRAMME.map((j, i) => seanceDe(j.entete(alternance ? 'A' : undefined), j.gabarit, semaineA[i])),
    ...semaineB.map((exercices, i) => seanceDe(JOURS_DU_PROGRAMME[i].entete('B'), JOURS_DU_PROGRAMME[i].gabarit, exercices)),
  ];

  return {
    debut: isoDate(premiereSemaine(options.aujourdhui ?? new Date(), seances)),
    objectifs: [...objectifs],
    materiels: [...materiels],
    graine,
    seances,
    version: VERSION_PROGRAMME,
    // Un autre nombre que celui par défaut est retenu : une recomposition
    // le reprend.
    ...(nombre !== EXERCICES_PAR_DEFAUT ? { duo: { exercices: nombre } } : {}),
  };
}

/** L'en-tête d'une séance : « lundi-a », « Lundi A — tout le corps ». */
function enteteDe(
  jourNom: string,
  partieNom: string,
  jour: number,
  semaine: 'A' | 'B' | undefined,
  type: SeanceDuMois['type'],
  partie: NonNullable<SeanceDuMois['partie']>,
): Pick<SeanceDuMois, 'id' | 'nom' | 'jour' | 'semaine' | 'type' | 'partie'> {
  const titre = jourNom.charAt(0).toUpperCase() + jourNom.slice(1);
  return {
    id: semaine ? `${jourNom}-${semaine.toLowerCase()}` : jourNom,
    nom: `${titre}${semaine ? ` ${semaine}` : ''} — ${partieNom}`,
    jour,
    ...(semaine ? { semaine } : {}),
    type,
    partie,
  };
}

/** La séance, ses champs toujours dans le même ordre : les deux téléphones
 *  comparent leurs séances telles quelles. */
function rangee(seance: SeanceDuMois): SeanceDuMois {
  return {
    id: seance.id,
    nom: seance.nom,
    jour: seance.jour,
    ...(seance.semaine ? { semaine: seance.semaine } : {}),
    type: seance.type,
    ...(seance.partie ? { partie: seance.partie } : {}),
    format: 'series',
    exercices: seance.exercices,
    ...(seance.finale ? { finale: seance.finale } : {}),
    ...(seance.liens && seance.liens.length > 0 ? { liens: seance.liens } : {}),
    ...(seance.tour && seance.tour.length > 0 ? { tour: seance.tour } : {}),
  };
}

/** Le même programme, recomposé avec la même graine, les mêmes objectifs et
 *  le même premier lundi : les deux téléphones retombent sur les mêmes
 *  séances. Les réglages du duo, le code d'équipe et le serveur restent. */
function recomposer(programme: ProgrammeMois): ProgrammeMois {
  const recompose = genererProgramme({
    objectifs: programme.objectifs,
    materiels: [...new Set<Materiel>([...programme.materiels, ...MATERIELS_PROGRAMME])],
    graine: programme.graine,
    alternance: programme.seances.some((s) => s.semaine !== undefined),
    aujourdhui: depuisIso(programme.debut),
    exercices: nombreExercicesDe(programme),
  });
  return {
    ...recompose,
    ...(programme.duo ? { duo: programme.duo } : {}),
    ...(programme.equipe ? { equipe: programme.equipe } : {}),
    ...(programme.serveur ? { serveur: programme.serveur } : {}),
  };
}

/** Le programme a été retouché à la main : un exercice changé, une paire
 *  refaite, chacun son tour basculé. Le recomposer perdrait ces retouches. */
export const estRetouche = (programme: ProgrammeMois): boolean =>
  JSON.stringify(recomposer(programme).seances) !== JSON.stringify(programme.seances.map(rangee));

/** Un autre nombre d'exercices : les séances sont recomposées avec la même
 *  graine — les deux téléphones retombent sur les mêmes. */
export function avecNombreExercices(programme: ProgrammeMois, nombre: number): ProgrammeMois {
  return recomposer({ ...programme, duo: { ...programme.duo, exercices: nombreValide(nombre) ?? EXERCICES_PAR_DEFAUT } });
}

/** Un autre tempo pour les séances du programme : les mêmes exercices, une
 *  autre durée. */
export function avecTempo(programme: ProgrammeMois, tempo: Tempo): ProgrammeMois {
  return { ...programme, duo: { ...programme.duo, tempo: { ...tempo } } };
}

// ------------------------------------------------------------- La séance de chacun

/** Ce qui fait la séance du jour, au-delà des réglages du téléphone. */
export interface ContexteSeance {
  /** Qui s'entraîne sur ce téléphone ; absent, les réglages du téléphone. */
  personne?: Personne | null;
  /** À deux : une horloge commune avec l'autre. */
  aDeux?: boolean;
  /** Les répétitions de chacun pour cette séance (`repsDuJour`) ; absentes,
   *  celles d'usage pour ce jour-là. */
  reps?: Partial<Record<Personne, number>>;
  /** Le tempo du programme, le même sur les deux téléphones ; absent, celui
   *  des réglages du téléphone. */
  tempo?: Tempo;
  /** Exercices dont le ressenti demande un changement de charge : léger
   *  assez de fois de suite, un cran de plus ; lourd deux fois de suite, un
   *  cran de moins (`ressentisQuiChangent`). */
  ressentis?: Record<string, 'leger' | 'lourd'>;
}

const PATTERNS_POUSSEE: PatternMoteur[] = ['poussee-horizontale', 'poussee-verticale'];
const GROUPES_POUSSEE: string[] = ['pectoraux', 'epaules', 'triceps'];

/** Un exercice de poussée : développés, pompes, et l'isolation des
 *  pectoraux, des épaules et des triceps. Un oiseau, qui tire, n'en est pas. */
export function estPoussee(exercice: Exercice): boolean {
  if (PATTERNS_POUSSEE.includes(exercice.pattern)) return true;
  if (exercice.pattern === 'tirage-horizontal' || exercice.pattern === 'tirage-vertical') return false;
  return GROUPES_POUSSEE.includes(exercice.groupe);
}

/** Petit muscle, petite pause : isolation, tronc, mollets. */
const estPetitMuscle = (exercice: Exercice) =>
  exercice.pattern === 'isolation' || TRONC.includes(exercice.pattern) || exercice.groupe === 'mollets';

/** Le repos après une série d'un exercice fait seul : deux minutes à la trap
 *  bar le lundi, une minute trente aux gros exercices, une minute aux petits
 *  muscles. */
export function reposDe(exercice: Exercice, seance: Pick<SeanceDuMois, 'type'>): number {
  if (exercice.id === 'trap-bar-deadlift' && seance.type === 'dure') return REPOS_TRAP_BAR_SEC;
  return estPetitMuscle(exercice) ? REPOS_PETITS_SEC : REPOS_SEC;
}

/** La pause après une paire : une minute, et une minute trente après la
 *  paire de la trap bar. */
export const reposDePaire = (paire: string[]): number =>
  paire.includes('trap-bar-deadlift') ? REPOS_PAIRE_TRAP_BAR_SEC : REPOS_PAIRE_SEC;

/** Un soulevé de terre lourd : debout, à deux mains, une charnière qui charge
 *  le bas du dos — la trap bar, le soulevé de terre roumain ou au
 *  kettlebell, le good morning. Pas le pont fessier ni le Superman,
 *  allongés, ni un soulevé sur une jambe, plus léger. */
export const estSouleveLourd = (exercice: Exercice): boolean =>
  exercice.pattern === 'charniere' &&
  exercice.cotes === 'bilateral' &&
  !exercice.explosif &&
  chargeLeBasDuDos(exercice) &&
  /^debout/i.test(exercice.position);

/** Les répétitions d'une personne à un exercice : celles du jour, sauf aux
 *  soulevés de terre lourds pour qui a le dos à ménager — Speedy, 8 au plus
 *  (`REPS_MAX_SOULEVE`). */
export function repsA(personne: Personne, exercice: Exercice, reps: number): number {
  const plafond = PROFILS[personne].repsMaxSouleve;
  return plafond !== undefined && estSouleveLourd(exercice) ? Math.min(reps, plafond) : reps;
}

/** Ce que l'accueil écrit quand un soulevé lourd plafonne les répétitions de
 *  quelqu'un ce jour-là : « Speedy : 8 à la trap bar, 10 ailleurs — pour le
 *  bas du dos. » Rien quand personne n'est plafonné (le mardi, le jeudi :
 *  Speedy en fait déjà 8). */
export function notePlafond(
  seance: Pick<SeanceDuMois, 'exercices' | 'finale'>,
  reps: Record<Personne, number>,
): string | null {
  const souleve = [...seance.exercices, ...(seance.finale ? [seance.finale] : [])]
    .filter(estConnu)
    .map((id) => EXERCICES_PAR_ID[id])
    .find(estSouleveLourd);
  if (!souleve) return null;
  const ou =
    souleve.id === 'trap-bar-deadlift'
      ? 'à la trap bar'
      : `au ${souleve.nomFr.charAt(0).toLowerCase()}${souleve.nomFr.slice(1)}`;
  const notes = PERSONNES.filter((p) => repsA(p.id, souleve, reps[p.id]) < reps[p.id]).map(
    (p) => `${NOM_PERSONNE[p.id]} : ${repsA(p.id, souleve, reps[p.id])} ${ou}, ${reps[p.id]} ailleurs — pour le bas du dos.`,
  );
  return notes.length > 0 ? notes.join(' ') : null;
}

/** La charge s'y règle d'une fois sur l'autre, au ressenti. Les exercices en
 *  répétitions, les cercles au kettlebell et les mouvements explosifs — faits
 *  au temps, mais la cloche ou l'haltère reste une charge qu'on monte ou qu'on
 *  baisse, comme avant. Pas les portages, le traîneau ni les tenues : là,
 *  c'est le temps qui compte ; ni le poids du corps, sur le tapis ou sans
 *  matériel (le Superman sans poids) : rien à charger. */
export const chargeReglable = (exercice: Exercice): boolean =>
  exercice.materiel !== 'tapis' &&
  exercice.materiel !== 'aucun' &&
  (exercice.unite === 'reps' || exercice.mouvement === 'circulaire' || exercice.explosif === true);

/** La séance du programme, mise aux réglages de la personne : c'est elle que
 *  déroule la séance guidée — tapis ou rameur, bille, répétitions comptées,
 *  charges notées, étirements. À deux, chaque exercice porte aussi le volume
 *  de l'autre : les deux téléphones en tirent la même horloge. */
export function seancePourPersonne(
  seanceMois: SeanceDuMois,
  parametres: ParametresSeance,
  contexte: ContexteSeance = {},
  maintenant: Date = new Date(),
): Seance {
  const moi = contexte.personne ?? null;
  const partenaire = moi && contexte.aDeux ? autrePersonne(moi) : null;
  const enTour = new Set(seanceMois.tour ?? []);
  const ressentis = contexte.ressentis ?? {};
  const cran = CRAN[uniteDeSeance(parametres)];
  // Les répétitions du jour : le lundi, Speedy en fait autant que Big Max.
  const repsDeChacun = { ...repsDuJour({}, seanceMois.jour), ...contexte.reps };

  /** Séries et répétitions d'une personne sur un exercice. */
  const volumeDe = (qui: Personne | null, exercice: Exercice, finale: boolean) => {
    const series = SERIES_PROGRAMME + (qui && PROFILS[qui].seriePlusPoussee && estPoussee(exercice) ? 1 : 0);
    // Speedy : 8 au plus aux soulevés de terre lourds, même le lundi.
    const habituelles = qui
      ? repsA(qui, exercice, repsDeChacun[qui])
      : (parametres.repsParSerie ?? REPS_PAR_DEFAUT.sebastien);
    // Au temps, le même temps pour les deux : les répétitions de chacun ne
    // valent qu'en répétitions.
    const reps = exercice.unite === 'secondes' ? secondesAuTemps(exercice, TENUE_SEC) : habituelles;
    return finale ? volumeFinale(exercice, series, reps) : { series, reps };
  };

  const blocDe = (exercice: Exercice, finale: boolean): BlocSeries => {
    const mien = volumeDe(moi, exercice, finale);
    const charge = chargeReglable(exercice);
    return {
      exerciceId: exercice.id,
      series: mien.series,
      reps: mien.reps,
      reposSec: reposDe(exercice, seanceMois),
      ...(enTour.has(exercice.id) ? { tour: true } : {}),
      ...(partenaire ? { autre: volumeDe(partenaire, exercice, finale) } : {}),
      ...(charge && Object.prototype.hasOwnProperty.call(ressentis, exercice.id)
        ? { ajustementRessenti: ressentis[exercice.id] === 'leger' ? cran : -cran }
        : {}),
    };
  };

  // Les deux exercices d'une paire s'enchaînent sans pause ; la pause vient
  // après la paire : une minute, une minute trente avec la trap bar. Un
  // exercice hors paire se fait seul, avec ses pauses.
  const paires = seanceMois.liens ?? [];
  const blocs: BlocSeries[] = seanceMois.exercices.filter(estConnu).map((id) => {
    const bloc = blocDe(EXERCICES_PAR_ID[id], false);
    const paire = paires.findIndex((groupe) => groupe.includes(id));
    if (paire < 0) return bloc;
    return {
      ...bloc,
      superset: paire,
      transitionSec: TRANSITION_LIEN_SEC,
      reposSec: reposDePaire(paires[paire]),
    };
  });
  // Pour finir, seul, en séries.
  if (estConnu(seanceMois.finale)) blocs.push(blocDe(EXERCICES_PAR_ID[seanceMois.finale], true));

  const echauffement = echauffementDe(seanceMois);
  const retourCalme = etirementsDe();
  const seance: Seance = {
    id: `${seanceMois.id}-${maintenant.getTime().toString(36)}`,
    creeLe: maintenant.toISOString(),
    titre: seanceMois.nom,
    parametres: {
      ...parametres,
      discipline: 'musculation',
      dureeMinutes: DUREE_REFERENCE_MIN,
      // Par paires : deux exercices en alternance, comme un superset.
      format: paires.length > 0 ? 'superset' : 'series',
      ...(paires.length > 0 ? { tailleRotation: 2 as const } : {}),
      seriesParExercice: SERIES_PROGRAMME,
      // Le tempo du programme : le même sur les deux téléphones.
      tempo: { ...(contexte.tempo ?? parametres.tempo) },
    },
    graine: 0,
    echauffementSec: dureeDes(echauffement),
    retourCalmeSec: dureeDes(retourCalme),
    echauffement,
    retourCalme,
    // Chaque nouvel exercice attend « Go » ; à deux, l'horloge est commune.
    horloge: {
      ...(moi ? { personne: moi } : {}),
      ...(partenaire ? { partenaire: NOM_PERSONNE[partenaire], jeCommence: moi === COMMENCE } : {}),
    },
    blocs,
    circuit: null,
    dureeEstimeeSec: 0,
  };
  seance.dureeEstimeeSec = dureeTotaleSec(construireEtapes(seance));
  return seance;
}

/** Durée d'une séance du programme : à deux, aux répétitions du jour, sauf
 *  contexte donné. */
export function dureeSec(
  seanceMois: SeanceDuMois,
  parametres: Partial<ParametresSeance> = {},
  contexte: ContexteSeance = MESURE,
): number {
  return seancePourPersonne(seanceMois, { ...parametresMesure, ...parametres }, contexte, new Date(0)).dureeEstimeeSec;
}

// ------------------------------------------------------------- Le calendrier

const JOUR_MS = 24 * 60 * 60 * 1000;
export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Le lundi de la semaine d'une date, à minuit. */
export function lundiDe(date: Date): Date {
  const jour = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  jour.setDate(jour.getDate() - ((jour.getDay() + 6) % 7));
  return jour;
}

const deux = (n: number) => String(n).padStart(2, '0');
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

/** La date d'un « AAAA-MM-JJ », à minuit, heure locale. */
export function depuisIso(iso: string): Date {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

/** Le lundi de la semaine A : celui de cette semaine, ou le prochain quand
 *  plus aucune séance ne reste cette semaine (du vendredi au dimanche). */
function premiereSemaine(aujourdhui: Date, seances: SeanceDuMois[]): Date {
  const lundi = lundiDe(aujourdhui);
  const rang = (jour: number) => (jour + 6) % 7; // 0 = lundi … 6 = dimanche
  const resteUneSeance = seances.some((s) => rang(s.jour) >= rang(aujourdhui.getDay()));
  return resteUneSeance ? lundi : new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 7);
}

/** Semaines écoulées depuis le début du programme (0 la première). */
export function semainesEcoulees(programme: Pick<ProgrammeMois, 'debut'>, date: Date): number {
  // Arrondi : un changement d'heure fait des semaines de 167 ou 169 heures.
  return Math.round((lundiDe(date).getTime() - depuisIso(programme.debut).getTime()) / (7 * JOUR_MS));
}

export function semaineDe(programme: Pick<ProgrammeMois, 'debut'>, date: Date): 'A' | 'B' {
  const n = semainesEcoulees(programme, date);
  return ((n % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

export interface SeancePrevue {
  seance: SeanceDuMois;
  date: Date;
  /** 0 = aujourd'hui. */
  dansJours: number;
}

/** La séance d'aujourd'hui, ou la prochaine prévue. */
export function prochaineSeance(programme: ProgrammeMois, date: Date): SeancePrevue | null {
  for (let i = 0; i < 14; i += 1) {
    const jour = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i);
    const semaine = semaineDe(programme, jour);
    const seance = programme.seances.find(
      (s) => s.jour === jour.getDay() && (s.semaine === undefined || s.semaine === semaine),
    );
    if (seance) return { seance, date: jour, dansJours: i };
  }
  return null;
}

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** La séance du programme a été faite (même en partie) ce jour-là. */
export function faiteLe(
  historique: SeanceRealisee[],
  seance: Pick<SeanceDuMois, 'nom'>,
  date: Date,
): boolean {
  return historique.some((h) => h.titre === seance.nom && memeJour(new Date(h.date), date));
}

/** La séance du programme a été faite pendant la semaine de cette date, du
 *  lundi au dimanche. */
export function faiteCetteSemaine(
  historique: SeanceRealisee[],
  seance: Pick<SeanceDuMois, 'nom'>,
  date: Date,
): boolean {
  const lundi = lundiDe(date);
  const debut = lundi.getTime();
  const fin = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 7).getTime();
  return historique.some((h) => {
    const quand = new Date(h.date).getTime();
    return h.titre === seance.nom && quand >= debut && quand < fin;
  });
}

/** La séance qu'on montre en ouvrant l'application : celle d'aujourd'hui
 *  tant qu'elle n'est pas faite, sinon la suivante. */
export function seanceAProposer(
  programme: ProgrammeMois,
  historique: SeanceRealisee[],
  maintenant: Date,
): SeancePrevue | null {
  const prevue = prochaineSeance(programme, maintenant);
  if (!prevue || prevue.dansJours > 0 || !faiteLe(historique, prevue.seance, maintenant)) return prevue;
  const demain = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + 1);
  const suivante = prochaineSeance(programme, demain);
  return suivante && { ...suivante, dansJours: suivante.dansJours + 1 };
}

/** Le prochain jour où revient cette séance, aujourd'hui compris. */
export function prochaineDate(
  programme: Pick<ProgrammeMois, 'debut'>,
  seance: Pick<SeanceDuMois, 'jour' | 'semaine'>,
  depuis: Date,
): Date {
  for (let i = 0; i < 14; i += 1) {
    const jour = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate() + i);
    const bonneSemaine = seance.semaine === undefined || semaineDe(programme, jour) === seance.semaine;
    if (jour.getDay() === seance.jour && bonneSemaine) return jour;
  }
  return depuis;
}

// ------------------------------------------------------------- Changer un exercice

/** Tous les exercices d'une séance, le dernier compris. */
const idsDe = (seance: SeanceDuMois) => [...seance.exercices, ...(seance.finale ? [seance.finale] : [])];

/** Les remplaçants d'un exercice : ceux qui travaillent les mêmes muscles,
 *  hors de ceux déjà dans la séance. Le même schéma de mouvement d'abord, et
 *  ce qu'on ne fait pas déjà un autre jour avant ce qui revient. Le dernier
 *  exercice, lui, se remplace par une autre fin de séance pour les jambes. */
export function alternatives(
  programme: ProgrammeMois,
  seanceId: string,
  exerciceId: string,
  maxi = 12,
): Exercice[] {
  const actuel = estConnu(exerciceId) ? EXERCICES_PAR_ID[exerciceId] : undefined;
  const seance = programme.seances.find((s) => s.id === seanceId);
  if (!actuel || !seance) return [];
  const mouvementsDe = (ids: string[]) =>
    new Set(ids.filter(estConnu).map((id) => cleMouvement(EXERCICES_PAR_ID[id])));
  const pris = mouvementsDe(idsDe(seance));
  const ailleurs = mouvementsDe(programme.seances.flatMap(idsDe));
  const libres = candidatsProgramme(programme.materiels).filter((e) => !pris.has(cleMouvement(e)));
  const nouveautesDAbord = (a: Exercice, b: Exercice) =>
    Number(ailleurs.has(cleMouvement(a))) - Number(ailleurs.has(cleMouvement(b)));

  if (exerciceId === seance.finale) {
    const finales = new Set(Object.values(FINALES).flat());
    return libres.filter((e) => finales.has(e.id)).sort(nouveautesDAbord).slice(0, maxi);
  }
  const muscles = (actuel.musclesPrincipaux ?? []).length > 0 ? actuel.musclesPrincipaux! : musclesDe(actuel);
  const rang = (e: Exercice) => (e.pattern === actuel.pattern ? 0 : 2) + (ailleurs.has(cleMouvement(e)) ? 1 : 0);
  return exercicesPourMuscles(libres, muscles)
    .sort((a, b) => rang(a) - rang(b))
    .slice(0, maxi);
}

/** Change un exercice d'une séance. Le nouveau se fait chacun son tour s'il
 *  est sur machine, en même temps sinon. */
export function remplacerDansProgramme(
  programme: ProgrammeMois,
  seanceId: string,
  ancienId: string,
  nouveauId: string,
): ProgrammeMois {
  const surMachine = estConnu(nouveauId) && EXERCICES_PAR_ID[nouveauId].materiel === 'salle';
  return {
    ...programme,
    seances: programme.seances.map((s) => {
      if (s.id !== seanceId) return s;
      const remplacer = (id: string) => (id === ancienId ? nouveauId : id);
      const remplacee: SeanceDuMois = {
        ...s,
        exercices: s.exercices.map(remplacer),
        ...(s.finale === ancienId ? { finale: nouveauId } : {}),
        ...(s.liens ? { liens: s.liens.map((groupe) => groupe.map(remplacer)) } : {}),
      };
      const tour = [...(s.tour ?? []).filter((id) => id !== ancienId), ...(surMachine ? [nouveauId] : [])];
      if (tour.length > 0) remplacee.tour = tour;
      else delete remplacee.tour;
      return remplacee;
    }),
  };
}

/** Passe un exercice de « en même temps » à « chacun son tour », ou
 *  l'inverse : la durée de la séance suit. */
export function basculerTour(programme: ProgrammeMois, seanceId: string, exerciceId: string): ProgrammeMois {
  return {
    ...programme,
    seances: programme.seances.map((s) => {
      if (s.id !== seanceId) return s;
      const dejaEnTour = (s.tour ?? []).includes(exerciceId);
      const tour = dejaEnTour ? (s.tour ?? []).filter((id) => id !== exerciceId) : [...(s.tour ?? []), exerciceId];
      const basculee: SeanceDuMois = { ...s, tour };
      if (tour.length === 0) delete basculee.tour;
      return basculee;
    }),
  };
}

// ------------------------------------------------------------- Les paires, à la main

/** Met deux exercices libres en paire : ils s'enchaînent sans pause, la
 *  pause vient après la paire. Le second de la séance vient se placer juste
 *  après le premier — la trap bar reste en tête. Un exercice déjà en paire,
 *  ou le dernier pour les jambes, n'entre pas dans une autre. */
export function lierDansProgramme(
  programme: ProgrammeMois,
  seanceId: string,
  unId: string,
  autreId: string,
): ProgrammeMois {
  return {
    ...programme,
    seances: programme.seances.map((s) => {
      if (s.id !== seanceId || unId === autreId) return s;
      const liens = s.liens ?? [];
      const libre = (id: string) => s.exercices.includes(id) && !liens.some((groupe) => groupe.includes(id));
      if (!libre(unId) || !libre(autreId)) return s;
      const [premier, second] =
        s.exercices.indexOf(unId) < s.exercices.indexOf(autreId) ? [unId, autreId] : [autreId, unId];
      const sans = s.exercices.filter((id) => id !== second);
      const place = sans.indexOf(premier) + 1;
      const exercices = [...sans.slice(0, place), second, ...sans.slice(place)];
      // Les paires dans l'ordre de la séance.
      const paires = [...liens, [premier, second]].sort((a, b) => exercices.indexOf(a[0]) - exercices.indexOf(b[0]));
      return rangee({ ...s, exercices, liens: paires });
    }),
  };
}

/** Sépare la paire d'un exercice : chacun se fait seul, avec ses pauses. */
export function delierDansProgramme(programme: ProgrammeMois, seanceId: string, exerciceId: string): ProgrammeMois {
  return {
    ...programme,
    seances: programme.seances.map((s) => {
      if (s.id !== seanceId || !s.liens) return s;
      return rangee({ ...s, liens: s.liens.filter((groupe) => !groupe.includes(exerciceId)) });
    }),
  };
}

// ------------------------------------------------------------- Les charges

/** Les charges de la dernière fois, par exercice, série par série : la séance
 *  la plus récente où l'exercice a été fait avec une charge notée, convertie
 *  dans l'unité courante. */
export function chargesPassees(
  historique: SeanceRealisee[],
  ids: string[],
  unite: UnitePoids,
): Record<string, number[]> {
  const resultat: Record<string, number[]> = {};
  for (const id of ids) {
    for (const realisee of historique) {
      const exo = realisee.exercices.find((e) => e.exerciceId === id);
      // Exercice passé sans une série : la charge pré-remplie n'a pas servi.
      if (!exo || exo.seriesFaites === 0) continue;
      const valeurs = exo.poidsParSerie && exo.poidsParSerie.length > 0 ? exo.poidsParSerie : [exo.poids ?? 0];
      if (!valeurs.some((v) => v > 0)) continue;
      const de = uniteDeSeance(realisee.parametres);
      resultat[id] = valeurs.map((v) => (v > 0 ? convertirPoids(v, de, unite) : 0));
      break;
    }
  }
  return resultat;
}

const derniereNotee = (charges: number[]) =>
  charges.reduce((derniere, charge) => (charge > 0 ? charge : derniere), 0);

/** La charge proposée pour une série d'une séance du programme : celle de
 *  `chargeProposee`, un cran de plus après assez de « léger » de suite, un
 *  cran de moins après deux « lourd » de suite. */
export function chargeDeSerie(
  bloc: Pick<BlocSeries, 'series' | 'ajustementRessenti'> | undefined,
  saisies: number[],
  passees: number[],
  serie: number,
): number {
  const deja = saisies[serie - 1] ?? 0;
  if (deja > 0) return deja;
  const ajout = ajustementDeCharge(bloc)?.ajout ?? 0;
  const reference = ajout !== 0 ? passees.map((charge) => (charge > 0 ? avecCran(charge, ajout) : 0)) : passees;
  return chargeProposee(saisies, reference, serie);
}

/** La charge proposée pour une série (numérotée à partir de 1) : celle déjà
 *  notée ; sinon celle de la série d'avant — au tempo lent, on la garde
 *  presque toujours ; sinon celle de la même série la dernière fois. */
export function chargeProposee(saisies: number[], passees: number[], serie: number): number {
  const deja = saisies[serie - 1] ?? 0;
  if (deja > 0) return deja;
  const precedente = derniereNotee(saisies.slice(0, serie - 1));
  if (precedente > 0) return precedente;
  const memeSerie = passees[serie - 1] ?? 0;
  return memeSerie > 0 ? memeSerie : derniereNotee(passees);
}

// ------------------------------------------------------------- Partage

const CLE_LIEN = 'programme';

function versBase64Url(texte: string): string {
  let binaire = '';
  for (const octet of new TextEncoder().encode(texte)) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(code: string): string {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
}

/** Les paires lisibles : deux exercices de la séance, côte à côte, chacun
 *  dans une seule paire. Le lien de partage note un exercice par sa place
 *  dans la liste reçue (`recus`). */
function lireLiens(brut: unknown[], recus: unknown[], exercices: string[]): string[][] {
  const pris = new Set<string>();
  const liens: string[][] = [];
  for (const groupe of brut) {
    if (!Array.isArray(groupe) || groupe.length !== 2) continue;
    const ids = groupe
      .map((id: unknown) => (typeof id === 'number' && Number.isInteger(id) ? recus[id] : id))
      .filter((id): id is string => estConnu(id) && exercices.includes(id) && !pris.has(id));
    if (ids.length !== groupe.length || new Set(ids).size !== ids.length) continue;
    const places = ids.map((id) => exercices.indexOf(id));
    if (!places.every((place, i) => i === 0 || place === places[i - 1] + 1)) continue;
    ids.forEach((id) => pris.add(id));
    liens.push(ids);
  }
  return liens;
}

/** Les réglages du duo qu'on peut lire : les répétitions, si les deux sont
 *  lisibles ; celles du lundi de Speedy ; un tempo de la liste ; un nombre
 *  d'exercices qu'on peut choisir. Un lien d'une version plus ancienne se lit
 *  pareil : ce qu'il n'a pas prend sa valeur par défaut, ce qu'on ne peut
 *  plus choisir (dix exercices) est écarté. */
function lireDuo(brut: unknown): ProgrammeMois['duo'] {
  const duo = brut as
    | { reps?: Partial<Record<Personne, unknown>>; repsLundi?: unknown; tempo?: unknown; exercices?: unknown }
    | null
    | undefined;
  const lire = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 30 ? n : null);
  const sebastien = lire(duo?.reps?.sebastien);
  const max = lire(duo?.reps?.max);
  const repsLundi = lire(duo?.repsLundi);
  const tempoLu = duo?.tempo;
  const tempo =
    typeof tempoLu === 'object' && tempoLu !== null
      ? TEMPOS.find((t) => memeTempo(t.tempo, tempoLu as Tempo))?.tempo
      : undefined;
  const exercices = nombreValide(duo?.exercices);
  const lu: ReglagesDuo = {
    ...(sebastien !== null && max !== null ? { reps: { sebastien, max } } : {}),
    ...(repsLundi !== null ? { repsLundi } : {}),
    ...(tempo ? { tempo: { ...tempo } } : {}),
    ...(exercices ? { exercices } : {}),
  };
  return Object.keys(lu).length > 0 ? lu : undefined;
}

const CODE_EQUIPE = /^[A-Za-z0-9_-]{10,40}$/;

/** Le code d'équipe du programme : celui qu'il porte, sinon tiré de sa graine
 *  et de son premier lundi — les deux téléphones le calculent pareil. */
export const equipeDe = (programme: Pick<ProgrammeMois, 'equipe' | 'graine' | 'debut'>): string =>
  programme.equipe ?? `p${(programme.graine >>> 0).toString(36)}${programme.debut.replace(/-/g, '')}`;

/** Un nouveau programme à la place de l'ancien : d'autres exercices, mais les
 *  réglages du duo restent — les répétitions de chacun, le tempo, le nombre
 *  d'exercices —, le serveur et le code d'équipe : l'historique commun
 *  continue d'un programme à l'autre. */
export function refaireProgramme(ancien: ProgrammeMois, options: OptionsProgramme): ProgrammeMois {
  return {
    ...genererProgramme({ exercices: nombreExercicesDe(ancien), ...options }),
    ...(ancien.duo ? { duo: ancien.duo } : {}),
    ...(ancien.serveur ? { serveur: ancien.serveur } : {}),
    equipe: equipeDe(ancien),
  };
}

/** Une adresse de serveur utilisable depuis la page : en https, ou sur ce
 *  poste pour essayer. Sans le chemin ni la barre finale. */
export function adresseServeurValide(brute: unknown): string | null {
  if (typeof brute !== 'string' || brute.length > 200) return null;
  let url: URL;
  try {
    url = new URL(brute.trim());
  } catch {
    return null;
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
  return `${url.protocol}//${url.host}`;
}

/** Relit un programme reçu ou sauvegardé ; null s'il est illisible. Les
 *  exercices inconnus de cette version de l'application sont écartés. */
export function validerProgramme(brut: unknown): ProgrammeMois | null {
  const p = (brut ?? {}) as Partial<ProgrammeMois>;
  if (typeof p.debut !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.debut) || !Array.isArray(p.seances)) {
    return null;
  }
  const seances: SeanceDuMois[] = p.seances
    .filter(
      (s): s is SeanceDuMois =>
        typeof s?.id === 'string' &&
        typeof s.nom === 'string' &&
        Number.isInteger(s.jour) &&
        Array.isArray(s.exercices),
    )
    .map((s) => {
      const exercices = s.exercices.filter(estConnu);
      const finale = estConnu(s.finale) ? s.finale : undefined;
      // Dans un lien, chacun son tour se note par la place de l'exercice dans
      // la séance, la finale comprise ; dans une sauvegarde, par son nom.
      const recusTour: unknown[] = [...s.exercices, s.finale];
      const tour = Array.isArray(s.tour)
        ? s.tour
            .map((id: unknown) => (typeof id === 'number' && Number.isInteger(id) ? recusTour[id] : id))
            .filter((id): id is string => estConnu(id) && (exercices.includes(id) || id === finale))
        : [];
      const partie = s.partie === 'bas' || s.partie === 'haut' || s.partie === 'complet' ? s.partie : undefined;
      const liens = Array.isArray(s.liens) ? lireLiens(s.liens, s.exercices, exercices) : [];
      return {
        id: s.id,
        nom: s.nom,
        jour: s.jour,
        ...(s.semaine === 'A' || s.semaine === 'B' ? { semaine: s.semaine } : {}),
        type: s.type === 'dure' ? 'dure' : 'facile',
        ...(partie ? { partie } : {}),
        format: 'series' as const,
        exercices,
        ...(finale ? { finale } : {}),
        ...(liens.length > 0 ? { liens } : {}),
        ...(tour.length > 0 ? { tour } : {}),
      };
    });
  if (seances.length === 0) return null;
  return mettreANiveau({
    debut: p.debut,
    objectifs: Array.isArray(p.objectifs) ? p.objectifs.filter((o) => typeof o === 'string') : [],
    materiels: Array.isArray(p.materiels)
      ? p.materiels.filter((m) => typeof m === 'string')
      : [...MATERIELS_PROGRAMME],
    graine: typeof p.graine === 'number' ? p.graine : 0,
    seances,
    ...(typeof p.version === 'number' ? { version: p.version } : {}),
    ...(lireDuo(p.duo) ? { duo: lireDuo(p.duo) } : {}),
    ...(typeof p.equipe === 'string' && CODE_EQUIPE.test(p.equipe) ? { equipe: p.equipe } : {}),
    ...(adresseServeurValide(p.serveur) ? { serveur: adresseServeurValide(p.serveur)! } : {}),
  });
}

/** Un programme d'une version précédente — l'ancienne semaine (le bas du
 *  corps le lundi, la trap bar le jeudi), les enchaînés de trois — est
 *  recomposé avec la même
 *  graine, les mêmes objectifs et le même premier lundi : les deux téléphones
 *  retombent sur le même programme. */
function mettreANiveau(programme: ProgrammeMois): ProgrammeMois {
  if ((programme.version ?? 1) >= VERSION_PROGRAMME) return programme;
  return recomposer(programme);
}

/** Le programme dans un lien. Une paire, et un exercice fait chacun son
 *  tour, s'y notent par leur place dans la séance plutôt que par leurs noms ;
 *  ce qui va de soi n'y est pas (le format en séries, une séance « facile ») :
 *  le lien reste assez court pour un texto, même à six séances. Les liens
 *  d'avant, avec les noms, se lisent toujours (`validerProgramme`). */
export function encoderProgramme(programme: ProgrammeMois): string {
  const court = {
    ...programme,
    seances: programme.seances.map((s) => {
      const recus = [...s.exercices, ...(s.finale ? [s.finale] : [])];
      return {
        id: s.id,
        nom: s.nom,
        jour: s.jour,
        ...(s.semaine ? { semaine: s.semaine } : {}),
        ...(s.type === 'dure' ? { type: s.type } : {}),
        ...(s.partie ? { partie: s.partie } : {}),
        exercices: s.exercices,
        ...(s.finale ? { finale: s.finale } : {}),
        ...(s.liens ? { liens: s.liens.map((paire) => paire.map((id) => s.exercices.indexOf(id))) } : {}),
        ...(s.tour ? { tour: s.tour.map((id) => recus.indexOf(id)) } : {}),
      };
    }),
  };
  return versBase64Url(JSON.stringify(court));
}

export function decoderProgramme(code: string): ProgrammeMois | null {
  try {
    return validerProgramme(JSON.parse(depuisBase64Url(code)));
  } catch {
    return null;
  }
}

/** Le lien qui ouvre l'application avec ce programme. */
export function lienDePartage(programme: ProgrammeMois, adresse: string): string {
  return `${adresse.split('#')[0]}#${CLE_LIEN}=${encoderProgramme(programme)}`;
}

/** Le programme contenu dans l'ancre d'une adresse, s'il y en a un. */
export function programmeDansLien(ancre: string): ProgrammeMois | null {
  const trouve = ancre.match(new RegExp(`${CLE_LIEN}=([A-Za-z0-9_-]+)`));
  return trouve ? decoderProgramme(trouve[1]) : null;
}
