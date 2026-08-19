-- =============================================================================
-- FORCE ROW LEVEL SECURITY — a segunda tranca
-- =============================================================================
-- Aplicar DEPOIS dos banco/*.sql (as tabelas precisam existir).
--
-- `ENABLE ROW LEVEL SECURITY`, que o 07-permissoes.sql já faz, tem uma exceção
-- embutida: **o dono da tabela não é filtrado**. Isso é razoável como default do
-- Postgres — o dono precisa conseguir manutenção — mas significa que a proteção
-- depende de ninguém rodar a aplicação com a credencial errada.
--
-- `FORCE` remove a exceção: nem a dona escapa. O custo é real e é preciso saber:
-- manutenção que precise ver tudo passa a exigir superusuário, ou uma sessão que
-- declare `app.perfil = 'admin'`.
--
-- Por que vale: o modo de falha que isto cobre não é ataque, é engano — um
-- DATABASE_URL apontando para a role errada num deploy apressado. Sem FORCE, o
-- sistema funciona, ninguém percebe nada, e as políticas simplesmente não valem.
-- Com FORCE, ou está certo ou não passa.
--
-- Idempotente.
-- =============================================================================

\set ON_ERROR_STOP on

ALTER TABLE orcamento.lancamento     FORCE ROW LEVEL SECURITY;
ALTER TABLE orcamento.lancamento_mes FORCE ROW LEVEL SECURITY;
ALTER TABLE orcamento.entrega        FORCE ROW LEVEL SECURITY;

-- Confere e mostra o resultado, para não ficar na fé.
SELECT c.relname AS tabela,
       c.relrowsecurity  AS rls_ligada,
       c.relforcerowsecurity AS rls_forcada
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'orcamento' AND c.relrowsecurity
 ORDER BY 1;
