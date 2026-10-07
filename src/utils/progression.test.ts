import { describe, expect, it } from 'vitest';
import type { ExerciceRealise, Mesure, SeanceRealisee } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import {
  LARGEUR_CARACTERE_PX,
  echelleVerticale,
  exerciceLePlusSuivi,
  exercicesAvecCharge,
  formaterNombre,
  instantDuJour,
  libelleJour,
  libelleJourIso,
  phraseVariation,
  reperesDeDates,
  reunirExercices,
  serieChargeExercice,
  serieChargeTotale,
  seriePoidsCorps,
  variationDePoids,
} from './progression';

const EN_LIVRES = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' as const };
const EN_KILOS = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'kg' as const };

/** Un jour et une heure, à l'heure du téléphone, en ISO. */
const le = (annee: number, mois: number, jour: number, heure = 18) => new Date(annee, mois - 1, jour, heure).toISOString();

function seance(date: string, exercices: Partial<ExerciceRealise>[], surcharge: Partial<SeanceRealisee> = {}): SeanceRealisee {
  return {
    id: `seance-${date}`,
    date,
    parametres: EN_LIVRES,
    dureePrevueSec: 3300,
    dureeReelleSec: 3300,
    terminee: true,
    exercices: exercices.map((exo) => ({
      exerciceId: 'goblet-squat',
      seriesPrevues: 3,
      seriesFaites: 3,
      reps: 8,
      dureeSec: 400,
      ...exo,
    })),
    ...surcharge,
  };
}

const mesure = (surcharge: Partial<Mesure> = {}): Mesure => ({
  id: 'mesure-1',
  date: '2026-09-05',
  poids: 182,
  unitePoids: 'lb',
  tailleCm: 178,
  age: 42,
  ...surcharge,
});

/** Un générateur de hasard qui se répète : un test qui échoue échoue toujours. */
function hasard(graine: number) {
  let etat = graine;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
}

describe('la charge d’un exercice', () => {
  it('un point par séance : la plus lourde des séries faites', () => {
    const points = serieChargeExercice(
      [
        seance(le(2026, 9, 1), [{ poidsParSerie: [25, 30, 30] }]),
        seance(le(2026, 9, 8), [{ poidsParSerie: [30, 35, 30] }]),
        // Une série non notée (0) ne tire rien vers le bas.
        seance(le(2026, 9, 15), [{ poidsParSerie: [0, 35, 40] }]),
      ],
      'goblet-squat',
      'lb',
    );
    expect(points.map((p) => p.valeur)).toEqual([30, 35, 40]);
    expect(points.map((p) => p.t)).toEqual([
      new Date(2026, 8, 1, 18).getTime(),
      new Date(2026, 8, 8, 18).getTime(),
      new Date(2026, 8, 15, 18).getTime(),
    ]);
  });

  it('seules les séries faites comptent : une charge notée pour une série qu’on n’a pas faite est ignorée', () => {
    const points = serieChargeExercice(
      [seance(le(2026, 9, 1), [{ poidsParSerie: [30, 30, 45], seriesFaites: 2, seriesPrevues: 3 }])],
      'goblet-squat',
      'lb',
    );
    expect(points.map((p) => p.valeur)).toEqual([30]);
  });

  it('retombe sur la charge de l’exercice quand rien n’est noté série par série, ancien champ compris', () => {
    const points = serieChargeExercice(
      [
        seance(le(2026, 9, 1), [{ poids: 30 }]),
        seance(le(2026, 9, 8), [{ poidsKg: 14 }], { parametres: { ...EN_LIVRES, unitePoids: undefined } }),
        seance(le(2026, 9, 15), [{ poids: 32, poidsParSerie: [0, 0, 0] }]),
      ],
      'goblet-squat',
      'lb',
    );
    // 14 kg, une séance d'avant le réglage d'unité : 31 lb.
    expect(points.map((p) => p.valeur)).toEqual([30, 31, 32]);
  });

  it('ramène chaque séance à l’unité courante, dans les deux sens', () => {
    const seances = [
      seance(le(2026, 9, 1), [{ poidsParSerie: [16, 16, 16] }], { parametres: EN_KILOS }),
      seance(le(2026, 9, 8), [{ poidsParSerie: [35, 35, 35] }], { parametres: EN_LIVRES }),
    ];
    expect(serieChargeExercice(seances, 'goblet-squat', 'lb').map((p) => p.valeur)).toEqual([35, 35]);
    expect(serieChargeExercice(seances, 'goblet-squat', 'kg').map((p) => p.valeur)).toEqual([16, 16]);
  });

  it('deux séances le même jour font deux points, dans l’ordre du temps — même si l’historique est dans le désordre', () => {
    const points = serieChargeExercice(
      [
        seance(le(2026, 9, 8, 19), [{ poids: 40 }]),
        seance(le(2026, 9, 1, 18), [{ poids: 30 }]),
        seance(le(2026, 9, 8, 9), [{ poids: 35 }]),
      ],
      'goblet-squat',
      'lb',
    );
    expect(points.map((p) => p.valeur)).toEqual([30, 35, 40]);
  });

  it('un exercice qui revient deux fois dans une séance n’y fait qu’un point : le plus lourd', () => {
    const points = serieChargeExercice(
      [seance(le(2026, 9, 1), [{ poids: 30 }, { exerciceId: 'bench-press', poids: 99 }, { poids: 45 }])],
      'goblet-squat',
      'lb',
    );
    expect(points.map((p) => p.valeur)).toEqual([45]);
  });

  it('pas de point pour une séance sans charge notée, un exercice pas entamé, une autre séance, une date illisible', () => {
    const points = serieChargeExercice(
      [
        seance(le(2026, 9, 1), [{}]),
        seance(le(2026, 9, 8), [{ poids: 30, seriesFaites: 0 }]),
        seance(le(2026, 9, 15), [{ exerciceId: 'bench-press', poids: 50 }]),
        seance('pas-une-date', [{ poids: 30 }]),
        seance(le(2026, 9, 22), [{ poids: 35 }]),
      ],
      'goblet-squat',
      'lb',
    );
    expect(points.map((p) => p.valeur)).toEqual([35]);
    expect(serieChargeExercice([], 'goblet-squat', 'lb')).toEqual([]);
  });

  it('garde le nom de la séance du programme pour la lecture', () => {
    const [point] = serieChargeExercice([seance(le(2026, 9, 1), [{ poids: 30 }], { titre: 'Jeudi' })], 'goblet-squat', 'lb');
    expect(point.note).toBe('Jeudi');
    const [sans] = serieChargeExercice([seance(le(2026, 9, 1), [{ poids: 30 }])], 'goblet-squat', 'lb');
    expect(sans).not.toHaveProperty('note');
  });
});

