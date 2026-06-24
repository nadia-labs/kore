#!/usr/bin/env bash
# ══════════════════════════════════════════════
#  KORE APP 2.0 — kInstall v2.1
#  Bootstrap automático + Instalación completa
#
#  Uso desde el servidor (un solo comando):
#
#    bash <(curl -fsSL https://raw.githubusercontent.com/nadia-labs/kore/main/kinstall.sh)
#
#  O si ya tienes el archivo:
#    bash kinstall.sh
#
#  Requisitos: Ubuntu 22+, acceso sudo, curl, unzip
# ══════════════════════════════════════════════

set -uo pipefail

KORE_RELEASE_URL="https://github.com/nadia-labs/kore/releases/download/v2.0.0/kore-motor-2.0.0.zip"

GRN='\033[0;32m'; YLW='\033[1;33m'; RED='\033[0;31m'
CYN='\033[0;36m'; BLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GRN}✓${NC}  $*"; }
err()  { echo -e "  ${RED}✕${NC}  $*" >&2; }
warn() { echo -e "  ${YLW}⚠${NC}  $*"; }
step() { echo -e "\n${BLD}${CYN}▸  $*${NC}"; }
die()  { echo -e "\n  ${RED}✕  ERROR: $*${NC}\n" >&2; exit 1; }

# ══════════════════════════════════════════════
#  BANNER
# ══════════════════════════════════════════════
clear
echo ""
echo -e "${BLD}${CYN}"
echo "  ██╗  ██╗ ██████╗ ██████╗ ███████╗"
echo "  ██║ ██╔╝██╔═══██╗██╔══██╗██╔════╝"
echo "  █████╔╝ ██║   ██║██████╔╝█████╗  "
echo "  ██╔═██╗ ██║   ██║██╔══██╗██╔══╝  "
echo "  ██║  ██╗╚██████╔╝██║  ██║███████╗"
echo "  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝"
echo -e "${NC}"
echo -e "  ${BLD}kInstall v2.1 — Bootstrap + Infraestructura${NC}"
echo -e "  nadIA Labs  ·  nadialabs.cl"
echo ""
echo -e "  Descarga Kore Motor desde GitHub y configura"
echo -e "  el servidor completo en un solo paso."
echo ""
read -rp "  Presiona Enter para comenzar…"

# ══════════════════════════════════════════════
#  0. DATOS DEL PROYECTO (primero para saber dónde instalar)
# ══════════════════════════════════════════════
step "Configuración del proyecto"
echo ""

ask_required() {
  local prompt="$1" varname="$2" val=""
  while [[ -z "$val" ]]; do
    echo -en "  ${YLW}?${NC}  ${prompt}: "
    read -r val
    [[ -z "$val" ]] && warn "Este campo es obligatorio."
  done
  eval "$varname=\"$val\""
}
ask_default() {
  local prompt="$1" default="$2" varname="$3"
  echo -en "  ${YLW}?${NC}  ${prompt} [${default}]: "
  read -r input
  eval "$varname=\"${input:-$default}\""
}
ask_optional() {
  local prompt="$1" varname="$2"
  echo -en "  ${YLW}?${NC}  ${prompt} (Enter para omitir): "
  read -r input
  eval "$varname=\"${input:-}\""
}

ask_required "Dominio (sin https://, ej: misitio.cl)" DOMAIN
ask_default  "Puerto del Motor" "3001" PORT

