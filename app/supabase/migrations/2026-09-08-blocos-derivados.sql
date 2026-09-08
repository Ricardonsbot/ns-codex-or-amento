-- Guarda os blocos que o Template Budget calcula a partir dos valores base, que
-- até agora eram lidos e descartados na importação.
--
-- Rode no SQL Editor do Supabase (Project → SQL Editor → New query → Run).
-- O banco é compartilhado — avise o time antes, conforme o COLABORACAO.md.
--
-- Nada aqui é obrigatório: a importação continua funcionando sem estas colunas
-- (ela detecta se existem antes de gravar) e as preenche assim que existirem.
-- Lançamento digitado à mão na grade não tem bloco derivado nenhum, e fica com
-- tudo nulo.

-- ---------- Por mês ----------
-- A aba Receita encadeia: base → proporção → reajustado → líquido. As abas de
-- Gastos e Capex têm um bloco só depois da competência, o de caixa.
alter table lancamento_valor_mensal
  -- "Proporção de Reajuste": digitada, e só usada quando Proporção manual? = Sim
  add column if not exists proporcao numeric(12, 6),
  -- "Valores Reajustados": base aplicando a taxa efetiva a partir do mês de reajuste
  add column if not exists valor_ajustado numeric(14, 2),
  -- "Receita Líquida": reajustado aplicando a alíquota da empresa × produto
  add column if not exists valor_liquido numeric(14, 2),
  -- "Gastos - Caixa" / "Capex - Caixa": o mesmo gasto no regime de caixa
  add column if not exists valor_caixa numeric(14, 2);

-- ---------- Por lançamento ----------
-- Valores únicos da linha, que não variam por mês.
alter table lancamento
  -- alíquota efetiva sobre receita, do "Mapa Aliquotas" (negativa)
  add column if not exists aliquota numeric(8, 6),
  -- taxa efetiva do reajuste = índice projetado × taxa de sucesso
  add column if not exists taxa_efetiva numeric(8, 6),
  -- a partir de quando o reajuste vale
  add column if not exists mes_reajuste date,
  -- qual índice foi usado (IGP-M, IPCA, INPC, Livre...)
  add column if not exists indice_reajuste text;
