// La séance commune, vue du téléphone : l'état que garde le serveur, reçu en
// direct, et les appuis qu'on lui envoie. Un appui compte tout de suite sur
// ce téléphone ; s'il n'a pas pu partir (le réseau coupe au sous-sol), il
// repart toutes les trois secondes jusqu'à ce que le serveur l'ait — et
// l'appli continue comme si de rien n'était.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Personne } from '../types';
import { appliquer, lireEnvoi, lireEtat } from '../utils/etatCommun';
import type { ActionCommune, EnvoiAction, EtatCommun } from '../utils/etatCommun';

export interface ConfigSynchro {
  /** « https://srv123.hstgr.cloud » */
  serveur: string;
  equipe: string;
  /** Le jour et la séance : « 2026-10-08_jeudi ». */
  cle: string;
  personne: Personne;
}

export interface SeanceCommune {
  /** L'état commun, avec les appuis de ce téléphone pas encore confirmés. */
  etat: EtatCommun | null;
  /** Qui est en direct sur cette séance. */
  presents: string[];
  /** Le direct passe. */
  enLigne: boolean;
  /** L'heure du serveur, estimée sur ce téléphone. */
  heure: () => number;
  envoyer: (action: ActionCommune) => void;
}

const RELANCE_MS = 3000;
/** Le serveur bat toutes les quinze secondes : sans nouvelle depuis quarante,
 *  le direct est tombé — on le dit, et on rappelle. */
const SILENCE_MAXI_MS = 40_000;

const nouvelId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// Le dernier état reçu et les appuis pas encore partis sont gardés sur le
// téléphone : si la page se recharge au sous-sol, la séance reprend où elle
// en est, et les appuis repartent quand le réseau revient.
const PREFIXE_GARDE = 'seance-commune:';
interface Garde {
  etat: EtatCommun | null;
  envois: EnvoiAction[];
  /** L'avance de l'horloge du serveur sur celle du téléphone, déjà mesurée. */
  decalage?: number;
}
function lireGarde(cle: string | null): Garde {
  try {
    const brut = (cle ? JSON.parse(localStorage.getItem(cle) ?? 'null') : null) as Partial<Garde> | null;
    return {
      etat: lireEtat(brut?.etat),
      envois: Array.isArray(brut?.envois) ? brut.envois.map(lireEnvoi).filter((e): e is EnvoiAction => e !== null) : [],
      ...(typeof brut?.decalage === 'number' && Number.isFinite(brut.decalage) ? { decalage: brut.decalage } : {}),
    };
  } catch {
    return { etat: null, envois: [] };
  }
}
function ecrireGarde(cle: string | null, garde: Garde) {
  if (!cle) return;
  try {
    if (garde.etat || garde.envois.length > 0) localStorage.setItem(cle, JSON.stringify(garde));
    else localStorage.removeItem(cle);
    // Celles d'un autre jour ne serviront plus : on fait le ménage.
    const jour = cle.split(':')[2]?.slice(0, 10) ?? '';
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const autre = localStorage.key(i);
      if (autre?.startsWith(PREFIXE_GARDE) && (autre.split(':')[2]?.slice(0, 10) ?? '') < jour) localStorage.removeItem(autre);
    }
  } catch {
    // Stockage plein ou refusé : tout reste en mémoire.
  }
}

/** Un état reçu ne remplace jamais un plus récent de la même séance : une
 *  réponse lente peut arriver après le direct qui l'a déjà dépassée. */
function plusRecent(courant: EtatCommun | null, recu: EtatCommun | null): EtatCommun | null {
  if (!courant) return recu;
  if (!recu) return courant;
  // Une autre séance — recommencée, ou serveur remis à neuf : on la prend.
  if (recu.debut !== courant.debut) return recu;
  return (recu.rev ?? 0) < (courant.rev ?? 0) ? courant : recu;
}

