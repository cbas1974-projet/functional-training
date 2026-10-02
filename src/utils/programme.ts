// Programme à deux : le vrai entraînement en salle, un cycle de séances fixes
// fait à deux. Toute la logique est ici, sans React : l'ordre des séries,
// la version allégée des soirs de jiu-jitsu, les charges de la dernière fois,
// la saisie rapide d'une liste d'exercices et la sauvegarde locale.
import type {
  Cible,
  EtatProgramme,
  ExerciceFait,
  ExerciceProgramme,
  Personne,
  Programme,
  SeanceADeuxEnCours,
  SeanceProgramme,
  SeanceProgrammeFaite,
  SerieFaite,
} from '../types';
import type { SensTempo } from './etapesSeance';

export const PERSONNES: Personne[] = ['moi', 'ami'];

/** Chacun son tour : c'est l'ami qui commence, puis on alterne. */
const ORDRE_TOUR: Personne[] = ['ami', 'moi'];

const CIBLE_PAR_DEFAUT: Cible = { series: 3, reps: 8 };

/** Les six séances du cycle, vides : chacun les remplit avec son programme. */
export const PROGRAMME_PAR_DEFAUT: Programme = {
  noms: { moi: 'Moi', ami: 'Mon ami' },
  seances: ['A', 'B', 'C', 'D', 'E', 'F'].map((lettre) => ({
    id: `seance-${lettre.toLowerCase()}`,
    nom: `Séance ${lettre}`,
    exercices: [],
  })),
  prochaine: 0,
  // Dimanche, mardi et jeudi soir.
  joursJiuJitsu: [0, 2, 4],
};

export const ETAT_PROGRAMME_PAR_DEFAUT: EtatProgramme = {
  programme: PROGRAMME_PAR_DEFAUT,
  historique: [],
  enCours: null,
};

/** Nombre maximal de séances gardées dans l'historique. */
const HISTORIQUE_MAXI = 300;

