-- ============================================================================
-- Notes — bloco de notas do time, por seção (Dev, e as que vierem depois)
--
-- O QUE FAZ
--   Cria a tabela `nota`: um item de "bloco de notas" por linha, agrupado por
--   `secao` (hoje só "Dev" — pendências técnicas antes do deploy oficial).
--   Pensada para crescer: uma seção nova é só um valor novo em `secao`, sem
--   SQL adicional.
--
-- O QUE NAO FAZ
--   Nao mexe em nenhuma tabela existente. `if not exists` em tudo: rodar
--   duas vezes nao da erro.
--
-- SEGURANCA
--   Liga RLS e so libera para usuario logado (role `authenticated`), como as
--   demais tabelas criadas depois de 2026-09-22 — a chave anon vai no bundle
--   do navegador.
--
-- COMO RODAR
--   Supabase -> Project -> SQL Editor -> New query -> colar tudo -> Run.
--   O banco e compartilhado: avise o time antes, conforme o COLABORACAO.md.
--   Enquanto nao rodar, a tela de Notes mostra o aviso de que falta este SQL.
-- ============================================================================

create table if not exists nota (
  id            uuid primary key default gen_random_uuid(),
  secao         text not null,              -- "Dev", e as que vierem depois
  texto         text not null,
  feita         boolean not null default false,
  criado_em     timestamptz not null default now(),
  criado_por    text,                       -- e-mail de quem anotou
  concluido_em  timestamptz,
  concluido_por text
);

create index if not exists nota_secao_idx on nota (secao, criado_em);

alter table nota enable row level security;

drop policy if exists nota_tudo on nota;
create policy nota_tudo on nota for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Semente: os pendentes que já sabemos hoje, para a seção não nascer vazia.
-- Só insere se a tabela ainda não tiver nada — rodar de novo não duplica.
-- ---------------------------------------------------------------------------
insert into nota (secao, texto)
select 'Dev', texto from (values
  ('Card "Exportar" do Dashboard ainda é simulado (só mostra um toast) — decidir se remove ou liga numa exportação real'),
  ('Botão "Entrar com conta Microsoft" no login não faz nada — decidir se implementa o SSO ou remove o botão'),
  ('RLS desligado nas tabelas de antes de 2026-09-22 (todo o dado de orçamento) — revisar antes de abrir a ferramenta para mais gente além do time atual'),
  ('Primeiro deploy real no cluster Kubernetes — os manifests já existem em app/k8s/, mas nunca rodamos o kubectl apply de verdade')
) as sementes(texto)
where not exists (select 1 from nota where secao = 'Dev');
