import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CarteRoutineSoir, { PointsSemaine } from './CarteRoutineSoir';

/** Dimanche 11 octobre 2026, 21 h 30 : un soir. */
const SOIR = new Date(2026, 9, 11, 21, 30);

describe('la carte de la routine du soir, sur l’accueil', () => {
  const rendre = (routine?: Parameters<typeof CarteRoutineSoir>[0]['routine'], personne: 'sebastien' | 'max' = 'sebastien') =>
    renderToStaticMarkup(<CarteRoutineSoir personne={personne} routine={routine} maintenant={SOIR} onOuvrir={() => undefined} />);

  it('annonce la durée, ce qu’elle contient et les sept derniers soirs', () => {
    const html = rendre({ soirs: ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-10'] });
    // Dix minutes au plus : gainage, mobilité pour le jiu-jitsu, cou, trois étirements.
    expect(html).toContain('Routine du soir · 10 min');
    expect(html).toContain('Gainage, mobilité, cou et 3 étirements, tous les soirs');
    expect(html).toContain('4 soirs sur 7');
    expect(html).toContain('2 d’affilée');
    // Une initiale par jour, de lundi à dimanche.
    expect(html).toContain('>L<');
    expect(html).toContain('>D<');
    expect(html).toContain('Les 7 derniers soirs : 4 soirs sur 7');
  });

  it('la durée suit les parties allumées', () => {
    const sansGainage = rendre({ eteintes: ['gainage'] });
    expect(sansGainage).toContain('Routine du soir · 7 min');
    expect(sansGainage).toContain('Mobilité, cou et 3 étirements, tous les soirs');
    expect(sansGainage).not.toContain('Gainage');
    const etirements = rendre({ eteintes: ['gainage', 'mobilite', 'cou'] });
    expect(etirements).toContain('Routine du soir · 3 min');
    expect(etirements).toContain('3 étirements, tous les soirs');
    const cou = rendre({ eteintes: ['gainage', 'mobilite', 'etirements'] });
    expect(cou).toContain('Routine du soir · 1 min');
    expect(cou).toContain('Cou, tous les soirs');
  });

  it('dit « Faite ce soir ✓ » quand c’est fait', () => {
    expect(rendre({ soirs: ['2026-10-11'] })).toContain('Faite ce soir ✓');
    expect(rendre({ soirs: ['2026-10-10'] })).not.toContain('Faite ce soir');
  });

  it('commence à zéro, sans série', () => {
    const html = rendre(undefined, 'max');
    expect(html).toContain('0 soir sur 7');
    expect(html).not.toContain('d’affilée');
  });

  it('suit la liste de chacun : deux étirements, et la durée baisse', () => {
    const routine = { listes: { sebastien: ['etir-ischios-allonge', 'etir-genou-en-travers'] } };
    expect(rendre(routine)).toContain('Gainage, mobilité, cou et 2 étirements');
    expect(rendre(routine)).toContain('Routine du soir · 9 min');
  });

  it('les points sont sept, pleins pour les soirs faits', () => {
    const html = renderToStaticMarkup(<PointsSemaine routine={{ soirs: ['2026-10-11', '2026-10-10'] }} maintenant={SOIR} />);
    expect(html.match(/rounded-full/g)).toHaveLength(7);
    expect(html.match(/background:var\(--montee\)/g)).toHaveLength(2);
  });
});
