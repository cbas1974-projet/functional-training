import { afterAll, describe, expect, it } from 'vitest';
import type { Exercice, Seance, Tempo } from '../types';
import {
  CONSIGNE_CERCLE_AU_TEMPS,
  CONSIGNE_CIRCULAIRE,
  CONSIGNE_ROTATION,
  EXERCICES,
  EXERCICES_PAR_ID,
  consignesDe,
} from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import {
  construireEtapes,
  dureeTotaleSec,
  etatChangementCote,
  etatMetronome,
  formeDe,
  motDePhase,
  phasesDeRep,
  positionBille,
  premierePhase,
} from './etapesSeance';
import type { Etape } from './etapesSeance';
import { appliquer } from './etatCommun';
import type { EtatCommun } from './etatCommun';
import { raccourcirPourEssai } from './essai';
import { libelleTempo } from './formatage';
import {
  CHANGER_DE_COTE_SEC,
  changementDeCoteSec,
  dureeSerieSec,
  estimerDureeSec,
  secondesParRep,
  tempoPourExercice,
} from './generateurSeance';
import { decisionProlonger, perspectiveAutre, positionCommune } from './horlogeCommune';
import type { Contexte } from './horlogeCommune';

const TEMPO: Tempo = { monteeSec: 3, descenteSec: 3, pauseSec: 1 };
const TEMPOS: Tempo[] = [TEMPO, { monteeSec: 3, descenteSec: 3, pauseSec: 2 }, { monteeSec: 4, descenteSec: 4 }, { monteeSec: 2, descenteSec: 4 }];
const musculationEnReps = EXERCICES.filter((e) => (e.famille ?? 'musculation') === 'musculation' && e.unite === 'reps');
const serie = (exercice: Exercice, reps: number, tempo: Tempo = TEMPO): Etape => ({
  type: 'serie',
  exerciceId: exercice.id,
  serie: 1,
  series: 1,
  reps,
  dureeSec: dureeSerieSec(exercice, reps, tempo),
});
/** Un cercle en répétitions, inscrit dans la bibliothèque le temps de ces
 *  tests : les trois cercles du kettlebell se font au temps, mais le
 *  métronome sait toujours compter des tours. */
const cercleEnReps = (id: string): Exercice => {
  const exercice: Exercice = { ...EXERCICES_PAR_ID[id], id: `${id}-en-reps`, unite: 'reps' };
  EXERCICES_PAR_ID[exercice.id] = exercice;
  return exercice;
};
afterAll(() => {
  for (const id of Object.keys(EXERCICES_PAR_ID)) if (id.endsWith('-en-reps')) delete EXERCICES_PAR_ID[id];
});
/** Ce que montre le métronome, quart de seconde par quart de seconde. */
const lecture = (etape: Etape, tempo: Tempo = TEMPO) => {
  const instants = [];
  for (let t = 0.125; t < etape.dureeSec; t += 0.25) instants.push({ t, metro: etatMetronome(etape, t, tempo) });
  return instants;
};

