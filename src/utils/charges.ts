// La charge de chaque série, dans la séance guidée : celle qu'on pré-remplit,
// et les deux raccourcis sous la saisie, « 70 % » et « 100 % » de la charge
// de travail. Les exercices qui chargent le bas du dos (trap bar, swing,
// soulevés de terre…) commencent à 70 % ; une douleur signalée met toutes les
// séries à 70 %. Et pour la trap bar, la presse et le hack squat, chargés des
// deux côtés : combien de disques de chaque côté.
import type { BlocSeries, Douleur, Exercice, Materiel, UnitePoids } from '../types';
import { CRAN_CHARGE, SUFFIXE_UNITE } from './statistiques';
import { ajustementDeCharge, avecCran } from './ressenti';
import { chargeDeSerie, chargeLeBasDuDos, chargeReglable } from './programmeMois';
import { chargeDeDouleur } from './douleurs';

/** Le matériel qui fait la charge d'un exercice au temps : la marche du
 *  fermier aux haltères ou au kettlebell, le traîneau. */
const MATERIEL_QUI_CHARGE: readonly Materiel[] = ['halteres', 'kettlebell', 'salle'];

/** On y note une charge : la saisie du poids, les raccourcis 70 % / 100 %,
 *  « de chaque côté » et « Comment était la charge ? ». Un exercice de
 *  musculation dont la charge se règle (`chargeReglable`), ou fait au temps
 *  mais chargé. Jamais une posture, un étirement, ni un exercice au poids du
 *  corps (sans matériel, ou sur le tapis). */
export function seCharge(exercice: Exercice): boolean {
  if ((exercice.famille ?? 'musculation') !== 'musculation') return false;
  if (exercice.materiel === 'aucun' || exercice.materiel === 'tapis') return false;
  return chargeReglable(exercice) || (exercice.unite === 'secondes' && MATERIEL_QUI_CHARGE.includes(exercice.materiel));
}

/** La série allégée : 70 % de la charge de travail, en dixièmes. */
const DIXIEMES_ALLEGES = 7;
export const PART_ALLEGEE = DIXIEMES_ALLEGES / 10;

/** 70 % d'une charge, au cran le plus proche — 5 lb, 2,5 kg — : les disques
 *  et les haltères n'existent pas plus fins. Jamais sous un cran, jamais
 *  au-dessus de la charge elle-même. */
export function chargeAllegee(charge: number, unite: UnitePoids): number {
  if (!(charge > 0)) return 0;
  const cran = CRAN_CHARGE[unite];
  // En dixièmes : 0,7 × 125 tombe pile sur 87,5, sans erreur d'arrondi ; à
  // égale distance, on prend le cran du dessus.
  const crans = Math.round((charge * DIXIEMES_ALLEGES) / (cran * 10));
  return Math.min(charge, Math.max(cran, crans * cran));
}

const derniereNotee = (charges: readonly number[]): number =>
  charges.reduce((derniere, charge) => (charge > 0 ? charge : derniere), 0);

export interface ParametresCharge {
  exercice: Exercice;
  /** Le bloc de la séance : le cran que propose le ressenti. */
  bloc?: Pick<BlocSeries, 'series' | 'ajustementRessenti'>;
  /** Les charges déjà notées aujourd'hui, série par série. */
  saisies: readonly number[];
  /** Les charges de la dernière fois, série par série. */
  passees: readonly number[];
  /** La série, numérotée à partir de 1. */
  serie: number;
  unite: UnitePoids;
  /** « J'ai mal à cet exercice », s'il est signalé. */
  douleur?: Douleur | null;
}

export interface ChargesSerie {
  /** Ce qu'on pré-remplit : la charge déjà notée, sinon la proposition. */
  proposee: number;
  /** 100 % : la charge de travail ; 0 tant qu'on ne la connaît pas. */
  pleine: number;
  /** 70 % de la charge de travail, au cran près. */
  allegee: number;
}

/** La charge d'une série. La charge de travail (100 %) : celle retenue en
 *  signalant une douleur ; sinon la plus lourde de la dernière fois — un cran
 *  plus loin si le ressenti le demande, et jamais plus haut avec une
 *  douleur — ; sans dernière fois, la dernière notée aujourd'hui.
 *
 *  Pré-rempli : avec une douleur, chaque série à 70 %. Un exercice qui charge
 *  le bas du dos : la première série à 70 %, les suivantes à 100 % (ou
 *  comme la série d'avant, la première mise à part). Les autres, comme
 *  avant : la série d'avant, sinon la même la dernière fois. */
export function chargesDeLaSerie({
  exercice,
  bloc,
  saisies,
  passees,
  serie,
  unite,
  douleur,
}: ParametresCharge): ChargesSerie {
  const ajout = ajustementDeCharge(bloc)?.ajout ?? 0;
  // Avec une douleur, on ne monte pas ; redescendre reste permis.
  const permis = douleur ? Math.min(0, ajout) : ajout;
  const reference = permis !== 0 ? passees.map((charge) => (charge > 0 ? avecCran(charge, permis) : 0)) : [...passees];
  const avant = saisies.slice(0, Math.max(0, serie - 1));
  const basDuDos = chargeLeBasDuDos(exercice);
  // Au bas du dos, la première série est allégée : elle ne dit pas la charge
  // de travail.
  const avantDeTravail = basDuDos && avant.length > 1 ? avant.slice(1) : avant;
  const memoire = chargeDeDouleur(douleur, unite);
  const plusLourde = reference.reduce((max, charge) => Math.max(max, charge), 0);
  const pleine =
    memoire > 0
      ? permis < 0
        ? avecCran(memoire, permis)
        : memoire
      : plusLourde > 0
        ? plusLourde
        : derniereNotee(avantDeTravail);
  const allegee = chargeAllegee(pleine, unite);

  const deja = saisies[serie - 1] ?? 0;
  let proposee: number;
  if (deja > 0) proposee = deja;
  else if (memoire > 0) proposee = allegee;
  else if (basDuDos) proposee = serie <= 1 ? allegee : derniereNotee(avant.slice(1)) || pleine;
  else proposee = chargeDeSerie({ series: bloc?.series ?? 0, ajustementRessenti: permis }, [...saisies], [...passees], serie);
  return { proposee, pleine, allegee };
}

// ------------------------------------------------------------- De chaque côté

const nombreFr = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');

/** « soit 35 lb de chaque côté » : la moitié des disques de chaque côté. */
export function libelleParCote(charge: number, unite: UnitePoids): string {
  return `soit ${nombreFr(charge / 2)} ${SUFFIXE_UNITE[unite]} de chaque côté`;
}

/** Ce que compte le poids noté d'un exercice chargé des deux côtés : les
 *  disques seulement. Rien pour les autres. */
export function libelleDisques(exercice: Pick<Exercice, 'id' | 'chargeParCote'>): string | null {
  if (!exercice.chargeParCote) return null;
  return exercice.id.includes('trap-bar') ? 'disques seulement, sans la barre' : 'disques seulement, sans le chariot';
}
