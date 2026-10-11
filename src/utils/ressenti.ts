// Le ressenti : après la dernière série d'un exercice, on dit si la charge
// était lourde, correcte ou légère. Un seul toucher, facultatif. Comme on ne
// monte pas les charges à chaque séance, c'est ce qui dit quand le faire :
// léger deux fois de suite, on propose un cran de plus ; lourd deux fois de
// suite, un cran de moins.
//
// Tout est pur et se recalcule depuis l'historique : rien n'est stocké en
// plus du ressenti lui-même, dans la séance faite.
import type { BlocSeries, Ressenti, SeanceRealisee, UnitePoids } from '../types';
import type { Etape } from './etapesSeance';
import { CRAN_CHARGE, SUFFIXE_UNITE, convertirPoids, poidsDe, uniteDeSeance } from './statistiques';

// ------------------------------------------------------------- Les trois mots

export const RESSENTIS: readonly Ressenti[] = ['lourd', 'correct', 'leger'];

/** Le mot du bouton. */
export const NOM_RESSENTI: Record<Ressenti, string> = { lourd: 'Lourd', correct: 'Correct', leger: 'Léger' };

/** Le mot en petit, pour l'historique : « léger ». */
export const motRessenti = (ressenti: Ressenti): string => NOM_RESSENTI[ressenti].toLowerCase();

export const estRessenti = (valeur: unknown): valeur is Ressenti =>
  valeur === 'lourd' || valeur === 'correct' || valeur === 'leger';

/** Les ressentis lisibles d'une sauvegarde ou d'un enregistrement : le reste
 *  est écarté. */
export function lireRessentis(brut: unknown): Record<string, Ressenti> {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return {};
  return Object.fromEntries(Object.entries(brut).filter(([, valeur]) => estRessenti(valeur))) as Record<string, Ressenti>;
}

// ------------------------------------------------------------- Quand changer la charge

/** Combien de « léger » de suite, au même poids, avant de proposer un cran de
 *  plus. */
export const RESSENTIS_POUR_MONTER = 2;
/** Combien de « lourd » de suite, au même poids, avant de proposer un cran de
 *  moins. */
export const RESSENTIS_POUR_DESCENDRE = 2;

export interface PropositionCharge {
  /** Léger : on monte. Lourd : on redescend. */
  ressenti: 'leger' | 'lourd';
  /** Le cran à ajouter à la charge de la dernière fois : +5 lb, ou −5 lb ;
   *  dans l'unité demandée. */
  ajout: number;
  /** Combien de fois de suite, au même poids, ce ressenti a été donné. */
  fois: number;
}

/** Deux charges sont « le même poids » à l'arrondi près : une conversion de
 *  livres en kilos et retour peut perdre une livre. */
const memeCharge = (a: number, b: number, unite: UnitePoids): boolean => Math.abs(a - b) <= (unite === 'lb' ? 1 : 0.5);

interface Passage {
  ressenti?: Ressenti;
  /** La charge de l'exercice ce jour-là, dans l'unité demandée. */
  poids?: number;
}

/** Les fois où l'exercice a été fait (au moins une série), de la plus récente
 *  à la plus ancienne. */
function passagesDe(historique: SeanceRealisee[], exerciceId: string, unite: UnitePoids): Passage[] {
  return historique
    .map((realisee) => ({ realisee, ms: Date.parse(realisee.date) }))
    .filter(({ ms }) => Number.isFinite(ms))
    .sort((a, b) => b.ms - a.ms)
    .flatMap(({ realisee }) => {
      const exo = realisee.exercices.find((e) => e.exerciceId === exerciceId && e.seriesFaites > 0);
      if (!exo) return [];
      const poids = poidsDe(exo);
      return [
        {
          ressenti: estRessenti(exo.ressenti) ? exo.ressenti : undefined,
          poids: poids === undefined ? undefined : convertirPoids(poids, uniteDeSeance(realisee.parametres), unite),
        },
      ];
    });
}

