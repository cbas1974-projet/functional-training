import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntrainementState, ProgrammeMois } from './types';
import { chargerEtat, enregistrerEtat } from './utils/storage';
import { genererProgramme, programmeDansLien } from './utils/programmeMois';
import { graineAleatoire } from './utils/formatage';
import { uniteDeSeance } from './utils/statistiques';
import Accueil from './components/Accueil';
import type { VueSecondaire } from './components/Accueil';
import Entrainement from './components/Entrainement';
import HistoriqueEntrainement from './components/HistoriqueEntrainement';
import BibliothequeExercices from './components/BibliothequeExercices';

const CLE_LIEN = 'programme=';

/** Mêmes séances, mêmes exercices : rien à demander. */
const memesSeances = (a: ProgrammeMois, b: ProgrammeMois | null | undefined) =>
  JSON.stringify(a.seances) === JSON.stringify(b?.seances);

/** L'état au lancement. Le premier jour, l'application compose le programme
 *  elle-même ; un programme reçu par lien est pris d'office s'il n'y en avait
 *  pas encore, sinon il attend une réponse. */
function demarrer(): { etat: EntrainementState; recu: ProgrammeMois | null } {
  const etat = chargerEtat();
  const recu = programmeDansLien(window.location.hash);
  if (recu && !etat.programme) return { etat: { ...etat, programme: recu, programmeARenvoyer: false }, recu: null };
  if (etat.programme) {
    return { etat, recu: recu && !memesSeances(recu, etat.programme) ? recu : null };
  }
  // Un programme tout neuf : l'autre téléphone ne l'a pas encore.
  const programme = genererProgramme({ graine: graineAleatoire() });
  return { etat: { ...etat, programme, programmeARenvoyer: true }, recu: null };
}

/** Le programme du lien est lu : on retire l'ancre, pour qu'un rechargement
 *  ne repose pas la question. */
function effacerLien() {
  if (!window.location.hash.includes(CLE_LIEN)) return;
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // Historique inaccessible : l'ancre reste, sans conséquence.
  }
}

export default function App() {
  const [depart] = useState(demarrer);
  const [etat, setEtat] = useState<EntrainementState>(depart.etat);
  const [programmeRecu, setProgrammeRecu] = useState<ProgrammeMois | null>(depart.recu);
  const [vue, setVue] = useState<VueSecondaire | null>(null);

  useEffect(() => {
    enregistrerEtat(etat);
  }, [etat]);

  useEffect(() => {
    if (!depart.recu) effacerLien();
  }, [depart]);

  // Un lien ouvert alors que l'application l'est déjà : l'ancre change sans
  // que la page se recharge. Le programme qu'on a déjà ne pose pas de question.
  const programmeActuel = useRef(etat.programme);
  useEffect(() => {
    programmeActuel.current = etat.programme;
  }, [etat.programme]);
  useEffect(() => {
    const surAncre = () => {
      const recu = programmeDansLien(window.location.hash);
      if (!recu) return;
      if (memesSeances(recu, programmeActuel.current)) effacerLien();
      else setProgrammeRecu(recu);
    };
    window.addEventListener('hashchange', surAncre);
    return () => window.removeEventListener('hashchange', surAncre);
  }, []);

  // Chaque écran s'ouvre en haut de page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [vue]);

  const onChange = useCallback(
    (miseAJour: (prec: EntrainementState) => EntrainementState) => setEtat((prec) => miseAJour(prec)),
    [],
  );

  const repondre = (accepte: boolean) => {
    if (accepte && programmeRecu) {
      setEtat((prec) => ({ ...prec, programme: programmeRecu, programmeARenvoyer: false }));
    }
    setProgrammeRecu(null);
    effacerLien();
  };

  return (
    // Le fond vient des jetons de thème : sombre par défaut, clair si le
    // système le demande.
    <div className="min-h-screen" style={{ color: 'var(--texte)' }}>
      {vue === null ? (
        etat.programme && (
          <Accueil
            etat={etat}
            programme={etat.programme}
            onChange={onChange}
            programmeRecu={programmeRecu && !memesSeances(programmeRecu, etat.programme) ? programmeRecu : null}
            onReponseProgrammeRecu={repondre}
            onOuvrir={setVue}
          />
        )
      ) : (
        <>
          <header
            className="mx-auto max-w-3xl px-4 pb-2"
            style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
          >
            <button
              type="button"
              onClick={() => setVue(null)}
              className="rounded-xl px-4 text-sm font-semibold"
              style={{
                minHeight: 44,
                background: 'var(--surface)',
                border: '1px solid var(--bordure)',
                color: 'var(--texte)',
              }}
            >
              ← Programme
            </button>
          </header>
          <main className="mx-auto max-w-3xl px-4 pb-4">
            {vue === 'historique' && (
              <HistoriqueEntrainement
                historique={etat.historique}
                onSupprimer={(id) =>
                  setEtat((prec) => ({ ...prec, historique: prec.historique.filter((s) => s.id !== id) }))
                }
              />
            )}
            {vue === 'exercices' && (
              <BibliothequeExercices historique={etat.historique} unitePoids={uniteDeSeance(etat.parametres)} />
            )}
            {vue === 'libre' && <Entrainement etat={etat} onChange={onChange} />}
          </main>
        </>
      )}
    </div>
  );
}
