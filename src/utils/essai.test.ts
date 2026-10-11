import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParametresSeance, Seance, SeanceDuMois } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { INSTALLATION_SEC, construireEtapes, dureeTotaleSec, etatMetronome } from './etapesSeance';
import type { Etape } from './etapesSeance';
import { appliquer } from './etatCommun';
import type { EtatCommun } from './etatCommun';
import {
  DELAI_SERVEUR_MS,
  ESSAI,
  ESSAI_RECENT_MS,
  INSTALLATION_ESSAI_SEC,
  MOUVEMENTS_ESSAI_SEC,
  REPOS_ESSAI_SEC,
  apercuDe,
  identifiantSeanceEssai,
  lecteurDeSeanceEssai,
  numeroEssai,
  raccourcirPourEssai,
  seanceApercu,
  trouverNumeroEssai,
} from './essai';
import type { LireSeance } from './essai';
import { groupesDeBlocs } from './generateurSeance';
import { perspectiveAutre } from './horlogeCommune';
import { NOM_PERSONNE, genererProgramme, isoDate, seancePourPersonne } from './programmeMois';
import type { ContexteSeance } from './programmeMois';

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };
const LUNDI = new Date(2026, 9, 5);

/** Le format que le serveur accepte pour la séance commune d'un jour. */
const CLE_SERVEUR = /^\d{4}-\d{2}-\d{2}_[a-z0-9-]{1,40}$/;

/** Le jeudi : en séries, deux exercices liés, la trap bar et la presse chacun
 *  son tour. Les exercices sont nommés ici, pour que ces tests ne bougent pas
 *  quand le programme change de composition. */
const JEUDI: SeanceDuMois = {
  id: 'jeudi',
  nom: 'Jeudi',
  jour: 4,
  type: 'dure',
  format: 'series',
  partie: 'complet',
  exercices: ['trap-bar-deadlift', 'seesaw-row', 'kb-superman', 'kb-arnold-press'],
  finale: 'leg-press',
  liens: [['seesaw-row', 'kb-superman']],
  tour: ['trap-bar-deadlift', 'leg-press'],
};

/** Le lundi : six exercices en trois paires, puis les jambes. */
const LUNDI_PAIRES: SeanceDuMois = {
  id: 'lundi-a',
  nom: 'Lundi A',
  jour: 1,
  semaine: 'A',
  type: 'facile',
  format: 'series',
  partie: 'bas',
  exercices: ['kb-superman', 'kb-side-leg-raise', 'kb-bob-and-weave', 'kb-deadlift', 'reverse-lunge', 'kb-x-crunch'],
  liens: [
    ['kb-superman', 'kb-side-leg-raise'],
    ['kb-bob-and-weave', 'kb-deadlift'],
    ['reverse-lunge', 'kb-x-crunch'],
  ],
  finale: 'hack-squat',
  tour: ['hack-squat'],
};

const SEANCES = [JEUDI, LUNDI_PAIRES];

const SEUL_SEB: ContexteSeance = { personne: 'sebastien' };
const SEUL_MAX: ContexteSeance = { personne: 'max' };
const DUO_SEB: ContexteSeance = { personne: 'sebastien', aDeux: true };
const DUO_MAX: ContexteSeance = { personne: 'max', aDeux: true };
const CONTEXTES = [SEUL_SEB, SEUL_MAX, DUO_SEB, DUO_MAX];

const reelle = (seance: SeanceDuMois, contexte: ContexteSeance) =>
  seancePourPersonne(seance, PARAMETRES, contexte, LUNDI);
const essai = (seance: SeanceDuMois, contexte: ContexteSeance) => raccourcirPourEssai(reelle(seance, contexte));
const duree = (seance: Seance) => dureeTotaleSec(construireEtapes(seance));
const minutes = (seance: Seance) => duree(seance) / 60;

