import type {
  FormatSeance,
  GuideVisuel,
  Materiel,
  Niveau,
  ParametresSeance,
  Tempo,
  UnitePoids,
  Zone,
} from '../types';

/** Toutes les zones, dans l'ordre d'alternance d'une séance corps entier. */
export const TOUTES_LES_ZONES: Zone[] = ['bas', 'haut', 'dos', 'gainage', 'complet'];

/** Durées de séance proposées, en minutes. */
export const DUREES_MINUTES = [5, 10, 15, 20, 30, 45] as const;

/** Tempos proposés : secondes de montée / secondes de descente. */
export const TEMPOS: { tempo: Tempo; nom: string; description: string }[] = [
  {
    tempo: { monteeSec: 4, descenteSec: 4 },
    nom: '4 s / 4 s',
    description:
      'Recommandé : assez lent pour charger le tendon, assez court pour garder une charge sérieuse. Une série de 6 dure 48 s.',
  },
  {
    tempo: { monteeSec: 5, descenteSec: 5 },
    nom: '5 s / 5 s',
    description:
      'Très lent. Oblige à alléger : le temps sous tension monte, la contrainte sur le tendon descend.',
  },
  {
    tempo: { monteeSec: 3, descenteSec: 3 },
    nom: '3 s / 3 s',
    description: 'Le tempo des protocoles cliniques pour le tendon, avec une charge lourde.',
  },
  {
    tempo: { monteeSec: 2, descenteSec: 4 },
    nom: '2 s / 4 s',
    description: 'Montée normale, descente lente (excentrique).',
  },
];

export const NIVEAUX: { id: Niveau; nom: string; description: string }[] = [
  { id: 'debutant', nom: 'Débutant', description: 'Reprise ou découverte : moins de séries, plus de repos.' },
  { id: 'intermediaire', nom: 'Intermédiaire', description: 'Pratique régulière depuis quelques mois.' },
  { id: 'avance', nom: 'Avancé', description: 'Bonne technique, volume plus élevé.' },
];

export const FORMATS: { id: FormatSeance; nom: string; description: string }[] = [
  { id: 'series', nom: 'Séries', description: 'Chaque exercice en plusieurs séries, repos chronométré entre les séries.' },
  {
    id: 'superset',
    nom: 'Superset',
    description:
      'Les exercices vont deux par deux, en alternance : le repos de l’un est le travail de l’autre. Le meilleur moyen de tenir plus d’exercices dans la même durée au tempo lent.',
  },
  { id: 'circuit', nom: 'Circuit', description: 'Enchaînement de stations au temps, plusieurs tours.' },
  { id: 'mixte', nom: 'Mixte', description: 'Séries pour la force, puis un court circuit pour finir.' },
];

export const SERIES_PAR_EXERCICE: { valeur: 2 | 3 | 4 | null; nom: string; description: string }[] = [
  { valeur: 3, nom: '3 séries', description: 'Recommandé : le volume de référence, l’appli ajuste le nombre d’exercices.' },
  { valeur: 2, nom: '2 séries', description: 'Plus d’exercices différents dans le même temps.' },
  { valeur: 4, nom: '4 séries', description: 'Moins d’exercices, plus de volume sur chacun.' },
  { valeur: null, nom: 'Auto', description: 'L’appli choisit selon la durée disponible.' },
];

export const REPS_PAR_SERIE: { valeur: 6 | 8 | 9 | 10 | 12 | null; nom: string; description: string }[] = [
  {
    valeur: 6,
    nom: '6 reps',
    description:
      'Recommandé : séries courtes et charge plus lourde. C’est la charge qui construit le tendon, pas le nombre de répétitions.',
  },
  { valeur: 8, nom: '8 reps', description: 'Un peu plus de volume, charge moyenne.' },
  { valeur: 9, nom: '9 reps', description: 'Le compromis entre 8 et 10.' },
  { valeur: 10, nom: '10 reps', description: 'Plus de temps sous tension, charge plus légère.' },
  { valeur: 12, nom: '12 reps', description: 'Endurance musculaire, charge légère.' },
  { valeur: null, nom: 'Auto', description: 'L’appli choisit selon le niveau et la durée.' },
];

/** Nombre d'exercices enchaînés au format superset. Plus l'enchaînement est
 *  large, plus chaque muscle récupère longtemps — et plus il tient
 *  d'exercices dans la même durée. */
export const TAILLES_ROTATION: { valeur: 2 | 3 | 4 | undefined; nom: string; description: string }[] = [
  {
    valeur: undefined,
    nom: 'Auto',
    description: 'Recommandé : l’appli prend l’enchaînement qui fait tenir le plus d’exercices.',
  },
  { valeur: 2, nom: 'Paires', description: 'Deux exercices en alternance : le superset classique.' },
  { valeur: 3, nom: 'Trios', description: 'Trois exercices en rotation : chaque muscle souffle plus longtemps.' },
  {
    valeur: 4,
    nom: 'Rotation de 4',
    description: 'Quatre exercices en rotation. Le plus dense, mais il faut quatre charges prêtes.',
  },
];

/** Matériel que l'utilisateur peut déclarer. Les exercices sans matériel
 *  sont toujours disponibles ; les haltères sont la base de la bibliothèque
 *  actuelle et restent cochés par défaut. */
export const MATERIELS_DECLARABLES: { id: Materiel; nom: string; precision: string }[] = [
  { id: 'halteres', nom: 'Haltères', precision: 'La base de la bibliothèque actuelle.' },
  { id: 'banc', nom: 'Banc', precision: 'Développés, écartés, pull-over, rowing incliné.' },
  { id: 'step', nom: 'Marche ou step', precision: 'Montées sur marche.' },
  { id: 'elastique', nom: 'Bande élastique', precision: 'À venir.' },
  { id: 'swissball', nom: 'Swiss ball', precision: 'À venir.' },
  { id: 'tapis', nom: 'Tapis', precision: 'Confort au sol pour le gainage et la mobilité.' },
];

export const UNITES_POIDS: { id: UnitePoids; nom: string; description: string }[] = [
  { id: 'lb', nom: 'Livres (lb)', description: 'Le marquage des haltères vendus ici.' },
  { id: 'kg', nom: 'Kilogrammes (kg)', description: 'Pour du matériel marqué en kilos.' },
];

export const GUIDES_VISUELS: { id: GuideVisuel; nom: string; description: string }[] = [
  {
    id: 'les-deux',
    nom: 'Bille et chiffre',
    description: 'Recommandé : la bille monte et descend au tempo, les secondes sont inscrites dedans.',
  },
  { id: 'bille', nom: 'Bille seule', description: 'Rien à lire : on suit la bille du coin de l’œil.' },
  { id: 'chiffre', nom: 'Chiffre seul', description: 'Le décompte des secondes en grand.' },
];

export const PARAMETRES_PAR_DEFAUT: ParametresSeance = {
  dureeMinutes: 20,
  zones: [...TOUTES_LES_ZONES],
  niveau: 'intermediaire',
  format: 'series',
  tempo: { monteeSec: 4, descenteSec: 4 },
  materiels: ['halteres'],
  explosifs: false,
  seriesParExercice: 3,
  repsParSerie: 6,
  unitePoids: 'lb',
  guideVisuel: 'les-deux',
};
