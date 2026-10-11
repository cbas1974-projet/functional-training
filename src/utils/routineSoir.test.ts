import { describe, expect, it } from 'vitest';
import type { PartieRoutine, Personne, RoutineSoirLocale } from '../types';
import { EXERCICES_PAR_ID } from '../data/exercices';
import { CHANGER_DE_COTE_SEC } from './generateurSeance';
import {
  A_EVITER,
  CHANGEMENT_DE_COTE_SEC,
  CONSIGNE_COU,
  CONSIGNE_GAINAGE,
  COU_DU_SOIR,
  DUREE_MAX_SEC,
  ETIREMENTS_MAX,
  GAINAGE_DU_SOIR,
  INSTALLATION_SEC,
  MOBILITE_JJB,
  NOM_PARTIE,
  NOTE_A_EVITER,
  NOTE_DESSIN_CHIEN_D_ARRET,
  NOTE_ROUTINE,
  PARTIES_ROUTINE,
  ROLE_MOBILITE,
  ROUTINE_PAR_DEFAUT,
  SOIRS_GARDES,
  TENUE_COU_SEC,
  TENUE_GAINAGE_SEC,
  TENUE_PAR_COTE_SEC,
  TENUE_SEC,
  TRANSITION_COU_SEC,
  TRANSITION_GAINAGE_SEC,
  TRANSITION_MOBILITE_SEC,
  YOGA_DU_SOIR,
  ajouterEtirement,
  avecListe,
  avecListeDeDepart,
  avecPartie,
  avecSoir,
  candidatsRoutine,
  depasseLeMaximum,
  deplacerEtirement,
  derniersSoirs,
  dureePartieSec,
  dureeRoutineSec,
  etapesRoutine,
  exerciceRoutine,
  indexDebutEtirement,
  indexPrecedent,
  libelleDuree,
  libelleDureeFine,
  libelleDureeRoutine,
  libelleSoirsSurSept,
  libelleTenue,
  listeModifiee,
  lireRoutineSoir,
  partieAllumee,
  partiesAllumees,
  partiesDe,
  remplacerEtirement,
  resumeRoutine,
  retirerEtirement,
  routineDe,
  sansSoir,
  serieDeSoirs,
  soirDe,
  soirFait,
  soirsSurSept,
} from './routineSoir';
import type { EtapeRoutine, PartiesRoutine } from './routineSoir';

const PERSONNES: Personne[] = ['sebastien', 'max'];
const exercice = (id: string) => EXERCICES_PAR_ID[id];

/** Noms des fichiers présents dans public/exercices (voir `exercices.test.ts` :
 *  `import.meta.glob` plutôt que `node:fs`, que le tsconfig de l'application ne connaît pas). */
const FICHIERS = new Set(
  Object.keys(import.meta.glob('../../public/exercices/*')).map((chemin) => chemin.slice(chemin.lastIndexOf('/') + 1)),
);
const aUneImage = (id: string) => FICHIERS.has(`${id}.png`);

/** Dimanche 11 octobre 2026, 21 h 30 : un soir. */
const DIMANCHE_SOIR = new Date(2026, 9, 11, 21, 30);

/** Une routine d'une seule partie, pour mesurer ses étapes. */
const seulement = (partie: PartieRoutine, ids: string[]): PartiesRoutine => ({
  gainage: [],
  mobilite: [],
  cou: [],
  etirements: [],
  [partie]: ids,
});
const etapesDeTravail = (etapes: EtapeRoutine[]) => etapes.filter((e): e is Exclude<EtapeRoutine, { type: 'fin' }> => e.type !== 'fin');
/** Les étapes en une ligne chacune : « exercice:type[-côté]:secondes ». */
const lignes = (etapes: EtapeRoutine[]) =>
  etapesDeTravail(etapes).map((e) => `${e.exerciceId}:${e.type}${e.type === 'tenue' && e.cote ? `-${e.cote}` : ''}:${e.dureeSec}`);

/** Tous les exercices de la routine d'une personne, les quatre parties à la suite. */
const exercicesDe = (personne: Personne) => [
  ...GAINAGE_DU_SOIR,
  ...MOBILITE_JJB[personne],
  ...COU_DU_SOIR,
  ...ROUTINE_PAR_DEFAUT[personne],
];

