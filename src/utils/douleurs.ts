// « J'ai mal à cet exercice » : une douleur signalée sur un exercice, par
// celui qui s'entraîne sur ce téléphone. Tant qu'elle est là : un repère sur
// l'exercice, aucune charge en plus proposée (« léger » n'y fait plus monter ;
// « lourd » fait toujours redescendre), et chaque série pré-remplie à 70 % de
// la charge de travail. On l'enlève : tout redevient comme avant.
//
// Elle reste sur ce téléphone, hors de l'historique : rien ne part vers le
// serveur ni vers l'autre.
import type { Douleur, UnitePoids } from '../types';
import { convertirPoids } from './statistiques';

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
