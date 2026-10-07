# Le serveur d'entraînement : Node lit le TypeScript tel quel, sans
# dépendance à installer. Construit depuis la racine du dépôt (le serveur
# partage avec l'application les règles de la séance commune et la relecture
# d'une mesure du corps).
FROM node:22-alpine
WORKDIR /app
COPY src/utils/etatCommun.ts src/utils/etatCommun.ts
COPY src/utils/mesures.ts src/utils/mesures.ts
COPY serveur/serveur.ts serveur/serveur.ts
ENV PORT=8080 DONNEES=/donnees NODE_NO_WARNINGS=1
VOLUME /donnees
EXPOSE 8080
USER node
CMD ["node", "serveur/serveur.ts"]
