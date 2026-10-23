// Programme du mois : l'application compose les séances elle-même, dans la
// bibliothèque des posters, à partir d'objectifs musculaires — bas du dos,
// épaules, extérieur et intérieur de cuisse par défaut —, et seulement parmi
// des exercices classiques le premier mois (`EXERCICES_CLASSIQUES`). Trois
// matins par semaine (rééquilibrés après la séance du 13 octobre 2026) : le
// lundi, tout le corps, le plus long et le plus de jambes (pas de jiu-jitsu le
// soir), la trap bar en tête et la presse pour finir ; le mardi, surtout le
// haut du corps, avec des jambes légères pour partenaires, le développé couché
// en tête ; le jeudi, surtout les jambes, avec le dos et les épaules pour
// partenaires, le swing en tête. Le mardi et le jeudi alternent d'une semaine
// à l'autre : mêmes muscles, autres exercices. Huit exercices par séance : le
// premier et le dernier se font seuls, chacun son tour, avec une pause d'un
// toucher entre les tours ; les six autres vont par paires, jamais deux
// exercices de la même zone (le haut du corps, le bas du corps, le tronc). Une
// paire se fait A, B, A, B sans pause entre les tours ; la pause vient à la
// fin, une minute — une minute trente après la trap bar. Puis dix minutes de
// finale au chrono, pour se vider, et les étirements. Les deux s'entraînent
// avec un seul téléphone : celui qui le tient note pour les deux.
import type {
  BlocSeries,
  Exercice,
  Materiel,
  MouvementGuide,
  Muscle,
  ParametresSeance,
  PatternMoteur,
  Personne,
  PointFaible,
  ProgrammeMois,
  ReglagesDuo,
  Ressenti,
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
import { CHANGER_DE_COTE_SEC, cleMouvement, estExigeant, familleDe, secondesAuTemps } from './generateurSeance';
import { exercicesPourMuscles, musclesDe } from './muscles';
import { NOM_GRANDE_ZONE, grandesZonesDe, memeZone, zoneCommune } from './zones';
import type { GrandeZone } from './zones';
import { CRAN_CHARGE as CRAN, assezFaite, convertirPoids, uniteDeSeance } from './statistiques';
import { ajustementDeCharge, avecCran } from './ressenti';

/** L'identifiant désigne bien un exercice de la bibliothèque — et non une
 *  propriété héritée comme « constructor », qu'un lien trafiqué glisserait. */
const estConnu = (id: unknown): id is string =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(EXERCICES_PAR_ID, id);

// ------------------------------------------------------------- Les personnes

export interface ProfilPersonne {
  id: Personne;
  /** Du jiu-jitsu le soir, le dimanche, le mardi et le jeudi : ces jours-là,
   *  moins de répétitions, pour garder du jus pour le cours
   *  (`repsDuJour`). */
  jiuJitsu: boolean;
  /** Étirements proposés pendant les longues pauses. */
  etirementsPause: string[];
  /** Le bas du dos à ménager : pas plus de répétitions que ça aux soulevés
   *  de terre lourds (`estSouleveLourd`), même le lundi. */
  repsMaxSouleve?: number;
  /** Les exercices qu'on ne lui propose jamais (`aEviterPar`) : ni au
   *  programme — on y fait les mêmes exercices, à deux —, ni dans « Changer »,
   *  ni dans la routine du soir, ni dans sa séance libre. Ils restent dans la
   *  bibliothèque. */
  aEviter?: readonly string[];
}

/** Ventre vers le ciel, en appui sur les mains ou les coudes, derrière soi :
 *  la planche inversée, les dips au sol, le chameau (les mains sur les
 *  talons), la roue, le héros couché (sur les coudes). Ces postures tirent le
 *  devant des épaules de Big Max (décision de Sébastien, 13 octobre 2026). Ses
 *  autres exercices d'épaules restent, la planche de face, la planche
 *  latérale et la planche de Copenhague aussi : on y est en appui de face ou
 *  sur le côté. */
export const APPUIS_EN_ARRIERE: readonly string[] = [
  'yoga-planche-inversee',
  'kb-tricep-dip',
  'yoga-chameau',
  'yoga-arc-ascendant',
  'yoga-heros-couche',
];

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
    jiuJitsu: true,
    etirementsPause: ['etir-rachis-debout', 'etir-mollet-mur', 'etir-inclinaison-tronc'],
    repsMaxSouleve: REPS_MAX_SOULEVE,
  },
  // Des jambes très fortes, le haut du corps moins ; les genoux demandent
  // d'étirer les cuisses, les mollets et l'arrière des cuisses — pas de
  // fente, dure pour le genou. Le devant des épaules tire : rien en appui sur
  // les mains derrière soi.
  {
    id: 'max',
    jiuJitsu: false,
    etirementsPause: ['etir-quadriceps-debout', 'etir-mollet-mur', 'etir-ischios-debout'],
    aEviter: APPUIS_EN_ARRIERE,
  },
];

const PROFILS = Object.fromEntries(PERSONNES.map((p) => [p.id, p])) as Record<Personne, ProfilPersonne>;

/** Les exercices qu'on ne propose jamais à cette personne
 *  (`ProfilPersonne.aEviter`). */
export const aEviterPar = (personne: Personne | null | undefined): readonly string[] =>
  (personne ? PROFILS[personne].aEviter : undefined) ?? [];

/** Ceux qu'on ne propose ni à l'un ni à l'autre au programme : ils y font les
 *  mêmes exercices, ensemble. */
const A_EVITER_A_DEUX = new Set(PERSONNES.flatMap((p) => p.aEviter ?? []));

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

// ------------------------------------------------------------- Points faibles

/** Les points faibles qu'on peut cocher pour chacun, dans l'ordre des
 *  Réglages : les jambes, le tronc, le haut du corps. Chacun coché donne une
 *  série de plus aux exercices dont c'est le groupe principal (réglage
 *  demandé par Sébastien le 13 octobre 2026 ; il remplace la série de plus
 *  aux poussées de Big Max). */
export const POINTS_FAIBLES: readonly PointFaible[] = [
  'avant-cuisse',
  'arriere-cuisse',
  'fessiers',
  'interieur-cuisse',
  'exterieur-cuisse',
  'mollets',
  'abdos',
  'bas-du-dos',
  'haut-du-dos',
  'epaules',
  'pecs',
  'biceps',
  'triceps',
];

export const NOM_POINT_FAIBLE: Record<PointFaible, string> = {
  'avant-cuisse': 'Avant de cuisse',
  'arriere-cuisse': 'Arrière de cuisse',
  fessiers: 'Fessiers',
  'interieur-cuisse': 'Intérieur de cuisse',
  'exterieur-cuisse': 'Extérieur de cuisse',
  mollets: 'Mollets',
  abdos: 'Abdos',
  'bas-du-dos': 'Bas du dos',
  'haut-du-dos': 'Haut du dos',
  epaules: 'Épaules',
  pecs: 'Pecs',
  biceps: 'Biceps',
  triceps: 'Triceps',
};

/** Par défaut, aucun : trois séries pour les deux (décision de Sébastien, 13
 *  octobre 2026, après la séance). Le réglage reste, à cocher pour chacun. */
export const POINTS_FAIBLES_PAR_DEFAUT: Record<Personne, PointFaible[]> = {
  sebastien: [],
  max: [],
};

/** L'ancien défaut de Big Max, jusqu'au programme de la version 9 : le haut
 *  du corps. Un programme d'alors qui le porte encore tel quel ne l'avait pas
 *  choisi — c'était le défaut : il repart à vide (`mettreANiveau`). Changé à
 *  la main, il reste. */
export const ANCIENS_POINTS_FAIBLES_DE_BIG_MAX: readonly PointFaible[] = ['epaules', 'pecs', 'biceps', 'triceps'];

/** Le groupe principal d'un exercice, parmi les points faibles : un seul par
 *  exercice. Un développé couché travaille les pecs, les épaules et les
 *  triceps, mais c'est un exercice des pecs : une série de plus au plus,
 *  jamais trois. Il se lit dans le groupe musculaire de la fiche (`groupe`) :
 *  un oiseau ou une rotation externe sont des épaules. Deux précisions, pour
 *  ce que la fiche ne nomme pas : un exercice qui vise l'extérieur de la
 *  hanche est de l'extérieur de cuisse (la planche latérale), un exercice qui
 *  vise le bas du dos est du bas du dos (le Superman) ; et le groupe
 *  « ischios-fessiers » de la fiche se partage d'après le premier de ses
 *  muscles principaux — l'arrière de cuisse, ou les fessiers. Null pour tout
 *  le corps (la marche du fermier) : aucun point faible. */
export function pointFaibleDe(exercice: Pick<Exercice, 'groupe' | 'musclesPrincipaux'>): PointFaible | null {
  const principaux = exercice.musclesPrincipaux ?? [];
  if (principaux.includes('abducteurs')) return 'exterieur-cuisse';
  if (principaux.includes('lombaires')) return 'bas-du-dos';
  switch (exercice.groupe) {
    case 'quadriceps':
      return 'avant-cuisse';
    case 'ischios-fessiers':
      return principaux.find((muscle) => muscle === 'ischios' || muscle === 'fessiers') === 'fessiers'
        ? 'fessiers'
        : 'arriere-cuisse';
    case 'adducteurs':
      return 'interieur-cuisse';
    case 'mollets':
      return 'mollets';
    case 'abdominaux':
    case 'obliques':
      return 'abdos';
    case 'dorsaux':
    case 'trapezes':
      return 'haut-du-dos';
    case 'epaules':
      return 'epaules';
    case 'pectoraux':
      return 'pecs';
    case 'biceps':
    case 'avant-bras':
      return 'biceps';
    case 'triceps':
      return 'triceps';
    case 'corps-entier':
      return null;
  }
}

/** Une série de plus à cet exercice pour qui a ces points faibles : son
 *  groupe principal en est un. Une au plus, quel que soit le nombre de
 *  muscles qu'il travaille. */
export function serieDePlus(pointsFaibles: readonly PointFaible[], exercice: Exercice): boolean {
  const groupe = pointFaibleDe(exercice);
  return groupe !== null && pointsFaibles.includes(groupe);
}

// ------------------------------------------------------------- Réglages

/** Les faiblesses déclarées : c'est autour d'elles que le programme se bâtit. */
export const OBJECTIFS_PAR_DEFAUT = ['bas-du-dos', 'epaules', 'exterieur-cuisse', 'interieur-cuisse'];

/** Ce qu'on trouve dans la salle : haltères, kettlebells, bancs, tapis, et
 *  les machines — trap bar, presse à cuisses, hack squat, traîneau,
 *  extension et flexion des jambes. */
export const MATERIELS_PROGRAMME: Materiel[] = ['halteres', 'kettlebell', 'banc', 'tapis', 'salle'];

/** Le nombre d'exercices qu'on peut choisir pour les séances, le dernier
 *  compris, les trois jours : le premier et le dernier seuls, et une, deux ou
 *  trois paires. */
export const NOMBRES_EXERCICES = [4, 6, 8];
/** Huit exercices les trois jours (décision du 12 octobre 2026) : le premier
 *  et le dernier seuls, trois paires entre les deux. */
export const EXERCICES_PAR_DEFAUT = 8;
/** Le tempo des séances du programme : 3 s / 3 s, et 1 s en bas, qui casse
 *  le rebond sans obliger à trop alléger. */
export const TEMPO_PROGRAMME: Tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 1 };

/** Le nombre d'exercices des séances de ce programme, le dernier compris. */
export const nombreExercicesDe = (programme: Pick<ProgrammeMois, 'duo'>): number =>
  programme.duo?.exercices ?? EXERCICES_PAR_DEFAUT;

/** Le tempo des séances de ce programme : le même sur les deux téléphones. */
export const tempoDuProgramme = (programme: Pick<ProgrammeMois, 'duo'>): Tempo =>
  programme.duo?.tempo ?? TEMPO_PROGRAMME;

/** Les points faibles de chacun, pour ce programme : ceux cochés dans les
 *  Réglages, sinon ceux par défaut. Les mêmes sur les deux téléphones. */
export const pointsFaiblesDe = (programme: Pick<ProgrammeMois, 'duo'>): Record<Personne, PointFaible[]> =>
  programme.duo?.pointsFaibles ?? POINTS_FAIBLES_PAR_DEFAUT;

/** Version de la composition. Un programme plus ancien est recomposé, avec
 *  la même graine : 3 = le bas du corps le lundi, le haut le mardi, la séance
 *  de référence le jeudi ; 4 = des paires d'exercices opposés tous les jours,
 *  au nombre d'exercices choisi ; 5 = le lundi, la paire des deux machines
 *  des cuisses (extension et flexion des jambes) ; 6 = la nouvelle semaine :
 *  le lundi tout le corps avec la trap bar, le mardi le haut, le jeudi les
 *  jambes avec le swing et les deux machines, les trois jours en semaines A
 *  et B, et les fentes de retour ; 7 = le ventre sans plier le dos, le
 *  Superman sans poids, la planche de Copenhague le jeudi (l'audit) ; 8 = un
 *  seul téléphone : huit exercices les trois jours, le premier et le dernier
 *  seuls, trois paires de deux zones différentes entre les deux ; 9 = le
 *  premier mois en exercices classiques (`EXERCICES_CLASSIQUES`), la machine à
 *  mollets assis, la marche du fermier le lundi, les pompes pour finir le
 *  mardi ; 10 = les jours rééquilibrés (13 octobre 2026, après la séance) :
 *  le lundi avec l'intérieur et l'extérieur de cuisse et la presse pour
 *  finir, le mardi avec des jambes légères, le jeudi avec le dos et les
 *  épaules, un tirage chaque jour, la marche du fermier et le traîneau à la
 *  finale de dix minutes, trois séries pour les deux par défaut ; 11 = le
 *  jeudi (14 octobre 2026), le squat cosaque à la place de la planche de
 *  Copenhague et la montée sur marche à la place des mollets ; 12 = le
 *  programme sur mesure de Sébastien (22 octobre 2026, `PROGRAMME_SUR_MESURE`),
 *  ses cinq séances écrites telles quelles, à huit exercices. */
