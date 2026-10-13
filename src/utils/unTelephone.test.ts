// Un seul téléphone pour deux (décision de Sébastien, 12 octobre 2026) :
// celui qui le tient note pour les deux. Exercice par exercice (13 octobre
// 2026) : tout l'exercice — ou toute la paire — d'un coup, un seul « Exercice
// terminé », puis la pause de fin part d'elle-même ; une paire se fait A, B,
// A, B sans pause entre les tours ; un exercice seul, chacun son tour, une
// pause d'un toucher entre les tours, quand on veut.
import { describe, expect, it } from 'vitest';
import type { ParametresSeance, ProgressionSeance, Ressenti, SeanceDuMois } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { EXERCICES_PAR_ID } from '../data/exercices';
import {
  agregerRealisation,
  construireEtapes,
  construireEtapesParSerie,
  dureeTotaleSec,
  grouperParExercice,
  indexApresExercice,
  indexEtapePrecedente,
  pauseEntreLesTours,
  versLeDerouleParExercice,
} from './etapesSeance';
import type { Etape } from './etapesSeance';
import { raccourcirPourEssai } from './essai';
import { avecRessentis, exercicesAEvaluer, ressentisQuiChangent } from './ressenti';
import {
  ANCIENS_POINTS_FAIBLES_DE_BIG_MAX,
  REPOS_PAIRE_SEC,
  REPOS_SEC,
  REPOS_TRAP_BAR_SEC,
  chargesPassees,
  genererProgramme,
  historiqueDe,
  seancePourPersonne,
} from './programmeMois';
import type { ContexteSeance } from './programmeMois';

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };
const LUNDI = new Date(2026, 9, 12);

/** Un lundi à huit exercices : la trap bar seule, trois paires de deux zones,
 *  la presse seule. Nommé ici, pour que ces tests ne bougent pas avec la
 *  composition. */
const LUNDI_A: SeanceDuMois = {
  id: 'lundi-a',
  nom: 'Lundi A — tout le corps',
  jour: 1,
  semaine: 'A',
  type: 'dure',
  partie: 'complet',
  format: 'series',
  exercices: ['trap-bar-deadlift', 'superman', 'shoulder-press', 'kb-side-leg-raise', 'incline-row', 'kb-around-the-body', 'incline-bench-press'],
  finale: 'leg-press',
  liens: [
    ['superman', 'shoulder-press'],
    ['kb-side-leg-raise', 'incline-row'],
    ['kb-around-the-body', 'incline-bench-press'],
  ],
  tour: ['trap-bar-deadlift', 'leg-press'],
};

/** Un jeudi à huit exercices : le swing seul, la planche de Copenhague avec
 *  le ventre, les deux machines des cuisses chacune avec un tirage léger, les
 *  mollets assis seuls (le traîneau est passé à la finale). Une machine, un
 *  seul siège : chacun son tour. */
const JEUDI_A: SeanceDuMois = {
  id: 'jeudi-a',
  nom: 'Jeudi A — les jambes',
  jour: 4,
  semaine: 'A',
  type: 'facile',
  partie: 'bas',
  format: 'series',
  exercices: [
    'kb-double-arm-swing',
    'copenhagen-plank',
    'kb-half-turkish-get-up',
    'leg-extension-machine',
    'reverse-fly',
    'leg-curl-machine',
    'kb-single-arm-row',
  ],
  finale: 'seated-calf-raise',
  liens: [
    ['copenhagen-plank', 'kb-half-turkish-get-up'],
    ['leg-extension-machine', 'reverse-fly'],
    ['leg-curl-machine', 'kb-single-arm-row'],
  ],
  tour: ['leg-extension-machine', 'leg-curl-machine', 'seated-calf-raise'],
};

/** Big Max a coché les pecs, les épaules, les biceps et les triceps (son
 *  ancien défaut) : une série de plus à ces exercices — ces tests suivent sa
 *  quatrième série. */
const FAIBLES: ContexteSeance['pointsFaibles'] = { sebastien: [], max: [...ANCIENS_POINTS_FAIBLES_DE_BIG_MAX] };
const SEB: ContexteSeance = { personne: 'sebastien', aDeux: true, unTelephone: true, pointsFaibles: FAIBLES };
const MAX: ContexteSeance = { personne: 'max', aDeux: true, unTelephone: true, pointsFaibles: FAIBLES };
const SEUL: ContexteSeance = { personne: 'sebastien', unTelephone: true, pointsFaibles: FAIBLES };

const seanceDe = (contexte: ContexteSeance, seanceMois = LUNDI_A) => seancePourPersonne(seanceMois, PARAMETRES, contexte, LUNDI);
const etapesDe = (contexte: ContexteSeance, seanceMois = LUNDI_A) => construireEtapes(seanceDe(contexte, seanceMois));
type Serie = Extract<Etape, { type: 'serie' }>;
type EtapeExercice = Extract<Etape, { type: 'exercice' }>;
/** L'étape d'un exercice (ou d'une paire). */
const exerciceDuGroupe = (etapes: Etape[], groupe: number) =>
  etapes.find((e): e is EtapeExercice => e.type === 'exercice' && e.groupe === groupe);
