import { describe, expect, it } from 'vitest';
import { basculerPasAimeDe, lirePasAimes, pasAime, pasAimesDe, quiNAimePas } from './pasAimes';

const QUAND = new Date('2026-10-13T12:00:00.000Z');

describe('👎 « Pas aimé »', () => {
  it('se dit et se retire d’un toucher, pour l’un ou pour l’autre, sans toucher aux siens', () => {
    const avecMax = basculerPasAimeDe({}, 'autre', 'bench-press', QUAND);
    expect(avecMax).toEqual({ pasAimesAutre: { 'bench-press': QUAND.toISOString() } });
    expect(pasAime(avecMax, 'autre', 'bench-press')).toBe(true);
    expect(pasAime(avecMax, 'moi', 'bench-press')).toBe(false);
    const lesDeux = { ...avecMax, ...basculerPasAimeDe(avecMax, 'moi', 'bench-press', QUAND) };
    expect(pasAimesDe(lesDeux, 'moi')).toEqual({ 'bench-press': QUAND.toISOString() });
    // Retiré pour l'un : l'autre le garde ; aucun, plus de champ.
    const retire = { ...lesDeux, ...basculerPasAimeDe(lesDeux, 'autre', 'bench-press') };
    expect(retire.pasAimesAutre).toBeUndefined();
    expect(pasAime(retire, 'moi', 'bench-press')).toBe(true);
    // Un nom hérité de tout objet n'est pas un exercice.
    expect(pasAime({ pasAimes: {} }, 'moi', 'constructor')).toBe(false);
  });

  it('dit qui ne l’a pas aimé, parmi ceux qui s’entraînent ici, Speedy d’abord', () => {
    const etat = { pasAimes: { curl: 'x', 'bench-press': 'x' }, pasAimesAutre: { 'bench-press': 'x' } };
    // Sur le téléphone de Big Max, avec Speedy : Speedy d'abord.
    expect(quiNAimePas(etat, 'bench-press', 'max', 'sebastien')).toEqual(['sebastien', 'max']);
    expect(quiNAimePas(etat, 'curl', 'max', 'sebastien')).toEqual(['max']);
    // Seul : ceux de l'autre ne comptent pas.
    expect(quiNAimePas(etat, 'bench-press', 'max', null)).toEqual(['max']);
    // Personne de connu sur ce téléphone : sans nom.
    expect(quiNAimePas(etat, 'curl', null, null)).toEqual([null]);
    expect(quiNAimePas(etat, 'squat', 'sebastien', 'max')).toEqual([]);
  });

  it('se relit d’une sauvegarde : rien d’avant, rien d’abîmé', () => {
    expect(lirePasAimes(undefined)).toBeUndefined();
    expect(lirePasAimes(['bench-press'])).toBeUndefined();
    expect(lirePasAimes({})).toBeUndefined();
    expect(lirePasAimes({ 'bench-press': '2026-10-13', curl: 3 })).toEqual({ 'bench-press': '2026-10-13' });
  });
});
