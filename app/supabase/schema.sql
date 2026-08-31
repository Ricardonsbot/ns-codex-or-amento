-- Schema inicial do NS Budget — cole isso no SQL Editor do Supabase (Project → SQL Editor → New query)
-- e clique em "Run". Isso cria as tabelas base para estrutura organizacional, plano de
-- contas, ciclos/versões, lançamentos e índices de reajuste.
--
-- IMPORTANTE: por padrão o Row Level Security (RLS) está DESLIGADO abaixo, ou seja,
-- qualquer pessoa com a chave "anon" consegue ler/escrever essas tabelas. Isso é
-- aceitável enquanto só você estiver testando, mas ANTES de ter mais de um usuário
-- real (ou dados sensíveis), é preciso habilitar RLS e criar políticas de acesso
-- (ligadas ao Supabase Auth). Fica marcado como próximo passo.

create extension if not exists "pgcrypto";

-- ---------- Estrutura organizacional: BU → Torre → Sub Torre → Empresa ----------

create table bu (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  codigo text,
  criado_em timestamptz not null default now()
);

create table torre (
  id uuid primary key default gen_random_uuid(),
  bu_id uuid not null references bu(id) on delete cascade,
  nome text not null,
  codigo text,
  criado_em timestamptz not null default now()
);

create table sub_torre (
  id uuid primary key default gen_random_uuid(),
  torre_id uuid not null references torre(id) on delete cascade,
  nome text not null,
  codigo text,
  criado_em timestamptz not null default now()
);

create table empresa (
  id uuid primary key default gen_random_uuid(),
  bu_id uuid not null references bu(id) on delete cascade,
  torre_id uuid references torre(id) on delete set null,
  sub_torre_id uuid references sub_torre(id) on delete set null,
  nome text not null,
  codigo text,
  criado_em timestamptz not null default now()
);

-- ---------- Plano de contas ----------

create table conta (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  linha_pl text,
  categoria text
);

-- ---------- Ciclos e versões de orçamento ----------

create table ciclo (
  id uuid primary key default gen_random_uuid(),
  ano int not null unique,
  status text not null default 'em_elaboracao' check (status in ('em_elaboracao', 'ativo', 'encerrado'))
);

create table versao (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclo(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('original', 'revisao')),
  baseada_em_id uuid references versao(id),
  status text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'encerrada', 'reprovada')),
  criada_em timestamptz not null default now()
);

-- ---------- Lançamentos (Receita, Despesa ou Capex) ----------

create table lancamento (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references versao(id) on delete cascade,
  tipo text not null check (tipo in ('receita', 'despesa', 'capex')),
  bu_id uuid not null references bu(id),
  torre_id uuid references torre(id),
  sub_torre_id uuid references sub_torre(id),
  empresa_id uuid references empresa(id),
  conta_id uuid references conta(id),
  fornecedor text,
  descricao text,
  centro_de_custo text,
  obs text,
  criado_em timestamptz not null default now()
);

create table lancamento_valor_mensal (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references lancamento(id) on delete cascade,
  mes int not null check (mes between 1 and 12),
  valor numeric(14, 2) not null default 0,
  unique (lancamento_id, mes)
);

-- ---------- Índices de reajuste (IGP-M, INPC, IPCA...) ----------

create table indice (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  aplicacao text not null check (aplicacao in ('receita', 'despesa', 'ambos')),
  ano int not null,
  status text not null default 'ativo' check (status in ('ativo', 'rascunho'))
);

create table indice_valor_mensal (
  id uuid primary key default gen_random_uuid(),
  indice_id uuid not null references indice(id) on delete cascade,
  mes int not null check (mes between 1 and 12),
  percentual numeric(6, 3) not null default 0,
  unique (indice_id, mes)
);

-- ---------- Cadastros simples (sem tabela real ainda no domínio original;
-- criadas para dar suporte às demais categorias do hub de Cadastros) ----------

create table usuario (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  papel text not null default 'Analista' check (papel in ('Admin', 'Aprovador', 'Analista')),
  ativo boolean not null default true
);

create table centro_de_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null
);

create table diretoria (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  responsavel text
);

create table operacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text
);

create table produto (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  categoria text
);

create table cliente (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  contato text
);

create table fornecedor (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  contato text
);

create table layout (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text,
  descricao text
);
