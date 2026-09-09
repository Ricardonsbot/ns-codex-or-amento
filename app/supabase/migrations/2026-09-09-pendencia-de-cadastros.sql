-- Pendência de Cadastros: as contas que a importação encontrou na planilha e
-- que não existem no plano, enviadas para aprovação em vez de ficarem só
-- marcadas no lançamento.
--
-- Rode no SQL Editor do Supabase (Project → SQL Editor → New query → Run).
-- O banco é compartilhado — avise o time antes, conforme o COLABORACAO.md.
--
-- A importação continua funcionando sem esta tabela: a tela detecta se ela
-- existe e só oferece o envio para aprovação quando existir.

create table if not exists conta_pendente (
  id uuid primary key default gen_random_uuid(),

  -- o que a planilha trazia na coluna "Conta Contábil"
  rotulo text not null,
  -- onde apareceu: empresas e quantas linhas, para quem aprova ter contexto
  descricao text,
  -- por que está sendo pedida
  motivo text,

  tipo text not null check (tipo in ('receita', 'despesa', 'capex')),
  origem text,                       -- nome do arquivo que originou o pedido
  linhas integer not null default 0, -- quantas linhas do template usavam o rótulo
  valor numeric(14, 2),              -- quanto de orçamento depende dela

  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'reprovada')),

  solicitado_em timestamptz not null default now(),
  solicitado_por text,
  decidido_em timestamptz,
  decidido_por text,
  observacao_decisao text,

  -- preenchido quando aprovada: a conta que passou a existir
  conta_id uuid references conta(id) on delete set null
);

-- Um mesmo rótulo pode voltar a ser pedido depois de reprovado, mas não pode
-- ter dois pedidos em aberto ao mesmo tempo.
create unique index if not exists conta_pendente_aberta
  on conta_pendente (lower(rotulo), tipo)
  where status = 'pendente';

-- ---------- Rastro no plano de contas ----------
-- Quando a aprovação cria a conta, fica registrado quando e por quê.
alter table conta
  add column if not exists criada_em timestamptz,
  add column if not exists motivo text;
