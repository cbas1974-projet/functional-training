import { describe, expect, it } from 'vitest';
import type { Exercice, Seance } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { DUREES_MINUTES, FORMATS, NIVEAUX, PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { dureeSerieSec, estimerDureeSec, genererSeance, groupesDeBlocs, secondesParRep } from './generateurSeance';
import { TRANSITION_LIEN_SEC, basculerTour, delierDansProgramme, estPoussee, genererProgramme, seancePourPersonne } from './programmeMois';
import type { ContexteSeance } from './programmeMois';
import {
  CHANGEMENT_SEC,
  DUREE_PRET_SEC,
  INSTALLATION_SEC,
  agregerRealisation,
  construireEtapes,
  dureeRestanteSec,
  dureeTotaleSec,
  etatMaintien,
  etatMetronome,
  indexApresExercice,
  indexEtapePrecedente,
  indexReprise,
  lirePhase,
  pauseAEtirement,
  phasesDeRep,
  positionBille,
  premierePhase,
} from './etapesSeance';
import type { Etape } from './etapesSeance';

const TEMPO = { monteeSec: 5, descenteSec: 5 };

/** Séance construite à la main : 2 blocs en répétitions (un bilatéral, un
 *  unilatéral), un exercice au temps, puis un circuit de 2 tours × 2 stations. */
const SEANCE: Seance = {
  id: 'seance-test',
  creeLe: '2026-01-01T10:00:00.000Z',
  parametres: {
    dureeMinutes: 20,
    zones: ['bas', 'haut', 'dos', 'gainage', 'complet'],
    niveau: 'intermediaire',
    format: 'mixte',
    tempo: TEMPO,
    materiels: ['halteres'],
    explosifs: false,
    seriesParExercice: 3,
    repsParSerie: 8,
    guideVisuel: 'les-deux',
  },
  graine: 42,
  echauffementSec: 120,
  retourCalmeSec: 90,
  blocs: [
    { exerciceId: 'goblet-squat', series: 2, reps: 8, reposSec: 60 },
    { exerciceId: 'single-arm-row', series: 2, reps: 6, reposSec: 60 },
    { exerciceId: 'farmers-walk', series: 1, reps: 40, reposSec: 60 },
  ],
  circuit: {
    stations: ['shoulder-press', 'russian-twist'],
    tours: 2,
    travailSec: 40,
    reposSec: 20,
    reposEntreToursSec: 60,
  },
  dureeEstimeeSec: 0,
};

const ETAPES = construireEtapes(SEANCE);

/** Index des étapes de la séance de test, pour lisibilité. */
const I = {
  echauffement: 0,
  pretSquat1: 1,
  serieSquat1: 2,
  reposSquat1: 3,
  pretSquat2: 4,
  serieSquat2: 5,
  reposSquat2: 6,
  pretRow1: 7,
  serieRow1: 8,
  reposRow1: 9,
  pretRow2: 10,
  serieRow2: 11,
  reposRow2: 12,
  pretMarche: 13,
  serieMarche: 14,
  reposMarche: 15,
  pretCircuit: 16,
  stationPress1: 17,
  reposPress1: 18,
  stationTwist1: 19,
  reposTour: 20,
  stationPress2: 21,
  reposPress2: 22,
  stationTwist2: 23,
  retourCalme: 24,
  fin: 25,
};

const etape = (index: number): Etape => ETAPES[index];

describe('construireEtapes', () => {
  it('produit les étapes dans l’ordre attendu', () => {
    expect(ETAPES.map((e) => e.type)).toEqual([
      'echauffement',
      'pret', 'serie', 'repos',
      'pret', 'serie', 'repos',
      'pret', 'serie', 'repos',
      'pret', 'serie', 'repos',
      'pret', 'serie', 'repos',
      'pret',
      'station', 'repos', 'station',
      'reposTour',
      'station', 'repos', 'station',
      'retourCalme',
      'fin',
    ]);
    expect(ETAPES).toHaveLength(26);
  });

  it('calcule les durées des séries selon le tempo', () => {
    expect(etape(I.echauffement).dureeSec).toBe(120);
    expect(etape(I.pretSquat1).dureeSec).toBe(DUREE_PRET_SEC);
    // Bilatéral : 8 reps × 10 s
    expect(etape(I.serieSquat1).dureeSec).toBe(80);
    // Unilatéral : 6 reps × 10 s × 2 côtés
    expect(etape(I.serieRow1).dureeSec).toBe(120);
    // Au temps : les « reps » sont des secondes
    expect(etape(I.serieMarche).dureeSec).toBe(40);
    expect(etape(I.reposSquat1).dureeSec).toBe(60);
    expect(etape(I.stationPress1).dureeSec).toBe(40);
    expect(etape(I.reposPress1).dureeSec).toBe(20);
    expect(etape(I.reposTour).dureeSec).toBe(60);
    expect(etape(I.retourCalme).dureeSec).toBe(90);
    expect(dureeTotaleSec(ETAPES)).toBe(1240);
  });

  it('compte une répétition plus courte aux exercices sans arrêt en bas', () => {
    const avecPause = { monteeSec: 3, descenteSec: 3, pauseSec: 2 };
    const seance: Seance = {
      ...SEANCE,
      parametres: { ...SEANCE.parametres, tempo: avecPause },
      circuit: null,
      blocs: [
        { exerciceId: 'goblet-squat', series: 1, reps: 8, reposSec: 60 },
        { exerciceId: 'hammer-curl', series: 1, reps: 8, reposSec: 60 },
        { exerciceId: 'elevated-reverse-lunge', series: 1, reps: 6, reposSec: 60 },
        { exerciceId: 'single-arm-row', series: 1, reps: 6, reposSec: 60 },
      ],
    };
    const durees = construireEtapes(seance)
      .filter((e) => e.type === 'serie')
      .map((e) => [e.exerciceId, e.dureeSec]);
    expect(durees).toEqual([
      ['goblet-squat', 8 * 6],
      ['hammer-curl', 8 * 8],
      ['elevated-reverse-lunge', 6 * 6 * 2],
      ['single-arm-row', 6 * 8 * 2],
    ]);
  });

  it('numérote séries, tours et stations et attribue les exercices', () => {
    expect(etape(I.serieSquat2)).toMatchObject({
      type: 'serie',
      exerciceId: 'goblet-squat',
      serie: 2,
      series: 2,
      reps: 8,
    });
    expect(etape(I.pretRow1)).toMatchObject({
      type: 'pret',
      exerciceId: 'single-arm-row',
      suivant: { type: 'serie', exerciceId: 'single-arm-row', serie: 1, series: 2 },
    });
    expect(etape(I.pretCircuit)).toMatchObject({
      type: 'pret',
      exerciceId: 'shoulder-press',
      suivant: { type: 'station', exerciceId: 'shoulder-press', tour: 1, tours: 2, station: 1, stations: 2 },
    });
    expect(etape(I.stationTwist2)).toMatchObject({
      type: 'station',
      exerciceId: 'russian-twist',
      tour: 2,
      tours: 2,
      station: 2,
      stations: 2,
    });
    expect(etape(I.reposTour)).toMatchObject({ type: 'reposTour', tour: 1, tours: 2 });
    expect(etape(I.reposTour).exerciceId).toBeUndefined();
    expect(etape(I.retourCalme).exerciceId).toBeUndefined();
  });

  it('annonce dans chaque repos ce qui vient ensuite', () => {
    expect(etape(I.reposSquat1)).toMatchObject({
      exerciceId: 'goblet-squat',
      suivant: { type: 'serie', exerciceId: 'goblet-squat', serie: 2 },
    });
    expect(etape(I.reposSquat2)).toMatchObject({
      suivant: { type: 'serie', exerciceId: 'single-arm-row', serie: 1, series: 2 },
    });
    expect(etape(I.reposMarche)).toMatchObject({
      exerciceId: 'farmers-walk',
      suivant: { type: 'station', exerciceId: 'shoulder-press', tour: 1, station: 1 },
    });
    expect(etape(I.reposPress1)).toMatchObject({
      exerciceId: 'shoulder-press',
      suivant: { type: 'station', exerciceId: 'russian-twist', tour: 1, station: 2 },
    });
    expect(etape(I.reposTour)).toMatchObject({
      suivant: { type: 'station', exerciceId: 'shoulder-press', tour: 2, station: 1 },
    });
  });

  it('ne crée pas de repos superflu avant le retour au calme', () => {
    expect(etape(I.stationTwist2).type).toBe('station');
    expect(etape(I.retourCalme).type).toBe('retourCalme');
    expect(etape(I.fin).type).toBe('fin');

    const sansCircuit: Seance = { ...SEANCE, circuit: null };
    const types = construireEtapes(sansCircuit).map((e) => e.type);
    expect(types.slice(-3)).toEqual(['serie', 'retourCalme', 'fin']);
    // Le repos entre les deux blocs, lui, existe toujours.
    expect(types.filter((t) => t === 'repos')).toHaveLength(4);
  });

  it('omet les étapes de durée nulle', () => {
    const courte: Seance = {
      ...SEANCE,
      echauffementSec: 0,
      retourCalmeSec: 0,
      circuit: null,
      blocs: [{ exerciceId: 'hammer-curl', series: 1, reps: 8, reposSec: 0 }],
    };
    expect(construireEtapes(courte).map((e) => e.type)).toEqual(['pret', 'serie', 'fin']);
  });
});

describe('etatMetronome', () => {
  it('suit le tempo d’une série bilatérale qui commence par la descente', () => {
    expect(premierePhase(EXERCICES_PAR_ID['goblet-squat'])).toBe('descend');
    // À 12 s : 2e répétition, 2 s dans la descente, il en reste 3.
    expect(etatMetronome(etape(I.serieSquat1), 12, TEMPO)).toEqual({
      rep: 2,
      totalReps: 8,
      phase: 'descend',
      resteDansPhaseSec: 3,
      cycle: 1,
    });
    expect(etatMetronome(etape(I.serieSquat1), 0, TEMPO)).toMatchObject({
      rep: 1,
      phase: 'descend',
      resteDansPhaseSec: 5,
    });
    expect(etatMetronome(etape(I.serieSquat1), 17, TEMPO)).toMatchObject({
      rep: 2,
      phase: 'monte',
      resteDansPhaseSec: 3,
    });
    expect(etatMetronome(etape(I.serieSquat1), 79.5, TEMPO)).toMatchObject({
      rep: 8,
      phase: 'monte',
      resteDansPhaseSec: 0.5,
    });
  });

  it('commence par la montée pour un curl et distingue les côtés d’un unilatéral', () => {
    expect(premierePhase(EXERCICES_PAR_ID['hammer-curl'])).toBe('monte');
    const curl: Etape = {
      type: 'serie',
      exerciceId: 'hammer-curl',
      serie: 1,
      series: 1,
      reps: 8,
      dureeSec: 80,
    };
    expect(etatMetronome(curl, 12, TEMPO)).toMatchObject({ rep: 2, phase: 'monte', resteDansPhaseSec: 3 });
    expect(etatMetronome(curl, 12, TEMPO)?.cote).toBeUndefined();

    const rowing = etape(I.serieRow1);
    expect(etatMetronome(rowing, 12, TEMPO)).toMatchObject({
      rep: 2,
      totalReps: 6,
      cote: 'droit',
      phase: 'monte',
    });
    expect(etatMetronome(rowing, 59.9, TEMPO)).toMatchObject({ rep: 6, cote: 'droit' });
    expect(etatMetronome(rowing, 60, TEMPO)).toMatchObject({
      rep: 1,
      totalReps: 6,
      cote: 'gauche',
      phase: 'monte',
      resteDansPhaseSec: 5,
    });
    expect(etatMetronome(rowing, 119, TEMPO)).toMatchObject({ rep: 6, cote: 'gauche', phase: 'descend' });
  });

  it('respecte un tempo asymétrique', () => {
    const tempo = { monteeSec: 2, descenteSec: 4 };
    const curl: Etape = { type: 'serie', exerciceId: 'hammer-curl', serie: 1, series: 1, reps: 5, dureeSec: 30 };
    expect(etatMetronome(curl, 1, tempo)).toMatchObject({ rep: 1, phase: 'monte', resteDansPhaseSec: 1 });
    expect(etatMetronome(curl, 3, tempo)).toMatchObject({ rep: 1, phase: 'descend', resteDansPhaseSec: 3 });
    expect(etatMetronome(curl, 6, tempo)).toMatchObject({ rep: 2, phase: 'monte', resteDansPhaseSec: 2 });
  });

  it('tient la pause en bas, juste après la descente', () => {
    const tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 2 };
    // Développé couché : on descend, on tient en bas, on remonte sans élan.
    const developpe: Etape = { type: 'serie', exerciceId: 'bench-press', serie: 1, series: 1, reps: 8, dureeSec: 64 };
    expect(premierePhase(EXERCICES_PAR_ID['bench-press'])).toBe('descend');
    expect(etatMetronome(developpe, 1, tempo)).toMatchObject({ rep: 1, phase: 'descend', resteDansPhaseSec: 2 });
    expect(etatMetronome(developpe, 3.5, tempo)).toMatchObject({ rep: 1, phase: 'pause', resteDansPhaseSec: 1.5 });
    expect(etatMetronome(developpe, 6, tempo)).toMatchObject({ rep: 1, phase: 'monte', resteDansPhaseSec: 2 });
    expect(etatMetronome(developpe, 8, tempo)).toMatchObject({ rep: 2, phase: 'descend', resteDansPhaseSec: 3, cycle: 1 });

    // Curl : on monte, on redescend, puis on tient bras tendus avant la suivante.
    const curl: Etape = { type: 'serie', exerciceId: 'hammer-curl', serie: 1, series: 1, reps: 8, dureeSec: 64 };
    expect(etatMetronome(curl, 1, tempo)).toMatchObject({ rep: 1, phase: 'monte', resteDansPhaseSec: 2 });
    expect(etatMetronome(curl, 4, tempo)).toMatchObject({ rep: 1, phase: 'descend', resteDansPhaseSec: 2 });
    expect(etatMetronome(curl, 7, tempo)).toMatchObject({ rep: 1, phase: 'pause', resteDansPhaseSec: 1 });
    expect(etatMetronome(curl, 63.5, tempo)).toMatchObject({ rep: 8, phase: 'pause', resteDansPhaseSec: 0.5 });
  });

  it('ne tient aucune pause en bas pour un exercice qui n’en a pas : la répétition est plus courte', () => {
    const tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 2 };
    // Squat gobelet : on descend, on remonte aussitôt — 6 s par répétition, pas 8.
    const squat: Etape = { type: 'serie', exerciceId: 'goblet-squat', serie: 1, series: 1, reps: 8, dureeSec: 48 };
    expect(EXERCICES_PAR_ID['goblet-squat'].sansPauseEnBas).toBe(true);
    expect(etatMetronome(squat, 1, tempo)).toMatchObject({ rep: 1, phase: 'descend', resteDansPhaseSec: 2 });
    expect(etatMetronome(squat, 3.5, tempo)).toMatchObject({ rep: 1, phase: 'monte', resteDansPhaseSec: 2.5 });
    expect(etatMetronome(squat, 6, tempo)).toMatchObject({ rep: 2, phase: 'descend', resteDansPhaseSec: 3, cycle: 1 });
    expect(etatMetronome(squat, 47.9, tempo)).toMatchObject({ rep: 8, phase: 'monte' });
    // Soulevé de terre : on monte, on redescend, et on repart sans tenir en bas.
    const souleve: Etape = { type: 'serie', exerciceId: 'kb-deadlift', serie: 1, series: 1, reps: 8, dureeSec: 48 };
    expect(etatMetronome(souleve, 1, tempo)).toMatchObject({ rep: 1, phase: 'monte' });
    expect(etatMetronome(souleve, 5.9, tempo)).toMatchObject({ rep: 1, phase: 'descend' });
    expect(etatMetronome(souleve, 6, tempo)).toMatchObject({ rep: 2, phase: 'monte', cycle: 1 });
    // Sur un exercice unilatéral, la pause manque des deux côtés.
    const fente: Etape = { type: 'serie', exerciceId: 'elevated-reverse-lunge', serie: 1, series: 1, reps: 4, dureeSec: 48 };
    expect(etatMetronome(fente, 23.9, tempo)).toMatchObject({ rep: 4, totalReps: 4, cote: 'droit' });
    expect(etatMetronome(fente, 24, tempo)).toMatchObject({ rep: 1, totalReps: 4, cote: 'gauche' });
    // Le métronome, la bille et les bips lisent le même tempo que la durée.
    for (const id of ['goblet-squat', 'kb-deadlift', 'elevated-reverse-lunge', 'hammer-curl']) {
      const exercice = EXERCICES_PAR_ID[id];
      const parRep = secondesParRep(tempo, exercice);
      expect(parRep, id).toBe(exercice.sansPauseEnBas ? 6 : 8);
      expect(dureeSerieSec(exercice, 4, tempo), id).toBe(4 * parRep * (exercice.cotes === 'unilateral' ? 2 : 1));
      for (let t = 0; t < parRep; t += 0.5) {
        const etape: Etape = { type: 'serie', exerciceId: id, serie: 1, series: 1, reps: 4, dureeSec: dureeSerieSec(exercice, 4, tempo) };
        expect(etatMetronome(etape, t, tempo)?.phase === 'pause', `${id} · ${t} s`).toBe(!exercice.sansPauseEnBas && t >= 6);
      }
    }
  });

  it('découpe une répétition en phases, sans phase vide', () => {
    expect(phasesDeRep({ monteeSec: 3, descenteSec: 3, pauseSec: 2 }, 'descend')).toEqual([
      { phase: 'descend', dureeSec: 3 },
      { phase: 'pause', dureeSec: 2 },
      { phase: 'monte', dureeSec: 3 },
    ]);
    expect(phasesDeRep({ monteeSec: 3, descenteSec: 3, pauseSec: 2 }, 'monte').map((p) => p.phase)).toEqual([
      'monte',
      'descend',
      'pause',
    ]);
    // Une séance enregistrée avant l'arrivée de la pause se relit à l'identique.
    expect(phasesDeRep({ monteeSec: 4, descenteSec: 4 }, 'monte').map((p) => p.phase)).toEqual([
      'monte',
      'descend',
    ]);
    expect(lirePhase({ monteeSec: 4, descenteSec: 4 }, 'monte', 5)).toEqual({
      phase: 'descend',
      ecouleDansPhaseSec: 1,
      dureePhaseSec: 4,
    });
  });

  it('tient en haut, muscles serrés, quand la position basse est un repos : la Superman, la bouche d’incendie', () => {
    const tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 2 };
    // Superman : on monte, on tient poitrine et jambes décollées, on redescend se poser.
    const superman = EXERCICES_PAR_ID['kb-superman'];
    expect([superman.pauseEnHaut, premierePhase(superman)]).toEqual([true, 'monte']);
    const serie: Etape = {
      type: 'serie',
      exerciceId: 'kb-superman',
      serie: 1,
      series: 1,
      reps: 8,
      dureeSec: dureeSerieSec(superman, 8, tempo),
    };
    // La même durée qu'avec l'arrêt en bas : 8 s par répétition.
    expect(serie.dureeSec).toBe(64);
    expect(etatMetronome(serie, 1, tempo)).toMatchObject({ rep: 1, phase: 'monte', resteDansPhaseSec: 2 });
    expect(etatMetronome(serie, 3.5, tempo)).toMatchObject({ rep: 1, phase: 'pause', resteDansPhaseSec: 1.5 });
    expect(etatMetronome(serie, 5, tempo)).toMatchObject({ rep: 1, phase: 'descend', resteDansPhaseSec: 3 });
    expect(etatMetronome(serie, 7.5, tempo)).toMatchObject({ rep: 1, phase: 'descend', resteDansPhaseSec: 0.5 });
    expect(etatMetronome(serie, 8, tempo)).toMatchObject({ rep: 2, phase: 'monte', cycle: 1 });
    // La série finit posée, sur la dernière descente : jamais « TIENS » à plat.
    expect(etatMetronome(serie, 63.9, tempo)).toMatchObject({ rep: 8, phase: 'descend' });
    for (let t = 0; t < serie.dureeSec; t += 0.25) {
      const { phase } = etatMetronome(serie, t, tempo)!;
      const dansRep = t % 8;
      expect(phase === 'pause', `${t} s`).toBe(dansRep >= 3 && dansRep < 5);
    }

    // Bouche d'incendie, d'un côté puis de l'autre : la pause tient le genou
    // levé, des deux côtés.
    const hydrant = EXERCICES_PAR_ID['fire-hydrant'];
    expect([hydrant.pauseEnHaut, hydrant.cotes]).toEqual([true, 'unilateral']);
    const cotes: Etape = {
      type: 'serie',
      exerciceId: 'fire-hydrant',
      serie: 1,
      series: 1,
      reps: 4,
      dureeSec: dureeSerieSec(hydrant, 4, tempo),
    };
    expect(cotes.dureeSec).toBe(64);
    expect(etatMetronome(cotes, 4, tempo)).toMatchObject({ rep: 1, cote: 'droit', phase: 'pause' });
    expect(etatMetronome(cotes, 7, tempo)).toMatchObject({ rep: 1, cote: 'droit', phase: 'descend' });
    expect(etatMetronome(cotes, 36, tempo)).toMatchObject({ rep: 1, cote: 'gauche', phase: 'pause' });
    expect(etatMetronome(cotes, 38, tempo)).toMatchObject({ rep: 1, cote: 'gauche', phase: 'descend' });
  });

  it('découpe la répétition d’un exercice qui tient en haut : la pause suit la montée, quel que soit le départ', () => {
    const tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 2, pauseEnHaut: true };
    // Départ d'en bas : on monte, on tient, on redescend.
    expect(phasesDeRep(tempo, 'monte')).toEqual([
      { phase: 'monte', dureeSec: 3 },
      { phase: 'pause', dureeSec: 2 },
      { phase: 'descend', dureeSec: 3 },
    ]);
    // Départ d'en haut : on descend, on remonte, puis on tient en haut avant la suivante.
    expect(phasesDeRep(tempo, 'descend')).toEqual([
      { phase: 'descend', dureeSec: 3 },
      { phase: 'monte', dureeSec: 3 },
      { phase: 'pause', dureeSec: 2 },
    ]);
    expect(lirePhase(tempo, 'monte', 4)).toEqual({ phase: 'pause', ecouleDansPhaseSec: 1, dureePhaseSec: 2 });
    expect(lirePhase(tempo, 'descend', 7)).toEqual({ phase: 'pause', ecouleDansPhaseSec: 1, dureePhaseSec: 2 });
    // Sans arrêt dans le tempo, l'ordre reste celui de toujours.
    expect(phasesDeRep({ monteeSec: 4, descenteSec: 4, pauseEnHaut: true }, 'descend').map((p) => p.phase)).toEqual([
      'descend',
      'monte',
    ]);
  });

  it('suit toute la chaîne pour un exercice qui part d’en haut et tient en haut : durée, étapes, métronome', () => {
    // Aucun exercice de la bibliothèque ne part d'en haut en tenant en haut : on
    // en prête un, le temps du test.
    const prete: Exercice = { ...EXERCICES_PAR_ID['leg-extension'], id: 'essai-depart-en-haut', premierePhase: 'descend' };
    expect(prete.pauseEnHaut).toBe(true);
    const tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 2 };
    EXERCICES_PAR_ID[prete.id] = prete;
    try {
      const seance: Seance = {
        ...SEANCE,
        parametres: { ...SEANCE.parametres, format: 'series', tempo },
        blocs: [{ exerciceId: prete.id, series: 2, reps: 8, reposSec: 30 }],
        circuit: null,
      };
      const etapes = construireEtapes(seance);
      // La durée annoncée est celle des étapes, et l'arrêt garde sa durée.
      expect(dureeTotaleSec(etapes)).toBe(estimerDureeSec(seance));
      const serie = etapes.find((e) => e.type === 'serie')!;
      expect(serie.dureeSec).toBe(64);
      expect(etatMetronome(serie, 1, tempo)).toMatchObject({ rep: 1, phase: 'descend' });
      expect(etatMetronome(serie, 4, tempo)).toMatchObject({ rep: 1, phase: 'monte' });
      expect(etatMetronome(serie, 7, tempo)).toMatchObject({ rep: 1, phase: 'pause', resteDansPhaseSec: 1 });
      expect(etatMetronome(serie, 8, tempo)).toMatchObject({ rep: 2, phase: 'descend', cycle: 1 });
      // La série finit en haut, sur le dernier arrêt.
      expect(etatMetronome(serie, 63.5, tempo)).toMatchObject({ rep: 8, phase: 'pause' });
    } finally {
      delete EXERCICES_PAR_ID[prete.id];
    }
  });

  it('pose la bille au pied du rail pour une pause en bas, la garde en haut pour une pause en haut', () => {
    // Montée : du pied (1) vers le haut (0) ; descente : l'inverse.
    expect(positionBille('monte', 0)).toBe(1);
    expect(positionBille('monte', 1)).toBe(0);
    expect(positionBille('monte', 0.25)).toBe(0.75);
    expect(positionBille('descend', 0)).toBe(0);
    expect(positionBille('descend', 1)).toBe(1);
    expect(positionBille('descend', 0.25)).toBe(0.25);
    // La pause en bas : au pied du rail, d'un bout à l'autre de la pause.
    expect(positionBille('pause', 0)).toBe(1);
    expect(positionBille('pause', 0.5)).toBe(1);
    // La pause en haut : en haut du rail, là où la montée l'a laissée.
    expect(positionBille('pause', 0, true)).toBe(0);
    expect(positionBille('pause', 1, true)).toBe(0);
    // La montée et la descente ne dépendent pas de l'endroit de la pause.
    expect(positionBille('monte', 0.25, true)).toBe(0.75);
    expect(positionBille('descend', 0.25, true)).toBe(0.25);
    // Hors bornes (arrondi de l'horloge) : la bille reste sur le rail.
    expect(positionBille('monte', 1.2)).toBe(0);
    expect(positionBille('descend', -0.1)).toBe(0);

    // La bille d'une Superman, image après image, ne quitte jamais le haut du
    // rail pendant la pause, et ne s'y pose jamais au pied.
    const tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 1, pauseEnHaut: true };
    for (const premiere of ['monte', 'descend'] as const) {
      let avant: number | null = null;
      for (let t = 0; t < 7; t += 0.1) {
        const lecture = lirePhase(tempo, premiere, t);
        const position = positionBille(lecture.phase, lecture.ecouleDansPhaseSec / lecture.dureePhaseSec, true);
        if (lecture.phase === 'pause') expect(position, `${premiere} · ${t} s`).toBe(0);
        // Pas de saut : la bille glisse d'une image à l'autre.
        if (avant !== null) expect(Math.abs(position - avant), `${premiere} · ${t} s`).toBeLessThan(0.05);
        avant = position;
      }
    }
  });

  it('compte les répétitions d’une station au temps et reste muet pour un exercice au temps', () => {
    const station = etape(I.stationPress1);
    expect(etatMetronome(station, 0, TEMPO)).toMatchObject({ rep: 1, totalReps: 4, phase: 'monte' });
    expect(etatMetronome(station, 35, TEMPO)).toMatchObject({ rep: 4, totalReps: 4, phase: 'descend' });
    // Station dont la durée n'est pas un multiple du tempo : le compteur reste
    // sur la dernière répétition pendant la « queue ».
    const station45: Etape = {
      type: 'station',
      exerciceId: 'shoulder-press',
      tour: 1,
      tours: 2,
      station: 1,
      stations: 2,
      dureeSec: 45,
    };
    expect(etatMetronome(station45, 42, TEMPO)).toMatchObject({ rep: 4, totalReps: 4, cycle: 4 });

    expect(etatMetronome(etape(I.serieMarche), 10, TEMPO)).toBeNull();
    expect(etatMetronome(etape(I.reposSquat1), 10, TEMPO)).toBeNull();
    expect(etatMetronome(etape(I.echauffement), 10, TEMPO)).toBeNull();
  });
});