/** Ce que le ressenti propose pour un exercice, d'après l'historique de la
 *  personne : un cran de plus après deux « léger » de suite, un cran de moins
 *  après deux « lourd » de suite, sinon rien.
 *
 *  Les ressentis comptent à partir du dernier, tant que la charge est la même :
 *  dès qu'elle a changé — on a monté, ou descendu — le compte repart de zéro,
 *  et c'est le ressenti de la nouvelle charge qui décide. C'est ce qui « consomme »
 *  la montée : on n'en propose pas une seconde juste après la première. Une
 *  séance où l'on n'a rien dit ne coupe rien. Tant qu'on ne change pas la
 *  charge, la proposition reste. */
export function propositionDeCharge(
  historique: SeanceRealisee[],
  exerciceId: string,
  unite: UnitePoids,
): PropositionCharge | null {
  let reference: number | undefined;
  let ressenti: Ressenti | undefined;
  let fois = 0;
  for (const passage of passagesDe(historique, exerciceId, unite)) {
    if (passage.poids !== undefined) {
      if (reference === undefined) reference = passage.poids;
      else if (!memeCharge(passage.poids, reference, unite)) break;
    }
    if (passage.ressenti === undefined) continue;
    if (ressenti === undefined) ressenti = passage.ressenti;
    else if (passage.ressenti !== ressenti) break;
    fois += 1;
  }
  if (reference === undefined) return null;
  const cran = CRAN_CHARGE[unite];
  if (ressenti === 'leger' && fois >= RESSENTIS_POUR_MONTER) return { ressenti, ajout: cran, fois };
  // On ne descend pas sous un cran : un haltère de 5 lb est le plus léger.
  if (ressenti === 'lourd' && fois >= RESSENTIS_POUR_DESCENDRE && reference > cran) {
    return { ressenti, ajout: -cran, fois };
  }
  return null;
}

/** Les exercices dont le ressenti demande un changement de charge. */
export function ressentisQuiChangent(
  historique: SeanceRealisee[],
  exerciceIds: string[],
  unite: UnitePoids,
): Record<string, 'leger' | 'lourd'> {
  const resultat: Record<string, 'leger' | 'lourd'> = {};
  for (const id of new Set(exerciceIds)) {
    const proposition = propositionDeCharge(historique, id, unite);
    if (proposition) resultat[id] = proposition.ressenti;
  }
  return resultat;
}

// ------------------------------------------------------------- La charge proposée

/** Le changement de charge proposé pour un exercice de la séance, et pourquoi. */
export interface AjustementCharge {
  /** Le cran à ajouter à la charge de la dernière fois (négatif : on redescend). */
  ajout: number;
  motif: 'semaine-dure' | 'leger' | 'lourd';
}

/** Ce que propose un bloc : le cran de la semaine dure réussie, ou celui du
 *  ressenti — jamais les deux à la fois. Les deux montent : un seul cran, pas
 *  deux. Le ressenti « lourd » passe avant : si le corps dit lourd deux fois de
 *  suite, la semaine dure réussie ne fait pas monter. */
export function ajustementDeCharge(
  bloc: Pick<BlocSeries, 'ajoutCharge' | 'ajustementRessenti'> | undefined,
): AjustementCharge | null {
  const semaine = bloc?.ajoutCharge ?? 0;
  const ressenti = bloc?.ajustementRessenti ?? 0;
  if (ressenti < 0) return { ajout: ressenti, motif: 'lourd' };
  if (semaine > 0) return { ajout: Math.max(semaine, ressenti), motif: 'semaine-dure' };
  if (ressenti > 0) return { ajout: ressenti, motif: 'leger' };
  return null;
}

/** La charge, un cran plus loin. En descendant, jamais sous un cran : on ne
 *  retire pas un haltère de 5 lb. */
