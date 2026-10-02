#!/usr/bin/env bash
#
# Deploy do NS Codex — roda NO SERVIDOR, como a conta de deploy.
#
#   cd /opt/ns-codex/repo && git pull origin main && bash infra/scripts/deploy.sh
#
# O que este script NÃO faz, de propósito: provisionar. Nada de criar usuário,
# instalar unit, mexer em /etc ou chown. Isso é infra/scripts/provisionar-servidor.sh,
# rodado à mão por ops, uma vez. Foi assim que a nsView deixou de precisar dar sudo
# irrestrito ao deploy — e o motivo de, na VM antiga deles, quem tinha write no
# repositório ter root na produção.
#
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR=/opt/ns-codex
SERVICO=ns-codex-api

export DOTNET_ROOT=/opt/dotnet
export PATH="$PATH:$DOTNET_ROOT"

echo ">>> [$(date -Is)] deploy a partir de $RAIZ"

# ── 1. Build ────────────────────────────────────────────────────────────────
# Antes de qualquer coisa: se não compila ou se teste falha, o deploy morre aqui
# e a produção nem fica sabendo.
dotnet test "$RAIZ/backend/NsCodex.sln" -c Release --nologo
dotnet publish "$RAIZ/backend/NsCodex.Api/NsCodex.Api.csproj" -c Release -o "$APP_DIR/deploy/api"

# ── 2. GATE: schema antes de trocar o serviço ───────────────────────────────
# O schema é aplicado com a versão VELHA ainda no ar. Se falhar, o deploy aborta
# e a produção segue servindo o que servia. É o equivalente do `--migrate-only`
# da nsView, que nasceu de uma migration que pôs o boot em crash-loop.
#
# Roda com a credencial do MIGRATOR, não a da aplicação: a app não tem DDL.
: "${MIGRATOR_DATABASE_URL:?MIGRATOR_DATABASE_URL ausente no ambiente do deploy}"
DATABASE_URL="$MIGRATOR_DATABASE_URL" bash "$RAIZ/infra/scripts/aplicar-schema.sh"

# ── 3. Trocar o binário ─────────────────────────────────────────────────────
sudo systemctl stop "$SERVICO"

# --delete para não deixar DLL órfã de versão anterior; .env e logs preservados.
rsync -a --delete \
  --exclude='.env' \
  --exclude='logs' \
  "$APP_DIR/deploy/api/" "$APP_DIR/api/"

sudo systemctl start "$SERVICO"

# ── 4. Provar que subiu ─────────────────────────────────────────────────────
# `systemctl start` volta com sucesso assim que o processo nasce, não quando ele
# está servindo. Sem o health, um crash no boot passaria por deploy bem-sucedido.
for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:5055/health >/dev/null; then
        echo ">>> API respondendo."
        break
    fi
    if [ "$i" = 15 ]; then
        echo ">>> FALHA: /health não respondeu em 15s. Últimos logs:"
        sudo journalctl -u "$SERVICO" --since "1 minute ago" -n 40
        exit 1
    fi
    sleep 1
done

# ── 5. Front (opt-in) ───────────────────────────────────────────────────────
# ⚠ Publicar o front hoje é publicar a carteira: Referencias/clientes.json tem
# 3.797 CNPJs e assets/js/dados.js leva uma cópia embutida. Enquanto não houver
# autenticação, isto fica atrás de uma variável que alguém precisa digitar.
if [ "${PUBLICAR_FRONT:-0}" = "1" ]; then
    echo ">>> publicando front estático"
    rsync -a --delete \
      --exclude='backend/' --exclude='banco/' --exclude='infra/' \
      --exclude='ferramentas/' --exclude='Referencias/' --exclude='docs/' \
      --exclude='.git/' --exclude='*.md' --exclude='*.xlsx' --exclude='*.xlsb' \
      "$RAIZ/" /var/www/ns-codex/
else
    echo ">>> front NÃO publicado (PUBLICAR_FRONT=1 para publicar — leia o aviso"
    echo "    em infra/nginx/ns-codex.conf antes)"
fi

echo ">>> [$(date -Is)] deploy concluído."
