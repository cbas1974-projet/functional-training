import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { adresseDuClient, creerSeaux, demarrer, faireLesCopies, jourDans } from './serveur.ts';
import type { LimitesServeur } from './serveur.ts';

const EQUIPE = 'equipe-essai-1234';
const CLE = '2026-10-08_jeudi';
let serveur: Server;
let dossier: string;
let adresse: string;
let horloge = 1_000_000;

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'entrainement-'));
  horloge = 1_000_000;
  serveur = await demarrer({ donnees: dossier, maintenant: () => horloge });
  adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
});

afterEach(async () => {
  serveur.closeAllConnections();
  await new Promise((resoudre) => serveur.close(resoudre));
  rmSync(dossier, { recursive: true, force: true });
});

let compteur = 0;
const appui = (action: object, a = horloge) =>
  fetch(`${adresse}/api/equipes/${EQUIPE}/seances/${CLE}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: `appui-${(compteur += 1)}`, a, action }),
  });

/** Remplace le serveur d'essai par un autre, sur la même base, aux limites données. */
async function redemarrer(limites: Partial<LimitesServeur>) {
  serveur.closeAllConnections();
  await new Promise((resoudre) => serveur.close(resoudre));
  serveur = await demarrer({ donnees: dossier, maintenant: () => horloge, limites });
  adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
}

/** Le corps d'une séance faite ; `titre` la grossit à volonté. */
const corpsDeSeance = (id: string, titre = '') =>
  JSON.stringify({
    personne: 'sebastien',
    realisation: { id, date: '2026-10-05T14:00:00.000Z', exercices: [], terminee: true, titre },
  });
const enregistrer = (id: string, titre = '', equipe = EQUIPE) =>
  fetch(`${adresse}/api/equipes/${equipe}/historique/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: corpsDeSeance(id, titre),
  });
const effacer = (id: string, entetes: Record<string, string> = {}) =>
  fetch(`${adresse}/api/equipes/${EQUIPE}/historique/${id}`, { method: 'DELETE', headers: entetes });
const lireSeances = async (equipe = EQUIPE): Promise<{ realisation: { id: string; titre?: string } }[]> =>
  (await (await fetch(`${adresse}/api/equipes/${equipe}/historique`)).json()).seances;
const idsEnregistres = async (equipe = EQUIPE) => (await lireSeances(equipe)).map((s) => s.realisation.id).sort();

/** Lit les événements d'un flux jusqu'à ce que `jusqua` soit satisfait. */
async function lireFlux(reponse: Response, jusqua: (donnees: { etat: unknown; presents: string[] }) => boolean) {
  const lecteur = reponse.body!.getReader();
  const decodeur = new TextDecoder();
  let tampon = '';
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) throw new Error('flux fermé');
    tampon += decodeur.decode(value, { stream: true });
    let fin: number;
    while ((fin = tampon.indexOf('\n\n')) >= 0) {
      const bloc = tampon.slice(0, fin);
      tampon = tampon.slice(fin + 2);
      const ligne = bloc.split('\n').find((l) => l.startsWith('data: '));
      if (!ligne) continue;
      const donnees = JSON.parse(ligne.slice(6));
      if (jusqua(donnees)) {
        await lecteur.cancel();
        return donnees;
      }
    }
  }
}

