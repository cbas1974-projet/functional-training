import { useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Exercice } from '../types';
import { cheminImage, NOM_ZONE } from '../data/exercices';

interface FicheExerciceProps {
  exercice: Exercice;
  /** 'petite' (défaut) : vignette ~96 px à côté du texte. 'grande' : pleine largeur, texte dessous. */
  taille?: 'petite' | 'grande';
  afficherNomEn?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export default function FicheExercice({
  exercice,
  taille = 'petite',
  afficherNomEn = false,
  onClick,
  children,
}: FicheExerciceProps) {
  const [erreurImage, setErreurImage] = useState(false);
  const interactif = Boolean(onClick);

  const gererTouche = (evenement: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={interactif ? gererTouche : undefined}
      role={interactif ? 'button' : undefined}
      tabIndex={interactif ? 0 : undefined}
      className={`w-full text-left ${
        taille === 'petite' ? 'flex items-start gap-3' : 'flex flex-col gap-2'
      } ${interactif ? 'cursor-pointer' : ''}`}
    >
      {/* Les dessins sont noirs sur fond blanc : en mode sombre ils ne sont
          lisibles que posés sur une plaque blanche, jamais à même le fond. */}
      <div
        className={`shrink-0 overflow-hidden p-1 ${taille === 'petite' ? 'w-24' : 'w-full'}`}
        style={{
          background: erreurImage ? 'var(--surface-haute)' : '#ffffff',
          border: '1px solid var(--bordure)',
          borderRadius: 12,
        }}
      >
        {erreurImage ? (
          <div
            className="flex aspect-[200/138] w-full items-center justify-center px-1 text-center text-xs"
            style={{ color: 'var(--texte-discret)' }}
          >
            {NOM_ZONE[exercice.zone]}
          </div>
        ) : (
          <img
            src={cheminImage(exercice.id)}
            alt={exercice.nomFr}
            loading="lazy"
            onError={() => setErreurImage(true)}
            className="h-auto w-full"
            style={{ objectFit: 'contain', background: '#ffffff', borderRadius: 8 }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug" style={{ color: 'var(--texte)' }}>
          {exercice.nomFr}
        </p>
        {afficherNomEn && (
          <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
            {exercice.nomEn}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
