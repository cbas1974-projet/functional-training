// Le serveur de l'application d'entraînement, à installer sur le VPS : il
// garde la séance commune du jour — une seule horloge pour les deux
// téléphones — et l'historique de chacun, avec les charges. Rien de
// confidentiel : pas de compte ; un code d'équipe, transmis avec le lien du
// programme, regroupe les deux téléphones.
//
// Node lit le TypeScript tel quel ; aucune dépendance : node:http pour
// répondre, node:sqlite pour garder.
//
//   node serveur/serveur.ts            (PORT=8080 et DONNEES=./donnees par défaut)
//
// Routes :
//   GET  /api/heure                                 l'heure du serveur
//   GET  /api/equipes/:equipe/seances/:cle          l'état de la séance commune
//   POST /api/equipes/:equipe/seances/:cle          un appui : Commencer, Go, Pause…
//   GET  /api/equipes/:equipe/seances/:cle/flux     l'état en direct (Server-Sent Events)
//   PUT    /api/equipes/:equipe/historique/:id      une séance faite
//   DELETE /api/equipes/:equipe/historique/:id      une séance supprimée sur le téléphone
//   GET    /api/equipes/:equipe/historique          les séances des deux
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { EXPIRATION_MS, appliquer, lireEnvoi, lireEtat } from '../src/utils/etatCommun.ts';
import type { EtatCommun } from '../src/utils/etatCommun.ts';

const PERSONNES = new Set(['sebastien', 'max']);
const EQUIPE = /^[A-Za-z0-9_-]{10,40}$/;
const CLE = /^\d{4}-\d{2}-\d{2}_[a-z0-9-]{1,40}$/;
const IDENTIFIANT = /^[A-Za-z0-9_-]{4,64}$/;
/** Une requête ne dépasse pas 256 Ko : une séance notée en fait quelques-uns. */
const CORPS_MAXI = 256 * 1024;
/** Un battement régulier garde le flux ouvert à travers les proxys, et dit au
 *  téléphone que le direct passe toujours. */
const BATTEMENT_MS = 15_000;
/** Les séances communes de plus d'un mois sont effacées ; l'historique reste. */
const CONSERVATION_SEANCES_MS = 31 * 24 * 60 * 60 * 1000;
/** Une pause, une reprise ou une prolongation arrivée en retard — le
 *  téléphone était hors ligne — compte à son arrivée, à quelques secondes
 *  près : l'autre téléphone, lui, a continué. */
const RETARD_TOLERE_MS = 10_000;

export interface OptionsServeur {
  port?: number;
  /** Dossier de la base. */
  donnees?: string;
  /** Horloge, remplaçable pour les tests. */
  maintenant?: () => number;
}

type Abonne = { reponse: ServerResponse; personne: string };