describe('raccourcirPourEssai', () => {
  it('ne garde qu’une série par exercice, pour soi et pour l’autre', () => {
    for (const s of SEANCES) {
      for (const contexte of CONTEXTES) {
        // Sans cela, le test ne prouverait rien : la vraie séance en compte trois ou quatre.
        expect(reelle(s, contexte).blocs.every((b) => b.series >= 3)).toBe(true);
        const courte = essai(s, contexte);
        expect(courte.blocs.length).toBe(reelle(s, contexte).blocs.length);
        for (const bloc of courte.blocs) {
          expect(bloc.series).toBe(1);
          if (contexte.aDeux) expect(bloc.autre?.series).toBe(1);
          else expect(bloc.autre).toBeUndefined();
        }
      }
    }
  });

  it('garde les exercices, leur ordre et le tour de chacun ; un tiers de répétitions en moins', () => {
    for (const s of SEANCES) {
      for (const contexte of CONTEXTES) {
        const longue = reelle(s, contexte);
        const courte = essai(s, contexte);
        expect(courte.blocs.map((b) => b.exerciceId)).toEqual(longue.blocs.map((b) => b.exerciceId));
        const tiers = (reps: number | undefined) => (reps === undefined ? undefined : Math.ceil((reps * 2) / 3));
        expect(courte.blocs.map((b) => [b.reps, b.autre?.reps, b.tour])).toEqual(
          longue.blocs.map((b) => [tiers(b.reps), tiers(b.autre?.reps), b.tour]),
        );
        expect(courte.parametres).toEqual(longue.parametres);
        expect(courte.titre).toBe(longue.titre);
        expect(courte.horloge).toMatchObject(longue.horloge ?? {});
      }
    }
  });

  it('ramène les repos à 15 s, sans en allonger un plus court', () => {
    for (const s of SEANCES) {
      expect(reelle(s, SEUL_SEB).blocs.some((b) => b.reposSec > REPOS_ESSAI_SEC)).toBe(true);
      expect(essai(s, SEUL_SEB).blocs.every((b) => b.reposSec === REPOS_ESSAI_SEC)).toBe(true);
    }
    const court: Seance = { ...reelle(JEUDI, SEUL_SEB), blocs: [{ exerciceId: 'seesaw-row', series: 3, reps: 8, reposSec: 10 }, { exerciceId: 'kb-superman', series: 3, reps: 8, reposSec: 0 }] };
    expect(raccourcirPourEssai(court).blocs.map((b) => b.reposSec)).toEqual([10, 0]);
  });

  it('garde les exercices liés et les enchaînements : sans pause entre eux, une seule mise en place', () => {
    for (const s of SEANCES) {
      for (const contexte of CONTEXTES) {
        const longue = reelle(s, contexte);
        const courte = essai(s, contexte);
        expect(courte.blocs.map((b) => [b.superset, b.transitionSec])).toEqual(
          longue.blocs.map((b) => [b.superset, b.transitionSec]),
        );
        const groupes = groupesDeBlocs(courte.blocs);
        expect(groupes.map((g) => g.map((b) => b.exerciceId))).toEqual(
          groupesDeBlocs(longue.blocs).map((g) => g.map((b) => b.exerciceId)),
        );
        // Un « Go » par groupe : deux exercices liés s'installent ensemble.
        const installations = construireEtapes(courte).filter((e) => e.type === 'repos' && e.manuel);
        expect(installations).toHaveLength(groupes.length);
      }
    }
    // Les paires restent des paires, la finale reste seule.
    expect(groupesDeBlocs(essai(JEUDI, SEUL_SEB).blocs).map((g) => g.length)).toEqual([1, 2, 1, 1]);
    expect(groupesDeBlocs(essai(LUNDI_PAIRES, SEUL_SEB).blocs).map((g) => g.length)).toEqual([2, 2, 2, 1]);
  });

  it('réduit l’échauffement et les étirements à une demi-minute chacun', () => {
    for (const s of SEANCES) {
      const longue = reelle(s, SEUL_SEB);
      const courte = essai(s, SEUL_SEB);
      // Cinq minutes de tapis et quatre mouvements, cinq étirements : bien plus.
      expect(longue.echauffementSec).toBeGreaterThan(5 * 60);
      expect(longue.retourCalmeSec).toBeGreaterThanOrEqual(5 * 60);
      expect([courte.echauffementSec, courte.retourCalmeSec]).toEqual([MOUVEMENTS_ESSAI_SEC, MOUVEMENTS_ESSAI_SEC]);
      for (const [gardes, complets] of [
        [courte.echauffement ?? [], longue.echauffement ?? []],
        [courte.retourCalme ?? [], longue.retourCalme ?? []],
      ]) {
        expect(gardes.length).toBeGreaterThan(0);
        expect(gardes.reduce((total, m) => total + (m.dureeSec ?? 0), 0)).toBe(MOUVEMENTS_ESSAI_SEC);
        // Les premiers de la liste, dans l'ordre, avec leur image.
        const premiers = complets.slice(0, gardes.length);
        expect(gardes.map((m) => m.nom)).toEqual(premiers.map((m) => m.nom));
        expect(gardes.map((m) => m.exerciceId)).toEqual(premiers.map((m) => m.exerciceId));
      }
      const etapes = construireEtapes(courte);
      expect(etapes[0]).toEqual({ type: 'echauffement', dureeSec: 30 });
      expect(etapes[etapes.length - 2]).toEqual({ type: 'retourCalme', dureeSec: 30 });
    }
  });

  it('une phase d’un seul mouvement le tient une demi-minute ; sans phase, rien n’est inventé', () => {
    const seule = reelle(JEUDI, SEUL_SEB);
    const unSeul = raccourcirPourEssai({
      ...seule,
      echauffement: [seule.echauffement![0]],
      echauffementSec: seule.echauffement![0].dureeSec!,
    });
    expect(unSeul.echauffement).toEqual([{ ...seule.echauffement![0], dureeSec: 30 }]);
    expect(unSeul.echauffementSec).toBe(30);

    const sans = raccourcirPourEssai({ ...seule, echauffement: undefined, echauffementSec: 0, retourCalme: [], retourCalmeSec: 0 });
    expect(sans.echauffementSec).toBe(0);
    expect(sans.retourCalmeSec).toBe(0);
    expect(construireEtapes(sans).map((e) => e.type)).not.toContain('echauffement');
    expect(construireEtapes(sans).map((e) => e.type)).not.toContain('retourCalme');
  });

  it('sans le détail des mouvements, ramène la seule durée à une demi-minute', () => {
    const seule = reelle(JEUDI, SEUL_SEB);
    const sansDetail = { ...seule };
    delete sansDetail.echauffement;
    delete sansDetail.retourCalme;
    const courte = raccourcirPourEssai({ ...sansDetail, retourCalmeSec: 20 });
    expect(courte.echauffement).toBeUndefined();
    expect(courte.retourCalme).toBeUndefined();
    expect([courte.echauffementSec, courte.retourCalmeSec]).toEqual([30, 20]);
  });

  it('raccourcit la mise en place avant chaque nouvel exercice', () => {
    for (const s of SEANCES) {
      const longue = construireEtapes(reelle(s, SEUL_SEB)).filter((e) => e.type === 'repos' && e.manuel);
      const courte = essai(s, SEUL_SEB);
      expect(courte.horloge?.installationSec).toBe(INSTALLATION_ESSAI_SEC);
      expect(INSTALLATION_ESSAI_SEC).toBeLessThan(INSTALLATION_SEC);
      // Le repos de l'exercice d'avant, puis la mise en place — et rien avant le premier.
      const attentes = construireEtapes(courte).filter((e) => e.type === 'repos' && e.manuel);
      expect(attentes.map((e) => e.dureeSec)).toEqual([
        INSTALLATION_ESSAI_SEC,
        ...attentes.slice(1).map(() => REPOS_ESSAI_SEC + INSTALLATION_ESSAI_SEC),
      ]);
      expect(longue[0].dureeSec).toBe(INSTALLATION_SEC);
    }
  });

  it('dure une dizaine de minutes pour une séance type, un peu plus à deux, jamais plus d’un quart d’heure', () => {
    // Le jeudi de Sébastien, seul : le cas type.
    expect(minutes(essai(JEUDI, SEUL_SEB))).toBeGreaterThan(6);
    expect(minutes(essai(JEUDI, SEUL_SEB))).toBeLessThan(11);
    for (const s of SEANCES) {
      // La vraie séance, elle, tient l'heure.
      expect(minutes(reelle(s, SEUL_SEB))).toBeGreaterThan(45);
      for (const contexte of CONTEXTES) {
        expect(minutes(essai(s, contexte))).toBeGreaterThan(6);
        expect(minutes(essai(s, contexte))).toBeLessThan(15);
      }
      // À deux, l'horloge suit le plus lent des deux : plus long que seul.
      expect(minutes(essai(s, DUO_SEB))).toBeGreaterThan(minutes(essai(s, SEUL_SEB)));
    }
  });

  it('annonce exactement la durée que la séance guidée chronométrera', () => {
    for (const s of SEANCES) {
      for (const contexte of CONTEXTES) {
        const courte = essai(s, contexte);
        expect(courte.dureeEstimeeSec).toBe(duree(courte));
      }
    }
  });

  it('garde l’arrêt là où l’exercice le tient : en haut pour la Superman, de la même durée', () => {
    for (const contexte of CONTEXTES) {
      const courte = essai(LUNDI_PAIRES, contexte);
      const tempo = courte.parametres.tempo;
      const { monteeSec, descenteSec } = tempo;
      const pauseSec = tempo.pauseSec ?? 0;
      expect(pauseSec).toBeGreaterThan(0);
      const serie = construireEtapes(courte).find(
        (e): e is Extract<Etape, { type: 'serie' }> => e.type === 'serie' && e.exerciceId === 'kb-superman',
      )!;
      expect(serie.dureeSec).toBe(serie.reps * (monteeSec + descenteSec + pauseSec));
      // On monte, on tient poitrine et jambes décollées, on redescend se poser.
      expect(etatMetronome(serie, monteeSec / 2, tempo)?.phase).toBe('monte');
      expect(etatMetronome(serie, monteeSec + pauseSec / 2, tempo)?.phase).toBe('pause');
      expect(etatMetronome(serie, monteeSec + pauseSec + descenteSec / 2, tempo)?.phase).toBe('descend');
    }
  });

  it('à deux, les deux téléphones annoncent la même durée et déroulent les mêmes étapes', () => {
    for (const s of SEANCES) {
      const seb = essai(s, DUO_SEB);
      const max = essai(s, DUO_MAX);
      expect(duree(seb)).toBe(duree(max));
      // Ce que Sébastien calcule pour Max est ce que Max calcule pour lui-même.
      expect(construireEtapes(perspectiveAutre(seb)!)).toEqual(construireEtapes(max));
      expect(construireEtapes(perspectiveAutre(max)!)).toEqual(construireEtapes(seb));
    }
  });

  it('ne touche pas à la séance d’origine', () => {
    const longue = reelle(JEUDI, DUO_SEB);
    const avant = structuredClone(longue);
    raccourcirPourEssai(longue);
    expect(longue).toEqual(avant);
  });

  it('marche sur toutes les séances d’un programme composé', () => {
    for (const graine of [1, 2, 3, 4, 5]) {
      const programme = genererProgramme({ graine, aujourdhui: LUNDI });
      for (const s of programme.seances) {
        for (const contexte of CONTEXTES) {
          const longue = seancePourPersonne(s, PARAMETRES, contexte, LUNDI);
          const courte = raccourcirPourEssai(longue);
          expect(courte.blocs.every((b) => b.series === 1 && b.reposSec <= REPOS_ESSAI_SEC)).toBe(true);
          // Un petit tiers de la vraie séance, pas moins de cinq minutes.
          expect(courte.dureeEstimeeSec).toBeLessThan(longue.dureeEstimeeSec / 3);
          expect(courte.dureeEstimeeSec).toBeGreaterThan(5 * 60);
        }
      }
    }
  });
});

