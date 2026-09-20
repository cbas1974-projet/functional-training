// Petits utilitaires de formatage pour l'onglet Entraînement.
// Ce fichier ne contient volontairement aucun composant (voir la règle
// ESLint react-refresh/only-export-components sur les fichiers .tsx).
import type { ParametresSeance, SeanceRealisee } from '../types';
import { OBJECTIFS, ZONES } from '../data/exercices';

/** Libellé des zones d'une séance : « Corps entier », « Bas du corps » ou
 *  « Bas du corps + Dos » ; lit l'ancien objectif des séances plus anciennes. */
export const libelleZones = (parametres: ParametresSeance): string => {
  const zones = parametres.zones ?? [];
  if (zones.length === 0) {
    return OBJECTIFS.find((o) => o.id === parametres.objectif)?.nom ?? 'Corps entier';
  }
  if (zones.length >= ZONES.length) return 'Corps entier';
  return ZONES.filter((z) => zones.includes(z.id)).map((z) => z.nom).join(' + ');
};

/** Formate une date ISO en français, lisible sur mobile (ex. "18/09/2026 14:32"). */
export const formaterDateFr = (dateIso: string): string => {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export interface StatistiquesHistorique {
  nombreSeances: number;
  tempsTotalSec: number;
  seances7DerniersJours: number;
}

/** Statistiques simples calculées à partir de l'historique des séances. */
export const calculerStatistiques = (
  historique: SeanceRealisee[]
): StatistiquesHistorique => {
  const maintenant = Date.now();
  const septJoursMs = 7 * 24 * 60 * 60 * 1000;

  let tempsTotalSec = 0;
  let seances7DerniersJours = 0;

  for (const seance of historique) {
    tempsTotalSec += seance.dureeReelleSec;
    const date = new Date(seance.date).getTime();
    if (!Number.isNaN(date) && maintenant - date <= septJoursMs) {
      seances7DerniersJours += 1;
    }
  }

  return {
    nombreSeances: historique.length,
    tempsTotalSec,
    seances7DerniersJours,
  };
};

const LIBELLES_NIVEAU_MIN: Record<1 | 2 | 3, string> = {
  1: 'Débutant',
  2: 'Intermédiaire',
  3: 'Avancé',
};

/** Libellé du niveau minimum requis pour un exercice de la bibliothèque. */
export const libelleNiveauMin = (niveauMin: 1 | 2 | 3): string =>
  LIBELLES_NIVEAU_MIN[niveauMin];

/** Graine pseudo-aléatoire pour demander une nouvelle variante de séance. */
export const graineAleatoire = (): number =>
  Math.floor(Math.random() * 1_000_000_000);

/** Message d'erreur lisible à partir d'une exception interceptée. */
export const messageErreur = (err: unknown, repli: string): string =>
  err instanceof Error && err.message ? err.message : repli;
