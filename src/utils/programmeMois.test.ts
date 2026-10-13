import { describe, expect, it } from 'vitest';
import type { Exercice, ParametresSeance, ProgrammeMois, SeanceDuMois, SeanceRealisee } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT, TEMPOS } from '../data/parametres';
import { construireEtapes, dureeTotaleSec, etatMetronome } from './etapesSeance';
import {
  changementDeCoteSec,
  cleMouvement,
  exercicesDisponibles,
  secondesAuTemps,
  secondesParRep,
  tempoPourExercice,
} from './generateurSeance';
import { OBJECTIFS_MUSCULAIRES } from './muscles';
import * as moduleProgramme from './programmeMois';
import {
  COPENHAGUE,
  DEVELOPPE_DU_MARDI,
  DUREE_MAXI_SEC,
  EXERCICES_CLASSIQUES,
  EXERCICES_MIS_DE_COTE,
  EXERCICES_PAR_DEFAUT,
  JOURS_JIU_JITSU,
  MATERIELS_PROGRAMME,
  NOMBRES_EXERCICES,
  HORS_PROGRAMME,
  POINTS_FAIBLES,
  POINTS_FAIBLES_PAR_DEFAUT,
  REPOS_PAIRE_SEC,
  REPOS_PAIRE_TRAP_BAR_SEC,
  REPOS_SEC,
  REPOS_TRAP_BAR_SEC,
  REPS_LUNDI_PAR_DEFAUT,
  REPS_MAX_SOULEVE,
  REPS_PAR_DEFAUT,
  SUPERMAN,
  SWING_DU_JEUDI,
  TEMPO_PROGRAMME,
  TRANSITION_LIEN_SEC,
  VERSION_PROGRAMME,
  accordPaire,
  adresseServeurValide,
  alternatives,
  apparier,
  avecNombreExercices,
  avecPointsFaibles,
  avecTempo,
  basculerTour,
  candidatsProgramme,
  chargeLeBasDuDos,
  chargeReglable,
  chargeDeSerie,
  chargeProposee,
  chargesPassees,
  decoderProgramme,
  delierDansProgramme,
  encoderEnEntier,
  encoderProgramme,
  dureeSec,
  equipeDe,
  estRetouche,
  estSouleveLourd,
  echauffementDe,
  etirementsDe,
  etirementsPauseDe,
  faiteCetteSemaine,
  genererProgramme,
  lienDePartage,
  lierDansProgramme,
  nombreExercicesDe,
  notePlafond,
  pairesAutomatiques,
  plieLeDos,
  pointFaibleDe,
  pointsFaiblesDe,
  prochaineDate,
  prochaineSeance,
  programmeDansLien,
  refairePaires,
  refaireProgramme,
  remplacerDansProgramme,
  reposDe,
  reposDePaire,
  repsA,
  repsDuDuo,
  repsDuJour,
  repsLundiDe,
  rolesDe,
  seanceAProposer,
  seancePourPersonne,
  semaineDe,
  serieDePlus,
  tempoDuProgramme,
  validerProgramme,
} from './programmeMois';
import type { ContexteSeance } from './programmeMois';
import { grandesZonesDe, memeZone } from './zones';

/** Lundi 5 octobre 2026. */
const LUNDI = new Date(2026, 9, 5);
const jour = (decalage: number, heure = 8) => new Date(2026, 9, 5 + decalage, heure);

const GRAINES = Array.from({ length: 30 }, (_, i) => i + 1);
const programmes = GRAINES.map((graine) => genererProgramme({ graine, aujourdhui: LUNDI }));

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };
/** Les objectifs d'usage : bas du dos, épaules, extérieur et intérieur de cuisse. */
const OBJECTIFS_PAR_DEFAUT_TEST = ['bas-du-dos', 'epaules', 'exterieur-cuisse', 'interieur-cuisse'];
const TOUS_LES_OBJECTIFS = OBJECTIFS_MUSCULAIRES.map((o) => o.id);
/** Quelques jeux d'objectifs, du plus simple au plus chargé — jusqu'aux huit
 *  ensemble. */
const JEUX_OBJECTIFS: (string[] | undefined)[] = [
  undefined,
  ['bas-du-dos', 'epaules'],
  ['bas-du-dos'],
  [],
  ['jambes', 'tronc'],
  ['interieur-cuisse'],
  ['bras'],
  TOUS_LES_OBJECTIFS,
];
/** Les programmes composés pour ces essais, gardés d'un test à l'autre : en
 *  composer plusieurs centaines prend plusieurs secondes. */
const MEMOIRE = new Map<string, ProgrammeMois>();
function programmeCompose(
  nombre: number,
  objectifs: string[] | undefined,
  graine: number,
  alternance = true,
): ProgrammeMois {
  const cle = `${nombre}|${objectifs ? `[${objectifs.join('+')}]` : 'défaut'}|${graine}|${alternance}`;
  let programme = MEMOIRE.get(cle);
  if (!programme) {
    programme = genererProgramme({ graine, aujourdhui: LUNDI, exercices: nombre, alternance, ...(objectifs ? { objectifs } : {}) });
    MEMOIRE.set(cle, programme);
  }
  return programme;
}
/** Les exercices de chaque paire d'une séance. */
const pairesDe = (seance: SeanceDuMois): [Exercice, Exercice][] =>
  (seance.liens ?? []).map(([a, b]) => [EXERCICES_PAR_ID[a], EXERCICES_PAR_ID[b]]);
/** Les quatre façons de faire une séance : seul ou à deux, sur le téléphone
 *  de Sébastien ou sur celui de Max. */
const SEUL_SEB: ContexteSeance = { personne: 'sebastien' };
const SEUL_MAX: ContexteSeance = { personne: 'max' };
const DUO_SEB: ContexteSeance = { personne: 'sebastien', aDeux: true };
const DUO_MAX: ContexteSeance = { personne: 'max', aDeux: true };
const CONTEXTES = [SEUL_SEB, SEUL_MAX, DUO_SEB, DUO_MAX];

const exercicesDe = (seance: SeanceDuMois): Exercice[] => seance.exercices.map((id) => EXERCICES_PAR_ID[id]);
/** Le nombre d'exercices d'une séance sans le dernier : celui du réglage, le
 *  dernier compris, moins un — les trois jours. */
const voulus = (nombre: number) => nombre - 1;
/** Les paires d'une séance : tous ses exercices sauf le premier et le dernier,
 *  deux par deux. */
const pairesVoulues = (nombre: number) => (nombre - 2) / 2;
/** Les deux machines des cuisses, les préférées du duo : chaque jeudi,
 *  semaine A comme semaine B — plus jamais ensemble, deux exercices des
 *  jambes. */
const MACHINES_DU_JEUDI = ['leg-extension-machine', 'leg-curl-machine'];
/** Ce qui revient chaque semaine, en plus du lundi tout entier : le développé
 *  couché le mardi, le swing, la planche de Copenhague et les deux machines
 *  le jeudi. */
const FAVORIS = [DEVELOPPE_DU_MARDI, SWING_DU_JEUDI, COPENHAGUE, ...MACHINES_DU_JEUDI];
/** Les grandes zones d'un exercice : le haut du corps, le bas, le tronc. */
const zonesDe = (e: Exercice) => grandesZonesDe(e);
/** Une jambe légère : un exercice d'isolation des jambes, sans machine — sauf
 *  celle des mollets, assise et légère. */
const jambeLegere = (e: Exercice) =>
  zonesDe(e).join() === 'bas' &&
  e.pattern === 'isolation' &&
  (e.materiel !== 'salle' || (e.musclesPrincipaux ?? []).includes('mollets'));
/** La fin du mardi, qui épargne la poigne : des pompes. */
const POMPES = ['dumbbell-push-up', 'kb-push-up'];
/** La fin du lundi : la marche du fermier. */
const MARCHES_DU_FERMIER = ['farmers-walk', 'kb-farmers-walk'];
/** Les deux machines lourdes des jambes : l'une d'elles, en paire, le lundi. */
const PRESSES = ['leg-press', 'hack-squat'];
/** Le gainage classique : deux planches. */
const PLANCHES = ['plank', 'side-plank'];
/** Le lundi, le même chaque semaine (13 octobre 2026) : une seule séance. */
const LES_LUNDIS = ['lundi'];
const LES_MARDIS = ['mardi-a', 'mardi-b'];
const LES_JEUDIS = ['jeudi-a', 'jeudi-b'];
/** Un tirage léger du haut du corps : le partenaire du swing. */
const tirageLeger = (e: Exercice) => rolesDe(e).length === 1 && rolesDe(e)[0] === 'tire' && !chargeLeBasDuDos(e);
/** Les étirements des jambes de chaque fin de séance : mollet, avant de la cuisse,
 *  arrière de la cuisse, fessier. */
const ETIREMENTS_DES_JAMBES = ['etir-mollet-mur', 'etir-quadriceps-cote', 'etir-ischios-allonge', 'etir-fessier-chiffre-4'];
/** Retirés des étirements de fin : l'écart debout, la fente et la flexion avant debout. */
const ETIREMENTS_RETIRES = ['etir-ecart-coudes-genoux', 'etir-fente-laterale', 'etir-ischios-debout'];
const seanceNommee = (programme: ProgrammeMois, id: string) => programme.seances.find((s) => s.id === id)!;
const vise = (seance: SeanceDuMois, muscle: string) =>
  exercicesDe(seance).some((e) => (e.musclesPrincipaux ?? []).some((m) => m === muscle));

function realisee(titre: string | undefined, date: Date, exercices: SeanceRealisee['exercices'] = []): SeanceRealisee {
  return {
    id: `${titre}-${date.getTime()}`,
    date: date.toISOString(),
    ...(titre ? { titre } : {}),
    parametres: PARAMETRES_PAR_DEFAUT,
    dureePrevueSec: 3600,
    dureeReelleSec: 3600,
    exercices,
    terminee: true,
  };
}

