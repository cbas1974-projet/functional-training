# Le serveur d'entraînement : Node lit le TypeScript tel quel, sans
# dépendance à installer. Construit depuis la racine du dépôt (le serveur
# partage les règles de la séance commune avec l'application).
FROM node:22-alpine
WORKDIR /app
COPY src/utils/etatCommun.ts src/utils/etatCommun.ts
COPY serveur/serveur.ts serveur/serveur.ts
ENV PORT=8080 DONNEES=/donnees NODE_NO_WARNINGS=1
VOLUME /donnees
EXPOSE 8080
USER node
CMD ["node", "serveur/serveur.ts"]
