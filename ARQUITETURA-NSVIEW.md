# A arquitetura da nsView aplicada ao NS Codex

> Escrito em 14/08/2026 a partir do pacote `projeto atual nsview.zip` (repo
> `nstechhub/nsview`, última migration datada de 14/08). Complementa o
> `BACKEND.md` e **substitui** dele duas decisões: a hospedagem e a autenticação.
>
> Objetivo: colocar o NS Codex rodando **de maneira análoga** à nsView — mesma
> forma de subir, de autenticar, de publicar e de fazer backup.

---

## 1. O que a nsView é

Plataforma de FP&A da NSTECH, em produção numa VM Azure (`az-nsview01`), servida
em `nsview.nstech.com.br`. .NET 9, Clean Architecture em cinco projetos:

| Projeto | Arquivos | Linhas | Papel |
|---|---:|---:|---|
| `Infrastructure` | 132 | 42.974 | serviços, EF Core, importadores de Excel |
| `Api` | 93 | 16.058 | 65 controllers, auth, servidor MCP |
| `Application` | 88 | 7.952 | DTOs e abstrações (contratos entre camadas) |
| `Domain` | 102 | 3.552 | 98 entidades |
| `Tests` | 47 | 6.315 | 475 testes xUnit |

Mais 99 migrations do EF Core desde 19/05/2026 e um `AppDbContext` com 107
`DbSet`. Postgres local na própria VM, nginx terminando TLS na frente,
systemd segurando o processo, `pg_dump` diário por timer.

### O formato de uma requisição, ponta a ponta

```
navegador (SPA em /var/www, servida pelo nginx)
   │  /api/…            TLS termina AQUI
   ▼
nginx ──proxy──► 127.0.0.1:5002  (Kestrel, systemd, usuário sem privilégio)
                      │
                      ├─ UseForwardedHeaders   ← recupera o IP real do cliente
                      ├─ kill switch agêntico  ← middleware, ANTES do auth
                      ├─ UseAuthentication     ← JWT próprio (ou token de agente)
                      ├─ UseAuthorization      ← [Authorize] + [RequerSecao]
                      ├─ PreviewBatchMiddleware
                      ├─ UseRateLimiter        ← depois do auth, DE PROPÓSITO
                      └─ Controller ──► Service ──► EF Core ──► Postgres
```

A ordem do pipeline é decisão, não acaso: o rate limiter roda **depois** da
autenticação porque particiona por usuário (`claim sub`), e o escritório inteiro
sai por um NAT — particionar por IP puniria todos pelo comportamento de um.

---

## 2. As sete decisões que valem copiar

### 2.1 Cinco projetos, dependência só para dentro

`Api → Application → Domain`, com `Infrastructure` implementando as abstrações.
O `Domain` não referencia nada. É o que permite testar regra sem subir servidor.

### 2.2 A "lane" de ingestão: Importer → Ingest → Publicação → Query

O padrão mais reaproveitável da nsView. Toda fonte de dado (Cashflow,
Faturamento, Tech, People, BU GR, Buonny, HC) segue o **mesmo molde de quatro
peças**, e por isso uma fonte nova custa pouco:

| Peça | Responsabilidade |
|---|---|
| `XImporter` | lê o arquivo e devolve linhas tipadas. Não toca no banco de produção |
| `XIngestService` | valida, deriva canônicos, grava como **carga** (`ImportBatch`) |
| `XPublicacaoService` | decide qual carga **vale** para cada fatia |
| `XQueryService` | lê só o que está publicado, já recortado pelo escopo de quem pergunta |

O conceito central é a **fatia** (`mês × empresa × tipo`): publicar é reivindicar
fatias; despublicar é liberar. `FatiaAtual` é um ponteiro resolvido — para cada
fatia vence a reivindicação mais recente. Liberar faz a carga anterior
**ressurgir sozinha**, sem restore, sem apagar nada.

