// @vitest-environment jsdom
//
// La séance guidée sur un seul téléphone, exercice par exercice (décision de
// Sébastien, 13 octobre 2026), jouée dans un vrai DOM : un seul « Exercice
// terminé » par exercice, grisé tant qu'il manque un visage, la pause de fin
// qu'il lance, « Pause · 1 min » qui ne change pas d'exercice, les 70 % qui
// ne collent plus, le double toucher, et la reprise d'une séance commencée en
// version 1.2.0.
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Douleur, ParametresSeance, ProgressionSeance, Seance, SeanceDuMois } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapesParSerie } from '../utils/etapesSeance';
import { basculerDouleur } from '../utils/douleurs';
import { seancePourPersonne } from '../utils/programmeMois';
import SeanceGuidee from './SeanceGuidee';

// Le son et la vibration, comptés plutôt que joués.
const sons = vi.hoisted(() => ({ cloches: [] as string[], vibrations: 0, bips: 0 }));
vi.mock('../utils/sounds', () => ({
  bellSound: {
    unlock() {},
    playTick() {},
    playBell(type: string) {
      sons.cloches.push(type);
    },
    playSoftBell() {},
    playCountdown() {
      sons.bips += 1;
    },
    playWarning() {},
  },
  vibrer() {
    sons.vibrations += 1;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom ne fait pas défiler : rien à faire.
Element.prototype.scrollIntoView = function scrollIntoView() {};
Element.prototype.scrollTo = function scrollTo() {};

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };

/** Le mardi de ce matin, sur le téléphone de Speedy : le développé couché
 *  aux haltères seul (Big Max en fait quatre séries, Speedy trois), puis le
 *  curl avec les mollets. */
const MARDI: SeanceDuMois = {
  id: 'mardi',
  nom: 'Mardi — le haut',
  jour: 2,
  type: 'dure',
  partie: 'haut',
  format: 'series',
  exercices: ['bench-press', 'alternating-curl', 'calf-raise'],
  finale: 'dumbbell-push-up',
  liens: [['alternating-curl', 'calf-raise']],
};
const SEANCE: Seance = seancePourPersonne(MARDI, PARAMETRES, { personne: 'sebastien', aDeux: true, unTelephone: true }, new Date(2026, 9, 13));

/** Ce que l'accueil passe à la séance : les douleurs vivent au-dessus d'elle,
 *  chacun les siennes. */
function Banc({
  progression = null,
  demarrage = 'debut',
  onProgression,
}: {
  progression?: ProgressionSeance | null;
  demarrage?: 'debut' | 'reprise';
  onProgression: (progression: ProgressionSeance | null) => void;
}) {
  const [douleurs, setDouleurs] = useState<Record<string, Douleur>>({});
  const [douleursAutre, setDouleursAutre] = useState<Record<string, Douleur>>({});
  return (
    <SeanceGuidee
      seance={SEANCE}
      progression={progression}
      demarrage={demarrage}
      onProgression={onProgression}
      onTerminee={() => {}}
      onQuitter={() => {}}
      douleurs={douleurs}
      douleursAutre={douleursAutre}
      onBasculerDouleur={(qui, exerciceId, charge, unite) =>
        (qui === 'moi' ? setDouleurs : setDouleursAutre)((prec) => basculerDouleur(prec, exerciceId, charge, unite))
      }
    />
  );
}

let conteneur: HTMLDivElement;
let racine: Root;
let sauvegardes: (ProgressionSeance | null)[];

const derniere = () => sauvegardes.filter((s): s is ProgressionSeance => s !== null).at(-1);
const avancer = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const cliquer = (element: Element | null | undefined) => {
  if (!(element instanceof HTMLElement)) throw new Error('Rien à toucher');
  act(() => {
    element.click();
  });
};
/** Le bouton dont le texte contient ces mots. */
const bouton = (mots: string) =>
  [...conteneur.querySelectorAll('button')].find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').includes(mots));
/** « Pause · 1 min », pendant un exercice (son texte tient sur deux lignes). */
const boutonPause = () => conteneur.querySelector('footer button[aria-label="Pause · 1 min"]');
/** La barre du bas. */
const barre = () => conteneur.querySelector('footer[aria-label="Actions"]');
const texteBarre = () => (barre()?.textContent ?? '').replace(/\s+/g, ' ');
/** Le nom de l'étape, en tête de l'écran : « Exercice », « Paire », « Pause ». */
const phase = () => conteneur.querySelector('header .uppercase')?.textContent;
const champ = (libelle: string) => conteneur.querySelector<HTMLInputElement>(`input[aria-label="${libelle}"]`);
const valeur = (libelle: string) => champ(libelle)?.value;
const saisir = (libelle: string, texte: string) => {
  const input = champ(libelle);
  if (!input) throw new Error(`Pas de case « ${libelle} »`);
  act(() => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, texte);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => input.blur());
};
const visage = (nom: string, sens: 'Facile (léger)' | 'Correct' | 'Difficile (lourd)') =>
  cliquer(conteneur.querySelector(`[aria-label="Ressenti : ${nom}"] button[aria-label="${sens}"]`));
const max = (serie: number) => `Charge de Big Max, série ${serie} (lb)`;

function lancer(props: { progression?: ProgressionSeance | null; demarrage?: 'debut' | 'reprise' } = {}) {
  act(() => {
    racine.render(<Banc {...props} onProgression={(p) => sauvegardes.push(p)} />);
  });
}

/** Du début jusqu'au développé couché : l'échauffement passé. */
function jusquAuDeveloppe() {
  lancer();
  avancer(700);
  cliquer(bouton('Passer l’échauffement'));
  avancer(700);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 13, 7, 0, 0));
  sons.cloches = [];
  sons.vibrations = 0;
  sons.bips = 0;
  sauvegardes = [];
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});

afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  vi.useRealTimers();
});

describe('un exercice à la fois, sur un seul téléphone', () => {
  it('tout l’exercice d’un coup : les séries des deux, sans « Série terminée »', () => {
    jusquAuDeveloppe();
    expect(phase()).toBe('Exercice');
    for (const serie of [1, 2, 3]) expect(champ(`Charge de Speedy, série ${serie} (lb)`)).not.toBeNull();
    for (const serie of [1, 2, 3, 4]) expect(champ(max(serie))).not.toBeNull();
    expect(bouton('Série terminée')).toBeUndefined();
    expect(boutonPause()?.textContent).toBe('Pause1 min');
    expect(texteBarre()).toContain('Exercice terminé');
  });

  it('« Exercice terminé » est grisé tant qu’il manque un visage, et dit lequel ; le toucher ne change pas d’exercice', () => {
    jusquAuDeveloppe();
    const terminer = () => bouton('Exercice terminé');
    expect(terminer()?.getAttribute('aria-disabled')).toBe('true');
    // Un exercice seul : le nom de la personne suffit.
    expect(texteBarre()).toContain('Choisis un visage : Speedy');
    expect(texteBarre()).not.toContain('Choisis un visage : Speedy, ');
    cliquer(terminer());
    avancer(700);
    // Toujours le même exercice, et les visages qui manquent sont entourés.
    expect(phase()).toBe('Exercice');
    expect(derniere()?.faites).toEqual([]);
    expect(conteneur.querySelector('#visages-moi-bench-press')?.getAttribute('style')).toContain('outline');
    // Speedy a dit le sien : c'est au tour de Big Max.
    visage('Speedy, Développé couché avec haltères', 'Correct');
    expect(terminer()?.getAttribute('aria-disabled')).toBe('true');
    expect(texteBarre()).toContain('Choisis un visage : Big Max');
    visage('Big Max, Développé couché avec haltères', 'Facile (léger)');
    expect(terminer()?.getAttribute('aria-disabled')).toBeNull();
    expect(texteBarre()).not.toContain('Choisis un visage');
  });

  it('un seul appui : « Exercice terminé » note les séries des deux et lance la pause de fin, qui ouvre l’exercice suivant', () => {
    jusquAuDeveloppe();
    saisir(max(1), '23');
    visage('Speedy, Développé couché avec haltères', 'Correct');
    visage('Big Max, Développé couché avec haltères', 'Difficile (lourd)');
    avancer(700);
    cliquer(bouton('Exercice terminé'));
    // La pause de fin : une minute, « +15 s » et « Passer ».
    expect(phase()).toBe('Pause');
    expect(texteBarre()).toContain('1:00');
    expect(texteBarre()).toContain('+15 s');
    expect(texteBarre()).toContain('Passer');
    // Toutes les séries comptent : les charges affichées sont notées telles
    // quelles, le visage de chacun gardé.
    const apres = derniere();
    expect(apres?.deroule).toBe('par-exercice');
    expect(apres?.faites).toEqual([1]);
    expect(apres?.poidsAutre?.['bench-press']).toEqual([23, 23, 23, 23]);
    expect(apres?.ressentis?.['bench-press']).toBe('correct');
    expect(apres?.ressentisAutre?.['bench-press']).toBe('lourd');
    // Au bout de la minute : la cloche, la vibration, et la paire s'ouvre.
    avancer(30_000);
    expect(phase()).toBe('Pause');
    avancer(31_000);
    expect(phase()).toBe('Paire');
    expect(texteBarre()).toContain('Paire terminée');
    // Dans une paire, le bouton dit aussi l'exercice.
    expect(texteBarre()).toContain('Choisis un visage : Speedy, Curl alterné');
    expect(sons.vibrations).toBe(1);
    expect(sons.cloches).toContain('start');
  });

  it('un double toucher sur « Exercice terminé » ne saute pas la pause', () => {
    jusquAuDeveloppe();
    visage('Speedy, Développé couché avec haltères', 'Correct');
    visage('Big Max, Développé couché avec haltères', 'Correct');
    avancer(700);
    cliquer(bouton('Exercice terminé'));
    // Le second toucher tombe sur « Passer », au même endroit : ignoré.
    cliquer(bouton('Passer'));
    expect(phase()).toBe('Pause');
    // Plus tard, « Passer » compte.
    avancer(700);
    cliquer(bouton('Passer'));
    expect(phase()).toBe('Paire');
  });

  it('« Pause · 1 min » compte, sonne et vibre, sans changer d’exercice ; un second toucher l’arrête', () => {
    jusquAuDeveloppe();
    const index = derniere()?.indexEtape;
    cliquer(boutonPause());
    expect(texteBarre()).toContain('1:00');
    expect(texteBarre()).toContain('Arrêter la pause');
    // L'écran se rafraîchit toutes les 80 ms et arrondit au-dessus.
    avancer(30_100);
    expect(texteBarre()).toContain('0:30');
    expect(phase()).toBe('Exercice');
    // Les dernières secondes, battement par battement, comme à l'écran.
    avancer(25_900);
    for (let i = 0; i < 50; i += 1) avancer(100);
    // Finie : la cloche et la vibration — et toujours le même exercice.
    expect(sons.vibrations).toBe(1);
    expect(sons.bips).toBe(3);
    expect(boutonPause()).not.toBeNull();
    expect(phase()).toBe('Exercice');
    expect(derniere()?.indexEtape).toBe(index);
    expect(champ(max(4))).not.toBeNull();
    // Relancée puis arrêtée : rien ne sonne.
    cliquer(boutonPause());
    avancer(5_000);
    cliquer(bouton('Arrêter la pause'));
    avancer(60_000);
    expect(sons.vibrations).toBe(1);
    expect(phase()).toBe('Exercice');
  });
});

