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
// Copies de sécurité, dans DONNEES/copies : une chaque nuit, les 30 dernières
// gardées (jours/), et la première de chaque mois, gardée pour toujours
// (mois/). Chacune est la base entière, tout l'historique depuis le premier
// jour.
//
// Protections, puisque le serveur est public : un débit par adresse (la
// dernière de X-Forwarded-For, que pose le proxy), les directs comptés, et des
// tailles bornées — une séance, une équipe, la base. Un refus « pas
// maintenant » (429, 507) laisse le téléphone réessayer plus tard : voir
// LIMITES_PAR_DEFAUT.
//
// Routes :
//   GET  /api/heure                                 l'heure du serveur, et celle de sa dernière copie
//   GET  /api/equipes/:equipe/seances/:cle          l'état de la séance commune
//   POST /api/equipes/:equipe/seances/:cle          un appui : Commencer, Go, Pause…
//   GET  /api/equipes/:equipe/seances/:cle/flux     l'état en direct (Server-Sent Events)
//   PUT    /api/equipes/:equipe/historique/:id      une séance faite
//   DELETE /api/equipes/:equipe/historique/:id      une séance supprimée sur le téléphone
//   GET    /api/equipes/:equipe/historique          les séances des deux
import { createServer } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
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
/** Les copies de chaque nuit : on garde les trente dernières. */
const COPIES_GARDEES = 30;
/** Toutes les heures, on regarde si la copie du jour est faite : elle part
 *  donc peu après minuit, ou dès le démarrage s'il en manque une. */
const VERIFICATION_COPIES_MS = 60 * 60 * 1000;
/** Le jour des copies change à minuit, heure du Québec. */
const FUSEAU = 'America/Toronto';
/** Au-delà, une réponse (tout l'historique) voyage compressée. */
const COMPRESSION_DES = 8 * 1024;
/** Les méthodes qui écrivent ; les autres sont des lectures. */
const METHODES_ECRITURE = new Set(['POST', 'PUT', 'DELETE']);
const MINUTE_MS = 60_000;
/** Toutes les minutes, les seaux pleins sont oubliés : celui d'une adresse
 *  qu'on n'a pas vue depuis une minute est plein, comme celui d'une inconnue. */
const OUBLI_DES_ADRESSES_MS = MINUTE_MS;
/** Un direct refusé, faute de place, peut réessayer dans une demi-minute. */
const ATTENTE_FLUX_MS = 30_000;
/** La taille de la base se mesure au plus une fois par minute. */
const MESURE_BASE_MS = MINUTE_MS;

/** La date (AAAA-MM-JJ) d'un instant dans un fuseau ; en temps universel si
 *  le fuseau est inconnu. */
export function jourDans(fuseau: string, instant: number): string {
  try {
    const parties = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(instant)
        .map((partie) => [partie.type, partie.value]),
    );
    return `${parties.year}-${parties.month}-${parties.day}`;
  } catch {
    return new Date(instant).toISOString().slice(0, 10);
  }
}

/** Fait la copie du jour si elle manque, garde la première de chaque mois
 *  pour toujours, et efface les copies de chaque nuit au-delà des trente
 *  dernières. Rend l'instant de la copie du jour. */
export function faireLesCopies(base: DatabaseSync, dossier: string, jour: string, instant: number): number {
  const jours = join(dossier, 'copies', 'jours');
  const mois = join(dossier, 'copies', 'mois');
  for (const ici of [jours, mois]) {
    mkdirSync(ici, { recursive: true });
    // Le reste d'une copie interrompue (panne, disque plein) ne sert à rien.
    for (const nom of readdirSync(ici)) if (nom.endsWith('.tmp')) rmSync(join(ici, nom), { force: true });
  }
  const duJour = join(jours, `${jour}.sqlite`);
  let faiteA = instant;
  if (existsSync(duJour)) {
    faiteA = Math.round(statSync(duJour).mtimeMs);
  } else {
    // Écrite à côté puis renommée : une copie est entière, ou elle n'est pas.
    // VACUUM INTO lit la base d'un seul coup, même pendant qu'on s'en sert.
    const enCours = `${duJour}.tmp`;
    base.prepare('VACUUM INTO ?').run(enCours);
    renameSync(enCours, duJour);
  }
  const dejaCeMois = readdirSync(mois).some((nom) => nom.startsWith(jour.slice(0, 8)) && nom.endsWith('.sqlite'));
  if (!dejaCeMois) {
    const enCours = join(mois, `${jour}.sqlite.tmp`);
    copyFileSync(duJour, enCours);
    renameSync(enCours, join(mois, `${jour}.sqlite`));
  }
  const anciennes = readdirSync(jours)
    .filter((nom) => /^\d{4}-\d{2}-\d{2}\.sqlite$/.test(nom))
    .sort()
    .reverse()
    .slice(COPIES_GARDEES);
  for (const nom of anciennes) rmSync(join(jours, nom), { force: true });
  return faiteA;
}