Isso é exatamente o que o item 13 do roadmap (importação de Excel) precisa, e é
melhor do que "sobe planilha e substitui": dá desfazer.

### 2.3 Autenticação: Entra ID na frente, JWT próprio por dentro

`EntraTokenValidator` valida o `id_token` da Microsoft; o `JwtTokenService` emite
o token da aplicação, com as permissões como claims. `BreakGlassPolicy` é
**fail-closed**: lista vazia significa "ninguém entra por senha".

Onde o fail-closed não é possível — se o SSO cair, a senha precisa voltar, senão
não há porta nenhuma — a escolha foi **não ser silencioso**: o boot grita
`[AVISO DE SEGURANÇA]` no log. Vale copiar a postura, não só o código.

### 2.4 RBAC em duas camadas ortogonais

| Camada | O que faz | Onde |
|---|---|---|
| **Seção** | barra o *endpoint* inteiro | `[RequerSecao("orcamento")]` |
| **Escopo** | recorta as *linhas* que voltam | dentro do service (família ∪ empresa) |

E capacidades pontuais no `CurrentUser` (`PodeEditarOrcamento`, `PodeUpload`,
`PodeRelatorioChurn`), com a regra invariável: **a barreira real é no servidor,
o front só pré-checa**. O `OrcamentoController` revalida em toda mutação.

Detalhe que vale roubar: a fiscalização de seção é **desligável pelo owner na
própria tela** (`IPlataformaConfig.RbacSecaoEnforce`, gravado no banco). Ligar
RBAC sem poder desligar sem SSH é como se trava a operação num domingo.

### 2.5 Isolamento de PII por credencial, não por código

`PeopleDbContext` conecta com `PEOPLE_DATABASE_URL` (role `fpa_app_people`); o
`AppDbContext` usa `fpa_app`, **que não tem `SELECT`** nas tabelas de folha.
Quem impõe é o `GRANT` no Postgres.

É o mesmo princípio do nosso `banco/07-permissoes.sql` — e é a confirmação de
que a escolha de pôr a permissão no banco não é exótica na NSTECH.

### 2.6 Gate de deploy: migrar antes de trocar o serviço

O binário **novo** roda `--migrate-only` com o site **velho** ainda no ar. Se o
schema falhar, o deploy aborta e a produção segue servindo a versão anterior.

Nasceu de um incidente real (migration com `42P07` pôs o boot em crash-loop). O
mesmo arquivo aceita `--migrate` e `--migrate-only` porque a divergência entre o
que o workflow chamava e o que o código reconhecia derrubou a produção em 12/08:
o processo subia como **servidor web** em vez de migrar, e o job ficava
pendurado. Falha silenciosa da pior espécie.

### 2.7 Ops que cabe numa VM

- **systemd** com `User=` sem privilégio, `ProtectSystem=strict`, `NoNewPrivileges`,
  `ReadWritePaths` restrito — se a API for comprometida, o alcance para no serviço.
- **nginx** termina TLS, serve a SPA (`try_files … /index.html`), faz proxy de
  `/api/`, com `client_max_body_size 200M` e `proxy_read_timeout 300s` para
  importação longa.
- **backup** por timer diário às 03:00, `pg_dump -Fc`, retenção de 14 dias, lendo
  a connection string do `.env` — sem duplicar credencial. Aceita rótulo, e o
  backfill dispara um backup rotulado antes de mutar.
- **deploy** por script no servidor: publica, para o serviço, `rsync --delete`
  preservando `.env`, religa, e **falha alto** se o serviço não subir.

---

## 3. O que **não** copiar

**A inversão da Clean Architecture.** O `Domain` da nsView tem 35 linhas por
arquivo — são entidades anêmicas. A regra vive no `Infrastructure`, junto do EF:
`OrcamentoReceitaService` tem 2.215 linhas, `CustosQueryService` 1.846,
`DataSeeder` 3.389. O nome das camadas está certo, o peso está no lugar errado.
Começando do zero, dá para pôr a regra no `Domain` desde o primeiro dia.

