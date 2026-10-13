// @vitest-environment jsdom
//
// Après la séance du 13 octobre 2026, jouées dans un vrai DOM : la finale de
// dix minutes avant les étirements (un gros décompte, « Démarrer », « Pause »,
// le choix du traîneau, de la marche du fermier ou du sac de sable, un poids
// facultatif, la cloche et la vibration à la fin) ; 👎 « Pas aimé » dans la
// carte de l'exercice, et le bandeau de l'accueil la fois suivante ; l'image
// d'un exercice qu'on touche pendant la séance, en grand.
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntrainementState, ParametresSeance, ProgressionSeance, Seance, SeanceDuMois, SeanceRealisee } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes } from '../utils/etapesSeance';
import { basculerPasAimeDe } from '../utils/pasAimes';
import { genererProgramme, seancePourPersonne } from '../utils/programmeMois';
import { ETAT_PAR_DEFAUT } from '../utils/storage';
import Accueil from './Accueil';
import SeanceGuidee from './SeanceGuidee';

// Le son et la vibration, comptés plutôt que joués.
const sons = vi.hoisted(() => ({ cloches: [] as string[], vibrations: 0 }));
vi.mock('../utils/sounds', () => ({
  bellSound: {
    unlock() {},
    playTick() {},
    playBell(type: string) {
      sons.cloches.push(type);
    },
    playSoftBell() {},
    playCountdown() {},
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
window.scrollTo = () => {};

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };

/** Un mardi court, sur le téléphone de Speedy, avec Big Max : le développé
 *  couché seul, le curl avec les mollets, les pompes ; puis la finale du
 *  mardi, le sac de sable, et les étirements. */
const MARDI: SeanceDuMois = {
  id: 'mardi-a',
  nom: 'Mardi A — le haut',
  jour: 2,
  semaine: 'A',
  type: 'facile',
  partie: 'haut',
  format: 'series',
  exercices: ['bench-press', 'alternating-curl', 'calf-raise'],
  finale: 'dumbbell-push-up',
  liens: [['alternating-curl', 'calf-raise']],
};
const SEANCE: Seance = seancePourPersonne(MARDI, PARAMETRES, { personne: 'sebastien', aDeux: true, unTelephone: true }, new Date(2026, 9, 13));
const ETAPES = construireEtapes(SEANCE);
const INSTALLATION_FINALE = ETAPES.findIndex((e) => e.type === 'finale');

/** La séance, reprise juste avant la finale : le dernier exercice fini. */
const avantLaFinale: ProgressionSeance = {
  seance: SEANCE,
  indexEtape: INSTALLATION_FINALE,
  tempsCumuleSec: 3000,
  tempsParEtapeSec: ETAPES.map((_, i) => (i < INSTALLATION_FINALE ? 60 : 0)),
  poids: {},
  ressentis: {},
  poidsAutre: {},
  ressentisAutre: {},
  faites: ETAPES.flatMap((e, i) => (e.type === 'exercice' ? [i] : [])),
  deroule: 'par-exercice',
  demarreeLe: '2026-10-13T11:00:00.000Z',
  sauvegardeeLe: '2026-10-13T12:00:00.000Z',
};

/** Ce que l'accueil passe à la séance : les 👎 vivent au-dessus d'elle,
 *  chacun les siens. */
function Banc({
  progression = null,
  onProgression,
  onTerminee,
  onPasAimes,
}: {
  progression?: ProgressionSeance | null;
  onProgression: (progression: ProgressionSeance | null) => void;
  onTerminee: (realisee: SeanceRealisee) => void;
  onPasAimes?: (etat: Pick<EntrainementState, 'pasAimes' | 'pasAimesAutre'>) => void;
}) {
  const [etat, setEtat] = useState<Pick<EntrainementState, 'pasAimes' | 'pasAimesAutre'>>({});
  return (
    <SeanceGuidee
      seance={SEANCE}
      progression={progression}
      demarrage={progression ? 'reprise' : 'debut'}
      onProgression={onProgression}
      onTerminee={onTerminee}
      onQuitter={() => {}}
      chargesPasseesAutre={{ traineau: [180] }}
      // « J'ai mal » est là, à côté : ici, il ne change rien.
      onBasculerDouleur={() => {}}
      pasAimes={etat.pasAimes}
      pasAimesAutre={etat.pasAimesAutre}
      onBasculerPasAime={(qui, exerciceId) => {
        const suivant = { ...etat, ...basculerPasAimeDe(etat, qui, exerciceId, new Date(2026, 9, 13, 8)) };
        setEtat(suivant);
        onPasAimes?.(suivant);
      }}
    />
  );
}

let conteneur: HTMLDivElement;
let racine: Root;
let sauvegardes: (ProgressionSeance | null)[];
let enregistrees: SeanceRealisee[];

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
/** Le bouton dont le texte contient ces mots, dans tout le document. */
const bouton = (mots: string) =>
  [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').includes(mots));
const barre = () => conteneur.querySelector('footer[aria-label="Actions"]');
const texteBarre = () => (barre()?.textContent ?? '').replace(/\s+/g, ' ');
const phase = () => conteneur.querySelector('header .uppercase')?.textContent;
const texte = () => (conteneur.textContent ?? '').replace(/\s+/g, ' ');
const saisir = (libelle: string, valeur: string) => {
  const input = conteneur.querySelector<HTMLInputElement>(`input[aria-label="${libelle}"]`);
  if (!input) throw new Error(`Pas de case « ${libelle} »`);
  act(() => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, valeur);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => input.blur());
};

function lancer(props: { progression?: ProgressionSeance | null; onPasAimes?: Parameters<typeof Banc>[0]['onPasAimes'] } = {}) {
  act(() => {
    racine.render(
      <Banc
        {...props}
        onProgression={(p) => sauvegardes.push(p)}
        onTerminee={(r) => enregistrees.push(r)}
      />,
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 13, 7, 0, 0));
  sons.cloches = [];
  sons.vibrations = 0;
  sauvegardes = [];
  enregistrees = [];
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});

afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  vi.useRealTimers();
});

describe('la finale : dix minutes au chrono, juste avant les étirements', () => {
  it('après le dernier exercice : le gros décompte à 10:00 qui attend « Démarrer », le choix des trois, le poids de chacun si on veut', () => {
    lancer({ progression: avantLaFinale });
    avancer(700);
    expect(phase()).toBe('Finale');
    // Le décompte, au repos : rien ne tourne avant « Démarrer ».
    expect(texte()).toContain('10:00');
    avancer(90_000);
    expect(texte()).toContain('10:00');
    expect(phase()).toBe('Finale');
    // Pas de « Pause » avant de démarrer : « Démarrer », seul.
    expect(texteBarre()).toContain('Démarrer');
    expect(texteBarre()).not.toContain('Pause');
    // La finale du mardi, proposée : le sac de sable ; on peut prendre une
    // autre des trois.
    const choix = [...conteneur.querySelectorAll('[aria-label="La finale"] button')];
    expect(choix.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Traîneau', 'false'],
      ['Fermier', 'false'],
      ['Sac de sable', 'true'],
    ]);
    expect(texte()).toContain('Sac sur une épaule, changer d’épaule à chaque tour.');
    cliquer(choix[0]);
    expect(conteneur.querySelector('[aria-label="La finale"] button[aria-pressed="true"]')?.textContent).toBe('Traîneau');
    expect(conteneur.querySelector('header')?.textContent).toContain('Traîneau : pousser, puis tirer');
    // Le poids : facultatif, la dernière fois en indice, sans la noter.
    const case_ = conteneur.querySelector<HTMLInputElement>('input[aria-label="Poids de la finale, Big Max (lb)"]');
    expect(case_?.value).toBe('');
    expect(case_?.placeholder).toBe('180');
    expect(texte()).toContain('La dernière fois : Big Max 180 lb');
    saisir('Poids de la finale, Big Max (lb)', '190');
    expect(derniere()?.finale).toBe('traineau');
    expect(derniere()?.poidsAutre?.traineau).toEqual([190]);
  });

  it('« Démarrer » lance les dix minutes ; « Pause » les arrête ; à la fin, la cloche, la vibration, puis les étirements — et la finale compte, avec son poids', () => {
    lancer({ progression: avantLaFinale });
    avancer(700);
    cliquer(conteneur.querySelector('[aria-label="La finale"] button'));
    saisir('Poids de la finale, Big Max (lb)', '190');
    sons.cloches = [];
    cliquer(bouton('Démarrer'));
    expect(sons.cloches).toEqual(['start']);
    expect(texte()).toContain('10:00');
    // L'écran se rafraîchit toutes les 80 ms et arrondit au-dessus.
    avancer(30_100);
    expect(texte()).toContain('9:30');
    // « Pause » : le chrono s'arrête, « Reprendre » le relance.
    cliquer(bouton('Pause'));
    expect(texte()).toContain('En pause');
    avancer(60_000);
    expect(texte()).toContain('9:30');
    cliquer(bouton('Reprendre'));
    avancer(500_000);
    expect(phase()).toBe('Finale');
    expect(sons.vibrations).toBe(0);
    // Les dix minutes écoulées : la cloche de fin, la vibration, les
    // étirements.
    avancer(70_000);
    expect(sons.cloches).toContain('end');
    expect(sons.vibrations).toBe(1);
    expect(phase()).toBe('Retour au calme');
    // Le compte rendu : la finale choisie, faite, avec le poids de Big Max.
    avancer(700);
    cliquer(bouton('Étirements finis'));
    avancer(700);
    cliquer(bouton('Enregistrer la séance'));
    const realisee = enregistrees.at(-1)!;
    expect(realisee.exercices.at(-1)).toMatchObject({ exerciceId: 'traineau', seriesPrevues: 1, seriesFaites: 1 });
    expect(realisee.partenaire?.exercices.at(-1)).toMatchObject({ exerciceId: 'traineau', seriesFaites: 1, poids: 190 });
  });

  it('dans la liste du programme : la finale entre le dernier exercice et les étirements, « Ensuite » après les pompes', () => {
    lancer();
    avancer(700);
    cliquer(bouton('Passer l’échauffement'));
    avancer(700);
    const lignes = [...conteneur.querySelectorAll('ol[aria-label="Le programme du jour"] > li')].map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(lignes.at(-2)).toBe('Finale · 10 min');
    expect(lignes.at(-1)).toBe('Étirements');
  });
});

