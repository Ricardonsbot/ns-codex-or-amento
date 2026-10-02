-- =============================================================================
-- 06 — REALIZADO (item 22 do roadmap)
-- =============================================================================
-- Tabela SEPARADA do orçado, e isso não é detalhe.
--
-- Orçado é compromisso de alguém; realizado é fato vindo do ERP. Procedências
-- diferentes, confiança diferente, dono diferente. Se os dois morarem na mesma
-- tabela com uma coluna "tipo", em seis meses ninguém sabe mais o que era plano
-- e o que era fato — e a ferramenta vira uma segunda verdade concorrendo com o
-- ERP, que é como esse tipo de projeto morre.
--
-- Repare que aqui NÃO há versão: realizado não tem versão, tem competência.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS realizado;
SET search_path TO realizado, orcamento, cadastro, public;

-- Cada carga é registrada: de onde veio, quem subiu, quando.
CREATE TABLE carga (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    competencia   date NOT NULL,          -- sempre o dia 1 do mês
    origem        text NOT NULL,
    arquivo       text,
    linhas        integer NOT NULL DEFAULT 0,
    carregada_em  timestamptz NOT NULL DEFAULT now(),
    carregada_por bigint NOT NULL REFERENCES cadastro.pessoa(id),
    CONSTRAINT competencia_no_dia_1 CHECK (date_trunc('month', competencia) = competencia)
);

-- Recarregar o mesmo mês substitui a carga anterior em vez de somar — é o erro
-- mais comum e o mais caro, porque dobra silenciosamente o resultado.
CREATE UNIQUE INDEX carga_uma_por_competencia ON carga (competencia);

CREATE TABLE valor (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    carga_id         bigint NOT NULL REFERENCES carga(id) ON DELETE CASCADE,
    competencia      date NOT NULL,
    empresa_id       bigint NOT NULL REFERENCES cadastro.empresa(id),
    conta_id         bigint NOT NULL REFERENCES cadastro.conta(id),
    centro_custo_id  bigint REFERENCES cadastro.centro_custo(id),
    valor            numeric(18,2) NOT NULL,      -- em reais, como no orçado
    UNIQUE (carga_id, empresa_id, conta_id, centro_custo_id)
);

CREATE INDEX realizado_competencia ON valor (competencia, empresa_id);
CREATE INDEX realizado_conta       ON valor (conta_id);

-- ── Orçado vs. Realizado ─────────────────────────────────────────────────────

-- É esta visão que destrava as colunas RFC e Δ R$ / Δ % da tela de receita,
-- que hoje aparecem na maquete sem nada por trás.
CREATE VIEW vw_orcado_vs_realizado AS
WITH orcado AS (
    SELECT l.versao_id, l.empresa_id, l.conta_id, l.centro_custo_id,
           make_date(m.ano, m.mes, 1) AS competencia,
           SUM(m.valor) AS orcado
      FROM orcamento.lancamento l
      JOIN orcamento.lancamento_mes m ON m.lancamento_id = l.id
     WHERE l.status = 'aprovado'
     GROUP BY 1,2,3,4,5
),
real_ AS (
    SELECT competencia, empresa_id, conta_id, centro_custo_id,
           SUM(valor) AS realizado
      FROM valor
     GROUP BY 1,2,3,4
)
SELECT COALESCE(o.competencia, r.competencia)   AS competencia,
       COALESCE(o.empresa_id,  r.empresa_id)    AS empresa_id,
       COALESCE(o.conta_id,    r.conta_id)      AS conta_id,
       o.versao_id,
       COALESCE(o.orcado, 0)                    AS orcado,
       COALESCE(r.realizado, 0)                 AS realizado,
       COALESCE(r.realizado, 0) - COALESCE(o.orcado, 0) AS delta_reais,
       -- divisão protegida: orçado zero com realizado positivo é estouro
       -- infinito, e NULL na tela lê melhor que um número inventado
       CASE WHEN COALESCE(o.orcado, 0) = 0 THEN NULL
            ELSE round((COALESCE(r.realizado,0) - o.orcado) / abs(o.orcado) * 100, 2)
       END                                      AS delta_pct
  FROM orcado o
  FULL OUTER JOIN real_ r
    ON  r.competencia     = o.competencia
    AND r.empresa_id      = o.empresa_id
    AND r.conta_id        = o.conta_id
    AND r.centro_custo_id IS NOT DISTINCT FROM o.centro_custo_id;

-- Justificativa de desvio: quem explica o quê saiu do plano, e assina.
CREATE TABLE justificativa (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    competencia  date NOT NULL,
    empresa_id   bigint NOT NULL REFERENCES cadastro.empresa(id),
    conta_id     bigint NOT NULL REFERENCES cadastro.conta(id),
    texto        text NOT NULL,
    escrita_por  bigint NOT NULL REFERENCES cadastro.pessoa(id),
    escrita_em   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (competencia, empresa_id, conta_id)
);
