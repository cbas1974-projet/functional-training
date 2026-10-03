// Les briques des réglages : la feuille qui monte du bas de l'écran, et les
// boutons qu'on y pose. Partagées par l'accueil et la séance libre.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/** Hauteur minimale d'une cible tactile, en pixels (doigt sur un téléphone). */
export const CIBLE = 44;

/** Pastille de réglage : sélectionnée en accent, sinon en surface haute. */
export function Pastille({
  selectionne,
  onClick,
  children,
}: {
  selectionne: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selectionne}
      className="rounded-xl px-4 text-sm font-semibold"
      style={{
        minHeight: CIBLE,
        background: selectionne ? 'var(--accent)' : 'var(--surface-haute)',
        color: selectionne ? 'var(--accent-texte)' : 'var(--texte)',
        border: `1px solid ${selectionne ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      {children}
    </button>
  );
}

/** Choix pleine largeur avec une explication : tempo, guide visuel. */
export function Choix({
  selectionne,
  onClick,
  nom,
  description,
}: {
  selectionne: boolean;
  onClick: () => void;
  nom: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selectionne}
      className="w-full rounded-xl px-4 py-2 text-left"
      style={{
        minHeight: CIBLE,
        background: selectionne ? 'var(--accent)' : 'var(--surface-haute)',
        color: selectionne ? 'var(--accent-texte)' : 'var(--texte)',
        border: `1px solid ${selectionne ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      <span className="block text-sm font-semibold">{nom}</span>
      <span
        className="block text-xs"
        style={selectionne ? { opacity: 0.85 } : { color: 'var(--texte-discret)' }}
      >
        {description}
      </span>
    </button>
  );
}

/** Interrupteur pleine largeur : matériel possédé, objectif retenu. */
export function Bascule({
  actif,
  onClick,
  nom,
  precision,
}: {
  actif: boolean;
  onClick: () => void;
  nom: string;
  precision?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left"
      style={{
        minHeight: CIBLE,
        background: 'var(--surface-haute)',
        color: 'var(--texte)',
        border: `1px solid ${actif ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center text-xs font-bold"
        style={{
          borderRadius: 7,
          background: actif ? 'var(--accent)' : 'transparent',
          color: 'var(--accent-texte)',
          border: `1px solid ${actif ? 'var(--accent)' : 'var(--bordure)'}`,
        }}
      >
        {actif ? '✓' : ''}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{nom}</span>
        {precision && (
          <span className="block text-xs" style={{ color: 'var(--texte-discret)' }}>
            {precision}
          </span>
        )}
      </span>
    </button>
  );
}

/** Bloc de réglage : un titre, des pastilles, une explication. */
export function Groupe({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold" style={{ color: 'var(--texte)' }}>
        {titre}
      </p>
      {children}
      {aide && (
        <p className="mt-2 text-xs" style={{ color: 'var(--texte-discret)' }}>
          {aide}
        </p>
      )}
    </div>
  );
}

/** Feuille qui monte du bas de l'écran. Elle se ferme avec Échap, d'un appui
 *  hors d'elle ou sur « Terminé », et bloque le défilement de la page
 *  derrière elle le temps d'être ouverte. */
export function Feuille({
  titre,
  onFermer,
  children,
}: {
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-end"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onFermer}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="w-full max-w-3xl overflow-y-auto"
        style={{
          maxHeight: '88vh',
          background: 'var(--surface)',
          borderTop: '1px solid var(--bordure)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        }}
        onClick={(evenement) => evenement.stopPropagation()}
      >
        <div className="sticky top-0 z-10 px-4 pb-3 pt-2" style={{ background: 'var(--surface)' }}>
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1.5 w-10 rounded-full"
            style={{ background: 'var(--texte-discret)', opacity: 0.5 }}
          />
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 text-lg font-bold" style={{ color: 'var(--texte)' }}>
              {titre}
            </h2>
            <button
              type="button"
              onClick={onFermer}
              className="shrink-0 rounded-xl px-5 text-sm font-bold"
              style={{ minHeight: CIBLE, background: 'var(--accent)', color: 'var(--accent-texte)' }}
            >
              Terminé
            </button>
          </div>
        </div>
        <div className="space-y-5 px-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