describe('la forme du mouvement', () => {
  const CIRCULAIRES = ['kb-around-the-body', 'kb-halo', 'kb-around-the-world'];
  const ROTATIONS = ['russian-twist', 'kb-russian-twist', 'v-sit-cross-jab', 'hollow-body-sweeper', 'kb-plank-oblique-pull-through'];

  it('tourne en cercle : le tour de taille, le halo, le tour du monde — et eux seuls', () => {
    expect(EXERCICES.filter((e) => e.mouvement === 'circulaire').map((e) => e.id).sort()).toEqual([...CIRCULAIRES].sort());
    for (const id of CIRCULAIRES) expect(formeDe(EXERCICES_PAR_ID[id]), id).toBe('circulaire');
  });

  it('va d’un côté à l’autre : les rotations russes, le balayage, les coups croisés, le passage sous la planche — et eux seuls', () => {
    expect(EXERCICES.filter((e) => e.mouvement === 'rotation').map((e) => e.id).sort()).toEqual([...ROTATIONS].sort());
    expect(formeDe(EXERCICES_PAR_ID['hammer-curl'])).toBe('vertical');
  });

  it('ne confond pas la forme avec le schéma de mouvement', () => {
    // Le tour de taille résiste à la rotation (« anti-rotation ») : c'est
    // pourtant un cercle. Le halo est une isolation, le tour du monde un squat.
    expect(EXERCICES_PAR_ID['kb-around-the-body'].pattern).toBe('anti-rotation');
    expect(EXERCICES_PAR_ID['kb-halo'].pattern).toBe('isolation');
    expect(EXERCICES_PAR_ID['kb-around-the-world'].pattern).toBe('squat');
    // Et un schéma « rotation » peut rester vertical : le bûcheron monte et
    // descend en diagonale, la planche en T lève le bras vers le plafond.
    const verticauxEnRotation = musculationEnReps.filter((e) => e.pattern === 'rotation' && !e.mouvement).map((e) => e.id);
    // (Le swing du golfeur et le balancier latéral, eux, se font au temps.)
    expect(verticauxEnRotation.sort()).toEqual(['kb-wood-chop', 'plank-t', 'woodchop'].sort());
  });

  it('ne donne une forme qu’à des exercices de musculation lents, sans arrêt ni départ propre : les cercles au temps, les rotations au tempo', () => {
    for (const exercice of EXERCICES.filter((e) => e.mouvement)) {
      expect(exercice.famille ?? 'musculation', exercice.id).toBe('musculation');
      expect(exercice.unite, exercice.id).toBe(exercice.mouvement === 'circulaire' ? 'secondes' : 'reps');
      expect(exercice.explosif, exercice.id).toBeUndefined();
      expect([exercice.pauseEnHaut, exercice.sansPauseEnBas, exercice.premierePhase], exercice.id).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      expect(exercice.cotes, exercice.id).toBe('alterne');
    }
  });

  it('ne s’arrête jamais en cercle ni d’un côté à l’autre, quels que soient le tempo et les marques d’arrêt', () => {
    for (const id of [...CIRCULAIRES, ...ROTATIONS]) {
      const exercice = CIRCULAIRES.includes(id) ? cercleEnReps(id) : EXERCICES_PAR_ID[id];
      // Même prêté avec un arrêt en haut, ou sans arrêt en bas : aucun arrêt.
      for (const prete of [exercice, { ...exercice, pauseEnHaut: true }, { ...exercice, sansPauseEnBas: true }]) {
        for (const tempo of TEMPOS) {
          const tempoExercice = tempoPourExercice(prete, tempo);
          expect(tempoExercice.pauseSec, id).toBe(0);
          expect(tempoExercice.mouvement, id).toBe(exercice.mouvement);
          expect(secondesParRep(tempo, prete), id).toBe(tempo.monteeSec + tempo.descenteSec);
          expect(phasesDeRep(tempoExercice, 'descend').some((p) => p.phase === 'pause'), id).toBe(false);
        }
      }
      // Ni « TIENS » dans le métronome, ni consigne d'arrêt.
      expect(lecture(serie(exercice, 8)).some(({ metro }) => metro?.phase === 'pause'), id).toBe(false);
      expect(consignesDe(exercice).some((p) => /tient en haut|arrêt en bas : on descend/i.test(p)), id).toBe(false);
    }
  });

  it('un cercle en répétitions : un seul geste, TOURNE, un tour complet le temps de la montée et de la descente', () => {
    const tour = tempoPourExercice(cercleEnReps('kb-around-the-body'), TEMPO);
    expect(phasesDeRep(tour, 'monte')).toEqual([{ phase: 'tourne', dureeSec: 6 }]);
    expect(phasesDeRep(tour, 'descend')).toEqual([{ phase: 'tourne', dureeSec: 6 }]);
    expect(motDePhase('tourne', EXERCICES_PAR_ID['kb-halo'])).toBe('TOURNE');
    expect(libelleTempo(tour)).toBe('6 s par tour');
    // La bille fait le tour sans s'arrêter : elle avance du début à la fin du tour.
    expect([0, 0.25, 0.5, 1].map((p) => positionBille('tourne', p))).toEqual([0, 0.25, 0.5, 1]);
    expect(consignesDe(cercleEnReps('kb-around-the-body'))[0]).toBe(CONSIGNE_CIRCULAIRE);
    // Au temps, la consigne dit le temps, pas le tour.
    expect(consignesDe(EXERCICES_PAR_ID['kb-around-the-body'])[0]).toBe(CONSIGNE_CERCLE_AU_TEMPS);
  });

  it('un va-et-vient : À DROITE le temps de la montée, puis À GAUCHE le temps de la descente', () => {
    const twist = EXERCICES_PAR_ID['russian-twist'];
    const tempo = tempoPourExercice(twist, { monteeSec: 2, descenteSec: 4, pauseSec: 1 });
    // Toujours à droite d'abord, même si l'on demandait de partir en descendant.
    expect(premierePhase(twist)).toBe('monte');
    expect(phasesDeRep(tempo, 'descend')).toEqual([
      { phase: 'monte', dureeSec: 2 },
      { phase: 'descend', dureeSec: 4 },
    ]);
    expect([motDePhase('monte', twist), motDePhase('descend', twist)]).toEqual(['À DROITE', 'À GAUCHE']);
    expect(libelleTempo(tempo)).toBe('2 s à droite / 4 s à gauche');
    expect(consignesDe(twist)[0]).toBe(CONSIGNE_ROTATION);
  });

  it('garde MONTE / DESCENDS / TIENS pour un mouvement vertical, et les mots propres au geste horizontal', () => {
    const curl = EXERCICES_PAR_ID['hammer-curl'];
    expect(['monte', 'descend', 'pause'].map((p) => motDePhase(p as 'monte', curl))).toEqual(['MONTE', 'DESCENDS', 'TIENS']);
    const rotationExterne = EXERCICES_PAR_ID['no-money-curl'];
    expect(['monte', 'pause', 'descend'].map((p) => motDePhase(p as 'monte', rotationExterne))).toEqual(['OUVRE', 'TIENS', 'FERME']);
  });
});

