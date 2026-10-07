// Les mensurations : le poids de corps, la taille et l'âge, notés à une date.
// La première mesure est le point de départ, le « jour 1 » ; on en ajoute une
// quand on veut — une fois par mois, c'est le bon rythme.
//
// Ce fichier est partagé avec le serveur, qui l'importe tel quel (Node lit le
// TypeScript) pour relire une mesure comme le téléphone la relit : aucune
// dépendance, que des types effaçables.
import type { Mesure, UnitePoids } from '../types';

/** Ce qu'une mesure peut valoir : large, pour ne refuser que l'absurde. */
export const LIMITES_MESURE = {
  poids: { lb: { min: 40, max: 700 }, kg: { min: 20, max: 320 } },
  tailleCm: { min: 90, max: 250 },
  age: { min: 5, max: 120 },
} as const;

/** Un identifiant que le serveur accepte (le même que pour une séance). */
export const IDENTIFIANT_MESURE = /^[A-Za-z0-9_-]{4,64}$/;

/** Le téléphone n'en garde pas plus : à une par mois, c'est plus de quatre-vingts
 *  ans. Une sauvegarde abîmée ne le remplit pas. */
export const MESURES_MAXI = 1000;

/** Une mesure par mois suffit : le corps change lentement. Au-delà, un rappel. */
export const JOURS_ENTRE_MESURES = 30;

const JOUR_MS = 24 * 60 * 60 * 1000;

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Au dixième près : 182,40000001 devient 182,4. */
const dixieme = (n: number): number => Math.round(n * 10) / 10;

// ------------------------------------------------------------- Les jours

/** Le jour d'un instant, à l'heure du téléphone : AAAA-MM-JJ. */
export function jourLocal(date: Date = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

/** Un jour AAAA-MM-JJ qui existe vraiment (pas un 31 février), de 2000 à 2100. */
export function jourValide(brut: unknown): brut is string {
  if (typeof brut !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(brut)) return false;
  const [annee, mois, jour] = brut.split('-').map(Number);
  if (annee < 2000 || annee > 2100) return false;
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  return date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour;
}

/** Le nombre de jours entre deux jours AAAA-MM-JJ ; négatif si la fin vient
 *  avant le début. Compté en temps universel : l'heure d'été n'y change rien. */
export function joursEntre(debut: string, fin: string): number {
  const instant = (jour: string) => {
    const [annee, mois, j] = jour.split('-').map(Number);
    return Date.UTC(annee, mois - 1, j);
  };
  return Math.round((instant(fin) - instant(debut)) / JOUR_MS);
}

// ------------------------------------------------------------- Relire une mesure

/** Relit une mesure reçue ou sauvegardée : null si elle ne se lit pas. Ne garde
 *  que les champs connus, et arrondit au dixième. Le téléphone et le serveur
 *  la relisent de la même façon. */
export function lireMesure(brut: unknown): Mesure | null {
  if (!estObjet(brut)) return null;
  const { id, date, poids, unitePoids, tailleCm, age } = brut;
  if (typeof id !== 'string' || !IDENTIFIANT_MESURE.test(id)) return null;
  if (!jourValide(date)) return null;
  if (unitePoids !== 'lb' && unitePoids !== 'kg') return null;
  const limitesPoids = LIMITES_MESURE.poids[unitePoids];
  if (typeof poids !== 'number' || !(poids >= limitesPoids.min && poids <= limitesPoids.max)) return null;
  const taille = LIMITES_MESURE.tailleCm;
  if (typeof tailleCm !== 'number' || !(tailleCm >= taille.min && tailleCm <= taille.max)) return null;
  const ages = LIMITES_MESURE.age;
  if (typeof age !== 'number' || !Number.isInteger(age) || age < ages.min || age > ages.max) return null;
  return { id, date, poids: dixieme(poids), unitePoids, tailleCm: dixieme(tailleCm), age };
}

/** Du plus ancien jour au plus récent ; le même jour, dans l'ordre où elles
 *  ont été notées (l'identifiant commence par l'heure). */
export function trierMesures(mesures: readonly Mesure[]): Mesure[] {
  return [...mesures].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id === b.id ? 0 : a.id < b.id ? -1 : 1,
  );
}

/** Relit la liste sauvegardée : les mesures illisibles et les doublons sont
 *  écartés, le reste est remis dans l'ordre. Une sauvegarde d'avant les
 *  mensurations n'en a pas : liste vide. */
export function lireMesures(brut: unknown): Mesure[] {
  if (!Array.isArray(brut)) return [];
  const vues = new Set<string>();
  const lues: Mesure[] = [];
  for (const element of brut) {
    const mesure = lireMesure(element);
    if (!mesure || vues.has(mesure.id)) continue;
    vues.add(mesure.id);
    lues.push(mesure);
  }
  return trierMesures(lues).slice(-MESURES_MAXI);
}

