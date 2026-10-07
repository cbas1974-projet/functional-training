import { describe, expect, it } from 'vitest';
import type { Mesure } from '../types';
import {
  IDENTIFIANT_MESURE,
  JOURS_ENTRE_MESURES,
  LIMITES_MESURE,
  MESURES_MAXI,
  jourLocal,
  jourValide,
  joursDepuisDerniereMesure,
  joursEntre,
  libellePiedsPouces,
  lireMesure,
  lireMesures,
  lireNombre,
  nouvelIdMesure,
  piedsPouces,
  rappelMesure,
  trierMesures,
  verifierSaisie,
} from './mesures';

const mesure = (surcharge: Partial<Mesure> = {}): Mesure => ({
  id: 'mesure-1',
  date: '2026-09-05',
  poids: 182.4,
  unitePoids: 'lb',
  tailleCm: 178,
  age: 42,
  ...surcharge,
});

describe('lireMesure', () => {
  it('relit une mesure en livres, ou en kilos', () => {
    expect(lireMesure(mesure())).toEqual(mesure());
    expect(lireMesure(mesure({ poids: 82.4, unitePoids: 'kg' }))).toEqual(mesure({ poids: 82.4, unitePoids: 'kg' }));
  });

  it('arrondit au dixième et ne garde que les champs connus', () => {
    const lue = lireMesure({ ...mesure({ poids: 182.4000001, tailleCm: 177.55 }), note: 'un champ de trop', __proto__: { x: 1 } });
    expect(lue).toEqual(mesure({ poids: 182.4, tailleCm: 177.6 }));
    expect(Object.keys(lue ?? {}).sort()).toEqual(['age', 'date', 'id', 'poids', 'tailleCm', 'unitePoids']);
  });

  it('refuse ce qui n’est pas une mesure', () => {
    for (const brut of [null, undefined, 42, 'mesure', [], [mesure()], {}]) expect(lireMesure(brut)).toBeNull();
  });

  it('refuse un identifiant que le serveur n’accepterait pas', () => {
    for (const id of ['', 'abc', 'a'.repeat(65), 'a b c d', 'é-mesure', 42, null, undefined]) {
      expect(lireMesure({ ...mesure(), id })).toBeNull();
    }
    expect(lireMesure(mesure({ id: 'abcd' }))).not.toBeNull();
    expect(lireMesure(mesure({ id: 'a'.repeat(64) }))).not.toBeNull();
  });

  it('refuse un jour qui n’existe pas', () => {
    for (const date of ['2026-02-31', '2026-13-01', '2026-00-10', '26-09-05', '2026-9-5', '2026-09-05T10:00', '1999-12-31', '2101-01-01', 20260905, null]) {
      expect(lireMesure({ ...mesure(), date })).toBeNull();
    }
    expect(lireMesure(mesure({ date: '2028-02-29' }))).not.toBeNull();
  });

  it('refuse une unité inconnue, et se garde de supposer celle d’une mesure sans unité', () => {
    expect(lireMesure({ ...mesure(), unitePoids: 'stone' })).toBeNull();
    const sansUnite: Record<string, unknown> = { ...mesure() };
    delete sansUnite.unitePoids;
    expect(lireMesure(sansUnite)).toBeNull();
  });

  it('refuse un poids, une taille ou un âge absurdes, aux deux bouts', () => {
    const { poids, tailleCm, age } = LIMITES_MESURE;
    for (const valeur of [poids.lb.min - 0.1, poids.lb.max + 0.1, 0, -5, NaN, Infinity, '182', null]) {
      expect(lireMesure({ ...mesure(), poids: valeur })).toBeNull();
    }
    // Les limites dépendent de l'unité : 100 kg passent, 800 kg non, et 30 lb non.
    expect(lireMesure(mesure({ poids: 100, unitePoids: 'kg' }))).not.toBeNull();
    expect(lireMesure(mesure({ poids: 800, unitePoids: 'kg' }))).toBeNull();
    expect(lireMesure(mesure({ poids: 30, unitePoids: 'lb' }))).toBeNull();
    expect(lireMesure(mesure({ poids: poids.lb.min }))).not.toBeNull();
    expect(lireMesure(mesure({ poids: poids.lb.max }))).not.toBeNull();
    for (const valeur of [tailleCm.min - 1, tailleCm.max + 1, NaN, '178', null]) {
      expect(lireMesure({ ...mesure(), tailleCm: valeur })).toBeNull();
    }
    for (const valeur of [age.min - 1, age.max + 1, 42.5, NaN, '42', null]) {
      expect(lireMesure({ ...mesure(), age: valeur })).toBeNull();
    }
    expect(lireMesure(mesure({ tailleCm: tailleCm.min, age: age.min }))).not.toBeNull();
    expect(lireMesure(mesure({ tailleCm: tailleCm.max, age: age.max }))).not.toBeNull();
  });
});

