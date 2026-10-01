import { describe, expect, it } from 'vitest';
import { TEMPOS } from '../data/parametres';
import { libelleTempo, memeTempo } from './formatage';

describe('libellés du tempo', () => {
  it('annonce la pause en bas quand il y en a une', () => {
    expect(libelleTempo({ monteeSec: 4, descenteSec: 4 })).toBe('4 s / 4 s');
    expect(libelleTempo({ monteeSec: 3, descenteSec: 3, pauseSec: 2 })).toBe('3 s / 3 s + 2 s en bas');
    expect(libelleTempo({ monteeSec: 4, descenteSec: 4, pauseSec: 0 })).toBe('4 s / 4 s');
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