export const VERSION_PROGRAMME = 12;

/** Une séance écrite à la main : ses paires, dans l'ordre, puis les exercices
 *  seuls, puis le dernier (seul aussi). */
interface SeanceSurMesure {
  jourNom: 'lundi' | 'mardi' | 'jeudi';
  semaine?: 'A' | 'B';
  paires: [string, string][];
  seuls: string[];
  dernier: string;
}

/** Le programme sur mesure de Sébastien (22 octobre 2026, docs/jeudi.html et
 *  docs/mes-seances-choisies.html) : à huit exercices et avec l'alternance,
 *  il remplace les séances du générateur, quelle que soit la graine. */
export const PROGRAMME_SUR_MESURE: readonly SeanceSurMesure[] = [
  {
    jourNom: 'lundi',
    paires: [['superman', 'side-lunge'], ['arnold-press', 'incline-row'], ['side-plank', 'incline-bench-press']],
    seuls: ['trap-bar-deadlift'],
    dernier: 'hack-squat',
  },
  {
    jourNom: 'mardi',
    semaine: 'A',
    paires: [['seated-calf-raise', 'chest-squeeze-press'], ['side-plank', 'upright-row'], ['alternating-curl', 'glute-bridge']],
    seuls: ['bench-press'],
    dernier: 'tricep-extension',
  },
  {
    jourNom: 'jeudi',
    semaine: 'A',
    paires: [['cossack-squat', 'incline-row'], ['leg-extension-machine', 'leg-curl-machine'], ['kb-single-arm-row', 'kb-wall-squat-press']],
    seuls: ['kb-double-arm-swing'],
    dernier: 'hammer-curl',
  },
  {
    jourNom: 'mardi',
    semaine: 'B',
    paires: [['calf-raise', 'kb-side-raise'], ['side-plank', 'floor-t-raise'], ['grip-curl', 'glute-bridge']],
    seuls: ['bench-press'],
    dernier: 'kb-tricep-extension',
  },
  {
    jourNom: 'jeudi',
    semaine: 'B',
    paires: [['cossack-squat', 'alternating-front-raise'], ['leg-extension-machine', 'leg-curl-machine'], ['reverse-fly', 'band-pull-apart']],
    seuls: ['kb-double-arm-swing'],
    dernier: 'fire-hydrant',
  },
];

let surMesureActif = true;
/** Pour les tests qui décrivent les règles du générateur : sans le programme
 *  sur mesure, les séances sont composées comme avant le 22 octobre 2026. */
export function avecSurMesure(actif: boolean): void {
  surMesureActif = actif;
}

/** Les séances du programme sur mesure, au format du programme. Chacun son
 *  tour : les exercices à la machine de la salle, comme le générateur. */
function seancesSurMesure(): SeanceDuMois[] {
  const parJour = { lundi: [1, 'tout le corps', 'dure', 'complet'], mardi: [2, 'le haut', 'facile', 'haut'], jeudi: [4, 'les jambes', 'facile', 'bas'] } as const;
  return PROGRAMME_SUR_MESURE.map((s) => {
    const [jour, partieNom, type, partie] = parJour[s.jourNom];
    const exercices = [...s.paires.flat(), ...s.seuls];
    const tour = [...exercices, s.dernier].filter((id) => EXERCICES_PAR_ID[id]?.materiel === 'salle');
    return rangee({
      ...enteteDe(s.jourNom, partieNom, jour, s.semaine, type, partie),
      format: 'series',
      exercices,
      finale: s.dernier,
      liens: s.paires.map((p) => [...p]),
      ...(tour.length > 0 ? { tour } : {}),
    });
  });
}

/** La durée inscrite dans les réglages d'une séance du programme ; la vraie
 *  est celle de ses étapes. */
const DUREE_REFERENCE_MIN = 60;
/** Garde-fou : une séance ne dépasse pas deux heures et demie. Au-delà, elle
 *  perd ses dernières paires — même à dix exercices, on n'y arrive pas. */
export const DUREE_MAXI_SEC = 150 * 60;
/** Trois séries par exercice ; une de plus sur les points faibles de chacun
 *  (`serieDePlus`). */
export const SERIES_PROGRAMME = 3;
/** La pause d'un exercice fait seul : une minute, quel qu'il soit (décision
 *  du 12 octobre 2026). À deux, chacun son tour : elle se propose d'un
 *  toucher entre deux tours — la série de l'autre ne suffit pas au repos d'un
 *  gros exercice — et à la fin ; la marche du fermier ne l'a qu'à la fin
 *  (décision du 13 octobre 2026). Seul, elle vient entre deux séries. */
export const REPOS_SEC = 60;
/** Sauf à la trap bar, la plus lourde : une minute trente. */
export const REPOS_TRAP_BAR_SEC = 90;
/** La pause après une paire : une minute aussi, à la fin de la paire, jamais
 *  entre deux tours. Chaque muscle se repose quand même pendant l'autre
 *  exercice de la paire. */
export const REPOS_PAIRE_SEC = 60;
/** Une paire qui compterait la trap bar (refaite à la main) : une minute
 *  trente. */
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

// ------------------------------------------------------------- Des classiques

/** Le premier mois, des exercices classiques seulement (décision de
 *  Sébastien, 13 octobre 2026) : ceux qu'on connaît déjà, pour apprivoiser
 *  l'application plutôt que des mouvements. Rien d'inhabituel — ni bouche
 *  d'incendie, ni moulin à vent, ni bûcheron, ni mollet sur une jambe lesté,
 *  ni tour de taille, ni relevé turc. Le programme ne pioche que dans cette
 *  liste, « Changer » aussi (`candidatsProgramme`) ; la bibliothèque et la
 *  séance libre gardent tout. Pour l'élargir : y ajouter des identifiants. */
export const EXERCICES_CLASSIQUES: readonly string[] = [
  // Haltères et banc : le haut du corps.
  'bench-press', 'incline-bench-press', 'chest-fly', 'dumbbell-push-up', 'dumbbell-pullover',
  'shoulder-press', 'arnold-press', 'side-raise', 'alternating-front-raise', 'reverse-fly', 'no-money-curl',
  'shoulder-shrug', 'single-arm-row', 'tripod-row', 'incline-row', 'bent-over-row', 'seesaw-row',
  'hammer-curl', 'grip-curl', 'alternating-curl', 'concentration-curl', 'seated-incline-curl',
  'tricep-kickback', 'tricep-extension', 'single-arm-tricep-extension', 'skull-crusher',
  // Haltères : les jambes, et porter.
  'squat', 'goblet-squat', 'sumo-squat', 'romanian-deadlift', 'glute-bridge', 'reverse-lunge', 'side-lunge',
  'calf-raise', 'farmers-walk',
  // Le kettlebell de base : le swing, le squat gobelet, les rowings…
  'kb-double-arm-swing', 'kb-goblet-squat', 'kb-deadlift', 'kb-lunge', 'kb-side-lunge', 'kb-single-arm-row',
  'kb-bent-over-row', 'kb-push-up', 'kb-chest-press', 'kb-shoulder-press', 'kb-side-raise', 'kb-front-raise',
  'kb-rear-fly', 'kb-alternating-curl', 'kb-concentration-curl', 'kb-incline-curl', 'kb-tricep-extension',
  'kb-tricep-kickback', 'kb-farmers-walk',
  // Le poids du corps : la planche, le gainage — et, choisis par Sébastien, le
  // Superman sans poids et la planche de Copenhague.
  'plank', 'side-plank', 'superman', 'copenhagen-plank',
  // Les machines de la salle, et le sac de sable de la finale.
  'trap-bar-deadlift', 'leg-press', 'hack-squat', 'leg-extension-machine', 'leg-curl-machine', 'traineau',
  'seated-calf-raise', 'sandbag-carry',
  // Ajoutés le 14 octobre 2026, pour le jeudi : le squat cosaque, qui remplace
  // la planche de Copenhague, et la montée sur marche, qui remplace les
  // mollets (déjà au mardi).
  'cossack-squat', 'step-up',
];

const CLASSIQUES = new Set(EXERCICES_CLASSIQUES);

/** Admis malgré leur niveau ou leur matériel : le squat cosaque (niveau 3)
 *  et la montée sur marche, qui se fait sur le banc de la salle. */
const ADMIS_A_PART = new Set(['cossack-squat', 'step-up']);

// ------------------------------------------------------------- La finale

/** La finale : dix minutes au chrono, juste avant les étirements, chaque
 *  jour, pour se vider (décision de Sébastien, 13 octobre 2026) — en durée,
 *  pas en tours. */
export const FINALE_SEC = 10 * 60;
/** Ce qu'on peut prendre au moment de la finale, dans l'ordre du sélecteur :
 *  le traîneau, la marche du fermier aux haltères, le sac de sable sur
 *  l'épaule. */
export const CHOIX_FINALE: readonly string[] = ['traineau', 'farmers-walk', 'sandbag-carry'];
/** Leurs noms courts, sur les boutons du sélecteur. */
export const NOM_FINALE: Record<string, string> = {
  traineau: 'Traîneau',
  'farmers-walk': 'Fermier',
  'sandbag-carry': 'Sac de sable',
};
/** Les exercices de la finale ne sont plus des exercices du programme : ni
 *  dans les séances, ni dans « Changer » (la marche du fermier au kettlebell
 *  avec eux). */
const EXERCICES_DE_FINALE = new Set([...CHOIX_FINALE, 'kb-farmers-walk']);

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
   *  dos, l'extérieur et l'intérieur de cuisse, le ventre (deux planches au
   *  premier mois) : la semaine B peut y reprendre celui de la semaine A
   *  quand elle n'en trouve pas d'autre, plutôt que de laisser l'objectif sans
   *  exercice. Les autres exercices de la semaine A restent interdits. */
  reprise?: boolean;
  /** Quand il y en a, ces exercices passent devant les autres. */
  preferer?: (exercice: Exercice) => boolean;
  /** Ces exercices n'y entrent jamais : ils ont leur place ailleurs. */
  sans?: (exercice: Exercice) => boolean;
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
  /** L'ouverture de la séance, le gros exercice du jour, frais : il se fait
   *  seul, chacun son tour — la trap bar le lundi, le développé couché le
   *  mardi, le swing le jeudi. La première de ces places qui trouve un
   *  exercice ouvre la séance ; les autres attendent d'avoir un partenaire. */
  seul?: boolean;
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
/** Le gainage qui vise aussi l'extérieur de la hanche — la planche latérale :
 *  il a sa place à l'extérieur de cuisse, pas à celle du ventre, qui garde la
 *  planche. Sans quoi le ventre la prendrait, et l'extérieur de cuisse
 *  resterait vide. */
const gainageDeHanche = (exercice: Exercice): boolean => (exercice.musclesPrincipaux ?? []).includes('abducteurs');

const principauxDe = (exercice: Exercice): Muscle[] => exercice.musclesPrincipaux ?? [];

/** Le lundi s'ouvre sur la trap bar, quand le dos est frais, seule, chacun
 *  son tour. Elle revient chaque lundi, semaine A comme semaine B. */
const CHARNIERE_TRAP_BAR: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], salle: true, preferer: (e) => e.materiel === 'salle', favoris: ['trap-bar-deadlift'], seul: true };
/** Sans les machines : un soulevé de terre roumain ou au kettlebell, seul
 *  aussi. Pas un pont fessier ; et le bas du dos a sa place à lui. */
const CHARNIERE_LIBRE: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], preferer: (e) => !principauxDe(e).includes('lombaires'), seul: true };
/** Le développé couché : il ouvre le mardi, chaque semaine. */
export const DEVELOPPE_DU_MARDI = 'bench-press';
/** Le mardi s'ouvre sur le développé couché, le gros exercice du haut du
 *  corps, seul, chacun son tour : l'autre pare. Il revient chaque mardi,
 *  semaine A comme semaine B, pour suivre ses charges, comme la trap bar le
 *  lundi et le swing le jeudi. Sans banc, un développé au sol ou des pompes. */
const POUSSEE_LOURDE: Emplacement = { cle: 'poussee', muscles: ['pectoraux', 'triceps', 'epaules'], principal: ['pectoraux'], patterns: ['poussee-horizontale'], preferer: (e) => e.materiel === 'banc', favoris: [DEVELOPPE_DU_MARDI], seul: true };

/** Le Superman du lundi, sans poids : au programme, il remplace celui au
 *  kettlebell (`HORS_PROGRAMME`). */
export const SUPERMAN = 'superman';
/** L'intérieur de cuisse du jeudi, chaque semaine : le squat cosaque, qui
 *  remplace la planche de Copenhague (14 octobre 2026 : Big Max a du mal avec
 *  elle) — de la mobilité de hanche pour le jiu-jitsu en prime. */
export const INTERIEUR_DU_JEUDI = 'cossack-squat';

/** Le swing à deux mains : le seul mouvement explosif du programme. Il ouvre
 *  le jeudi, au temps, léger — ce sont les fesses qui lancent, pas le dos. */
export const SWING_DU_JEUDI = 'kb-double-arm-swing';
/** Le jeudi s'ouvre sur le swing, chaque semaine, seul, chacun son tour. */
const SWING: Emplacement = { cle: 'swing', muscles: ['fessiers', 'ischios'], principal: ['fessiers', 'ischios'], parmi: [SWING_DU_JEUDI], favoris: [SWING_DU_JEUDI], seul: true };
/** Sans kettlebell, pas de swing : un squat ouvre le jeudi, seul aussi. */
const SQUAT_DU_JEUDI: Emplacement = { cle: 'ouverture-squat', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['squat'], preferer: (e) => e.cotes === 'bilateral', seul: true };

/** Les jambes légères, partenaires du haut du corps le mardi : le mollet, le
 *  fessier, l'intérieur et l'extérieur de cuisse (décision de Sébastien, 13
 *  octobre 2026, après la séance). */
const JAMBES_LEGERES = ['mollets', 'fessiers', 'adducteurs', 'abducteurs'];
/** Le dos et les épaules, partenaires des jambes le jeudi : un tirage — le
 *  rowing du lundi d'abord —, une élévation des épaules, un second tirage. */
