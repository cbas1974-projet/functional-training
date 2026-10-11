// Mode séance guidée : l'application déroule les étapes de la séance, dicte
// le tempo des séries (l'utilisateur suit la bille et les bips), gère la
// pause, la reprise après rechargement et le temps passé sur chaque exercice.
//
// Habillage : uniquement les jetons de couleur de `index.css` (mode sombre
// par défaut, mode clair suivant le système) et la classe `.chiffres` sur
// tout ce qui se compte. Chaque phase a sa couleur d'ambiance, reconnaissable
// d'un coup d'œil à bout de bras.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import type {
  BlocSeries,
  Exercice,
  GuideVisuel,
  MouvementGuide,
  Personne,
  ProgressionSeance,
  Ressenti,
  Seance,
  SeanceRealisee,
  Tempo,
  UnitePoids,
} from '../types';
import { ECHAUFFEMENT, RETOUR_CALME, cheminImage, consignesDe } from '../data/exercices';
import { bellSound } from '../utils/sounds';
import {
  agregerRealisation,
  construireEtapes,
  dureeRestanteSec,
  dureeTotaleSec,
  etatChangementCote,
  etatMaintien,
  etatMetronome,
  exerciceDeSeance,
  formeDe,
  indexApresExercice,
  indexEtapePrecedente,
  indexReprise,
  motDePhase,
  pauseAEtirement,
  premierePhase,
} from '../utils/etapesSeance';
import type {
  Etape,
  EtapeTravail,
  EtatChangementCote,
  EtatMaintien,
  EtatMetronome,
  PhaseTempo,
  Suivant,
} from '../utils/etapesSeance';
import { CHANGER_DE_COTE_SEC, estCercleAuTemps, estMobilite, tempoPourExercice } from '../utils/generateurSeance';
import { libelleTempo } from '../utils/formatage';
import type { Essai } from '../utils/essai';
import { autrePersonne, chargeDeSerie, chargeLeBasDuDos, etirementsPauseDe } from '../utils/programmeMois';
import { decisionPasserExercice, decisionProlonger, decisionSuivant, perspectiveAutre } from '../utils/horlogeCommune';
import { tempsActifMs } from '../utils/etatCommun';
import type { Contexte, Decision } from '../utils/horlogeCommune';
import { SUFFIXE_UNITE, chargeTotale, libellePoidsParSerie, uniteDeSeance } from '../utils/statistiques';
import { ajustementDeCharge, avecRessentis, exercicesAEvaluer, motRessenti, phraseRessenti } from '../utils/ressenti';
import { ajouterTemps, useMoteurEtapes } from '../hooks/useMoteurEtapes';
import { useMoteurCommun } from '../hooks/useMoteurCommun';
import { useSeanceCommune } from '../hooks/useSeanceCommune';
import type { ConfigSynchro } from '../hooks/useSeanceCommune';
import { useVerrouEcran } from '../hooks/useVerrouEcran';
import BoutonsRessenti from './BoutonsRessenti';
import PaceurTempo from './PaceurTempo';
import type { LectureTempo } from './PaceurTempo';

export interface SeanceGuideeProps {
  /** Séance à dérouler. */
  seance: Seance;
  /** Progression sauvegardée à reprendre (null pour démarrer du début). */
  progression: ProgressionSeance | null;
  /** Appelé régulièrement pour sauvegarder la progression ; null quand la
   *  séance est terminée ou abandonnée. */
  onProgression: (progression: ProgressionSeance | null) => void;
  /** Appelé à la fin quand l'utilisateur enregistre la séance. */
  onTerminee: (realisee: SeanceRealisee) => void;
  /** Appelé pour quitter sans enregistrer (ou après enregistrement). */
  onQuitter: () => void;
  /** Charges de la dernière fois, par exercice puis par série : elles
   *  pré-remplissent la saisie. */
  chargesPassees?: Record<string, number[]>;
  /** Démarre aussitôt, sans l'écran de présentation : l'accueil du
   *  programme montre déjà la séance, un second « Commencer » ferait double
   *  emploi. 'reprise' repart de la progression sauvegardée. */
  demarrage?: 'debut' | 'reprise';
  /** À deux, avec le serveur : l'horloge commune, en direct. */
  synchro?: ConfigSynchro;
  /** La charge totale soulevée la dernière fois, dans l'unité de la séance :
   *  le chiffre à battre. */
  chargeDerniereFois?: number;
  /** Un essai ou un aperçu : rien n'est enregistré — ni la progression, ni la
   *  séance faite. Son bandeau reste affiché du début à la fin. */
  essai?: Essai;
}

// ------------------------------------------------------------- Réglages

/** Intervalle minimal entre deux sauvegardes de la progression pendant une étape. */
const INTERVALLE_SAUVEGARDE_MS = 10_000;
const PROLONGATION_REPOS_SEC = 15;
/** « +5 s » au changement de côté : autant que le changement lui-même. */
const PROLONGATION_CHANGEMENT_SEC = CHANGER_DE_COTE_SEC;
/** Une fin d'étape détectée avec au plus ce retard est datée à l'instant
 *  prévu (pas de dérive) ; au-delà (onglet en arrière-plan), l'étape suivante
 *  démarre à l'instant présent. */
const TOLERANCE_FIN_MS = 1000;
/** Les dernières secondes d'un compte à rebours passent en rouge. */
const SECONDES_ALERTE = 3;
/** Hauteur du rail de la bille. Mesurée pour que « Série terminée » reste
 *  au-dessus de la barre du bas sur un écran de 390 × 844 : la vignette, le
 *  compteur, les points d'attention et la saisie du poids passent avant. */
const HAUTEUR_BILLE_PX = 176;

// ------------------------------------------------------------- Habillage

/** Titres et chiffres : la police Archivo, plus large de loin. */
const ARCHIVO: CSSProperties = { fontFamily: "'Archivo', sans-serif" };

/** Le texte posé sur une couleur de signal reprend le fond de l'écran, le
 *  vis-à-vis le plus contrasté dans les deux thèmes. Le jaune de la pause est
 *  la seule exception : en thème clair il est trop pâle pour le fond crème,
 *  il prend donc l'encre de l'accent (blanche en clair, sombre en sombre). */
type VarianteBouton = 'accent' | 'montee' | 'pause' | 'neutre' | 'fantome';

const STYLES_BOUTON: Record<VarianteBouton, CSSProperties> = {
  accent: { background: 'var(--accent)', color: 'var(--accent-texte)' },
  montee: { background: 'var(--montee)', color: 'var(--fond)' },
  pause: { background: 'var(--pause)', color: 'var(--accent-texte)' },
  neutre: { background: 'var(--surface-haute)', color: 'var(--texte)' },
  fantome: { background: 'transparent', color: 'var(--texte-discret)' },
};

const BOUTON_COMMUN =
  'font-semibold touch-manipulation transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40';

/** Chaque taille porte son unique classe de hauteur, de padding et de corps :
 *  rien à écraser depuis l'appelant, qui ne donne que la mise en page.
 *  `petit` est la cible tactile minimale (44 px), les autres sont les
 *  commandes de séance (56 px), que le pouce trouve sans regarder. */
type TailleBouton = 'petit' | 'etroit' | 'grand' | 'vedette';

const CLASSES_TAILLE: Record<TailleBouton, string> = {
  petit: 'min-h-11 rounded-xl px-4 text-sm',
  etroit: 'min-h-14 rounded-2xl px-2 text-base',
  grand: 'min-h-14 rounded-2xl px-4 text-lg',
  vedette: 'min-h-14 rounded-2xl px-4 text-xl',
};

interface BoutonProps {
  variante: VarianteBouton;
  onClick: () => void;
  children: ReactNode;
  taille?: TailleBouton;
  /** Uniquement de la mise en page (largeur, flex, soulignement). */
  className?: string;
  disabled?: boolean;
}

function Bouton({ variante, onClick, children, taille = 'grand', className = '', disabled }: BoutonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BOUTON_COMMUN} ${CLASSES_TAILLE[taille]} ${className}`}
      style={STYLES_BOUTON[variante]}
    >
      {children}
    </button>
  );
}

interface VignetteProps {
  exerciceId: string;
  alt: string;
  /** Largeur, arrondi et marge : la plaque blanche, elle, est imposée. */
  className?: string;
}

/** Vignette d'exercice. Les dessins sont noirs sur fond blanc : sur le thème
 *  sombre il leur faut toujours une plaque blanche, jamais le fond de l'écran. */
function Vignette({ exerciceId, alt, className = '' }: VignetteProps) {
  return (
    <img
      src={cheminImage(exerciceId)}
      alt={alt}
      className={`object-contain ${className}`}
      style={{ background: '#ffffff', aspectRatio: '3 / 2' }}
    />
  );
}

/** Couleur de signal et couleur d'ambiance d'une étape. Le fond de l'écran
 *  change avec la phase : on voit d'un coup d'œil si on travaille ou si on
 *  récupère. */
interface Ambiance {
  couleur: string;
  fond: string;
}

function ambianceEtape(etape: Etape): Ambiance {
  switch (etape.type) {
    case 'serie':
    case 'station':
      return { couleur: 'var(--montee)', fond: 'var(--montee-fond)' };
    case 'repos':
    case 'reposTour':
      return { couleur: 'var(--descente)', fond: 'var(--descente-fond)' };
    case 'retourCalme':
      return { couleur: 'var(--descente)', fond: 'var(--fond)' };
    case 'fin':
      return { couleur: 'var(--montee)', fond: 'var(--fond)' };
    case 'echauffement':
    case 'pret':
      return { couleur: 'var(--accent)', fond: 'var(--fond)' };
  }
}

// ------------------------------------------------------------- Formatage

/** « 4:05 » */
function formaterMmSs(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** « 21 min », « 21 min 30 s », « 45 s » */
function formaterDureeCourte(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  if (minutes === 0) return `${secondes} s`;
  return secondes === 0 ? `${minutes} min` : `${minutes} min ${secondes} s`;
}

function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`;
}

/** Une posture de yoga ou un étirement : tenue au temps, sans charge, jamais
 *  répétée. L'écran s'adapte — pas de saisie de poids, pas de « Série 1 / 1 ». */
function estPosture(exercice: Exercice): boolean {
  return (exercice.famille ?? 'musculation') !== 'musculation';
}

