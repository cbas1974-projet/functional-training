import { useState } from 'react';
import type {
  EntrainementState,
  ParametresSeance,
  ProgressionSeance,
  Seance,
} from '../types';
import {
  DUREES_MINUTES,
  FORMATS,
  NIVEAUX,
  REPS_PAR_SERIE,
  SERIES_PAR_EXERCICE,
  TEMPOS,
  TOUTES_LES_ZONES,
} from '../data/parametres';
import { EXERCICES_PAR_ID, NOM_ZONE, ZONES } from '../data/exercices';
import {
  formaterDuree,
  genererSeance,
  libelleBloc,
  remplacerExercice,
} from '../utils/generateurSeance';
import { formaterDateFr, graineAleatoire, libelleZones, messageErreur } from '../utils/formatage';
import SeanceGuidee from './SeanceGuidee';
import FicheExercice from './FicheExercice';
import HistoriqueEntrainement from './HistoriqueEntrainement';
import BibliothequeExercices from './BibliothequeExercices';

interface EntrainementProps {
  etat: EntrainementState;
  /** Forme « updater » pour éviter d'écraser un changement concurrent. */
  onChange: (miseAJour: (prec: EntrainementState) => EntrainementState) => void;
}

/** Séance actuellement déroulée en plein écran (fraîche ou reprise). */
interface SeanceActive {
  seance: Seance;
  progression: ProgressionSeance | null;
}