**O `DataSeeder` de 3.389 linhas rodando no boot.** Schema, sequences, admin e
backfills no mesmo arquivo, num caminho que só executa em produção.

**O ramo SQLite morto.** O `Program.cs` carrega `UseSqlite` e o `env.example`
sugere `DB_PROVIDER=sqlite`, mas o `rodar-local.md` avisa que o boot quebra numa
migration com `NOW()`. Caminho de código que ninguém exercita.

**99 migrations em três meses** custam 260 mil linhas de Designer e Snapshot —
mais linhas do que o código inteiro. Ver §5 sobre por que o NS Codex não deve
gerar schema por EF.

---

## 4. Mapa: o que cada um tem que o outro não tem

| Conceito | NS Codex | nsView |
|---|---|---|
| Versão congelada e imutável | gatilho no banco (`exige_versao_aberta`) | `congelar` no service + `FatiaAtual` |
| Permissão por empresa | **RLS** (`app_empresas_visiveis()`) | escopo no service (família ∪ empresa) |
| Trilha de auditoria | tabela append-only por **gatilho** | `ImportBatch` + log de publicação |
| **Fluxo de entrega e aprovação** | entrega · submissão · 6 regras · aceite final | **não existe** |
| **Lane de ingestão com desfazer** | não existe | 7 fontes no mesmo molde |
| Orçamento de Receita | modelado, sem app | **30+ rotas em produção** |
| Orçamento de Despesa e Capex | modelado (categorias assimétricas) | não coberto |
| SSO corporativo | pendente | Entra ID, com break-glass fail-closed |

Os dois se complementam mais do que competem: o NS Codex tem o **processo**
(quem entrega, quem aprova, quem justifica) e as três categorias assimétricas; a
nsView tem a **máquina** (ingestão, publicação, RBAC, deploy) e a Receita.

---

## 5. A decisão de stack

**Recomendação: .NET 9, espelhando o layout de projetos da nsView.**

O pedido é "rodar de maneira análoga", e o que se ganha é concreto:

- `infra/` da nsView é reaproveitável **quase literal**: systemd, nginx, backup,
  deploy. Muda nome de serviço, caminho e porta.
- Mesmo tenant Entra: o `TenantId`/`ClientId` do `appsettings.json` da nsView são
  os da NSTECH. SSO funciona sem projeto novo de identidade.
- Se um dia os dois produtos se encontrarem, mesma stack é *merge*; stack
  diferente é *reescrita*.

Isso **substitui** a recomendação de FastAPI do `BACKEND.md` §2. O que motivava o
FastAPI era reaproveitar os `ferramentas/*.py` — mas eles são scripts de bastidor,
rodados na mão, não o runtime. Continuam valendo como estão, ou viram um
`XImporter` em C# (a nsView lê os mesmos templates com MiniExcel/ClosedXML).

**O custo honesto:** é C# e EF Core, que você não escreve hoje. Não é obstáculo
para começar — o molde está pronto e é lido facilmente — mas é real, e o primeiro
mês rende menos.

### O ponto de atrito: EF Core × um schema que já existe

A nsView é *code-first*: o C# define o schema e as migrations saem dele. O NS
Codex é o contrário — o schema já existe, escrito à mão, e contém coisas que o EF
**não sabe modelar**: RLS, políticas, gatilhos, índices parciais, `RAISE
EXCEPTION`. Deixar o EF gerar esse schema significaria jogar fora o que
validamos ontem.

**A saída: os `banco/*.sql` continuam sendo a verdade.**

1. Schema evolui por **SQL numerado** (sqitch ou Flyway), nunca por `dotnet ef migrations add`.
2. O EF entra **database-first**: `dotnet ef dbcontext scaffold`, regerado quando
   o schema muda. O `DbContext` mapeia, não define.
3. O passo de deploy `--migrate-only` continua existindo — só que chama o
   migrador de SQL em vez do EF.