describe('la mise en place d’une séance du programme', () => {
  it('dure trente secondes de plus que le repos, sauf si la séance en fixe une autre', () => {
    const longue = reelle(JEUDI, SEUL_SEB);
    expect(longue.horloge?.installationSec).toBeUndefined();
    const attentes = (seance: Seance) => construireEtapes(seance).filter((e) => e.type === 'repos' && e.manuel);
    const reposDuPremier = longue.blocs[0].reposSec;
    expect(attentes(longue).map((e) => e.dureeSec).slice(0, 2)).toEqual([INSTALLATION_SEC, reposDuPremier + INSTALLATION_SEC]);
    const courte = { ...longue, horloge: { ...longue.horloge, installationSec: 5 } };
    expect(attentes(courte).map((e) => e.dureeSec).slice(0, 2)).toEqual([5, reposDuPremier + 5]);
    // Le reste de la séance ne bouge pas.
    expect(duree(longue) - duree(courte)).toBe((INSTALLATION_SEC - 5) * attentes(longue).length);
  });
});

describe('seanceApercu', () => {
  it('attend de savoir qui est l’autre', () => {
    expect(seanceApercu(JEUDI, PARAMETRES, {})).toBeNull();
    expect(seanceApercu(JEUDI, PARAMETRES, { personne: null })).toBeNull();
  });

  it('est l’essai de l’autre, tel qu’il le voit sur son téléphone : ses répétitions, son tour, ses étirements', () => {
    for (const s of SEANCES) {
      for (const [moi, lui] of [
        [DUO_SEB, DUO_MAX],
        [DUO_MAX, DUO_SEB],
        [SEUL_SEB, SEUL_MAX],
        [SEUL_MAX, SEUL_SEB],
      ]) {
        const apercu = seanceApercu(s, PARAMETRES, moi)!;
        const sonEssai = essai(s, lui);
        expect(apercu.blocs).toEqual(sonEssai.blocs);
        expect(apercu.horloge).toEqual(sonEssai.horloge);
        expect(apercu.horloge?.personne).toBe(lui.personne);
        expect(construireEtapes(apercu)).toEqual(construireEtapes(sonEssai));
      }
    }
    // Max fait deux répétitions de plus : vu de chez Sébastien, ce sont les siennes.
    const vuParSeb = seanceApercu(JEUDI, PARAMETRES, SEUL_SEB)!;
    const vuParMax = seanceApercu(JEUDI, PARAMETRES, SEUL_MAX)!;
    expect(vuParSeb.blocs[1].reps).toBeGreaterThan(vuParMax.blocs[1].reps);
    expect(vuParSeb.horloge?.personne).toBe('max');
    expect(vuParMax.horloge?.personne).toBe('sebastien');
  });

  it('à deux, l’autre a pour partenaire celui qui regarde', () => {
    const apercu = seanceApercu(JEUDI, PARAMETRES, DUO_SEB)!;
    expect(apercu.horloge?.partenaire).toBe(NOM_PERSONNE.sebastien);
    expect(seanceApercu(JEUDI, PARAMETRES, DUO_MAX)!.horloge?.partenaire).toBe(NOM_PERSONNE.max);
    expect(apercu.blocs.every((b) => b.autre !== undefined)).toBe(true);
  });

  it('ne mêle rien de ce téléphone à l’écran de l’autre : pas son cran de plus', () => {
    const contexte = { ...SEUL_SEB, augmenter: ['trap-bar-deadlift'] };
    expect(essai(JEUDI, contexte).blocs[0].ajoutCharge).toBeDefined();
    expect(seanceApercu(JEUDI, PARAMETRES, contexte)!.blocs.some((b) => b.ajoutCharge !== undefined)).toBe(false);
  });

  it('dure aussi une dizaine de minutes', () => {
    for (const s of SEANCES) {
      for (const contexte of CONTEXTES) {
        const apercu = seanceApercu(s, PARAMETRES, contexte)!;
        expect(minutes(apercu)).toBeGreaterThan(6);
        expect(minutes(apercu)).toBeLessThan(15);
      }
    }
  });
});

