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

**Nada de autenticação ainda.** Entra ID + JWT é o passo 3 da ordem de ataque.
Enquanto não existir, todo endpoint está aberto — não expor fora da máquina.

**`appsettings.Development.json` está no `.gitignore`** de propósito: é onde a
connection string local com senha acabaria parando.
