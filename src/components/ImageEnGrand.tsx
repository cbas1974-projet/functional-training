// Une image du poster en grand, avec les consignes : pour voir le détail du
// mouvement avant de commencer. Se ferme d'un toucher hors de la fiche, sur
// « Fermer » ou avec Échap.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Exercice } from '../types';
import { NOM_MUSCLE, cheminImage } from '../data/exercices';

interface ImageEnGrandProps {
  exercice: Exercice;
  onFermer: () => void;
}

export default function ImageEnGrand({ exercice, onFermer }: ImageEnGrandProps) {
  useEffect(() => {
    const surEchap = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', surEchap);
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', surEchap);
      document.body.style.overflow = overflowPrecedent;
    };
  }, [onFermer]);

  const muscles = (exercice.musclesPrincipaux ?? []).map((muscle) => NOM_MUSCLE[muscle]).join(', ');

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={exercice.nomFr}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onFermer}
    >
      <div
        className="mx-auto w-full max-w-3xl p-4"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        onClick={(evenement) => evenement.stopPropagation()}
      >
        {/* Dessin noir sur blanc : toujours sur sa plaque blanche. */}
        <img
          src={cheminImage(exercice.id)}
          alt={exercice.nomFr}
          className="w-full"
          style={{ background: '#ffffff', borderRadius: 14, objectFit: 'contain' }}
        />
        <div className="mt-3 rounded-2xl p-4" style={{ background: 'var(--surface)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--texte)' }}>
            {exercice.nomFr}
          </h2>
          {muscles && (
            <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
              {muscles}
            </p>
          )}
          <p className="mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
            {exercice.position}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: 'var(--texte)' }}>
            {exercice.pointsAttention.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="mt-3 w-full rounded-xl px-4 font-semibold"
          style={{
            minHeight: 48,
            background: 'var(--surface)',
            border: '1px solid var(--bordure)',
            color: 'var(--texte)',
          }}
        >
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  );
}