describe('ce qui dit que rien n’est enregistré', () => {
  it('le bandeau de l’essai, et celui de l’aperçu avec le prénom de l’autre', () => {
    expect(ESSAI.genre).toBe('essai');
    expect(ESSAI.bandeau).toBe('Essai — rien n’est enregistré');
    expect(apercuDe(NOM_PERSONNE.max)).toMatchObject({
      genre: 'apercu',
      bandeau: `Aperçu : l’écran de ${NOM_PERSONNE.max} — rien n’est enregistré`,
    });
    expect(apercuDe(NOM_PERSONNE.sebastien).bandeau).toContain(NOM_PERSONNE.sebastien);
  });

  it('l’écran de fin ferme sans rien garder, en le disant', () => {
    for (const e of [ESSAI, apercuDe(NOM_PERSONNE.max)]) {
      expect(e.titreFin).toMatch(/terminé/);
      expect(e.boutonFin).toMatch(/^Terminer/);
    }
  });
});

describe('la séance commune de l’essai', () => {
  it('ajoute « -essai-N » à la séance, pour que la vraie séance du jour reste à part', () => {
    expect(identifiantSeanceEssai('jeudi', 1)).toBe('jeudi-essai-1');
    expect(identifiantSeanceEssai('lundi-a', 12)).toBe('lundi-a-essai-12');
  });

  it('respecte le format du serveur, pour toutes les séances d’un programme et tous les numéros', () => {
    const jour = isoDate(LUNDI);
    for (const graine of [1, 2, 3]) {
      for (const alternance of [true, false]) {
        for (const s of genererProgramme({ graine, aujourdhui: LUNDI, alternance }).seances) {
          expect(CLE_SERVEUR.test(`${jour}_${s.id}`)).toBe(true);
          for (const numero of [1, 2, 9, 10, 60, 123]) {
            const cle = `${jour}_${identifiantSeanceEssai(s.id, numero)}`;
            expect(CLE_SERVEUR.test(cle)).toBe(true);
            expect(cle).not.toBe(`${jour}_${s.id}`);
          }
        }
      }
    }
  });

  it('coupe l’identifiant au besoin, jamais le numéro, pour rester dans les quarante caractères', () => {
    for (const numero of [1, 7, 42, 12345]) {
      const long = identifiantSeanceEssai('a'.repeat(60), numero);
      expect(long).toHaveLength(40);
      expect(long.endsWith(`-essai-${numero}`)).toBe(true);
      expect(CLE_SERVEUR.test(`2026-10-08_${long}`)).toBe(true);
    }
    // Deux numéros ne se confondent jamais, même quand l'identifiant est coupé.
    expect(identifiantSeanceEssai('a'.repeat(60), 1)).not.toBe(identifiantSeanceEssai('a'.repeat(60), 10));
  });
});