describe('dureeRestanteSec', () => {
  it('additionne le reste de l’étape courante et les étapes suivantes', () => {
    expect(dureeRestanteSec(ETAPES, 0, 0)).toBe(1240);
    expect(dureeRestanteSec(ETAPES, I.echauffement, 20)).toBe(1220);
    expect(dureeRestanteSec(ETAPES, I.serieSquat1, 30)).toBe(1240 - 120 - 5 - 30);
    // Un repos prolongé de 15 s
    expect(dureeRestanteSec(ETAPES, I.reposSquat1, 10, 15)).toBe(1240 - 125 - 80 - 10 + 15);
    // Au-delà de la durée prévue, le reste de l'étape courante est nul
    expect(dureeRestanteSec(ETAPES, I.retourCalme, 200)).toBe(0);
    expect(dureeRestanteSec(ETAPES, I.fin, 0)).toBe(0);
    expect(dureeRestanteSec(ETAPES, 99, 0)).toBe(0);
  });
});

describe('indexEtapePrecedente / indexReprise / indexApresExercice', () => {
  it('ramène au début de la série ou de la station précédente', () => {
    expect(indexEtapePrecedente(ETAPES, I.echauffement)).toBe(0);
    expect(indexEtapePrecedente(ETAPES, I.pretSquat1)).toBe(I.echauffement);
    // Depuis une série en cours : sa propre préparation (on la recommence)
    expect(indexEtapePrecedente(ETAPES, I.serieSquat1)).toBe(I.pretSquat1);
    // Depuis le repos : la série qui vient d'être faite
    expect(indexEtapePrecedente(ETAPES, I.reposSquat1)).toBe(I.pretSquat1);
    expect(indexEtapePrecedente(ETAPES, I.pretSquat2)).toBe(I.pretSquat1);
    // Dans le circuit : la station précédente, même après le repos entre tours
    expect(indexEtapePrecedente(ETAPES, I.stationTwist1)).toBe(I.pretCircuit);
    expect(indexEtapePrecedente(ETAPES, I.reposTour)).toBe(I.stationTwist1);
    expect(indexEtapePrecedente(ETAPES, I.stationPress2)).toBe(I.stationTwist1);
    expect(indexEtapePrecedente(ETAPES, I.fin)).toBe(I.retourCalme);
  });

  it('reprend une série par sa préparation et les autres étapes sur place', () => {
    expect(indexReprise(ETAPES, I.serieSquat1)).toBe(I.pretSquat1);
    expect(indexReprise(ETAPES, I.reposSquat1)).toBe(I.reposSquat1);
    expect(indexReprise(ETAPES, I.stationPress1)).toBe(I.pretCircuit);
    expect(indexReprise(ETAPES, I.stationTwist1)).toBe(I.stationTwist1);
    expect(indexReprise(ETAPES, I.fin)).toBe(I.fin);
    expect(indexReprise(ETAPES, 999)).toBe(I.fin);
    expect(indexReprise(ETAPES, -3)).toBe(0);
  });

  it('saute toutes les étapes restantes de l’exercice courant', () => {
    expect(indexApresExercice(ETAPES, I.serieSquat1)).toBe(I.pretRow1);
    expect(indexApresExercice(ETAPES, I.pretRow2)).toBe(I.pretMarche);
    expect(indexApresExercice(ETAPES, I.stationPress1)).toBe(I.stationTwist1);
    expect(indexApresExercice(ETAPES, I.stationTwist2)).toBe(I.retourCalme);
    expect(indexApresExercice(ETAPES, I.echauffement)).toBe(I.pretSquat1);
    expect(indexApresExercice(ETAPES, I.fin)).toBe(I.fin);
  });
});