describe('les exercices qu’on peut suivre', () => {
  const historique = [
    seance(le(2026, 9, 1), [{ exerciceId: 'goblet-squat', poids: 30 }, { exerciceId: 'hammer-curl', poids: 15 }, { exerciceId: 'v-up' }]),
    seance(le(2026, 9, 8), [{ exerciceId: 'goblet-squat', poids: 35 }, { exerciceId: 'farmers-walk', poidsParSerie: [50, 50, 50] }]),
    seance(le(2026, 9, 15), [
      { exerciceId: 'goblet-squat', poids: 40 },
      // Prévu, jamais entamé : n'entre pas.
      { exerciceId: 'bench-press', poids: 60, seriesFaites: 0 },
      // Inconnu de la bibliothèque, ou nom piégé : ne se nomme pas, n'entre pas.
      { exerciceId: 'exercice-disparu', poids: 10 },
      { exerciceId: 'constructor', poids: 10 },
    ]),
  ];

  it('ceux qu’on a faits avec une charge notée, par ordre alphabétique, avec le nombre de séances', () => {
    expect(exercicesAvecCharge(historique)).toEqual([
      { exerciceId: 'hammer-curl', nom: 'Curl marteau', seances: 1 },
      { exerciceId: 'goblet-squat', nom: 'Goblet squat', seances: 3 },
      { exerciceId: 'farmers-walk', nom: 'Marche du fermier', seances: 1 },
    ]);
  });

  it('un exercice sans charge notée (V-up) ou sans date lisible ne se suit pas', () => {
    const noms = exercicesAvecCharge([...historique, seance('pas-une-date', [{ exerciceId: 'bench-press', poids: 50 }])]).map((e) => e.nom);
    expect(noms).not.toContain('V-up');
    expect(noms).not.toContain('Développé couché avec haltères');
    expect(exercicesAvecCharge([])).toEqual([]);
  });

  it('un exercice compte une fois par séance, même s’il y revient', () => {
    const [squat] = exercicesAvecCharge([seance(le(2026, 9, 1), [{ poids: 30 }, { poids: 35 }])]);
    expect(squat.seances).toBe(1);
  });

  it('réunit mes exercices et ceux de l’autre : chacun une fois, par ordre alphabétique', () => {
    const miens = exercicesAvecCharge(historique);
    const siens = exercicesAvecCharge([seance(le(2026, 9, 2), [{ exerciceId: 'goblet-squat', poids: 50 }, { exerciceId: 'single-arm-row', poids: 40 }])]);
    const reunis = reunirExercices(miens, siens);
    expect(reunis.map((e) => e.nom)).toEqual(['Curl marteau', 'Goblet squat', 'Marche du fermier', 'Rowing un bras']);
    expect(reunis.find((e) => e.exerciceId === 'goblet-squat')?.seances).toBe(4);
    expect(reunirExercices()).toEqual([]);
  });

  it('on montre d’abord celui qui compte le plus de séances ; à égalité, le premier de la liste', () => {
    expect(exerciceLePlusSuivi(exercicesAvecCharge(historique))?.exerciceId).toBe('goblet-squat');
    expect(
      exerciceLePlusSuivi([
        { exerciceId: 'a', nom: 'A', seances: 2 },
        { exerciceId: 'b', nom: 'B', seances: 2 },
      ])?.exerciceId,
    ).toBe('a');
    expect(exerciceLePlusSuivi([])).toBeUndefined();
  });
});

