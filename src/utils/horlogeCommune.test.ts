import { describe, expect, it } from 'vitest';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes, dureeTotaleSec } from './etapesSeance';
import type { Etape } from './etapesSeance';
import { EXPIRATION_MS, appliquer, enPause, lireEnvoi, lireEtat, tempsActifMs } from './etatCommun';
import type { ActionCommune, EtatCommun } from './etatCommun';
import {
  decisionPasserExercice,
  decisionProlonger,
  decisionSuivant,
  perspectiveAutre,
  positionAffichee,
  positionCommune,
  tempsDesEtapesQuittees,
} from './horlogeCommune';
import type { Contexte, Ecart } from './horlogeCommune';
import { basculerTour, delierDansProgramme, genererProgramme, seancePourPersonne } from './programmeMois';

const programme = genererProgramme({ graine: 3, aujourdhui: new Date(2026, 9, 5) });
// La trap bar séparée de sa paire : seule, chacun son tour, Max d'abord.
// L'exercice qui la suit se fait seul aussi, côte à côte.
const jeudi = delierDansProgramme(programme, 'jeudi', 'trap-bar-deadlift').seances.find((s) => s.id === 'jeudi')!;
const parametres = { ...PARAMETRES_PAR_DEFAUT, tempo: { monteeSec: 3, descenteSec: 3, pauseSec: 2 } };
const seanceSeb = seancePourPersonne(jeudi, parametres, { personne: 'sebastien', aDeux: true });
const seanceMax = seancePourPersonne(jeudi, parametres, { personne: 'max', aDeux: true });
const etapesSeb = construireEtapes(seanceSeb);
const etapesMax = construireEtapes(seanceMax);

let compteur = 0;
const envoi = (action: ActionCommune, a: number) => ({ id: `envoi-${(compteur += 1)}`, a, action });

/** Une séance commencée à l'instant 0. */
const depart = (): EtatCommun => appliquer(null, envoi({ type: 'commencer' }, 0))!;
const avecGo = (etat: EtatCommun, groupe: number, a: number) => appliquer(etat, envoi({ type: 'go', groupe }, a))!;

/** L'instant (ms) où commence l'étape `index`, pour qui suit le temps prévu
 *  depuis `instant`, en partant de l'étape `depuis`. */
const debutEtape = (etapes: Etape[], depuis: number, index: number, instant = 0) =>
  instant + etapes.slice(depuis, index).reduce((total, e) => total + e.dureeSec, 0) * 1000;
const installation = (etapes: Etape[], groupe: number) =>
  etapes.findIndex((e) => e.type === 'repos' && e.manuel === true && e.groupe === groupe);

