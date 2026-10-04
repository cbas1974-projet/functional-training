// L'état partagé d'une séance à deux : ce que le serveur garde et diffuse, et
// les règles qui le font évoluer. Les deux téléphones et le serveur appliquent
// exactement ces règles — le serveur importe ce fichier tel quel (Node lit le
// TypeScript) : aucune dépendance, aucun import.

/** Un instant de l'horloge du serveur, en millisecondes. */
export type Instant = number;

export interface EtatCommun {
  /** Départ : le premier qui appuie sur « Commencer ». */
  debut: Instant;
  /** Le « Go » de chaque exercice, par numéro de groupe. */
  go: Record<string, Instant>;
  /** Les pauses communes ; la dernière peut être en cours. */
  pauses: { debut: Instant; fin?: Instant }[];
  /** Les sauts de l'horloge commune : une attente écourtée (secondes
   *  positives, l'horloge avance d'un coup) ou prolongée (négatives,
   *  l'horloge s'arrête autant de secondes à partir de `a`). */
  sauts: { a: Instant; sec: number }[];
  /** Le dernier changement. Les appuis suivants comptent au plus tôt à cet
   *  instant : l'histoire ne se réécrit pas. */
  maj: Instant;
  /** Les envois déjà appliqués : un envoi répété ne compte qu'une fois. */
  vues: string[];
  /** Numéro de version, donné par le serveur à chaque changement : un
   *  téléphone ne remplace jamais l'état qu'il a par un plus ancien. */
  rev?: number;
}

export type ActionCommune =
  | { type: 'commencer' }
  | { type: 'go'; groupe: number }
  | { type: 'pause' }
  | { type: 'reprendre' }
  /** Écourter une attente : l'horloge commune avance jusqu'à `cible`
   *  secondes depuis le départ `depuis` (le début, ou le dernier « Go »). Si
   *  elle y est déjà — l'autre a appuyé aussi, ou l'appui arrive après
   *  coup —, rien ne change. */
  | { type: 'saut'; depuis: Instant; cible: number }
  /** Prolonger une attente : l'horloge commune s'arrête `sec` secondes. */
  | { type: 'prolonger'; sec: number };

/** Un appui sur un téléphone, tel qu'il part au serveur. */
export interface EnvoiAction {
  /** Unique : c'est lui qui écarte les doublons quand le réseau répète. */
  id: string;
  /** L'instant de l'appui, sur l'horloge du serveur. */
  a: Instant;
  action: ActionCommune;
}

/** Une séance commune sans nouvelle depuis trois heures est finie : un
 *  nouveau « Commencer » repart de zéro. */
export const EXPIRATION_MS = 3 * 60 * 60 * 1000;
/** Un saut ne dépasse jamais une heure, dans un sens ou dans l'autre. */
const SAUT_MAXI_SEC = 3600;
/** Une prolongation ne dépasse pas cinq minutes. */
const PROLONGATION_MAXI_SEC = 300;
const VUES_MAXI = 300;

export const enPause = (etat: EtatCommun): boolean => {
  const derniere = etat.pauses[etat.pauses.length - 1];
  return derniere !== undefined && derniere.fin === undefined;
};

const fermerPause = (pauses: EtatCommun['pauses'], a: Instant): EtatCommun['pauses'] => {
  const derniere = pauses[pauses.length - 1];
  if (!derniere || derniere.fin !== undefined) return pauses;
  return [...pauses.slice(0, -1), { debut: derniere.debut, fin: Math.max(a, derniere.debut) }];
};

/** Le départ en cours à l'instant `a` : le début, ou le dernier « Go ». */
export const departA = (etat: EtatCommun, a: Instant): Instant =>
  Object.values(etat.go).reduce((dernier, go) => (go <= a && go > dernier ? go : dernier), etat.debut);

/** Applique un appui à l'état. Rien ne change pour un doublon, un « Go »
 *  déjà donné, une pause déjà prise, une reprise sans pause, ou une attente
 *  déjà écourtée. */
export function appliquer(etat: EtatCommun | null, envoi: EnvoiAction): EtatCommun | null {
  const { action, id } = envoi;
  if (action.type === 'commencer') {
    // Déjà commencée : on la rejoint.
    if (etat && envoi.a - etat.maj < EXPIRATION_MS) return etat;
    return { debut: envoi.a, go: {}, pauses: [], sauts: [], maj: envoi.a, vues: [id] };
  }
  if (!etat || etat.vues.includes(id)) return etat;
  // Un appui compte au plus tôt au dernier changement : arrivé en retard, il
  // ne se glisse pas avant ce qui est déjà joué.
  const a = Math.max(envoi.a, etat.maj);
  const vue = { maj: a, vues: [...etat.vues, id].slice(-VUES_MAXI) };
  switch (action.type) {
    case 'go': {
      const cle = String(action.groupe);
      if (etat.go[cle] !== undefined) return etat;
      // « Go » pendant une pause : la pause finit.
      return { ...etat, ...vue, go: { ...etat.go, [cle]: a }, pauses: fermerPause(etat.pauses, a) };
    }
    case 'pause':
      return enPause(etat) ? etat : { ...etat, ...vue, pauses: [...etat.pauses, { debut: a }] };
    case 'reprendre':
      return enPause(etat) ? { ...etat, ...vue, pauses: fermerPause(etat.pauses, a) } : etat;
    case 'saut': {
      // Un « Go » a changé le départ : l'attente visée est passée.
      if (departA(etat, a) !== action.depuis) return etat;
      const sec = Math.min(action.cible - tempsActifMs(etat, action.depuis, a) / 1000, SAUT_MAXI_SEC);
      return sec > 0.05 ? { ...etat, ...vue, sauts: [...etat.sauts, { a, sec }] } : etat;
    }
    case 'prolonger': {
      // À la suite des prolongations en cours : deux appuis, deux fois plus.
      const debut = etat.sauts.reduce((fin, s) => (s.sec < 0 ? Math.max(fin, s.a - s.sec * 1000) : fin), a);
      return { ...etat, ...vue, sauts: [...etat.sauts, { a: debut, sec: -action.sec }] };
    }
  }
}

