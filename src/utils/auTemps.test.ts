// Au temps plutôt qu'au tempo : les trois cercles du kettlebell (30 s dans un
// sens, « Change de sens ! » sans s'arrêter, 30 s dans l'autre) et le relevé
// turc (un côté, le changement de côté, l'autre). Seul, à deux sur l'horloge
// commune, en essai, au programme et en séance libre.
import { describe, expect, it } from 'vitest';
import type { Etape } from './etapesSeance';
import type { Niveau, Seance, SeanceDuMois } from '../types';
import { CONSIGNE_CERCLE_AU_TEMPS, EXERCICES, EXERCICES_PAR_ID, consignesDe } from '../data/exercices';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import {
  ANNONCE_CHANGE_DE_SENS_SEC,
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
  CHANGER_DE_COTE_SEC,
  SENS_CERCLE_SEC,
  dureeSerieSec,
  estCercleAuTemps,
  estimerDureeSec,
  genererSeance,
  libelleBloc,
  partiesAuTemps,
  precisionAuTemps,
  remplacerExercice,
} from './generateurSeance';
import { perspectiveAutre, positionCommune } from './horlogeCommune';
import { chargeReglable, dureeSec, seancePourPersonne } from './programmeMois';
import type { ContexteSeance } from './programmeMois';

const TEMPO = PARAMETRES_PAR_DEFAUT.tempo;
const CERCLES = ['kb-halo', 'kb-around-the-body', 'kb-around-the-world'];
const halo = EXERCICES_PAR_ID['kb-halo'];
const releve = EXERCICES_PAR_ID['kb-turkish-get-up'];

const serie = (exerciceId: string, reps: number): Extract<Etape, { type: 'serie' }> => ({
  type: 'serie',
  exerciceId,
  serie: 1,
  series: 1,
  reps,
  dureeSec: dureeSerieSec(EXERCICES_PAR_ID[exerciceId], reps, TEMPO),
});

/** Mardi : le halo en paire avec un rowing, la marche du fermier pour finir. */
const MARDI: SeanceDuMois = {
  id: 'mardi-cercles',
  nom: 'Mardi des cercles',
  jour: 2,
  type: 'facile',
  format: 'series',
  partie: 'haut',
  exercices: ['kb-halo', 'incline-row', 'kb-around-the-body', 'hammer-curl'],
  finale: 'farmers-walk',
  liens: [
    ['kb-halo', 'incline-row'],
    ['kb-around-the-body', 'hammer-curl'],
  ],
};
const LUNDI = new Date(2026, 9, 5);
const SEUL_SEB: ContexteSeance = { personne: 'sebastien' };
const SEUL_MAX: ContexteSeance = { personne: 'max' };
const DUO_SEB: ContexteSeance = { personne: 'sebastien', aDeux: true };
const DUO_MAX: ContexteSeance = { personne: 'max', aDeux: true };
const PARAMETRES = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' as const };