describe('les étirements de départ', () => {
  it.each(PERSONNES)('%s : trois étirements ou postures de la bibliothèque, sans doublon, avec leur image', (personne) => {
    const liste = ROUTINE_PAR_DEFAUT[personne];
    expect(liste).toHaveLength(3);
    expect(new Set(liste).size).toBe(3);
    for (const id of liste) {
      expect(exercice(id), id).toBeDefined();
      expect(['etirement', 'yoga']).toContain(exercice(id).famille);
      expect(aUneImage(id), `image de ${id}`).toBe(true);
      // Du matériel qu'on a à la maison : rien, ou le tapis.
      expect(['aucun', 'tapis']).toContain(exercice(id).materiel);
    }
  });

  it('Speedy : le bas du dos, l’arrière des cuisses allongé, le fessier et l’extérieur de la hanche', () => {
    expect(ROUTINE_PAR_DEFAUT.sebastien).toEqual([
      'yoga-bebe-heureux', // genoux vers la poitrine : le bas du dos
      'etir-ischios-allonge', // l'arrière des cuisses, la version sûre pour le dos
      'etir-genou-en-travers', // le fessier et l'extérieur de la hanche, où tire la bandelette
    ]);
  });

  it('Speedy : tout au sol ou allongé, jamais de flexion avant debout ni d’équilibre sur une jambe', () => {
    for (const id of ROUTINE_PAR_DEFAUT.sebastien) {
      expect(exercice(id).position, id).toMatch(/^(Allongé|Sur le dos)/);
      expect(exercice(id).nomFr.toLowerCase()).not.toContain('debout');
      expect(A_EVITER.sebastien).not.toContain(id);
    }
    for (const interdit of [
      'etir-ischios-debout',
      'etir-ischios-jambes-croisees',
      'yoga-flexion-avant-debout',
      'yoga-pyramide',
      'yoga-grand-ecart-debout',
      'etir-quadriceps-debout',
    ]) {
      expect(exercicesDe('sebastien')).not.toContain(interdit);
    }
  });

  it('Big Max : les cuisses, les mollets et l’arrière des cuisses (son physio), sans fente ni genoux à terre', () => {
    expect(ROUTINE_PAR_DEFAUT.max).toEqual(['etir-mollet-mur', 'etir-quadriceps-cote', 'etir-ischios-allonge']);
    // Le mollet contre le mur est le seul étirement debout.
    const debout = ROUTINE_PAR_DEFAUT.max.filter((id) => exercice(id).position.startsWith('Debout'));
    expect(debout).toEqual(['etir-mollet-mur']);
  });

  it('Big Max : rien qui plie les genoux sous charge, dans aucune des trois parties', () => {
    for (const id of exercicesDe('max').filter((i) => i !== 'bird-dog-row')) {
      expect(A_EVITER.max).not.toContain(id);
      expect(id).not.toMatch(/fente|accroupie|soleaire|tibia|pigeon|heros|enfant/);
      expect(exercice(id).position, id).not.toMatch(/^À genoux|fente|accroupi|squat/i);
    }
  });

  it('chaque personne a sa note, et ce que sa liste ne propose pas', () => {
    for (const personne of PERSONNES) {
      expect(NOTE_ROUTINE[personne].length).toBeGreaterThan(20);
      expect(NOTE_A_EVITER[personne].length).toBeGreaterThan(20);
    }
    // Celle de Max dit que la liste du physio la remplacera.
    expect(NOTE_ROUTINE.max).toContain('physio');
  });

  it('commencent par la liste de départ tant qu’on n’y a pas touché', () => {
    for (const personne of PERSONNES) {
      expect(routineDe(personne)).toEqual(ROUTINE_PAR_DEFAUT[personne]);
      expect(routineDe(personne, { soirs: ['2026-10-10'] })).toEqual(ROUTINE_PAR_DEFAUT[personne]);
    }
  });
});

describe('la mobilité pour le jiu-jitsu', () => {
  it.each(PERSONNES)('%s : deux mouvements de la bibliothèque, avec leur image, au sol', (personne) => {
    const liste = MOBILITE_JJB[personne];
    expect(liste).toHaveLength(2);
    expect(new Set(liste).size).toBe(2);
    for (const id of liste) {
      expect(exercice(id), id).toBeDefined();
      expect(['etirement', 'yoga']).toContain(exercice(id).famille);
      expect(aUneImage(id), `image de ${id}`).toBe(true);
      expect(['aucun', 'tapis']).toContain(exercice(id).materiel);
      expect(exercice(id).position, id).not.toMatch(/^Debout/);
      expect(A_EVITER[personne]).not.toContain(id);
      // Chaque mouvement dit ce qu'il remplace ou à quoi il sert.
      expect(ROLE_MOBILITE[id]?.length, id).toBeGreaterThan(10);
    }
  });

  it('les hanches (à la place du 90/90) et la rotation du buste (à la place du livre ouvert)', () => {
    expect(MOBILITE_JJB.sebastien).toEqual(['yoga-demi-pigeon', 'yoga-torsion-couchee']);
    expect(MOBILITE_JJB.max).toEqual(['etir-ecart-allonge', 'yoga-torsion-couchee']);
    expect(ROLE_MOBILITE['yoga-demi-pigeon']).toContain('90/90');
    expect(ROLE_MOBILITE['etir-ecart-allonge']).toContain('90/90');
    expect(ROLE_MOBILITE['yoga-torsion-couchee']).toContain('livre ouvert');
    // Ni le 90/90 ni le livre ouvert n'existent dans la bibliothèque.
    expect(Object.keys(EXERCICES_PAR_ID).filter((id) => /90|livre|open-book/.test(id))).toEqual([]);
  });

  it('ne reprend rien d’une autre partie : quatre parties qui ne se répètent pas', () => {
    for (const personne of PERSONNES) {
      const tout = exercicesDe(personne);
      expect(tout).toHaveLength(3 + 2 + 2 + 3);
      expect(new Set(tout).size).toBe(tout.length);
    }
  });

  it('environ 2 minutes, pour chacun', () => {
    for (const personne of PERSONNES) {
      const sec = dureePartieSec('mobilite', MOBILITE_JJB[personne]);
      expect(sec).toBeGreaterThanOrEqual(110);
      expect(sec).toBeLessThanOrEqual(160);
    }
    expect(libelleDureeFine(dureePartieSec('mobilite', MOBILITE_JJB.max))).toBe('2 min');
  });

  it('45 s ou 30 s de chaque côté, 5 s pour changer de côté et 5 s entre deux mouvements', () => {
    expect(TRANSITION_MOBILITE_SEC).toBe(5);
    expect(lignes(etapesRoutine(seulement('mobilite', MOBILITE_JJB.sebastien)))).toEqual([
      `yoga-demi-pigeon:installation:${TRANSITION_MOBILITE_SEC}`,
      `yoga-demi-pigeon:tenue-droit:${TENUE_PAR_COTE_SEC}`,
      `yoga-demi-pigeon:changement:${CHANGEMENT_DE_COTE_SEC}`,
      `yoga-demi-pigeon:tenue-gauche:${TENUE_PAR_COTE_SEC}`,
      `yoga-torsion-couchee:installation:${TRANSITION_MOBILITE_SEC}`,
      `yoga-torsion-couchee:tenue-droit:${TENUE_PAR_COTE_SEC}`,
      `yoga-torsion-couchee:changement:${CHANGEMENT_DE_COTE_SEC}`,
      `yoga-torsion-couchee:tenue-gauche:${TENUE_PAR_COTE_SEC}`,
    ]);
    // L'écart allongé se tient des deux côtés à la fois.
    expect(lignes(etapesRoutine(seulement('mobilite', MOBILITE_JJB.max))).slice(0, 2)).toEqual([
      `etir-ecart-allonge:installation:${TRANSITION_MOBILITE_SEC}`,
      `etir-ecart-allonge:tenue:${TENUE_SEC}`,
    ]);
  });
});

