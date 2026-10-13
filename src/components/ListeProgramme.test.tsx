// La liste du programme, sur un seul téléphone à deux, exercice par exercice
// (13 octobre 2026) : tout l'exercice — ou toute la paire — d'un coup, les
// visages du ressenti sur la dernière série de chacun dès l'ouverture, « J'ai
// mal » pour chacun.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ParametresSeance, Ressenti, SeanceDuMois } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes } from '../utils/etapesSeance';
import { seancePourPersonne } from '../utils/programmeMois';
import { ListeProgramme } from './SeanceGuidee';
import type { ColonneDuo, ListeProgrammeProps, QuiColonne } from './SeanceGuidee';

// La cloche se construit au chargement, avec l'audio du navigateur : hors
// navigateur, une cloche muette suffit.
vi.mock('../utils/sounds', () => ({
  bellSound: { unlock() {}, playTick() {}, playBell() {}, playSoftBell() {}, playCountdown() {}, playWarning() {} },
  vibrer() {},
}));

const PARAMETRES: ParametresSeance = { ...PARAMETRES_PAR_DEFAUT, unitePoids: 'lb' };

/** Un lundi à deux, sur le téléphone de Speedy : la trap bar seule, puis le
 *  Superman (sans charge) avec le développé épaules — Big Max en fait quatre
 *  séries (ses épaules cochées), Speedy trois —, la marche du fermier pour
 *  finir (un lundi d'avant la finale), puis la finale. */
const LUNDI: SeanceDuMois = {
  id: 'lundi',
  nom: 'Lundi — tout le corps',
  jour: 1,
  type: 'dure',
  partie: 'complet',
  format: 'series',
  exercices: ['trap-bar-deadlift', 'superman', 'shoulder-press'],
  finale: 'farmers-walk',
  liens: [['superman', 'shoulder-press']],
  tour: ['trap-bar-deadlift'],
};
const seance = seancePourPersonne(
  LUNDI,
  PARAMETRES,
  { personne: 'sebastien', aDeux: true, unTelephone: true, pointsFaibles: { sebastien: [], max: ['epaules'] } },
  new Date(2026, 9, 12),
);
const etapes = construireEtapes(seance);
const COLONNES: ColonneDuo[] = [
  { qui: 'moi', personne: 'sebastien' },
  { qui: 'autre', personne: 'max' },
];

/** L'étape d'un exercice (ou d'une paire), par son groupe. */
const exercice = (groupe: number) => etapes.findIndex((e) => e.type === 'exercice' && e.groupe === groupe);
const TRAP_BAR = exercice(0);
const PAIRE = exercice(1);

function rendre(index: number, autres: Partial<ListeProgrammeProps> = {}): string {
  return renderToStaticMarkup(
    <ListeProgramme
      seance={seance}
      etapes={etapes}
      index={index}
      colonnes={COLONNES}
      unitePoids="lb"
      saisies={() => []}
      charges={() => ({ proposee: 0, pleine: 0, allegee: 0 })}
      faites={[]}
      ressentiDe={() => undefined}
      douleur={() => false}
      onBasculerDouleur={() => {}}
      onCharge={() => {}}
      onRessenti={() => {}}
      guide={null}
      onTempo={() => {}}
      onPasser={() => {}}
      {...autres}
    />,
  );
}

/** Les groupes de visages affichés, par leur nom : « Speedy, Développé épaules ». */
const visages = (html: string) => [...html.matchAll(/aria-label="Ressenti : ([^"]+)"/g)].map((m) => m[1]);
/** Le texte, sans les balises. */
const texte = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ');