describe('la charge totale soulevée', () => {
  it('un point par séance, dans l’unité courante, dans l’ordre du temps', () => {
    const seances = [
      // 100 × 8 × 3 = 2 400 lb.
      seance(le(2026, 9, 8), [{ exerciceId: 'bench-press', poidsParSerie: [100, 100, 100] }]),
      // 50 kg × 8 × 1 série = 400 kg, soit 882 lb.
      seance(le(2026, 9, 1), [{ exerciceId: 'bench-press', poidsParSerie: [50], seriesFaites: 1 }], { parametres: EN_KILOS }),
    ];
    expect(serieChargeTotale(seances, 'lb').map((p) => p.valeur)).toEqual([882, 2400]);
    expect(serieChargeTotale(seances, 'kg').map((p) => p.valeur)).toEqual([400, 1089]);
  });

  it('une séance sans aucune charge notée n’a pas de point, ni une séance dont la date ne se lit pas', () => {
    const points = serieChargeTotale(
      [
        seance(le(2026, 9, 1), [{ exerciceId: 'bench-press' }]),
        seance('pas-une-date', [{ exerciceId: 'bench-press', poids: 50 }]),
        seance(le(2026, 9, 8), [{ exerciceId: 'bench-press', poids: 50 }], { titre: 'Mardi A' }),
      ],
      'lb',
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ valeur: 1200, note: 'Mardi A' });
  });
});

describe('le poids de corps', () => {
  it('un point par mesure, du plus ancien au plus récent, le point de départ marqué « Jour 1 »', () => {
    const points = seriePoidsCorps(
      [
        mesure({ id: 'mesure-c', date: '2026-10-05', poids: 180.2 }),
        mesure({ id: 'mesure-a', date: '2026-08-05', poids: 186 }),
        mesure({ id: 'mesure-b', date: '2026-09-05', poids: 183.4 }),
      ],
      'lb',
    );
    expect(points.map((p) => p.valeur)).toEqual([186, 183.4, 180.2]);
    expect(points.map((p) => p.note)).toEqual(['Jour 1', undefined, undefined]);
    expect(points[0].t).toBe(new Date(2026, 7, 5, 12).getTime());
    expect(seriePoidsCorps([], 'lb')).toEqual([]);
  });

  it('convertit chaque mesure dans l’unité courante, au dixième près, sans réécrire le passé', () => {
    const mesures = [
      mesure({ id: 'mesure-a', date: '2026-08-05', poids: 182, unitePoids: 'lb' }),
      mesure({ id: 'mesure-b', date: '2026-09-05', poids: 82.4, unitePoids: 'kg' }),
    ];
    // 182 lb = 82,55 kg : 82,6 — pas le demi-kilo des haltères.
    expect(seriePoidsCorps(mesures, 'kg').map((p) => p.valeur)).toEqual([82.6, 82.4]);
    // 82,4 kg = 181,65 lb : 181,7.
    expect(seriePoidsCorps(mesures, 'lb').map((p) => p.valeur)).toEqual([182, 181.7]);
    expect(mesures[0].poids).toBe(182);
  });

  it('l’écart depuis le jour 1, dans l’unité courante', () => {
    const depart = mesure({ poids: 190, unitePoids: 'lb' });
    expect(variationDePoids(mesure({ poids: 186.5 }), depart, 'lb')).toBe(-3.5);
    expect(variationDePoids(mesure({ poids: 190 }), depart, 'lb')).toBe(0);
    expect(variationDePoids(mesure({ poids: 195.2 }), depart, 'lb')).toBe(5.2);
    // En kilos : 190 lb = 86,2 kg, et 84 kg est 2,2 kg plus bas.
    expect(variationDePoids(mesure({ poids: 84, unitePoids: 'kg' }), depart, 'kg')).toBe(-2.2);
    // Un nombre propre : pas 0,30000000000000004.
    expect(variationDePoids(mesure({ poids: 100.3 }), mesure({ poids: 100 }), 'lb')).toBe(0.3);
  });

  it('s’écrit « −4 lb depuis le jour 1 »', () => {
    expect(phraseVariation(-4, 'lb')).toBe('−4 lb depuis le jour 1');
    expect(phraseVariation(2.5, 'kg')).toBe('+2,5 kg depuis le jour 1');
    expect(phraseVariation(0, 'lb')).toBe('même poids que le jour 1');
  });
});

