import { describe, expect, it } from 'vitest';
import type { Exercice, ParametresSeance, ProgrammeMois, SeanceDuMois, SeanceRealisee } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes, dureeTotaleSec } from './etapesSeance';
import { cleMouvement } from './generateurSeance';
import {
  CHANGEMENT_SEC,
  DUREE_MAXI_SEC,
  MATERIELS_PROGRAMME,
  TAILLE_ENCHAINEMENT,
  alternatives,
  basculerTour,
  candidatsProgramme,
  chargeLeBasDuDos,
  chargeProposee,
  chargesPassees,
  decoderProgramme,
  dureeSec,
  enEnchainements,
  faiteCetteSemaine,
  genererProgramme,
  lienDePartage,
  prochaineSeance,
  programmeDansLien,
  remplacerDansProgramme,
  seanceAProposer,
  seancePourPersonne,
  semaineDe,
  seriesDuJour,
  validerProgramme,
} from './programmeMois';

/** Lundi 5 octobre 2026. */
const LUNDI = new Date(2026, 9, 5);
const jour = (decalage: number, heure = 8) => new Date(2026, 9, 5 + decalage, heure);

const GRAINES = Array.from({ length: 30 }, (_, i) => i + 1);
const programmes = GRAINES.map((graine) => genererProgramme({ graine, aujourdhui: LUNDI }));