APP_NAME=$(echo "$DOMAIN" | tr '.' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
APP_DIR="/var/www/${APP_NAME}"

ok "Nombre PM2: ${APP_NAME}"
ok "Directorio: ${APP_DIR}"

# ══════════════════════════════════════════════
#  1. BOOTSTRAP — Descargar Motor desde GitHub
#     Solo si los archivos no están presentes
# ══════════════════════════════════════════════
step "Motor Kore"

if [ ! -f "${APP_DIR}/server.js" ]; then
  warn "Motor no encontrado. Descargando desde GitHub…"

  # Instalar dependencias de descarga si faltan
  command -v curl   &>/dev/null || sudo apt-get install -y -qq curl
  command -v unzip  &>/dev/null || sudo apt-get install -y -qq unzip

  # Crear directorio
  sudo mkdir -p "${APP_DIR}"
  sudo chown "$(whoami):$(whoami)" "${APP_DIR}"

  # Descargar y extraer
  TMP_ZIP="/tmp/kore-motor.zip"
  curl -fsSL "${KORE_RELEASE_URL}" -o "${TMP_ZIP}" \
    || die "No se pudo descargar el Motor desde GitHub. Verifica tu conexión."

  unzip -o "${TMP_ZIP}" -d "${APP_DIR}" \
    || die "No se pudo extraer el Motor."

  # Si el zip extrae en una subcarpeta, mover contenido al raíz
  EXTRACTED=$(find "${APP_DIR}" -maxdepth 1 -mindepth 1 -type d | head -1)
  if [ -n "${EXTRACTED}" ] && [ ! -f "${APP_DIR}/server.js" ]; then
    mv "${EXTRACTED}"/* "${APP_DIR}/" 2>/dev/null || true
    rmdir "${EXTRACTED}" 2>/dev/null || true
  fi

  rm -f "${TMP_ZIP}"

  [ -f "${APP_DIR}/server.js" ] && ok "Motor descargado en ${APP_DIR}" \
    || die "server.js no encontrado tras extracción. Revisa el contenido del zip."
else
  ok "Motor ya presente en ${APP_DIR}"
fi

cd "${APP_DIR}"

# ══════════════════════════════════════════════
#  2. REQUISITOS DEL SISTEMA
# ══════════════════════════════════════════════
step "Instalando requisitos del sistema"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

instalar_node() {
  warn "Instalando Node.js 20 LTS con nvm…"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
    || die "No se pudo descargar nvm."
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 20 || die "No se pudo instalar Node 20."
  nvm use 20; nvm alias default 20
  export PATH="$NVM_DIR/versions/node/$(nvm version)/bin:$PATH"
  ok "Node.js $(node --version) instalado"
}

if ! command -v node &>/dev/null; then
  instalar_node
else
  NODE_MAJOR=$(node -e "process.stdout.write(String(process.version.split('.')[0].slice(1)))")
  [[ "$NODE_MAJOR" -lt 20 ]] && instalar_node || ok "Node.js $(node --version)"
fi
command -v npm &>/dev/null || die "npm no encontrado."
ok "npm $(npm --version)"

if ! command -v pm2 &>/dev/null; then
  warn "Instalando PM2 globalmente…"
  npm install -g pm2 || die "No se pudo instalar PM2."
fi
ok "PM2 $(pm2 --version 2>/dev/null | head -1)"

if ! dpkg -l build-essential &>/dev/null 2>&1; then
  warn "Instalando build-essential…"
  sudo apt-get update -qq && sudo apt-get install -y -qq build-essential python3-dev \
    || warn "build-essential falló. bcrypt/sharp pueden fallar."
fi
ok "build-essential"

command -v sqlite3 &>/dev/null || sudo apt-get install -y -qq sqlite3 2>/dev/null || true
command -v sqlite3 &>/dev/null && ok "sqlite3" || true

if ! command -v nginx &>/dev/null; then
  warn "Instalando Nginx…"
  sudo apt-get update -qq && sudo apt-get install -y -qq nginx \
    || warn "No se pudo instalar Nginx."
fi
command -v nginx &>/dev/null && ok "Nginx" || true

# ══════════════════════════════════════════════
#  3. VARIABLES OPCIONALES
# ══════════════════════════════════════════════
step "Variables opcionales"
ask_optional "VAPID_PUBLIC (Push Notifications)" VAPID_PUBLIC
ask_optional "VAPID_PRIVATE"                      VAPID_PRIVATE
ask_optional "TELEGRAM_TOKEN"                     TELEGRAM_TOKEN
ask_optional "TELEGRAM_CHAT_ID"                   TELEGRAM_CHAT_ID
ask_optional "GOOGLE_MAPS_KEY"                    GOOGLE_MAPS_KEY

# ══════════════════════════════════════════════
#  4. npm install
# ══════════════════════════════════════════════
step "Instalando dependencias npm"
# Forzar recompilación de módulos nativos (better-sqlite3, sharp, bcrypt)
# para la plataforma del servidor. Si hay un node_modules copiado desde
# otro sistema (ej: macOS → Linux), los binarios nativos no sirven.
rm -rf node_modules package-lock.json
npm install --omit=dev || die "npm install falló. Verifica que build-essential esté instalado."
ok "Dependencias instaladas (recompiladas para $(uname -m))"

# ══════════════════════════════════════════════
#  5. SESSION_SECRET + DIRECTORIOS
# ══════════════════════════════════════════════
step "Generando SESSION_SECRET y directorios"
SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(64).toString('hex'))")
mkdir -p "${APP_DIR}"/{db/backups,uploads,public,kits,logs}
ok "Directorios y SESSION_SECRET listos"

# ══════════════════════════════════════════════
#  6. .env
# ══════════════════════════════════════════════
step "Generando .env"
cat > "${APP_DIR}/.env" <<EOF
# ── Generado por kInstall 2.1 — $(date '+%Y-%m-%d %H:%M') ──
# Completa la configuración en: https://${DOMAIN}/setup

KORE_INSTALLED=false

PROJECT_NAME=Kore App
PROJECT_URL=https://${DOMAIN}
PORT=${PORT}

KAPITAN_USER=
KAPITAN_PASS=

SESSION_SECRET=${SESSION_SECRET}

CLAUDE_API_KEY=
CLAUDE_MODEL=claude-haiku-4-5-20251001

DB_PATH=./db/database.sqlite
BACKUP_DIR=./db/backups

VAPID_PUBLIC=${VAPID_PUBLIC:-}
VAPID_PRIVATE=${VAPID_PRIVATE:-}
TELEGRAM_TOKEN=${TELEGRAM_TOKEN:-}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-}
GOOGLE_MAPS_KEY=${GOOGLE_MAPS_KEY:-}
EOF
chmod 600 "${APP_DIR}/.env"
ok ".env creado (KORE_INSTALLED=false)"

# ══════════════════════════════════════════════
#  7. NGINX
# ══════════════════════════════════════════════
step "Configurando Nginx"
NGINX_CONF_DST="/etc/nginx/sites-available/${APP_NAME}"

sudo tee "${NGINX_CONF_DST}" > /dev/null <<NGINXEOF
# Kore 2.0 — ${APP_NAME} · $(date '+%Y-%m-%d')
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 15M;
    server_tokens off;

    location /.well-known/acme-challenge/ { root /var/www/html; }

    location /uploads/ {
        alias ${APP_DIR}/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        proxy_pass         http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo ln -sf "${NGINX_CONF_DST}" "/etc/nginx/sites-enabled/${APP_NAME}"
sudo iptables -I INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo apt-get install -y -qq iptables-persistent 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true

sudo nginx -t 2>/dev/null && sudo nginx -s reload 2>/dev/null \
  && ok "Nginx activo → http://${DOMAIN}" \
  || err "Error Nginx. Revisa: sudo nginx -t"

# ══════════════════════════════════════════════
#  8. PM2
# ══════════════════════════════════════════════
step "Iniciando Motor con PM2"

# Escribir ecosystem.config.js con nombre correcto (APP_NAME = dominio)
cat > "${APP_DIR}/ecosystem.config.js" <<ECOEOF
require('dotenv').config();
const PORT = process.env.PORT || ${PORT};

module.exports = {
  apps: [
    {
      name:               '${APP_NAME}',
      script:             'server.js',
      instances:          1,
      exec_mode:          'fork',
      watch:              false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT:     PORT
      },
      error_file:      './logs/${APP_NAME}-error.log',
      out_file:        './logs/${APP_NAME}-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay:   3000,
      max_restarts:    10
    },
    {
      name:         '${APP_NAME}-backup',
      script:       'backup.js',
      cron_restart: '0 3 * * *',
      watch:        false,
      autorestart:  false,
      env:          { NODE_ENV: 'production' },
      error_file:   './logs/${APP_NAME}-backup-error.log',
      out_file:     './logs/${APP_NAME}-backup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
ECOEOF

pm2 delete "${APP_NAME}" 2>/dev/null || true
pm2 start ecosystem.config.js --env production

# Esperar hasta 10s y verificar que la app esté online
ATTEMPTS=0
while [[ $ATTEMPTS -lt 10 ]]; do
  STATUS=$(pm2 jlist 2>/dev/null | node -e "
    const list = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const app  = list.find(a => a.name === '${APP_NAME}');
    process.stdout.write(app ? app.pm2_env.status : 'not_found');
  " 2>/dev/null || echo "unknown")
  [[ "$STATUS" == "online" ]] && break
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 1
done

if [[ "$STATUS" == "online" ]]; then
  ok "Motor online en puerto ${PORT}"
else
  err "Motor en estado '${STATUS}' — los módulos nativos no cargaron o el .env tiene errores."
  echo ""
  warn "Diagnóstico rápido:"
  echo -e "   pm2 logs ${APP_NAME} --lines 30"
  echo ""
  die "La app no inició correctamente. Revisa los logs antes de continuar."
fi

pm2 save

if pm2 startup 2>&1 | grep -q "sudo"; then
  STARTUP_CMD=$(pm2 startup 2>&1 | grep "sudo")
  echo ""
  warn "Para arranque automático, ejecuta:"
  echo -e "  ${YLW}${STARTUP_CMD}${NC}"
fi

# ══════════════════════════════════════════════
#  9. SSL (opcional)
# ══════════════════════════════════════════════
step "SSL con Certbot"
echo ""
echo -en "  ${YLW}?${NC}  ¿Instalar SSL ahora? (requiere DNS activo) [s/N]: "
read -r SSL_NOW
SSL_NOW=$(echo "${SSL_NOW:-n}" | tr '[:upper:]' '[:lower:]')

if [[ "$SSL_NOW" == "s" || "$SSL_NOW" == "si" || "$SSL_NOW" == "y" ]]; then
  command -v certbot &>/dev/null || {
    warn "Instalando Certbot…"
    sudo apt-get update -qq && sudo apt-get install -y -qq certbot python3-certbot-nginx \
      || die "No se pudo instalar Certbot."
  }
  echo -en "  ${YLW}?${NC}  Email para Let's Encrypt: "
  read -r LE_EMAIL
  [[ -n "$LE_EMAIL" ]] && EMAIL_ARG="--email ${LE_EMAIL}" || EMAIL_ARG="--register-unsafely-without-email"

  sudo certbot --nginx -d "${DOMAIN}" $EMAIL_ARG --agree-tos --non-interactive --redirect \
    && ok "SSL instalado para ${DOMAIN}" \
    || warn "Certbot falló. Ejecuta luego: sudo certbot --nginx -d ${DOMAIN}"
else
  warn "SSL omitido. Cuando el DNS esté activo:"
  warn "  sudo certbot --nginx -d ${DOMAIN}"
fi

# ══════════════════════════════════════════════
#  RESUMEN
# ══════════════════════════════════════════════
echo ""
echo -e "${BLD}${GRN}══════════════════════════════════════════════${NC}"
echo -e "${BLD}${GRN}  ✓  Kore instalado — Motor corriendo        ${NC}"
echo -e "${BLD}${GRN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BLD}Dominio:${NC}    https://${DOMAIN}"
echo -e "  ${BLD}Puerto:${NC}     ${PORT}"
echo -e "  ${BLD}Directorio:${NC} ${APP_DIR}"
echo ""
echo -e "${BLD}${YLW}  ┌──────────────────────────────────────────┐${NC}"
echo -e "${BLD}${YLW}  │  SIGUIENTE PASO — Abre en tu navegador: │${NC}"
echo -e "${BLD}${YLW}  │                                          │${NC}"
echo -e "${BLD}${YLW}  │    https://${DOMAIN}/setup               │${NC}"
echo -e "${BLD}${YLW}  │                                          │${NC}"
echo -e "${BLD}${YLW}  │  Configura: nombre, Kapitán,             │${NC}"
echo -e "${BLD}${YLW}  │  Claude API Key y selecciona tu Klik.    │${NC}"
echo -e "${BLD}${YLW}  └──────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${BLD}Comandos útiles:${NC}"
echo -e "   pm2 status          — estado del Motor"
echo -e "   pm2 logs ${APP_NAME}  — logs en tiempo real"
echo -e "   pm2 restart ${APP_NAME} — reiniciar"
echo -e "   node backup.js      — backup manual"
echo ""
echo -e "  ${BLD}${CYN}Kore 2.1 · nadIA Labs · nadialabs.cl${NC}"
echo ""
