-- De-para do centro de custo: de que empresa ele é e de que diretoria.
--
-- Vem da aba "Mapa CentroCusto" do Template Budget, que já é lida há tempos
-- (lerCadastrosTemplate.js) — só não tinha onde ser gravada. Até aqui o
-- cadastro guardava código e nome, que é uma LISTA de centros de custo; o
-- de-para em si, que é a amarração com empresa e diretoria, era lido do
-- arquivo e jogado fora na hora de gravar.
--
-- Rode no SQL Editor do Supabase (Project → SQL Editor → New query → Run).
-- O banco é compartilhado — avise o time antes, conforme o COLABORACAO.md.
--
-- Texto e nullable de propósito, nos dois casos:
--
--   empresa    o mapa escreve o nome como a Base Gastos escreve ("Empresa
--              Template BGT"), e nem todo nome de lá existe em `empresa` —
--              uma FK recusaria a carga inteira por causa das sobras.
--   diretoria  o mapa escreve "NA" onde não se aplica, e a leitura já
--              transforma isso em vazio. Centro de custo cadastrado à mão,
--              fora do mapa, também pode não ter.
--
-- `area` não entra aqui: ela já tem a sua, em 2026-09-01-centro-de-custo-
-- -area.sql, e vem de outra aba ("Mapa Centros de Custo", no plural, que é
-- um pivô de uma área por coluna).

alter table centro_de_custo add column if not exists empresa text;
alter table centro_de_custo add column if not exists diretoria text;

-- Para achar rápido todo centro de custo de uma empresa, que é como as telas
-- vão perguntar.
create index if not exists centro_de_custo_empresa_idx on centro_de_custo (empresa);
