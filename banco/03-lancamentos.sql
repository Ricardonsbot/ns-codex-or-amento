-- =============================================================================
-- 03 — LANÇAMENTOS
-- =============================================================================
-- O coração. Duas tabelas:
--
--   lancamento      uma linha da grade: quem, onde, por qual motivo
--   lancamento_mes  uma linha POR MÊS, com o valor
--
-- Por que não guardar jan..dez como doze colunas, que é o que parece com a
-- planilha: com doze colunas não dá para filtrar por período sem escrever doze
-- condições, somar um trimestre vira soma manual, e incluir 2027 vira alteração
-- de estrutura. Com uma linha por mês, tudo isso é WHERE e GROUP BY.
--
-- UNIDADE: valores em REAIS, com centavos. A tela mostra em R$ mil, mas quem
-- converte é a tela. Guardar "em mil" no banco é como se perde 40 mil reais
-- numa conta de arredondamento seis meses depois.
-- =============================================================================

SET search_path TO orcamento, cadastro, public;

CREATE TABLE lancamento (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Chave estável para o ida-e-volta com Excel. A pessoa exporta 800 linhas,
    -- edita 3, sobe de volta: é por esta coluna que se sabe o que atualizar em
    -- vez de duplicar. Nunca reaproveitar nem regerar.
    ref          uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    versao_id    bigint NOT NULL REFERENCES versao(id),
    empresa_id   bigint NOT NULL REFERENCES cadastro.empresa(id),
    categoria    text NOT NULL CHECK (categoria IN ('receita', 'despesa', 'capex')),

    -- Despesa e Capex
    conta_id           bigint REFERENCES cadastro.conta(id),
    centro_custo_id    bigint REFERENCES cadastro.centro_custo(id),
    pacote_id          bigint REFERENCES cadastro.pacote(id),
    fornecedor         text,
    -- Ativação (CPC 27 / CPC 04): quanto do gasto sai de Opex e vira Capex
    ativacao_tipo      text,
    ativacao_pct       numeric(5,2) CHECK (ativacao_pct IS NULL
                                           OR ativacao_pct BETWEEN 0 AND 100),

    -- Receita
    produto_id         bigint REFERENCES cadastro.produto(id),
    sub_produto_id     bigint REFERENCES cadastro.sub_produto(id),
    tipo_receita_id    bigint REFERENCES cadastro.tipo_receita(id),

    -- Capex
    projeto            text,
    justificativa      text,

    observacao   text,
    status       text NOT NULL DEFAULT 'rascunho'
                 CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'reprovado', 'devolvido')),
    criado_por   bigint NOT NULL REFERENCES cadastro.pessoa(id),
    criado_em    timestamptz NOT NULL DEFAULT now(),
    alterado_em  timestamptz NOT NULL DEFAULT now(),

    -- Cada categoria exige o seu conjunto de dimensões. Deixar isto a cargo da
    -- tela é como se acumula lançamento sem pacote que ninguém consegue
    -- classificar depois.
    CONSTRAINT dimensoes_da_categoria CHECK (
        CASE categoria
            WHEN 'receita' THEN produto_id IS NOT NULL AND tipo_receita_id IS NOT NULL
            WHEN 'despesa' THEN conta_id IS NOT NULL AND centro_custo_id IS NOT NULL
                                AND pacote_id IS NOT NULL
            WHEN 'capex'   THEN conta_id IS NOT NULL AND centro_custo_id IS NOT NULL
                                AND pacote_id IS NOT NULL AND projeto IS NOT NULL
        END
    )
);

CREATE TABLE lancamento_mes (
    lancamento_id  bigint NOT NULL REFERENCES lancamento(id) ON DELETE CASCADE,
    ano            smallint NOT NULL,
    mes            smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
    valor          numeric(18,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (lancamento_id, ano, mes)
);

-- ── Regras que o banco cobra sozinho ─────────────────────────────────────────

-- Regra PAC: o pacote precisa servir a categoria do lançamento. Sem isto,
-- "Estrutura de Pessoal" entra num Capex e ninguém percebe.
CREATE FUNCTION pacote_serve_categoria() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.pacote_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM cadastro.pacote_categoria
        WHERE pacote_id = NEW.pacote_id AND categoria = NEW.categoria
    ) THEN
        RAISE EXCEPTION 'Pacote % não se aplica a %.', NEW.pacote_id, NEW.categoria
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER lancamento_pacote_valido
    BEFORE INSERT OR UPDATE ON lancamento
    FOR EACH ROW EXECUTE FUNCTION pacote_serve_categoria();

