// La semaine que composait l'application avant le 12 octobre 2026 (version 7
// du programme, graine 3, premier lundi le 5 octobre 2026), quand chacun
// suivait la séance sur son téléphone : la trap bar en paire avec le haut du
// corps, les deux machines des cuisses ensemble, l'intérieur avec l'extérieur
// de cuisse.
//
// Les tests de l'horloge commune sur deux téléphones — cachée
// (`SEANCE_COMMUNE`), pas supprimée — s'en servent : elle a ce qu'ils
// vérifient (on se croise sur une machine, deux machines en paire, la série
// de plus de Big Max…), que la composition d'aujourd'hui ne fait plus — deux
// exercices de la même zone ne vont plus jamais ensemble. Elle ne passe pas
// par `validerProgramme`, qui la recomposerait.
import type { ProgrammeMois, SeanceDuMois } from '../types';
import { genererProgramme } from './programmeMois';

export const SEMAINE_DEUX_TELEPHONES: SeanceDuMois[] = [
  {
    id: 'lundi-a',
    nom: 'Lundi A — tout le corps',
    jour: 1,
    semaine: 'A',
    type: 'dure',
    partie: 'complet',
    format: 'series',
    exercices: ['trap-bar-deadlift', 'kb-rear-fly', 'superman', 'kb-plank-oblique-pull-through', 'arnold-press', 'dumbbell-pullover', 'incline-row', 'bench-press'],
    finale: 'hack-squat',
    liens: [
      ['trap-bar-deadlift', 'kb-rear-fly'],
      ['superman', 'kb-plank-oblique-pull-through'],
      ['arnold-press', 'dumbbell-pullover'],
      ['incline-row', 'bench-press'],
    ],
    tour: ['trap-bar-deadlift', 'hack-squat'],
  },
  {
    id: 'mardi-a',
    nom: 'Mardi A — le haut',
    jour: 2,
    semaine: 'A',
    type: 'facile',
    partie: 'haut',
    format: 'series',
    exercices: ['no-money-curl', 'tripod-row', 'single-arm-row', 'dumbbell-push-up', 'alternating-curl', 'skull-crusher'],
    finale: 'kb-farmers-walk',
    liens: [
      ['no-money-curl', 'tripod-row'],
      ['single-arm-row', 'dumbbell-push-up'],
      ['alternating-curl', 'skull-crusher'],
    ],
  },
  {
    id: 'jeudi-a',
    nom: 'Jeudi A — les jambes',
    jour: 4,
    semaine: 'A',
    type: 'facile',
    partie: 'bas',
    format: 'series',
    exercices: ['kb-double-arm-swing', 'reverse-fly', 'fire-hydrant', 'copenhagen-plank', 'leg-extension-machine', 'leg-curl-machine'],
    finale: 'traineau',
    liens: [
      ['kb-double-arm-swing', 'reverse-fly'],
      ['fire-hydrant', 'copenhagen-plank'],
      ['leg-extension-machine', 'leg-curl-machine'],
    ],
    tour: ['leg-extension-machine', 'leg-curl-machine', 'traineau'],
  },
  {
    id: 'lundi-b',
    nom: 'Lundi B — tout le corps',
    jour: 1,
    semaine: 'B',
    type: 'dure',
    partie: 'complet',
    format: 'series',
    exercices: ['trap-bar-deadlift', 'upright-row', 'superman', 'kb-around-the-body', 'kb-wall-squat-press', 'kb-single-arm-row', 'kb-lawn-mower', 'chest-squeeze-press'],
    finale: 'leg-press',
    liens: [
      ['trap-bar-deadlift', 'upright-row'],
      ['superman', 'kb-around-the-body'],
      ['kb-wall-squat-press', 'kb-single-arm-row'],
      ['kb-lawn-mower', 'chest-squeeze-press'],
    ],
    tour: ['trap-bar-deadlift', 'leg-press'],
  },
  {
    id: 'mardi-b',
    nom: 'Mardi B — le haut',
    jour: 2,
    semaine: 'B',
    type: 'facile',
    partie: 'haut',
    format: 'series',
    exercices: ['kb-halo', 'dumbbell-pullover', 'kb-chest-press', 'incline-row', 'grip-curl', 'kb-tricep-extension'],
    finale: 'kb-farmers-walk',
    liens: [
      ['kb-halo', 'dumbbell-pullover'],
      ['kb-chest-press', 'incline-row'],
      ['grip-curl', 'kb-tricep-extension'],
    ],
  },
  {
    id: 'jeudi-b',
    nom: 'Jeudi B — les jambes',
    jour: 4,
    semaine: 'B',
    type: 'facile',
    partie: 'bas',
    format: 'series',
    exercices: ['kb-double-arm-swing', 'kb-rear-fly', 'kb-side-leg-raise', 'copenhagen-plank', 'leg-extension-machine', 'leg-curl-machine'],
    finale: 'traineau',
    liens: [
      ['kb-double-arm-swing', 'kb-rear-fly'],
      ['kb-side-leg-raise', 'copenhagen-plank'],
      ['leg-extension-machine', 'leg-curl-machine'],
    ],
    tour: ['leg-extension-machine', 'leg-curl-machine', 'traineau'],
  },
];

/** Un programme de cette semaine-là : la recette d'aujourd'hui (graine 3, 5
 *  octobre 2026), les séances d'avant. */
export const programmeDeuxTelephones = (): ProgrammeMois => ({
  ...genererProgramme({ graine: 3, aujourdhui: new Date(2026, 9, 5) }),
  seances: SEMAINE_DEUX_TELEPHONES,
});
