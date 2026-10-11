import { describe, expect, it } from 'vitest';
import type { ExerciceRealise, ParametresSeance, Ressenti, SeanceDuMois, SeanceRealisee, UnitePoids } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes } from './etapesSeance';
import { raccourcirPourEssai } from './essai';
import { chargeDeSerie, seancePourPersonne } from './programmeMois';
import {
  RESSENTIS,
  RESSENTIS_POUR_DESCENDRE,
  RESSENTIS_POUR_MONTER,
  ajustementDeCharge,
  avecCran,
  avecRessentis,
  estRessenti,
  exercicesAEvaluer,
  libelleCran,
  ligneProposition,
  lireRessentis,
  motRessenti,
  phraseRessenti,
  propositionDeCharge,
  raisonProposition,
  ressentisQuiChangent,
} from './ressenti';

const PARAMETRES_LB: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };
const PARAMETRES_KG: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'kg' };

/** Le jour n d'octobre 2026, à midi. */
const jour = (n: number) => new Date(2026, 9, n, 12).toISOString();

interface Fait {
  jour: number;
  ressenti?: Ressenti;
  poids?: number;
  seriesFaites?: number;
  parametres?: ParametresSeance;
  exerciceId?: string;
}

/** Une séance faite, avec un exercice (« goblet-squat » par défaut). */
function seance({ jour: n, ressenti, poids, seriesFaites = 3, parametres = PARAMETRES_LB, exerciceId = 'goblet-squat' }: Fait): SeanceRealisee {
  const exercice: ExerciceRealise = {
    exerciceId,
    seriesPrevues: 3,
    seriesFaites,
    reps: 8,
    dureeSec: 300,
    ...(poids ? { poids, poidsParSerie: [poids, poids, poids] } : {}),
    ...(ressenti ? { ressenti } : {}),
  };
  return {
    id: `s${n}`,
    date: jour(n),
    parametres,
    dureePrevueSec: 3600,
    dureeReelleSec: 3600,
    exercices: [exercice],
    terminee: true,
  };
}

/** L'historique, du plus récent au plus ancien comme l'application le garde. */
const historiqueDe = (...faits: Fait[]) => faits.map(seance).sort((a, b) => b.date.localeCompare(a.date));
const proposition = (faits: Fait[], unite: UnitePoids = 'lb') => propositionDeCharge(historiqueDe(...faits), 'goblet-squat', unite);

describe('les trois ressentis', () => {
  it('lourd, correct, léger — rien d’autre', () => {
    expect(RESSENTIS).toEqual(['lourd', 'correct', 'leger']);
    expect(RESSENTIS.every(estRessenti)).toBe(true);
    for (const autre of ['difficile', '', 'Léger', 3, null, undefined, {}]) expect(estRessenti(autre)).toBe(false);
    expect(RESSENTIS.map(motRessenti)).toEqual(['lourd', 'correct', 'léger']);
  });

  it('relit des ressentis avec prudence : le reste est écarté', () => {
    expect(lireRessentis({ a: 'leger', b: 'lourd', c: 'correct' })).toEqual({ a: 'leger', b: 'lourd', c: 'correct' });
    expect(lireRessentis({ a: 'leger', b: 'trop', c: 3, d: null })).toEqual({ a: 'leger' });
    for (const brut of [undefined, null, 'léger', 12, ['leger']]) expect(lireRessentis(brut)).toEqual({});
  });
});

