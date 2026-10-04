import { describe, expect, it } from 'vitest';
import type { EntrainementState, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { avecSeanceFaite, sansSeance } from './enLigne';
import { genererProgramme } from './programmeMois';
import { ETAT_PAR_DEFAUT } from './storage';

const programme = {
  ...genererProgramme({ graine: 4, aujourdhui: new Date(2026, 9, 5) }),
  serveur: 'https://srv123.hstgr.cloud',
};
const etat: EntrainementState = { ...ETAT_PAR_DEFAUT, programme, personne: 'sebastien' };
const seance: SeanceRealisee = {
  id: 'mg1x2y3-abc123',
  date: '2026-10-08T14:00:00.000Z',
  parametres: PARAMETRES_PAR_DEFAUT,
  dureePrevueSec: 3300,
  dureeReelleSec: 3400,
  exercices: [],
  terminee: true,
};

describe('les séances et le serveur', () => {
  it('une séance faite part au serveur ; supprimée, elle en est effacée', () => {
    const apres = avecSeanceFaite({ ...etat, aEnvoyer: ['plus-ancienne'] }, seance);
    expect(apres.historique[0]).toBe(seance);
    expect(apres.enCours).toBeNull();
    expect(apres.aEnvoyer).toEqual(['plus-ancienne', seance.id]);
    const retiree = sansSeance(apres, seance.id);
    expect(retiree.historique).toEqual([]);
    expect(retiree.aEnvoyer).toEqual(['plus-ancienne']);
    expect(retiree.aEffacer).toEqual([seance.id]);
  });

  it('sans serveur, ou sans savoir qui s’entraîne, tout reste sur le téléphone', () => {
    for (const ici of [{ ...etat, programme: { ...programme, serveur: undefined } }, { ...etat, personne: null }]) {
      const apres = avecSeanceFaite(ici, seance);
      expect(apres.historique).toEqual([seance]);
      expect(apres.aEnvoyer).toEqual([]);
      expect(sansSeance(apres, seance.id).aEffacer).toEqual([]);
    }
  });
});
