// La routine du soir, guidée plein écran : pour chaque étirement, on s'installe
// (l'image, la consigne), puis on tient — d'un côté, « Change de côté », de
// l'autre — avec le décompte en grand et une cloche douce à chaque départ. Pause,
// Précédent, Suivant, Quitter. Seul sur son téléphone : pas d'horloge commune,
// pas de serveur, tout se passe ici.
//
// Habillage : les jetons de couleur de `index.css`, comme la séance guidée. Les
// maintiens sont dans le bleu calme du repos, pas dans le vert du travail.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Exercice, PartieRoutine, RoutineSoirLocale } from '../types';
import { cheminImage, consignesDe } from '../data/exercices';
import { bellSound } from '../utils/sounds';
import { useMoteurEtapes } from '../hooks/useMoteurEtapes';
import { useVerrouEcran } from '../hooks/useVerrouEcran';
import {
  CONSIGNE_COU,
  CONSIGNE_GAINAGE,
  NOTE_DESSIN_CHIEN_D_ARRET,
  PROLONGATION_SEC,
  ROLE_MOBILITE,
  etapesRoutine,
  exerciceRoutine,
  indexPrecedent,
  libelleTenue,
  resumeRoutine,
} from '../utils/routineSoir';
import type { EtapeRoutine, PartiesRoutine } from '../utils/routineSoir';
import { BilanSoirs, PointsSemaine } from './CarteRoutineSoir';

/** Une fin d'étape détectée avec au plus ce retard est datée à l'instant
 *  prévu (pas de dérive) ; au-delà (onglet en arrière-plan), l'étape suivante
 *  démarre à l'instant présent. */
const TOLERANCE_FIN_MS = 1000;
/** Les dernières secondes d'un compte à rebours passent en rouge, avec un bip. */
const SECONDES_ALERTE = 3;

// ------------------------------------------------------------- Habillage

const ARCHIVO: CSSProperties = { fontFamily: "'Archivo', sans-serif" };

type VarianteBouton = 'accent' | 'montee' | 'pause' | 'neutre';

const STYLES_BOUTON: Record<VarianteBouton, CSSProperties> = {
  accent: { background: 'var(--accent)', color: 'var(--accent-texte)' },
  montee: { background: 'var(--montee)', color: 'var(--fond)' },
  pause: { background: 'var(--pause)', color: 'var(--accent-texte)' },
  neutre: { background: 'var(--surface-haute)', color: 'var(--texte)' },
};

type TailleBouton = 'petit' | 'etroit' | 'grand';

/** `petit` est la cible tactile minimale (44 px), les autres sont les commandes
 *  de la routine (56 px), que le pouce trouve sans regarder. */
const CLASSES_TAILLE: Record<TailleBouton, string> = {
  petit: 'min-h-11 rounded-xl px-4 text-sm',
  etroit: 'min-h-14 rounded-2xl px-2 text-base',
  grand: 'min-h-14 rounded-2xl px-4 text-lg',
};

function Bouton({
  variante,
  onClick,
  children,
  taille = 'grand',
  className = '',
  disabled,
}: {
  variante: VarianteBouton;
  onClick: () => void;
  children: ReactNode;
  taille?: TailleBouton;
  /** Mise en page seulement (largeur, flex). */
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`touch-manipulation font-semibold transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 ${CLASSES_TAILLE[taille]} ${className}`}
      style={STYLES_BOUTON[variante]}
    >
      {children}
    </button>
  );
}

/** Les dessins sont noirs sur fond blanc : sur le thème sombre il leur faut
 *  toujours une plaque blanche. */
function Vignette({ exerciceId, alt, className = '' }: { exerciceId: string; alt: string; className?: string }) {
  return (
    <img
      src={cheminImage(exerciceId)}
      alt={alt}
      className={`object-contain ${className}`}
      style={{ background: '#ffffff', aspectRatio: '3 / 2' }}
    />
  );
}