describe('quand le ressenti propose un changement de charge', () => {
  it('les seuils sont deux fois de suite', () => {
    expect(RESSENTIS_POUR_MONTER).toBe(2);
    expect(RESSENTIS_POUR_DESCENDRE).toBe(2);
  });

  it('léger deux fois de suite : un cran de plus — 5 lb, ou 2,5 kg', () => {
    const faits: Fait[] = [
      { jour: 1, ressenti: 'leger', poids: 25 },
      { jour: 3, ressenti: 'leger', poids: 25 },
    ];
    expect(proposition(faits)).toEqual({ ressenti: 'leger', ajout: 5, fois: 2 });
    const enKilos = faits.map((f) => ({ ...f, parametres: PARAMETRES_KG, poids: 12.5 }));
    expect(proposition(enKilos, 'kg')).toEqual({ ressenti: 'leger', ajout: 2.5, fois: 2 });
  });

  it('lourd deux fois de suite : un cran de moins', () => {
    const faits: Fait[] = [
      { jour: 1, ressenti: 'lourd', poids: 30 },
      { jour: 3, ressenti: 'lourd', poids: 30 },
    ];
    expect(proposition(faits)).toEqual({ ressenti: 'lourd', ajout: -5, fois: 2 });
    expect(proposition(faits.map((f) => ({ ...f, parametres: PARAMETRES_KG, poids: 15 })), 'kg')).toEqual({
      ressenti: 'lourd',
      ajout: -2.5,
      fois: 2,
    });
  });

  it('une seule fois ne suffit pas, ni rien du tout', () => {
    expect(proposition([])).toBeNull();
    expect(proposition([{ jour: 1, ressenti: 'leger', poids: 25 }])).toBeNull();
    expect(proposition([{ jour: 1, ressenti: 'lourd', poids: 25 }])).toBeNull();
  });

  it('correct, ou un autre ressenti entre les deux, coupe la série', () => {
    const base = { poids: 25 };
    expect(proposition([{ jour: 1, ressenti: 'leger', ...base }, { jour: 3, ressenti: 'correct', ...base }, { jour: 5, ressenti: 'leger', ...base }])).toBeNull();
    expect(proposition([{ jour: 1, ressenti: 'leger', ...base }, { jour: 3, ressenti: 'lourd', ...base }, { jour: 5, ressenti: 'leger', ...base }])).toBeNull();
    // Léger, léger, puis correct la dernière fois : plus rien à proposer.
    expect(proposition([{ jour: 1, ressenti: 'leger', ...base }, { jour: 3, ressenti: 'leger', ...base }, { jour: 5, ressenti: 'correct', ...base }])).toBeNull();
    // Correct d'abord, puis deux léger plus récents : c'est le plus récent qui compte.
    expect(proposition([{ jour: 1, ressenti: 'correct', ...base }, { jour: 3, ressenti: 'leger', ...base }, { jour: 5, ressenti: 'leger', ...base }])).toMatchObject({ ajout: 5 });
  });

  it('une séance où l’on n’a rien dit ne coupe rien', () => {
    expect(
      proposition([
        { jour: 1, ressenti: 'leger', poids: 25 },
        { jour: 3, poids: 25 },
        { jour: 5, ressenti: 'leger', poids: 25 },
      ]),
    ).toMatchObject({ ressenti: 'leger', ajout: 5, fois: 2 });
  });

  it('la montée est consommée : une fois la charge changée, le compte repart de zéro', () => {
    const avant: Fait[] = [
      { jour: 1, ressenti: 'leger', poids: 25 },
      { jour: 3, ressenti: 'leger', poids: 25 },
    ];
    expect(proposition(avant)).toMatchObject({ ajout: 5 });
    // On a monté à 30 lb et c'était encore léger : une seule fois à 30, rien à proposer.
    const apres = [...avant, { jour: 5, ressenti: 'leger' as const, poids: 30 }];
    expect(proposition(apres)).toBeNull();
    // Rien dit à 30 lb : la proposition ne revient pas non plus.
    expect(proposition([...avant, { jour: 5, poids: 30 }])).toBeNull();
    // Léger une deuxième fois à 30 lb : nouvelle proposition, à partir de 30.
    expect(proposition([...apres, { jour: 7, ressenti: 'leger' as const, poids: 30 }])).toMatchObject({ ajout: 5, fois: 2 });
  });

  it('la descente aussi : lourd à la nouvelle charge repart de zéro', () => {
    const faits: Fait[] = [
      { jour: 1, ressenti: 'lourd', poids: 30 },
      { jour: 3, ressenti: 'lourd', poids: 30 },
      { jour: 5, ressenti: 'lourd', poids: 25 },
    ];
    expect(proposition(faits)).toBeNull();
    expect(proposition([...faits, { jour: 7, ressenti: 'lourd', poids: 25 }])).toMatchObject({ ajout: -5 });
  });

  it('tant qu’on ne change pas de charge, la proposition reste — et le compte aussi', () => {
    const faits: Fait[] = [1, 3, 5].map((n) => ({ jour: n, ressenti: 'leger' as const, poids: 25 }));
    expect(proposition(faits)).toEqual({ ressenti: 'leger', ajout: 5, fois: 3 });
  });

  it('une charge changée à la main, sans rien dire, repart aussi de zéro', () => {
    // Deux « léger » à 25 lb, puis 30 lb sans ressenti : on a déjà monté.
    expect(
      proposition([
        { jour: 1, ressenti: 'leger', poids: 25 },
        { jour: 3, ressenti: 'leger', poids: 25 },
        { jour: 5, poids: 35 },
      ]),
    ).toBeNull();
  });

  it('on ne descend pas sous un cran : un haltère de 5 lb est le plus léger', () => {
    const lourds = (poids: number): Fait[] => [1, 3].map((n) => ({ jour: n, ressenti: 'lourd' as const, poids }));
    expect(proposition(lourds(5))).toBeNull();
    expect(proposition(lourds(10))).toMatchObject({ ajout: -5 });
    expect(propositionDeCharge(historiqueDe(...[1, 3].map((n) => ({ jour: n, ressenti: 'lourd' as const, poids: 2.5, parametres: PARAMETRES_KG }))), 'goblet-squat', 'kg')).toBeNull();
  });

  it('sans charge notée, il n’y a rien à monter ni à descendre', () => {
    expect(proposition([1, 3].map((n) => ({ jour: n, ressenti: 'leger' as const })))).toBeNull();
  });

  it('un exercice passé sans faire une série ne compte pas', () => {
    expect(
      proposition([
        { jour: 1, ressenti: 'leger', poids: 25 },
        { jour: 3, ressenti: 'leger', poids: 25 },
        { jour: 5, ressenti: 'correct', poids: 25, seriesFaites: 0 },
      ]),
    ).toMatchObject({ ajout: 5 });
  });

  it('lit l’historique du plus récent au plus ancien, quel que soit son ordre', () => {
    const faits: Fait[] = [
      { jour: 1, ressenti: 'correct', poids: 25 },
      { jour: 3, ressenti: 'leger', poids: 25 },
      { jour: 5, ressenti: 'leger', poids: 25 },
    ];
    const bonOrdre = historiqueDe(...faits);
    const melange = [bonOrdre[1], bonOrdre[2], bonOrdre[0]];
    expect(propositionDeCharge(melange, 'goblet-squat', 'lb')).toEqual(propositionDeCharge(bonOrdre, 'goblet-squat', 'lb'));
    expect(propositionDeCharge(melange, 'goblet-squat', 'lb')).toMatchObject({ ajout: 5 });
  });

  it('ne regarde que l’exercice demandé', () => {
    const historique = [
      ...historiqueDe({ jour: 1, ressenti: 'leger', poids: 25 }, { jour: 3, ressenti: 'leger', poids: 25 }),
      ...historiqueDe({ jour: 2, ressenti: 'lourd', poids: 20, exerciceId: 'curl' }),
    ];
    expect(propositionDeCharge(historique, 'goblet-squat', 'lb')).toMatchObject({ ajout: 5 });
    expect(propositionDeCharge(historique, 'curl', 'lb')).toBeNull();
    expect(propositionDeCharge(historique, 'inconnu', 'lb')).toBeNull();
  });

  it('retrouve la même charge d’une unité à l’autre', () => {
    // 25 lb ≈ 11,5 kg : la conversion arrondit, la charge reste « la même ».
    const historique = [
      seance({ jour: 3, ressenti: 'leger', poids: 11.5, parametres: PARAMETRES_KG }),
      seance({ jour: 1, ressenti: 'leger', poids: 25 }),
    ];
    expect(propositionDeCharge(historique, 'goblet-squat', 'lb')).toMatchObject({ ajout: 5, fois: 2 });
    // Mais 25 lb puis 35 lb sont deux charges.
    const change = [seance({ jour: 3, ressenti: 'leger', poids: 16, parametres: PARAMETRES_KG }), seance({ jour: 1, ressenti: 'leger', poids: 25 })];
    expect(propositionDeCharge(change, 'goblet-squat', 'lb')).toBeNull();
  });

  it('écarte les séances sans date lisible, et un ressenti inconnu', () => {
    const a = seance({ jour: 1, ressenti: 'leger', poids: 25 });
    const b = seance({ jour: 3, ressenti: 'leger', poids: 25 });
    const casse = { ...seance({ jour: 5, ressenti: 'lourd', poids: 25 }), date: 'hier' };
    expect(propositionDeCharge([casse, b, a], 'goblet-squat', 'lb')).toMatchObject({ ajout: 5 });
    const inconnu = seance({ jour: 5, poids: 25 });
    inconnu.exercices[0].ressenti = 'trop' as unknown as Ressenti;
    expect(propositionDeCharge([inconnu, b, a], 'goblet-squat', 'lb')).toMatchObject({ ajout: 5 });
  });

  it('donne, pour plusieurs exercices, ceux dont le ressenti demande un changement', () => {
    const historique = [
      seance({ jour: 3, ressenti: 'leger', poids: 25 }),
      seance({ jour: 1, ressenti: 'leger', poids: 25 }),
      { ...seance({ jour: 3, ressenti: 'lourd', poids: 30, exerciceId: 'curl' }) },
      { ...seance({ jour: 1, ressenti: 'lourd', poids: 30, exerciceId: 'curl' }) },
      { ...seance({ jour: 3, ressenti: 'correct', poids: 30, exerciceId: 'bench-press' }) },
    ];
    expect(ressentisQuiChangent(historique, ['goblet-squat', 'curl', 'bench-press', 'inconnu', 'curl'], 'lb')).toEqual({
      'goblet-squat': 'leger',
      curl: 'lourd',
    });
    expect(ressentisQuiChangent([], ['goblet-squat'], 'lb')).toEqual({});
  });
});

