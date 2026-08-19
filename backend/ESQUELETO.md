# Esqueleto do backend — o que existe e como rodar

> Criado em 14/08/2026. É o passo 1 da ordem de ataque de
> [`ARQUITETURA-NSVIEW.md`](../ARQUITETURA-NSVIEW.md) §7: cinco projetos, um
> endpoint de saúde e um de catálogo lendo do Postgres — para provar a stack
> ponta a ponta antes de construir qualquer coisa em cima.

## Os cinco projetos

Mesmo desenho da nsView, com a dependência apontando só para dentro:

```
NsCodex.Api ──► NsCodex.Application ──► NsCodex.Domain
     │                    ▲
     └──► NsCodex.Infrastructure ──┘        NsCodex.Tests ──► Domain + Application
```

| Projeto | O que mora aqui |
|---|---|
| `NsCodex.Domain` | entidades e **regra de negócio pura**. Não conhece EF, banco nem HTTP |
| `NsCodex.Application` | contratos (`IContaRepository`) e DTOs do contrato de leitura |
| `NsCodex.Infrastructure` | `AppDbContext`, repositórios — a única camada que conhece Postgres |
| `NsCodex.Api` | controllers finos, pipeline HTTP |
| `NsCodex.Tests` | xUnit sobre Domain e Application, sem subir banco |

**A diferença deliberada em relação à nsView** está no `Domain`. Lá as entidades
são anêmicas e a regra vive no `Infrastructure`, junto do EF — por isso não dá
para exercitá-la sem contexto de banco. Aqui a primeira regra portada
(`CategoriaDaConta`) é função pura, e os 12 testes rodam em 177 ms sem Postgres.

## O que já funciona

| Endpoint | O que faz |
|---|---|
| `GET /health` | responde **sem tocar no banco** — é o que o nginx e o deploy consultam |
| `GET /api/ref/contas` | plano de contas do banco, **no formato de `Referencias/contas.json`** |

O segundo é o que importa: é o contrato que faz o `carregarRef()` do `app.js`
mudar uma linha só (a URL) e as 19 telas passarem a ler do banco.

Verificado em 14/08 contra o `orcamento_dev`:

```json
{ "conta": "4.01.001", "nome": "Salários", "linhaPL": "Expenses",
  "categoria": "despesa", "pacote": null, "subpacote": null,
  "caixa": null, "linhaPLDetalhe": null }
```

## Rodar

Com o Postgres da Fase 0 no ar (porta 5433, banco `orcamento_dev`):

```bash
DATABASE_URL="postgres://postgres:SENHA@localhost:5433/orcamento_dev" dotnet run --project NsCodex.Api
```

Sobe em `http://127.0.0.1:5055`. Testes: `dotnet test NsCodex.sln`.

> **Pega-ratão herdado da nsView:** o `launchSettings.json` vence o
> `ASPNETCORE_URLS`, então mudar a porta pela env não funciona e o sintoma é um
> `address already in use` numa porta que você não pediu. Aqui a porta foi cravada
> em **5055** no próprio `launchSettings.json`, que é o conserto que o
> `rodar-local.md` deles descreve mas não aplica (lá o arquivo diz 5022 e o proxy
> espera 5002).

## Decisões embutidas

**Database-first, e nunca `dotnet ef migrations add`.** O schema mora em
`banco/*.sql` e contém RLS, políticas, gatilhos e índices parciais que o EF não
sabe modelar. Se o EF gerasse o schema, tudo isso se perderia — e é justamente o
que faz o `DELETE` de outra empresa devolver zero linha. O `AppDbContext`
**mapeia**, não define.

**Sem fallback para SQLite.** A nsView tem o ramo `UseSqlite` no `Program.cs` e o
`rodar-local.md` avisa que ele quebra no boot. Um fallback que sobe mas não vale
as regras é pior do que não subir: o `DATABASE_URL` ausente aborta alto.

**Controller fino.** `RefController` recebe, chama e devolve. Foi assim que a
nsView acumulou `OrcamentoReceitaService` com 2.215 linhas — começando agora, dá
para não repetir.

