// Quitter une séance en cours : une seule question, trois réponses —
// « Reprendre plus tard », « Enregistrer ce qui est fait », « Tout jeter » —
// et « Continuer la séance » pour renoncer. Un essai ne garde rien : on le
// quitte, ou on continue.
import type { SeanceRealisee } from '../types';
import { assezFaite } from './statistiques';

export type ChoixSortie = 'plus-tard' | 'enregistrer' | 'jeter' | 'continuer';

/** Les réponses proposées, dans l'ordre de l'écran. « Enregistrer ce qui
 *  est fait » n'a de sens qu'avec au moins une série faite. */
export function choixDeSortie({ essai, seriesFaites }: { essai: boolean; seriesFaites: number }): ChoixSortie[] {
  if (essai) return ['jeter', 'continuer'];
  return ['plus-tard', ...(seriesFaites > 0 ? (['enregistrer'] as const) : []), 'jeter', 'continuer'];
}

/** Les séries faites et prévues d'une séance. */
export function compteSeries(realisee: Pick<SeanceRealisee, 'exercices'>): { faites: number; prevues: number } {
  return realisee.exercices.reduce(
    (total, exo) => ({ faites: total.faites + exo.seriesFaites, prevues: total.prevues + exo.seriesPrevues }),
    { faites: 0, prevues: 0 },
  );
}

/** Sous « Enregistrer ce qui est fait » : ce qui sera gardé, et si la
 *  journée sera cochée — à partir de la moitié des séries. */
export function phraseEnregistrementPartiel(realisee: Pick<SeanceRealisee, 'exercices'>): string {
  const { faites, prevues } = compteSeries(realisee);
  const series = `${faites} série${faites > 1 ? 's' : ''} sur ${prevues}`;
  return assezFaite(realisee)
    ? `${series} : la journée sera cochée.`
    : `${series} : gardées dans l’historique, mais la journée ne sera pas cochée (moins de la moitié).`;
}