describe('la charge proposée', () => {
  it('un cran de plus après la semaine dure, ou après deux « léger » — jamais deux crans', () => {
    expect(ajustementDeCharge(undefined)).toBeNull();
    expect(ajustementDeCharge({})).toBeNull();
    expect(ajustementDeCharge({ ajoutCharge: 5 })).toEqual({ ajout: 5, motif: 'semaine-dure' });
    expect(ajustementDeCharge({ ajustementRessenti: 5 })).toEqual({ ajout: 5, motif: 'leger' });
    // Les deux à la fois : un seul cran.
    expect(ajustementDeCharge({ ajoutCharge: 5, ajustementRessenti: 5 })).toEqual({ ajout: 5, motif: 'semaine-dure' });
    expect(ajustementDeCharge({ ajoutCharge: 2.5, ajustementRessenti: 2.5 })).toEqual({ ajout: 2.5, motif: 'semaine-dure' });
  });

  it('lourd deux fois de suite passe avant la semaine dure réussie', () => {
    expect(ajustementDeCharge({ ajustementRessenti: -5 })).toEqual({ ajout: -5, motif: 'lourd' });
    expect(ajustementDeCharge({ ajoutCharge: 5, ajustementRessenti: -5 })).toEqual({ ajout: -5, motif: 'lourd' });
  });

  it('ajoute ou retire un cran, sans jamais passer sous un cran', () => {
    expect(avecCran(25, 5)).toBe(30);
    expect(avecCran(30, -5)).toBe(25);
    expect(avecCran(10, -5)).toBe(5);
    expect(avecCran(5, -5)).toBe(5);
    expect(avecCran(2.5, -2.5)).toBe(2.5);
    expect(avecCran(7.5, -2.5)).toBe(5);
    expect(avecCran(0, 5)).toBe(0);
    expect(avecCran(0, -5)).toBe(0);
  });

  it('pré-remplit la charge de la dernière fois, un cran plus loin', () => {
    const passees = [25, 30, 30];
    const bloc = { series: 3 };
    expect(chargeDeSerie(bloc, [], passees, 1, 'lb')).toBe(25);
    // Léger deux fois de suite : +5 lb, série par série.
    const leger = { series: 3, ajustementRessenti: 5 };
    expect(chargeDeSerie(leger, [], passees, 1, 'lb')).toBe(30);
    expect(chargeDeSerie(leger, [], passees, 2, 'lb')).toBe(35);
    expect(chargeDeSerie(leger, [30], passees, 2, 'lb')).toBe(30);
    // Lourd deux fois de suite : −5 lb.
    const lourd = { series: 3, ajustementRessenti: -5 };
    expect(chargeDeSerie(lourd, [], passees, 1, 'lb')).toBe(20);
    expect(chargeDeSerie(lourd, [], passees, 3, 'lb')).toBe(25);
    // Une charge déjà tapée ne bouge jamais.
    expect(chargeDeSerie(lourd, [40], passees, 1, 'lb')).toBe(40);
    // Sans charge de la dernière fois, rien à ajuster.
    expect(chargeDeSerie(leger, [], [], 1, 'lb')).toBe(0);
  });

  it('semaine dure réussie et léger deux fois de suite : +5 lb une seule fois, pas +10', () => {
    const passees = [100, 100, 100];
    expect(chargeDeSerie({ series: 3, ajoutCharge: 5 }, [], passees, 1, 'lb')).toBe(105);
    expect(chargeDeSerie({ series: 3, ajoutCharge: 5, ajustementRessenti: 5 }, [], passees, 1, 'lb')).toBe(105);
    // Lourd gagne : on redescend, on ne monte pas.
    expect(chargeDeSerie({ series: 3, ajoutCharge: 5, ajustementRessenti: -5 }, [], passees, 1, 'lb')).toBe(95);
  });

  it('s’accorde avec la dernière série légère du mardi', () => {
    const bloc = { series: 3, derniereLegere: true, ajustementRessenti: 5 };
    expect(chargeDeSerie(bloc, [], [30, 30, 15], 1, 'lb')).toBe(35);
    // La dernière série reste à la moitié de la charge de la série d'avant (35 lb → 15 lb au cran).
    expect(chargeDeSerie(bloc, [35, 35], [30, 30, 15], 3, 'lb')).toBe(15);
  });
});

