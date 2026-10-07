// L'accueil : le programme du mois, et la séance du jour prête à commencer.
// L'application a choisi les exercices dans les posters à partir des
// objectifs ; chacun suit la séance sur son téléphone, avec ses répétitions et
// ses charges — seul, ou à deux sur une horloge commune. La séance libre,
// l'historique et les exercices sont à un bouton.
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
  Tempo,
  UnitePoids,
} from '../types';
import { EXERCICES_PAR_ID, NOM_MUSCLE, cheminImage } from '../data/exercices';
import { GUIDES_VISUELS, TEMPOS, UNITES_POIDS } from '../data/parametres';
import { OBJECTIFS_MUSCULAIRES } from '../utils/muscles';
import { formaterDuree, groupesDeBlocs } from '../utils/generateurSeance';
import { formaterDateFr, graineAleatoire, memeTempo } from '../utils/formatage';
import { SUFFIXE_UNITE, chargeTotale, uniteDeSeance } from '../utils/statistiques';
import { bellSound } from '../utils/sounds';
import {
  JOURS,
  NOMBRES_EXERCICES,
  NOM_PERSONNE,
  NOM_ROLE,
  PERSONNES,
  REPOS_PAIRE_SEC,
  REPS_SEMAINE_DURE,
  SERIES_PROGRAMME,
  TEMPO_PROGRAMME,
  accordPaire,
  adresseServeurValide,
  alternatives,
  autrePersonne,
  avecNombreExercices,
  avecTempo,
  basculerTour,
  chargesPassees,
  delierDansProgramme,
  depuisIso,
  equipeDe,
  estRetouche,
  estSemaineDure,
  exercicesAAugmenter,
  faiteCetteSemaine,
  faiteLe,
  isoDate,
  lienDePartage,
  lierDansProgramme,
  nombreExercicesDe,
  pairesAutomatiques,
  prochaineDate,
  programmeDansLien,
  refairePaires,
  refaireProgramme,
  remplacerDansProgramme,
  repsDuDuo,
  rolesDe,
  seanceAProposer,
  seancePourPersonne,
  semaineDe,
  semainesEcoulees,
  tempoDuProgramme,
} from '../utils/programmeMois';
import type { AccordPaire, ContexteSeance } from '../utils/programmeMois';
import type { ConfigSynchro } from '../hooks/useSeanceCommune';
import { avecSeanceFaite, serveurDe } from '../utils/enLigne';
import {
  ESSAI,
  apercuDe,
  identifiantSeanceEssai,
  lecteurDeSeanceEssai,
  raccourcirPourEssai,
  seanceApercu,
  trouverNumeroEssai,
} from '../utils/essai';
import type { Essai } from '../utils/essai';
import FicheExercice from './FicheExercice';
import ImageEnGrand from './ImageEnGrand';
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
  /** À deux, avec le serveur : la séance commune à rejoindre. */
  synchro?: ConfigSynchro;
  /** Un essai ou un aperçu : rien n'est enregistré. */
  essai?: Essai;
}

type FeuilleOuverte =
  | null
  | { type: 'reglages' }
  | { type: 'objectifs' }
  | { type: 'changer'; seanceId: string; exerciceId: string };

/** Hauteur de l'action principale : commencer. */
const ACTION = 60;
/** Répétitions qu'on peut choisir pour chacun. */
const REPS_POSSIBLES = [6, 8, 10, 12];
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

/** Les boutons qu'on ne cherche pas tout de suite : l'essai, l'aperçu. */
const DISCRET = {
  minHeight: CIBLE,
  background: 'transparent',
  border: '1px solid var(--bordure)',
  color: 'var(--texte-discret)',
} as const;

/** « Mar A » : le nom court d'une séance, pour les pastilles de la semaine. */
const nomCourt = (seance: SeanceDuMois) =>
  `${JOURS_COURTS[seance.jour]}${seance.semaine ? ` ${seance.semaine}` : ''}`;

const estUnExercice = (id: string | undefined): id is string =>
  id !== undefined && Object.prototype.hasOwnProperty.call(EXERCICES_PAR_ID, id);

/** « lundi 5 octobre ». */
const dateLongue = (date: Date) =>
  date.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });

const musclesCibles = (exercice: Exercice) =>
  (exercice.musclesPrincipaux ?? []).map((muscle) => NOM_MUSCLE[muscle]).join(', ');

/** « 3 × 8 », « 2 × 8 par côté », « 3 × 30 s ». */
function volume(bloc: Pick<BlocSeries, 'series' | 'reps'>, exercice: Exercice): string {
  const repetitions = exercice.unite === 'secondes' ? `${bloc.reps} s` : `${bloc.reps}`;
  const cotes =
    exercice.cotes === 'unilateral' ? ' par côté' : exercice.cotes === 'alterne' ? ' en alternant' : '';
  return `${bloc.series} × ${repetitions}${cotes}`;
}

