// Le tableau des mouvements (docs/mouvements.md) : pour chaque exercice de
// musculation, ce que dit le métronome pendant une répétition, comment se
// font les côtés, et pourquoi quand ce n'est pas le cas par défaut. C'est le
// tableau que Sébastien relit ligne à ligne. En tête, « Au temps ou au
// tempo ? » : les exercices qui se font mieux au temps qu'au métronome, ceux
// qui gardent le tempo, et ceux qui restent à décider (`AU_TEMPS_OU_AU_TEMPO`).
//
// Rien n'y est recopié à la main : chaque ligne vient d'une série de huit
// répétitions déroulée par le vrai métronome (`etatMetronome`,
// `etatChangementCote`, `motDePhase`), au tempo par défaut — ou, au temps,
// d'une série déroulée par le vrai décompte (`etatMaintien`) —, et sa durée
// est celle du modèle de coût (`dureeSerieSec`). Un test compare le fichier
// au tableau produit ici : il ne peut pas vieillir. `npm run mouvements` le
// réécrit.
import type { Exercice, Tempo } from '../types';
import { EXERCICES, EXERCICES_PAR_ID, ZONES } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { etatChangementCote, etatMaintien, etatMetronome, formeDe, motDePhase } from './etapesSeance';
import type { Etape } from './etapesSeance';
import {
  BALISTIQUE_SEC,
  CHANGER_DE_COTE_SEC,
  SAUT_SEC,
  SENS_CERCLE_SEC,
  changementDeCoteSec,
  dureeSerieSec,
  estCercleAuTemps,
  estExplosifAuTemps,
  formaterDuree,
  secondesAuTemps,
  secondesImposees,
} from './generateurSeance';

/** Le tempo du tableau : celui des séances, 3 s / 3 s + 1 s. */
export const TEMPO_TABLEAU: Tempo = PARAMETRES_PAR_DEFAUT.tempo;
/** Les répétitions de la série déroulée : huit, par côté pour un unilatéral. */
export const REPS_TABLEAU = 8;
/** Le pas de lecture de l'horloge : les tempos sont en secondes entières. */
const PAS_SEC = 0.25;
/** Une série au temps déroulée pour le tableau : la tenue du programme,
 *  30 s — par côté, dans chaque sens pour un cercle (`SENS_CERCLE_SEC`), ou
 *  le temps d'un explosif (`BALISTIQUE_SEC`, `SAUT_SEC`). */
const TENUE_TABLEAU_SEC = 30;

/** Un morceau de la série : ce que montre l'écran, pendant combien de temps. */
interface Morceau {
  mot: string;
  dureeSec: number;
  /** Le numéro de la répétition (0, 1, 2…) ; absent au changement de côté. */
  cycle?: number;
  cote?: 'droit' | 'gauche';
  sens?: 'premier' | 'second';
  changeDeSens?: boolean;
}

/** Les exercices du tableau : toute la musculation, chargée, au tempo ou au
 *  temps. Le yoga et les étirements se tiennent au temps, sans métronome. */
export const exercicesDuTableau = (): Exercice[] =>
  EXERCICES.filter((exercice) => (exercice.famille ?? 'musculation') === 'musculation');

/** Une série de huit, telle que la déroule la séance guidée : l'écran lu à
 *  chaque quart de seconde, regroupé en morceaux. */
export function derouleSerie(exercice: Exercice, tempo: Tempo = TEMPO_TABLEAU, reps = REPS_TABLEAU): Morceau[] {
  const etape: Etape = {
    type: 'serie',
    exerciceId: exercice.id,
    serie: 1,
    series: 1,
    reps,
    dureeSec: dureeSerieSec(exercice, reps, tempo),
  };
  const morceaux: Morceau[] = [];
  for (let t = PAS_SEC / 2; t < etape.dureeSec; t += PAS_SEC) {
    const changement = etatChangementCote(etape, t, tempo);
    const metro = etatMetronome(etape, t, tempo);
    const lu: Morceau | null = changement
      ? { mot: 'CHANGE DE CÔTÉ', dureeSec: PAS_SEC }
      : metro
        ? {
            mot: motDePhase(metro.phase, exercice),
            dureeSec: PAS_SEC,
            cycle: metro.cycle,
            ...(metro.cote ? { cote: metro.cote } : {}),
            ...(metro.sens ? { sens: metro.sens } : {}),
            ...(metro.changeDeSens ? { changeDeSens: true } : {}),
          }
        : null;
    if (!lu) continue;
    const dernier = morceaux[morceaux.length - 1];
    if (dernier && dernier.mot === lu.mot && dernier.cycle === lu.cycle) dernier.dureeSec += PAS_SEC;
    else morceaux.push(lu);
  }
  return morceaux;
}

