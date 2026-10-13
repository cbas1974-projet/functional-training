// Les trois grandes zones du corps, pour former les paires : le haut du
// corps, le bas du corps, et le tronc — le ventre et le bas du dos. Deux
// exercices de la même zone ne se jumellent jamais (décision de Sébastien,
// 12 octobre 2026) : l'un travaillerait pendant que l'autre devrait souffler,
// et la paire ne reposerait plus rien. Sinon, l'exercice se fait seul.
//
// Ce n'est pas la `zone` de la fiche, qui range la bibliothèque en cinq
// (haut, dos, gainage, bas, corps entier) : les trois grandes zones s'y
// lisent, avec deux précisions — le « dos » de la fiche, et le corps entier.
// La règle vaut pour les paires du programme du mois (`accordPaire`) comme
// pour les enchaînements de la séance libre (`scoreCompagnon`).
import type { Exercice, Muscle } from '../types';

export type GrandeZone = 'haut' | 'bas' | 'tronc';

/** Dans l'ordre de l'écran. */
export const GRANDES_ZONES: readonly GrandeZone[] = ['haut', 'bas', 'tronc'];

export const NOM_GRANDE_ZONE: Record<GrandeZone, string> = {
  haut: 'le haut du corps',
  bas: 'le bas du corps',
  tronc: 'le tronc',
};

/** La grande zone de chaque muscle : le bas du dos et les fléchisseurs de
 *  hanche vont avec le ventre, dans le tronc. */
const ZONE_DU_MUSCLE: Record<Muscle, GrandeZone> = {
  nuque: 'haut',
  trapezes: 'haut',
  epaules: 'haut',
  'coiffe-rotateurs': 'haut',
  pectoraux: 'haut',
  dorsaux: 'haut',
  biceps: 'haut',
  triceps: 'haut',
  'avant-bras': 'haut',
  abdominaux: 'tronc',
  obliques: 'tronc',
  lombaires: 'tronc',
  'flechisseurs-hanche': 'tronc',
  fessiers: 'bas',
  abducteurs: 'bas',
  ischios: 'bas',
  quadriceps: 'bas',
  adducteurs: 'bas',
  mollets: 'bas',
};

/** Les grandes zones d'un exercice, une le plus souvent.
 *  - Le haut, le bas et le gainage de la fiche donnent le haut, le bas et le
 *    tronc.
 *  - Le « dos » de la fiche est le haut du corps quand il tire (les rowings,
 *    l'oiseau, l'élévation en T : le haut du dos) ; le tronc quand il vise le
 *    bas du dos (le Superman).
 *  - Le corps entier prend les zones de ses muscles principaux : un swing, le
 *    bas ; un thruster, le haut et le bas ; un bûcheron, le tronc.
 *  Et un exercice qui vise le bas du dos est toujours aussi du tronc, où que
 *  la fiche le range : le good morning est du bas et du tronc. */
export function grandesZonesDe(exercice: Pick<Exercice, 'zone' | 'musclesPrincipaux'>): GrandeZone[] {
  const principaux = exercice.musclesPrincipaux ?? [];
  const zones = new Set<GrandeZone>();
  switch (exercice.zone) {
    case 'haut':
      zones.add('haut');
      break;
    case 'bas':
      zones.add('bas');
      break;
    case 'gainage':
      zones.add('tronc');
      break;
    case 'dos':
      zones.add(principaux.includes('lombaires') ? 'tronc' : 'haut');
      break;
    case 'complet':
      principaux.forEach((muscle) => zones.add(ZONE_DU_MUSCLE[muscle]));
      // Sans muscle noté, tout le corps : il ne va avec rien.
      if (zones.size === 0) GRANDES_ZONES.forEach((zone) => zones.add(zone));
      break;
  }
  if (principaux.includes('lombaires')) zones.add('tronc');
  return GRANDES_ZONES.filter((zone) => zones.has(zone));
}

/** La zone que deux exercices ont en commun, s'ils en ont une : ils ne se
 *  jumellent pas. */
export function zoneCommune(
  a: Pick<Exercice, 'zone' | 'musclesPrincipaux'>,
  b: Pick<Exercice, 'zone' | 'musclesPrincipaux'>,
): GrandeZone | null {
  const deB = grandesZonesDe(b);
  return grandesZonesDe(a).find((zone) => deB.includes(zone)) ?? null;
}

/** Deux exercices de la même grande zone : jamais en paire. */
export const memeZone = (
  a: Pick<Exercice, 'zone' | 'musclesPrincipaux'>,
  b: Pick<Exercice, 'zone' | 'musclesPrincipaux'>,
): boolean => zoneCommune(a, b) !== null;
