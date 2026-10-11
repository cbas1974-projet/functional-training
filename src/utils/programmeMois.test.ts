import { describe, expect, it } from 'vitest';
import type { Exercice, ParametresSeance, ProgrammeMois, SeanceDuMois, SeanceRealisee } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT, TEMPOS } from '../data/parametres';
import { construireEtapes, dureeTotaleSec, etatMetronome } from './etapesSeance';
import { changementDeCoteSec, cleMouvement, exercicesDisponibles, secondesParRep, tempoPourExercice } from './generateurSeance';
import { OBJECTIFS_MUSCULAIRES } from './muscles';
import * as moduleProgramme from './programmeMois';
import {
  DUREE_MAXI_SEC,
  EXERCICES_EN_PLUS_LUNDI,
  EXERCICES_MIS_DE_COTE,
  EXERCICES_PAR_DEFAUT,
  JOURS_JIU_JITSU,
  MATERIELS_PROGRAMME,
  NOMBRES_EXERCICES,
  REPOS_PETITS_SEC,
  REPOS_SEC,
  REPOS_TRAP_BAR_SEC,
  REPS_LUNDI_PAR_DEFAUT,
  REPS_PAR_DEFAUT,
  SWING_DU_JEUDI,
  TEMPO_PROGRAMME,
  TRANSITION_LIEN_SEC,
  VERSION_PROGRAMME,
  accordPaire,
  adresseServeurValide,
  alternatives,
  apparier,
  avecNombreExercices,
  avecTempo,
  basculerTour,
  candidatsProgramme,
  chargeLeBasDuDos,
  chargeDeSerie,
  chargeProposee,
  chargesPassees,
  decoderProgramme,
  delierDansProgramme,
  dureeSec,
  equipeDe,
  estPoussee,
  estRetouche,
  echauffementDe,
  etirementsDe,
  etirementsPauseDe,
  faiteCetteSemaine,
  genererProgramme,
  lienDePartage,
  lierDansProgramme,
  nombreExercicesDe,
  nombreExercicesDuJour,
  pairesAutomatiques,
  prochaineDate,
  prochaineSeance,
  programmeDansLien,
  refairePaires,
  refaireProgramme,
  remplacerDansProgramme,
  reposDe,
  reposDePaire,
  repsDuDuo,
  repsDuJour,
  repsLundiDe,
  rolesDe,
  seanceAProposer,
  seancePourPersonne,
  semaineDe,
  tempoDuProgramme,
  validerProgramme,
} from './programmeMois';
import type { ContexteSeance } from './programmeMois';

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
/** Le nombre d'exercices d'une séance (sans le dernier) : celui du réglage, et
 *  deux de plus le lundi. */
const voulus = (nombre: number, seance: Pick<SeanceDuMois, 'jour'>) => nombre + (seance.jour === 1 ? 2 : 0);
/** Les deux machines des cuisses, la paire préférée du duo : chaque jeudi,
 *  semaine A comme semaine B. */
const MACHINES_DU_JEUDI = ['leg-extension-machine', 'leg-curl-machine'];
/** Ce qui revient chaque semaine : la trap bar et le Superman le lundi, le
 *  swing et les deux machines le jeudi. */
