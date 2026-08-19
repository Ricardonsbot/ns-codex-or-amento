#!/usr/bin/env bash
#
# Backup do Postgres do NS Codex. Roda na VM pelo timer ns-codex-backup.timer.
# Só lê o banco e grava um dump — não toca em nada da aplicação.
#
# Formato custom (-Fc): comprimido e permite restore seletivo com pg_restore.
#
set -euo pipefail

ENV_FILE="${NSCODEX_ENV_FILE:-/opt/ns-codex/api/.env}"
BACKUP_DIR="${NSCODEX_BACKUP_DIR:-/opt/ns-codex/backups}"
RETENTION_DAYS="${NSCODEX_BACKUP_RETENTION_DAYS:-14}"

# Rótulo opcional ($1) compõe o nome: nscodex_precarga_<ts>.dump. Serve para
# marcar o backup que se tira ANTES de uma carga grande.
LABEL="$(printf '%s' "${1:-}" | tr -cd '[:alnum:]_-')"
TS="$(date +%Y%m%d_%H%M%S)"
if [[ -n "$LABEL" ]]; then
  OUT="${BACKUP_DIR}/nscodex_${LABEL}_${TS}.dump"
else
  OUT="${BACKUP_DIR}/nscodex_${TS}.dump"
fi

mkdir -p "$BACKUP_DIR"

# Lê SÓ a linha do DATABASE_URL em vez de `source`ar o .env inteiro. O motivo é
# um bug real que a nsView pagou: o .env tem outras variáveis, e se qualquer uma
# delas tiver caractere que o bash não aceite como atribuição, o `source` aborta
# o script sob `set -e` — o backup para por um motivo que não tem nada a ver com
# backup, e em silêncio.
if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2-)"
fi
: "${DATABASE_URL:?DATABASE_URL ausente — defina em ${ENV_FILE} ou exporte antes de rodar}"

echo "[$(date -Is)] iniciando backup -> ${OUT}"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$OUT"
echo "[$(date -Is)] backup OK: ${OUT} ($(du -h "$OUT" | cut -f1))"

DELETED="$(find "$BACKUP_DIR" -name 'nscodex_*.dump' -mtime +"${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
echo "[$(date -Is)] retenção: ${DELETED} dump(s) com mais de ${RETENTION_DAYS}d removido(s)"

# ⚠ Backup que nunca foi restaurado não é backup. O procedimento de restore está
# no infra/README.md, e vale exercitá-lo contra um banco descartável de vez em
# quando — de preferência antes de precisar.