describe('agregerRealisation', () => {
  it('compte les séries faites, le temps par exercice et le poids', () => {
    const temps: number[] = new Array<number>(ETAPES.length).fill(0);
    temps[I.echauffement] = 120;
    // Goblet squat : 1re série complète, 2e à peine entamée (30 s sur 80)
    temps[I.pretSquat1] = 5;
    temps[I.serieSquat1] = 80;
    temps[I.reposSquat1] = 60;
    temps[I.pretSquat2] = 5;
    temps[I.serieSquat2] = 30;
    temps[I.reposSquat2] = 45;
    // Rowing : les deux séries faites, dont une à 60 % (72 s sur 120)
    temps[I.pretRow1] = 5;
    temps[I.serieRow1] = 120;
    temps[I.reposRow1] = 60;
    temps[I.pretRow2] = 5;
    temps[I.serieRow2] = 72;
    temps[I.reposRow2] = 61.4;
    // Marche du fermier passée (0 s)
    // Circuit : premier tour fait, second passé
    temps[I.pretCircuit] = 5;
    temps[I.stationPress1] = 40;
    temps[I.reposPress1] = 20;
    temps[I.stationTwist1] = 40;
    temps[I.reposTour] = 10;

    const realisee = agregerRealisation(
      SEANCE,
      ETAPES,
      temps,
      { 'goblet-squat': [12, 14], 'single-arm-row': [0] },
      843.6,
      false,
    );

    expect(realisee.terminee).toBe(false);
    expect(realisee.dureePrevueSec).toBe(1240);
    expect(realisee.dureeReelleSec).toBe(844);
    expect(realisee.parametres).toBe(SEANCE.parametres);
    expect(realisee.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(realisee.date))).toBe(false);

    expect(realisee.exercices.map((e) => e.exerciceId)).toEqual([
      'goblet-squat',
      'single-arm-row',
      'farmers-walk',
      'shoulder-press',
      'russian-twist',
    ]);

    const [squat, rowing, marche, press, twist] = realisee.exercices;
    expect(squat).toEqual({
      exerciceId: 'goblet-squat',
      seriesPrevues: 2,
      seriesFaites: 1,
      reps: 8,
      dureeSec: 225,
      // `poids` est la charge de référence : la plus lourde des séries.
      poids: 14,
      poidsParSerie: [12, 14],
    });
    expect(rowing).toEqual({
      exerciceId: 'single-arm-row',
      seriesPrevues: 2,
      seriesFaites: 2,
      reps: 6,
      dureeSec: 323,
    });
    expect(rowing.poids).toBeUndefined();
    expect(rowing.poidsParSerie).toBeUndefined();
    expect(marche).toMatchObject({ seriesPrevues: 1, seriesFaites: 0, reps: 40, dureeSec: 0 });
    // Le temps de la préparation du circuit revient à sa première station ;
    // le repos entre tours n'est attribué à personne.
    expect(press).toMatchObject({ seriesPrevues: 2, seriesFaites: 1, reps: 40, dureeSec: 65 });
    expect(twist).toMatchObject({ seriesPrevues: 2, seriesFaites: 1, reps: 40, dureeSec: 40 });
  });

  it('accepte un tableau de temps incomplet et marque une séance terminée', () => {
    const realisee = agregerRealisation(SEANCE, ETAPES, [120, 5, 80], {}, 205, true);
    expect(realisee.terminee).toBe(true);
    expect(realisee.exercices[0]).toMatchObject({ seriesFaites: 1, dureeSec: 85 });
    expect(realisee.exercices.slice(1).every((e) => e.seriesFaites === 0 && e.dureeSec === 0)).toBe(true);
  });
});

