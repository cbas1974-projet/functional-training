// Quatre exercices au poids du corps, sur aucun poster : leurs images sont
// des dessins simples, deux temps du mouvement, comme celles des machines.
//
// Les deux premiers viennent de l'audit de la logique d'entraînement (11
// octobre 2026), décidé par Sébastien : le Superman sans poids remplace au
// programme le Superman au kettlebell, qui écrase le bas du dos (McGill) ; la
// planche de Copenhague courte travaille l'intérieur de la cuisse, la
// meilleure protection de l'aine au hockey (Harøy 2019).
//
// Les deux planches, classiques, viennent du premier mois en exercices
// classiques (13 octobre 2026) : le gainage du programme n'avait que des
// variantes au kettlebell (passage de la cloche, rotation), inhabituelles.
// Les planches du poster de yoga restent des postures, pour la routine du
// soir.

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
  {
    id: 'plank',
    nomFr: 'Planche',
    nomEn: 'Plank',
    zone: 'gainage',
    groupe: 'abdominaux',
    muscles: 'Abdominaux, obliques, épaules, fessiers',
    musclesPrincipaux: ['abdominaux'],
    musclesSecondaires: ['obliques', 'epaules', 'fessiers'],
    // Sur le tapis, au poids du corps : rien à charger.
    materiel: 'tapis',
    // Du gainage, le dos immobile : au programme, c'est le schéma
    // « anti-rotation » (`DOS_IMMOBILE`).
    pattern: 'anti-rotation',
    niveauMin: 1,
    cotes: 'bilateral',
    unite: 'secondes',
    position: 'Sur les avant-bras et la pointe des pieds, le corps droit',
    pointsAttention: [
      'Coudes sous les épaules, le corps droit de la tête aux talons.',
      'Serrer le ventre et les fesses : le bas du dos ne se creuse pas.',
      'Respirer normalement, sans bloquer.',
      'Plus facile : les genoux au sol (dessin 1).',
    ],
    interetJjb: 'Le gainage qui tient la posture sous le poids de l’adversaire.',
  },
  {
    id: 'side-plank',
    nomFr: 'Planche latérale',
    nomEn: 'Side Plank',
    zone: 'gainage',
    groupe: 'obliques',
    muscles: 'Obliques, moyen fessier (extérieur de hanche), épaules',
    // L'extérieur de la hanche travaille autant que le ventre : la planche
    // latérale est l'un des exercices qui sollicitent le plus le moyen
    // fessier (Boren 2011). C'est l'exercice classique de l'extérieur de
    // cuisse ; et, du bas comme du tronc, il ne se jumelle qu'avec le haut du
    // corps — jamais avec la planche de Copenhague (`grandesZonesDe`).
    musclesPrincipaux: ['obliques', 'abducteurs'],
    musclesSecondaires: ['abdominaux', 'epaules'],
    materiel: 'tapis',
    pattern: 'anti-rotation',
    niveauMin: 1,
    cotes: 'unilateral',
    unite: 'secondes',
    position: 'Sur le côté, en appui sur un avant-bras',
    pointsAttention: [
      'Le coude sous l’épaule ; épaule, hanche et pieds en ligne.',
      'Les hanches montent et restent hautes : c’est l’extérieur de la hanche qui travaille.',
      'Un côté, puis l’autre.',
      'Plus facile : les genoux pliés au sol.',
    ],
    interetJjb: 'Le gainage de côté, quand on est écrasé sur le flanc.',
  },
];
