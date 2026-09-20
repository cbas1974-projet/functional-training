import type { SeanceRealisee } from '../types';
import { FORMATS, NIVEAUX } from '../data/parametres';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { formaterDuree } from '../utils/generateurSeance';
import { calculerStatistiques, formaterDateFr, libelleZones } from '../utils/formatage';
import FicheExercice from './FicheExercice';

interface HistoriqueEntrainementProps {
  historique: SeanceRealisee[];
  onSupprimer: (id: string) => void;
}

export default function HistoriqueEntrainement({
  historique,
  onSupprimer,
}: HistoriqueEntrainementProps) {
  const stats = calculerStatistiques(historique);
  const trie = [...historique].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleSupprimer = (id: string) => {
    if (window.confirm("Supprimer cette séance de l'historique ?")) {
      onSupprimer(id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Historique</h2>

      {historique.length === 0 ? (
        <p className="text-gray-600">Aucune séance enregistrée pour l'instant.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-6 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-800">{stats.nombreSeances}</p>
              <p className="text-xs text-gray-500">séance{stats.nombreSeances > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-800">
                {formaterDuree(stats.tempsTotalSec)}
              </p>
              <p className="text-xs text-gray-500">temps total</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-800">{stats.seances7DerniersJours}</p>
              <p className="text-xs text-gray-500">7 derniers jours</p>
            </div>
          </div>

          <ul className="space-y-3">
            {trie.map((realisee) => {
              const zones = libelleZones(realisee.parametres);
              const niveau = NIVEAUX.find((n) => n.id === realisee.parametres.niveau);
              const format = FORMATS.find((f) => f.id === realisee.parametres.format);

              return (
                <li key={realisee.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {formaterDateFr(realisee.date)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {zones} · {format?.nom} · {niveau?.nom}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formaterDuree(realisee.dureeReelleSec)} / {formaterDuree(realisee.dureePrevueSec)}{' '}
                        prévues
                      </p>
                    </div>
                    {!realisee.terminee && (
                      <span className="whitespace-nowrap rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                        interrompue
                      </span>
                    )}
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-sm text-blue-600">
                      Détail par exercice
                    </summary>
                    <div className="mt-2 space-y-3">
                      {realisee.exercices.map((exo, index) => {
                        const exercice = EXERCICES_PAR_ID[exo.exerciceId];
                        if (!exercice) return null;
                        return (
                          <FicheExercice
                            key={`${exo.exerciceId}-${index}`}
                            exercice={exercice}
                            taille="petite"
                          >
                            <p className="text-sm text-gray-600">
                              {exo.seriesFaites} / {exo.seriesPrevues} séries
                            </p>
                            <p className="text-sm text-gray-600">
                              {formaterDuree(exo.dureeSec)}
                              {typeof exo.poidsKg === 'number' ? ` · ${exo.poidsKg} kg` : ''}
                            </p>
                          </FicheExercice>
                        );
                      })}
                    </div>
                  </details>

                  <button
                    type="button"
                    onClick={() => handleSupprimer(realisee.id)}
                    className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Supprimer
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