function Pastille({
  selectionne,
  onClick,
  children,
}: {
  selectionne: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-3 font-medium transition-colors ${
        selectionne ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function Entrainement({ etat, onChange }: EntrainementProps) {
  const [seanceActive, setSeanceActive] = useState<SeanceActive | null>(null);
  const [erreurGeneration, setErreurGeneration] = useState<string | null>(null);
  const [messageRemplacement, setMessageRemplacement] = useState<Record<string, string>>({});

  const { parametres, seanceCourante, enCours, historique } = etat;

  const mettreAJourParametres = (partiel: Partial<ParametresSeance>) => {
    onChange((prec) => ({ ...prec, parametres: { ...prec.parametres, ...partiel } }));
  };

  const toutesZones = parametres.zones.length >= TOUTES_LES_ZONES.length;
  const basculerZone = (zone: (typeof TOUTES_LES_ZONES)[number]) => {
    // Depuis « tout le corps », choisir une zone cible cette zone seule ;
    // retirer la dernière zone ramène à tout le corps.
    if (toutesZones) {
      mettreAJourParametres({ zones: [zone] });
      return;
    }
    const zones = parametres.zones.includes(zone)
      ? parametres.zones.filter((z) => z !== zone)
      : [...parametres.zones, zone];
    mettreAJourParametres({ zones: zones.length > 0 ? zones : [...TOUTES_LES_ZONES] });
  };
  const descriptionZones = toutesZones
    ? 'Toutes les zones en alternance : jambes, haut du corps, dos, gainage, corps entier.'
    : parametres.zones.length === 1
      ? `Séance ciblée : ${libelleZones(parametres)}.`
      : `En alternance : ${libelleZones(parametres)}.`;
  const niveauSelectionne = NIVEAUX.find((n) => n.id === parametres.niveau);
  const formatSelectionne = FORMATS.find((f) => f.id === parametres.format);

  const genererNouvelleSeance = (nouvelleGraine?: number) => {
    try {
      const seance = genererSeance(parametres, nouvelleGraine);
      setErreurGeneration(null);
      setMessageRemplacement({});
      onChange((prec) => ({ ...prec, seanceCourante: seance }));
    } catch (err) {
      setErreurGeneration(messageErreur(err, 'Impossible de générer la séance pour le moment.'));
    }
  };

  const remplacerDansSeance = (exerciceId: string) => {
    if (!seanceCourante) return;
    try {
      const nouvelle = remplacerExercice(seanceCourante, exerciceId, graineAleatoire());
      const identique = JSON.stringify(nouvelle) === JSON.stringify(seanceCourante);
      if (identique) {
        setMessageRemplacement((prec) => ({
          ...prec,
          [exerciceId]: 'Aucun autre exercice disponible pour cette zone',
        }));
      } else {
        setMessageRemplacement({});
        onChange((prec) => ({ ...prec, seanceCourante: nouvelle }));
      }
    } catch (err) {
      setErreurGeneration(messageErreur(err, 'Impossible de remplacer cet exercice pour le moment.'));
    }
  };

  const lancerSeance = () => {
    if (!seanceCourante) return;
    setSeanceActive({ seance: seanceCourante, progression: null });
  };

  const reprendreSeance = () => {
    if (!enCours) return;
    setSeanceActive({ seance: enCours.seance, progression: enCours });
  };

  const abandonnerSeance = () => {
    onChange((prec) => ({ ...prec, enCours: null }));
  };

  const supprimerDeLHistorique = (id: string) => {
    onChange((prec) => ({ ...prec, historique: prec.historique.filter((s) => s.id !== id) }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Nouvelle séance */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Nouvelle séance</h2>

        <div className="space-y-5">
          <div>
            <p className="font-semibold text-gray-800 mb-2">Durée</p>
            <div className="flex flex-wrap gap-2">
              {DUREES_MINUTES.map((duree) => (
                <Pastille
                  key={duree}
                  selectionne={parametres.dureeMinutes === duree}
                  onClick={() => mettreAJourParametres({ dureeMinutes: duree })}
                >
                  {`${duree} min`}
                </Pastille>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Zones travaillées</p>
            <div className="flex flex-wrap gap-2">
              <Pastille
                selectionne={toutesZones}
                onClick={() => mettreAJourParametres({ zones: [...TOUTES_LES_ZONES] })}
              >
                Tout le corps
              </Pastille>
              {ZONES.map((z) => (
                <Pastille
                  key={z.id}
                  selectionne={!toutesZones && parametres.zones.includes(z.id)}
                  onClick={() => basculerZone(z.id)}
                >
                  {z.nom}
                </Pastille>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">{descriptionZones}</p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Niveau</p>
            <div className="flex flex-wrap gap-2">
              {NIVEAUX.map((n) => (
                <Pastille
                  key={n.id}
                  selectionne={parametres.niveau === n.id}
                  onClick={() => mettreAJourParametres({ niveau: n.id })}
                >
                  {n.nom}
                </Pastille>
              ))}
            </div>
            {niveauSelectionne && (
              <p className="text-sm text-gray-500 mt-2">{niveauSelectionne.description}</p>
            )}
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Format</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Pastille
                  key={f.id}
                  selectionne={parametres.format === f.id}
                  onClick={() => mettreAJourParametres({ format: f.id })}
                >
                  {f.nom}
                </Pastille>
              ))}
            </div>
            {formatSelectionne && (
              <p className="text-sm text-gray-500 mt-2">{formatSelectionne.description}</p>
            )}
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Séries par exercice</p>
            <div className="flex flex-wrap gap-2">
              {SERIES_PAR_EXERCICE.map((option) => (
                <Pastille
                  key={String(option.valeur)}
                  selectionne={parametres.seriesParExercice === option.valeur}
                  onClick={() => mettreAJourParametres({ seriesParExercice: option.valeur })}
                >
                  {option.nom}
                </Pastille>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {SERIES_PAR_EXERCICE.find((o) => o.valeur === parametres.seriesParExercice)?.description}
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Répétitions par série</p>
            <div className="flex flex-wrap gap-2">
              {REPS_PAR_SERIE.map((option) => (
                <Pastille
                  key={String(option.valeur)}
                  selectionne={parametres.repsParSerie === option.valeur}
                  onClick={() => mettreAJourParametres({ repsParSerie: option.valeur })}
                >
                  {option.nom}
                </Pastille>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {REPS_PAR_SERIE.find((o) => o.valeur === parametres.repsParSerie)?.description}
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Tempo</p>
            <div className="space-y-2">
              {TEMPOS.map((t) => {
                const selectionne =
                  parametres.tempo.monteeSec === t.tempo.monteeSec &&
                  parametres.tempo.descenteSec === t.tempo.descenteSec;
                return (
                  <label
                    key={t.nom}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                      selectionne ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tempo"
                      checked={selectionne}
                      onChange={() => mettreAJourParametres({ tempo: t.tempo })}
                      className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                    />
                    <span>
                      <span className="block font-medium text-gray-800">{t.nom}</span>
                      <span className="block text-sm text-gray-500">{t.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Options</p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={parametres.banc}
                  onChange={(e) => mettreAJourParametres({ banc: e.target.checked })}
                  className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                />
                <span className="text-gray-800">J'ai un banc ou une marche solide</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={parametres.explosifs}
                  onChange={(e) => mettreAJourParametres({ explosifs: e.target.checked })}
                  className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                />
                <span className="text-gray-800">
                  Inclure les mouvements explosifs (squat sauté, swing)
                </span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => genererNouvelleSeance()}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            Générer la séance
          </button>
          {erreurGeneration && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {erreurGeneration}
            </p>
          )}
        </div>
      </div>

      {/* 2. Bandeau de reprise */}
      {enCours && (
        <div className="flex flex-col gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-yellow-800">Séance interrompue le {formaterDateFr(enCours.sauvegardeeLe ?? enCours.demarreeLe)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reprendreSeance}
              className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
            >
              Reprendre
            </button>
            <button
              type="button"
              onClick={abandonnerSeance}
              className="rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200"
            >
              Abandonner
            </button>
          </div>
        </div>
      )}

      {/* 3. Séance proposée */}
      {seanceCourante && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Séance proposée</h2>

          <div className="mb-4 space-y-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              Durée estimée :{' '}
              <span className="font-semibold">{formaterDuree(seanceCourante.dureeEstimeeSec)}</span>{' '}
              (demandée : {seanceCourante.parametres.dureeMinutes} min)
            </p>
            <p>Échauffement : {formaterDuree(seanceCourante.echauffementSec)}</p>
            <p>
              Exercices :{' '}
              {seanceCourante.blocs.length + (seanceCourante.circuit?.stations.length ?? 0)}
            </p>
            <p>Retour au calme : {formaterDuree(seanceCourante.retourCalmeSec)}</p>
            {seanceCourante.circuit && (
              <p>
                Circuit : {seanceCourante.circuit.stations.length} stations ×{' '}
                {seanceCourante.circuit.tours} tours, {seanceCourante.circuit.travailSec} s /{' '}
                {seanceCourante.circuit.reposSec} s
              </p>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Tempo {seanceCourante.parametres.tempo.monteeSec} s montée /{' '}
            {seanceCourante.parametres.tempo.descenteSec} s descente · sans rebond, contrôle total
          </div>

          {seanceCourante.blocs.length > 0 && (
            <div className="mb-4 space-y-3">
              {seanceCourante.blocs.map((bloc) => {
                const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
                if (!exercice) return null;
                return (
                  <div key={bloc.exerciceId} className="rounded-lg border border-gray-200 p-3">
                    <FicheExercice exercice={exercice} taille="petite">
                      <span className="mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {NOM_ZONE[exercice.zone]}
                      </span>
                      <p className="text-sm text-gray-600">{libelleBloc(bloc, exercice)}</p>
                      <button
                        type="button"
                        onClick={() => remplacerDansSeance(bloc.exerciceId)}
                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Remplacer
                      </button>
                      {messageRemplacement[bloc.exerciceId] && (
                        <p className="mt-1 text-xs text-gray-500">
                          {messageRemplacement[bloc.exerciceId]}
                        </p>
                      )}
                    </FicheExercice>
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-sm text-gray-600">
                        Points d'attention
                      </summary>
                      <ul className="ml-4 mt-1 list-disc space-y-0.5 text-sm text-gray-600">
                        {exercice.pointsAttention.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </details>
                    {exercice.interetJjb && (
                      <p className="mt-2 text-sm italic text-blue-700">{exercice.interetJjb}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {seanceCourante.circuit && (
            <div className="mb-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Circuit</h3>
              <p className="text-sm text-gray-600">
                {seanceCourante.circuit.tours} tours · {seanceCourante.circuit.travailSec} s de
                travail / {seanceCourante.circuit.reposSec} s de repos
              </p>
              {seanceCourante.circuit.stations.map((exerciceId, index) => {
                const exercice = EXERCICES_PAR_ID[exerciceId];
                if (!exercice) return null;
                return (
                  <div key={`${exerciceId}-${index}`} className="rounded-lg border border-gray-200 p-3">
                    <FicheExercice exercice={exercice} taille="petite">
                      <p className="mb-1 text-xs font-semibold text-gray-500">
                        Station {index + 1}
                      </p>
                      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {NOM_ZONE[exercice.zone]}
                      </span>
                    </FicheExercice>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => genererNouvelleSeance(graineAleatoire())}
              className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200"
            >
              Regénérer
            </button>
            <button
              type="button"
              onClick={lancerSeance}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700"
            >
              Lancer la séance
            </button>
          </div>
        </div>
      )}

      {/* 4. Mode guidé */}
      {seanceActive && (
        <SeanceGuidee
          seance={seanceActive.seance}
          progression={seanceActive.progression}
          onProgression={(p) => onChange((prec) => ({ ...prec, enCours: p }))}
          onTerminee={(realisee) => {
            onChange((prec) => ({
              ...prec,
              enCours: null,
              historique: [realisee, ...prec.historique].slice(0, 200),
            }));
            setSeanceActive(null);
          }}
          onQuitter={() => {
            onChange((prec) => ({ ...prec, enCours: null }));
            setSeanceActive(null);
          }}
        />
      )}

      {/* 5. Historique */}
      <HistoriqueEntrainement historique={historique} onSupprimer={supprimerDeLHistorique} />

      {/* 6. Bibliothèque */}
      <BibliothequeExercices />
    </div>
  );
}
