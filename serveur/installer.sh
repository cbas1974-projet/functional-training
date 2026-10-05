#!/bin/sh
# Installe (ou met à jour) le serveur d'entraînement sur un VPS Ubuntu ou
# Debian. À lancer en root, dans le terminal du VPS :
#
#   curl -fsSL https://raw.githubusercontent.com/cbas1974-projet/functional-training/main/serveur/installer.sh | sh -s -- MON-DOMAINE
#
# MON-DOMAINE : le nom du VPS (chez Hostinger, srvXXXXXX.hstgr.cloud) ou un
# sous-domaine qui pointe vers lui.
#
# Deux cas :
# - Le VPS sert déjà des sites avec Traefik (le modèle n8n de Hostinger, par
#   exemple) : le serveur se range derrière ce Traefik, sur le même domaine,
#   aux seules adresses /api/heure et /api/equipes/… Rien ne change pour n8n
#   ni pour la configuration de Traefik.
# - Les ports 80 et 443 sont libres : le serveur arrive avec son propre Caddy,
#   qui s'occupe du HTTPS.
# Si autre chose occupe les ports 80 et 443, le script s'arrête sans rien
# changer et montre ce qui les occupe.
set -eu

DOMAINE="${1:-}"
if [ -z "$DOMAINE" ]; then
  DOMAINE="$(hostname -f 2>/dev/null || hostname)"
fi
DOSSIER=/opt/entrainement
DEPOT=https://github.com/cbas1974-projet/functional-training.git
CONTENEUR=entrainement-api
# Combien de fois on vérifie que le HTTPS répond, toutes les cinq secondes.
ESSAIS="${ESSAIS:-30}"

echo "→ Domaine : $DOMAINE"

if ! command -v git >/dev/null 2>&1; then
  echo "→ Installation de git"
  apt-get update -qq && apt-get install -y -qq git
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installation de Docker"
  curl -fsSL https://get.docker.com | sh
fi

# Les réseaux Docker d'un conteneur, séparés par des espaces.
reseaux() { docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$1"; }
# Les étiquettes d'un conteneur, une par ligne.
etiquettes() { docker inspect -f '{{range $k, $v := .Config.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' "$1"; }
# Le port est-il déjà pris ? Avec ss s'il est là ; sinon, on frappe à la
# porte : curl répond 7 quand personne n'ouvre.
port_pris() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | grep -Eq ":$1 "
    return
  fi
  code=0
  curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$1" 2>/dev/null || code=$?
  [ "$code" -ne 7 ]
}
# Ce qui occupe les ports 80 et 443, pour qu'on puisse aider.
montrer_ports() {
  echo "  Envoie à Claude une capture d'écran de ce qui suit :"
  ss -ltnp 2>/dev/null | grep -E ':(80|443) ' || true
  docker ps --format '{{.Names}} | {{.Image}} | {{.Ports}}' 2>/dev/null || true
}

TRAEFIK="$(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /(^|\/)traefik(:|$)/ { print $1; exit }')"
if [ -n "$TRAEFIK" ]; then
  MODE=traefik
  echo "→ Traefik est déjà là ($TRAEFIK) : le serveur se range derrière lui, sans toucher au reste"
  # Un conteneur que ce Traefik sert déjà en HTTPS (n8n) : on reprend ses
  # réglages de certificat et d'entrée.
  MODELE=""
  RESOLVEUR=""
  ENTREES=""
  for c in $(docker ps --format '{{.Names}}'); do
    [ "$c" = "$CONTENEUR" ] && continue
    r="$(etiquettes "$c" | sed -n 's/^traefik\.http\.routers\.[^.]*\.tls\.certresolver=//p' | head -n 1)"
    if [ -n "$r" ]; then
      MODELE="$c"
      RESOLVEUR="$r"
      ENTREES="$(etiquettes "$c" | sed -n 's/^traefik\.http\.routers\.[^.]*\.entrypoints=//p' | head -n 1)"
      break
    fi
  done
  if [ -z "$RESOLVEUR" ]; then
    RESOLVEUR="$(docker inspect -f '{{join .Args "\n"}}' "$TRAEFIK" | sed -n 's/^--certificatesresolvers\.\([^.=]*\)\..*/\1/p' | head -n 1)"
  fi
  [ -n "$ENTREES" ] || ENTREES=websecure
  # Le réseau que Traefik partage avec ce conteneur ; sinon, le sien.
  RESEAU=""
  if [ -n "$MODELE" ]; then
    for n in $(reseaux "$MODELE"); do
      case " $(reseaux "$TRAEFIK") " in *" $n "*) RESEAU="$n"; break ;; esac
    done
  fi
  [ -n "$RESEAU" ] || RESEAU="$(reseaux "$TRAEFIK" | awk '{ print $1 }')"
  if [ -z "$RESOLVEUR" ] || [ -z "$RESEAU" ] || [ "$RESEAU" = host ] || [ "$RESEAU" = none ]; then
    echo "⚠ Je n'arrive pas à lire les réglages de Traefik. Rien n'a été changé."
    montrer_ports
    exit 1
  fi
  echo "  réseau $RESEAU · certificat $RESOLVEUR · entrée $ENTREES"
