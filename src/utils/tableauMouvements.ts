// Le tableau des mouvements (docs/mouvements.md) : pour chaque exercice de
// musculation, ce que dit le métronome pendant une répétition, comment se
// font les côtés, et pourquoi quand ce n'est pas le cas par défaut. C'est le
// tableau que Sébastien relit ligne à ligne.
//
// Rien n'y est recopié à la main : chaque ligne vient d'une série de huit
// répétitions déroulée par le vrai métronome (`etatMetronome`,
// `etatChangementCote`, `motDePhase`), au tempo par défaut, et sa durée est
// celle du modèle de coût (`dureeSerieSec`). Un test compare le fichier au
// tableau produit ici : il ne peut pas vieillir. `npm run mouvements` le
// réécrit.
import type { Exercice, Tempo } from '../types';
import { EXERCICES, ZONES } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { etatChangementCote, etatMetronome, formeDe, motDePhase } from './etapesSeance';
import type { Etape } from './etapesSeance';
import { CHANGER_DE_COTE_SEC, dureeSerieSec, formaterDuree } from './generateurSeance';

/** Le tempo du tableau : celui des séances, 3 s / 3 s + 1 s. */
export const TEMPO_TABLEAU: Tempo = PARAMETRES_PAR_DEFAUT.tempo;
/** Les répétitions de la série déroulée : huit, par côté pour un unilatéral. */
export const REPS_TABLEAU = 8;
/** Le pas de lecture de l'horloge : les tempos sont en secondes entières. */
const PAS_SEC = 0.25;

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

/** « MONTE 3 s → DESCENDS 3 s → TIENS 1 s » : la première répétition. */
export function uneRepetition(exercice: Exercice, tempo: Tempo = TEMPO_TABLEAU): string {
  if (exercice.unite !== 'reps') return '— (tenu au temps : un décompte, pas de métronome)';
  return derouleSerie(exercice, tempo)
    .filter((morceau) => morceau.cycle === 0)
    .map((morceau) => `${morceau.mot} ${secondes(morceau.dureeSec)}`)
    .join(' → ');
}

/** Comment se font les côtés, ou les sens, sur une série de huit : lu dans le
 *  déroulé de la série, pas dans la fiche. */
