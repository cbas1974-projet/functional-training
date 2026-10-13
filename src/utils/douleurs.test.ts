import { describe, expect, it } from 'vitest';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { chargesDeLaSerie } from './charges';
import { basculerDouleur, basculerDouleurDe, chargeDeDouleur, douleurDe, douleursDe, lireDouleurs } from './douleurs';
import type { QuiDouleur } from './douleurs';

const ONZE = new Date('2026-10-11T12:00:00.000Z');

describe('« J’ai mal à cet exercice »', () => {
  it('se signale avec la charge de travail du moment, et s’enlève d’un second toucher', () => {
    const une = basculerDouleur(undefined, 'leg-press', 200, 'lb', ONZE);
    expect(une).toEqual({ 'leg-press': { depuis: ONZE.toISOString(), charge: 200, unite: 'lb' } });
    expect(douleurDe(une, 'leg-press')).toEqual(une['leg-press']);
    expect(douleurDe(une, 'hack-squat')).toBeNull();
    // Les autres ne bougent pas.
    const deux = basculerDouleur(une, 'hack-squat', 0, 'lb', ONZE);
    expect(deux).toEqual({ ...une, 'hack-squat': { depuis: ONZE.toISOString() } });
    expect(basculerDouleur(deux, 'leg-press', 999, 'lb', ONZE)).toEqual({ 'hack-squat': { depuis: ONZE.toISOString() } });
    // L'original n'est pas touché.
    expect(Object.keys(une)).toEqual(['leg-press']);
  });

  it('la charge retenue, dans l’unité de la séance ; rien si on ne la connaissait pas', () => {
    expect(chargeDeDouleur({ depuis: '', charge: 200, unite: 'lb' }, 'lb')).toBe(200);
    expect(chargeDeDouleur({ depuis: '', charge: 200, unite: 'lb' }, 'kg')).toBe(90.5);
    expect(chargeDeDouleur({ depuis: '', charge: 50, unite: 'kg' }, 'lb')).toBe(110);
    expect(chargeDeDouleur({ depuis: '' }, 'lb')).toBe(0);
    expect(chargeDeDouleur(null, 'lb')).toBe(0);
  });

  it('se relit d’une sauvegarde : ce qui ne se lit plus est écarté', () => {
    expect(lireDouleurs(undefined)).toEqual({});
    expect(lireDouleurs(['leg-press'])).toEqual({});
    expect(
      lireDouleurs({
        a: { depuis: 'x', charge: 100, unite: 'lb' },
        b: { depuis: 'x', charge: 100 },
        c: { depuis: 'x', charge: -1, unite: 'kg' },
        d: { charge: 100, unite: 'lb' },
        e: 'oui',
      }),
    ).toEqual({ a: { depuis: 'x', charge: 100, unite: 'lb' }, b: { depuis: 'x' }, c: { depuis: 'x' } });
  });

  it('à deux sur un téléphone : la douleur de Big Max ne touche que ses charges ; celles de Speedy suivent leur cours', () => {
    // Big Max a mal au développé couché, à 100 lb.
    const etat = basculerDouleurDe({ douleurs: {} }, 'autre', 'bench-press', 100, 'lb', ONZE);
    expect(etat).toEqual({ douleursAutre: { 'bench-press': { depuis: ONZE.toISOString(), charge: 100, unite: 'lb' } } });
    const charges = (qui: QuiDouleur, passees: number[], serie: number) =>
      chargesDeLaSerie({
        exercice: EXERCICES_PAR_ID['bench-press'],
        saisies: [],
        passees,
        serie,
        unite: 'lb',
        douleur: douleurDe(douleursDe(etat, qui), 'bench-press'),
      });
    // Lui : 70 % de ses 100 lb, à chaque série.
    for (const serie of [1, 2, 3]) expect(charges('autre', [100, 100, 100], serie)).toMatchObject({ pleine: 100, proposee: 70 });
    // Speedy, au même exercice : sa charge, entière.
    for (const serie of [1, 2, 3]) expect(charges('moi', [135, 135, 135], serie)).toMatchObject({ pleine: 135, proposee: 135 });
  });
});
