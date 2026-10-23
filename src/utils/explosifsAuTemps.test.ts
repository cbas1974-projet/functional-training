// Les 16 mouvements explosifs, au temps : à son rythme, léger, sans métronome.
// 30 s la série pour les swings, arrachés, épaulé, tirage haut et balanciers
// (de chaque côté, avec les 5 s pour changer de côté, d'un seul bras), 20 s
// pour les sauts et le burpee. Seul, à deux sur l'horloge commune, en essai,
// en séance libre — et hors du programme du mois, sauf le swing à deux mains,
// qui ouvre le jeudi.
import { describe, expect, it } from 'vitest';
import { avecSurMesure } from './programmeMois';

// Ces tests décrivent les règles du générateur, sans le programme sur mesure.
avecSurMesure(false);
import type { Etape } from './etapesSeance';
import type { BlocSeries, FormatSeance, Niveau, Seance, SeanceDuMois, SeanceRealisee, StyleCircuit } from '../types';
import { CONSIGNE_EXPLOSIF_AU_TEMPS, EXERCICES, EXERCICES_PAR_ID, consignesDe } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import {
  construireEtapes,
  dureeTotaleSec,
  etatChangementCote,
  etatMaintien,
  etatMetronome,
} from './etapesSeance';
import { appliquer } from './etatCommun';
import type { EtatCommun } from './etatCommun';
import { raccourcirPourEssai } from './essai';
import {
  BALISTIQUE_SEC,
  CHANGER_DE_COTE_SEC,
  SAUT_SEC,
  dureeSerieSec,
  estCercleAuTemps,
  estExplosifAuTemps,
  estimerDureeSec,
  exercicesDisponibles,
  genererSeance,
  libelleBloc,
  partiesAuTemps,
  precisionAuTemps,
  remplacerExercice,
  secondesAuTemps,
  secondesImposees,
} from './generateurSeance';
import { perspectiveAutre, positionCommune } from './horlogeCommune';
import {
  candidatsProgramme,
  chargeReglable,
  dureeSec,
  genererProgramme,
  seancePourPersonne,
} from './programmeMois';
import type { ContexteSeance } from './programmeMois';
import { ajustementDeCharge, exercicesAEvaluer, propositionDeCharge } from './ressenti';

const TEMPO = PARAMETRES_PAR_DEFAUT.tempo;

/** Les neuf qui lancent une charge : 30 s la série. */
const BALISTIQUES = [
  'swing', 'high-pull', 'dumbbell-snatch', 'kb-double-arm-swing', 'kb-single-arm-swing', 'kb-snatch', 'kb-clean',
  'kb-golfer-swing', 'kb-side-swing',
];
/** Les sept qui quittent le sol : 20 s la série. */
const SAUTS = [
  'jump-squat', 'dumbbell-burpee', 'kb-jump-squat', 'kb-frog-jump', 'kb-power-jump-squat', 'kb-speed-skater',
  'kb-log-jump',
];
/** D'un seul bras : 30 s de chaque côté, et les 5 s pour changer de côté. */
const UN_BRAS = ['dumbbell-snatch', 'kb-single-arm-swing', 'kb-snatch', 'kb-clean', 'kb-golfer-swing', 'kb-side-swing'];
const TOUS = [...BALISTIQUES, ...SAUTS];

const serie = (exerciceId: string, reps: number): Extract<Etape, { type: 'serie' }> => ({
  type: 'serie',
  exerciceId,
  serie: 1,
  series: 1,
  reps,
  dureeSec: dureeSerieSec(EXERCICES_PAR_ID[exerciceId], reps, TEMPO),
});

/** Une séance du mois qu'un téléphone pourrait recevoir : deux à un bras, un
 *  swing à deux mains, deux sauts, la marche du fermier pour finir. Le
 *  programme n'en compose jamais — on la fait à la main pour vérifier les
 *  règles de poids et d'horloge. */
