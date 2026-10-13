// « J'ai mal à cet exercice » : une douleur signalée sur un exercice, pour
// une personne. Tant qu'elle est là : un repère sur l'exercice, aucune charge
// en plus proposée (« léger » n'y fait plus monter ; « lourd » fait toujours
// redescendre), et chaque série pré-remplie à 70 % de la charge de travail.
// On l'enlève : tout redevient comme avant.
//
// Sur un seul téléphone, à deux, chacun a les siennes (13 octobre 2026) :
// celles de la personne du téléphone (`douleurs`, où sont restées celles
// d'avant), celles de l'autre à part (`douleursAutre`). La douleur de l'un ne
// touche jamais les charges de l'autre. Elles restent sur ce téléphone, hors
// de l'historique : rien ne part vers le serveur ni vers l'autre téléphone.
import type { Douleur, EntrainementState, UnitePoids } from '../types';
import { convertirPoids } from './statistiques';

/** De qui est la douleur : la personne du téléphone, ou l'autre. */
export type QuiDouleur = 'moi' | 'autre';

/** Le champ de la sauvegarde où vivent les douleurs de chacun. */
const CHAMP: Record<QuiDouleur, 'douleurs' | 'douleursAutre'> = { moi: 'douleurs', autre: 'douleursAutre' };

/** Les douleurs de l'un ou de l'autre. */
export const douleursDe = (
  etat: Pick<EntrainementState, 'douleurs' | 'douleursAutre'>,
  qui: QuiDouleur,
): Record<string, Douleur> => etat[CHAMP[qui]] ?? {};

/** Signale la douleur de l'un ou de l'autre, ou l'enlève : ce qui change dans
 *  l'état. Celles de l'autre personne ne bougent pas. */
export function basculerDouleurDe(
  etat: Pick<EntrainementState, 'douleurs' | 'douleursAutre'>,
  qui: QuiDouleur,
  exerciceId: string,
  charge: number,
  unite: UnitePoids,
  maintenant: Date = new Date(),
): Pick<EntrainementState, 'douleurs' | 'douleursAutre'> {
  return { [CHAMP[qui]]: basculerDouleur(etat[CHAMP[qui]], exerciceId, charge, unite, maintenant) };
}

const estUnite = (valeur: unknown): valeur is UnitePoids => valeur === 'lb' || valeur === 'kg';

/** Les douleurs d'une sauvegarde : une sauvegarde d'avant n'en a pas, une
 *  abîmée perd seulement celles qui ne se lisent plus. */
export function lireDouleurs(brut: unknown): Record<string, Douleur> {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return {};
  const douleurs: Record<string, Douleur> = {};
  for (const [exerciceId, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof valeur !== 'object' || valeur === null) continue;
    const { depuis, charge, unite } = valeur as Partial<Record<keyof Douleur, unknown>>;
    if (typeof depuis !== 'string') continue;
    const douleur: Douleur = { depuis };
    if (typeof charge === 'number' && Number.isFinite(charge) && charge > 0 && estUnite(unite)) {
      douleur.charge = charge;
      douleur.unite = unite;
    }
    douleurs[exerciceId] = douleur;
  }
  return douleurs;
}

/** Signale la douleur, ou l'enlève si elle y était. `charge` : la charge de
 *  travail du moment (100 %), si on la connaît — les 70 % se calculent
 *  toujours sur elle, et ne fondent pas d'une séance à l'autre. */
export function basculerDouleur(
  douleurs: Record<string, Douleur> | undefined,
  exerciceId: string,
  charge: number,
  unite: UnitePoids,
  maintenant: Date = new Date(),
): Record<string, Douleur> {
  const suivantes = { ...(douleurs ?? {}) };
  if (Object.prototype.hasOwnProperty.call(suivantes, exerciceId)) {
    delete suivantes[exerciceId];
    return suivantes;
  }
  suivantes[exerciceId] = {
    depuis: maintenant.toISOString(),
    ...(charge > 0 ? { charge, unite } : {}),
  };
  return suivantes;
}

/** La douleur d'un exercice, s'il y en a une. */
export function douleurDe(douleurs: Record<string, Douleur> | undefined, exerciceId: string): Douleur | null {
  return douleurs && Object.prototype.hasOwnProperty.call(douleurs, exerciceId) ? douleurs[exerciceId] : null;
}

/** La charge de travail retenue en signalant la douleur, dans l'unité
 *  demandée ; 0 si on ne la connaissait pas. */
export function chargeDeDouleur(douleur: Douleur | null | undefined, unite: UnitePoids): number {
  if (!douleur?.charge || !douleur.unite) return 0;
  return convertirPoids(douleur.charge, douleur.unite, unite);
}
