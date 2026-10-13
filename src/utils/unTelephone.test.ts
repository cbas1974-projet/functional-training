// Un seul téléphone pour deux (décision de Sébastien, 12 octobre 2026) :
// celui qui le tient note pour les deux. Pas de minuteur pendant une série ;
// une paire se fait A, B, A, B sans pause entre les tours ; un exercice seul,
// chacun son tour ; la pause se lance d'un clic à la fin — une minute, une
// minute trente après la trap bar.
import { describe, expect, it } from 'vitest';
import type { ParametresSeance, SeanceDuMois } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import {
  agregerRealisation,
  construireEtapes,
  dureeTotaleSec,
  indexApresExercice,
  indexEtapePrecedente,
} from './etapesSeance';
import type { Etape } from './etapesSeance';
import { raccourcirPourEssai } from './essai';
import { avecRessentis, exercicesAEvaluer, ressentisQuiChangent } from './ressenti';
import {
  REPOS_PAIRE_SEC,
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

/** Un jeudi à huit exercices (la graine 1) : le swing seul, la planche de
 *  Copenhague avec le ventre, les deux machines des cuisses chacune avec un
 *  tirage léger, le traîneau seul. Une machine, un seul siège : chacun son
 *  tour. */
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
  finale: 'traineau',
  liens: [
    ['copenhagen-plank', 'kb-half-turkish-get-up'],
    ['leg-extension-machine', 'reverse-fly'],
    ['leg-curl-machine', 'kb-single-arm-row'],
  ],
  tour: ['leg-extension-machine', 'leg-curl-machine', 'traineau'],
};

const SEB: ContexteSeance = { personne: 'sebastien', aDeux: true, unTelephone: true };
const MAX: ContexteSeance = { personne: 'max', aDeux: true, unTelephone: true };
const SEUL: ContexteSeance = { personne: 'sebastien', unTelephone: true };

const seanceDe = (contexte: ContexteSeance, seanceMois = LUNDI_A) => seancePourPersonne(seanceMois, PARAMETRES, contexte, LUNDI);
const etapesDe = (contexte: ContexteSeance, seanceMois = LUNDI_A) => construireEtapes(seanceDe(contexte, seanceMois));
type Serie = Extract<Etape, { type: 'serie' }>;
const series = (etapes: Etape[], groupe: number) =>
  etapes.filter((e): e is Serie => e.type === 'serie' && e.groupe === groupe).map((e) => [e.exerciceId, e.serie, e.qui]);
/** Les étapes d'un groupe, de sa première à sa dernière. */
const etapesDuGroupe = (etapes: Etape[], groupe: number) =>
  etapes.filter((e) => (e.type === 'serie' || e.type === 'repos') && e.groupe === groupe);

