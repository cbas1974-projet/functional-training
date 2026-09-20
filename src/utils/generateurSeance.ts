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

/** Coût d'un bloc : chaque série est suivie de son repos, le dernier repos
 *  servant de transition vers l'exercice suivant. */
function coutBloc(exercice: Exercice, bloc: BlocSeries, tempo: Tempo): number {
  return bloc.series * (dureeSerieSec(exercice, bloc.reps, tempo) + bloc.reposSec);
}

function coutCircuit(circuit: Circuit): number {
  const parStation = circuit.travailSec + circuit.reposSec;
  return (
    circuit.tours * circuit.stations.length * parStation +
    Math.max(0, circuit.tours - 1) * circuit.reposEntreToursSec
  );
}

// ------------------------------------------------------------- Sélection

/** Parcourt le cycle de zones et retient au plus `maximum` exercices, en
 *  préférant à chaque fois un groupe musculaire pas encore sollicité. */
function selectionnerExercices(
  candidats: Exercice[],
  cycle: Zone[],
  maximum: number,
  alea: () => number,
): Exercice[] {
  const retenus: Exercice[] = [];
  const idsRetenus = new Set<string>();
  const groupesUtilises = new Set<GroupeMusculaire>();
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
    const preferes = disponibles.filter((e) => !groupesUtilises.has(e.groupe));
    const choisi = tirer(preferes.length > 0 ? preferes : disponibles, alea);
    retenus.push(choisi);
    idsRetenus.add(choisi.id);
    groupesUtilises.add(choisi.groupe);
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

/** Construit les blocs de séries qui remplissent le mieux le budget. */
function construireBlocs(
  retenus: Exercice[],
  budgetSec: number,
  reglages: ReglagesNiveau,
  tempo: Tempo,
): BlocSeries[] {
  if (retenus.length === 0) return [];

  // Durée d'une série, exercice par exercice et pour chaque option de reps.
  const dureeUneSerie = (exercice: Exercice, reps: number): number =>
    dureeSerieSec(exercice, repsEffectives(exercice, reps, reglages), tempo);

  const enumerer = (
    seriesPossibles: number[],
    repsPossibles: number[],
  ): { possibles: Combinaison[]; meilleurCout: number } => {
    const possibles: Combinaison[] = [];
    let meilleurCout = 0;
    for (let nombre = 1; nombre <= retenus.length; nombre += 1) {
      for (const series of seriesPossibles) {
        for (const reps of repsPossibles) {
          for (const repos of reglages.repos) {
            let cout = 0;
            for (let i = 0; i < nombre; i += 1) {
              cout += series * (dureeUneSerie(retenus[i], reps) + repos);
            }
            if (cout > budgetSec) continue;
            possibles.push({ nombre, series, reps, repos, cout });
            if (cout > meilleurCout) meilleurCout = cout;
          }
        }
      }
    }
    return { possibles, meilleurCout };
  };

  // Les séries et répétitions demandées passent en premier ; si elles ne
  // tiennent pas dans la durée (séance très courte, exercice unilatéral
  // long…), on relâche d'abord les répétitions, puis les séries, puis tout.
  const { seriesPreferees, repsPreferees } = reglages;
  const essais: [number[], number[]][] = [];
  if (seriesPreferees && repsPreferees) essais.push([[seriesPreferees], [repsPreferees]]);
  if (seriesPreferees) essais.push([[seriesPreferees], reglages.reps]);
  if (repsPreferees) essais.push([reglages.series, [repsPreferees]]);
  essais.push([reglages.series, reglages.reps]);
  let possibles: Combinaison[] = [];
  let meilleurCout = 0;
  for (const [seriesPossibles, repsPossibles] of essais) {
    ({ possibles, meilleurCout } = enumerer(seriesPossibles, repsPossibles));
    if (possibles.length > 0) break;
  }

  let choix: Combinaison;
  if (possibles.length === 0) {
    // Séances très courtes : on garde au moins un exercice, une série, le
    // volume minimal du niveau, quitte à dépasser un peu la durée demandée.
    choix = {
      nombre: 1,
      series: 1,
      reps: reglages.repsPreferees ?? Math.min(...reglages.reps),
      repos: Math.min(...reglages.repos),
      cout: 0,
    };
  } else {
    const seuil = meilleurCout * SEUIL_REMPLISSAGE;
    const retenues = possibles.filter((c) => c.cout >= seuil);
    retenues.sort((a, b) => b.nombre - a.nombre || b.series - a.series || b.cout - a.cout);
    choix = retenues[0];
  }

  return retenus.slice(0, choix.nombre).map((exercice) => ({
    exerciceId: exercice.id,
    series: choix.series,
    reps: repsEffectives(exercice, choix.reps, reglages),
    reposSec: choix.repos,
  }));
}

/** Choisit le nombre de tours et de stations qui remplit le mieux le budget. */
function construireCircuit(
  stations: Exercice[],
  budgetSec: number,
  reglages: ReglagesNiveau,
  bornes: BornesCircuit,
): Circuit | null {
  if (stations.length === 0) return null;
  const parStation = reglages.travailSec + reglages.reposStationSec;
  const maximumStations = Math.min(bornes.stationsMax, stations.length);
  const minimumStations = Math.min(bornes.stationsMin, maximumStations);

  let meilleur: { tours: number; nombre: number; cout: number } | null = null;
  for (let tours = bornes.toursMin; tours <= bornes.toursMax; tours += 1) {
    for (let nombre = minimumStations; nombre <= maximumStations; nombre += 1) {
      const cout = tours * nombre * parStation + (tours - 1) * REPOS_ENTRE_TOURS_SEC;
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
  return {
    stations: stations.slice(0, choix.nombre).map((e) => e.id),
    tours: choix.tours,
    travailSec: reglages.travailSec,
    reposSec: reglages.reposStationSec,
    reposEntreToursSec: REPOS_ENTRE_TOURS_SEC,
  };
}

// ------------------------------------------------------------- API publique

/** Exercices utilisables avec ces paramètres (matériel, niveau, explosifs). */
export function exercicesDisponibles(parametres: ParametresSeance): Exercice[] {
  const niveauMax = NIVEAU_MAX[parametres.niveau];
  return EXERCICES.filter((exercice) => {
    if (exercice.niveauMin > niveauMax) return false;
    if (!parametres.banc && exercice.materiel !== 'halteres') return false;
    if (!parametres.explosifs && exercice.explosif === true) return false;
    return true;
  });
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
    blocs = construireBlocs(retenus, budgetSeries, reglages, parametres.tempo);
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
    // Format séries, et format mixte trop court pour accueillir un circuit.
    const retenus = selectionnerExercices(candidats, cycle, reglages.maxExercices, alea);
    blocs = construireBlocs(retenus, budget, reglages, parametres.tempo);
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

  const alternatives = exercicesDisponibles(seance.parametres).filter(
    (exercice) => exercice.zone === actuel.zone && !utilises.has(exercice.id),
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

/** Durée totale estimée de la séance en secondes. */
export function estimerDureeSec(seance: Seance): number {
  let total = seance.echauffementSec + seance.retourCalmeSec;
  for (const bloc of seance.blocs) {
    const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
    if (!exercice) continue;
    total += coutBloc(exercice, bloc, seance.parametres.tempo);
  }
  if (seance.circuit) total += coutCircuit(seance.circuit);
  return total;
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