/** Millisecondes d'horloge commune écoulées entre `depuis` et `t` : sans les
 *  pauses, et avec les sauts quand on les demande — les attentes écourtées
 *  avancent l'horloge, les prolongations l'arrêtent un moment. */
export function tempsActifMs(etat: EtatCommun, depuis: Instant, t: Instant, avecSauts = true): number {
  if (t <= depuis) return 0;
  // Les moments où l'horloge est arrêtée, fusionnés : deux arrêts qui se
  // chevauchent n'ôtent le temps qu'une fois.
  const arrets: [Instant, Instant][] = etat.pauses.map((p) => [p.debut, p.fin ?? t]);
  if (avecSauts) for (const s of etat.sauts) if (s.sec < 0) arrets.push([s.a, s.a - s.sec * 1000]);
  arrets.sort((x, y) => x[0] - y[0]);
  let actif = t - depuis;
  let couvert = depuis;
  for (const [debut, fin] of arrets) {
    const ote = Math.min(fin, t) - Math.max(debut, couvert);
    if (ote > 0) actif -= ote;
    couvert = Math.max(couvert, fin);
  }
  if (avecSauts) {
    // Un saut au même instant qu'un « Go » appartient à l'exercice d'avant.
    for (const s of etat.sauts) if (s.sec > 0 && s.a > depuis && s.a <= t) actif += s.sec * 1000;
  }
  return Math.max(0, actif);
}

// ------------------------------------------------------------- Lecture

const estInstant = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Relit un état venu du réseau ou d'une sauvegarde ; null s'il est
 *  illisible. */
export function lireEtat(brut: unknown): EtatCommun | null {
  if (!estObjet(brut) || !estInstant(brut.debut) || !estInstant(brut.maj)) return null;
  const go: Record<string, Instant> = {};
  if (estObjet(brut.go)) {
    for (const [cle, valeur] of Object.entries(brut.go)) {
      if (/^\d{1,3}$/.test(cle) && estInstant(valeur)) go[cle] = valeur;
    }
  }
  const pauses = Array.isArray(brut.pauses)
    ? brut.pauses
        .filter((p): p is { debut: number; fin?: number } => estObjet(p) && estInstant(p.debut) && (p.fin === undefined || estInstant(p.fin)))
        .map((p) => (p.fin === undefined ? { debut: p.debut } : { debut: p.debut, fin: p.fin }))
    : [];
  const sauts = Array.isArray(brut.sauts)
    ? brut.sauts
        .filter((s): s is { a: number; sec: number } => estObjet(s) && estInstant(s.a) && typeof s.sec === 'number' && Math.abs(s.sec) <= SAUT_MAXI_SEC)
        .map((s) => ({ a: s.a, sec: s.sec }))
    : [];
  const vues = Array.isArray(brut.vues) ? brut.vues.filter((v): v is string => typeof v === 'string').slice(-VUES_MAXI) : [];
  return { debut: brut.debut, go, pauses, sauts, maj: brut.maj, vues, ...(estInstant(brut.rev) ? { rev: brut.rev } : {}) };
}

/** Relit un appui reçu par le serveur ; null s'il est illisible. */
export function lireEnvoi(brut: unknown): EnvoiAction | null {
  if (!estObjet(brut) || typeof brut.id !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(brut.id)) return null;
  if (!estInstant(brut.a) || !estObjet(brut.action)) return null;
  const action = brut.action;
  switch (action.type) {
    case 'commencer':
    case 'pause':
    case 'reprendre':
      return { id: brut.id, a: brut.a, action: { type: action.type } };
    case 'go':
      return typeof action.groupe === 'number' && Number.isInteger(action.groupe) && action.groupe >= 0 && action.groupe < 100
        ? { id: brut.id, a: brut.a, action: { type: 'go', groupe: action.groupe } }
        : null;
    case 'saut':
      return estInstant(action.depuis) && estInstant(action.cible) && action.cible <= EXPIRATION_MS / 1000
        ? { id: brut.id, a: brut.a, action: { type: 'saut', depuis: action.depuis, cible: action.cible } }
        : null;
    case 'prolonger':
      return estInstant(action.sec) && action.sec > 0 && action.sec <= PROLONGATION_MAXI_SEC
        ? { id: brut.id, a: brut.a, action: { type: 'prolonger', sec: action.sec } }
        : null;
    default:
      return null;
  }
}