describe('le serveur', () => {
  it('donne son heure, pour caler les téléphones, et celle de sa dernière copie de sécurité', async () => {
    const reponse = await fetch(`${adresse}/api/heure`);
    // La copie se fait dès le démarrage : le 31 décembre 1969 au soir, au
    // Québec, pour cette horloge d'essai.
    expect(await reponse.json()).toEqual({ heure: 1_000_000, copie: 1_000_000 });
    expect(reponse.headers.get('access-control-allow-origin')).toBe('*');
    expect(existsSync(join(dossier, 'copies', 'jours', '1969-12-31.sqlite'))).toBe(true);
  });

  it('garde la séance commune : on la commence, on la rejoint, « Go » vaut pour les deux', async () => {
    const vide = await (await fetch(`${adresse}/api/equipes/${EQUIPE}/seances/${CLE}`)).json();
    expect(vide.etat).toBeNull();
    const commencee = await (await appui({ type: 'commencer' })).json();
    expect(commencee.etat).toMatchObject({ debut: 1_000_000, go: {} });
    horloge += 60_000;
    const rejointe = await (await appui({ type: 'commencer' })).json();
    expect(rejointe.etat.debut).toBe(1_000_000);
    await appui({ type: 'go', groupe: 0 });
    const relue = await (await fetch(`${adresse}/api/equipes/${EQUIPE}/seances/${CLE}`)).json();
    expect(relue.etat.go).toEqual({ '0': 1_060_000 });
  });

  it('ne croit pas un appui venu du futur', async () => {
    await appui({ type: 'commencer' });
    const reponse = await (await appui({ type: 'pause' }, horloge + 3_600_000)).json();
    expect(reponse.etat.pauses).toEqual([{ debut: 1_000_000 }]);
  });

  it('ni une séance commencée il y a une éternité, par un téléphone à l’heure de 1970', async () => {
    horloge = 1_791_000_000_000;
    const reponse = await (await appui({ type: 'commencer' }, 0)).json();
    expect(reponse.etat.debut).toBe(horloge - 3 * 60 * 60 * 1000);
  });

  it('numérote chaque changement, et fait compter une pause en retard à son arrivée', async () => {
    expect((await (await appui({ type: 'commencer' })).json()).etat.rev).toBe(1);
    expect((await (await appui({ type: 'go', groupe: 0 })).json()).etat.rev).toBe(2);
    // Un « Go » déjà donné ne change rien, ni le numéro.
    expect((await (await appui({ type: 'go', groupe: 0 })).json()).etat.rev).toBe(2);
    horloge += 120_000;
    // Appuyée hors ligne il y a une minute : elle compte d'il y a dix secondes.
    const pause = await (await appui({ type: 'pause' }, horloge - 60_000)).json();
    expect(pause.etat.pauses).toEqual([{ debut: horloge - 10_000 }]);
    expect(pause.etat.rev).toBe(3);
    // « +15 s » : l'horloge s'arrête quinze secondes.
    const prolongee = await (await appui({ type: 'prolonger', sec: 15 })).json();
    expect(prolongee.etat.sauts).toEqual([{ a: horloge, sec: -15 }]);
  });

  it('refuse ce qui ne ressemble à rien', async () => {
    expect((await fetch(`${adresse}/api/equipes/court/seances/${CLE}`)).status).toBe(404);
    expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/seances/pas-une-cle`)).status).toBe(404);
    expect((await appui({ type: 'effacer' })).status).toBe(400);
    const tordu = await fetch(`${adresse}/api/equipes/${EQUIPE}/seances/${CLE}`, { method: 'POST', body: '{pas du json' });
    expect(tordu.status).toBe(400);
  });

  it('diffuse en direct : qui est là, et chaque appui', async () => {
    await appui({ type: 'commencer' });
    const flux = await fetch(`${adresse}/api/equipes/${EQUIPE}/seances/${CLE}/flux?personne=max`);
    expect(flux.headers.get('content-type')).toContain('text/event-stream');
    const lecture = lireFlux(flux, (donnees) => (donnees.etat as { pauses: unknown[] } | null)?.pauses.length === 1);
    await new Promise((resoudre) => setTimeout(resoudre, 50));
    await appui({ type: 'pause' });
    const recu = await lecture;
    expect(recu.presents).toEqual(['max']);
  });

  it('garde l’historique des deux, et le renvoie du plus récent au plus ancien', async () => {
    const realisation = (id: string, date: string) => ({ id, date, exercices: [], terminee: true });
    const envoyer = (personne: string, id: string, date: string) =>
      fetch(`${adresse}/api/equipes/${EQUIPE}/historique/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personne, realisation: realisation(id, date) }),
      });
    expect((await envoyer('sebastien', 'seance-1', '2026-10-05T14:00:00.000Z')).status).toBe(200);
    expect((await envoyer('max', 'seance-2', '2026-10-08T14:00:00.000Z')).status).toBe(200);
    // Renvoyée deux fois : elle ne compte qu'une fois.
    expect((await envoyer('max', 'seance-2', '2026-10-08T14:00:00.000Z')).status).toBe(200);
    expect((await envoyer('quelqu’un', 'seance-3', '2026-10-08T14:00:00.000Z')).status).toBe(400);
    const liste = await (await fetch(`${adresse}/api/equipes/${EQUIPE}/historique`)).json();
    expect(liste.seances.map((s: { personne: string; realisation: { id: string } }) => [s.personne, s.realisation.id])).toEqual([
      ['max', 'seance-2'],
      ['sebastien', 'seance-1'],
    ]);
    // Une autre équipe ne voit rien.
    const autre = await (await fetch(`${adresse}/api/equipes/autre-equipe-5678/historique`)).json();
    expect(autre.seances).toEqual([]);
    // Supprimée sur le téléphone : effacée du serveur aussi, même deux fois.
    expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/historique/seance-1`, { method: 'DELETE' })).status).toBe(200);
    expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/historique/seance-1`, { method: 'DELETE' })).status).toBe(200);
    const reste = await (await fetch(`${adresse}/api/equipes/${EQUIPE}/historique`)).json();
    expect(reste.seances.map((s: { realisation: { id: string } }) => s.realisation.id)).toEqual(['seance-2']);
  });

  it('garde le ressenti de chaque exercice, tel que le téléphone l’a envoyé', async () => {
    const exercices = ['leger', 'lourd', 'correct', undefined].map((ressenti, i) => ({
      exerciceId: `exercice-${i}`,
      seriesPrevues: 3,
      seriesFaites: 3,
      reps: 8,
      dureeSec: 300,
      poids: 25,
      ...(ressenti ? { ressenti } : {}),
    }));
    const realisation = { id: 'seance-ressenti', date: '2026-10-11T14:00:00.000Z', exercices, terminee: true };
    const reponse = await fetch(`${adresse}/api/equipes/${EQUIPE}/historique/seance-ressenti`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personne: 'max', realisation }),
    });
    expect(reponse.status).toBe(200);
    const [recue] = (await (await fetch(`${adresse}/api/equipes/${EQUIPE}/historique`)).json()).seances;
    expect(recue.realisation).toEqual(realisation);
    expect(recue.realisation.exercices.map((e: { ressenti?: string }) => e.ressenti)).toEqual(['leger', 'lourd', 'correct', undefined]);
  });

  it('renvoie tout l’historique depuis le premier jour, compressé en route', async () => {
    // Six cents séances en parallèle : bien plus vite que le débit permis à un téléphone.
    await redemarrer({ ecrituresParMinute: 100_000 });
    const debut = Date.UTC(2026, 9, 1);
    for (let lot = 0; lot < 12; lot += 1) {
      await Promise.all(
        Array.from({ length: 50 }, (_, i) => {
          const n = lot * 50 + i;
          const id = `seance-${String(n).padStart(4, '0')}`;
          const realisation = { id, date: new Date(debut + n * 86_400_000).toISOString(), exercices: [], terminee: true };
          return fetch(`${adresse}/api/equipes/${EQUIPE}/historique/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ personne: n % 2 ? 'max' : 'sebastien', realisation }),
          });
        }),
      );
    }
    const reponse = await fetch(`${adresse}/api/equipes/${EQUIPE}/historique`);
    expect(reponse.headers.get('content-encoding')).toBe('gzip');
    const { seances } = await reponse.json();
    expect(seances).toHaveLength(600);
    expect(seances.at(-1).realisation.id).toBe('seance-0000');
  });

  it('retrouve tout après un redémarrage', async () => {
    await appui({ type: 'commencer' });
    serveur.closeAllConnections();
    await new Promise((resoudre) => serveur.close(resoudre));
    serveur = await demarrer({ donnees: dossier, maintenant: () => horloge });
    adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
    const relue = await (await fetch(`${adresse}/api/equipes/${EQUIPE}/seances/${CLE}`)).json();
    expect(relue.etat.debut).toBe(1_000_000);
  });
});

describe('les protections', () => {
  describe('le débit', () => {
    it('un seau à jetons : une réserve, puis un jeton à la fois, et le temps à attendre', () => {
      let instant = 0;
      const seaux = creerSeaux(60, () => instant); // un jeton par seconde, soixante en réserve
      for (let i = 0; i < 60; i += 1) expect(seaux.prendre('a')).toBe(0);
      expect(seaux.prendre('a')).toBe(1000);
      // Chaque adresse a son seau.
      expect(seaux.prendre('b')).toBe(0);
      instant += 400;
      expect(seaux.prendre('a')).toBe(600);
      instant += 600;
      expect(seaux.prendre('a')).toBe(0);
      expect(seaux.prendre('a')).toBe(1000);
      // Une longue attente ne fait que remplir le seau : soixante jetons, pas davantage.
      instant += 3_600_000;
      for (let i = 0; i < 60; i += 1) expect(seaux.prendre('a')).toBe(0);
      expect(seaux.prendre('a')).toBe(1000);
    });

    it('oublie les adresses au repos, pas celles qui servent encore', () => {
      let instant = 0;
      const seaux = creerSeaux(60, () => instant);
      for (const adresse of ['a', 'b', 'c']) seaux.prendre(adresse);
      expect(seaux.taille()).toBe(3);
      // « d » vide son seau juste avant le ménage de la minute.
      instant = 59_000;
      for (let i = 0; i < 60; i += 1) seaux.prendre('d');
      instant = 61_000;
      seaux.prendre('e');
      expect(seaux.taille()).toBe(2); // d et e : a, b et c, pleins, sont oubliés
      instant = 122_000;
      seaux.prendre('f');
      expect(seaux.taille()).toBe(1); // d et e sont pleins à leur tour
    });

    it('une horloge qui recule ne bloque pas un seau', () => {
      let instant = 3_600_000;
      const seaux = creerSeaux(60, () => instant);
      for (let i = 0; i < 60; i += 1) seaux.prendre('a');
      instant = 0; // l'heure du VPS est recalée, une heure en arrière
      expect(seaux.prendre('a')).toBe(1000);
      instant = 1000;
      expect(seaux.prendre('a')).toBe(0);
    });

    it('au-delà du débit des écritures : 429 avec Retry-After, puis ça repasse après l’attente', async () => {
      await redemarrer({ ecrituresParMinute: 3 }); // trois en réserve, puis un toutes les 20 s
      // Un appui, une séance, un effacement : toutes les écritures puisent au même seau.
      expect((await appui({ type: 'commencer' })).status).toBe(200);
      expect((await enregistrer('seance-1')).status).toBe(200);
      expect((await effacer('seance-1')).status).toBe(200);
      const refus = await enregistrer('seance-2');
      expect(refus.status).toBe(429);
      expect(refus.headers.get('retry-after')).toBe('20');
      // Le téléphone doit pouvoir lire le refus : l'en-tête qui l'y autorise y est aussi.
      expect(refus.headers.get('access-control-allow-origin')).toBe('*');
      expect(await refus.json()).toEqual({ erreur: 'trop de requêtes' });
      // Le refus n'écrit rien. Les lectures, elles, passent encore.
      expect(await idsEnregistres()).toEqual([]);
      horloge += 19_000;
      expect((await enregistrer('seance-2')).status).toBe(429);
      horloge += 1_000;
      expect((await enregistrer('seance-2')).status).toBe(200);
      expect(await idsEnregistres()).toEqual(['seance-2']);
    });

    it('les lectures ont leur seau à part, plus large ; refusées, elles disent aussi quand revenir', async () => {
      await redemarrer({ lecturesParMinute: 2 }); // deux en réserve, puis un toutes les 30 s
      expect((await fetch(`${adresse}/api/heure`)).status).toBe(200);
      expect((await fetch(`${adresse}/api/heure`)).status).toBe(200);
      const refus = await fetch(`${adresse}/api/heure`);
      expect(refus.status).toBe(429);
      expect(refus.headers.get('retry-after')).toBe('30');
      // Les écritures ne s'en ressentent pas ; la pré-vérification d'un navigateur compte comme une lecture.
      expect((await enregistrer('seance-1')).status).toBe(200);
      expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/historique/seance-1`, { method: 'OPTIONS' })).status).toBe(429);
      horloge += 30_000;
      expect((await fetch(`${adresse}/api/heure`)).status).toBe(200);
    });

    it('compte chaque client à son adresse : la dernière de X-Forwarded-For, celle que le proxy a vue', async () => {
      await redemarrer({ ecrituresParMinute: 2 });
      const aEffacer = (xff?: string) => effacer('seance-1', xff ? { 'x-forwarded-for': xff } : {});
      expect((await aEffacer('203.0.113.1')).status).toBe(200);
      expect((await aEffacer('203.0.113.1')).status).toBe(200);
      expect((await aEffacer('203.0.113.1')).status).toBe(429);
      // Il a beau inventer d'autres adresses en tête : le proxy a ajouté la sienne à la fin.
      expect((await aEffacer('198.51.100.7, 203.0.113.1')).status).toBe(429);
      // Un autre client, derrière le même proxy, a son propre seau ;
      expect((await aEffacer('203.0.113.1, 203.0.113.2')).status).toBe(200);
      // et celui qui n'a pas de proxy, l'adresse de sa connexion.
      expect((await aEffacer()).status).toBe(200);
    });

    it('l’adresse du client : la dernière de X-Forwarded-For, sinon celle de la connexion', () => {
      // 172.18.0.2 : le proxy, vu de la connexion.
      const de = (xff?: string) => adresseDuClient(xff === undefined ? {} : { 'x-forwarded-for': xff }, '172.18.0.2');
      expect(de('203.0.113.7')).toBe('203.0.113.7');
      expect(de('1.2.3.4,  5.6.7.8 , 203.0.113.7')).toBe('203.0.113.7');
      expect(de('2001:db8::1')).toBe('2001:db8::1');
      expect(de('203.0.113.7, ')).toBe('203.0.113.7');
      expect(de()).toBe('172.18.0.2');
      expect(de('')).toBe('172.18.0.2');
      expect(adresseDuClient({}, undefined)).toBe('inconnue');
    });

    it('un téléphone qui envoie tout son historique d’un coup passe, en ralentissant', async () => {
      const depart = horloge;
      let refus = 0;
      for (let n = 0; n < 300; n += 1) {
        // Une séance à la fois ; refusée, le téléphone attend ce que dit le serveur, puis recommence.
        for (;;) {
          const reponse = await enregistrer(`seance-${String(n).padStart(4, '0')}`);
          if (reponse.status !== 429) {
            expect(reponse.status).toBe(200);
            break;
          }
          refus += 1;
          horloge += Number(reponse.headers.get('retry-after')) * 1000;
        }
      }
      expect(await idsEnregistres()).toHaveLength(300);
      // La réserve en laisse passer cent vingt d'un coup ; le reste, deux par seconde.
      expect(refus).toBeGreaterThan(0);
      expect(horloge - depart).toBeGreaterThanOrEqual(60_000);
    });

    it('au plus quelques directs ouverts en même temps par adresse', async () => {
      await redemarrer({ fluxParAdresse: 2 });
      const ouvrir = (xff?: string) =>
        fetch(`${adresse}/api/equipes/${EQUIPE}/seances/${CLE}/flux?personne=max`, {
          headers: xff ? { 'x-forwarded-for': xff } : {},
        });
      const premier = await ouvrir();
      const deuxieme = await ouvrir();
      expect([premier.status, deuxieme.status]).toEqual([200, 200]);
      const refus = await ouvrir();
      expect(refus.status).toBe(429);
      expect(refus.headers.get('retry-after')).toBe('30');
      expect(await refus.json()).toEqual({ erreur: 'trop de directs ouverts' });
      // Chaque adresse a ses directs.
      expect((await ouvrir('203.0.113.9')).status).toBe(200);
      // Un direct qui se ferme rend sa place.
      await premier.body!.cancel();
      await vi.waitFor(async () => expect((await ouvrir()).status).toBe(200));
    });
  });

  describe('les tailles', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('refuse une séance trop grosse, et accepte celle qui tient pile dans 64 Ko', async () => {
      const octets = (titre: string) => Buffer.byteLength(corpsDeSeance('seance-1', titre));
      const pile = 'x'.repeat(64 * 1024 - octets(''));
      expect(octets(pile)).toBe(64 * 1024);
      expect((await enregistrer('seance-1', pile)).status).toBe(200);
      const trop = await enregistrer('seance-2', `${pile}x`);
      expect(trop.status).toBe(400);
      expect(await trop.json()).toEqual({ erreur: 'trop gros' });
      // Bien plus grosse : refusée de même, sans qu'on la lise.
      expect((await enregistrer('seance-3', 'x'.repeat(200_000))).status).toBe(400);
      // Rien n'a été gardé des refusées, et le serveur répond toujours.
      expect(await idsEnregistres()).toEqual(['seance-1']);
    });

    it('une équipe garde au plus un certain nombre de séances : une nouvelle est refusée, une mise à jour passe', async () => {
      await redemarrer({ seancesParEquipe: 3 });
      for (const id of ['seance-1', 'seance-2', 'seance-3']) expect((await enregistrer(id)).status).toBe(200);
      const refus = await enregistrer('seance-4');
      expect(refus.status).toBe(507);
      expect(await refus.json()).toEqual({ erreur: 'équipe pleine' });
      // Une séance que l'équipe a déjà se met à jour, même pleine.
      expect((await enregistrer('seance-2', 'corrigée')).status).toBe(200);
      expect((await lireSeances()).find((s) => s.realisation.id === 'seance-2')?.realisation.titre).toBe('corrigée');
      // Les autres équipes ne sont pas gênées.
      expect((await enregistrer('seance-4', '', 'autre-equipe-5678')).status).toBe(200);
      // Une séance effacée rend sa place.
      expect((await effacer('seance-1')).status).toBe(200);
      expect((await enregistrer('seance-4')).status).toBe(200);
      expect(await idsEnregistres()).toEqual(['seance-2', 'seance-3', 'seance-4']);
    });

    it('une base trop grosse refuse d’écrire (507), sauf pour effacer ; elle ne se mesure qu’une fois par minute', async () => {
      const journal = vi.spyOn(console, 'error').mockImplementation(() => {});
      await redemarrer({ baseMaxiOctets: 100 * 1024 });
      const grosse = 'x'.repeat(50_000);
      // Mesurée à la première écriture, encore petite : tout passe, et la mesure vaut une minute.
      for (const id of ['seance-1', 'seance-2', 'seance-3']) expect((await enregistrer(id, grosse)).status).toBe(200);
      horloge += 59_000;
      expect((await enregistrer('seance-4', grosse)).status).toBe(200);
      // Une minute après la première mesure, la base pèse plus de 100 Ko.
      horloge += 1_000;
      const refus = await enregistrer('seance-5', grosse);
      expect(refus.status).toBe(507);
      expect(await refus.json()).toEqual({ erreur: 'plus de place' });
      expect((await appui({ type: 'commencer' })).status).toBe(507);
      // Lire, et effacer, restent permis.
      expect(await idsEnregistres()).toHaveLength(4);
      for (const id of ['seance-1', 'seance-2', 'seance-3', 'seance-4']) expect((await effacer(id)).status).toBe(200);
      // Effacer rend la place, mais la mesure n'est refaite qu'une minute plus tard.
      expect((await enregistrer('seance-5', grosse)).status).toBe(507);
      horloge += 60_000;
      expect((await enregistrer('seance-5', grosse)).status).toBe(200);
      // Seul le journal du serveur le dit, une fois : les téléphones réessaient sans bruit.
      expect(journal).toHaveBeenCalledTimes(1);
      expect(journal.mock.calls[0][0]).toContain('Base pleine');
    });
  });
});

