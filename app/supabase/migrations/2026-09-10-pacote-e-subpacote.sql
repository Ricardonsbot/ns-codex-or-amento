-- Pacote e subpacote como coluna, no lugar de texto solto.
--
-- O template sempre trouxe as duas colunas, mas a importacao guardava PACOTE
-- dentro de `obs` ("Pacote: X | Produto: Y") e SUBPACOTE colado em `descricao`
-- ("Folha · Beneficios"). Assim da para ler, mas nao da para somar: o P&L
-- aberto por pacote e subpacote precisa das duas como dimensao.
--
-- `add column if not exists` para poder rodar de novo sem erro. O codigo sonda
-- as colunas antes de usar, entao enquanto isto nao rodar a tela continua
-- funcionando — so a visao de pacote fica sem a abertura em subpacote.

alter table lancamento add column if not exists pacote text;
alter table lancamento add column if not exists subpacote text;

create index if not exists lancamento_pacote_idx on lancamento (versao_id, pacote);
create index if not exists lancamento_subpacote_idx on lancamento (versao_id, subpacote);
