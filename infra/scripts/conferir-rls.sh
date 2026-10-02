#!/usr/bin/env bash
#
# Confere que a Row Level Security está VALENDO para a credencial da aplicação.
#
# Por que existe: os testes da Fase 0 rodaram como superusuário com o search_path
# ajustado, e passaram — mas a aplicação conecta com outra role e outro
# search_path. Nessa configuração as políticas quebravam com "função app_perfil()
# não existe", e o defeito estava reservado para a produção. Este script fecha
# essa distância: ele pergunta ao banco na MESMA condição em que a API pergunta.
#
# Rodar depois de todo deploy que mexa em banco/*.sql ou em infra/sql/.
#
#   APP_DATABASE_URL=postgresql://nscodex_app:senha@localhost/nscodex \
#     bash infra/scripts/conferir-rls.sh
#
set -euo pipefail
: "${APP_DATABASE_URL:?APP_DATABASE_URL ausente (credencial da APLICAÇÃO, não a do migrator)}"

q() { psql "$APP_DATABASE_URL" -qtA -c "$1"; }
falhas=0
checa() { # nome, obtido, esperado
    if [ "$2" = "$3" ]; then echo "  PASSA  $1 ($2)"
    else echo "  FALHA  $1 — obtido '$2', esperado '$3'"; falhas=$((falhas+1)); fi
}

echo "Conferindo RLS com a credencial da aplicação"

# 1. Catálogo não tem RLS: tem de responder normalmente. Se falhar aqui, o
#    problema é GRANT, não política.
n=$(q "SELECT count(*) FROM cadastro.conta")
[ "$n" -ge 0 ] && echo "  PASSA  catálogo acessível ($n contas)"

# 2. Sem declarar quem age, não se enxerga lançamento nenhum. Este é o
#    comportamento fail-closed: sessão sem identidade não vê dado de ninguém.
checa "sessão sem identidade não vê lançamento" \
      "$(q "SELECT count(*) FROM orcamento.lancamento")" "0"

# 3. A aplicação não pode criar objeto. DDL é do migrator.
if psql "$APP_DATABASE_URL" -qtA -c "CREATE TABLE public.rls_check_tmp (id int)" >/dev/null 2>&1; then
    echo "  FALHA  a aplicação conseguiu criar tabela — credencial errada no .env?"
    psql "$APP_DATABASE_URL" -qtA -c "DROP TABLE public.rls_check_tmp" >/dev/null 2>&1 || true
    falhas=$((falhas+1))
else
    echo "  PASSA  DDL negado para a aplicação"
fi

# 4. A aplicação não é dona de tabela nenhuma — dono ignora RLS.
donas=$(q "SELECT count(*) FROM pg_tables
            WHERE schemaname IN ('cadastro','orcamento','auditoria','realizado')
              AND tableowner = current_user")
checa "aplicação não é dona de nenhuma tabela" "$donas" "0"

# 5. FORCE ligado nas três tabelas com política.
forcadas=$(q "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='orcamento' AND c.relrowsecurity AND c.relforcerowsecurity")
checa "FORCE ROW LEVEL SECURITY nas 3 tabelas" "$forcadas" "3"

echo
if [ "$falhas" -gt 0 ]; then
    echo "$falhas verificação(ões) FALHARAM — não siga com carga de dado real."
    exit 1
fi
echo "RLS valendo para a credencial da aplicação."
