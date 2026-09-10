-- Todas as colunas do Template Budget, de uma vez so.
--
-- Ate aqui cada campo novo do template virava uma migracao — area, blocos
-- derivados, pacote/subpacote — e o que nao tinha coluna era jogado dentro de
-- `obs` como texto ("Pacote: X | Produto: Y"), onde da para ler mas nao da
-- para somar nem filtrar.
--
-- Este arquivo cria de uma vez as colunas das tres abas (Receita, Base Gastos
-- e Capex), levantadas do proprio template com
-- scripts/listar-colunas-template.mjs.
--
-- A ultima coluna e a que responde ao "nao ter que rodar toda hora": `extras`
-- e um jsonb que recebe qualquer coluna do template que ainda nao tenha lugar
-- proprio, inclusive as que forem criadas depois. Coluna nova na planilha
-- passa a entrar sozinha, sem DDL nenhum. Quando uma delas virar dimensao de
-- relatorio, ai sim ganha coluna e indice — mas o dado ja estava guardado
-- desde a primeira importacao.
--
-- Rode no SQL Editor do Supabase (Project -> SQL Editor -> New query -> Run).
-- O banco e compartilhado — avise o time antes, conforme o COLABORACAO.md.
--
-- Substitui, e repete por inteiro, estas tres:
--   2026-09-08-blocos-derivados.sql
--   2026-09-09-area-do-pl.sql
--   2026-09-10-pacote-e-subpacote.sql
-- e traz junto a tabela de 2026-09-09-pendencia-de-cadastros.sql, de modo que
-- num banco novo rodar so este arquivo basta. Tudo com `if not exists`: rodar
-- de novo nao da erro e nao apaga nada.

-- ---------------------------------------------------------------------------
-- lancamento: as dimensoes da linha
-- ---------------------------------------------------------------------------
alter table lancamento
  -- Classificacao gerencial (Base Gastos e Capex)
  add column if not exists pacote                text,          -- "Pacote"
  add column if not exists subpacote             text,          -- "Subpacote"
  add column if not exists linha_pl_template     text,          -- "Linha P&L" da planilha
  add column if not exists linha_pl_ajustada     text,          -- "Linha P&L Ajustada"
  add column if not exists grupo_caixa           text,          -- "Grupo Caixa"
  add column if not exists area                  text,          -- "Alocacao PnL (Area)"
  add column if not exists area_ajustada         text,          -- "Alocacao PnL Ajustado (Area)"

  -- Estrutura organizacional como a planilha escreveu. As colunas *_id
  -- continuam sendo a verdade; estas guardam o texto de origem, que e o que
  -- permite conferir um casamento errado sem voltar ao arquivo.
  add column if not exists empresa_texto         text,          -- "Empresa"
  add column if not exists torre_texto           text,          -- "Torre"
  add column if not exists diretoria             text,          -- "Diretoria"
  add column if not exists centro_custo_nome     text,          -- "Nome Centro de Custo"

  -- Produto e cliente
  add column if not exists tipo_receita          text,          -- "Tipo Receita"
  add column if not exists conta_contabil_texto  text,          -- "Conta Contabil" (Receita)
  add column if not exists produto_sintetico     text,          -- "Produto Sintetico"
  add column if not exists produto_analitico     text,          -- "Produto Analitico"
  add column if not exists sku                   text,          -- "Sku"
  add column if not exists cliente               text,          -- "Razao Social Cliente"
  add column if not exists cnpj                  text,          -- "CNPJ"
  add column if not exists persona               text,          -- "Persona"
  add column if not exists segmento_sintetico    text,          -- "Segmento Sintetico"
  add column if not exists segmento_analitico    text,          -- "Segmento Analitico"
  add column if not exists classe_cliente        text,          -- "Classe de Clientes"
  add column if not exists intercompany          text,          -- "Flag intercompany"
  add column if not exists mrr                   text,          -- "MRR"
  add column if not exists canetada              text,          -- "Canetada?"
  add column if not exists pmr                   text,          -- "PMR"
  add column if not exists termometro            text,          -- "Termometro de Vendas"
  add column if not exists projeto               text,          -- "Projeto"

  -- Detalhe da despesa
  add column if not exists auxiliar_conta        text,          -- "Auxiliar Conta"
  add column if not exists subconta              text,          -- "SubConta Tecnologia / Terceiros"
  add column if not exists detalhamento          text,          -- "Detalhamento"

  -- Capex tem quantidade e valor unitario, que as outras abas nao tem
  add column if not exists item                  text,          -- "Item"
  add column if not exists quantidade            numeric(14,4), -- "Quant."
  add column if not exists valor_unitario        numeric(14,2), -- "(-)Valor Unitario"

  -- Reajuste da receita
  add column if not exists aliquota              numeric(8,6),  -- bloco "Aliquotas" (negativa)
  add column if not exists taxa_efetiva          numeric(8,6),  -- "Taxa Efetiva"
  add column if not exists taxa_sucesso          numeric(8,6),  -- "% Taxa de Sucesso"
  add column if not exists mes_reajuste          date,          -- "Mes Reajuste"
  add column if not exists indice_reajuste       text,          -- "Indice Projetado"
  add column if not exists proporcao_manual      text,          -- "Proporcao manual?"

  -- O curinga: coluna do template sem lugar proprio, e as que vierem depois.
  add column if not exists extras                jsonb;