const MARDI: SeanceDuMois = {
  id: 'mardi-explosifs',
  nom: 'Mardi explosif',
  jour: 2,
  type: 'facile',
  format: 'series',
  partie: 'haut',
  exercices: ['kb-single-arm-swing', 'kb-snatch', 'kb-double-arm-swing', 'kb-jump-squat', 'kb-speed-skater'],
  finale: 'farmers-walk',
};
const LUNDI = new Date(2026, 9, 5);
const SEUL_SEB: ContexteSeance = { personne: 'sebastien' };
const SEUL_MAX: ContexteSeance = { personne: 'max' };
const DUO_SEB: ContexteSeance = { personne: 'sebastien', aDeux: true };
const DUO_MAX: ContexteSeance = { personne: 'max', aDeux: true };
const PARAMETRES = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' as const };

describe('les 16 explosifs, au temps', () => {
  it('sont seize, tous au temps, avec leurs deux durées nommées', () => {
    expect(BALISTIQUE_SEC).toBe(30);
    expect(SAUT_SEC).toBe(20);
    const explosifs = EXERCICES.filter((e) => e.explosif).map((e) => e.id);
    expect(explosifs.sort()).toEqual([...TOUS].sort());
    expect(explosifs).toHaveLength(16);
    for (const id of TOUS) {
      const exercice = EXERCICES_PAR_ID[id];
      expect(exercice.unite, id).toBe('secondes');
      expect(estExplosifAuTemps(exercice), id).toBe(true);
      // Ni cercle, ni forme : un décompte, pas de métronome.
      expect(estCercleAuTemps(exercice), id).toBe(false);
      expect(exercice.mouvement, id).toBeUndefined();
    }
    // Les sauts sont ceux qu'on marque, et eux seuls.
    expect(EXERCICES.filter((e) => e.saut).map((e) => e.id).sort()).toEqual([...SAUTS].sort());
    // Et aucun autre exercice n'est explosif sans l'être au temps.
    expect(EXERCICES.filter((e) => e.explosif && e.unite !== 'secondes')).toEqual([]);
  });

  it('30 s pour ce qui lance une charge, 20 s pour les sauts et le burpee', () => {
    for (const id of BALISTIQUES) expect(secondesImposees(EXERCICES_PAR_ID[id]), id).toBe(BALISTIQUE_SEC);
    for (const id of SAUTS) expect(secondesImposees(EXERCICES_PAR_ID[id]), id).toBe(SAUT_SEC);
    // Quelle que soit la tenue du niveau (30, 40, 45 s), c'est le temps de la fiche.
    for (const tenue of [30, 40, 45, 60]) {
      expect(secondesAuTemps(EXERCICES_PAR_ID['kb-snatch'], tenue)).toBe(30);
      expect(secondesAuTemps(EXERCICES_PAR_ID['kb-jump-squat'], tenue)).toBe(20);
      expect(secondesAuTemps(EXERCICES_PAR_ID['farmers-walk'], tenue)).toBe(tenue);
    }
    // Une tenue ou un portage, eux, ne sont pas imposés.
    for (const id of ['farmers-walk', 'kb-farmers-walk', 'traineau', 'kb-isometric-crunch', 'kb-turkish-get-up']) {
      expect(secondesImposees(EXERCICES_PAR_ID[id]), id).toBeNull();
    }
    // Un exercice en répétitions n'a pas de temps imposé non plus.
    expect(secondesImposees(EXERCICES_PAR_ID['hammer-curl'])).toBeNull();
  });

  it('durent exactement leur temps, quel que soit le tempo : d’un bloc, ou de chaque côté plus les 5 s', () => {
    const tempos = [TEMPO, { monteeSec: 4, descenteSec: 4, pauseSec: 2 }, { monteeSec: 2, descenteSec: 4 }];
    for (const tempo of tempos) {
      for (const id of TOUS) {
        const exercice = EXERCICES_PAR_ID[id];
        const secondes = secondesImposees(exercice)!;
        const attendu = UN_BRAS.includes(id) ? secondes * 2 + CHANGER_DE_COTE_SEC : secondes;
        expect(dureeSerieSec(exercice, secondes, tempo), id).toBe(attendu);
      }
    }
    expect(dureeSerieSec(EXERCICES_PAR_ID['swing'], 30, TEMPO)).toBe(30);
    expect(dureeSerieSec(EXERCICES_PAR_ID['kb-snatch'], 30, TEMPO)).toBe(65);
    expect(dureeSerieSec(EXERCICES_PAR_ID['kb-jump-squat'], 20, TEMPO)).toBe(20);
    expect(dureeSerieSec(EXERCICES_PAR_ID['kb-speed-skater'], 20, TEMPO)).toBe(20);
    expect(dureeSerieSec(EXERCICES_PAR_ID['kb-snatch'], 0, TEMPO)).toBe(0);
  });

  it('se disent « 30 s par côté » ou « 20 s », jamais en répétitions', () => {
    expect(partiesAuTemps(EXERCICES_PAR_ID['kb-snatch'])).toBe(2);
    expect(partiesAuTemps(EXERCICES_PAR_ID['swing'])).toBe(1);
    expect(partiesAuTemps(EXERCICES_PAR_ID['kb-speed-skater'])).toBe(1);
    expect(precisionAuTemps(EXERCICES_PAR_ID['kb-snatch'])).toBe(' par côté');
    expect(precisionAuTemps(EXERCICES_PAR_ID['swing'])).toBe('');
    const bloc = (exerciceId: string, reps: number): BlocSeries => ({ exerciceId, series: 3, reps, reposSec: 60 });
    expect(libelleBloc(bloc('kb-snatch', 30), EXERCICES_PAR_ID['kb-snatch'])).toBe('3 × 30 s par côté · repos 60 s');
    expect(libelleBloc(bloc('swing', 30), EXERCICES_PAR_ID['swing'])).toBe('3 × 30 s · repos 60 s');
    expect(libelleBloc(bloc('jump-squat', 20), EXERCICES_PAR_ID['jump-squat'])).toBe('3 × 20 s · repos 60 s');
  });

  it('disent « À ton rythme, léger : la qualité avant la vitesse », et plus que le tempo lent leur ne va pas', () => {
    expect(CONSIGNE_EXPLOSIF_AU_TEMPS).toBe('À ton rythme, léger : la qualité avant la vitesse');
    for (const id of TOUS) {
      const exercice = EXERCICES_PAR_ID[id];
      expect(consignesDe(exercice)[0], id).toBe(CONSIGNE_EXPLOSIF_AU_TEMPS);
      expect(consignesDe(exercice).filter((c) => /tempo lent/.test(c)), id).toEqual([]);
      expect(exercice.pointsAttention.length, id).toBeGreaterThanOrEqual(2);
    }
    // Une tenue ou un exercice en répétitions n'en parle pas.
    expect(consignesDe(EXERCICES_PAR_ID['farmers-walk'])).not.toContain(CONSIGNE_EXPLOSIF_AU_TEMPS);
    expect(consignesDe(EXERCICES_PAR_ID['hammer-curl'])).not.toContain(CONSIGNE_EXPLOSIF_AU_TEMPS);
  });

  it('ne sortent qu’avec l’option « explosifs » ; au programme, seul le swing à deux mains, en tête du jeudi', () => {
    const materiels = ['halteres', 'kettlebell', 'banc', 'tapis'] as const;
    const parametres = { ...PARAMETRES_PAR_DEFAUT, niveau: 'avance' as Niveau, materiels: [...materiels] };
    const sans = exercicesDisponibles({ ...parametres, explosifs: false }).map((e) => e.id);
    const avec = exercicesDisponibles({ ...parametres, explosifs: true }).map((e) => e.id);
    for (const id of TOUS) {
      expect(sans, id).not.toContain(id);
      expect(avec, id).toContain(id);
    }
    // Ni « Changer » ni le choix des autres places ne les prennent.
    expect(candidatsProgramme([...materiels, 'salle']).filter((e) => e.explosif)).toEqual([]);
    for (let graine = 1; graine <= 40; graine += 1) {
      for (const exercices of [4, 6, 8]) {
        const programme = genererProgramme({ graine, exercices, aujourdhui: LUNDI });
        for (const s of programme.seances) {
          const ids = [...s.exercices, s.finale ?? ''];
          const attendus = s.jour === 4 ? ['kb-double-arm-swing'] : [];
          expect(ids.filter((id) => TOUS.includes(id)), `${graine} ${exercices} ${s.id}`).toEqual(attendus);
          if (s.jour === 4) expect(s.exercices[0], `${graine} ${exercices} ${s.id}`).toBe('kb-double-arm-swing');
        }
      }
    }
  });
});

