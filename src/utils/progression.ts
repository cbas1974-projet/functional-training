// La progression : les séries de points des trois graphiques — la charge d'un
// exercice, la charge totale d'une séance, le poids de corps — et ce qu'il faut
// pour les dessiner : de 3 à 5 lignes de repère aux valeurs rondes, des dates
// lisibles pour l'axe du bas. Rien n'est stocké : tout se recalcule à partir de
// l'historique et des mesures.
import type { ExerciceRealise, Mesure, SeanceRealisee, UnitePoids } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { SUFFIXE_UNITE, chargeTotale, convertirPoids, convertirPoidsCorps, poidsDe, uniteDeSeance } from './statistiques';
import { trierMesures } from './mesures';

/** Un point d'une courbe : un instant, une valeur. */
export interface PointCourbe {
  /** L'instant, en millisecondes. */
  t: number;
  valeur: number;
  /** Un mot de plus pour la lecture : le nom de la séance, « Jour 1 »… */
  note?: string;
}

// ------------------------------------------------------------- Les dates

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 5 oct. 2026 », « 1er oct. 2026 » ; sans l'année si on ne la veut pas. */
export function libelleJour(instant: number | Date, avecAnnee = true): string {
  const date = new Date(instant);
  const jour = date.getDate() === 1 ? '1er' : String(date.getDate());
  return `${jour} ${MOIS_COURTS[date.getMonth()]}${avecAnnee ? ` ${date.getFullYear()}` : ''}`;
}

/** Midi, à l'heure du téléphone, d'un jour AAAA-MM-JJ : à cette heure-là,
 *  l'heure d'été ne le fait pas changer de jour. */
export function instantDuJour(jour: string): number {
  const [annee, mois, j] = jour.split('-').map(Number);
  return new Date(annee, mois - 1, j, 12).getTime();
}

/** Un jour AAAA-MM-JJ écrit à la française : « 5 oct. 2026 ». */
export const libelleJourIso = (jour: string, avecAnnee = true): string => libelleJour(instantDuJour(jour), avecAnnee);

/** Un nombre à la française : un espace entre les milliers, une virgule, un vrai
 *  signe moins. Au plus `decimales` chiffres après la virgule, sans zéro de trop :
 *  182,4 mais 182. */
export function formaterNombre(valeur: number, decimales = 0): string {
  const arrondi = Number(Math.abs(valeur).toFixed(decimales));
  const [entiere, fraction] = String(arrondi).split('.');
  const groupes = entiere.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const signe = valeur < 0 && arrondi !== 0 ? '−' : '';
  return `${signe}${groupes}${fraction ? `,${fraction}` : ''}`;
}

// ------------------------------------------------------------- La charge d'un exercice

/** La plus lourde des séries faites d'un exercice, dans l'unité de la séance ;
 *  sinon la charge retenue pour tout l'exercice (les séances d'avant la saisie
 *  série par série) ; rien si aucune charge n'a été notée. */
function plusLourdeSerie(exo: ExerciceRealise): number | undefined {
  const faites = (exo.poidsParSerie ?? []).slice(0, exo.seriesFaites).filter((poids) => Number.isFinite(poids) && poids > 0);
  return faites.length > 0 ? Math.max(...faites) : poidsDe(exo);
}

const estConnu = (id: string) => Object.prototype.hasOwnProperty.call(EXERCICES_PAR_ID, id);

/** La charge d'un exercice au fil des séances : un point par séance, la plus
 *  lourde des séries, ramenée à l'unité courante. Les séances sans charge
 *  notée pour cet exercice, ou sans date lisible, n'ont pas de point. */
export function serieChargeExercice(
  seances: readonly SeanceRealisee[],
  exerciceId: string,
  unite: UnitePoids,
): PointCourbe[] {
  const points: PointCourbe[] = [];
  for (const seance of seances) {
    const t = Date.parse(seance.date);
    if (!Number.isFinite(t)) continue;
    let plusLourde: number | undefined;
    for (const exo of seance.exercices) {
      if (exo.exerciceId !== exerciceId || !(exo.seriesFaites > 0)) continue;
      const charge = plusLourdeSerie(exo);
      if (charge !== undefined && (plusLourde === undefined || charge > plusLourde)) plusLourde = charge;
    }
    if (plusLourde === undefined) continue;
    points.push({
      t,
      valeur: convertirPoids(plusLourde, uniteDeSeance(seance.parametres), unite),
      ...(seance.titre ? { note: seance.titre } : {}),
    });
  }
  return points.sort((a, b) => a.t - b.t);
}

