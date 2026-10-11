// Deux exercices au poids du corps, sur aucun poster : leurs images sont des
// dessins simples, deux temps du mouvement, comme celles des machines.
//
// Ils viennent de l'audit de la logique d'entraînement (11 octobre 2026),
// décidé par Sébastien : le Superman sans poids remplace au programme le
// Superman au kettlebell, qui écrase le bas du dos (McGill) ; la planche de
// Copenhague courte travaille l'intérieur de la cuisse, la meilleure
// protection de l'aine au hockey (Harøy 2019).

import type { Exercice } from '../types';

export const EXERCICES_POIDS_DU_CORPS: Exercice[] = [
  {
    id: 'superman',
    nomFr: 'Superman, sans poids',
    // Le même mouvement que le Superman au kettlebell : jamais les deux dans
    // une séance (`cleMouvement`).
    nomEn: 'Superman',
    zone: 'dos',
    groupe: 'dorsaux',
    muscles: 'Érecteurs du rachis, fessiers, ischio-jambiers, deltoïdes arrière',
    musclesPrincipaux: ['lombaires', 'fessiers'],
    musclesSecondaires: ['ischios', 'epaules'],
    // Sur le tapis, au poids du corps : rien à charger (`chargeReglable`).
    materiel: 'tapis',
    pattern: 'charniere',
    niveauMin: 1,
    cotes: 'bilateral',
    unite: 'reps',
    // Allongé à plat sur le ventre, le dos se repose : on tient poitrine et
    // jambes décollées.
    pauseEnHaut: true,
    position: 'Allongé sur le ventre, bras tendus devant, sans poids',
    pointsAttention: [
      'Sans poids : une charge au bout des bras écrase le bas du dos.',
      'Décoller poitrine et jambes en même temps, à peine, sans élan.',
      'Regard au sol : la nuque reste longue.',
      'Si le bas du dos pince : décoller moins haut.',
    ],
    interetJjb: 'Renforce exactement ce que la garde passe des heures à étirer.',
  },
  {
    id: 'copenhagen-plank',
    nomFr: 'Planche de Copenhague (courte)',
    nomEn: 'Short Copenhagen Plank',
    zone: 'bas',
    groupe: 'adducteurs',
    muscles: 'Adducteurs (intérieur de cuisse), obliques',
    musclesPrincipaux: ['adducteurs'],
    musclesSecondaires: ['obliques', 'epaules'],
    materiel: 'banc',
    pattern: 'isolation',
    niveauMin: 1,
    cotes: 'unilateral',
    unite: 'secondes',
    // Courte : 15 s de chaque côté, avec les 5 s pour changer de côté.
    tenueImposeeSec: 15,
    position: 'Planche sur le côté, sur l’avant-bras, le genou du dessus posé sur le banc',
    pointsAttention: [
      'Genou du dessus posé sur le banc, hanches hautes, 15 s de chaque côté ; version longue (pied sur le banc) plus tard.',
      'Le coude sous l’épaule ; épaule, hanche et genou en ligne.',
      'La jambe du dessous reste libre, sous le banc.',
      'Si l’aine pince : on repose la hanche et on arrête.',
    ],
    interetJjb: 'L’intérieur de cuisse qui serre la garde ; au hockey, il protège l’aine.',
  },
];
