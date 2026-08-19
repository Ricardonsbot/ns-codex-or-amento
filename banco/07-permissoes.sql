-- =============================================================================
-- 07 — PERMISSÕES (Row Level Security)
-- =============================================================================
-- O motivo principal para escolher Postgres.
--
-- Na versão Flask deste mesmo domínio, a regra "só mexe na própria empresa"
-- morava nas rotas. Três rotas de exclusão esqueceram dela, e qualquer usuário
-- logado apagava lançamento de qualquer empresa com um POST montado à mão.
-- Isso não é descuido de quem escreveu: é o resultado inevitável de repetir a
-- mesma checagem em N lugares.
--
-- Com RLS a regra fica em UM lugar, no banco, e vale para toda consulta: da
-- aplicação, do relatório, do psql aberto na madrugada. Esquecer não é uma
-- opção disponível.
--
-- A sessão declara quem está agindo logo após conectar:
--   SET LOCAL app.pessoa_id = '42';
--   SET LOCAL app.perfil    = 'operacional';
-- =============================================================================

SET search_path TO orcamento, cadastro, public;

-- ── Papéis ───────────────────────────────────────────────────────────────────

-- Papel é objeto do CLUSTER, não do banco: sobrevive ao dropdb. Sem esta guarda,
-- recriar o banco e reaplicar o schema estoura aqui com "role já existe" — e como
-- este arquivo é o gate de deploy (infra/scripts/aplicar-schema.sh), o gate
-- passaria a falhar por um motivo que não tem nada a ver com o deploy.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_leitura') THEN
        CREATE ROLE app_leitura;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_escrita') THEN
        CREATE ROLE app_escrita;
    END IF;
END $$;

GRANT USAGE ON SCHEMA cadastro, orcamento, auditoria, realizado TO app_leitura, app_escrita;
GRANT SELECT ON ALL TABLES IN SCHEMA cadastro, orcamento, realizado TO app_leitura, app_escrita;
GRANT SELECT ON auditoria.evento TO app_leitura, app_escrita;
GRANT INSERT, UPDATE, DELETE ON orcamento.lancamento, orcamento.lancamento_mes,
      orcamento.entrega, orcamento.submissao, orcamento.submissao_validacao,
      orcamento.aceite_final TO app_escrita;
GRANT INSERT ON auditoria.evento TO app_escrita;

-- Ninguém, em papel nenhum, altera ou apaga a trilha. Os gatilhos de 05 já
-- barram; retirar o privilégio é a segunda tranca.
REVOKE UPDATE, DELETE ON auditoria.evento FROM app_leitura, app_escrita;

-- ── Funções de contexto ──────────────────────────────────────────────────────

-- ⚠ TODA função deste schema fixa o próprio search_path, e isto NÃO é enfeite.
-- O corpo de uma função SQL/plpgsql é resolvido na EXECUÇÃO, com o search_path
-- de quem chamou. Como as funções nasceram no schema orcamento e as políticas
-- as chamam sem qualificar, uma sessão com search_path padrão — que é o caso da
-- credencial da aplicação — falhava com "função app_perfil() não existe" em TODA
-- leitura de lançamento. Com superusuário e search_path ajustado (como nos
-- testes da Fase 0) o defeito não aparece: ele estava reservado para a produção.
-- Fixar aqui também fecha a porta de alguém trocar o search_path para plantar
-- uma função homônima na frente desta.

CREATE FUNCTION app_pessoa_id() RETURNS bigint
LANGUAGE sql STABLE
SET search_path = orcamento, cadastro, auditoria, realizado, public, pg_temp
AS $$
    SELECT NULLIF(current_setting('app.pessoa_id', true), '')::bigint;
$$;

CREATE FUNCTION app_perfil() RETURNS text
LANGUAGE sql STABLE
SET search_path = orcamento, cadastro, auditoria, realizado, public, pg_temp
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.perfil', true), ''), 'nenhum');
$$;

-- Empresas que a sessão pode enxergar. Admin e aprovador veem tudo; os demais
-- veem só o que está em pessoa_empresa.
CREATE FUNCTION app_empresas_visiveis() RETURNS SETOF bigint
LANGUAGE sql STABLE
SET search_path = orcamento, cadastro, auditoria, realizado, public, pg_temp
AS $$
    SELECT e.id FROM cadastro.empresa e
     WHERE app_perfil() IN ('admin', 'aprovador')
    UNION
    SELECT pe.empresa_id FROM cadastro.pessoa_empresa pe
     WHERE pe.pessoa_id = app_pessoa_id();
$$;

-- ── Políticas ────────────────────────────────────────────────────────────────

ALTER TABLE lancamento     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamento_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega        ENABLE ROW LEVEL SECURITY;

-- Ler: só as empresas visíveis.
CREATE POLICY lancamento_le ON lancamento
    FOR SELECT USING (empresa_id IN (SELECT app_empresas_visiveis()));

-- Escrever: a empresa precisa ser visível E a versão precisa estar aberta.
-- USING vale para a linha que já existe; WITH CHECK, para o valor novo — sem
-- os dois, dá para "mover" um lançamento para fora do próprio escopo.
CREATE POLICY lancamento_escreve ON lancamento
    FOR ALL
    USING      (empresa_id IN (SELECT app_empresas_visiveis()))
    WITH CHECK (empresa_id IN (SELECT app_empresas_visiveis())
                AND versao_aceita_escrita(versao_id));

-- A tabela filha herda o escopo do pai. Sem esta política a porta dos fundos
-- continuaria aberta: bastaria alterar o valor mensal direto.
CREATE POLICY lancamento_mes_segue_o_pai ON lancamento_mes
    FOR ALL
    USING (EXISTS (SELECT 1 FROM lancamento l
                    WHERE l.id = lancamento_mes.lancamento_id
                      AND l.empresa_id IN (SELECT app_empresas_visiveis())))
    WITH CHECK (EXISTS (SELECT 1 FROM lancamento l
                    WHERE l.id = lancamento_mes.lancamento_id
                      AND l.empresa_id IN (SELECT app_empresas_visiveis())));

CREATE POLICY entrega_le ON entrega
    FOR SELECT USING (empresa_id IN (SELECT app_empresas_visiveis()));

-- Quem abre a entrega é o admin, no começo do ciclo — o responsável recebe uma
-- entrega, não cria a sua. Sem esta política a tabela ficava intransitável:
-- com RLS ligada, o que nenhuma política permite é proibido, então o GRANT
-- INSERT lá de cima não produzia efeito nenhum e ninguém criava entrega.
CREATE POLICY entrega_cria ON entrega
    FOR INSERT
    WITH CHECK (app_perfil() = 'admin');

-- Só o aprovador decide; o responsável mexe no que é dele.
CREATE POLICY entrega_escreve ON entrega
    FOR UPDATE
    USING (app_perfil() IN ('admin', 'aprovador')
           OR responsavel_id = app_pessoa_id());

-- =============================================================================
-- COMO CONFERIR QUE ESTÁ VALENDO
-- =============================================================================
-- Rode como um operacional de uma empresa e tente alcançar outra. O correto é
-- devolver zero linha e recusar a escrita — não "dar erro de permissão", mas
-- simplesmente não enxergar.
--
--   SET ROLE app_escrita;
--   SET LOCAL app.pessoa_id = '42';
--   SET LOCAL app.perfil    = 'operacional';
--
--   SELECT count(*) FROM orcamento.lancamento;              -- só as dele
--   DELETE FROM orcamento.lancamento WHERE empresa_id = 99; -- 0 linhas
--
-- Este é o teste que o Flask não passaria.
-- =============================================================================