// ------------------------------------------------------------- Quel numéro lancer ?

/** Un essai commencé à l'instant `debut` (ms), où l'on a appuyé sur « Go » à
 *  chaque nouvel exercice dès que la mise en place était finie, jusqu'à
 *  l'instant `jusqua` : l'état que garde le serveur. */
function essaiJoue(etapes: Etape[], debut: number, jusqua: number): EtatCommun {
  let etat = appliquer(null, { id: `commencer-${debut}`, a: debut, action: { type: 'commencer' } })!;
  let t = debut;
  for (const etape of etapes) {
    t += etape.dureeSec * 1000;
    if (etape.type === 'repos' && etape.manuel && etape.groupe !== undefined && t <= jusqua) {
      etat = appliquer(etat, { id: `go-${debut}-${etape.groupe}`, a: t, action: { type: 'go', groupe: etape.groupe } })!;
    }
  }
  return etat;
}

const MINUTE = 60_000;
const ESSAI_DUO = essai(JEUDI, DUO_SEB);
const ETAPES = construireEtapes(ESSAI_DUO);
const TOTAL_MS = dureeTotaleSec(ETAPES) * 1000;
/** L'essai, joué sans un retard, de l'instant 0 à sa fin. */
const FINI = essaiJoue(ETAPES, 0, TOTAL_MS);
/** L'essai que l'autre vient de lancer : « Commencer », rien d'autre. */
const VIENT_DE_COMMENCER = essaiJoue(ETAPES, 0, 0);

