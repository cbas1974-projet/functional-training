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
    tempo: { monteeSec: 5, descenteSec: 5 },
    nom: '5 s / 5 s',
    description: 'Recommandé : lent, sans rebond, protège tendons et ligaments.',
  },
  {
    tempo: { monteeSec: 3, descenteSec: 3 },
    nom: '3 s / 3 s',
    description: 'Contrôlé, un peu plus dynamique.',
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
  { valeur: 8, nom: '8 reps', description: 'Recommandé au tempo lent : 80 s sous tension, charge un peu plus lourde.' },
  { valeur: 6, nom: '6 reps', description: 'Plus lourd, séries courtes.' },
  { valeur: 9, nom: '9 reps', description: 'Le compromis entre 8 et 10.' },
  { valeur: 10, nom: '10 reps', description: '100 s sous tension au tempo 5 s / 5 s : charge plus légère.' },
  { valeur: 12, nom: '12 reps', description: 'Endurance musculaire, charge légère.' },
  { valeur: null, nom: 'Auto', description: 'L’appli choisit selon le niveau et la durée.' },
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
  tempo: { monteeSec: 5, descenteSec: 5 },
  materiels: ['halteres'],
  explosifs: false,
  seriesParExercice: 3,
  repsParSerie: 8,
  unitePoids: 'lb',
  guideVisuel: 'les-deux',
};
