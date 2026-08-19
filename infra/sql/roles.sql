-- =============================================================================
-- ROLES DO NS CODEX — quem é dono, quem migra, quem a aplicação usa
-- =============================================================================
-- Rodar como superusuário, UMA VEZ por cluster, ANTES dos banco/*.sql.
--
-- Três roles, e a separação não é burocracia — é o que faz a RLS valer:
--
--   nscodex_owner     dona das tabelas. NÃO faz login. Existe para que a posse
--                     não fique com `postgres` nem com a aplicação.
--   nscodex_migrator  aplica o schema. Faz login. É membro da dona.
--   nscodex_app       a aplicação. Faz login. NÃO é dona de nada.
--
-- ⚠ POR QUE A APLICAÇÃO NÃO PODE SER DONA: no Postgres o dono da tabela ignora
-- Row Level Security por padrão. Se a API conectasse como dona (ou como
-- `postgres`), as políticas de 07-permissoes.sql seriam decorativas — o teste
-- que fizemos na Fase 0, em que o DELETE de outra empresa afeta zero linha,
-- passaria a apagar. É o erro mais fácil de cometer e o mais silencioso.
--
-- A cinta e o suspensório: infra/sql/forcar-rls.sql, aplicado DEPOIS dos
-- banco/*.sql, liga FORCE ROW LEVEL SECURITY para que nem a dona escape.
-- =============================================================================

\set ON_ERROR_STOP on

-- As senhas NÃO ficam aqui. São passadas por variável do psql:
--   psql -v senha_app='...' -v senha_migrator='...' -f infra/sql/roles.sql
-- Ver infra/scripts/provisionar-servidor.sh, que as gera com openssl.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nscodex_owner') THEN
        CREATE ROLE nscodex_owner NOLOGIN;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nscodex_migrator') THEN
        CREATE ROLE nscodex_migrator LOGIN;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nscodex_app') THEN
        CREATE ROLE nscodex_app LOGIN;
    END IF;
END $$;

ALTER ROLE nscodex_migrator PASSWORD :'senha_migrator';
ALTER ROLE nscodex_app      PASSWORD :'senha_app';

-- O migrator age COMO a dona, então tudo que ele cria nasce pertencendo a ela.
GRANT nscodex_owner TO nscodex_migrator;

-- A aplicação herda os privilégios de app_escrita (criada em 07-permissoes.sql).
-- INHERIT é o default no Postgres, então não é preciso SET ROLE a cada conexão —
-- e é melhor assim: um SET ROLE esquecido seria falha silenciosa.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_escrita') THEN
        GRANT app_escrita TO nscodex_app;
    ELSE
        RAISE NOTICE 'app_escrita ainda não existe — rode banco/07-permissoes.sql e repita este GRANT';
    END IF;
END $$;

-- A aplicação não cria nada em `public`. DDL é do migrator, e só dele.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Mas a dona precisa criar: e ela quem cria os schemas, as tabelas e o controle
-- de versao do schema. Sem isto o proprio aplicar-schema.sh nao consegue criar a
-- tabela schema_versao e o gate de deploy morre na primeira linha.
GRANT CREATE, USAGE ON SCHEMA public TO nscodex_owner;

-- search_path da aplicação. As funções da RLS já fixam o delas (banco/07), então
-- isto é conveniência para SQL cru futuro, não a garantia — a garantia está lá.
ALTER ROLE nscodex_app      SET search_path = orcamento, cadastro, auditoria, realizado, public;
ALTER ROLE nscodex_migrator SET search_path = orcamento, cadastro, auditoria, realizado, public;

-- ⚠ Ser MEMBRO da dona não basta: no Postgres o objeto nasce pertencendo à role
-- CORRENTE, não a uma role da qual você é membro. Sem esta linha, as tabelas
-- ficariam de nscodex_migrator e a posse combinada aqui seria ficção.
-- Com ela, toda sessão do migrator já entra agindo como a dona.
ALTER ROLE nscodex_migrator SET role TO nscodex_owner;

-- E criar SCHEMA exige privilegio no BANCO, nao no schema public. Sem isto o
-- 01-cadastro.sql para no primeiro comando (CREATE SCHEMA cadastro) com
-- "permissao negada para banco de dados".
DO $$
BEGIN
    EXECUTE format('GRANT CREATE ON DATABASE %I TO nscodex_owner', current_database());
END $$;
