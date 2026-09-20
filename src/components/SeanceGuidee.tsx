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
  Exercice,
  GuideVisuel,
  ProgressionSeance,
  Seance,
  SeanceRealisee,
  Tempo,
  UnitePoids,
} from '../types';
import { ECHAUFFEMENT, RETOUR_CALME, cheminImage } from '../data/exercices';
import type { MouvementLibre } from '../data/exercices';
import { bellSound } from '../utils/sounds';
import {
  agregerRealisation,
  construireEtapes,
  dureeRestanteSec,
  dureeTotaleSec,
  etatMetronome,
  exerciceDeSeance,
  indexApresExercice,
  indexEtapePrecedente,
  indexReprise,
  premierePhase,
} from '../utils/etapesSeance';
import type { Etape, EtatMetronome, PhaseTempo, Suivant } from '../utils/etapesSeance';
import { secondesParRep } from '../utils/generateurSeance';
import { SUFFIXE_UNITE, libellePoidsParSerie, uniteDeSeance } from '../utils/statistiques';
import { ajouterTemps, useMoteurEtapes } from '../hooks/useMoteurEtapes';
import { useVerrouEcran } from '../hooks/useVerrouEcran';
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
}

// ------------------------------------------------------------- Réglages

/** Intervalle minimal entre deux sauvegardes de la progression pendant une étape. */
const INTERVALLE_SAUVEGARDE_MS = 10_000;
const PROLONGATION_REPOS_SEC = 15;
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

