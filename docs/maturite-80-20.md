# Le projet est-il mûr ? L'analyse 80/20

*11 octobre 2026*

L'idée du 80/20 : 20 % du travail donne 80 % de la valeur. Pour cette
application, on y est presque. La partie qui compte vraiment est faite. Ce
qui reste se résume à **trois choses**, et à une règle : arrêter d'ajouter.

## Ce que « mûr » veut dire ici

L'application est mûre quand **Speedy et Big Max s'entraînent avec elle, trois
fois par semaine, sans penser à l'application** : elle dit quoi faire, au
bon rythme, et elle garde tout. On ne la teste plus, on s'en sert.

## Les 80 % déjà faits

- Le **programme du mois**, composé tout seul, par paires d'exercices
  opposés, avec les précautions pour le dos, la jambe et les genoux.
- La **séance guidée** : le métronome, les pauses, les charges, et
  maintenant le bon mot au bon moment pour les 151 exercices (la liste
  `mouvements.md`).
- **À deux, en direct** : une horloge commune, sur deux téléphones.
- L'**historique** des deux depuis le jour 1, les **mensurations** et les
  graphiques de progression.
- **Lourd / Correct / Léger**, pour savoir quand monter les charges.
- Le **serveur** sur le VPS, protégé, avec une copie de sécurité chaque nuit.
- **814 tests**, et une vérification automatique du site et du serveur chaque
  matin.

## Les 20 % qui restent, par ordre d'importance

1. **Une vraie séance à deux, en salle, avec le direct.** C'est le plus
   important, et ça n'a jamais été fait. Tout a été vérifié par des tests et
   dans un navigateur, mais jamais avec deux téléphones, deux personnes, de
   vrais poids et le Wi-Fi de la salle. Une séance en apprend plus que dix
   corrections.
2. **Corriger d'un coup ce que cette séance révèle.** Pendant la séance, chacun
   note ce qui cloche sur son téléphone, en une phrase. On m'envoie la liste, et
   je corrige tout en une seule fois, au lieu d'une correction à la fois.
3. **Une copie de l'historique hors du VPS.** Aujourd'hui, les copies de
   sécurité sont sur le même VPS que le serveur. Si le VPS disparaît, les
   copies disparaissent avec lui. Chaque téléphone garde ses propres séances,
   mais pas l'historique des deux. Il manque un bouton « Exporter » qui donne
   un fichier à garder sur le PC ou dans Dropbox. C'est un petit travail qui
   protège tout le reste.

Le reste peut attendre :
- **Les images** des 6 machines sont du confort : les dessins simples suffisent
  pour s'entraîner.
- **Les exercices mis de côté** reviendront après l'examen de la jambe.

## Ce qu'on arrête : geler pendant 4 semaines

Pendant 4 semaines, on corrige seulement ce qui gêne l'entraînement. Pas de
nouvelle fonction, pas de nouvel exercice, pas de retouche de design. Ce qui
ne sert pas au programme du mois (yoga, tabata, styles de circuit, séance
libre) reste tel quel.

Chaque idée nouvelle va dans une liste. On la relit à la fin des 4 semaines :
la moitié ne paraîtra plus nécessaire.

## Les critères : quand tout est coché, le projet est mûr

- [ ] 4 semaines de suite, environ 3 séances par semaine, faites avec
      l'application, à deux.
- [ ] Pendant les 2 dernières semaines, aucune anomalie qui gâche une séance.
- [ ] Le direct à deux tient une séance entière, ou se rattrape tout seul
      après une coupure.
- [ ] L'historique des deux est complet sur le serveur, et la vérification du
      matin est verte tous les jours.
- [ ] Un export de l'historique est rangé hors du VPS.
- [ ] Le programme du mois suivant se refait sans grosse retouche à la main.

Quand tout est coché, l'application passe en **mode entretien** : on n'y
touche que si quelque chose casse, ou une fois par mois pour une idée
de la liste.

## Les risques à garder en tête

- **Les données des exercices.** Chaque essai a révélé une anomalie : tenir en
  bas, pas de temps pour changer de côté, le halo. La liste des 151 exercices
  sert à les trouver toutes d'un coup. Relis-la une fois, 15 minutes, et coche
  ce qui te semble faux.
- **Trois gros fichiers** (la séance guidée, l'accueil, le programme), de plus
  de 1 500 lignes chacun. Ils sont plus durs à modifier sans rien casser. Les
  814 tests les protègent. Les découper maintenant serait du 20 % de valeur
  pour 80 % d'effort : on n'y touche pas.
- **La vérification du matin s'arrête après 60 jours sans changement.** En
  mode entretien, GitHub la met en pause. On la relance dans l'onglet
  *Actions*, ou on fait un petit changement par mois.
- **Le coût en conversation.** Les petites corrections une à une coûtent cher.
  Un lot par semaine, après une séance, coûte bien moins.

## En résumé

Il reste **une séance test à deux, un lot de corrections et un bouton
d'export**. Ensuite, on gèle 4 semaines et on coche les critères.
