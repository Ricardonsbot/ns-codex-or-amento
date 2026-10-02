-- =============================================================================
-- 01 — CADASTRO
-- =============================================================================
-- As tabelas que quase não mudam: estrutura organizacional, plano de contas,
-- pacotes, produtos e pessoas. É o que hoje mora em Referencias/*.json e o que
-- já existe de verdade nos .xlsx do repositório.
--
-- Rode este arquivo primeiro: todo o resto aponta para cá.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS cadastro;
SET search_path TO cadastro, public;

-- ── Estrutura organizacional: BU → Torre → Sub Torre → Empresa ───────────────

CREATE TABLE bu (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo  text NOT NULL UNIQUE,
    nome    text NOT NULL,
    ativo   boolean NOT NULL DEFAULT true
);

CREATE TABLE torre (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bu_id   bigint NOT NULL REFERENCES bu(id),
    codigo  text NOT NULL UNIQUE,
    nome    text NOT NULL,
    ativo   boolean NOT NULL DEFAULT true
);

CREATE TABLE sub_torre (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    torre_id  bigint NOT NULL REFERENCES torre(id),
    nome      text NOT NULL,
    ativo     boolean NOT NULL DEFAULT true,
    UNIQUE (torre_id, nome)
);

-- sub_torre_id é opcional: nem toda empresa pendura numa sub torre (no
-- organizacional.json várias vêm com "-"). A torre, essa, é obrigatória.
CREATE TABLE empresa (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    torre_id      bigint NOT NULL REFERENCES torre(id),
    sub_torre_id  bigint REFERENCES sub_torre(id),
    codigo        text NOT NULL UNIQUE,
    nome          text NOT NULL,
    cnpj          text,
    ativo         boolean NOT NULL DEFAULT true
);

CREATE TABLE centro_custo (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id  bigint REFERENCES empresa(id),
    codigo      text NOT NULL UNIQUE,
    nome        text NOT NULL,
    ativo       boolean NOT NULL DEFAULT true
);

-- ── Plano de contas ──────────────────────────────────────────────────────────

-- ordem define a sequência do P&L na tela; sinal diz se a linha soma ou subtrai
-- no bridge Revenue → Expenses → EBITDA → Capex.
CREATE TABLE linha_pl (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome    text NOT NULL UNIQUE,
    ordem   integer NOT NULL,
    sinal   smallint NOT NULL DEFAULT 1 CHECK (sinal IN (-1, 1))
);

CREATE TABLE conta (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    linha_pl_id  bigint REFERENCES linha_pl(id),
    codigo       text NOT NULL UNIQUE,
    descricao    text NOT NULL,
    categoria    text,
    natureza     text NOT NULL DEFAULT 'D' CHECK (natureza IN ('D', 'R')),
    ativo        boolean NOT NULL DEFAULT true
);

-- Regra PL das validações: conta sem linha de P&L não entra no consolidado.
-- Fica como índice para a checagem ser barata, não como NOT NULL, porque a
-- carga inicial dos 630 códigos vai trazer contas ainda sem mapeamento.
CREATE INDEX conta_sem_linha_pl ON conta (id) WHERE linha_pl_id IS NULL;

-- ── Pacote: o MOTIVO do lançamento, não a natureza contábil ──────────────────

CREATE TABLE pacote (
    id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo   text NOT NULL UNIQUE,
    nome     text NOT NULL,
    motivo   text NOT NULL,
    tipo     text NOT NULL CHECK (tipo IN ('Recorrente', 'Não recorrente')),
    ativo    boolean NOT NULL DEFAULT true
);

-- Qual pacote serve qual categoria. Tabela em vez de array para o banco
-- conseguir validar por chave estrangeira.
CREATE TABLE pacote_categoria (
    pacote_id  bigint NOT NULL REFERENCES pacote(id) ON DELETE CASCADE,
    categoria  text NOT NULL CHECK (categoria IN ('receita', 'despesa', 'capex')),
    PRIMARY KEY (pacote_id, categoria)
);

-- ── Produto: usado só na Receita ─────────────────────────────────────────────

CREATE TABLE produto (
    id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome   text NOT NULL UNIQUE,
    ativo  boolean NOT NULL DEFAULT true
);

-- N:N de propósito: no catálogo atual só um produto serve mais de uma torre,
-- mas o modelo prevê, e uma FK simples travaria isso.
CREATE TABLE produto_torre (
    produto_id  bigint NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
    torre_id    bigint NOT NULL REFERENCES torre(id),
    PRIMARY KEY (produto_id, torre_id)
);

CREATE TABLE sub_produto (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_id  bigint NOT NULL REFERENCES produto(id) ON DELETE CASCADE,
    nome        text NOT NULL,
    ativo       boolean NOT NULL DEFAULT true,
    UNIQUE (produto_id, nome)
);

-- linha_pl_id fecha um buraco do modelo atual: a grade de Receita não pede
-- conta contábil, então sem isto a receita não teria por onde entrar no P&L.
-- É o tipo de receita que decide a linha.
CREATE TABLE tipo_receita (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    linha_pl_id  bigint REFERENCES linha_pl(id),
    nome         text NOT NULL UNIQUE,
    ordem        integer NOT NULL DEFAULT 0
);

-- ── Premissas macro (IGP-M, INPC, IPCA, CDI, câmbio) ─────────────────────────

CREATE TABLE premissa (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      text NOT NULL UNIQUE,
    nome        text NOT NULL,
    tipo        text NOT NULL,
    unidade     text NOT NULL,
    fonte       text,
    aplicacao   text,
    descricao   text,
    ativo       boolean NOT NULL DEFAULT true
);

-- Uma linha por mês, não doze colunas — mesma regra que vale para o lançamento.
CREATE TABLE premissa_mes (
    premissa_id  bigint NOT NULL REFERENCES premissa(id) ON DELETE CASCADE,
    ano          smallint NOT NULL,
    mes          smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
    valor        numeric(12,6) NOT NULL,
    PRIMARY KEY (premissa_id, ano, mes)
);

-- ── Pessoas ──────────────────────────────────────────────────────────────────

-- Sem coluna de senha de propósito: a autenticação deve vir do login
-- corporativo (SSO). Aqui fica só quem é a pessoa e o que ela pode fazer.
CREATE TABLE pessoa (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    login      text NOT NULL UNIQUE,
    nome       text NOT NULL,
    email      text UNIQUE,
    perfil     text NOT NULL CHECK (perfil IN ('operacional', 'aprovador', 'lider', 'admin')),
    ativo      boolean NOT NULL DEFAULT true,
    criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Uma pessoa pode responder por várias empresas; uma empresa tem vários donos.
CREATE TABLE pessoa_empresa (
    pessoa_id   bigint NOT NULL REFERENCES pessoa(id) ON DELETE CASCADE,
    empresa_id  bigint NOT NULL REFERENCES empresa(id),
    PRIMARY KEY (pessoa_id, empresa_id)
);

CREATE INDEX torre_bu           ON torre (bu_id);
CREATE INDEX empresa_torre      ON empresa (torre_id);
CREATE INDEX centro_custo_emp   ON centro_custo (empresa_id);
CREATE INDEX conta_linha_pl     ON conta (linha_pl_id);