describe('le métronome d’une série, selon la forme', () => {
  it('un cercle en répétitions : TOURNE, huit tours de 6 s, quatre dans un sens, quatre dans l’autre, annoncé sans s’arrêter', () => {
    const exercice = cercleEnReps('kb-around-the-body');
    const etape = serie(exercice, 8);
    expect(etape.dureeSec).toBe(48);
    const instants = lecture(etape);
    // Le métronome parle d'un bout à l'autre : aucun silence, aucun arrêt.
    expect(instants.every(({ metro }) => metro?.phase === 'tourne')).toBe(true);
    expect(etatMetronome(etape, 7, TEMPO)).toMatchObject({ rep: 2, totalReps: 8, phase: 'tourne', resteDansPhaseSec: 5, sens: 'premier' });
    expect(etatMetronome(etape, 23.9, TEMPO)).toMatchObject({ rep: 4, sens: 'premier' });
    expect(etatMetronome(etape, 23.9, TEMPO)?.changeDeSens).toBeUndefined();
    // À mi-série, on change de sens en continuant à compter.
    expect(etatMetronome(etape, 24, TEMPO)).toMatchObject({ rep: 5, sens: 'second', changeDeSens: true, resteDansPhaseSec: 6 });
    expect(etatMetronome(etape, 30, TEMPO)).toMatchObject({ rep: 6, sens: 'second' });
    expect(etatMetronome(etape, 30, TEMPO)?.changeDeSens).toBeUndefined();
    expect(etatMetronome(etape, 47.9, TEMPO)).toMatchObject({ rep: 8, sens: 'second' });
    expect(etatChangementCote(etape, 24, TEMPO)).toBeNull();
    // Un nombre impair : le premier sens prend le tour de plus.
    expect(etatMetronome(serie(cercleEnReps('kb-halo'), 5), 18.5, TEMPO)).toMatchObject({ rep: 4, sens: 'second', changeDeSens: true });
  });

  it('la rotation russe : À DROITE 3 s, À GAUCHE 3 s, huit fois, sans arrêt ni côté à annoncer', () => {
    const exercice = EXERCICES_PAR_ID['kb-russian-twist'];
    const etape = serie(exercice, 8);
    expect(etape.dureeSec).toBe(48);
    expect(etatMetronome(etape, 1, TEMPO)).toMatchObject({ rep: 1, phase: 'monte' });
    expect(etatMetronome(etape, 4, TEMPO)).toMatchObject({ rep: 1, phase: 'descend' });
    expect(etatMetronome(etape, 6, TEMPO)).toMatchObject({ rep: 2, phase: 'monte' });
    const mots = new Set(lecture(etape).map(({ metro }) => motDePhase(metro!.phase, exercice)));
    expect([...mots]).toEqual(['À DROITE', 'À GAUCHE']);
    expect(lecture(etape).some(({ metro }) => metro?.cote !== undefined || metro?.sens !== undefined)).toBe(false);
  });

  it('dure exactement ce que la séance annonce, cercles, rotations et unilatéraux compris', () => {
    const enReps = cercleEnReps('kb-halo').id;
    const blocs = [enReps, 'russian-twist', 'single-arm-row', 'fire-hydrant', 'goblet-squat'].map(
      (exerciceId) => ({ exerciceId, series: 2, reps: 8, reposSec: 45 }),
    );
    // Les cercles du kettlebell, au temps : 30 s dans chaque sens.
    blocs.push({ exerciceId: 'kb-halo', series: 2, reps: 30, reposSec: 45 });
    blocs.push({ exerciceId: 'kb-around-the-world', series: 2, reps: 30, reposSec: 45 });
    for (const tempo of TEMPOS) {
      const seance: Seance = {
        id: 'formes',
        creeLe: '2026-10-11T10:00:00.000Z',
        parametres: { ...PARAMETRES_PAR_DEFAUT, tempo },
        graine: 1,
        echauffementSec: 60,
        retourCalmeSec: 60,
        blocs,
        circuit: null,
        dureeEstimeeSec: 0,
      };
      const etapes = construireEtapes(seance);
      expect(dureeTotaleSec(etapes)).toBe(estimerDureeSec(seance));
      // Le cercle en répétitions et la rotation : montée + descente par répétition, rien de plus.
      for (const id of [enReps, 'russian-twist']) {
        expect(etapes.find((e) => e.type === 'serie' && e.exerciceId === id)?.dureeSec, id).toBe(8 * (tempo.monteeSec + tempo.descenteSec));
      }
      // Au temps, une minute, quel que soit le tempo.
      for (const id of ['kb-halo', 'kb-around-the-world']) {
        expect(etapes.find((e) => e.type === 'serie' && e.exerciceId === id)?.dureeSec, id).toBe(60);
      }
    }
  });
});

