// La routine du soir : dix minutes au plus, tous les soirs, au calme, en quatre
// courtes parties — un gainage (≈ 3 min), de la mobilité pour le jiu-jitsu
// (≈ 2 min), le cou (≈ 1 min 15), deux ou trois étirements (≈ 3 min) — qu'on peut
// chacune éteindre. Ce n'est pas l'entraînement : les étirements de fin de
// séance, eux, sont ceux des muscles qu'on vient de travailler. Ici, c'est ce
// qui se fait tous les jours, séance ou pas.
//
// Ce fichier est pur (aucun React) : les listes, les étapes que la routine
// guidée déroule, leur durée, et le suivi léger des soirs faits. Ce suivi reste
// sur le téléphone, hors de l'historique et des statistiques : il ne part
// jamais vers le serveur.
import type { Exercice, PartieRoutine, Personne, RoutineSoirLocale } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { EXERCICES_ETIREMENTS } from '../data/etirements';
import { CHANGER_DE_COTE_SEC } from './generateurSeance';
import { aEviterPar, depuisIso, isoDate } from './programmeMois';

// ------------------------------------------------------------- Durées

/** Dix minutes au plus, toute la routine allumée : « pas plus, sinon je ne la
 *  ferai pas ». Les listes de départ y tiennent (un test le vérifie) ; une
 *  liste retouchée qui dépasse le dit à l'écran (`depasseLeMaximum`). */
export const DUREE_MAX_SEC = 10 * 60;

/** Une position tenue des deux côtés à la fois, ou sans côté : 45 s. */
export const TENUE_SEC = 45;
/** Une position d'un seul côté : 30 s de chaque côté, droit puis gauche. */
export const TENUE_PAR_COTE_SEC = 30;
/** Pour changer de côté, les mêmes 5 s que la séance guidée
 *  (`CHANGER_DE_COTE_SEC`) : se tourner, se replacer ; « +5 s » en redonne. */
export const CHANGEMENT_DE_COTE_SEC = CHANGER_DE_COTE_SEC;
/** Pour se mettre en position avant chaque étirement : on regarde l'image, on
 *  s'allonge, on lit la consigne. « Je suis prêt » passe tout de suite. */
export const INSTALLATION_SEC = 10;
/** « +5 s » au changement de côté. */
export const PROLONGATION_SEC = 5;

/** Le gainage : des tenues courtes, 30 s (de chaque côté quand il y en a un),
 *  avec 5 s seulement pour passer de l'un à l'autre — on ne s'allonge pas, on
 *  change d'appui. */
export const TENUE_GAINAGE_SEC = 30;
export const TRANSITION_GAINAGE_SEC = 5;
/** La mobilité : 5 s entre deux mouvements, on reste au sol. Elle tient comme
 *  les étirements : 45 s, ou 30 s de chaque côté. */
export const TRANSITION_MOBILITE_SEC = 5;
/** Le cou : des tenues de 20 s, de chaque côté, en douceur — rien de forcé, et
 *  5 s entre deux, on ne bouge pas de place. */
export const TENUE_COU_SEC = 20;
export const TRANSITION_COU_SEC = 5;

/** La liste d'étirements de chacun compte de 1 à 3 étirements : la liste de
 *  départ en a trois (≈ 3 min 30). */
export const ETIREMENTS_MIN = 1;
export const ETIREMENTS_MAX = 3;

/** Les quatre parties, dans l'ordre, et leur nom. */
export const PARTIES_ROUTINE: readonly PartieRoutine[] = ['gainage', 'mobilite', 'cou', 'etirements'];
export const NOM_PARTIE: Record<PartieRoutine, string> = {
  gainage: 'Gainage',
  mobilite: 'Mobilité jiu-jitsu',
  cou: 'Cou',
  etirements: 'Étirements',
};

// ------------------------------------------------------------- Les listes de départ

