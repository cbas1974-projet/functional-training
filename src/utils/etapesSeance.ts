// Logique pure du mode séance guidée : construction de la liste plate des
// étapes, calculs de temps, état du métronome et agrégation du résultat.
// Aucune dépendance à React : tout est testable unitairement.
import type {
  BlocSeries,
  Exercice,
  ExerciceRealise,
  Seance,
  SeanceRealisee,
  Tempo,
} from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import {
  DUREE_PRET_SEC,
  TRANSITION_SUPERSET_SEC,
  dureeSerieSec,
  groupesDeBlocs,
  secondesParRep,
} from './generateurSeance';

// La durée de la préparation appartient au modèle de coût du générateur ;
// elle est réexportée ici parce que c'est l'étape qui la matérialise.
export { DUREE_PRET_SEC };

export type PhaseTempo = 'monte' | 'descend';

/** Travail annoncé après une préparation ou un repos. */
export type Suivant =
  | { type: 'serie'; exerciceId: string; serie: number; series: number; reps: number }
  | {
      type: 'station';
      exerciceId: string;
      tour: number;
      tours: number;
      station: number;
      stations: number;
    }
  | { type: 'retourCalme' };

/** Ce qu'annonce une préparation : toujours un travail, jamais le retour au calme. */
export type SuivantTravail = Exclude<Suivant, { type: 'retourCalme' }>;

/** Une étape de la séance guidée. Les variantes sans exercice portent
 *  `exerciceId?: undefined` pour pouvoir lire `etape.exerciceId` sans
 *  discriminer le type. */
export type Etape =
  | { type: 'echauffement'; dureeSec: number; exerciceId?: undefined }
  | {
      type: 'pret';
      exerciceId: string;
      dureeSec: number;
      suivant: SuivantTravail;
      /** Index du groupe de blocs (un bloc seul, ou les deux d'un superset). */
      groupe?: number;
    }
  | {
      type: 'serie';
      exerciceId: string;
      serie: number;
      series: number;
      reps: number;
      dureeSec: number;
      groupe?: number;
    }
  | { type: 'repos'; exerciceId: string; dureeSec: number; suivant: Suivant; groupe?: number }
  | {
      type: 'station';
      exerciceId: string;
      tour: number;
      tours: number;
      station: number;
      stations: number;
      dureeSec: number;
    }
  | {
      type: 'reposTour';
      tour: number;
      tours: number;
      dureeSec: number;
      suivant: Suivant;
      exerciceId?: undefined;
    }
  | { type: 'retourCalme'; dureeSec: number; exerciceId?: undefined }
  | { type: 'fin'; dureeSec: 0; exerciceId?: undefined };

export type EtapeTravail = Extract<Etape, { type: 'serie' | 'station' }>;

/** État affiché par le métronome pendant une série ou une station. */
export interface EtatMetronome {
  /** Répétition en cours, de 1 à `totalReps` (par côté si unilatéral). */
  rep: number;
  totalReps: number;
  phase: PhaseTempo;
  resteDansPhaseSec: number;
  cote?: 'droit' | 'gauche';
  /** Numéro de cycle montée + descente depuis le début de l'étape (0, 1, 2…),
   *  non borné : sert de clé pour ne jouer chaque bip qu'une seule fois. */
  cycle: number;
}

// ------------------------------------------------------------- Exercices

/** Exercice de repli si un identifiant sauvegardé n'existe plus dans la
 *  bibliothèque : on le traite comme un mouvement bilatéral en répétitions. */
const EXERCICE_INCONNU: Omit<Exercice, 'id'> = {
  nomFr: 'Exercice inconnu',
  nomEn: '',
  zone: 'complet',
  groupe: 'corps-entier',
  muscles: '',
  materiel: 'halteres',
  pattern: 'isolation',
  niveauMin: 1,
  cotes: 'bilateral',
  unite: 'reps',
  position: '',
  pointsAttention: [],
};

/** Retourne l'exercice de la bibliothèque, ou un exercice de repli. */
export function exerciceDeSeance(exerciceId: string): Exercice {
  const trouve: Exercice | undefined = EXERCICES_PAR_ID[exerciceId];
  return trouve ?? { ...EXERCICE_INCONNU, id: exerciceId };
}

/** Phase par laquelle commence chaque répétition de l'exercice : portée par
 *  la fiche (`premierePhase`), montée par défaut. */
export function premierePhase(exercice: Pick<Exercice, 'premierePhase'>): PhaseTempo {
  return exercice.premierePhase ?? 'monte';
}

// ------------------------------------------------------------- Étapes

