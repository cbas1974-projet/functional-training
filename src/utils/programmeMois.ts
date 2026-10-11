// Programme du mois : l'application compose les séances elle-même, dans la
// bibliothèque des posters, à partir d'objectifs musculaires — bas du dos,
// épaules, extérieur et intérieur de cuisse par défaut. Le jeudi, la séance de
// référence, lourde, toujours la même ; le lundi le bas du corps et le mardi
// le haut, qui alternent d'une semaine à l'autre : mêmes muscles, autres
// exercices. Tous les jours, les exercices vont par paires d'exercices
// opposés : les deux à la suite, puis une pause — la plus longue des pauses de
// ses deux exercices. Chacun suit la séance sur son téléphone, avec ses
// répétitions et ses charges ; à deux, les deux téléphones déroulent la même
// horloge.
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
import { cleMouvement, familleDe } from './generateurSeance';
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
  /** Le mardi, la dernière série à la moitié de la charge : le jiu-jitsu des
   *  adultes vient le soir. */
  derniereLegereMardi: boolean;
  /** Étirements proposés pendant les longues pauses. */
  etirementsPause: string[];
}

export const PERSONNES: ProfilPersonne[] = [
  // Le dos à ménager : il s'étire pendant que Max fait sa série, sans flexion
  // avant debout — elle fatigue son bas du dos — mais avec les mollets.
  {
    id: 'sebastien',
    seriePlusPoussee: false,
    derniereLegereMardi: true,
    etirementsPause: ['etir-rachis-debout', 'etir-mollet-mur', 'etir-inclinaison-tronc'],
  },
  // Des jambes très fortes, le haut du corps moins ; les genoux demandent
  // d'étirer les cuisses, les mollets et l'arrière des cuisses — pas de fente,
  // dure pour le genou.
  {
    id: 'max',
    seriePlusPoussee: true,
    derniereLegereMardi: false,
    etirementsPause: ['etir-quadriceps-debout', 'etir-mollet-mur', 'etir-ischios-debout'],
  },
];

const PROFILS = Object.fromEntries(PERSONNES.map((p) => [p.id, p])) as Record<Personne, ProfilPersonne>;

/** Les noms affichés. Les identifiants (`sebastien`, `max`) ne changent pas : ils
 *  vivent dans les sauvegardes et sur le serveur. */
export const NOM_PERSONNE: Record<Personne, string> = { sebastien: 'Speedy', max: 'Big Max' };

export const autrePersonne = (personne: Personne): Personne =>
  personne === 'sebastien' ? 'max' : 'sebastien';

/** Les répétitions de chacun, une semaine normale : Sébastien deux de moins
 *  que Max, ce qui lui laisse une quinzaine de secondes de repos en plus. */
export const REPS_PAR_DEFAUT: Record<Personne, number> = { sebastien: 8, max: 10 };

/** Les répétitions de chacun pour ce programme. */
export const repsDuDuo = (programme: Pick<ProgrammeMois, 'duo'>): Record<Personne, number> => ({
  ...REPS_PAR_DEFAUT,
  ...programme.duo?.reps,
});

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

/** Le nombre d'exercices qu'on peut choisir pour chaque séance, sans compter
 *  le dernier pour les jambes : deux, trois, quatre ou cinq paires. */
export const NOMBRES_EXERCICES = [4, 6, 8, 10];
/** Six exercices, trois paires, et le dernier pour les jambes. */
export const EXERCICES_PAR_DEFAUT = 6;
/** Le tempo des séances du programme : 3 s / 3 s, et 1 s en bas, qui casse
 *  le rebond sans obliger à trop alléger. */
export const TEMPO_PROGRAMME: Tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 1 };

/** Le nombre d'exercices des séances de ce programme. */
export const nombreExercicesDe = (programme: Pick<ProgrammeMois, 'duo'>): number =>
  programme.duo?.exercices ?? EXERCICES_PAR_DEFAUT;

/** Le tempo des séances de ce programme : le même sur les deux téléphones. */
export const tempoDuProgramme = (programme: Pick<ProgrammeMois, 'duo'>): Tempo =>
  programme.duo?.tempo ?? TEMPO_PROGRAMME;

/** Version de la composition. Un programme plus ancien est recomposé, avec
 *  la même graine : 3 = le bas du corps le lundi, le haut le mardi, la séance
 *  de référence le jeudi ; 4 = des paires d'exercices opposés tous les jours,
 *  au nombre d'exercices choisi ; 5 = le lundi, la paire des deux machines
 *  des cuisses (extension et flexion des jambes). */
export const VERSION_PROGRAMME = 5;

/** La durée inscrite dans les réglages d'une séance du programme ; la vraie
 *  est celle de ses étapes. */
const DUREE_REFERENCE_MIN = 60;
/** Garde-fou : une séance ne dépasse pas deux heures et demie. Au-delà, elle
 *  perd ses dernières paires — même à dix exercices, on n'y arrive pas. */
