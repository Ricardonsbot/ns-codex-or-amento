-- Área do centro de custo, vinda do mapa do Template Budget (aba "Mapa Centros
-- de Custo"): FLGS, CRO, People, Tecnologia, Presidência/Conselho...
--
-- Rode no SQL Editor do Supabase (Project → SQL Editor → New query → Run).
-- O banco é compartilhado — avise o time antes, conforme o COLABORACAO.md.
--
-- Nullable de propósito: centro de custo cadastrado à mão, fora do mapa, pode
-- não ter área.

alter table centro_de_custo add column if not exists area text;
