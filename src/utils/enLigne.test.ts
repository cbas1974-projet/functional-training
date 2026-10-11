import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntrainementState, Mesure, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { IDENTIFIANT_MESURE } from './mesures';
import {
  IDENTIFIANT_PARTAGEABLE,
  avecMesure,
  avecMesuresAuBranchement,
  avecSeanceFaite,
  chargerHistoriquePartage,
  chargerMesuresPartagees,
  effacerMesure,
  effacerRealisation,
  envoyerMesure,
  envoyerRealisation,
  historiqueQuiTient,
  sansMesure,
  sansMesureReglee,
  sansSeance,
  traiterFileMesures,
} from './enLigne';
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

// ------------------------------------------------------------- Les mesures

const mesure = (surcharge: Partial<Mesure> = {}): Mesure => ({
  id: 'mesure-1',
  date: '2026-09-05',
  poids: 182.4,
  unitePoids: 'lb',
  tailleCm: 178,
  age: 42,
  ...surcharge,
});

describe('les mesures et le serveur', () => {
  it('le téléphone et le serveur acceptent les mêmes identifiants', () => {
    expect(IDENTIFIANT_MESURE.source).toBe(IDENTIFIANT_PARTAGEABLE.source);
  });

  it('une mesure notée entre dans la liste, du plus ancien jour au plus récent, et part au serveur', () => {
    let ici = avecMesure(etat, mesure({ id: 'mesure-b', date: '2026-09-05' }));
    ici = avecMesure(ici, mesure({ id: 'mesure-a', date: '2026-08-05' }));
    expect(ici.mesures?.map((m) => m.id)).toEqual(['mesure-a', 'mesure-b']);
    expect(ici.mesuresAEnvoyer).toEqual(['mesure-b', 'mesure-a']);
    // Les séances n'en sont pas touchées.
    expect(ici.aEnvoyer).toEqual(etat.aEnvoyer);
    expect(ici.historique).toBe(etat.historique);
  });

  it('une mesure corrigée prend la place de l’ancienne, et repart — une seule fois dans la file', () => {
    const notee = avecMesure(etat, mesure());
    const corrigee = avecMesure(notee, mesure({ poids: 181.2 }));
    expect(corrigee.mesures).toEqual([mesure({ poids: 181.2 })]);
    expect(corrigee.mesuresAEnvoyer).toEqual(['mesure-1']);
    // Reçue par le serveur entre-temps (la file est vide) : la correction repart.
    const recue = { ...notee, mesuresAEnvoyer: [] };
    expect(avecMesure(recue, mesure({ poids: 181.2 })).mesuresAEnvoyer).toEqual(['mesure-1']);
  });

  it('une mesure supprimée sort de la liste, de la file d’envoi — et s’efface du serveur', () => {
    const notee = avecMesure(avecMesure(etat, mesure()), mesure({ id: 'mesure-2', date: '2026-10-05' }));
    const retiree = sansMesure(notee, 'mesure-1');
    expect(retiree.mesures?.map((m) => m.id)).toEqual(['mesure-2']);
    expect(retiree.mesuresAEnvoyer).toEqual(['mesure-2']);
    expect(retiree.mesuresAEffacer).toEqual(['mesure-1']);
    // Supprimée deux fois : une seule demande.
    expect(sansMesure(retiree, 'mesure-1').mesuresAEffacer).toEqual(['mesure-1']);
  });

  it('sans serveur, ou sans savoir qui s’entraîne, tout reste sur le téléphone', () => {
    for (const ici of [{ ...etat, programme: { ...programme, serveur: undefined } }, { ...etat, personne: null }]) {
      const notee = avecMesure(ici, mesure());
      expect(notee.mesures).toEqual([mesure()]);
      expect(notee.mesuresAEnvoyer ?? []).toEqual([]);
      expect(sansMesure(notee, 'mesure-1').mesuresAEffacer ?? []).toEqual([]);
    }
  });

  it('une mesure notée sans serveur sera envoyée au premier branchement, même sur un serveur déjà vu', () => {
    const sansServeur = { ...etat, programme: { ...programme, serveur: undefined }, mesuresEnvoyeesA: 'https://srv123.hstgr.cloud|equipe-1' };
    expect(avecMesure(sansServeur, mesure()).mesuresEnvoyeesA).toBeUndefined();
    // Avec un serveur, au contraire, le marqueur reste : la mesure part par la file.
    expect(avecMesure({ ...etat, mesuresEnvoyeesA: 'srv|equipe' }, mesure()).mesuresEnvoyeesA).toBe('srv|equipe');
  });

  it('au premier branchement sur un serveur, toutes les mesures déjà notées partent — une seule fois', () => {
    const avant = {
      ...etat,
      mesures: [mesure({ id: 'mesure-a', date: '2026-08-05' }), mesure({ id: 'mesure-b' })],
      mesuresAEnvoyer: ['mesure-b', 'mesure-z'],
    };
    const branche = avecMesuresAuBranchement(avant, 'https://srv123.hstgr.cloud|equipe-1');
    expect(branche.mesuresEnvoyeesA).toBe('https://srv123.hstgr.cloud|equipe-1');
    // Ce qui attendait déjà reste, sans doublon.
    expect(branche.mesuresAEnvoyer).toEqual(['mesure-b', 'mesure-z', 'mesure-a']);
    // Le même serveur, la même équipe : rien à refaire (le même objet, donc aucun rendu).
    expect(avecMesuresAuBranchement(branche, 'https://srv123.hstgr.cloud|equipe-1')).toBe(branche);
    // Un autre serveur, ou une autre équipe : tout repart.
    expect(avecMesuresAuBranchement(branche, 'https://autre.exemple.org|equipe-1').mesuresAEnvoyer).toEqual(['mesure-b', 'mesure-z', 'mesure-a']);
  });
});