describe('le changement de côté', () => {
  const rowing = EXERCICES_PAR_ID['single-arm-row'];

  it('prend 5 s entre les deux côtés de chaque série unilatérale de musculation, et nulle part ailleurs', () => {
    expect(CHANGER_DE_COTE_SEC).toBe(5);
    for (const exercice of EXERCICES) {
      const musculation = (exercice.famille ?? 'musculation') === 'musculation';
      const attendu = exercice.cotes === 'unilateral' && musculation ? 5 : 0;
      expect(changementDeCoteSec(exercice), exercice.id).toBe(attendu);
    }
    // En répétitions, et au temps : le relevé turc, les explosifs d'un seul bras,
    // la planche de Copenhague et la planche latérale.
    expect(EXERCICES.filter((e) => changementDeCoteSec(e) > 0 && e.unite === 'secondes').map((e) => e.id).sort()).toEqual(
      [
        'kb-turkish-get-up', 'dumbbell-snatch', 'kb-side-swing', 'kb-single-arm-swing', 'kb-snatch', 'kb-clean',
        'kb-golfer-swing', 'copenhagen-plank', 'side-plank', 'bird-dog',
      ].sort(),
    );
    // Les positions tenues d'un côté puis de l'autre enchaînent, comme avant.
    expect(dureeSerieSec(EXERCICES_PAR_ID['yoga-guerrier-2'], 30, TEMPO)).toBe(60);
    // Une série unilatérale : ses répétitions des deux côtés, et les 5 s.
    expect(dureeSerieSec(rowing, 8, TEMPO)).toBe(8 * 7 * 2 + 5);
    expect(dureeSerieSec(rowing, 0, TEMPO)).toBe(0);
  });

  it('se tient entre la dernière répétition du côté droit et la première du côté gauche, dans la série', () => {
    const etape = serie(rowing, 8);
    expect(etatMetronome(etape, 55.9, TEMPO)).toMatchObject({ rep: 8, totalReps: 8, cote: 'droit' });
    expect(etatChangementCote(etape, 55.9, TEMPO)).toBeNull();
    expect(etatMetronome(etape, 56, TEMPO)).toBeNull();
    expect(etatChangementCote(etape, 56, TEMPO)).toEqual({ cote: 'gauche', resteSec: 5, dureeSec: 5 });
    expect(etatChangementCote(etape, 60.5, TEMPO)).toMatchObject({ resteSec: 0.5 });
    expect(etatMetronome(etape, 61, TEMPO)).toMatchObject({ rep: 1, totalReps: 8, cote: 'gauche', phase: 'monte', resteDansPhaseSec: 3 });
    expect(etatMetronome(etape, etape.dureeSec - 0.01, TEMPO)).toMatchObject({ rep: 8, cote: 'gauche' });
    // Les bips repartent où ils s'étaient arrêtés : le côté gauche commence au cycle 8.
    expect(etatMetronome(etape, 61, TEMPO)?.cycle).toBe(8);
  });

  it('« +5 s » allonge le changement de côté de cinq secondes, et le côté gauche repart d’autant plus tard', () => {
    const etape = serie(rowing, 8);
    expect(etatChangementCote(etape, 61, TEMPO, 5)).toEqual({ cote: 'gauche', resteSec: 5, dureeSec: 10 });
    expect(etatMetronome(etape, 61, TEMPO, 5)).toBeNull();
    expect(etatMetronome(etape, 66, TEMPO, 5)).toMatchObject({ rep: 1, cote: 'gauche', phase: 'monte' });
    // Deux appuis, dix secondes.
    expect(etatChangementCote(etape, 66, TEMPO, 10)).toMatchObject({ resteSec: 5, dureeSec: 15 });
    // La série prolongée finit sur sa dernière répétition, à gauche.
    expect(etatMetronome(etape, etape.dureeSec + 5 - 0.01, TEMPO, 5)).toMatchObject({ rep: 8, cote: 'gauche' });
    // La durée annoncée ne compte que les 5 s de base.
    expect(etape.dureeSec).toBe(117);
  });

  it('se glisse dans le temps fixe d’une station de circuit, s’il reste une répétition de chaque côté', () => {
    const station: Etape = { type: 'station', exerciceId: rowing.id, tour: 1, tours: 1, station: 1, stations: 1, dureeSec: 40 };
    // (40 − 5) / 7 = 5 répétitions : 3 à droite, le changement, 2 à gauche.
    expect(etatMetronome(station, 20.9, TEMPO)).toMatchObject({ rep: 3, totalReps: 3, cote: 'droit' });
    expect(etatChangementCote(station, 21, TEMPO)).toMatchObject({ resteSec: 5 });
    expect(etatMetronome(station, 26, TEMPO)).toMatchObject({ rep: 1, totalReps: 2, cote: 'gauche' });
    // Trop court pour changer de côté : comme avant, sans changement.
    const courte: Etape = { ...station, dureeSec: 15 };
    expect(etatChangementCote(courte, 7, TEMPO)).toBeNull();
    expect(etatMetronome(courte, 7, TEMPO)).toMatchObject({ rep: 1, totalReps: 1, cote: 'gauche' });
  });

  it('compte dans l’essai : la durée annoncée de l’essai est celle de ses étapes', () => {
    const seance: Seance = {
      id: 'essai-cotes',
      creeLe: '2026-10-11T10:00:00.000Z',
      parametres: { ...PARAMETRES_PAR_DEFAUT, tempo: TEMPO },
      graine: 1,
      echauffementSec: 120,
      retourCalmeSec: 120,
      blocs: [
        { exerciceId: 'single-arm-row', series: 3, reps: 8, reposSec: 60 },
        { exerciceId: 'kb-halo', series: 3, reps: 30, reposSec: 60 },
      ],
      circuit: null,
      dureeEstimeeSec: 0,
    };
    const essai = raccourcirPourEssai(seance);
    const etapes = construireEtapes(essai);
    expect(dureeTotaleSec(etapes)).toBe(essai.dureeEstimeeSec);
    // Six répétitions par côté (un tiers de moins), et toujours les 5 s.
    expect(etapes.find((e) => e.type === 'serie' && e.exerciceId === 'single-arm-row')?.dureeSec).toBe(6 * 7 * 2 + 5);
  });
});

