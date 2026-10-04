import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Personne, SeanceRealisee } from '../types';
import { FORMATS, NIVEAUX } from '../data/parametres';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { formaterDuree } from '../utils/generateurSeance';
import { calculerStatistiques, formaterDateFr, libelleZones } from '../utils/formatage';
import { SUFFIXE_UNITE, chargeTotale, libellePoidsParSerie, uniteDeSeance } from '../utils/statistiques';
import { chargerHistoriquePartage } from '../utils/enLigne';
import type { Partage } from '../utils/enLigne';
import { NOM_PERSONNE } from '../utils/programmeMois';
import FicheExercice from './FicheExercice';
import { Pastille } from './Feuille';

interface HistoriqueEntrainementProps {
  historique: SeanceRealisee[];
  onSupprimer: (id: string) => void;
  /** Avec le serveur : l'historique des deux se consulte aussi. */
  partage?: Partage | null;
  nomPartenaire?: string | null;
}

/** Une séance de la liste, et à qui elle est. */
interface Ligne {
  realisee: SeanceRealisee;
  personne?: Personne;
  /** Gardée sur ce téléphone : on peut la supprimer. */
  locale: boolean;
}

/** Tuile de statistique : un grand nombre, un libellé discret dessous. */
function Tuile({ valeur, libelle }: { valeur: ReactNode; libelle: string }) {
  return (
    <div
      className="px-2 py-3 text-center"
      style={{ background: 'var(--surface-haute)', borderRadius: 14 }}
    >
      <p className="chiffres text-xl font-bold leading-tight" style={{ color: 'var(--texte)' }}>
        {valeur}
      </p>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--texte-discret)' }}>
        {libelle}
      </p>
    </div>
  );
}

