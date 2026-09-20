// Sauvegarde locale : réglages, séance en cours et historique sont conservés
// dans le navigateur de l'appareil. Rien n'est envoyé sur un serveur.
import type {
  EntrainementState,
  ExerciceRealise,
  Materiel,
  ParametresSeance,
  ProgressionSeance,
  SeanceRealisee,
  Zone,
} from '../types';
import { PARAMETRES_PAR_DEFAUT, TOUTES_LES_ZONES } from '../data/parametres';
import { uniteDeSeance } from './statistiques';

const CLE_STOCKAGE = 'functional-training';

/** Ancienne clé, utilisée quand l'entraînement vivait dans l'application de
 *  gestion de pools de combat : on récupère l'historique une seule fois. */
const CLE_HERITEE = 'combat-pool-manager';

/** Correspondance entre l'ancien objectif unique et les zones. */
const ZONES_PAR_OBJECTIF: Record<string, Zone[]> = {
  complet: TOUTES_LES_ZONES,
  haut: ['haut'],
  bas: ['bas'],
  gainage: ['gainage'],
  dos: ['dos'],
};

export const ETAT_PAR_DEFAUT: EntrainementState = {
  parametres: PARAMETRES_PAR_DEFAUT,
  seanceCourante: null,
  enCours: null,
  historique: [],
};

/** Complète des paramètres sauvegardés par une version antérieure. */
const migrerParametres = (sauvegardes: Partial<ParametresSeance>): ParametresSeance => {
  const zones =
    sauvegardes.zones && sauvegardes.zones.length > 0
      ? sauvegardes.zones
      : sauvegardes.objectif
        ? (ZONES_PAR_OBJECTIF[sauvegardes.objectif] ?? PARAMETRES_PAR_DEFAUT.zones)
        : PARAMETRES_PAR_DEFAUT.zones;
  const materiels =
    sauvegardes.materiels && sauvegardes.materiels.length > 0
      ? sauvegardes.materiels
      : sauvegardes.banc
        ? (['halteres', 'banc', 'step'] as Materiel[])
        : PARAMETRES_PAR_DEFAUT.materiels;
  // Une séance enregistrée avant l'arrivée d'un réglage arrive sans lui :
  // on retombe sur la valeur par défaut plutôt que sur `undefined`.
  return {
    ...PARAMETRES_PAR_DEFAUT,
    ...sauvegardes,
    zones: [...zones],
    materiels: [...materiels],
    guideVisuel: sauvegardes.guideVisuel ?? PARAMETRES_PAR_DEFAUT.guideVisuel,
  };
};

/** Les charges étaient autrefois un seul nombre par exercice ; elles sont
 *  désormais une valeur par série. Une ancienne saisie devient la charge de
 *  la première série. */
const migrerPoids = (
  sauvegardes: ProgressionSeance['poids'] | Record<string, number> | undefined,
): ProgressionSeance['poids'] => {
  const poids: ProgressionSeance['poids'] = {};
  for (const [exerciceId, valeur] of Object.entries(sauvegardes ?? {})) {
    if (Array.isArray(valeur)) poids[exerciceId] = valeur.map((kg) => (Number.isFinite(kg) ? kg : 0));
    else if (typeof valeur === 'number' && valeur > 0) poids[exerciceId] = [valeur];
  }
  return poids;
};

const migrerProgression = (enCours: ProgressionSeance | null): ProgressionSeance | null =>
  enCours === null
    ? null
    : {
        ...enCours,
        poids: migrerPoids(enCours.poids),
        // Une séance commencée avant le réglage d'unité l'a été en kilos.
        seance: {
          ...enCours.seance,
          parametres: {
            ...enCours.seance.parametres,
            unitePoids: uniteDeSeance(enCours.seance.parametres),
          },
        },
      };

/** Avant le réglage d'unité, toutes les charges étaient en kilogrammes et
 *  vivaient dans un champ `poidsKg`. On fige l'unité de ces séances-là : sans
 *  cela, 16 kg se relirait comme 16 lb. */
const migrerExercice = (exo: ExerciceRealise): ExerciceRealise => {
  const migre: ExerciceRealise = { ...exo };
  delete migre.poidsKg;
  const poids = exo.poids ?? exo.poidsKg;
  if (typeof poids === 'number' && poids > 0) migre.poids = poids;
  return migre;
};

const migrerHistorique = (historique: SeanceRealisee[]): SeanceRealisee[] =>
  historique.map((realisee) => ({
    ...realisee,
    parametres: { ...realisee.parametres, unitePoids: uniteDeSeance(realisee.parametres) },
    exercices: realisee.exercices.map(migrerExercice),
  }));

const migrer = (sauvegarde: Partial<EntrainementState>): EntrainementState => ({
  ...ETAT_PAR_DEFAUT,
  ...sauvegarde,
  parametres: migrerParametres(sauvegarde.parametres ?? {}),
  enCours: migrerProgression(sauvegarde.enCours ?? null),
  historique: migrerHistorique(sauvegarde.historique ?? []),
});

/** Lit l'état sauvegardé ; reprend celui de l'ancienne application si besoin. */
export const chargerEtat = (): EntrainementState => {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (brut !== null) return migrer(JSON.parse(brut));

    const herite = localStorage.getItem(CLE_HERITEE);
    if (herite !== null) {
      const ancien = JSON.parse(herite) as { entrainement?: Partial<EntrainementState> };
      if (ancien.entrainement) return migrer(ancien.entrainement);
    }
    return ETAT_PAR_DEFAUT;
  } catch (erreur) {
    console.error('Lecture de la sauvegarde impossible :', erreur);
    return ETAT_PAR_DEFAUT;
  }
};

export const enregistrerEtat = (etat: EntrainementState): void => {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
  } catch (erreur) {
    console.error('Enregistrement de la sauvegarde impossible :', erreur);
  }
};

export const effacerTout = (): void => {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch (erreur) {
    console.error('Effacement impossible :', erreur);
  }
};
