import { describe, expect, it } from 'vitest';
import type { Exercice, ParametresSeance, ProgrammeMois, SeanceDuMois, SeanceRealisee } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes, dureeTotaleSec } from './etapesSeance';
import { cleMouvement } from './generateurSeance';
import {
  DUREE_MAXI_SEC,
  MATERIELS_PROGRAMME,
  TAILLE_ENCHAINEMENT,
  TRANSITION_LIEN_SEC,
  accordLien,
  alternatives,
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
  enEnchainements,
  estPoussee,
  estSemaineDure,
  etirementsPauseDe,
  exercicesAAugmenter,
  faiteCetteSemaine,
  genererProgramme,
  lienDePartage,
  lierDansProgramme,
  prochaineDate,
  prochaineSeance,
  programmeDansLien,
  remplacerDansProgramme,
  repsDuDuo,
  seanceAProposer,
  seancePourPersonne,
  semaineDe,
  validerProgramme,
} from './programmeMois';
import type { ContexteSeance } from './programmeMois';

/** Lundi 5 octobre 2026. */
const LUNDI = new Date(2026, 9, 5);
const jour = (decalage: number, heure = 8) => new Date(2026, 9, 5 + decalage, heure);

const GRAINES = Array.from({ length: 30 }, (_, i) => i + 1);
const programmes = GRAINES.map((graine) => genererProgramme({ graine, aujourdhui: LUNDI }));

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };
/** Les quatre façons de faire une séance : seul ou à deux, sur le téléphone
 *  de Sébastien ou sur celui de Max. */
const SEUL_SEB: ContexteSeance = { personne: 'sebastien' };
const SEUL_MAX: ContexteSeance = { personne: 'max' };
const DUO_SEB: ContexteSeance = { personne: 'sebastien', aDeux: true };
const DUO_MAX: ContexteSeance = { personne: 'max', aDeux: true };
const CONTEXTES = [SEUL_SEB, SEUL_MAX, DUO_SEB, DUO_MAX];

