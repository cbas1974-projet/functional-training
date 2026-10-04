import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { demarrer } from './serveur.ts';

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
  it('donne son heure, pour caler les téléphones', async () => {
    const reponse = await fetch(`${adresse}/api/heure`);
    expect(await reponse.json()).toEqual({ heure: 1_000_000 });
    expect(reponse.headers.get('access-control-allow-origin')).toBe('*');
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
