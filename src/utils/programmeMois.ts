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
  MouvementGuide,
  Muscle,
  ParametresSeance,
  PatternMoteur,
  Personne,
  ProgrammeMois,
  Seance,
  SeanceDuMois,
  SeanceRealisee,
  TypeSeanceMois,
  UnitePoids,
} from '../types';
import { EXERCICES, EXERCICES_PAR_ID } from '../data/exercices';
import { cleMouvement, dureeSerieSec, estimerDureeSec, familleDe } from './generateurSeance';
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

/** Ce qu'on trouve dans la salle : haltères, kettlebells, bancs, tapis, et
 *  les machines — trap bar, presse à cuisses, hack squat, traîneau. */
export const MATERIELS_PROGRAMME: Materiel[] = ['halteres', 'kettlebell', 'banc', 'tapis', 'salle'];

/** Version de la composition. Un programme plus ancien est recomposé, avec
 *  la même graine : 2 = la trap bar en tête du lundi, les jambes pour finir,
 *  l'échauffement au tapis et les étirements du poster. */
export const VERSION_PROGRAMME = 2;

/** Chacun son tour : le temps de céder la place, en plus de la série de
 *  l'autre. */
export const CHANGEMENT_SEC = 15;

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
  /** Les machines de la salle y ont leur place ; ailleurs, elles attendent
   *  la fin de la séance. */
  salle?: boolean;
  /** Place d'un objectif : quand la séance déborde, on la garde. */
  objectif?: boolean;
}

/** Lundi : tout le corps, lourd. Mardi : le bas. Jeudi : le haut. */
type Gabarit = 'dure' | 'bas' | 'haut';

const gabaritDe = (seance: Pick<SeanceDuMois, 'type' | 'jour'>): Gabarit =>
  seance.type === 'dure' ? 'dure' : seance.jour === 4 ? 'haut' : 'bas';

const TRONC: PatternMoteur[] = ['anti-rotation', 'flexion-tronc', 'rotation', 'flexion-laterale'];

/** Le lundi s'ouvre sur la trap bar, quand le dos est frais. */
const CHARNIERE_TRAP_BAR: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], salle: true, preferer: (e) => e.materiel === 'salle' };
/** Sans les machines : un soulevé de terre roumain ou au kettlebell. Pas un
 *  pont fessier ; et le bas du dos a sa place à lui. */
const CHARNIERE_LIBRE: Emplacement = { cle: 'charniere', muscles: ['ischios', 'fessiers'], principal: ['ischios'], patterns: ['charniere'], preferer: (e) => !(e.musclesPrincipaux ?? []).includes('lombaires') };
/** Sans les machines, le lundi garde aussi un squat, à deux jambes : les
 *  fentes, qui tordent le genou, attendent les jours faciles. */
const SQUAT_LOURD: Emplacement = { cle: 'jambes', muscles: ['quadriceps', 'fessiers'], principal: ['quadriceps', 'fessiers'], patterns: ['squat'], preferer: (e) => e.cotes === 'bilateral' };

