// Exercice par exercice, sur un seul téléphone (13 octobre 2026) : les visages
// obligatoires avant « Exercice terminé », les charges notées d'office, et la
// pause d'un toucher entre deux tours, qui ne change pas d'exercice.
import { describe, expect, it } from 'vitest';
import type { ParametresSeance, Ressenti, SeanceDuMois } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes, groupesUnTelephone } from './etapesSeance';
import type { Etape } from './etapesSeance';
import { seancePourPersonne } from './programmeMois';
import {
  lancerPauseTour,
  phraseVisageManquant,
  restePauseTourSec,
  seriesANoter,
  seriesDe,
  visagesManquants,
} from './parExercice';
import type { Qui } from './parExercice';

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };

/** Un mardi à deux, sur le téléphone de Speedy : le développé couché seul
 *  (Big Max, pecs en point faible, en fait quatre), puis le curl avec les
 *  mollets, et le Superman sans poids avec le développé Arnold. */
const MARDI: SeanceDuMois = {
  id: 'mardi',
  nom: 'Mardi — le haut',
  jour: 2,
  type: 'dure',
  partie: 'haut',
  format: 'series',
  exercices: ['bench-press', 'alternating-curl', 'calf-raise', 'superman', 'arnold-press'],
  finale: 'dumbbell-push-up',
  liens: [
    ['alternating-curl', 'calf-raise'],
    ['superman', 'arnold-press'],
  ],
};
const seance = seancePourPersonne(MARDI, PARAMETRES, { personne: 'sebastien', aDeux: true, unTelephone: true }, new Date(2026, 9, 13));
const groupes = groupesUnTelephone(seance);
const etapes = construireEtapes(seance);
const COLONNES: Qui[] = ['moi', 'autre'];
const NOMS: Record<Qui, string> = { moi: 'Speedy', autre: 'Big Max' };
const aucun = () => undefined;

describe('les visages, obligatoires pour finir l’exercice', () => {
  it('un par personne, sur chaque exercice qui se charge — dans l’ordre de l’écran', () => {
    // Le développé couché : Speedy, puis Big Max.
    expect(visagesManquants(groupes[0], COLONNES, aucun)).toEqual([
      { qui: 'moi', exerciceId: 'bench-press' },
      { qui: 'autre', exerciceId: 'bench-press' },
    ]);
    // La paire curl + mollets : les deux exercices, chacun.
    expect(visagesManquants(groupes[1], COLONNES, aucun).map((m) => `${m.exerciceId} ${m.qui}`)).toEqual([
      'alternating-curl moi',
      'alternating-curl autre',
      'calf-raise moi',
      'calf-raise autre',
    ]);
    // Le Superman sans poids : rien à monter, rien à demander ; le développé
    // Arnold, si.
    expect(visagesManquants(groupes[2], COLONNES, aucun).map((m) => m.exerciceId)).toEqual(['arnold-press', 'arnold-press']);
  });

  it('chaque visage choisi s’enlève de la liste ; tous choisis : on peut finir', () => {
    const ressentis: Record<string, Ressenti> = { 'moi|bench-press': 'leger' };
    const ressentiDe = (qui: Qui, id: string) => ressentis[`${qui}|${id}`];
    expect(visagesManquants(groupes[0], COLONNES, ressentiDe)).toEqual([{ qui: 'autre', exerciceId: 'bench-press' }]);
    ressentis['autre|bench-press'] = 'lourd';
    expect(visagesManquants(groupes[0], COLONNES, ressentiDe)).toEqual([]);
  });

  it('seul, sans l’autre : seulement les siens ; une personne sans série sur un exercice n’en doit pas', () => {
    expect(visagesManquants(groupes[0], ['moi'], aucun)).toEqual([{ qui: 'moi', exerciceId: 'bench-press' }]);
    const sansLui = [{ ...groupes[0][0], autre: { series: 0, reps: 10 } }];
    expect(seriesDe(sansLui[0], 'autre')).toBe(0);
    expect(visagesManquants(sansLui, COLONNES, aucun)).toEqual([{ qui: 'moi', exerciceId: 'bench-press' }]);
  });

  it('le gros bouton dit le premier qui manque : « Choisis un visage : Big Max, Curl alterné »', () => {
    expect(phraseVisageManquant({ qui: 'autre', exerciceId: 'alternating-curl' }, (qui) => NOMS[qui])).toBe(
      'Choisis un visage : Big Max, Curl alterné',
    );
    // Un exercice seul, à deux : le nom de la personne suffit — celui de
    // l'exercice est long, et on le voit.
    expect(phraseVisageManquant({ qui: 'autre', exerciceId: 'bench-press' }, (qui) => NOMS[qui], false)).toBe(
      'Choisis un visage : Big Max',
    );
    // Seul, sans l'autre : le nom de l'exercice, sans nom de personne.
    expect(phraseVisageManquant({ qui: 'moi', exerciceId: 'bench-press' }, () => undefined, false)).toBe(
      'Choisis un visage : Développé couché avec haltères',
    );
    expect(phraseVisageManquant({ qui: 'moi', exerciceId: 'bench-press' })).toBe('Choisis un visage : Développé couché avec haltères');
  });
});