-- ---------------------------------------------------------------------------
-- lancamento_valor_mensal: um campo por bloco de meses do template
-- ---------------------------------------------------------------------------
-- Receita      Valores Base | Proporcao de Reajuste | Valores Reajustados | Reajuste
-- Base Gastos  Gastos - Competencia | Gastos - Caixa
-- Capex        Capex - Competencia | Capex - Caixa
--
-- `valor` continua sendo o bloco de competencia, que e o que entra no P&L.
alter table lancamento_valor_mensal
  add column if not exists proporcao      numeric(12,6), -- "Proporcao de Reajuste"
  add column if not exists valor_ajustado numeric(14,2), -- "Valores Reajustados"
  add column if not exists valor_reajuste numeric(14,2), -- "Reajuste"
  add column if not exists valor_liquido  numeric(14,2), -- "Receita Liquida"
  add column if not exists valor_caixa    numeric(14,2); -- "Gastos/Capex - Caixa"

-- ---------------------------------------------------------------------------
-- Pendencia de cadastros (identica a 2026-09-09-pendencia-de-cadastros.sql)
-- ---------------------------------------------------------------------------
-- As contas que a importacao encontrou na planilha e que nao existem no plano.
create table if not exists conta_pendente (
  id uuid primary key default gen_random_uuid(),

  -- o que a planilha trazia na coluna "Conta Contabil"
  rotulo text not null,
  -- onde apareceu: empresas e quantas linhas, para quem aprova ter contexto
  descricao text,
  -- por que esta sendo pedida
  motivo text,

  tipo text not null check (tipo in ('receita', 'despesa', 'capex')),
  origem text,                       -- nome do arquivo que originou o pedido
  linhas integer not null default 0, -- quantas linhas do template usavam o rotulo
  valor numeric(14, 2),              -- quanto de orcamento depende dela

  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'reprovada')),

  solicitado_em timestamptz not null default now(),
  solicitado_por text,
  decidido_em timestamptz,
  decidido_por text,
  observacao_decisao text,

  -- preenchido quando aprovada: a conta que passou a existir
  conta_id uuid references conta(id) on delete set null
);

create unique index if not exists conta_pendente_aberta
  on conta_pendente (lower(rotulo), tipo)
  where status = 'pendente';

alter table conta
  add column if not exists criada_em timestamptz,
  add column if not exists motivo text;

-- ---------------------------------------------------------------------------
-- Indices: so nas dimensoes que o Resultado agrupa ou filtra
-- ---------------------------------------------------------------------------
-- Por versao junto, porque nenhum relatorio cruza versoes.
create index if not exists lancamento_pacote_idx    on lancamento (versao_id, pacote);
create index if not exists lancamento_subpacote_idx on lancamento (versao_id, subpacote);
create index if not exists lancamento_area_idx      on lancamento (versao_id, area);
create index if not exists lancamento_diretoria_idx on lancamento (versao_id, diretoria);
create index if not exists lancamento_produto_idx   on lancamento (versao_id, produto_sintetico);
create index if not exists lancamento_cliente_idx   on lancamento (versao_id, cliente);

-- O que veio de 2026-09-09-area-do-pl.sql; o de cima e por versao, este e geral.
create index if not exists lancamento_area on lancamento (area) where area is not null;

-- Busca dentro do curinga sem precisar de um indice por chave.
create index if not exists lancamento_extras_idx on lancamento using gin (extras);
