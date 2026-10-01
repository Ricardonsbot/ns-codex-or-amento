-- Ferramenta Orcamentaria — origem "pacote" na importacao
--
-- Ate aqui `importacao.origem` so aceitava 'gestao'/'receita'/'despesa'/
-- 'capex' — toda tentativa de leitura feita pela tela de Template Pacote
-- (?modo=pacote) acabava gravada como 'gestao' por falta de opcao, o que
-- misturava o historico de Pacote com o de FP&A (mesmo arquivo, publicos e
-- fluxos diferentes: um vira lancamento, o outro vira target_pacote).
--
-- Dropa o check antigo por catalogo (nao pelo nome, que o Postgres gera
-- sozinho) e recria com 'pacote' incluido.

do $$
declare
  nome_constraint text;
begin
  select conname into nome_constraint
  from pg_constraint
  where conrelid = 'importacao'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%origem%'
  limit 1;

  if nome_constraint is not null then
    execute format('alter table importacao drop constraint %I', nome_constraint);
  end if;
end $$;

alter table importacao
  add constraint importacao_origem_check
  check (origem in ('gestao', 'receita', 'despesa', 'capex', 'pacote'));
