import { describe, expect, it } from 'vitest';
import {
  CONSIGNE_GENOU,
  CONSIGNE_PAUSE_EN_HAUT,
  CONSIGNE_SANS_PAUSE,
  EXERCICES,
  EXERCICES_PAR_ID,
  POSTERS,
  consignesDe,
} from './exercices';
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

describe('où se tient l’arrêt du tempo', () => {
  /** Ceux qui tiennent en haut : la position basse est un repos — allongé à
   *  plat, jambe posée, bras qui pendent sans charge sur le muscle visé — ou le
   *  mouvement consiste à serrer la contraction. Tous les autres exercices en
   *  répétitions tiennent en bas, en position étirée sous la charge, ou n'ont
   *  pas d'arrêt du tout (`sansPauseEnBas`). */
  const EN_HAUT = [
    // Le dos et l'arrière des épaules, allongé sur le ventre.
    'kb-superman', 'floor-t-raise',
    // Les fessiers et l'extérieur de la hanche : à quatre pattes, sur le côté, sur le dos.
    'fire-hydrant', 'donkey-kick', 'kb-side-leg-raise', 'glute-bridge', 'frog-pump', 'kb-single-leg-glute-bridge',
    // Les épaules, bras qui pendent en bas.
    'side-raise', 'single-arm-lateral-raise', 'kb-side-raise', 'alternating-front-raise', 'kb-front-raise', 'l-raise',
    'no-money-curl', 'shoulder-shrug',
    // Les triceps, avant-bras qui pend en bas.
    'tricep-kickback', 'kb-tricep-kickback',
    // Les cuisses, aux machines et à l'haltère, et le mollet au sol.
    'leg-extension-machine', 'leg-curl-machine', 'leg-extension', 'hamstring-curl', 'calf-raise',
    // Le tirage en planche : l'haltère posé au sol en bas.
    'renegade-row', 'kb-renegade-row', 'plank-t',
    // Le ventre : allongé à plat, pendu, debout bras en l'air.
    'v-up', 'kb-v-up', 'kb-alternating-v-up', 'kb-x-crunch', 'kb-oblique-crunch', 'kb-straight-arm-sit', 'kb-pullover',
    'hanging-leg-raise', 'kb-high-knee-crunch', 'kb-half-turkish-get-up', 'kb-turkish-get-up',
  ];
  const tiennentEnHaut = () => EXERCICES.filter((e) => e.pauseEnHaut).map((e) => e.id);
  const musculationEnReps = EXERCICES.filter((e) => (e.famille ?? 'musculation') === 'musculation' && e.unite === 'reps');

  it('tient en haut ces exercices-là, et eux seuls', () => {
    expect(new Set(EN_HAUT).size).toBe(EN_HAUT.length);
    expect(tiennentEnHaut().sort()).toEqual([...EN_HAUT].sort());
  });

  it('tient en haut toutes les Superman et extensions du dos allongé, et toutes les abductions de hanche', () => {
    // Allongé sur le ventre, sur le côté ou à quatre pattes : en bas, on est posé.
    const poses = musculationEnReps.filter(
      (e) => !e.explosif && /^(allongé sur le ventre|allongé sur le côté|à quatre pattes)/i.test(e.position),
    );
    expect(poses.map((e) => e.id)).toEqual(expect.arrayContaining(['kb-superman', 'floor-t-raise', 'fire-hydrant', 'kb-side-leg-raise']));
    expect(poses.filter((e) => !e.pauseEnHaut).map((e) => e.id)).toEqual([]);
    // Toutes les Superman, quel que soit le matériel.
    const supermans = musculationEnReps.filter((e) => /superman/i.test(`${e.id} ${e.nomFr}`));
    expect(supermans.length).toBeGreaterThan(0);
    expect(supermans.filter((e) => !e.pauseEnHaut).map((e) => e.id)).toEqual([]);
    // Les abductions de hanche isolées : la jambe s'écarte, puis se repose.
    const abductions = musculationEnReps.filter((e) => e.pattern === 'isolation' && e.musclesPrincipaux?.includes('abducteurs'));
    expect(abductions.map((e) => e.id).sort()).toEqual(['fire-hydrant', 'kb-side-leg-raise']);
    expect(abductions.every((e) => e.pauseEnHaut)).toBe(true);
  });

  it('ne tient en haut que des exercices en répétitions au tempo lent', () => {
    for (const exercice of EXERCICES.filter((e) => e.pauseEnHaut)) {
      expect(exercice.famille ?? 'musculation', exercice.id).toBe('musculation');
      expect(exercice.unite, exercice.id).toBe('reps');
      expect(exercice.explosif, exercice.id).toBeUndefined();
    }
    // Seule l'extension des jambes à la machine, sans arrêt genoux pliés,
    // retrouve un arrêt — jambes tendues.
    expect(EXERCICES.filter((e) => e.pauseEnHaut && e.sansPauseEnBas).map((e) => e.id)).toEqual(['leg-extension-machine']);
  });

  it('dit « On tient en haut, muscles serrés » à ceux qui tiennent en haut, et rien ne leur demande de tenir en bas', () => {
    expect(CONSIGNE_PAUSE_EN_HAUT).toBe('On tient en haut, muscles serrés');
    for (const exercice of EXERCICES.filter((e) => e.pauseEnHaut)) {
      const consignes = consignesDe(exercice);
      expect(consignes, exercice.id).toContain(CONSIGNE_PAUSE_EN_HAUT);
      const enBas = consignes.filter((p) => /temps (d.arrêt )?en bas|tenir en bas|tient en bas|tenir une seconde en bas|pause en bas/i.test(p));
      expect(enBas, exercice.id).toEqual([]);
    }
    // Elle vient avant les points d'attention ; les autres ne l'ont pas.
    const glute = EXERCICES_PAR_ID['glute-bridge'];
    expect(consignesDe(glute)).toEqual([CONSIGNE_PAUSE_EN_HAUT, ...glute.pointsAttention]);
    expect(consignesDe(EXERCICES_PAR_ID['hammer-curl'])).not.toContain(CONSIGNE_PAUSE_EN_HAUT);
  });

  it('tient en haut tout exercice dont les points d’attention disent de tenir en haut', () => {
    const disentEnHaut = musculationEnReps.filter((e) =>
      e.pointsAttention.some((p) => /tenir [^.;]*en haut|temps d.arrêt en haut|marquer un temps bras tendu|tenir [^.;]*jambes tendues/i.test(p)),
    );
    expect(disentEnHaut.length).toBeGreaterThan(5);
    expect(disentEnHaut.filter((e) => !e.pauseEnHaut).map((e) => e.id)).toEqual([]);
  });

  it('garde l’arrêt en bas là où la position basse est étirée sous la charge', () => {
    // Le curl, le développé, l'écarté, le rowing, le mollet sur une marche, le
    // rowing vertical (tenu en haut, il pincerait l'épaule).
    for (const id of [
      'hammer-curl', 'bench-press', 'chest-fly', 'single-arm-row', 'kb-single-leg-calf-raise', 'upright-row',
      'tricep-extension', 'wrist-curl',
    ]) {
      const exercice = EXERCICES_PAR_ID[id];
      expect([exercice.pauseEnHaut, exercice.sansPauseEnBas], id).toEqual([undefined, undefined]);
    }
  });

  it('fait partir d’en haut les exercices qui commencent bras ou cloche au-dessus de la tête', () => {
    for (const id of ['single-arm-tricep-extension', 'kb-windmill', 'kb-wood-chop', 'tricep-extension', 'kb-tricep-extension']) {
      expect(EXERCICES_PAR_ID[id].premierePhase, id).toBe('descend');
    }
  });
});