describe('le cou', () => {
  it('l’inclinaison de côté et la flexion avant, avec leur image, les mêmes pour les deux', () => {
    expect(COU_DU_SOIR).toEqual(['etir-nuque-inclinaison', 'etir-nuque-flexion']);
    for (const id of COU_DU_SOIR) {
      expect(exercice(id), id).toBeDefined();
      expect(exercice(id).famille).toBe('etirement');
      expect(aUneImage(id), `image de ${id}`).toBe(true);
      expect(exercice(id).nomFr.toLowerCase()).toContain('nuque');
    }
    expect(partiesDe('sebastien').cou).toEqual(COU_DU_SOIR);
    expect(partiesDe('max').cou).toEqual(COU_DU_SOIR);
  });

  it('tout en douceur : des tenues de 20 s, rien de tiré, pas de cercles', () => {
    expect([TENUE_COU_SEC, TRANSITION_COU_SEC]).toEqual([20, 5]);
    expect(lignes(etapesRoutine(seulement('cou', COU_DU_SOIR)))).toEqual([
      `etir-nuque-inclinaison:installation:${TRANSITION_COU_SEC}`,
      `etir-nuque-inclinaison:tenue-droit:${TENUE_COU_SEC}`,
      `etir-nuque-inclinaison:changement:${CHANGEMENT_DE_COTE_SEC}`,
      `etir-nuque-inclinaison:tenue-gauche:${TENUE_COU_SEC}`,
      `etir-nuque-flexion:installation:${TRANSITION_COU_SEC}`,
      `etir-nuque-flexion:tenue:${TENUE_COU_SEC}`,
    ]);
    expect(CONSIGNE_COU).toContain('pas de cercles');
    expect(CONSIGNE_COU).toContain('rien de forcé');
    for (const id of COU_DU_SOIR) {
      // Des étirements tenus : aucun mouvement circulaire (« jamais de rotation en même temps » est un interdit).
      expect(`${exercice(id).nomFr} ${exercice(id).pointsAttention.join(' ')}`).not.toMatch(/cercle|rouler/i);
      expect(exercice(id).unite).toBe('secondes');
    }
  });

  it('dure environ 1 min 15 : une minute et quart', () => {
    expect(dureePartieSec('cou', COU_DU_SOIR)).toBe(50 + 25);
    expect(libelleDureeFine(75)).toBe('1 min 15');
  });

  it('les exercices du cou ne sont pas reproposés aux étirements : ils ont déjà leur partie', () => {
    for (const personne of PERSONNES) {
      const ids = candidatsRoutine(personne).map((e) => e.id);
      for (const id of [...COU_DU_SOIR, ...GAINAGE_DU_SOIR, ...MOBILITE_JJB[personne]]) expect(ids).not.toContain(id);
    }
    // Les autres étirements du cou et du trapèze restent au choix.
    expect(candidatsRoutine('max').map((e) => e.id)).toContain('etir-nuque-oblique');
    expect(candidatsRoutine('sebastien').map((e) => e.id)).toContain('etir-trapeze-assis');
  });
});