describe('genererProgramme', () => {
  it('compose la semaine : le lundi tout le corps, le même chaque semaine ; le mardi le haut et le jeudi les jambes, en semaines A et B', () => {
    expect(programmes[0].seances.map((s) => [s.id, s.nom, s.jour, s.semaine, s.type, s.partie, s.format])).toEqual([
      ['lundi', 'Lundi — tout le corps', 1, undefined, 'dure', 'complet', 'series'],
      ['mardi-a', 'Mardi A — le haut', 2, 'A', 'facile', 'haut', 'series'],
      ['jeudi-a', 'Jeudi A — les jambes', 4, 'A', 'facile', 'bas', 'series'],
      ['mardi-b', 'Mardi B — le haut', 2, 'B', 'facile', 'haut', 'series'],
      ['jeudi-b', 'Jeudi B — les jambes', 4, 'B', 'facile', 'bas', 'series'],
    ]);
    // Le lundi revient chaque semaine : la séance de référence, où l'on pousse.
    const p = programmes[0];
    expect(prochaineSeance(p, jour(0))?.seance.id).toBe('lundi');
    expect(prochaineSeance(p, jour(7))?.seance.id).toBe('lundi');
    expect(prochaineSeance(p, jour(14))?.seance.id).toBe('lundi');
  });

  it('huit exercices les trois jours : le premier et le dernier seuls, trois paires de deux zones différentes entre les deux', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        const cas = `${p.graine} · ${s.id}`;
        // Sept exercices et le dernier ; le premier seul, puis trois paires
        // côte à côte, et rien d'autre.
        expect(s.exercices, cas).toHaveLength(7);
        expect(s.liens, cas).toHaveLength(3);
        expect(s.liens!.flat(), cas).toEqual(s.exercices.slice(1));
        for (const [a, b] of pairesDe(s)) {
          expect(accordPaire(a, b).accord, `${cas} · ${a.id} + ${b.id}`).toBe('bon');
          // Jamais deux exercices de la même zone : le haut, le bas, le tronc.
          expect(memeZone(a, b), `${cas} · ${a.id} + ${b.id}`).toBe(false);
        }
        // Ni l'ouverture ni la finale ne sont dans une paire.
        expect(s.liens!.flat(), cas).not.toContain(s.exercices[0]);
        expect(s.liens!.flat(), cas).not.toContain(s.finale);
        // La séance guidée les déroule ainsi : l'ouverture seule, chaque paire
        // est un groupe, la finale vient seule après.
        const blocs = seancePourPersonne(s, PARAMETRES, DUO_MAX, LUNDI).blocs;
        expect(blocs.map((b) => b.superset), cas).toEqual([undefined, 0, 0, 1, 1, 2, 2, undefined]);
        expect(blocs.at(-1)?.exerciceId).toBe(s.finale);
      }
    }
  });

  it('sans alternance, les trois jours reviennent chaque semaine', () => {
    const p = genererProgramme({ graine: 1, aujourdhui: LUNDI, alternance: false });
    expect(p.seances.map((s) => [s.id, s.nom, s.semaine])).toEqual([
      ['lundi', 'Lundi — tout le corps', undefined],
      ['mardi', 'Mardi — le haut', undefined],
      ['jeudi', 'Jeudi — les jambes', undefined],
    ]);
  });

  it('le mardi et le jeudi changent en semaine B ce qu’ils peuvent — sauf leurs favoris, les reprises du lundi et la planche', () => {
    for (const p of programmes) {
      const lundi = seanceNommee(p, 'lundi');
      const duLundi = new Set([...lundi.exercices, lundi.finale!].map((id) => cleMouvement(EXERCICES_PAR_ID[id])));
      for (const [a, b] of [
        ['mardi-a', 'mardi-b'],
        ['jeudi-a', 'jeudi-b'],
      ]) {
        const deA = new Set(exercicesDe(seanceNommee(p, a)).map(cleMouvement));
        const repris = exercicesDe(seanceNommee(p, b)).filter((e) => deA.has(cleMouvement(e)));
        // Le gainage classique n'a que deux planches : la semaine B reprend
        // celle de la semaine A plutôt que de laisser le ventre sans exercice.
        const autorises = (e: Exercice) => FAVORIS.includes(e.id) || duLundi.has(cleMouvement(e)) || PLANCHES.includes(e.id);
        expect(repris.filter((e) => !autorises(e)).map((e) => e.id), `${p.graine} · ${b}`).toEqual([]);
        // Mais elle change ce qu'elle peut : jamais la même séance.
        expect(seanceNommee(p, b).exercices, `${p.graine} · ${b}`).not.toEqual(seanceNommee(p, a).exercices);
      }
      // Les favoris, eux, reviennent chaque semaine.
      for (const id of LES_MARDIS) expect(seanceNommee(p, id).exercices[0]).toBe(DEVELOPPE_DU_MARDI);
      for (const id of LES_JEUDIS) {
        expect(seanceNommee(p, id).exercices[0]).toBe(SWING_DU_JEUDI);
        expect(seanceNommee(p, id).exercices).toEqual(expect.arrayContaining([...MACHINES_DU_JEUDI, COPENHAGUE]));
      }
    }
  });

  it('les gros exercices reviennent dans la semaine : chaque mardi reprend deux exercices du haut du lundi, chaque jeudi un exercice du lundi', () => {
    for (const nombre of [6, 8]) {
      for (const graine of GRAINES) {
        const p = programmeCompose(nombre, undefined, graine);
        const lundi = seanceNommee(p, 'lundi');
        const duLundi = new Set([...lundi.exercices, lundi.finale!]);
        for (const id of LES_MARDIS) {
          const repris = seanceNommee(p, id).exercices.filter((x) => duLundi.has(x) && zonesDe(EXERCICES_PAR_ID[x]).join() === 'haut');
          // Un développé et un rowing — à six exercices, la place manque pour le
          // second.
          expect(repris.length, `${nombre} · ${graine} · ${id}`).toBeGreaterThanOrEqual(nombre === 8 ? 2 : 1);
        }
        for (const id of LES_JEUDIS) {
          const repris = seanceNommee(p, id).exercices.filter((x) => duLundi.has(x));
          expect(repris.length, `${nombre} · ${graine} · ${id}`).toBeGreaterThanOrEqual(1);
          // Jamais la trap bar, la presse ni le hack squat un jeudi modéré.
          for (const lourd of ['trap-bar-deadlift', ...PRESSES]) expect(repris).not.toContain(lourd);
        }
      }
    }
    // Le rowing du lundi, par exemple, revient le mardi et le jeudi.
    const p = programmes[0];
    const rowing = seanceNommee(p, 'lundi').exercices.find((x) => EXERCICES_PAR_ID[x].pattern === 'tirage-horizontal')!;
    expect(rowing).toBeDefined();
    for (const id of [...LES_MARDIS, ...LES_JEUDIS]) expect(seanceNommee(p, id).exercices, id).toContain(rowing);
  });

  it('un même mouvement ne revient pas deux fois dans une séance', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        const cles = [...exercicesDe(s), EXERCICES_PAR_ID[s.finale!]].map(cleMouvement);
        expect(new Set(cles).size).toBe(cles.length);
      }
    }
  });

  it('vise les faiblesses : bas du dos, épaules et extérieur de cuisse le lundi, épaules le mardi, intérieur de cuisse le jeudi', () => {
    for (const p of programmes) {
      for (const id of LES_LUNDIS) {
        expect(vise(seanceNommee(p, id), 'lombaires')).toBe(true);
        expect(vise(seanceNommee(p, id), 'epaules')).toBe(true);
        // L'extérieur de cuisse vient le lundi, avec le haut du corps : le
        // jeudi n'a plus de place pour lui.
        expect(vise(seanceNommee(p, id), 'abducteurs')).toBe(true);
      }
      for (const id of LES_MARDIS) expect(vise(seanceNommee(p, id), 'epaules')).toBe(true);
      for (const id of LES_JEUDIS) expect(vise(seanceNommee(p, id), 'adducteurs')).toBe(true);
    }
  });

  it('le lundi s’ouvre sur la trap bar, seule ; le Superman et le ventre vont chacun avec le haut du corps ; on tire et on pousse ; la presse ou le hack squat en paire ; la marche du fermier pour finir', () => {
    for (const p of programmes) {
      for (const id of LES_LUNDIS) {
        const seance = seanceNommee(p, id);
        const lundi = exercicesDe(seance);
        const cas = `${p.graine} · ${id}`;
        // La trap bar en tête, seule, chacun son tour.
        expect(lundi[0].id, cas).toBe('trap-bar-deadlift');
        expect(seance.liens!.flat(), cas).not.toContain('trap-bar-deadlift');
        // Le Superman, sans poids, et le ventre — du gainage, le dos immobile
        // — sont du tronc : chacun va avec le haut du corps, jamais ensemble.
        const avecSuperman = pairesDe(seance).find((paire) => paire.some((e) => e.id === SUPERMAN));
        expect(avecSuperman, cas).toBeDefined();
        const partenaireDuSuperman = zonesDe(avecSuperman!.find((e) => e.id !== SUPERMAN)!);
        expect(partenaireDuSuperman, cas).toContain('haut');
        expect(partenaireDuSuperman, cas).not.toContain('tronc');
        const ventre = lundi.find((e) => e.pattern === 'anti-rotation');
        expect(ventre, cas).toBeDefined();
        expect(seance.exercices, cas).not.toContain('kb-superman');
        // On tire, sans charger le bas du dos — la trap bar l'a déjà fait : un
        // rowing —, et on pousse.
        const tirages = lundi.filter((e) => e.pattern === 'tirage-horizontal' || e.pattern === 'tirage-vertical');
        expect(tirages.length, cas).toBeGreaterThan(0);
        expect(tirages.filter(chargeLeBasDuDos), cas).toEqual([]);
        expect(lundi.some((e) => e.pattern === 'poussee-horizontale' || e.pattern === 'poussee-verticale'), cas).toBe(true);
        // Une seule charnière lourde : le bas du dos se travaille à part.
        const charnieres = lundi.filter((e) => e.pattern === 'charniere' && (e.musclesPrincipaux ?? []).includes('ischios'));
        expect(charnieres.map((e) => e.id), cas).toEqual(['trap-bar-deadlift']);
        // La presse ou le hack squat, en paire avec le haut du corps — la
        // machine chacun son tour — ; la marche du fermier pour finir, sans
        // jiu-jitsu le soir pour la poigne.
        const presse = seance.exercices.find((x) => PRESSES.includes(x))!;
        expect(presse, cas).toBeDefined();
        const avecPresse = pairesDe(seance).find((paire) => paire.some((e) => e.id === presse))!;
        expect(zonesDe(avecPresse.find((e) => e.id !== presse)!), cas).toEqual(['haut']);
        expect(MARCHES_DU_FERMIER, cas).toContain(seance.finale);
        // Une machine pour deux : chacun son tour, d'office.
        expect(seance.tour, cas).toEqual(['trap-bar-deadlift', presse]);
      }
    }
  });

  it('le mardi, le haut du corps et le jiu-jitsu le soir : le développé couché seul, puis chaque exercice du haut avec le ventre ou une jambe légère, rien qui charge le bas du dos ; des pompes pour finir, qui épargnent la poigne', () => {
    for (const p of programmes) {
      for (const id of LES_MARDIS) {
        const seance = seanceNommee(p, id);
        const cas = `${p.graine} · ${id}`;
        expect(seance.exercices[0], cas).toBe(DEVELOPPE_DU_MARDI);
        expect(exercicesDe(seance).filter(chargeLeBasDuDos), cas).toEqual([]);
        // Deux exercices du haut ne vont jamais ensemble : chaque paire a un
        // exercice du haut, et pour partenaire le ventre, le dos immobile, ou
        // une jambe légère (le mollet, l'extérieur de cuisse).
        for (const [a, b] of pairesDe(seance)) {
          const [haut, autre] = zonesDe(a).includes('haut') ? [a, b] : [b, a];
          expect(zonesDe(haut), `${cas} · ${a.id} + ${b.id}`).toEqual(['haut']);
          // La planche latérale est du tronc et de l'extérieur de la hanche.
          const partenaireLeger = (zonesDe(autre).includes('tronc') && autre.pattern === 'anti-rotation') || jambeLegere(autre);
          expect(partenaireLeger, `${cas} · ${autre.id}`).toBe(true);
        }
        // Les épaules, et les bras.
        expect(vise(seance, 'epaules'), cas).toBe(true);
        expect(vise(seance, 'biceps') || vise(seance, 'triceps'), cas).toBe(true);
        // Des pompes pour finir : plus de marche du fermier le mardi, qui
        // userait la poigne avant les prises du kimono.
        expect(POMPES, cas).toContain(seance.finale);
        expect([...seance.exercices, seance.finale!].filter((x) => MARCHES_DU_FERMIER.includes(x)), cas).toEqual([]);
        // Une seule machine possible : celle des mollets, chacun son tour.
        for (const machine of seance.tour ?? []) expect(machine, cas).toBe('seated-calf-raise');
      }
    }
  });

  it('le jeudi, les jambes, modéré : le swing seul en tête ; la planche de Copenhague et les deux machines, chacune avec le ventre ou un tirage léger ; le traîneau pour finir', () => {
    for (const p of programmes) {
      for (const id of LES_JEUDIS) {
        const seance = seanceNommee(p, id);
        const cas = `${p.graine} · ${id}`;
        // Le swing en tête, seul, chacun son tour.
        expect(seance.exercices[0], cas).toBe(SWING_DU_JEUDI);
        expect(seance.liens!.flat(), cas).not.toContain(SWING_DU_JEUDI);
        // Chaque exercice des jambes va avec le ventre ou un tirage léger du
        // haut du corps : jamais deux exercices des jambes ensemble — les deux
        // machines ne vont donc plus ensemble.
        for (const [a, b] of pairesDe(seance)) {
          const [jambe, autre] = zonesDe(a).includes('bas') ? [a, b] : [b, a];
          expect(zonesDe(jambe), `${cas} · ${a.id} + ${b.id}`).toEqual(['bas']);
          expect(zonesDe(autre).join() === 'tronc' || tirageLeger(autre), `${cas} · ${autre.id}`).toBe(true);
        }
        expect(seance.liens, cas).not.toContainEqual(MACHINES_DU_JEUDI);
        // L'intérieur de cuisse : la planche de Copenhague courte, et les deux
        // machines des cuisses — chaque semaine.
        expect(seance.exercices, cas).toEqual(expect.arrayContaining([COPENHAGUE, ...MACHINES_DU_JEUDI]));
        // Ni trap bar, ni presse, ni hack squat : le traîneau pour finir.
        const ids = [...seance.exercices, seance.finale];
        for (const lourd of ['trap-bar-deadlift', 'leg-press', 'hack-squat']) expect(ids, cas).not.toContain(lourd);
        expect(seance.finale, cas).toBe('traineau');
        expect(seance.tour, cas).toEqual([...MACHINES_DU_JEUDI, 'traineau']);
      }
    }
  });

  it('les machines se font chacun son tour ; les bancs non — il y en a cinq ou six dans la salle', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        const surMachine = [...s.exercices, s.finale!].filter((id) => EXERCICES_PAR_ID[id].materiel === 'salle');
        expect(s.tour ?? [], `${p.graine} · ${s.id}`).toEqual(surMachine);
        for (const bloc of seancePourPersonne(s, PARAMETRES, DUO_SEB, LUNDI).blocs) {
          if (EXERCICES_PAR_ID[bloc.exerciceId].materiel === 'banc') expect(bloc.tour, bloc.exerciceId).toBeUndefined();
        }
      }
    }
    // Il y en a bien, des exercices au banc.
    expect(programmes.flatMap((p) => p.seances.flatMap(exercicesDe)).some((e) => e.materiel === 'banc')).toBe(true);
  });

  it('jamais deux exercices qui chargent le bas du dos dans une paire, quels que soient les objectifs et le nombre', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const objectifs of JEUX_OBJECTIFS) {
        for (const graine of GRAINES.slice(0, 8)) {
          const p = programmeCompose(nombre, objectifs, graine);
          for (const s of p.seances) {
            const cas = `${nombre} · ${objectifs} · graine ${graine} · ${s.id}`;
            // Le nombre du jour : le premier seul, les autres en paires.
            expect(s.exercices, cas).toHaveLength(voulus(nombre));
            expect(s.liens, cas).toHaveLength(pairesVoulues(nombre));
            expect(s.liens!.flat(), cas).not.toContain(s.exercices[0]);
            for (const [a, b] of pairesDe(s)) {
              expect(chargeLeBasDuDos(a) && chargeLeBasDuDos(b), `${cas} · ${a.id} + ${b.id}`).toBe(false);
              expect(accordPaire(a, b).accord, `${cas} · ${a.id} + ${b.id}`).toBe('bon');
              // Jamais deux exercices de la même zone.
              expect(memeZone(a, b), `${cas} · ${a.id} + ${b.id}`).toBe(false);
            }
            // Le swing ouvre le jeudi, seul : jamais en paire.
            expect(s.liens!.flat(), cas).not.toContain(SWING_DU_JEUDI);
            // Les deux machines, quand elles y sont, ne vont jamais ensemble.
            expect(s.liens, cas).not.toContainEqual(MACHINES_DU_JEUDI);
            // Jamais deux fois le même mouvement : l'oiseau aux haltères et
            // au kettlebell comptent pour un (le jeudi tirait les deux).
            const mouvements = [...s.exercices, ...(s.finale ? [s.finale] : [])].map((id) => cleMouvement(EXERCICES_PAR_ID[id]));
            expect(new Set(mouvements).size, cas).toBe(mouvements.length);
            expect(dureeSec(s)).toBeLessThanOrEqual(DUREE_MAXI_SEC);
          }
        }
      }
    }
    // Des centaines de programmes : plus long que les cinq secondes d'usage.
  }, 30_000);

  it('dit la raison de chaque paire : deux zones différentes — le haut avec le bas ou le tronc, le bas avec le tronc', () => {
    const raisons = new Set(programmes.flatMap((p) => p.seances.flatMap((s) => pairesDe(s).map(([a, b]) => accordPaire(a, b).raison))));
    for (const raison of raisons) {
      expect(['quadriceps ↔ bas du dos', 'haut ↔ bas', 'haut ↔ tronc', 'bas ↔ tronc', 'deux zones différentes']).toContain(raison);
    }
  });

  it('par défaut, huit exercices les trois jours, le dernier compris, au tempo 3 s / 3 s + 1 s en bas : environ 1 h 03 le lundi, 1 h 07 le mardi, 1 h le jeudi, à deux sur un téléphone', () => {
    expect(EXERCICES_PAR_DEFAUT).toBe(8);
    expect(TEMPO_PROGRAMME).toEqual({ monteeSec: 3, descenteSec: 3, pauseSec: 1 });
    const durees: Record<number, number[]> = { 1: [], 2: [], 4: [] };
    for (const p of programmes) {
      expect(nombreExercicesDe(p)).toBe(8);
      expect(tempoDuProgramme(p)).toEqual(TEMPO_PROGRAMME);
      for (const s of p.seances) {
        expect(s.exercices).toHaveLength(7);
        expect(s.finale).toBeDefined();
        const seance = seancePourPersonne(
          s,
          PARAMETRES,
          { ...DUO_SEB, unTelephone: true, tempo: tempoDuProgramme(p) },
          LUNDI,
        );
        expect(seance.parametres.tempo).toEqual(TEMPO_PROGRAMME);
        expect(seance.blocs).toHaveLength(8);
        // La durée annoncée est celle que mesure le programme.
        expect(seance.dureeEstimeeSec).toBe(dureeSec(s));
        durees[s.jour].push(seance.dureeEstimeeSec / 60);
      }
    }
    const moyenne = (d: number[]) => d.reduce((somme, x) => somme + x, 0) / d.length;
    // Le lundi, environ 1 h 03, le même chaque semaine : la trap bar chacun
    // son tour, une pause d'un toucher entre les tours ; trois paires sans
    // pause entre les tours — la presse chacun son tour —, une minute de pause
    // à la fin de chacune (une minute trente après la trap bar) ; la marche du
    // fermier pour finir, qui enchaîne ses tours.
    expect(Math.min(...durees[1])).toBeGreaterThan(60);
    expect(Math.max(...durees[1])).toBeLessThan(66);
    // Le mardi, environ 1 h 07 : le développé couché et les pompes, chacun son
    // tour avec une pause entre les tours — Big Max y fait une série de plus,
    // les pecs sont un de ses points faibles.
    expect(Math.min(...durees[2])).toBeGreaterThan(63);
    expect(Math.max(...durees[2])).toBeLessThan(72);
    expect(moyenne(durees[2])).toBeGreaterThan(65);
    expect(moyenne(durees[2])).toBeLessThan(69);
    // Le jeudi, environ une heure, sans machine lourde : ses deux machines,
    // un seul siège, se font chacun son tour (audit du 13 octobre 2026) ; le
    // swing et le traîneau, une pause entre les tours.
    expect(Math.min(...durees[4])).toBeGreaterThan(56);
    expect(Math.max(...durees[4])).toBeLessThan(66);
    expect(moyenne(durees[4])).toBeGreaterThan(58);
    expect(moyenne(durees[4])).toBeLessThan(63);
  });

  it('seul, la séance ne dure pas plus qu’à deux : sans l’autre, une pause entre deux séries d’un exercice seul, au lieu de sa série', () => {
    for (const p of programmes.slice(0, 10)) {
      for (const s of p.seances) {
        for (const contexte of [SEUL_SEB, SEUL_MAX]) {
          expect(dureeSec(s, {}, { ...contexte, unTelephone: true })).toBeLessThanOrEqual(
            dureeSec(s, {}, { ...DUO_SEB, unTelephone: true }),
          );
        }
      }
    }
  });

  it('ne prend que de la musculation à la portée du matériel de la salle ; un seul explosif, le swing du jeudi', () => {
    const possedes = new Set<string>(['aucun', ...MATERIELS_PROGRAMME]);
    for (const p of programmes) {
      for (const s of p.seances) {
        for (const e of exercicesDe(s)) {
          expect(e.explosif ?? false).toBe(e.id === SWING_DU_JEUDI);
          expect(e.niveauMin).toBeLessThanOrEqual(2);
          expect(possedes.has(e.materiel)).toBe(true);
          expect(e.unite === 'reps' || e.unite === 'secondes').toBe(true);
        }
      }
    }
  });

  it('le premier mois, que des exercices classiques — dans le programme comme dans « Changer »', () => {
    const classiques = new Set(EXERCICES_CLASSIQUES);
    // La liste : des exercices de la bibliothèque, sans double ; le Superman
    // sans poids et la planche de Copenhague, choisis par Sébastien ; la
    // nouvelle machine à mollets ; rien d'inhabituel.
    expect(classiques.size).toBe(EXERCICES_CLASSIQUES.length);
    for (const id of EXERCICES_CLASSIQUES) expect(EXERCICES_PAR_ID[id], id).toBeDefined();
    for (const id of [SUPERMAN, COPENHAGUE, 'seated-calf-raise', 'plank', 'side-plank', SWING_DU_JEUDI, 'kb-goblet-squat']) {
      expect(classiques.has(id), id).toBe(true);
    }
    const inhabituels = [
      'fire-hydrant', 'kb-windmill', 'woodchop', 'kb-wood-chop', 'kb-single-leg-calf-raise', 'kb-around-the-body',
      'kb-half-turkish-get-up', 'kb-halo', 'kb-plank-oblique-pull-through', 'kb-side-plank-twist', 'kb-lawn-mower',
      'kb-side-leg-raise', 'curl-to-overhead-press', 'kb-good-morning', 'thruster',
    ];
    for (const id of inhabituels) expect(classiques.has(id), id).toBe(false);
    // Les candidats du programme, et tout ce qu'il compose : des classiques.
    for (const e of candidatsProgramme(MATERIELS_PROGRAMME)) expect(classiques.has(e.id), e.id).toBe(true);
    for (const nombre of NOMBRES_EXERCICES) {
      for (const objectifs of JEUX_OBJECTIFS) {
        for (const graine of GRAINES.slice(0, 6)) {
          const p = programmeCompose(nombre, objectifs, graine);
          for (const s of p.seances) {
            for (const id of [...s.exercices, ...(s.finale ? [s.finale] : [])]) {
              expect(classiques.has(id), `${nombre} · ${objectifs} · ${graine} · ${s.id} · ${id}`).toBe(true);
            }
          }
        }
      }
    }
    // « Changer » ne propose que des classiques, partenaires compris.
    for (const p of programmes.slice(0, 10)) {
      for (const s of p.seances) {
        for (const id of [...s.exercices, s.finale!]) {
          for (const e of alternatives(p, s.id, id, 200)) expect(classiques.has(e.id), `${s.id} · ${id} → ${e.id}`).toBe(true);
        }
      }
    }
  }, 30_000);

  it('la machine à mollets, assise, est au programme et se fait chacun son tour ; le mollet sur une jambe au kettlebell n’y est plus', () => {
    // À six et huit exercices (à quatre, il n'y a pas de place pour les
    // mollets), quels que soient les objectifs : la machine est là chaque mois.
    for (const nombre of [6, 8]) {
      for (const objectifs of JEUX_OBJECTIFS) {
        for (const graine of GRAINES.slice(0, 6)) {
          const p = programmeCompose(nombre, objectifs, graine);
          const cas = `${nombre} · ${objectifs} · ${graine}`;
          const avecMachine = p.seances.filter((s) => s.exercices.includes('seated-calf-raise'));
          expect(avecMachine.length, cas).toBeGreaterThan(0);
          // Une machine pour deux : chacun son tour.
          for (const s of avecMachine) expect(s.tour, `${cas} · ${s.id}`).toContain('seated-calf-raise');
          for (const s of p.seances) expect([...s.exercices, s.finale], `${cas} · ${s.id}`).not.toContain('kb-single-leg-calf-raise');
        }
      }
    }
    // Les deux mardis se partagent les mollets : la machine l'un, les haltères
    // l'autre.
    for (const p of programmes) {
      const mollets = LES_MARDIS.flatMap((id) => seanceNommee(p, id).exercices.filter((x) => x === 'seated-calf-raise' || x === 'calf-raise'));
      expect(mollets.sort(), `${p.graine}`).toEqual(['calf-raise', 'seated-calf-raise']);
    }
    // « Changer » le mollet aux haltères : la machine d'abord.
    const p = programmes[0];
    const avecHalteres = p.seances.find((s) => s.exercices.includes('calf-raise'))!;
    expect(alternatives(p, avecHalteres.id, 'calf-raise')[0].id).toBe('seated-calf-raise');
    // Les deux jambes ensemble, et l'arrêt en bas, talons sous la marche, comme
    // au mollet sur une marche.
    const machine = EXERCICES_PAR_ID['seated-calf-raise'];
    expect([machine.materiel, machine.cotes, machine.unite, machine.pauseEnHaut ?? false]).toEqual(['salle', 'bilateral', 'reps', false]);
    expect(EXERCICES_PAR_ID['kb-single-leg-calf-raise'].pauseEnHaut ?? false).toBe(false);
  });

  it('même graine, même programme ; graines différentes, programmes différents', () => {
    expect(genererProgramme({ graine: 7, aujourdhui: LUNDI })).toEqual(genererProgramme({ graine: 7, aujourdhui: LUNDI }));
    const empreintes = new Set(programmes.map((p) => JSON.stringify(p.seances)));
    expect(empreintes.size).toBeGreaterThan(GRAINES.length / 2);
  });

  it('suit les objectifs choisis, et compose quand même sans objectif', () => {
    for (const graine of GRAINES.slice(0, 10)) {
      const p = genererProgramme({ graine, aujourdhui: LUNDI, objectifs: ['bras'] });
      expect(p.objectifs).toEqual(['bras']);
      for (const id of LES_MARDIS) {
        expect(vise(seanceNommee(p, id), 'biceps') || vise(seanceNommee(p, id), 'triceps')).toBe(true);
      }
      const sansObjectif = genererProgramme({ graine, aujourdhui: LUNDI, objectifs: [] });
      expect(sansObjectif.seances.every((s) => s.exercices.length >= 3 && s.finale !== undefined)).toBe(true);
    }
  });
});

describe('les réglages du programme : le nombre d’exercices et le tempo', () => {
  const p = programmes[2];

  it('changent le nombre d’exercices — les trois jours, le dernier compris — et la durée, pareil pour les deux', () => {
    expect(NOMBRES_EXERCICES).toEqual([4, 6, 8]);
    let precedente = 0;
    for (const nombre of NOMBRES_EXERCICES) {
      const regle = avecNombreExercices(p, nombre);
      expect(nombreExercicesDe(regle)).toBe(nombre);
      // Même graine, même premier lundi, même équipe : l'autre téléphone
      // recompose le même programme.
      expect([regle.graine, regle.debut, equipeDe(regle)]).toEqual([p.graine, p.debut, equipeDe(p)]);
      expect(avecNombreExercices(JSON.parse(JSON.stringify(p)), nombre)).toEqual(regle);
      for (const s of regle.seances) {
        expect(s.exercices).toHaveLength(voulus(nombre));
        expect(s.liens).toHaveLength(pairesVoulues(nombre));
        expect(s.finale).toBeDefined();
      }
      // Le lundi garde la trap bar en tête, le mardi le développé couché, le
      // jeudi le swing ; le lundi dure plus à chaque paire.
      const lundi = seanceNommee(regle, 'lundi');
      expect(lundi.exercices[0]).toBe('trap-bar-deadlift');
      expect(seanceNommee(regle, 'mardi-a').exercices[0]).toBe(DEVELOPPE_DU_MARDI);
      expect(seanceNommee(regle, 'jeudi-a').exercices[0]).toBe(SWING_DU_JEUDI);
      expect(dureeSec(lundi)).toBeGreaterThan(precedente);
      precedente = dureeSec(lundi);
    }
    // Revenir à huit : le programme du début. Dix ne se choisit plus.
    expect(avecNombreExercices(avecNombreExercices(p, 6), 8).seances).toEqual(p.seances);
    expect(nombreExercicesDe(avecNombreExercices(p, 10))).toBe(8);
  });

  it('un nombre choisi avant un seul téléphone ne dit plus la même chose : on repart à huit, les trois jours', () => {
    // Avant la version 8, « 6 » voulait dire 6 le mardi et le jeudi, 8 le
    // lundi. Les autres réglages du duo restent.
    const reps = { sebastien: 10, max: 12 };
    const ancien = validerProgramme({ ...p, version: 7, duo: { exercices: 6, reps } })!;
    expect(ancien.version).toBe(VERSION_PROGRAMME);
    expect(nombreExercicesDe(ancien)).toBe(8);
    expect(ancien.duo).toEqual({ reps });
    expect(ancien.seances).toEqual(p.seances);
    // Le nombre était son seul réglage : plus de réglages du tout.
    expect(validerProgramme({ ...p, version: 7, duo: { exercices: 4 } })!.duo).toBeUndefined();
    // Choisi dans cette version-ci, il reste.
    const six = avecNombreExercices(p, 6);
    expect(nombreExercicesDe(validerProgramme(JSON.parse(JSON.stringify(six)))!)).toBe(6);
  });

  it('les objectifs passent d’abord : à quatre exercices — l’ouverture, une paire, le dernier —, le premier objectif du jour y est encore', () => {
    for (const programme of programmes.slice(0, 10)) {
      const court = avecNombreExercices(programme, 4);
      for (const id of LES_LUNDIS) {
        const lundi = seanceNommee(court, id);
        expect(lundi.exercices).toHaveLength(3);
        expect(lundi.exercices[0]).toBe('trap-bar-deadlift');
        // Le bas du dos : le Superman.
        expect(vise(lundi, 'lombaires')).toBe(true);
      }
      for (const id of LES_JEUDIS) {
        const jeudi = seanceNommee(court, id);
        expect(jeudi.exercices[0]).toBe(SWING_DU_JEUDI);
        expect(vise(jeudi, 'adducteurs')).toBe(true);
      }
      for (const id of LES_MARDIS) expect(vise(seanceNommee(court, id), 'epaules')).toBe(true);
    }
  });

  it('le tempo change la durée, pas les exercices', () => {
    const rapide = avecTempo(p, { monteeSec: 2, descenteSec: 4 });
    expect(rapide.seances).toEqual(p.seances);
    expect(tempoDuProgramme(rapide)).toEqual({ monteeSec: 2, descenteSec: 4 });
    for (const s of p.seances) {
      const lente = seancePourPersonne(s, PARAMETRES, { ...DUO_SEB, tempo: tempoDuProgramme(p) }, LUNDI);
      const vive = seancePourPersonne(s, PARAMETRES, { ...DUO_SEB, tempo: tempoDuProgramme(rapide) }, LUNDI);
      expect(vive.dureeEstimeeSec).toBeLessThan(lente.dureeEstimeeSec);
    }
  });

  it('refaire le programme les garde ; un programme retouché le sait', () => {
    const regle = avecTempo(avecNombreExercices(p, 6), TEMPOS[0].tempo);
    const refait = refaireProgramme(regle, { graine: 99 });
    expect(refait.duo).toEqual(regle.duo);
    expect(refait.seances.every((s) => s.exercices.length === voulus(6))).toBe(true);
    expect(estRetouche(regle)).toBe(false);
    expect(estRetouche(JSON.parse(JSON.stringify(regle)))).toBe(false);
    expect(estRetouche(basculerTour(regle, 'lundi', seanceNommee(regle, 'lundi').exercices[2]))).toBe(true);
    // Le swing, seul en tête, n'a pas de paire à défaire ; la première paire
    // du jeudi, si.
    expect(estRetouche(delierDansProgramme(regle, 'jeudi-a', seanceNommee(regle, 'jeudi-a').exercices[0]))).toBe(false);
    expect(estRetouche(delierDansProgramme(regle, 'jeudi-a', seanceNommee(regle, 'jeudi-a').exercices[1]))).toBe(true);
  });
});

