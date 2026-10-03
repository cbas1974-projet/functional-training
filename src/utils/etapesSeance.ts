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

/** Sens par lequel commence une répétition. */
export type SensTempo = 'monte' | 'descend';

/** Phase d'une répétition. La pause se tient en bas, juste après la
 *  descente : c'est la position étirée, d'où l'on repart sans élan. */
export type PhaseTempo = SensTempo | 'pause';

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

/** Ce qui retient quelqu'un entre deux séries d'une séance du programme.
 *  repos         : la pause entre deux séries ;
 *  tour          : chacun son tour, l'autre fait sa série ;
 *  serie-de-plus : l'autre fait une série de plus que soi ;
 *  attente       : l'autre finit sa série, plus longue ;
 *  installation  : nouvel exercice — poids à changer, machine à régler. */
export type MotifRepos = 'repos' | 'tour' | 'serie-de-plus' | 'attente' | 'installation';

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
  | {
      type: 'repos';
      exerciceId: string;
      dureeSec: number;
      suivant: Suivant;
      groupe?: number;
      /** Ce qui retient : le repos, la série de l'autre, l'installation. */
      motif?: MotifRepos;
      /** La séance attend « Go » au lieu de repartir seule. */
      manuel?: boolean;
    }
  | {
      type: 'station';
      exerciceId: string;
      tour: number;
      tours: number;
      station: number;
      stations: number;
      dureeSec: number;
      /** 'libre' : travail trop court pour un tempo lent, on compte les
       *  secondes au lieu de rythmer les répétitions. */
      rythme?: 'tempo' | 'libre';
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
/** Position tenue d'un côté puis de l'autre. */
export interface EtatMaintien {
  cote: 'droit' | 'gauche';
  /** Secondes restantes sur le côté en cours. */
  resteSec: number;
  parCoteSec: number;
}

export interface EtatMetronome {
  /** Répétition en cours, de 1 à `totalReps` (par côté si unilatéral). */
  rep: number;
  totalReps: number;
  phase: PhaseTempo;
  resteDansPhaseSec: number;
  cote?: 'droit' | 'gauche';
  /** Numéro de répétition (montée, descente, pause) depuis le début de
   *  l'étape (0, 1, 2…), non borné : sert de clé pour ne jouer chaque bip
   *  qu'une seule fois. */
  cycle: number;
}

/** Où en est une répétition à un instant donné. */
export interface LecturePhase {
  phase: PhaseTempo;
  ecouleDansPhaseSec: number;
  dureePhaseSec: number;
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
export function premierePhase(exercice: Pick<Exercice, 'premierePhase'>): SensTempo {
  return exercice.premierePhase ?? 'monte';
}

/** Les phases d'une répétition, dans l'ordre, avec leur durée. La pause suit
 *  toujours la descente : un squat descend, tient, puis remonte ; un curl
 *  monte, redescend, puis tient bras tendus avant la répétition suivante.
 *  Une phase de durée nulle n'existe pas. */
export function phasesDeRep(
  tempo: Tempo,
  premiere: SensTempo,
): { phase: PhaseTempo; dureeSec: number }[] {
  const descente = { phase: 'descend' as const, dureeSec: tempo.descenteSec };
  const pause = { phase: 'pause' as const, dureeSec: tempo.pauseSec ?? 0 };
  const montee = { phase: 'monte' as const, dureeSec: tempo.monteeSec };
  const ordre = premiere === 'descend' ? [descente, pause, montee] : [montee, descente, pause];
  return ordre.filter((p) => p.dureeSec > 0);
}

/** Phase en cours `dansRepSec` secondes après le début d'une répétition.
 *  Le métronome, les bips et la bille lisent tous ce même découpage : ils
 *  basculent donc au même instant. */
export function lirePhase(tempo: Tempo, premiere: SensTempo, dansRepSec: number): LecturePhase {
  const phases = phasesDeRep(tempo, premiere);
  let debut = 0;
  for (const { phase, dureeSec } of phases) {
    if (dansRepSec < debut + dureeSec) {
      return { phase, ecouleDansPhaseSec: Math.max(0, dansRepSec - debut), dureePhaseSec: dureeSec };
    }
    debut += dureeSec;
  }
  // Au-delà de la répétition (arrondi de l'horloge) : fin de la dernière phase.
  const derniere = phases[phases.length - 1];
  if (!derniere) return { phase: premiere, ecouleDansPhaseSec: 0, dureePhaseSec: 0 };
  return { phase: derniere.phase, ecouleDansPhaseSec: derniere.dureeSec, dureePhaseSec: derniere.dureeSec };
}

// ------------------------------------------------------------- Étapes

/** Installation comptée à chaque nouvel exercice : changer les poids,
 *  régler la machine. La séance attend « Go » pour repartir. */
export const INSTALLATION_SEC = 30;
/** Chacun son tour : le temps de céder la place. */
export const CHANGEMENT_SEC = 15;

/** Un morceau du temps d'une personne : une série à faire, ou une attente. */
type Morceau =
  | { genre: 'travail'; bloc: BlocSeries; serie: number; groupe: number }
  | {
      genre: 'attente';
      dureeSec: number;
      motif: MotifRepos;
      exerciceId: string;
      groupe: number;
      manuel: boolean;
    };

type Attente = Extract<Morceau, { genre: 'attente' }>;

/** Plus le motif est fort, plus il nomme la pause entière : quelques
 *  secondes d'attente suivies du repos, c'est un repos. */
const FORCE_MOTIF: Record<MotifRepos, number> = {
  attente: 0,
  repos: 1,
  tour: 2,
  'serie-de-plus': 3,
  installation: 4,
};

/** Deux attentes qui se suivent ne font qu'une pause, nommée par la plus
 *  forte. */
function fusionner(avant: Attente, apres: Attente): Attente {
  return {
    ...avant,
    dureeSec: avant.dureeSec + apres.dureeSec,
    motif: FORCE_MOTIF[apres.motif] > FORCE_MOTIF[avant.motif] ? apres.motif : avant.motif,
  };
}

/** Les étapes d'une séance du programme. Chaque nouvel exercice attend
 *  « Go » ; dans un exercice ou un groupe lié, le chrono ne s'arrête pas.
 *
 *  À deux, les deux téléphones déroulent la même horloge : chaque tour
 *  commence ensemble, et celui qui a fini avant attend l'autre (sa série est
 *  plus longue, ou il en fait une de plus). Chacun son tour sur une machine,
 *  celui qui commence d'abord, et la série de l'un est le repos de l'autre.
 *  Sur un groupe lié qui compte une machine, on se croise : celui qui
 *  commence prend le premier exercice, l'autre le suivant. Appuyer sur « Go »
 *  ensemble remet les deux téléphones à la même seconde. */
function construireEtapesHorloge(seance: Seance): Etape[] {
  const { tempo } = seance.parametres;
  const aDeux = seance.blocs.some((bloc) => bloc.autre !== undefined);
  const jeCommence = seance.horloge?.jeCommence ?? true;
  const seriesAutre = (bloc: BlocSeries) => (aDeux ? (bloc.autre?.series ?? 0) : 0);
  const repsAutre = (bloc: BlocSeries) => bloc.autre?.reps ?? 0;
  const blocs = seance.blocs.filter((bloc) => bloc.series > 0 || seriesAutre(bloc) > 0);
  const groupes = groupesDeBlocs(blocs);
  const duree = (bloc: BlocSeries, reps: number) =>
    dureeSerieSec(exerciceDeSeance(bloc.exerciceId), reps, tempo);
  const reposDuGroupe = (groupe: BlocSeries[]) => groupe[groupe.length - 1].reposSec;

  const morceaux: Morceau[] = [];
  const attendre = (dureeSec: number, motif: MotifRepos, exerciceId: string, groupe: number, manuel = false) => {
    if (dureeSec > 0) morceaux.push({ genre: 'attente', dureeSec, motif, exerciceId, groupe, manuel });
  };

  groupes.forEach((groupe, g) => {
    // Nouvel exercice : la pause de l'exercice d'avant, l'installation, puis
    // « Go ».
    const pause = g > 0 ? reposDuGroupe(groupes[g - 1]) : 0;
    attendre(pause + INSTALLATION_SEC, 'installation', groupe[0].exerciceId, g, true);

    const machine = groupe[0];
    if (aDeux && groupe.length === 1 && machine.tour && machine.autre) {
      const autre = machine.autre;
      const ordre: ('moi' | 'autre')[] = jeCommence ? ['moi', 'autre'] : ['autre', 'moi'];
      const passages: ('moi' | 'autre')[] = [];
      for (let k = 1; k <= Math.max(machine.series, autre.series); k += 1) {
        for (const qui of ordre) {
          if (k <= (qui === 'moi' ? machine.series : autre.series)) passages.push(qui);
        }
      }
      let serie = 0;
      passages.forEach((qui, i) => {
        if (qui === 'moi') {
          serie += 1;
          morceaux.push({ genre: 'travail', bloc: machine, serie, groupe: g });
        } else {
          attendre(DUREE_PRET_SEC + duree(machine, autre.reps), 'tour', machine.exerciceId, g);
        }
        if (i < passages.length - 1) attendre(CHANGEMENT_SEC, 'tour', machine.exerciceId, g);
      });
      return;
    }

    const croise = aDeux && groupe.length > 1 && groupe.some((bloc) => bloc.tour);
    const decale = [...groupe.slice(1), groupe[0]];
    const ordreMoi = croise && !jeCommence ? decale : groupe;
    const ordreAutre = croise && jeCommence ? decale : groupe;
    const tours = Math.max(...groupe.map((bloc) => Math.max(bloc.series, seriesAutre(bloc))));
    /** Le travail d'une personne dans un tour, transitions comprises. */
    const travailDuTour = (
      ordre: BlocSeries[],
      k: number,
      series: (bloc: BlocSeries) => number,
      reps: (bloc: BlocSeries) => number,
    ) => {
      const faits = ordre.filter((bloc) => k <= series(bloc));
      return faits.reduce(
        (total, bloc, i) =>
          total + DUREE_PRET_SEC + duree(bloc, reps(bloc)) + (i < faits.length - 1 ? (bloc.transitionSec ?? 0) : 0),
        0,
      );
    };
    for (let k = 1; k <= tours; k += 1) {
      const faits = ordreMoi.filter((bloc) => k <= bloc.series);
      faits.forEach((bloc, i) => {
        morceaux.push({ genre: 'travail', bloc, serie: k, groupe: g });
        if (i < faits.length - 1) attendre(bloc.transitionSec ?? 0, 'repos', bloc.exerciceId, g);
      });
      const moi = travailDuTour(ordreMoi, k, (bloc) => bloc.series, (bloc) => bloc.reps);
      const lui = aDeux ? travailDuTour(ordreAutre, k, seriesAutre, repsAutre) : 0;
      if (lui > moi) attendre(lui - moi, moi === 0 ? 'serie-de-plus' : 'attente', groupe[0].exerciceId, g);
      if (k < tours) attendre(reposDuGroupe(groupe), 'repos', groupe[groupe.length - 1].exerciceId, g);
    }
  });

  const etapes: Etape[] = [];
  if (seance.echauffementSec > 0) etapes.push({ type: 'echauffement', dureeSec: seance.echauffementSec });
  // Les attentes qui se suivent ne font qu'une pause ; celle qui attend
  // « Go » reste à part.
  let attentes: Attente[] = [];
  const poserAttentes = (suivant: Suivant) => {
    for (const attente of attentes) {
      etapes.push({
        type: 'repos',
        exerciceId: attente.exerciceId,
        dureeSec: attente.dureeSec,
        suivant,
        groupe: attente.groupe,
        motif: attente.motif,
        ...(attente.manuel ? { manuel: true } : {}),
      });
    }
    attentes = [];
  };
  for (const morceau of morceaux) {
    if (morceau.genre === 'attente') {
      const derniere = attentes[attentes.length - 1];
      if (derniere && !derniere.manuel && !morceau.manuel) attentes[attentes.length - 1] = fusionner(derniere, morceau);
      else attentes.push(morceau);
      continue;
    }
    const { bloc, serie, groupe } = morceau;
    const cible: SuivantTravail = { type: 'serie', exerciceId: bloc.exerciceId, serie, series: bloc.series, reps: bloc.reps };
    poserAttentes(cible);
    etapes.push({ type: 'pret', exerciceId: bloc.exerciceId, dureeSec: DUREE_PRET_SEC, suivant: cible, groupe });
    etapes.push({
      type: 'serie',
      exerciceId: bloc.exerciceId,
      serie,
      series: bloc.series,
      reps: bloc.reps,
      dureeSec: duree(bloc, bloc.reps),
      groupe,
    });
  }
  poserAttentes({ type: 'retourCalme' });
  if (seance.retourCalmeSec > 0) etapes.push({ type: 'retourCalme', dureeSec: seance.retourCalmeSec });
  etapes.push({ type: 'fin', dureeSec: 0 });
  return etapes;
}

/** Attendre l'autre assez longtemps pour s'étirer. */
const ATTENTE_ETIREMENT_SEC = 45;
/** Une grosse pause : les deux minutes de la trap bar. */
const GROSSE_PAUSE_SEC = 120;

/** Une pause où l'on peut s'étirer : pendant la série de l'autre — chacun son
 *  tour, sa série de plus —, ou une grosse pause, comme les deux minutes de la
 *  trap bar, y compris celle qui suit sa dernière série. */
export function pauseAEtirement(etape: Etape): boolean {
  if (etape.type !== 'repos') return false;
  if (etape.motif === 'tour' || etape.motif === 'serie-de-plus') return etape.dureeSec >= ATTENTE_ETIREMENT_SEC;
  // Avant un nouvel exercice, la pause se compte sans l'installation.
  if (etape.motif === 'installation') return etape.dureeSec - INSTALLATION_SEC >= GROSSE_PAUSE_SEC;
  return etape.motif === 'repos' && etape.dureeSec >= GROSSE_PAUSE_SEC;
}

/** Produit la liste plate des étapes de la séance, dans l'ordre. */
export function construireEtapes(seance: Seance): Etape[] {
  if (seance.horloge) return construireEtapesHorloge(seance);
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
        etapes.push({
          type: 'station',
          exerciceId: circuit.stations[station - 1],
          tour,
          tours: circuit.tours,
          station,
          stations: nbStations,
          dureeSec: circuit.travailSec,
          rythme: circuit.rythme,
        });
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

// ------------------------------------------------------------- Maintien

/** Côté et temps restant d'une position tenue d'un seul côté puis de l'autre :
 *  la première moitié du maintien à droite, la seconde à gauche. Renvoie null
 *  pour tout le reste — une position bilatérale se tient d'un bloc, et un
 *  exercice compté en répétitions relève du métronome. */
export function etatMaintien(etape: Etape, ecouleSec: number): EtatMaintien | null {
  if (etape.type !== 'serie') return null;
  const exercice = exerciceDeSeance(etape.exerciceId);
  if (exercice.unite !== 'secondes' || exercice.cotes !== 'unilateral') return null;
  const parCote = etape.reps;
  if (parCote <= 0) return null;
  const ecoule = Math.max(0, ecouleSec);
  const premier = ecoule < parCote;
  return {
    cote: premier ? 'droit' : 'gauche',
    resteSec: Math.max(0, premier ? parCote - ecoule : parCote * 2 - ecoule),
    parCoteSec: parCote,
  };
}

// ------------------------------------------------------------- Métronome

/** État du métronome à `ecouleSec` secondes du début d'une série ou d'une
 *  station ; null quand il n'y a rien à compter (exercice au temps, autre
 *  étape). Pour un exercice unilatéral, la première moitié des cycles se
 *  fait du côté droit, la seconde du côté gauche. */
export function etatMetronome(etape: Etape, ecouleSec: number, tempo: Tempo): EtatMetronome | null {
  if (etape.type !== 'serie' && etape.type !== 'station') return null;
  // Un circuit à rythme libre ne se compte pas en répétitions : vingt secondes
  // de travail au tempo 4 s / 4 s ne feraient que deux répétitions et demie.
  if (etape.type === 'station' && etape.rythme === 'libre') return null;
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
  const lecture = lirePhase(tempo, premierePhase(exercice), dansCycle);
  const phase = lecture.phase;
  const resteDansPhaseSec = lecture.dureePhaseSec - lecture.ecouleDansPhaseSec;

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
    const charge = saisies?.[i];
    valeurs.push(typeof charge === 'number' && Number.isFinite(charge) && charge > 0 ? charge : 0);
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
    // `poids` est la charge de référence de l'exercice — la plus lourde des
    // séries — pour les écrans qui n'affichent qu'un chiffre. Son unité est
    // celle de la séance (`parametres.unitePoids`).
    const maximum = parSerie.reduce((max, valeur) => Math.max(max, valeur), 0);
    return {
      ...realise,
      dureeSec: Math.round(realise.dureeSec),
      ...(maximum > 0 ? { poids: maximum, poidsParSerie: parSerie } : {}),
    };
  });

  return {
    id: nouvelIdentifiant(),
    date: new Date().toISOString(),
    ...(seance.titre ? { titre: seance.titre } : {}),
    parametres: seance.parametres,
    dureePrevueSec: dureeTotaleSec(etapes),
    dureeReelleSec: Math.round(dureeReelleSec),
    exercices,
    terminee,
  };
}
