// Le moteur de la séance guidée quand l'horloge est commune : l'étape et le
// temps écoulé se lisent dans l'état partagé, à l'heure du serveur, au lieu
// d'être comptés sur ce téléphone. Même forme que useMoteurEtapes : la séance
// guidée s'en sert de la même façon pour l'affichage, les sons et la
// sauvegarde ; les boutons, eux, passent par les décisions de l'horloge
// commune.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Etape } from '../utils/etapesSeance';
import { enPause as estEnPause } from '../utils/etatCommun';
import type { EtatCommun } from '../utils/etatCommun';
import { positionAffichee, tempsDesEtapesQuittees } from '../utils/horlogeCommune';
import type { Ecart, Position } from '../utils/horlogeCommune';
import { ajouterTemps } from './useMoteurEtapes';
import type { EtatMoteur, MoteurEtapes } from './useMoteurEtapes';

/** Pas de rafraîchissement, le même que le moteur local. */
const PAS_HORLOGE_MS = 80;

export interface MoteurCommun extends MoteurEtapes {
  /** Ce qu'affiche ce téléphone ; null avant le départ. */
  position: Position | null;
  setEcart: (ecart: Ecart | null) => void;
}

export function useMoteurCommun(
  etapes: Etape[],
  etat: EtatCommun | null,
  heure: () => number,
  actif: boolean,
): MoteurCommun {
  const [demarre, setDemarre] = useState(false);
  const [ecart, setEcart] = useState<Ecart | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const enMarche = actif && demarre && etat !== null;
  const enPause = etat !== null && estEnPause(etat);

  useEffect(() => {
    if (!enMarche || enPause) return;
    const intervalle = window.setInterval(() => setMaintenant(Date.now()), PAS_HORLOGE_MS);
    return () => window.clearInterval(intervalle);
  }, [enMarche, enPause]);

  const calcul = enMarche && etat ? positionAffichee(etapes, etat, heure(), ecart) : null;
  const position = calcul?.position ?? null;

  // Un écart tombe quand l'horloge commune le rattrape.
  const ecartTenu = calcul?.ecart ?? null;
  useEffect(() => {
    if (calcul && ecartTenu !== ecart) setEcart(ecartTenu);
  }, [calcul, ecartTenu, ecart]);

  // Visites et temps passé par étape, comptés à chaque changement d'étape —
  // même quand l'écran, resté éteint, en a sauté plusieurs.
  const [visite, setVisite] = useState(1);
  const [temps, setTemps] = useState<number[]>([]);
  const precedente = useRef<{ position: Position; a: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    const avant = precedente.current;
    const a = Date.now();
    precedente.current = { position, a };
    if (avant && avant.position.index !== position.index) {
      const quittees = tempsDesEtapesQuittees(etapes, avant.position, position, (a - avant.a) / 1000);
      setTemps((courants) => quittees.reduce((cumul, [index, sec]) => ajouterTemps(cumul, index, sec), courants));
      setVisite((v) => v + 1);
    }
  }, [position, etapes]);

  // La bille lit l'horloge à chaque image : elle part de la dernière position
  // et ajoute le temps passé depuis.
  const instantane = useRef({ ecouleSec: 0, a: 0, enPause: true });
  useEffect(() => {
    instantane.current = { ecouleSec: position?.ecouleSec ?? 0, a: performance.now(), enPause };
  }, [position, enPause]);
  const lireEcouleSec = useCallback(() => {
    const { ecouleSec, a, enPause: fige } = instantane.current;
    return fige ? ecouleSec : ecouleSec + (performance.now() - a) / 1000;
  }, []);

  const etatMoteur: EtatMoteur | null = position
    ? {
        index: position.index,
        visite,
        debutEtapeMs: maintenant - position.ecouleSec * 1000,
        enPause,
        pauseDepuisMs: enPause ? maintenant : 0,
        prolongationSec: 0,
        tempsParEtapeSec: temps,
      }
    : null;

  // À la reprise, les temps déjà passés reviennent ; l'étape, elle, se lit
  // sur l'horloge commune.
  const demarrer = useCallback((_index: number, tempsParEtapeSec: number[]) => {
    setTemps(tempsParEtapeSec);
    setDemarre(true);
  }, []);
  const rien = useCallback(() => {}, []);

  return {
    etat: etatMoteur,
    maintenant,
    ecouleSec: position?.ecouleSec ?? 0,
    lireEcouleSec,
    demarrer,
    allerA: rien,
    pause: rien,
    reprendre: rien,
    prolonger: rien,
    position,
    setEcart,
  };
}