const SEBASTIEN: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, seriesJourFacile: 2 };
const MAX: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, seriesJourFacile: 3 };

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
  it('compose le lundi dur, puis mardi et jeudi en semaines A et B', () => {
    expect(programmes[0].seances.map((s) => [s.id, s.jour, s.semaine, s.type, s.format])).toEqual([
      ['lundi', 1, undefined, 'dure', 'series'],
      ['mardi-a', 2, 'A', 'facile', 'enchaine'],
      ['jeudi-a', 4, 'A', 'facile', 'enchaine'],
      ['mardi-b', 2, 'B', 'facile', 'enchaine'],
      ['jeudi-b', 4, 'B', 'facile', 'enchaine'],
    ]);
  });

  it('sans alternance, mardi et jeudi reviennent chaque semaine', () => {
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
        ['mardi-a', 'mardi-b'],
        ['jeudi-a', 'jeudi-b'],
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

  it('vise les faiblesses : bas du dos et épaules le lundi, cuisses le mardi, épaules le jeudi', () => {
    for (const p of programmes) {
      const lundi = seanceNommee(p, 'lundi');
      expect(vise(lundi, 'lombaires')).toBe(true);
      expect(vise(lundi, 'epaules')).toBe(true);
      for (const id of ['mardi-a', 'mardi-b']) {
        const mardi = seanceNommee(p, id);
        expect(vise(mardi, 'lombaires')).toBe(true);
        expect(vise(mardi, 'abducteurs')).toBe(true);
        expect(vise(mardi, 'adducteurs')).toBe(true);
      }
      for (const id of ['jeudi-a', 'jeudi-b']) expect(vise(seanceNommee(p, id), 'epaules')).toBe(true);
    }
  });

  it('le lundi s’ouvre sur la trap bar, pousse sur banc, et finit les jambes à la machine', () => {
    for (const p of programmes) {
      const seance = seanceNommee(p, 'lundi');
      const lundi = exercicesDe(seance);
      expect(lundi[0].id).toBe('trap-bar-deadlift');
      expect(lundi.some((e) => e.pattern === 'poussee-horizontale' && e.materiel === 'banc')).toBe(true);
      // Une seule charnière lourde : le bas du dos se travaille à part.
      const charnieres = lundi.filter((e) => e.pattern === 'charniere' && (e.musclesPrincipaux ?? []).includes('ischios'));
      expect(charnieres.map((e) => e.id)).toEqual(['trap-bar-deadlift']);
      expect(['leg-press', 'hack-squat']).toContain(seance.finale);
      // Une machine pour deux : chacun son tour, d'office.
      expect(seance.tour).toEqual(['trap-bar-deadlift', seance.finale]);
    }
  });

  it('finit chaque séance par les jambes, jamais par la trap bar', () => {
    const finales = ['leg-press', 'hack-squat', 'traineau', 'farmers-walk', 'kb-farmers-walk'];
    for (const p of programmes) {
      for (const s of p.seances) {
        expect(finales).toContain(s.finale);
        expect(s.exercices).not.toContain(s.finale);
        expect(s.exercices.slice(1)).not.toContain('trap-bar-deadlift');
        const surMachine = [...s.exercices, s.finale!].filter((id) => EXERCICES_PAR_ID[id].materiel === 'salle');
        expect(s.tour ?? []).toEqual(surMachine);
      }
      // D'une séance à l'autre, la fin change.
      expect(new Set(p.seances.map((s) => cleMouvement(EXERCICES_PAR_ID[s.finale!]))).size).toBeGreaterThanOrEqual(3);
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
          for (const bloc of seancePourPersonne(s, MAX, LUNDI).blocs) {
            const cle = bloc.superset ?? -1;
            blocs.set(cle, [...(blocs.get(cle) ?? []), EXERCICES_PAR_ID[bloc.exerciceId]]);
          }
          for (const bloc of blocs.values()) {
            expect(bloc.length).toBeLessThanOrEqual(TAILLE_ENCHAINEMENT);
            expect(bloc.filter(chargeLeBasDuDos).length, `${objectifs} · graine ${graine} · ${s.id}`).toBeLessThanOrEqual(1);
          }
          expect(dureeSec(s, MAX)).toBeLessThanOrEqual(DUREE_MAXI_SEC);
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

  it('chaque séance tient dans l’heure, pour Sébastien comme pour Max', () => {
    for (const p of programmes) {
      for (const s of p.seances) {
        for (const parametres of [SEBASTIEN, MAX]) {
          expect(dureeSec(s, parametres)).toBeLessThanOrEqual(DUREE_MAXI_SEC);
        }
        // Et ce sont de vraies séances, pas trois exercices.
        expect(s.exercices.length).toBeGreaterThanOrEqual(s.type === 'dure' ? 5 : 6);
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
      for (const id of ['jeudi-a', 'jeudi-b']) {
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
      [0, 'lundi', 0],
      [1, 'mardi-a', 0],
      [2, 'jeudi-a', 1], // mercredi
      [4, 'lundi', 3], // vendredi
      [-2, 'lundi', 2], // samedi d'avant le début
      [8, 'mardi-b', 0],
      [10, 'jeudi-b', 0],
      [15, 'mardi-a', 0],
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
});

describe('la séance de chacun', () => {
  const p = programmes[0];
  const lundi = seanceNommee(p, 'lundi');
  const mardi = seanceNommee(p, 'mardi-a');

  it('Sébastien enlève une série les jours faciles ; Max garde les siennes', () => {
    expect(seriesDuJour(lundi, SEBASTIEN)).toBe(3);
    expect(seriesDuJour(mardi, SEBASTIEN)).toBe(2);
    expect(seriesDuJour(mardi, MAX)).toBe(3);
    expect(seriesDuJour(mardi, { seriesParExercice: 4 })).toBe(3);
    expect(seriesDuJour(mardi, { seriesParExercice: 2 })).toBe(1);
  });

  it('déroule le lundi en séries, le mardi en enchaînements de trois, les jambes à la fin', () => {
    const dure = seancePourPersonne(lundi, SEBASTIEN, LUNDI);
    expect(dure.titre).toBe(lundi.nom);
    expect(dure.blocs.map((b) => b.exerciceId)).toEqual([...lundi.exercices, lundi.finale]);
    expect(dure.blocs.every((b) => b.series === 3 && b.superset === undefined)).toBe(true);

    const facile = seancePourPersonne(mardi, SEBASTIEN, LUNDI);
    const enchaines = facile.blocs.slice(0, mardi.exercices.length);
    expect(enchaines.map((b) => b.superset)).toEqual(mardi.exercices.map((_, i) => Math.floor(i / 3)));
    expect(enchaines.every((b) => b.series === 2 && b.transitionSec === 0)).toBe(true);
    for (const bloc of enchaines) {
      const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
      expect(bloc.reps).toBe(exercice.unite === 'secondes' ? 30 : 8);
    }
    // Le dernier, à part, après les enchaînements.
    const fin = facile.blocs[facile.blocs.length - 1];
    expect(fin.exerciceId).toBe(mardi.finale);
    expect(fin.superset).toBeUndefined();
  });

  it('commence par cinq minutes de tapis ou de rameur et quatre mouvements légers', () => {
    for (const s of programmes[0].seances) {
      const seance = seancePourPersonne(s, SEBASTIEN, LUNDI);
      expect(seance.echauffement?.[0]).toMatchObject({ nom: 'Tapis ou rameur', dureeSec: 300 });
      expect(seance.echauffement).toHaveLength(5);
      expect(seance.echauffementSec).toBe(300 + 4 * 45);
    }
  });

  it('finit par cinq minutes d’étirements du poster, autres en semaine B', () => {
    for (const s of programmes[0].seances) {
      const seance = seancePourPersonne(s, SEBASTIEN, LUNDI);
      expect(seance.retourCalmeSec).toBe(300);
      for (const etirement of seance.retourCalme ?? []) {
        expect(EXERCICES_PAR_ID[etirement.exerciceId!].famille).toBe('etirement');
      }
      expect(new Set(seance.retourCalme?.map((e) => e.exerciceId)).size).toBe(5);
    }
    const ids = (id: string) => new Set(seancePourPersonne(seanceNommee(p, id), SEBASTIEN, LUNDI).retourCalme?.map((e) => e.exerciceId));
    const [a, b] = [ids('mardi-a'), ids('mardi-b')];
    expect([...a].filter((id) => b.has(id))).toEqual([]);
  });

  it('chacun son tour : on souffle le temps de la série de l’autre', () => {
    const dure = seancePourPersonne(lundi, SEBASTIEN, LUNDI);
    const trapBar = dure.blocs[0];
    expect(trapBar.tour).toBe(true);
    // 8 répétitions à 3 s / 3 s + 2 s : 64 s, plus le temps de céder la place.
    expect(trapBar.reposSec).toBe(64 + CHANGEMENT_SEC);
    expect(dure.blocs[1].tour).toBeUndefined();
    expect(dure.blocs[1].reposSec).toBe(90);

    // Passer le développé en « chacun son tour » change la durée annoncée.
    const bascule = basculerTour(p, 'lundi', lundi.exercices[1]);
    expect(seanceNommee(bascule, 'lundi').tour).toContain(lundi.exercices[1]);
    expect(dureeSec(seanceNommee(bascule, 'lundi'), SEBASTIEN)).not.toBe(dureeSec(lundi, SEBASTIEN));
    const retour = basculerTour(bascule, 'lundi', lundi.exercices[1]);
    expect(seanceNommee(retour, 'lundi')).toEqual(lundi);
  });

  it('annonce exactement la durée que la séance guidée chronométrera', () => {
    for (const programme of programmes.slice(0, 10)) {
      for (const s of programme.seances) {
        for (const parametres of [SEBASTIEN, MAX]) {
          const seance = seancePourPersonne(s, parametres, LUNDI);
          expect(dureeTotaleSec(construireEtapes(seance))).toBe(seance.dureeEstimeeSec);
        }
      }
    }
  });
});

describe('changer un exercice', () => {
  const p = programmes[0];
  const lundi = seanceNommee(p, 'lundi');
  const actuel = EXERCICES_PAR_ID[lundi.exercices[0]];

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

  it('remplace le dernier exercice par une autre fin pour les jambes', () => {
    const fin = lundi.finale!;
    const choix = alternatives(p, 'lundi', fin);
    expect(choix.length).toBeGreaterThan(1);
    expect(choix.every((e) => ['leg-press', 'hack-squat', 'traineau', 'farmers-walk', 'kb-farmers-walk'].includes(e.id))).toBe(true);
    const marche = choix.find((e) => e.materiel !== 'salle')!;
    const modifie = seanceNommee(remplacerDansProgramme(p, 'lundi', fin, marche.id), 'lundi');
    expect(modifie.finale).toBe(marche.id);
    // Une marche du fermier se fait côte à côte : plus « chacun son tour ».
    expect(modifie.tour).toEqual(['trap-bar-deadlift']);
  });

  it('remplace l’exercice dans cette séance seulement', () => {
    const nouveau = alternatives(p, 'lundi', actuel.id)[0];
    const modifie = remplacerDansProgramme(p, 'lundi', actuel.id, nouveau.id);
    expect(seanceNommee(modifie, 'lundi').exercices[0]).toBe(nouveau.id);
    expect(modifie.seances.filter((s) => s.id !== 'lundi')).toEqual(p.seances.filter((s) => s.id !== 'lundi'));
    expect(seanceNommee(p, 'lundi').exercices[0]).toBe(actuel.id);
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
    expect(recompose.version).toBe(2);
    expect(recompose.debut).toBe('2026-10-05');
    expect(recompose.graine).toBe(42);
    expect(recompose.objectifs).toEqual(['bas-du-dos', 'epaules']);
    expect(seanceNommee(recompose, 'lundi').exercices[0]).toBe('trap-bar-deadlift');
    expect(recompose.seances).toHaveLength(5);
    expect(validerProgramme(ancien)).toEqual(recompose);
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