/** Produit la liste plate des étapes de la séance, dans l'ordre. */
export function construireEtapes(seance: Seance): Etape[] {
  const { tempo } = seance.parametres;
  const etapes: Etape[] = [];
  const blocs = seance.blocs.filter((bloc) => bloc.series > 0);
  const circuit =
    seance.circuit && seance.circuit.stations.length > 0 && seance.circuit.tours > 0
      ? seance.circuit
      : null;

  if (seance.echauffementSec > 0) {
    etapes.push({ type: 'echauffement', dureeSec: seance.echauffementSec });
  }

  const cibleStation = (tour: number, station: number): SuivantTravail => ({
    type: 'station',
    exerciceId: circuit ? circuit.stations[station - 1] : '',
    tour,
    tours: circuit ? circuit.tours : 0,
    station,
    stations: circuit ? circuit.stations.length : 0,
  });

  const cibleSerie = (bloc: BlocSeries, serie: number): SuivantTravail => ({
    type: 'serie',
    exerciceId: bloc.exerciceId,
    serie,
    series: bloc.series,
    reps: bloc.reps,
  });

  // Un groupe rassemble les blocs d'un superset ; un bloc classique est un
  // groupe à lui seul. À l'intérieur d'un groupe, les exercices alternent
  // série par série : A1, B1, A2, B2…
  const groupes = groupesDeBlocs(blocs);
  groupes.forEach((groupe, indexGroupe) => {
    const series = groupe[0].series;
    for (let serie = 1; serie <= series; serie += 1) {
      groupe.forEach((bloc, indexBloc) => {
        const exercice = exerciceDeSeance(bloc.exerciceId);
        etapes.push({
          type: 'pret',
          exerciceId: bloc.exerciceId,
          dureeSec: DUREE_PRET_SEC,
          suivant: cibleSerie(bloc, serie),
          groupe: indexGroupe,
        });
        etapes.push({
          type: 'serie',
          exerciceId: bloc.exerciceId,
          serie,
          series: bloc.series,
          reps: bloc.reps,
          dureeSec: dureeSerieSec(exercice, bloc.reps, tempo),
          groupe: indexGroupe,
        });

        // Ce qui suit la série : l'autre exercice du superset après un repos
        // court, la série suivante, le groupe suivant, la première station du
        // circuit… ou rien d'autre que le retour au calme, auquel cas on ne
        // crée pas de repos.
        const dernierDuGroupe = indexBloc === groupe.length - 1;
        let suivant: Suivant | null = null;
        let reposSec = bloc.reposSec;
        if (!dernierDuGroupe) {
          suivant = cibleSerie(groupe[indexBloc + 1], serie);
          reposSec = bloc.transitionSec ?? TRANSITION_SUPERSET_SEC;
        } else if (serie < series) {
          suivant = cibleSerie(groupe[0], serie + 1);
        } else if (indexGroupe < groupes.length - 1) {
          suivant = cibleSerie(groupes[indexGroupe + 1][0], 1);
        } else if (circuit) {
          suivant = cibleStation(1, 1);
        }
        if (suivant && reposSec > 0) {
          etapes.push({
            type: 'repos',
            exerciceId: bloc.exerciceId,
            dureeSec: reposSec,
            suivant,
            groupe: indexGroupe,
          });
        }
      });
    }
  });

  if (circuit) {
    const nbStations = circuit.stations.length;
    etapes.push({
      type: 'pret',
      exerciceId: circuit.stations[0],
      dureeSec: DUREE_PRET_SEC,
      suivant: cibleStation(1, 1),
    });
    for (let tour = 1; tour <= circuit.tours; tour += 1) {
      for (let station = 1; station <= nbStations; station += 1) {
        etapes.push({ ...cibleStation(tour, station), dureeSec: circuit.travailSec });
        if (station < nbStations) {
          if (circuit.reposSec > 0) {
            etapes.push({
              type: 'repos',
              exerciceId: circuit.stations[station - 1],
              dureeSec: circuit.reposSec,
              suivant: cibleStation(tour, station + 1),
            });
          }
        } else if (tour < circuit.tours && circuit.reposEntreToursSec > 0) {
          etapes.push({
            type: 'reposTour',
            tour,
            tours: circuit.tours,
            dureeSec: circuit.reposEntreToursSec,
            suivant: cibleStation(tour + 1, 1),
          });
        }
      }
    }
  }

  if (seance.retourCalmeSec > 0) {
    etapes.push({ type: 'retourCalme', dureeSec: seance.retourCalmeSec });
  }
  etapes.push({ type: 'fin', dureeSec: 0 });
  return etapes;
}