## O que falta

**Quatro campos do contrato não têm coluna.** `Referencias/contas.json` traz
`pacote`, `subpacote`, `caixa` e `linhaPLDetalhe`; `cadastro.conta` não tem
nenhum dos quatro. Hoje saem nulos. São duas saídas, e é decisão de modelagem:
ou o schema ganha as colunas (o `template-budget-torres.xlsb` já traz pacote e
subpacote por conta), ou os campos saem do contrato e as telas que os usam passam
a derivar de outro lugar. **Enquanto isso não for resolvido, o
`GET /api/ref/contas` ainda não substitui o arquivo.**

**Os outros 17 catálogos.** Só `contas` foi feito. Os demais seguem o mesmo
molde: entidade no Domain quando houver regra, DTO no Application com os nomes do
JSON, repositório no Infrastructure, uma action no `RefController`.

**~~Nada de autenticação ainda~~** — feito em 14/08, ver a segunda metade deste
arquivo. Todo endpoint de catálogo agora exige token.

**`appsettings.Development.json` está no `.gitignore`** de propósito: é onde a
connection string local com senha acabaria parando.

---

# Autenticação — Entra ID + JWT (14/08/2026)

## Como funciona

```
navegador ──popup Microsoft──► Entra ID ──id_token──► POST /api/auth/sso
                                                          │ valida assinatura, issuer,
                                                          │ audience e validade
                                                          ▼
                                        casa o e-mail com cadastro.pessoa (ATIVA)
                                                          │
                                                          ▼
                                          JWT da aplicação (8h) ──► toda request
                                                          │
                                   ContextoDaSessaoInterceptor declara ao Postgres
                                   app.pessoa_id / app.perfil / app.pessoa_login
                                                          │
                                            RLS filtra · gatilho audita
```

| Endpoint | |
|---|---|
| `GET /api/auth/config` | público — a tela pergunta antes de desenhar o botão |
| `POST /api/auth/sso` | troca o `id_token` da Microsoft pelo token da aplicação |
| `GET /api/auth/eu` | quem sou, segundo o token |
| `GET /api/auth/sessao` | quem o **banco** acha que sou, e quantos lançamentos enxergo |

## As decisões

**Um caminho de entrada só.** Não há login por senha, porque `cadastro.pessoa`
não tem coluna de senha — decisão registrada no `01-cadastro.sql` e mantida. A
consequência precisa ser dita: **se o Entra cair, ninguém entra, e não há
break-glass.** Criar um exigiria coluna de senha, e uma conta de emergência com
senha é uma porta permanente para poupar um problema raro. A nsView tem esse
caminho porque já tinha senha; nós não temos, e não vamos criar sem decisão
explícita.

**Default-deny.** Ter conta no tenant da NSTECH não é ter acesso ao orçamento: a
pessoa precisa existir e estar ativa em `cadastro.pessoa`. Não auto-provisiona.

**O token não carrega escopo.** É a diferença principal em relação à nsView, que
põe `familia_fpa` nas claims porque filtra as linhas no service. Aqui quem filtra
é a RLS, que deriva as empresas de `pessoa_empresa`. Duplicar a lista na claim
criaria uma verdade que envelhece — tirar alguém de uma empresa não teria efeito
até o token expirar.

**Perfil ilegível é recusa, não default.** Valor fora do CHECK significa banco
mexido à mão; adivinhar o perfil de alguém é a pior hora para ser prestativo.

**Fail-fast no segredo.** Em produção, `JWT_SECRET` ausente ou com menos de 32
caracteres aborta o boot. Token assinado com chave conhecida é token que qualquer
um forja.

## Verificado ponta a ponta

Com a API rodando como `nscodex_app` contra o banco de teste:

| | |
|---|---|
| `/api/ref/contas` sem token | **401** |
| token assinado com outra chave | **401** |
| `/api/auth/eu` com token da Ana | `{"login":"ana.alfa","perfil":"operacional"}` |
| `/api/auth/sessao` — perfil `operacional` | role `nscodex_app`, **1 lançamento visível** |
| `/api/auth/sessao` — perfil `admin` | role `nscodex_app`, **2 lançamentos visíveis** |