describe('le changement de côté à deux, sur l’horloge commune', () => {
  /** Une séance du programme à deux : le rowing à un bras en paire avec un
   *  autre exercice, chacun ses répétitions. */
  const aDeux = (blocs: Seance['blocs']): Seance => ({
    id: 'duo-cotes',
    creeLe: '2026-10-11T10:00:00.000Z',
    titre: 'Duo',
    parametres: { ...PARAMETRES_PAR_DEFAUT, tempo: TEMPO },
    graine: 1,
    echauffementSec: 0,
    retourCalmeSec: 60,
    horloge: { personne: 'sebastien', partenaire: 'Big Max', jeCommence: true },
    blocs,
    circuit: null,
    dureeEstimeeSec: 0,
  });
  const debuts = (etapes: Etape[]) => {
    let t = 0;
    return etapes.map((e) => {
      const debut = t;
      t += e.dureeSec;
      return debut;
    });
  };
  const instantsGo = (etapes: Etape[]) => {
    const d = debuts(etapes);
    return etapes.flatMap((e, i) => (e.type === 'repos' && e.manuel ? [d[i]] : []));
  };
  /** L'état commun après « Go » au premier exercice, à l'instant 0. */
  const etat = (): EtatCommun => {
    const depart = appliquer(null, { id: 'c', a: 0, action: { type: 'commencer' } })!;
    return appliquer(depart, { id: 'g', a: 0, action: { type: 'go', groupe: 0 } })!;
  };
  /** Le contexte d'un téléphone à l'instant `sec` après « Go ». */
  const contexte = (etapes: Etape[], etapesAutre: Etape[], sec: number, tempo?: Tempo): Contexte => ({
    etapes,
    etapesAutre,
    etat: etat(),
    t: sec * 1000,
    position: positionCommune(etapes, etat(), sec * 1000),
    partenaire: 'Big Max',
    ...(tempo ? { tempo } : {}),
  });
  /** Le début du changement de côté de la première série de rowing. */
  const changementDe = (etapes: Etape[]) => {
    const i = etapes.findIndex((e) => e.type === 'serie' && e.exerciceId === 'single-arm-row');
    const debut = debuts(etapes)[i] - debuts(etapes)[etapes.findIndex((e) => e.type === 'repos' && e.manuel) + 1];
    return debut + 8 * 7;
  };

  it('côte à côte, les mêmes répétitions : les deux téléphones changent de côté à la même seconde', () => {
    const moi = aDeux([{ exerciceId: 'single-arm-row', series: 2, reps: 8, reposSec: 60, autre: { series: 2, reps: 8 } }]);
    const [miennes, siennes] = [construireEtapes(moi), construireEtapes(perspectiveAutre(moi)!)];
    expect(dureeTotaleSec(miennes)).toBe(dureeTotaleSec(siennes));
    expect(instantsGo(miennes)).toEqual(instantsGo(siennes));
    const t = changementDe(miennes) + 1;
    for (const etapes of [miennes, siennes]) {
      const { index, ecouleSec } = positionCommune(etapes, etat(), t * 1000);
      expect(etatChangementCote(etapes[index], ecouleSec, TEMPO)).toMatchObject({ resteSec: 4 });
    }
    // « +5 s » : l'autre change de côté aussi, l'horloge s'arrête pour les deux.
    expect(decisionProlonger(contexte(miennes, siennes, t, TEMPO), CHANGER_DE_COTE_SEC)).toEqual({
      genre: 'commune',
      action: { type: 'prolonger', sec: 5 },
    });
    // Sans le tempo, on ne sait pas qu'il change de côté : on le croit en série.
    expect(decisionProlonger(contexte(miennes, siennes, t), 5)).toMatchObject({ genre: 'refus' });
    // L'horloge arrêtée cinq secondes : les deux comptes à rebours attendent,
    // puis les deux côtés gauches partent ensemble, cinq secondes plus tard.
    const prolonge = appliquer(etat(), { id: 'p', a: t * 1000, action: { type: 'prolonger', sec: 5 } })!;
    for (const etapes of [miennes, siennes]) {
      const pendant = positionCommune(etapes, prolonge, (t + 5) * 1000);
      expect(etatChangementCote(etapes[pendant.index], pendant.ecouleSec, TEMPO), 'figé').toMatchObject({ resteSec: 4 });
      const apres = positionCommune(etapes, prolonge, (t + 9) * 1000);
      expect(etatMetronome(etapes[apres.index], apres.ecouleSec, TEMPO), 'côté gauche').toMatchObject({ rep: 1, cote: 'gauche' });
    }
  });

  it('refuse « +5 s » quand l’autre est en pleine série : sa série s’allongerait', () => {
    // Big Max fait 10 répétitions : quand Sébastien change de côté, il en est encore au côté droit.
    const moi = aDeux([{ exerciceId: 'single-arm-row', series: 2, reps: 8, reposSec: 60, autre: { series: 2, reps: 10 } }]);
    const [miennes, siennes] = [construireEtapes(moi), construireEtapes(perspectiveAutre(moi)!)];
    const t = changementDe(miennes) + 1;
    const { index, ecouleSec } = positionCommune(miennes, etat(), t * 1000);
    expect(etatChangementCote(miennes[index], ecouleSec, TEMPO)).not.toBeNull();
    expect(decisionProlonger(contexte(miennes, siennes, t, TEMPO), 5)).toEqual({
      genre: 'refus',
      raison: 'Big Max est en pleine série.',
    });
  });

  it('reste juste quand un seul des deux exercices d’une paire croisée est unilatéral', () => {
    // On se croise : Big Max à la machine pendant que Sébastien fait son
    // rowing à un bras, puis on échange. Le changement de côté allonge la
    // série du rowing sur les deux téléphones à la fois.
    const moi = aDeux([
      { exerciceId: 'leg-extension-machine', series: 3, reps: 8, reposSec: 60, superset: 1, tour: true, autre: { series: 3, reps: 10 } },
      { exerciceId: 'single-arm-row', series: 3, reps: 8, reposSec: 60, superset: 1, autre: { series: 3, reps: 10 } },
    ]);
    const [miennes, siennes] = [construireEtapes(moi), construireEtapes(perspectiveAutre(moi)!)];
    expect(dureeTotaleSec(miennes)).toBe(dureeTotaleSec(siennes));
    expect(instantsGo(miennes)).toEqual(instantsGo(siennes));
    const rowings = miennes.filter((e) => e.type === 'serie' && e.exerciceId === 'single-arm-row');
    expect(rowings.every((e) => e.dureeSec === 8 * 7 * 2 + 5)).toBe(true);
    // Pendant mon changement de côté, Big Max est à la machine, en pleine série : « +5 s » refusé.
    const t = changementDe(miennes) + 1;
    expect(decisionProlonger(contexte(miennes, siennes, t, TEMPO), 5)).toMatchObject({ genre: 'refus' });
  });
});