export function demarrer(options: OptionsServeur = {}): Promise<Server> {
  const maintenant = options.maintenant ?? Date.now;
  const dossier = options.donnees ?? 'donnees';
  mkdirSync(dossier, { recursive: true });
  const base = new DatabaseSync(join(dossier, 'entrainement.sqlite'));
  base.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS seances (
      equipe TEXT NOT NULL, cle TEXT NOT NULL, etat TEXT NOT NULL, maj INTEGER NOT NULL,
      PRIMARY KEY (equipe, cle)
    );
    CREATE TABLE IF NOT EXISTS historique (
      equipe TEXT NOT NULL, id TEXT NOT NULL, personne TEXT NOT NULL, date TEXT NOT NULL,
      realisation TEXT NOT NULL, recu INTEGER NOT NULL,
      PRIMARY KEY (equipe, id)
    );
    CREATE INDEX IF NOT EXISTS historique_date ON historique (equipe, date DESC);
  `);
  base.prepare('DELETE FROM seances WHERE maj < ?').run(maintenant() - CONSERVATION_SEANCES_MS);

  const lireSeance = base.prepare('SELECT etat FROM seances WHERE equipe = ? AND cle = ?');
  const ecrireSeance = base.prepare(
    'INSERT INTO seances (equipe, cle, etat, maj) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT (equipe, cle) DO UPDATE SET etat = excluded.etat, maj = excluded.maj',
  );
  const ecrireRealisation = base.prepare(
    'INSERT INTO historique (equipe, id, personne, date, realisation, recu) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT (equipe, id) DO UPDATE SET personne = excluded.personne, date = excluded.date, ' +
      'realisation = excluded.realisation, recu = excluded.recu',
  );
  const effacerRealisation = base.prepare('DELETE FROM historique WHERE equipe = ? AND id = ?');
  const lireHistorique = base.prepare(
    'SELECT personne, realisation FROM historique WHERE equipe = ? ORDER BY date DESC LIMIT 500',
  );

  const etatDe = (equipe: string, cle: string): EtatCommun | null => {
    try {
      const ligne = lireSeance.get(equipe, cle) as { etat: string } | undefined;
      return ligne ? lireEtat(JSON.parse(ligne.etat)) : null;
    } catch {
      // Base fermée (arrêt du serveur) ou ligne abîmée : pas d'état.
      return null;
    }
  };

  // ------------------------------------------------ Le direct
  const abonnes = new Map<string, Set<Abonne>>();
  const presents = (cle: string) => [...new Set([...(abonnes.get(cle) ?? [])].map((a) => a.personne))].sort();
  const diffuser = (cleFlux: string, etat: EtatCommun | null) => {
    const message = `event: etat\ndata: ${JSON.stringify({ etat, presents: presents(cleFlux), heure: maintenant() })}\n\n`;
    for (const abonne of abonnes.get(cleFlux) ?? []) abonne.reponse.write(message);
  };

  // ------------------------------------------------ Réponses
  const entetes = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };
  const json = (reponse: ServerResponse, statut: number, corps: unknown) => {
    reponse.writeHead(statut, { ...entetes, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    reponse.end(JSON.stringify(corps));
  };
  const lireCorps = (requete: IncomingMessage): Promise<unknown> =>
    new Promise((resoudre, rejeter) => {
      let taille = 0;
      const morceaux: Buffer[] = [];
      requete.on('data', (morceau: Buffer) => {
        taille += morceau.length;
        if (taille > CORPS_MAXI) {
          rejeter(new Error('trop gros'));
          requete.destroy();
          return;
        }
        morceaux.push(morceau);
      });
      requete.on('end', () => {
        try {
          resoudre(JSON.parse(Buffer.concat(morceaux).toString('utf8') || 'null'));
        } catch {
          rejeter(new Error('illisible'));
        }
      });
      requete.on('error', rejeter);
    });

  const serveur = createServer(async (requete, reponse) => {
    try {
      const url = new URL(requete.url ?? '/', 'http://serveur');
      const morceaux = url.pathname.split('/').filter(Boolean);
      if (requete.method === 'OPTIONS') {
        reponse.writeHead(204, entetes);
        reponse.end();
        return;
      }
      if (url.pathname === '/api/heure') {
        json(reponse, 200, { heure: maintenant() });
        return;
      }
      // /api/equipes/:equipe/...
      const [api, equipes, equipe, rubrique, cle, flux] = morceaux;
      if (api !== 'api' || equipes !== 'equipes' || !EQUIPE.test(equipe ?? '')) {
        json(reponse, 404, { erreur: 'introuvable' });
        return;
      }

      if (rubrique === 'seances' && cle && CLE.test(cle)) {
        const cleFlux = `${equipe}/${cle}`;
        if (flux === 'flux' && requete.method === 'GET') {
          const personne = url.searchParams.get('personne') ?? '';
          reponse.writeHead(200, {
            ...entetes,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          // Un téléphone parti sans prévenir : l'écriture qui échoue ne doit
          // pas arrêter le serveur.
          reponse.on('error', () => {});
          const abonne: Abonne = { reponse, personne: PERSONNES.has(personne) ? personne : 'inconnu' };
          if (!abonnes.has(cleFlux)) abonnes.set(cleFlux, new Set());
          abonnes.get(cleFlux)!.add(abonne);
          diffuser(cleFlux, etatDe(equipe, cle));
          const battement = setInterval(
            () => reponse.write(`event: battement\ndata: ${JSON.stringify({ heure: maintenant() })}\n\n`),
            BATTEMENT_MS,
          );
          requete.on('close', () => {
            clearInterval(battement);
            abonnes.get(cleFlux)?.delete(abonne);
            if (abonnes.get(cleFlux)?.size === 0) abonnes.delete(cleFlux);
            else diffuser(cleFlux, etatDe(equipe, cle));
          });
          return;
        }
        if (flux === undefined && requete.method === 'GET') {
          json(reponse, 200, { etat: etatDe(equipe, cle), presents: presents(cleFlux), heure: maintenant() });
          return;
        }
        if (flux === undefined && requete.method === 'POST') {
          const corps = await lireCorps(requete);
          const envoi = lireEnvoi(corps);
          if (!envoi) {
            json(reponse, 400, { erreur: 'appui illisible' });
            return;
          }
          const avant = etatDe(equipe, cle);
          // L'instant de l'appui vient du téléphone : jamais dans le futur,
          // jamais avant le début de la séance, ni plus vieux qu'une séance.
          let a = Math.max(Math.min(envoi.a, maintenant()), avant?.debut ?? 0, maintenant() - EXPIRATION_MS);
          const arret = envoi.action.type === 'pause' || envoi.action.type === 'reprendre' || envoi.action.type === 'prolonger';
          if (arret) a = Math.max(a, maintenant() - RETARD_TOLERE_MS);
          const applique = appliquer(avant, { ...envoi, a });
          // Chaque changement porte un numéro : les téléphones gardent le plus
          // récent, quel que soit l'ordre d'arrivée.
          const apres = applique && applique !== avant ? { ...applique, rev: (avant?.rev ?? 0) + 1 } : applique;
          if (apres && apres !== avant) {
            ecrireSeance.run(equipe, cle, JSON.stringify(apres), apres.maj);
            diffuser(cleFlux, apres);
          }
          json(reponse, 200, { etat: apres, presents: presents(cleFlux), heure: maintenant() });
          return;
        }
      }

      if (rubrique === 'historique') {
        if (cle === undefined && requete.method === 'GET') {
          const lignes = lireHistorique.all(equipe) as { personne: string; realisation: string }[];
          json(reponse, 200, {
            seances: lignes.map((ligne) => ({ personne: ligne.personne, realisation: JSON.parse(ligne.realisation) })),
          });
          return;
        }
        if (cle && IDENTIFIANT.test(cle) && requete.method === 'PUT') {
          const corps = (await lireCorps(requete)) as { personne?: unknown; realisation?: { id?: unknown; date?: unknown } } | null;
          const realisation = corps?.realisation;
          const date = typeof realisation?.date === 'string' ? realisation.date : '';
          if (!corps || !PERSONNES.has(String(corps.personne)) || realisation?.id !== cle || !/^\d{4}-\d{2}-\d{2}T/.test(date)) {
            json(reponse, 400, { erreur: 'séance illisible' });
            return;
          }
          ecrireRealisation.run(equipe, cle, String(corps.personne), date, JSON.stringify(realisation), maintenant());
          json(reponse, 200, { ok: true });
          return;
        }
        if (cle && IDENTIFIANT.test(cle) && requete.method === 'DELETE') {
          effacerRealisation.run(equipe, cle);
          json(reponse, 200, { ok: true });
          return;
        }
      }
      json(reponse, 404, { erreur: 'introuvable' });
    } catch (erreur) {
      if (!reponse.headersSent) json(reponse, 400, { erreur: erreur instanceof Error ? erreur.message : 'erreur' });
    }
  });

  serveur.on('close', () => {
    for (const ensemble of abonnes.values()) for (const abonne of ensemble) abonne.reponse.end();
    base.close();
  });
  return new Promise((resoudre) => serveur.listen(options.port ?? 0, () => resoudre(serveur)));
}

// Lancé directement : on sert.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8080);
  void demarrer({ port, donnees: process.env.DONNEES ?? 'donnees' }).then(() => {
    console.log(`Serveur d'entraînement prêt sur le port ${port}`);
  });
}