describe('l’état commun', () => {
  it('commence une fois, puis on le rejoint ; trois heures plus tard, on repart de zéro', () => {
    const etat = depart();
    expect(etat).toMatchObject({ debut: 0, go: {}, pauses: [], sauts: [] });
    expect(appliquer(etat, envoi({ type: 'commencer' }, 60_000))).toBe(etat);
    expect(appliquer(etat, envoi({ type: 'commencer' }, EXPIRATION_MS + 1))?.debut).toBe(EXPIRATION_MS + 1);
    expect(appliquer(null, envoi({ type: 'pause' }, 5))).toBeNull();
  });

  it('un « Go » ne compte qu’une fois, un envoi répété non plus', () => {
    const etat = avecGo(depart(), 0, 1000);
    expect(avecGo(etat, 0, 5000).go['0']).toBe(1000);
    const saut = envoi({ type: 'saut', depuis: 1000, cible: 11 }, 2000);
    const une = appliquer(etat, saut)!;
    expect(appliquer(une, saut)).toBe(une);
    expect(une.sauts).toEqual([{ a: 2000, sec: 10 }]);
  });

  it('met en pause et reprend pour les deux ; un « Go » pendant la pause la finit', () => {
    let etat = appliquer(depart(), envoi({ type: 'pause' }, 10_000))!;
    expect(enPause(etat)).toBe(true);
    expect(appliquer(etat, envoi({ type: 'pause' }, 11_000))).toBe(etat);
    etat = avecGo(etat, 0, 25_000);
    expect(enPause(etat)).toBe(false);
    expect(etat.pauses).toEqual([{ debut: 10_000, fin: 25_000 }]);
  });

  it('compte le temps commun sans les pauses, avec les sauts', () => {
    let etat = appliquer(depart(), envoi({ type: 'pause' }, 10_000))!;
    etat = appliquer(etat, envoi({ type: 'reprendre' }, 40_000))!;
    etat = appliquer(etat, envoi({ type: 'saut', depuis: 0, cible: 35 }, 50_000))!;
    expect(tempsActifMs(etat, 0, 60_000)).toBe(60_000 - 30_000 + 15_000);
    expect(tempsActifMs(etat, 0, 60_000, false)).toBe(30_000);
    expect(tempsActifMs(etat, 0, 20_000)).toBe(10_000);
  });

  it('ne retire jamais deux fois le même arrêt ; une pause en retard ne réécrit pas le passé', () => {
    const chevauche = { ...depart(), pauses: [{ debut: 100_000, fin: 200_000 }, { debut: 150_000, fin: 250_000 }] };
    expect(tempsActifMs(chevauche, 0, 300_000)).toBe(150_000);
    let etat = appliquer(depart(), envoi({ type: 'pause' }, 100_000))!;
    etat = appliquer(etat, envoi({ type: 'reprendre' }, 200_000))!;
    // Appuyée à 150 s hors ligne, arrivée après la reprise : elle part de là.
    etat = appliquer(etat, envoi({ type: 'pause' }, 150_000))!;
    expect(etat.pauses).toEqual([{ debut: 100_000, fin: 200_000 }, { debut: 200_000 }]);
  });

  it('relit ce qui vient du réseau, et écarte ce qui ne tient pas debout', () => {
    const etat = avecGo(depart(), 2, 9000);
    expect(lireEtat(JSON.parse(JSON.stringify(etat)))).toEqual(etat);
    expect(lireEtat({ debut: 'hier' })).toBeNull();
    expect(lireEtat({ ...etat, go: { '2': 9000, constructor: 1, 'x': 2 } })?.go).toEqual({ '2': 9000 });
    expect(lireEnvoi({ id: 'abcdef12', a: 5, action: { type: 'go', groupe: 1 } })).not.toBeNull();
    expect(lireEnvoi({ id: 'abcdef12', a: 5, action: { type: 'go', groupe: -1 } })).toBeNull();
    expect(lireEnvoi({ id: 'abcdef12', a: 5, action: { type: 'saut', sec: 99999 } })).toBeNull();
    expect(lireEnvoi({ id: 'abcdef12', a: 5, action: { type: 'saut', depuis: 0, cible: 40 } })).not.toBeNull();
    expect(lireEnvoi({ id: 'abcdef12', a: 5, action: { type: 'prolonger', sec: 15 } })).not.toBeNull();
    expect(lireEnvoi({ id: 'abcdef12', a: 5, action: { type: 'prolonger', sec: 9999 } })).toBeNull();
    expect(lireEnvoi({ id: 'x', a: 5, action: { type: 'pause' } })).toBeNull();
    expect(lireEnvoi({ id: 'abcdef12', a: 5, action: { type: 'effacer' } })).toBeNull();
  });
});

