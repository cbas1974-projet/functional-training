import { describe, expect, it } from 'vitest';
import type { ExerciceRealise, SeanceDuMois, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { faiteCetteSemaine, faiteLe } from './programmeMois';
import { assezFaite } from './statistiques';
import { choixDeSortie, compteSeries, phraseEnregistrementPartiel } from './sortieSeance';

const exo = (seriesFaites: number, seriesPrevues: number): ExerciceRealise => ({
  exerciceId: 'leg-press',
  seriesFaites,
  seriesPrevues,
  reps: 10,
  dureeSec: 60,
});

const realisee = (exercices: ExerciceRealise[], date = new Date(2026, 9, 12, 9)): SeanceRealisee => ({
  id: 'r',
  date: date.toISOString(),
  titre: 'Lundi A',
  parametres: PARAMETRES_PAR_DEFAUT,
  dureePrevueSec: 4800,
  dureeReelleSec: 600,
  exercices,
  terminee: false,
});

describe('quitter une séance en cours', () => {
  it('trois réponses et « Continuer » ; « Enregistrer » seulement avec une série faite', () => {
    expect(choixDeSortie({ essai: false, seriesFaites: 5 })).toEqual(['plus-tard', 'enregistrer', 'jeter', 'continuer']);
    expect(choixDeSortie({ essai: false, seriesFaites: 0 })).toEqual(['plus-tard', 'jeter', 'continuer']);
    // Un essai ne garde rien : on le quitte, ou on continue.
    expect(choixDeSortie({ essai: true, seriesFaites: 3 })).toEqual(['jeter', 'continuer']);
  });

  it('dit ce qui sera gardé, et si la journée sera cochée', () => {
    const une = realisee([exo(1, 3), exo(0, 3), exo(0, 15)]);
    expect(compteSeries(une)).toEqual({ faites: 1, prevues: 21 });
    expect(phraseEnregistrementPartiel(une)).toBe(
      '1 série sur 21 : gardées dans l’historique, mais la journée ne sera pas cochée (moins de la moitié).',
    );
    expect(phraseEnregistrementPartiel(realisee([exo(3, 3), exo(3, 3), exo(5, 15)]))).toBe('11 séries sur 21 : la journée sera cochée.');
  });
});

describe('la journée cochée « faite »', () => {
  const lundi: Pick<SeanceDuMois, 'nom'> = { nom: 'Lundi A' };
  const jour = new Date(2026, 9, 12, 18);

  it('à partir de la moitié des séries prévues', () => {
    expect(assezFaite(realisee([exo(1, 21)]))).toBe(false);
    expect(assezFaite(realisee([exo(10, 21)]))).toBe(false);
    expect(assezFaite(realisee([exo(11, 21)]))).toBe(true);
    expect(assezFaite(realisee([exo(3, 3), exo(0, 3)]))).toBe(true);
    // Sans série prévue (séances d'avant, sans compte) : cochée.
    expect(assezFaite(realisee([]))).toBe(true);
  });

  it('une séance quittée après 1 série sur 21 reste à faire, sur l’accueil et dans la semaine', () => {
    const quittee = [realisee([exo(1, 3), exo(0, 18)])];
    expect(faiteLe(quittee, lundi, jour)).toBe(false);
    expect(faiteCetteSemaine(quittee, lundi, jour)).toBe(false);
    const moitie = [realisee([exo(3, 3), exo(8, 18)])];
    expect(faiteLe(moitie, lundi, jour)).toBe(true);
    expect(faiteCetteSemaine(moitie, lundi, jour)).toBe(true);
  });
});