/** Les limites contre les abus : larges pour un usage normal — deux amis, qui
 *  peuvent partager la même adresse —, étroites pour un abus. Chacune se règle
 *  dans `OptionsServeur.limites`, pour les essais. */
export interface LimitesServeur {
  /** Écritures (POST, PUT, DELETE) par minute et par adresse. La réserve est
   *  d'une minute entière : un téléphone qui envoie tout son historique, une
   *  séance à la fois, passe — au rythme de la limite une fois la réserve vide —
   *  même s'il ne réessaie que toutes les trente secondes (`RELANCE_ENVOI_MS`,
   *  dans App.tsx). */
  ecrituresParMinute: number;
  /** Lectures (GET…) par minute et par adresse. */
  lecturesParMinute: number;
  /** Directs ouverts en même temps par adresse. */
  fluxParAdresse: number;
  /** Une séance enregistrée, en octets de JSON : une vraie en fait 2 à 3 Ko. */
  seanceMaxiOctets: number;
  /** Séances par équipe : une nouvelle au-delà est refusée, une mise à jour non. */
  seancesParEquipe: number;
  /** La base, en octets : au-delà, plus d'écriture, sauf pour effacer. */
  baseMaxiOctets: number;
}

export const LIMITES_PAR_DEFAUT: LimitesServeur = {
  ecrituresParMinute: 120,
  lecturesParMinute: 600,
  fluxParAdresse: 10,
  seanceMaxiOctets: 64 * 1024,
  seancesParEquipe: 10_000,
  // Avec les copies de chaque nuit (trente) et de chaque mois, la place prise
  // sur le disque du VPS reste de quelques gigaoctets au pire.
  baseMaxiOctets: 100 * 1024 * 1024,
};

/** L'adresse du client, telle que le proxy l'a vue : la dernière de
 *  X-Forwarded-For — celles d'avant peuvent être inventées par le client —,
 *  sinon celle de la connexion. Le serveur ne doit donc être joignable que par
 *  le proxy. */
export function adresseDuClient(entetes: IncomingHttpHeaders, connexion: string | undefined): string {
  const transmises = String(entetes['x-forwarded-for'] ?? '')
    .split(',')
    .map((adresse) => adresse.trim())
    .filter(Boolean);
  return transmises.at(-1) ?? connexion ?? 'inconnue';
}

type Seau = { credit: number; maj: number };

/** Un seau à jetons par adresse : chaque requête prend un jeton ; il en revient
 *  `parMinute` par minute, jusqu'à `parMinute` en réserve — la rafale. Le seau
 *  se compte en millisecondes, pour que rien ne s'arrondisse : il se remplit
 *  d'une milliseconde par milliseconde, jusqu'à une minute, et un jeton en vaut
 *  `60 000 / parMinute`. `prendre` rend 0 quand la requête passe, sinon le temps
 *  à attendre, en millisecondes, avant le prochain jeton. */
