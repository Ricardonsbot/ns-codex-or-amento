-- A área de alocação no P&L — COGS, G&A, S&M, R&D, Bad Debts Provision,
-- Others Income and Expense, Capex — que o Template Budget traz na coluna
-- "Alocação PnL (Área)" das abas de Gastos e Capex.
--
-- Rode no SQL Editor do Supabase (Project → SQL Editor → New query → Run).
-- O banco é compartilhado — avise o time antes, conforme o COLABORACAO.md.
--
-- É a segunda dimensão do P&L, e não se confunde com a linha do plano de
-- contas: a mesma conta de Pessoal pode ser COGS numa empresa e G&A em outra.
-- Até aqui ela vinha como texto solto nas observações e não dava para somar.
--
-- Nullable: receita não tem área no template, e lançamento digitado à mão pode
-- não ter. A importação detecta se a coluna existe antes de gravar.

alter table lancamento add column if not exists area text;

create index if not exists lancamento_area on lancamento (area) where area is not null;