export const DUREE_MAXI_SEC = 150 * 60;
/** Trois séries par exercice ; Max en fait une de plus aux poussées. */
export const SERIES_PROGRAMME = 3;
/** La semaine dure, le jeudi une semaine sur deux : même poids, deux
 *  répétitions de plus. */
export const REPS_SEMAINE_DURE = 2;
/** Le mardi soir, le jiu-jitsu des adultes. */
const JOUR_JIU_JITSU = 2;
/** Repos après une série d'un gros exercice, fait seul ; après une paire, c'est
 *  la pause de la paire quand elle en compte un (`reposDePaire`). */
export const REPOS_SEC = 90;
/** Repos après une série d'un petit muscle : bras, épaules en isolation,
 *  abdominaux, mollets, intérieur et extérieur de cuisse. */
export const REPOS_PETITS_SEC = 60;
/** La trap bar : la plus lourde, deux minutes — seule, ou après sa paire. */
export const REPOS_TRAP_BAR_SEC = 120;
/** Les deux exercices d'une paire : le temps de passer de l'un à l'autre. */
export const TRANSITION_LIEN_SEC = 15;
/** Tenue des exercices au temps : planche, marche du fermier. */
const TENUE_SEC = 30;
/** On tire parmi les meilleurs candidats d'un emplacement : deux programmes
 *  ne se ressemblent pas tous, sans jamais prendre un exercice hors sujet. */
const MEILLEURS = 3;

// ------------------------------------------------------------- Mis de côté

/** Les exercices mis de côté du programme du mois, pour les deux — ils font les
 *  mêmes exercices ensemble —, tant que la jambe de Sébastien n'a pas été
 *  examinée par un professionnel : elle donne parfois l'impression de « lâcher »,
 *  ses bandelettes ilio-tibiales sont fragiles et son bas du dos fatigue vite ;
 *  Max, lui, a mal aux genoux. Ce sont :
 *  - les fentes et les exercices sur une jambe ;
 *  - pour le dos, le good morning et les rowings buste penché sans appui. On
 *    garde ceux qui s'appuient : `incline-row` (poitrine contre le banc) et
 *    `single-arm-row` (une main et un genou sur le banc).
 *
 *  Ils restent dans la bibliothèque et dans la séance libre. Le programme ne
 *  les compose plus (`candidatsProgramme`) et « Changer » ne les propose plus
 *  (`alternatives` passe par la même liste).
 *
 *  Pour les lever plus tard, une fois la jambe examinée : retirer ici les
 *  identifiants qu'on veut rendre au programme (ou vider la liste), et, pour
 *  rendre ses fentes à la place « fente » du lundi, remplacer son `parmi` par
 *  `patterns: ['fente']` dans `BASE.bas`. Un programme déjà composé garde ses
 *  exercices ; « Refaire » le programme tire parmi les nouveaux candidats. */
export const EXERCICES_MIS_DE_COTE: string[] = [
  // Les fentes et les exercices sur une jambe.
  'reverse-lunge',
  'kb-lunge',
  'elevated-reverse-lunge',
  'side-lunge',
  'kb-side-lunge',
  'curtsy-lunge',
  'step-up',
  'kb-single-leg-deadlift',
  'kb-low-side-step-row',
  'kb-bob-and-weave',
  'kb-around-the-world',
  // Le dos : le good morning, et les rowings buste penché sans appui.
  'kb-good-morning',
  'bent-over-row',
  'kb-bent-over-row',
  'seesaw-row',
];

/** Ce qui remplit la place « fente » du lundi tant que les fentes sont mises de
 *  côté : des exercices à deux jambes. La presse à cuisses et le hack squat sont
 *  des machines : le lundi, elles attendent la fin de la séance (leur place est
 *  celle du dernier exercice), si bien que la place se remplit en pratique avec
 *  un squat gobelet, le pont fessier ou la pompe de grenouille — ou un squat
 *  avec développé (la chaise au mur, le thruster) : ils ne travaillent pas les
 *  fessiers, si bien qu'un soulevé de terre roumain peut leur faire face. Sans
 *  eux, à dix exercices, le lundi de la semaine B manquerait de paires depuis
 *  que le leg curl à l'haltère ne revient plus à côté de la machine. */
const DEUX_JAMBES = [
  'leg-press', 'hack-squat', 'goblet-squat', 'kb-goblet-squat', 'glute-bridge', 'frog-pump',
  'kb-wall-squat-press', 'thruster', 'kb-thruster',
];

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
  /** Le muscle de cette place n'a qu'un ou deux exercices directs — le bas du
   *  dos, l'extérieur et l'intérieur de cuisse, depuis que le good morning et
   *  les fentes sont mis de côté : la semaine B peut y reprendre celui de la
   *  semaine A, plutôt que de laisser l'objectif sans exercice. Les autres
   *  exercices de la semaine A restent interdits. */
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
}

/** Jeudi : tout le corps, lourd. Lundi : le bas. Mardi : le haut. */
type Gabarit = 'dure' | 'bas' | 'haut';

type SeanceAGabarit = Pick<SeanceDuMois, 'type' | 'jour' | 'partie'>;