describe('lireMesures', () => {
  it('lit une liste sauvegardée : les mesures illisibles et les doublons sont écartés, le reste est remis dans l’ordre', () => {
    const lues = lireMesures([
      mesure({ id: 'mesure-b', date: '2026-09-05' }),
      { n: 'importe quoi' },
      mesure({ id: 'mesure-a', date: '2026-07-04' }),
      mesure({ id: 'mesure-a', date: '2026-01-01', poids: 100 }),
      mesure({ id: 'mesure-c', date: '2026-08-05', poids: 5 }),
      null,
      mesure({ id: 'mesure-d', date: '2026-08-05' }),
    ]);
    expect(lues.map((m) => m.id)).toEqual(['mesure-a', 'mesure-d', 'mesure-b']);
    // Le premier exemplaire d'un doublon l'emporte.
    expect(lues[0].date).toBe('2026-07-04');
  });

  it('une sauvegarde d’avant les mensurations n’en a pas : une liste vide, sans erreur', () => {
    for (const brut of [undefined, null, 'rien', 12, {}, { 0: mesure() }]) expect(lireMesures(brut)).toEqual([]);
  });

  it('ne garde pas plus que sa place, et garde les plus récentes', () => {
    const toutes = Array.from({ length: MESURES_MAXI + 5 }, (_, i) =>
      mesure({ id: `mesure-${String(i).padStart(5, '0')}`, date: new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10) }),
    );
    const lues = lireMesures(toutes);
    expect(lues).toHaveLength(MESURES_MAXI);
    expect(lues.at(-1)?.id).toBe(toutes.at(-1)?.id);
    expect(lues[0].id).toBe(toutes[5].id);
  });
});

describe('trierMesures', () => {
  it('range du plus ancien jour au plus récent, et le même jour dans l’ordre où elles ont été notées', () => {
    const triees = trierMesures([
      mesure({ id: 'mzz', date: '2026-09-05' }),
      mesure({ id: 'maa', date: '2026-09-05' }),
      mesure({ id: 'mbb', date: '2026-08-01' }),
    ]);
    expect(triees.map((m) => m.id)).toEqual(['mbb', 'maa', 'mzz']);
  });

  it('ne touche pas à la liste qu’on lui donne', () => {
    const liste = [mesure({ id: 'mb', date: '2026-09-05' }), mesure({ id: 'ma', date: '2026-08-01' })];
    trierMesures(liste);
    expect(liste.map((m) => m.id)).toEqual(['mb', 'ma']);
  });
});

