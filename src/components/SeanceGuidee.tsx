// Mode séance guidée : l'application déroule les étapes de la séance, dicte
// le tempo des séries (l'utilisateur suit l'écran et les bips), gère la
// pause, la reprise après rechargement et le temps passé sur chaque exercice.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { Exercice, ProgressionSeance, Seance, SeanceRealisee, Tempo } from '../types';
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
import type { Etape, EtatMetronome, Suivant } from '../utils/etapesSeance';
import { ajouterTemps, useMoteurEtapes } from '../hooks/useMoteurEtapes';
import { useVerrouEcran } from '../hooks/useVerrouEcran';

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

const BOUTON_BASE = 'min-h-14 rounded-lg font-semibold transition-colors touch-manipulation disabled:opacity-40';
const BOUTON = `${BOUTON_BASE} px-4 text-lg`;
const BOUTON_VERT = `${BOUTON} bg-green-600 hover:bg-green-700 text-white`;
const BOUTON_JAUNE = `${BOUTON} bg-yellow-600 hover:bg-yellow-700 text-white`;
const BOUTON_BLEU = `${BOUTON} bg-blue-600 hover:bg-blue-700 text-white`;
const BOUTON_CLAIR = `${BOUTON} bg-gray-200 hover:bg-gray-300 text-gray-800`;
/** Précédent / Suivant : plus étroits, texte plus petit pour tenir sur 390 px. */
const BOUTON_NAV = `${BOUTON_BASE} px-2 text-base bg-gray-600 hover:bg-gray-700 text-white`;

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

