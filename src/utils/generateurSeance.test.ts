import { describe, expect, it } from 'vitest';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { DUREES_MINUTES, FORMATS, NIVEAUX, PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import type { BlocSeries, Circuit, Niveau, ParametresSeance, Seance } from '../types';
import {
  analyserSeance,
  dureeSerieSec,
  groupesDeBlocs,
  estimerDureeSec,
  exercicesDisponibles,
  formaterDuree,
  genererSeance,
  libelleBloc,
  remplacerExercice,
  secondesParRep,
} from './generateurSeance';

/** Graine fixe : les tests doivent être reproductibles. */
const GRAINE = 20240918;

/** Bornes de circuit recopiées du générateur, pour vérifier qu'un circuit qui
 *  ne remplit pas le budget est bien maximal. Elles sont les mêmes pour les
 *  trois niveaux ; seules les séances courtes descendent à 3 stations. */
const STATIONS_MAX = 6;
const TOURS_MAX = 5;

function stationsMin(parametres: ParametresSeance): number {
  return parametres.dureeMinutes <= 10 ? 3 : 4;
}

function avec(modifications: Partial<ParametresSeance>): ParametresSeance {
  return { ...PARAMETRES_PAR_DEFAUT, ...modifications };
}

function identifiantsSeance(seance: Seance): string[] {
  return [...seance.blocs.map((bloc) => bloc.exerciceId), ...(seance.circuit?.stations ?? [])];
}

function coutCircuit(circuit: Circuit): number {
  return (
    circuit.tours * circuit.stations.length * (circuit.travailSec + circuit.reposSec) +
    Math.max(0, circuit.tours - 1) * circuit.reposEntreToursSec
  );
}

function budgetTravailSec(seance: Seance): number {
  return seance.parametres.dureeMinutes * 60 - seance.echauffementSec - seance.retourCalmeSec;
}

/** Un circuit est maximal si ni une station ni un tour de plus ne tiendrait
 *  dans le budget : la granularité d'une station peut laisser un trou. */
function circuitEstMaximal(seance: Seance): boolean {
  const circuit = seance.circuit;
  if (!circuit) return false;
  const budget = budgetTravailSec(seance);
  const restant = budget - seance.blocs.reduce((somme, bloc) => somme + coutBlocTest(bloc, seance), 0);
  const parStation = circuit.travailSec + circuit.reposSec;
  const cout = coutCircuit(circuit);
  const avecUneStation =
    circuit.stations.length < STATIONS_MAX ? cout + circuit.tours * parStation : Infinity;
  const avecUnTour =
    circuit.tours < TOURS_MAX
      ? cout + circuit.stations.length * parStation + circuit.reposEntreToursSec
      : Infinity;
  return avecUneStation > restant && avecUnTour > restant;
}

function coutBlocTest(bloc: BlocSeries, seance: Seance): number {
  const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
  return bloc.series * (dureeSerieSec(exercice, bloc.reps, seance.parametres.tempo) + bloc.reposSec);
}

function minSec(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const reste = sec % 60;
  return `${minutes}:${String(reste).padStart(2, '0')}`;
}

describe('exercicesDisponibles', () => {
  it('ne garde que les haltères, le niveau et exclut les explosifs par défaut', () => {
    for (const niveau of NIVEAUX) {
      const disponibles = exercicesDisponibles(avec({ niveau: niveau.id }));
      expect(disponibles.length).toBeGreaterThan(0);
      for (const exercice of disponibles) {
        expect(exercice.materiel).toBe('halteres');
        expect(exercice.explosif).not.toBe(true);
      }
    }
  });

  it('respecte le niveau minimal des exercices', () => {
    expect(exercicesDisponibles(avec({ niveau: 'debutant' })).every((e) => e.niveauMin <= 1)).toBe(true);
    expect(exercicesDisponibles(avec({ niveau: 'intermediaire' })).every((e) => e.niveauMin <= 2)).toBe(true);
    expect(exercicesDisponibles(avec({ niveau: 'avance' })).every((e) => e.niveauMin <= 3)).toBe(true);
    const debutant = exercicesDisponibles(avec({ niveau: 'debutant' })).length;
    const avance = exercicesDisponibles(avec({ niveau: 'avance' })).length;
    expect(avance).toBeGreaterThan(debutant);
  });

  it('ajoute les exercices sur banc et sur marche selon le matériel déclaré', () => {
    const halteres = exercicesDisponibles(avec({ materiels: ['halteres'], niveau: 'avance' }));
    const complet = exercicesDisponibles(
      avec({ materiels: ['halteres', 'banc', 'step'], niveau: 'avance' }),
    );
    expect(complet.length).toBeGreaterThan(halteres.length);
    expect(complet.map((e) => e.id)).toContain('bench-press');
    expect(complet.map((e) => e.id)).toContain('incline-row');
    expect(halteres.map((e) => e.id)).not.toContain('bench-press');
    expect(complet.some((e) => e.materiel === 'step')).toBe(true);

    // La marche seule ne débloque pas les exercices sur banc.
    const marche = exercicesDisponibles(avec({ materiels: ['halteres', 'step'], niveau: 'avance' }));
    expect(marche.map((e) => e.id)).toContain('step-up');
    expect(marche.map((e) => e.id)).not.toContain('bench-press');
  });

  it('lit encore l’ancien réglage « banc » des sauvegardes', () => {
    const ancien = exercicesDisponibles(avec({ materiels: [], banc: true, niveau: 'avance' }));
    expect(ancien.map((e) => e.id)).toContain('bench-press');
  });

  it('évite d’empiler deux fois le même schéma de mouvement', () => {
    // Séance longue, tout le corps : les premiers exercices doivent couvrir
    // des schémas différents plutôt que deux tirages ou deux squats.
    const seance = genererSeance(avec({ dureeMinutes: 45, niveau: 'avance' }), GRAINE);
    const patterns = seance.blocs.map((bloc) => EXERCICES_PAR_ID[bloc.exerciceId].pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('remplace par le même schéma de mouvement quand un équivalent existe', () => {
    const parametres = avec({ dureeMinutes: 45, niveau: 'avance' });
    const seance = genererSeance(parametres, GRAINE);
    const utilises = new Set(seance.blocs.map((bloc) => bloc.exerciceId));

    for (const bloc of seance.blocs) {
      const avant = EXERCICES_PAR_ID[bloc.exerciceId];
      const apres = remplacerExercice(seance, bloc.exerciceId, GRAINE);
      const remplacant = apres.blocs.find((b, i) => b.exerciceId !== seance.blocs[i].exerciceId);
      if (!remplacant) continue;
      const nouveau = EXERCICES_PAR_ID[remplacant.exerciceId];

      // Un équivalent du même schéma existe-t-il encore dans la bibliothèque ?
      const equivalentDisponible = exercicesDisponibles(parametres).some(
        (e) => e.pattern === avant.pattern && !utilises.has(e.id),
      );
      if (equivalentDisponible) {
        expect(nouveau.pattern).toBe(avant.pattern);
      } else {
        // Sinon, on garde au moins la zone : la séance reste cohérente.
        expect(nouveau.zone).toBe(avant.zone);
      }
    }
  });

  it('ajoute les mouvements explosifs quand ils sont activés', () => {
    const avecExplosifs = exercicesDisponibles(avec({ niveau: 'avance', explosifs: true }));
    expect(avecExplosifs.map((e) => e.id)).toContain('swing');
    expect(avecExplosifs.map((e) => e.id)).toContain('jump-squat');
  });

  it('rend les exercices dans l’ordre du poster', () => {
    const disponibles = exercicesDisponibles(avec({ niveau: 'avance' }));
    expect(disponibles[0].id).toBe('hammer-curl');
  });
});

describe('genererSeance : toutes les durées, niveaux et formats', () => {
  for (const dureeMinutes of DUREES_MINUTES) {
    for (const niveau of NIVEAUX) {
      for (const format of FORMATS) {
        const parametres = avec({ dureeMinutes, niveau: niveau.id, format: format.id });
        const titre = `${dureeMinutes} min · ${niveau.id} · ${format.id}`;

        it(`${titre} : produit une séance non vide et cohérente`, () => {
          const seance = genererSeance(parametres, GRAINE);
          const identifiants = identifiantsSeance(seance);

          // Jamais de séance vide.
          expect(identifiants.length).toBeGreaterThan(0);
          expect(seance.graine).toBe(GRAINE);
          expect(seance.id).toContain(GRAINE.toString(36));
          expect(() => new Date(seance.creeLe).toISOString()).not.toThrow();

          // Le format est respecté.
          if (format.id === 'circuit') {
            expect(seance.blocs).toHaveLength(0);
            const circuit = seance.circuit;
            expect(circuit).not.toBeNull();
            expect(circuit!.stations.length).toBeGreaterThanOrEqual(stationsMin(parametres));
            expect(circuit!.stations.length).toBeLessThanOrEqual(STATIONS_MAX);
            expect(circuit!.tours).toBeGreaterThanOrEqual(1);
            expect(circuit!.tours).toBeLessThanOrEqual(TOURS_MAX);
            // Ni une station ni un tour de plus ne tiendrait dans le budget.
            expect(circuitEstMaximal(seance)).toBe(true);
          } else {
            expect(seance.blocs.length).toBeGreaterThan(0);
          }

          // Pas de doublon entre les blocs et les stations.
          expect(new Set(identifiants).size).toBe(identifiants.length);

          // Filtres matériel / explosifs / niveau.
          for (const identifiant of identifiants) {
            const exercice = EXERCICES_PAR_ID[identifiant];
            expect(exercice).toBeDefined();
            expect(exercice.materiel).toBe('halteres');
            expect(exercice.explosif).not.toBe(true);
            expect(exercice.niveauMin).toBeLessThanOrEqual(
              { debutant: 1, intermediaire: 2, avance: 3 }[niveau.id],
            );
          }

          // Tous les blocs partagent les mêmes séries / repos.
          if (seance.blocs.length > 1) {
            const premier = seance.blocs[0];
            for (const bloc of seance.blocs) {
              expect(bloc.series).toBe(premier.series);
              expect(bloc.reposSec).toBe(premier.reposSec);
            }
          }

          // La durée annoncée est bien celle que l'on recalcule.
          expect(estimerDureeSec(seance)).toBe(seance.dureeEstimeeSec);
        });

        it(`${titre} : tient dans la durée demandée`, () => {
          const seance = genererSeance(parametres, GRAINE);
          const tolerance = dureeMinutes <= 5 ? 90 : 60;
          expect(seance.dureeEstimeeSec).toBeLessThanOrEqual(dureeMinutes * 60 + tolerance);
        });

        if (dureeMinutes >= 15) {
          it(`${titre} : remplit la durée demandée`, () => {
            const seance = genererSeance(parametres, GRAINE);
            expect(seance.dureeEstimeeSec).toBeGreaterThanOrEqual(0.7 * dureeMinutes * 60);
          });
        }
      }
    }
  }

  it('est déterministe pour une graine donnée', () => {
    for (const format of FORMATS) {
      const parametres = avec({ format: format.id, dureeMinutes: 30 });
      const a = genererSeance(parametres, 4242);
      const b = genererSeance(parametres, 4242);
      expect(b.blocs).toEqual(a.blocs);
      expect(b.circuit).toEqual(a.circuit);
      expect(b.dureeEstimeeSec).toBe(a.dureeEstimeeSec);
      expect(b.graine).toBe(a.graine);
    }
  });

  it('varie avec la graine le plus souvent', () => {
    const parametres = avec({ dureeMinutes: 30, niveau: 'avance' });
    const references = identifiantsSeance(genererSeance(parametres, 1)).join('|');
    let differentes = 0;
    for (let graine = 2; graine <= 21; graine += 1) {
      if (identifiantsSeance(genererSeance(parametres, graine)).join('|') !== references) {
        differentes += 1;
      }
    }
    expect(differentes).toBeGreaterThanOrEqual(15);
  });

  it('respecte l’objectif choisi', () => {
    const bas = genererSeance(avec({ zones: ['bas'], dureeMinutes: 45, niveau: 'avance' }), GRAINE);
    const zonesBas = identifiantsSeance(bas).map((id) => EXERCICES_PAR_ID[id].zone);
    expect(zonesBas.filter((zone) => zone === 'bas').length).toBeGreaterThanOrEqual(1);
    expect(zonesBas[0]).toBe('bas');

    const dos = genererSeance(avec({ zones: ['dos'], dureeMinutes: 45, niveau: 'avance' }), GRAINE);
    expect(EXERCICES_PAR_ID[identifiantsSeance(dos)[0]].zone).toBe('dos');
  });

  it('privilégie plusieurs exercices en une série sur les séances courtes', () => {
    // 10 min intermédiaire : trois exercices en une série valent mieux qu'un
    // seul exercice en trois séries.
    const seance = genererSeance(
      avec({ dureeMinutes: 10, niveau: 'intermediaire', format: 'series', seriesParExercice: null, repsParSerie: null }),
      GRAINE,
    );
    expect(seance.blocs.length).toBeGreaterThanOrEqual(3);
    expect(seance.blocs.every((bloc) => bloc.series === 1)).toBe(true);
    // La durée estimée est celle que déroulera la séance guidée : les
    // préparations comptent, le tout dernier repos n'existe pas.
    expect(seance.dureeEstimeeSec).toBeLessThanOrEqual(600);
    expect(seance.dureeEstimeeSec).toBeGreaterThan(540);

    // Une seule série est autorisée à tous les niveaux jusqu'à 10 min.
    for (const niveau of NIVEAUX) {
      for (const dureeMinutes of [5, 10]) {
        const courte = genererSeance(
          avec({ dureeMinutes, niveau: niveau.id, format: 'series', seriesParExercice: null, repsParSerie: null }),
          GRAINE,
        );
        expect(courte.blocs[0].series).toBe(1);
      }
    }
  });

  it('respecte le nombre de séries demandé quand il tient dans la durée', () => {
    for (const seriesParExercice of [2, 3, 4] as const) {
      for (const dureeMinutes of [20, 30, 45]) {
        const seance = genererSeance(
          avec({ dureeMinutes, niveau: 'intermediaire', format: 'series', seriesParExercice }),
          GRAINE,
        );
        expect(seance.blocs.length).toBeGreaterThan(0);
        expect(seance.blocs.every((bloc) => bloc.series === seriesParExercice)).toBe(true);
        expect(seance.dureeEstimeeSec).toBeLessThanOrEqual(dureeMinutes * 60 + 60);
      }
    }
    // Par défaut : 3 séries, dès 10 min (un seul exercice alors).
    const dix = genererSeance(avec({ dureeMinutes: 10, niveau: 'intermediaire', format: 'series' }), GRAINE);
    expect(dix.blocs.every((bloc) => bloc.series === 3)).toBe(true);
    // 5 min : trois séries ne tiennent pas, l'automatique reprend.
    const cinq = genererSeance(avec({ dureeMinutes: 5, niveau: 'intermediaire', format: 'series' }), GRAINE);
    expect(cinq.blocs.length).toBeGreaterThan(0);
    expect(cinq.blocs[0].series).toBeLessThan(3);
  });

  it('garde le volume du niveau au-delà de 10 min', () => {
    const seriesMini: Record<Niveau, number> = { debutant: 2, intermediaire: 2, avance: 3 };
    for (const niveau of NIVEAUX) {
      for (const dureeMinutes of [15, 20, 30, 45]) {
        const seance = genererSeance(
          avec({ dureeMinutes, niveau: niveau.id, format: 'series' }),
          GRAINE,
        );
        expect(seance.blocs[0].series).toBeGreaterThanOrEqual(seriesMini[niveau.id]);
      }
    }
  });

  it('descend à trois stations pour tenir dans une séance courte en circuit', () => {
    for (const niveau of NIVEAUX) {
      const seance = genererSeance(
        avec({ dureeMinutes: 5, niveau: niveau.id, format: 'circuit' }),
        GRAINE,
      );
      expect(seance.circuit?.stations.length).toBe(3);
      expect(seance.dureeEstimeeSec).toBeLessThanOrEqual(300);
    }
  });

  it('remplit un circuit de 45 min au niveau débutant', () => {
    const seance = genererSeance(
      avec({ dureeMinutes: 45, niveau: 'debutant', format: 'circuit' }),
      GRAINE,
    );
    expect(seance.dureeEstimeeSec).toBeGreaterThanOrEqual(0.7 * 45 * 60);
    expect(seance.circuit?.tours).toBe(5);
    expect(seance.circuit?.stations).toHaveLength(6);
  });

  it('donne aux exercices au temps une tenue en secondes propre au niveau', () => {
    const tenues: Record<Niveau, number> = { debutant: 30, intermediaire: 40, avance: 45 };
    for (const niveau of NIVEAUX) {
      for (let graine = 1; graine <= 40; graine += 1) {
        const seance = genererSeance(
          avec({ niveau: niveau.id, dureeMinutes: 45 }),
          graine,
        );
        for (const bloc of seance.blocs) {
          if (EXERCICES_PAR_ID[bloc.exerciceId].unite === 'secondes') {
            expect(bloc.reps).toBe(tenues[niveau.id]);
          }
        }
      }
    }
  });
});

describe('remplacerExercice', () => {
  it('remplace un bloc par un exercice de la même zone sans muter la séance', () => {
    const seance = genererSeance(avec({ dureeMinutes: 45, niveau: 'avance' }), GRAINE);
    const cible = seance.blocs[0];
    const avant = JSON.stringify(seance);

    const modifiee = remplacerExercice(seance, cible.exerciceId, 7);
    expect(JSON.stringify(seance)).toBe(avant);
    expect(modifiee).not.toBe(seance);
    expect(modifiee.blocs).toHaveLength(seance.blocs.length);
    expect(modifiee.blocs[0].exerciceId).not.toBe(cible.exerciceId);
    expect(EXERCICES_PAR_ID[modifiee.blocs[0].exerciceId].zone).toBe(
      EXERCICES_PAR_ID[cible.exerciceId].zone,
    );
    expect(modifiee.blocs[0].series).toBe(cible.series);
    expect(modifiee.blocs[0].reposSec).toBe(cible.reposSec);
    expect(identifiantsSeance(modifiee)).not.toContain(cible.exerciceId);
    expect(new Set(identifiantsSeance(modifiee)).size).toBe(identifiantsSeance(modifiee).length);
    expect(modifiee.dureeEstimeeSec).toBe(estimerDureeSec(modifiee));
  });

  it('remplace aussi une station de circuit', () => {
    const seance = genererSeance(avec({ dureeMinutes: 30, format: 'circuit' }), GRAINE);
    const cible = seance.circuit?.stations[1] as string;
    const modifiee = remplacerExercice(seance, cible, 11);
    expect(modifiee.circuit?.stations).toHaveLength(seance.circuit?.stations.length ?? 0);
    expect(modifiee.circuit?.stations).not.toContain(cible);
    expect(EXERCICES_PAR_ID[modifiee.circuit?.stations[1] as string].zone).toBe(
      EXERCICES_PAR_ID[cible].zone,
    );
  });

  it('adapte les répétitions quand l’unité change', () => {
    const parametres = avec({ dureeMinutes: 45, niveau: 'intermediaire', repsParSerie: 8 });
    const seance = genererSeance(parametres, GRAINE);
    for (let graine = 1; graine <= 60; graine += 1) {
      for (const bloc of seance.blocs) {
        const modifiee = remplacerExercice(seance, bloc.exerciceId, graine);
        const index = seance.blocs.findIndex((b) => b.exerciceId === bloc.exerciceId);
        const nouveau = modifiee.blocs[index];
        const remplacant = EXERCICES_PAR_ID[nouveau.exerciceId];
        const remplace = EXERCICES_PAR_ID[bloc.exerciceId];
        if (remplacant.unite === 'secondes') {
          // Un exercice au temps reçoit la durée de tenue du niveau.
          expect(nouveau.reps).toBe(40);
        } else if (remplace.unite === 'secondes') {
          // On passe du temps aux répétitions : ce sont celles demandées.
          expect(nouveau.reps).toBe(8);
        } else {
          // Même unité des deux côtés : le bloc garde ses répétitions.
          expect(nouveau.reps).toBe(bloc.reps);
        }
      }
    }
  });

  it('rend la séance inchangée s’il n’y a pas d’alternative', () => {
    const seance = genererSeance(avec({ dureeMinutes: 20 }), GRAINE);
    expect(remplacerExercice(seance, 'exercice-inexistant', 3)).toBe(seance);
    const absent = exercicesDisponibles(seance.parametres).find(
      (exercice) => !identifiantsSeance(seance).includes(exercice.id),
    );
    expect(absent).toBeDefined();
    expect(remplacerExercice(seance, absent!.id, 3)).toBe(seance);
  });
});

describe('formaterDuree', () => {
  it('formate secondes, minutes et heures', () => {
    expect(formaterDuree(45)).toBe('45 s');
    expect(formaterDuree(0)).toBe('0 s');
    expect(formaterDuree(59)).toBe('59 s');
    expect(formaterDuree(60)).toBe('1 min');
    expect(formaterDuree(720)).toBe('12 min');
    expect(formaterDuree(750)).toBe('12 min 30 s');
    expect(formaterDuree(3600)).toBe('1 h');
    expect(formaterDuree(3900)).toBe('1 h 05');
    expect(formaterDuree(7200)).toBe('2 h');
    expect(formaterDuree(4500)).toBe('1 h 15');
  });
});

describe('libelleBloc', () => {
  const bloc = (modifications: Partial<BlocSeries> = {}): BlocSeries => ({
    exerciceId: 'squat',
    series: 3,
    reps: 8,
    reposSec: 60,
    ...modifications,
  });

  it('décrit les séries selon les côtés et l’unité', () => {
    expect(libelleBloc(bloc(), EXERCICES_PAR_ID['squat'])).toBe('3 × 8 reps · repos 60 s');
    expect(libelleBloc(bloc(), EXERCICES_PAR_ID['single-arm-row'])).toBe(
      '3 × 8 reps par côté · repos 60 s',
    );
    expect(libelleBloc(bloc(), EXERCICES_PAR_ID['russian-twist'])).toBe(
      '3 × 8 reps en alternant · repos 60 s',
    );
    expect(libelleBloc(bloc({ reps: 40 }), EXERCICES_PAR_ID['farmers-walk'])).toBe(
      '3 × 40 s · repos 60 s',
    );
  });
});

describe('durée d’une série', () => {
  it('compte le tempo, double l’unilatéral et respecte les exercices au temps', () => {
    const tempo = { monteeSec: 5, descenteSec: 5 };
    expect(secondesParRep(tempo)).toBe(10);
    expect(secondesParRep(PARAMETRES_PAR_DEFAUT.tempo)).toBe(8);
    expect(dureeSerieSec(EXERCICES_PAR_ID['squat'], 8, tempo)).toBe(80);
    expect(dureeSerieSec(EXERCICES_PAR_ID['single-arm-row'], 8, tempo)).toBe(160);
    expect(dureeSerieSec(EXERCICES_PAR_ID['farmers-walk'], 40, tempo)).toBe(40);
    expect(dureeSerieSec(EXERCICES_PAR_ID['squat'], 8, { monteeSec: 3, descenteSec: 3 })).toBe(48);
  });
});

describe('tableau récapitulatif (lecture humaine)', () => {
  it('affiche le récapitulatif des trois formats pour le niveau intermédiaire', () => {
    const lignes: string[] = [];
    lignes.push('');
    lignes.push('  Niveau intermédiaire · objectif corps entier · tempo 5 s / 5 s · graine fixe');

    lignes.push('');
    lignes.push('  FORMAT SÉRIES');
    lignes.push('  durée | exos | séries × reps | repos | échauff. | retour | estimée');
    lignes.push('  ------+------+---------------+-------+----------+--------+--------');
    for (const dureeMinutes of DUREES_MINUTES) {
      const seance = genererSeance(avec({ dureeMinutes, format: 'series' }), GRAINE);
      const premier = seance.blocs[0];
      lignes.push(
        `  ${String(dureeMinutes).padStart(3)}mn |` +
          `${String(seance.blocs.length).padStart(5)} |` +
          `${`${premier.series} × ${premier.reps}`.padStart(14)} |` +
          `${`${premier.reposSec} s`.padStart(6)} |` +
          `${minSec(seance.echauffementSec).padStart(9)} |` +
          `${minSec(seance.retourCalmeSec).padStart(7)} |` +
          `${minSec(seance.dureeEstimeeSec).padStart(8)}`,
      );
    }

    lignes.push('');
    lignes.push('  FORMAT CIRCUIT');
    lignes.push('  durée | stations | tours | travail/repos | entre tours | estimée');
    lignes.push('  ------+----------+-------+---------------+-------------+--------');
    for (const dureeMinutes of DUREES_MINUTES) {
      const seance = genererSeance(avec({ dureeMinutes, format: 'circuit' }), GRAINE);
      const circuit = seance.circuit!;
      lignes.push(
        `  ${String(dureeMinutes).padStart(3)}mn |` +
          `${String(circuit.stations.length).padStart(9)} |` +
          `${String(circuit.tours).padStart(6)} |` +
          `${`${circuit.travailSec} s / ${circuit.reposSec} s`.padStart(14)} |` +
          `${`${circuit.reposEntreToursSec} s`.padStart(12)} |` +
          `${minSec(seance.dureeEstimeeSec).padStart(8)}`,
      );
    }

    lignes.push('');
    lignes.push('  FORMAT MIXTE');
    lignes.push('  durée | exos | séries × reps | repos | circuit (stations × tours) | estimée');
    lignes.push('  ------+------+---------------+-------+----------------------------+--------');
    for (const dureeMinutes of DUREES_MINUTES) {
      const seance = genererSeance(avec({ dureeMinutes, format: 'mixte' }), GRAINE);
      const premier = seance.blocs[0];
      const circuit = seance.circuit;
      lignes.push(
        `  ${String(dureeMinutes).padStart(3)}mn |` +
          `${String(seance.blocs.length).padStart(5)} |` +
          `${`${premier.series} × ${premier.reps}`.padStart(14)} |` +
          `${`${premier.reposSec} s`.padStart(6)} |` +
          `${(circuit ? `${circuit.stations.length} × ${circuit.tours} tour(s)` : 'aucun').padStart(27)} |` +
          `${minSec(seance.dureeEstimeeSec).padStart(8)}`,
      );
    }
    lignes.push('');

    console.log(lignes.join('\n'));
    expect(lignes.length).toBeGreaterThan(10);
  });

  it('affiche le détail d’une séance de 30 min (exemple)', () => {
    const seance = genererSeance(avec({ dureeMinutes: 30, format: 'series' }), GRAINE);
    const lignes = [
      '',
      `  Séance 30 min · intermédiaire · séries · estimée ${formaterDuree(seance.dureeEstimeeSec)}`,
      `  Échauffement ${formaterDuree(seance.echauffementSec)}`,
      ...seance.blocs.map((bloc, index) => {
        const exercice = EXERCICES_PAR_ID[bloc.exerciceId];
        return `  ${index + 1}. ${exercice.nomFr.padEnd(34)} ${libelleBloc(bloc, exercice)}`;
      }),
      `  Retour au calme ${formaterDuree(seance.retourCalmeSec)}`,
      '',
    ];
    console.log(lignes.join('\n'));
    expect(seance.blocs.length).toBeGreaterThan(0);
  });
});

describe('densité : superset et répétitions relâchées', () => {
  it('enchaîne les exercices par paires au format superset', () => {
    const seance = genererSeance(
      avec({ dureeMinutes: 30, format: 'superset', tailleRotation: 2 }),
      GRAINE,
    );
    expect(seance.blocs.length).toBeGreaterThanOrEqual(2);
    const groupes = groupesDeBlocs(seance.blocs);
    expect(groupes.every((g) => g.length <= 2)).toBe(true);
    expect(groupes.some((g) => g.length === 2)).toBe(true);
    // Un bloc enchaîné porte son repos court ; un exercice resté seul n'en a
    // pas besoin, il redevient une série droite.
    for (const groupe of groupes) {
      for (const bloc of groupe) {
        if (groupe.length > 1) expect(bloc.transitionSec).toBe(20);
        else expect(bloc.superset).toBeUndefined();
      }
    }
    expect(seance.dureeEstimeeSec).toBeLessThanOrEqual(30 * 60);
  });

  it('tient plus d’exercices en superset qu’en séries pour la même durée', () => {
    for (const dureeMinutes of [20, 30, 45]) {
      const series = genererSeance(avec({ dureeMinutes, format: 'series' }), GRAINE);
      const superset = genererSeance(avec({ dureeMinutes, format: 'superset' }), GRAINE);
      expect(superset.blocs.length).toBeGreaterThanOrEqual(series.blocs.length);
      expect(superset.dureeEstimeeSec).toBeLessThanOrEqual(dureeMinutes * 60);
    }
  });

  it('ne laisse jamais un seul exercice quand baisser les répétitions en donne deux', () => {
    // C'est le cas qui surprend : au tempo 5 s / 5 s, un exercice unilatéral
    // à 3 × 8 mange presque toute une séance de 20 minutes.
    for (let graine = 1; graine <= 40; graine += 1) {
      const seance = genererSeance(
        avec({ dureeMinutes: 20, format: 'series', seriesParExercice: 3, repsParSerie: 8 }),
        graine,
      );
      expect(seance.blocs.length).toBeGreaterThanOrEqual(2);
      expect(seance.blocs.every((bloc) => bloc.series === 3)).toBe(true);
      expect(seance.dureeEstimeeSec).toBeLessThanOrEqual(20 * 60);
    }
  });

  it('garde les répétitions demandées quand la durée le permet', () => {
    // À 45 minutes, rien ne justifie de rogner sur les répétitions choisies.
    const seance = genererSeance(avec({ dureeMinutes: 45, repsParSerie: 8 }), GRAINE);
    for (const bloc of seance.blocs) {
      if (EXERCICES_PAR_ID[bloc.exerciceId].unite === 'reps') expect(bloc.reps).toBe(8);
    }
  });
});

describe('analyserSeance', () => {
  it('décompose la durée sans rien perdre', () => {
    for (const format of FORMATS) {
      for (const dureeMinutes of DUREES_MINUTES) {
        const seance = genererSeance(avec({ dureeMinutes, format: format.id }), GRAINE);
        const analyse = analyserSeance(seance);
        expect(analyse.totalSec).toBe(seance.dureeEstimeeSec);
        expect(analyse.demandeSec).toBe(dureeMinutes * 60);
        expect(analyse.nombreExercices).toBe(new Set(identifiantsSeance(seance)).size);
        expect(analyse.travailSec).toBeGreaterThan(0);
        expect(analyse.nombreSeries).toBeGreaterThan(0);
      }
    }
  });

  it('signale les exercices unilatéraux et les réglages rabotés', () => {
    const seance = genererSeance(avec({ dureeMinutes: 20, repsParSerie: 8 }), GRAINE);
    const analyse = analyserSeance(seance);
    const unilateral = seance.blocs.some(
      (bloc) => EXERCICES_PAR_ID[bloc.exerciceId].cotes === 'unilateral',
    );
    if (unilateral) {
      expect(analyse.ajustements.some((texte) => texte.includes('côté droit'))).toBe(true);
    }
    const rabote = seance.blocs.some(
      (bloc) => EXERCICES_PAR_ID[bloc.exerciceId].unite === 'reps' && bloc.reps !== 8,
    );
    if (rabote) {
      expect(analyse.ajustements.some((texte) => texte.includes('au lieu de 8'))).toBe(true);
    }
  });

  it('annonce le superset', () => {
    const seance = genererSeance(avec({ dureeMinutes: 30, format: 'superset' }), GRAINE);
    expect(analyserSeance(seance).ajustements.some((t) => t.startsWith('Superset'))).toBe(true);
  });
});

describe('composition des enchaînements', () => {
  /** Contraintes dures : elles doivent tenir quelle que soit la séance. */
  function verifierEnchainements(seance: Seance) {
    for (const groupe of groupesDeBlocs(seance.blocs)) {
      const exercices = groupe.map((bloc) => EXERCICES_PAR_ID[bloc.exerciceId]);
      const exigeants = exercices.filter(
        (e) => ['squat', 'charniere', 'fente', 'portage'].includes(e.pattern) || e.groupe === 'corps-entier',
      );
      // Deux gros mouvements enchaînés : c'est le souffle qui lâche avant le muscle.
      expect(exigeants.length).toBeLessThanOrEqual(1);
      // Deux fois le même muscle, ou le même schéma hors isolation : ce n'est
      // plus un enchaînement, c'est une série longue déguisée.
      const groupes = exercices.map((e) => e.groupe);
      expect(new Set(groupes).size).toBe(groupes.length);
      const schemas = exercices.filter((e) => e.pattern !== 'isolation').map((e) => e.pattern);
      expect(new Set(schemas).size).toBe(schemas.length);
    }
  }

  it('n’enchaîne jamais deux mouvements qui se gênent', () => {
    for (const taille of [2, 3, 4] as const) {
      for (const dureeMinutes of DUREES_MINUTES) {
        for (let graine = 1; graine <= 12; graine += 1) {
          verifierEnchainements(
            genererSeance(avec({ dureeMinutes, format: 'superset', tailleRotation: taille }), graine),
          );
        }
      }
    }
  });

  it('respecte la taille d’enchaînement demandée', () => {
    for (const taille of [2, 3, 4] as const) {
      const seance = genererSeance(
        avec({ dureeMinutes: 45, format: 'superset', tailleRotation: taille }),
        GRAINE,
      );
      const tailles = groupesDeBlocs(seance.blocs).map((g) => g.length);
      expect(Math.max(...tailles)).toBeLessThanOrEqual(taille);
      expect(tailles.some((t) => t === taille)).toBe(true);
    }
  });

  it('en automatique, prend l’enchaînement qui fait tenir le plus d’exercices', () => {
    for (const dureeMinutes of [20, 30, 45]) {
      const auto = genererSeance(avec({ dureeMinutes, format: 'superset' }), GRAINE);
      const fixes = ([2, 3, 4] as const).map(
        (tailleRotation) =>
          genererSeance(avec({ dureeMinutes, format: 'superset', tailleRotation }), GRAINE).blocs.length,
      );
      expect(auto.blocs.length).toBe(Math.max(...fixes));
      expect(auto.dureeEstimeeSec).toBeLessThanOrEqual(dureeMinutes * 60);
    }
  });

  it('préfère une vraie opposition quand elle existe', () => {
    // Sur une séance longue en paires, au moins une paire doit opposer deux
    // schémas ou deux muscles antagonistes, pas seulement deux zones.
    const seance = genererSeance(
      avec({ dureeMinutes: 45, format: 'superset', tailleRotation: 2 }),
      GRAINE,
    );
    const opposes: [string, string][] = [
      ['poussee-horizontale', 'tirage-horizontal'],
      ['poussee-verticale', 'tirage-vertical'],
      ['squat', 'charniere'],
      ['charniere', 'fente'],
      ['charniere', 'flexion-tronc'],
    ];
    const opposesGroupe: [string, string][] = [
      ['biceps', 'triceps'],
      ['pectoraux', 'dorsaux'],
      ['quadriceps', 'ischios-fessiers'],
      ['abdominaux', 'dorsaux'],
      ['epaules', 'dorsaux'],
      ['obliques', 'abdominaux'],
    ];
    const paire = (a: string, b: string, liste: [string, string][]) =>
      liste.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

    const vraiesOppositions = groupesDeBlocs(seance.blocs)
      .filter((g) => g.length === 2)
      .filter((g) => {
        const [x, y] = g.map((bloc) => EXERCICES_PAR_ID[bloc.exerciceId]);
        return paire(x.pattern, y.pattern, opposes) || paire(x.groupe, y.groupe, opposesGroupe);
      });
    expect(vraiesOppositions.length).toBeGreaterThan(0);
  });

  it('densifie franchement une séance de 20 minutes', () => {
    // Le cas qui a lancé tout ça : 20 min, 3 séries, tempo lent.
    const ancien = genererSeance(
      avec({ dureeMinutes: 20, format: 'series', tempo: { monteeSec: 5, descenteSec: 5 }, repsParSerie: 8 }),
      GRAINE,
    );
    const nouveau = genererSeance(avec({ dureeMinutes: 20, format: 'superset' }), GRAINE);
    expect(ancien.blocs.length).toBe(2);
    expect(nouveau.blocs.length).toBeGreaterThanOrEqual(4);
    expect(nouveau.blocs.every((bloc) => bloc.series === 3)).toBe(true);
    expect(nouveau.dureeEstimeeSec).toBeLessThanOrEqual(20 * 60);
  });
});
