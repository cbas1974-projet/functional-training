// Programme du mois : l'application compose les séances elle-même, dans la
// bibliothèque des posters, à partir d'objectifs musculaires — bas du dos,
// épaules, extérieur et intérieur de cuisse par défaut. Une séance dure le
// lundi, toujours la même ; des séances plus faciles le mardi et le jeudi, en
// enchaîné, qui alternent d'une semaine à l'autre : mêmes muscles, autres
// exercices. Chacun la suit sur son téléphone, avec ses séries et ses charges.
import type {
  BlocSeries,
  Exercice,
  Materiel,
  Muscle,
  ParametresSeance,
  PatternMoteur,
  Personne,
  ProgrammeMois,
  Seance,
  SeanceDuMois,
  SeanceRealisee,
  UnitePoids,
} from '../types';
import { EXERCICES, EXERCICES_PAR_ID } from '../data/exercices';
import {
  cleMouvement,
  echauffementSec,
  estimerDureeSec,
  familleDe,
  retourCalmeSec,
} from './generateurSeance';
import { exercicesPourMuscles, musclesDe } from './muscles';
import { convertirPoids, uniteDeSeance } from './statistiques';

/** L'identifiant désigne bien un exercice de la bibliothèque — et non une
 *  propriété héritée comme « constructor », qu'un lien trafiqué glisserait. */
const estConnu = (id: unknown): id is string =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(EXERCICES_PAR_ID, id);

// ------------------------------------------------------------- Les personnes

export const PERSONNES: { id: Personne; nom: string; seriesJourFacile: number }[] = [
  // Le jiu-jitsu vient le soir des jours faciles : une série de moins.
  { id: 'sebastien', nom: 'Sébastien', seriesJourFacile: 2 },
  { id: 'max', nom: 'Max', seriesJourFacile: 3 },
];

export const NOM_PERSONNE: Record<Personne, string> = { sebastien: 'Sébastien', max: 'Max' };

export const autrePersonne = (personne: Personne): Personne =>
  personne === 'sebastien' ? 'max' : 'sebastien';

// ------------------------------------------------------------- Réglages

/** Les faiblesses déclarées : c'est autour d'elles que le programme se bâtit. */
export const OBJECTIFS_PAR_DEFAUT = ['bas-du-dos', 'epaules', 'exterieur-cuisse', 'interieur-cuisse'];

/** Ce qu'on trouve dans la salle : haltères, kettlebells, bancs, tapis. */
export const MATERIELS_PROGRAMME: Materiel[] = ['halteres', 'kettlebell', 'banc', 'tapis'];

/** Une séance vise l'heure, échauffement et étirements compris. */
const DUREE_REFERENCE_MIN = 60;
/** Au-delà, la séance dure perd ses derniers exercices. */
export const DUREE_MAXI_SEC = 65 * 60;
/** Repos après une série, ou après un tour d'enchaîné : en salle, c'est le
 *  temps que l'autre fasse la sienne. */
export const REPOS_SEC = 90;
/** Tenue des exercices au temps : planche, marche du fermier. */
const TENUE_SEC = 30;
/** Un enchaîné, c'est trois exercices à la suite, puis la pause. */
export const TAILLE_ENCHAINEMENT = 3;
/** Neuf exercices les jours faciles : trois enchaînements de trois. */
const EXERCICES_JOUR_FACILE = 9;
/** On tire parmi les meilleurs candidats d'un emplacement : deux programmes
 *  ne se ressemblent pas tous, sans jamais prendre un exercice hors sujet. */
const MEILLEURS = 3;

// ------------------------------------------------------------- Emplacements

/** Une place dans une séance : les muscles qu'elle doit travailler. */
interface Emplacement {
  /** Deux emplacements de même clé ne cohabitent pas dans une séance. */
  cle: string;
  muscles: Muscle[];
  /** Au moins un de ces muscles doit être la cible de l'exercice. */
  principal?: Muscle[];
  patterns?: PatternMoteur[];
  /** Quand il y en a, ces exercices passent devant les autres. */
  preferer?: (exercice: Exercice) => boolean;
}

/** Lundi : tout le corps, lourd. Mardi : le bas. Jeudi : le haut. */
type Gabarit = 'dure' | 'bas' | 'haut';

