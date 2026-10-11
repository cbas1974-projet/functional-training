// L'essai : la séance du jour en version courte, pour essayer l'application —
// ou voir l'écran de l'autre — sans rien enregistrer. La séance produite
// normalement entre, sa version d'une dizaine de minutes sort. Tout est pur,
// sauf la lecture du serveur, qui choisit la séance commune d'un essai en
// direct.
import type { BlocSeries, MouvementGuide, ParametresSeance, Seance, SeanceDuMois } from '../types';
import { construireEtapes, dureeTotaleSec } from './etapesSeance';
import type { Etape } from './etapesSeance';
import { lireEtat } from './etatCommun';
import type { EtatCommun, Instant } from './etatCommun';
import { positionCommune } from './horlogeCommune';
import { autrePersonne, seancePourPersonne } from './programmeMois';
import type { ContexteSeance } from './programmeMois';

/** Une seule série par exercice. */
export const SERIES_ESSAI = 1;
/** Un tiers de répétitions en moins (ou de secondes, pour un exercice au
 *  temps) : au tempo lent, une série de 10 en prend 100 s. */
const repsEssai = (reps: number) => Math.max(1, Math.ceil((reps * 2) / 3));
/** Le repos après un exercice, en secondes. */
export const REPOS_ESSAI_SEC = 15;
/** La mise en place avant chaque nouvel exercice, en secondes (30 en vrai). */
export const INSTALLATION_ESSAI_SEC = 10;
/** L'échauffement, puis les étirements : une demi-minute chacun. */
export const MOUVEMENTS_ESSAI_SEC = 30;
/** Ces deux phases ne gardent que leurs premiers mouvements. */
const MOUVEMENTS_GARDES = 2;

/** Une phase — l'échauffement, les étirements — ramenée à une demi-minute :
 *  ses premiers mouvements, à parts égales. */
function raccourcirPhase(
  mouvements: MouvementGuide[] | undefined,
  dureeSec: number,
): { mouvements?: MouvementGuide[]; dureeSec: number } {
  // Pas de phase, pas de demi-minute à inventer.
  if (dureeSec <= 0) return { ...(mouvements ? { mouvements } : {}), dureeSec: 0 };
  // Sans le détail des mouvements, c'est la durée seule qu'on ramène.
  if (!mouvements) return { dureeSec: Math.min(dureeSec, MOUVEMENTS_ESSAI_SEC) };
  const gardes = mouvements.slice(0, MOUVEMENTS_GARDES);
  return {
    mouvements: gardes.map((mouvement) => ({ ...mouvement, dureeSec: MOUVEMENTS_ESSAI_SEC / gardes.length })),
    dureeSec: gardes.length > 0 ? MOUVEMENTS_ESSAI_SEC : 0,
  };
}

/** La séance, version d'essai : une seule série par exercice, un tiers de
 *  répétitions en moins, des repos de 15 s au plus, une mise en place courte,
 *  une demi-minute d'échauffement et autant d'étirements. Les exercices, les
 *  paires, chacun son tour et le tempo ne changent pas : seuls la longueur
 *  des séries et les attentes se raccourcissent. Une dizaine de minutes seul,
 *  un peu plus à deux, où l'horloge suit le plus lent des deux. */
export function raccourcirPourEssai(seance: Seance): Seance {
  const blocs = seance.blocs.map(
    (bloc): BlocSeries => ({
      ...bloc,
      series: Math.min(bloc.series, SERIES_ESSAI),
      reps: repsEssai(bloc.reps),
      reposSec: Math.min(bloc.reposSec, REPOS_ESSAI_SEC),
      ...(bloc.autre
        ? { autre: { series: Math.min(bloc.autre.series, SERIES_ESSAI), reps: repsEssai(bloc.autre.reps) } }
        : {}),
    }),
  );
  const echauffement = raccourcirPhase(seance.echauffement, seance.echauffementSec);
  const retourCalme = raccourcirPhase(seance.retourCalme, seance.retourCalmeSec);
  const courte: Seance = {
    ...seance,
    blocs,
    echauffementSec: echauffement.dureeSec,
    retourCalmeSec: retourCalme.dureeSec,
    ...(echauffement.mouvements ? { echauffement: echauffement.mouvements } : {}),
    ...(retourCalme.mouvements ? { retourCalme: retourCalme.mouvements } : {}),
    ...(seance.horloge ? { horloge: { ...seance.horloge, installationSec: INSTALLATION_ESSAI_SEC } } : {}),
  };
  return { ...courte, dureeEstimeeSec: dureeTotaleSec(construireEtapes(courte)) };
}