/** « 1 min 30 », « 45 s ». */
function dureeCourte(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const secondes = Math.round(sec % 60);
  if (minutes === 0) return `${secondes} s`;
  return secondes === 0 ? `${minutes} min` : `${minutes} min ${secondes}`;
}

/** « Pousser ↔ tirer » : la raison, avec sa majuscule. */
const phrase = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Où en est un exercice quand on forme une paire : libre, celui qu'on vient
 *  de choisir, un partenaire possible — vert ou rouge —, ou déjà en paire. */
type EtatLien =
  | { mode: 'libre'; onLier: () => void }
  | { mode: 'choisi'; onAnnuler: () => void }
  | { mode: 'candidat'; accord: AccordPaire; onLier: () => void }
  | { mode: 'aucun' };

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

/** Une des deux lignes « Ensemble » / « Chacun son tour » : un crochet vert
 *  sur le choix actif. */
function ChoixTour({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={actif ? undefined : onClick}
      aria-pressed={actif}
      className="flex w-full items-center gap-2 rounded-lg px-2 text-left text-xs"
      style={{
        minHeight: 32,
        background: 'transparent',
        color: actif ? 'var(--texte)' : 'var(--texte-discret)',
        fontWeight: actif ? 700 : 500,
      }}
    >
      <span aria-hidden="true" className="w-4 shrink-0 text-center font-bold" style={{ color: 'var(--montee)' }}>
        {actif ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}

/** Un exercice de la séance : l'image du poster, les muscles et son rôle, le
 *  volume du jour — et celui de l'autre, à deux —, les charges de la
 *  dernière fois. */
function LigneExercice({
  bloc,
  exercice,
  partenaire,
  passees,
  unite,
  lien,
  onChanger,
  onBasculerTour,
  onImage,
}: {
  bloc: BlocSeries;
  exercice: Exercice;
  /** À deux : le prénom de l'autre, dont on montre le volume. */
  partenaire: string | null;
  passees: number[] | undefined;
  unite: UnitePoids;
  lien: EtatLien;
  onChanger: () => void;
  onBasculerTour: () => void;
  onImage: () => void;
}) {
  const tour = bloc.tour === true;
  const rouge = lien.mode === 'candidat' && lien.accord.accord !== 'bon';
  const cadre =
    lien.mode === 'choisi'
      ? 'var(--accent)'
      : lien.mode === 'candidat'
        ? rouge
          ? 'var(--alerte)'
          : 'var(--montee)'
        : 'transparent';
  const [role, ...autresRoles] = rolesDe(exercice);
  return (
    <li className="p-3" style={{ background: 'var(--surface-haute)', borderRadius: 14, border: `2px solid ${cadre}` }}>
      <FicheExercice exercice={exercice} taille="petite" onImage={onImage}>
        <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
          {musclesCibles(exercice)}
        </p>
        {/* Son rôle : pousse, tire, jambes… et « bas du dos » quand il le charge. */}
        <p className="mt-1 flex flex-wrap gap-1">
          <span
            className="rounded-full px-2 text-[11px] font-semibold"
            style={{ border: '1px solid var(--bordure)', color: 'var(--texte)' }}
          >
            {NOM_ROLE[role]}
          </span>
          {autresRoles.map((autre) => (
            <span
              key={autre}
              className="rounded-full px-2 text-[11px] font-semibold"
              style={{ border: '1px solid var(--pause)', color: 'var(--pause)' }}
            >
              {NOM_ROLE[autre]}
            </span>
          ))}
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
        {bloc.autre && partenaire && (
          <p className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
            {partenaire} : {volume(bloc.autre, exercice)}
          </p>
        )}
        {bloc.derniereLegere && (
          <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
            Dernière série légère : la moitié de la charge.
          </p>
        )}
        {passees && passees.some((charge) => charge > 0) && (
          <p className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
            Dernière fois : {passees.map((charge) => (charge > 0 ? charge : '—')).join(' · ')}{' '}
            {SUFFIXE_UNITE[unite]}
            {bloc.ajoutCharge !== undefined && (
              <strong style={{ color: 'var(--montee)' }}>
                {' '}
                · +{bloc.ajoutCharge} {SUFFIXE_UNITE[unite]} proposés
              </strong>
            )}
          </p>
        )}
        {/* À deux : côte à côte, ou chacun son tour sur la machine. */}
        <div role="group" aria-label="À deux" className="mt-1">
          <ChoixTour actif={!tour} onClick={onBasculerTour}>
            Ensemble
          </ChoixTour>
          <ChoixTour actif={tour} onClick={onBasculerTour}>
            Chacun son tour
          </ChoixTour>
        </div>
        {/* Un exercice seul : on lui choisit un partenaire. */}
        {lien.mode === 'libre' && (
          <button
            type="button"
            onClick={lien.onLier}
            className="mt-1 rounded-full px-3 text-xs font-semibold"
            style={{ minHeight: 34, background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            Faire une paire
          </button>
        )}
        {lien.mode === 'choisi' && (
          <button
            type="button"
            onClick={lien.onAnnuler}
            className="mt-2 w-full rounded-xl px-3 text-sm font-semibold"
            style={{ minHeight: CIBLE, background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            Annuler
          </button>
        )}
        {lien.mode === 'candidat' &&
          (rouge ? (
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--alerte)' }}>
              À éviter : {lien.accord.raison}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--montee)' }}>
                Bon partenaire : {lien.accord.raison}
              </p>
              <button
                type="button"
                onClick={lien.onLier}
                className="mt-1 w-full rounded-xl px-3 text-sm font-bold"
                style={{ minHeight: CIBLE, background: 'var(--montee)', color: 'var(--fond)' }}
              >
                Mettre en paire
              </button>
            </>
          ))}
      </FicheExercice>
    </li>
  );
}

/** Les réglages : qui s'entraîne, les répétitions de chacun, le nombre
 *  d'exercices et le tempo du programme, l'unité, le programme, l'affichage. */
function FeuilleReglages({
  personne,
  parametres,
  reps,
  nombreExercices,
  tempo,
  onPersonne,
  onReps,
  onNombreExercices,
  onTempo,
  onParametres,
  onObjectifs,
  onRefaire,
  onRecevoir,
  serveur,
  onServeur,
  onFermer,
}: {
  personne: Personne | null;
  parametres: ParametresSeance;
  reps: Record<Personne, number>;
  /** Le nombre d'exercices et le tempo du programme : les mêmes sur les deux
   *  téléphones. */
  nombreExercices: number;
  tempo: Tempo;
  serveur: string | null;
  onServeur: (adresse: string | null) => void;
  onPersonne: (personne: Personne) => void;
  onReps: (personne: Personne, reps: number) => void;
  onNombreExercices: (nombre: number) => void;
  onTempo: (tempo: Tempo) => void;
  onParametres: (partiel: Partial<ParametresSeance>) => void;
  onObjectifs: () => void;
  onRefaire: () => void;
  onRecevoir: (texte: string) => boolean;
  onFermer: () => void;
}) {
  return (
    <Feuille titre="Réglages" onFermer={onFermer}>
      <Groupe titre="Qui s’entraîne sur ce téléphone ?" aide="Chacun ses répétitions et ses charges, sur son téléphone.">
        <div className="flex flex-wrap gap-2">
          {PERSONNES.map((p) => (
            <Pastille key={p.id} selectionne={personne === p.id} onClick={() => onPersonne(p.id)}>
              {NOM_PERSONNE[p.id]}
            </Pastille>
          ))}
        </div>
      </Groupe>

      <Groupe
        titre="Répétitions par série"
        aide={`Trois séries ; ${NOM_PERSONNE.max} en fait une de plus aux poussées. La semaine dure, le jeudi une semaine sur deux : ${REPS_SEMAINE_DURE} répétitions de plus chacun, même poids.`}
      >
        <div className="space-y-2">
          {PERSONNES.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm font-semibold" style={{ color: 'var(--texte)' }}>
                {NOM_PERSONNE[p.id]}
              </span>
              {REPS_POSSIBLES.map((n) => (
                <Pastille key={n} selectionne={reps[p.id] === n} onClick={() => onReps(p.id, n)}>
                  <span className="chiffres">{n}</span>
                </Pastille>
              ))}
            </div>
          ))}
        </div>
      </Groupe>

      <Groupe
        titre="Exercices par séance"
        aide="Deux par deux, sans compter le dernier pour les jambes. Changer le nombre recompose les séances, avec les mêmes objectifs."
      >
        <div className="flex flex-wrap gap-2">
          {NOMBRES_EXERCICES.map((n) => (
            <Pastille key={n} selectionne={nombreExercices === n} onClick={() => onNombreExercices(n)}>
              <span className="chiffres">{n}</span>
            </Pastille>
          ))}
        </div>
      </Groupe>

      <Groupe
        titre="Tempo des séances"
        aide="Le nombre d’exercices et le tempo sont les mêmes sur les deux téléphones : ils partent avec le programme. La séance libre garde son tempo à elle."
      >
        <div className="space-y-2">
          {TEMPOS.map((t) => (
            <Choix
              key={t.nom}
              selectionne={memeTempo(tempo, t.tempo)}
              onClick={() => onTempo(t.tempo)}
              nom={memeTempo(t.tempo, TEMPO_PROGRAMME) ? `${t.nom} · par défaut` : t.nom}
              description={t.description}
            />
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

      <ReglageServeur actuelle={serveur} onChoisir={onServeur} />

      <details>
        <summary
          className="flex cursor-pointer select-none items-center text-sm font-bold"
          style={{ color: 'var(--texte-discret)', minHeight: CIBLE, listStyle: 'none' }}
        >
          Affichage
        </summary>
        <div className="space-y-5 pb-2">
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

/** L'adresse du serveur du direct à deux : celle du VPS. Elle part avec le
 *  lien du programme, l'autre téléphone la reçoit. */
function ReglageServeur({
  actuelle,
  onChoisir,
}: {
  actuelle: string | null;
  onChoisir: (adresse: string | null) => void;
}) {
  const [texte, setTexte] = useState(actuelle ?? '');
  const [etat, setEtat] = useState<'' | 'essai' | 'ok' | 'muet' | 'invalide'>('');
  const essayer = async () => {
    const adresse = adresseServeurValide(texte);
    if (!adresse) {
      setEtat('invalide');
      return;
    }
    setEtat('essai');
    try {
      const reponse = await fetch(`${adresse}/api/heure`, { cache: 'no-store' });
      if (!reponse.ok) throw new Error();
      setEtat('ok');
      setTexte(adresse);
      onChoisir(adresse);
    } catch {
      setEtat('muet');
    }
  };
  return (
    <Groupe titre="Serveur, pour le direct à deux" aide="L’adresse de ton VPS. Elle part avec le lien du programme.">
      <div className="flex gap-2">
        <input
          value={texte}
          onChange={(evenement) => {
            setTexte(evenement.target.value);
            setEtat('');
          }}
          placeholder="https://srv….hstgr.cloud"
          aria-label="Adresse du serveur"
          inputMode="url"
          className="min-w-0 flex-1 rounded-xl px-3 text-sm"
          style={{ ...SECONDAIRE, background: 'var(--surface-haute)' }}
        />
        <button
          type="button"
          disabled={texte.trim() === '' || etat === 'essai'}
          onClick={() => void essayer()}
          className="shrink-0 rounded-xl px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: CIBLE, background: 'var(--accent)', color: 'var(--accent-texte)' }}
        >
          Essayer
        </button>
      </div>
      {etat !== '' && etat !== 'essai' && (
        <p
          role={etat === 'ok' ? 'status' : 'alert'}
          className="mt-2 text-xs font-semibold"
          style={{ color: etat === 'ok' ? 'var(--montee)' : 'var(--alerte)' }}
        >
          {etat === 'ok'
            ? 'Le serveur répond : le direct à deux est prêt. Renvoie le programme à l’autre.'
            : etat === 'muet'
              ? 'Pas de réponse à cette adresse.'
              : 'L’adresse doit commencer par https://'}
        </p>
      )}
      {actuelle && (
        <button
          type="button"
          onClick={() => {
            onChoisir(null);
            setTexte('');
            setEtat('');
          }}
          className="mt-1 text-xs font-semibold"
          style={{ minHeight: 32, color: 'var(--texte-discret)', background: 'transparent' }}
        >
          Oublier ce serveur
        </button>
      )}
    </Groupe>
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
        L’application prend dans les posters les exercices qui travaillent ces muscles : le bas du corps le
        lundi, le haut le mardi, et lourd le jeudi.
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
        pour chaque {seanceMois.type === 'dure' ? 'jeudi' : `« ${seanceMois.nom} »`}.
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
  /** L'exercice dont l'image est ouverte en grand. */
  const [enGrand, setEnGrand] = useState<string | null>(null);
  const fermerImage = useCallback(() => setEnGrand(null), []);
  /** L'autre téléphone n'a pas ce programme-ci : premier lancement, ou
   *  programme changé depuis le dernier envoi. Gardé dans la sauvegarde. */
  const aRenvoyer = etat.programmeARenvoyer === true;
  /** L'exercice seul choisi pour former une paire avec un autre. */
  const [aLier, setALier] = useState<string | null>(null);
  /** Un essai en direct demande son numéro au serveur : quelques secondes au plus. */
  const [lancement, setLancement] = useState(false);

  const maintenant = new Date();
  const proposee = seanceAProposer(programme, historique, maintenant);
  const seanceMois =
    programme.seances.find((s) => s.id === choisie) ?? proposee?.seance ?? programme.seances[0];
  // À deux par défaut, dès qu'on sait qui s'entraîne ici.
  const aDeux = personne !== null && etat.aDeux !== false;
  const reps = repsDuDuo(programme);
  // Le jour de la séance affichée : la semaine dure et le cran de plus en
  // dépendent.
  const jourSeance = isoDate(
    proposee?.seance.id === seanceMois.id ? proposee.date : prochaineDate(programme, seanceMois, maintenant),
  );
  const semaineDure = estSemaineDure(programme, seanceMois, depuisIso(jourSeance));
  const contexte = useMemo<ContexteSeance>(
    () => ({
      personne,
      aDeux,
      semaineDure,
      reps: repsDuDuo(programme),
      // Le tempo du programme, le même sur les deux téléphones.
      tempo: tempoDuProgramme(programme),
      augmenter: exercicesAAugmenter(historique, programme, seanceMois, depuisIso(jourSeance)),
    }),
    [personne, aDeux, semaineDure, programme, historique, seanceMois, jourSeance],
  );
  const seance = useMemo(() => seancePourPersonne(seanceMois, parametres, contexte), [seanceMois, parametres, contexte]);
  const passees = useMemo(
    () => chargesPassees(historique, seance.blocs.map((bloc) => bloc.exerciceId), unite),
    [historique, seance, unite],
  );
  // La charge soulevée la dernière fois qu'on a fait cette séance : le chiffre
  // à battre, affiché à la fin.
  const chargeDerniereFois = useMemo(() => {
    if (!active?.seance.titre) return undefined;
    const precedente = historique.find((h) => h.titre === active.seance.titre);
    return precedente ? chargeTotale(precedente, uniteDeSeance(active.seance.parametres)) : undefined;
  }, [active, historique]);
  // Dans l'aperçu, c'est l'écran de l'autre : nos charges n'y ont pas leur place.
  const chargesActives = useMemo(
    () =>
      active && active.essai?.genre !== 'apercu'
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

  // Le dernier exercice, pour les jambes, se montre à part.
  const dernier = seance.blocs[seance.blocs.length - 1];
  const blocFinal = seanceMois.finale && dernier?.exerciceId === seanceMois.finale ? dernier : undefined;
  const principaux = blocFinal ? seance.blocs.slice(0, -1) : seance.blocs;
  // Les paires, et les exercices seuls.
  const groupes = groupesDeBlocs(principaux);
  const avecPaires = groupes.some((groupe) => groupe.length > 1);
  // Les paires ont été retouchées : on peut remettre les automatiques.
  const pairesRetouchees = useMemo(() => !pairesAutomatiques(seanceMois), [seanceMois]);
  const echauffement = seance.echauffement ?? [];
  const etirements = [...new Set((seance.retourCalme ?? []).map((m) => m.exerciceId).filter(estUnExercice))];
  const avecTrapBar = seance.blocs.some((bloc) => bloc.exerciceId === 'trap-bar-deadlift');
  const aAugmenter = seance.blocs.filter((bloc) => bloc.ajoutCharge !== undefined).length;

  /** Toute retouche du programme : l'autre téléphone devra le recevoir. */
  const modifierProgramme = (modifier: (prec: ProgrammeMois) => ProgrammeMois) => {
    onChange((prec) => (prec.programme ? { ...prec, programme: modifier(prec.programme), programmeARenvoyer: true } : prec));
    setMessagePartage(null);
    setLienACopier(null);
  };

  /** Former une paire : un exercice seul, puis un partenaire — vert s'il
   *  s'y oppose, rouge s'il faut l'éviter. */
  const enPaire = (id: string) => (seanceMois.liens ?? []).some((groupe) => groupe.includes(id));
  const choixLien = aLier !== null && seanceMois.exercices.includes(aLier) && !enPaire(aLier) ? aLier : null;
  const etatLien = (bloc: BlocSeries): EtatLien => {
    const id = bloc.exerciceId;
    if (bloc === blocFinal || enPaire(id)) return { mode: 'aucun' };
    if (!choixLien) return { mode: 'libre', onLier: () => setALier(id) };
    if (id === choixLien) return { mode: 'choisi', onAnnuler: () => setALier(null) };
    return {
      mode: 'candidat',
      accord: accordPaire(EXERCICES_PAR_ID[choixLien], EXERCICES_PAR_ID[id]),
      onLier: () => {
        modifierProgramme((prec) => lierDansProgramme(prec, seanceMois.id, choixLien, id));
        setALier(null);
      },
    };
  };

  /** Une ligne d'exercice de la séance affichée. */
  const ligne = (bloc: BlocSeries) => {
    const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
    if (!exercice) return null;
    return (
      <LigneExercice
        key={bloc.exerciceId}
        bloc={bloc}
        exercice={exercice}
        partenaire={aDeux ? autre : null}
        passees={passees[bloc.exerciceId]}
        unite={unite}
        lien={etatLien(bloc)}
        onChanger={() => setFeuille({ type: 'changer', seanceId: seanceMois.id, exerciceId: bloc.exerciceId })}
        onBasculerTour={() => modifierProgramme((prec) => basculerTour(prec, seanceMois.id, bloc.exerciceId))}
        onImage={() => setEnGrand(bloc.exerciceId)}
      />
    );
  };

  const semaineDuMois = semainesEcoulees(programme, maintenant);
  const objectifs =
    programme.objectifs
      .map((id) => OBJECTIFS_MUSCULAIRES.find((o) => o.id === id)?.nom)
      .filter(Boolean)
      .join(' · ') || 'Tout le corps';

  // ------------------------------------------------ Actions

  const mettreAJourParametres = (partiel: Partial<ParametresSeance>) =>
    onChange((prec) => ({ ...prec, parametres: { ...prec.parametres, ...partiel } }));

  const choisirPersonne = (choix: Personne) => onChange((prec) => ({ ...prec, personne: choix }));

  /** Les répétitions de chacun voyagent avec le programme : les deux
   *  téléphones en tirent la même horloge. */
  const changerReps = (qui: Personne, n: number) =>
    modifierProgramme((prec) => ({ ...prec, duo: { ...prec.duo, reps: { ...repsDuDuo(prec), [qui]: n } } }));

  /** Le nombre d'exercices et le tempo voyagent aussi avec le programme. Un
   *  autre nombre recompose les séances : on prévient s'il y a des retouches
   *  à perdre. */
  const nombreExercices = nombreExercicesDe(programme);
  const changerNombreExercices = (n: number) => {
    if (n === nombreExercices) return;
    if (estRetouche(programme) && !window.confirm('Les exercices changés à la main et les paires refaites seront perdus. Continuer ?')) {
      return;
    }
    setALier(null);
    modifierProgramme((prec) => avecNombreExercices(prec, n));
  };
  const changerTempo = (tempo: Tempo) => modifierProgramme((prec) => avecTempo(prec, tempo));

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
      refaireProgramme(programme, {
        objectifs: objectifsChoisis,
        materiels: programme.materiels,
        graine: graineAleatoire(),
      }),
    );
    setFeuille(null);
    window.scrollTo({ top: 0 });
  };

  const demanderRefaire = () => {
    if (window.confirm('Refaire le programme ? Les exercices changent ; l’historique reste.')) {
      refaire(programme.objectifs);
    }
  };

  /** La séance commune du jour, si l'on s'entraîne à deux et que le serveur
   *  est réglé. */
  const serveur = serveurDe(programme);
  const configSynchro = (seanceId: string, aDeuxIci: boolean): ConfigSynchro | undefined =>
    aDeuxIci && personne && serveur
      ? { serveur, equipe: equipeDe(programme), cle: `${isoDate(new Date())}_${seanceId}`, personne }
      : undefined;

  const commencer = () => {
    if (seance.blocs.length === 0) return;
    if (enCours && !window.confirm('Une séance interrompue attend. L’abandonner et commencer celle-ci ?')) return;
    // Geste de l'utilisateur : c'est maintenant qu'on réveille le son.
    bellSound.unlock();
    setALier(null);
    setActive({
      seance: seancePourPersonne(seanceMois, parametres, contexte),
      progression: null,
      demarrage: 'debut',
      synchro: configSynchro(seanceMois.id, aDeux),
    });
  };

  const reprendre = () => {
    if (!enCours) return;
    bellSound.unlock();
    const duMois = programme.seances.find((s) => s.nom === enCours.seance.titre);
    setActive({
      seance: enCours.seance,
      progression: enCours,
      demarrage: 'reprise',
      synchro: duMois ? configSynchro(duMois.id, enCours.seance.horloge?.partenaire !== undefined) : undefined,
    });
  };

  /** L'essai : la séance du jour en version courte, sans rien garder. À deux
   *  avec le serveur, il se fait en direct sur sa propre séance commune,
   *  numérotée : on rejoint l'essai que l'autre vient de lancer, sinon on
   *  prend le premier numéro libre. La vraie séance du jour ne reprend pas là
   *  où il s'arrête. Une séance interrompue, s'il y en a une, attend toujours. */
  const lancerEssai = async () => {
    if (seance.blocs.length === 0) return;
    bellSound.unlock();
    setALier(null);
    const courte = raccourcirPourEssai(seancePourPersonne(seanceMois, parametres, contexte));
    const jour = isoDate(new Date());
    let synchro = configSynchro(seanceMois.id, aDeux);
    if (synchro) {
      setLancement(true);
      try {
        const numero = await trouverNumeroEssai(
          lecteurDeSeanceEssai({ serveur: synchro.serveur, equipe: synchro.equipe, jour, seanceId: seanceMois.id }),
          courte,
        );
        synchro = { ...synchro, cle: `${jour}_${identifiantSeanceEssai(seanceMois.id, numero)}` };
      } finally {
        setLancement(false);
      }
    }
    setActive({ seance: courte, progression: null, demarrage: 'debut', synchro, essai: ESSAI });
  };

  /** Voir comme l'autre : le même essai, avec ses répétitions et ses
   *  étirements. Seul, sans le serveur. */
  const lancerApercu = () => {
    const apercu = seanceApercu(seanceMois, parametres, contexte);
    if (!apercu || !autre || apercu.blocs.length === 0) return;
    bellSound.unlock();
    setALier(null);
    setActive({ seance: apercu, progression: null, demarrage: 'debut', essai: apercuDe(autre) });
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
              {NOM_PERSONNE.max} fait deux répétitions de plus, et une série de plus aux poussées.
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
                  {NOM_PERSONNE[p.id]}
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

        {/* Seul : son temps à soi. À deux : une horloge commune. */}
        {personne && autre && (
          <div role="group" aria-label="Seul ou à deux" className="grid grid-cols-2 gap-2">
            <Pastille selectionne={!aDeux} onClick={() => onChange((prec) => ({ ...prec, aDeux: false }))}>
              Seul
            </Pastille>
            <Pastille selectionne={aDeux} onClick={() => onChange((prec) => ({ ...prec, aDeux: true }))}>
              Avec {autre}
            </Pastille>
          </div>
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
                onClick={() => {
                  setChoisie(s.id === proposee?.seance.id ? null : s.id);
                  setALier(null);
                }}
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
              ≈ {formaterDuree(Math.round(seance.dureeEstimeeSec / 60) * 60)}
              {aDeux && autre ? ` avec ${autre}` : ''} · {seance.blocs.length} exercices · {SERIES_PROGRAMME} séries
              {seanceMois.semaine ? ` · semaine ${seanceMois.semaine}` : ''}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--texte-discret)' }}>
              {avecPaires
                ? `Par paires : les deux exercices à la suite, puis ${dureeCourte(REPOS_PAIRE_SEC)} de pause${avecTrapBar ? ', 2 min avec la trap bar' : ''}. À chaque nouvelle paire, on installe, puis on repart sur « Go ».`
                : `Pauses : ${avecTrapBar ? '2 min à la trap bar, ' : ''}1 min 30 aux gros exercices, 1 min aux petits. À chaque nouvel exercice, on installe, puis on repart sur « Go ».`}
            </p>

            {semaineDure && (
              <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--surface-haute)', border: '1px solid var(--pause)' }}>
                <p className="text-sm font-bold" style={{ color: 'var(--texte)' }}>
                  Semaine dure : même poids, {REPS_SEMAINE_DURE} répétitions de plus
                </p>
                <p className="chiffres text-sm" style={{ color: 'var(--texte-discret)' }}>
                  {NOM_PERSONNE.max} {reps.max + REPS_SEMAINE_DURE}, {NOM_PERSONNE.sebastien} {reps.sebastien + REPS_SEMAINE_DURE}. Si le dos
                  s’arrondit, on arrête la série.
                </p>
              </div>
            )}
            {aAugmenter > 0 && (
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--montee)' }}>
                Semaine dure réussie : un cran de plus proposé sur {aAugmenter}{' '}
                {aAugmenter > 1 ? 'exercices' : 'exercice'}.
              </p>
            )}

            {echauffement.length > 0 && (
              <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--surface-haute)' }}>
                <p className="text-sm font-bold" style={{ color: 'var(--texte)' }}>
                  Pour commencer ·{' '}
                  <span className="chiffres">{Math.round(seance.echauffementSec / 60)} min</span>
                </p>
                <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
                  {echauffement[0].nom}{' '}
                  <span className="chiffres">{Math.round((echauffement[0].dureeSec ?? 0) / 60)} min</span>, puis{' '}
                  {echauffement
                    .slice(1)
                    .map((m) => m.nom.toLowerCase())
                    .join(', ')}
                  .
                </p>
              </div>
            )}

            {choixLien && (
              <p className="mt-3 rounded-xl p-3 text-sm" style={{ background: 'var(--surface-haute)', color: 'var(--texte)' }}>
                Touchez « Mettre en paire » sur un exercice vert : les deux se font à la suite, la pause vient
                après. Rouge : à éviter, la raison est dessous.
              </p>
            )}

            {/* Les paires : deux exercices opposés, à la suite, puis la pause. */}
            <div className="mt-3 space-y-2">
              {groupes.map((groupe) => {
                if (groupe.length === 1) return <ul key={groupe[0].exerciceId}>{ligne(groupe[0])}</ul>;
                const numero = groupes.filter((g) => g.length > 1).indexOf(groupe) + 1;
                const [a, b] = groupe.map((bloc) => EXERCICES_PAR_ID[bloc.exerciceId]);
                const accord = a && b ? accordPaire(a, b) : null;
                const bonne = accord?.accord === 'bon';
                // À deux, une machine dans la paire : chacun commence par un exercice.
                const croisee = aDeux && groupe.some((bloc) => bloc.tour);
                return (
                  <div
                    key={groupe[0].exerciceId}
                    className="space-y-2 rounded-2xl p-2"
                    style={{ border: `2px solid ${bonne ? 'var(--montee)' : 'var(--alerte)'}` }}
                  >
                    <div className="flex items-start justify-between gap-2 pl-1">
                      <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: 'var(--texte)' }}>
                          Paire {numero}
                        </p>
                        {accord && (
                          <p className="text-xs font-semibold" style={{ color: bonne ? 'var(--montee)' : 'var(--alerte)' }}>
                            {bonne ? phrase(accord.raison) : `À éviter : ${accord.raison}`}
                            {croisee ? ' · à deux, on se croise' : ''}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => modifierProgramme((prec) => delierDansProgramme(prec, seanceMois.id, groupe[0].exerciceId))}
                        className="shrink-0 rounded-xl px-2 text-sm font-semibold"
                        style={{ minHeight: 40, background: 'transparent', color: 'var(--accent)' }}
                      >
                        Séparer
                      </button>
                    </div>
                    <ul className="space-y-2">{groupe.map(ligne)}</ul>
                  </div>
                );
              })}
            </div>

            {pairesRetouchees && (
              <button
                type="button"
                onClick={() => {
                  setALier(null);
                  modifierProgramme((prec) => refairePaires(prec, seanceMois.id));
                }}
                className="mt-3 w-full rounded-xl px-3 text-sm font-semibold"
                style={SECONDAIRE}
              >
                Refaire les paires
              </button>
            )}

            {blocFinal && (
              <div className="mt-3">
                <p className="mb-2 text-sm font-bold" style={{ color: 'var(--texte)' }}>
                  Pour finir : les jambes
                </p>
                <ul className="space-y-2">{ligne(blocFinal)}</ul>
              </div>
            )}

            {etirements.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-sm font-bold" style={{ color: 'var(--texte)' }}>
                  Étirements · <span className="chiffres">{Math.round(seance.retourCalmeSec / 60)} min</span>
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {etirements.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setEnGrand(id)}
                      aria-label={`Voir ${EXERCICES_PAR_ID[id].nomFr} en grand`}
                      className="cursor-zoom-in overflow-hidden p-0.5"
                      style={{ background: '#ffffff', border: '1px solid var(--bordure)', borderRadius: 10 }}
                    >
                      <img
                        src={cheminImage(id)}
                        alt={EXERCICES_PAR_ID[id].nomFr}
                        loading="lazy"
                        className="w-full"
                        style={{ aspectRatio: '1 / 1', objectFit: 'contain' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
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

          {/* Pour essayer sans rien garder : la séance en version courte, ou
              l'écran de l'autre. */}
          <div className={`mt-1 grid gap-2 ${autre ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button type="button" onClick={() => void lancerEssai()} className="rounded-xl px-3 text-sm font-semibold" style={DISCRET}>
              Séance d’essai
            </button>
            {autre && (
              <button type="button" onClick={lancerApercu} className="rounded-xl px-3 text-sm font-semibold" style={DISCRET}>
                Voir comme {autre}
              </button>
            )}
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
          reps={reps}
          nombreExercices={nombreExercices}
          tempo={tempoDuProgramme(programme)}
          onNombreExercices={changerNombreExercices}
          onTempo={changerTempo}
          serveur={programme.serveur ?? null}
          onServeur={(adresse) =>
            modifierProgramme((prec) => {
              const suivant = { ...prec };
              if (adresse) suivant.serveur = adresse;
              else delete suivant.serveur;
              return suivant;
            })
          }
          onPersonne={choisirPersonne}
          onReps={changerReps}
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
            modifierProgramme((prec) => remplacerDansProgramme(prec, feuille.seanceId, feuille.exerciceId, nouveauId));
            setFeuille(null);
          }}
          onFermer={fermerFeuille}
        />
      )}

      {enGrand && EXERCICES_PAR_ID[enGrand] && (
        <ImageEnGrand exercice={EXERCICES_PAR_ID[enGrand]} onFermer={fermerImage} />
      )}

      {lancement && (
        <div
          role="status"
          className="fixed inset-0 z-50 flex items-center justify-center px-6 text-center"
          style={{ background: 'var(--fond)', color: 'var(--texte-discret)' }}
        >
          Un instant : on regarde si {autre ?? 'l’autre'} a déjà lancé l’essai…
        </div>
      )}

      {active && (
        <SeanceGuidee
          seance={active.seance}
          progression={active.progression}
          demarrage={active.demarrage}
          synchro={active.synchro}
          essai={active.essai}
          chargeDerniereFois={chargeDerniereFois}
          chargesPassees={chargesActives}
          onProgression={(progression) => {
            // Un essai ne laisse aucune trace : ni reprise, ni séance interrompue effacée.
            if (!active.essai) onChange((prec) => ({ ...prec, enCours: progression }));
          }}
          onTerminee={(realisee) => {
            if (!active.essai) onChange((prec) => avecSeanceFaite(prec, realisee));
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