describe('la liste du programme : tout l’exercice d’un coup', () => {
  it('une paire : ses deux exercices, toutes les séries des deux — Big Max en a une de plus —, sans « Série 2 — Big Max » qui avance', () => {
    const html = rendre(PAIRE);
    const lignes = texte(html);
    expect(lignes).toContain('Superman');
    expect(lignes).toContain('Développé épaules');
    // Les séries S1 à S4 du développé épaules, d'un coup.
    for (const serie of [1, 2, 3, 4]) expect(html).toContain(`aria-label="Charge de Big Max, série ${serie} (lb)"`);
    for (const serie of [1, 2, 3]) expect(html).toContain(`aria-label="Charge de Speedy, série ${serie} (lb)"`);
    expect(html).not.toContain('aria-label="Charge de Speedy, série 4 (lb)"');
    // Plus de série en cours qui avance.
    expect(lignes).not.toMatch(/▶/);
    expect(lignes).not.toContain('Série 2 —');
    // Ce qu'il y a à faire, et la pause de fin, lancée par « Paire terminée ».
    expect(lignes).toContain('A, B, A, B, les deux, sans pause entre les tours');
    expect(lignes).toContain('« Paire terminée »');
    // Le Superman, sans charge : ce qu'il y a à faire, pas de case de poids.
    expect(lignes).toMatch(/10 rép\./);
    expect(html).not.toContain('Charge de Speedy, série 1 (lb)" value="" name="superman');
    // « Passer cette paire », en petit, sous la carte.
    expect(lignes).toContain('Passer cette paire');
  });

  it('un exercice seul, à deux : chacun son tour, et la pause entre les tours se prend d’un toucher, en bas', () => {
    const lignes = texte(rendre(TRAP_BAR));
    expect(lignes).toContain('Chacun son tour : Big Max commence');
    expect(lignes).toContain('Entre les tours : « Pause », en bas, quand vous voulez');
    expect(lignes).toContain('À la fin : 1 min 30 de pause, lancée par « Exercice terminé »');
    // La marche du fermier, la dernière : elle enchaîne ses tours, puis la
    // finale — et après elle, les étirements.
    const fermier = texte(rendre(exercice(2)));
    expect(fermier).toContain('sans pause entre les tours');
    expect(fermier).not.toContain('Entre les tours');
    expect(fermier).toContain('Pas de pause à la fin : la finale suit');
    expect(fermier).toMatch(/Ensuite Finale · 10 min\s+Étirements/);
  });

  it('les charges pré-remplies dans chaque case ; les raccourcis 70 % et 100 % attendent qu’on touche une case', () => {
    const charges = (qui: QuiColonne, _id: string, serie: number) => ({
      proposee: qui === 'autre' ? 23 : 20 + serie,
      pleine: 23,
      allegee: 15,
    });
    const html = rendre(TRAP_BAR, { charges });
    expect(html).toMatch(/aria-label="Charge de Big Max, série 2 \(lb\)"[^>]*value="23"/);
    expect(html).toMatch(/aria-label="Charge de Speedy, série 3 \(lb\)"[^>]*value="23"/);
    expect(html).not.toContain('aria-label="Charge faite"');
    // Une fois l'exercice fini : la case dit ce qui est noté, rien d'autre.
    const fini = rendre(TRAP_BAR, { charges, faites: [TRAP_BAR], saisies: (qui) => (qui === 'autre' ? [225, 225, 230] : []) });
    expect(fini).toMatch(/aria-label="Charge de Big Max, série 3 \(lb\)"[^>]*value="230"/);
    expect(fini).toMatch(/aria-label="Charge de Speedy, série 1 \(lb\)"[^>]*value=""/);
  });

  it('« Tempo », en petit, sur chaque exercice ; le métronome vient dans celui qu’on a choisi', () => {
    const html = rendre(PAIRE, { guide: { exerciceId: 'shoulder-press', noeud: <p>GUIDE-DU-TEMPO</p> } });
    expect(html).toContain('aria-label="Tempo : Superman, sans poids"');
    expect(html).toContain('aria-label="Arrêter le tempo : Développé épaules"');
    expect(html.match(/GUIDE-DU-TEMPO/g)).toHaveLength(1);
    expect(html.indexOf('GUIDE-DU-TEMPO')).toBeGreaterThan(html.indexOf('Développé épaules'));
    // Pendant la pause de fin, plus de « Tempo », plus de « Passer ».
    const pause = rendre(PAIRE + 1);
    expect(texte(pause)).toContain('Pause en cours');
    expect(pause).not.toContain('aria-label="Tempo : Superman, sans poids"');
    expect(texte(pause)).not.toContain('Passer cette paire');
  });
});

