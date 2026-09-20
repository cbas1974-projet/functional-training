// Générateur de séances d'haltères, pensé pour un pratiquant de jiu-jitsu :
// séries lentes au tempo choisi (5 s de montée / 5 s de descente par défaut),
// sans rebond, pour protéger tendons et ligaments.
//
// Les signatures exportées sont le contrat de l'onglet Entraînement ; elles ne
// doivent pas changer sans mettre à jour les composants appelants.
import { EXERCICES, EXERCICES_PAR_ID } from '../data/exercices';
import type {
  BlocSeries,
  Circuit,
  Exercice,
  GroupeMusculaire,
  Materiel,
  PatternMoteur,
  Niveau,
  Objectif,
  ParametresSeance,
  Seance,
  Tempo,
  Zone,
} from '../types';

// ------------------------------------------------------------- Réglages

/** Réglages de volume et de circuit propres à chaque niveau. */
interface ReglagesNiveau {
  /** Répétitions possibles par série. */
  reps: number[];
  /** Nombres de séries possibles. */
  series: number[];
  /** Repos possibles entre les séries, en secondes. */
  repos: number[];
  /** Nombre maximal d'exercices retenus pour une séance en séries. */
  maxExercices: number;
  /** Durée d'une série pour un exercice qui se mesure au temps. */
  tenueSec: number;
  /** Circuit : temps de travail par station. */
  travailSec: number;
  /** Circuit : repos entre deux stations. */
  reposStationSec: number;
  stationsMin: number;
  stationsMax: number;
  toursMax: number;
  /** Nombre de séries demandé par l'utilisateur (prioritaire s'il tient). */
  seriesPreferees?: number;
  /** Répétitions demandées par l'utilisateur (prioritaires si elles tiennent). */
  repsPreferees?: number;
}

const REGLAGES: Record<Niveau, ReglagesNiveau> = {
  debutant: {
    reps: [6, 8],
    series: [2, 3],
    repos: [60, 75, 90],
    maxExercices: 6,
    tenueSec: 30,
    travailSec: 30,
    reposStationSec: 30,
    stationsMin: 4,
    stationsMax: 6,
    toursMax: 5,
  },
  intermediaire: {
    reps: [8, 10],
    series: [2, 3, 4],
    repos: [60, 75, 90],
    maxExercices: 8,
    tenueSec: 40,
    travailSec: 40,
    reposStationSec: 20,
    stationsMin: 4,
    stationsMax: 6,
    toursMax: 5,
  },
  avance: {
    reps: [8, 10, 12],
    series: [3, 4],
    repos: [45, 60, 75, 90],
    maxExercices: 10,
    tenueSec: 45,
    travailSec: 50,
    reposStationSec: 20,
    stationsMin: 4,
    stationsMax: 6,
    toursMax: 5,
  },
};

/** Au-delà de cette durée, les bornes du niveau s'appliquent telles quelles. */
const SEANCE_COURTE_MIN = 10;

/** Sur une séance courte, une seule série par exercice est autorisée : mieux
 *  vaut trois exercices en une série qu'un seul exercice en trois séries. */
const SERIES_MINI_COURTE = 1;

/** Sur une séance courte, un circuit peut descendre à trois stations. */
const STATIONS_MINI_COURTE = 3;

/** Réglages appliqués à une séance : ceux du niveau, assouplis quand la
 *  séance est courte. */
function reglagesEffectifs(parametres: ParametresSeance): ReglagesNiveau {
  const base = REGLAGES[parametres.niveau];
  const seriesPreferees = parametres.seriesParExercice ?? undefined;
  const repsPreferees = parametres.repsParSerie ?? undefined;
  if (parametres.dureeMinutes > SEANCE_COURTE_MIN) return { ...base, seriesPreferees, repsPreferees };
  return {
    ...base,
    seriesPreferees,
    repsPreferees,
    series: base.series.includes(SERIES_MINI_COURTE)
      ? base.series
      : [SERIES_MINI_COURTE, ...base.series],
    stationsMin: Math.min(base.stationsMin, STATIONS_MINI_COURTE),
  };
}

/** Niveau maximal des exercices acceptés pour chaque niveau de pratiquant. */
const NIVEAU_MAX: Record<Niveau, number> = { debutant: 1, intermediaire: 2, avance: 3 };

/** Ordre de parcours des zones selon l'objectif : on boucle sur ce cycle en
 *  piochant un exercice par passage, ce qui alterne naturellement les zones. */
const CYCLES_ZONES: Record<Objectif, Zone[]> = {
  complet: ['bas', 'haut', 'dos', 'gainage', 'complet'],
  haut: ['haut', 'dos', 'haut', 'gainage', 'haut', 'complet'],
  bas: ['bas', 'bas', 'gainage', 'bas', 'complet'],
  gainage: ['gainage', 'complet', 'gainage', 'bas', 'gainage', 'dos'],
  dos: ['dos', 'gainage', 'dos', 'bas', 'dos', 'haut'],
};

/** Ordre d'alternance des zones choisies par l'utilisateur. */
const ORDRE_ZONES: Zone[] = ['bas', 'haut', 'dos', 'gainage', 'complet'];

/** Cycle de zones d'une séance : les zones choisies, dans l'ordre
 *  d'alternance ; à défaut, l'ancien cycle par objectif. */
function cycleZones(parametres: ParametresSeance): Zone[] {
  const choisies = parametres.zones ?? [];
  if (choisies.length > 0) return ORDRE_ZONES.filter((zone) => choisies.includes(zone));
  return CYCLES_ZONES[parametres.objectif ?? 'complet'];
}

