import { describe, expect, it } from 'vitest';
import { EXERCICES, EXERCICES_PAR_ID, POSTERS } from './exercices';
import { EXERCICES_YOGA } from './yoga';

/** Noms des fichiers réellement présents dans public/exercices. Passer par
 *  `import.meta.glob` plutôt que par `node:fs` garde le test compilable par le
 *  même tsconfig que l'application, qui ne connaît pas les modules de Node. */
const FICHIERS = new Set(
  Object.keys(import.meta.glob('../../public/exercices/*')).map((chemin) =>
    chemin.slice(chemin.lastIndexOf('/') + 1),
  ),
);

describe('bibliothèque d’exercices', () => {
  it('n’a aucun identifiant en double', () => {
    const vus = new Map<string, number>();
    for (const exercice of EXERCICES) {
      vus.set(exercice.id, (vus.get(exercice.id) ?? 0) + 1);
    }
    expect([...vus].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
    expect(Object.keys(EXERCICES_PAR_ID)).toHaveLength(EXERCICES.length);
  });

  it('a une vignette sur le disque pour chaque exercice', () => {
    const manquantes = EXERCICES.filter((e) => !FICHIERS.has(`${e.id}.png`)).map((e) => e.id);
    expect(manquantes).toEqual([]);
  });

  it('a une image pour chaque poster annoncé', () => {
    const manquants = POSTERS.filter((p) => !FICHIERS.has(`${p.id}.jpg`)).map((p) => p.id);
    expect(manquants).toEqual([]);
  });

  it('renseigne au moins deux points d’attention par exercice', () => {
    const pauvres = EXERCICES.filter((e) => e.pointsAttention.length < 2).map((e) => e.id);
    expect(pauvres).toEqual([]);
  });
});

describe('postures de yoga', () => {
  it('compte les 57 postures du poster', () => {
    expect(EXERCICES_YOGA).toHaveLength(57);
  });

  it('les tient au temps, sur un tapis, dans la famille mobilité', () => {
    for (const posture of EXERCICES_YOGA) {
      expect(posture.famille).toBe('mobilite');
      expect(posture.unite).toBe('secondes');
      expect(posture.materiel).toBe('tapis');
      expect(posture.pattern).toBe('mobilite');
      expect(posture.explosif).toBeUndefined();
      expect(posture.id.startsWith('yoga-')).toBe(true);
      // Le nom anglais du poster porte le sanskrit entre parenthèses.
      expect(posture.nomEn).toMatch(/\(.+\)$/);
    }
  });

  it('fait partie de la bibliothèque commune', () => {
    expect(EXERCICES_PAR_ID['yoga-guerrier-2'].nomFr).toBe('Guerrier II');
    expect(EXERCICES_PAR_ID['yoga-cadavre'].zone).toBe('complet');
  });
});