describe('les étapes et la durée', () => {
  it('45 s pour une position des deux côtés, 30 s de chaque côté, 5 s pour changer de côté', () => {
    expect(TENUE_SEC).toBe(45);
    expect(TENUE_PAR_COTE_SEC).toBe(30);
    // La même mécanique que la séance guidée.
    expect(CHANGEMENT_DE_COTE_SEC).toBe(CHANGER_DE_COTE_SEC);
    expect(CHANGEMENT_DE_COTE_SEC).toBe(5);
    expect(INSTALLATION_SEC).toBe(10);
  });

  it('s’installe, tient un côté, change de côté, tient l’autre ; puis la fin', () => {
    const etapes = etapesRoutine(seulement('etirements', ['etir-ischios-allonge', 'yoga-bebe-heureux']));
    const base = { partie: 'etirements', total: 2 } as const;
    expect(etapes).toEqual([
      { type: 'installation', exerciceId: 'etir-ischios-allonge', rang: 1, ...base, dureeSec: INSTALLATION_SEC },
      { type: 'tenue', exerciceId: 'etir-ischios-allonge', rang: 1, ...base, cote: 'droit', dureeSec: 30 },
      { type: 'changement', exerciceId: 'etir-ischios-allonge', rang: 1, ...base, dureeSec: 5 },
      { type: 'tenue', exerciceId: 'etir-ischios-allonge', rang: 1, ...base, cote: 'gauche', dureeSec: 30 },
      { type: 'installation', exerciceId: 'yoga-bebe-heureux', rang: 2, ...base, dureeSec: INSTALLATION_SEC },
      { type: 'tenue', exerciceId: 'yoga-bebe-heureux', rang: 2, ...base, dureeSec: 45 },
      { type: 'fin', dureeSec: 0 },
    ]);
  });

  it('saute un identifiant qui n’existe plus, et une routine vide ne garde que la fin', () => {
    const installations = (ids: string[]) =>
      etapesRoutine(seulement('etirements', ids)).filter((e) => e.type === 'installation');
    expect(installations(['n-importe-quoi', 'yoga-bebe-heureux'])).toHaveLength(1);
    const vide = seulement('etirements', []);
    expect(etapesRoutine(vide)).toEqual([{ type: 'fin', dureeSec: 0 }]);
    expect(dureeRoutineSec(vide)).toBe(0);
  });

  it.each(PERSONNES)('%s : toute la routine, les quatre parties allumées, dure dix minutes au plus', (personne) => {
    expect(DUREE_MAX_SEC).toBe(600);
    const parties = partiesDe(personne);
    expect(PARTIES_ROUTINE.every((partie) => parties[partie].length > 0)).toBe(true);
    const total = dureeRoutineSec(parties);
    expect(total).toBeLessThanOrEqual(DUREE_MAX_SEC);
    expect(total).toBeGreaterThanOrEqual(DUREE_MAX_SEC - 60);
    expect(depasseLeMaximum(parties)).toBe(false);
    expect(libelleDureeRoutine(parties)).toBe('10 min');
    // Les quatre parties s'additionnent, sans rien d'autre.
    expect(total).toBe(PARTIES_ROUTINE.reduce((somme, partie) => somme + dureePartieSec(partie, parties[partie]), 0));
  });

  it.each(PERSONNES)('%s : le gainage ≈ 3 min, la mobilité ≈ 2 min, le cou ≈ 1 min 15, les étirements ≈ 3 min', (personne) => {
    const parties = partiesDe(personne);
    const sec = (partie: PartieRoutine) => dureePartieSec(partie, parties[partie]);
    expect(sec('gainage')).toBe(175);
    expect(libelleDureeFine(sec('gainage'))).toBe('3 min');
    expect(sec('mobilite')).toBeGreaterThanOrEqual(110);
    expect(sec('mobilite')).toBeLessThanOrEqual(160);
    expect(sec('cou')).toBe(75);
    expect(sec('etirements')).toBeGreaterThanOrEqual(150);
    expect(sec('etirements')).toBeLessThanOrEqual(240);
  });

  it('une partie éteinte laisse de la place : trois étirements d’un seul côté dépassent dix minutes, le dit, et rentrent sans la mobilité', () => {
    const base = partiesDe('sebastien');
    const trois = { ...base, etirements: ['etir-ischios-allonge', 'etir-fessier-chiffre-4', 'etir-genou-en-travers'] };
    expect(dureeRoutineSec(trois)).toBeGreaterThan(DUREE_MAX_SEC);
    expect(depasseLeMaximum(trois)).toBe(true);
    expect(depasseLeMaximum({ ...trois, mobilite: [] })).toBe(false);
    expect(ETIREMENTS_MAX).toBe(3);
  });

  it('dit ce que tient un exercice', () => {
    expect(libelleTenue(exercice('etir-ischios-allonge'))).toBe('30 s par côté');
    expect(libelleTenue(exercice('yoga-bebe-heureux'))).toBe('45 s');
    expect(libelleTenue(exercice('yoga-planche'), 'gainage')).toBe('30 s');
    expect(libelleTenue(exercice('yoga-planche-laterale'), 'gainage')).toBe('30 s par côté');
    expect(libelleDuree(595)).toBe('10 min');
    expect(libelleDuree(20)).toBe('1 min');
    expect(libelleDureeFine(50)).toBe('45 s');
    expect(libelleDureeFine(140)).toBe('2 min 15');
    expect(libelleDureeFine(205)).toBe('3 min 30');
    expect(libelleDureeFine(180)).toBe('3 min');
  });

  it('résume ce que contient la routine', () => {
    expect(resumeRoutine(partiesDe('sebastien'))).toBe('Gainage, mobilité, cou et 3 étirements');
    expect(resumeRoutine({ ...partiesDe('sebastien'), gainage: [] })).toBe('Mobilité, cou et 3 étirements');
    expect(resumeRoutine({ ...partiesDe('sebastien'), gainage: [], mobilite: [] })).toBe('Cou et 3 étirements');
    expect(resumeRoutine({ ...partiesDe('sebastien'), gainage: [], mobilite: [], cou: [] })).toBe('3 étirements');
    expect(resumeRoutine({ ...partiesDe('sebastien'), gainage: [], cou: [], etirements: ['yoga-bebe-heureux'] })).toBe('Mobilité et 1 étirement');
  });

  it('« Précédent » revient au début de l’exercice en cours, puis à celui d’avant', () => {
    const etapes = etapesRoutine(seulement('etirements', ['etir-ischios-allonge', 'yoga-bebe-heureux', 'etir-fessier-chiffre-4']));
    // 0 install A, 1 droit, 2 changement, 3 gauche, 4 install B, 5 tenue B, 6 install C, ...
    expect(indexDebutEtirement(etapes, 3)).toBe(0);
    expect(indexDebutEtirement(etapes, 5)).toBe(4);
    expect(indexPrecedent(etapes, 3)).toBe(0);
    expect(indexPrecedent(etapes, 5)).toBe(4);
    expect(indexPrecedent(etapes, 4)).toBe(0);
    expect(indexPrecedent(etapes, 6)).toBe(4);
    expect(indexPrecedent(etapes, 0)).toBe(0);
    // Depuis la fin : le début du dernier exercice.
    expect(etapes[indexPrecedent(etapes, etapes.length - 1)]).toMatchObject({ type: 'installation', rang: 3 });
  });

  it('les quatre parties se suivent : gainage, mobilité, cou, étirements, chacune avec ses rangs', () => {
    const etapes = etapesRoutine(partiesDe('max'));
    const parties = etapesDeTravail(etapes).map((e) => e.partie);
    expect(parties.indexOf('mobilite')).toBeGreaterThan(parties.lastIndexOf('gainage'));
    expect(parties.indexOf('cou')).toBeGreaterThan(parties.lastIndexOf('mobilite'));
    expect(parties.indexOf('etirements')).toBeGreaterThan(parties.lastIndexOf('cou'));
    const attendu: Record<PartieRoutine, number> = { gainage: 3, mobilite: 2, cou: 2, etirements: 3 };
    for (const partie of PARTIES_ROUTINE) {
      const installations = etapes.filter((e) => e.type === 'installation' && e.partie === partie);
      expect(installations.map((e) => (e.type === 'fin' ? 0 : e.rang))).toEqual(Array.from({ length: attendu[partie] }, (_, i) => i + 1));
      expect(installations.every((e) => e.type !== 'fin' && e.total === attendu[partie])).toBe(true);
    }
    expect(etapes[etapes.length - 1]).toEqual({ type: 'fin', dureeSec: 0 });
  });
});

