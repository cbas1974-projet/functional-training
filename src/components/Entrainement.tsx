import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type {
  EntrainementState,
  Materiel,
  ParametresSeance,
  ProgressionSeance,
  Seance,
  Zone,
} from '../types';
import {
  DUREES_MINUTES,
  FORMATS,
  GUIDES_VISUELS,
  NIVEAUX,
  REPS_PAR_SERIE,
  MATERIELS_DECLARABLES,
  SERIES_PAR_EXERCICE,
  TEMPOS,
  TAILLES_ROTATION,
  TOUTES_LES_ZONES,
  UNITES_POIDS,
} from '../data/parametres';
import { EXERCICES_PAR_ID, NOM_PATTERN, NOM_ZONE, ZONES } from '../data/exercices';
import {
  analyserSeance,
  dureeSerieDuBloc,
  exercicesDisponibles,
  formaterDuree,
  genererSeance,
  libelleBloc,
  remplacerExercice,
} from '../utils/generateurSeance';
import type { AnalyseSeance } from '../utils/generateurSeance';
import { formaterDateFr, graineAleatoire, libelleZones, messageErreur } from '../utils/formatage';
import { frequencesParExercice, libelleFrequenceCourte, uniteDeSeance } from '../utils/statistiques';
import type { FrequenceExercice } from '../utils/statistiques';
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

/** Ce que l'écran d'accueil affiche : la séance, l'historique ou la
 *  bibliothèque. Un seul à la fois : l'accueil ne doit pas être un rouleau. */
type Vue = 'seance' | 'historique' | 'bibliotheque';

/** Hauteur minimale d'une cible tactile, en pixels (doigt sur un téléphone). */
const CIBLE = 44;
/** Hauteur des deux actions principales : générer et lancer. */
const ACTION = 60;