describe('numeroEssai', () => {
  it('l’essai joué sans retard est bien fini à la fin, pas avant', () => {
    expect(FINI.go).not.toEqual({});
    expect(numeroEssai([FINI], TOTAL_MS + 5000, ETAPES)).toBe(2);
    expect(numeroEssai([FINI], TOTAL_MS - 10_000, ETAPES)).toBe(1);
  });

  it('prend le numéro 1 quand le serveur n’a rien', () => {
    expect(numeroEssai([], 0, ETAPES)).toBe(1);
    expect(numeroEssai([null], 0, ETAPES)).toBe(1);
    expect(numeroEssai([null, null, null], 0, ETAPES)).toBe(1);
  });

  it('rejoint l’essai que l’autre vient de lancer', () => {
    expect(numeroEssai([VIENT_DE_COMMENCER], 10_000, ETAPES)).toBe(1);
    expect(numeroEssai([VIENT_DE_COMMENCER], 5 * MINUTE, ETAPES)).toBe(1);
  });

  it('ne tombe jamais sur un essai fini : il passe au numéro suivant', () => {
    expect(numeroEssai([FINI], TOTAL_MS + 1000, ETAPES)).toBe(2);
    // Même fini à l'instant, avec « Go » donné il y a moins de vingt minutes.
    expect(TOTAL_MS + 1000 - FINI.maj).toBeLessThan(ESSAI_RECENT_MS);
    expect(numeroEssai([FINI, FINI, FINI], TOTAL_MS + 1000, ETAPES)).toBe(4);
  });

  it('ne rejoint pas un essai qui n’a pas bougé depuis vingt minutes', () => {
    expect(numeroEssai([VIENT_DE_COMMENCER], ESSAI_RECENT_MS - 1, ETAPES)).toBe(1);
    expect(numeroEssai([VIENT_DE_COMMENCER], ESSAI_RECENT_MS, ETAPES)).toBe(2);
    expect(numeroEssai([VIENT_DE_COMMENCER], 3 * 60 * MINUTE, ETAPES)).toBe(2);
    // Il a bougé : les vingt minutes repartent du dernier « Go » (et tous ne sont pas donnés).
    const enRoute = essaiJoue(ETAPES, 0, 4 * MINUTE);
    expect(Object.keys(enRoute.go).length).toBeGreaterThan(0);
    expect(Object.keys(enRoute.go).length).toBeLessThan(groupesDeBlocs(ESSAI_DUO.blocs).length);
    expect(numeroEssai([enRoute], enRoute.maj + ESSAI_RECENT_MS - 1, ETAPES)).toBe(1);
    expect(numeroEssai([enRoute], enRoute.maj + ESSAI_RECENT_MS, ETAPES)).toBe(2);
  });

  it('rejoint le premier essai en cours, après des essais finis', () => {
    const maintenant = TOTAL_MS + 2 * MINUTE;
    const autre = essaiJoue(ETAPES, maintenant - 30_000, maintenant - 30_000);
    expect(numeroEssai([FINI, autre], maintenant, ETAPES)).toBe(2);
    expect(numeroEssai([FINI, FINI, autre, null], maintenant, ETAPES)).toBe(3);
  });

  it('sinon prend le premier numéro libre', () => {
    const maintenant = TOTAL_MS + 2 * MINUTE;
    expect(numeroEssai([FINI, null, FINI], maintenant, ETAPES)).toBe(2);
    expect(numeroEssai([FINI, FINI, null], maintenant, ETAPES)).toBe(3);
  });

  it('rejoint un essai en cours même quand un numéro plus petit est libre', () => {
    const maintenant = TOTAL_MS + 2 * MINUTE;
    const autre = essaiJoue(ETAPES, maintenant - 30_000, maintenant - 30_000);
    expect(numeroEssai([null, autre], maintenant, ETAPES)).toBe(2);
  });

  it('quand tout ce qui est lu est pris, c’est le numéro suivant, pas encore lu', () => {
    expect(numeroEssai([FINI, FINI], TOTAL_MS + MINUTE, ETAPES)).toBe(3);
    expect(numeroEssai([VIENT_DE_COMMENCER, FINI], 25 * MINUTE, ETAPES)).toBe(3);
  });

  it('deux téléphones qui lancent ensemble tombent sur le même numéro', () => {
    const maintenant = TOTAL_MS + 2 * MINUTE;
    const autre = essaiJoue(ETAPES, maintenant - 20_000, maintenant - 20_000);
    for (const etats of [[], [FINI], [FINI, FINI], [FINI, autre], [VIENT_DE_COMMENCER, FINI, null]]) {
      // Chacun lit à son heure : quelques secondes d'écart.
      for (const decalage of [0, 1000, 4000]) {
        expect(numeroEssai(etats, maintenant + decalage, ETAPES)).toBe(numeroEssai(etats, maintenant, ETAPES));
      }
    }
    // Le premier a commencé l'essai : le second le rejoint.
    expect(numeroEssai([FINI], maintenant, ETAPES)).toBe(2);
    expect(numeroEssai([FINI, autre], maintenant + 3000, ETAPES)).toBe(2);
  });
});

// ------------------------------------------------------------- Lire le serveur

/** Un serveur d'essai en mémoire : l'état de chaque numéro, et l'heure qu'il donne. */
function fauxServeur(etats: Record<number, EtatCommun | null>, heure: number) {
  const lues: number[] = [];
  const lire: LireSeance = async (numero) => {
    lues.push(numero);
    return { etat: etats[numero] ?? null, heure };
  };
  return { lire, lues };
}
const finis = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, FINI]));
const APRES = TOTAL_MS + 2 * MINUTE;

