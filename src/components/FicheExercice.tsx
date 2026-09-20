import { useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Exercice } from '../types';
import { cheminImage, NOM_ZONE } from '../data/exercices';

interface FicheExerciceProps {
  exercice: Exercice;
  /** 'petite' (défaut) : vignette ~112 px à côté du texte. 'grande' : pleine largeur, texte dessous. */
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
      <div
        className={`shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white ${
          taille === 'petite' ? 'w-28' : 'w-full'
        }`}
      >
        {erreurImage ? (
          <div className="flex aspect-[200/138] w-full items-center justify-center bg-gray-100 px-1 text-center text-xs text-gray-500">
            {NOM_ZONE[exercice.zone]}
          </div>
        ) : (
          <img
            src={cheminImage(exercice.id)}
            alt={exercice.nomFr}
            loading="lazy"
            onError={() => setErreurImage(true)}
            className="w-full h-auto object-contain bg-white"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-800 leading-snug">{exercice.nomFr}</p>
        {afficherNomEn && <p className="text-xs text-gray-500">{exercice.nomEn}</p>}
        {children}
      </div>
    </div>
  );
}