describe('les mesures, quand le serveur refuse', () => {
  const partage = { serveur: 'https://srv123.hstgr.cloud', equipe: 'equipe-essai-1234', personne: 'sebastien' } as const;
  type Appel = { url: string; methode: string; corps?: unknown };

  /** Un serveur qui répond ces statuts, dans l'ordre, puis 200 ; `null`, un réseau qui ne passe pas. */
  function serveurRepond(...statuts: (number | null)[]) {
    const appels: Appel[] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      appels.push({ url: String(url), methode: init?.method ?? 'GET', corps: init?.body ? JSON.parse(String(init.body)) : undefined });
      // Le dernier statut reste : un serveur qui répond toujours pareil. Sans statut, 200.
      const statut = statuts.length > 1 ? statuts.shift()! : statuts.length === 1 ? statuts[0] : 200;
      return statut === null ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(new Response('{}', { status: statut }));
    });
    return appels;
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envoie la mesure à sa place, avec le nom de la personne', async () => {
    const appels = serveurRepond(200);
    expect(await envoyerMesure(partage, mesure())).toBe(true);
    expect(appels).toEqual([
      {
        url: 'https://srv123.hstgr.cloud/api/equipes/equipe-essai-1234/mesures/mesure-1',
        methode: 'PUT',
        corps: { personne: 'sebastien', mesure: mesure() },
      },
    ]);
  });

  it('une mesure reçue, ou refusée pour de bon (400), est réglée : inutile de la renvoyer', async () => {
    for (const statut of [200, 400]) {
      serveurRepond(statut);
      expect(await envoyerMesure(partage, mesure())).toBe(true);
    }
  });

  it('« pas maintenant » (429 trop de requêtes, 507 plus de place), un serveur pas encore à jour (404) ou une panne : la mesure reste à envoyer', async () => {
    for (const statut of [429, 507, 404, 500, 502, 503, null]) {
      serveurRepond(statut);
      expect(await envoyerMesure(partage, mesure())).toBe(false);
    }
  });

  it('de même pour une suppression : seul un 200 — ou un 400, définitif — la règle', async () => {
    const appels = serveurRepond(200);
    expect(await effacerMesure(partage, 'mesure-1')).toBe(true);
    expect(appels[0]).toEqual({ url: 'https://srv123.hstgr.cloud/api/equipes/equipe-essai-1234/mesures/mesure-1', methode: 'DELETE', corps: undefined });
    serveurRepond(400);
    expect(await effacerMesure(partage, 'mesure-1')).toBe(true);
    for (const statut of [429, 507, 404, 500, 503, null]) {
      serveurRepond(statut);
      expect(await effacerMesure(partage, 'mesure-1')).toBe(false);
    }
  });

  it('un identifiant s’écrit dans l’adresse sans rien casser', async () => {
    const appels = serveurRepond(200);
    await effacerMesure(partage, 'a/b?c');
    expect(appels[0].url).toBe('https://srv123.hstgr.cloud/api/equipes/equipe-essai-1234/mesures/a%2Fb%3Fc');
  });

  const file = (surcharge: Partial<Parameters<typeof traiterFileMesures>[1]> = {}) => ({
    aEffacer: [] as string[],
    aEnvoyer: ['mesure-1', 'mesure-2'],
    mesures: [mesure(), mesure({ id: 'mesure-2', date: '2026-10-05' })],
    ...surcharge,
  });

  it('la file : les suppressions d’abord, puis les envois, une opération à la fois', async () => {
    const appels = serveurRepond(200);
    expect(await traiterFileMesures(partage, file({ aEffacer: ['mesure-0'] }))).toEqual({ type: 'effacee', id: 'mesure-0' });
    expect(await traiterFileMesures(partage, file())).toEqual({ type: 'envoyee', id: 'mesure-1' });
    expect(appels.map((a) => `${a.methode} ${a.url.split('/mesures/')[1]}`)).toEqual(['DELETE mesure-0', 'PUT mesure-1']);
  });

  it('la file : rien à faire, rien d’envoyé', async () => {
    const appels = serveurRepond(200);
    expect(await traiterFileMesures(partage, file({ aEnvoyer: [] }))).toBeNull();
    expect(appels).toEqual([]);
  });

  it('la file : une mesure supprimée entre-temps n’a plus rien à envoyer — réglée, sans appel', async () => {
    const appels = serveurRepond(200);
    expect(await traiterFileMesures(partage, file({ aEnvoyer: ['mesure-9'], mesures: [] }))).toEqual({ type: 'envoyee', id: 'mesure-9' });
    expect(appels).toEqual([]);
  });

  it('la file : un refus définitif (400) retire la mesure de la file — elle ne passera jamais', async () => {
    serveurRepond(400);
    expect(await traiterFileMesures(partage, file())).toEqual({ type: 'envoyee', id: 'mesure-1' });
  });

  it('la file ne perd rien : réseau muet, 429, 507, serveur pas à jour — elle attend, puis se vide dans l’ordre', async () => {
    const appels = serveurRepond(null, 429, 507, 404, 500, 200);
    let ici: EntrainementState = {
      ...etat,
      mesures: [mesure(), mesure({ id: 'mesure-2', date: '2026-10-05' })],
      mesuresAEnvoyer: ['mesure-1', 'mesure-2'],
      mesuresAEffacer: ['mesure-0'],
    };
    const pas = () =>
      traiterFileMesures(partage, {
        aEffacer: ici.mesuresAEffacer ?? [],
        aEnvoyer: ici.mesuresAEnvoyer ?? [],
        mesures: ici.mesures ?? [],
      });
    const avant = JSON.stringify(ici);
    // Cinq essais refusés : la file n'a pas bougé, et c'est toujours la suppression qui attend.
    for (let essai = 0; essai < 5; essai += 1) {
      expect(await pas()).toBeNull();
      expect(JSON.stringify(ici)).toBe(avant);
    }
    expect(new Set(appels.map((a) => `${a.methode} ${a.url.split('/mesures/')[1]}`))).toEqual(new Set(['DELETE mesure-0']));
    // Le serveur répond enfin : tout part, dans l'ordre.
    for (let regle = await pas(); regle !== null; regle = await pas()) ici = sansMesureReglee(ici, regle);
    expect(ici.mesuresAEffacer).toEqual([]);
    expect(ici.mesuresAEnvoyer).toEqual([]);
    expect(appels.slice(5).map((a) => `${a.methode} ${a.url.split('/mesures/')[1]}`)).toEqual(['DELETE mesure-0', 'PUT mesure-1', 'PUT mesure-2']);
    // Les mesures, elles, n'ont jamais quitté le téléphone.
    expect(ici.mesures).toHaveLength(2);
  });

  it('retire de la file ce qui est réglé, et seulement cela', () => {
    const ici = { ...etat, mesuresAEnvoyer: ['mesure-1', 'mesure-2'], mesuresAEffacer: ['mesure-0', 'mesure-3'] };
    expect(sansMesureReglee(ici, { type: 'envoyee', id: 'mesure-1' })).toMatchObject({
      mesuresAEnvoyer: ['mesure-2'],
      mesuresAEffacer: ['mesure-0', 'mesure-3'],
    });
    expect(sansMesureReglee(ici, { type: 'effacee', id: 'mesure-0' })).toMatchObject({
      mesuresAEnvoyer: ['mesure-1', 'mesure-2'],
      mesuresAEffacer: ['mesure-3'],
    });
  });
});