export function creerSeaux(parMinute: number, maintenant: () => number) {
  const jetonMs = MINUTE_MS / parMinute;
  const seaux = new Map<string, Seau>();
  /** Le contenu d'un seau à cet instant ; une horloge qui recule n'en retire pas. */
  const creditA = (seau: Seau, instant: number) => Math.min(MINUTE_MS, seau.credit + Math.max(0, instant - seau.maj));
  let oubliA = maintenant();
  return {
    prendre(adresse: string): number {
      const instant = maintenant();
      // Les seaux pleins sont oubliés : la mémoire ne grossit pas avec les
      // adresses de passage.
      const ecoule = instant - oubliA;
      if (ecoule >= OUBLI_DES_ADRESSES_MS || ecoule < 0) {
        oubliA = instant;
        for (const [autre, seau] of seaux) if (creditA(seau, instant) >= MINUTE_MS) seaux.delete(autre);
      }
      const seau = seaux.get(adresse);
      const credit = seau ? creditA(seau, instant) : MINUTE_MS;
      const passe = credit >= jetonMs;
      seaux.set(adresse, { credit: passe ? credit - jetonMs : credit, maj: instant });
      return passe ? 0 : Math.ceil(jetonMs - credit);
    },
    /** Les adresses dont on se souvient. */
    taille: () => seaux.size,
  };
}

export interface OptionsServeur {
  port?: number;
  /** Dossier de la base. */
  donnees?: string;
  /** Horloge, remplaçable pour les tests. */
  maintenant?: () => number;
  /** Les limites contre les abus ; celles qu'on ne donne pas gardent leur valeur par défaut. */
  limites?: Partial<LimitesServeur>;
}

type Abonne = { reponse: ServerResponse; personne: string };

