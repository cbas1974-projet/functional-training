// L'horloge commune d'une séance à deux, vue d'un téléphone : où en est
// chacun à partir de l'état partagé, et ce que fait chaque bouton.
//
// La règle de fond : l'horloge commune n'écourte jamais la série de
// quelqu'un, elle ne fait que raccourcir les attentes. « Go », « Pause » et
// « Reprendre » valent pour les deux. « Suivant » dépend de qui travaille :
// pendant une attente à deux, on repart ensemble — au plus tard quand
// l'attente de l'autre finit ; pendant ma série, si l'autre m'attend, il
// commence plus tôt ; s'il travaille aussi, seul mon téléphone avance — j'ai
// plus de repos, et l'on repart ensemble.
import type { BlocSeries, Seance } from '../types';
import type { Etape } from './etapesSeance';
import { indexApresExercice } from './etapesSeance';
import { tempsActifMs } from './etatCommun';
import type { ActionCommune, EtatCommun, Instant } from './etatCommun';

/** Où en est quelqu'un : l'étape, et le temps passé dedans. Négatif pour une
 *  attente où l'on arrive en avance — elle durera d'autant plus. */
export interface Position {
  index: number;
  ecouleSec: number;
}

/** On est passé de soi-même à l'étape `vers` (série finie plus tôt,
 *  exercice passé) : on la déroule à son rythme jusqu'à la prochaine attente,
 *  où l'horloge commune reprend la main. */
export interface Ecart {
  vers: number;
  /** L'instant du passage, sur l'horloge du serveur. */
  depuis: Instant;
}

const estManuelle = (etape: Etape) => etape.type === 'repos' && etape.manuel === true;

/** Les étapes qui retiennent : on n'en sort qu'avec l'horloge commune. Les
 *  attentes — leur fin est le départ commun du tour suivant —, l'installation,
 *  le retour au calme et la fin. */
export const estBarriere = (etape: Etape): boolean =>
  etape.type === 'repos' || etape.type === 'reposTour' || etape.type === 'retourCalme' || etape.type === 'fin';

/** Le point de départ en cours : le début de la séance, ou le dernier « Go »
 *  déjà donné. */
function ancre(etapes: Etape[], etat: EtatCommun, t: Instant): { index: number; instant: Instant } {
  let ancree = { index: 0, instant: etat.debut };
  etapes.forEach((etape, i) => {
    if (etape.type !== 'repos' || !etape.manuel || etape.groupe === undefined) return;
    const go = etat.go[String(etape.groupe)];
    if (go !== undefined && go <= t && i + 1 > ancree.index) ancree = { index: i + 1, instant: go };
  });
  return ancree;
}

/** Secondes entre le départ en cours et le début de l'étape `index`. */
function departSec(etapes: Etape[], depuis: number, index: number): number {
  let total = 0;
  for (let i = depuis; i < index; i += 1) total += etapes[i].dureeSec;
  return total;
}

/** La position sur l'horloge commune, sans écart personnel. Une
 *  installation attend « Go » : on y reste, le temps continue de courir. */
export function positionCommune(etapes: Etape[], etat: EtatCommun, t: Instant): Position {
  const { index: debut, instant } = ancre(etapes, etat, t);
  let reste = tempsActifMs(etat, instant, t) / 1000;
  for (let i = debut; i < etapes.length; i += 1) {
    const etape = etapes[i];
    if (etape.type === 'fin') return { index: i, ecouleSec: 0 };
    if (estManuelle(etape) || reste < etape.dureeSec) return { index: i, ecouleSec: reste };
    reste -= etape.dureeSec;
  }
  return { index: etapes.length - 1, ecouleSec: 0 };
}

/** La position à afficher : la commune, ou celle de l'écart tant qu'il
 *  tient. Un écart tombe quand l'horloge commune rattrape la première
 *  attente qui suit son départ — pas avant : une série commencée à son
 *  rythme se finit à son rythme. */
