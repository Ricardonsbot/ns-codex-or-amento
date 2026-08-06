-- =============================================================================
-- 04 — FLUXO: ENTREGAS, APROVAÇÃO E ACEITE
-- =============================================================================
-- É a tese da ferramenta: poder cobrar nominalmente quem é dono do número.
-- Sem estas tabelas o sistema vira uma planilha bonita.
--
-- Uma ENTREGA é uma empresa × uma categoria dentro de uma versão. É a unidade
-- que se cobra ("a Bsoft ainda não mandou a despesa"), e é ela que vai para
-- aprovação — não o lançamento individual.
-- =============================================================================

SET search_path TO orcamento, cadastro, public;

CREATE TABLE entrega (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    versao_id      bigint NOT NULL REFERENCES versao(id),
    empresa_id     bigint NOT NULL REFERENCES cadastro.empresa(id),
    categoria      text NOT NULL CHECK (categoria IN ('receita', 'despesa', 'capex')),
    responsavel_id bigint NOT NULL REFERENCES cadastro.pessoa(id),
    prazo          date NOT NULL,
    status         text NOT NULL DEFAULT 'nao-iniciado'
                   CHECK (status IN ('nao-iniciado', 'rascunho', 'enviado',
                                     'aprovado', 'reprovado', 'devolvido')),
    enviado_em     timestamptz,
    UNIQUE (versao_id, empresa_id, categoria)
);

-- Atrasada é derivado, não guardado: prazo vencido e ainda não concluída.
-- Guardar um booleano aqui seria criar um dado que envelhece sozinho.
CREATE VIEW vw_entrega_atrasada AS
SELECT e.*, (e.prazo < current_date
             AND e.status NOT IN ('aprovado')) AS atrasada
  FROM entrega e;

-- ── Aprovação ────────────────────────────────────────────────────────────────

CREATE TABLE submissao (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entrega_id     bigint NOT NULL REFERENCES entrega(id),
    enviada_em     timestamptz NOT NULL DEFAULT now(),
    enviada_por    bigint NOT NULL REFERENCES cadastro.pessoa(id),
    valor_total    numeric(18,2) NOT NULL,
    status_oficial text NOT NULL DEFAULT 'pendente'
                   CHECK (status_oficial IN ('pendente', 'aprovado', 'reprovado', 'devolvido')),
    decidida_em    timestamptz,
    decidida_por   bigint REFERENCES cadastro.pessoa(id),
    parecer        text,
    -- decisão exige quem e quando; e reprovar sem dizer por quê não passa
    CONSTRAINT decisao_completa CHECK (
        (status_oficial = 'pendente' AND decidida_em IS NULL)
        OR (status_oficial <> 'pendente' AND decidida_em IS NOT NULL
            AND decidida_por IS NOT NULL)
    ),
    CONSTRAINT recusa_exige_motivo CHECK (
        status_oficial NOT IN ('reprovado', 'devolvido')
        OR (parecer IS NOT NULL AND length(btrim(parecer)) > 0)
    )
);

-- ── As 6 regras de consistência ──────────────────────────────────────────────

CREATE TABLE regra (
    codigo      text PRIMARY KEY,
    nome        text NOT NULL,
    descricao   text NOT NULL,
    severidade  text NOT NULL CHECK (severidade IN ('bloqueia', 'alerta')),
    ativa       boolean NOT NULL DEFAULT true
);

INSERT INTO regra (codigo, nome, descricao, severidade) VALUES
 ('CC',  'Centro de custo preenchido',   'Toda conta precisa de centro de custo para consolidar por Torre.', 'bloqueia'),
 ('PL',  'Conta mapeada na linha do P&L','Conta sem linha de P&L não entra no consolidado.',                 'bloqueia'),
 ('PAC', 'Pacote informado',             'Sem pacote não dá para separar o gasto por motivo.',               'bloqueia'),
 ('DUP', 'Sem conta duplicada',          'Mesma conta repetida no mesmo centro de custo.',                   'bloqueia'),
 ('MES', '12 meses preenchidos',         'Mês zerado costuma ser esquecimento, não previsão.',               'alerta'),
 ('VAR', 'Variação vs ano anterior até 30%', 'Salto grande sem justificativa na Obs.',                       'alerta');

CREATE TABLE submissao_validacao (
    submissao_id  bigint NOT NULL REFERENCES submissao(id) ON DELETE CASCADE,
    regra_codigo  text NOT NULL REFERENCES regra(codigo),
    resultado     text NOT NULL CHECK (resultado IN ('ok', 'falhou')),
    detalhe       text,
    PRIMARY KEY (submissao_id, regra_codigo)
);

-- Uma submissão com regra 'bloqueia' falhando não pode ser aprovada.
CREATE FUNCTION nao_aprova_com_bloqueio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status_oficial = 'aprovado' AND EXISTS (
        SELECT 1 FROM submissao_validacao sv
          JOIN regra r ON r.codigo = sv.regra_codigo
         WHERE sv.submissao_id = NEW.id
           AND sv.resultado = 'falhou' AND r.severidade = 'bloqueia' AND r.ativa
    ) THEN
        RAISE EXCEPTION 'Submissão % tem validação bloqueante pendente e não pode ser aprovada.', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER submissao_sem_bloqueio
    BEFORE UPDATE ON submissao
    FOR EACH ROW EXECUTE FUNCTION nao_aprova_com_bloqueio();

-- ── Aceite final do líder ────────────────────────────────────────────────────

-- Separado da aprovação de propósito. O aprovador confere; o líder ASSUME.
-- É manual e nominal — é o que cria a carga de responsabilidade.
CREATE TABLE aceite_final (
    submissao_id  bigint PRIMARY KEY REFERENCES submissao(id) ON DELETE CASCADE,
    lider_id      bigint NOT NULL REFERENCES cadastro.pessoa(id),
    cargo         text NOT NULL,
    declaracao    text NOT NULL,
    observacao    text,
    aceito_em     timestamptz NOT NULL DEFAULT now()
);

-- Só se assume o que já foi aprovado.
CREATE FUNCTION aceite_exige_aprovacao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT status_oficial FROM submissao WHERE id = NEW.submissao_id) <> 'aprovado' THEN
        RAISE EXCEPTION 'Aceite final só vale sobre submissão aprovada.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER aceite_apos_aprovacao
    BEFORE INSERT ON aceite_final
    FOR EACH ROW EXECUTE FUNCTION aceite_exige_aprovacao();

CREATE INDEX entrega_versao     ON entrega (versao_id, status);
CREATE INDEX entrega_responsavel ON entrega (responsavel_id);
CREATE INDEX submissao_entrega  ON submissao (entrega_id, status_oficial);
