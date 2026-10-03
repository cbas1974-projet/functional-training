// L'accueil : le programme du mois, et la séance du jour prête à commencer.
// L'application a choisi les exercices dans les posters à partir des
// objectifs ; chacun suit la séance sur son téléphone, avec ses séries et ses
// charges. La séance libre, l'historique et les exercices sont à un bouton.
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  BlocSeries,
  EntrainementState,
  Exercice,
  ParametresSeance,
  Personne,
  ProgressionSeance,
  ProgrammeMois,
  Seance,
  SeanceDuMois,
  UnitePoids,
} from '../types';
import { EXERCICES_PAR_ID, NOM_MUSCLE } from '../data/exercices';
import { GUIDES_VISUELS, REPS_PAR_SERIE, TEMPOS, UNITES_POIDS } from '../data/parametres';
import { OBJECTIFS_MUSCULAIRES } from '../utils/muscles';
import { formaterDuree } from '../utils/generateurSeance';
import { formaterDateFr, graineAleatoire, memeTempo } from '../utils/formatage';
import { SUFFIXE_UNITE, uniteDeSeance } from '../utils/statistiques';
import { bellSound } from '../utils/sounds';
import {
  JOURS,
  NOM_PERSONNE,
  PERSONNES,
  REPOS_SEC,
  TAILLE_ENCHAINEMENT,
  alternatives,
  autrePersonne,
  chargesPassees,
  depuisIso,
  faiteCetteSemaine,
  faiteLe,
  genererProgramme,
  lienDePartage,
  programmeDansLien,
  remplacerDansProgramme,
  seanceAProposer,
  seancePourPersonne,
  semaineDe,
  semainesEcoulees,
  seriesDuJour,
} from '../utils/programmeMois';
import FicheExercice from './FicheExercice';
import SeanceGuidee from './SeanceGuidee';
import { Bascule, CIBLE, Choix, Feuille, Groupe, Pastille } from './Feuille';

/** Les écrans qu'on ouvre depuis l'accueil. */
export type VueSecondaire = 'historique' | 'exercices' | 'libre';

interface AccueilProps {
  etat: EntrainementState;
  programme: ProgrammeMois;
  /** Forme « updater » pour éviter d'écraser un changement concurrent. */
  onChange: (miseAJour: (prec: EntrainementState) => EntrainementState) => void;
  /** Programme arrivé par un lien, en attente d'une réponse. */
  programmeRecu: ProgrammeMois | null;
  onReponseProgrammeRecu: (accepte: boolean) => void;
  onOuvrir: (vue: VueSecondaire) => void;
}

/** Séance déroulée en plein écran. */
interface SeanceActive {
  seance: Seance;
  progression: ProgressionSeance | null;
  demarrage: 'debut' | 'reprise';
}

type FeuilleOuverte =
  | null
  | { type: 'reglages' }
  | { type: 'objectifs' }
  | { type: 'changer'; seanceId: string; exerciceId: string };

/** Hauteur de l'action principale : commencer. */
const ACTION = 60;
/** Un programme du mois dure quatre semaines ; ensuite on le refait. */
const SEMAINES_PAR_MOIS = 4;
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const CARTE = {
  background: 'var(--surface)',
  border: '1px solid var(--bordure)',
  borderRadius: 16,
} as const;

const SECONDAIRE = {
  minHeight: CIBLE,
  background: 'var(--surface-haute)',
  border: '1px solid var(--bordure)',
  color: 'var(--texte)',
} as const;

/** « Mar A » : le nom court d'une séance, pour les pastilles de la semaine. */
const nomCourt = (seance: SeanceDuMois) =>
  `${JOURS_COURTS[seance.jour]}${seance.semaine ? ` ${seance.semaine}` : ''}`;

/** « lundi 5 octobre ». */
const dateLongue = (date: Date) =>
  date.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });

const musclesCibles = (exercice: Exercice) =>
  (exercice.musclesPrincipaux ?? []).map((muscle) => NOM_MUSCLE[muscle]).join(', ');