describe('les 70 % ne collent plus (le bug du 13 octobre 2026)', () => {
  it('Big Max : S1 tapée à 23 ; ses séries suivantes à 23, pas à 15 — même après « J’ai mal » allumé puis éteint', () => {
    jusquAuDeveloppe();
    saisir(max(1), '23');
    expect([2, 3, 4].map((serie) => valeur(max(serie)))).toEqual(['23', '23', '23']);
    // « J'ai mal » pour Big Max : ses séries à 70 %, celles de Speedy ne bougent pas.
    cliquer(conteneur.querySelector('[aria-label="Big Max : j’ai mal à cet exercice"]'));
    expect([2, 3, 4].map((serie) => valeur(max(serie)))).toEqual(['15', '15', '15']);
    expect(valeur(max(1))).toBe('23');
    // Éteint : de nouveau 23 partout.
    cliquer(conteneur.querySelector('[aria-label="Big Max : j’ai mal à cet exercice"]'));
    expect(conteneur.querySelector('[aria-label="Big Max : j’ai mal à cet exercice"]')?.getAttribute('aria-pressed')).toBe('false');
    expect([2, 3, 4].map((serie) => valeur(max(serie)))).toEqual(['23', '23', '23']);
  });

  it('« 70 % » touché sur une série : elle seule à 15, les suivantes restent à 23', () => {
    jusquAuDeveloppe();
    saisir(max(1), '23');
    // Les raccourcis attendent qu'on touche une case.
    expect(conteneur.querySelector('[aria-label="Charge faite"]')).toBeNull();
    act(() => champ(max(2))?.focus());
    const raccourcis = conteneur.querySelector('[aria-label="Charge faite"]');
    expect(raccourcis?.textContent).toContain('70 %15');
    expect(raccourcis?.textContent).toContain('100 %23');
    cliquer([...(raccourcis?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.startsWith('70 %')));
    expect(valeur(max(2))).toBe('15');
    expect([3, 4].map((serie) => valeur(max(serie)))).toEqual(['23', '23']);
    // « Exercice terminé » note ce qui est affiché.
    visage('Speedy, Développé couché avec haltères', 'Correct');
    visage('Big Max, Développé couché avec haltères', 'Correct');
    avancer(700);
    cliquer(bouton('Exercice terminé'));
    expect(derniere()?.poidsAutre?.['bench-press']).toEqual([23, 15, 23, 23]);
  });
});

describe('une séance commencée avec la version 1.2.0', () => {
  it('reprend sans planter, sur l’exercice en cours, avec les charges notées', () => {
    const parSerie = construireEtapesParSerie(SEANCE);
    const ancienne = (exerciceId: string, serie: number, qui: string) =>
      parSerie.findIndex((e) => e.type === 'serie' && e.exerciceId === exerciceId && e.serie === serie && e.qui === qui);
    // Ce matin, en 1.2.0 : la deuxième série de Big Max, sa première notée à 23.
    const progression: ProgressionSeance = {
      seance: SEANCE,
      indexEtape: ancienne('bench-press', 2, 'autre'),
      tempsCumuleSec: 420,
      tempsParEtapeSec: parSerie.map((_, i) => (i < 6 ? 60 : 0)),
      poids: { 'bench-press': [20] },
      ressentis: {},
      poidsAutre: { 'bench-press': [23] },
      ressentisAutre: {},
      faites: [ancienne('bench-press', 1, 'autre'), ancienne('bench-press', 1, 'moi')],
      demarreeLe: '2026-10-13T11:00:00.000Z',
      sauvegardeeLe: '2026-10-13T11:07:00.000Z',
    };
    lancer({ progression, demarrage: 'reprise' });
    avancer(700);
    expect(phase()).toBe('Exercice');
    expect(valeur(max(1))).toBe('23');
    expect([2, 3, 4].map((serie) => valeur(max(serie)))).toEqual(['23', '23', '23']);
    expect(valeur('Charge de Speedy, série 1 (lb)')).toBe('20');
    expect(bouton('Exercice terminé')?.getAttribute('aria-disabled')).toBe('true');
    // La sauvegarde suivante est par exercice.
    expect(derniere()?.deroule).toBe('par-exercice');
    expect(derniere()?.poidsAutre).toEqual({ 'bench-press': [23] });
  });
});