describe('les phrases', () => {
  it('dit le cran en livres ou en kilos, avec la virgule française', () => {
    expect(libelleCran(5, 'lb')).toBe('+5 lb');
    expect(libelleCran(-5, 'lb')).toBe('−5 lb');
    expect(libelleCran(2.5, 'kg')).toBe('+2,5 kg');
    expect(libelleCran(-2.5, 'kg')).toBe('−2,5 kg');
  });

  it('explique la proposition dans la séance guidée', () => {
    expect(phraseRessenti('leger', 5, 'lb')).toBe('Léger les 2 dernières fois : on monte de 5 lb');
    expect(phraseRessenti('lourd', -5, 'lb')).toBe('Lourd les 2 dernières fois : on redescend de 5 lb');
    expect(phraseRessenti('leger', 2.5, 'kg')).toBe('Léger les 2 dernières fois : on monte de 2,5 kg');
    expect(phraseRessenti('lourd', -2.5, 'kg')).toBe('Lourd les 2 dernières fois : on redescend de 2,5 kg');
  });

  it('résume la proposition sur l’accueil', () => {
    expect(ligneProposition('leger', 5, 'lb')).toBe('↑ +5 lb proposé');
    expect(ligneProposition('lourd', -5, 'lb')).toBe('↓ −5 lb proposé');
    expect(raisonProposition('leger')).toBe('léger 2 fois de suite');
    expect(raisonProposition('lourd')).toBe('lourd 2 fois de suite');
  });
});