/** Durée totale prévue de la séance guidée (somme des étapes). */
export function dureeTotaleSec(etapes: Etape[]): number {
  return etapes.reduce((total, etape) => total + etape.dureeSec, 0);
}

/** Temps restant estimé : reste de l'étape courante (éventuellement
 *  prolongée) plus la durée de toutes les étapes suivantes. */
export function dureeRestanteSec(
  etapes: Etape[],
  index: number,
  ecouleDansEtape: number,
  prolongationSec = 0,
): number {
  const courante = etapes[index];
  if (!courante) return 0;
  let total = Math.max(0, courante.dureeSec + prolongationSec - ecouleDansEtape);
  for (let i = index + 1; i < etapes.length; i += 1) {
    total += etapes[i].dureeSec;
  }
  return total;
}

/** Point de départ d'une unité de travail : là où « Précédent » ramène.
 *  Les séries commencent par leur préparation ; les stations d'un circuit
 *  s'enchaînent sans préparation (sauf la première). */
function estDebutUnite(etapes: Etape[], index: number): boolean {
  const etape = etapes[index];
  switch (etape.type) {
    case 'echauffement':
    case 'pret':
    case 'retourCalme':
    case 'fin':
      return true;
    case 'station':
      return etapes[index - 1]?.type !== 'pret';
    default:
      return false;
  }
}

/** Index où ramène « Précédent » : le début de l'unité précédente (série ou
 *  station précédente, ou échauffement). Depuis une série en cours, c'est
 *  sa propre préparation : on recommence la série. */
export function indexEtapePrecedente(etapes: Etape[], index: number): number {
  for (let i = Math.min(index, etapes.length) - 1; i >= 0; i -= 1) {
    if (estDebutUnite(etapes, i)) return i;
  }
  return 0;
}

/** Index où reprendre une séance interrompue à `index` : une série ou une
 *  station recommence par sa préparation quand elle en a une, les autres
 *  étapes redémarrent simplement de zéro. */
export function indexReprise(etapes: Etape[], index: number): number {
  const borne = Math.max(0, Math.min(index, etapes.length - 1));
  const etape = etapes[borne];
  if ((etape.type === 'serie' || etape.type === 'station') && etapes[borne - 1]?.type === 'pret') {
    return borne - 1;
  }
  return borne;
}

/** Groupe de blocs auquel appartient l'étape, s'il y en a un. */
function groupeDeEtape(etape: Etape): number | undefined {
  switch (etape.type) {
    case 'pret':
    case 'serie':
    case 'repos':
      return etape.groupe;
    default:
      return undefined;
  }
}

/** Index de la première étape qui ne concerne plus l'exercice de l'étape
 *  `index` : sert à « Passer l'exercice ». Dans un superset, les deux
 *  exercices sont indissociables : on passe le groupe entier. */
export function indexApresExercice(etapes: Etape[], index: number): number {
  const dernier = etapes.length - 1;
  const depart = etapes[index];
  let i = Math.min(index + 1, dernier);
  if (!depart?.exerciceId) return i;
  const groupe = groupeDeEtape(depart);
  while (i < dernier) {
    const etape = etapes[i];
    const memeGroupe = groupe !== undefined && groupeDeEtape(etape) === groupe;
    if (!memeGroupe && etape.exerciceId !== depart.exerciceId) break;
    i += 1;
  }
  return i;
}

// ------------------------------------------------------------- Métronome

/** État du métronome à `ecouleSec` secondes du début d'une série ou d'une
 *  station ; null quand il n'y a rien à compter (exercice au temps, autre
 *  étape). Pour un exercice unilatéral, la première moitié des cycles se
 *  fait du côté droit, la seconde du côté gauche. */