/** L'aperçu : le même essai, vu par l'autre — ses répétitions, qui commence
 *  quand c'est chacun son tour, ses étirements. Rien de ce téléphone n'y
 *  entre : pas le cran de plus que proposent ses propres charges, ni ses
 *  ressentis. Null tant qu'on ne sait pas qui est l'autre. */
export function seanceApercu(
  seanceMois: SeanceDuMois,
  parametres: ParametresSeance,
  contexte: ContexteSeance,
): Seance | null {
  if (!contexte.personne) return null;
  const autre: ContexteSeance = {
    ...contexte,
    personne: autrePersonne(contexte.personne),
    augmenter: [],
    ressentis: {},
  };
  return raccourcirPourEssai(seancePourPersonne(seanceMois, parametres, autre));
}

// ------------------------------------------------------------- Rien n'est gardé

/** Ce qui distingue un essai d'une vraie séance, pour l'écran de la séance
 *  guidée : un bandeau du début à la fin, et rien d'enregistré. */
export interface Essai {
  /** 'essai' : la séance du jour en version courte ; 'apercu' : la même, vue
   *  par l'autre. */
  genre: 'essai' | 'apercu';
  /** Le bandeau qui reste affiché pendant toute la séance. */
  bandeau: string;
  /** L'écran de fin : son titre, et le bouton qui ferme sans rien garder. */
  titreFin: string;
  boutonFin: string;
}

export const ESSAI: Essai = {
  genre: 'essai',
  bandeau: 'Essai — rien n’est enregistré',
  titreFin: 'Essai terminé',
  boutonFin: 'Terminer l’essai',
};

/** L'aperçu : l'essai tel que l'autre le voit. */
export const apercuDe = (nom: string): Essai => ({
  genre: 'apercu',
  bandeau: `Aperçu : l’écran de ${nom} — rien n’est enregistré`,
  titreFin: 'Aperçu terminé',
  boutonFin: 'Terminer l’aperçu',
});

// ------------------------------------------------------------- Séance commune
//
// Un essai en direct a sa propre séance commune, numérotée : « -essai-1 »,
// « -essai-2 »… On peut le refaire autant de fois qu'on veut le même soir
// sans retomber sur un essai fini. Les deux téléphones qui le lancent
// ensemble tombent sur le même numéro : ils lisent les mêmes états sur le
// serveur, et la règle qui choisit ne dépend de rien d'autre.

/** Le serveur accepte au plus quarante caractères après le jour. */
const LONGUEUR_MAXI_IDENTIFIANT = 40;

/** L'identifiant de la séance commune du Ne essai : celui de la séance, plus
 *  « -essai-N ». Le serveur en fait une séance à part : la vraie séance du
 *  jour ne reprend jamais là où l'essai s'est arrêté. L'identifiant est coupé
 *  au besoin, jamais le numéro. */
export function identifiantSeanceEssai(seanceId: string, numero: number): string {
  const suffixe = `-essai-${numero}`;
  return `${seanceId.slice(0, LONGUEUR_MAXI_IDENTIFIANT - suffixe.length)}${suffixe}`;
}

/** Un essai se rejoint tant qu'il a bougé il y a moins de vingt minutes :
 *  c'est celui que l'autre vient de lancer. Plus vieux, il est fini ou
 *  abandonné. */
export const ESSAI_RECENT_MS = 20 * 60 * 1000;

/** L'horloge commune de l'essai est arrivée à son dernier écran. */
const essaiFini = (etat: EtatCommun, maintenant: Instant, etapes: Etape[]): boolean =>
  etapes[positionCommune(etapes, etat, maintenant).index]?.type === 'fin';

/** Le numéro de l'essai à lancer. `etats[0]` est l'état de la séance commune
 *  du numéro 1, `etats[1]` celui du numéro 2…, null quand le serveur n'en a
 *  pas : le numéro est libre. `maintenant` est l'heure du serveur, `etapes`
 *  celles de l'essai, pour savoir s'il est fini.
 *
 *  On rejoint le premier essai qui existe, n'est pas fini et a bougé il y a
 *  moins de vingt minutes. Sinon, on prend le premier numéro libre — le
 *  suivant du dernier état lu, quand tout ce qu'on a lu est pris. */