describe('le calendrier', () => {
  const p = programmes[0];

  it('commence la semaine A ce lundi, ou le lundi suivant s’il ne reste plus de séance', () => {
    expect(p.debut).toBe('2026-10-05');
    expect(genererProgramme({ graine: 1, aujourdhui: jour(3) }).debut).toBe('2026-10-05'); // jeudi
    expect(genererProgramme({ graine: 1, aujourdhui: jour(4) }).debut).toBe('2026-10-12'); // vendredi
    expect(genererProgramme({ graine: 1, aujourdhui: jour(-2) }).debut).toBe('2026-10-05'); // samedi d'avant
  });

  it('alterne les semaines A et B', () => {
    expect(semaineDe(p, jour(0))).toBe('A');
    expect(semaineDe(p, jour(6))).toBe('A'); // dimanche
    expect(semaineDe(p, jour(7))).toBe('B');
    expect(semaineDe(p, jour(14))).toBe('A');
    expect(semaineDe(p, jour(21))).toBe('B');
  });

  it('trouve la séance du jour, ou la prochaine — le lundi chaque semaine, le mardi et le jeudi en semaines A et B', () => {
    const cas: [number, string, number][] = [
      [0, 'lundi', 0],
      [1, 'mardi-a', 0],
      [2, 'jeudi-a', 1], // mercredi
      [3, 'jeudi-a', 0],
      [4, 'lundi', 3], // vendredi
      [-2, 'lundi', 2], // samedi d'avant le début
      [7, 'lundi', 0],
      [8, 'mardi-b', 0],
      [10, 'jeudi-b', 0],
      [15, 'mardi-a', 0],
      [17, 'jeudi-a', 0],
    ];
    for (const [decalage, id, dansJours] of cas) {
      const prevue = prochaineSeance(p, jour(decalage));
      expect([decalage, prevue?.seance.id, prevue?.dansJours]).toEqual([decalage, id, dansJours]);
    }
  });

  it('une fois la séance du jour faite, propose la suivante', () => {
    const lundi = seanceNommee(p, 'lundi');
    expect(seanceAProposer(p, [], jour(0, 7))?.seance.id).toBe('lundi');
    const faite = [realisee(lundi.nom, jour(0, 9))];
    const suivante = seanceAProposer(p, faite, jour(0, 11));
    expect(suivante?.seance.id).toBe('mardi-a');
    expect(suivante?.dansJours).toBe(1);
    // Le lendemain, on ne regarde plus le lundi.
    expect(seanceAProposer(p, faite, jour(1, 7))?.seance.id).toBe('mardi-a');
  });

  it('sait ce qui a été fait cette semaine', () => {
    const mardiA = seanceNommee(p, 'mardi-a');
    const historique = [realisee(mardiA.nom, jour(1, 9)), realisee(undefined, jour(2, 9))];
    expect(faiteCetteSemaine(historique, mardiA, jour(3))).toBe(true);
    expect(faiteCetteSemaine(historique, mardiA, jour(7))).toBe(false);
    expect(faiteCetteSemaine(historique, seanceNommee(p, 'jeudi-a'), jour(3))).toBe(false);
  });

  it('trouve la prochaine date d’une séance', () => {
    expect(prochaineDate(p, seanceNommee(p, 'jeudi-a'), jour(0))).toEqual(new Date(2026, 9, 8));
    expect(prochaineDate(p, seanceNommee(p, 'jeudi-a'), jour(3, 18))).toEqual(new Date(2026, 9, 8));
    expect(prochaineDate(p, seanceNommee(p, 'jeudi-b'), jour(0))).toEqual(new Date(2026, 9, 15));
    // Le lundi revient chaque semaine : ce lundi-ci, ou le prochain.
    expect(prochaineDate(p, seanceNommee(p, 'lundi'), jour(0))).toEqual(new Date(2026, 9, 5));
    expect(prochaineDate(p, seanceNommee(p, 'lundi'), jour(1))).toEqual(new Date(2026, 9, 12));
  });

  it('plus de semaine dure : le jeudi B a les répétitions du jeudi A, et rien n’en reste dans le programme', () => {
    for (const [a, b] of [['jeudi-a', 'jeudi-b'], ['mardi-a', 'mardi-b']]) {
      for (const contexte of CONTEXTES) {
        const reps = (id: string) =>
          seancePourPersonne(seanceNommee(p, id), PARAMETRES, contexte, jour(10)).blocs
            .filter((bloc) => EXERCICES_PAR_ID[bloc.exerciceId].unite === 'reps' && bloc.exerciceId !== seanceNommee(p, id).finale)
            .map((bloc) => [bloc.reps, bloc.autre?.reps]);
        expect(new Set(reps(b).map((r) => r.join()))).toEqual(new Set(reps(a).map((r) => r.join())));
      }
    }
    for (const ancien of ['REPS_SEMAINE_DURE', 'estSemaineDure', 'exercicesAAugmenter', 'chargeLegere']) {
      expect(ancien in moduleProgramme, ancien).toBe(false);
    }
  });
});

describe('la séance de chacun', () => {
  const p = programmes[0];
  const lundi = seanceNommee(p, 'lundi');
  const mardi = seanceNommee(p, 'mardi-a');
  const jeudi = seanceNommee(p, 'jeudi-a');
  const exercice = (id: string) => EXERCICES_PAR_ID[id];

  it('déroule chaque jour l’ouverture seule, puis les paires : à la suite, puis la pause de la paire ; la finale seule', () => {
    const reference = seancePourPersonne(lundi, PARAMETRES, SEUL_SEB, LUNDI);
    expect(reference.titre).toBe(lundi.nom);
    expect(reference.blocs.map((b) => b.exerciceId)).toEqual([...lundi.exercices, lundi.finale]);
    expect(reference.blocs.every((b) => b.series === 3)).toBe(true);
    expect(reference.parametres.format).toBe('superset');

    for (const s of [lundi, mardi, jeudi]) {
      const seance = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      // L'ouverture, seule : sa pause d'exercice seul.
      const [ouverture, ...suite] = seance.blocs.slice(0, s.exercices.length);
      expect(ouverture.superset).toBeUndefined();
      expect(ouverture.reposSec).toBe(ouverture.exerciceId === 'trap-bar-deadlift' ? 90 : 60);
      expect(suite.map((b) => b.superset)).toEqual(suite.map((_, i) => Math.floor(i / 2)));
      for (const bloc of suite) {
        expect(bloc.transitionSec).toBe(TRANSITION_LIEN_SEC);
        // La pause de la paire : une minute.
        expect(bloc.reposSec).toBe(60);
        // Au temps, 30 s (15 s par côté à la planche de Copenhague) ; sinon les
        // répétitions du jour : 10 le lundi — 8 à la trap bar —, 8 les jours de
        // jiu-jitsu.
        const e = exercice(bloc.exerciceId);
        const repsDuJourSeb = s.jour === 1 ? (estSouleveLourd(e) ? 8 : 10) : 8;
        expect(bloc.reps, e.id).toBe(e.unite === 'secondes' ? secondesAuTemps(e, 30) : repsDuJourSeb);
      }
      // Le dernier, seul, après les paires.
      const fin = seance.blocs[seance.blocs.length - 1];
      expect(fin.exerciceId).toBe(s.finale);
      expect(fin.superset).toBeUndefined();
    }
    expect([REPOS_SEC, REPOS_TRAP_BAR_SEC, TRANSITION_LIEN_SEC]).toEqual([60, 90, 15]);
    expect([REPOS_PAIRE_SEC, REPOS_PAIRE_TRAP_BAR_SEC]).toEqual([60, 90]);
  });

  it('la pause : 1 min pour tous les exercices, 1 min 30 pour la trap bar — après une paire comme seul', () => {
    // Deux petits muscles, un gros avec un petit, deux gros : une minute.
    expect(reposDePaire(['hammer-curl', 'tricep-extension'])).toBe(60);
    expect(reposDePaire(['kb-plank-oblique-pull-through', 'fire-hydrant'])).toBe(60);
    expect(reposDePaire(['goblet-squat', 'hamstring-curl'])).toBe(60);
    expect(reposDePaire(['hammer-curl', 'goblet-squat'])).toBe(60);
    expect(reposDePaire(['bench-press', 'incline-row'])).toBe(60);
    expect(reposDePaire([SWING_DU_JEUDI, 'reverse-fly'])).toBe(60);
    // La trap bar : une minute trente, avec n'importe quel partenaire.
    expect(reposDePaire(['trap-bar-deadlift', 'incline-row'])).toBe(90);
    expect(reposDePaire(['hammer-curl', 'trap-bar-deadlift'])).toBe(90);
    // Seul aussi : une minute trente à la trap bar, une minute partout
    // ailleurs — plus de deux minutes, plus de pause des gros exercices.
    expect(reposDe(exercice('trap-bar-deadlift'))).toBe(90);
    expect(reposDe(exercice('goblet-squat'))).toBe(60);
    expect(reposDe(exercice('hammer-curl'))).toBe(60);
    expect(reposDe(exercice('leg-press'))).toBe(60);
    expect(reposDe(exercice(SWING_DU_JEUDI))).toBe(60);

    // Dans la séance : les deux exercices d'une paire ont la même pause.
    const maison: SeanceDuMois = {
      id: 'essai-pauses',
      nom: 'Essai des pauses',
      jour: 4,
      type: 'dure',
      format: 'series',
      exercices: ['trap-bar-deadlift', 'incline-row', 'goblet-squat', 'hamstring-curl', 'hammer-curl', 'tricep-extension'],
      finale: 'leg-press',
      liens: [
        ['trap-bar-deadlift', 'incline-row'],
        ['goblet-squat', 'hamstring-curl'],
        ['hammer-curl', 'tricep-extension'],
      ],
    };
    const blocs = seancePourPersonne(maison, PARAMETRES, SEUL_SEB, LUNDI).blocs;
    // La finale, seule, garde sa pause d'exercice seul : une minute.
    expect(blocs.map((b) => b.reposSec)).toEqual([90, 90, 60, 60, 60, 60, 60]);
    // Séparés, les exercices retrouvent chacun la leur : une minute.
    const separee = ['hamstring-curl', 'tricep-extension'].reduce(
      (prog, id) => delierDansProgramme(prog, maison.id, id),
      { ...p, seances: [maison] },
    );
    const seuls = seancePourPersonne(separee.seances[0], PARAMETRES, SEUL_SEB, LUNDI).blocs;
    expect(seuls.map((b) => b.reposSec)).toEqual([90, 90, 60, 60, 60, 60, 60]);
    // La trap bar seule : sa minute trente.
    const trapBarSeule = delierDansProgramme({ ...p, seances: [maison] }, maison.id, 'trap-bar-deadlift');
    expect(seancePourPersonne(trapBarSeule.seances[0], PARAMETRES, SEUL_SEB, LUNDI).blocs.slice(0, 2).map((b) => b.reposSec)).toEqual([
      REPOS_TRAP_BAR_SEC,
      REPOS_SEC,
    ]);
  });

  it('suit le tempo du programme, pas celui du téléphone ; sans programme, celui du téléphone', () => {
    const lent = seancePourPersonne(lundi, PARAMETRES, { ...DUO_SEB, tempo: TEMPO_PROGRAMME }, LUNDI);
    const rapide = seancePourPersonne(lundi, PARAMETRES, { ...DUO_SEB, tempo: { monteeSec: 2, descenteSec: 4 } }, LUNDI);
    expect(lent.parametres.tempo).toEqual(TEMPO_PROGRAMME);
    expect(rapide.dureeEstimeeSec).toBeLessThan(lent.dureeEstimeeSec);
    expect(seancePourPersonne(lundi, PARAMETRES, DUO_SEB, LUNDI).parametres.tempo).toEqual(PARAMETRES.tempo);
  });

  it('les répétitions du jour : 10 chacun le lundi, Speedy 8 et Big Max 10 les jours de jiu-jitsu ; Big Max fait une série de plus sur ses points faibles', () => {
    for (const s of p.seances) {
      const seb = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      const max = seancePourPersonne(s, PARAMETRES, SEUL_MAX, LUNDI);
      max.blocs.forEach((bloc, i) => {
        const e = exercice(bloc.exerciceId);
        if (bloc.exerciceId === s.finale) return;
        // Ses points faibles par défaut : pecs, épaules, biceps, triceps — le
        // groupe principal de l'exercice.
        const pointFaible = ['pecs', 'epaules', 'biceps', 'triceps'].includes(pointFaibleDe(e) ?? '');
        expect(bloc.series, `${s.id} · ${e.id}`).toBe(pointFaible ? 4 : 3);
        expect(seb.blocs[i].series).toBe(3);
        // Le lundi, 10 chacun — Speedy 8 au plus à la trap bar.
        const lundiSeb = estSouleveLourd(e) ? REPS_MAX_SOULEVE : 10;
        if (e.unite === 'reps') expect([seb.blocs[i].reps, bloc.reps], `${s.id} · ${e.id}`).toEqual(s.jour === 1 ? [lundiSeb, 10] : [8, 10]);
      });
    }
    expect(JOURS_JIU_JITSU).toEqual([0, 2, 4]);
    expect(REPS_PAR_DEFAUT).toEqual({ sebastien: 8, max: 10 });
    expect(REPS_LUNDI_PAR_DEFAUT).toBe(10);
    expect(repsDuJour({}, 1)).toEqual({ sebastien: 10, max: 10 });
    expect(repsDuJour({}, 2)).toEqual({ sebastien: 8, max: 10 });
    expect(repsDuJour({}, 4)).toEqual({ sebastien: 8, max: 10 });
    // Le mardi, le haut du corps : Big Max y a bien ses séries de plus.
    expect(seancePourPersonne(mardi, PARAMETRES, SEUL_MAX, LUNDI).blocs.some((b) => b.series === 4)).toBe(true);
  });

  it('les points faibles : une série de plus par exercice dont c’est le groupe principal — une au plus ; par défaut, Big Max pecs, épaules, biceps, triceps, Speedy rien', () => {
    expect(POINTS_FAIBLES).toHaveLength(13);
    expect(POINTS_FAIBLES_PAR_DEFAUT).toEqual({ sebastien: [], max: ['epaules', 'pecs', 'biceps', 'triceps'] });
    // Le groupe principal, dans la fiche : un oiseau, une rotation externe sont
    // des épaules ; un développé couché, des pecs ; le Superman, le bas du dos ;
    // la planche latérale, l'extérieur de cuisse ; la trap bar, les fessiers.
    const groupe = (id: string) => pointFaibleDe(exercice(id));
    expect(groupe('reverse-fly')).toBe('epaules');
    expect(groupe('kb-rear-fly')).toBe('epaules');
    expect(groupe('no-money-curl')).toBe('epaules');
    expect(groupe('bench-press')).toBe('pecs');
    expect(groupe('dumbbell-push-up')).toBe('pecs');
    expect(groupe('hammer-curl')).toBe('biceps');
    expect(groupe('tricep-extension')).toBe('triceps');
    expect(groupe('incline-row')).toBe('haut-du-dos');
    expect(groupe('superman')).toBe('bas-du-dos');
    expect(groupe('side-plank')).toBe('exterieur-cuisse');
    expect(groupe('plank')).toBe('abdos');
    expect(groupe('copenhagen-plank')).toBe('interieur-cuisse');
    expect(groupe('leg-curl-machine')).toBe('arriere-cuisse');
    expect(groupe('leg-extension-machine')).toBe('avant-cuisse');
    expect(groupe('trap-bar-deadlift')).toBe('fessiers');
    expect(groupe('seated-calf-raise')).toBe('mollets');
    expect(groupe('farmers-walk')).toBeNull();
    // Par défaut : la même chose que la règle d'avant le réglage — Big Max, une
    // série de plus aux pecs, aux épaules, aux biceps et aux triceps.
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const bloc of seancePourPersonne(s, PARAMETRES, DUO_SEB, LUNDI).blocs) {
          const e = exercice(bloc.exerciceId);
          const base = e.id === 'traineau' ? 4 : 3;
          const attendue = ['pectoraux', 'epaules', 'biceps', 'triceps'].includes(e.groupe) ? 1 : 0;
          expect([bloc.series, bloc.autre?.series], `${s.id} · ${e.id}`).toEqual([base, base + attendue]);
        }
      }
    }
    // Une au plus : un développé touche les pecs, les épaules et les triceps ;
    // tout coché, il n'a qu'une série de plus.
    expect(serieDePlus([...POINTS_FAIBLES], exercice('bench-press'))).toBe(true);
    const toutCoche = { sebastien: [...POINTS_FAIBLES], max: [...POINTS_FAIBLES] };
    const mardiTout = seancePourPersonne(mardi, PARAMETRES, { ...DUO_SEB, pointsFaibles: toutCoche }, LUNDI);
    expect(mardiTout.blocs.find((b) => b.exerciceId === DEVELOPPE_DU_MARDI)).toMatchObject({ series: 4, autre: { series: 4 } });
    // Cocher et décocher change le nombre de séries, pour celui-là seulement.
    const seb = (points: string[], id: string) =>
      seancePourPersonne(
        mardi,
        PARAMETRES,
        { ...DUO_SEB, pointsFaibles: { sebastien: points as typeof POINTS_FAIBLES_PAR_DEFAUT.max, max: [] } },
        LUNDI,
      ).blocs.find((b) => b.exerciceId === id)!;
    expect(seb([], DEVELOPPE_DU_MARDI)).toMatchObject({ series: 3, autre: { series: 3 } });
    expect(seb(['pecs'], DEVELOPPE_DU_MARDI)).toMatchObject({ series: 4, autre: { series: 3 } });
    expect(seb(['epaules'], DEVELOPPE_DU_MARDI).series).toBe(3);
  });

  it('les points faibles se règlent pour chacun, partent avec le programme et ne sont notés que s’ils changent', () => {
    const p0 = programmes[1];
    expect(pointsFaiblesDe(p0)).toEqual(POINTS_FAIBLES_PAR_DEFAUT);
    // Speedy coche ses abdos : dans le programme, rangés dans l'ordre de la liste.
    const coche = avecPointsFaibles(p0, 'sebastien', ['abdos', 'avant-cuisse']);
    expect(pointsFaiblesDe(coche)).toEqual({ sebastien: ['avant-cuisse', 'abdos'], max: POINTS_FAIBLES_PAR_DEFAUT.max });
    expect(coche.seances).toEqual(p0.seances);
    // Revenu à ceux par défaut : plus rien de noté.
    expect(avecPointsFaibles(coche, 'sebastien', []).duo).toBeUndefined();
    // Big Max décoche les triceps : la séance du mardi perd une série, pour lui.
    const sansTriceps = avecPointsFaibles(p0, 'max', ['pecs', 'epaules', 'biceps']);
    expect(pointsFaiblesDe(sansTriceps).max).toEqual(['epaules', 'pecs', 'biceps']);
    // Le lien les transporte, le court comme l'entier.
    for (const programme of [coche, sansTriceps]) {
      expect(programmeDansLien(new URL(lienDePartage(programme, 'https://sgtraining.netlify.app/')).hash)).toEqual(programme);
      expect(decoderProgramme(encoderEnEntier(programme))).toEqual(programme);
    }
    // Un lien d'avant le réglage se lit toujours : ceux par défaut.
    expect(pointsFaiblesDe(programmeDansLien(new URL(lienDePartage(p0, 'https://sgtraining.netlify.app/')).hash)!)).toEqual(
      POINTS_FAIBLES_PAR_DEFAUT,
    );
    // Illisibles : écartés.
    for (const pointsFaibles of [{ sebastien: ['abdos'] }, { sebastien: 'abdos', max: [] }, 'tout']) {
      expect(validerProgramme({ ...p0, duo: { pointsFaibles } })?.duo).toBeUndefined();
    }
    expect(validerProgramme({ ...p0, duo: { pointsFaibles: { sebastien: ['abdos', 'nez'], max: [] } } })?.duo).toEqual({
      pointsFaibles: { sebastien: ['abdos'], max: [] },
    });
  });

  it('suit les répétitions du duo envoyées avec le programme — celles des jours de jiu-jitsu, et celles du lundi de Speedy', () => {
    const reglages = { duo: { reps: { sebastien: 6, max: 12 }, repsLundi: 8 } };
    expect(repsDuDuo(reglages)).toEqual({ sebastien: 6, max: 12 });
    expect(repsLundiDe(reglages)).toBe(8);
    expect(repsDuJour(reglages, 4)).toEqual({ sebastien: 6, max: 12 });
    // Le lundi : Speedy fait ses répétitions du lundi ; Big Max, les siennes, comme tous les jours.
    expect(repsDuJour(reglages, 1)).toEqual({ sebastien: 8, max: 12 });
    const seance = seancePourPersonne(jeudi, PARAMETRES, { ...DUO_SEB, reps: repsDuJour(reglages, jeudi.jour) }, LUNDI);
    const bloc = seance.blocs.find((b) => exercice(b.exerciceId).unite === 'reps')!;
    expect(bloc).toMatchObject({ reps: 6, autre: { reps: 12 } });
    const auLundi = seancePourPersonne(lundi, PARAMETRES, { ...DUO_SEB, reps: repsDuJour(reglages, lundi.jour) }, LUNDI);
    expect(auLundi.blocs[0]).toMatchObject({ reps: 8, autre: { reps: 12 } });
    expect(repsDuDuo({})).toEqual({ sebastien: 8, max: 10 });
    expect(repsLundiDe({})).toBe(10);
  });

  it('plus de dernière série à la moitié de la charge le mardi : les séries de Speedy sont toutes pareilles', () => {
    for (const s of [lundi, mardi, jeudi]) {
      for (const contexte of CONTEXTES) {
        for (const bloc of seancePourPersonne(s, PARAMETRES, contexte, LUNDI).blocs) {
          expect('derniereLegere' in bloc, `${s.id} · ${bloc.exerciceId}`).toBe(false);
          expect('ajoutCharge' in bloc, `${s.id} · ${bloc.exerciceId}`).toBe(false);
        }
      }
    }
  });

  it('seul, hors paire, une minute de pause — une minute trente à la trap bar', () => {
    const sansPaires = lundi.exercices.reduce((prog, id) => delierDansProgramme(prog, 'lundi', id), p);
    const reference = seancePourPersonne(seanceNommee(sansPaires, 'lundi'), PARAMETRES, SEUL_SEB, LUNDI);
    expect(reference.parametres.format).toBe('series');
    for (const bloc of reference.blocs) {
      expect(bloc.superset).toBeUndefined();
      expect(bloc.reposSec).toBe(bloc.exerciceId === 'trap-bar-deadlift' ? 90 : 60);
    }
  });

  it('à deux, chaque exercice porte le volume de l’autre ; Max commence', () => {
    const seb = seancePourPersonne(lundi, PARAMETRES, DUO_SEB, LUNDI);
    const max = seancePourPersonne(lundi, PARAMETRES, DUO_MAX, LUNDI);
    seb.blocs.forEach((bloc, i) => {
      expect(bloc.autre).toEqual({ series: max.blocs[i].series, reps: max.blocs[i].reps });
      expect(max.blocs[i].autre).toEqual({ series: bloc.series, reps: bloc.reps });
    });
    expect(seb.horloge).toEqual({ personne: 'sebastien', partenaire: 'Big Max', jeCommence: false });
    expect(max.horloge).toEqual({ personne: 'max', partenaire: 'Speedy', jeCommence: true });
    // Seul : son temps à lui.
    const seul = seancePourPersonne(lundi, PARAMETRES, SEUL_SEB, LUNDI);
    expect(seul.blocs.some((b) => b.autre)).toBe(false);
    expect(seul.horloge).toEqual({ personne: 'sebastien' });
  });

  it('à deux, les deux téléphones annoncent la même durée', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        expect(dureeSec(s, {}, DUO_SEB)).toBe(dureeSec(s, {}, DUO_MAX));
        // Seul, Sébastien va plus vite qu'à deux.
        expect(dureeSec(s, {}, SEUL_SEB)).toBeLessThan(dureeSec(s, {}, DUO_SEB));
      }
    }
  });

  it('propose des étirements à chacun pendant les longues pauses', () => {
    // Sébastien : pas de flexion avant debout, qui fatigue son dos — les mollets
    // à la place. Max : pas de fente, dure pour le genou — l'arrière des cuisses.
    expect(etirementsPauseDe('sebastien')).toEqual(['etir-rachis-debout', 'etir-mollet-mur', 'etir-inclinaison-tronc']);
    expect(etirementsPauseDe('max')).toEqual(['etir-quadriceps-debout', 'etir-mollet-mur', 'etir-ischios-debout']);
    expect(etirementsPauseDe('sebastien')).not.toContain('etir-ischios-debout');
    expect(etirementsPauseDe('max')).not.toContain('etir-fente-bras-leve');
    for (const id of [...etirementsPauseDe('sebastien'), ...etirementsPauseDe('max')]) {
      expect(exercice(id).famille).toBe('etirement');
    }
  });

  it('commence par cinq minutes de tapis ou de rameur et quatre mouvements légers', () => {
    for (const s of programmes[0].seances) {
      const seance = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      expect(seance.echauffement?.[0]).toMatchObject({ nom: 'Tapis ou rameur', dureeSec: 300 });
      // Cinq mouvements : un mouvement d'un seul côté compte une fois.
      const noms = (seance.echauffement ?? [])
        .filter((m) => !m.changementDeCote)
        .map((m) => m.nom.replace(/ · côté (droit|gauche)$/, ''));
      expect(new Set(noms).size).toBe(5);
      expect(seance.echauffementSec).toBe(300 + 4 * 45);
      // Annoncé = déroulé : la durée de l'étape est la somme de ses mouvements.
      expect(seance.echauffementSec).toBe((seance.echauffement ?? []).reduce((t, m) => t + (m.dureeSec ?? 0), 0));
    }
  });

  it('finit par cinq étirements du poster, trente secondes de chaque côté et cinq pour changer de côté', () => {
    for (const s of programmes[0].seances) {
      const seance = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      const etirements = seance.retourCalme ?? [];
      // Cinq minutes, plus cinq changements de côté de cinq secondes.
      expect(seance.retourCalmeSec).toBe(300 + 5 * 5);
      expect(seance.retourCalmeSec).toBe(etirements.reduce((t, m) => t + (m.dureeSec ?? 0), 0));
      for (const etirement of etirements) {
        expect(EXERCICES_PAR_ID[etirement.exerciceId!].famille).toBe('etirement');
        if (etirement.changementDeCote) {
          expect(etirement.dureeSec).toBe(5);
          continue;
        }
        // Tous se font d'un côté : droit puis gauche, trente secondes chacun.
        expect(etirement.dureeSec).toBe(30);
        expect(etirement.nom).toMatch(/· côté (droit|gauche)$/);
      }
      // Droit, changement, gauche — du même étirement.
      etirements.forEach((etirement, i) => {
        if (!etirement.changementDeCote) return;
        expect(etirements[i - 1].nom).toMatch(/côté droit$/);
        expect(etirements[i + 1].nom).toMatch(/côté gauche$/);
        expect(etirements[i - 1].exerciceId).toBe(etirements[i + 1].exerciceId);
      });
      expect(new Set(etirements.map((e) => e.exerciceId)).size).toBe(5);
      expect(etirements).toHaveLength(15);
    }
  });

  it('étire les jambes à la fin de chaque séance, les mêmes pour les deux', () => {
    const [mollet, quadriceps, ischios, fessier] = ETIREMENTS_DES_JAMBES;
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        const vus = CONTEXTES.map((contexte) => seancePourPersonne(s, PARAMETRES, contexte, LUNDI).retourCalme ?? []);
        const ids = new Set(vus[0].map((e) => e.exerciceId));
        // Les quatre étirements des jambes, plus la torsion allongée : les cinq
        // minutes sont pleines.
        expect(ids, `${programme.graine} · ${s.id}`).toEqual(new Set([...ETIREMENTS_DES_JAMBES, 'etir-torsion-allongee']));
        // Ceux qu'on a retirés n'y sont plus.
        for (const retire of ETIREMENTS_RETIRES) expect(ids.has(retire)).toBe(false);
        // Pareil sur les deux téléphones, seul ou à deux.
        for (const vu of vus) expect(vu).toEqual(vus[0]);
      }
    }
    // Debout d'abord, puis sur le côté, puis sur le dos.
    expect(etirementsDe().map((e) => e.exerciceId).filter((id, i, tous) => tous.indexOf(id) === i)).toEqual([
      mollet,
      quadriceps,
      ischios,
      fessier,
      'etir-torsion-allongee',
    ]);
  });

  it('s’échauffe pour le jour : un good morning à vide avant la trap bar le lundi, un pont fessier avant le swing le jeudi', () => {
    const noms = (seance: Pick<SeanceDuMois, 'type' | 'jour' | 'partie'>) => echauffementDe(seance).map((m) => m.nom);
    expect(noms(lundi)).toEqual(['Tapis ou rameur', 'Cercles de bras', 'Rotations du bassin', 'Squats à vide', 'Good morning à vide']);
    expect(noms(mardi)).toEqual(['Tapis ou rameur', 'Cercles de bras', 'Rotations du buste', 'Chat-vache', 'Pompes contre le mur']);
    expect(noms(jeudi)).toEqual([
      'Tapis ou rameur',
      'Rotations du bassin',
      // Une jambe, cinq secondes pour changer, l'autre : les 45 s d'un mouvement.
      'Balancements de jambe · côté droit',
      'Change de côté',
      'Balancements de jambe · côté gauche',
      'Squats à vide',
      'Pont fessier',
    ]);
    expect(echauffementDe(jeudi).slice(2, 5).map((m) => [m.dureeSec, m.changementDeCote === true])).toEqual([
      [20, false],
      [5, true],
      [20, false],
    ]);
    // Le même pour les deux, à la même durée.
    expect(seancePourPersonne(jeudi, PARAMETRES, DUO_SEB, LUNDI).echauffement).toEqual(
      seancePourPersonne(jeudi, PARAMETRES, DUO_MAX, LUNDI).echauffement,
    );
    expect(seancePourPersonne(jeudi, PARAMETRES, SEUL_SEB, LUNDI).echauffementSec).toBe(300 + 4 * 45);
  });

  it('chacun son tour se bascule ; sur un seul téléphone, la durée n’en dépend pas, sur deux la durée suit', () => {
    // La trap bar, seule en tête : une machine, chacun son tour.
    const barre = lundi.exercices[0];
    expect(lundi.tour).toContain(barre);
    const bascule = basculerTour(p, 'lundi', barre);
    expect(seanceNommee(bascule, 'lundi').tour).not.toContain(barre);
    // Sur un seul téléphone, un exercice seul se fait toujours chacun son
    // tour : la durée ne bouge pas.
    expect(dureeSec(seanceNommee(bascule, 'lundi'))).toBe(dureeSec(lundi));
    // Sur deux téléphones (la séance commune, cachée), côte à côte va plus
    // vite.
    expect(dureeSec(seanceNommee(bascule, 'lundi'), {}, DUO_SEB)).toBeLessThan(dureeSec(lundi, {}, DUO_SEB));
    const retour = basculerTour(bascule, 'lundi', barre);
    expect(seanceNommee(retour, 'lundi').tour?.slice().sort()).toEqual(lundi.tour?.slice().sort());
    expect(dureeSec(seanceNommee(retour, 'lundi'), {}, DUO_SEB)).toBe(dureeSec(lundi, {}, DUO_SEB));
    // Dans une paire, chacun son tour ne coûte rien : on se croise.
    const [, , autre] = lundi.exercices;
    expect(dureeSec(seanceNommee(basculerTour(p, 'lundi', autre), 'lundi'), {}, DUO_SEB)).toBe(dureeSec(lundi, {}, DUO_SEB));
  });

  it('annonce exactement la durée que la séance guidée déroulera — sur un seul téléphone comme sur deux', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const contexte of [...CONTEXTES, ...CONTEXTES.map((c) => ({ ...c, unTelephone: true }))]) {
          const seance = seancePourPersonne(s, PARAMETRES, { ...contexte, tempo: TEMPO_PROGRAMME }, LUNDI);
          expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
        }
      }
    }
  });

  it('annonce la durée de la séance guidée, quels que soient le nombre d’exercices, le tempo et les paires', () => {
    const programme = programmes[1];
    for (const nombre of NOMBRES_EXERCICES) {
      const avecNombre = avecNombreExercices(programme, nombre);
      for (const tempo of TEMPOS.map((t) => t.tempo)) {
        for (const s of avecNombre.seances) {
          // Une paire séparée, une machine basculée : toujours juste.
          const retouchee = seanceNommee(
            basculerTour(delierDansProgramme(avecNombre, s.id, s.exercices[1]), s.id, s.exercices[2]),
            s.id,
          );
          for (const seanceMois of [s, retouchee]) {
            for (const contexte of [DUO_SEB, DUO_MAX, SEUL_SEB, { ...DUO_SEB, unTelephone: true }, { ...SEUL_MAX, unTelephone: true }]) {
              const seance = seancePourPersonne(seanceMois, PARAMETRES, { ...contexte, tempo }, LUNDI);
              expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
            }
          }
        }
      }
    }
  });
});