const secondes = (sec: number) => `${Number.isInteger(sec) ? sec : sec.toFixed(1)} s`;

/** Un morceau d'une série au temps : un sens, un côté, ou le changement de
 *  côté, et sa durée. */
interface PartieAuTemps {
  mot: string;
  dureeSec: number;
}

/** Une série au temps, telle que la déroule la séance guidée : le décompte
 *  lu à chaque quart de seconde (`etatMaintien`, `etatChangementCote`),
 *  regroupé en parties — un sens puis l'autre pour un cercle, un côté, le
 *  changement de côté, puis l'autre côté pour le relevé turc. */
export function derouleSerieAuTemps(
  exercice: Exercice,
  secondesParPartie = secondesAuTemps(exercice, TENUE_TABLEAU_SEC),
): PartieAuTemps[] {
  const etape: Etape = {
    type: 'serie',
    exerciceId: exercice.id,
    serie: 1,
    series: 1,
    reps: secondesParPartie,
    dureeSec: dureeSerieSec(exercice, secondesParPartie, TEMPO_TABLEAU),
  };
  const parties: PartieAuTemps[] = [];
  for (let t = PAS_SEC / 2; t < etape.dureeSec; t += PAS_SEC) {
    const maintien = etatMaintien(etape, t);
    const mot = etatChangementCote(etape, t, TEMPO_TABLEAU)
      ? 'CHANGE DE CÔTÉ'
      : maintien?.sens
        ? maintien.sens === 'premier'
          ? 'dans un sens'
          : 'dans l’autre'
        : maintien?.cote
          ? `côté ${maintien.cote}`
          : exercice.explosif
            ? 'à son rythme'
            : 'tenu';
    const derniere = parties[parties.length - 1];
    if (derniere && derniere.mot === mot) derniere.dureeSec += PAS_SEC;
    else parties.push({ mot, dureeSec: PAS_SEC });
  }
  return parties;
}

/** « MONTE 3 s → DESCENDS 3 s → TIENS 1 s » : la première répétition. Au
 *  temps, pas de répétition : le décompte, pour un cercle ses deux sens, pour
 *  un explosif son temps à son rythme. */
export function uneRepetition(exercice: Exercice, tempo: Tempo = TEMPO_TABLEAU): string {
  if (exercice.unite !== 'reps') {
    if (estCercleAuTemps(exercice)) {
      const [premier, second] = derouleSerieAuTemps(exercice);
      return `— au temps : ${secondes(premier.dureeSec)} ${premier.mot} → « Change de sens ! » → ${secondes(second.dureeSec)} ${second.mot}`;
    }
    if (estExplosifAuTemps(exercice)) {
      // 30 s à son rythme ; d'un seul bras, un côté, le changement, l'autre.
      const parties = derouleSerieAuTemps(exercice).map((partie) =>
        partie.mot === 'CHANGE DE CÔTÉ' ? `${partie.mot} ${secondes(partie.dureeSec)}` : `${secondes(partie.dureeSec)} ${partie.mot}`,
      );
      return `— au temps : ${parties.join(' → ')}, sans métronome`;
    }
    return exercice.cotes === 'unilateral'
      ? '— (au temps, de chaque côté : un décompte, pas de métronome)'
      : '— (tenu au temps : un décompte, pas de métronome)';
  }
  return derouleSerie(exercice, tempo)
    .filter((morceau) => morceau.cycle === 0)
    .map((morceau) => `${morceau.mot} ${secondes(morceau.dureeSec)}`)
    .join(' → ');
}

