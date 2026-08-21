#!/usr/bin/env bash
# Provisiona um servidor do NS Codex do zero. Roda UMA VEZ, por quem tem root.
#
# A fronteira é esta: provisionar é tarefa de ops, feita à mão e revisada. O
# deploy só compila, copia para diretório que já é dele e reinicia o serviço,
# com uma lista FECHADA de sudo. Sem isso, quem tem write no repositório tem
# root na produção.
#
# Uso:  sudo infra/scripts/provisionar-servidor.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "rode como root (sudo)"; exit 1; }

APP_DIR=/opt/ns-codex
WEB_DIR=/var/www/ns-codex
DEPLOY_USER=nscodex-deploy
DOTNET_DIR=/opt/dotnet
DOTNET_CHANNEL=9.0
BANCO=nscodex
AQUI="$(cd "$(dirname "$0")" && pwd)"

echo "── 0. Pacotes do sistema ───────────────────────────────────────────────────"
# Postgres, nginx e o resto vêm do apt. O Postgres fica NA PRÓPRIA VM e escutando
# só em localhost — é o desenho da nsView e não é economia de máquina.
#
# A razão é a RLS: ela protege contra a APLICAÇÃO errar, não contra alguém com a
# credencial mentir. Quem tiver a senha de nscodex_app e um psql declara
# `SET app.perfil = 'admin'` e enxerga tudo. Com o banco só em localhost, um
# vazamento de credencial ainda exige entrar na VM antes de virar acesso a dado.
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    postgresql postgresql-client nginx rsync curl ca-certificates
systemctl enable --now postgresql
echo "   postgres: $(sudo -u postgres psql -tAc 'SHOW server_version')"

# Confere que não está escutando fora. Se alguém tiver aberto, é decisão
# consciente de outra pessoa — o script avisa em vez de silenciosamente fechar.
ESCUTA="$(sudo -u postgres psql -tAc 'SHOW listen_addresses')"
if [ "$ESCUTA" != "localhost" ] && [ "$ESCUTA" != "127.0.0.1" ]; then
    echo "   ⚠ listen_addresses = '$ESCUTA' — o Postgres aceita conexão de fora."
    echo "     Confira o pg_hba.conf e o firewall antes de carregar dado real."
fi

echo "── 1. Runtime .NET ─────────────────────────────────────────────────────────"
# .NET 9 não está nos repos do Ubuntu 24.04 (só 8 e 10) — daí o instalador
# oficial. Em local de SISTEMA, não no home de alguém: deploy e systemd
# compartilham o mesmo runtime.
if [ ! -x "$DOTNET_DIR/dotnet" ]; then
    curl -sSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
    chmod +x /tmp/dotnet-install.sh
    /tmp/dotnet-install.sh --channel "$DOTNET_CHANNEL" --install-dir "$DOTNET_DIR" --no-path
    rm -f /tmp/dotnet-install.sh
fi
ln -sf "$DOTNET_DIR/dotnet" /usr/local/bin/dotnet
echo "   .NET: $(dotnet --list-sdks | head -1)"

echo "── 2. Conta de deploy (sem privilégio) ─────────────────────────────────────"
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd -r -m -d "/home/$DEPLOY_USER" -s /bin/bash "$DEPLOY_USER"

cat > /etc/sudoers.d/$DEPLOY_USER <<SUDOERS
# Deploy do NS Codex. Lista FECHADA de propósito.
# O que está FORA é o que importa: sem shell, sem cp para /etc, sem
# daemon-reload e sem -u postgres. Esta conta não vira root e não alcança o
# banco por peer auth.
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl start ns-codex-api
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl stop ns-codex-api
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart ns-codex-api
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl is-active ns-codex-api
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl status ns-codex-api
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/sbin/nginx -t
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/journalctl -u ns-codex-api *
SUDOERS
chmod 440 /etc/sudoers.d/$DEPLOY_USER
visudo -c -f /etc/sudoers.d/$DEPLOY_USER

echo "── 3. Diretórios ───────────────────────────────────────────────────────────"
mkdir -p "$APP_DIR"/{api,repo,scripts,logs,backups} "$WEB_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR" "$WEB_DIR"
install -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$AQUI/backup-postgres.sh" "$APP_DIR/scripts/"
touch "$APP_DIR/api/.env"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/api/.env"
chmod 600 "$APP_DIR/api/.env"

echo "── 4. Banco, roles e schema ────────────────────────────────────────────────"
SENHA_APP="$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)"
SENHA_MIGRATOR="$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$BANCO'" | grep -q 1 \
    || sudo -u postgres createdb "$BANCO"

sudo -u postgres psql -d "$BANCO" -v ON_ERROR_STOP=1 \
    -v senha_app="$SENHA_APP" -v senha_migrator="$SENHA_MIGRATOR" \
    -f "$AQUI/../sql/roles.sql"

# O schema roda como migrator, que é membro da dona — assim as tabelas nascem
# pertencendo a nscodex_owner, e NÃO à aplicação. É o que faz a RLS valer.
DATABASE_URL="postgresql://nscodex_migrator:$SENHA_MIGRATOR@localhost/$BANCO" \
    bash "$AQUI/aplicar-schema.sh"

# O GRANT de app_escrita depende de o 07 já ter rodado, então repete aqui.
sudo -u postgres psql -d "$BANCO" -qc "GRANT app_escrita TO nscodex_app;"

echo "── 5. systemd ──────────────────────────────────────────────────────────────"
cp "$AQUI/../systemd/ns-codex-api.service"    /etc/systemd/system/
cp "$AQUI/../systemd/ns-codex-backup.service" /etc/systemd/system/
cp "$AQUI/../systemd/ns-codex-backup.timer"   /etc/systemd/system/
systemctl daemon-reload
systemctl enable ns-codex-api ns-codex-backup.timer
systemctl start ns-codex-backup.timer

echo "── 6. nginx ────────────────────────────────────────────────────────────────"
if [ -f /etc/nginx/ssl/nstech.crt ]; then
    cp "$AQUI/../nginx/ns-codex.conf" /etc/nginx/sites-available/ns-codex
    ln -sf /etc/nginx/sites-available/ns-codex /etc/nginx/sites-enabled/ns-codex
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo "   HTTPS configurado"
else
    echo "   ⚠ certificado ausente em /etc/nginx/ssl/nstech.crt — nginx não configurado."
    echo "     O .crt precisa ter FOLHA + INTERMEDIÁRIA, nessa ordem."
fi

echo
echo "════════════════════════════════════════════════════════════════════════════"
echo "Escreva isto no $APP_DIR/api/.env (chmod 600) e guarde no cofre:"
echo
echo "DATABASE_URL=postgresql://nscodex_app:$SENHA_APP@localhost/$BANCO"
echo
echo "E no ambiente de quem roda o deploy (NÃO no .env da API):"
echo "MIGRATOR_DATABASE_URL=postgresql://nscodex_migrator:$SENHA_MIGRATOR@localhost/$BANCO"
echo "════════════════════════════════════════════════════════════════════════════"
echo
echo "O que este script NÃO faz, de propósito:"
echo "  • copiar o certificado TLS   -> de quem cuida da chave privada"
echo "  • publicar o front           -> não antes da autenticação (ver nginx conf)"
echo "  • criar o primeiro usuário   -> ainda não existe autenticação"
