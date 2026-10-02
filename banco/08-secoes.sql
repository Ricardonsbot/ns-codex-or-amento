-- =============================================================================
-- 08 — SEÇÕES (2ª camada de RBAC) e CONFIG DE PLATAFORMA
-- =============================================================================
-- A Row Level Security de 07 responde "quais LINHAS esta pessoa vê". Falta a
-- outra pergunta, que é ortogonal: "esta pessoa alcança esta TELA?".
--
-- Hoje qualquer pessoa autenticada chega em qualquer rota que exista. Enquanto
-- só havia catálogo isso era pouco; com aprovação, auditoria e cadastro na mesa,
-- deixa de ser.
--
-- POR QUE NÃO RESOLVER COM RLS TAMBÉM: RLS filtra linha, e "não pode abrir a
-- tela de auditoria" não é um filtro de linha — é um 403. Tentar espremer isso
-- em política de banco daria uma tela vazia em vez de uma recusa, que é pior:
-- a pessoa não sabe se não tem acesso ou se não há dado.
--
-- POR QUE NÃO VAI PARA O TOKEN: mesma razão de 07 não pôr empresa na claim. Uma
-- lista copiada no token envelhece — revogar uma seção só valeria quando o token
-- expirasse, oito horas depois. Aqui se lê do banco a cada request.
-- =============================================================================

SET search_path TO cadastro, public;

CREATE TABLE secao (
    codigo    text PRIMARY KEY,
    nome      text NOT NULL,
    ordem     integer NOT NULL DEFAULT 0
);

-- As seções são GROSSAS de propósito: uma por área do produto, não uma por
-- tela. Seção por tela vira uma matriz que ninguém mantém, e o efeito prático é
-- que todo mundo recebe tudo para parar de reclamar.
INSERT INTO secao (codigo, nome, ordem) VALUES
    ('cadastro',  'Catálogos e cadastro',            10),
    ('orcamento', 'Lançar orçamento',                20),
    ('fluxo',     'Entregas, aprovações e correções', 30),
    ('relatorios','Relatórios e dashboards',         40),
    ('auditoria', 'Trilha de auditoria',             50),
    ('admin',     'Administração',                   60);

CREATE TABLE pessoa_secao (
    pessoa_id  bigint NOT NULL REFERENCES pessoa(id) ON DELETE CASCADE,
    secao      text   NOT NULL REFERENCES secao(codigo),
    PRIMARY KEY (pessoa_id, secao)
);

CREATE INDEX pessoa_secao_pessoa ON pessoa_secao (pessoa_id);

-- ── Config de plataforma ─────────────────────────────────────────────────────
-- Flags de operação que precisam mudar SEM deploy e SEM SSH. A primeira é a
-- própria fiscalização de seção: ligar RBAC sem poder desligar é como se trava a
-- operação num domingo, e aí alguém desliga do jeito errado — dando admin para
-- todo mundo.
CREATE TABLE config_plataforma (
    chave        text PRIMARY KEY,
    valor        text NOT NULL,
    descricao    text,
    alterado_em  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO config_plataforma (chave, valor, descricao) VALUES
    ('rbac_secao_enforce', 'true',
     'Fiscalizar a seção nos endpoints. false = o filtro vira no-op e todo '
     'autenticado alcança tudo. Mudança vale em até 30s, sem reiniciar.');

GRANT SELECT ON secao, pessoa_secao, config_plataforma TO app_leitura, app_escrita;