/** Comment se font les côtés, ou les sens, sur une série de huit : lu dans le
 *  déroulé de la série, pas dans la fiche. */
export function deroulementDesCotes(exercice: Exercice, tempo: Tempo = TEMPO_TABLEAU): string {
  if (exercice.unite !== 'reps') {
    if (estCercleAuTemps(exercice)) return 'un sens, puis l’autre : « Change de sens ! » d’un bip, sans s’arrêter';
    const changement = derouleSerieAuTemps(exercice).find((partie) => partie.mot === 'CHANGE DE CÔTÉ');
    if (changement) {
      return `côté droit → CHANGE DE CÔTÉ ${secondes(changement.dureeSec)} (« +${CHANGER_DE_COTE_SEC} s » si besoin) → côté gauche`;
    }
    if (exercice.cotes === 'unilateral') return 'un côté puis l’autre';
    return exercice.cotes === 'alterne' ? 'en alternant, un côté après l’autre' : 'les deux ensemble';
  }
  const morceaux = derouleSerie(exercice, tempo);
  const cycles = (filtre: (m: Morceau) => boolean) =>
    new Set(morceaux.filter((m) => m.cycle !== undefined && filtre(m)).map((m) => m.cycle)).size;
  const changement = morceaux.find((m) => m.mot === 'CHANGE DE CÔTÉ');
  if (changement) {
    return `${cycles((m) => m.cote === 'droit')} rép. côté droit → CHANGE DE CÔTÉ ${secondes(changement.dureeSec)} (« +${CHANGER_DE_COTE_SEC} s » si besoin) → ${cycles((m) => m.cote === 'gauche')} rép. côté gauche`;
  }
  const forme = formeDe(exercice);
  if (forme === 'circulaire') {
    return `${cycles((m) => m.sens === 'premier')} tours dans un sens → « Change de sens ! », sans s’arrêter → ${cycles((m) => m.sens === 'second')} tours dans l’autre sens`;
  }
  const total = cycles(() => true);
  if (forme === 'rotation') return `${total} rép., chacune à droite puis à gauche`;
  if (exercice.cotes === 'alterne') return `${total} rép. en alternant : un côté par rép.`;
  return `${total} rép.`;
}

/** La durée d'une série dans le tableau : huit répétitions, ou, au temps, le
 *  temps que la fiche impose — une minute de cercle, 30 s ou 20 s d'explosif
 *  (`secondesImposees`) ; la tenue des autres dépend de la séance. */
function dureeDuTableau(exercice: Exercice, tempo: Tempo): string {
  if (exercice.unite === 'reps') return formaterDuree(dureeSerieSec(exercice, REPS_TABLEAU, tempo));
  const imposees = secondesImposees(exercice);
  return imposees === null ? 'au temps' : formaterDuree(dureeSerieSec(exercice, imposees, tempo));
}