describe('un seul téléphone : la séance guidée', () => {
  it('pas de minuteur pendant une série : elle se finit sur « Série terminée », sans préparation ni « Go »', () => {
    for (const contexte of [SEB, MAX, SEUL]) {
      const etapes = etapesDe(contexte);
      expect(seanceDe(contexte).horloge?.unTelephone).toBe(true);
      expect(etapes.some((e) => e.type === 'pret')).toBe(false);
      const toutes = etapes.filter((e): e is Serie => e.type === 'serie');
      expect(toutes.length).toBeGreaterThan(0);
      expect(toutes.every((e) => e.manuelle === true)).toBe(true);
      // Ni installation, ni attente de l'autre : la pause, à lancer, et rien d'autre.
      for (const e of etapes) {
        if (e.type === 'repos') expect(['a-lancer', 'pause']).toContain(e.motif);
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
    // Aucune pause entre les tours : les séries se suivent, la pause vient
    // après la dernière.
    const groupe = etapesDuGroupe(etapes, 1);
    const premierRepos = groupe.findIndex((e) => e.type === 'repos');
    expect(groupe.slice(0, premierRepos).every((e) => e.type === 'serie')).toBe(true);
    expect(groupe.slice(premierRepos).map((e) => e.type)).toEqual(['repos', 'repos']);
    // Toutes les paires de toutes les séances composées : aucun repos entre
    // deux séries d'une même paire.
    for (const graine of [1, 2, 3]) {
      for (const s of genererProgramme({ graine, aujourdhui: LUNDI }).seances) {
        const e = etapesDe(SEB, s);
        for (const [g] of (s.liens ?? []).entries()) {
          const duGroupe = etapesDuGroupe(e, g + 1);
          const derniereSerie = duGroupe.map((x) => x.type).lastIndexOf('serie');
          expect(duGroupe.slice(0, derniereSerie).some((x) => x.type === 'repos'), `${graine} · ${s.id} · paire ${g + 1}`).toBe(false);
        }
      }
    }
  });

  it('un exercice seul, à deux : chacun son tour, Big Max d’abord — la série de l’un est le repos de l’autre', () => {
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
    const trapBar = etapesDe(SEB).filter((e): e is Serie => e.type === 'serie' && e.groupe === 0);
    expect(trapBar.map((e) => e.reps)).toEqual([10, 8, 10, 8, 10, 8]);
    // Pas de pause entre deux séries : seulement après la dernière.
    expect(etapesDuGroupe(etapesDe(SEB), 0).map((e) => e.type)).toEqual([...Array(6).fill('serie'), 'repos', 'repos']);
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
    const machine = etapes.filter((e): e is Serie => e.type === 'serie' && e.exerciceId === 'leg-extension-machine');
    expect(machine.map((e) => e.reps)).toEqual([10, 8, 10, 8, 10, 8]);
    expect(machine[0].dureeSec).toBeGreaterThan(machine[1].dureeSec);
    // Toutes les séances composées, sur les deux téléphones : jamais une
    // machine (un seul siège) faite par les deux à la fois.
    for (const graine of [1, 2, 3, 4, 5, 6]) {
      for (const s of genererProgramme({ graine, aujourdhui: LUNDI }).seances) {
        for (const contexte of [SEB, MAX]) {
          const ensemble = etapesDe(contexte, s).filter(
            (e): e is Serie => e.type === 'serie' && e.qui === 'les-deux' && (s.tour ?? []).includes(e.exerciceId),
          );
          expect(ensemble.map((e) => e.exerciceId), `${graine} · ${s.id}`).toEqual([]);
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

  it('la pause se lance d’un clic, à la fin d’une paire ou d’un exercice : 1 min, 1 min 30 après la trap bar ; pas après le dernier', () => {
    const etapes = etapesDe(SEB);
    const repos = etapes.filter((e): e is Extract<Etape, { type: 'repos' }> => e.type === 'repos');
    // Quatre pauses : après la trap bar et après chaque paire ; la presse, la
    // dernière, mène aux étirements.
    expect(repos.map((e) => [e.groupe, e.motif, e.dureeSec, e.manuel === true])).toEqual([
      [0, 'a-lancer', 0, true],
      [0, 'pause', REPOS_TRAP_BAR_SEC, false],
      [1, 'a-lancer', 0, true],
      [1, 'pause', REPOS_PAIRE_SEC, false],
      [2, 'a-lancer', 0, true],
      [2, 'pause', REPOS_PAIRE_SEC, false],
      [3, 'a-lancer', 0, true],
      [3, 'pause', REPOS_PAIRE_SEC, false],
    ]);
    expect([REPOS_TRAP_BAR_SEC, REPOS_PAIRE_SEC]).toEqual([90, 60]);
    // Chaque pause annonce la série qui la suit.
    const apresTrapBar = repos[1];
    expect(apresTrapBar.suivant).toMatchObject({ type: 'serie', exerciceId: 'superman', serie: 1 });
    // Après la dernière série de la presse : les étirements.
    const derniere = etapes.map((e) => e.type).lastIndexOf('serie');
    expect(etapes[derniere + 1].type).toBe('retourCalme');
  });

  it('seul, sans l’autre : une pause entre deux séries d’un exercice seul, à lancer d’un clic elle aussi', () => {
    const etapes = etapesDe(SEUL);
    expect(etapesDuGroupe(etapes, 0).map((e) => (e.type === 'repos' ? `${e.motif} ${e.dureeSec}` : 'serie'))).toEqual([
      'serie',
      'a-lancer 0',
      'pause 90',
      'serie',
      'a-lancer 0',
      'pause 90',
      'serie',
      'a-lancer 0',
      'pause 90',
    ]);
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
        // Une heure environ, à deux.
        expect(seb.dureeEstimeeSec / 60, `${graine} · ${s.id}`).toBeGreaterThan(45);
        expect(seb.dureeEstimeeSec / 60, `${graine} · ${s.id}`).toBeLessThan(80);
      }
    }
  });

  it('« Précédent » revient à la série d’avant ; « Passer l’exercice » mène à l’exercice suivant', () => {
    const etapes = etapesDe(SEB);
    const secondeSerie = etapes.findIndex((e) => e.type === 'serie' && e.groupe === 1 && e.serie === 1 && e.exerciceId === 'shoulder-press');
    expect(indexEtapePrecedente(etapes, secondeSerie)).toBe(secondeSerie - 1);
    // De la pause lancée, on revient à la pause à lancer.
    const pause = etapes.findIndex((e) => e.type === 'repos' && e.motif === 'pause');
    expect(etapes[indexEtapePrecedente(etapes, pause)]).toMatchObject({ type: 'repos', motif: 'a-lancer' });
    // Passer la paire : on arrive à la première série de la suivante.
    expect(etapes[indexApresExercice(etapes, secondeSerie)]).toMatchObject({ type: 'serie', groupe: 2, serie: 1 });
  });

  it('lourd, correct ou léger : demandé à la fin de l’exercice, pendant la pause à lancer', () => {
    const etapes = etapesDe(SEB);
    const aLancer = etapes.findIndex((e) => e.type === 'repos' && e.motif === 'a-lancer' && e.groupe === 1);
    expect(exercicesAEvaluer(etapes, aLancer)).toEqual(['superman', 'shoulder-press']);
    expect(exercicesAEvaluer(etapes, aLancer + 1)).toEqual(['superman', 'shoulder-press']);
    // Pendant une série, rien.
    expect(exercicesAEvaluer(etapes, aLancer - 1)).toEqual([]);
  });

  it('l’essai, sur un seul téléphone : une série chacun, des pauses de 15 s, une dizaine de minutes', () => {
    for (const contexte of [SEB, MAX, SEUL]) {
      const courte = raccourcirPourEssai(seanceDe(contexte));
      const etapes = construireEtapes(courte);
      expect(courte.dureeEstimeeSec).toBe(dureeTotaleSec(etapes));
      expect(courte.dureeEstimeeSec / 60).toBeGreaterThan(5);
      expect(courte.dureeEstimeeSec / 60).toBeLessThan(16);
      for (const e of etapes) if (e.type === 'repos' && e.motif === 'pause') expect(e.dureeSec).toBe(15);
      expect(etapes.filter((e) => e.type === 'serie' && e.serie > 1)).toEqual([]);
    }
  });
});

describe('un seul téléphone : ce qu’on note pour les deux', () => {
  const seance = seanceDe(SEB);
  const etapes = construireEtapes(seance);
  const temps = etapes.map(() => 0);
  /** Les séries de la première paire, finies sur « Série terminée ». */
  const faitesPaire = etapes.flatMap((e, i) => (e.type === 'serie' && e.groupe === 1 ? [i] : []));

  it('« Série terminée » compte la série — elle seule — pour celui qui l’a faite, ou pour les deux', () => {
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
    // Léger deux fois de suite pour Big Max : un cran de plus, proposé dans sa
    // colonne.
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

  it('seul, ou sur deux téléphones, rien n’est noté pour l’autre', () => {
    const seul = seanceDe(SEUL);
    expect(agregerRealisation(seul, construireEtapes(seul), [], {}, 0, true).partenaire).toBeUndefined();
    const deux = seancePourPersonne(LUNDI_A, PARAMETRES, { personne: 'sebastien', aDeux: true }, LUNDI);
    expect(agregerRealisation(deux, construireEtapes(deux), [], {}, 0, true).partenaire).toBeUndefined();
  });
});
