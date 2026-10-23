import { describe, expect, it } from 'vitest';
import { EXERCICES_PAR_ID } from '../data/exercices';
import {
  PROGRAMME_SUR_MESURE,
  VERSION_PROGRAMME,
  chargesPassees,
  decoderProgramme,
  encoderProgramme,
  genererProgramme,
  programmeDansLien,
  validerProgramme,
} from './programmeMois';
import type { SeanceRealisee } from '../types';

const seance = (graine: number, id: string) => genererProgramme({ graine, aujourdhui: new Date(2026, 9, 19) }).seances.find((s) => s.id === id)!;

describe('le programme sur mesure (22 octobre 2026)', () => {
  it('le Jeudi A : exactement les paires, le seul et le dernier voulus, quelle que soit la graine', () => {
    for (const graine of [1, 7, 123456, 0xffffffff]) {
      const jeudi = seance(graine, 'jeudi-a');
      expect(jeudi.jour).toBe(4);
      expect(jeudi.semaine).toBe('A');
      expect(jeudi.liens).toEqual([
        ['cossack-squat', 'incline-row'],
        ['leg-extension-machine', 'leg-curl-machine'],
        ['kb-single-arm-row', 'kb-wall-squat-press'],
      ]);
      expect(jeudi.exercices).toEqual([
        'kb-double-arm-swing', 'cossack-squat', 'incline-row', 'leg-extension-machine', 'leg-curl-machine',
        'kb-single-arm-row', 'kb-wall-squat-press',
      ]);
      expect(jeudi.finale).toBe('hammer-curl');
      expect(jeudi.tour).toEqual(['leg-extension-machine', 'leg-curl-machine']);
    }
  });

  it('le Jeudi B, le lundi et les mardis', () => {
    const b = seance(1, 'jeudi-b');
    expect(b.liens).toEqual([
      ['cossack-squat', 'alternating-front-raise'],
      ['leg-extension-machine', 'leg-curl-machine'],
      ['reverse-fly', 'band-pull-apart'],
    ]);
    expect(b.finale).toBe('fire-hydrant');
    expect(seance(1, 'lundi').finale).toBe('hack-squat');
    expect(seance(1, 'lundi').exercices[0]).toBe('trap-bar-deadlift');
    expect(seance(1, 'mardi-a').liens![0]).toEqual(['seated-calf-raise', 'chest-squeeze-press']);
    expect(seance(1, 'mardi-b').finale).toBe('kb-tricep-extension');
  });

  it('les 5 séances : le seul au début, puis les paires, puis le dernier seul en finale', () => {
    expect(PROGRAMME_SUR_MESURE).toHaveLength(5);
    for (const s of PROGRAMME_SUR_MESURE) {
      const id = s.semaine ? `${s.jourNom}-${s.semaine.toLowerCase()}` : s.jourNom;
      const seanceDuMois = seance(1, id);
      expect(seanceDuMois.exercices, id).toEqual([...s.seuls, ...s.paires.flat()]);
      expect(seanceDuMois.finale, id).toBe(s.dernier);
    }
  });

  it('tous les exercices existent', () => {
    for (const s of PROGRAMME_SUR_MESURE) {
      for (const id of [...s.paires.flat(), ...s.seuls, s.dernier]) expect(EXERCICES_PAR_ID[id], id).toBeDefined();
    }
  });

  it('le lien court redonne le programme ; un programme de la version 11 passe au sur mesure', () => {
    const programme = genererProgramme({ graine: 42, aujourdhui: new Date(2026, 9, 19) });
    expect(decoderProgramme(encoderProgramme(programme))).toEqual(programme);
    const ancien = validerProgramme({ ...programme, version: 11, seances: programme.seances.map((s) => ({ ...s, exercices: [...s.exercices] })) });
    expect(ancien?.version).toBe(VERSION_PROGRAMME);
    expect(ancien?.seances.find((s) => s.id === 'jeudi-a')?.finale).toBe('hammer-curl');
    expect(ancien?.graine).toBe(42);
    expect(ancien?.debut).toBe(programme.debut);
    expect(programmeDansLien('#x', null)).toBeNull();
  });

  it('un programme de la version 12 passe à la 13 : même graine, même premier lundi, mêmes exercices, charges gardées', () => {
    const programme = genererProgramme({ graine: 42, aujourdhui: new Date(2026, 9, 19) });
    // Le Jeudi A tel que la version 12 l'ordonnait : les paires, puis le seul.
    const v12 = {
      ...programme,
      version: 12,
      seances: programme.seances.map((s) => (s.id === 'jeudi-a'
        ? { ...s, exercices: [...s.exercices.slice(1), s.exercices[0]] }
        : { ...s, exercices: [...s.exercices] })),
    };
    const mis = validerProgramme(v12)!;
    expect(mis.version).toBe(13);
    expect(mis.graine).toBe(42);
    expect(mis.debut).toBe(programme.debut);
    expect(mis.debut).toMatch(/^2026-10-19/);
    const jeudi = mis.seances.find((s) => s.id === 'jeudi-a')!;
    expect(jeudi.exercices[0]).toBe('kb-double-arm-swing');
    expect(jeudi.finale).toBe('hammer-curl');
    for (const s of v12.seances) {
      const apres = mis.seances.find((x) => x.id === s.id)!;
      expect([...apres.exercices].sort(), s.id).toEqual([...s.exercices].sort());
    }
    // L'historique vit à part, par exercice : les charges de la dernière fois restent.
    const historique = [{
      id: 'h1', date: '2026-10-22T10:00:00', titre: jeudi.nom, parametres: { unitePoids: 'lb' },
      exercices: [{ exerciceId: 'kb-double-arm-swing', seriesFaites: 3, poidsParSerie: [35, 35, 44] }],
    }] as unknown as SeanceRealisee[];
    expect(chargesPassees(historique, jeudi.exercices, 'lb')).toEqual({ 'kb-double-arm-swing': [35, 35, 44] });
  });
});
