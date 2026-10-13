// 👎 « Pas aimé » : un exercice qu'une personne n'a pas aimé, dit d'un toucher
// dans la séance, à côté de « J'ai mal » (décision de Sébastien, 13 octobre
// 2026). Facultatif, et rien n'est bloqué : la fois suivante où l'exercice
// revient, l'accueil le rappelle — « Pas aimé par Big Max · Changer ? » — et
// ouvre « Changer » d'un toucher.
//
// Comme les douleurs, sur ce téléphone seulement : ceux de la personne du
// téléphone (`pasAimes`), ceux de l'autre à part (`pasAimesAutre`). Rien ne
// part vers le serveur ni vers l'autre téléphone.
import type { EntrainementState, Personne } from '../types';

/** De qui est le 👎 : la personne du téléphone, ou l'autre. */
export type QuiPasAime = 'moi' | 'autre';

/** Le champ de la sauvegarde où vivent ceux de chacun. */
const CHAMP: Record<QuiPasAime, 'pasAimes' | 'pasAimesAutre'> = { moi: 'pasAimes', autre: 'pasAimesAutre' };

type AvecPasAimes = Pick<EntrainementState, 'pasAimes' | 'pasAimesAutre'>;

const aLExercice = (pasAimes: Record<string, string> | undefined, exerciceId: string): boolean =>
  pasAimes !== undefined && Object.prototype.hasOwnProperty.call(pasAimes, exerciceId);

/** Ceux de l'un ou de l'autre : exercice → quand on l'a dit (ISO). */
export const pasAimesDe = (etat: AvecPasAimes, qui: QuiPasAime): Record<string, string> => etat[CHAMP[qui]] ?? {};

/** L'un ou l'autre n'a pas aimé cet exercice. */
export const pasAime = (etat: AvecPasAimes, qui: QuiPasAime, exerciceId: string): boolean =>
  aLExercice(etat[CHAMP[qui]], exerciceId);

/** Dit 👎 pour l'un ou l'autre, ou le retire s'il y était : ce qui change
 *  dans l'état. Ceux de l'autre personne ne bougent pas ; aucun, plus de
 *  champ. */
export function basculerPasAimeDe(
  etat: AvecPasAimes,
  qui: QuiPasAime,
  exerciceId: string,
  maintenant: Date = new Date(),
): AvecPasAimes {
  const suivants = { ...(etat[CHAMP[qui]] ?? {}) };
  if (aLExercice(suivants, exerciceId)) delete suivants[exerciceId];
  else suivants[exerciceId] = maintenant.toISOString();
  return { [CHAMP[qui]]: Object.keys(suivants).length > 0 ? suivants : undefined };
}

/** Ceux d'une sauvegarde : une sauvegarde d'avant n'en a pas, une abîmée perd
 *  seulement ce qui ne se lit plus ; aucun, rien. */
export function lirePasAimes(brut: unknown): Record<string, string> | undefined {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return undefined;
  const lus = Object.fromEntries(
    Object.entries(brut as Record<string, unknown>).filter(
      (entree): entree is [string, string] => typeof entree[1] === 'string',
    ),
  );
  return Object.keys(lus).length > 0 ? lus : undefined;
}

/** Qui n'a pas aimé cet exercice, parmi ceux qui s'entraînent ici : la
 *  personne du téléphone (`moi`), et l'autre quand le téléphone note pour lui
 *  (`autre`). Speedy d'abord. Sans personne connue, `null` pour celle du
 *  téléphone. */
export function quiNAimePas(
  etat: AvecPasAimes,
  exerciceId: string,
  moi: Personne | null,
  autre: Personne | null,
): (Personne | null)[] {
  const qui: (Personne | null)[] = [];
  if (pasAime(etat, 'moi', exerciceId)) qui.push(moi);
  if (autre && pasAime(etat, 'autre', exerciceId)) qui.push(autre);
  return qui.sort((a, b) => Number(b === 'sebastien') - Number(a === 'sebastien'));
}
