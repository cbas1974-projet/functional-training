// Mode séance guidée : l'application déroule les étapes de la séance, dicte
// le tempo des séries (l'utilisateur suit la bille et les bips), gère la
// pause, la reprise après rechargement et le temps passé sur chaque exercice.
// Sur un seul téléphone, à deux ou seul : exercice par exercice — la liste du
// programme, toutes les séries de l'exercice en cours, un seul « Exercice
// terminé » qui lance la pause de fin (13 octobre 2026).
//
// Habillage : uniquement les jetons de couleur de `index.css` (mode sombre
// par défaut, mode clair suivant le système) et la classe `.chiffres` sur
// tout ce qui se compte. Chaque phase a sa couleur d'ambiance, reconnaissable
// d'un coup d'œil à bout de bras.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, ReactNode, Ref } from 'react';
import type {
  BlocSeries,
  Douleur,
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
import { bellSound, vibrer } from '../utils/sounds';
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
  groupesUnTelephone,
  indexApresExercice,
  indexEtapePrecedente,
  indexReprise,
  lireMouvement,
  motDePhase,
  pauseAEtirement,
  pauseEntreLesTours,
  premierePhase,
  versLeDerouleParExercice,
} from '../utils/etapesSeance';
import type {
  Etape,
  EtapeTravail,
  EtatChangementCote,
  EtatMaintien,
  EtatMetronome,
  PhaseTempo,
  QuiFait,
  Suivant,
} from '../utils/etapesSeance';
import {
  CHANGER_DE_COTE_SEC,
  dureeSerieSec,
  estCercleAuTemps,
  estMobilite,
  precisionAuTemps,
  tempoPourExercice,
} from '../utils/generateurSeance';
import { libelleTempo } from '../utils/formatage';
import type { Essai } from '../utils/essai';
import { NOM_PERSONNE, autrePersonne, chargeLeBasDuDos, etirementsPauseDe } from '../utils/programmeMois';
import {
  chargeAllegee,
  chargesDeLaSerie,
  libelleDisques,
  libelleParCote,
  seCharge,
  seriesAllegeesParLaDouleur,
} from '../utils/charges';
import type { ChargesSerie } from '../utils/charges';
import { douleurDe } from '../utils/douleurs';
import type { QuiDouleur } from '../utils/douleurs';
import {
  lancerPauseTour,
  phraseVisageManquant,
  restePauseTourSec,
  seriesANoter,
  visagesManquants,
} from '../utils/parExercice';
import type { PauseTour, VisageManquant } from '../utils/parExercice';
import { choixDeSortie, compteSeries, phraseEnregistrementPartiel } from '../utils/sortieSeance';
import type { ChoixSortie } from '../utils/sortieSeance';
import { decisionPasserExercice, decisionProlonger, decisionSuivant, perspectiveAutre } from '../utils/horlogeCommune';
import { tempsActifMs } from '../utils/etatCommun';
import type { Contexte, Decision } from '../utils/horlogeCommune';
import { SUFFIXE_UNITE, assezFaite, chargeTotale, libellePoidsParSerie, uniteDeSeance } from '../utils/statistiques';
import {
  AIDE_RESSENTI,
  LEGENDE_VISAGES,
  ajustementDeCharge,
  avecRessentis,
  exercicesAEvaluer,
  motRessenti,
  phraseRessenti,
  ressentiSurLaSerie,
} from '../utils/ressenti';
import { ajouterTemps, appuiAccepte, useMoteurEtapes } from '../hooks/useMoteurEtapes';
import { useMoteurCommun } from '../hooks/useMoteurCommun';
import { useSeanceCommune } from '../hooks/useSeanceCommune';
import type { ConfigSynchro } from '../hooks/useSeanceCommune';
import { useVerrouEcran } from '../hooks/useVerrouEcran';
import BoutonDouleur, { BoutonDouleurCompact, ReperDouleur } from './BoutonDouleur';
import BoutonsRessenti, { VisagesRessenti } from './BoutonsRessenti';
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
  /** Sur un seul téléphone, à deux : celles de l'autre, d'après ce que ce
   *  téléphone a noté pour lui. */
  chargesPasseesAutre?: Record<string, number[]>;
  /** Démarre aussitôt, sans l'écran de présentation : l'accueil du
   *  programme montre déjà la séance, un second « Commencer » ferait double
   *  emploi. 'reprise' repart de la progression sauvegardée. */
  demarrage?: 'debut' | 'reprise';
  /** À deux, avec le serveur : l'horloge commune, en direct. */
  synchro?: ConfigSynchro;
  /** La charge totale soulevée la dernière fois, dans l'unité de la séance :
   *  le chiffre à battre. */
  chargeDerniereFois?: number;
  /** Sur un seul téléphone, à deux : celle de l'autre. */
  chargeDerniereFoisAutre?: number;
  /** Un essai ou un aperçu : rien n'est enregistré — ni la progression, ni la
   *  séance faite. Son bandeau reste affiché du début à la fin. */
  essai?: Essai;
  /** « J'ai mal à cet exercice », par exercice, pour la personne du
   *  téléphone : charges à 70 %, pas de montée. */
  douleurs?: Record<string, Douleur>;
  /** Sur un seul téléphone, à deux : celles de l'autre, à part — elles ne
   *  touchent que ses charges à lui. */
  douleursAutre?: Record<string, Douleur>;
  /** Signale la douleur d'un exercice pour l'un ou l'autre, ou l'enlève ;
   *  `charge` : sa charge de travail du moment (100 %), 0 si on ne la connaît
   *  pas. */
  onBasculerDouleur?: (qui: QuiDouleur, exerciceId: string, charge: number, unite: UnitePoids) => void;
}

// ------------------------------------------------------------- Réglages

/** Intervalle minimal entre deux sauvegardes de la progression pendant une étape. */
const INTERVALLE_SAUVEGARDE_MS = 10_000;
const PROLONGATION_REPOS_SEC = 15;
/** « +5 s » au changement de côté : autant que le changement lui-même. */
const PROLONGATION_CHANGEMENT_SEC = CHANGER_DE_COTE_SEC;
/** Pas de « +5 s » donné dans cette étape. */
const AUCUNE_RALLONGE: Record<number, number> = {};
/** Une fin d'étape détectée avec au plus ce retard est datée à l'instant
 *  prévu (pas de dérive) ; au-delà (onglet en arrière-plan), l'étape suivante
 *  démarre à l'instant présent. */
const TOLERANCE_FIN_MS = 1000;
/** Les dernières secondes d'un compte à rebours passent en rouge. */
const SECONDES_ALERTE = 3;
/** Hauteur du rail de la bille : sur un écran de 390 × 844, la vignette, le
 *  compteur et la bille tiennent au-dessus de la barre d'actions du bas. */
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
  /** Grisé, mais on peut le toucher : il dit ce qui manque, et y ramène. */
  inactif?: boolean;
  /** Son nom, quand le texte est coupé sur deux lignes. */
  libelle?: string;
}

