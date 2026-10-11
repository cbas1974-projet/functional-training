// L'écran de la routine du soir : la liste d'étirements de ce téléphone (qu'on
// peut changer, monter, descendre, retirer, compléter), les sept derniers
// soirs, et « Commencer » toujours à portée de pouce. La routine guidée plein
// écran est `RoutineGuidee`.
//
// Tout reste sur le téléphone, hors de l'historique d'entraînement : la liste
// et les soirs faits sont gardés dans `etat.routineSoir`.
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { EntrainementState, PartieRoutine, Personne } from '../types';
import { EXERCICES_PAR_ID, ZONES } from '../data/exercices';
import { bellSound } from '../utils/sounds';
import {
  CONSIGNE_GAINAGE,
  CONSIGNE_COU,
  DUREE_MAX_SEC,
  ETIREMENTS_MAX,
  ETIREMENTS_MIN,
  NOM_PARTIE,
  NOTE_A_EVITER,
  NOTE_ROUTINE,
  PARTIES_ROUTINE,
  ROLE_MOBILITE,
  ajouterEtirement,
  avecListe,
  avecListeDeDepart,
  avecPartie,
  avecSoir,
  candidatsRoutine,
  depasseLeMaximum,
  deplacerEtirement,
  dureePartieSec,
  exerciceRoutine,
  libelleDuree,
  libelleDureeFine,
  libelleDureeRoutine,
  libelleTenue,
  listeModifiee,
  partiesAllumees,
  partiesDe,
  remplacerEtirement,
  resumeRoutine,
  retirerEtirement,
  routineDe,
  sansSoir,
  soirDe,
  soirFait,
} from '../utils/routineSoir';
import FicheExercice from './FicheExercice';
import ImageEnGrand from './ImageEnGrand';
import RoutineGuidee from './RoutineGuidee';
import { BilanSoirs, PointsSemaine } from './CarteRoutineSoir';
import { Bascule, CIBLE, Feuille, Pastille } from './Feuille';

type FeuilleOuverte = null | { type: 'changer'; index: number } | { type: 'ajouter' };

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

/** Hauteur de l'action principale : commencer. */
const ACTION = 60;

/** Sans accents ni majuscules : pour chercher « epaule » et trouver « Épaule ». */
const normaliser = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function BoutonLigne({
  onClick,
  children,
  disabled,
  etiquette,
  className = '',
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** Ce que lit un lecteur d'écran quand le bouton n'est qu'une flèche. */
  etiquette?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiquette}
      className={`rounded-xl px-3 text-sm font-semibold disabled:opacity-40 ${className}`}
      style={SECONDAIRE}
    >
      {children}
    </button>
  );
}

/** Une partie de la routine : son interrupteur, et ce qu'elle contient quand
 *  elle est allumée. */
function SectionPartie({
  partie,
  allumee,
  seule,
  dureeSec,
  precision,
  onBasculer,
  children,
}: {
  partie: PartieRoutine;
  allumee: boolean;
  /** La seule partie allumée : on ne l'éteint pas. */
  seule: boolean;
  dureeSec: number;
  precision: string;
  onBasculer: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 p-4" style={CARTE} aria-label={NOM_PARTIE[partie]}>
      <Bascule
        actif={allumee}
        onClick={onBasculer}
        nom={`${NOM_PARTIE[partie]} · ≈ ${libelleDureeFine(dureeSec)}`}
        precision={seule ? `${precision} · au moins une partie reste allumée` : precision}
      />
      {allumee && children}
    </section>
  );
}

/** Un exercice d'une partie qu'on ne change pas (gainage, mobilité) : l'image,
 *  les muscles, la tenue — et ce qu'il remplace, quand il remplace un mouvement
 *  que la bibliothèque n'a pas. */
function LigneFixe({ id, partie, onImage }: { id: string; partie: PartieRoutine; onImage: () => void }) {
  const exercice = exerciceRoutine(id);
  const role = ROLE_MOBILITE[id];
  return (
    <li className="p-3" style={{ background: 'var(--surface-haute)', borderRadius: 14, border: '1px solid var(--bordure)' }}>
      <FicheExercice exercice={exercice} taille="petite" onImage={onImage}>
        <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
          {exercice.muscles}
        </p>
        <p className="chiffres text-sm font-semibold" style={{ color: 'var(--texte)' }}>
          {libelleTenue(exercice, partie)}
        </p>
        {partie === 'mobilite' && role && (
          <p className="text-xs" style={{ color: 'var(--accent)' }}>
            {role}
          </p>
        )}
      </FicheExercice>
    </li>
  );
}

