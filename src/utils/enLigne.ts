// Le serveur, côté téléphone, hors séance commune : son adresse, l'envoi des
// séances faites et l'historique des deux. Rien n'y est indispensable :
// sans serveur ni réseau, l'application garde tout sur le téléphone.
import type { EntrainementState, Personne, ProgrammeMois, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { adresseServeurValide, equipeDe } from './programmeMois';

/** L'adresse fixée au moment de publier le site, s'il y en a une. */
export const SERVEUR_DU_SITE = adresseServeurValide(import.meta.env.VITE_SERVEUR);

/** L'adresse du serveur pour ce programme : la sienne, sinon celle du site. */
export const serveurDe = (programme: Pick<ProgrammeMois, 'serveur'> | null): string | null =>
  programme?.serveur ?? SERVEUR_DU_SITE;

/** Ce qu'il faut pour parler au serveur au nom de quelqu'un. */
export interface Partage {
  serveur: string;
  equipe: string;
  personne: Personne;
}

export function partageDe(programme: ProgrammeMois | null, personne: Personne | null): Partage | null {
  const serveur = serveurDe(programme);
  return programme && serveur && personne ? { serveur, equipe: equipeDe(programme), personne } : null;
}

const partageDeLEtat = (etat: EntrainementState) => partageDe(etat.programme ?? null, etat.personne ?? null);

/** Un identifiant que le serveur accepte : les autres ne partent pas, pour ne
 *  pas bloquer la file. */
export const IDENTIFIANT_PARTAGEABLE = /^[A-Za-z0-9_-]{4,64}$/;

/** Avec un serveur, et un identifiant qu'il accepte : la séance part. */
const partira = (etat: EntrainementState, id: string) => partageDeLEtat(etat) !== null && IDENTIFIANT_PARTAGEABLE.test(id);

/** La place de l'historique sur le téléphone, en caractères. Le navigateur
 *  donne environ 5 Mo à un site ; l'historique en prend au plus 1,5 million
 *  de caractères, soit plus de 700 séances : des années. Au-delà, les plus
 *  vieilles ne restent que sur le serveur, qui garde tout. */
const HISTORIQUE_MAXI_CARACTERES = 1_500_000;

/** Les séances les plus récentes qui tiennent dans la place de l'historique. */
export function historiqueQuiTient(historique: SeanceRealisee[], maxi = HISTORIQUE_MAXI_CARACTERES): SeanceRealisee[] {
  let place = maxi;
  const gardees: SeanceRealisee[] = [];
  for (const seance of historique) {
    place -= JSON.stringify(seance).length;
    if (place < 0 && gardees.length > 0) break;
    gardees.push(seance);
  }
  return gardees;
}

/** Une séance faite entre dans l'historique ; avec un serveur, elle part
 *  aussi dans l'historique des deux. */
export const avecSeanceFaite = (etat: EntrainementState, realisee: SeanceRealisee): EntrainementState => ({
  ...etat,
  enCours: null,
  historique: historiqueQuiTient([realisee, ...etat.historique]),
  ...(partira(etat, realisee.id) ? { aEnvoyer: [...(etat.aEnvoyer ?? []), realisee.id] } : {}),
});

/** Une séance supprimée sort de l'historique — et de celui des deux. */
export const sansSeance = (etat: EntrainementState, id: string): EntrainementState => ({
  ...etat,
  historique: etat.historique.filter((s) => s.id !== id),
  aEnvoyer: (etat.aEnvoyer ?? []).filter((x) => x !== id),
  ...(partira(etat, id) ? { aEffacer: [...(etat.aEffacer ?? []), id] } : {}),
});

/** Envoie une séance faite ; vrai quand c'est réglé — reçue, ou refusée pour
 *  de bon (inutile d'insister). Faux quand le réseau ne passe pas. */
export async function envoyerRealisation(partage: Partage, realisation: SeanceRealisee): Promise<boolean> {
  try {
    const reponse = await fetch(
      `${partage.serveur}/api/equipes/${partage.equipe}/historique/${encodeURIComponent(realisation.id)}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personne: partage.personne, realisation }),
      },
    );
    return reponse.ok || reponse.status === 400;
  } catch {
    return false;
  }
}

/** Efface du serveur une séance supprimée ici ; vrai quand c'est réglé. */
export async function effacerRealisation(partage: Partage, id: string): Promise<boolean> {
  try {
    const reponse = await fetch(`${partage.serveur}/api/equipes/${partage.equipe}/historique/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    // Introuvable : il n'y a plus rien à effacer.
    return reponse.ok || reponse.status === 400 || reponse.status === 404;
  } catch {
    return false;
  }
}

export interface SeanceDeQuelquun {
  personne: Personne;
  realisation: SeanceRealisee;
}

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Une séance reçue du serveur, remise d'aplomb : on n'affiche que ce qui se
 *  lit. */
function lireSeanceDeQuelquun(brut: unknown): SeanceDeQuelquun | null {
  if (!estObjet(brut) || (brut.personne !== 'sebastien' && brut.personne !== 'max')) return null;
  const r = brut.realisation;
  if (!estObjet(r) || typeof r.id !== 'string' || typeof r.date !== 'string' || Number.isNaN(Date.parse(r.date))) return null;
  if (!Array.isArray(r.exercices)) return null;
  const nombre = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  const exercices = r.exercices.filter(estObjet).filter((e) => typeof e.exerciceId === 'string').map((e) => ({
    exerciceId: e.exerciceId as string,
    seriesPrevues: nombre(e.seriesPrevues),
    seriesFaites: nombre(e.seriesFaites),
    reps: nombre(e.reps),
    dureeSec: nombre(e.dureeSec),
    ...(typeof e.poids === 'number' ? { poids: e.poids } : {}),
    ...(Array.isArray(e.poidsParSerie) ? { poidsParSerie: e.poidsParSerie.map(nombre) } : {}),
  }));
  return {
    personne: brut.personne,
    realisation: {
      id: r.id,
      date: r.date,
      ...(typeof r.titre === 'string' ? { titre: r.titre } : {}),
      parametres: { ...PARAMETRES_PAR_DEFAUT, ...(estObjet(r.parametres) ? r.parametres : {}) },
      dureePrevueSec: nombre(r.dureePrevueSec),
      dureeReelleSec: nombre(r.dureeReelleSec),
      exercices,
      terminee: r.terminee !== false,
    },
  };
}

/** Les séances des deux, du serveur ; null quand il ne répond pas. */
export async function chargerHistoriquePartage(
  partage: Pick<Partage, 'serveur' | 'equipe'>,
): Promise<SeanceDeQuelquun[] | null> {
  try {
    const reponse = await fetch(`${partage.serveur}/api/equipes/${partage.equipe}/historique`, { cache: 'no-store' });
    if (!reponse.ok) return null;
    const { seances } = (await reponse.json()) as { seances?: unknown };
    if (!Array.isArray(seances)) return null;
    return seances.map(lireSeanceDeQuelquun).filter((s): s is SeanceDeQuelquun => s !== null);
  } catch {
    return null;
  }
}
