# NS Budget — App React

App de orçamento corporativo (React + [Supabase](https://supabase.com)), migrado do protótipo estático (pasta raiz do repositório).

**Status:** todas as telas do menu estão conectadas ao Supabase (dados reais) — Dashboard, Cadastros (10 categorias), Orçamento de Receita/Despesa/Capex, Relatórios, Aprovações e Budget-Settings (Ciclos & Versões). Login é real (Supabase Auth), sem autocadastro — só entra quem já foi pré-cadastrado no Supabase.

**Login de desenvolvimento** (acesso ao sistema): `dev@nstech.com.br` / `123456` — conta fixa, pré-cadastrada direto no Supabase Auth (Authentication → Users), sem fluxo de cadastro pela tela de login. Cadastro público de novos usuários está desativado no projeto (Authentication → Sign In / Providers → "Allow new users to sign up" = off) — para adicionar alguém, crie a conta manualmente em Authentication → Users → Add user.

## Rodando localmente (sem Docker)

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Conectar ao Supabase

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e um novo projeto (ou peça acesso ao projeto já existente do time).
2. No projeto, vá em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e clique em **Run**. Isso cria as tabelas.
3. Vá em **Settings → API** e copie a **Project URL** e a chave **publishable/anon public**.
4. Copie `.env.example` para `.env` e preencha:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-public
   ```
5. Reinicie `npm run dev`.

O arquivo `.env` **nunca** deve ser commitado (já está no `.gitignore`) — ele é diferente pra cada pessoa/ambiente. Se o time inteiro usa o **mesmo** projeto Supabase (recomendado, já que os dados ficam sincronizados automaticamente pra todo mundo), basta compartilhar essas duas variáveis por um canal seguro (não pelo Git).

## Carregar o plano de contas do datalake

A tabela `conta` é alimentada a partir da fonte de verdade de FP&A —
`FPA_DW/Datalake_readFiles/tbl_KMM_Contas.xlsx`, aba `dContas` — e não à mão.

```bash
cd app
node --env-file=.env scripts/importar-contas.mjs "<caminho do tbl_KMM_Contas.xlsx>" --dry-run
```

O `--dry-run` mostra o que seria carregado sem gravar nada. Tirando a flag, ele
recarrega a tabela `conta`.

O que o script faz, e por quê:

- **Fica só com resultado e capex.** Das 635 contas da planilha, 231 são de
  balanço (Fornecedores, Imobilizado, Tributos a pagar...). Não se orça sobre
  elas, então ficam fora do cadastro.
- **Deduplica por código normalizado.** O datalake cadastra algumas contas duas
  vezes, uma com o código pontuado (`4.7.03.001.021`) e outra sem
  (`4703001021`). Quando as duas descrevem a mesma conta, fica a pontuada — a
  comparação ignora acento e caixa, porque a descrição vem ora com, ora sem.
- **Reporta os conflitos que não sabe resolver.** Quando o mesmo código
  normalizado tem descrições realmente diferentes, mantém as duas linhas e
  imprime um aviso: decidir qual está errada exige quem conhece o plano de
  contas.
- **Não quebra lançamentos.** `lancamento.conta_id` é FK com `RESTRICT`; as
  contas ainda referenciadas são atualizadas no lugar, preservando o `id`, e só
  o restante é recriado.

Hoje isso resulta em **387 contas** carregadas, com 17 duplicatas descartadas e
2 conflitos reportados. Os nomes ficam como estão no datalake (caixa alta, sem
acento) — a planilha é a referência, a correção de grafia é feita lá.

## Premissas Macro (índices e câmbio)

Tela em **Cadastros → Premissas Macro** (`/cadastros/premissas-macro`) com a
projeção mensal de IGP-M, IPCA, INPC, Livre e Dólar em formato de matriz
(indicador × 12 meses, com acumulado do ano). Os valores saem da aba
**"Indices Reajuste"** do Template Budget, que é onde FP&A mantém a projeção.

Carregar ou atualizar:

```bash
cd app
node --env-file=.env scripts/importar-premissas-macro.mjs "<caminho do Template Budget .xlsb>" --dry-run
```

O `--dry-run` mostra o que seria carregado sem gravar. Tirando a flag, ele grava
de verdade: reaproveita o índice de mesmo tipo/ano se já existir e faz upsert por
`(indice_id, mes)` — reexecutar depois de atualizar a planilha sobrescreve o que
mudou e não duplica.

O script acha a linha de cabeçalho pela célula "Mês" em vez de assumir posição
fixa, e converte a variação de decimal (`0,004342`) para pontos percentuais
(`0,4342`). Linhas sem número no mês são ignoradas — a aba tem comentários no
meio dos dados.

**Duas limitações conscientes.** Os dados moram nas tabelas `indice` /
`indice_valor_mensal` que já existiam, para a carga não depender de rodar DDL num
banco compartilhado. Como consequência:

- `indice_valor_mensal.percentual` é `numeric(6,3)`, então tudo fica com três
  casas decimais — o IGP-M acumulado sai 4,445% em vez de 4,4439%.
- Não há coluna de unidade, e o câmbio é **nível em R$**, não variação. O sufixo
  `(R$/US$)` no nome do índice é o que a tela usa para não compor o acumulado
  dele. Se um dia a tabela puder ganhar uma coluna `unidade`, é ela que deve
  substituir essa heurística.

Na carga de 2027: 5 séries, 60 valores mensais. Acumulado no ano — IGP-M 4,445%,
IPCA 4,365%, INPC 4,186%, Livre 12,995%; Dólar terminando em 5,500.

## Mapa de centros de custo

O cadastro **Cadastros → Centros de Custo** é alimentado pela aba **"Mapa Centros
de Custo"** do Template Budget, que agrupa cada centro de custo pela área
responsável (FLGS, CRO, People, Tecnologia...).

```bash
cd app
node --env-file=.env scripts/importar-centros-custo.mjs "<caminho do Template Budget .xlsb>" --dry-run
```

O `--dry-run` mostra as áreas e a contagem por área sem gravar. Tirando a flag,
faz upsert por `codigo`.

A aba é um **mapa em cascata**, não uma tabela: cada área ocupa uma coluna, e os
centros de custo daquela área descem por ela. O script lê as linhas de BU, rótulo
e chave pelo índice absoluto, e por isso força `range: 0` na leitura — sem isso o
SheetJS começa na primeira linha não vazia e todos os índices escorregam. Como
proteção, ele falha se a linha de rótulos contiver nomes no formato de centro de
custo (`HOLDING - X`, `CSC - X`), que é o sintoma desse escorregamento.

O mapa não tem código numérico: o próprio nome do centro de custo é a chave
natural, e é ele que aparece em `lancamento.centro_de_custo` — então `codigo`
recebe o nome limpo, sempre. Prefixar o código quebraria esse vínculo.

**A coluna `area` é opcional.** O script detecta se ela existe:

- **Existe** (criada por `app/supabase/migrations/2026-09-01-centro-de-custo-area.sql`):
  a área vai em coluna própria, e `nome` fica com o nome limpo.
- **Não existe**: a área vai embutida no nome, como `FLGS · CSC - FP&A`. Assim a
  carga não depende de rodar DDL num banco compartilhado, e a ordenação da tela
  ainda agrupa por área. Rodar de novo depois de criar a coluna migra os
  registros para o formato limpo.

Preferir a coluna quando der: área embutida em texto não dá para filtrar nem
agregar sem quebrar string.

Na carga atual: 36 centros de custo em 10 áreas, todos da BU Corporate.

## Produtos

O cadastro **Cadastros → Produtos** vem da planilha de Net Revenue
(`New_Net Revenue - Sync.xlsx`).

```bash
cd app
node --env-file=.env scripts/importar-produtos.mjs "<caminho do New_Net Revenue - Sync.xlsx>" --dry-run
```

O `--dry-run` mostra a contagem por categoria sem gravar. Tirando a flag, faz
upsert por `codigo`.

**Só a aba "Dados Fechados" tem a lista limpa.** As abas de Dashboard e de Input
misturam produto com nível de agregação (`Consolidado`, `Total PSL`, `Torre TMS`,
`SW EMBARCADOR`, `Last Mile`, `BU VGR`...) — importar de lá traria 58 linhas, das
quais 17 não são produto.

A `categoria` é derivada: a aba "Input Projeções" lista os produtos na ordem da
árvore, abaixo do grupo a que pertencem, então o grupo de cada produto é o último
nó que não é folha. Isso não é uma coluna do arquivo, é inferência a partir da
ordem.

O arquivo não tem código de produto, então `codigo` e `nome` recebem o mesmo
valor — o nome é a chave natural.

**O script localiza as colunas pelo conteúdo, não por índice.** O `!ref` da aba
"Dados Fechados" é `B1:CU96`, e o SheetJS indexa a partir do início do intervalo
e não da coluna A: um índice fixo aponta para a coluna errada, sem erro. A coluna
de produtos é achada pela célula `Company/Product`; a de hierarquia, por ser a
que mais casa com os nomes já conhecidos.

A comparação de nomes ignora caixa e acento: a planilha grafa `LogRisk` numa aba
e `Logrisk` na outra. Com casamento exato, `Logrisk` viraria um nó de
agrupamento e Onisys e Trafegus seriam pendurados nele em vez de VGR — errado de
um jeito plausível. O script reporta as grafias divergentes que encontrar.

Na carga atual: 41 produtos em 10 categorias.

## Clientes

O cadastro **Cadastros → Clientes** vem da saída do processador de PDD
(`Área de Trabalho\PDD\processar_pdd.py`), que identifica o cliente de cada
lançamento do histórico contábil e consolida por cliente.

```bash
cd app
node --env-file=.env scripts/importar-clientes.mjs "<caminho do ... - por Cliente.xlsx>" --dry-run
```

Lê a aba `Clientes` da saída do PDD. Com `--com-saldo`, entram só os clientes
com saldo diferente de zero — a maioria zera no período, por ter provisão e
reversão no mesmo mês.

A tabela `cliente` não tem restrição de unicidade em `nome`, então não há upsert
possível: o script lê os nomes já gravados e insere só os que faltam. Reexecutar
não duplica.

**Só `nome` é preenchido.** A base de PDD é contábil e não carrega CNPJ nem
contato; `documento` e `contato` ficam vazios e precisam de outra fonte.

Na carga atual: 3.361 clientes, de 20.300 lançamentos em 29 empresas.

## Rodando com Docker

Requer [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando.

```bash
cd app
docker compose up --build
```

Abre em `http://localhost:8090`.

**Importante:** o Vite embute as variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no JavaScript **durante o build** (não são lidas em tempo de execução do container). O `docker-compose.yml` já está configurado pra ler essas duas variáveis do seu `app/.env` local e passá-las como build args — ou seja, configure o `.env` (passo acima) **antes** de rodar `docker compose up`. Se trocar as chaves depois, rode `docker compose up --build` de novo para reconstruir a imagem com os novos valores.

Esse Dockerfile faz um build de produção (`npm run build`) e serve os arquivos estáticos resultantes via nginx — não é hot-reload como o `npm run dev`; é o equivalente a rodar a versão "publicada" do app localmente.

## Estrutura

```
src/
├── components/
│   ├── Layout.jsx              Sidebar + estrutura compartilhada entre as telas logadas
│   └── ToastProvider.jsx       Sistema de notificações (toast)
├── lib/                        Camada de acesso ao Supabase, uma "fonte de dados" por domínio
│   ├── supabaseClient.js       Cliente do Supabase, lido das variáveis de ambiente
│   ├── dashboardData.js        BU/Torre/Empresa + resumo do bridge chart do Dashboard
│   ├── contasData.js           CRUD do plano de contas
│   ├── indicesData.js          CRUD de índices de reajuste + valores mensais
│   ├── cadastroSimplesData.js  CRUD genérico (parametrizado por nome de tabela)
│   ├── cadastrosSimplesConfig.js  Config dos 8 cadastros "simples" (Usuários, Clientes, etc.)
│   ├── ciclosData.js           Ciclos/Versões (Budget-Settings + Aprovações)
│   ├── lancamentosData.js      Lançamentos de Receita/Despesa/Capex + valores mensais
│   └── relatoriosData.js       Agregação hierárquica (BU→Torre→SubTorre→Empresa) dos Relatórios
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Cadastros.jsx           Hub com as 10 categorias de cadastro
│   ├── cadastros/
│   │   ├── ContasContabeis.jsx
│   │   ├── Indices.jsx
│   │   └── CadastroSimples.jsx Tela genérica reusada pelos 8 cadastros simples (rota /cadastros/:slug)
│   ├── orcamento/
│   │   ├── OrcamentoEntry.jsx  Grade de lançamento genérica (parametrizada por tipo)
│   │   ├── Receita.jsx / Despesa.jsx / Capex.jsx
│   ├── Relatorios.jsx
│   ├── Aprovacoes.jsx
│   ├── BudgetSettings.jsx
│   └── EmConstrucao.jsx        Placeholder (não usado mais, mantido por segurança)
├── App.jsx                     Definição das rotas
└── main.jsx                    Ponto de entrada (React Router + CSS global)

Dockerfile, nginx.conf, docker-compose.yml    Empacotamento pra rodar o build de produção via Docker
```

O `src/index.css` é uma cópia do `assets/css/style.css` do protótipo original — mesma paleta de cores e componentes visuais, sem depender de framework de CSS.