describe('trouverNumeroEssai', () => {
  it('lit les numéros par lots, dans l’ordre, et prend le 1 quand le serveur n’a rien', async () => {
    const serveur = fauxServeur({}, 0);
    expect(await trouverNumeroEssai(serveur.lire, ESSAI_DUO)).toBe(1);
    expect(serveur.lues).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('prend le premier numéro libre quand des essais sont finis', async () => {
    expect(await trouverNumeroEssai(fauxServeur(finis(3), APRES).lire, ESSAI_DUO)).toBe(4);
  });

  it('lit un deuxième lot quand tous les numéros du premier sont pris', async () => {
    const serveur = fauxServeur(finis(8), APRES);
    expect(await trouverNumeroEssai(serveur.lire, ESSAI_DUO)).toBe(9);
    expect(serveur.lues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('rejoint l’essai que l’autre vient de lancer', async () => {
    const autre = essaiJoue(ETAPES, APRES - 20_000, APRES - 20_000);
    const serveur = fauxServeur({ ...finis(2), 3: autre }, APRES);
    expect(await trouverNumeroEssai(serveur.lire, ESSAI_DUO)).toBe(3);
  });

  it('juge d’après l’heure du serveur, pas celle du téléphone', async () => {
    // Le téléphone est en 2026 ; le serveur de ce test vit près de l'instant 0.
    expect(await trouverNumeroEssai(fauxServeur({ 1: VIENT_DE_COMMENCER }, 30_000).lire, ESSAI_DUO)).toBe(1);
    expect(await trouverNumeroEssai(fauxServeur({ 1: VIENT_DE_COMMENCER }, 30 * MINUTE).lire, ESSAI_DUO)).toBe(2);
  });

  it('ne s’arrête pas à soixante numéros : le suivant, sans tout relire', async () => {
    const serveur = fauxServeur(finis(100), APRES);
    expect(await trouverNumeroEssai(serveur.lire, ESSAI_DUO)).toBe(61);
    expect(serveur.lues).toHaveLength(60);
  });

  it('le serveur ne répond pas : l’essai part quand même, avec le numéro 1', async () => {
    const muet: LireSeance = async () => {
      throw new Error('réseau coupé');
    };
    expect(await trouverNumeroEssai(muet, ESSAI_DUO)).toBe(1);
  });

  it('une lecture manque : on garde les numéros lus jusque-là', async () => {
    const lues: number[] = [];
    // Le numéro 3 ne répond pas ; les autres sont des essais finis.
    const lire: LireSeance = async (numero) => {
      lues.push(numero);
      if (numero === 3) throw new Error('perdu');
      return { etat: FINI, heure: APRES };
    };
    expect(await trouverNumeroEssai(lire, ESSAI_DUO)).toBe(3);
    // Au deuxième lot, c'est la première lecture qui manque.
    const serveur = fauxServeur(finis(6), APRES);
    const lireLot2: LireSeance = async (numero, signal) => {
      if (numero >= 7) throw new Error('perdu');
      return serveur.lire(numero, signal);
    };
    expect(await trouverNumeroEssai(lireLot2, ESSAI_DUO)).toBe(7);
  });

  it('n’attend jamais plus que le délai, même si le serveur ne dit rien', async () => {
    let signalRecu: AbortSignal | undefined;
    const silencieux: LireSeance = (_numero, signal) => {
      signalRecu = signal;
      return new Promise(() => {});
    };
    const debut = Date.now();
    expect(await trouverNumeroEssai(silencieux, ESSAI_DUO, 30)).toBe(1);
    expect(Date.now() - debut).toBeLessThan(1000);
    // La lecture en cours est abandonnée.
    expect(signalRecu?.aborted).toBe(true);
    expect(DELAI_SERVEUR_MS).toBeLessThanOrEqual(5000);
  });

  it('le délai court aussi d’un lot à l’autre : on garde ce qu’on a lu', async () => {
    const lire: LireSeance = (numero) =>
      numero <= 6 ? Promise.resolve({ etat: FINI, heure: APRES }) : new Promise(() => {});
    expect(await trouverNumeroEssai(lire, ESSAI_DUO, 30)).toBe(7);
  });
});

describe('lecteurDeSeanceEssai', () => {
  afterEach(() => vi.unstubAllGlobals());

  const config = { serveur: 'https://serveur.exemple.test', equipe: 'pEquipe0123456', jour: '2026-10-07', seanceId: 'jeudi' };

  it('demande au serveur la séance commune du numéro, et lit son état et son heure', async () => {
    const appels: [string, RequestInit | undefined][] = [];
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      appels.push([url, options]);
      return {
        ok: true,
        status: 200,
        json: async () => ({ etat: JSON.parse(JSON.stringify(VIENT_DE_COMMENCER)), presents: [], heure: 4242 }),
      };
    });
    const arret = new AbortController();
    const lecture = await lecteurDeSeanceEssai(config)(3, arret.signal);
    expect(appels).toHaveLength(1);
    const [url, options] = appels[0];
    expect(url).toBe('https://serveur.exemple.test/api/equipes/pEquipe0123456/seances/2026-10-07_jeudi-essai-3');
    expect(options).toMatchObject({ cache: 'no-store', signal: arret.signal });
    expect(lecture).toEqual({ etat: VIENT_DE_COMMENCER, heure: 4242 });
  });

  it('une séance qui n’existe pas encore n’a pas d’état ; une réponse abîmée non plus', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ etat: null, presents: [], heure: 7 }) }));
    expect(await lecteurDeSeanceEssai(config)(1, new AbortController().signal)).toEqual({ etat: null, heure: 7 });
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ etat: 'n’importe quoi', heure: 'tard' }) }));
    const abimee = await lecteurDeSeanceEssai(config)(1, new AbortController().signal);
    expect(abimee.etat).toBeNull();
    expect(Number.isFinite(abimee.heure)).toBe(true);
  });

  it('refuse une réponse en erreur : le serveur ne répond pas', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 502, json: async () => ({}) }));
    await expect(lecteurDeSeanceEssai(config)(1, new AbortController().signal)).rejects.toThrow('502');
  });
});