describe('accord entre la durée estimée et les étapes', () => {
  it('une séance de mobilité dure aussi exactement ce qui est annoncé', () => {
    for (const discipline of ['yoga', 'etirement', 'mobilite'] as const) {
      for (const dureeMinutes of DUREES_MINUTES) {
        for (const tenueSec of [20, 30, 45]) {
          const seance = genererSeance(
            {
              ...PARAMETRES_PAR_DEFAUT,
              discipline,
              tenueSec,
              dureeMinutes,
              materiels: ['halteres', 'tapis', 'step', 'barre-fixe'],
            },
            123,
          );
          expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
          expect(seance.dureeEstimeeSec).toBeLessThanOrEqual(dureeMinutes * 60);
        }
      }
    }
  });

  it('tient une position unilatérale d’un côté puis de l’autre', () => {
    const seance = genererSeance(
      {
        ...PARAMETRES_PAR_DEFAUT,
        discipline: 'yoga',
        tenueSec: 30,
        dureeMinutes: 30,
        materiels: ['halteres', 'tapis'],
      },
      123,
    );
    const etapes = construireEtapes(seance);
    const travail = etapes.filter(
      (etape): etape is Extract<Etape, { type: 'serie' }> => etape.type === 'serie',
    );
    const unilaterale = travail.find(
      (etape) => EXERCICES_PAR_ID[etape.exerciceId].cotes === 'unilateral',
    );
    expect(unilaterale).toBeDefined();
    if (!unilaterale) return;

    // Le maintien dure deux fois la tenue annoncée : trente secondes par côté.
    expect(unilaterale.dureeSec).toBe(60);
    expect(etatMaintien(unilaterale, 0)).toEqual({ cote: 'droit', resteSec: 30, parCoteSec: 30 });
    expect(etatMaintien(unilaterale, 29)).toMatchObject({ cote: 'droit' });
    expect(etatMaintien(unilaterale, 30)).toEqual({ cote: 'gauche', resteSec: 30, parCoteSec: 30 });
    expect(etatMaintien(unilaterale, 59)).toMatchObject({ cote: 'gauche', resteSec: 1 });
    // Pas de bille à suivre : une position ne se compte pas en répétitions.
    expect(etatMetronome(unilaterale, 10, PARAMETRES_PAR_DEFAUT.tempo)).toBeNull();

    const bilaterale = travail.find(
      (etape) => EXERCICES_PAR_ID[etape.exerciceId].cotes !== 'unilateral',
    );
    expect(bilaterale).toBeDefined();
    if (bilaterale) {
      expect(bilaterale.dureeSec).toBe(30);
      expect(etatMaintien(bilaterale, 5)).toBeNull();
    }
  });

  it('la séance guidée dure exactement ce que le générateur annonce, même avec des exercices sans arrêt en bas', () => {
    const tempos = [{ monteeSec: 3, descenteSec: 3, pauseSec: 1 }, { monteeSec: 4, descenteSec: 4, pauseSec: 2 }, { monteeSec: 3, descenteSec: 3 }];
    // Des séries et des supersets qui comptent des exercices du dos et des genoux.
    for (const tempo of tempos) {
      for (const format of ['series', 'superset'] as const) {
        const seance: Seance = {
          ...SEANCE,
          parametres: { ...SEANCE.parametres, format, tempo },
          circuit: null,
          blocs: [
            { exerciceId: 'goblet-squat', series: 3, reps: 8, reposSec: 60, ...(format === 'superset' ? { superset: 0, transitionSec: 20 } : {}) },
            { exerciceId: 'hammer-curl', series: 3, reps: 8, reposSec: 60, ...(format === 'superset' ? { superset: 0, transitionSec: 20 } : {}) },
            { exerciceId: 'kb-deadlift', series: 3, reps: 10, reposSec: 90 },
            { exerciceId: 'elevated-reverse-lunge', series: 2, reps: 6, reposSec: 60 },
          ],
        };
        expect(dureeTotaleSec(construireEtapes(seance))).toBe(estimerDureeSec(seance));
      }
    }
    // Et des séances libres tirées au hasard, kettlebell et jambes compris.
    let sansPause = 0;
    for (const format of FORMATS) {
      for (const dureeMinutes of [20, 45, 60] as const) {
        for (const graine of [1, 2, 3, 4, 5, 6]) {
          const seance = genererSeance(
            {
              ...PARAMETRES_PAR_DEFAUT,
              dureeMinutes,
              format: format.id,
              zones: ['bas', 'dos'],
              materiels: ['halteres', 'kettlebell', 'banc', 'step'],
              tempo: { monteeSec: 3, descenteSec: 3, pauseSec: 1 },
            },
            graine,
          );
          sansPause += seance.blocs.filter((b) => EXERCICES_PAR_ID[b.exerciceId].sansPauseEnBas).length;
          expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
        }
      }
    }
    // Le test ne prouve rien s'il ne tombe jamais sur un exercice sans arrêt en bas.
    expect(sansPause).toBeGreaterThan(10);
  });

  it('la séance guidée dure exactement ce que le générateur annonce', () => {
    for (const format of FORMATS) {
      for (const dureeMinutes of DUREES_MINUTES) {
        for (const niveau of NIVEAUX) {
          const seance = genererSeance(
            { ...PARAMETRES_PAR_DEFAUT, dureeMinutes, format: format.id, niveau: niveau.id },
            123,
          );
          expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
        }
      }
    }
  });
});