const FAVORIS = ['trap-bar-deadlift', 'kb-superman', SWING_DU_JEUDI, ...MACHINES_DU_JEUDI];
const LES_LUNDIS = ['lundi-a', 'lundi-b'];
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
  it('compose la semaine : lundi tout le corps, mardi le haut, jeudi les jambes — les trois en semaines A et B', () => {
    expect(programmes[0].seances.map((s) => [s.id, s.nom, s.jour, s.semaine, s.type, s.partie, s.format])).toEqual([
      ['lundi-a', 'Lundi A — tout le corps', 1, 'A', 'dure', 'complet', 'series'],
      ['mardi-a', 'Mardi A — le haut', 2, 'A', 'facile', 'haut', 'series'],
      ['jeudi-a', 'Jeudi A — les jambes', 4, 'A', 'facile', 'bas', 'series'],
      ['lundi-b', 'Lundi B — tout le corps', 1, 'B', 'dure', 'complet', 'series'],
      ['mardi-b', 'Mardi B — le haut', 2, 'B', 'facile', 'haut', 'series'],
      ['jeudi-b', 'Jeudi B — les jambes', 4, 'B', 'facile', 'bas', 'series'],
    ]);
  });

  it('tous les jours, des paires d’exercices opposés ; la finale seule, à la fin', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        // Quatre paires le lundi, trois le mardi et le jeudi, côte à côte, et
        // rien d'autre.
        const paires = s.jour === 1 ? 4 : 3;
        expect(s.liens, `${p.graine} · ${s.id}`).toHaveLength(paires);
        expect(s.liens!.flat()).toEqual(s.exercices);
        for (const [a, b] of pairesDe(s)) {
          expect(accordPaire(a, b).accord, `${p.graine} · ${s.id} · ${a.id} + ${b.id}`).toBe('bon');
        }
        // La finale n'est dans aucune paire.
        expect(s.liens!.flat()).not.toContain(s.finale);
        // La séance guidée les déroule ainsi : chaque paire est un groupe, la
        // finale vient seule après.
        const blocs = seancePourPersonne(s, PARAMETRES, DUO_MAX, LUNDI).blocs;
        expect(blocs.map((b) => b.superset)).toEqual([...s.exercices.map((_, i) => Math.floor(i / 2)), undefined]);
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

  it('la semaine B change les exercices de la semaine A — sauf la trap bar, le Superman, le swing et les deux machines', () => {
    for (const p of programmes) {
      for (const [a, b] of [
        ['lundi-a', 'lundi-b'],
        ['mardi-a', 'mardi-b'],
        ['jeudi-a', 'jeudi-b'],
      ]) {
        const deA = new Set(exercicesDe(seanceNommee(p, a)).map(cleMouvement));
        const repris = exercicesDe(seanceNommee(p, b)).filter((e) => deA.has(cleMouvement(e)));
        expect(repris.filter((e) => !FAVORIS.includes(e.id)).map((e) => e.id), `${p.graine} · ${b}`).toEqual([]);
      }
      // Les favoris, eux, reviennent chaque semaine.
      for (const id of LES_LUNDIS) {
        expect(seanceNommee(p, id).exercices[0]).toBe('trap-bar-deadlift');
        expect(seanceNommee(p, id).exercices).toContain('kb-superman');
      }
      for (const id of LES_JEUDIS) {
        expect(seanceNommee(p, id).exercices[0]).toBe(SWING_DU_JEUDI);
        expect(seanceNommee(p, id).liens).toContainEqual(MACHINES_DU_JEUDI);
      }
    }
  });

  it('un même mouvement ne revient pas deux fois dans une séance', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        const cles = [...exercicesDe(s), EXERCICES_PAR_ID[s.finale!]].map(cleMouvement);
        expect(new Set(cles).size).toBe(cles.length);
      }
    }
  });

  it('vise les faiblesses : bas du dos et épaules le lundi, épaules le mardi, intérieur et extérieur de cuisse le jeudi', () => {
    for (const p of programmes) {
      for (const id of LES_LUNDIS) {
        expect(vise(seanceNommee(p, id), 'lombaires')).toBe(true);
        expect(vise(seanceNommee(p, id), 'epaules')).toBe(true);
      }
      for (const id of LES_MARDIS) expect(vise(seanceNommee(p, id), 'epaules')).toBe(true);
      for (const id of LES_JEUDIS) {
        expect(vise(seanceNommee(p, id), 'abducteurs')).toBe(true);
        expect(vise(seanceNommee(p, id), 'adducteurs')).toBe(true);
      }
    }
  });

  it('le lundi s’ouvre sur la trap bar avec le haut du corps, met le bas du dos face au ventre, tire et pousse, et finit à la presse ou au hack squat', () => {
    for (const p of programmes) {
      for (const id of LES_LUNDIS) {
        const seance = seanceNommee(p, id);
        const lundi = exercicesDe(seance);
        const cas = `${p.graine} · ${id}`;
        expect(lundi[0].id, cas).toBe('trap-bar-deadlift');
        expect(accordPaire(...pairesDe(seance)[0]).raison, cas).toBe('haut ↔ bas');
        // Le Superman avec le ventre : les deux côtés du tronc.
        expect(pairesDe(seance).map(([a, b]) => accordPaire(a, b).raison), cas).toContain('ventre ↔ bas du dos');
        expect(seance.exercices, cas).toContain('kb-superman');
        // On tire, sans charger le bas du dos — la trap bar l'a déjà fait —, et on pousse.
        const tirages = lundi.filter((e) => e.pattern === 'tirage-horizontal' || e.pattern === 'tirage-vertical');
        expect(tirages.length, cas).toBeGreaterThan(0);
        expect(tirages.filter(chargeLeBasDuDos), cas).toEqual([]);
        expect(lundi.some((e) => estPoussee(e)), cas).toBe(true);
        // Une seule charnière lourde : le bas du dos se travaille à part.
        const charnieres = lundi.filter((e) => e.pattern === 'charniere' && (e.musclesPrincipaux ?? []).includes('ischios'));
        expect(charnieres.map((e) => e.id), cas).toEqual(['trap-bar-deadlift']);
        expect(['leg-press', 'hack-squat'], cas).toContain(seance.finale);
        // Une machine pour deux : chacun son tour, d'office.
        expect(seance.tour, cas).toEqual(['trap-bar-deadlift', seance.finale]);
      }
      // D'une semaine à l'autre, la presse et le hack squat alternent.
      expect(seanceNommee(p, 'lundi-a').finale).not.toBe(seanceNommee(p, 'lundi-b').finale);
    }
  });

  it('le mardi, le haut du corps et le jiu-jitsu le soir : les épaules, tirer avec pousser, les bras, rien qui charge le bas du dos ; la marche du fermier pour finir', () => {
    for (const p of programmes) {
      for (const id of LES_MARDIS) {
        const seance = seanceNommee(p, id);
        const cas = `${p.graine} · ${id}`;
        expect(exercicesDe(seance).filter(chargeLeBasDuDos), cas).toEqual([]);
        const raisons = pairesDe(seance).map(([a, b]) => accordPaire(a, b).raison);
        expect(raisons.some((r) => r === 'épaules ↔ dos' || r === 'pectoraux ↔ dos' || r === 'pousser ↔ tirer'), cas).toBe(true);
        // Les bras : un biceps et un triceps, le plus souvent ensemble.
        expect(vise(seance, 'biceps') && vise(seance, 'triceps'), cas).toBe(true);
        expect(['farmers-walk', 'kb-farmers-walk'], cas).toContain(seance.finale);
        expect(seance.tour, cas).toBeUndefined();
      }
    }
  });

  it('le jeudi, les jambes, modéré : le swing en tête, avec un tirage léger ; une fente, l’intérieur avec l’extérieur de cuisse, les deux machines ; le traîneau pour finir', () => {
    for (const p of programmes) {
      for (const id of LES_JEUDIS) {
        const seance = seanceNommee(p, id);
        const cas = `${p.graine} · ${id}`;
        const [swing, partenaire] = pairesDe(seance)[0];
        expect(swing.id, cas).toBe(SWING_DU_JEUDI);
        // Jamais une fente, un squat ou un autre exercice des jambes : un
        // tirage léger du haut du corps, qui ne charge pas le bas du dos.
        expect(tirageLeger(partenaire), `${cas} · ${partenaire.id}`).toBe(true);
        const raisons = pairesDe(seance).map(([a, b]) => accordPaire(a, b).raison);
        expect(raisons, cas).toContain('intérieur ↔ extérieur de cuisse');
        expect(seance.liens, cas).toContainEqual(MACHINES_DU_JEUDI);
        // Les fentes sont de retour : une fente latérale, pour l'intérieur de cuisse.
        expect(exercicesDe(seance).some((e) => e.pattern === 'fente'), cas).toBe(true);
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
            // Le nombre du jour, tout en paires.
            expect(s.exercices, cas).toHaveLength(voulus(nombre, s));
            expect(s.liens, cas).toHaveLength(voulus(nombre, s) / 2);
            for (const [a, b] of pairesDe(s)) {
              expect(chargeLeBasDuDos(a) && chargeLeBasDuDos(b), `${cas} · ${a.id} + ${b.id}`).toBe(false);
              expect(accordPaire(a, b).accord, `${cas} · ${a.id} + ${b.id}`).toBe('bon');
            }
            // Le swing ne va jamais avec un exercice des jambes.
            const avecSwing = pairesDe(s).find((paire) => paire.some((e) => e.id === SWING_DU_JEUDI));
            if (avecSwing) expect(tirageLeger(avecSwing.find((e) => e.id !== SWING_DU_JEUDI)!), cas).toBe(true);
            // Les deux machines, quand elles y sont, vont ensemble.
            const machines = s.exercices.filter((id) => MACHINES_DU_JEUDI.includes(id));
            if (machines.length > 0) expect(s.liens, cas).toContainEqual(MACHINES_DU_JEUDI);
            expect(dureeSec(s)).toBeLessThanOrEqual(DUREE_MAXI_SEC);
          }
        }
      }
    }
    // Des centaines de programmes : plus long que les cinq secondes d'usage.
  }, 30_000);

  it('dit la raison de chaque paire : des muscles opposés, pousser avec tirer, le haut avec le bas', () => {
    const raisons = new Set(programmes.flatMap((p) => p.seances.flatMap((s) => pairesDe(s).map(([a, b]) => accordPaire(a, b).raison))));
    for (const raison of raisons) {
      expect([
        'biceps ↔ triceps',
        'pectoraux ↔ dos',
        'épaules ↔ dos',
        'intérieur ↔ extérieur de cuisse',
        'quadriceps ↔ ischios',
        'quadriceps ↔ bas du dos',
        'quadriceps ↔ fessiers',
        'ventre ↔ bas du dos',
        'pousser ↔ tirer',
        'haut ↔ bas',
      ]).toContain(raison);
    }
  });

  it('par défaut, huit exercices le lundi, six le mardi et le jeudi, et la finale, au tempo 3 s / 3 s + 1 s en bas : environ 1 h 20 le lundi, 1 h les autres jours', () => {
    expect(EXERCICES_PAR_DEFAUT).toBe(6);
    expect(EXERCICES_EN_PLUS_LUNDI).toBe(2);
    expect(TEMPO_PROGRAMME).toEqual({ monteeSec: 3, descenteSec: 3, pauseSec: 1 });
    const durees: Record<number, number[]> = { 1: [], 2: [], 4: [] };
    for (const p of programmes) {
      expect(nombreExercicesDe(p)).toBe(6);
      expect(tempoDuProgramme(p)).toEqual(TEMPO_PROGRAMME);
      for (const s of p.seances) {
        expect(s.exercices).toHaveLength(s.jour === 1 ? 8 : 6);
        expect(nombreExercicesDuJour(nombreExercicesDe(p), s)).toBe(s.exercices.length);
        expect(s.finale).toBeDefined();
        const seance = seancePourPersonne(s, PARAMETRES, { ...DUO_SEB, tempo: tempoDuProgramme(p) }, LUNDI);
        expect(seance.parametres.tempo).toEqual(TEMPO_PROGRAMME);
        expect(seance.blocs).toHaveLength(s.exercices.length + 1);
        durees[s.jour].push(seance.dureeEstimeeSec / 60);
      }
    }
    const moyenne = (d: number[]) => d.reduce((somme, x) => somme + x, 0) / d.length;
    // Le lundi, la grosse séance : environ 1 h 20.
    expect(Math.min(...durees[1])).toBeGreaterThan(75);
    expect(Math.max(...durees[1])).toBeLessThan(95);
    expect(moyenne(durees[1])).toBeGreaterThan(78);
    expect(moyenne(durees[1])).toBeLessThan(90);
    // Le mardi, environ une heure — Big Max fait une série de plus aux poussées.
    expect(Math.min(...durees[2])).toBeGreaterThan(58);
    expect(Math.max(...durees[2])).toBeLessThan(78);
    // Le jeudi, une heure, sans machine lourde.
    expect(Math.min(...durees[4])).toBeGreaterThan(55);
    expect(Math.max(...durees[4])).toBeLessThan(68);
  });

  it('seul, la séance dure à peine plus qu’à deux : sans l’autre, la machine laisse une vraie pause', () => {
    for (const p of programmes.slice(0, 10)) {
      for (const s of p.seances) {
        for (const contexte of [SEUL_SEB, SEUL_MAX]) {
          expect(dureeSec(s, {}, contexte)).toBeLessThanOrEqual(dureeSec(s, {}, DUO_SEB) + 3 * 60);
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

  it('changent le nombre d’exercices — le lundi deux de plus — et la durée, pareil sur les deux téléphones', () => {
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
        expect(s.exercices).toHaveLength(voulus(nombre, s));
        expect(nombreExercicesDuJour(nombre, s)).toBe(voulus(nombre, s));
        expect(s.liens).toHaveLength(voulus(nombre, s) / 2);
        expect(s.finale).toBeDefined();
      }
      // Le lundi garde la trap bar en tête, le jeudi le swing ; le lundi dure
      // plus à chaque paire.
      const lundi = seanceNommee(regle, 'lundi-a');
      expect(lundi.exercices[0]).toBe('trap-bar-deadlift');
      expect(seanceNommee(regle, 'jeudi-a').exercices[0]).toBe(SWING_DU_JEUDI);
      expect(dureeSec(lundi)).toBeGreaterThan(precedente);
      precedente = dureeSec(lundi);
    }
    // Revenir à six : le programme du début. Dix ne se choisit plus.
    expect(avecNombreExercices(avecNombreExercices(p, 8), 6).seances).toEqual(p.seances);
    expect(nombreExercicesDe(avecNombreExercices(p, 10))).toBe(6);
  });

  it('les objectifs passent d’abord : à quatre exercices (six le lundi), ils y sont encore', () => {
    for (const programme of programmes.slice(0, 10)) {
      const court = avecNombreExercices(programme, 4);
      for (const id of LES_LUNDIS) {
        const lundi = seanceNommee(court, id);
        expect(lundi.exercices).toHaveLength(6);
        expect(lundi.exercices[0]).toBe('trap-bar-deadlift');
        expect(vise(lundi, 'lombaires') && vise(lundi, 'epaules')).toBe(true);
      }
      for (const id of LES_JEUDIS) {
        const jeudi = seanceNommee(court, id);
        expect(jeudi.exercices[0]).toBe(SWING_DU_JEUDI);
        expect(['abducteurs', 'adducteurs'].every((muscle) => vise(jeudi, muscle))).toBe(true);
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
    const regle = avecTempo(avecNombreExercices(p, 8), TEMPOS[0].tempo);
    const refait = refaireProgramme(regle, { graine: 99 });
    expect(refait.duo).toEqual(regle.duo);
    expect(refait.seances.every((s) => s.exercices.length === voulus(8, s))).toBe(true);
    expect(estRetouche(regle)).toBe(false);
    expect(estRetouche(JSON.parse(JSON.stringify(regle)))).toBe(false);
    expect(estRetouche(basculerTour(regle, 'lundi-a', seanceNommee(regle, 'lundi-a').exercices[2]))).toBe(true);
    expect(estRetouche(delierDansProgramme(regle, 'jeudi-a', seanceNommee(regle, 'jeudi-a').exercices[0]))).toBe(true);
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

  it('trouve la séance du jour, ou la prochaine — les trois jours en semaines A et B', () => {
    const cas: [number, string, number][] = [
      [0, 'lundi-a', 0],
      [1, 'mardi-a', 0],
      [2, 'jeudi-a', 1], // mercredi
      [3, 'jeudi-a', 0],
      [4, 'lundi-b', 3], // vendredi
      [-2, 'lundi-a', 2], // samedi d'avant le début
      [7, 'lundi-b', 0],
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
    const lundi = seanceNommee(p, 'lundi-a');
    expect(seanceAProposer(p, [], jour(0, 7))?.seance.id).toBe('lundi-a');
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
    expect(prochaineDate(p, seanceNommee(p, 'lundi-b'), jour(0))).toEqual(new Date(2026, 9, 12));
  });

  it('plus de semaine dure : le jeudi B a les répétitions du jeudi A, et rien n’en reste dans le programme', () => {
    for (const [a, b] of [['jeudi-a', 'jeudi-b'], ['lundi-a', 'lundi-b']]) {
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
  const lundi = seanceNommee(p, 'lundi-a');
  const mardi = seanceNommee(p, 'mardi-a');
  const jeudi = seanceNommee(p, 'jeudi-a');
  const exercice = (id: string) => EXERCICES_PAR_ID[id];

  it('déroule chaque jour par paires : à la suite, puis la pause de la paire ; la finale seule', () => {
    const reference = seancePourPersonne(lundi, PARAMETRES, SEUL_SEB, LUNDI);
    expect(reference.titre).toBe(lundi.nom);
    expect(reference.blocs.map((b) => b.exerciceId)).toEqual([...lundi.exercices, lundi.finale]);
    expect(reference.blocs.every((b) => b.series === 3)).toBe(true);
    expect(reference.parametres.format).toBe('superset');

    for (const s of [lundi, mardi, jeudi]) {
      const seance = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      const enPaires = seance.blocs.slice(0, s.exercices.length);
      expect(enPaires.map((b) => b.superset)).toEqual(s.exercices.map((_, i) => Math.floor(i / 2)));
      for (const bloc of enPaires) {
        const paire = s.liens!.find((groupe) => groupe.includes(bloc.exerciceId))!;
        expect(bloc.transitionSec).toBe(TRANSITION_LIEN_SEC);
        // La pause de la paire : la plus longue des pauses de ses deux exercices.
        expect(bloc.reposSec).toBe(Math.max(...paire.map((id) => reposDe(exercice(id), s))));
        // Au temps, 30 s ; sinon les répétitions du jour : 10 le lundi, 8 les
        // jours de jiu-jitsu.
        expect(bloc.reps).toBe(exercice(bloc.exerciceId).unite === 'secondes' ? 30 : s.jour === 1 ? 10 : 8);
      }
      // Le dernier, seul, après les paires.
      const fin = seance.blocs[seance.blocs.length - 1];
      expect(fin.exerciceId).toBe(s.finale);
      expect(fin.superset).toBeUndefined();
    }
    expect([REPOS_PETITS_SEC, REPOS_SEC, REPOS_TRAP_BAR_SEC, TRANSITION_LIEN_SEC]).toEqual([60, 90, 120, 15]);
  });

  it('la pause d’une paire est la plus longue des pauses de ses deux exercices : 1 min, 1 min 30, 2 min avec la trap bar', () => {
    const jeudiMois = { type: 'dure' } as const;
    // Deux petits muscles : une minute.
    expect(reposDePaire(['hammer-curl', 'tricep-extension'], jeudiMois)).toBe(60);
    expect(reposDePaire(['kb-russian-twist', 'fire-hydrant'], jeudiMois)).toBe(60);
    // Un gros exercice, même avec un petit : une minute trente.
    expect(reposDePaire(['goblet-squat', 'hamstring-curl'], jeudiMois)).toBe(90);
    expect(reposDePaire(['hammer-curl', 'goblet-squat'], jeudiMois)).toBe(90);
    expect(reposDePaire(['bench-press', 'incline-row'], jeudiMois)).toBe(90);
    // La trap bar : deux minutes, avec n'importe quel partenaire.
    expect(reposDePaire(['trap-bar-deadlift', 'incline-row'], jeudiMois)).toBe(120);
    expect(reposDePaire(['hammer-curl', 'trap-bar-deadlift'], jeudiMois)).toBe(120);

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
    // La finale, seule, garde sa pause d'exercice seul.
    expect(blocs.map((b) => b.reposSec)).toEqual([120, 120, 90, 90, 60, 60, 90]);
    // Séparés, les exercices retrouvent chacun la leur.
    const separee = ['hamstring-curl', 'tricep-extension'].reduce(
      (prog, id) => delierDansProgramme(prog, maison.id, id),
      { ...p, seances: [maison] },
    );
    const seuls = seancePourPersonne(separee.seances[0], PARAMETRES, SEUL_SEB, LUNDI).blocs;
    expect(seuls.map((b) => b.reposSec)).toEqual([120, 120, 90, 60, 60, 60, 90]);
  });

  it('suit le tempo du programme, pas celui du téléphone ; sans programme, celui du téléphone', () => {
    const lent = seancePourPersonne(lundi, PARAMETRES, { ...DUO_SEB, tempo: TEMPO_PROGRAMME }, LUNDI);
    const rapide = seancePourPersonne(lundi, PARAMETRES, { ...DUO_SEB, tempo: { monteeSec: 2, descenteSec: 4 } }, LUNDI);
    expect(lent.parametres.tempo).toEqual(TEMPO_PROGRAMME);
    expect(rapide.dureeEstimeeSec).toBeLessThan(lent.dureeEstimeeSec);
    expect(seancePourPersonne(lundi, PARAMETRES, DUO_SEB, LUNDI).parametres.tempo).toEqual(PARAMETRES.tempo);
  });

  it('les répétitions du jour : 10 chacun le lundi, Speedy 8 et Big Max 10 les jours de jiu-jitsu ; Big Max fait une série de plus aux poussées', () => {
    for (const s of p.seances) {
      const seb = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      const max = seancePourPersonne(s, PARAMETRES, SEUL_MAX, LUNDI);
      max.blocs.forEach((bloc, i) => {
        const e = exercice(bloc.exerciceId);
        if (bloc.exerciceId === s.finale) return;
        expect(bloc.series).toBe(estPoussee(e) ? 4 : 3);
        expect(seb.blocs[i].series).toBe(3);
        if (e.unite === 'reps') expect([seb.blocs[i].reps, bloc.reps], `${s.id} · ${e.id}`).toEqual(s.jour === 1 ? [10, 10] : [8, 10]);
      });
    }
    expect(JOURS_JIU_JITSU).toEqual([0, 2, 4]);
    expect(REPS_PAR_DEFAUT).toEqual({ sebastien: 8, max: 10 });
    expect(REPS_LUNDI_PAR_DEFAUT).toBe(10);
    expect(repsDuJour({}, 1)).toEqual({ sebastien: 10, max: 10 });
    expect(repsDuJour({}, 2)).toEqual({ sebastien: 8, max: 10 });
    expect(repsDuJour({}, 4)).toEqual({ sebastien: 8, max: 10 });
    // Le mardi, le haut du corps : il y a bien des poussées.
    expect(mardi.exercices.some((id) => estPoussee(exercice(id)))).toBe(true);
    // Un oiseau tire : ce n'est pas une poussée.
    expect(estPoussee(exercice('kb-rear-fly'))).toBe(false);
    expect(estPoussee(exercice('bench-press'))).toBe(true);
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

  it('seul, hors paire, repose selon l’exercice : deux minutes à la trap bar, une minute aux petits muscles', () => {
    const sansPaires = lundi.exercices.reduce((prog, id) => delierDansProgramme(prog, 'lundi-a', id), p);
    const reference = seancePourPersonne(seanceNommee(sansPaires, 'lundi-a'), PARAMETRES, SEUL_SEB, LUNDI);
    expect(reference.parametres.format).toBe('series');
    for (const bloc of reference.blocs) {
      const e = exercice(bloc.exerciceId);
      const petit = e.pattern === 'isolation' || ['anti-rotation', 'flexion-tronc', 'rotation', 'flexion-laterale'].includes(e.pattern);
      expect(bloc.superset).toBeUndefined();
      expect(bloc.reposSec).toBe(e.id === 'trap-bar-deadlift' ? 120 : petit ? 60 : 90);
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

  it('chacun son tour se bascule, et la durée à deux suit', () => {
    // La finale, sur machine, se fait chacun son tour ; côte à côte, elle va
    // plus vite.
    const finale = lundi.finale!;
    const bascule = basculerTour(p, 'lundi-a', finale);
    expect(seanceNommee(bascule, 'lundi-a').tour).not.toContain(finale);
    expect(dureeSec(seanceNommee(bascule, 'lundi-a'))).toBeLessThan(dureeSec(lundi));
    const retour = basculerTour(bascule, 'lundi-a', finale);
    expect(seanceNommee(retour, 'lundi-a')).toEqual(lundi);
    // Dans une paire, chacun son tour ne coûte rien : on se croise.
    const [, , autre] = lundi.exercices;
    expect(dureeSec(seanceNommee(basculerTour(p, 'lundi-a', autre), 'lundi-a'))).toBe(dureeSec(lundi));
  });

  it('annonce exactement la durée que la séance guidée chronométrera', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const contexte of CONTEXTES) {
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
            basculerTour(delierDansProgramme(avecNombre, s.id, s.exercices[0]), s.id, s.exercices[3]),
            s.id,
          );
          for (const seanceMois of [s, retouchee]) {
            for (const contexte of [DUO_SEB, DUO_MAX, SEUL_SEB]) {
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
  const lundi = seanceNommee(p, 'lundi-a');
  const exercice = (id: string) => EXERCICES_PAR_ID[id];
  const accord = (a: string, b: string) => accordPaire(exercice(a), exercice(b));

  it('dit qui va bien ensemble, et pourquoi', () => {
    // Des exercices qui s'opposent.
    expect(accord('bench-press', 'incline-row')).toEqual({ accord: 'bon', raison: 'pectoraux ↔ dos' });
    expect(accord('shoulder-press', 'incline-row')).toEqual({ accord: 'bon', raison: 'épaules ↔ dos' });
    expect(accord('hammer-curl', 'tricep-extension')).toEqual({ accord: 'bon', raison: 'biceps ↔ triceps' });
    expect(accord('side-raise', 'hammer-curl')).toEqual({ accord: 'bon', raison: 'pousser ↔ tirer' });
    expect(accord('goblet-squat', 'hamstring-curl')).toEqual({ accord: 'bon', raison: 'quadriceps ↔ ischios' });
    expect(accord('side-lunge', 'fire-hydrant')).toEqual({ accord: 'bon', raison: 'intérieur ↔ extérieur de cuisse' });
    expect(accord('kb-superman', 'kb-x-crunch')).toEqual({ accord: 'bon', raison: 'ventre ↔ bas du dos' });
    expect(accord('trap-bar-deadlift', 'incline-row')).toEqual({ accord: 'bon', raison: 'haut ↔ bas' });
    // Dans les deux sens.
    expect(accord('incline-row', 'bench-press')).toEqual(accord('bench-press', 'incline-row'));
    // Jamais deux exercices qui chargent le bas du dos.
    expect(accord('trap-bar-deadlift', 'bent-over-row')).toEqual({ accord: 'bas-du-dos', raison: 'le bas du dos deux fois' });
    expect(accord('romanian-deadlift', 'squat').accord).toBe('bas-du-dos');
    // Jamais les mêmes muscles principaux — même pour une fente et une
    // charnière, qui partagent les fessiers.
    expect(accord('bench-press', 'dumbbell-push-up')).toEqual({ accord: 'memes-muscles', raison: 'mêmes muscles : pectoraux' });
    expect(accord('reverse-lunge', 'kb-deadlift')).toEqual({ accord: 'memes-muscles', raison: 'mêmes muscles : fessiers' });
    // Et deux exercices qui ne s'opposent pas.
    expect(accord('hamstring-curl', 'frog-pump')).toEqual({ accord: 'pas-opposes', raison: 'pas opposés : deux fois les jambes' });
    expect(accord('side-raise', 'tricep-extension')).toEqual({ accord: 'pas-opposes', raison: 'pas opposés : pousser deux fois' });
    expect(accord('kb-x-crunch', 'hammer-curl').accord).toBe('pas-opposes');
    // Un pull-over tire, même s'il travaille les pectoraux.
    expect(accord('dumbbell-pullover', 'shoulder-shrug').accord).toBe('pas-opposes');
    // Jamais deux exercices qui coupent le souffle : un squat avec une charnière.
    expect(accord('sumo-squat', 'kb-deadlift')).toEqual({ accord: 'souffle', raison: 'deux exercices qui coupent le souffle' });
    expect(accord('goblet-squat', 'hamstring-curl').accord).toBe('bon');
  });

  it('le swing ne va qu’avec un tirage léger du haut du corps : jamais une fente, un squat, un autre exercice des jambes', () => {
    // Un tirage léger : l'arrière des épaules, un rowing appuyé.
    for (const tirage of ['reverse-fly', 'kb-rear-fly', 'incline-row', 'single-arm-row']) {
      expect(accord(SWING_DU_JEUDI, tirage), tirage).toEqual({ accord: 'bon', raison: 'haut ↔ bas' });
      expect(accord(tirage, SWING_DU_JEUDI), tirage).toEqual(accord(SWING_DU_JEUDI, tirage));
    }
    // Les fentes et les squats : les mêmes fessiers, ou deux exercices qui coupent le souffle.
    for (const jambes of ['reverse-lunge', 'kb-lunge', 'step-up', 'goblet-squat', 'curtsy-lunge']) {
      expect(accord(SWING_DU_JEUDI, jambes).accord, jambes).toBe('memes-muscles');
    }
    for (const jambes of ['side-lunge', 'sumo-squat', 'kb-bob-and-weave', 'kb-rotating-side-lunge-press']) {
      expect(accord(SWING_DU_JEUDI, jambes), jambes).toEqual({ accord: 'souffle', raison: 'deux exercices qui coupent le souffle' });
    }
    // Même un exercice des jambes qui ne coupe pas le souffle, même une machine.
    for (const autre of ['leg-extension-machine', 'leg-extension', 'kb-wall-squat-press', 'kb-side-leg-raise', 'bench-press', 'kb-x-crunch']) {
      expect(accord(SWING_DU_JEUDI, autre), autre).toEqual({ accord: 'souffle', raison: 'un explosif va avec un tirage léger du haut du corps' });
      expect(accord(autre, SWING_DU_JEUDI).accord, autre).toBe('souffle');
    }
    // Un rowing qui charge le bas du dos non plus : le swing le charge déjà.
    expect(accord(SWING_DU_JEUDI, 'bent-over-row').accord).toBe('bas-du-dos');
    expect(accord(SWING_DU_JEUDI, 'seesaw-row').accord).toBe('bas-du-dos');
  });

  it('apparie le swing avec son tirage léger, ou le laisse seul en tête — jamais avec les jambes', () => {
    const jeudi = apparier([SWING_DU_JEUDI, 'side-lunge', 'reverse-fly', 'fire-hydrant', 'leg-extension-machine', 'leg-curl-machine']);
    expect(jeudi.exercices[0]).toBe(SWING_DU_JEUDI);
    expect(jeudi.paires).toEqual([
      [SWING_DU_JEUDI, 'reverse-fly'],
      ['side-lunge', 'fire-hydrant'],
      ['leg-extension-machine', 'leg-curl-machine'],
    ]);
    // Le tirage léger reste avec le swing, même quand une fente pourrait le prendre.
    expect(apparier([SWING_DU_JEUDI, 'side-lunge', 'hamstring-curl', 'reverse-fly']).paires).toEqual([
      [SWING_DU_JEUDI, 'reverse-fly'],
      ['side-lunge', 'hamstring-curl'],
    ]);
    // Sans tirage léger, il reste seul, en tête.
    expect(apparier([SWING_DU_JEUDI, 'side-lunge', 'hamstring-curl'])).toEqual({
      exercices: [SWING_DU_JEUDI, 'side-lunge', 'hamstring-curl'],
      paires: [['side-lunge', 'hamstring-curl']],
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

  it('se sépare et se reforme — la trap bar reste en tête —, puis retrouve les paires automatiques', () => {
    const [barre, partenaire, troisieme] = lundi.exercices;
    expect(pairesAutomatiques(lundi)).toBe(true);
    const separee = delierDansProgramme(p, 'lundi-a', barre);
    expect(seanceNommee(separee, 'lundi-a').liens).toHaveLength(3);
    expect(seanceNommee(separee, 'lundi-a').exercices).toEqual(lundi.exercices);
    // Séparée, la trap bar se fait seule, chacun son tour : plus long à deux.
    expect(dureeSec(seanceNommee(separee, 'lundi-a'))).toBeGreaterThan(dureeSec(lundi));

    // Une autre paire : la trap bar avec le troisième, une fois séparé du sien.
    const libre = delierDansProgramme(separee, 'lundi-a', troisieme);
    const autrePaire = seanceNommee(lierDansProgramme(libre, 'lundi-a', troisieme, barre), 'lundi-a');
    expect(autrePaire.exercices.slice(0, 2)).toEqual([barre, troisieme]);
    expect(autrePaire.exercices.slice().sort()).toEqual(lundi.exercices.slice().sort());
    expect(autrePaire.liens).toContainEqual([barre, troisieme]);
    expect(autrePaire.exercices).toContain(partenaire);
    const blocs = seancePourPersonne(autrePaire, PARAMETRES, SEUL_SEB, LUNDI).blocs;
    expect(blocs.slice(0, 2).map((b) => [b.superset, b.transitionSec, b.reposSec])).toEqual([
      [0, TRANSITION_LIEN_SEC, REPOS_TRAP_BAR_SEC],
      [0, TRANSITION_LIEN_SEC, REPOS_TRAP_BAR_SEC],
    ]);

    // « Refaire les paires » remet celles du début.
    const retouche = { ...libre, seances: libre.seances.map((s) => (s.id === 'lundi-a' ? autrePaire : s)) };
    expect(pairesAutomatiques(autrePaire)).toBe(false);
    expect(seanceNommee(refairePaires(retouche, 'lundi-a'), 'lundi-a')).toEqual(lundi);
    // Les autres séances ne bougent pas.
    expect(refairePaires(retouche, 'lundi-a').seances.filter((s) => s.id !== 'lundi-a')).toEqual(
      p.seances.filter((s) => s.id !== 'lundi-a'),
    );
  });

  it('ne met pas en paire un exercice déjà pris, ni la finale', () => {
    const [a, , c] = lundi.exercices;
    expect(lierDansProgramme(p, 'lundi-a', a, c)).toEqual(p);
    const libre = delierDansProgramme(p, 'lundi-a', a);
    expect(lierDansProgramme(libre, 'lundi-a', a, lundi.finale!)).toEqual(libre);
    expect(lierDansProgramme(libre, 'lundi-a', a, a)).toEqual(libre);
    // Tout séparé : plus aucune paire.
    const toutSepare = lundi.exercices.reduce((prog, id) => delierDansProgramme(prog, 'lundi-a', id), p);
    expect(seanceNommee(toutSepare, 'lundi-a').liens).toBeUndefined();
  });

  it('voyage avec le programme, et se perd si les deux ne se suivent plus', () => {
    const [a, b, c] = lundi.exercices;
    const autre = lierDansProgramme(delierDansProgramme(delierDansProgramme(p, 'lundi-a', a), 'lundi-a', c), 'lundi-a', c, a);
    expect(programmeDansLien(new URL(lienDePartage(autre, 'https://sgtraining.netlify.app/')).hash)).toEqual(autre);
    // Deux exercices qui ne se suivent plus ne sont plus en paire.
    const ecartes = {
      ...p,
      seances: p.seances.map((s) => (s.id === 'lundi-a' ? { ...s, liens: [[a, s.exercices[3]]] } : s)),
    };
    expect(seanceNommee(validerProgramme(ecartes)!, 'lundi-a').liens).toBeUndefined();
    // Trois exercices ne font pas une paire.
    const trio = { ...p, seances: p.seances.map((s) => (s.id === 'lundi-a' ? { ...s, liens: [[a, b, c]] } : s)) };
    expect(seanceNommee(validerProgramme(trio)!, 'lundi-a').liens).toBeUndefined();
    // Changer un exercice d'une paire garde la paire.
    const nouveau = alternatives(p, 'lundi-a', b)[0];
    expect(seanceNommee(remplacerDansProgramme(p, 'lundi-a', b, nouveau.id), 'lundi-a').liens?.[0]).toEqual([a, nouveau.id]);
  });
});

describe('changer un exercice', () => {
  const p = programmes[0];
  const lundi = seanceNommee(p, 'lundi-a');
  const actuel = EXERCICES_PAR_ID[lundi.exercices[0]];

  it('propose des exercices des mêmes muscles, absents de la séance', () => {
    const choix = alternatives(p, 'lundi-a', actuel.id);
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

  it('remplace le dernier exercice par une autre fin pour les jambes', () => {
    const fin = lundi.finale!;
    const choix = alternatives(p, 'lundi-a', fin);
    expect(choix.length).toBeGreaterThan(1);
    expect(choix.every((e) => ['leg-press', 'hack-squat', 'traineau', 'farmers-walk', 'kb-farmers-walk'].includes(e.id))).toBe(true);
    const marche = choix.find((e) => e.materiel !== 'salle')!;
    const modifie = seanceNommee(remplacerDansProgramme(p, 'lundi-a', fin, marche.id), 'lundi-a');
    expect(modifie.finale).toBe(marche.id);
    // Une marche du fermier se fait côte à côte : plus « chacun son tour ».
    expect(modifie.tour).toEqual(['trap-bar-deadlift']);
  });

  it('remplace l’exercice dans cette séance seulement', () => {
    const nouveau = alternatives(p, 'lundi-a', actuel.id)[0];
    const modifie = remplacerDansProgramme(p, 'lundi-a', actuel.id, nouveau.id);
    expect(seanceNommee(modifie, 'lundi-a').exercices[0]).toBe(nouveau.id);
    expect(modifie.seances.filter((s) => s.id !== 'lundi-a')).toEqual(p.seances.filter((s) => s.id !== 'lundi-a'));
    expect(seanceNommee(p, 'lundi-a').exercices[0]).toBe(actuel.id);
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

  it('rend au programme les fentes, les exercices sur une jambe, le good morning et les rowings sans appui', () => {
    expect(EXERCICES_MIS_DE_COTE).toEqual([]);
    // La montée sur marche et la fente arrière surélevée demandent une marche :
    // on la compte, pour voir que rien d'autre ne les écarte.
    const candidats = new Set(candidatsProgramme([...MATERIELS_PROGRAMME, 'step']).map((e) => e.id));
    for (const id of RENDUS) {
      expect(EXERCICES_PAR_ID[id], id).toBeDefined();
      expect(candidats.has(id), id).toBe(true);
    }
    // Les fentes reviennent vraiment dans les séances : le jeudi, une fente
    // latérale pour l'intérieur de cuisse.
    const composes = new Set(programmes.flatMap((p) => p.seances.flatMap((s) => s.exercices)));
    expect(RENDUS.filter((id) => composes.has(id)).length).toBeGreaterThanOrEqual(2);
    // « Changer » les propose aussi.
    const jeudi = seanceNommee(programmes[0], 'jeudi-a');
    const fente = jeudi.exercices.find((id) => EXERCICES_PAR_ID[id].pattern === 'fente')!;
    const choix = alternatives(programmes[0], 'jeudi-a', fente, 200).map((e) => e.id);
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
      'exterieur-cuisse': { muscles: ['abducteurs'], seances: LES_JEUDIS },
      'interieur-cuisse': { muscles: ['adducteurs'], seances: LES_JEUDIS },
      bras: { muscles: ['biceps', 'triceps'], seances: LES_MARDIS },
      tronc: { muscles: ['abdominaux', 'obliques'], seances: [...LES_LUNDIS, ...LES_JEUDIS] },
      jambes: { muscles: ['quadriceps', 'ischios'], seances: [...LES_LUNDIS, ...LES_JEUDIS] },
      'haut-du-dos': { muscles: ['dorsaux', 'trapezes'], seances: [...LES_LUNDIS, ...LES_MARDIS] },
    };
    for (const nombre of NOMBRES_EXERCICES) {
      // Un objectif seul, ou ceux d'usage. Les huit ensemble ne tiennent pas dans
      // quatre exercices : ce cas-là est écarté.
      for (const objectifs of [undefined, ...TOUS_LES_OBJECTIFS.map((id) => [id])]) {
        for (const graine of GRAINES.slice(0, 4)) {
          const programme = programmeCompose(nombre, objectifs, graine);
          for (const s of programme.seances) {
            const cas = `${nombre} · ${objectifs ?? 'défaut'} · graine ${graine} · ${s.id}`;
            expect(s.exercices, cas).toHaveLength(voulus(nombre, s));
            expect(s.liens, cas).toHaveLength(voulus(nombre, s) / 2);
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

  it('le Superman, le bas du dos du lundi, revient en semaine B ; le mardi ne reprend rien', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const graine of GRAINES.slice(0, 8)) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const id of LES_LUNDIS) expect(seanceNommee(programme, id).exercices, `${nombre} · ${graine} · ${id}`).toContain('kb-superman');
        const [mardiA, mardiB] = LES_MARDIS.map((id) => seanceNommee(programme, id).exercices.map((x) => cleMouvement(EXERCICES_PAR_ID[x])));
        expect(mardiB.filter((x) => mardiA.includes(x))).toEqual([]);
      }
    }
    // Le good morning, lui aussi pour le bas du dos, est de retour — mais le
    // lundi, après la trap bar, on garde le Superman, allongé.
    const directs = candidatsProgramme(MATERIELS_PROGRAMME).filter((e) => (e.musclesPrincipaux ?? []).includes('lombaires'));
    expect(directs.map((e) => e.id).sort()).toEqual(['kb-good-morning', 'kb-superman']);
    for (const p of programmes) for (const id of LES_LUNDIS) expect(seanceNommee(p, id).exercices).not.toContain('kb-good-morning');
  });

  it('forme des paires intérieur ↔ extérieur de cuisse tous les jeudis', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const graine of GRAINES.slice(0, 8)) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const id of LES_JEUDIS) {
          const raisons = pairesDe(seanceNommee(programme, id)).map(([a, b]) => accordPaire(a, b).raison);
          expect(raisons, `${nombre} · ${graine} · ${id}`).toContain('intérieur ↔ extérieur de cuisse');
        }
      }
    }
  });
});

describe('les machines des cuisses, le jeudi', () => {
  it('chaque jeudi, semaines A et B, l’extension et la flexion des jambes vont en paire, juste après les objectifs', () => {
    for (const nombre of [6, 8]) {
      for (const graine of GRAINES) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const id of LES_JEUDIS) {
          const jeudi = seanceNommee(programme, id);
          const cas = `${nombre} · ${graine} · ${id}`;
          const g = (jeudi.liens ?? []).findIndex((l) => l.includes('leg-extension-machine'));
          expect(jeudi.liens?.[g], cas).toEqual(MACHINES_DU_JEUDI);
          expect(accordPaire(EXERCICES_PAR_ID['leg-extension-machine'], EXERCICES_PAR_ID['leg-curl-machine']).raison).toBe('quadriceps ↔ ischios');
          // Pas reléguées à la fin : à six, la troisième paire, juste après celle
          // du swing et celle des objectifs (intérieur et extérieur de cuisse).
          if (nombre === 6) expect(g, cas).toBe(2);
          const objectifs = ['abducteurs', 'adducteurs'];
          for (const avant of pairesDe(jeudi).slice(1, g)) {
            expect(avant.some((e) => (e.musclesPrincipaux ?? []).some((m) => objectifs.includes(m))), `${cas} · ${avant.map((e) => e.id)}`).toBe(true);
          }
          // Une machine pour deux : chacun son tour, et une minute de pause
          // après la paire, deux petits muscles.
          expect(jeudi.tour, cas).toEqual(expect.arrayContaining(MACHINES_DU_JEUDI));
          expect(reposDePaire(MACHINES_DU_JEUDI, jeudi)).toBe(REPOS_PETITS_SEC);
          // Elles ne sont plus le lundi.
          expect(seanceNommee(programme, 'lundi-a').exercices.filter((x) => MACHINES_DU_JEUDI.includes(x)), cas).toEqual([]);
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

  it('à quatre exercices, les objectifs prennent toute la place ; sans objectif, les machines suivent le swing', () => {
    for (const graine of GRAINES.slice(0, 8)) {
      for (const id of LES_JEUDIS) {
        const court = seanceNommee(programmeCompose(4, undefined, graine), id);
        expect(court.exercices.filter((x) => MACHINES_DU_JEUDI.includes(x))).toEqual([]);
        const libre = seanceNommee(programmeCompose(4, [], graine), id);
        expect(libre.exercices[0]).toBe(SWING_DU_JEUDI);
        expect(libre.liens?.[1]).toEqual(MACHINES_DU_JEUDI);
      }
    }
  });

  it('sans les machines, ces places prennent l’extension et le leg curl aux haltères ; sans kettlebell, pas de swing', () => {
    const sansMachine = genererProgramme({ graine: 1, aujourdhui: LUNDI, materiels: ['halteres', 'kettlebell', 'banc', 'tapis'] });
    for (const s of sansMachine.seances) {
      expect(exercicesDe(s).filter((e) => e.materiel === 'salle')).toEqual([]);
      expect(s.tour).toBeUndefined();
      // La marche du fermier pour finir, faute de presse ou de traîneau.
      expect(['farmers-walk', 'kb-farmers-walk']).toContain(s.finale);
    }
    for (const id of LES_JEUDIS) expect(seanceNommee(sansMachine, id).exercices[0]).toBe(SWING_DU_JEUDI);
    expect(seanceNommee(sansMachine, 'jeudi-a').exercices).toEqual(expect.arrayContaining(['leg-extension', 'hamstring-curl']));
    const sansKettlebell = genererProgramme({ graine: 1, aujourdhui: LUNDI, materiels: ['halteres', 'banc', 'tapis', 'salle'] });
    for (const s of sansKettlebell.seances) {
      expect(s.exercices).not.toContain(SWING_DU_JEUDI);
      expect(s.liens, s.id).toHaveLength(s.exercices.length / 2);
    }
  });

  it('deux machines différentes en paire se croisent aussi : la paire ne se défait pas pour aller avec des exercices libres', () => {
    // Séparées, chacune avec un exercice libre, elles feraient deux paires
    // « machine + libre » ; ensemble, elles restent ensemble.
    const { paires } = apparier(['goblet-squat', 'leg-extension-machine', 'hamstring-curl', 'leg-curl-machine']);
    expect(paires).toEqual([['goblet-squat', 'hamstring-curl'], ['leg-extension-machine', 'leg-curl-machine']]);
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
    'kb-wall-squat-press', 'kb-lunge-press', 'kb-rotating-side-lunge-press', 'leg-extension-machine',
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
      // L'extension des jambes à la machine tient jambes tendues : son arrêt
      // passe en haut, jamais genoux pliés.
      if (id === 'leg-extension-machine') {
        expect(e.pauseEnHaut, id).toBe(true);
        expect(tempoPourExercice(e, tempoAvecPause), id).toEqual({ ...tempoAvecPause, pauseEnHaut: true });
        expect(secondesParRep(tempoAvecPause, e), id).toBe(8);
        continue;
      }
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

  it('reste un lien qu’on peut envoyer par texto, même à six séances', () => {
    // Les paires et chacun son tour par leur place, sans ce qui va de soi :
    // moins de 3 000 caractères pour six séances (2 500 pour cinq, avant).
    // Les messageries le prennent tel quel.
    for (const programme of programmes) {
      expect(lienDePartage(programme, 'https://sgtraining.netlify.app/').length).toBeLessThan(3000);
    }
    const code = new URL(lienDePartage(p, 'https://sgtraining.netlify.app/')).hash;
    const brut = JSON.parse(depuisCode(code.replace('#programme=', '')));
    const lundi = brut.seances.find((x: { id: string }) => x.id === 'lundi-a');
    expect(lundi.tour).toEqual([0, lundi.exercices.length]);
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
    expect(seanceNommee(recompose, 'lundi-a').exercices[0]).toBe('trap-bar-deadlift');
    expect(recompose.seances).toHaveLength(6);
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
    expect(recompose.seances.map((s) => s.id)).toEqual(['lundi-a', 'mardi-a', 'jeudi-a', 'lundi-b', 'mardi-b', 'jeudi-b']);
    expect(seanceNommee(recompose, 'lundi-a').partie).toBe('complet');
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
      expect(s.liens).toHaveLength(s.jour === 1 ? 4 : 3);
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
        { id: 'lundi-a', nom: 'Lundi A — bas du corps', jour: 1, semaine: 'A', type: 'facile', partie: 'bas', format: 'series', exercices: ['kb-superman', 'kb-x-crunch', 'leg-extension-machine', 'leg-curl-machine'], finale: 'traineau', liens: [['kb-superman', 'kb-x-crunch'], ['leg-extension-machine', 'leg-curl-machine']], tour: ['leg-extension-machine', 'leg-curl-machine', 'traineau'] },
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
    expect(telephoneSeb.seances.map((s) => s.id)).toEqual(['lundi-a', 'mardi-a', 'jeudi-a', 'lundi-b', 'mardi-b', 'jeudi-b']);
    // Dix exercices ne se choisissent plus : six, et huit le lundi. Les
    // répétitions choisies et l'équipe restent.
    expect(nombreExercicesDe(telephoneSeb)).toBe(6);
    expect(telephoneSeb.duo).toEqual({ reps: { sebastien: 8, max: 12 } });
    expect(telephoneSeb.equipe).toBe('p1abcdef20261005');
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
