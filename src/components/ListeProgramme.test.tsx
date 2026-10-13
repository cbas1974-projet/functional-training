// La liste du programme, sur un seul téléphone à deux : les visages du
// ressenti sur la dernière série de chacun, et « J'ai mal » pour chacun.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ParametresSeance, Ressenti, SeanceDuMois } from '../types';
import { PARAMETRES_PAR_DEFAUT } from '../data/parametres';
import { construireEtapes } from '../utils/etapesSeance';
import type { Etape } from '../utils/etapesSeance';
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
 *  séries, Speedy trois. */
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
const seance = seancePourPersonne(LUNDI, PARAMETRES, { personne: 'sebastien', aDeux: true, unTelephone: true }, new Date(2026, 9, 12));
const etapes = construireEtapes(seance);
const COLONNES: ColonneDuo[] = [
  { qui: 'moi', personne: 'sebastien' },
  { qui: 'autre', personne: 'max' },
];

type Serie = Extract<Etape, { type: 'serie' }>;
/** La place d'une série dans les étapes. */
const place = (exerciceId: string, serie: number, qui?: string) =>
  etapes.findIndex((e) => e.type === 'serie' && e.exerciceId === exerciceId && e.serie === serie && (qui === undefined || e.qui === qui));

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
      onPasser={() => {}}
      {...autres}
    />,
  );
}

/** Les groupes de visages affichés, par leur nom : « Speedy, Développé épaules ». */
const visages = (html: string) => [...html.matchAll(/aria-label="Ressenti : ([^"]+)"/g)].map((m) => m[1]);

describe('la liste du programme : les visages du ressenti', () => {
  it('jamais sur les premières séries : seulement sur la dernière de chacun, dès qu’elle commence', () => {
    // Développé épaules, séries 1 et 2 : aucun visage.
    expect(etapes[place('shoulder-press', 1)]).toMatchObject({ type: 'serie', qui: 'les-deux' });
    expect(visages(rendre(place('shoulder-press', 1)))).toEqual([]);
    expect(visages(rendre(place('shoulder-press', 2)))).toEqual([]);
    // Série 3 : la dernière de Speedy ; Big Max en a encore une.
    expect(visages(rendre(place('shoulder-press', 3)))).toEqual(['Speedy, Développé épaules']);
    // Série 4, celle de Big Max seul : les deux.
    expect((etapes[place('shoulder-press', 4)] as Serie).qui).toBe('autre');
    expect(visages(rendre(place('shoulder-press', 4)))).toEqual(['Speedy, Développé épaules', 'Big Max, Développé épaules']);
    // Pendant la pause de la paire : toujours là, on peut le dire après.
    const pause = etapes.findIndex((e, i) => i > place('shoulder-press', 4) && e.type === 'repos' && e.motif === 'a-lancer');
    expect(visages(rendre(pause))).toEqual(['Speedy, Développé épaules', 'Big Max, Développé épaules']);
    // Le Superman, sans charge : rien à monter, pas de visages, même sur sa
    // dernière série.
    expect(place('superman', 3)).toBeGreaterThan(0);
    expect(visages(rendre(place('superman', 3)))).toEqual([]);
    expect(visages(rendre(pause)).some((nom) => nom.includes('Superman'))).toBe(false);
  });

  it('sur la ligne de la dernière série, avec trois gros visages et l’aide, une fois', () => {
    const html = rendre(place('shoulder-press', 3));
    // Sous la ligne S3, avant la ligne S4.
    const s3 = html.search(/S(<!-- -->)?3</);
    const s4 = html.search(/S(<!-- -->)?4</);
    const groupe = html.indexOf('aria-label="Ressenti : Speedy, Développé épaules"');
    expect(s3).toBeGreaterThan(0);
    expect(groupe).toBeGreaterThan(s3);
    expect(groupe).toBeLessThan(s4);
    // Trois visages, de gauche à droite, assez grands pour le doigt.
    const apres = html.slice(groupe);
    expect([...apres.matchAll(/<span aria-hidden="true">(😊|😐|☹️)<\/span>/g)].slice(0, 3).map((m) => m[1])).toEqual(['😊', '😐', '☹️']);
    expect(html).toContain('min-h-12');
    const texte = html.replace(/<[^>]+>/g, '');
    expect(texte.match(/La dernière série doit être dure : 1 à 3 répétitions en réserve\./g)).toHaveLength(1);
  });

  it('chacun son tour, seul : les visages de Big Max sur sa dernière série, puis ceux de Speedy sur la sienne', () => {
    // La trap bar : Big Max commence chaque tour.
    expect(visages(rendre(place('trap-bar-deadlift', 2, 'autre')))).toEqual([]);
    expect(visages(rendre(place('trap-bar-deadlift', 3, 'autre')))).toEqual(['Big Max, Soulevé de terre à la trap bar']);
    expect(visages(rendre(place('trap-bar-deadlift', 3, 'moi')))).toEqual([
      'Speedy, Soulevé de terre à la trap bar',
      'Big Max, Soulevé de terre à la trap bar',
    ]);
  });

  it('montre le visage choisi par chacun, la même donnée qu’avant', () => {
    const ressentiDe = (qui: QuiColonne, exerciceId: string): Ressenti | undefined =>
      exerciceId === 'shoulder-press' ? (qui === 'moi' ? 'leger' : 'lourd') : undefined;
    const html = rendre(place('shoulder-press', 4), { ressentiDe });
    expect(html).toMatch(/aria-pressed="true" aria-label="Facile \(léger\)"/);
    expect(html).toMatch(/aria-pressed="true" aria-label="Difficile \(lourd\)"/);
    expect(html.match(/aria-pressed="true" aria-label="(Facile|Correct|Difficile)/g)).toHaveLength(2);
  });
});

describe('la liste du programme : « J’ai mal », pour chacun', () => {
  it('un petit interrupteur par colonne, sous les noms ; la douleur de Big Max n’allume que le sien', () => {
    const douleur = (qui: QuiColonne, exerciceId: string) => qui === 'autre' && exerciceId === 'shoulder-press';
    const html = rendre(place('shoulder-press', 1), { douleur });
    expect(html).toMatch(/aria-pressed="false" aria-label="Speedy : j’ai mal à cet exercice"/);
    expect(html).toMatch(/aria-pressed="true" aria-label="Big Max : j’ai mal à cet exercice"/);
    // Allumé : charges à 70 %.
    expect(html).toContain('Douleur · 70 %');
    // Plus de grand bouton caché dans les points d'attention.
    expect(html).not.toContain('Points d’attention · douleur');
    // Sans charge (le Superman), la douleur n'est qu'un repère.
    const superman = rendre(place('superman', 1), { douleur: (qui, id) => qui === 'moi' && id === 'superman' });
    expect(superman).toMatch(/aria-pressed="true" aria-label="Speedy : j’ai mal à cet exercice"/);
    // Aperçu de l'autre, ou une posture : on ne peut pas le signaler d'ici.
    expect(rendre(place('shoulder-press', 1), { onBasculerDouleur: undefined })).not.toContain('j’ai mal à cet exercice');
  });
});
