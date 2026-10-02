import { describe, expect, it } from 'vitest';
import type { EtatProgramme, ExerciceProgramme, SeanceProgrammeFaite } from '../types';
import {
  ETAT_PROGRAMME_PAR_DEFAUT,
  PROGRAMME_PAR_DEFAUT,
  apresSeance,
  chargeProposee,
  ciblesDuJour,
  cleSerie,
  departDe,
  dernieresCharges,
  estJourAllege,
  etapesExercice,
  lireListe,
  migrerEtatProgramme,
  normaliserNom,
  seanceSuivante,
  terminerSeance,
} from './programme';

const trapBar: ExerciceProgramme = {
  id: 'trap',
  nom: 'Trap bar',
  facon: 'tour',
  cibles: { moi: { series: 3, reps: 8 }, ami: { series: 3, reps: 6 } },
};

/** Résumé lisible d'une suite d'étapes : « ami1 moi1 ami2… », « moi1+ami1 ». */
const resume = (exercice: ExerciceProgramme, allegee: boolean) =>
  etapesExercice(exercice, allegee).map((etape) =>
    etape.parts.map((p) => `${p.personne}${p.serie}`).join('+'),
  );

describe('ordre des séries à deux', () => {
  it('chacun son tour : l’ami commence, puis on alterne', () => {
    expect(resume(trapBar, false)).toEqual(['ami1', 'moi1', 'ami2', 'moi2', 'ami3', 'moi3']);
  });

  it('version allégée : je m’enlève une série, l’ami fait sa troisième seul', () => {
    expect(resume(trapBar, true)).toEqual(['ami1', 'moi1', 'ami2', 'moi2', 'ami3']);
  });

  it('ensemble : une étape par série, avec ceux qui en ont encore', () => {
    const marche: ExerciceProgramme = { ...trapBar, id: 'marche', facon: 'ensemble' };
    expect(resume(marche, false)).toEqual(['moi1+ami1', 'moi2+ami2', 'moi3+ami3']);
    expect(resume(marche, true)).toEqual(['moi1+ami1', 'moi2+ami2', 'ami3']);
  });

  it('garde chacun ses répétitions', () => {
    const [premiere, deuxieme] = etapesExercice(trapBar, false);
    expect(premiere.parts[0]).toMatchObject({ personne: 'ami', reps: 6, series: 3 });
    expect(deuxieme.parts[0]).toMatchObject({ personne: 'moi', reps: 8, series: 3 });
  });

  it('n’allège jamais sous une série', () => {
    const court: ExerciceProgramme = {
      ...trapBar,
      cibles: { moi: { series: 1, reps: 8 }, ami: { series: 2, reps: 8 } },
    };
    expect(ciblesDuJour(court, true).moi.series).toBe(1);
  });
});

describe('le jour', () => {
  it('allège les soirs de jiu-jitsu, pas le lundi', () => {
    const jours = PROGRAMME_PAR_DEFAUT.joursJiuJitsu;
    expect(estJourAllege(new Date(2026, 9, 5), jours)).toBe(false); // lundi
    expect(estJourAllege(new Date(2026, 9, 6), jours)).toBe(true); // mardi
    expect(estJourAllege(new Date(2026, 9, 8), jours)).toBe(true); // jeudi
  });
});

describe('le cycle', () => {
  it('reprend à la séance qui suit celle qu’on vient de faire', () => {
    const programme = { ...PROGRAMME_PAR_DEFAUT, prochaine: 0 };
    expect(seanceSuivante(programme).nom).toBe('Séance A');
    // On a choisi la D à la place de la A : la suivante est la E.
    expect(seanceSuivante(apresSeance(programme, 'seance-d')).nom).toBe('Séance E');
    // Après la F, on revient à la A.
    expect(seanceSuivante(apresSeance(programme, 'seance-f')).nom).toBe('Séance A');
  });
});

const historique: SeanceProgrammeFaite[] = [
  {
    id: 'h2',
    date: '2026-09-29T14:00:00.000Z',
    seanceId: 'seance-b',
    nomSeance: 'Séance B',
    allegee: true,
    exercices: [
      {
        exerciceId: 'autre-id',
        nom: 'trap  BAR',
        series: [
          { personne: 'moi', serie: 1, poids: 155 },
          { personne: 'moi', serie: 2, poids: 165 },
          { personne: 'ami', serie: 1, poids: 0 },
        ],
      },
    ],
  },
  {
    id: 'h1',
    date: '2026-09-21T14:00:00.000Z',
    seanceId: 'seance-a',
    nomSeance: 'Séance A',
    allegee: false,
    exercices: [
      {
        exerciceId: 'trap',
        nom: 'Trap bar',
        series: [
          { personne: 'ami', serie: 1, poids: 225 },
          { personne: 'ami', serie: 2, poids: 245 },
        ],
      },
    ],
  },
];

describe('charges de la dernière fois', () => {
  it('retrouvent l’exercice par son nom, d’une séance du cycle à l’autre', () => {
    expect(normaliserNom('  Développé   COUCHÉ ')).toBe('developpe couche');
    expect(dernieresCharges(historique, 'Trap bar', 'moi')).toEqual([155, 165]);
  });

  it('remontent plus loin quand la dernière fois n’a rien noté', () => {
    // L'ami n'a rien saisi la semaine passée : on prend la fois d'avant.
    expect(dernieresCharges(historique, 'Trap bar', 'ami')).toEqual([225, 245]);
    expect(dernieresCharges(historique, 'Leg press', 'ami')).toEqual([]);
  });

  it('proposent la saisie, puis la série précédente, puis la dernière fois', () => {
    const vide = { poids: {} };
    expect(chargeProposee(vide, historique, trapBar, 'moi', 2)).toBe(165);
    // Une troisième série jamais faite reprend la dernière charge connue.
    expect(chargeProposee(vide, historique, trapBar, 'moi', 3)).toBe(165);
    const enCours = { poids: { [cleSerie('trap', 'moi', 1)]: 175 } };
    expect(chargeProposee(enCours, historique, trapBar, 'moi', 2)).toBe(175);
    expect(chargeProposee(vide, [], trapBar, 'moi', 1)).toBeNull();
  });
});

