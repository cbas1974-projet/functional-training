// Le ressenti : sur la dernière série d'un exercice, on dit si la charge
// était facile (😊, « léger »), correcte (😐) ou difficile (☹️, « lourd »). Un
// seul toucher, facultatif. Comme on ne monte pas les charges à chaque
// séance, c'est ce qui dit quand le faire — et c'est la seule règle de
// progression du programme : léger assez de fois de suite (deux pour Speedy,
// une pour Big Max, décision du 13 octobre 2026), on propose un cran de
// plus ; lourd deux fois de suite, un cran de moins. Le compte se fait par
// exercice, quel que soit le jour : un 😊 le lundi et un le mardi, au même
// exercice et à la même charge, font deux. Une douleur signalée sur un
// exercice (`douleurs.ts`) coupe la montée, jamais la descente.
//
// Tout est pur et se recalcule depuis l'historique : rien n'est stocké en
// plus du ressenti lui-même, dans la séance faite.
import type { BlocSeries, ExerciceRealise, Personne, Ressenti, SeanceRealisee, UnitePoids } from '../types';
import type { Etape } from './etapesSeance';
import { CRAN_CHARGE, SUFFIXE_UNITE, convertirPoids, poidsDe, uniteDeSeance } from './statistiques';

// ------------------------------------------------------------- Les trois mots

export const RESSENTIS: readonly Ressenti[] = ['lourd', 'correct', 'leger'];

/** Le mot, pour l'historique et le détail d'une séance. */
export const NOM_RESSENTI: Record<Ressenti, string> = { lourd: 'Lourd', correct: 'Correct', leger: 'Léger' };

/** Les boutons du ressenti, de gauche à droite : facile, correct, difficile
 *  (décision de Sébastien, 13 octobre 2026). Ils remplacent les mots Lourd,
 *  Correct, Léger ; la donnée reste la même. */
export const ORDRE_EMOJIS: readonly Ressenti[] = ['leger', 'correct', 'lourd'];

/** Le visage de chaque bouton. */
export const EMOJI_RESSENTI: Record<Ressenti, string> = { leger: '😊', correct: '😐', lourd: '☹️' };

/** Ce que dit chaque visage, pour le lecteur d'écran. */
export const SENS_EMOJI: Record<Ressenti, string> = {
  leger: 'Facile (léger)',
  correct: 'Correct',
  lourd: 'Difficile (lourd)',
};

/** L'aide, avec les visages : ce que doit être une dernière série. */
export const AIDE_RESSENTI = 'La dernière série doit être dure : 1 à 3 répétitions en réserve.';

/** « 😊 facile · 😐 correct · ☹️ difficile » : la légende des visages. */
export const LEGENDE_VISAGES = '😊 facile · 😐 correct · ☹️ difficile';

/** Sur un seul téléphone, les visages vont sur la ligne de la dernière série
 *  de chacun — jamais sur les premières —, dès qu'elle commence : on les
 *  touche juste après la série, ou pendant la pause qui suit. `place` : la
 *  place de cette série dans les étapes ; `index` : l'étape en cours. */
export function ressentiSurLaSerie(serie: number, series: number, place: number | undefined, index: number): boolean {
  return series > 0 && serie === series && place !== undefined && place <= index;
}

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
 *  plus (décision de Sébastien, 13 octobre 2026 : une progression plus
 *  rapide). Speedy : deux — avec le jiu-jitsu le soir, il reste léger plus
 *  longtemps. Big Max : un seul. Les séances comptent toutes, quel que soit
 *  le jour : le même exercice revient dans la semaine. */
export const RESSENTIS_POUR_MONTER: Record<Personne, number> = { sebastien: 2, max: 1 };
/** Combien de « lourd » de suite, au même poids, avant de proposer un cran de
 *  moins : deux, pour les deux. */
export const RESSENTIS_POUR_DESCENDRE: Record<Personne, number> = { sebastien: 2, max: 2 };

/** Les seuils d'une personne. Sans personne connue, les plus prudents : on
 *  monte le plus tard, on descend le plus tôt. */
export function seuilsRessenti(personne?: Personne | null): { monter: number; descendre: number } {
  if (personne) return { monter: RESSENTIS_POUR_MONTER[personne], descendre: RESSENTIS_POUR_DESCENDRE[personne] };
  return {
    monter: Math.max(...Object.values(RESSENTIS_POUR_MONTER)),
    descendre: Math.min(...Object.values(RESSENTIS_POUR_DESCENDRE)),
  };
}

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
 *  personne — toutes ses séances où l'exercice revient, quel que soit le
 *  jour : un cran de plus après assez de « léger » de suite (deux pour
 *  Speedy, un pour Big Max), un cran de moins après deux « lourd » de suite,
 *  sinon rien.
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
  personne?: Personne | null,
): PropositionCharge | null {
  const seuils = seuilsRessenti(personne);
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
  if (ressenti === 'leger' && fois >= seuils.monter) return { ressenti, ajout: cran, fois };
  // On ne descend pas sous un cran : un haltère de 5 lb est le plus léger.
  if (ressenti === 'lourd' && fois >= seuils.descendre && reference > cran) {
    return { ressenti, ajout: -cran, fois };
  }
  return null;
}