export function deroulementDesCotes(exercice: Exercice, tempo: Tempo = TEMPO_TABLEAU): string {
  if (exercice.unite !== 'reps') {
    return exercice.cotes === 'unilateral' ? 'un côté puis l’autre' : 'les deux ensemble';
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

/** Ce qui n'est pas le cas par défaut, dit simplement. */
function raisonsDe(exercice: Exercice): string[] {
  const raisons: string[] = [];
  const forme = formeDe(exercice);
  if (exercice.unite !== 'reps') return ['Tenu au temps : un décompte, pas de métronome.'];
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
  'kb-around-the-body': 'La cloche passe d’une main à l’autre autour de la taille (avant : MONTE / TIENS / DESCENDS).',
  'kb-halo': 'La cloche fait le tour de la tête. Sens changé à mi-série, comme les deux autres cercles (avant : à chaque tour).',
  'kb-around-the-world': 'La cloche passe autour des jambes, dans un squat large tenu.',
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
  'dumbbell-burpee': 'Part debout : on descend en planche d’abord (avant : MONTE d’abord).',
  woodchop: 'En bas, le buste est penché et tourné, la charge au pied (avant : TIENS en bas).',
  'kb-wood-chop': 'En bas, le buste est penché et tourné, la charge au pied (avant : TIENS en bas).',
  'no-money-curl': 'Les avant-bras s’ouvrent vers l’extérieur, coudes au corps.',
  'kb-low-side-step-row': 'Part bras tendus, en demi-squat : le rowing monte d’abord (avant : DESCENDS d’abord, TIENS en bas).',
  'kb-frog-jump': 'Part dans le squat large : on saute d’abord (avant : DESCENDS d’abord).',
  'cossack-squat': 'Avant : TIENS en bas, genou plié au maximum.',
  'kb-bob-and-weave': 'Avant : TIENS en bas du squat.',
  'kb-overhead-squat': 'Avant : TIENS en bas du squat.',
  'kb-pistol-bench-squat': 'Avant : TIENS en bas, sur une jambe.',
  'bulgarian-lunge': 'Avant : TIENS en bas de la fente.',
  'side-lunge-thruster': 'Avant : TIENS en bas de la fente.',
  'single-leg-deadlift-db': 'Comme au kettlebell (avant : TIENS en bas).',
  'kb-turkish-get-up': 'Limite : un relevé complet prend bien plus de 3 s ; exercice avancé, hors programme.',
  'leg-extension-machine': 'Comme l’affiche de la salle.',
  'upright-row': 'Tenu en haut, il pincerait l’épaule.',
  'kb-single-leg-calf-raise': 'Le talon sous la marche étire le mollet sous la charge.',
};

const cellule = (texte: string) => texte.replace(/\|/g, '\\|');

/** Le tableau complet, en Markdown. */
export function tableauDesMouvements(tempo: Tempo = TEMPO_TABLEAU): string {
  const exercices = exercicesDuTableau();
  const formes = (forme: string) => exercices.filter((e) => formeDe(e) === forme);
  const liste = (es: Exercice[]) => es.map((e) => `\`${e.id}\``).join(', ');
  const unilateraux = exercices.filter((e) => e.cotes === 'unilateral' && e.unite === 'reps');
  const lignes: string[] = [
    '# Les mouvements, un par un',
    '',
    '<!-- Généré par `npm run mouvements` depuis le code (src/utils/tableauMouvements.ts) :',
    '     ne pas modifier à la main. Un test vérifie que ce fichier suit le code. -->',
    '',
    `Ce que dit le métronome de la séance guidée pour chacun des ${exercices.length} exercices de musculation,`,
    `au tempo par défaut (${tempo.monteeSec} s / ${tempo.descenteSec} s + ${tempo.pauseSec ?? 0} s), sur une série de ${REPS_TABLEAU} répétitions`,
    `(${REPS_TABLEAU} de chaque côté pour un exercice unilatéral). Chaque ligne est lue dans le vrai métronome :`,
    'les mots, leurs secondes, le changement de côté et la durée de la série sont ceux de l’application.',
    '',
    '- **Vertical** (par défaut) : MONTE, DESCENDS, et TIENS là où le muscle travaille — en bas quand la position',
    '  basse est étirée sous la charge, en haut quand elle est un repos, nulle part quand le bas fatigue le dos ou le genou.',
    `- **Circulaire** (${formes('circulaire').length}) : TOURNE, un tour complet par répétition, jamais d’arrêt ; à mi-série,`,
    `  « Change de sens ! », sans s’arrêter. ${liste(formes('circulaire'))}.`,
    `- **Rotation** (${formes('rotation').length}) : À DROITE puis À GAUCHE dans chaque répétition, jamais d’arrêt.`,
    `  ${liste(formes('rotation'))}.`,
    `- **Unilatéral** (${unilateraux.length}) : toutes les répétitions du côté droit, CHANGE DE CÔTÉ ${CHANGER_DE_COTE_SEC} s (« +${CHANGER_DE_COTE_SEC} s »`,
    '  en donne cinq de plus), puis le côté gauche. La durée annoncée compte les 5 s.',
    '- **Explosifs** : seulement quand l’option est cochée ; jamais d’arrêt.',
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
      const serie =
        exercice.unite === 'reps' ? formaterDuree(dureeSerieSec(exercice, REPS_TABLEAU, tempo)) : 'au temps';
      lignes.push(
        `| \`${exercice.id}\` | ${cellule(exercice.nomFr)} | ${cellule(uneRepetition(exercice, tempo))} | ${cellule(
          deroulementDesCotes(exercice, tempo),
        )} | ${serie} | ${cellule(pourquoi)} |`,
      );
    }
    lignes.push('');
  }
  return lignes.join('\n');
}
