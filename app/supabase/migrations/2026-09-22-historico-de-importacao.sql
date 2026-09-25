-- Ferramenta Orcamentaria — historico de importacao de templates
-- ============================================================================
--
-- O QUE FAZ
--   Cria a tabela `importacao`: um registro por Template Budget importado,
--   com quem subiu, o arquivo, o ano/versao de destino, o que entrou de cada
--   tipo (Receita, Despesa, Capex) e os numeros do arquivo por empresa —
--   Gross e Net Revenue, despesa e capex. E o que alimenta a lista
--   "Templates importados" da Gestao de Importacao.
--
--   Traz tambem a liberacao do template: aguardando, liberado ou devolvido,
--   com quem decidiu, quando e o motivo. O checklist diz se o arquivo esta
--   tecnicamente apto; a liberacao e a decisao de quem responde pelo numero.
--
--   Os numeros sao uma fotografia do momento da importacao. Se depois os
--   lancamentos forem editados, substituidos por outra importacao ou
--   apagados, o registro continua dizendo o que o arquivo trazia.
--
-- O QUE NAO FAZ
--   Nao altera nenhuma tabela existente nem dado ja gravado. Importacoes
--   feitas antes deste SQL nao aparecem na lista — nao ha de onde tira-las.
--   `if not exists` em tudo: rodar duas vezes nao da erro.
--
-- SEGURANCA
--   Liga RLS nesta tabela e so libera para usuario logado (role
--   `authenticated`): a chave anon vai no bundle do navegador, e sem RLS
--   qualquer um com ela leria quem importou o que.
--
-- COMO RODAR
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
--   O banco e compartilhado: avise o time antes, conforme o COLABORACAO.md.
--   Enquanto nao rodar, a importacao continua funcionando normalmente; so a
--   lista fica com o aviso de que falta este SQL.
-- ============================================================================

create table if not exists importacao (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  usuario_email  text,                       -- quem subiu (Supabase Auth)
  arquivo        text not null,              -- nome do arquivo
  tamanho_bytes  bigint,
  origem         text not null default 'gestao'
                 check (origem in ('gestao', 'receita', 'despesa', 'capex')),  -- tela de onde veio
  ano            int,                        -- ano do cabecalho do template
  ciclo_id       uuid references ciclo(id) on delete set null,
  versao_id      uuid references versao(id) on delete set null,
  versao_nome    text,                       -- guardado a parte: a versao pode ser apagada
  -- Por tipo: { "receita": { "linhas": 120, "total": 1.0e7, "apagados": 0, "desfeito": false }, ... }
  tipos          jsonb not null default '{}'::jsonb,
  -- Por empresa: [{ "id", "nome", "linhas", "gr", "nr", "despesa", "capex" }]
  empresas       jsonb not null default '[]'::jsonb,
  -- Soma do arquivo: { "linhas", "gr", "nr", "despesa", "capex" }
  totais         jsonb not null default '{}'::jsonb,

  -- ---------- Liberacao do template (FP&A BU's / Corporate) ----------
  -- O checklist diz se o arquivo esta tecnicamente apto; a liberacao e a
  -- decisao de quem responde pelo numero. Sem ela o template fica esperando.
  liberacao      text not null default 'aguardando'
                 check (liberacao in ('aguardando', 'liberado', 'devolvido')),
  liberado_por   text,                       -- e-mail de quem decidiu
  liberado_em    timestamptz,
  liberacao_obs  text                        -- motivo, obrigatorio ao devolver
);

-- As colunas de liberacao para quem ja tinha criado a tabela antes desta
-- versao do arquivo. Em banco novo nao fazem nada: o create acima ja as tem.
alter table importacao
  add column if not exists liberacao     text not null default 'aguardando',
  add column if not exists liberado_por  text,
  add column if not exists liberado_em   timestamptz,
  add column if not exists liberacao_obs text;

create index if not exists importacao_criado_em_idx on importacao (criado_em desc);
create index if not exists importacao_liberacao_idx on importacao (liberacao);

alter table importacao enable row level security;

drop policy if exists importacao_ler on importacao;
create policy importacao_ler on importacao
  for select to authenticated using (true);

drop policy if exists importacao_criar on importacao;
create policy importacao_criar on importacao
  for insert to authenticated with check (true);

-- Update: a mesma importacao ganha Despesa e Capex depois da Receita, e o
-- "Desfazer" marca o tipo como desfeito.
drop policy if exists importacao_atualizar on importacao;
create policy importacao_atualizar on importacao
  for update to authenticated using (true) with check (true);

-- ============================================================================
-- Parametros que faltavam: pacotes e grupos de fornecedor
-- ============================================================================
--
-- O QUE FAZ
--   `pacote` e `subpacote`: a lista oficial dos pacotes de gasto. Ate aqui o
--   pacote era texto solto vindo do template, sem lista para conferir — por
--   isso o checklist da importacao nao conseguia validar.
--
--   `fornecedor_grupo` e a coluna `fornecedor.grupo`: o agrupamento de
--   fornecedores, para somar gasto por grupo economico em vez de por razao
--   social.
--
-- O QUE NAO FAZ
--   Nao mexe em lancamento nem em dado gravado. Rodar duas vezes nao da erro.
-- ============================================================================

create table if not exists pacote (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  descricao text,
  ativo     boolean not null default true
);

create table if not exists subpacote (
  id        uuid primary key default gen_random_uuid(),
  pacote    text not null,           -- nome do pacote, como vem no template
  nome      text not null,
  descricao text,
  unique (pacote, nome)
);

create table if not exists fornecedor_grupo (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  descricao text
);

-- O grupo no proprio fornecedor: e por ele que o gasto soma por grupo.
alter table fornecedor add column if not exists grupo text;

alter table pacote enable row level security;
alter table subpacote enable row level security;
alter table fornecedor_grupo enable row level security;

drop policy if exists pacote_tudo on pacote;
create policy pacote_tudo on pacote for all to authenticated using (true) with check (true);

drop policy if exists subpacote_tudo on subpacote;
create policy subpacote_tudo on subpacote for all to authenticated using (true) with check (true);

drop policy if exists fornecedor_grupo_tudo on fornecedor_grupo;
create policy fornecedor_grupo_tudo on fornecedor_grupo for all to authenticated using (true) with check (true);
