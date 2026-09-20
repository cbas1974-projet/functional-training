// Moteur de temps de la séance guidée : quelle étape est en cours, depuis
// quand, en pause ou non, et combien de temps a réellement été passé dans
// chaque étape quittée. Tout repose sur des instants `Date.now()` passés dans
// les actions (et non sur un décrément par tick) : un onglet mobile en
// arrière-plan ralentit les minuteurs, pas l'horloge.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

/** Pas de rafraîchissement de l'affichage, en millisecondes. */
const PAS_HORLOGE_MS = 80;

export interface EtatMoteur {
  /** Index de l'étape courante. */
  index: number;
  /** Numéro de visite d'étape, incrémenté à chaque changement d'étape : sert
   *  de clé pour ne déclencher qu'une fois les événements liés à une étape
   *  (sons, passage automatique, sauvegarde). */
  visite: number;
  /** Instant où l'étape courante a commencé, décalé à chaque reprise de pause
   *  pour que le temps de pause ne compte pas. */
  debutEtapeMs: number;
  enPause: boolean;
  /** Instant du début de la pause en cours (0 hors pause). */
  pauseDepuisMs: number;
  /** Secondes ajoutées à l'étape courante (« +15 s »). */
  prolongationSec: number;
  /** Temps réellement passé dans chaque étape quittée, cumulé si l'étape a
   *  été revisitée. Jamais de trou : les étapes sautées valent 0. */
  tempsParEtapeSec: number[];
}

export type ActionMoteur =
  | { type: 'demarrer'; now: number; index: number; tempsParEtapeSec: number[] }
  | { type: 'allerA'; now: number; index: number }
  | { type: 'pause'; now: number }
  | { type: 'reprendre'; now: number }
  | { type: 'prolonger'; sec: number };

/** Millisecondes écoulées dans l'étape courante, pauses exclues. */
function ecouleEtapeMs(etat: EtatMoteur, now: number): number {
  const fin = etat.enPause ? etat.pauseDepuisMs : now;
  return Math.max(0, fin - etat.debutEtapeMs);
}

/** Copie du tableau des temps avec `ajoutSec` de plus à l'index donné, en
 *  comblant par des zéros pour ne jamais laisser de trou. */
export function ajouterTemps(temps: number[], index: number, ajoutSec: number): number[] {
  const copie = temps.map((t) => (Number.isFinite(t) ? t : 0));
  while (copie.length <= index) copie.push(0);
  copie[index] += ajoutSec;
  return copie;
}

/** Réducteur pur du moteur : les instants viennent des actions, jamais de
 *  l'horloge, ce qui le rend testable. */
export function reducteurMoteur(etat: EtatMoteur | null, action: ActionMoteur): EtatMoteur | null {
  switch (action.type) {
    case 'demarrer':
      return {
        index: action.index,
        visite: 1,
        debutEtapeMs: action.now,
        enPause: false,
        pauseDepuisMs: 0,
        prolongationSec: 0,
        tempsParEtapeSec: action.tempsParEtapeSec.map((t) => (Number.isFinite(t) ? t : 0)),
      };
    case 'allerA': {
      // Rien à faire vers l'étape courante (clic simultané à une fin d'étape).
      if (!etat || action.index === etat.index) return etat;
      return {
        ...etat,
        index: action.index,
        visite: etat.visite + 1,
        debutEtapeMs: action.now,
        // En pause, la nouvelle étape attend la reprise à zéro seconde.
        pauseDepuisMs: etat.enPause ? action.now : 0,
        prolongationSec: 0,
        tempsParEtapeSec: ajouterTemps(
          etat.tempsParEtapeSec,
          etat.index,
          ecouleEtapeMs(etat, action.now) / 1000,
        ),
      };
    }
    case 'pause':
      if (!etat || etat.enPause) return etat;
      return { ...etat, enPause: true, pauseDepuisMs: action.now };
    case 'reprendre':
      if (!etat || !etat.enPause) return etat;
      return {
        ...etat,
        enPause: false,
        debutEtapeMs: etat.debutEtapeMs + (action.now - etat.pauseDepuisMs),
        pauseDepuisMs: 0,
      };
    case 'prolonger':
      if (!etat) return etat;
      return { ...etat, prolongationSec: etat.prolongationSec + action.sec };
  }
}

