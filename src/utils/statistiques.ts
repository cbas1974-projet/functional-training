// Statistiques d'historique : à quelle fréquence tel exercice a-t-il été
// travaillé, et avec quelle charge. Rien n'est stocké ici : tout se recalcule
// à partir des séances enregistrées.
import type { ExerciceRealise, ParametresSeance, SeanceRealisee, UnitePoids } from '../types';

/** Fenêtres glissantes proposées à l'écran, en jours. */
export const FENETRES_JOURS = [30, 90, 180] as const;
export type FenetreJours = (typeof FENETRES_JOURS)[number];

const JOUR_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------- Unités

const LIVRES_PAR_KG = 2.20462;

/** Unité d'une séance enregistrée. Celles d'avant le réglage étaient saisies
 *  en kilogrammes : c'est la valeur de repli, jamais l'unité courante. */
export function uniteDeSeance(parametres: Pick<ParametresSeance, 'unitePoids'>): UnitePoids {
  return parametres.unitePoids ?? 'kg';
}

export const SUFFIXE_UNITE: Record<UnitePoids, string> = { lb: 'lb', kg: 'kg' };

/** Arrondi utile pour une charge : la livre entière, le demi-kilo. Les
 *  haltères n'existent pas en fractions plus fines. */
export function arrondirPoids(valeur: number, unite: UnitePoids): number {
  return unite === 'lb' ? Math.round(valeur) : Math.round(valeur * 2) / 2;
}

/** Convertit une charge d'une unité vers l'autre, puis l'arrondit. */
export function convertirPoids(valeur: number, de: UnitePoids, vers: UnitePoids): number {
  if (de === vers) return valeur;
  const converti = vers === 'lb' ? valeur * LIVRES_PAR_KG : valeur / LIVRES_PAR_KG;
  return arrondirPoids(converti, vers);
}

/** Charge de référence d'un exercice réalisé, quel que soit le nom du champ :
 *  `poidsKg` est l'ancien, conservé pour les séances déjà enregistrées. */
export function poidsDe(exo: ExerciceRealise): number | undefined {
  const valeur = exo.poids ?? exo.poidsKg;
  return typeof valeur === 'number' && valeur > 0 ? valeur : undefined;
}

// ------------------------------------------------------------- Fréquences

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
  dernierPoids?: number;
  /** Charge la plus lourde jamais enregistrée. */
  poidsMax?: number;
  /** Unité dans laquelle `dernierPoids` et `poidsMax` sont exprimés. */
  unite: UnitePoids;
}

const vide = (unite: UnitePoids): FrequenceExercice => ({
  parFenetre: { 30: 0, 90: 0, 180: 0 },
  total: 0,
  seriesTrenteJours: 0,
  unite,
});

/** Un exercice compte comme « fait » dès qu'au moins une série a été bouclée.
 *  Les séances abandonnées avant la première série ne comptent donc pas. */
function aEteFait(exo: ExerciceRealise): boolean {
  return exo.seriesFaites > 0;
}

/** Fréquences de tous les exercices présents dans l'historique, indexées par
 *  identifiant d'exercice. Les charges sont ramenées à `unite`, pour qu'un
 *  historique à cheval sur un changement d'unité reste comparable. Les
 *  séances sans date exploitable sont ignorées. */
export function frequencesParExercice(
  historique: SeanceRealisee[],
  unite: UnitePoids = 'lb',
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
    const uniteSeance = uniteDeSeance(seance.parametres);
    for (const exo of seance.exercices) {
      if (!aEteFait(exo)) continue;
      const frequence = parExercice.get(exo.exerciceId) ?? vide(unite);
      frequence.total += 1;
      for (const fenetre of FENETRES_JOURS) {
        if (age <= fenetre * JOUR_MS) frequence.parFenetre[fenetre] += 1;
      }
      if (age <= 30 * JOUR_MS) frequence.seriesTrenteJours += exo.seriesFaites;
      frequence.derniereDate = seance.date;
      const poids = poidsDe(exo);
      if (poids !== undefined) {
        const converti = convertirPoids(poids, uniteSeance, unite);
        frequence.dernierPoids = converti;
        frequence.poidsMax = Math.max(frequence.poidsMax ?? 0, converti);
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
  unite: UnitePoids = 'lb',
  maintenantMs: number = Date.now(),
): FrequenceExercice {
  return frequencesParExercice(historique, unite, maintenantMs).get(exerciceId) ?? vide(unite);
}

/** « 2× ce mois-ci », « 1× sur 3 mois », « jamais fait ». */
export function libelleFrequenceCourte(frequence: FrequenceExercice): string {
  if (frequence.parFenetre[30] > 0) return `${frequence.parFenetre[30]}× ce mois-ci`;
  if (frequence.parFenetre[90] > 0) return `${frequence.parFenetre[90]}× sur 3 mois`;
  if (frequence.parFenetre[180] > 0) return `${frequence.parFenetre[180]}× sur 6 mois`;
  if (frequence.total > 0) return `${frequence.total}× il y a plus de 6 mois`;
  return 'jamais fait';
}

/** Charges de chaque série d'un exercice réalisé : « 30 · 30 · 35 lb ». La
 *  séance est montrée telle qu'elle a été faite, dans son unité d'origine.
 *  Chaîne vide si aucune charge n'a été saisie. */
export function libellePoidsParSerie(exo: ExerciceRealise, unite: UnitePoids): string {
  const suffixe = SUFFIXE_UNITE[unite];
  const parSerie = exo.poidsParSerie;
  if (!parSerie || parSerie.length === 0) {
    const poids = poidsDe(exo);
    return poids === undefined ? '' : `${poids} ${suffixe}`;
  }
  const distinctes = new Set(parSerie.filter((poids) => poids > 0));
  if (distinctes.size === 1 && !parSerie.includes(0)) return `${[...distinctes][0]} ${suffixe}`;
  return `${parSerie.map((poids) => (poids > 0 ? String(poids) : '—')).join(' · ')} ${suffixe}`;
}