/** Ce qui n'est pas le cas par défaut, dit simplement. */
function raisonsDe(exercice: Exercice): string[] {
  const raisons: string[] = [];
  const forme = formeDe(exercice);
  if (exercice.unite !== 'reps') {
    if (estCercleAuTemps(exercice)) {
      raisons.push('Cercle au temps : un décompte, pas de métronome ; chacun tourne à son rythme, jamais d’arrêt.');
      if (exercice.genouAMenager) raisons.push('Genou plié tout du long : on descend jusqu’où il ne fait pas mal.');
      return raisons;
    }
    if (estExplosifAuTemps(exercice)) {
      return [
        'Explosif, au temps (seulement avec l’option) : à son rythme, léger, la qualité avant la vitesse.',
      ];
    }
    return [
      exercice.cotes === 'unilateral'
        ? 'Au temps, de chaque côté : un décompte, pas de métronome.'
        : 'Tenu au temps : un décompte, pas de métronome.',
    ];
  }
  if (forme === 'circulaire') raisons.push('Cercle continu : ni haut ni bas, jamais d’arrêt ; un tour = montée + descente.');
  if (forme === 'rotation') raisons.push('D’un côté à l’autre : ni haut ni bas, jamais d’arrêt ; une rép. = à droite puis à gauche.');
  if (exercice.explosif) raisons.push('Explosif (seulement avec l’option) : un geste balistique ne s’arrête pas.');
  if (forme === 'vertical') {
    if (exercice.sansPauseEnBas && exercice.pauseEnHaut) {
      raisons.push('Jamais d’arrêt genoux pliés : on tient jambes tendues.');
    } else if (exercice.sansPauseEnBas) {
      raisons.push(exercice.genouAMenager ? 'Sans arrêt en bas : le genou.' : 'Sans arrêt en bas : le dos.');
    } else if (exercice.pauseEnHaut) {
      raisons.push('Tenu en haut : la position basse est un repos.');
    }
  } else if (exercice.genouAMenager) {
    raisons.push('Genou plié tout du long : on descend jusqu’où il ne fait pas mal.');
  }
  if (forme === 'vertical' && exercice.premierePhase === 'descend') raisons.push('Part d’en haut : on descend d’abord.');
  if (exercice.motsTempo) {
    raisons.push(`Geste horizontal : ${exercice.motsTempo.monte} / ${exercice.motsTempo.descend} plutôt que MONTE / DESCENDS.`);
  }
  return raisons;
}

/** Les décisions propres à un exercice, et ce qui a changé le 11 octobre
 *  2026 (« avant : … »). */
const NOTES: Record<string, string> = {
  'kb-around-the-body':
    'La cloche passe d’une main à l’autre autour de la taille (avant : TOURNE 6 s, 4 tours dans chaque sens ; avant encore, MONTE / TIENS / DESCENDS).',
  'kb-halo':
    'La cloche fait le tour de la tête. « Pas facile d’y aller à 3/3 » (Speedy) : au temps (avant : TOURNE 6 s, 4 tours dans chaque sens).',
  'kb-around-the-world': 'La cloche passe autour des jambes, dans un squat large tenu (avant : TOURNE 6 s, 4 tours dans chaque sens).',
  'russian-twist': 'Assis, le buste tourne d’un côté à l’autre (avant : MONTE / DESCENDS / TIENS).',
  'kb-russian-twist': 'Assis, le buste tourne d’un côté à l’autre (avant : MONTE / DESCENDS / TIENS).',
  'v-sit-cross-jab': 'Un coup croisé vers la droite, un vers la gauche (avant : MONTE / DESCENDS / TIENS).',
  'hollow-body-sweeper': 'L’haltère balaie d’un côté à l’autre (avant : MONTE / DESCENDS / TIENS).',
  'kb-plank-oblique-pull-through': 'La cloche glisse sous le corps d’un côté à l’autre (avant : MONTE / DESCENDS / TIENS).',
  'bow-extension': 'Comme le crunch genou haut : le genou monte à la rencontre de l’haltère, on tient serré (avant : DESCENDS d’abord).',
  'hollow-fly': 'Bras tendus au-dessus de la poitrine au départ, on les ouvre (avant : MONTE d’abord).',
  'hollow-pullover': 'Comme le pull-over, les bras passent derrière la tête (avant : MONTE d’abord).',
  'kb-single-leg-deadlift': 'Part debout, comme aux haltères (avant : MONTE d’abord).',
  'kb-good-morning': 'Part debout : on se penche d’abord (avant : MONTE d’abord).',
  woodchop: 'En bas, le buste est penché et tourné, la charge au pied (avant : TIENS en bas).',
  'kb-wood-chop': 'En bas, le buste est penché et tourné, la charge au pied (avant : TIENS en bas).',
  'no-money-curl': 'Les avant-bras s’ouvrent vers l’extérieur, coudes au corps.',
  'kb-low-side-step-row': 'Part bras tendus, en demi-squat : le rowing monte d’abord (avant : DESCENDS d’abord, TIENS en bas).',
  'cossack-squat': 'Avant : TIENS en bas, genou plié au maximum.',
  'kb-bob-and-weave': 'Avant : TIENS en bas du squat.',
  'kb-overhead-squat': 'Avant : TIENS en bas du squat.',
  'kb-pistol-bench-squat': 'Avant : TIENS en bas, sur une jambe.',
  'bulgarian-lunge': 'Avant : TIENS en bas de la fente.',
  'side-lunge-thruster': 'Avant : TIENS en bas de la fente.',
  'single-leg-deadlift-db': 'Comme au kettlebell (avant : TIENS en bas).',
  'kb-turkish-get-up':
    'Un relevé complet prend bien plus de 3 s : un relevé lent par côté (avant : MONTE 3 s → TIENS 1 s → DESCENDS 3 s, 8 par côté). Avancé, hors programme.',
  'leg-extension-machine': 'Comme l’affiche de la salle.',
  'upright-row': 'Tenu en haut, il pincerait l’épaule.',
  'kb-single-leg-calf-raise': 'Le talon sous la marche étire le mollet sous la charge.',
};