/** Les étirements de départ de chacun : trois, tous au sol ou allongé (le soir,
 *  au calme) et pris dans la bibliothèque, avec leur image. La nuque a sa propre
 *  partie (`COU_DU_SOIR`).
 *
 *  Speedy — le bas du dos fatigue vite, les bandelettes ilio-tibiales sont
 *  fragiles, une jambe « lâche » parfois :
 *   - Bébé heureux : les genoux vers la poitrine, le bas du dos qui s'ouvre.
 *     Préféré à l'enfant (à genoux, genoux très pliés) et à la bascule (qui roule).
 *   - Ischio-jambiers allongé : « la version la plus sûre pour un dos sensible »,
 *     à la place de toute flexion avant debout.
 *   - Genou ramené en travers : le fessier et l'extérieur de la hanche, où
 *     s'attache la bandelette, sans rien porter sur la jambe.
 *
 *  Big Max — les genoux font mal, et son physio lui a prescrit des étirements des
 *  cuisses, des mollets et de l'arrière des cuisses. **Sa vraie liste n'est pas
 *  encore arrivée : elle remplacera celle-ci dès qu'on l'aura.** En attendant :
 *   - Mollet contre un mur : pas d'étirement de mollet allongé dans la
 *     bibliothèque, et c'est le seul qui garde le genou tendu, sans le plier ni
 *     s'y agenouiller. Seul étirement debout de la liste, d'où sa place en premier.
 *   - Quadriceps sur le côté : l'avant de la cuisse, sans tenir sur une jambe.
 *     Talon vers la fesse sans tirer, jamais jusqu'à la douleur du genou.
 *   - Ischio-jambiers allongé : l'arrière des cuisses.
 *  Pas de fente ni de position à genoux. */
export const ROUTINE_PAR_DEFAUT: Record<Personne, string[]> = {
  sebastien: ['yoga-bebe-heureux', 'etir-ischios-allonge', 'etir-genou-en-travers'],
  max: ['etir-mollet-mur', 'etir-quadriceps-cote', 'etir-ischios-allonge'],
};

/** La mobilité pour le jiu-jitsu : deux mouvements au sol, les hanches de la
 *  garde et la rotation du buste. La bibliothèque n'a ni le 90/90 ni le « livre
 *  ouvert » : on prend les entrées les plus proches, avec leur image, et l'écran
 *  dit ce qu'elles remplacent (`ROLE_MOBILITE`). Il leur faudra leurs propres
 *  dessins un jour.
 *   - Les hanches (le 90/90) : le demi-pigeon pour Speedy — la jambe de devant
 *     ouverte à angle droit, comme dans le 90/90. Pour Big Max, l'écart allongé :
 *     rien à porter sur les genoux, que le 90/90 et le pigeon tordent.
 *   - La rotation du buste (le livre ouvert) : la torsion couchée, épaules à
 *     plat, pour les deux. */
export const MOBILITE_JJB: Record<Personne, string[]> = {
  sebastien: ['yoga-demi-pigeon', 'yoga-torsion-couchee'],
  max: ['etir-ecart-allonge', 'yoga-torsion-couchee'],
};

/** Ce que remplace chaque mouvement de la mobilité, dit sous son nom. */
export const ROLE_MOBILITE: Record<string, string> = {
  'yoga-demi-pigeon': 'Hanches : le plus proche du 90/90, la jambe de devant ouverte à angle droit.',
  'etir-ecart-allonge': 'Hanches : à la place du 90/90, sans rien porter sur les genoux.',
  'yoga-torsion-couchee': 'Rotation du buste : le plus proche du « livre ouvert », épaules à plat.',
};

/** Le cou, le même pour les deux : l'inclinaison latérale (le trapèze supérieur
 *  et les scalènes) et la flexion avant (l'arrière de la nuque). Ce sont des
 *  étirements doux : la bibliothèque n'a ni isométrique ni mobilité du cou, et on
 *  ne fait pas de cercles. La main pose son poids sans tirer, jamais jusqu'à la
 *  douleur. 20 s de chaque côté — ≈ 1 min 15 en tout. */
export const COU_DU_SOIR = ['etir-nuque-inclinaison', 'etir-nuque-flexion'];

/** La consigne du cou, dite avant chaque tenue. */
export const CONSIGNE_COU = 'Tout en douceur : pas de cercles, rien de forcé, la main pose son poids sans tirer.';

/** Ce que dit l'écran de la routine sur la liste de chacun : pourquoi ces
 *  étirements-là, et ce qui n'y entre jamais. */