describe('les paires', () => {
  const p = programmes[0];
  /** Le lundi : la trap bar en tête, dans sa paire. */
  const lundi = seanceNommee(p, 'lundi');
  const exercice = (id: string) => EXERCICES_PAR_ID[id];
  const accord = (a: string, b: string) => accordPaire(exercice(a), exercice(b));

  it('dit qui va bien ensemble, et pourquoi : deux zones différentes', () => {
    // Le haut du corps avec le bas, avec le tronc ; le bas avec le tronc.
    expect(accord('trap-bar-deadlift', 'incline-row')).toEqual({ accord: 'bon', raison: 'haut ↔ bas' });
    expect(accord('bench-press', 'calf-raise')).toEqual({ accord: 'bon', raison: 'haut ↔ bas' });
    expect(accord('bench-press', 'superman')).toEqual({ accord: 'bon', raison: 'haut ↔ tronc' });
    expect(accord('incline-row', 'kb-plank-oblique-pull-through')).toEqual({ accord: 'bon', raison: 'haut ↔ tronc' });
    expect(accord('leg-curl-machine', 'kb-around-the-body')).toEqual({ accord: 'bon', raison: 'bas ↔ tronc' });
    // Plus précis : un exercice des quadriceps avec le bas du dos.
    expect(accord('leg-extension-machine', 'superman')).toEqual({ accord: 'bon', raison: 'quadriceps ↔ bas du dos' });
    // Un exercice de tout le corps ne va qu'avec la zone qui lui reste.
    expect(accord('kb-wall-squat-press', 'kb-around-the-body')).toEqual({ accord: 'bon', raison: 'deux zones différentes' });
    // Dans les deux sens.
    expect(accord('calf-raise', 'bench-press')).toEqual(accord('bench-press', 'calf-raise'));
    // Jamais deux exercices qui chargent le bas du dos.
    expect(accord('trap-bar-deadlift', 'bent-over-row')).toEqual({ accord: 'bas-du-dos', raison: 'le bas du dos deux fois' });
    expect(accord('romanian-deadlift', 'squat').accord).toBe('bas-du-dos');
    // Jamais les mêmes muscles principaux — même pour une fente et une
    // charnière, qui partagent les fessiers.
    expect(accord('bench-press', 'dumbbell-push-up')).toEqual({ accord: 'memes-muscles', raison: 'mêmes muscles : pectoraux' });
    expect(accord('reverse-lunge', 'kb-deadlift')).toEqual({ accord: 'memes-muscles', raison: 'mêmes muscles : fessiers' });
    // Jamais deux exercices de la même zone, même opposés : plus de pousser
    // avec tirer, ni de quadriceps avec ischios, ni de ventre avec le bas du
    // dos (décision du 12 octobre 2026).
    expect(accord('bench-press', 'incline-row')).toEqual({ accord: 'meme-zone', raison: 'deux fois le haut du corps' });
    expect(accord('hammer-curl', 'tricep-extension')).toEqual({ accord: 'meme-zone', raison: 'deux fois le haut du corps' });
    expect(accord('goblet-squat', 'hamstring-curl')).toEqual({ accord: 'meme-zone', raison: 'deux fois le bas du corps' });
    expect(accord('leg-extension-machine', 'leg-curl-machine')).toEqual({ accord: 'meme-zone', raison: 'deux fois le bas du corps' });
    expect(accord('copenhagen-plank', 'fire-hydrant')).toEqual({ accord: 'meme-zone', raison: 'deux fois le bas du corps' });
    expect(accord('superman', 'kb-plank-oblique-pull-through')).toEqual({ accord: 'meme-zone', raison: 'deux fois le tronc' });
    // Les rowings sont du haut du corps ; le good morning, du bas et du tronc.
    expect(accord('incline-row', 'side-raise').accord).toBe('meme-zone');
    expect(accord('kb-good-morning', 'kb-around-the-body').accord).toBe('meme-zone');
    // Jamais deux exercices qui coupent le souffle : la marche du fermier avec
    // un squat.
    expect(accord('farmers-walk', 'goblet-squat')).toEqual({ accord: 'souffle', raison: 'deux exercices qui coupent le souffle' });
  });

  it('le swing ne va qu’avec un tirage léger du haut du corps : jamais une fente, un squat, un autre exercice des jambes', () => {
    // Un tirage léger : l'arrière des épaules, un rowing appuyé.
    for (const tirage of ['reverse-fly', 'kb-rear-fly', 'incline-row', 'single-arm-row']) {
      expect(accord(SWING_DU_JEUDI, tirage), tirage).toEqual({ accord: 'bon', raison: 'haut ↔ bas' });
      expect(accord(tirage, SWING_DU_JEUDI), tirage).toEqual(accord(SWING_DU_JEUDI, tirage));
    }
    // Les fentes et les squats : les mêmes fessiers, ou deux fois les jambes.
    for (const jambes of ['reverse-lunge', 'kb-lunge', 'step-up', 'goblet-squat', 'curtsy-lunge']) {
      expect(accord(SWING_DU_JEUDI, jambes).accord, jambes).toBe('memes-muscles');
    }
    for (const jambes of ['side-lunge', 'sumo-squat', 'kb-bob-and-weave', 'leg-extension-machine', 'kb-side-leg-raise']) {
      expect(accord(SWING_DU_JEUDI, jambes), jambes).toEqual({ accord: 'meme-zone', raison: 'deux fois le bas du corps' });
    }
    // Même une poussée du haut du corps, même le ventre.
    for (const autre of ['bench-press', 'kb-around-the-body']) {
      expect(accord(SWING_DU_JEUDI, autre), autre).toEqual({ accord: 'souffle', raison: 'un explosif va avec un tirage léger du haut du corps' });
      expect(accord(autre, SWING_DU_JEUDI).accord, autre).toBe('souffle');
    }
    // Un rowing qui charge le bas du dos non plus : le swing le charge déjà.
    expect(accord(SWING_DU_JEUDI, 'bent-over-row').accord).toBe('bas-du-dos');
    expect(accord(SWING_DU_JEUDI, 'seesaw-row').accord).toBe('bas-du-dos');
  });

  it('apparie deux zones différentes, le plus d’exercices possible ; le reste se fait seul', () => {
    const jeudi = apparier(['copenhagen-plank', 'reverse-fly', 'leg-extension-machine', 'kb-around-the-body', 'leg-curl-machine', 'incline-row']);
    expect(jeudi.paires).toHaveLength(3);
    for (const [a, b] of jeudi.paires) expect(memeZone(exercice(a), exercice(b)), `${a} + ${b}`).toBe(false);
    // Les deux machines ne vont plus ensemble.
    expect(jeudi.paires).not.toContainEqual(['leg-extension-machine', 'leg-curl-machine']);
    // Trois exercices des jambes : aucune paire, chacun seul.
    expect(apparier(['side-lunge', 'hamstring-curl', 'calf-raise'])).toEqual({
      exercices: ['side-lunge', 'hamstring-curl', 'calf-raise'],
      paires: [],
    });
  });

  it('donne à chaque exercice son rôle : pousse, tire, jambes, bas du dos, tronc', () => {
    expect(rolesDe(exercice('bench-press'))).toEqual(['pousse']);
    expect(rolesDe(exercice('tricep-extension'))).toEqual(['pousse']);
    expect(rolesDe(exercice('incline-row'))).toEqual(['tire']);
    expect(rolesDe(exercice('hammer-curl'))).toEqual(['tire']);
    expect(rolesDe(exercice('reverse-fly'))).toEqual(['tire']);
    expect(rolesDe(exercice('goblet-squat'))).toEqual(['jambes']);
    expect(rolesDe(exercice('kb-superman'))).toEqual(['bas-du-dos']);
    expect(rolesDe(exercice('russian-twist'))).toEqual(['tronc']);
    expect(rolesDe(exercice('thruster'))).toEqual(['corps-entier']);
    // Celui qui charge le bas du dos sans le viser porte les deux étiquettes.
    expect(rolesDe(exercice('trap-bar-deadlift'))).toEqual(['jambes', 'bas-du-dos']);
    expect(rolesDe(exercice('bent-over-row'))).toEqual(['tire', 'bas-du-dos']);
  });

  it('apparie le plus d’exercices possible, des exercices qui s’opposent, dans l’ordre de la séance', () => {
    // La trap bar et le soulevé roumain chargent tous deux le bas du dos : ils
    // vont chacun avec le haut du corps.
    const { exercices, paires } = apparier(['trap-bar-deadlift', 'romanian-deadlift', 'incline-row', 'shoulder-press']);
    expect(exercices[0]).toBe('trap-bar-deadlift');
    expect(paires).toHaveLength(2);
    expect(paires.flat()).toEqual(exercices);
    for (const [a, b] of paires) expect(accord(a, b).accord).toBe('bon');
    // Ce qui ne s'oppose à rien reste seul.
    expect(apparier(['hamstring-curl', 'frog-pump'])).toEqual({ exercices: ['hamstring-curl', 'frog-pump'], paires: [] });
    // L'ordre de la liste ne change pas les paires.
    for (const s of p.seances) {
      const auto = apparier(s.exercices).paires.map((paire) => [...paire].sort().join('+')).sort();
      const aRebours = apparier([...s.exercices].reverse()).paires.map((paire) => [...paire].sort().join('+')).sort();
      expect(aRebours).toEqual(auto);
    }
  });

  it('se sépare et se reforme — la trap bar reste en tête —, puis retrouve les paires automatiques, l’ouverture seule', () => {
    const [barre, a, b] = lundi.exercices;
    expect(pairesAutomatiques(lundi)).toBe(true);
    // La trap bar, seule en tête, n'est dans aucune paire.
    expect(lundi.liens!.flat()).not.toContain(barre);
    const separee = delierDansProgramme(p, 'lundi', a);
    expect(seanceNommee(separee, 'lundi').liens).toHaveLength(2);
    expect(seanceNommee(separee, 'lundi').exercices).toEqual(lundi.exercices);
    // Séparés, ses deux exercices se font seuls, chacun son tour : plus long à
    // deux.
    expect(dureeSec(seanceNommee(separee, 'lundi'))).toBeGreaterThan(dureeSec(lundi));

    // Une autre paire, à la main : la trap bar avec l'exercice du haut du corps
    // de la paire séparée.
    const haut = [a, b].find((id) => zonesDe(exercice(id)).join() === 'haut')!;
    const autrePaire = seanceNommee(lierDansProgramme(separee, 'lundi', haut, barre), 'lundi');
    expect(autrePaire.exercices.slice(0, 2)).toEqual([barre, haut]);
    expect(autrePaire.exercices.slice().sort()).toEqual(lundi.exercices.slice().sort());
    expect(autrePaire.liens).toContainEqual([barre, haut]);
    const blocs = seancePourPersonne(autrePaire, PARAMETRES, SEUL_SEB, LUNDI).blocs;
    expect(blocs.slice(0, 2).map((x) => [x.superset, x.transitionSec, x.reposSec])).toEqual([
      [0, TRANSITION_LIEN_SEC, REPOS_PAIRE_TRAP_BAR_SEC],
      [0, TRANSITION_LIEN_SEC, REPOS_PAIRE_TRAP_BAR_SEC],
    ]);

    // « Refaire les paires » remet celles du début : la trap bar seule.
    const retouche = { ...separee, seances: separee.seances.map((s) => (s.id === 'lundi' ? autrePaire : s)) };
    expect(pairesAutomatiques(autrePaire)).toBe(false);
    const refaite = seanceNommee(refairePaires(retouche, 'lundi'), 'lundi');
    const empreinte = (s: SeanceDuMois) => (s.liens ?? []).map((paire) => [...paire].sort().join('+')).sort();
    expect(pairesAutomatiques(refaite)).toBe(true);
    expect(refaite.exercices[0]).toBe(barre);
    expect(empreinte(refaite)).toEqual(empreinte(lundi));
    // Les autres séances ne bougent pas.
    expect(refairePaires(retouche, 'lundi').seances.filter((s) => s.id !== 'lundi')).toEqual(
      p.seances.filter((s) => s.id !== 'lundi'),
    );
  });

  it('ne met pas en paire un exercice déjà pris, ni la finale', () => {
    const [a, , c] = lundi.exercices;
    expect(lierDansProgramme(p, 'lundi', a, c)).toEqual(p);
    const libre = delierDansProgramme(p, 'lundi', a);
    expect(lierDansProgramme(libre, 'lundi', a, lundi.finale!)).toEqual(libre);
    expect(lierDansProgramme(libre, 'lundi', a, a)).toEqual(libre);
    // Tout séparé : plus aucune paire.
    const toutSepare = lundi.exercices.reduce((prog, id) => delierDansProgramme(prog, 'lundi', id), p);
    expect(seanceNommee(toutSepare, 'lundi').liens).toBeUndefined();
  });

  it('voyage avec le programme, et se perd si les deux ne se suivent plus', () => {
    const [a, b, c] = lundi.exercices;
    const autre = lierDansProgramme(delierDansProgramme(delierDansProgramme(p, 'lundi', a), 'lundi', c), 'lundi', c, a);
    expect(programmeDansLien(new URL(lienDePartage(autre, 'https://sgtraining.netlify.app/')).hash)).toEqual(autre);
    // Deux exercices qui ne se suivent plus ne sont plus en paire.
    const ecartes = {
      ...p,
      seances: p.seances.map((s) => (s.id === 'lundi' ? { ...s, liens: [[a, s.exercices[3]]] } : s)),
    };
    expect(seanceNommee(validerProgramme(ecartes)!, 'lundi').liens).toBeUndefined();
    // Trois exercices ne font pas une paire.
    const trio = { ...p, seances: p.seances.map((s) => (s.id === 'lundi' ? { ...s, liens: [[a, b, c]] } : s)) };
    expect(seanceNommee(validerProgramme(trio)!, 'lundi').liens).toBeUndefined();
    // Changer un exercice d'une paire garde la paire (la première : après la
    // trap bar, seule).
    const nouveau = alternatives(p, 'lundi', b)[0];
    expect(seanceNommee(remplacerDansProgramme(p, 'lundi', b, nouveau.id), 'lundi').liens?.[0]).toEqual([nouveau.id, c]);
  });
});

