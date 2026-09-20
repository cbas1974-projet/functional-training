import { describe, expect, it } from 'vitest';
import type { ExerciceRealise, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import {
  frequenceExercice,
  frequencesParExercice,
  libelleFrequenceCourte,
  libellePoidsParSerie,
} from './statistiques';

const MAINTENANT = Date.parse('2026-09-20T12:00:00.000Z');
const JOUR = 24 * 60 * 60 * 1000;

function ilYA(jours: number): string {
  return new Date(MAINTENANT - jours * JOUR).toISOString();
}

function seance(date: string, exercices: Partial<ExerciceRealise>[]): SeanceRealisee {
  return {
    id: date,
    date,
    parametres: PARAMETRES_PAR_DEFAUT,
    dureePrevueSec: 1200,
    dureeReelleSec: 1200,
    terminee: true,
    exercices: exercices.map((exo) => ({
      exerciceId: 'goblet-squat',
      seriesPrevues: 3,
      seriesFaites: 3,
      reps: 8,
      dureeSec: 400,
      ...exo,
    })),
  };
}

const HISTORIQUE: SeanceRealisee[] = [
  seance(ilYA(3), [{ exerciceId: 'goblet-squat', poidsKg: 16 }, { exerciceId: 'hammer-curl' }]),
  seance(ilYA(20), [{ exerciceId: 'goblet-squat', poidsKg: 18, seriesFaites: 2 }]),
  seance(ilYA(60), [{ exerciceId: 'goblet-squat', poidsKg: 14 }]),
  seance(ilYA(150), [{ exerciceId: 'goblet-squat' }]),
  seance(ilYA(400), [{ exerciceId: 'goblet-squat' }, { exerciceId: 'farmers-walk' }]),
  // Exercice prévu mais jamais entamé : il ne compte pas.
  seance(ilYA(1), [{ exerciceId: 'v-up', seriesFaites: 0 }]),
];

describe('frequencesParExercice', () => {
  it('compte les séances par fenêtre glissante', () => {
    const squat = frequenceExercice(HISTORIQUE, 'goblet-squat', MAINTENANT);
    expect(squat.parFenetre[30]).toBe(2);
    expect(squat.parFenetre[90]).toBe(3);
    expect(squat.parFenetre[180]).toBe(4);
    expect(squat.total).toBe(5);
    expect(squat.seriesTrenteJours).toBe(5);
  });

  it('retient la dernière fois et les charges', () => {
    const squat = frequenceExercice(HISTORIQUE, 'goblet-squat', MAINTENANT);
    expect(squat.derniereDate).toBe(ilYA(3));
    // La dernière charge est celle de la séance la plus récente, pas la plus lourde.
    expect(squat.dernierPoidsKg).toBe(16);
    expect(squat.poidsMaxKg).toBe(18);
  });

  it('ignore un exercice prévu mais jamais entamé', () => {
    expect(frequencesParExercice(HISTORIQUE, MAINTENANT).has('v-up')).toBe(false);
    const vup = frequenceExercice(HISTORIQUE, 'v-up', MAINTENANT);
    expect(vup.total).toBe(0);
    expect(vup.parFenetre[30]).toBe(0);
  });

  it('rend tout à zéro pour un exercice jamais fait', () => {
    const jamais = frequenceExercice([], 'goblet-squat', MAINTENANT);
    expect(jamais).toEqual({
      parFenetre: { 30: 0, 90: 0, 180: 0 },
      total: 0,
      seriesTrenteJours: 0,
    });
  });

  it('survit à une date illisible', () => {
    const casse = [...HISTORIQUE, seance('pas-une-date', [{ exerciceId: 'goblet-squat' }])];
    expect(frequenceExercice(casse, 'goblet-squat', MAINTENANT).total).toBe(5);
  });
});

describe('libelleFrequenceCourte', () => {
  it('donne la fenêtre la plus proche qui contient quelque chose', () => {
    expect(libelleFrequenceCourte(frequenceExercice(HISTORIQUE, 'goblet-squat', MAINTENANT))).toBe(
      '2× ce mois-ci',
    );
    expect(libelleFrequenceCourte(frequenceExercice(HISTORIQUE, 'farmers-walk', MAINTENANT))).toBe(
      '1× il y a plus de 6 mois',
    );
    expect(libelleFrequenceCourte(frequenceExercice([], 'v-up', MAINTENANT))).toBe('jamais fait');
  });
});

describe('libellePoidsParSerie', () => {
  const base: ExerciceRealise = {
    exerciceId: 'goblet-squat',
    seriesPrevues: 3,
    seriesFaites: 3,
    reps: 8,
    dureeSec: 400,
  };

  it('résume une charge constante', () => {
    expect(libellePoidsParSerie({ ...base, poidsKg: 12, poidsParSerie: [12, 12, 12] })).toBe('12 kg');
  });

  it('détaille une charge qui varie', () => {
    expect(libellePoidsParSerie({ ...base, poidsKg: 14, poidsParSerie: [12, 14, 14] })).toBe(
      '12 · 14 · 14 kg',
    );
  });

  it('marque les séries non renseignées', () => {
    expect(libellePoidsParSerie({ ...base, poidsKg: 12, poidsParSerie: [0, 12] })).toBe('— · 12 kg');
  });

  it('retombe sur l’ancien format à une seule charge', () => {
    expect(libellePoidsParSerie({ ...base, poidsKg: 12 })).toBe('12 kg');
    expect(libellePoidsParSerie(base)).toBe('');
  });
});