/** Les séries d'un groupe, dans l'ordre où elles se font : celles de son
 *  étape d'exercice. */
const series = (etapes: Etape[], groupe: number) =>
  (exerciceDuGroupe(etapes, groupe)?.series ?? []).map((s) => [s.exerciceId, s.serie, s.qui]);
/** Les étapes d'un groupe : son exercice, puis sa pause de fin. */
const etapesDuGroupe = (etapes: Etape[], groupe: number) =>
  etapes.filter((e) => (e.type === 'exercice' || e.type === 'repos') && e.groupe === groupe);
/** Série par série (version 1.2.0) : la base du déroulé par exercice. */
const seriesParSerie = (contexte: ContexteSeance, groupe: number, seanceMois = LUNDI_A) =>
  construireEtapesParSerie(seanceDe(contexte, seanceMois)).filter((e): e is Serie => e.type === 'serie' && e.groupe === groupe);
const somme = (valeurs: number[]) => valeurs.reduce((total, v) => total + v, 0);

describe('un seul téléphone : la séance guidée', () => {
  it('un exercice à la fois : une seule étape par exercice ou par paire, finie sur « Exercice terminé » — plus de série par série, ni préparation, ni « Go »', () => {
    for (const contexte of [SEB, MAX, SEUL]) {
      const etapes = etapesDe(contexte);
      expect(seanceDe(contexte).horloge?.unTelephone).toBe(true);
      expect(etapes.some((e) => e.type === 'pret' || e.type === 'serie')).toBe(false);
      // Huit exercices : le premier et le dernier seuls, trois paires entre
      // les deux — cinq étapes d'exercice, toutes les séries des deux dans
      // chacune.
      const exercices = etapes.filter((e): e is EtapeExercice => e.type === 'exercice');
      expect(exercices.map((e) => e.groupe)).toEqual([0, 1, 2, 3, 4]);
      expect(exercices.every((e) => e.series.length >= 3)).toBe(true);
      // Ni installation, ni attente de l'autre, ni pause à lancer : la pause de
      // fin, qui part d'elle-même, et rien d'autre.
      for (const e of etapes) {
        if (e.type === 'repos') {
          expect(e.motif).toBe('pause');
          expect(e.manuel).toBeUndefined();
        }
      }
    }
  });

  it('le déroulé par exercice garde l’ordre des séries, qui commence et la durée du déroulé série par série', () => {
    for (const graine of [1, 2, 3]) {
      for (const s of genererProgramme({ graine, aujourdhui: LUNDI }).seances) {
        for (const contexte of [SEB, MAX, SEUL]) {
          const seance = seanceDe(contexte, s);
          const parSerie = construireEtapesParSerie(seance);
          const etapes = construireEtapes(seance);
          const cas = `${graine} · ${s.id} · ${contexte.personne}${contexte.aDeux ? ' à deux' : ''}`;
          // La même durée annoncée, à la seconde.
          expect(dureeTotaleSec(etapes), cas).toBe(dureeTotaleSec(parSerie));
          // Les mêmes séries, dans le même ordre, avec qui les fait.
          expect(
            etapes.flatMap((e) => (e.type === 'exercice' ? e.series.map((x) => `${x.exerciceId} ${x.serie} ${x.qui ?? ''}`) : [])),
            cas,
          ).toEqual(parSerie.flatMap((e) => (e.type === 'serie' ? [`${e.exerciceId} ${e.serie} ${e.qui ?? ''}`] : [])));
          // Chaque étape série par série a sa place, dans l'ordre.
          const { place } = grouperParExercice(parSerie);
          expect(place, cas).toHaveLength(parSerie.length);
          expect(place.every((p, i) => i === 0 || p >= place[i - 1]), cas).toBe(true);
        }
      }
    }
  });

  it('une paire : A, B, A, B, les deux ensemble, sans pause entre les tours — la série de plus de Big Max à la fin', () => {
    const etapes = etapesDe(SEB);
    // Le développé au-dessus de la tête est une poussée : Big Max en fait quatre.
    expect(series(etapes, 1)).toEqual([
      ['superman', 1, 'les-deux'],
      ['shoulder-press', 1, 'les-deux'],
      ['superman', 2, 'les-deux'],
      ['shoulder-press', 2, 'les-deux'],
      ['superman', 3, 'les-deux'],
      ['shoulder-press', 3, 'les-deux'],
      ['shoulder-press', 4, 'autre'],
    ]);
    // L'étape de la paire, puis sa pause de fin : rien entre les tours.
    expect(etapesDuGroupe(etapes, 1).map((e) => e.type)).toEqual(['exercice', 'repos']);
    // Toutes les paires de toutes les séances composées : une étape, et sa
    // durée ne compte que ses séries — aucun repos entre deux séries d'une
    // même paire.
    for (const graine of [1, 2, 3]) {
      for (const s of genererProgramme({ graine, aujourdhui: LUNDI }).seances) {
        const e = etapesDe(SEB, s);
        for (const [g] of (s.liens ?? []).entries()) {
          const cas = `${graine} · ${s.id} · paire ${g + 1}`;
          expect(etapesDuGroupe(e, g + 1).filter((x) => x.type === 'exercice'), cas).toHaveLength(1);
          expect(exerciceDuGroupe(e, g + 1)?.dureeSec, cas).toBe(somme(seriesParSerie(SEB, g + 1, s).map((x) => x.dureeSec)));
        }
      }
    }
  });

  it('un exercice seul, à deux : chacun son tour, Big Max d’abord, et une pause d’un toucher entre les tours', () => {
    // Sur le téléphone de Speedy : Big Max (l'autre) commence.
    expect(series(etapesDe(SEB), 0)).toEqual([
      ['trap-bar-deadlift', 1, 'autre'],
      ['trap-bar-deadlift', 1, 'moi'],
      ['trap-bar-deadlift', 2, 'autre'],
      ['trap-bar-deadlift', 2, 'moi'],
      ['trap-bar-deadlift', 3, 'autre'],
      ['trap-bar-deadlift', 3, 'moi'],
    ]);
    // Sur celui de Big Max : c'est lui, « moi », qui commence.
    expect(series(etapesDe(MAX), 0).map(([, , qui]) => qui)).toEqual(['moi', 'autre', 'moi', 'autre', 'moi', 'autre']);
    // Speedy 8 à la trap bar, Big Max 10.
    const trapBar = exerciceDuGroupe(etapesDe(SEB), 0);
    expect(trapBar?.series.map((s) => s.reps)).toEqual([10, 8, 10, 8, 10, 8]);
    // Entre les tours, une pause d'un toucher, quand on veut (« Pause · 1 min
    // 30 », sans changer d'exercice) : la durée annoncée la compte toujours —
    // deux pauses d'une minute trente entre les trois tours (décision du 13
    // octobre 2026 : la série de l'autre ne suffit pas à un gros exercice).
    expect(trapBar?.dureeSec).toBe(somme(seriesParSerie(SEB, 0).map((s) => s.dureeSec)) + 2 * REPOS_TRAP_BAR_SEC);
    // Puis la pause de fin, qui part d'elle-même — une minute trente aussi.
    expect(etapesDuGroupe(etapesDe(SEB), 0).map((e) => (e.type === 'repos' ? `${e.motif} ${e.dureeSec}` : e.type))).toEqual([
      'exercice',
      `pause ${REPOS_TRAP_BAR_SEC}`,
    ]);
    // Elle annonce l'exercice d'après.
    const pause = etapesDuGroupe(etapesDe(SEB), 0)[1];
    expect(pause.type === 'repos' && pause.suivant).toMatchObject({ type: 'serie', exerciceId: 'superman', serie: 1 });
  });

  it('la marche du fermier, seule, enchaîne ses tours : pas de pause entre deux — tous les autres exercices seuls en ont une', () => {
    const lundiFermier: SeanceDuMois = { ...LUNDI_A, finale: 'farmers-walk', tour: ['trap-bar-deadlift'] };
    const etapes = etapesDe(SEB, lundiFermier);
    const fermier = exerciceDuGroupe(etapes, 4);
    expect(fermier?.series.map((s) => `${s.serie} ${s.qui}`)).toEqual(['1 autre', '1 moi', '2 autre', '2 moi', '3 autre', '3 moi']);
    // Sa durée ne compte que ses séries ; la dernière : pas de pause de fin.
    expect(fermier?.dureeSec).toBe(somme(seriesParSerie(SEB, 4, lundiFermier).map((s) => s.dureeSec)));
    expect(etapesDuGroupe(etapes, 4).map((e) => e.type)).toEqual(['exercice']);
    expect(pauseEntreLesTours(EXERCICES_PAR_ID['farmers-walk'])).toBe(false);
    expect(pauseEntreLesTours(EXERCICES_PAR_ID['kb-farmers-walk'])).toBe(false);
    // Les autres exercices seuls du programme ont la leur : le développé
    // couché, les pompes, le swing, le traîneau, la presse…
    for (const id of ['trap-bar-deadlift', 'bench-press', 'dumbbell-push-up', 'kb-double-arm-swing', 'traineau', 'leg-press']) {
      expect(pauseEntreLesTours(EXERCICES_PAR_ID[id]), id).toBe(true);
    }
    // Seul, sans l'autre : un exercice à la fois aussi, la pause entre deux
    // séries d'un toucher — comptée dans la durée —, puis la pause de fin.
    const seul = etapesDuGroupe(etapesDe(SEUL, lundiFermier), 0);
    expect(seul.map((e) => e.type)).toEqual(['exercice', 'repos']);
    expect(seul[0].dureeSec).toBe(somme(seriesParSerie(SEUL, 0, lundiFermier).map((s) => s.dureeSec)) + 2 * REPOS_TRAP_BAR_SEC);
  });

  it('une machine dans une paire (un seul siège) : jamais les deux en même temps — chacun son tour, puis l’autre exercice ensemble', () => {
    // Le jeudi, sur le téléphone de Speedy : Big Max commence la machine,
    // Speedy la fait ensuite, puis l'oiseau, ensemble. Big Max fait une
    // série de plus à l'oiseau.
    const etapes = etapesDe(SEB, JEUDI_A);
    expect(series(etapes, 2)).toEqual([
      ['leg-extension-machine', 1, 'autre'],
      ['leg-extension-machine', 1, 'moi'],
      ['reverse-fly', 1, 'les-deux'],
      ['leg-extension-machine', 2, 'autre'],
      ['leg-extension-machine', 2, 'moi'],
      ['reverse-fly', 2, 'les-deux'],
      ['leg-extension-machine', 3, 'autre'],
      ['leg-extension-machine', 3, 'moi'],
      ['reverse-fly', 3, 'les-deux'],
      ['reverse-fly', 4, 'autre'],
    ]);
    // Sur celui de Big Max : c'est lui, « moi », qui commence la machine.
    expect(
      series(etapesDe(MAX, JEUDI_A), 3)
        .filter(([id]) => id === 'leg-curl-machine')
        .map(([, , qui]) => qui),
    ).toEqual(['moi', 'autre', 'moi', 'autre', 'moi', 'autre']);
    // Chaque série de la machine compte le temps d'une personne — Speedy 8
    // répétitions, Big Max 10 —, plus le temps de céder la place : plus la
    // plus longue des deux comme si on la faisait ensemble.
    expect(exerciceDuGroupe(etapes, 2)?.series.filter((s) => s.exerciceId === 'leg-extension-machine').map((s) => s.reps)).toEqual([
      10, 8, 10, 8, 10, 8,
    ]);
    const machine = seriesParSerie(SEB, 2, JEUDI_A).filter((e) => e.exerciceId === 'leg-extension-machine');
    expect(machine[0].dureeSec).toBeGreaterThan(machine[1].dureeSec);
    // Toutes les séances composées, sur les deux téléphones : jamais une
    // machine (un seul siège) faite par les deux à la fois.
    for (const graine of [1, 2, 3, 4, 5, 6]) {
      for (const s of genererProgramme({ graine, aujourdhui: LUNDI }).seances) {
        for (const contexte of [SEB, MAX]) {
          const ensemble = etapesDe(contexte, s)
            .flatMap((e) => (e.type === 'exercice' ? e.series : []))
            .filter((x) => x.qui === 'les-deux' && (s.tour ?? []).includes(x.exerciceId));
          expect(ensemble.map((x) => x.exerciceId), `${graine} · ${s.id}`).toEqual([]);
        }
      }
    }
    // Seul, sans l'autre : la paire reste A, B, A, B.
    expect(series(etapesDe(SEUL, JEUDI_A), 2).map(([id, serie, qui]) => `${id} ${serie} ${qui ?? ''}`)).toEqual([
      'leg-extension-machine 1 ',
      'reverse-fly 1 ',
      'leg-extension-machine 2 ',
      'reverse-fly 2 ',
      'leg-extension-machine 3 ',
      'reverse-fly 3 ',
    ]);
  });

  it('la pause de fin part d’elle-même après « Exercice terminé » : 1 min, 1 min 30 à la trap bar ; rien après le dernier', () => {
    const etapes = etapesDe(SEB);
    const repos = etapes.filter((e): e is Extract<Etape, { type: 'repos' }> => e.type === 'repos');
    // Une à la fin de chaque exercice ou de chaque paire, qui compte sa minute
    // sans qu'on la lance ; pas après la presse, la dernière.
    expect(repos.map((e) => [e.groupe, e.motif, e.dureeSec, e.manuel === true])).toEqual([
      [0, 'pause', REPOS_TRAP_BAR_SEC, false],
      [1, 'pause', REPOS_PAIRE_SEC, false],
      [2, 'pause', REPOS_PAIRE_SEC, false],
      [3, 'pause', REPOS_PAIRE_SEC, false],
    ]);
    expect([REPOS_TRAP_BAR_SEC, REPOS_PAIRE_SEC, REPOS_SEC]).toEqual([90, 60, 60]);
    // Chacune suit tout de suite son exercice : « Exercice terminé » y mène
    // (l'étape d'après).
    for (const pause of repos) expect(etapes[etapes.indexOf(pause) - 1]).toMatchObject({ type: 'exercice', groupe: pause.groupe });
    // Elle annonce l'exercice d'après : après la trap bar, le Superman.
    expect(repos[0].suivant).toMatchObject({ type: 'serie', exerciceId: 'superman', serie: 1 });
    // Après la presse, la dernière : la finale, sans pause — on s'installe,
    // puis dix minutes au chrono —, puis les étirements.
    const derniere = etapes.map((e) => e.type).lastIndexOf('exercice');
    expect(etapes.slice(derniere + 1, derniere + 4).map((e) => [e.type, e.dureeSec])).toEqual([
      ['finale', 60],
      ['finale', 600],
      ['retourCalme', 325],
    ]);
  });

  it('seul, sans l’autre : un exercice à la fois aussi — la pause entre deux séries d’un toucher, comptée dans la durée', () => {
    const etapes = etapesDe(SEUL);
    expect(etapesDuGroupe(etapes, 0).map((e) => (e.type === 'repos' ? `${e.motif} ${e.dureeSec}` : e.type))).toEqual([
      'exercice',
      'pause 90',
    ]);
    expect(series(etapes, 0).map(([id, serie, qui]) => `${id} ${serie} ${qui ?? ''}`)).toEqual([
      'trap-bar-deadlift 1 ',
      'trap-bar-deadlift 2 ',
      'trap-bar-deadlift 3 ',
    ]);
    expect(exerciceDuGroupe(etapes, 0)?.dureeSec).toBe(somme(seriesParSerie(SEUL, 0).map((s) => s.dureeSec)) + 2 * REPOS_TRAP_BAR_SEC);
    // Une paire, seul : A, B, A, B sans pause, puis la pause.
    expect(series(etapes, 1).map(([id, serie]) => `${id} ${serie}`)).toEqual([
      'superman 1',
      'shoulder-press 1',
      'superman 2',
      'shoulder-press 2',
      'superman 3',
      'shoulder-press 3',
    ]);
  });

  it('annonce la somme de ses étapes, la même sur le téléphone de Speedy et sur celui de Big Max', () => {
    for (const graine of [1, 2, 3, 4]) {
      for (const s of genererProgramme({ graine, aujourdhui: LUNDI }).seances) {
        const [seb, max] = [seanceDe(SEB, s), seanceDe(MAX, s)];
        expect(seb.dureeEstimeeSec).toBe(dureeTotaleSec(construireEtapes(seb)));
        expect(max.dureeEstimeeSec).toBe(seb.dureeEstimeeSec);
        // Une heure dix environ, à deux, avec la finale — un peu plus ici,
        // avec les séries de plus de Big Max.
        expect(seb.dureeEstimeeSec / 60, `${graine} · ${s.id}`).toBeGreaterThan(55);
        expect(seb.dureeEstimeeSec / 60, `${graine} · ${s.id}`).toBeLessThan(90);
      }
    }
  });

  it('« Précédent » revient à l’exercice d’avant ; « Passer l’exercice » mène au suivant, sans sa pause', () => {
    const etapes = etapesDe(SEB);
    const trapBar = etapes.findIndex((e) => e.type === 'exercice' && e.groupe === 0);
    const paire = etapes.findIndex((e) => e.type === 'exercice' && e.groupe === 1);
    expect(indexEtapePrecedente(etapes, paire)).toBe(trapBar);
    // De la pause de fin, on revient à son exercice : il n'était pas fini.
    expect(etapes[paire + 1]).toMatchObject({ type: 'repos', groupe: 1 });
    expect(indexEtapePrecedente(etapes, paire + 1)).toBe(paire);
    // Passer la paire : on arrive à la paire suivante, sans la pause.
    expect(etapes[indexApresExercice(etapes, paire)]).toMatchObject({ type: 'exercice', groupe: 2 });
  });

  it('les visages se donnent sur l’exercice même, avant « Exercice terminé » : rien à redemander pendant la pause ni aux étirements', () => {
    const etapes = etapesDe(SEB);
    etapes.forEach((_, i) => expect(exercicesAEvaluer(etapes, i)).toEqual([]));
  });

  it('l’essai, sur un seul téléphone : une série chacun, des pauses de 15 s, une dizaine de minutes', () => {
    for (const contexte of [SEB, MAX, SEUL]) {
      const courte = raccourcirPourEssai(seanceDe(contexte));
      const etapes = construireEtapes(courte);
      expect(courte.dureeEstimeeSec).toBe(dureeTotaleSec(etapes));
      expect(courte.dureeEstimeeSec / 60).toBeGreaterThan(5);
      expect(courte.dureeEstimeeSec / 60).toBeLessThan(16);
      for (const e of etapes) if (e.type === 'repos' && e.motif === 'pause') expect(e.dureeSec).toBe(15);
      const toutes = etapes.flatMap((e) => (e.type === 'exercice' ? e.series : []));
      expect(toutes.length).toBeGreaterThan(0);
      expect(toutes.filter((s) => s.serie > 1)).toEqual([]);
    }
  });
});

