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
import { estRessenti, lireRessentis } from './ressenti';
import { IDENTIFIANT_MESURE, lireMesures } from './mesures';
import { VERSION_PROGRAMME, validerProgramme } from './programmeMois';
import { lireRoutineSoir } from './routineSoir';
import { lireDouleurs } from './douleurs';

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
  programme: null,
  personne: null,
  programmeARenvoyer: false,
  aDeux: true,
  aEnvoyer: [],
  aEffacer: [],
  mesures: [],
  mesuresAEnvoyer: [],
  mesuresAEffacer: [],
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

/** Les séries finies sur « Série terminée » : des places d'étapes, rien
 *  d'autre. */
const placesLues = (brut: unknown): number[] | undefined =>
  Array.isArray(brut) ? brut.filter((n): n is number => Number.isInteger(n) && n >= 0) : undefined;

const migrerProgression = (enCours: ProgressionSeance | null): ProgressionSeance | null =>
  enCours === null
    ? null
    : {
        ...enCours,
        poids: migrerPoids(enCours.poids),
        // Une séance commencée avant l'arrivée du ressenti n'en a pas.
        ressentis: lireRessentis(enCours.ressentis),
        // Sur un seul téléphone, à deux : ce qu'on a noté pour l'autre, et
        // les séries finies. Une séance d'avant n'en a pas.
        ...(enCours.poidsAutre ? { poidsAutre: migrerPoids(enCours.poidsAutre) } : {}),
        ...(enCours.ressentisAutre ? { ressentisAutre: lireRessentis(enCours.ressentisAutre) } : {}),
        ...(placesLues(enCours.faites) ? { faites: placesLues(enCours.faites) } : {}),
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
  // Le ressenti est facultatif : une valeur inconnue est écartée, pas gardée.
  if (!estRessenti(exo.ressenti)) delete migre.ressenti;
  return migre;
};

/** Ce que le téléphone a noté pour l'autre, sur un seul téléphone : gardé
 *  s'il se lit, écarté sinon. */
const partenaireLu = (partenaire: SeanceRealisee['partenaire']): SeanceRealisee['partenaire'] =>
  partenaire &&
  (partenaire.personne === 'sebastien' || partenaire.personne === 'max') &&
  Array.isArray(partenaire.exercices)
    ? { personne: partenaire.personne, exercices: partenaire.exercices.map(migrerExercice) }
    : undefined;

const migrerHistorique = (historique: SeanceRealisee[]): SeanceRealisee[] =>
  historique.map((realisee) => {
    const { partenaire, ...reste } = realisee;
    const lu = partenaireLu(partenaire);
    return {
      ...reste,
      parametres: { ...realisee.parametres, unitePoids: uniteDeSeance(realisee.parametres) },
      exercices: realisee.exercices.map(migrerExercice),
      ...(lu ? { partenaire: lu } : {}),
    };
  });

/** Une file d'identifiants relue : que des textes, deux cents au plus. */
const identifiants = (brut: unknown): string[] =>
  Array.isArray(brut) ? brut.filter((id): id is string => typeof id === 'string').slice(-200) : [];

/** Une file de mesures relue : seuls les identifiants que le serveur accepte —
 *  un autre ne passerait jamais, et bloquerait la file. */
const identifiantsDeMesures = (brut: unknown): string[] =>
  identifiants(brut).filter((id) => IDENTIFIANT_MESURE.test(id));

/** La version d'un programme sauvegardé qui vient d'être recomposé — plus
 *  ancienne que celle de l'application —, ou celle qu'on n'a pas encore dite
 *  à l'écran ; sinon rien. */
function recomposeDepuis(sauvegarde: Partial<EntrainementState>, programme: EntrainementState['programme']): number | undefined {
  if (typeof sauvegarde.programmeRecomposeDepuis === 'number') return sauvegarde.programmeRecomposeDepuis;
  if (!programme || !sauvegarde.programme) return undefined;
  const version = typeof sauvegarde.programme.version === 'number' ? sauvegarde.programme.version : 1;
  return version < VERSION_PROGRAMME ? version : undefined;
}

const migrer = (sauvegarde: Partial<EntrainementState>): EntrainementState => {
  // Un programme illisible (exercices disparus, sauvegarde abîmée) est
  // écarté : l'application en compose un nouveau. Un programme d'une version
  // plus ancienne est recomposé, avec la même graine (`validerProgramme`) :
  // l'accueil le dit une fois.
  const programme = sauvegarde.programme ? validerProgramme(sauvegarde.programme) : null;
  const depuis = recomposeDepuis(sauvegarde, programme);
  return {
    ...ETAT_PAR_DEFAUT,
    ...sauvegarde,
    parametres: migrerParametres(sauvegarde.parametres ?? {}),
    enCours: migrerProgression(sauvegarde.enCours ?? null),
    historique: migrerHistorique(sauvegarde.historique ?? []),
    programme,
    programmeRecomposeDepuis: depuis,
    personne: sauvegarde.personne === 'sebastien' || sauvegarde.personne === 'max' ? sauvegarde.personne : null,
    programmeARenvoyer: sauvegarde.programmeARenvoyer === true,
    // À deux par défaut : c'est l'habitude.
    aDeux: sauvegarde.aDeux !== false,
    aEnvoyer: identifiants(sauvegarde.aEnvoyer),
    aEffacer: identifiants(sauvegarde.aEffacer),
    historiqueEnvoyeA: typeof sauvegarde.historiqueEnvoyeA === 'string' ? sauvegarde.historiqueEnvoyeA : undefined,
    // Les mensurations : une sauvegarde d'avant n'en a pas, une abîmée perd
    // seulement les mesures qui ne se lisent plus.
    mesures: lireMesures(sauvegarde.mesures),
    mesuresAEnvoyer: identifiantsDeMesures(sauvegarde.mesuresAEnvoyer),
    mesuresAEffacer: identifiantsDeMesures(sauvegarde.mesuresAEffacer),
    mesuresEnvoyeesA: typeof sauvegarde.mesuresEnvoyeesA === 'string' ? sauvegarde.mesuresEnvoyeesA : undefined,
    // La routine du soir : une sauvegarde d'avant n'en a pas, une abîmée perd
    // seulement ce qui ne se lit plus. Elle reste sur ce téléphone.
    routineSoir: lireRoutineSoir(sauvegarde.routineSoir),
    // « J'ai mal à cet exercice » : une sauvegarde d'avant n'en a pas, une
    // abîmée perd seulement celles qui ne se lisent plus. Celles d'avant le 13
    // octobre 2026 restent à la personne du téléphone ; celles de l'autre sont
    // à part.
    douleurs: douleursLues(sauvegarde.douleurs),
    douleursAutre: douleursLues(sauvegarde.douleursAutre),
  };
};

/** Les douleurs relues ; aucune, pas de champ. */
function douleursLues(brut: unknown): EntrainementState['douleurs'] {
  const douleurs = lireDouleurs(brut);
  return Object.keys(douleurs).length > 0 ? douleurs : undefined;
}

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