export const NOTE_ROUTINE: Record<Personne, string> = {
  sebastien:
    'Étirements pour le bas du dos, l’arrière des cuisses et l’extérieur de la hanche : tout au sol, jamais de flexion avant debout.',
  max: 'Étirements pour les cuisses, les mollets et l’arrière des cuisses, sans fente ni genoux très pliés. Liste provisoire : celle de votre physio la remplacera dès qu’on l’aura.',
};

/** Ce qu'on ne propose pas à chacun quand il change un étirement : ce qui
 *  contredit ce qu'on sait de lui. Les listes de départ n'y touchent pas.
 *  - Speedy : jamais de flexion avant debout (le dos fatigue), ni d'équilibre
 *    sur une jambe (l'une d'elles lâche parfois).
 *  - Big Max : jamais de fente, de squat ni de position à genoux ou genoux très
 *    pliés (les genoux font mal) ; ni rien de ce qu'il évite partout — ventre
 *    vers le ciel en appui sur les mains ou les coudes, comme la planche
 *    inversée (`aEviterPar`, le devant des épaules). */
export const A_EVITER: Record<Personne, string[]> = {
  sebastien: [
    'etir-ischios-debout',
    'etir-ischios-jambes-croisees',
    'etir-ecart-coudes-genoux',
    'etir-haut-dos-bras-devant',
    'etir-quadriceps-debout',
  ],
  max: [
    'etir-fente-bras-leve',
    'etir-fente-laterale',
    'etir-hanche-accroupie',
    'etir-hanche-sol-jambe-tendue',
    'etir-ecart-coudes-genoux',
    'etir-soleaire-genou-flechi',
    'etir-tibia-cou-de-pied',
    'yoga-enfant',
    'yoga-coeur-fondant',
    'yoga-demi-pigeon',
    'yoga-bebe-heureux',
    ...aEviterPar('max'),
  ],
};

/** Ce que dit la feuille de choix, en bas : ce qu'elle ne propose pas. */
export const NOTE_A_EVITER: Record<Personne, string> = {
  sebastien: 'Pas proposés : les flexions avant debout et l’équilibre sur une jambe.',
  max: 'Pas proposés : les fentes, les positions à genoux ou genoux très pliés, et les appuis sur les mains derrière soi (planche inversée).',
};

/** Les postures de yoga qu'on peut choisir pour le soir : au sol, calmes. Les
 *  autres (debout, en équilibre, sur les mains, flexions avant profondes) ne
 *  sont pas des étirements du soir. */
export const YOGA_DU_SOIR = [
  'yoga-chat',
  'yoga-vache',
  'yoga-enfant',
  'yoga-coeur-fondant',
  'yoga-angle-lie',
  'yoga-demi-seigneur-poissons',
  'yoga-aisee',
  'yoga-bebe-heureux',
  'yoga-angle-lie-couche',
  'yoga-main-gros-orteil-couche',
  'yoga-torsion-couchee',
  'yoga-demi-pigeon',
  'yoga-jambes-au-mur',
  'yoga-cadavre',
];

/** Un exercice qu'on peut mettre dans la routine : un étirement ou une
 *  posture de yoga de la bibliothèque. */
const estUnEtirement = (id: unknown): id is string => {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(EXERCICES_PAR_ID, id)) return false;
  const famille = EXERCICES_PAR_ID[id].famille;
  return famille === 'etirement' || famille === 'yoga';
};

/** Les étirements qu'on peut choisir pour la routine d'une personne : ceux du
 *  poster qui se font à la maison, sans marche ni barre, et les postures de
 *  yoga du soir — moins ce qu'elle doit éviter, et ce que les autres parties de
 *  sa routine font déjà (le gainage, la mobilité, le cou). */
export function candidatsRoutine(personne: Personne): Exercice[] {
  const ecartes = new Set([...A_EVITER[personne], ...GAINAGE_DU_SOIR, ...MOBILITE_JJB[personne], ...COU_DU_SOIR]);
  const etirements = EXERCICES_ETIREMENTS.filter((e) => e.materiel === 'aucun' || e.materiel === 'tapis');
  const yoga = YOGA_DU_SOIR.map((id) => EXERCICES_PAR_ID[id]).filter((e): e is Exercice => e !== undefined);
  return [...etirements, ...yoga].filter((e) => !ecartes.has(e.id));
}

// ------------------------------------------------------------- Le gainage

