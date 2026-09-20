import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { Exercice } from '../types';
import { CHEMIN_POSTER, EXERCICES, NOM_MATERIEL, NOM_PATTERN, ZONES } from '../data/exercices';
import { libelleNiveauMin } from '../utils/formatage';
import FicheExercice from './FicheExercice';

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: 'var(--surface-haute)', color: 'var(--texte-discret)' }}
    >
      {children}
    </span>
  );
}

export default function BibliothequeExercices() {
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

  // Bloque le défilement de la page pendant que la modale est ouverte et
  // restaure la position à la fermeture.
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
    <section
      className="p-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--bordure)',
        borderRadius: 16,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold" style={{ color: 'var(--texte)' }}>
          Bibliothèque
        </h2>
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          <span className="chiffres">{EXERCICES.length}</span> exercices
        </p>
      </div>

      <div className="mt-4 space-y-6">
        {ZONES.map((zone) => {
          const exercicesZone = EXERCICES.filter((e) => e.zone === zone.id);
          const exerciceOuvert: Exercice | undefined = exercicesZone.find(
            (e) => e.id === exerciceOuvertId
          );

          return (
            <div key={zone.id}>
              <h3 className="mb-3 text-base font-bold" style={{ color: 'var(--texte)' }}>
                {zone.nom}{' '}
                <span className="chiffres text-sm font-medium" style={{ color: 'var(--texte-discret)' }}>
                  {exercicesZone.length}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {exercicesZone.map((exercice) => (
                  <FicheExercice
                    key={exercice.id}
                    exercice={exercice}
                    taille="grande"
                    onClick={() => basculerExercice(exercice.id)}
                  >
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge>{NOM_PATTERN[exercice.pattern]}</Badge>
                      {exercice.materiel !== 'halteres' && (
                        <Badge>{NOM_MATERIEL[exercice.materiel]}</Badge>
                      )}
                      {exercice.explosif && <Badge>explosif</Badge>}
                      <Badge>{libelleNiveauMin(exercice.niveauMin)}</Badge>
                    </div>
                  </FicheExercice>
                ))}
              </div>

              {exerciceOuvert && (
                <div
                  className="mt-3 p-4"
                  style={{
                    background: 'var(--surface-haute)',
                    border: '1px solid var(--bordure)',
                    borderRadius: 14,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold" style={{ color: 'var(--texte)' }}>
                      {exerciceOuvert.nomFr}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setExerciceOuvertId(null)}
                      className="shrink-0 rounded-xl px-3 text-sm font-semibold"
                      style={{
                        minHeight: 44,
                        background: 'var(--surface)',
                        border: '1px solid var(--bordure)',
                        color: 'var(--texte)',
                      }}
                    >
                      Fermer
                    </button>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
                    <span className="font-semibold" style={{ color: 'var(--texte)' }}>
                      Position :{' '}
                    </span>
                    {exerciceOuvert.position}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
                    <span className="font-semibold" style={{ color: 'var(--texte)' }}>
                      Muscles :{' '}
                    </span>
                    {exerciceOuvert.muscles}
                  </p>
                  <div className="mt-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--texte)' }}>
                      Points d'attention
                    </p>
                    <ul
                      className="ml-4 mt-1 list-disc space-y-0.5 text-sm"
                      style={{ color: 'var(--texte-discret)' }}
                    >
                      {exerciceOuvert.pointsAttention.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  {exerciceOuvert.interetJjb && (
                    <p className="mt-2 text-sm italic" style={{ color: 'var(--accent)' }}>
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
          className="w-full rounded-xl px-4 text-sm font-semibold"
          style={{
            minHeight: 44,
            background: 'var(--surface-haute)',
            border: '1px solid var(--bordure)',
            color: 'var(--texte)',
          }}
        >
          Voir le poster complet
        </button>
      </div>

      {posterOuvert &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.8)' }}
            onClick={() => setPosterOuvert(false)}
          >
            <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <img
                src={CHEMIN_POSTER}
                alt="Poster complet des 40 exercices"
                className="max-h-[80vh] w-full"
                style={{ background: '#ffffff', borderRadius: 14, objectFit: 'contain' }}
              />
              <button
                type="button"
                onClick={() => setPosterOuvert(false)}
                className="mt-3 w-full rounded-xl px-4 font-semibold"
                style={{
                  minHeight: 44,
                  background: 'var(--surface)',
                  border: '1px solid var(--bordure)',
                  color: 'var(--texte)',
                }}
              >
                Fermer
              </button>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
