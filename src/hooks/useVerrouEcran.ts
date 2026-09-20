// Empêche l'écran du téléphone de s'éteindre pendant la séance (API Screen
// Wake Lock). L'API peut être absente ou refuser : on continue sans elle.
import { useCallback, useEffect, useRef } from 'react';

/** Navigateur dont on ne présume pas qu'il connaît `wakeLock`. */
type NavigateurAvecVerrou = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

export interface VerrouEcran {
  /** À appeler dans un gestionnaire de clic (geste utilisateur). */
  demander: () => Promise<void>;
  liberer: () => void;
}

/** @param actif tant que c'est vrai, le verrou est redemandé quand la page
 *  redevient visible ; quand cela redevient faux (ou au démontage), il est
 *  libéré. */
export function useVerrouEcran(actif: boolean): VerrouEcran {
  const verrouRef = useRef<WakeLockSentinel | null>(null);
  const demonteRef = useRef(false);

  useEffect(() => {
    demonteRef.current = false;
    return () => {
      demonteRef.current = true;
    };
  }, []);

  const liberer = useCallback(() => {
    const verrou = verrouRef.current;
    verrouRef.current = null;
    if (verrou && !verrou.released) {
      verrou.release().catch(() => undefined);
    }
  }, []);

  const demander = useCallback(async () => {
    try {
      const { wakeLock } = navigator as NavigateurAvecVerrou;
      if (!wakeLock || document.visibilityState !== 'visible') return;
      if (verrouRef.current && !verrouRef.current.released) return;
      const verrou = await wakeLock.request('screen');
      // Le composant a pu être démonté pendant l'attente : ne rien garder.
      if (demonteRef.current) verrou.release().catch(() => undefined);
      else verrouRef.current = verrou;
    } catch {
      // API refusée (batterie faible, réglage système…) : rien à faire.
    }
  }, []);

  useEffect(() => {
    if (!actif) return;
    // Redemandé sans geste (retour depuis l'écran de fin, par exemple) : les
    // navigateurs l'acceptent tant que la page est visible.
    void demander();
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') void demander();
    };
    document.addEventListener('visibilitychange', surVisibilite);
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite);
      liberer();
    };
  }, [actif, demander, liberer]);

  return { demander, liberer };
}
