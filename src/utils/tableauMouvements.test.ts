import { describe, expect, it } from 'vitest';
import { EXERCICES_PAR_ID } from '../data/exercices';
import {
  REPS_TABLEAU,
  TEMPO_TABLEAU,
  deroulementDesCotes,
  exercicesDuTableau,
  tableauDesMouvements,
  uneRepetition,
} from './tableauMouvements';

describe('le tableau des mouvements (docs/mouvements.md)', () => {
  it('suit le code : relancer `npm run mouvements` après un changement de tempo, de forme ou de côté', async () => {
    // Le fichier est la copie exacte du tableau que produit le code ; une
    // différence fait échouer ce test, et `npm run mouvements` le réécrit.
    await expect(tableauDesMouvements()).toMatchFileSnapshot('../../docs/mouvements.md');
  });

  it('compte une ligne par exercice de musculation, au tempo 3 s / 3 s + 1 s, sur une série de 8', () => {
    expect(TEMPO_TABLEAU).toEqual({ monteeSec: 3, descenteSec: 3, pauseSec: 1 });
    expect(REPS_TABLEAU).toBe(8);
    const exercices = exercicesDuTableau();
    expect(exercices).toHaveLength(151);
    const tableau = tableauDesMouvements();
    for (const exercice of exercices) {
      expect(tableau.match(new RegExp(`^\\| \`${exercice.id}\` \\|`, 'gm')), exercice.id).toHaveLength(1);
    }
  });

  it('dit, pour chaque forme, les mots du métronome dans l’ordre, avec leurs secondes', () => {
    const repetition = (id: string) => uneRepetition(EXERCICES_PAR_ID[id]);
    // Vertical : l'arrêt en bas, en haut, ou nulle part.
    expect(repetition('hammer-curl')).toBe('MONTE 3 s → DESCENDS 3 s → TIENS 1 s');
    expect(repetition('bench-press')).toBe('DESCENDS 3 s → TIENS 1 s → MONTE 3 s');
    expect(repetition('kb-superman')).toBe('MONTE 3 s → TIENS 1 s → DESCENDS 3 s');
    expect(repetition('goblet-squat')).toBe('DESCENDS 3 s → MONTE 3 s');
    expect(repetition('no-money-curl')).toBe('OUVRE 3 s → TIENS 1 s → FERME 3 s');
    // Circulaire : un seul mot, le tour entier.
    expect(repetition('kb-around-the-body')).toBe('TOURNE 6 s');
    // Rotation : à droite, puis à gauche.
    expect(repetition('russian-twist')).toBe('À DROITE 3 s → À GAUCHE 3 s');
    // Au temps : pas de métronome.
    expect(repetition('farmers-walk')).toMatch(/pas de métronome/);
  });

  it('montre les côtés tels que la série les déroule : le changement de côté, le changement de sens', () => {
    const cotes = (id: string) => deroulementDesCotes(EXERCICES_PAR_ID[id]);
    expect(cotes('single-arm-row')).toBe(
      '8 rép. côté droit → CHANGE DE CÔTÉ 5 s (« +5 s » si besoin) → 8 rép. côté gauche',
    );
    expect(cotes('kb-halo')).toBe('4 tours dans un sens → « Change de sens ! », sans s’arrêter → 4 tours dans l’autre sens');
    expect(cotes('kb-russian-twist')).toBe('8 rép., chacune à droite puis à gauche');
    expect(cotes('alternating-curl')).toBe('8 rép. en alternant : un côté par rép.');
    expect(cotes('hammer-curl')).toBe('8 rép.');
  });
});