/** « 8 répétitions par côté », « 8 tours, changement de sens à mi-série »,
 *  « 40 s », « 30 s dans un sens, puis 30 s dans l’autre » */
function libelleReps(exercice: Exercice, reps: number): string {
  if (exercice.unite === 'secondes') {
    if (estCercleAuTemps(exercice)) return `${reps} s dans un sens, puis ${reps} s dans l’autre`;
    return exercice.cotes === 'unilateral' ? `${reps} s par côté` : `${reps} s`;
  }
  if (exercice.mouvement === 'circulaire') return `${pluriel(reps, 'tour')}, changement de sens à mi-série`;
  const base = pluriel(reps, 'répétition');
  if (exercice.mouvement === 'rotation') return `${base}, à droite puis à gauche`;
  if (exercice.cotes === 'unilateral') return `${base} par côté`;
  if (exercice.cotes === 'alterne') return `${base} en alternant`;
  return base;
}

function libelleSuivant(suivant: Suivant): string {
  switch (suivant.type) {
    case 'serie':
      return `Série ${suivant.serie} / ${suivant.series}`;
    case 'station':
      return `Station ${suivant.station} / ${suivant.stations} · Tour ${suivant.tour} / ${suivant.tours}`;
    case 'retourCalme':
      return 'Retour au calme';
  }
}

/** Le bandeau de l'écran : où on en est dans la séance. Une séance de mobilité
 *  ne fait ni séries ni repos — elle tient des positions et se replace. */
function libellePhase(etape: Etape, mobilite: boolean): string {
  switch (etape.type) {
    case 'echauffement':
      return 'Échauffement';
    case 'pret':
      return 'Préparation';
    case 'serie':
      return mobilite ? 'Position' : 'Série';
    case 'repos':
      return mobilite ? 'Transition' : etape.manuel ? 'Installation' : 'Repos';
    case 'station':
      return 'Circuit';
    case 'reposTour':
      return 'Repos entre les tours';
    case 'retourCalme':
      return 'Retour au calme';
    case 'fin':
      return 'Séance terminée';
  }
}

/** « Exercice 2 / 6 » ou « Tour 2 / 3 · Station 1 / 5 ». */
function libellePosition(etapes: Etape[], index: number, ordreExercices: string[]): string {
  const etape = etapes[index];
  const precedente = etapes[index - 1];
  const station =
    etape.type === 'station'
      ? etape
      : etape.type === 'pret' && etape.suivant.type === 'station'
        ? etape.suivant
        : etape.type === 'repos' && precedente?.type === 'station'
          ? precedente
          : null;
  if (station) {
    return `Tour ${station.tour} / ${station.tours} · Station ${station.station} / ${station.stations}`;
  }
  if (etape.type === 'reposTour') return `Tour ${etape.tour} / ${etape.tours} terminé`;
  if (etape.exerciceId) {
    const numero = ordreExercices.indexOf(etape.exerciceId) + 1;
    if (numero > 0) return `Exercice ${numero} / ${ordreExercices.length}`;
  }
  return '';
}

/** Où en était une séance interrompue (écran d'accueil). */
function decrireEtape(etape: Etape): string {
  const nom = etape.exerciceId ? exerciceDeSeance(etape.exerciceId).nomFr : '';
  switch (etape.type) {
    case 'echauffement':
      return 'pendant l’échauffement';
    case 'pret':
      return `juste avant ${nom}`;
    case 'serie':
      return `pendant ${nom} (série ${etape.serie} / ${etape.series})`;
    case 'repos':
      return `pendant le repos après ${nom}`;
    case 'station':
      return `pendant le circuit (tour ${etape.tour} / ${etape.tours}, ${nom})`;
    case 'reposTour':
      return 'entre deux tours de circuit';
    case 'retourCalme':
      return 'pendant le retour au calme';
    case 'fin':
      return 'juste avant l’enregistrement';
  }
}

/** Les dernières secondes d'un décompte passent en rouge. */
/** Le mouvement en cours d'un échauffement ou d'un retour au calme, et ce
 *  qu'il lui reste. Chaque mouvement a sa durée (cinq minutes de tapis, trente
 *  secondes d'étirement) ; sans durée, ils se partagent l'étape. */
function lireMouvement(
  mouvements: MouvementGuide[],
  dureeEtapeSec: number,
  ecouleSec: number,
): { index: number; resteSec: number } {
  if (mouvements.length === 0 || dureeEtapeSec <= 0) return { index: 0, resteSec: 0 };
  const propres = mouvements.map((m) => m.dureeSec ?? 0);
  const total = propres.reduce((somme, d) => somme + d, 0);
  const durees =
    total > 0 && propres.every((d) => d > 0)
      ? propres.map((d) => (d * dureeEtapeSec) / total)
      : mouvements.map(() => dureeEtapeSec / mouvements.length);
  let fin = 0;
  for (let i = 0; i < durees.length; i += 1) {
    fin += durees[i];
    if (ecouleSec < fin || i === durees.length - 1) return { index: i, resteSec: Math.max(0, fin - ecouleSec) };
  }
  return { index: durees.length - 1, resteSec: 0 };
}

function couleurCompte(resteSec: number, normale: string): string {
  return resteSec <= SECONDES_ALERTE ? 'var(--alerte)' : normale;
}


// ------------------------------------------------------------- Composant