/** Le choix d'un étirement dans la bibliothèque : ceux qui se font à la maison,
 *  au sol, moins ce que la personne doit éviter et ce qui est déjà dans sa
 *  liste. On cherche par un mot, ou on filtre par partie du corps. */
function FeuilleEtirements({
  titre,
  personne,
  dejaLa,
  onChoisir,
  onFermer,
}: {
  titre: string;
  personne: Personne;
  dejaLa: string[];
  onChoisir: (id: string) => void;
  onFermer: () => void;
}) {
  const [recherche, setRecherche] = useState('');
  const [zone, setZone] = useState<string | null>(null);
  const candidats = useMemo(
    () => candidatsRoutine(personne).filter((e) => !dejaLa.includes(e.id)),
    [personne, dejaLa],
  );
  const zones = ZONES.filter((z) => candidats.some((e) => e.zone === z.id));
  const mot = normaliser(recherche.trim());
  const choix = candidats.filter(
    (e) => (zone === null || e.zone === zone) && (mot === '' || normaliser(`${e.nomFr} ${e.muscles} ${e.position}`).includes(mot)),
  );
  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <input
        type="search"
        value={recherche}
        onChange={(evenement) => setRecherche(evenement.target.value)}
        placeholder="Chercher : mollet, dos, hanche…"
        aria-label="Chercher un étirement"
        className="w-full rounded-xl px-3 text-sm"
        style={{ ...SECONDAIRE, background: 'var(--fond)' }}
      />
      <div className="flex flex-wrap gap-2">
        <Pastille selectionne={zone === null} onClick={() => setZone(null)}>
          Tous
        </Pastille>
        {zones.map((z) => (
          <Pastille key={z.id} selectionne={zone === z.id} onClick={() => setZone(z.id)}>
            {z.nom}
          </Pastille>
        ))}
      </div>
      {choix.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
          Aucun étirement ne correspond.
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
                  {exercice.muscles} · {libelleTenue(exercice)}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  Prendre celui-ci
                </p>
              </FicheExercice>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
        {NOTE_A_EVITER[personne]}
      </p>
    </Feuille>
  );
}