const cellule = (texte: string) => texte.replace(/\|/g, '\\|');

// ------------------------------------------------------------- Au temps ou au tempo ?

/** Ce qu'on a décidé pour un exercice, ou un groupe d'exercices :
 *  fait      : passé au temps, dans l'application ;
 *  deja      : au temps depuis toujours (tenues, portages, traîneau) ;
 *  garde     : le tempo lui va, on le garde ;
 *  a-decider : au temps serait peut-être mieux, mais pas sans contrepartie —
 *              Sébastien décide. */
export type DecisionAuTemps = 'fait' | 'deja' | 'garde' | 'a-decider';

export interface AvisAuTemps {
  ids: string[];
  recommandation: string;
  decision: DecisionAuTemps;
  pourquoi: string;
}

const NOM_DECISION: Record<DecisionAuTemps, string> = {
  fait: '**Au temps : fait**',
  deja: 'Déjà au temps',
  garde: 'Tempo gardé',
  'a-decider': '**À décider**',
};

/** La question de Speedy au halo, posée à chaque exercice qui pourrait se
 *  faire au temps plutôt qu'au tempo. Un test vérifie que les décisions
 *  suivent les fiches : « fait » et « déjà » sont au temps, le reste au
 *  tempo, et chaque exercice au temps est ici. */