describe('la liste du programme : les visages du ressenti', () => {
  it('jamais sur les premières séries : sur la dernière de chacun, dès que l’exercice s’ouvre', () => {
    // La paire : Speedy sous sa 3e, Big Max sous sa 4e — tout de suite.
    expect(visages(rendre(PAIRE))).toEqual(['Speedy, Développé épaules', 'Big Max, Développé épaules']);
    // Le Superman, sans charge : rien à monter, pas de visages.
    expect(visages(rendre(PAIRE)).some((nom) => nom.includes('Superman'))).toBe(false);
    // La trap bar : les deux, sous leur 3e série.
    expect(visages(rendre(TRAP_BAR))).toEqual(['Speedy, Soulevé de terre à la trap bar', 'Big Max, Soulevé de terre à la trap bar']);
    // Pendant la pause de fin : toujours là, on peut corriger.
    expect(visages(rendre(PAIRE + 1))).toEqual(['Speedy, Développé épaules', 'Big Max, Développé épaules']);
  });

  it('sur la ligne de la dernière série, avec trois gros visages et l’aide, une fois', () => {
    const html = rendre(PAIRE);
    const ligne = (serie: number) => html.search(new RegExp(`>S(<!-- -->)?${serie}<`));
    const groupeSpeedy = html.indexOf('aria-label="Ressenti : Speedy, Développé épaules"');
    const groupeMax = html.indexOf('aria-label="Ressenti : Big Max, Développé épaules"');
    // Ceux de Speedy sous la ligne S3, avant S4 ; ceux de Big Max sous S4.
    const developpe = html.indexOf('Développé épaules</h3>');
    const s3 = html.slice(developpe).search(/>S(<!-- -->)?3</) + developpe;
    const s4 = html.slice(developpe).search(/>S(<!-- -->)?4</) + developpe;
    expect(ligne(3)).toBeGreaterThan(0);
    expect(groupeSpeedy).toBeGreaterThan(s3);
    expect(groupeSpeedy).toBeLessThan(s4);
    expect(groupeMax).toBeGreaterThan(s4);
    // Trois visages, de gauche à droite, assez grands pour le doigt.
    const apres = html.slice(groupeSpeedy);
    expect([...apres.matchAll(/<span aria-hidden="true">(😊|😐|☹️)<\/span>/g)].slice(0, 3).map((m) => m[1])).toEqual(['😊', '😐', '☹️']);
    expect(html).toContain('min-h-12');
    expect(texte(html).match(/La dernière série doit être dure : 1 à 3 répétitions en réserve\./g)).toHaveLength(1);
  });

  it('montre le visage choisi par chacun, la même donnée qu’avant', () => {
    const ressentiDe = (qui: QuiColonne, exerciceId: string): Ressenti | undefined =>
      exerciceId === 'shoulder-press' ? (qui === 'moi' ? 'leger' : 'lourd') : undefined;
    const html = rendre(PAIRE, { ressentiDe });
    expect(html).toMatch(/aria-pressed="true" aria-label="Facile \(léger\)"/);
    expect(html).toMatch(/aria-pressed="true" aria-label="Difficile \(lourd\)"/);
    expect(html.match(/aria-pressed="true" aria-label="(Facile|Correct|Difficile)/g)).toHaveLength(2);
  });

  it('« Exercice terminé » touché sans eux : les visages qui manquent sont entourés, les autres non', () => {
    const html = rendre(PAIRE, { manquants: [{ qui: 'autre', exerciceId: 'shoulder-press' }] });
    const entoure = (id: string) => new RegExp(`id="${id}"[^>]*style="outline:2px solid var\\(--alerte\\)`).test(html);
    expect(entoure('visages-autre-shoulder-press')).toBe(true);
    expect(entoure('visages-moi-shoulder-press')).toBe(false);
    expect(html).toContain('id="visages-moi-shoulder-press"');
  });
});

describe('la liste du programme : « J’ai mal », pour chacun', () => {
  it('un petit interrupteur par colonne, sous les noms ; la douleur de Big Max n’allume que le sien', () => {
    const douleur = (qui: QuiColonne, exerciceId: string) => qui === 'autre' && exerciceId === 'shoulder-press';
    const html = rendre(PAIRE, { douleur });
    const developpe = html.slice(html.indexOf('Développé épaules</h3>'));
    expect(developpe).toMatch(/aria-pressed="false" aria-label="Speedy : j’ai mal à cet exercice"/);
    expect(developpe).toMatch(/aria-pressed="true" aria-label="Big Max : j’ai mal à cet exercice"/);
    // Allumé : charges à 70 %.
    expect(html).toContain('Douleur · 70 %');
    // Sans charge (le Superman), la douleur n'est qu'un repère.
    const superman = rendre(PAIRE, { douleur: (qui, id) => qui === 'moi' && id === 'superman' });
    expect(superman).toMatch(/aria-pressed="true" aria-label="Speedy : j’ai mal à cet exercice"/);
    // Aperçu de l'autre, ou une posture : on ne peut pas le signaler d'ici.
    expect(rendre(PAIRE, { onBasculerDouleur: undefined })).not.toContain('j’ai mal à cet exercice');
  });
});