As duas últimas linhas são a prova que importa: **o mesmo código, o mesmo banco,
e o número muda com o perfil declarado no token**. É a RLS respondendo à
autenticação, sem nenhuma rota filtrar nada.

## O que falta

**Um app registration próprio no Entra.** Não dá para reaproveitar o `ClientId`
da nsView: a audience do `id_token` tem de ser a deste aplicativo. Enquanto não
existir, `ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` ficam vazios, `/api/auth/config`
responde `ssoDisponivel: false` e o boot avisa no log. **É um pedido para quem
administra o Entra da NSTECH, e bloqueia o primeiro login real.**

**A tela de login.** O front ainda não chama `/api/auth/sso` — falta o popup MSAL
e guardar o token. É o próximo passo, e é o que destrava publicar o front.

**Nenhuma pessoa cadastrada.** `cadastro.pessoa` está vazia num banco novo, e
sem senha não há seed de admin que se sustente sozinho: a primeira pessoa entra
por `INSERT`, feito por quem tem a credencial do migrator.

---

# A tela de login (14/08/2026)

O front passou a ter as **duas vidas explicitamente**, e as duas foram
verificadas no navegador:

| | Como se comporta |
|---|---|
| **Maquete** — `file://` ou servida sem API | login simulado, navegação livre, nada muda. É o pacote que está em teste |
| **Sistema** — servida com API viva | senha some da tela, login é por conta Microsoft, cada request leva o token |

Quem decide é a API **responder** — não o protocolo. A primeira versão do guard
olhava só o `apiBase()`, que devolve `/api` para qualquer página servida por
http, e com isso quem subisse o `ferramentas/servidor.py` só para ver a maquete
era jogado no login a cada clique, sem ter como sair. Custou um piscar de
conteúdo consertar; teria custado a maquete inteira não consertar.

## PKCE escrito à mão

Sem MSAL, porque a regra do projeto é não ter CDN nem dependência externa. O
fluxo é Authorization Code + PKCE em ~40 linhas, usando só `crypto.subtle`:
`code_verifier` aleatório → `code_challenge` SHA-256 → `authorize` → volta com
`code` → troca no `token` endpoint → o `id_token` vai para `/api/auth/sso` → o
nosso token fica em `sessionStorage`.

PKCE e não implícito porque o implícito devolve o token na URL, onde ele fica no
histórico. `sessionStorage` e não `localStorage` porque o token morre ao fechar
a aba — em máquina compartilhada é a diferença entre "saiu" e "continua logado
amanhã". E o `state` é conferido na volta, para a resposta só ser aceita pela
aba que iniciou a ida.

## O catálogo já vem do banco

`carregarRef()` ganhou uma terceira fonte, antes do arquivo: com API e sessão,
tenta `/api/ref/<catálogo>`. O que a API ainda não serve devolve 404 e **cai no
arquivo** — então a migração é catálogo a catálogo, sem coordenar as duas pontas.

Verificado no navegador: `carregarRef('contas.json')` devolveu a linha do
**banco** (1 conta), enquanto os outros 17 catálogos seguiram vindo de
`Referencias/`.

## O que falta

**O app registration no Entra**, e agora com requisito preciso: plataforma
**Single-page application** (não "Web"), com o redirect URI apontando para a
`login.html` do ambiente — `https://<host>/login.html`. Só a plataforma SPA
devolve os cabeçalhos de CORS que a troca do `code` pelo token exige a partir do
navegador. Enquanto não existir, a tela mostra "Login indisponível — Entra ID não
configurado", que foi o estado verificado.

**O fluxo real de ponta a ponta não foi exercitado** — sem app registration não
há como. O que foi verificado é tudo o que não depende dele: o guard, as duas
vidas, a troca de tela, o token viajando nas chamadas, o 401 derrubando a sessão
e o catálogo vindo do banco.

**Botão de sair.** Existe a função `sair()`, mas nenhuma tela a chama ainda.