export function positionAffichee(
  etapes: Etape[],
  etat: EtatCommun,
  t: Instant,
  ecart: Ecart | null,
): { position: Position; ecart: Ecart | null } {
  const commune = positionCommune(etapes, etat, t);
  if (!ecart || ecart.vers >= etapes.length) return { position: commune, ecart: null };
  // À son rythme, les pauses communes comprises.
  let reste = tempsActifMs(etat, ecart.depuis, t, false) / 1000;
  for (let i = ecart.vers; i < etapes.length; i += 1) {
    const etape = etapes[i];
    if (estBarriere(etape)) {
      if (commune.index >= i) return { position: commune, ecart: null };
      // On attend l'horloge commune : l'attente finit à la même seconde pour
      // tout le monde.
      const { index: debut, instant } = ancre(etapes, etat, t);
      const communeSec = tempsActifMs(etat, instant, t) / 1000;
      return { position: { index: i, ecouleSec: communeSec - departSec(etapes, debut, i) }, ecart };
    }
    if (reste < etape.dureeSec) return { position: { index: i, ecouleSec: reste }, ecart };
    reste -= etape.dureeSec;
  }
  return { position: commune, ecart: null };
}

/** La séance du point de vue de l'autre : ses séries et ses répétitions, et
 *  c'est lui qui commence là où je ne commence pas. Ses étapes se calent
 *  sur la même horloge. */
export function perspectiveAutre(seance: Seance): Seance | null {
  const horloge = seance.horloge;
  if (!horloge?.partenaire || !seance.blocs.some((bloc) => bloc.autre)) return null;
  const blocs = seance.blocs.map((bloc): BlocSeries => {
    const inverse: BlocSeries = {
      exerciceId: bloc.exerciceId,
      series: bloc.autre?.series ?? 0,
      reps: bloc.autre?.reps ?? bloc.reps,
      reposSec: bloc.reposSec,
      autre: { series: bloc.series, reps: bloc.reps },
    };
    if (bloc.superset !== undefined) inverse.superset = bloc.superset;
    if (bloc.transitionSec !== undefined) inverse.transitionSec = bloc.transitionSec;
    if (bloc.tour) inverse.tour = true;
    return inverse;
  });
  return { ...seance, blocs, horloge: { ...horloge, jeCommence: !horloge.jeCommence } };
}

// ------------------------------------------------------------- Les boutons

export interface Contexte {
  etapes: Etape[];
  /** Les étapes de l'autre, sur la même horloge. */
  etapesAutre: Etape[];
  etat: EtatCommun;
  t: Instant;
  /** Ce qu'affiche mon téléphone. */
  position: Position;
  /** Le prénom de l'autre, pour les messages. */
  partenaire: string;
}

/** Ce que produit un appui : un changement pour les deux, un écart pour
 *  moi seul, ou rien, avec la raison. */
export type Decision =
  | { genre: 'commune'; action: ActionCommune; confirmer?: string }
  | { genre: 'locale'; ecart: Ecart }
  | { genre: 'refus'; raison: string };

/** On travaille : la préparation, la série. */
const estTravail = (etape: Etape) => etape.type === 'serie' || etape.type === 'pret' || etape.type === 'station';

/** L'autre, en ce moment : il travaille, il m'attend, ou il attend comme moi. */
function etatDeLAutre(contexte: Contexte): 'travaille' | 'm-attend' | 'attend' {
  const { etapesAutre, etat, t } = contexte;
  const etape = etapesAutre[positionCommune(etapesAutre, etat, t).index];
  if (!etape) return 'attend';
  if (estTravail(etape)) return 'travaille';
  if (etape.type === 'repos' && (etape.motif === 'tour' || etape.motif === 'serie-de-plus' || etape.motif === 'attente')) {
    return 'm-attend';
  }
  return 'attend';
}

/** La fin de l'étape `index`, en secondes d'horloge commune depuis le départ
 *  en cours. */
const finEtapeSec = (etapes: Etape[], etat: EtatCommun, t: Instant, index: number) =>
  departSec(etapes, ancre(etapes, etat, t).index, index) + etapes[index].dureeSec;

/** Quand finit l'attente de l'autre, en secondes d'horloge commune depuis le
 *  départ en cours : null s'il travaille ; l'infini s'il attend « Go » ou
 *  s'étire à la fin — rien ne l'y presse. */
function finAttenteAutre(contexte: Contexte): number | null {
  const { etapesAutre, etat, t } = contexte;
  const { index } = positionCommune(etapesAutre, etat, t);
  const etape = etapesAutre[index];
  if (!etape || estManuelle(etape) || etape.type === 'retourCalme' || etape.type === 'fin') return Infinity;
  if (estTravail(etape)) return null;
  return finEtapeSec(etapesAutre, etat, t, index);
}

/** Écourter mon étape pour les deux, sans entamer la série de l'autre :
 *  l'horloge commune avance jusqu'à la fin de mon étape — ou de l'attente de
 *  l'autre, si elle finit avant. Deux appuis visent la même seconde : le
 *  second ne change rien. */