describe('« Exercice terminé » note d’office les charges de toutes les séries', () => {
  it('pour celui qui a fait la série, ou pour les deux ; rien pour un exercice sans charge', () => {
    const exercice = (groupe: number) => etapes.find((e): e is Extract<Etape, { type: 'exercice' }> => e.type === 'exercice' && e.groupe === groupe);
    // Le développé couché, chacun son tour : 3 séries pour Speedy, 4 pour Big Max.
    const developpe = seriesANoter(exercice(0)?.series ?? []);
    expect(developpe.filter((s) => s.qui === 'moi').map((s) => s.serie)).toEqual([1, 2, 3]);
    expect(developpe.filter((s) => s.qui === 'autre').map((s) => s.serie)).toEqual([1, 2, 3, 4]);
    // La paire Superman + Arnold : le Superman sans poids ne note rien.
    const paire = seriesANoter(exercice(2)?.series ?? []);
    expect(paire.some((s) => s.exerciceId === 'superman')).toBe(false);
    expect(paire.filter((s) => s.exerciceId === 'arnold-press').length).toBe(3 + 4);
  });
});

describe('la pause d’un toucher, entre deux tours', () => {
  it('compte sa minute — une minute trente à la trap bar — et appartient à l’exercice où on l’a lancée', () => {
    const pause = lancerPauseTour(7, 1_000_000, 60);
    expect(restePauseTourSec(pause, 7, 1_000_000)).toBe(60);
    expect(restePauseTourSec(pause, 7, 1_030_000)).toBe(30);
    expect(restePauseTourSec(pause, 7, 1_075_000)).toBe(0);
    expect(restePauseTourSec(lancerPauseTour(7, 0, 90), 7, 45_000)).toBe(45);
    // Pas de pause, ou l'exercice a changé depuis : plus rien à compter.
    expect(restePauseTourSec(null, 7, 1_030_000)).toBeNull();
    expect(restePauseTourSec(pause, 8, 1_030_000)).toBeNull();
    expect(restePauseTourSec(pause, undefined, 1_030_000)).toBeNull();
  });

  it('sa durée est celle de la pause de fin de l’exercice : rien à ajouter aux étapes', () => {
    // Les seules pauses des étapes sont celles de fin, une par exercice ou
    // par paire, sauf la dernière : la pause d'entre deux tours ne change pas
    // d'étape.
    expect(etapes.filter((e) => e.type === 'repos').map((e) => (e.type === 'repos' ? e.groupe : -1))).toEqual([0, 1, 2]);
    expect(groupes.map((groupe) => groupe[groupe.length - 1].reposSec)).toEqual([60, 60, 60, 60]);
  });
});