export function avecCran(charge: number, ajout: number): number {
  if (charge <= 0) return 0;
  if (ajout >= 0) return charge + ajout;
  return Math.max(charge + ajout, Math.min(charge, -ajout));
}

const nombreFr = (n: number): string => String(n).replace('.', ',');

/** « +5 lb », « −2,5 kg » */
export function libelleCran(ajout: number, unite: UnitePoids): string {
  return `${ajout < 0 ? '−' : '+'}${nombreFr(Math.abs(ajout))} ${SUFFIXE_UNITE[unite]}`;
}

/** La phrase de la séance guidée, sous la saisie du poids. */
export function phraseRessenti(motif: 'leger' | 'lourd', ajout: number, unite: UnitePoids): string {
  const cran = `${nombreFr(Math.abs(ajout))} ${SUFFIXE_UNITE[unite]}`;
  return motif === 'leger'
    ? `Léger les ${RESSENTIS_POUR_MONTER} dernières fois : on monte de ${cran}`
    : `Lourd les ${RESSENTIS_POUR_DESCENDRE} dernières fois : on redescend de ${cran}`;
}

/** La petite ligne de l'accueil : « ↑ +5 lb proposé », « ↓ −5 lb proposé ». */
export function ligneProposition(motif: 'leger' | 'lourd', ajout: number, unite: UnitePoids): string {
  return `${motif === 'leger' ? '↑' : '↓'} ${libelleCran(ajout, unite)} proposé`;
}

/** Pourquoi, en quelques mots : « léger 2 fois de suite ». */
export const raisonProposition = (motif: 'leger' | 'lourd'): string =>
  motif === 'leger'
    ? `léger ${RESSENTIS_POUR_MONTER} fois de suite`
    : `lourd ${RESSENTIS_POUR_DESCENDRE} fois de suite`;

// ------------------------------------------------------------- Dans la séance guidée

/** Les exercices dont on peut dire le ressenti à cette étape : ceux dont la
 *  dernière série vient d'être faite, dans le dernier groupe travaillé — un
 *  exercice seul, ou les deux d'une paire. On le demande pendant la pause qui
 *  suit, ou, pour le tout dernier exercice, aux étirements. Rien pendant un
 *  circuit, qui n'a pas de charge à noter. */
export function exercicesAEvaluer(etapes: readonly Etape[], index: number): string[] {
  const etape = etapes[index];
  if (!etape || (etape.type !== 'repos' && etape.type !== 'retourCalme')) return [];
  let derniere: Etape | undefined;
  for (let i = index - 1; i >= 0; i -= 1) {
    const avant = etapes[i];
    if (avant.type === 'station') return [];
    if (avant.type === 'serie') {
      derniere = avant;
      break;
    }
  }
  if (derniere?.type !== 'serie' || derniere.groupe === undefined) return [];
  const groupe = derniere.groupe;
  const finis: string[] = [];
  for (let i = 0; i < index; i += 1) {
    const avant = etapes[i];
    if (avant.type === 'serie' && avant.groupe === groupe && avant.serie >= avant.series && !finis.includes(avant.exerciceId)) {
      finis.push(avant.exerciceId);
    }
  }
  return finis;
}

/** La séance faite, avec les ressentis donnés. Un exercice dont aucune série
 *  n'a été faite (passé) n'en garde pas. */
export function avecRessentis(realisee: SeanceRealisee, ressentis: Record<string, Ressenti>): SeanceRealisee {
  if (Object.keys(ressentis).length === 0) return realisee;
  return {
    ...realisee,
    exercices: realisee.exercices.map((exo) => {
      const ressenti = Object.prototype.hasOwnProperty.call(ressentis, exo.exerciceId) ? ressentis[exo.exerciceId] : undefined;
      return estRessenti(ressenti) && exo.seriesFaites > 0 ? { ...exo, ressenti } : exo;
    }),
  };
}