describe('un explosif d’un seul bras, au temps', () => {
  it('30 s à droite, CHANGE DE CÔTÉ 5 s, 30 s à gauche : ni métronome, ni sens', () => {
    for (const id of UN_BRAS) {
      const etape = serie(id, BALISTIQUE_SEC);
      expect(etape.dureeSec, id).toBe(65);
      expect(etatMaintien(etape, 0), id).toEqual({ cote: 'droit', resteSec: 30, partieSec: 30 });
      expect(etatMaintien(etape, 29.9), id).toMatchObject({ cote: 'droit' });
      // Entre les deux côtés : le changement de côté, pas de décompte de série.
      expect(etatMaintien(etape, 30), id).toBeNull();
      expect(etatChangementCote(etape, 30, TEMPO), id).toEqual({ cote: 'gauche', resteSec: 5, dureeSec: 5 });
      expect(etatChangementCote(etape, 34.5, TEMPO), id).toMatchObject({ resteSec: 0.5 });
      expect(etatChangementCote(etape, 35, TEMPO), id).toBeNull();
      expect(etatMaintien(etape, 35), id).toEqual({ cote: 'gauche', resteSec: 30, partieSec: 30 });
      expect(etatMaintien(etape, 64), id).toMatchObject({ cote: 'gauche', resteSec: 1 });
      for (let t = 0; t < etape.dureeSec; t += 0.5) {
        expect(etatMetronome(etape, t, TEMPO), `${id} ${t}`).toBeNull();
        // Chaque instant a un côté ou le changement : jamais un trou.
        expect(etatMaintien(etape, t) !== null || etatChangementCote(etape, t, TEMPO) !== null, `${id} ${t}`).toBe(true);
      }
    }
  });

  it('« +5 s » allonge le changement de côté, et le côté gauche repart d’autant plus tard', () => {
    const etape = serie('kb-snatch', 30);
    expect(etatChangementCote(etape, 35, TEMPO, 5)).toEqual({ cote: 'gauche', resteSec: 5, dureeSec: 10 });
    expect(etatMaintien(etape, 35, 5)).toBeNull();
    expect(etatMaintien(etape, 40, 5)).toEqual({ cote: 'gauche', resteSec: 30, partieSec: 30 });
    // La durée annoncée ne compte que les 5 s de base.
    expect(etape.dureeSec).toBe(65);
  });

  it('un explosif à deux bras, ou alterné, n’a qu’un décompte : ni côté, ni changement, ni métronome', () => {
    for (const id of TOUS.filter((i) => !UN_BRAS.includes(i))) {
      const etape = serie(id, secondesImposees(EXERCICES_PAR_ID[id])!);
      for (let t = 0; t < etape.dureeSec; t += 0.5) {
        expect(etatMaintien(etape, t), `${id} ${t}`).toBeNull();
        expect(etatChangementCote(etape, t, TEMPO), `${id} ${t}`).toBeNull();
        expect(etatMetronome(etape, t, TEMPO), `${id} ${t}`).toBeNull();
      }
    }
  });

  it('prend aussi ses 5 s dans une station de circuit, sauf à rythme libre', () => {
    const station = (rythme: 'tempo' | 'libre'): Etape => ({
      type: 'station',
      exerciceId: 'kb-single-arm-swing',
      tour: 1,
      tours: 2,
      station: 1,
      stations: 4,
      dureeSec: 45,
      rythme,
    });
    // 45 s : 20 s à droite, 5 s pour changer de côté, 20 s à gauche.
    const classique = station('tempo');
    expect(etatMaintien(classique, 0)).toEqual({ cote: 'droit', resteSec: 20, partieSec: 20 });
    expect(etatMaintien(classique, 19.9)).toMatchObject({ cote: 'droit' });
    expect(etatChangementCote(classique, 20, TEMPO)).toEqual({ cote: 'gauche', resteSec: 5, dureeSec: 5 });
    expect(etatMaintien(classique, 22)).toBeNull();
    expect(etatMaintien(classique, 25)).toEqual({ cote: 'gauche', resteSec: 20, partieSec: 20 });
    expect(etatMaintien(classique, 44)).toMatchObject({ cote: 'gauche', resteSec: 1 });
    // À rythme libre (enchaîné, tabata) : on joue d'un élan jusqu'au signal.
    const libre = station('libre');
    for (const t of [0, 10, 22, 30, 44]) {
      expect(etatMaintien(libre, t), `${t}`).toBeNull();
      expect(etatChangementCote(libre, t, TEMPO), `${t}`).toBeNull();
    }
  });
});

