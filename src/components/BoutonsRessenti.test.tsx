import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Ressenti } from '../types';
import BoutonsRessenti, { VisagesRessenti } from './BoutonsRessenti';

const EXERCICES = [
  { id: 'kb-superman', nom: 'Superman au kettlebell' },
  { id: 'kb-side-leg-raise', nom: 'Élévation latérale de jambe' },
];

type Bouton = ReactElement<{ onClick: () => void; 'aria-pressed': boolean; 'aria-label': string; children: ReactNode }>;

/** Les boutons de l'arbre rendu, dans l'ordre. Les composants n'ont que des
 *  éléments HTML et d'autres composants sans état : on peut les lire sans
 *  navigateur et « toucher » leurs boutons. */
function boutons(noeud: ReactNode): Bouton[] {
  if (Array.isArray(noeud)) return noeud.flatMap(boutons);
  if (!isValidElement<{ children?: ReactNode }>(noeud)) return [];
  if (noeud.type === 'button') return [noeud as Bouton];
  if (typeof noeud.type === 'function') return boutons((noeud.type as (props: unknown) => ReactNode)(noeud.props));
  return boutons(noeud.props.children);
}

/** Les visages des boutons, dans l'ordre. */
const visages = (html: string) => [...html.matchAll(/<button[^>]*><span aria-hidden="true">([^<]*)<\/span><\/button>/g)].map((m) => m[1]);

const rendre = (ressentis: Record<string, Ressenti>, onChoisir = vi.fn(), exercices = EXERCICES) =>
  BoutonsRessenti({ exercices, ressentis, onChoisir });

describe('les visages du ressenti', () => {
  it('trois gros visages par exercice, de gauche à droite : 😊 facile, 😐 correct, ☹️ difficile', () => {
    const html = renderToStaticMarkup(<BoutonsRessenti exercices={[EXERCICES[0]]} ressentis={{}} onChoisir={() => {}} />);
    expect(visages(html)).toEqual(['😊', '😐', '☹️']);
    expect(html).toContain('Superman au kettlebell');
    // Les mots Lourd, Correct, Léger ne sont plus des boutons.
    expect(html).not.toMatch(/<button[^>]*>(Lourd|Léger)</);
    // Facultatif, et assez grands pour le doigt.
    expect(html).toContain('facultatif');
    expect(html.match(/min-h-14/g)).toHaveLength(3);
    // Le lecteur d'écran dit ce que veut dire chaque visage.
    expect(html).toContain('aria-label="Facile (léger)"');
    expect(html).toContain('aria-label="Correct"');
    expect(html).toContain('aria-label="Difficile (lourd)"');
  });

  it('rappelle ce que doit être la dernière série, une fois', () => {
    const html = renderToStaticMarkup(<BoutonsRessenti exercices={EXERCICES} ressentis={{}} onChoisir={() => {}} />);
    const texte = html.replace(/<[^>]+>/g, '');
    expect(texte).toContain('La dernière série doit être dure : 1 à 3 répétitions en réserve.');
    expect(texte).toContain('😊 facile · 😐 correct · ☹️ difficile');
    // Une seule fois, même pour une paire.
    expect(texte.match(/en réserve/g)).toHaveLength(1);
  });

  it('une paire : les deux exercices, chacun ses trois visages', () => {
    const html = renderToStaticMarkup(<BoutonsRessenti exercices={EXERCICES} ressentis={{}} onChoisir={() => {}} />);
    expect(visages(html)).toEqual(['😊', '😐', '☹️', '😊', '😐', '☹️']);
    expect(html).toContain('Superman au kettlebell');
    expect(html).toContain('Élévation latérale de jambe');
  });

  it('rien à dire, rien d’affiché', () => {
    expect(renderToStaticMarkup(<BoutonsRessenti exercices={[]} ressentis={{}} onChoisir={() => {}} />)).toBe('');
  });

  it('un toucher donne le ressenti de l’exercice — la même donnée qu’avant : léger, correct, lourd', () => {
    const onChoisir = vi.fn();
    const [facile, correct, difficile, facileDeLAutre] = boutons(rendre({}, onChoisir));
    facile.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-superman', 'leger');
    difficile.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-superman', 'lourd');
    correct.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-superman', 'correct');
    facileDeLAutre.props.onClick();
    expect(onChoisir).toHaveBeenLastCalledWith('kb-side-leg-raise', 'leger');
    expect(onChoisir).toHaveBeenCalledTimes(4);
  });

  it('montre le choix fait, et un autre toucher le change', () => {
    const [facile, correct, difficile] = boutons(rendre({ 'kb-superman': 'leger' }));
    expect([facile, correct, difficile].map((b) => b.props['aria-pressed'])).toEqual([true, false, false]);
    // L'autre exercice n'a rien reçu.
    const autres = boutons(rendre({ 'kb-superman': 'leger' })).slice(3);
    expect(autres.map((b) => b.props['aria-pressed'])).toEqual([false, false, false]);
    // Toucher ☹️ à la place : le parent reçoit le nouveau choix.
    const onChoisir = vi.fn();
    boutons(rendre({ 'kb-superman': 'leger' }, onChoisir))[2].props.onClick();
    expect(onChoisir).toHaveBeenCalledWith('kb-superman', 'lourd');
    // Rendu avec le nouveau choix : c'est lui qui est marqué.
    expect(boutons(rendre({ 'kb-superman': 'lourd' })).slice(0, 3).map((b) => b.props['aria-pressed'])).toEqual([false, false, true]);
  });

  it('dit au lecteur d’écran quel visage est choisi', () => {
    const html = renderToStaticMarkup(<BoutonsRessenti exercices={[EXERCICES[0]]} ressentis={{ 'kb-superman': 'correct' }} onChoisir={() => {}} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toMatch(/aria-pressed="true" aria-label="Correct"/);
  });

  it('en petit, dans la case d’une colonne : toujours trois visages, assez grands pour le doigt', () => {
    const html = renderToStaticMarkup(<VisagesRessenti compact choisi={undefined} nom="Big Max, Développé couché" onChoisir={() => {}} />);
    expect(visages(html)).toEqual(['😊', '😐', '☹️']);
    expect(html.match(/min-h-12/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Ressenti : Big Max, Développé couché"');
  });
});