/** Repos entre deux tours de circuit. */
const REPOS_ENTRE_TOURS_SEC = 60;

/** Durée de la préparation (« Préparez-vous ») avant chaque série et avant
 *  le circuit. Elle est comptée dans le budget : sur trois séries de trois
 *  exercices, elle pèse déjà 45 s. */
export const DUREE_PRET_SEC = 5;

/** Repos entre les deux exercices d'un superset : le temps de changer
 *  d'haltères, pas le temps de récupérer. */
export const TRANSITION_SUPERSET_SEC = 20;

/** Répétitions envisageables quand celles demandées ne tiennent pas dans la
 *  durée. On ne descend jamais sous 6 et jamais au-dessus de ce qui a été
 *  demandé : alourdir la série ne ferait qu'aggraver le manque de place. */
const REPS_RELACHEES = [6, 8, 9, 10, 12];

/** En dessous de ce nombre d'exercices, la séance ne travaille plus qu'un
 *  seul schéma de mouvement : c'est le seul cas où l'on se permet de réduire
 *  les répétitions demandées. Au-delà, le réglage de l'utilisateur prime. */
const EXERCICES_MINIMUM = 2;

/** Tailles d'enchaînement essayées quand l'utilisateur laisse l'automatique
 *  choisir. On part de la plus petite : à nombre d'exercices égal, deux
 *  charges à préparer valent mieux que quatre. */
const TAILLES_ROTATION_AUTO = [2, 3, 4];

// ------------------------------------------------------- Enchaînements

/** Schémas qui s'opposent. Les enchaîner laisse l'un récupérer pendant que
 *  l'autre travaille, sans que le second pâtisse du premier. */
const PATTERNS_OPPOSES: Partial<Record<PatternMoteur, PatternMoteur[]>> = {
  'poussee-horizontale': ['tirage-horizontal', 'tirage-vertical'],
  'tirage-horizontal': ['poussee-horizontale', 'poussee-verticale'],
  'poussee-verticale': ['tirage-vertical', 'tirage-horizontal'],
  'tirage-vertical': ['poussee-verticale', 'poussee-horizontale'],
  squat: ['charniere'],
  charniere: ['squat', 'fente', 'flexion-tronc'],
  fente: ['charniere'],
  'flexion-tronc': ['charniere'],
  rotation: ['anti-rotation'],
  'anti-rotation': ['rotation'],
};

/** Muscles antagonistes. C'est là que se joue l'opposition pour les exercices
 *  d'isolation, qui partagent tous le même schéma de mouvement : un curl et
 *  une extension triceps sont tous deux « isolation », mais bien opposés. */
const GROUPES_OPPOSES: Partial<Record<GroupeMusculaire, GroupeMusculaire[]>> = {
  biceps: ['triceps'],
  triceps: ['biceps'],
  pectoraux: ['dorsaux'],
  dorsaux: ['pectoraux', 'abdominaux'],
  quadriceps: ['ischios-fessiers'],
  'ischios-fessiers': ['quadriceps'],
  abdominaux: ['dorsaux'],
  obliques: ['abdominaux'],
  epaules: ['dorsaux'],
};

/** Schémas qui coupent le souffle : grosse masse musculaire sous charge. */
const PATTERNS_EXIGEANTS: PatternMoteur[] = ['squat', 'charniere', 'fente', 'portage'];

/** Deux mouvements exigeants dans le même enchaînement et c'est la cage
 *  thoracique qui lâche avant le muscle. */
function estExigeant(exercice: Exercice): boolean {
  return PATTERNS_EXIGEANTS.includes(exercice.pattern) || exercice.groupe === 'corps-entier';
}

/** Score en dessous duquel un exercice est refusé comme partenaire. */
const REFUS = -1;

/** À quel point `candidat` ferait un bon partenaire pour un enchaînement
 *  déjà commencé. Négatif = incompatible. */
function scoreCompagnon(enchainement: Exercice[], candidat: Exercice): number {
  let score = 0;
  for (const membre of enchainement) {
    if (estExigeant(membre) && estExigeant(candidat)) return REFUS;
    // Même muscle, ou même schéma : ce n'est plus un enchaînement, c'est une
    // série longue déguisée. L'isolation fait exception, elle couvre des
    // muscles opposés sous un seul schéma.
    if (membre.groupe === candidat.groupe) return REFUS;
    if (membre.pattern === candidat.pattern && membre.pattern !== 'isolation') return REFUS;
    if (PATTERNS_OPPOSES[membre.pattern]?.includes(candidat.pattern)) score += 4;
    if (GROUPES_OPPOSES[membre.groupe]?.includes(candidat.groupe)) score += 4;
    if (membre.zone !== candidat.zone) score += 1;
  }
  return score;
}

/** Exercices réordonnés en enchaînements de `taille`, chacun composé de
 *  mouvements qui ne se gênent pas. Un enchaînement se referme plus tôt
 *  qu'annoncé plutôt que d'accueillir un partenaire incompatible. */
interface Arrangement {
  exercices: Exercice[];
  /** Numéro d'enchaînement de chaque exercice, dans le même ordre. */
  enchainements: number[];
}