export function nouvelId(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** « Trap Bar », « trap bar » et « Trap  bar » désignent le même exercice :
 *  c'est par ce nom que les charges de la dernière fois se retrouvent, d'une
 *  séance du cycle à l'autre. */
export function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------- Le jour

/** Jour de jiu-jitsu le soir : la séance du matin est allégée pour « moi ». */
export function estJourAllege(date: Date, joursJiuJitsu: number[]): boolean {
  return joursJiuJitsu.includes(date.getDay());
}

/** Les cibles du jour. Version allégée : une série de moins pour « moi »,
 *  jamais moins d'une ; l'ami garde la sienne. */
export function ciblesDuJour(exercice: ExerciceProgramme, allegee: boolean): Record<Personne, Cible> {
  const moi = exercice.cibles.moi;
  return {
    moi: allegee ? { ...moi, series: Math.max(1, moi.series - 1) } : moi,
    ami: exercice.cibles.ami,
  };
}

// ------------------------------------------------------------- Les étapes

/** Ce que fait une personne pendant une étape. */
export interface PartEtape {
  personne: Personne;
  /** Numéro de la série, à partir de 1. */
  serie: number;
  series: number;
  reps: number;
}

/** Une étape de la séance : une série, faite par une personne (chacun son
 *  tour) ou par les deux à la fois (ensemble). */
export interface EtapeADeux {
  exerciceId: string;
  parts: PartEtape[];
}

/** Les étapes d'un exercice, dans l'ordre où elles se font.
 *  Chacun son tour : l'ami fait sa série 1, puis moi la mienne, puis l'ami sa
 *  série 2… Celui qui a plus de séries finit seul.
 *  Ensemble : une étape par numéro de série, avec ceux qui en ont encore. */
export function etapesExercice(exercice: ExerciceProgramme, allegee: boolean): EtapeADeux[] {
  const cibles = ciblesDuJour(exercice, allegee);
  const maxi = Math.max(cibles.moi.series, cibles.ami.series);
  const etapes: EtapeADeux[] = [];
  for (let serie = 1; serie <= maxi; serie += 1) {
    const ordre = exercice.facon === 'tour' ? ORDRE_TOUR : PERSONNES;
    const parts = ordre
      .filter((personne) => serie <= cibles[personne].series)
      .map((personne) => ({
        personne,
        serie,
        series: cibles[personne].series,
        reps: cibles[personne].reps,
      }));
    if (exercice.facon === 'ensemble') {
      etapes.push({ exerciceId: exercice.id, parts });
    } else {
      for (const part of parts) etapes.push({ exerciceId: exercice.id, parts: [part] });
    }
  }
  return etapes;
}

export function etapesSeance(seance: SeanceProgramme, allegee: boolean): EtapeADeux[] {
  return seance.exercices.flatMap((exercice) => etapesExercice(exercice, allegee));
}

/** Clé d'une série : `exerciceId:personne:serie`. */
export function cleSerie(exerciceId: string, personne: Personne, serie: number): string {
  return `${exerciceId}:${personne}:${serie}`;
}

// ------------------------------------------------------------- Le cycle

export function seanceSuivante(programme: Programme): SeanceProgramme {
  const n = programme.seances.length;
  return programme.seances[((programme.prochaine % n) + n) % n];
}

/** Après une séance, le cycle reprend à la suivante, même si l'on avait
 *  choisi une autre séance que celle prévue. */
export function apresSeance(programme: Programme, seanceId: string): Programme {
  const index = programme.seances.findIndex((seance) => seance.id === seanceId);
  if (index < 0) return programme;
  return { ...programme, prochaine: (index + 1) % programme.seances.length };
}

// ------------------------------------------------------------- Les charges

/** Charges de la dernière fois pour un exercice et une personne, série par
 *  série (index 0 = série 1, 0 = rien de noté). L'exercice est retrouvé par
 *  son nom, dans n'importe quelle séance du cycle. */
export function dernieresCharges(
  historique: SeanceProgrammeFaite[],
  nom: string,
  personne: Personne,
): number[] {
  const cle = normaliserNom(nom);
  for (const seance of historique) {
    const exercice = seance.exercices.find((e) => normaliserNom(e.nom) === cle);
    if (!exercice) continue;
    const series = exercice.series.filter((s) => s.personne === personne && s.poids > 0);
    if (series.length === 0) continue;
    const charges: number[] = [];
    for (const s of series) charges[s.serie - 1] = s.poids;
    return Array.from(charges, (valeur) => valeur ?? 0);
  }
  return [];
}

/** La charge à proposer pour une série : celle déjà saisie, sinon celle de la
 *  série précédente de la même personne (on garde presque toujours la même),
 *  sinon celle de la dernière fois. */
export function chargeProposee(
  enCours: Pick<SeanceADeuxEnCours, 'poids'>,
  historique: SeanceProgrammeFaite[],
  exercice: Pick<ExerciceProgramme, 'id' | 'nom'>,
  personne: Personne,
  serie: number,
): number | null {
  const saisie = enCours.poids[cleSerie(exercice.id, personne, serie)];
  if (saisie !== undefined && saisie > 0) return saisie;
  for (let precedente = serie - 1; precedente >= 1; precedente -= 1) {
    const valeur = enCours.poids[cleSerie(exercice.id, personne, precedente)];
    if (valeur !== undefined && valeur > 0) return valeur;
  }
  const passees = dernieresCharges(historique, exercice.nom, personne);
  const memeSerie = passees[serie - 1];
  if (memeSerie) return memeSerie;
  const derniere = [...passees].reverse().find((valeur) => valeur > 0);
  return derniere ?? null;
}

/** « 135 · 135 · 145 » : les charges de la dernière fois, en une ligne. */
export function libelleCharges(charges: number[]): string {
  return charges.filter((valeur) => valeur > 0).join(' · ');
}

// ------------------------------------------------------------- Le tempo

const DEPART_EN_HAUT = /squat|bench|couch[ée]|leg press|presse|fente|lunge|dips|pompe|push|hack|goblet/i;

/** Où commence une répétition : en haut pour un bench press ou un leg press
 *  (on descend d'abord), en bas pour un trap bar ou un rowing (on monte
 *  d'abord). Deviné d'après le nom tant qu'on ne l'a pas précisé. */
export function departDe(exercice: Pick<ExerciceProgramme, 'nom' | 'depart'>): 'haut' | 'bas' {
  return exercice.depart ?? (DEPART_EN_HAUT.test(exercice.nom) ? 'haut' : 'bas');
}

export function premiereDuDepart(depart: 'haut' | 'bas'): SensTempo {
  return depart === 'haut' ? 'descend' : 'monte';
}

// ------------------------------------------------------------- Saisie rapide

const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8,
  neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20,
};
const NOMBRE = '(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt)';
const SERIES_FOIS_REPS = new RegExp(`${NOMBRE}\\s*(?:x|×|\\*|fois)\\s*${NOMBRE}`, 'i');
const SERIES_DE_REPS = new RegExp(
  `${NOMBRE}\\s*s[ée]ries?\\s*(?:de\\s*)?${NOMBRE}(?:\\s*(?:r[ée]p[ée]titions?|reps?))?`,
  'i',
);