describe('les copies de sécurité', () => {
  // À l'écart des copies du serveur démarré pour chaque essai.
  let ici: string;
  beforeEach(() => {
    ici = join(dossier, 'essai');
    mkdirSync(ici);
  });
  const lire = (fichier: string) => {
    const copie = new DatabaseSync(fichier, { readOnly: true });
    const lignes = copie.prepare('SELECT x FROM t').all().map((ligne) => ligne.x);
    copie.close();
    return lignes;
  };
  const jour = (i: number) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);

  it('une chaque nuit, les trente dernières, et la première de chaque mois pour toujours', () => {
    const base = new DatabaseSync(join(ici, 'essai.sqlite'));
    base.exec("CREATE TABLE t (x TEXT); INSERT INTO t VALUES ('jour 1');");
    // Du 1er septembre au 9 novembre 2026 : soixante-dix nuits.
    for (let i = 0; i < 70; i += 1) {
      faireLesCopies(base, ici, jour(i), i);
      if (i === 0) base.exec("INSERT INTO t VALUES ('jour 2');");
    }
    base.close();
    const jours = readdirSync(join(ici, 'copies', 'jours')).sort();
    expect(jours).toHaveLength(30);
    expect([jours[0], jours.at(-1)]).toEqual(['2026-10-11.sqlite', '2026-11-09.sqlite']);
    const mois = readdirSync(join(ici, 'copies', 'mois')).sort();
    expect(mois).toEqual(['2026-09-01.sqlite', '2026-10-01.sqlite', '2026-11-01.sqlite']);
    // Chaque copie est la base entière : tout depuis le premier jour.
    expect(lire(join(ici, 'copies', 'mois', '2026-09-01.sqlite'))).toEqual(['jour 1']);
    expect(lire(join(ici, 'copies', 'jours', '2026-11-09.sqlite'))).toEqual(['jour 1', 'jour 2']);
  });

  it('une seule par jour, même si le serveur redémarre, et une copie ratée ne laisse rien de bancal', () => {
    const base = new DatabaseSync(join(ici, 'essai.sqlite'));
    base.exec("CREATE TABLE t (x TEXT); INSERT INTO t VALUES ('matin');");
    expect(faireLesCopies(base, ici, '2026-10-06', 5)).toBe(5);
    base.exec("INSERT INTO t VALUES ('soir');");
    // Le même jour : rien ne change, la copie reste celle de la nuit.
    faireLesCopies(base, ici, '2026-10-06', 6);
    expect(lire(join(ici, 'copies', 'jours', '2026-10-06.sqlite'))).toEqual(['matin']);
    // Un reste de copie interrompue (panne de courant) ne gêne pas la suivante.
    writeFileSync(join(ici, 'copies', 'jours', '2026-10-07.sqlite.tmp'), 'à moitié');
    writeFileSync(join(ici, 'copies', 'mois', '2026-09-01.sqlite.tmp'), 'à moitié');
    faireLesCopies(base, ici, '2026-10-07', 7);
    base.close();
    expect(readdirSync(join(ici, 'copies', 'jours')).sort()).toEqual(['2026-10-06.sqlite', '2026-10-07.sqlite']);
    expect(readdirSync(join(ici, 'copies', 'mois'))).toEqual(['2026-10-06.sqlite']);
    expect(lire(join(ici, 'copies', 'jours', '2026-10-07.sqlite'))).toEqual(['matin', 'soir']);
  });

  it('change de jour à minuit, heure du Québec', () => {
    // 3 h 30 du matin à Londres, 23 h 30 la veille à Montréal.
    expect(jourDans('America/Toronto', Date.UTC(2026, 9, 7, 3, 30))).toBe('2026-10-06');
    expect(jourDans('Fuseau/Inconnu', Date.UTC(2026, 9, 7, 3, 30))).toBe('2026-10-07');
  });
});