describe('dans la séance du programme', () => {
  const JEUDI: SeanceDuMois = {
    id: 'jeudi',
    nom: 'Jeudi',
    jour: 4,
    type: 'dure',
    format: 'series',
    partie: 'complet',
    exercices: ['trap-bar-deadlift', 'seesaw-row', 'kb-superman', 'kb-arnold-press'],
    finale: 'leg-press',
    liens: [['seesaw-row', 'kb-superman']],
    tour: ['trap-bar-deadlift', 'leg-press'],
  };
  const SEUL = { personne: 'sebastien' as const };
  const LUNDI = new Date(2026, 9, 5);

  it('chaque exercice porte le cran que son ressenti demande, dans l’unité de la séance', () => {
    const contexte = { ...SEUL, ressentis: { 'seesaw-row': 'leger' as const, 'kb-arnold-press': 'lourd' as const } };
    const enLivres = seancePourPersonne(JEUDI, PARAMETRES_LB, contexte, LUNDI);
    const par = (id: string) => enLivres.blocs.find((b) => b.exerciceId === id)!;
    expect(par('seesaw-row').ajustementRessenti).toBe(5);
    expect(par('kb-arnold-press').ajustementRessenti).toBe(-5);
    expect(par('trap-bar-deadlift').ajustementRessenti).toBeUndefined();
    const enKilos = seancePourPersonne(JEUDI, PARAMETRES_KG, contexte, LUNDI);
    expect(enKilos.blocs.find((b) => b.exerciceId === 'seesaw-row')!.ajustementRessenti).toBe(2.5);
    expect(enKilos.blocs.find((b) => b.exerciceId === 'kb-arnold-press')!.ajustementRessenti).toBe(-2.5);
    // Sans ressenti, rien ne change à la séance.
    expect(seancePourPersonne(JEUDI, PARAMETRES_LB, SEUL, LUNDI).blocs.some((b) => b.ajustementRessenti !== undefined)).toBe(false);
  });

  it('un exercice qu’on ne charge pas (au temps) n’a pas de cran', () => {
    const marche: SeanceDuMois = { ...JEUDI, exercices: ['farmers-walk'], liens: [], finale: undefined };
    const seanceFaite = seancePourPersonne(marche, PARAMETRES_LB, { ...SEUL, ressentis: { 'farmers-walk': 'leger' } }, LUNDI);
    expect(seanceFaite.blocs.map((b) => [b.exerciceId, b.ajustementRessenti])).toEqual([['farmers-walk', undefined]]);
  });

  it('semaine dure réussie et léger sur le même exercice : un seul cran dans la séance', () => {
    const contexte = { ...SEUL, augmenter: ['trap-bar-deadlift'], ressentis: { 'trap-bar-deadlift': 'leger' as const } };
    const bloc = seancePourPersonne(JEUDI, PARAMETRES_LB, contexte, LUNDI).blocs[0];
    expect(ajustementDeCharge(bloc)).toEqual({ ajout: 5, motif: 'semaine-dure' });
    expect(chargeDeSerie(bloc, [], [100, 100, 100], 1, 'lb')).toBe(105);
  });

  it('de l’historique à la charge proposée : léger deux fois, +5 lb ; une fois montée, plus rien', () => {
    const faits = (poids: number, ...ressentis: Ressenti[]) =>
      ressentis.map((ressenti, i) => seance({ jour: 1 + 2 * i, ressenti, poids, exerciceId: 'seesaw-row' }));
    const proposer = (historique: SeanceRealisee[]) => {
      const trie = [...historique].sort((a, b) => b.date.localeCompare(a.date));
      const ressentis = ressentisQuiChangent(trie, JEUDI.exercices, 'lb');
      const bloc = seancePourPersonne(JEUDI, PARAMETRES_LB, { ...SEUL, ressentis }, LUNDI).blocs.find((b) => b.exerciceId === 'seesaw-row')!;
      return chargeDeSerie(bloc, [], [20, 20, 20], 1, 'lb');
    };
    expect(proposer(faits(20, 'correct'))).toBe(20);
    expect(proposer(faits(20, 'leger'))).toBe(20);
    expect(proposer(faits(20, 'leger', 'leger'))).toBe(25);
    // La montée est faite (25 lb, léger) : on garde 25 la prochaine fois.
    const montee = [...faits(20, 'leger', 'leger'), seance({ jour: 9, ressenti: 'leger', poids: 25, exerciceId: 'seesaw-row' })];
    const ressentis = ressentisQuiChangent([...montee].reverse(), ['seesaw-row'], 'lb');
    expect(ressentis).toEqual({});
    expect(proposer(faits(20, 'lourd', 'lourd'))).toBe(15);
  });

  it('l’essai garde le cran du ressenti, comme celui de la semaine dure', () => {
    const contexte = { ...SEUL, ressentis: { 'trap-bar-deadlift': 'lourd' as const } };
    const courte = raccourcirPourEssai(seancePourPersonne(JEUDI, PARAMETRES_LB, contexte, LUNDI));
    expect(courte.blocs[0].ajustementRessenti).toBe(-5);
  });
});