describe('les explosifs et le poids', () => {
  it('gardent la saisie du poids, Lourd / Correct / Léger et les crans de charge', () => {
    for (const id of TOUS) expect(chargeReglable(EXERCICES_PAR_ID[id]), id).toBe(true);
    // Les tenues et les portages gardent leur règle : c'est le temps qui compte.
    for (const id of ['farmers-walk', 'kb-farmers-walk', 'traineau', 'kb-isometric-crunch']) {
      expect(chargeReglable(EXERCICES_PAR_ID[id]), id).toBe(false);
    }
    expect(chargeReglable(EXERCICES_PAR_ID['hammer-curl'])).toBe(true);
    expect(chargeReglable(EXERCICES_PAR_ID['kb-halo'])).toBe(true);
  });

  it('au programme à la main : le cran du ressenti, comme les autres', () => {
    const seance = seancePourPersonne(
      MARDI,
      PARAMETRES,
      { ...SEUL_SEB, ressentis: { 'kb-snatch': 'leger', 'kb-jump-squat': 'lourd', 'farmers-walk': 'leger' } },
      LUNDI,
    );
    const bloc = (id: string) => seance.blocs.find((b) => b.exerciceId === id)!;
    expect(bloc('kb-snatch').ajustementRessenti).toBe(5);
    expect(bloc('kb-jump-squat').ajustementRessenti).toBe(-5);
    expect(ajustementDeCharge(bloc('kb-snatch'))).toMatchObject({ motif: 'leger', ajout: 5 });
    expect(ajustementDeCharge(bloc('kb-jump-squat'))).toMatchObject({ motif: 'lourd', ajout: -5 });
    // Le fermier, lui, ne se règle pas.
    expect(bloc('farmers-walk').ajustementRessenti).toBeUndefined();
  });

  it('proposent un cran de plus après deux « léger » au même poids, comme les autres', () => {
    const fait = (n: number, ressenti: 'leger' | 'lourd'): SeanceRealisee => ({
      id: `s${n}`,
      date: new Date(2026, 9, n, 12).toISOString(),
      parametres: PARAMETRES,
      dureePrevueSec: 3600,
      dureeReelleSec: 3600,
      terminee: true,
      exercices: [
        {
          exerciceId: 'kb-single-arm-swing',
          seriesPrevues: 3,
          seriesFaites: 3,
          reps: 30,
          dureeSec: 300,
          poids: 20,
          poidsParSerie: [20, 20, 20],
          ressenti,
        },
      ],
    });
    expect(propositionDeCharge([fait(9, 'leger'), fait(8, 'leger')], 'kb-single-arm-swing', 'lb', 'max')).toMatchObject({
      ressenti: 'leger',
      ajout: 5,
    });
    expect(propositionDeCharge([fait(9, 'lourd'), fait(8, 'lourd')], 'kb-single-arm-swing', 'lb', 'max')).toMatchObject({
      ressenti: 'lourd',
      ajout: -5,
    });
  });

  it('demandent le ressenti après la dernière série, comme tous les exercices avec une charge', () => {
    const seance = seancePourPersonne(MARDI, PARAMETRES, SEUL_SEB, LUNDI);
    const etapes = construireEtapes(seance);
    // La pause qui suit la dernière série du swing à un bras.
    const series = etapes.flatMap((e, i) => (e.type === 'serie' && e.exerciceId === 'kb-single-arm-swing' ? [i] : []));
    const derniere = series[series.length - 1];
    const apres = etapes.findIndex((e, i) => i > derniere && e.type === 'repos');
    expect(exercicesAEvaluer(etapes, apres)).toEqual(['kb-single-arm-swing']);
  });
});

