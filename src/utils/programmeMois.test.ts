import { describe, expect, it } from 'vitest';
import type { Exercice, ParametresSeance, ProgrammeMois, SeanceDuMois, SeanceRealisee } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT, TEMPOS } from '../data/parametres';
import { construireEtapes, dureeTotaleSec, etatMetronome } from './etapesSeance';
import { cleMouvement, exercicesDisponibles, secondesParRep, tempoPourExercice } from './generateurSeance';
import { OBJECTIFS_MUSCULAIRES } from './muscles';
import {
  DUREE_MAXI_SEC,
  EXERCICES_MIS_DE_COTE,
  EXERCICES_PAR_DEFAUT,
  MATERIELS_PROGRAMME,
  NOMBRES_EXERCICES,
  REPOS_PETITS_SEC,
  REPOS_SEC,
  REPOS_TRAP_BAR_SEC,
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
  chargeLegere,
  chargeProposee,
  chargesPassees,
  decoderProgramme,
  delierDansProgramme,
  dureeSec,
  equipeDe,
  estPoussee,
  estRetouche,
  estSemaineDure,
  echauffementDe,
  etirementsDe,
  etirementsPauseDe,
  exercicesAAugmenter,
  faiteCetteSemaine,
  genererProgramme,
  lienDePartage,
  lierDansProgramme,
  nombreExercicesDe,
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
/** Les seuls exercices directs du bas du dos (le Superman au kettlebell), de
 *  l'extérieur de cuisse et de l'intérieur de cuisse : la semaine B du lundi
 *  peut les reprendre. */
const DIRECTS_DU_LUNDI = ['kb-superman', 'fire-hydrant', 'kb-side-leg-raise', 'sumo-squat', 'kb-rotating-side-lunge-press'];
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
  it('compose lundi le bas, mardi le haut, en semaines A et B, et le jeudi de référence', () => {
    expect(programmes[0].seances.map((s) => [s.id, s.jour, s.semaine, s.type, s.partie, s.format])).toEqual([
      ['lundi-a', 1, 'A', 'facile', 'bas', 'series'],
      ['mardi-a', 2, 'A', 'facile', 'haut', 'series'],
      ['jeudi', 4, undefined, 'dure', 'complet', 'series'],
      ['lundi-b', 1, 'B', 'facile', 'bas', 'series'],
      ['mardi-b', 2, 'B', 'facile', 'haut', 'series'],
    ]);
  });

  it('tous les jours, des paires d’exercices opposés ; la finale seule, à la fin', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        // Trois paires, côte à côte, et rien d'autre.
        expect(s.liens, `${p.graine} · ${s.id}`).toHaveLength(3);
        expect(s.liens!.flat()).toEqual(s.exercices);
        for (const [a, b] of pairesDe(s)) {
          expect(accordPaire(a, b).accord, `${p.graine} · ${s.id} · ${a.id} + ${b.id}`).toBe('bon');
        }
        // La finale n'est dans aucune paire.
        expect(s.liens!.flat()).not.toContain(s.finale);
        // La séance guidée les déroule ainsi : chaque paire est un groupe, la
        // finale vient seule après.
        const blocs = seancePourPersonne(s, PARAMETRES, DUO_MAX, LUNDI).blocs;
        expect(blocs.map((b) => b.superset)).toEqual([0, 0, 1, 1, 2, 2, undefined]);
        expect(blocs.at(-1)?.exerciceId).toBe(s.finale);
      }
    }
  });

  it('sans alternance, lundi et mardi reviennent chaque semaine', () => {
    const p = genererProgramme({ graine: 1, aujourdhui: LUNDI, alternance: false });
    expect(p.seances.map((s) => [s.id, s.semaine])).toEqual([
      ['lundi', undefined],
      ['mardi', undefined],
      ['jeudi', undefined],
    ]);
  });

  it('la semaine B change les exercices de la semaine A — sauf les seuls à viser le bas du dos ou les cuisses', () => {
    for (const p of programmes) {
      for (const [a, b] of [
        ['lundi-a', 'lundi-b'],
        ['mardi-a', 'mardi-b'],
      ]) {
        const deA = new Set(exercicesDe(seanceNommee(p, a)).map(cleMouvement));
        const repris = exercicesDe(seanceNommee(p, b)).filter((e) => deA.has(cleMouvement(e)));
        // Le mardi, rien n'est repris. Le lundi, seuls reviennent les exercices
        // directs du bas du dos et de l'intérieur ou l'extérieur de cuisse : il
        // n'en reste qu'un ou deux de chaque.
        expect(repris.filter((e) => b.startsWith('mardi') || !DIRECTS_DU_LUNDI.includes(e.id)), `${p.graine} · ${b}`).toEqual([]);
        expect(repris.length, `${p.graine} · ${b}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('un même mouvement ne revient pas deux fois dans une séance', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        const cles = exercicesDe(s).map(cleMouvement);
        expect(new Set(cles).size).toBe(cles.length);
      }
    }
  });

  it('vise les faiblesses : bas du dos et épaules le jeudi, cuisses le lundi, épaules le mardi', () => {
    for (const p of programmes) {
      const jeudi = seanceNommee(p, 'jeudi');
      expect(vise(jeudi, 'lombaires')).toBe(true);
      expect(vise(jeudi, 'epaules')).toBe(true);
      for (const id of ['lundi-a', 'lundi-b']) {
        const lundi = seanceNommee(p, id);
        expect(vise(lundi, 'lombaires')).toBe(true);
        expect(vise(lundi, 'abducteurs')).toBe(true);
        expect(vise(lundi, 'adducteurs')).toBe(true);
      }
      for (const id of ['mardi-a', 'mardi-b']) expect(vise(seanceNommee(p, id), 'epaules')).toBe(true);
    }
  });

  it('le jeudi s’ouvre sur la trap bar, tire sans charger le bas du dos, et finit les jambes à la machine', () => {
    for (const p of programmes) {
      const seance = seanceNommee(p, 'jeudi');
      const jeudi = exercicesDe(seance);
      expect(jeudi[0].id).toBe('trap-bar-deadlift');
      const tirages = jeudi.filter((e) => e.pattern === 'tirage-horizontal' || e.pattern === 'tirage-vertical');
      expect(tirages.length).toBeGreaterThan(0);
      expect(tirages.filter(chargeLeBasDuDos)).toEqual([]);
      // Une seule charnière lourde : le bas du dos se travaille à part.
      const charnieres = jeudi.filter((e) => e.pattern === 'charniere' && (e.musclesPrincipaux ?? []).includes('ischios'));
      expect(charnieres.map((e) => e.id)).toEqual(['trap-bar-deadlift']);
      expect(['leg-press', 'hack-squat']).toContain(seance.finale);
      // Une machine pour deux : chacun son tour, d'office.
      expect(seance.tour).toEqual(['trap-bar-deadlift', seance.finale]);
    }
  });

  it('le mardi, jour du haut du corps et du jiu-jitsu, tire sans charger le bas du dos', () => {
    for (const p of programmes) {
      for (const id of ['mardi-a', 'mardi-b']) {
        const tirages = exercicesDe(seanceNommee(p, id)).filter((e) => e.pattern.startsWith('tirage'));
        expect(tirages.filter(chargeLeBasDuDos), `${p.graine} · ${id}`).toEqual([]);
      }
    }
  });

  it('finit par les jambes le lundi et le jeudi, par la marche du fermier le mardi, jamais par la trap bar', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        const attendues =
          s.partie === 'haut'
            ? ['farmers-walk', 'kb-farmers-walk']
            : s.type === 'dure'
              ? ['leg-press', 'hack-squat']
              : ['traineau', 'leg-press', 'hack-squat', 'farmers-walk', 'kb-farmers-walk'];
        expect(attendues).toContain(s.finale);
        expect(s.exercices).not.toContain(s.finale);
        expect(s.exercices.slice(1)).not.toContain('trap-bar-deadlift');
        const surMachine = [...s.exercices, s.finale!].filter((id) => EXERCICES_PAR_ID[id].materiel === 'salle');
        expect(s.tour ?? []).toEqual(surMachine);
      }
      // D'une séance à l'autre, la fin change.
      expect(new Set(p.seances.map((s) => cleMouvement(EXERCICES_PAR_ID[s.finale!]))).size).toBeGreaterThanOrEqual(2);
      // Le lundi et le mardi, les machines attendent la fin de la séance.
      for (const s of p.seances.filter((x) => x.type === 'facile')) {
        expect(exercicesDe(s).filter((e) => e.materiel === 'salle')).toEqual([]);
      }
    }
  });

  it('jamais deux exercices qui chargent le bas du dos dans une paire, quels que soient les objectifs et le nombre', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const objectifs of JEUX_OBJECTIFS) {
        for (const graine of GRAINES.slice(0, 8)) {
          const p = programmeCompose(nombre, objectifs, graine);
          for (const s of p.seances) {
            const cas = `${nombre} · ${objectifs} · graine ${graine} · ${s.id}`;
            // Le nombre choisi, tout en paires.
            expect(s.exercices, cas).toHaveLength(nombre);
            expect(s.liens, cas).toHaveLength(nombre / 2);
            for (const [a, b] of pairesDe(s)) {
              expect(chargeLeBasDuDos(a) && chargeLeBasDuDos(b), `${cas} · ${a.id} + ${b.id}`).toBe(false);
              expect(accordPaire(a, b).accord, `${cas} · ${a.id} + ${b.id}`).toBe('bon');
            }
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
    // Le jeudi, la trap bar va avec le haut du corps ; le lundi, l'intérieur
    // et l'extérieur de cuisse, objectifs tous les deux, vont ensemble.
    for (const p of programmes) {
      const [trapBar] = pairesDe(seanceNommee(p, 'jeudi'));
      expect(trapBar[0].id).toBe('trap-bar-deadlift');
      expect(accordPaire(...trapBar).raison).toBe('haut ↔ bas');
      expect(pairesDe(seanceNommee(p, 'lundi-a')).map(([a, b]) => accordPaire(a, b).raison)).toContain(
        'intérieur ↔ extérieur de cuisse',
      );
    }
  });

  it('par défaut, six exercices — trois paires — et la finale, au tempo 3 s / 3 s + 1 s en bas : un peu plus d’une heure à deux', () => {
    expect(EXERCICES_PAR_DEFAUT).toBe(6);
    expect(TEMPO_PROGRAMME).toEqual({ monteeSec: 3, descenteSec: 3, pauseSec: 1 });
    const durees: number[] = [];
    for (const p of programmes) {
      expect(nombreExercicesDe(p)).toBe(6);
      expect(tempoDuProgramme(p)).toEqual(TEMPO_PROGRAMME);
      for (const s of p.seances) {
        expect(s.exercices).toHaveLength(6);
        expect(s.finale).toBeDefined();
        const seance = seancePourPersonne(s, PARAMETRES, { ...DUO_SEB, tempo: tempoDuProgramme(p) }, LUNDI);
        expect(seance.parametres.tempo).toEqual(TEMPO_PROGRAMME);
        expect(seance.blocs).toHaveLength(7);
        durees.push(seance.dureeEstimeeSec / 60);
      }
    }
    // Échauffement, trois paires avec leur pause (une minute, une minute trente
    // ou deux), la finale et les étirements : un peu plus d'une heure à deux.
    expect(Math.min(...durees)).toBeGreaterThan(55);
    expect(Math.max(...durees)).toBeLessThan(78);
    const moyenne = durees.reduce((somme, d) => somme + d, 0) / durees.length;
    expect(moyenne).toBeGreaterThan(62);
    expect(moyenne).toBeLessThan(71);
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

  it('ne prend que de la musculation sans élan, à la portée du matériel de la salle', () => {
    const possedes = new Set<string>(['aucun', ...MATERIELS_PROGRAMME]);
    for (const p of programmes) {
      for (const e of p.seances.flatMap(exercicesDe)) {
        expect(e.explosif ?? false).toBe(false);
        expect(e.niveauMin).toBeLessThanOrEqual(2);
        expect(possedes.has(e.materiel)).toBe(true);
        expect(e.unite === 'reps' || e.unite === 'secondes').toBe(true);
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
      for (const id of ['mardi-a', 'mardi-b']) {
        expect(vise(seanceNommee(p, id), 'biceps') || vise(seanceNommee(p, id), 'triceps')).toBe(true);
      }
      const sansObjectif = genererProgramme({ graine, aujourdhui: LUNDI, objectifs: [] });
      expect(sansObjectif.seances.every((s) => s.exercices.length >= 3 && s.finale !== undefined)).toBe(true);
    }
  });
});

describe('les réglages du programme : le nombre d’exercices et le tempo', () => {
  const p = programmes[2];

  it('changent le nombre d’exercices et la durée, pareil sur les deux téléphones', () => {
    let precedente = 0;
    for (const nombre of NOMBRES_EXERCICES) {
      const regle = avecNombreExercices(p, nombre);
      expect(nombreExercicesDe(regle)).toBe(nombre);
      // Même graine, même premier lundi, même équipe : l'autre téléphone
      // recompose le même programme.
      expect([regle.graine, regle.debut, equipeDe(regle)]).toEqual([p.graine, p.debut, equipeDe(p)]);
      expect(avecNombreExercices(JSON.parse(JSON.stringify(p)), nombre)).toEqual(regle);
      for (const s of regle.seances) {
        expect(s.exercices).toHaveLength(nombre);
        expect(s.liens).toHaveLength(nombre / 2);
        expect(s.finale).toBeDefined();
      }
      // Le jeudi garde la trap bar en tête, et dure plus à chaque paire.
      const jeudi = seanceNommee(regle, 'jeudi');
      expect(jeudi.exercices[0]).toBe('trap-bar-deadlift');
      expect(dureeSec(jeudi)).toBeGreaterThan(precedente);
      precedente = dureeSec(jeudi);
    }
    // Revenir à six : le programme du début.
    expect(avecNombreExercices(avecNombreExercices(p, 10), 6).seances).toEqual(p.seances);
  });

  it('les objectifs passent d’abord : à quatre exercices, ils y sont encore', () => {
    for (const programme of programmes.slice(0, 10)) {
      const court = avecNombreExercices(programme, 4);
      const jeudi = seanceNommee(court, 'jeudi');
      expect(jeudi.exercices[0]).toBe('trap-bar-deadlift');
      expect(vise(jeudi, 'lombaires') && vise(jeudi, 'epaules')).toBe(true);
      for (const id of ['lundi-a', 'lundi-b']) {
        const lundi = seanceNommee(court, id);
        expect(['lombaires', 'abducteurs', 'adducteurs'].every((muscle) => vise(lundi, muscle))).toBe(true);
      }
      for (const id of ['mardi-a', 'mardi-b']) expect(vise(seanceNommee(court, id), 'epaules')).toBe(true);
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
    expect(refait.seances.every((s) => s.exercices.length === 8)).toBe(true);
    expect(estRetouche(regle)).toBe(false);
    expect(estRetouche(JSON.parse(JSON.stringify(regle)))).toBe(false);
    expect(estRetouche(basculerTour(regle, 'jeudi', seanceNommee(regle, 'jeudi').exercices[2]))).toBe(true);
    expect(estRetouche(delierDansProgramme(regle, 'lundi-a', seanceNommee(regle, 'lundi-a').exercices[0]))).toBe(true);
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

  it('trouve la séance du jour, ou la prochaine', () => {
    const cas: [number, string, number][] = [
      [0, 'lundi-a', 0],
      [1, 'mardi-a', 0],
      [2, 'jeudi', 1], // mercredi
      [3, 'jeudi', 0],
      [4, 'lundi-b', 3], // vendredi
      [-2, 'lundi-a', 2], // samedi d'avant le début
      [8, 'mardi-b', 0],
      [10, 'jeudi', 0],
      [15, 'mardi-a', 0],
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
    expect(faiteCetteSemaine(historique, seanceNommee(p, 'jeudi'), jour(3))).toBe(false);
  });

  it('trouve la prochaine date d’une séance', () => {
    expect(prochaineDate(p, seanceNommee(p, 'jeudi'), jour(0))).toEqual(new Date(2026, 9, 8));
    expect(prochaineDate(p, seanceNommee(p, 'jeudi'), jour(3, 18))).toEqual(new Date(2026, 9, 8));
    expect(prochaineDate(p, seanceNommee(p, 'lundi-b'), jour(0))).toEqual(new Date(2026, 9, 12));
  });

  it('la semaine dure : le jeudi des semaines B seulement', () => {
    const jeudi = seanceNommee(p, 'jeudi');
    expect(estSemaineDure(p, jeudi, jour(3))).toBe(false);
    expect(estSemaineDure(p, jeudi, jour(10))).toBe(true);
    expect(estSemaineDure(p, jeudi, jour(17))).toBe(false);
    expect(estSemaineDure(p, seanceNommee(p, 'lundi-b'), jour(7))).toBe(false);
  });

  it('après une semaine dure réussie, propose un cran de plus le jeudi suivant', () => {
    const jeudi = seanceNommee(p, 'jeudi');
    const fait = (seriesFaites: number, poids?: number) => ({
      exerciceId: 'trap-bar-deadlift',
      seriesPrevues: 3,
      seriesFaites,
      reps: 10,
      dureeSec: 600,
      ...(poids ? { poids } : {}),
    });
    const dure = realisee(jeudi.nom, jour(10, 9), [
      fait(3, 135),
      { ...fait(2, 50), exerciceId: 'arnold-press' },
      { ...fait(3), exerciceId: 'kb-superman' },
    ]);
    // Toutes les séries faites, avec une charge : la trap bar seulement.
    expect(exercicesAAugmenter([dure], p, jeudi, jour(17))).toEqual(['trap-bar-deadlift']);
    // Pas pendant la semaine dure, ni après un jeudi normal, ni les autres jours.
    expect(exercicesAAugmenter([dure], p, jeudi, jour(24))).toEqual([]);
    const normal = realisee(jeudi.nom, jour(17, 9), [fait(3, 140)]);
    expect(exercicesAAugmenter([normal, dure], p, jeudi, jour(31))).toEqual([]);
    expect(exercicesAAugmenter([dure], p, seanceNommee(p, 'lundi-a'), jour(14))).toEqual([]);
  });
});

describe('la séance de chacun', () => {
  const p = programmes[0];
  const jeudi = seanceNommee(p, 'jeudi');
  const lundi = seanceNommee(p, 'lundi-a');
  const mardi = seanceNommee(p, 'mardi-a');
  const exercice = (id: string) => EXERCICES_PAR_ID[id];

  it('déroule chaque jour par paires : à la suite, puis la pause de la paire ; la finale seule', () => {
    const reference = seancePourPersonne(jeudi, PARAMETRES, SEUL_SEB, LUNDI);
    expect(reference.titre).toBe(jeudi.nom);
    expect(reference.blocs.map((b) => b.exerciceId)).toEqual([...jeudi.exercices, jeudi.finale]);
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
        expect(bloc.reps).toBe(exercice(bloc.exerciceId).unite === 'secondes' ? 30 : 8);
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
    const lent = seancePourPersonne(jeudi, PARAMETRES, { ...DUO_SEB, tempo: TEMPO_PROGRAMME }, LUNDI);
    const rapide = seancePourPersonne(jeudi, PARAMETRES, { ...DUO_SEB, tempo: { monteeSec: 2, descenteSec: 4 } }, LUNDI);
    expect(lent.parametres.tempo).toEqual(TEMPO_PROGRAMME);
    expect(rapide.dureeEstimeeSec).toBeLessThan(lent.dureeEstimeeSec);
    expect(seancePourPersonne(jeudi, PARAMETRES, DUO_SEB, LUNDI).parametres.tempo).toEqual(PARAMETRES.tempo);
  });

  it('Max fait deux répétitions de plus, et une série de plus aux poussées', () => {
    for (const s of p.seances) {
      const seb = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      const max = seancePourPersonne(s, PARAMETRES, SEUL_MAX, LUNDI);
      max.blocs.forEach((bloc, i) => {
        const e = exercice(bloc.exerciceId);
        if (bloc.exerciceId === s.finale) return;
        expect(bloc.series).toBe(estPoussee(e) ? 4 : 3);
        expect(seb.blocs[i].series).toBe(3);
        if (e.unite === 'reps') expect([seb.blocs[i].reps, bloc.reps]).toEqual([8, 10]);
      });
    }
    // Le mardi, le haut du corps : il y a bien des poussées.
    expect(mardi.exercices.some((id) => estPoussee(exercice(id)))).toBe(true);
    // Un oiseau tire : ce n'est pas une poussée.
    expect(estPoussee(exercice('kb-rear-fly'))).toBe(false);
    expect(estPoussee(exercice('bench-press'))).toBe(true);
  });

  it('suit les répétitions du duo envoyées avec le programme', () => {
    const reps = repsDuDuo({ duo: { reps: { sebastien: 6, max: 12 } } });
    const seance = seancePourPersonne(jeudi, PARAMETRES, { ...DUO_SEB, reps }, LUNDI);
    expect(seance.blocs[1]).toMatchObject({ reps: 6, autre: { reps: 12 } });
    expect(repsDuDuo({})).toEqual({ sebastien: 8, max: 10 });
  });

  it('le mardi, la dernière série de Sébastien se fait à la moitié de la charge', () => {
    const seb = seancePourPersonne(mardi, PARAMETRES, SEUL_SEB, LUNDI);
    for (const bloc of seb.blocs) {
      expect(bloc.derniereLegere ?? false).toBe(exercice(bloc.exerciceId).unite === 'reps');
    }
    expect(seancePourPersonne(mardi, PARAMETRES, SEUL_MAX, LUNDI).blocs.some((b) => b.derniereLegere)).toBe(false);
    for (const autre of [lundi, jeudi]) {
      expect(seancePourPersonne(autre, PARAMETRES, SEUL_SEB, LUNDI).blocs.some((b) => b.derniereLegere)).toBe(false);
    }
    expect(chargeLegere(40, 'lb')).toBe(20);
    expect(chargeLegere(35, 'lb')).toBe(15);
    expect(chargeLegere(47, 'kg')).toBe(22.5);
    expect(chargeLegere(5, 'lb')).toBe(5);
    expect(chargeLegere(0, 'lb')).toBe(0);
  });

  it('la semaine dure : deux répétitions de plus chacun, le jeudi seulement', () => {
    const dure = seancePourPersonne(jeudi, PARAMETRES, { ...DUO_SEB, semaineDure: true }, LUNDI);
    for (const bloc of dure.blocs) {
      if (exercice(bloc.exerciceId).unite !== 'reps') continue;
      expect([bloc.reps, bloc.autre?.reps]).toEqual([10, 12]);
    }
    const lundiDur = seancePourPersonne(lundi, PARAMETRES, { ...DUO_SEB, semaineDure: true }, LUNDI);
    expect(lundiDur.blocs.filter((b) => exercice(b.exerciceId).unite === 'reps').every((b) => b.reps === 8)).toBe(true);
  });

  it('après une semaine dure réussie, un cran de plus sur les exercices réussis', () => {
    const contexte = { ...SEUL_SEB, augmenter: ['trap-bar-deadlift'] };
    expect(seancePourPersonne(jeudi, PARAMETRES, contexte, LUNDI).blocs[0].ajoutCharge).toBe(5);
    const enKilos = { ...PARAMETRES, unitePoids: 'kg' as const };
    expect(seancePourPersonne(jeudi, enKilos, contexte, LUNDI).blocs[0].ajoutCharge).toBe(2.5);
    expect(seancePourPersonne(jeudi, PARAMETRES, contexte, LUNDI).blocs[1].ajoutCharge).toBeUndefined();
  });

  it('seul, hors paire, repose selon l’exercice : deux minutes à la trap bar, une minute aux petits muscles', () => {
    const sansPaires = jeudi.exercices.reduce((prog, id) => delierDansProgramme(prog, 'jeudi', id), p);
    const reference = seancePourPersonne(seanceNommee(sansPaires, 'jeudi'), PARAMETRES, SEUL_SEB, LUNDI);
    expect(reference.parametres.format).toBe('series');
    for (const bloc of reference.blocs) {
      const e = exercice(bloc.exerciceId);
      const petit = e.pattern === 'isolation' || ['anti-rotation', 'flexion-tronc', 'rotation', 'flexion-laterale'].includes(e.pattern);
      expect(bloc.superset).toBeUndefined();
      expect(bloc.reposSec).toBe(e.id === 'trap-bar-deadlift' ? 120 : petit ? 60 : 90);
    }
  });

  it('à deux, chaque exercice porte le volume de l’autre ; Max commence', () => {
    const seb = seancePourPersonne(jeudi, PARAMETRES, DUO_SEB, LUNDI);
    const max = seancePourPersonne(jeudi, PARAMETRES, DUO_MAX, LUNDI);
    seb.blocs.forEach((bloc, i) => {
      expect(bloc.autre).toEqual({ series: max.blocs[i].series, reps: max.blocs[i].reps });
      expect(max.blocs[i].autre).toEqual({ series: bloc.series, reps: bloc.reps });
    });
    expect(seb.horloge).toEqual({ personne: 'sebastien', partenaire: 'Big Max', jeCommence: false });
    expect(max.horloge).toEqual({ personne: 'max', partenaire: 'Speedy', jeCommence: true });
    // Seul : son temps à lui.
    const seul = seancePourPersonne(jeudi, PARAMETRES, SEUL_SEB, LUNDI);
    expect(seul.blocs.some((b) => b.autre)).toBe(false);
    expect(seul.horloge).toEqual({ personne: 'sebastien' });
  });

  it('à deux, les deux téléphones annoncent la même durée', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const semaineDure of [false, true]) {
          expect(dureeSec(s, {}, { ...DUO_SEB, semaineDure })).toBe(dureeSec(s, {}, { ...DUO_MAX, semaineDure }));
        }
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
      expect(seance.echauffement).toHaveLength(5);
      expect(seance.echauffementSec).toBe(300 + 4 * 45);
    }
  });

  it('finit par cinq minutes d’étirements du poster, trente secondes de chaque côté', () => {
    for (const s of programmes[0].seances) {
      const seance = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      expect(seance.retourCalmeSec).toBe(300);
      for (const etirement of seance.retourCalme ?? []) {
        expect(EXERCICES_PAR_ID[etirement.exerciceId!].famille).toBe('etirement');
        // Tous se font d'un côté : droit puis gauche, trente secondes chacun.
        expect(etirement.dureeSec).toBe(30);
        expect(etirement.nom).toMatch(/· côté (droit|gauche)$/);
      }
      expect(new Set(seance.retourCalme?.map((e) => e.exerciceId)).size).toBe(5);
      expect(seance.retourCalme).toHaveLength(10);
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

  it('s’échauffe le lundi avec un mouvement à deux jambes plutôt que des fentes ; le reste ne change pas', () => {
    const noms = (seance: Pick<SeanceDuMois, 'type' | 'jour' | 'partie'>) => echauffementDe(seance).map((m) => m.nom);
    expect(noms(lundi)).toEqual(['Tapis ou rameur', 'Rotations du bassin', 'Balancements de jambe', 'Squats à vide', 'Pont fessier']);
    expect(noms(lundi)).not.toContain('Fentes dynamiques');
    expect(noms(mardi)).toEqual(['Tapis ou rameur', 'Cercles de bras', 'Rotations du buste', 'Chat-vache', 'Pompes contre le mur']);
    expect(noms(jeudi)).toEqual(['Tapis ou rameur', 'Cercles de bras', 'Rotations du bassin', 'Squats à vide', 'Good morning à vide']);
    // Le même pour les deux, à la même durée.
    expect(seancePourPersonne(lundi, PARAMETRES, DUO_SEB, LUNDI).echauffement).toEqual(
      seancePourPersonne(lundi, PARAMETRES, DUO_MAX, LUNDI).echauffement,
    );
    expect(seancePourPersonne(lundi, PARAMETRES, SEUL_SEB, LUNDI).echauffementSec).toBe(300 + 4 * 45);
  });

  it('chacun son tour se bascule, et la durée à deux suit', () => {
    // La finale, sur machine, se fait chacun son tour ; côte à côte, elle va
    // plus vite.
    const finale = jeudi.finale!;
    const bascule = basculerTour(p, 'jeudi', finale);
    expect(seanceNommee(bascule, 'jeudi').tour).not.toContain(finale);
    expect(dureeSec(seanceNommee(bascule, 'jeudi'))).toBeLessThan(dureeSec(jeudi));
    const retour = basculerTour(bascule, 'jeudi', finale);
    expect(seanceNommee(retour, 'jeudi')).toEqual(jeudi);
    // Dans une paire, chacun son tour ne coûte rien : on se croise.
    const [, , autre] = jeudi.exercices;
    expect(dureeSec(seanceNommee(basculerTour(p, 'jeudi', autre), 'jeudi'))).toBe(dureeSec(jeudi));
  });

  it('annonce exactement la durée que la séance guidée chronométrera', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const contexte of CONTEXTES) {
          for (const semaineDure of [false, true]) {
            const seance = seancePourPersonne(s, PARAMETRES, { ...contexte, semaineDure, tempo: TEMPO_PROGRAMME }, LUNDI);
            expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
          }
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
  const jeudi = seanceNommee(p, 'jeudi');
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
    const [barre, partenaire, troisieme] = jeudi.exercices;
    expect(pairesAutomatiques(jeudi)).toBe(true);
    const separee = delierDansProgramme(p, 'jeudi', barre);
    expect(seanceNommee(separee, 'jeudi').liens).toHaveLength(2);
    expect(seanceNommee(separee, 'jeudi').exercices).toEqual(jeudi.exercices);
    // Séparée, la trap bar se fait seule, chacun son tour : plus long à deux.
    expect(dureeSec(seanceNommee(separee, 'jeudi'))).toBeGreaterThan(dureeSec(jeudi));

    // Une autre paire : la trap bar avec le troisième, une fois séparé du sien.
    const libre = delierDansProgramme(separee, 'jeudi', troisieme);
    const autrePaire = seanceNommee(lierDansProgramme(libre, 'jeudi', troisieme, barre), 'jeudi');
    expect(autrePaire.exercices.slice(0, 2)).toEqual([barre, troisieme]);
    expect(autrePaire.exercices.slice().sort()).toEqual(jeudi.exercices.slice().sort());
    expect(autrePaire.liens).toContainEqual([barre, troisieme]);
    expect(autrePaire.exercices).toContain(partenaire);
    const blocs = seancePourPersonne(autrePaire, PARAMETRES, SEUL_SEB, LUNDI).blocs;
    expect(blocs.slice(0, 2).map((b) => [b.superset, b.transitionSec, b.reposSec])).toEqual([
      [0, TRANSITION_LIEN_SEC, REPOS_TRAP_BAR_SEC],
      [0, TRANSITION_LIEN_SEC, REPOS_TRAP_BAR_SEC],
    ]);

    // « Refaire les paires » remet celles du début.
    const retouche = { ...libre, seances: libre.seances.map((s) => (s.id === 'jeudi' ? autrePaire : s)) };
    expect(pairesAutomatiques(autrePaire)).toBe(false);
    expect(seanceNommee(refairePaires(retouche, 'jeudi'), 'jeudi')).toEqual(jeudi);
    // Les autres séances ne bougent pas.
    expect(refairePaires(retouche, 'jeudi').seances.filter((s) => s.id !== 'jeudi')).toEqual(
      p.seances.filter((s) => s.id !== 'jeudi'),
    );
  });

  it('ne met pas en paire un exercice déjà pris, ni la finale', () => {
    const [a, , c] = jeudi.exercices;
    expect(lierDansProgramme(p, 'jeudi', a, c)).toEqual(p);
    const libre = delierDansProgramme(p, 'jeudi', a);
    expect(lierDansProgramme(libre, 'jeudi', a, jeudi.finale!)).toEqual(libre);
    expect(lierDansProgramme(libre, 'jeudi', a, a)).toEqual(libre);
    // Tout séparé : plus aucune paire.
    const toutSepare = jeudi.exercices.reduce((prog, id) => delierDansProgramme(prog, 'jeudi', id), p);
    expect(seanceNommee(toutSepare, 'jeudi').liens).toBeUndefined();
  });

  it('voyage avec le programme, et se perd si les deux ne se suivent plus', () => {
    const [a, b, c] = jeudi.exercices;
    const autre = lierDansProgramme(delierDansProgramme(delierDansProgramme(p, 'jeudi', a), 'jeudi', c), 'jeudi', c, a);
    expect(programmeDansLien(new URL(lienDePartage(autre, 'https://sgtraining.netlify.app/')).hash)).toEqual(autre);
    // Deux exercices qui ne se suivent plus ne sont plus en paire.
    const ecartes = {
      ...p,
      seances: p.seances.map((s) => (s.id === 'jeudi' ? { ...s, liens: [[a, s.exercices[3]]] } : s)),
    };
    expect(seanceNommee(validerProgramme(ecartes)!, 'jeudi').liens).toBeUndefined();
    // Trois exercices ne font pas une paire.
    const trio = { ...p, seances: p.seances.map((s) => (s.id === 'jeudi' ? { ...s, liens: [[a, b, c]] } : s)) };
    expect(seanceNommee(validerProgramme(trio)!, 'jeudi').liens).toBeUndefined();
    // Changer un exercice d'une paire garde la paire.
    const nouveau = alternatives(p, 'jeudi', b)[0];
    expect(seanceNommee(remplacerDansProgramme(p, 'jeudi', b, nouveau.id), 'jeudi').liens?.[0]).toEqual([a, nouveau.id]);
  });
});

describe('changer un exercice', () => {
  const p = programmes[0];
  const lundi = seanceNommee(p, 'jeudi');
  const actuel = EXERCICES_PAR_ID[lundi.exercices[0]];

  it('propose des exercices des mêmes muscles, absents de la séance', () => {
    const choix = alternatives(p, 'jeudi', actuel.id);
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
    const choix = alternatives(p, 'jeudi', fin);
    expect(choix.length).toBeGreaterThan(1);
    expect(choix.every((e) => ['leg-press', 'hack-squat', 'traineau', 'farmers-walk', 'kb-farmers-walk'].includes(e.id))).toBe(true);
    const marche = choix.find((e) => e.materiel !== 'salle')!;
    const modifie = seanceNommee(remplacerDansProgramme(p, 'jeudi', fin, marche.id), 'jeudi');
    expect(modifie.finale).toBe(marche.id);
    // Une marche du fermier se fait côte à côte : plus « chacun son tour ».
    expect(modifie.tour).toEqual(['trap-bar-deadlift']);
  });

  it('remplace l’exercice dans cette séance seulement', () => {
    const nouveau = alternatives(p, 'jeudi', actuel.id)[0];
    const modifie = remplacerDansProgramme(p, 'jeudi', actuel.id, nouveau.id);
    expect(seanceNommee(modifie, 'jeudi').exercices[0]).toBe(nouveau.id);
    expect(modifie.seances.filter((s) => s.id !== 'jeudi')).toEqual(p.seances.filter((s) => s.id !== 'jeudi'));
    expect(seanceNommee(p, 'jeudi').exercices[0]).toBe(actuel.id);
  });
});

describe('les précautions : exercices mis de côté', () => {
  /** Les fentes et les exercices sur une jambe, le good morning et les rowings
   *  buste penché sans appui. */
  const MIS_DE_COTE = [
    'reverse-lunge', 'kb-lunge', 'elevated-reverse-lunge', 'side-lunge', 'kb-side-lunge', 'curtsy-lunge', 'step-up',
    'kb-single-leg-deadlift', 'kb-low-side-step-row', 'kb-bob-and-weave', 'kb-around-the-world',
    'kb-good-morning', 'bent-over-row', 'kb-bent-over-row', 'seesaw-row',
  ];
  /** Les exercices à deux jambes qui remplissent la place « fente » du lundi. */
  const DEUX_JAMBES = ['leg-press', 'hack-squat', 'goblet-squat', 'kb-goblet-squat', 'glute-bridge', 'frog-pump'];
  const toutes = (programme: ProgrammeMois) =>
    programme.seances.flatMap((s) => [...s.exercices, ...(s.finale ? [s.finale] : [])]);

  it('met de côté une seule liste, dont chaque identifiant existe : ils restent dans la bibliothèque et la séance libre', () => {
    expect([...EXERCICES_MIS_DE_COTE].sort()).toEqual([...MIS_DE_COTE].sort());
    for (const id of [...MIS_DE_COTE, ...DEUX_JAMBES, 'incline-row', 'single-arm-row']) {
      expect(EXERCICES_PAR_ID[id], id).toBeDefined();
    }
    // La séance libre les propose encore, au niveau et avec le matériel qu'il faut.
    const libre = new Set(
      exercicesDisponibles({
        ...PARAMETRES_PAR_DEFAUT,
        niveau: 'intermediaire',
        materiels: ['halteres', 'kettlebell', 'banc', 'step'],
      }).map((e) => e.id),
    );
    expect(MIS_DE_COTE.filter((id) => !libre.has(id))).toEqual([]);
    // Le programme, lui, ne les compose plus. On garde les rowings avec appui.
    const candidats = new Set(candidatsProgramme(MATERIELS_PROGRAMME).map((e) => e.id));
    expect(MIS_DE_COTE.filter((id) => candidats.has(id))).toEqual([]);
    expect(candidats.has('incline-row')).toBe(true);
    expect(candidats.has('single-arm-row')).toBe(true);
  });

  it('n’en met aucun dans aucune séance du programme, quels que soient le nombre d’exercices et les objectifs', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const objectifs of JEUX_OBJECTIFS) {
        for (const alternance of [true, false]) {
          for (const graine of GRAINES.slice(0, alternance ? 8 : 2)) {
            const programme = programmeCompose(nombre, objectifs, graine, alternance);
            const cas = `${nombre} · ${objectifs} · alternance ${alternance} · graine ${graine}`;
            expect(toutes(programme).filter((id) => MIS_DE_COTE.includes(id)), cas).toEqual([]);
          }
        }
      }
    }
    // Ni dans le programme de base, tiré sur trente graines.
    for (const programme of programmes) expect(toutes(programme).filter((id) => MIS_DE_COTE.includes(id))).toEqual([]);
  }, 30_000);

  it('ne les propose pas non plus quand on change un exercice', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const id of [...s.exercices, s.finale!]) {
          const choix = alternatives(programme, s.id, id, 200).map((e) => e.id);
          expect(choix.filter((x) => MIS_DE_COTE.includes(x)), `${programme.graine} · ${s.id} · ${id}`).toEqual([]);
        }
      }
    }
    // Même quand on remplace une fente d'un ancien programme : le remplaçant n'en est pas une.
    const ancienne = { ...programmes[0], seances: programmes[0].seances.map((s) => (s.id === 'lundi-a' ? { ...s, exercices: ['reverse-lunge', ...s.exercices.slice(1)] } : s)) };
    expect(alternatives(ancienne, 'lundi-a', 'reverse-lunge', 200).filter((e) => MIS_DE_COTE.includes(e.id))).toEqual([]);
  });

  it('remplit la place « fente » du lundi avec un exercice à deux jambes — les machines attendent la fin', () => {
    // Sans objectif, c'est la première place du lundi : son exercice ouvre la séance.
    const sansMachine = DEUX_JAMBES.filter((id) => EXERCICES_PAR_ID[id].materiel !== 'salle');
    for (const nombre of NOMBRES_EXERCICES) {
      for (const graine of GRAINES.slice(0, 8)) {
        const programme = programmeCompose(nombre, [], graine);
        for (const id of ['lundi-a', 'lundi-b']) {
          const lundi = seanceNommee(programme, id);
          expect(sansMachine, `${nombre} · ${graine} · ${id}`).toContain(lundi.exercices[0]);
          expect(exercicesDe(lundi).filter((e) => e.materiel === 'salle')).toEqual([]);
        }
      }
    }
  });

  it('trouve toujours assez de partenaires : le nombre choisi, tout en paires, tous les objectifs servis', () => {
    // Pour chaque objectif, les séances où il a sa place, et les muscles qu'il vise.
    const VISES: Record<string, { muscles: string[]; seances: string[] }> = {
      'bas-du-dos': { muscles: ['lombaires'], seances: ['lundi-a', 'lundi-b', 'jeudi'] },
      epaules: { muscles: ['epaules'], seances: ['mardi-a', 'mardi-b', 'jeudi'] },
      'exterieur-cuisse': { muscles: ['abducteurs'], seances: ['lundi-a', 'lundi-b'] },
      'interieur-cuisse': { muscles: ['adducteurs'], seances: ['lundi-a', 'lundi-b'] },
      bras: { muscles: ['biceps', 'triceps'], seances: ['mardi-a', 'mardi-b'] },
      tronc: { muscles: ['abdominaux', 'obliques'], seances: ['lundi-a', 'lundi-b', 'jeudi'] },
      jambes: { muscles: ['quadriceps', 'ischios'], seances: ['lundi-a', 'lundi-b', 'jeudi'] },
      'haut-du-dos': { muscles: ['dorsaux', 'trapezes'], seances: ['mardi-a', 'mardi-b', 'jeudi'] },
    };
    for (const nombre of NOMBRES_EXERCICES) {
      // Un objectif seul, ou ceux d'usage. Les huit ensemble ne tiennent pas dans
      // quatre exercices : ce cas-là est écarté.
      for (const objectifs of [undefined, ...TOUS_LES_OBJECTIFS.map((id) => [id])]) {
        for (const graine of GRAINES.slice(0, 4)) {
          const programme = programmeCompose(nombre, objectifs, graine);
          for (const s of programme.seances) {
            const cas = `${nombre} · ${objectifs ?? 'défaut'} · graine ${graine} · ${s.id}`;
            expect(s.exercices, cas).toHaveLength(nombre);
            expect(s.liens, cas).toHaveLength(nombre / 2);
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

  it('le Superman au kettlebell, seul exercice direct du bas du dos, revient en semaine B ; le mardi ne reprend rien', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const graine of GRAINES.slice(0, 8)) {
        const programme = programmeCompose(nombre, undefined, graine);
        const [a, b] = ['lundi-a', 'lundi-b'].map((id) => seanceNommee(programme, id).exercices);
        expect(a, `${nombre} · ${graine}`).toContain('kb-superman');
        expect(b, `${nombre} · ${graine}`).toContain('kb-superman');
        const [mardiA, mardiB] = ['mardi-a', 'mardi-b'].map((id) => seanceNommee(programme, id).exercices.map((x) => cleMouvement(EXERCICES_PAR_ID[x])));
        expect(mardiB.filter((x) => mardiA.includes(x))).toEqual([]);
      }
    }
    // Il ne reste que lui : les deux seuls exercices directs étaient celui-là et le good morning.
    const directs = candidatsProgramme(MATERIELS_PROGRAMME).filter((e) => (e.musclesPrincipaux ?? []).includes('lombaires'));
    expect(directs.map((e) => e.id)).toEqual(['kb-superman']);
  });

  it('forme des paires intérieur ↔ extérieur de cuisse tous les lundis, malgré le peu d’exercices qui restent', () => {
    for (const nombre of NOMBRES_EXERCICES) {
      for (const graine of GRAINES.slice(0, 8)) {
        const programme = programmeCompose(nombre, undefined, graine);
        for (const id of ['lundi-a', 'lundi-b']) {
          const raisons = pairesDe(seanceNommee(programme, id)).map(([a, b]) => accordPaire(a, b).raison);
          expect(raisons, `${nombre} · ${graine} · ${id}`).toContain('intérieur ↔ extérieur de cuisse');
        }
      }
    }
  });
});

describe('les précautions : arrêt en bas', () => {
  /** Pour le dos, puis pour les genoux. */
  const POUR_LE_DOS = [
    'trap-bar-deadlift', 'romanian-deadlift', 'kb-deadlift', 'kb-good-morning', 'kb-single-leg-deadlift', 'bent-over-row',
    'kb-bent-over-row', 'seesaw-row', 'reverse-fly', 'kb-rear-fly', 'kb-lawn-mower',
  ];
  const POUR_LES_GENOUX = [
    'squat', 'goblet-squat', 'kb-goblet-squat', 'sumo-squat', 'thruster', 'kb-thruster', 'hack-squat', 'leg-press',
    'reverse-lunge', 'kb-lunge', 'elevated-reverse-lunge', 'step-up', 'side-lunge', 'kb-side-lunge', 'curtsy-lunge',
    'kb-wall-squat-press', 'kb-lunge-press', 'kb-rotating-side-lunge-press',
  ];
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
    expect(genoux.sort()).toEqual([...POUR_LES_GENOUX].sort());
  });

  it('n’a plus d’arrêt en bas pour ces exercices, quel que soit le tempo ; les autres gardent le leur', () => {
    for (const id of [...POUR_LE_DOS, ...POUR_LES_GENOUX]) {
      const e = EXERCICES_PAR_ID[id];
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
              // La série dure exactement ses répétitions, chacune à son tempo.
              expect(etape.dureeSec, cas).toBe(cycles * secondesParRep(tempo, exercice));
              // Le métronome arrive à la dernière répétition au moment où la série finit…
              const fin = etatMetronome(etape, etape.dureeSec - 0.001, seance.parametres.tempo)!;
              expect(fin.cycle, cas).toBe(cycles - 1);
              // … et sans arrêt en bas, la bille ne se pose jamais : pas de phase de pause.
              if (exercice.sansPauseEnBas) {
                for (let t = 0; t < etape.dureeSec; t += 0.5) {
                  expect(etatMetronome(etape, t, seance.parametres.tempo)!.phase, `${cas} · ${t} s`).not.toBe('pause');
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
      jour: 1,
      type: 'facile',
      partie: 'bas',
      format: 'series',
      exercices: ['squat', 'hamstring-curl'],
      liens: [['squat', 'hamstring-curl']],
    };
    const etapes = construireEtapes(seancePourPersonne(lundiAvecSquat, PARAMETRES, SEUL_SEB, LUNDI));
    const series = etapes.filter((e) => e.type === 'serie');
    // Au tempo du programme (3 s / 3 s + 1 s en bas) : 8 répétitions de 6 s au squat,
    // de 7 s à la flexion des jambes, qui garde son arrêt.
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

  it('monte d’un cran après une semaine dure, et allège la dernière série du mardi', () => {
    const bloc = { series: 3, ajoutCharge: 5 };
    expect(chargeDeSerie(bloc, [], [100, 100, 100], 1, 'lb')).toBe(105);
    expect(chargeDeSerie(bloc, [105], [100, 100, 100], 2, 'lb')).toBe(105);
    expect(chargeDeSerie(bloc, [110], [100], 1, 'lb')).toBe(110);
    const legere = { series: 3, derniereLegere: true };
    expect(chargeDeSerie(legere, [30, 30], [30, 30, 15], 3, 'lb')).toBe(15);
    expect(chargeDeSerie(legere, [], [30, 30, 15], 3, 'lb')).toBe(15);
    expect(chargeDeSerie(legere, [30, 30, 25], [], 3, 'lb')).toBe(25);
    expect(chargeDeSerie(legere, [30], [], 2, 'lb')).toBe(30);
    expect(chargeDeSerie(undefined, [], [20], 1, 'lb')).toBe(20);
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

describe('le partage avec Max', () => {
  const p = programmes[0];

  it('fait l’aller-retour par le lien, accents compris', () => {
    const lien = lienDePartage(p, 'https://sgtraining.netlify.app/#ancienne');
    expect(lien.startsWith('https://sgtraining.netlify.app/#programme=')).toBe(true);
    expect(programmeDansLien(new URL(lien).hash)).toEqual(p);
  });

  it('reste un lien qu’on peut envoyer par texto', () => {
    expect(lienDePartage(p, 'https://sgtraining.netlify.app/').length).toBeLessThan(2500);
  });

  it('transporte les répétitions de chacun, et écarte celles qu’on ne peut pas lire', () => {
    const avecDuo = { ...p, duo: { reps: { sebastien: 6, max: 12 } } };
    expect(programmeDansLien(new URL(lienDePartage(avecDuo, 'https://sgtraining.netlify.app/')).hash)).toEqual(avecDuo);
    for (const duo of [{ reps: { sebastien: 0, max: 10 } }, { reps: { sebastien: 8 } }, { reps: 'beaucoup' }, 12]) {
      expect(validerProgramme({ ...p, duo })).toEqual(p);
    }
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
    expect(seanceNommee(recompose, 'jeudi').exercices[0]).toBe('trap-bar-deadlift');
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
    expect(recompose.seances.map((s) => s.id)).toEqual(['lundi-a', 'mardi-a', 'jeudi', 'lundi-b', 'mardi-b']);
    expect(seanceNommee(recompose, 'lundi-a').partie).toBe('bas');
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
    for (const duo of [{ exercices: 7 }, { exercices: '8' }, { tempo: { monteeSec: 1, descenteSec: 1 } }, { tempo: 'lent' }]) {
      expect(validerProgramme({ ...p, duo })).toEqual(p);
    }
    // Les répétitions illisibles n'emportent pas le reste.
    expect(validerProgramme({ ...regle, duo: { ...regle.duo, reps: { sebastien: 8 } } })?.duo).toEqual(regle.duo);
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
