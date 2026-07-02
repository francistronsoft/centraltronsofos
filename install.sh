#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="central-tronsoftos"
SERVICE_NAME="central-tronsoftos"
APP_USER="${CENTRAL_TRONSOFTOS_USER:-central-tronsoftos}"
APP_GROUP="${CENTRAL_TRONSOFTOS_GROUP:-central-tronsoftos}"
INSTALL_ROOT="${CENTRAL_TRONSOFTOS_INSTALL_ROOT:-/opt/central-tronsoftos}"
APP_DIR="${CENTRAL_TRONSOFTOS_APP_DIR:-$INSTALL_ROOT/app}"
ENV_FILE="${CENTRAL_TRONSOFTOS_ENV_FILE:-/etc/central-tronsoftos/central.env}"
PORT="${CENTRAL_TRONSOFTOS_PORT:-3080}"
DOMAIN="${CENTRAL_TRONSOFTOS_DOMAIN:-central.tronsoft.app.br}"
SETUP_NGINX="${CENTRAL_TRONSOFTOS_SETUP_NGINX:-ask}"
INSTALL_NODE="${CENTRAL_TRONSOFTOS_INSTALL_NODE:-ask}"
NODE_MAJOR="${CENTRAL_TRONSOFTOS_NODE_MAJOR:-22}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN=""

log() {
  printf '\n\033[1;36m==>\033[0m %s\n' "$*"
}

warn() {
  printf '\n\033[1;33mAVISO:\033[0m %s\n' "$*"
}

fail() {
  printf '\n\033[1;31mERRO:\033[0m %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatorio nao encontrado: $1"
}

as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

ask_yes_no() {
  local question="$1"
  local default="${2:-n}"
  local answer
  local hint="[s/N]"
  [[ "$default" == "s" ]] && hint="[S/n]"

  if [[ ! -t 0 ]]; then
    [[ "$default" == "s" ]]
    return
  fi

  read -r -p "$question $hint " answer
  answer="${answer:-$default}"
  [[ "$answer" =~ ^[sSyY]$ ]]
}

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node --version | sed -E 's/^v([0-9]+).*/\1/'
}

install_node_from_nodesource() {
  log "Instalando Node.js ${NODE_MAJOR}.x via NodeSource"
  as_root apt-get update
  as_root apt-get install -y ca-certificates curl gnupg
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | as_root bash -
  as_root apt-get install -y nodejs
}

ensure_node() {
  local major
  major="$(node_major_version)"
  if [[ "$major" -ge 20 ]]; then
    log "Node.js encontrado: $(node --version)"
    return
  fi

  case "$INSTALL_NODE" in
    yes|sim|s|true|1)
      install_node_from_nodesource
      ;;
    no|nao|n|false|0)
      fail "Node.js 20+ e obrigatorio. Instale Node.js e rode novamente."
      ;;
    *)
      if ask_yes_no "Node.js 20+ nao foi encontrado. Instalar Node.js ${NODE_MAJOR}.x agora?" "s"; then
        install_node_from_nodesource
      else
        fail "Instalacao interrompida: Node.js 20+ e obrigatorio."
      fi
      ;;
  esac

  major="$(node_major_version)"
  [[ "$major" -ge 20 ]] || fail "Node.js instalado, mas a versao ainda e menor que 20."
}

ensure_user() {
  if id "$APP_USER" >/dev/null 2>&1; then
    log "Usuario $APP_USER ja existe"
    return
  fi

  log "Criando usuario de servico $APP_USER"
  as_root adduser --system --group --home "$INSTALL_ROOT" "$APP_USER"
}

