#!/usr/bin/env bash
#
# Aplica o schema do NS Codex — os banco/*.sql, na ordem, uma vez cada.
#
# Este script é o GATE DE DEPLOY: roda ANTES de trocar o serviço, com a versão
# velha ainda no ar. Se falhar, o deploy aborta e a produção segue servindo o que
# já servia. É o mesmo desenho do `--migrate-only` da nsView, e nasceu do mesmo
# tipo de incidente: migration que quebra no boot põe o serviço em crash-loop.
#
# POR QUE NÃO É O EF: o schema tem RLS, políticas, gatilhos, índices parciais e
# RAISE EXCEPTION. O EF não modela nada disso. Aqui o SQL escrito à mão é a
# verdade, e o controle de "o que já rodou" é uma tabela nossa.
#
# Uso:
#   DATABASE_URL=postgresql://nscodex_migrator:senha@localhost/nscodex \
#     bash infra/scripts/aplicar-schema.sh
#
#   --dry-run   lista o que aplicaria e sai sem tocar no banco
#
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
BANCO_DIR="$RAIZ/banco"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

: "${DATABASE_URL:?DATABASE_URL ausente}"

psql_() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qtA "$@"; }

# ── Controle de versão do schema ────────────────────────────────────────────
# Uma linha por arquivo aplicado, com o hash do conteúdo. O hash é o que detecta
# o erro mais chato desta abordagem: alguém EDITAR um .sql já aplicado, em vez de
# criar o próximo. Sem ele, o banco de produção e o arquivo divergem em silêncio
# e ninguém descobre até o próximo restore do zero.
psql_ -c "
CREATE TABLE IF NOT EXISTS schema_versao (
    arquivo     text PRIMARY KEY,
    hash        text NOT NULL,
    aplicado_em timestamptz NOT NULL DEFAULT now(),
    aplicado_por text NOT NULL DEFAULT current_user
);" >/dev/null

pendentes=0
divergentes=0

for arq in "$BANCO_DIR"/*.sql; do
    nome="$(basename "$arq")"
    hash="$(sha256sum "$arq" | cut -c1-16)"
    ja="$(psql_ -c "SELECT hash FROM schema_versao WHERE arquivo = '$nome'")"

    if [ -z "$ja" ]; then
        pendentes=$((pendentes + 1))
        if [ "$DRY_RUN" = 1 ]; then
            echo "  APLICARIA  $nome ($hash)"
            continue
        fi
        echo "  aplicando  $nome ($hash)"
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$arq"
        psql_ -c "INSERT INTO schema_versao (arquivo, hash) VALUES ('$nome', '$hash')" >/dev/null
    elif [ "$ja" != "$hash" ]; then
        divergentes=$((divergentes + 1))
        echo "  ⚠ DIVERGENTE $nome — aplicado com hash $ja, no disco está $hash"
    else
        [ "$DRY_RUN" = 1 ] && echo "  ok         $nome"
    fi
done

if [ "$divergentes" -gt 0 ]; then
    echo
    echo "ERRO: $divergentes arquivo(s) já aplicado(s) foram EDITADOS depois."
    echo "Schema aplicado é imutável: crie um arquivo novo (08-..., 09-...) com a"
    echo "alteração, em vez de mexer no que já rodou. O banco de produção não vai"
    echo "reaplicar o antigo, então editar não muda nada lá — só cria divergência."
    exit 1
fi

if [ "$DRY_RUN" = 1 ]; then
    echo "(dry-run) $pendentes arquivo(s) pendente(s)."
    exit 0
fi

# FORCE RLS depois do schema, sempre — idempotente e barato.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$RAIZ/infra/sql/forcar-rls.sql"

echo "Schema aplicado: $pendentes arquivo(s) novo(s). Nada mais pendente."
