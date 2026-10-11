// Le serveur, côté téléphone, hors séance commune : son adresse, l'envoi des
// séances faites et des mesures du corps, et l'historique des deux. Rien n'y
// est indispensable : sans serveur ni réseau, l'application garde tout sur le
// téléphone.
import type { EntrainementState, Mesure, Personne, ProgrammeMois, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { lireMesure, trierMesures } from './mesures';
import { estRessenti } from './ressenti';
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

/** Une séance faite ou supprimée, une mesure notée ou supprimée, repart vers le
 *  serveur toutes les trente secondes tant qu'il ne l'a pas. */
export const RELANCE_ENVOI_MS = 30_000;

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
    ...(estRessenti(e.ressenti) ? { ressenti: e.ressenti } : {}),
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

// ------------------------------------------------------------- Les mesures
//
// Les mensurations suivent le même chemin que les séances : gardées sur le
// téléphone, elles partent aussi vers le serveur pour que l'autre les voie. Une
// file d'envoi ne perd rien : une mesure notée, corrigée ou supprimée reste
// dans la file (par son identifiant) tant que le serveur ne l'a pas réglée.

/** Une mesure notée ou corrigée entre dans la liste, du plus ancien jour au plus
 *  récent ; avec un serveur, elle part aussi — et repart tant qu'il ne l'a pas.
 *  Sans serveur, on s'en souvient : celui qu'on branchera plus tard recevra tout. */
export const avecMesure = (etat: EntrainementState, mesure: Mesure): EntrainementState => ({
  ...etat,
  mesures: trierMesures([...(etat.mesures ?? []).filter((m) => m.id !== mesure.id), mesure]),
  ...(partira(etat, mesure.id)
    ? { mesuresAEnvoyer: [...new Set([...(etat.mesuresAEnvoyer ?? []), mesure.id])] }
    : { mesuresEnvoyeesA: undefined }),
});

/** Une mesure supprimée sort de la liste — et du serveur. */
export const sansMesure = (etat: EntrainementState, id: string): EntrainementState => ({
  ...etat,
  mesures: (etat.mesures ?? []).filter((m) => m.id !== id),
  mesuresAEnvoyer: (etat.mesuresAEnvoyer ?? []).filter((x) => x !== id),
  ...(partira(etat, id) ? { mesuresAEffacer: [...new Set([...(etat.mesuresAEffacer ?? []), id])] } : {}),
});

/** Au premier branchement sur un serveur (« adresse|code »), les mesures déjà
 *  notées partent aussi : celui de l'autre est complet dès le départ. */
export const avecMesuresAuBranchement = (etat: EntrainementState, cle: string): EntrainementState =>
  etat.mesuresEnvoyeesA === cle
    ? etat
    : {
        ...etat,
        mesuresEnvoyeesA: cle,
        mesuresAEnvoyer: [...new Set([...(etat.mesuresAEnvoyer ?? []), ...(etat.mesures ?? []).map((m) => m.id)])],
      };

/** Envoie une mesure ; vrai quand c'est réglé — reçue, ou refusée pour de bon
 *  (400 : elle ne passera jamais, inutile d'insister). Faux quand le réseau ne
 *  passe pas, ou que le serveur dit « pas maintenant » (429 trop de requêtes,
 *  507 plus de place) ou ne connaît pas encore les mesures (404, pas à jour). */
export async function envoyerMesure(partage: Partage, mesure: Mesure): Promise<boolean> {
  try {
    const reponse = await fetch(`${partage.serveur}/api/equipes/${partage.equipe}/mesures/${encodeURIComponent(mesure.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personne: partage.personne, mesure }),
    });
    return reponse.ok || reponse.status === 400;
  } catch {
    return false;
  }
}

/** Efface du serveur une mesure supprimée ici ; vrai quand c'est réglé. Un 404
 *  n'est pas « il n'y a plus rien à effacer » — le serveur répond 200 dans ce
 *  cas — mais un serveur pas encore à jour : on réessaiera. */
export async function effacerMesure(partage: Partage, id: string): Promise<boolean> {
  try {
    const reponse = await fetch(`${partage.serveur}/api/equipes/${partage.equipe}/mesures/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return reponse.ok || reponse.status === 400;
  } catch {
    return false;
  }
}

/** Ce que la file a réglé : une mesure effacée du serveur, ou envoyée. */
export interface MesureReglee {
  type: 'effacee' | 'envoyee';
  id: string;
}

/** Un pas de la file : une seule opération, les suppressions d'abord. Rend ce
 *  qui est réglé, ou null — rien à faire, ou un serveur qui ne prend pas ce
 *  coup-ci : la file reste telle quelle et on réessaie plus tard. */
export async function traiterFileMesures(
  partage: Partage,
  file: { aEffacer: readonly string[]; aEnvoyer: readonly string[]; mesures: readonly Mesure[] },
): Promise<MesureReglee | null> {
  const aEffacer = file.aEffacer[0];
  if (aEffacer !== undefined) return (await effacerMesure(partage, aEffacer)) ? { type: 'effacee', id: aEffacer } : null;
  const id = file.aEnvoyer[0];
  if (id === undefined) return null;
  const mesure = file.mesures.find((m) => m.id === id);
  // Une mesure supprimée entre-temps : il n'y a plus rien à envoyer.
  const regle = mesure ? await envoyerMesure(partage, mesure) : true;
  return regle ? { type: 'envoyee', id } : null;
}

/** La file sans ce qui vient d'être réglé. */
export const sansMesureReglee = (etat: EntrainementState, regle: MesureReglee): EntrainementState =>
  regle.type === 'effacee'
    ? { ...etat, mesuresAEffacer: (etat.mesuresAEffacer ?? []).filter((x) => x !== regle.id) }
    : { ...etat, mesuresAEnvoyer: (etat.mesuresAEnvoyer ?? []).filter((x) => x !== regle.id) };

export interface MesureDeQuelquun {
  personne: Personne;
  mesure: Mesure;
}

/** Une mesure reçue du serveur, relue comme le téléphone relit les siennes. */
function lireMesureDeQuelquun(brut: unknown): MesureDeQuelquun | null {
  if (!estObjet(brut) || (brut.personne !== 'sebastien' && brut.personne !== 'max')) return null;
  const mesure = lireMesure(brut.mesure);
  return mesure ? { personne: brut.personne, mesure } : null;
}

/** Les mesures des deux, du serveur ; null quand il ne répond pas. */
export async function chargerMesuresPartagees(
  partage: Pick<Partage, 'serveur' | 'equipe'>,
): Promise<MesureDeQuelquun[] | null> {
  try {
    const reponse = await fetch(`${partage.serveur}/api/equipes/${partage.equipe}/mesures`, { cache: 'no-store' });
    if (!reponse.ok) return null;
    const { mesures } = (await reponse.json()) as { mesures?: unknown };
    if (!Array.isArray(mesures)) return null;
    return mesures.map(lireMesureDeQuelquun).filter((m): m is MesureDeQuelquun => m !== null);
  } catch {
    return null;
  }
}
