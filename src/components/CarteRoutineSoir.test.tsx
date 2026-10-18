import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CarteRoutineSoir, { PointsSemaine } from './CarteRoutineSoir';
import { avecSoir, sansSoir, serieDeSoirs } from '../utils/routineSoir';

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

describe('rattraper un soir passé, depuis les sept points', () => {
  // Dimanche 18 octobre 2026, 21 h 30. Le vendredi 16 a été fait de mémoire, sans coche.
  const MAINTENANT = new Date(2026, 9, 18, 21, 30);
  const sansLe16 = { soirs: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-17'] };

  it('chaque point devient un bouton qui dit ce que l’appui va faire', () => {
    const html = renderToStaticMarkup(
      <PointsSemaine routine={sansLe16} maintenant={MAINTENANT} onBasculerSoir={() => undefined} />,
    );
    expect(html.match(/<button/g)).toHaveLength(7);
    expect(html).toContain('2026-10-16 : pas faite, appuyer pour marquer');
    expect(html).toContain('2026-10-17 : faite, appuyer pour retirer');
    expect(html).toContain('2026-10-18 (ce soir) : pas faite, appuyer pour marquer');
  });

  it('sans la fonction, les points restent une simple image (la carte de l’accueil est déjà un bouton)', () => {
    const html = renderToStaticMarkup(<PointsSemaine routine={sansLe16} maintenant={MAINTENANT} />);
    expect(html).not.toContain('<button');
  });

  it('marquer le 16 recolle la série : 1 d’affilée devient 6 (du 12 au 17)', () => {
    expect(serieDeSoirs(sansLe16, MAINTENANT)).toBe(1);
    const rattrapee = avecSoir(sansLe16, '2026-10-16');
    expect(serieDeSoirs(rattrapee, MAINTENANT)).toBe(6);
    expect(serieDeSoirs(sansSoir(rattrapee, '2026-10-16'), MAINTENANT)).toBe(1);
  });
});
