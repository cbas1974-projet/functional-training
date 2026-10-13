import { describe, expect, it } from 'vitest';
import { EXERCICES, EXERCICES_PAR_ID } from '../data/exercices';
import { GRANDES_ZONES, grandesZonesDe, memeZone, zoneCommune } from './zones';
import { accordPaire, candidatsProgramme, MATERIELS_PROGRAMME } from './programmeMois';

const zones = (id: string) => grandesZonesDe(EXERCICES_PAR_ID[id]);

describe('les trois grandes zones : le haut du corps, le bas du corps, le tronc', () => {
  it('se lisent dans la zone de la fiche : le haut, le bas, le gainage', () => {
    expect(GRANDES_ZONES).toEqual(['haut', 'bas', 'tronc']);
    for (const id of ['bench-press', 'hammer-curl', 'side-raise', 'tricep-extension']) expect(zones(id), id).toEqual(['haut']);
    for (const id of ['goblet-squat', 'leg-extension-machine', 'calf-raise', 'copenhagen-plank', 'trap-bar-deadlift']) {
      expect(zones(id), id).toEqual(['bas']);
    }
    for (const id of ['kb-around-the-body', 'kb-plank-oblique-pull-through', 'kb-half-turkish-get-up']) expect(zones(id), id).toEqual(['tronc']);
  });

  it('le « dos » de la fiche : les rowings sont le haut du corps, le Superman le tronc', () => {
    for (const id of ['incline-row', 'single-arm-row', 'bent-over-row', 'floor-t-raise', 'kb-rear-fly', 'upright-row']) {
      expect(zones(id), id).toEqual(['haut']);
    }
    expect(zones('superman')).toEqual(['tronc']);
    expect(zones('kb-superman')).toEqual(['tronc']);
  });

  it('le corps entier prend les zones de ses muscles ; le bas du dos est toujours du tronc', () => {
    expect(zones('kb-double-arm-swing')).toEqual(['bas']);
    expect(zones('traineau')).toEqual(['bas']);
    expect(zones('thruster')).toEqual(['haut', 'bas']);
    expect(zones('kb-wall-squat-press')).toEqual(['haut', 'bas']);
    expect(zones('woodchop')).toEqual(['tronc']);
    expect(zones('farmers-walk')).toEqual(['haut']);
    // Le good morning, rangé avec les jambes, vise le bas du dos.
    expect(zones('kb-good-morning')).toEqual(['bas', 'tronc']);
  });

  it('chaque exercice de musculation a au moins une zone', () => {
    for (const exercice of EXERCICES.filter((e) => (e.famille ?? 'musculation') === 'musculation')) {
      expect(grandesZonesDe(exercice).length, exercice.id).toBeGreaterThan(0);
    }
  });

  it('deux exercices de la même zone ne se jumellent jamais', () => {
    expect(memeZone(EXERCICES_PAR_ID['bench-press'], EXERCICES_PAR_ID['incline-row'])).toBe(true);
    expect(zoneCommune(EXERCICES_PAR_ID['bench-press'], EXERCICES_PAR_ID['incline-row'])).toBe('haut');
    expect(zoneCommune(EXERCICES_PAR_ID['thruster'], EXERCICES_PAR_ID['calf-raise'])).toBe('bas');
    expect(zoneCommune(EXERCICES_PAR_ID['bench-press'], EXERCICES_PAR_ID['calf-raise'])).toBeNull();
    // Toutes les paires possibles parmi les exercices du programme : même
    // zone, jamais « bon ».
    const candidats = candidatsProgramme(MATERIELS_PROGRAMME);
    for (const a of candidats) {
      for (const b of candidats) {
        if (a === b || !memeZone(a, b)) continue;
        expect(accordPaire(a, b).accord, `${a.id} + ${b.id}`).not.toBe('bon');
      }
    }
  });
});