const gabaritDe = (seance: SeanceAGabarit): Gabarit => {
  if (seance.type === 'dure') return 'dure';
  if (seance.partie === 'bas' || seance.partie === 'haut') return seance.partie;
  // Programme d'avant la version 3 : le bas le mardi, le haut le jeudi.
  return seance.jour === 4 ? 'haut' : 'bas';
};

const TRONC: PatternMoteur[] = ['anti-rotation', 'flexion-tronc', 'rotation', 'flexion-laterale'];

const principauxDe = (exercice: Exercice): Muscle[] => exercice.musclesPrincipaux ?? [];

/** Le jeudi s'ouvre sur la trap bar, quand le dos est frais — en paire avec
 *  le haut du corps : à deux, on se croise sur la machine. */
const CHARNIERE_TRAP_BAR: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], salle: true, preferer: (e) => e.materiel === 'salle', avec: ['tirage', 'epaules', 'poussee'] };
/** Sans les machines : un soulevé de terre roumain ou au kettlebell. Pas un
 *  pont fessier ; et le bas du dos a sa place à lui. */
const CHARNIERE_LIBRE: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], preferer: (e) => !principauxDe(e).includes('lombaires'), avec: ['tirage', 'epaules', 'poussee'] };
/** Sans les machines, le jeudi garde aussi un squat, à deux jambes : les
 *  fentes, qui tordent le genou, attendent le lundi. */
const SQUAT_LOURD: Emplacement = { cle: 'jambes', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['squat'], preferer: (e) => e.cotes === 'bilateral', avec: ['epaules', 'poussee', 'tirage', 'oiseau'] };

/** Les places de base de chaque jour, après celles des objectifs. Chacune
 *  dit avec quelles places elle fait une bonne paire. */
const BASE: Record<Gabarit, Emplacement[]> = {
  dure: [
    // On tire, sans charger le bas du dos — la trap bar l'a déjà fait : un
    // rowing poitrine contre le banc plutôt que buste penché.
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes', 'biceps'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'], preferer: (e) => !chargeLeBasDuDos(e), avec: ['charniere', 'bas-du-dos', 'poussee'] },
    // On pousse une charge : un développé sur banc avant les pompes.
    { cle: 'poussee', muscles: ['pectoraux', 'triceps', 'epaules'], principal: ['pectoraux'], patterns: ['poussee-horizontale'], preferer: (e) => e.materiel === 'banc', avec: ['oiseau', 'tirage', 'bas-du-dos'] },
    // L'arrière des épaules, qui les tient en place.
    { cle: 'oiseau', muscles: ['epaules', 'trapezes', 'dorsaux'], principal: ['epaules', 'trapezes'], patterns: ['tirage-horizontal', 'tirage-vertical'], avec: ['poussee'] },
    { cle: 'biceps', muscles: ['biceps', 'avant-bras'], principal: ['biceps'], avec: ['triceps'] },
    { cle: 'triceps', muscles: ['triceps'], principal: ['triceps'], avec: ['biceps'] },
    { cle: 'jambes', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps'], patterns: ['squat', 'fente'], preferer: (e) => e.cotes === 'bilateral', avec: ['coiffe', 'epaules', 'oiseau', 'tirage'] },
    { cle: 'coiffe', muscles: ['coiffe-rotateurs', 'epaules'], principal: ['coiffe-rotateurs'], avec: ['jambes', 'mollets'] },
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: TRONC, avec: ['bas-du-dos'] },
    { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers'], principal: ['lombaires'], preferer: (e) => !principauxDe(e).includes('ischios'), avec: ['tronc', 'epaules', 'poussee'] },
    { cle: 'mollets', muscles: ['mollets'], principal: ['mollets'], avec: ['coiffe', 'biceps', 'triceps'] },
  ],
  bas: [
    // Les deux machines des cuisses, en paire : l'extension des jambes
    // (quadriceps) avec la flexion des jambes couché (ischios). Ce sont les
    // préférées du duo, demandées par Sébastien : elles viennent juste après
    // les objectifs, dès six exercices, et chaque lundi, semaine A comme
    // semaine B (`favoris`). À deux, chacun commence sur l'une, puis on
    // échange : personne n'attend. Sans les machines, ces places prennent
    // l'extension et le leg curl aux haltères.
    { cle: 'cuisse-avant', muscles: ['quadriceps'], principal: ['quadriceps'], patterns: ['isolation'], favoris: ['leg-extension-machine'], avec: ['cuisse-arriere', 'ischios', 'fessiers'] },
    { cle: 'cuisse-arriere', muscles: ['ischios'], principal: ['ischios'], patterns: ['isolation'], favoris: ['leg-curl-machine'], avec: ['cuisse-avant', 'squat', 'fente'] },
    // L'avant et l'arrière de la cuisse : un exercice à deux jambes avec un
    // exercice des ischios, un squat avec une charnière. Les fentes sont mises
    // de côté (`EXERCICES_MIS_DE_COTE`) : la place « fente » reste le nom de
    // cette place, mais elle se remplit avec un exercice à deux jambes. Ils
    // ne doivent pas partager les fessiers : les squats et les charnières les
    // travaillent presque toujours.
    { cle: 'fente', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], parmi: DEUX_JAMBES, avec: ['ischios', 'cuisse-arriere'] },
    { cle: 'ischios', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], avec: ['cuisse-avant', 'squat', 'fente'] },
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: TRONC, avec: ['bas-du-dos'] },
    { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers', 'ischios'], principal: ['lombaires'], reprise: true, avec: ['tronc', 'cuisse-avant', 'squat'] },
    { cle: 'squat', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps'], patterns: ['squat'], avec: ['fessiers', 'ischios', 'cuisse-arriere'] },
    { cle: 'fessiers', muscles: ['fessiers'], principal: ['fessiers'], avec: ['squat', 'cuisse-avant'] },
    { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], avec: ['adducteurs'] },
    { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], avec: ['abducteurs'] },
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