describe('les mesures des deux, lues du serveur', () => {
  const partage = { serveur: 'https://srv123.hstgr.cloud', equipe: 'equipe-essai-1234' };
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const serveurDonne = (statut: number, corps: unknown) =>
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status: statut })));

  it('lit chaque mesure comme le téléphone relit les siennes, et écarte ce qui ne se lit pas', async () => {
    serveurDonne(200, {
      mesures: [
        { personne: 'max', mesure: { ...mesure({ id: 'mesure-m1', poids: 82.4, unitePoids: 'kg' }), note: 'un champ de trop' } },
        { personne: 'sebastien', mesure: mesure() },
        { personne: 'quelqu’un', mesure: mesure({ id: 'mesure-x' }) },
        { personne: 'max', mesure: { id: 'mesure-y', date: 'hier' } },
        { personne: 'max' },
        'n’importe quoi',
        null,
      ],
    });
    expect(await chargerMesuresPartagees(partage)).toEqual([
      { personne: 'max', mesure: mesure({ id: 'mesure-m1', poids: 82.4, unitePoids: 'kg' }) },
      { personne: 'sebastien', mesure: mesure() },
    ]);
  });

  it('demande la liste de l’équipe, sans passer par le cache', async () => {
    const demandes: { url: string; cache?: RequestCache }[] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      demandes.push({ url, cache: init?.cache });
      return Promise.resolve(new Response('{"mesures":[]}'));
    });
    expect(await chargerMesuresPartagees(partage)).toEqual([]);
    expect(demandes).toEqual([{ url: 'https://srv123.hstgr.cloud/api/equipes/equipe-essai-1234/mesures', cache: 'no-store' }]);
  });

  it('null quand le serveur ne répond pas, ne connaît pas encore les mesures (404), ou répond n’importe quoi', async () => {
    for (const [statut, corps] of [
      [500, {}],
      [404, { erreur: 'introuvable' }],
      [200, { mesures: 'beaucoup' }],
      [200, {}],
      [200, '{ pas du json'],
    ] as const) {
      serveurDonne(statut, corps);
      expect(await chargerMesuresPartagees(partage)).toBeNull();
    }
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    expect(await chargerMesuresPartagees(partage)).toBeNull();
  });
});