describe('👎 « Pas aimé », facultatif, et l’accueil la fois suivante', () => {
  it('un petit bouton par personne à côté de « J’ai mal », un toucher pour basculer ; rien ne bloque « Exercice terminé »', () => {
    const vus: Pick<EntrainementState, 'pasAimes' | 'pasAimesAutre'>[] = [];
    lancer({ onPasAimes: (etat) => vus.push(etat) });
    avancer(700);
    cliquer(bouton('Passer l’échauffement'));
    avancer(700);
    const pouce = () => conteneur.querySelector('[aria-label="Big Max : pas aimé cet exercice"]');
    expect(pouce()?.getAttribute('aria-pressed')).toBe('false');
    expect(conteneur.querySelector('[aria-label="Speedy : pas aimé cet exercice"]')).not.toBeNull();
    // À côté de « J'ai mal », dans la même ligne.
    expect(pouce()?.parentElement?.querySelector('[aria-label="Big Max : j’ai mal à cet exercice"]')).not.toBeNull();
    cliquer(pouce());
    expect(pouce()?.getAttribute('aria-pressed')).toBe('true');
    expect(vus.at(-1)).toEqual({ pasAimesAutre: { 'bench-press': new Date(2026, 9, 13, 8).toISOString() } });
    // Un second toucher le retire.
    cliquer(pouce());
    expect(pouce()?.getAttribute('aria-pressed')).toBe('false');
    expect(vus.at(-1)?.pasAimesAutre).toBeUndefined();
    cliquer(pouce());
    // « Exercice terminé » ne demande rien de plus : les visages, comme avant.
    expect(texteBarre()).toContain('Choisis un visage : Speedy');
  });

  it('la fois suivante, l’accueil le dit sur l’exercice — « Pas aimé par Big Max · Changer ? » — et ouvre « Changer » ; « Garder » le retire', () => {
    // La séance : Big Max n'a pas aimé le développé couché.
    let pasAimes: Pick<EntrainementState, 'pasAimes' | 'pasAimesAutre'> = {};
    lancer({ onPasAimes: (etat) => (pasAimes = etat) });
    avancer(700);
    cliquer(bouton('Passer l’échauffement'));
    avancer(700);
    cliquer(conteneur.querySelector('[aria-label="Big Max : pas aimé cet exercice"]'));
    act(() => racine.unmount());
    // Le mardi d'après : l'accueil, sur le téléphone de Speedy, à deux.
    vi.setSystemTime(new Date(2026, 9, 20, 7, 0, 0));
    racine = createRoot(conteneur);
    const programme = genererProgramme({ graine: 1, aujourdhui: new Date(2026, 9, 12) });
    let etat: EntrainementState = { ...ETAT_PAR_DEFAUT, programme, personne: 'sebastien', aDeux: true, ...pasAimes };
    const rendre = () =>
      act(() => {
        racine.render(
          <Accueil
            etat={etat}
            programme={programme}
            onChange={(miseAJour) => {
              etat = miseAJour(etat);
              rendre();
            }}
            programmeRecu={null}
            onReponseProgrammeRecu={() => {}}
            onOuvrir={() => {}}
          />,
        );
      });
    rendre();
    const bandeau = () => conteneur.querySelector('[role="note"]');
    expect(conteneur.querySelector('h2')?.textContent).toBe('Mardi B — le haut');
    expect(bandeau()?.textContent?.replace(/\s+/g, ' ')).toBe('👎 Pas aimé par Big MaxChanger ?Garder');
    expect(bandeau()?.closest('li')?.textContent).toContain('Développé couché avec haltères');
    // Un seul : les autres exercices n'en ont pas.
    expect(conteneur.querySelectorAll('[role="note"]')).toHaveLength(1);
    // « Changer ? » ouvre le « Changer » de cet exercice.
    cliquer(bandeau()?.querySelector('button'));
    expect(document.body.textContent).toContain('Changer d’exercice');
    expect(document.body.textContent).toContain('À la place de Développé couché avec haltères');
    cliquer(bouton('Terminé'));
    // « Garder » : le 👎 s'en va, et le bandeau avec.
    cliquer(bouton('Garder'));
    expect(etat.pasAimesAutre).toBeUndefined();
    expect(bandeau()).toBeNull();
  });
});

