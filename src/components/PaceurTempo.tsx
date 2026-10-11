import { useEffect, useRef } from 'react';
import { positionBille } from '../utils/etapesSeance';
import type { PhaseTempo } from '../utils/etapesSeance';

/** Ce que le paceur lit à chaque image pour placer la bille. `progression`
 *  va de 0 au début de la phase à 1 à sa fin. */
export interface LectureTempo {
  phase: PhaseTempo;
  progression: number;
}

export interface PaceurTempoProps {
  /** Lecture instantanée du tempo, appelée à chaque image : elle doit être
   *  peu coûteuse et lire l'horloge, jamais un état React (qui ne se
   *  rafraîchit que cinq fois par seconde). */
  lire: () => LectureTempo | null;
  /** Secondes restantes dans la phase, affichées dans la bille. */
  resteSec: number;
  /** Phase courante, pour la couleur et le libellé (état React, donc au pas
   *  de rafraîchissement du composant parent). */
  phase: PhaseTempo;
  /** Inscrire le décompte dans la bille. */
  avecChiffre: boolean;
  /** L'exercice tient en haut (`pauseEnHaut`) : pendant la pause, la bille
   *  reste en haut du rail au lieu de se poser au pied. */
  pauseEnHaut?: boolean;
  hauteurPx?: number;
}

const DIAMETRE = 76;

/** Une bille qui monte et descend au rythme du tempo, sur un rail vertical.
 *  Elle se suit du coin de l'œil, sans rien lire : c'est l'intérêt quand on
 *  est sous la charge. L'animation est pilotée par l'horloge de la séance,
 *  donc elle reste synchrone avec les bips, y compris après une pause. */
export default function PaceurTempo({
  lire,
  resteSec,
  phase,
  avecChiffre,
  pauseEnHaut = false,
  hauteurPx = 300,
}: PaceurTempoProps) {
  const billeRef = useRef<HTMLDivElement>(null);
  const course = hauteurPx - DIAMETRE;

  useEffect(() => {
    // Mouvement réduit demandé : la bille reste utile, mais elle avance par
    // crans d'un dixième de rail plutôt qu'en glissant, ce qui supprime le
    // défilement continu sans supprimer le repère visuel.
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const crans = reduit ? 10 : 0;

    let image = 0;
    const placer = () => {
      const lecture = lire();
      const bille = billeRef.current;
      if (lecture && bille) {
        let p = Math.min(1, Math.max(0, lecture.progression));
        if (crans > 0) p = Math.round(p * crans) / crans;
        // Le haut du rail est la fin de la montée : on descend l'objet
        // d'autant plus que la montée commence. La pause se tient en bas,
        // là où la descente a laissé la bille — en haut, là où la montée l'a
        // laissée, aux exercices qui tiennent en haut. Un exercice sans arrêt
        // n'a pas de phase de pause (`tempoPourExercice`) : la bille repart
        // aussitôt, sans se poser au pied du rail.
        const fraction = positionBille(lecture.phase, p, pauseEnHaut);
        bille.style.transform = `translateY(${(fraction * course).toFixed(2)}px)`;
      }
      image = requestAnimationFrame(placer);
    };
    image = requestAnimationFrame(placer);
    return () => cancelAnimationFrame(image);
  }, [lire, course, pauseEnHaut]);

  const couleur =
    phase === 'monte' ? 'var(--montee)' : phase === 'pause' ? 'var(--tenue)' : 'var(--descente)';

  return (
    <div
      aria-hidden="true"
      style={{ height: hauteurPx, width: DIAMETRE + 16 }}
      className="relative mx-auto"
    >
      <div
        className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 rounded-full"
        style={{ background: 'var(--surface-haute)' }}
      />
      <div
        className="absolute left-1/2 top-0 h-1.5 w-10 -translate-x-1/2 rounded-full opacity-50"
        style={{ background: 'var(--montee)' }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full opacity-50"
        style={{ background: 'var(--descente)' }}
      />
      <div
        ref={billeRef}
        className="absolute left-1/2 top-0 flex items-center justify-center rounded-full"
        style={{
          width: DIAMETRE,
          height: DIAMETRE,
          marginLeft: -DIAMETRE / 2,
          background: couleur,
          boxShadow: `0 0 28px ${couleur}66`,
          willChange: 'transform',
        }}
      >
        {avecChiffre && (
          <span
            className="chiffres text-3xl font-extrabold"
            style={{ color: 'var(--fond)' }}
          >
            {Math.max(0, Math.ceil(resteSec))}
          </span>
        )}
      </div>
    </div>
  );
}
