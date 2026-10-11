# Audit UX — téléphone 390×844, Speedy (build hors-ligne, rien modifié dans le dépôt)

Parcouru : premier lancement, accueil, Réglages, les 5 jours, Changer, Séparer / Faire une paire, essai complet des 5 jours, Voir comme Big Max, routine du soir, historique, Progression (mesure ajoutée puis supprimée), bibliothèque, séance libre, séance réelle de bout en bout, quitter / recharger. Écrans en clair et en sombre. Aucune erreur console (sauf la police Google, bloquée ici). Aucun débordement horizontal à 390 px nulle part.

## Gravité haute
1. **Les boutons importants sont cachés en bas (ton « bouton caché »). Vérifié sur chaque écran de séance.** La barre fixe Précédent / Pause / Suivant (en bas, 56 px) recouvre le bas du contenu.
   - Pendant la série : « Série terminée » et « Passer l'exercice » sont coupés en deux, il faut défiler. Image : `12-serie-5.png`, `p2.png`.
   - Pendant le repos : « +15 s » et « Passer » sont sous la barre, loin sous la grosse image « PROCHAIN » et les boutons Lourd/Correct/Léger. Image : `p5.png`, `p1.png`.
   - À l'installation : « Go » est parfois à 900–1000 px, hors écran (quand les Lourd/Correct/Léger sont affichés). « Démarrer maintenant » aussi à la préparation.
   - Fin de séance : « Enregistrer la séance » (790–846 px) et « Ne pas enregistrer » sont sous un tableau de 7 lignes. Le seul bouton visible est « Précédent ». Images : `71-reel-fin.png`, `71b-reel-fin-bas.png`. Sur un vrai téléphone avec la barre du navigateur, c'est encore pire.
2. **« Ne pas enregistrer » efface toute la séance sans confirmation**, à 16 px sous « Enregistrer », même taille. Un pouce mouillé et une heure de travail disparaît.
3. **Pas de temps pour changer de côté dans les étirements du retour au calme** : « Mollet contre un mur · côté droit » passe à « côté gauche » sans pause. La séance guidée donne 5 s + « +5 s » sur les exercices, et la routine du soir aussi, mais pas ici. Incohérent. Même chose à l'échauffement.
4. **Bibliothèque : on touche une fiche et rien ne se passe.** Le détail s'ouvre sous toute la liste de la zone (à 6 351 px du haut, la page reste à 0). Pas de recherche par nom, page de 20 000 px. Images : `90-biblio.png`, `92-biblio-detail-loin.png`.
5. **Quitter une séance en cours** : deux boîtes du navigateur à la suite (« Quitter ? » puis « Enregistrer la séance partielle ? »). Répondre OK puis Annuler perd tout, sans « Reprendre ». Répondre OK, OK enregistre une séance de **1 série sur 21** et coche « Lundi A faite aujourd'hui » dans l'accueil. Le « Reprendre » n'existe qu'après un rechargement ou un plantage (testé : il marche bien).

## Gravité moyenne
6. **Mauvais appuis faciles** : « Passer l'exercice » est collé à « Série terminée », même poids visuel, sans confirmation (saute toutes les séries restantes). « Suivant » en bas saute la série en cours sans rien dire.
7. **Le poids ne se tape que pendant la série** (mains occupées). Au repos, aucun champ. Vide au tout premier passage, ensuite pré-rempli avec la valeur précédente.
8. **« Seul » n'enlève rien** : « Ensemble / Chacun son tour » reste sur chaque exercice (7 lignes de trop, hauteur 32 px) et « Voir comme Big Max » aussi. Image : `140-seul.png`.
9. **Trop petit pour un pouce** (accueil) : Ensemble / Chacun son tour 32 px, « Faire une paire » 34 px, Séparer et Changer 40 px. Les deux lignes Ensemble/Chacun ne ressemblent pas à un choix (juste un crochet vert).
10. **Trop de texte** : Réglages (tempo : 7 options avec un paragraphe chacune, mots « tendon », « protocoles cliniques »), repris à l'identique dans « Modifier » de la séance libre (feuille de 2 400 px). Le paragraphe « Par paires… » sur chaque jour. Image : `03-reglages.png`.
11. **Mots incohérents** : « Exercices » (accueil) / « Bibliothèque » (séance libre, titre). « Je l'ai faite ce soir » (avant) / « Faite ce soir ✓ » (après). « Chaque partie s'éteint d'un appui » (routine) ne veut rien dire. « Changer » dans la fiche dit « pour chaque Lundi A » (pas clair : tous les lundis A du mois ?). Un appui sur l'image d'un exercice dans « Changer » ouvre l'image en grand au lieu de choisir.
12. **Le bouton « Go » bouge de 44 px** quand le compte à rebours tombe à 0 (le texte « Prêts ? » apparaît au-dessus).

## Gravité basse
13. Mesures : après suppression, « Ton jour 1 est noté. » reste affiché. Supprimer passe par une boîte du navigateur.
14. Historique : date « 11/10/2026 14:00 » brute, « Détail par exercice » sans flèche visible. « Affichage » dans Réglages est un titre gris sans indication qu'il s'ouvre.
15. « 15 S » en majuscule (15 secondes, ressemble à « S »). En-tête du repos : nom du dernier exercice, pas de la paire.
16. « Voir comme Big Max » tient sur 2 lignes et ressemble à un changement de téléphone.

## Ce qui va bien
Métronome juste partout : Superman = MONTE, TIENS, DESCENDS ; rotation russe = À DROITE / À GAUCHE ; Halo = 20 s dans un sens, « Change de sens ! », 20 s dans l'autre. Changement de côté : « CHANGE DE CÔTÉ 5 s » + « +5 s » présents. Routine du soir complète (pause, +5 s, « Faite ce soir ✓ », Terminer visible) : `p4.png`. Essais jusqu'au bout sans blocage sur les 5 jours. Mode sombre lisible. Séparer / Faire une paire / Changer fonctionnent.

## Pépites (petit changement, grosse valeur)
1. **Une seule barre d'actions en bas, qui remplace les boutons cachés** : Série = [Série terminée] grand + Pause ; Repos = [Go / Passer] grand + « +15 s » ; Fin = [Enregistrer] grand. Précédent et Suivant passent en petit, en haut. Règle le point 1 et le 6.
2. **Fin de séance : « Enregistrer » en haut, avant le tableau, et « Ne pas enregistrer » petit + confirmation.** 10 lignes de code, supprime le risque de perdre une heure.
3. **5 s pour changer de côté aussi dans les étirements du retour au calme** (réutiliser l'écran « CHANGE DE CÔTÉ »). Même règle partout.
4. **Bibliothèque : une fiche ouverte en plein écran (comme « Voir en grand ») + un champ « Chercher un exercice ».**
5. **Quitter en une boîte à trois choix** : « Reprendre plus tard / Enregistrer ce qui est fait / Tout jeter ». Et ne pas cocher le jour « fait » si moins de la moitié des séries sont faites.

Captures : /tmp/claude-0/-home-user-App-de-Gestion-de-pool-de-combat/0aa57c8f-ea78-5ef4-b0f8-caa5d1a5cb5d/scratchpad/audit-ux/ — `12-serie-5.png`, `p1.png`, `p2.png`, `p5.png`, `71-reel-fin.png`, `71b-reel-fin-bas.png`, `90-biblio.png`, `92-biblio-detail-loin.png`, `140-seul.png`, `03-reglages.png`, `p4.png` (routine), `132-halo-serie.png`, `p8.png` (sombre).