describe('quand on dit son ressenti dans la séance guidée', () => {
  const PAIRES: SeanceDuMois = {
    id: 'lundi-a',
    nom: 'Lundi A',
    jour: 1,
    semaine: 'A',
    type: 'facile',
    format: 'series',
    partie: 'bas',
    exercices: ['kb-superman', 'kb-side-leg-raise', 'kb-bob-and-weave', 'kb-deadlift'],
    liens: [
      ['kb-superman', 'kb-side-leg-raise'],
      ['kb-bob-and-weave', 'kb-deadlift'],
    ],
    finale: 'hack-squat',
    tour: ['hack-squat'],
  };
  const LUNDI = new Date(2026, 9, 5);
  const seances = {
    seul: seancePourPersonne(PAIRES, PARAMETRES_LB, { personne: 'sebastien' }, LUNDI),
    duo: seancePourPersonne(PAIRES, PARAMETRES_LB, { personne: 'max', aDeux: true }, LUNDI),
    essai: raccourcirPourEssai(seancePourPersonne(PAIRES, PARAMETRES_LB, { personne: 'sebastien' }, LUNDI)),
  };

  /** Pour chaque étape : ce qu'on propose d'évaluer. */
  const proposes = (nom: keyof typeof seances) => {
    const etapes = construireEtapes(seances[nom]);
    return etapes.map((_, i) => exercicesAEvaluer(etapes, i));
  };

  it('jamais pendant une série, une préparation ou l’échauffement', () => {
    for (const nom of ['seul', 'duo', 'essai'] as const) {
      const etapes = construireEtapes(seances[nom]);
      etapes.forEach((etape, i) => {
        if (etape.type === 'repos' || etape.type === 'retourCalme') return;
        expect(exercicesAEvaluer(etapes, i)).toEqual([]);
      });
    }
  });

  it('après la dernière série d’un exercice seul, pendant la pause qui suit', () => {
    const etapes = construireEtapes(seances.seul);
    const dernieres = etapes
      .map((e, i) => [e, i] as const)
      .filter(([e]) => e.type === 'serie' && e.exerciceId === 'hack-squat' && e.serie === e.series);
    expect(dernieres).toHaveLength(1);
    const [, indexDerniere] = dernieres[0];
    // Pas encore pendant la série elle-même ; ensuite, aux étirements (le dernier exercice n'a pas de pause après).
    expect(exercicesAEvaluer(etapes, indexDerniere)).toEqual([]);
    const apres = etapes.findIndex((e, i) => i > indexDerniere && e.type === 'retourCalme');
    expect(exercicesAEvaluer(etapes, apres)).toEqual(['hack-squat']);
  });

  it('une paire : le premier exercice pendant la transition, les deux pendant la pause de la paire', () => {
    const etapes = construireEtapes(seances.seul);
    const A = 'kb-superman';
    const B = 'kb-side-leg-raise';
    const series = (id: string) =>
      etapes.flatMap((e, i) => (e.type === 'serie' && e.exerciceId === id ? [i] : []));
    const [premiereA, , derniereA] = series(A);
    const [premiereB, , derniereB] = series(B);
    // Après la 1re série de chacun : ce n'est pas la dernière, rien à dire.
    expect(exercicesAEvaluer(etapes, premiereA + 1)).toEqual([]);
    expect(exercicesAEvaluer(etapes, premiereB + 1)).toEqual([]);
    // Après la 3e série de A, la transition vers B : A seul.
    expect(etapes[derniereA + 1].type).toBe('repos');
    expect(exercicesAEvaluer(etapes, derniereA + 1)).toEqual([A]);
    // Après la dernière série de B, la pause de la paire : A et B.
    expect(etapes[derniereB + 1].type).toBe('repos');
    expect(exercicesAEvaluer(etapes, derniereB + 1)).toEqual([A, B]);
  });

  it('chaque paire à son tour, pas celle d’avant', () => {
    const etapes = construireEtapes(seances.seul);
    const resultats = proposes('seul').filter((ids) => ids.length > 0);
    expect(resultats.some((ids) => ids.join() === 'kb-superman,kb-side-leg-raise')).toBe(true);
    expect(resultats.some((ids) => ids.join() === 'kb-bob-and-weave,kb-deadlift')).toBe(true);
    expect(resultats.some((ids) => ids.join() === 'hack-squat')).toBe(true);
    // Pendant la pause de la seconde paire, la première n'est plus proposée.
    const pause = etapes.findIndex((e, i) => e.type === 'repos' && exercicesAEvaluer(etapes, i).includes('kb-deadlift'));
    expect(exercicesAEvaluer(etapes, pause)).not.toContain('kb-superman');
  });

  it('à deux comme seul, et dans l’essai (une seule série) : le dernier exercice se juge aux étirements', () => {
    for (const nom of ['seul', 'duo', 'essai'] as const) {
      const etapes = construireEtapes(seances[nom]);
      const retour = etapes.findIndex((e) => e.type === 'retourCalme');
      expect(retour).toBeGreaterThan(0);
      expect(exercicesAEvaluer(etapes, retour)).toEqual(['hack-squat']);
      // Chaque exercice est proposé au moins une fois, quelque part.
      const tous = new Set(proposes(nom).flat());
      expect([...tous].sort()).toEqual([...PAIRES.exercices, 'hack-squat'].sort());
    }
  });

  it('rien pendant un circuit', () => {
    const etapes = construireEtapes({
      ...seances.seul,
      blocs: [],
      circuit: { stations: ['goblet-squat', 'curl'], tours: 2, travailSec: 30, reposSec: 10, reposEntreToursSec: 30 },
    });
    etapes.forEach((_, i) => expect(exercicesAEvaluer(etapes, i)).toEqual([]));
  });

  it('une étape qui n’existe pas ne propose rien', () => {
    expect(exercicesAEvaluer([], 0)).toEqual([]);
    expect(exercicesAEvaluer(construireEtapes(seances.seul), 9999)).toEqual([]);
  });
});

