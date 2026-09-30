-- Ferramenta Orcamentaria — log de erros
-- ============================================================================
--
-- O QUE FAZ
--   Cria a tabela `log_erro`: toda vez que a tela mostra um toast de erro
--   (showToast(msg, 'error')), o texto inteiro fica gravado aqui tambem, com
--   quem estava logado e em qual tela. E o historico que o icone de log de
--   erros (canto da barra lateral) le — serve pra copiar o erro completo e
--   colar numa IA depois, sem precisar reproduzir o problema de novo.
--
-- O QUE NAO FAZ
--   Nao substitui o toast (que continua avisando na hora); so guarda o
--   historico. Nao apaga nada sozinho — quem limpa e uma pessoa, manualmente.
--   `if not exists` em tudo: rodar duas vezes nao da erro.
--
-- SEGURANCA
--   RLS ligado, só para usuario logado (role `authenticated`) ler e inserir.
--
-- COMO RODAR
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
-- ============================================================================

create table if not exists log_erro (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  mensagem      text not null,       -- o texto do toast de erro, na integra
  contexto      text,                -- a rota (pathname) de onde veio
  usuario_email text
);

create index if not exists log_erro_criado_em_idx on log_erro (criado_em desc);

alter table log_erro enable row level security;

drop policy if exists log_erro_ler on log_erro;
create policy log_erro_ler on log_erro
  for select to authenticated using (true);

drop policy if exists log_erro_criar on log_erro;
create policy log_erro_criar on log_erro
  for insert to authenticated with check (true);