/** « 8 répétitions par côté », « 40 s » */
function libelleReps(exercice: Exercice, reps: number): string {
  if (exercice.unite === 'secondes') return `${reps} s`;
  const base = pluriel(reps, 'répétition');
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

function libellePhase(etape: Etape): string {
  switch (etape.type) {
    case 'echauffement':
      return 'Échauffement';
    case 'pret':
      return 'Préparation';
    case 'serie':
      return 'Série';
    case 'repos':
      return 'Repos';
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
}: SeanceGuideeProps) {
  // La progression proposée à la reprise est figée à l'ouverture : les
  // sauvegardes que nous envoyons ensuite reviennent dans cette même prop.
  const [progressionInitiale] = useState(progression);
  // Séance réellement déroulée : la prop, ou la séance sauvegardée si reprise.
  const [seanceActive, setSeanceActive] = useState<Seance>(seance);
  // Charges saisies : une valeur par série, index 0 = première série.
  const [poids, setPoids] = useState<Record<string, number[]>>({});
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
  // Les séances enregistrées avant l'arrivée du réglage n'ont pas de guide.
  const guideVisuel: GuideVisuel = seanceActive.parametres.guideVisuel ?? 'les-deux';
  const unitePoids = uniteDeSeance(seanceActive.parametres);

  const moteur = useMoteurEtapes(etapes.length);

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
  const tempsAvecCourante = ajouterTemps(etat?.tempsParEtapeSec ?? [], index, estFin ? 0 : ecoule);
  const tempsTotalEcoule = tempsAvecCourante.reduce((total, t) => total + t, 0);
  const tempsRestant = dureeRestanteSec(etapes, index, ecoule, prolongation);

  const metro = etatMetronome(etape, ecoule, tempo);
  const mouvements: MouvementLibre[] | null =
    etape.type === 'echauffement' ? ECHAUFFEMENT : etape.type === 'retourCalme' ? RETOUR_CALME : null;
  const dureeMouvement = mouvements && dureeEff > 0 ? dureeEff / mouvements.length : 0;
  const indexMouvement =
    mouvements && dureeMouvement > 0
      ? Math.min(mouvements.length - 1, Math.floor(ecoule / dureeMouvement))
      : 0;
  const resteMouvement = Math.max(0, (indexMouvement + 1) * dureeMouvement - ecoule);

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

    // Métronome : un bip au début de chaque montée et de chaque descente. La
    // toute première phase de l'étape ne bipe pas : la cloche vient de sonner.
    if (metro) {
      const cle = `${prefixe}${metro.cycle}:${metro.phase}`;
      if (ev.metronome !== cle) {
        const memeEtape = ev.metronome.startsWith(prefixe);
        ev.metronome = cle;
        if (memeEtape) bellSound.playTick(metro.phase);
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

    // Fin de l'étape : passage automatique à la suivante.
    if (ecoule >= dureeEff && ev.avance !== visite) {
      ev.avance = visite;
      if (etape.type === 'serie' || etape.type === 'station') bellSound.playBell('end');
      const finPrevueMs = etat.debutEtapeMs + dureeEff * 1000;
      const depart = maintenant - finPrevueMs <= TOLERANCE_FIN_MS ? finPrevueMs : maintenant;
      naviguer(index + 1, depart);
    }
  }, [etat, estFin, etape, reste, prolongation, metro, mouvements, indexMouvement, ecoule, dureeEff, maintenant, index, naviguer]);

  // ------------------------------------------------ Sauvegarde

  const onProgressionRef = useRef(onProgression);
  useEffect(() => {
    onProgressionRef.current = onProgression;
  }, [onProgression]);
  /** Vrai dès que la séance est enregistrée ou abandonnée : plus de sauvegarde. */
  const clotureeRef = useRef(false);
  const sauvegardeRef = useRef<{ visite: number; ms: number; poids: Record<string, number[]> | null }>({
    visite: 0,
    ms: 0,
    poids: null,
  });

  useEffect(() => {
    if (!etat || !demarreeLe || clotureeRef.current) return;
    const derniere = sauvegardeRef.current;
    const nouvelleEtape = derniere.visite !== etat.visite;
    const periodique = maintenant - derniere.ms >= INTERVALLE_SAUVEGARDE_MS;
    const poidsModifie = derniere.poids !== poids;
    if (!nouvelleEtape && !periodique && !poidsModifie) return;
    sauvegardeRef.current = { visite: etat.visite, ms: maintenant, poids };
    onProgressionRef.current({
      seance: seanceActive,
      indexEtape: index,
      tempsCumuleSec: Math.round(tempsTotalEcoule),
      tempsParEtapeSec: tempsAvecCourante.map((t) => Math.round(t)),
      poids,
      demarreeLe,
      sauvegardeeLe: new Date(maintenant).toISOString(),
    });
  }, [etat, demarreeLe, maintenant, poids, seanceActive, index, tempsTotalEcoule, tempsAvecCourante]);

  // ------------------------------------------------ Actions

  const demarrerSeance = (
    source: Seance,
    indexDepart: number,
    temps: number[],
    poidsInitial: Record<string, number[]>,
    debut: string,
  ) => {
    // Geste utilisateur : on en profite pour débloquer l'audio et l'écran.
    bellSound.unlock();
    void verrou.demander();
    clotureeRef.current = false;
    setSeanceActive(source);
    setPoids(poidsInitial);
    setDemarreeLe(debut);
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
    );
  };

  const basculerPause = () => {
    bellSound.unlock();
    if (enPause) moteur.reprendre();
    else moteur.pause();
  };
  const precedent = () => naviguer(indexEtapePrecedente(etapes, index));
  const suivant = () => naviguer(index + 1);
  const passerExercice = () => naviguer(indexApresExercice(etapes, index));
  const prolongerRepos = () => moteur.prolonger(PROLONGATION_REPOS_SEC);

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

  const realisation = (terminee: boolean): SeanceRealisee =>
    agregerRealisation(seanceActive, etapes, tempsAvecCourante, poids, tempsTotalEcoule, terminee);

  const enregistrer = () => {
    clotureeRef.current = true;
    onTerminee(realisation(true));
    onProgression(null);
  };

  const abandonner = () => {
    clotureeRef.current = true;
    onProgression(null);
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
    const etaitEnPause = enPause;
    if (!etaitEnPause) moteur.pause();
    if (!window.confirm('Quitter la séance en cours ?')) {
      if (!etaitEnPause) moteur.reprendre();
      return;
    }
    const partielle = realisation(false);
    const faites = partielle.exercices.reduce((total, e) => total + e.seriesFaites, 0);
    if (
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
  let corps: ReactNode;
  switch (etape.type) {
    case 'echauffement':
    case 'retourCalme':
      corps = (
        <CorpsMouvements
          titre={etape.type === 'echauffement' ? 'Échauffement articulaire, sans charge' : 'Étirements doux, sans à-coups'}
          mouvements={mouvements ?? []}
          indexMouvement={indexMouvement}
          resteMouvementSec={resteMouvement}
          resteSec={reste}
        />
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
          resteSec={reste}
          tempo={tempo}
          guideVisuel={guideVisuel}
          lireEcouleSec={lireEcouleSec}
          poidsSeries={poids[etape.exerciceId] ?? []}
          unitePoids={unitePoids}
          onPoids={(serie, charge) => changerPoids(etape.exerciceId, serie, charge)}
          onTerminee={suivant}
          onPasser={passerExercice}
        />
      );
      break;
    case 'repos':
    case 'reposTour':
      corps = (
        <CorpsRepos etape={etape} resteSec={reste} onProlonger={prolongerRepos} onPasser={suivant} />
      );
      break;
    case 'fin':
      corps = <CorpsFin realisee={realisation(true)} onEnregistrer={enregistrer} onAbandonner={abandonner} />;
      break;
  }

  return (
    <div
      ref={conteneurRef}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto transition-colors duration-500"
      style={{ background: ambiance.fond, color: 'var(--texte)' }}
    >
      <EnTete
        phase={libellePhase(etape)}
        position={libellePosition(etapes, index, ordreExercices)}
        exercice={etape.exerciceId ? exerciceDeSeance(etape.exerciceId).nomFr : undefined}
        couleur={ambiance.couleur}
        avancement={dureeTotale > 0 ? tempsTotalEcoule / dureeTotale : 0}
        ecouleSec={tempsTotalEcoule}
        resteSec={tempsRestant}
        onQuitter={quitter}
      />
      {enPause && (
        <div
          className="py-2 text-center font-semibold"
          style={{ background: 'var(--pause)', color: 'var(--accent-texte)' }}
        >
          En pause · le chrono est arrêté
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
          <Bouton variante="neutre" taille="etroit" onClick={precedent} disabled={index === 0} className="flex-1">
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
            <div className={legende} style={{ color: 'var(--texte-discret)' }}>tempo (s)</div>
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
  onQuitter,
}: EnTeteProps) {
  const rempli = Math.min(100, Math.max(0, avancement * 100));
  return (
    <header
      className="sticky top-0 z-10"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bordure)' }}
    >
      <div className="h-1 w-full" style={{ background: 'var(--bordure)' }}>
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${rempli.toFixed(1)}%`, background: couleur }}
        />
      </div>
      <div
        className="mx-auto max-w-md px-4 pb-2"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
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
  mouvements: MouvementLibre[];
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
            Mouvement {indexMouvement + 1} / {mouvements.length} ·{' '}
            <span className="chiffres">{Math.ceil(resteMouvementSec)} s</span>
          </div>
          <div className="mt-1 text-2xl font-bold">{courant.nom}</div>
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
    cible.type === 'serie'
      ? `Série ${cible.serie} / ${cible.series} · ${libelleReps(exercice, cible.reps)}`
      : `Tour ${cible.tour} / ${cible.tours} · Station ${cible.station} / ${cible.stations}`;
  const departDescente = exercice.unite === 'reps' && premierePhase(exercice) === 'descend';

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
          {exercice.unite === 'reps' && ` · départ par la ${departDescente ? 'descente' : 'montée'}`}
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
        {exercice.pointsAttention.map((point) => (
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
  etape: Extract<Etape, { type: 'serie' | 'station' }>;
  exercice: Exercice;
  metro: EtatMetronome | null;
  resteSec: number;
  tempo: Tempo;
  guideVisuel: GuideVisuel;
  /** Horloge de l'étape, lue à chaque image par la bille. */
  lireEcouleSec: () => number;
  /** Charges déjà saisies pour cet exercice, index 0 = première série. */
  poidsSeries: number[];
  unitePoids: UnitePoids;
  onPoids: (serie: number, charge: number | null) => void;
  onTerminee: () => void;
  onPasser: () => void;
}

function CorpsTravail({
  etape,
  exercice,
  metro,
  resteSec,
  tempo,
  guideVisuel,
  lireEcouleSec,
  poidsSeries,
  unitePoids,
  onPoids,
  onTerminee,
  onPasser,
}: CorpsTravailProps) {
  // Numéro de la série en cours : le tour, pour une station de circuit.
  const serieCourante = etape.type === 'serie' ? etape.serie : etape.tour;
  const dejaSaisi = poidsSeries[serieCourante - 1] ?? 0;
  // Sans saisie pour cette série, on reprend la dernière charge connue : au
  // tempo lent on garde presque toujours la même d'une série à l'autre.
  const derniereConnue = poidsSeries
    .slice(0, serieCourante - 1)
    .reduce((dernier, charge) => (charge > 0 ? charge : dernier), 0);
  const valeurDepart = dejaSaisi > 0 ? dejaSaisi : derniereConnue;

  // Le texte saisi est gardé tel quel (« 12, » ne doit pas être réécrit en
  // « 12 » à chaque frappe) ; seule la valeur numérique remonte au parent.
  const [texte, setTexte] = useState(valeurDepart > 0 ? String(valeurDepart) : '');
  const saisirPoids = (evenement: ChangeEvent<HTMLInputElement>) => {
    const valeur = evenement.target.value;
    setTexte(valeur);
    const charge = Number.parseFloat(valeur.replace(',', '.'));
    onPoids(serieCourante, Number.isFinite(charge) ? charge : null);
  };

  // La charge reprise de la série précédente est enregistrée d'office : sans
  // cela, une série faite avec la même charge ressortirait vide du bilan.
  const reprise = dejaSaisi === 0 && derniereConnue > 0 ? derniereConnue : 0;
  useEffect(() => {
    if (reprise > 0) onPoids(serieCourante, reprise);
    // Au montage uniquement : le composant est remonté à chaque étape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sousTitre =
    etape.type === 'serie'
      ? `Série ${etape.serie} / ${etape.series} · ${libelleReps(exercice, etape.reps)}`
      : `Tour ${etape.tour} / ${etape.tours} · Station ${etape.station} / ${etape.stations} · ${etape.dureeSec} s`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Vignette exerciceId={exercice.id} alt="" className="w-28 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight">{exercice.nomFr}</h2>
          <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>{sousTitre}</p>
        </div>
      </div>

      {metro ? (
        <Metronome
          metro={metro}
          exercice={exercice}
          tempo={tempo}
          guideVisuel={guideVisuel}
          lireEcouleSec={lireEcouleSec}
        />
      ) : (
        // Exercice au temps : pas de répétition à rythmer, donc pas de bille,
        // seulement le décompte du maintien.
        <div className="select-none py-2 text-center">
          <div
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: 'var(--texte-discret)' }}
          >
            Maintenez l’effort
          </div>
          <div
            className="chiffres text-9xl font-bold leading-none"
            style={{ color: couleurCompte(resteSec, 'var(--montee)') }}
          >
            {Math.ceil(resteSec)}
          </div>
          <div className="mt-3 text-sm" style={{ color: 'var(--texte-discret)' }}>
            secondes restantes
          </div>
        </div>
      )}

      <details className="rounded-2xl px-4" style={{ background: 'var(--surface)' }}>
        <summary className="cursor-pointer py-3 font-medium">Points d’attention</summary>
        <ul className="list-disc space-y-1 pb-3 pl-5" style={{ color: 'var(--texte-discret)' }}>
          {exercice.pointsAttention.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>

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

      <div className="grid grid-cols-2 gap-3">
        <Bouton variante="accent" taille="etroit" onClick={onTerminee}>
          {etape.type === 'serie' ? 'Série terminée' : 'Station terminée'}
        </Bouton>
        <Bouton variante="neutre" taille="etroit" onClick={onPasser}>
          Passer l’exercice
        </Bouton>
      </div>
    </div>
  );
}

interface MetronomeProps {
  metro: EtatMetronome;
  exercice: Exercice;
  tempo: Tempo;
  guideVisuel: GuideVisuel;
  lireEcouleSec: () => number;
}

/** Le cœur de l'écran pendant une série : le mot de la phase en grand, puis
 *  la bille, le décompte, ou les deux, selon le guide visuel choisi. */
function Metronome({ metro, exercice, tempo, guideVisuel, lireEcouleSec }: MetronomeProps) {
  const monte = metro.phase === 'monte';
  const couleur = monte ? 'var(--montee)' : 'var(--descente)';
  const avecBille = guideVisuel !== 'chiffre';

  // Les trois valeurs dont dépend le placement de la bille, réduites à des
  // nombres : `lire` garde ainsi la même identité d'un rendu à l'autre et la
  // boucle d'animation du paceur n'est pas relancée cinq fois par seconde.
  const parRep = secondesParRep(tempo);
  const premiere = premierePhase(exercice);
  const dureePremiere = premiere === 'monte' ? tempo.monteeSec : tempo.descenteSec;

  /** Position de la bille à l'instant présent. Le calcul est exactement celui
   *  de `etatMetronome`, appliqué à l'horloge de l'étape lue à chaque image :
   *  même découpage en cycles, même première phase, même durée de phase. Les
   *  deux basculent donc au même instant que les bips, qui sortent du même
   *  calcul ; les bips partent seulement au rendu qui suit (au plus 200 ms),
   *  puisqu'ils sont déclenchés par l'état React et non par l'animation. */
  const lire = useCallback((): LectureTempo | null => {
    if (parRep <= 0) return null;
    const ecoule = Math.max(0, lireEcouleSec());
    const dansCycle = ecoule - Math.floor(ecoule / parRep) * parRep;
    const enPremiere = dansCycle < dureePremiere;
    const dureePhase = enPremiere ? dureePremiere : parRep - dureePremiere;
    const ecouleDansPhase = enPremiere ? dansCycle : dansCycle - dureePremiere;
    const seconde: PhaseTempo = premiere === 'monte' ? 'descend' : 'monte';
    return {
      phase: enPremiere ? premiere : seconde,
      progression: dureePhase > 0 ? ecouleDansPhase / dureePhase : 0,
    };
  }, [lireEcouleSec, parRep, premiere, dureePremiere]);

  return (
    <div className="select-none py-2 text-center">
      <div className="text-5xl font-extrabold tracking-[0.12em]" style={{ ...ARCHIVO, color: couleur }}>
        {monte ? 'MONTE' : 'DESCENDS'}
      </div>

      {avecBille ? (
        <div className="mt-3">
          <PaceurTempo
            lire={lire}
            resteSec={metro.resteDansPhaseSec}
            phase={metro.phase}
            avecChiffre={guideVisuel === 'les-deux'}
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
      {exercice.cotes === 'alterne' && (
        <div className="text-lg" style={{ color: 'var(--texte-discret)' }}>
          en alternant
        </div>
      )}
      <div className="chiffres mt-3 text-sm" style={{ color: 'var(--texte-discret)' }}>
        Tempo {tempo.monteeSec} s / {tempo.descenteSec} s · sans rebond
      </div>
    </div>
  );
}

interface CorpsReposProps {
  etape: Extract<Etape, { type: 'repos' | 'reposTour' }>;
  resteSec: number;
  onProlonger: () => void;
  onPasser: () => void;
}

function CorpsRepos({ etape, resteSec, onProlonger, onPasser }: CorpsReposProps) {
  const { suivant } = etape;
  const exerciceSuivant = suivant.type === 'retourCalme' ? null : exerciceDeSeance(suivant.exerciceId);
  return (
    <div className="space-y-4 text-center">
      <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--descente)' }}>
        {etape.type === 'reposTour' ? `Fin du tour ${etape.tour} / ${etape.tours} · repos` : 'Repos'}
      </div>
      <div
        className="chiffres text-8xl font-bold leading-none"
        style={{ color: couleurCompte(resteSec, 'var(--descente)') }}
      >
        {formaterMmSs(Math.ceil(resteSec))}
      </div>
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
          </>
        ) : (
          <div className="text-xl font-bold">Retour au calme</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Bouton variante="neutre" onClick={onProlonger}>
          +{PROLONGATION_REPOS_SEC} s
        </Bouton>
        <Bouton variante="accent" onClick={onPasser}>
          Passer
        </Bouton>
      </div>
    </div>
  );
}

interface CorpsFinProps {
  realisee: SeanceRealisee;
  onEnregistrer: () => void;
  onAbandonner: () => void;
}

function CorpsFin({ realisee, onEnregistrer, onAbandonner }: CorpsFinProps) {
  const seriesFaites = realisee.exercices.reduce((total, e) => total + e.seriesFaites, 0);
  const seriesPrevues = realisee.exercices.reduce((total, e) => total + e.seriesPrevues, 0);
  const cellule = 'px-2 py-2 text-center chiffres';
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Bravo, séance terminée</h2>
        <p className="mt-1" style={{ color: 'var(--texte-discret)' }}>
          Durée réelle <span className="chiffres font-semibold">{formaterMmSs(realisee.dureeReelleSec)}</span> ·
          prévue <span className="chiffres">{formaterMmSs(realisee.dureePrevueSec)}</span>
        </p>
        <p className="chiffres" style={{ color: 'var(--texte-discret)' }}>
          {seriesFaites} / {seriesPrevues} séries faites
        </p>
      </div>

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

      <Bouton variante="montee" onClick={onEnregistrer} className="w-full">
        Enregistrer la séance
      </Bouton>
      <Bouton variante="neutre" onClick={onAbandonner} className="w-full">
        Ne pas enregistrer
      </Bouton>
    </div>
  );
}