function lireNombre(texte: string): number {
  const mot = texte.toLowerCase();
  return NOMBRES[mot] ?? Number.parseInt(mot, 10);
}

/** Une liste tapée ou dictée, un exercice par ligne (ou séparés par des
 *  virgules) : « Trap bar 3x8 », « Bench press 3 fois 8 », « Leg press ».
 *  Les séries × répétitions sont facultatives. */
export function lireListe(texte: string): { nom: string; cible?: Cible }[] {
  const resultat: { nom: string; cible?: Cible }[] = [];
  for (const morceau of texte.split(/[\n;,]+/)) {
    let ligne = morceau.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim();
    if (!ligne) continue;
    let cible: Cible | undefined;
    const trouve = ligne.match(SERIES_FOIS_REPS) ?? ligne.match(SERIES_DE_REPS);
    if (trouve) {
      const series = lireNombre(trouve[1]);
      const reps = lireNombre(trouve[2]);
      if (series > 0 && series <= 10 && reps > 0 && reps <= 50) {
        cible = { series, reps };
        ligne = ligne.replace(trouve[0], ' ');
      }
    }
    const nom = ligne.replace(/\s+/g, ' ').replace(/[\s:–—-]+$/, '').trim();
    if (!nom) continue;
    resultat.push({ nom: nom.charAt(0).toUpperCase() + nom.slice(1), cible });
  }
  return resultat;
}

export function nouvelExercice(nom: string, cible: Cible = CIBLE_PAR_DEFAUT): ExerciceProgramme {
  return {
    id: nouvelId('exo'),
    nom,
    facon: 'tour',
    cibles: { moi: { ...cible }, ami: { ...cible } },
  };
}

// ------------------------------------------------------------- Fin de séance

/** Enregistre la séance en cours : les séries faites rejoignent l'historique
 *  et le cycle avance. Une séance où rien n'a été fait est simplement
 *  abandonnée. */
export function terminerSeance(etat: EtatProgramme, maintenant: Date): EtatProgramme {
  const enCours = etat.enCours;
  if (!enCours) return etat;
  const seance = etat.programme.seances.find((s) => s.id === enCours.seanceId);
  const faites = new Set(enCours.faites);
  if (!seance || faites.size === 0) return { ...etat, enCours: null };

  const exercices: ExerciceFait[] = [];
  for (const exercice of seance.exercices) {
    const series: SerieFaite[] = [];
    for (const etape of etapesExercice(exercice, enCours.allegee)) {
      for (const part of etape.parts) {
        const cle = cleSerie(exercice.id, part.personne, part.serie);
        if (!faites.has(cle)) continue;
        series.push({ personne: part.personne, serie: part.serie, poids: enCours.poids[cle] ?? 0 });
      }
    }
    if (series.length > 0) exercices.push({ exerciceId: exercice.id, nom: exercice.nom, series });
  }

  const faite: SeanceProgrammeFaite = {
    id: nouvelId('faite'),
    date: maintenant.toISOString(),
    seanceId: seance.id,
    nomSeance: seance.nom,
    allegee: enCours.allegee,
    exercices,
  };
  return {
    programme: apresSeance(etat.programme, seance.id),
    historique: [faite, ...etat.historique].slice(0, HISTORIQUE_MAXI),
    enCours: null,
  };
}

// ------------------------------------------------------------- Sauvegarde

const CLE_PROGRAMME = 'functional-training-programme';

const entier = (valeur: unknown, mini: number, maxi: number, defaut: number): number =>
  typeof valeur === 'number' && Number.isFinite(valeur)
    ? Math.min(maxi, Math.max(mini, Math.round(valeur)))
    : defaut;