/** « 3 × 8 », « 2 × 8 par côté », « 3 × 30 s ». */
function volume(bloc: BlocSeries, exercice: Exercice): string {
  const repetitions = exercice.unite === 'secondes' ? `${bloc.reps} s` : `${bloc.reps}`;
  const cotes =
    exercice.cotes === 'unilateral' ? ' par côté' : exercice.cotes === 'alterne' ? ' en alternant' : '';
  return `${bloc.series} × ${repetitions}${cotes}`;
}

/** Bandeau d'une question ou d'un rappel, en haut de l'accueil. */
function Bandeau({ couleur, children }: { couleur: string; children: ReactNode }) {
  return (
    <div className="p-3" style={{ background: 'var(--surface)', border: `1px solid ${couleur}`, borderRadius: 14 }}>
      {children}
    </div>
  );
}

function BoutonSecondaire({
  onClick,
  children,
  className = 'px-3',
}: {
  onClick: () => void;
  children: ReactNode;
  /** Marges intérieures et mise en page. */
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl text-sm font-semibold ${className}`} style={SECONDAIRE}>
      {children}
    </button>
  );
}

/** Un exercice de la séance : l'image du poster, les muscles, le volume du
 *  jour, les charges de la dernière fois. */
function LigneExercice({
  bloc,
  exercice,
  passees,
  unite,
  onChanger,
}: {
  bloc: BlocSeries;
  exercice: Exercice;
  passees: number[] | undefined;
  unite: UnitePoids;
  onChanger: () => void;
}) {
  return (
    <li className="p-3" style={{ background: 'var(--surface-haute)', borderRadius: 14 }}>
      <FicheExercice exercice={exercice} taille="petite">
        <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
          {musclesCibles(exercice)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="chiffres text-base font-bold" style={{ color: 'var(--texte)' }}>
            {volume(bloc, exercice)}
          </p>
          <button
            type="button"
            onClick={onChanger}
            className="shrink-0 rounded-xl px-2 text-sm font-semibold"
            style={{ minHeight: 40, background: 'transparent', color: 'var(--accent)' }}
          >
            Changer
          </button>
        </div>
        {passees && passees.some((charge) => charge > 0) && (
          <p className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
            Dernière fois : {passees.map((charge) => (charge > 0 ? charge : '—')).join(' · ')}{' '}
            {SUFFIXE_UNITE[unite]}
          </p>
        )}
      </FicheExercice>
    </li>
  );
}

/** Les réglages de la personne : qui s'entraîne, séries, répétitions, tempo. */
function FeuilleReglages({
  personne,
  parametres,
  onPersonne,
  onParametres,
  onObjectifs,
  onRefaire,
  onRecevoir,
  onFermer,
}: {
  personne: Personne | null;
  parametres: ParametresSeance;
  onPersonne: (personne: Personne) => void;
  onParametres: (partiel: Partial<ParametresSeance>) => void;
  onObjectifs: () => void;
  onRefaire: () => void;
  onRecevoir: (texte: string) => boolean;
  onFermer: () => void;
}) {
  const seriesLundi = parametres.seriesParExercice ?? 3;
  const seriesFaciles = seriesDuJour({ type: 'facile' }, parametres);
  const reps = REPS_PAR_SERIE.filter((option) => option.valeur !== null && option.valeur !== 9);
  return (
    <Feuille titre="Réglages" onFermer={onFermer}>
      <Groupe titre="Qui s’entraîne sur ce téléphone ?" aide="Chacun ses séries et ses charges, sur son téléphone.">
        <div className="flex flex-wrap gap-2">
          {PERSONNES.map((p) => (
            <Pastille key={p.id} selectionne={personne === p.id} onClick={() => onPersonne(p.id)}>
              {p.nom}
            </Pastille>
          ))}
        </div>
      </Groupe>

      <Groupe titre="Séries le lundi" aide="La séance dure : pas de jiu-jitsu le soir.">
        <div className="flex flex-wrap gap-2">
          {([2, 3, 4] as const).map((n) => (
            <Pastille key={n} selectionne={seriesLundi === n} onClick={() => onParametres({ seriesParExercice: n })}>
              <span className="chiffres">{n}</span>
            </Pastille>
          ))}
        </div>
      </Groupe>

      <Groupe titre="Séries mardi et jeudi" aide="Jiu-jitsu le soir : Sébastien en fait une de moins que Max.">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Pastille key={n} selectionne={seriesFaciles === n} onClick={() => onParametres({ seriesJourFacile: n })}>
              <span className="chiffres">{n}</span>
            </Pastille>
          ))}
        </div>
      </Groupe>

      <Groupe
        titre="Répétitions par série"
        aide={REPS_PAR_SERIE.find((option) => option.valeur === parametres.repsParSerie)?.description}
      >
        <div className="flex flex-wrap gap-2">
          {reps.map((option) => (
            <Pastille
              key={String(option.valeur)}
              selectionne={parametres.repsParSerie === option.valeur}
              onClick={() => onParametres({ repsParSerie: option.valeur })}
            >
              <span className="chiffres">{option.valeur}</span>
            </Pastille>
          ))}
        </div>
      </Groupe>

      <Groupe titre="Unité des charges">
        <div className="flex flex-wrap gap-2">
          {UNITES_POIDS.map((u) => (
            <Pastille
              key={u.id}
              selectionne={uniteDeSeance(parametres) === u.id}
              onClick={() => onParametres({ unitePoids: u.id })}
            >
              {u.nom}
            </Pastille>
          ))}
        </div>
      </Groupe>

      <Groupe titre="Le programme" aide="Les exercices changent ; l’historique et les charges restent.">
        <div className="grid grid-cols-2 gap-2">
          <BoutonSecondaire onClick={onObjectifs}>Objectifs</BoutonSecondaire>
          <BoutonSecondaire onClick={onRefaire}>Refaire</BoutonSecondaire>
        </div>
      </Groupe>

      <RecevoirParLien onRecevoir={onRecevoir} />

      <details>
        <summary
          className="flex cursor-pointer select-none items-center text-sm font-bold"
          style={{ color: 'var(--texte-discret)', minHeight: CIBLE, listStyle: 'none' }}
        >
          Tempo et affichage
        </summary>
        <div className="space-y-5 pb-2">
          <Groupe titre="Tempo">
            <div className="space-y-2">
              {TEMPOS.map((t) => (
                <Choix
                  key={t.nom}
                  selectionne={memeTempo(parametres.tempo, t.tempo)}
                  onClick={() => onParametres({ tempo: t.tempo })}
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
                  onClick={() => onParametres({ guideVisuel: guide.id })}
                  nom={guide.nom}
                  description={guide.description}
                />
              ))}
            </div>
          </Groupe>
        </div>
      </details>

      <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
        Réglages, programme et historique restent sur ce téléphone.
      </p>
    </Feuille>
  );
}

/** Recevoir un programme en collant le lien : une application installée sur
 *  l'écran d'accueil d'un iPhone ne s'ouvre pas sur les liens des messages,
 *  qui partent dans Safari. */
function RecevoirParLien({ onRecevoir }: { onRecevoir: (texte: string) => boolean }) {
  const [texte, setTexte] = useState('');
  const [illisible, setIllisible] = useState(false);
  return (
    <Groupe titre="Programme reçu par message" aide="Collez ici le lien reçu, s’il ne s’ouvre pas dans l’application.">
      <div className="flex gap-2">
        <input
          value={texte}
          onChange={(evenement) => {
            setTexte(evenement.target.value);
            setIllisible(false);
          }}
          placeholder="Coller le lien"
          aria-label="Lien du programme reçu"
          className="min-w-0 flex-1 rounded-xl px-3 text-sm"
          style={{ ...SECONDAIRE, background: 'var(--surface-haute)' }}
        />
        <button
          type="button"
          disabled={texte.trim() === ''}
          onClick={() => {
            if (!onRecevoir(texte)) setIllisible(true);
          }}
          className="shrink-0 rounded-xl px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: CIBLE, background: 'var(--accent)', color: 'var(--accent-texte)' }}
        >
          Prendre
        </button>
      </div>
      {illisible && (
        <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: 'var(--alerte)' }}>
          Ce lien ne contient pas de programme.
        </p>
      )}
    </Groupe>
  );
}

/** Les objectifs : les muscles autour desquels l'application compose le
 *  programme. */
function FeuilleObjectifs({
  objectifs,
  onRefaire,
  onFermer,
}: {
  objectifs: string[];
  onRefaire: (objectifs: string[]) => void;
  onFermer: () => void;
}) {
  const [selection, setSelection] = useState(objectifs);
  const basculer = (id: string) =>
    setSelection((prec) => (prec.includes(id) ? prec.filter((x) => x !== id) : [...prec, id]));
  return (
    <Feuille titre="Objectifs" onFermer={onFermer}>
      <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
        L’application prend dans les posters les exercices qui travaillent ces muscles : lourds le lundi,
        plus légers le mardi et le jeudi.
      </p>
      <div className="space-y-2">
        {OBJECTIFS_MUSCULAIRES.map((objectif) => (
          <Bascule
            key={objectif.id}
            actif={selection.includes(objectif.id)}
            onClick={() => basculer(objectif.id)}
            nom={objectif.nom}
            precision={objectif.description}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onRefaire(OBJECTIFS_MUSCULAIRES.map((o) => o.id).filter((id) => selection.includes(id)))}
        className="w-full font-bold"
        style={{ height: 56, borderRadius: 16, background: 'var(--accent)', color: 'var(--accent-texte)' }}
      >
        Refaire le programme
      </button>
      <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
        Les exercices changent ; l’historique et les charges restent.
      </p>
    </Feuille>
  );
}

/** Remplacer un exercice par un autre des mêmes muscles, images à l'appui. */
function FeuilleChanger({
  programme,
  seanceId,
  exerciceId,
  onChoisir,
  onFermer,
}: {
  programme: ProgrammeMois;
  seanceId: string;
  exerciceId: string;
  onChoisir: (nouveauId: string) => void;
  onFermer: () => void;
}) {
  const actuel = EXERCICES_PAR_ID[exerciceId];
  const seanceMois = programme.seances.find((s) => s.id === seanceId);
  const choix = useMemo(() => alternatives(programme, seanceId, exerciceId), [programme, seanceId, exerciceId]);
  if (!actuel || !seanceMois) return null;
  return (
    <Feuille titre="Changer d’exercice" onFermer={onFermer}>
      <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
        À la place de <strong style={{ color: 'var(--texte)' }}>{actuel.nomFr}</strong> ({musclesCibles(actuel)}),
        pour chaque {seanceMois.nom.toLowerCase().startsWith('lundi') ? 'lundi' : `« ${seanceMois.nom} »`}.
      </p>
      {choix.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          Aucun autre exercice ne travaille ces muscles avec le matériel de la salle.
        </p>
      ) : (
        <ul className="space-y-2">
          {choix.map((exercice) => (
            <li
              key={exercice.id}
              className="p-3"
              style={{ background: 'var(--surface-haute)', borderRadius: 14, border: '1px solid var(--bordure)' }}
            >
              <FicheExercice exercice={exercice} taille="petite" onClick={() => onChoisir(exercice.id)}>
                <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
                  {musclesCibles(exercice)}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  Prendre celui-ci
                </p>
              </FicheExercice>
            </li>
          ))}
        </ul>
      )}
    </Feuille>
  );
}

export default function Accueil({
  etat,
  programme,
  onChange,
  programmeRecu,
  onReponseProgrammeRecu,
  onOuvrir,
}: AccueilProps) {
  const { parametres, historique, enCours } = etat;
  const personne = etat.personne ?? null;
  const unite = uniteDeSeance(parametres);

  /** Séance choisie dans la semaine ; null = celle que propose le calendrier. */
  const [choisie, setChoisie] = useState<string | null>(null);
  const [active, setActive] = useState<SeanceActive | null>(null);
  const [feuille, setFeuille] = useState<FeuilleOuverte>(null);
  const [messagePartage, setMessagePartage] = useState<string | null>(null);
  const [lienACopier, setLienACopier] = useState<string | null>(null);
  const fermerFeuille = useCallback(() => setFeuille(null), []);
  /** L'autre téléphone n'a pas ce programme-ci : premier lancement, ou
   *  programme changé depuis le dernier envoi. Gardé dans la sauvegarde. */
  const aRenvoyer = etat.programmeARenvoyer === true;

  const maintenant = new Date();
  const proposee = seanceAProposer(programme, historique, maintenant);
  const seanceMois =
    programme.seances.find((s) => s.id === choisie) ?? proposee?.seance ?? programme.seances[0];
  const seance = useMemo(() => seancePourPersonne(seanceMois, parametres), [seanceMois, parametres]);
  const passees = useMemo(
    () => chargesPassees(historique, seanceMois.exercices, unite),
    [historique, seanceMois, unite],
  );
  const chargesActives = useMemo(
    () =>
      active
        ? chargesPassees(
            historique,
            active.seance.blocs.map((bloc) => bloc.exerciceId),
            uniteDeSeance(active.seance.parametres),
          )
        : {},
    [active, historique],
  );

  const autre = personne ? NOM_PERSONNE[autrePersonne(personne)] : null;
  const semaineAffichee = semaineDe(programme, proposee?.date ?? maintenant);
  const faiteAujourdhui = programme.seances.find((s) => faiteLe(historique, s, maintenant));
  const horsCalendrier = choisie !== null && choisie !== proposee?.seance.id;

  let surtitre = '';
  if (horsCalendrier) {
    surtitre = `Programme · ${JOURS[seanceMois.jour]}${seanceMois.semaine ? `, semaine ${seanceMois.semaine}` : ''}`;
  } else if (proposee?.dansJours === 0) {
    surtitre = `Aujourd’hui · ${dateLongue(proposee.date)}`;
  } else if (proposee?.dansJours === 1) {
    surtitre = 'Prochaine séance · demain';
  } else if (proposee) {
    surtitre = `Prochaine séance · ${dateLongue(proposee.date)}`;
  }

  const series = seance.blocs[0]?.series ?? 0;
  const enchaine = seanceMois.format === 'enchaine';
  const groupes: BlocSeries[][] = enchaine
    ? seance.blocs.reduce<BlocSeries[][]>((acc, bloc) => {
        (acc[bloc.superset ?? 0] ??= []).push(bloc);
        return acc;
      }, [])
    : [seance.blocs];

  const semaineDuMois = semainesEcoulees(programme, maintenant);
  const objectifs =
    programme.objectifs
      .map((id) => OBJECTIFS_MUSCULAIRES.find((o) => o.id === id)?.nom)
      .filter(Boolean)
      .join(' · ') || 'Tout le corps';

  // ------------------------------------------------ Actions

  const mettreAJourParametres = (partiel: Partial<ParametresSeance>) =>
    onChange((prec) => ({ ...prec, parametres: { ...prec.parametres, ...partiel } }));

  /** Choisir qui s'entraîne ici règle aussi ses séries des jours faciles. */
  const choisirPersonne = (choix: Personne) => {
    const reglage = PERSONNES.find((p) => p.id === choix);
    onChange((prec) => ({
      ...prec,
      personne: choix,
      parametres: { ...prec.parametres, seriesJourFacile: reglage?.seriesJourFacile },
    }));
  };

  const changerProgramme = (nouveau: ProgrammeMois, aRenvoyerEnsuite = true) => {
    onChange((prec) => ({ ...prec, programme: nouveau, programmeARenvoyer: aRenvoyerEnsuite }));
    setChoisie(null);
    setMessagePartage(null);
    setLienACopier(null);
  };

  /** Un lien collé dans les réglages : le programme reçu de l'autre. */
  const recevoir = (texte: string): boolean => {
    const recu = programmeDansLien(texte);
    if (!recu) return false;
    changerProgramme(recu, false);
    setFeuille(null);
    window.scrollTo({ top: 0 });
    return true;
  };

  const refaire = (objectifsChoisis: string[]) => {
    changerProgramme(
      genererProgramme({ objectifs: objectifsChoisis, materiels: programme.materiels, graine: graineAleatoire() }),
    );
    setFeuille(null);
    window.scrollTo({ top: 0 });
  };

  const demanderRefaire = () => {
    if (window.confirm('Refaire le programme ? Les exercices changent ; l’historique reste.')) {
      refaire(programme.objectifs);
    }
  };

  const commencer = () => {
    if (seance.blocs.length === 0) return;
    if (enCours && !window.confirm('Une séance interrompue attend. L’abandonner et commencer celle-ci ?')) return;
    // Geste de l'utilisateur : c'est maintenant qu'on réveille le son.
    bellSound.unlock();
    setActive({ seance: seancePourPersonne(seanceMois, parametres), progression: null, demarrage: 'debut' });
  };

  const reprendre = () => {
    if (!enCours) return;
    bellSound.unlock();
    setActive({ seance: enCours.seance, progression: enCours, demarrage: 'reprise' });
  };

  const partager = async () => {
    const lien = lienDePartage(programme, window.location.href);
    const texte = `Notre programme du mois : ouvre ce lien sur ton téléphone${autre ? `, ${autre}` : ''}.`;
    setLienACopier(null);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Programme du mois', text: texte, url: lien });
        onChange((prec) => ({ ...prec, programmeARenvoyer: false }));
        setMessagePartage(null);
        return;
      } catch (erreur) {
        // Partage annulé : rien à dire. Sinon, on passe par le presse-papiers.
        if (erreur instanceof DOMException && erreur.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(lien);
      onChange((prec) => ({ ...prec, programmeARenvoyer: false }));
      setMessagePartage(`Lien copié : collez-le dans un message${autre ? ` à ${autre}` : ''}.`);
    } catch {
      setMessagePartage('Copiez ce lien et envoyez-le :');
      setLienACopier(lien);
    }
  };

  // ------------------------------------------------ Rendu

  return (
    <>
      <header
        className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold" style={{ color: 'var(--texte)' }}>
            {personne ? NOM_PERSONNE[personne] : 'Mon entraînement'}
          </h1>
          <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
            Programme du mois
          </p>
        </div>
        <BoutonSecondaire onClick={() => setFeuille({ type: 'reglages' })} className="shrink-0 px-4">
          Réglages
        </BoutonSecondaire>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 pb-4">
        {programmeRecu && (
          <Bandeau couleur="var(--accent)">
            <p className="text-sm font-semibold" style={{ color: 'var(--texte)' }}>
              On vous a envoyé un programme.
            </p>
            <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
              Le prendre remplace le vôtre ; l’historique et les charges restent.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onReponseProgrammeRecu(true)}
                className="rounded-xl px-3 text-sm font-bold"
                style={{ minHeight: CIBLE, background: 'var(--accent)', color: 'var(--accent-texte)' }}
              >
                Le prendre
              </button>
              <BoutonSecondaire onClick={() => onReponseProgrammeRecu(false)}>Garder le mien</BoutonSecondaire>
            </div>
          </Bandeau>
        )}

        {!personne && (
          <Bandeau couleur="var(--accent)">
            <p className="text-sm font-semibold" style={{ color: 'var(--texte)' }}>
              Qui s’entraîne sur ce téléphone ?
            </p>
            <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
              Mardi et jeudi, Sébastien fait une série de moins que Max.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PERSONNES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choisirPersonne(p.id)}
                  className="rounded-xl px-3 text-base font-bold"
                  style={{ minHeight: 52, background: 'var(--accent)', color: 'var(--accent-texte)' }}
                >
                  {p.nom}
                </button>
              ))}
            </div>
          </Bandeau>
        )}

        {enCours && !active && (
          <Bandeau couleur="var(--pause)">
            <p className="text-sm" style={{ color: 'var(--texte)' }}>
              {enCours.seance.titre ?? 'Séance libre'} interrompue le{' '}
              <span className="chiffres">{formaterDateFr(enCours.sauvegardeeLe ?? enCours.demarreeLe)}</span>
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={reprendre}
                className="flex-1 rounded-xl px-4 text-sm font-bold"
                style={{ minHeight: CIBLE, background: 'var(--montee)', color: 'var(--accent-texte)' }}
              >
                Reprendre
              </button>
              <BoutonSecondaire onClick={() => onChange((prec) => ({ ...prec, enCours: null }))}>
                Abandonner
              </BoutonSecondaire>
            </div>
          </Bandeau>
        )}

        {/* La semaine : les séances du programme, d'un appui. */}
        <nav
          aria-label="Séances du programme"
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${programme.seances.length}, minmax(0, 1fr))` }}
        >
          {programme.seances.map((s) => {
            const selectionnee = s.id === seanceMois.id;
            const faite = faiteCetteSemaine(historique, s, maintenant);
            const autreSemaine = s.semaine !== undefined && s.semaine !== semaineAffichee;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={selectionnee}
                aria-label={`${s.nom}${faite ? ', faite cette semaine' : ''}`}
                onClick={() => setChoisie(s.id === proposee?.seance.id ? null : s.id)}
                className="whitespace-nowrap rounded-xl px-1 text-[13px] font-semibold"
                style={{
                  minHeight: CIBLE,
                  background: selectionnee ? 'var(--accent)' : 'var(--surface)',
                  color: selectionnee
                    ? 'var(--accent-texte)'
                    : autreSemaine
                      ? 'var(--texte-discret)'
                      : 'var(--texte)',
                  border: `1px solid ${selectionnee ? 'var(--accent)' : 'var(--bordure)'}`,
                }}
              >
                {faite ? '✓ ' : ''}
                {nomCourt(s)}
              </button>
            );
          })}
        </nav>

        {faiteAujourdhui && !horsCalendrier && (
          <p className="text-sm font-semibold" style={{ color: 'var(--montee)' }}>
            ✓ {faiteAujourdhui.nom} : faite aujourd’hui.
          </p>
        )}

        {/* La séance, et l'action de départ collée en bas tant qu'on la lit. */}
        <div>
          <section className="p-4" style={CARTE}>
            {surtitre && (
              <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>
                {surtitre}
              </p>
            )}
            <h2 className="mt-1 text-xl font-bold leading-tight" style={{ color: 'var(--texte)' }}>
              {seanceMois.nom}
            </h2>
            <p className="chiffres mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
              ≈ {formaterDuree(Math.round(seance.dureeEstimeeSec / 60) * 60)} · {seance.blocs.length} exercices ·{' '}
              {enchaine ? `${series} tours` : `${series} séries`}
              {seanceMois.semaine ? ` · semaine ${seanceMois.semaine}` : ''}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--texte-discret)' }}>
              {enchaine
                ? `${TAILLE_ENCHAINEMENT} exercices à la suite, puis ${REPOS_SEC} s de pause. ${series} tours.`
                : `Chacun son tour : ${REPOS_SEC} s de repos entre deux séries.`}
            </p>

            {groupes.map((groupe, index) => (
              <div key={index} className="mt-3">
                {enchaine && (
                  <p className="mb-2 text-sm font-bold" style={{ color: 'var(--texte)' }}>
                    Bloc {index + 1}
                  </p>
                )}
                <ul className="space-y-2">
                  {groupe.map((bloc) => {
                    const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
                    if (!exercice) return null;
                    return (
                      <LigneExercice
                        key={bloc.exerciceId}
                        bloc={bloc}
                        exercice={exercice}
                        passees={passees[bloc.exerciceId]}
                        unite={unite}
                        onChanger={() =>
                          setFeuille({ type: 'changer', seanceId: seanceMois.id, exerciceId: bloc.exerciceId })
                        }
                      />
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          <div
            className="sticky bottom-0 z-30 -mx-4 mt-3 px-4 pt-3"
            style={{
              background: 'var(--fond)',
              borderTop: '1px solid var(--bordure)',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
            }}
          >
            <button
              type="button"
              onClick={commencer}
              className="w-full font-bold"
              style={{
                height: ACTION,
                borderRadius: 16,
                background: 'var(--montee)',
                color: 'var(--accent-texte)',
                fontSize: 17,
              }}
            >
              Commencer
            </button>
          </div>
        </div>

        {/* Le programme : où on en est, et l'envoyer à l'autre. Objectifs et
            « Refaire » sont dans les réglages. */}
        <section className="p-4" style={CARTE}>
          <h2 className="text-base font-bold" style={{ color: 'var(--texte)' }}>
            Programme du mois
          </h2>
          <p className="chiffres text-sm" style={{ color: 'var(--texte-discret)' }}>
            {semaineDuMois < 0
              ? `Commence le ${dateLongue(depuisIso(programme.debut))}`
              : semaineDuMois < SEMAINES_PAR_MOIS
                ? `Semaine ${semaineDuMois + 1} sur ${SEMAINES_PAR_MOIS} · semaine ${semaineDe(programme, maintenant)}`
                : 'Le mois est fini : refaites le programme pour changer d’exercices.'}
          </p>
          <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
            {objectifs}
          </p>
          {semaineDuMois >= SEMAINES_PAR_MOIS && (
            <button
              type="button"
              onClick={demanderRefaire}
              className="mt-3 w-full rounded-xl px-3 text-sm font-bold"
              style={{ minHeight: CIBLE, background: 'var(--accent)', color: 'var(--accent-texte)' }}
            >
              Refaire le programme
            </button>
          )}

          <button
            type="button"
            onClick={() => void partager()}
            className="mt-3 w-full rounded-xl px-3 text-sm font-bold"
            style={
              aRenvoyer
                ? { minHeight: CIBLE, background: 'var(--accent)', color: 'var(--accent-texte)' }
                : SECONDAIRE
            }
          >
            {autre ? `Envoyer à ${autre}` : 'Partager le programme'}
          </button>
          {aRenvoyer && (
            <p className="mt-2 text-xs" style={{ color: 'var(--texte-discret)' }}>
              {autre ?? 'L’autre téléphone'} n’a pas encore ce programme.
            </p>
          )}
          {messagePartage && (
            <p role="status" className="mt-2 text-xs" style={{ color: 'var(--texte-discret)' }}>
              {messagePartage}
            </p>
          )}
          {lienACopier && (
            <input
              readOnly
              value={lienACopier}
              onFocus={(evenement) => evenement.target.select()}
              className="mt-2 w-full rounded-xl px-3 text-xs"
              style={{ ...SECONDAIRE, background: 'var(--surface-haute)' }}
              aria-label="Lien du programme"
            />
          )}
        </section>

        <div className="grid grid-cols-3 gap-2">
          <BoutonSecondaire onClick={() => onOuvrir('historique')} className="px-1">
            Historique
          </BoutonSecondaire>
          <BoutonSecondaire onClick={() => onOuvrir('exercices')} className="px-1">
            Exercices
          </BoutonSecondaire>
          <BoutonSecondaire onClick={() => onOuvrir('libre')} className="px-1">
            Séance libre
          </BoutonSecondaire>
        </div>
      </main>

      {feuille?.type === 'reglages' && (
        <FeuilleReglages
          personne={personne}
          parametres={parametres}
          onPersonne={choisirPersonne}
          onParametres={mettreAJourParametres}
          onObjectifs={() => setFeuille({ type: 'objectifs' })}
          onRefaire={demanderRefaire}
          onRecevoir={recevoir}
          onFermer={fermerFeuille}
        />
      )}
      {feuille?.type === 'objectifs' && (
        <FeuilleObjectifs objectifs={programme.objectifs} onRefaire={refaire} onFermer={fermerFeuille} />
      )}
      {feuille?.type === 'changer' && (
        <FeuilleChanger
          programme={programme}
          seanceId={feuille.seanceId}
          exerciceId={feuille.exerciceId}
          onChoisir={(nouveauId) => {
            onChange((prec) =>
              prec.programme
                ? {
                    ...prec,
                    programme: remplacerDansProgramme(prec.programme, feuille.seanceId, feuille.exerciceId, nouveauId),
                    programmeARenvoyer: true,
                  }
                : prec,
            );
            setMessagePartage(null);
            setLienACopier(null);
            setFeuille(null);
          }}
          onFermer={fermerFeuille}
        />
      )}

      {active && (
        <SeanceGuidee
          seance={active.seance}
          progression={active.progression}
          demarrage={active.demarrage}
          chargesPassees={chargesActives}
          onProgression={(progression) => onChange((prec) => ({ ...prec, enCours: progression }))}
          onTerminee={(realisee) => {
            onChange((prec) => ({
              ...prec,
              enCours: null,
              historique: [realisee, ...prec.historique].slice(0, 200),
            }));
            setActive(null);
            setChoisie(null);
            // Retour en haut : la séance faite, et la suivante.
            window.scrollTo({ top: 0 });
          }}
          onQuitter={() => {
            setActive(null);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </>
  );
}