describe('l’image d’un exercice, en grand, pendant la séance', () => {
  it('toucher l’image de l’exercice en cours l’ouvre en grand, avec ses consignes ; la séance continue derrière', () => {
    lancer();
    avancer(700);
    cliquer(bouton('Passer l’échauffement'));
    avancer(700);
    expect(phase()).toBe('Exercice');
    const image = conteneur.querySelector('button[aria-label="Voir Développé couché avec haltères en grand"]');
    expect(image?.querySelector('img')?.getAttribute('src')).toContain('bench-press.png');
    cliquer(image);
    const enGrand = document.querySelector('[role="dialog"][aria-label="Développé couché avec haltères"]');
    expect(enGrand).not.toBeNull();
    expect(enGrand?.querySelector('img')?.getAttribute('src')).toContain('bench-press.png');
    expect(enGrand?.textContent).toContain(EXERCICES_PAR_ID['bench-press'].position);
    // Derrière, la séance n'a pas bougé.
    expect(phase()).toBe('Exercice');
    cliquer([...(enGrand?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Fermer'));
    expect(document.querySelector('[role="dialog"][aria-label="Développé couché avec haltères"]')).toBeNull();
    // Les petites images de la liste aussi : l'exercice qui vient.
    cliquer(conteneur.querySelector('button[aria-label="Voir Curl alterné en grand"]'));
    expect(document.querySelector('[role="dialog"][aria-label="Curl alterné"]')).not.toBeNull();
  });
});
