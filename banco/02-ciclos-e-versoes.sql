-- =============================================================================
-- 02 — CICLOS E VERSÕES
-- =============================================================================
-- É o que permite comparar V1 contra revisão contra forecast, e o que impede
-- alguém de reescrever um número já aprovado.
--
-- Regra central: VERSÃO FECHADA É IMUTÁVEL. Não se edita o passado; cria-se
-- uma versão nova a partir dele. Sem isso, "orçado vs. realizado" não tem
-- contra o que comparar, porque o orçado teria mudado no meio do caminho.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS orcamento;
SET search_path TO orcamento, cadastro, public;

CREATE TABLE ciclo (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ano         smallint NOT NULL UNIQUE,
    nome        text NOT NULL,
    aberto_em   date,
    encerra_em  date
);

CREATE TABLE versao (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ciclo_id     bigint NOT NULL REFERENCES ciclo(id),
    codigo       text NOT NULL,
    nome         text NOT NULL,
    tipo         text NOT NULL CHECK (tipo IN ('budget', 'revisao', 'forecast')),
    -- rascunho: ainda nem abriu | aberta: aceita lançamento | fechada: congelada
    status       text NOT NULL DEFAULT 'rascunho'
                 CHECK (status IN ('rascunho', 'aberta', 'fechada')),
    -- de onde esta versão foi copiada (item 17 do roadmap)
    origem_id    bigint REFERENCES versao(id),
    aberta_em    timestamptz,
    fechada_em   timestamptz,
    fechada_por  bigint REFERENCES cadastro.pessoa(id),
    criada_em    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ciclo_id, codigo)
);

-- Só uma versão aberta por ciclo: duas abertas ao mesmo tempo significaria que
-- ninguém sabe em qual está lançando.
CREATE UNIQUE INDEX versao_uma_aberta_por_ciclo
    ON versao (ciclo_id) WHERE status = 'aberta';

-- ── A trava ──────────────────────────────────────────────────────────────────

-- Chamada pelos gatilhos de 03-lancamentos.sql antes de qualquer escrita.
-- Fica aqui, no banco, e não na aplicação, porque a aplicação esquece: foi
-- exatamente assim que três rotas de exclusão ficaram sem checagem no
-- protótipo anterior.
CREATE FUNCTION versao_aceita_escrita(p_versao_id bigint) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT status = 'aberta' FROM versao WHERE id = p_versao_id;
$$;

CREATE FUNCTION exige_versao_aberta() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_id bigint;
BEGIN
    v_id := COALESCE(NEW.versao_id, OLD.versao_id);
    IF NOT versao_aceita_escrita(v_id) THEN
        RAISE EXCEPTION
            'Versão % está fechada: lançamento não pode ser criado, alterado nem excluído.', v_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fechar uma versão é ato deliberado e registrado. Reabrir não é permitido:
-- se foi fechada por engano, cria-se uma revisão — assim a trilha mostra o que
-- aconteceu em vez de esconder.
CREATE FUNCTION versao_nao_reabre() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'fechada' AND NEW.status <> 'fechada' THEN
        RAISE EXCEPTION
            'Versão fechada não reabre. Crie uma revisão a partir dela.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER versao_sem_reabertura
    BEFORE UPDATE ON versao
    FOR EACH ROW EXECUTE FUNCTION versao_nao_reabre();

CREATE INDEX versao_ciclo ON versao (ciclo_id, status);