const TRONC: PatternMoteur[] = ['anti-rotation', 'flexion-tronc', 'rotation', 'flexion-laterale'];

const BASE: Record<Gabarit, Emplacement[]> = {
  dure: [
    // Le jour dur, les jambes poussent lourd : un squat, à deux jambes. Les
    // fentes, qui tordent le genou, attendent les jours faciles.
    { cle: 'jambes', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['squat'], preferer: (e) => e.cotes === 'bilateral' },
    // Une vraie charnière, lourde : soulevé de terre roumain ou au kettlebell.
    // Pas un pont fessier ; et le bas du dos a sa place à lui.
    { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], preferer: (e) => !(e.musclesPrincipaux ?? []).includes('lombaires') },
    // Le jour dur, on pousse une charge : un développé sur banc avant les pompes.
    { cle: 'poussee', muscles: ['pectoraux', 'triceps', 'epaules'], principal: ['pectoraux'], patterns: ['poussee-horizontale'], preferer: (e) => e.materiel === 'banc' },
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes', 'biceps'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'] },
    { cle: 'portage', muscles: ['avant-bras', 'trapezes', 'obliques'], patterns: ['portage'] },
  ],
  bas: [
    { cle: 'fente', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['fente'] },
    { cle: 'ischios', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'] },
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: TRONC },
    { cle: 'fessiers', muscles: ['fessiers'], principal: ['fessiers'] },
    { cle: 'squat', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps'], patterns: ['squat'] },
    { cle: 'mollets', muscles: ['mollets'], principal: ['mollets'] },
  ],
  haut: [
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'] },
    { cle: 'poussee', muscles: ['pectoraux', 'triceps'], principal: ['pectoraux'], patterns: ['poussee-horizontale', 'poussee-verticale'] },
    { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: TRONC },
    { cle: 'coiffe', muscles: ['coiffe-rotateurs'], principal: ['coiffe-rotateurs'] },
    { cle: 'biceps', muscles: ['biceps', 'avant-bras'], principal: ['biceps'] },
    { cle: 'triceps', muscles: ['triceps'], principal: ['triceps'] },
    { cle: 'rotation', muscles: ['obliques'], principal: ['obliques'], patterns: ['rotation', 'anti-rotation'] },
    { cle: 'dorsaux', muscles: ['dorsaux'], principal: ['dorsaux'], patterns: ['tirage-vertical', 'tirage-horizontal'] },
  ],
};

/** Chaque objectif devient une place, dans les séances où il a sa place. */
const PAR_OBJECTIF: Record<
  string,
  { emplacement: Emplacement; gabarits: Gabarit[]; surcharge?: Partial<Record<Gabarit, Partial<Emplacement>>> }
> = {
  'bas-du-dos': {
    emplacement: { cle: 'bas-du-dos', muscles: ['lombaires', 'fessiers', 'ischios'], principal: ['lombaires'] },
    gabarits: ['dure', 'bas'],
    // Le lundi, le soulevé de terre a déjà chargé l'arrière des cuisses : pour
    // le bas du dos, un exercice qui ne soit pas une deuxième charnière lourde.
    surcharge: { dure: { preferer: (e) => !(e.musclesPrincipaux ?? []).includes('ischios') } },
  },
  epaules: {
    emplacement: { cle: 'epaules', muscles: ['epaules', 'coiffe-rotateurs'], principal: ['epaules'] },
    gabarits: ['dure', 'haut'],
    // Le lundi, les épaules se travaillent lourd : un développé au-dessus de la tête.
    surcharge: { dure: { muscles: ['epaules', 'triceps'], patterns: ['poussee-verticale'] } },
  },
  'exterieur-cuisse': {
    emplacement: { cle: 'abducteurs', muscles: ['abducteurs'], principal: ['abducteurs'] },
    gabarits: ['bas'],
  },
  'interieur-cuisse': {
    emplacement: { cle: 'adducteurs', muscles: ['adducteurs'], principal: ['adducteurs'] },
    gabarits: ['bas'],
  },
  bras: {
    emplacement: { cle: 'bras', muscles: ['biceps', 'triceps', 'avant-bras'], principal: ['biceps', 'triceps'] },
    gabarits: ['haut'],
  },
  tronc: {
    emplacement: { cle: 'tronc', muscles: ['abdominaux', 'obliques'], principal: ['abdominaux', 'obliques'], patterns: TRONC },
    gabarits: ['bas', 'haut'],
  },
  jambes: {
    emplacement: { cle: 'jambes', muscles: ['quadriceps', 'fessiers', 'ischios'], principal: ['quadriceps', 'ischios'] },
    gabarits: ['dure', 'bas'],
  },
  'haut-du-dos': {
    emplacement: { cle: 'tirage', muscles: ['dorsaux', 'trapezes'], principal: ['dorsaux', 'trapezes'] },
    gabarits: ['dure', 'haut'],
  },
};

