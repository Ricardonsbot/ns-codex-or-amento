-- Ferramenta Orcamentaria — nome do template escolhido no upload
-- ============================================================================
--
-- O QUE FAZ
--   Adiciona `importacao.nome_template`: o nome que a pessoa deu ao template
--   na etapa de destino (antes de liberar o campo de arquivo), junto com o
--   ciclo e a versao que ja eram escolhidos ali. E so identificacao — nao
--   muda nenhuma regra de gravacao nem de liberacao.
--
-- O QUE NAO FAZ
--   Nao mexe em registro existente: linha antiga fica com nome_template nulo.
--   `if not exists`: rodar duas vezes nao da erro.
--
-- COMO RODAR
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
-- ============================================================================

alter table importacao add column if not exists nome_template text;