export function numeroEssai(etats: (EtatCommun | null)[], maintenant: Instant, etapes: Etape[]): number {
  const enCours = etats.findIndex(
    (etat) => etat !== null && maintenant - etat.maj < ESSAI_RECENT_MS && !essaiFini(etat, maintenant, etapes),
  );
  if (enCours >= 0) return enCours + 1;
  const libre = etats.indexOf(null);
  return (libre >= 0 ? libre : etats.length) + 1;
}

/** Ce que le serveur dit d'une séance commune. */
export interface LectureSeance {
  /** Son état ; null quand elle n'existe pas encore. */
  etat: EtatCommun | null;
  /** L'heure du serveur, la même pour les deux téléphones. */
  heure: Instant;
}

/** Lit la séance commune d'un numéro ; rejette quand le serveur ne répond pas. */
export type LireSeance = (numero: number, signal: AbortSignal) => Promise<LectureSeance>;

/** Le lecteur du serveur : la séance commune de l'essai d'un numéro. */
export const lecteurDeSeanceEssai =
  (config: { serveur: string; equipe: string; jour: string; seanceId: string }): LireSeance =>
  async (numero, signal) => {
    const cle = `${config.jour}_${identifiantSeanceEssai(config.seanceId, numero)}`;
    const reponse = await fetch(`${config.serveur}/api/equipes/${config.equipe}/seances/${cle}`, {
      cache: 'no-store',
      signal,
    });
    if (!reponse.ok) throw new Error(`Le serveur répond ${reponse.status}`);
    const { etat, heure } = (await reponse.json()) as { etat?: unknown; heure?: unknown };
    return {
      etat: lireEtat(etat),
      heure: typeof heure === 'number' && Number.isFinite(heure) ? heure : Date.now(),
    };
  };

/** Le serveur a quelques secondes pour répondre, pas plus. */
export const DELAI_SERVEUR_MS = 4000;
/** Les numéros lus d'un coup. */
const LOT_LECTURES = 6;
/** On ne cherche pas plus loin : soixante essais en un jour, cela n'existe pas. */
const NUMEROS_MAXI = 60;

/** Le numéro de l'essai en direct à lancer, d'après ce que dit le serveur :
 *  les numéros sont lus dans l'ordre (par lots), et `numeroEssai` choisit.
 *
 *  Le serveur ne répond pas, ou pas assez vite : l'essai part quand même, sans
 *  attendre plus que `delaiMs`, avec le numéro que donnent les états déjà lus
 *  — le premier qu'on n'a pas pu lire, donc le 1 si le serveur est muet. */
export async function trouverNumeroEssai(
  lire: LireSeance,
  seance: Seance,
  delaiMs: number = DELAI_SERVEUR_MS,
): Promise<number> {
  const etapes = construireEtapes(seance);
  const etats: (EtatCommun | null)[] = [];
  /** L'heure du serveur ; celle du téléphone tant qu'il n'a rien dit. */
  let heure: Instant | null = null;
  const decider = () => numeroEssai(etats, heure ?? Date.now(), etapes);

  const arret = new AbortController();
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<'delai'>((resoudre) => {
    minuterie = setTimeout(() => {
      arret.abort();
      resoudre('delai');
    }, delaiMs);
  });
  try {
    // Tant que tout ce qu'on a lu est pris, le numéro suivant n'est pas lu.
    while (decider() > etats.length && etats.length < NUMEROS_MAXI) {
      const lot = await Promise.race([
        Promise.allSettled(Array.from({ length: LOT_LECTURES }, (_, i) => lire(etats.length + 1 + i, arret.signal))),
        delai,
      ]);
      if (lot === 'delai') break;
      for (const lecture of lot) {
        // Une lecture manque : on garde les numéros lus jusque-là.
        if (lecture.status === 'rejected') return decider();
        etats.push(lecture.value.etat);
        heure = Math.max(heure ?? 0, lecture.value.heure);
      }
    }
  } finally {
    clearTimeout(minuterie);
  }
  return decider();
}