describe('machines de la salle', () => {
  it('compte six machines, chacune avec son dessin', () => {
    const machines = EXERCICES.filter((e) => e.materiel === 'salle').map((e) => e.id);
    expect(machines).toEqual([
      'trap-bar-deadlift', 'leg-press', 'hack-squat', 'traineau', 'leg-extension-machine', 'leg-curl-machine',
    ]);
    for (const id of machines) expect(FICHIERS.has(`${id}.png`), id).toBe(true);
  });

  it('ménage les genoux à l’extension des jambes ; garde l’extension et le leg curl aux haltères', () => {
    const extension = EXERCICES_PAR_ID['leg-extension-machine'];
    expect([extension.sansPauseEnBas, extension.genouAMenager]).toEqual([true, true]);
    // Jamais d'arrêt genoux pliés ; l'arrêt se tient jambes tendues, comme le
    // dit l'affiche de la machine.
    expect(extension.pauseEnHaut).toBe(true);
    expect(consignesDe(extension).slice(0, 3)).toEqual([CONSIGNE_SANS_PAUSE, CONSIGNE_PAUSE_EN_HAUT, CONSIGNE_GENOU]);
    const flexion = EXERCICES_PAR_ID['leg-curl-machine'];
    expect([flexion.pattern, flexion.musclesPrincipaux, flexion.cotes]).toEqual(['isolation', ['ischios'], 'bilateral']);
    expect(EXERCICES_PAR_ID['leg-extension'].materiel).toBe('banc');
    expect(EXERCICES_PAR_ID['hamstring-curl'].materiel).toBe('banc');
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