export function demarrer(options: OptionsServeur = {}): Promise<Server> {
  const maintenant = options.maintenant ?? Date.now;
  const limites = { ...LIMITES_PAR_DEFAUT, ...options.limites };
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
  const lireRealisation = base.prepare('SELECT 1 FROM historique WHERE equipe = ? AND id = ?');
  const compterRealisations = base.prepare('SELECT COUNT(*) AS n FROM historique WHERE equipe = ?');
  const effacerRealisation = base.prepare('DELETE FROM historique WHERE equipe = ? AND id = ?');
  // Tout l'historique, depuis le premier jour.
  const lireHistorique = base.prepare('SELECT personne, realisation FROM historique WHERE equipe = ? ORDER BY date DESC');

  // ------------------------------------------------ Les copies de sécurité
  let derniereCopie: number | null = null;
  const copier = () => {
    try {
      const instant = maintenant();
      derniereCopie = faireLesCopies(base, dossier, jourDans(FUSEAU, instant), instant);
    } catch (erreur) {
      // Disque plein, droits… : on réessaie dans une heure, et /api/heure
      // le laisse voir, la vérification automatique aussi.
      console.error('Copie de sécurité impossible :', erreur);
    }
  };
  copier();
  const minuterieCopies = setInterval(copier, VERIFICATION_COPIES_MS);
  minuterieCopies.unref();

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
  /** Une réponse en JSON ; longue, et si le téléphone le comprend, compressée. */
  const json = (reponse: ServerResponse, statut: number, corps: unknown, requete?: IncomingMessage) => {
    const texte = JSON.stringify(corps);
    const enTetes = { ...entetes, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    if (requete && texte.length > COMPRESSION_DES && /\bgzip\b/.test(String(requete.headers['accept-encoding'] ?? ''))) {
      reponse.writeHead(statut, { ...enTetes, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      reponse.end(gzipSync(texte));
      return;
    }
    reponse.writeHead(statut, enTetes);
    reponse.end(texte);
  };
  /** Lit le corps JSON d'une requête, de `maxi` octets au plus. */
  const lireCorps = (requete: IncomingMessage, maxi = CORPS_MAXI): Promise<unknown> =>
    new Promise((resoudre, rejeter) => {
      // Un corps annoncé trop gros n'est pas lu : le refus part tout de suite.
      if (Number(requete.headers['content-length']) > maxi) {
        rejeter(new Error('trop gros'));
        return;
      }
      let taille = 0;
      const morceaux: Buffer[] = [];
      requete.on('data', (morceau: Buffer) => {
        taille += morceau.length;
        if (taille > maxi) {
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

  // ------------------------------------------------ Les protections
  const ecritures = creerSeaux(limites.ecrituresParMinute, maintenant);
  const lectures = creerSeaux(limites.lecturesParMinute, maintenant);
  /** Les directs ouverts en ce moment, par adresse. */
  const fluxOuverts = new Map<string, number>();
  /** Un refus « pas maintenant » (429), avec le temps à attendre : le téléphone
   *  garde ce qu'il envoyait et réessaie plus tard. */
  const refuser = (reponse: ServerResponse, erreur: string, attenteMs: number) => {
    reponse.setHeader('Retry-After', String(Math.max(1, Math.ceil(attenteMs / 1000))));
    json(reponse, 429, { erreur });
  };
  // La taille de la base, mesurée au plus une fois par minute. Les pages que
  // libère un effacement se réutilisent : elles ne comptent pas, et effacer
  // rend donc la place.
  const pragma = (nom: string) => (base.prepare(`PRAGMA ${nom}`).get() as Record<string, number>)[nom];
  let mesureeA = -Infinity;
  let pleine = false;
  /** Écrire dans une base pleine : refusé (507). Vrai quand la requête s'arrête là. */
  const refuserSiPleine = (reponse: ServerResponse): boolean => {
    const instant = maintenant();
    if (instant - mesureeA >= MESURE_BASE_MS || instant < mesureeA) {
      mesureeA = instant;
      const octets = (pragma('page_count') - pragma('freelist_count')) * pragma('page_size');
      const etaitPleine = pleine;
      pleine = octets > limites.baseMaxiOctets;
      // Les téléphones réessaient sans bruit : seul le journal du serveur le dit.
      if (pleine && !etaitPleine) console.error(`Base pleine (${Math.round(octets / 2 ** 20)} Mo) : plus d'écriture, sauf pour effacer.`);
    }
    if (pleine) json(reponse, 507, { erreur: 'plus de place' });
    return pleine;
  };

  const serveur = createServer(async (requete, reponse) => {
    try {
      // Le débit d'abord : une adresse qui en demande trop n'obtient plus que
      // des refus, pour toutes les routes.
      const client = adresseDuClient(requete.headers, requete.socket.remoteAddress);
      const attenteMs = (METHODES_ECRITURE.has(requete.method ?? '') ? ecritures : lectures).prendre(client);
      if (attenteMs > 0) {
        refuser(reponse, 'trop de requêtes', attenteMs);
        return;
      }
      const url = new URL(requete.url ?? '/', 'http://serveur');
      const morceaux = url.pathname.split('/').filter(Boolean);
      if (requete.method === 'OPTIONS') {
        reponse.writeHead(204, entetes);
        reponse.end();
        return;
      }
      if (url.pathname === '/api/heure') {
        json(reponse, 200, { heure: maintenant(), copie: derniereCopie });
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
          // Un direct reste ouvert : on compte ceux de chaque adresse.
          const ouverts = fluxOuverts.get(client) ?? 0;
          if (ouverts >= limites.fluxParAdresse) {
            refuser(reponse, 'trop de directs ouverts', ATTENTE_FLUX_MS);
            return;
          }
          fluxOuverts.set(client, ouverts + 1);
          requete.on('close', () => {
            const restants = (fluxOuverts.get(client) ?? 1) - 1;
            if (restants > 0) fluxOuverts.set(client, restants);
            else fluxOuverts.delete(client);
          });
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
          if (refuserSiPleine(reponse)) return;
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
          json(
            reponse,
            200,
            { seances: lignes.map((ligne) => ({ personne: ligne.personne, realisation: JSON.parse(ligne.realisation) })) },
            requete,
          );
          return;
        }
        if (cle && IDENTIFIANT.test(cle) && requete.method === 'PUT') {
          if (refuserSiPleine(reponse)) return;
          const corps = (await lireCorps(requete, limites.seanceMaxiOctets)) as {
            personne?: unknown;
            realisation?: { id?: unknown; date?: unknown };
          } | null;
          const realisation = corps?.realisation;
          const date = typeof realisation?.date === 'string' ? realisation.date : '';
          if (!corps || !PERSONNES.has(String(corps.personne)) || realisation?.id !== cle || !/^\d{4}-\d{2}-\d{2}T/.test(date)) {
            json(reponse, 400, { erreur: 'séance illisible' });
            return;
          }
          // Une équipe pleine n'accepte plus de nouvelle séance, mais garde à
          // jour celles qu'elle a. « Pas maintenant » : le téléphone la renverra.
          const nouvelle = lireRealisation.get(equipe, cle) === undefined;
          if (nouvelle && (compterRealisations.get(equipe) as { n: number }).n >= limites.seancesParEquipe) {
            json(reponse, 507, { erreur: 'équipe pleine' });
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
    clearInterval(minuterieCopies);
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