export default function RoutineSoir({
  etat,
  onChange,
}: {
  etat: EntrainementState;
  /** Forme « updater » pour ne pas écraser un changement concurrent. */
  onChange: (miseAJour: (prec: EntrainementState) => EntrainementState) => void;
}) {
  const personne = etat.personne ?? null;
  const routine = etat.routineSoir;
  const [guidee, setGuidee] = useState(false);
  const [feuille, setFeuille] = useState<FeuilleOuverte>(null);
  /** L'étirement dont l'image est ouverte en grand. */
  const [enGrand, setEnGrand] = useState<string | null>(null);
  const fermerFeuille = useCallback(() => setFeuille(null), []);
  const fermerImage = useCallback(() => setEnGrand(null), []);

  if (!personne) {
    return (
      <section className="p-4" style={CARTE}>
        <h1 className="text-xl font-bold">Routine du soir</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--texte-discret)' }}>
          La liste dépend de chacun : dites d’abord, sur l’accueil, qui s’entraîne sur ce téléphone.
        </p>
      </section>
    );
  }

  const maintenant = new Date();
  const liste = routineDe(personne, routine);
  const parties = partiesDe(personne, routine);
  /** Le contenu de chaque partie, allumée ou non : les listes fixes de la personne. */
  const complete = partiesDe(personne, undefined);
  const allumees = partiesAllumees(routine);
  const ceSoir = soirDe(maintenant);
  const faiteCeSoir = soirFait(routine, ceSoir);
  const trop = depasseLeMaximum(parties);

  /** Toute retouche de la liste de ce téléphone. */
  const modifierListe = (changer: (precedente: string[]) => string[]) =>
    onChange((prec) =>
      prec.personne
        ? { ...prec, routineSoir: avecListe(prec.personne, prec.routineSoir, changer(routineDe(prec.personne, prec.routineSoir))) }
        : prec,
    );
  const basculer = (partie: PartieRoutine) =>
    onChange((prec) => ({
      ...prec,
      routineSoir: avecPartie(prec.routineSoir, partie, !partiesAllumees(prec.routineSoir).includes(partie)),
    }));
  const marquerFaite = () => onChange((prec) => ({ ...prec, routineSoir: avecSoir(prec.routineSoir, soirDe(new Date())) }));
  const demarquer = () => onChange((prec) => ({ ...prec, routineSoir: sansSoir(prec.routineSoir, soirDe(new Date())) }));

  const commencer = () => {
    // Geste de l'utilisateur : c'est maintenant qu'on réveille le son.
    bellSound.unlock();
    setGuidee(true);
  };

  const remettreLeDepart = () => {
    if (window.confirm('Remettre la liste de départ ? Vos changements sont perdus.')) {
      onChange((prec) => (prec.personne ? { ...prec, routineSoir: avecListeDeDepart(prec.personne, prec.routineSoir) } : prec));
    }
  };

  const nomDuChoix = feuille?.type === 'changer' ? EXERCICES_PAR_ID[liste[feuille.index]]?.nomFr : undefined;
  const seule = allumees.length === 1;

  return (
    <>
      <div className="space-y-3">
        <section>
          <h1 className="text-xl font-bold" style={{ color: 'var(--texte)' }}>
            Routine du soir
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--texte-discret)' }}>
            Dix minutes au plus, tous les soirs, au calme, en plus de l’entraînement. Ce n’est pas une séance : rien
            n’entre dans l’historique. Chaque partie s’éteint d’un appui.
          </p>
        </section>

        <section className="p-4" style={CARTE}>
          <p className="chiffres text-lg font-bold" style={{ color: 'var(--texte)' }}>
            ≈ {libelleDureeRoutine(parties)} · {resumeRoutine(parties).toLowerCase()}
          </p>
          <p className="chiffres text-xs" style={{ color: 'var(--texte-discret)' }}>
            {PARTIES_ROUTINE.filter((partie) => parties[partie].length > 0)
              .map((partie) => `${NOM_PARTIE[partie]} ${libelleDureeFine(dureePartieSec(partie, parties[partie]))}`)
              .join(' · ')}
          </p>
          {trop && (
            <p role="alert" className="mt-1 text-sm font-bold" style={{ color: 'var(--pause)' }}>
              Plus de {libelleDuree(DUREE_MAX_SEC)} : éteignez une partie ou retirez un étirement.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <PointsSemaine routine={routine} maintenant={maintenant} />
            <p className="text-sm" style={{ color: 'var(--texte-discret)' }}>
              <BilanSoirs routine={routine} maintenant={maintenant} />
            </p>
          </div>
          {faiteCeSoir ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold" style={{ color: 'var(--montee)' }}>
                Faite ce soir ✓
              </p>
              <BoutonLigne onClick={demarquer}>Annuler</BoutonLigne>
            </div>
          ) : (
            <BoutonLigne onClick={marquerFaite} className="mt-3 w-full">
              Je l’ai faite ce soir
            </BoutonLigne>
          )}
        </section>

        {/* 1. Le gainage : le même pour les deux. */}
        <SectionPartie
          partie="gainage"
          allumee={allumees.includes('gainage')}
          seule={seule && allumees.includes('gainage')}
          dureeSec={dureePartieSec('gainage', complete.gainage)}
          precision="Planche, planche latérale, chien d’arrêt"
          onBasculer={() => basculer('gainage')}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--pause)' }}>
            {CONSIGNE_GAINAGE}
          </p>
          <ol className="space-y-2" aria-label="Le gainage du soir">
            {complete.gainage.map((id) => (
              <LigneFixe key={id} id={id} partie="gainage" onImage={() => setEnGrand(id)} />
            ))}
          </ol>
        </SectionPartie>

        {/* 2. La mobilité pour le jiu-jitsu : deux mouvements au sol. */}
        <SectionPartie
          partie="mobilite"
          allumee={allumees.includes('mobilite')}
          seule={seule && allumees.includes('mobilite')}
          dureeSec={dureePartieSec('mobilite', complete.mobilite)}
          precision="Hanches de la garde, rotation du buste"
          onBasculer={() => basculer('mobilite')}
        >
          <ol className="space-y-2" aria-label="La mobilité du soir">
            {complete.mobilite.map((id) => (
              <LigneFixe key={id} id={id} partie="mobilite" onImage={() => setEnGrand(id)} />
            ))}
          </ol>
        </SectionPartie>

        {/* 3. Le cou : deux étirements doux, les mêmes pour les deux. */}
        <SectionPartie
          partie="cou"
          allumee={allumees.includes('cou')}
          seule={seule && allumees.includes('cou')}
          dureeSec={dureePartieSec('cou', complete.cou)}
          precision="Inclinaison de côté, flexion avant"
          onBasculer={() => basculer('cou')}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--pause)' }}>
            {CONSIGNE_COU}
          </p>
          <ol className="space-y-2" aria-label="Le cou du soir">
            {complete.cou.map((id) => (
              <LigneFixe key={id} id={id} partie="cou" onImage={() => setEnGrand(id)} />
            ))}
          </ol>
        </SectionPartie>

        {/* 4. Les étirements de chacun : la seule liste qu'on change. */}
        <SectionPartie
          partie="etirements"
          allumee={allumees.includes('etirements')}
          seule={seule && allumees.includes('etirements')}
          dureeSec={dureePartieSec('etirements', liste)}
          precision={`${liste.length} étirement${liste.length > 1 ? 's' : ''} au sol, pour vous`}
          onBasculer={() => basculer('etirements')}
        >
          <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
            {NOTE_ROUTINE[personne]}
          </p>
          <ol className="space-y-2" aria-label="Les étirements du soir">
            {liste.map((id, i) => {
              const exercice = EXERCICES_PAR_ID[id];
              return (
                <li
                  key={id}
                  className="p-3"
                  style={{ background: 'var(--surface-haute)', borderRadius: 14, border: '1px solid var(--bordure)' }}
                >
                  <FicheExercice exercice={exercice} taille="petite" onImage={() => setEnGrand(id)}>
                    <p className="chiffres text-xs font-bold" style={{ color: 'var(--accent)' }}>
                      {i + 1} / {liste.length}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--texte-discret)' }}>
                      {exercice.muscles}
                    </p>
                    <p className="chiffres text-sm font-semibold" style={{ color: 'var(--texte)' }}>
                      {libelleTenue(exercice)}
                    </p>
                  </FicheExercice>
                  <div className="mt-2 flex gap-2">
                    <BoutonLigne onClick={() => setFeuille({ type: 'changer', index: i })} className="flex-1">
                      Changer
                    </BoutonLigne>
                    <BoutonLigne
                      onClick={() => modifierListe((l) => deplacerEtirement(l, i, -1))}
                      disabled={i === 0}
                      etiquette={`Monter ${exercice.nomFr}`}
                      className="w-11"
                    >
                      ↑
                    </BoutonLigne>
                    <BoutonLigne
                      onClick={() => modifierListe((l) => deplacerEtirement(l, i, 1))}
                      disabled={i === liste.length - 1}
                      etiquette={`Descendre ${exercice.nomFr}`}
                      className="w-11"
                    >
                      ↓
                    </BoutonLigne>
                    <BoutonLigne
                      onClick={() => modifierListe((l) => retirerEtirement(l, i))}
                      disabled={liste.length <= ETIREMENTS_MIN}
                      etiquette={`Retirer ${exercice.nomFr}`}
                      className="flex-1"
                    >
                      Retirer
                    </BoutonLigne>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="grid gap-2">
            {liste.length < ETIREMENTS_MAX && (
              <BoutonLigne onClick={() => setFeuille({ type: 'ajouter' })}>Ajouter un étirement</BoutonLigne>
            )}
            {listeModifiee(personne, routine) && (
              <BoutonLigne onClick={remettreLeDepart}>Remettre la liste de départ</BoutonLigne>
            )}
          </div>
        </SectionPartie>

        {/* L'action de départ, collée en bas tant qu'on lit la liste. */}
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

      {feuille?.type === 'changer' && (
        <FeuilleEtirements
          titre={nomDuChoix ? `Changer : ${nomDuChoix}` : 'Changer d’étirement'}
          personne={personne}
          dejaLa={liste}
          onChoisir={(id) => {
            modifierListe((l) => remplacerEtirement(l, feuille.index, id));
            setFeuille(null);
          }}
          onFermer={fermerFeuille}
        />
      )}
      {feuille?.type === 'ajouter' && (
        <FeuilleEtirements
          titre="Ajouter un étirement"
          personne={personne}
          dejaLa={liste}
          onChoisir={(id) => {
            modifierListe((l) => ajouterEtirement(l, id));
            setFeuille(null);
          }}
          onFermer={fermerFeuille}
        />
      )}

      {enGrand && EXERCICES_PAR_ID[enGrand] && <ImageEnGrand exercice={exerciceRoutine(enGrand)} onFermer={fermerImage} />}

      {guidee && <RoutineGuidee parties={parties} routine={routine} onFaite={marquerFaite} onQuitter={() => setGuidee(false)} />}
    </>
  );
}