describe('changer un exercice', () => {
  const p = programmes[0];
  const lundi = seanceNommee(p, 'lundi');
  const actuel = EXERCICES_PAR_ID[lundi.exercices[0]];

  it('un « Changer » sur le mardi A se retrouve quand il revient, deux semaines plus tard — après un rechargement, et sur l’autre téléphone', () => {
    const mardiA = seanceNommee(p, 'mardi-a');
    // Un exercice du mardi A qui n'est ni l'ouverture ni une reprise du lundi.
    const ancien = mardiA.exercices.find((id, i) => i > 0 && !lundi.exercices.includes(id))!;
    const nouveau = alternatives(p, 'mardi-a', ancien)[0];
    expect(nouveau).toBeDefined();
    const change = remplacerDansProgramme(p, 'mardi-a', ancien, nouveau.id);
    // Sur ce téléphone, après un rechargement (la sauvegarde relue), et sur
    // celui de l'autre (le lien « Envoyer à Big Max ») : la même version.
    const telephones = [
      change,
      validerProgramme(JSON.parse(JSON.stringify(change)))!,
      programmeDansLien(new URL(lienDePartage(change, 'https://sgtraining.netlify.app/')).hash)!,
    ];
    for (const programme of telephones) {
      expect(programme.version).toBe(VERSION_PROGRAMME);
      // Le mardi 6 octobre, semaine A, puis le mardi 20 octobre : la même séance.
      for (const decalage of [1, 15]) {
        const prevue = prochaineSeance(programme, jour(decalage))!;
        expect([decalage, prevue.seance.id, prevue.dansJours]).toEqual([decalage, 'mardi-a', 0]);
        expect(prevue.seance.exercices).toContain(nouveau.id);
        expect(prevue.seance.exercices).not.toContain(ancien);
      }
      // Le mardi B, lui, n'a pas changé.
      expect(seanceNommee(programme, 'mardi-b')).toEqual(seanceNommee(p, 'mardi-b'));
    }
  });

  it('propose des exercices des mêmes muscles, absents de la séance', () => {
    const choix = alternatives(p, 'lundi', actuel.id);
    expect(choix.length).toBeGreaterThan(2);
    const dansLaSeance = new Set(exercicesDe(lundi).map(cleMouvement));
    for (const e of choix) {
      expect(dansLaSeance.has(cleMouvement(e))).toBe(false);
      const muscles = [...(e.musclesPrincipaux ?? []), ...(e.musclesSecondaires ?? [])];
      expect(muscles.some((m) => (actuel.musclesPrincipaux ?? []).includes(m))).toBe(true);
    }
    // Le même geste d'abord, et ce que le programme ne fait pas déjà.
    expect(choix[0].pattern).toBe(actuel.pattern);
    const ailleurs = new Set(p.seances.flatMap(exercicesDe).map(cleMouvement));
    const memeGeste = choix.filter((e) => e.pattern === actuel.pattern);
    const premierDejaFait = memeGeste.findIndex((e) => ailleurs.has(cleMouvement(e)));
    if (premierDejaFait >= 0) {
      expect(memeGeste.slice(premierDejaFait).every((e) => ailleurs.has(cleMouvement(e)))).toBe(true);
    }
  });

  it('remplace le dernier exercice par une autre fin de séance — la marche du fermier seulement le lundi', () => {
    const FINS = ['leg-press', 'hack-squat', 'traineau', ...MARCHES_DU_FERMIER, ...POMPES];
    const fin = lundi.finale!;
    expect(MARCHES_DU_FERMIER).toContain(fin);
    const choix = alternatives(p, 'lundi', fin);
    expect(choix.length).toBeGreaterThan(1);
    expect(choix.every((e) => FINS.includes(e.id))).toBe(true);
    // Une machine, à la place de la marche du fermier : chacun son tour.
    const machine = choix.find((e) => e.materiel === 'salle')!;
    const modifie = seanceNommee(remplacerDansProgramme(p, 'lundi', fin, machine.id), 'lundi');
    expect(modifie.finale).toBe(machine.id);
    expect(modifie.tour).toContain(machine.id);
    // Les soirs de jiu-jitsu, jamais la marche du fermier : on garde la poigne.
    for (const id of ['mardi-a', 'jeudi-a']) {
      const autres = alternatives(p, id, seanceNommee(p, id).finale!).map((e) => e.id);
      expect(autres.length, id).toBeGreaterThan(0);
      expect(autres.filter((x) => MARCHES_DU_FERMIER.includes(x)), id).toEqual([]);
      expect(autres.every((x) => FINS.includes(x)), id).toBe(true);
    }
  });

  it('remplace l’exercice dans cette séance seulement', () => {
    const nouveau = alternatives(p, 'lundi', actuel.id)[0];
    const modifie = remplacerDansProgramme(p, 'lundi', actuel.id, nouveau.id);
    expect(seanceNommee(modifie, 'lundi').exercices[0]).toBe(nouveau.id);
    expect(modifie.seances.filter((s) => s.id !== 'lundi')).toEqual(p.seances.filter((s) => s.id !== 'lundi'));
    expect(seanceNommee(p, 'lundi').exercices[0]).toBe(actuel.id);
  });

  it('dans une paire, ne propose que des partenaires possibles : jamais deux exercices de la même zone (audit du 13 octobre 2026)', () => {
    // Le lundi A de l'audit : la bouche d'incendie, jumelée au développé
    // couché serré — la feuille proposait des exercices du haut du corps.
    let essais = 0;
    for (const programme of programmes) {
      for (const s of programme.seances) {
        for (const [a, b] of s.liens ?? []) {
          for (const [change, reste] of [
            [a, b],
            [b, a],
          ]) {
            const partenaire = EXERCICES_PAR_ID[reste];
            const choix = alternatives(programme, s.id, change);
            expect(choix.length, `${programme.graine} · ${s.id} · ${change}`).toBeGreaterThan(0);
            for (const e of choix) {
              essais += 1;
              const cas = `${programme.graine} · ${s.id} · ${change} → ${e.id}, avec ${reste}`;
              expect(memeZone(e, partenaire), cas).toBe(false);
              expect(accordPaire(e, partenaire).accord, cas).toBe('bon');
            }
          }
        }
      }
    }
    expect(essais).toBeGreaterThan(5000);
  });

  it('le remplaçant d’un exercice en paire garde la paire ; s’il ne va pas avec le partenaire, chacun se fait seul', () => {
    const lundi = seanceNommee(p, 'lundi');
    const [a, b] = lundi.liens![0];
    // Un remplaçant proposé : la paire reste.
    const bon = alternatives(p, 'lundi', a)[0];
    expect(seanceNommee(remplacerDansProgramme(p, 'lundi', a, bon.id), 'lundi').liens![0]).toEqual([bon.id, b]);
    // Un exercice de la même zone que le partenaire : la paire est séparée,
    // les deux se font seuls ; les autres paires restent.
    const dansLaSeance = [...lundi.exercices, lundi.finale];
    const deLaMemeZone = candidatsProgramme(MATERIELS_PROGRAMME).find(
      (e) => memeZone(e, EXERCICES_PAR_ID[b]) && !dansLaSeance.includes(e.id),
    )!;
    const change = remplacerDansProgramme(p, 'lundi', a, deLaMemeZone.id);
    const separee = seanceNommee(change, 'lundi');
    expect(separee.exercices).toContain(deLaMemeZone.id);
    expect(separee.liens).toEqual(lundi.liens!.slice(1));
    // Le lien redonne exactement la séance retouchée, sur l'autre téléphone.
    expect(programmeDansLien(new URL(lienDePartage(change, 'https://sgtraining.netlify.app/')).hash)).toEqual(change);
  });

  it('sans aucun remplaçant qui aille avec le partenaire, propose quand même les mêmes muscles ; le choisi se fait seul', () => {
    // Une paire déjà bancale — deux exercices des biceps, d'un ancien lien :
    // aucun exercice des biceps ne va avec un autre exercice des biceps.
    const mardi: SeanceDuMois = {
      id: 'mardi-a',
      nom: 'Mardi A — le haut',
      jour: 2,
      semaine: 'A',
      type: 'facile',
      partie: 'haut',
      format: 'series',
      exercices: ['bench-press', 'hammer-curl', 'concentration-curl', 'incline-row', 'calf-raise'],
      finale: 'farmers-walk',
      liens: [
        ['hammer-curl', 'concentration-curl'],
        ['incline-row', 'calf-raise'],
      ],
    };
    const programme: ProgrammeMois = { ...p, seances: [mardi] };
    const choix = alternatives(programme, 'mardi-a', 'hammer-curl');
    expect(choix.length).toBeGreaterThan(0);
    expect(choix.every((e) => accordPaire(e, EXERCICES_PAR_ID['concentration-curl']).accord !== 'bon')).toBe(true);
    const apres = seanceNommee(remplacerDansProgramme(programme, 'mardi-a', 'hammer-curl', choix[0].id), 'mardi-a');
    expect(apres.exercices).toContain(choix[0].id);
    expect(apres.liens).toEqual([['incline-row', 'calf-raise']]);
  });
});

