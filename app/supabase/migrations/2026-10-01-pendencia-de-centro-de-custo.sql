-- Ferramenta Orcamentaria — pendencia de centro de custo
-- ============================================================================
--
-- O QUE FAZ
--   Centro de custo preenchido no template mas que nao existe no cadastro
--   hoje bloqueava a importacao igual a um campo vazio — e nao tinha pra onde
--   mandar o pedido de cadastro, diferente de conta (que ja tem essa fila:
--   `conta_pendente`, aprovada em /pendencia-cadastros).
--
--   Cria `centro_custo_pendente`, o mesmo mecanismo de `conta_pendente` mas
--   pra centro de custo: a linha entra mesmo sem o centro de custo estar
--   cadastrado (deixa de ser impedimento, vira so pendencia — ver mudanca em
--   avaliar(), no codigo), e o pedido de cadastrar o centro de custo novo
--   fica esperando alguem aprovar.
--
-- O QUE NAO FAZ
--   Nao mexe em `conta_pendente` nem no fluxo de conta. `if not exists` em
--   tudo: rodar duas vezes nao da erro.
--
-- SEGURANCA
--   RLS ligado, no padrao das tabelas criadas depois de 2026-09-22 (uma
--   policy so, pra authenticated) — `conta_pendente` e de antes dessa
--   convencao e nao tem RLS nenhum; esta tabela e nova, entao ja nasce com.
--
-- COMO RODAR
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
-- ============================================================================

create table if not exists centro_custo_pendente (
  id                 uuid primary key default gen_random_uuid(),
  rotulo             text not null,          -- o centro de custo como veio no template
  descricao          text,
  motivo             text,
  tipo               text not null check (tipo in ('receita', 'despesa', 'capex')),
  origem             text,                   -- nome do arquivo
  linhas             integer not null default 0,
  valor              numeric(14, 2),
  status             text not null default 'pendente'
                     check (status in ('pendente', 'aprovada', 'reprovada')),
  solicitado_em      timestamptz not null default now(),
  solicitado_por     text,
  decidido_em        timestamptz,
  decidido_por       text,
  observacao_decisao text,
  centro_custo_id    uuid references centro_de_custo(id) on delete set null
);

-- Mesma regra de conta_pendente: um pedido aberto por rótulo+tipo, não um
-- por linha — 300 linhas do mesmo centro de custo são um pedido só.
create unique index if not exists centro_custo_pendente_aberta
  on centro_custo_pendente (lower(rotulo), tipo) where status = 'pendente';

alter table centro_custo_pendente enable row level security;

drop policy if exists centro_custo_pendente_tudo on centro_custo_pendente;
create policy centro_custo_pendente_tudo on centro_custo_pendente
  for all to authenticated using (true) with check (true);
