-- Ferramenta Orcamentaria — recusa de importacao sai da tabela principal
-- ============================================================================
--
-- O QUE FAZ
--   `importacao` ate aqui guardava duas coisas bem diferentes na mesma
--   tabela: template que ENTROU (resultado='importado') e tentativa que NAO
--   entrou (resultado='recusado'). "Templates importados" lia dali filtrando
--   um dos dois — e um teste que falha vira ruido bem no meio do registro de
--   dado real.
--
--   Cria `importacao_recusada`: mesma informacao de quem tentou, o arquivo,
--   o motivo e a conferencia (quando tinha uma, por impedimento), mas numa
--   tabela a parte — e um log, nao um registro de dado gravado. "Templates
--   recusados" passa a ler so daqui; `importacao` passa a ser so o que
--   realmente virou lancamento.
--
--   Apaga o que ja estava em `importacao` com resultado='recusado' — eram so
--   testes (nenhum tem lancamento de verdade atras, e e exatamente o "zerar"
--   que tava pendente).
--
-- O QUE NAO FAZ
--   Nao mexe em nenhuma linha com resultado='importado' nem em `lancamento`.
--   `if not exists` em tudo: rodar duas vezes nao da erro.
--
-- SEGURANCA
--   RLS ligado, igual log_erro: usuario logado le, cria e apaga (apagar e o
--   botao "Apagar" da tela, pra limpar teste). `importacao` tambem ganha uma
--   policy de apagar agora — faltava, e "Templates importados" precisa dela
--   pro grupo "Desconhecido".
--
-- COMO RODAR
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
-- ============================================================================

create table if not exists importacao_recusada (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  usuario_email  text,
  arquivo        text,
  tamanho_bytes  bigint,
  origem         text not null default 'gestao'
                 check (origem in ('gestao', 'receita', 'despesa', 'capex', 'pacote')),
  ano            int,
  ciclo_id       uuid references ciclo(id) on delete set null,
  versao_id      uuid references versao(id) on delete set null,
  versao_nome    text,
  nome_template  text,
  motivo         text,
  -- Só quando a recusa veio de uma conferência com impedimento (campo
  -- essencial vazio, conta fora do plano...) — recusa por arquivo ilegível
  -- não tem nada disso, fica tudo no default.
  tipos          jsonb not null default '{}'::jsonb,
  empresas       jsonb not null default '[]'::jsonb,
  totais         jsonb not null default '{}'::jsonb
);

create index if not exists importacao_recusada_criado_em_idx on importacao_recusada (criado_em desc);

alter table importacao_recusada enable row level security;

drop policy if exists importacao_recusada_ler on importacao_recusada;
create policy importacao_recusada_ler on importacao_recusada
  for select to authenticated using (true);

drop policy if exists importacao_recusada_criar on importacao_recusada;
create policy importacao_recusada_criar on importacao_recusada
  for insert to authenticated with check (true);

drop policy if exists importacao_recusada_apagar on importacao_recusada;
create policy importacao_recusada_apagar on importacao_recusada
  for delete to authenticated using (true);

-- `importacao` nunca tinha ganho uma policy de apagar (só select/insert/
-- update) — "Templates importados" precisa dela pra limpar o grupo
-- "Desconhecido" (registro sem nome de arquivo identificado).
drop policy if exists importacao_apagar on importacao;
create policy importacao_apagar on importacao
  for delete to authenticated using (true);

delete from importacao where resultado = 'recusado';
