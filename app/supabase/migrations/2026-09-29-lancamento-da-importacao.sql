-- ============================================================================
-- Qual arquivo trouxe cada lancamento
--
-- O historico de importacao (2026-09-22) diz o que cada arquivo trouxe, mas
-- nao da para voltar do lancamento ao arquivo: o Deep Dive precisa disso para
-- listar "templates" de verdade em vez de agrupar por empresa.
--
-- Roda depois de 2026-09-22-historico-de-importacao.sql. Se aquela ainda nao
-- tiver rodado, este arquivo cria a coluna assim mesmo e deixa a chave
-- estrangeira para quando a tabela `importacao` existir — rodar de novo
-- depois nao faz mal, tudo aqui e idempotente.
--
-- Como rodar:
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
--   O banco e compartilhado: avise o time antes, conforme o COLABORACAO.md.
--   Enquanto nao rodar, a importacao continua funcionando normalmente; o Deep
--   Dive so continua listando por empresa, com o aviso na tela.
-- ============================================================================

alter table lancamento add column if not exists importacao_id uuid;

-- A chave estrangeira so entra quando a tabela do historico existe. Sem o
-- ON DELETE SET NULL, apagar um registro do historico levaria junto os
-- lancamentos — que sao o dado, e nao o registro de quem os subiu.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'importacao')
     and not exists (
       select 1 from information_schema.table_constraints
       where constraint_name = 'lancamento_importacao_id_fkey'
     )
  then
    alter table lancamento
      add constraint lancamento_importacao_id_fkey
      foreign key (importacao_id) references importacao(id) on delete set null;
  end if;
end $$;

-- O Deep Dive filtra por arquivo; sem indice isso varre a tabela inteira.
create index if not exists lancamento_importacao_id_idx on lancamento (importacao_id);