/** La consigne du gainage, dite avant chaque tenue. */
export const CONSIGNE_GAINAGE = 'Tenues courtes, dos neutre, on arrête si le dos fait mal.';

/** Le gainage du soir, le même pour les deux, dans l'ordre : la planche, la
 *  planche latérale (un côté, 5 s pour changer de côté, l'autre), le chien
 *  d'arrêt (un bras et la jambe opposée, d'un côté puis de l'autre). Des tenues
 *  de 30 s, sans bouger : on protège le dos, pas de répétitions.
 *
 *  Le chien d'arrêt n'existe pas seul dans la bibliothèque : le seul dessin est
 *  celui du « rowing chien d'arrêt » (`bird-dog-row`), sur un banc et avec un
 *  haltère. On en garde l'image — la jambe tendue dans le prolongement du dos,
 *  c'est bien la position —, avec le nom, la position et les consignes du chien
 *  d'arrêt au sol, sans charge (`CHIEN_D_ARRET`). Il lui faudra son propre
 *  dessin un jour. */
export const GAINAGE_DU_SOIR = ['yoga-planche', 'yoga-planche-laterale', 'bird-dog-row'];

/** Le chien d'arrêt au sol : ce que l'écran en dit, par-dessus la fiche du
 *  rowing dont il emprunte le dessin. */
const CHIEN_D_ARRET: Partial<Exercice> = {
  nomFr: 'Chien d’arrêt',
  nomEn: 'Bird Dog',
  muscles: 'Fessiers, lombaires, abdominaux, épaules',
  materiel: 'tapis',
  cotes: 'unilateral',
  unite: 'secondes',
  position: 'À quatre pattes, un bras et la jambe opposée tendus',
  pointsAttention: [
    'À quatre pattes, mains sous les épaules, genoux sous les hanches ; un tapis sous les genoux.',
    'Côté droit : bras droit et jambe gauche tendus, dans le prolongement du dos. Côté gauche : l’inverse.',
    'Le bassin et les épaules restent à plat : ni penché, ni dos creusé.',
    'Tenir sans bouger, en respirant ; la main et le pied posés ne glissent pas.',
  ],
};

/** Un exercice qu'on peut déjà montrer dans la routine : une fiche de la
 *  bibliothèque. */
const estUnExercice = (id: string): boolean => Object.prototype.hasOwnProperty.call(EXERCICES_PAR_ID, id);

/** L'exercice tel que la routine l'affiche : la fiche de la bibliothèque, sauf
 *  pour le chien d'arrêt, qui garde le dessin du rowing et prend ses propres
 *  mots. */
export function exerciceRoutine(id: string): Exercice {
  const exercice = EXERCICES_PAR_ID[id];
  return id === 'bird-dog-row' ? { ...exercice, ...CHIEN_D_ARRET } : exercice;
}

// ------------------------------------------------------------- La liste de chacun

/** Une liste relue : que des étirements connus, sans doublon, huit au plus. */
function listeLue(brut: unknown): string[] {
  if (!Array.isArray(brut)) return [];
  const vus: string[] = [];
  for (const id of brut) if (estUnEtirement(id) && !vus.includes(id)) vus.push(id);
  return vus.slice(0, ETIREMENTS_MAX);
}

/** La liste d'une personne : celle qu'elle a choisie, sinon celle de départ. */
export function routineDe(personne: Personne, routine?: RoutineSoirLocale): string[] {
  const choisie = listeLue(routine?.listes?.[personne]);
  return choisie.length >= ETIREMENTS_MIN ? choisie : [...ROUTINE_PAR_DEFAUT[personne]];
}

/** La liste a été changée à la main : « Remettre la liste de départ » a du sens. */
export function listeModifiee(personne: Personne, routine?: RoutineSoirLocale): boolean {
  const choisie = routine?.listes?.[personne];
  if (!choisie) return false;
  const actuelle = routineDe(personne, routine);
  const depart = ROUTINE_PAR_DEFAUT[personne];
  return actuelle.length !== depart.length || actuelle.some((id, i) => id !== depart[i]);
}

/** La routine avec une nouvelle liste pour cette personne. Une liste égale à
 *  celle de départ n'est pas gardée : la liste de départ pourra évoluer
 *  (celle du physio de Big Max) sans que son téléphone en garde l'ancienne. */