export default function SeanceGuidee({
  seance,
  progression,
  onProgression,
  onTerminee,
  onQuitter,
  chargesPassees = {},
  demarrage,
  synchro,
  chargeDerniereFois,
  essai,
}: SeanceGuideeProps) {
  // La progression proposée à la reprise est figée à l'ouverture : les
  // sauvegardes que nous envoyons ensuite reviennent dans cette même prop.
  const [progressionInitiale] = useState(progression);
  // Séance réellement déroulée : la prop, ou la séance sauvegardée si reprise.
  const [seanceActive, setSeanceActive] = useState<Seance>(seance);
  // Charges saisies : une valeur par série, index 0 = première série.
  const [poids, setPoids] = useState<Record<string, number[]>>({});
  // Le ressenti de chaque exercice, dit après sa dernière série (facultatif).
  const [ressentis, setRessentis] = useState<Record<string, Ressenti>>({});
  const [demarreeLe, setDemarreeLe] = useState<string | null>(null);

  const etapes = useMemo(() => construireEtapes(seanceActive), [seanceActive]);
  const dureeTotale = useMemo(() => dureeTotaleSec(etapes), [etapes]);
  const ordreExercices = useMemo(() => {
    const ids = [
      ...seanceActive.blocs.map((bloc) => bloc.exerciceId),
      ...(seanceActive.circuit?.stations ?? []),
    ];
    return ids.filter((id, i) => ids.indexOf(id) === i);
  }, [seanceActive]);
  const tempo = seanceActive.parametres.tempo;
  const mobilite = estMobilite(seanceActive.parametres);
  // Les séances enregistrées avant l'arrivée du réglage n'ont pas de guide.
  const guideVisuel: GuideVisuel = seanceActive.parametres.guideVisuel ?? 'les-deux';
  const unitePoids = uniteDeSeance(seanceActive.parametres);
  // À deux : le prénom de l'autre, pour dire qui fait sa série.
  const partenaire = seanceActive.horloge?.partenaire;
  const personne = seanceActive.horloge?.personne;
  const etirementsPause = useMemo(() => (personne ? etirementsPauseDe(personne) : []), [personne]);
  const blocDe = (exerciceId: string): BlocSeries | undefined =>
    seanceActive.blocs.find((bloc) => bloc.exerciceId === exerciceId);

  // À deux, avec le serveur : l'horloge commune mène la séance, la même sur
  // les deux téléphones. Sans réseau, elle tourne ici et rattrape le serveur
  // quand il revient.
  const enCommun = synchro !== undefined && partenaire !== undefined && seanceActive.blocs.some((b) => b.autre);
  const commune = useSeanceCommune(enCommun ? synchro : null);
  const etapesAutre = useMemo(() => {
    const autre = perspectiveAutre(seanceActive);
    return autre ? construireEtapes(autre) : [];
  }, [seanceActive]);
  const moteurLocal = useMoteurEtapes(etapes.length);
  const moteurCommun = useMoteurCommun(etapes, commune.etat, commune.heure, enCommun);
  const moteur = enCommun ? moteurCommun : moteurLocal;
  /** Un mot quand un bouton ne peut rien : « Max finit sa série. » */
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const delai = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(delai);
  }, [message]);

  // À chaque changement d'étape, on remonte en haut. C'est le conteneur plein
  // écran qui défile, pas la fenêtre (le défilement du corps est bloqué) :
  // sans cette remise à zéro, le nom de l'exercice reste sous l'en-tête.
  const conteneurRef = useRef<HTMLDivElement>(null);
  const visite = moteur.etat?.visite;
  useEffect(() => {
    if (visite === undefined) return;
    conteneurRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [visite]);

  // Bloque le défilement de la page derrière l'écran plein écran.
  useEffect(() => {
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = precedent;
    };
  }, []);
  const { etat, maintenant, allerA, lireEcouleSec } = moteur;
  const enCours = etat !== null;
  const enPause = etat?.enPause ?? false;
  const index = etat ? Math.min(etat.index, etapes.length - 1) : 0;
  const etape = etapes[index];
  const estFin = etape.type === 'fin';
  const ecoule = moteur.ecouleSec;
  const prolongation = etat?.prolongationSec ?? 0;
  const dureeEff = etape.dureeSec + prolongation;
  const reste = Math.max(0, dureeEff - ecoule);

  // Temps réel : étapes quittées + étape courante (rien sur l'étape finale).
  // Une attente où l'on arrive en avance (à deux) commence « avant zéro » :
  // pas de temps négatif au compteur.
  const tempsAvecCourante = ajouterTemps(etat?.tempsParEtapeSec ?? [], index, estFin ? 0 : Math.max(0, ecoule));
  // À deux, le temps écoulé est celui de la séance commune, pauses ôtées : les
  // attentes écourtées n'y comptent pas pour leur durée prévue. Il s'arrête à
  // l'écran de fin : le temps passé à le regarder ne compte pas.
  const [finAtteinteA, setFinAtteinteA] = useState<number | null>(null);
  const heureCommune = commune.heure;
  useEffect(() => {
    if (enCommun && estFin && finAtteinteA === null) setFinAtteinteA(heureCommune());
  }, [enCommun, estFin, finAtteinteA, heureCommune]);
  const tempsTotalEcoule =
    enCommun && commune.etat
      ? tempsActifMs(commune.etat, commune.etat.debut, finAtteinteA ?? commune.heure(), false) / 1000
      : tempsAvecCourante.reduce((total, t) => total + t, 0);
  const tempsRestant = dureeRestanteSec(etapes, index, ecoule, prolongation);

  // « +5 s » au changement de côté allonge la série d'autant : le côté gauche
  // repart d'autant plus tard.
  const metro = etatMetronome(etape, ecoule, tempo, prolongation);
  const changement = etatChangementCote(etape, ecoule, tempo, prolongation);
  const maintien = etatMaintien(etape, ecoule, prolongation);
  // Échauffement et retour au calme : ceux de la séance (tapis ou rameur,
  // étirements du poster), sinon ceux d'usage.
  const mouvements: MouvementGuide[] | null =
    etape.type === 'echauffement'
      ? (seanceActive.echauffement ?? ECHAUFFEMENT)
      : etape.type === 'retourCalme'
        ? (seanceActive.retourCalme ?? RETOUR_CALME)
        : null;
  const { index: indexMouvement, resteSec: resteMouvement } = lireMouvement(mouvements ?? [], dureeEff, ecoule);

  const verrou = useVerrouEcran(enCours && !estFin);

  // ------------------------------------------------ Transitions

  /** Change d'étape ; entrer dans une série ou une station sonne la cloche. */
  const naviguer = useCallback(
    (cible: number, now?: number) => {
      // iOS suspend le contexte audio quand l'écran se verrouille : chaque
      // geste est l'occasion de le réveiller.
      bellSound.unlock();
      const destination = etapes[Math.max(0, Math.min(cible, etapes.length - 1))];
      if (destination.type === 'serie' || destination.type === 'station') {
        bellSound.playBell('start');
      }
      allerA(cible, now);
    },
    [etapes, allerA],
  );

  // Clés du dernier événement sonore joué, préfixées par le numéro de visite
  // de l'étape : chaque son n'est joué qu'une fois par événement.
  const evenementsRef = useRef({ compteARebours: '', metronome: '', mouvement: '', avance: 0 });

  useEffect(() => {
    if (!etat || etat.enPause || estFin) return;
    const { visite } = etat;
    const ev = evenementsRef.current;
    const prefixe = `${visite}:`;

    // Trois derniers bips d'une préparation ou d'un repos. La prolongation
    // fait partie de la clé : après « +15 s », les bips doivent rejouer.
    if (etape.type === 'pret' || etape.type === 'repos' || etape.type === 'reposTour') {
      const secondes = Math.ceil(reste);
      if (secondes >= 1 && secondes <= 3) {
        const cle = `${prefixe}${prolongation}:${secondes}`;
        if (ev.compteARebours !== cle) {
          ev.compteARebours = cle;
          if (etape.type === 'pret') bellSound.playTick('pret');
          else bellSound.playCountdown();
        }
      }
    }

    // Changement de côté : un bip pour poser la charge, puis les trois
    // derniers, comme une préparation — « +5 s » les fait rejouer.
    const CHANGEMENT = `${prefixe}changement`;
    if (changement) {
      if (ev.metronome !== CHANGEMENT && ev.metronome.startsWith(prefixe)) bellSound.playTick('pret');
      const secondes = Math.ceil(changement.resteSec);
      if (secondes >= 1 && secondes <= 3) {
        const cle = `${prefixe}${prolongation}:cote:${secondes}`;
        if (ev.compteARebours !== cle) {
          ev.compteARebours = cle;
          bellSound.playTick('pret');
        }
      }
      ev.metronome = CHANGEMENT;
    }

    // Métronome : un bip au début de chaque phase. La toute première phase
    // de l'étape ne bipe pas : la cloche vient de sonner. Le côté gauche
    // repart sur la cloche, après le changement de côté ; le changement de
    // sens d'un cercle sonne comme un départ, sans arrêter le tour.
    if (metro) {
      const cle = `${prefixe}${metro.cycle}:${metro.phase}`;
      if (ev.metronome !== cle) {
        const memeEtape = ev.metronome.startsWith(prefixe);
        const apresChangement = ev.metronome === CHANGEMENT;
        ev.metronome = cle;
        if (apresChangement) bellSound.playBell('start');
        else if (memeEtape) bellSound.playTick(metro.changeDeSens ? 'pret' : metro.phase);
      }
    }

    // Au temps : le côté gauche repart sur la cloche, après le changement de
    // côté ; un cercle change de sens d'un bip, sans s'arrêter.
    if (maintien) {
      const cle = `${prefixe}${maintien.cote ?? maintien.sens}`;
      if (ev.metronome !== cle) {
        const memeEtape = ev.metronome.startsWith(prefixe);
        const apresChangement = ev.metronome === CHANGEMENT;
        ev.metronome = cle;
        if (apresChangement) bellSound.playBell('start');
        else if (memeEtape && maintien.sens === 'second') bellSound.playTick('pret');
      }
    }

    // Changement de mouvement d'échauffement ou d'étirement.
    if (mouvements) {
      const cle = `${prefixe}${indexMouvement}`;
      if (ev.mouvement !== cle) {
        const memeEtape = ev.mouvement.startsWith(prefixe);
        ev.mouvement = cle;
        if (memeEtape) bellSound.playTick('pret');
      }
    }

    // Fin de l'étape : passage automatique à la suivante — sauf quand la
    // séance attend « Go ».
    const attendGo = etape.type === 'repos' && etape.manuel === true;
    // À deux, l'étape suit l'horloge commune d'elle-même.
    if (!enCommun && ecoule >= dureeEff && ev.avance !== visite && !attendGo) {
      ev.avance = visite;
      if (etape.type === 'serie' || etape.type === 'station') bellSound.playBell('end');
      const finPrevueMs = etat.debutEtapeMs + dureeEff * 1000;
      const depart = maintenant - finPrevueMs <= TOLERANCE_FIN_MS ? finPrevueMs : maintenant;
      naviguer(index + 1, depart);
    }
  }, [etat, estFin, etape, reste, prolongation, metro, changement, maintien, mouvements, indexMouvement, ecoule, dureeEff, maintenant, index, naviguer, enCommun]);

  // À deux, la cloche sonne quand l'horloge commune entre dans une série, et
  // quand elle en sort.
  const etapeSonnee = useRef<Etape | null>(null);
  useEffect(() => {
    if (!enCommun || !etat) return;
    const avant = etapeSonnee.current;
    etapeSonnee.current = etape;
    if (!avant || avant === etape) return;
    if (etape.type === 'serie' || etape.type === 'station') bellSound.playBell('start');
    else if (avant.type === 'serie' || avant.type === 'station') bellSound.playBell('end');
  }, [enCommun, etat, etape]);

  // ------------------------------------------------ Sauvegarde

  const onProgressionRef = useRef(onProgression);
  useEffect(() => {
    onProgressionRef.current = onProgression;
  }, [onProgression]);
  /** Vrai dès que la séance est enregistrée ou abandonnée : plus de sauvegarde. */
  const clotureeRef = useRef(false);
  const sauvegardeRef = useRef<{
    visite: number;
    ms: number;
    poids: Record<string, number[]> | null;
    ressentis: Record<string, Ressenti> | null;
  }>({
    visite: 0,
    ms: 0,
    poids: null,
    ressentis: null,
  });

  useEffect(() => {
    // Un essai ne laisse rien : pas de reprise proposée au rechargement.
    if (!etat || !demarreeLe || clotureeRef.current || essai) return;
    const derniere = sauvegardeRef.current;
    const nouvelleEtape = derniere.visite !== etat.visite;
    const periodique = maintenant - derniere.ms >= INTERVALLE_SAUVEGARDE_MS;
    const poidsModifie = derniere.poids !== poids || derniere.ressentis !== ressentis;
    if (!nouvelleEtape && !periodique && !poidsModifie) return;
    sauvegardeRef.current = { visite: etat.visite, ms: maintenant, poids, ressentis };
    onProgressionRef.current({
      seance: seanceActive,
      indexEtape: index,
      tempsCumuleSec: Math.round(tempsTotalEcoule),
      tempsParEtapeSec: tempsAvecCourante.map((t) => Math.round(t)),
      poids,
      ressentis,
      demarreeLe,
      sauvegardeeLe: new Date(maintenant).toISOString(),
    });
  }, [etat, demarreeLe, maintenant, poids, ressentis, seanceActive, index, tempsTotalEcoule, tempsAvecCourante, essai]);

  // ------------------------------------------------ Actions

  const demarrerSeance = (
    source: Seance,
    indexDepart: number,
    temps: number[],
    poidsInitial: Record<string, number[]>,
    debut: string,
    ressentisInitiaux: Record<string, Ressenti> = {},
  ) => {
    // Geste utilisateur : on en profite pour débloquer l'audio et l'écran.
    bellSound.unlock();
    void verrou.demander();
    clotureeRef.current = false;
    setSeanceActive(source);
    setPoids(poidsInitial);
    setRessentis(ressentisInitiaux);
    setDemarreeLe(debut);
    // À deux : on commence la séance commune, ou on la rejoint.
    if (enCommun) commune.envoyer({ type: 'commencer' });
    moteur.demarrer(indexDepart, temps);
    bellSound.playBell('start');
  };

  const commencer = () => demarrerSeance(seance, 0, [], {}, new Date().toISOString());

  const reprendreSeance = () => {
    const sauvee = progressionInitiale;
    if (!sauvee) return;
    const etapesSauvees = construireEtapes(sauvee.seance);
    demarrerSeance(
      sauvee.seance,
      indexReprise(etapesSauvees, sauvee.indexEtape),
      sauvee.tempsParEtapeSec ?? [],
      sauvee.poids ?? {},
      sauvee.demarreeLe || new Date().toISOString(),
      sauvee.ressentis ?? {},
    );
  };

  // Démarrage direct : une seule fois, même quand le mode strict de React
  // rejoue les effets au montage.
  const demarrageFaitRef = useRef(false);
  useEffect(() => {
    if (!demarrage || demarrageFaitRef.current) return;
    demarrageFaitRef.current = true;
    if (demarrage === 'reprise' && progressionInitiale) reprendreSeance();
    else commencer();
    // Au montage uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** À deux : ce que voit ce téléphone, et l'autre, sur l'horloge commune. */
  const contexteCommun = (): Contexte | null =>
    commune.etat && moteurCommun.position
      ? {
          etapes,
          etapesAutre,
          etat: commune.etat,
          t: commune.heure(),
          position: moteurCommun.position,
          partenaire: partenaire ?? 'l’autre',
          tempo,
        }
      : null;
  /** Un appui, à deux : pour les deux, pour moi seul, ou rien — avec un mot. */
  const decider = (choisir: (contexte: Contexte) => Decision) => {
    bellSound.unlock();
    const contexte = contexteCommun();
    if (!contexte) return;
    const decision = choisir(contexte);
    if (decision.genre === 'refus') {
      if (decision.raison) setMessage(decision.raison);
      return;
    }
    if (decision.genre === 'locale') {
      moteurCommun.setEcart(decision.ecart);
      return;
    }
    if (decision.confirmer && !window.confirm(decision.confirmer)) return;
    commune.envoyer(decision.action);
  };

  const basculerPause = () => {
    bellSound.unlock();
    if (enCommun) commune.envoyer({ type: enPause ? 'reprendre' : 'pause' });
    else if (enPause) moteur.reprendre();
    else moteur.pause();
  };
  const precedent = () => {
    // À deux, on ne revient pas en arrière : l'horloge est commune.
    if (!enCommun) naviguer(indexEtapePrecedente(etapes, index));
  };
  const suivant = () => (enCommun ? decider(decisionSuivant) : naviguer(index + 1));
  const passerExercice = () =>
    enCommun ? decider(decisionPasserExercice) : naviguer(indexApresExercice(etapes, index));
  const prolongerRepos = () =>
    enCommun
      ? decider((contexte) => decisionProlonger(contexte, PROLONGATION_REPOS_SEC))
      : moteur.prolonger(PROLONGATION_REPOS_SEC);
  /** « +5 s » au changement de côté : la même mécanique que « +15 s » au
   *  repos. À deux, l'horloge commune s'arrête cinq secondes pour les deux,
   *  sauf si l'autre est en pleine série. */
  const prolongerChangement = () =>
    enCommun
      ? decider((contexte) => decisionProlonger(contexte, PROLONGATION_CHANGEMENT_SEC))
      : moteur.prolonger(PROLONGATION_CHANGEMENT_SEC);

  /** Enregistre la charge d'une série précise (numérotée à partir de 1). */
  const changerPoids = (exerciceId: string, serie: number, charge: number | null) =>
    setPoids((precedents) => {
      const actuelles = precedents[exerciceId] ?? [];
      const valeur = charge !== null && charge > 0 ? charge : 0;
      if ((actuelles[serie - 1] ?? 0) === valeur) return precedents;
      const suivantes = [...actuelles];
      while (suivantes.length < serie) suivantes.push(0);
      suivantes[serie - 1] = valeur;
      while (suivantes.length > 0 && suivantes[suivantes.length - 1] === 0) suivantes.pop();
      const suivants = { ...precedents };
      if (suivantes.length > 0) suivants[exerciceId] = suivantes;
      else delete suivants[exerciceId];
      return suivants;
    });

  /** Dit le ressenti d'un exercice ; en toucher un autre plus tard le change. */
  const choisirRessenti = (exerciceId: string, ressenti: Ressenti) =>
    setRessentis((precedents) => (precedents[exerciceId] === ressenti ? precedents : { ...precedents, [exerciceId]: ressenti }));

  // Un essai ne garde rien : sa séance faite n'est jamais enregistrée, ressentis compris.
  const realisation = (terminee: boolean): SeanceRealisee =>
    avecRessentis(
      agregerRealisation(seanceActive, etapes, tempsAvecCourante, poids, tempsTotalEcoule, terminee),
      ressentis,
    );

  const enregistrer = () => {
    clotureeRef.current = true;
    onTerminee(realisation(true));
    onProgression(null);
  };

  const abandonner = () => {
    clotureeRef.current = true;
    // Un essai ne touche pas à la séance interrompue qui attend, s'il y en a une.
    if (!essai) onProgression(null);
    onQuitter();
  };

  const quitter = () => {
    if (!etat) {
      // Rien n'a commencé : on garde une éventuelle progression sauvegardée.
      onQuitter();
      return;
    }
    // Le dialogue bloque le rendu, pas l'horloge : on met en pause le temps
    // de la question, puis on reprend si l'utilisateur renonce à quitter.
    // À deux, la pause arrêterait aussi l'autre : l'horloge continue.
    const etaitEnPause = enPause || enCommun;
    if (!etaitEnPause) moteur.pause();
    if (!window.confirm('Quitter la séance en cours ?')) {
      if (!etaitEnPause) moteur.reprendre();
      return;
    }
    const partielle = realisation(false);
    const faites = partielle.exercices.reduce((total, e) => total + e.seriesFaites, 0);
    if (
      !essai &&
      faites > 0 &&
      window.confirm(
        `Enregistrer cette séance partielle (${pluriel(faites, 'série')} faite${faites > 1 ? 's' : ''}) dans l’historique ?`,
      )
    ) {
      clotureeRef.current = true;
      onTerminee(partielle);
      onProgression(null);
      return;
    }
    abandonner();
  };

  // ------------------------------------------------ Rendu

  if (!etat) {
    // Démarrage direct : le fond de la séance, le temps d'un rendu.
    if (demarrage) {
      return <div className="fixed inset-0 z-50" style={{ background: 'var(--fond)' }} />;
    }
    return (
      <EcranAccueil
        seance={seance}
        etapes={etapes}
        ordreExercices={ordreExercices}
        progression={progressionInitiale}
        onCommencer={commencer}
        onReprendre={reprendreSeance}
        onQuitter={quitter}
      />
    );
  }

  const exercice = etape.exerciceId ? exerciceDeSeance(etape.exerciceId) : null;
  const ambiance = ambianceEtape(etape);
  // Après la dernière série d'un exercice : lourd, correct ou léger ? Pendant
  // la pause qui suit, ou, pour le dernier exercice, aux étirements.
  const panneauRessenti = (
    <BoutonsRessenti
      exercices={exercicesAEvaluer(etapes, index)
        .map(exerciceDeSeance)
        .filter((e) => !estPosture(e))
        .map((e) => ({ id: e.id, nom: e.nomFr }))}
      ressentis={ressentis}
      onChoisir={choisirRessenti}
    />
  );
  let corps: ReactNode;
  switch (etape.type) {
    case 'echauffement':
    case 'retourCalme':
      corps = (
        <div className="space-y-4">
          <CorpsMouvements
            titre={
              etape.type === 'echauffement'
                ? seanceActive.echauffement
                  ? 'Échauffement : on monte doucement en température'
                  : 'Échauffement articulaire, sans charge'
                : 'Étirements doux, sans à-coups'
            }
            mouvements={mouvements ?? []}
            indexMouvement={indexMouvement}
            resteMouvementSec={resteMouvement}
            resteSec={reste}
          />
          {etape.type === 'retourCalme' && panneauRessenti}
        </div>
      );
      break;
    case 'pret':
      corps = exercice && (
        <CorpsPret
          etape={etape}
          exercice={exercice}
          resteSec={reste}
          onDemarrer={suivant}
          onPasser={passerExercice}
        />
      );
      break;
    case 'serie':
    case 'station':
      corps = exercice && (
        <CorpsTravail
          key={`${etape.exerciceId}-${index}`}
          etape={etape}
          exercice={exercice}
          metro={metro}
          changement={changement}
          onProlongerChangement={prolongerChangement}
          maintien={maintien}
          resteSec={reste}
          tempo={tempo}
          prolongationSec={prolongation}
          guideVisuel={guideVisuel}
          lireEcouleSec={lireEcouleSec}
          bloc={blocDe(etape.exerciceId)}
          personne={personne}
          poidsSeries={poids[etape.exerciceId] ?? []}
          chargesPassees={chargesPassees[etape.exerciceId] ?? []}
          unitePoids={unitePoids}
          onPoids={(serie, charge) => changerPoids(etape.exerciceId, serie, charge)}
          onTerminee={suivant}
          onPasser={passerExercice}
        />
      );
      break;
    case 'repos':
    case 'reposTour': {
      // La charge à installer pour la série qui vient.
      const cible = etape.suivant;
      const charge =
        cible.type === 'serie'
          ? chargeDeSerie(
              blocDe(cible.exerciceId),
              poids[cible.exerciceId] ?? [],
              chargesPassees[cible.exerciceId] ?? [],
              cible.serie,
            )
          : 0;
      // Un étirement par longue pause, à tour de rôle.
      const etirement =
        etirementsPause.length > 0 && pauseAEtirement(etape)
          ? etirementsPause[etapes.slice(0, index).filter(pauseAEtirement).length % etirementsPause.length]
          : undefined;
      corps = (
        <CorpsRepos
          etape={etape}
          resteSec={reste}
          partenaire={partenaire}
          charge={charge > 0 ? `${charge} ${SUFFIXE_UNITE[unitePoids]}` : undefined}
          etirement={etirement}
          ressenti={panneauRessenti}
          onProlonger={prolongerRepos}
          onPasser={suivant}
        />
      );
      break;
    }
    case 'fin':
      corps = (
        <CorpsFin
          realisee={realisation(true)}
          chargeDerniereFois={chargeDerniereFois}
          essai={essai}
          onEnregistrer={enregistrer}
          onAbandonner={abandonner}
        />
      );
      break;
  }

  return (
    <div
      ref={conteneurRef}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto transition-colors duration-500"
      style={{ background: ambiance.fond, color: 'var(--texte)' }}
    >
      <EnTete
        phase={libellePhase(etape, mobilite)}
        position={libellePosition(etapes, index, ordreExercices)}
        exercice={etape.exerciceId ? exerciceDeSeance(etape.exerciceId).nomFr : undefined}
        couleur={ambiance.couleur}
        avancement={
          dureeTotale <= 0 ? 0 : enCommun ? 1 - tempsRestant / dureeTotale : tempsTotalEcoule / dureeTotale
        }
        ecouleSec={tempsTotalEcoule}
        resteSec={tempsRestant}
        bandeau={essai?.bandeau}
        onQuitter={quitter}
      />
      {enCommun && (
        <div
          className="py-1.5 text-center text-sm font-semibold"
          style={{ background: 'var(--surface-haute)', color: commune.enLigne ? 'var(--montee)' : 'var(--pause)' }}
        >
          {!commune.enLigne
            ? 'Hors ligne · appuyez sur « Go » ensemble'
            : personne && commune.presents.includes(autrePersonne(personne))
              ? `En direct avec ${partenaire}`
              : `En direct · ${partenaire} n’a pas encore rejoint`}
        </div>
      )}
      {enPause && (
        <div
          className="py-2 text-center font-semibold"
          style={{ background: 'var(--pause)', color: 'var(--accent-texte)' }}
        >
          En pause · le chrono est arrêté{enCommun ? ' pour les deux' : ''}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="py-2 text-center font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accent-texte)' }}
        >
          {message}
        </div>
      )}
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">{corps}</main>
      <footer
        className="sticky bottom-0 px-4 pt-3"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--bordure)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto flex max-w-md gap-2">
          <Bouton variante="neutre" taille="etroit" onClick={precedent} disabled={index === 0 || enCommun} className="flex-1">
            Précédent
          </Bouton>
          {!estFin && (
            <Bouton variante="pause" onClick={basculerPause} className="flex-[1.5]">
              {enPause ? 'Reprendre' : 'Pause'}
            </Bouton>
          )}
          {!estFin && (
            <Bouton variante="neutre" taille="etroit" onClick={suivant} className="flex-1">
              Suivant
            </Bouton>
          )}
        </div>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------- Écrans

interface EcranAccueilProps {
  seance: Seance;
  etapes: Etape[];
  ordreExercices: string[];
  progression: ProgressionSeance | null;
  onCommencer: () => void;
  onReprendre: () => void;
  onQuitter: () => void;
}

function EcranAccueil({
  seance,
  etapes,
  ordreExercices,
  progression,
  onCommencer,
  onReprendre,
  onQuitter,
}: EcranAccueilProps) {
  const { tempo } = seance.parametres;
  const etapesSauvees = progression ? construireEtapes(progression.seance) : null;
  const etapeSauvee = etapesSauvees
    ? etapesSauvees[Math.max(0, Math.min(progression?.indexEtape ?? 0, etapesSauvees.length - 1))]
    : null;

  const chiffreCle = 'chiffres text-2xl font-bold';
  const legende = 'text-xs';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ background: 'var(--fond)', color: 'var(--texte)' }}
    >
      <header
        className="flex items-center justify-between px-4 pb-3"
        style={{
          borderBottom: '1px solid var(--bordure)',
          background: 'var(--surface)',
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <h2 className="text-lg font-bold">Séance guidée</h2>
        <Bouton variante="neutre" taille="petit" onClick={onQuitter} className="shrink-0">
          Quitter
        </Bouton>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-6">
        <div className="grid grid-cols-3 gap-2 rounded-2xl p-4 text-center" style={{ background: 'var(--surface)' }}>
          <div>
            <div className={chiffreCle}>{formaterDureeCourte(dureeTotaleSec(etapes))}</div>
            <div className={legende} style={{ color: 'var(--texte-discret)' }}>durée estimée</div>
          </div>
          <div>
            <div className={chiffreCle}>{ordreExercices.length}</div>
            <div className={legende} style={{ color: 'var(--texte-discret)' }}>
              {ordreExercices.length > 1 ? 'exercices' : 'exercice'}
            </div>
          </div>
          <div>
            <div className={chiffreCle}>
              {tempo.monteeSec} / {tempo.descenteSec}
            </div>
            <div className={legende} style={{ color: 'var(--texte-discret)' }}>
              tempo (s){tempo.pauseSec ? ` + ${tempo.pauseSec} s en bas` : ''}
            </div>
          </div>
        </div>

        <ul className="overflow-hidden rounded-2xl" style={{ background: 'var(--surface)' }}>
          {ordreExercices.map((id, i) => {
            const exercice = exerciceDeSeance(id);
            return (
              <li
                key={id}
                className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? 'border-t' : ''}`}
                style={{ borderColor: 'var(--bordure)' }}
              >
                <Vignette exerciceId={id} alt="" className="w-14 shrink-0 rounded-lg" />
                <span>
                  <span className="chiffres mr-2" style={{ color: 'var(--texte-discret)' }}>
                    {i + 1}.
                  </span>
                  {exercice.nomFr}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          L’application dicte le tempo : suivez la bille et les bips, elle compte les répétitions à votre
          place. Séries lentes, sans rebond, pour protéger tendons et ligaments.
        </p>
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          La bonne charge : les deux dernières répétitions sont dures, la forme reste intacte, et il
          vous en resterait deux. Jamais jusqu’à l’échec.
          {tempo.pauseSec
            ? ' Pendant la pause en bas, les muscles restent engagés. Les exercices dont la position basse est un repos — Superman, pont fessier, élévations… — tiennent en haut, muscles serrés. Ceux qui fatiguent le dos ou le genou se font sans arrêt en bas.'
            : ''}
        </p>

        {progression && etapeSauvee ? (
          <div className="space-y-3">
            <div
              className="rounded-2xl p-3 text-sm"
              style={{ background: 'var(--surface)', border: '2px solid var(--pause)' }}
            >
              Une séance a été interrompue {decrireEtape(etapeSauvee)}, après{' '}
              {formaterDureeCourte(progression.tempsCumuleSec)} d’effort.
            </div>
            <Bouton variante="accent" taille="vedette" onClick={onReprendre} className="w-full">
              Reprendre la séance
            </Bouton>
            <Bouton variante="neutre" onClick={onCommencer} className="w-full">
              Recommencer du début
            </Bouton>
          </div>
        ) : (
          <Bouton variante="accent" taille="vedette" onClick={onCommencer} className="w-full">
            Commencer
          </Bouton>
        )}

        <p className="text-center text-xs" style={{ color: 'var(--texte-discret)' }}>
          Le son et le maintien de l’écran allumé s’activent au premier appui.
        </p>
      </main>
    </div>
  );
}

interface EnTeteProps {
  phase: string;
  position: string;
  /** Nom de l'exercice en cours, pour qu'il reste lisible quand le corps
   *  de la page défile sous l'en-tête collant. */
  exercice?: string;
  /** Couleur de la phase : barre de progression et nom de la phase. */
  couleur: string;
  /** Avancement de la séance, de 0 à 1. */
  avancement: number;
  ecouleSec: number;
  resteSec: number;
  /** Essai ou aperçu : une ligne tout en haut, qui ne quitte pas l'écran. */
  bandeau?: string;
  onQuitter: () => void;
}

function EnTete({
  phase,
  position,
  exercice,
  couleur,
  avancement,
  ecouleSec,
  resteSec,
  bandeau,
  onQuitter,
}: EnTeteProps) {
  const rempli = Math.min(100, Math.max(0, avancement * 100));
  return (
    <header
      className="sticky top-0 z-10"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bordure)' }}
    >
      {bandeau && (
        <div
          className="px-4 pb-1 text-center text-xs font-bold"
          style={{
            background: 'var(--tenue)',
            color: 'var(--accent-texte)',
            paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
          }}
        >
          {bandeau}
        </div>
      )}
      <div className="h-1 w-full" style={{ background: 'var(--bordure)' }}>
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${rempli.toFixed(1)}%`, background: couleur }}
        />
      </div>
      <div
        className="mx-auto max-w-md px-4 pb-2"
        style={{ paddingTop: bandeau ? '0.5rem' : 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: couleur }}>
              {phase}
            </div>
            <div className="truncate font-semibold" style={ARCHIVO}>
              {exercice || position || ' '}
            </div>
            {exercice && position && (
              <div className="truncate text-xs" style={{ color: 'var(--texte-discret)' }}>
                {position}
              </div>
            )}
          </div>
          <Bouton variante="neutre" taille="petit" onClick={onQuitter} className="shrink-0">
            Quitter
          </Bouton>
        </div>
        <div className="chiffres mt-1 flex justify-between text-sm" style={{ color: 'var(--texte-discret)' }}>
          <span>Écoulé {formaterMmSs(ecouleSec)}</span>
          <span>Reste ~ {formaterMmSs(resteSec)}</span>
        </div>
      </div>
    </header>
  );
}

interface CorpsMouvementsProps {
  titre: string;
  mouvements: MouvementGuide[];
  indexMouvement: number;
  resteMouvementSec: number;
  resteSec: number;
}

/** Échauffement et retour au calme : les mouvements défilent automatiquement. */
function CorpsMouvements({ titre, mouvements, indexMouvement, resteMouvementSec, resteSec }: CorpsMouvementsProps) {
  const courant = mouvements[indexMouvement];
  const prochain = mouvements[indexMouvement + 1];
  return (
    <div className="space-y-4 text-center">
      <div
        className="chiffres text-8xl font-bold leading-none"
        style={{ color: couleurCompte(resteSec, 'var(--texte)') }}
      >
        {formaterMmSs(Math.ceil(resteSec))}
      </div>
      <p style={{ color: 'var(--texte-discret)' }}>{titre}</p>
      {courant && (
        <div className="rounded-2xl p-4 text-left" style={{ background: 'var(--surface)' }}>
          <div
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: 'var(--texte-discret)' }}
          >
            {indexMouvement + 1} / {mouvements.length} ·{' '}
            <span className="chiffres">
              {resteMouvementSec >= 60 ? formaterMmSs(Math.ceil(resteMouvementSec)) : `${Math.ceil(resteMouvementSec)} s`}
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold">{courant.nom}</div>
          {courant.exerciceId && (
            <Vignette exerciceId={courant.exerciceId} alt={courant.nom} className="mt-3 w-full rounded-xl" />
          )}
          <p className="mt-2" style={{ color: 'var(--texte-discret)' }}>{courant.consigne}</p>
        </div>
      )}
      {prochain && (
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          Ensuite : {prochain.nom}
        </p>
      )}
    </div>
  );
}

