import { describe, expect, it } from 'vitest';
import type { Douleur } from '../types';
import { EXERCICES, EXERCICES_PAR_ID } from '../data/exercices';
import { chargeLeBasDuDos } from './programmeMois';
import { PART_ALLEGEE, chargeAllegee, chargesDeLaSerie, libelleDisques, libelleParCote, seCharge } from './charges';
import type { ParametresCharge } from './charges';

const TRAP_BAR = EXERCICES_PAR_ID['trap-bar-deadlift'];
const PRESSE = EXERCICES_PAR_ID['leg-press'];

/** Une série, en livres, sans rien d'autre que ce qu'on précise. */
const serie = (p: Partial<ParametresCharge> & Pick<ParametresCharge, 'exercice'>) =>
  chargesDeLaSerie({ saisies: [], passees: [], serie: 1, unite: 'lb', ...p });

describe('70 % de la charge, au cran près', () => {
  it('arrondit au 5 lb le plus proche, au 2,5 kg en kilos', () => {
    expect(PART_ALLEGEE).toBe(0.7);
    expect(chargeAllegee(100, 'lb')).toBe(70);
    expect(chargeAllegee(135, 'lb')).toBe(95); // 94,5
    expect(chargeAllegee(185, 'lb')).toBe(130); // 129,5
    expect(chargeAllegee(110, 'lb')).toBe(75); // 77 → 75
    // À égale distance, le cran du dessus : 87,5 → 90, sans erreur d'arrondi.
    expect(chargeAllegee(125, 'lb')).toBe(90);
    expect(chargeAllegee(40, 'kg')).toBe(27.5); // 28
    expect(chargeAllegee(60, 'kg')).toBe(42.5); // 42
    expect(chargeAllegee(42.5, 'kg')).toBe(30); // 29,75
  });

  it('jamais sous un cran, jamais au-dessus de la charge, rien sans charge', () => {
    expect(chargeAllegee(5, 'lb')).toBe(5);
    expect(chargeAllegee(10, 'lb')).toBe(5);
    expect(chargeAllegee(3, 'lb')).toBe(3);
    expect(chargeAllegee(0, 'lb')).toBe(0);
    expect(chargeAllegee(-10, 'lb')).toBe(0);
    expect(chargeAllegee(Number.NaN, 'kg')).toBe(0);
  });
});