const DOS_ET_EPAULES = ['tirage-leger', 'epaules', 'tirage-leger-bis'];
/** Les partenaires du haut du corps le lundi : le bas du dos (le Superman),
 *  l'extérieur et l'intérieur de cuisse, le ventre. */
const PARTENAIRES_DU_HAUT_LUNDI = ['bas-du-dos', 'abducteurs', 'adducteurs', 'tronc', 'mollets'];

/** Les places de base de chaque jour, après l'ouverture et les objectifs.
 *  Chacune dit avec quelles places elle fait une bonne paire : toujours une
 *  autre grande zone (`accordPaire`). Le lundi, le haut du corps avec le bas
 *  du dos ou l'intérieur et l'extérieur de cuisse ; le mardi, le haut du corps
 *  avec une jambe légère ; le jeudi, une jambe avec le dos ou les épaules. */
const BASE: Record<Gabarit, Emplacement[]> = {
  // Le lundi, tout le corps, le plus de jambes : la trap bar en tête, la
  // presse ou le hack squat pour finir (`DERNIERS`), et entre les deux,
  // l'intérieur et l'extérieur de cuisse, le dos, les pecs, les épaules.
  dure: [
    // On tire, sans charger le bas du dos — la trap bar l'a déjà fait : un
    // rowing poitrine contre le banc plutôt que buste penché. Un rowing
    // plutôt qu'un pull-over : le mardi et le jeudi le reprennent.
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes', 'biceps'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'], preferer: (e) => !chargeLeBasDuDos(e) && e.pattern === 'tirage-horizontal', avec: ['abducteurs', 'adducteurs', 'bas-du-dos', 'tronc', 'mollets'] },
    // On pousse une charge : un développé sur banc — un autre que le
    // développé couché, qui ouvre le mardi, le lendemain.
    { cle: 'poussee', muscles: ['pectoraux', 'triceps', 'epaules'], principal: ['pectoraux'], patterns: ['poussee-horizontale'], preferer: (e) => e.materiel === 'banc' && e.id !== DEVELOPPE_DU_MARDI, avec: ['adducteurs', 'abducteurs', 'bas-du-dos', 'tronc', 'mollets'] },
    // L'intérieur et l'extérieur de cuisse, chaque lundi, même sans leur
    // objectif : la fente latérale, la planche latérale.
    { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], preferer: (e) => e.pattern === 'fente', avec: ['poussee', 'tirage', 'dorsaux', 'epaules', 'oiseau'] },
    { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], avec: ['epaules', 'tirage', 'poussee', 'dorsaux', 'oiseau'] },
    // Un second tirage, pour le dos.
    { cle: 'dorsaux', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux', 'trapezes'], patterns: ['tirage-horizontal', 'tirage-vertical'], preferer: (e) => !chargeLeBasDuDos(e), avec: PARTENAIRES_DU_HAUT_LUNDI },
    // L'arrière des épaules, qui les tient en place.
    { cle: 'oiseau', muscles: ['epaules', 'trapezes', 'dorsaux'], principal: ['epaules', 'trapezes'], patterns: ['tirage-horizontal', 'tirage-vertical'], avec: PARTENAIRES_DU_HAUT_LUNDI },
    { cle: 'biceps', muscles: ['biceps', 'avant-bras'], principal: ['biceps'], avec: PARTENAIRES_DU_HAUT_LUNDI },
    { cle: 'triceps', muscles: ['triceps'], principal: ['triceps'], avec: PARTENAIRES_DU_HAUT_LUNDI },
    // Le ventre, le dos immobile : avec le haut du corps.
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: DOS_IMMOBILE, reprise: true, sans: gainageDeHanche, avec: ['tirage', 'poussee', 'epaules', 'dorsaux'] },
    { cle: 'jambes', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps'], patterns: ['squat', 'fente'], preferer: (e) => e.cotes === 'bilateral', avec: ['coiffe', 'epaules', 'oiseau', 'tirage'] },
    { cle: 'coiffe', muscles: ['coiffe-rotateurs', 'epaules'], principal: ['coiffe-rotateurs'], avec: ['jambes', 'mollets', 'tronc'] },
    { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers'], principal: ['lombaires'], preferer: (e) => !principauxDe(e).includes('ischios'), avec: ['poussee', 'epaules', 'tirage'] },
    // Les mollets : aux haltères, ou à la machine assise (`salle`).
    { cle: 'mollets', muscles: ['mollets'], principal: ['mollets'], salle: true, avec: ['tirage', 'epaules', 'poussee', 'coiffe', 'biceps', 'triceps'] },
  ],
  // Le jeudi, surtout les jambes (≈ 60 %), avec le dos et les épaules pour
  // partenaires (≈ 40 %) : un peu plus intense — trois jours sans salle
  // après —, mais jiu-jitsu le soir : ni trap bar, ni presse, ni hack squat
  // (`DANS_LE_JOUR`, `DERNIERS`). Le swing en tête, la montée sur marche pour finir.
  bas: [
    // Les deux machines des cuisses : l'extension des jambes (quadriceps) et
    // la flexion des jambes couché (ischios). Ce sont les préférées du duo :
    // elles viennent juste après les objectifs, chaque jeudi, semaine A comme
    // semaine B (`favoris`). Plus ensemble : deux exercices des jambes ne se
    // jumellent jamais. Sans les machines, ces places prennent d'autres
    // classiques des cuisses.
    { cle: 'cuisse-avant', muscles: ['quadriceps'], principal: ['quadriceps'], patterns: ['isolation'], favoris: ['leg-extension-machine'], avec: ['epaules', 'tirage-leger', 'tirage-leger-bis', 'tronc'] },
    { cle: 'cuisse-arriere', muscles: ['ischios'], principal: ['ischios'], patterns: ['isolation'], favoris: ['leg-curl-machine'], avec: ['tirage-leger-bis', 'tirage-leger', 'epaules', 'tronc'] },
    // Les partenaires des jambes : un tirage léger du haut du corps — un
    // rowing appuyé, l'arrière des épaules — ou une élévation des épaules,
    // rien qui charge le bas du dos ni qui coupe le souffle.
    { cle: 'tirage-leger', muscles: ['dorsaux', 'epaules', 'trapezes'], principal: ['dorsaux', 'epaules'], patterns: ['tirage-horizontal', 'isolation'], preferer: (e) => e.pattern === 'tirage-horizontal', avec: ['adducteurs', 'cuisse-arriere', 'cuisse-avant', 'fessiers', 'abducteurs', 'fente', 'squat'] },
    { cle: 'epaules', muscles: ['epaules', 'coiffe-rotateurs'], principal: ['epaules'], patterns: ['isolation'], preferer: (e) => sensDe(e) === 'pousse', avec: ['cuisse-avant', 'adducteurs', 'cuisse-arriere', 'fessiers', 'abducteurs', 'fente', 'squat'] },
    { cle: 'tirage-leger-bis', muscles: ['epaules', 'dorsaux', 'trapezes'], principal: ['dorsaux', 'epaules'], patterns: ['tirage-horizontal', 'isolation'], preferer: (e) => principauxDe(e).includes('epaules'), avec: ['cuisse-arriere', 'cuisse-avant', 'adducteurs', 'fessiers', 'abducteurs', 'fente', 'squat'] },
    // D'autres jambes, quand les objectifs en demandent.
    { cle: 'fente', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['fente'], avec: DOS_ET_EPAULES },
    { cle: 'squat', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps'], patterns: ['squat'], avec: DOS_ET_EPAULES },
    { cle: 'fessiers', muscles: ['fessiers'], principal: ['fessiers'], avec: DOS_ET_EPAULES },
    { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], avec: DOS_ET_EPAULES },
    { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], favoris: [INTERIEUR_DU_JEUDI], avec: DOS_ET_EPAULES },
    // Le ventre, quand le dos et les épaules manquent.
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: DOS_IMMOBILE, reprise: true, sans: gainageDeHanche, avec: ['cuisse-avant', 'cuisse-arriere', 'adducteurs', 'abducteurs', 'fente', 'squat', 'fessiers'] },
    { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers', 'ischios'], principal: ['lombaires'], avec: ['tirage-leger', 'tirage-leger-bis'] },
  ],
  // Le mardi, surtout le haut du corps (≈ 60 %) — après le développé couché,
  // les épaules, tirer, les bras —, avec des jambes légères pour partenaires
  // (≈ 40 %) : le mollet, le pont fessier, l'intérieur et l'extérieur de
  // cuisse. Rien de lourd pour les jambes, rien qui charge le bas du dos :
  // jiu-jitsu le soir.
  haut: [
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'], avec: JAMBES_LEGERES },
    { cle: 'epaules', muscles: ['epaules', 'coiffe-rotateurs'], principal: ['epaules'], patterns: ['poussee-verticale', 'isolation'], avec: ['fessiers', 'mollets', 'adducteurs', 'abducteurs'] },
    { cle: 'biceps', muscles: ['biceps', 'avant-bras'], principal: ['biceps'], avec: ['adducteurs', 'abducteurs', 'mollets', 'fessiers'] },
    { cle: 'triceps', muscles: ['triceps'], principal: ['triceps'], avec: ['abducteurs', 'adducteurs', 'fessiers', 'mollets'] },
    { cle: 'dorsaux', muscles: ['dorsaux'], principal: ['dorsaux'], patterns: ['tirage-vertical', 'tirage-horizontal'], avec: JAMBES_LEGERES },
    { cle: 'coiffe', muscles: ['coiffe-rotateurs'], principal: ['coiffe-rotateurs'], avec: JAMBES_LEGERES },
    { cle: 'trapezes', muscles: ['trapezes'], principal: ['trapezes'], avec: JAMBES_LEGERES },
    { cle: 'poussee-bis', muscles: ['pectoraux', 'triceps'], principal: ['pectoraux'], avec: JAMBES_LEGERES },
    { cle: 'oiseau', muscles: ['epaules', 'trapezes', 'dorsaux'], principal: ['dorsaux', 'trapezes'], patterns: ['tirage-horizontal', 'isolation'], avec: JAMBES_LEGERES },
    { cle: 'avant-bras', muscles: ['avant-bras', 'biceps'], principal: ['avant-bras'], avec: JAMBES_LEGERES },
    // Les jambes légères : elles attendent leur exercice du haut du corps.
    // Les mollets : aux haltères, ou à la machine assise (`salle`), légère.
    { cle: 'mollets', muscles: ['mollets'], principal: ['mollets'], salle: true, avec: ['tirage', 'epaules', 'biceps', 'triceps', 'dorsaux', 'coiffe'] },
    { cle: 'fessiers', muscles: ['fessiers'], principal: ['fessiers'], reprise: true, avec: ['tirage', 'epaules', 'biceps', 'triceps', 'dorsaux', 'coiffe'] },
    { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], reprise: true, avec: ['biceps', 'triceps', 'tirage', 'epaules', 'dorsaux', 'coiffe'] },
    { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], reprise: true, avec: ['biceps', 'triceps', 'tirage', 'epaules', 'dorsaux', 'coiffe'] },
    // Le ventre, quand les jambes légères manquent.
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: DOS_IMMOBILE, reprise: true, sans: gainageDeHanche, avec: ['epaules', 'tirage', 'biceps', 'triceps', 'dorsaux', 'coiffe'] },
  ],
};

/** Chaque objectif devient une place, dans les séances où il a sa place : le
 *  bas du dos le lundi (le jeudi, le swing travaille déjà l'arrière du
 *  corps) ; les épaules le mardi, et un développé le lundi ; l'extérieur de
 *  cuisse le lundi ; l'intérieur de cuisse le lundi (une fente latérale) et le
 *  jeudi (le squat cosaque). */
const PAR_OBJECTIF: Record<
  string,
  { emplacement: Emplacement; gabarits: Gabarit[]; surcharge?: Partial<Record<Gabarit, Partial<Emplacement>>> }