function Bouton({ variante, onClick, children, taille = 'grand', className = '', disabled, inactif = false, libelle }: BoutonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={libelle}
      aria-disabled={inactif || undefined}
      className={`${BOUTON_COMMUN} ${CLASSES_TAILLE[taille]} ${className}`}
      style={inactif ? { ...STYLES_BOUTON.neutre, opacity: 0.6 } : STYLES_BOUTON[variante]}
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
    case 'exercice':
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
    case 'exercice':
      return estPaire(etape) ? 'Paire' : 'Exercice';
    case 'repos':
      if (etape.motif === 'a-lancer') return 'Exercice fini';
      if (etape.motif === 'pause') return 'Pause';
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
    case 'exercice':
      return `pendant ${[...new Set(etape.series.map((serie) => serie.exerciceId))]
        .map((id) => exerciceDeSeance(id).nomFr)
        .join(' et ')}`;
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
function couleurCompte(resteSec: number, normale: string): string {
  return resteSec <= SECONDES_ALERTE ? 'var(--alerte)' : normale;
}

/** Les charges d'un exercice, avec celle d'une série (numérotée à partir de
 *  1) changée ; 0 ou rien efface la série. Sans changement, les mêmes. */
function avecCharge(
  precedents: Record<string, number[]>,
  exerciceId: string,
  serie: number,
  charge: number | null,
): Record<string, number[]> {
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
}

/** Les séries allégées d'un exercice, changées ; sans changement, les mêmes ;
 *  aucune, plus d'entrée. */
function avecSeriesAllegees(
  precedentes: Record<string, number[]>,
  exerciceId: string,
  series: readonly number[],
): Record<string, number[]> {
  const avant = precedentes[exerciceId] ?? [];
  const apres = [...new Set(series)].filter((serie) => serie > 0).sort((a, b) => a - b);
  if (avant.length === apres.length && avant.every((serie, i) => serie === apres[i])) return precedentes;
  const suivantes = { ...precedentes };
  if (apres.length > 0) suivantes[exerciceId] = apres;
  else delete suivantes[exerciceId];
  return suivantes;
}

/** Le guide du tempo, éteint. */
const GUIDE_ETEINT = { actif: false, visite: -1, depuisSec: 0, exerciceId: '' };

/** Sur un seul téléphone, une colonne de la liste du programme : la personne
 *  du téléphone, ou l'autre. */
export type QuiColonne = 'moi' | 'autre';

/** Les colonnes d'une série : qui la fait. */
function colonnesDeLaSerie(qui: QuiFait | undefined): QuiColonne[] {
  if (qui === 'les-deux') return ['moi', 'autre'];
  return qui === 'autre' ? ['autre'] : ['moi'];
}

/** Un exercice d'un seul téléphone qui compte deux exercices : une paire. */
function estPaire(etape: Extract<Etape, { type: 'exercice' }>): boolean {
  return new Set(etape.series.map((serie) => serie.exerciceId)).size > 1;
}

/** Le groupe d'une étape de la liste : l'exercice ou la paire, ou sa pause. */
function groupeDeLaListe(etape: Etape): number | undefined {
  return etape.type === 'exercice' || etape.type === 'serie' || etape.type === 'repos' ? etape.groupe : undefined;
}

/** Sur un seul téléphone, l'écran est la liste du programme pendant les
 *  exercices et leurs pauses ; l'échauffement, les étirements et la fin
 *  gardent le leur. */
function estEtapeDeListe(etape: Etape): boolean {
  return (
    etape.type === 'exercice' ||
    (etape.type === 'serie' && etape.manuelle === true) ||
    (etape.type === 'repos' && (etape.motif === 'a-lancer' || etape.motif === 'pause'))
  );
}

/** Sur un seul téléphone, ce qui vient après l'exercice ou la paire en
 *  cours : ses noms, ou les étirements. Il reste en vue au-dessus des
 *  boutons, même quand la carte d'une paire remplit l'écran. */
function ensuiteDansLaListe(seance: Seance, etapes: Etape[], etape: Etape): string | null {
  const groupe = groupeDeLaListe(etape);
  if (groupe === undefined) return null;
  const suivant = groupesUnTelephone(seance)[groupe + 1];
  if (suivant) return suivant.map((bloc) => exerciceDeSeance(bloc.exerciceId).nomFr).join(' + ');
  return etapes.some((e) => e.type === 'retourCalme') ? 'Étirements' : null;
}

/** Où sont les visages d'une personne sur un exercice : le bouton du bas y
 *  ramène quand il en manque un. */
const idVisages = (qui: QuiColonne, exerciceId: string) => `visages-${qui}-${exerciceId}`;


// ------------------------------------------------------------- Composant

export default function SeanceGuidee({
  seance,
  progression,
  onProgression,
  onTerminee,
  onQuitter,
  chargesPassees = {},
  chargesPasseesAutre = {},
  demarrage,
  synchro,
  chargeDerniereFois,
  chargeDerniereFoisAutre,
  essai,
  douleurs = {},
  douleursAutre = {},
  onBasculerDouleur,
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
  // Sur un seul téléphone, à deux : les charges et les ressentis de l'autre,
  // notés ici, et les exercices finis sur « Exercice terminé ».
  const [poidsAutre, setPoidsAutre] = useState<Record<string, number[]>>({});
  const [ressentisAutre, setRessentisAutre] = useState<Record<string, Ressenti>>({});
  const [faites, setFaites] = useState<number[]>([]);
  // Les séries notées à 70 % d'un toucher, ou pendant une douleur éteinte
  // depuis : elles ne disent pas la charge de travail (`chargesDeLaSerie`).
  const [allegees, setAllegees] = useState<Record<string, number[]>>({});
  const [allegeesAutre, setAllegeesAutre] = useState<Record<string, number[]>>({});
  // Le guide du tempo, sur un seul téléphone : caché par défaut, un petit
  // bouton sur chaque exercice le montre. `depuisSec` : ce qui était déjà
  // écoulé de l'exercice quand on l'a allumé — il repart de zéro.
  const [guideTempo, setGuideTempo] = useState<{ actif: boolean; visite: number; depuisSec: number; exerciceId: string }>(
    GUIDE_ETEINT,
  );
  // Sur un seul téléphone, la pause qu'on prend entre deux tours, d'un
  // toucher : elle ne change pas d'exercice.
  const [pauseTour, setPauseTour] = useState<PauseTour | null>(null);
  // « Exercice terminé » touché alors qu'il manque un visage : on montre où.
  const [manquantsMontres, setManquantsMontres] = useState(-1);
  const [demarreeLe, setDemarreeLe] = useState<string | null>(null);
  // « +5 s » au changement de côté d'un étirement, seul : l'étape s'allonge,
  // et la rallonge va au mouvement en cours — les suivants sont repoussés
  // d'autant. À deux, l'horloge commune s'arrête : rien à ranger.
  const [rallonges, setRallonges] = useState<{ visite: number; parMouvement: Record<number, number> }>({
    visite: -1,
    parMouvement: {},
  });
  /** La question en cours (quitter, passer l'exercice…), dans l'application. */
  const [dialogue, setDialogue] = useState<DialogueOuvert | null>(null);

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
  // Sur un seul téléphone : celui qui le tient note pour les deux — la liste
  // du programme, une colonne chacun.
  const unTelephone = seanceActive.horloge?.unTelephone === true;
  const autre: Personne | null = unTelephone && partenaire !== undefined && personne ? autrePersonne(personne) : null;
  const etirementsPause = useMemo(() => (personne ? etirementsPauseDe(personne) : []), [personne]);
  const blocDe = (exerciceId: string): BlocSeries | undefined =>
    seanceActive.blocs.find((bloc) => bloc.exerciceId === exerciceId);
  // Sur un seul téléphone : une colonne chacun, Speedy d'abord ; seul, la
  // sienne.
  const colonneMoi: ColonneDuo = { qui: 'moi', ...(personne ? { personne } : {}) };
  const colonnes: ColonneDuo[] = autre
    ? autre === 'sebastien'
      ? [{ qui: 'autre', personne: autre }, colonneMoi]
      : [colonneMoi, { qui: 'autre', personne: autre }]
    : [colonneMoi];
  const ressentiDe = (qui: QuiColonne, exerciceId: string): Ressenti | undefined =>
    (qui === 'moi' ? ressentis : ressentisAutre)[exerciceId];

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

  const conteneurRef = useRef<HTMLDivElement>(null);
  const visite = moteur.etat?.visite;

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

  // À chaque changement d'étape, on remonte en haut. C'est le conteneur plein
  // écran qui défile, pas la fenêtre (le défilement du corps est bloqué) :
  // sans cette remise à zéro, le nom de l'exercice reste sous l'en-tête. Sur
  // un seul téléphone, la liste du programme garde sa place : elle amène
  // elle-même sous les yeux l'exercice qui commence.
  const enListe = unTelephone && estEtapeDeListe(etape);
  useEffect(() => {
    if (visite === undefined || enListe) return;
    conteneurRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [visite, enListe]);

  // Sur un seul téléphone, pas de minuteur pendant un exercice : le métronome
  // et le décompte d'une série n'y viennent que si on les demande sur un
  // exercice (`guideTempo`), et repartent alors de zéro. « +5 s » au
  // changement de côté allonge d'autant : le côté gauche repart d'autant plus
  // tard.
  const sansMinuteur = etape.type === 'exercice' || (etape.type === 'serie' && etape.manuelle === true);
  const guideActif = sansMinuteur && guideTempo.actif && guideTempo.visite === visite;
  /** La série que le guide rythme : une de l'exercice choisi, aux
   *  répétitions les plus nombreuses des deux. */
  const serieGuidee: Extract<Etape, { type: 'serie' }> | null = (() => {
    if (!guideActif) return null;
    if (etape.type === 'serie') return etape;
    const bloc = seanceActive.blocs.find((b) => b.exerciceId === guideTempo.exerciceId);
    if (!bloc) return null;
    const reps = Math.max(bloc.reps, bloc.autre?.reps ?? 0);
    return {
      type: 'serie',
      exerciceId: bloc.exerciceId,
      serie: 1,
      series: 1,
      reps,
      dureeSec: dureeSerieSec(exerciceDeSeance(bloc.exerciceId), reps, tempo),
      manuelle: true,
    };
  })();
  const decalageGuide = guideActif ? guideTempo.depuisSec : 0;
  const ecouleGuide = Math.max(0, ecoule - decalageGuide);
  /** L'horloge du guide, pour la bille : celle de l'étape, moins ce qui en
   *  était écoulé quand on l'a allumé. */
  const lireEcouleGuide = useCallback(() => Math.max(0, lireEcouleSec() - decalageGuide), [lireEcouleSec, decalageGuide]);
  const etapeRythmee: Etape = serieGuidee ?? etape;
  const sansGuide = sansMinuteur && serieGuidee === null;
  const metro = sansGuide ? null : etatMetronome(etapeRythmee, ecouleGuide, tempo, prolongation);
  const changement = sansGuide ? null : etatChangementCote(etapeRythmee, ecouleGuide, tempo, prolongation);
  const maintien = sansGuide ? null : etatMaintien(etapeRythmee, ecouleGuide, prolongation);
  // Échauffement et retour au calme : ceux de la séance (tapis ou rameur,
  // étirements du poster), sinon ceux d'usage.
  const mouvements: MouvementGuide[] | null =
    etape.type === 'echauffement'
      ? (seanceActive.echauffement ?? ECHAUFFEMENT)
      : etape.type === 'retourCalme'
        ? (seanceActive.retourCalme ?? RETOUR_CALME)
        : null;
  const rallongesEtape = rallonges.visite === visite ? rallonges.parMouvement : AUCUNE_RALLONGE;
  const { index: indexMouvement, resteSec: resteMouvement } = lireMouvement(
    mouvements ?? [],
    etape.dureeSec,
    ecoule,
    rallongesEtape,
    prolongation,
  );
  const changeDeCoteMouvement = mouvements?.[indexMouvement]?.changementDeCote === true;

  const verrou = useVerrouEcran(enCours && !estFin);

  // ------------------------------------------------ Transitions

  /** Change d'étape ; entrer dans une série ou une station sonne la cloche. */
  const naviguer = useCallback(
    (cible: number, now?: number) => {
      // iOS suspend le contexte audio quand l'écran se verrouille : chaque
      // geste est l'occasion de le réveiller.
      bellSound.unlock();
      const destination = etapes[Math.max(0, Math.min(cible, etapes.length - 1))];
      // Un exercice d'un seul téléphone ne sonne pas : on vient de toucher
      // l'écran, ou la fin de la pause a déjà sonné.
      if ((destination.type === 'serie' && !destination.manuelle) || destination.type === 'station') {
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
      // Le changement de côté d'un étirement : les trois derniers bips, comme
      // aux séries — « +5 s » les fait rejouer.
      if (changeDeCoteMouvement) {
        const secondes = Math.ceil(resteMouvement);
        if (secondes >= 1 && secondes <= 3) {
          const cleBip = `${prefixe}${prolongation}:m${indexMouvement}:${secondes}`;
          if (ev.compteARebours !== cleBip) {
            ev.compteARebours = cleBip;
            bellSound.playTick('pret');
          }
        }
      }
    }

    // Fin de l'étape : passage automatique à la suivante — sauf quand la
    // séance attend « Go », ou une pause qu'on lance d'un clic.
    const attendGo = etape.type === 'repos' && etape.manuel === true;
    // Sur un seul téléphone, un exercice se finit sur « Exercice terminé »,
    // jamais au bout du temps.
    const attendFin = etape.type === 'exercice' || (etape.type === 'serie' && etape.manuelle === true);
    // À deux, l'étape suit l'horloge commune d'elle-même.
    if (!enCommun && ecoule >= dureeEff && ev.avance !== visite && !attendGo && !attendFin) {
      ev.avance = visite;
      if (etape.type === 'serie' || etape.type === 'station') bellSound.playBell('end');
      // La fin d'une pause lancée d'un clic : la cloche, et le téléphone
      // vibre — on l'entend, ou on le sent dans la poche.
      if (etape.type === 'repos' && etape.motif === 'pause') {
        bellSound.playBell('start');
        vibrer();
      }
      const finPrevueMs = etat.debutEtapeMs + dureeEff * 1000;
      const depart = maintenant - finPrevueMs <= TOLERANCE_FIN_MS ? finPrevueMs : maintenant;
      naviguer(index + 1, depart);
    }
  }, [etat, estFin, etape, reste, prolongation, metro, changement, maintien, mouvements, indexMouvement, changeDeCoteMouvement, resteMouvement, ecoule, dureeEff, maintenant, index, naviguer, enCommun]);

  // La pause prise entre deux tours, d'un toucher : les trois derniers bips,
  // puis la cloche et la vibration, comme la pause de fin — mais l'exercice
  // reste le même.
  useEffect(() => {
    if (!pauseTour || !etat || etat.enPause) return;
    const resteTour = restePauseTourSec(pauseTour, etat.visite, maintenant);
    if (resteTour === null) return;
    const ev = evenementsRef.current;
    const secondes = Math.ceil(resteTour);
    if (secondes >= 1 && secondes <= 3) {
      const cle = `tour:${pauseTour.debutMs}:${secondes}`;
      if (ev.compteARebours !== cle) {
        ev.compteARebours = cle;
        bellSound.playCountdown();
      }
    }
    if (resteTour <= 0) {
      bellSound.playBell('start');
      vibrer();
      setPauseTour(null);
    }
  }, [pauseTour, etat, maintenant]);

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
  /** Ce qui a été saisi depuis la dernière sauvegarde : un changement la
   *  déclenche. */
  const saisiesActuelles = useMemo(
    () => ({ poids, ressentis, poidsAutre, ressentisAutre, faites, allegees, allegeesAutre }),
    [poids, ressentis, poidsAutre, ressentisAutre, faites, allegees, allegeesAutre],
  );
  const sauvegardeRef = useRef<{
    visite: number;
    ms: number;
    saisies: typeof saisiesActuelles | null;
  }>({
    visite: 0,
    ms: 0,
    saisies: null,
  });

  /** Où en est la séance, pour la reprendre plus tard. */
  const instantane = (debut: string, quand: number): ProgressionSeance => ({
    seance: seanceActive,
    indexEtape: index,
    tempsCumuleSec: Math.round(tempsTotalEcoule),
    tempsParEtapeSec: tempsAvecCourante.map((t) => Math.round(t)),
    poids,
    ressentis,
    ...(Object.keys(allegees).length > 0 ? { allegees } : {}),
    ...(unTelephone
      ? {
          poidsAutre,
          ressentisAutre,
          faites,
          ...(Object.keys(allegeesAutre).length > 0 ? { allegeesAutre } : {}),
          deroule: 'par-exercice' as const,
        }
      : {}),
    demarreeLe: debut,
    sauvegardeeLe: new Date(quand).toISOString(),
  });
  const instantaneRef = useRef(instantane);
  useEffect(() => {
    instantaneRef.current = instantane;
  });

  useEffect(() => {
    // Un essai ne laisse rien : pas de reprise proposée au rechargement.
    if (!etat || !demarreeLe || clotureeRef.current || essai) return;
    const derniere = sauvegardeRef.current;
    const nouvelleEtape = derniere.visite !== etat.visite;
    const periodique = maintenant - derniere.ms >= INTERVALLE_SAUVEGARDE_MS;
    const saisiesModifiees = derniere.saisies !== saisiesActuelles;
    if (!nouvelleEtape && !periodique && !saisiesModifiees) return;
    sauvegardeRef.current = { visite: etat.visite, ms: maintenant, saisies: saisiesActuelles };
    onProgressionRef.current(instantaneRef.current(demarreeLe, maintenant));
  }, [etat, demarreeLe, maintenant, saisiesActuelles, essai]);

  // ------------------------------------------------ Actions

  const demarrerSeance = (
    source: Seance,
    indexDepart: number,
    temps: number[],
    poidsInitial: Record<string, number[]>,
    debut: string,
    ressentisInitiaux: Record<string, Ressenti> = {},
    reprise: Pick<ProgressionSeance, 'poidsAutre' | 'ressentisAutre' | 'faites' | 'allegees' | 'allegeesAutre'> = {},
  ) => {
    // Geste utilisateur : on en profite pour débloquer l'audio et l'écran.
    bellSound.unlock();
    void verrou.demander();
    clotureeRef.current = false;
    setSeanceActive(source);
    setPoids(poidsInitial);
    setRessentis(ressentisInitiaux);
    setPoidsAutre(reprise.poidsAutre ?? {});
    setRessentisAutre(reprise.ressentisAutre ?? {});
    setFaites(reprise.faites ?? []);
    setAllegees(reprise.allegees ?? {});
    setAllegeesAutre(reprise.allegeesAutre ?? {});
    setDemarreeLe(debut);
    // À deux : on commence la séance commune, ou on la rejoint.
    if (enCommun) commune.envoyer({ type: 'commencer' });
    moteur.demarrer(indexDepart, temps);
    bellSound.playBell('start');
  };

  const commencer = () => demarrerSeance(seance, 0, [], {}, new Date().toISOString());

  const reprendreSeance = () => {
    if (!progressionInitiale) return;
    // Une séance commencée série par série (version 1.2.0) reprend exercice
    // par exercice : la sauvegarde est relue au chargement, et encore ici,
    // sans effet si c'est déjà fait.
    const sauvee = versLeDerouleParExercice(progressionInitiale);
    const etapesSauvees = construireEtapes(sauvee.seance);
    demarrerSeance(
      sauvee.seance,
      indexReprise(etapesSauvees, sauvee.indexEtape),
      sauvee.tempsParEtapeSec ?? [],
      sauvee.poids ?? {},
      sauvee.demarreeLe || new Date().toISOString(),
      sauvee.ressentis ?? {},
      {
        poidsAutre: sauvee.poidsAutre,
        ressentisAutre: sauvee.ressentisAutre,
        faites: sauvee.faites,
        allegees: sauvee.allegees,
        allegeesAutre: sauvee.allegeesAutre,
      },
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
    const action = decision.action;
    if (decision.confirmer) {
      confirmer({ titre: decision.confirmer, oui: 'Oui, pour les deux', action: () => commune.envoyer(action) });
      return;
    }
    commune.envoyer(action);
  };

  /** Une question oui / non, dans l'application : « Annuler » en bas, sous le pouce. */
  const confirmer = ({
    titre,
    texte,
    oui,
    action,
    danger = false,
  }: {
    titre: string;
    texte?: string;
    oui: string;
    action: () => void;
    danger?: boolean;
  }) =>
    setDialogue({
      titre,
      texte,
      choix: [
        { libelle: oui, variante: danger ? 'danger' : 'accent', action },
        { libelle: 'Annuler', variante: 'fantome', action: () => {} },
      ],
    });

  /** Ferme la question ; le choix fait, s'il y en a un, est exécuté. */
  const fermerDialogue = (choix?: ChoixDialogue) => {
    const ouvert = dialogue;
    setDialogue(null);
    if (choix) choix.action();
    else ouvert?.onFermer?.();
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
  /** Un appui qui fait avancer la séance : ignoré juste après un changement
   *  d'étape — c'est le second toucher d'un double toucher, qui validait la
   *  série suivante (`appuiAccepte`). À deux, l'horloge commune décide. */
  const appuiCompte = () => enCommun || appuiAccepte(etat, Date.now());
  const suivant = () => {
    if (enCommun) decider(decisionSuivant);
    else if (appuiCompte()) naviguer(index + 1);
  };
  const passerExercice = () =>
    enCommun ? decider(decisionPasserExercice) : naviguer(indexApresExercice(etapes, index));
  /** « Suivant », en haut : pendant une série, il ne la saute pas sans le
   *  dire ; sur un exercice d'un seul téléphone, c'est « Passer cet
   *  exercice ». */
  const suivantEnHaut = () => {
    if (etape.type === 'exercice') {
      demanderPasserExercice();
      return;
    }
    if (etape.type !== 'serie' && etape.type !== 'station') {
      suivant();
      return;
    }
    confirmer({
      titre: etape.type === 'serie' ? 'Sauter cette série ?' : 'Sauter cette station ?',
      texte: 'Elle ne compte que si tu en as fait au moins la moitié. Pour la finir, c’est le bouton du bas.',
      oui: etape.type === 'serie' ? 'Sauter la série' : 'Sauter la station',
      action: suivant,
    });
  };
  /** « Passer l'exercice » — sur un seul téléphone, l'exercice ou la paire
   *  entière, sans sa pause : ses séries ne comptent pas ; on demande. */
  const demanderPasserExercice = () => {
    const groupe = enListe ? groupeDeLaListe(etape) : undefined;
    const paire = groupe !== undefined && (groupesUnTelephone(seanceActive)[groupe]?.length ?? 0) > 1;
    confirmer({
      titre: paire ? 'Passer cette paire ?' : 'Passer cet exercice ?',
      texte: etape.type === 'exercice' ? 'Ses séries ne compteront pas.' : 'Les séries qui restent ne seront pas faites.',
      oui: paire ? 'Passer la paire' : 'Passer l’exercice',
      action: passerExercice,
    });
  };
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
  /** « +5 s » au changement de côté d'un étirement ou de l'échauffement. */
  const prolongerMouvement = () => {
    if (enCommun) {
      decider((contexte) => decisionProlonger(contexte, PROLONGATION_CHANGEMENT_SEC));
      return;
    }
    if (visite === undefined) return;
    setRallonges({
      visite,
      parMouvement: {
        ...rallongesEtape,
        [indexMouvement]: (rallongesEtape[indexMouvement] ?? 0) + PROLONGATION_CHANGEMENT_SEC,
      },
    });
    moteur.prolonger(PROLONGATION_CHANGEMENT_SEC);
  };

  /** Les douleurs de l'un ou de l'autre : chacun les siennes. */
  const douleursDe = (qui: QuiColonne) => (qui === 'moi' ? douleurs : douleursAutre);
  /** Les séries allégées de l'un ou de l'autre. */
  const allegeesDe = (qui: QuiColonne) => (qui === 'moi' ? allegees : allegeesAutre);

  /** Les charges d'une série, pour soi ou pour l'autre, avec ces saisies et
   *  cette douleur : pré-remplie — la dernière fois, un cran plus loin si son
   *  ressenti le demande —, 70 % et 100 %. Les séries allégées ne disent pas
   *  la charge de travail. */
  const chargesPour = (
    qui: QuiColonne,
    exerciceId: string,
    serie: number,
    saisies: number[],
    douleur: Douleur | null,
    seriesAllegees: readonly number[] = allegeesDe(qui)[exerciceId] ?? [],
  ): ChargesSerie => {
    const bloc = blocDe(exerciceId);
    return chargesDeLaSerie({
      exercice: exerciceDeSeance(exerciceId),
      bloc:
        qui === 'moi'
          ? bloc
          : bloc?.autre
            ? { series: bloc.autre.series, ajustementRessenti: bloc.autre.ajustementRessenti }
            : undefined,
      saisies,
      passees: (qui === 'moi' ? chargesPassees : chargesPasseesAutre)[exerciceId] ?? [],
      serie,
      unite: unitePoids,
      douleur,
      allegees: seriesAllegees,
    });
  };

  /** Les charges d'une série, pour soi ou pour l'autre : pré-remplie, 70 % et
   *  100 % — à 70 % pour celui des deux qui a mal à cet exercice. */
  const chargesDe = (qui: QuiColonne, exerciceId: string, serie: number): ChargesSerie =>
    chargesPour(qui, exerciceId, serie, (qui === 'moi' ? poids : poidsAutre)[exerciceId] ?? [], douleurDe(douleursDe(qui), exerciceId));

  /** Les charges d'une série de la personne du téléphone. */
  const chargesIci = (exerciceId: string, serie: number): ChargesSerie => chargesDe('moi', exerciceId, serie);

  /** Change les séries allégées d'un exercice, pour l'un ou pour l'autre. */
  const changerAllegees = (qui: QuiColonne, exerciceId: string, changer: (series: number[]) => number[]) =>
    (qui === 'moi' ? setAllegees : setAllegeesAutre)((precedentes) =>
      avecSeriesAllegees(precedentes, exerciceId, changer(precedentes[exerciceId] ?? [])),
    );

  /** Note la charge d'une série, pour soi ou pour l'autre ; `allegee` : à 70 %
   *  d'un toucher — elle ne dira pas la charge de travail. Taper une charge,
   *  ou toucher 100 %, enlève ce repère. */
  const changerCharge = (qui: QuiColonne, exerciceId: string, serie: number, charge: number | null, allegee = false) => {
    (qui === 'moi' ? setPoids : setPoidsAutre)((precedents) => avecCharge(precedents, exerciceId, serie, charge));
    const marquer = allegee && charge !== null && charge > 0;
    changerAllegees(qui, exerciceId, (series) => (marquer ? [...series, serie] : series.filter((s) => s !== serie)));
  };

  /** « J'ai mal à cet exercice », pour l'un ou pour l'autre : on le signale,
   *  ou on l'enlève, pour lui seul. Sur un seul téléphone, rien n'est
   *  réécrit : les charges pré-remplies de ses séries suivent — à 70 %, ou de
   *  nouveau comme avant. En séance libre, sa série en cours suit aussitôt.
   *  Quand la douleur s'éteint, les séries notées à ses 70 % ne disent plus
   *  la charge de travail : les suivantes repartent du 100 % (le bug du 13
   *  octobre 2026 : elles restaient à 70 %). */
  const basculerDouleurDe = (qui: QuiColonne, exerciceId: string) => {
    if (!onBasculerDouleur) return;
    const douleurAvant = douleurDe(douleursDe(qui), exerciceId);
    const avait = douleurAvant !== null;
    // Hors de la liste, la série en cours, si elle est la sienne.
    const enCoursIci =
      !enListe &&
      (etape.type === 'serie' || etape.type === 'station') &&
      etape.exerciceId === exerciceId &&
      (etape.type !== 'serie' || colonnesDeLaSerie(etape.qui).includes(qui))
        ? etape.type === 'serie'
          ? etape.serie
          : etape.tour
        : null;
    const notees = (qui === 'moi' ? poids : poidsAutre)[exerciceId] ?? [];
    const sansLaSerie = [...notees];
    if (enCoursIci !== null) sansLaSerie[enCoursIci - 1] = 0;
    // Les séries allégées après ce toucher : celles notées aux 70 % de la
    // douleur qu'on éteint s'y ajoutent ; la série en cours, réécrite, n'en
    // est plus.
    const allegeesApres = [
      ...new Set([
        ...(allegeesDe(qui)[exerciceId] ?? []),
        ...(avait ? seriesAllegeesParLaDouleur(notees, douleurAvant, unitePoids) : []),
      ]),
    ].filter((serie) => serie !== enCoursIci);
    // Sa charge de travail du moment — à sa série en cours, ou après tout ce
    // qui est noté aujourd'hui —, sans la montée que la douleur coupe.
    const reference = enCoursIci ?? sansLaSerie.length + 1;
    const charge = avait ? 0 : chargesPour(qui, exerciceId, reference, sansLaSerie, { depuis: '' }, allegeesApres).pleine;
    onBasculerDouleur(qui, exerciceId, charge, unitePoids);
    changerAllegees(qui, exerciceId, () => allegeesApres);
    if (enCoursIci !== null) {
      const apres: Douleur | null = avait ? null : { depuis: '', ...(charge > 0 ? { charge, unite: unitePoids } : {}) };
      changerCharge(qui, exerciceId, enCoursIci, chargesPour(qui, exerciceId, enCoursIci, sansLaSerie, apres, allegeesApres).proposee);
    }
  };

  /** Enregistre la charge d'une série précise (numérotée à partir de 1) de
   *  la personne du téléphone. */
  const changerPoids = (exerciceId: string, serie: number, charge: number | null, allegee = false) =>
    changerCharge('moi', exerciceId, serie, charge, allegee);

  /** Dit le ressenti d'un exercice ; en toucher un autre plus tard le change. */
  const choisirRessenti = (exerciceId: string, ressenti: Ressenti) =>
    setRessentis((precedents) => (precedents[exerciceId] === ressenti ? precedents : { ...precedents, [exerciceId]: ressenti }));

  // ------------------------------------------------ Sur un seul téléphone

  /** Dit le ressenti, pour soi ou pour l'autre. */
  const choisirRessentiDe = (qui: QuiColonne, exerciceId: string, ressenti: Ressenti) => {
    if (qui === 'moi') {
      choisirRessenti(exerciceId, ressenti);
      return;
    }
    setRessentisAutre((precedents) =>
      precedents[exerciceId] === ressenti ? precedents : { ...precedents, [exerciceId]: ressenti },
    );
  };

  /** Le groupe de l'exercice en cours, sur un seul téléphone : l'exercice
   *  seul, ou les deux de la paire. */
  const groupeEnCours = (() => {
    const groupe = enListe ? groupeDeLaListe(etape) : undefined;
    return groupe === undefined ? [] : (groupesUnTelephone(seanceActive)[groupe] ?? []);
  })();
  /** Les visages qui manquent encore pour finir l'exercice en cours : un par
   *  personne, sur chaque exercice qui se charge. */
  const manquants: VisageManquant[] =
    etape.type === 'exercice'
      ? visagesManquants(
          groupeEnCours,
          colonnes.map((colonne) => colonne.qui),
          ressentiDe,
        )
      : [];

  /** « Exercice terminé » (ou « Paire terminée ») : toutes ses séries
   *  comptent, et les charges affichées sont notées telles quelles — on ne
   *  tape que ce qui change. Il faut un visage de chacun : tant qu'il en
   *  manque un, le bouton dit lequel, et y ramène. Puis la pause de fin part
   *  d'elle-même. Le second toucher d'un double toucher ne compte pas. */
  const terminerExercice = () => {
    if (etape.type !== 'exercice' || !appuiCompte()) return;
    const [manquant] = manquants;
    if (manquant) {
      setManquantsMontres(visite ?? -1);
      document.getElementById(idVisages(manquant.qui, manquant.exerciceId))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    for (const { qui, exerciceId, serie } of seriesANoter(etape.series)) {
      const deja = (qui === 'moi' ? poids : poidsAutre)[exerciceId]?.[serie - 1] ?? 0;
      if (deja > 0) continue;
      const proposee = chargesDe(qui, exerciceId, serie).proposee;
      if (proposee > 0) changerCharge(qui, exerciceId, serie, proposee);
    }
    const ici = index;
    setFaites((precedentes) => (precedentes.includes(ici) ? precedentes : [...precedentes, ici]));
    setPauseTour(null);
    setGuideTempo(GUIDE_ETEINT);
    naviguer(index + 1);
  };

  /** « Pause · 1 min » pendant un exercice : on souffle entre deux tours,
   *  sans changer d'exercice ; un second toucher l'arrête. */
  const basculerPauseTour = (dureeSec: number) => {
    bellSound.unlock();
    if (restePauseTourSec(pauseTour, visite, Date.now()) !== null) {
      setPauseTour(null);
      return;
    }
    if (visite === undefined || dureeSec <= 0) return;
    setGuideTempo(GUIDE_ETEINT);
    setPauseTour(lancerPauseTour(visite, Date.now(), dureeSec));
  };

  /** Le guide du tempo d'un exercice, d'un toucher : il repart de zéro ; sur
   *  l'autre exercice de la paire, il y passe. */
  const basculerGuideTempo = (exerciceId: string) => {
    bellSound.unlock();
    if (guideActif && guideTempo.exerciceId === exerciceId) {
      setGuideTempo(GUIDE_ETEINT);
      return;
    }
    bellSound.playBell('start');
    setPauseTour(null);
    setGuideTempo({ actif: true, visite: visite ?? -1, depuisSec: ecoule, exerciceId });
  };

  // Un essai ne garde rien : sa séance faite n'est jamais enregistrée, ressentis compris.
  const realisation = (terminee: boolean): SeanceRealisee =>
    avecRessentis(
      agregerRealisation(
        seanceActive,
        etapes,
        tempsAvecCourante,
        poids,
        tempsTotalEcoule,
        terminee,
        unTelephone ? { faites, poidsAutre } : {},
      ),
      ressentis,
      ressentisAutre,
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

  /** On garde où on en est : l'accueil propose « Reprendre ». */
  const garderPourPlusTard = () => {
    clotureeRef.current = true;
    if (!essai && demarreeLe) onProgression(instantane(demarreeLe, Date.now()));
    onQuitter();
  };

  /** « Quitter » : une seule question, dans l'application — reprendre plus
   *  tard, enregistrer ce qui est fait, tout jeter, ou continuer. */
  const quitter = () => {
    if (!etat) {
      // Rien n'a commencé : on garde une éventuelle progression sauvegardée.
      onQuitter();
      return;
    }
    // Le temps de la question, le chrono s'arrête ; on reprend si l'on
    // renonce à quitter. À deux, la pause arrêterait aussi l'autre :
    // l'horloge continue.
    const etaitEnPause = enPause || enCommun;
    if (!etaitEnPause) moteur.pause();
    const reprendreSiBesoin = () => {
      if (!etaitEnPause) moteur.reprendre();
    };
    const partielle = realisation(false);
    const { faites, prevues } = compteSeries(partielle);
    const libelles: Record<ChoixSortie, ChoixDialogue> = {
      'plus-tard': {
        libelle: 'Reprendre plus tard',
        detail: 'On garde où tu en es : « Reprendre » sur l’accueil.',
        variante: 'accent',
        action: garderPourPlusTard,
      },
      enregistrer: {
        libelle: 'Enregistrer ce qui est fait',
        detail: phraseEnregistrementPartiel(partielle),
        variante: 'neutre',
        action: () => {
          clotureeRef.current = true;
          onTerminee(partielle);
          onProgression(null);
        },
      },
      jeter: essai
        ? { libelle: 'Quitter l’essai', detail: 'Rien n’est gardé.', variante: 'neutre', action: abandonner }
        : {
            libelle: 'Tout jeter',
            detail: 'Rien n’est gardé : ni les séries faites, ni la reprise.',
            variante: 'danger',
            action: () =>
              setDialogue({
                titre: 'Tout jeter ?',
                texte: `${faites} série${faites > 1 ? 's' : ''} sur ${prevues} : tout est perdu.`,
                choix: [
                  { libelle: 'Oui, tout jeter', variante: 'danger', action: abandonner },
                  { libelle: 'Non, revenir', variante: 'fantome', action: reprendreSiBesoin },
                ],
                onFermer: reprendreSiBesoin,
              }),
          },
      continuer: {
        libelle: essai ? 'Continuer l’essai' : 'Continuer la séance',
        variante: 'fantome',
        action: reprendreSiBesoin,
      },
    };
    setDialogue({
      titre: essai ? 'Quitter l’essai ?' : 'Quitter la séance ?',
      texte: essai ? undefined : `${faites} série${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${prevues}.`,
      choix: choixDeSortie({ essai: essai !== undefined, seriesFaites: faites }).map((choix) => libelles[choix]),
      onFermer: reprendreSiBesoin,
    });
  };

  /** « Ne pas enregistrer », à la fin : on demande d'abord. */
  const demanderAbandon = () =>
    confirmer({
      titre: 'Ne pas enregistrer ?',
      texte: 'Toute la séance est perdue : séries, charges, ressenti.',
      oui: 'Oui, ne rien garder',
      action: abandonner,
      danger: true,
    });

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
  /** L'un ou l'autre a mal à cet exercice. */
  const douleurDeColonne = (qui: QuiColonne, exerciceId: string) => douleurDe(douleursDe(qui), exerciceId) !== null;
  const douleurIci = (exerciceId: string) => douleurDeColonne('moi', exerciceId);
  // Après la dernière série d'un exercice : facile, correct ou difficile ?
  // Pendant la pause qui suit, ou, pour le dernier exercice, aux étirements.
  // Sur un seul téléphone, les visages sont sur la ligne de la dernière série
  // de la liste : seuls les étirements les redemandent, pour chacun.
  const panneauRessenti = unTelephone ? (
    <div className="space-y-2">
      {exercicesAEvaluer(etapes, index)
        // Rien à dire sur la charge d'un exercice qui n'en a pas.
        .filter((id) => seCharge(exerciceDeSeance(id)))
        .map((id) => (
          <RessentiDesColonnes
            key={id}
            exerciceId={id}
            nom={exerciceDeSeance(id).nomFr}
            colonnes={colonnes}
            ressentiDe={ressentiDe}
            onRessenti={choisirRessentiDe}
          />
        ))}
    </div>
  ) : (
    <BoutonsRessenti
      exercices={exercicesAEvaluer(etapes, index)
        .map(exerciceDeSeance)
        // Rien à dire sur la charge d'un exercice qui n'en a pas.
        .filter(seCharge)
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
            onProlongerChangement={prolongerMouvement}
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
          douleur={douleurIci(exercice.id)}
          onBasculerDouleur={onBasculerDouleur ? () => basculerDouleurDe('moi', exercice.id) : undefined}
          onPasser={demanderPasserExercice}
        />
      );
      break;
    case 'serie':
    case 'station': {
      const douleur = douleurIci(etape.exerciceId);
      corps = exercice && (
        <CorpsTravail
          // Signaler une douleur refait la saisie de la série : à 70 %.
          key={`${etape.exerciceId}-${index}${douleur ? '-douleur' : ''}`}
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
          charges={chargesIci(etape.exerciceId, etape.type === 'serie' ? etape.serie : etape.tour)}
          chargesPassees={chargesPassees[etape.exerciceId] ?? []}
          unitePoids={unitePoids}
          douleur={douleur}
          onBasculerDouleur={onBasculerDouleur ? () => basculerDouleurDe('moi', etape.exerciceId) : undefined}
          onPoids={(serie, charge, allegee) => changerPoids(etape.exerciceId, serie, charge, allegee)}
          onPasser={demanderPasserExercice}
        />
      );
      break;
    }
    // Sur un seul téléphone, la liste du programme en tient lieu (plus bas).
    case 'exercice':
      corps = null;
      break;
    case 'repos':
    case 'reposTour': {
      // La charge à installer pour la série qui vient.
      const cible = etape.suivant;
      const charge =
        cible.type === 'serie' && seCharge(exerciceDeSeance(cible.exerciceId))
          ? chargesIci(cible.exerciceId, cible.serie).proposee
          : 0;
      const parCote = cible.type === 'serie' && charge > 0 && exerciceDeSeance(cible.exerciceId).chargeParCote === true;
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
          charge={
            charge > 0
              ? `${charge} ${SUFFIXE_UNITE[unitePoids]}${parCote ? ` · ${libelleParCote(charge, unitePoids)}` : ''}`
              : undefined
          }
          etirement={etirement}
          ressenti={panneauRessenti}
        />
      );
      break;
    }
    case 'fin':
      corps = (
        <CorpsFin
          realisee={realisation(true)}
          chargeDerniereFois={chargeDerniereFois}
          chargeDerniereFoisAutre={chargeDerniereFoisAutre}
          nomMoi={personne ? NOM_PERSONNE[personne] : undefined}
          essai={essai}
          onEnregistrer={enregistrer}
          onAbandonner={essai ? abandonner : demanderAbandon}
        />
      );
      break;
  }

  // Sur un seul téléphone, pendant les exercices et leurs pauses : la liste de
  // tout le programme, l'exercice en cours déroulé. Le guide du tempo d'un
  // exercice n'y vient que si on le demande.
  const exerciceGuide = serieGuidee ? exerciceDeSeance(serieGuidee.exerciceId) : null;
  const guide =
    serieGuidee && exerciceGuide ? (
      <GuideDeSerie
        etape={serieGuidee}
        exercice={exerciceGuide}
        metro={metro}
        changement={changement}
        onProlongerChangement={prolongerChangement}
        maintien={maintien}
        resteSec={Math.max(0, dureeSerieSec(exerciceGuide, serieGuidee.reps, tempo) + prolongation - ecouleGuide)}
        tempo={tempo}
        prolongationSec={prolongation}
        guideVisuel={guideVisuel}
        lireEcouleSec={lireEcouleGuide}
        compact
      />
    ) : null;
  if (enListe) {
    corps = (
      <ListeProgramme
        seance={seanceActive}
        etapes={etapes}
        index={index}
        colonnes={colonnes}
        unitePoids={unitePoids}
        saisies={(qui, id) => (qui === 'moi' ? poids : poidsAutre)[id] ?? []}
        charges={chargesDe}
        faites={faites}
        ressentiDe={ressentiDe}
        douleur={douleurDeColonne}
        onBasculerDouleur={onBasculerDouleur ? basculerDouleurDe : undefined}
        onCharge={changerCharge}
        onRessenti={choisirRessentiDe}
        guide={serieGuidee && guide ? { exerciceId: serieGuidee.exerciceId, noeud: guide } : null}
        onTempo={basculerGuideTempo}
        manquants={manquantsMontres === visite ? manquants : []}
        onPasser={demanderPasserExercice}
      />
    );
  }

  // La barre du bas : le gros bouton de l'étape, toujours au même endroit,
  // sous le pouce — et la pause à côté. Rien à l'écran de fin : « Enregistrer »
  // y est en haut, au-dessus du tableau.
  const boutonPause = (
    <Bouton variante="pause" taille="etroit" onClick={basculerPause} className="flex-1">
      {enPause ? 'Reprendre' : 'Pause'}
    </Bouton>
  );
  const posture = exercice !== null && estPosture(exercice);
  let actions: ReactNode = null;
  switch (etape.type) {
    case 'echauffement':
      actions = (
        <Bouton variante="accent" onClick={suivant} className="flex-[2]">
          Passer l’échauffement
        </Bouton>
      );
      break;
    case 'pret':
      actions = (
        <Bouton variante="accent" taille="vedette" onClick={suivant} className="flex-[2]">
          Démarrer
        </Bouton>
      );
      break;
    case 'serie':
    case 'station':
      actions = (
        <Bouton variante="accent" taille="vedette" onClick={suivant} className="flex-[2]">
          {etape.type === 'station' ? 'Station terminée' : posture ? 'Position terminée' : 'Série terminée'}
        </Bouton>
      );
      break;
    case 'repos':
    case 'reposTour':
      actions =
        etape.type === 'repos' && etape.manuel ? (
          <Bouton variante="montee" taille="vedette" onClick={suivant} className="flex-[2]">
            Go
          </Bouton>
        ) : (
          <>
            <Bouton variante="neutre" taille="etroit" onClick={prolongerRepos} className="flex-1">
              +{PROLONGATION_REPOS_SEC} s
            </Bouton>
            <Bouton variante="accent" taille="vedette" onClick={suivant} className="flex-[1.6]">
              Passer
            </Bouton>
          </>
        );
      break;
    case 'retourCalme':
      actions = (
        <Bouton variante="accent" onClick={suivant} className="flex-[2]">
          Étirements finis
        </Bouton>
      );
      break;
    case 'exercice':
    case 'fin':
      actions = null;
      break;
  }
  if (enListe) {
    if (etape.type === 'exercice') {
      // Pas de décompte : « Pause · 1 min » pour souffler entre deux tours,
      // et un seul « Exercice terminé », grisé tant qu'il manque un visage.
      const pauseSec = groupeEnCours[groupeEnCours.length - 1]?.reposSec ?? 0;
      const resteTour = restePauseTourSec(pauseTour, visite, maintenant);
      const [manquant] = manquants;
      const nomDe = (qui: QuiColonne) =>
        colonnes.length > 1 ? nomColonne(colonnes.find((colonne) => colonne.qui === qui) ?? colonneMoi) : undefined;
      actions = (
        <>
          {pauseSec > 0 && (
            <Bouton
              variante={resteTour !== null ? 'pause' : 'neutre'}
              taille="etroit"
              onClick={() => basculerPauseTour(pauseSec)}
              libelle={resteTour !== null ? undefined : `Pause · ${dureePause(pauseSec)}`}
              className="flex-1"
            >
              {resteTour !== null ? (
                <>
                  <span className="chiffres block text-2xl font-bold leading-none" aria-live="polite">
                    {formaterMmSs(Math.ceil(resteTour))}
                  </span>
                  <span className="block text-xs font-normal leading-tight">Arrêter la pause</span>
                </>
              ) : (
                <>
                  <span className="block leading-tight">Pause</span>
                  <span className="chiffres block text-sm font-normal leading-tight">{dureePause(pauseSec)}</span>
                </>
              )}
            </Bouton>
          )}
          <Bouton
            variante="accent"
            taille="vedette"
            inactif={manquant !== undefined}
            onClick={terminerExercice}
            className="flex-[2.2]"
          >
            <span className="block leading-tight">{estPaire(etape) ? 'Paire terminée' : 'Exercice terminé'}</span>
            <span className="block text-sm font-normal leading-tight">
              {manquant ? phraseVisageManquant(manquant, nomDe, estPaire(etape)) : `≈ ${formaterDureeCourte(etape.dureeSec)}`}
            </span>
          </Bouton>
        </>
      );
    } else {
      // La pause lancée : son décompte, « +15 s », et « Passer ».
      actions = (
        <>
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
            <span
              className="chiffres text-3xl font-bold leading-none"
              style={{ color: couleurCompte(reste, 'var(--descente)') }}
            >
              {formaterMmSs(Math.ceil(reste))}
            </span>
            <span className="text-xs" style={{ color: 'var(--texte-discret)' }}>
              pause
            </span>
          </div>
          <Bouton variante="neutre" taille="etroit" onClick={prolongerRepos} className="flex-1">
            +{PROLONGATION_REPOS_SEC} s
          </Bouton>
          <Bouton variante="accent" taille="vedette" onClick={suivant} className="flex-[1.4]">
            Passer
          </Bouton>
        </>
      );
    }
  }

  const ensuite = enListe ? ensuiteDansLaListe(seanceActive, etapes, etape) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-colors duration-500"
      // La hauteur visible, barre du navigateur ôtée : la barre d'actions
      // reste au-dessus d'elle.
      style={{ background: ambiance.fond, color: 'var(--texte)', height: '100dvh' }}
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
        onPrecedent={precedent}
        precedentPossible={index > 0 && !enCommun}
        onSuivant={estFin ? undefined : suivantEnHaut}
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
      <div ref={conteneurRef} className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto w-full max-w-md px-4 py-4">{corps}</main>
      </div>
      {actions && (
        <footer
          aria-label="Actions"
          className="shrink-0 px-4 pt-3"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--bordure)',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          {ensuite && (
            <p className="mx-auto mb-2 max-w-md truncate text-sm font-semibold">
              <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
                Ensuite ·{' '}
              </span>
              {ensuite}
            </p>
          )}
          <div className="mx-auto flex max-w-md gap-2">
            {/* Sur un seul téléphone, la liste n'a pas de chrono à arrêter —
                sauf pour reprendre une pause demandée plus tôt. */}
            {(!enListe || enPause) && boutonPause}
            {actions}
          </div>
        </footer>
      )}
      {dialogue && <Dialogue dialogue={dialogue} onFermer={fermerDialogue} />}
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
  const sauvee = progression ? versLeDerouleParExercice(progression) : null;
  const etapesSauvees = sauvee ? construireEtapes(sauvee.seance) : null;
  const etapeSauvee = etapesSauvees
    ? etapesSauvees[Math.max(0, Math.min(sauvee?.indexEtape ?? 0, etapesSauvees.length - 1))]
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
  /** « Précédent » et « Suivant », en petit, en haut : loin du pouce. */
  onPrecedent: () => void;
  precedentPossible: boolean;
  /** Absent à l'écran de fin. */
  onSuivant?: () => void;
}

/** Les petits boutons de l'en-tête : la cible tactile minimale, sans plus. */
const PETIT_BOUTON_HAUT = 'min-h-11 shrink-0 rounded-xl px-3 text-sm';

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
  onPrecedent,
  precedentPossible,
  onSuivant,
}: EnTeteProps) {
  const rempli = Math.min(100, Math.max(0, avancement * 100));
  return (
    <header className="shrink-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bordure)' }}>
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
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrecedent}
            disabled={!precedentPossible}
            className={`${BOUTON_COMMUN} ${PETIT_BOUTON_HAUT}`}
            style={STYLES_BOUTON.neutre}
          >
            ‹ Précédent
          </button>
          <div className="chiffres min-w-0 text-center text-xs leading-tight" style={{ color: 'var(--texte-discret)' }}>
            <div>Écoulé {formaterMmSs(ecouleSec)}</div>
            <div>Reste ~ {formaterMmSs(resteSec)}</div>
          </div>
          <button
            type="button"
            onClick={onSuivant}
            disabled={!onSuivant}
            className={`${BOUTON_COMMUN} ${PETIT_BOUTON_HAUT}`}
            style={STYLES_BOUTON.neutre}
          >
            Suivant ›
          </button>
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
  /** « +5 s » au changement de côté. */
  onProlongerChangement: () => void;
}

/** Échauffement et retour au calme : les mouvements défilent automatiquement.
 *  Entre les deux côtés d'un mouvement d'un seul côté, cinq secondes pour
 *  changer de côté, comme aux séries. */
function CorpsMouvements({
  titre,
  mouvements,
  indexMouvement,
  resteMouvementSec,
  resteSec,
  onProlongerChangement,
}: CorpsMouvementsProps) {
  const courant = mouvements[indexMouvement];
  const prochain = mouvements[indexMouvement + 1];
  if (courant?.changementDeCote) {
    const secondes = Math.ceil(resteMouvementSec);
    return (
      <div className="space-y-4 text-center">
        <p style={{ color: 'var(--texte-discret)' }}>
          {titre} · reste <span className="chiffres">{formaterMmSs(Math.ceil(resteSec))}</span>
        </p>
        <div className="select-none space-y-3 rounded-2xl p-4" style={{ background: 'var(--surface)' }}>
          <div className="text-4xl font-extrabold tracking-[0.08em]" style={{ ...ARCHIVO, color: 'var(--accent)' }}>
            CHANGE DE CÔTÉ
          </div>
          <div
            className="chiffres text-9xl font-bold leading-none"
            style={{ color: couleurCompte(resteMouvementSec, 'var(--texte)') }}
          >
            {secondes}
          </div>
          {prochain && <div className="text-xl font-medium">{prochain.nom}</div>}
          <Bouton variante="neutre" onClick={onProlongerChangement} className="w-full">
            +{PROLONGATION_CHANGEMENT_SEC} s
          </Bouton>
        </div>
      </div>
    );
  }
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
  /** « J'ai mal à cet exercice » est signalé. */
  douleur: boolean;
  /** Absent : on ne peut pas le signaler d'ici (aperçu de l'autre). */
  onBasculerDouleur?: () => void;
  onPasser: () => void;
}

function CorpsPret({ etape, exercice, resteSec, douleur, onBasculerDouleur, onPasser }: CorpsPretProps) {
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
        {douleur && <ReperDouleur avecCharge={seCharge(exercice)} />}
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
      {onBasculerDouleur && !estPosture(exercice) && (
        <BoutonDouleur actif={douleur} avecCharge={seCharge(exercice)} onBasculer={onBasculerDouleur} />
      )}
      {/* Loin du gros bouton du bas, et on demande avant. */}
      <Bouton variante="fantome" taille="petit" onClick={onPasser} className="w-full underline">
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
  /** La charge de la série : pré-remplie, 70 % et 100 %. */
  charges: ChargesSerie;
  /** Charges de la dernière fois, série par série ; vide si aucune. */
  chargesPassees: number[];
  unitePoids: UnitePoids;
  /** « J'ai mal à cet exercice » est signalé. */
  douleur: boolean;
  /** Absent : on ne peut pas le signaler d'ici. */
  onBasculerDouleur?: () => void;
  /** `allegee` : à 70 % d'un toucher — elle ne dira pas la charge de travail. */
  onPoids: (serie: number, charge: number | null, allegee?: boolean) => void;
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
  charges,
  chargesPassees,
  unitePoids,
  douleur,
  onBasculerDouleur,
  onPoids,
  onPasser,
}: CorpsTravailProps) {
  // Numéro de la série en cours : le tour, pour une station de circuit.
  const serieCourante = etape.type === 'serie' ? etape.serie : etape.tour;
  const dejaSaisi = poidsSeries[serieCourante - 1] ?? 0;
  // Sans saisie pour cette série, la charge proposée (`chargesDeLaSerie`) :
  // celle de la série d'avant, sinon de la dernière fois — un cran plus loin
  // si le ressenti le demande ; à 70 % pour la première série d'un exercice
  // qui charge le dos, et pour chaque série d'un exercice où l'on a mal.
  const { proposee: valeurDepart, pleine, allegee } = charges;
  // Le cran proposé sur la charge de la dernière fois : le ressenti. Avec une
  // douleur, jamais de montée.
  const ajustementBrut = chargesPassees.some((charge) => charge > 0) ? ajustementDeCharge(bloc) : null;
  const ajustement = douleur && ajustementBrut && ajustementBrut.ajout > 0 ? null : ajustementBrut;
  // Une série longue qui charge le bas du dos : le rappel qui protège.
  const dosAMenager = etape.type === 'serie' && etape.reps >= 10 && chargeLeBasDuDos(exercice);

  // Le texte saisi est gardé tel quel (« 12, » ne doit pas être réécrit en
  // « 12 » à chaque frappe) ; seule la valeur numérique remonte au parent.
  const [texte, setTexte] = useState(valeurDepart > 0 ? String(valeurDepart) : '');
  // Le 100 % des raccourcis : la charge de travail connue ; à défaut (premier
  // poids de l'exercice, ou essai), celle qu'on vient de taper. Un raccourci
  // ne la change pas : 70 % reste 70 % de ce qu'on a tapé.
  const [tapee, setTapee] = useState(0);
  const saisirPoids = (evenement: ChangeEvent<HTMLInputElement>) => {
    const valeur = evenement.target.value;
    setTexte(valeur);
    const charge = Number.parseFloat(valeur.replace(',', '.'));
    setTapee(Number.isFinite(charge) && charge > 0 ? charge : 0);
    onPoids(serieCourante, Number.isFinite(charge) ? charge : null);
  };
  /** Un raccourci, 70 % ou 100 % : la charge vraiment faite. À 70 %, elle ne
   *  dit pas la charge de travail : la série d'après repart du 100 %. */
  const choisirCharge = (charge: number, allegee: boolean) => {
    setTexte(String(charge));
    onPoids(serieCourante, charge, allegee);
  };
  const chargeSaisie = Number.parseFloat(texte.replace(',', '.'));
  const base = pleine > 0 ? pleine : tapee;
  const allegeeBase = pleine > 0 ? allegee : chargeAllegee(tapee, unitePoids);
  const disques = libelleDisques(exercice);

  // La charge proposée est enregistrée d'office : sans cela, une série faite
  // avec la même charge ressortirait vide du bilan.
  const avecCharge = seCharge(exercice);
  const reprise = avecCharge && dejaSaisi === 0 ? valeurDepart : 0;
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
          {douleur && <ReperDouleur avecCharge={avecCharge} className="mt-1" />}
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

      <GuideDeSerie
        etape={etape}
        exercice={exercice}
        metro={metro}
        changement={changement}
        onProlongerChangement={onProlongerChangement}
        maintien={maintien}
        resteSec={resteSec}
        tempo={tempo}
        prolongationSec={prolongationSec}
        guideVisuel={guideVisuel}
        lireEcouleSec={lireEcouleSec}
      />

      <details className="rounded-2xl px-4" style={{ background: 'var(--surface)' }}>
        <summary className="cursor-pointer py-3 font-medium">
          Points d’attention{onBasculerDouleur && !posture ? ' · douleur' : ''}
        </summary>
        <ul className="list-disc space-y-1 pb-3 pl-5" style={{ color: 'var(--texte-discret)' }}>
          {consignesDe(exercice).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        {onBasculerDouleur && !posture && (
          <BoutonDouleur actif={douleur} avecCharge={avecCharge} onBasculer={onBasculerDouleur} className="mb-3" />
        )}
      </details>

      {/* Une posture, un étirement ou un exercice au poids du corps ne se
          charge pas : la case de saisie n'aurait rien à recevoir. */}
      {avecCharge && (
        <div className="space-y-2 rounded-2xl px-4 py-3" style={{ background: 'var(--surface)' }}>
          <label className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-medium">
                Poids série <span className="chiffres">{serieCourante}</span> ({SUFFIXE_UNITE[unitePoids]})
              </span>
              {disques && (
                <span className="block text-xs" style={{ color: 'var(--texte-discret)' }}>
                  {disques}
                </span>
              )}
              {poidsSeries.some((charge) => charge > 0) && (
                <span className="chiffres block text-xs" style={{ color: 'var(--texte-discret)' }}>
                  {poidsSeries.map((charge, i) => `S${i + 1} ${charge > 0 ? charge : '—'}`).join(' · ')}
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
              className="chiffres h-14 w-28 shrink-0 rounded-xl border-2 text-center text-2xl"
              style={{
                background: 'var(--surface-haute)',
                color: 'var(--texte)',
                borderColor: 'var(--bordure)',
              }}
            />
          </label>
          {/* Deux raccourcis : ce qu'on a vraiment fait, d'un toucher. */}
          {base > 0 && (
            <div role="group" aria-label="Charge faite" className="grid grid-cols-2 gap-2">
              {(allegeeBase < base ? [['70 %', allegeeBase] as const, ['100 %', base] as const] : [['100 %', base] as const]).map(
                ([part, charge]) => {
                  const choisie = chargeSaisie === charge;
                  return (
                    <button
                      key={part}
                      type="button"
                      aria-pressed={choisie}
                      onClick={() => choisirCharge(charge, part === '70 %')}
                      className={`${BOUTON_COMMUN} chiffres min-h-11 rounded-xl px-2 text-base`}
                      style={choisie ? STYLES_BOUTON.accent : STYLES_BOUTON.neutre}
                    >
                      {part} · {charge} {SUFFIXE_UNITE[unitePoids]}
                    </button>
                  );
                },
              )}
            </div>
          )}
          {exercice.chargeParCote && chargeSaisie > 0 && (
            <p className="chiffres text-sm font-semibold">{libelleParCote(chargeSaisie, unitePoids)}</p>
          )}
        </div>
      )}

      {/* Loin du gros bouton du bas, et on demande avant. */}
      <Bouton variante="fantome" taille="petit" onClick={onPasser} className="w-full underline">
        Passer l’exercice
      </Bouton>
    </div>
  );
}

interface GuideDeSerieProps {
  etape: EtapeTravail;
  exercice: Exercice;
  metro: EtatMetronome | null;
  /** Le changement de côté au milieu d'une série unilatérale ; null sinon. */
  changement: EtatChangementCote | null;
  /** « +5 s » au changement de côté. */
  onProlongerChangement: () => void;
  /** Position tenue d'un côté puis de l'autre ; null sinon. */
  maintien: EtatMaintien | null;
  /** Ce qui reste de la série, pour un exercice au temps. */
  resteSec: number;
  tempo: Tempo;
  prolongationSec: number;
  guideVisuel: GuideVisuel;
  lireEcouleSec: () => number;
  /** Dans la carte de la liste, plus étroite : le mot de la phase un cran
   *  plus petit, pour que « DESCENDS » tienne sur 375 px. */
  compact?: boolean;
}

/** Ce qui rythme une série : le changement de côté, le métronome et sa
 *  bille, le cercle au temps, ou le décompte d'une tenue. Dans la séance
 *  guidée d'une séance libre, toujours ; sur un seul téléphone, seulement si
 *  on le demande (« Tempo »). */
function GuideDeSerie({
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
  compact = false,
}: GuideDeSerieProps) {
  if (changement) return <ChangementDeCote changement={changement} onProlonger={onProlongerChangement} />;
  if (metro) {
    return (
      <Metronome
        etape={etape}
        metro={metro}
        exercice={exercice}
        tempo={tempo}
        prolongationSec={prolongationSec}
        guideVisuel={guideVisuel}
        lireEcouleSec={lireEcouleSec}
        compact={compact}
      />
    );
  }
  if (maintien?.sens) return <CercleAuTemps maintien={maintien} avecCercle={guideVisuel !== 'chiffre'} />;
  // Exercice au temps : pas de répétition à rythmer, donc pas de bille,
  // seulement le décompte du maintien.
  return (
    <div className="select-none py-2 text-center">
      <div
        className="text-xs font-bold uppercase tracking-[0.18em]"
        style={{ color: maintien ? 'var(--accent)' : 'var(--texte-discret)' }}
      >
        {maintien?.cote
          ? `Côté ${maintien.cote}`
          : etape.type === 'station' && etape.rythme === 'libre'
            ? 'À fond jusqu’au signal'
            : estPosture(exercice)
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
  compact?: boolean;
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
function Metronome({
  etape,
  metro,
  exercice,
  tempo,
  prolongationSec,
  guideVisuel,
  lireEcouleSec,
  compact = false,
}: MetronomeProps) {
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
      <div
        className={`${compact ? 'text-4xl tracking-[0.06em]' : 'text-5xl tracking-[0.12em]'} font-extrabold`}
        style={{ ...ARCHIVO, color: couleur }}
      >
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

function CorpsRepos({ etape, resteSec, partenaire, charge, etirement, ressenti }: CorpsReposProps) {
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
      {/* La place est gardée d'avance : rien ne bouge quand le décompte
          tombe à zéro. */}
      {attendGo && (
        <p
          className="text-lg font-bold"
          style={{ color: 'var(--montee)', visibility: resteSec <= 0 ? 'visible' : 'hidden' }}
          aria-hidden={resteSec > 0}
        >
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
    </div>
  );
}

interface CorpsFinProps {
  realisee: SeanceRealisee;
  chargeDerniereFois?: number;
  /** Sur un seul téléphone, à deux : celle de l'autre la dernière fois. */
  chargeDerniereFoisAutre?: number;
  /** Le nom de la personne du téléphone, pour les distinguer. */
  nomMoi?: string;
  /** Un essai : rien à enregistrer, un seul bouton pour fermer. */
  essai?: Essai;
  onEnregistrer: () => void;
  onAbandonner: () => void;
}

/** La charge soulevée, et l'écart avec la dernière fois. Sur un seul
 *  téléphone, à deux, une pour chacun (`qui`). */
function ChargeSoulevee({
  total,
  derniere,
  unite,
  qui,
}: {
  total: number;
  derniere?: number;
  unite: UnitePoids;
  qui?: string;
}) {
  const suffixe = SUFFIXE_UNITE[unite];
  const ecart = derniere !== undefined && derniere > 0 ? total - derniere : null;
  const pourcent = ecart !== null && derniere ? Math.round((ecart / derniere) * 100) : 0;
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--surface)' }}>
      <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--texte-discret)' }}>
        Charge totale soulevée{qui ? ` · ${qui}` : ''}
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

function CorpsFin({
  realisee,
  chargeDerniereFois,
  chargeDerniereFoisAutre,
  nomMoi,
  essai,
  onEnregistrer,
  onAbandonner,
}: CorpsFinProps) {
  const seriesFaites = realisee.exercices.reduce((total, e) => total + e.seriesFaites, 0);
  const seriesPrevues = realisee.exercices.reduce((total, e) => total + e.seriesPrevues, 0);
  const total = chargeTotale(realisee);
  // Sur un seul téléphone, à deux : ce que l'autre a fait, noté ici.
  const sien = realisee.partenaire;
  const totalSien = sien ? chargeTotale({ ...realisee, exercices: sien.exercices }) : 0;
  const unite = uniteDeSeance(realisee.parametres);
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
        {!essai && !assezFaite(realisee) && (
          <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
            Moins de la moitié des séries : la journée ne sera pas cochée.
          </p>
        )}
      </div>

      {/* En haut, au-dessus du tableau : visible sans défiler. */}
      <Bouton variante="montee" taille="vedette" onClick={essai ? onAbandonner : onEnregistrer} className="w-full">
        {essai ? essai.boutonFin : 'Enregistrer la séance'}
      </Bouton>

      {/* Un essai n'est pas comparé à la dernière fois : il ne sera pas gardé. */}
      {total > 0 && !essai && (
        <ChargeSoulevee
          total={total}
          derniere={chargeDerniereFois}
          unite={unite}
          qui={sien ? nomMoi : undefined}
        />
      )}
      {sien && totalSien > 0 && !essai && (
        <ChargeSoulevee total={totalSien} derniere={chargeDerniereFoisAutre} unite={unite} qui={NOM_PERSONNE[sien.personne]} />
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
                    {/* L'autre, sur un seul téléphone : ses séries, ses charges, son ressenti. */}
                    {sien && <LigneDeLAutre realisee={realisee} exerciceId={realise.exerciceId} />}
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

      {/* Tout en bas, loin d'« Enregistrer », en petit ; on demande avant. */}
      {!essai && (
        <div className="pt-8 text-center">
          <Bouton variante="fantome" taille="petit" onClick={onAbandonner} className="underline">
            Ne pas enregistrer
          </Bouton>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- Sur un seul téléphone
//
// Un seul téléphone pour deux (décision de Sébastien, 12 octobre 2026) :
// celui qui le tient note pour les deux. Pendant les exercices et leurs
// pauses, l'écran est la liste de tout le programme du jour — l'exercice en
// cours déroulé, le suivant en vue (« Ensuite »), le reste en une ligne. Pour
// l'exercice en cours (ou la paire), toutes ses séries d'un coup (13 octobre
// 2026) : une ligne par série, la charge de Speedy et celle de Big Max côte à
// côte, pré-remplies avec celles de la dernière fois, et les visages sur la
// dernière série de chacun.

/** Une colonne de la liste : la personne du téléphone, ou l'autre. */
export interface ColonneDuo {
  qui: QuiColonne;
  /** Absente : seul, sans personne connue. */
  personne?: Personne;
}

const nomColonne = (colonne: ColonneDuo): string => (colonne.personne ? NOM_PERSONNE[colonne.personne] : 'Charge');

/** « 3 × 10 », « 4 × 30 s par côté » : le volume d'une personne. */
function volumeCourt(exercice: Exercice, series: number, reps: number): string {
  if (exercice.unite === 'secondes') return `${series} × ${reps} s${precisionAuTemps(exercice)}`;
  return `${series} × ${reps}${exercice.cotes === 'unilateral' ? ' par côté' : exercice.cotes === 'alterne' ? ' en alternant' : ''}`;
}

/** Les séries et les répétitions d'une colonne sur un bloc. */
function volumeDeColonne(bloc: BlocSeries, qui: QuiColonne): { series: number; reps: number } {
  if (qui === 'moi') return { series: bloc.series, reps: bloc.reps };
  return { series: bloc.autre?.series ?? 0, reps: bloc.autre?.reps ?? bloc.reps };
}

/** « 1 min », « 1 min 30 », « 45 s » */
function dureePause(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const secondes = Math.round(sec % 60);
  if (minutes === 0) return `${secondes} s`;
  return secondes === 0 ? `${minutes} min` : `${minutes} min ${secondes}`;
}

export interface ListeProgrammeProps {
  seance: Seance;
  etapes: Etape[];
  index: number;
  /** Une colonne chacun, Speedy d'abord ; une seule, seul. */
  colonnes: ColonneDuo[];
  unitePoids: UnitePoids;
  /** Les charges notées pour une colonne, série par série. */
  saisies: (qui: QuiColonne, exerciceId: string) => number[];
  /** La charge d'une série : pré-remplie, 70 % et 100 %. */
  charges: (qui: QuiColonne, exerciceId: string, serie: number) => ChargesSerie;
  /** Les exercices finis sur « Exercice terminé », par leur place dans les
   *  étapes. */
  faites: readonly number[];
  ressentiDe: (qui: QuiColonne, exerciceId: string) => Ressenti | undefined;
  /** « J'ai mal à cet exercice », pour l'une ou l'autre colonne. */
  douleur: (qui: QuiColonne, exerciceId: string) => boolean;
  /** Absent : on ne peut pas le signaler d'ici. */
  onBasculerDouleur?: (qui: QuiColonne, exerciceId: string) => void;
  /** Note la charge d'une série ; `allegee` : à 70 % d'un toucher. */
  onCharge: (qui: QuiColonne, exerciceId: string, serie: number, charge: number | null, allegee?: boolean) => void;
  onRessenti: (qui: QuiColonne, exerciceId: string, ressenti: Ressenti) => void;
  /** Le guide du tempo d'un exercice, quand on l'a demandé. */
  guide: { exerciceId: string; noeud: ReactNode } | null;
  /** « Tempo » sur un exercice ; absent : pas de bouton. */
  onTempo?: (exerciceId: string) => void;
  /** Les visages qui manquent, à montrer : « Exercice terminé » a été touché
   *  sans eux. */
  manquants?: readonly VisageManquant[];
  /** « Passer cet exercice » : ses séries ne comptent pas ; on demande avant. */
  onPasser: () => void;
}

/** Tout le programme du jour, en liste. */
export function ListeProgramme(props: ListeProgrammeProps) {
  const { seance, etapes, index, colonnes, faites } = props;
  const groupes = useMemo(() => groupesUnTelephone(seance), [seance]);
  // Les étapes de chaque groupe : de la première (l'exercice) à la dernière
  // (sa pause).
  const bornes = useMemo(
    () =>
      groupes.map((_, g) => {
        let debut = -1;
        let fin = -1;
        etapes.forEach((etape, i) => {
          if (groupeDeLaListe(etape) === g) {
            if (debut < 0) debut = i;
            fin = i;
          }
        });
        return { debut, fin };
      }),
    [groupes, etapes],
  );
  const courant = groupeDeLaListe(etapes[index]);

  // À chaque nouvel exercice, sa carte vient sous les yeux.
  const carteRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    carteRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [courant]);

  const echauffement = etapes.findIndex((e) => e.type === 'echauffement');
  const retourCalme = etapes.findIndex((e) => e.type === 'retourCalme');
  const statut = (debut: number, fin: number): StatutLigne =>
    index > fin ? 'fait' : index < debut ? 'a-venir' : 'en-cours';
  // Les paires sont numérotées ; un exercice seul ne l'est pas.
  const numeros = groupes.map((_, g) => groupes.slice(0, g + 1).filter((groupe) => groupe.length > 1).length);
  const ensuite = courant === undefined ? -1 : courant + 1;

  return (
    <ol className="space-y-2" aria-label="Le programme du jour">
      {echauffement >= 0 && <LigneEtape nom="Échauffement" statut={statut(echauffement, echauffement)} />}
      {groupes.map((groupe, g) => {
        const etapeExercice = etapes[bornes[g].debut];
        return g === courant ? (
          <CarteGroupe
            key={groupe[0].exerciceId}
            ref={carteRef}
            {...props}
            groupe={groupe}
            numero={numeros[g]}
            exercice={etapeExercice?.type === 'exercice' ? etapeExercice : undefined}
            fait={faites.includes(bornes[g].debut)}
            dernier={g === groupes.length - 1}
          />
        ) : (
          <LigneGroupe
            key={groupe[0].exerciceId}
            groupe={groupe}
            numero={numeros[g]}
            colonnes={colonnes}
            statut={statut(bornes[g].debut, bornes[g].fin)}
            ensuite={g === ensuite}
            dernier={g === groupes.length - 1}
          />
        );
      })}
      {retourCalme >= 0 && (
        <LigneEtape nom="Étirements" statut={statut(retourCalme, retourCalme)} ensuite={ensuite === groupes.length} />
      )}
    </ol>
  );
}

type StatutLigne = 'fait' | 'en-cours' | 'a-venir';

/** L'échauffement ou les étirements, en une ligne. */
function LigneEtape({ nom, statut, ensuite = false }: { nom: string; statut: StatutLigne; ensuite?: boolean }) {
  return (
    <li
      className="flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold"
      style={{
        background: 'var(--surface)',
        color: statut === 'fait' ? 'var(--texte-discret)' : 'var(--texte)',
        border: ensuite ? '2px solid var(--accent)' : '1px solid var(--bordure)',
      }}
    >
      {statut === 'fait' && <span style={{ color: 'var(--montee)' }}>✓</span>}
      {ensuite && (
        <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>
          Ensuite
        </span>
      )}
      {nom}
    </li>
  );
}

/** « Paire 2 », ou « Seul ». */
const titreGroupe = (groupe: BlocSeries[], numero: number) => (groupe.length > 1 ? `Paire ${numero}` : 'Seul');

/** Un exercice ou une paire qui n'est pas en cours : fait, à venir — ou le
 *  suivant, mis en avant. */
function LigneGroupe({
  groupe,
  numero,
  colonnes,
  statut,
  ensuite,
  dernier,
}: {
  groupe: BlocSeries[];
  numero: number;
  colonnes: ColonneDuo[];
  statut: StatutLigne;
  ensuite: boolean;
  /** Le dernier exercice : pas de pause après, les étirements suivent. */
  dernier: boolean;
}) {
  const fait = statut === 'fait';
  const exercices = groupe.map((bloc) => exerciceDeSeance(bloc.exerciceId));
  const { series, reps } = volumeDeColonne(groupe[0], colonnes[0]?.qui ?? 'moi');
  return (
    <li
      className="flex items-center gap-3 rounded-2xl p-2"
      style={{
        background: 'var(--surface)',
        border: ensuite ? '2px solid var(--accent)' : '1px solid var(--bordure)',
        opacity: fait ? 0.65 : 1,
      }}
    >
      <div className="flex shrink-0 gap-1">
        {exercices.map((exercice) => (
          <Vignette key={exercice.id} exerciceId={exercice.id} alt="" className={`${ensuite ? 'w-16' : 'w-11'} rounded-lg`} />
        ))}
      </div>
      <div className="min-w-0">
        <div
          className="text-xs font-bold uppercase tracking-[0.14em]"
          style={{ color: ensuite ? 'var(--accent)' : fait ? 'var(--montee)' : 'var(--texte-discret)' }}
        >
          {fait ? '✓ ' : ensuite ? 'Ensuite · ' : ''}
          {titreGroupe(groupe, numero)}
        </div>
        <div className={`${ensuite ? '' : 'truncate'} font-semibold leading-tight`}>
          {exercices.map((exercice) => exercice.nomFr).join(' + ')}
        </div>
        {!fait && (
          <div className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
            {groupe.length > 1 ? `${series} tours` : volumeCourt(exercices[0], series, reps)}
            {dernier ? '' : ` · pause ${dureePause(groupe[groupe.length - 1].reposSec)}`}
          </div>
        )}
      </div>
    </li>
  );
}

/** La case touchée en dernier : ses raccourcis 70 % et 100 % s'affichent
 *  dessous. */
interface Cellule {
  qui: QuiColonne;
  exerciceId: string;
  serie: number;
}

interface CarteGroupeProps extends ListeProgrammeProps {
  groupe: BlocSeries[];
  numero: number;
  /** L'étape de l'exercice : ses séries, dans l'ordre où elles se font. */
  exercice: Extract<Etape, { type: 'exercice' }> | undefined;
  /** Fini sur « Exercice terminé » : les cases disent ce qui est noté. */
  fait: boolean;
  /** Le dernier exercice : pas de pause après, les étirements suivent. */
  dernier: boolean;
  ref: Ref<HTMLLIElement>;
}

/** L'exercice ou la paire en cours, d'un coup : chaque exercice, toutes ses
 *  séries, les charges des deux, et les visages du ressenti sur la dernière
 *  série de chacun. */
function CarteGroupe({ ref, ...props }: CarteGroupeProps) {
  const { groupe, numero, colonnes, etapes, index, dernier, exercice } = props;
  const etape = etapes[index];
  const paire = groupe.length > 1;
  const aDeux = colonnes.length > 1;
  // À deux, la machine d'une paire — un seul siège — se fait chacun son tour.
  const machine = paire && aDeux ? groupe.find((bloc) => bloc.tour) : undefined;
  // Un exercice seul, à deux : une pause entre deux tours, d'un toucher — sauf
  // la marche du fermier, qui enchaîne.
  const entreLesTours = !paire && (!aDeux || pauseEntreLesTours(exerciceDeSeance(groupe[0].exerciceId)));
  // Chacun son tour : qui commence.
  const premiere = exercice?.series.find((serie) => serie.exerciceId === (machine ?? groupe[0]).exerciceId);
  const commence = colonnes.find((colonne) => colonne.qui === (premiere?.qui === 'autre' ? 'autre' : 'moi'));
  const quiCommence = commence ? nomColonne(commence) : 'l’un';
  const explication = paire
    ? aDeux
      ? machine
        ? `la machine chacun son tour (${quiCommence} commence), l’autre ensemble, sans pause entre les tours`
        : 'A, B, A, B, les deux, sans pause entre les tours'
      : 'A, B, A, B, sans pause entre les tours'
    : aDeux
      ? `Chacun son tour : ${quiCommence} commence${entreLesTours ? '' : ', sans pause entre les tours'}`
      : 'Toutes tes séries';
  const pause = groupe[groupe.length - 1].reposSec;
  const consigne = [
    entreLesTours && pause > 0 ? 'Entre les tours : « Pause », en bas, quand vous voulez' : null,
    dernier
      ? 'Pas de pause à la fin : les étirements suivent'
      : `À la fin : ${dureePause(pause)} de pause, lancée par « ${paire ? 'Paire terminée' : 'Exercice terminé'} »`,
  ]
    .filter(Boolean)
    .join(' · ');
  const [cellule, setCellule] = useState<Cellule | null>(null);
  return (
    <li
      ref={ref}
      className="scroll-mt-2 space-y-3 rounded-2xl p-3"
      style={{ background: 'var(--surface)', border: '2px solid var(--montee)' }}
    >
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--montee)' }}>
          {titreGroupe(groupe, numero)} · {explication}
        </div>
        <div className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
          {etape.type === 'repos' ? 'Pause en cours' : consigne}
        </div>
      </div>
      {groupe.map((bloc) => (
        <BlocDuProgramme key={bloc.exerciceId} {...props} bloc={bloc} cellule={cellule} onCellule={setCellule} />
      ))}
      {/* Loin du gros bouton du bas, en petit, et on demande avant. */}
      {etape.type === 'exercice' && (
        <Bouton variante="fantome" taille="petit" onClick={props.onPasser} className="w-full underline">
          {paire ? 'Passer cette paire' : 'Passer cet exercice'}
        </Bouton>
      )}
    </li>
  );
}

/** Un exercice de la carte en cours. */
function BlocDuProgramme({
  bloc,
  colonnes,
  etapes,
  index,
  unitePoids,
  saisies,
  charges,
  fait,
  ressentiDe,
  douleur,
  onBasculerDouleur,
  onCharge,
  onRessenti,
  guide,
  onTempo,
  manquants = [],
  cellule,
  onCellule,
}: Omit<CarteGroupeProps, 'ref'> & { bloc: BlocSeries; cellule: Cellule | null; onCellule: (cellule: Cellule) => void }) {
  const exercice = exerciceDeSeance(bloc.exerciceId);
  const etape = etapes[index];
  const avecCharge = seCharge(exercice);
  const posture = estPosture(exercice);
  const volumes = colonnes
    .map((colonne) => {
      const { series, reps } = volumeDeColonne(bloc, colonne.qui);
      return series > 0 ? `${colonnes.length > 1 ? `${nomColonne(colonne)} ` : ''}${volumeCourt(exercice, series, reps)}` : null;
    })
    .filter(Boolean)
    .join(' · ');
  // Des séries longues qui chargent le bas du dos : le rappel qui protège.
  const dosAMenager = chargeLeBasDuDos(exercice) && Math.max(bloc.reps, bloc.autre?.reps ?? 0) >= 10;
  const guideIci = guide !== null && guide.exerciceId === exercice.id;
  return (
    <div className="space-y-2 rounded-xl p-2" style={{ background: 'var(--surface-haute)', border: '1px solid var(--bordure)' }}>
      <div className="flex items-center gap-3">
        <Vignette exerciceId={exercice.id} alt="" className="w-20 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{exercice.nomFr}</h3>
          <p className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
            {volumes}
          </p>
        </div>
        {/* Le métronome, en petit, si on le veut. */}
        {onTempo && etape.type === 'exercice' && !posture && (
          <button
            type="button"
            aria-pressed={guideIci}
            aria-label={`${guideIci ? 'Arrêter le tempo' : 'Tempo'} : ${exercice.nomFr}`}
            onClick={() => onTempo(exercice.id)}
            className={`${BOUTON_COMMUN} min-h-11 shrink-0 rounded-xl px-3 text-sm`}
            style={guideIci ? STYLES_BOUTON.accent : STYLES_BOUTON.neutre}
          >
            {guideIci ? 'Sans tempo' : 'Tempo'}
          </button>
        )}
      </div>
      {dosAMenager && (
        <p className="text-sm font-semibold" style={{ color: 'var(--alerte)' }}>
          Si le dos s’arrondit, on arrête la série.
        </p>
      )}
      {guideIci && guide.noeud}
      <TableauSeries
        bloc={bloc}
        exercice={exercice}
        colonnes={colonnes}
        unitePoids={unitePoids}
        saisies={saisies}
        charges={charges}
        fait={fait}
        avecCharge={avecCharge}
        onCharge={onCharge}
        ressentiDe={ressentiDe}
        onRessenti={onRessenti}
        douleur={douleur}
        onBasculerDouleur={posture ? undefined : onBasculerDouleur}
        manquants={manquants}
        cellule={cellule}
        onCellule={onCellule}
      />
      <details className="rounded-xl px-2" style={{ background: 'var(--surface)' }}>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Points d’attention</summary>
        <ul className="list-disc space-y-1 pb-2 pl-5 text-sm" style={{ color: 'var(--texte-discret)' }}>
          {consignesDe(exercice).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Ce qu'on fait à une série sans charge : « 10 rép. », « 30 s ». */
function cibleSansCharge(exercice: Exercice, reps: number): string {
  return exercice.unite === 'secondes' ? `${reps} s` : `${reps} rép.`;
}

/** Les séries d'un exercice, une ligne chacune, une colonne par personne :
 *  la charge, pré-remplie avec celle de la dernière fois — on ne tape que si
 *  elle change —, ou ce qu'il y a à faire pour un exercice sans charge. Sous
 *  les noms, « J'ai mal » pour chacun. Sous la case touchée : 70 % et 100 %
 *  d'un toucher, et ce qu'on met de chaque côté. Sous la dernière série de
 *  chacun : les visages du ressenti, obligatoires pour finir l'exercice. */
function TableauSeries({
  bloc,
  exercice,
  colonnes,
  unitePoids,
  saisies,
  charges,
  fait,
  avecCharge,
  onCharge,
  ressentiDe,
  onRessenti,
  douleur,
  onBasculerDouleur,
  manquants,
  cellule,
  onCellule,
}: Pick<
  ListeProgrammeProps,
  'colonnes' | 'unitePoids' | 'saisies' | 'charges' | 'onCharge' | 'ressentiDe' | 'onRessenti' | 'douleur' | 'onBasculerDouleur'
> & {
  bloc: BlocSeries;
  exercice: Exercice;
  /** Fini sur « Exercice terminé » : les cases disent ce qui est noté. */
  fait: boolean;
  avecCharge: boolean;
  manquants: readonly VisageManquant[];
  cellule: Cellule | null;
  onCellule: (cellule: Cellule) => void;
}) {
  const lignes = Math.max(...colonnes.map((colonne) => volumeDeColonne(bloc, colonne.qui).series));
  const numeros = Array.from({ length: lignes }, (_, i) => i + 1);
  const grille = { gridTemplateColumns: `2.25rem repeat(${colonnes.length}, minmax(0, 1fr))` };
  const disques = avecCharge ? libelleDisques(exercice) : null;
  // Les visages du ressenti : sur la dernière série de chacun. Rien sur un
  // exercice sans charge — il n'y a rien à monter.
  const visagesSur = (colonne: ColonneDuo, serie: number) =>
    avecCharge && ressentiSurLaSerie(serie, volumeDeColonne(bloc, colonne.qui).series);
  const avecVisages = numeros.some((serie) => colonnes.some((colonne) => visagesSur(colonne, serie)));
  const manque = (qui: QuiColonne) => manquants.some((m) => m.qui === qui && m.exerciceId === exercice.id);
  return (
    <div className="space-y-1" role="group" aria-label={`Séries : ${exercice.nomFr}`}>
      {colonnes.length > 1 || avecCharge ? (
        <div className="grid items-end gap-2 text-xs font-bold" style={{ ...grille, color: 'var(--texte-discret)' }}>
          <span />
          {colonnes.map((colonne) => (
            <span key={colonne.qui} className="truncate text-center">
              {colonnes.length > 1 ? nomColonne(colonne) : `Charge (${SUFFIXE_UNITE[unitePoids]})`}
            </span>
          ))}
        </div>
      ) : null}
      {/* « J'ai mal » : un par personne, la douleur de l'un ne touche pas l'autre. */}
      {onBasculerDouleur && (
        <div className="grid items-center gap-2" style={grille}>
          <span />
          {colonnes.map((colonne) => (
            <BoutonDouleurCompact
              key={colonne.qui}
              actif={douleur(colonne.qui, exercice.id)}
              avecCharge={avecCharge}
              nom={nomColonne(colonne)}
              onBasculer={() => onBasculerDouleur(colonne.qui, exercice.id)}
            />
          ))}
        </div>
      )}
      {numeros.map((serie) => {
        const celluleIci = avecCharge && cellule?.exerciceId === exercice.id && cellule.serie === serie ? cellule : null;
        return (
          <div key={serie} className="space-y-1">
            <div className="grid items-center gap-2" style={grille}>
              <span className="chiffres text-sm font-semibold" style={{ color: 'var(--texte-discret)' }}>
                S{serie}
              </span>
              {colonnes.map((colonne) => {
                const { series, reps } = volumeDeColonne(bloc, colonne.qui);
                if (serie > series) {
                  return (
                    <span key={colonne.qui} className="text-center" style={{ color: 'var(--texte-discret)' }}>
                      —
                    </span>
                  );
                }
                if (!avecCharge) {
                  return (
                    <span
                      key={colonne.qui}
                      className="chiffres flex h-11 items-center justify-center rounded-xl text-base font-semibold"
                      style={{
                        background: 'var(--surface)',
                        color: fait ? 'var(--montee)' : 'var(--texte-discret)',
                        border: '2px solid var(--bordure)',
                      }}
                    >
                      {fait ? '✓' : cibleSansCharge(exercice, reps)}
                    </span>
                  );
                }
                return (
                  <CaseCharge
                    key={colonne.qui}
                    valeur={saisies(colonne.qui, exercice.id)[serie - 1] ?? 0}
                    // Fini : la case dit ce qui est noté, rien d'autre.
                    proposee={fait ? 0 : charges(colonne.qui, exercice.id, serie).proposee}
                    unitePoids={unitePoids}
                    choisie={celluleIci?.qui === colonne.qui}
                    libelle={`Charge de ${nomColonne(colonne)}, série ${serie} (${SUFFIXE_UNITE[unitePoids]})`}
                    onChoisir={() => onCellule({ qui: colonne.qui, exerciceId: exercice.id, serie })}
                    onCharge={(charge) => onCharge(colonne.qui, exercice.id, serie, charge)}
                  />
                );
              })}
            </div>
            {/* Sous la case touchée : ce qu'on a vraiment fait, d'un toucher. */}
            {celluleIci && (
              <div className="grid gap-2" style={grille}>
                <span />
                {colonnes.map((colonne) =>
                  colonne.qui === celluleIci.qui ? (
                    <Raccourcis
                      key={colonne.qui}
                      charges={charges(colonne.qui, exercice.id, serie)}
                      saisie={saisies(colonne.qui, exercice.id)[serie - 1] ?? 0}
                      unitePoids={unitePoids}
                      parCote={exercice.chargeParCote === true}
                      onChoisir={(charge, allegee) => onCharge(colonne.qui, exercice.id, serie, charge, allegee)}
                    />
                  ) : (
                    <span key={colonne.qui} />
                  ),
                )}
              </div>
            )}
            {/* Sur la dernière série de chacun : facile, correct ou difficile ? */}
            {colonnes.some((colonne) => visagesSur(colonne, serie)) && (
              <div className="grid gap-2" style={grille}>
                <span />
                {colonnes.map((colonne) =>
                  visagesSur(colonne, serie) ? (
                    <div
                      key={colonne.qui}
                      id={idVisages(colonne.qui, exercice.id)}
                      className="scroll-mt-24 rounded-xl"
                      style={manque(colonne.qui) ? { outline: '2px solid var(--alerte)', outlineOffset: 2 } : undefined}
                    >
                      <VisagesRessenti
                        compact
                        choisi={ressentiDe(colonne.qui, exercice.id)}
                        nom={`${nomColonne(colonne)}, ${exercice.nomFr}`}
                        onChoisir={(ressenti) => onRessenti(colonne.qui, exercice.id, ressenti)}
                      />
                    </div>
                  ) : (
                    <span key={colonne.qui} />
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
      {avecVisages && (
        <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
          {AIDE_RESSENTI} {LEGENDE_VISAGES}.
        </p>
      )}
      {disques && (
        <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
          {disques.charAt(0).toUpperCase() + disques.slice(1)}.
        </p>
      )}
    </div>
  );
}

/** Le nombre d'un texte tapé : « 12, » vaut 12 ; rien de lisible, 0. */
function chargeTapee(texte: string): number {
  const charge = Number.parseFloat(texte.replace(',', '.'));
  return Number.isFinite(charge) && charge > 0 ? charge : 0;
}

/** La case de la charge d'une série : pré-remplie, on ne tape que si elle
 *  change. Le texte tapé reste tel quel pendant la saisie (« 12, » ne doit
 *  pas devenir « 12 » à chaque frappe) ; seule la valeur remonte. La toucher
 *  montre ses raccourcis 70 % et 100 % ; si la charge change d'ailleurs — un
 *  raccourci, « J'ai mal » — pendant qu'elle est touchée, elle la suit. */
function CaseCharge({
  valeur,
  proposee,
  unitePoids,
  choisie,
  libelle,
  onChoisir,
  onCharge,
}: {
  /** La charge notée ; 0 : pas encore. */
  valeur: number;
  /** Celle qu'on propose tant qu'on n'a rien noté ; 0 pour un exercice fini :
   *  la case dit alors ce qui est enregistré. */
  proposee: number;
  unitePoids: UnitePoids;
  /** La case touchée en dernier : ses raccourcis sont dessous. */
  choisie: boolean;
  libelle: string;
  onChoisir: () => void;
  onCharge: (charge: number | null) => void;
}) {
  const [texte, setTexte] = useState<string | null>(null);
  const notee = valeur > 0 ? String(valeur) : proposee > 0 ? String(proposee) : '';
  // Le texte tapé, tant qu'il dit la charge notée ; sinon, la charge.
  const affiche = texte !== null && chargeTapee(texte) === valeur ? texte : notee;
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step={unitePoids === 'lb' ? '1' : '0.5'}
      placeholder="—"
      aria-label={libelle}
      value={affiche}
      onFocus={(evenement) => {
        setTexte(notee);
        evenement.target.select();
        onChoisir();
      }}
      onChange={(evenement) => {
        setTexte(evenement.target.value);
        const charge = Number.parseFloat(evenement.target.value.replace(',', '.'));
        onCharge(Number.isFinite(charge) ? charge : null);
      }}
      onBlur={() => setTexte(null)}
      className="chiffres h-11 w-full min-w-0 rounded-xl border-2 text-center text-xl"
      style={{
        background: 'var(--surface)',
        color: 'var(--texte)',
        fontWeight: valeur > 0 ? 700 : 400,
        borderColor: choisie ? 'var(--montee)' : 'var(--bordure)',
      }}
    />
  );
}

/** 70 % et 100 % de la charge de travail, d'un toucher, et ce qu'on met de
 *  chaque côté quand la barre se charge des deux côtés. */
function Raccourcis({
  charges,
  saisie,
  unitePoids,
  parCote,
  onChoisir,
}: {
  charges: ChargesSerie;
  saisie: number;
  unitePoids: UnitePoids;
  parCote: boolean;
  /** `allegee` : le 70 % — la série ne dira pas la charge de travail. */
  onChoisir: (charge: number, allegee: boolean) => void;
}) {
  const { pleine, allegee, proposee } = charges;
  const choix = pleine > 0 ? (allegee < pleine ? [['70 %', allegee] as const, ['100 %', pleine] as const] : [['100 %', pleine] as const]) : [];
  const affichee = saisie > 0 ? saisie : proposee;
  return (
    <div className="space-y-1">
      {choix.length > 0 && (
        <div role="group" aria-label="Charge faite" className="grid grid-cols-2 gap-1">
          {choix.map(([part, charge]) => {
            const choisie = affichee === charge;
            return (
              <button
                key={part}
                type="button"
                aria-pressed={choisie}
                onClick={() => {
                  // Un raccourci finit la saisie : le clavier se range.
                  if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
                  onChoisir(charge, part === '70 %');
                }}
                className={`${BOUTON_COMMUN} chiffres min-h-10 rounded-lg px-1 text-xs leading-tight`}
                style={choisie ? STYLES_BOUTON.accent : STYLES_BOUTON.neutre}
              >
                {part}
                <br />
                {charge}
              </button>
            );
          })}
        </div>
      )}
      {parCote && affichee > 0 && (
        <p className="chiffres text-center text-xs font-semibold">{libelleParCote(affichee, unitePoids).replace('soit ', '')}</p>
      )}
    </div>
  );
}

/** Aux étirements, pour le dernier exercice : facile, correct ou difficile,
 *  pour chacun — s'il ne l'a pas dit sur sa dernière série. Un toucher,
 *  facultatif. */
function RessentiDesColonnes({
  exerciceId,
  nom,
  colonnes,
  ressentiDe,
  onRessenti,
}: {
  exerciceId: string;
  nom: string;
  colonnes: ColonneDuo[];
  ressentiDe: ListeProgrammeProps['ressentiDe'];
  onRessenti: ListeProgrammeProps['onRessenti'];
}) {
  return (
    <section
      aria-label={`Ressenti sur la dernière série : ${nom}`}
      className="space-y-2 rounded-xl p-2 text-left"
      style={{ background: 'var(--surface)' }}
    >
      <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--texte-discret)' }}>
        {nom} · la dernière série ? <span className="font-normal normal-case tracking-normal">(facultatif)</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
        {AIDE_RESSENTI} {LEGENDE_VISAGES}.
      </p>
      {colonnes.map((colonne) => (
        <div key={colonne.qui} className="flex items-center gap-2">
          {colonnes.length > 1 && <span className="w-16 shrink-0 text-sm font-bold">{nomColonne(colonne)}</span>}
          <div className="min-w-0 flex-1">
            <VisagesRessenti
              compact
              choisi={ressentiDe(colonne.qui, exerciceId)}
              nom={`${nomColonne(colonne)}, ${nom}`}
              onChoisir={(ressenti) => onRessenti(colonne.qui, exerciceId, ressenti)}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

/** Ce que l'autre a fait sur un exercice, noté sur ce téléphone : « Big Max :
 *  3 / 3 · 40 · 45 · 45 lb · léger ». */
function LigneDeLAutre({ realisee, exerciceId }: { realisee: SeanceRealisee; exerciceId: string }) {
  const sien = realisee.partenaire;
  const exo = sien?.exercices.find((e) => e.exerciceId === exerciceId);
  if (!sien || !exo) return null;
  const charges = libellePoidsParSerie(exo, uniteDeSeance(realisee.parametres));
  return (
    <span className="chiffres block text-xs font-normal" style={{ color: 'var(--texte-discret)' }}>
      {NOM_PERSONNE[sien.personne]} : {exo.seriesFaites} / {exo.seriesPrevues}
      {charges ? ` · ${charges}` : ''}
      {exo.ressenti ? ` · ${motRessenti(exo.ressenti)}` : ''}
    </span>
  );
}

// ------------------------------------------------------------- Questions

/** Un choix d'une question. 'danger' : ce qui efface. */
interface ChoixDialogue {
  libelle: string;
  /** Une ligne d'explication, sous le libellé. */
  detail?: string;
  variante: VarianteBouton | 'danger';
  action: () => void;
}

interface DialogueOuvert {
  titre: string;
  texte?: string;
  choix: ChoixDialogue[];
  /** Fermée sans choisir (toucher à côté). */
  onFermer?: () => void;
}

const STYLE_DANGER: CSSProperties = {
  background: 'transparent',
  color: 'var(--alerte)',
  border: '2px solid var(--alerte)',
};

/** Une question dans l'application, posée en bas de l'écran, sous le pouce :
 *  pas de boîte du navigateur. Toucher à côté revient à renoncer. */
function Dialogue({ dialogue, onFermer }: { dialogue: DialogueOuvert; onFermer: (choix?: ChoixDialogue) => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
      onClick={() => onFermer()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogue-titre"
        className="w-full max-w-md space-y-3 rounded-t-3xl px-4 pt-5"
        style={{
          background: 'var(--surface)',
          color: 'var(--texte)',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        onClick={(evenement) => evenement.stopPropagation()}
      >
        <h2 id="dialogue-titre" className="text-xl font-bold">
          {dialogue.titre}
        </h2>
        {dialogue.texte && <p style={{ color: 'var(--texte-discret)' }}>{dialogue.texte}</p>}
        {dialogue.choix.map((choix) => (
          <button
            key={choix.libelle}
            type="button"
            onClick={() => onFermer(choix)}
            className={`${BOUTON_COMMUN} block min-h-14 w-full rounded-2xl px-4 py-2 text-left`}
            style={choix.variante === 'danger' ? STYLE_DANGER : STYLES_BOUTON[choix.variante]}
          >
            <span className="block text-lg">{choix.libelle}</span>
            {choix.detail && <span className="block text-sm font-normal opacity-80">{choix.detail}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
