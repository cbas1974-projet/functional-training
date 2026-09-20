import { describe, expect, it } from 'vitest';
import { ajouterTemps, reducteurMoteur } from './useMoteurEtapes';
import type { ActionMoteur, EtatMoteur } from './useMoteurEtapes';

/** Instant de référence (en millisecondes). */
const T0 = 1_700_000_000_000;

function derouler(actions: ActionMoteur[]): EtatMoteur {
  const etat = actions.reduce<EtatMoteur | null>(reducteurMoteur, null);
  if (!etat) throw new Error('moteur non démarré');
  return etat;
}

describe('ajouterTemps', () => {
  it('cumule à l’index voulu sans laisser de trou', () => {
    expect(ajouterTemps([], 2, 4.5)).toEqual([0, 0, 4.5]);
    expect(ajouterTemps([10, 5], 1, 2)).toEqual([10, 7]);
    expect(ajouterTemps([1, Number.NaN], 1, 2)).toEqual([1, 2]);
  });
});

describe('reducteurMoteur', () => {
  it('démarre à l’étape demandée avec les temps déjà crédités', () => {
    const etat = derouler([{ type: 'demarrer', now: T0, index: 3, tempsParEtapeSec: [120, 5, 80] }]);
    expect(etat).toEqual({
      index: 3,
      visite: 1,
      debutEtapeMs: T0,
      enPause: false,
      pauseDepuisMs: 0,
      prolongationSec: 0,
      tempsParEtapeSec: [120, 5, 80],
    });
  });

  it('ignore les actions tant que rien n’a démarré', () => {
    expect(reducteurMoteur(null, { type: 'pause', now: T0 })).toBeNull();
    expect(reducteurMoteur(null, { type: 'allerA', now: T0, index: 2 })).toBeNull();
  });

  it('crédite le temps écoulé à l’étape quittée et repart de zéro', () => {
    const etat = derouler([
      { type: 'demarrer', now: T0, index: 0, tempsParEtapeSec: [] },
      { type: 'allerA', now: T0 + 12_500, index: 1 },
    ]);
    expect(etat.index).toBe(1);
    expect(etat.visite).toBe(2);
    expect(etat.debutEtapeMs).toBe(T0 + 12_500);
    expect(etat.tempsParEtapeSec).toEqual([12.5]);
  });

  it('comble les étapes sautées par des zéros et cumule les revisites', () => {
    const etat = derouler([
      { type: 'demarrer', now: T0, index: 0, tempsParEtapeSec: [] },
      { type: 'allerA', now: T0 + 10_000, index: 4 },
      { type: 'allerA', now: T0 + 15_000, index: 0 },
      { type: 'allerA', now: T0 + 18_000, index: 1 },
    ]);
    expect(etat.tempsParEtapeSec).toEqual([13, 0, 0, 0, 5]);
    expect(etat.index).toBe(1);
  });

  it('ne compte pas le temps de pause', () => {
    const etat = derouler([
      { type: 'demarrer', now: T0, index: 0, tempsParEtapeSec: [] },
      { type: 'pause', now: T0 + 4_000 },
      // Une seconde pause pendant la pause est sans effet.
      { type: 'pause', now: T0 + 5_000 },
      { type: 'reprendre', now: T0 + 34_000 },
      { type: 'allerA', now: T0 + 40_000, index: 1 },
    ]);
    // 4 s avant la pause + 6 s après : 10 s, pas 40.
    expect(etat.tempsParEtapeSec).toEqual([10]);
    expect(etat.enPause).toBe(false);
  });

  it('gèle l’étape quittée et la nouvelle étape quand on navigue en pause', () => {
    const etat = derouler([
      { type: 'demarrer', now: T0, index: 0, tempsParEtapeSec: [] },
      { type: 'pause', now: T0 + 3_000 },
      { type: 'allerA', now: T0 + 60_000, index: 1 },
    ]);
    expect(etat.tempsParEtapeSec).toEqual([3]);
    expect(etat.enPause).toBe(true);
    // La nouvelle étape attend la reprise à zéro seconde…
    expect(etat.pauseDepuisMs - etat.debutEtapeMs).toBe(0);
    // …et repart de zéro à la reprise, quel que soit le temps de pause.
    const repris = reducteurMoteur(etat, { type: 'reprendre', now: T0 + 90_000 });
    expect(repris?.debutEtapeMs).toBe(T0 + 90_000);
  });

  it('prolonge l’étape courante et oublie la prolongation à l’étape suivante', () => {
    const prolonge = derouler([
      { type: 'demarrer', now: T0, index: 0, tempsParEtapeSec: [] },
      { type: 'prolonger', sec: 15 },
      { type: 'prolonger', sec: 15 },
    ]);
    expect(prolonge.prolongationSec).toBe(30);
    const suivante = reducteurMoteur(prolonge, { type: 'allerA', now: T0 + 1_000, index: 1 });
    expect(suivante?.prolongationSec).toBe(0);
  });

  it('ne fait rien pour une navigation vers l’étape courante', () => {
    const etat = derouler([{ type: 'demarrer', now: T0, index: 2, tempsParEtapeSec: [] }]);
    expect(reducteurMoteur(etat, { type: 'allerA', now: T0 + 5_000, index: 2 })).toBe(etat);
    expect(reducteurMoteur(etat, { type: 'reprendre', now: T0 + 5_000 })).toBe(etat);
  });
});
