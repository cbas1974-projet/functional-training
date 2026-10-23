import { describe, expect, it } from 'vitest';
import { EXERCICES_PAR_ID } from '../data/exercices';
import {
  PROGRAMME_SUR_MESURE,
  VERSION_PROGRAMME,
  decoderProgramme,
  encoderProgramme,
  genererProgramme,
  programmeDansLien,
  validerProgramme,
} from './programmeMois';

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
        'cossack-squat', 'incline-row', 'leg-extension-machine', 'leg-curl-machine',
        'kb-single-arm-row', 'kb-wall-squat-press', 'kb-double-arm-swing',
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
    expect(seance(1, 'lundi').exercices.at(-1)).toBe('trap-bar-deadlift');
    expect(seance(1, 'mardi-a').liens![0]).toEqual(['seated-calf-raise', 'chest-squeeze-press']);
    expect(seance(1, 'mardi-b').finale).toBe('kb-tricep-extension');
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
});