function ecourter(contexte: Contexte): Decision {
  const { etapes, etat, t, position, partenaire } = contexte;
  const finAutre = finAttenteAutre(contexte);
  if (finAutre === null) return { genre: 'refus', raison: `${partenaire} finit sa série.` };
  const depuis = ancre(etapes, etat, t).instant;
  const cible = Math.min(finEtapeSec(etapes, etat, t, position.index), finAutre);
  // L'attente de l'autre finit à l'instant : il n'y a rien à écourter.
  if (cible - tempsActifMs(etat, depuis, t) / 1000 < 0.5) return { genre: 'refus', raison: '' };
  return { genre: 'commune', action: { type: 'saut', depuis, cible } };
}

/** Le temps passé sur les étapes qu'on vient de quitter, quand l'étape
 *  affichée change : le temps réellement écoulé depuis le dernier affichage,
 *  réparti dans l'ordre sur les étapes franchies, chacune au plus sa durée.
 *  Une série vécue écran éteint compte en entier ; une attente écourtée, un
 *  exercice passé ne comptent que ce qu'ils ont duré. */
export function tempsDesEtapesQuittees(
  etapes: Etape[],
  avant: Position,
  apres: Position,
  ecouleReelSec: number,
): [index: number, sec: number][] {
  const vu = Math.max(0, avant.ecouleSec);
  if (apres.index <= avant.index) return [[avant.index, vu]];
  let reste = vu + Math.max(0, ecouleReelSec);
  const temps: [number, number][] = [];
  for (let i = avant.index; i < apres.index; i += 1) {
    const part = Math.min(etapes[i].dureeSec, reste);
    temps.push([i, i === avant.index ? Math.max(vu, part) : part]);
    reste = Math.max(0, reste - part);
  }
  return temps;
}

/** « Suivant », « Série terminée », « Passer », « Go ». */
export function decisionSuivant(contexte: Contexte): Decision {
  const { etapes, position, t, partenaire } = contexte;
  const etape = etapes[position.index];
  if (!etape) return { genre: 'refus', raison: '' };
  switch (etape.type) {
    case 'repos':
      if (etape.manuel && etape.groupe !== undefined) {
        // Avant de lancer l'exercice pour les deux, on vérifie que l'autre a
        // fini le précédent.
        const iciPourLui = contexte.etapesAutre.findIndex(
          (e) => e.type === 'repos' && e.manuel === true && e.groupe === etape.groupe,
        );
        const luiEnRetard = positionCommune(contexte.etapesAutre, contexte.etat, t).index < iciPourLui;
        return {
          genre: 'commune',
          action: { type: 'go', groupe: etape.groupe },
          ...(luiEnRetard ? { confirmer: `${partenaire} n’a pas fini l’exercice. Passer au suivant pour les deux ?` } : {}),
        };
      }
      return ecourter(contexte);
    case 'reposTour':
    case 'echauffement':
      return ecourter(contexte);
    case 'serie':
      // L'autre m'attend : il commence plus tôt.
      if (etatDeLAutre(contexte) === 'm-attend') return ecourter(contexte);
      return { genre: 'locale', ecart: { vers: position.index + 1, depuis: t } };
    default:
      // La préparation, les étirements de fin : à son rythme.
      return { genre: 'locale', ecart: { vers: position.index + 1, depuis: t } };
  }
}

/** « Passer l'exercice » : pour moi seul — un genou qui fait mal. L'autre
 *  continue, on repart ensemble au « Go » suivant. */
export function decisionPasserExercice(contexte: Contexte): Decision {
  const vers = indexApresExercice(contexte.etapes, contexte.position.index);
  if (vers <= contexte.position.index) return { genre: 'refus', raison: '' };
  return { genre: 'locale', ecart: { vers, depuis: contexte.t } };
}

/** « +15 s » pendant une attente : l'horloge commune s'arrête quinze
 *  secondes, pour les deux, s'ils attendent tous les deux. Pendant la série
 *  de l'autre, ce serait sa série qui s'allongerait. */
export function decisionProlonger(contexte: Contexte, sec: number): Decision {
  if (finAttenteAutre(contexte) === null) {
    return { genre: 'refus', raison: `${contexte.partenaire} est en pleine série.` };
  }
  return { genre: 'commune', action: { type: 'prolonger', sec } };
}