/** « 4:05 » */
function formaterMmSs(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const couleurCompte = (resteSec: number, normale: string): string =>
  resteSec <= SECONDES_ALERTE ? 'var(--alerte)' : normale;


// ------------------------------------------------------------- Les étapes à l'écran

/** Le nom d'une partie, dans l'en-tête : « Gainage 1 / 3 ». */
const NOM_COURT_PARTIE: Record<PartieRoutine, string> = {
  gainage: 'Gainage',
  mobilite: 'Mobilité',
  cou: 'Cou',
  etirements: 'Étirement',
};

/** Le nom de la phase et sa couleur d'ambiance. */
function phaseDe(etape: EtapeRoutine): { libelle: string; couleur: string; fond: string } {
  switch (etape.type) {
    case 'installation':
      return { libelle: 'Installez-vous', couleur: 'var(--accent)', fond: 'var(--fond)' };
    case 'tenue':
      return {
        libelle: etape.cote ? `Côté ${etape.cote}` : 'Tenez la position',
        couleur: 'var(--descente)',
        fond: 'var(--descente-fond)',
      };
    case 'changement':
      return { libelle: 'Changez de côté', couleur: 'var(--accent)', fond: 'var(--fond)' };
    case 'fin':
      return { libelle: 'Terminé', couleur: 'var(--montee)', fond: 'var(--fond)' };
  }
}

function Consignes({ exercice }: { exercice: Exercice }) {
  return (
    <ul className="list-disc space-y-1 pl-5" style={{ color: 'var(--texte-discret)' }}>
      {consignesDe(exercice).map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  );
}

/** Ce que dit la partie en tête de ses écrans : au gainage, « Tenues courtes,
 *  dos neutre… » ; au cou, « Tout en douceur… ». Rien pour les autres. */
function MotDePartie({ partie }: { partie: PartieRoutine }) {
  const mot = partie === 'gainage' ? CONSIGNE_GAINAGE : partie === 'cou' ? CONSIGNE_COU : null;
  if (!mot) return null;
  return (
    <p
      className="rounded-2xl px-4 py-2 text-center text-sm font-semibold"
      style={{ background: 'var(--surface)', color: 'var(--pause)' }}
    >
      {mot}
    </p>
  );
}

/** Ce que remplace un mouvement de la mobilité (le 90/90, le « livre ouvert »),
 *  quand la bibliothèque n'a pas le vrai. */
function RoleMobilite({ exercice, partie }: { exercice: Exercice; partie: PartieRoutine }) {
  const role = partie === 'mobilite' ? ROLE_MOBILITE[exercice.id] : undefined;
  if (!role) return null;
  return (
    <p className="text-center text-sm font-semibold" style={{ color: 'var(--accent)' }}>
      {role}
    </p>
  );
}

/** Le dessin du chien d'arrêt vient d'un autre exercice : on le dit. */
function NoteDessin({ exercice }: { exercice: Exercice }) {
  if (exercice.id !== 'bird-dog-row') return null;
  return (
    <p className="text-center text-xs" style={{ color: 'var(--texte-discret)' }}>
      {NOTE_DESSIN_CHIEN_D_ARRET}
    </p>
  );
}

function CorpsInstallation({
  etape,
  exercice,
  resteSec,
  onPret,
}: {
  etape: Extract<EtapeRoutine, { type: 'installation' }>;
  exercice: Exercice;
  resteSec: number;
  onPret: () => void;
}) {
  return (
    <div className="space-y-4">
      <MotDePartie partie={etape.partie} />
      <Vignette exerciceId={exercice.id} alt={exercice.nomFr} className="mx-auto w-full max-w-md rounded-2xl" />
      <NoteDessin exercice={exercice} />
      <div className="text-center">
        <h2 className="text-2xl font-bold">{exercice.nomFr}</h2>
        <p style={{ color: 'var(--texte-discret)' }}>
          {etape.rang} / {etape.total} · {libelleTenue(exercice, etape.partie)}
        </p>
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          {exercice.position}
        </p>
      </div>
      <RoleMobilite exercice={exercice} partie={etape.partie} />
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
          Installez-vous
        </div>
        <div className="chiffres text-8xl font-bold leading-none" style={{ color: couleurCompte(resteSec, 'var(--texte)') }}>
          {Math.ceil(resteSec)}
        </div>
      </div>
      <Consignes exercice={exercice} />
      <Bouton variante="accent" onClick={onPret} className="w-full">
        Je suis prêt
      </Bouton>
    </div>
  );
}

function CorpsTenue({
  etape,
  exercice,
  resteSec,
  suivant,
}: {
  etape: Extract<EtapeRoutine, { type: 'tenue' }>;
  exercice: Exercice;
  resteSec: number;
  /** L'exercice qui vient après celui-ci ; absent pour le dernier. */
  suivant?: Exercice;
}) {
  // La dernière tenue d'un exercice annonce le suivant : on peut s'y préparer.
  const derniere = etape.cote !== 'droit';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Vignette exerciceId={exercice.id} alt="" className="w-28 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight">{exercice.nomFr}</h2>
          <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
            {etape.rang} / {etape.total} · {libelleTenue(exercice, etape.partie)}
          </p>
        </div>
      </div>
      <div className="select-none py-2 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--descente)' }}>
          {etape.cote ? `Côté ${etape.cote}` : 'Tenez la position'}
        </div>
        <div
          className="chiffres text-9xl font-bold leading-none"
          style={{ color: couleurCompte(resteSec, 'var(--descente)') }}
        >
          {Math.ceil(resteSec)}
        </div>
        <div className="mt-3 text-sm" style={{ color: 'var(--texte-discret)' }}>
          {etape.cote === 'droit' ? 'secondes, puis on change de côté' : 'secondes restantes'}
        </div>
      </div>
      <RoleMobilite exercice={exercice} partie={etape.partie} />
      {etape.partie === 'gainage' || etape.partie === 'cou' ? (
        <MotDePartie partie={etape.partie} />
      ) : (
        <p className="text-center text-sm font-semibold" style={{ color: 'var(--texte-discret)' }}>
          Respirez lentement, en douceur. Jamais jusqu’à la douleur.
        </p>
      )}
      <Consignes exercice={exercice} />
      {derniere && (
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          {suivant ? `Ensuite : ${suivant.nomFr}` : 'Dernier exercice.'}
        </p>
      )}
    </div>
  );
}

/** Entre le côté droit et le côté gauche : comme à la séance guidée, 5 s pour
 *  se tourner, se replacer, et « +5 s » quand il en faut plus. */
function CorpsChangement({
  exercice,
  resteSec,
  onProlonger,
}: {
  exercice: Exercice;
  resteSec: number;
  onProlonger: () => void;
}) {
  const secondes = Math.ceil(resteSec);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Vignette exerciceId={exercice.id} alt="" className="w-28 shrink-0 rounded-xl" />
        <h2 className="min-w-0 text-xl font-bold leading-tight">{exercice.nomFr}</h2>
      </div>
      <div className="select-none space-y-3 py-2 text-center">
        <div className="text-4xl font-extrabold tracking-[0.08em]" style={{ ...ARCHIVO, color: 'var(--accent)' }}>
          CHANGE DE CÔTÉ
        </div>
        <div className="chiffres text-9xl font-bold leading-none" style={{ color: couleurCompte(resteSec, 'var(--texte)') }}>
          {secondes}
        </div>
        <div className="text-xl font-medium">
          Côté gauche dans <span className="chiffres">{secondes}</span> s
        </div>
        <Bouton variante="neutre" onClick={onProlonger}>
          +{PROLONGATION_SEC} s
        </Bouton>
      </div>
    </div>
  );
}