/** Chaque objectif devient une place, dans les séances où il a sa place. */
const PAR_OBJECTIF: Record<
  string,
  { emplacement: Emplacement; gabarits: Gabarit[]; surcharge?: Partial<Record<Gabarit, Partial<Emplacement>>> }
> = {
  'bas-du-dos': {
    // Le lundi, avec le ventre : les deux côtés du tronc.
    emplacement: { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers', 'ischios'], principal: ['lombaires'], reprise: true, avec: ['tronc', 'cuisse-avant', 'squat'] },
    gabarits: ['dure', 'bas'],
    // Le jeudi, le soulevé de terre a déjà chargé l'arrière des cuisses : pour
    // le bas du dos, un exercice qui ne soit pas une deuxième charnière
    // lourde, en paire avec les épaules.
    surcharge: { dure: { preferer: (e) => !principauxDe(e).includes('ischios'), avec: ['epaules', 'poussee', 'tirage', 'tronc'] } },
  },
  epaules: {
    emplacement: { cle: 'epaules', muscles: ['epaules', 'coiffe-rotateurs'], principal: ['epaules'], avec: ['tirage', 'dorsaux', 'trapezes'] },
    gabarits: ['dure', 'haut'],
    // Le jeudi, les épaules se travaillent lourd : un développé au-dessus de la tête.
    surcharge: { dure: { muscles: ['epaules', 'triceps'], patterns: ['poussee-verticale'], avec: ['bas-du-dos', 'tirage', 'jambes'] } },
  },
  'exterieur-cuisse': {
    emplacement: { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], reprise: true, avec: ['adducteurs'] },
    gabarits: ['bas'],
  },
  'interieur-cuisse': {
    emplacement: { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], reprise: true, avec: ['abducteurs'] },
    gabarits: ['bas'],
  },
  bras: {
    emplacement: { cle: 'bras', muscles: ['biceps', 'triceps', 'avant-bras'], principal: ['biceps', 'triceps'], avec: ['triceps', 'biceps'] },
    gabarits: ['haut'],
  },
  // Le ventre s'oppose au bas du dos : il a sa place les jours qui le
  // travaillent, pas le mardi.
  tronc: {
    emplacement: { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: TRONC, avec: ['bas-du-dos'] },
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

/** Les places d'une séance, dans l'ordre où on les remplit : le jeudi, la
 *  charnière d'abord, fraîche ; puis les objectifs, puis les places de base. */
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
  parObjectif.forEach(ajouter);
  BASE[gabarit].forEach(ajouter);
  return resultat;
}

// ------------------------------------------------------------- Le choix

/** Les exercices dont on peut composer un programme : musculation, avec le
 *  matériel de la salle, sans mouvement explosif ni niveau avancé, et sans ceux
 *  qu'on a mis de côté (`EXERCICES_MIS_DE_COTE`). */