describe('les exercices mis de côté : la liste est vide, le mécanisme reste', () => {
  /** Les fentes et les exercices sur une jambe, le good morning et les rowings
   *  buste penché sans appui : mis de côté jusqu'au 11 octobre 2026. */
  const RENDUS = [
    'reverse-lunge', 'kb-lunge', 'elevated-reverse-lunge', 'side-lunge', 'kb-side-lunge', 'curtsy-lunge', 'step-up',
    'kb-single-leg-deadlift', 'kb-low-side-step-row', 'kb-bob-and-weave', 'kb-around-the-world',
    'kb-good-morning', 'bent-over-row', 'kb-bent-over-row', 'seesaw-row',
  ];

  it('rend au programme les fentes, les exercices sur une jambe, le good morning et les rowings sans appui — ceux qui sont classiques', () => {
    expect(EXERCICES_MIS_DE_COTE).toEqual([]);
    // La montée sur marche et la fente arrière surélevée demandent une marche :
    // on la compte, pour voir que rien d'autre ne les écarte. Le premier mois,
    // seuls les classiques sont candidats : les fentes, les rowings buste
    // penché ; le reste attend qu'on élargisse la liste.
    const candidats = new Set(candidatsProgramme([...MATERIELS_PROGRAMME, 'step']).map((e) => e.id));
    for (const id of RENDUS) {
      expect(EXERCICES_PAR_ID[id], id).toBeDefined();
      expect(candidats.has(id), id).toBe(EXERCICES_CLASSIQUES.includes(id));
    }
    expect(RENDUS.filter((id) => candidats.has(id))).toEqual([
      'reverse-lunge', 'kb-lunge', 'side-lunge', 'kb-side-lunge', 'bent-over-row', 'kb-bent-over-row', 'seesaw-row',
    ]);
    // « Changer » les propose : une fente latérale à la place de la planche de
    // Copenhague, l'intérieur de cuisse.
    const programme = programmes[0];
    const choix = alternatives(programme, 'jeudi-a', COPENHAGUE, 200).map((e) => e.id);
    expect(RENDUS.filter((id) => choix.includes(id)).length).toBeGreaterThan(0);
  });

  it('un exercice remis sur la liste sort du programme et de « Changer », pas de la bibliothèque', () => {
    EXERCICES_MIS_DE_COTE.push('side-lunge', 'kb-side-lunge');
    try {
      expect(candidatsProgramme(MATERIELS_PROGRAMME).map((e) => e.id)).not.toContain('side-lunge');
      const programme = genererProgramme({ graine: 1, aujourdhui: LUNDI });
      const ids = programme.seances.flatMap((s) => s.exercices);
      expect(ids).not.toContain('side-lunge');
      expect(ids).not.toContain('kb-side-lunge');
      const choix = alternatives(programme, 'jeudi-a', seanceNommee(programme, 'jeudi-a').exercices[2], 200).map((e) => e.id);
      expect(choix).not.toContain('side-lunge');
      // La séance libre les garde.
      const libre = exercicesDisponibles({ ...PARAMETRES_PAR_DEFAUT, niveau: 'intermediaire', materiels: ['halteres'] }).map((e) => e.id);
      expect(libre).toContain('side-lunge');
    } finally {
      EXERCICES_MIS_DE_COTE.length = 0;
    }
  });

  it('trouve toujours assez de partenaires : le nombre du jour, tout en paires, tous les objectifs servis', () => {
    // Pour chaque objectif, les séances où il a sa place, et les muscles qu'il vise.
    const VISES: Record<string, { muscles: string[]; seances: string[] }> = {
      'bas-du-dos': { muscles: ['lombaires'], seances: LES_LUNDIS },
      epaules: { muscles: ['epaules'], seances: [...LES_LUNDIS, ...LES_MARDIS] },
      'exterieur-cuisse': { muscles: ['abducteurs'], seances: LES_LUNDIS },
      'interieur-cuisse': { muscles: ['adducteurs'], seances: LES_JEUDIS },
      bras: { muscles: ['biceps', 'triceps'], seances: LES_MARDIS },
      tronc: { muscles: ['abdominaux', 'obliques'], seances: [...LES_LUNDIS, ...LES_MARDIS, ...LES_JEUDIS] },
      jambes: { muscles: ['quadriceps', 'ischios'], seances: [...LES_LUNDIS, ...LES_JEUDIS] },
      'haut-du-dos': { muscles: ['dorsaux', 'trapezes'], seances: [...LES_LUNDIS, ...LES_MARDIS] },
    };
    for (const nombre of NOMBRES_EXERCICES) {
      // Un objectif seul, ou ceux d'usage. Ceux d'usage — trois le lundi — ne
      // tiennent pas dans une seule paire : à quatre exercices, ce cas-là est
      // écarté (la paire du lundi sert déjà le bas du dos et les épaules).
      for (const objectifs of [...(nombre > 4 ? [undefined] : []), ...TOUS_LES_OBJECTIFS.map((id) => [id])]) {
        for (const graine of GRAINES.slice(0, 4)) {
          const programme = programmeCompose(nombre, objectifs, graine);
          for (const s of programme.seances) {
            const cas = `${nombre} · ${objectifs ?? 'défaut'} · graine ${graine} · ${s.id}`;
            expect(s.exercices, cas).toHaveLength(voulus(nombre));
            expect(s.liens, cas).toHaveLength(pairesVoulues(nombre));
            for (const o of objectifs ?? ['bas-du-dos', 'epaules', 'exterieur-cuisse', 'interieur-cuisse']) {
              if (!VISES[o].seances.includes(s.id)) continue;
              const vise = exercicesDe(s).some((e) => (e.musclesPrincipaux ?? []).some((m) => VISES[o].muscles.includes(m)));
              expect(vise, `${cas} · ${o}`).toBe(true);
            }
          }
        }
      }
    }
  }, 30_000);

  it('le Superman, le bas du dos du lundi, chaque semaine ; le mardi B ne reprend du mardi A que le développé couché, les reprises du lundi et la planche', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const graine of GRAINES.slice(0, 8)) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const id of LES_LUNDIS) expect(seanceNommee(programme, id).exercices, `${nombre} · ${graine} · ${id}`).toContain(SUPERMAN);
        const lundi = seanceNommee(programme, 'lundi');
        const autorises = new Set([DEVELOPPE_DU_MARDI, ...lundi.exercices, ...PLANCHES].map((x) => cleMouvement(EXERCICES_PAR_ID[x])));
        const [mardiA, mardiB] = LES_MARDIS.map((id) => seanceNommee(programme, id).exercices.map((x) => cleMouvement(EXERCICES_PAR_ID[x])));
        expect(mardiB.filter((x) => mardiA.includes(x) && !autorises.has(x)), `${nombre} · ${graine}`).toEqual([]);
        expect(mardiB.filter((x) => mardiA.includes(x))).toContain(cleMouvement(EXERCICES_PAR_ID[DEVELOPPE_DU_MARDI]));
      }
    }
    // Le premier mois, le Superman est le seul exercice classique qui vise le
    // bas du dos : le good morning attend qu'on élargisse la liste.
    const directs = candidatsProgramme(MATERIELS_PROGRAMME).filter((e) => (e.musclesPrincipaux ?? []).includes('lombaires'));
    expect(directs.map((e) => e.id)).toEqual([SUPERMAN]);
    for (const p of programmes) for (const id of LES_LUNDIS) expect(seanceNommee(p, id).exercices).not.toContain('kb-good-morning');
  });

  it('l’intérieur de cuisse le jeudi, l’extérieur le lundi : plus jamais ensemble, deux exercices des jambes', () => {
    for (const nombre of [6, 8]) {
      for (const graine of GRAINES.slice(0, 8)) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const id of LES_JEUDIS) expect(vise(seanceNommee(programme, id), 'adducteurs'), `${nombre} · ${graine} · ${id}`).toBe(true);
        for (const id of LES_LUNDIS) expect(vise(seanceNommee(programme, id), 'abducteurs'), `${nombre} · ${graine} · ${id}`).toBe(true);
        for (const s of programme.seances) {
          for (const [a, b] of pairesDe(s)) {
            const muscles = [...(a.musclesPrincipaux ?? []), ...(b.musclesPrincipaux ?? [])];
            expect(muscles.includes('adducteurs') && muscles.includes('abducteurs'), `${s.id} · ${a.id} + ${b.id}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('les machines des cuisses, le jeudi', () => {
  it('chaque jeudi, semaines A et B, l’extension et la flexion des jambes, chacune avec le ventre ou un tirage léger — plus ensemble', () => {
    expect(accordPaire(EXERCICES_PAR_ID['leg-extension-machine'], EXERCICES_PAR_ID['leg-curl-machine']).accord).toBe('meme-zone');
    for (const nombre of [6, 8]) {
      for (const graine of GRAINES) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const id of LES_JEUDIS) {
          const jeudi = seanceNommee(programme, id);
          const cas = `${nombre} · ${graine} · ${id}`;
          // À huit, les deux ; à six, l'extension, juste après la planche de
          // Copenhague, l'objectif.
          const machines = nombre === 8 ? MACHINES_DU_JEUDI : ['leg-extension-machine'];
          expect(jeudi.exercices, cas).toEqual(expect.arrayContaining(machines));
          for (const machine of machines) {
            const paire = pairesDe(jeudi).find((p) => p.some((e) => e.id === machine))!;
            const partenaire = paire.find((e) => e.id !== machine)!;
            expect(zonesDe(partenaire).join() === 'tronc' || tirageLeger(partenaire), `${cas} · ${partenaire.id}`).toBe(true);
          }
          // Une machine pour deux : chacun son tour.
          expect(jeudi.tour, cas).toEqual(expect.arrayContaining(machines));
          // Elles ne sont pas le lundi.
          expect(seanceNommee(programme, 'lundi').exercices.filter((x) => MACHINES_DU_JEUDI.includes(x)), cas).toEqual([]);
        }
      }
    }
  });

  it('jamais la machine et l’haltère du même mouvement dans une séance, ni proposés par « Changer »', () => {
    const MEMES = [
      ['leg-extension-machine', 'leg-extension'],
      ['leg-curl-machine', 'hamstring-curl'],
    ];
    for (const [machine, libre] of MEMES) {
      expect(cleMouvement(EXERCICES_PAR_ID[machine])).toBe(cleMouvement(EXERCICES_PAR_ID[libre]));
    }
    for (const nombre of NOMBRES_EXERCICES) {
      for (const graine of GRAINES) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const s of programme.seances) {
          const ids = [...s.exercices, s.finale!];
          for (const [machine, libre] of MEMES) {
            expect(ids.includes(machine) && ids.includes(libre), `${nombre} · ${graine} · ${s.id} · ${machine}`).toBe(false);
          }
        }
      }
    }
    // « Changer » ne propose pas l'haltère quand la machine est déjà là.
    const jeudi = seanceNommee(programmes[0], 'jeudi-a');
    const autre = jeudi.exercices.find((id) => !MACHINES_DU_JEUDI.includes(id) && id !== SWING_DU_JEUDI)!;
    const choix = alternatives(programmes[0], 'jeudi-a', autre, 200).map((e) => e.id);
    expect(choix).not.toContain('hamstring-curl');
    expect(choix).not.toContain('leg-extension');
    expect(alternatives(programmes[0], 'jeudi-a', 'leg-curl-machine', 200).map((e) => e.id)).not.toContain('hamstring-curl');
  }, 30_000);

  it('à quatre exercices, l’objectif prend la place ; sans objectif, une machine suit le swing', () => {
    for (const graine of GRAINES.slice(0, 8)) {
      for (const id of LES_JEUDIS) {
        const court = seanceNommee(programmeCompose(4, undefined, graine), id);
        expect(court.exercices.filter((x) => MACHINES_DU_JEUDI.includes(x))).toEqual([]);
        expect(court.exercices).toContain(COPENHAGUE);
        const libre = seanceNommee(programmeCompose(4, [], graine), id);
        expect(libre.exercices[0]).toBe(SWING_DU_JEUDI);
        expect(libre.liens?.[0]).toContain('leg-extension-machine');
      }
    }
  });

  it('sans les machines, ces places prennent d’autres classiques des cuisses ; sans kettlebell, pas de swing', () => {
    const sansMachine = genererProgramme({ graine: 1, aujourdhui: LUNDI, materiels: ['halteres', 'kettlebell', 'banc', 'tapis'] });
    for (const s of sansMachine.seances) {
      expect(exercicesDe(s).filter((e) => e.materiel === 'salle')).toEqual([]);
      expect(s.tour).toBeUndefined();
      // Les mêmes fins, sauf le traîneau du jeudi : la marche du fermier.
      expect([...MARCHES_DU_FERMIER, ...POMPES]).toContain(s.finale);
      // Toujours trois paires et deux exercices seuls.
      expect(s.exercices, s.id).toHaveLength(7);
      expect(s.liens, s.id).toHaveLength(3);
    }
    for (const id of LES_JEUDIS) expect(seanceNommee(sansMachine, id).exercices[0]).toBe(SWING_DU_JEUDI);
    // L'extension et le leg curl aux haltères, inhabituels, ne sont pas des
    // classiques : un squat, une fente, un soulevé de terre les remplacent.
    for (const id of LES_JEUDIS) {
      const jeudi = exercicesDe(seanceNommee(sansMachine, id));
      expect(jeudi.map((e) => e.id)).not.toContain('leg-extension');
      expect(jeudi.map((e) => e.id)).not.toContain('hamstring-curl');
      expect(jeudi.some((e) => (e.musclesPrincipaux ?? []).includes('quadriceps')), id).toBe(true);
    }
    const sansKettlebell = genererProgramme({ graine: 1, aujourdhui: LUNDI, materiels: ['halteres', 'banc', 'tapis', 'salle'] });
    for (const s of sansKettlebell.seances) {
      expect(s.exercices).not.toContain(SWING_DU_JEUDI);
      // Une ouverture seule — un squat, le jeudi —, puis les paires.
      expect(s.liens, s.id).toHaveLength((s.exercices.length - 1) / 2);
    }
    expect(EXERCICES_PAR_ID[seanceNommee(sansKettlebell, 'jeudi-a').exercices[0]].pattern).toBe('squat');
  });

  it('les machines des cuisses ne vont plus ensemble ; une machine va de préférence avec un exercice libre', () => {
    // Quatre exercices des jambes, machines ou non : aucune paire.
    expect(apparier(['goblet-squat', 'leg-extension-machine', 'hamstring-curl', 'leg-curl-machine']).paires).toEqual([]);
    // Une machine seule va toujours de préférence avec un exercice libre.
    expect(apparier(['kb-superman', 'leg-extension-machine', 'v-sit-cross-jab']).paires).toEqual([
      ['kb-superman', 'leg-extension-machine'],
    ]);
  });
});

describe('les précautions : arrêt en bas', () => {
  /** Pour le dos, puis pour les genoux. */
  const POUR_LE_DOS = [
    'trap-bar-deadlift', 'romanian-deadlift', 'kb-deadlift', 'kb-good-morning', 'kb-single-leg-deadlift', 'bent-over-row',
    'kb-bent-over-row', 'seesaw-row', 'reverse-fly', 'kb-rear-fly', 'kb-lawn-mower',
    // Le soulevé de terre sur une jambe aux haltères, comme au kettlebell ; les
    // bûcherons, dont le bas est penché et tourné, la charge au pied.
    'single-leg-deadlift-db', 'woodchop', 'kb-wood-chop',
  ];
  const POUR_LES_GENOUX = [
    'squat', 'goblet-squat', 'kb-goblet-squat', 'sumo-squat', 'thruster', 'kb-thruster', 'hack-squat', 'leg-press',
    'reverse-lunge', 'kb-lunge', 'elevated-reverse-lunge', 'step-up', 'side-lunge', 'kb-side-lunge', 'curtsy-lunge',
    'kb-wall-squat-press', 'kb-lunge-press', 'kb-rotating-side-lunge-press', 'leg-extension-machine', 'leg-extension',
    // Les squats et fentes avancés ou mis de côté, qui tenaient encore en bas :
    // le squat cosaque, l'esquive latérale, le squat bras tendu, le squat sur
    // une jambe vers un banc, la fente bulgare, la fente latérale et
    // développé, le pas chassé bas et rowing (buste penché, genoux pliés).
    'cossack-squat', 'kb-bob-and-weave', 'kb-overhead-squat', 'kb-pistol-bench-squat', 'bulgarian-lunge',
    'side-lunge-thruster', 'kb-low-side-step-row',
  ];
  /** Le genou ménagé sans arrêt à retirer : le tour du monde se fait dans un
   *  squat large tenu, et un cercle ne s'arrête jamais. */
  const GENOU_SANS_ARRET = ['kb-around-the-world'];
  const marque = (id: string) => EXERCICES_PAR_ID[id].sansPauseEnBas === true;
  const tempoAvecPause = { monteeSec: 3, descenteSec: 3, pauseSec: 2 };

  it('marque les exercices du dos et des genoux — et eux seuls', () => {
    for (const id of [...POUR_LE_DOS, ...POUR_LES_GENOUX]) {
      expect(EXERCICES_PAR_ID[id], `${id} existe`).toBeDefined();
      expect(marque(id), id).toBe(true);
    }
    const tous = Object.values(EXERCICES_PAR_ID).filter((e) => e.sansPauseEnBas).map((e) => e.id);
    expect(tous.sort()).toEqual([...POUR_LE_DOS, ...POUR_LES_GENOUX].sort());
    // La consigne du genou ne concerne que ceux des genoux.
    const genoux = Object.values(EXERCICES_PAR_ID).filter((e) => e.genouAMenager).map((e) => e.id);
    expect(genoux.sort()).toEqual([...POUR_LES_GENOUX, ...GENOU_SANS_ARRET].sort());
  });

  it('n’a plus d’arrêt en bas pour ces exercices, quel que soit le tempo ; les autres gardent le leur', () => {
    for (const id of [...POUR_LE_DOS, ...POUR_LES_GENOUX]) {
      const e = EXERCICES_PAR_ID[id];
      // L'extension des jambes non plus ne tient pas en haut : jambes tendues,
      // la rotule est la plus chargée (les genoux de Big Max).
      expect(e.pauseEnHaut, id).toBeUndefined();
      expect(tempoPourExercice(e, tempoAvecPause), id).toEqual({ monteeSec: 3, descenteSec: 3, pauseSec: 0 });
      expect(secondesParRep(tempoAvecPause, e), id).toBe(6);
    }
    const curl = EXERCICES_PAR_ID['hammer-curl'];
    expect(tempoPourExercice(curl, tempoAvecPause)).toBe(tempoAvecPause);
    expect(secondesParRep(tempoAvecPause, curl)).toBe(8);
    // Sans arrêt dans le tempo, rien à retirer.
    const lent = { monteeSec: 4, descenteSec: 4 };
    expect(tempoPourExercice(EXERCICES_PAR_ID['squat'], lent)).toBe(lent);
  });

  it('compte une répétition plus courte dans la séance guidée comme dans la durée annoncée — la bille et les bips aussi', () => {
    for (const programme of programmes.slice(0, 6)) {
      for (const s of programme.seances) {
        for (const contexte of [DUO_SEB, DUO_MAX]) {
          for (const tempo of [TEMPO_PROGRAMME, tempoAvecPause]) {
            const seance = seancePourPersonne(s, PARAMETRES, { ...contexte, tempo }, LUNDI);
            const etapes = construireEtapes(seance);
            expect(dureeTotaleSec(etapes)).toBe(seance.dureeEstimeeSec);
            for (const etape of etapes) {
              if (etape.type !== 'serie') continue;
              const exercice = EXERCICES_PAR_ID[etape.exerciceId];
              if (exercice.unite !== 'reps') continue;
              const cycles = etape.reps * (exercice.cotes === 'unilateral' ? 2 : 1);
              const cas = `${programme.graine} · ${s.id} · ${etape.exerciceId} · ${JSON.stringify(tempo)}`;
              // La série dure exactement ses répétitions, chacune à son tempo,
              // plus le changement de côté d'un exercice unilatéral.
              expect(etape.dureeSec, cas).toBe(cycles * secondesParRep(tempo, exercice) + changementDeCoteSec(exercice));
              // Le métronome arrive à la dernière répétition au moment où la série finit…
              const fin = etatMetronome(etape, etape.dureeSec - 0.001, seance.parametres.tempo)!;
              expect(fin.cycle, cas).toBe(cycles - 1);
              // … et sans arrêt en bas, la bille ne se pose jamais : pas de phase de pause.
              // (Au changement de côté d'un unilatéral, le métronome se tait.)
              if (exercice.sansPauseEnBas && !exercice.pauseEnHaut) {
                for (let t = 0; t < etape.dureeSec; t += 0.5) {
                  expect(etatMetronome(etape, t, seance.parametres.tempo)?.phase, `${cas} · ${t} s`).not.toBe('pause');
                }
              }
              // Un exercice qui tient en haut ne tient jamais en bas : la pause
              // suit toujours la montée, jamais la descente.
              if (exercice.pauseEnHaut) {
                let avant = '';
                for (let t = 0; t < etape.dureeSec; t += 0.5) {
                  const phase = etatMetronome(etape, t, seance.parametres.tempo)?.phase;
                  if (phase === undefined) continue;
                  if (phase === 'pause') expect(avant, `${cas} · ${t} s`).not.toBe('descend');
                  avant = phase;
                }
              }
            }
          }
        }
      }
    }
  });

  it('allège la durée de la séance guidée : un squat ne tient plus la seconde en bas', () => {
    const lundiAvecSquat: SeanceDuMois = {
      id: 'essai-squat',
      nom: 'Essai du squat',
      jour: 4,
      type: 'facile',
      partie: 'bas',
      format: 'series',
      exercices: ['squat', 'hamstring-curl'],
      liens: [['squat', 'hamstring-curl']],
    };
    const etapes = construireEtapes(seancePourPersonne(lundiAvecSquat, PARAMETRES, SEUL_SEB, LUNDI));
    const series = etapes.filter((e) => e.type === 'serie');
    // Au tempo du programme (3 s / 3 s + 1 s en bas), un jeudi : 8 répétitions de 6 s au squat,
    // de 7 s à la flexion des jambes, qui garde son arrêt — en haut, genoux pliés.
    expect(series.filter((e) => e.exerciceId === 'squat').every((e) => e.dureeSec === 48)).toBe(true);
    expect(series.filter((e) => e.exerciceId === 'hamstring-curl').every((e) => e.dureeSec === 56)).toBe(true);
  });
});

describe('les charges', () => {
  const ancienne = realisee('Lundi — séance dure', jour(-7), [
    { exerciceId: 'goblet-squat', seriesPrevues: 3, seriesFaites: 3, reps: 8, dureeSec: 300, poids: 30, poidsParSerie: [25, 30, 30] },
  ]);
  const recente = realisee(undefined, jour(-3), [
    { exerciceId: 'goblet-squat', seriesPrevues: 3, seriesFaites: 3, reps: 8, dureeSec: 300 },
    { exerciceId: 'curl', seriesPrevues: 3, seriesFaites: 3, reps: 8, dureeSec: 300, poids: 10 },
  ]);
  // L'historique va du plus récent au plus ancien.
  const historique = [recente, ancienne];

  it('retrouve les charges de la dernière séance où elles ont été notées', () => {
    expect(chargesPassees(historique, ['goblet-squat', 'curl', 'inconnu'], 'lb')).toEqual({
      'goblet-squat': [25, 30, 30],
      curl: [10],
    });
  });

  it('ignore un exercice passé sans faire une série', () => {
    const passee = realisee(undefined, jour(-1), [
      { exerciceId: 'goblet-squat', seriesPrevues: 3, seriesFaites: 0, reps: 8, dureeSec: 10, poids: 25, poidsParSerie: [25] },
    ]);
    expect(chargesPassees([passee, ...historique], ['goblet-squat'], 'lb')['goblet-squat']).toEqual([25, 30, 30]);
  });

  it('les convertit dans l’unité du moment', () => {
    const enKilos = realisee(undefined, jour(-1), [
      { exerciceId: 'curl', seriesPrevues: 1, seriesFaites: 1, reps: 8, dureeSec: 60, poids: 10, poidsParSerie: [10] },
    ]);
    enKilos.parametres = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'kg' };
    const [charge] = chargesPassees([enKilos], ['curl'], 'lb').curl;
    expect(charge).toBeGreaterThan(21);
    expect(charge).toBeLessThan(23);
  });

  it('monte ou descend d’un cran au ressenti, et seulement au ressenti', () => {
    const leger = { series: 3, ajustementRessenti: 5 };
    expect(chargeDeSerie(leger, [], [100, 100, 100], 1)).toBe(105);
    expect(chargeDeSerie(leger, [105], [100, 100, 100], 2)).toBe(105);
    expect(chargeDeSerie(leger, [110], [100], 1)).toBe(110);
    const lourd = { series: 3, ajustementRessenti: -5 };
    expect(chargeDeSerie(lourd, [], [30, 30, 30], 3)).toBe(25);
    // La dernière série du mardi garde la charge des autres.
    expect(chargeDeSerie({ series: 3 }, [30, 30], [30, 30, 15], 3)).toBe(30);
    expect(chargeDeSerie(undefined, [], [20], 1)).toBe(20);
  });

  it('propose la charge déjà notée, puis celle de la série d’avant, puis celle de la dernière fois', () => {
    const passees = [25, 30, 30];
    expect(chargeProposee([], passees, 1)).toBe(25);
    expect(chargeProposee([25], passees, 2)).toBe(25);
    expect(chargeProposee([0], passees, 2)).toBe(30);
    expect(chargeProposee([35, 0], passees, 3)).toBe(35);
    expect(chargeProposee([25, 40], passees, 2)).toBe(40);
    expect(chargeProposee([], [20, 25], 3)).toBe(25);
    expect(chargeProposee([], [], 1)).toBe(0);
  });
});

/** Le texte d'un lien, en base64 « url », comme le fait l'application. */
function versCode(texte: string): string {
  let binaire = '';
  for (const octet of new TextEncoder().encode(texte)) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function depuisCode(code: string): string {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
}

describe('le partage avec Max', () => {
  const p = programmes[0];

  it('fait l’aller-retour par le lien, accents compris', () => {
    const lien = lienDePartage(p, 'https://sgtraining.netlify.app/#ancienne');
    expect(lien.startsWith('https://sgtraining.netlify.app/#programme=')).toBe(true);
    expect(programmeDansLien(new URL(lien).hash)).toEqual(p);
  });

  it('en entier, quand le lien court ne sait pas le dire, reste un lien qu’on peut envoyer par texto', () => {
    // Les paires et chacun son tour par leur place, sans ce qui va de soi :
    // moins de 3 000 caractères pour six séances (2 500 pour cinq, avant).
    // Les messageries le prennent tel quel.
    for (const programme of programmes) {
      expect(`https://sgtraining.netlify.app/#programme=${encoderEnEntier(programme)}`.length).toBeLessThan(3000);
      expect(decoderProgramme(encoderEnEntier(programme))).toEqual(programme);
    }
    const brut = JSON.parse(depuisCode(encoderEnEntier(p)));
    const lundi = brut.seances.find((x: { id: string }) => x.id === 'lundi');
    // La trap bar en tête, et la presse (ou le hack squat), à sa place.
    const vrai = seanceNommee(p, 'lundi');
    expect(lundi.tour).toEqual(vrai.tour!.map((id) => [...vrai.exercices, vrai.finale].indexOf(id)));
    expect(lundi.tour[0]).toBe(0);
    expect('format' in lundi).toBe(false);
    expect(brut.seances.find((x: { id: string }) => x.id === 'mardi-a').type).toBeUndefined();
  });

  it('transporte les répétitions de chacun, et écarte celles qu’on ne peut pas lire', () => {
    const avecDuo = { ...p, duo: { reps: { sebastien: 6, max: 12 }, repsLundi: 12 } };
    expect(programmeDansLien(new URL(lienDePartage(avecDuo, 'https://sgtraining.netlify.app/')).hash)).toEqual(avecDuo);
    for (const duo of [{ reps: { sebastien: 0, max: 10 } }, { reps: { sebastien: 8 } }, { reps: 'beaucoup' }, 12, { repsLundi: 0 }, { repsLundi: '10' }]) {
      expect(validerProgramme({ ...p, duo })).toEqual(p);
    }
    // Les répétitions du lundi voyagent seules aussi.
    expect(validerProgramme({ ...p, duo: { repsLundi: 8 } })?.duo).toEqual({ repsLundi: 8 });
  });

  it('regroupe les deux téléphones sous le même code d’équipe, et transmet l’adresse du serveur', () => {
    expect(equipeDe(p)).toMatch(/^[A-Za-z0-9_-]{10,40}$/);
    expect(equipeDe(p)).toBe(equipeDe(JSON.parse(JSON.stringify(p))));
    expect(equipeDe({ ...p, graine: p.graine + 1 })).not.toBe(equipeDe(p));
    const enLigne = { ...p, serveur: 'https://srv123.hstgr.cloud' };
    expect(programmeDansLien(new URL(lienDePartage(enLigne, 'https://sgtraining.netlify.app/')).hash)).toEqual(enLigne);
    expect(adresseServeurValide('https://srv123.hstgr.cloud/api/')).toBe('https://srv123.hstgr.cloud');
    expect(adresseServeurValide('http://srv123.hstgr.cloud')).toBeNull();
    expect(adresseServeurValide('http://localhost:8080')).toBe('http://localhost:8080');
    expect(adresseServeurValide('pas une adresse')).toBeNull();
    expect(validerProgramme({ ...p, serveur: 'javascript:alert(1)', equipe: 'x' })).toEqual(p);
  });

  it('refaire le programme garde les répétitions, le serveur et le code d’équipe', () => {
    const ancien: ProgrammeMois = {
      ...p,
      duo: { reps: { sebastien: 8, max: 12 } },
      serveur: 'https://srv123.hstgr.cloud',
    };
    const nouveau = refaireProgramme(ancien, { graine: ancien.graine + 1 });
    expect(nouveau.graine).toBe(ancien.graine + 1);
    expect(nouveau.duo).toEqual(ancien.duo);
    expect(nouveau.serveur).toBe(ancien.serveur);
    // L'historique des deux reste sous le même code, même refait deux fois.
    expect(equipeDe(nouveau)).toBe(equipeDe(ancien));
    expect(equipeDe(refaireProgramme(nouveau, { graine: 3 }))).toBe(equipeDe(ancien));
    expect(validerProgramme(JSON.parse(JSON.stringify(nouveau)))?.equipe).toBe(equipeDe(ancien));
  });

  it('recompose un programme d’avant les machines, pareil sur les deux téléphones', () => {
    const ancien = {
      debut: '2026-10-05',
      objectifs: ['bas-du-dos', 'epaules'],
      materiels: ['halteres', 'kettlebell', 'banc', 'tapis'],
      graine: 42,
      seances: [
        { id: 'lundi', nom: 'Lundi — séance dure', jour: 1, type: 'dure', format: 'series', exercices: ['goblet-squat', 'romanian-deadlift', 'farmers-walk'] },
        { id: 'mardi-a', nom: 'Mardi A', jour: 2, semaine: 'A', type: 'facile', format: 'enchaine', exercices: ['sumo-squat', 'fire-hydrant', 'side-lunge'] },
      ],
    };
    const recompose = validerProgramme(ancien)!;
    expect(recompose.version).toBe(VERSION_PROGRAMME);
    expect(recompose.debut).toBe('2026-10-05');
    expect(recompose.graine).toBe(42);
    expect(recompose.objectifs).toEqual(['bas-du-dos', 'epaules']);
    expect(seanceNommee(recompose, 'lundi').exercices[0]).toBe('trap-bar-deadlift');
    expect(recompose.seances).toHaveLength(5);
    expect(validerProgramme(ancien)).toEqual(recompose);
  });

  it('recompose la semaine d’avant — la séance dure le lundi — en gardant le duo', () => {
    const actuel = genererProgramme({ graine: 42, aujourdhui: LUNDI });
    const version2 = {
      ...actuel,
      version: 2,
      duo: { reps: { sebastien: 8, max: 12 } },
      seances: actuel.seances.map((s) => ({ ...s, partie: undefined })),
    };
    const recompose = validerProgramme(version2)!;
    expect(recompose.version).toBe(VERSION_PROGRAMME);
    expect(recompose.duo).toEqual({ reps: { sebastien: 8, max: 12 } });
    expect(recompose.seances.map((s) => s.id)).toEqual(['lundi', 'mardi-a', 'jeudi-a', 'mardi-b', 'jeudi-b']);
    expect(seanceNommee(recompose, 'lundi').partie).toBe('complet');
    expect(seanceNommee(recompose, 'jeudi-a').partie).toBe('bas');
  });

  it('recompose un programme de la version 3 — les enchaînés de trois — en paires, pareil sur les deux téléphones', () => {
    const actuel = genererProgramme({ graine: 42, aujourdhui: LUNDI });
    // Le lundi et le mardi en enchaînés de trois, le jeudi lié à la main.
    const version3 = {
      ...actuel,
      version: 3,
      duo: { reps: { sebastien: 8, max: 12 } },
      equipe: 'p1abcdef20261005',
      seances: actuel.seances.map((s) => {
        const ancienne: Record<string, unknown> = { ...s };
        delete ancienne.liens;
        return s.type === 'facile'
          ? { ...ancienne, format: 'enchaine', exercices: [...s.exercices, 'kb-x-crunch', 'calf-raise', 'hammer-curl'] }
          : { ...ancienne, liens: [[s.exercices[0], s.exercices[1]]] };
      }),
    };
    const telephoneSeb = validerProgramme(JSON.parse(JSON.stringify(version3)))!;
    const telephoneMax = programmeDansLien(new URL(lienDePartage(version3 as ProgrammeMois, 'https://sgtraining.netlify.app/')).hash)!;
    expect(telephoneSeb).toEqual(telephoneMax);
    expect(telephoneSeb.version).toBe(VERSION_PROGRAMME);
    expect(telephoneSeb.seances).toEqual(actuel.seances);
    for (const s of telephoneSeb.seances) {
      expect(s.format).toBe('series');
      expect(s.liens).toHaveLength(3);
    }
    // Le duo et l'équipe restent.
    expect(telephoneSeb.duo).toEqual({ reps: { sebastien: 8, max: 12 } });
    expect(telephoneSeb.equipe).toBe('p1abcdef20261005');
  });

  it('transporte le nombre d’exercices et le tempo, et écarte ceux qu’on ne peut pas lire', () => {
    const regle = avecTempo(avecNombreExercices(p, 8), TEMPOS[0].tempo);
    expect(regle.duo).toEqual({ exercices: 8, tempo: TEMPOS[0].tempo });
    const recu = programmeDansLien(new URL(lienDePartage(regle, 'https://sgtraining.netlify.app/')).hash)!;
    expect(recu).toEqual(regle);
    expect(nombreExercicesDe(recu)).toBe(8);
    expect(tempoDuProgramme(recu)).toEqual(TEMPOS[0].tempo);
    // Un nombre qu'on ne peut pas choisir, un tempo hors de la liste : écartés.
    for (const duo of [{ exercices: 7 }, { exercices: '8' }, { exercices: 10 }, { tempo: { monteeSec: 1, descenteSec: 1 } }, { tempo: 'lent' }]) {
      expect(validerProgramme({ ...p, duo })).toEqual(p);
    }
    // Les répétitions illisibles n'emportent pas le reste.
    expect(validerProgramme({ ...regle, duo: { ...regle.duo, reps: { sebastien: 8 } } })?.duo).toEqual(regle.duo);
  });

  it('recompose un programme de la version 5 — l’ancienne semaine — pareil sur les deux téléphones, et le lien d’avant s’ouvre encore', () => {
    // La semaine d'avant : le bas du corps le lundi (avec les machines), le
    // haut le mardi, la trap bar le jeudi ; dix exercices, et des répétitions
    // choisies à la main.
    const version5 = {
      debut: '2026-10-05',
      objectifs: [...OBJECTIFS_PAR_DEFAUT_TEST],
      materiels: [...MATERIELS_PROGRAMME],
      graine: 42,
      version: 5,
      duo: { exercices: 10, reps: { sebastien: 8, max: 12 } },
      equipe: 'p1abcdef20261005',
      seances: [
        { id: 'lundi', nom: 'Lundi A — bas du corps', jour: 1, semaine: 'A', type: 'facile', partie: 'bas', format: 'series', exercices: ['kb-superman', 'kb-x-crunch', 'leg-extension-machine', 'leg-curl-machine'], finale: 'traineau', liens: [['kb-superman', 'kb-x-crunch'], ['leg-extension-machine', 'leg-curl-machine']], tour: ['leg-extension-machine', 'leg-curl-machine', 'traineau'] },
        { id: 'mardi-a', nom: 'Mardi A — haut du corps', jour: 2, semaine: 'A', type: 'facile', partie: 'haut', format: 'series', exercices: ['bench-press', 'incline-row'], finale: 'farmers-walk', liens: [['bench-press', 'incline-row']] },
        { id: 'jeudi', nom: 'Jeudi — séance de référence', jour: 4, type: 'dure', partie: 'complet', format: 'series', exercices: ['trap-bar-deadlift', 'incline-row'], finale: 'leg-press', liens: [['trap-bar-deadlift', 'incline-row']], tour: ['trap-bar-deadlift', 'leg-press'] },
        { id: 'lundi-b', nom: 'Lundi B — bas du corps', jour: 1, semaine: 'B', type: 'facile', partie: 'bas', format: 'series', exercices: ['kb-superman', 'kb-x-crunch'], finale: 'hack-squat' },
        { id: 'mardi-b', nom: 'Mardi B — haut du corps', jour: 2, semaine: 'B', type: 'facile', partie: 'haut', format: 'series', exercices: ['shoulder-press', 'tripod-row'], finale: 'kb-farmers-walk' },
      ],
    };
    const telephoneSeb = validerProgramme(JSON.parse(JSON.stringify(version5)))!;
    // Le lien « Envoyer à Big Max » d'avant, tel que l'ancienne version
    // l'écrivait : les paires par leur place, chacun son tour par les noms.
    const ancienLien = {
      ...version5,
      seances: version5.seances.map((x) => (x.liens ? { ...x, liens: x.liens.map((paire) => paire.map((id) => x.exercices.indexOf(id))) } : x)),
    };
    const code = versCode(JSON.stringify(ancienLien));
    const telephoneMax = programmeDansLien(`#programme=${code}`)!;
    expect(telephoneSeb).toEqual(telephoneMax);
    expect(telephoneSeb.version).toBe(VERSION_PROGRAMME);
    // La même graine, le même premier lundi : la nouvelle semaine, identique
    // à celle qu'on composerait aujourd'hui.
    expect(telephoneSeb.seances).toEqual(genererProgramme({ graine: 42, aujourdhui: LUNDI }).seances);
    expect(telephoneSeb.seances.map((s) => s.id)).toEqual(['lundi', 'mardi-a', 'jeudi-a', 'mardi-b', 'jeudi-b']);
    // Dix exercices ne se choisissent plus : huit, les trois jours. Les
    // répétitions choisies et l'équipe restent.
    expect(nombreExercicesDe(telephoneSeb)).toBe(8);
    expect(telephoneSeb.duo).toEqual({ reps: { sebastien: 8, max: 12 } });
    expect(telephoneSeb.equipe).toBe('p1abcdef20261005');
  });

  it('une nouvelle version recompose le programme ; les charges notées restent, exercice par exercice', () => {
    // Un lundi de la version 8 : la trap bar, des paires, la presse pour finir.
    const ancien = {
      ...programmes[0],
      version: 8,
      seances: [
        {
          id: 'lundi-a',
          nom: 'Lundi A — tout le corps',
          jour: 1,
          semaine: 'A',
          type: 'dure',
          partie: 'complet',
          format: 'series',
          exercices: ['trap-bar-deadlift', 'superman', 'shoulder-press', 'kb-side-leg-raise', 'incline-row', 'kb-around-the-body', 'incline-bench-press'],
          finale: 'leg-press',
          liens: [
            ['superman', 'shoulder-press'],
            ['kb-side-leg-raise', 'incline-row'],
            ['kb-around-the-body', 'incline-bench-press'],
          ],
          tour: ['trap-bar-deadlift', 'leg-press'],
        },
      ],
    };
    const recompose = validerProgramme(ancien)!;
    expect(recompose.version).toBe(VERSION_PROGRAMME);
    expect(recompose.seances).toEqual(programmes[0].seances);
    // Les charges notées avant : elles vivent dans l'historique, par exercice.
    const historique = [
      realisee('Lundi A — tout le corps', jour(-7), [
        { exerciceId: 'trap-bar-deadlift', seriesPrevues: 3, seriesFaites: 3, reps: 8, dureeSec: 300, poids: 155, poidsParSerie: [135, 155, 155] },
        { exerciceId: 'incline-row', seriesPrevues: 3, seriesFaites: 3, reps: 10, dureeSec: 300, poids: 30, poidsParSerie: [30, 30, 30] },
        { exerciceId: 'kb-side-leg-raise', seriesPrevues: 3, seriesFaites: 3, reps: 10, dureeSec: 300, poids: 10, poidsParSerie: [10, 10, 10] },
      ]),
    ];
    const lundi = seanceNommee(recompose, 'lundi');
    const ids = seancePourPersonne(lundi, PARAMETRES, DUO_SEB, LUNDI).blocs.map((b) => b.exerciceId);
    const charges = chargesPassees(historique, ids, 'lb');
    // Ceux qui restent au programme retrouvent leurs charges, sous un autre
    // nom de séance.
    expect(ids).toContain('trap-bar-deadlift');
    expect(charges['trap-bar-deadlift']).toEqual([135, 155, 155]);
    for (const id of ids.filter((x) => x === 'incline-row')) expect(charges[id]).toEqual([30, 30, 30]);
    // Celui qui n'est plus classique sort du programme ; son historique reste.
    expect(ids).not.toContain('kb-side-leg-raise');
    expect(chargesPassees(historique, ['kb-side-leg-raise'], 'lb')['kb-side-leg-raise']).toEqual([10, 10, 10]);
  });

  it('refuse un lien abîmé et écarte les exercices inconnus', () => {
    expect(programmeDansLien('#rien')).toBeNull();
    expect(decoderProgramme('pas-du-base64!')).toBeNull();
    expect(decoderProgramme('e30')).toBeNull(); // {}
    expect(validerProgramme(null)).toBeNull();
    expect(validerProgramme({ debut: 'hier', seances: [] })).toBeNull();
    const abime = { ...p, seances: p.seances.map((s, i) => (i === 0 ? { ...s, exercices: ['n-existe-pas', ...s.exercices] } : s)) };
    expect(validerProgramme(abime)).toEqual(p);
    // Des noms hérités de tout objet JavaScript ne sont pas des exercices.
    const piege = { ...p, seances: p.seances.map((s, i) => (i === 0 ? { ...s, exercices: ['constructor', 'toString', '__proto__', ...s.exercices] } : s)) };
    expect(validerProgramme(piege)).toEqual(p);
  });
});