export function useSeanceCommune(config: ConfigSynchro | null): SeanceCommune {
  const cleGarde = config ? `${PREFIXE_GARDE}${config.equipe}:${config.cle}:${config.personne}` : null;
  const [garde] = useState(() => lireGarde(cleGarde));
  const [etatServeur, setEtatServeur] = useState<EtatCommun | null>(garde.etat);
  const [enAttente, setEnAttente] = useState<EnvoiAction[]>(garde.envois);
  const [presents, setPresents] = useState<string[]>([]);
  const [enLigne, setEnLigne] = useState(false);
  /** Avance de l'horloge du serveur sur celle du téléphone, en ms. */
  const decalage = useRef(garde.decalage ?? 0);
  const decalageMesure = useRef(false);
  const heure = useCallback(() => Date.now() + decalage.current, []);
  const recevoir = useCallback((recu: EtatCommun | null) => setEtatServeur((courant) => plusRecent(courant, recu)), []);

  const serveur = config?.serveur ?? null;
  const adresse = config ? `${config.serveur}/api/equipes/${config.equipe}/seances/${config.cle}` : null;
  const personne = config?.personne ?? null;

  useEffect(
    () => ecrireGarde(cleGarde, { etat: etatServeur, envois: enAttente, decalage: decalage.current }),
    [cleGarde, etatServeur, enAttente],
  );

  // L'heure du serveur : trois allers-retours, on garde le plus rapide. Sans
  // réseau au départ, on la mesure dès que le direct passe.
  useEffect(() => {
    if (!serveur || decalageMesure.current) return;
    let fini = false;
    void (async () => {
      let plusCourt = Infinity;
      for (let i = 0; i < 3 && !fini; i += 1) {
        try {
          const avant = Date.now();
          const reponse = await fetch(`${serveur}/api/heure`, { cache: 'no-store' });
          const { heure: duServeur } = (await reponse.json()) as { heure: number };
          const apres = Date.now();
          if (apres - avant < plusCourt && Number.isFinite(duServeur)) {
            plusCourt = apres - avant;
            decalage.current = duServeur - (avant + apres) / 2;
            decalageMesure.current = true;
          }
        } catch {
          return;
        }
      }
    })();
    return () => {
      fini = true;
    };
  }, [serveur, enLigne]);

  // Le direct : le navigateur se reconnecte seul quand le réseau revient. Un
  // réseau qui tombe sans prévenir (le LTE au sous-sol) laisse le flux
  // « ouvert » sans rien y faire passer : le silence le trahit.
  const dernierMessage = useRef(Date.now());
  useEffect(() => {
    if (!adresse || !personne) return;
    let source: EventSource | null = null;
    const ouvrir = () => {
      source?.close();
      dernierMessage.current = Date.now();
      source = new EventSource(`${adresse}/flux?personne=${personne}`);
      source.addEventListener('etat', (evenement) => {
        dernierMessage.current = Date.now();
        try {
          const donnees = JSON.parse((evenement as MessageEvent<string>).data) as { etat: unknown; presents?: string[] };
          recevoir(lireEtat(donnees.etat));
          setPresents(Array.isArray(donnees.presents) ? donnees.presents : []);
          setEnLigne(true);
        } catch {
          // Un message abîmé : le suivant le remplacera.
        }
      });
      source.addEventListener('battement', () => {
        dernierMessage.current = Date.now();
        setEnLigne(true);
      });
      source.onerror = () => setEnLigne(false);
    };
    ouvrir();
    const veille = window.setInterval(() => {
      if (Date.now() - dernierMessage.current > SILENCE_MAXI_MS) {
        setEnLigne(false);
        ouvrir();
      }
    }, 5000);
    return () => {
      window.clearInterval(veille);
      source?.close();
    };
  }, [adresse, personne, recevoir]);

  // Les appuis en attente partent, et repartent tant que le serveur ne les a
  // pas confirmés. Le serveur écarte les doublons.
  useEffect(() => {
    if (!adresse || enAttente.length === 0) return;
    let fini = false;
    const envoyerTout = async () => {
      for (const envoi of enAttente) {
        try {
          const reponse = await fetch(adresse, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(envoi),
          });
          if (fini) return;
          if (reponse.ok) recevoir(lireEtat(((await reponse.json()) as { etat: unknown }).etat));
          else if (reponse.status !== 400) return;
          // Confirmé, ou refusé pour de bon : on ne le renvoie plus.
          setEnAttente((precedents) => precedents.filter((x) => x.id !== envoi.id));
        } catch {
          // Le réseau ne passe pas : on le dit tout de suite, et on réessaiera.
          setEnLigne(false);
          return;
        }
      }
    };
    void envoyerTout();
    const relance = window.setInterval(() => void envoyerTout(), RELANCE_MS);
    return () => {
      fini = true;
      window.clearInterval(relance);
    };
  }, [adresse, enAttente, recevoir]);

  const etat = useMemo(
    () => enAttente.reduce<EtatCommun | null>((courant, envoi) => appliquer(courant, envoi), etatServeur),
    [etatServeur, enAttente],
  );

  const envoyer = useCallback(
    (action: ActionCommune) => setEnAttente((precedents) => [...precedents, { id: nouvelId(), a: heure(), action }]),
    [heure],
  );

  return { etat, presents, enLigne, heure, envoyer };
}