describe('les cercles du kettlebell, au temps', () => {
  it('se font au temps, 30 s dans chaque sens : le tour de taille, le halo, le tour du monde', () => {
    expect(SENS_CERCLE_SEC).toBe(30);
    for (const id of CERCLES) {
      const exercice = EXERCICES_PAR_ID[id];
      expect([exercice.unite, exercice.mouvement], id).toEqual(['secondes', 'circulaire']);
      expect(estCercleAuTemps(exercice), id).toBe(true);
      expect(partiesAuTemps(exercice), id).toBe(2);
      expect(precisionAuTemps(exercice), id).toBe(' dans chaque sens');
      // Une minute par série, quel que soit le tempo.
      expect(dureeSerieSec(exercice, SENS_CERCLE_SEC, TEMPO), id).toBe(60);
      expect(dureeSerieSec(exercice, SENS_CERCLE_SEC, { monteeSec: 4, descenteSec: 4, pauseSec: 2 }), id).toBe(60);
      expect(consignesDe(exercice)[0], id).toBe(CONSIGNE_CERCLE_AU_TEMPS);
    }
    // Eux seuls : les rotations et les autres exercices au temps ne changent pas de sens.
    expect(EXERCICES.filter(estCercleAuTemps).map((e) => e.id).sort()).toEqual([...CERCLES].sort());
    expect(partiesAuTemps(EXERCICES_PAR_ID['farmers-walk'])).toBe(1);
  });

  it('change de sens à 30 s, d’un bip, sans s’arrêter : ni métronome, ni changement de côté', () => {
    const etape = serie('kb-halo', SENS_CERCLE_SEC);
    expect(etape.dureeSec).toBe(60);
    expect(etatMaintien(etape, 0)).toEqual({ sens: 'premier', resteSec: 30, partieSec: 30 });
    expect(etatMaintien(etape, 29.9)).toMatchObject({ sens: 'premier' });
    expect(etatMaintien(etape, 29.9)?.changeDeSens).toBeUndefined();
    // À 30 s : l'autre sens, annoncé trois secondes, et le décompte repart de 30.
    expect(ANNONCE_CHANGE_DE_SENS_SEC).toBe(3);
    expect(etatMaintien(etape, 30)).toEqual({ sens: 'second', changeDeSens: true, resteSec: 30, partieSec: 30 });
    expect(etatMaintien(etape, 32.9)).toMatchObject({ sens: 'second', changeDeSens: true });
    expect(etatMaintien(etape, 33)?.changeDeSens).toBeUndefined();
    expect(etatMaintien(etape, 59)).toMatchObject({ sens: 'second', resteSec: 1 });
    // Le temps ne s'arrête jamais : chaque instant a son sens, sans métronome
    // ni changement de côté.
    for (let t = 0; t < etape.dureeSec; t += 0.5) {
      expect(etatMaintien(etape, t), `${t}`).not.toBeNull();
      expect(etatMetronome(etape, t, TEMPO), `${t}`).toBeNull();
      expect(etatChangementCote(etape, t, TEMPO), `${t}`).toBeNull();
    }
  });

  it('change de sens à mi-temps d’une station de circuit, aussi', () => {
    const station: Etape = { type: 'station', exerciceId: 'kb-around-the-body', tour: 1, tours: 2, station: 1, stations: 3, dureeSec: 40 };
    expect(etatMaintien(station, 19)).toMatchObject({ sens: 'premier', resteSec: 1, partieSec: 20 });
    expect(etatMaintien(station, 20)).toMatchObject({ sens: 'second', changeDeSens: true, resteSec: 20 });
  });

  it('se dit « 30 s dans chaque sens » sur l’accueil et dans la séance libre', () => {
    expect(libelleBloc({ exerciceId: 'kb-halo', series: 3, reps: 30, reposSec: 60 }, halo)).toBe(
      '3 × 30 s dans chaque sens · repos 60 s',
    );
  });
});

describe('les cercles au programme', () => {
  it('le même temps pour Speedy et Big Max : leurs répétitions ne comptent pas au temps', () => {
    for (const contexte of [SEUL_SEB, SEUL_MAX, DUO_SEB, DUO_MAX, { ...SEUL_MAX, reps: { max: 12 } }]) {
      const seance = seancePourPersonne(MARDI, PARAMETRES, contexte, LUNDI);
      for (const id of ['kb-halo', 'kb-around-the-body']) {
        const bloc = seance.blocs.find((b) => b.exerciceId === id)!;
        expect(bloc.reps, id).toBe(SENS_CERCLE_SEC);
        if (bloc.autre) expect(bloc.autre.reps, id).toBe(SENS_CERCLE_SEC);
      }
    }
    // Les répétitions, elles, restent celles de chacun.
    const duo = seancePourPersonne(MARDI, PARAMETRES, DUO_SEB, LUNDI);
    const curl = duo.blocs.find((b) => b.exerciceId === 'hammer-curl')!;
    expect([curl.reps, curl.autre?.reps]).toEqual([8, 10]);
  });

  it('garde la série de plus de Big Max aux poussées : le halo travaille les épaules', () => {
    const duo = seancePourPersonne(MARDI, PARAMETRES, DUO_SEB, LUNDI);
    const bloc = duo.blocs.find((b) => b.exerciceId === 'kb-halo')!;
    expect([bloc.series, bloc.autre?.series]).toEqual([3, 4]);
    // Le tour de taille (gainage) : trois séries chacun.
    const taille = duo.blocs.find((b) => b.exerciceId === 'kb-around-the-body')!;
    expect([taille.series, taille.autre?.series]).toEqual([3, 3]);
  });

  it('garde la charge : notée, montée ou baissée au ressenti', () => {
    for (const id of CERCLES) expect(chargeReglable(EXERCICES_PAR_ID[id]), id).toBe(true);
    expect(chargeReglable(EXERCICES_PAR_ID['hammer-curl'])).toBe(true);
    // Les portages et les tenues gardent leur règle : c'est le temps qui compte.
    for (const id of ['farmers-walk', 'kb-farmers-walk', 'traineau', 'kb-isometric-crunch']) {
      expect(chargeReglable(EXERCICES_PAR_ID[id]), id).toBe(false);
    }
    const seance = seancePourPersonne(MARDI, PARAMETRES, { ...SEUL_SEB, ressentis: { 'kb-halo': 'leger' } }, LUNDI);
    const bloc = seance.blocs.find((b) => b.exerciceId === 'kb-halo')!;
    expect(bloc.ajustementRessenti).toBe(5);
    // Plus de dernière série à la moitié de la charge, le mardi.
    expect('derniereLegere' in bloc).toBe(false);
  });

  it('annonce exactement la durée de ses étapes, seul comme à deux', () => {
    for (const contexte of [SEUL_SEB, SEUL_MAX, DUO_SEB, DUO_MAX]) {
      const seance = seancePourPersonne(MARDI, PARAMETRES, contexte, LUNDI);
      const etapes = construireEtapes(seance);
      expect(dureeTotaleSec(etapes)).toBe(seance.dureeEstimeeSec);
      expect(dureeSec(MARDI, PARAMETRES, contexte)).toBe(seance.dureeEstimeeSec);
      // Chaque série de cercle dure une minute.
      const cercles = etapes.filter((e) => e.type === 'serie' && CERCLES.includes(e.exerciceId));
      expect(cercles.length).toBeGreaterThanOrEqual(6);
      expect(cercles.every((e) => e.dureeSec === 60)).toBe(true);
    }
  });
});