function lireCible(brut: unknown): Cible {
  const c = (brut ?? {}) as Partial<Cible>;
  return {
    series: entier(c.series, 1, 10, CIBLE_PAR_DEFAUT.series),
    reps: entier(c.reps, 1, 50, CIBLE_PAR_DEFAUT.reps),
  };
}

function lireExercice(brut: unknown): ExerciceProgramme | null {
  const e = (brut ?? {}) as Partial<ExerciceProgramme>;
  if (typeof e.id !== 'string' || typeof e.nom !== 'string') return null;
  const cibles = (e.cibles ?? {}) as Partial<Record<Personne, unknown>>;
  return {
    id: e.id,
    nom: e.nom,
    facon: e.facon === 'ensemble' ? 'ensemble' : 'tour',
    cibles: { moi: lireCible(cibles.moi), ami: lireCible(cibles.ami) },
    ...(e.depart === 'haut' || e.depart === 'bas' ? { depart: e.depart } : {}),
  };
}

/** Relit une sauvegarde en comblant ce qui manque : une donnée abîmée ne doit
 *  jamais empêcher l'application de s'ouvrir. */
export function migrerEtatProgramme(brut: unknown): EtatProgramme {
  const sauve = (brut ?? {}) as Partial<EtatProgramme>;
  const p = (sauve.programme ?? {}) as Partial<Programme>;
  const seances = Array.isArray(p.seances)
    ? p.seances
        .filter((s): s is SeanceProgramme => typeof s?.id === 'string')
        .map((s) => ({
          id: s.id,
          nom: typeof s.nom === 'string' ? s.nom : 'Séance',
          exercices: Array.isArray(s.exercices)
            ? s.exercices.map(lireExercice).filter((e): e is ExerciceProgramme => e !== null)
            : [],
        }))
    : [];
  const programme: Programme = {
    noms: {
      moi: typeof p.noms?.moi === 'string' && p.noms.moi.trim() ? p.noms.moi : PROGRAMME_PAR_DEFAUT.noms.moi,
      ami: typeof p.noms?.ami === 'string' && p.noms.ami.trim() ? p.noms.ami : PROGRAMME_PAR_DEFAUT.noms.ami,
    },
    seances: seances.length > 0 ? seances : PROGRAMME_PAR_DEFAUT.seances,
    prochaine: 0,
    joursJiuJitsu: Array.isArray(p.joursJiuJitsu)
      ? p.joursJiuJitsu.filter((j) => Number.isInteger(j) && j >= 0 && j <= 6)
      : PROGRAMME_PAR_DEFAUT.joursJiuJitsu,
  };
  programme.prochaine = entier(p.prochaine, 0, programme.seances.length - 1, 0);

  const historique = Array.isArray(sauve.historique)
    ? sauve.historique
        .filter((h) => typeof h?.id === 'string' && Array.isArray(h.exercices))
        .map((h) => ({
          ...h,
          exercices: h.exercices.filter((e) => typeof e?.nom === 'string' && Array.isArray(e.series)),
        }))
    : [];
  const enCours = sauve.enCours ?? null;
  const enCoursValide =
    enCours !== null && programme.seances.some((s) => s.id === enCours.seanceId)
      ? {
          ...enCours,
          poids: enCours.poids ?? {},
          faites: Array.isArray(enCours.faites) ? enCours.faites : [],
          etape: entier(enCours.etape, 0, 10_000, 0),
        }
      : null;
  return { programme, historique, enCours: enCoursValide };
}

export function chargerEtatProgramme(): EtatProgramme {
  try {
    const brut = localStorage.getItem(CLE_PROGRAMME);
    return brut === null ? ETAT_PROGRAMME_PAR_DEFAUT : migrerEtatProgramme(JSON.parse(brut));
  } catch (erreur) {
    console.error('Lecture du programme impossible :', erreur);
    return ETAT_PROGRAMME_PAR_DEFAUT;
  }
}

export function enregistrerEtatProgramme(etat: EtatProgramme): void {
  try {
    localStorage.setItem(CLE_PROGRAMME, JSON.stringify(etat));
  } catch (erreur) {
    console.error('Enregistrement du programme impossible :', erreur);
  }
}