describe('la séance faite, avec ses ressentis', () => {
  const faite = seance({ jour: 3, poids: 25 });
  const avec = (r: Record<string, Ressenti>) => avecRessentis(faite, r);

  it('garde le ressenti de chaque exercice', () => {
    expect(avec({ 'goblet-squat': 'leger' }).exercices[0].ressenti).toBe('leger');
    expect(avec({ 'goblet-squat': 'lourd' }).exercices[0].ressenti).toBe('lourd');
    expect(avec({ 'goblet-squat': 'correct' }).exercices[0].ressenti).toBe('correct');
  });

  it('sans ressenti, la séance reste telle quelle — pas de champ en trop', () => {
    expect(avec({})).toBe(faite);
    expect('ressenti' in avec({ autre: 'leger' }).exercices[0]).toBe(false);
  });

  it('n’en met pas sur un exercice passé sans une série', () => {
    const passee = { ...faite, exercices: [{ ...faite.exercices[0], seriesFaites: 0 }] };
    expect(avecRessentis(passee, { 'goblet-squat': 'leger' }).exercices[0].ressenti).toBeUndefined();
  });

  it('ne touche pas à la séance d’origine', () => {
    avec({ 'goblet-squat': 'leger' });
    expect(faite.exercices[0].ressenti).toBeUndefined();
  });

  it('écarte une valeur inconnue, et ne confond pas un exercice avec une clé héritée', () => {
    expect(avec({ 'goblet-squat': 'trop' as unknown as Ressenti }).exercices[0].ressenti).toBeUndefined();
    const heritee = { ...faite, exercices: [{ ...faite.exercices[0], exerciceId: 'constructor' }] };
    expect(avecRessentis(heritee, { autre: 'leger' }).exercices[0].ressenti).toBeUndefined();
  });
});