copy_app() {
  log "Instalando arquivos em $APP_DIR"
  as_root mkdir -p "$APP_DIR" "$APP_DIR/data" "$(dirname "$ENV_FILE")"

  if [[ "$SOURCE_DIR" == "$APP_DIR" ]]; then
    warn "Origem e destino sao iguais; mantendo arquivos atuais."
  else
    local tmp
    tmp="$(mktemp -d)"
    (
      cd "$SOURCE_DIR"
      tar \
        --exclude='./.git' \
        --exclude='./.agents' \
        --exclude='./data/*.json' \
        --exclude='data/*.json' \
        --exclude='./node_modules' \
        --exclude='./dist' \
        --exclude='./build' \
        -cf "$tmp/app.tar" .
    )
    as_root tar -xf "$tmp/app.tar" -C "$APP_DIR"
    rm -rf "$tmp"
  fi

  as_root mkdir -p "$APP_DIR/data"
  as_root chown -R "$APP_USER:$APP_GROUP" "$INSTALL_ROOT"
}

write_env() {
  if [[ -f "$ENV_FILE" ]]; then
    log "Arquivo de ambiente ja existe: $ENV_FILE"
    return
  fi

  log "Criando $ENV_FILE"
  as_root tee "$ENV_FILE" >/dev/null <<EOF
PORT=$PORT
EOF
  as_root chmod 640 "$ENV_FILE"
  as_root chown "root:$APP_GROUP" "$ENV_FILE"
}

write_systemd() {
  NODE_BIN="$(command -v node)"
  log "Configurando systemd"
  as_root tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=Central TronSoftOS
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

  as_root systemctl daemon-reload
  as_root systemctl enable "$SERVICE_NAME"
  as_root systemctl restart "$SERVICE_NAME"
}

setup_nginx() {
  log "Configurando Nginx para $DOMAIN"
  as_root apt-get update
  as_root apt-get install -y nginx

  as_root tee "/etc/nginx/sites-available/${SERVICE_NAME}" >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  as_root ln -sfn "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
  as_root nginx -t
  as_root systemctl enable nginx
  as_root systemctl reload nginx
}

maybe_setup_nginx() {
  case "$SETUP_NGINX" in
    yes|sim|s|true|1)
      setup_nginx
      ;;
    no|nao|n|false|0)
      log "Pulando Nginx. A Central ficara em http://127.0.0.1:$PORT"
      ;;
    *)
      if ask_yes_no "Configurar Nginx para o dominio $DOMAIN?" "s"; then
        setup_nginx
      else
        log "Pulando Nginx. A Central ficara em http://127.0.0.1:$PORT"
      fi
      ;;
  esac
}

health_check() {
  log "Validando servico"
  sleep 2
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "http://127.0.0.1:$PORT/health" || {
      as_root systemctl status "$SERVICE_NAME" --no-pager || true
      fail "Health check falhou."
    }
  else
    as_root systemctl is-active --quiet "$SERVICE_NAME" || {
      as_root systemctl status "$SERVICE_NAME" --no-pager || true
      fail "Servico nao esta ativo."
    }
  fi
}

main() {
  [[ -f "$SOURCE_DIR/package.json" ]] || fail "Rode este instalador a partir da pasta clonada da Central TronSoftOS."
  need_cmd tar
  need_cmd sed
  if [[ "$(id -u)" -ne 0 ]]; then
    need_cmd sudo
  fi

  log "Instalador da Central TronSoftOS"
  ensure_node
  ensure_user
  copy_app
  write_env
  write_systemd
  maybe_setup_nginx
  health_check

  log "Instalacao concluida"
  printf 'Servico: %s\n' "$SERVICE_NAME"
  printf 'App: %s\n' "$APP_DIR"
  printf 'Env: %s\n' "$ENV_FILE"
  printf 'Local: http://127.0.0.1:%s\n' "$PORT"
  printf 'Dominio/tunnel: http://%s\n' "$DOMAIN"
  printf '\nComandos uteis:\n'
  printf '  sudo systemctl status %s\n' "$SERVICE_NAME"
  printf '  sudo journalctl -u %s -f\n' "$SERVICE_NAME"
}

main "$@"