const exercicesDe = (seance: SeanceDuMois): Exercice[] => seance.exercices.map((id) => EXERCICES_PAR_ID[id]);
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
      ['lundi-a', 1, 'A', 'facile', 'bas', 'enchaine'],
      ['mardi-a', 2, 'A', 'facile', 'haut', 'enchaine'],
      ['jeudi', 4, undefined, 'dure', 'complet', 'series'],
      ['lundi-b', 1, 'B', 'facile', 'bas', 'enchaine'],
      ['mardi-b', 2, 'B', 'facile', 'haut', 'enchaine'],
    ]);
  });

  it('sans alternance, lundi et mardi reviennent chaque semaine', () => {
    const p = genererProgramme({ graine: 1, aujourdhui: LUNDI, alternance: false });
    expect(p.seances.map((s) => [s.id, s.semaine])).toEqual([
      ['lundi', undefined],
      ['mardi', undefined],
      ['jeudi', undefined],
    ]);
  });

  it('la semaine B change tous les exercices de la semaine A', () => {
    for (const p of programmes) {
      for (const [a, b] of [
        ['lundi-a', 'lundi-b'],
        ['mardi-a', 'mardi-b'],
      ]) {
        const deA = new Set(exercicesDe(seanceNommee(p, a)).map(cleMouvement));
        expect(exercicesDe(seanceNommee(p, b)).filter((e) => deA.has(cleMouvement(e)))).toEqual([]);
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
      // Les machines ne se glissent pas dans les enchaînements.
      for (const s of p.seances.filter((x) => x.format === 'enchaine')) {
        expect(exercicesDe(s).filter((e) => e.materiel === 'salle')).toEqual([]);
      }
    }
  });

  it('jamais deux exercices qui chargent le bas du dos dans le même enchaînement, quels que soient les objectifs', () => {
    const jeux = [undefined, ['bas-du-dos', 'epaules'], ['bas-du-dos'], [], ['jambes', 'tronc'], ['interieur-cuisse']];
    for (const objectifs of jeux) {
      for (const graine of GRAINES) {
        const p = genererProgramme({ graine, aujourdhui: LUNDI, ...(objectifs ? { objectifs } : {}) });
        for (const s of p.seances.filter((x) => x.format === 'enchaine')) {
          // Les blocs tels que la séance guidée les déroulera.
          const blocs = new Map<number, Exercice[]>();
          for (const bloc of seancePourPersonne(s, PARAMETRES, DUO_MAX, LUNDI).blocs) {
            const cle = bloc.superset ?? -1;
            blocs.set(cle, [...(blocs.get(cle) ?? []), EXERCICES_PAR_ID[bloc.exerciceId]]);
          }
          for (const bloc of blocs.values()) {
            expect(bloc.length).toBeLessThanOrEqual(TAILLE_ENCHAINEMENT);
            expect(bloc.filter(chargeLeBasDuDos).length, `${objectifs} · graine ${graine} · ${s.id}`).toBeLessThanOrEqual(1);
          }
          expect(dureeSec(s)).toBeLessThanOrEqual(DUREE_MAXI_SEC);
          expect(s.exercices.length).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it('range sept exercices en blocs de trois, trois et un, sans bloc à deux exercices du dos', () => {
    const candidats = candidatsProgramme(MATERIELS_PROGRAMME);
    const dos = candidats.filter(chargeLeBasDuDos).slice(0, 3);
    const autres = candidats.filter((e) => !chargeLeBasDuDos(e)).slice(0, 4);
    const ranges = enEnchainements([...dos, ...autres]);
    const blocs = [ranges.slice(0, 3), ranges.slice(3, 6), ranges.slice(6)];
    expect(blocs.map((b) => b.length)).toEqual([3, 3, 1]);
    expect(blocs.map((b) => b.filter(chargeLeBasDuDos).length)).toEqual([1, 1, 1]);
  });

  it('chaque séance tient dans l’heure à deux, une semaine normale ; seul, à peine plus', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        expect(dureeSec(s, {}, DUO_SEB)).toBeLessThanOrEqual(DUREE_MAXI_SEC);
        for (const contexte of [SEUL_SEB, SEUL_MAX]) {
          expect(dureeSec(s, {}, contexte)).toBeLessThanOrEqual(DUREE_MAXI_SEC + 3 * 60);
        }
        // Et ce sont de vraies séances, pas trois exercices.
        expect(s.exercices.length).toBeGreaterThanOrEqual(s.type === 'dure' ? 4 : 5);
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

  it('déroule le jeudi en séries, le lundi en enchaînements de trois, les jambes à la fin', () => {
    const reference = seancePourPersonne(jeudi, PARAMETRES, SEUL_SEB, LUNDI);
    expect(reference.titre).toBe(jeudi.nom);
    expect(reference.blocs.map((b) => b.exerciceId)).toEqual([...jeudi.exercices, jeudi.finale]);
    expect(reference.blocs.every((b) => b.series === 3 && b.superset === undefined)).toBe(true);

    const bas = seancePourPersonne(lundi, PARAMETRES, SEUL_SEB, LUNDI);
    const enchaines = bas.blocs.slice(0, lundi.exercices.length);
    expect(enchaines.map((b) => b.superset)).toEqual(lundi.exercices.map((_, i) => Math.floor(i / 3)));
    expect(enchaines.every((b) => b.series === 3 && b.transitionSec === 0 && b.reposSec === 90)).toBe(true);
    for (const bloc of enchaines) {
      expect(bloc.reps).toBe(exercice(bloc.exerciceId).unite === 'secondes' ? 30 : 8);
    }
    // Le dernier, à part, après les enchaînements.
    const fin = bas.blocs[bas.blocs.length - 1];
    expect(fin.exerciceId).toBe(lundi.finale);
    expect(fin.superset).toBeUndefined();
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

  it('repose selon l’exercice : deux minutes à la trap bar, une minute aux petits muscles', () => {
    const reference = seancePourPersonne(jeudi, PARAMETRES, SEUL_SEB, LUNDI);
    for (const bloc of reference.blocs) {
      const e = exercice(bloc.exerciceId);
      const petit = e.pattern === 'isolation' || ['anti-rotation', 'flexion-tronc', 'rotation', 'flexion-laterale'].includes(e.pattern);
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
    expect(seb.horloge).toEqual({ personne: 'sebastien', partenaire: 'Max', jeCommence: false });
    expect(max.horloge).toEqual({ personne: 'max', partenaire: 'Sébastien', jeCommence: true });
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
    expect(etirementsPauseDe('sebastien')).toEqual(['etir-rachis-debout', 'etir-ischios-debout', 'etir-inclinaison-tronc']);
    expect(etirementsPauseDe('max')).toEqual(['etir-quadriceps-debout', 'etir-mollet-mur', 'etir-fente-bras-leve']);
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

  it('finit par cinq minutes d’étirements du poster, autres en semaine B', () => {
    for (const s of programmes[0].seances) {
      const seance = seancePourPersonne(s, PARAMETRES, SEUL_SEB, LUNDI);
      expect(seance.retourCalmeSec).toBe(300);
      for (const etirement of seance.retourCalme ?? []) {
        expect(EXERCICES_PAR_ID[etirement.exerciceId!].famille).toBe('etirement');
      }
      expect(new Set(seance.retourCalme?.map((e) => e.exerciceId)).size).toBe(5);
    }
    const ids = (id: string) =>
      new Set(seancePourPersonne(seanceNommee(p, id), PARAMETRES, SEUL_SEB, LUNDI).retourCalme?.map((e) => e.exerciceId));
    for (const [a, b] of [
      ['lundi-a', 'lundi-b'],
      ['mardi-a', 'mardi-b'],
    ]) {
      const [deA, deB] = [ids(a), ids(b)];
      expect([...deA].filter((id) => deB.has(id))).toEqual([]);
    }
  });

  it('chacun son tour se bascule, et la durée à deux suit', () => {
    const bascule = basculerTour(p, 'jeudi', jeudi.exercices[1]);
    expect(seanceNommee(bascule, 'jeudi').tour).toContain(jeudi.exercices[1]);
    expect(dureeSec(seanceNommee(bascule, 'jeudi'))).toBeGreaterThan(dureeSec(jeudi));
    const retour = basculerTour(bascule, 'jeudi', jeudi.exercices[1]);
    expect(seanceNommee(retour, 'jeudi')).toEqual(jeudi);
  });

  it('annonce exactement la durée que la séance guidée chronométrera', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const contexte of CONTEXTES) {
          for (const semaineDure of [false, true]) {
            const seance = seancePourPersonne(s, PARAMETRES, { ...contexte, semaineDure }, LUNDI);
            expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
          }
        }
      }
    }
  });
});

describe('lier deux exercices, le jeudi', () => {
  const p = programmes[0];
  const jeudi = seanceNommee(p, 'jeudi');
  const exercice = (id: string) => EXERCICES_PAR_ID[id];

  it('dit qui va bien ensemble : pousser et tirer, oui ; deux fois les mêmes muscles ou le bas du dos, non', () => {
    expect(accordLien(exercice('bench-press'), exercice('incline-row'))).toBe('bon');
    expect(accordLien(exercice('trap-bar-deadlift'), exercice('bent-over-row'))).toBe('bas-du-dos');
    expect(accordLien(exercice('bench-press'), exercice('dumbbell-push-up'))).toBe('memes-muscles');
  });

  it('enchaîne la paire sans pause, la trap bar restant en tête, et fait gagner du temps', () => {
    const [premier, , troisieme] = jeudi.exercices;
    const lie = lierDansProgramme(p, 'jeudi', troisieme, premier);
    const seanceLiee = seanceNommee(lie, 'jeudi');
    expect(seanceLiee.exercices.slice(0, 2)).toEqual([premier, troisieme]);
    expect(seanceLiee.exercices.slice().sort()).toEqual(jeudi.exercices.slice().sort());
    expect(seanceLiee.liens).toEqual([[premier, troisieme]]);

    const blocs = seancePourPersonne(seanceLiee, PARAMETRES, SEUL_SEB, LUNDI).blocs;
    expect(blocs[0].superset).toBe(0);
    expect(blocs[1].superset).toBe(0);
    expect(blocs[0].transitionSec).toBe(TRANSITION_LIEN_SEC);
    // Après la paire, la plus longue des pauses : celle de la trap bar.
    expect(blocs[1].reposSec).toBe(120);
    expect(blocs[2].superset).toBeUndefined();
    expect(dureeSec(seanceLiee, {}, SEUL_SEB)).toBeLessThan(dureeSec(jeudi, {}, SEUL_SEB));
    expect(dureeSec(seanceLiee)).toBeLessThan(dureeSec(jeudi));
  });

  it('ne lie pas deux fois le même exercice, ni dans un enchaîné, et se délie', () => {
    const [a, b, c] = jeudi.exercices;
    const lie = lierDansProgramme(p, 'jeudi', a, b);
    expect(lierDansProgramme(lie, 'jeudi', b, c)).toEqual(lie);
    const [x, y] = seanceNommee(p, 'lundi-a').exercices;
    expect(lierDansProgramme(p, 'lundi-a', x, y)).toEqual(p);
    const delie = seanceNommee(delierDansProgramme(lie, 'jeudi', b), 'jeudi');
    expect(delie.liens).toBeUndefined();
  });

  it('voyage avec le programme, et se perd s’il ne tient plus', () => {
    const [a, b] = jeudi.exercices;
    const lie = lierDansProgramme(p, 'jeudi', a, b);
    expect(programmeDansLien(new URL(lienDePartage(lie, 'https://sgtraining.netlify.app/')).hash)).toEqual(lie);
    // Deux exercices qui ne se suivent plus ne sont plus liés.
    const ecartes = {
      ...lie,
      seances: lie.seances.map((s) => (s.id === 'jeudi' ? { ...s, liens: [[a, s.exercices[3]]] } : s)),
    };
    expect(seanceNommee(validerProgramme(ecartes)!, 'jeudi').liens).toBeUndefined();
    // Changer un exercice lié garde le lien.
    const nouveau = alternatives(lie, 'jeudi', b)[0];
    expect(seanceNommee(remplacerDansProgramme(lie, 'jeudi', b, nouveau.id), 'jeudi').liens).toEqual([[a, nouveau.id]]);
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
    expect(recompose.version).toBe(3);
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
    expect(recompose.version).toBe(3);
    expect(recompose.duo).toEqual({ reps: { sebastien: 8, max: 12 } });
    expect(recompose.seances.map((s) => s.id)).toEqual(['lundi-a', 'mardi-a', 'jeudi', 'lundi-b', 'mardi-b']);
    expect(seanceNommee(recompose, 'lundi-a').partie).toBe('bas');
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
