import { beforeEach, describe, expect, it } from 'vitest';
import type { EntrainementState } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { chargerEtat, enregistrerEtat } from './storage';

const CLE = 'functional-training';

/** Les tests tournent sans navigateur : un localStorage en mémoire suffit,
 *  et évite d'ajouter jsdom pour quatre assertions. */
class StockageMemoire implements Storage {
  private donnees = new Map<string, string>();
  get length(): number {
    return this.donnees.size;
  }
  clear(): void {
    this.donnees.clear();
  }
  getItem(cle: string): string | null {
    return this.donnees.get(cle) ?? null;
  }
  key(index: number): string | null {
    return [...this.donnees.keys()][index] ?? null;
  }
  removeItem(cle: string): void {
    this.donnees.delete(cle);
  }
  setItem(cle: string, valeur: string): void {
    this.donnees.set(cle, valeur);
  }
}

globalThis.localStorage = new StockageMemoire();

/** Progression telle qu'une version antérieure l'écrivait : une seule charge
 *  par exercice, pas une par série. */
const ANCIENNE_SAUVEGARDE = {
  parametres: { ...PARAMETRES_PAR_DEFAUT, format: 'series' },
  seanceCourante: null,
  historique: [],
  enCours: {
    seance: { id: 's', creeLe: '', parametres: PARAMETRES_PAR_DEFAUT, graine: 1, echauffementSec: 60, retourCalmeSec: 60, blocs: [], circuit: null, dureeEstimeeSec: 120 },
    indexEtape: 3,
    tempsCumuleSec: 200,
    tempsParEtapeSec: [60, 5, 80],
    poids: { 'goblet-squat': 16, 'hammer-curl': 0 },
    demarreeLe: '2026-09-20T10:00:00.000Z',
  },
};

describe('chargerEtat', () => {
  beforeEach(() => localStorage.clear());

  it('convertit une charge unique en charge de première série', () => {
    localStorage.setItem(CLE, JSON.stringify(ANCIENNE_SAUVEGARDE));
    const etat = chargerEtat();
    expect(etat.enCours?.poids).toEqual({ 'goblet-squat': [16] });
    expect(etat.enCours?.indexEtape).toBe(3);
  });

  it('laisse intactes les charges déjà saisies série par série', () => {
    const moderne = {
      ...ANCIENNE_SAUVEGARDE,
      enCours: { ...ANCIENNE_SAUVEGARDE.enCours, poids: { 'goblet-squat': [16, 16, 18] } },
    };
    localStorage.setItem(CLE, JSON.stringify(moderne));
    expect(chargerEtat().enCours?.poids).toEqual({ 'goblet-squat': [16, 16, 18] });
  });

  it('fait l’aller-retour sans rien perdre', () => {
    const etat: EntrainementState = {
      parametres: { ...PARAMETRES_PAR_DEFAUT, format: 'superset' },
      seanceCourante: null,
      enCours: null,
      historique: [],
    };
    enregistrerEtat(etat);
    expect(chargerEtat()).toEqual(etat);
  });

  it('rend l’état par défaut quand la sauvegarde est illisible', () => {
    localStorage.setItem(CLE, '{ pas du json');
    expect(chargerEtat().parametres).toEqual(PARAMETRES_PAR_DEFAUT);
  });
});
