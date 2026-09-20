// Statistiques d'historique : à quelle fréquence tel exercice a-t-il été
// travaillé, et avec quelle charge. Rien n'est stocké ici : tout se recalcule
// à partir des séances enregistrées.
import type { ExerciceRealise, SeanceRealisee } from '../types';

/** Fenêtres glissantes proposées à l'écran, en jours. */
export const FENETRES_JOURS = [30, 90, 180] as const;
export type FenetreJours = (typeof FENETRES_JOURS)[number];

const JOUR_MS = 24 * 60 * 60 * 1000;

export interface FrequenceExercice {
  /** Nombre de séances où l'exercice a été fait, par fenêtre glissante. */
  parFenetre: Record<FenetreJours, number>;
  /** Nombre de séances où l'exercice a été fait, depuis toujours. */
  total: number;
  /** Séries réellement faites sur les 30 derniers jours. */
  seriesTrenteJours: number;
  /** Date ISO de la dernière fois, toutes fenêtres confondues. */
  derniereDate?: string;
  /** Charge de la dernière séance où l'exercice a été chargé. */
  dernierPoidsKg?: number;
  /** Charge la plus lourde jamais enregistrée. */
  poidsMaxKg?: number;
}

const vide = (): FrequenceExercice => ({
  parFenetre: { 30: 0, 90: 0, 180: 0 },
  total: 0,
  seriesTrenteJours: 0,
});

/** Un exercice compte comme « fait » dès qu'au moins une série a été bouclée.
 *  Les séances abandonnées avant la première série ne comptent donc pas. */
function aEteFait(exo: ExerciceRealise): boolean {
  return exo.seriesFaites > 0;
}

/** Fréquences de tous les exercices présents dans l'historique, indexées par
 *  identifiant d'exercice. Les séances sans date exploitable sont ignorées. */
export function frequencesParExercice(
  historique: SeanceRealisee[],
  maintenantMs: number = Date.now(),
): Map<string, FrequenceExercice> {
  const parExercice = new Map<string, FrequenceExercice>();
  // Du plus ancien au plus récent : la dernière écriture est la plus récente,
  // ce qui donne gratuitement « dernière date » et « dernier poids ».
  const triees = [...historique]
    .map((seance) => ({ seance, ms: new Date(seance.date).getTime() }))
    .filter(({ ms }) => Number.isFinite(ms))
    .sort((a, b) => a.ms - b.ms);

  for (const { seance, ms } of triees) {
    const age = maintenantMs - ms;
    for (const exo of seance.exercices) {
      if (!aEteFait(exo)) continue;
      const frequence = parExercice.get(exo.exerciceId) ?? vide();
      frequence.total += 1;
      for (const fenetre of FENETRES_JOURS) {
        if (age <= fenetre * JOUR_MS) frequence.parFenetre[fenetre] += 1;
      }
      if (age <= 30 * JOUR_MS) frequence.seriesTrenteJours += exo.seriesFaites;
      frequence.derniereDate = seance.date;
      if (typeof exo.poidsKg === 'number' && exo.poidsKg > 0) {
        frequence.dernierPoidsKg = exo.poidsKg;
        frequence.poidsMaxKg = Math.max(frequence.poidsMaxKg ?? 0, exo.poidsKg);
      }
      parExercice.set(exo.exerciceId, frequence);
    }
  }
  return parExercice;
}

/** Fréquence d'un seul exercice ; tout à zéro s'il n'a jamais été fait. */
export function frequenceExercice(
  historique: SeanceRealisee[],
  exerciceId: string,
  maintenantMs: number = Date.now(),
): FrequenceExercice {
  return frequencesParExercice(historique, maintenantMs).get(exerciceId) ?? vide();
}

/** « 2× ce mois-ci », « 1× il y a 3 mois », « jamais fait ». */
export function libelleFrequenceCourte(frequence: FrequenceExercice): string {
  if (frequence.parFenetre[30] > 0) return `${frequence.parFenetre[30]}× ce mois-ci`;
  if (frequence.parFenetre[90] > 0) return `${frequence.parFenetre[90]}× sur 3 mois`;
  if (frequence.parFenetre[180] > 0) return `${frequence.parFenetre[180]}× sur 6 mois`;
  if (frequence.total > 0) return `${frequence.total}× il y a plus de 6 mois`;
  return 'jamais fait';
}

/** Charges de chaque série d'un exercice réalisé : « 12 · 12 · 14 kg ».
 *  Chaîne vide si aucune charge n'a été saisie. */
export function libellePoidsParSerie(exo: ExerciceRealise): string {
  const parSerie = exo.poidsParSerie;
  if (!parSerie || parSerie.length === 0) {
    return typeof exo.poidsKg === 'number' && exo.poidsKg > 0 ? `${exo.poidsKg} kg` : '';
  }
  const distinctes = new Set(parSerie.filter((kg) => kg > 0));
  if (distinctes.size === 1 && !parSerie.includes(0)) return `${[...distinctes][0]} kg`;
  return `${parSerie.map((kg) => (kg > 0 ? String(kg) : '—')).join(' · ')} kg`;
}