describe('la position sur l’horloge commune', () => {
  it('déroule l’échauffement puis attend « Go » à l’installation, en laissant courir le temps', () => {
    const etat = depart();
    expect(positionCommune(etapesSeb, etat, 30_000)).toEqual({ index: 0, ecouleSec: 30 });
    const go0 = installation(etapesSeb, 0);
    const finEchauffement = debutEtape(etapesSeb, 0, go0);
    expect(positionCommune(etapesSeb, etat, finEchauffement + 100_000)).toEqual({ index: go0, ecouleSec: 100 });
  });

  it('après « Go », Max commence et Sébastien attend la série de Max, à la même seconde', () => {
    const etat = avecGo(depart(), 0, 1_000_000);
    const seb = positionCommune(etapesSeb, etat, 1_002_000);
    const max = positionCommune(etapesMax, etat, 1_002_000);
    expect(etapesMax[max.index].type).toBe('pret');
    expect(etapesSeb[seb.index]).toMatchObject({ type: 'repos', motif: 'tour' });
    expect(seb.ecouleSec).toBe(2);
    expect(max.ecouleSec).toBe(2);
  });

  it('les deux téléphones arrivent ensemble à chaque installation, jusqu’aux étirements', () => {
    // On appuie sur « Go » dès que l'installation est finie, exercice après
    // exercice.
    let etat = depart();
    let t = debutEtape(etapesSeb, 0, installation(etapesSeb, 0));
    const groupes = etapesSeb.filter((e) => e.type === 'repos' && e.manuel === true).length;
    for (let g = 0; g < groupes; g += 1) {
      const ici = installation(etapesSeb, g);
      expect(etapesSeb[positionCommune(etapesSeb, etat, t + 1000).index]).toMatchObject({ manuel: true, groupe: g });
      expect(etapesMax[positionCommune(etapesMax, etat, t + 1000).index]).toMatchObject({ manuel: true, groupe: g });
      t += etapesSeb[ici].dureeSec * 1000;
      etat = avecGo(etat, g, t);
      const suivante = g + 1 < groupes ? installation(etapesSeb, g + 1) : etapesSeb.findIndex((e) => e.type === 'retourCalme');
      t = debutEtape(etapesSeb, ici + 1, suivante, t);
    }
    expect(etapesSeb[positionCommune(etapesSeb, etat, t + 1000).index].type).toBe('retourCalme');
    expect(etapesMax[positionCommune(etapesMax, etat, t + 1000).index].type).toBe('retourCalme');
  });

  it('la pause fige les deux téléphones', () => {
    let etat = avecGo(depart(), 0, 1_000_000);
    etat = appliquer(etat, envoi({ type: 'pause' }, 1_010_000))!;
    const avant = positionCommune(etapesMax, etat, 1_010_000);
    expect(positionCommune(etapesMax, etat, 1_500_000)).toEqual(avant);
  });

  it('du point de vue de l’autre, les étapes sont celles de son téléphone', () => {
    const autre = construireEtapes(perspectiveAutre(seanceSeb)!);
    expect(autre.map((e) => [e.type, e.dureeSec, e.exerciceId])).toEqual(etapesMax.map((e) => [e.type, e.dureeSec, e.exerciceId]));
    expect(dureeTotaleSec(autre)).toBe(dureeTotaleSec(etapesSeb));
    expect(perspectiveAutre(seancePourPersonne(jeudi, parametres, { personne: 'sebastien' }))).toBeNull();
  });
});

