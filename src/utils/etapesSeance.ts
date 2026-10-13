// Logique pure du mode séance guidée : construction de la liste plate des
// étapes, calculs de temps, état du métronome et agrégation du résultat.
// Aucune dépendance à React : tout est testable unitairement.
import type {
  BlocSeries,
  Exercice,
  ExerciceRealise,
  FormeMouvement,
  MouvementGuide,
  Personne,
  Seance,
  SeanceRealisee,
  Tempo,
  TempoExercice,
} from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import {
  DUREE_PRET_SEC,
  TRANSITION_SUPERSET_SEC,
  changementDeCoteSec,
  dureeSerieSec,
  estCercleAuTemps,
  groupesDeBlocs,
  secondesParRep,
  tempoPourExercice,
} from './generateurSeance';

// La durée de la préparation appartient au modèle de coût du générateur ;
// elle est réexportée ici parce que c'est l'étape qui la matérialise.
export { DUREE_PRET_SEC };

/** Sens par lequel commence une répétition. */
export type SensTempo = 'monte' | 'descend';

/** Phase d'une répétition. La pause se tient en bas, juste après la
 *  descente : c'est la position étirée, d'où l'on repart sans élan — sauf
 *  aux exercices qui tiennent en haut (`pauseEnHaut`), où elle suit la
 *  montée, muscles serrés. Un mouvement circulaire n'a qu'une phase, le tour
 *  complet ('tourne') ; un mouvement en rotation garde la montée et la
 *  descente, qui y vont à droite puis à gauche (`motDePhase`). */
export type PhaseTempo = SensTempo | 'pause' | 'tourne';

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
 *  installation  : nouvel exercice — poids à changer, machine à régler ;
 *  a-lancer      : sur un seul téléphone, la fin d'un exercice ou d'une
 *                  paire : la pause attend qu'on la lance d'un clic ;
 *  pause         : sur un seul téléphone, la pause lancée, qui compte sa
 *                  minute et repart d'elle-même, sur un son et une
 *                  vibration. */
export type MotifRepos = 'repos' | 'tour' | 'serie-de-plus' | 'attente' | 'installation' | 'a-lancer' | 'pause';

/** Sur un seul téléphone, à deux : qui fait une série — la personne du
 *  téléphone, l'autre, ou les deux ensemble. */
export type QuiFait = 'moi' | 'autre' | 'les-deux';

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
      /** Sur un seul téléphone, à deux : qui la fait. Absent : soi. */
      qui?: QuiFait;
      /** Sur un seul téléphone : elle se finit sur « Série terminée », pas au
       *  bout du temps ; sa durée n'est qu'une estimation. */
      manuelle?: boolean;
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

/** Une série au temps, partie par partie : une position tenue d'un côté
 *  puis de l'autre (le côté), ou un cercle tourné dans un sens puis dans
 *  l'autre (le sens). */
export interface EtatMaintien {
  /** Un exercice unilatéral : le côté en cours. */
  cote?: 'droit' | 'gauche';
  /** Un cercle au temps : le premier sens pendant la première moitié de la
   *  série, l'autre sens ensuite. */
  sens?: 'premier' | 'second';
  /** Les premières secondes du second sens : on l'annonce, sans s'arrêter
   *  (`ANNONCE_CHANGE_DE_SENS_SEC`). */
  changeDeSens?: boolean;
  /** Secondes restantes dans la partie en cours. */
  resteSec: number;
  /** La durée d'une partie : un côté, ou un sens. */
  partieSec: number;
}

/** État affiché par le métronome pendant une série ou une station. */
export interface EtatMetronome {
  /** Répétition en cours, de 1 à `totalReps` (par côté si unilatéral). */
  rep: number;
  totalReps: number;
  phase: PhaseTempo;
  resteDansPhaseSec: number;
  /** Durée de la phase en cours : la bille en tire sa progression. */
  dureePhaseSec: number;
  cote?: 'droit' | 'gauche';
  /** Mouvement circulaire : le premier sens pendant la première moitié de la
   *  série, l'autre sens ensuite. */
  sens?: 'premier' | 'second';
  /** Le premier tour dans l'autre sens : on l'annonce, sans s'arrêter. */
  changeDeSens?: boolean;
  /** Numéro de répétition (montée, descente, pause) depuis le début de
   *  l'étape (0, 1, 2…), non borné : sert de clé pour ne jouer chaque bip
   *  qu'une seule fois. */
  cycle: number;
}

/** Le changement de côté au milieu d'une série unilatérale : un compte à
 *  rebours, avant de repartir de l'autre côté. */
