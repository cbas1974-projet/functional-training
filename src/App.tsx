import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntrainementState, ProgrammeMois } from './types';
import { chargerEtat, enregistrerEtat } from './utils/storage';
import {
  IDENTIFIANT_PARTAGEABLE,
  RELANCE_ENVOI_MS,
  avecMesure,
  effacerRealisation,
  envoyerRealisation,
  partageDe,
  sansMesure,
  sansSeance,
} from './utils/enLigne';
import { useEnvoiMesures } from './hooks/useEnvoiMesures';
import { NOM_PERSONNE, autrePersonne, genererProgramme, programmeDansLien } from './utils/programmeMois';
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

/** Les réglages d'un programme reçu aux mêmes séances — répétitions de
 *  chacun, serveur, équipe : on les prend sans rien demander. */
const avecReglagesDe = (programme: ProgrammeMois, recu: ProgrammeMois): ProgrammeMois => ({
  ...programme,
  ...(recu.duo ? { duo: recu.duo } : {}),
  ...(recu.serveur ? { serveur: recu.serveur } : {}),
  ...(recu.equipe ? { equipe: recu.equipe } : {}),
});

/** L'état au lancement. Le premier jour, l'application compose le programme
 *  elle-même ; un programme reçu par lien est pris d'office s'il n'y en avait
 *  pas encore, sinon il attend une réponse. */
function demarrer(): { etat: EntrainementState; recu: ProgrammeMois | null } {
  const etat = chargerEtat();
  const recu = programmeDansLien(window.location.hash);
  if (recu && !etat.programme) return { etat: { ...etat, programme: recu, programmeARenvoyer: false }, recu: null };
  if (etat.programme) {
    if (recu && memesSeances(recu, etat.programme)) {
      return { etat: { ...etat, programme: avecReglagesDe(etat.programme, recu) }, recu: null };
    }
    return { etat, recu };
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
      if (memesSeances(recu, programmeActuel.current)) {
        setEtat((prec) => (prec.programme ? { ...prec, programme: avecReglagesDe(prec.programme, recu) } : prec));
        effacerLien();
      } else setProgrammeRecu(recu);
    };
    window.addEventListener('hashchange', surAncre);
    return () => window.removeEventListener('hashchange', surAncre);
  }, []);

  // Chaque écran s'ouvre en haut de page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [vue]);

  // Les séances faites partent vers le serveur, et repartent tant qu'il ne
  // les a pas.
  const partage = partageDe(etat.programme ?? null, etat.personne ?? null);
  const aEnvoyer = etat.aEnvoyer ?? [];
  const historiqueRef = useRef(etat.historique);
  useEffect(() => {
    historiqueRef.current = etat.historique;
  }, [etat.historique]);
  const cleEnvoi = partage ? `${partage.serveur}|${partage.equipe}|${partage.personne}` : '';
  const listeEnvoi = aEnvoyer.join(',');
  const listeEffacer = (etat.aEffacer ?? []).join(',');
  useEffect(() => {
    if (!partage || (listeEnvoi === '' && listeEffacer === '')) return;
    let fini = false;
    // Une à la fois, les suppressions d'abord : la file raccourcie relance
    // la suivante.
    const traiter = async () => {
      const aRetirer = listeEffacer.split(',')[0];
      if (aRetirer) {
        const regle = await effacerRealisation(partage, aRetirer);
        if (fini || !regle) return;
        setEtat((prec) => ({ ...prec, aEffacer: (prec.aEffacer ?? []).filter((x) => x !== aRetirer) }));
        return;
      }
      const id = listeEnvoi.split(',')[0];
      const realisation = historiqueRef.current.find((h) => h.id === id);
      const regle = realisation ? await envoyerRealisation(partage, realisation) : true;
      if (fini || !regle) return;
      setEtat((prec) => ({ ...prec, aEnvoyer: (prec.aEnvoyer ?? []).filter((x) => x !== id) }));
    };
    void traiter();
    const relance = window.setInterval(() => void traiter(), RELANCE_ENVOI_MS);
    return () => {
      fini = true;
      window.clearInterval(relance);
    };
    // La clé et les listes résument le partage et les files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleEnvoi, listeEnvoi, listeEffacer]);

  // Au premier branchement sur un serveur, les séances faites avant partent
  // aussi : l'historique du serveur est complet dès le départ.
  const cleHistorique = partage ? `${partage.serveur}|${partage.equipe}` : '';
  useEffect(() => {
    if (!cleHistorique) return;
    setEtat((prec) =>
      prec.historiqueEnvoyeA === cleHistorique
        ? prec
        : {
            ...prec,
            historiqueEnvoyeA: cleHistorique,
            aEnvoyer: [
              ...new Set([
                ...(prec.aEnvoyer ?? []),
                ...prec.historique.map((h) => h.id).filter((id) => IDENTIFIANT_PARTAGEABLE.test(id)),
              ]),
            ],
          },
    );
  }, [cleHistorique]);

  // Les mesures du corps partent aussi, par leur propre file.
  useEnvoiMesures(etat, setEtat);

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
                partage={partage}
                nomPartenaire={etat.personne ? NOM_PERSONNE[autrePersonne(etat.personne)] : null}
                onSupprimer={(id) => setEtat((prec) => sansSeance(prec, id))}
                personne={etat.personne ?? null}
                mesures={etat.mesures ?? []}
                unitePoids={uniteDeSeance(etat.parametres)}
                onMesure={(mesure) => setEtat((prec) => avecMesure(prec, mesure))}
                onSupprimerMesure={(id) => setEtat((prec) => sansMesure(prec, id))}
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