export interface MoteurEtapes {
  /** null tant que la séance n'a pas été démarrée. */
  etat: EtatMoteur | null;
  /** Dernier instant connu (rafraîchi toutes les 200 ms quand le chrono tourne). */
  maintenant: number;
  /** Secondes écoulées dans l'étape courante, pauses exclues. Rafraîchi
   *  cinq fois par seconde : suffisant pour un affichage, trop grossier pour
   *  une animation. */
  ecouleSec: number;
  /** Lecture instantanée de l'horloge, sans passer par un rendu React : à
   *  utiliser dans une boucle d'animation (la bille du tempo). */
  lireEcouleSec: () => number;
  /** Démarre (ou reprend) la séance à l'étape `index`, avec les temps déjà
   *  crédités aux étapes lors d'une reprise. */
  demarrer: (index: number, tempsParEtapeSec: number[]) => void;
  /** Change d'étape en créditant le temps passé à l'étape quittée. `now`
   *  permet de dater précisément une fin d'étape automatique. */
  allerA: (index: number, now?: number) => void;
  pause: () => void;
  reprendre: () => void;
  prolonger: (sec: number) => void;
}

/** @param nbEtapes nombre d'étapes ; la dernière est l'étape finale, sur
 *  laquelle plus rien n'est chronométré. */
export function useMoteurEtapes(nbEtapes: number): MoteurEtapes {
  const [etat, dispatch] = useReducer(reducteurMoteur, null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const enMarche = etat !== null && !etat.enPause && etat.index < nbEtapes - 1;

  // Un simple rafraîchissement périodique : le temps écoulé se déduit de
  // l'horloge, jamais du nombre de ticks. Le pas fixe le retard maximal entre
  // le demi-tour de la bille, qui suit l'horloge à chaque image, et le bip,
  // déclenché par un rendu : 80 ms passent inaperçus, 200 ms s'entendaient.
  useEffect(() => {
    if (!enMarche) return;
    const intervalle = window.setInterval(() => setMaintenant(Date.now()), PAS_HORLOGE_MS);
    return () => window.clearInterval(intervalle);
  }, [enMarche]);

  const borner = useCallback(
    (index: number) => Math.max(0, Math.min(index, Math.max(0, nbEtapes - 1))),
    [nbEtapes],
  );

  // L'index de départ est fourni déjà valide par l'appelant (il peut viser
  // les étapes d'une séance reprise, pas encore reflétées dans nbEtapes).
  const demarrer = useCallback((index: number, tempsParEtapeSec: number[]) => {
    const now = Date.now();
    setMaintenant(now);
    dispatch({ type: 'demarrer', now, index: Math.max(0, index), tempsParEtapeSec });
  }, []);

  const allerA = useCallback(
    (index: number, now: number = Date.now()) => {
      setMaintenant(Math.max(now, Date.now()));
      dispatch({ type: 'allerA', now, index: borner(index) });
    },
    [borner],
  );

  const pause = useCallback(() => {
    const now = Date.now();
    setMaintenant(now);
    dispatch({ type: 'pause', now });
  }, []);

  const reprendre = useCallback(() => {
    const now = Date.now();
    setMaintenant(now);
    dispatch({ type: 'reprendre', now });
  }, []);

  const prolonger = useCallback((sec: number) => dispatch({ type: 'prolonger', sec }), []);

  const ecouleSec = etat ? ecouleEtapeMs(etat, maintenant) / 1000 : 0;

  // L'état courant dans une ref : la boucle d'animation le lit sans dépendre
  // du rythme des rendus.
  const etatRef = useRef(etat);
  etatRef.current = etat;
  const lireEcouleSec = useCallback(
    () => (etatRef.current ? ecouleEtapeMs(etatRef.current, Date.now()) / 1000 : 0),
    [],
  );

  return {
    etat,
    maintenant,
    ecouleSec,
    lireEcouleSec,
    demarrer,
    allerA,
    pause,
    reprendre,
    prolonger,
  };
}
