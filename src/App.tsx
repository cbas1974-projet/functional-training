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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Functional Training</h1>
          <p className="text-sm text-gray-600 mt-1">
            Séances guidées au tempo lent, pour les tendons et le jiu-jitsu
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Entrainement etat={etat} onChange={(miseAJour) => setEtat((prec) => miseAJour(prec))} />
      </main>

      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-sm text-gray-600">
          Sauvegarde automatique sur cet appareil
        </div>
      </footer>
    </div>
  );
}
