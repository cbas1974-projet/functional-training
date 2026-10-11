import { beforeEach, describe, expect, it } from 'vitest';
import type { EntrainementState } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { chargerEtat, enregistrerEtat } from './storage';
import { genererProgramme } from './programmeMois';

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

  it('fait l’aller-retour sans rien perdre, programme, personne et duo compris', () => {
    const etat: EntrainementState = {
      parametres: { ...PARAMETRES_PAR_DEFAUT, format: 'superset' },
      seanceCourante: null,
      enCours: null,
      historique: [],
      programme: {
        ...genererProgramme({ graine: 4, aujourdhui: new Date(2026, 9, 5) }),
        duo: { reps: { sebastien: 8, max: 12 } },
      },
      personne: 'sebastien',
      programmeARenvoyer: true,
      aDeux: false,
      aEnvoyer: ['seance-1'],
      aEffacer: ['seance-0'],
      historiqueEnvoyeA: 'https://srv123.hstgr.cloud|p1a2b3c20261005',
      mesures: [
        { id: 'mesure-1', date: '2026-08-05', poids: 185.2, unitePoids: 'lb', tailleCm: 178, age: 42 },
        { id: 'mesure-2', date: '2026-09-05', poids: 82.4, unitePoids: 'kg', tailleCm: 177.5, age: 42 },
      ],
      mesuresAEnvoyer: ['mesure-2'],
      mesuresAEffacer: ['mesure-0'],
      mesuresEnvoyeesA: 'https://srv123.hstgr.cloud|p1a2b3c20261005',
    };
    enregistrerEtat(etat);
    expect(chargerEtat()).toEqual(etat);
  });

  it('une sauvegarde d’avant les mensurations n’en a pas : des listes vides, rien d’autre ne change', () => {
    localStorage.setItem(CLE, JSON.stringify(ANCIENNE_SAUVEGARDE));
    const etat = chargerEtat();
    expect(etat.mesures).toEqual([]);
    expect(etat.mesuresAEnvoyer).toEqual([]);
    expect(etat.mesuresAEffacer).toEqual([]);
    expect(etat.mesuresEnvoyeesA).toBeUndefined();
    expect(etat.enCours?.indexEtape).toBe(3);
    // Sans aucune sauvegarde non plus.
    localStorage.clear();
    expect(chargerEtat().mesures).toEqual([]);
  });

  it('relit les mesures avec prudence : les illisibles et les doublons sont écartés, le reste est remis dans l’ordre', () => {
    const mesure = { id: 'mesure-1', date: '2026-09-05', poids: 182.4, unitePoids: 'lb', tailleCm: 178, age: 42 };
    localStorage.setItem(
      CLE,
      JSON.stringify({
        ...ANCIENNE_SAUVEGARDE,
        mesures: [
          mesure,
          { ...mesure, id: 'mesure-0', date: '2026-07-05' },
          { ...mesure, poids: 999 },
          { ...mesure, id: 'mesure-2', date: '2026-02-30' },
          { ...mesure, id: 'mesure-3', unitePoids: 'stone' },
          { id: 'mesure-4' },
          { ...mesure, poids: 100 },
          'n’importe quoi',
          null,
        ],
      }),
    );
    expect(chargerEtat().mesures?.map((m) => m.id)).toEqual(['mesure-0', 'mesure-1']);
    // La première version d'un doublon l'emporte.
    expect(chargerEtat().mesures?.[1].poids).toBe(182.4);
  });

  it('une sauvegarde qui n’a pas la forme d’une liste de mesures ne casse rien', () => {
    for (const mesures of ['beaucoup', 12, { 0: {} }, null]) {
      localStorage.setItem(CLE, JSON.stringify({ ...ANCIENNE_SAUVEGARDE, mesures }));
      expect(chargerEtat().mesures).toEqual([]);
    }
  });

  it('les files d’envoi des mesures ne gardent que des identifiants que le serveur accepte', () => {
    localStorage.setItem(
      CLE,
      JSON.stringify({
        ...ANCIENNE_SAUVEGARDE,
        mesuresAEnvoyer: ['mesure-1', 42, null, 'a b c d', 'abc', 'mesure-2'],
        mesuresAEffacer: 'mesure-1',
        mesuresEnvoyeesA: 12,
      }),
    );
    const etat = chargerEtat();
    // Un identifiant que le serveur refuserait (404) bloquerait la file pour toujours.
    expect(etat.mesuresAEnvoyer).toEqual(['mesure-1', 'mesure-2']);
    expect(etat.mesuresAEffacer).toEqual([]);
    expect(etat.mesuresEnvoyeesA).toBeUndefined();
  });

  it('s’entraîne à deux par défaut', () => {
    localStorage.setItem(CLE, JSON.stringify(ANCIENNE_SAUVEGARDE));
    expect(chargerEtat().aDeux).toBe(true);
  });

  it('écarte un programme illisible et une personne inconnue', () => {
    localStorage.setItem(
      CLE,
      JSON.stringify({ ...ANCIENNE_SAUVEGARDE, programme: { debut: 'hier' }, personne: 'quelqu’un' }),
    );
    const etat = chargerEtat();
    expect(etat.programme).toBeNull();
    expect(etat.personne).toBeNull();
  });

  it('fige en kilogrammes les séances enregistrées avant le réglage d’unité', () => {
    const ancienne = {
      ...ANCIENNE_SAUVEGARDE,
      // Séance enregistrée quand tout était en kilos : ni réglage d'unité,
      // ni champ `poids`, seulement `poidsKg`.
      parametres: { ...PARAMETRES_PAR_DEFAUT, unitePoids: undefined },
      enCours: {
        ...ANCIENNE_SAUVEGARDE.enCours,
        seance: {
          ...ANCIENNE_SAUVEGARDE.enCours.seance,
          parametres: { ...PARAMETRES_PAR_DEFAUT, unitePoids: undefined },
        },
      },
      historique: [
        {
          id: 'h1',
          date: '2026-09-01T10:00:00.000Z',
          parametres: { ...PARAMETRES_PAR_DEFAUT, unitePoids: undefined },
          dureePrevueSec: 1200,
          dureeReelleSec: 1180,
          terminee: true,
          exercices: [
            { exerciceId: 'goblet-squat', seriesPrevues: 3, seriesFaites: 3, reps: 8, dureeSec: 420, poidsKg: 16 },
          ],
        },
      ],
    };
    localStorage.setItem(CLE, JSON.stringify(ancienne));
    const etat = chargerEtat();

    const passee = etat.historique[0];
    expect(passee.parametres.unitePoids).toBe('kg');
    expect(passee.exercices[0].poids).toBe(16);
    expect(passee.exercices[0].poidsKg).toBeUndefined();
    // La séance en cours aussi : les charges déjà tapées étaient en kilos.
    expect(etat.enCours?.seance.parametres.unitePoids).toBe('kg');
    // Les nouvelles séances, elles, partent en livres.
    expect(etat.parametres.unitePoids).toBe('lb');
  });

  describe('le ressenti', () => {
    const seanceFaite = (exercices: object[]) => ({
      id: 'h1',
      date: '2026-10-08T10:00:00.000Z',
      parametres: { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' },
      dureePrevueSec: 1200,
      dureeReelleSec: 1180,
      terminee: true,
      exercices,
    });
    const exo = (extra: object = {}) => ({
      exerciceId: 'goblet-squat',
      seriesPrevues: 3,
      seriesFaites: 3,
      reps: 8,
      dureeSec: 420,
      poids: 25,
      poidsParSerie: [25, 25, 25],
      ...extra,
    });

    it('une séance d’avant le ressenti se relit telle quelle, sans ressenti', () => {
      localStorage.setItem(CLE, JSON.stringify({ ...ANCIENNE_SAUVEGARDE, historique: [seanceFaite([exo()])] }));
      const [passee] = chargerEtat().historique;
      expect(passee.exercices[0]).toEqual(exo());
      expect(passee.exercices[0].ressenti).toBeUndefined();
      expect('ressenti' in passee.exercices[0]).toBe(false);
    });

    it('garde le ressenti de chaque exercice, et le restitue après un aller-retour', () => {
      const brut = [exo({ ressenti: 'leger' }), exo({ exerciceId: 'curl', ressenti: 'lourd' }), exo({ exerciceId: 'bench-press', ressenti: 'correct' })];
      localStorage.setItem(CLE, JSON.stringify({ ...ANCIENNE_SAUVEGARDE, historique: [seanceFaite(brut)] }));
      const etat = chargerEtat();
      expect(etat.historique[0].exercices.map((e) => e.ressenti)).toEqual(['leger', 'lourd', 'correct']);
      enregistrerEtat(etat);
      expect(chargerEtat().historique[0].exercices.map((e) => e.ressenti)).toEqual(['leger', 'lourd', 'correct']);
    });

    it('écarte un ressenti qu’on ne connaît pas, sans rien perdre d’autre', () => {
      const brut = [exo({ ressenti: 'difficile' }), exo({ exerciceId: 'curl', ressenti: 3 }), exo({ exerciceId: 'bench-press', ressenti: null })];
      localStorage.setItem(CLE, JSON.stringify({ ...ANCIENNE_SAUVEGARDE, historique: [seanceFaite(brut)] }));
      const exercices = chargerEtat().historique[0].exercices;
      expect(exercices.map((e) => e.ressenti)).toEqual([undefined, undefined, undefined]);
      expect(exercices.map((e) => e.poids)).toEqual([25, 25, 25]);
    });

    it('la séance en cours reprend ses ressentis ; une séance commencée avant eux n’en a pas', () => {
      const enCours = (ressentis?: unknown) => ({
        ...ANCIENNE_SAUVEGARDE,
        enCours: { ...ANCIENNE_SAUVEGARDE.enCours, ...(ressentis === undefined ? {} : { ressentis }) },
      });
      localStorage.setItem(CLE, JSON.stringify(enCours({ 'goblet-squat': 'leger', curl: 'trop', 'hammer-curl': 'lourd' })));
      expect(chargerEtat().enCours?.ressentis).toEqual({ 'goblet-squat': 'leger', 'hammer-curl': 'lourd' });
      localStorage.setItem(CLE, JSON.stringify(enCours()));
      expect(chargerEtat().enCours?.ressentis).toEqual({});
      localStorage.setItem(CLE, JSON.stringify(enCours('léger')));
      expect(chargerEtat().enCours?.ressentis).toEqual({});
    });
  });

  it('rend l’état par défaut quand la sauvegarde est illisible', () => {
    localStorage.setItem(CLE, '{ pas du json');
    expect(chargerEtat().parametres).toEqual(PARAMETRES_PAR_DEFAUT);
  });
});