describe('départ du tempo', () => {
  it('devine en haut ou en bas d’après le nom, sauf choix explicite', () => {
    expect(departDe({ nom: 'Bench press' })).toBe('haut');
    expect(departDe({ nom: 'Leg press' })).toBe('haut');
    expect(departDe({ nom: 'Trap bar' })).toBe('bas');
    expect(departDe({ nom: 'Développé épaules' })).toBe('bas');
    expect(departDe({ nom: 'Trap bar', depart: 'haut' })).toBe('haut');
  });
});

describe('saisie rapide d’une liste', () => {
  it('lit un exercice par ligne, avec ou sans séries × répétitions', () => {
    expect(lireListe('Trap bar 3x8\n- Bench press 4 x 6\n2. Leg press\n\n')).toEqual([
      { nom: 'Trap bar', cible: { series: 3, reps: 8 } },
      { nom: 'Bench press', cible: { series: 4, reps: 6 } },
      { nom: 'Leg press', cible: undefined },
    ]);
  });

  it('comprend une liste dictée', () => {
    expect(
      lireListe('trap bar trois fois huit, leg press 3 séries de 10 répétitions, rowing à une main'),
    ).toEqual([
      { nom: 'Trap bar', cible: { series: 3, reps: 8 } },
      { nom: 'Leg press', cible: { series: 3, reps: 10 } },
      // « une » fait partie du nom : il n'est pas pris pour un nombre.
      { nom: 'Rowing à une main', cible: undefined },
    ]);
  });
});

describe('fin de séance', () => {
  const etat: EtatProgramme = {
    programme: {
      ...PROGRAMME_PAR_DEFAUT,
      seances: PROGRAMME_PAR_DEFAUT.seances.map((s) =>
        s.id === 'seance-a' ? { ...s, exercices: [trapBar] } : s,
      ),
    },
    historique: [],
    enCours: {
      seanceId: 'seance-a',
      allegee: true,
      etape: 3,
      poids: { [cleSerie('trap', 'ami', 1)]: 225, [cleSerie('trap', 'moi', 1)]: 135 },
      faites: [cleSerie('trap', 'ami', 1), cleSerie('trap', 'moi', 1), cleSerie('trap', 'ami', 2)],
      demarreeLe: '2026-10-05T12:00:00.000Z',
    },
  };

  it('garde les séries faites, avec leur charge, et avance le cycle', () => {
    const fin = terminerSeance(etat, new Date('2026-10-05T13:00:00.000Z'));
    expect(fin.enCours).toBeNull();
    expect(fin.programme.prochaine).toBe(1);
    expect(fin.historique).toHaveLength(1);
    expect(fin.historique[0]).toMatchObject({ nomSeance: 'Séance A', allegee: true });
    expect(fin.historique[0].exercices[0].series).toEqual([
      { personne: 'ami', serie: 1, poids: 225 },
      { personne: 'moi', serie: 1, poids: 135 },
      { personne: 'ami', serie: 2, poids: 0 },
    ]);
  });

  it('abandonne une séance où rien n’a été fait', () => {
    const rien = terminerSeance({ ...etat, enCours: { ...etat.enCours!, faites: [] } }, new Date());
    expect(rien.historique).toHaveLength(0);
    expect(rien.programme.prochaine).toBe(0);
    expect(rien.enCours).toBeNull();
  });
});

describe('sauvegarde', () => {
  it('ouvre toujours, même sur une sauvegarde abîmée', () => {
    expect(migrerEtatProgramme(null)).toEqual(ETAT_PROGRAMME_PAR_DEFAUT);
    const abime = migrerEtatProgramme({
      programme: {
        noms: { moi: '', ami: 'Marc' },
        seances: [{ id: 's1', nom: 'Jambes', exercices: [{ id: 'e1', nom: 'Leg press', cibles: { moi: { series: 99 } } }, { nom: 'sans id' }] }],
        prochaine: 7,
        joursJiuJitsu: [2, 9, 'x'],
      },
      enCours: { seanceId: 'disparue', faites: [] },
    });
    expect(abime.programme.noms).toEqual({ moi: 'Moi', ami: 'Marc' });
    expect(abime.programme.seances[0].exercices).toHaveLength(1);
    expect(abime.programme.seances[0].exercices[0].cibles.moi).toEqual({ series: 10, reps: 8 });
    expect(abime.programme.prochaine).toBe(0);
    expect(abime.programme.joursJiuJitsu).toEqual([2]);
    // La séance en cours pointe vers une séance supprimée : on l'oublie.
    expect(abime.enCours).toBeNull();
  });

  it('écarte les séances d’historique illisibles plutôt que de planter', () => {
    const relu = migrerEtatProgramme({
      historique: [
        { id: 'ok', exercices: [{ nom: 'Trap bar', series: [{ personne: 'moi', serie: 1, poids: 135 }] }, { nom: 3 }] },
        { id: 'sans-exercices' },
        null,
      ],
    });
    expect(relu.historique).toHaveLength(1);
    expect(dernieresCharges(relu.historique, 'Trap bar', 'moi')).toEqual([135]);
  });
});