describe('les boutons, à deux', () => {
  const contexte = (etapes: Etape[], etapesAutre: Etape[], etat: EtatCommun, t: number, partenaire: string): Contexte => {
    const { position } = positionAffichee(etapes, etat, t, null);
    return { etapes, etapesAutre, etat, t, position, partenaire };
  };
  const etat = avecGo(depart(), 0, 1_000_000);

  it('pendant la série de Max à la trap bar, le « Suivant » de Sébastien ne coupe rien', () => {
    const decision = decisionSuivant(contexte(etapesSeb, etapesMax, etat, 1_020_000, 'Max'));
    expect(decision).toEqual({ genre: 'refus', raison: 'Max finit sa série.' });
  });

  it('Max finit sa série plus tôt : Sébastien commence plus tôt', () => {
    const t = 1_020_000;
    const ctx = contexte(etapesMax, etapesSeb, etat, t, 'Sébastien');
    expect(etapesMax[ctx.position.index].type).toBe('serie');
    const decision = decisionSuivant(ctx);
    expect(decision).toMatchObject({ genre: 'commune', action: { type: 'saut', depuis: 1_000_000 } });
    // Appliqué : les deux téléphones passent à l'étape suivante de Max.
    const apres = appliquer(etat, envoi((decision as { action: ActionCommune }).action, t))!;
    expect(positionCommune(etapesMax, apres, t).index).toBe(ctx.position.index + 1);
  });

  it('côte à côte, finir sa série plus tôt donne plus de repos, sans toucher l’autre', () => {
    // L'exercice d'après la trap bar se fait côte à côte.
    const g1 = installation(etapesSeb, 1);
    const commun = avecGo(etat, 1, 2_000_000);
    const tSerie = 2_000_000 + 6_000; // la préparation passée
    const ctx = contexte(etapesSeb, etapesMax, commun, tSerie, 'Max');
    expect(etapesSeb[ctx.position.index]).toMatchObject({ type: 'serie', groupe: 1 });
    const decision = decisionSuivant(ctx);
    expect(decision.genre).toBe('locale');
    const ecart = (decision as { ecart: { vers: number; depuis: number } }).ecart;
    // L'attente qui suit dure d'autant plus, et finit à la même seconde.
    const { position, ecart: tenu } = positionAffichee(etapesSeb, commun, tSerie + 1000, ecart);
    expect(etapesSeb[position.index].type).toBe('repos');
    expect(position.ecouleSec).toBeLessThan(0);
    expect(tenu).not.toBeNull();
    // Max, lui, est toujours dans sa série.
    expect(etapesMax[positionCommune(etapesMax, commun, tSerie + 1000).index].type).toBe('serie');
    // Quand l'horloge commune rattrape l'attente, l'écart tombe.
    const finSerie = debutEtape(etapesSeb, g1 + 1, ctx.position.index + 1, 2_000_000) + 500;
    expect(positionAffichee(etapesSeb, commun, finSerie, ecart).ecart).toBeNull();
  });

  it('à l’installation, « Go » lance l’exercice pour les deux — et demande si l’autre n’a pas fini', () => {
    const g1 = installation(etapesSeb, 1);
    const tDansTrapBar = 1_100_000;
    // Sébastien a passé l'exercice : il est à l'installation, Max non.
    const passe = decisionPasserExercice(contexte(etapesSeb, etapesMax, etat, tDansTrapBar, 'Max'));
    expect(passe).toEqual({ genre: 'locale', ecart: { vers: g1, depuis: tDansTrapBar } });
    const { position } = positionAffichee(etapesSeb, etat, tDansTrapBar, (passe as { ecart: { vers: number; depuis: number } }).ecart);
    expect(position.index).toBe(g1);
    const enAvance = decisionSuivant({ etapes: etapesSeb, etapesAutre: etapesMax, etat, t: tDansTrapBar, position, partenaire: 'Max' });
    expect(enAvance).toMatchObject({ genre: 'commune', action: { type: 'go', groupe: 1 } });
    expect((enAvance as { confirmer?: string }).confirmer).toMatch(/Max n’a pas fini/);
    // Tous les deux à l'installation : pas de question.
    const tous = debutEtape(etapesSeb, installation(etapesSeb, 0) + 1, g1, 1_000_000) + 2000;
    const ensemble = decisionSuivant(contexte(etapesSeb, etapesMax, etat, tous, 'Max'));
    expect(ensemble).toEqual({ genre: 'commune', action: { type: 'go', groupe: 1 } });
  });

  it('pendant l’échauffement et les repos à deux, « Suivant » fait repartir les deux', () => {
    const debut = depart();
    expect(decisionSuivant(contexte(etapesSeb, etapesMax, debut, 60_000, 'Max'))).toMatchObject({
      genre: 'commune',
      action: { type: 'saut' },
    });
  });

  it('« +15 s » vaut pour les deux, sauf pendant la série de l’autre', () => {
    expect(decisionProlonger(contexte(etapesSeb, etapesMax, etat, 1_020_000, 'Max'), 15)).toEqual({
      genre: 'refus',
      raison: 'Max est en pleine série.',
    });
    const tInstallation = debutEtape(etapesSeb, installation(etapesSeb, 0) + 1, installation(etapesSeb, 1), 1_000_000) + 2000;
    expect(decisionProlonger(contexte(etapesSeb, etapesMax, etat, tInstallation, 'Max'), 15)).toEqual({
      genre: 'commune',
      action: { type: 'prolonger', sec: 15 },
    });
  });

  // À la trap bar, chacun son tour : Max finit sa série 1 à 85 s ; Sébastien
  // l'attend jusqu'à 100 s (le changement de machine), puis fait la sienne.
  const tAttenteMax = 1_000_000 + 88_000;

  it('« Suivant » pendant une attente ne saute jamais la série de l’autre', () => {
    const ctx = contexte(etapesMax, etapesSeb, etat, tAttenteMax, 'Sébastien');
    expect(etapesMax[ctx.position.index]).toMatchObject({ type: 'repos', motif: 'tour' });
    const decision = decisionSuivant(ctx);
    const apres = appliquer(etat, envoi((decision as { action: ActionCommune }).action, tAttenteMax))!;
    // Sébastien attaque sa préparation, au début ; Max attend toujours.
    const seb = positionCommune(etapesSeb, apres, tAttenteMax);
    expect(etapesSeb[seb.index].type).toBe('pret');
    expect(seb.ecouleSec).toBeCloseTo(0, 6);
    expect(positionCommune(etapesMax, apres, tAttenteMax).index).toBe(ctx.position.index);
  });

  it('deux « Suivant » au même repos, un sur chaque téléphone, ne comptent qu’une fois', () => {
    // Côte à côte : les deux se reposent en même temps, jusqu'à 175 s.
    const t1 = 2_000_000;
    const commun = avecGo(etat, 1, t1);
    const t = t1 + 100_000;
    const deSeb = decisionSuivant(contexte(etapesSeb, etapesMax, commun, t, 'Max'));
    const deMax = decisionSuivant(contexte(etapesMax, etapesSeb, commun, t + 300, 'Sébastien'));
    let apres = appliquer(commun, envoi((deSeb as { action: ActionCommune }).action, t))!;
    apres = appliquer(apres, envoi((deMax as { action: ActionCommune }).action, t + 300))!;
    expect(apres.sauts).toHaveLength(1);
    // Le même appui, arrivé dix secondes plus tard d'un téléphone hors ligne :
    // rien ne bouge.
    expect(appliquer(apres, envoi((deSeb as { action: ActionCommune }).action, t + 10_000))).toBe(apres);
    const seb = positionCommune(etapesSeb, apres, t + 1000);
    expect(etapesSeb[seb.index]).toMatchObject({ type: 'pret', groupe: 1 });
    expect(seb.ecouleSec).toBeCloseTo(1, 6);
  });

  it('« +15 s » arrête l’horloge un moment, sans revenir en arrière', () => {
    const decision = decisionProlonger(contexte(etapesMax, etapesSeb, etat, tAttenteMax, 'Sébastien'), 15);
    expect(decision).toEqual({ genre: 'commune', action: { type: 'prolonger', sec: 15 } });
    const apres = appliquer(etat, envoi({ type: 'prolonger', sec: 15 }, tAttenteMax))!;
    const attente = positionCommune(etapesMax, etat, tAttenteMax).index;
    expect(positionCommune(etapesMax, apres, tAttenteMax + 1000)).toEqual({ index: attente, ecouleSec: 3 });
    expect(positionCommune(etapesMax, apres, tAttenteMax + 20_000)).toEqual({ index: attente, ecouleSec: 8 });
    // Deux appuis : deux fois plus.
    const deux = appliquer(apres, envoi({ type: 'prolonger', sec: 15 }, tAttenteMax + 2000))!;
    expect(positionCommune(etapesMax, deux, tAttenteMax + 30_000)).toEqual({ index: attente, ecouleSec: 3 });
  });

  it('une série commencée à son rythme se finit à son rythme', () => {
    const t1 = 2_000_000;
    const commun = avecGo(etat, 1, t1);
    const ctx = contexte(etapesSeb, etapesMax, commun, t1 + 1000, 'Max');
    expect(etapesSeb[ctx.position.index].type).toBe('pret');
    const decision = decisionSuivant(ctx);
    expect(decision.genre).toBe('locale');
    // L'horloge commune entre dans la série à 5 s ; à 6 s, on en est à 5 s.
    const { position, ecart } = positionAffichee(etapesSeb, commun, t1 + 6000, (decision as { ecart: Ecart }).ecart);
    expect(position).toEqual({ index: ctx.position.index + 1, ecouleSec: 5 });
    expect(ecart).not.toBeNull();
  });
});