function CorpsFin({
  resume,
  routine,
  maintenant,
  onTerminer,
}: {
  /** Ce que contenait la routine : « Gainage, mobilité et 3 étirements ». */
  resume: string;
  routine: RoutineSoirLocale | undefined;
  maintenant: Date;
  onTerminer: () => void;
}) {
  return (
    <div className="space-y-5 py-6 text-center">
      <h2 className="text-3xl font-bold" style={{ ...ARCHIVO, color: 'var(--montee)' }}>
        Faite ce soir ✓
      </h2>
      <p style={{ color: 'var(--texte-discret)' }}>{resume} : c’est fait. Bonne nuit.</p>
      <div className="flex flex-col items-center gap-2 rounded-2xl p-4" style={{ background: 'var(--surface)' }}>
        <PointsSemaine routine={routine} maintenant={maintenant} />
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          <BilanSoirs routine={routine} maintenant={maintenant} />
        </p>
      </div>
      <Bouton variante="montee" onClick={onTerminer} className="w-full">
        Terminer
      </Bouton>
    </div>
  );
}

// ------------------------------------------------------------- Le composant

export default function RoutineGuidee({
  parties,
  routine,
  onFaite,
  onQuitter,
}: {
  /** Ce que contient la routine de ce soir : les exercices de chaque partie
   *  allumée, dans l'ordre. */
  parties: PartiesRoutine;
  /** Ce que garde le téléphone : pour les points de l'écran de fin. */
  routine: RoutineSoirLocale | undefined;
  /** La routine est allée jusqu'au bout : à marquer comme faite ce soir. */
  onFaite: () => void;
  onQuitter: () => void;
}) {
  // La routine est figée à l'ouverture : l'écran de la liste est caché derrière.
  const [etapes] = useState(() => etapesRoutine(parties));
  const resume = useMemo(() => resumeRoutine(parties), [parties]);
  const debuts = useMemo(() => {
    let cumul = 0;
    return etapes.map((etape) => {
      const debut = cumul;
      cumul += etape.dureeSec;
      return debut;
    });
  }, [etapes]);
  const dureeTotale = debuts[debuts.length - 1] ?? 0;
  const moteur = useMoteurEtapes(etapes.length);
  const { etat, maintenant, ecouleSec: ecoule, allerA, demarrer } = moteur;
  const enPause = etat?.enPause ?? false;
  const index = etat ? Math.min(etat.index, etapes.length - 1) : 0;
  const etape = etapes[index];
  const estFin = etape.type === 'fin';
  const prolongation = etat?.prolongationSec ?? 0;
  const dureeEff = etape.dureeSec + prolongation;
  const reste = Math.max(0, dureeEff - ecoule);
  const tempsEcoule = Math.min(dureeTotale, (debuts[index] ?? 0) + Math.min(Math.max(0, ecoule), etape.dureeSec));
  const { demander: garderEcranAllume } = useVerrouEcran(etat !== null && !estFin);

  // Le défilement de la page est bloqué derrière l'écran plein écran ; c'est le
  // conteneur qui défile, remis en haut à chaque étape.
  const conteneurRef = useRef<HTMLDivElement>(null);
  const visite = etat?.visite;
  useEffect(() => {
    if (visite === undefined) return;
    conteneurRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [visite]);
  useEffect(() => {
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = precedent;
    };
  }, []);

  // Départ dès l'ouverture : l'appui sur « Commencer » a déjà réveillé le son.
  const departFaitRef = useRef(false);
  useEffect(() => {
    if (departFaitRef.current) return;
    departFaitRef.current = true;
    void garderEcranAllume();
    demarrer(0, []);
  }, [demarrer, garderEcranAllume]);

  const naviguer = useCallback(
    (cible: number, now?: number) => {
      // iOS suspend le contexte audio quand l'écran se verrouille : chaque
      // geste est l'occasion de le réveiller.
      bellSound.unlock();
      allerA(cible, now);
    },
    [allerA],
  );

  // Les sons, une seule fois par événement : la clé commence par le numéro de
  // visite de l'étape.
  const evenementsRef = useRef({ visite: 0, compteARebours: '', avance: 0 });
  useEffect(() => {
    if (!etat || etat.enPause) return;
    const ev = evenementsRef.current;
    if (ev.visite !== etat.visite) {
      ev.visite = etat.visite;
      // Une cloche douce à chaque départ de maintien, trois à la fin ; un bip
      // pour changer de côté. Rien à l'installation.
      if (etape.type === 'tenue') bellSound.playSoftBell();
      else if (etape.type === 'changement') bellSound.playTick('pret');
      else if (etape.type === 'fin') bellSound.playSoftBell(3);
    }
    // Trois derniers bips d'une installation ou d'un changement de côté.
    if (etape.type === 'installation' || etape.type === 'changement') {
      const secondes = Math.ceil(reste);
      if (secondes >= 1 && secondes <= SECONDES_ALERTE) {
        const cle = `${etat.visite}:${prolongation}:${secondes}`;
        if (ev.compteARebours !== cle) {
          ev.compteARebours = cle;
          bellSound.playTick('pret');
        }
      }
    }
    // Fin de l'étape : passage automatique à la suivante.
    if (etape.type !== 'fin' && ecoule >= dureeEff && ev.avance !== etat.visite) {
      ev.avance = etat.visite;
      const finPrevueMs = etat.debutEtapeMs + dureeEff * 1000;
      naviguer(index + 1, maintenant - finPrevueMs <= TOLERANCE_FIN_MS ? finPrevueMs : maintenant);
    }
  }, [etat, etape, reste, prolongation, ecoule, dureeEff, maintenant, index, naviguer]);

  // Arrivée à la fin : la routine est faite pour ce soir, une seule fois.
  const faiteRef = useRef(false);
  useEffect(() => {
    if (!estFin || faiteRef.current) return;
    faiteRef.current = true;
    onFaite();
  }, [estFin, onFaite]);

  // ------------------------------------------------ Actions

  const basculerPause = () => {
    bellSound.unlock();
    if (enPause) moteur.reprendre();
    else moteur.pause();
  };
  const precedent = () => naviguer(indexPrecedent(etapes, index));
  const suivant = () => naviguer(index + 1);
  const quitter = () => {
    if (estFin || !etat) {
      onQuitter();
      return;
    }
    // Le dialogue bloque le rendu, pas l'horloge : pause le temps de la
    // question, puis on reprend si l'on renonce à quitter.
    if (!enPause) moteur.pause();
    if (!window.confirm('Quitter la routine du soir ?')) {
      if (!enPause) moteur.reprendre();
      return;
    }
    onQuitter();
  };

  // ------------------------------------------------ Rendu

  if (!etat) {
    // Le fond de l'écran, le temps d'un rendu.
    return <div className="fixed inset-0 z-50" style={{ background: 'var(--fond)' }} />;
  }

  const phase = phaseDe(etape);
  const exercice = etape.type === 'fin' ? null : exerciceRoutine(etape.exerciceId);
  // L'étirement qui vient ensuite : la prochaine installation.
  const prochaine = etapes.slice(index + 1).find((e) => e.type === 'installation');
  const exerciceSuivant = prochaine && prochaine.type === 'installation' ? exerciceRoutine(prochaine.exerciceId) : undefined;

  let corps: ReactNode = null;
  if (etape.type === 'fin') {
    corps = <CorpsFin resume={resume} routine={routine} maintenant={new Date()} onTerminer={onQuitter} />;
  } else if (exercice) {
    if (etape.type === 'installation') {
      corps = <CorpsInstallation etape={etape} exercice={exercice} resteSec={reste} onPret={suivant} />;
    } else if (etape.type === 'tenue') {
      corps = <CorpsTenue etape={etape} exercice={exercice} resteSec={reste} suivant={exerciceSuivant} />;
    } else {
      corps = <CorpsChangement exercice={exercice} resteSec={reste} onProlonger={() => moteur.prolonger(PROLONGATION_SEC)} />;
    }
  }

  const rempli = dureeTotale > 0 ? Math.min(100, Math.max(0, (tempsEcoule / dureeTotale) * 100)) : 100;
  const position = etape.type === 'fin' ? '' : `${NOM_COURT_PARTIE[etape.partie]} ${etape.rang} / ${etape.total}`;

  return (
    <div
      ref={conteneurRef}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto transition-colors duration-500"
      style={{ background: phase.fond, color: 'var(--texte)' }}
    >
      <header className="sticky top-0 z-10" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bordure)' }}>
        <div className="h-1 w-full" style={{ background: 'var(--bordure)' }}>
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${rempli.toFixed(1)}%`, background: phase.couleur }}
          />
        </div>
        <div className="mx-auto max-w-md px-4 pb-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: phase.couleur }}>
                {phase.libelle}
              </div>
              <div className="truncate font-semibold" style={ARCHIVO}>
                {exercice?.nomFr ?? 'Bravo'}
              </div>
              {position && (
                <div className="truncate text-xs" style={{ color: 'var(--texte-discret)' }}>
                  {position}
                </div>
              )}
            </div>
            <Bouton variante="neutre" taille="petit" onClick={quitter} className="shrink-0">
              Quitter
            </Bouton>
          </div>
          <div className="chiffres mt-1 flex justify-between text-sm" style={{ color: 'var(--texte-discret)' }}>
            <span>Écoulé {formaterMmSs(tempsEcoule)}</span>
            <span>Reste ~ {formaterMmSs(dureeTotale - tempsEcoule)}</span>
          </div>
        </div>
      </header>
      {enPause && (
        <div className="py-2 text-center font-semibold" style={{ background: 'var(--pause)', color: 'var(--accent-texte)' }}>
          En pause · le chrono est arrêté
        </div>
      )}
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">{corps}</main>
      {!estFin && (
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
            <Bouton variante="pause" onClick={basculerPause} className="flex-[1.5]">
              {enPause ? 'Reprendre' : 'Pause'}
            </Bouton>
            <Bouton variante="neutre" taille="etroit" onClick={suivant} className="flex-1">
              Suivant
            </Bouton>
          </div>
        </footer>
      )}
    </div>
  );
}