-- Versão fechada não aceita escrita — a função vem de 02.
CREATE TRIGGER lancamento_versao_aberta
    BEFORE INSERT OR UPDATE OR DELETE ON lancamento
    FOR EACH ROW EXECUTE FUNCTION exige_versao_aberta();

-- O mês também é protegido: sem isto daria para alterar o valor de uma versão
-- fechada mexendo direto na tabela filha, que é a porta dos fundos.
CREATE FUNCTION mes_exige_versao_aberta() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_id bigint;
BEGIN
    SELECT versao_id INTO v_id FROM lancamento
     WHERE id = COALESCE(NEW.lancamento_id, OLD.lancamento_id);
    IF v_id IS NOT NULL AND NOT versao_aceita_escrita(v_id) THEN
        RAISE EXCEPTION 'Versão % está fechada: valor mensal não pode mudar.', v_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER lancamento_mes_versao_aberta
    BEFORE INSERT OR UPDATE ON lancamento_mes
    FOR EACH ROW EXECUTE FUNCTION mes_exige_versao_aberta();

-- Regra DUP: a mesma combinação não pode aparecer duas vezes na mesma versão.
-- Índices parciais porque a chave de duplicidade muda conforme a categoria.
CREATE UNIQUE INDEX lancamento_unico_despesa
    ON lancamento (versao_id, empresa_id, conta_id, centro_custo_id, pacote_id)
    WHERE categoria = 'despesa';

CREATE UNIQUE INDEX lancamento_unico_capex
    ON lancamento (versao_id, empresa_id, conta_id, centro_custo_id, pacote_id, projeto)
    WHERE categoria = 'capex';

CREATE UNIQUE INDEX lancamento_unico_receita
    ON lancamento (versao_id, empresa_id, produto_id,
                   COALESCE(sub_produto_id, 0), tipo_receita_id)
    WHERE categoria = 'receita';

-- ── Índices de consulta ──────────────────────────────────────────────────────

CREATE INDEX lancamento_versao      ON lancamento (versao_id);
CREATE INDEX lancamento_empresa     ON lancamento (empresa_id, categoria);
CREATE INDEX lancamento_status      ON lancamento (versao_id, status);
CREATE INDEX lancamento_conta       ON lancamento (conta_id);
CREATE INDEX lancamento_mes_periodo ON lancamento_mes (ano, mes);

-- ── Visão achatada, para relatório e export ──────────────────────────────────

-- Junta tudo o que a tela precisa, para o relatório não repetir dez JOINs.
CREATE VIEW vw_lancamento AS
SELECT l.id, l.ref, l.versao_id, l.categoria, l.status,
       bu.nome  AS bu, t.nome AS torre, st.nome AS sub_torre, e.nome AS empresa,
       c.codigo AS conta_codigo, c.descricao AS conta, lp.nome AS linha_pl,
       cc.nome  AS centro_custo, p.nome AS pacote,
       pr.nome  AS produto, sp.nome AS sub_produto, tr.nome AS tipo_receita,
       l.fornecedor, l.projeto, l.observacao,
       m.ano, m.mes, m.valor
  FROM lancamento l
  JOIN lancamento_mes m       ON m.lancamento_id = l.id
  JOIN cadastro.empresa e     ON e.id  = l.empresa_id
  JOIN cadastro.torre t       ON t.id  = e.torre_id
  JOIN cadastro.bu bu         ON bu.id = t.bu_id
  LEFT JOIN cadastro.sub_torre st    ON st.id = e.sub_torre_id
  LEFT JOIN cadastro.conta c         ON c.id  = l.conta_id
  LEFT JOIN cadastro.linha_pl lp     ON lp.id = c.linha_pl_id
  LEFT JOIN cadastro.centro_custo cc ON cc.id = l.centro_custo_id
  LEFT JOIN cadastro.pacote p        ON p.id  = l.pacote_id
  LEFT JOIN cadastro.produto pr      ON pr.id = l.produto_id
  LEFT JOIN cadastro.sub_produto sp  ON sp.id = l.sub_produto_id
  LEFT JOIN cadastro.tipo_receita tr ON tr.id = l.tipo_receita_id;