describe('superset', () => {
  const SEANCE_SUPERSET: Seance = {
    ...SEANCE,
    parametres: { ...SEANCE.parametres, format: 'superset' },
    blocs: [
      { exerciceId: 'goblet-squat', series: 2, reps: 8, reposSec: 60, superset: 0, transitionSec: 20 },
      { exerciceId: 'shoulder-press', series: 2, reps: 8, reposSec: 60, superset: 0, transitionSec: 20 },
      { exerciceId: 'russian-twist', series: 2, reps: 40, reposSec: 60, superset: 1, transitionSec: 20 },
    ],
    circuit: null,
  };
  const ETAPES_SUPERSET = construireEtapes(SEANCE_SUPERSET);

  it('alterne les deux exercices série par série', () => {
    const travail = ETAPES_SUPERSET.filter((e) => e.type === 'serie');
    expect(travail.map((e) => `${e.exerciceId}#${e.serie}`)).toEqual([
      'goblet-squat#1',
      'shoulder-press#1',
      'goblet-squat#2',
      'shoulder-press#2',
      'russian-twist#1',
      'russian-twist#2',
    ]);
  });

  it('place un repos court entre les deux exercices et le repos complet après', () => {
    const repos = ETAPES_SUPERSET.filter((e) => e.type === 'repos').map((e) => e.dureeSec);
    // squat → 20 s → press → 60 s → squat → 20 s → press → 60 s → twist → 60 s
    expect(repos).toEqual([20, 60, 20, 60, 60]);
  });

  it('annonce le partenaire du superset pendant le repos court', () => {
    const premierRepos = ETAPES_SUPERSET.find((e) => e.type === 'repos');
    expect(premierRepos?.type === 'repos' && premierRepos.suivant).toMatchObject({
      type: 'serie',
      exerciceId: 'shoulder-press',
      serie: 1,
    });
  });

  it('« Passer l’exercice » saute le superset entier', () => {
    const premiereSerie = ETAPES_SUPERSET.findIndex((e) => e.type === 'serie');
    const apres = indexApresExercice(ETAPES_SUPERSET, premiereSerie);
    expect(ETAPES_SUPERSET[apres].exerciceId).toBe('russian-twist');
  });
});

