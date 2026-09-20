import { useEffect, useState } from 'react';
import type { EntrainementState } from './types';
import { chargerEtat, enregistrerEtat } from './utils/storage';
import Entrainement from './components/Entrainement';

export default function App() {
  const [etat, setEtat] = useState<EntrainementState>(chargerEtat);

  useEffect(() => {
    enregistrerEtat(etat);
  }, [etat]);

  return (
    // Le fond vient des jetons de thème : sombre par défaut, clair si le
    // système le demande. Aucun dégradé forcé ici.
    <div className="min-h-screen" style={{ color: 'var(--texte)' }}>
      {/* En-tête compact : une ligne, pour laisser la place à la séance. */}
      <header
        className="mx-auto flex max-w-3xl items-baseline justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <h1 className="shrink-0 whitespace-nowrap text-base font-bold" style={{ color: 'var(--texte)' }}>
          Functional Training
        </h1>
        <p className="truncate text-xs" style={{ color: 'var(--texte-discret)' }}>
          Tempo lent
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-4">
        <Entrainement etat={etat} onChange={(miseAJour) => setEtat((prec) => miseAJour(prec))} />
      </main>
    </div>
  );
}
