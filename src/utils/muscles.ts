// Recherche d'exercices par muscle.
//
// Chaque case des posters porte une planche anatomique : une silhouette de
// face et de dos, muscles travaillés en noir, muscles secondaires en gris.
// Ces lectures sont inscrites dans `musclesPrincipaux` et `musclesSecondaires`.
//
// C'est ce qui permet de répondre à « renforce mon bas du dos ». La question ne
// se pose pas en termes de groupe musculaire principal — presque aucun exercice
// n'a les lombaires pour cible — mais en termes de sollicitation : quels
// exercices les font travailler, et à quel point.

import type { Exercice, Muscle } from '../types';
import { NOM_MUSCLE } from '../data/exercices';

/** Degré de sollicitation d'un muscle par un exercice. */
export type Sollicitation = 'principal' | 'secondaire' | null;

export function sollicitation(exercice: Exercice, muscle: Muscle): Sollicitation {
  if (exercice.musclesPrincipaux?.includes(muscle)) return 'principal';
  if (exercice.musclesSecondaires?.includes(muscle)) return 'secondaire';
  return null;
}

/** Tous les muscles d'un exercice, principaux d'abord. */
export function musclesDe(exercice: Exercice): Muscle[] {
  return [...(exercice.musclesPrincipaux ?? []), ...(exercice.musclesSecondaires ?? [])];
}

/** Note de pertinence d'un exercice pour une liste de muscles visés.
 *
 *  Un muscle principal vaut trois fois un muscle secondaire : entre un rowing
 *  qui noircit le bas du dos et un squat qui le grise, on veut le rowing en
 *  tête. À note égale, l'exercice qui vise le moins de muscles à la fois passe
 *  devant : il est plus ciblé, donc plus utile quand on veut travailler une
 *  zone précise. */
export function pertinence(exercice: Exercice, vises: Muscle[]): number {
  let note = 0;
  for (const muscle of vises) {
    const degre = sollicitation(exercice, muscle);
    if (degre === 'principal') note += 3;
    else if (degre === 'secondaire') note += 1;
  }
  return note;
}

/** Exercices qui sollicitent au moins un des muscles visés, du plus direct au
 *  plus accessoire. */
export function exercicesPourMuscles(exercices: Exercice[], vises: Muscle[]): Exercice[] {
  if (vises.length === 0) return [];
  return exercices
    .map((exercice) => ({ exercice, note: pertinence(exercice, vises) }))
    .filter(({ note }) => note > 0)
    .sort((a, b) => {
      if (b.note !== a.note) return b.note - a.note;
      // À égalité, le plus ciblé d'abord.
      const largeur = (e: Exercice) => musclesDe(e).length;
      if (largeur(a.exercice) !== largeur(b.exercice)) {
        return largeur(a.exercice) - largeur(b.exercice);
      }
      return a.exercice.nomFr.localeCompare(b.exercice.nomFr, 'fr');
    })
    .map(({ exercice }) => exercice);
}

/** Objectifs musculaires prêts à l'emploi : une poignée de muscles qui se
 *  travaillent ensemble et que l'on vise d'un bloc. Les deux premiers sont
 *  ceux qui lâchent le plus souvent après la cinquantaine et sous le grappling
 *  — le bas du dos et la ceinture scapulaire. */
export const OBJECTIFS_MUSCULAIRES: {
  id: string;
  nom: string;
  muscles: Muscle[];
  description: string;
}[] = [
  {
    id: 'bas-du-dos',
    nom: 'Bas du dos',
    muscles: ['lombaires', 'fessiers', 'ischios'],
    description:
      'Érecteurs du rachis, fessiers et ischio-jambiers : la chaîne qui tient le dos debout.',
  },
  {
    id: 'epaules',
    nom: 'Épaules',
    muscles: ['epaules', 'coiffe-rotateurs', 'trapezes'],
    description: 'Deltoïdes, coiffe des rotateurs et trapèzes, l’articulation la plus mobile.',
  },
  {
    id: 'bras',
    nom: 'Bras',
    muscles: ['biceps', 'triceps', 'avant-bras'],
    description: 'Biceps, triceps et avant-bras — la prise comprise.',
  },
  {
    id: 'tronc',
    nom: 'Tronc',
    muscles: ['abdominaux', 'obliques', 'lombaires'],
    description: 'La ceinture complète, abdominaux et bas du dos ensemble.',
  },
  {
    id: 'jambes',
    nom: 'Jambes',
    muscles: ['quadriceps', 'ischios', 'fessiers', 'adducteurs', 'mollets'],
    description: 'Tout le bas du corps, des fessiers aux mollets.',
  },
  {
    id: 'haut-du-dos',
    nom: 'Haut du dos',
    muscles: ['dorsaux', 'trapezes'],
    description: 'Grand dorsal et trapèzes : ce qui tire, et ce qui tient les épaules en arrière.',
  },
];

/** « Bas du dos, fessiers » : les muscles visés, en toutes lettres. */
export function libelleMuscles(muscles: Muscle[]): string {
  return muscles.map((muscle) => NOM_MUSCLE[muscle]).join(', ');
}