describe('les cercles à deux, sur l’horloge commune', () => {
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
  /** Le début de la première série de halo, compté depuis « Go ». */
  const debutHalo = (etapes: Etape[]) => {
    const d = debuts(etapes);
    const go = etapes.findIndex((e) => e.type === 'repos' && e.manuel);
    return d[etapes.findIndex((e) => e.type === 'serie' && e.exerciceId === 'kb-halo')] - d[go + 1];
  };

  it('les deux téléphones changent de sens à la même seconde, et durent autant', () => {
    const seance = seancePourPersonne(MARDI, PARAMETRES, DUO_SEB, LUNDI);
    const miennes = construireEtapes({ ...seance, echauffementSec: 0 });
    const siennes = construireEtapes(perspectiveAutre({ ...seance, echauffementSec: 0 })!);
    expect(dureeTotaleSec(miennes)).toBe(dureeTotaleSec(siennes));
    // Le téléphone de Big Max compte la même séance.
    const sienne = seancePourPersonne(MARDI, PARAMETRES, DUO_MAX, LUNDI);
    expect(dureeTotaleSec(construireEtapes(sienne))).toBe(seance.dureeEstimeeSec);
    const debut = debutHalo(miennes);
    expect(debutHalo(siennes)).toBe(debut);
    const lire = (etapes: Etape[], sec: number) => {
      const { index, ecouleSec } = positionCommune(etapes, etat(), sec * 1000);
      return etatMaintien(etapes[index], ecouleSec);
    };
    for (const etapes of [miennes, siennes]) {
      expect(lire(etapes, debut + 29), 'premier sens').toMatchObject({ sens: 'premier', resteSec: 1 });
      expect(lire(etapes, debut + 31), 'change de sens').toMatchObject({ sens: 'second', changeDeSens: true, resteSec: 29 });
      expect(lire(etapes, debut + 45), 'autre sens').toMatchObject({ sens: 'second', resteSec: 15 });
    }
  });
});

describe('les cercles à l’essai', () => {
  it('se raccourcissent comme les autres exercices au temps : 20 s dans chaque sens, et la durée annoncée suit', () => {
    for (const contexte of [SEUL_SEB, DUO_SEB, DUO_MAX]) {
      const essai = raccourcirPourEssai(seancePourPersonne(MARDI, PARAMETRES, contexte, LUNDI));
      const etapes = construireEtapes(essai);
      expect(dureeTotaleSec(etapes)).toBe(essai.dureeEstimeeSec);
      const bloc = essai.blocs.find((b) => b.exerciceId === 'kb-halo')!;
      expect(bloc.reps).toBe(20);
      if (bloc.autre) expect(bloc.autre).toEqual({ series: 1, reps: 20 });
      const seriesHalo = etapes.filter(
        (e): e is Extract<Etape, { type: 'serie' }> => e.type === 'serie' && e.exerciceId === 'kb-halo',
      );
      expect(seriesHalo).toHaveLength(1);
      expect(seriesHalo[0].dureeSec).toBe(40);
      expect(etatMaintien(seriesHalo[0], 20)).toMatchObject({ sens: 'second', changeDeSens: true, resteSec: 20 });
    }
  });
});

