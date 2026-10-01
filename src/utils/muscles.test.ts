import { describe, expect, it } from 'vitest';
import { EXERCICES, EXERCICES_PAR_ID, NOM_MUSCLE } from '../data/exercices';
import type { Exercice, Muscle } from '../types';
import {
  OBJECTIFS_MUSCULAIRES,
  exercicesPourMuscles,
  musclesDe,
  pertinence,
  sollicitation,
} from './muscles';

const MUSCULATION = EXERCICES.filter((e) => (e.famille ?? 'musculation') === 'musculation');

describe('lecture des planches anatomiques', () => {
  it('les 77 exercices chargés ont au moins un muscle principal', () => {
    expect(MUSCULATION).toHaveLength(77);
    const sans = MUSCULATION.filter((e) => (e.musclesPrincipaux ?? []).length === 0);
    expect(sans.map((e) => e.id)).toEqual([]);
  });

  it('n’annonce jamais un muscle à la fois principal et secondaire', () => {
    const fautifs = MUSCULATION.filter((e) =>
      (e.musclesSecondaires ?? []).some((m) => (e.musclesPrincipaux ?? []).includes(m)),
    );
    expect(fautifs.map((e) => e.id)).toEqual([]);
  });

  it('n’a pas de muscle répété dans une même liste', () => {
    const fautifs = MUSCULATION.filter((e) => {
      const tous = musclesDe(e);
      return new Set(tous).size !== tous.length;
    });
    expect(fautifs.map((e) => e.id)).toEqual([]);
  });

  it('nomme tous les muscles employés', () => {
    const employes = new Set<Muscle>(MUSCULATION.flatMap(musclesDe));
    for (const muscle of employes) expect(NOM_MUSCLE[muscle]).toBeTruthy();
  });
});

describe('recherche par muscle', () => {
  it('répond à « renforce mon bas du dos », du plus direct au plus accessoire', () => {
    const bas = OBJECTIFS_MUSCULAIRES.find((o) => o.id === 'bas-du-dos');
    expect(bas).toBeDefined();
    const trouves = exercicesPourMuscles(MUSCULATION, bas!.muscles);
    expect(trouves.length).toBeGreaterThanOrEqual(20);

    // Le soulevé de terre roumain y est, et devant le squat : il vise la
    // chaîne postérieure, le squat ne fait que la solliciter.
    const rang = (id: string) => trouves.findIndex((e) => e.id === id);
    expect(rang('romanian-deadlift')).toBeGreaterThanOrEqual(0);
    expect(rang('romanian-deadlift')).toBeLessThan(rang('squat'));

    // Le classement est décroissant, sans exception.
    const notes = trouves.map((e) => pertinence(e, bas!.muscles));
    expect(notes).toEqual([...notes].sort((a, b) => b - a));
  });

  it('répond à « épaules » en mettant la coiffe des rotateurs en tête', () => {
    const epaules = OBJECTIFS_MUSCULAIRES.find((o) => o.id === 'epaules');
    const trouves = exercicesPourMuscles(MUSCULATION, epaules!.muscles);
    expect(trouves.slice(0, 6).map((e) => e.id)).toContain('no-money-curl');
  });

  it('distingue le bas du dos du grand dorsal', () => {
    // Le rowing buste penché noircit les deux : le grand dorsal en cible, les
    // érecteurs en soutien. C'est la distinction que la zone « dos » ne faisait
    // pas.
    const rowing = EXERCICES_PAR_ID['bent-over-row'];
    expect(sollicitation(rowing, 'dorsaux')).toBe('principal');
    expect(sollicitation(rowing, 'lombaires')).toBe('secondaire');
    // Le curl marteau n'a rien à voir avec le dos.
    expect(sollicitation(EXERCICES_PAR_ID['hammer-curl'], 'lombaires')).toBeNull();
  });

  it('place le plus ciblé devant à note égale', () => {
    // Deux exercices qui ne visent que les fessiers : celui qui ne travaille
    // rien d'autre passe devant.
    const trouves = exercicesPourMuscles(MUSCULATION, ['fessiers']);
    const rang = (id: string) => trouves.findIndex((e) => e.id === id);
    expect(rang('fire-hydrant')).toBeLessThan(rang('frog-pump'));
  });

  it('ne rend rien sans muscle visé', () => {
    expect(exercicesPourMuscles(MUSCULATION, [])).toEqual([]);
  });

  it('ignore les postures de mobilité, qui ne portent pas de planche', () => {
    const postures = EXERCICES.filter((e) => (e.famille ?? 'musculation') !== 'musculation');
    const avecMuscles = postures.filter((e: Exercice) => (e.musclesPrincipaux ?? []).length > 0);
    expect(avecMuscles).toEqual([]);
  });
});

describe('objectifs musculaires', () => {
  it('trouvent tous au moins cinq exercices', () => {
    for (const objectif of OBJECTIFS_MUSCULAIRES) {
      const trouves = exercicesPourMuscles(MUSCULATION, objectif.muscles);
      expect(
        trouves.length,
        `${objectif.nom} ne rend que ${trouves.length} exercices`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it('n’ont pas d’identifiant en double', () => {
    const ids = OBJECTIFS_MUSCULAIRES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