describe('les explosifs au programme à la main : mêmes secondes pour les deux, durées exactes', () => {
  it('le même temps pour Speedy et Big Max : leurs répétitions ne comptent pas au temps', () => {
    for (const contexte of [SEUL_SEB, SEUL_MAX, DUO_SEB, DUO_MAX, { ...SEUL_MAX, reps: { max: 12 } }]) {
      const seance = seancePourPersonne(MARDI, PARAMETRES, contexte, LUNDI);
      for (const id of MARDI.exercices) {
        const bloc = seance.blocs.find((b) => b.exerciceId === id)!;
        const attendu = secondesImposees(EXERCICES_PAR_ID[id])!;
        expect(bloc.reps, id).toBe(attendu);
        if (bloc.autre) expect(bloc.autre.reps, id).toBe(attendu);
      }
    }
  });

  it('annonce exactement la durée de ses étapes, seul comme à deux, avec les 5 s des deux bras', () => {
    for (const contexte of [SEUL_SEB, SEUL_MAX, DUO_SEB, DUO_MAX]) {
      const seance = seancePourPersonne(MARDI, PARAMETRES, contexte, LUNDI);
      const etapes = construireEtapes(seance);
      expect(dureeTotaleSec(etapes)).toBe(seance.dureeEstimeeSec);
      expect(dureeSec(MARDI, PARAMETRES, contexte)).toBe(seance.dureeEstimeeSec);
      const duree = (id: string) =>
        etapes.filter((e) => e.type === 'serie' && e.exerciceId === id).map((e) => e.dureeSec);
      expect(duree('kb-single-arm-swing')).toEqual([65, 65, 65]);
      expect(duree('kb-snatch')).toEqual([65, 65, 65]);
      expect(duree('kb-double-arm-swing')).toEqual([30, 30, 30]);
      expect(duree('kb-jump-squat')).toEqual([20, 20, 20]);
      expect(duree('kb-speed-skater')).toEqual([20, 20, 20]);
    }
  });
});

