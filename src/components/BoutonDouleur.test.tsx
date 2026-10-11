import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BoutonDouleur, { ReperDouleur } from './BoutonDouleur';

describe('« J’ai mal à cet exercice »', () => {
  it('un interrupteur assez grand pour le pouce, qui dit son effet quand il est allumé', () => {
    const eteint = renderToStaticMarkup(<BoutonDouleur actif={false} onBasculer={() => {}} />);
    expect(eteint).toContain('aria-pressed="false"');
    expect(eteint).toContain('J’ai mal à cet exercice');
    expect(eteint).not.toContain('70 %');
    expect(eteint).toContain('min-height:44px');
    const allume = renderToStaticMarkup(<BoutonDouleur actif onBasculer={() => {}} />);
    expect(allume).toContain('aria-pressed="true"');
    expect(allume).toContain('Charges à 70 %, pas de montée');
  });

  it('le repère sur l’exercice', () => {
    expect(renderToStaticMarkup(<ReperDouleur />)).toContain('Douleur · 70 %');
  });
});