export function candidatsProgramme(materiels: Materiel[]): Exercice[] {
  const possedes = new Set<Materiel>(['aucun', ...materiels]);
  return EXERCICES.filter(
    (e) =>
      familleDe(e) === 'musculation' &&
      possedes.has(e.materiel) &&
      e.niveauMin <= 2 &&
      !e.explosif &&
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
  const libres = candidats.filter(
    (e) =>
      !preferences.exclus.has(cleMouvement(e)) &&
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

/** Ce qui a sa place chaque jour : le lundi, le bas du corps et le tronc ;
 *  le mardi, le haut du corps seulement, et rien qui charge le bas du dos —
 *  jiu-jitsu le soir ; le jeudi, tout, mais le haut du corps sans charger le
 *  bas du dos : la trap bar l'a déjà fait. */
const DANS_LE_JOUR: Record<Gabarit, (exercice: Exercice) => boolean> = {
  dure: (e) => !(partieDe(e) === 'haut' && chargeLeBasDuDos(e)),
  bas: (e) =>
    partieDe(e) === 'bas' || partieDe(e) === 'tronc' || (partieDe(e) === 'corps-entier' && vise(e, ...MUSCLES_BAS)),
  haut: (e) => partieDe(e) === 'haut' && !chargeLeBasDuDos(e),
};

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
  { raison: 'pousser ↔ tirer', force: 2, test: (a, b) => avecLeHaut(a) && avecLeHaut(b) && sensDe(a) === 'pousse' && sensDe(b) === 'tire' },
  { raison: 'haut ↔ bas', force: 2, test: (a, b) => partieDe(a) === 'haut' && partieDe(b) === 'bas' },
];

const oppositionDe = (a: Exercice, b: Exercice) => OPPOSITIONS.find((o) => o.test(a, b) || o.test(b, a));

/** Deux exercices en paire : un bon partenaire, ou un à éviter. */
export type Accord = 'bon' | 'bas-du-dos' | 'memes-muscles' | 'pas-opposes';

export interface AccordPaire {
  accord: Accord;
  /** Ce qui les unit (« pousser ↔ tirer ») ou pourquoi les éviter ensemble
   *  (« le bas du dos deux fois »). */
  raison: string;
}

const NOM_PARTIE = { haut: 'le haut du corps', bas: 'les jambes', tronc: 'le tronc', 'corps-entier': 'tout le corps' };

/** La règle des paires : jamais deux exercices qui chargent le bas du dos,
 *  jamais les mêmes muscles principaux ; et deux exercices qui s'opposent —
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
 *  des deux machines — l'extension et la flexion des jambes, le lundi — ne
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

// ------------------------------------------------------------- Pour finir : les jambes

/** Le dernier exercice de chaque séance. Le jeudi, une machine lourde pour
 *  les jambes ; le lundi, au choix ; le mardi, jour du haut du corps et du
 *  jiu-jitsu le soir, la marche du fermier. Jamais la trap bar, qui se fait
 *  fraîche, en début de séance. */
const FINALES: Record<Gabarit, string[]> = {
  dure: ['leg-press', 'hack-squat'],
  bas: ['traineau', 'leg-press', 'hack-squat', 'farmers-walk', 'kb-farmers-walk'],
  haut: ['farmers-walk', 'kb-farmers-walk'],
};

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

/** … puis quatre mouvements légers, choisis pour le jour. */
const MOUVEMENT_SEC = 45;
const leger = (nom: string, consigne: string): MouvementGuide => ({ nom, consigne, dureeSec: MOUVEMENT_SEC });
const CERCLES_BRAS = leger('Cercles de bras', 'Petits puis grands, vers l’arrière puis vers l’avant.');
const BASSIN = leger('Rotations du bassin', 'Mains sur les hanches, grands cercles dans les deux sens.');
const SQUATS = leger('Squats à vide', 'Lents et profonds, talons au sol, buste droit.');
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
  /** Lundi et mardi changent d'une semaine à l'autre (cinq séances) ou non
   *  (trois séances). */
  alternance?: boolean;
  graine?: number;
  aujourdhui?: Date;
  /** Le nombre d'exercices de chaque séance, sans le dernier pour les
   *  jambes : 4, 6, 8 ou 10 ; six par défaut. */
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

/** On mesure une séance à deux, aux répétitions d'usage : la semaine normale,
 *  celle qu'on fait le plus souvent. */
const MESURE: ContexteSeance = { personne: 'sebastien', aDeux: true };

export function genererProgramme(options: OptionsProgramme = {}): ProgrammeMois {
  const objectifs = options.objectifs ?? OBJECTIFS_PAR_DEFAUT;
  const materiels = options.materiels ?? MATERIELS_PROGRAMME;
  const alternance = options.alternance ?? true;
  const nombre = nombreValide(options.exercices) ?? EXERCICES_PAR_DEFAUT;
  const graine = (options.graine ?? Date.now()) >>> 0;
  const alea = aleatoire(graine);
  const candidats = candidatsProgramme(materiels);
  const dejaPris = new Set<string>();

  /** Les exercices d'une séance, deux par deux, jusqu'au nombre choisi : les
   *  objectifs d'abord — le jeudi, la trap bar en tête. Chaque place prend
   *  son exercice, puis lui cherche un partenaire qui s'y oppose : dans les
   *  places qu'elle suggère, puis dans les suivantes. Sans partenaire
   *  possible, la place est laissée. */
  const composer = (gabarit: Gabarit, interdits: Exercice[] = []): Exercice[] => {
    // Le mardi, jiu-jitsu le soir : rien qui charge le bas du dos.
    const duJour = candidats.filter(DANS_LE_JOUR[gabarit]);
    const bonsAvec = (exercice: Exercice) => duJour.filter((e) => accordPaire(exercice, e).accord === 'bon');
    const places = emplacementsDe(gabarit, objectifs, materiels);
    /** Les exercices pris, et la place de chacun : la séance suit l'ordre
     *  des places — les objectifs d'abord. */
    const pris: { exercice: Exercice; place: number }[] = [];
    // Au plus un exercice sur trois qui charge le bas du dos, et jamais deux
    // dans une paire.
    const quotaDos = gabarit === 'dure' ? 3 : Math.ceil(nombre / 3);

    /** Remplit ces places deux par deux, sans les mouvements exclus. */
    const remplir = (restantes: Emplacement[], exclus: Set<string>) => {
      const preferences = (sans?: Exercice): Preferences => {
        const tropDeDos = pris.filter((p) => chargeLeBasDuDos(p.exercice)).length >= quotaDos;
        return {
          exclus: sans ? new Set([...exclus, cleMouvement(sans)]) : exclus,
          dejaPris,
          // Les mouvements à deux mains ou en alternant d'abord : une série
          // d'un seul côté coûte deux fois le temps — et le jeudi, à deux
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
       *  d'abord, puis les autres, dans l'ordre. */
      const ouChercher = (emplacement: Emplacement) => {
        const suggerees = emplacement.avec ?? [];
        const rang = (place: Emplacement) =>
          suggerees.includes(place.cle) ? suggerees.indexOf(place.cle) : suggerees.length;
        return [...restantes].sort((a, b) => rang(a) - rang(b));
      };
      while (pris.length + 2 <= nombre && restantes.length > 0) {
        const emplacement = restantes.shift()!;
        // Un exercice n'entre que s'il a un partenaire possible.
        const aUnPartenaire = (premier: Exercice) =>
          restantes.some((place) => classer(place, bonsAvec(premier), preferences(premier), { strict: true }).length > 0);
        const premier = choisir(emplacement, duJour, preferences(), alea, { admis: aUnPartenaire });
        if (!premier) continue;
        for (const place of ouChercher(emplacement)) {
          const second = choisir(place, bonsAvec(premier), preferences(premier), alea, { strict: true });
          if (!second) continue;
          prendre(premier, emplacement);
          prendre(second, place);
          restantes.splice(restantes.indexOf(place), 1);
          break;
        }
      }
    };

    // La semaine B prend d'autres exercices que la semaine A — sauf ceux qui
    // visent un muscle à peine servi (`reprise`) : sans eux, le bas du dos et
    // les cuisses n'auraient plus d'exercice direct, ni le ventre de partenaire.
    // Les favoris du duo (`favoris`, les deux machines des cuisses) reviennent
    // eux aussi : c'est leur paire du lundi, chaque semaine.
    const reprenable = (e: Exercice) =>
      places.some((p) => (p.reprise && p.principal && viseLePrincipal(e, p.principal)) || p.favoris?.includes(e.id));
    remplir([...places], new Set(interdits.filter((e) => !reprenable(e)).map(cleMouvement)));
    // Quand il n'en reste plus assez pour faire des paires — à dix exercices, le
    // bas du corps vient à manquer —, elle en reprend quelques-uns de plus.
    if (pris.length + 2 <= nombre && interdits.length > 0) {
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
    const pool = possibles(FINALES[gabarit]).length > 0 ? possibles(FINALES[gabarit]) : possibles(FINALES.bas);
    if (pool.length === 0) return undefined;
    const nouvelles = pool.filter((e) => !dejaPris.has(cleMouvement(e)));
    const choix = nouvelles.length > 0 ? nouvelles : pool;
    const retenue = choix[Math.floor(alea() * choix.length)];
    dejaPris.add(cleMouvement(retenue));
    return retenue;
  };

  /** Une séance du programme : ses exercices par paires, puis le dernier,
   *  pour les jambes, seul. Les machines se font chacun son tour, une pour
   *  deux — dans une paire, on se croise. */
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
    // Le garde-fou : au-delà de deux heures, la séance perd ses dernières
    // paires — jamais la première, celle de la trap bar le jeudi.
    let seance = avec(exercices.map((e) => e.id));
    while ((seance.liens ?? []).length > 2 && dureeSec(seance) > DUREE_MAXI_SEC) {
      const derniere = seance.liens!.at(-1)!;
      seance = avec(seance.exercices.filter((id) => !derniere.includes(id)));
    }
    return seance;
  };

  // Le jeudi d'abord : c'est la séance de référence, les autres l'entourent
  // avec d'autres exercices.
  const jeudi = seanceDe(
    { id: 'jeudi', nom: 'Jeudi — séance de référence', jour: 4, type: 'dure', partie: 'complet' },
    'dure',
    composer('dure'),
  );
  const lundiA = composer('bas');
  const mardiA = composer('haut');
  const lundi = (id: string, nom: string, semaine: 'A' | 'B' | undefined, exercices: Exercice[]) =>
    seanceDe({ id, nom, jour: 1, ...(semaine ? { semaine } : {}), type: 'facile', partie: 'bas' }, 'bas', exercices);
  const mardi = (id: string, nom: string, semaine: 'A' | 'B' | undefined, exercices: Exercice[]) =>
    seanceDe({ id, nom, jour: 2, ...(semaine ? { semaine } : {}), type: 'facile', partie: 'haut' }, 'haut', exercices);
  let seances: SeanceDuMois[];
  if (alternance) {
    const lundiB = composer('bas', lundiA);
    const mardiB = composer('haut', mardiA);
    seances = [
      lundi('lundi-a', 'Lundi A — bas du corps', 'A', lundiA),
      mardi('mardi-a', 'Mardi A — haut du corps', 'A', mardiA),
      jeudi,
      lundi('lundi-b', 'Lundi B — bas du corps', 'B', lundiB),
      mardi('mardi-b', 'Mardi B — haut du corps', 'B', mardiB),
    ];
  } else {
    seances = [
      lundi('lundi', 'Lundi — bas du corps', undefined, lundiA),
      mardi('mardi', 'Mardi — haut du corps', undefined, mardiA),
      jeudi,
    ];
  }

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
  /** Le jeudi de la semaine dure : deux répétitions de plus, même poids. */
  semaineDure?: boolean;
  /** Les répétitions de chacun ; absentes, celles d'usage. */
  reps?: Partial<Record<Personne, number>>;
  /** Le tempo du programme, le même sur les deux téléphones ; absent, celui
   *  des réglages du téléphone. */
  tempo?: Tempo;
  /** Exercices dont la semaine dure a réussi : un cran de plus. */
  augmenter?: string[];
  /** Exercices dont le ressenti demande un changement de charge : léger deux
   *  fois de suite, un cran de plus ; lourd deux fois de suite, un cran de
   *  moins (`ressentisQuiChangent`). */
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
 *  bar le jeudi, une minute trente aux gros exercices, une minute aux petits
 *  muscles. */
export function reposDe(exercice: Exercice, seance: Pick<SeanceDuMois, 'type'>): number {
  if (exercice.id === 'trap-bar-deadlift' && seance.type === 'dure') return REPOS_TRAP_BAR_SEC;
  return estPetitMuscle(exercice) ? REPOS_PETITS_SEC : REPOS_SEC;
}

/** La pause après une paire : la plus longue des pauses de ses deux exercices
 *  (`reposDe`) — une minute si elle ne compte que des petits muscles, une
 *  minute trente avec un gros exercice, deux minutes avec la trap bar. */
export const reposDePaire = (paire: string[], seance: Pick<SeanceDuMois, 'type'>): number =>
  Math.max(REPOS_PETITS_SEC, ...paire.filter(estConnu).map((id) => reposDe(EXERCICES_PAR_ID[id], seance)));

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
  const enPlus = contexte.semaineDure && seanceMois.type === 'dure' ? REPS_SEMAINE_DURE : 0;
  const augmenter = new Set(contexte.augmenter ?? []);
  const ressentis = contexte.ressentis ?? {};
  const cran = CRAN[uniteDeSeance(parametres)];
  const legere = moi !== null && PROFILS[moi].derniereLegereMardi && seanceMois.jour === JOUR_JIU_JITSU;

  /** Séries et répétitions d'une personne sur un exercice. */
  const volumeDe = (qui: Personne | null, exercice: Exercice, finale: boolean) => {
    const series = SERIES_PROGRAMME + (qui && PROFILS[qui].seriePlusPoussee && estPoussee(exercice) ? 1 : 0);
    const habituelles = qui
      ? (contexte.reps?.[qui] ?? REPS_PAR_DEFAUT[qui])
      : (parametres.repsParSerie ?? REPS_PAR_DEFAUT.sebastien);
    const reps = exercice.unite === 'secondes' ? TENUE_SEC : habituelles + enPlus;
    return finale ? volumeFinale(exercice, series, reps) : { series, reps };
  };

  const blocDe = (exercice: Exercice, finale: boolean): BlocSeries => {
    const mien = volumeDe(moi, exercice, finale);
    const charge = exercice.unite === 'reps';
    return {
      exerciceId: exercice.id,
      series: mien.series,
      reps: mien.reps,
      reposSec: reposDe(exercice, seanceMois),
      ...(enTour.has(exercice.id) ? { tour: true } : {}),
      ...(partenaire ? { autre: volumeDe(partenaire, exercice, finale) } : {}),
      ...(legere && charge ? { derniereLegere: true } : {}),
      ...(augmenter.has(exercice.id) && charge ? { ajoutCharge: cran } : {}),
      ...(charge && Object.prototype.hasOwnProperty.call(ressentis, exercice.id)
        ? { ajustementRessenti: ressentis[exercice.id] === 'leger' ? cran : -cran }
        : {}),
    };
  };

  // Les deux exercices d'une paire s'enchaînent sans pause ; la pause vient
  // après la paire. Un exercice hors paire se fait seul, avec ses pauses.
  const paires = seanceMois.liens ?? [];
  const blocs: BlocSeries[] = seanceMois.exercices.filter(estConnu).map((id) => {
    const bloc = blocDe(EXERCICES_PAR_ID[id], false);
    const paire = paires.findIndex((groupe) => groupe.includes(id));
    if (paire < 0) return bloc;
    return {
      ...bloc,
      superset: paire,
      transitionSec: TRANSITION_LIEN_SEC,
      reposSec: reposDePaire(paires[paire], seanceMois),
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

/** Durée d'une séance du programme : à deux, aux répétitions d'usage, une
 *  semaine normale, sauf contexte donné. */
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

/** La semaine dure : le jeudi d'une semaine B, même poids, deux répétitions
 *  de plus. Une semaine sur deux, le temps que le corps encaisse. */
export function estSemaineDure(
  programme: Pick<ProgrammeMois, 'debut'>,
  seance: Pick<SeanceDuMois, 'type'>,
  date: Date,
): boolean {
  return seance.type === 'dure' && semaineDe(programme, date) === 'B';
}

/** Après une semaine dure réussie — toutes les séries faites —, le jeudi
 *  normal qui suit propose un cran de plus : 5 lb, ou 2,5 kg. Les exercices
 *  concernés, d'après le dernier jeudi fait avant cette semaine. */
export function exercicesAAugmenter(
  historique: SeanceRealisee[],
  programme: Pick<ProgrammeMois, 'debut'>,
  seance: Pick<SeanceDuMois, 'type' | 'nom'>,
  date: Date,
): string[] {
  if (seance.type !== 'dure' || estSemaineDure(programme, seance, date)) return [];
  const cetteSemaine = lundiDe(date).getTime();
  const dernier = historique.find((h) => h.titre === seance.nom && new Date(h.date).getTime() < cetteSemaine);
  if (!dernier || !estSemaineDure(programme, seance, new Date(dernier.date))) return [];
  return dernier.exercices
    .filter((e) => e.seriesPrevues > 0 && e.seriesFaites >= e.seriesPrevues && (e.poids ?? 0) > 0)
    .map((e) => e.exerciceId);
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

/** La moitié d'une charge, arrondie vers le bas au cran des haltères : la
 *  dernière série légère du mardi. */
export function chargeLegere(charge: number, unite: UnitePoids): number {
  if (charge <= 0) return 0;
  const cran = CRAN[unite];
  return Math.min(charge, Math.max(cran, Math.floor(charge / 2 / cran) * cran));
}

/** La charge proposée pour une série d'une séance du programme : celle de
 *  `chargeProposee`, un cran de plus après une semaine dure réussie ou deux
 *  « léger » de suite (un seul cran, jamais deux), un cran de moins après deux
 *  « lourd » de suite, et la moitié pour la dernière série légère du mardi. */
export function chargeDeSerie(
  bloc: Pick<BlocSeries, 'series' | 'ajoutCharge' | 'ajustementRessenti' | 'derniereLegere'> | undefined,
  saisies: number[],
  passees: number[],
  serie: number,
  unite: UnitePoids,
): number {
  const deja = saisies[serie - 1] ?? 0;
  if (deja > 0) return deja;
  const ajout = ajustementDeCharge(bloc)?.ajout ?? 0;
  const reference = ajout !== 0 ? passees.map((charge) => (charge > 0 ? avecCran(charge, ajout) : 0)) : passees;
  if (bloc?.derniereLegere && serie > 1 && serie === bloc.series) {
    return chargeLegere(chargeProposee(saisies, reference, serie - 1), unite);
  }
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
 *  lisibles ; un tempo de la liste ; un nombre d'exercices qu'on peut
 *  choisir. */
function lireDuo(brut: unknown): ProgrammeMois['duo'] {
  const duo = brut as { reps?: Partial<Record<Personne, unknown>>; tempo?: unknown; exercices?: unknown } | null | undefined;
  const lire = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 30 ? n : null);
  const sebastien = lire(duo?.reps?.sebastien);
  const max = lire(duo?.reps?.max);
  const tempoLu = duo?.tempo;
  const tempo =
    typeof tempoLu === 'object' && tempoLu !== null
      ? TEMPOS.find((t) => memeTempo(t.tempo, tempoLu as Tempo))?.tempo
      : undefined;
  const exercices = nombreValide(duo?.exercices);
  const lu: ReglagesDuo = {
    ...(sebastien !== null && max !== null ? { reps: { sebastien, max } } : {}),
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
      const tour = Array.isArray(s.tour)
        ? s.tour.filter((id) => estConnu(id) && (exercices.includes(id) || id === finale))
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

/** Un programme d'une version précédente — l'ancienne semaine, la séance
 *  dure le lundi, les enchaînés de trois — est recomposé avec la même
 *  graine, les mêmes objectifs et le même premier lundi : les deux téléphones
 *  retombent sur le même programme. */
function mettreANiveau(programme: ProgrammeMois): ProgrammeMois {
  if ((programme.version ?? 1) >= VERSION_PROGRAMME) return programme;
  return recomposer(programme);
}

/** Le programme dans un lien. Une paire s'y note par la place de ses deux
 *  exercices dans la séance, plutôt que par leurs noms : le lien reste assez
 *  court pour un texto. */
export function encoderProgramme(programme: ProgrammeMois): string {
  const court = {
    ...programme,
    seances: programme.seances.map((s) =>
      s.liens ? { ...s, liens: s.liens.map((paire) => paire.map((id) => s.exercices.indexOf(id))) } : s,
    ),
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