/** Un exercice dont on peut tracer la charge. */
export interface ExerciceSuivi {
  exerciceId: string;
  nom: string;
  /** Le nombre de séances où une charge a été notée. */
  seances: number;
}

/** Les exercices déjà faits avec une charge notée, par ordre alphabétique : ceux
 *  qu'on propose de suivre. Un exercice que la bibliothèque ne connaît plus est
 *  laissé de côté — on ne saurait pas l'appeler par son nom. */
export function exercicesAvecCharge(seances: readonly SeanceRealisee[]): ExerciceSuivi[] {
  const compte = new Map<string, number>();
  for (const seance of seances) {
    if (!Number.isFinite(Date.parse(seance.date))) continue;
    const dansLaSeance = new Set<string>();
    for (const exo of seance.exercices) {
      if (exo.seriesFaites > 0 && estConnu(exo.exerciceId) && plusLourdeSerie(exo) !== undefined) {
        dansLaSeance.add(exo.exerciceId);
      }
    }
    for (const id of dansLaSeance) compte.set(id, (compte.get(id) ?? 0) + 1);
  }
  return [...compte]
    .map(([exerciceId, nombre]) => ({ exerciceId, nom: EXERCICES_PAR_ID[exerciceId].nomFr, seances: nombre }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Les exercices de plusieurs listes (les miens, ceux de l'autre) en une seule,
 *  par ordre alphabétique : un exercice fait par les deux n'y figure qu'une fois. */
export function reunirExercices(...listes: readonly (readonly ExerciceSuivi[])[]): ExerciceSuivi[] {
  const reunis = new Map<string, ExerciceSuivi>();
  for (const exercice of listes.flat()) {
    const deja = reunis.get(exercice.exerciceId);
    reunis.set(exercice.exerciceId, deja ? { ...deja, seances: deja.seances + exercice.seances } : exercice);
  }
  return [...reunis.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** L'exercice qu'on montre d'abord : celui qui compte le plus de séances — sa
 *  courbe est la plus fournie. À égalité, le premier de la liste. */
export function exerciceLePlusSuivi(exercices: readonly ExerciceSuivi[]): ExerciceSuivi | undefined {
  return exercices.reduce<ExerciceSuivi | undefined>(
    (retenu, exercice) => (retenu === undefined || exercice.seances > retenu.seances ? exercice : retenu),
    undefined,
  );
}

// ------------------------------------------------------------- Les autres séries

/** La charge totale soulevée à chaque séance (poids × répétitions, séries
 *  faites), dans l'unité courante. Une séance sans aucune charge notée n'a pas
 *  de point : zéro n'est pas une charge soulevée. */
export function serieChargeTotale(seances: readonly SeanceRealisee[], unite: UnitePoids): PointCourbe[] {
  const points: PointCourbe[] = [];
  for (const seance of seances) {
    const t = Date.parse(seance.date);
    if (!Number.isFinite(t)) continue;
    const total = chargeTotale(seance, unite);
    if (total > 0) points.push({ t, valeur: total, ...(seance.titre ? { note: seance.titre } : {}) });
  }
  return points.sort((a, b) => a.t - b.t);
}

/** Le poids de corps à chaque mesure, dans l'unité courante, au dixième près. La
 *  première mesure, le point de départ, porte la note « Jour 1 ». */
export function seriePoidsCorps(mesures: readonly Mesure[], unite: UnitePoids): PointCourbe[] {
  return trierMesures(mesures).map((mesure, rang) => ({
    t: instantDuJour(mesure.date),
    valeur: convertirPoidsCorps(mesure.poids, mesure.unitePoids, unite),
    ...(rang === 0 ? { note: 'Jour 1' } : {}),
  }));
}

/** De combien le poids a changé depuis le jour 1, dans l'unité courante. */
export function variationDePoids(mesure: Mesure, depart: Mesure, unite: UnitePoids): number {
  const maintenant = convertirPoidsCorps(mesure.poids, mesure.unitePoids, unite);
  const avant = convertirPoidsCorps(depart.poids, depart.unitePoids, unite);
  return Math.round((maintenant - avant) * 10) / 10;
}

/** « −4 lb depuis le jour 1 », « +2,5 kg depuis le jour 1 », « même poids que
 *  le jour 1 ». */
export function phraseVariation(variation: number, unite: UnitePoids): string {
  if (variation === 0) return 'même poids que le jour 1';
  const signe = variation > 0 ? '+' : '−';
  return `${signe}${formaterNombre(Math.abs(variation), 1)} ${SUFFIXE_UNITE[unite]} depuis le jour 1`;
}

// ------------------------------------------------------------- L'échelle verticale

export interface EchelleVerticale {
  /** La valeur de la ligne du bas et celle de la ligne du haut. */
  min: number;
  max: number;
  /** De 3 à 5 lignes de repère, aux valeurs rondes, du bas vers le haut. */
  reperes: number[];
  /** Chiffres après la virgule pour écrire un repère. */
  decimales: number;
}

/** Les pas qu'on accepte, avant la puissance de dix : 1, 2, 5, 10, 20, 50… */
const BASES_DE_PAS = [1, 2, 5];

/** Les lignes de repère d'un graphique : le plus petit pas rond (1, 2, 5, 10,
 *  20, 50…) qui n'en donne pas plus de cinq — jamais moins de trois. Elles
 *  encadrent les valeurs : la plus basse et la plus haute tiennent entre la
 *  première ligne et la dernière. */
export function echelleVerticale(valeurs: readonly number[]): EchelleVerticale {
  const finies = valeurs.filter(Number.isFinite);
  let min = finies.length > 0 ? Math.min(...finies) : 0;
  let max = finies.length > 0 ? Math.max(...finies) : 1;
  if (max - min < 1e-6) {
    // Une seule valeur, ou toutes pareilles : on l'entoure pour avoir une échelle.
    const marge = Math.max(1, Math.abs(max) * 0.05);
    min -= marge;
    max += marge;
  }
  const depart = Math.floor(Math.log10(max - min)) - 2;
  // On part d'un pas bien trop fin, et on grossit jusqu'à tenir en cinq lignes.
  for (let puissance = depart; puissance < depart + 40; puissance += 1) {
    for (const base of BASES_DE_PAS) {
      const pas = Number((base * 10 ** puissance).toPrecision(12));
      // Un peu de tolérance : 0,3 / 0,1 donne 2,9999999999999996, pas 3.
      const premier = Math.floor(min / pas + 1e-9);
      const dernier = Math.ceil(max / pas - 1e-9);
      if (dernier - premier + 1 > 5) continue;
      const reperes = Array.from({ length: dernier - premier + 1 }, (_, i) => Number(((premier + i) * pas).toPrecision(12)));
      return {
        min: reperes[0],
        max: reperes[reperes.length - 1],
        reperes,
        decimales: Math.max(0, -Math.floor(Math.log10(pas) + 1e-9)),
      };
    }
  }
  // Des valeurs hors de toute mesure : trois lignes, sans prétention.
  return { min, max, reperes: [min, (min + max) / 2, max], decimales: 1 };
}

// ------------------------------------------------------------- Les dates de l'axe du bas

/** Une date de l'axe du bas. */
export interface RepereDate {
  t: number;
  libelle: string;
}

type PasDeDates = { jours: number } | { mois: number };

/** Du plus fin au plus large : on prend le plus fin dont les dates tiennent. */
const PAS_DE_DATES: PasDeDates[] = [
  { jours: 1 },
  { jours: 2 },
  { jours: 7 },
  { jours: 14 },
  { mois: 1 },
  { mois: 2 },
  { mois: 3 },
  { mois: 6 },
  { mois: 12 },
  { mois: 24 },
  { mois: 60 },
];

/** La largeur d'un caractère à 13 px, à peu près : de quoi laisser la place aux dates. */
export const LARGEUR_CARACTERE_PX = 7.4;
/** Le vide qu'on garde entre deux dates. */
const ECART_ENTRE_DATES_PX = 10;
/** Au-delà, un pas donne trop de dates pour tenir : inutile de les compter. */
const DATES_MAXI = 60;

/** Les instants « ronds » du pas dans [t0, t1] : les minuits tous les N jours
 *  (les lundis à partir d'une semaine), les premiers du mois tous les N mois. */
function instantsRonds(t0: number, t1: number, pas: PasDeDates): number[] | null {
  const instants: number[] = [];
  if ('jours' in pas) {
    const jour = new Date(t0);
    jour.setHours(0, 0, 0, 0);
    if (pas.jours >= 7) while (jour.getDay() !== 1) jour.setDate(jour.getDate() + 1);
    while (jour.getTime() < t0) jour.setDate(jour.getDate() + pas.jours);
    while (jour.getTime() <= t1) {
      if (instants.length >= DATES_MAXI) return null;
      instants.push(jour.getTime());
      jour.setDate(jour.getDate() + pas.jours);
    }
    return instants;
  }
  const mois = new Date(t0);
  mois.setHours(0, 0, 0, 0);
  mois.setDate(1);
  // Janvier, avril, juillet, octobre pour trois mois ; janvier des années paires pour deux ans…
  const alignee = (date: Date) =>
    pas.mois <= 12 ? date.getMonth() % pas.mois === 0 : date.getMonth() === 0 && date.getFullYear() % (pas.mois / 12) === 0;
  while (mois.getTime() <= t1) {
    if (mois.getTime() >= t0 && alignee(mois)) {
      if (instants.length >= DATES_MAXI) return null;
      instants.push(mois.getTime());
    }
    mois.setMonth(mois.getMonth() + 1);
  }
  return instants;
}

/** Les dates de l'axe du bas, sur [t0, t1] étalé sur `largeurPx` : les plus
 *  fines qui tiennent sans se toucher — « 5 oct. », « 19 oct. »… pour quelques
 *  semaines, « oct. 2026 », « nov. », « déc. » pour quelques mois, l'année
 *  seule pour plusieurs années. L'année s'écrit sur la première date, et chaque
 *  fois qu'elle change. Au moins une date : le milieu, au besoin. */
export function reperesDeDates(t0: number, t1: number, largeurPx: number): RepereDate[] {
  if (!(t1 > t0)) return [{ t: t0, libelle: libelleJour(t0) }];
  const x = (t: number) => ((t - t0) / (t1 - t0)) * largeurPx;
  const surPlusieursAnnees = new Date(t0).getFullYear() !== new Date(t1).getFullYear();
  for (const pas of PAS_DE_DATES) {
    const instants = instantsRonds(t0, t1, pas);
    if (!instants || instants.length === 0) continue;
    const reperes = instants.map((t, rang): RepereDate => {
      // Des jours : l'année sur la première date, et sur la première de chaque nouvelle année.
      if ('jours' in pas) {
        const nouvelle = rang === 0 || new Date(t).getFullYear() !== new Date(instants[rang - 1]).getFullYear();
        return { t, libelle: libelleJour(t, surPlusieursAnnees && nouvelle) };
      }
      const date = new Date(t);
      if (pas.mois >= 12) return { t, libelle: String(date.getFullYear()) };
      // L'année sur la première date et à chaque janvier : on s'y retrouve.
      const annee = rang === 0 || date.getMonth() === 0;
      return { t, libelle: `${MOIS_COURTS[date.getMonth()]}${annee ? ` ${date.getFullYear()}` : ''}` };
    });
    const largeur = (repere: RepereDate) => repere.libelle.length * LARGEUR_CARACTERE_PX;
    const tiennent = reperes.every(
      (repere, i) =>
        i === 0 ||
        x(repere.t) - x(reperes[i - 1].t) >= (largeur(repere) + largeur(reperes[i - 1])) / 2 + ECART_ENTRE_DATES_PX,
    );
    if (tiennent) return reperes;
  }
  const milieu = (t0 + t1) / 2;
  return [{ t: milieu, libelle: libelleJour(milieu) }];
}