interface CorpsPretProps {
  etape: Extract<Etape, { type: 'pret' }>;
  exercice: Exercice;
  resteSec: number;
  onDemarrer: () => void;
  onPasser: () => void;
}

function CorpsPret({ etape, exercice, resteSec, onDemarrer, onPasser }: CorpsPretProps) {
  const cible = etape.suivant;
  const sousTitre =
    cible.type !== 'serie'
      ? `Tour ${cible.tour} / ${cible.tours} · Station ${cible.station} / ${cible.stations}`
      : estPosture(exercice)
        ? // Une position ne se répète pas : « Série 1 / 1 » n'apprendrait rien.
          libelleReps(exercice, cible.reps)
        : `Série ${cible.serie} / ${cible.series} · ${libelleReps(exercice, cible.reps)}`;
  // Comment part la répétition : par la montée ou la descente, ou, sans haut
  // ni bas, un tour ou un va-et-vient.
  const forme = formeDe(exercice);
  const depart =
    exercice.unite !== 'reps'
      ? estCercleAuTemps(exercice) || exercice.explosif
        ? ' · à son rythme, sans métronome'
        : ''
      : forme === 'circulaire'
        ? ' · un tour complet par répétition'
        : forme === 'rotation'
          ? ' · à droite puis à gauche'
          : ` · départ par la ${premierePhase(exercice) === 'descend' ? 'descente' : 'montée'}`;

  return (
    <div className="space-y-4">
      <Vignette
        exerciceId={exercice.id}
        alt={exercice.nomFr}
        className="mx-auto w-full max-w-md rounded-2xl"
      />
      <div className="text-center">
        <h2 className="text-2xl font-bold">{exercice.nomFr}</h2>
        <p style={{ color: 'var(--texte-discret)' }}>{sousTitre}</p>
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          {exercice.position}
          {depart}
        </p>
      </div>
      <div className="text-center">
        <div
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: 'var(--accent)' }}
        >
          Préparez-vous
        </div>
        <div
          className="chiffres text-8xl font-bold leading-none"
          style={{ color: couleurCompte(resteSec, 'var(--texte)') }}
        >
          {Math.ceil(resteSec)}
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5" style={{ color: 'var(--texte-discret)' }}>
        {consignesDe(exercice).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <Bouton variante="accent" onClick={onDemarrer} className="w-full">
        Démarrer maintenant
      </Bouton>
      <Bouton variante="fantome" onClick={onPasser} className="w-full underline">
        Passer cet exercice
      </Bouton>
    </div>
  );
}