describe('un seul téléphone : ce qu’on note pour les deux', () => {
  const seance = seanceDe(SEB);
  const etapes = construireEtapes(seance);
  const temps = etapes.map(() => 0);
  /** La première paire, finie sur « Exercice terminé ». */
  const faitesPaire = etapes.flatMap((e, i) => (e.type === 'exercice' && e.groupe === 1 ? [i] : []));

  it('« Exercice terminé » compte toutes les séries de l’exercice ou de la paire — elles seules —, pour celui qui les a faites, ou pour les deux', () => {
    expect(faitesPaire).toHaveLength(1);
    const realisee = agregerRealisation(
      seance,
      etapes,
      temps,
      { 'shoulder-press': [40, 45, 45] },
      1800,
      false,
      { faites: faitesPaire, poidsAutre: { 'shoulder-press': [50, 55, 55, 55] } },
    );
    const mien = (id: string) => realisee.exercices.find((e) => e.exerciceId === id)!;
    const sien = (id: string) => realisee.partenaire!.exercices.find((e) => e.exerciceId === id)!;
    expect(realisee.partenaire?.personne).toBe('max');
    // La paire : trois séries chacun au Superman ; au développé, trois pour
    // Speedy, quatre pour Big Max.
    expect([mien('superman').seriesFaites, mien('shoulder-press').seriesFaites]).toEqual([3, 3]);
    expect([sien('superman').seriesFaites, sien('shoulder-press').seriesFaites]).toEqual([3, 4]);
    expect(sien('shoulder-press').seriesPrevues).toBe(4);
    // La trap bar, pas commencée : rien, pour personne — même si du temps y
    // a été passé.
    expect(mien('trap-bar-deadlift').seriesFaites).toBe(0);
    expect(sien('trap-bar-deadlift').seriesFaites).toBe(0);
    // Les charges de chacun.
    expect(mien('shoulder-press').poidsParSerie).toEqual([40, 45, 45]);
    expect(sien('shoulder-press').poidsParSerie).toEqual([50, 55, 55, 55]);
    expect(sien('shoulder-press').poids).toBe(55);
  });

  it('le ressenti de chacun est gardé avec ce qu’il a fait', () => {
    const realisee = agregerRealisation(seance, etapes, temps, {}, 0, false, { faites: faitesPaire, poidsAutre: {} });
    const avec = avecRessentis(realisee, { 'shoulder-press': 'leger' }, { 'shoulder-press': 'lourd', 'trap-bar-deadlift': 'leger' });
    expect(avec.exercices.find((e) => e.exerciceId === 'shoulder-press')?.ressenti).toBe('leger');
    expect(avec.partenaire!.exercices.find((e) => e.exerciceId === 'shoulder-press')?.ressenti).toBe('lourd');
    // Un exercice pas fait ne garde pas de ressenti.
    expect(avec.partenaire!.exercices.find((e) => e.exerciceId === 'trap-bar-deadlift')?.ressenti).toBeUndefined();
  });

  it('ce que le téléphone a noté pour l’autre sert la fois d’après : ses charges, et son ressenti', () => {
    const fois = [1, 2].map((n) => {
      const realisee = agregerRealisation(
        seance,
        etapes,
        temps,
        { 'shoulder-press': [40, 45, 45] },
        0,
        true,
        { faites: faitesPaire, poidsAutre: { 'shoulder-press': [50, 55, 55, 55] } },
      );
      return { ...avecRessentis(realisee, {}, { 'shoulder-press': 'leger' }), id: `s${n}`, date: new Date(2026, 9, n).toISOString() };
    });
    const historique = [fois[1], fois[0]];
    // Pour Speedy, son historique ; pour Big Max, ce qu'on a noté pour lui.
    expect(historiqueDe(historique, 'sebastien', 'sebastien')).toBe(historique);
    const sien = historiqueDe(historique, 'max', 'sebastien');
    expect(sien).toHaveLength(2);
    expect(sien[0].partenaire).toBeUndefined();
    expect(chargesPassees(sien, ['shoulder-press'], 'lb')).toEqual({ 'shoulder-press': [50, 55, 55, 55] });
    expect(chargesPassees(historique, ['shoulder-press'], 'lb')).toEqual({ 'shoulder-press': [40, 45, 45] });
    // Léger pour Big Max (une fois suffit depuis le 13 octobre 2026) : un cran
    // de plus, proposé dans sa colonne.
    const ressentisAutre = ressentisQuiChangent(sien, ['shoulder-press'], 'lb', 'max');
    expect(ressentisAutre).toEqual({ 'shoulder-press': 'leger' });
    const suivante = seancePourPersonne(LUNDI_A, PARAMETRES, { ...SEB, ressentisAutre }, LUNDI);
    const bloc = suivante.blocs.find((b) => b.exerciceId === 'shoulder-press')!;
    expect(bloc.autre?.ajustementRessenti).toBe(5);
    expect(bloc.ajustementRessenti).toBeUndefined();
    // Sur deux téléphones, chacun le sien : rien pour l'autre.
    const deuxTelephones = seancePourPersonne(LUNDI_A, PARAMETRES, { ...SEB, unTelephone: false, ressentisAutre }, LUNDI);
    expect(deuxTelephones.blocs.find((b) => b.exerciceId === 'shoulder-press')?.autre?.ajustementRessenti).toBeUndefined();
  });

  it('les visages de la dernière série font la progression : un 😊 suffit à Big Max, il en faut deux à Speedy — par exercice, quel que soit le jour', () => {
    const fois = (n: number, ressentis: Record<string, Ressenti>, ressentisAutre: Record<string, Ressenti>) => {
      const realisee = agregerRealisation(
        seance,
        etapes,
        temps,
        { 'shoulder-press': [40, 45, 45] },
        0,
        true,
        { faites: faitesPaire, poidsAutre: { 'shoulder-press': [50, 55, 55, 55] } },
      );
      return { ...avecRessentis(realisee, ressentis, ressentisAutre), id: `v${n}`, date: new Date(2026, 9, n).toISOString() };
    };
    // Le lundi, un 😊 chacun sur sa dernière série : « léger ».
    const lundi = [fois(12, { 'shoulder-press': 'leger' }, { 'shoulder-press': 'leger' })];
    const pourMoi = ressentisQuiChangent(lundi, ['shoulder-press'], 'lb', 'sebastien');
    const pourLui = ressentisQuiChangent(historiqueDe(lundi, 'max', 'sebastien'), ['shoulder-press'], 'lb', 'max');
    expect(pourMoi).toEqual({});
    expect(pourLui).toEqual({ 'shoulder-press': 'leger' });
    const suivante = seancePourPersonne(LUNDI_A, PARAMETRES, { ...SEB, ressentis: pourMoi, ressentisAutre: pourLui }, LUNDI);
    const bloc = suivante.blocs.find((b) => b.exerciceId === 'shoulder-press')!;
    expect(bloc.autre?.ajustementRessenti).toBe(5);
    expect(bloc.ajustementRessenti).toBeUndefined();
    // Le mardi, un autre 😊 pour Speedy au même exercice, à la même charge :
    // deux de suite, il monte aussi.
    const mardi = [{ ...fois(13, { 'shoulder-press': 'leger' }, {}), titre: 'Mardi A — le haut' }, ...lundi];
    expect(ressentisQuiChangent(mardi, ['shoulder-press'], 'lb', 'sebastien')).toEqual({ 'shoulder-press': 'leger' });
    // ☹️ deux fois de suite : un cran de moins, pour les deux.
    const lourds = [fois(14, { 'shoulder-press': 'lourd' }, { 'shoulder-press': 'lourd' }), fois(13, { 'shoulder-press': 'lourd' }, { 'shoulder-press': 'lourd' })];
    expect(ressentisQuiChangent(lourds, ['shoulder-press'], 'lb', 'sebastien')).toEqual({ 'shoulder-press': 'lourd' });
    expect(ressentisQuiChangent(historiqueDe(lourds, 'max', 'sebastien'), ['shoulder-press'], 'lb', 'max')).toEqual({ 'shoulder-press': 'lourd' });
  });

  it('seul, ou sur deux téléphones, rien n’est noté pour l’autre', () => {
    const seul = seanceDe(SEUL);
    expect(agregerRealisation(seul, construireEtapes(seul), [], {}, 0, true).partenaire).toBeUndefined();
    const deux = seancePourPersonne(LUNDI_A, PARAMETRES, { personne: 'sebastien', aDeux: true }, LUNDI);
    expect(agregerRealisation(deux, construireEtapes(deux), [], {}, 0, true).partenaire).toBeUndefined();
  });
});