describe('l’historique des deux, lu du serveur', () => {
  const partage = { serveur: 'https://srv123.hstgr.cloud', equipe: 'equipe-essai-1234' };
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const exo = (extra: object = {}) => ({
    exerciceId: 'goblet-squat',
    seriesPrevues: 3,
    seriesFaites: 3,
    reps: 8,
    dureeSec: 300,
    poids: 25,
    poidsParSerie: [25, 25, 25],
    ...extra,
  });
  const serveurDonne = (exercices: object[]) =>
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(JSON.stringify({ seances: [{ personne: 'max', realisation: { ...seance, exercices } }] }), { status: 200 }),
      ),
    );

  it('garde le ressenti de chaque exercice, tel que l’autre l’a donné', async () => {
    serveurDonne([exo({ ressenti: 'leger' }), exo({ exerciceId: 'curl', ressenti: 'lourd' }), exo({ exerciceId: 'bench-press', ressenti: 'correct' })]);
    const recues = await chargerHistoriquePartage(partage);
    expect(recues?.[0].personne).toBe('max');
    expect(recues?.[0].realisation.exercices.map((e) => e.ressenti)).toEqual(['leger', 'lourd', 'correct']);
  });

  it('une séance d’avant le ressenti, ou un ressenti inconnu, se lit sans ressenti', async () => {
    serveurDonne([exo(), exo({ ressenti: 'difficile' }), exo({ ressenti: 4 })]);
    const [exercices] = (await chargerHistoriquePartage(partage))!.map((s) => s.realisation.exercices);
    expect(exercices.map((e) => e.ressenti)).toEqual([undefined, undefined, undefined]);
    expect(exercices.map((e) => 'ressenti' in e)).toEqual([false, false, false]);
    expect(exercices[0].poidsParSerie).toEqual([25, 25, 25]);
  });
});