export default function HistoriqueEntrainement({
  historique,
  onSupprimer,
  partage,
  nomPartenaire,
}: HistoriqueEntrainementProps) {
  /** « Moi », ou « Les deux » quand le serveur est réglé. */
  const [lesDeux, setLesDeux] = useState(false);
  const [duServeur, setDuServeur] = useState<{ personne: Personne; realisation: SeanceRealisee }[] | null>(null);
  const [injoignable, setInjoignable] = useState(false);
  /** Supprimées ici depuis l'ouverture : le serveur les a peut-être encore. */
  const [supprimees, setSupprimees] = useState<string[]>([]);
  const serveur = partage?.serveur;
  const equipe = partage?.equipe;
  useEffect(() => {
    if (!lesDeux || !serveur || !equipe) return;
    let fini = false;
    void chargerHistoriquePartage({ serveur, equipe }).then((seances) => {
      if (fini) return;
      setDuServeur(seances);
      setInjoignable(seances === null);
    });
    return () => {
      fini = true;
    };
  }, [lesDeux, serveur, equipe]);

  const miennes: Ligne[] = historique.map((realisee) => ({
    realisee,
    locale: true,
    ...(partage ? { personne: partage.personne } : {}),
  }));
  // Les deux : celles du serveur, et les miennes qu'il n'a pas encore.
  const lignes: Ligne[] =
    lesDeux && duServeur
      ? [
          ...duServeur
            .filter((s) => !supprimees.includes(s.realisation.id))
            .map((s) => ({
              realisee: s.realisation,
              personne: s.personne,
              locale: historique.some((h) => h.id === s.realisation.id),
            })),
          ...miennes.filter((m) => !duServeur.some((s) => s.realisation.id === m.realisee.id)),
        ]
      : miennes;
  const stats = calculerStatistiques(lignes.map((l) => l.realisee));
  const trie = [...lignes].sort(
    (a, b) => new Date(b.realisee.date).getTime() - new Date(a.realisee.date).getTime()
  );

  const handleSupprimer = (id: string) => {
    if (window.confirm("Supprimer cette séance de l'historique ?")) {
      setSupprimees((ids) => [...ids, id]);
      onSupprimer(id);
    }
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
      <h2 className="mb-3 text-lg font-bold" style={{ color: 'var(--texte)' }}>
        Historique
      </h2>

      {partage && nomPartenaire && (
        <div role="group" aria-label="Quel historique" className="mb-3 grid grid-cols-2 gap-2">
          <Pastille selectionne={!lesDeux} onClick={() => setLesDeux(false)}>
            Moi
          </Pastille>
          <Pastille selectionne={lesDeux} onClick={() => setLesDeux(true)}>
            Avec {nomPartenaire}
          </Pastille>
        </div>
      )}
      {lesDeux && injoignable && (
        <p className="mb-3 text-sm" style={{ color: 'var(--pause)' }}>
          Le serveur ne répond pas : voici les séances de ce téléphone.
        </p>
      )}

      {lignes.length === 0 ? (
        <p style={{ color: 'var(--texte-discret)' }}>Aucune séance enregistrée pour l'instant.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Tuile
              valeur={stats.nombreSeances}
              libelle={`séance${stats.nombreSeances > 1 ? 's' : ''}`}
            />
            {/* Arrondi à la minute : une tuile n'a pas la place des secondes. */}
            <Tuile
              valeur={formaterDuree(Math.round(stats.tempsTotalSec / 60) * 60)}
              libelle="temps total"
            />
            <Tuile valeur={stats.seances7DerniersJours} libelle="7 derniers jours" />
          </div>

          <ul className="space-y-3">
            {trie.map(({ realisee, personne, locale }) => {
              const zones = libelleZones(realisee.parametres);
              const niveau = NIVEAUX.find((n) => n.id === realisee.parametres.niveau);
              const format = FORMATS.find((f) => f.id === realisee.parametres.format);
              // Barre de couleur à gauche : verte si la séance est allée au
              // bout, jaune si elle a été interrompue.
              const couleur = realisee.terminee ? 'var(--montee)' : 'var(--pause)';
              // Chaque séance est montrée dans l'unité où elle a été saisie.
              const unite = uniteDeSeance(realisee.parametres);
              const total = chargeTotale(realisee);

              return (
                <li
                  key={`${personne ?? ''}-${realisee.id}`}
                  className="overflow-hidden"
                  style={{
                    background: 'var(--surface-haute)',
                    borderRadius: 14,
                    borderLeft: `4px solid ${couleur}`,
                  }}
                >
                  <div className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="chiffres font-semibold"
                          style={{ color: 'var(--texte)' }}
                        >
                          {lesDeux && personne ? `${NOM_PERSONNE[personne]} · ` : ''}
                          {formaterDateFr(realisee.date)}
                        </p>
                        {/* Une séance du programme porte son nom ; une séance
                            libre, ses réglages. */}
                        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
                          {realisee.titre ?? `${zones} · ${format?.nom} · ${niveau?.nom}`}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
                          <span className="chiffres">{formaterDuree(realisee.dureeReelleSec)}</span>{' '}
                          / <span className="chiffres">{formaterDuree(realisee.dureePrevueSec)}</span>{' '}
                          prévues
                        </p>
                        {total > 0 && (
                          <p className="text-sm font-semibold" style={{ color: 'var(--montee)' }}>
                            Charge soulevée :{' '}
                            <span className="chiffres">
                              {total.toLocaleString('fr-CA')} {SUFFIXE_UNITE[unite]}
                            </span>
                          </p>
                        )}
                      </div>
                      {!realisee.terminee && (
                        <span
                          className="whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold"
                          style={{ background: 'var(--pause)', color: 'var(--accent-texte)' }}
                        >
                          interrompue
                        </span>
                      )}
                    </div>

                    <details>
                      <summary
                        className="flex cursor-pointer select-none items-center text-sm font-medium"
                        style={{ color: 'var(--texte-discret)', minHeight: 44, listStyle: 'none' }}
                      >
                        Détail par exercice
                      </summary>
                      <div className="space-y-3 pb-1">
                        {realisee.exercices.map((exo, index) => {
                          const exercice = EXERCICES_PAR_ID[exo.exerciceId];
                          if (!exercice) return null;
                          return (
                            <FicheExercice
                              key={`${exo.exerciceId}-${index}`}
                              exercice={exercice}
                              taille="petite"
                            >
                              <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
                                <span className="chiffres">
                                  {exo.seriesFaites} / {exo.seriesPrevues}
                                </span>{' '}
                                séries
                              </p>
                              <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
                                <span className="chiffres">{formaterDuree(exo.dureeSec)}</span>
                                {libellePoidsParSerie(exo, unite) && (
                                  <>
                                    {' · '}
                                    <span className="chiffres">
                                      {libellePoidsParSerie(exo, unite)}
                                    </span>
                                  </>
                                )}
                              </p>
                            </FicheExercice>
                          );
                        })}
                      </div>
                    </details>

                    {locale && (
                    <button
                      type="button"
                      onClick={() => handleSupprimer(realisee.id)}
                      className="rounded-xl px-3 text-sm font-semibold"
                      style={{
                        minHeight: 44,
                        background: 'transparent',
                        border: '1px solid var(--bordure)',
                        color: 'var(--alerte)',
                      }}
                    >
                      Supprimer
                    </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