/** Pastille de réglage : sélectionnée en accent, sinon en surface haute. */
function Pastille({
  selectionne,
  onClick,
  children,
}: {
  selectionne: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selectionne}
      className="rounded-xl px-4 text-sm font-semibold"
      style={{
        minHeight: CIBLE,
        background: selectionne ? 'var(--accent)' : 'var(--surface-haute)',
        color: selectionne ? 'var(--accent-texte)' : 'var(--texte)',
        border: `1px solid ${selectionne ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      {children}
    </button>
  );
}

/** Choix pleine largeur avec une explication : tempo, guide visuel. */
function Choix({
  selectionne,
  onClick,
  nom,
  description,
}: {
  selectionne: boolean;
  onClick: () => void;
  nom: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selectionne}
      className="w-full rounded-xl px-4 py-2 text-left"
      style={{
        minHeight: CIBLE,
        background: selectionne ? 'var(--accent)' : 'var(--surface-haute)',
        color: selectionne ? 'var(--accent-texte)' : 'var(--texte)',
        border: `1px solid ${selectionne ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      <span className="block text-sm font-semibold">{nom}</span>
      <span
        className="block text-xs"
        style={selectionne ? { opacity: 0.85 } : { color: 'var(--texte-discret)' }}
      >
        {description}
      </span>
    </button>
  );
}

/** Interrupteur pleine largeur : matériel possédé, mouvements explosifs. */
function Bascule({
  actif,
  onClick,
  nom,
  precision,
}: {
  actif: boolean;
  onClick: () => void;
  nom: string;
  precision?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left"
      style={{
        minHeight: CIBLE,
        background: 'var(--surface-haute)',
        color: 'var(--texte)',
        border: `1px solid ${actif ? 'var(--accent)' : 'var(--bordure)'}`,
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center text-xs font-bold"
        style={{
          borderRadius: 7,
          background: actif ? 'var(--accent)' : 'transparent',
          color: 'var(--accent-texte)',
          border: `1px solid ${actif ? 'var(--accent)' : 'var(--bordure)'}`,
        }}
      >
        {actif ? '✓' : ''}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{nom}</span>
        {precision && (
          <span className="block text-xs" style={{ color: 'var(--texte-discret)' }}>
            {precision}
          </span>
        )}
      </span>
    </button>
  );
}

/** Bloc de réglage de la feuille : un titre, des pastilles, une explication. */
function Groupe({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold" style={{ color: 'var(--texte)' }}>
        {titre}
      </p>
      {children}
      {aide && (
        <p className="mt-2 text-xs" style={{ color: 'var(--texte-discret)' }}>
          {aide}
        </p>
      )}
    </div>
  );
}

/** Pastille de résumé (non cliquable) de la carte « Ma séance ». */
function Resume({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
      style={{
        background: accent ? 'var(--accent)' : 'var(--surface-haute)',
        color: accent ? 'var(--accent-texte)' : 'var(--texte)',
      }}
    >
      {children}
    </span>
  );
}

/** Une ligne du décompte du temps, avec sa barre proportionnelle. */
function LigneBudget({
  libelle,
  secondes,
  totalSec,
  couleur,
}: {
  libelle: string;
  secondes: number;
  totalSec: number;
  couleur: string;
}) {
  if (secondes <= 0) return null;
  const part = totalSec > 0 ? (secondes / totalSec) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-xs" style={{ color: 'var(--texte-discret)' }}>
        {libelle}
      </span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}>
        <span className="block h-full rounded-full" style={{ width: `${part}%`, background: couleur }} />
      </span>
      <span className="chiffres w-16 shrink-0 text-right text-xs" style={{ color: 'var(--texte)' }}>
        {formaterDuree(secondes)}
      </span>
    </div>
  );
}

/** « Pourquoi cette durée ? » : où passent les minutes demandées. Au tempo
 *  5 s / 5 s, une série de 8 répétitions dure 80 secondes — deux fois plus
 *  si l'exercice se fait un côté après l'autre. C'est l'arithmétique qui
 *  explique qu'une séance de 20 minutes ne contienne que deux exercices. */
function BudgetSeance({ analyse, exemple }: { analyse: AnalyseSeance; exemple: string | null }) {
  return (
    <details className="mt-3">
      <summary
        className="flex cursor-pointer select-none items-center text-sm font-medium"
        style={{ color: 'var(--texte-discret)', minHeight: CIBLE, listStyle: 'none' }}
      >
        Pourquoi cette durée ?
      </summary>
      <div className="space-y-2 pb-1">
        <LigneBudget
          libelle="Échauffement"
          secondes={analyse.echauffementSec}
          totalSec={analyse.totalSec}
          couleur="var(--pause)"
        />
        <LigneBudget
          libelle="Mise en place"
          secondes={analyse.preparationSec}
          totalSec={analyse.totalSec}
          couleur="var(--texte-discret)"
        />
        <LigneBudget
          libelle={`Travail · ${analyse.nombreSeries} séries`}
          secondes={analyse.travailSec}
          totalSec={analyse.totalSec}
          couleur="var(--montee)"
        />
        <LigneBudget
          libelle="Repos"
          secondes={analyse.reposSec}
          totalSec={analyse.totalSec}
          couleur="var(--descente)"
        />
        <LigneBudget
          libelle="Retour au calme"
          secondes={analyse.retourCalmeSec}
          totalSec={analyse.totalSec}
          couleur="var(--accent)"
        />
        {exemple && (
          <p className="pt-1 text-xs" style={{ color: 'var(--texte-discret)' }}>
            {exemple}
          </p>
        )}
        {analyse.ajustements.map((texte) => (
          <p key={texte} className="text-xs" style={{ color: 'var(--texte-discret)' }}>
            · {texte}
          </p>
        ))}
      </div>
    </details>
  );
}

/** Petite étiquette : zone travaillée, schéma de mouvement. */
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

export default function Entrainement({ etat, onChange }: EntrainementProps) {
  const [seanceActive, setSeanceActive] = useState<SeanceActive | null>(null);
  const [erreurGeneration, setErreurGeneration] = useState<string | null>(null);
  const [messageRemplacement, setMessageRemplacement] = useState<Record<string, string>>({});
  const [vue, setVue] = useState<Vue>('seance');
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  const { parametres, seanceCourante, enCours, historique } = etat;

  const mettreAJourParametres = (partiel: Partial<ParametresSeance>) => {
    onChange((prec) => ({ ...prec, parametres: { ...prec.parametres, ...partiel } }));
  };

  const materielsChoisis: Materiel[] =
    parametres.materiels && parametres.materiels.length > 0 ? parametres.materiels : ['halteres'];
  const basculerMateriel = (materiel: Materiel) => {
    const suivant = materielsChoisis.includes(materiel)
      ? materielsChoisis.filter((m) => m !== materiel)
      : [...materielsChoisis, materiel];
    // Au moins un matériel : sans rien, la bibliothèque actuelle est vide.
    mettreAJourParametres({ materiels: suivant.length > 0 ? suivant : ['halteres'] });
  };
  const nbExercicesDisponibles = useMemo(
    () => exercicesDisponibles(parametres).length,
    [parametres],
  );

  const toutesZones = parametres.zones.length >= TOUTES_LES_ZONES.length;
  const basculerZone = (zone: Zone) => {
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
  const uniteSelectionnee = UNITES_POIDS.find((u) => u.id === uniteDeSeance(parametres));
  const tailleSelectionnee = TAILLES_ROTATION.find((t) => t.valeur === parametres.tailleRotation);

  // Résumés de la carte « Ma séance ».
  const resumeVolume =
    parametres.seriesParExercice && parametres.repsParSerie
      ? `${parametres.seriesParExercice} × ${parametres.repsParSerie}`
      : parametres.seriesParExercice
        ? `${parametres.seriesParExercice} séries · reps auto`
        : parametres.repsParSerie
          ? `séries auto · ${parametres.repsParSerie} reps`
          : 'séries et reps auto';
  const resumeTempo = `${parametres.tempo.monteeSec} s / ${parametres.tempo.descenteSec} s`;
  const resumeMateriel =
    MATERIELS_DECLARABLES.filter((m) => materielsChoisis.includes(m.id))
      .map((m) => m.nom)
      .join(' · ') || 'Sans matériel';

  // La feuille de réglages se ferme avec Échap et bloque le défilement de la
  // page derrière elle ; la position de lecture est restaurée à la fermeture.
  useEffect(() => {
    if (!reglagesOuverts) return;
    const surEchap = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setReglagesOuverts(false);
    };
    window.addEventListener('keydown', surEchap);
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', surEchap);
      document.body.style.overflow = overflowPrecedent;
    };
  }, [reglagesOuverts]);

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

  const nbExercicesSeance = seanceCourante
    ? seanceCourante.blocs.length + (seanceCourante.circuit?.stations.length ?? 0)
    : 0;

  const analyse = useMemo(
    () => (seanceCourante ? analyserSeance(seanceCourante) : null),
    [seanceCourante],
  );

  /** Une ligne concrète pour rendre le tempo palpable : c'est elle qui
   *  explique tout le reste du budget. */
  const exempleTempo = useMemo(() => {
    const bloc = seanceCourante?.blocs.find(
      (b) => EXERCICES_PAR_ID[b.exerciceId]?.unite === 'reps',
    );
    if (!bloc || !seanceCourante) return null;
    const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
    const { monteeSec, descenteSec } = seanceCourante.parametres.tempo;
    const duree = formaterDuree(dureeSerieDuBloc(bloc, seanceCourante.parametres.tempo));
    const cotes = exercice.cotes === 'unilateral' ? ', droite puis gauche' : '';
    return `Une série de ${bloc.reps} répétitions à ${monteeSec} s / ${descenteSec} s${cotes} dure ${duree}.`;
  }, [seanceCourante]);

  /** Combien de fois chaque exercice a déjà été fait, par fenêtre glissante.
   *  Les charges d'un historique antérieur au réglage d'unité sont converties. */
  const frequences = useMemo(
    () => frequencesParExercice(historique, uniteDeSeance(parametres)),
    [historique, parametres],
  );

  /** Étiquette « 2× ce mois-ci », ou rien si l'exercice est nouveau. */
  const badgeFrequence = (exerciceId: string): string | null => {
    const frequence: FrequenceExercice | undefined = frequences.get(exerciceId);
    return frequence && frequence.total > 0 ? libelleFrequenceCourte(frequence) : null;
  };

  /* ------------------------------------------------ La feuille de réglages */
  const feuilleReglages = (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-end"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={() => setReglagesOuverts(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Réglages de la séance"
        className="w-full max-w-3xl overflow-y-auto"
        style={{
          maxHeight: '88vh',
          background: 'var(--surface)',
          borderTop: '1px solid var(--bordure)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        }}
        onClick={(evenement) => evenement.stopPropagation()}
      >
        <div className="sticky top-0 z-10 px-4 pb-3 pt-2" style={{ background: 'var(--surface)' }}>
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1.5 w-10 rounded-full"
            style={{ background: 'var(--texte-discret)', opacity: 0.5 }}
          />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--texte)' }}>
              Réglages
            </h2>
            <button
              type="button"
              onClick={() => setReglagesOuverts(false)}
              className="rounded-xl px-5 text-sm font-bold"
              style={{
                minHeight: CIBLE,
                background: 'var(--accent)',
                color: 'var(--accent-texte)',
              }}
            >
              Terminé
            </button>
          </div>
        </div>

        <div className="space-y-5 px-4">
          <Groupe titre="Durée">
            <div className="flex flex-wrap gap-2">
              {DUREES_MINUTES.map((duree) => (
                <Pastille
                  key={duree}
                  selectionne={parametres.dureeMinutes === duree}
                  onClick={() => mettreAJourParametres({ dureeMinutes: duree })}
                >
                  <span className="chiffres">{duree} min</span>
                </Pastille>
              ))}
            </div>
          </Groupe>

          <Groupe titre="Zones travaillées" aide={descriptionZones}>
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
          </Groupe>

          <Groupe
            titre="Séries par exercice"
            aide={
              SERIES_PAR_EXERCICE.find((o) => o.valeur === parametres.seriesParExercice)?.description
            }
          >
            <div className="flex flex-wrap gap-2">
              {SERIES_PAR_EXERCICE.map((option) => (
                <Pastille
                  key={String(option.valeur)}
                  selectionne={parametres.seriesParExercice === option.valeur}
                  onClick={() => mettreAJourParametres({ seriesParExercice: option.valeur })}
                >
                  <span className="chiffres">{option.nom}</span>
                </Pastille>
              ))}
            </div>
          </Groupe>

          <Groupe
            titre="Répétitions par série"
            aide={REPS_PAR_SERIE.find((o) => o.valeur === parametres.repsParSerie)?.description}
          >
            <div className="flex flex-wrap gap-2">
              {REPS_PAR_SERIE.map((option) => (
                <Pastille
                  key={String(option.valeur)}
                  selectionne={parametres.repsParSerie === option.valeur}
                  onClick={() => mettreAJourParametres({ repsParSerie: option.valeur })}
                >
                  <span className="chiffres">{option.nom}</span>
                </Pastille>
              ))}
            </div>
          </Groupe>

          <Groupe titre="Tempo">
            <div className="space-y-2">
              {TEMPOS.map((t) => (
                <Choix
                  key={t.nom}
                  selectionne={
                    parametres.tempo.monteeSec === t.tempo.monteeSec &&
                    parametres.tempo.descenteSec === t.tempo.descenteSec
                  }
                  onClick={() => mettreAJourParametres({ tempo: t.tempo })}
                  nom={t.nom}
                  description={t.description}
                />
              ))}
            </div>
          </Groupe>

          <Groupe titre="Guide visuel pendant la série">
            <div className="space-y-2">
              {GUIDES_VISUELS.map((guide) => (
                <Choix
                  key={guide.id}
                  selectionne={parametres.guideVisuel === guide.id}
                  onClick={() => mettreAJourParametres({ guideVisuel: guide.id })}
                  nom={guide.nom}
                  description={guide.description}
                />
              ))}
            </div>
          </Groupe>

          {/* Le format reste au premier plan : au tempo lent, c'est lui qui
              décide combien d'exercices tiennent dans la durée demandée. */}
          <Groupe titre="Format" aide={formatSelectionne?.description}>
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
          </Groupe>

          {parametres.format === 'superset' && (
            <Groupe titre="Exercices par enchaînement" aide={tailleSelectionnee?.description}>
              <div className="flex flex-wrap gap-2">
                {TAILLES_ROTATION.map((t) => (
                  <Pastille
                    key={t.nom}
                    selectionne={parametres.tailleRotation === t.valeur}
                    onClick={() => mettreAJourParametres({ tailleRotation: t.valeur })}
                  >
                    {t.nom}
                  </Pastille>
                ))}
              </div>
            </Groupe>
          )}

          <Groupe titre="Unité des charges" aide={uniteSelectionnee?.description}>
            <div className="flex flex-wrap gap-2">
              {UNITES_POIDS.map((u) => (
                <Pastille
                  key={u.id}
                  selectionne={uniteDeSeance(parametres) === u.id}
                  onClick={() => mettreAJourParametres({ unitePoids: u.id })}
                >
                  {u.nom}
                </Pastille>
              ))}
            </div>
          </Groupe>

          <details>
            <summary
              className="flex cursor-pointer select-none items-center text-sm font-bold"
              style={{ color: 'var(--texte-discret)', minHeight: CIBLE, listStyle: 'none' }}
            >
              Réglages avancés
            </summary>

            <div className="space-y-5 pb-2">
              <Groupe titre="Niveau" aide={niveauSelectionne?.description}>
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
              </Groupe>

              <Groupe
                titre="Mon matériel"
                aide={`${nbExercicesDisponibles} exercices disponibles avec ce matériel.`}
              >
                <div className="space-y-2">
                  {MATERIELS_DECLARABLES.map((m) => (
                    <Bascule
                      key={m.id}
                      actif={materielsChoisis.includes(m.id)}
                      onClick={() => basculerMateriel(m.id)}
                      nom={m.nom}
                      precision={m.precision}
                    />
                  ))}
                </div>
              </Groupe>

              <Groupe titre="Options">
                <Bascule
                  actif={parametres.explosifs}
                  onClick={() => mettreAJourParametres({ explosifs: !parametres.explosifs })}
                  nom="Mouvements explosifs"
                  precision="Squat sauté, swing : incompatibles avec le tempo lent."
                />
              </Groupe>
            </div>
          </details>

          <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
            Réglages et historique sont sauvegardés sur cet appareil.
          </p>
        </div>
      </div>
    </div>
  );

  /* ------------------------------------------------------ L'écran d'accueil */
  const accueil = (
    <div className="space-y-3">
      {enCours && (
        <div
          className="p-3"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--pause)',
            borderRadius: 14,
          }}
        >
          <p className="text-sm" style={{ color: 'var(--texte)' }}>
            Séance interrompue le{' '}
            <span className="chiffres">
              {formaterDateFr(enCours.sauvegardeeLe ?? enCours.demarreeLe)}
            </span>
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={reprendreSeance}
              className="flex-1 rounded-xl px-4 text-sm font-bold"
              style={{ minHeight: CIBLE, background: 'var(--montee)', color: 'var(--accent-texte)' }}
            >
              Reprendre
            </button>
            <button
              type="button"
              onClick={abandonnerSeance}
              className="rounded-xl px-4 text-sm font-semibold"
              style={{
                minHeight: CIBLE,
                background: 'var(--surface-haute)',
                border: '1px solid var(--bordure)',
                color: 'var(--texte)',
              }}
            >
              Abandonner
            </button>
          </div>
        </div>
      )}

      {/* 1. Ma séance : les réglages courants, en un coup d'œil. */}
      <section
        className="p-4"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--bordure)',
          borderRadius: 16,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--texte)' }}>
            Ma séance
          </h2>
          <button
            type="button"
            onClick={() => setReglagesOuverts(true)}
            className="rounded-xl px-4 text-sm font-semibold"
            style={{
              minHeight: CIBLE,
              background: 'var(--surface-haute)',
              border: '1px solid var(--bordure)',
              color: 'var(--texte)',
            }}
          >
            Modifier
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Resume accent>
            <span className="chiffres">{parametres.dureeMinutes} min</span>
          </Resume>
          <Resume>{libelleZones(parametres)}</Resume>
          <Resume>
            <span className="chiffres">{resumeVolume}</span>
          </Resume>
          <Resume>
            <span className="chiffres">{resumeTempo}</span>
          </Resume>
          <Resume>{formatSelectionne?.nom}</Resume>
          <Resume>{resumeMateriel}</Resume>
        </div>

        <p className="mt-3 text-xs" style={{ color: 'var(--texte-discret)' }}>
          <span className="chiffres">{nbExercicesDisponibles}</span> exercices disponibles ·{' '}
          {niveauSelectionne?.nom.toLowerCase()}
        </p>
      </section>

      {/* 2. L'action principale, toujours visible sans défiler. */}
      <button
        type="button"
        onClick={() => genererNouvelleSeance()}
        className="w-full font-bold"
        style={{
          height: ACTION,
          borderRadius: 16,
          background: 'var(--accent)',
          color: 'var(--accent-texte)',
          fontSize: 17,
        }}
      >
        Générer la séance
      </button>

      {erreurGeneration && (
        <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--alerte)' }}>
          {erreurGeneration}
        </p>
      )}

      {/* 3. Les deux écrans secondaires, derrière un bouton chacun. */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setVue('historique')}
          className="rounded-xl px-3 text-sm font-semibold"
          style={{
            minHeight: CIBLE,
            background: 'var(--surface)',
            border: '1px solid var(--bordure)',
            color: 'var(--texte)',
          }}
        >
          Historique{' '}
          <span className="chiffres" style={{ color: 'var(--texte-discret)' }}>
            {historique.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setVue('bibliotheque')}
          className="rounded-xl px-3 text-sm font-semibold"
          style={{
            minHeight: CIBLE,
            background: 'var(--surface)',
            border: '1px solid var(--bordure)',
            color: 'var(--texte)',
          }}
        >
          Bibliothèque
        </button>
      </div>

      {/* 4. La séance proposée. */}
      {seanceCourante && (
        <section
          className="p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--bordure)',
            borderRadius: 16,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ color: 'var(--texte)' }}>
              Séance proposée
            </h2>
            <button
              type="button"
              onClick={() => genererNouvelleSeance(graineAleatoire())}
              className="rounded-xl px-4 text-sm font-semibold"
              style={{
                minHeight: CIBLE,
                background: 'var(--surface-haute)',
                border: '1px solid var(--bordure)',
                color: 'var(--texte)',
              }}
            >
              Regénérer
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Resume accent>
              <span className="chiffres">{formaterDuree(seanceCourante.dureeEstimeeSec)}</span>
            </Resume>
            <Resume>
              <span className="chiffres">{nbExercicesSeance}</span>
              &nbsp;exercices
            </Resume>
            <Resume>
              Tempo&nbsp;
              <span className="chiffres">
                {seanceCourante.parametres.tempo.monteeSec} s /{' '}
                {seanceCourante.parametres.tempo.descenteSec} s
              </span>
            </Resume>
          </div>
          {analyse && <BudgetSeance analyse={analyse} exemple={exempleTempo} />}

          {seanceCourante.blocs.length > 0 && (
            <ul className="mt-3 space-y-2">
              {seanceCourante.blocs.map((bloc) => {
                const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
                if (!exercice) return null;
                return (
                  <li
                    key={bloc.exerciceId}
                    className="p-3"
                    style={{ background: 'var(--surface-haute)', borderRadius: 14 }}
                  >
                    <FicheExercice exercice={exercice} taille="petite">
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge>{NOM_ZONE[exercice.zone]}</Badge>
                        <Badge>{NOM_PATTERN[exercice.pattern]}</Badge>
                        {bloc.superset !== undefined && (
                          <Badge>enchaînement {bloc.superset + 1}</Badge>
                        )}
                        {badgeFrequence(exercice.id) && <Badge>{badgeFrequence(exercice.id)}</Badge>}
                      </div>
                      <p className="chiffres mt-1 text-sm" style={{ color: 'var(--texte)' }}>
                        {libelleBloc(bloc, exercice)}
                      </p>
                    </FicheExercice>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => remplacerDansSeance(bloc.exerciceId)}
                        className="rounded-xl px-4 text-sm font-semibold"
                        style={{
                          minHeight: CIBLE,
                          background: 'var(--surface)',
                          border: '1px solid var(--bordure)',
                          color: 'var(--texte)',
                        }}
                      >
                        Remplacer
                      </button>
                      {messageRemplacement[bloc.exerciceId] && (
                        <span className="text-xs" style={{ color: 'var(--texte-discret)' }}>
                          {messageRemplacement[bloc.exerciceId]}
                        </span>
                      )}
                    </div>

                    <details>
                      <summary
                        className="flex cursor-pointer select-none items-center text-sm"
                        style={{
                          color: 'var(--texte-discret)',
                          minHeight: CIBLE,
                          listStyle: 'none',
                        }}
                      >
                        Points d'attention
                      </summary>
                      <ul
                        className="ml-4 list-disc space-y-0.5 pb-1 text-sm"
                        style={{ color: 'var(--texte-discret)' }}
                      >
                        {exercice.pointsAttention.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                        {exercice.interetJjb && (
                          <li style={{ color: 'var(--accent)' }}>{exercice.interetJjb}</li>
                        )}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}

          {seanceCourante.circuit && (
            <div className="mt-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--texte)' }}>
                Circuit
              </h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
                <span className="chiffres">{seanceCourante.circuit.tours}</span> tours ·{' '}
                <span className="chiffres">{seanceCourante.circuit.travailSec} s</span> de travail /{' '}
                <span className="chiffres">{seanceCourante.circuit.reposSec} s</span> de repos
              </p>
              <ul className="mt-2 space-y-2">
                {seanceCourante.circuit.stations.map((exerciceId, index) => {
                  const exercice = EXERCICES_PAR_ID[exerciceId];
                  if (!exercice) return null;
                  return (
                    <li
                      key={`${exerciceId}-${index}`}
                      className="p-3"
                      style={{ background: 'var(--surface-haute)', borderRadius: 14 }}
                    >
                      <FicheExercice exercice={exercice} taille="petite">
                        <p
                          className="chiffres text-xs font-semibold"
                          style={{ color: 'var(--texte-discret)' }}
                        >
                          Station {index + 1}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge>{NOM_ZONE[exercice.zone]}</Badge>
                          <Badge>{NOM_PATTERN[exercice.pattern]}</Badge>
                        </div>
                      </FicheExercice>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 5. L'action de départ, collée en bas : jamais besoin de défiler. */}
      {seanceCourante && (
        <div
          className="sticky bottom-0 z-30 -mx-4 px-4 pt-3"
          style={{
            background: 'var(--fond)',
            borderTop: '1px solid var(--bordure)',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          }}
        >
          <button
            type="button"
            onClick={lancerSeance}
            className="w-full font-bold"
            style={{
              height: ACTION,
              borderRadius: 16,
              background: 'var(--montee)',
              color: 'var(--accent-texte)',
              fontSize: 17,
            }}
          >
            Lancer la séance
          </button>
        </div>
      )}
    </div>
  );

  /* ------------------------------------------------------------- Le rendu */
  return (
    <div>
      {vue === 'seance' ? (
        accueil
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setVue('seance')}
            className="rounded-xl px-4 text-sm font-semibold"
            style={{
              minHeight: CIBLE,
              background: 'var(--surface)',
              border: '1px solid var(--bordure)',
              color: 'var(--texte)',
            }}
          >
            ← Ma séance
          </button>
          {vue === 'historique' ? (
            <HistoriqueEntrainement historique={historique} onSupprimer={supprimerDeLHistorique} />
          ) : (
            <BibliothequeExercices historique={historique} unitePoids={uniteDeSeance(parametres)} />
          )}
        </div>
      )}

      {reglagesOuverts && createPortal(feuilleReglages, document.body)}

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
    </div>
  );
}
