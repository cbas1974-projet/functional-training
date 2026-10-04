#!/bin/sh
# Installe (ou met à jour) le serveur d'entraînement sur un VPS Ubuntu ou
# Debian. À lancer en root, dans le terminal du VPS :
#
#   curl -fsSL https://raw.githubusercontent.com/cbas1974-projet/functional-training/main/serveur/installer.sh | sh -s -- MON-DOMAINE
#
# MON-DOMAINE : le nom du VPS (chez Hostinger, srvXXXXXX.hstgr.cloud) ou un
# sous-domaine qui pointe vers lui. Les ports 80 et 443 doivent être libres.
set -eu

DOMAINE="${1:-}"
if [ -z "$DOMAINE" ]; then
  DOMAINE="$(hostname -f 2>/dev/null || hostname)"
fi
DOSSIER=/opt/entrainement
DEPOT=https://github.com/cbas1974-projet/functional-training.git

echo "→ Domaine : $DOMAINE"

if ! command -v git >/dev/null 2>&1; then
  echo "→ Installation de git"
  apt-get update -qq && apt-get install -y -qq git
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installation de Docker"
  curl -fsSL https://get.docker.com | sh
fi

if command -v ss >/dev/null 2>&1 && [ ! -d "$DOSSIER/.git" ] && ss -ltn | grep -Eq ':(80|443) '; then
  echo "⚠ Les ports 80 ou 443 sont déjà pris par un autre service sur ce VPS."
  echo "  Le serveur a besoin d'eux pour son HTTPS. Dis-le à Claude : on l'installera derrière ton service existant."
  exit 1
fi

if [ -d "$DOSSIER/.git" ]; then
  echo "→ Mise à jour du code"
  git -C "$DOSSIER" pull --ff-only
else
  echo "→ Téléchargement du code"
  git clone --depth 1 "$DEPOT" "$DOSSIER"
fi

cd "$DOSSIER/serveur"
echo "DOMAINE=$DOMAINE" > .env
mkdir -p donnees
# Le conteneur tourne sous l'utilisateur « node » (uid 1000).
chown -R 1000:1000 donnees

echo "→ Démarrage"
docker compose up -d --build

echo "→ Vérification (le certificat HTTPS peut prendre une minute)"
i=0
while [ $i -lt 30 ]; do
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
echo "  Vérifie que le pare-feu du VPS (hPanel → VPS → Pare-feu) laisse passer les ports 80 et 443,"
echo "  puis : cd $DOSSIER/serveur && docker compose logs caddy"
exit 1
