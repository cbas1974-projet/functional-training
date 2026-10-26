import type { ChargeGardee, EntrainementState, ProgressionSeance, UnitePoids } from '../types';
import { uniteDeSeance } from './statistiques';

/** Garde, dès qu'elles sont saisies, les charges de la séance en cours : si la
 *  séance est abandonnée ou jamais enregistrée, « la dernière fois » les
 *  retrouve. Renvoie le même état s'il n'y a rien de nouveau. */
export function avecChargesGardees(etat: EntrainementState, progression: ProgressionSeance | null): EntrainementState {
  if (!progression) return etat;
  const unite = uniteDeSeance(progression.seance.parametres);
  const le = progression.sauvegardeeLe ?? progression.demarreeLe;
  let gardees = etat.chargesGardees;
  for (const [id, poids] of Object.entries(progression.poids)) {
    if (!poids.some((v) => v > 0)) continue;
    const avant = gardees?.[id];
    if (avant && avant.unite === unite && avant.poids.length === poids.length && avant.poids.every((v, i) => v === poids[i])) continue;
    gardees = { ...gardees, [id]: { poids: [...poids], unite, le } };
  }
  return gardees === etat.chargesGardees ? etat : { ...etat, chargesGardees: gardees };
}

/** Relit les charges gardées d'une sauvegarde : ce qui est abîmé est écarté. */
export function chargesGardeesLues(brut: unknown): Record<string, ChargeGardee> | undefined {
  if (!brut || typeof brut !== 'object') return undefined;
  const resultat: Record<string, ChargeGardee> = {};
  for (const [id, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const v = valeur as Partial<ChargeGardee> | null;
    if (!v || !Array.isArray(v.poids) || typeof v.le !== 'string') continue;
    if (v.unite !== 'lb' && v.unite !== 'kg') continue;
    if (!v.poids.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) continue;
    resultat[id] = { poids: v.poids, unite: v.unite as UnitePoids, le: v.le };
  }
  return Object.keys(resultat).length > 0 ? resultat : undefined;
}