describe('écrire un nombre et un jour', () => {
  it('à la française : un espace entre les milliers, une virgule, un vrai signe moins', () => {
    expect(formaterNombre(12500)).toBe('12\u00a0500');
    expect(formaterNombre(3960)).toBe('3\u00a0960');
    expect(formaterNombre(1234567)).toBe('1\u00a0234\u00a0567');
    expect(formaterNombre(182.4, 1)).toBe('182,4');
    expect(formaterNombre(-4, 1)).toBe('−4');
    expect(formaterNombre(0, 1)).toBe('0');
  });

  it('au plus le nombre de décimales demandé, sans zéro de trop', () => {
    expect(formaterNombre(182, 1)).toBe('182');
    expect(formaterNombre(182.0, 2)).toBe('182');
    expect(formaterNombre(17.5, 1)).toBe('17,5');
    expect(formaterNombre(82.56, 1)).toBe('82,6');
    expect(formaterNombre(182.4, 0)).toBe('182');
    // Un « −0 » n'a pas de sens.
    expect(formaterNombre(-0.04, 1)).toBe('0');
  });

  it('les jours : « 5 oct. 2026 », « 1er nov. », sans dépendre de la langue du navigateur', () => {
    expect(libelleJour(new Date(2026, 9, 5, 18))).toBe('5 oct. 2026');
    expect(libelleJour(new Date(2026, 10, 1, 8), false)).toBe('1er nov.');
    expect(libelleJour(new Date(2027, 0, 12).getTime(), true)).toBe('12 janv. 2027');
    expect(libelleJour(new Date(2026, 7, 31), false)).toBe('31 août');
    expect(libelleJourIso('2026-09-05')).toBe('5 sept. 2026');
    expect(libelleJourIso('2026-12-02', false)).toBe('2 déc.');
  });

  it('un jour AAAA-MM-JJ se place à midi, heure locale : l’heure d’été ne le change pas de jour', () => {
    for (const jour of ['2026-03-08', '2026-03-09', '2026-11-01', '2026-06-21']) {
      const date = new Date(instantDuJour(jour));
      expect([date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()]).toEqual([...jour.split('-').map(Number), 12]);
    }
  });
});

