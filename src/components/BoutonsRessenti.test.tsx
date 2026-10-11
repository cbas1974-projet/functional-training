import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Ressenti } from '../types';
import BoutonsRessenti from './BoutonsRessenti';

const EXERCICES = [
  { id: 'kb-superman', nom: 'Superman au kettlebell' },
  { id: 'kb-side-leg-raise', nom: 'Élévation latérale de jambe' },
];

type Bouton = ReactElement<{ onClick: () => void; 'aria-pressed': boolean; children: ReactNode }>;

/** Les boutons de l'arbre rendu, dans l'ordre. Le composant n'a que des
 *  éléments HTML : on peut le lire sans navigateur et « toucher » ses boutons. */
function boutons(noeud: ReactNode): Bouton[] {
  if (Array.isArray(noeud)) return noeud.flatMap(boutons);
  if (!isValidElement<{ children?: ReactNode }>(noeud)) return [];
  if (noeud.type === 'button') return [noeud as Bouton];
  return boutons(noeud.props.children);
}

const rendre = (ressentis: Record<string, Ressenti>, onChoisir = vi.fn(), exercices = EXERCICES) =>
  BoutonsRessenti({ exercices, ressentis, onChoisir });

describe('les boutons de ressenti', () => {
  it('trois gros boutons par exercice : Lourd, Correct, Léger', () => {
    const html = renderToStaticMarkup(<BoutonsRessenti exercices={[EXERCICES[0]]} ressentis={{}} onChoisir={() => {}} />);
    const mots = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
    expect(mots).toEqual(['Lourd', 'Correct', 'Léger']);
    expect(html).toContain('Superman au kettlebell');
    // Facultatif, et assez grands pour le pouce.
    expect(html).toContain('facultatif');
    expect(html.match(/min-h-14/g)).toHaveLength(3);
  });

  it('une paire : les deux exercices, chacun ses trois boutons', () => {
    const html = renderToStaticMarkup(<BoutonsRessenti exercices={EXERCICES} ressentis={{}} onChoisir={() => {}} />);
    expect([...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])).toEqual([
      'Lourd', 'Correct', 'Léger', 'Lourd', 'Correct', 'Léger',
    ]);
    expect(html).toContain('Superman au kettlebell');
    expect(html).toContain('Élévation latérale de jambe');
  });

  it('rien à dire, rien d’affiché', () => {
    expect(renderToStaticMarkup(<BoutonsRessenti exercices={[]} ressentis={{}} onChoisir={() => {}} />)).toBe('');
  });

  it('un toucher donne le ressenti de l’exercice', () => {
    const onChoisir = vi.fn();
    const [lourd, correct, leger, , , legerDeLAutre] = boutons(rendre({}, onChoisir));
    leger.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-superman', 'leger');
    lourd.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-superman', 'lourd');
    correct.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-superman', 'correct');
    legerDeLAutre.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-side-leg-raise', 'leger');
    expect(onChoisir).toHaveBeenCalledTimes(4);
  });

  it('montre le choix fait, et un autre toucher le change', () => {
    const [lourd, correct, leger] = boutons(rendre({ 'kb-superman': 'leger' }));
    expect([lourd, correct, leger].map((b) => b.props['aria-pressed'])).toEqual([false, false, true]);
    // L'autre exercice n'a rien reçu.
    const autres = boutons(rendre({ 'kb-superman': 'leger' })).slice(3);
    expect(autres.map((b) => b.props['aria-pressed'])).toEqual([false, false, false]);
    // Toucher « Lourd » à la place : le parent reçoit le nouveau choix.
    const onChoisir = vi.fn();
    boutons(rendre({ 'kb-superman': 'leger' }, onChoisir))[0].props.onClick();
    expect(onChoisir).toHaveBeenCalledWith('kb-superman', 'lourd');
    // Rendu avec le nouveau choix : c'est lui qui est marqué.
    expect(boutons(rendre({ 'kb-superman': 'lourd' })).slice(0, 3).map((b) => b.props['aria-pressed'])).toEqual([true, false, false]);
  });

  it('dit au lecteur d’écran quel bouton est choisi', () => {
    const html = renderToStaticMarkup(<BoutonsRessenti exercices={[EXERCICES[0]]} ressentis={{ 'kb-superman': 'correct' }} onChoisir={() => {}} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Correct</);
  });
});
