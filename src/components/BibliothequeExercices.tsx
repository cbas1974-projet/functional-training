import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { Exercice, SeanceRealisee, UnitePoids } from '../types';
import { CHEMIN_POSTER, EXERCICES, NOM_MATERIEL, NOM_PATTERN, ZONES } from '../data/exercices';
import { formaterDateFr, libelleNiveauMin } from '../utils/formatage';
import { SUFFIXE_UNITE, frequencesParExercice } from '../utils/statistiques';
import type { FrequenceExercice } from '../utils/statistiques';
import FicheExercice from './FicheExercice';

interface BibliothequeExercicesProps {
  /** Séances enregistrées : elles donnent la fréquence de chaque exercice. */
  historique: SeanceRealisee[];
  /** Unité dans laquelle ramener les charges de l'historique. */
  unitePoids: UnitePoids;
}

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

/** Ce que l'exercice a donné jusqu'ici : combien de fois, quand, avec quoi.
 *  C'est ce qui permet de voir d'un coup d'œil ce qu'on néglige. */
function Frequence({ frequence }: { frequence: FrequenceExercice | undefined }) {
  if (!frequence || frequence.total === 0) {
    return (
      <p className="mt-2 text-sm" style={{ color: 'var(--texte-discret)' }}>
        Jamais fait depuis que l’historique existe.
      </p>
    );
  }
  const cellule = (valeur: number, libelle: string) => (
    <div key={libelle} className="text-center">
      <p className="chiffres text-lg font-bold leading-tight" style={{ color: 'var(--texte)' }}>
        {valeur}
      </p>
      <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
        {libelle}
      </p>
    </div>
  );
  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-2">
        {cellule(frequence.parFenetre[30], '1 mois')}
        {cellule(frequence.parFenetre[90], '3 mois')}
        {cellule(frequence.parFenetre[180], '6 mois')}
        {cellule(frequence.total, 'en tout')}
      </div>
      <p className="mt-2 text-sm" style={{ color: 'var(--texte-discret)' }}>
        Dernière fois{' '}
        <span className="chiffres">
          {frequence.derniereDate ? formaterDateFr(frequence.derniereDate) : '—'}
        </span>
        {typeof frequence.dernierPoids === 'number' && (
          <>
            {' · '}
            <span className="chiffres">
              {frequence.dernierPoids} {SUFFIXE_UNITE[frequence.unite]}
            </span>
          </>
        )}
        {typeof frequence.poidsMax === 'number' &&
          frequence.poidsMax !== frequence.dernierPoids && (
            <>
              {' · record '}
              <span className="chiffres">
                {frequence.poidsMax} {SUFFIXE_UNITE[frequence.unite]}
              </span>
            </>
          )}
      </p>
    </div>
  );
}

export default function BibliothequeExercices({
  historique,
  unitePoids,
}: BibliothequeExercicesProps) {
  const [exerciceOuvertId, setExerciceOuvertId] = useState<string | null>(null);
  const [posterOuvert, setPosterOuvert] = useState(false);
  const frequences = useMemo(
    () => frequencesParExercice(historique, unitePoids),
    [historique, unitePoids],
  );

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
                      {(frequences.get(exercice.id)?.parFenetre[30] ?? 0) > 0 && (
                        <Badge>{frequences.get(exercice.id)?.parFenetre[30]}× ce mois-ci</Badge>
                      )}
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
                  <Frequence frequence={frequences.get(exerciceOuvert.id)} />
                  <p className="mt-2 text-sm" style={{ color: 'var(--texte-discret)' }}>
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
