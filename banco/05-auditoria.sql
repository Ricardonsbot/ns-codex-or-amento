-- =============================================================================
-- 05 — AUDITORIA
-- =============================================================================
-- Item 3 do roadmap. Quem criou, editou, aprovou e excluiu cada número.
--
-- Duas decisões que valem mais que o resto do arquivo:
--
-- 1. Login e nome vão DESNORMALIZADOS. Se a trilha guardasse só pessoa_id,
--    apagar a pessoa transformaria o histórico dela numa coluna de números
--    órfãos — justamente o que uma auditoria não pode deixar acontecer.
--
-- 2. A tabela é APPEND-ONLY no próprio banco, por gatilho. Nem a aplicação nem
--    quem tiver acesso direto reescreve a história. Um log editável não serve
--    como prova.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auditoria;
SET search_path TO auditoria, orcamento, cadastro, public;

CREATE TABLE evento (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ocorrido_em   timestamptz NOT NULL DEFAULT now(),

    -- sem REFERENCES de propósito: precisa sobreviver à exclusão da pessoa
    pessoa_id     bigint,
    pessoa_login  text NOT NULL,
    pessoa_nome   text NOT NULL,
    perfil        text,

    acao          text NOT NULL CHECK (acao IN (
                      'criou', 'editou', 'excluiu', 'enviou', 'validou',
                      'aprovou', 'reprovou', 'devolveu', 'assumiu',
                      'abriu_versao', 'fechou_versao', 'importou',
                      'entrou', 'entrou_erro', 'saiu')),
    entidade      text NOT NULL,
    entidade_id   text,

    -- contexto para filtrar sem precisar de JOIN com dado que pode ter sumido
    versao_id     bigint,
    empresa_id    bigint,
    categoria     text,

    descricao     text,
    -- snapshot do que mudou: {"campo":"valor","de":100,"para":180}
    -- Em exclusão é o ÚNICO lugar onde o valor sobrevive — por isso é gravado
    -- ANTES do DELETE, nunca depois.
    detalhe       jsonb,
    ip            inet
);

-- ── Append-only ──────────────────────────────────────────────────────────────

CREATE FUNCTION evento_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'auditoria.evento é append-only: linha não pode ser % .', lower(TG_OP)
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER evento_sem_update
    BEFORE UPDATE ON evento
    FOR EACH ROW EXECUTE FUNCTION evento_imutavel();

CREATE TRIGGER evento_sem_delete
    BEFORE DELETE ON evento
    FOR EACH ROW EXECUTE FUNCTION evento_imutavel();

-- ── Registro automático ──────────────────────────────────────────────────────

-- A sessão informa quem está agindo logo após conectar:
--   SET LOCAL app.pessoa_id = '42';  SET LOCAL app.pessoa_login = 'ana.ribeiro';
-- Assim o gatilho grava a autoria sem a aplicação precisar lembrar de chamar
-- nada — que é onde esse tipo de registro costuma falhar.
CREATE FUNCTION registra_lancamento() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    r        record;
    v_acao   text;
    v_detalhe jsonb;
BEGIN
    r := COALESCE(NEW, OLD);
    v_acao := CASE TG_OP WHEN 'INSERT' THEN 'criou'
                         WHEN 'UPDATE' THEN 'editou'
                         ELSE 'excluiu' END;

    v_detalhe := CASE TG_OP
        WHEN 'UPDATE' THEN jsonb_build_object('de', to_jsonb(OLD), 'para', to_jsonb(NEW))
        WHEN 'DELETE' THEN jsonb_build_object('excluido', to_jsonb(OLD))
        ELSE to_jsonb(NEW) END;

    INSERT INTO auditoria.evento (
        pessoa_id, pessoa_login, pessoa_nome, perfil,
        acao, entidade, entidade_id, versao_id, empresa_id, categoria, detalhe)
    VALUES (
        NULLIF(current_setting('app.pessoa_id',    true), '')::bigint,
        COALESCE(NULLIF(current_setting('app.pessoa_login', true), ''), session_user),
        COALESCE(NULLIF(current_setting('app.pessoa_nome',  true), ''), '—'),
        NULLIF(current_setting('app.perfil',       true), ''),
        v_acao, 'lancamento', r.ref::text, r.versao_id, r.empresa_id, r.categoria,
        v_detalhe);

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- AFTER, não BEFORE: só registra o que realmente passou pelas travas.
CREATE TRIGGER lancamento_auditado
    AFTER INSERT OR UPDATE OR DELETE ON orcamento.lancamento
    FOR EACH ROW EXECUTE FUNCTION registra_lancamento();

CREATE INDEX evento_quando   ON evento (ocorrido_em DESC);
CREATE INDEX evento_pessoa   ON evento (pessoa_login);
CREATE INDEX evento_alvo     ON evento (entidade, entidade_id);
CREATE INDEX evento_versao   ON evento (versao_id, empresa_id);
CREATE INDEX evento_detalhe  ON evento USING gin (detalhe);
