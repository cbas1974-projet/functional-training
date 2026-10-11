import { describe, expect, it } from 'vitest';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { TEMPOS } from '../data/parametres';
import { libelleTempo, memeTempo } from './formatage';
import { tempoPourExercice } from './generateurSeance';

describe('libellés du tempo', () => {
  it('annonce la pause en bas quand il y en a une', () => {
    expect(libelleTempo({ monteeSec: 4, descenteSec: 4 })).toBe('4 s / 4 s');
    expect(libelleTempo({ monteeSec: 3, descenteSec: 3, pauseSec: 2 })).toBe('3 s / 3 s + 2 s en bas');
    expect(libelleTempo({ monteeSec: 4, descenteSec: 4, pauseSec: 0 })).toBe('4 s / 4 s');
  });

  it('annonce la pause en haut pour un exercice qui la tient en haut', () => {
    expect(libelleTempo({ monteeSec: 3, descenteSec: 3, pauseSec: 1, pauseEnHaut: true })).toBe('3 s / 3 s + 1 s en haut');
    expect(libelleTempo(tempoPourExercice(EXERCICES_PAR_ID['kb-superman'], { monteeSec: 3, descenteSec: 3, pauseSec: 2 }))).toBe(
      '3 s / 3 s + 2 s en haut',
    );
    expect(libelleTempo(tempoPourExercice(EXERCICES_PAR_ID['hammer-curl'], { monteeSec: 3, descenteSec: 3, pauseSec: 2 }))).toBe(
      '3 s / 3 s + 2 s en bas',
    );
    // Rien à tenir : rien à annoncer.
    expect(libelleTempo({ monteeSec: 4, descenteSec: 4, pauseEnHaut: true })).toBe('4 s / 4 s');
  });

  it('nomme chaque tempo proposé comme il s’affiche pendant la séance', () => {
    for (const { tempo, nom } of TEMPOS) expect(nom).toBe(libelleTempo(tempo));
  });

  it('distingue deux tempos qui ne diffèrent que par la pause', () => {
    expect(memeTempo({ monteeSec: 4, descenteSec: 4 }, { monteeSec: 4, descenteSec: 4, pauseSec: 2 })).toBe(false);
    expect(memeTempo({ monteeSec: 4, descenteSec: 4 }, { monteeSec: 4, descenteSec: 4, pauseSec: 0 })).toBe(true);
    // Un seul tempo proposé est sélectionné à la fois.
    for (const { tempo } of TEMPOS) {
      expect(TEMPOS.filter((t) => memeTempo(t.tempo, tempo))).toHaveLength(1);
    }
  });
});