interface CorpsTravailProps {
  etape: EtapeTravail;
  exercice: Exercice;
  metro: EtatMetronome | null;
  /** Le changement de côté au milieu d'une série unilatérale ; null sinon. */
  changement: EtatChangementCote | null;
  /** « +5 s » au changement de côté. */
  onProlongerChangement: () => void;
  /** Position tenue d'un côté puis de l'autre ; null sinon. */
  maintien: EtatMaintien | null;
  resteSec: number;
  tempo: Tempo;
  /** Ce que « +5 s » a ajouté au changement de côté de cette série. */
  prolongationSec: number;
  guideVisuel: GuideVisuel;
  /** Horloge de l'étape, lue à chaque image par la bille. */
  lireEcouleSec: () => number;
  /** Le bloc de la séance : le cran que propose le ressenti. */
  bloc?: BlocSeries;
  /** Qui s'entraîne : les seuils du ressenti sont les siens. */
  personne?: Personne;
  /** Charges déjà saisies pour cet exercice, index 0 = première série. */
  poidsSeries: number[];
  /** Charges de la dernière fois, série par série ; vide si aucune. */
  chargesPassees: number[];
  unitePoids: UnitePoids;
  onPoids: (serie: number, charge: number | null) => void;
  onTerminee: () => void;
  onPasser: () => void;
}

