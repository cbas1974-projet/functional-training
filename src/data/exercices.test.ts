import { describe, expect, it } from 'vitest';
import { CONSIGNE_GENOU, CONSIGNE_SANS_PAUSE, EXERCICES, EXERCICES_PAR_ID, POSTERS, consignesDe } from './exercices';
import { EXERCICES_ETIREMENTS } from './etirements';
import { EXERCICES_KETTLEBELL } from './kettlebell';
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

  it('n’a pas de vignette orpheline dans public/exercices', () => {
    const connus = new Set([
      ...EXERCICES.map((e) => `${e.id}.png`),
      ...POSTERS.map((p) => `${p.id}.jpg`),
    ]);
    expect([...FICHIERS].filter((f) => !connus.has(f)).sort()).toEqual([]);
  });

  it('renseigne au moins deux points d’attention par exercice', () => {
    const pauvres = EXERCICES.filter((e) => e.pointsAttention.length < 2).map((e) => e.id);
    expect(pauvres).toEqual([]);
  });
});

/** Le texte de tous les composants : pour vérifier qu'aucun n'affiche les points
 *  d'attention sans passer par `consignesDe`. */
const COMPOSANTS = import.meta.glob('../components/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

describe('consignes de précaution', () => {
  it('dit « sans arrêt en bas » aux exercices du dos et des genoux, et en plus « jusqu’où le genou ne fait pas mal » à ceux des genoux', () => {
    expect(CONSIGNE_SANS_PAUSE).toBe('Sans arrêt en bas : on descend contrôlé, on remonte sans rebond');
    expect(CONSIGNE_GENOU).toBe('On descend seulement jusqu’où le genou ne fait pas mal');

    // Le dos : une seule consigne de plus, avant les points d'attention.
    const souleve = EXERCICES_PAR_ID['romanian-deadlift'];
    expect(souleve.genouAMenager).toBeUndefined();
    expect(consignesDe(souleve)).toEqual([CONSIGNE_SANS_PAUSE, ...souleve.pointsAttention]);
    // Les genoux : les deux.
    for (const id of ['squat', 'leg-press', 'kb-lunge-press', 'step-up']) {
      const exercice = EXERCICES_PAR_ID[id];
      expect(consignesDe(exercice), id).toEqual([CONSIGNE_SANS_PAUSE, CONSIGNE_GENOU, ...exercice.pointsAttention]);
    }
    // Les autres : leurs points d'attention, rien de plus.
    const curl = EXERCICES_PAR_ID['hammer-curl'];
    expect(consignesDe(curl)).toEqual(curl.pointsAttention);
    expect(consignesDe({ pointsAttention: [] })).toEqual([]);
  });

  it('ne contredit aucun exercice sans arrêt en bas : aucun ne demande de marquer un temps en bas', () => {
    for (const exercice of EXERCICES.filter((e) => e.sansPauseEnBas)) {
      const phrases = consignesDe(exercice).filter((p) => /marquer un temps|temps d.arrêt en bas|tenir en bas/i.test(p));
      expect(phrases, exercice.id).toEqual([]);
    }
  });

  it('ne marque le genou que sur des exercices sans arrêt en bas', () => {
    expect(EXERCICES.filter((e) => e.genouAMenager && !e.sansPauseEnBas).map((e) => e.id)).toEqual([]);
  });

  it('s’affiche partout où les consignes s’affichent : aucun écran ne lit les points d’attention sans elle', () => {
    expect(Object.keys(COMPOSANTS).length).toBeGreaterThan(5);
    const sansLaFonction = Object.entries(COMPOSANTS)
      .filter(([, texte]) => texte.includes('.pointsAttention'))
      .map(([chemin]) => chemin);
    expect(sansLaFonction).toEqual([]);
    // Les cinq écrans qui montrent les consignes d'un exercice.
    for (const nom of ['SeanceGuidee', 'ImageEnGrand', 'BibliothequeExercices', 'Entrainement']) {
      const texte = COMPOSANTS[`../components/${nom}.tsx`];
      expect(texte, nom).toContain('consignesDe(');
    }
    expect(COMPOSANTS['../components/SeanceGuidee.tsx'].match(/consignesDe\(/g)).toHaveLength(2);
  });
});

describe('postures de yoga', () => {
  it('compte les 57 postures du poster', () => {
    expect(EXERCICES_YOGA).toHaveLength(57);
  });

  it('les tient au temps, sur un tapis, dans la famille mobilité', () => {
    for (const posture of EXERCICES_YOGA) {
      expect(posture.famille).toBe('yoga');
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

describe('étirements', () => {
  it('compte les 52 cases du poster', () => {
    expect(EXERCICES_ETIREMENTS).toHaveLength(52);
  });

  it('les tient au temps, dans la famille mobilité', () => {
    for (const etirement of EXERCICES_ETIREMENTS) {
      expect(etirement.famille).toBe('etirement');
      expect(etirement.unite).toBe('secondes');
      expect(etirement.pattern).toBe('mobilite');
      expect(etirement.explosif).toBeUndefined();
      expect(etirement.id.startsWith('etir-')).toBe(true);
    }
  });

  it('ne demande que du matériel qu’on peut déclarer', () => {
    const attendus = new Set(['aucun', 'tapis', 'step', 'barre-fixe']);
    const inattendus = EXERCICES_ETIREMENTS.filter((e) => !attendus.has(e.materiel));
    expect(inattendus.map((e) => `${e.id}: ${e.materiel}`)).toEqual([]);
  });

  it('couvre le corps de la nuque aux chevilles', () => {
    expect(EXERCICES_PAR_ID['etir-nuque-flexion'].groupe).toBe('trapezes');
    expect(EXERCICES_PAR_ID['etir-mollet-marche'].materiel).toBe('step');
    expect(EXERCICES_PAR_ID['etir-suspension-barre'].materiel).toBe('barre-fixe');
  });
});

describe('kettlebell', () => {
  it('compte les 68 cases des deux posters', () => {
    expect(EXERCICES_KETTLEBELL).toHaveLength(68);
  });

  it('les range en musculation, au kettlebell, avec une lecture anatomique', () => {
    for (const exercice of EXERCICES_KETTLEBELL) {
      expect(exercice.id.startsWith('kb-')).toBe(true);
      expect(exercice.materiel).toBe('kettlebell');
      expect(exercice.famille ?? 'musculation').toBe('musculation');
      expect((exercice.musclesPrincipaux ?? []).length).toBeGreaterThan(0);
    }
  });

  it('marque explosifs tous les mouvements balistiques', () => {
    const balistiques = [
      'kb-double-arm-swing', 'kb-single-arm-swing', 'kb-snatch', 'kb-clean',
      'kb-side-swing', 'kb-golfer-swing', 'kb-jump-squat', 'kb-frog-jump',
      'kb-power-jump-squat', 'kb-speed-skater', 'kb-log-jump',
    ];
    for (const id of balistiques) expect(EXERCICES_PAR_ID[id].explosif, id).toBe(true);
    // Le soulevé de terre et le good morning, eux, se font lentement.
    expect(EXERCICES_PAR_ID['kb-deadlift'].explosif).toBeUndefined();
    expect(EXERCICES_PAR_ID['kb-good-morning'].explosif).toBeUndefined();
  });
});
