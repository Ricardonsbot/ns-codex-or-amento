-- Ferramenta Orcamentaria — origem do usuario (local ou sincronizado)
-- ============================================================================
--
-- O QUE FAZ
--   Adiciona `usuario.origem`, 'Local' ou 'Sincronizado' — quem entra com
--   conta criada so pra uso interno/teste (como a de dev) e quem entra pela
--   conta corporativa. Aparece como coluna na tela Cadastros -> Usuarios.
--
--   Tambem cadastra (ou atualiza, se ja existir pelo e-mail) o usuario de
--   dev que ate aqui so existia como login padrao da tela — a partir de
--   agora o login nao vem mais preenchido, e o acesso de quem usa essa
--   conta passa por aqui, como qualquer outro usuario.
--
-- O QUE NAO FAZ
--   `origem` e so informativo: o login em si continua pelo e-mail e senha
--   cadastrados no Supabase Auth, local ou sincronizado — esta coluna nao
--   muda nenhuma regra de autenticacao.
--   `if not exists` / `on conflict`: rodar duas vezes nao da erro nem
--   duplica o usuario de dev.
--
-- COMO RODAR
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
-- ============================================================================

alter table usuario
  add column if not exists origem text not null default 'Sincronizado'
    check (origem in ('Local', 'Sincronizado'));

insert into usuario (nome, email, papel, origem)
values ('Dev', 'dev@nstech.com.br', 'Admin', 'Local')
on conflict (email) do update set origem = 'Local';