export interface EtatChangementCote {
  /** Le côté qui vient. */
  cote: 'gauche';
  resteSec: number;
  dureeSec: number;
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

/** La forme de la répétition de l'exercice : verticale par défaut. */
export function formeDe(exercice: Pick<Exercice, 'mouvement'>): FormeMouvement {
  return exercice.mouvement ?? 'vertical';
}

/** Phase par laquelle commence chaque répétition de l'exercice : portée par
 *  la fiche (`premierePhase`), montée par défaut. Un cercle ou un va-et-vient
 *  part toujours du même bout : le tour, ou la droite. */
export function premierePhase(exercice: Pick<Exercice, 'premierePhase' | 'mouvement'>): SensTempo {
  if (exercice.mouvement) return 'monte';
  return exercice.premierePhase ?? 'monte';
}

/** Le mot que dicte le métronome pour une phase. MONTE, DESCENDS et TIENS
 *  pour un mouvement vertical — ou les mots propres à l'exercice quand
 *  monter et descendre ne disent pas le geste (`motsTempo`) ; TOURNE pour un
 *  cercle, d'un bout à l'autre du tour ; À DROITE puis À GAUCHE pour un
 *  mouvement d'un côté à l'autre. La séance guidée l'affiche, et le tableau
 *  des mouvements (docs/mouvements.md) le recopie. */
export function motDePhase(phase: PhaseTempo, exercice: Pick<Exercice, 'mouvement' | 'motsTempo'>): string {
  if (phase === 'pause') return 'TIENS';
  if (phase === 'tourne') return 'TOURNE';
  if (exercice.mouvement === 'rotation') return phase === 'monte' ? 'À DROITE' : 'À GAUCHE';
  if (exercice.motsTempo) return exercice.motsTempo[phase];
  return phase === 'monte' ? 'MONTE' : 'DESCENDS';
}

/** Les phases d'une répétition, dans l'ordre, avec leur durée. La pause suit
 *  la descente — un développé couché descend, tient, puis remonte ; un curl
 *  monte, redescend, puis tient bras tendus avant la répétition suivante —,
 *  sauf quand l'arrêt se tient en haut (`pauseEnHaut`) : alors elle suit la
 *  montée. Une Superman monte, tient, puis redescend se poser ; un exercice
 *  qui part d'en haut descend, remonte, puis tient en haut avant la
 *  répétition suivante. Une phase de durée nulle n'existe pas. */
export function phasesDeRep(
  tempo: TempoExercice,
  premiere: SensTempo,
): { phase: PhaseTempo; dureeSec: number }[] {
  // Un cercle : un seul geste, le tour complet, sans arrêt nulle part.
  if (tempo.mouvement === 'circulaire') {
    const tour = tempo.monteeSec + tempo.descenteSec;
    return tour > 0 ? [{ phase: 'tourne', dureeSec: tour }] : [];
  }
  const descente = { phase: 'descend' as const, dureeSec: tempo.descenteSec };
  // Un cercle ou un va-et-vient ne s'arrête jamais (`tempoPourExercice`) ; le
  // va-et-vient part toujours à droite.
  const pause = { phase: 'pause' as const, dureeSec: tempo.mouvement ? 0 : (tempo.pauseSec ?? 0) };
  const montee = { phase: 'monte' as const, dureeSec: tempo.monteeSec };
  const depart = tempo.mouvement === 'rotation' ? 'monte' : premiere;
  const ordre = tempo.pauseEnHaut
    ? depart === 'descend'
      ? [descente, montee, pause]
      : [montee, pause, descente]
    : depart === 'descend'
      ? [descente, pause, montee]
      : [montee, descente, pause];
  return ordre.filter((p) => p.dureeSec > 0);
}

/** Phase en cours `dansRepSec` secondes après le début d'une répétition.
 *  Le métronome, les bips et la bille lisent tous ce même découpage : ils
 *  basculent donc au même instant. */
export function lirePhase(tempo: TempoExercice, premiere: SensTempo, dansRepSec: number): LecturePhase {
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

/** Où se trouve la bille sur son rail, de 0 (en haut) à 1 (au pied), à
 *  `progression` (de 0 à 1) de la phase. Elle monte pendant la montée,
 *  descend pendant la descente, et pendant la pause elle reste là où la phase
 *  d'avant l'a laissée : au pied du rail après la descente, en haut après la
 *  montée quand l'exercice tient en haut (`pauseEnHaut`). Pour un tour
 *  ('tourne'), c'est la part du cercle déjà parcourue : la bille ne s'arrête
 *  jamais. */
export function positionBille(phase: PhaseTempo, progression: number, pauseEnHaut = false): number {
  const p = Math.min(1, Math.max(0, progression));
  if (phase === 'monte') return 1 - p;
  if (phase === 'descend' || phase === 'tourne') return p;
  return pauseEnHaut ? 0 : 1;
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
  pause: 1,
  tour: 2,
  'serie-de-plus': 3,
  installation: 4,
  'a-lancer': 5,
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
 *  Sur une paire qui compte une machine, on se croise : celui qui commence
 *  prend le premier exercice, l'autre le suivant, puis on échange — arrivé
 *  à la machine avant que l'autre l'ait quittée, on l'attend. Appuyer sur
 *  « Go » ensemble remet les deux téléphones à la même seconde. */
function construireEtapesHorloge(seance: Seance): Etape[] {
  const { tempo } = seance.parametres;
  const aDeux = seance.blocs.some((bloc) => bloc.autre !== undefined);
  const jeCommence = seance.horloge?.jeCommence ?? true;
  const installationSec = seance.horloge?.installationSec ?? INSTALLATION_SEC;
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
    attendre(pause + installationSec, 'installation', groupe[0].exerciceId, g, true);

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
    const mesSeries = (bloc: BlocSeries) => bloc.series;
    const mesReps = (bloc: BlocSeries) => bloc.reps;
    /** Le tour k d'une personne : chacun de ses exercices, avec ce qui le
     *  précède — la transition, et, quand on se croise, la machine que l'autre
     *  n'a pas encore quittée : on l'attend. `fin` : où en est la personne. */
    const tourDe = (
      k: number,
      ordre: BlocSeries[],
      series: (bloc: BlocSeries) => number,
      reps: (bloc: BlocSeries) => number,
      ordreDeLAutre: BlocSeries[],
      seriesDeLAutre: (bloc: BlocSeries) => number,
      repsDeLAutre: (bloc: BlocSeries) => number,
    ) => {
      const faits = ordre.filter((bloc) => k <= series(bloc));
      const [premierDeLAutre] = ordreDeLAutre.filter((bloc) => k <= seriesDeLAutre(bloc));
      let fin = 0;
      return faits.map((bloc, i) => {
        const transition = i > 0 ? (faits[i - 1].transitionSec ?? 0) : 0;
        const libre =
          croise && i > 0 && bloc.tour && bloc === premierDeLAutre ? DUREE_PRET_SEC + duree(bloc, repsDeLAutre(bloc)) : 0;
        const machine = Math.max(0, libre - (fin + transition));
        fin += transition + machine + DUREE_PRET_SEC + duree(bloc, reps(bloc));
        return { bloc, transition, machine, fin };
      });
    };
    for (let k = 1; k <= tours; k += 1) {
      const miens = tourDe(k, ordreMoi, mesSeries, mesReps, ordreAutre, seriesAutre, repsAutre);
      const siens = aDeux ? tourDe(k, ordreAutre, seriesAutre, repsAutre, ordreMoi, mesSeries, mesReps) : [];
      miens.forEach(({ bloc, transition, machine }, i) => {
        if (i > 0) attendre(transition, 'repos', miens[i - 1].bloc.exerciceId, g);
        attendre(machine, 'tour', bloc.exerciceId, g);
        morceaux.push({ genre: 'travail', bloc, serie: k, groupe: g });
      });
      const moi = miens.at(-1)?.fin ?? 0;
      const lui = siens.at(-1)?.fin ?? 0;
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

/** Les exercices d'une séance sur un seul téléphone, groupe par groupe — un
 *  exercice seul, ou les deux d'une paire —, numérotés comme le `groupe` de
 *  ses étapes : l'écran de la séance les liste dans cet ordre. */
export function groupesUnTelephone(seance: Seance): BlocSeries[][] {
  const aDeux = seance.blocs.some((bloc) => bloc.autre !== undefined);
  return groupesDeBlocs(seance.blocs.filter((bloc) => bloc.series > 0 || (aDeux && (bloc.autre?.series ?? 0) > 0)));
}

/** Les étapes d'une séance du programme sur un seul téléphone (décision de
 *  Sébastien, 12 octobre 2026) : celui qui le tient note pour les deux, et
 *  regarde le mouvement plutôt que le chrono.
 *  - Pas de minuteur pendant une série : elle se finit sur « Série terminée »
 *    (`manuelle`). Sa durée n'est qu'une estimation, pour la durée annoncée :
 *    la série elle-même, au tempo — la plus longue des deux quand on la fait
 *    ensemble —, et le temps de passer à la suivante.
 *  - Une paire : A, B, A, B…, les deux ensemble, jusqu'au bout de toutes les
 *    séries, sans pause entre les tours. Sauf une machine (`tour` : un seul
 *    siège) : à deux, jamais en même temps — chacun son tour, celui qui
 *    commence d'abord, puis l'autre exercice, ensemble (audit du 13 octobre
 *    2026).
 *  - Un exercice seul, à deux : chacun son tour, celui qui commence d'abord —
 *    la série de l'un est le repos de l'autre. Seul, sans l'autre, la pause
 *    vient entre deux séries.
 *  - La pause, à la fin d'un exercice ou d'une paire, attend qu'on la lance
 *    (`a-lancer`), puis compte sa minute (`pause`) et repart d'elle-même vers
 *    l'exercice suivant. Pas de mise en place en plus : on s'installe pendant
 *    la pause.
 *  Ni préparation, ni « Go », ni attente de l'autre. */
function construireEtapesUnTelephone(seance: Seance): Etape[] {
  const { tempo } = seance.parametres;
  const aDeux = seance.blocs.some((bloc) => bloc.autre !== undefined);
  const jeCommence = seance.horloge?.jeCommence ?? true;
  const seriesAutre = (bloc: BlocSeries) => (aDeux ? (bloc.autre?.series ?? 0) : 0);
  const repsAutre = (bloc: BlocSeries) => bloc.autre?.reps ?? bloc.reps;
  const groupes = groupesUnTelephone(seance);
  const duree = (bloc: BlocSeries, reps: number) => dureeSerieSec(exerciceDeSeance(bloc.exerciceId), reps, tempo);

  /** Une série à faire : qui la fait, et le temps qu'elle prend. */
  interface Travail {
    bloc: BlocSeries;
    serie: number;
    series: number;
    qui: QuiFait;
    reps: number;
    sec: number;
  }
  const etapes: Etape[] = [];
  if (seance.echauffementSec > 0) etapes.push({ type: 'echauffement', dureeSec: seance.echauffementSec });
  // La cible d'une pause — la série qui suit — n'est connue qu'ensuite :
  // elle se pose à la fin.
  const aRetourCalme: Suivant = { type: 'retourCalme' };
  /** La pause, à lancer d'un clic, puis lancée. */
  const poserPause = (exerciceId: string, dureeSec: number, groupe: number) => {
    if (dureeSec <= 0) return;
    etapes.push({ type: 'repos', exerciceId, dureeSec: 0, suivant: aRetourCalme, groupe, motif: 'a-lancer', manuel: true });
    etapes.push({ type: 'repos', exerciceId, dureeSec, suivant: aRetourCalme, groupe, motif: 'pause' });
  };

  /** Qui commence, quand c'est chacun son tour. Seul, soi. */
  const ordre: ('moi' | 'autre')[] = !aDeux ? ['moi'] : jeCommence ? ['moi', 'autre'] : ['autre', 'moi'];
  /** La série `k` d'un bloc, chacun son tour : celle de chacun qui l'a. */
  const chacunSonTour = (bloc: BlocSeries, k: number, series: number): Travail[] =>
    ordre
      .filter((qui) => k <= (qui === 'moi' ? bloc.series : seriesAutre(bloc)))
      .map((qui) => {
        const reps = qui === 'moi' ? bloc.reps : repsAutre(bloc);
        return { bloc, serie: k, series, qui, reps, sec: duree(bloc, reps) };
      });

  groupes.forEach((groupe, g) => {
    const seul = groupe.length === 1;
    const travaux: Travail[] = [];
    if (seul) {
      const [bloc] = groupe;
      const tours = Math.max(bloc.series, seriesAutre(bloc));
      for (let k = 1; k <= tours; k += 1) travaux.push(...chacunSonTour(bloc, k, tours));
    } else {
      const tours = Math.max(...groupe.map((bloc) => Math.max(bloc.series, seriesAutre(bloc))));
      for (let k = 1; k <= tours; k += 1) {
        for (const bloc of groupe) {
          const moi = k <= bloc.series;
          const lui = k <= seriesAutre(bloc);
          if (!moi && !lui) continue;
          const series = Math.max(bloc.series, seriesAutre(bloc));
          // Une machine, un seul siège : à deux, chacun son tour, jamais
          // ensemble — puis l'autre exercice de la paire.
          if (aDeux && bloc.tour) {
            travaux.push(...chacunSonTour(bloc, k, series));
            continue;
          }
          travaux.push({
            bloc,
            serie: k,
            series,
            qui: moi && lui ? 'les-deux' : moi ? 'moi' : 'autre',
            reps: Math.max(moi ? bloc.reps : 0, lui ? repsAutre(bloc) : 0),
            sec: Math.max(moi ? duree(bloc, bloc.reps) : 0, lui ? duree(bloc, repsAutre(bloc)) : 0),
          });
        }
      }
    }
    travaux.forEach((travail, i) => {
      const dernier = i === travaux.length - 1;
      // Le temps de passer à la série qui suit : à l'autre personne — céder
      // la place —, ou à l'autre exercice de la paire. Seul, la pause en
      // tient lieu.
      const memeBloc = travaux[i + 1]?.bloc === travail.bloc;
      const passage =
        dernier || (seul && !aDeux) ? 0 : seul || memeBloc ? CHANGEMENT_SEC : (travail.bloc.transitionSec ?? CHANGEMENT_SEC);
      etapes.push({
        type: 'serie',
        exerciceId: travail.bloc.exerciceId,
        serie: travail.serie,
        series: travail.series,
        reps: travail.reps,
        dureeSec: travail.sec + passage,
        groupe: g,
        ...(aDeux ? { qui: travail.qui } : {}),
        manuelle: true,
      });
      if (seul && !aDeux && !dernier) poserPause(travail.bloc.exerciceId, travail.bloc.reposSec, g);
    });
    // La pause de l'exercice ou de la paire : celle de son dernier bloc. Pas
    // après le dernier : les étirements suivent.
    const dernierBloc = groupe[groupe.length - 1];
    if (g < groupes.length - 1) poserPause(dernierBloc.exerciceId, dernierBloc.reposSec, g);
  });

  // Chaque pause annonce la série qui la suit.
  let cible: Suivant = aRetourCalme;
  for (let i = etapes.length - 1; i >= 0; i -= 1) {
    const etape = etapes[i];
    if (etape.type === 'serie') {
      cible = { type: 'serie', exerciceId: etape.exerciceId, serie: etape.serie, series: etape.series, reps: etape.reps };
    } else if (etape.type === 'repos') {
      etapes[i] = { ...etape, suivant: cible };
    }
  }
  if (seance.retourCalmeSec > 0) etapes.push({ type: 'retourCalme', dureeSec: seance.retourCalmeSec });
  etapes.push({ type: 'fin', dureeSec: 0 });
  return etapes;
}

/** Attendre l'autre assez longtemps pour s'étirer. */
const ATTENTE_ETIREMENT_SEC = 45;
/** Une grosse pause : deux minutes. La trap bar n'en a plus depuis le 12
 *  octobre 2026 — une minute trente. */
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
  if (seance.horloge?.unTelephone) return construireEtapesUnTelephone(seance);
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
    // Sur un seul téléphone, chaque série et la pause à lancer : sans
    // préparation, elles sont leur propre départ.
    case 'serie':
      return etape.manuelle === true;
    case 'repos':
      return etape.motif === 'a-lancer';
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

// ------------------------------------------------------------- Échauffement et étirements

/** Le mouvement en cours d'un échauffement ou d'un retour au calme. */
export interface EtatMouvement {
  index: number;
  /** Ce qu'il lui reste, en secondes. */
  resteSec: number;
}

/** Le mouvement en cours d'un échauffement ou d'un retour au calme, et ce
 *  qu'il lui reste. Chaque mouvement a sa durée (cinq minutes de tapis, trente
 *  secondes d'étirement, cinq pour changer de côté) ; sans durée, ils se
 *  partagent l'étape.
 *
 *  `rallonges` : les secondes ajoutées à un mouvement (« +5 s » au changement
 *  de côté), par index ; elles repoussent les suivants d'autant. Une
 *  prolongation de l'étape qu'aucune rallonge n'explique va au dernier. */
export function lireMouvement(
  mouvements: readonly MouvementGuide[],
  dureeEtapeSec: number,
  ecouleSec: number,
  rallonges: Readonly<Record<number, number>> = {},
  prolongationSec = 0,
): EtatMouvement {
  if (mouvements.length === 0 || dureeEtapeSec <= 0) return { index: 0, resteSec: 0 };
  const propres = mouvements.map((m) => m.dureeSec ?? 0);
  const total = propres.reduce((somme, d) => somme + d, 0);
  const durees =
    total > 0 && propres.every((d) => d > 0)
      ? propres.map((d) => (d * dureeEtapeSec) / total)
      : mouvements.map(() => dureeEtapeSec / mouvements.length);
  let expliquees = 0;
  for (let i = 0; i < durees.length; i += 1) {
    const rallonge = Math.max(0, rallonges[i] ?? 0);
    durees[i] += rallonge;
    expliquees += rallonge;
  }
  durees[durees.length - 1] += Math.max(0, prolongationSec - expliquees);
  let fin = 0;
  for (let i = 0; i < durees.length; i += 1) {
    fin += durees[i];
    if (ecouleSec < fin || i === durees.length - 1) return { index: i, resteSec: Math.max(0, fin - ecouleSec) };
  }
  return { index: durees.length - 1, resteSec: 0 };
}

// ------------------------------------------------------------- Maintien

/** Un cercle au temps change de sens sans s'arrêter : « Change de sens ! »
 *  reste affiché les premières secondes de l'autre sens, après un bip. */
export const ANNONCE_CHANGE_DE_SENS_SEC = 3;

/** La durée de chaque côté d'un exercice d'un seul côté, fait au temps :
 *  les `reps` secondes d'une série ; pour une station de circuit, la moitié
 *  de ce qui reste de son temps une fois le changement de côté pris ; 0 quand
 *  il n'y a pas de côté à compter — une station à rythme libre se joue d'un
 *  élan, jusqu'au signal. */
function secondesParCoteAuTemps(etape: Extract<Etape, { type: 'serie' | 'station' }>, exercice: Exercice): number {
  if (etape.type === 'serie') return etape.reps;
  if (etape.rythme === 'libre') return 0;
  return Math.max(0, (etape.dureeSec - changementDeCoteSec(exercice)) / 2);
}

/** Le changement de côté d'une série au temps de musculation (le relevé
 *  turc, les explosifs d'un seul bras), entre le côté droit et le côté
 *  gauche : ses 5 s (`changementDeCoteSec`), plus ce que « +5 s » y a ajouté ;
 *  null sans changement — une position de yoga ou un étirement enchaîne ses
 *  côtés. */
function fenetreChangementAuTemps(
  etape: Extract<Etape, { type: 'serie' | 'station' }>,
  exercice: Exercice,
  prolongationSec: number,
): { debutSec: number; dureeSec: number } | null {
  const changement = changementDeCoteSec(exercice);
  const parCote = secondesParCoteAuTemps(etape, exercice);
  if (exercice.unite !== 'secondes' || changement <= 0 || parCote <= 0) return null;
  return { debutSec: parCote, dureeSec: changement + Math.max(0, prolongationSec) };
}

/** Où en est une série au temps, partie par partie ; null pour tout le reste
 *  — une tenue d'un bloc se lit au décompte de l'étape, et un exercice compté
 *  en répétitions relève du métronome.
 *  - Une position tenue d'un seul côté : la première moitié à droite, la
 *    seconde à gauche. Un exercice de musculation (le relevé turc, un
 *    explosif d'un seul bras) change de côté entre les deux
 *    (`etatChangementCote`, allongé de `prolongationSec` par « +5 s ») :
 *    null pendant ce temps.
 *  - Un cercle au temps (`estCercleAuTemps`) : `reps` secondes dans un sens,
 *    puis autant dans l'autre, sans s'arrêter — la moitié de son temps pour
 *    une station de circuit. Les premières secondes de l'autre sens portent
 *    `changeDeSens`. */
export function etatMaintien(etape: Etape, ecouleSec: number, prolongationSec = 0): EtatMaintien | null {
  if (etape.type !== 'serie' && etape.type !== 'station') return null;
  const exercice = exerciceDeSeance(etape.exerciceId);
  if (exercice.unite !== 'secondes') return null;
  const ecoule = Math.max(0, ecouleSec);

  if (estCercleAuTemps(exercice)) {
    const parSens = etape.type === 'serie' ? etape.reps : etape.dureeSec / 2;
    if (parSens <= 0) return null;
    if (ecoule < parSens) return { sens: 'premier', resteSec: parSens - ecoule, partieSec: parSens };
    return {
      sens: 'second',
      ...(ecoule - parSens < ANNONCE_CHANGE_DE_SENS_SEC ? { changeDeSens: true } : {}),
      resteSec: Math.max(0, parSens * 2 - ecoule),
      partieSec: parSens,
    };
  }

  if (exercice.cotes !== 'unilateral') return null;
  const parCote = secondesParCoteAuTemps(etape, exercice);
  if (parCote <= 0) return null;
  if (ecoule < parCote) return { cote: 'droit', resteSec: parCote - ecoule, partieSec: parCote };
  const debutGauche = parCote + (fenetreChangementAuTemps(etape, exercice, prolongationSec)?.dureeSec ?? 0);
  if (ecoule < debutGauche) return null;
  return { cote: 'gauche', resteSec: Math.max(0, debutGauche + parCote - ecoule), partieSec: parCote };
}

// ------------------------------------------------------------- Métronome

/** Le déroulé d'une série ou d'une station en répétitions : leur tempo,
 *  leur nombre, et, d'un exercice unilatéral, le côté droit, le changement de
 *  côté, puis le côté gauche. */
interface PlanTravail {
  exercice: Exercice;
  tempo: TempoExercice;
  parRep: number;
  cyclesTotaux: number;
  /** Unilatéral : les répétitions du côté droit, le reste se fait à gauche ;
   *  null pour un exercice bilatéral ou alterné. */
  cyclesDroit: number | null;
  /** Le changement de côté entre les deux, en secondes ; 0 sans changement. */
  changementSec: number;
}

function planTravail(etape: Etape, tempo: Tempo): PlanTravail | null {
  if (etape.type !== 'serie' && etape.type !== 'station') return null;
  // Un circuit à rythme libre ne se compte pas en répétitions : vingt secondes
  // de travail au tempo 4 s / 4 s ne feraient que deux répétitions et demie.
  if (etape.type === 'station' && etape.rythme === 'libre') return null;
  const exercice = exerciceDeSeance(etape.exerciceId);
  if (exercice.unite === 'secondes') return null;

  // Un exercice sans arrêt en bas compte une répétition plus courte, un
  // exercice qui tient en haut place l'arrêt après la montée, un cercle ou un
  // va-et-vient n'en a pas : c'est le même tempo que celui des durées
  // (`dureeSerieSec`), pour que la bille, les bips et la durée de l'étape ne
  // se contredisent jamais.
  const tempoExercice = tempoPourExercice(exercice, tempo);
  const parRep = secondesParRep(tempoExercice);
  if (parRep <= 0) return null;
  const unilateral = exercice.cotes === 'unilateral';
  const plan = { exercice, tempo: tempoExercice, parRep };

  if (etape.type === 'serie') {
    if (etape.reps <= 0) return null;
    return {
      ...plan,
      cyclesTotaux: etape.reps * (unilateral ? 2 : 1),
      cyclesDroit: unilateral ? etape.reps : null,
      changementSec: changementDeCoteSec(exercice),
    };
  }
  // Une station a un temps fixe : le changement de côté s'y prend, s'il
  // reste au moins une répétition de chaque côté.
  const changementSec = changementDeCoteSec(exercice);
  const avecChangement = unilateral ? Math.floor((etape.dureeSec - changementSec) / parRep) : 0;
  if (avecChangement >= 2) {
    return { ...plan, cyclesTotaux: avecChangement, cyclesDroit: Math.ceil(avecChangement / 2), changementSec };
  }
  const cyclesTotaux = Math.floor(etape.dureeSec / parRep);
  if (cyclesTotaux <= 0) return null;
  return { ...plan, cyclesTotaux, cyclesDroit: unilateral ? Math.ceil(cyclesTotaux / 2) : null, changementSec: 0 };
}

/** Le moment où commence le changement de côté, et sa durée — allongée de
 *  ce que « +5 s » y a ajouté (`prolongationSec`) ; null sans changement. */
function fenetreChangement(plan: PlanTravail, prolongationSec: number): { debutSec: number; dureeSec: number } | null {
  if (plan.cyclesDroit === null || plan.changementSec <= 0) return null;
  return { debutSec: plan.cyclesDroit * plan.parRep, dureeSec: plan.changementSec + Math.max(0, prolongationSec) };
}

/** Le changement de côté d'une série ou d'une station : celui de ses
 *  répétitions (`fenetreChangement`), ou, au temps, celui d'un exercice d'un
 *  seul côté (`fenetreChangementAuTemps`) ; null sans changement. */
function fenetreChangementDeCote(
  etape: Etape,
  tempo: Tempo,
  prolongationSec: number,
): { debutSec: number; dureeSec: number } | null {
  if (etape.type === 'serie' || etape.type === 'station') {
    const exercice = exerciceDeSeance(etape.exerciceId);
    if (exercice.unite === 'secondes') return fenetreChangementAuTemps(etape, exercice, prolongationSec);
  }
  const plan = planTravail(etape, tempo);
  return plan ? fenetreChangement(plan, prolongationSec) : null;
}

/** État du métronome à `ecouleSec` secondes du début d'une série ou d'une
 *  station ; null quand il n'y a rien à compter (exercice au temps, autre
 *  étape, changement de côté en cours). Pour un exercice unilatéral, toutes
 *  les répétitions du côté droit, le changement de côté
 *  (`etatChangementCote`, allongé de `prolongationSec` par « +5 s »), puis
 *  celles du côté gauche. Pour un mouvement circulaire, la première moitié
 *  des tours dans un sens, la seconde dans l'autre, sans arrêt : le premier
 *  tour du second sens porte `changeDeSens`. */
export function etatMetronome(etape: Etape, ecouleSec: number, tempo: Tempo, prolongationSec = 0): EtatMetronome | null {
  const plan = planTravail(etape, tempo);
  if (!plan) return null;
  const ecoule = Math.max(0, ecouleSec);
  // Le temps des répétitions : celui de l'étape, moins le changement de côté
  // une fois passé.
  let t = ecoule;
  const changement = fenetreChangement(plan, prolongationSec);
  if (changement && ecoule >= changement.debutSec) {
    if (ecoule < changement.debutSec + changement.dureeSec) return null;
    t = ecoule - changement.dureeSec;
  }

  const { parRep, cyclesTotaux, cyclesDroit } = plan;
  const cycle = Math.floor(t / parRep);
  const dansCycle = t - cycle * parRep;
  const lecture = lirePhase(plan.tempo, premierePhase(plan.exercice), dansCycle);
  const instant = {
    phase: lecture.phase,
    resteDansPhaseSec: lecture.dureePhaseSec - lecture.ecouleDansPhaseSec,
    dureePhaseSec: lecture.dureePhaseSec,
    cycle,
  };

  // Une station dont la durée n'est pas un multiple du tempo a une « queue » :
  // le compteur y reste sur la dernière répétition.
  const cycleBorne = Math.min(cycle, cyclesTotaux - 1);

  if (cyclesDroit !== null) {
    if (cycleBorne < cyclesDroit) return { rep: cycleBorne + 1, totalReps: cyclesDroit, ...instant, cote: 'droit' };
    return { rep: cycleBorne - cyclesDroit + 1, totalReps: cyclesTotaux - cyclesDroit, ...instant, cote: 'gauche' };
  }
  const etat: EtatMetronome = { rep: cycleBorne + 1, totalReps: cyclesTotaux, ...instant };
  if (plan.tempo.mouvement === 'circulaire') {
    const premierSens = Math.ceil(cyclesTotaux / 2);
    if (cycleBorne < premierSens) return { ...etat, sens: 'premier' };
    return { ...etat, sens: 'second', ...(cycleBorne === premierSens ? { changeDeSens: true } : {}) };
  }
  return etat;
}

/** Le changement de côté d'une série unilatérale, s'il est en cours à
 *  `ecouleSec` secondes du début de l'étape : entre la dernière répétition du
 *  côté droit et la première du côté gauche — ou, au temps, entre les deux
 *  moitiés d'un relevé turc ou d'un explosif à un bras —, un compte à rebours de 5 s pour
 *  changer l'haltère de main, se rallonger de l'autre côté ou se replacer
 *  (`changementDeCoteSec`), plus ce que « +5 s » y ajoute
 *  (`prolongationSec`). Il fait partie de la série : ses 5 s y sont
 *  comptées, sur les deux téléphones. Null le reste du temps. */
export function etatChangementCote(
  etape: Etape,
  ecouleSec: number,
  tempo: Tempo,
  prolongationSec = 0,
): EtatChangementCote | null {
  const changement = fenetreChangementDeCote(etape, tempo, prolongationSec);
  if (!changement) return null;
  const ecoule = Math.max(0, ecouleSec);
  const fin = changement.debutSec + changement.dureeSec;
  if (ecoule < changement.debutSec || ecoule >= fin) return null;
  return { cote: 'gauche', resteSec: fin - ecoule, dureeSec: changement.dureeSec };
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

/** Ce qu'une séance sur un seul téléphone ajoute au compte rendu. */
export interface OptionsRealisation {
  /** Les séries finies sur « Série terminée », par leur place dans les
   *  étapes : elles seules comptent comme faites. Absentes, une série compte
   *  quand on y a passé la moitié de son temps. */
  faites?: readonly number[];
  /** À deux : les charges notées pour l'autre, par exercice et par série. */
  poidsAutre?: Record<string, number[]>;
}

/** Agrège le temps passé sur chaque étape en un compte rendu par exercice.
 *  Une série ou une station compte comme faite si le temps passé atteint la
 *  moitié de la durée prévue — sur un seul téléphone, si on l'a finie sur
 *  « Série terminée » (`faites`) ; le temps d'un exercice additionne ses
 *  préparations, séries, stations et repos. Sur un seul téléphone, à deux, ce
 *  que l'autre a fait part avec, dans `partenaire`. */
export function agregerRealisation(
  seance: Seance,
  etapes: Etape[],
  tempsParEtapeSec: number[],
  poids: Record<string, number[]>,
  dureeReelleSec: number,
  terminee: boolean,
  options: OptionsRealisation = {},
): SeanceRealisee {
  const parExercice = new Map<string, ExerciceRealise>();
  // L'autre, quand le téléphone note aussi pour lui.
  const moi = seance.horloge?.personne;
  const lui = seance.horloge?.unTelephone && moi && seance.blocs.some((bloc) => bloc.autre) ? autreQue(moi) : null;
  const pourLui = new Map<string, ExerciceRealise>();
  const prevoir = (dans: Map<string, ExerciceRealise>, exerciceId: string, seriesPrevues: number, reps: number) => {
    const existant = dans.get(exerciceId);
    if (existant) {
      existant.seriesPrevues += seriesPrevues;
    } else {
      dans.set(exerciceId, { exerciceId, seriesPrevues, seriesFaites: 0, reps, dureeSec: 0 });
    }
  };
  seance.blocs.forEach((bloc) => {
    prevoir(parExercice, bloc.exerciceId, bloc.series, bloc.reps);
    if (lui && bloc.autre) prevoir(pourLui, bloc.exerciceId, bloc.autre.series, bloc.autre.reps);
  });
  const circuit = seance.circuit;
  if (circuit) {
    circuit.stations.forEach((exerciceId) => prevoir(parExercice, exerciceId, circuit.tours, circuit.travailSec));
  }
  const faites = options.faites ? new Set(options.faites) : null;

  etapes.forEach((etape, index) => {
    if (!etape.exerciceId) return;
    const realise = parExercice.get(etape.exerciceId);
    if (!realise) return;
    const sien = pourLui.get(etape.exerciceId);
    const temps = tempsParEtapeSec[index] ?? 0;
    switch (etape.type) {
      case 'serie':
      case 'station': {
        const faite = faites ? faites.has(index) : etape.dureeSec > 0 && temps >= etape.dureeSec / 2;
        // Qui l'a faite : soi, l'autre, ou les deux.
        const qui = etape.type === 'serie' ? (etape.qui ?? 'moi') : 'moi';
        if (qui !== 'autre') {
          realise.dureeSec += temps;
          if (faite) realise.seriesFaites += 1;
        }
        if (sien && qui !== 'moi') {
          sien.dureeSec += temps;
          if (faite) sien.seriesFaites += 1;
        }
        break;
      }
      case 'pret':
      case 'repos':
        realise.dureeSec += temps;
        if (sien) sien.dureeSec += temps;
        break;
    }
  });

  /** Les exercices faits, avec leurs charges notées. */
  const avecCharges = (dans: Map<string, ExerciceRealise>, charges: Record<string, number[]>): ExerciceRealise[] =>
    [...dans.values()].map((realise) => {
      const parSerie = poidsParSerie(charges[realise.exerciceId], realise.seriesPrevues);
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
    exercices: avecCharges(parExercice, poids),
    terminee,
    ...(lui ? { partenaire: { personne: lui, exercices: avecCharges(pourLui, options.poidsAutre ?? {}) } } : {}),
  };
}

/** L'autre des deux. (Le module du programme a la sienne ; celui-ci ne
 *  dépend pas de lui.) */
const autreQue = (personne: Personne): Personne => (personne === 'sebastien' ? 'max' : 'sebastien');