describe('le gainage', () => {
  it('la planche, la planche latérale et le chien d’arrêt, avec leur image', () => {
    expect(GAINAGE_DU_SOIR).toEqual(['yoga-planche', 'yoga-planche-laterale', 'bird-dog-row']);
    for (const id of GAINAGE_DU_SOIR) {
      expect(exercice(id), id).toBeDefined();
      expect(aUneImage(id), `image de ${id}`).toBe(true);
    }
  });

  it('le chien d’arrêt emprunte le dessin du rowing chien d’arrêt, avec ses propres mots', () => {
    const chien = exerciceRoutine('bird-dog-row');
    expect(chien.id).toBe('bird-dog-row');
    expect(chien).toMatchObject({ nomFr: 'Chien d’arrêt', cotes: 'unilateral', unite: 'secondes', materiel: 'tapis' });
    expect(chien.position).toContain('À quatre pattes');
    // Plus rien du banc ni de l'haltère dans ce qu'il dit.
    expect(`${chien.nomFr} ${chien.position} ${chien.pointsAttention.join(' ')}`).not.toMatch(/banc|haltère|rowing/i);
    expect(NOTE_DESSIN_CHIEN_D_ARRET).toContain('banc');
    // Les autres exercices de la bibliothèque restent tels quels.
    expect(exerciceRoutine('yoga-planche')).toBe(exercice('yoga-planche'));
    expect(exercice('bird-dog-row').nomFr).toBe('Rowing chien d’arrêt');
  });

  it('la consigne : tenues courtes, dos neutre, on arrête si le dos fait mal', () => {
    expect(CONSIGNE_GAINAGE).toBe('Tenues courtes, dos neutre, on arrête si le dos fait mal.');
  });

  it('planche 30 s, planche latérale à droite 30 s, 5 s, à gauche 30 s, puis le chien d’arrêt de chaque côté', () => {
    const etapes = etapesRoutine(seulement('gainage', GAINAGE_DU_SOIR));
    expect(etapesDeTravail(etapes).every((e) => e.partie === 'gainage')).toBe(true);
    expect(lignes(etapes)).toEqual([
      `yoga-planche:installation:${TRANSITION_GAINAGE_SEC}`,
      `yoga-planche:tenue:${TENUE_GAINAGE_SEC}`,
      `yoga-planche-laterale:installation:${TRANSITION_GAINAGE_SEC}`,
      `yoga-planche-laterale:tenue-droit:${TENUE_GAINAGE_SEC}`,
      `yoga-planche-laterale:changement:${CHANGEMENT_DE_COTE_SEC}`,
      `yoga-planche-laterale:tenue-gauche:${TENUE_GAINAGE_SEC}`,
      `bird-dog-row:installation:${TRANSITION_GAINAGE_SEC}`,
      `bird-dog-row:tenue-droit:${TENUE_GAINAGE_SEC}`,
      `bird-dog-row:changement:${CHANGEMENT_DE_COTE_SEC}`,
      `bird-dog-row:tenue-gauche:${TENUE_GAINAGE_SEC}`,
    ]);
    expect([TENUE_GAINAGE_SEC, TRANSITION_GAINAGE_SEC]).toEqual([30, 5]);
    expect(etapesDeTravail(etapes).map((e) => e.rang)).toEqual([1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  });

  it('dure environ 3 minutes, et le même gainage pour les deux', () => {
    expect(dureePartieSec('gainage', GAINAGE_DU_SOIR)).toBe(35 + 70 + 70);
    expect(partiesDe('sebastien').gainage).toEqual(partiesDe('max').gainage);
    expect(partiesDe('sebastien').gainage).toEqual(GAINAGE_DU_SOIR);
  });

  it('« Précédent » ne saute pas d’un exercice du gainage à l’autre sans repasser par son début', () => {
    const etapes = etapesRoutine(partiesDe('sebastien'));
    // 0 install planche, 1 tenue, 2 install latérale, 3 droit, 4 changement, 5 gauche, ...
    expect(indexPrecedent(etapes, 5)).toBe(2);
    expect(indexPrecedent(etapes, 2)).toBe(0);
  });
});

describe('allumer et éteindre les parties', () => {
  it('sont toutes allumées par défaut', () => {
    expect(partiesAllumees(undefined)).toEqual(['gainage', 'mobilite', 'cou', 'etirements']);
    expect(partiesAllumees({ soirs: ['2026-10-10'] })).toEqual(['gainage', 'mobilite', 'cou', 'etirements']);
    expect(partieAllumee(undefined, 'mobilite')).toBe(true);
    expect(PARTIES_ROUTINE.map((p) => NOM_PARTIE[p])).toEqual(['Gainage', 'Mobilité jiu-jitsu', 'Cou', 'Étirements']);
  });

  it('s’éteignent et se rallument une à une, sans toucher aux listes ni aux soirs', () => {
    let routine: RoutineSoirLocale = avecListe('max', avecSoir(undefined, '2026-10-11'), ['etir-mollet-mur']);
    routine = avecPartie(routine, 'mobilite', false);
    expect(partiesAllumees(routine)).toEqual(['gainage', 'cou', 'etirements']);
    expect(routine.eteintes).toEqual(['mobilite']);
    routine = avecPartie(routine, 'gainage', false);
    routine = avecPartie(routine, 'cou', false);
    expect(partiesAllumees(routine)).toEqual(['etirements']);
    expect(routine).toEqual({
      listes: { max: ['etir-mollet-mur'] },
      soirs: ['2026-10-11'],
      eteintes: ['gainage', 'mobilite', 'cou'],
    });
    // Les listes et les soirs ne bougent pas quand on touche aux parties, ni l'inverse.
    expect(avecSoir(routine, '2026-10-12').eteintes).toEqual(['gainage', 'mobilite', 'cou']);
    expect(avecListe('max', routine, ['yoga-bebe-heureux']).eteintes).toEqual(['gainage', 'mobilite', 'cou']);
    routine = avecPartie(routine, 'gainage', true);
    routine = avecPartie(routine, 'mobilite', true);
    routine = avecPartie(routine, 'cou', true);
    // Tout rallumé, rien n'est gardé : c'est l'état normal.
    expect('eteintes' in routine).toBe(false);
  });

  it('la dernière partie allumée ne s’éteint pas : une routine vide n’a pas de sens', () => {
    let routine = avecPartie(undefined, 'gainage', false);
    routine = avecPartie(routine, 'mobilite', false);
    routine = avecPartie(routine, 'cou', false);
    expect(partiesAllumees(routine)).toEqual(['etirements']);
    expect(avecPartie(routine, 'etirements', false)).toEqual(routine);
    expect(partiesAllumees(avecPartie(routine, 'etirements', false))).toEqual(['etirements']);
    // Une autre, allumée, laisse éteindre celle-ci.
    expect(partiesAllumees(avecPartie(avecPartie(routine, 'cou', true), 'etirements', false))).toEqual(['cou']);
  });

  it('une partie éteinte sort de la routine, de ses étapes et de sa durée', () => {
    const tout = partiesDe('sebastien');
    const sansGainage = partiesDe('sebastien', avecPartie(undefined, 'gainage', false));
    expect(sansGainage.gainage).toEqual([]);
    expect(sansGainage.mobilite).toEqual(MOBILITE_JJB.sebastien);
    expect(dureeRoutineSec(sansGainage)).toBe(dureeRoutineSec(tout) - dureePartieSec('gainage', GAINAGE_DU_SOIR));
    expect(etapesDeTravail(etapesRoutine(sansGainage)).some((e) => e.partie === 'gainage')).toBe(false);
    // Sans le cou non plus.
    const sansCou = partiesDe('sebastien', avecPartie(undefined, 'cou', false));
    expect(sansCou.cou).toEqual([]);
    expect(dureeRoutineSec(sansCou)).toBe(dureeRoutineSec(tout) - dureePartieSec('cou', COU_DU_SOIR));
    // Les étirements seuls : leur liste, et rien d'autre.
    const seuls = partiesDe(
      'max',
      avecPartie(avecPartie(avecPartie(undefined, 'gainage', false), 'mobilite', false), 'cou', false),
    );
    expect(seuls).toEqual({ gainage: [], mobilite: [], cou: [], etirements: ROUTINE_PAR_DEFAUT.max });
    expect(libelleDureeRoutine(seuls)).toBe('4 min');
    // Éteinte ou allumée, la liste d'étirements retouchée est gardée.
    const retouchee = avecListe('max', avecPartie(undefined, 'etirements', false), ['etir-mollet-mur']);
    expect(partiesDe('max', retouchee).etirements).toEqual([]);
    expect(routineDe('max', retouchee)).toEqual(['etir-mollet-mur']);
    expect(partiesDe('max', avecPartie(retouchee, 'etirements', true)).etirements).toEqual(['etir-mollet-mur']);
  });
});

describe('ce qu’on peut choisir', () => {
  it('les postures de yoga du soir existent et sont des postures de yoga', () => {
    for (const id of YOGA_DU_SOIR) expect(exercice(id)?.famille, id).toBe('yoga');
  });

  it.each(PERSONNES)('%s : rien à éviter, rien qui demande une marche ou une barre, avec une image', (personne) => {
    const candidats = candidatsRoutine(personne);
    expect(candidats.length).toBeGreaterThan(40);
    for (const e of candidats) {
      expect(A_EVITER[personne]).not.toContain(e.id);
      expect(['aucun', 'tapis']).toContain(e.materiel);
      expect(['etirement', 'yoga']).toContain(e.famille);
      expect(aUneImage(e.id), `image de ${e.id}`).toBe(true);
    }
    const ids = candidats.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Les étirements de départ se retrouvent dans le choix.
    for (const id of ROUTINE_PAR_DEFAUT[personne]) expect(ids).toContain(id);
    expect(ids).not.toContain('etir-mollet-marche');
    expect(ids).not.toContain('etir-suspension-barre');
  });

  it('ce qu’on évite est bien exclu : le dos de Speedy, les genoux de Max', () => {
    const speedy = candidatsRoutine('sebastien').map((e) => e.id);
    expect(speedy).not.toContain('etir-ischios-debout');
    expect(speedy).not.toContain('etir-quadriceps-debout');
    expect(speedy).toContain('etir-quadriceps-cote');
    const max = candidatsRoutine('max').map((e) => e.id);
    expect(max).not.toContain('etir-fente-bras-leve');
    expect(max).not.toContain('etir-fente-laterale');
    expect(max).not.toContain('etir-soleaire-genou-flechi');
    expect(max).not.toContain('yoga-enfant');
    expect(max).toContain('etir-quadriceps-debout');
    for (const id of [...A_EVITER.sebastien, ...A_EVITER.max]) expect(exercice(id), id).toBeDefined();
  });
});

describe('modifier la liste', () => {
  const base = ['etir-ischios-allonge', 'yoga-bebe-heureux', 'etir-fessier-chiffre-4'];

  it('change un étirement, sauf un inconnu ou déjà dans la liste', () => {
    expect(remplacerEtirement(base, 1, 'etir-allongement-sol')).toEqual([
      'etir-ischios-allonge',
      'etir-allongement-sol',
      'etir-fessier-chiffre-4',
    ]);
    expect(remplacerEtirement(base, 1, 'etir-fessier-chiffre-4')).toBe(base);
    expect(remplacerEtirement(base, 1, 'hammer-curl')).toBe(base);
    expect(remplacerEtirement(base, 1, 'inconnu')).toBe(base);
    expect(remplacerEtirement(base, 7, 'etir-allongement-sol')).toBe(base);
  });

  it('monte et descend, sans sortir de la liste', () => {
    expect(deplacerEtirement(base, 2, -1)).toEqual(['etir-ischios-allonge', 'etir-fessier-chiffre-4', 'yoga-bebe-heureux']);
    expect(deplacerEtirement(base, 0, 1)).toEqual(['yoga-bebe-heureux', 'etir-ischios-allonge', 'etir-fessier-chiffre-4']);
    expect(deplacerEtirement(base, 0, -1)).toBe(base);
    expect(deplacerEtirement(base, 2, 1)).toBe(base);
  });

  it('retire un étirement, jamais le dernier', () => {
    expect(retirerEtirement(base, 1)).toEqual(['etir-ischios-allonge', 'etir-fessier-chiffre-4']);
    expect(retirerEtirement(['yoga-bebe-heureux'], 0)).toEqual(['yoga-bebe-heureux']);
  });

  it('ajoute à la fin, trois au plus', () => {
    const deux = ['etir-ischios-allonge', 'yoga-bebe-heureux'];
    const trois = ajouterEtirement(deux, 'etir-allongement-sol');
    expect(trois).toHaveLength(ETIREMENTS_MAX);
    expect(ajouterEtirement(trois, 'etir-quadriceps-cote')).toBe(trois);
    expect(ajouterEtirement(deux, 'yoga-bebe-heureux')).toBe(deux);
    expect(ajouterEtirement(deux, 'inconnu')).toBe(deux);
  });

  it('garde la liste par personne, et remet la liste de départ', () => {
    let routine: RoutineSoirLocale | undefined;
    routine = avecListe('sebastien', routine, base);
    expect(routineDe('sebastien', routine)).toEqual(base);
    // Max n'est pas touché.
    expect(routineDe('max', routine)).toEqual(ROUTINE_PAR_DEFAUT.max);
    expect(listeModifiee('sebastien', routine)).toBe(true);
    expect(listeModifiee('max', routine)).toBe(false);

    routine = avecListeDeDepart('sebastien', routine);
    expect(routineDe('sebastien', routine)).toEqual(ROUTINE_PAR_DEFAUT.sebastien);
    expect(listeModifiee('sebastien', routine)).toBe(false);
    expect(routine.listes?.sebastien).toBeUndefined();
  });

  it('ne garde pas une liste égale à celle de départ : celle du physio pourra la remplacer', () => {
    const routine = avecListe('max', undefined, [...ROUTINE_PAR_DEFAUT.max]);
    expect(routine.listes).toEqual({});
    expect(listeModifiee('max', routine)).toBe(false);
    // Même contenu dans un autre ordre : c'est un changement.
    const autreOrdre = avecListe('max', undefined, [...ROUTINE_PAR_DEFAUT.max].reverse());
    expect(listeModifiee('max', autreOrdre)).toBe(true);
  });

  it('retombe sur la liste de départ si la liste gardée est vide ou illisible', () => {
    expect(routineDe('max', { listes: { max: [] } })).toEqual(ROUTINE_PAR_DEFAUT.max);
    expect(routineDe('max', { listes: { max: ['inconnu', 'hammer-curl'] } })).toEqual(ROUTINE_PAR_DEFAUT.max);
    expect(routineDe('max', { listes: { max: ['inconnu', 'yoga-bebe-heureux'] } })).toEqual(['yoga-bebe-heureux']);
  });
});

describe('relire la sauvegarde', () => {
  it('une sauvegarde d’avant la routine du soir n’a rien : ni liste, ni soir', () => {
    expect(lireRoutineSoir(undefined)).toBeUndefined();
    expect(lireRoutineSoir(null)).toBeUndefined();
    expect(lireRoutineSoir({})).toBeUndefined();
    expect(lireRoutineSoir({ listes: {}, soirs: [] })).toBeUndefined();
  });

  it('ne casse rien sur n’importe quoi', () => {
    for (const brut of ['beaucoup', 12, [], true, { listes: 'oui', soirs: 'hier' }, { listes: [1, 2], soirs: { a: 1 } }]) {
      expect(lireRoutineSoir(brut)).toBeUndefined();
    }
  });

  it('écarte les identifiants inconnus et les doublons, huit étirements au plus', () => {
    const lue = lireRoutineSoir({
      listes: {
        sebastien: ['inconnu', 'etir-mollet-mur', 'etir-mollet-mur', 'hammer-curl', 'yoga-bebe-heureux'],
        max: 'etir-mollet-mur',
        quelquun: ['etir-mollet-mur'],
      },
    });
    expect(lue).toEqual({ listes: { sebastien: ['etir-mollet-mur', 'yoga-bebe-heureux'] }, soirs: [] });
    const longue = lireRoutineSoir({
      listes: { max: Object.keys(EXERCICES_PAR_ID).filter((id) => id.startsWith('etir-')).slice(0, 20) },
    });
    expect(longue?.listes?.max).toHaveLength(ETIREMENTS_MAX);
    expect(ETIREMENTS_MAX).toBe(3);
  });

  it('ne garde que de vraies dates, sans doublon, du plus ancien au plus récent', () => {
    const lue = lireRoutineSoir({
      soirs: ['2026-10-11', '2026-10-09', '2026-13-45', '2026-02-30', 'hier', 20261010, null, '2026-10-11', '2026-10-9'],
    });
    expect(lue?.soirs).toEqual(['2026-10-09', '2026-10-11']);
  });

  it('garde les soirs les plus récents seulement', () => {
    const soirs = Array.from({ length: SOIRS_GARDES + 20 }, (_, i) => {
      const jour = new Date(2025, 0, 1 + i);
      return `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}-${String(jour.getDate()).padStart(2, '0')}`;
    });
    const lue = lireRoutineSoir({ soirs });
    expect(lue?.soirs).toHaveLength(SOIRS_GARDES);
    expect(lue?.soirs?.[SOIRS_GARDES - 1]).toBe(soirs[soirs.length - 1]);
  });

  it('relit ce qu’on a écrit', () => {
    const routine: RoutineSoirLocale = {
      listes: { sebastien: ['yoga-bebe-heureux', 'etir-ischios-allonge'] },
      soirs: ['2026-10-09', '2026-10-10'],
      eteintes: ['gainage', 'mobilite'],
    };
    expect(lireRoutineSoir(JSON.parse(JSON.stringify(routine)))).toEqual(routine);
  });

  it('relit les parties éteintes avec prudence : que des parties connues, jamais toutes', () => {
    expect(lireRoutineSoir({ eteintes: ['mobilite'] })).toEqual({ listes: {}, soirs: [], eteintes: ['mobilite'] });
    // Remises dans l'ordre, sans inconnues ni doublons.
    expect(lireRoutineSoir({ eteintes: ['etirements', 'nuque', 'gainage', 'gainage'] })).toEqual({
      listes: {},
      soirs: [],
      eteintes: ['gainage', 'etirements'],
    });
    // Tout éteint : une routine vide n'a pas de sens, on rallume tout.
    expect(lireRoutineSoir({ eteintes: ['gainage', 'mobilite', 'cou', 'etirements'] })).toBeUndefined();
    // Trois éteintes sur quatre : la dernière reste allumée.
    expect(lireRoutineSoir({ eteintes: ['gainage', 'mobilite', 'cou'] })?.eteintes).toEqual(['gainage', 'mobilite', 'cou']);
    for (const eteintes of [true, 'gainage', 0, null, { gainage: true }]) {
      expect(lireRoutineSoir({ eteintes })).toBeUndefined();
      expect(lireRoutineSoir({ eteintes, soirs: ['2026-10-11'] })).toEqual({ listes: {}, soirs: ['2026-10-11'] });
    }
  });
});

describe('les soirs faits', () => {
  it('avant 4 h du matin, on est encore dans le soir d’hier', () => {
    expect(soirDe(new Date(2026, 9, 11, 21, 30))).toBe('2026-10-11');
    expect(soirDe(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-11');
    expect(soirDe(new Date(2026, 9, 12, 0, 30))).toBe('2026-10-11');
    expect(soirDe(new Date(2026, 9, 12, 3, 59))).toBe('2026-10-11');
    expect(soirDe(new Date(2026, 9, 12, 4, 0))).toBe('2026-10-12');
    expect(soirDe(new Date(2026, 0, 1, 1, 0))).toBe('2025-12-31');
  });

  it('marque un soir une seule fois, dans l’ordre, et peut le défaire', () => {
    let routine = avecSoir(undefined, '2026-10-11');
    routine = avecSoir(routine, '2026-10-09');
    routine = avecSoir(routine, '2026-10-11');
    expect(routine.soirs).toEqual(['2026-10-09', '2026-10-11']);
    expect(soirFait(routine, '2026-10-11')).toBe(true);
    expect(soirFait(routine, '2026-10-10')).toBe(false);
    expect(soirFait(undefined, '2026-10-10')).toBe(false);
    routine = sansSoir(routine, '2026-10-11');
    expect(routine.soirs).toEqual(['2026-10-09']);
    // Une date qui n'en est pas une n'est pas gardée.
    expect(avecSoir(routine, 'demain').soirs).toEqual(['2026-10-09']);
  });

  it('marquer un soir ne touche pas aux listes', () => {
    const routine = avecSoir({ listes: { max: ['etir-mollet-mur'] }, soirs: [] }, '2026-10-11');
    expect(routine.listes).toEqual({ max: ['etir-mollet-mur'] });
  });

  it('montre les sept derniers soirs, ce soir en dernier', () => {
    const routine: RoutineSoirLocale = { soirs: ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-10', '2026-10-11'] };
    const jours = derniersSoirs(routine, DIMANCHE_SOIR);
    expect(jours.map((j) => j.soir)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(jours.map((j) => j.faite)).toEqual([true, false, true, false, true, true, true]);
    expect(jours.map((j) => j.initiale).join('')).toBe('LMMJVSD');
    expect(jours.map((j) => j.ceSoir)).toEqual([false, false, false, false, false, false, true]);
    expect(soirsSurSept(routine, DIMANCHE_SOIR)).toBe(5);
    expect(libelleSoirsSurSept(5)).toBe('5 soirs sur 7');
  });

  it('un soir de moins de sept jours, ou jamais fait : « 1 soir sur 7 », « 0 soir sur 7 »', () => {
    expect(libelleSoirsSurSept(1)).toBe('1 soir sur 7');
    expect(libelleSoirsSurSept(0)).toBe('0 soir sur 7');
    expect(soirsSurSept(undefined, DIMANCHE_SOIR)).toBe(0);
    // Les soirs plus vieux que sept jours ne comptent plus.
    expect(soirsSurSept({ soirs: ['2026-10-04', '2026-10-03'] }, DIMANCHE_SOIR)).toBe(0);
    expect(soirsSurSept({ soirs: ['2026-10-04', '2026-10-05'] }, DIMANCHE_SOIR)).toBe(1);
  });

  it('à minuit et demi, les sept soirs finissent encore hier', () => {
    const minuitEtDemi = new Date(2026, 9, 12, 0, 30);
    const jours = derniersSoirs({ soirs: ['2026-10-11'] }, minuitEtDemi);
    expect(jours[6]).toMatchObject({ soir: '2026-10-11', faite: true, ceSoir: true });
  });

  it('compte les soirs de suite, et laisse la série d’hier tenir jusqu’à la fin de ce soir', () => {
    expect(serieDeSoirs(undefined, DIMANCHE_SOIR)).toBe(0);
    expect(serieDeSoirs({ soirs: ['2026-10-09', '2026-10-10', '2026-10-11'] }, DIMANCHE_SOIR)).toBe(3);
    // Ce soir pas encore fait : la série d'hier tient.
    expect(serieDeSoirs({ soirs: ['2026-10-09', '2026-10-10'] }, DIMANCHE_SOIR)).toBe(2);
    // Un soir manqué la casse.
    expect(serieDeSoirs({ soirs: ['2026-10-08', '2026-10-10'] }, DIMANCHE_SOIR)).toBe(1);
    expect(serieDeSoirs({ soirs: ['2026-10-08'] }, DIMANCHE_SOIR)).toBe(0);
    // Par-dessus la fin du mois.
    expect(serieDeSoirs({ soirs: ['2026-09-29', '2026-09-30', '2026-10-01'] }, new Date(2026, 9, 1, 22, 0))).toBe(3);
  });
});