describe('les explosifs à deux, sur l’horloge commune', () => {
  const debuts = (etapes: Etape[]) => {
    let t = 0;
    return etapes.map((e) => {
      const debut = t;
      t += e.dureeSec;
      return debut;
    });
  };
  /** Les deux téléphones après « Go » au premier exercice, à l'instant 0. */
  const etat = (): EtatCommun => {
    const depart = appliquer(null, { id: 'c', a: 0, action: { type: 'commencer' } })!;
    return appliquer(depart, { id: 'g', a: 0, action: { type: 'go', groupe: 0 } })!;
  };
  const debutDuSwing = (etapes: Etape[]) => {
    const d = debuts(etapes);
    const go = etapes.findIndex((e) => e.type === 'repos' && e.manuel);
    return d[etapes.findIndex((e) => e.type === 'serie' && e.exerciceId === 'kb-single-arm-swing')] - d[go + 1];
  };

  it('les deux téléphones changent de côté à la même seconde, et durent autant', () => {
    const seance = seancePourPersonne(MARDI, PARAMETRES, DUO_SEB, LUNDI);
    const miennes = construireEtapes({ ...seance, echauffementSec: 0 });
    const siennes = construireEtapes(perspectiveAutre({ ...seance, echauffementSec: 0 })!);
    expect(dureeTotaleSec(miennes)).toBe(dureeTotaleSec(siennes));
    const sienne = seancePourPersonne(MARDI, PARAMETRES, DUO_MAX, LUNDI);
    expect(dureeTotaleSec(construireEtapes(sienne))).toBe(seance.dureeEstimeeSec);
    const debut = debutDuSwing(miennes);
    expect(debutDuSwing(siennes)).toBe(debut);
    const lire = (etapes: Etape[], sec: number) => {
      const { index, ecouleSec } = positionCommune(etapes, etat(), sec * 1000);
      return { maintien: etatMaintien(etapes[index], ecouleSec), changement: etatChangementCote(etapes[index], ecouleSec, TEMPO) };
    };
    for (const etapes of [miennes, siennes]) {
      expect(lire(etapes, debut + 29).maintien, 'côté droit').toMatchObject({ cote: 'droit', resteSec: 1 });
      expect(lire(etapes, debut + 31).maintien, 'on change').toBeNull();
      expect(lire(etapes, debut + 31).changement, 'on change').toMatchObject({ cote: 'gauche', resteSec: 4 });
      expect(lire(etapes, debut + 45).maintien, 'côté gauche').toMatchObject({ cote: 'gauche', resteSec: 20 });
    }
  });
});