// ------------------------------------------------------------- Les mensurations

/** Une mesure du corps ; `surcharge` la déforme à volonté. */
const mesure = (id: string, surcharge: Record<string, unknown> = {}) => ({
  id,
  date: '2026-09-05',
  poids: 182.4,
  unitePoids: 'lb',
  tailleCm: 178,
  age: 42,
  ...surcharge,
});
const corpsDeMesure = (id: string, surcharge: Record<string, unknown> = {}, personne = 'sebastien') =>
  JSON.stringify({ personne, mesure: mesure(id, surcharge) });
const noterMesure = (id: string, corps = corpsDeMesure(id), equipe = EQUIPE) =>
  fetch(`${adresse}/api/equipes/${equipe}/mesures/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: corps,
  });
const retirerMesure = (id: string, equipe = EQUIPE) =>
  fetch(`${adresse}/api/equipes/${equipe}/mesures/${id}`, { method: 'DELETE' });
const lireLesMesures = async (equipe = EQUIPE): Promise<{ personne: string; mesure: Record<string, unknown> }[]> =>
  (await (await fetch(`${adresse}/api/equipes/${equipe}/mesures`)).json()).mesures;
const idsDeMesures = async (equipe = EQUIPE) => (await lireLesMesures(equipe)).map((m) => m.mesure.id).sort();

describe('les mensurations', () => {
  it('garde les mesures des deux, de la plus récente à la plus ancienne', async () => {
    expect((await noterMesure('mesure-1', corpsDeMesure('mesure-1', { date: '2026-08-05' }))).status).toBe(200);
    expect((await noterMesure('mesure-2', corpsDeMesure('mesure-2', { poids: 81.9, unitePoids: 'kg' }, 'max'))).status).toBe(200);
    expect((await noterMesure('mesure-3', corpsDeMesure('mesure-3', { date: '2026-10-05' }))).status).toBe(200);
    const liste = await lireLesMesures();
    expect(liste.map((m) => [m.personne, m.mesure.id])).toEqual([
      ['sebastien', 'mesure-3'],
      ['max', 'mesure-2'],
      ['sebastien', 'mesure-1'],
    ]);
    expect(liste[1].mesure).toEqual(mesure('mesure-2', { poids: 81.9, unitePoids: 'kg' }));
    // Une autre équipe ne voit rien.
    expect(await lireLesMesures('autre-equipe-5678')).toEqual([]);
  });

  it('une mesure corrigée remplace l’ancienne : elle ne compte qu’une fois', async () => {
    await noterMesure('mesure-1');
    expect((await noterMesure('mesure-1', corpsDeMesure('mesure-1', { poids: 181.2 }))).status).toBe(200);
    const liste = await lireLesMesures();
    expect(liste).toHaveLength(1);
    expect(liste[0].mesure.poids).toBe(181.2);
  });

  it('une mesure supprimée sur le téléphone s’efface du serveur, même deux fois', async () => {
    await noterMesure('mesure-1');
    await noterMesure('mesure-2', corpsDeMesure('mesure-2', { date: '2026-10-05' }));
    expect((await retirerMesure('mesure-1')).status).toBe(200);
    expect((await retirerMesure('mesure-1')).status).toBe(200);
    expect((await retirerMesure('mesure-inconnue')).status).toBe(200);
    expect(await idsDeMesures()).toEqual(['mesure-2']);
    // Chaque équipe garde les siennes.
    await noterMesure('mesure-1', corpsDeMesure('mesure-1'), 'autre-equipe-5678');
    expect((await retirerMesure('mesure-1')).status).toBe(200);
    expect(await idsDeMesures('autre-equipe-5678')).toEqual(['mesure-1']);
  });

  it('ne garde que ce qu’une mesure contient, arrondi au dixième : le reste du corps est jeté', async () => {
    const corps = JSON.stringify({
      personne: 'max',
      mesure: { ...mesure('mesure-1', { poids: 182.4000001 }), note: 'un champ de trop', autre: { x: 1 } },
      reste: 'et encore',
    });
    expect((await noterMesure('mesure-1', corps)).status).toBe(200);
    expect((await lireLesMesures())[0]).toEqual({ personne: 'max', mesure: mesure('mesure-1') });
  });

  it('refuse ce qui n’est pas une mesure, et n’en garde rien', async () => {
    const refusees: [string, string][] = [
      ['une personne inconnue', corpsDeMesure('mesure-1', {}, 'quelqu’un')],
      ['sans personne', JSON.stringify({ mesure: mesure('mesure-1') })],
      ['sans mesure', JSON.stringify({ personne: 'max' })],
      ['rien du tout', 'null'],
      ['un autre identifiant que celui de l’adresse', corpsDeMesure('mesure-9')],
      ['sans unité', JSON.stringify({ personne: 'max', mesure: { ...mesure('mesure-1'), unitePoids: undefined } })],
      ['une unité inconnue', corpsDeMesure('mesure-1', { unitePoids: 'stone' })],
      ['un poids absurde', corpsDeMesure('mesure-1', { poids: 5 })],
      ['un poids en texte', corpsDeMesure('mesure-1', { poids: '182' })],
      ['une taille absurde', corpsDeMesure('mesure-1', { tailleCm: 1780 })],
      ['un âge à virgule', corpsDeMesure('mesure-1', { age: 42.5 })],
      ['un jour qui n’existe pas', corpsDeMesure('mesure-1', { date: '2026-02-31' })],
      ['une date d’heure précise', corpsDeMesure('mesure-1', { date: '2026-09-05T10:00:00Z' })],
      ['du JSON qui ne se lit pas', '{pas du json'],
    ];
    for (const [quoi, corps] of refusees) {
      const reponse = await noterMesure('mesure-1', corps);
      expect(reponse.status, quoi).toBe(400);
    }
    expect(await idsDeMesures()).toEqual([]);
  });

  it('une adresse qui n’a pas la forme d’un identifiant n’est pas une route', async () => {
    expect((await noterMesure('mes')).status).toBe(404);
    expect((await retirerMesure('mes')).status).toBe(404);
    expect((await noterMesure('a'.repeat(65))).status).toBe(404);
    expect((await fetch(`${adresse}/api/equipes/court/mesures`)).status).toBe(404);
    // Ni une autre méthode.
    expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/mesures/mesure-1`, { method: 'POST', body: '{}' })).status).toBe(404);
    expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/mesures`, { method: 'PUT', body: '{}' })).status).toBe(404);
  });

  it('répond à la pré-vérification du navigateur : PUT et DELETE sont permis depuis le site', async () => {
    const reponse = await fetch(`${adresse}/api/equipes/${EQUIPE}/mesures/mesure-1`, { method: 'OPTIONS' });
    expect(reponse.status).toBe(204);
    expect(reponse.headers.get('access-control-allow-methods')).toMatch(/PUT.*DELETE/);
    expect(reponse.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('retrouve tout après un redémarrage', async () => {
    await noterMesure('mesure-1');
    serveur.closeAllConnections();
    await new Promise((resoudre) => serveur.close(resoudre));
    serveur = await demarrer({ donnees: dossier, maintenant: () => horloge });
    adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
    expect(await idsDeMesures()).toEqual(['mesure-1']);
  });

  it('les copies de sécurité les contiennent : c’est la même base', async () => {
    await noterMesure('mesure-1');
    await noterMesure('mesure-2', corpsDeMesure('mesure-2', {}, 'max'));
    // Une nuit plus tard, le serveur redémarre : il fait la copie du jour.
    horloge += 2 * 24 * 60 * 60 * 1000;
    await redemarrer({});
    const copies = readdirSync(join(dossier, 'copies', 'jours')).sort();
    expect(copies).toHaveLength(2);
    const copie = new DatabaseSync(join(dossier, 'copies', 'jours', copies.at(-1)!), { readOnly: true });
    const lignes = copie.prepare('SELECT id, personne FROM mesures ORDER BY id').all();
    copie.close();
    expect(lignes.map((l) => ({ ...l }))).toEqual([
      { id: 'mesure-1', personne: 'sebastien' },
      { id: 'mesure-2', personne: 'max' },
    ]);
  });

  describe('les protections, les mêmes que pour l’historique', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('une mesure pèse au plus 4 Ko : la plus grosse qui tient passe, la suivante est refusée', async () => {
      const octets = (reste: string) => Buffer.byteLength(JSON.stringify({ personne: 'sebastien', mesure: { ...mesure('mesure-1'), reste } }));
      const pile = 'x'.repeat(4 * 1024 - octets(''));
      expect(octets(pile)).toBe(4 * 1024);
      const corps = (reste: string) => JSON.stringify({ personne: 'sebastien', mesure: { ...mesure('mesure-1'), reste } });
      expect((await noterMesure('mesure-1', corps(pile))).status).toBe(200);
      const trop = await noterMesure('mesure-2', corps(`${pile}x`).replace('mesure-1', 'mesure-2'));
      expect(trop.status).toBe(400);
      expect(await trop.json()).toEqual({ erreur: 'trop gros' });
      // Bien plus gros : refusé de même, sans qu'on le lise.
      expect((await noterMesure('mesure-3', corps('x'.repeat(200_000)).replace('mesure-1', 'mesure-3'))).status).toBe(400);
      expect(await idsDeMesures()).toEqual(['mesure-1']);
    });

    it('les écritures puisent au même seau : une mesure de trop, c’est 429 avec Retry-After, puis ça repasse', async () => {
      await redemarrer({ ecrituresParMinute: 3 }); // trois en réserve, puis un toutes les 20 s
      expect((await noterMesure('mesure-1')).status).toBe(200);
      expect((await enregistrer('seance-1')).status).toBe(200);
      expect((await retirerMesure('mesure-1')).status).toBe(200);
      const refus = await noterMesure('mesure-2');
      expect(refus.status).toBe(429);
      expect(refus.headers.get('retry-after')).toBe('20');
      expect(refus.headers.get('access-control-allow-origin')).toBe('*');
      expect(await refus.json()).toEqual({ erreur: 'trop de requêtes' });
      // Un refus n'écrit rien, et la lecture a son propre seau.
      expect(await idsDeMesures()).toEqual([]);
      horloge += 20_000;
      expect((await noterMesure('mesure-2')).status).toBe(200);
      expect(await idsDeMesures()).toEqual(['mesure-2']);
    });

    it('les lectures aussi sont comptées, à part', async () => {
      await redemarrer({ lecturesParMinute: 2 });
      expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/mesures`)).status).toBe(200);
      expect((await fetch(`${adresse}/api/equipes/${EQUIPE}/mesures`)).status).toBe(200);
      const refus = await fetch(`${adresse}/api/equipes/${EQUIPE}/mesures`);
      expect(refus.status).toBe(429);
      expect(refus.headers.get('retry-after')).toBe('30');
      // Les écritures, elles, passent.
      expect((await noterMesure('mesure-1')).status).toBe(200);
    });

    it('une équipe garde au plus un certain nombre de mesures : une nouvelle est refusée (507), une correction passe', async () => {
      await redemarrer({ mesuresParEquipe: 2 });
      for (const id of ['mesure-1', 'mesure-2']) expect((await noterMesure(id)).status).toBe(200);
      const refus = await noterMesure('mesure-3');
      expect(refus.status).toBe(507);
      expect(await refus.json()).toEqual({ erreur: 'équipe pleine' });
      expect((await noterMesure('mesure-2', corpsDeMesure('mesure-2', { poids: 180 }))).status).toBe(200);
      expect((await lireLesMesures()).find((m) => m.mesure.id === 'mesure-2')?.mesure.poids).toBe(180);
      // Les autres équipes ne sont pas gênées ; effacer rend sa place.
      expect((await noterMesure('mesure-3', corpsDeMesure('mesure-3'), 'autre-equipe-5678')).status).toBe(200);
      expect((await retirerMesure('mesure-1')).status).toBe(200);
      expect((await noterMesure('mesure-3')).status).toBe(200);
      expect(await idsDeMesures()).toEqual(['mesure-2', 'mesure-3']);
    });

    it('une base trop grosse refuse d’écrire une mesure (507), mais on peut lire et effacer', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await redemarrer({ baseMaxiOctets: 100 * 1024 });
      expect((await noterMesure('mesure-1')).status).toBe(200);
      // Les séances remplissent la base ; la mesure en prend la mesure une minute plus tard.
      for (const id of ['seance-1', 'seance-2', 'seance-3']) expect((await enregistrer(id, 'x'.repeat(50_000))).status).toBe(200);
      horloge += 60_000;
      const refus = await noterMesure('mesure-2');
      expect(refus.status).toBe(507);
      expect(await refus.json()).toEqual({ erreur: 'plus de place' });
      expect(await idsDeMesures()).toEqual(['mesure-1']);
      expect((await retirerMesure('mesure-1')).status).toBe(200);
      expect(await idsDeMesures()).toEqual([]);
    });
  });
});
