// L'envoi des mesures du corps vers le serveur, avec une file qui ne perd rien :
// une mesure notée, corrigée ou supprimée reste dans la file tant que le serveur
// ne l'a pas réglée. Le réseau qui ne passe pas, un « pas maintenant » (429,
// 507) la laissent là, et on réessaie plus tard ; seul un refus définitif (400)
// la retire. Même chemin que les séances faites, dans App.tsx.
import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EntrainementState } from '../types';
import {
  RELANCE_ENVOI_MS,
  avecMesuresAuBranchement,
  partageDe,
  sansMesureReglee,
  traiterFileMesures,
} from '../utils/enLigne';

const enListe = (liste: string): string[] => (liste === '' ? [] : liste.split(','));

export function useEnvoiMesures(
  etat: EntrainementState,
  setEtat: Dispatch<SetStateAction<EntrainementState>>,
): void {
  const partage = partageDe(etat.programme ?? null, etat.personne ?? null);
  const mesuresRef = useRef(etat.mesures ?? []);
  useEffect(() => {
    mesuresRef.current = etat.mesures ?? [];
  }, [etat.mesures]);
  const cleEnvoi = partage ? `${partage.serveur}|${partage.equipe}|${partage.personne}` : '';
  const listeEnvoi = (etat.mesuresAEnvoyer ?? []).join(',');
  const listeEffacer = (etat.mesuresAEffacer ?? []).join(',');

  // Une opération à la fois, les suppressions d'abord : la file raccourcie
  // relance la suivante. Tant que le serveur ne prend pas, on réessaie.
  useEffect(() => {
    if (!partage || (listeEnvoi === '' && listeEffacer === '')) return;
    let fini = false;
    const traiter = async () => {
      const regle = await traiterFileMesures(partage, {
        aEffacer: enListe(listeEffacer),
        aEnvoyer: enListe(listeEnvoi),
        mesures: mesuresRef.current,
      });
      if (fini || !regle) return;
      setEtat((prec) => sansMesureReglee(prec, regle));
    };
    void traiter();
    const relance = window.setInterval(() => void traiter(), RELANCE_ENVOI_MS);
    return () => {
      fini = true;
      window.clearInterval(relance);
    };
    // La clé et les listes résument le partage et les files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleEnvoi, listeEnvoi, listeEffacer, setEtat]);

  // Au premier branchement sur un serveur, les mesures déjà notées partent
  // aussi : celui de l'autre est complet dès le départ.
  const cleServeur = partage ? `${partage.serveur}|${partage.equipe}` : '';
  useEffect(() => {
    if (!cleServeur) return;
    setEtat((prec) => avecMesuresAuBranchement(prec, cleServeur));
  }, [cleServeur, setEtat]);
}