describe('l’échelle verticale : de 3 à 5 lignes de repère aux valeurs rondes', () => {
  it('des exemples', () => {
    expect(echelleVerticale([150, 205]).reperes).toEqual([140, 160, 180, 200, 220]);
    expect(echelleVerticale([0, 100]).reperes).toEqual([0, 50, 100]);
    expect(echelleVerticale([180.2, 190.4]).reperes).toEqual([180, 185, 190, 195]);
    expect(echelleVerticale([2400, 3960]).reperes).toEqual([2000, 2500, 3000, 3500, 4000]);
    expect(echelleVerticale([15, 22.5]).reperes).toEqual([15, 20, 25]);
    expect(echelleVerticale([0.12, 0.31]).reperes).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('les lignes encadrent les valeurs, et la première et la dernière en sont les bornes', () => {
    const echelle = echelleVerticale([151.3, 203.8, 177]);
    expect(echelle.min).toBe(echelle.reperes[0]);
    expect(echelle.max).toBe(echelle.reperes[echelle.reperes.length - 1]);
    expect(echelle.min).toBeLessThanOrEqual(151.3);
    expect(echelle.max).toBeGreaterThanOrEqual(203.8);
  });

  it('une seule valeur, ou des valeurs toutes pareilles, ont tout de même une échelle', () => {
    for (const valeurs of [[45], [45, 45, 45], [0], [182.4], [-3]]) {
      const echelle = echelleVerticale(valeurs);
      expect(echelle.reperes.length).toBeGreaterThanOrEqual(3);
      expect(echelle.reperes.length).toBeLessThanOrEqual(5);
      expect(echelle.min).toBeLessThan(valeurs[0]);
      expect(echelle.max).toBeGreaterThan(valeurs[0]);
    }
  });

  it('sans valeur, une échelle sans prétention plutôt qu’une erreur', () => {
    expect(echelleVerticale([]).reperes.length).toBeGreaterThanOrEqual(3);
    expect(echelleVerticale([NaN, Infinity]).reperes.length).toBeGreaterThanOrEqual(3);
  });

  it('des valeurs négatives, qui passent par zéro', () => {
    expect(echelleVerticale([-5, 12]).reperes).toEqual([-5, 0, 5, 10, 15]);
  });

  it('écrit chaque repère avec juste ce qu’il faut de décimales', () => {
    expect(echelleVerticale([150, 205]).decimales).toBe(0);
    expect(echelleVerticale([180.2, 181.4]).decimales).toBe(1);
    expect(echelleVerticale([0.12, 0.31]).decimales).toBe(1);
    expect(echelleVerticale([0.012, 0.031]).decimales).toBe(2);
    expect(echelleVerticale([10, 12]).reperes).toEqual([10, 10.5, 11, 11.5, 12]);
    expect(echelleVerticale([10, 12]).decimales).toBe(1);
  });

  it('pour n’importe quelles valeurs : 3 à 5 lignes, régulières, au pas rond, qui encadrent tout', () => {
    const alea = hasard(7);
    for (let essai = 0; essai < 3000; essai += 1) {
      const depart = (alea() - 0.3) * 10 ** (alea() * 6 - 1);
      const etendue = alea() < 0.1 ? 0 : alea() * 10 ** (alea() * 6 - 2);
      const valeurs = [depart, depart + etendue, depart + etendue * alea()];
      const echelle = echelleVerticale(valeurs);
      const { reperes } = echelle;
      expect(reperes.length, JSON.stringify(valeurs)).toBeGreaterThanOrEqual(3);
      expect(reperes.length, JSON.stringify(valeurs)).toBeLessThanOrEqual(5);
      expect(echelle.min, JSON.stringify(valeurs)).toBeLessThanOrEqual(Math.min(...valeurs) + 1e-9);
      expect(echelle.max, JSON.stringify(valeurs)).toBeGreaterThanOrEqual(Math.max(...valeurs) - 1e-9);
      const pas = reperes[1] - reperes[0];
      for (let i = 1; i < reperes.length; i += 1) expect(reperes[i] - reperes[i - 1]).toBeCloseTo(pas, 6);
      // Un pas rond : 1, 2 ou 5, fois une puissance de dix (à un reste de calcul près).
      const mantisse = pas / 10 ** Math.floor(Math.log10(pas) + 1e-6);
      expect([1, 2, 5].some((rond) => Math.abs(mantisse - rond) < 1e-6), `${pas} (${JSON.stringify(valeurs)})`).toBe(true);
      // Et les décimales annoncées suffisent à écrire chaque repère.
      for (const repere of reperes) expect(Number(repere.toFixed(echelle.decimales))).toBeCloseTo(repere, 9);
    }
  });
});

describe('les dates de l’axe du bas', () => {
  const jour = (annee: number, mois: number, j: number, heure = 0) => new Date(annee, mois - 1, j, heure).getTime();
  const libelles = (t0: number, t1: number, largeur: number) => reperesDeDates(t0, t1, largeur).map((r) => r.libelle);

  it('quelques semaines : un repère par lundi', () => {
    expect(libelles(jour(2026, 10, 5), jour(2026, 10, 26), 250)).toEqual(['5 oct.', '12 oct.', '19 oct.', '26 oct.']);
  });

  it('moins de place, moins de dates : un lundi sur deux', () => {
    expect(libelles(jour(2026, 10, 5), jour(2026, 10, 26), 150)).toEqual(['5 oct.', '19 oct.']);
  });

  it('quelques jours : un repère par jour', () => {
    expect(libelles(jour(2026, 10, 5), jour(2026, 10, 8), 250)).toEqual(['5 oct.', '6 oct.', '7 oct.', '8 oct.']);
  });

  it('quelques mois : le premier de chaque mois, avec l’année sur la première date', () => {
    expect(libelles(jour(2026, 7, 8), jour(2026, 10, 2), 250)).toEqual(['août 2026', 'sept.', 'oct.']);
  });

  it('à cheval sur deux années : l’année revient à chaque janvier', () => {
    expect(libelles(jour(2026, 8, 10), jour(2027, 2, 20), 500)).toEqual(['sept. 2026', 'oct.', 'nov.', 'déc.', 'janv. 2027', 'févr.']);
    // Plus étroit, les mois se sautent, mais l'année reste dite.
    expect(libelles(jour(2026, 8, 10), jour(2027, 2, 20), 330)).toEqual(['sept. 2026', 'nov.', 'janv. 2027']);
    expect(libelles(jour(2026, 11, 10), jour(2027, 3, 20), 250)).toEqual(['janv. 2027', 'mars']);
  });

  it('plusieurs années : l’année seule', () => {
    expect(libelles(jour(2024, 3, 15), jour(2027, 6, 15), 250)).toEqual(['2025', '2026', '2027']);
  });

  it('des semaines à cheval sur deux années : l’année sur la première date, et sur la première de la nouvelle année', () => {
    expect(libelles(jour(2026, 12, 14), jour(2027, 1, 11), 420)).toEqual(['14 déc. 2026', '21 déc.', '28 déc.', '4 janv. 2027', '11 janv.']);
    // Plus étroit, un lundi sur deux : l'année change à la dernière date.
    expect(libelles(jour(2026, 12, 14), jour(2027, 1, 11), 330)).toEqual(['14 déc. 2026', '28 déc.', '11 janv. 2027']);
  });

  it('un seul instant (une seule mesure) : sa date, au milieu', () => {
    const t = new Date(2026, 9, 5, 18).getTime();
    expect(reperesDeDates(t, t, 200)).toEqual([{ t, libelle: '5 oct. 2026' }]);
  });

  it('moins d’un jour, sans minuit : la date du milieu', () => {
    const t0 = jour(2026, 10, 5, 10);
    const t1 = jour(2026, 10, 5, 14);
    expect(reperesDeDates(t0, t1, 200)).toEqual([{ t: (t0 + t1) / 2, libelle: '5 oct. 2026' }]);
  });

  it('les repères tombent à minuit et un lundi, même à travers le changement d’heure', () => {
    // Le 1er novembre 2026, au Québec, on recule l'horloge d'une heure.
    const reperes = reperesDeDates(jour(2026, 10, 26), jour(2026, 11, 16), 330);
    expect(reperes.map((r) => r.libelle)).toEqual(['26 oct.', '2 nov.', '9 nov.', '16 nov.']);
    for (const { t } of reperes) {
      const date = new Date(t);
      expect([date.getDay(), date.getHours(), date.getMinutes()]).toEqual([1, 0, 0]);
    }
  });

  it('pour n’importe quelle durée et n’importe quelle largeur : au moins une date, dans l’ordre, qui ne se touchent pas', () => {
    const alea = hasard(11);
    const debut = jour(2020, 1, 1);
    for (let essai = 0; essai < 1500; essai += 1) {
      const t0 = debut + Math.floor(alea() * 2000) * 86_400_000 + Math.floor(alea() * 86_400_000);
      const t1 = t0 + Math.floor(10 ** (alea() * 4.2 + 3) * 1000) + 1;
      const largeur = 100 + Math.floor(alea() * 400);
      const reperes = reperesDeDates(t0, t1, largeur);
      expect(reperes.length).toBeGreaterThanOrEqual(1);
      const x = (t: number) => ((t - t0) / (t1 - t0)) * largeur;
      reperes.forEach((repere, i) => {
        expect(repere.t).toBeGreaterThanOrEqual(t0);
        expect(repere.t).toBeLessThanOrEqual(t1);
        if (i === 0) return;
        const avant = reperes[i - 1];
        expect(repere.t).toBeGreaterThan(avant.t);
        const place = ((repere.libelle.length + avant.libelle.length) / 2) * LARGEUR_CARACTERE_PX;
        expect(x(repere.t) - x(avant.t), `${avant.libelle} / ${repere.libelle} sur ${largeur}`).toBeGreaterThanOrEqual(place);
      });
    }
  });
});