const BASE: Record<Gabarit, Emplacement[]> = {
  dure: [
    // Le jour dur, on pousse une charge : un développé sur banc avant les pompes.
    { cle: 'poussee', muscles: ['pectoraux', 'triceps', 'epaules'], principal: ['pectoraux'], patterns: ['poussee-horizontale'], preferer: (e) => e.materiel === 'banc' },
    { cle: 'tirage', muscles: ['dorsaux', 'trapezes', 'biceps'], principal: ['dorsaux'], patterns: ['tirage-horizontal', 'tirage-vertical'] },
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
function emplacementsDe(gabarit: Gabarit, objectifs: string[], materiels: Materiel[]): Emplacement[] {
  const parObjectif = objectifs
    .map((id) => PAR_OBJECTIF[id])
    .filter((o) => o !== undefined && o.gabarits.includes(gabarit))
    .map((o) => ({ ...o.emplacement, ...o.surcharge?.[gabarit], objectif: true }));
  const resultat: Emplacement[] = [];
  const cles = new Set<string>();
  const ajouter = (emplacement: Emplacement) => {
    if (cles.has(emplacement.cle)) return;
    cles.add(emplacement.cle);
    resultat.push(emplacement);
  };
  if (gabarit === 'dure') {
    // La charnière d'abord, fraîche ; pousser et tirer ; les objectifs
    // ensuite. Les jambes finissent la séance, à part.
    const machines = materiels.includes('salle');
    ajouter(machines ? CHARNIERE_TRAP_BAR : CHARNIERE_LIBRE);
    if (!machines) ajouter(SQUAT_LOURD);
    BASE.dure.forEach(ajouter);
    parObjectif.forEach(ajouter);
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
  const libres = candidats.filter(
    (e) => !preferences.exclus.has(cleMouvement(e)) && (e.materiel !== 'salle' || emplacement.salle),
  );
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

// ------------------------------------------------------------- Pour finir : les jambes

/** Le dernier exercice de chaque séance, pour les jambes. Le lundi, une
 *  machine lourde ; les autres jours, au choix. Jamais la trap bar, qui se
 *  fait fraîche, en début de séance. */
const FINALES: Record<TypeSeanceMois, string[]> = {
  dure: ['leg-press', 'hack-squat'],
  facile: ['traineau', 'farmers-walk', 'kb-farmers-walk', 'leg-press', 'hack-squat'],
};

/** Un aller-retour de traîneau : pousser, puis tirer à reculons. */
const TRAINEAU_SEC = 30;
/** La marche du fermier, en fin de séance. */
const PORTAGE_SEC = 40;

/** Séries et répétitions du dernier exercice. Le traîneau se compte en
 *  allers-retours, deux fois plus que de séries : une dizaine à deux. */
function volumeFinale(exercice: Exercice, series: number, reps: number): { series: number; reps: number } {
  if (exercice.id === 'traineau') return { series: series * 2, reps: TRAINEAU_SEC };
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
    leger('Fentes dynamiques', 'En alternant, buste droit, sans charge.'),
  ],
  haut: [
    CERCLES_BRAS,
    leger('Rotations du buste', 'Bras croisés, on tourne les épaules ; le bassin reste face à l’avant.'),
    leger('Chat-vache', 'À quatre pattes, arrondir puis creuser le dos en respirant.'),
    leger('Pompes contre le mur', 'Mains au mur, corps gainé, lentement.'),
  ],
};

/** Cinq étirements du poster pour finir, une minute chacun — trente secondes
 *  de chaque côté quand ils se font d'un côté. Ils visent les muscles du jour
 *  et changent d'une semaine à l'autre, comme les exercices. */
const ETIREMENTS_LUNDI = ['etir-ischios-allonge', 'etir-fessier-chiffre-4', 'etir-quadriceps-debout', 'etir-pectoral-montant', 'etir-dos-rond-quatre-pattes'];
const ETIREMENTS: Record<Gabarit, Record<'A' | 'B', string[]>> = {
  dure: { A: ETIREMENTS_LUNDI, B: ETIREMENTS_LUNDI },
  bas: {
    A: ['etir-fente-laterale', 'etir-fessier-chiffre-4', 'etir-quadriceps-debout', 'etir-ischios-allonge', 'etir-dos-rond-quatre-pattes'],
    B: ['etir-ecart-coudes-genoux', 'etir-genou-en-travers', 'etir-quadriceps-cote', 'etir-ischios-debout', 'etir-mollet-mur'],
  },
  haut: {
    A: ['etir-pectoral-montant', 'etir-epaule-posterieure', 'etir-haut-dos-bras-devant', 'etir-triceps-nuque', 'etir-torsion-allongee'],
    B: ['etir-pectoraux-mains-dos', 'etir-epaules-croisees', 'etir-dos-rond-quatre-pattes', 'etir-inclinaison-tronc', 'etir-avant-bras-flechisseurs'],
  },
};
const ETIREMENT_SEC = 60;

/** L'échauffement d'une séance du programme : le cardio, puis les
 *  mouvements légers du jour. */
export function echauffementDe(seance: Pick<SeanceDuMois, 'type' | 'jour'>): MouvementGuide[] {
  return [CARDIO, ...MOUVEMENTS_LEGERS[gabaritDe(seance)]];
}

/** Les étirements de fin d'une séance du programme, avec leur image. Un
 *  étirement d'un côté se fait en deux temps, droit puis gauche. */
export function etirementsDe(seance: Pick<SeanceDuMois, 'type' | 'jour' | 'semaine'>): MouvementGuide[] {
  return ETIREMENTS[gabaritDe(seance)][seance.semaine ?? 'A'].filter(estConnu).flatMap((id) => {
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
  /** Exercices pris pour un objectif : ceux qu'on garde quand ça déborde. */
  const surObjectif = new Set<string>();

  const composer = (gabarit: Gabarit, interdits: Exercice[] = []): Exercice[] => {
    const pris: Exercice[] = [];
    const exclus = new Set(interdits.map(cleMouvement));
    const emplacements = emplacementsDe(gabarit, objectifs, materiels);
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
      if (emplacement.objectif) surObjectif.add(choisi.id);
    }
    return pris;
  };

  /** Le dernier exercice, pour les jambes : hors des mouvements de la
   *  séance, et pas déjà le dernier d'une autre séance quand on a le choix. */
  const finaleDe = (type: TypeSeanceMois, exercices: Exercice[]): Exercice | undefined => {
    const dansLaSeance = new Set(exercices.map(cleMouvement));
    const possibles = (ids: string[]) =>
      ids
        .filter(estConnu)
        .map((id) => EXERCICES_PAR_ID[id])
        .filter((e) => candidats.includes(e) && !dansLaSeance.has(cleMouvement(e)));
    const pool = possibles(FINALES[type]).length > 0 ? possibles(FINALES[type]) : possibles(FINALES.facile);
    if (pool.length === 0) return undefined;
    const nouvelles = pool.filter((e) => !dejaPris.has(cleMouvement(e)));
    const choix = nouvelles.length > 0 ? nouvelles : pool;
    const retenue = choix[Math.floor(alea() * choix.length)];
    dejaPris.add(cleMouvement(retenue));
    return retenue;
  };

  /** La séance complète : sa fin pour les jambes, et ce qui se fait chacun
   *  son tour — d'office, les machines, une pour deux. */
  const complete = (seance: Omit<SeanceDuMois, 'finale' | 'tour'>, finale: Exercice | undefined): SeanceDuMois => {
    const ids = [...seance.exercices, ...(finale ? [finale.id] : [])];
    const tour = ids.filter((id) => EXERCICES_PAR_ID[id].materiel === 'salle');
    return { ...seance, ...(finale ? { finale: finale.id } : {}), ...(tour.length > 0 ? { tour } : {}) };
  };

  const facile = (
    id: string,
    nom: string,
    jour: number,
    semaine: 'A' | 'B' | undefined,
    exercices: Exercice[],
  ): SeanceDuMois => {
    const finale = finaleDe('facile', exercices);
    const seance = (liste: Exercice[]): SeanceDuMois =>
      complete(
        {
          id,
          nom,
          jour,
          ...(semaine ? { semaine } : {}),
          type: 'facile',
          format: 'enchaine',
          exercices: enEnchainements(liste).map((e) => e.id),
        },
        finale,
      );
    // Même avec trois tours — ceux de Max —, un jour facile tient dans
    // l'heure : on retire les dernières places, les moins prioritaires.
    let retenus = exercices;
    while (retenus.length > 6 && dureeSec(seance(retenus), REFERENCE_FACILE) > DUREE_MAXI_SEC) {
      retenus = retenus.slice(0, -1);
    }
    // Un exercice seul dans le dernier bloc n'est plus un enchaînement.
    if (retenus.length > 6 && retenus.length % TAILLE_ENCHAINEMENT === 1) retenus = retenus.slice(0, -1);
    // Plus d'exercices pour le bas du dos que d'enchaînements : deux finiraient
    // ensemble. On retire les derniers en trop ; l'objectif « bas du dos »,
    // placé en tête, reste.
    while (retenus.filter(chargeLeBasDuDos).length > Math.ceil(retenus.length / TAILLE_ENCHAINEMENT)) {
      const dernier = retenus.map(chargeLeBasDuDos).lastIndexOf(true);
      retenus = retenus.filter((_, i) => i !== dernier);
    }
    return seance(retenus);
  };

  const principalLundi = composer('dure');
  const finaleLundi = finaleDe('dure', principalLundi);
  const lundiAvec = (liste: Exercice[]): SeanceDuMois =>
    complete(
      { id: 'lundi', nom: 'Lundi — séance dure', jour: 1, type: 'dure', format: 'series', exercices: liste.map((e) => e.id) },
      finaleLundi,
    );
  // La séance dure tient dans l'heure : on retire d'abord les places de base
  // (jamais la trap bar, en tête), les objectifs en dernier.
  let retenusLundi = principalLundi;
  while (retenusLundi.length > 4 && dureeSec(lundiAvec(retenusLundi), REFERENCE) > DUREE_MAXI_SEC) {
    const retirables = retenusLundi.map((_, i) => i).filter((i) => i > 0);
    const deBase = retirables.filter((i) => !surObjectif.has(retenusLundi[i].id));
    const retrait = (deBase.length > 0 ? deBase : retirables).at(-1);
    retenusLundi = retenusLundi.filter((_, i) => i !== retrait);
  }
  const lundi = lundiAvec(retenusLundi);

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
    version: VERSION_PROGRAMME,
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
 *  déroule la séance guidée — tapis ou rameur, bille, répétitions comptées,
 *  charges notées, étirements. */
export function seancePourPersonne(
  seanceMois: SeanceDuMois,
  parametres: ParametresSeance,
  maintenant: Date = new Date(),
): Seance {
  const series = seriesDuJour(seanceMois, parametres);
  const reps = parametres.repsParSerie ?? 8;
  const enTour = new Set(seanceMois.tour ?? []);
  const enchaine = seanceMois.format === 'enchaine';
  // Chacun son tour : on souffle le temps de la série de l'autre.
  const serieDeLAutre = (exercice: Exercice, repsBloc: number) =>
    dureeSerieSec(exercice, repsBloc, parametres.tempo) + CHANGEMENT_SEC;

  const blocs: BlocSeries[] = seanceMois.exercices.filter(estConnu).map((id, index) => {
    const exercice = EXERCICES_PAR_ID[id];
    const repsBloc = exercice.unite === 'secondes' ? TENUE_SEC : reps;
    const tour = enTour.has(id);
    return {
      exerciceId: id,
      series,
      reps: repsBloc,
      reposSec: tour && !enchaine ? serieDeLAutre(exercice, repsBloc) : REPOS_SEC,
      ...(tour ? { tour: true } : {}),
      ...(enchaine
        ? {
            superset: Math.floor(index / TAILLE_ENCHAINEMENT),
            transitionSec: tour ? serieDeLAutre(exercice, repsBloc) : 0,
          }
        : {}),
    };
  });
  // Les jambes pour finir, en séries, après les enchaînements.
  if (estConnu(seanceMois.finale)) {
    const exercice = EXERCICES_PAR_ID[seanceMois.finale];
    const volume = volumeFinale(exercice, series, reps);
    const tour = enTour.has(exercice.id);
    blocs.push({
      exerciceId: exercice.id,
      series: volume.series,
      reps: volume.reps,
      reposSec: tour ? serieDeLAutre(exercice, volume.reps) : REPOS_SEC,
      ...(tour ? { tour: true } : {}),
    });
  }

  const echauffement = echauffementDe(seanceMois);
  const retourCalme = etirementsDe(seanceMois);
  const seance: Seance = {
    id: `${seanceMois.id}-${maintenant.getTime().toString(36)}`,
    creeLe: maintenant.toISOString(),
    titre: seanceMois.nom,
    parametres: {
      ...parametres,
      discipline: 'musculation',
      dureeMinutes: DUREE_REFERENCE_MIN,
      format: enchaine ? 'circuit' : 'series',
      styleCircuit: 'enchaine',
      seriesParExercice: (parametres.seriesParExercice ?? 3) as ParametresSeance['seriesParExercice'],
      tempo: { ...parametres.tempo },
    },
    graine: 0,
    echauffementSec: dureeDes(echauffement),
    retourCalmeSec: dureeDes(retourCalme),
    echauffement,
    retourCalme,
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
    const finales = new Set([...FINALES.dure, ...FINALES.facile]);
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
      const remplacee: SeanceDuMois = {
        ...s,
        exercices: s.exercices.map((id) => (id === ancienId ? nouveauId : id)),
        ...(s.finale === ancienId ? { finale: nouveauId } : {}),
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
    .map((s) => {
      const exercices = s.exercices.filter(estConnu);
      const finale = estConnu(s.finale) ? s.finale : undefined;
      const tour = Array.isArray(s.tour)
        ? s.tour.filter((id) => estConnu(id) && (exercices.includes(id) || id === finale))
        : [];
      return {
        id: s.id,
        nom: s.nom,
        jour: s.jour,
        ...(s.semaine === 'A' || s.semaine === 'B' ? { semaine: s.semaine } : {}),
        type: s.type === 'dure' ? 'dure' : 'facile',
        format: s.format === 'series' ? 'series' : 'enchaine',
        exercices,
        ...(finale ? { finale } : {}),
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
  });
}

/** Un programme d'une version précédente — sans trap bar ni jambes pour
 *  finir — est recomposé avec la même graine, les mêmes objectifs et le même
 *  premier lundi : les deux téléphones retombent sur le même programme. */
function mettreANiveau(programme: ProgrammeMois): ProgrammeMois {
  if ((programme.version ?? 1) >= VERSION_PROGRAMME) return programme;
  return genererProgramme({
    objectifs: programme.objectifs,
    materiels: [...new Set<Materiel>([...programme.materiels, ...MATERIELS_PROGRAMME])],
    graine: programme.graine,
    alternance: programme.seances.some((s) => s.semaine !== undefined),
    aujourdhui: depuisIso(programme.debut),
  });
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