describe('les explosifs à l’essai', () => {
  it('se raccourcissent d’un tiers comme les autres exercices au temps : 20 s et 14 s, et la durée annoncée suit', () => {
    for (const contexte of [SEUL_SEB, DUO_SEB, DUO_MAX]) {
      const essai = raccourcirPourEssai(seancePourPersonne(MARDI, PARAMETRES, contexte, LUNDI));
      const etapes = construireEtapes(essai);
      expect(dureeTotaleSec(etapes)).toBe(essai.dureeEstimeeSec);
      const reps = (id: string) => essai.blocs.find((b) => b.exerciceId === id)!;
      expect(reps('kb-single-arm-swing').reps).toBe(20);
      expect(reps('kb-double-arm-swing').reps).toBe(20);
      expect(reps('kb-jump-squat').reps).toBe(14);
      if (reps('kb-snatch').autre) expect(reps('kb-snatch').autre).toEqual({ series: 1, reps: 20 });
      const duree = (id: string) => etapes.filter((e) => e.type === 'serie' && e.exerciceId === id).map((e) => e.dureeSec);
      // Une seule série ; d'un bras, 20 s de chaque côté et toujours les 5 s.
      expect(duree('kb-single-arm-swing')).toEqual([20 * 2 + 5]);
      expect(duree('kb-double-arm-swing')).toEqual([20]);
      expect(duree('kb-jump-squat')).toEqual([14]);
      const bras = etapes.find((e) => e.type === 'serie' && e.exerciceId === 'kb-single-arm-swing')!;
      expect(etatChangementCote(bras, 20, TEMPO)).toMatchObject({ cote: 'gauche', resteSec: 5 });
      expect(etatMaintien(bras, 25)).toMatchObject({ cote: 'gauche', resteSec: 20 });
    }
  });
});