describe('le lien court : la recette du programme, et les retouches', () => {
  const SITE = 'https://sgtraining.netlify.app/';
  const SERVEUR = 'https://srv1302277.hstgr.cloud';
  const codeDe = (lien: string) => new URL(lien).hash.replace('#programme=', '');
  const estCourt = (lien: string) => codeDe(lien).includes('.');

  /** Un tirage reproductible, pour les retouches. */
  const tirage = (graine: number) => {
    let x = graine * 2654435761;
    return () => {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      return x / 2 ** 32;
    };
  };
  /** Des retouches à la main, comme sur l'écran : « Changer », « Ensemble /
   *  Chacun son tour », « Séparer », « Faire une paire », « Refaire les
   *  paires ». */
  function retoucher(programme: ProgrammeMois, alea: () => number, combien: number): ProgrammeMois {
    let q = programme;
    const un = <T,>(liste: T[]) => liste[Math.floor(alea() * liste.length)];
    for (let k = 0; k < combien; k++) {
      const s = un(q.seances);
      const ids = [...s.exercices, ...(s.finale ? [s.finale] : [])];
      const id = un(ids);
      const autre = un(s.exercices);
      switch (Math.floor(alea() * 5)) {
        case 0: {
          const possibles = alternatives(q, s.id, id);
          if (possibles.length > 0) q = remplacerDansProgramme(q, s.id, id, un(possibles).id);
          break;
        }
        case 1:
          q = basculerTour(q, s.id, id);
          break;
        case 2:
          q = delierDansProgramme(q, s.id, id);
          break;
        case 3:
          q = lierDansProgramme(delierDansProgramme(delierDansProgramme(q, s.id, id), s.id, autre), s.id, id, autre);
          break;
        default:
          q = refairePaires(q, s.id);
      }
    }
    return q;
  }

  const p = genererProgramme({ graine: 3_141_592_653, aujourdhui: LUNDI });

  it('tient en moins de 200 caractères, avec le serveur et le code d’équipe', () => {
    const avecEquipe = { ...refaireProgramme(p, { graine: 2_718_281_828, aujourdhui: LUNDI }), serveur: 'https://srv123.hstgr.cloud' };
    expect(avecEquipe.equipe).toBe(equipeDe(p));
    const lien = lienDePartage(avecEquipe, SITE, SERVEUR);
    // https://sgtraining.netlify.app/#programme=9.19xy8w4.g01.….ep1fi6cbe20261005.ssrv123~hstgr~cloud
    expect(VERSION_PROGRAMME).toBe(9);
    expect(lien).toMatch(/^https:\/\/sgtraining\.netlify\.app\/#programme=9\.[0-9a-z]+\.[0-9a-z]+\.[0-9a-z]{4}\.ep[0-9a-z]+20261005\.ssrv123~hstgr~cloud$/);
    expect(lien.length).toBeLessThan(200);
    expect(programmeDansLien(new URL(lien).hash, SERVEUR)).toEqual(avecEquipe);
    // Le serveur du site ne s'écrit pas en entier : une lettre.
    const surLeSite = { ...p, serveur: SERVEUR };
    const court = lienDePartage(surLeSite, SITE, SERVEUR);
    expect(codeDe(court).endsWith('.s')).toBe(true);
    expect(court.length).toBeLessThan(70);
    expect(programmeDansLien(new URL(court).hash, SERVEUR)).toEqual(surLeSite);
    // Bien plus court que le programme en entier.
    expect(`${SITE}#programme=${encoderEnEntier(p)}`.length).toBeGreaterThan(1500);
  });

  // Graines 1 à 50, pour chaque jeu de réglages, avec de 0 à 4 retouches
  // tirées au hasard : le téléphone qui reçoit refait exactement le même
  // programme. Chaque essai compose le programme trois fois (l'envoyé, la
  // recette, la lecture) : quelques secondes.
  const JEUX = [
    { nom: 'par défaut', options: {} },
    { nom: 'deux objectifs, quatre exercices', options: { objectifs: ['bas-du-dos', 'epaules'], exercices: 4 } },
    {
      nom: 'sans alternance ni machines, huit exercices',
      options: { alternance: false, exercices: 8, materiels: ['halteres', 'kettlebell', 'banc', 'tapis'] as ProgrammeMois['materiels'] },
    },
  ];
  for (const [i, { nom, options }] of JEUX.entries()) {
    it(`refait exactement le programme envoyé, retouches comprises — ${nom}`, () => {
      const longueurs: number[] = [];
      for (let graine = 1; graine <= 50; graine++) {
        const alea = tirage(graine * 3 + i);
        let programme = genererProgramme({ graine, aujourdhui: jour(graine % 7), ...options });
        // Les réglages du duo, une équipe et un serveur, un programme sur deux.
        if ((graine + i) % 2 === 0) {
          programme = {
            ...programme,
            duo: {
              exercices: nombreExercicesDe(programme),
              tempo: { ...TEMPOS[graine % TEMPOS.length].tempo },
              reps: { sebastien: 6 + (graine % 5), max: 12 },
              repsLundi: 9,
              // Des points faibles cochés autrement, une fois sur trois.
              ...(graine % 3 === 0
                ? { pointsFaibles: { sebastien: POINTS_FAIBLES.filter((_, k) => (graine + k) % 3 === 0), max: ['pecs' as const] } }
                : {}),
            },
            equipe: `p${graine}abcdef20261005`,
            serveur: graine % 4 === 0 ? SERVEUR : 'http://localhost:8080',
          };
        }
        const envoye = retoucher(programme, alea, Math.floor(alea() * 5));
        const lien = lienDePartage(envoye, SITE, SERVEUR);
        expect(estCourt(lien)).toBe(true);
        expect(programmeDansLien(new URL(lien).hash, SERVEUR)).toEqual(envoye);
        longueurs.push(lien.length);
      }
      expect(Math.max(...longueurs)).toBeLessThan(400);
    }, 30_000);
  }

  it('chaque retouche ajoute quelques caractères', () => {
    const seance = p.seances[1];
    const [a, b] = seance.exercices;
    const nouveau = alternatives(p, seance.id, a)[0].id;
    const base = lienDePartage(p, SITE).length;
    const change = remplacerDansProgramme(p, seance.id, a, nouveau);
    expect(codeDe(lienDePartage(change, SITE))).toMatch(new RegExp(`\\.1c0${nouveau}$`));
    expect(lienDePartage(change, SITE).length - base).toBe(4 + nouveau.length);
    const separe = delierDansProgramme(p, seance.id, b);
    expect(lienDePartage(separe, SITE).length - base).toBeLessThan(10);
    const enTour = basculerTour(p, seance.id, b);
    expect(lienDePartage(enTour, SITE).length - base).toBeLessThan(10);
    for (const retouche of [change, separe, enTour]) {
      expect(programmeDansLien(new URL(lienDePartage(retouche, SITE)).hash)).toEqual(retouche);
    }
  });

  it('passe au lien entier quand la recette ne redonne pas le programme', () => {
    const autresCas: ProgrammeMois[] = [
      { ...p, version: 6 },
      { ...p, graine: 1.5 },
      { ...p, graine: -3 },
      { ...p, materiels: [...p.materiels, 'trampoline' as ProgrammeMois['materiels'][number]] },
      // Une séance qui n'a plus rien de la recette.
      { ...p, seances: p.seances.map((s, i) => (i === 0 ? { ...s, exercices: s.exercices.slice(0, 2), liens: undefined } : s)) },
    ];
    for (const programme of autresCas) {
      const lien = lienDePartage(programme, SITE);
      expect(estCourt(lien)).toBe(false);
      expect(programmeDansLien(new URL(lien).hash)).toEqual(validerProgramme(JSON.parse(JSON.stringify(programme))));
    }
  });

  it('ne fait jamais un autre programme sans le dire : version, bibliothèque, lien abîmé', () => {
    const code = encoderProgramme(p);
    const [, ...reste] = code.split('.');
    // Une application plus ancienne que le lien : elle ne sait pas le refaire.
    expect(decoderProgramme([(VERSION_PROGRAMME + 1).toString(36), ...reste].join('.'))).toBeNull();
    // Une recette qui ne redonne pas les mêmes séances (une autre graine, une
    // bibliothèque qui a changé) : l'empreinte ne correspond plus.
    const [v, g, ...suite] = code.split('.');
    expect(decoderProgramme([v, (parseInt(g, 36) + 1).toString(36), ...suite].join('.'))).toBeNull();
    // Un lien d'une version plus ancienne est recomposé comme le programme
    // de cette version-là (`mettreANiveau`) : le téléphone qui l'a envoyé le
    // recompose de même en se mettant à jour.
    const ancien = decoderProgramme(['6', ...reste].join('.'))!;
    expect(ancien).toEqual(validerProgramme({ ...p, version: 6 }));
    expect(ancien.version).toBe(VERSION_PROGRAMME);
    // Le lien de la version 7 — celui d'avant un seul téléphone, que Big Max a
    // peut-être encore dans ses messages — s'ouvre aussi, recomposé.
    const version7 = decoderProgramme(['7', ...reste].join('.'))!;
    expect(version7).toEqual(validerProgramme({ ...p, version: 7 }));
    expect(version7.seances).toEqual(p.seances);
    // Celui de la version 8 — d'avant les exercices classiques — aussi.
    const version8 = decoderProgramme(['8', ...reste].join('.'))!;
    expect(version8).toEqual(validerProgramme({ ...p, version: 8 }));
    expect(version8.seances).toEqual(p.seances);
    // Abîmés : illisibles.
    const actuelle = VERSION_PROGRAMME.toString(36);
    for (const abime of [`${actuelle}.`, `${actuelle}.x.y.z`, `${code}.zq`, `${code}.9c0n-existe-pas`, `${code}.1o00`, `${code}.1c0constructor`]) {
      expect(decoderProgramme(abime)).toBeNull();
    }
    // Un point final, ou des « ~ » encodés par la messagerie, ne gênent pas.
    const change = remplacerDansProgramme(p, 'mardi-a', p.seances[1].exercices[0], alternatives(p, 'mardi-a', p.seances[1].exercices[0])[0].id);
    const lien = lienDePartage({ ...change, objectifs: ['bas-du-dos', 'epaules'] }, SITE);
    expect(programmeDansLien(`${new URL(lien).hash}.`)).not.toBeNull();
    expect(programmeDansLien(new URL(lien).hash.replace(/~/g, '%7E'))).toEqual(programmeDansLien(new URL(lien).hash));
  });
});

describe('les décisions de Sébastien sur l’audit (11 octobre 2026)', () => {
  /** Toutes les séances composées : graines 1 à 30, semaines A et B, 4, 6 ou 8
   *  exercices. */
  const TOUTES = NOMBRES_EXERCICES.flatMap((nombre) =>
    GRAINES.map((graine) => ({ nombre, graine, programme: programmeCompose(nombre, undefined, graine) })),
  );
  const seanceDe = (programme: ProgrammeMois, id: string) => seanceNommee(programme, id);
  const idsDe = (s: SeanceDuMois) => [...s.exercices, ...(s.finale ? [s.finale] : [])];

  it('l’extension des jambes ne tient nulle part : 6 s la répétition, la série de Big Max en 60 s', () => {
    const jeudi = seanceDe(programmeCompose(6, undefined, 1), 'jeudi-a');
    for (const contexte of [DUO_SEB, DUO_MAX]) {
      const seance = seancePourPersonne(jeudi, PARAMETRES, { ...contexte, tempo: TEMPO_PROGRAMME }, LUNDI);
      const serie = construireEtapes(seance).find((e) => e.type === 'serie' && e.exerciceId === 'leg-extension-machine')!;
      // Speedy 8 répétitions, Big Max 10 : 6 s chacune, sans arrêt ni en bas ni en haut.
      expect(serie.dureeSec, contexte.personne!).toBe(contexte.personne === 'max' ? 60 : 48);
    }
    for (const id of ['leg-extension-machine', 'leg-extension']) {
      expect(secondesParRep(TEMPO_PROGRAMME, EXERCICES_PAR_ID[id]), id).toBe(6);
    }
  });

  it('Speedy : 8 répétitions à la trap bar, même le lundi ; Big Max garde les siennes', () => {
    expect(REPS_MAX_SOULEVE).toBe(8);
    // Les soulevés de terre lourds : debout, à deux mains, le bas du dos chargé.
    const lourds = Object.values(EXERCICES_PAR_ID).filter(estSouleveLourd).map((e) => e.id);
    expect(lourds.sort()).toEqual(['kb-deadlift', 'kb-good-morning', 'romanian-deadlift', 'trap-bar-deadlift']);
    const barre = EXERCICES_PAR_ID['trap-bar-deadlift'];
    expect([repsA('sebastien', barre, 10), repsA('max', barre, 10)]).toEqual([8, 10]);
    expect([repsA('sebastien', barre, 6), repsA('sebastien', barre, 12)]).toEqual([6, 8]);
    expect(repsA('sebastien', EXERCICES_PAR_ID[SUPERMAN], 10)).toBe(10);
    for (const { programme, nombre, graine } of TOUTES.filter((t) => t.graine <= 10)) {
      for (const id of LES_LUNDIS) {
        const lundiMois = seanceDe(programme, id);
        const cas = `${nombre} · ${graine} · ${id}`;
        const seb = seancePourPersonne(lundiMois, PARAMETRES, DUO_SEB, LUNDI).blocs;
        const trapBar = seb.find((b) => b.exerciceId === 'trap-bar-deadlift')!;
        // Speedy 8, Big Max 10 ; les autres exercices du lundi : 10 chacun.
        expect([trapBar.reps, trapBar.autre?.reps], cas).toEqual([8, 10]);
        for (const bloc of seb) {
          if (bloc.exerciceId === 'trap-bar-deadlift' || EXERCICES_PAR_ID[bloc.exerciceId].unite !== 'reps') continue;
          if (bloc.exerciceId === lundiMois.finale) continue;
          expect([bloc.reps, bloc.autre?.reps], `${cas} · ${bloc.exerciceId}`).toEqual([10, 10]);
        }
        // Sur le téléphone de Big Max, la même chose, vue de l'autre côté.
        const max = seancePourPersonne(lundiMois, PARAMETRES, DUO_MAX, LUNDI).blocs.find((b) => b.exerciceId === 'trap-bar-deadlift')!;
        expect([max.reps, max.autre?.reps], cas).toEqual([10, 8]);
      }
    }
    // L'accueil le dit, simplement — le lundi seulement.
    const programme = programmeCompose(6, undefined, 1);
    expect(notePlafond(seanceDe(programme, 'lundi'), repsDuJour(programme, 1))).toBe(
      'Speedy : 8 à la trap bar, 10 ailleurs — pour le bas du dos.',
    );
    for (const id of [...LES_MARDIS, ...LES_JEUDIS]) {
      expect(notePlafond(seanceDe(programme, id), repsDuJour(programme, seanceDe(programme, id).jour)), id).toBeNull();
    }
  });

  it('la pause après une paire : 1 min, 1 min 30 après celle de la trap bar — dans toutes les séances', () => {
    for (const { programme, nombre, graine } of TOUTES) {
      for (const s of programme.seances) {
        const blocs = seancePourPersonne(s, PARAMETRES, DUO_SEB, LUNDI).blocs;
        for (const paire of s.liens ?? []) {
          const attendue = paire.includes('trap-bar-deadlift') ? REPOS_PAIRE_TRAP_BAR_SEC : REPOS_PAIRE_SEC;
          for (const id of paire) {
            expect(blocs.find((b) => b.exerciceId === id)!.reposSec, `${nombre} · ${graine} · ${s.id} · ${id}`).toBe(attendue);
          }
        }
        // Le premier et le dernier exercice, seuls, gardent la leur : une
        // minute, une minute trente à la trap bar.
        for (const seul of [blocs[0], blocs[blocs.length - 1]]) {
          expect(seul.reposSec, `${nombre} · ${graine} · ${s.id} · ${seul.exerciceId}`).toBe(reposDe(EXERCICES_PAR_ID[seul.exerciceId]));
          expect(seul.reposSec).toBe(seul.exerciceId === 'trap-bar-deadlift' ? 90 : 60);
        }
      }
    }
  }, 30_000);

  it('le ventre travaille le dos immobile : rien qui plie le dos au programme, mais tout reste en séance libre', () => {
    const pliants = Object.values(EXERCICES_PAR_ID).filter((e) => (e.famille ?? 'musculation') === 'musculation' && plieLeDos(e));
    expect(pliants.map((e) => e.id)).toEqual(
      expect.arrayContaining(['v-up', 'kb-x-crunch', 'kb-oblique-crunch', 'kb-isometric-crunch', 'kb-straight-arm-sit', 'russian-twist', 'kb-russian-twist', 'v-sit-cross-jab']),
    );
    // Debout, le bûcheron ne plie pas le dos assis : il reste candidat.
    expect(plieLeDos(EXERCICES_PAR_ID['kb-wood-chop'])).toBe(false);
    const candidats = new Set(candidatsProgramme(MATERIELS_PROGRAMME).map((e) => e.id));
    for (const e of pliants) expect(candidats.has(e.id), e.id).toBe(false);
    for (const id of HORS_PROGRAMME) expect(candidats.has(id), id).toBe(false);
    for (const { programme, nombre, graine } of TOUTES) {
      for (const s of programme.seances) {
        const cas = `${nombre} · ${graine} · ${s.id}`;
        for (const id of idsDe(s)) {
          expect(plieLeDos(EXERCICES_PAR_ID[id]), `${cas} · ${id}`).toBe(false);
          expect(HORS_PROGRAMME, `${cas} · ${id}`).not.toContain(id);
        }
        // Le ventre du programme, quand il y en a : du gainage, le dos immobile.
        for (const e of exercicesDe(s).filter((x) => rolesDe(x)[0] === 'tronc')) {
          expect(e.pattern, `${cas} · ${e.id}`).toBe('anti-rotation');
        }
      }
      // Le lundi, le Superman et le ventre — à huit exercices — chacun avec
      // le haut du corps : jamais ensemble, deux exercices du tronc.
      for (const id of LES_LUNDIS) {
        const lundi = seanceDe(programme, id);
        for (const [a, b] of pairesDe(lundi)) expect(zonesDe(a).includes('tronc') && zonesDe(b).includes('tronc')).toBe(false);
        if (nombre === 8) expect(exercicesDe(lundi).some((e) => e.pattern === 'anti-rotation'), `${nombre} · ${graine} · ${id}`).toBe(true);
      }
    }
    // « Changer » ne les propose pas ; la séance libre, si.
    const programme = programmeCompose(8, undefined, 1);
    const lundi = seanceDe(programme, 'lundi');
    const ventre = lundi.exercices.find((id) => rolesDe(EXERCICES_PAR_ID[id])[0] === 'tronc')!;
    for (const e of alternatives(programme, 'lundi', ventre, 200)) expect(plieLeDos(e), e.id).toBe(false);
    const libre = exercicesDisponibles({ ...PARAMETRES_PAR_DEFAUT, niveau: 'intermediaire', materiels: ['halteres', 'kettlebell'] }).map((e) => e.id);
    expect(libre).toEqual(expect.arrayContaining(['v-up', 'kb-x-crunch', 'kb-russian-twist', 'kb-superman']));
  }, 30_000);

  it('le Superman du programme se fait sans poids ; celui au kettlebell reste en séance libre', () => {
    const superman = EXERCICES_PAR_ID[SUPERMAN];
    expect(superman.nomFr).toBe('Superman, sans poids');
    expect(superman.materiel).toBe('tapis');
    expect(cleMouvement(superman)).toBe(cleMouvement(EXERCICES_PAR_ID['kb-superman']));
    expect([superman.pauseEnHaut, superman.pattern, superman.musclesPrincipaux]).toEqual([true, 'charniere', ['lombaires', 'fessiers']]);
    // Rien à charger : le ressenti ne propose pas de monter la charge.
    expect(chargeReglable(superman)).toBe(false);
    expect(chargeReglable(EXERCICES_PAR_ID['kb-superman'])).toBe(true);
    const lundi = seanceDe(programmeCompose(6, undefined, 1), 'lundi');
    const bloc = seancePourPersonne(lundi, PARAMETRES, { ...DUO_SEB, ressentis: { [SUPERMAN]: 'leger' } }, LUNDI).blocs.find(
      (b) => b.exerciceId === SUPERMAN,
    )!;
    expect(bloc.ajustementRessenti).toBeUndefined();
    for (const { programme, nombre, graine } of TOUTES) {
      for (const id of LES_LUNDIS) expect(seanceDe(programme, id).exercices, `${nombre} · ${graine} · ${id}`).toContain(SUPERMAN);
      for (const s of programme.seances) expect(idsDe(s), `${nombre} · ${graine} · ${s.id}`).not.toContain('kb-superman');
    }
    // « Changer » le Superman ne ramène pas celui au kettlebell.
    const programme = programmeCompose(6, undefined, 1);
    expect(alternatives(programme, 'lundi', SUPERMAN, 200).map((e) => e.id)).not.toContain('kb-superman');
  }, 30_000);

  it('la planche de Copenhague courte, chaque jeudi, avec le ventre ou un tirage léger : 15 s de chaque côté', () => {
    const copenhague = EXERCICES_PAR_ID[COPENHAGUE];
    expect(copenhague.nomFr).toBe('Planche de Copenhague (courte)');
    expect([copenhague.materiel, copenhague.cotes, copenhague.unite, copenhague.tenueImposeeSec]).toEqual(['banc', 'unilateral', 'secondes', 15]);
    expect(copenhague.musclesPrincipaux).toEqual(['adducteurs']);
    expect(copenhague.pointsAttention[0]).toBe(
      'Genou du dessus posé sur le banc, hanches hautes, 15 s de chaque côté ; version longue (pied sur le banc) plus tard.',
    );
    // Au temps, pas au ressenti : une série, c'est 15 s, 5 s pour changer de côté, 15 s.
    expect(chargeReglable(copenhague)).toBe(false);
    expect(secondesAuTemps(copenhague, 30)).toBe(15);
    expect(changementDeCoteSec(copenhague)).toBe(5);
    for (const { programme, nombre, graine } of TOUTES) {
      for (const id of LES_JEUDIS) {
        const jeudi = seanceDe(programme, id);
        const cas = `${nombre} · ${graine} · ${id}`;
        const paire = pairesDe(jeudi).find((p) => p.some((e) => e.id === COPENHAGUE));
        expect(paire, cas).toBeDefined();
        // Plus avec l'extérieur de cuisse : deux exercices des jambes.
        const partenaire = paire!.find((e) => e.id !== COPENHAGUE)!;
        expect(zonesDe(partenaire).join() === 'tronc' || tirageLeger(partenaire), `${cas} · ${partenaire.id}`).toBe(true);
      }
      for (const id of [...LES_LUNDIS, ...LES_MARDIS]) expect(seanceDe(programme, id).exercices, `${nombre} · ${graine} · ${id}`).not.toContain(COPENHAGUE);
    }
    // Dans la séance : 3 séries de 15 s de chaque côté, les mêmes pour les deux.
    const jeudi = seanceDe(programmeCompose(6, undefined, 1), 'jeudi-a');
    const seance = seancePourPersonne(jeudi, PARAMETRES, { ...DUO_SEB, tempo: TEMPO_PROGRAMME }, LUNDI);
    const bloc = seance.blocs.find((b) => b.exerciceId === COPENHAGUE)!;
    expect([bloc.series, bloc.reps, bloc.autre?.series, bloc.autre?.reps]).toEqual([3, 15, 3, 15]);
    const serie = construireEtapes(seance).find((e) => e.type === 'serie' && e.exerciceId === COPENHAGUE)!;
    expect(serie.dureeSec).toBe(15 + 5 + 15);
    // Sans banc, l'intérieur de cuisse revient à une fente latérale.
    const sansBanc = genererProgramme({ graine: 1, aujourdhui: LUNDI, materiels: ['halteres', 'kettlebell', 'tapis', 'salle'] });
    for (const id of LES_JEUDIS) {
      const s = seanceDe(sansBanc, id);
      expect(s.exercices, id).not.toContain(COPENHAGUE);
      expect(exercicesDe(s).some((e) => (e.musclesPrincipaux ?? []).includes('adducteurs')), id).toBe(true);
    }
  }, 30_000);

  it('les durées tombent juste : la même horloge sur les deux téléphones, et celle de la graine 1', () => {
    for (const { programme, nombre, graine } of TOUTES.filter((t) => t.graine <= 6)) {
      for (const s of programme.seances) {
        const cas = `${nombre} · ${graine} · ${s.id}`;
        // Sur deux téléphones (la séance commune, cachée), et sur un seul : la
        // même durée, que le téléphone soit celui de Speedy ou de Big Max.
        for (const unTelephone of [false, true]) {
          const [seb, max] = [DUO_SEB, DUO_MAX].map((contexte) =>
            seancePourPersonne(s, PARAMETRES, { ...contexte, unTelephone, tempo: TEMPO_PROGRAMME }, LUNDI),
          );
          expect(dureeTotaleSec(construireEtapes(seb)), cas).toBe(seb.dureeEstimeeSec);
          expect(dureeTotaleSec(construireEtapes(max)), cas).toBe(max.dureeEstimeeSec);
          expect(seb.dureeEstimeeSec, cas).toBe(max.dureeEstimeeSec);
        }
      }
    }
    // Graine 1, par défaut — huit exercices —, à deux sur un seul téléphone :
    // lundi 1 h 02 min 54 s, chaque semaine ; mardi A 1 h 05 min 11 s, jeudi
    // A 59 min 7 s ; mardi B 1 h 08 min 44 s, jeudi B 1 h 02 min 7 s — les
    // exercices seuls avec une pause entre les tours, sauf la marche du
    // fermier. Une estimation : les séries se finissent sur « Série terminée ».
    const graine1 = programmeCompose(8, undefined, 1);
    expect(graine1.seances.map((s) => [s.id, dureeSec(s)])).toEqual([
      ['lundi', 3774],
      ['mardi-a', 3911],
      ['jeudi-a', 3547],
      ['mardi-b', 4124],
      ['jeudi-b', 3727],
    ]);
  }, 30_000);
});