describe('les cercles en séance libre', () => {
  it('tournent 30 s dans chaque sens à tous les niveaux, quelle que soit la tenue du niveau', () => {
    const niveaux: Niveau[] = ['debutant', 'intermediaire', 'avance'];
    const vus = new Set<string>();
    for (const niveau of niveaux) {
      for (let graine = 1; graine <= 30; graine += 1) {
        const seance = genererSeance(
          { ...PARAMETRES_PAR_DEFAUT, niveau, dureeMinutes: 45, materiels: ['kettlebell', 'halteres'], zones: ['haut', 'gainage'] },
          graine,
        );
        expect(dureeTotaleSec(construireEtapes(seance)), `${niveau} ${graine}`).toBe(estimerDureeSec(seance));
        for (const bloc of seance.blocs.filter((b) => CERCLES.includes(b.exerciceId))) {
          vus.add(bloc.exerciceId);
          expect(bloc.reps, `${niveau} ${graine}`).toBe(SENS_CERCLE_SEC);
          // Remplacé par un autre exercice, puis remis : 30 s, toujours.
          const autre = remplacerExercice(seance, bloc.exerciceId, graine);
          const remplacant = autre.blocs[seance.blocs.indexOf(bloc)];
          if (estCercleAuTemps(EXERCICES_PAR_ID[remplacant.exerciceId])) expect(remplacant.reps).toBe(SENS_CERCLE_SEC);
        }
      }
    }
    expect(vus.size).toBeGreaterThan(0);
  });
});

describe('le relevé turc, au temps', () => {
  it('se fait au temps, de chaque côté, avec ses 5 s pour changer de côté', () => {
    expect([releve.unite, releve.cotes, releve.pauseEnHaut]).toEqual(['secondes', 'unilateral', undefined]);
    expect(releve.niveauMin).toBe(3);
    expect(dureeSerieSec(releve, 45, TEMPO)).toBe(45 * 2 + CHANGER_DE_COTE_SEC);
    const etape = serie('kb-turkish-get-up', 45);
    expect(etatMaintien(etape, 0)).toEqual({ cote: 'droit', resteSec: 45, partieSec: 45 });
    expect(etatMaintien(etape, 44.9)).toMatchObject({ cote: 'droit' });
    // Entre les deux côtés : CHANGE DE CÔTÉ, 5 s, comme en répétitions.
    expect(etatMaintien(etape, 45)).toBeNull();
    expect(etatChangementCote(etape, 45, TEMPO)).toEqual({ cote: 'gauche', resteSec: 5, dureeSec: 5 });
    expect(etatChangementCote(etape, 49.5, TEMPO)).toMatchObject({ resteSec: 0.5 });
    expect(etatMaintien(etape, 50)).toEqual({ cote: 'gauche', resteSec: 45, partieSec: 45 });
    expect(etatMaintien(etape, 94)).toMatchObject({ cote: 'gauche', resteSec: 1 });
    expect(etatMetronome(etape, 10, TEMPO)).toBeNull();
  });

  it('« +5 s » allonge le changement de côté, et le côté gauche repart d’autant plus tard', () => {
    const etape = serie('kb-turkish-get-up', 45);
    expect(etatChangementCote(etape, 50, TEMPO, 5)).toEqual({ cote: 'gauche', resteSec: 5, dureeSec: 10 });
    expect(etatMaintien(etape, 50, 5)).toBeNull();
    expect(etatMaintien(etape, 55, 5)).toEqual({ cote: 'gauche', resteSec: 45, partieSec: 45 });
  });

  it('compte son changement de côté dans la durée annoncée, en séance libre et à l’essai', () => {
    const seance: Seance = {
      id: 'releve',
      creeLe: '2026-10-11T10:00:00.000Z',
      parametres: { ...PARAMETRES_PAR_DEFAUT, niveau: 'avance' },
      graine: 1,
      echauffementSec: 60,
      retourCalmeSec: 60,
      blocs: [
        { exerciceId: 'kb-turkish-get-up', series: 2, reps: 45, reposSec: 60 },
        { exerciceId: 'kb-halo', series: 2, reps: 30, reposSec: 60 },
      ],
      circuit: null,
      dureeEstimeeSec: 0,
    };
    expect(dureeTotaleSec(construireEtapes(seance))).toBe(estimerDureeSec(seance));
    const essai = raccourcirPourEssai(seance);
    const etapes = construireEtapes(essai);
    expect(dureeTotaleSec(etapes)).toBe(essai.dureeEstimeeSec);
    // 30 s par côté (un tiers de moins), et toujours les 5 s.
    expect(etapes.find((e) => e.type === 'serie' && e.exerciceId === 'kb-turkish-get-up')?.dureeSec).toBe(30 * 2 + 5);
  });

  it('une position de yoga d’un seul côté enchaîne toujours ses deux côtés, sans changement', () => {
    const posture = EXERCICES.find((e) => e.famille === 'yoga' && e.cotes === 'unilateral')!;
    const etape = serie(posture.id, 30);
    expect(etape.dureeSec).toBe(60);
    expect(etatChangementCote(etape, 30, TEMPO)).toBeNull();
    expect(etatMaintien(etape, 30)).toEqual({ cote: 'gauche', resteSec: 30, partieSec: 30 });
  });
});