Assim se fica com o melhor dos dois: a regra continua no banco (que é o que faz o
`DELETE` de outra empresa devolver zero linha) e a aplicação ganha o molde da
nsView por cima.

---

## 6. O que isto destrava

### A pendência da TI já foi respondida — por precedente

O `BACKEND.md` §5 lista como risco nº 1 a pergunta "dado financeiro da NSTECH
pode ir para serviço fora do tenant Microsoft?", e diz para não carregar dado
real antes da resposta.

**A nsView responde na prática:** o dado não saiu. Roda numa VM Azure da própria
NSTECH, com Postgres local, certificado wildcard `*.nstech.com.br` e login pelo
Entra ID. Não é Supabase, não é Neon, não é Railway.

Ou seja, o NS Codex não precisa esperar decisão nenhuma: **basta seguir o mesmo
caminho que já foi aprovado para um sistema que carrega dado mais sensível** — a
nsView guarda salário e CPF no schema `people`.

### `cadastro.pessoa` sem coluna de senha deixa de ser problema

O comentário no `01-cadastro.sql` dizia que a autenticação deveria vir do SSO
corporativo, e o `BACKEND.md` §Fase 3 marcava isso como decisão pendente.
Decidido: **Entra ID**, no molde da nsView, com break-glass fail-closed. A tabela
fica como está.

---

## 7. Plano revisado

As fases do `BACKEND.md` continuam válidas; muda o conteúdo de três delas.

| Fase | Situação |
|---|---|
| 0 — validar o schema | ✅ **feita** em 14/08 (7 arquivos, 12 testes, 1 defeito corrigido) |
| 1 — carregar o cadastro real | **destravada** (§6) — não depende mais da TI |
| 2 — API de leitura | mesma ideia, agora em .NET: controllers finos + query services |
| 3 — identidade | **muda**: Entra ID + JWT próprio, portado da nsView |
| 4 — escrita em lote | ganha o molde da **lane** (§2.2): carga, fatia, publicação |
| 5 — fluxo | sem referência na nsView — é onde o NS Codex vai além |
| 6 — realizado | a lane de Cashflow/Faturamento é o modelo direto |
| 7 — operação | **muda**: copiar `infra/` da nsView em vez de inventar |

### Ordem de ataque

1. **Esqueleto .NET com os cinco projetos e um endpoint só** — `GET /health` e um
   `GET /api/ref/contas` lendo do Postgres que já subimos. Prova a stack ponta a
   ponta em um dia.
2. **`infra/` portado** — systemd, nginx, backup, deploy. Antes de ter o que
   deployar, para que o primeiro deploy não seja também a primeira vez.
3. **Entra ID + JWT**, portando `EntraTokenValidator`, `JwtTokenService` e
   `BreakGlassPolicy` quase literais.
4. **`[RequerSecao]` e `CurrentUser`** com as capacidades do NS Codex.
5. **A primeira lane**: importação de Excel de lançamentos, no molde de quatro peças.

---

## 8. Riscos

1. **Duplicação de produto.** A nsView já tem Orçamento de Receita em produção,
   com 30+ rotas. Construir Despesa e Capex do lado de fora pode virar dois
   sistemas orçando a mesma empresa. **Decisão de negócio, e é anterior à
   engenharia** — vale conversar com quem mantém a nsView antes da Fase 2.
2. **Curva do C#.** Real, mitigada pelo molde pronto.
3. **EF database-first regerado à mão** é passo manual que alguém esquece. Vale
   um teste que compare o `DbContext` com o schema, no espírito do
   `MigrationsIdempotentesTests` da nsView.
4. **Copiar o `infra/` sem entender** traz junto premissas da VM da nsView (nome
   de serviço, caminhos, usuário `nsview-deploy`, gateway do Azure que precisa
   encaminhar 443 → 443). Ler os comentários antes: eles registram os erros que
   já foram pagos.