describe('un seul téléphone : un seul appui par exercice', () => {
  it('une séance entière, un « Exercice terminé » par exercice ou par paire : toutes les séries des deux comptent', () => {
    for (const s of [LUNDI_A, JEUDI_A]) {
      const seance = seanceDe(SEB, s);
      const etapes = construireEtapes(seance);
      // Les seuls appuis qui comptent : un par exercice ou par paire.
      const appuis = etapes.flatMap((e, i) => (e.type === 'exercice' ? [i] : []));
      expect(appuis).toHaveLength(5);
      // Les dix minutes de la finale, faites jusqu'au bout.
      const temps = etapes.map((e) => (e.type === 'finale' && e.chrono ? e.dureeSec : 60));
      const realisee = agregerRealisation(seance, etapes, temps, {}, 3600, true, { faites: appuis, poidsAutre: {} });
      for (const exo of realisee.exercices) expect(exo.seriesFaites, `${s.id} · ${exo.exerciceId}`).toBe(exo.seriesPrevues);
      for (const exo of realisee.partenaire?.exercices ?? []) expect(exo.seriesFaites, `${s.id} · Big Max · ${exo.exerciceId}`).toBe(exo.seriesPrevues);
      // Les huit exercices, et la finale du jour.
      expect(realisee.partenaire?.exercices).toHaveLength(9);
      expect(realisee.exercices.at(-1)).toMatchObject({ exerciceId: seance.finaleChrono?.exerciceId, seriesPrevues: 1, seriesFaites: 1, dureeSec: 600 });
      // Le temps de chaque étape d'exercice va à ses exercices, pour les deux.
      expect(realisee.exercices.every((exo) => exo.dureeSec > 0)).toBe(true);
      // Un exercice passé (sans « Exercice terminé ») ne compte pas.
      const sansLePremier = agregerRealisation(seance, etapes, [], {}, 0, false, { faites: appuis.slice(1), poidsAutre: {} });
      const premier = (exerciceDuGroupe(etapes, 0)?.series ?? [])[0].exerciceId;
      expect(sansLePremier.exercices.find((exo) => exo.exerciceId === premier)?.seriesFaites).toBe(0);
      expect(sansLePremier.partenaire?.exercices.find((exo) => exo.exerciceId === premier)?.seriesFaites).toBe(0);
    }
  });
});