function arranger(exercices: Exercice[], taille: number): Arrangement {
  if (taille <= 1) {
    return { exercices: [...exercices], enchainements: exercices.map((_, index) => index) };
  }
  const restants = [...exercices];
  const ordonnes: Exercice[] = [];
  const enchainements: number[] = [];
  let numero = 0;
  while (restants.length > 0) {
    const groupe = [restants.shift() as Exercice];
    while (groupe.length < taille && restants.length > 0) {
      let choix = -1;
      let meilleur = REFUS;
      for (let i = 0; i < restants.length; i += 1) {
        const score = scoreCompagnon(groupe, restants[i]);
        if (score > meilleur) {
          meilleur = score;
          choix = i;
        }
      }
      if (choix < 0) break;
      groupe.push(restants.splice(choix, 1)[0]);
    }
    for (const exercice of groupe) {
      ordonnes.push(exercice);
      enchainements.push(numero);
    }
    numero += 1;
  }
  return { exercices: ordonnes, enchainements };
}

/** En dessous de ce budget de travail, le format mixte n'a pas la place
 *  d'accueillir un circuit : il se comporte comme le format séries. */
const SEUIL_MIXTE_SEC = 600;

/** Part du budget de travail réservée aux séries au format mixte. */
const PART_SERIES_MIXTE = 0.65;

/** Une combinaison est retenue si elle remplit au moins 85 % du meilleur
 *  remplissage possible : on privilégie alors le nombre d'exercices. */
const SEUIL_REMPLISSAGE = 0.85;

/** Cycle de zones du petit circuit qui termine une séance mixte. */
const CYCLE_CIRCUIT_MIXTE: Zone[] = ['gainage', 'complet', 'bas', 'dos'];

/** Bornes d'un circuit : nombre de stations et nombre de tours. */
interface BornesCircuit {
  stationsMin: number;
  stationsMax: number;
  toursMin: number;
  toursMax: number;
}

const BORNES_CIRCUIT_MIXTE: BornesCircuit = {
  stationsMin: 3,
  stationsMax: 5,
  toursMin: 1,
  toursMax: 3,
};

// ------------------------------------------------------------- Aléatoire

/** Générateur pseudo-aléatoire déterministe (mulberry32) : la même graine
 *  redonne toujours la même suite de tirages, donc la même séance. */
