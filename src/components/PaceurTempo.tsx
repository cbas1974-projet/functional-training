import { useEffect, useRef } from 'react';
import type { FormeMouvement } from '../types';
import { positionBille } from '../utils/etapesSeance';
import type { PhaseTempo } from '../utils/etapesSeance';

/** Ce que le paceur lit à chaque image pour placer la bille. `progression`
 *  va de 0 au début de la phase à 1 à sa fin. `inverse` : un cercle parcouru
 *  dans l'autre sens, après le changement de sens à mi-série. */
export interface LectureTempo {
  phase: PhaseTempo;
  progression: number;
  inverse?: boolean;
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
  /** La forme du mouvement : un rail debout (on monte, on descend), un
   *  cercle dont la bille fait le tour sans s'arrêter, ou un rail couché où
   *  elle va à droite puis à gauche. */
  forme?: FormeMouvement;
  hauteurPx?: number;
}

const DIAMETRE = 76;
/** La bille d'un cercle, plus petite : elle tourne autour du centre. */
const DIAMETRE_TOUR = 56;
/** La longueur du rail couché d'un va-et-vient. */
const LARGEUR_VA_ET_VIENT = 280;

/** Une bille qui monte et descend au rythme du tempo, sur un rail vertical —
 *  ou qui fait le tour d'un cercle, ou va d'un côté à l'autre, selon la forme
 *  du mouvement. Elle se suit du coin de l'œil, sans rien lire : c'est
 *  l'intérêt quand on est sous la charge. L'animation est pilotée par
 *  l'horloge de la séance, donc elle reste synchrone avec les bips, y compris
 *  après une pause. */
export default function PaceurTempo({
  lire,
  resteSec,
  phase,
  avecChiffre,
  pauseEnHaut = false,
  forme = 'vertical',
  hauteurPx = 300,
}: PaceurTempoProps) {
  const billeRef = useRef<HTMLDivElement>(null);
  const diametre = forme === 'circulaire' ? DIAMETRE_TOUR : DIAMETRE;
  const course = forme === 'rotation' ? LARGEUR_VA_ET_VIENT - DIAMETRE : hauteurPx - diametre;

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
        if (forme === 'circulaire') {
          // Le tour part d'en haut, dans le sens des aiguilles d'une montre,
          // puis dans l'autre sens après le changement de sens.
          const angle = fraction * 2 * Math.PI * (lecture.inverse ? -1 : 1);
          const rayon = course / 2;
          const x = rayon * Math.sin(angle);
          const y = rayon * (1 - Math.cos(angle));
          bille.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
        } else if (forme === 'rotation') {
          // À droite pendant la montée, à gauche pendant la descente.
          bille.style.transform = `translateX(${((1 - fraction) * course).toFixed(2)}px)`;
        } else {
          bille.style.transform = `translateY(${(fraction * course).toFixed(2)}px)`;
        }
      }
      image = requestAnimationFrame(placer);
    };
    image = requestAnimationFrame(placer);
    return () => cancelAnimationFrame(image);
  }, [lire, course, pauseEnHaut, forme]);

  const couleur =
    phase === 'monte' || phase === 'tourne' ? 'var(--montee)' : phase === 'pause' ? 'var(--tenue)' : 'var(--descente)';
  const chiffre = avecChiffre && (
    <span className="chiffres text-3xl font-extrabold" style={{ color: 'var(--fond)' }}>
      {Math.max(0, Math.ceil(resteSec))}
    </span>
  );
  const styleBille = (taille: number) => ({
    width: taille,
    height: taille,
    background: couleur,
    boxShadow: `0 0 28px ${couleur}66`,
    willChange: 'transform',
  });

  if (forme === 'circulaire') {
    return (
      <div aria-hidden="true" style={{ height: hauteurPx, width: hauteurPx }} className="relative mx-auto">
        <div
          className="absolute rounded-full"
          style={{ inset: DIAMETRE_TOUR / 2 - 6, border: '12px solid var(--surface-haute)' }}
        />
        <div
          ref={billeRef}
          className="absolute top-0 flex items-center justify-center rounded-full"
          style={{ ...styleBille(DIAMETRE_TOUR), left: (hauteurPx - DIAMETRE_TOUR) / 2 }}
        >
          {chiffre}
        </div>
      </div>
    );
  }

  if (forme === 'rotation') {
    return (
      <div aria-hidden="true" style={{ height: DIAMETRE + 16, width: LARGEUR_VA_ET_VIENT }} className="relative mx-auto">
        <div
          className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
          style={{ background: 'var(--surface-haute)' }}
        />
        <div
          className="absolute left-0 top-1/2 h-10 w-1.5 -translate-y-1/2 rounded-full opacity-50"
          style={{ background: 'var(--descente)' }}
        />
        <div
          className="absolute right-0 top-1/2 h-10 w-1.5 -translate-y-1/2 rounded-full opacity-50"
          style={{ background: 'var(--montee)' }}
        />
        <div
          ref={billeRef}
          className="absolute left-0 top-2 flex items-center justify-center rounded-full"
          style={styleBille(DIAMETRE)}
        >
          {chiffre}
        </div>
      </div>
    );
  }

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
        style={{ ...styleBille(DIAMETRE), marginLeft: -DIAMETRE / 2 }}
      >
        {chiffre}
      </div>
    </div>
  );
}
