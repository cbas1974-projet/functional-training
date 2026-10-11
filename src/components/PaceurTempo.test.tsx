import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PaceurTempo from './PaceurTempo';

const lire = () => null;

describe('la bille, selon la forme du mouvement', () => {
  it('monte et descend sur un rail debout, par défaut', () => {
    const html = renderToStaticMarkup(<PaceurTempo lire={lire} resteSec={2.2} phase="monte" avecChiffre hauteurPx={176} />);
    expect(html).toContain('height:176px;width:92px');
    expect(html).toContain('>3<');
  });

  it('fait le tour d’un cercle pour un mouvement circulaire, avec le décompte du tour', () => {
    const html = renderToStaticMarkup(
      <PaceurTempo lire={lire} resteSec={5.5} phase="tourne" avecChiffre forme="circulaire" hauteurPx={176} />,
    );
    // Un cercle carré de la hauteur du rail, et la bille de la couleur de la montée.
    expect(html).toContain('height:176px;width:176px');
    expect(html).toContain('border:12px solid var(--surface-haute)');
    expect(html).toContain('var(--montee)');
    expect(html).toContain('>6<');
  });

  it('va et vient sur un rail couché pour un mouvement d’un côté à l’autre', () => {
    const html = renderToStaticMarkup(
      <PaceurTempo lire={lire} resteSec={1} phase="descend" avecChiffre={false} forme="rotation" hauteurPx={176} />,
    );
    expect(html).toContain('height:92px;width:280px');
    expect(html).toContain('var(--descente)');
    expect(html).not.toContain('chiffres');
  });
});