function CorpsTravail({
  etape,
  exercice,
  metro,
  changement,
  onProlongerChangement,
  maintien,
  resteSec,
  tempo,
  prolongationSec,
  guideVisuel,
  lireEcouleSec,
  bloc,
  personne,
  poidsSeries,
  chargesPassees,
  unitePoids,
  onPoids,
  onTerminee,
  onPasser,
}: CorpsTravailProps) {
  // Numéro de la série en cours : le tour, pour une station de circuit.
  const serieCourante = etape.type === 'serie' ? etape.serie : etape.tour;
  const dejaSaisi = poidsSeries[serieCourante - 1] ?? 0;
  // Sans saisie pour cette série, on propose la charge de la série d'avant,
  // sinon celle de la dernière fois — un cran plus loin si le ressenti le
  // demande.
  const valeurDepart = chargeDeSerie(bloc, poidsSeries, chargesPassees, serieCourante);
  // Le cran proposé sur la charge de la dernière fois : le ressenti.
  const ajustement = chargesPassees.some((charge) => charge > 0) ? ajustementDeCharge(bloc) : null;
  // Une série longue qui charge le bas du dos : le rappel qui protège.
  const dosAMenager = etape.type === 'serie' && etape.reps >= 10 && chargeLeBasDuDos(exercice);

  // Le texte saisi est gardé tel quel (« 12, » ne doit pas être réécrit en
  // « 12 » à chaque frappe) ; seule la valeur numérique remonte au parent.
  const [texte, setTexte] = useState(valeurDepart > 0 ? String(valeurDepart) : '');
  const saisirPoids = (evenement: ChangeEvent<HTMLInputElement>) => {
    const valeur = evenement.target.value;
    setTexte(valeur);
    const charge = Number.parseFloat(valeur.replace(',', '.'));
    onPoids(serieCourante, Number.isFinite(charge) ? charge : null);
  };

  // La charge proposée est enregistrée d'office : sans cela, une série faite
  // avec la même charge ressortirait vide du bilan.
  const reprise = dejaSaisi === 0 ? valeurDepart : 0;
  useEffect(() => {
    if (reprise > 0) onPoids(serieCourante, reprise);
    // Au montage uniquement : le composant est remonté à chaque étape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const posture = estPosture(exercice);
  const sousTitre =
    etape.type !== 'serie'
      ? `Tour ${etape.tour} / ${etape.tours} · Station ${etape.station} / ${etape.stations} · ${etape.dureeSec} s`
      : posture
        ? // Une position ne se fait qu'une fois : afficher « Série 1 / 1 »
          // n'apprendrait rien. On annonce la tenue, et le côté s'il y en a.
          libelleReps(exercice, etape.reps)
        : `Série ${etape.serie} / ${etape.series} · ${libelleReps(exercice, etape.reps)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Vignette exerciceId={exercice.id} alt="" className="w-28 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight">{exercice.nomFr}</h2>
          <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>{sousTitre}</p>
        </div>
      </div>

      {dosAMenager && (
        <p
          className="rounded-2xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--surface)', color: 'var(--alerte)' }}
        >
          Si le dos s’arrondit, on arrête la série.
        </p>
      )}

      {changement ? (
        <ChangementDeCote changement={changement} onProlonger={onProlongerChangement} />
      ) : metro ? (
        <Metronome
          etape={etape}
          metro={metro}
          exercice={exercice}
          tempo={tempo}
          prolongationSec={prolongationSec}
          guideVisuel={guideVisuel}
          lireEcouleSec={lireEcouleSec}
        />
      ) : maintien?.sens ? (
        <CercleAuTemps maintien={maintien} avecCercle={guideVisuel !== 'chiffre'} />
      ) : (
        // Exercice au temps : pas de répétition à rythmer, donc pas de bille,
        // seulement le décompte du maintien.
        <div className="select-none py-2 text-center">
          <div
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: maintien ? 'var(--accent)' : 'var(--texte-discret)' }}
          >
            {maintien?.cote
              ? `Côté ${maintien.cote}`
              : etape.type === 'station' && etape.rythme === 'libre'
                ? 'À fond jusqu’au signal'
                : posture
                  ? 'Tenez la position'
                  : exercice.explosif
                    ? 'À ton rythme, léger'
                    : 'Maintenez l’effort'}
          </div>
          <div
            className="chiffres text-9xl font-bold leading-none"
            style={{
              color: couleurCompte(maintien ? maintien.resteSec : resteSec, 'var(--montee)'),
            }}
          >
            {Math.ceil(maintien ? maintien.resteSec : resteSec)}
          </div>
          <div className="mt-3 text-sm" style={{ color: 'var(--texte-discret)' }}>
            {maintien
              ? maintien.cote === 'droit'
                ? 'secondes, puis on change de côté'
                : 'secondes restantes'
              : 'secondes restantes'}
          </div>
        </div>
      )}

      <details className="rounded-2xl px-4" style={{ background: 'var(--surface)' }}>
        <summary className="cursor-pointer py-3 font-medium">Points d’attention</summary>
        <ul className="list-disc space-y-1 pb-3 pl-5" style={{ color: 'var(--texte-discret)' }}>
          {consignesDe(exercice).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>

      {/* Une posture de yoga ou un étirement ne se charge pas : la case de
          saisie n'aurait rien à recevoir. */}
      {!posture && (
      <label
        className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
        style={{ background: 'var(--surface)' }}
      >
        <span className="min-w-0">
          <span className="block font-medium">
            Poids série <span className="chiffres">{serieCourante}</span> (
            {SUFFIXE_UNITE[unitePoids]})
          </span>
          {poidsSeries.some((charge) => charge > 0) && (
            <span className="chiffres block text-xs" style={{ color: 'var(--texte-discret)' }}>
              {poidsSeries
                .map((charge, i) => `S${i + 1} ${charge > 0 ? charge : '—'}`)
                .join(' · ')}
            </span>
          )}
          {chargesPassees.some((charge) => charge > 0) && (
            <span className="chiffres block text-xs" style={{ color: 'var(--texte-discret)' }}>
              Dernière fois : {chargesPassees.map((charge) => (charge > 0 ? charge : '—')).join(' · ')}
            </span>
          )}
          {ajustement && (
            <span
              className="chiffres block text-xs font-semibold"
              style={{ color: ajustement.ajout > 0 ? 'var(--montee)' : 'var(--descente)' }}
            >
              {phraseRessenti(ajustement.motif, ajustement.ajout, unitePoids, personne)}
            </span>
          )}
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={unitePoids === 'lb' ? '1' : '0.5'}
          placeholder="—"
          value={texte}
          onChange={saisirPoids}
          className="chiffres h-14 w-28 rounded-xl border-2 text-center text-2xl"
          style={{
            background: 'var(--surface-haute)',
            color: 'var(--texte)',
            borderColor: 'var(--bordure)',
          }}
        />
      </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Bouton variante="accent" taille="etroit" onClick={onTerminee}>
          {etape.type !== 'serie'
            ? 'Station terminée'
            : posture
              ? 'Position terminée'
              : 'Série terminée'}
        </Bouton>
        <Bouton variante="neutre" taille="etroit" onClick={onPasser}>
          Passer l’exercice
        </Bouton>
      </div>
    </div>
  );
}

interface MetronomeProps {
  etape: EtapeTravail;
  metro: EtatMetronome;
  exercice: Exercice;
  tempo: Tempo;
  /** « +5 s » au changement de côté : le côté gauche repart d'autant plus tard. */
  prolongationSec: number;
  guideVisuel: GuideVisuel;
  lireEcouleSec: () => number;
}

/** La couleur de signal de chaque phase. Le mot, lui, dépend aussi de la
 *  forme du mouvement (`motDePhase`) : MONTE, TOURNE, À DROITE… */
const COULEUR_DE_PHASE: Record<PhaseTempo, string> = {
  monte: 'var(--montee)',
  descend: 'var(--descente)',
  pause: 'var(--tenue)',
  tourne: 'var(--montee)',
};

/** Le cœur de l'écran pendant une série : le mot de la phase en grand, puis
 *  la bille, le décompte, ou les deux, selon le guide visuel choisi. */
function Metronome({ etape, metro, exercice, tempo, prolongationSec, guideVisuel, lireEcouleSec }: MetronomeProps) {
  const mot = motDePhase(metro.phase, exercice);
  const couleur = COULEUR_DE_PHASE[metro.phase];
  const avecBille = guideVisuel !== 'chiffre';
  const forme = formeDe(exercice);

  // Sans arrêt en bas pour certains exercices : la bille ne s'arrête pas au pied
  // du rail, et la répétition est plus courte — comme dans la durée annoncée.
  // D'autres tiennent en haut : la bille s'arrête en haut du rail, après la
  // montée, et « TIENS » vient muscles serrés, jamais à plat. Un cercle ou un
  // va-et-vient ne s'arrête jamais.
  const tempoExercice = tempoPourExercice(exercice, tempo);
  const pauseEnHaut = tempoExercice.pauseEnHaut === true;

  /** Position de la bille à l'instant présent. Le calcul est exactement celui
   *  de `etatMetronome`, appliqué à l'horloge de l'étape lue à chaque image :
   *  même découpage en répétitions, même changement de côté, même
   *  `lirePhase`. Les deux basculent donc au même instant que les bips, qui
   *  sortent du même calcul ; les bips partent seulement au rendu qui suit
   *  (au plus 200 ms), puisqu'ils sont déclenchés par l'état React et non par
   *  l'animation. L'étape et le tempo gardent leur identité d'un rendu à
   *  l'autre : la boucle d'animation du paceur n'est pas relancée cinq fois
   *  par seconde. */
  const lire = useCallback((): LectureTempo | null => {
    const instant = etatMetronome(etape, lireEcouleSec(), tempo, prolongationSec);
    if (!instant) return null;
    return {
      phase: instant.phase,
      progression: instant.dureePhaseSec > 0 ? 1 - instant.resteDansPhaseSec / instant.dureePhaseSec : 0,
      inverse: instant.sens === 'second',
    };
  }, [etape, lireEcouleSec, tempo, prolongationSec]);

  return (
    <div className="select-none py-2 text-center">
      <div className="text-5xl font-extrabold tracking-[0.12em]" style={{ ...ARCHIVO, color: couleur }}>
        {mot}
      </div>

      {avecBille ? (
        <div className="mt-3">
          <PaceurTempo
            lire={lire}
            resteSec={metro.resteDansPhaseSec}
            phase={metro.phase}
            avecChiffre={guideVisuel === 'les-deux'}
            pauseEnHaut={pauseEnHaut}
            forme={forme}
            hauteurPx={HAUTEUR_BILLE_PX}
          />
        </div>
      ) : (
        <div className="chiffres text-9xl font-bold leading-none" style={{ color: couleur }}>
          {Math.max(1, Math.ceil(metro.resteDansPhaseSec))}
        </div>
      )}

      <div className="chiffres mt-2 text-2xl font-semibold">
        Rép {metro.rep} / {metro.totalReps}
      </div>
      {metro.cote && (
        <div className="text-xl font-medium" style={{ color: 'var(--accent)' }}>
          Côté {metro.cote}
        </div>
      )}
      {metro.sens && (
        <div
          className={metro.changeDeSens ? 'text-xl font-bold' : 'text-lg'}
          style={{ color: metro.changeDeSens ? 'var(--accent)' : 'var(--texte-discret)' }}
        >
          {metro.changeDeSens ? 'Change de sens !' : metro.sens === 'premier' ? 'Dans un sens' : 'Dans l’autre sens'}
        </div>
      )}
      {exercice.cotes === 'alterne' && forme === 'vertical' && (
        <div className="text-lg" style={{ color: 'var(--texte-discret)' }}>
          en alternant
        </div>
      )}
      <div className="chiffres mt-3 text-sm" style={{ color: 'var(--texte-discret)' }}>
        Tempo {libelleTempo(tempoExercice)} · sans rebond
      </div>
    </div>
  );
}

/** Le cercle d'un cercle au temps : il se remplit dans le sens du geste —
 *  celui des aiguilles d'une montre, puis l'autre après le changement de
 *  sens —, au fil des secondes et non des tours : il montre le sens et le
 *  temps qui reste, sans imposer de vitesse. */
const RAYON_CERCLE_AU_TEMPS = 76;
const TAILLE_CERCLE_AU_TEMPS = 176;

interface CercleAuTempsProps {
  maintien: EtatMaintien;
  /** Le cercle autour du décompte ; sans lui, le décompte seul (guide « chiffre »). */
  avecCercle: boolean;
}

/** Un cercle au kettlebell, au temps : « Dans un sens », « Change de sens ! »
 *  sans s'arrêter, puis « Dans l'autre sens », avec le décompte de chaque
 *  sens. Pas de bille : chacun tourne à son rythme. */
function CercleAuTemps({ maintien, avecCercle }: CercleAuTempsProps) {
  const second = maintien.sens === 'second';
  const secondes = Math.ceil(maintien.resteSec);
  const fait = maintien.partieSec > 0 ? Math.min(1, Math.max(0, 1 - maintien.resteSec / maintien.partieSec)) : 0;
  const circonference = 2 * Math.PI * RAYON_CERCLE_AU_TEMPS;
  const centre = TAILLE_CERCLE_AU_TEMPS / 2;
  const chiffre = (
    <span
      className={`chiffres font-bold leading-none ${avecCercle ? 'text-7xl' : 'text-9xl'}`}
      style={{ color: couleurCompte(maintien.resteSec, 'var(--montee)') }}
    >
      {secondes}
    </span>
  );
  return (
    <div className="select-none py-2 text-center">
      {/* Une hauteur fixe : l'annonce, plus grande, ne fait pas sauter le cercle. */}
      <div className="flex min-h-12 items-center justify-center" style={{ ...ARCHIVO, color: 'var(--accent)' }}>
        {maintien.changeDeSens ? (
          <span className="text-4xl font-extrabold tracking-[0.04em]">Change de sens !</span>
        ) : (
          <span className="text-2xl font-bold">{second ? '↺ Dans l’autre sens' : '↻ Dans un sens'}</span>
        )}
      </div>
      {avecCercle ? (
        <div
          className="relative mx-auto mt-3"
          style={{ width: TAILLE_CERCLE_AU_TEMPS, height: TAILLE_CERCLE_AU_TEMPS }}
        >
          <svg
            // Un nouveau cercle pour l'autre sens : il repart vide, sans revenir en arrière.
            key={maintien.sens}
            aria-hidden="true"
            width={TAILLE_CERCLE_AU_TEMPS}
            height={TAILLE_CERCLE_AU_TEMPS}
            viewBox={`0 0 ${TAILLE_CERCLE_AU_TEMPS} ${TAILLE_CERCLE_AU_TEMPS}`}
            // L'autre sens : le même cercle, vu dans un miroir.
            style={second ? { transform: 'scaleX(-1)' } : undefined}
          >
            <circle cx={centre} cy={centre} r={RAYON_CERCLE_AU_TEMPS} fill="none" stroke="var(--surface-haute)" strokeWidth={12} />
            <circle
              cx={centre}
              cy={centre}
              r={RAYON_CERCLE_AU_TEMPS}
              fill="none"
              stroke="var(--montee)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={circonference.toFixed(2)}
              strokeDashoffset={(circonference * (1 - fait)).toFixed(2)}
              transform={`rotate(-90 ${centre} ${centre})`}
              style={{ transition: 'stroke-dashoffset 0.25s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">{chiffre}</div>
        </div>
      ) : (
        <div className="mt-2">{chiffre}</div>
      )}
      <div className="mt-3 text-sm" style={{ color: 'var(--texte-discret)' }}>
        {second ? 'secondes restantes' : 'secondes, puis on change de sens'}
      </div>
      <div className="mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
        À son rythme, sans s’arrêter
      </div>
    </div>
  );
}

interface ChangementDeCoteProps {
  changement: EtatChangementCote;
  onProlonger: () => void;
}

/** Entre le côté droit et le côté gauche d'une série unilatérale : on pose,
 *  on change de main ou de côté, on se replace. Cinq secondes, et « +5 s »
 *  quand il en faut plus. */
function ChangementDeCote({ changement, onProlonger }: ChangementDeCoteProps) {
  const secondes = Math.ceil(changement.resteSec);
  return (
    <div className="select-none space-y-3 py-2 text-center">
      <div className="text-4xl font-extrabold tracking-[0.08em]" style={{ ...ARCHIVO, color: 'var(--accent)' }}>
        CHANGE DE CÔTÉ
      </div>
      <div className="chiffres text-9xl font-bold leading-none" style={{ color: couleurCompte(changement.resteSec, 'var(--texte)') }}>
        {secondes}
      </div>
      <div className="text-xl font-medium">
        Côté {changement.cote} dans <span className="chiffres">{secondes}</span> s
      </div>
      <Bouton variante="neutre" onClick={onProlonger}>
        +{PROLONGATION_CHANGEMENT_SEC} s
      </Bouton>
    </div>
  );
}

interface CorpsReposProps {
  etape: Extract<Etape, { type: 'repos' | 'reposTour' }>;
  resteSec: number;
  /** À deux : le prénom de l'autre. */
  partenaire?: string;
  /** La charge à installer pour la série qui vient : « 105 lb ». */
  charge?: string;
  /** Un étirement à faire pendant la pause. */
  etirement?: string;
  /** Le ressenti à dire sur l'exercice qui vient de finir, s'il y en a un. */
  ressenti?: ReactNode;
  onProlonger: () => void;
  onPasser: () => void;
}

/** Ce qui retient pendant la pause, en tête de l'écran. */
function titreRepos(etape: CorpsReposProps['etape'], partenaire: string | undefined, suivant: Exercice | null): string {
  if (etape.type === 'reposTour') return `Fin du tour ${etape.tour} / ${etape.tours} · repos`;
  const autre = partenaire ?? 'l’autre';
  switch (etape.motif) {
    case 'installation':
      return 'Prochain exercice : on installe';
    case 'tour':
      return `Au tour de ${autre}`;
    case 'serie-de-plus':
      return `Repos prolongé — ${autre} fait sa série de plus`;
    case 'attente':
      return `${autre} finit sa série`;
    default:
      return suivant && estPosture(suivant) ? 'Changez de position' : 'Repos';
  }
}

function CorpsRepos({ etape, resteSec, partenaire, charge, etirement, ressenti, onProlonger, onPasser }: CorpsReposProps) {
  const { suivant } = etape;
  const exerciceSuivant = suivant.type === 'retourCalme' ? null : exerciceDeSeance(suivant.exerciceId);
  // Nouvel exercice : on repart ensemble sur « Go », quand tout est prêt.
  const attendGo = etape.type === 'repos' && etape.manuel === true;
  const etire = etirement ? exerciceDeSeance(etirement) : null;
  return (
    <div className="space-y-4 text-center">
      <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--descente)' }}>
        {titreRepos(etape, partenaire, exerciceSuivant)}
      </div>
      <div
        className="chiffres text-8xl font-bold leading-none"
        style={{ color: couleurCompte(resteSec, 'var(--descente)') }}
      >
        {formaterMmSs(Math.ceil(resteSec))}
      </div>
      {attendGo && resteSec <= 0 && (
        <p className="text-lg font-bold" style={{ color: 'var(--montee)' }}>
          Prêts ? On repart sur « Go ».
        </p>
      )}

      {ressenti}

      {etire && (
        <div className="flex items-center gap-3 rounded-2xl p-3 text-left" style={{ background: 'var(--surface)' }}>
          <Vignette exerciceId={etire.id} alt={etire.nomFr} className="w-24 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--texte-discret)' }}>
              Pendant ce temps, on s’étire
            </div>
            <div className="font-bold">{etire.nomFr}</div>
            <div className="text-sm" style={{ color: 'var(--texte-discret)' }}>
              {etire.cotes === 'unilateral' ? '20 s de chaque côté' : '20 à 30 s'}, en douceur, jamais jusqu’à la
              douleur.
            </div>
          </div>
        </div>
      )}

      {attendGo && etire && exerciceSuivant ? (
        // Étirement et installation sur le même écran : le prochain exercice
        // en petit, pour que « Go » reste à portée de pouce.
        <div className="flex items-center gap-3 rounded-2xl p-3 text-left" style={{ background: 'var(--surface)' }}>
          <Vignette exerciceId={exerciceSuivant.id} alt={exerciceSuivant.nomFr} className="w-24 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--texte-discret)' }}>
              Prochain
            </div>
            <div className="font-bold">{exerciceSuivant.nomFr}</div>
            <div className="text-sm" style={{ color: 'var(--texte-discret)' }}>
              {libelleSuivant(suivant)}
            </div>
            {charge && <div className="chiffres font-bold">Charge : {charge}</div>}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)' }}>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--texte-discret)' }}>
            Prochain
          </div>
          {exerciceSuivant ? (
            <>
              <Vignette
                exerciceId={exerciceSuivant.id}
                alt={exerciceSuivant.nomFr}
                className="mx-auto w-full max-w-xs rounded-xl"
              />
              <div className="mt-2 text-xl font-bold">{exerciceSuivant.nomFr}</div>
              <div style={{ color: 'var(--texte-discret)' }}>{libelleSuivant(suivant)}</div>
              {charge && (
                <div className="chiffres mt-1 text-lg font-bold" style={{ color: 'var(--texte)' }}>
                  Charge : {charge}
                </div>
              )}
            </>
          ) : (
            <div className="text-xl font-bold">Retour au calme</div>
          )}
        </div>
      )}
      {attendGo ? (
        <Bouton variante="montee" taille="vedette" onClick={onPasser} className="w-full">
          Go
        </Bouton>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Bouton variante="neutre" onClick={onProlonger}>
            +{PROLONGATION_REPOS_SEC} s
          </Bouton>
          <Bouton variante="accent" onClick={onPasser}>
            Passer
          </Bouton>
        </div>
      )}
    </div>
  );
}

interface CorpsFinProps {
  realisee: SeanceRealisee;
  chargeDerniereFois?: number;
  /** Un essai : rien à enregistrer, un seul bouton pour fermer. */
  essai?: Essai;
  onEnregistrer: () => void;
  onAbandonner: () => void;
}

/** La charge soulevée, et l'écart avec la dernière fois. */
function ChargeSoulevee({ total, derniere, unite }: { total: number; derniere?: number; unite: UnitePoids }) {
  const suffixe = SUFFIXE_UNITE[unite];
  const ecart = derniere !== undefined && derniere > 0 ? total - derniere : null;
  const pourcent = ecart !== null && derniere ? Math.round((ecart / derniere) * 100) : 0;
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--surface)' }}>
      <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--texte-discret)' }}>
        Charge totale soulevée
      </div>
      <div className="chiffres text-5xl font-bold leading-tight" style={{ ...ARCHIVO, color: 'var(--montee)' }}>
        {total.toLocaleString('fr-CA')} {suffixe}
      </div>
      <p className="chiffres mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
        {ecart === null
          ? 'La première : c’est le chiffre à battre la prochaine fois.'
          : ecart === 0
            ? 'Pile comme la dernière fois.'
            : `${ecart > 0 ? '+' : '−'}${Math.abs(ecart).toLocaleString('fr-CA')} ${suffixe} par rapport à la dernière fois${
                pourcent !== 0 ? ` (${ecart > 0 ? '+' : '−'}${Math.abs(pourcent)} %)` : ''
              }`}
      </p>
    </div>
  );
}

function CorpsFin({ realisee, chargeDerniereFois, essai, onEnregistrer, onAbandonner }: CorpsFinProps) {
  const seriesFaites = realisee.exercices.reduce((total, e) => total + e.seriesFaites, 0);
  const seriesPrevues = realisee.exercices.reduce((total, e) => total + e.seriesPrevues, 0);
  const total = chargeTotale(realisee);
  const cellule = 'px-2 py-2 text-center chiffres';
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{essai ? essai.titreFin : 'Bravo, séance terminée'}</h2>
        <p className="mt-1" style={{ color: 'var(--texte-discret)' }}>
          Durée réelle <span className="chiffres font-semibold">{formaterMmSs(realisee.dureeReelleSec)}</span> ·
          prévue <span className="chiffres">{formaterMmSs(realisee.dureePrevueSec)}</span>
        </p>
        <p className="chiffres" style={{ color: 'var(--texte-discret)' }}>
          {seriesFaites} / {seriesPrevues} séries faites
        </p>
      </div>

      {/* Un essai n'est pas comparé à la dernière fois : il ne sera pas gardé. */}
      {total > 0 && !essai && (
        <ChargeSoulevee total={total} derniere={chargeDerniereFois} unite={uniteDeSeance(realisee.parametres)} />
      )}

      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--surface)' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr
              className="text-left text-xs font-bold uppercase tracking-[0.12em]"
              style={{ background: 'var(--surface-haute)', color: 'var(--texte-discret)' }}
            >
              <th className="px-3 py-2 font-bold" colSpan={2}>
                Exercice
              </th>
              <th className="px-2 py-2 text-center font-bold">Séries</th>
              <th className="px-2 py-2 text-center font-bold">Temps</th>
              <th className="px-2 py-2 text-center font-bold">Poids</th>
            </tr>
          </thead>
          <tbody>
            {realisee.exercices.map((realise, i) => {
              const exercice = exerciceDeSeance(realise.exerciceId);
              const complet = realise.seriesFaites >= realise.seriesPrevues;
              const bordure: CSSProperties = i > 0 ? { borderTop: '1px solid var(--bordure)' } : {};
              return (
                <tr key={realise.exerciceId}>
                  <td className="w-14 py-2 pl-3" style={bordure}>
                    <Vignette exerciceId={exercice.id} alt="" className="w-12 rounded-lg" />
                  </td>
                  <td className="px-2 py-2 font-medium" style={bordure}>
                    {exercice.nomFr}
                    {realise.ressenti && (
                      <span className="block text-xs font-normal" style={{ color: 'var(--texte-discret)' }}>
                        Ressenti : {motRessenti(realise.ressenti)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`${cellule} ${complet ? 'font-semibold' : ''}`}
                    style={{ ...bordure, color: complet ? 'var(--montee)' : 'var(--texte-discret)' }}
                  >
                    {realise.seriesFaites} / {realise.seriesPrevues}
                  </td>
                  <td className={cellule} style={{ ...bordure, color: 'var(--texte-discret)' }}>
                    {formaterMmSs(realise.dureeSec)}
                  </td>
                  <td className={cellule} style={{ ...bordure, color: 'var(--texte-discret)' }}>
                    {libellePoidsParSerie(realise, uniteDeSeance(realisee.parametres)) || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {essai ? (
        <Bouton variante="montee" onClick={onAbandonner} className="w-full">
          {essai.boutonFin}
        </Bouton>
      ) : (
        <>
          <Bouton variante="montee" onClick={onEnregistrer} className="w-full">
            Enregistrer la séance
          </Bouton>
          <Bouton variante="neutre" onClick={onAbandonner} className="w-full">
            Ne pas enregistrer
          </Bouton>
        </>
      )}
    </div>
  );
}