/** Les exercices dont le ressenti demande un changement de charge. Ceux où
 *  l'on a mal (`douloureux`) ne montent jamais : seul « lourd » y compte. */
export function ressentisQuiChangent(
  historique: SeanceRealisee[],
  exerciceIds: string[],
  unite: UnitePoids,
  personne?: Personne | null,
  douloureux: readonly string[] = [],
): Record<string, 'leger' | 'lourd'> {
  const resultat: Record<string, 'leger' | 'lourd'> = {};
  for (const id of new Set(exerciceIds)) {
    const proposition = propositionDeCharge(historique, id, unite, personne);
    if (!proposition) continue;
    if (proposition.ressenti === 'leger' && douloureux.includes(id)) continue;
    resultat[id] = proposition.ressenti;
  }
  return resultat;
}

// ------------------------------------------------------------- La charge proposée

/** Le changement de charge proposé pour un exercice de la séance, et pourquoi. */
export interface AjustementCharge {
  /** Le cran à ajouter à la charge de la dernière fois (négatif : on redescend). */
  ajout: number;
  motif: 'leger' | 'lourd';
}

/** Ce que propose un bloc : le cran du ressenti, s'il y en a un. */
export function ajustementDeCharge(bloc: Pick<BlocSeries, 'ajustementRessenti'> | undefined): AjustementCharge | null {
  const ajout = bloc?.ajustementRessenti ?? 0;
  if (ajout < 0) return { ajout, motif: 'lourd' };
  if (ajout > 0) return { ajout, motif: 'leger' };
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

/** « les 2 dernières fois », « la dernière fois ». */
const dernieresFois = (fois: number): string => (fois > 1 ? `les ${fois} dernières fois` : 'la dernière fois');

/** La phrase de la séance guidée, sous la saisie du poids : « Léger les 2
 *  dernières fois : on monte de 5 lb », « Léger la dernière fois : … ». */
export function phraseRessenti(
  motif: 'leger' | 'lourd',
  ajout: number,
  unite: UnitePoids,
  personne?: Personne | null,
): string {
  const cran = `${nombreFr(Math.abs(ajout))} ${SUFFIXE_UNITE[unite]}`;
  const seuils = seuilsRessenti(personne);
  return motif === 'leger'
    ? `Léger ${dernieresFois(seuils.monter)} : on monte de ${cran}`
    : `Lourd ${dernieresFois(seuils.descendre)} : on redescend de ${cran}`;
}

/** La petite ligne de l'accueil : « ↑ +5 lb proposé », « ↓ −5 lb proposé ». */
export function ligneProposition(motif: 'leger' | 'lourd', ajout: number, unite: UnitePoids): string {
  return `${motif === 'leger' ? '↑' : '↓'} ${libelleCran(ajout, unite)} proposé`;
}

/** Pourquoi, en quelques mots : « léger 2 fois de suite », « léger la
 *  dernière fois ». */
export function raisonProposition(motif: 'leger' | 'lourd', personne?: Personne | null): string {
  const seuils = seuilsRessenti(personne);
  const fois = motif === 'leger' ? seuils.monter : seuils.descendre;
  return `${motif === 'leger' ? 'léger' : 'lourd'} ${fois > 1 ? `${fois} fois de suite` : 'la dernière fois'}`;
}

// ------------------------------------------------------------- Dans la séance guidée

/** Les exercices dont on peut dire le ressenti à cette étape : ceux dont la
 *  dernière série vient d'être faite, dans le dernier groupe travaillé — un
 *  exercice seul, ou les deux d'une paire. On le demande pendant la pause qui
 *  suit, ou, pour le tout dernier exercice, aux étirements. Sur un seul
 *  téléphone, les visages sont déjà sur la ligne de la dernière série
 *  (`ressentiSurLaSerie`) : seuls les étirements les redemandent, pour le
 *  dernier exercice. Rien pendant un circuit, qui n'a pas de charge à noter. */
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

/** Les exercices, avec les ressentis donnés. Un exercice dont aucune série
 *  n'a été faite (passé) n'en garde pas. */
const exercicesAvecRessentis = (exercices: ExerciceRealise[], ressentis: Record<string, Ressenti>): ExerciceRealise[] =>
  exercices.map((exo) => {
    const ressenti = Object.prototype.hasOwnProperty.call(ressentis, exo.exerciceId) ? ressentis[exo.exerciceId] : undefined;
    return estRessenti(ressenti) && exo.seriesFaites > 0 ? { ...exo, ressenti } : exo;
  });

/** La séance faite, avec les ressentis donnés — et, sur un seul téléphone à
 *  deux, ceux de l'autre (`ressentisAutre`), avec ce qu'il a fait. */
export function avecRessentis(
  realisee: SeanceRealisee,
  ressentis: Record<string, Ressenti>,
  ressentisAutre: Record<string, Ressenti> = {},
): SeanceRealisee {
  const pourLui = realisee.partenaire && Object.keys(ressentisAutre).length > 0;
  if (Object.keys(ressentis).length === 0 && !pourLui) return realisee;
  return {
    ...realisee,
    exercices: exercicesAvecRessentis(realisee.exercices, ressentis),
    ...(realisee.partenaire && pourLui
      ? { partenaire: { ...realisee.partenaire, exercices: exercicesAvecRessentis(realisee.partenaire.exercices, ressentisAutre) } }
      : {}),
  };
}
