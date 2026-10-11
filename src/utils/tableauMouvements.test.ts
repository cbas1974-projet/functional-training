import { describe, expect, it } from 'vitest';
import { EXERCICES, EXERCICES_PAR_ID } from '../data/exercices';
import {
  AU_TEMPS_OU_AU_TEMPO,
  REPS_TABLEAU,
  TEMPO_TABLEAU,
  derouleSerieAuTemps,
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
    // Rotation : à droite, puis à gauche.
    expect(repetition('russian-twist')).toBe('À DROITE 3 s → À GAUCHE 3 s');
    // Au temps : pas de métronome. Un cercle, un sens puis l'autre.
    expect(repetition('farmers-walk')).toMatch(/pas de métronome/);
    for (const id of ['kb-halo', 'kb-around-the-body', 'kb-around-the-world']) {
      expect(repetition(id), id).toBe('— au temps : 30 s dans un sens → « Change de sens ! » → 30 s dans l’autre');
    }
    expect(repetition('kb-turkish-get-up')).toMatch(/au temps, de chaque côté/);
  });

  it('montre les côtés tels que la série les déroule : le changement de côté, le changement de sens', () => {
    const cotes = (id: string) => deroulementDesCotes(EXERCICES_PAR_ID[id]);
    expect(cotes('single-arm-row')).toBe(
      '8 rép. côté droit → CHANGE DE CÔTÉ 5 s (« +5 s » si besoin) → 8 rép. côté gauche',
    );
    expect(cotes('kb-halo')).toBe('un sens, puis l’autre : « Change de sens ! » d’un bip, sans s’arrêter');
    expect(cotes('kb-turkish-get-up')).toBe('côté droit → CHANGE DE CÔTÉ 5 s (« +5 s » si besoin) → côté gauche');
    expect(cotes('farmers-walk')).toBe('les deux ensemble');
    expect(cotes('kb-russian-twist')).toBe('8 rép., chacune à droite puis à gauche');
    expect(cotes('alternating-curl')).toBe('8 rép. en alternant : un côté par rép.');
    expect(cotes('hammer-curl')).toBe('8 rép.');
  });

  it('déroule une série au temps avec le vrai décompte : un sens puis l’autre, ou un côté, le changement, l’autre', () => {
    expect(derouleSerieAuTemps(EXERCICES_PAR_ID['kb-halo'])).toEqual([
      { mot: 'dans un sens', dureeSec: 30 },
      { mot: 'dans l’autre', dureeSec: 30 },
    ]);
    // L'essai raccourcit : 20 s dans chaque sens.
    expect(derouleSerieAuTemps(EXERCICES_PAR_ID['kb-around-the-body'], 20).map((p) => p.dureeSec)).toEqual([20, 20]);
    expect(derouleSerieAuTemps(EXERCICES_PAR_ID['kb-turkish-get-up'], 45)).toEqual([
      { mot: 'côté droit', dureeSec: 45 },
      { mot: 'CHANGE DE CÔTÉ', dureeSec: 5 },
      { mot: 'côté gauche', dureeSec: 45 },
    ]);
    // Une série de cercle dure une minute dans le tableau.
    expect(tableauDesMouvements()).toMatch(/^\| `kb-halo` \| Halo \| .* \| 1 min \| /m);
  });
});

describe('au temps ou au tempo ? (en tête de docs/mouvements.md)', () => {
  const ids = AU_TEMPS_OU_AU_TEMPO.flatMap((avis) => avis.ids);

  it('parle d’exercices qui existent, une fois chacun', () => {
    for (const id of ids) expect(EXERCICES_PAR_ID[id], id).toBeDefined();
    expect(new Set(ids).size).toBe(ids.length);
    expect(tableauDesMouvements()).toMatch(/^## Au temps ou au tempo \?$/m);
    // La section vient avant le tableau du métronome.
    const tableau = tableauDesMouvements();
    expect(tableau.indexOf('## Au temps ou au tempo ?')).toBeLessThan(tableau.indexOf('## Haut du corps'));
  });

  it('suit les fiches : « fait » et « déjà » sont au temps, le tempo gardé et « à décider » au tempo', () => {
    for (const avis of AU_TEMPS_OU_AU_TEMPO) {
      const attendue = avis.decision === 'fait' || avis.decision === 'deja' ? 'secondes' : 'reps';
      for (const id of avis.ids) expect(EXERCICES_PAR_ID[id].unite, id).toBe(attendue);
    }
  });

  it('nomme chaque exercice de musculation au temps, et tous les explosifs', () => {
    const auTemps = exercicesDuTableau().filter((e) => e.unite === 'secondes').map((e) => e.id);
    expect(auTemps.every((id) => ids.includes(id))).toBe(true);
    const explosifs = EXERCICES.filter((e) => e.explosif).map((e) => e.id);
    expect(explosifs.length).toBeGreaterThan(10);
    expect(explosifs.every((id) => ids.includes(id))).toBe(true);
  });

  it('passe au temps les trois cercles et le relevé turc, et laisse à Sébastien les coups croisés et les explosifs', () => {
    const decision = (id: string) => AU_TEMPS_OU_AU_TEMPO.find((avis) => avis.ids.includes(id))?.decision;
    for (const id of ['kb-halo', 'kb-around-the-body', 'kb-around-the-world', 'kb-turkish-get-up']) {
      expect(decision(id), id).toBe('fait');
    }
    for (const id of ['v-sit-cross-jab', 'swing', 'kb-double-arm-swing']) expect(decision(id), id).toBe('a-decider');
    for (const id of ['russian-twist', 'kb-russian-twist', 'kb-commando', 'plank-t', 'renegade-row', 'bird-dog-row']) {
      expect(decision(id), id).toBe('garde');
    }
  });
});
