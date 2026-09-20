import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { Exercice } from '../types';
import { CHEMIN_POSTER, EXERCICES, ZONES } from '../data/exercices';
import { libelleNiveauMin } from '../utils/formatage';
import FicheExercice from './FicheExercice';

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {children}
    </span>
  );
}

export default function BibliothequeExercices() {
  const [ouvert, setOuvert] = useState(false);
  const [exerciceOuvertId, setExerciceOuvertId] = useState<string | null>(null);
  const [posterOuvert, setPosterOuvert] = useState(false);

  useEffect(() => {
    if (!posterOuvert) return;
    const surEchap = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setPosterOuvert(false);
    };
    window.addEventListener('keydown', surEchap);
    return () => window.removeEventListener('keydown', surEchap);
  }, [posterOuvert]);

  // Bloque le défilement de la page pendant que la modale est ouverte (évite
  // aussi un défaut d'affichage du fond assombri sur une bibliothèque très
  // longue défilée loin du haut) et restaure la position à la fermeture.
  useEffect(() => {
    if (!posterOuvert) return;
    const positionPrecedente = window.scrollY;
    const overflowPrecedent = document.body.style.overflow;
    window.scrollTo({ top: 0 });
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowPrecedent;
      window.scrollTo({ top: positionPrecedente });
    };
  }, [posterOuvert]);

  const basculerExercice = (id: string) => {
    setExerciceOuvertId((precedent) => (precedent === id ? null : id));
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">Bibliothèque des exercices</h2>
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          className="rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200"
        >
          {ouvert ? 'Masquer la bibliothèque' : `Voir la bibliothèque des ${EXERCICES.length} exercices`}
        </button>
      </div>

      {ouvert && (
        <div className="mt-4 space-y-6">
          {ZONES.map((zone) => {
            const exercicesZone = EXERCICES.filter((e) => e.zone === zone.id);
            const exerciceOuvert: Exercice | undefined = exercicesZone.find(
              (e) => e.id === exerciceOuvertId
            );

            return (
              <div key={zone.id}>
                <h3 className="mb-3 text-lg font-semibold text-gray-800">{zone.nom}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {exercicesZone.map((exercice) => (
                    <FicheExercice
                      key={exercice.id}
                      exercice={exercice}
                      taille="grande"
                      onClick={() => basculerExercice(exercice.id)}
                    >
                      <div className="mt-1 flex flex-wrap gap-1">
                        {exercice.materiel !== 'halteres' && (
                          <Badge>{exercice.materiel === 'banc' ? 'banc' : 'marche'}</Badge>
                        )}
                        {exercice.explosif && <Badge>explosif</Badge>}
                        <Badge>{libelleNiveauMin(exercice.niveauMin)}</Badge>
                      </div>
                    </FicheExercice>
                  ))}
                </div>

                {exerciceOuvert && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-gray-800">{exerciceOuvert.nomFr}</h4>
                      <button
                        type="button"
                        onClick={() => setExerciceOuvertId(null)}
                        className="shrink-0 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Fermer
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">Position : </span>
                      {exerciceOuvert.position}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">Muscles : </span>
                      {exerciceOuvert.muscles}
                    </p>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Points d'attention</p>
                      <ul className="ml-4 mt-1 list-disc space-y-0.5 text-sm text-gray-600">
                        {exerciceOuvert.pointsAttention.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                    {exerciceOuvert.interetJjb && (
                      <p className="mt-2 text-sm italic text-blue-700">
                        {exerciceOuvert.interetJjb}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setPosterOuvert(true)}
            className="rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200"
          >
            Voir le poster complet
          </button>
        </div>
      )}

      {posterOuvert &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPosterOuvert(false)}
          >
            <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <img
                src={CHEMIN_POSTER}
                alt="Poster complet des 40 exercices"
                className="max-h-[80vh] w-full rounded-lg bg-white object-contain"
              />
              <button
                type="button"
                onClick={() => setPosterOuvert(false)}
                className="mt-3 w-full rounded-lg bg-white px-4 py-3 font-medium text-gray-800 hover:bg-gray-100"
              >
                Fermer
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