function couleurCompte(resteSec: number, normale: string): string {
  return resteSec <= SECONDES_ALERTE ? 'text-red-600' : normale;
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
  const [poids, setPoids] = useState<Record<string, number>>({});
  const [demarreeLe, setDemarreeLe] = useState<string | null>(null);

  const etapes = useMemo(() => construireEtapes(seanceActive), [seanceActive]);
  const ordreExercices = useMemo(() => {
    const ids = [
      ...seanceActive.blocs.map((bloc) => bloc.exerciceId),
      ...(seanceActive.circuit?.stations ?? []),
    ];
    return ids.filter((id, i) => ids.indexOf(id) === i);
  }, [seanceActive]);
  const tempo = seanceActive.parametres.tempo;

  const moteur = useMoteurEtapes(etapes.length);

  // Bloque le défilement de la page derrière l'écran plein écran.
  useEffect(() => {
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = precedent;
    };
  }, []);
  const { etat, maintenant, allerA } = moteur;
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
  const sauvegardeRef = useRef<{ visite: number; ms: number; poids: Record<string, number> | null }>({
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
    poidsInitial: Record<string, number>,
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

  const changerPoids = (exerciceId: string, kg: number | null) =>
    setPoids((precedents) => {
      const suivants = { ...precedents };
      if (kg !== null && kg > 0) suivants[exerciceId] = kg;
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
          poidsInitial={poids[etape.exerciceId]}
          onPoids={(kg) => changerPoids(etape.exerciceId, kg)}
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
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col">
      <EnTete
        phase={libellePhase(etape)}
        position={libellePosition(etapes, index, ordreExercices)}
        ecouleSec={tempsTotalEcoule}
        resteSec={tempsRestant}
        onQuitter={quitter}
      />
      {enPause && (
        <div className="bg-yellow-100 text-yellow-900 text-center font-semibold py-2">
          En pause · le chrono est arrêté
        </div>
      )}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4">{corps}</main>
      <footer
        className="sticky bottom-0 bg-white border-t border-gray-200 px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2 max-w-md mx-auto">
          <button onClick={precedent} disabled={index === 0} className={`${BOUTON_NAV} flex-1`}>
            Précédent
          </button>
          {!estFin && (
            <button onClick={basculerPause} className={`${BOUTON_JAUNE} flex-[1.5]`}>
              {enPause ? 'Reprendre' : 'Pause'}
            </button>
          )}
          {!estFin && (
            <button onClick={suivant} className={`${BOUTON_NAV} flex-1`}>
              Suivant
            </button>
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

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Séance guidée</h2>
        <button
          onClick={onQuitter}
          className="min-h-14 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium touch-manipulation"
        >
          Quitter
        </button>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{formaterDureeCourte(dureeTotaleSec(etapes))}</div>
            <div className="text-xs text-gray-500">durée estimée</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{ordreExercices.length}</div>
            <div className="text-xs text-gray-500">{ordreExercices.length > 1 ? 'exercices' : 'exercice'}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {tempo.monteeSec} / {tempo.descenteSec}
            </div>
            <div className="text-xs text-gray-500">tempo (s)</div>
          </div>
        </div>

        <ul className="bg-white rounded-lg shadow divide-y divide-gray-100">
          {ordreExercices.map((id, i) => {
            const exercice = exerciceDeSeance(id);
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2">
                <img src={cheminImage(id)} alt="" className="w-14 rounded bg-gray-50 shrink-0" />
                <span className="text-gray-800">
                  <span className="text-gray-400 mr-2">{i + 1}.</span>
                  {exercice.nomFr}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-sm text-gray-700">
          L’application dicte le tempo : suivez l’écran et les bips, elle compte les répétitions à votre
          place. Séries lentes, sans rebond, pour protéger tendons et ligaments.
        </p>

        {progression && etapeSauvee ? (
          <div className="space-y-3">
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3 text-sm text-yellow-900">
              Une séance a été interrompue {decrireEtape(etapeSauvee)}, après{' '}
              {formaterDureeCourte(progression.tempsCumuleSec)} d’effort.
            </div>
            <button onClick={onReprendre} className={`${BOUTON_VERT} w-full text-xl`}>
              Reprendre la séance
            </button>
            <button onClick={onCommencer} className={`${BOUTON_CLAIR} w-full`}>
              Recommencer du début
            </button>
          </div>
        ) : (
          <button onClick={onCommencer} className={`${BOUTON_VERT} w-full text-xl`}>
            Commencer
          </button>
        )}

        <p className="text-xs text-gray-500 text-center">
          Le son et le maintien de l’écran allumé s’activent au premier appui.
        </p>
      </main>
    </div>
  );
}

interface EnTeteProps {
  phase: string;
  position: string;
  ecouleSec: number;
  resteSec: number;
  onQuitter: () => void;
}

function EnTete({ phase, position, ecouleSec, resteSec, onQuitter }: EnTeteProps) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-500">{phase}</div>
          <div className="font-semibold text-gray-800 truncate">{position || ' '}</div>
        </div>
        <button
          onClick={onQuitter}
          className="shrink-0 min-h-14 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium touch-manipulation"
        >
          Quitter
        </button>
      </div>
      <div className="flex justify-between text-sm text-gray-600 mt-1 tabular-nums max-w-md mx-auto">
        <span>Écoulé {formaterMmSs(ecouleSec)}</span>
        <span>Reste ~ {formaterMmSs(resteSec)}</span>
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
    <div className="text-center space-y-4">
      <div className={`text-8xl font-bold leading-none tabular-nums ${couleurCompte(resteSec, 'text-gray-800')}`}>
        {formaterMmSs(Math.ceil(resteSec))}
      </div>
      <p className="text-gray-500">{titre}</p>
      {courant && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Mouvement {indexMouvement + 1} / {mouvements.length} · {Math.ceil(resteMouvementSec)} s
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{courant.nom}</div>
          <p className="text-gray-700 mt-2">{courant.consigne}</p>
        </div>
      )}
      {prochain && <p className="text-sm text-gray-500">Ensuite : {prochain.nom}</p>}
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
      <img
        src={cheminImage(exercice.id)}
        alt={exercice.nomFr}
        className="w-full max-w-md mx-auto rounded-lg bg-gray-50"
      />
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{exercice.nomFr}</h2>
        <p className="text-gray-600">{sousTitre}</p>
        <p className="text-sm text-gray-500">
          {exercice.position}
          {exercice.unite === 'reps' && ` · départ par la ${departDescente ? 'descente' : 'montée'}`}
        </p>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-gray-600">Préparez-vous</div>
        <div className={`text-8xl font-bold leading-none tabular-nums ${couleurCompte(resteSec, 'text-gray-800')}`}>
          {Math.ceil(resteSec)}
        </div>
      </div>
      <ul className="list-disc pl-5 space-y-1 text-gray-700">
        {exercice.pointsAttention.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <button onClick={onDemarrer} className={`${BOUTON_VERT} w-full`}>
        Démarrer maintenant
      </button>
      <button onClick={onPasser} className="w-full min-h-14 text-gray-500 underline touch-manipulation">
        Passer cet exercice
      </button>
    </div>
  );
}

interface CorpsTravailProps {
  etape: Extract<Etape, { type: 'serie' | 'station' }>;
  exercice: Exercice;
  metro: EtatMetronome | null;
  resteSec: number;
  tempo: Tempo;
  poidsInitial: number | undefined;
  onPoids: (kg: number | null) => void;
  onTerminee: () => void;
  onPasser: () => void;
}

function CorpsTravail({
  etape,
  exercice,
  metro,
  resteSec,
  tempo,
  poidsInitial,
  onPoids,
  onTerminee,
  onPasser,
}: CorpsTravailProps) {
  // Le texte saisi est gardé tel quel (« 12, » ne doit pas être réécrit en
  // « 12 » à chaque frappe) ; seule la valeur numérique remonte au parent.
  const [texte, setTexte] = useState(poidsInitial !== undefined ? String(poidsInitial) : '');
  const saisirPoids = (evenement: ChangeEvent<HTMLInputElement>) => {
    const valeur = evenement.target.value;
    setTexte(valeur);
    const kg = Number.parseFloat(valeur.replace(',', '.'));
    onPoids(Number.isFinite(kg) ? kg : null);
  };

  const sousTitre =
    etape.type === 'serie'
      ? `Série ${etape.serie} / ${etape.series} · ${libelleReps(exercice, etape.reps)}`
      : `Tour ${etape.tour} / ${etape.tours} · Station ${etape.station} / ${etape.stations} · ${etape.dureeSec} s`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img src={cheminImage(exercice.id)} alt="" className="w-28 rounded-lg bg-gray-50 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{exercice.nomFr}</h2>
          <p className="text-sm text-gray-600">{sousTitre}</p>
        </div>
      </div>

      {metro ? (
        <Metronome metro={metro} exercice={exercice} tempo={tempo} />
      ) : (
        <div className="text-center select-none py-2">
          <div className="text-lg font-semibold text-gray-600">Maintenez l’effort</div>
          <div className={`text-9xl font-bold leading-none tabular-nums ${couleurCompte(resteSec, 'text-blue-600')}`}>
            {Math.ceil(resteSec)}
          </div>
          <div className="text-sm text-gray-500 mt-3">secondes restantes</div>
        </div>
      )}

      <details className="bg-gray-50 rounded-lg px-4">
        <summary className="py-3 font-medium text-gray-800 cursor-pointer">Points d’attention</summary>
        <ul className="list-disc pl-5 pb-3 space-y-1 text-gray-700">
          {exercice.pointsAttention.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>

      <label className="flex items-center justify-between gap-3 bg-white rounded-lg shadow px-4 py-3">
        <span className="font-medium text-gray-800">Poids (kg)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          placeholder="—"
          value={texte}
          onChange={saisirPoids}
          className="w-28 h-14 text-2xl text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onTerminee} className={BOUTON_BLEU}>
          {etape.type === 'serie' ? 'Série terminée' : 'Station terminée'}
        </button>
        <button onClick={onPasser} className={BOUTON_CLAIR}>
          Passer l’exercice
        </button>
      </div>
    </div>
  );
}

interface MetronomeProps {
  metro: EtatMetronome;
  exercice: Exercice;
  tempo: Tempo;
}

function Metronome({ metro, exercice, tempo }: MetronomeProps) {
  const monte = metro.phase === 'monte';
  const couleur = monte ? 'text-green-600' : 'text-orange-500';
  return (
    <div className="text-center select-none py-2">
      <div className={`text-4xl font-extrabold tracking-widest ${couleur}`}>{monte ? 'MONTE' : 'DESCENDS'}</div>
      <div className={`text-9xl font-bold leading-none tabular-nums ${couleur}`}>
        {Math.max(1, Math.ceil(metro.resteDansPhaseSec))}
      </div>
      <div className="text-2xl font-semibold text-gray-800 mt-2">
        Rép {metro.rep} / {metro.totalReps}
      </div>
      {metro.cote && <div className="text-xl font-medium text-blue-700">Côté {metro.cote}</div>}
      {exercice.cotes === 'alterne' && <div className="text-lg text-gray-600">en alternant</div>}
      <div className="text-sm text-gray-500 mt-3">
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
    <div className="text-center space-y-4">
      <div className="text-lg font-semibold text-gray-600">
        {etape.type === 'reposTour' ? `Fin du tour ${etape.tour} / ${etape.tours} · repos` : 'Repos'}
      </div>
      <div className={`text-8xl font-bold leading-none tabular-nums ${couleurCompte(resteSec, 'text-blue-600')}`}>
        {formaterMmSs(Math.ceil(resteSec))}
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Prochain</div>
        {exerciceSuivant ? (
          <>
            <img
              src={cheminImage(exerciceSuivant.id)}
              alt={exerciceSuivant.nomFr}
              className="w-full max-w-xs mx-auto rounded-lg bg-gray-50"
            />
            <div className="text-xl font-bold text-gray-900 mt-2">{exerciceSuivant.nomFr}</div>
            <div className="text-gray-600">{libelleSuivant(suivant)}</div>
          </>
        ) : (
          <div className="text-xl font-bold text-gray-900">Retour au calme</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onProlonger} className={BOUTON_CLAIR}>
          +{PROLONGATION_REPOS_SEC} s
        </button>
        <button onClick={onPasser} className={BOUTON_BLEU}>
          Passer
        </button>
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
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Bravo, séance terminée</h2>
        <p className="text-gray-600 mt-1">
          Durée réelle <span className="font-semibold tabular-nums">{formaterMmSs(realisee.dureeReelleSec)}</span>{' '}
          · prévue <span className="tabular-nums">{formaterMmSs(realisee.dureePrevueSec)}</span>
        </p>
        <p className="text-gray-600">
          {seriesFaites} / {seriesPrevues} séries faites
        </p>
      </div>

      <table className="w-full text-sm bg-white rounded-lg shadow overflow-hidden">
        <thead>
          <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2 font-medium" colSpan={2}>
              Exercice
            </th>
            <th className="px-2 py-2 font-medium text-center">Séries</th>
            <th className="px-2 py-2 font-medium text-center">Temps</th>
            <th className="px-2 py-2 font-medium text-center">Poids</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {realisee.exercices.map((realise) => {
            const exercice = exerciceDeSeance(realise.exerciceId);
            const complet = realise.seriesFaites >= realise.seriesPrevues;
            return (
              <tr key={realise.exerciceId}>
                <td className="pl-3 py-2 w-14">
                  <img src={cheminImage(exercice.id)} alt="" className="w-12 rounded bg-gray-50" />
                </td>
                <td className="px-2 py-2 font-medium text-gray-900">{exercice.nomFr}</td>
                <td className={`px-2 py-2 text-center tabular-nums ${complet ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>
                  {realise.seriesFaites} / {realise.seriesPrevues}
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-gray-600">{formaterMmSs(realise.dureeSec)}</td>
                <td className="px-2 py-2 text-center tabular-nums text-gray-600">
                  {realise.poidsKg !== undefined ? `${realise.poidsKg} kg` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button onClick={onEnregistrer} className={`${BOUTON_VERT} w-full`}>
        Enregistrer la séance
      </button>
      <button onClick={onAbandonner} className={`${BOUTON_CLAIR} w-full`}>
        Ne pas enregistrer
      </button>
    </div>
  );
}