describe('ce que la relecture des 151 exercices a corrigé', () => {
  it('fait partir chacun de sa position de départ : debout, on descend d’abord ; bras tendus ou dans le squat, on monte', () => {
    for (const id of ['kb-good-morning', 'kb-single-leg-deadlift', 'dumbbell-burpee', 'hollow-fly', 'hollow-pullover']) {
      expect(premierePhase(EXERCICES_PAR_ID[id]), id).toBe('descend');
    }
    for (const id of ['kb-low-side-step-row', 'kb-frog-jump', 'bow-extension']) {
      expect(premierePhase(EXERCICES_PAR_ID[id]), id).toBe('monte');
    }
  });

  it('dit pareil les deux crunchs debout, genou vers la charge : MONTE, TIENS serré, DESCENDS', () => {
    for (const id of ['bow-extension', 'kb-high-knee-crunch']) {
      const exercice = EXERCICES_PAR_ID[id];
      const phases = phasesDeRep(tempoPourExercice(exercice, TEMPO), premierePhase(exercice));
      expect(phases.map((p) => motDePhase(p.phase, exercice)), id).toEqual(['MONTE', 'TIENS', 'DESCENDS']);
    }
  });

  it('ne s’arrête plus en bas des squats et fentes qui le faisaient encore, ni des bûcherons', () => {
    for (const id of [
      'cossack-squat', 'kb-bob-and-weave', 'kb-overhead-squat', 'kb-pistol-bench-squat', 'bulgarian-lunge',
      'side-lunge-thruster', 'kb-low-side-step-row',
    ]) {
      expect([EXERCICES_PAR_ID[id].sansPauseEnBas, EXERCICES_PAR_ID[id].genouAMenager], id).toEqual([true, true]);
    }
    for (const id of ['single-leg-deadlift-db', 'woodchop', 'kb-wood-chop']) {
      expect(EXERCICES_PAR_ID[id].sansPauseEnBas, id).toBe(true);
    }
  });

  it('ne fait jamais tenir un mouvement explosif : un geste balistique ne s’arrête pas', () => {
    const explosifs = EXERCICES.filter((e) => e.explosif);
    expect(explosifs.length).toBeGreaterThan(10);
    for (const exercice of explosifs) {
      for (const tempo of TEMPOS) expect(tempoPourExercice(exercice, tempo).pauseSec ?? 0, exercice.id).toBe(0);
    }
  });
});
