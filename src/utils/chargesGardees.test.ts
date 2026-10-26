import { describe, expect, it } from 'vitest';
import { ETAT_PAR_DEFAUT } from './storage';
import { avecChargesGardees } from './chargesGardees';
import { chargesPassees } from './programmeMois';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import type { ProgressionSeance, Seance, SeanceRealisee } from '../types';

const seance = { id: 's', creeLe: '2026-10-27T10:00:00Z', parametres: { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' }, blocs: [] } as unknown as Seance;
const progression = (poids: Record<string, number[]>): ProgressionSeance =>
  ({ seance, poids, ressentis: {}, demarreeLe: '2026-10-27T10:00:00Z', sauvegardeeLe: '2026-10-27T10:20:00Z' }) as unknown as ProgressionSeance;

describe('charges gardées dès la saisie', () => {
  it('une série notée est gardée sans enregistrer la séance, et ressort à la prochaine fois', () => {
    const etat = avecChargesGardees(ETAT_PAR_DEFAUT, progression({ 'incline-bench-press': [40, 0, 0] }));
    expect(etat.chargesGardees?.['incline-bench-press'].poids).toEqual([40, 0, 0]);
    // la séance est abandonnée : enCours disparaît, les charges restent
    const apres = { ...etat, enCours: null };
    expect(chargesPassees(apres.historique, ['incline-bench-press'], 'lb', apres.chargesGardees)['incline-bench-press']).toEqual([40, 0, 0]);
  });

  it("rien de nouveau : même état ; l'historique plus récent garde la main", () => {
    const a = avecChargesGardees(ETAT_PAR_DEFAUT, progression({ x: [10] }));
    expect(avecChargesGardees(a, progression({ x: [10] }))).toBe(a);
    const h = {
      date: '2026-10-28T10:00:00Z',
      parametres: { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' },
      exercices: [{ exerciceId: 'x', seriesFaites: 3, poidsParSerie: [20, 20, 20] }],
    } as unknown as SeanceRealisee;
    expect(chargesPassees([h], ['x'], 'lb', a.chargesGardees).x).toEqual([20, 20, 20]);
  });
});
