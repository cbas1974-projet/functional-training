// L'écran « Progression », ouvert depuis l'historique : les mensurations — le
// formulaire, la liste des siennes et, avec le serveur, celles de l'autre —, puis
// trois graphiques : la charge d'un exercice au fil des séances, la charge totale
// soulevée à chaque séance, le poids de corps au fil des mois. Avec le serveur,
// la courbe de l'autre s'ajoute, dans une deuxième couleur, avec sa légende.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Mesure, Personne, SeanceRealisee, UnitePoids } from '../types';
import { chargerMesuresPartagees } from '../utils/enLigne';
import type { Partage } from '../utils/enLigne';
import { NOM_PERSONNE } from '../utils/programmeMois';
import type { PointCourbe } from '../utils/progression';
import {
  exerciceLePlusSuivi,
  exercicesAvecCharge,
  reunirExercices,
  serieChargeExercice,
  serieChargeTotale,
  seriePoidsCorps,
} from '../utils/progression';
import { SUFFIXE_UNITE } from '../utils/statistiques';
import Graphique from './Graphique';
import type { SerieGraphique } from './Graphique';
import Mesures from './Mesures';
import { CIBLE } from './Feuille';

interface ProgressionProps {
  /** Mes séances, gardées sur ce téléphone. */
  historique: SeanceRealisee[];
  mesures: Mesure[];
  /** L'unité des charges de l'application : celle des courbes. */
  unitePoids: UnitePoids;
  /** Qui s'entraîne sur ce téléphone : son prénom nomme sa courbe. */
  personne: Personne | null;
  /** Avec le serveur, on peut regarder aussi l'autre. */
  partage: Partage | null;
  nomPartenaire: string | null;
  /** On a choisi de voir l'autre : sa courbe s'ajoute à la mienne. */
  lesDeux: boolean;
  /** Ses séances, reçues du serveur ; null tant qu'elles ne sont pas arrivées. */
  seancesAutre: SeanceRealisee[] | null;
  /** Le serveur n'a pas répondu pour l'historique des deux. */
  injoignable: boolean;
  onMesure: (mesure: Mesure) => void;
  onSupprimerMesure: (id: string) => void;
}

/** Ma courbe, puis celle de l'autre : deux couleurs qui se distinguent aussi
 *  bien en thème sombre qu'en thème clair, et pour les daltoniens. */
const COULEUR_MOI = 'var(--accent)';
const COULEUR_AUTRE = 'var(--descente)';

const RIEN_A_MONTRER = 'Note tes charges pendant les séances : la courbe apparaîtra ici';
const PREMIERE_MESURE = 'Note ta première mesure ci-dessus : la courbe du poids apparaîtra ici.';

/** Un graphique et son titre, dans un cadre. */
function Carte({ titre, aide, children }: { titre: string; aide: string; children: ReactNode }) {
  return (
    <section className="min-w-0 p-3" style={{ background: 'var(--surface-haute)', borderRadius: 14 }}>
      <h3 className="text-base font-bold" style={{ color: 'var(--texte)' }}>
        {titre}
      </h3>
      <p className="mb-3 mt-0.5 text-sm" style={{ color: 'var(--texte-discret)' }}>
        {aide}
      </p>
      {children}
    </section>
  );
}

