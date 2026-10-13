// Sur un seul téléphone, exercice par exercice (décision de Sébastien, 13
// octobre 2026) : tout l'exercice — ou toute la paire — à l'écran d'un coup,
// les séries des deux, et un seul « Exercice terminé ». Ce module garde ce qui
// se décide sans écran : les visages qui manquent encore (ils sont
// obligatoires), les charges à noter d'office, et la pause qu'on prend entre
// deux tours, d'un toucher, sans changer d'exercice.
import type { BlocSeries, Ressenti } from '../types';
import { exerciceDeSeance } from './etapesSeance';
import type { SerieDeLExercice } from './etapesSeance';
import { seCharge } from './charges';

/** Une colonne de la liste : la personne du téléphone, ou l'autre. */
export type Qui = 'moi' | 'autre';

/** Les séries d'une colonne sur un bloc. */
export const seriesDe = (bloc: BlocSeries, qui: Qui): number => (qui === 'moi' ? bloc.series : (bloc.autre?.series ?? 0));

/** Un visage pas encore choisi : de qui, sur quel exercice. */
export interface VisageManquant {
  qui: Qui;
  exerciceId: string;
}

/** Les visages qui manquent pour finir l'exercice ou la paire : un par
 *  personne, sur chaque exercice où elle a des séries et une charge à monter,
 *  dans l'ordre de l'écran — les exercices de la paire, puis les colonnes. Le
 *  Superman sans poids, les planches : rien à monter, rien à demander. */
export function visagesManquants(
  groupe: readonly BlocSeries[],
  colonnes: readonly Qui[],
  ressentiDe: (qui: Qui, exerciceId: string) => Ressenti | undefined,
): VisageManquant[] {
  return groupe.flatMap((bloc) =>
    seCharge(exerciceDeSeance(bloc.exerciceId))
      ? colonnes
          .filter((qui) => seriesDe(bloc, qui) > 0 && ressentiDe(qui, bloc.exerciceId) === undefined)
          .map((qui) => ({ qui, exerciceId: bloc.exerciceId }))
      : [],
  );
}

/** Ce que dit le gros bouton tant qu'il manque un visage, le premier qui
 *  manque : « Choisis un visage : Big Max, Curl alterné ». Le nom de
 *  l'exercice seulement dans une paire (`paire`), où il y en a deux — sinon
 *  il est long et ne dit rien de plus ; seul, sans nom de personne. */
export function phraseVisageManquant(
  manquant: VisageManquant,
  nomDe?: (qui: Qui) => string | undefined,
  paire = true,
): string {
  const nom = nomDe?.(manquant.qui);
  const exercice = exerciceDeSeance(manquant.exerciceId).nomFr;
  const precisions = [nom, paire || !nom ? exercice : undefined].filter(Boolean).join(', ');
  return `Choisis un visage : ${precisions}`;
}

/** Ce que « Exercice terminé » note d'office : chaque série qui se charge,
 *  pour celui qui l'a faite, ou pour les deux. On ne tape que ce qui change :
 *  ce qui est affiché est ce qui est fait. */
export function seriesANoter(series: readonly SerieDeLExercice[]): { qui: Qui; exerciceId: string; serie: number }[] {
  return series.flatMap((serie) => {
    if (!seCharge(exerciceDeSeance(serie.exerciceId))) return [];
    const qui: Qui[] = serie.qui === 'les-deux' ? ['moi', 'autre'] : serie.qui === 'autre' ? ['autre'] : ['moi'];
    return qui.map((q) => ({ qui: q, exerciceId: serie.exerciceId, serie: serie.serie }));
  });
}

// ------------------------------------------------------------- La pause du tour

/** La pause qu'on prend entre deux tours, d'un toucher (« Pause · 1 min ») :
 *  elle compte sa minute — une minute trente à la trap bar —, sonne et vibre à
 *  la fin, et ne change pas d'exercice. Elle appartient à l'exercice où on l'a
 *  lancée (`visite`, le numéro de passage de l'étape) : en changer l'oublie. */
export interface PauseTour {
  visite: number;
  debutMs: number;
  dureeSec: number;
}

export const lancerPauseTour = (visite: number, maintenantMs: number, dureeSec: number): PauseTour => ({
  visite,
  debutMs: maintenantMs,
  dureeSec,
});

/** Ce qu'il reste de la pause, en secondes ; null s'il n'y en a pas — ou plus,
 *  si l'exercice a changé depuis. Jamais plus que sa durée : l'horloge de
 *  l'écran peut avoir un battement de retard sur le toucher. */
export function restePauseTourSec(pause: PauseTour | null, visite: number | undefined, maintenantMs: number): number | null {
  if (!pause || visite === undefined || pause.visite !== visite) return null;
  return Math.min(pause.dureeSec, Math.max(0, pause.dureeSec - (maintenantMs - pause.debutMs) / 1000));
}