export const AU_TEMPS_OU_AU_TEMPO: AvisAuTemps[] = [
  {
    ids: ['kb-halo', 'kb-around-the-body', 'kb-around-the-world'],
    recommandation: `Au temps : ${SENS_CERCLE_SEC} s dans un sens, « Change de sens ! » d’un bip sans s’arrêter, ${SENS_CERCLE_SEC} s dans l’autre.`,
    decision: 'fait',
    pourquoi:
      'Demandé par Speedy : « pas facile d’y aller à 3/3 ». Un tour n’a ni haut ni bas, et sa vitesse dépend des bras et de la cloche : au tempo, on court après la bille ou on l’attend. Au temps, chacun tourne à son rythme, lentement, le buste immobile. Le même temps pour les deux ; la charge se note et se règle comme avant (lourd, correct, léger). Avant : TOURNE 6 s, 4 tours dans un sens, 4 dans l’autre (48 s). Le tour du monde reste mis de côté du programme.',
  },
  {
    ids: ['kb-turkish-get-up'],
    recommandation: 'Au temps, de chaque côté : un relevé lent, aller et retour, puis CHANGE DE CÔTÉ 5 s.',
    decision: 'fait',
    pourquoi:
      'Huit temps — coude, main, pont, genou, debout, et retour : impossible en 3 s, et huit relevés par côté prendraient un quart d’heure. Au temps, on en fait un, bien posé. Avancé : jamais dans le programme, seulement en séance libre au niveau avancé (45 s par côté). Avant : MONTE 3 s → TIENS 1 s → DESCENDS 3 s, 8 par côté.',
  },
  {
    ids: ['russian-twist', 'kb-russian-twist'],
    recommandation: 'Garder le tempo : 3 s à droite, 3 s à gauche.',
    decision: 'garde',
    pourquoi:
      'La lenteur est la consigne même : un twist rapide charge les vertèbres, pas les obliques. Au temps, on accélère sans s’en rendre compte — mauvais pour le bas du dos de Speedy. Pieds au sol, petite amplitude.',
  },
  {
    ids: ['v-sit-cross-jab'],
    recommandation: 'Garder le tempo : répétitions lentes (choix de Speedy).',
    decision: 'garde',
    pourquoi:
      'Choisi par Speedy le 11 octobre : répétitions lentes. Un coup de poing en 3 s, c’est un développé lent, pas un coup : au temps, ce serait plus naturel. Mais le travail, c’est surtout le V tenu, que le tempo dose bien, et au temps les coups partent vite, haltères au bout des bras (épaule, coude). Le V tenu fatigue vite le bas du dos de Speedy : pieds au sol. À essayer une fois avant de choisir.',
  },
  {
    ids: ['kb-plank-oblique-pull-through'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'Glisser la cloche en 3 s, bassin immobile : c’est le bon geste, et c’est ce qui le rend dur. Au temps, on tirerait vite et le bassin tournerait.',
  },
  {
    ids: ['hollow-body-sweeper'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'Balayer lentement, c’est l’exercice ; le tempo empêche d’accélérer quand le ventre lâche. Bas du dos plaqué au sol, sinon on arrête. Avancé : hors programme.',
  },
  {
    ids: ['plank-t'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'La rotation lente, tenue en haut, c’est tout l’exercice ; vite, on s’effondre au retour (épaules, poignets). Avancé : hors programme.',
  },
  {
    ids: ['renegade-row', 'kb-renegade-row'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'Un rowing reste un rowing : 3 s, tenu en haut, le bassin ne tourne pas. Au temps, on enchaîne et le bassin se balance. Avancés : hors programme.',
  },
  {
    ids: ['kb-commando'],
    recommandation: 'Garder le tempo ; au temps (30 s) si les 3 s gênent à l’essai.',
    decision: 'garde',
    pourquoi:
      'Monter en 3 s, c’est poser les deux mains l’une après l’autre : lent, mais faisable. Au temps, on se presse et le bassin balance. Avancé : hors programme.',
  },
  {
    ids: ['bird-dog-row'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'L’équilibre se tient toute la série ; le rowing, lui, va au tempo comme les autres. Un genou sur le banc : rien de risqué pour la jambe de Speedy. Avancé : hors programme.',
  },
  {
    ids: ['kb-half-turkish-get-up'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'Monter sur le coude puis sur la main en 3 s, c’est faisable, et la seconde tenue en haut est utile. Le relevé complet, lui, passe au temps.',
  },
  {
    ids: ['kb-side-plank-twist'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'Passer la cloche sous le buste en 3 s, hanches hautes : le tempo va bien. Huit par côté sur le coude, c’est long : alléger si l’épaule tire.',
  },
  {
    ids: ['kb-windmill'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'Lent par nature, bras chargé vertical ; plus vite, c’est le bas du dos qui prend. Avancé : hors programme.',
  },
  {
    ids: ['kb-wall-squat-press'],
    recommandation: 'Garder le tempo.',
    decision: 'garde',
    pourquoi:
      'La chaise se tient pendant que le développé suit le tempo : déjà 48 s de chaise, assez pour les genoux de Big Max (pas plus bas que l’angle droit).',
  },
  {
    ids: EXERCICES.filter((e) => e.explosif).map((e) => e.id),
    recommandation: `Au temps, sans métronome : ${BALISTIQUE_SEC} s par série (${SAUT_SEC} s pour les sauts et le burpee), à son rythme, léger — la qualité avant la vitesse.`,
    decision: 'fait',
    pourquoi: `Décidé par Sébastien : « pas fuir un exercice, pouvoir un jour le faire sans douleur — donc mettre moins de poids ». Un swing ou un saut en 3 s / 3 s n’est plus un swing ni un saut : on les fait au temps, chacun à son rythme, avec une charge légère, un décompte et pas de métronome. ${BALISTIQUE_SEC} s par série pour les swings, les arrachés, l’épaulé, le tirage haut et les balanciers — ${BALISTIQUE_SEC} s de chaque côté, avec CHANGE DE CÔTÉ ${CHANGER_DE_COTE_SEC} s (« +${CHANGER_DE_COTE_SEC} s » si besoin), pour les versions à un bras ; ${SAUT_SEC} s pour les sauts et le burpee. Le poids se note et se règle comme avant (lourd, correct, léger). Ils ne sortent toujours qu’avec l’option « explosifs », jamais dans le programme, et restent déconseillés au dos de Speedy et aux genoux de Big Max : raison de plus d’y aller léger. Avant : DESCENDS 3 s → MONTE 3 s, ou MONTE 3 s → DESCENDS 3 s, sans arrêt.`,
  },
  {
    ids: ['kb-isometric-crunch', 'farmers-walk', 'kb-farmers-walk', 'traineau'],
    recommandation: 'Rien à changer.',
    decision: 'deja',
    pourquoi: 'Une tenue, un portage, un aller-retour de traîneau : c’est le temps qui compte, pas les répétitions.',
  },
];

/** Ce que fait l'application aujourd'hui pour un groupe d'exercices : la
 *  répétition au tempo, ou le décompte au temps. */
function aujourdHui(ids: string[], tempo: Tempo): string {
  const lignes = ids.map((id) => {
    const exercice = EXERCICES_PAR_ID[id];
    if (exercice.unite === 'reps') return uneRepetition(exercice, tempo);
    if (estCercleAuTemps(exercice)) return uneRepetition(exercice, tempo).replace(/^— /, '');
    const imposees = secondesImposees(exercice);
    if (imposees !== null) {
      return changementDeCoteSec(exercice) > 0
        ? `au temps : ${imposees} s de chaque côté, CHANGE DE CÔTÉ ${CHANGER_DE_COTE_SEC} s`
        : `au temps : ${imposees} s`;
    }
    return changementDeCoteSec(exercice) > 0 ? 'au temps, de chaque côté, CHANGE DE CÔTÉ 5 s' : 'au temps : un décompte';
  });
  return [...new Set(lignes)].join(' ; ou ');
}

/** La section « Au temps ou au tempo ? », en tête du tableau. */
function sectionAuTemps(tempo: Tempo): string[] {
  const nom = (id: string) => `${EXERCICES_PAR_ID[id].nomFr} (\`${id}\`)`;
  return [
    '## Au temps ou au tempo ?',
    '',
    'Speedy, au halo, le 11 octobre : « pas facile d’y aller à 3/3 — ça devrait être une durée : 30 secondes / 30 secondes ».',
    'La même question, posée à chaque exercice dont le geste ne monte ni ne descend franchement, ou dure bien plus',
    '(ou bien moins) que 3 s : au **temps** — un décompte, chacun à son rythme — ou au **tempo** — le métronome,',
    `${tempo.monteeSec} s / ${tempo.descenteSec} s + ${tempo.pauseSec ?? 0} s ? Ce qui compte : le bon sens, pour deux gars d’une cinquantaine d’années en salle ;`,
    'le bas du dos de Speedy, qui fatigue vite, et sa jambe, qui lâche parfois ; les genoux de Big Max.',
    'Au temps seulement quand c’est clairement mieux, sans contrepartie ; le reste, Sébastien décide.',
    '',
    '| Exercice | Aujourd’hui | Recommandation | Décision | Pourquoi |',
    '|---|---|---|---|---|',
    ...AU_TEMPS_OU_AU_TEMPO.map(
      (avis) =>
        `| ${cellule(avis.ids.map(nom).join(', '))} | ${cellule(aujourdHui(avis.ids, tempo))} | ${cellule(
          avis.recommandation,
        )} | ${NOM_DECISION[avis.decision]} | ${cellule(avis.pourquoi)} |`,
    ),
    '',
    'Tous les autres montent et descendent : le tempo est leur geste, on le garde.',
    '',
  ];
}

// ------------------------------------------------------------- Le tableau

/** Le tableau complet, en Markdown. */
export function tableauDesMouvements(tempo: Tempo = TEMPO_TABLEAU): string {
  const exercices = exercicesDuTableau();
  const formes = (forme: string) => exercices.filter((e) => formeDe(e) === forme);
  const liste = (es: Exercice[]) => es.map((e) => `\`${e.id}\``).join(', ');
  const unilateraux = exercices.filter((e) => changementDeCoteSec(e) > 0);
  const explosifs = exercices.filter((e) => e.explosif);
  const auTemps = exercices.filter((e) => e.unite === 'secondes' && !e.explosif);
  const lignes: string[] = [
    '# Les mouvements, un par un',
    '',
    '<!-- Généré par `npm run mouvements` depuis le code (src/utils/tableauMouvements.ts) :',
    '     ne pas modifier à la main. Un test vérifie que ce fichier suit le code. -->',
    '',
    ...sectionAuTemps(tempo),
    '## Le métronome, exercice par exercice',
    '',
    `Ce que dit le métronome de la séance guidée pour chacun des ${exercices.length} exercices de musculation,`,
    `au tempo par défaut (${tempo.monteeSec} s / ${tempo.descenteSec} s + ${tempo.pauseSec ?? 0} s), sur une série de ${REPS_TABLEAU} répétitions`,
    `(${REPS_TABLEAU} de chaque côté pour un exercice unilatéral). Chaque ligne est lue dans le vrai métronome :`,
    'les mots, leurs secondes, le changement de côté et la durée de la série sont ceux de l’application.',
    '',
    '- **Vertical** (par défaut) : MONTE, DESCENDS, et TIENS là où le muscle travaille — en bas quand la position',
    '  basse est étirée sous la charge, en haut quand elle est un repos, nulle part quand le bas fatigue le dos ou le genou.',
    `- **Circulaire** (${formes('circulaire').length}), **au temps** : ${SENS_CERCLE_SEC} s dans un sens, « Change de sens ! » d’un bip, sans s’arrêter,`,
    `  puis ${SENS_CERCLE_SEC} s dans l’autre ; un décompte, pas de métronome. ${liste(formes('circulaire'))}.`,
    `- **Rotation** (${formes('rotation').length}) : À DROITE puis À GAUCHE dans chaque répétition, jamais d’arrêt.`,
    `  ${liste(formes('rotation'))}.`,
    `- **Unilatéral** (${unilateraux.length}) : tout le côté droit, CHANGE DE CÔTÉ ${CHANGER_DE_COTE_SEC} s (« +${CHANGER_DE_COTE_SEC} s »`,
    '  en donne cinq de plus), puis le côté gauche — au tempo comme au temps. La durée annoncée compte les 5 s.',
    `- **Au temps** (${auTemps.length}) : un décompte, pas de métronome. ${liste(auTemps)}.`,
    `- **Explosifs** (${explosifs.length}), **au temps** : seulement quand l’option est cochée ; ${BALISTIQUE_SEC} s par série (${SAUT_SEC} s pour les`,
    `  sauts et le burpee), de chaque côté avec CHANGE DE CÔTÉ ${CHANGER_DE_COTE_SEC} s pour un seul bras ; à son rythme, léger, un décompte`,
    `  et pas de métronome. ${liste(explosifs)}.`,
    '',
  ];
  for (const zone of ZONES) {
    const deLaZone = exercices.filter((e) => e.zone === zone.id);
    if (deLaZone.length === 0) continue;
    lignes.push(`## ${zone.nom} (${deLaZone.length})`, '');
    lignes.push(`| id | Nom | Une répétition | Côtés, sur une série de ${REPS_TABLEAU} | Série | Pourquoi |`);
    lignes.push('|---|---|---|---|---|---|');
    for (const exercice of deLaZone) {
      const pourquoi = [...raisonsDe(exercice), NOTES[exercice.id]].filter(Boolean).join(' ');
      lignes.push(
        `| \`${exercice.id}\` | ${cellule(exercice.nomFr)} | ${cellule(uneRepetition(exercice, tempo))} | ${cellule(
          deroulementDesCotes(exercice, tempo),
        )} | ${dureeDuTableau(exercice, tempo)} | ${cellule(pourquoi)} |`,
      );
    }
    lignes.push('');
  }
  return lignes.join('\n');
}