export function avecListe(personne: Personne, routine: RoutineSoirLocale | undefined, liste: string[]): RoutineSoirLocale {
  const listes = { ...routine?.listes };
  const propre = listeLue(liste);
  const depart = ROUTINE_PAR_DEFAUT[personne];
  if (propre.length < ETIREMENTS_MIN || (propre.length === depart.length && propre.every((id, i) => id === depart[i]))) {
    delete listes[personne];
  } else {
    listes[personne] = propre;
  }
  return { ...routine, listes };
}

/** La routine remise à la liste de départ de cette personne. */
export const avecListeDeDepart = (personne: Personne, routine?: RoutineSoirLocale): RoutineSoirLocale =>
  avecListe(personne, routine, ROUTINE_PAR_DEFAUT[personne]);

/** Change l'étirement à cette place. Refusé (liste inchangée) s'il est inconnu
 *  ou déjà dans la liste. */
export function remplacerEtirement(liste: string[], index: number, id: string): string[] {
  if (index < 0 || index >= liste.length || !estUnEtirement(id) || liste.includes(id)) return liste;
  return liste.map((ancien, i) => (i === index ? id : ancien));
}

/** Monte (-1) ou descend (+1) l'étirement de cette place. */
export function deplacerEtirement(liste: string[], index: number, sens: -1 | 1): string[] {
  const cible = index + sens;
  if (index < 0 || index >= liste.length || cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  return copie;
}

/** Retire l'étirement de cette place, sans jamais vider la liste. */
export function retirerEtirement(liste: string[], index: number): string[] {
  if (liste.length <= ETIREMENTS_MIN || index < 0 || index >= liste.length) return liste;
  return liste.filter((_, i) => i !== index);
}

/** Ajoute un étirement à la fin, dans la limite de huit ; refusé s'il est
 *  inconnu ou déjà là. */
export function ajouterEtirement(liste: string[], id: string): string[] {
  if (liste.length >= ETIREMENTS_MAX || !estUnEtirement(id) || liste.includes(id)) return liste;
  return [...liste, id];
}

// ------------------------------------------------------------- Les étapes

/** Ce que portent toutes les étapes d'un exercice : sa partie, et son rang
 *  dans la partie (`rang` sur `total`). */
interface RangRoutine {
  exerciceId: string;
  partie: PartieRoutine;
  rang: number;
  total: number;
}

/** Une étape de la routine guidée : s'installer, tenir (un côté, ou les deux à
 *  la fois), changer de côté, puis la fin. */
export type EtapeRoutine =
  | (RangRoutine & { type: 'installation'; dureeSec: number })
  | (RangRoutine & {
      type: 'tenue';
      dureeSec: number;
      /** Un exercice d'un seul côté : le côté en cours ; absent, les deux côtés à la fois. */
      cote?: 'droit' | 'gauche';
    })
  | (RangRoutine & { type: 'changement'; dureeSec: number })
  | { type: 'fin'; dureeSec: 0 };

/** Ce que contient la routine d'un soir : les exercices de chaque partie, dans
 *  l'ordre. Une partie éteinte est vide. */
export type PartiesRoutine = Record<PartieRoutine, string[]>;

/** Le temps de chaque partie : pour s'installer, pour tenir des deux côtés à la
 *  fois, pour tenir de chaque côté. */
const TEMPS_PAR_PARTIE: Record<PartieRoutine, { installationSec: number; deuxCotesSec: number; parCoteSec: number }> = {
  gainage: { installationSec: TRANSITION_GAINAGE_SEC, deuxCotesSec: TENUE_GAINAGE_SEC, parCoteSec: TENUE_GAINAGE_SEC },
  mobilite: { installationSec: TRANSITION_MOBILITE_SEC, deuxCotesSec: TENUE_SEC, parCoteSec: TENUE_PAR_COTE_SEC },
  cou: { installationSec: TRANSITION_COU_SEC, deuxCotesSec: TENUE_COU_SEC, parCoteSec: TENUE_COU_SEC },
  etirements: { installationSec: INSTALLATION_SEC, deuxCotesSec: TENUE_SEC, parCoteSec: TENUE_PAR_COTE_SEC },
};

/** Les étapes d'une partie : pour chaque exercice, s'installer ; puis tenir, ou,
 *  d'un seul côté, tenir à droite, 5 s pour changer de côté, tenir à gauche. */
function etapesDePartie(partie: PartieRoutine, ids: readonly string[]): EtapeRoutine[] {
  const { installationSec, deuxCotesSec, parCoteSec } = TEMPS_PAR_PARTIE[partie];
  const connus = ids.filter(estUnExercice);
  const etapes: EtapeRoutine[] = [];
  connus.forEach((exerciceId, i) => {
    const base = { exerciceId, partie, rang: i + 1, total: connus.length };
    etapes.push({ type: 'installation', ...base, dureeSec: installationSec });
    if (exerciceRoutine(exerciceId).cotes === 'unilateral') {
      etapes.push({ type: 'tenue', ...base, cote: 'droit', dureeSec: parCoteSec });
      etapes.push({ type: 'changement', ...base, dureeSec: CHANGEMENT_DE_COTE_SEC });
      etapes.push({ type: 'tenue', ...base, cote: 'gauche', dureeSec: parCoteSec });
    } else {
      etapes.push({ type: 'tenue', ...base, dureeSec: deuxCotesSec });
    }
  });
  return etapes;
}

/** Les étapes de la routine : le gainage, la mobilité, les étirements — ceux des
 *  parties allumées —, puis la fin. Un identifiant inconnu est sauté. */
export function etapesRoutine(parties: PartiesRoutine): EtapeRoutine[] {
  return [
    ...PARTIES_ROUTINE.flatMap((partie) => etapesDePartie(partie, parties[partie])),
    { type: 'fin', dureeSec: 0 },
  ];
}

const sommeDesDurees = (etapes: readonly EtapeRoutine[]): number => etapes.reduce((total, e) => total + e.dureeSec, 0);

/** La durée de la routine, en secondes. */
export const dureeRoutineSec = (parties: PartiesRoutine): number => sommeDesDurees(etapesRoutine(parties));

/** La durée d'une partie, en secondes, avec les exercices qu'on lui donne. */
export const dureePartieSec = (partie: PartieRoutine, ids: readonly string[]): number =>
  sommeDesDurees(etapesDePartie(partie, ids));

/** La routine, trop longue : plus de dix minutes. */
export const depasseLeMaximum = (parties: PartiesRoutine): boolean => dureeRoutineSec(parties) > DUREE_MAX_SEC;

/** « 8 min » : une durée arrondie à la minute. */
export const libelleDuree = (sec: number): string => `${Math.max(1, Math.round(sec / 60))} min`;

/** « 1 min 15 », « 3 min » : une durée arrondie au quart de minute, pour dire la
 *  durée d'une partie sans l'arrondir à la minute. */
export function libelleDureeFine(sec: number): string {
  const quarts = Math.max(1, Math.round(sec / 15));
  const minutes = Math.floor(quarts / 4);
  const secondes = (quarts % 4) * 15;
  if (minutes === 0) return `${secondes} s`;
  return secondes === 0 ? `${minutes} min` : `${minutes} min ${secondes}`;
}

/** « 10 min » : la durée de la routine, pour la carte de l'accueil. */
export const libelleDureeRoutine = (parties: PartiesRoutine): string => libelleDuree(dureeRoutineSec(parties));

/** « Gainage, mobilité, cou et 3 étirements » : ce que contient la routine. */
export function resumeRoutine(parties: PartiesRoutine): string {
  const morceaux = PARTIES_ROUTINE.filter((partie) => parties[partie].length > 0).map((partie) =>
    partie === 'gainage'
      ? 'gainage'
      : partie === 'mobilite'
        ? 'mobilité'
        : partie === 'cou'
          ? 'cou'
          : `${parties.etirements.length} étirement${parties.etirements.length > 1 ? 's' : ''}`,
  );
  const phrase = morceaux.length > 1 ? `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}` : morceaux.join('');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** Ce que dit la liste d'un exercice : « 30 s par côté » ou « 45 s » (« 30 s »
 *  au gainage). */
export const libelleTenue = (exercice: Pick<Exercice, 'cotes'>, partie: PartieRoutine = 'etirements'): string => {
  const { deuxCotesSec, parCoteSec } = TEMPS_PAR_PARTIE[partie];
  return exercice.cotes === 'unilateral' ? `${parCoteSec} s par côté` : `${deuxCotesSec} s`;
};

/** Le début de l'exercice auquel appartient l'étape (son installation). */
export function indexDebutEtirement(etapes: readonly EtapeRoutine[], index: number): number {
  let i = Math.max(0, Math.min(index, etapes.length - 1));
  while (i > 0 && etapes[i].type !== 'installation') i -= 1;
  return i;
}

/** « Précédent » : le début de l'exercice en cours ; si l'on y est déjà, le
 *  début de celui d'avant. */
export function indexPrecedent(etapes: readonly EtapeRoutine[], index: number): number {
  const debut = indexDebutEtirement(etapes, index);
  if (index > debut) return debut;
  return debut > 0 ? indexDebutEtirement(etapes, debut - 1) : 0;
}

// ------------------------------------------------------------- Les soirs faits

/** Avant 4 h du matin, on est encore dans le soir d'hier : une routine faite à
 *  minuit et demi compte pour la veille. */
export const HEURE_FIN_DE_SOIREE = 4;
/** Les soirs gardés : à peu près une année, au plus récent. */
export const SOIRS_GARDES = 400;

/** Le soir d'un instant : « AAAA-MM-JJ », à l'heure du téléphone. */
export const soirDe = (date: Date): string => isoDate(new Date(date.getTime() - HEURE_FIN_DE_SOIREE * 3_600_000));

const estUnSoir = (jour: unknown): jour is string =>
  typeof jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(jour) && isoDate(depuisIso(jour)) === jour;

/** Les soirs relus : des dates valides, sans doublon, du plus ancien au plus récent. */
function soirsLus(brut: unknown): string[] {
  if (!Array.isArray(brut)) return [];
  return [...new Set(brut.filter(estUnSoir))].sort().slice(-SOIRS_GARDES);
}

/** Relit la routine sauvegardée sur ce téléphone. Une sauvegarde d'avant son
 *  arrivée, ou abîmée, ou sans rien à garder (ni liste choisie, ni soir fait,
 *  aucune partie éteinte) donne `undefined` : les listes de départ, aucun soir
 *  fait, et rien ne bloque le chargement. */
export function lireRoutineSoir(brut: unknown): RoutineSoirLocale | undefined {
  const source =
    typeof brut === 'object' && brut !== null ? (brut as { listes?: unknown; soirs?: unknown; eteintes?: unknown }) : {};
  const listes: Partial<Record<Personne, string[]>> = {};
  if (typeof source.listes === 'object' && source.listes !== null) {
    const lues = source.listes as Record<string, unknown>;
    for (const personne of ['sebastien', 'max'] as const) {
      const liste = listeLue(lues[personne]);
      if (liste.length >= ETIREMENTS_MIN) listes[personne] = liste;
    }
  }
  const soirs = soirsLus(source.soirs);
  // Les parties éteintes : que des parties connues, et jamais toutes.
  const eteintes = Array.isArray(source.eteintes)
    ? PARTIES_ROUTINE.filter((partie) => (source.eteintes as unknown[]).includes(partie))
    : [];
  const eteintesGardees = eteintes.length < PARTIES_ROUTINE.length ? eteintes : [];
  if (Object.keys(listes).length === 0 && soirs.length === 0 && eteintesGardees.length === 0) return undefined;
  return { listes, soirs, ...(eteintesGardees.length > 0 ? { eteintes: eteintesGardees } : {}) };
}

/** Les parties allumées : toutes, sauf celles qu'on a éteintes. */
export const partiesAllumees = (routine: RoutineSoirLocale | undefined): PartieRoutine[] =>
  PARTIES_ROUTINE.filter((partie) => !routine?.eteintes?.includes(partie));

export const partieAllumee = (routine: RoutineSoirLocale | undefined, partie: PartieRoutine): boolean =>
  partiesAllumees(routine).includes(partie);

/** La routine avec une partie allumée ou éteinte. Allumées, les trois, c'est
 *  l'état normal : rien n'est gardé. La dernière partie allumée ne s'éteint pas
 *  — une routine vide n'a pas de sens. */
export function avecPartie(routine: RoutineSoirLocale | undefined, partie: PartieRoutine, allumee: boolean): RoutineSoirLocale {
  const actuelles = partiesAllumees(routine);
  const suivantes = allumee ? [...new Set([...actuelles, partie])] : actuelles.filter((p) => p !== partie);
  if (suivantes.length === 0) return { ...routine };
  const eteintes = PARTIES_ROUTINE.filter((p) => !suivantes.includes(p));
  const suivante = { ...routine };
  if (eteintes.length === 0) delete suivante.eteintes;
  else suivante.eteintes = [...eteintes];
  return suivante;
}

/** Ce que contient la routine de cette personne : la liste de chaque partie
 *  allumée, vide pour une partie éteinte. */
export function partiesDe(personne: Personne, routine?: RoutineSoirLocale): PartiesRoutine {
  const allumees = partiesAllumees(routine);
  return {
    gainage: allumees.includes('gainage') ? [...GAINAGE_DU_SOIR] : [],
    mobilite: allumees.includes('mobilite') ? [...MOBILITE_JJB[personne]] : [],
    cou: allumees.includes('cou') ? [...COU_DU_SOIR] : [],
    etirements: allumees.includes('etirements') ? routineDe(personne, routine) : [],
  };
}

/** Ce soir-là, la routine a été faite. */
export const soirFait = (routine: RoutineSoirLocale | undefined, soir: string): boolean =>
  (routine?.soirs ?? []).includes(soir);

/** La routine avec ce soir en plus. Marquer deux fois ne change rien. */
export function avecSoir(routine: RoutineSoirLocale | undefined, soir: string): RoutineSoirLocale {
  if (!estUnSoir(soir)) return { ...routine };
  return { ...routine, soirs: soirsLus([...(routine?.soirs ?? []), soir]) };
}

/** La routine sans ce soir : pour un appui par erreur. */
export const sansSoir = (routine: RoutineSoirLocale | undefined, soir: string): RoutineSoirLocale => ({
  ...routine,
  soirs: (routine?.soirs ?? []).filter((s) => s !== soir),
});

export interface JourDeRoutine {
  /** AAAA-MM-JJ */
  soir: string;
  faite: boolean;
  /** C'est ce soir. */
  ceSoir: boolean;
  /** La lettre du jour de la semaine : L, M, M, J, V, S, D. */
  initiale: string;
}

const INITIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/** Les derniers soirs, le plus ancien d'abord et ce soir en dernier : sept par
 *  défaut. */
export function derniersSoirs(routine: RoutineSoirLocale | undefined, maintenant: Date, nombre = 7): JourDeRoutine[] {
  const ceSoir = depuisIso(soirDe(maintenant));
  const jours: JourDeRoutine[] = [];
  for (let reculer = nombre - 1; reculer >= 0; reculer -= 1) {
    const jour = new Date(ceSoir.getFullYear(), ceSoir.getMonth(), ceSoir.getDate() - reculer);
    const soir = isoDate(jour);
    jours.push({ soir, faite: soirFait(routine, soir), ceSoir: reculer === 0, initiale: INITIALES[jour.getDay()] });
  }
  return jours;
}

/** Combien des 7 derniers soirs, ce soir compris. */
export const soirsSurSept = (routine: RoutineSoirLocale | undefined, maintenant: Date): number =>
  derniersSoirs(routine, maintenant).filter((jour) => jour.faite).length;

/** « 5 soirs sur 7 », « 1 soir sur 7 », « 0 soir sur 7 ». */
export const libelleSoirsSurSept = (faits: number): string => `${faits} soir${faits > 1 ? 's' : ''} sur 7`;

/** Les soirs de suite jusqu'à ce soir. Tant que ce soir n'est pas fait, la série
 *  d'hier tient encore : elle ne se casse que la soirée passée sans routine. */
export function serieDeSoirs(routine: RoutineSoirLocale | undefined, maintenant: Date): number {
  const ceSoir = depuisIso(soirDe(maintenant));
  let reculer = soirFait(routine, isoDate(ceSoir)) ? 0 : 1;
  let serie = 0;
  for (;;) {
    const jour = new Date(ceSoir.getFullYear(), ceSoir.getMonth(), ceSoir.getDate() - reculer);
    if (!soirFait(routine, isoDate(jour))) return serie;
    serie += 1;
    reculer += 1;
  }
}