describe('l’horloge des séances du programme', () => {
  const programme = genererProgramme({ graine: 3, aujourdhui: new Date(2026, 9, 5) });
  const jeudiMois = programme.seances.find((s) => s.id === 'jeudi')!;
  /** Le même jeudi, chaque exercice seul : la trap bar chacun son tour. */
  const jeudiSeul = jeudiMois.exercices
    .reduce((prog, id) => delierDansProgramme(prog, 'jeudi', id), programme)
    .seances.find((s) => s.id === 'jeudi')!;
  const tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 2 };
  const parametres = { ...PARAMETRES_PAR_DEFAUT, tempo };
  const SEB: ContexteSeance = { personne: 'sebastien', aDeux: true };
  const MAX: ContexteSeance = { personne: 'max', aDeux: true };
  const etapesDe = (seanceMois = jeudiMois, contexte: ContexteSeance = SEB) =>
    construireEtapes(seancePourPersonne(seanceMois, parametres, contexte));
  const serieDe = (exerciceId: string, reps: number) => dureeSerieSec(EXERCICES_PAR_ID[exerciceId], reps, tempo);

  /** L'instant où commence chaque étape, depuis le début de la séance. */
  const debuts = (etapes: Etape[]) => {
    let t = 0;
    return etapes.map((etape) => {
      const debut = t;
      t += etape.dureeSec;
      return debut;
    });
  };
  /** Les instants où la séance attend « Go ». */
  const instantsGo = (etapes: Etape[]) => {
    const d = debuts(etapes);
    return etapes.flatMap((e, i) => (e.type === 'repos' && e.manuel ? [d[i]] : []));
  };
  /** Les séries d'un téléphone, avec leur début et leur fin. */
  const series = (etapes: Etape[]) => {
    const d = debuts(etapes);
    return etapes.flatMap((e, i) => (e.type === 'serie' ? [{ exerciceId: e.exerciceId, debut: d[i], fin: d[i] + e.dureeSec }] : []));
  };
  /** Le temps passé sur un exercice, préparation comprise : sur une machine,
   *  on s'installe avant la série. */
  const surExercice = (etapes: Etape[], exerciceId: string) => {
    const d = debuts(etapes);
    return etapes.flatMap((e, i) =>
      e.type === 'serie' && e.exerciceId === exerciceId ? [{ debut: d[i - 1], fin: d[i] + e.dureeSec }] : [],
    );
  };
  const jamaisEnsemble = (a: { debut: number; fin: number }[], b: { debut: number; fin: number }[]) => {
    for (const x of a) for (const y of b) expect(x.fin <= y.debut || y.fin <= x.debut).toBe(true);
  };

  it('seul : chaque nouvelle paire attend « Go », après la pause de la précédente et l’installation', () => {
    for (const seanceMois of [jeudiMois, jeudiSeul]) {
      const seule = seancePourPersonne(seanceMois, parametres, { personne: 'sebastien' });
      const etapes = construireEtapes(seule);
      const groupes = groupesDeBlocs(seule.blocs);
      const manuelles = etapes.filter((e) => e.type === 'repos' && e.manuel);
      expect(manuelles).toHaveLength(groupes.length);
      expect(manuelles.map((e) => e.dureeSec)).toEqual(
        groupes.map((_, g) => (g === 0 ? 0 : groupes[g - 1].at(-1)!.reposSec) + INSTALLATION_SEC),
      );
      // Seul, personne à attendre.
      expect(etapes.some((e) => e.type === 'repos' && e.motif !== 'repos' && e.motif !== 'installation')).toBe(false);
    }
    // Trois paires et la finale : quatre « Go ».
    expect(groupesDeBlocs(seancePourPersonne(jeudiMois, parametres, { personne: 'sebastien' }).blocs)).toHaveLength(4);
  });

  it('à deux, les « Go » tombent à la même seconde sur les deux téléphones', () => {
    for (const s of [...programme.seances, jeudiSeul]) {
      const [seb, max] = [etapesDe(s, SEB), etapesDe(s, MAX)];
      expect(instantsGo(seb)).toEqual(instantsGo(max));
      expect(dureeTotaleSec(seb)).toBe(dureeTotaleSec(max));
    }
  });

  it('à deux, côte à côte, chaque tour d’une paire commence ensemble', () => {
    for (const s of programme.seances) {
      const [seb, max] = [series(etapesDe(s, SEB)), series(etapesDe(s, MAX))];
      const machines = new Set(s.tour);
      for (const [premier, second] of s.liens ?? []) {
        if (machines.has(premier) || machines.has(second)) continue;
        const debutsSeb = seb.filter((x) => x.exerciceId === premier).map((x) => x.debut);
        const debutsMax = max.filter((x) => x.exerciceId === premier).map((x) => x.debut);
        expect(debutsMax.slice(0, debutsSeb.length)).toEqual(debutsSeb);
      }
    }
  });

  it('chacun son tour sur la trap bar seule : Max commence, Sébastien attend sa série', () => {
    const [seb, max] = [etapesDe(jeudiSeul), etapesDe(jeudiSeul, MAX)];
    const goSeb = seb.findIndex((e) => e.type === 'repos' && e.manuel);
    expect(seb[goSeb + 1]).toMatchObject({
      type: 'repos',
      motif: 'tour',
      dureeSec: DUREE_PRET_SEC + serieDe('trap-bar-deadlift', 10) + CHANGEMENT_SEC,
    });
    const goMax = max.findIndex((e) => e.type === 'repos' && e.manuel);
    expect(max[goMax + 1].type).toBe('pret');
    expect(max[goMax + 2]).toMatchObject({ type: 'serie', exerciceId: 'trap-bar-deadlift', reps: 10 });
    // Jamais les deux sur la machine en même temps.
    jamaisEnsemble(surExercice(seb, 'trap-bar-deadlift'), surExercice(max, 'trap-bar-deadlift'));
  });

  it('Max fait sa série de plus aux poussées : Sébastien a un repos prolongé', () => {
    const seance = seancePourPersonne(jeudiSeul, parametres, SEB);
    const poussee = seance.blocs.find((b) => estPoussee(EXERCICES_PAR_ID[b.exerciceId]) && !b.tour)!;
    expect(poussee.autre?.series).toBe(poussee.series + 1);
    const prolonge = construireEtapes(seance).find(
      (e) => e.type === 'repos' && e.motif === 'serie-de-plus' && e.exerciceId === poussee.exerciceId,
    );
    // Sa série plus longue au troisième tour, le repos, puis sa quatrième série.
    const maSerie = DUREE_PRET_SEC + serieDe(poussee.exerciceId, 8);
    const saSerie = DUREE_PRET_SEC + serieDe(poussee.exerciceId, 10);
    expect(prolonge?.dureeSec).toBe(saSerie - maSerie + poussee.reposSec + saSerie);
    // En paire aussi, Sébastien attend la quatrième série de Max.
    const enPaire = construireEtapes(seancePourPersonne(jeudiMois, parametres, SEB));
    expect(enPaire.some((e) => e.type === 'repos' && e.motif === 'serie-de-plus')).toBe(true);
  });

  it('dans la paire de la trap bar, on se croise : Max à la barre, Sébastien à l’autre exercice, puis on échange', () => {
    const [barre, autre] = jeudiMois.exercices;
    expect(barre).toBe('trap-bar-deadlift');
    expect(jeudiMois.liens?.[0]).toEqual([barre, autre]);
    const [seb, max] = [etapesDe(jeudiMois, SEB), etapesDe(jeudiMois, MAX)];
    expect(seb.find((e) => e.type === 'serie')?.exerciceId).toBe(autre);
    expect(max.find((e) => e.type === 'serie')?.exerciceId).toBe(barre);
    expect(instantsGo(seb)).toEqual(instantsGo(max));
    // Jamais les deux à la barre, préparation comprise.
    jamaisEnsemble(surExercice(seb, barre), surExercice(max, barre));
  });

  it('on se croise aussi le lundi et le mardi, sur une paire qui compte une machine', () => {
    for (const id of ['lundi-a', 'mardi-a', 'lundi-b', 'mardi-b']) {
      const [premier, second] = programme.seances.find((s) => s.id === id)!.liens![0];
      // Une seule paire d'haltères de la bonne charge : le premier exercice,
      // chacun son tour.
      const seanceMois = basculerTour(programme, id, premier).seances.find((s) => s.id === id)!;
      for (const tempoDuJour of [tempo, { monteeSec: 4, descenteSec: 4, pauseSec: 2 }]) {
        const contexte = (qui: ContexteSeance) => ({ ...qui, tempo: tempoDuJour });
        const seb = construireEtapes(seancePourPersonne(seanceMois, parametres, contexte(SEB)));
        const max = construireEtapes(seancePourPersonne(seanceMois, parametres, contexte(MAX)));
        // Max commence par le premier, Sébastien par le second.
        expect(max.find((e) => e.type === 'serie')?.exerciceId, id).toBe(premier);
        expect(seb.find((e) => e.type === 'serie')?.exerciceId, id).toBe(second);
        // La même horloge sur les deux téléphones.
        expect(instantsGo(seb)).toEqual(instantsGo(max));
        expect(dureeTotaleSec(seb)).toBe(dureeTotaleSec(max));
        // Chacun fait toutes ses séries, et jamais les deux sur la machine en
        // même temps.
        const blocsSeb = seancePourPersonne(seanceMois, parametres, contexte(SEB)).blocs;
        for (const exerciceId of [premier, second]) {
          const bloc = blocsSeb.find((b) => b.exerciceId === exerciceId)!;
          expect(series(seb).filter((x) => x.exerciceId === exerciceId)).toHaveLength(bloc.series);
          expect(series(max).filter((x) => x.exerciceId === exerciceId)).toHaveLength(bloc.autre!.series);
        }
        jamaisEnsemble(surExercice(seb, premier), surExercice(max, premier));
      }
    }
  });

  it('le lundi, deux machines en paire — extension et flexion des jambes : on se croise, chacun sur la sienne, puis on échange', () => {
    for (const id of ['lundi-a', 'lundi-b']) {
      const seanceMois = programme.seances.find((s) => s.id === id)!;
      const paire = seanceMois.liens!.find((l) => l.includes('leg-extension-machine'))!;
      expect(paire, id).toEqual(['leg-extension-machine', 'leg-curl-machine']);
      expect(seanceMois.tour, id).toEqual(expect.arrayContaining(paire));
      const [premier, second] = paire;
      for (const tempoDuJour of [tempo, { monteeSec: 4, descenteSec: 4, pauseSec: 2 }]) {
        const contexte = (qui: ContexteSeance) => ({ ...qui, tempo: tempoDuJour });
        const pourSeb = seancePourPersonne(seanceMois, parametres, contexte(SEB));
        const pourMax = seancePourPersonne(seanceMois, parametres, contexte(MAX));
        const [seb, max] = [construireEtapes(pourSeb), construireEtapes(pourMax)];
        const g = groupesDeBlocs(pourSeb.blocs).findIndex((groupe) => groupe.some((b) => b.exerciceId === premier));
        const ordre = (etapes: Etape[]) => etapes.filter((e) => e.type === 'serie' && e.groupe === g).map((e) => e.exerciceId);
        // Big Max commence sur l'extension, Speedy sur la flexion, puis on échange.
        expect(ordre(max), id).toEqual([premier, second, premier, second, premier, second]);
        expect(ordre(seb), id).toEqual([second, premier, second, premier, second, premier]);
        // Jamais les deux sur la même machine, préparation comprise.
        jamaisEnsemble(surExercice(seb, premier), surExercice(max, premier));
        jamaisEnsemble(surExercice(seb, second), surExercice(max, second));
        // Big Max, plus de répétitions, ne trouve jamais sa machine occupée ;
        // Speedy attend au plus qu'il la quitte : la différence de leurs séries.
        expect(max.filter((e) => e.type === 'repos' && e.motif === 'tour' && e.groupe === g), id).toEqual([]);
        // Au tempo du jour : le passage d'une machine à l'autre, ou plus si
        // Big Max n'a pas fini — l'extension tient jambes tendues à chaque
        // répétition, et il en fait deux de plus.
        const serieDuJour = (exerciceId: string, reps: number) =>
          dureeSerieSec(EXERCICES_PAR_ID[exerciceId], reps, tempoDuJour);
        const attente = Math.max(TRANSITION_LIEN_SEC, serieDuJour(premier, 10) - serieDuJour(second, 8));
        for (const e of seb.filter((x) => x.type === 'repos' && x.motif === 'tour' && x.groupe === g)) {
          expect(e.dureeSec, id).toBeLessThanOrEqual(attente);
        }
        // La même horloge, et la durée annoncée est celle des étapes.
        expect(instantsGo(seb)).toEqual(instantsGo(max));
        expect(dureeTotaleSec(seb)).toBe(dureeTotaleSec(max));
        expect(pourSeb.dureeEstimeeSec).toBe(dureeTotaleSec(seb));
        expect(pourMax.dureeEstimeeSec).toBe(dureeTotaleSec(max));
        // Deux petits muscles : une minute après la paire.
        expect(pourSeb.blocs.filter((b) => paire.includes(b.exerciceId)).map((b) => b.reposSec)).toEqual([60, 60]);
      }
    }
  });

  it('propose de s’étirer pendant la série de l’autre et les grosses pauses, pas à chaque repos', () => {
    const avecEtirement = (etapes: Etape[]) => etapes.filter(pauseAEtirement);
    // À deux, la trap bar seule : chaque attente de la série de l'autre, puis
    // la pause qui suit sa dernière série, avant d'installer le suivant.
    const seb = etapesDe(jeudiSeul);
    const attentes = seb.filter((e) => e.type === 'repos' && e.motif === 'tour' && e.exerciceId === 'trap-bar-deadlift');
    expect(attentes.length).toBeGreaterThan(0);
    expect(attentes.every(pauseAEtirement)).toBe(true);
    const installations = seb.filter((e) => e.type === 'repos' && e.manuel);
    expect(installations.map(pauseAEtirement)).toEqual(
      installations.map((_, g) => g > 0 && jeudiSeul.exercices[g - 1] === 'trap-bar-deadlift'),
    );
    // Seul : les deux minutes de la trap bar, jamais la minute trente des autres.
    const seul = construireEtapes(seancePourPersonne(jeudiSeul, parametres, { personne: 'sebastien' }));
    const grossesPauses = avecEtirement(seul).filter((e) => !(e.type === 'repos' && e.manuel));
    expect(grossesPauses.length).toBe(2);
    expect(grossesPauses.every((e) => e.exerciceId === 'trap-bar-deadlift' && e.dureeSec === 120)).toBe(true);
    // En paire : les deux minutes après la paire de la trap bar, jamais la
    // minute des autres paires.
    const enPaire = construireEtapes(seancePourPersonne(jeudiMois, parametres, { personne: 'sebastien' }));
    const apresPaire = avecEtirement(enPaire).filter((e) => !(e.type === 'repos' && e.manuel));
    expect(apresPaire.length).toBe(2);
    expect(apresPaire.every((e) => e.exerciceId === jeudiMois.exercices[1] && e.dureeSec === 120)).toBe(true);
  });

  it('« Passer l’exercice » passe la paire et mène à l’installation de la suivante', () => {
    const etapes = etapesDe();
    const premiereSerie = etapes.findIndex((e) => e.type === 'serie');
    const apres = etapes[indexApresExercice(etapes, premiereSerie)];
    expect(apres).toMatchObject({ type: 'repos', manuel: true, motif: 'installation' });
    expect(apres.exerciceId).toBe(jeudiMois.exercices[2]);
  });
});