export default function Progression({
  historique,
  mesures,
  unitePoids,
  personne,
  partage,
  nomPartenaire,
  lesDeux,
  seancesAutre,
  injoignable,
  onMesure,
  onSupprimerMesure,
}: ProgressionProps) {
  /** On regarde aussi l'autre : le serveur est réglé et on a choisi de le voir. */
  const avecAutre = lesDeux && partage !== null && nomPartenaire !== null;
  const nomMoi = personne ? NOM_PERSONNE[personne] : 'Moi';
  const unite = SUFFIXE_UNITE[unitePoids];

  // Les mesures de l'autre : elles viennent du serveur, chaque fois qu'on ouvre l'écran.
  const [mesuresAutre, setMesuresAutre] = useState<Mesure[] | null>(null);
  const [mesuresIntrouvables, setMesuresIntrouvables] = useState(false);
  const serveur = partage?.serveur;
  const equipe = partage?.equipe;
  const moi = partage?.personne;
  useEffect(() => {
    if (!avecAutre || !serveur || !equipe) return;
    let fini = false;
    void chargerMesuresPartagees({ serveur, equipe }).then((recues) => {
      if (fini) return;
      setMesuresIntrouvables(recues === null);
      setMesuresAutre(recues === null ? null : recues.filter((m) => m.personne !== moi).map((m) => m.mesure));
    });
    return () => {
      fini = true;
    };
  }, [avecAutre, serveur, equipe, moi]);

  // ---------------------------------------------------------- La charge d'un exercice
  const [exerciceChoisi, setExerciceChoisi] = useState<string | null>(null);
  // Ce que l'autre apporte : rien tant qu'on ne le regarde pas, ou que ses données ne sont pas là.
  const seancesDeLAutre = avecAutre && seancesAutre ? seancesAutre : [];
  const mesuresDeLAutre = avecAutre && mesuresAutre ? mesuresAutre : [];
  const exercicesMoi = exercicesAvecCharge(historique);
  const exercices = reunirExercices(exercicesMoi, exercicesAvecCharge(seancesDeLAutre));
  // Celui qu'on a choisi, tant qu'il y est ; sinon celui que j'ai le plus fait.
  const exerciceId = exercices.some((e) => e.exerciceId === exerciceChoisi)
    ? exerciceChoisi
    : (exerciceLePlusSuivi(exercicesMoi) ?? exerciceLePlusSuivi(exercices))?.exerciceId ?? null;
  const nomExercice = exercices.find((e) => e.exerciceId === exerciceId)?.nom ?? '';

  /** Ma série d'abord, et celle de l'autre quand on le regarde. */
  const deuxSeries = (miennes: PointCourbe[], siennes: PointCourbe[]): SerieGraphique[] => [
    { nom: nomMoi, couleur: COULEUR_MOI, points: miennes },
    ...(avecAutre && nomPartenaire ? [{ nom: nomPartenaire, couleur: COULEUR_AUTRE, points: siennes }] : []),
  ];

  const seriesExercice = deuxSeries(
    exerciceId ? serieChargeExercice(historique, exerciceId, unitePoids) : [],
    exerciceId ? serieChargeExercice(seancesDeLAutre, exerciceId, unitePoids) : [],
  );
  const seriesTotal = deuxSeries(
    serieChargeTotale(historique, unitePoids),
    serieChargeTotale(seancesDeLAutre, unitePoids),
  );
  const seriesCorps = deuxSeries(seriePoidsCorps(mesures, unitePoids), seriePoidsCorps(mesuresDeLAutre, unitePoids));

  const enChargement = avecAutre && seancesAutre === null && !injoignable;

  return (
    <div className="space-y-5">
      {avecAutre && injoignable && (
        <p role="status" className="text-sm" style={{ color: 'var(--pause)' }}>
          Le serveur ne répond pas : voici seulement ce qui est sur ce téléphone.
        </p>
      )}
      {avecAutre && !injoignable && mesuresIntrouvables && (
        <p role="status" className="text-sm" style={{ color: 'var(--pause)' }}>
          Les mesures de {nomPartenaire} ne sont pas disponibles pour l’instant.
        </p>
      )}
      {enChargement && (
        <p role="status" className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          Chargement des courbes de {nomPartenaire}…
        </p>
      )}

      <Mesures
        mesures={mesures}
        unite={unitePoids}
        nomAutre={avecAutre ? nomPartenaire : null}
        mesuresAutre={avecAutre ? mesuresAutre : null}
        onMesure={onMesure}
        onSupprimer={onSupprimerMesure}
      />

      <Carte titre="Charge d’un exercice" aide="La série la plus lourde de chaque séance, au fil des semaines.">
        {exercices.length > 0 && (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-semibold" style={{ color: 'var(--texte)' }}>
              Exercice
            </span>
            <select
              value={exerciceId ?? ''}
              onChange={(evenement) => setExerciceChoisi(evenement.target.value)}
              className="w-full rounded-xl px-3 text-base"
              style={{
                minHeight: CIBLE,
                background: 'var(--surface)',
                border: '1px solid var(--bordure)',
                color: 'var(--texte)',
              }}
            >
              {exercices.map((exercice) => (
                <option key={exercice.exerciceId} value={exercice.exerciceId}>
                  {exercice.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        <Graphique
          // Un autre exercice repart de zéro : le point choisi ne suit pas.
          key={exerciceId ?? 'aucun'}
          titre={`Charge — ${nomExercice || 'aucun exercice'}`}
          series={seriesExercice}
          unite={unite}
          vide={RIEN_A_MONTRER}
        />
      </Carte>

      <Carte titre="Charge totale soulevée" aide="Poids × répétitions de toutes les séries d’une séance.">
        <Graphique titre="Charge totale par séance" series={seriesTotal} unite={unite} vide={RIEN_A_MONTRER} />
      </Carte>

      <Carte titre="Poids de corps" aide="Un point par mesure, au fil des mois.">
        <Graphique
          titre="Poids de corps"
          series={seriesCorps}
          unite={unite}
          vide={PREMIERE_MESURE}
        />
      </Carte>
    </div>
  );
}