else
  MODE=caddy
  # Déjà installé avec Caddy : les ports sont à nous.
  if [ ! -d "$DOSSIER/.git" ] && { port_pris 80 || port_pris 443; }; then
    echo "⚠ Les ports 80 ou 443 sont déjà pris par un autre service sur ce VPS. Rien n'a été changé."
    montrer_ports
    exit 1
  fi
fi

if [ -d "$DOSSIER/.git" ]; then
  echo "→ Mise à jour du code"
  git -C "$DOSSIER" pull --ff-only
else
  echo "→ Téléchargement du code"
  git clone --depth 1 "$DEPOT" "$DOSSIER"
fi

cd "$DOSSIER/serveur"
mkdir -p donnees
# Le conteneur tourne sous l'utilisateur « node » (uid 1000).
chown -R 1000:1000 donnees

if [ "$MODE" = traefik ]; then
  echo "→ Construction"
  docker build -q -t "$CONTENEUR" -f "$DOSSIER/serveur/Dockerfile" "$DOSSIER" >/dev/null
  docker rm -f "$CONTENEUR" >/dev/null 2>&1 || true
  echo "→ Démarrage"
  docker run -d --name "$CONTENEUR" --restart unless-stopped --network "$RESEAU" \
    -v "$DOSSIER/serveur/donnees:/donnees" \
    -l traefik.enable=true \
    -l "traefik.docker.network=$RESEAU" \
    -l 'traefik.http.routers.entrainement.rule=Host(`'"$DOMAINE"'`) && (Path(`/api/heure`) || PathPrefix(`/api/equipes`))' \
    -l "traefik.http.routers.entrainement.entrypoints=$ENTREES" \
    -l traefik.http.routers.entrainement.tls=true \
    -l "traefik.http.routers.entrainement.tls.certresolver=$RESOLVEUR" \
    -l traefik.http.services.entrainement.loadbalancer.server.port=8080 \
    "$CONTENEUR" >/dev/null
else
  echo "DOMAINE=$DOMAINE" > .env
  echo "→ Démarrage"
  docker compose up -d --build
fi

echo "→ Vérification (le certificat HTTPS peut prendre une minute)"
i=0
while [ "$i" -lt "$ESSAIS" ]; do
  if curl -fsS "https://$DOMAINE/api/heure" >/dev/null 2>&1; then
    echo ""
    echo "✓ Serveur prêt : https://$DOMAINE"
    echo "  Donne cette adresse à Claude, ou mets-la dans l'appli : Réglages → Serveur."
    exit 0
  fi
  i=$((i + 1))
  sleep 5
done
echo "⚠ Le serveur tourne, mais https://$DOMAINE ne répond pas encore."
if [ "$MODE" = traefik ]; then
  echo "  Envoie à Claude une capture d'écran de ce qui suit :"
  docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}'
  docker logs "$TRAEFIK" --tail 15 2>&1 || true
else
  echo "  Vérifie que le pare-feu du VPS (hPanel → VPS → Pare-feu) laisse passer les ports 80 et 443,"
  echo "  puis : cd $DOSSIER/serveur && docker compose logs caddy"
fi
exit 1