> = {
  'bas-du-dos': {
    // Le lundi, la trap bar a déjà chargé l'arrière des cuisses et le dos :
    // pour le bas du dos, le Superman, allongé, plutôt qu'une deuxième
    // charnière debout (le good morning) — et chaque semaine, le dos de
    // Speedy fatigue vite. Sans poids : une charge au bout des bras écrase le
    // bas du dos (McGill). Il est du tronc, comme le ventre : il va avec le
    // haut du corps — le développé au-dessus de la tête de l'objectif des
    // épaules d'abord : à quatre exercices, la seule paire sert les deux.
    emplacement: { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers', 'ischios'], principal: ['lombaires'], reprise: true, avec: ['epaules', 'poussee', 'tirage'] },
    gabarits: ['dure'],
    surcharge: { dure: { favoris: [SUPERMAN], preferer: (e) => !principauxDe(e).includes('ischios'), avec: ['epaules', 'poussee', 'tirage', 'dorsaux'] } },
  },
  epaules: {
    emplacement: { cle: 'epaules', muscles: ['epaules', 'coiffe-rotateurs'], principal: ['epaules'], avec: ['fessiers', 'mollets', 'adducteurs', 'abducteurs'] },
    gabarits: ['dure', 'haut'],
    // Le lundi, les épaules se travaillent lourd : un développé au-dessus de la
    // tête, avec le Superman ou une cuisse.
    surcharge: { dure: { muscles: ['epaules', 'triceps'], patterns: ['poussee-verticale'], avec: ['bas-du-dos', 'abducteurs', 'adducteurs', 'tronc', 'mollets'] } },
  },
  'exterieur-cuisse': {
    // Les stabilisateurs de la hanche : le premier mois, la planche latérale,
    // l'exercice classique de l'extérieur de cuisse. Le lundi, avec le haut du
    // corps — l'intérieur de cuisse ne va jamais avec lui : deux exercices des
    // jambes.
    emplacement: { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'], patterns: ['isolation'], reprise: true, avec: ['epaules', 'tirage', 'poussee', 'dorsaux', 'oiseau'] },
    gabarits: ['dure'],
  },
  'interieur-cuisse': {
    // Le squat cosaque, chaque jeudi (la planche de Copenhague, avant le 14
    // octobre 2026) : l'intérieur de cuisse, et la garde de Speedy.
    // Sans banc, une fente latérale. Le lundi, le jour lourd : la fente
    // latérale, une vraie charge pour l'intérieur de cuisse.
    emplacement: { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'], reprise: true, favoris: [INTERIEUR_DU_JEUDI], preferer: (e) => e.pattern === 'fente', avec: ['tirage-leger', 'epaules', 'tirage-leger-bis', 'tronc'] },
    gabarits: ['dure', 'bas'],
    surcharge: { dure: { favoris: undefined, avec: ['poussee', 'tirage', 'dorsaux', 'epaules', 'oiseau'] } },
  },
  bras: {
    emplacement: { cle: 'bras', muscles: ['biceps', 'triceps', 'avant-bras'], principal: ['biceps', 'triceps'], avec: ['adducteurs', 'abducteurs', 'mollets', 'fessiers'] },
    gabarits: ['haut'],
  },
  // Le ventre, le dos immobile : avec le haut du corps ou une jambe, tous les
  // jours.
  tronc: {
    emplacement: { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: DOS_IMMOBILE, reprise: true, sans: gainageDeHanche, avec: ['tirage', 'poussee', 'epaules', 'biceps', 'cuisse-avant', 'cuisse-arriere', 'adducteurs'] },
    gabarits: ['bas', 'dure', 'haut'],
  },
  jambes: {
    emplacement: { cle: 'jambes', muscles: ['quadriceps', 'fessiers', 'ischios'], principal: ['quadriceps', 'ischios'], avec: [...DOS_ET_EPAULES, 'tronc'] },
    gabarits: ['dure', 'bas'],
    surcharge: { dure: { avec: ['epaules', 'tirage', 'poussee', 'oiseau', 'coiffe', 'tronc'] } },
  },
  'haut-du-dos': {
    emplacement: { cle: 'tirage', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux', 'trapezes'], avec: JAMBES_LEGERES },
    gabarits: ['dure', 'haut'],
    surcharge: { dure: { avec: PARTENAIRES_DU_HAUT_LUNDI } },
  },
};

/** Combien d'exercices du haut du corps du lundi chaque mardi reprend : les
 *  gros exercices reviennent dans la semaine (décision de Sébastien, 13
 *  octobre 2026) — un développé, un rowing. */
const REPRISES_DU_MARDI = 2;

/** Une place pour un exercice du lundi que le mardi reprend : lui seul la
 *  remplit, avec une jambe légère pour partenaire, chaque semaine
 *  (`favoris`). */
const placeDeReprise = (exercice: Exercice): Emplacement => ({
  cle: `reprise-${exercice.id}`,
  muscles: principauxDe(exercice),
  principal: principauxDe(exercice),
  parmi: [exercice.id],
  favoris: [exercice.id],
  avec: JAMBES_LEGERES,
});

/** Les places d'une séance, dans l'ordre où on les remplit : l'ouverture
 *  d'abord, seule — le lundi, la trap bar, fraîche ; le mardi, le développé
 *  couché ; le jeudi, le swing (un squat sans kettlebell) —, puis les
 *  objectifs, puis les places de base. Le dernier exercice, seul, se choisit à
 *  part (`DERNIERS`). Avec, les reprises du lundi (les gros exercices
 *  reviennent dans la semaine) :
 *  - le mardi, après ses objectifs, ses deux premiers exercices du haut du
 *    corps qui ont leur place ce jour-là, chacun avec une jambe légère ; les
 *    places dont ils servent déjà les muscles laissent leur tour aux autres
 *    (les épaules et le dos servis, viennent les bras) ;
 *  - le jeudi, son premier tirage léger devient le favori de la place du
 *    tirage léger, partenaire des jambes — à défaut, son gainage, celui de
 *    la place du ventre. Jamais la trap bar, la presse ni le hack squat, qui
 *    n'ont pas leur place un jeudi. */
function emplacementsDe(gabarit: Gabarit, objectifs: string[], materiels: Materiel[], duLundi: Exercice[] = []): Emplacement[] {
  const parObjectif = objectifs
    .map((id) => PAR_OBJECTIF[id])
    .filter((o) => o !== undefined && o.gabarits.includes(gabarit))
    .map((o) => ({ ...o.emplacement, ...o.surcharge?.[gabarit] }));
  // Le mardi : les exercices du haut du lundi qu'il reprend, et les muscles
  // qu'ils servent déjà.
  const repris =
    gabarit === 'haut' ? duLundi.filter((e) => partieDe(e) === 'haut' && DANS_LE_JOUR.haut(e)).slice(0, REPRISES_DU_MARDI) : [];
  const servis = new Set(repris.flatMap(principauxDe));
  const servie = (place: Emplacement) => (place.principal ?? []).some((muscle) => servis.has(muscle));
  // Le jeudi : l'exercice du lundi qui devient le favori d'une place de
  // partenaire.
  const tirage = gabarit === 'bas' ? duLundi.find((e) => estTirageLeger(e) && DANS_LE_JOUR.bas(e)) : undefined;
  const gainage =
    gabarit === 'bas'
      ? duLundi.find((e) => partieDe(e) === 'tronc' && DOS_IMMOBILE.includes(e.pattern) && !grandesZonesDe(e).includes('bas'))
      : undefined;
  const reprise = tirage ? { cle: 'tirage-leger', id: tirage.id } : gainage ? { cle: 'tronc', id: gainage.id } : null;

  const resultat: Emplacement[] = [];
  const cles = new Set<string>();
  const ajouter = (emplacement: Emplacement) => {
    // L'ouverture reste toujours : le développé couché ouvre chaque mardi.
    if (cles.has(emplacement.cle) || (!emplacement.seul && servie(emplacement))) return;
    cles.add(emplacement.cle);
    resultat.push(reprise?.cle === emplacement.cle ? { ...emplacement, favoris: [reprise.id] } : emplacement);
  };
  const machines = materiels.includes('salle');
  if (gabarit === 'dure') ajouter(machines ? CHARNIERE_TRAP_BAR : CHARNIERE_LIBRE);
  if (gabarit === 'haut') ajouter(POUSSEE_LOURDE);
  if (gabarit === 'bas') {
    ajouter(SWING);
    ajouter(SQUAT_DU_JEUDI);
  }
  parObjectif.forEach(ajouter);
  repris.map(placeDeReprise).forEach((place) => {
    cles.add(place.cle);
    resultat.push(place);
  });
  BASE[gabarit].forEach(ajouter);
  return resultat;
}

// ------------------------------------------------------------- Le choix

/** Hors du programme, mais dans la bibliothèque et la séance libre : le
 *  Superman au kettlebell. Au programme, le Superman se fait sans poids
 *  (`SUPERMAN`) : une charge au bout des bras écrase le bas du dos, cambré
 *  (audit du 11 octobre 2026, point 1.5). La planche de Copenhague aussi : Big
 *  Max a du mal avec elle (14 octobre 2026). */
export const HORS_PROGRAMME = ['kb-superman', 'copenhagen-plank'];

/** Plie le dos : les crunchs, les V-ups, les relevés de buste (la flexion du
 *  tronc), et les rotations faites assis ou allongé — la rotation russe, les
 *  coups croisés en V. McGill les déconseille à un dos qui fatigue vite,
 *  surtout le matin (audit, point 1.5) : au programme, le ventre travaille
 *  le dos immobile (`DOS_IMMOBILE`). Ils restent dans la bibliothèque et la
 *  séance libre. */
export const plieLeDos = (exercice: Exercice): boolean =>
  exercice.pattern === 'flexion-tronc' ||
  (exercice.pattern === 'rotation' && /^(assis|allongé)/i.test(exercice.position));

/** Les exercices dont on peut composer un programme : des classiques
 *  (`EXERCICES_CLASSIQUES`), de musculation, avec le matériel de la salle,
 *  sans mouvement explosif ni niveau avancé (sauf `ADMIS_A_PART`), rien qui plie le dos
 *  (`plieLeDos`), sans ceux qu'on a mis de côté (`EXERCICES_MIS_DE_COTE`,
 *  `HORS_PROGRAMME`), ni ceux de la finale (le traîneau, la marche du
 *  fermier, le sac de sable), ni ce que l'un des deux évite (`aEviterPar`) :
 *  à deux, on fait les mêmes exercices. */
export function candidatsProgramme(materiels: Materiel[]): Exercice[] {
  const possedes = new Set<Materiel>(['aucun', ...materiels]);
  return EXERCICES.filter(
    (e) =>
      CLASSIQUES.has(e.id) &&
      familleDe(e) === 'musculation' &&
      (ADMIS_A_PART.has(e.id) || (possedes.has(e.materiel) && e.niveauMin <= 2)) &&
      !e.explosif &&
      !plieLeDos(e) &&
      !HORS_PROGRAMME.includes(e.id) &&
      !EXERCICES_MIS_DE_COTE.includes(e.id) &&
      !EXERCICES_DE_FINALE.has(e.id) &&
      !A_EVITER_A_DEUX.has(e.id),
  );
}

/** Allongé, sur le dos ou sur le ventre. */
const allonge = (exercice: Exercice): boolean => /^allongé/i.test(exercice.position);

/** Charge le bas du dos : les lombaires travaillent, en cible ou en soutien
 *  (soulevé de terre, rowing buste penché, good morning). Un pont fessier ou
 *  une ruade, allongés, où elles ne font que soutenir, ne comptent pas ; le
 *  Superman, qui les vise, si. */
export function chargeLeBasDuDos(exercice: Exercice): boolean {
  if (principauxDe(exercice).includes('lombaires')) return true;
  return musclesDe(exercice).includes('lombaires') && !allonge(exercice);
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
  /** La semaine B : les mouvements de la semaine A, ce jour-là. Quand elle
   *  peut les reprendre (`reprise`), ils ne viennent que faute d'autre. */
  deLaSemaineA?: Set<string>;
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
      (!emplacement.parmi || emplacement.parmi.includes(e.id)) &&
      !emplacement.sans?.(e),
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
        : (preferences.deLaSemaineA?.has(cleMouvement(e)) ? 8 : 0) +
          (preferences.dejaPris.has(cleMouvement(e)) ? 4 : 0) +
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

/** Un tirage léger du haut du corps : l'arrière des épaules (un oiseau) ou un
 *  rowing, rien qui charge le bas du dos. Le jeudi, c'est le partenaire du
 *  swing. */
const estTirageLeger = (e: Exercice) =>
  partieDe(e) === 'haut' &&
  sensDe(e) === 'tire' &&
  (e.pattern === 'tirage-horizontal' || (e.pattern === 'isolation' && vise(e, 'dorsaux', 'epaules'))) &&
  !chargeLeBasDuDos(e);

/** Une jambe légère, partenaire du haut du corps le mardi : un exercice
 *  d'isolation des jambes — le mollet, la planche de Copenhague — ou le pont
 *  fessier, allongé ; rien qui coupe le souffle. Les machines des cuisses
 *  restent au jeudi ; celle des mollets, assise et légère, y a sa place. */
const jambeLegere = (e: Exercice) =>
  partieDe(e) === 'bas' &&
  (e.pattern === 'isolation' || (e.pattern === 'charniere' && allonge(e))) &&
  (e.materiel !== 'salle' || vise(e, 'mollets'));

/** Une élévation des épaules, partenaire des jambes le jeudi : un exercice
 *  d'isolation des épaules, sans charger le bas du dos. */
const epauleLegere = (e: Exercice) =>
  partieDe(e) === 'haut' && e.pattern === 'isolation' && vise(e, 'epaules', 'coiffe-rotateurs') && !chargeLeBasDuDos(e);

/** Ce qui a sa place chaque jour : le lundi, tout, mais le haut du corps
 *  sans charger le bas du dos — la trap bar l'a déjà fait ; le mardi, le haut
 *  du corps, et pour partenaires une jambe légère, ou le ventre, le dos
 *  immobile — rien qui charge le bas du dos, jiu-jitsu le soir ; le jeudi, le
 *  bas du corps et le tronc, et pour partenaires un tirage léger ou une
 *  élévation des épaules. */
const DANS_LE_JOUR: Record<Gabarit, (exercice: Exercice) => boolean> = {
  dure: (e) => !(partieDe(e) === 'haut' && chargeLeBasDuDos(e)),
  bas: (e) =>
    partieDe(e) === 'bas' ||
    partieDe(e) === 'tronc' ||
    (partieDe(e) === 'corps-entier' && vise(e, ...MUSCLES_BAS)) ||
    estTirageLeger(e) ||
    epauleLegere(e),
  haut: (e) =>
    !chargeLeBasDuDos(e) &&
    (partieDe(e) === 'haut' || (partieDe(e) === 'tronc' && DOS_IMMOBILE.includes(e.pattern)) || jambeLegere(e)),
};

/** Le bas du corps seulement : les jambes et le bas du dos — ou un mouvement
 *  de tout le corps qui ne vise qu'eux, comme le swing. */
const basSeulement = (e: Exercice) =>
  partieDe(e) === 'bas' ||
  (partieDe(e) === 'corps-entier' &&
    principauxDe(e).length > 0 &&
    principauxDe(e).every((m) => m === 'lombaires' || MUSCLES_BAS.includes(m)));

/** Ce qui fait une bonne paire : deux exercices de deux grandes zones
 *  différentes (`grandesZonesDe`) — c'est la règle depuis le 12 octobre 2026 :
 *  le haut du corps avec le tronc ou le bas, le bas avec le tronc. Deux
 *  exercices de la même zone n'arrivent jamais jusqu'ici (`accordPaire`). Des
 *  plus précises aux plus larges : un exercice des quadriceps avec le bas du
 *  dos, ou le swing avec son tirage léger, valent un peu mieux. Chaque test lit
 *  la paire dans un sens ; on essaie les deux. */
const OPPOSITIONS: { raison: string; force: number; test: (a: Exercice, b: Exercice) => boolean }[] = [
  { raison: 'quadriceps ↔ bas du dos', force: 3, test: (a, b) => vise(a, 'quadriceps') && vise(b, 'lombaires') },
  // Le swing et son tirage léger : plus fort qu'un haut avec un bas
  // ordinaire, pour qu'ils restent ensemble — quand on les met en paire à la
  // main : au programme, le swing ouvre le jeudi, seul.
  { raison: 'haut ↔ bas', force: 4, test: (a, b) => estTirageLeger(a) && b.explosif === true && basSeulement(b) },
  { raison: 'haut ↔ bas', force: 2, test: (a, b) => zonesSeules(a, 'haut') && zonesSeules(b, 'bas') },
  { raison: 'haut ↔ tronc', force: 2, test: (a, b) => zonesSeules(a, 'haut') && zonesSeules(b, 'tronc') },
  { raison: 'bas ↔ tronc', force: 2, test: (a, b) => zonesSeules(a, 'bas') && zonesSeules(b, 'tronc') },
  // Un exercice de tout le corps (un thruster : le haut et le bas) ne va
  // qu'avec la zone qui lui reste.
  { raison: 'deux zones différentes', force: 1, test: (a, b) => !memeZone(a, b) },
];

/** L'exercice ne travaille que cette grande zone. */
const zonesSeules = (exercice: Exercice, zone: GrandeZone) => {
  const zones = grandesZonesDe(exercice);
  return zones.length === 1 && zones[0] === zone;
};

const oppositionDe = (a: Exercice, b: Exercice) => OPPOSITIONS.find((o) => o.test(a, b) || o.test(b, a));

/** Deux exercices en paire : un bon partenaire, ou un à éviter. */
export type Accord = 'bon' | 'bas-du-dos' | 'memes-muscles' | 'meme-zone' | 'souffle';

export interface AccordPaire {
  accord: Accord;
  /** Ce qui les unit (« pousser ↔ tirer ») ou pourquoi les éviter ensemble
   *  (« le bas du dos deux fois »). */
  raison: string;
}

/** La règle des paires : jamais deux exercices qui chargent le bas du dos,
 *  jamais les mêmes muscles principaux, jamais deux exercices de la même
 *  grande zone — le haut du corps, le bas du corps, le tronc (`memeZone`,
 *  décision du 12 octobre 2026) —, jamais deux exercices qui coupent le
 *  souffle (`estExigeant` : squat, charnière, fente, portage, tout le corps —
 *  comme dans les enchaînements de la séance libre). Deux zones différentes
 *  s'opposent : le haut avec le bas ou le tronc, le bas avec le tronc. */
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
  // Deux fois le haut du corps, deux fois les jambes, deux fois le tronc :
  // jamais en paire, l'exercice se fait seul.
  const zone = zoneCommune(a, b);
  if (zone) return { accord: 'meme-zone', raison: `deux fois ${NOM_GRANDE_ZONE[zone]}` };
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
  // Deux zones différentes : ils s'opposent.
  return { accord: 'bon', raison: oppositionDe(a, b)?.raison ?? 'deux zones différentes' };
}

/** Une machine avec un exercice libre : à deux, on se croise, personne
 *  n'attend. */
const BONUS_MACHINE = 2;
/** Deux machines différentes : on se croise aussi — Big Max commence sur
 *  l'une, Speedy sur l'autre, puis on échange. Les six machines de la salle
 *  sont toutes des jambes : deux d'entre elles ne vont plus jamais ensemble
 *  (`accordPaire`) ; le bonus attend une machine d'une autre zone. */
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
 *  gardé : chaque paire prend la place de son premier exercice. Une séance
 *  du programme y passe sans son ouverture (`pairesDeLaSeance`). */
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

/** L'ouverture d'une séance : son premier exercice, quand elle en compte un
 *  nombre impair — la trap bar, le développé couché, le swing. Il se fait
 *  seul, chacun son tour, et les paires automatiques le laissent de côté. Un
 *  nombre pair (une séance d'avant, sans ouverture) : tout va par paires. */
const ouvertureDe = (exercices: readonly string[]): string[] => (exercices.length % 2 === 1 ? exercices.slice(0, 1) : []);

/** Les paires automatiques d'une séance : celles de ses exercices, sans
 *  l'ouverture, qui reste en tête. */
function pairesDeLaSeance(exercices: string[]): { exercices: string[]; paires: string[][] } {
  const ouverture = ouvertureDe(exercices);
  const apparies = apparier(exercices.slice(ouverture.length));
  return { exercices: [...ouverture, ...apparies.exercices], paires: apparies.paires };
}

/** La séance avec ses paires automatiques. */
function avecPairesAutomatiques(seance: SeanceDuMois): SeanceDuMois {
  const { exercices, paires } = pairesDeLaSeance(seance.exercices);
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
  empreinte(pairesDeLaSeance(seance.exercices).paires) === empreinte(seance.liens);

/** « Refaire les paires » : la séance retrouve ses paires automatiques. */
export function refairePaires(programme: ProgrammeMois, seanceId: string): ProgrammeMois {
  return {
    ...programme,
    seances: programme.seances.map((s) => (s.id === seanceId ? avecPairesAutomatiques(s) : s)),
  };
}

// ------------------------------------------------------------- Le dernier exercice

/** Les machines lourdes des jambes : jamais un soir de jiu-jitsu (le mardi,
 *  le jeudi) — ni au programme, ni dans « Changer ». */
const MACHINES_LOURDES = ['trap-bar-deadlift', 'leg-press', 'hack-squat'];

/** Le dernier exercice de chaque séance, seul, chacun son tour (décisions de
 *  Sébastien, 13 octobre 2026, après la séance) : la marche du fermier et le
 *  traîneau sont passés à la finale. Le lundi, sans jiu-jitsu le soir : la
 *  presse ou le hack squat — le jour le plus lourd pour les jambes. Le mardi :
 *  des pompes, qui gardent la poigne pour les prises du kimono. Le jeudi : la
 *  montée sur marche, sur le banc — les mollets sont déjà au mardi (14
 *  octobre 2026) ; pas de machine lourde. */
const DERNIERS: Record<Gabarit, string[]> = {
  dure: ['leg-press', 'hack-squat'],
  bas: ['step-up'],
  haut: ['dumbbell-push-up', 'kb-push-up'],
};
/** Sans les machines de la salle, ou quand le dernier du jour est déjà pris :
 *  un squat. */
const DERNIERS_DE_SECOURS = ['goblet-squat', 'squat', 'kb-goblet-squat', 'sumo-squat'];

/** Un aller-retour de traîneau : pousser, puis tirer à reculons. */
const TRAINEAU_SEC = 30;
/** Un portage, au temps. */
const PORTAGE_SEC = 40;

/** Séries et répétitions du dernier exercice : celles de tous les exercices.
 *  Un programme d'avant la finale, s'il en reste, gardait le traîneau en
 *  allers-retours (un de plus que de séries) et la marche du fermier au
 *  temps. */
function volumeFinale(exercice: Exercice, series: number, reps: number): { series: number; reps: number } {
  if (exercice.id === 'traineau') return { series: series + 1, reps: TRAINEAU_SEC };
  if (exercice.unite === 'secondes') return { series, reps: PORTAGE_SEC };
  return { series, reps };
}

// ------------------------------------------------------------- La finale du jour

/** La finale de chaque jour, proposée — on peut prendre l'une des trois au
 *  moment de la finale (`CHOIX_FINALE`) : le lundi, la marche du fermier aux
 *  haltères ; le mardi, le sac de sable sur l'épaule (marche, escaliers
 *  permis) ; le jeudi, le traîneau. */
const FINALE_DU_JOUR: Record<Gabarit, string> = {
  dure: 'farmers-walk',
  haut: 'sandbag-carry',
  bas: 'traineau',
};

/** La finale d'une séance du programme : celle du jour, dix minutes. */
export function finaleChronoDe(seance: SeanceAGabarit): { exerciceId: string; dureeSec: number } {
  return { exerciceId: FINALE_DU_JOUR[gabaritDe(seance)], dureeSec: FINALE_SEC };
}

// ------------------------------------------------------------- Échauffement et étirements

/** Cinq minutes de tapis ou de rameur pour commencer… */
const CARDIO: MouvementGuide = {
  nom: 'Tapis ou rameur',
  consigne: 'Rythme facile : on peut parler, le souffle monte un peu.',
  dureeSec: 5 * 60,
  exerciceId: 'rameur',
};

/** … puis quatre mouvements actifs, à la grande boucle élastique, choisis
 *  pour le jour et ce qu'il va solliciter (15 octobre 2026 : Sébastien veut
 *  bouger, avec un élastique ou un poids léger, une image pour chacun) : le
 *  lundi, tout le corps ; le mardi, les épaules et le haut du dos ; le jeudi,
 *  les hanches et les fesses, avant le swing. */
const MOUVEMENT_SEC = 45;
const leger = (nom: string, consigne: string, exerciceId?: string): MouvementGuide => ({
  nom,
  consigne,
  dureeSec: MOUVEMENT_SEC,
  ...(exerciceId ? { exerciceId } : {}),
});

/** Un mouvement d'un seul côté : le côté droit, cinq secondes pour changer de
 *  côté (« CHANGE DE CÔTÉ », « +5 s » si besoin), puis le côté gauche — comme
 *  aux séries et à la routine du soir. */
function deuxCotes(nom: string, consigne: string, parCoteSec: number, exerciceId?: string): MouvementGuide[] {
  const image = exerciceId ? { exerciceId } : {};
  return [
    { nom: `${nom} · côté droit`, consigne, dureeSec: parCoteSec, ...image },
    { nom: 'Change de côté', consigne: 'On se replace pour le côté gauche.', dureeSec: CHANGER_DE_COTE_SEC, changementDeCote: true, ...image },
    { nom: `${nom} · côté gauche`, consigne, dureeSec: parCoteSec, ...image },
  ];
}
const ECARTES = leger('Écartés à l’élastique', 'Bras tendus devant, à hauteur d’épaules : on ouvre en serrant les omoplates, on revient lentement.', 'band-pull-apart');
const PASSAGE_EPAULES = leger('Passage d’épaules à l’élastique', 'Mains larges, bras tendus : l’élastique passe au-dessus de la tête jusque derrière, puis revient. Plus large si ça coince.', 'band-dislocate');
const ROTATION_EXTERNE = leger('Rotation externe à l’élastique', 'Coudes collés au corps, pliés à angle droit : on ouvre les avant-bras vers l’extérieur, lentement.', 'band-external-rotation');
const TIRAGE_VISAGE = leger('Tirage au visage à l’élastique', 'L’élastique accroché à un poteau, à hauteur du visage : on tire vers le front, coudes hauts et écartés.', 'band-face-pull');
const MARCHE_LATERALE = leger('Marche latérale à l’élastique', 'L’élastique en double au-dessus des genoux, mi-accroupi : 10 pas d’un côté, 10 de l’autre, les genoux poussent vers l’extérieur.', 'band-lateral-walk');
const GOOD_MORNING = leger('Good morning à l’élastique', 'Debout sur l’élastique, l’autre bout derrière la nuque : on plie aux hanches, dos plat, genoux souples.', 'band-good-morning');
const SQUAT_ELASTIQUE = leger('Squat à l’élastique', 'L’élastique en double au-dessus des genoux : on descend lentement, aussi bas que le genou le permet, genoux poussés vers l’extérieur.', 'band-squat');
const PONT_ELASTIQUE = leger('Pont fessier à l’élastique', 'Allongé sur le dos, l’élastique en double au-dessus des genoux : on monte le bassin en écartant un peu les genoux, on redescend lentement.', 'band-glute-bridge');
const MOUVEMENTS_LEGERS: Record<Gabarit, MouvementGuide[]> = {
  dure: [PASSAGE_EPAULES, MARCHE_LATERALE, GOOD_MORNING, SQUAT_ELASTIQUE],
  bas: [
    // Une jambe, puis l'autre : 20 s, 5 s pour changer, 20 s — les 45 s d'un mouvement.
    ...deuxCotes('Balancements de jambe', 'Une main au mur : d’avant en arrière, puis de côté.', (MOUVEMENT_SEC - CHANGER_DE_COTE_SEC) / 2, 'balancement-jambe'),
    MARCHE_LATERALE,
    SQUAT_ELASTIQUE,
    PONT_ELASTIQUE,
  ],
  haut: [ECARTES, PASSAGE_EPAULES, ROTATION_EXTERNE, TIRAGE_VISAGE],
};

/** Les étirements des jambes, à chaque fin de séance — le lundi, le mardi et
 *  le jeudi, semaines A et B —, les mêmes pour les deux : le mollet, l'avant de
 *  la cuisse, l'arrière de la cuisse et le fessier. Rien qui plie le genou en
 *  fente, rien en flexion avant debout, qui fatigue le bas du dos. Dans l'ordre
 *  qui change le moins de position : debout, sur le côté, puis sur le dos. */
const ETIREMENTS_JAMBES = ['etir-mollet-mur', 'etir-quadriceps-cote', 'etir-ischios-allonge', 'etir-fessier-chiffre-4'];
/** Cinq étirements du poster pour finir, une minute chacun — trente secondes
 *  de chaque côté, ils se font tous d'un côté, avec cinq secondes entre les
 *  deux pour changer de côté : 5 min 25 s. Les quatre des jambes d'abord, puis
 *  la torsion allongée, qui prend la place qui reste. */
const ETIREMENTS_DE_FIN = [...ETIREMENTS_JAMBES, 'etir-torsion-allongee'];
const ETIREMENT_SEC = 60;

/** L'échauffement d'une séance du programme : le cardio, puis les
 *  mouvements légers du jour. */
export function echauffementDe(seance: SeanceAGabarit): MouvementGuide[] {
  return [CARDIO, ...MOUVEMENTS_LEGERS[gabaritDe(seance)]];
}

/** Les étirements de fin d'une séance du programme, avec leur image : les
 *  mêmes à chaque séance, les jambes toujours. Un étirement d'un côté se fait en
 *  deux temps, droit puis gauche, avec cinq secondes pour changer de côté. */
export function etirementsDe(): MouvementGuide[] {
  return ETIREMENTS_DE_FIN.filter(estConnu).flatMap((id) => {
    const etirement = EXERCICES_PAR_ID[id];
    const consigne = etirement.pointsAttention[0] ?? '';
    if (etirement.cotes !== 'unilateral') {
      return [{ nom: etirement.nomFr, consigne, dureeSec: ETIREMENT_SEC, exerciceId: id }];
    }
    return deuxCotes(etirement.nomFr, consigne, ETIREMENT_SEC / 2, id);
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
  /** Le nombre d'exercices des séances, le dernier compris : 4, 6 ou 8 ;
   *  huit par défaut, les trois jours. */
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

/** On mesure une séance à deux, sur un seul téléphone, aux répétitions du
 *  jour. */
const MESURE: ContexteSeance = { personne: 'sebastien', aDeux: true, unTelephone: true };

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
  const swing =
    CLASSIQUES.has(SWING_DU_JEUDI) && materiels.includes(EXERCICES_PAR_ID[SWING_DU_JEUDI].materiel)
      ? [EXERCICES_PAR_ID[SWING_DU_JEUDI]]
      : [];
  const dejaPris = new Set<string>();

  /** Les exercices d'une séance, sans le dernier : l'ouverture, seule — le
   *  lundi la trap bar, le mardi le développé couché, le jeudi le swing —,
   *  puis les paires, jusqu'au nombre du jour : les objectifs d'abord, les
   *  reprises du lundi (`emplacementsDe`), puis le reste. Chaque place prend son
   *  exercice, puis lui cherche un partenaire d'une autre zone
   *  (`accordPaire`) : dans les places qu'elle suggère, puis dans les
   *  suivantes. Sans partenaire possible, la place est laissée. */
  const composer = (gabarit: Gabarit, interdits: Exercice[] = [], duLundi: Exercice[] = []): Exercice[] => {
    // Le nombre du jour compte le dernier exercice, choisi à part (`finaleDe`).
    const voulus = nombre - 1;
    // Le mardi, jiu-jitsu le soir : rien qui charge le bas du dos ; le jeudi,
    // les jambes, et le swing.
    const duJour = [...candidats, ...(gabarit === 'bas' ? swing : [])].filter(DANS_LE_JOUR[gabarit]);
    const bonsAvec = (exercice: Exercice) => duJour.filter((e) => accordPaire(exercice, e).accord === 'bon');
    const places = emplacementsDe(gabarit, objectifs, materiels, duLundi);
    const reserves = new Set(
      places.flatMap((p) => p.favoris ?? []).filter(estConnu).map((id) => cleMouvement(EXERCICES_PAR_ID[id])),
    );
    /** Les exercices pris, et la place de chacun : la séance suit l'ordre
     *  des places — l'ouverture, puis les objectifs. */
    const pris: { exercice: Exercice; place: number }[] = [];
    // Au plus un exercice sur trois qui charge le bas du dos, et jamais deux
    // dans une paire.
    const quotaDos = gabarit === 'dure' ? 3 : Math.ceil(voulus / 3);
    /** L'ouverture est déjà prise : une seule par séance. */
    const ouverte = () => pris.some((p) => places[p.place].seul === true);
    /** La semaine B : ce que la semaine A a fait ce jour-là passe après, même
     *  quand elle peut le reprendre — le même muscle, un autre exercice, s'il y
     *  en a un. */
    const deLaSemaineA = new Set(interdits.map(cleMouvement));

    /** Remplit ces places — l'ouverture seule, les autres deux par deux —,
     *  sans les mouvements exclus. */
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
          deLaSemaineA,
        };
      };
      const prendre = (exercice: Exercice, place: Emplacement) => {
        pris.push({ exercice, place: places.indexOf(place) });
        exclus.add(cleMouvement(exercice));
        dejaPris.add(cleMouvement(exercice));
      };
      /** Les places où chercher le partenaire : celles que la place suggère
       *  d'abord, puis les autres, dans l'ordre. Une place de favoris ne prête
       *  son exercice qu'aux places qu'elle désigne. Une place d'ouverture
       *  n'en prête jamais : elle se fait seule. */
      const ouChercher = (emplacement: Emplacement) => {
        const suggerees = emplacement.avec ?? [];
        const rang = (place: Emplacement) =>
          suggerees.includes(place.cle) ? suggerees.indexOf(place.cle) : suggerees.length;
        return restantes
          .filter((place) => !place.seul && (!place.favoris || (place.avec ?? []).includes(emplacement.cle)))
          .sort((a, b) => rang(a) - rang(b));
      };
      while (restantes.length > 0) {
        const emplacement = restantes.shift()!;
        // L'ouverture : la première place seule qui trouve un exercice.
        if (emplacement.seul) {
          if (ouverte() || pris.length + 1 > voulus) continue;
          const exercice = choisir(emplacement, duJour, preferences(), alea);
          if (exercice) prendre(exercice, emplacement);
          continue;
        }
        if (pris.length + 2 > voulus) break;
        // Un exercice n'entre que s'il a un partenaire possible.
        const aUnPartenaire = (premier: Exercice) =>
          ouChercher(emplacement).some((place) => classer(place, bonsAvec(premier), preferences(premier), { strict: true }).length > 0);
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
    // visent un muscle à peine servi (`reprise`), quand elle n'en trouve pas
    // d'autre, et les favoris (`favoris` : le développé couché du mardi, le
    // swing, le squat cosaque et les deux machines des cuisses du
    // jeudi, et les reprises du lundi), qui reviennent chaque semaine.
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
    const pool = possibles(DERNIERS[gabarit]).length > 0 ? possibles(DERNIERS[gabarit]) : possibles(DERNIERS_DE_SECOURS);
    if (pool.length === 0) return undefined;
    const nouvelles = pool.filter((e) => !dejaPris.has(cleMouvement(e)));
    const choix = nouvelles.length > 0 ? nouvelles : pool;
    const retenue = choix[Math.floor(alea() * choix.length)];
    dejaPris.add(cleMouvement(retenue));
    return retenue;
  };

  /** Une séance du programme : ses exercices par paires, puis le dernier,
   *  seul. Les machines se font chacun son tour, une pour deux — dans une
   *  paire aussi : sur un seul téléphone, l'un puis l'autre ; sur deux, on se
   *  croise. */
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

  /** Le mardi, le haut ; le jeudi, les jambes : en semaines A et B quand les
   *  jours alternent. */
  const mardi = (semaine: 'A' | 'B' | undefined) => enteteDe('mardi', 'le haut', 2, semaine, 'facile', 'haut');
  const jeudi = (semaine: 'A' | 'B' | undefined) => enteteDe('jeudi', 'les jambes', 4, semaine, 'facile', 'bas');
  // Le lundi d'abord : la séance de référence, tout le corps, où l'on pousse
  // et suit ses charges — la même chaque semaine (décision de Sébastien, 13
  // octobre 2026). Le mardi et le jeudi reprennent de ses exercices
  // (`emplacementsDe`), prennent d'autres exercices pour le reste, puis
  // alternent : la semaine B change ce qu'elle peut.
  const lundi = composer('dure');
  const semaineA = alternance ? 'A' : undefined;
  const mardiA = composer('haut', [], lundi);
  const jeudiA = composer('bas', [], lundi);
  const semaineB = alternance ? { mardi: composer('haut', mardiA, lundi), jeudi: composer('bas', jeudiA, lundi) } : null;
  // Huit exercices et l'alternance : le programme sur mesure de Sébastien
  // (22 octobre 2026) remplace les séances composées.
  const seances: SeanceDuMois[] =
    surMesureActif && alternance && nombre === EXERCICES_PAR_DEFAUT
      ? seancesSurMesure()
      : [
          seanceDe(enteteDe('lundi', 'tout le corps', 1, undefined, 'dure', 'complet'), 'dure', lundi),
          seanceDe(mardi(semaineA), 'haut', mardiA),
          seanceDe(jeudi(semaineA), 'bas', jeudiA),
          ...(semaineB ? [seanceDe(mardi('B'), 'haut', semaineB.mardi), seanceDe(jeudi('B'), 'bas', semaineB.jeudi)] : []),
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

/** Les points faibles d'une personne, cochés ou décochés dans les Réglages :
 *  les mêmes exercices, d'autres séries. Rangés dans l'ordre de la liste ;
 *  revenus à ceux par défaut, ils ne sont plus notés — le lien « Envoyer à
 *  Big Max » ne les transporte que s'ils changent. */
export function avecPointsFaibles(
  programme: ProgrammeMois,
  personne: Personne,
  liste: readonly PointFaible[],
): ProgrammeMois {
  const tous = { ...pointsFaiblesDe(programme), [personne]: POINTS_FAIBLES.filter((point) => liste.includes(point)) };
  const duo: ReglagesDuo = { ...programme.duo };
  if (memeContenu(tous, POINTS_FAIBLES_PAR_DEFAUT)) delete duo.pointsFaibles;
  else duo.pointsFaibles = tous;
  const suivant: ProgrammeMois = { ...programme, duo };
  if (Object.keys(duo).length === 0) delete suivant.duo;
  return suivant;
}

// ------------------------------------------------------------- La séance de chacun

/** Ce qui fait la séance du jour, au-delà des réglages du téléphone. */
export interface ContexteSeance {
  /** Qui s'entraîne sur ce téléphone ; absent, les réglages du téléphone. */
  personne?: Personne | null;
  /** À deux : sur un seul téléphone, celui qui le tient note pour l'autre
   *  aussi ; sur deux, une horloge commune avec l'autre. */
  aDeux?: boolean;
  /** La séance se mène sur un seul téléphone (`Seance.horloge.unTelephone`) :
   *  pas de minuteur pendant une série, la pause se lance d'un clic. Absent :
   *  l'horloge de la séance commune sur deux téléphones. */
  unTelephone?: boolean;
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
  /** Sur un seul téléphone, à deux : les mêmes, pour l'autre, d'après ce que
   *  ce téléphone a noté pour lui (`historiqueDe`). */
  ressentisAutre?: Record<string, 'leger' | 'lourd'>;
  /** Les points faibles de chacun (`pointsFaiblesDe`) : une série de plus aux
   *  exercices dont c'est le groupe principal. Absents, ceux par défaut. */
  pointsFaibles?: Record<Personne, PointFaible[]>;
}

/** La pause d'un exercice fait seul : une minute, une minute trente à la
 *  trap bar (décision du 12 octobre 2026). À deux, elle vient à la fin de
 *  l'exercice — chacun son tour, la série de l'un est le repos de l'autre ;
 *  seul, entre deux séries. */
export function reposDe(exercice: Exercice): number {
  return exercice.id === 'trap-bar-deadlift' ? REPOS_TRAP_BAR_SEC : REPOS_SEC;
}

/** La pause après une paire, à la fin de tous ses tours : une minute, et
 *  une minute trente si la trap bar y est. */
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
 *  matériel (le Superman sans poids, les planches), ni quand le matériel ne
 *  sert que d'appui (les pompes sur haltères) : rien à charger. */
export const chargeReglable = (exercice: Exercice): boolean =>
  exercice.materiel !== 'tapis' &&
  exercice.materiel !== 'aucun' &&
  exercice.appuiSeulement !== true &&
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
  const ressentisAutre = contexte.ressentisAutre ?? {};
  const cran = CRAN[uniteDeSeance(parametres)];
  /** Le cran que propose le ressenti d'une personne sur un exercice dont la
   *  charge se règle, s'il y en a un. */
  const ajustement = (exercice: Exercice, deQui: Record<string, 'leger' | 'lourd'>) =>
    chargeReglable(exercice) && Object.prototype.hasOwnProperty.call(deQui, exercice.id)
      ? { ajustementRessenti: deQui[exercice.id] === 'leger' ? cran : -cran }
      : {};
  // Les répétitions du jour : le lundi, Speedy en fait autant que Big Max.
  const repsDeChacun = { ...repsDuJour({}, seanceMois.jour), ...contexte.reps };
  const pointsFaibles = contexte.pointsFaibles ?? POINTS_FAIBLES_PAR_DEFAUT;

  /** Séries et répétitions d'une personne sur un exercice : trois séries, une
   *  de plus quand son groupe principal est un point faible de la personne. */
  const volumeDe = (qui: Personne | null, exercice: Exercice, finale: boolean) => {
    const series = SERIES_PROGRAMME + (qui && serieDePlus(pointsFaibles[qui], exercice) ? 1 : 0);
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
    return {
      exerciceId: exercice.id,
      series: mien.series,
      reps: mien.reps,
      reposSec: reposDe(exercice),
      ...(enTour.has(exercice.id) ? { tour: true } : {}),
      ...(partenaire
        ? {
            autre: {
              ...volumeDe(partenaire, exercice, finale),
              // Sur un seul téléphone, on propose aussi ses charges à l'autre.
              ...(contexte.unTelephone ? ajustement(exercice, ressentisAutre) : {}),
            },
          }
        : {}),
      ...ajustement(exercice, ressentis),
    };
  };

  // Les deux exercices d'une paire s'enchaînent sans pause, A, B, A, B ; la
  // pause vient après la paire : une minute, une minute trente avec la trap
  // bar. Un exercice hors paire se fait seul, avec sa pause.
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
    // Dix minutes au chrono avant les étirements, sur un seul téléphone : la
    // finale du jour, proposée.
    ...(contexte.unTelephone ? { finaleChrono: finaleChronoDe(seanceMois) } : {}),
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
    // Sur un seul téléphone : « Exercice terminé », puis la pause de fin.
    // Sinon, chaque nouvel exercice attend « Go » ; à deux, l'horloge est
    // commune.
    horloge: {
      ...(moi ? { personne: moi } : {}),
      ...(partenaire ? { partenaire: NOM_PERSONNE[partenaire], jeCommence: moi === COMMENCE } : {}),
      ...(contexte.unTelephone ? { unTelephone: true } : {}),
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

/** La séance du programme a été faite ce jour-là, au moins à moitié
 *  (`assezFaite`). */
export function faiteLe(
  historique: SeanceRealisee[],
  seance: Pick<SeanceDuMois, 'nom'>,
  date: Date,
): boolean {
  return historique.some((h) => h.titre === seance.nom && memeJour(new Date(h.date), date) && assezFaite(h));
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
    return h.titre === seance.nom && quand >= debut && quand < fin && assezFaite(h);
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

/** Le partenaire d'un exercice dans sa paire, s'il en a un. */
function partenaireDans(seance: Pick<SeanceDuMois, 'liens'>, exerciceId: string): Exercice | undefined {
  const autre = (seance.liens ?? []).find((paire) => paire.includes(exerciceId))?.find((id) => id !== exerciceId);
  return estConnu(autre) ? EXERCICES_PAR_ID[autre] : undefined;
}

/** Les remplaçants d'un exercice : ceux qui travaillent les mêmes muscles,
 *  hors de ceux déjà dans la séance. Le même schéma de mouvement d'abord, et
 *  ce qu'on ne fait pas déjà un autre jour avant ce qui revient. Dans une
 *  paire, seulement ceux qui vont avec le partenaire — une autre zone, et la
 *  règle des paires (`accordPaire`) ; s'il n'y en a aucun, tous : le choisi
 *  se fera seul (`remplacerDansProgramme`). Un soir de jiu-jitsu, jamais la
 *  trap bar, la presse ni le hack squat ; jamais un exercice de la finale. */
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
  // Les soirs de jiu-jitsu, rien de lourd pour les jambes.
  const jiuJitsu = JOURS_JIU_JITSU.includes(seance.jour);
  const libres = candidatsProgramme(programme.materiels).filter(
    (e) => !pris.has(cleMouvement(e)) && !(jiuJitsu && MACHINES_LOURDES.includes(e.id)),
  );
  const muscles = (actuel.musclesPrincipaux ?? []).length > 0 ? actuel.musclesPrincipaux! : musclesDe(actuel);
  const rang = (e: Exercice) => (e.pattern === actuel.pattern ? 0 : 2) + (ailleurs.has(cleMouvement(e)) ? 1 : 0);
  const proposes = exercicesPourMuscles(libres, muscles).sort((a, b) => rang(a) - rang(b));
  // Dans une paire : jamais deux exercices de la même zone (audit du 13
  // octobre 2026), ni rien que la règle des paires refuse.
  const partenaire = partenaireDans(seance, exerciceId);
  const vontAvec = partenaire ? proposes.filter((e) => accordPaire(e, partenaire).accord === 'bon') : proposes;
  return (vontAvec.length > 0 ? vontAvec : proposes).slice(0, maxi);
}

/** Change un exercice d'une séance. Le nouveau se fait chacun son tour s'il
 *  est sur machine, en même temps sinon. Dans une paire, s'il ne va pas avec
 *  le partenaire (`accordPaire` : la même zone, les mêmes muscles…), la paire
 *  est séparée : chacun se fait seul. Le lien court le dit par ses paires
 *  (`retouchesDe`) : un ancien lien se relit comme avant. */
export function remplacerDansProgramme(
  programme: ProgrammeMois,
  seanceId: string,
  ancienId: string,
  nouveauId: string,
): ProgrammeMois {
  return {
    ...programme,
    seances: programme.seances.map((s) =>
      s.id === seanceId ? sansPaireBancale(remplacerDansSeance(s, ancienId, nouveauId), nouveauId) : s,
    ),
  };
}

/** La séance, sans la paire de cet exercice s'il ne va pas avec son
 *  partenaire. */
function sansPaireBancale(s: SeanceDuMois, exerciceId: string): SeanceDuMois {
  const partenaire = partenaireDans(s, exerciceId);
  if (!partenaire || !estConnu(exerciceId)) return s;
  if (accordPaire(EXERCICES_PAR_ID[exerciceId], partenaire).accord === 'bon') return s;
  return rangee({ ...s, liens: (s.liens ?? []).filter((paire) => !paire.includes(exerciceId)) });
}

/** Change un exercice d'une séance : le lien court rejoue ainsi un
 *  « Changer » sur la séance composée. */
function remplacerDansSeance(s: SeanceDuMois, ancienId: string, nouveauId: string): SeanceDuMois {
  const surMachine = estConnu(nouveauId) && EXERCICES_PAR_ID[nouveauId].materiel === 'salle';
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

/** L'historique d'une personne, tel que ce téléphone le connaît : le sien
 *  pour la personne du téléphone ; pour l'autre, ce que ce téléphone a noté
 *  pour lui quand on s'entraînait à deux sur un seul téléphone (le
 *  `partenaire` de chaque séance faite). Les charges de la dernière fois et le
 *  ressenti s'en tirent de la même façon pour les deux. */
export function historiqueDe(
  historique: SeanceRealisee[],
  qui: Personne,
  proprietaire: Personne | null,
): SeanceRealisee[] {
  if (!proprietaire || qui === proprietaire) return historique;
  return historique.flatMap(({ partenaire, ...realisee }) =>
    partenaire?.personne === qui ? [{ ...realisee, exercices: partenaire.exercices }] : [],
  );
}

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

/** La finale se compte en allers-retours (15 octobre 2026) : l'objectif. */
export const OBJECTIF_ALLERS_RETOURS = 10;

/** Les allers-retours de la dernière fois, par finale, et le visage dit : la
 *  séance la plus récente où elle a été comptée. */
export function allersPasses(
  historique: SeanceRealisee[],
  ids: readonly string[],
): Record<string, { allersRetours: number; ressenti?: Ressenti }> {
  const resultat: Record<string, { allersRetours: number; ressenti?: Ressenti }> = {};
  for (const id of ids) {
    for (const realisee of historique) {
      const exo = realisee.exercices.find((e) => e.exerciceId === id);
      if (!exo?.allersRetours) continue;
      resultat[id] = { allersRetours: exo.allersRetours, ...(exo.ressenti ? { ressenti: exo.ressenti } : {}) };
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

/** Les points faibles lisibles : les deux personnes, chacune une liste de
 *  points connus, rangée dans l'ordre de la liste ; sinon rien. */
function lirePointsFaibles(brut: unknown): Record<Personne, PointFaible[]> | undefined {
  if (typeof brut !== 'object' || brut === null) return undefined;
  const lu = brut as Partial<Record<Personne, unknown>>;
  const liste = (valeur: unknown): PointFaible[] | null =>
    Array.isArray(valeur) ? POINTS_FAIBLES.filter((point) => valeur.includes(point)) : null;
  const sebastien = liste(lu.sebastien);
  const max = liste(lu.max);
  return sebastien && max ? { sebastien, max } : undefined;
}

/** Les réglages du duo qu'on peut lire : les répétitions, si les deux sont
 *  lisibles ; celles du lundi de Speedy ; un tempo de la liste ; un nombre
 *  d'exercices qu'on peut choisir ; les points faibles des deux. Un lien
 *  d'une version plus ancienne se lit pareil : ce qu'il n'a pas prend sa
 *  valeur par défaut, ce qu'on ne peut plus choisir (dix exercices) est
 *  écarté. */
function lireDuo(brut: unknown): ProgrammeMois['duo'] {
  const duo = brut as
    | {
        reps?: Partial<Record<Personne, unknown>>;
        repsLundi?: unknown;
        tempo?: unknown;
        exercices?: unknown;
        pointsFaibles?: unknown;
      }
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
  const pointsFaibles = lirePointsFaibles(duo?.pointsFaibles);
  const lu: ReglagesDuo = {
    ...(sebastien !== null && max !== null ? { reps: { sebastien, max } } : {}),
    ...(repsLundi !== null ? { repsLundi } : {}),
    ...(tempo ? { tempo: { ...tempo } } : {}),
    ...(exercices ? { exercices } : {}),
    ...(pointsFaibles ? { pointsFaibles } : {}),
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
  const version = programme.version ?? 1;
  if (version >= VERSION_PROGRAMME) return programme;
  const duo: ReglagesDuo = { ...programme.duo };
  // Avant la version 8, le nombre d'exercices choisi valait pour le mardi et
  // le jeudi, et le lundi en avait deux de plus : il ne dit plus la même
  // chose. On repart des huit décidés par Sébastien, les trois jours ; les
  // Réglages en proposent toujours moins. Même calcul sur les deux
  // téléphones, et pour un ancien lien.
  if (version < 8) delete duo.exercices;
  // Avant la version 10, Big Max avait par défaut une série de plus aux pecs,
  // aux épaules, aux biceps et aux triceps : un programme qui porte encore
  // exactement cette liste ne l'avait pas choisie — il repart à vide, comme
  // le nouveau défaut. Une liste changée à la main reste.
  if (version < 10 && duo.pointsFaibles && memeContenu(duo.pointsFaibles.max, ANCIENS_POINTS_FAIBLES_DE_BIG_MAX)) {
    const pointsFaibles = { ...duo.pointsFaibles, max: [] };
    if (memeContenu(pointsFaibles, POINTS_FAIBLES_PAR_DEFAUT)) delete duo.pointsFaibles;
    else duo.pointsFaibles = pointsFaibles;
  }
  const misAJour: ProgrammeMois = { ...programme, duo };
  if (Object.keys(duo).length === 0) delete misAJour.duo;
  return recomposer(misAJour);
}

/** Le programme en entier dans un lien : le format d'avant le lien court,
 *  qui reste celui des programmes que la recette ne sait pas refaire (un
 *  programme d'une autre version, une graine illisible). Une paire, et un
 *  exercice fait chacun son tour, s'y notent par leur place dans la séance
 *  plutôt que par leurs noms ; ce qui va de soi n'y est pas (le format en
 *  séries, une séance « facile »). Les liens d'avant, avec les noms, se
 *  lisent toujours (`validerProgramme`). */
export function encoderEnEntier(programme: ProgrammeMois): string {
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

// ------------------------------------------------------------- Le lien court

// Le lien court ne transporte que la recette du programme : l'application le
// recompose à l'identique avec la même graine, les mêmes réglages et la même
// version (`genererProgramme` ne tire rien au hasard hors de la graine), puis
// rejoue les retouches faites à la main. Des champs séparés par des points :
//
//   7.1kq2x9c.g02.3f0a[.champ…]
//
// la version de la composition, la graine et le premier lundi (en jours
// depuis 1970) en base 36, puis l'empreinte des séances : le téléphone qui
// reçoit vérifie qu'il retombe exactement sur les mêmes. Ensuite, seulement ce
// qui n'est pas la valeur par défaut, une lettre puis sa valeur :
//   o  les objectifs (leurs identifiants, séparés par « ~ ») ;
//   m  le matériel (une lettre chacun, `LETTRE_MATERIEL`) ;
//   a  les jours n'alternent pas (trois séances) ;
//   r  les répétitions de Speedy puis de Big Max ; l  celles du lundi ;
//   t  le tempo (montée, descente, arrêt) ; n  le nombre d'exercices ;
//   f  les points faibles de Speedy puis de Big Max, séparés par « ~ » : un
//      nombre en base 36 chacun, un bit par point, dans l'ordre de la liste ;
//   e  le code d'équipe (vide : celui tiré de la graine et du premier lundi) ;
//   s  le serveur en https (vide : celui du site), h  en http (sur ce poste) ;
//   0 à 9  les retouches d'une séance, par sa place dans le programme, en
//      morceaux séparés par « ~ » : c (un exercice changé : sa place dans la
//      séance composée, puis le nouveau), o (le nouvel ordre), p (les paires),
//      t (chacun son tour), les places en un chiffre de base 36.
// Un exercice se nomme par son identifiant, jamais par un rang dans la
// bibliothèque : un lien reste lisible quand la bibliothèque grandit.

/** Les matériels du lien court : une lettre chacun, fixée une fois pour
 *  toutes. */
const LETTRE_MATERIEL: Record<Materiel, string> = {
  aucun: 'a',
  halteres: 'h',
  kettlebell: 'k',
  banc: 'b',
  step: 'p',
  'barre-fixe': 'f',
  elastique: 'e',
  swissball: 'w',
  tapis: 't',
  salle: 's',
};
const MATERIEL_DE_LETTRE = new Map(Object.entries(LETTRE_MATERIEL).map(([materiel, lettre]) => [lettre, materiel as Materiel]));

/** Un identifiant d'exercice ou d'objectif tel que le lien le transporte. */
const IDENTIFIANT_LIEN = /^[a-z0-9-]+$/;
const BASE36 = /^[0-9a-z]+$/;

/** Un petit nombre en un caractère de base 36 ; null s'il n'y tient pas. */
const chiffre = (n: number | undefined): string | null =>
  n !== undefined && Number.isInteger(n) && n >= 0 && n < 36 ? n.toString(36) : null;
/** Un nombre en base 36, ou NaN. */
const lireBase36 = (texte: string | undefined): number => (texte && BASE36.test(texte) ? parseInt(texte, 36) : NaN);

/** Les places de ces exercices dans la liste, un chiffre chacune ; null si
 *  l'un n'y est pas. */
function places(ids: string[], liste: string[]): string | null {
  const chiffres = ids.map((id) => chiffre(liste.indexOf(id)));
  return chiffres.every((c) => c !== null) ? chiffres.join('') : null;
}
/** Les exercices à ces places ; null si une place est hors de la liste. */
function auxPlaces(texte: string, liste: string[]): string[] | null {
  const ids = [...texte].map((c) => liste[lireBase36(c)]);
  return ids.every((id) => id !== undefined) ? ids : null;
}

/** Des points faibles en un nombre : un bit par point, dans l'ordre de la
 *  liste. */
const masqueDe = (liste: readonly PointFaible[]): number =>
  POINTS_FAIBLES.reduce((masque, point, i) => (liste.includes(point) ? masque | (1 << i) : masque), 0);
/** Les points faibles d'un nombre ; null s'il ne se lit pas. */
const pointsDuMasque = (masque: number): PointFaible[] | null =>
  Number.isInteger(masque) && masque >= 0 && masque < 2 ** POINTS_FAIBLES.length
    ? POINTS_FAIBLES.filter((_, i) => (masque & (1 << i)) !== 0)
    : null;

const joursDepuis1970 = (iso: string): number => {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return Date.UTC(annee, mois - 1, jour) / JOUR_MS;
};
const isoDuJour = (jours: number): string => new Date(jours * JOUR_MS).toISOString().slice(0, 10);

/** L'empreinte des séances, quatre caractères : le téléphone qui reçoit
 *  vérifie qu'il retombe sur les mêmes. */
function empreinteDe(seances: SeanceDuMois[]): string {
  const texte = JSON.stringify(seances.map(rangee));
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 36 ** 4).toString(36).padStart(4, '0');
}

/** Une valeur aux clés rangées, sans les champs vides : deux programmes se
 *  comparent quel que soit l'ordre de leurs champs. */
function rangeeEnProfondeur(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(rangeeEnProfondeur);
  if (typeof valeur !== 'object' || valeur === null) return valeur;
  return Object.fromEntries(
    Object.entries(valeur)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([cle, v]) => [cle, rangeeEnProfondeur(v)]),
  );
}
const memeContenu = (a: unknown, b: unknown) => JSON.stringify(rangeeEnProfondeur(a)) === JSON.stringify(rangeeEnProfondeur(b));

/** Les retouches qui mènent de la séance composée à la séance retouchée :
 *  les exercices changés, puis l'ordre, les paires et chacun son tour s'ils
 *  diffèrent encore. Null si on ne sait pas les dire. */
function retouchesDe(composee: SeanceDuMois, seance: SeanceDuMois): string[] | null {
  const avant = idsDe(composee);
  const apres = idsDe(seance);
  const retires = avant.filter((id) => !apres.includes(id));
  const ajoutes = apres.filter((id) => !avant.includes(id));
  if (retires.length !== ajoutes.length) return null;
  // Un exercice changé garde sa place : on apparie d'abord à la même place.
  const libres = [...ajoutes];
  const changes: [string, string][] = [];
  const sansPlace: string[] = [];
  for (const id of retires) {
    const enFace = apres[avant.indexOf(id)];
    if (enFace !== undefined && libres.includes(enFace)) {
      changes.push([id, enFace]);
      libres.splice(libres.indexOf(enFace), 1);
    } else sansPlace.push(id);
  }
  sansPlace.forEach((id, i) => changes.push([id, libres[i]]));

  const morceaux: string[] = [];
  let s = composee;
  for (const [ancien, nouveau] of changes) {
    const place = chiffre(avant.indexOf(ancien));
    if (place === null || !IDENTIFIANT_LIEN.test(nouveau)) return null;
    morceaux.push(`c${place}${nouveau}`);
    s = remplacerDansSeance(s, ancien, nouveau);
  }
  if (s.exercices.join() !== seance.exercices.join()) {
    const ordre = places(seance.exercices, s.exercices);
    if (ordre === null || s.exercices.length !== seance.exercices.length) return null;
    morceaux.push(`o${ordre}`);
    s = { ...s, exercices: [...seance.exercices] };
  }
  if (JSON.stringify(s.liens ?? []) !== JSON.stringify(seance.liens ?? [])) {
    const liens = seance.liens ?? [];
    const paires = places(liens.flat(), seance.exercices);
    if (paires === null || liens.some((paire) => paire.length !== 2)) return null;
    morceaux.push(`p${paires}`);
  }
  if (JSON.stringify(s.tour ?? []) !== JSON.stringify(seance.tour ?? [])) {
    const tour = places(seance.tour ?? [], idsDe(seance));
    if (tour === null) return null;
    morceaux.push(`t${tour}`);
  }
  return morceaux;
}

/** Rejoue les retouches sur la séance composée ; null si un morceau est
 *  illisible. Les paires et chacun son tour sont ensuite vérifiés comme ceux
 *  d'un lien entier (`validerProgramme`). */
function rejouerRetouches(composee: SeanceDuMois, morceaux: string[]): SeanceDuMois | null {
  const avant = idsDe(composee);
  let s = composee;
  for (const morceau of morceaux) {
    const valeur = morceau.slice(1);
    if (morceau[0] === 'c') {
      const ancien = avant[lireBase36(valeur[0])];
      const nouveau = valeur.slice(1);
      if (ancien === undefined || !estConnu(nouveau)) return null;
      s = remplacerDansSeance(s, ancien, nouveau);
    } else if (morceau[0] === 'o') {
      const exercices = auxPlaces(valeur, s.exercices);
      if (!exercices || exercices.length !== s.exercices.length || new Set(exercices).size !== exercices.length) return null;
      s = { ...s, exercices };
    } else if (morceau[0] === 'p') {
      const ids = auxPlaces(valeur, s.exercices);
      if (!ids || ids.length % 2 !== 0) return null;
      s = { ...s, liens: ids.flatMap((id, i) => (i % 2 === 0 ? [[id, ids[i + 1]]] : [])) };
    } else if (morceau[0] === 't') {
      const tour = auxPlaces(valeur, idsDe(s));
      if (!tour) return null;
      s = { ...s, tour };
    } else return null;
  }
  return s;
}

/** La recette du programme : de quoi le recomposer. */
function recetteDe(programme: ProgrammeMois): OptionsProgramme {
  return {
    objectifs: programme.objectifs,
    materiels: programme.materiels,
    alternance: programme.seances.some((s) => s.semaine !== undefined),
    graine: programme.graine,
    exercices: nombreExercicesDe(programme),
    aujourdhui: depuisIso(programme.debut),
  };
}

/** Le lien court du programme, ou null s'il ne sait pas le dire exactement :
 *  le lien entier prend alors le relais. */
function encoderCourt(programme: ProgrammeMois, serveurDuSite: string | null): string | null {
  const { graine, debut, duo } = programme;
  if (programme.version !== VERSION_PROGRAMME || !Number.isInteger(graine) || graine < 0 || graine > 0xffffffff) {
    return null;
  }
  const jours = joursDepuis1970(debut);
  if (!Number.isInteger(jours) || jours < 0 || isoDuJour(jours) !== debut) return null;
  const champs = [VERSION_PROGRAMME.toString(36), graine.toString(36), jours.toString(36), empreinteDe(programme.seances)];

  if (!memeContenu(programme.objectifs, OBJECTIFS_PAR_DEFAUT)) {
    if (!programme.objectifs.every((id) => IDENTIFIANT_LIEN.test(id))) return null;
    champs.push(`o${programme.objectifs.join('~')}`);
  }
  if (!memeContenu(programme.materiels, MATERIELS_PROGRAMME)) {
    const lettres = programme.materiels.map((m) => (Object.prototype.hasOwnProperty.call(LETTRE_MATERIEL, m) ? LETTRE_MATERIEL[m] : null));
    if (!lettres.every((l) => l !== null)) return null;
    champs.push(`m${lettres.join('')}`);
  }
  const recette = recetteDe(programme);
  if (!recette.alternance) champs.push('a');
  if (duo?.reps) champs.push(`r${chiffre(duo.reps.sebastien)}${chiffre(duo.reps.max)}`);
  if (duo?.repsLundi !== undefined) champs.push(`l${chiffre(duo.repsLundi)}`);
  if (duo?.tempo) champs.push(`t${chiffre(duo.tempo.monteeSec)}${chiffre(duo.tempo.descenteSec)}${chiffre(duo.tempo.pauseSec ?? 0)}`);
  if (duo?.exercices !== undefined) champs.push(`n${chiffre(duo.exercices)}`);
  if (duo?.pointsFaibles) {
    champs.push(`f${masqueDe(duo.pointsFaibles.sebastien).toString(36)}~${masqueDe(duo.pointsFaibles.max).toString(36)}`);
  }
  if (programme.equipe !== undefined) {
    champs.push(`e${programme.equipe === equipeDe({ graine, debut }) ? '' : programme.equipe}`);
  }
  if (programme.serveur !== undefined && programme.serveur === serveurDuSite) champs.push('s');
  else if (programme.serveur !== undefined) {
    const [protocole, hote] = programme.serveur.split('://');
    if (!hote || hote.includes('~') || !/^https?$/.test(protocole)) return null;
    champs.push(`${protocole === 'https' ? 's' : 'h'}${hote.replace(/\./g, '~')}`);
  }

  const composees = genererProgramme(recette).seances;
  if (composees.length !== programme.seances.length || composees.length > 10) return null;
  for (const [i, seance] of programme.seances.entries()) {
    const morceaux = retouchesDe(composees[i], seance);
    if (morceaux === null) return null;
    if (morceaux.length > 0) champs.push(`${i}${morceaux.join('~')}`);
  }
  const code = champs.join('.');
  // Le lien ne part que s'il redonne exactement ce programme.
  const relu = decoderCourt(code, serveurDuSite, composees);
  return relu && memeContenu(relu, programme) ? code : null;
}

/** Le programme d'un lien court ; null s'il est illisible, ou si ce
 *  téléphone ne retombe pas exactement sur les séances envoyées (un lien
 *  d'une version plus récente de l'application, une bibliothèque qui a
 *  changé). Un lien d'une version plus ancienne est recomposé comme un
 *  programme de cette version (`mettreANiveau`) : sans ses retouches, comme
 *  le fera le téléphone qui l'a envoyé. */
function decoderCourt(code: string, serveurDuSite: string | null, dejaComposees?: SeanceDuMois[]): ProgrammeMois | null {
  const [v, g, j, empreinte, ...champs] = code.split('.');
  const version = lireBase36(v);
  const graine = lireBase36(g);
  const jours = lireBase36(j);
  if (!(version >= 1 && version <= VERSION_PROGRAMME) || !(graine <= 0xffffffff) || !(jours >= 0) || !empreinte) {
    return null;
  }
  const debut = isoDuJour(jours);
  let objectifs = [...OBJECTIFS_PAR_DEFAUT];
  let materiels = [...MATERIELS_PROGRAMME];
  let alternance = true;
  const duo: Record<string, unknown> = {};
  let equipe: string | undefined;
  let serveur: string | undefined;
  const retouches = new Map<number, string[]>();
  for (const champ of champs) {
    const valeur = champ.slice(1);
    const nombres = [...valeur].map((c) => lireBase36(c));
    switch (champ[0]) {
      case 'o':
        objectifs = valeur === '' ? [] : valeur.split('~');
        if (!objectifs.every((id) => IDENTIFIANT_LIEN.test(id))) return null;
        break;
      case 'm': {
        const lus = [...valeur].map((l) => MATERIEL_DE_LETTRE.get(l));
        if (!lus.every((m) => m !== undefined)) return null;
        materiels = lus as Materiel[];
        break;
      }
      case 'a':
        alternance = false;
        break;
      case 'r':
        duo.reps = { sebastien: nombres[0], max: nombres[1] };
        break;
      case 'l':
        duo.repsLundi = nombres[0];
        break;
      case 't':
        duo.tempo = { monteeSec: nombres[0], descenteSec: nombres[1], pauseSec: nombres[2] };
        break;
      case 'n':
        duo.exercices = nombres[0];
        break;
      case 'f': {
        const [sebastien, max] = valeur.split('~').map((partie) => pointsDuMasque(lireBase36(partie)));
        if (!sebastien || !max) return null;
        duo.pointsFaibles = { sebastien, max };
        break;
      }
      case 'e':
        equipe = valeur || equipeDe({ graine, debut });
        break;
      case 's':
        serveur = valeur ? `https://${valeur.replace(/~/g, '.')}` : (serveurDuSite ?? undefined);
        break;
      case 'h':
        serveur = `http://${valeur.replace(/~/g, '.')}`;
        break;
      default: {
        const place = Number(champ[0]);
        if (!Number.isInteger(place) || retouches.has(place)) return null;
        retouches.set(place, valeur.split('~'));
      }
    }
  }
  const brut: ProgrammeMois = {
    debut,
    objectifs,
    materiels,
    graine,
    seances: [],
    version,
    ...(Object.keys(duo).length > 0 ? { duo: duo as ReglagesDuo } : {}),
    ...(equipe !== undefined ? { equipe } : {}),
    ...(serveur !== undefined ? { serveur } : {}),
  };
  const composees = dejaComposees ?? genererProgramme({ ...recetteDe({ ...brut, duo: lireDuo(brut.duo) }), alternance }).seances;
  const aJour = version === VERSION_PROGRAMME;
  if (aJour && [...retouches.keys()].some((place) => place >= composees.length)) return null;
  const seances = composees.map((s, i) => (aJour && retouches.has(i) ? rejouerRetouches(s, retouches.get(i)!) : s));
  if (!seances.every((s) => s !== null)) return null;
  const programme = validerProgramme({ ...brut, seances });
  if (!programme || (aJour && empreinteDe(programme.seances) !== empreinte)) return null;
  return programme;
}

/** Le programme dans un lien : le lien court quand la recette redonne
 *  exactement ce programme, sinon le programme en entier. */
export function encoderProgramme(programme: ProgrammeMois, serveurDuSite: string | null = null): string {
  return encoderCourt(programme, serveurDuSite) ?? encoderEnEntier(programme);
}

/** Le programme d'un lien, court ou entier ; null s'il est illisible. */
export function decoderProgramme(code: string, serveurDuSite: string | null = null): ProgrammeMois | null {
  // Un point final, collé avec la phrase qui suivait le lien, n'en fait pas
  // partie.
  const nettoye = code.replace(/[.~:]+$/, '');
  try {
    if (nettoye.includes('.')) return decoderCourt(nettoye, serveurDuSite);
    return validerProgramme(JSON.parse(depuisBase64Url(nettoye)));
  } catch {
    return null;
  }
}

/** Le lien qui ouvre l'application avec ce programme. `serveurDuSite` :
 *  l'adresse fixée à la publication du site, que le lien court n'écrit pas
 *  en entier. */
export function lienDePartage(programme: ProgrammeMois, adresse: string, serveurDuSite: string | null = null): string {
  return `${adresse.split('#')[0]}#${CLE_LIEN}=${encoderProgramme(programme, serveurDuSite)}`;
}

/** Le programme contenu dans l'ancre d'une adresse, s'il y en a un. Une
 *  messagerie qui aurait encodé les « ~ » ne gêne pas. */
export function programmeDansLien(ancre: string, serveurDuSite: string | null = null): ProgrammeMois | null {
  let texte = ancre;
  try {
    texte = decodeURIComponent(ancre);
  } catch {
    // Un « % » isolé : on lit l'ancre telle quelle.
  }
  const trouve = texte.match(new RegExp(`${CLE_LIEN}=([A-Za-z0-9_.~:-]+)`));
  return trouve ? decoderProgramme(trouve[1], serveurDuSite) : null;
}

/** L'ancre porte un lien de programme. */
export const ancreAvecProgramme = (ancre: string): boolean => ancre.includes(`${CLE_LIEN}=`);