export function etatMetronome(etape: Etape, ecouleSec: number, tempo: Tempo): EtatMetronome | null {
  if (etape.type !== 'serie' && etape.type !== 'station') return null;
  const exercice = exerciceDeSeance(etape.exerciceId);
  if (exercice.unite === 'secondes') return null;

  const parRep = secondesParRep(tempo);
  if (parRep <= 0) return null;
  const cyclesTotaux =
    etape.type === 'serie'
      ? etape.reps * (exercice.cotes === 'unilateral' ? 2 : 1)
      : Math.floor(etape.dureeSec / parRep);
  if (cyclesTotaux <= 0) return null;

  const ecoule = Math.max(0, ecouleSec);
  const cycle = Math.floor(ecoule / parRep);
  const dansCycle = ecoule - cycle * parRep;
  const premiere = premierePhase(exercice);
  const seconde: PhaseTempo = premiere === 'monte' ? 'descend' : 'monte';
  const dureePremiere = premiere === 'monte' ? tempo.monteeSec : tempo.descenteSec;
  const phase = dansCycle < dureePremiere ? premiere : seconde;
  const resteDansPhaseSec = phase === premiere ? dureePremiere - dansCycle : parRep - dansCycle;

  // Une station dont la durée n'est pas un multiple du tempo a une « queue » :
  // le compteur y reste sur la dernière répétition.
  const cycleBorne = Math.min(cycle, cyclesTotaux - 1);

  if (exercice.cotes === 'unilateral') {
    const cyclesDroit = Math.ceil(cyclesTotaux / 2);
    if (cycleBorne < cyclesDroit) {
      return { rep: cycleBorne + 1, totalReps: cyclesDroit, phase, resteDansPhaseSec, cote: 'droit', cycle };
    }
    return {
      rep: cycleBorne - cyclesDroit + 1,
      totalReps: cyclesTotaux - cyclesDroit,
      phase,
      resteDansPhaseSec,
      cote: 'gauche',
      cycle,
    };
  }
  return { rep: cycleBorne + 1, totalReps: cyclesTotaux, phase, resteDansPhaseSec, cycle };
}

// ------------------------------------------------------------- Résultat

/** Identifiant raisonnablement unique pour l'historique. */
function nouvelIdentifiant(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Charges d'un exercice, une par série prévue, zéros de fin retirés.
 *  0 signifie « série non renseignée ». */
function poidsParSerie(saisies: number[] | undefined, seriesPrevues: number): number[] {
  const valeurs: number[] = [];
  for (let i = 0; i < seriesPrevues; i += 1) {
    const kg = saisies?.[i];
    valeurs.push(typeof kg === 'number' && Number.isFinite(kg) && kg > 0 ? kg : 0);
  }
  while (valeurs.length > 0 && valeurs[valeurs.length - 1] === 0) valeurs.pop();
  return valeurs;
}

/** Agrège le temps passé sur chaque étape en un compte rendu par exercice.
 *  Une série ou une station compte comme faite si le temps passé atteint la
 *  moitié de la durée prévue ; le temps d'un exercice additionne ses
 *  préparations, séries, stations et repos. */
export function agregerRealisation(
  seance: Seance,
  etapes: Etape[],
  tempsParEtapeSec: number[],
  poids: Record<string, number[]>,
  dureeReelleSec: number,
  terminee: boolean,
): SeanceRealisee {
  const parExercice = new Map<string, ExerciceRealise>();
  const prevoir = (exerciceId: string, seriesPrevues: number, reps: number) => {
    const existant = parExercice.get(exerciceId);
    if (existant) {
      existant.seriesPrevues += seriesPrevues;
    } else {
      parExercice.set(exerciceId, { exerciceId, seriesPrevues, seriesFaites: 0, reps, dureeSec: 0 });
    }
  };
  seance.blocs.forEach((bloc) => prevoir(bloc.exerciceId, bloc.series, bloc.reps));
  const circuit = seance.circuit;
  if (circuit) {
    circuit.stations.forEach((exerciceId) => prevoir(exerciceId, circuit.tours, circuit.travailSec));
  }

  etapes.forEach((etape, index) => {
    if (!etape.exerciceId) return;
    const realise = parExercice.get(etape.exerciceId);
    if (!realise) return;
    const temps = tempsParEtapeSec[index] ?? 0;
    switch (etape.type) {
      case 'serie':
      case 'station':
        realise.dureeSec += temps;
        if (etape.dureeSec > 0 && temps >= etape.dureeSec / 2) realise.seriesFaites += 1;
        break;
      case 'pret':
      case 'repos':
        realise.dureeSec += temps;
        break;
    }
  });

  const exercices: ExerciceRealise[] = [...parExercice.values()].map((realise) => {
    const parSerie = poidsParSerie(poids[realise.exerciceId], realise.seriesPrevues);
    // `poidsKg` reste la charge de référence de l'exercice — la plus lourde
    // des séries — pour les écrans qui n'affichent qu'un chiffre.
    const maximum = parSerie.reduce((max, kg) => Math.max(max, kg), 0);
    return {
      ...realise,
      dureeSec: Math.round(realise.dureeSec),
      ...(maximum > 0 ? { poidsKg: maximum, poidsParSerie: parSerie } : {}),
    };
  });

  return {
    id: nouvelIdentifiant(),
    date: new Date().toISOString(),
    parametres: seance.parametres,
    dureePrevueSec: dureeTotaleSec(etapes),
    dureeReelleSec: Math.round(dureeReelleSec),
    exercices,
    terminee,
  };
}