/** Un identifiant tout neuf : l'heure d'abord, un peu de hasard ensuite. */
export const nouvelIdMesure = (): string => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ------------------------------------------------------------- La taille

/** La taille en pieds et pouces, au pouce près : 178 cm font 5 pi 10 po. */
export function piedsPouces(cm: number): { pieds: number; pouces: number } {
  const pouces = Math.round(cm / 2.54);
  return { pieds: Math.floor(pouces / 12), pouces: pouces % 12 };
}

/** « 5 pi 10 po », ou « 6 pi » quand il ne reste pas de pouces. */
export function libellePiedsPouces(cm: number): string {
  const { pieds, pouces } = piedsPouces(cm);
  return pouces === 0 ? `${pieds} pi` : `${pieds} pi ${pouces} po`;
}

// ------------------------------------------------------------- Le rappel

/** Les jours écoulés depuis la dernière mesure ; null quand il n'y en a pas. */
export function joursDepuisDerniereMesure(
  mesures: readonly Pick<Mesure, 'date'>[],
  aujourdhui: string = jourLocal(),
): number | null {
  if (mesures.length === 0) return null;
  const derniere = mesures.reduce((plusRecente, m) => (m.date > plusRecente ? m.date : plusRecente), mesures[0].date);
  return joursEntre(derniere, aujourdhui);
}

/** Le rappel discret : la dernière mesure date de plus de 30 jours. Sans
 *  aucune mesure, rien à rappeler — l'écran propose de noter le jour 1. */
export function rappelMesure(
  mesures: readonly Pick<Mesure, 'date'>[],
  aujourdhui: string = jourLocal(),
): { jours: number } | null {
  const jours = joursDepuisDerniereMesure(mesures, aujourdhui);
  return jours !== null && jours > JOURS_ENTRE_MESURES ? { jours } : null;
}

// ------------------------------------------------------------- Le formulaire

/** Ce qu'on tape, tel quel : du texte. */
export interface SaisieMesure {
  date: string;
  poids: string;
  tailleCm: string;
  age: string;
}

export type ErreursSaisie = Partial<Record<keyof SaisieMesure, string>>;

export type ResultatSaisie =
  | { ok: true; valeurs: Pick<Mesure, 'date' | 'poids' | 'tailleCm' | 'age'> }
  | { ok: false; erreurs: ErreursSaisie };

/** Un nombre tapé au clavier : la virgule vaut le point, les espaces ne
 *  comptent pas. null si ce n'est pas un nombre. */
export function lireNombre(texte: string): number | null {
  const propre = texte.replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(propre) ? Number(propre) : null;
}

/** Vérifie ce qu'on a tapé, dans l'unité du moment, et dit en français simple
 *  ce qui ne va pas. */
export function verifierSaisie(
  saisie: SaisieMesure,
  unite: UnitePoids,
  aujourdhui: string = jourLocal(),
): ResultatSaisie {
  const erreurs: ErreursSaisie = {};
  const limitesPoids = LIMITES_MESURE.poids[unite];
  const limitesTaille = LIMITES_MESURE.tailleCm;
  const limitesAge = LIMITES_MESURE.age;

  if (!jourValide(saisie.date)) erreurs.date = 'Choisis le jour de la mesure.';
  else if (saisie.date > aujourdhui) erreurs.date = 'Ce jour n’est pas encore arrivé.';

  const poids = lireNombre(saisie.poids);
  if (poids === null || poids < limitesPoids.min || poids > limitesPoids.max) {
    erreurs.poids = `Écris ton poids, entre ${limitesPoids.min} et ${limitesPoids.max} ${unite}.`;
  }
  const taille = lireNombre(saisie.tailleCm);
  if (taille === null || taille < limitesTaille.min || taille > limitesTaille.max) {
    erreurs.tailleCm = `Écris ta taille en centimètres, entre ${limitesTaille.min} et ${limitesTaille.max}.`;
  }
  const age = lireNombre(saisie.age);
  if (age === null || !Number.isInteger(age) || age < limitesAge.min || age > limitesAge.max) {
    erreurs.age = `Écris ton âge en années, entre ${limitesAge.min} et ${limitesAge.max}.`;
  }

  // Les trois nombres sont lus quand il n'y a pas d'erreur : le test les rend sûrs pour TypeScript.
  if (Object.keys(erreurs).length > 0 || poids === null || taille === null || age === null) {
    return { ok: false, erreurs };
  }
  return { ok: true, valeurs: { date: saisie.date, poids: dixieme(poids), tailleCm: dixieme(taille), age } };
}