describe('le temps passé sur les étapes', () => {
  const serie1 = installation(etapesMax, 0) + 2;

  it('écran éteint, les étapes franchies comptent ; un exercice passé, non', () => {
    // Max : sa série 1 à 5 s, puis l'écran s'éteint trois minutes.
    expect(tempsDesEtapesQuittees(etapesMax, { index: serie1, ecouleSec: 5 }, { index: serie1 + 3, ecouleSec: 1 }, 180)).toEqual([
      [serie1, 80],
      [serie1 + 1, 99],
      [serie1 + 2, 5],
    ]);
    // « Passer l'exercice » en pleine série : les séries suivantes ne comptent pas.
    const passe = tempsDesEtapesQuittees(etapesMax, { index: serie1, ecouleSec: 20 }, { index: serie1 + 8, ecouleSec: 0 }, 0);
    expect(passe[0]).toEqual([serie1, 20]);
    expect(passe.slice(1).every(([, sec]) => sec === 0)).toBe(true);
  });

  it('une installation où l’on a attendu « Go » compte tout ce temps', () => {
    const ici = installation(etapesMax, 0);
    expect(tempsDesEtapesQuittees(etapesMax, { index: ici, ecouleSec: 200 }, { index: ici + 1, ecouleSec: 0 }, 0.08)).toEqual([[ici, 200]]);
  });
});