/** Les places d'une séance, dans l'ordre où on les remplit. */
function emplacementsDe(gabarit: Gabarit, objectifs: string[]): Emplacement[] {
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
    // Les gros mouvements d'abord, frais ; les objectifs ensuite ; le
    // portage pour finir, quand la prise peut lâcher sans danger.
    BASE.dure.filter((e) => e.cle !== 'portage').forEach(ajouter);
    parObjectif.forEach(ajouter);
    BASE.dure.filter((e) => e.cle === 'portage').forEach(ajouter);
    return resultat;
  }
  parObjectif.forEach(ajouter);
  BASE[gabarit].forEach(ajouter);
  return resultat.slice(0, EXERCICES_JOUR_FACILE);
}

// ------------------------------------------------------------- Le choix

/** Les exercices dont on peut composer un programme : musculation, avec le
 *  matériel de la salle, sans mouvement explosif ni niveau avancé. */
export function candidatsProgramme(materiels: Materiel[]): Exercice[] {
  const possedes = new Set<Materiel>(['aucun', ...materiels]);
  return EXERCICES.filter(
    (e) => familleDe(e) === 'musculation' && possedes.has(e.materiel) && e.niveauMin <= 2 && !e.explosif,
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

/** Remplit une place : les exercices qui la visent le mieux, puis un tirage
 *  parmi les trois premiers. On relâche les exigences pas à pas plutôt que de
 *  laisser la place vide. */
function choisir(
  emplacement: Emplacement,
  candidats: Exercice[],
  preferences: Preferences,
  alea: () => number,
): Exercice | null {
  const libres = candidats.filter((e) => !preferences.exclus.has(cleMouvement(e)));
  const filtres: ((e: Exercice) => boolean)[] = [
    (e) => (!emplacement.patterns || emplacement.patterns.includes(e.pattern)) && viseLePrincipal(e, emplacement.principal),
    (e) => viseLePrincipal(e, emplacement.principal),
    () => true,
  ];
  for (const filtre of filtres) {
    const classes = exercicesPourMuscles(libres.filter(filtre), emplacement.muscles);
    if (classes.length === 0) continue;
    const rang = (e: Exercice) =>
      (preferences.dejaPris.has(cleMouvement(e)) ? 4 : 0) +
      (preferences.repousser?.(e) ? 2 : 0) +
      (emplacement.preferer && !emplacement.preferer(e) ? 1 : 0);
    const ordonnes = [...classes].sort((a, b) => rang(a) - rang(b));
    const tete = ordonnes.slice(0, MEILLEURS).filter((e) => rang(e) === rang(ordonnes[0]));
    const poids = tete.map((_, i) => MEILLEURS - i);
    let tirage = alea() * poids.reduce((somme, p) => somme + p, 0);
    for (let i = 0; i < tete.length; i += 1) {
      tirage -= poids[i];
      if (tirage < 0) return tete[i];
    }
    return tete[0];
  }
  return null;
}

/** Range les exercices d'un jour facile en enchaînements de trois, avec au
 *  plus un exercice qui charge le bas du dos par enchaînement : enchaîner
 *  deux charnières, c'est le dos qui lâche avant les jambes. */
export function enEnchainements(exercices: Exercice[]): Exercice[] {
  const nombre = Math.max(1, Math.ceil(exercices.length / TAILLE_ENCHAINEMENT));
  const blocs: Exercice[][] = Array.from({ length: nombre }, () => []);
  const dos = exercices.filter(chargeLeBasDuDos);
  const autres = exercices.filter((e) => !chargeLeBasDuDos(e));
  dos.forEach((exercice, i) => blocs[i % nombre].push(exercice));
  // Chaque bloc se remplit jusqu'à trois avant le suivant : la séance guidée
  // redécoupe la liste trois par trois, elle doit retomber sur ces blocs-là.
  for (const exercice of autres) {
    const cible = blocs.find((bloc) => bloc.length < TAILLE_ENCHAINEMENT) ?? blocs[blocs.length - 1];
    cible.push(exercice);
  }
  return blocs.flat();
}

// ------------------------------------------------------------- Le programme

export interface OptionsProgramme {
  objectifs?: string[];
  materiels?: Materiel[];
  /** Mardi et jeudi changent d'une semaine à l'autre (cinq séances) ou non
   *  (trois séances). */
  alternance?: boolean;
  graine?: number;
  aujourdhui?: Date;
}

/** Paramètres de référence pour mesurer une séance : 3 séries de 8 au tempo
 *  3 s / 3 s + 2 s en bas. */
const REFERENCE: Pick<ParametresSeance, 'seriesParExercice' | 'repsParSerie' | 'tempo'> = {
  seriesParExercice: 3,
  repsParSerie: 8,
  tempo: { monteeSec: 3, descenteSec: 3, pauseSec: 2 },
};

/** Les jours faciles se mesurent avec trois tours : ceux de Max. */
const REFERENCE_FACILE = { ...REFERENCE, seriesJourFacile: 3 };

/** Réglages complets autour de la référence, pour construire une séance de
 *  mesure. */
const parametresMinimaux: ParametresSeance = {
  dureeMinutes: DUREE_REFERENCE_MIN,
  zones: ['bas', 'haut', 'dos', 'gainage', 'complet'],
  niveau: 'intermediaire',
  discipline: 'musculation',
  format: 'series',
  tempo: REFERENCE.tempo,
  materiels: ['halteres'],
  explosifs: false,
  seriesParExercice: 3,
  repsParSerie: 8,
  guideVisuel: 'les-deux',
};

export function genererProgramme(options: OptionsProgramme = {}): ProgrammeMois {
  const objectifs = options.objectifs ?? OBJECTIFS_PAR_DEFAUT;
  const materiels = options.materiels ?? MATERIELS_PROGRAMME;
  const alternance = options.alternance ?? true;
  const graine = (options.graine ?? Date.now()) >>> 0;
  const alea = aleatoire(graine);
  const candidats = candidatsProgramme(materiels);
  const dejaPris = new Set<string>();

  const composer = (gabarit: Gabarit, interdits: Exercice[] = []): Exercice[] => {
    const pris: Exercice[] = [];
    const exclus = new Set(interdits.map(cleMouvement));
    const emplacements = emplacementsDe(gabarit, objectifs);
    // Les jours faciles, autant d'exercices pour le bas du dos que
    // d'enchaînements, pas plus.
    const quotaDos = gabarit === 'dure' ? 3 : Math.ceil(emplacements.length / TAILLE_ENCHAINEMENT);
    for (const emplacement of emplacements) {
      const tropDeDos = pris.filter(chargeLeBasDuDos).length >= quotaDos;
      const choisi = choisir(
        emplacement,
        candidats,
        {
          exclus,
          dejaPris,
          // Le lundi, les mouvements à deux mains d'abord : plus lourds, et une
          // série unilatérale coûte deux fois le temps.
          repousser: (e) =>
            (tropDeDos && chargeLeBasDuDos(e)) || (gabarit === 'dure' && e.cotes === 'unilateral'),
        },
        alea,
      );
      if (!choisi) continue;
      pris.push(choisi);
      exclus.add(cleMouvement(choisi));
      dejaPris.add(cleMouvement(choisi));
    }
    return pris;
  };

  const facile = (
    id: string,
    nom: string,
    jour: number,
    semaine: 'A' | 'B' | undefined,
    exercices: Exercice[],
  ): SeanceDuMois => {
    const seance = (liste: Exercice[]): SeanceDuMois => ({
      id,
      nom,
      jour,
      ...(semaine ? { semaine } : {}),
      type: 'facile',
      format: 'enchaine',
      exercices: enEnchainements(liste).map((e) => e.id),
    });
    // Même avec trois tours — ceux de Max —, un jour facile tient dans
    // l'heure : on retire les dernières places, les moins prioritaires.
    let retenus = exercices;
    while (retenus.length > 6 && dureeSec(seance(retenus), REFERENCE_FACILE) > DUREE_MAXI_SEC) {
      retenus = retenus.slice(0, -1);
    }
    // Plus d'exercices pour le bas du dos que d'enchaînements : deux finiraient
    // ensemble. On retire les derniers en trop ; l'objectif « bas du dos »,
    // placé en tête, reste.
    while (retenus.filter(chargeLeBasDuDos).length > Math.ceil(retenus.length / TAILLE_ENCHAINEMENT)) {
      const dernier = retenus.map(chargeLeBasDuDos).lastIndexOf(true);
      retenus = retenus.filter((_, i) => i !== dernier);
    }
    return seance(retenus);
  };

  const lundi: SeanceDuMois = {
    id: 'lundi',
    nom: 'Lundi — séance dure',
    jour: 1,
    type: 'dure',
    format: 'series',
    exercices: composer('dure').map((e) => e.id),
  };
  // La séance dure doit tenir dans l'heure : on retire l'avant-dernier
  // exercice (jamais le portage, qui finit la séance) tant qu'elle déborde.
  while (lundi.exercices.length > 4 && dureeSec(lundi, REFERENCE) > DUREE_MAXI_SEC) {
    lundi.exercices.splice(lundi.exercices.length - 2, 1);
  }

  const mardiA = composer('bas');
  const jeudiA = composer('haut');
  const seances: SeanceDuMois[] = [lundi];
  if (alternance) {
    const mardiB = composer('bas', mardiA);
    const jeudiB = composer('haut', jeudiA);
    seances.push(
      facile('mardi-a', 'Mardi A', 2, 'A', mardiA),
      facile('jeudi-a', 'Jeudi A', 4, 'A', jeudiA),
      facile('mardi-b', 'Mardi B', 2, 'B', mardiB),
      facile('jeudi-b', 'Jeudi B', 4, 'B', jeudiB),
    );
  } else {
    seances.push(facile('mardi', 'Mardi', 2, undefined, mardiA), facile('jeudi', 'Jeudi', 4, undefined, jeudiA));
  }

  return {
    debut: isoDate(premiereSemaine(options.aujourdhui ?? new Date(), seances)),
    objectifs: [...objectifs],
    materiels: [...materiels],
    graine,
    seances,
  };
}

// ------------------------------------------------------------- La séance de chacun

/** Séries du jour : toutes le lundi ; les jours faciles, celles du réglage
 *  (une de moins que le lundi par défaut). */
export function seriesDuJour(
  seance: Pick<SeanceDuMois, 'type'>,
  parametres: Pick<ParametresSeance, 'seriesParExercice' | 'seriesJourFacile'>,
): number {
  const dure = parametres.seriesParExercice ?? 3;
  if (seance.type === 'dure') return dure;
  return parametres.seriesJourFacile ?? Math.max(1, dure - 1);
}

/** La séance du programme, mise aux réglages de la personne : c'est elle que
 *  déroule la séance guidée — bille, répétitions comptées, charges notées. */
export function seancePourPersonne(
  seanceMois: SeanceDuMois,
  parametres: ParametresSeance,
  maintenant: Date = new Date(),
): Seance {
  const series = seriesDuJour(seanceMois, parametres);
  const reps = parametres.repsParSerie ?? 8;
  const ids = seanceMois.exercices.filter(estConnu);
  const blocs: BlocSeries[] = ids.map((id, index) => ({
    exerciceId: id,
    series,
    reps: EXERCICES_PAR_ID[id].unite === 'secondes' ? TENUE_SEC : reps,
    reposSec: REPOS_SEC,
    ...(seanceMois.format === 'enchaine'
      ? { superset: Math.floor(index / TAILLE_ENCHAINEMENT), transitionSec: 0 }
      : {}),
  }));
  const seance: Seance = {
    id: `${seanceMois.id}-${maintenant.getTime().toString(36)}`,
    creeLe: maintenant.toISOString(),
    titre: seanceMois.nom,
    parametres: {
      ...parametres,
      discipline: 'musculation',
      dureeMinutes: DUREE_REFERENCE_MIN,
      format: seanceMois.format === 'enchaine' ? 'circuit' : 'series',
      styleCircuit: 'enchaine',
      seriesParExercice: (parametres.seriesParExercice ?? 3) as ParametresSeance['seriesParExercice'],
      tempo: { ...parametres.tempo },
    },
    graine: 0,
    echauffementSec: echauffementSec(DUREE_REFERENCE_MIN),
    retourCalmeSec: retourCalmeSec(DUREE_REFERENCE_MIN),
    blocs,
    circuit: null,
    dureeEstimeeSec: 0,
  };
  seance.dureeEstimeeSec = estimerDureeSec(seance);
  return seance;
}

/** Durée d'une séance du programme pour des réglages donnés. */
export function dureeSec(
  seanceMois: SeanceDuMois,
  parametres: Pick<ParametresSeance, 'seriesParExercice' | 'seriesJourFacile' | 'repsParSerie' | 'tempo'>,
): number {
  const complets = { ...parametresMinimaux, ...parametres } as ParametresSeance;
  return seancePourPersonne(seanceMois, complets, new Date(0)).dureeEstimeeSec;
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

// ------------------------------------------------------------- Changer un exercice

/** Les remplaçants d'un exercice : ceux qui travaillent les mêmes muscles,
 *  hors de ceux déjà dans la séance. Le même schéma de mouvement d'abord, et
 *  ce qu'on ne fait pas déjà un autre jour avant ce qui revient. */
export function alternatives(
  programme: ProgrammeMois,
  seanceId: string,
  exerciceId: string,
  maxi = 12,
): Exercice[] {
  const actuel = estConnu(exerciceId) ? EXERCICES_PAR_ID[exerciceId] : undefined;
  const seance = programme.seances.find((s) => s.id === seanceId);
  if (!actuel || !seance) return [];
  const muscles = (actuel.musclesPrincipaux ?? []).length > 0 ? actuel.musclesPrincipaux! : musclesDe(actuel);
  const mouvementsDe = (ids: string[]) =>
    new Set(ids.map((id) => EXERCICES_PAR_ID[id]).filter(Boolean).map(cleMouvement));
  const pris = mouvementsDe(seance.exercices);
  const ailleurs = mouvementsDe(programme.seances.flatMap((s) => s.exercices));
  const rang = (e: Exercice) => (e.pattern === actuel.pattern ? 0 : 2) + (ailleurs.has(cleMouvement(e)) ? 1 : 0);
  return exercicesPourMuscles(
    candidatsProgramme(programme.materiels).filter((e) => !pris.has(cleMouvement(e))),
    muscles,
  )
    .sort((a, b) => rang(a) - rang(b))
    .slice(0, maxi);
}

export function remplacerDansProgramme(
  programme: ProgrammeMois,
  seanceId: string,
  ancienId: string,
  nouveauId: string,
): ProgrammeMois {
  return {
    ...programme,
    seances: programme.seances.map((s) =>
      s.id === seanceId
        ? { ...s, exercices: s.exercices.map((id) => (id === ancienId ? nouveauId : id)) }
        : s,
    ),
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
    .map((s) => ({
      id: s.id,
      nom: s.nom,
      jour: s.jour,
      ...(s.semaine === 'A' || s.semaine === 'B' ? { semaine: s.semaine } : {}),
      type: s.type === 'dure' ? 'dure' : 'facile',
      format: s.format === 'series' ? 'series' : 'enchaine',
      exercices: s.exercices.filter(estConnu),
    }));
  if (seances.length === 0) return null;
  return {
    debut: p.debut,
    objectifs: Array.isArray(p.objectifs) ? p.objectifs.filter((o) => typeof o === 'string') : [],
    materiels: Array.isArray(p.materiels)
      ? p.materiels.filter((m) => typeof m === 'string')
      : [...MATERIELS_PROGRAMME],
    graine: typeof p.graine === 'number' ? p.graine : 0,
    seances,
  };
}

export function encoderProgramme(programme: ProgrammeMois): string {
  return versBase64Url(JSON.stringify(programme));
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