describe('une séance commencée avec la version 1.2.0, série par série, reprise exercice par exercice', () => {
  const seance = seanceDe(SEB);
  const parSerie = construireEtapesParSerie(seance);
  const etapes = construireEtapes(seance);
  /** La place d'une étape série par série. */
  const ancienne = (test: (e: Etape) => boolean, apres = 0) => parSerie.findIndex((e, i) => i >= apres && test(e));
  const serieDe = (exerciceId: string, serie: number, qui: string) =>
    ancienne((e) => e.type === 'serie' && e.exerciceId === exerciceId && e.serie === serie && e.qui === qui);
  const progression = (indexEtape: number, faites: number[]): ProgressionSeance => ({
    seance,
    indexEtape,
    tempsCumuleSec: 900,
    tempsParEtapeSec: parSerie.map((_, i) => (i <= indexEtape ? 30 : 0)),
    poids: { 'trap-bar-deadlift': [185, 185] },
    ressentis: {},
    poidsAutre: { 'trap-bar-deadlift': [225, 225] },
    ressentisAutre: {},
    faites,
    demarreeLe: '2026-10-13T11:00:00.000Z',
  });
  const trapBar = etapes.findIndex((e) => e.type === 'exercice' && e.groupe === 0);
  const paire1 = etapes.findIndex((e) => e.type === 'exercice' && e.groupe === 1);

  it('au milieu de la trap bar : elle repart sur la trap bar, avec ses charges, pas encore finie', () => {
    const indexEtape = serieDe('trap-bar-deadlift', 2, 'moi');
    const faites = [serieDe('trap-bar-deadlift', 1, 'autre'), serieDe('trap-bar-deadlift', 1, 'moi'), serieDe('trap-bar-deadlift', 2, 'autre')];
    const reprise = versLeDerouleParExercice(progression(indexEtape, faites));
    expect(reprise.deroule).toBe('par-exercice');
    expect(reprise.indexEtape).toBe(trapBar);
    expect(etapes[reprise.indexEtape]).toMatchObject({ type: 'exercice', groupe: 0 });
    // Pas encore finie : « Exercice terminé » la comptera.
    expect(reprise.faites).toEqual([]);
    // Les charges des deux, telles quelles.
    expect(reprise.poids).toEqual({ 'trap-bar-deadlift': [185, 185] });
    expect(reprise.poidsAutre).toEqual({ 'trap-bar-deadlift': [225, 225] });
    // Le temps passé, rangé par exercice, sans une seconde de perdue.
    expect(reprise.tempsParEtapeSec).toHaveLength(etapes.length);
    expect(somme(reprise.tempsParEtapeSec)).toBe(somme(progression(indexEtape, faites).tempsParEtapeSec));
  });

  it('à la pause de fin de la trap bar : elle repart sur la paire suivante, la trap bar comptée', () => {
    const faites = parSerie.flatMap((e, i) => (e.type === 'serie' && e.groupe === 0 ? [i] : []));
    const aLancer = ancienne((e) => e.type === 'repos' && e.motif === 'a-lancer', serieDe('trap-bar-deadlift', 3, 'moi'));
    for (const indexEtape of [aLancer, aLancer + 1]) {
      const reprise = versLeDerouleParExercice(progression(indexEtape, faites));
      expect(reprise.indexEtape).toBe(paire1);
      expect(reprise.faites).toEqual([trapBar]);
    }
  });

  it('un exercice d’avant passé sans une série reste à zéro ; l’échauffement et les étirements reprennent tels quels', () => {
    const debutPaire2 = ancienne((e) => e.type === 'serie' && e.groupe === 2);
    // La trap bar finie, la paire 1 passée : seule la trap bar compte.
    const faites = parSerie.flatMap((e, i) => (e.type === 'serie' && e.groupe === 0 ? [i] : []));
    const reprise = versLeDerouleParExercice(progression(debutPaire2, faites));
    expect(etapes[reprise.indexEtape]).toMatchObject({ type: 'exercice', groupe: 2 });
    expect(reprise.faites).toEqual([trapBar]);
    expect(versLeDerouleParExercice(progression(0, [])).indexEtape).toBe(0);
    const etirements = ancienne((e) => e.type === 'retourCalme');
    expect(etapes[versLeDerouleParExercice(progression(etirements, [])).indexEtape].type).toBe('retourCalme');
    // Un index abîmé : la séance repart quand même.
    expect(etapes[versLeDerouleParExercice(progression(9999, [])).indexEtape].type).toBe('fin');
    expect(versLeDerouleParExercice(progression(Number.NaN, [])).indexEtape).toBe(0);
  });

  it('une seule fois : déjà par exercice, ou d’ailleurs que d’un seul téléphone, rien ne bouge', () => {
    const une = versLeDerouleParExercice(progression(serieDe('trap-bar-deadlift', 2, 'moi'), []));
    expect(versLeDerouleParExercice(une)).toBe(une);
    const deuxTelephones = seancePourPersonne(LUNDI_A, PARAMETRES, { personne: 'sebastien', aDeux: true }, LUNDI);
    const commune = { ...progression(5, [1, 2]), seance: deuxTelephones };
    expect(versLeDerouleParExercice(commune)).toBe(commune);
  });
});