function creerAleatoire(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let melange = etat;
    melange = Math.imul(melange ^ (melange >>> 15), melange | 1);
    melange ^= melange + Math.imul(melange ^ (melange >>> 7), melange | 61);
    return ((melange ^ (melange >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tire un élément au hasard dans une liste non vide. */
function tirer<T>(liste: T[], alea: () => number): T {
  return liste[Math.floor(alea() * liste.length)];
}

// ------------------------------------------------------------- Temps

/** Arrondit un nombre de minutes à la demi-minute la plus proche. */
function arrondiDemiMinute(minutes: number): number {
  return Math.round(minutes * 2) / 2;
}

function limiter(valeur: number, mini: number, maxi: number): number {
  return Math.min(maxi, Math.max(mini, valeur));
}

/** Échauffement articulaire : 12 % de la séance, entre 1 et 5 min. */
function echauffementSec(dureeMinutes: number): number {
  return limiter(arrondiDemiMinute(dureeMinutes * 0.12), 1, 5) * 60;
}

/** Retour au calme : 8 % de la séance, entre 30 s et 4 min. */
function retourCalmeSec(dureeMinutes: number): number {
  return limiter(arrondiDemiMinute(dureeMinutes * 0.08), 0.5, 4) * 60;
}

/** Le temps qui reste une fois les exercices agencés ne se perd pas : il part
 *  dans les étirements. Un exercice de plus ne tient jamais dans ce reliquat
 *  (au tempo lent, il en faudrait bien davantage), et finir trois minutes
 *  plus tôt qu'annoncé n'a aucun intérêt. */
const RETOUR_CALME_PART_MAXI = 0.25;
const RETOUR_CALME_MAXI_SEC = 6 * 60;
/** En dessous, le reliquat ne vaut pas la peine d'être réparti. */
const RELIQUAT_MINIMUM_SEC = 30;

function retourCalmeAllonge(
  retourCalmeInitialSec: number,
  totalSec: number,
  dureeMinutes: number,
): number {
  const demande = dureeMinutes * 60;
  const reliquat = demande - totalSec;
  if (reliquat < RELIQUAT_MINIMUM_SEC) return retourCalmeInitialSec;
  const plafond = Math.min(RETOUR_CALME_MAXI_SEC, Math.round(demande * RETOUR_CALME_PART_MAXI));
  // Arrondi à 15 s près : un chiffre rond se lit mieux à l'écran.
  const vise = Math.floor((retourCalmeInitialSec + reliquat) / 15) * 15;
  return Math.max(retourCalmeInitialSec, Math.min(plafond, vise));
}

/** Secondes par répétition au tempo donné (montée + descente). */
export function secondesParRep(tempo: Tempo): number {
  return tempo.monteeSec + tempo.descenteSec;
}

/** Durée d'une série en secondes : reps × tempo (doublée si unilatéral),
 *  ou directement `reps` secondes si l'exercice se mesure au temps. */
export function dureeSerieSec(exercice: Exercice, reps: number, tempo: Tempo): number {
  if (exercice.unite === 'secondes') return reps;
  return reps * secondesParRep(tempo) * (exercice.cotes === 'unilateral' ? 2 : 1);
}

/** Répétitions réellement écrites dans le bloc : les exercices au temps
 *  reçoivent une durée de tenue en secondes, pas un nombre de répétitions. */
function repsEffectives(exercice: Exercice, reps: number, reglages: ReglagesNiveau): number {
  return exercice.unite === 'secondes' ? reglages.tenueSec : reps;
}

/** Regroupe les blocs consécutifs qui partagent le même numéro de superset ;
 *  un bloc sans superset forme un groupe à lui seul. Un groupe se déroule en
 *  alternance : A1, B1, A2, B2… */
export function groupesDeBlocs(blocs: BlocSeries[]): BlocSeries[][] {
  const groupes: BlocSeries[][] = [];
  for (const bloc of blocs) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && bloc.superset !== undefined && dernier[0].superset === bloc.superset) {
      dernier.push(bloc);
    } else {
      groupes.push([bloc]);
    }
  }
  return groupes;
}

/** Nombre de séries d'un groupe. Le générateur donne le même nombre à tous
 *  les blocs d'un superset ; on lit celui du premier, qui fait foi. */
function seriesDuGroupe(groupe: BlocSeries[]): number {
  return groupe[0].series;
}

/** Répartition du temps d'une suite de blocs, dans l'ordre exact où la séance
 *  guidée la déroule : préparation avant chaque série, série, puis repos —
 *  court entre les deux exercices d'un superset, complet sinon. Le tout
 *  dernier repos n'existe pas quand plus rien ne suit. */
export interface DetailBlocs {
  preparationSec: number;
  travailSec: number;
  reposSec: number;
  series: number;
}

export function detaillerBlocs(
  blocs: BlocSeries[],
  tempo: Tempo,
  suiviDUnCircuit: boolean,
): DetailBlocs {
  const detail: DetailBlocs = { preparationSec: 0, travailSec: 0, reposSec: 0, series: 0 };
  const groupes = groupesDeBlocs(blocs.filter((bloc) => bloc.series > 0));
  groupes.forEach((groupe, indexGroupe) => {
    const series = seriesDuGroupe(groupe);
    for (let serie = 1; serie <= series; serie += 1) {
      groupe.forEach((bloc, indexBloc) => {
        const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
        detail.preparationSec += DUREE_PRET_SEC;
        detail.series += 1;
        if (exercice) detail.travailSec += dureeSerieSec(exercice, bloc.reps, tempo);
        const dernierDuGroupe = indexBloc === groupe.length - 1;
        const toutDernier =
          dernierDuGroupe && serie === series && indexGroupe === groupes.length - 1;
        if (toutDernier && !suiviDUnCircuit) return;
        detail.reposSec += dernierDuGroupe
          ? bloc.reposSec
          : (bloc.transitionSec ?? TRANSITION_SUPERSET_SEC);
      });
    }
  });
  return detail;
}

/** Durée exacte de la partie « séries ». */
function dureeBlocsSec(blocs: BlocSeries[], tempo: Tempo, suiviDUnCircuit: boolean): number {
  const detail = detaillerBlocs(blocs, tempo, suiviDUnCircuit);
  return detail.preparationSec + detail.travailSec + detail.reposSec;
}

/** Répartition du temps d'un circuit : une seule préparation au départ, puis
 *  les stations, avec un repos entre deux stations et un repos plus long
 *  entre deux tours. */
export function detaillerCircuit(circuit: Circuit): DetailBlocs {
  const stations = circuit.stations.length;
  const tours = circuit.tours;
  return {
    preparationSec: DUREE_PRET_SEC,
    travailSec: tours * stations * circuit.travailSec,
    reposSec:
      tours * Math.max(0, stations - 1) * circuit.reposSec +
      Math.max(0, tours - 1) * circuit.reposEntreToursSec,
    series: tours * stations,
  };
}

function dureeCircuitSec(circuit: Circuit): number {
  const detail = detaillerCircuit(circuit);
  return detail.preparationSec + detail.travailSec + detail.reposSec;
}

// ------------------------------------------------------------- Sélection

/** Parcourt le cycle de zones et retient au plus `maximum` exercices, en
 *  préférant à chaque fois un groupe musculaire pas encore sollicité. */
/** Matériel réellement disponible : ce que l'utilisateur a déclaré, plus les
 *  exercices qui n'en demandent aucun. Lit l'ancien réglage « banc » des
 *  séances enregistrées avant l'arrivée de la liste. */
function materielsPossedes(parametres: ParametresSeance): Set<Materiel> {
  const declares =
    parametres.materiels && parametres.materiels.length > 0
      ? parametres.materiels
      : parametres.banc
        ? (['halteres', 'banc', 'step'] as Materiel[])
        : (['halteres'] as Materiel[]);
  return new Set<Materiel>(['aucun', ...declares]);
}

/** Première liste non vide, pour appliquer des préférences en cascade. */
function premierNonVide<T>(...listes: T[][]): T[] {
  return listes.find((liste) => liste.length > 0) ?? [];
}

function selectionnerExercices(
  candidats: Exercice[],
  cycle: Zone[],
  maximum: number,
  alea: () => number,
): Exercice[] {
  const retenus: Exercice[] = [];
  const idsRetenus = new Set<string>();
  const groupesUtilises = new Set<GroupeMusculaire>();
  const patternsUtilises = new Set<PatternMoteur>();
  let position = 0;
  let zonesVides = 0;

  while (retenus.length < maximum && zonesVides < cycle.length) {
    const zone = cycle[position % cycle.length];
    position += 1;
    const disponibles = candidats.filter((e) => e.zone === zone && !idsRetenus.has(e.id));
    if (disponibles.length === 0) {
      zonesVides += 1;
      continue;
    }
    zonesVides = 0;
    // On évite d'abord d'empiler deux fois le même schéma de mouvement
    // (deux tirages, deux squats), puis le même groupe musculaire. Sans
    // candidat idéal, on relâche ces préférences plutôt que sauter la zone.
    const choisi = tirer(
      premierNonVide(
        disponibles.filter((e) => !patternsUtilises.has(e.pattern) && !groupesUtilises.has(e.groupe)),
        disponibles.filter((e) => !patternsUtilises.has(e.pattern)),
        disponibles.filter((e) => !groupesUtilises.has(e.groupe)),
        disponibles,
      ),
      alea,
    );
    retenus.push(choisi);
    idsRetenus.add(choisi.id);
    groupesUtilises.add(choisi.groupe);
    patternsUtilises.add(choisi.pattern);
  }
  return retenus;
}

// ------------------------------------------------------------- Ajustement

/** Une combinaison candidate : les n premiers exercices retenus, avec les
 *  mêmes séries / répétitions / repos pour tous les blocs. */
interface Combinaison {
  nombre: number;
  series: number;
  reps: number;
  repos: number;
  cout: number;
}

/** Comment les exercices s'enchaînent dans la partie « séries ». */
interface OptionsBlocs {
  /** Tailles d'enchaînement à essayer ; 1 = séries droites. */
  taillesRotation: number[];
  /** Un circuit suit : le dernier repos existe donc bel et bien. */
  suiviDUnCircuit: boolean;
}

/** Construit les blocs de séries qui remplissent le mieux le budget. */
function construireBlocs(
  retenus: Exercice[],
  budgetSec: number,
  reglages: ReglagesNiveau,
  tempo: Tempo,
  options: OptionsBlocs,
): BlocSeries[] {
  if (retenus.length === 0) return [];

  const fabriquer = (
    arrangement: Arrangement,
    nombre: number,
    series: number,
    reps: number,
    repos: number,
  ): BlocSeries[] => {
    const exercices = arrangement.exercices.slice(0, nombre);
    const numeros = arrangement.enchainements.slice(0, nombre);
    // Un enchaînement tronqué à un seul exercice redevient une série droite :
    // sans partenaire, le repos court n'aurait aucun sens.
    const effectifs = new Map<number, number>();
    for (const numero of numeros) effectifs.set(numero, (effectifs.get(numero) ?? 0) + 1);
    return exercices.map((exercice, index) => {
      const bloc: BlocSeries = {
        exerciceId: exercice.id,
        series,
        reps: repsEffectives(exercice, reps, reglages),
        reposSec: repos,
      };
      if ((effectifs.get(numeros[index]) ?? 0) > 1) {
        bloc.superset = numeros[index];
        bloc.transitionSec = TRANSITION_SUPERSET_SEC;
      }
      return bloc;
    });
  };

  const enumerer = (
    arrangement: Arrangement,
    seriesPossibles: number[],
    repsPossibles: number[],
  ): Combinaison | null => {
    const possibles: Combinaison[] = [];
    let meilleurCout = 0;
    for (let nombre = 1; nombre <= arrangement.exercices.length; nombre += 1) {
      for (const series of seriesPossibles) {
        for (const reps of repsPossibles) {
          for (const repos of reglages.repos) {
            const cout = dureeBlocsSec(
              fabriquer(arrangement, nombre, series, reps, repos),
              tempo,
              options.suiviDUnCircuit,
            );
            if (cout > budgetSec) continue;
            possibles.push({ nombre, series, reps, repos, cout });
            if (cout > meilleurCout) meilleurCout = cout;
          }
        }
      }
    }
    if (possibles.length === 0) return null;
    // On écarte les combinaisons qui laissent trop de temps mort, puis on
    // prend le plus d'exercices, les répétitions les plus proches de ce qui
    // a été demandé, le plus de séries, et enfin le remplissage le plus fin.
    const seuil = meilleurCout * SEUIL_REMPLISSAGE;
    const retenues = possibles.filter((c) => c.cout >= seuil);
    retenues.sort(
      (a, b) => b.nombre - a.nombre || b.reps - a.reps || b.series - a.series || b.cout - a.cout,
    );
    return retenues[0];
  };

  // Le nombre de séries demandé est un choix ferme : on ne le sacrifie que
  // si rien ne tient. Les répétitions, elles, se relâchent vers le bas dès
  // que cela permet de garder un exercice de plus dans la séance — mieux
  // vaut deux exercices à 3 × 6 qu'un seul à 3 × 8.
  const { seriesPreferees, repsPreferees } = reglages;
  const seriesFixees = seriesPreferees ? [seriesPreferees] : reglages.series;
  const essais: [number[], number[]][] = [];
  if (repsPreferees) {
    essais.push([seriesFixees, [repsPreferees]]);
    const plusBasses = REPS_RELACHEES.filter((r) => r < repsPreferees).sort((a, b) => b - a);
    if (plusBasses.length > 0) essais.push([seriesFixees, [repsPreferees, ...plusBasses]]);
  } else {
    essais.push([seriesFixees, reglages.reps]);
  }
  if (seriesPreferees) essais.push([seriesFixees, reglages.reps]);

  /** Meilleure combinaison pour une taille d'enchaînement donnée. */
  const pourTaille = (taille: number): { arrangement: Arrangement; choix: Combinaison } | null => {
    const arrangement = arranger(retenus, taille);
    const resultats: (Combinaison | null)[] = [];
    for (const [series, reps] of essais) {
      const resultat = enumerer(arrangement, series, reps);
      resultats.push(resultat);
      // Dès que les préférences donnent une séance digne de ce nom, on s'arrête :
      // on ne relâche les répétitions que pour sortir d'un exercice unique.
      if (resultat && resultat.nombre >= EXERCICES_MINIMUM) break;
    }
    const meilleurNombre = resultats.reduce((max, c) => Math.max(max, c?.nombre ?? 0), 0);
    // Le premier essai qui atteint le meilleur nombre d'exercices gagne : on
    // respecte ainsi les préférences aussi longtemps qu'elles ne coûtent rien.
    const choix = meilleurNombre > 0 ? resultats.find((c) => c?.nombre === meilleurNombre) : null;
    return choix ? { arrangement, choix } : null;
  };

  // À nombre d'exercices égal, le plus petit enchaînement gagne : deux charges
  // à préparer valent mieux que quatre pour le même travail.
  let meilleur: { arrangement: Arrangement; choix: Combinaison } | null = null;
  for (const taille of options.taillesRotation) {
    const candidat = pourTaille(taille);
    if (candidat && (meilleur === null || candidat.choix.nombre > meilleur.choix.nombre)) {
      meilleur = candidat;
    }
  }

  // Dernier recours : relâcher aussi le nombre de séries, puis, si vraiment
  // rien ne tient, garder un exercice en une série quitte à dépasser un peu.
  const arrangementDefaut = arranger(retenus, options.taillesRotation[0] ?? 1);
  if (!meilleur) {
    const secours = enumerer(arrangementDefaut, reglages.series, reglages.reps);
    if (secours) meilleur = { arrangement: arrangementDefaut, choix: secours };
  }
  if (!meilleur) {
    meilleur = {
      arrangement: arrangementDefaut,
      choix: {
        nombre: 1,
        series: 1,
        reps: repsPreferees ?? Math.min(...reglages.reps),
        repos: Math.min(...reglages.repos),
        cout: 0,
      },
    };
  }

  const { arrangement, choix } = meilleur;
  return fabriquer(arrangement, choix.nombre, choix.series, choix.reps, choix.repos);
}

/** Choisit le nombre de tours et de stations qui remplit le mieux le budget. */
function construireCircuit(
  stations: Exercice[],
  budgetSec: number,
  reglages: ReglagesNiveau,
  bornes: BornesCircuit,
): Circuit | null {
  if (stations.length === 0) return null;
  const maximumStations = Math.min(bornes.stationsMax, stations.length);
  const minimumStations = Math.min(bornes.stationsMin, maximumStations);

  const essai = (tours: number, nombre: number): Circuit => ({
    stations: stations.slice(0, nombre).map((e) => e.id),
    tours,
    travailSec: reglages.travailSec,
    reposSec: reglages.reposStationSec,
    reposEntreToursSec: REPOS_ENTRE_TOURS_SEC,
  });

  let meilleur: { tours: number; nombre: number; cout: number } | null = null;
  for (let tours = bornes.toursMin; tours <= bornes.toursMax; tours += 1) {
    for (let nombre = minimumStations; nombre <= maximumStations; nombre += 1) {
      const cout = dureeCircuitSec(essai(tours, nombre));
      if (cout > budgetSec) continue;
      const mieux =
        meilleur === null ||
        cout > meilleur.cout ||
        (cout === meilleur.cout &&
          (nombre > meilleur.nombre || (nombre === meilleur.nombre && tours > meilleur.tours)));
      if (mieux) meilleur = { tours, nombre, cout };
    }
  }

  // Rien ne tient : un seul tour au nombre minimal de stations.
  const choix = meilleur ?? { tours: 1, nombre: minimumStations, cout: 0 };
  return essai(choix.tours, choix.nombre);
}

// ------------------------------------------------------------- API publique

/** Exercices utilisables avec ces paramètres (matériel, niveau, explosifs). */
export function exercicesDisponibles(parametres: ParametresSeance): Exercice[] {
  const niveauMax = NIVEAU_MAX[parametres.niveau];
  const possedes = materielsPossedes(parametres);
  return EXERCICES.filter(
    (exercice) =>
      possedes.has(exercice.materiel) &&
      exercice.niveauMin <= niveauMax &&
      (parametres.explosifs || !exercice.explosif),
  );
}


/** Tailles d'enchaînement à essayer pour ces paramètres : une seule si
 *  l'utilisateur l'a fixée, toutes si l'automatique choisit, et 1 (séries
 *  droites) hors du format superset. */
function taillesRotation(parametres: ParametresSeance): number[] {
  if (parametres.format !== 'superset') return [1];
  return parametres.tailleRotation ? [parametres.tailleRotation] : TAILLES_ROTATION_AUTO;
}

/** Génère une séance complète qui tient dans la durée demandée. */
export function genererSeance(parametres: ParametresSeance, graine?: number): Seance {
  const graineUtilisee = (graine ?? Date.now()) >>> 0;
  const alea = creerAleatoire(graineUtilisee);
  const reglages = reglagesEffectifs(parametres);
  const echauffement = echauffementSec(parametres.dureeMinutes);
  const retourCalme = retourCalmeSec(parametres.dureeMinutes);
  const budget = Math.max(0, parametres.dureeMinutes * 60 - echauffement - retourCalme);
  const candidats = exercicesDisponibles(parametres);
  const cycle = cycleZones(parametres);

  let blocs: BlocSeries[] = [];
  let circuit: Circuit | null = null;

  if (parametres.format === 'circuit') {
    const stations = selectionnerExercices(candidats, cycle, reglages.stationsMax, alea);
    circuit = construireCircuit(stations, budget, reglages, {
      stationsMin: reglages.stationsMin,
      stationsMax: reglages.stationsMax,
      toursMin: 1,
      toursMax: reglages.toursMax,
    });
  } else if (parametres.format === 'mixte' && budget >= SEUIL_MIXTE_SEC) {
    const budgetSeries = Math.round(budget * PART_SERIES_MIXTE);
    const retenus = selectionnerExercices(candidats, cycle, reglages.maxExercices, alea);
    blocs = construireBlocs(retenus, budgetSeries, reglages, parametres.tempo, {
      taillesRotation: [1],
      suiviDUnCircuit: true,
    });
    const utilises = new Set(blocs.map((b) => b.exerciceId));
    const restants = candidats.filter((e) => !utilises.has(e.id));
    const cycleCircuit = CYCLE_CIRCUIT_MIXTE.filter((zone) => cycle.includes(zone));
    const stations = selectionnerExercices(
      restants,
      cycleCircuit.length > 0 ? cycleCircuit : cycle,
      BORNES_CIRCUIT_MIXTE.stationsMax,
      alea,
    );
    circuit = construireCircuit(stations, budget - budgetSeries, reglages, BORNES_CIRCUIT_MIXTE);
  } else {
    // Format séries ou superset, et format mixte trop court pour un circuit.
    const retenus = selectionnerExercices(candidats, cycle, reglages.maxExercices, alea);
    blocs = construireBlocs(retenus, budget, reglages, parametres.tempo, {
      taillesRotation: taillesRotation(parametres),
      suiviDUnCircuit: false,
    });
  }

  const seance: Seance = {
    id: `${Date.now().toString(36)}-${graineUtilisee.toString(36)}`,
    creeLe: new Date().toISOString(),
    parametres: { ...parametres, tempo: { ...parametres.tempo } },
    graine: graineUtilisee,
    echauffementSec: echauffement,
    retourCalmeSec: retourCalme,
    blocs,
    circuit,
    dureeEstimeeSec: 0,
  };
  seance.dureeEstimeeSec = estimerDureeSec(seance);
  seance.retourCalmeSec = retourCalmeAllonge(
    seance.retourCalmeSec,
    seance.dureeEstimeeSec,
    parametres.dureeMinutes,
  );
  seance.dureeEstimeeSec = estimerDureeSec(seance);
  return seance;
}

/** Adapte les répétitions quand l'unité change (répétitions ↔ secondes). */
function adapterReps(
  remplacant: Exercice,
  repsActuelles: number,
  uniteActuelle: Exercice['unite'],
  reglages: ReglagesNiveau,
): number {
  if (remplacant.unite === uniteActuelle) return repsActuelles;
  return remplacant.unite === 'secondes' ? reglages.tenueSec : (reglages.repsPreferees ?? reglages.reps[0]);
}

/** Remplace un exercice (bloc ou station) par un autre de la même zone. */
export function remplacerExercice(seance: Seance, exerciceId: string, graine?: number): Seance {
  const actuel = EXERCICES_PAR_ID[exerciceId];
  if (!actuel) return seance;

  const utilises = new Set<string>([
    ...seance.blocs.map((bloc) => bloc.exerciceId),
    ...(seance.circuit?.stations ?? []),
  ]);
  if (!utilises.has(exerciceId)) return seance;

  // Un remplaçant doit d'abord travailler le même schéma de mouvement : c'est
  // ce qui garde la séance équilibrée, quel que soit le matériel utilisé. À
  // défaut, on retombe sur la même zone.
  const libres = exercicesDisponibles(seance.parametres).filter(
    (exercice) => !utilises.has(exercice.id),
  );
  const alternatives = premierNonVide(
    libres.filter((e) => e.pattern === actuel.pattern && e.zone === actuel.zone),
    libres.filter((e) => e.pattern === actuel.pattern),
    libres.filter((e) => e.zone === actuel.zone),
  );
  if (alternatives.length === 0) return seance;

  const alea = creerAleatoire((graine ?? Date.now()) >>> 0);
  const remplacant = tirer(alternatives, alea);
  const reglages = reglagesEffectifs(seance.parametres);

  const blocs = seance.blocs.map((bloc) =>
    bloc.exerciceId === exerciceId
      ? {
          ...bloc,
          exerciceId: remplacant.id,
          reps: adapterReps(remplacant, bloc.reps, actuel.unite, reglages),
        }
      : { ...bloc },
  );
  const circuit = seance.circuit
    ? {
        ...seance.circuit,
        stations: seance.circuit.stations.map((id) => (id === exerciceId ? remplacant.id : id)),
      }
    : null;

  const nouvelle: Seance = {
    ...seance,
    parametres: { ...seance.parametres, tempo: { ...seance.parametres.tempo } },
    blocs,
    circuit,
    dureeEstimeeSec: 0,
  };
  nouvelle.dureeEstimeeSec = estimerDureeSec(nouvelle);
  return nouvelle;
}

/** Vrai quand la séance comporte un circuit réellement praticable. */
function circuitActif(seance: Seance): boolean {
  const circuit = seance.circuit;
  return circuit !== null && circuit.stations.length > 0 && circuit.tours > 0;
}

/** Durée totale estimée de la séance, à la seconde près : c'est exactement la
 *  somme des étapes que déroulera la séance guidée. */
export function estimerDureeSec(seance: Seance): number {
  const avecCircuit = circuitActif(seance);
  let total = seance.echauffementSec + seance.retourCalmeSec;
  total += dureeBlocsSec(seance.blocs, seance.parametres.tempo, avecCircuit);
  if (avecCircuit && seance.circuit) total += dureeCircuitSec(seance.circuit);
  return total;
}

/** Décomposition du temps d'une séance, pour expliquer à l'écran pourquoi
 *  une durée donnée ne contient que tel nombre d'exercices. */
export interface AnalyseSeance {
  echauffementSec: number;
  preparationSec: number;
  /** Temps sous tension : les séries et les stations elles-mêmes. */
  travailSec: number;
  reposSec: number;
  retourCalmeSec: number;
  totalSec: number;
  demandeSec: number;
  nombreExercices: number;
  nombreSeries: number;
  /** Écarts entre ce qui a été demandé et ce que la durée permettait. */
  ajustements: string[];
}

export function analyserSeance(seance: Seance): AnalyseSeance {
  const { parametres } = seance;
  const avecCircuit = circuitActif(seance);
  const blocs = detaillerBlocs(seance.blocs, parametres.tempo, avecCircuit);
  const circuit = avecCircuit && seance.circuit ? detaillerCircuit(seance.circuit) : null;

  const preparationSec = blocs.preparationSec + (circuit?.preparationSec ?? 0);
  const travailSec = blocs.travailSec + (circuit?.travailSec ?? 0);
  const reposSec = blocs.reposSec + (circuit?.reposSec ?? 0);
  const exercices = new Set<string>([
    ...seance.blocs.filter((bloc) => bloc.series > 0).map((bloc) => bloc.exerciceId),
    ...(avecCircuit ? (seance.circuit?.stations ?? []) : []),
  ]);

  const ajustements: string[] = [];
  const premier = seance.blocs[0];
  if (premier) {
    const seriesDemandees = parametres.seriesParExercice;
    if (seriesDemandees && premier.series !== seriesDemandees) {
      ajustements.push(
        `${premier.series} séries au lieu de ${seriesDemandees} : la durée demandée ne permettait pas plus.`,
      );
    }
    const repsDemandees = parametres.repsParSerie;
    const blocEnReps = seance.blocs.find(
      (bloc) => EXERCICES_PAR_ID[bloc.exerciceId]?.unite === 'reps',
    );
    if (repsDemandees && blocEnReps && blocEnReps.reps !== repsDemandees) {
      ajustements.push(
        `${blocEnReps.reps} répétitions au lieu de ${repsDemandees} : cela libère la place d'un exercice de plus.`,
      );
    }
  }
  const unilateraux = [...exercices]
    .map((id) => EXERCICES_PAR_ID[id])
    .filter((exercice) => exercice?.cotes === 'unilateral');
  if (unilateraux.length > 0) {
    ajustements.push(
      `${unilateraux.map((e) => e.nomFr).join(', ')} : côté droit puis côté gauche, la série compte double.`,
    );
  }
  const tailleEnchainement = Math.max(
    0,
    ...groupesDeBlocs(seance.blocs.filter((bloc) => bloc.series > 0)).map((g) => g.length),
  );
  if (tailleEnchainement === 2) {
    ajustements.push(
      'Superset : les exercices vont deux par deux, le repos de l’un est le travail de l’autre.',
    );
  } else if (tailleEnchainement > 2) {
    ajustements.push(
      `Rotation de ${tailleEnchainement} : chaque muscle récupère pendant que les ${tailleEnchainement - 1} autres travaillent.`,
    );
  }

  return {
    echauffementSec: seance.echauffementSec,
    preparationSec,
    travailSec,
    reposSec,
    retourCalmeSec: seance.retourCalmeSec,
    totalSec: seance.echauffementSec + preparationSec + travailSec + reposSec + seance.retourCalmeSec,
    demandeSec: parametres.dureeMinutes * 60,
    nombreExercices: exercices.size,
    nombreSeries: blocs.series + (circuit?.series ?? 0),
    ajustements,
  };
}

/** "45 s", "12 min", "12 min 30 s", "1 h 05". */
export function formaterDuree(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  if (total < 60) return `${total} s`;
  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    const reste = total % 60;
    return reste === 0 ? `${minutes} min` : `${minutes} min ${reste} s`;
  }
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return minutes === 0 ? `${heures} h` : `${heures} h ${String(minutes).padStart(2, '0')}`;
}

/** "3 × 8 reps par côté · repos 60 s", "3 × 40 s · repos 60 s". */
export function libelleBloc(bloc: BlocSeries, exercice: Exercice): string {
  const repos = ` · repos ${bloc.reposSec} s`;
  if (exercice.unite === 'secondes') return `${bloc.series} × ${bloc.reps} s${repos}`;
  if (exercice.cotes === 'unilateral') return `${bloc.series} × ${bloc.reps} reps par côté${repos}`;
  if (exercice.cotes === 'alterne') return `${bloc.series} × ${bloc.reps} reps en alternant${repos}`;
  return `${bloc.series} × ${bloc.reps} reps${repos}`;
}

/** Temps effectif d'une série de ce bloc, tel qu'il sera chronométré. */
export function dureeSerieDuBloc(bloc: BlocSeries, tempo: Tempo): number {
  const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
  return exercice ? dureeSerieSec(exercice, bloc.reps, tempo) : 0;
}