describe('les explosifs en séance libre', () => {
  const FORMATS: FormatSeance[] = ['series', 'superset', 'circuit', 'mixte'];
  const STYLES: StyleCircuit[] = ['classique', 'enchaine', 'tabata'];
  const blocsExplosifs = (seance: Seance) => seance.blocs.filter((b) => TOUS.includes(b.exerciceId));

  it('prennent 30 s ou 20 s à tous les niveaux, pas la tenue du niveau, et la durée annoncée est celle des étapes', () => {
    const niveaux: Niveau[] = ['intermediaire', 'avance'];
    const vus = new Set<string>();
    const stations = new Set<string>();
    for (const niveau of niveaux) {
      for (const [format, style] of FORMATS.flatMap((f) => STYLES.map((st): [FormatSeance, StyleCircuit] => [f, st]))) {
        for (let graine = 1; graine <= 30; graine += 1) {
          const seance = genererSeance(
            {
              ...PARAMETRES_PAR_DEFAUT,
              niveau,
              format,
              styleCircuit: style,
              dureeMinutes: 45,
              materiels: ['kettlebell', 'halteres', 'banc', 'tapis'],
              explosifs: true,
            },
            graine,
          );
          const cle = `${niveau} ${format} ${style} ${graine}`;
          // Une station de circuit garde le temps du circuit ; d'un seul bras,
          // elle prend ses 5 s pour changer de côté — sauf à rythme libre.
          for (const etape of construireEtapes(seance)) {
            if (etape.type !== 'station' || !TOUS.includes(etape.exerciceId)) continue;
            stations.add(`${etape.rythme}-${etape.exerciceId}`);
            expect(etape.dureeSec, cle).toBe(seance.circuit!.travailSec);
            if (!UN_BRAS.includes(etape.exerciceId)) continue;
            const debut = etatMaintien(etape, 0);
            if (etape.rythme === 'libre') expect(debut, cle).toBeNull();
            else expect(debut, cle).toMatchObject({ cote: 'droit' });
          }
          expect(dureeTotaleSec(construireEtapes(seance)), cle).toBe(estimerDureeSec(seance));
          expect(seance.dureeEstimeeSec, cle).toBe(estimerDureeSec(seance));
          for (const bloc of blocsExplosifs(seance)) {
            vus.add(bloc.exerciceId);
            expect(bloc.reps, `${cle} ${bloc.exerciceId}`).toBe(secondesImposees(EXERCICES_PAR_ID[bloc.exerciceId]));
            // Remplacé par un autre exercice, puis remis : toujours le bon temps.
            const autre = remplacerExercice(seance, bloc.exerciceId, graine);
            const remplacant = autre.blocs[seance.blocs.indexOf(bloc)];
            const exercice = EXERCICES_PAR_ID[remplacant.exerciceId];
            if (exercice.unite === 'secondes') {
              expect(remplacant.reps, `${cle} → ${remplacant.exerciceId}`).toBe(
                secondesImposees(exercice) ?? { intermediaire: 40, avance: 45, debutant: 30 }[niveau],
              );
            }
            expect(dureeTotaleSec(construireEtapes(autre)), `${cle} remplacé`).toBe(estimerDureeSec(autre));
          }
        }
      }
    }
    // De quoi vérifier les deux durées, et un exercice d'un seul bras.
    expect(vus.size).toBeGreaterThanOrEqual(6);
    expect([...vus].some((id) => SAUTS.includes(id))).toBe(true);
    expect([...vus].some((id) => BALISTIQUES.includes(id))).toBe(true);
    expect([...vus].some((id) => UN_BRAS.includes(id))).toBe(true);
    // Et des explosifs en station de circuit, à rythme libre ou au tempo.
    expect([...stations].some((station) => station.startsWith('libre-'))).toBe(true);
    expect([...stations].some((station) => station.startsWith('tempo-') && UN_BRAS.some((id) => station.endsWith(id)))).toBe(true);
  });

  it('après un remplacement, le temps suit le nouvel exercice : celui de sa fiche, ou la tenue du niveau', () => {
    const seance = (ids: string[]): Seance => ({
      id: 'x',
      creeLe: '2026-10-11T10:00:00.000Z',
      parametres: {
        ...PARAMETRES_PAR_DEFAUT,
        niveau: 'avance',
        zones: ['complet'],
        materiels: ['kettlebell', 'halteres', 'banc', 'tapis'],
        explosifs: true,
      },
      graine: 1,
      echauffementSec: 60,
      retourCalmeSec: 60,
      blocs: ids.map((exerciceId) => ({
        exerciceId,
        series: 3,
        reps: secondesImposees(EXERCICES_PAR_ID[exerciceId]) ?? 45,
        reposSec: 60,
      })),
      circuit: null,
      dureeEstimeeSec: 0,
    });
    const departs: [string[], string][] = [
      // Une tenue remplacée : par un explosif, ou par un autre exercice.
      [['farmers-walk', 'kb-farmers-walk'], 'farmers-walk'],
      // Un explosif remplacé : par un autre explosif, une tenue, ou des répétitions.
      [['kb-double-arm-swing', 'kb-snatch'], 'kb-double-arm-swing'],
      [['kb-jump-squat', 'kb-clean'], 'kb-jump-squat'],
    ];
    const vus = { explosif: 0, tenue: 0, repetitions: 0 };
    for (const [ids, remplace] of departs) {
      for (let graine = 1; graine <= 80; graine += 1) {
        const apres = remplacerExercice(seance(ids), remplace, graine);
        const remplacant = apres.blocs[ids.indexOf(remplace)];
        const exercice = EXERCICES_PAR_ID[remplacant.exerciceId];
        const cle = `${remplace} → ${remplacant.exerciceId} (${graine})`;
        if (secondesImposees(exercice) !== null) {
          vus.explosif += 1;
          expect(remplacant.reps, cle).toBe(secondesImposees(exercice));
        } else if (exercice.unite === 'secondes') {
          vus.tenue += 1;
          expect(remplacant.reps, cle).toBe(45);
        } else {
          vus.repetitions += 1;
          expect(remplacant.reps, cle).toBe(8);
        }
        expect(dureeTotaleSec(construireEtapes(apres)), cle).toBe(estimerDureeSec(apres));
      }
    }
    expect(vus.explosif).toBeGreaterThan(0);
    expect(vus.tenue + vus.repetitions).toBeGreaterThan(0);
  });

  it('une séance sans l’option n’en contient aucun', () => {
    for (let graine = 1; graine <= 30; graine += 1) {
      const seance = genererSeance(
        { ...PARAMETRES_PAR_DEFAUT, niveau: 'avance', dureeMinutes: 45, materiels: ['kettlebell', 'halteres'], explosifs: false },
        graine,
      );
      expect(blocsExplosifs(seance), `${graine}`).toEqual([]);
    }
  });
});