describe('les jours', () => {
  it('jourLocal écrit le jour de l’heure du téléphone, avec ses zéros', () => {
    expect(jourLocal(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(jourLocal(new Date(2026, 0, 3, 0, 1))).toBe('2026-01-03');
    expect(jourLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('jourValide : un jour qui existe, de 2000 à 2100', () => {
    expect(jourValide('2026-10-05')).toBe(true);
    expect(jourValide('2024-02-29')).toBe(true);
    expect(jourValide('2026-02-29')).toBe(false);
    expect(jourValide('2026-04-31')).toBe(false);
    expect(jourValide('')).toBe(false);
    expect(jourValide(undefined)).toBe(false);
  });

  it('joursEntre compte les jours, sans que l’heure d’été y change rien', () => {
    expect(joursEntre('2026-09-05', '2026-10-05')).toBe(30);
    expect(joursEntre('2026-10-05', '2026-10-05')).toBe(0);
    expect(joursEntre('2026-10-05', '2026-09-05')).toBe(-30);
    // Le changement d'heure du printemps (8 mars) et de l'automne (1er novembre) au Québec.
    expect(joursEntre('2026-03-01', '2026-03-15')).toBe(14);
    expect(joursEntre('2026-10-25', '2026-11-08')).toBe(14);
    expect(joursEntre('2025-12-31', '2026-12-31')).toBe(365);
  });
});

describe('la taille en pieds et pouces', () => {
  it('au pouce près', () => {
    expect(piedsPouces(178)).toEqual({ pieds: 5, pouces: 10 });
    expect(piedsPouces(170)).toEqual({ pieds: 5, pouces: 7 });
    expect(piedsPouces(152.4)).toEqual({ pieds: 5, pouces: 0 });
    expect(piedsPouces(160)).toEqual({ pieds: 5, pouces: 3 });
    expect(piedsPouces(190)).toEqual({ pieds: 6, pouces: 3 });
  });

  it('un pouce arrondi à douze fait un pied de plus, pas « 5 pi 12 po »', () => {
    // 182,8 cm = 71,97 pouces.
    expect(piedsPouces(182.8)).toEqual({ pieds: 6, pouces: 0 });
    expect(libellePiedsPouces(182.8)).toBe('6 pi');
  });

  it('s’écrit « 5 pi 10 po », et « 6 pi » quand il ne reste pas de pouces', () => {
    expect(libellePiedsPouces(178)).toBe('5 pi 10 po');
    expect(libellePiedsPouces(183)).toBe('6 pi');
    expect(libellePiedsPouces(176.5)).toBe('5 pi 9 po');
  });
});

describe('le rappel d’une mesure par mois', () => {
  const du = (date: string) => ({ date });

  it('rappelle quand la dernière mesure date de plus de 30 jours', () => {
    expect(JOURS_ENTRE_MESURES).toBe(30);
    expect(rappelMesure([du('2026-09-05')], '2026-10-05')).toBeNull(); // 30 jours : pas encore
    expect(rappelMesure([du('2026-09-05')], '2026-10-06')).toEqual({ jours: 31 });
    expect(rappelMesure([du('2026-01-05')], '2026-10-07')).toEqual({ jours: 275 });
  });

  it('compte depuis la plus récente, pas depuis la première de la liste', () => {
    const mesures = [du('2026-03-01'), du('2026-10-01'), du('2026-06-01')];
    expect(joursDepuisDerniereMesure(mesures, '2026-10-07')).toBe(6);
    expect(rappelMesure(mesures, '2026-10-07')).toBeNull();
  });

  it('ne dit rien sans mesure — l’écran propose de noter le jour 1 — ni pour une mesure datée de demain', () => {
    expect(joursDepuisDerniereMesure([], '2026-10-07')).toBeNull();
    expect(rappelMesure([], '2026-10-07')).toBeNull();
    expect(rappelMesure([du('2026-10-08')], '2026-10-07')).toBeNull();
  });
});

describe('ce qu’on tape dans le formulaire', () => {
  it('lireNombre accepte la virgule des claviers français et ignore les espaces', () => {
    expect(lireNombre('182')).toBe(182);
    expect(lireNombre('182,4')).toBe(182.4);
    expect(lireNombre('182.4')).toBe(182.4);
    expect(lireNombre('  1 82,4 ')).toBe(182.4);
    for (const texte of ['', ' ', 'abc', '12abc', '-5', '1,2,3', '1e3', ',5', '5,', 'Infinity']) expect(lireNombre(texte)).toBeNull();
  });

  const saisie = { date: '2026-10-07', poids: '182,4', tailleCm: '178', age: '42' };

  it('une saisie correcte donne les valeurs de la mesure', () => {
    expect(verifierSaisie(saisie, 'lb', '2026-10-07')).toEqual({
      ok: true,
      valeurs: { date: '2026-10-07', poids: 182.4, tailleCm: 178, age: 42 },
    });
    expect(verifierSaisie({ ...saisie, poids: '82.46', tailleCm: '177,5' }, 'kg', '2026-10-07')).toEqual({
      ok: true,
      valeurs: { date: '2026-10-07', poids: 82.5, tailleCm: 177.5, age: 42 },
    });
  });

  it('dit en français simple ce qui ne va pas, champ par champ', () => {
    const resultat = verifierSaisie({ date: '', poids: '', tailleCm: '12', age: '42,5' }, 'lb', '2026-10-07');
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(Object.keys(resultat.erreurs).sort()).toEqual(['age', 'date', 'poids', 'tailleCm']);
    expect(resultat.erreurs.date).toBe('Choisis le jour de la mesure.');
    expect(resultat.erreurs.poids).toBe('Écris ton poids, entre 40 et 700 lb.');
    expect(resultat.erreurs.tailleCm).toBe('Écris ta taille en centimètres, entre 90 et 250.');
    expect(resultat.erreurs.age).toBe('Écris ton âge en années, entre 5 et 120.');
  });

  it('les limites du poids suivent l’unité', () => {
    const kilos = verifierSaisie({ ...saisie, poids: '10' }, 'kg', '2026-10-07');
    expect(kilos.ok).toBe(false);
    if (!kilos.ok) expect(kilos.erreurs.poids).toBe('Écris ton poids, entre 20 et 320 kg.');
    // 100 est un poids de corps en kilos, mais 100 lb aussi : c'est 45 kg, tout à fait possible.
    expect(verifierSaisie({ ...saisie, poids: '100' }, 'lb', '2026-10-07').ok).toBe(true);
    expect(verifierSaisie({ ...saisie, poids: '30' }, 'lb', '2026-10-07').ok).toBe(false);
  });

  it('refuse un jour qui n’est pas encore arrivé, mais pas aujourd’hui', () => {
    const demain = verifierSaisie({ ...saisie, date: '2026-10-08' }, 'lb', '2026-10-07');
    expect(demain.ok).toBe(false);
    if (!demain.ok) expect(demain.erreurs).toEqual({ date: 'Ce jour n’est pas encore arrivé.' });
    expect(verifierSaisie({ ...saisie, date: '2026-10-07' }, 'lb', '2026-10-07').ok).toBe(true);
    expect(verifierSaisie({ ...saisie, date: '2026-02-30' }, 'lb', '2026-10-07').ok).toBe(false);
  });

  it('ce que le formulaire accepte, la relecture l’accepte aussi — le serveur n’aura jamais à refuser', () => {
    for (const unite of ['lb', 'kg'] as const) {
      const { min, max } = LIMITES_MESURE.poids[unite];
      for (const poids of [min, max, (min + max) / 2]) {
        const resultat = verifierSaisie({ ...saisie, poids: String(poids) }, unite, '2026-10-07');
        expect(resultat.ok).toBe(true);
        if (resultat.ok) expect(lireMesure({ id: 'mesure-1', unitePoids: unite, ...resultat.valeurs })).not.toBeNull();
      }
    }
  });
});

describe('nouvelIdMesure', () => {
  it('donne des identifiants que le serveur accepte, tous différents', () => {
    const ids = Array.from({ length: 200 }, nouvelIdMesure);
    for (const id of ids) expect(id).toMatch(IDENTIFIANT_MESURE);
    expect(new Set(ids).size).toBe(200);
  });
});
