import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntrainementState, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { avecSeanceFaite, effacerRealisation, envoyerRealisation, historiqueQuiTient, sansSeance } from './enLigne';
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

  it('le téléphone garde des années de séances, et n’oublie les plus vieilles qu’une fois sa place pleine', () => {
    // Une séance ordinaire : sept exercices notés série par série.
    const notee = (n: number): SeanceRealisee => ({
      ...seance,
      id: `seance-${n}`,
      exercices: Array.from({ length: 7 }, (_, i) => ({
        exerciceId: `exercice-${i}`,
        seriesPrevues: 3,
        seriesFaites: 3,
        reps: 8,
        dureeSec: 412,
        poids: 135,
        poidsParSerie: [135, 135, 135],
      })),
    });
    // Du plus récent au plus ancien, comme l'historique.
    const historique = Array.from({ length: 699 }, (_, n) => notee(n + 1));
    const apres = avecSeanceFaite({ ...etat, historique }, notee(0));
    expect(apres.historique).toHaveLength(700);
    expect(apres.historique.at(-1)?.id).toBe('seance-699');
    // Place pour dix séances : les dix plus récentes restent.
    const dix = historiqueQuiTient(apres.historique, 10 * JSON.stringify(notee(0)).length);
    expect(dix.map((s) => s.id)).toEqual(apres.historique.slice(0, 10).map((s) => s.id));
    // Une séance trop grosse pour la place reste quand même : on ne perd pas la dernière.
    expect(historiqueQuiTient([notee(0)], 10)).toHaveLength(1);
  });
});

describe('quand le serveur refuse', () => {
  const partage = { serveur: 'https://srv123.hstgr.cloud', equipe: 'equipe-essai-1234', personne: 'sebastien' } as const;
  /** Un serveur qui répond toujours ce statut ; `null`, un réseau qui ne passe pas. */
  const serveurRepond = (statut: number | null) =>
    vi.stubGlobal('fetch', () =>
      statut === null ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(new Response('{}', { status: statut })),
    );
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('une séance reçue, ou refusée pour de bon, est réglée : inutile de la renvoyer', async () => {
    for (const statut of [200, 400]) {
      serveurRepond(statut);
      expect(await envoyerRealisation(partage, seance)).toBe(true);
    }
  });

  it('« pas maintenant » (429 trop de requêtes, 507 plus de place) ou une panne : la séance reste à envoyer', async () => {
    for (const statut of [429, 507, 500, 503, null]) {
      serveurRepond(statut);
      expect(await envoyerRealisation(partage, seance)).toBe(false);
    }
  });

  it('de même pour une suppression : « pas maintenant » la laisse à effacer', async () => {
    for (const statut of [200, 400, 404]) {
      serveurRepond(statut);
      expect(await effacerRealisation(partage, seance.id)).toBe(true);
    }
    for (const statut of [429, 507, 500, 503, null]) {
      serveurRepond(statut);
      expect(await effacerRealisation(partage, seance.id)).toBe(false);
    }
  });
});