describe('on se croise, aussi le lundi et le mardi', () => {
  for (const id of ['lundi-a', 'mardi-a']) {
    it(`${id} : une machine dans la paire, Max la prend, Sébastien fait l’autre exercice, puis on échange`, () => {
      const [premier, second] = programme.seances.find((s) => s.id === id)!.liens![0];
      const seanceMois = basculerTour(programme, id, premier).seances.find((s) => s.id === id)!;
      const pourSeb = seancePourPersonne(seanceMois, parametres, { personne: 'sebastien', aDeux: true });
      const seb = construireEtapes(pourSeb);
      const max = construireEtapes(seancePourPersonne(seanceMois, parametres, { personne: 'max', aDeux: true }));
      // Le téléphone de Sébastien voit les étapes de Max telles que Max les voit.
      const vuesParSeb = construireEtapes(perspectiveAutre(pourSeb)!);
      expect(vuesParSeb.map((e) => [e.type, e.dureeSec, e.exerciceId])).toEqual(max.map((e) => [e.type, e.dureeSec, e.exerciceId]));
      // Dix secondes après « Go » : chacun dans sa série, pas sur le même exercice.
      const go = 1_000_000;
      const etat = avecGo(depart(), 0, go);
      const ici = (etapes: Etape[]) => etapes[positionCommune(etapes, etat, go + 10_000).index];
      expect(ici(max)).toMatchObject({ type: 'serie', exerciceId: premier });
      expect(ici(seb)).toMatchObject({ type: 'serie', exerciceId: second });
      // Puis on échange, à chaque tour.
      const ordre = (etapes: Etape[]) => etapes.filter((e) => e.type === 'serie' && e.groupe === 0).map((e) => e.exerciceId);
      expect(ordre(max).slice(0, 4)).toEqual([premier, second, premier, second]);
      expect(ordre(seb).slice(0, 4)).toEqual([second, premier, second, premier]);
      // Pendant sa série, le « Suivant » de Sébastien ne coupe pas celle de Max.
      const position = positionCommune(seb, etat, go + 10_000);
      const decision = decisionSuivant({ etapes: seb, etapesAutre: max, etat, t: go + 10_000, position, partenaire: 'Max' });
      expect(decision.genre).toBe('locale');
    });
  }
});