describe('la charge de chaque série', () => {
  it('au bas du dos : la première série à 70 %, les suivantes à 100 %', () => {
    expect(chargeLeBasDuDos(TRAP_BAR)).toBe(true);
    // La dernière fois : 95 (la série à 70 %), puis 135 et 135.
    const passees = [95, 135, 135];
    expect(serie({ exercice: TRAP_BAR, passees })).toEqual({ proposee: 95, pleine: 135, allegee: 95 });
    // La première faite à 95 : la deuxième repart à 100 %, pas à 95.
    expect(serie({ exercice: TRAP_BAR, passees, saisies: [95], serie: 2 })).toEqual({ proposee: 135, pleine: 135, allegee: 95 });
    // Une deuxième plus légère : la troisième la suit.
    expect(serie({ exercice: TRAP_BAR, passees, saisies: [95, 125], serie: 3 }).proposee).toBe(125);
    // Ce qui est déjà noté reste noté.
    expect(serie({ exercice: TRAP_BAR, passees, saisies: [100], serie: 1 }).proposee).toBe(100);
  });

  it('au bas du dos, le cran du ressenti part de la charge de travail', () => {
    const passees = [95, 135, 135];
    expect(serie({ exercice: TRAP_BAR, passees, bloc: { series: 3, ajustementRessenti: 5 } })).toEqual({
      proposee: 100,
      pleine: 140,
      allegee: 100,
    });
    expect(serie({ exercice: TRAP_BAR, passees, bloc: { series: 3, ajustementRessenti: -5 }, serie: 2 }).proposee).toBe(130);
  });

  it('au bas du dos, sans dernière fois : rien à proposer, puis la série d’avant', () => {
    expect(serie({ exercice: TRAP_BAR })).toEqual({ proposee: 0, pleine: 0, allegee: 0 });
    expect(serie({ exercice: TRAP_BAR, saisies: [95], serie: 2 })).toEqual({ proposee: 95, pleine: 95, allegee: 65 });
    expect(serie({ exercice: TRAP_BAR, saisies: [95, 135], serie: 3 })).toMatchObject({ proposee: 135, pleine: 135 });
  });

  it('ailleurs, rien ne change : la série d’avant, sinon la même la dernière fois', () => {
    expect(chargeLeBasDuDos(PRESSE)).toBe(false);
    const passees = [180, 200, 200];
    expect(serie({ exercice: PRESSE, passees })).toEqual({ proposee: 180, pleine: 200, allegee: 140 });
    expect(serie({ exercice: PRESSE, passees, saisies: [190], serie: 2 }).proposee).toBe(190);
    expect(serie({ exercice: PRESSE, passees, bloc: { series: 3, ajustementRessenti: 5 }, serie: 2 }).proposee).toBe(205);
  });

  it('une douleur : chaque série à 70 % de la charge retenue en la signalant, sans montée', () => {
    const douleur: Douleur = { depuis: '2026-10-11T12:00:00.000Z', charge: 200, unite: 'lb' };
    // La dernière fois, avec la douleur : 140. Les 70 % ne fondent pas.
    const passees = [140, 140, 140];
    for (const n of [1, 2, 3]) {
      expect(serie({ exercice: PRESSE, passees, serie: n, saisies: [140, 140].slice(0, n - 1), douleur })).toEqual({
        proposee: 140,
        pleine: 200,
        allegee: 140,
      });
    }
    // « Léger » ne fait pas monter ; « lourd » fait toujours redescendre.
    expect(serie({ exercice: PRESSE, passees, douleur, bloc: { series: 3, ajustementRessenti: 5 } }).pleine).toBe(200);
    expect(serie({ exercice: PRESSE, passees, douleur, bloc: { series: 3, ajustementRessenti: -5 } })).toEqual({
      proposee: 135,
      pleine: 195,
      allegee: 135,
    });
    // Au bas du dos aussi, chaque série.
    const dos: Douleur = { depuis: '', charge: 135, unite: 'lb' };
    expect(serie({ exercice: TRAP_BAR, passees: [95, 135], serie: 2, saisies: [95], douleur: dos }).proposee).toBe(95);
    // En kilos, la charge retenue en livres est convertie.
    expect(serie({ exercice: PRESSE, unite: 'kg', douleur }).pleine).toBe(90.5);
    expect(serie({ exercice: PRESSE, unite: 'kg', douleur }).allegee).toBe(62.5);
  });

  it('une douleur sans charge connue : comme d’habitude, sans montée ni 70 % de plus', () => {
    const douleur: Douleur = { depuis: '' };
    const passees = [100, 100];
    expect(serie({ exercice: PRESSE, passees, douleur })).toEqual({ proposee: 100, pleine: 100, allegee: 70 });
    expect(serie({ exercice: PRESSE, passees, douleur, bloc: { series: 2, ajustementRessenti: 5 } }).proposee).toBe(100);
    expect(serie({ exercice: PRESSE, passees, douleur, bloc: { series: 2, ajustementRessenti: -5 } }).proposee).toBe(95);
  });

  it('on enlève la douleur : tout redevient comme avant', () => {
    const passees = [140, 140, 140];
    expect(serie({ exercice: PRESSE, passees, douleur: null })).toEqual(serie({ exercice: PRESSE, passees }));
    expect(serie({ exercice: PRESSE, passees, bloc: { series: 3, ajustementRessenti: 5 } }).proposee).toBe(145);
  });
});

describe('de chaque côté', () => {
  it('la trap bar, la presse et le hack squat se chargent des deux côtés, et eux seuls', () => {
    const parCote = EXERCICES.filter((exercice) => exercice.chargeParCote).map((exercice) => exercice.id);
    expect(parCote.sort()).toEqual(['hack-squat', 'leg-press', 'trap-bar-deadlift']);
  });

  it('« soit 35 lb de chaque côté » : la moitié des disques', () => {
    expect(libelleParCote(70, 'lb')).toBe('soit 35 lb de chaque côté');
    expect(libelleParCote(135, 'lb')).toBe('soit 67,5 lb de chaque côté');
    expect(libelleParCote(45, 'kg')).toBe('soit 22,5 kg de chaque côté');
  });

  it('le poids noté : les disques seulement, sans la barre ni le chariot', () => {
    expect(libelleDisques(TRAP_BAR)).toBe('disques seulement, sans la barre');
    expect(libelleDisques(PRESSE)).toBe('disques seulement, sans le chariot');
    expect(libelleDisques(EXERCICES_PAR_ID['hack-squat'])).toBe('disques seulement, sans le chariot');
    expect(libelleDisques(EXERCICES_PAR_ID['leg-curl-machine'])).toBeNull();
  });
});

describe('les exercices qui se chargent', () => {
  it('la saisie, les raccourcis et le ressenti : seulement là où il y a une charge', () => {
    const marche = EXERCICES_PAR_ID['farmers-walk'];
    expect(seCharge(TRAP_BAR)).toBe(true);
    expect(seCharge(PRESSE)).toBe(true);
    // Au temps, mais chargée : la marche du fermier garde sa saisie.
    expect(seCharge(marche)).toBe(true);
    // Au poids du corps (sans matériel, ou sur le tapis) : rien à noter.
    expect(seCharge({ ...TRAP_BAR, materiel: 'aucun' })).toBe(false);
    expect(seCharge({ ...PRESSE, materiel: 'tapis' })).toBe(false);
    // Une tenue au temps sur un banc : le temps compte, pas la charge.
    expect(seCharge({ ...marche, materiel: 'banc' })).toBe(false);
    // Les étirements et le yoga.
    expect(seCharge(EXERCICES_PAR_ID['etir-mollet-mur'])).toBe(false);
  });
});
