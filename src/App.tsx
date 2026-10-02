import { useEffect, useState } from 'react';
import type { EntrainementState } from './types';
import { chargerEtat, enregistrerEtat } from './utils/storage';
import Entrainement from './components/Entrainement';
import Programme from './components/Programme';

/** Deux façons de s'entraîner : notre programme, à deux, ou une séance
 *  libre tirée de la bibliothèque. On rouvre là où on était. */
type Mode = 'programme' | 'libre';
const CLE_MODE = 'functional-training-mode';

function lireMode(): Mode {
  try {
    return localStorage.getItem(CLE_MODE) === 'libre' ? 'libre' : 'programme';
  } catch {
    return 'programme';
  }
}

const MODES: { id: Mode; nom: string }[] = [
  { id: 'programme', nom: 'Programme' },
  { id: 'libre', nom: 'Séance libre' },
];

export default function App() {
  const [etat, setEtat] = useState<EntrainementState>(chargerEtat);
  const [mode, setMode] = useState<Mode>(lireMode);

  useEffect(() => {
    enregistrerEtat(etat);
  }, [etat]);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_MODE, mode);
    } catch {
      // Navigation privée : on rouvrira simplement sur le programme.
    }
  }, [mode]);

  return (
    // Le fond vient des jetons de thème : sombre par défaut, clair si le
    // système le demande. Aucun dégradé forcé ici.
    <div className="min-h-screen" style={{ color: 'var(--texte)' }}>
      {/* En-tête compact : une ligne, pour laisser la place à la séance. */}
      <header
        className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        {/* Sur un téléphone, le titre laisse toute la largeur aux deux modes. */}
        <h1
          className="hidden shrink-0 whitespace-nowrap text-base font-bold sm:block"
          style={{ color: 'var(--texte)' }}
        >
          Functional Training
        </h1>
        <nav
          className="flex flex-1 rounded-xl p-1 sm:flex-none"
          style={{ background: 'var(--surface)' }}
          aria-label="Mode"
        >
          {MODES.map(({ id, nom }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className="flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold"
              style={{
                minHeight: 36,
                background: mode === id ? 'var(--accent)' : 'transparent',
                color: mode === id ? 'var(--accent-texte)' : 'var(--texte-discret)',
              }}
            >
              {nom}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-4">
        {mode === 'programme' ? (
          <Programme unite={etat.parametres.unitePoids ?? 'lb'} tempo={etat.parametres.tempo} />
        ) : (
          <Entrainement etat={etat} onChange={(miseAJour) => setEtat((prec) => miseAJour(prec))} />
        )}
      </main>
    </div>
  );
}