// ------------------------------------------------------------- Plusieurs essais de suite

/** Le serveur, avec les mêmes règles que le vrai : « Commencer » rejoint la
 *  séance commune quand elle a moins de trois heures. */
class ServeurEnMemoire {
  heure = 0;
  private etats = new Map<number, EtatCommun>();
  lecteur: LireSeance = async (numero) => ({ etat: this.etats.get(numero) ?? null, heure: this.heure });
  commencer(numero: number, qui: string) {
    const etat = appliquer(this.etats.get(numero) ?? null, {
      id: `commencer-${qui}-${numero}-${this.heure}`,
      a: this.heure,
      action: { type: 'commencer' },
    });
    if (etat) this.etats.set(numero, etat);
  }
  /** L'essai se joue sans retard, de son départ à sa fin. */
  jouerJusquaLaFin(numero: number, etapes: Etape[]) {
    const depart = this.etats.get(numero)!.debut;
    this.etats.set(numero, essaiJoue(etapes, depart, depart + TOTAL_MS));
    this.heure = depart + TOTAL_MS;
  }
}

describe('plusieurs essais de suite, à deux', () => {
  const sebastien = essai(JEUDI, DUO_SEB);
  const max = essai(JEUDI, DUO_MAX);
  const lancer = (serveur: ServeurEnMemoire) =>
    Promise.all([trouverNumeroEssai(serveur.lecteur, sebastien), trouverNumeroEssai(serveur.lecteur, max)]);

  it('le deuxième essai du soir ne tombe jamais sur « Essai terminé » : un nouveau numéro, le même pour les deux', async () => {
    const serveur = new ServeurEnMemoire();
    serveur.heure = 19 * 60 * MINUTE;
    for (let essaiN = 1; essaiN <= 6; essaiN += 1) {
      const [pourSebastien, pourMax] = await lancer(serveur);
      expect([pourSebastien, pourMax]).toEqual([essaiN, essaiN]);
      serveur.commencer(pourSebastien, 'sebastien');
      serveur.commencer(pourMax, 'max');
      serveur.jouerJusquaLaFin(pourSebastien, ETAPES);
      // Le temps de souffler, et on refait l'essai.
      serveur.heure += 90_000;
    }
  });

  it('celui qui lance un peu après l’autre le rejoint', async () => {
    const serveur = new ServeurEnMemoire();
    serveur.heure = 19 * 60 * MINUTE;
    const premier = await trouverNumeroEssai(serveur.lecteur, sebastien);
    serveur.commencer(premier, 'sebastien');
    serveur.heure += 40_000;
    expect(await trouverNumeroEssai(serveur.lecteur, max)).toBe(premier);
    // Même au milieu de l'essai, tant qu'il avance.
    serveur.heure += 5 * MINUTE;
    expect(await trouverNumeroEssai(serveur.lecteur, max)).toBe(premier);
  });

  it('un essai quitté en route se rejoint vingt minutes, pas davantage', async () => {
    const serveur = new ServeurEnMemoire();
    serveur.heure = 19 * 60 * MINUTE;
    const premier = await trouverNumeroEssai(serveur.lecteur, sebastien);
    serveur.commencer(premier, 'sebastien');
    serveur.heure += 10 * MINUTE;
    expect(await trouverNumeroEssai(serveur.lecteur, sebastien)).toBe(premier);
    serveur.heure += 11 * MINUTE;
    expect(await trouverNumeroEssai(serveur.lecteur, sebastien)).toBe(premier + 1);
  });

  it('Sébastien seul d’abord, puis avec Max : Max retrouve l’essai en cours, pas un vieux numéro', async () => {
    const serveur = new ServeurEnMemoire();
    serveur.heure = 19 * 60 * MINUTE;
    // Deux essais de Sébastien seul, finis.
    for (let essaiN = 1; essaiN <= 2; essaiN += 1) {
      const numero = await trouverNumeroEssai(serveur.lecteur, sebastien);
      expect(numero).toBe(essaiN);
      serveur.commencer(numero, 'sebastien');
      serveur.jouerJusquaLaFin(numero, ETAPES);
      serveur.heure += 60_000;
    }
    // Le troisième, avec Max.
    const numero = await trouverNumeroEssai(serveur.lecteur, sebastien);
    serveur.commencer(numero, 'sebastien');
    serveur.heure += 30_000;
    expect([numero, await trouverNumeroEssai(serveur.lecteur, max)]).toEqual([3, 3]);
  });
});
